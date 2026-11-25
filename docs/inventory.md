# Inwentarz makiety Luma (simframe)

Źródła makiety „Try it yourself” ze strony głównej [simplyluma.com](https://simplyluma.com/) —
serwis osadza plik (u nich `simframe/mockups/luma-next-73.html`; u nas po zmianie nazw: `simframe/mockups/Suno-next-73.html`) —
jednoplikowa makieta z wbudowanym
CSS/JS) i montuje nad nim `mockups/desktop/shell.js` (dock/shelf systemu).

Snapshot w Wayback Machine: `20261027144840` (https://web.archive.org/web/20261027144840/https://simplyluma.com/).

| Plik (względem `simframe/`) | Rozmiar | Rola w makiecie |
| --- | ---: | --- |
| `mockups/Suno-next-73.html` | ~713 KB | Cała makieta: desktop/tablet/phone, okna aplikacji, „showcase” ze strony głównej (parametry: `?desktop=1&app=none&showcase=1&zoom=0.7950`) |
| `mockups/desktop/shell.js` | ~100 KB | Dock/shelf systemu montowany nad biurkiem (`window.lumaDesk` (nazwa zmiennych w kodzie — niezmieniona) to mostek do prawdziwych okien); parametry `?showcase=1`, `?status=panel|glance|line` |
| `mockups/desktop/shell.css` | — | Styl powłoki (wczytywany przez shadow DOM z `shell.js`) |
| `mockups/assets/luma-favicon.svg` | 1.5 KB | Favicon makiet |
| `icons/_bundle.json` | ~47 KB | Wszystkie glify (Lucide + znaki systemowe) w jednym JSON, klucz = nazwa pliku |
| `icons/luma-v4-*.svg` | 27 × ~2–3 KB | Ikony aplikacji Luma v4 (Filer, Tide, Viola, Messages, Charlie, Notes, Photos, Calendar, Term, Depot, Settings itd.). Bez ikon Creative Collection |
| `fonts/figtree/figtree.css` + 4 × `.woff2` | ~88 KB | Systemowa czcionka Figtree (SIL OFL) |
| `social-suno/photos/*.webp` | 15 × ~100–400 KB | Zdjęcia używane przez makiety (tła „life-*”, okładka `pet-sounds.webp`) |
| `wallpapers/prism.png` | ~2.3 MB | Tapeta biurka |
| `mockups/apps/depot/marks/<app>.svg` | ~1–2 KB | Znaki aplikacji z trayu systemowego (Discord, Steam — reszta odfiltrowana) |
| `mockups/desktop/dink-shell.css` | ~7,5 KB | Styl trybu „ink” dok– (dowany dynamicznie przez `shell.js`) |

Pełne adresy wynikają ze wzoru: `https://simplyluma.com/simframe/<ścieżka>`.

## Stan SunoOS (fork upstream)

`simframe/` nie jest już 1:1 kopią serwisu — po vendorowaniu stosowane są dwa kroki (oba automatycznie w
`tools/fetch_upstream.py`, oraz ręcznie przez `python3 tools/suno_policy.py` / `python3 tools/split_sections.py`):

1. **`tools/suno_policy.py`** — usuwa dane nieaktywnych aplikacji trzecich (system instaluje wyłącznie
   Spotify, Discord, Obsidian, Zoom i Steam): katalog Depot (`catalogue.js`), urządzenia/aktualizacje/historia
   (`world.js`), launchpad i tray (`desktop/shell.js`), listy prac i „popularnych”, wiersze telefonu w `Suno-73.js`
   oraz ikony (`_bundle.json` + pliki SVG). Samo wykonywanie, animacje i wygląd są nietknięte.
2. **`tools/split_sections.py`** — dzieli monolity na sekcje (edycja w małych plikach, bez zmiany zachowania):

| Plik wejściowy (loader/manifest) | Sekcje | Liczba |
| --- | --- | ---: |
| `mockups/Suno-73.js` | `mockups/Suno-73/sections/s001–014.js` | 14 |
| `mockups/Suno-73.css` | `mockups/Suno-73/sections/s001–010.css` | 10 |
| `mockups/desktop/shell.js` | `mockups/desktop/shell/sections/s001–002.js` | 2 |
| `mockups/desktop/shell.css` | `mockups/desktop/shell/sections/s001–003.css` | 3 |

Sekcje to bajt-dokładne wycinki (połączenie sekcji ma ten sam SHA-256 co całość przed podziałem);
JS skleja cieniutki asynchroniczny loader i wykonuje jednym `eval`, CSS sklejają `@import`-y w oryginalnej
kolejności. Manifest podziału: `mockups/sections.json`. Edytujemy sekcje — nigdy plików loader/manifest.

> Uwaga: w pakiecie `simframe/` zmieniliśmy nazwy plików z `luma…` na `Suno…` (makieta, ikony, favicon, katalog `social-suno/`).
> Adresy URL upstream (simplyluma.com, `dl.simplyluma.com`) oraz nazwy w kodzie (np. `window.lumaDesk`, teksty brandingu „Luma”) pozostają nietknięte.

## Status GitHuba Luma

Upstream Luma jest open source, ale w momencie kopiowania serwis raportuje:
„Our GitHub is temporarily unavailable while we resolve an account issue.”
(github.com/SimplyLuma nie odpowiada). Kod pobieramy więc bezpośrednio z serwisu;
gdy GitHub wróci, warto porównać z `github.com/SimplyLuma/luma`.

## Jak uzupełnić pliki

`python3 tools/fetch_upstream.py` pobiera wszystko powyższe do `simframe/`,
wypisując SHA-256 każdego pliku, a następnie stosuje kroki 1–2 z sekcji „Stan SunoOS” powyżej.
