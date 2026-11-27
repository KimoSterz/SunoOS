# SPDX-License-Identifier: Apache-2.0
"""The app directory: one encrypted record per app in the system zone ``api-directory`` (ADR-057 §1.5, §9).

A device that doesn't have an app can't compute its zone ids, so every
device keeps a record per app: owner, app, its verified name, labels, tag,
whether the person turned it off, which devices have it, and each label's
zone epoch with the epochs in the bin. Devices show, meter, turn off and
delete the zones of apps they don't have through it, and purge revoked or
abandoned apps with it.

Zone names: label ``api:`` ‖ hex(lp(owner, app, label)) for epoch 0, and
hex(lp(owner, app, label, epoch)) after a ``DeleteZone``: the deleted zone
stays on the Hub for 30 days as epoch n, so Settings can restore it, and
the app starts again in epoch n + 1.

Every field merges without a coordinator: per-key latest time wins, so two
devices writing at once never lose each other's change.
"""
from __future__ import annotations

import time

from .. import crypto

ZONE = "api-directory"
BIN_DAYS = 30
ABANDONED_DAYS = 30
DAY_MS = 86_400_000


def zone_label(owner: str, app: str, label: str, epoch: int = 0) -> str:
    parts = (owner, app, label) if epoch == 0 else (owner, app, label, str(epoch))
    return "api:" + crypto.lp(*parts).hex()


def app_tag(bundle, owner: str, app: str) -> str:
    """t ‖ the first 16 bytes, hex, of mac(HKDF(names, Suno-sync-app-tag-v1), account, owner, app) (§2.3)."""
    return "t" + crypto.mac(crypto.hkdf(bundle.names, "Suno-sync-app-tag-v1"), bundle.account, owner, app)[:16].hex()


def device_handle(secret: bytes, owner: str, app: str, device: str) -> str:
    """A device's handle for one app: the same on every device of the account, different for every app."""
    if not device:
        return ""
    return crypto.mac(crypto.hkdf(secret, "Suno-sync-app-device-v1"), owner, app, device)[:8].hex()


def record_name(owner: str, app: str) -> str:
    return f"{owner}\n{app}"


def now_ms() -> int:
    return int(time.time() * 1000)


def new_record(owner: str, app: str) -> dict:
    return {"v": 1, "owner": owner, "app": app, "name": {"v": app, "t": 0}, "tag": "", "labels": {},
            "off": {"v": False, "t": 0}, "devices": {}, "zones": {}, "purged": {"v": 0, "t": 0}}


def _later(a: dict | None, b: dict | None) -> dict:
    if not a:
        return dict(b or {})
    if not b:
        return dict(a)
    return dict(b) if (b.get("t", 0), str(b)) > (a.get("t", 0), str(a)) else dict(a)


def merge(a: dict | None, b: dict | None) -> dict:
    if not a:
        return dict(b or {})
    if not b:
        return dict(a)
    out = new_record(a["owner"], a["app"])
    out["tag"] = a.get("tag") or b.get("tag") or ""
    out["name"] = _later(a.get("name"), b.get("name"))
    out["off"] = _later(a.get("off"), b.get("off"))
    out["purged"] = _later(a.get("purged"), b.get("purged"))
    for key in ("labels", "devices"):
        out[key] = {k: _later(a.get(key, {}).get(k), b.get(key, {}).get(k)) for k in set(a.get(key, {})) | set(b.get(key, {}))}
    zones = {}
    for label in set(a.get("zones", {})) | set(b.get("zones", {})):
        za, zb = a.get("zones", {}).get(label, {}), b.get("zones", {}).get(label, {})
        current = _later(za.get("current"), zb.get("current"))
        bins = {}
        for epoch in set(za.get("bin", {})) | set(zb.get("bin", {})):
            bins[epoch] = _later(za.get("bin", {}).get(epoch), zb.get("bin", {}).get(epoch))
        zones[label] = {"current": current, "bin": bins}
    out["zones"] = zones
    return out


def parse(value: object, owner: str, app: str) -> dict | None:
    if not isinstance(value, dict) or value.get("v") != 1 or value.get("owner") != owner or value.get("app") != app:
        return None
    return value


class Directory:
    """Reads and writes directory records through the engine (a system zone, written at once, merged on conflict)."""

    def __init__(self, engine) -> None:
        self.engine = engine
        self.cache: dict[tuple[str, str], dict] = {}
        self.loaded = False

    def refresh(self) -> dict[tuple[str, str], dict]:
        info = self.engine.zone(ZONE, create=True)
        if info is None:
            return self.cache
        zone = info["zone"]
        self.engine.fetch(ZONE)
        out = {}
        for name, (_version, value, _writer) in self.engine.all(ZONE).items():
            if "\n" not in name:
                continue
            owner, app = name.split("\n", 1)
            record = parse(value, owner, app)
            if record:
                out[(owner, app)] = record
        self.cache = out
        self.loaded = True
        del zone
        return out

    def get(self, owner: str, app: str) -> dict | None:
        return self.cache.get((owner, app))

    def update(self, owner: str, app: str, change) -> dict:
        """Apply ``change(record)`` and write it, merging with whatever another device wrote meanwhile."""
        for _attempt in range(5):
            current = self.cache.get((owner, app)) or new_record(owner, app)
            proposed = merge(current, current)
            change(proposed)
            saved, now = self.engine.save(ZONE, record_name(owner, app), proposed)
            if saved:
                self.cache[(owner, app)] = proposed
                return proposed
            remote = parse(now, owner, app)
            self.cache[(owner, app)] = merge(current, remote) if remote else current
        raise RuntimeError("the app directory kept changing")

    # ------------------------------------------------------------ helpers over a record
    @staticmethod
    def epoch(record: dict | None, label: str) -> int:
        if not record:
            return 0
        current = record.get("zones", {}).get(label, {}).get("current") or {}
        return int(current.get("epoch", 0))

    @staticmethod
    def live_labels(record: dict | None) -> list[str]:
        if not record:
            return []
        return sorted(label for label, entry in record.get("labels", {}).items() if entry.get("on", True))

    @staticmethod
    def off(record: dict | None) -> bool:
        return bool(record and record.get("off", {}).get("v"))

    @staticmethod
    def installed_somewhere(record: dict, now: int) -> bool:
        return any(entry.get("on") and now - int(entry.get("t", 0)) < ABANDONED_DAYS * DAY_MS
                   for entry in record.get("devices", {}).values())
