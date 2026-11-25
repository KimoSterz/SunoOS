# Inwentarz makiety Luma (simframe)

Źródła makiety „Try it yourself” ze strony głównej [simplyluma.com](https://simplyluma.com/) —
serwis osadza plik `simframe/mockups/luma-next-73.html` (jednoplikowa makieta z wbudowanym
CSS/JS) i montuje nad nim `mockups/desktop/shell.js` (dock/shelf systemu).

Snapshot w Wayback Machine: `20261027144840` (https://web.archive.org/web/20261027144840/https://simplyluma.com/).

| Plik (względem `simframe/`) | Rozmiar | Rola w makiecie |
| --- | ---: | --- |
| `mockups/luma-next-73.html` | ~713 KB | Cała makieta: desktop/tablet/phone, okna aplikacji, „showcase” ze strony głównej (parametry: `?desktop=1&app=none&showcase=1&zoom=0.7950`) |
| `mockups/desktop/shell.js` | ~45+ KB | Dock/shelf systemu montowany nad biurkiem (`window.lumaDesk` to mostek do prawdziwych okien); parametry `?showcase=1`, `?status=panel|glance|line` |
| `mockups/desktop/shell.css` | — | Styl powłoki (wczytywany przez shadow DOM z `shell.js`) |
| `mockups/assets/luma-favicon.svg` | 1.5 KB | Favicon makiet |
| `icons/_bundle.json` | ~47 KB | Wszystkie glify (Lucide + znaki systemowe) w jednym JSON, klucz = nazwa pliku |
| `icons/luma-v4-*.svg` | 34 × ~2–3 KB | Ikony aplikacji Luma v4 (Filer, Tide, Viola, Messages, Charlie, Notes, Write, Photos, Calendar, Term, Depot, Settings itd.) |
| `fonts/figtree/figtree.css` + 4 × `.woff2` | ~88 KB | Systemowa czcionka Figtree (SIL OFL) |
| `social-luma/photos/*.webp` | 15 × ~100–400 KB | Zdjęcia używane przez makiety (tła „life-*”, okładka `pet-sounds.webp`) |
| `wallpapers/prism.png` | ~2.3 MB | Tapeta biurka |
| `mockups/apps/depot/marks/<app>.svg` | ~1–2 KB | Znaki aplikacji z trayu systemowego (Discord, Nextcloud, Bitwarden, Signal, Steam) |

Pełne adresy wynikają ze wzoru: `https://simplyluma.com/simframe/<ścieżka>`.

## Status GitHuba Luma

Upstream Luma jest open source, ale w momencie kopiowania serwis raportuje:
„Our GitHub is temporarily unavailable while we resolve an account issue.”
(github.com/SimplyLuma nie odpowiada). Kod pobieramy więc bezpośrednio z serwisu;
gdy GitHub wróci, warto porównać z `github.com/SimplyLuma/luma`.

## Jak uzupełnić pliki

`python3 tools/fetch_upstream.py` pobiera wszystko powyższe do `simframe/`,
wypisując SHA-256 każdego pliku.
