# SunoOS

SunoOS to robocza nazwa naszej kopii rozbudowanej makiety systemu operacyjnego
Luma — interaktywnego podglądu „Try it yourself” ze strony
[simplyluma.com](https://simplyluma.com/) (desktop, tablet i phone w przeglądarce).

Luma jest open source, ale GitHub producenta był w chwili kopiowania
niedostępny („Our GitHub is temporarily unavailable…”), dlatego kod
pozyskujemy bezpośrednio z serwisu. Szczegóły i pełna lista plików:
[docs/inventory.md](docs/inventory.md).

## Szybki start

1. **Podgląd od razu (bez pobierania):** otwórz
   [`preview/index.html`](https://htmlpreview.github.io/?https://github.com/KimoSterz/SunoOS_2.0/blob/main/preview/index.html)
   albo po prostu [makietę na simplyluma.com](https://simplyluma.com/simframe/mockups/luma-next-73.html?desktop=1&app=none&showcase=1&zoom=0.7950) —
   `preview/index.html` osadza ją w iframe.

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

## Dalsza praca / status

- [ ] Uruchomić `tools/fetch_upstream.py` i sprawdzić sumy SHA-256 (gdy tylko dostęp z sieci jest wygodniejszy niż przy tworzeniu repo).
- [ ] Po powrocie `github.com/SimplyLuma/luma` — porównać `simframe/` z źródłami upstream i skopiować licencję.
- [ ] Przebrandowanie na SunoOS (nazwa, kolory, ikony) — po zmerchowaniu plików w `simframe/`.
