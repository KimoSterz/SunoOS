# SPDX-License-Identifier: Apache-2.0
"""The apps API's part of each sync cycle (ADR-057 §3.6, §5, §9, §10).

In order: refresh the signed registry when it is due or the Hub's hint names
another version; stop apps Luma suspended or revoked (drop their outbox) and
purge revoked ones; read the app directory; get the day's 64 report tokens;
then for every app this device may sync: fetch its zones into its store,
send its outbox within its quotas and rate limits (keep-both against
whatever the Hub has now), fetch inline assets, and keep the directory's
record of it current. Last, clean up: apps removed from this device, zones
in the bin for 30 days, apps on no device for 30 days.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

from ..crypto import CryptoError
from ..hub import HubError, Offline
from . import assets as asset_io
from . import directory as dirmod
from . import identity, model
from .api import LEASE_PREFIX, AppsApi
from .limits import APPS_TOTAL_BYTES, MAX_VERSIONS, SendBudget
from .store import DELETE_DROPPED, HELD, QUEUED, AppStore

log = logging.getLogger("luma-connect-sync")
DOWNLOAD_PER_CYCLE = 256 * 1024 * 1024
DAY_MS = 86_400_000
PURGE_CONFIRM_MS = 12 * 3_600_000
FUTURE_SKEW_MS = 5 * 60_000         # how far in the future a registry's issued_at may be (review N4)


class Stop(Exception):
    """Stop sending for this app this cycle (a limit); ``limit`` says which."""

    def __init__(self, limit: str) -> None:
        super().__init__(limit)
        self.limit = limit


class AppsCycle:
    def __init__(self, api: AppsApi, *, installed=None, metered=None) -> None:
        self.api = api
        api.cycle = self
        self.budget = SendBudget(api.local.get("apps_budget"))
        self.installed = installed or _installed_flatpaks
        self.metered = metered or _metered
        self.hint: int | None = None
        self.purged_seen: set[tuple[str, str]] = set()

    @property
    def engine(self):
        return self.api.engine

    # ------------------------------------------------------------ the cycle
    def has_work(self) -> bool:
        """Something only a cycle can do: queued writes or leases of an app that may send, a registry due, deletions."""
        api = self.api
        if api.registry.due(self.hint):
            return True
        for owner, app in api.known_stores():
            if not owner.startswith("flatpak:"):
                continue
            store = api.store(owner, app)
            if store.meta("zone_deletions") or store.meta("stopped"):
                return True
            if any(not row["pending"].get("local") for _l, row in store.pending()) or store.pending_leases():
                return True
        return False

    def run(self) -> dict:
        api = self.api
        summary = {"apps": 0, "sent": 0, "fetched": 0}
        if not api.account_ready() or not api.settings().get("enabled", True):
            return summary          # no network at all before the person turns Sync on here, the registry included
        if self.api.registry.due(self.hint):
            if self.api.registry.refresh():
                log.info("App registry version %s", self.api.registry.version)
        self.hint = None
        api.directory.refresh()
        self._enforce_registry()
        try:
            api.metrics.fetch_tokens(self.engine.hub, api.registry.current())
        except Offline:
            raise
        except Exception as error:  # noqa: BLE001 - reports wait for tomorrow's tokens; sync goes on
            log.info("No report tokens today: %s", error)
        self._prefetch_installed()
        busy = [(o, a) for o, a in api.known_stores() if o.startswith("flatpak:")]
        for owner, app in busy:
            entry = self._sendable(owner, app)
            if entry is None:
                continue
            summary["apps"] += 1
            store = api.store(owner, app)
            try:
                self._sync_store(store, entry, len(busy), summary)
                api.limited.pop(store.key, None)
            except Stop as stop:
                # Shown in GetStatus; never counted in the report: the Hub sees when this device's writes stop (review C1).
                api.limited[store.key] = stop.limit
            except HubError as error:
                if isinstance(error, Offline) or error.status == 429 or error.code in ("rekey_pending", "stale_generation"):
                    raise
                log.warning("Sync for an app stopped this cycle: %s", error.code or error.status)
        self._cleanup()
        api.local.put("apps_budget", self.budget.state())
        api.local.put("apps_hlc", api.hlc.state())
        self._schedule_reports()
        return summary

    def _schedule_reports(self) -> None:
        """One report a day for every approved app installed here with its sync switched on, whether it ran or not
        (review N1); none at all while the ``apps.reports`` switch is off or the Hub isn't collecting."""
        api = self.api
        enabled = api.metrics.enabled()
        apps: list[tuple[str, str]] = []
        if enabled and api.metrics.days_to_schedule():
            installed = self.installed()
            if installed is None:
                return                  # the installations couldn't be read: schedule on the next cycle
            current = api.registry.current(api.wall())
            for app, (installation, commit) in sorted(installed.items()):
                if current is None or not current.entries_for(app):
                    continue
                caller = identity.Caller(app, "flatpak", 0, "", installation, commit, Path())
                found = api.resolver.identity(caller, api.registry.snapshot)
                if found.state == "approved" and found.owner.startswith("flatpak:") and self._sendable(found.owner, app):
                    apps.append((found.owner, app))
        api.metrics.schedule(apps, enabled)

    def _approved_entry(self, owner: str, app: str) -> dict | None:
        current = self.api.registry.current(self.api.wall())
        entry = current.entry(owner, app) if current else None
        return entry if entry and entry["state"] == "approved" else None

    def _sendable(self, owner: str, app: str) -> dict | None:
        """The registry entry when this app's data may leave now: approved, Sync on, permission on, not turned off."""
        api = self.api
        entry = self._approved_entry(owner, app)
        if entry is None or not api.settings().get("enabled", True):
            return None
        if dirmod.Directory.off(api.directory.get(owner, app)) or api.permissions.get(app) != "on":
            return None
        return entry

    # ------------------------------------------------------------ registry: suspend, revoke, purge (§10.4)
    def _enforce_registry(self) -> None:
        api = self.api
        snapshot = api.registry.snapshot
        if snapshot is None:
            return
        current = api.registry.current(api.wall())
        for owner, app in api.known_stores():
            if owner.startswith("key:") and current is not None:
                # Kept under its signing key while not approved: a registry that approves that key for the app moves it.
                fpr = owner[4:]
                match = next((e for e in current.entries_for(app) if e["state"] == "approved" and fpr in e["fingerprints"]), None)
                if match is not None:
                    api._migrate(fpr, match["owner"], app)
                continue
            entry = snapshot.entry(owner, app) if owner.startswith("flatpak:") else None
            if entry is not None and entry["state"] == "approved" and current is not None:
                store = api.store(owner, app)
                if store.meta("stopped") or any(row["pending"].get("local") for _l, row in store.pending()):
                    self._reoffer(store, entry)
                continue
            if entry is None:
                continue
            store = api.store(owner, app)
            if store.meta("stopped") != entry["state"]:
                dropped = store.drop_pending()
                store.set_meta("stopped", entry["state"])
                api.events.append((store.key, "StatusChanged", "", {}))
                log.info("Luma %s an app; %d queued writes dropped", entry["state"], dropped)
        # A purge deletes data everywhere, so it is acted on only when two verified registries, of different versions
        # signed at least 12 hours apart, both list it (review M10), and this device has itself seen the purge listed for
        # at least 12 hours by its own clock: a registry key alone can't sign "12 hours" in one minute (review N4). A
        # registry signed more than five minutes in this device's future counts for neither end.
        now = api.wall()
        seen = api.local.get("purge_seen", {})
        listed = set()
        for entry in snapshot.apps:
            if entry["state"] != "revoked" or not entry["purge"]:
                continue
            key = f"{entry['owner']}\n{entry['app']}"
            listed.add(key)
            if snapshot.issued_at > now + FUTURE_SKEW_MS:
                continue
            first = seen.get(key)
            if first is None or snapshot.version < first["version"] or "seen_at" not in first:
                seen[key] = {"version": snapshot.version, "issued_at": snapshot.issued_at, "seen_at": now}
                continue
            if snapshot.version != first["version"] and snapshot.issued_at - int(first["issued_at"]) >= PURGE_CONFIRM_MS \
                    and now - int(first["seen_at"]) >= PURGE_CONFIRM_MS:
                self._purge(entry["owner"], entry["app"], reason="revoked")
        seen = {k: v for k, v in seen.items() if k in listed}
        api.local.put("purge_seen", seen)

    def _reoffer(self, store: AppStore, entry: dict) -> None:
        """Approved again: versions written while suspended or revoked go out through the outbox, keep-both against
        what they were written over, within the outbox cap and the quotas. What doesn't fit waits for the next cycle."""
        from .limits import OUTBOX_CAP
        import json
        api = self.api
        usage = store.usage()
        limits = entry["limits"]
        outbox = usage["outbox_bytes"]
        with store.lock:
            names = [(lbl, n) for lbl in store.labels() for n in
                     [r[0] for r in store.db.execute("SELECT name FROM records WHERE label=?", (lbl,)).fetchall()]]
        records = 0
        for lbl, n in names:
            row = store.row(lbl, n)
            if row["hub"] or (row["pending"] and not row["pending"].get("local") and AppStore.view(row)):
                records += 1
        record_bytes = asset_bytes = 0
        for _l, row in store.pending():
            if not row["pending"].get("local"):
                record_bytes += row["size"]
                asset_bytes += sum(int(a.get("s", 0)) for v in row["pending"].get("vs", []) for a in v.get("a", {}).values()
                                   if not a.get("o"))
        waiting = ""
        for label, row in store.pending():                      # oldest first (by sequence)
            op = row["pending"]
            if not op.get("local"):
                continue
            size = len(json.dumps(op))
            assets = sum(int(a.get("s", 0)) for v in op.get("vs", []) for a in v.get("a", {}).values() if not a.get("o"))
            checks = (("outbox_bytes", outbox + size, OUTBOX_CAP), ("records", records + (0 if row["hub"] else 1), limits["records"]),
                      ("record_bytes", record_bytes + row["size"], limits["record_bytes"]),
                      ("asset_bytes", asset_bytes + assets, limits["asset_bytes"]))
            waiting = next((name for name, value, cap in checks if value > cap), "")
            if waiting:
                break                   # offering pauses here and resumes, in order, when there's room
            outbox, records = outbox + size, records + (0 if row["hub"] else 1)
            record_bytes, asset_bytes = record_bytes + row["size"], asset_bytes + assets
            store.put_row(label, row["name"], pending={**op, "local": False, "answered": "queued"}, flags=row["flags"] | QUEUED)
        store.set_meta("reoffer_waiting", waiting or None)
        if not waiting:
            store.set_meta("stopped", None)
        api.events.append((store.key, "StatusChanged", "", {}))
        self.api.wake()

    def _purge(self, owner: str, app: str, *, reason: str) -> None:
        """Delete every zone of the app on the Hub, through the directory, and its store here (§9, §10.4)."""
        api = self.api
        record = api.directory.get(owner, app)
        if (owner, app) in self.purged_seen:
            return
        if record is None and (owner, app) not in api.known_stores():
            # Nothing of this app on this account: no directory record to write, no zone to delete (review L4).
            self.purged_seen.add((owner, app))
            return
        if record and int(record.get("purged", {}).get("v", 0)) and record.get("purged", {}).get("why") == reason:
            self.purged_seen.add((owner, app))
            if (owner, app) in api.known_stores() and reason == "revoked":
                api.store(owner, app).purge_synced()
            return
        labels = set((record or {}).get("labels", {})) | set((record or {}).get("zones", {}))
        if (owner, app) in api.known_stores():
            labels |= set(api.store(owner, app).labels())
        for label in labels:
            zones = (record or {}).get("zones", {}).get(label, {})
            epochs = {int((zones.get("current") or {}).get("epoch", 0))} | {int(e) for e in zones.get("bin", {})}
            for epoch in epochs:
                self._delete_hub_zone(dirmod.zone_label(owner, app, label, epoch))
        now = api.wall()

        def change(rec: dict) -> None:
            rec["purged"] = {"v": now, "t": now, "why": reason}
            for label in labels:
                cur = int(((rec.get("zones", {}).get(label) or {}).get("current") or {}).get("epoch", 0))
                rec.setdefault("zones", {}).setdefault(label, {"current": {}, "bin": {}})
                rec["zones"][label]["current"] = {"epoch": cur + 1, "t": now}
                rec["zones"][label].setdefault("bin", {})
        api.directory.update(owner, app, change)
        if reason in ("revoked", "deleted", "abandoned") and (owner, app) in api.known_stores():
            # The synced copies go; versions the person wrote here while the app was stopped stay (LOCAL_ONLY).
            api.store(owner, app).purge_synced()
        self.purged_seen.add((owner, app))

    def _delete_hub_zone(self, label: str) -> None:
        try:
            self.engine.delete_zone(label)
        except HubError as error:
            if error.status != 404:
                raise

    # ------------------------------------------------------------ apps installed here that this device hasn't heard from
    def _prefetch_installed(self) -> None:
        """A device fetches the zones of apps installed on it (§1.5), even before the app first calls."""
        api = self.api
        installed = self.installed() or {}
        for (owner, app), record in list(api.directory.cache.items()):
            if app not in installed or (owner, app) in api.known_stores() or not self._approved_entry(owner, app):
                continue
            installation, commit = installed[app]
            caller = identity.Caller(app, "flatpak", 0, "", installation, commit, Path())
            found = api.resolver.identity(caller, api.registry.snapshot)
            if found.state == "approved" and found.owner == owner:
                store = api.store(owner, app)
                for label in dirmod.Directory.live_labels(record):
                    store.zone(label, epoch=dirmod.Directory.epoch(record, label))

    # ------------------------------------------------------------ one app
    def _sync_store(self, store: AppStore, entry: dict, busy: int, summary: dict) -> None:
        api = self.api
        owner, app = store.owner, store.app
        record = self._directory_record(store, entry)
        # Labels another device of the account uses for this app are fetched here too, whether or not the app wrote them here.
        for label in dirmod.Directory.live_labels(record):
            if label in entry["labels"] and store.zone(label, create=False) is None:
                store.zone(label, epoch=dirmod.Directory.epoch(record, label))
        self._apply_zone_epochs(store, record)
        labels = [label for label in store.labels() if label in entry["labels"]]
        total = sum(api.store(o, a).usage()["record_bytes"] + api.store(o, a).usage()["asset_bytes"]
                    for o, a in api.known_stores() if o.startswith("flatpak:"))
        usage = store.usage()
        over = next((name for name in ("record_bytes", "asset_bytes", "records") if usage[name] > entry["limits"][name]), "")
        if not over and len(labels) > entry["limits"]["zones"]:
            over = "zones"
        if not over and total > APPS_TOTAL_BYTES:
            over = "apps_total"
        tag = dirmod.app_tag(api.account.bundle(), owner, app)
        stop: Stop | None = None
        for label in labels:
            epoch = store.zone(label, create=False)["epoch"]
            name = dirmod.zone_label(owner, app, label, epoch)
            pending = [row for lbl, row in store.pending(label) if not row["pending"].get("local")]
            leases = [lease for lbl, lease in store.pending_leases() if lbl == label]
            info = self.engine.zone(name, create=bool((pending or leases) and not over and stop is None), owner=tag)
            if info is None:
                continue
            if info.get("owner") not in (None, tag):
                log.warning("An app zone on the Hub carries another tag; it is left alone")
                continue
            summary["fetched"] += self._fetch(store, label, info["zone"])
            if over or stop is not None:
                continue
            try:
                summary["sent"] += self._drain(store, label, info["zone"], entry, busy)
            except Stop as error:
                stop = error
            except HubError as error:
                if error.code == "quota":
                    stop = Stop(str(error.body.get("allowance") or "quota"))
                elif error.code == "server_full":
                    stop = Stop("server_full")
                else:
                    raise
            self._download(store, label, info["zone"])
        api.metrics.usage_snapshot(owner, app, store.usage())
        if over:
            raise Stop(over)
        if stop is not None:
            raise stop

    def _directory_record(self, store: AppStore, entry: dict) -> dict:
        api = self.api
        owner, app = store.owner, store.app
        record = api.directory.get(owner, app)
        now = api.wall()
        me = (record or {}).get("devices", {}).get(api.device, {})
        labels = set(store.labels()) & set(entry["labels"])
        known = set((record or {}).get("labels", {}))
        tag = dirmod.app_tag(api.account.bundle(), owner, app)
        name = _app_name(store, app)
        if record and me.get("on") and now - int(me.get("t", 0)) < DAY_MS and labels <= known and record.get("tag") == tag \
                and not store.meta("zone_deletions"):
            return record
        deletions = store.meta("zone_deletions", {})

        def change(rec: dict) -> None:
            rec["tag"] = tag
            rec["name"] = {"v": name, "t": now} if rec.get("name", {}).get("v") != name else rec["name"]
            rec["devices"][api.device] = {"on": True, "t": now, "class": api.device_class}
            for label in labels - set(rec["labels"]):
                rec["labels"][label] = {"on": True, "t": now}
            for label, gone in deletions.items():
                zones = rec["zones"].setdefault(label, {"current": {}, "bin": {}})
                current = int((zones.get("current") or {}).get("epoch", 0))
                if gone["epoch"] >= current:
                    zones["current"] = {"epoch": gone["epoch"] + 1, "t": now}
                    zones.setdefault("bin", {})[str(gone["epoch"])] = {"state": "bin", "at": gone["at"], "t": now}
        record = api.directory.update(owner, app, change)
        store.set_meta("zone_deletions", {})
        return record

    def _apply_zone_epochs(self, store: AppStore, record: dict | None) -> None:
        """Another device deleted (or Settings restored) a zone: this device's copy of the old epoch goes."""
        for label in store.labels():
            want = dirmod.Directory.epoch(record, label)
            have = store.zone(label, create=False)["epoch"]
            if want != have:
                store.reset_zone(label, want)
                self.api.events.append((store.key, "Changed", label, {"reset": True}))

    # ------------------------------------------------------------ fetching
    def _fetch(self, store: AppStore, label: str, zone: str) -> int:
        api = self.api
        after = store.zone(label, create=False)["token"]
        changed, siblings = 0, []
        last = after
        for name, value, version, writer, updated in self.engine.changes(zone, after):
            if not name:
                last = version if isinstance(version, int) else last
                break
            changed += 1
            if name.startswith(LEASE_PREFIX):
                self._fetched_lease(store, label, name[len(LEASE_PREFIX):], value, version)
                continue
            try:
                versions = [] if value is None else model.clamp(model.parse_record(value), int(updated or 0))
            except ValueError:
                continue            # malformed or forged: ignored, never applied
            with store.lock:
                row = store.row(label, name)
                before = AppStore.view(row)
                old_hub = {v["i"] for v in (row or {}).get("hub", [])}
                pending = (row or {}).get("pending")
                if pending and pending["op"] == "put":
                    landed = {v["i"] for v in versions}
                    left = [v for v in pending["vs"] if v["i"] not in landed]
                    pending = {**pending, "vs": left} if left else None
                flags = (row or {}).get("flags", 0)
                if not pending:
                    flags &= ~(QUEUED | HELD)
                row = store.put_row(label, name, hub=versions, hub_version=int(version), hub_at=int(updated or 0),
                                    pending=pending, flags=flags, size=AppsApi._size(versions) if versions else 0)
                after_view = AppStore.view(row)
            for item in versions:
                api.hlc.observe(int(item["t"]), int(item["c"]))
                if item["i"] not in old_hub and item["w"] != api.device:
                    api.metrics.latency(store.owner, store.app, max(0.0, (api.wall() - int(item["t"])) / 1000))
            if writer != api.device or before != after_view:
                if len(before) != len(after_view) or (len(after_view) > 1 and {v["i"] for v in before} != {v["i"] for v in after_view}):
                    siblings.append(name)
                api.events.append((store.key, "Changed", label, {"siblings": [name]} if name in siblings else {}))
                api.metrics.add(store.owner, store.app, "usage", "hub_down_bytes", AppsApi._size(versions) if versions else 64)
        store.set_zone_token(label, last)
        return changed

    def _fetched_lease(self, store: AppStore, label: str, record: str, value, version: int) -> None:
        try:
            lease = model.parse_lease(value) if value is not None else None
        except ValueError:
            return
        with store.lock:
            mine = store.lease(label, record)
            if mine and mine["pending"]:
                store.set_lease(label, record, mine["holder"], mine["until"], (mine["t"], mine["c"]), hub_version=int(version),
                                pending=True, take_over=mine["take_over"])
                return
            if lease is None:
                store.set_lease(label, record, "", 0, (0, 0), hub_version=int(version), pending=False)
            else:
                store.set_lease(label, record, lease["h"], lease["u"], (lease["t"], lease["c"]), hub_version=int(version), pending=False)
        self.api.events.append((store.key, "Changed", label, {"leases": [record]}))

    # ------------------------------------------------------------ sending
    def _allow(self, store: AppStore, entry: dict, busy: int, size: int) -> None:
        writes, upload = self.budget.share(store.key, busy, entry["limits"])
        if writes < 1:
            raise Stop("rate_writes")
        if upload < size:
            raise Stop("rate_bytes")

    def _spend(self, store: AppStore, size: int) -> None:
        self.budget.spend(store.key, 1, size)
        self.api.metrics.add(store.owner, store.app, "usage", "writes")
        self.api.metrics.add(store.owner, store.app, "usage", "hub_up_bytes", size)

    def _drain(self, store: AppStore, label: str, zone: str, entry: dict, busy: int) -> int:
        sent = 0
        for _lbl, row in store.pending(label):
            if row["pending"].get("local"):
                continue
            sent += self._send_row(store, label, zone, row["name"], entry, busy)
        for lbl, lease in store.pending_leases():
            if lbl == label:
                sent += self._send_lease(store, label, zone, lease, entry, busy)
        return sent

    def _send_row(self, store: AppStore, label: str, zone: str, name: str, entry: dict, busy: int) -> int:
        api = self.api
        for _attempt in range(3):
            with store.lock:
                row = store.row(label, name)
                if row is None or not row["pending"] or row["pending"].get("local"):
                    return 0
                op = row["pending"]
                hub = row["hub"]
            if op["op"] == "delete":
                decision = model.drain_delete(hub, op["base"], op.get("x", []))
                if decision.outcome == "conflict":
                    with store.lock:
                        store.put_row(label, name, pending=None, flags=(row["flags"] & ~(QUEUED | HELD)) | DELETE_DROPPED)
                    api.events.append((store.key, "Changed", label, {}))
                    return 0
                self._allow(store, entry, busy, 1024)
                saved, version, now, _writer, updated = self.engine.write(zone, name, None, row["hub_version"], pad=True)
                if not saved:
                    self._refresh_row(store, label, name, version, now, updated)
                    continue
                self._spend(store, 1024)
                with store.lock:
                    store.put_row(label, name, hub=[], hub_version=version, hub_at=updated, pending=None, flags=0, size=0)
                self._collect(store, zone, hub, [])
                if op.get("answered") == "queued":
                    api.events.append((store.key, "Changed", label, {}))
                return 1
            # A write made before this device signed in carries no writer yet: it is this device's.
            versions = [self._ready_assets(store, zone, {**item, "w": item["w"] or api.device}, hub, entry, busy) for item in op["vs"]]
            after = model.merge(hub, versions)
            if len(after) > MAX_VERSIONS:
                if not row["flags"] & HELD:
                    with store.lock:
                        store.put_row(label, name, flags=row["flags"] | HELD)
                    api.metrics.add(store.owner, store.app, "health", "held_writes")
                    api.events.append((store.key, "Changed", label, {"siblings": [name]}))
                return 0
            size = AppsApi._size(after)
            self._allow(store, entry, busy, size)
            saved, version, now, _writer, updated = self.engine.write(zone, name, model.record_body(after), row["hub_version"], pad=True)
            if not saved:
                self._refresh_row(store, label, name, version, now, updated)
                continue
            self._spend(store, size)
            with store.lock:
                latest = store.row(label, name)
                still = latest["pending"] if latest and latest["pending"] else None
                if still and still["op"] == "put":
                    sent_ids = {v["i"] for v in op["vs"]}
                    left = [v for v in still["vs"] if v["i"] not in sent_ids]
                    still = {**still, "vs": left} if left else None
                elif still and still["op"] == "delete" and still is not None and still == op:
                    still = None
                store.put_row(label, name, hub=after, hub_version=version, hub_at=updated, pending=still,
                              flags=(latest["flags"] if latest else 0) & ~(HELD | DELETE_DROPPED | (0 if still else QUEUED)), size=size)
                for item in versions:
                    for asset in item.get("a", {}).values():
                        local = store.file(asset["id"])
                        if local and local["kind"] == "spool":
                            store.set_kind(asset["id"], "cache")
            raced = model.current(hub) is not None and not any(model.current(hub)["i"] in v.get("x", []) for v in versions)
            if raced:
                api.metrics.add(store.owner, store.app, "health", "siblings_created")
            self._collect(store, zone, hub + op["vs"], after)
            if op.get("answered") == "queued" or raced:
                api.events.append((store.key, "Changed", label, {"siblings": [name]} if raced else {}))
            return 1
        return 0

    def _refresh_row(self, store: AppStore, label: str, name: str, version: int, value, updated: int) -> None:
        """The Hub had a newer version (a CAS miss): take it, so the next attempt merges with it."""
        try:
            versions = [] if value is None else model.clamp(model.parse_record(value), int(updated or 0))
        except ValueError:
            versions = []
        with store.lock:
            store.put_row(label, name, hub=versions, hub_version=int(version), hub_at=int(updated or 0))

    def _ready_assets(self, store: AppStore, zone: str, item: dict, hub: list[dict], entry: dict, busy: int) -> dict:
        """Upload the pieces of the version's assets that aren't on the Hub; drop an asset whose bytes are gone everywhere."""
        on_hub = {a["id"] for v in hub for a in v.get("a", {}).values()}
        assets = {}
        changed = False
        for name, asset in item.get("a", {}).items():
            if asset.get("o"):
                assets[name] = asset
                continue
            needs = asset.get("p") is None
            if not needs and asset["id"] not in on_hub:
                needs = bool(self.engine.missing(zone, list(asset["p"])))
            if needs:
                local = store.file(asset["id"])
                if local is None:
                    changed = True
                    continue
                self._allow(store, entry, busy, int(asset["s"]))
                ids, fillers, sent = asset_io.upload(self.engine, zone, store, asset["id"], int(asset["s"]), model.unb64(asset["salt"]))
                self.budget.spend(store.key, 0, sent)
                self.api.metrics.add(store.owner, store.app, "usage", "hub_up_bytes", sent)
                asset = {**asset, "p": ids, "f": fillers}
                changed = True
            assets[name] = asset
        return {**item, "a": assets} if changed else item

    def _collect(self, store: AppStore, zone: str, before: list[dict], after: list[dict]) -> None:
        """Pieces of assets no version references any more are deleted from the Hub (each asset's pieces are its own)."""
        keep = {a["id"] for v in after for a in v.get("a", {}).values()}
        gone = {}
        for item in before:
            for asset in item.get("a", {}).values():
                if asset["id"] not in keep and asset.get("p") is not None:
                    gone[asset["id"]] = list(asset.get("p") or []) + list(asset.get("f") or [])
        if not gone:
            return
        self.engine.delete_blobs(zone, sorted({b for ids in gone.values() for b in ids}))
        everywhere = store.all_asset_ids()
        for asset in gone:
            if asset not in everywhere:
                store.drop_file(asset)

    def _send_lease(self, store: AppStore, label: str, zone: str, lease: dict, entry: dict, busy: int) -> int:
        api = self.api
        name = LEASE_PREFIX + lease["record"]
        for _attempt in range(3):
            self._allow(store, entry, busy, 1024)
            body = model.lease_body(lease["holder"], lease["until"], (lease["t"], lease["c"]))
            saved, version, now, _writer, _updated = self.engine.write(zone, name, body, lease["hub_version"], pad=True)
            if saved:
                self._spend(store, 1024)
                with store.lock:
                    current = store.lease(label, lease["record"])
                    still = current and (current["until"], current["holder"]) != (lease["until"], lease["holder"])
                    store.set_lease(label, lease["record"], current["holder"], current["until"], (current["t"], current["c"]),
                                    hub_version=version, pending=bool(still), take_over=current["take_over"])
                return 1
            try:
                remote = model.parse_lease(now) if now is not None else None
            except ValueError:
                remote = None
            if remote and remote["h"] != api.device and remote["u"] > api.wall() and not lease["take_over"]:
                with store.lock:
                    store.set_lease(label, lease["record"], remote["h"], remote["u"], (remote["t"], remote["c"]), hub_version=version,
                                    pending=False)
                api.events.append((store.key, "Changed", label, {"leases": [lease["record"]]}))
                return 0
            lease = {**lease, "hub_version": version}
        return 0

    # ------------------------------------------------------------ inline assets
    def _download(self, store: AppStore, label: str, zone: str) -> None:
        budget = DOWNLOAD_PER_CYCLE
        metered = self.metered()
        for row in store.names(label, "", 1 << 30):
            for item in AppStore.view(row):
                for name, asset in item.get("a", {}).items():
                    if asset.get("o") or asset.get("p") is None or store.file(asset["id"]):
                        continue
                    if metered and not store.meta(f"pin:{asset['id']}"):
                        continue
                    if int(asset["s"]) > budget:
                        return
                    try:
                        received = asset_io.download(self.engine, zone, asset, store)
                    except (ValueError, CryptoError, OSError) as error:
                        log.info("An app asset couldn't be fetched: %s", error)
                        continue
                    budget -= int(asset["s"])
                    store.add_file(asset["id"], int(asset["s"]), asset["h"], "cache")
                    if store.meta(f"pin:{asset['id']}"):
                        store.set_pinned(asset["id"], True)
                    self.api.metrics.add(store.owner, store.app, "usage", "hub_down_bytes", received)
                    self.api.events.append((store.key, "AssetChanged", label, {"record": row["name"], "name": name, "state": "here",
                                                                                "done": int(asset["s"]), "total": int(asset["s"])}))

    # ------------------------------------------------------------ cleanup (§9)
    def _installed_here(self, installed: dict, now: int) -> None:
        """Every approved-owner app installed here is listed as installed in the directory, refreshed daily, whatever
        its sync state: off, suspended, offered or with no registry (review H1). Abandonment is "installed nowhere"."""
        api = self.api
        for owner, app in api.known_stores():
            if not owner.startswith("flatpak:") or app not in installed:
                continue
            record = api.directory.get(owner, app)
            mine = (record or {}).get("devices", {}).get(api.device, {})
            if mine.get("on") and now - int(mine.get("t", 0)) < DAY_MS:
                continue
            api.directory.update(owner, app, lambda rec: rec["devices"].__setitem__(
                api.device, {"on": True, "t": now, "class": api.device_class}))

    def _abandoned(self, owner: str, app: str, record: dict, now: int) -> bool:
        """Installed nowhere for 30 days: every device of the account that listed the app says it was removed, the
        last of them more than 30 days ago. Never while the person switched it off, Luma suspended it, or there is
        no current registry (review H1)."""
        api = self.api
        if dirmod.Directory.off(record) or int(record.get("purged", {}).get("v", 0)):
            return False
        current = api.registry.current(now)
        if current is None:
            return False
        entry = current.entry(owner, app)
        if entry is not None and entry["state"] == "suspended":
            return False
        members = set(api.devices())
        entries = {d: e for d, e in record.get("devices", {}).items() if not members or d in members or d == api.device}
        if not entries or any(e.get("on") for e in entries.values()):
            return False
        return now - max(int(e.get("t", 0)) for e in entries.values()) > dirmod.ABANDONED_DAYS * DAY_MS

    def _cleanup(self) -> None:
        api = self.api
        installed = self.installed()
        now = api.wall()
        if installed is None:
            return                      # the installations couldn't be read: nothing is assumed removed (review L7)
        misses = api.local.get("apps_missing", {})
        for owner, app in api.known_stores():
            key = f"{owner}\n{app}"
            if app in installed:
                misses.pop(key, None)
                continue
            # Two cycles in a row without the app before anything goes (review L7).
            misses[key] = misses.get(key, 0) + 1
            if misses[key] < 2:
                continue
            misses.pop(key, None)
            # Removed from this device: its mirror, cache, outbox and leases go; the zones stay for the other devices.
            # Versions written here while the app was stopped (local-only) are the person's data and stay.
            store = api.store(owner, app)
            store.purge_synced()
            if not any(row["pending"].get("local") for _l, row in store.pending()):
                api.forget_store(owner, app)
            api.metrics.forget(owner, app)
            log.info("An app was removed from this device; its synced copies here were dropped")
            if owner.startswith("flatpak:") and api.directory.get(owner, app):
                api.directory.update(owner, app, lambda rec: rec["devices"].__setitem__(api.device, {"on": False, "t": now}))
        api.local.put("apps_missing", misses)
        self._installed_here(installed, now)
        for (owner, app), record in list(api.directory.cache.items()):
            # The bin: zones deleted by the app more than 30 days ago are removed for good (§9.2).
            for label, zones in record.get("zones", {}).items():
                for epoch, item in (zones.get("bin") or {}).items():
                    if item.get("state") == "bin" and now - int(item.get("at", now)) > dirmod.BIN_DAYS * DAY_MS:
                        self._delete_hub_zone(dirmod.zone_label(owner, app, label, int(epoch)))

                        def change(rec: dict, label=label, epoch=epoch) -> None:
                            rec["zones"][label]["bin"][epoch] = {"state": "purged", "at": rec["zones"][label]["bin"][epoch].get("at", 0),
                                                                 "t": now}
                        api.directory.update(owner, app, change)
            # Installed nowhere for 30 days: its zones go (§9.4).
            if self._abandoned(owner, app, record, now):
                self._purge(owner, app, reason="abandoned")

    # ------------------------------------------------------------ Settings (management interface)
    def delete_synced(self, owner: str, app: str) -> None:
        """Settings › Delete synced data: every zone of the app, everywhere (§9.2)."""
        self.purged_seen.discard((owner, app))
        self._purge(owner, app, reason="deleted")

    def restore_zone(self, owner: str, app: str, label: str, epoch: int) -> None:
        api = self.api
        now = api.wall()

        def change(rec: dict) -> None:
            zones = rec["zones"][label]
            item = zones["bin"][str(epoch)]
            if item.get("state") != "bin":
                raise ValueError("that zone is no longer in the bin")
            current = int((zones.get("current") or {}).get("epoch", 0))
            zones["bin"][str(current)] = {"state": "bin", "at": now, "t": now}
            zones["bin"][str(epoch)] = {"state": "restored", "at": item.get("at", 0), "t": now}
            zones["current"] = {"epoch": epoch, "t": now}
        api.directory.update(owner, app, change)

    def set_enabled(self, owner: str, app: str, on: bool) -> None:
        api = self.api
        now = api.wall()
        api.directory.update(owner, app, lambda rec: rec.__setitem__("off", {"v": not on, "t": now}))
        api.permissions.set(app, "on" if on else "off")


def _installed_flatpaks() -> dict[str, tuple[Path, str]] | None:
    """App id → (installation, active commit), from the installations' own folders; None when one couldn't be read."""
    out: dict[str, tuple[Path, str]] = {}
    for root in identity.installations():
        apps = root / "app"
        if not apps.exists():
            continue
        try:
            for app_dir in apps.iterdir():
                for arch in app_dir.iterdir():
                    for branch in arch.iterdir():
                        active = branch / "active"
                        if active.is_symlink():
                            commit = Path(active.readlink()).name
                            if identity.COMMIT.fullmatch(commit):
                                out.setdefault(app_dir.name, (root, commit))
        except OSError:
            log.warning("A Flatpak installation couldn't be read; no app is taken as removed this cycle")
            return None
    return out


def _metered() -> bool:
    try:
        from gi.repository import Gio
        return bool(Gio.NetworkMonitor.get_default().get_network_metered())
    except Exception:  # noqa: BLE001
        return False


def _app_name(store: AppStore, app: str) -> str:
    """The installation's name for the app (its exported desktop entry), never a string the app passes."""
    seen = store.meta("seen") or {}
    installation = Path(seen.get("installation") or "/nonexistent")
    entry = installation / "exports/share/applications" / f"{app}.desktop"
    try:
        for line in entry.read_text(errors="replace").splitlines():
            if line.startswith("Name="):
                return line[5:].strip()[:128] or app
    except OSError:
        pass
    return app
