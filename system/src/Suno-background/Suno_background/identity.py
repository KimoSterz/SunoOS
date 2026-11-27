# SPDX-License-Identifier: MPL-2.0
"""Who is calling, established from the kernel and the bus, never from arguments.

The approach follows the Semantic Broker's identity resolver
(src/Suno-platform/broker/Suno_semantic_broker/identity.py): a Flatpak is
known by the sandbox's own .flatpak-info, a native process by the systemd
unit the session launched it into.
"""

from __future__ import annotations

import configparser
import os
import re
from dataclasses import dataclass
from pathlib import Path

import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

from . import ids  # noqa: E402

PORTAL_FRONTEND = "/usr/libexec/xdg-desktop-portal"
UNIQUE_NAME = re.compile(r"^:[0-9]+\.[0-9]+$")
TRUSTED_HOSTS = {
    # The shells that draw the dock menu, and Settings.
    "/usr/bin/gnome-shell": "org.gnome.Shell",
    "/usr/bin/phosh": "sm.puri.Phosh",
    "/usr/libexec/phosh": "sm.puri.Phosh",
    "/usr/bin/gnome-control-center": "",
}
_SCOPE = re.compile(
    r"^app-(?:(?:gnome|flatpak|kde|Suno|systemd)-)?(?P<app>[A-Za-z0-9_.\\]+?)-[0-9]+\.scope$"
)
_DBUS_SERVICE = re.compile(r"^dbus-:[0-9.]+-(?P<app>[A-Za-z0-9_.\\]+?)@[0-9]+\.service$")
_APP_SERVICE = re.compile(r"^app-(?:(?:gnome|flatpak|Suno)-)?(?P<app>[A-Za-z0-9_.\\]+?)@[0-9a-z]+\.service$")


class IdentityError(PermissionError):
    pass


def _pidfd_pid(fd: int) -> int:
    """The pid a pidfd refers to; 0 once the process has exited."""
    try:
        for line in Path(f"/proc/self/fdinfo/{fd}").read_text().splitlines():
            if line.startswith("Pid:"):
                return max(int(line.split()[1]), 0)
    except (OSError, ValueError, IndexError):
        pass
    return 0


@dataclass(frozen=True, slots=True)
class Caller:
    sender: str
    pid: int
    uid: int
    app_id: str = ""
    sandboxed: bool = False
    #: The last component of the caller's cgroup, e.g. app-org.x.Y-agent.service.
    unit: str = ""
    executable: str = ""

    @property
    def is_agent(self) -> bool:
        return bool(self.app_id) and self.unit == ids.agent_unit(self.app_id)


def unit_app(unit: str) -> str:
    """The application a session unit was launched for, or an empty string."""

    agent = ids.parse_agent_unit(unit)
    if agent:
        return agent
    for pattern in (_SCOPE, _DBUS_SERVICE, _APP_SERVICE):
        match = pattern.fullmatch(unit)
        if match:
            candidate = ids.systemd_unescape(match.group("app"))
            if ids.is_app_id(candidate):
                return candidate
    return ""


class IdentityResolver:
    def __init__(self, connection: Gio.DBusConnection, *, proc: Path = Path("/proc"),
                 extra_trusted: tuple[str, ...] = (), authenticate=None) -> None:
        self.connection = connection
        self.proc = proc
        self.trusted = dict(TRUSTED_HOSTS)
        # A Flatpak is the signed deployment it says it is, or nothing:
        # Suno_installer.app_data_broker.authenticate, once per connection.
        self._authenticate = authenticate
        self._verified: dict[str, str] = {}
        for executable in extra_trusted:
            if executable.startswith("/"):
                self.trusted.setdefault(executable, "")

    def _credentials(self, sender: str) -> tuple[int, int, int]:
        """(uid, pid, pidfd). pidfd is -1 only when the bus offers none; a bus
        that names ProcessFD but doesn't deliver it is refused."""
        if not UNIQUE_NAME.fullmatch(sender or ""):
            raise IdentityError("caller has no unique bus name")
        result, fds = self.connection.call_with_unix_fd_list_sync(
            "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
            "GetConnectionCredentials", GLib.Variant("(s)", (sender,)),
            GLib.VariantType.new("(a{sv})"), Gio.DBusCallFlags.NONE, 5_000, None, None)
        values = result.unpack()[0]
        pidfd = -1
        if "ProcessFD" in values:
            index = values["ProcessFD"]
            try:
                if (isinstance(index, bool) or not isinstance(index, int) or fds is None
                        or not 0 <= index < fds.get_length()):
                    raise IdentityError("the bus named a process descriptor it did not deliver")
                pidfd = fds.get(index)
            except GLib.Error as error:
                raise IdentityError("the bus delivered an invalid process descriptor") from error
            if not isinstance(pidfd, int) or pidfd < 0:
                raise IdentityError("the bus delivered an invalid process descriptor")
        uid, pid = values.get("UnixUserID"), values.get("ProcessID")
        if not isinstance(uid, int) or not isinstance(pid, int) or pid <= 0:
            if pidfd >= 0:
                os.close(pidfd)
            raise IdentityError("the bus did not report the caller's process")
        return uid, pid, pidfd

    def _start(self, pid: int) -> str | None:
        try:
            return (self.proc / str(pid) / "stat").read_text().rsplit(")", 1)[1].split()[19]
        except (OSError, IndexError):
            return None

    def _held(self, pid: int, pidfd: int, start: str | None) -> bool:
        """The pid is still the process the bus named: by its pidfd, or, on a
        bus that offers none, by its start time."""
        if pidfd >= 0:
            return _pidfd_pid(pidfd) == pid
        return start is not None and self._start(pid) == start

    def _flatpak_app(self, pid: int) -> str:
        """The Flatpak's app ID; "" for a process that is not one. Anything
        but a plain absence fails closed: an unreadable or malformed
        .flatpak-info is never taken for a native process."""
        parser = configparser.ConfigParser(interpolation=None)
        try:
            with (self.proc / str(pid) / "root/.flatpak-info").open("r", encoding="utf-8") as stream:
                parser.read_file(stream)
        except FileNotFoundError:
            return ""
        except (OSError, configparser.Error, UnicodeError) as error:
            raise IdentityError("the caller's sandbox could not be read") from error
        name = parser.get("Application", "name", fallback="").strip()
        if not ids.is_app_id(name):
            raise IdentityError("the caller's sandbox names no application")
        return name

    def _same_host(self, pid: int, unit: str) -> bool:
        """The caller sees the host's own filesystem (root and mount namespace).
        Unreadable counts as foreign, whatever its unit. gnome-shell has no
        file capability (checked on published nightly commits: only its
        security.selinux label; Fedora's package sets no %caps), so it is
        dumpable and readable; an unreadable caller is never the Shell, and
        any program can run in a unit named like the Shell's and take
        org.gnome.Shell (owned with replacement allowed)."""
        process, own = self.proc / str(pid), self.proc / "self"
        try:
            root, host = (process / "root").stat(), (own / "root").stat()
            return (root.st_dev, root.st_ino) == (host.st_dev, host.st_ino) and \
                os.readlink(process / "ns/mnt") == os.readlink(own / "ns/mnt")
        except OSError:
            return False

    def forget(self, sender: str) -> None:
        self._verified.pop(sender, None)

    def _unit(self, pid: int) -> str:
        try:
            lines = (self.proc / str(pid) / "cgroup").read_text(encoding="utf-8").splitlines()
        except OSError:
            return ""
        for line in lines:
            if line.startswith("0::"):
                return line[3:].rstrip("/").rsplit("/", 1)[-1]
        return ""

    def _executable(self, pid: int) -> str:
        # An unreadable executable is no program at all: no command line, process
        # name or unit stands in for it (all can be chosen by the caller).
        try:
            return os.readlink(self.proc / str(pid) / "exe")
        except OSError:
            return ""

    def resolve(self, sender: str) -> Caller:
        uid, pid, pidfd = self._credentials(sender)
        try:
            start = self._start(pid) if pidfd < 0 else None
            caller = self._resolve(sender, uid, pid)
            if not self._held(pid, pidfd, start):
                raise IdentityError("the caller has gone")
            return caller
        finally:
            if pidfd >= 0:
                os.close(pidfd)

    def _resolve(self, sender: str, uid: int, pid: int) -> Caller:
        if uid != os.getuid():
            raise IdentityError("caller belongs to another user")
        flatpak = self._flatpak_app(pid)
        unit = self._unit(pid)
        if flatpak:
            if self._authenticate is not None and self._verified.get(sender) != flatpak:
                try:
                    verified = self._authenticate(self.connection, sender)
                except Exception as error:  # noqa: BLE001 -- unsigned, altered, unknown: not admitted
                    raise IdentityError("the application is not a signed Suno deployment") from error
                if verified != flatpak:
                    raise IdentityError("the application is not the deployment it names")
                self._verified[sender] = flatpak
            return Caller(sender, pid, uid, flatpak, True, unit, "")
        # A process in another filesystem is never named by its executable:
        # inside its own root /usr/bin/gnome-control-center is anything.
        executable = self._executable(pid) if self._same_host(pid, unit) else ""
        return Caller(sender, pid, uid, unit_app(unit), False, unit, executable)

    def is_portal_frontend(self, sender: str) -> bool:
        """xdg-desktop-portal itself: the owner of org.freedesktop.portal.Desktop,
        running the root-owned /usr/libexec/xdg-desktop-portal in its own unit
        on the host's filesystem."""
        try:
            caller = self.resolve(sender)
            owner = self.connection.call_sync(
                "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                "GetNameOwner", GLib.Variant("(s)", ("org.freedesktop.portal.Desktop",)),
                GLib.VariantType.new("(s)"), Gio.DBusCallFlags.NONE, 2_000, None).unpack()[0]
            program = os.stat(PORTAL_FRONTEND)
        except (IdentityError, GLib.Error, OSError):
            return False
        return (not caller.sandboxed and caller.executable == PORTAL_FRONTEND
                and caller.unit == "xdg-desktop-portal.service" and owner == sender
                and program.st_uid == 0 and not program.st_mode & 0o022)

    def is_trusted_host(self, caller: Caller) -> bool:
        """The Shell, Phosh, or Settings: the places a person flips the switch."""

        if caller.sandboxed or caller.executable not in self.trusted:
            return False
        required_name = self.trusted[caller.executable]
        if not required_name:
            return True
        try:
            owner = self.connection.call_sync(
                "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                "GetNameOwner", GLib.Variant("(s)", (required_name,)),
                GLib.VariantType.new("(s)"), Gio.DBusCallFlags.NONE, 2_000, None).unpack()[0]
        except GLib.Error:
            return False
        return owner == caller.sender
