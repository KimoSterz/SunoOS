# SPDX-License-Identifier: Apache-2.0
"""The apps API's calls (ADR-057 §3.4), independent of D-Bus.

Every call answers from the device at once. Reads come from the app's own
store; writes are durable there before they return and leave in the sync
cycle (``cycle.py``). What a write does depends on the app's status:

- ``available``: kept and sent in the next cycle (answered saved/kept-both);
- the queuing states (``not-approved`` for the label or the app,
  ``no-account``, ``off``, ``not-allowed``, ``offered``): kept and sent once
  the state allows (answered queued, or kept-both when already stale);
- ``revoked``, ``suspended``: kept on this device only (answered local);
- ``unverified``: refused; nothing is stored.
"""
from __future__ import annotations

import json
import os
import logging
import secrets
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .. import crypto
from . import assets as asset_io
from . import directory as dirmod
from . import identity, model
from .limits import (MAX_ASSETS_PER_RECORD, MAX_HELD_PER_APP, MAX_INLINE_ASSET, MAX_LEASE_SECONDS, MAX_LEASES, MAX_LIST,
                     MAX_ON_DEMAND_ASSET, MAX_RECORDS_PER_CALL, OPEN_BYTES, OPEN_COPIES, OUTBOX_CAP, REREQUESTS_PER_DAY, ApiError, Bucket,
                     CallGate, check_base, check_label, check_name, check_value)
from .store import DELETE_DROPPED, DELETED, HELD, QUEUED, AppStore

log = logging.getLogger("Suno-connect-sync")

# Record flags as the client library numbers them (Suno-sync.h SunoSyncRecordFlags).
F_DELETED, F_QUEUED, F_HELD, F_DELETE_DROPPED, F_SIBLING, F_MINE, F_LOCAL_ONLY = 1, 2, 4, 8, 16, 32, 64
A_ON_DEMAND, A_HERE, A_PINNED = 1, 2, 4
PRECEDENCE = ("revoked", "suspended", "unverified", "unavailable", "not-approved", "no-account", "off", "not-allowed", "offered",
              "available")
QUEUING = {"not-approved", "no-account", "off", "not-allowed", "offered"}
LEASE_PREFIX = "\x01lease\x00"


@dataclass
class Ctx:
    caller: identity.Caller
    ident: identity.Identity
    app: str
    owner: str
    status: str
    entry: dict | None
    store: AppStore | None

    @property
    def key(self) -> str:
        return self.store.key if self.store else f"unverified:{self.app}"


def app_version(caller: identity.Caller) -> str:
    """The app's own version, from the release list in the metainfo it ships (for the daily report's context).

    The file is the app's: it is read beneath app-path without following any link, only if it is a regular
    file, and at most 200 KB of it (review M8).
    """
    import re
    from . import beneath
    try:
        root = beneath.open_dir(caller.app_path)
    except OSError:
        return "0"
    try:
        for name in (f"{caller.app}.metainfo.xml", f"{caller.app}.appdata.xml"):
            for folder in ("share/metainfo", "share/appdata"):
                data = beneath.read_regular(root, f"{folder}/{name}", 200_000)
                if not data:
                    continue
                match = re.search(rb'<release\b[^>]*\bversion="([0-9A-Za-z.+~_-]{1,64})"', data)
                if match:
                    return match.group(1).decode()
    finally:
        os.close(root)
    return "0"


class Permissions:
    """The ADR-052 permission row ``Suno / sync``: on, off or absent (§4.1)."""

    def __init__(self, store=None) -> None:
        self.store = store

    def _store(self):
        if self.store is None:
            from gi.repository import Gio, GLib  # noqa: F401
            self.store = _PortalPermissions()
        return self.store

    def get(self, app: str) -> str | None:
        try:
            values = self._store().lookup("Suno", "sync").get(app)
        except Exception:  # noqa: BLE001 - no permission store: as if absent
            return None
        return values[0] if values and values[0] in ("on", "off") else None

    def set(self, app: str, value: str) -> None:
        self._store().set("Suno", "sync", app, [value])


class _PortalPermissions:
    NAME = "org.freedesktop.impl.portal.PermissionStore"
    PATH = "/org/freedesktop/impl/portal/PermissionStore"

    def __init__(self) -> None:
        from gi.repository import Gio
        self.bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)

    def lookup(self, table: str, entry: str) -> dict[str, list[str]]:
        from gi.repository import Gio, GLib
        try:
            result = self.bus.call_sync(self.NAME, self.PATH, self.NAME, "Lookup", GLib.Variant("(ss)", (table, entry)),
                                        GLib.VariantType("(a{sas}v)"), Gio.DBusCallFlags.NONE, 5000, None)
        except GLib.Error:
            return {}
        return {app: list(v) for app, v in result.unpack()[0].items()}

    def set(self, table: str, entry: str, app: str, values: list[str]) -> None:
        from gi.repository import Gio, GLib
        self.bus.call_sync(self.NAME, self.PATH, self.NAME, "SetPermission", GLib.Variant("(sbssas)", (table, True, entry, app, values)),
                           None, Gio.DBusCallFlags.NONE, 5000, None)


class AppsApi:
    def __init__(self, *, engine, account, local, device: str, device_name: str, device_class: str, folder: Path, registry,
                 metrics, permissions: Permissions | None = None, settings: Callable[[], dict] | None = None,
                 devices: Callable[[], dict] | None = None, wake: Callable[[], None] | None = None,
                 offer: Callable[[str, str], None] | None = None, wall: Callable[[], int] | None = None) -> None:
        self.engine, self.account, self.local = engine, account, local
        self.device, self.device_name, self.device_class = device, device_name, device_class
        self.folder = folder
        self.folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.registry, self.metrics = registry, metrics
        self.permissions = permissions or Permissions()
        self.settings = settings or (lambda: {"enabled": True})
        self.devices = devices or (lambda: {})
        self.wake = wake or (lambda: None)
        self.offer = offer or (lambda app, name: None)
        self.wall = wall or (lambda: int(time.time() * 1000))
        self.resolver = identity.Resolver()
        self.gate = CallGate()
        self.hlc = model.HLC(local.get("apps_hlc"), wall=self.wall)
        self.lock = threading.RLock()
        self.stores: dict[str, AppStore] = {}
        self.events: list[tuple[str, str, str, dict]] = []     # (store key, signal, zone, details)
        self.online_at = 0.0
        self.limited: dict[str, str] = {}                       # store key -> the limit holding its writes back
        self.directory = dirmod.Directory(engine)
        self.status_seen: dict[str, str] = {}
        self.cycle = None
        self.open_budget: dict[str, Bucket] = {}
        self.copies = asset_io.OpenCopies(*OPEN_COPIES)

    def attach(self, sync) -> None:
        """Signed in (or the Sync object was rebuilt): use its Hub, account and device from now on."""
        with self.lock:
            self.engine = sync.engine
            self.account = sync.account
            self.device = sync.registration.device
            self.device_name = sync.registration.name or self.device_name
            self.device_class = sync.device_class
            self.settings = sync.settings
            self.devices = sync.device_map
            self.directory = dirmod.Directory(sync.engine)

    # ------------------------------------------------------------ stores
    def store(self, owner: str, app: str) -> AppStore:
        from .store import app_key
        key = app_key(owner, app)
        with self.lock:
            existing = self.stores.get(key)
            if existing is None:
                existing = self.stores[key] = AppStore(self.folder, owner, app)
                index = self.local.get("apps_index", {})
                if key not in index:
                    index[key] = {"owner": owner, "app": app}
                    self.local.put("apps_index", index)
            return existing

    def known_stores(self) -> list[tuple[str, str]]:
        return [(v["owner"], v["app"]) for v in self.local.get("apps_index", {}).values()]

    def forget_store(self, owner: str, app: str) -> None:
        from .store import app_key
        key = app_key(owner, app)
        with self.lock:
            store = self.stores.pop(key, None) or (AppStore(self.folder, owner, app) if (self.folder / key).is_dir() else None)
            if store is not None:
                store.destroy()
            index = self.local.get("apps_index", {})
            index.pop(key, None)
            self.local.put("apps_index", index)

    def forget_all(self) -> None:
        """This device was removed from the account: every app's mirror, cache, outbox and leases go (§9.5)."""
        for owner, app in self.known_stores():
            store = self.store(owner, app)
            store.purge_synced()            # local-only versions are the person's data on this device and stay

    def _migrate(self, fingerprint: str, owner: str, app: str) -> None:
        """Writes kept under the signing key while the app wasn't approved move to the approved owner's store."""
        from .store import app_key
        if not (self.folder / app_key(f"key:{fingerprint}", app)).is_dir():
            return
        source = self.store(f"key:{fingerprint}", app)
        target = self.store(owner, app)
        for label, row in source.pending():
            target.zone(label)
            if target.row(label, row["name"]) is None:
                op = dict(row["pending"])
                if op.get("op") == "put":
                    for version in op["vs"]:
                        for entry in version.get("a", {}).values():
                            f = source.file(entry["id"])
                            if f:
                                src_dir, dst_dir = source.files_fd(), target.files_fd()
                                try:
                                    os.rename(f["asset"], f["asset"], src_dir_fd=src_dir, dst_dir_fd=dst_dir)
                                finally:
                                    os.close(src_dir)
                                    os.close(dst_dir)
                                target.add_file(entry["id"], f["size"], f["sha256"], f["kind"])
                target.put_row(label, row["name"], pending=op, flags=QUEUED)
        self.forget_store(f"key:{fingerprint}", app)

    # ------------------------------------------------------------ status
    def account_ready(self) -> bool:
        if self.account is None or self.engine is None:
            return False
        try:
            return bool(self.account.activated()) and self.account.bundle() is not None
        except Exception:  # noqa: BLE001
            return False

    def app_status(self, ident: identity.Identity, app: str) -> tuple[str, dict | None]:
        if ident.state in ("revoked", "suspended"):
            return ident.state, ident.entry
        if ident.state == "unverified":
            return "unverified", None
        blocker = "no-account" if not self.account_ready() else ("off" if not self.settings().get("enabled", True) else "")
        current = self.registry.current(self.wall())
        entry = current.entry(ident.owner, app) if (current is not None and ident.state == "approved") else None
        if entry is None or entry["state"] != "approved":
            if entry is not None and entry["state"] in ("revoked", "suspended"):
                return entry["state"], entry
            if ident.state == "approved" and current is None and blocker:
                # Approved in the last registry this device verified; it isn't refreshed while Sync is off here
                # (no network before the person turns Sync on), so the account is what holds the app back.
                return blocker, ident.entry
            return "not-approved", None
        if blocker:
            return blocker, entry
        record = self.directory.get(ident.owner, app)
        if dirmod.Directory.off(record):
            return "not-allowed", entry
        permission = self.permissions.get(app)
        if permission == "off":
            return "not-allowed", entry
        if permission is None:
            return "offered", entry
        return "available", entry

    def zone_status(self, ctx: Ctx, label: str) -> str:
        status = ctx.status
        if PRECEDENCE.index(status) < PRECEDENCE.index("not-approved"):
            return status
        if ctx.entry is not None and label not in ctx.entry["labels"]:
            return "not-approved"
        return status

    @staticmethod
    def mode(status: str) -> str:
        if status == "available":
            return "send"
        if status in ("revoked", "suspended"):
            return "local"
        if status in QUEUING:
            return "queue"
        raise ApiError("refused", "This app's publisher can't be verified, so Sync keeps nothing for it.")

    def context(self, caller: identity.Caller) -> Ctx:
        ident = self.resolver.identity(caller, self.registry.snapshot)
        status, entry = self.app_status(ident, caller.app)
        store = None
        if ident.state != "unverified":
            if ident.state == "approved" and ident.fingerprint:
                self._migrate(ident.fingerprint, ident.owner, caller.app)
            store = self.store(ident.owner, caller.app)
            seen = store.meta("seen") or {}
            # Written when the installation changes and at most hourly, never on every call (review M7).
            if seen.get("commit") != caller.commit or seen.get("installation") != str(caller.installation) \
                    or self.wall() - int(seen.get("at", 0)) > 3_600_000:
                store.set_meta("seen", {"installation": str(caller.installation), "commit": caller.commit, "at": self.wall()})
            if store.meta("version_commit") != caller.commit:
                store.set_meta("version_commit", caller.commit)
                store.set_meta("app_version", app_version(caller))
            self.metrics.context(ident.owner, caller.app, store.meta("app_version") or "0")
            if status == "offered" and not self.local.get(f"apps_offered:{caller.app}"):
                self.local.put(f"apps_offered:{caller.app}", self.wall())
                try:
                    self.offer(caller.app, ident.owner)
                except Exception:  # noqa: BLE001 - the offer is best effort, never blocking
                    log.exception("Couldn't show the sync offer for %s", caller.app)
        ctx = Ctx(caller, ident, caller.app, ident.owner, status, entry, store)
        if store is not None:
            previous = self.status_seen.get(store.key)
            self.status_seen[store.key] = status
            if previous is not None and previous != status:
                self.events.append((store.key, "StatusChanged", "", {}))
        return ctx

    # ------------------------------------------------------------ devices and records as the app sees them
    def _secret(self) -> bytes:
        try:
            bundle = self.account.bundle() if self.account_ready() else None
        except Exception:  # noqa: BLE001
            bundle = None
        if bundle is not None:
            return bundle.names
        value = self.local.get("apps_handle_secret")
        if value is None:
            value = secrets.token_hex(32)
            self.local.put("apps_handle_secret", value)
        return bytes.fromhex(value)

    def device_out(self, ctx: Ctx, device: str) -> dict:
        known = self.devices().get(device, {})
        if device == self.device:
            name, cls = self.device_name, self.device_class
        else:
            name, cls = str(known.get("name") or ""), str(known.get("class") or "")
        return {"handle": dirmod.device_handle(self._secret(), ctx.owner, ctx.app, device), "name": name,
                "class": cls if cls in ("computer", "handheld", "tv") else "", "mine": device == self.device}

    def asset_flags(self, store: AppStore, entry: dict) -> int:
        flags = A_ON_DEMAND if entry.get("o") else 0
        local = store.file(entry["id"])
        if local:
            flags |= A_HERE
            if local["pinned"]:
                flags |= A_PINNED
        return flags

    def version_out(self, ctx: Ctx, name: str, item: dict, flags: int) -> dict:
        out = {"name": name, "version": item["i"], "value": model.unb64(item["v"]), "writer": self.device_out(ctx, item["w"]),
               "time_ms": int(item["t"]), "flags": flags | (F_MINE if item["w"] == self.device else 0),
               "assets": [{"name": n, "size": int(e.get("s", 0)), "flags": self.asset_flags(ctx.store, e)}
                          for n, e in sorted(item.get("a", {}).items())]}
        if item.get("r"):
            out["resolved_by"] = self.device_out(ctx, item["r"])
        return out

    def record_out(self, ctx: Ctx, row: dict | None, name: str) -> dict:
        view = AppStore.view(row)
        row_flags = row["flags"] if row else 0
        flags = (F_QUEUED if row_flags & QUEUED else 0) | (F_HELD if row_flags & HELD else 0) \
            | (F_DELETE_DROPPED if row_flags & DELETE_DROPPED else 0)
        op = (row or {}).get("pending") or {}
        local_ids = {v["i"] for v in op.get("vs", [])} if op.get("local") else set()
        if not view:
            return {"name": name, "version": "", "value": b"", "time_ms": 0, "assets": [], "siblings": [],
                    "flags": flags | F_DELETED | (F_LOCAL_ONLY if op.get("local") else 0)}
        top = model.current(view)
        out = self.version_out(ctx, name, top, flags | (F_LOCAL_ONLY if top["i"] in local_ids else 0))
        out["siblings"] = [self.version_out(ctx, name, s, F_SIBLING | (F_LOCAL_ONLY if s["i"] in local_ids else 0))
                           for s in model.siblings(view)]
        return out

    # ------------------------------------------------------------ helpers for writes
    def _usage(self, ctx: Ctx) -> dict:
        return ctx.store.usage()

    def _limits(self, ctx: Ctx) -> dict:
        from .limits import DEFAULT_LIMITS
        return dict(ctx.entry["limits"]) if ctx.entry else dict(DEFAULT_LIMITS)

    def _refuse(self, ctx: Ctx, kind: str, message: str, limit: str) -> ApiError:
        self.metrics.refusal(ctx.owner, ctx.app, limit)
        return ApiError(kind, message, limit)

    def _check_room(self, ctx: Ctx, mode: str, label: str, *, new_record: bool, record_bytes: int, op_bytes: int,
                    asset_bytes: int = 0, held_bytes: int = 0) -> None:
        """The app's limits, in every mode: a revoked app's local-only data is bounded too (review L1)."""
        usage, limits = self._usage(ctx), self._limits(ctx)
        if held_bytes and ctx.store.held_bytes() + held_bytes > MAX_HELD_PER_APP:
            raise self._refuse(ctx, "quota", "This app keeps as many on-demand files here as it may.", "held_bytes")
        if label not in ctx.store.labels() and usage["zones"] + 1 > limits["zones"]:
            raise self._refuse(ctx, "quota", "This app has as many zones as it may have.", "zones")
        if new_record and usage["records"] + 1 > limits["records"]:
            raise self._refuse(ctx, "quota", "This app has as many records as it may have.", "records")
        if usage["record_bytes"] + record_bytes > limits["record_bytes"]:
            raise self._refuse(ctx, "quota", "This app's records are using all their space.", "record_bytes")
        if asset_bytes and usage["asset_bytes"] + asset_bytes > limits["asset_bytes"]:
            raise self._refuse(ctx, "quota", "This app's files are using all their space.", "asset_bytes")
        if mode != "local" and usage["outbox_bytes"] + op_bytes > OUTBOX_CAP:
            raise self._refuse(ctx, "quota", "This app has too much waiting to sync.", "outbox_bytes")

    @staticmethod
    def _pending_versions(row: dict | None) -> list[dict]:
        if row and row.get("pending") and row["pending"]["op"] == "put":
            return list(row["pending"]["vs"])
        return []

    @staticmethod
    def _inherited(row: dict | None, base: str) -> set[str]:
        """What ``base`` superseded, when ``base`` is this device's write that hasn't left: the new write supersedes it too."""
        for item in AppsApi._pending_versions(row):
            if item["i"] == base:
                return set(item.get("x", []))
        if row and row.get("pending") and row["pending"]["op"] == "delete":
            return {row["pending"]["base"], *row["pending"].get("x", [])} - {""}
        return set()

    @staticmethod
    def _compose(row: dict | None, new: dict, mode: str) -> dict:
        """The record's pending write after ``new``: earlier unsent versions it supersedes are dropped."""
        old = (row or {}).get("pending") or {}
        keep = [v for v in AppsApi._pending_versions(row) if v["i"] not in set(new.get("x", []))]
        answered = "queued" if mode == "queue" or old.get("answered") == "queued" else "waited"
        return {"op": "put", "vs": keep + [new], "local": mode == "local" or bool(old.get("local")), "answered": answered}

    @staticmethod
    def _size(versions: list[dict]) -> int:
        import zlib
        plain = zlib.compress(crypto.canonical(model.record_body(versions)), 6)
        return max(1024, crypto.padme(len(plain))) + 64

    def _outcome(self, decision_outcome: str, mode: str) -> str:
        if mode == "local":
            return "local"
        if mode == "queue":
            return "queued" if decision_outcome == "saved" else decision_outcome
        return decision_outcome

    def _store_ctx(self, ctx: Ctx, label: str, write: bool = False) -> tuple[str, str]:
        """Status and mode for a call on ``label``. Only a write creates the zone, after the zone limit (review L1)."""
        check_label(label)
        status = self.zone_status(ctx, label)
        mode = self.mode(status)
        if ctx.store is None:
            raise ApiError("refused", "This app's publisher can't be verified, so Sync keeps nothing for it.")
        if write and ctx.store.zone(label, create=False) is None:
            if len(ctx.store.labels()) + 1 > self._limits(ctx)["zones"]:
                raise self._refuse(ctx, "quota", "This app has as many zones as it may have.", "zones")
            ctx.store.zone(label, epoch=dirmod.Directory.epoch(self.directory.get(ctx.owner, ctx.app), label))
        return status, mode

    def _note(self, ctx: Ctx) -> None:
        self.metrics.usage_snapshot(ctx.owner, ctx.app, ctx.store.usage())
        self.local.put("apps_hlc", self.hlc.state())
        self.wake()

    # ------------------------------------------------------------ calls
    def get_status(self, ctx: Ctx) -> dict:
        out = {"status": ctx.status, "device": self.device_out(ctx, self.device) if ctx.store else
               {"handle": "", "name": self.device_name, "class": self.device_class, "mine": True},
               "device_class": self.device_class}
        if ctx.store is not None:
            usage, limits = self._usage(ctx), self._limits(ctx)
            waiting = ctx.store.meta("reoffer_waiting") or ""
            out["usage"] = {**usage, "limited_by": self.limited.get(ctx.store.key, "") or waiting,
                            "reoffer_waiting": waiting}
            out["limits"] = {**limits, "outbox_bytes": OUTBOX_CAP}
            out["labels"] = list(ctx.entry["labels"]) if ctx.entry else []
            out["zones"] = {label: self.zone_status(ctx, label) for label in ctx.store.labels()}
        return out

    def save(self, ctx: Ctx, label: str, records: list, options: dict) -> list[dict]:
        _status, mode = self._store_ctx(ctx, label, write=True)
        if not isinstance(records, list) or not records:
            raise ApiError("invalid", "Save takes at least one record.")
        if len(records) > MAX_RECORDS_PER_CALL:
            raise ApiError("too_large", "At most 100 records per call.")
        policy = options.get("on_conflict", "keep-both")
        if policy not in ("keep-both", "fail"):
            raise ApiError("invalid", "on_conflict is keep-both or fail.")
        checked = []
        seen = set()
        for item in records:
            if not isinstance(item, (list, tuple)) or len(item) != 3:
                raise ApiError("invalid", "A record is (name, value, base).")
            name, value, base = check_name(item[0]), check_value(item[1]), check_base(item[2])
            if name in seen:
                raise ApiError("invalid", "A record appears twice in one call.")
            seen.add(name)
            checked.append((name, value, base))
        results = []
        store = ctx.store
        for name, value, base in checked:
            with store.lock:
                row = store.row(label, name)
                view = AppStore.view(row)
                base_version = next((v for v in view if v["i"] == base), None)
                carry = dict(base_version.get("a", {})) if base_version else {}       # assets stay with the record
                new = model.version(value, self.device, self.hlc.now(), assets=carry, supersedes=self._inherited(row, base))
                decision = model.decide_put(view, base, new, fail_on_conflict=policy == "fail")
                if decision.outcome in ("conflict", "too_many_siblings"):
                    if decision.outcome == "conflict":
                        self.metrics.add(ctx.owner, ctx.app, "health", "conflicts")
                    else:
                        self.metrics.add(ctx.owner, ctx.app, "health", "too_many_siblings")
                    results.append({"name": name, "outcome": decision.outcome, "record": self.record_out(ctx, row, name)})
                    continue
                size = self._size(decision.versions)
                op = self._compose(row, decision.new, mode)
                self._check_room(ctx, mode, label, new_record=not view, record_bytes=max(0, size - (row or {}).get("size", 0)),
                                 op_bytes=len(json.dumps(op)) - len(json.dumps((row or {}).get("pending") or {})))
                flags = ((row or {}).get("flags", 0) & ~(DELETE_DROPPED | DELETED)) | (0 if mode == "local" else QUEUED)
                row = store.put_row(label, name, pending=op, flags=flags, size=size)
                if decision.outcome == "kept_both":
                    self.metrics.add(ctx.owner, ctx.app, "health", "conflicts")
                    self.metrics.add(ctx.owner, ctx.app, "health", "siblings_created")
                outcome = self._outcome(decision.outcome, mode)
                results.append({"name": name, "outcome": outcome, "record": self.record_out(ctx, row, name)})
        self._note(ctx)
        return results

    def delete(self, ctx: Ctx, label: str, items: list) -> list[dict]:
        _status, mode = self._store_ctx(ctx, label, write=True)
        if not isinstance(items, list) or not items or len(items) > MAX_RECORDS_PER_CALL:
            raise ApiError("invalid" if not items else "too_large", "Delete takes 1 to 100 (name, base) pairs.")
        checked = [(check_name(n), check_base(b)) for n, b in items]
        results = []
        store = ctx.store
        for name, base in checked:
            with store.lock:
                row = store.row(label, name)
                view = AppStore.view(row)
                decision = model.decide_delete(view, base)
                if decision.outcome == "conflict":
                    self.metrics.add(ctx.owner, ctx.app, "health", "conflicts")
                    results.append({"name": name, "outcome": "conflict", "record": self.record_out(ctx, row, name)})
                    continue
                if not view:
                    results.append({"name": name, "outcome": self._outcome("saved", mode), "record": self.record_out(ctx, row, name)})
                    continue
                if not row["hub"]:
                    # Nothing of it ever left: the unsent write simply goes.
                    for item in self._pending_versions(row):
                        for entry in item.get("a", {}).values():
                            store.drop_file(entry["id"])
                    row = store.put_row(label, name, pending=None, flags=0, size=0)
                else:
                    supersedes = sorted(self._inherited(row, base) | {v["i"] for v in self._pending_versions(row)} - {base})
                    old = row.get("pending") or {}
                    op = {"op": "delete", "base": base, "x": supersedes, "local": mode == "local" or bool(old.get("local")),
                          "answered": "queued" if mode == "queue" or old.get("answered") == "queued" else "waited"}
                    row = store.put_row(label, name, pending=op, flags=(0 if mode == "local" else QUEUED), size=0)
                results.append({"name": name, "outcome": self._outcome("saved", mode), "record": self.record_out(ctx, row, name)})
        self._note(ctx)
        return results

    def fetch_changes(self, ctx: Ctx, label: str, token: str, limit: int = 200) -> dict:
        self._store_ctx(ctx, label)
        limit = max(1, min(int(limit or 200), MAX_LIST))
        after = ctx.store.parse_token(token or "")
        rows, last, more = ctx.store.changed_since(label, after, limit)
        records = [self.record_out(ctx, row, row["name"]) for row in rows]
        return {"records": records, "token": ctx.store.token(last), "more": more}

    def get(self, ctx: Ctx, label: str, name: str) -> dict | None:
        self._store_ctx(ctx, label)
        row = ctx.store.row(label, check_name(name))
        return self.record_out(ctx, row, name) if AppStore.view(row) else None

    def list(self, ctx: Ctx, label: str, after: str, limit: int) -> dict:
        self._store_ctx(ctx, label)
        if after:
            check_name(after)
        limit = max(1, min(int(limit or 100), MAX_LIST))
        rows = ctx.store.names(label, after or "", limit + 1)
        more = len(rows) > limit
        rows = rows[:limit]
        return {"records": [self.record_out(ctx, row, row["name"]) for row in rows], "next": rows[-1]["name"] if more and rows else ""}

    # ------------------------------------------------------------ assets
    def put_asset(self, ctx: Ctx, label: str, record: str, name: str, fd: int, base: str, options: dict) -> dict:
        _status, mode = self._store_ctx(ctx, label, write=True)
        record, name, base = check_name(record), check_name(name), check_base(base)
        on_demand = bool(options.get("on_demand"))
        cap = MAX_ON_DEMAND_ASSET if on_demand else MAX_INLINE_ASSET
        store = ctx.store
        asset_id = secrets.token_hex(16)
        # The limits are checked against the descriptor's size before a byte is copied (review L1).
        announced = asset_io.size_of(fd)
        if announced > cap:
            raise self._refuse(ctx, "too_large", "The asset is larger than allowed.", "asset_bytes")
        self._check_room(ctx, mode, label, new_record=False, record_bytes=0, op_bytes=0,
                         asset_bytes=0 if on_demand else announced, held_bytes=announced if on_demand else 0)
        try:
            size, digest = asset_io.copy_in(fd, store, asset_id, cap)
        except ApiError as error:
            if error.kind == "too_large":
                raise self._refuse(ctx, "too_large", "The asset is larger than allowed.", "asset_bytes") from None
            raise
        try:
            with store.lock:
                row = store.row(label, record)
                view = AppStore.view(row)
                top = model.current(view)
                if (top["i"] if top else "") != base:
                    self.metrics.add(ctx.owner, ctx.app, "health", "conflicts")
                    store.unlink(asset_id)
                    return {"name": record, "outcome": "conflict", "record": self.record_out(ctx, row, record)}
                assets = dict(top.get("a", {})) if top else {}
                if name not in assets and len(assets) >= MAX_ASSETS_PER_RECORD:
                    raise ApiError("too_large", "A record has at most 32 assets.")
                old_size = int(assets.get(name, {}).get("s", 0)) if not assets.get(name, {}).get("o") else 0
                entry = {"id": asset_id, "s": size, "h": digest, "o": on_demand, "salt": model.b64(secrets.token_bytes(asset_io.SALT)),
                         "p": None, "f": []}
                if on_demand:
                    entry["d"] = self.device
                assets[name] = entry
                value = model.unb64(top["v"]) if top else b""
                new = model.version(value, self.device, self.hlc.now(), assets=assets, supersedes=self._inherited(row, base))
                decision = model.decide_put(view, base, new, fail_on_conflict=True)
                if decision.outcome != "saved":
                    store.unlink(asset_id)
                    return {"name": record, "outcome": decision.outcome, "record": self.record_out(ctx, row, record)}
                op = self._compose(row, decision.new, mode)
                size_after = self._size(decision.versions)
                self._check_room(ctx, mode, label, new_record=not view, record_bytes=max(0, size_after - (row or {}).get("size", 0)),
                                 op_bytes=len(json.dumps(op)) - len(json.dumps((row or {}).get("pending") or {})),
                                 asset_bytes=0 if on_demand else max(0, size - old_size))
                store.add_file(asset_id, size, digest, "held" if on_demand else "spool")
                row = store.put_row(label, record, pending=op, flags=(row or {}).get("flags", 0) & ~(DELETE_DROPPED | DELETED)
                                    | (0 if mode == "local" else QUEUED), size=size_after)
        except BaseException:
            if store.file(asset_id) is None:
                store.unlink(asset_id)
            raise
        self._note(ctx)
        return {"name": record, "outcome": self._outcome("saved", mode), "record": self.record_out(ctx, row, record)}

    def remove_asset(self, ctx: Ctx, label: str, record: str, name: str, base: str) -> dict:
        _status, mode = self._store_ctx(ctx, label, write=True)
        record, name, base = check_name(record), check_name(name), check_base(base)
        store = ctx.store
        with store.lock:
            row = store.row(label, record)
            view = AppStore.view(row)
            top = model.current(view)
            if top is None or top["i"] != base:
                self.metrics.add(ctx.owner, ctx.app, "health", "conflicts")
                return {"name": record, "outcome": "conflict", "record": self.record_out(ctx, row, record)}
            if name not in top.get("a", {}):
                raise ApiError("not_found", "The record has no asset of that name.")
            assets = {k: v for k, v in top["a"].items() if k != name}
            new = model.version(model.unb64(top["v"]), self.device, self.hlc.now(), assets=assets, supersedes=self._inherited(row, base))
            decision = model.decide_put(view, base, new, fail_on_conflict=True)
            if decision.outcome != "saved":
                return {"name": record, "outcome": decision.outcome, "record": self.record_out(ctx, row, record)}
            op = self._compose(row, decision.new, mode)
            row = store.put_row(label, record, pending=op, flags=(row["flags"] & ~DELETE_DROPPED) | (0 if mode == "local" else QUEUED),
                                size=self._size(decision.versions))
        self._note(ctx)
        return {"name": record, "outcome": self._outcome("saved", mode), "record": self.record_out(ctx, row, record)}

    def _asset_entry(self, ctx: Ctx, label: str, record: str, name: str, version: str = "") -> tuple[dict | None, dict | None]:
        row = ctx.store.row(label, record)
        view = AppStore.view(row)
        item = model.current(view) if not version else next((v for v in view if v["i"] == version), None)
        if item is None:
            return None, None
        return item, item.get("a", {}).get(name)

    def _where(self, ctx: Ctx, entry: dict) -> tuple[dict | None, str]:
        holder = entry.get("d") or ""
        if not holder:
            return None, ""
        device = self.device_out(ctx, holder)
        seen = int(self.devices().get(holder, {}).get("last_seen") or 0)
        online = holder == self.device or (seen and self.wall() - seen < 10 * 60_000)
        where = f"On {device['name'] or 'another device'}" + ("" if online else " · offline")
        return device, where

    def open_asset(self, ctx: Ctx, label: str, record: str, name: str, version: str) -> tuple[str, dict, int | None]:
        self._store_ctx(ctx, label)
        record, name = check_name(record), check_name(name)
        if version:
            check_base(version)
        item, entry = self._asset_entry(ctx, label, record, name, version or "")
        if entry is None:
            return "gone", {"record": record, "name": name, "version": version or ""}, None
        info = {"record": record, "name": name, "version": item["i"], "size": int(entry.get("s", 0)),
                "flags": self.asset_flags(ctx.store, entry)}
        local = ctx.store.file(entry["id"])
        if local:
            try:
                self.copies.admit(ctx.store.key, ctx.caller.scope, int(local["size"]))
            except ApiError as error:
                if error.limit:
                    self.metrics.refusal(ctx.owner, ctx.app, error.limit)
                raise
            bucket = self.open_budget.setdefault(ctx.store.key, Bucket(*OPEN_BYTES))
            # take_large: an on-demand asset may be larger than the hourly burst (up to MAX_ON_DEMAND_ASSET).
            if not bucket.take_large(int(local["size"])):
                raise self._refuse(ctx, "rate_limited", "This app opened too many asset bytes this hour.", "open_bytes")
            readable, own = asset_io.private_copy(ctx.store, entry["id"])
            self.copies.track(ctx.store.key, ctx.app, ctx.caller.scope, own)
            return "here", info, readable
        holder, where = self._where(ctx, entry)
        if holder:
            info.update(holder=holder, where=where)
        if entry.get("o"):
            return "not-here", info, None
        self.wake()                     # an inline asset not fetched yet: the next cycle brings it
        return "fetching", info, None

    def request_asset(self, ctx: Ctx, label: str, record: str, name: str) -> tuple[str, dict]:
        self._store_ctx(ctx, label)
        item, entry = self._asset_entry(ctx, label, check_name(record), check_name(name))
        if entry is None:
            return "gone", {}
        if ctx.store.file(entry["id"]):
            return "here", {}
        if entry.get("o"):
            day = time.strftime("%Y-%m-%d", time.gmtime())
            counts = ctx.store.meta("rerequests", {})
            counts = {k: v for k, v in counts.items() if k.startswith(day)}
            key = f"{day}:{entry['id']}"
            if counts.get(key, 0) >= REREQUESTS_PER_DAY:
                raise self._refuse(ctx, "rate_limited", "This asset was asked for too often today.", "rerequests")
            counts[key] = counts.get(key, 0) + 1
            ctx.store.set_meta("rerequests", counts)
            # On-demand bytes move device to device on the peer lane (ADR-054 §6a), which hasn't shipped: say where they are.
            return "not-here", {"where": self._where(ctx, entry)[1]}
        self.wake()
        return "fetching", {}

    def pin_asset(self, ctx: Ctx, label: str, record: str, name: str, pinned: bool) -> tuple[str, dict]:
        self._store_ctx(ctx, label)
        _item, entry = self._asset_entry(ctx, label, check_name(record), check_name(name))
        if entry is None:
            return "gone", {}
        ctx.store.set_meta(f"pin:{entry['id']}", bool(pinned))
        if ctx.store.file(entry["id"]):
            ctx.store.set_pinned(entry["id"], bool(pinned))
            return "here", {}
        if entry.get("o"):
            return "not-here", {"where": self._where(ctx, entry)[1]}
        self.wake()
        return "fetching", {}

    def evict_asset(self, ctx: Ctx, label: str, record: str, name: str) -> tuple[str, dict]:
        self._store_ctx(ctx, label)
        _item, entry = self._asset_entry(ctx, label, check_name(record), check_name(name))
        if entry is None:
            return "gone", {}
        local = ctx.store.file(entry["id"])
        if local is None:
            return ("not-here" if entry.get("o") else "fetching"), {}
        if local["kind"] in ("spool", "held"):
            return "here", {}           # the only copy (not on the Hub yet, or held here): never evicted
        ctx.store.drop_file(entry["id"])
        return ("not-here" if entry.get("o") else "fetching"), {}

    # ------------------------------------------------------------ leases
    def lease_out(self, ctx: Ctx, record: str, lease: dict | None) -> dict:
        now = self.wall()
        if not lease or lease["until"] <= now:
            return {"record": record, "holder": None, "until_ms": 0, "mine": False, "active": False}
        return {"record": record, "holder": self.device_out(ctx, lease["holder"]), "until_ms": int(lease["until"]),
                "mine": lease["holder"] == self.device, "active": True}

    def lease(self, ctx: Ctx, label: str, record: str, seconds: int, take_over: bool) -> dict:
        _status, mode = self._store_ctx(ctx, label, write=True)
        record = check_name(record)
        if not isinstance(seconds, int) or seconds < 1 or seconds > MAX_LEASE_SECONDS:
            raise ApiError("invalid", "A lease lasts 1 to 3600 seconds.")
        store, now = ctx.store, self.wall()
        with store.lock:
            current = store.lease(label, record)
            if current and current["holder"] != self.device and current["until"] > now and not take_over:
                return self.lease_out(ctx, record, current)
            mine_now = current and current["holder"] == self.device and current["until"] > now
            if not mine_now and store.leases_held(self.device, now) >= MAX_LEASES:
                raise self._refuse(ctx, "rate_limited", "This app holds as many leases as it may.", "leases")
            store.set_lease(label, record, self.device, now + seconds * 1000, self.hlc.now(), pending=mode != "local",
                            take_over=bool(take_over))
            out = self.lease_out(ctx, record, store.lease(label, record))
        self._note(ctx)
        return out

    def release(self, ctx: Ctx, label: str, record: str) -> dict:
        _status, mode = self._store_ctx(ctx, label, write=True)
        record = check_name(record)
        store, now = ctx.store, self.wall()
        with store.lock:
            current = store.lease(label, record)
            if current and current["holder"] == self.device and current["until"] > now:
                store.set_lease(label, record, self.device, now, self.hlc.now(), pending=mode != "local")
            out = self.lease_out(ctx, record, store.lease(label, record))
        self._note(ctx)
        return out

    def get_lease(self, ctx: Ctx, label: str, record: str) -> dict:
        self._store_ctx(ctx, label)
        record = check_name(record)
        return self.lease_out(ctx, record, ctx.store.lease(label, record))

    # ------------------------------------------------------------ siblings and zones
    def resolve_siblings(self, ctx: Ctx, label: str, record: str, keep: str) -> dict:
        _status, mode = self._store_ctx(ctx, label, write=True)
        record, keep = check_name(record), check_base(keep)
        store = ctx.store
        with store.lock:
            row = store.row(label, record)
            view = AppStore.view(row)
            decision = model.decide_resolve(view, keep, self.device)
            if decision.outcome != "saved":
                return {"name": record, "outcome": "conflict", "record": self.record_out(ctx, row, record)}
            new = {**decision.new, "x": sorted(set(decision.new["x"]) | self._inherited(row, keep))}
            op = self._compose(row, new, mode)
            flags = (row["flags"] & ~(HELD | DELETE_DROPPED)) | (0 if mode == "local" else QUEUED)
            row = store.put_row(label, record, pending=op, flags=flags, size=self._size([new]))
            self.metrics.add(ctx.owner, ctx.app, "health", "siblings_resolved", max(0, len(view) - 1))
        self._note(ctx)
        return {"name": record, "outcome": self._outcome("saved", mode), "record": self.record_out(ctx, row, record)}

    def delete_zone(self, ctx: Ctx, label: str) -> None:
        """The app's own data in this zone, on every device; the Hub keeps it 30 days in the bin (§9.2)."""
        _status, mode = self._store_ctx(ctx, label, write=True)
        store = ctx.store
        with store.lock:
            epoch = store.zone(label, create=False)["epoch"]
            for asset in store.drop_zone(label):
                store.drop_file(asset)
            store.zone(label, epoch=epoch + 1)
            if mode != "local":
                deletions = store.meta("zone_deletions", {})
                deletions[label] = {"epoch": epoch, "at": self.wall()}
                store.set_meta("zone_deletions", deletions)
        self._note(ctx)

    def subscribed_status(self, ctx: Ctx) -> dict:
        return {"status": ctx.status}
