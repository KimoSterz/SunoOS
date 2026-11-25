# SunoOS

SunoOS to robocza nazwa naszej kopii rozbudowanej makiety systemu operacyjnego
Luma — interaktywnego podglądu „Try it yourself” ze strony
[simplyluma.com](https://simplyluma.com/) (desktop, tablet i phone w przeglądarce).
Sam projekt nie ma charakteru komercyjnego i jest prowadzony jedynie w celach edukacyjnych i treningowych. 
Luma jest open source, ale GitHub producenta był w chwili kopiowania
niedostępny („Our GitHub is temporarily unavailable…”), dlatego kod
pozyskujemy bezpośrednio z serwisu. Szczegóły i pełna lista plików:
[docs/inventory.md](docs/inventory.md).

## Szybki start

1. **Podgląd na żywo (bez pobierania):**

   - gotowy link: [podgląd SunoOS](https://htmlpreview.github.io/?https://github.com/KimoSterz/SunoOS_2.0/blob/main/preview/index.html)
   - albo wprost makieta Luma: <https://simplyluma.com/simframe/mockups/luma-next-73.html?desktop=1&app=none&showcase=1&zoom=0.7950>

   `preview/index.html` osadza makietę w iframe (serwis Luma na to pozwala —
   nie wysyła `X-Frame-Options`).

   Jeśli chcesz stały adres pod własną domeną GitHuba, włącz GitHub Pages:
   *Settings → Pages → Branch: `main`, folder: `/preview`* — podgląd pojawi się
   wtedy pod `https://kimosterz.github.io/SunoOS_2.0/`.

2. **Pełna, lokalna kopia kodu makiety (zalecane do dalszej pracy):**

   ```sh
   python3 tools/fetch_upstream.py
   ```

   Skrypt pobiera wszystko do `simframe/`, drukuje SHA-256 każdego pliku
   i obsługuje również pliki binarne (fonty, tapeta, zdjęcia), których nie
   dało się przenieść 1:1 przy zakładaniu repo.

## Struktura

```
preview/            podgląd makiety przez iframe (działa od razu)
tools/              narzędzia (fetch_upstream.py)
simframe/           kod makiety Luma — ładowany przez tools/fetch_upstream.py
docs/inventory.md   pełny inwentarz plików makiety + adnotacje
```

## Co jest już w repo

- `simframe/fonts/figtree/figtree.css` — główny arkusz czcionki Figtree (SIL OFL) skopiowany 1:1 z serwisu.
- Pełny opis i adresy wszystkich plików makiety (desktopowa makieta to `simframe/mockups/luma-next-73.html`, powłoka to `simframe/mockups/desktop/shell.js` + `shell.css`).
- Skrypt uzupełniający resztę plików.

## Nasze zmiany względem Luma

- **Filtr nieaktywnych aplikacji** (`tools/luma_policy.py`): z danych makiety usunięte zostały programy trzecie, których
  SunoOS nie instaluje (m.in. Inkscape, Audacity, Blender, GIMP, Krita, Kdenlive, VLC, Kodi, OBS, Signal, Telegram,
  Thunderbird, LibreOffice, VSCodium, Godot, Nextcloud, Bitwarden, Firefox, Heroic, Moonlight, SuperTux) — z katalogu
  Depot, list urządzeń i aktualizacji (`world.js`), launchpada i trayu (`shell.js`), list popularnych (telefon) oraz
  z wiązki ikon `_bundle.json` i plików ikon. W systemie pozostają Spotify, Discord, Obsidian, Zoom i Steam.
  Logika, animacje i wygląd okien/docka pozostały nietknięte — zmienione są wyłącznie dane.
- **Podział na sekcje** (`tools/split_sections.py`): monolity `luma-73.js` (~1,7 MB), `luma-73.css` (~1,1 MB),
  `desktop/shell.js` i `desktop/shell.css` rozbite na małe, po kolei składane sekcje w katalogach `luma-73/sections/`
  i `desktop/shell/sections/`. Każda sekcja to bajt-dokładny wycinek oryginału (sha256 sklejenia równa się sha256
  oryginału — weryfikowane przy każdym podziale), a pliki wejściowe to cieniutki loader (JS) albo manifest `@import`
  (CSS), więc zachowanie, kolejność kaskady ani sposób podpinania w HTML się nie zmieniają. Edytujemy **sekcje**,
  nie pliki wejściowe. Manifest podziału: `simframe/mockups/sections.json`.


## Dalsza praca / status

- **Creative Collection (Write, Grid, Stage, Reel, Sessions, Focus, Canvas) jest celowo wykluczona** — na tym etapie nie jest konieczna i może w ogóle nie trafić do SunoOS (bez ikon i bez plików w vendoringu).
- [x] Pliki upstream są vendorowane przez workflow „Vendor upstream mockup” (`.github/workflows/vendor-upstream.yml`)
  — uruchamiany **tylko ręcznie** (Actions → Workflow dispatch), bo `simframe/` jest już forkiem SunoOS i automat
  nadpisałby ręczne edycje w sekcjach. Workflow sam stosuje filtr `luma_policy.py` i podział `split_sections.py`,
  więc po odświeżeniu stan simframe/ jest identyczny.
- [ ] Po powrocie `github.com/SimplyLuma/luma` — porównać `simframe/` z źródłami upstream i skopiować licencję.
- [ ] Przebrandowanie na SunoOS (nazwa, kolory, ikony) — po zmerchowaniu plików w `simframe/`.
- [ ] Włączyć GitHub Pages (folder `/preview`) dla stałego adresu podglądu.
