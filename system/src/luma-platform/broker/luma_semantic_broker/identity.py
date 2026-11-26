# SPDX-License-Identifier: Apache-2.0
"""Resolve app identity from bus credentials instead of caller-supplied IDs."""

from __future__ import annotations

import configparser
import os
from pathlib import Path
import re
from typing import Any

import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

from .desktop import desktop_application
from .model import Identity, IdentityStrength
from .validation import APP_ID, ValidationError, application_id


UNIQUE_NAME = re.compile(r"^:[0-9]+\.[0-9]+$")
SCOPE_APP = re.compile(
    r"(?:^|/)app-(?:gnome-|(?P<flatpak>flatpak-))?(?P<app>[A-Za-z0-9_.\\x]+?)-[0-9A-Fa-f]+\.scope(?:$|/)"
)
# A background agent (ADR-033) runs as the app, in a unit luma-background
# generates from the app's validated declaration: app-<app-id>-agent.service
# under a luma-background slice. It publishes the app's Live Extensions with
# every window closed, so it carries the app's identity like a launch scope.
AGENT_APP = re.compile(
    r"/luma-background(?:-[a-z]+)?\.slice/app-(?P<app>[A-Za-z0-9_.\\x]+?)-agent\.service(?:$|/)"
)


class IdentityError(PermissionError):
    pass


def _variant_integer(value: Any, field: str) -> int:
    if isinstance(value, GLib.Variant):
        value = value.unpack()
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise IdentityError(f"D-Bus returned an invalid {field}")
    return value


def _unescape_systemd(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        return chr(int(match.group(1), 16))

    return re.sub(r"\\x([0-9A-Fa-f]{2})", replace, value)


def pidfd_pid(descriptor: int) -> int:
    """The pid a pidfd refers to; 0 once the process has exited."""
    try:
        for line in Path(f"/proc/self/fdinfo/{descriptor}").read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition(":")
            if separator and key == "Pid":
                return max(int(value.strip()), 0)
    except (OSError, ValueError):
        pass
    return 0


class DBusCredentialResolver:
    def __init__(self, connection: Gio.DBusConnection) -> None:
        self._connection = connection

    def credentials(self, sender: str) -> tuple[int, int]:
        uid, pid, descriptor = self.pinned(sender)
        if descriptor >= 0:
            os.close(descriptor)
        return uid, pid

    def pinned(self, sender: str) -> tuple[int, int, int]:
        """(uid, pid, pidfd). The pidfd, open for the caller to close, is -1
        only when the bus offers no ProcessFD; one it names but doesn't
        deliver is refused."""
        if not isinstance(sender, str) or not UNIQUE_NAME.fullmatch(sender):
            raise IdentityError("semantic caller does not have a unique bus name")
        result, descriptor_list = self._connection.call_with_unix_fd_list_sync(
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "GetConnectionCredentials",
            GLib.Variant("(s)", (sender,)),
            GLib.VariantType.new("(a{sv})"),
            Gio.DBusCallFlags.NONE,
            5_000,
            None,
            None,
        )
        values = result.unpack()[0]
        uid = _variant_integer(values.get("UnixUserID"), "UnixUserID")
        pid = _variant_integer(values.get("ProcessID"), "ProcessID")
        if "ProcessFD" not in values:
            return uid, pid, -1
        if descriptor_list is None:
            raise IdentityError("D-Bus omitted the process descriptor list")
        handle = _variant_integer(values.get("ProcessFD"), "ProcessFD")
        try:
            descriptor = descriptor_list.get(handle)
        except GLib.Error as error:
            raise IdentityError("D-Bus returned an invalid process descriptor") from error
        if descriptor < 0:
            raise IdentityError("D-Bus returned an invalid process descriptor")
        if pidfd_pid(descriptor) != pid:
            os.close(descriptor)
            raise IdentityError("D-Bus process identity changed during resolution")
        return uid, pid, descriptor

    def name_owner(self, name: str) -> str:
        result = self._connection.call_sync(
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "GetNameOwner",
            GLib.Variant("(s)", (name,)),
            GLib.VariantType.new("(s)"),
            Gio.DBusCallFlags.NONE,
            5_000,
            None,
        )
        return result.unpack()[0]


class IdentityResolver:
    def __init__(
        self,
        credentials: DBusCredentialResolver,
        *,
        proc_root: Path = Path("/proc"),
        desktop_lookup=None,
    ) -> None:
        self._credentials = credentials
        self._proc_root = proc_root
        self._desktop_lookup = desktop_lookup or self._desktop_application

    @staticmethod
    def _desktop_application(app_id: str) -> tuple[bool, str]:
        return desktop_application(app_id)

    def _flatpak_id(self, pid: int) -> str:
        """The Flatpak app a caller belongs to, "" for none. A sandbox record
        that exists but can't be read or parsed is refused, never "none"."""
        path = self._proc_root / str(pid) / "root/.flatpak-info"
        try:
            parser = configparser.ConfigParser(interpolation=None)
            with path.open("r", encoding="utf-8") as stream:
                parser.read_file(stream)
        except FileNotFoundError:
            return ""
        except (OSError, UnicodeError, configparser.Error) as error:
            raise IdentityError("semantic caller's sandbox could not be read") from error
        value = parser.get("Application", "name", fallback="").strip()
        try:
            return application_id(value)
        except ValidationError as error:
            raise IdentityError("semantic caller's sandbox names no valid app") from error

    def _require_native(self, pid: int) -> None:
        process = self._proc_root / str(pid)
        try:
            root, own_root = (process / "root").stat(), (self._proc_root / "self/root").stat()
            same_host = ((root.st_dev, root.st_ino) == (own_root.st_dev, own_root.st_ino)
                         and os.readlink(process / "ns/mnt") == os.readlink(self._proc_root / "self/ns/mnt"))
            executable = os.readlink(process / "exe").removesuffix(" (deleted)")
            lines = (process / "cgroup").read_text(encoding="utf-8").strip().splitlines()
        except (OSError, UnicodeError) as error:
            raise IdentityError("semantic caller could not be read") from error
        if not same_host:
            raise IdentityError("semantic caller is in another filesystem")
        leaf = lines[-1].rstrip("/").rsplit("/", 1)[-1] if lines else ""
        if (leaf.startswith("app-luma-") and leaf.endswith(".scope")) or \
                os.path.basename(executable) in {"xdg-dbus-proxy", "flatpak-dbus-proxy"}:
            raise IdentityError("semantic caller is a Luma launcher sandbox")

    def _cgroup_id(self, pid: int) -> str | None:
        try:
            lines = (self._proc_root / str(pid) / "cgroup").read_text(
                encoding="utf-8"
            ).splitlines()
        except OSError:
            return None
        for line in lines:
            match = SCOPE_APP.search(line) or AGENT_APP.search(line)
            if match is None:
                continue
            if match.groupdict().get("flatpak"):
                # Flatpak runs every sandbox in this scope with its
                # .flatpak-info; a caller here without one is not a sandbox
                # the broker can name.
                raise IdentityError("semantic caller is in a Flatpak scope without its sandbox record")
            candidate = _unescape_systemd(match.group("app"))
            if APP_ID.fullmatch(candidate) and self._desktop_lookup(candidate)[0]:
                return candidate
        return None

    def _start(self, pid: int) -> str | None:
        try:
            return (self._proc_root / str(pid) / "stat").read_text().rsplit(")", 1)[1].split()[19]
        except (OSError, IndexError):
            return None

    def _held(self, sender: str, inspect):
        """inspect(uid, pid) while the pid is held: by the caller's pidfd, or
        on a bus that offers none, by its start time before and after."""
        uid, pid, descriptor = self._credentials.pinned(sender)
        try:
            start = self._start(pid) if descriptor < 0 else None
            if descriptor < 0 and start is None:
                raise IdentityError("semantic caller has gone")
            result = inspect(uid, pid)
            if (pidfd_pid(descriptor) != pid) if descriptor >= 0 else self._start(pid) != start:
                raise IdentityError("semantic caller changed during resolution")
            return result
        finally:
            if descriptor >= 0:
                os.close(descriptor)

    def resolve(self, sender: str) -> Identity:
        return self._held(sender, lambda uid, pid: self._identity(sender, uid, pid))

    def _identity(self, sender: str, uid: int, pid: int) -> Identity:
        if uid != os.getuid():
            raise IdentityError("semantic caller belongs to another user")
        flatpak_id = self._flatpak_id(pid)
        if flatpak_id:
            found, label = self._desktop_lookup(flatpak_id)
            return Identity(
                key=f"flatpak:{flatpak_id}",
                app_id=flatpak_id,
                label=label if found else flatpak_id,
                sender=sender,
                uid=uid,
                pid=pid,
                strength=IdentityStrength.SANDBOXED,
            )
        # Not a Flatpak: a native caller must be this session's own program,
        # seen in the broker's filesystem, readable, and not one of Luma's
        # launcher sandboxes (store apps, capsules, AppImages run in an
        # app-luma-* scope behind a host xdg-dbus-proxy with no .flatpak-info).
        self._require_native(pid)
        cgroup_id = self._cgroup_id(pid)
        if cgroup_id:
            _, label = self._desktop_lookup(cgroup_id)
            return Identity(
                key=f"native:{cgroup_id}",
                app_id=cgroup_id,
                label=label,
                sender=sender,
                uid=uid,
                pid=pid,
                strength=IdentityStrength.MANAGED_NATIVE,
            )
        return Identity(
            key=f"transient:{uid}:{sender}",
            app_id="",
            label="Unverified native application",
            sender=sender,
            uid=uid,
            pid=pid,
            strength=IdentityStrength.TRANSIENT_NATIVE,
        )

    def provider(self, sender: str, claimed_app_id: str) -> Identity:
        claimed = application_id(claimed_app_id)
        identity = self.resolve(sender)
        if not identity.app_id:
            raise IdentityError(
                "native provider is not running in a verified application scope"
            )
        if identity.app_id != claimed:
            raise IdentityError("provider application identity does not match caller")
        return identity

    def require_shell_host(self, sender: str) -> Identity:
        """Authenticate the running system Shell, not merely a claimed app id."""

        return self._held(sender, lambda uid, pid: self._shell_host(sender, uid, pid))

    def _shell_host(self, sender: str, uid: int, pid: int) -> Identity:
        identity = self._identity(sender, uid, pid)
        try:
            owner = self._credentials.name_owner("org.gnome.Shell")
        except GLib.Error as error:
            raise IdentityError("system Live Extension host could not be verified") from error
        if owner != sender:
            raise IdentityError("Live Extensions may only be read by the system Shell")
        if identity.strength is IdentityStrength.SANDBOXED:
            raise IdentityError("Live Extensions may only be read by the system Shell")
        process = self._proc_root / str(identity.pid)
        try:
            # Unreadable (another user namespace, a non-dumpable process) or
            # in another filesystem is refused: nothing the process controls
            # (command line, name, unit name, org.gnome.Shell, which is owned
            # with replacement allowed) stands in for its executable.
            executable = (process / "exe").readlink()
            root, own_root = (process / "root").stat(), (self._proc_root / "self/root").stat()
            same_host = ((root.st_dev, root.st_ino) == (own_root.st_dev, own_root.st_ino)
                         and os.readlink(process / "ns/mnt") == os.readlink(self._proc_root / "self/ns/mnt"))
        except OSError as error:
            raise IdentityError("system Live Extension host could not be verified") from error
        if not same_host or executable != Path("/usr/bin/gnome-shell"):
            raise IdentityError("Live Extensions may only be read by the system Shell")
        return identity
