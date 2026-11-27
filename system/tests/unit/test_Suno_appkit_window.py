# SPDX-License-Identifier: Apache-2.0
"""The SunoUI window frame keeps v70's measured treatment (W).

Source-level checks, so they run anywhere: the numbers are tokens, the
controls are the kit's own Lucide ones, legacy CSD rules stand aside for
SunoUI windows, and AppWindow's title-row slots exist.
"""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APPKIT = ROOT / "src/Suno-platform/appkit"


def _read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


class WindowFrameTokens(unittest.TestCase):
    def test_v70_frame_metrics_are_tokens(self) -> None:
        window = json.loads(_read("config/shared/design-tokens.json"))["SunoUI"]["window"]
        expected = {"radius": 20, "title_height": 46, "title_padding_start": 14, "title_padding_end": 10,
                    "identity_gap": 9, "identity_icon": 22, "control_size": 30, "control_radius": 9,
                    "control_gap": 2, "control_icon": 14, "gutter": 8, "island_radius": 12}
        for key, value in expected.items():
            self.assertEqual(window[key], value, key)

    def test_window_colours_exist_in_every_family(self) -> None:
        colours = json.loads(_read("config/shared/design-tokens.json"))["SunoUI"]["colors"]
        names = ("window_control_hover", "window_close_hover", "window_ring", "window_shadow_far", "window_rim")
        for family in ("light", "dark", "high_contrast"):
            for name in names:
                self.assertIn(name, colours[family], f"{family}.{name}")
        for sheet in ("Suno-appkit-tokens.css", "Suno-appkit-dark-tokens.css", "Suno-appkit-frost-tokens.css",
                      "Suno-appkit-high-contrast-tokens.css"):
            self.assertIn("@define-color Suno_window_ring", (APPKIT / sheet).read_text(encoding="utf-8"), sheet)


class WindowFrameSheet(unittest.TestCase):
    def setUp(self) -> None:
        self.sheet = (APPKIT / "SunoUI-toolkit.css").read_text(encoding="utf-8")

    def test_legacy_csd_rules_skip_SunoUI_windows(self) -> None:
        for line in self.sheet.splitlines():
            if re.match(r"\s*window\.csd(?![\w-])", line):
                self.assertIn(":not(.Suno-app-window)", line, line)

    def test_frame_reads_tokens(self) -> None:
        block = self.sheet[self.sheet.index("The SunoUI window, v70 (W"):]
        for var in ("--SunoUI-window-radius", "--SunoUI-window-title-height", "--SunoUI-window-control-size",
                    "--SunoUI-window-control-radius", "--SunoUI-window-focus-ring-width"):
            self.assertIn(f"var({var})", block, var)
        self.assertNotRegex(block, r"#[0-9a-fA-F]{3,8}\b|rgba?\(", "no literal colours in the frame")

    def test_frame_sidebar_moves_the_bottom_gutter_to_the_island(self) -> None:
        self.assertRegex(self.sheet, r"\.Suno-window-body\.SunoUI-frame-sidebar \{\s*padding-left: 0;\s*padding-bottom: 0;")
        self.assertIn(".Suno-window-body.SunoUI-frame-sidebar .Suno-island:not(.compact)", self.sheet)


class WindowFrameWidgets(unittest.TestCase):
    def test_controls_are_the_kits_lucide_glyphs(self) -> None:
        frame = _read("src/Suno-platform/appkit/Suno_appkit/window_frame.py")
        for glyph, label, action in (("minus", "Minimize", "window.minimize"),
                                     ("maximize-2", "Zoom", "window.toggle-maximized"),
                                     ("x", "Close", "window.close")):
            self.assertIn(f'("{glyph}", "{label}", "{action}")', frame)
        self.assertIn("set_show_end_title_buttons(False)", frame)
        self.assertIn('f"{self.name} menu"', frame)

    def test_app_window_offers_title_row_slots_and_icon_fallback(self) -> None:
        widgets = _read("src/Suno-platform/appkit/Suno_appkit/widgets.py")
        for method in ("def set_leading(", "def set_title_content(", "def set_trailing("):
            self.assertIn(method, widgets)
        self.assertRegex(widgets, r"icon_name=icon_name,\s*icon=identity_icon\)")
        self.assertIn("WINDOW['controls_hide_max_width']", widgets)
        self.assertNotIn("def do_size_allocate(self, width: int, height: int, baseline: int) -> None:\n        Adw.ApplicationWindow", widgets)


if __name__ == "__main__":
    unittest.main()
