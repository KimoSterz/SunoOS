# SPDX-License-Identifier: Apache-2.0
"""Who may read an agent's published values, and what each reader sees.

An agent's Values (unread counts, link state, account status) used to be a
property anyone could Get and a PropertiesChanged everyone heard. Now:

* the person's own programs (a host process in this session's filesystem
  whose /proc entries can be read: the Shell's dock, Settings, the app's
  native UI) read every value; an unreadable (non-dumpable) process reads
  nothing. That is
  same-user trust, not a boundary: such a program can read the app's files;
* the app's own sandbox (a Flatpak whose /.flatpak-info, written by flatpak
  and bound read-only into its D-Bus proxy, names the agent's app; for a
  signed Suno app also its signed deployment, authenticate()) reads every
  value;
* a process Suno's launchers sandbox (an app-Suno-* scope, or a host
  xdg-dbus-proxy that is not a Flatpak's) is a sandbox, never the host;
* an app the agent names as bound (``bound``), and only once the installer's
  authenticate() has shown it is that signed Suno app, reads the ``shared``
  values only;
* anything else (another sandbox, one whose sandbox file can't be read, a
  process in another filesystem namespace) reads nothing.

Values reach readers by unicast only: a reader admitted by a Get hears later
changes; the Shell, Phosh and Settings, when they hold their names, hear them
too.
"""

from __future__ import annotations

import configparser
import os
import re
from pathlib import Path
from typing import Callable

from gi.repository import Gio, GLib

ALL, SHARED = "all", "shared"
#: Host listeners told of every change while they run.
TRUSTED_LISTENERS = ("org.gnome.Shell", "sm.puri.Phosh", "org.gnome.Settings")
_LIMIT = 256


def _pidfd_pid(fd: int) -> int:
    try:
        for line in Path(f"/proc/self/fdinfo/{fd}").read_text().splitlines():
            if line.startswith("Pid:"):
                return int(line.split()[1])
    except (OSError, ValueError, IndexError):
        pass
    return 0


def delivered_pidfd(values, fds) -> int:
    """The caller's pidfd from GetConnectionCredentials; -1 when the bus offers
    none. A bus that names ProcessFD but doesn't deliver a valid descriptor
    is refused (PermissionError), never treated as one that offers none."""
    if "ProcessFD" not in values:
        return -1
    index = values["ProcessFD"]
    try:
        if (isinstance(index, bool) or not isinstance(index, int) or fds is None
                or not 0 <= index < fds.get_length()):
            raise PermissionError("the bus named a process descriptor it did not deliver")
        descriptor = fds.get(index)
    except GLib.Error as error:
        raise PermissionError("the bus delivered an invalid process descriptor") from error
    if not isinstance(descriptor, int) or descriptor < 0:
        raise PermissionError("the bus delivered an invalid process descriptor")
    return descriptor


def process_start(pid: int, proc: Path = Path("/proc")) -> str | None:
    """Start time (stat field 22): the same before and after a check, the pid
    was not reused in between. None when unreadable."""
    try:
        return (proc / str(pid) / "stat").read_text().rsplit(")", 1)[1].split()[19]
    except (OSError, IndexError):
        return None


def _same_host(pid: int, proc: Path) -> bool:
    try:
        root, host = (proc / str(pid) / "root").stat(), (proc / "self/root").stat()
        return ((root.st_dev, root.st_ino) == (host.st_dev, host.st_ino)
                and os.readlink(proc / str(pid) / "ns/mnt") == os.readlink(proc / "self/ns/mnt"))
    except OSError:
        return False


def sandbox_name(pid: int, proc: Path = Path("/proc")) -> str | None:
    """The Flatpak app a process belongs to; "" for none; None when unreadable."""
    try:
        text = (proc / str(pid) / "root/.flatpak-info").read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""
    except (OSError, UnicodeError):
        return None
    parser = configparser.ConfigParser(interpolation=None)
    try:
        parser.read_string(text)
    except configparser.Error:
        return None
    return parser.get("Application", "name", fallback="") or None


def _launcher_sandbox(pid: int, proc: Path) -> bool:
    """A process Suno's own launchers sandbox, whatever its filesystem looks
    like: one in an app-Suno-* scope (store apps, capsules, AppImages), or a
    D-Bus proxy (xdg-dbus-proxy) that is not a Flatpak's. Today those proxies
    filter these names out; the identity rule does not rely on that."""
    try:
        lines = (proc / str(pid) / "cgroup").read_text().strip().splitlines()
    except OSError:
        return True
    leaf = lines[-1].rstrip("/").rsplit("/", 1)[-1] if lines else ""
    if leaf.startswith("app-Suno-") and leaf.endswith(".scope"):
        return True
    try:
        executable = os.readlink(proc / str(pid) / "exe").removesuffix(" (deleted)")
    except OSError:
        return False
    return os.path.basename(executable) in {"xdg-dbus-proxy", "flatpak-dbus-proxy"}


def _signed_Suno_app(app_id: str) -> bool:
    try:
        from Suno_installer.native_app_roles import APPS
    except ImportError:
        return False
    return app_id in APPS


def classify(app_id: str, bound: frozenset[str], *, pid: int, proc: Path = Path("/proc"),
             authenticate: Callable[[], str] | None = None) -> str | None:
    """ALL, SHARED or None for the process behind a reader."""
    name = sandbox_name(pid, proc)
    if name is None or (name == "" and not _same_host(pid, proc)):
        # Unreadable or in another filesystem: nothing. gnome-shell is
        # dumpable (no file capability), and a unit named like the Shell's or
        # org.gnome.Shell (owned with replacement allowed) proves nothing.
        return None
    if name == "":
        return None if _launcher_sandbox(pid, proc) else ALL
    if name == app_id:
        # A signed Suno app's ID is matched by its signed deployment too: a
        # Flatpak from another source can carry the same ID.
        if not _signed_Suno_app(app_id):
            return ALL
        try:
            return ALL if authenticate is not None and authenticate() == app_id else None
        except Exception:  # noqa: BLE001 -- unsigned or altered
            return None
    if name in bound and authenticate is not None:
        try:
            return SHARED if authenticate() == name else None
        except Exception:  # noqa: BLE001 -- unsigned or altered: not the bound app
            return None
    return None


def _authenticate(connection: Gio.DBusConnection, sender: str) -> str:
    from Suno_installer.app_data_broker import authenticate
    return authenticate(connection, sender)


class Readers:
    def __init__(self, connection: Gio.DBusConnection, app_id: str, *, bound=(), shared=(),
                 proc: Path = Path("/proc")) -> None:
        self.connection = connection
        self.app_id = app_id
        self.bound = frozenset(bound)
        self.shared = frozenset(shared)
        self.proc = proc
        self._readers: dict[str, str] = {}
        self._subscription = connection.signal_subscribe(
            "org.freedesktop.DBus", "org.freedesktop.DBus", "NameOwnerChanged", "/org/freedesktop/DBus",
            None, Gio.DBusSignalFlags.NONE, self._owner_changed)

    def close(self) -> None:
        if self._subscription:
            self.connection.signal_unsubscribe(self._subscription)
            self._subscription = 0

    def _owner_changed(self, _connection, _sender, _path, _interface, _signal, parameters) -> None:
        name, _old, new = parameters.unpack()
        if name.startswith(":") and not new:
            self._readers.pop(name, None)

    def admit(self, sender: str | None) -> str | None:
        """The reader's scope, remembered so it hears later changes."""
        if not sender:
            return ALL  # a call from inside this process
        if sender in self._readers:
            return self._readers[sender]
        scope = self._resolve(sender)
        if scope is not None and len(self._readers) < _LIMIT:
            self._readers[sender] = scope
        return scope

    def _resolve(self, sender: str) -> str | None:
        pidfd = -1
        try:
            result, fds = self.connection.call_with_unix_fd_list_sync(
                "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                "GetConnectionCredentials", GLib.Variant("(s)", (sender,)),
                GLib.VariantType.new("(a{sv})"), Gio.DBusCallFlags.NONE, 5000, None, None)
            values = result.unpack()[0]
            pidfd = delivered_pidfd(values, fds)
            pid, uid = values.get("ProcessID"), values.get("UnixUserID")
            if not isinstance(pid, int) or pid <= 0 or uid != os.getuid():
                return None
            # Held by its pidfd, or on a bus that offers none, its start time.
            start = process_start(pid, self.proc) if pidfd < 0 else None
            if (_pidfd_pid(pidfd) != pid) if pidfd >= 0 else start is None:
                return None
            scope = classify(self.app_id, self.bound, pid=pid, proc=self.proc,
                             authenticate=lambda: _authenticate(self.connection, sender))
            if (_pidfd_pid(pidfd) != pid) if pidfd >= 0 else process_start(pid, self.proc) != start:
                return None
            return scope
        except (GLib.Error, PermissionError):
            return None
        finally:
            if pidfd >= 0:
                os.close(pidfd)

    def _owner(self, name: str) -> str:
        try:
            return self.connection.call_sync(
                "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetNameOwner",
                GLib.Variant("(s)", (name,)), GLib.VariantType.new("(s)"), Gio.DBusCallFlags.NONE,
                1000, None).unpack()[0]
        except GLib.Error:
            return ""

    def values_for(self, scope: str | None, values: dict[str, GLib.Variant]) -> dict[str, GLib.Variant] | None:
        if scope == ALL:
            return dict(values)
        if scope == SHARED:
            return {name: value for name, value in values.items() if name in self.shared}
        return None

    def listeners(self) -> dict[str, str]:
        """Every reader to tell of a change, with its scope."""
        found = dict(self._readers)
        for name in TRUSTED_LISTENERS:
            owner = self._owner(name)
            if owner and owner not in found:
                scope = self.admit(owner)
                if scope is not None:
                    found[owner] = scope
        return found

    def emit(self, path: str, interface: str, values: dict[str, GLib.Variant]) -> None:
        """PropertiesChanged for Values, to each reader with what it may see."""
        for destination, scope in self.listeners().items():
            visible = self.values_for(scope, values)
            if visible is None:
                continue
            self.connection.emit_signal(
                destination, path, "org.freedesktop.DBus.Properties", "PropertiesChanged",
                GLib.Variant("(sa{sv}as)", (interface, {"Values": GLib.Variant("a{sv}", visible)}, [])))
