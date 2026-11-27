# SPDX-License-Identifier: Apache-2.0
"""SunoUI bar family: its metrics.

The bar family (BarEntry, BarSearch, BarReadout, SplitAction, BarMenu,
ZoomControl, ShareSheet, ExportSheet, DocumentHeader) keeps its tokens in
`config/shared/design-tokens.d/bar.json`; the generator emits them as
`SunoUI_tokens.BAR[group][key]` and `--SunoUI-bar-<group>-<key>`. Its rules
are `Suno-appkit-bar.css`, which the kit loads with the other family sheets.
"""
from __future__ import annotations

import gi

gi.require_version("Gdk", "4.0")
gi.require_version("Gtk", "4.0")
from gi.repository import Gdk, Gtk  # noqa: E402

from . import SunoUI  # noqa: E402
from . import SunoUI_tokens as tokens  # noqa: E402

__all__ = ["BAR", "metric", "install", "Well"]

#: The bar family's metrics: BAR[group][key].
BAR: dict[str, dict[str, float]] = tokens.BAR


def metric(group: str, key: str) -> float:
    return BAR[group][key]


def install(display: Gdk.Display | None = None) -> None:
    """The kit's sheets (the bar family's among them) and icons, once per display."""
    SunoUI.install(display)


class Well(Gtk.Box):
    """A field's well: an `entry` node, so the text area inside belongs to it (the search well, the bar entry)."""

    __gtype_name__ = "SunoUIBarWell"


Well.set_css_name("entry")
