# SPDX-License-Identifier: Apache-2.0
"""org.projectluma.impl.portal.Sync on the session bus (ADR-057 §3.1, §3.2).

Only the portal frontend may call it: the current owner of
org.freedesktop.portal.Desktop, running in xdg-desktop-portal.service. An
app that reaches the session bus directly can't call it with an identity of
its choosing. The frontend passes the caller (app ID, kind, pidfd, its bus
name); the service checks the pidfd itself (identity.resolve_caller).

Each app (app ID, installation, commit) gets its own small worker pool, at
most 4 calls in flight, 600 a minute, and every call has a deadline, so a
slow or stuck call only ties up that app. Signals go to the frontend naming
the app connection they are for, and only for zones that connection
subscribed to.
"""
from __future__ import annotations

import logging
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import gi
gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

from . import directory as dirmod  # noqa: E402
from . import identity  # noqa: E402
from .limits import CALL_DEADLINE, COPY_DEADLINE, IN_FLIGHT, ApiError, check_label  # noqa: E402

log = logging.getLogger("luma-connect-sync")
OBJECT_PATH = "/org/projectluma/ConnectSync1/Apps"
INTERFACE = "org.projectluma.impl.portal.Sync"
ERROR = "org.projectluma.portal.Sync.Error"
PORTAL_NAME = "org.freedesktop.portal.Desktop"
PORTAL_UNIT = "xdg-desktop-portal.service"
PROC = Path("/proc")


def introspection() -> str:
    for path in (Path("/usr/share/dbus-1/interfaces/org.projectluma.impl.portal.Sync.xml"),
                 Path(__file__).resolve().parent.parent.parent / "data" / "org.projectluma.impl.portal.Sync.xml"):
        if path.is_file():
            return path.read_text()
    raise FileNotFoundError("org.projectluma.impl.portal.Sync.xml")


def unit_of(pid: int, proc: Path = PROC) -> str:
    try:
        line = (proc / str(pid) / "cgroup").read_text().strip().splitlines()[-1]
    except (OSError, IndexError):
        return ""
    return line.split("::", 1)[-1].rstrip("/").rsplit("/", 1)[-1]


def pidfd_unit(pidfd: int, proc: Path = PROC) -> str:
    """The unit of the process a pidfd names: alive, with the same pid, before and after its cgroup is read."""
    pid = identity.pid_of(pidfd)
    if not pid or not identity.alive(pidfd):
        return ""
    unit = unit_of(pid, proc)
    if not identity.alive(pidfd) or identity.pid_of(pidfd) != pid:
        return ""
    return unit


# ---------------------------------------------------------------- marshalling

def v_device(device: dict | None) -> GLib.Variant:
    device = device or {}
    return GLib.Variant("a{sv}", {"handle": GLib.Variant("s", device.get("handle", "")), "name": GLib.Variant("s", device.get("name", "")),
                                  "class": GLib.Variant("s", device.get("class", "")), "mine": GLib.Variant("b", bool(device.get("mine")))})


def v_record(record: dict) -> dict:
    out = {"name": GLib.Variant("s", record["name"]), "version": GLib.Variant("s", record.get("version", "")),
           "value": GLib.Variant("ay", bytes(record.get("value", b""))), "time_ms": GLib.Variant("x", int(record.get("time_ms", 0))),
           "flags": GLib.Variant("u", int(record.get("flags", 0))),
           "assets": GLib.Variant("aa{sv}", [{"name": GLib.Variant("s", a["name"]), "size": GLib.Variant("t", int(a["size"])),
                                              "flags": GLib.Variant("u", int(a["flags"]))} for a in record.get("assets", [])]),
           "siblings": GLib.Variant("aa{sv}", [v_record(s) for s in record.get("siblings", [])])}
    if record.get("writer"):
        out["writer"] = v_device(record["writer"])
    if record.get("resolved_by"):
        out["resolved_by"] = v_device(record["resolved_by"])
    return out


def v_result(result: dict) -> dict:
    return {"name": GLib.Variant("s", result["name"]), "outcome": GLib.Variant("s", result["outcome"].replace("_", "-")),
            "record": GLib.Variant("a{sv}", v_record(result["record"]))}


def v_lease(lease: dict) -> dict:
    out = {"record": GLib.Variant("s", lease["record"]), "until_ms": GLib.Variant("x", int(lease["until_ms"])),
           "mine": GLib.Variant("b", bool(lease["mine"])), "active": GLib.Variant("b", bool(lease["active"]))}
    if lease.get("holder"):
        out["holder"] = v_device(lease["holder"])
    return out


def v_plain(value) -> GLib.Variant:
    if isinstance(value, bool):
        return GLib.Variant("b", value)
    if isinstance(value, int):
        return GLib.Variant("x", value)
    if isinstance(value, str):
        return GLib.Variant("s", value)
    if isinstance(value, list):
        return GLib.Variant("as", [str(v) for v in value])
    if isinstance(value, dict):
        if value and all(isinstance(v, dict) for v in value.values()) and "handle" in next(iter(value.values()), {}):
            pass
        if set(value) >= {"handle", "name", "class"}:
            return v_device(value)
        return GLib.Variant("a{sv}", {k: v_plain(v) for k, v in value.items()})
    return GLib.Variant("s", str(value))


def v_status(status: dict) -> dict:
    return {k: v_plain(v) for k, v in status.items()}


class AppsPortal:
    """The implementation object. ``api_provider()`` gives the current AppsApi (it changes when the person signs in)."""

    def __init__(self, api_provider, wake=None, proc: Path = PROC, trust_any_portal: bool = False, roots=None) -> None:
        self.api_provider = api_provider
        self.roots = roots                            # tests only: Flatpak installations to accept
        self.wake = wake or (lambda: None)
        self.proc = proc
        self.trust_any_portal = trust_any_portal      # tests only: a session bus without a real portal service
        self.connection: Gio.DBusConnection | None = None
        self.lock = threading.Lock()
        self.pools: dict[tuple, ThreadPoolExecutor] = {}
        self.subs: dict[str, dict] = {}               # app connection -> {"key", "caller", "zones"}
        self.portal_owner = ""
        self.verified_portal = ""

    # ------------------------------------------------------------ registration
    def register(self, connection: Gio.DBusConnection) -> None:
        self.connection = connection
        self.main_context = GLib.MainContext.ref_thread_default()
        node = Gio.DBusNodeInfo.new_for_xml(introspection())
        connection.register_object(OBJECT_PATH, node.interfaces[0], self._call, None, None)
        connection.signal_subscribe("org.freedesktop.DBus", "org.freedesktop.DBus", "NameOwnerChanged", "/org/freedesktop/DBus",
                                    None, Gio.DBusSignalFlags.NONE, self._name_owner_changed)
        GLib.timeout_add_seconds(60, self._reclaim_copies)

    def _reclaim_copies(self) -> bool:
        """Once a minute: free the asset copies apps have let go of (review N9)."""
        api = self.api_provider()
        if api is not None and api.copies.tracked():
            threading.Thread(target=api.copies.reclaim, name="luma-sync-copies", daemon=True).start()
        return True

    def _name_owner_changed(self, _conn, _sender, _path, _iface, _signal, params) -> None:
        name, _old, new = params.unpack()
        if name == PORTAL_NAME:
            self.portal_owner = new
            self.verified_portal = ""
        elif name.startswith(":") and not new:
            with self.lock:
                self.subs.pop(name, None)

    def _current_portal(self) -> str:
        try:
            return self.connection.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetNameOwner",
                                             GLib.Variant("(s)", (PORTAL_NAME,)), GLib.VariantType("(s)"), Gio.DBusCallFlags.NONE,
                                             2000, None).unpack()[0]
        except GLib.Error:
            return ""

    def peer_unit(self, sender: str) -> str:
        """The systemd unit a bus peer runs in, read through its pidfd (GetConnectionCredentials' ProcessFD) and checked
        to be the same live process before and after the read, so a recycled PID can't pass (review follow-up)."""
        try:
            result, fds = self.connection.call_with_unix_fd_list_sync(
                "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetConnectionCredentials",
                GLib.Variant("(s)", (sender,)), GLib.VariantType("(a{sv})"), Gio.DBusCallFlags.NONE, 2000, None, None)
        except GLib.Error:
            return ""
        credentials = result.unpack()[0]
        if "ProcessFD" not in credentials or fds is None:
            log.error("The bus gives no ProcessFD for %s; the caller can't be checked safely", sender)
            return ""
        try:
            pidfd = fds.get(credentials["ProcessFD"])
        except GLib.Error:
            return ""
        try:
            return pidfd_unit(pidfd, self.proc)
        finally:
            os.close(pidfd)

    def portal_peer(self, sender: str) -> bool:
        """The sender is org.freedesktop.portal.Desktop's owner and runs in xdg-desktop-portal.service.

        Checked once per portal connection and remembered until the name changes hands, so a call costs no bus
        round trips on the main loop (review M7).
        """
        if sender and sender == self.verified_portal:
            return True
        if self._current_portal() != sender:
            return False
        if not self.trust_any_portal and self.peer_unit(sender) != PORTAL_UNIT:
            return False
        self.verified_portal = sender
        return True

    # ------------------------------------------------------------ calls
    def _call(self, connection, sender, path, interface, method, parameters, invocation) -> None:
        try:
            self._dispatch_call(sender, method, parameters, invocation)
        except Exception:  # noqa: BLE001 - every call gets an answer, whatever went wrong before its worker started
            log.exception("%s failed before it ran", method)
            invocation.return_dbus_error(f"{ERROR}.Failed", "The call couldn't be handled.")

    def _dispatch_call(self, sender, method, parameters, invocation) -> None:
        if not self.portal_peer(sender):
            invocation.return_dbus_error(f"{ERROR}.Refused", "Only the Sync portal may call this.")
            return
        fds = invocation.get_message().get_unix_fd_list()
        args = list(parameters.unpack())
        caller_info = args.pop(0)
        try:
            pidfd = fds.get(caller_info["pidfd"]) if fds is not None and "pidfd" in caller_info else -1
        except (GLib.Error, KeyError, TypeError):
            pidfd = -1
        extra_fd = -1
        if method == "PutAsset":
            try:
                extra_fd = fds.get(int(args[3])) if fds is not None else -1     # (zone, record, name, fd, base, options)
            except (GLib.Error, TypeError, ValueError, IndexError):
                extra_fd = -1
        try:
            caller = identity.resolve_caller(str(caller_info.get("app_id", "")), str(caller_info.get("kind", "")), pidfd,
                                             str(caller_info.get("sender", "")), proc=self.proc, roots=self.roots)
        except ApiError as error:
            if extra_fd >= 0:
                os.close(extra_fd)
            invocation.return_dbus_error(f"{ERROR}.{ApiError.KINDS[error.kind]}", str(error))
            return
        finally:
            # The pidfd is needed only for the check above; each descriptor is closed exactly once.
            if pidfd >= 0:
                os.close(pidfd)
        pool_key = (caller.app, str(caller.installation), caller.commit)
        with self.lock:
            pool = self.pools.get(pool_key)
            if pool is None:
                if len(self.pools) > 64:
                    for old in list(self.pools.values())[:16]:
                        old.shutdown(wait=False)
                    self.pools = dict(list(self.pools.items())[16:])
                pool = self.pools[pool_key] = ThreadPoolExecutor(max_workers=IN_FLIGHT, thread_name_prefix="app")
        answered = threading.Lock()
        done = [False]

        def reply(fn, *a) -> bool:
            # GDBus invocations may be answered from any thread; exactly one answer goes out.
            with answered:
                if done[0]:
                    return False
                done[0] = True
            fn(*a)
            return False

        def timeout() -> bool:
            reply(invocation.return_dbus_error, f"{ERROR}.TimedOut", "The call ran past its deadline.")
            return False

        api_now = self.api_provider()
        gate_key = "\n".join(map(str, pool_key))
        if api_now is not None:
            try:
                api_now.gate.enter(gate_key)       # before any work on the call, identity included (review M7)
            except ApiError as error:
                if extra_fd >= 0:
                    os.close(extra_fd)
                invocation.return_dbus_error(f"{ERROR}.RateLimited", f"{error.limit}: {error}")
                return
        deadline = COPY_DEADLINE + CALL_DEADLINE if method == "PutAsset" else CALL_DEADLINE
        source = GLib.timeout_source_new(int(deadline * 1000))
        source.set_callback(lambda *_: timeout())
        source.attach(self.main_context)

        def run() -> None:
            api = self.api_provider()
            ctx = None
            try:
                if api is None:
                    raise ApiError("failed", "Sync for apps isn't ready on this device.")
                ctx = api.context(caller)
                variant, out_fds = self._dispatch(api, ctx, method, args, extra_fd, sender)
                if ctx.store is not None:
                    api.metrics.call(ctx.owner, ctx.app, method)
                self._flush(api)
                if out_fds:
                    fd_list = Gio.UnixFDList.new()
                    for fd in out_fds:
                        fd_list.append(fd)
                        os.close(fd)
                    reply(invocation.return_value_with_unix_fd_list, variant, fd_list)
                else:
                    reply(invocation.return_value, variant)
            except ApiError as error:
                if api is not None and ctx is not None and ctx.store is not None:
                    api.metrics.error(ctx.owner, ctx.app, error.kind)
                    if error.limit:
                        api.metrics.refusal(ctx.owner, ctx.app, error.limit)
                message = f"{error.limit}: {error}" if error.limit else str(error)
                reply(invocation.return_dbus_error, f"{ERROR}.{ApiError.KINDS[error.kind]}", message)
            except Exception as error:  # noqa: BLE001
                log.exception("%s failed", method)
                if api is not None and ctx is not None and ctx.store is not None:
                    api.metrics.error(ctx.owner, ctx.app, "failed")
                reply(invocation.return_dbus_error, f"{ERROR}.Failed", type(error).__name__)
            finally:
                if extra_fd >= 0:
                    try:
                        os.close(extra_fd)
                    except OSError:
                        pass
                if api_now is not None:
                    api_now.gate.leave(gate_key)
        try:
            pool.submit(run)
        except RuntimeError:
            if api_now is not None:
                api_now.gate.leave(gate_key)
            reply(invocation.return_dbus_error, f"{ERROR}.Failed", "The service is stopping.")

    def _dispatch(self, api, ctx, method: str, args: list, fd: int, portal_sender: str) -> tuple[GLib.Variant | None, list[int]]:
        if method == "GetStatus":
            return GLib.Variant("(a{sv})", (v_status(api.get_status(ctx)),)), []
        if ctx.store is None:
            raise ApiError("refused", "This app's publisher can't be verified, so Sync keeps nothing for it.")
        if method == "Subscribe":
            zones = [str(z) for z in args[0]][:64]
            limit = api._limits(ctx)["zones"]
            for label in zones:
                api.zone_status(ctx, check_label(label))      # a bad label is refused before it is remembered
                # Only labels Luma approved, and only within the zone limit, become zones here (review L1).
                approved = ctx.entry is not None and label in ctx.entry["labels"]
                if approved and ctx.store.zone(label, create=False) is None and len(ctx.store.labels()) < limit:
                    ctx.store.zone(label, epoch=dirmod.Directory.epoch(api.directory.get(ctx.owner, ctx.app), label))
            with self.lock:
                entry = self.subs.setdefault(ctx.caller.sender, {"key": ctx.store.key, "caller": ctx.caller, "zones": set()})
                entry["zones"] |= set(zones)
            self.wake()
            return None, []
        if method == "Save":
            zone, records, options = args
            records = [[name, bytes(value), base] for name, value, base in records]
            return GLib.Variant("(aa{sv})", ([v_result(r) for r in api.save(ctx, zone, records, dict(options))],)), []
        if method == "Delete":
            zone, items, _options = args
            return GLib.Variant("(aa{sv})", ([v_result(r) for r in api.delete(ctx, zone, [list(i) for i in items])],)), []
        if method == "FetchChanges":
            zone, token, options = args
            out = api.fetch_changes(ctx, zone, token, int(dict(options).get("limit", 200)))
            return GLib.Variant("(aa{sv}sb)", ([v_record(r) for r in out["records"]], out["token"], out["more"])), []
        if method == "Get":
            zone, name = args
            record = api.get(ctx, zone, name)
            return GLib.Variant("(ba{sv})", (record is not None, v_record(record) if record else {})), []
        if method == "List":
            zone, after, limit = args
            out = api.list(ctx, zone, after, int(limit))
            return GLib.Variant("(aa{sv}s)", ([v_record(r) for r in out["records"]], out["next"])), []
        if method == "PutAsset":
            zone, record, name, _fd_index, base, options = args
            return GLib.Variant("(a{sv})", (v_result(api.put_asset(ctx, zone, record, name, fd, base, dict(options))),)), []
        if method == "RemoveAsset":
            zone, record, name, base = args
            return GLib.Variant("(a{sv})", (v_result(api.remove_asset(ctx, zone, record, name, base)),)), []
        if method == "OpenAsset":
            zone, record, name, version = args
            state, info, out_fd = api.open_asset(ctx, zone, record, name, version)
            payload = {k: v_plain(v) for k, v in info.items()}
            if out_fd is not None:
                payload["fd"] = GLib.Variant("h", 0)
                return GLib.Variant("(sa{sv})", (state, payload)), [out_fd]
            return GLib.Variant("(sa{sv})", (state, payload)), []
        if method in ("RequestAsset", "PinAsset", "EvictAsset"):
            zone, record, name = args[:3]
            fn = {"RequestAsset": lambda: api.request_asset(ctx, zone, record, name),
                  "PinAsset": lambda: api.pin_asset(ctx, zone, record, name, bool(args[3])),
                  "EvictAsset": lambda: api.evict_asset(ctx, zone, record, name)}[method]
            state, info = fn()
            return GLib.Variant("(sa{sv})", (state, {k: v_plain(v) for k, v in info.items()})), []
        if method == "Lease":
            zone, record, seconds, take_over = args
            return GLib.Variant("(a{sv})", (v_lease(api.lease(ctx, zone, record, int(seconds), bool(take_over))),)), []
        if method == "Release":
            zone, record = args
            return GLib.Variant("(a{sv})", (v_lease(api.release(ctx, zone, record)),)), []
        if method == "GetLease":
            zone, record = args
            return GLib.Variant("(a{sv})", (v_lease(api.get_lease(ctx, zone, record)),)), []
        if method == "ResolveSiblings":
            zone, record, keep = args
            return GLib.Variant("(a{sv})", (v_result(api.resolve_siblings(ctx, zone, record, keep)),)), []
        if method == "DeleteZone":
            api.delete_zone(ctx, args[0])
            return None, []
        raise ApiError("not_supported", method)

    # ------------------------------------------------------------ signals
    def _flush(self, api) -> None:
        if api is None or self.connection is None:
            return
        with api.lock:
            events, api.events = api.events, []
        if not events:
            return
        portal = self._current_portal()
        if not portal:
            return
        with self.lock:
            subs = dict(self.subs)
        for key, signal, zone, details in events:
            for destination, sub in subs.items():
                if sub["key"] != key:
                    continue
                if signal == "StatusChanged":
                    try:
                        status = api.get_status(api.context(sub["caller"]))
                    except ApiError:
                        continue
                    args = GLib.Variant("(sa{sv})", (destination, v_status(status)))
                elif zone not in sub["zones"]:
                    continue
                elif signal == "Changed":
                    args = GLib.Variant("(ssa{sv})", (destination, zone, {k: v_plain(v) for k, v in details.items()}))
                else:
                    progress = {k: v_plain(v) for k, v in details.items() if k not in ("record", "name")}
                    args = GLib.Variant("(ssssa{sv})", (destination, zone, details.get("record", ""), details.get("name", ""), progress))
                try:
                    self.connection.emit_signal(portal, OBJECT_PATH, INTERFACE, signal, args)
                except GLib.Error:
                    pass

    def flush(self) -> None:
        """Called after each sync cycle: send what the cycle found to subscribed apps."""
        GLib.idle_add(lambda: self._flush(self.api_provider()) and False)
