# SPDX-License-Identifier: Apache-2.0
"""Suno-connect-syncd: the user service and org.projectSuno.ConnectSync1.

The interface is what Settings, the shell's approval card and status
island, Valet and the launcher read (data/org.projectSuno.ConnectSync1.xml).
Structured answers are JSON strings. The recovery key leaves the service
only in the reply to BeginSetup and, after a polkit check, RevealRecoveryKey;
it is never a property, a signal or a log line.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import gi
gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

from . import appdata, callers, crypto, handoff  # noqa: E402
from .account import SyncStateError  # noqa: E402
from .hub import HubError, Offline  # noqa: E402
from .quiet import Watcher  # noqa: E402
from .sync import Sync, make_apps  # noqa: E402
from .apps_api.dbus import AppsPortal  # noqa: E402

BUS_NAME = "org.projectSuno.ConnectSync1"
OBJECT_PATH = "/org/projectSuno/ConnectSync1"
INTERFACE = "org.projectSuno.ConnectSync1"
ERROR = "org.projectSuno.ConnectSync1.Error"
REVEAL_ACTION = "org.projectSuno.connect-sync.reveal-recovery-key"
MANAGE_ACTION = "org.projectSuno.connect-sync.manage"      # approve a device, remove one, delete synced data, turn Sync off
IDLE_WAIT = 240           # long-poll: about 15 requests an hour while nothing happens
log = logging.getLogger("Suno-connect-sync")


# Methods that hand out keys or take a recovery key answer only the Shell and Settings, by verified process (review M4;
# callers.py). The Suno-sync command works in-process and never asks the service.
TRUSTED_ONLY = {"ReplaceRecoveryKey", "ProbeAccount", "ConfirmJoin", "AcknowledgeRecoveryKey", "UseVersion", "ApproveJoin", "RemoveDevice", "JoinWithRecoveryKey", "RevealRecoveryKey", "BeginSetup", "FinishSetup", "ListJoinRequests", "GetJoin", "RequestJoin",
                "DeleteAllSyncedData", "GetContinueOffer", "TakeContinue", "DeclineContinue", "PublishContinue", "ClearContinue"}


def introspection() -> str:
    for path in (Path("/usr/share/dbus-1/interfaces/org.projectSuno.ConnectSync1.xml"),
                 Path(__file__).resolve().parent.parent / "data" / "org.projectSuno.ConnectSync1.xml"):
        if path.is_file():
            return path.read_text()
    raise FileNotFoundError("org.projectSuno.ConnectSync1.xml")


class Service:
    def __init__(self, sync: Sync | None = None) -> None:
        self.apps = (sync.apps_api, sync.apps_cycle) if sync is not None else make_apps()
        try:
            self.sync = sync or Sync(apps=self.apps)
        except SyncStateError as error:
            if error.code != "signed_out":
                raise
            self.sync = None            # not signed in: the apps API still answers (no-account), Sync waits for a sign-in
        self.portal = AppsPortal(lambda: self.apps[0], wake=lambda: self.wake.set())
        if self.apps[0] is not None:
            self.apps[0].wake = lambda: self.wake.set()
            self.apps[0].offer = self._offer
        self.loop = GLib.MainLoop()
        self.wake = threading.Event()
        self.stop = threading.Event()
        self.pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="dbus")
        self.connection: Gio.DBusConnection | None = None
        self.setup = None
        self.seq = 0
        self.closed_at: dict[str, float] = {}
        self.watcher = Watcher(on_closed=self._closed, on_installed=self.wake.set)
        if self.sync is not None:
            self.sync.watcher = self.watcher
        self.offers: dict[int, str] = {}
        self.extra_callers = callers.extra_callers()
        self.refusals_logged: set[tuple[str, str]] = set()
        # Continue: the session goes out as it changes and before sleep (handoff.py).
        self.handoff = handoff.Handoff()
        if self.sync is not None:
            self.sync.sessions.may_withdraw = self.handoff.may_withdraw
        self.network = threading.Event()
        self.network.set()
        self._sleep_lock = threading.Lock()
        self._sleep_fd: int | None = None
        self._suspend_snapshot = threading.Event()
        self._change_timer = 0
        self._change_first = 0.0
        self._gate_timer = 0
        self._settle_timer = 0
        self._fresh_wanted = False
        self._system: Gio.DBusConnection | None = None
        self._monitor: Gio.NetworkMonitor | None = None

    # ------------------------------------------------------------ background work
    def _closed(self, apps: set[str]) -> None:
        # The watcher calls once these apps are quiet (closed QUIET_SECONDS ago, or holding newer state that
        # waited on them); its own helpers' runs never count (quiet.Helpers).
        now = time.monotonic()
        for app in apps:
            self.closed_at[app] = now
            if self.sync is not None:
                self.sync.appdata.mark_opened(app)
        self.wake.set()

    def worker(self) -> None:
        while not self.stop.is_set():
            try:
                if self.sync is None:
                    self._try_sign_in()
                if self.sync is not None:
                    self.sync.cycle(remote_seq=self.seq if self.seq else None)
                # Signed out: nothing reaches the network, the registry included.
            except Exception:  # noqa: BLE001 - logged once; the next cycle starts clean
                log.exception("Sync cycle failed")
            self._flush_events()
            self.portal.flush()
            # Woken by the Hub (another device changed something), an app closing,
            # an install or removal here, or a D-Bus call; otherwise a local look every 5 minutes.
            self.wake.wait(300)
            self.wake.clear()

    def poller(self) -> None:
        attempt = 0
        while not self.stop.is_set():
            if self.sync is None or not self.sync.account.activated():
                self.stop.wait(30)          # nothing to wait for on the Hub until Sync is turned on here
                continue
            try:
                registry = self.apps[0].registry.version if self.apps[0] is not None else -1
                answer = self.sync.hub.get(f"wait?after={self.seq}&timeout={IDLE_WAIT}&registry={registry}", timeout=IDLE_WAIT + 30)
                seq = int(answer["seq"])
                attempt = 0
                hinted = answer.get("registry")
                if isinstance(hinted, int) and self.apps[1] is not None and hinted != registry:
                    self.apps[1].hint = hinted          # the registry changed: fetch it now, not in 6 hours (§10.3)
                    self.wake.set()
                if seq != self.seq:
                    self.seq = seq
                    self.wake.set()
            except Offline:
                attempt += 1
                self.stop.wait(min(300, 5 * 2 ** min(attempt, 6)))
            except HubError as error:
                attempt += 1
                self.stop.wait(error.retry_after or min(300, 5 * 2 ** min(attempt, 6)))

    def _flush_events(self) -> None:
        events, self.sync.events = self.sync.events, []
        for name, args in events:
            GLib.idle_add(self._signal, name, args)

    def _signal(self, name: str, args: tuple) -> bool:
        if self.connection is None:
            return False
        signature = {"StateChanged": "()", "AppsChanged": "()", "RestoreChanged": "(s)", "JoinChanged": "(s)",
                     "JoinRequested": "(ssss)", "JoinCleared": "(ss)", "RecoveryJoined": "(sss)",
                     "ContinueOfferChanged": "()"}[name]
        self.connection.emit_signal(None, OBJECT_PATH, INTERFACE, name, GLib.Variant(signature, tuple(args)))
        return False

    # ------------------------------------------------------------ D-Bus
    def run(self) -> None:
        node = Gio.DBusNodeInfo.new_for_xml(introspection())
        threading.Thread(target=self.watcher.run, daemon=True, name="quiet").start()
        threading.Thread(target=self.reporter, daemon=True, name="reports").start()
        threading.Thread(target=self.worker, daemon=True, name="sync").start()
        threading.Thread(target=self.poller, daemon=True, name="hub-wait").start()

        def acquired(connection: Gio.DBusConnection, _name: str) -> None:
            self.connection = connection
            connection.register_object(OBJECT_PATH, node.interfaces[0], self._call, None, None)
            self.portal.register(connection)
            connection.signal_subscribe("org.freedesktop.Notifications", "org.freedesktop.Notifications", "ActionInvoked",
                                        "/org/freedesktop/Notifications", None, Gio.DBusSignalFlags.NONE, self._offer_answered)
            self._watch_continue(connection)

        def lost(*_args) -> None:
            # Another process holds the name: never queue behind it or take it back silently (review M4).
            log.error("Lost or never got %s: another process owns it. Sync stops; clients must not trust that owner.", BUS_NAME)
            self.loop.quit()

        Gio.bus_own_name(Gio.BusType.SESSION, BUS_NAME, Gio.BusNameOwnerFlags.DO_NOT_QUEUE, acquired, None, lost)
        try:
            self.loop.run()
        finally:
            self.stop.set()
            self.watcher.stop()

    def _call(self, connection, sender, _path, _interface, method, parameters, invocation) -> None:
        handler = getattr(self, f"m_{method}", None)
        if handler is None:
            invocation.return_dbus_error(f"{ERROR}.UnknownMethod", method)
            return
        kind, why, pid = callers.refusal(lambda: callers.broker_credentials(connection, sender), trusted_only=method in TRUSTED_ONLY,
                                         name_owner=lambda name: callers.name_owner(connection, name), sender=sender, extra=self.extra_callers)
        if kind:
            if (sender, method) not in self.refusals_logged and len(self.refusals_logged) < 256:
                self.refusals_logged.add((sender, method))
                log.warning("refused %s from %s (pid %s): %s", method, sender, pid, why)
            invocation.return_dbus_error(f"{ERROR}.NotAuthorized", "Apps in a sandbox can't use Suno Connect Sync." if kind == "sandbox"
                                         else "Only the Shell or Settings may do this.")
            return
        if self.sync is None:
            invocation.return_dbus_error(f"{ERROR}.SignedOut", "Sign in to Suno Connect first.")
            return

        def run() -> None:
            try:
                result = handler(sender, *parameters.unpack())
            except SyncStateError as error:
                GLib.idle_add(invocation.return_dbus_error, f"{ERROR}.{_camel(error.code)}", str(error))
                return
            except Offline as error:
                GLib.idle_add(invocation.return_dbus_error, f"{ERROR}.Offline", str(error))
                return
            except HubError as error:
                GLib.idle_add(invocation.return_dbus_error, f"{ERROR}.{_camel(error.code or 'hub')}", str(error))
                return
            except Exception as error:  # noqa: BLE001
                log.exception("%s failed", method)
                GLib.idle_add(invocation.return_dbus_error, f"{ERROR}.Failed", type(error).__name__)
                return
            self._flush_events()
            GLib.idle_add(invocation.return_value, result)
        self.pool.submit(run)

    @staticmethod
    def _json(value) -> GLib.Variant:
        return GLib.Variant("(s)", (json.dumps(value),))

    # State
    def m_GetState(self, _sender):
        return self._json(self.sync.state())

    def m_ProbeAccount(self, _sender):
        return self._json(self.sync.probe_account())

    def m_SetEnabled(self, sender, on):
        if not on:
            self._require(sender, MANAGE_ACTION)
        self.sync.set_setting(enabled=on)
        self._apps_status_changed()
        self.wake.set()
        return None

    def _apps_status_changed(self) -> None:
        """Every app that subscribed hears StatusChanged when something it can't see changed its status."""
        api = self.apps[0]
        if api is not None:
            with api.lock:
                api.events.extend((key, "StatusChanged", "", {}) for key in list(api.status_seen))
            self.portal.flush()

    def m_SetCategory(self, _sender, category, on):
        self.sync.set_setting(category=category, on=on)
        self.wake.set()
        return None

    def m_SyncNow(self, _sender):
        self.wake.set()
        return None

    # Turning Sync on
    def m_BeginSetup(self, _sender):
        self.setup = self.sync.account.begin_setup()
        return GLib.Variant("(asai)", (self.setup.words, self.setup.check))

    def m_FinishSetup(self, _sender, answers):
        if self.setup is None:
            raise SyncStateError("no_setup", "Start again: the key wasn't shown on this device.")
        with self.sync.exclusive():
            self.sync.account.finish_setup(self.setup, {int(k): str(v) for k, v in answers.items()})
        self.sync.local.put("recovery_saved_at", int(time.time()))
        self.setup = None
        self.wake.set()
        return None

    def m_CancelSetup(self, _sender):
        self.setup = None
        return None

    def m_RevealRecoveryKey(self, sender):
        self._require(sender, REVEAL_ACTION)
        return GLib.Variant("(as)", (self.sync.account.recovery_words(),))

    def m_ReplaceRecoveryKey(self, sender):
        """A new recovery key with every device kept. The words come back once, in this reply, after the same check
        as RevealRecoveryKey; the "new key" notice stays until AcknowledgeRecoveryKey."""
        self._require(sender, REVEAL_ACTION)
        with self.sync.exclusive():
            epoch, words, left_out = self.sync.account.replace_recovery()
        self.sync.emit("StateChanged")
        self.wake.set()
        return GLib.Variant("(ass)", (words, json.dumps({"epoch": epoch, "left_out": left_out})))

    def m_AcknowledgeRecoveryKey(self, _sender):
        self.sync.local.delete("recovery_replaced")
        self.sync.emit("StateChanged")
        return None

    # Joining (this device)
    def _join_json(self, view) -> GLib.Variant:
        value = {"state": view.state, "code": view.code, "join": view.join, "approvers": view.approvers}
        GLib.idle_add(self._signal, "JoinChanged", (json.dumps(value),))
        return self._json(value)

    def m_RequestJoin(self, _sender):
        with self.sync.exclusive():
            return self._join_json(self.sync.account.request_join())

    def m_GetJoin(self, _sender):
        with self.sync.exclusive():
            return self._join_json(self.sync.account.join_view())

    def m_ConfirmJoin(self, _sender, matched):
        with self.sync.exclusive():
            view = self.sync.account.confirm_join(bool(matched))
        self.wake.set()
        return self._join_json(view)

    def m_CancelJoin(self, _sender):
        self.sync.account.cancel_join()
        return None

    def m_JoinWithRecoveryKey(self, _sender, words):
        with self.sync.exclusive():
            self.sync.account.join_with_recovery(crypto.normalise_words(words))
        self.wake.set()
        return None

    # Approving (other devices)
    def m_ListJoinRequests(self, _sender):
        return self._json(self.sync.account.join_requests())

    def m_ApproveJoin(self, sender, join_id, code):
        self._require(sender, MANAGE_ACTION)
        self.sync.account.approve(join_id, code)
        self.sync.emit("JoinCleared", join_id, "approved")
        return None

    def m_DenyJoin(self, _sender, join_id):
        self.sync.account.deny(join_id)
        self.sync.emit("JoinCleared", join_id, "denied")
        return None

    # App data
    def m_ListApps(self, _sender):
        return self._json(self.sync.app_list())

    def m_SetAppEnabled(self, _sender, app, on):
        self.sync.appdata.set_info(app, enabled=bool(on))
        self.sync.emit("AppsChanged")
        self.wake.set()
        return None

    def m_DeleteAppData(self, sender, app):
        self._require(sender, MANAGE_ACTION)

        target = appdata.targets(self.sync.hub.device).get(app)
        if target is None:
            raise SyncStateError("unknown_app", "That app isn't on this device.")
        with self.sync.exclusive():
            self.sync.appdata.delete_synced(target)
        self.sync.emit("AppsChanged")
        return None

    def m_ApplyPending(self, _sender, app):
        """Called by a launcher before it starts an app: bring the newest state in now if there is one."""
        if self.sync.watcher.is_running(app):
            return GLib.Variant("(b)", (False,))
        self.sync.watcher.requested.add(app)
        try:
            self.sync.cycle(only_app=app)
        finally:
            self.sync.watcher.requested.discard(app)
        return GLib.Variant("(b)", (self.sync.appdata.info(app).get("state") == "synced",))

    def m_Quiesce(self, _sender, app):
        """An app that never exits asks for a snapshot now, while it is idle (ADR-054 §4.3)."""
        self.sync.watcher.requested.add(app)
        self.wake.set()
        return None

    # Devices
    def m_ListDevices(self, _sender):
        return self._json(self.sync.devices())

    def m_RemoveDevice(self, sender, device, new_recovery_key):
        """Remove a device; with new_recovery_key, also replace the recovery key (returns the new words, else [])."""
        self._require(sender, MANAGE_ACTION)
        with self.sync.exclusive():
            _epoch, words = self.sync.account.revoke(device, new_recovery=bool(new_recovery_key))
        if words:
            self.sync.local.put("recovery_saved_at", int(time.time()))
        self.sync.emit("StateChanged")
        # Words come back whenever the recovery key was replaced, including automatically because the device held it.
        return GLib.Variant("(as)", (words or [],))

    def m_DeleteAllSyncedData(self, sender, words):
        """Everything synced for the account, from the Hub. The Hub asks for the recovery key (review C2.4)."""
        self._require(sender, MANAGE_ACTION)
        with self.sync.exclusive():
            self.sync.account.delete_everything(crypto.normalise_words(words))
        self.sync.emit("StateChanged")
        return None

    # Restore
    def m_GetRestore(self, _sender):
        return self._json(self.sync.restore())

    def m_GetAppState(self, _sender, app):
        row = next((r for r in self.sync.restore() if r["app"] == app), None)
        info = self.sync.appdata.info(app)
        return self._json(row or {"app": app, "state": "ready" if info.get("state") == "synced" else info.get("state", "none"),
                                  "progress": info.get("progress")})

    # Continue (ADR-055 §5)
    def m_GetContinueOffer(self, _sender):
        """The newest unexpired session of another device shared with this one: {id, device, name, taken, expires, windows, apps}, or null.

        Asked as the device wakes or unlocks, often before the network is back:
        it waits for the network a few seconds, then answers from the records it holds."""
        started = time.monotonic()
        source = "hub"
        try:
            offer = self._offer_now()
        except Offline:
            source = "held"
            offer = self.sync.sessions.offer(fetch=False)
        finally:
            held = source == "held"
            self.handoff.offer_answered(held=held)
            GLib.idle_add(self._arm_gate if held else self._gate_passed)
        log.info("continue: offer asked: %s (%s, %d ms)", offer["id"] if offer else "none", source,
                 (time.monotonic() - started) * 1000)
        return self._json(offer)

    def _offer_now(self) -> dict | None:
        deadline = time.monotonic() + handoff.OFFER_NETWORK_WAIT
        while True:
            try:
                return self.sync.sessions.offer()
            except Offline:
                left = deadline - time.monotonic()
                if left <= 0:
                    raise
                # Just woken: wait for the network to come back, then a moment for it to carry.
                if not self.network.wait(left):
                    raise
                self.stop.wait(min(1.0, max(0.0, deadline - time.monotonic())))

    def m_TakeContinue(self, _sender, offer_id):
        """The offer's whole snapshot, after one sync cycle so closed-app data is current."""
        self.sync.cycle()
        return self._json(self.sync.sessions.take(offer_id))

    def m_DeclineContinue(self, _sender, offer_id):
        self.sync.sessions.decline(offer_id)
        return None

    def m_PublishContinue(self, _sender):
        return self._json({"result": self.sync.sessions.publish()})

    def m_ClearContinue(self, _sender):
        self.sync.sessions.clear()
        return None

    def m_ListConflicts(self, _sender):
        """{recent: conflicts merged on this device, versions: {app: [labelled siblings kept in the app's zone]}}"""
        versions = {}
        for app, target in appdata.targets(self.sync.hub.device).items():
            kept = self.sync.appdata.siblings(target)
            if kept:
                versions[app] = [{k: v for k, v in entry.items() if k != "file"} for entry in kept]
        kept = {app: rows for app in appdata.targets(self.sync.hub.device) if (rows := self.sync.appdata.kept_versions(app))}
        return self._json({"recent": self.sync.local.get("conflicts", []), "versions": versions, "kept": kept})

    def m_UseVersion(self, _sender, app, label):
        """Settings' Use this one…: a copy kept after a conflict goes back in the app's folder while the app is closed."""
        target = appdata.targets(self.sync.hub.device).get(app)
        if target is None:
            raise SyncStateError("unknown_app", "That app isn't on this device.")
        if self.sync.watcher.is_running(app):
            raise SyncStateError("app_running", f"Close {target.name or app} first.")
        with self.sync.exclusive():
            try:
                self.sync.appdata.use_version(target, label)
            except appdata.SnapshotAborted as error:
                raise SyncStateError("no_version", str(error)) from None
        self.sync.emit("AppsChanged")
        self.wake.set()
        return None

    # Sync for apps (ADR-057 §4, §9): what Settings shows and changes
    def _apps_ready(self):
        api, cycle = self.apps
        if api is None or cycle is None:
            raise SyncStateError("apps_unavailable", "Sync for apps isn't available on this device.")
        return api, cycle

    def m_ListSyncApps(self, _sender):
        api, _cycle = self._apps_ready()
        snapshot = api.registry.snapshot
        rows = []
        local = {(o, a) for o, a in api.known_stores()}
        for (owner, app), record in sorted(api.directory.cache.items()):
            entry = snapshot.entry(owner, app) if snapshot else None
            usage = api.store(owner, app).usage() if (owner, app) in local else None
            rows.append({"owner": owner, "app": app, "name": record.get("name", {}).get("v", app),
                         "Suno_state": entry["state"] if entry else "not-approved", "off": bool(record.get("off", {}).get("v")),
                         "here": (owner, app) in local, "usage": usage,
                         "on_devices": sorted(d for d, e in record.get("devices", {}).items() if e.get("on")),
                         "purged": int(record.get("purged", {}).get("v", 0)),
                         "bin": [{"label": label, "epoch": int(epoch), "at": int(item.get("at", 0))}
                                 for label, zones in record.get("zones", {}).items()
                                 for epoch, item in (zones.get("bin") or {}).items() if item.get("state") == "bin"]})
        for owner, app in sorted(local - set(api.directory.cache)):
            rows.append({"owner": owner, "app": app, "name": app, "Suno_state": "not-approved" if owner.startswith("key:") else
                         ((snapshot.entry(owner, app) or {}).get("state", "not-approved") if snapshot else "not-approved"),
                         "off": api.permissions.get(app) == "off", "here": True, "usage": api.store(owner, app).usage(),
                         "on_devices": [], "purged": 0, "bin": []})
        return self._json(rows)

    def m_SetSyncAppEnabled(self, _sender, owner, app, on):
        _api, cycle = self._apps_ready()
        with self.sync.exclusive():
            cycle.set_enabled(owner, app, bool(on))
        self._apps_status_changed()
        self.wake.set()
        return None

    def m_DeleteSyncAppData(self, sender, owner, app):
        self._require(sender, MANAGE_ACTION)
        _api, cycle = self._apps_ready()
        with self.sync.exclusive():
            cycle.delete_synced(owner, app)
        self.wake.set()
        return None

    def m_RestoreSyncAppZone(self, sender, owner, app, label, epoch):
        self._require(sender, MANAGE_ACTION)
        _api, cycle = self._apps_ready()
        with self.sync.exclusive():
            cycle.restore_zone(owner, app, label, int(epoch))
        self.wake.set()
        return None

    def _try_sign_in(self) -> None:
        try:
            self.sync = Sync(apps=self.apps)
        except SyncStateError:
            return
        self.sync.watcher = self.watcher
        self.sync.sessions.may_withdraw = self.handoff.may_withdraw
        log.info("Signed in to Suno Connect: Sync is ready")

    def reporter(self) -> None:
        """Daily usage reports, each at its own random time, never alongside a sync request (§10.5)."""
        while not self.stop.is_set():
            api = self.apps[0]
            if api is None:
                return
            if self.sync is None or not api.account_ready() or not self.sync.settings().get("enabled", True):
                self.stop.wait(600)         # reports only while Sync is on: no network otherwise
                continue
            for day, owner, app in api.metrics.due():
                if self.stop.is_set():
                    return
                api.metrics.send_one(day, owner, app, api.registry.current())
                self.stop.wait(30 + 600 * (os.urandom(1)[0] / 255))
            upcoming = api.metrics.next_due()
            self.stop.wait(max(60.0, min(3600.0, (upcoming or 0) - time.time())) if upcoming else 3600)

    def _offer(self, app: str, owner: str) -> None:
        """One quiet, non-blocking offer (§4.3): Allow or Not now. The name is the installation's, never the app's."""
        if self.connection is None:
            return
        from .apps_api.cycle import _app_name
        api = self.apps[0]
        name = _app_name(api.store(owner, app), app) if api else app
        try:
            reply = self.connection.call_sync(
                "org.freedesktop.Notifications", "/org/freedesktop/Notifications", "org.freedesktop.Notifications", "Notify",
                GLib.Variant("(susssasa{sv}i)", ("Suno Connect", 0, "emblem-synchronizing-symbolic", "Sync this app's data?",
                                                 f"Let {name} sync its data with your devices?",
                                                 ["allow", "Allow", "not-now", "Not now"],
                                                 {"urgency": GLib.Variant("y", 0), "desktop-entry": GLib.Variant("s", "org.projectSuno.Settings")},
                                                 -1)),
                GLib.VariantType("(u)"), Gio.DBusCallFlags.NONE, 5000, None)
            self.offers[int(reply.unpack()[0])] = app
        except GLib.Error as error:
            log.info("The sync offer couldn't be shown: %s", error.message)

    def _offer_answered(self, _conn, sender, _path, _iface, _signal, params) -> None:
        notification, action = params.unpack()
        app = self.offers.pop(int(notification), None)
        api = self.apps[0]
        if app is None or api is None:
            return
        # Only the notification server may answer, so an app can't click Allow for itself.
        try:
            owner = self.connection.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetNameOwner",
                                              GLib.Variant("(s)", ("org.freedesktop.Notifications",)), GLib.VariantType("(s)"),
                                              Gio.DBusCallFlags.NONE, 2000, None).unpack()[0]
        except GLib.Error:
            return
        if sender != owner:
            return
        api.permissions.set(app, "on" if action == "allow" else "off")
        self._apps_status_changed()
        self.wake.set()

    # ------------------------------------------------------------ Continue: when the session goes out
    def _watch_continue(self, connection: Gio.DBusConnection) -> None:
        """Lock, windows, the shell's snapshots, sleep and the network (handoff.py)."""
        flags = Gio.DBusSignalFlags.NONE
        connection.signal_subscribe("org.gnome.ScreenSaver", "org.gnome.ScreenSaver", "ActiveChanged", "/org/gnome/ScreenSaver",
                                    None, flags, lambda *a: self._lock_changed(bool(a[5].unpack()[0])))
        connection.signal_subscribe("org.gnome.Shell", "org.gnome.Shell.Introspect", None, "/org/gnome/Shell/Introspect",
                                    None, flags, self._introspect_signal)
        connection.signal_subscribe("org.projectSuno.Session", "org.projectSuno.Session1", "SnapshotTaken", "/org/projectSuno/Session",
                                    None, flags, lambda *a: self._snapshot_taken(str(a[5].unpack()[0])))
        connection.call("org.gnome.ScreenSaver", "/org/gnome/ScreenSaver", "org.gnome.ScreenSaver", "GetActive", None,
                        GLib.VariantType("(b)"), Gio.DBusCallFlags.NO_AUTO_START, 5000, None, self._lock_state_read)
        try:
            system = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
            system.signal_subscribe("org.freedesktop.login1", "org.freedesktop.login1.Manager", "PrepareForSleep",
                                    "/org/freedesktop/login1", None, flags, lambda *a: self._prepare_for_sleep(bool(a[5].unpack()[0])))
            self._system = system
            self._take_sleep_inhibitor()
        except GLib.Error as error:
            log.info("continue: no logind (%s); nothing goes out before sleep", error.message)
        monitor = Gio.NetworkMonitor.get_default()
        if not monitor.get_network_available():
            self.network.clear()
        monitor.connect("network-changed", self._network_changed)
        self._monitor = monitor

    def _lock_state_read(self, connection, result) -> None:
        try:
            self.handoff.set_locked(bool(connection.call_finish(result).unpack()[0]))
        except GLib.Error:
            pass            # no screen saver yet: unlocked until it says otherwise

    def _continue_ready(self) -> bool:
        sync = self.sync
        return sync is not None and sync.account.activated() and sync.settings().get("enabled", True)

    def _lock_changed(self, locked: bool) -> None:
        self.handoff.set_locked(locked)
        if locked:
            return          # the shell's lock snapshot follows and goes out (SnapshotTaken)
        # In use again: a fresh snapshot once the shell has asked for another device's session.
        self._fresh_wanted = True
        self._arm_gate()
        self._arm_settle()

    def _arm_gate(self) -> bool:
        if self._gate_timer:
            GLib.source_remove(self._gate_timer)
        self._gate_timer = GLib.timeout_add(int(self.handoff.gate_remaining() * 1000) + 100, self._gate_timer_fired)
        return False

    def _gate_timer_fired(self) -> bool:
        self._gate_timer = 0
        return self._gate_passed()

    def _gate_passed(self) -> bool:
        if self._gate_timer:
            GLib.source_remove(self._gate_timer)
            self._gate_timer = 0
        if self._fresh_wanted and self.handoff.may_snapshot():
            self._fresh_wanted = False
            # A moment after the offer's answer, so the shell compares it with its snapshot from before.
            GLib.timeout_add(2000, lambda: self._take_snapshot() and False)
        return False

    def _arm_settle(self) -> None:
        """At the end of the settle time, an empty desktop may end the published session."""
        if self._settle_timer:
            GLib.source_remove(self._settle_timer)
        self._settle_timer = GLib.timeout_add(int(self.handoff.settle_remaining() * 1000) + 1000, self._settled)

    def _settled(self) -> bool:
        self._settle_timer = 0
        self.pool.submit(self._publish_continue, "settled")
        return False

    def _introspect_signal(self, _conn, _sender, _path, _iface, signal, _params) -> None:
        if signal not in ("WindowsChanged", "RunningApplicationsChanged") or not self.handoff.may_snapshot():
            return
        # Gathered for a moment; a stream of changes still gets a snapshot every few seconds.
        now = time.monotonic()
        if self._change_timer:
            GLib.source_remove(self._change_timer)
        else:
            self._change_first = now
        delay = min(handoff.CHANGE_SETTLE_MS, max(0, int((self._change_first - now) * 1000) + handoff.CHANGE_MAX_MS))
        self._change_timer = GLib.timeout_add(delay, self._changes_settled)

    def _changes_settled(self) -> bool:
        self._change_timer = 0
        if self.handoff.may_snapshot():
            self._take_snapshot()
        return False

    def _take_snapshot(self) -> bool:
        """Ask the shell for a snapshot; its SnapshotTaken sends it."""
        if self.connection is None or not self._continue_ready():
            return False

        def done(connection, result) -> None:
            try:
                connection.call_finish(result)
            except GLib.Error as error:
                log.info("continue: the shell took no snapshot: %s", error.message)
        self.connection.call("org.projectSuno.Session", "/org/projectSuno/Session", "org.projectSuno.Session1", "Snapshot",
                             GLib.Variant("(s)", ("handoff",)), GLib.VariantType("(s)"), Gio.DBusCallFlags.NO_AUTO_START,
                             10000, None, done)
        return True

    def _snapshot_taken(self, reason: str) -> None:
        if reason == "suspend":
            self._suspend_snapshot.set()
            return          # sent by _before_sleep, under the inhibitor
        self.pool.submit(self._publish_continue, reason)

    def _publish_continue(self, why: str) -> str:
        if not self._continue_ready():
            return "off"
        started = time.monotonic()
        try:
            result = self.sync.sessions.publish()
        except Offline:
            self.handoff.pending = True
            log.info("continue: offline after a %s snapshot; it goes out when the network is back", why)
            return "offline"
        except Exception:  # noqa: BLE001 - logged; the next snapshot or cycle tries again
            log.exception("continue: publishing after a %s snapshot failed", why)
            return "failed"
        self.handoff.pending = False
        if result != "current":
            log.info("continue: %s after a %s snapshot (%d ms)", result, why, (time.monotonic() - started) * 1000)
        return result

    # -- sleep
    def _take_sleep_inhibitor(self) -> None:
        if self._system is None:
            return
        with self._sleep_lock:
            if self._sleep_fd is not None:
                return
        try:
            reply, fds = self._system.call_with_unix_fd_list_sync(
                "org.freedesktop.login1", "/org/freedesktop/login1", "org.freedesktop.login1.Manager", "Inhibit",
                GLib.Variant("(ssss)", ("sleep", "Suno Connect Sync", "Sending the open windows to your other devices", "delay")),
                GLib.VariantType("(h)"), Gio.DBusCallFlags.NONE, 5000, None, None)
            fd = fds.get(reply.unpack()[0])
        except GLib.Error as error:
            log.info("continue: no sleep delay lock: %s", error.message)
            return
        with self._sleep_lock:
            self._sleep_fd = fd

    def _release_sleep(self) -> bool:
        with self._sleep_lock:
            fd, self._sleep_fd = self._sleep_fd, None
        if fd is not None:
            os.close(fd)
        return False

    def _prepare_for_sleep(self, start: bool) -> None:
        if start:
            self.handoff.suspending()
            self.network.clear()
            GLib.timeout_add(int(handoff.SLEEP_BUDGET_SECONDS * 1000), self._release_sleep)
            threading.Thread(target=self._before_sleep, daemon=True, name="continue-sleep").start()
            return
        self.handoff.resumed()
        self._take_sleep_inhibitor()
        self._fresh_wanted = not self.handoff.locked
        self._arm_gate()
        self._arm_settle()
        if self._monitor is None or self._monitor.get_network_available():
            self.network.set()
        self.pool.submit(self._publish_continue, "resume")      # a session that didn't go out before sleep
        self.wake.set()

    def _before_sleep(self) -> None:
        """The shell's suspend snapshot, sent while logind waits (it rarely gets out: the network goes down now too)."""
        try:
            self._suspend_snapshot.wait(1.0)
            self._suspend_snapshot.clear()
            self._publish_continue("suspend")
        finally:
            GLib.idle_add(self._release_sleep)

    def _network_changed(self, monitor, available: bool) -> None:
        if not available:
            self.network.clear()
            return
        was = self.network.is_set()
        self.network.set()
        if self.handoff.pending:
            self.pool.submit(self._publish_continue, "network")
        if not was:
            self.wake.set()

    # ------------------------------------------------------------ callers and polkit
    def _pid(self, sender: str) -> int:
        try:
            return int(self.connection.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetConnectionUnixProcessID",
                                                 GLib.Variant("(s)", (sender,)), GLib.VariantType("(u)"), Gio.DBusCallFlags.NONE, 5000, None).unpack()[0])
        except Exception:  # noqa: BLE001
            return 0

    def _require(self, sender: str, action: str) -> None:
        if not self._authorized(sender, action):
            raise SyncStateError("not_authorized", "Your password is needed for this.")

    def _authorized(self, sender: str, action: str) -> bool:
        try:
            pid = self._pid(sender)
            if not pid:
                return False
            start = int(Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[19])
            system = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
            subject = ("unix-process", {"pid": GLib.Variant("u", pid), "start-time": GLib.Variant("t", start), "uid": GLib.Variant("i", os.getuid())})
            result = system.call_sync("org.freedesktop.PolicyKit1", "/org/freedesktop/PolicyKit1/Authority", "org.freedesktop.PolicyKit1.Authority",
                                      "CheckAuthorization", GLib.Variant("((sa{sv})sa{ss}us)", (subject, action, {}, 1, "")),
                                      GLib.VariantType("((bba{ss}))"), Gio.DBusCallFlags.NONE, 120000, None).unpack()[0]
            return bool(result[0])
        except Exception:  # noqa: BLE001 - no polkit, no answer: refuse
            return False


def _camel(code: str) -> str:
    return "".join(part.capitalize() for part in code.replace("-", "_").split("_")) or "Failed"


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        Service().run()
    except SyncStateError as error:
        log.error("%s", error)
        return 1
    return 0
