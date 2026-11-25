#!/usr/bin/env python3
"""Pobiera kompletny kod makiety Luma (simframe) z simplyluma.com do repo.

Działa na zwykłym komputerze z internetem (Python 3.8+, tylko biblioteka stdlib):

    python3 tools/fetch_upstream.py

Tworzy/pelni katalog `simframe/` i zapisuje wszystkie pliki makiety
(HTML makiety desktop/tablet/phone, shell.js, shell.css, ikony, fonty,
tapeta, zdjęcia), wypisując SHA-256 każdego pobranego pliku.

Uwaga: ogromny plik Suno-next-73.html (~0.7 MB, makieta "Try it yourself"
ze strony glownej) jest pobierany z parametrami podgladu showcase.
"""

import hashlib
import json
import os
import sys
import urllib.request

BASE = "https://simplyluma.com/simframe"
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "simframe")

# Upstream serwuje pliki pod nazwami `luma…`; w repo zapisujemy je pod nazwami `Suno…`.
LUMA_HTML = "luma-next-73.html"
SHOWCASE_URL = BASE + "/mockups/" + LUMA_HTML + "?desktop=1&app=none&showcase=1&zoom=0.7950"

# (url, sciezka_docelowa_wzgedem_simframe/)
FILES = [
    (SHOWCASE_URL, "mockups/Suno-next-73.html"),
    (BASE + "/mockups/luma-73.js", "mockups/Suno-73.js"),
    (BASE + "/mockups/luma-73.css", "mockups/Suno-73.css"),
    (BASE + "/mockups/dink.css", "mockups/dink.css"),
    (BASE + "/mockups/dink-apps.css", "mockups/dink-apps.css"),
    (BASE + "/mockups/studio.html", "mockups/studio.html"),
    (BASE + "/mockups/desktop/shell.js", "mockups/desktop/shell.js"),
    (BASE + "/mockups/desktop/shell.css", "mockups/desktop/shell.css"),
    (BASE + "/mockups/desktop/dink-shell.css", "mockups/desktop/dink-shell.css"),
    (BASE + "/mockups/apps/depot/catalogue.js", "mockups/apps/depot/catalogue.js"),
    (BASE + "/mockups/apps/depot/world.js", "mockups/apps/depot/world.js"),
    (BASE + "/mockups/apps/depot/depot.js", "mockups/apps/depot/depot.js"),
    (BASE + "/mockups/apps/depot/depot-b.js", "mockups/apps/depot/depot-b.js"),
    (BASE + "/mockups/apps/depot/depot-c.js", "mockups/apps/depot/depot-c.js"),
    (BASE + "/mockups/apps/depot/depot-d.js", "mockups/apps/depot/depot-d.js"),
    (BASE + "/mockups/apps/depot/depot.css", "mockups/apps/depot/depot.css"),
    (BASE + "/mockups/apps/depot/depot-b.css", "mockups/apps/depot/depot-b.css"),
    (BASE + "/mockups/apps/depot/depot-c.css", "mockups/apps/depot/depot-c.css"),
    (BASE + "/mockups/apps/depot/depot-d.css", "mockups/apps/depot/depot-d.css"),
    (BASE + "/mockups/apps/ari/models.js", "mockups/apps/ari/models.js"),
    (BASE + "/mockups/apps/ari/models.css", "mockups/apps/ari/models.css"),
    (BASE + "/mockups/apps/huddle/huddle.js", "mockups/apps/huddle/huddle.js"),
    (BASE + "/mockups/apps/huddle/data.js", "mockups/apps/huddle/data.js"),
    (BASE + "/mockups/apps/huddle/huddle.css", "mockups/apps/huddle/huddle.css"),
    (BASE + "/mockups/apps/discord/discord.js", "mockups/apps/discord/discord.js"),
    (BASE + "/mockups/apps/discord/data.js", "mockups/apps/discord/data.js"),
    (BASE + "/mockups/apps/discord/discord.css", "mockups/apps/discord/discord.css"),
    (BASE + "/mockups/assets/luma-favicon.svg", "mockups/assets/Suno-favicon.svg"),
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
    "contacts", "disks", "files", "leaf",
    "mail", "maps", "memo", "messages", "monitor", "music", "notes", "phone",
    "photos", "settings",
    "tasks", "terminal", "tipsplit", "valet", "viewer", "weather",
]

# Pominięte celowo (Creative Collection — na razie poza zakresem SunoOS):
# daw, designer, documents, photo-editor, presentations, spreadsheets, video-editor

# Ikony aplik z paska makiety (Luma utrzymuje je pod mockups/apps/depot/marks/).
# Sygnaturem sa linki z tresci shell.js; brak pliku = pomijamy z ostrzezeniem.
DEPOT_MARKS = ["audacity", "bitwarden", "blender", "discord", "firefoxbrowser",
               "gimp", "godotengine", "inkscape", "kdenlive", "kodi", "krita",
               "libreoffice", "nextcloud", "obsidian", "obsstudio", "signal",
               "spotify", "steam", "telegram", "thunderbird", "vlcmediaplayer",
               "vscodium", "zoom"]


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


def rename_bundle_data(raw):
    d = json.loads(raw.decode("utf-8"))
    out = {}
    for k, v in d.items():
        if k.startswith("luma-v4-"):
            k = "Suno-v4-" + k[len("luma-v4-"):]
        elif k.startswith("luma-ink-"):
            k = "Suno-ink-" + k[len("luma-ink-"):]
        out[k] = v
    return json.dumps(out, separators=(",", ":")).encode("utf-8")


def main():
    ok, missing = 0, []
    for url, rel in FILES:
        try:
            data = fetch(url)
            if rel.endswith("_bundle.json"):
                data = rename_bundle_data(data)
            save(rel, data)
            ok += 1
        except Exception as e:
            print(f"POMINIETO {url}: {e}", file=sys.stderr)
            missing.append(rel)

    for name in PHOTOS:
        rel = f"social-suno/photos/{name}.webp"
        try:
            save(rel, fetch(BASE + "/social-luma/photos/" + name + ".webp"))
            ok += 1
        except Exception as e:
            print(f"POMINIETO {rel}: {e}", file=sys.stderr)
            missing.append(rel)

    for name in APP_ICONS:
        rel = f"icons/Suno-v4-{name}.svg"
        try:
            save(rel, fetch(BASE + "/icons/luma-v4-" + name + ".svg"))
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

    # Tworzenie ikon z _bundle.json pomija nazwy z pominiętych aplikacji.
    SKIP = {"daw", "designer", "documents", "photo-editor", "presentations", "spreadsheets", "video-editor"}
    bundle_path = os.path.join(ROOT, "icons", "_bundle.json")
    if os.path.exists(bundle_path):
        with open(bundle_path, encoding="utf-8") as f:
            bundle = json.load(f)
        for name, svg in bundle.items():
            if name in SKIP:
                continue
            rel = f"icons/{name}.svg"
            if os.path.exists(os.path.join(ROOT, rel)):
                continue
            save(rel, svg.encode("utf-8"))
            ok += 1

    # Polityka zawartosci SunoOS: odfiltruj nieaktywne aplikacje i ikony,
    # potem podziel monolity na sekcje (suno_policy + split_sections).
    try:
        import suno_policy
        import split_sections
        pruned = suno_policy.clean(ROOT)
        res = split_sections.split(os.path.join(ROOT, "mockups"))
        with open(os.path.join(ROOT, "mockups", "sections.json"), "w", encoding="utf-8") as f:
            json.dump(res, f, indent=2)
            f.write("\n")
        print(f"\nPolityka SunoOS: wyczyszczono simframe (ikony: {pruned}); sekcje: "
              + ", ".join(f"{k}={v['count']}" for k, v in sorted(res.items())))
    except Exception as e:
        print(f"UWAGA: postprocessing simframe nie powiodl sie ({e})", file=sys.stderr)
        raise

    print(f"\nGotowe: {ok} plikow w simframe/. Braki (do uzupelnienia recznie): {missing or 'brak'}")


if __name__ == "__main__":
    main()
