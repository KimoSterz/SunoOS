#!/usr/bin/env python3
"""Pobiera kompletny kod makiety Luma (simframe) z simplyluma.com do repo.

Działa na zwykłym komputerze z internetem (Python 3.8+, tylko biblioteka stdlib):

    python3 tools/fetch_upstream.py

Tworzy/pelni katalog `simframe/` i zapisuje wszystkie pliki makiety
(HTML makiety desktop/tablet/phone, shell.js, shell.css, ikony, fonty,
tapeta, zdjęcia), wypisując SHA-256 każdego pobranego pliku.

Uwaga: ogromny plik luma-next-73.html (~0.7 MB, makieta "Try it yourself"
ze strony glownej) jest pobierany z parametrami podgladu showcase.
"""

import hashlib
import json
import os
import sys
import urllib.request

BASE = "https://simplyluma.com/simframe"
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "simframe")

SHOWCASE_URL = BASE + "/mockups/luma-next-73.html?desktop=1&app=none&showcase=1&zoom=0.7950"

# (url, sciezka_docelowa_wzgedem_simframe/)
FILES = [
    (SHOWCASE_URL, "mockups/luma-next-73.html"),
    (BASE + "/mockups/desktop/shell.js", "mockups/desktop/shell.js"),
    (BASE + "/mockups/desktop/shell.css", "mockups/desktop/shell.css"),
    (BASE + "/mockups/assets/luma-favicon.svg", "mockups/assets/luma-favicon.svg"),
    (BASE + "/icons/_bundle.json", "icons/_bundle.json"),
    (BASE + "/fonts/figtree/figtree.css", "fonts/figtree/figtree.css"),
    (BASE + "/fonts/figtree/figtree-latin.woff2", "fonts/figtree/figtree-latin.woff2"),
    (BASE + "/fonts/figtree/figtree-latin-ext.woff2", "fonts/figtree/figtree-latin-ext.woff2"),
    (BASE + "/fonts/figtree/figtree-italic-latin.woff2", "fonts/figtree/figtree-italic-latin.woff2"),
    (BASE + "/fonts/figtree/figtree-italic-latin-ext.woff2", "fonts/figtree/figtree-italic-latin-ext.woff2"),
    (BASE + "/wallpapers/prism.png", "wallpapers/prism.png"),
]

PHOTOS = [
    "life-ari-street", "life-footer", "life-hero-home", "life-hero-studio",
    "life-hero-writing", "life-professionals-loft", "life-suite-bg-darkroom",
    "life-suite-bg-grid", "life-suite-bg-sessions", "life-suite-bg-stage",
    "life-suite-bg-write", "life-sync-terrace", "life-testimonial",
    "life-work-suite", "pet-sounds",
]

APP_ICONS = [
    "app-store", "ari", "browser", "calculator", "calendar", "camera", "clock",
    "contacts", "daw", "designer", "disks", "documents", "files", "leaf",
    "mail", "maps", "memo", "messages", "monitor", "music", "notes", "phone",
    "photo-editor", "photos", "presentations", "settings", "spreadsheets",
    "tasks", "terminal", "tipsplit", "valet", "video-editor", "viewer",
    "weather",
]

# Ikony aplik z paska makiety (Luma utrzymuje je pod mockups/apps/depot/marks/).
# Sygnaturem sa linki z tresci shell.js; brak pliku = pomijamy z ostrzezeniem.
DEPOT_MARKS = ["discord", "nextcloud", "bitwarden", "signal", "steam"]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (SunoOS mockup vendor)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def save(rel, data):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    sha = hashlib.sha256(data).hexdigest()
    print(f"{sha}  simframe/{rel}  ({len(data)} B)")
    return sha


def main():
    ok, missing = 0, []
    for url, rel in FILES:
        try:
            save(rel, fetch(url))
            ok += 1
        except Exception as e:
            print(f"POMINIETO {url}: {e}", file=sys.stderr)
            missing.append(rel)

    for name in PHOTOS:
        rel = f"social-luma/photos/{name}.webp"
        try:
            save(rel, fetch(BASE + "/" + rel))
            ok += 1
        except Exception as e:
            print(f"POMINIETO {rel}: {e}", file=sys.stderr)
            missing.append(rel)

    for name in APP_ICONS:
        rel = f"icons/luma-v4-{name}.svg"
        try:
            save(rel, fetch(BASE + "/" + rel))
            ok += 1
        except Exception as e:
            print(f"POMINIETO {rel}: {e}", file=sys.stderr)
            missing.append(rel)

    for name in DEPOT_MARKS:
        rel = f"mockups/apps/depot/marks/{name}.svg"
        try:
            save(rel, fetch(BASE + "/mockups/apps/depot/marks/" + name + ".svg"))
            ok += 1
        except Exception as e:
            print(f"POMINIETO (opcjonalne) {rel}: {e}", file=sys.stderr)

    # Spakietowane gify Lucide z _bundle.json -> pojedyncze pliki icons/<name>.svg,
    # tak jak oczekuje shell.js (icons/<name>.svg).
    bundle_path = os.path.join(ROOT, "icons", "_bundle.json")
    if os.path.exists(bundle_path):
        with open(bundle_path, encoding="utf-8") as f:
            bundle = json.load(f)
        for name, svg in bundle.items():
            rel = f"icons/{name}.svg"
            if os.path.exists(os.path.join(ROOT, rel)):
                continue
            save(rel, svg.encode("utf-8"))
            ok += 1

    print(f"\nGotowe: {ok} plikow w simframe/. Braki (do uzupelnienia recznie): {missing or 'brak'}")


if __name__ == "__main__":
    main()
