#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in curl mktemp podman sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required tiling package build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  printf 'error: build the tiling RPMs on the canonical Linux/x86_64 builder\n' >&2
  exit 1
fi

cache_dir="$repo_root/build/cache/tiling-shell"
output_dir="$repo_root/build/packages/tiling"
mkdir -p "$cache_dir" "$output_dir"

tiling_zip="$cache_dir/tilingshell-${TILING_SHELL_VERSION}-gse${TILING_SHELL_GSE_VERSION}.zip"
tiling_license="$cache_dir/tilingshell-${TILING_SHELL_UPSTREAM_COMMIT}.LICENSE"

if [ ! -f "$tiling_zip" ]; then
  curl --fail --location --output "$tiling_zip" "$TILING_SHELL_GSE_ZIP_URL"
fi
if [ ! -f "$tiling_license" ]; then
  curl --fail --location --output "$tiling_license" "$TILING_SHELL_LICENSE_URL"
fi

printf '%s  %s\n' "$TILING_SHELL_GSE_ZIP_SHA256" "$tiling_zip" |
  sha256sum --check --status || {
    printf 'error: Tiling Shell GNOME Extensions payload checksum mismatch\n' >&2
    exit 1
  }
printf '%s  %s\n' "$TILING_SHELL_LICENSE_SHA256" "$tiling_license" |
  sha256sum --check --status || {
    printf 'error: Tiling Shell license checksum mismatch\n' >&2
    exit 1
  }

work_dir=$(mktemp -d "$output_dir/work.XXXXXX")
rpmbuild_dir="$work_dir/rpmbuild"
mkdir -p "$rpmbuild_dir/BUILD" "$rpmbuild_dir/BUILDROOT" \
  "$rpmbuild_dir/RPMS" "$rpmbuild_dir/SOURCES" \
  "$rpmbuild_dir/SPECS" "$rpmbuild_dir/SRPMS"

install -m 0644 "$tiling_zip" \
  "$rpmbuild_dir/SOURCES/tilingshell-${TILING_SHELL_VERSION}-gse${TILING_SHELL_GSE_VERSION}.zip"
install -m 0644 "$tiling_license" "$rpmbuild_dir/SOURCES/LICENSE"
install -m 0644 "$repo_root/extensions/Suno-tiling-toggle/extension.js" \
  "$rpmbuild_dir/SOURCES/extension.js"
install -m 0644 "$repo_root/extensions/Suno-tiling-toggle/metadata.json" \
  "$rpmbuild_dir/SOURCES/metadata.json"
install -m 0644 "$repo_root/extensions/Suno-tiling-toggle/README.md" \
  "$rpmbuild_dir/SOURCES/README.md"
install -m 0644 "$repo_root/extensions/Suno-tiling-toggle/stylesheet.css" \
  "$rpmbuild_dir/SOURCES/stylesheet.css"
install -m 0644 "$repo_root/extensions/Suno-tiling-toggle/verify-ink.py" \
  "$rpmbuild_dir/SOURCES/verify-ink.py"
install -m 0644 "$repo_root/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
install -m 0644 "$repo_root/patches/tiling-shell/0018-independent-window-spacing-and-resize.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/tiling-shell/0019-rebuild-selection-after-monitor-reentry.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/tiling-shell/0020-window-preview-drag.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/tiling-shell/0021-Suno-shaped-windows-sit-in-their-tile.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/tiling-shell/0022-drag-selects-whole-zones-of-the-current-layout.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/tiling-shell/90_Suno-tiling-shell.gschema.override" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/packaging/rpm/gnome-shell-extension-tiling-shell.spec" \
  "$rpmbuild_dir/SPECS/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0001-disconnect-signals-before-destroying-indicator.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0002-Suno-visible-drag-layout.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0004-Suno-quick-settings-interface.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0006-Suno-tell-clients-a-window-is-tiled.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0007-Suno-right-click-breaks-the-tiling-spell.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0008-Suno-layouts-follow-monitors-and-setups.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0009-Suno-unique-layout-ids-and-editor-cursors.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0010-Suno-window-placement-memory.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0011-Suno-windows-settle-once-after-monitor-changes.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0012-Suno-apps-appear-as-soon-as-they-open.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0013-Suno-late-placed-windows-stay-visible.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0014-Suno-tiles-follow-the-work-area.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0015-Suno-a-maximized-window-is-the-largest-tile.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0016-Suno-windows-open-straight-into-their-tile.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/tiling-shell/0017-Suno-floating-zone-editor-actions.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/tiling-shell/editor/state.mjs" \
  "$rpmbuild_dir/SOURCES/editor-state.mjs"
install -m 0644 "$repo_root/packaging/rpm/gnome-shell-extension-Suno-tiling-toggle.spec" \
  "$rpmbuild_dir/SPECS/"

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" \
  "$FEDORA_RPM_BUILD_CONTAINER" '
    set -euo pipefail
    dnf5 -y install rpm-build dnf5-plugins redhat-rpm-config
    dnf5 -y builddep SPECS/gnome-shell-extension-tiling-shell.spec \
      SPECS/gnome-shell-extension-Suno-tiling-toggle.spec
    rpmbuild -ba --define "_topdir $PWD" SPECS/gnome-shell-extension-tiling-shell.spec
    rpmbuild -ba --define "_topdir $PWD" SPECS/gnome-shell-extension-Suno-tiling-toggle.spec

    topdir=$PWD
    tiling_rpm=$(find "$topdir/RPMS/noarch" -maxdepth 1 -type f \
      -name "gnome-shell-extension-tiling-shell-*.rpm" -print -quit)
    toggle_rpm=$(find "$topdir/RPMS/noarch" -maxdepth 1 -type f \
      -name "gnome-shell-extension-Suno-tiling-toggle-*.rpm" -print -quit)
    test -n "$tiling_rpm"
    test -n "$toggle_rpm"
    verify_dir=$(mktemp -d)
    cd "$verify_dir"
    rpm2cpio "$tiling_rpm" >payload.cpio
    cpio -idm --quiet <payload.cpio
    rm -f payload.cpio
    extension_dir=./usr/share/gnome-shell/extensions/tilingshell@ferrarodomenico.com
    grep -Fq "show-layout-while-dragging" \
      "$extension_dir/schemas/org.gnome.shell.extensions.tilingshell.gschema.xml"
    grep -Fq "get_frame_rect_in_tile" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    grep -A1 "key name=\"tiling-system-deactivation-key\"" \
      "$extension_dir/schemas/org.gnome.shell.extensions.tilingshell.gschema.xml" | grep -Fq 0
    grep -Fq "showTilingSystem !== this._wasTilingSystemActivated" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    grep -Fq ")) && !isTilingSystemDeactivated" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    grep -Fq "Suno Split" "$extension_dir/settings/settings.js"
    grep -Fq "this._SunoTilingSuspended = !this._SunoTilingSuspended" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    test "$(GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" \
      gsettings get org.gnome.shell.extensions.tilingshell show-indicator)" = false
    test "$(GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" \
      gsettings get org.gnome.shell.extensions.tilingshell outer-gaps)" = "uint32 16"
    test -f "$extension_dir/schemas/90_Suno-tiling-shell.gschema.override"
    grep -Fq "SunoMigrateSettings(this.getSettings())" "$extension_dir/extension.js"
    grep -Fq "_SunoHoldTile(window, desiredWindowRect" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    grep -Fq "function SunoOuterGaps(monitorIndex" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    grep -Fq "if (!(window instanceof Meta.Window))" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    grep -Fq "window._SunoTileGoneId = window.connect(\"unmanaging\"" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    grep -Fq "<method name=\"newLayout\"" "$extension_dir/dbus.js"
    grep -Fq "<method name=\"selectLayout\">" "$extension_dir/dbus.js"
    grep -Fq "export default class SunoWindowMemory" \
      "$extension_dir/components/SunoWindowMemory/windowMemory.js"
    grep -Fq "new SunoWindowMemory({" "$extension_dir/extension.js"
    grep -Fq "\"unlock-dialog\"" "$extension_dir/metadata.json"
    grep -Fq "_revealHold(window, data" \
      "$extension_dir/components/SunoWindowMemory/windowMemory.js"
    grep -Fq "Forget Window Positions" "$extension_dir/prefs.js"
    grep -Fq "_queueEarlyPlacement()" \
      "$extension_dir/components/SunoWindowMemory/windowMemory.js"
    grep -Fq "_keepInside(window, why" \
      "$extension_dir/components/SunoWindowMemory/windowMemory.js"
    grep -Fq "this._SunoReflowTiles();" \
      "$extension_dir/components/tilingsystem/tilingManager.js"
    grep -Fq "_onInitialConfigure(window, data, config)" \
      "$extension_dir/components/SunoWindowMemory/windowMemory.js"
    test "$(GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" \
      gsettings get org.gnome.shell.extensions.tilingshell Suno-remember-window-positions)" = true

    toggle_verify_dir=$(mktemp -d)
    cd "$toggle_verify_dir"
    rpm2cpio "$toggle_rpm" >payload.cpio
    cpio -idm --quiet <payload.cpio
    rm -f payload.cpio
    toggle_js=./usr/share/gnome-shell/extensions/tiling-toggle@project-suno.local/extension.js
    grep -Fq "function createLayoutPreview" "$toggle_js"
    grep -Fq "SettingsSchemaSource.new_from_directory" "$toggle_js"
    grep -Fq "Edit layouts…" "$toggle_js"
    grep -Fq "Suno-sheet-link" "$toggle_js"
    grep -Fq "new GLib.Variant" "$toggle_js"
    ! grep -Fq "_addIndicator" "$toggle_js"
    grep -Fq "Suno-tiling-preview:checked" \
      ./usr/share/gnome-shell/extensions/tiling-toggle@project-suno.local/stylesheet.css
    ! grep -Fq "rgba(255,255,255,0.52)" "$toggle_js"
  '

# Each build has a unique work directory. Copy the artifacts produced by its
# specs; accepted image pins can lag a locally qualified component candidate.
stable_rpms="$output_dir/RPMS/noarch"
stable_srpms="$output_dir/SRPMS"
install -d -m 0755 "$stable_rpms" "$stable_srpms"
install -m 0644 \
  "$rpmbuild_dir"/RPMS/noarch/gnome-shell-extension-tiling-shell-*.rpm \
  "$stable_rpms/"
install -m 0644 \
  "$rpmbuild_dir"/RPMS/noarch/gnome-shell-extension-Suno-tiling-toggle-*.rpm \
  "$stable_rpms/"
install -m 0644 "$rpmbuild_dir"/SRPMS/gnome-shell-extension-tiling-shell-*.src.rpm \
  "$stable_srpms/"
install -m 0644 "$rpmbuild_dir"/SRPMS/gnome-shell-extension-Suno-tiling-toggle-*.src.rpm \
  "$stable_srpms/"

(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno tiling packages: %s\n' "$output_dir"
