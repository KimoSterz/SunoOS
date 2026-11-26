# SPDX-License-Identifier: Apache-2.0
"""One app's data on this device: its mirror, outbox, leases and asset files (ADR-057 §1.4, §3.6, §5.6).

Each (owner, app) has its own folder and SQLite database, so one app's
tables never hold another's rows and an impostor with the same app ID gets
an empty store. A record row holds:

- ``hub``: the versions the Hub had when this device last looked, and the
  Hub's version number for the CAS of the next write;
- ``pending``: this device's write that hasn't left yet (one per record:
  later writes coalesce into it), ``{"op": "put", "vs": [version, …]}`` or
  ``{"op": "delete", "base": id, "x": […]}``, with ``"local": true`` for a
  write made while Luma had revoked the app (it never leaves) and
  ``"answered"`` saying what the app was told (a write answered ``queued``
  gets a ``Changed`` when it leaves).

What the app sees (its *view*) is the Hub's versions with the pending write
applied. Every change to a row takes the next
number of the store's sequence, which change tokens count in.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import shutil
import sqlite3
import stat
import threading
from pathlib import Path

from . import beneath, model
from .limits import ApiError

DELETED, QUEUED, HELD, DELETE_DROPPED = 1, 2, 4, 8
TOKEN_PREFIX = "v1"


def app_key(owner: str, app: str) -> str:
    from ..crypto import lp
    return hashlib.sha256(lp("luma-sync-app-store-v1", owner, app)).hexdigest()[:32]


class AppStore:
    def __init__(self, root: Path, owner: str, app: str) -> None:
        self.owner, self.app = owner, app
        self.key = app_key(owner, app)
        self.folder = root / self.key
        self.folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        (self.folder / "files").mkdir(mode=0o700, exist_ok=True)
        self.lock = threading.RLock()
        path = self.folder / "store.sqlite"
        self.db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        os.chmod(path, 0o600)
        self.db.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=FULL;
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS records(label TEXT NOT NULL, name TEXT NOT NULL,
                hub TEXT NOT NULL DEFAULT '[]', hub_version INTEGER NOT NULL DEFAULT 0, hub_at INTEGER NOT NULL DEFAULT 0,
                pending TEXT, local TEXT NOT NULL DEFAULT '[]', flags INTEGER NOT NULL DEFAULT 0,
                seq INTEGER NOT NULL, size INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(label, name));
            CREATE INDEX IF NOT EXISTS records_seq ON records(label, seq);
            CREATE TABLE IF NOT EXISTS leases(label TEXT NOT NULL, record TEXT NOT NULL, holder TEXT NOT NULL,
                until INTEGER NOT NULL, t INTEGER NOT NULL, c INTEGER NOT NULL, hub_version INTEGER NOT NULL DEFAULT 0,
                pending INTEGER NOT NULL DEFAULT 0, take_over INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(label, record));
            CREATE TABLE IF NOT EXISTS files(asset TEXT PRIMARY KEY, path TEXT NOT NULL, size INTEGER NOT NULL,
                sha256 TEXT NOT NULL, kind TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS totals(id INTEGER PRIMARY KEY CHECK (id = 1), records INTEGER NOT NULL,
                record_bytes INTEGER NOT NULL, assets INTEGER NOT NULL, asset_bytes INTEGER NOT NULL, held INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS zones(label TEXT PRIMARY KEY, created INTEGER NOT NULL, token INTEGER NOT NULL DEFAULT 0,
                deleted INTEGER NOT NULL DEFAULT 0, epoch INTEGER NOT NULL DEFAULT 0);
        """)
        if self.db.execute("SELECT 1 FROM totals").fetchone() is None:
            self.recount()
        if self.meta("epoch") is None:
            self.set_meta("epoch", secrets.token_hex(8))
            self.set_meta("seq", 0)

    # ------------------------------------------------------------ small values
    def meta(self, key: str, default=None):
        with self.lock:
            row = self.db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def set_meta(self, key: str, value) -> None:
        with self.lock:
            self.db.execute("INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, json.dumps(value)))

    def _next_seq(self) -> int:
        seq = int(self.meta("seq", 0)) + 1
        self.set_meta("seq", seq)
        return seq

    def close(self) -> None:
        with self.lock:
            self.db.close()

    def destroy(self) -> None:
        """Everything this app has on this device: mirror, outbox, leases, files (§9.3)."""
        self.close()
        shutil.rmtree(self.folder, ignore_errors=True)

    # ------------------------------------------------------------ zones
    def zone(self, label: str, create: bool = True, epoch: int = 0) -> dict | None:
        with self.lock:
            row = self.db.execute("SELECT created, token, deleted, epoch FROM zones WHERE label=?", (label,)).fetchone()
            if row is None and create:
                import time
                self.db.execute("INSERT INTO zones(label, created, epoch) VALUES(?,?,?)", (label, int(time.time() * 1000), epoch))
                row = (int(time.time() * 1000), 0, 0, epoch)
        return None if row is None else {"label": label, "created": row[0], "token": row[1], "deleted": row[2], "epoch": row[3]}

    def labels(self) -> list[str]:
        with self.lock:
            return [r[0] for r in self.db.execute("SELECT label FROM zones WHERE deleted=0 ORDER BY label")]

    def set_zone_token(self, label: str, token: int) -> None:
        with self.lock:
            self.db.execute("UPDATE zones SET token=? WHERE label=?", (token, label))

    def drop_zone(self, label: str) -> list[str]:
        """Forget a zone here, everything in it; returns the asset ids it referenced (the caller drops their files)."""
        with self.lock:
            assets = {a for row in self.db.execute("SELECT hub, pending, local FROM records WHERE label=?", (label,))
                      for a in _asset_ids(json.loads(row[0]), row[1], json.loads(row[2]))}
            self.db.execute("BEGIN")
            self.db.execute("DELETE FROM records WHERE label=?", (label,))
            self.db.execute("DELETE FROM leases WHERE label=?", (label,))
            self.db.execute("DELETE FROM zones WHERE label=?", (label,))
            self.db.execute("COMMIT")
            self.recount()
        return sorted(assets)

    def reset_zone(self, label: str, epoch: int) -> None:
        """The zone moved to another epoch elsewhere (deleted, restored or purged): synced copies go, local-only writes stay."""
        keep = []
        with self.lock:
            for (name,) in self.db.execute("SELECT name FROM records WHERE label=?", (label,)).fetchall():
                row = self.row(label, name)
                if row["pending"] and row["pending"].get("local"):
                    keep.append(row)
        kept_assets = {a for row in keep for v in row["pending"].get("vs", []) for a in (e["id"] for e in v.get("a", {}).values())}
        for asset in self.drop_zone(label):
            if asset not in kept_assets:
                self.drop_file(asset)
        self.zone(label, epoch=epoch)
        for row in keep:
            self.put_row(label, row["name"], hub=[], hub_version=0, hub_at=0, pending=row["pending"], flags=row["flags"],
                         size=row["size"])

    def purge_synced(self) -> None:
        """Luma revoked and purged the app, or the person deleted its synced data: every synced copy here goes,
        and every queued write; versions written while the app was stopped stay as the person's local data."""
        for label in self.labels():
            zone = self.zone(label, create=False)
            self.reset_zone(label, zone["epoch"] + 1)
        with self.lock:
            rows = self.db.execute("SELECT label, name FROM records WHERE pending IS NOT NULL").fetchall()
        for label, name in rows:
            row = self.row(label, name)
            if not row["pending"].get("local"):
                self.put_row(label, name, pending=None, flags=0, size=0)

    # ------------------------------------------------------------ records
    def row(self, label: str, name: str) -> dict | None:
        with self.lock:
            row = self.db.execute("SELECT hub, hub_version, hub_at, pending, local, flags, seq, size FROM records WHERE label=? AND name=?",
                                  (label, name)).fetchone()
        if row is None:
            return None
        return {"name": name, "hub": json.loads(row[0]), "hub_version": row[1], "hub_at": row[2],
                "pending": json.loads(row[3]) if row[3] else None, "local": json.loads(row[4]), "flags": row[5], "seq": row[6], "size": row[7]}

    @staticmethod
    def view(row: dict | None) -> list[dict]:
        if row is None:
            return []
        versions = list(row["hub"])
        pending = row.get("pending")
        if pending and pending["op"] == "put":
            versions = model.merge(versions, list(pending["vs"]))
        elif pending and pending["op"] == "delete":
            versions = []
        return versions

    @classmethod
    def contribution(cls, row: dict | None) -> tuple[int, int, int, int, int]:
        """(records, record bytes, assets, inline asset bytes, held) one row adds to the app's usage."""
        if row is None:
            return 0, 0, 0, 0, 0
        versions = cls.view(row)
        held = 1 if row.get("flags", 0) & HELD else 0
        if not versions:
            return 0, 0, 0, 0, held
        seen: dict[str, int] = {}
        for item in versions:
            for entry in item.get("a", {}).values():
                if not entry.get("o"):
                    seen[str(entry.get("id"))] = int(entry.get("s", 0))
        return 1, int(row.get("size", 0)), len(seen), sum(seen.values()), held

    def recount(self) -> None:
        """Usage totals from every row (once, and after a zone is dropped); writes keep them up to date by delta."""
        with self.lock:
            totals = [0, 0, 0, 0, 0]
            for hub, pending, flags, size in self.db.execute("SELECT hub, pending, flags, size FROM records").fetchall():
                part = self.contribution({"hub": json.loads(hub), "pending": json.loads(pending) if pending else None,
                                          "flags": flags, "size": size})
                totals = [a + b for a, b in zip(totals, part)]
            self.db.execute("INSERT INTO totals VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET records=excluded.records,"
                            "record_bytes=excluded.record_bytes, assets=excluded.assets, asset_bytes=excluded.asset_bytes,"
                            "held=excluded.held", totals)

    def put_row(self, label: str, name: str, **fields) -> dict:
        """Change a record row; any change takes the next sequence number, and the usage totals move by the
        difference (no scan of every record per write, review M7)."""
        with self.lock:
            self.db.execute("BEGIN IMMEDIATE")
            try:
                found = self.row(label, name)
                old = found or {"hub": [], "hub_version": 0, "hub_at": 0, "pending": None, "local": [], "flags": 0, "size": 0}
                new = {**old, **fields}
                delta = [b - a for a, b in zip(self.contribution(found), self.contribution(new))]
                if any(delta):
                    self.db.execute("UPDATE totals SET records=records+?, record_bytes=record_bytes+?, assets=assets+?,"
                                    "asset_bytes=asset_bytes+?, held=held+? WHERE id=1", delta)
                seq = self._next_seq()
                self.db.execute(
                    "INSERT INTO records(label,name,hub,hub_version,hub_at,pending,local,flags,seq,size) VALUES(?,?,?,?,?,?,?,?,?,?) "
                    "ON CONFLICT(label,name) DO UPDATE SET hub=excluded.hub, hub_version=excluded.hub_version, hub_at=excluded.hub_at,"
                    "pending=excluded.pending, local=excluded.local, flags=excluded.flags, seq=excluded.seq, size=excluded.size",
                    (label, name, json.dumps(new["hub"]), new["hub_version"], new["hub_at"],
                     json.dumps(new["pending"]) if new["pending"] else None, json.dumps(new["local"]), new["flags"], seq, new["size"]))
                self.db.execute("COMMIT")
            except BaseException:
                self.db.execute("ROLLBACK")
                raise
        new["seq"] = seq
        new["name"] = name
        return new

    def names(self, label: str, after: str, limit: int) -> list[dict]:
        with self.lock:
            rows = self.db.execute("SELECT name FROM records WHERE label=? AND name>? ORDER BY name", (label, after)).fetchall()
        out = []
        for (name,) in rows:
            row = self.row(label, name)
            if self.view(row):
                out.append(row)
                if len(out) >= limit:
                    break
        return out

    def changed_since(self, label: str, seq: int, limit: int) -> tuple[list[dict], int, bool]:
        with self.lock:
            rows = self.db.execute("SELECT name FROM records WHERE label=? AND seq>? ORDER BY seq LIMIT ?", (label, seq, limit + 1)).fetchall()
        more = len(rows) > limit
        out = [self.row(label, name) for (name,) in rows[:limit]]
        last = out[-1]["seq"] if out else max(seq, int(self.meta("seq", 0)))
        if not more and out:
            last = max(last, int(self.meta("seq", 0)))
        return out, last, more

    def pending(self, label: str | None = None) -> list[tuple[str, dict]]:
        with self.lock:
            query = "SELECT label, name FROM records WHERE pending IS NOT NULL" + (" AND label=?" if label else "") + " ORDER BY seq"
            rows = self.db.execute(query, (label,) if label else ()).fetchall()
        return [(lbl, self.row(lbl, name)) for lbl, name in rows]

    def drop_pending(self) -> int:
        """The outbox is dropped (§10.4): queued writes vanish and the view falls back to the Hub's versions.
        Writes made while revoked (``local``) were never queued and stay."""
        dropped = 0
        for label, row in self.pending():
            if not row["pending"].get("local"):
                self.put_row(label, row["name"], pending=None, flags=row["flags"] & ~(QUEUED | HELD))
                dropped += 1
        with self.lock:
            self.db.execute("UPDATE leases SET pending=0 WHERE pending=1")
        return dropped

    def outbox_bytes(self) -> int:
        with self.lock:
            value = self.db.execute("SELECT COALESCE(SUM(LENGTH(pending)),0) FROM records WHERE pending IS NOT NULL "
                                    "AND pending NOT LIKE '%\"local\": true%'").fetchone()[0]
            leases = self.db.execute("SELECT COUNT(*) FROM leases WHERE pending=1").fetchone()[0]
        return int(value) + 128 * int(leases)

    def usage(self) -> dict:
        """What this app holds, from the device's view: record bytes, asset bytes, live records, zones, held writes."""
        with self.lock:
            records, record_bytes, assets, asset_bytes, held = self.db.execute(
                "SELECT records, record_bytes, assets, asset_bytes, held FROM totals WHERE id=1").fetchone()
            zones = self.db.execute("SELECT COUNT(*) FROM zones WHERE deleted=0").fetchone()[0]
        return {"record_bytes": record_bytes, "asset_bytes": asset_bytes, "records": records, "assets": assets,
                "zones": zones, "held": held, "outbox_bytes": self.outbox_bytes()}

    def token(self, seq: int) -> str:
        return f"{TOKEN_PREFIX}.{self.meta('epoch')}.{seq}"

    def parse_token(self, token: str) -> int:
        """A token of this store, or 0 (everything) for none or one from an older store on this device."""
        if not token:
            return 0
        parts = token.split(".")
        if len(parts) != 3 or parts[0] != TOKEN_PREFIX or not parts[2].isdigit():
            raise ApiError("invalid", "That isn't a change token this service gave out.")
        if parts[1] != self.meta("epoch"):
            return 0
        return int(parts[2])

    # ------------------------------------------------------------ leases
    def lease(self, label: str, record: str) -> dict | None:
        with self.lock:
            row = self.db.execute("SELECT holder, until, t, c, hub_version, pending, take_over FROM leases WHERE label=? AND record=?",
                                  (label, record)).fetchone()
        if row is None:
            return None
        return {"record": record, "holder": row[0], "until": row[1], "t": row[2], "c": row[3], "hub_version": row[4],
                "pending": bool(row[5]), "take_over": bool(row[6])}

    def set_lease(self, label: str, record: str, holder: str, until: int, clock: tuple[int, int], *, hub_version: int | None = None,
                  pending: bool, take_over: bool = False) -> None:
        with self.lock:
            old = self.lease(label, record)
            version = hub_version if hub_version is not None else (old["hub_version"] if old else 0)
            self.db.execute("INSERT INTO leases VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(label,record) DO UPDATE SET holder=excluded.holder,"
                            "until=excluded.until, t=excluded.t, c=excluded.c, hub_version=excluded.hub_version, pending=excluded.pending,"
                            "take_over=excluded.take_over",
                            (label, record, holder, until, clock[0], clock[1], version, int(pending), int(take_over)))

    def leases_held(self, device: str, now_ms: int) -> int:
        with self.lock:
            return int(self.db.execute("SELECT COUNT(*) FROM leases WHERE holder=? AND until>?", (device, now_ms)).fetchone()[0])

    def pending_leases(self) -> list[tuple[str, dict]]:
        with self.lock:
            rows = self.db.execute("SELECT label, record FROM leases WHERE pending=1").fetchall()
        return [(label, self.lease(label, record)) for label, record in rows]

    # ------------------------------------------------------------ asset files
    # Every file is named by its asset id (32 hex, checked) and opened beneath this store's files/ directory with
    # openat2(RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS); no id from another device ever becomes a path (review H2).
    def files_fd(self) -> int:
        """A new descriptor of files/ (the caller closes it)."""
        return beneath.open_dir(self.folder / "files")

    @staticmethod
    def file_name(asset: str) -> str:
        if not isinstance(asset, str) or not model.HEX32.fullmatch(asset):
            raise ValueError("not an asset id")
        return asset

    def open_file(self, asset: str, flags: int = os.O_RDONLY, mode: int = 0o600) -> int:
        folder = self.files_fd()
        try:
            return beneath.open_beneath(folder, self.file_name(asset), flags, mode)
        finally:
            os.close(folder)

    def add_file(self, asset: str, size: int, sha256: str, kind: str) -> None:
        self.file_name(asset)
        with self.lock:
            self.db.execute("INSERT INTO files VALUES(?,?,?,?,?,0) ON CONFLICT(asset) DO UPDATE SET path=excluded.path,"
                            "size=excluded.size, sha256=excluded.sha256, kind=excluded.kind", (asset, asset, size, sha256, kind))

    def set_kind(self, asset: str, kind: str) -> None:
        with self.lock:
            self.db.execute("UPDATE files SET kind=? WHERE asset=?", (kind, asset))

    def file(self, asset: str) -> dict | None:
        try:
            name = self.file_name(asset)
        except ValueError:
            return None
        with self.lock:
            row = self.db.execute("SELECT size, sha256, kind, pinned FROM files WHERE asset=?", (name,)).fetchone()
        if row is None:
            return None
        folder = self.files_fd()
        try:
            info = os.stat(name, dir_fd=folder, follow_symlinks=False)
        except OSError:
            return None
        finally:
            os.close(folder)
        if not stat.S_ISREG(info.st_mode):
            return None
        return {"asset": name, "size": row[0], "sha256": row[1], "kind": row[2], "pinned": bool(row[3])}

    def set_pinned(self, asset: str, pinned: bool) -> None:
        with self.lock:
            self.db.execute("UPDATE files SET pinned=? WHERE asset=?", (int(pinned), asset))

    def unlink(self, name: str) -> None:
        folder = self.files_fd()
        try:
            os.unlink(beneath.check_name(name), dir_fd=folder)
        except OSError:
            pass
        finally:
            os.close(folder)

    def drop_file(self, asset: str) -> None:
        try:
            name = self.file_name(asset)
        except ValueError:
            return
        with self.lock:
            self.db.execute("DELETE FROM files WHERE asset=?", (name,))
        self.unlink(name)

    def held_bytes(self) -> int:
        """On-demand bytes held on this device (never on the Hub); a device-local cap applies (review L1)."""
        with self.lock:
            return int(self.db.execute("SELECT COALESCE(SUM(size),0) FROM files WHERE kind='held'").fetchone()[0])

    def spool_bytes(self) -> int:
        """Inline asset bytes waiting in the spool, not yet on the Hub; they count against the inline quota."""
        with self.lock:
            return int(self.db.execute("SELECT COALESCE(SUM(size),0) FROM files WHERE kind='spool'").fetchone()[0])

    def all_asset_ids(self) -> set[str]:
        with self.lock:
            rows = self.db.execute("SELECT hub, pending, local FROM records").fetchall()
        return {a for hub, pending, local in rows for a in _asset_ids(json.loads(hub), pending, json.loads(local))}


def _asset_ids(hub: list[dict], pending: str | None, local: list[dict]) -> set[str]:
    versions = list(hub) + list(local)
    if pending:
        op = json.loads(pending)
        if op.get("op") == "put":
            versions.extend(op["vs"])
    return {entry["id"] for item in versions for entry in item.get("a", {}).values() if entry.get("id")}
