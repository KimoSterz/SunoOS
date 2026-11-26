# SPDX-License-Identifier: Apache-2.0
"""Who is calling Luma Connect Sync.

Identity is the caller's process as the bus broker and the kernel report it: the uid, the pidfd the broker took
when the caller connected, then the cgroup, security label, filesystem namespace and executable read from /proc.
Never a cgroup name pattern, an argument, or a bus name the caller asked for. The pidfd is checked before and after
the /proc reads, so a pid that exits and is reused mid-check is refused, not mistaken for the caller. Without a
pidfd (an old bus) the start time stands in, and the methods that hand out keys are refused outright.

What this keeps out: apps in a sandbox (Flatpak, Luma's app sandboxes, snaps), which reach the session bus through
a filtering proxy and are refused on every method. For the methods that hand out keys or take a recovery key it
also turns away other host programs that simply call in, such as a script in a terminal or over SSH.

What it cannot keep out: the person's own unsandboxed programs run as the same user. Besides reading the keystore
directly, one can send a call and then exec the Shell or Settings under the same pid (keeping the socket in a
child), so a pid-based check sees the trusted program. The bus names below make that harder: the Settings name is
held without replacement while Settings runs, and a second gnome-shell can't start. Only an OS-level identity (an
SELinux domain for the trusted programs, taken by the broker at connect time) or a token handed out by the Shell
closes it; that belongs to the shared luma-caller-identity library. This follows luma-shell-state's check until
that library replaces both.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

PROC = Path("/proc")
CALLERS_D = Path("/etc/luma/connect-sync/callers.d")
FIXTURE_ENV = "LUMA_CONNECT_SYNC_TRUSTED"

# Executable -> the well-known name the calling connection must also own ("" for none). Compared by inode with
# the root-owned file at that path, never by the text of /proc/PID/exe alone.
TRUSTED_EXECUTABLES: Mapping[str, str] = {
    "/usr/bin/gnome-shell": "org.gnome.Shell",
    "/usr/bin/phosh": "sm.puri.Phosh",
    "/usr/libexec/phosh": "sm.puri.Phosh",
    # Settings calls on the session bus singleton its GApplication owns org.gnome.Settings on.
    "/usr/bin/gnome-control-center": "org.gnome.Settings",
}
SANDBOX_CGROUP_MARKERS = ("/app-flatpak-", "/app-luma-", "/snap.")
SANDBOX_LABEL_MARKERS = ("luma_application.process", ":container_t:")


def pidfd_pid(fd: int) -> int:
    """The process a pidfd refers to; 0 once it has exited."""
    try:
        for line in Path(f"/proc/self/fdinfo/{fd}").read_text().splitlines():
            if line.startswith("Pid:"):
                return max(int(line.split()[1]), 0)
    except (OSError, ValueError, IndexError):
        pass
    return 0


def start_time(pid: int, proc: Path = PROC) -> int:
    """The process start time in clock ticks, or -1."""
    try:
        return int((proc / str(pid) / "stat").read_text().rsplit(")", 1)[1].split()[19])
    except (OSError, ValueError, IndexError):
        return -1


def _read_text(path: Path) -> str | None:
    """The file's text; "" if absent; None if the kernel will not show it."""
    try:
        return path.read_bytes().decode("utf-8", "replace")
    except PermissionError:
        return None
    except OSError:
        return ""


def facts(pid: int, proc: Path = PROC) -> dict[str, Any]:
    """What the kernel says about a caller. None marks what it would not show (a non-dumpable process)."""
    base, own = proc / str(pid), proc / "self"
    found: dict[str, Any] = {"cgroup": _read_text(base / "cgroup") or ""}
    found["label"] = (_read_text(base / "attr/current") or "").strip("\0\n ")
    try:
        (base / "root/.flatpak-info").open("rb").close()
        found["flatpak"] = True
    except FileNotFoundError:
        found["flatpak"] = False
    except OSError:
        found["flatpak"] = None
    try:
        root, host = (base / "root").stat(), (own / "root").stat()
        found["same_root"] = (root.st_dev, root.st_ino) == (host.st_dev, host.st_ino)
    except OSError:
        found["same_root"] = None
    try:
        found["same_mnt"] = os.readlink(base / "ns/mnt") == os.readlink(own / "ns/mnt")
    except OSError:
        found["same_mnt"] = None
    try:
        found["exe"] = os.readlink(base / "exe")
        info = os.stat(base / "exe")          # the running file itself, even once replaced on disk
        found["exe_stat"] = (info.st_dev, info.st_ino, info.st_uid, info.st_mode, info.st_nlink)
    except OSError:
        found["exe"] = found["exe_stat"] = None
    return found


def _hidden(found: Mapping[str, Any]) -> bool:
    return None in (found.get("flatpak"), found.get("same_root"), found.get("same_mnt"), found.get("exe"))


def sandbox_reason(found: Mapping[str, Any]) -> str:
    """Why the caller is (or must be taken for) an app in a sandbox, or ""."""
    cgroup = found.get("cgroup") or ""
    if any(marker in cgroup for marker in SANDBOX_CGROUP_MARKERS):
        return "application scope"
    if any(marker in (found.get("label") or "") for marker in SANDBOX_LABEL_MARKERS):
        return "application domain"
    if found.get("flatpak"):
        return "flatpak"
    if found.get("same_root") is False or found.get("same_mnt") is False:
        return "another filesystem namespace"
    # A process can hide itself (prctl non-dumpable). No unit name excuses that: any program can run in a login
    # session scope or a unit named like the Shell's, and gnome-shell is dumpable (no file capabilities).
    if _hidden(found):
        return "unreadable process"
    return ""


def same_program(found: Mapping[str, Any], path: str, *, root_uid: int = 0) -> bool:
    """The caller runs the root-owned, not group- or world-writable file at ``path``: the same inode, or the file
    that was at ``path`` until an update replaced it while it ran."""
    running = found.get("exe_stat")
    if not running:
        return False
    dev, ino, uid, mode, links = running
    if uid != root_uid or mode & 0o022:
        return False
    try:
        info = os.stat(path)
    except OSError:
        info = None
    if info is not None and (info.st_dev, info.st_ino) == (dev, ino):
        return info.st_uid == root_uid and not info.st_mode & 0o022
    return links == 0 and found.get("exe") == f"{path} (deleted)"


def required_name(found: Mapping[str, Any], *, trusted: Mapping[str, str] = TRUSTED_EXECUTABLES,
                  extra: Iterable[str] = (), root_uid: int = 0) -> str | None:
    """The bus name the caller must own to use the methods that hand out keys ("" for none), or None when it may not."""
    if sandbox_reason(found):
        return None
    for path, name in trusted.items():
        if same_program(found, path, root_uid=root_uid):
            return name
    for path in extra:
        if path.startswith("/") and same_program(found, path, root_uid=root_uid):
            return ""
    return None


def _own_source_tree(service_file: str | Path) -> bool:
    """The module runs from a checkout the person owns, not from an installed (root-owned) copy."""
    try:
        file = Path(service_file).resolve()
        if file.is_relative_to("/usr") or os.getuid() == 0:
            return False
        return all(os.stat(path).st_uid == os.getuid() for path in (file, file.parent))
    except OSError:
        return False


def extra_callers(callers_d: Path = CALLERS_D, *, service_file: str | Path = __file__,
                  environment: Mapping[str, str] = os.environ, root_uid: int = 0) -> tuple[str, ...]:
    """More programs allowed to use the methods that hand out keys, for test machines.

    From root-owned files in /etc/luma/connect-sync/callers.d (one absolute path per line; only root can add one,
    and the program must itself be root-owned), and, only for a service run from the person's own source tree, from
    LUMA_CONNECT_SYNC_TRUSTED. An installed copy (root-owned, wherever it lives: /usr, /usr/local on /var/usrlocal)
    never reads the variable. Nothing ships in callers.d."""
    paths: list[str] = []
    if _own_source_tree(service_file):
        paths += [path for path in environment.get(FIXTURE_ENV, "").split(":") if path.startswith("/")]
    try:
        folder = os.stat(callers_d)
        files = sorted(callers_d.glob("*.conf")) if folder.st_uid == root_uid and not folder.st_mode & 0o022 else []
    except OSError:
        files = []
    for file in files:
        try:
            info = os.lstat(file)
            if info.st_uid != root_uid or info.st_mode & 0o022 or not os.path.isfile(file) or os.path.islink(file):
                continue
            text = file.read_text()
        except OSError:
            continue
        paths += [line.strip() for line in text.splitlines() if line.strip().startswith("/")]
    return tuple(dict.fromkeys(paths))


Credentials = tuple[int, int, int, str]      # uid, pid, pidfd or -1, security label


def refusal(credentials: Callable[[], Credentials], *, trusted_only: bool, name_owner: Callable[[str], str],
            sender: str, extra: Iterable[str] = (), trusted: Mapping[str, str] = TRUSTED_EXECUTABLES, proc: Path = PROC, uid: int | None = None,
            root_uid: int = 0, read_pidfd: Callable[[int], int] = pidfd_pid) -> tuple[str, str, int]:
    """("", "", pid) when the caller may go ahead, else (kind, why, pid) with kind "sandbox" or "not_trusted".

    ``credentials`` asks the broker (GetConnectionCredentials); the pidfd it returns is closed here."""
    kind, why, pid, pidfd = "", "", 0, -1
    try:
        own_uid, pid, pidfd, label = credentials()
        if own_uid != (os.getuid() if uid is None else uid) or pid <= 0:
            return "sandbox", "another user or no process", pid
        if pidfd >= 0:
            alive = lambda: read_pidfd(pidfd) == pid                  # noqa: E731
        elif trusted_only:
            return "not_trusted", "the bus gave no pidfd", pid
        else:
            started = start_time(pid, proc)
            alive = lambda: started > 0 and start_time(pid, proc) == started       # noqa: E731
        if not alive():
            return "sandbox", "process gone", pid
        found = facts(pid, proc)
        if label:
            found["label"] = label        # the label the broker took when the caller connected
        sandboxed = sandbox_reason(found)
        name = required_name(found, trusted=trusted, extra=extra, root_uid=root_uid) if trusted_only and not sandboxed else ""
        # Everything above was read from /proc/PID: it describes the caller only if the caller still holds that pid.
        if not alive():
            kind, why = "sandbox", "process gone"
        elif sandboxed:
            kind, why = "sandbox", sandboxed
        elif name is None:
            kind, why = "not_trusted", "not the Shell or Settings"
        elif name and name_owner(name) != sender:
            kind, why = "not_trusted", f"does not own {name}"
        return kind, why, pid
    except Exception as error:  # noqa: BLE001 - no credentials, no answer: refuse
        return "sandbox", f"no credentials: {error}", pid
    finally:
        if pidfd >= 0:
            os.close(pidfd)


def broker_credentials(connection, sender: str) -> Credentials:
    """(uid, pid, pidfd or -1, security label) as the bus broker reports the connection."""
    from gi.repository import Gio, GLib
    result, fds = connection.call_with_unix_fd_list_sync(
        "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetConnectionCredentials",
        GLib.Variant("(s)", (sender,)), GLib.VariantType("(a{sv})"), Gio.DBusCallFlags.NONE, 5000, None, None)
    values = result.unpack()[0]
    pidfd, index = -1, values.get("ProcessFD")
    if isinstance(index, int) and fds is not None and 0 <= index < fds.get_length():
        pidfd = fds.get(index)
    owner, pid = values.get("UnixUserID"), values.get("ProcessID")
    label = bytes(values.get("LinuxSecurityLabel") or b"").rstrip(b"\0").decode("utf-8", "replace")
    return (owner if isinstance(owner, int) else -1), (pid if isinstance(pid, int) else 0), pidfd, label


def name_owner(connection, name: str) -> str:
    from gi.repository import Gio, GLib
    try:
        return connection.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetNameOwner",
                                    GLib.Variant("(s)", (name,)), GLib.VariantType("(s)"), Gio.DBusCallFlags.NONE, 1000, None).unpack()[0]
    except GLib.Error:
        return ""
