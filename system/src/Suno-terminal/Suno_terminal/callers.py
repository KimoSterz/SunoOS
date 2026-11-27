# SPDX-License-Identifier: Apache-2.0
"""Who asked Terminal to run something, and whether it may.

Terminal is a host program behind a D-Bus-activatable GApplication, so any app
allowed to talk to org.projectSuno.Terminal can send it Open. Opening a
terminal at a folder is harmless; running a file is running a program as the
person. GApplication does not tell do_open who called, so:

* Open over D-Bus opens folders only, whoever sent it; Open from Terminal's
  own command line (a launcher started it with a file) may run it;
* org.projectSuno.Terminal1.RunProgram, where the caller is known, runs a
  program for the host (same-user trust: host programs can run anything
  themselves) and for the signed Filer (org.gnome.Nautilus, its deployment
  checked by the installer's authenticate, as every first-party sandbox is),
  whose Run sends programs here. Any other sandbox (a Flatpak, a process in
  another filesystem namespace, or one that can't be read) is refused;
* a program that came from the internet (a browser's user.xdg.origin.url, or
  the person's Downloads folder) is typed at the prompt and not run: Return
  runs it.
"""

from __future__ import annotations

import configparser
import os
import shlex
from dataclasses import dataclass
from pathlib import Path

from gi.repository import Gio, GLib

FILER = "org.gnome.Nautilus"
RUN_XML = """<node><interface name="org.projectSuno.Terminal1">
  <method name="RunProgram"><arg type="s" name="uri" direction="in"/>
    <arg type="a{sv}" name="options" direction="in"/></method>
  <method name="OpenFolder"><arg type="s" name="uri" direction="in"/>
    <arg type="a{sv}" name="options" direction="in"/></method>
  <method name="Open"><arg type="as" name="uris" direction="in"/>
    <arg type="a{sv}" name="options" direction="in"/></method>
</interface></node>"""
#: A session an app opened at a folder of its choosing runs with git's
#: repository-side code turned off (a prompt that runs `git status` there
#: would otherwise run the folder's core.fsmonitor or hooks), for that
#: session only, through git's own environment configuration.
GUARDED_GIT = {"GIT_CONFIG_COUNT": "2", "GIT_CONFIG_KEY_0": "core.fsmonitor", "GIT_CONFIG_VALUE_0": "",
               "GIT_CONFIG_KEY_1": "core.hooksPath", "GIT_CONFIG_VALUE_1": "/dev/null"}
SANDBOX_CGROUP_MARKERS = ("/app-flatpak-", "/app-Suno-", "/snap.")
SANDBOX_LABEL_MARKERS = ("Suno_application.process", ":container_t:")


@dataclass(frozen=True)
class Caller:
    sender: str
    pid: int
    sandboxed: bool
    app_id: str = ""
    may_run: bool = False



def _read(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return ""
    except OSError:
        return None


def facts(pid: int, proc: Path = Path("/proc")) -> dict:
    base, own = proc / str(pid), proc / "self"
    found: dict = {"cgroup": _read(base / "cgroup") or "", "label": (_read(base / "attr/current") or "").strip("\0\n ")}
    info = _read(base / "root/.flatpak-info")
    found["flatpak_info"] = info
    try:
        root, host = (base / "root").stat(), (own / "root").stat()
        found["same_host"] = (root.st_dev, root.st_ino) == (host.st_dev, host.st_ino) and \
            os.readlink(base / "ns/mnt") == os.readlink(own / "ns/mnt")
    except OSError:
        found["same_host"] = False
    return found


def flatpak_app(info: str | None) -> str | None:
    """The app a .flatpak-info names; "" when there is none; None when unreadable."""
    if info is None:
        return None
    if info == "":
        return ""
    parser = configparser.ConfigParser(interpolation=None)
    try:
        parser.read_string(info)
    except configparser.Error:
        return None
    return parser.get("Application", "name", fallback="") or None


def classify(sender: str, pid: int, found: dict, authenticate) -> Caller:
    """The Caller for these process facts. ``authenticate(sender)`` is the
    installer's signed-deployment check; it is asked only for Filer."""
    app = flatpak_app(found.get("flatpak_info"))
    sandbox = (app != "" or not found.get("same_host")
               or any(marker in found.get("cgroup", "") for marker in SANDBOX_CGROUP_MARKERS)
               or any(marker in found.get("label", "") for marker in SANDBOX_LABEL_MARKERS))
    if not sandbox:
        return Caller(sender, pid, False, "", True)
    if app == FILER:
        try:
            verified = authenticate(sender) == FILER
        except Exception:  # noqa: BLE001 -- unsigned or altered: an ordinary sandbox
            verified = False
        return Caller(sender, pid, True, FILER, verified)
    return Caller(sender, pid, True, app or "", False)


def _pidfd_pid(fd: int) -> int:
    text = _read(Path(f"/proc/self/fdinfo/{fd}")) or ""
    for line in text.splitlines():
        if line.startswith("Pid:"):
            try:
                return int(line.split()[1])
            except (IndexError, ValueError):
                return 0
    return 0


def delivered_pidfd(values: dict, fds) -> int:
    """-1 when the bus offers no ProcessFD (the pid is then held by its start
    time); a ProcessFD named but not delivered is refused (PermissionError)."""
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
    text = _read(proc / str(pid) / "stat")
    try:
        return text.rsplit(")", 1)[1].split()[19] if text else None
    except IndexError:
        return None


def _authenticate(connection: Gio.DBusConnection, sender: str) -> str:
    from Suno_installer.app_data_broker import authenticate
    return authenticate(connection, sender)


def resolve(connection: Gio.DBusConnection, sender: str) -> Caller:
    """The Caller behind a D-Bus sender. Anything that can't be established
    is a sandbox that may not run files."""
    pidfd = -1
    try:
        result, fds = connection.call_with_unix_fd_list_sync(
            "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
            "GetConnectionCredentials", GLib.Variant("(s)", (sender,)),
            GLib.VariantType.new("(a{sv})"), Gio.DBusCallFlags.NONE, 5000, None, None)
        values = result.unpack()[0]
        pidfd = delivered_pidfd(values, fds)
        pid, uid = values.get("ProcessID"), values.get("UnixUserID")
        if not isinstance(pid, int) or pid <= 0 or uid != os.getuid():
            return Caller(sender, 0, True)
        # Held by its pidfd, or on a bus that offers none, its start time.
        start = process_start(pid) if pidfd < 0 else None
        if (_pidfd_pid(pidfd) != pid) if pidfd >= 0 else start is None:
            return Caller(sender, pid, True)
        caller = classify(sender, pid, facts(pid), lambda name: _authenticate(connection, name))
        if (_pidfd_pid(pidfd) != pid) if pidfd >= 0 else process_start(pid) != start:
            return Caller(sender, pid, True)
        return caller
    except (GLib.Error, PermissionError):
        return Caller(sender, 0, True)
    finally:
        if pidfd >= 0:
            os.close(pidfd)


def came_from_internet(path: str, downloads: str | None = None) -> bool:
    """A browser marks what it downloads (user.xdg.origin.url); the Downloads
    folder holds the rest."""
    try:
        if os.getxattr(path, "user.xdg.origin.url"):
            return True
    except OSError:
        pass
    downloads = downloads if downloads is not None else GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD)
    if downloads:
        try:
            return Path(path).resolve().is_relative_to(Path(downloads).resolve())
        except OSError:
            return False
    return False


def plain_path(path: str) -> bool:
    """No control character or DEL: nothing in a name can act as a key at the prompt."""
    return not any(ord(character) < 32 or ord(character) == 127 for character in path)


def typed_command(path: str, *, confirm: bool, bracketed: bool = True) -> bytes:
    """What is typed at the prompt for a program: its quoted path inside a
    bracketed paste, so the shell inserts it literally, then Return unless
    the person is to press it. Without ``bracketed`` (a shell that never
    showed its prompt) the quoted path is typed plain: no paste markers the
    terminal's line discipline would echo as text, and still no Return when
    the person is to press it."""
    if not plain_path(path):
        raise ValueError("a program name with control characters is not typed")
    quoted = shlex.quote(path)
    text = "\x1b[200~" + quoted + "\x1b[201~" if bracketed else quoted
    return (text + ("" if confirm else "\n")).encode()


class PromptGate:
    """Holds what is typed into a new session until its shell is reading.

    A shell reads its first line only after it has started and drawn its
    prompt; bytes fed earlier reach the terminal's line discipline, which
    echoes them (a bracketed paste as "^[[200~...^[[201~"). The gate opens
    once the shell has shown something (its prompt mark, ``prompt``, or any
    output, ``output``) and then stayed quiet for ``idle_ms``; ``deliver(True)``
    is then called once. If nothing settles within ``timeout_ms``,
    ``deliver(False)``: the caller types without bracketed-paste markers."""

    def __init__(self, deliver, *, idle_ms: int = 150, timeout_ms: int = 5000,
                 timeout_add=None, source_remove=None) -> None:
        self._deliver = deliver
        self._idle_ms = idle_ms
        self._add = timeout_add or GLib.timeout_add
        self._remove = source_remove or GLib.source_remove
        self._idle = 0
        self._done = False
        self._timeout = self._add(timeout_ms, self._expired)

    @property
    def done(self) -> bool:
        return self._done

    def output(self) -> None:
        """The shell wrote something: wait for it to stay quiet."""
        if self._done:
            return
        if self._idle:
            self._remove(self._idle)
        self._idle = self._add(self._idle_ms, self._settled)

    prompt = output

    def cancel(self) -> None:
        self._finish()

    def _finish(self) -> bool:
        if self._done:
            return False
        self._done = True
        for source in (self._idle, self._timeout):
            if source:
                self._remove(source)
        self._idle = self._timeout = 0
        return True

    def _settled(self) -> bool:
        self._idle = 0
        if self._finish():
            self._deliver(True)
        return False

    def _expired(self) -> bool:
        self._timeout = 0
        if self._finish():
            self._deliver(False)
        return False


def guarded_environment(environment: dict[str, str] | None = None) -> list[str]:
    """The environment for a session an app opened: the person's, plus GUARDED_GIT."""
    values = dict(os.environ if environment is None else environment)
    values.update(GUARDED_GIT)
    return [f"{key}={value}" for key, value in values.items()]


def printable(text: str) -> str:
    return "".join(character if character.isprintable() else "?" for character in text)


def opened_notice(opener: str, folder: str) -> bytes:
    """The one line a session an app opened starts with."""
    return f"\x1b[2mOpened by {printable(opener)} in {printable(folder)}\x1b[0m\r\n".encode()
