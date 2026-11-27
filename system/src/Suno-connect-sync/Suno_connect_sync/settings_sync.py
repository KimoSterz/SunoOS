# SPDX-License-Identifier: Apache-2.0
"""System settings, appearance, wallpaper and keyboard (ADR-054 §2.3, §3).

Only keys in the image's allow-list (``/usr/share/Suno/sync/settings.d/*.toml``)
ever sync. Each key is one record, named ``<schema>/<key>``, holding its value as
typed GVariant text and a hybrid logical clock; the newest clock wins. Keys that
travel between device classes live in a shared zone per category, the others in
a zone per category and class, so a TV never even reads a computer's shortcuts.
A value is checked against this device's own schema (type and range) before it
is written; a schema or key this device lacks is left alone.

Wallpapers are files: an image under the person's home travels as an encrypted
blob and lands in ``~/.local/share/backgrounds/Suno-sync/``; an image the OS
ships travels as its path and is used only if this device has the same file.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import tomllib
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse

log = logging.getLogger("Suno-connect-sync")

CATEGORIES = ("settings", "appearance", "wallpaper", "keyboard")
CLASSES = ("computer", "handheld", "tv")
SYSTEM_DIR = Path("/usr/share/Suno/sync/settings.d")
PACKAGE_DIR = Path(__file__).resolve().parent.parent / "data" / "sync" / "settings.d"
MAX_WALLPAPER = 32 * 1024 * 1024
SHARED_IMAGES = ("/usr/share/", "/usr/local/share/")
WALLPAPER_KEYS = {("org.gnome.desktop.background", "picture-uri"), ("org.gnome.desktop.background", "picture-uri-dark"),
                  ("org.gnome.desktop.screensaver", "picture-uri")}
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".jxl", ".avif", ".svg", ".heic", ".xml"}


@dataclass(frozen=True)
class Entry:
    schema: str
    key: str
    category: str
    across: bool
    classes: tuple[str, ...]

    @property
    def name(self) -> str:
        return f"{self.schema}/{self.key}"

    def zone(self, device_class: str) -> str:
        return f"settings-{self.category}-" + ("shared" if self.across else device_class)


def allow_list(folders: list[Path] | None = None) -> list[dict]:
    """The [[keys]] tables of every allow-list file, the image's first; later files can only add."""
    if folders is None:
        override = os.environ.get("SUNO_SYNC_SETTINGS_DIR")
        folders = [Path(override)] if override else [SYSTEM_DIR if SYSTEM_DIR.is_dir() else PACKAGE_DIR]
    tables: list[dict] = []
    for folder in folders:
        for path in sorted(folder.glob("*.toml")) if folder.is_dir() else []:
            if path.name.startswith("."):
                continue
            try:
                tables += [t for t in tomllib.loads(path.read_text()).get("keys", []) if isinstance(t, dict)]
            except (OSError, ValueError) as error:          # TOMLDecodeError and bad UTF-8 are ValueErrors
                log.warning("Settings allow-list %s skipped: %s", path.name, error)
    return tables


class Backend:
    """GSettings, through GIO: what the person's session uses. Tests swap in a keyfile backend and their own schemas."""

    def __init__(self, schema_dir: Path | None = None, keyfile: Path | None = None) -> None:
        import gi
        gi.require_version("Gio", "2.0")
        from gi.repository import Gio, GLib
        self.Gio, self.GLib = Gio, GLib
        self.source = Gio.SettingsSchemaSource.new_from_directory(str(schema_dir), None, True) if schema_dir \
            else Gio.SettingsSchemaSource.get_default()
        self.store = Gio.keyfile_settings_backend_new(str(keyfile), "/", None) if keyfile else None
        self._settings: dict[str, object] = {}

    def schema(self, schema: str):
        return self.source.lookup(schema, True) if self.source else None

    def keys(self, schema: str) -> list[str]:
        found = self.schema(schema)
        return list(found.list_keys()) if found else []

    def settings(self, schema: str):
        if schema not in self._settings:
            self._settings[schema] = self.Gio.Settings.new_full(self.schema(schema), self.store, None)
        return self._settings[schema]

    def read(self, schema: str, key: str) -> tuple[str, str] | None:
        """(type, value as GVariant text), or None if this device has no such key."""
        found = self.schema(schema)
        if not found or not found.has_key(key):
            return None
        value = self.settings(schema).get_value(key)
        return value.get_type_string(), value.print_(False)

    def write(self, schema: str, key: str, kind: str, text: str) -> bool:
        found = self.schema(schema)
        if not found or not found.has_key(key):
            return False
        expected = found.get_key(key)
        if expected.get_value_type().dup_string() != kind:
            return False                       # the schema differs on this device: leave the key alone
        try:
            value = self.GLib.Variant.parse(self.GLib.VariantType.new(kind), text, None, None)
        except Exception:  # noqa: BLE001 - GLib.Error or a bad string: never written
            return False
        if not expected.range_check(value):
            return False
        settings = self.settings(schema)
        if not settings.is_writable(key):
            return False                       # locked down by the administrator
        settings.set_value(key, value)
        self.Gio.Settings.sync()
        return True


class SystemSettings:
    def __init__(self, engine, local, device: str, device_class: str, backend: Backend | None = None,
                 home: Path | None = None, tables: list[dict] | None = None) -> None:
        self.engine, self.local, self.device, self.device_class = engine, local, device, device_class
        self._backend = backend
        self.home = home or Path.home()
        self._tables = tables

    @property
    def backend(self) -> Backend:
        if self._backend is None:
            self._backend = Backend()
        return self._backend

    # -- what syncs on this device
    def entries(self, categories: set[str] | None = None) -> list[Entry]:
        out: dict[str, Entry] = {}
        for table in self._tables if self._tables is not None else allow_list():
            category, schema = table.get("category"), table.get("schema")
            classes = tuple(c for c in table.get("classes", CLASSES) if c in CLASSES)
            if category not in CATEGORIES or not isinstance(schema, str) or self.device_class not in classes:
                continue
            if categories is not None and category not in categories:
                continue
            keys = table.get("keys", [])
            if keys == ["*"]:
                keys = self.backend.keys(schema)
            for key in keys:
                if isinstance(key, str) and key:
                    entry = Entry(schema, key, category, bool(table.get("across", False)), classes)
                    out.setdefault(entry.name, entry)          # a key is listed once; the first listing decides
        return list(out.values())

    def schemas(self) -> set[str]:
        return {entry.schema for entry in self.entries()}

    def fingerprint(self, categories: set[str]) -> str:
        """Cheap, no Hub request: every synced key's current value here."""
        parts = []
        for entry in sorted(self.entries(categories), key=lambda e: e.name):
            parts.append(f"{entry.name}={self.backend.read(entry.schema, entry.key)}")
        return hashlib.sha256("\n".join(parts).encode()).hexdigest()

    # -- the clock
    def _tick(self, seen: list | None = None) -> list:
        """A hybrid logical clock [wall ms, counter, device]: ahead of this device's last tick and of ``seen``."""
        last = self.local.get("settings_clock", [0, 0])
        known = [last[:2]] + ([seen[:2]] if seen else [])
        wall = max([int(time.time() * 1000)] + [k[0] for k in known])
        counter = max([k[1] + 1 for k in known if k[0] == wall], default=0)
        self.local.put("settings_clock", [wall, counter])
        return [wall, counter, self.device]

    @staticmethod
    def _valid(record) -> bool:
        return (isinstance(record, dict) and isinstance(record.get("t"), str) and isinstance(record.get("c"), list)
                and len(record["c"]) == 3 and isinstance(record["c"][0], int) and isinstance(record["c"][1], int)
                and isinstance(record["c"][2], str) and (isinstance(record.get("v"), str) or isinstance(record.get("file"), dict)))

    # -- wallpapers
    def _wallpaper_out(self, zone: str, text: str) -> dict | None:
        """A picture-uri value as it travels: a blob for the person's own image, the path for one the OS ships."""
        uri = text.strip("'")
        if not uri.startswith("file://"):
            return {"v": text}
        path = Path(unquote(urlparse(uri).path))
        if any(str(path).startswith(prefix) for prefix in SHARED_IMAGES):
            return {"v": text}
        try:
            if path.suffix.lower() not in IMAGE_TYPES or not path.is_file() or path.stat().st_size > MAX_WALLPAPER:
                return None
            data = path.read_bytes()
        except OSError:
            return None
        digest = hashlib.sha256(data).hexdigest()
        sent = self.local.get(f"wallpaper_blob:{zone}:{digest}")
        if not sent:
            blob, _generation = self.engine.put_blob(self.engine.zone(zone)["zone"], data)
            sent = {"blob": blob, "size": len(data)}
            self.local.put(f"wallpaper_blob:{zone}:{digest}", sent)
        return {"file": {"blob": sent["blob"], "sha256": digest, "size": sent["size"], "ext": path.suffix.lower()}}

    def _wallpaper_in(self, zone: str, record: dict) -> str | None:
        """The local GVariant text for a received picture-uri, fetching the image first if needed."""
        if "v" in record:
            uri = record["v"].strip("'")
            if uri.startswith("file://"):
                path = unquote(urlparse(uri).path)
                if not any(path.startswith(prefix) for prefix in SHARED_IMAGES) or not Path(path).is_file():
                    return None                # someone else's path, or an image this device doesn't ship
            return record["v"]
        file = record["file"]
        digest, ext = str(file.get("sha256", "")), str(file.get("ext", ""))
        if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest) or ext not in IMAGE_TYPES:
            return None
        folder = self.home / ".local/share/backgrounds/Suno-sync"
        target = folder / f"{digest[:24]}{ext}"
        if not target.is_file():
            data = self.engine.get_blob(self.engine.zone(zone, create=False)["zone"], str(file["blob"]))
            if len(data) > MAX_WALLPAPER or hashlib.sha256(data).hexdigest() != digest:
                return None
            folder.mkdir(parents=True, exist_ok=True)
            temporary = folder / f".{digest[:24]}.part"
            temporary.write_bytes(data)
            os.replace(temporary, target)
        return "'" + target.as_uri() + "'"

    # -- one pass
    def run(self, categories: set[str]) -> dict[str, int]:
        """Send what changed here, take what is newer elsewhere. Returns counts: sent, applied, skipped."""
        counts = {"sent": 0, "applied": 0, "skipped": 0}
        entries = self.entries(categories)
        zones = sorted({entry.zone(self.device_class) for entry in entries})
        remote: dict[str, dict] = {}
        for zone in zones:
            if self.engine.zone(zone, create=False) is not None:
                self.engine.fetch(zone)
                for name, (_version, value, _writer) in self.engine.all(zone).items():
                    remote[f"{zone}\0{name}"] = value
        outgoing: dict[str, dict[str, tuple]] = {}               # zone -> name -> (entry, value, text, state key)
        for entry in entries:
            zone = entry.zone(self.device_class)
            try:
                result = self._one(entry, zone, remote.get(f"{zone}\0{entry.name}"))
            except (OSError, ValueError) as error:
                log.info("%s: %s", entry.name, error)
                result = "skipped"
            if isinstance(result, tuple):
                outgoing.setdefault(zone, {})[entry.name] = result
            elif result:
                counts[result] += 1
        # What changed here goes in one request per zone (a first turn-on sends every key).
        for zone, items in outgoing.items():
            answers = self.engine.save_many(zone, {name: item[1] for name, item in items.items()})
            for name, (entry, value, text, state_key) in items.items():
                saved, now = answers.get(name, (False, None))
                if not saved and self._valid(now) and now["c"] > value["c"]:
                    result = self._apply(entry, zone, now, value["t"], text, state_key)   # a newer one meanwhile
                    if result:
                        counts[result] += 1
                    continue
                if not saved:
                    saved, _now = self.engine.save(zone, name, value)
                if saved:
                    self.local.put(state_key, {"v": text, "c": value["c"]})
                counts["sent" if saved else "skipped"] += 1     # not saved: tried again at the next cycle
        return counts

    # A value written back within this long of applying another device's, exactly the value that was replaced, is a
    # program putting its old value back (seen: the wallpaper reverted 36 s after an apply), not the person.
    REASSERT_SECONDS = 120

    def _reassert(self, state: dict | None, record, text: str) -> bool:
        """The local value is the one an apply just replaced, while the account still holds what was applied."""
        return bool(state and record is not None and "was" in state and not state.get("reasserted")
                    and state["was"] == text and record["c"] == state.get("c")
                    and 0 <= time.time() - float(state.get("at", 0)) < self.REASSERT_SECONDS)

    def _one(self, entry: Entry, zone: str, record) -> str | tuple | None:
        """One key: "applied", "skipped" or None, or what to send as (entry, value, text, state key)."""
        current = self.backend.read(entry.schema, entry.key)
        if current is None:
            return None
        kind, text = current
        state_key = f"setting:{entry.category}:{entry.name}"
        state = self.local.get(state_key)
        record = record if self._valid(record) else None
        local_changed = state is None or state.get("v") != text
        remote_newer = record is not None and (state is None or record["c"] > state.get("c", [0, 0, ""]))

        if record is not None and remote_newer and (state is None or not local_changed):
            # A device that just joined takes the account's settings; otherwise the newer clock wins.
            return self._apply(entry, zone, record, kind, text, state_key)
        if not local_changed and record is not None:
            return None
        if self._reassert(state, record, text):
            # Once: should the old value come back again, it is the person's and goes out like any change.
            log.info("%s: the value from before %s's change came back %.0f s after it was applied; applied again",
                     entry.name, record["c"][2], time.time() - float(state["at"]))
            result = self._apply(entry, zone, record, kind, text, state_key)
            self.local.put(state_key, {**(self.local.get(state_key) or {}), "reasserted": True})
            return result
        # Changed here (or never sent): send it with a clock newer than anything seen for the key.
        clock = self._tick(record["c"] if record else None)
        body = self._wallpaper_out(zone, text) if (entry.schema, entry.key) in WALLPAPER_KEYS else {"v": text}
        if body is None:
            self.local.put(state_key, {"v": text, "c": clock})
            return "skipped"
        return (entry, {"t": kind, "c": clock, **body}, text, state_key)

    def _apply(self, entry: Entry, zone: str, record: dict, kind: str, text: str, state_key: str) -> str | None:
        if record["t"] != kind:
            self.local.put(state_key, {"v": text, "c": record["c"]})
            return "skipped"                                   # this device's schema has another type
        value = self._wallpaper_in(zone, record) if (entry.schema, entry.key) in WALLPAPER_KEYS else record.get("v")
        if value is not None and value == text:
            self.local.put(state_key, {"v": text, "c": record["c"]})
            return None
        if value is None or not self.backend.write(entry.schema, entry.key, kind, value):
            self.local.put(state_key, {"v": text, "c": record["c"]})
            return "skipped"
        now = self.backend.read(entry.schema, entry.key)
        self.local.put(state_key, {"v": now[1] if now else value, "c": record["c"], "was": text, "at": time.time()})
        return "applied"
