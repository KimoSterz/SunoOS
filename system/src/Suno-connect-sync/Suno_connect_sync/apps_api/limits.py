# SPDX-License-Identifier: Apache-2.0
"""Caps, quotas and rate limits of the apps API (ADR-057 §5).

Every cap is checked before any work, and every refusal is typed: an app
learns which limit it hit, and the daily report counts it by name.
"""
from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass, field

LABEL = re.compile(r"[a-z0-9][a-z0-9._-]{0,31}")
MAX_NAME = 255
MAX_VALUE = 256 * 1024
MAX_RECORDS_PER_CALL = 100
MAX_ASSETS_PER_RECORD = 32
MAX_INLINE_ASSET = 64 * 1024 * 1024
MAX_ON_DEMAND_ASSET = 16 * 1000 ** 3
MAX_ASSET_NAME = 255
MAX_VERSIONS = 4                      # the current version and up to three siblings
MAX_LEASE_SECONDS = 3600
MAX_LEASES = 64
OUTBOX_CAP = 64 * 1000 ** 2
MAX_LIST = 500
VERSION_ID = re.compile(r"[0-9a-f]{32}")

# Per app per account (§5.1); the registry may lower them, or raise them up to the account-wide caps.
DEFAULT_LIMITS = {"record_bytes": 100 * 1000 ** 2, "asset_bytes": 1000 ** 3, "zones": 16, "records": 100_000,
                  "transit_bytes": 2 * 1000 ** 3, "relay_bytes_month": 10 * 1000 ** 3,
                  "writes_per_hour": 120, "upload_bytes_per_hour": 20 * 1000 ** 2}
RATE_LIMITS = ("writes_per_hour", "upload_bytes_per_hour")     # per app per device; a reviewer may only lower them
APPS_TOTAL_BYTES = 5 * 1000 ** 3        # all apps together: half of the account's 10 GB

# Rate limits (§5.2): (per hour, burst).
ALL_WRITES = (300, 2500)
ALL_BYTES = (25 * 1000 ** 2, 1000 ** 3)
APP_WRITES = (120, 600)
APP_BYTES = (20 * 1000 ** 2, 256 * 1000 ** 2)
CALLS_PER_MINUTE = 600
IN_FLIGHT = 4
CALL_DEADLINE = 10.0                   # seconds for any call
COPY_DEADLINE = 120.0                  # seconds to copy one inline asset into the spool
REREQUESTS_PER_DAY = 3
MAX_HELD_PER_APP = 32 * 1000 ** 3      # on-demand bytes one app may keep on this device (review L1)
OPEN_BYTES = (4 * 1024 ** 3, 4 * 1024 ** 3)   # bytes of private asset copies handed to one app, per hour and burst (M9)
OPEN_COPIES = (1024 ** 3, 64)          # bytes and number of copies one app may hold open at once; one always fits (N9)
MAX_QUEUED_CALLS = 16                  # calls one app may have waiting or running in the service (review M7)

# The names the report uses (connect-sync-apps-hub.md §6).
REFUSALS = ("record_bytes", "asset_bytes", "zones", "records", "outbox_bytes", "transit_bytes", "relay_bytes_month",
            "apps_total", "rate_writes", "rate_bytes", "rate_calls", "in_flight", "leases", "rerequests", "held_bytes",
            "open_bytes")
ERRORS = ("invalid", "too_large", "bad_descriptor", "timed_out", "not_found", "refused", "quota", "rate_limited", "failed")


class ApiError(Exception):
    """A typed refusal. ``kind`` is the D-Bus error suffix and the report's error kind; ``limit`` names a limit."""

    KINDS = {"invalid": "Invalid", "too_large": "TooLarge", "bad_descriptor": "BadDescriptor", "timed_out": "TimedOut",
             "not_found": "NotFound", "refused": "Refused", "quota": "Quota", "rate_limited": "RateLimited",
             "failed": "Failed", "not_supported": "NotSupported"}

    def __init__(self, kind: str, message: str, limit: str = "") -> None:
        super().__init__(message)
        assert kind in self.KINDS, kind
        self.kind, self.limit = kind, limit


def check_label(label: object) -> str:
    if not isinstance(label, str) or not LABEL.fullmatch(label):
        raise ApiError("invalid", "A zone label is 1 to 32 of a-z, 0-9, '.', '_' and '-', starting with a letter or digit.")
    return label


def check_name(name: object) -> str:
    """A record or asset name: UTF-8, 1 to 255 bytes, no control characters (those are the service's own)."""
    if not isinstance(name, str) or not name:
        raise ApiError("invalid", "A name can't be empty.")
    try:
        size = len(name.encode("utf-8", "strict"))
    except UnicodeEncodeError:
        raise ApiError("invalid", "A name must be UTF-8.") from None
    if size > MAX_NAME:
        raise ApiError("too_large", "A name is at most 255 bytes.")
    if any(ord(ch) < 0x20 or ord(ch) == 0x7f for ch in name):
        raise ApiError("invalid", "A name can't contain control characters.")
    return name


def check_value(value: object) -> bytes:
    if not isinstance(value, (bytes, bytearray)):
        raise ApiError("invalid", "A value is bytes.")
    if len(value) > MAX_VALUE:
        raise ApiError("too_large", "A value is at most 256 KiB.")
    return bytes(value)


def check_base(base: object) -> str:
    """A version id, or "" for a record that shouldn't exist yet."""
    if base == "":
        return ""
    if not isinstance(base, str) or not VERSION_ID.fullmatch(base):
        raise ApiError("invalid", "That isn't a version this service gave out.")
    return base


@dataclass
class Bucket:
    """A token bucket: ``rate`` units an hour, up to ``burst``."""

    rate: float
    burst: float
    level: float = -1.0
    at: float = field(default_factory=time.monotonic)

    def __post_init__(self) -> None:
        if self.level < 0:
            self.level = self.burst

    def _fill(self, now: float) -> None:
        self.level = min(self.burst, self.level + (now - self.at) * self.rate / 3600.0)
        self.at = now

    def available(self, now: float | None = None) -> float:
        self._fill(now if now is not None else time.monotonic())
        return self.level

    def take(self, amount: float, now: float | None = None) -> bool:
        self._fill(now if now is not None else time.monotonic())
        if amount > self.level:
            return False
        self.level -= amount
        return True

    def take_large(self, amount: float, now: float | None = None) -> bool:
        """Like take, but an amount larger than the burst, which take could never let through, passes when the
        bucket is full. It is charged its size as debt, at most one burst below zero, so what follows waits."""
        self._fill(now if now is not None else time.monotonic())
        if amount <= self.level:
            self.level -= amount
            return True
        if amount > self.burst and self.level >= self.burst:
            self.level = max(-self.burst, self.level - amount)
            return True
        return False

    def state(self) -> list[float]:
        return [self.level, time.time() - (time.monotonic() - self.at)]

    @classmethod
    def restore(cls, rate: float, burst: float, saved: list | None) -> "Bucket":
        bucket = cls(rate, burst)
        if saved and len(saved) == 2:
            bucket.level = min(burst, max(0.0, float(saved[0])))
            bucket.at = time.monotonic() - max(0.0, time.time() - float(saved[1]))
        return bucket


class CallGate:
    """Per app: at most 600 calls a minute and 16 waiting or running (4 of them run at once, on the app's own workers),
    checked before any work on the call, the caller's identity included (§5.2, review M7). Over either, refused at once."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.in_flight: dict[str, int] = {}
        self.minute: dict[str, Bucket] = {}

    def enter(self, app_key: str) -> None:
        with self.lock:
            bucket = self.minute.setdefault(app_key, Bucket(CALLS_PER_MINUTE * 60, CALLS_PER_MINUTE))
            if self.in_flight.get(app_key, 0) >= MAX_QUEUED_CALLS:
                raise ApiError("rate_limited", "Too many calls waiting; wait for one to answer.", "in_flight")
            if not bucket.take(1):
                raise ApiError("rate_limited", "Too many calls this minute.", "rate_calls")
            self.in_flight[app_key] = self.in_flight.get(app_key, 0) + 1

    def leave(self, app_key: str) -> None:
        with self.lock:
            self.in_flight[app_key] = max(0, self.in_flight.get(app_key, 0) - 1)


class SendBudget:
    """Hub writes and upload bytes per hour: all apps together, and each app (§5.2).

    While several apps have work, each gets an equal share of what all apps may still send.
    """

    def __init__(self, saved: dict | None = None) -> None:
        saved = saved or {}
        self.all_writes = Bucket.restore(*ALL_WRITES, saved.get("all_writes"))
        self.all_bytes = Bucket.restore(*ALL_BYTES, saved.get("all_bytes"))
        self.apps: dict[str, tuple[Bucket, Bucket]] = {
            key: (Bucket.restore(*APP_WRITES, value[0]), Bucket.restore(*APP_BYTES, value[1]))
            for key, value in (saved.get("apps") or {}).items()}

    def _app(self, key: str, limits: dict | None = None) -> tuple[Bucket, Bucket]:
        """The app's buckets, at the rates its registry entry allows (never above §5.2's): a lowered limit applies at once."""
        if key not in self.apps:
            self.apps[key] = (Bucket(*APP_WRITES), Bucket(*APP_BYTES))
        if limits:
            writes, size = self.apps[key]
            w_rate = min(APP_WRITES[0], max(0, int(limits.get("writes_per_hour", APP_WRITES[0]))))
            b_rate = min(APP_BYTES[0], max(0, int(limits.get("upload_bytes_per_hour", APP_BYTES[0]))))
            for bucket, rate, (default_rate, default_burst) in ((writes, w_rate, APP_WRITES), (size, b_rate, APP_BYTES)):
                bucket.available()
                bucket.rate = rate
                bucket.burst = default_burst * rate / default_rate
                bucket.level = min(bucket.level, bucket.burst)
        return self.apps[key]

    def share(self, key: str, busy: int, limits: dict | None = None) -> tuple[float, float]:
        """(writes, bytes) this app may send now, given ``busy`` apps with work."""
        writes, size = self._app(key, limits)
        busy = max(1, busy)
        return (min(writes.available(), self.all_writes.available() / busy),
                min(size.available(), self.all_bytes.available() / busy))

    def spend(self, key: str, writes: int, size: int) -> None:
        app_writes, app_bytes = self._app(key)
        for bucket, amount in ((app_writes, writes), (app_bytes, size), (self.all_writes, writes), (self.all_bytes, size)):
            bucket.available()
            bucket.level = max(0.0, bucket.level - amount)

    def state(self) -> dict:
        return {"all_writes": self.all_writes.state(), "all_bytes": self.all_bytes.state(),
                "apps": {key: [w.state(), b.state()] for key, (w, b) in self.apps.items()}}
