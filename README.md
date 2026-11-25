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
suno/settings/       okno Ustawienia SunoOS (komponenty: js/state, js/rows, js/panels, js/app)
suno/components/     komponenty wielokrotnego użycia (night-slider: suwak barwy z wytłoczonymi przystankami)
tools/              narzędzia (fetch_upstream.py)
simframe/           kod makiety Luma — ładowany przez tools/fetch_upstream.py
docs/inventory.md   pełny inwentarz plików makiety + adnotacje
```

## Co jest już w repo

- `simframe/fonts/figtree/figtree.css` — główny arkusz czcionki Figtree (SIL OFL) skopiowany 1:1 z serwisu.
- Pełny opis i adresy wszystkich plików makiety (desktopowa makieta to `simframe/mockups/luma-next-73.html`, powłoka to `simframe/mockups/desktop/shell.js` + `shell.css`).
- Skrypt uzupełniający resztę plików.

## Nasze zmiany względem Luma

- **Okno Ustawienia w komponentach** (`suno/settings/`): własna, rozpętana na czysto aplikacja Ustawienia
  zapisana w małych plikach — `js/state.js` (stan + localStorage + subskrypcje), `js/rows.js`
  (kompozycja wierszy: przełączniki, segmenty, listy, radio, przyciski), `js/panels.js`
  (rejestr paneli: Displays i Night Light; reszta sekcji to na razie zaślepki (placeholdery)),
  `js/app.js` (router paneli, pasek boczny, nawigacja okruszkowa).
- **Night Light jest podstroną Ustawień, nie osobnym oknem**: Ustawienia › Displays › Night Light
  (dokładnie jak w makiecie Luma, którą odtworzyliśmy: wiersz „Night Light — Warmer colours at
  night, easier on the eyes” w panelu Displays). Suwak barwy w zakresie 2000–8000 K co 1000 K:
  wspólny komponent `suno/components/night-slider/` (cieńki tor z gradientem, wąska biała gałka,
  wytłoczone kreski przystanków z podpisami obróconymi o 90°), harmonogram „sunset → sunrise”
  lub godziny manualne + pasek dobowy jak upstream, przycisk „Turn off until tomorrow”.
- Stan ustawień przeżywa odświeżenie strony (localStorage, klucz `suno-settings-v1`).

## Dalsza praca / status

- **Creative Collection (Write, Grid, Stage, Reel, Sessions, Focus, Canvas) jest celowo wykluczona** — na tym etapie nie jest konieczna i może w ogóle nie trafić do SunoOS (bez ikon i bez plików w vendoringu).
- [x] Pliki upstream są vendorowane automatycznie przez workflow „Vendor upstream mockup” (`.github/workflows/vendor-upstream.yml`) — jeżli jeszcze ich nie ma, wystarczy dowolny push do `main` lub ręczne uruchomienie workflow.
- [ ] Po powrocie `github.com/SimplyLuma/luma` — porównać `simframe/` z źródłami upstream i skopiować licencję.
- [ ] Przebrandowanie na SunoOS (nazwa, kolory, ikony) — po zmerchowaniu plików w `simframe/`.
- [ ] Włączyć GitHub Pages (folder `/preview`) dla stałego adresu podglądu.
- [ ] Wpiąć nasze panele (`suno/settings/`) w okno `w-settings` makietę `simframe/` (podmiana treści paneli `displays`/`nightlight` w rejestrze CF w `luma-73.js`).
