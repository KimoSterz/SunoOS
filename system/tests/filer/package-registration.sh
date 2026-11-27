#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

release=1.Suno.50.preview20260907
platform_release=0.1.0-1.Suno.54~preview.20260908.1
picker_patch="$repo_root/patches/nautilus/0042-Suno-native-picker-chrome.patch"
startup_patch="$repo_root/patches/nautilus/0044-Suno-initialize-shared-surface.patch"
root_toolbar_patch="$repo_root/patches/nautilus/0045-Suno-root-toolbar-material-ownership.patch"
surface_patch="$repo_root/patches/nautilus/0041-Suno-translucent-title-ownership.patch"
spec_patch="$repo_root/patches/nautilus/0000-Suno-fedora-spec.patch"
builder="$repo_root/scripts/packages/build-nautilus.sh"

actual_patch_sha=$(shasum -a 256 "$picker_patch" | awk '{print $1}')
test "$actual_patch_sha" = a7c64a4acfc22c0e13d13c2588f61d713df2349c177e2881066606adaaba2198
actual_startup_sha=$(shasum -a 256 "$startup_patch" | awk '{print $1}')
test "$actual_startup_sha" = 5ce1ee2140ca43e41fac08cebea409e0b01c06b908a390310ce499f154eea7ff

test "$NAUTILUS_SUNO_RELEASE" = "$release"
test "$NAUTILUS_NEVRA" = "nautilus-50.2.2-${release}.fc44.x86_64"
test "$NAUTILUS_EXTENSIONS_NEVRA" = "nautilus-extensions-50.2.2-${release}.fc44.x86_64"
test "$NAUTILUS_AARCH64_NEVRA" = "nautilus-50.2.2-${release}.fc44.aarch64"
test "$NAUTILUS_EXTENSIONS_AARCH64_NEVRA" = "nautilus-extensions-50.2.2-${release}.fc44.aarch64"

grep -Fxq "$NAUTILUS_NEVRA" "$repo_root/config/desktop/packages.txt"
grep -Fxq "$NAUTILUS_EXTENSIONS_NEVRA" "$repo_root/config/desktop/packages.txt"
test "$(grep -Fc 'nautilus-50.2.2-' "$repo_root/config/desktop/packages.txt")" -eq 1
test "$(grep -Fc 'nautilus-extensions-50.2.2-' "$repo_root/config/desktop/packages.txt")" -eq 1

grep -Fq '+Release:        1.Suno.52.surfacepreview20260908%{?dist}' "$spec_patch"
grep -Fq '+Patch1039:      0040-Suno-shared-empty-panes.patch' "$spec_patch"
grep -Fq '+Patch1040:      0041-Suno-translucent-title-ownership.patch' "$spec_patch"
grep -Fq '+Patch1041:      0042-Suno-native-picker-chrome.patch' "$spec_patch"
grep -Fq '+Patch1042:      0044-Suno-initialize-shared-surface.patch' "$spec_patch"
grep -Fq '+Patch1043:      0045-Suno-root-toolbar-material-ownership.patch' "$spec_patch"
grep -Fq "+BuildRequires:  Suno-developer-platform-devel >= ${platform_release}" "$spec_patch"
grep -Fq "+Requires:       Suno-developer-platform >= ${platform_release}" "$spec_patch"
grep -Fq '+BuildRequires:  google-figtree-fonts' "$spec_patch"
grep -Fq 'test-Suno-empty-picker test-portal-file-chooser' "$spec_patch"
grep -Fq 'patches/nautilus/0042-Suno-native-picker-chrome.patch' "$builder"
grep -Fq 'patches/nautilus/0044-Suno-initialize-shared-surface.patch' "$builder"
grep -Fq 'patches/nautilus/0045-Suno-root-toolbar-material-ownership.patch' "$builder"
grep -Fq 'patches/nautilus/0041-Suno-translucent-title-ownership.patch' "$builder"
grep -Fq '.Suno-files-window.Suno-treatment-light headerbar.Suno-titlebar' "$surface_patch"
grep -Fq 'build the Suno Filer RPM on a Fedora Linux builder' "$builder"

test ! -e "$repo_root/patches/nautilus/0041-Suno-two-line-grid-filenames.patch"
test ! -e "$repo_root/patches/nautilus/0043-Suno-column-details-image-preview.patch"
! grep -Eq '^\+.*(GtkCheckButton|checkbutton|radio|context-menu)' "$picker_patch"
grep -Fq '+    Suno_init ();' "$startup_patch"
grep -Fq '+        styles ["Suno-window-toolbar-view"]' "$root_toolbar_patch"

printf 'PASS: accepted Filer 50 plus isolated Surface candidate registration\n'
