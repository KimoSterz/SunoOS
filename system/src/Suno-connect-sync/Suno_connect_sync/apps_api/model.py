# SPDX-License-Identifier: Apache-2.0
"""Records, versions and keep-both (ADR-057 §3.3, §3.5). Pure functions, no I/O.

A record on the Hub is one sealed value holding every live version of it:
``{"k": 1, "vs": [version, …]}``, at most four versions. A version is

    {"i": id (32 hex), "v": value (b64), "w": writer device, "t": HLC ms, "c": HLC counter,
     "a": {asset name: asset}, "x": [ids it supersedes], "r": resolving device (optional)}

The current version is the newest by hybrid logical clock, ties broken by id;
the others are siblings. A write names the version it was made over (its
base). Over the current version it supersedes it; over anything else it is
kept beside it (keep-both). ``x`` carries what a version supersedes, so two
devices merging their sets never bring back a version one of them replaced.
"""
from __future__ import annotations

import base64
import re
import secrets
import threading
import time
from dataclasses import dataclass, field

from .limits import MAX_VERSIONS

FORMAT = 1
CLOCK_AHEAD_MS = 60_000           # a version can't claim a time more than this ahead of the Hub's receive time


def new_id() -> str:
    return secrets.token_hex(16)


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


class HLC:
    """A hybrid logical clock (Kulkarni et al.): wall milliseconds plus a counter, never behind what it has seen."""

    def __init__(self, saved: list | None = None, wall=lambda: int(time.time() * 1000)) -> None:
        self.lock = threading.Lock()
        self.wall = wall
        self.l, self.c = (int(saved[0]), int(saved[1])) if saved else (0, 0)

    def now(self) -> tuple[int, int]:
        with self.lock:
            pt = self.wall()
            if pt > self.l:
                self.l, self.c = pt, 0
            else:
                self.c += 1
            return self.l, self.c

    def observe(self, t: int, c: int) -> None:
        with self.lock:
            pt = self.wall()
            top = max(self.l, t, pt)
            if top == self.l == t:
                self.c = max(self.c, c) + 1
            elif top == self.l:
                self.c += 1
            elif top == t:
                self.c = c + 1
            else:
                self.c = 0
            self.l = top

    def state(self) -> list[int]:
        return [self.l, self.c]


def key(version: dict) -> tuple[int, int, str]:
    return int(version.get("t", 0)), int(version.get("c", 0)), str(version.get("i", ""))


def current(versions: list[dict]) -> dict | None:
    return max(versions, key=key) if versions else None


def siblings(versions: list[dict]) -> list[dict]:
    top = current(versions)
    return sorted((v for v in versions if v is not top), key=key, reverse=True)


def version(value: bytes, writer: str, clock: tuple[int, int], *, supersedes=(), assets: dict | None = None,
            resolved_by: str = "", version_id: str | None = None) -> dict:
    out = {"i": version_id or new_id(), "v": b64(value), "w": writer, "t": clock[0], "c": clock[1],
           "a": dict(assets or {}), "x": sorted(set(supersedes))}
    if resolved_by:
        out["r"] = resolved_by
    return out


def merge(hub: list[dict], new: list[dict]) -> list[dict]:
    """The Hub's versions plus this device's new ones, without any version some version supersedes."""
    by_id: dict[str, dict] = {}
    for item in [*hub, *new]:
        by_id[item["i"]] = item
    gone = {old for item in by_id.values() for old in item.get("x", [])}
    return [item for item in by_id.values() if item["i"] not in gone]


def clamp(versions: list[dict], received_ms: int) -> list[dict]:
    """No version claims a time more than 60 s after the Hub received the record (§3.5)."""
    if not received_ms:
        return versions
    out = []
    for item in versions:
        if int(item.get("t", 0)) > received_ms + CLOCK_AHEAD_MS:
            item = {**item, "t": received_ms}
        out.append(item)
    return out


@dataclass
class Decision:
    """What a write does to a record's versions."""

    outcome: str                      # saved, kept_both, conflict, too_many_siblings
    versions: list[dict] = field(default_factory=list)   # the record's versions after it (unchanged unless saved/kept_both)
    new: dict | None = None


def decide_put(view: list[dict], base: str, new: dict, *, fail_on_conflict: bool) -> Decision:
    """A write of ``new`` over ``base`` against the versions this device sees (§3.5).

    ``new["x"]`` already names what the write supersedes because of earlier
    writes of this device not yet sent; the base is added when it is live.
    """
    top = current(view)
    live = {v["i"] for v in view}
    if (top is None and base == "") or (top is not None and base == top["i"]):
        new = {**new, "x": sorted(set(new.get("x", [])) | ({base} if base else set()))}
        after = merge(view, [new])
        if len(after) > MAX_VERSIONS:
            return Decision("too_many_siblings", view)
        return Decision("saved", after, new)
    if fail_on_conflict:
        return Decision("conflict", view)
    new = {**new, "x": sorted(set(new.get("x", [])) | ({base} if base in live else set()))}
    after = merge(view, [new])
    if len(after) > MAX_VERSIONS:
        return Decision("too_many_siblings", view)
    return Decision("kept_both", after, new)


def decide_delete(view: list[dict], base: str) -> Decision:
    """A delete wins only over the current version, and then clears the siblings too (§3.5)."""
    top = current(view)
    if top is None:
        return Decision("saved", [])
    if base != top["i"]:
        return Decision("conflict", view)
    return Decision("saved", [])


def decide_resolve(view: list[dict], keep: str, resolver: str) -> Decision:
    """The person chose ``keep``: its content under a new id, with its writer and time, superseding every version."""
    chosen = next((v for v in view if v["i"] == keep), None)
    if chosen is None:
        return Decision("conflict", view)
    new = {**chosen, "i": new_id(), "x": sorted({v["i"] for v in view} | set(chosen.get("x", []))), "r": resolver}
    return Decision("saved", [new], new)


def drain_put(hub: list[dict], new: dict) -> Decision:
    """A queued write leaving: always keep-both against whatever the Hub has now (§3.5); five versions hold it."""
    after = merge(hub, [new])
    if len(after) > MAX_VERSIONS:
        return Decision("too_many_siblings", hub)
    top = current(hub)
    outcome = "saved" if top is None or top["i"] in new.get("x", []) else "kept_both"
    return Decision(outcome, after, new)


def drain_delete(hub: list[dict], base: str, supersedes=()) -> Decision:
    """A queued delete leaving: dropped unless what it deleted is still current on the Hub.

    ``supersedes`` are the Hub versions this device's unsent writes had replaced before the delete, so a delete
    of a version that never left still applies to the Hub version beneath it.
    """
    top = current(hub)
    if top is None:
        return Decision("saved", [])
    if top["i"] != base and top["i"] not in set(supersedes):
        return Decision("conflict", hub)
    return Decision("saved", [])


def record_body(versions: list[dict]) -> dict:
    return {"k": FORMAT, "vs": versions}


HEX32 = re.compile(r"[0-9a-f]{32}")
HEX64 = re.compile(r"[0-9a-f]{64}")
DEVICE = re.compile(r"[A-Za-z0-9._-]{1,64}")
B64URL = re.compile(r"[A-Za-z0-9_-]*")
MAX_PIECES = 16_384                # 16 GB in 1 MiB pieces


def _int(value, top: int) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= top


def valid_asset(name: object, entry: object) -> bool:
    """An asset entry from another device: every field checked, so nothing in it can become a path or a surprise (review H2)."""
    from .limits import ApiError, MAX_ON_DEMAND_ASSET, check_name
    try:
        check_name(name)
    except ApiError:
        return False
    if not isinstance(entry, dict) or not isinstance(entry.get("id"), str) or not HEX32.fullmatch(entry["id"]):
        return False
    if not _int(entry.get("s"), MAX_ON_DEMAND_ASSET) or not isinstance(entry.get("h"), str) or not HEX64.fullmatch(entry["h"]):
        return False
    salt = entry.get("salt")
    if not isinstance(salt, str) or not B64URL.fullmatch(salt) or len(salt) != 22:
        return False
    if not isinstance(entry.get("o", False), bool):
        return False
    pieces = entry.get("p")
    if pieces is not None and (not isinstance(pieces, list) or len(pieces) > MAX_PIECES
                               or not all(isinstance(x, str) and HEX64.fullmatch(x) for x in pieces)):
        return False
    fillers = entry.get("f", [])
    if not isinstance(fillers, list) or len(fillers) > MAX_PIECES or not all(isinstance(x, str) and HEX64.fullmatch(x) for x in fillers):
        return False
    holder = entry.get("d")
    return holder is None or (isinstance(holder, str) and bool(DEVICE.fullmatch(holder)))


def valid_version(item: object) -> bool:
    if not isinstance(item, dict) or not isinstance(item.get("i"), str) or not HEX32.fullmatch(item["i"]):
        return False
    if not isinstance(item.get("v"), str) or len(item["v"]) > 400_000 or not B64URL.fullmatch(item["v"]):
        return False
    if not isinstance(item.get("w"), str) or (item["w"] and not DEVICE.fullmatch(item["w"])):
        return False
    if not _int(item.get("t"), 1 << 53) or not _int(item.get("c"), 1 << 53):
        return False
    supersedes = item.get("x", [])
    if not isinstance(supersedes, list) or len(supersedes) > 64 or not all(isinstance(x, str) and HEX32.fullmatch(x) for x in supersedes):
        return False
    if "r" in item and not (isinstance(item["r"], str) and DEVICE.fullmatch(item["r"])):
        return False
    assets = item.get("a", {})
    return isinstance(assets, dict) and len(assets) <= 32 and all(valid_asset(n, e) for n, e in assets.items())


def parse_record(value: object) -> list[dict]:
    """The versions in a record value; a version that isn't exactly well formed is dropped (review H2), and anything
    that isn't an app record at all raises ValueError (a forged or broken record is ignored)."""
    if not isinstance(value, dict) or value.get("k") != FORMAT or not isinstance(value.get("vs"), list):
        raise ValueError("not an app record")
    versions = value["vs"]
    if len(versions) > MAX_VERSIONS:
        raise ValueError("too many versions")
    out, seen = [], set()
    for item in versions:
        if valid_version(item) and item["i"] not in seen:
            seen.add(item["i"])
            out.append(item)
    return out


def lease_body(holder: str, until: int, clock: tuple[int, int]) -> dict:
    return {"k": "lease", "h": holder, "u": until, "t": clock[0], "c": clock[1]}


def parse_lease(value: object) -> dict:
    if not isinstance(value, dict) or value.get("k") != "lease" or not isinstance(value.get("h"), str) \
            or not isinstance(value.get("u"), int) or not isinstance(value.get("t"), int):
        raise ValueError("not a lease")
    return value
