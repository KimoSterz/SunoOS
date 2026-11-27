# SPDX-License-Identifier: Apache-2.0
"""The signed app registry (ADR-057 §10.3; connect-sync-apps-hub.md §2).

Every device reads the same public file from dl.simplyluma.com, so nothing
about who uses which app reaches the Hub to check approval. The file is
verified (minisign, prehashed Ed25519, the Suno registry key) before a byte
of it is parsed; a lower version, a version that doesn't match the signed
comment, or an expired file is refused and the previous one kept. Without a
valid, unexpired registry every app is not approved.
"""
from __future__ import annotations

import base64
import binascii
import logging
import os
import stat
import hashlib
import hmac
import json
import random
import re
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from .limits import DEFAULT_LIMITS, LABEL

log = logging.getLogger("Suno-connect-sync")
REGISTRY_URL = "https://dl.simplyluma.com/sync/apps/v1/registry.json"
PUBLIC_KEY_PATH = Path("/usr/share/Suno-connect-sync/registry.pub")
# An administrator's key in /etc replaces the image's (test devices, a private deployment). Only a root-owned file
# that no one else can write counts: a person's or an app's files can never change who approves apps.
ADMIN_KEY_PATH = Path("/etc/Suno-connect-sync/registry.pub")
# The registry as it was when the package was built: names publishers before the device has fetched one
# (fetching waits until the person turns Sync on). Verified like any other; never newer than a fetched one.
SEED_PATH = Path("/usr/share/Suno-connect-sync/registry.json")
MAX_REGISTRY = 8 * 1024 * 1024
REFRESH_SECONDS = 6 * 3600
SLOT = re.compile(r"20[0-9]{2}-(0[1-9]|1[0-2])")      # a token key's calendar month (review N2)
OWNER = re.compile(r"flatpak:[0-9a-f]{32}")
STATES = ("approved", "suspended", "revoked")
LIMIT_FIELDS = tuple(DEFAULT_LIMITS)
ACCOUNT_CAPS = {"record_bytes": 5 * 1000 ** 3, "asset_bytes": 5 * 1000 ** 3, "zones": 256, "records": 10_000_000,
                "transit_bytes": 10 * 1000 ** 3, "relay_bytes_month": 50 * 1000 ** 3,
                # rate limits may only be lowered from §5.2's defaults
                "writes_per_hour": DEFAULT_LIMITS["writes_per_hour"], "upload_bytes_per_hour": DEFAULT_LIMITS["upload_bytes_per_hour"]}


class RegistryError(ValueError):
    pass


def _system_key() -> str:
    """The registry key: a root-owned administrator key in /etc that no one else can write, else the image's.

    Neither may be a symlink (review L2). The override is logged every time it is used.
    """
    try:
        info = os.lstat(ADMIN_KEY_PATH)
        folder = os.lstat(ADMIN_KEY_PATH.parent)
        if stat.S_ISREG(info.st_mode) and stat.S_ISDIR(folder.st_mode) and info.st_uid == 0 and folder.st_uid == 0 \
                and not (info.st_mode | folder.st_mode) & 0o022:
            log.warning("The app registry key is the administrator's (%s), not the image's", ADMIN_KEY_PATH)
            return ADMIN_KEY_PATH.read_text()
    except OSError:
        pass
    info = os.lstat(PUBLIC_KEY_PATH)
    if not stat.S_ISREG(info.st_mode):
        raise OSError("the registry key isn't a regular file")
    return PUBLIC_KEY_PATH.read_text()


# ---------------------------------------------------------------- minisign

def parse_public_key(text: str) -> tuple[bytes, bytes]:
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.startswith("untrusted comment:")]
    if len(lines) != 1:
        raise RegistryError("not a minisign public key")
    raw = _b64(lines[0], 42)
    if raw[:2] != b"Ed":
        raise RegistryError("not an Ed25519 minisign key")
    return raw[2:10], raw[10:]


def _b64(text: str, length: int) -> bytes:
    try:
        raw = base64.b64decode(text.strip(), validate=True)
    except (binascii.Error, ValueError) as error:
        raise RegistryError("bad base64") from error
    if len(raw) != length:
        raise RegistryError("bad length")
    return raw


def verify_minisign(public: tuple[bytes, bytes], message: bytes, signature: bytes) -> str:
    """The authenticated trusted comment, or RegistryError. Only the prehashed form (ED) is accepted."""
    if len(signature) > 4096:
        raise RegistryError("signature too large")
    lines = signature.decode("utf-8", "strict").rstrip("\n").split("\n")
    if len(lines) != 4 or not lines[0].startswith("untrusted comment:") or not lines[2].startswith("trusted comment: "):
        raise RegistryError("not a minisign signature")
    raw = _b64(lines[1], 74)
    if raw[:2] != b"ED":
        raise RegistryError("the registry must be signed prehashed (ED)")
    if not hmac.compare_digest(raw[2:10], public[0]):
        raise RegistryError("signed with another key")
    key = Ed25519PublicKey.from_public_bytes(public[1])
    comment = lines[2][len("trusted comment: "):]
    try:
        key.verify(raw[10:], hashlib.blake2b(message, digest_size=64).digest())
        key.verify(_b64(lines[3], 64), raw[10:] + comment.encode())
    except InvalidSignature as error:
        raise RegistryError("the registry's signature doesn't match") from error
    return comment


# ---------------------------------------------------------------- OpenPGP primary fingerprints

def primary_fingerprint(key: bytes) -> str:
    """The v4 fingerprint of the first public-key packet of a transferable public key (RFC 4880 §12.2)."""
    tag, body = _first_packet(key)
    if tag != 6:
        raise RegistryError("a publisher key doesn't start with a public-key packet")
    if not body or body[0] != 4:
        raise RegistryError("only version 4 OpenPGP keys are accepted")
    return hashlib.sha1(b"\x99" + len(body).to_bytes(2, "big") + body).hexdigest().upper()


def _first_packet(data: bytes) -> tuple[int, bytes]:
    if len(data) < 2 or not data[0] & 0x80:
        raise RegistryError("not an OpenPGP packet")
    first = data[0]
    if first & 0x40:                      # new format
        tag = first & 0x3F
        o = data[1]
        if o < 192:
            length, start = o, 2
        elif o < 224:
            length, start = ((o - 192) << 8) + data[2] + 192, 3
        elif o == 255:
            length, start = int.from_bytes(data[2:6], "big"), 6
        else:
            raise RegistryError("partial-length key packets aren't accepted")
    else:                                 # old format
        tag = (first >> 2) & 0x0F
        kind = first & 0x03
        size = {0: 1, 1: 2, 2: 4}.get(kind)
        if size is None:
            raise RegistryError("indeterminate-length key packets aren't accepted")
        length, start = int.from_bytes(data[1:1 + size], "big"), 1 + size
    if start + length > len(data):
        raise RegistryError("a truncated key packet")
    return tag, data[start:start + length]


def _unb64url(text: str) -> bytes:
    if not isinstance(text, str) or not re.fullmatch(r"[A-Za-z0-9_-]*", text):
        raise RegistryError("not base64url")
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


# ---------------------------------------------------------------- the registry

@dataclass
class Snapshot:
    version: int
    issued_at: int
    expires_at: int
    apps: list[dict]
    tokens: dict
    by_app: dict[str, list[dict]] = field(default_factory=dict)

    def valid(self, now_ms: int | None = None) -> bool:
        return (now_ms if now_ms is not None else int(time.time() * 1000)) < self.expires_at

    def entries_for(self, app: str) -> list[dict]:
        return self.by_app.get(app, [])

    def entry(self, owner: str, app: str) -> dict | None:
        return next((e for e in self.by_app.get(app, []) if e["owner"] == owner), None)

    def all_keyrings(self, exclude_app: str = "") -> bytes:
        return b"".join(e["keyring"] for e in self.apps if e["app"] != exclude_app)

    def token_keys(self, now_ms: int | None = None) -> list[dict]:
        now = now_ms if now_ms is not None else int(time.time() * 1000)
        return [k for k in self.tokens.get("keys", []) if k["not_before"] <= now < k["not_after"]]


def parse(body: bytes) -> Snapshot:
    try:
        data = json.loads(body)
    except ValueError as error:
        raise RegistryError("the registry isn't JSON") from error
    if not isinstance(data, dict) or data.get("schema") != 1:
        raise RegistryError("unknown registry schema")
    for name in ("version", "issued_at", "expires_at"):
        if not isinstance(data.get(name), int) or isinstance(data.get(name), bool) or data[name] < 0:
            raise RegistryError(f"bad {name}")
    if not isinstance(data.get("apps"), list) or not isinstance(data.get("tokens"), dict):
        raise RegistryError("bad apps or tokens")
    # The file is authenticated as a whole; what this device can't read in it is skipped piece by piece, never the
    # file (review M6): one entry a newer Hub writes differently must not stop every revocation reaching the device.
    apps: list[dict] = []
    seen: set[tuple[str, str]] = set()
    skipped = 0
    for raw in data["apps"]:
        if not isinstance(raw, dict):
            skipped += 1
            continue
        owner, app, state = raw.get("owner"), raw.get("app"), raw.get("state")
        if not isinstance(owner, str) or not OWNER.fullmatch(owner) or not isinstance(app, str) or not app or len(app) > 255 \
                or state not in STATES or (owner, app) in seen:
            skipped += 1
            continue
        seen.add((owner, app))
        keyring, fingerprints = b"", set()
        for key in raw.get("keys") or []:
            try:
                material = _unb64url(key)
                if len(material) > 256 * 1024:
                    raise RegistryError("a publisher key is too large")
                fingerprints.add(primary_fingerprint(material))
                keyring += material
            except (RegistryError, ValueError, binascii.Error, IndexError):
                skipped += 1            # a key this device can't use; the entry (a revocation, say) still applies
        labels = raw.get("labels") or []
        labels = [lbl for lbl in labels if isinstance(lbl, str) and LABEL.fullmatch(lbl)] if isinstance(labels, list) else []
        limits = dict(DEFAULT_LIMITS)
        raw_limits = raw.get("limits") if isinstance(raw.get("limits"), dict) else {}
        for name, value in raw_limits.items():
            if name in LIMIT_FIELDS and isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                limits[name] = min(value, ACCOUNT_CAPS[name])
        changed = raw.get("changed_at")
        apps.append({"owner": owner, "app": app, "state": state, "purge": raw.get("purge") is True, "labels": sorted(set(labels)),
                     "limits": limits, "keyring": keyring, "fingerprints": frozenset(fingerprints),
                     "changed_at": changed if isinstance(changed, int) and not isinstance(changed, bool) else 0})
    keys = []
    raw_keys = data["tokens"].get("keys") if isinstance(data["tokens"].get("keys"), list) else []
    for raw in raw_keys:
        try:
            spki = _unb64url(raw["spki"])
            if hashlib.sha256(spki).hexdigest() != raw["id"]:
                raise RegistryError("a token key id doesn't match its key")
            slot = raw.get("slot")
            keys.append({"id": raw["id"], "spki": spki, "not_before": int(raw["not_before"]), "not_after": int(raw["not_after"]),
                         "slot": slot if isinstance(slot, str) and SLOT.fullmatch(slot) else None})
        except (KeyError, TypeError, ValueError, RegistryError):
            skipped += 1
    if skipped:
        log.warning("The app registry has %d entries or keys this device can't read; they are skipped", skipped)
    tokens = {"issuer": str(data["tokens"].get("issuer") or ""), "keys": keys}
    snapshot = Snapshot(data["version"], data["issued_at"], data["expires_at"], apps, tokens)
    for entry in apps:
        snapshot.by_app.setdefault(entry["app"], []).append(entry)
    return snapshot


class Registry:
    """The device's view: the newest verified registry, kept across restarts, refreshed every 6 h or on a hint."""

    def __init__(self, folder: Path, public_key: str | None = None, url: str = REGISTRY_URL, opener=None,
                 seed: Path | None = SEED_PATH) -> None:
        self.folder = folder
        self.folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.url = url
        self.lock = threading.Lock()
        try:
            self.public = parse_public_key(public_key if public_key is not None else _system_key())
        except (OSError, RegistryError):
            self.public = None            # no key: no registry can be accepted, so nothing is approved
        self.opener = opener
        self.snapshot: Snapshot | None = None
        self.checked_at = 0.0
        self.next_check = 0.0
        self.last_error = ""
        self._load()
        if seed is not None:
            self._seed(seed)

    @property
    def version(self) -> int:
        return self.snapshot.version if self.snapshot else -1

    def _state(self) -> dict:
        """The version floor, for the key it was reached under: another key starts its own floor (review L2). A floor
        is never lower than the registry kept on disk, so a lost or torn state file can't allow a rollback (L3)."""
        try:
            state = json.loads((self.folder / "state.json").read_text())
            if self.public is None or state.get("key") != self.public[0].hex() or not isinstance(state.get("highest"), int):
                state = {}
        except (OSError, ValueError):
            state = {}
        kept = self._kept_version()
        if kept > state.get("highest", -1):
            state = {**state, "highest": kept}
        return state

    def _kept_version(self) -> int:
        """The version of the registry stored here, if it verifies under the current key (else -1)."""
        try:
            body = (self.folder / "registry.json").read_bytes()
            signature = (self.folder / "registry.json.minisig").read_bytes()
            if self.public is None:
                return -1
            comment = verify_minisign(self.public, body, signature)
            return int(comment.split(":", 1)[1]) if comment.startswith("registry:") else -1
        except (OSError, RegistryError, ValueError, UnicodeDecodeError):
            return -1

    def _put_state(self, highest: int) -> None:
        """Written to a temporary file and renamed, so a torn write can never reset the floor (review L3)."""
        tmp = self.folder / ".state.json.tmp"
        with open(tmp, "w") as out:
            out.write(json.dumps({"highest": highest, "key": self.public[0].hex() if self.public else ""}))
            out.flush()
            os.fsync(out.fileno())
        tmp.replace(self.folder / "state.json")

    def _load(self) -> None:
        body, sig = self.folder / "registry.json", self.folder / "registry.json.minisig"
        if not body.is_file() or not sig.is_file() or self.public is None:
            return
        try:
            self.snapshot = self._verify(body.read_bytes(), sig.read_bytes(), floor=self._state().get("highest", -1), allow_equal=True)
        except RegistryError as error:
            self.last_error = str(error)
            self.snapshot = None

    def _seed(self, seed: Path) -> None:
        try:
            body, signature = seed.read_bytes(), seed.with_name(seed.name + ".minisig").read_bytes()
            snapshot = self._verify(body, signature, floor=self._state().get("highest", -1), allow_equal=False)
        except (OSError, RegistryError):
            return
        with self.lock:
            for name, data in (("registry.json", body), ("registry.json.minisig", signature)):
                (self.folder / name).write_bytes(data)
            self._put_state(snapshot.version)
            self.snapshot = snapshot

    def _verify(self, body: bytes, signature: bytes, *, floor: int, allow_equal: bool) -> Snapshot:
        if self.public is None:
            raise RegistryError("no registry key on this device")
        if len(body) > MAX_REGISTRY:
            raise RegistryError("the registry is too large")
        comment = verify_minisign(self.public, body, signature)
        snapshot = parse(body)
        if comment != f"registry:{snapshot.version}":
            raise RegistryError("the signed version doesn't match the registry's")
        if snapshot.version < floor or (snapshot.version == floor and not allow_equal):
            raise RegistryError("an older registry than this device has seen")
        return snapshot

    def accept(self, body: bytes, signature: bytes, now_ms: int | None = None) -> Snapshot:
        """Verify and keep a fetched registry. RegistryError leaves the current one in place."""
        with self.lock:
            highest = self._state().get("highest", -1)
            stored = self.folder / "registry.json"
            same = stored.is_file() and stored.read_bytes() == body
            snapshot = self._verify(body, signature, floor=highest, allow_equal=same)
            if same and self.snapshot is not None:
                return self.snapshot
            if not snapshot.valid(now_ms):
                raise RegistryError("the registry has expired")
            for name, data in (("registry.json", body), ("registry.json.minisig", signature)):
                tmp = self.folder / f".{name}.tmp"
                tmp.write_bytes(data)
                tmp.replace(self.folder / name)
            self._put_state(snapshot.version)
            self.snapshot = snapshot
            return snapshot

    def current(self, now_ms: int | None = None) -> Snapshot | None:
        """The registry approvals are read from: None when there is none or it has expired."""
        snapshot = self.snapshot
        return snapshot if snapshot is not None and snapshot.valid(now_ms) else None

    def due(self, hinted_version: int | None = None) -> bool:
        if hinted_version is not None and hinted_version != self.version:
            return True
        return time.time() >= self.next_check

    def refresh(self) -> bool:
        """Fetch and accept; True when a new registry was taken. Network and signature failures keep the old one."""
        self.checked_at = time.time()
        self.next_check = self.checked_at + REFRESH_SECONDS * random.uniform(0.9, 1.1)
        try:
            body = self._get(self.url, MAX_REGISTRY)
            signature = self._get(self.url + ".minisig", 4096)
        except (OSError, URLError, HTTPError, RegistryError) as error:
            self.last_error = str(error)
            self.next_check = min(self.next_check, time.time() + 900)
            return False
        before = self.version
        try:
            self.accept(body, signature)
        except RegistryError as error:
            self.last_error = str(error)
            return False
        self.last_error = ""
        return self.version != before

    def _get(self, url: str, limit: int) -> bytes:
        from ..hub import _OPENER, USER_AGENT
        request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
        with (self.opener or _OPENER).open(request, timeout=30) as response:
            data = response.read(limit + 1)
        if len(data) > limit:
            raise RegistryError("the registry is too large")
        return data
