# SPDX-License-Identifier: Apache-2.0
"""Settings, appearance, wallpaper and keyboard between two devices (ADR-054 §3), against the fake Hub,
each device with its own GSettings store (a keyfile) and the same test schemas."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import time
import unittest
import unittest.mock
from pathlib import Path

from test_sync import Base

try:
    import gi
    gi.require_version("Gio", "2.0")
    from gi.repository import Gio  # noqa: F401
except (ImportError, ValueError):
    gi = None

from Suno_connect_sync import settings_sync  # noqa: E402

SCHEMAS = """<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <enum id="test.ColorScheme"><value nick="default" value="0"/><value nick="prefer-dark" value="1"/><value nick="prefer-light" value="2"/></enum>
  <schema id="org.gnome.desktop.interface" path="/org/gnome/desktop/interface/">
    <key name="color-scheme" enum="test.ColorScheme"><default>'default'</default></key>
    <key name="accent-color" type="s"><default>'blue'</default></key>
    <key name="clock-format" type="s"><choices><choice value="24h"/><choice value="12h"/></choices><default>'24h'</default></key>
    <key name="text-scaling-factor" type="d"><range min="0.5" max="3.0"/><default>1.0</default></key>
    <key name="enable-hot-corners" type="b"><default>true</default></key>
  </schema>
  <schema id="org.gnome.desktop.background" path="/org/gnome/desktop/background/">
    <key name="picture-uri" type="s"><default>'file:///usr/share/backgrounds/Suno/default.jxl'</default></key>
  </schema>
  <schema id="org.gnome.desktop.input-sources" path="/org/gnome/desktop/input-sources/">
    <key name="sources" type="a(ss)"><default>[('xkb', 'us')]</default></key>
    <key name="xkb-options" type="as"><default>[]</default></key>
  </schema>
  <schema id="org.gnome.desktop.wm.keybindings" path="/org/gnome/desktop/wm/keybindings/">
    <key name="close" type="as"><default>['&lt;Super&gt;q']</default></key>
    <key name="minimize" type="as"><default>['&lt;Super&gt;h']</default></key>
  </schema>
  <schema id="org.example.machine" path="/org/example/machine/">
    <key name="display-scale" type="d"><default>1.0</default></key>
  </schema>
</schemalist>
"""

TABLES = [
    {"category": "appearance", "across": True, "schema": "org.gnome.desktop.interface", "keys": ["color-scheme", "accent-color"]},
    {"category": "appearance", "schema": "org.gnome.desktop.interface", "keys": ["text-scaling-factor"]},
    {"category": "settings", "across": True, "schema": "org.gnome.desktop.interface", "keys": ["clock-format"]},
    {"category": "settings", "classes": ["computer"], "schema": "org.gnome.desktop.interface", "keys": ["enable-hot-corners"]},
    {"category": "wallpaper", "across": True, "classes": ["computer", "handheld"], "schema": "org.gnome.desktop.background", "keys": ["picture-uri"]},
    {"category": "keyboard", "across": True, "schema": "org.gnome.desktop.input-sources", "keys": ["sources"]},
    {"category": "keyboard", "classes": ["computer"], "schema": "org.gnome.desktop.wm.keybindings", "keys": ["*"]},
    {"category": "settings", "schema": "org.example.missing", "keys": ["anything"]},
]
EVERYTHING = set(settings_sync.CATEGORIES)


@unittest.skipIf(gi is None or not shutil.which("glib-compile-schemas"), "needs PyGObject and glib-compile-schemas")
class SettingsSyncTests(Base):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schemas = Path(tempfile.mkdtemp(prefix="lcs-schemas-"))
        (cls.schemas / "test.gschema.xml").write_text(SCHEMAS)
        subprocess.run(["glib-compile-schemas", str(cls.schemas)], check=True)

    @classmethod
    def tearDownClass(cls) -> None:
        shutil.rmtree(cls.schemas, ignore_errors=True)

    def setUp(self) -> None:
        super().setUp()
        self.a, self.b = self.device("Desktop"), self.device("Laptop")
        pending = self.a.account.begin_setup()
        self.a.account.setup(pending.entropy)
        self.joined(self.a, self.b)
        self.sa = self.system(self.a, "computer")
        self.sb = self.system(self.b, "computer")

    def system(self, device, device_class: str, home: Path | None = None) -> settings_sync.SystemSettings:
        home = home or device.root / "home"
        backend = settings_sync.Backend(self.schemas, device.root / f"gsettings-{device_class}.ini")
        return settings_sync.SystemSettings(device.engine, device.local, device.name, device_class, backend=backend, home=home, tables=TABLES)

    @staticmethod
    def get(system, schema: str, key: str) -> str:
        return system.backend.read(schema, key)[1]

    @staticmethod
    def put(system, schema: str, key: str, kind: str, text: str) -> None:
        assert system.backend.write(schema, key, kind, text), (schema, key, text)

    def test_a_change_follows_and_a_joining_device_takes_the_accounts_settings(self) -> None:
        self.put(self.sa, "org.gnome.desktop.interface", "color-scheme", "s", "'prefer-dark'")
        self.put(self.sa, "org.gnome.desktop.interface", "accent-color", "s", "'teal'")
        self.put(self.sb, "org.gnome.desktop.interface", "clock-format", "s", "'12h'")   # b's own, before it ever synced
        sent = self.sa.run(EVERYTHING)
        self.assertGreaterEqual(sent["sent"], 4)
        self.sb.run(EVERYTHING)
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.interface", "color-scheme"), "'prefer-dark'")
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.interface", "accent-color"), "'teal'")
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.interface", "clock-format"), "'24h'", "the account's value wins on join")
        # Then a change on b goes back to a, and nothing echoes.
        self.put(self.sb, "org.gnome.desktop.interface", "text-scaling-factor", "d", "1.25")
        self.assertEqual(self.sb.run(EVERYTHING)["sent"], 1)
        self.assertEqual(self.sa.run(EVERYTHING), {"sent": 0, "applied": 1, "skipped": 0})
        self.assertEqual(self.get(self.sa, "org.gnome.desktop.interface", "text-scaling-factor"), "1.25")
        self.assertEqual(self.sa.run(EVERYTHING), {"sent": 0, "applied": 0, "skipped": 0})
        self.assertEqual(self.sb.run(EVERYTHING), {"sent": 0, "applied": 0, "skipped": 0})

    def test_newest_change_wins(self) -> None:
        self.sa.run(EVERYTHING)
        self.sb.run(EVERYTHING)
        self.put(self.sa, "org.gnome.desktop.interface", "accent-color", "s", "'red'")
        self.put(self.sb, "org.gnome.desktop.interface", "accent-color", "s", "'green'")
        self.sa.run(EVERYTHING)                     # a sends first
        self.sb.run(EVERYTHING)                     # b's change is seen later: its clock is newer
        self.sa.run(EVERYTHING)
        self.assertEqual(self.get(self.sa, "org.gnome.desktop.interface", "accent-color"), "'green'")
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.interface", "accent-color"), "'green'")

    def test_an_old_value_put_back_right_after_an_apply_doesnt_win(self) -> None:
        """Seen on two devices: a's wallpaper arrived on b, something on b wrote b's old one back 36 s later, and b's
        clock then beat a's. The old value coming back once, soon after, is applied over; a second time it is b's."""
        key = ("org.gnome.desktop.interface", "accent-color")
        self.put(self.sb, *key, "s", "'blue'")
        self.sb.run(EVERYTHING)
        self.sa.run(EVERYTHING)
        self.put(self.sa, *key, "s", "'purple'")
        self.sa.run(EVERYTHING)
        self.assertEqual(self.sb.run(EVERYTHING)["applied"], 1)
        self.assertEqual(self.get(self.sb, *key), "'purple'")
        self.put(self.sb, *key, "s", "'blue'")                     # a program puts b's old value back
        self.assertEqual(self.sb.run(EVERYTHING), {"sent": 0, "applied": 1, "skipped": 0})
        self.assertEqual(self.get(self.sb, *key), "'purple'", "the applied value stays")
        self.sa.run(EVERYTHING)
        self.assertEqual(self.get(self.sa, *key), "'purple'", "and the account keeps a's")
        self.put(self.sb, *key, "s", "'blue'")                     # again: now it is the person's choice
        self.assertEqual(self.sb.run(EVERYTHING)["sent"], 1)
        self.sa.run(EVERYTHING)
        self.assertEqual(self.get(self.sa, *key), "'blue'")

    def test_an_old_value_chosen_later_is_a_change(self) -> None:
        key = ("org.gnome.desktop.interface", "accent-color")
        self.put(self.sb, *key, "s", "'blue'")
        self.sb.run(EVERYTHING)
        self.sa.run(EVERYTHING)
        self.put(self.sa, *key, "s", "'purple'")
        self.sa.run(EVERYTHING)
        self.sb.run(EVERYTHING)
        self.put(self.sb, *key, "s", "'blue'")
        with unittest.mock.patch.object(settings_sync.time, "time", return_value=time.time() + self.sb.REASSERT_SECONDS + 1):
            self.assertEqual(self.sb.run(EVERYTHING)["sent"], 1, "minutes later it is the person's change")

    def test_category_switches_and_classes(self) -> None:
        self.put(self.sa, "org.gnome.desktop.interface", "enable-hot-corners", "b", "false")
        self.put(self.sa, "org.gnome.desktop.wm.keybindings", "close", "as", "['<Alt>F4']")
        self.put(self.sa, "org.gnome.desktop.interface", "accent-color", "s", "'pink'")
        self.sa.run(EVERYTHING)
        handheld = self.device("Phone")
        self.joined(self.a, handheld)
        phone = self.system(handheld, "handheld")
        phone.run(EVERYTHING)
        self.assertEqual(self.get(phone, "org.gnome.desktop.interface", "accent-color"), "'pink'", "accent goes everywhere")
        self.assertEqual(self.get(phone, "org.gnome.desktop.interface", "enable-hot-corners"), "true", "computer-only stays")
        self.assertEqual(self.get(phone, "org.gnome.desktop.wm.keybindings", "close"), "['<Super>q']")
        self.sb.run({"appearance"})                 # b has Keyboard and Settings off
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.wm.keybindings", "close"), "['<Super>q']")
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.interface", "accent-color"), "'pink'")
        self.sb.run(EVERYTHING)
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.wm.keybindings", "close"), "['<Alt>F4']", "every key of a '*' schema")
        self.assertNotIn("org.example.machine/display-scale", {e.name for e in self.sa.entries()}, "only listed keys")

    def test_values_are_checked_against_this_devices_schema(self) -> None:
        zone = "settings-appearance-computer"
        self.a.engine.save(zone, "org.gnome.desktop.interface/text-scaling-factor", {"t": "d", "c": [2**50, 0, "x"], "v": "9.0"})
        self.a.engine.save("settings-settings-shared", "org.gnome.desktop.interface/clock-format", {"t": "s", "c": [2**50, 0, "x"], "v": "'48h'"})
        self.a.engine.save("settings-keyboard-shared", "org.gnome.desktop.input-sources/sources", {"t": "s", "c": [2**50, 0, "x"], "v": "'us'"})
        counts = self.sb.run(EVERYTHING)
        self.assertGreaterEqual(counts["skipped"], 3)
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.interface", "text-scaling-factor"), "1.0", "out of range")
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.interface", "clock-format"), "'24h'", "not a choice")
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.input-sources", "sources"), "[('xkb', 'us')]", "wrong type")

    def test_wallpaper_from_home_travels_as_a_blob_and_a_foreign_path_never_applies(self) -> None:
        image = self.a.root / "home/Pictures/beach.jpg"
        image.parent.mkdir(parents=True)
        image.write_bytes(b"\xff\xd8\xff" + b"beach" * 1000)
        self.put(self.sa, "org.gnome.desktop.background", "picture-uri", "s", "'" + image.as_uri() + "'")
        self.sa.run(EVERYTHING)
        self.sb.run(EVERYTHING)
        uri = self.get(self.sb, "org.gnome.desktop.background", "picture-uri").strip("'")
        landed = Path(uri.removeprefix("file://"))
        self.assertTrue(str(landed).startswith(str(self.b.root / "home/.local/share/backgrounds/Suno-sync/")), uri)
        self.assertEqual(landed.read_bytes(), image.read_bytes())
        # A record naming a path in someone's home is never applied as is.
        self.a.engine.save("settings-wallpaper-shared", "org.gnome.desktop.background/picture-uri",
                           {"t": "s", "c": [2**50, 0, "x"], "v": "'file:///home/someone/secret.jpg'"})
        self.sb.run(EVERYTHING)
        self.assertEqual(self.get(self.sb, "org.gnome.desktop.background", "picture-uri").strip("'"), uri)

    def test_the_image_allow_list_parses_and_lists_no_machine_keys(self) -> None:
        tables = settings_sync.allow_list([Path(__file__).resolve().parent.parent / "data/sync/settings.d"])
        self.assertGreater(len(tables), 10)
        listed = {(t["schema"], k) for t in tables for k in t["keys"]}
        for schema, _key in listed:
            self.assertFalse(any(word in schema for word in ("power", "peripherals.touchpad", "peripherals.mouse", "sound", "display")),
                             schema)
        for table in tables:
            self.assertIn(table["category"], settings_sync.CATEGORIES)
        self.assertTrue(all(not t.get("across") or t["category"] != "keyboard" or t["keys"] == ["sources"] for t in tables),
                        "only layouts cross classes")


if __name__ == "__main__":
    unittest.main()
