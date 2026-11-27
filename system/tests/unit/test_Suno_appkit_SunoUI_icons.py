# SPDX-License-Identifier: Apache-2.0
"""SunoUI glyphs: imported intact, and never named without being imported.

The kit, the gallery and the applications name Lucide glyphs by their Lucide
name (`icon="trash-2"`, `SunoUI_icon("share-2")`, `icons.image("copy")`) or
by the theme name (`"SunoUI-copy-symbolic"`). Each must exist as
assets/icon-theme/Prairie/symbolic/actions/SunoUI-<name>-symbolic.svg, or
GTK draws the missing-image placeholder at run time.
"""
from __future__ import annotations

import ast
import importlib.util
import io
import re
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ACTIONS = ROOT / "assets/icon-theme/Prairie/symbolic/actions"
KIT = ROOT / "src/Suno-platform/appkit/Suno_appkit"
# Part families (Suno-appkit-<family>.css) keep their modules as <family>_*.py.
FAMILY_PREFIXES = tuple(f"{p.name[len('Suno-appkit-'):-len('.css')]}_"
                        for p in (ROOT / "src/Suno-platform/appkit").glob("Suno-appkit-*.css")
                        if re.fullmatch(r"Suno-appkit-[a-z][a-z0-9_]*\.css", p.name)
                        and p.name[len("Suno-appkit-"):-len(".css")] not in ("base", "tokens", "dark", "frost", "glass")) + (
    "rows_", "bar_", "media_", "image_", "chart_", "data_", "creative_")
# SunoUI's own modules and the gallery, where a bare Lucide name means a SunoUI
# glyph; applications, where only the explicit SunoUI spellings do.
SUNOUI_SOURCES = [*(p for p in KIT.glob("*.py") if p.stem in ("SunoUI", "icons") or
                    p.stem.startswith(("structure_", "action_", "content_", *FAMILY_PREFIXES))),
                  *(ROOT / "src/Suno-platform/tools/SunoUI-gallery").glob("*.py")]
APP_SOURCES = [*(ROOT / "src/prairie-core/prairie_apps").glob("*.py"), *(ROOT / "src").rglob("*.css")]
LUCIDE = r"([a-z0-9]+(?:-[a-z0-9]+)*)"
APP_PATTERNS = (
    re.compile(r"""["']SunoUI-""" + LUCIDE + r"""-symbolic["']"""),
    re.compile(r"""\bSunoUI_icon\(\s*["']""" + LUCIDE + r"""["']"""),
    re.compile(r"""-gtk-icontheme\(["']SunoUI-""" + LUCIDE + r"""-symbolic["']\)"""),
)
PATTERNS = (
    re.compile(r"""["']SunoUI-""" + LUCIDE + r"""-symbolic["']"""),
    re.compile(r"""\b(?:SunoUI_icon|icon_name|icons\.image|image)\(\s*["']""" + LUCIDE + r"""["']"""),
    re.compile(r"""\b(?:icon|glyph)\s*=\s*["']""" + LUCIDE + r"""["']"""),
    re.compile(r"""\bStackedButton\(\s*["']""" + LUCIDE + r"""["']"""),
    re.compile(r"""-gtk-icontheme\(["']SunoUI-""" + LUCIDE + r"""-symbolic["']\)"""),
)
# Tuples in the kit and gallery that pair a glyph with a label: ("heart", "love").
TABLE_ENTRY = re.compile(r"""\(\s*["']""" + LUCIDE + r"""["']\s*,\s*["'](?:good|accent|love|muted|warning|danger)["']\s*\)""")


def _available() -> set[str]:
    return {p.name[len("SunoUI-"):-len("-symbolic.svg")] for p in ACTIONS.glob("SunoUI-*-symbolic.svg")}


def _table_glyphs(text: str) -> set[str]:
    parsed = ast.parse(text)
    parents = {child: node for node in ast.walk(parsed) for child in ast.iter_child_nodes(node)}
    names = set()
    for node in ast.walk(parsed):
        # Icon tables contain nested (glyph, tone) pairs. A flat tuple of tone
        # values in a loop or membership check does not name any glyph.
        if not isinstance(node, ast.Tuple) or not isinstance(parents.get(node), (ast.List, ast.Tuple)) or len(node.elts) != 2:
            continue
        first, second = node.elts[:2]
        if isinstance(first, ast.Constant) and isinstance(first.value, str) and isinstance(second, ast.Constant) and second.value in ("good", "accent", "love", "muted", "warning", "danger"):
            names.add(first.value)
    return names


class Icons(unittest.TestCase):
    def test_tone_values_are_not_icon_table_entries(self):
        self.assertEqual(_table_glyphs('tones = ("red", "accent"); icons = [("missing-glyph", "accent")]'), {"missing-glyph"})

    def test_import_is_intact(self):
        spec = importlib.util.spec_from_file_location("imp", ROOT / "assets/icon-theme/tools/import-SunoUI-icons.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            status = module.check()
        self.assertEqual(status, 0, err.getvalue())

    def test_share_export_upload_glyphs(self):
        for name in ("share-2", "share", "upload"):
            self.assertIn(name, _available())

    def test_prairie_and_notes_glyphs(self):
        # Prairie's droplet and Notes' "All notes" notebook (kit-requests notes-01).
        for name in ("droplet", "notebook"):
            self.assertIn(name, _available())

    def test_weather_condition_glyphs(self):
        for name in ("cloud-rain", "cloud-sun", "cloud-moon", "cloud-fog",
                     "cloud-lightning", "snowflake"):
            self.assertIn(name, _available())

    def test_every_named_glyph_exists(self):
        available = _available()
        missing: list[str] = []
        for path in SUNOUI_SOURCES + APP_SOURCES:
            text = path.read_text(encoding="utf-8", errors="ignore")
            names = set()
            SunoUI_source = path in SUNOUI_SOURCES
            for pattern in PATTERNS if SunoUI_source else APP_PATTERNS:
                names |= set(pattern.findall(text))
            if SunoUI_source:
                names |= _table_glyphs(text)
            # Kit and gallery pages list glyphs in their own tables too.
            if "SunoUI-gallery" in str(path):
                # PAGES: (key, title, glyph, family, module); toggles: (key, glyph, Label).
                names |= set(re.findall(r'''\(\s*"[a-z]+",\s*"[^"]+",\s*"([a-z0-9-]+)",\s*"(?:structure|action|content)"''', text))
                names |= set(re.findall(r'''\(\s*"[a-z-]+",\s*"([a-z0-9-]+)",\s*"[A-Z]''', text))
                names |= set(re.findall(r'''_button\("[^"]+",\s*"([a-z0-9-]+)"''', text))
            names.discard("")
            missing += [f"{path.relative_to(ROOT)}: {name}" for name in sorted(names - available)]
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
