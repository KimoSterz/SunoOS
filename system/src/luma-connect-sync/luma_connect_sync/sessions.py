# SPDX-License-Identifier: Apache-2.0
"""Continue (ADR-055 §5): this device's session for the account's other devices.

The shell keeps the session snapshot in $XDG_STATE_HOME/luma/session/current.json
(patches/gnome-shell 0392). Each device keeps one record, named by its device
ID, in the ``continue`` zone. Besides the zone key (which every member holds),
the snapshot is sealed again under a fresh content key that is HPKE-wrapped to
each eligible member's X25519 key from the signed member list: Computers and
Handhelds, never a TV or a removed device. A TV holding the account sync key
still can't read a session.

Record (JSON, in the zone):
    {"v": 1, "device": ID, "taken": unix, "expires": unix, "nonce": b64,
     "sealed": b64 | null, "blob": id | null, "size": n,
     "keys": {device: b64(HPKE(content key))}}

A snapshot under 128 KB sits in the record; a larger one is a zone blob.
"""

import base64
import json
import logging
import os
import threading
import time
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PublicKey

from . import sodium
from .crypto import SUITE, CryptoError, b64, lp, unb64
from .handoff import LEAVING
from .hub import Offline

log = logging.getLogger(__name__)

ZONE = "continue"
FORMAT = 1
TTL = 72 * 3600
INLINE_MAX = 128 * 1024
ELIGIBLE = {"computer", "handheld"}
#: A TV gets only what was playing (ADR-055 §6): the media app, the item and
#: where it was. Never a window, a document, another app's title or a sign-in.
TV = "tv"
MEDIA_FIELDS = {"app": 255, "name": 128, "item": 256, "subtitle": 256, "kind": 16}
#: The item's artwork for the TV home's backdrop: a small JPEG the shell made
#: from the player's own art, base64 in the snapshot.
ART_MAX = 96 * 1024


def snapshot_path() -> Path:
    state = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local" / "state")
    return state / "luma" / "session" / "current.json"


def _info(account: str, writer: str, reader: str, taken: int) -> bytes:
    return lp("luma-continue-key-v1", account, writer, reader, taken)


def _aad(account: str, writer: str, taken: int) -> bytes:
    return lp("luma-continue-v1", account, writer, taken)


def _setting(key: str, default: bool = True) -> bool:
    try:
        from gi.repository import Gio
        source = Gio.SettingsSchemaSource.get_default()
        if source is None or source.lookup("org.projectluma.session", True) is None:
            return default
        return Gio.Settings(schema_id="org.projectluma.session").get_boolean(key)
    except Exception:  # noqa: BLE001 - no GSettings: the default
        return default


def _tv_info(account: str, writer: str, reader: str, taken: int) -> bytes:
    return lp("luma-continue-tv-key-v1", account, writer, reader, taken)


def _tv_aad(account: str, writer: str, taken: int) -> bytes:
    return lp("luma-continue-tv-v1", account, writer, taken)


def media_for_tv(media) -> dict | None:
    """What a TV may get of the snapshot's media: a media app with a TV
    presentation, the item and its position; anything else is dropped."""
    if not isinstance(media, dict) or media.get("tv") is not True:
        return None
    out = {}
    for field, limit in MEDIA_FIELDS.items():
        value = media.get(field)
        if isinstance(value, str) and value.strip():
            out[field] = value.strip()[:limit]
    if not out.get("app", "").endswith(".desktop") or not out.get("item"):
        return None
    for field in ("position", "length"):
        value = media.get(field)
        if isinstance(value, (int, float)) and 0 <= value < 7 * 24 * 3600:
            out[field] = int(value)
    if out.get("kind") not in (None, "video", "audio"):
        out.pop("kind")
    art = art_of(media.get("art"))
    if art:
        out["art"] = art
    return out


def art_of(value) -> str | None:
    """The artwork if it is a JPEG no larger than ART_MAX, else nothing."""
    if not isinstance(value, str) or len(value) > (ART_MAX + 2) // 3 * 4:
        return None
    try:
        data = base64.b64decode(value, validate=True)
    except ValueError:
        return None
    if len(data) > ART_MAX or not data.startswith(b"\xff\xd8\xff") or not data.endswith(b"\xff\xd9"):
        return None
    return value


def seal_tv(media: dict, taken: int, account: str, writer: str, readers: dict[str, bytes]) -> dict:
    """The TV part of a record: the media alone, under its own content key."""
    key = os.urandom(32)
    nonce = os.urandom(24)
    payload = json.dumps({"format": FORMAT, "taken": taken, "media": media}, separators=(",", ":")).encode()
    sealed = sodium.encrypt(key, nonce, payload, _tv_aad(account, writer, taken))
    return {"nonce": b64(nonce), "sealed": b64(sealed),
            "keys": {device: b64(SUITE.encrypt(key, X25519PublicKey.from_public_bytes(pub), _tv_info(account, writer, device, taken)))
                     for device, pub in sorted(readers.items())}}


def unseal_tv(record: dict, account: str, reader: str, private) -> dict:
    part = record.get("tv") or {}
    wrapped = part.get("keys", {}).get(reader)
    if not wrapped:
        raise CryptoError("nothing of this session was shared with this TV")
    taken = int(record["taken"])
    key = SUITE.decrypt(unb64(wrapped), private, _tv_info(account, record["device"], reader, taken))
    payload = json.loads(sodium.decrypt(key, unb64(part["nonce"]), unb64(part["sealed"]), _tv_aad(account, record["device"], taken)))
    if payload.get("taken") != taken:
        raise CryptoError("this TV part does not match its record")
    return payload


def seal(snapshot: dict, account: str, writer: str, readers: dict[str, bytes]) -> tuple[dict, bytes]:
    """The record for ``snapshot`` and the sealed bytes; readers maps device -> X25519 public key."""
    taken = int(snapshot.get("taken") or time.time())
    payload = json.dumps(snapshot, separators=(",", ":")).encode()
    key = os.urandom(32)
    nonce = os.urandom(24)
    sealed = sodium.encrypt(key, nonce, payload, _aad(account, writer, taken))
    keys = {device: b64(SUITE.encrypt(key, X25519PublicKey.from_public_bytes(pub), _info(account, writer, device, taken)))
            for device, pub in sorted(readers.items())}
    record = {"v": FORMAT, "device": writer, "taken": taken,
              "expires": int(snapshot.get("expires") or taken + TTL),
              "nonce": b64(nonce), "sealed": None, "blob": None, "size": len(sealed), "keys": keys}
    return record, sealed


def unseal(record: dict, sealed: bytes, account: str, reader: str, private) -> dict:
    wrapped = record.get("keys", {}).get(reader)
    if not wrapped:
        raise CryptoError("this session was not shared with this device")
    taken = int(record["taken"])
    key = SUITE.decrypt(unb64(wrapped), private, _info(account, record["device"], reader, taken))
    payload = sodium.decrypt(key, unb64(record["nonce"]), sealed, _aad(account, record["device"], taken))
    snapshot = json.loads(payload)
    if snapshot.get("device") and snapshot.get("taken") != taken:
        raise CryptoError("this session does not match its record")
    return snapshot


def document_of(title: str, app_name: str | None) -> str | None:
    """The document a window shows, from its title: "Packing list — Notes" is
    "Packing list"; a title that is only the app's name names no document."""
    text = (title or "").strip()
    name = (app_name or "").strip()
    if name:
        for separator in (" — ", " – ", " - ", " · "):
            if text.endswith(separator + name):
                text = text[: -len(separator + name)].strip()
                break
    if not text or text == name:
        return None
    return text[:120]


def _focus(windows: list, info: dict) -> dict | None:
    """The app that had focus (the topmost window when none did) and its document."""
    if not windows:
        return None
    window = next((w for w in reversed(windows) if w.get("focus") and w.get("app")), None)
    window = window or next((w for w in reversed(windows) if w.get("app")), None)
    if window is None:
        return None
    return {"app": window["app"],
            "document": document_of(window.get("title", ""), info.get(window["app"], {}).get("name"))}


class Sessions:
    def __init__(self, engine, account, local, device: str, devices) -> None:
        self.engine = engine
        self.account = account
        self.local = local
        self.device = device
        self.devices = devices          # callable: the Hub's device list (name, class, state)
        # Whether an empty snapshot may withdraw the session (handoff.Handoff.may_withdraw);
        # without one, only snapshots taken as the person leaves are kept.
        self.may_withdraw = None
        # The cycle, the shell's snapshots, sleep and D-Bus calls all reach the zone.
        self.lock = threading.RLock()
        self.arrived = False            # another device's session came in since take_arrived()

    def _readers(self, eligible=ELIGIBLE) -> dict[str, bytes]:
        classes = {d["device"]: d.get("class", "computer") for d in self.devices() if d.get("state") == "member"}
        members = self.account.members()
        return {device: unb64(keys["box"]) for device, keys in members.items()
                if device != self.device and classes.get(device) in eligible}

    @property
    def is_tv(self) -> bool:
        return getattr(self.account, "device_class", "computer") == TV

    def publish(self, force: bool = False) -> str:
        """Write this device's session for the others. Returns what happened."""
        with self.lock:
            return self._publish(force)

    def _publish(self, force: bool) -> str:
        if not _setting("continue-share"):
            return self.withdraw()
        try:
            snapshot = json.loads(snapshot_path().read_text())
        except (OSError, ValueError):
            return "none"
        taken = int(snapshot.get("taken") or 0)
        if not force and taken <= int(self.local.get("continue_published", 0)):
            return "current"
        if self.is_tv:
            return "none"   # a TV keeps no session for others
        if not snapshot.get("windows"):
            if not self._may_withdraw(snapshot):
                # Locked, asleep, just woken or leaving: the session stays where the person left it.
                log.info("continue: kept the published session (empty %s snapshot)", snapshot.get("reason") or "unnamed")
                return "kept"
            return self.withdraw()
        readers = self._readers()
        media = media_for_tv(snapshot.get("media"))
        tvs = self._readers({TV}) if media else {}
        if not readers and not tvs:
            return "no_readers"
        if isinstance(snapshot.get("media"), dict):
            # The artwork is for a TV's backdrop; computers get the session without it.
            snapshot["media"] = {k: v for k, v in snapshot["media"].items() if k != "art"}
        record, sealed = seal(snapshot, self.account.account, self.device, readers)
        if tvs:
            record["tv"] = seal_tv(media, int(record["taken"]), self.account.account, self.device, tvs)
        if len(sealed) <= INLINE_MAX:
            record["sealed"] = b64(sealed)
        else:
            record["blob"], _size = self.engine.put_blob(self.engine.zone(ZONE)["zone"], sealed)
        self._fetch()
        saved, _current = self.engine.save(ZONE, self.device, record)
        if not saved:
            # Our own record moved on another path; write over it with the newer session.
            self._fetch()
            self.engine.save(ZONE, self.device, record)
        self.local.put("continue_published", taken)
        log.info("continue: published %d windows for %d devices", len(snapshot.get("windows", [])), len(readers))
        return "published"

    def _fetch(self) -> None:
        for name, value, _writer in self.engine.fetch(ZONE):
            if name != self.device and value:
                self.arrived = True

    def refresh(self) -> None:
        """Bring the other devices' sessions here (a Hub change woke the cycle)."""
        with self.lock:
            self._fetch()

    def take_arrived(self) -> bool:
        with self.lock:
            arrived, self.arrived = self.arrived, False
            return arrived

    def _may_withdraw(self, snapshot: dict) -> bool:
        if snapshot.get("reason") in LEAVING:
            return False
        return self.may_withdraw is None or bool(self.may_withdraw(snapshot))

    def withdraw(self) -> str:
        with self.lock:
            self._fetch()
            version, value = self.engine.get(ZONE, self.device)
            if value:
                self.engine.save(ZONE, self.device, None)
                self.local.put("continue_published", 0)
                log.info("continue: withdrew this device's session")
                return "withdrawn"
            return "none"

    def _records(self, fetch: bool = True) -> list[dict]:
        if fetch:
            self._fetch()
        now = time.time()
        try:
            members = set(self.account.members())
        except Offline:
            if fetch:
                raise
            # Offline: the members this device last counted (Account.members keeps them).
            members = set(self.local.get("known_members", {}).get("members", []))
        out = []
        for name, (_version, value, _writer) in self.engine.all(ZONE).items():
            if not isinstance(value, dict) or value.get("v") != FORMAT:
                continue
            writer = value.get("device")
            if writer == self.device or writer not in members or name != writer:
                continue
            keys = (value.get("tv") or {}).get("keys", {}) if self.is_tv else value.get("keys", {})
            if int(value.get("expires", 0)) < now or self.device not in keys:
                continue
            out.append(value)
        return sorted(out, key=lambda r: -int(r["taken"]))

    def _open(self, record: dict) -> dict:
        sealed = unb64(record["sealed"]) if record.get("sealed") else self.engine.get_blob(self.engine.zone(ZONE)["zone"], record["blob"])
        return unseal(record, sealed, self.account.account, self.device, self.account.keys().box)

    def offer(self, fetch: bool = True) -> dict | None:
        """The newest other device's session, as the offer shows it, or None.
        On a TV: what was playing there, for the home's hero ({tv: true, media}).
        fetch=False answers from the records this device already holds."""
        with self.lock:
            return self._offer(fetch)

    def _offer(self, fetch: bool) -> dict | None:
        names = self._names(fetch)
        if self.is_tv:
            return self._tv_offer(names, fetch)
        for record in self._records(fetch):
            if str(record["taken"]) in self.local.get("continue_declined", []):
                continue
            try:
                snapshot = self._open(record)
            except Offline:
                if fetch:
                    raise
                continue        # a large session in a blob waits for the network
            except (CryptoError, ValueError, KeyError) as error:
                log.warning("continue: a session from %s could not be opened: %s", record.get("device"), error)
                continue
            apps = []
            for window in reversed(snapshot.get("windows", [])):
                if window.get("app") and window["app"] not in apps:
                    apps.append(window["app"])
            info = {a["app"]: a for a in snapshot.get("apps", []) if a.get("app")}
            return {"id": f"{record['device']}:{record['taken']}", "device": record["device"],
                    "name": names.get(record["device"]) or snapshot.get("deviceName", ""),
                    "taken": record["taken"], "expires": record["expires"],
                    "windows": len(snapshot.get("windows", [])), "apps": apps,
                    "continuedFrom": snapshot.get("continuedFrom"),
                    # Each app's name and icon as the other device knew them.
                    "appInfo": {a["app"]: {"name": a.get("name"), "icon": a.get("icon")}
                                for a in snapshot.get("apps", []) if a.get("app")},
                    # A phone or tablet offers the app that had focus, with its document.
                    "focus": _focus(snapshot.get("windows", []), info),
                    # A computer in TV posture shows only this, in the TV home's hero.
                    "media": media_for_tv(snapshot.get("media"))}
        return None

    def _names(self, fetch: bool) -> dict:
        try:
            return {d["device"]: d["name"] for d in self.devices()}
        except Offline:
            if fetch:
                raise
            return {}           # offline: the snapshot's own device name

    def _tv_offer(self, names: dict, fetch: bool = True) -> dict | None:
        for record in self._records(fetch):
            if str(record["taken"]) in self.local.get("continue_declined", []):
                continue
            try:
                part = unseal_tv(record, self.account.account, self.device, self.account.keys().box)
            except (CryptoError, ValueError, KeyError) as error:
                log.warning("continue: what played on %s could not be opened: %s", record.get("device"), error)
                continue
            media = media_for_tv(dict(part.get("media") or {}, tv=True))
            if media is None:
                continue
            return {"id": f"{record['device']}:{record['taken']}", "device": record["device"],
                    "name": names.get(record["device"], ""), "taken": record["taken"],
                    "expires": record["expires"], "tv": True, "media": media}
        return None

    def take(self, offer_id: str) -> dict:
        """The full snapshot of an offer, named as this account knows the device.
        On a TV, only the offer's media."""
        with self.lock:
            return self._take(offer_id)

    def _take(self, offer_id: str) -> dict:
        device, _, taken = offer_id.partition(":")
        names = {d["device"]: d["name"] for d in self.devices()}
        if self.is_tv:
            offer = self._tv_offer(names)
            if offer and offer["id"] == offer_id:
                return {"tv": True, "media": offer["media"], "deviceName": offer["name"], "device": device}
            raise KeyError(offer_id)
        for record in self._records():
            if record["device"] == device and str(record["taken"]) == taken:
                snapshot = self._open(record)
                snapshot["deviceName"] = names.get(device) or snapshot.get("deviceName", "")
                snapshot["device"] = device
                return snapshot
        raise KeyError(offer_id)

    def decline(self, offer_id: str) -> None:
        declined = self.local.get("continue_declined", [])
        declined = (declined + [offer_id.partition(":")[2]])[-20:]
        self.local.put("continue_declined", declined)

    def clear(self) -> None:
        """Settings › Saved windows › Clear: the local snapshot and this device's record."""
        for path in (snapshot_path(), snapshot_path().with_name("previous.json")):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        self.withdraw()
