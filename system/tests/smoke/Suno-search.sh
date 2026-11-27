#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

python3 -m unittest tests.unit.test_Suno_search
python3 -m py_compile \
  src/Suno-search/Suno-search-service \
  src/Suno-search/Suno-search-settings \
  src/Suno-search/Suno_search/*.py \
  scripts/search/inventory-search-providers.py
glib-compile-schemas --strict --dry-run src/Suno-search

python3 - <<'PY'
from pathlib import Path
from xml.etree import ElementTree

for path in (
    Path("src/Suno-search/org.projectSuno.Search1.xml"),
    Path("src/Suno-search/org.projectSuno.search.gschema.xml"),
):
    ElementTree.parse(path)
PY

grep -Fqx 'Suno-search' config/shared/platform-packages.txt
grep -Fqx "$SUNO_SEARCH_NEVRA" config/desktop/packages.txt
grep -Fq 'build/packages/Suno-search/RPMS/noarch/$SUNO_SEARCH_NEVRA.rpm' \
  scripts/vm/compose-desktop-image.sh
grep -Fq 'build/packages/Suno-search/RPMS/noarch/$SUNO_SEARCH_NEVRA.rpm' \
  scripts/mobile/compose-fp6-rootfs.sh
grep -Eq 'Patch1010:[[:space:]]+0011-Suno-search-window-view.patch' \
  patches/gnome-shell/0000-Suno-fedora-spec.patch
grep -Eq 'Patch1011:[[:space:]]+0012-Suno-search-beam-native-providers.patch' \
  patches/gnome-shell/0000-Suno-fedora-spec.patch
grep -Eq 'Patch1012:[[:space:]]+0013-Suno-search-beam-layout-polish.patch' \
  patches/gnome-shell/0000-Suno-fedora-spec.patch
grep -Eq 'Patch15:[[:space:]]+0016-Suno-shared-search-client.patch' packaging/rpm/Suno-phosh.spec
grep -Fq "accessible_name: _('Window View')" \
  patches/gnome-shell/0011-Suno-search-window-view.patch
grep -Fq "this.accessible_name = _('Search this machine')" \
  patches/gnome-shell/0011-Suno-search-window-view.patch
grep -Fq 'addProvider(provider)' \
  patches/gnome-shell/0011-Suno-search-window-view.patch
grep -Fq "import GioUnix from 'gi://GioUnix'" \
  patches/gnome-shell/0011-Suno-search-window-view.patch
grep -Fq 'this.appInfo = GioUnix.DesktopAppInfo.new(' \
  patches/gnome-shell/0011-Suno-search-window-view.patch
! grep -Fq "get_id: () => 'org.projectSuno.Search.desktop'" \
  patches/gnome-shell/0011-Suno-search-window-view.patch
grep -Fq 'Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES' \
  src/Suno-search/Suno-search-service
grep -Fq 'Gio.DBusProxyFlags.DO_NOT_AUTO_START_AT_CONSTRUCTION' \
  src/Suno-search/Suno-search-service
grep -Fq 'if (sessionMode.hasOverview)' \
  patches/gnome-shell/0011-Suno-search-window-view.patch
grep -Fq 'Failed to initialize Suno Search' \
  patches/gnome-shell/0011-Suno-search-window-view.patch
grep -Fq 'SearchResultsView({compact: true})' \
  patches/gnome-shell/0012-Suno-search-beam-native-providers.patch
grep -Fq 'this._compact = params.compact' \
  patches/gnome-shell/0012-Suno-search-beam-native-providers.patch
grep -Fq '.Suno-search-field' \
  patches/gnome-shell/0012-Suno-search-beam-native-providers.patch
grep -Fq '.Suno-search-result-kind' \
  patches/gnome-shell/0012-Suno-search-beam-native-providers.patch
! grep -Fq '+const SearchProxy = Gio.DBusProxy.makeProxyWrapper' \
  patches/gnome-shell/0012-Suno-search-beam-native-providers.patch
grep -Fq 'Clutter.OffscreenRedirect.NEVER' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'if (this._resultsView.compact)' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'resultIcon.set_size(18, 18)' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'actionMode: Shell.ActionMode.OVERVIEW' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq "accessible_name: _('Close Search')" \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'const activationDelegate = this.provider.createResultObject?.(meta)' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'this._activationDelegate.activate()' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'this._island.y_align = Clutter.ActorAlign.START' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'this.dialogLayout.set({' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'y_align: Clutter.ActorAlign.START' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'x_align: Clutter.ActorAlign.CENTER' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'coordinate: Clutter.BindCoordinate.Y' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'this._yPositionConstraint.offset = topInset' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'this._dialog.warmUp();' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'actor.get_preferred_size();' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'const maxResultsHeight = viewportPadding + rowCount * rowHeight +' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'visible: !resultsView.compact' \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq "? 'search-display'" \
  patches/gnome-shell/0013-Suno-search-beam-layout-polish.patch
grep -Fq 'Main.SunoSearch?.close()' \
  patches/gnome-shell/0011-Suno-search-window-view.patch
test "$(awk '
  /^diff -ruN a\/js\/ui\/SunoSearch.js / {infile = 1; next}
  infile && /^diff -ruN / {exit}
  infile && /^\+\+\+/ {next}
  infile && /^\+/ {count++}
  END {print count}
' patches/gnome-shell/0011-Suno-search-window-view.patch)" = 307
grep -Fq 'Everything on this machine, in one place.' \
  patches/phosh/0016-Suno-shared-search-client.patch
! rg -i 'waydroid|android' src/Suno-search

printf 'Suno Search static smoke test: PASS\n'
