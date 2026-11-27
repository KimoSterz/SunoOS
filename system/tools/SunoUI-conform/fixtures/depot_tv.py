# SPDX-License-Identifier: Apache-2.0
"""SunoUI-conform fixture: Depot (src/Suno-depot) in TV posture with synthetic state, no services.

Run by the conform harness as `bin/run --module depot_tv` (scenario tv-depot) with
SUNO_POSTURE=tv; SUNO_CONFORM_DEPOT_STATE picks what the Design Center's TV mockup
(mockups/Suno-tv-depot.html) shows: discover, apps, games, updates, search, app (Tide).

The apps mirror the mockup's TV catalogue (apps/depot/catalogue.js): the same names,
developers, summaries, versions and sizes, every one installed (Depot on a TV lists the
installed apps for now), Kodi with an update waiting. Their TV facts are the mockup's.
Nothing here reads this machine's catalogue, installation or update agent.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

os.environ.setdefault("SUNO_POSTURE", "tv")
os.environ.setdefault("SUNO_DEPOT_PREVIEW", "1")
import gi  # noqa: E402

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
gi.require_version("Gdk", "4.0")
from gi.repository import Adw, Gdk, Gio, GLib, Gtk  # noqa: E402

from Suno_depot import preview, simulated_install, tv_facts, window as W  # noqa: E402
from Suno_depot.providers import (App, Catalogue, InstalledApp, Permission, Release, Result,  # noqa: E402
                                  Screenshot)
from Suno_installer import depot_app_history  # noqa: E402
from Suno_installer.depot_system_update import SystemUpdate  # noqa: E402

#: The mockup's TV catalogue, its tiles, marks and Tide's screenshots (tests/fixtures/tv/depot).
DATA = Path(os.environ.get("SUNO_CONFORM_DEPOT_DATA") or
            Path(__file__).resolve().parents[3] / "tests/fixtures/tv/depot")
MOCK = json.loads((DATA / "catalogue.json").read_text(encoding="utf-8"))
#: The Suno apps' application ids (their `-tv` tiles and icons are in DATA/icons).
SUNO_IDS = {"tide": "org.projectSuno.Tide", "photos": "org.projectSuno.Photos", "youtube": "org.projectSuno.YouTube",
            "weather": "org.projectSuno.Weather"}
CATEGORIES = {"media": "Media", "play": "Play", "tools": "Tools", "work": "Work", "create": "Create"}
UPDATES = {"kodi": "21.3"}
KEYWORDS = {app_id: tuple(name for name, ids in MOCK["switching"] if app_id in ids) for app_id in
            (entry["id"] for entry in MOCK["apps"])}
MARKS = Path(tempfile.mkdtemp(prefix="depot-tv-marks-"))


def _megabytes(text: str) -> int:
    number, unit = text.split()
    return int(float(number) * (1_000_000_000 if unit == "GB" else 1_000_000))


def _mark(entry: dict) -> str:
    """The brand mark in its colour (the mockup masks it with `fg`, white by default)."""
    mark = entry["mark"]
    svg = (DATA / "marks" / f"{mark['file']}.svg").read_text(encoding="utf-8")
    target = MARKS / f"{mark['file']}.svg"
    target.write_text(svg.replace("<svg ", f'<svg fill="{mark.get("fg", "#fff")}" ', 1), encoding="utf-8")
    return str(target)


def _app(entry: dict) -> App:
    key, Suno = entry["id"], entry.get("dev") == "Suno"
    shots = tuple(Screenshot(f"file://{DATA / 'shots' / (name + '.webp')}") for name in entry.get("shots", ())
                  if (DATA / "shots" / f"{name}.webp").is_file())
    news = entry.get("news")
    notes = "\n".join(news["items"]) if news else ""
    rating = entry.get("rating") or {}
    return App("catalog:" + key, entry["name"], entry["summary"], description="\n\n".join(entry.get("desc", ())),
               developer=entry.get("dev", ""), categories=(CATEGORIES[entry["cat"]],), slug=key,
               tier="Suno" if Suno else "listed", developer_verified="organization" if entry.get("verified") else "",
               installed_bytes=_megabytes(entry["size"]) if entry.get("size") else 0,
               rating=rating.get("avg", 0.0), rating_count=rating.get("n", 0), screenshots=shots,
               releases=(Release(entry["version"], description=notes if news and news["v"] == entry["version"] else ""),),
               permissions=tuple(Permission(icon, title, why) for icon, title, why in entry.get("reach", ())),
               flatpak_id=SUNO_IDS.get(key, ""), source_title="Suno" if Suno else "Flathub", featured=key == "tide")


APPS = tuple(_app(entry) for entry in MOCK["apps"])
ENTRIES = {entry["id"]: entry for entry in MOCK["apps"]}
CATALOGUE = Catalogue(APPS, (), next(app for app in APPS if app.slug == "tide"))
INSTALLED = tuple(InstalledApp(app.app_id, app.version, app.installed_bytes, update_version=UPDATES.get(app.slug, ""),
                               update_commit="b" if app.slug in UPDATES else "", commit="a", app=app, managed=True)
                  for app in APPS)
INPUT = {"tide": "remote", "weather": "remote", "photos": "remote", "youtube": "remote", "kodi": "remote",
         "vlc": "remote", "spotify": "remote", "steam": "controller", "heroic": "controller",
         "moonlight": "controller", "supertux": "controller", "ari": "keyboard", "discord": "keyboard"}

preview.PreviewCatalogue.load_catalogue = lambda self, callback, cancellable=None: GLib.idle_add(
    lambda: callback(Result(CATALOGUE)) and False)
simulated_install.SimulatedInstallationProvider.installed = lambda self, callback, cancellable=None, **_k: \
    GLib.idle_add(lambda: callback(Result(INSTALLED)) and False)


def _tv_app(app, *, record=None):
    entry = ENTRIES.get(app.slug)
    if entry is None or app.slug not in INPUT:
        return None
    if entry.get("mark"):
        icon, brand = Gio.FileIcon.new(Gio.File.new_for_path(_mark(entry))), entry["mark"]["bg"]
    elif app.slug in SUNO_IDS and app.slug == "tide":
        icon, brand = Gio.ThemedIcon.new(SUNO_IDS[app.slug]), ""
    else:
        icon, brand = None, ""
    return tv_facts.TvApp(app, tv_facts.TvFacts(True, INPUT[app.slug], "catalogue"), None, KEYWORDS.get(app.slug, ()),
                          brand, entry["cat"] == "play", icon)


tv_facts.tv_app = _tv_app
tv_facts.catalogue_entry = lambda app: None


def _at(day: int) -> int:
    return int(datetime(2026, 10, day, 9, 0).timestamp())


HISTORY = depot_app_history.History(entries=[
    depot_app_history.Entry("catalog:discord", "Discord", "1.0.158", "1.0.159", _at(20)),
    depot_app_history.Entry("catalog:spotify", "Spotify", "1.2.47", "1.2.48", _at(18)),
    depot_app_history.Entry("catalog:tide", "Tide", "1.0.3", "1.0.4", _at(18) - 60),
])
SYSTEM = SimpleNamespace(state=SystemUpdate(service=True, available_version="1.0.20261022",
                                            available_name=MOCK["system"]["name"],
                                            available_summary=MOCK["system"]["blurb"],
                                            download_bytes=_megabytes(MOCK["system"]["size"])),
                         refresh=lambda: None, _read=lambda: None)


def build(app: Adw.Application) -> None:
    from Suno_appkit import install_appkit, install_SunoUI
    install_appkit()
    install_SunoUI()
    W._install_depot_style()
    Gtk.IconTheme.get_for_display(Gdk.Display.get_default()).add_search_path(str(DATA / "icons"))
    window = W.DepotWindow(app)
    window.system = SYSTEM
    window._history = lambda: HISTORY
    window.set_default_size(1920, 1080)
    window.present()
    state = os.environ.get("SUNO_CONFORM_DEPOT_STATE", "discover")

    def go() -> bool:
        tv = window.tv
        if tv is None:
            return GLib.SOURCE_CONTINUE
        if state == "app":
            tv.open_app(next(i for i in tv.items if i.app.slug == "tide"))
        elif state == "search":
            tv._enter_page("search")
            tv._field.set_value("itunes")
        elif state != "discover":
            tv.focus.focus(next(t for t in tv.tabs if t.tv_key == "tab:" + state))
        return GLib.SOURCE_REMOVE
    GLib.timeout_add(600, go)


def main() -> int:
    app = Adw.Application(application_id="org.projectSuno.Depot", flags=Gio.ApplicationFlags.NON_UNIQUE)
    app.connect("activate", build)
    return app.run(sys.argv[:1])


if __name__ == "__main__":
    raise SystemExit(main())
