# Wendorowane źródła systemu (upstream Luma)

Ten katalog to **1:1 kopia źródeł systemu operacyjnego Luma** — punktu wyjścia dla
pracy nad SunoOS na poziomie systemu (nie makiety). Makieta pozostała bez zmian
w `simframe/`.

| Pole | Wartość |
| --- | --- |
| Źródło | https://gitlab.com/simplyluma/luma |
| Commit upstream | `794eaee177d9de2fe4b8930ffb583c904ba11174` |
| Data commitu | 2026-11-26 18:44:28 -0500 (`release: luma-connect-sync 1.luma.13`) |
| Data vendoringu | 2026-11-27 |
| Licencje | `LICENSE.md`, `LICENSES/`, `NOTICE`, `THIRD-PARTY-SOURCES.md` (nietknięte) |

## Celowe wyłączenia z kopii

- `.git/` — historia upstream nie jest przenoszona (płytka kopia referencyjna).
- `.github/` — workflow CI upstream (triggery `pull_request`) nie mogą odpalać się
  w tym repo i kolidowałyby z naszym `.github/workflows/vendor-upstream.yml`.
  `BUILDING.md` / `.gitlab-ci.yml` opisują, jak upstream weryfikuje zmiany.

## Struktura (skrót, po szczegóły: `system/README.md`)

- `src/` — aplikacje i platforma (m.in. `luma-platform`, `prairie-core`, `luma-tide`,
  `luma-terminal`, `luma-viewer`, `luma-depot`)
- `assets/` — ikony (motyw Prairie, rodziny r40–r42), tapety, font Figtree, boot
- `docs/` — dokumentacja Markdown (kernel, devices, design, developer…)
- `config/`, `image/`, `packaging/`, `scripts/`, `patches/`, `extensions/` — budowa
  obrazu systemu, pakiety, integracje
- `devices/`, `socs/` — profile urządzeń i SoC (kernele w osobnym repo
  `simplyluma/linux`)
- `tests/`, `tools/`, `tasks/`, `changes/` — testy, narzędzia, dziennik zmian

## Zasady pracy

- Nie miksujemy pojęć: kopiowanie upstream → `system/` jest jawnym aktem
  vendoringu (ten plik aktualizujemy: commit + data).
- Nazwy własne SunoOS wprowadzamy odrębnie od ścieżek upstream, żeby aktualizacje
  upstream dały się nanosić bez konfliktów.
- `simframe/` (makieta) pozostaje zamrożony jako referencja wyglądu.
