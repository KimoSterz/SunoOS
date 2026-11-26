"""Polkit-gated system-bus boundary for future system Mod deployments.

The service is packaged but remains closed unless a root-owned enable marker and
validated recovery-readiness record both exist. Luma does not ship either gate.
"""

from __future__ import annotations

import configparser
import json
import os
import re
import stat
from pathlib import Path

import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

from .errors import LumaModsError, TransactionError
from .system_backend import RpmOstreeBackend
from .system_catalog import SystemCatalogAdmission
from .system_coordinator import SystemTransactionCoordinator
from .system_host import SYSTEM_HOST_CONFIG
from .catalog_runtime import SYSTEM_CLIENT_CONFIG
from .system_state import SystemStateStore
from .system_gate import (
    POLKIT_CHECK_AUTHORIZATION_SIGNATURE,
    polkit_authorized,
    validate_recovery_record,
)

BUS_NAME = "org.projectluma.ModTransactions1"
OBJECT_PATH = "/org/projectluma/ModTransactions1"
INTERFACE = BUS_NAME
ENABLE_MARKER = Path("/etc/luma/mod-transactions-enabled")
RECOVERY_RECORD = Path("/var/lib/luma/mods/recovery-ready.json")
INTROSPECTION_PATH = Path("/usr/share/dbus-1/interfaces/org.projectluma.ModTransactions1.xml")
MODS_APP = "org.projectluma.Mods"
#: The host Mods gallery, run by a root-owned Python.
TRUSTED_SCRIPTS = frozenset({"/usr/bin/luma-mods"})
INTERPRETER = re.compile(r"/usr/bin/python3(?:\.[0-9]+)?")
PROC = Path("/proc")


def _root_owned(path) -> bool:
    try:
        info = os.lstat(path)
    except OSError:
        return False
    return stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022


def _pidfd_pid(fd: int) -> int:
    try:
        for line in Path(f"/proc/self/fdinfo/{fd}").read_text().splitlines():
            if line.startswith("Pid:"):
                return int(line.split()[1])
    except (OSError, ValueError, IndexError):
        pass
    return 0


def delivered_pidfd(values, fds) -> int:
    """-1 when the bus offers no ProcessFD (the pid is then held by its start
    time); a ProcessFD named but not delivered is refused."""
    if "ProcessFD" not in values:
        return -1
    index = values["ProcessFD"]
    try:
        if (isinstance(index, bool) or not isinstance(index, int) or fds is None
                or not 0 <= index < fds.get_length()):
            raise TransactionError("the bus named a process descriptor it did not deliver")
        descriptor = fds.get(index)
    except GLib.Error as error:
        raise TransactionError("the bus delivered an invalid process descriptor") from error
    if not isinstance(descriptor, int) or descriptor < 0:
        raise TransactionError("the bus delivered an invalid process descriptor")
    return descriptor


def process_start(pid: int, proc: Path = PROC) -> str | None:
    try:
        return (proc / str(pid) / "stat").read_text().rsplit(")", 1)[1].split()[19]
    except (OSError, IndexError):
        return None


def _same_host(pid: int, proc: Path) -> bool:
    # Compared with init, not this service: PrivateTmp and ProtectSystem give
    # the service a mount namespace of its own, which no caller shares.
    try:
        root, host = (proc / str(pid) / "root").stat(), (proc / "1/root").stat()
        return ((root.st_dev, root.st_ino) == (host.st_dev, host.st_ino)
                and os.readlink(proc / str(pid) / "ns/mnt") == os.readlink(proc / "1/ns/mnt"))
    except OSError:
        return False


_RESOLVE_NO_MAGICLINKS, _RESOLVE_NO_SYMLINKS, _RESOLVE_BENEATH = 0x02, 0x04, 0x08
_SYS_OPENAT2 = 437  # the same number on x86_64 and aarch64


def _openat2(directory: int, path: str, flags: int, resolve: int) -> int:
    import ctypes
    libc = ctypes.CDLL(None, use_errno=True)

    class OpenHow(ctypes.Structure):
        _fields_ = [("flags", ctypes.c_uint64), ("mode", ctypes.c_uint64), ("resolve", ctypes.c_uint64)]

    how = OpenHow(flags, 0, resolve)
    libc.syscall.restype = ctypes.c_long
    descriptor = libc.syscall(_SYS_OPENAT2, directory, path.encode(), ctypes.byref(how), ctypes.sizeof(how))
    if descriptor < 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error), path)
    return descriptor


def read_user_file(runtime: Path, uid: int, relative: str, limit: int = 65536) -> bytes:
    """A small regular file under the user's runtime folder, read by root
    without following anything the user made: the folder is opened and checked
    to be theirs, the file is resolved beneath it with no symlink, opened
    non-blocking (a FIFO can't hold the service) and must be a regular file
    the user owns."""
    folder = os.open(runtime / str(uid), os.O_PATH | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        status = os.fstat(folder)
        if not stat.S_ISDIR(status.st_mode) or status.st_uid != uid:
            raise TransactionError("the runtime folder is not the user's")
        descriptor = _openat2(folder, relative, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW | os.O_CLOEXEC,
                              _RESOLVE_BENEATH | _RESOLVE_NO_SYMLINKS | _RESOLVE_NO_MAGICLINKS)
    finally:
        os.close(folder)
    try:
        status = os.fstat(descriptor)
        if not stat.S_ISREG(status.st_mode) or status.st_uid != uid or status.st_size > limit:
            raise TransactionError("the Flatpak instance record is not the user's")
        return os.read(descriptor, limit + 1)
    finally:
        os.close(descriptor)


# The host's /run/user, through init's root: ProtectHome hides this service's own.
HOST_RUNTIME = Path("/proc/1/root/run/user")


def sandbox_child(info, text: str, proxy_pid: int, uid: int, *, runtime: Path = HOST_RUNTIME,
                  trusted_proxy=None, pipe=None) -> int:
    """The Mods sandbox behind Flatpak's D-Bus proxy, which is what the bus
    reports and which has no /app. As the installer's authenticate maps it,
    but from root: the instance's own runtime record (owned by the user,
    the same metadata) names the sandbox child; the proxy must be the
    maintained xdg-dbus-proxy and share the instance's lifecycle pipe with
    that child; the child carries the same .flatpak-info."""
    from luma_installer import app_data_broker as broker
    trusted_proxy = trusted_proxy or broker._trusted_dbus_proxy
    pipe = pipe or broker._proxy_instance_pipe
    instance = info.get("Instance", "instance-id", fallback="")
    if not instance.isdecimal():
        raise TransactionError("the caller is not a current Flatpak instance")
    record = f".flatpak/{instance}"
    if read_user_file(runtime, uid, f"{record}/info").decode("utf-8", "replace") != text:
        raise TransactionError("the Flatpak instance record differs from the caller's sandbox")
    child = json.loads(read_user_file(runtime, uid, f"{record}/bwrapinfo.json")).get("child-pid")
    if not isinstance(child, int) or child <= 0:
        raise TransactionError("the Flatpak instance has no sandbox process")
    trusted_proxy(proxy_pid)
    pipe(proxy_pid, child, uid)
    with open(f"/proc/{child}/root/.flatpak-info", encoding="utf-8") as stream:
        if stream.read(65537) != text:
            raise TransactionError("the sandbox process has different metadata")
    return child


def admit_process(pid: int, uid: int, *, proc: Path = PROC, deployment=None, trusted_proxy=None,
                  child_of=None) -> str:
    """Who the caller is, if it may use this service at all: the signed Mods
    app (its Flatpak deployment checked as the installer checks it), the host
    Mods gallery, or root. Anything else raises TransactionError, before
    polkit is asked anything. The host gallery is same-user trust: any program
    of that user can run /usr/bin/luma-mods; polkit still decides."""
    base = proc / str(pid)
    try:
        with (base / "root/.flatpak-info").open("r", encoding="utf-8") as stream:
            text = stream.read(65537)
    except FileNotFoundError:
        text = None
    except OSError as error:
        raise TransactionError("the caller's sandbox could not be read") from error
    if text is not None:
        info = configparser.ConfigParser(interpolation=None, strict=True)
        try:
            info.read_string(text)
        except configparser.Error as error:
            raise TransactionError("the caller's sandbox is malformed") from error
        if len(text) > 65536 or info.get("Application", "name", fallback="") != MODS_APP:
            raise TransactionError("only Mods can use system Mod transactions")
        try:
            if deployment is None:
                from luma_installer.app_data_broker import authenticate_deployment as deployment
            # The bus reports the proxy; the deployment is checked on the
            # sandbox's own process, whose /app is the signed deployment.
            child = (child_of or sandbox_child)(info, text, pid, uid, trusted_proxy=trusted_proxy)
            deployment(info, MODS_APP, child)
        except Exception as error:  # noqa: BLE001 -- unsigned, altered or unknown: refused
            raise TransactionError("Mods is not the signed installed application") from error
        return MODS_APP
    if not _same_host(pid, proc):
        raise TransactionError("the caller is in another filesystem")
    if uid == 0:
        return "root"
    try:
        executable = os.readlink(base / "exe")
        argv = (base / "cmdline").read_bytes().split(b"\0")
    except OSError as error:
        raise TransactionError("the caller could not be identified") from error
    script = argv[1].decode("utf-8", "replace") if len(argv) > 1 else ""
    if (INTERPRETER.fullmatch(executable) and _root_owned(executable)
            and script in TRUSTED_SCRIPTS and _root_owned(script)):
        return "luma-mods"
    raise TransactionError("only Mods can use system Mod transactions")


def _recovery_ready() -> bool:
    try:
        def read_protected(path, limit):
            descriptor = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
            try:
                info = os.fstat(descriptor)
                if (info.st_uid != 0 or info.st_mode & 0o022 or not stat.S_ISREG(info.st_mode)
                        or info.st_size > limit):
                    raise ValueError('Unsafe recovery readiness record.')
                payload = os.read(descriptor, limit + 1)
                if len(payload) > limit: raise ValueError('Oversized recovery readiness record.')
                return payload
            finally:
                os.close(descriptor)
        read_protected(ENABLE_MARKER, 4096)
        value = json.loads(read_protected(RECOVERY_RECORD, 65536).decode('utf-8'))
    except (OSError, ValueError, UnicodeDecodeError, RecursionError):
        return False
    return validate_recovery_record(value)


class Authority:
    def __init__(self, connection: Gio.DBusConnection) -> None:
        self._proxy = Gio.DBusProxy.new_sync(
            connection,
            Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES,
            None,
            "org.freedesktop.PolicyKit1",
            "/org/freedesktop/PolicyKit1/Authority",
            "org.freedesktop.PolicyKit1.Authority",
            None,
        )

    def check(self, sender: str, action: str, allow_interaction: bool) -> None:
        parameters = GLib.Variant(
            POLKIT_CHECK_AUTHORIZATION_SIGNATURE,
            (
                (
                    "system-bus-name",
                    {"name": GLib.Variant("s", sender)},
                ),
                action,
                {},
                1 if allow_interaction else 0,
                "",
            ),
        )
        result = self._proxy.call_sync(
            "CheckAuthorization",
            parameters,
            Gio.DBusCallFlags.NONE,
            120_000 if allow_interaction else 10_000,
            None,
        )
        authorized = polkit_authorized(result.unpack())
        if not authorized:
            raise TransactionError("system Mod action was not authorized")


class ModTransactionService:
    def __init__(self, connection: Gio.DBusConnection) -> None:
        self._connection = connection
        self._authority = Authority(connection)
        self._backend = RpmOstreeBackend()
        self._state = SystemStateStore()
        self._coordinator = SystemTransactionCoordinator(self._backend, self._state)
        self._admission = None
        if _recovery_ready():
            self._coordinator.recover_incomplete_staging()
        xml = INTROSPECTION_PATH.read_text(encoding="utf-8")
        self._node = Gio.DBusNodeInfo.new_for_xml(xml)
        self._registration = connection.register_object(
            OBJECT_PATH,
            self._node.interfaces[0],
            self._method_call,
            None,
            None,
        )

    def _admit(self, sender: str) -> str:
        result, fds = self._connection.call_with_unix_fd_list_sync(
            "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
            "GetConnectionCredentials", GLib.Variant("(s)", (sender,)),
            GLib.VariantType.new("(a{sv})"), Gio.DBusCallFlags.NONE, 5000, None, None)
        values = result.unpack()[0]
        pid, uid = values.get("ProcessID"), values.get("UnixUserID")
        pidfd = delivered_pidfd(values, fds)
        try:
            if not isinstance(pid, int) or pid <= 0 or not isinstance(uid, int):
                raise TransactionError("the caller has no process")
            # Held by its pidfd, or on a bus that offers none, its start time.
            start = process_start(pid) if pidfd < 0 else None
            if (_pidfd_pid(pidfd) != pid) if pidfd >= 0 else start is None:
                raise TransactionError("the caller has gone")
            who = admit_process(pid, uid)
            if (_pidfd_pid(pidfd) != pid) if pidfd >= 0 else process_start(pid) != start:
                raise TransactionError("the caller changed while it was checked")
            return who
        finally:
            if pidfd >= 0:
                os.close(pidfd)

    def _catalog_admission(self) -> SystemCatalogAdmission:
        if self._admission is None:
            self._admission = SystemCatalogAdmission.from_system(
                artifact_store=self._backend.artifact_store
            )
        return self._admission

    def _method_call(
        self,
        _connection,
        sender,
        _object_path,
        _interface_name,
        method_name,
        parameters,
        invocation,
    ) -> None:
        try:
            # Who first, then whether the service is open at all, and only then
            # polkit: a refused or closed request never raises an admin prompt.
            self._admit(sender)
            if method_name == "GetStatus":
                status = {
                    "schema": "org.luma.mod-transactions-status/v0.1",
                    "enabled": (
                        _recovery_ready()
                        and SYSTEM_CLIENT_CONFIG.is_file()
                        and SYSTEM_HOST_CONFIG.is_file()
                    ),
                    "backend": "rpm-ostree",
                    "catalog_configured": SYSTEM_CLIENT_CONFIG.is_file(),
                    "host_profile_configured": SYSTEM_HOST_CONFIG.is_file(),
                    "state": self._state.read(),
                }
                invocation.return_value(
                    GLib.Variant("(s)", (json.dumps(status, sort_keys=True),))
                )
                return
            if method_name == "StageCatalog":
                (
                    mod_id,
                    reviewed_snapshot_id,
                    reviewed_composition_sha256,
                    allow_interaction,
                ) = parameters.unpack()
                if not _recovery_ready():
                    raise TransactionError(
                        "system Mod deployment is closed until recovery readiness is proven"
                    )
                self._authority.check(
                    sender, "org.projectluma.mods.stage-system", allow_interaction
                )
                transaction = self._catalog_admission().prepare(
                    mod_id,
                    reviewed_snapshot_id=reviewed_snapshot_id,
                    reviewed_composition_sha256=reviewed_composition_sha256,
                    recovery_ready=True,
                )
                candidate = self._coordinator.stage(transaction.request)
                invocation.return_value(GLib.Variant("(s)", (candidate,)))
                return
            if method_name not in {"Activate", "Rollback"}:
                raise TransactionError(f"unknown system Mod method: {method_name}")
            candidate, allow_interaction = parameters.unpack()
            if not _recovery_ready():
                raise TransactionError("system Mod transactions are closed")
            if method_name == "Activate":
                self._authority.check(
                    sender, "org.projectluma.mods.activate-system", allow_interaction
                )
                self._coordinator.activate(candidate)
            elif method_name == "Rollback":
                self._authority.check(
                    sender, "org.projectluma.mods.rollback-system", allow_interaction
                )
                self._coordinator.rollback(candidate)
            else:
                raise TransactionError(f"unknown system Mod method: {method_name}")
            invocation.return_value(None)
        except (
            LumaModsError,
            OSError,
            json.JSONDecodeError,
            GLib.Error,
            TypeError,
            ValueError,
        ) as error:
            invocation.return_dbus_error(
                "org.projectluma.ModTransactions1.Error.Refused", str(error)
            )


def main() -> int:
    loop = GLib.MainLoop()
    holder = {}

    def acquired(connection, _name):
        holder["service"] = ModTransactionService(connection)

    owner = Gio.bus_own_name(
        Gio.BusType.SYSTEM,
        BUS_NAME,
        Gio.BusNameOwnerFlags.NONE,
        acquired,
        None,
        lambda _connection, _name: loop.quit(),
    )
    try:
        loop.run()
    finally:
        Gio.bus_unown_name(owner)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
