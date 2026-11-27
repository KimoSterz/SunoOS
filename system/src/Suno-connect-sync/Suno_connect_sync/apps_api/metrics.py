# SPDX-License-Identifier: Apache-2.0
"""Per-app counters and the daily anonymous report (ADR-057 §10.5; connect-sync-apps-hub.md §5, §6).

Reports are off unless the switch ``apps.reports`` is on (review N1): a
root-owned config file Suno ships, ``{"apps": {"reports": true}}``. The
Hub's own switch is ``config.sync.apps.reports``; while it is off the Hub
answers ``{"collecting": false}`` and the device sends nothing that day.
While they are on, every ended UTC day gets one report for every approved app installed
here whose sync is switched on, whether or not the app ran that day, each
sent at its own random time on a fresh connection, authorised by a
single-use anonymous token under the token key of the current calendar
month, and carrying no account, device or zone identifier. Every number in
a report goes through memoized randomized response.
"""
from __future__ import annotations

import base64
import json
import logging
import math
import os
import platform
import random
import re
import sqlite3
import stat
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request

from . import tokens as tk
from .limits import ERRORS, REFUSALS

log = logging.getLogger("Suno-connect-sync")
REPORT_URL = "https://hub.simplyluma.com/api/sync-metrics/v1/report"
METHODS = ("GetStatus", "Subscribe", "Save", "Delete", "FetchChanges", "Get", "List", "PutAsset", "RemoveAsset", "OpenAsset",
           "RequestAsset", "PinAsset", "EvictAsset", "Lease", "Release", "ResolveSiblings", "DeleteZone")
LATENCY = (("le_1s", 1), ("le_5s", 5), ("le_30s", 30), ("le_60s", 60), ("le_300s", 300), ("le_900s", 900),
           ("le_3600s", 3600), ("le_21600s", 21600), ("le_86400s", 86400))
USAGE_SUMS = ("hub_up_bytes", "hub_down_bytes", "peer_bytes", "relay_bytes", "transit_bytes", "writes")
USAGE_PEAKS = ("record_bytes_peak", "asset_bytes_peak", "records", "assets")
HEALTH_SUMS = ("conflicts", "siblings_created", "siblings_resolved", "too_many_siblings", "held_writes")
VERSION = re.compile(r"[0-9A-Za-z.+~_-]{1,64}")
MAX_AGE_DAYS = 7
CONFIG_PATHS = (Path("/etc/Suno-connect-sync/config.json"), Path("/usr/share/Suno-connect-sync/config.json"))


def reports_switch(paths=CONFIG_PATHS) -> bool:
    """``apps.reports`` from the first config file that exists: /etc (an administrator's) before /usr/share (the
    image's). Off when neither says true, or when the file isn't a root-owned regular file in a root-owned folder
    that no one else can write (the switch decides what leaves the device)."""
    for path in paths:
        try:
            info, folder = os.lstat(path), os.lstat(path.parent)
        except OSError:
            continue
        if not (stat.S_ISREG(info.st_mode) and stat.S_ISDIR(folder.st_mode) and info.st_uid == 0 and folder.st_uid == 0
                and not (info.st_mode | folder.st_mode) & 0o022):
            log.warning("%s isn't a root-owned file only root can write; usage reports stay off", path)
            return False
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            return False
        apps = data.get("apps") if isinstance(data, dict) else None
        return isinstance(apps, dict) and apps.get("reports") is True
    return False


def today(now: float | None = None) -> str:
    return datetime.fromtimestamp(now if now is not None else time.time(), timezone.utc).strftime("%Y-%m-%d")


def empty() -> dict:
    return {"usage": {**{k: 0 for k in USAGE_PEAKS + USAGE_SUMS}, "calls": {}},
            "health": {**{k: 0 for k in HEALTH_SUMS}, "refusals": {}, "errors": {}, "outbox_peak_bytes": 0,
                       "latency": {**{name: 0 for name, _ in LATENCY}, "gt_86400s": 0}},
            "context": {}}


def Suno_version() -> str:
    """The Suno release, coarsened to its base and ISO week ("44.2026w48"): an exact nightly id would narrow a report
    to a handful of devices (review M2)."""
    raw = "0"
    try:
        for line in Path("/etc/os-release").read_text().splitlines():
            if line.startswith(("IMAGE_VERSION=", "VERSION_ID=")):
                value = line.split("=", 1)[1].strip().strip('"')
                if VERSION.fullmatch(value):
                    raw = value
                    if line.startswith("IMAGE_VERSION="):
                        break
    except OSError:
        pass
    return coarse_version(raw)


def coarse_version(raw: str) -> str:
    base = raw.split(".", 1)[0] if raw else "0"
    base = base if re.fullmatch(r"[0-9A-Za-z]{1,16}", base) else "0"
    match = re.search(r"(20\d{2})(\d{2})(\d{2})", raw)
    if match:
        try:
            year, week, _ = datetime(int(match.group(1)), int(match.group(2)), int(match.group(3))).isocalendar()
            return f"{base}.{year}w{week:02d}"
        except ValueError:
            pass
    return base


# ---------------------------------------------------------------- local differential privacy (reviews C1, N1)
# Every number in a report is one field, as a log-4 bucket (16 buckets: values below 1, 0 included, are bucket 0;
# then 1 + floor(log4(v)), capped at 15), sent through two layers of k-ary randomized response, as in RAPPOR:
# - permanent: once per (app, field, true bucket) this device draws a response with epsilon = 2 and keeps it for
#   good, so the same value reported again costs nothing more;
# - monthly: the field and its true bucket are fixed at the first report of each UTC month, so a value that
#   changes mid-month neither spends a new response nor shows the day it changed;
# - instantaneous: each report re-randomizes the kept response with epsilon = 4, so reports of one device
#   don't repeat one fixed value that would tie them together.
# The Hub's estimate per bucket over n reports of a field is (count_j - n q') / (p' - q') with the composed
# p' and q' of ldp_channel() (connect-sync-apps-hub.md section 6).
LDP_FIELDS = ("record_bytes", "asset_bytes", "records", "assets", "hub_up_bytes", "hub_down_bytes", "writes", "outbox_bytes",
              "write_calls", "latency_s", "conflicts", "siblings_resolved", "too_many_siblings", "held_writes", "refusals",
              "errors", "reads")
LDP_BUCKETS = 16
LDP_EPSILON = 2.0           # permanent, memoized
LDP_EPSILON_REPORT = 4.0    # instantaneous, fresh in every report
WRITE_METHODS = ("Save", "Delete", "PutAsset", "RemoveAsset", "Lease", "Release", "ResolveSiblings", "DeleteZone")
READ_METHODS = ("GetStatus", "Subscribe", "FetchChanges", "Get", "List", "OpenAsset", "RequestAsset", "PinAsset", "EvictAsset")


def ldp_bucket(value: float) -> int:
    if not value >= 1:
        return 0            # below 1, zero and anything that isn't a number
    return min(LDP_BUCKETS - 1, 1 + int(math.floor(math.log(value, 4) + 1e-9)))


def rr_probabilities(epsilon: float) -> tuple[float, float]:
    """(p, q): the chance of answering the true bucket, and each other bucket, in k-ary randomized response."""
    return math.exp(epsilon) / (math.exp(epsilon) + LDP_BUCKETS - 1), 1 / (math.exp(epsilon) + LDP_BUCKETS - 1)


def ldp_channel() -> tuple[float, float]:
    """(p', q') of the permanent and instantaneous layers composed: again a symmetric k-ary channel."""
    p1, q1 = rr_probabilities(LDP_EPSILON)
    p2, q2 = rr_probabilities(LDP_EPSILON_REPORT)
    k = LDP_BUCKETS
    return p1 * p2 + (k - 1) * q1 * q2, p1 * q2 + q1 * p2 + (k - 2) * q1 * q2


def randomized_response(bucket: int, epsilon: float = LDP_EPSILON, rng: random.Random | None = None) -> int:
    rng = rng or random.SystemRandom()
    p, _q = rr_probabilities(epsilon)
    if rng.random() < p:
        return bucket
    other = rng.randrange(LDP_BUCKETS - 1)
    return other if other < bucket else other + 1


def ldp_estimate(counts: list[int]) -> list[float]:
    """The Hub's unbiased estimate of how many reports had each true bucket, from the reported buckets' counts."""
    n = sum(counts)
    p, q = ldp_channel()
    return [(c - n * q) / (p - q) for c in counts]


def month_start_ms(slot: str) -> int:
    year, month = int(slot[:4]), int(slot[5:7])
    return int(datetime(year, month, 1, tzinfo=timezone.utc).timestamp() * 1000)


def next_slot(slot: str) -> str:
    year, month = int(slot[:4]), int(slot[5:7])
    return f"{year + month // 12}-{month % 12 + 1:02d}"


def slot_of(now_ms: int) -> str:
    return datetime.fromtimestamp(now_ms / 1000, timezone.utc).strftime("%Y-%m")


def arch() -> str:
    machine = platform.machine()
    return {"x86_64": "x86_64", "amd64": "x86_64", "aarch64": "aarch64", "arm64": "aarch64"}.get(machine, "x86_64")


class Metrics:
    def __init__(self, path: Path, device_class: str, report_url: str = REPORT_URL, opener=None, switch=None) -> None:
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        os.chmod(path, 0o600)
        self.db.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS counters(day TEXT NOT NULL, owner TEXT NOT NULL, app TEXT NOT NULL, data TEXT NOT NULL,
                PRIMARY KEY(day, owner, app));
            CREATE TABLE IF NOT EXISTS reports(day TEXT NOT NULL, owner TEXT NOT NULL, app TEXT NOT NULL, due REAL NOT NULL,
                state TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, owner, app));
            CREATE TABLE IF NOT EXISTS tokens(id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, key_id TEXT NOT NULL,
                token TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS memo(owner TEXT NOT NULL, app TEXT NOT NULL, field TEXT NOT NULL, bucket INTEGER NOT NULL,
                answer INTEGER NOT NULL, PRIMARY KEY(owner, app, field, bucket));
            CREATE TABLE IF NOT EXISTS months(owner TEXT NOT NULL, app TEXT NOT NULL, month TEXT NOT NULL, field TEXT NOT NULL,
                answer INTEGER NOT NULL, PRIMARY KEY(owner, app, month));
        """)
        self.device_class = device_class if device_class in ("computer", "handheld", "tv") else "computer"
        self.report_url = report_url
        self.opener = opener
        self.buffer: dict[tuple[str, str], dict] = {}
        self.switch = switch or reports_switch

    def enabled(self) -> bool:
        """Reports on: the device's ``apps.reports`` switch is on, and the Hub hasn't said today that it isn't
        collecting."""
        return bool(self.switch()) and self._kv("hub_off") != today()

    def _hub_off(self) -> None:
        log.info("The Hub isn't collecting usage reports; none are sent today")
        self._put_kv("hub_off", today())
        with self.lock:
            self.db.execute("UPDATE reports SET state='skipped' WHERE state='due'")

    # ------------------------------------------------------------ counting
    def _data(self, owner: str, app: str, day: str) -> dict:
        row = self.db.execute("SELECT data FROM counters WHERE day=? AND owner=? AND app=?", (day, owner, app)).fetchone()
        return json.loads(row[0]) if row else empty()

    def _update(self, owner: str, app: str, change) -> None:
        if not owner.startswith("flatpak:"):
            return                      # only approved publishers are reported (key:… and unverified never)
        day = today()
        with self.lock:
            data = self._data(owner, app, day)
            change(data)
            self.db.execute("INSERT INTO counters VALUES(?,?,?,?) ON CONFLICT(day,owner,app) DO UPDATE SET data=excluded.data",
                            (day, owner, app, json.dumps(data)))

    def add(self, owner: str, app: str, section: str, name: str, amount: int = 1) -> None:
        def change(data: dict) -> None:
            data[section][name] = int(data[section].get(name, 0)) + int(amount)
        self._update(owner, app, change)

    def call(self, owner: str, app: str, method: str) -> None:
        if method in METHODS:
            self._update(owner, app, lambda d: d["usage"]["calls"].__setitem__(method, d["usage"]["calls"].get(method, 0) + 1))

    def refusal(self, owner: str, app: str, limit: str) -> None:
        if limit in REFUSALS:
            self._update(owner, app, lambda d: d["health"]["refusals"].__setitem__(limit, d["health"]["refusals"].get(limit, 0) + 1))

    def error(self, owner: str, app: str, kind: str) -> None:
        kind = kind if kind in ERRORS else "failed"
        self._update(owner, app, lambda d: d["health"]["errors"].__setitem__(kind, d["health"]["errors"].get(kind, 0) + 1))

    def peak(self, owner: str, app: str, section: str, name: str, value: int) -> None:
        def change(data: dict) -> None:
            data[section][name] = max(int(data[section].get(name, 0)), int(value))
        self._update(owner, app, change)

    def usage_snapshot(self, owner: str, app: str, usage: dict) -> None:
        def change(data: dict) -> None:
            u = data["usage"]
            u["record_bytes_peak"] = max(u["record_bytes_peak"], int(usage.get("record_bytes", 0)))
            u["asset_bytes_peak"] = max(u["asset_bytes_peak"], int(usage.get("asset_bytes", 0)))
            u["records"] = max(u["records"], int(usage.get("records", 0)))
            u["assets"] = max(u["assets"], int(usage.get("assets", 0)))
            data["health"]["outbox_peak_bytes"] = max(data["health"]["outbox_peak_bytes"], int(usage.get("outbox_bytes", 0)))
        self._update(owner, app, change)

    def latency(self, owner: str, app: str, seconds: float) -> None:
        name = next((n for n, limit in LATENCY if seconds <= limit), "gt_86400s")
        self._update(owner, app, lambda d: d["health"]["latency"].__setitem__(name, d["health"]["latency"][name] + 1))

    def context(self, owner: str, app: str, app_version: str) -> None:
        """The app's version, kept per app rather than per day: a report for a day the app didn't run carries it too,
        so the version never says whether the app ran (review N1)."""
        if not owner.startswith("flatpak:"):
            return
        version = app_version if VERSION.fullmatch(app_version or "") else "0"
        versions = self._kv("app_versions", {})
        if versions.get(f"{owner}\n{app}") != version:
            versions[f"{owner}\n{app}"] = version
            self._put_kv("app_versions", versions)

    # ------------------------------------------------------------ reports
    @staticmethod
    def truth(data: dict) -> dict:
        """Every number a report can carry, for one (app, day); only one of them goes out, randomized."""
        u, h = data["usage"], data["health"]
        calls = u.get("calls", {})
        latency = h.get("latency", {})
        arrivals = sum(int(v) for v in latency.values())
        median = 0
        if arrivals:
            seen = 0
            for name, limit in [*LATENCY, ("gt_86400s", 172800)]:
                seen += int(latency.get(name, 0))
                if seen * 2 >= arrivals:
                    median = limit
                    break
        return {"record_bytes": u.get("record_bytes_peak", 0), "asset_bytes": u.get("asset_bytes_peak", 0),
                "records": u.get("records", 0), "assets": u.get("assets", 0), "hub_up_bytes": u.get("hub_up_bytes", 0),
                "hub_down_bytes": u.get("hub_down_bytes", 0), "writes": u.get("writes", 0),
                "outbox_bytes": h.get("outbox_peak_bytes", 0), "write_calls": sum(int(calls.get(m, 0)) for m in WRITE_METHODS),
                "latency_s": median, "conflicts": h.get("conflicts", 0), "siblings_resolved": h.get("siblings_resolved", 0),
                "too_many_siblings": h.get("too_many_siblings", 0), "held_writes": h.get("held_writes", 0),
                "refusals": sum(int(v) for k, v in h.get("refusals", {}).items() if k in REFUSALS),
                "errors": sum(int(v) for k, v in h.get("errors", {}).items() if k in ERRORS),
                "reads": sum(int(calls.get(m, 0)) for m in READ_METHODS)}

    def _monthly(self, day: str, owner: str, app: str, rng: random.Random) -> tuple[str, int]:
        """(field, kept response) for this app this month: fixed at the month's first report, from a response drawn
        once per (app, field, true bucket) and kept for good (RAPPOR's permanent randomized response)."""
        month = day[:7]
        with self.lock:
            row = self.db.execute("SELECT field, answer FROM months WHERE owner=? AND app=? AND month=?",
                                  (owner, app, month)).fetchone()
            if row and row[0] in LDP_FIELDS:
                return row[0], int(row[1])
            field = LDP_FIELDS[rng.randrange(len(LDP_FIELDS))]
            bucket = ldp_bucket(float(self.truth(self._data(owner, app, day))[field]))
            kept = self.db.execute("SELECT answer FROM memo WHERE owner=? AND app=? AND field=? AND bucket=?",
                                   (owner, app, field, bucket)).fetchone()
            if kept is None:
                answer = randomized_response(bucket, LDP_EPSILON, rng)
                self.db.execute("INSERT INTO memo VALUES(?,?,?,?,?)", (owner, app, field, bucket, answer))
            else:
                answer = int(kept[0])
            self.db.execute("INSERT OR REPLACE INTO months VALUES(?,?,?,?,?)", (owner, app, month, field, answer))
            oldest = (datetime.strptime(month + "-01", "%Y-%m-%d") - timedelta(days=100)).strftime("%Y-%m")
            self.db.execute("DELETE FROM months WHERE month<?", (oldest,))
            return field, answer

    def report_body(self, day: str, owner: str, app: str, rng: random.Random | None = None) -> dict:
        """Report v3 (review N1): the app, the day, the device's coarse context and one randomized number. No count
        of anything goes out as it is: what the Hub could match against what it serves a device or an app tag
        (reads, conflicts, refusals, errors, usage) is one of the randomized fields."""
        rng = rng or random.SystemRandom()
        field, kept = self._monthly(day, owner, app, rng)
        estimate = {"field": field, "bucket": randomized_response(kept, LDP_EPSILON_REPORT, rng)}
        context = {"class": self.device_class, "arch": arch(),
                   "app_version": self._kv("app_versions", {}).get(f"{owner}\n{app}", "0"), "Suno_version": Suno_version()}
        return {"v": 3, "day": day, "owner": owner, "app": app, "context": context, "estimate": estimate}

    def days_to_schedule(self, now: float | None = None) -> bool:
        return self._kv("reports_through") != today((now if now is not None else time.time()) - 86400)

    def schedule(self, apps, enabled: bool, now: float | None = None) -> int:
        """Every ended day gets one report for every app in ``apps`` (the approved apps installed here with sync
        switched on), whether or not each app ran that day, so a report says nothing about use (review N1). Each is
        due at its own random time in the next 24 hours. With reports off nothing is scheduled and nothing waiting
        goes out; turned on, they start with the next day that ends."""
        now = now if now is not None else time.time()
        yesterday = today(now - 86400)
        oldest = (datetime.fromtimestamp(now, timezone.utc) - timedelta(days=MAX_AGE_DAYS)).strftime("%Y-%m-%d")
        added = 0
        with self.lock:
            self.db.execute("DELETE FROM reports WHERE day<?", (oldest,))
            self.db.execute("DELETE FROM counters WHERE day<?", (oldest,))
            last = self._kv("reports_through")
            self._put_kv("reports_through", yesterday)
            if not enabled:
                self.db.execute("UPDATE reports SET state='skipped' WHERE state='due'")
                return 0
            days, day = [], yesterday
            while day >= oldest and (day > last if last else not days):
                days.append(day)
                day = (datetime.strptime(day, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
            for day in days:
                for owner, app in apps:
                    if not owner.startswith("flatpak:"):
                        continue
                    if self.db.execute("SELECT 1 FROM reports WHERE day=? AND owner=? AND app=?", (day, owner, app)).fetchone():
                        continue
                    self.db.execute("INSERT INTO reports VALUES(?,?,?,?,?,0)",
                                    (day, owner, app, now + random.uniform(60, 86400), "due"))
                    added += 1
        return added

    def due(self, now: float | None = None) -> list[tuple[str, str, str]]:
        """Reports due now. Ones overdue by more than ten minutes (the device slept) each get a new random time over
        the next 24 hours instead of going out together, which would say they come from one device (review M2)."""
        now = now if now is not None else time.time()
        with self.lock:
            late = self.db.execute("SELECT day, owner, app FROM reports WHERE state='due' AND due<?", (now - 600,)).fetchall()
            for day, owner, app in late:
                self.db.execute("UPDATE reports SET due=? WHERE day=? AND owner=? AND app=?",
                                (now + random.uniform(600, 86400), day, owner, app))
            return [tuple(r) for r in self.db.execute("SELECT day, owner, app FROM reports WHERE state='due' AND due<=? ORDER BY due",
                                                      (now,)).fetchall()]

    def next_due(self) -> float | None:
        with self.lock:
            row = self.db.execute("SELECT MIN(due) FROM reports WHERE state='due'").fetchone()
        return row[0] if row and row[0] is not None else None

    def _mark(self, day: str, owner: str, app: str, state: str, retry_in: float = 0) -> None:
        with self.lock:
            if retry_in:
                self.db.execute("UPDATE reports SET due=?, tries=tries+1 WHERE day=? AND owner=? AND app=?",
                                (time.time() + retry_in, day, owner, app))
            else:
                self.db.execute("UPDATE reports SET state=? WHERE day=? AND owner=? AND app=?", (state, day, owner, app))

    # ------------------------------------------------------------ tokens
    def tokens_today(self) -> int:
        with self.lock:
            return int(self.db.execute("SELECT COUNT(*) FROM tokens WHERE day=?", (today(),)).fetchone()[0])

    def fetched_today(self) -> bool:
        with self.lock:
            row = self.db.execute("SELECT value FROM kv WHERE key='tokens_day'").fetchone()
        return bool(row) and json.loads(row[0]) == today()

    def _kv(self, key: str, default=None):
        with self.lock:
            row = self.db.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def _put_kv(self, key: str, value) -> None:
        with self.lock:
            self.db.execute("INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, json.dumps(value)))

    def slot_key(self, snapshot, now_ms: int | None = None) -> dict | None:
        """The token key of the current calendar slot (one per UTC month; review N2), or None: then this device
        sends nothing until the next slot. A Hub serving one device an old registry, or a key of its own, can't
        make that device's reports stand out; it can only silence them.
        - exactly one key in the verified registry names the slot, and it is valid for the whole month;
        - it is the key this device first saw for the slot: a registry naming another one is a split view."""
        if snapshot is None:
            return None
        now = now_ms if now_ms is not None else int(time.time() * 1000)
        slot = slot_of(now)
        named = [k for k in snapshot.tokens.get("keys", []) if k.get("slot") == slot]
        if len(named) != 1:
            return None
        key = named[0]
        if key["not_before"] > month_start_ms(slot) or key["not_after"] < month_start_ms(next_slot(slot)):
            return None
        pinned = self._kv("token_slots", {})
        if pinned.get(slot, key["id"]) != key["id"]:
            log.warning("The app registry names a second token key for %s; no reports this month", slot)
            return None
        if slot not in pinned:
            pinned = {s: k for s, k in pinned.items() if s >= slot_of(now - 100 * 86_400_000)}
            pinned[slot] = key["id"]
            self._put_kv("token_slots", pinned)
        return key

    def fetch_tokens(self, hub, snapshot) -> int:
        """With reports on, ask for exactly 64 tokens a day under the current slot's key and keep those whose
        signatures check out."""
        if snapshot is None or not self.enabled() or self.fetched_today():
            return 0
        entry = self.slot_key(snapshot)
        if entry is None:
            return 0
        key = tk.load_key(entry["spki"])
        kid = bytes.fromhex(entry["id"])
        issuer = snapshot.tokens.get("issuer") or tk.ISSUER
        requests, pending = [], []
        for _ in range(tk.DAILY):
            request, state = tk.blind(key, kid, issuer)
            requests.append(base64.urlsafe_b64encode(request).rstrip(b"=").decode())
            pending.append(state)
        answer = hub.post("metrics/tokens", {"requests": requests})
        if isinstance(answer, dict) and answer.get("collecting") is False:
            self._hub_off()
            return 0
        if answer.get("key_id") != entry["id"] or len(answer.get("responses") or []) != tk.DAILY:
            raise tk.TokenError("the Hub answered under another key, or with the wrong number of signatures")
        kept = []
        for state, response in zip(pending, answer["responses"]):
            raw = base64.urlsafe_b64decode(response + "=" * (-len(response) % 4))
            kept.append(tk.finalize(key, state, raw))       # raises when a signature doesn't verify: keep none
        with self.lock:
            self.db.execute("DELETE FROM tokens WHERE day<>?", (today(),))
            for token in kept:
                self.db.execute("INSERT INTO tokens(day, key_id, token) VALUES(?,?,?)",
                                (today(), entry["id"], base64.urlsafe_b64encode(token).rstrip(b"=").decode()))
            self.db.execute("INSERT INTO kv VALUES('tokens_day',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(today()),))
        return len(kept)

    def _take_token(self, snapshot) -> str | None:
        key = self.slot_key(snapshot)
        valid = {key["id"]} if key else set()         # only the current slot's key: every device uses the same one
        with self.lock:
            self.db.execute("DELETE FROM tokens WHERE day<>?", (today(),))
            row = self.db.execute("SELECT id, key_id, token FROM tokens ORDER BY RANDOM() LIMIT 1").fetchone()
            while row and row[1] not in valid:
                self.db.execute("DELETE FROM tokens WHERE id=?", (row[0],))
                row = self.db.execute("SELECT id, key_id, token FROM tokens ORDER BY RANDOM() LIMIT 1").fetchone()
            if row is None:
                return None
            self.db.execute("DELETE FROM tokens WHERE id=?", (row[0],))
        return row[2]

    def send_one(self, day: str, owner: str, app: str, snapshot) -> str:
        """Send one report on a fresh connection; 'sent', 'dropped', 'later' or 'off'."""
        if snapshot is None or not self.enabled():
            self._mark(day, owner, app, "skipped")
            return "off"
        token = self._take_token(snapshot)
        if token is None:
            self._mark(day, owner, app, "", retry_in=random.uniform(1800, 7200))
            return "later"
        body = json.dumps(self.report_body(day, owner, app), separators=(",", ":")).encode()
        from ..hub import _OPENER, USER_AGENT
        request = Request(self.report_url, data=body, method="POST",
                          headers={"Authorization": f'PrivateToken token="{token}"', "Content-Type": "application/json",
                                   "User-Agent": USER_AGENT, "Connection": "close"})
        try:
            with (self.opener or _OPENER).open(request, timeout=30) as response:
                answer = response.read(1024)
            try:
                collecting = json.loads(answer).get("collecting") if answer else None
            except (ValueError, AttributeError):
                collecting = None
            if collecting is False:
                self._mark(day, owner, app, "skipped")
                self._hub_off()
                return "off"
            self._mark(day, owner, app, "sent")
            return "sent"
        except HTTPError as error:
            if error.code in (400, 401, 404, 409, 413):
                log.info("A usage report for %s was refused (%s)", app, error.code)
                self._mark(day, owner, app, "dropped")
                return "dropped"
            self._mark(day, owner, app, "", retry_in=random.uniform(1800, 7200))
            return "later"
        except (URLError, OSError):
            self._mark(day, owner, app, "", retry_in=random.uniform(1800, 7200))
            return "later"

    def forget(self, owner: str, app: str) -> None:
        with self.lock:
            self.db.execute("DELETE FROM counters WHERE owner=? AND app=?", (owner, app))
            self.db.execute("UPDATE reports SET state='skipped' WHERE owner=? AND app=? AND state='due'", (owner, app))
