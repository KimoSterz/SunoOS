#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
fail() { printf 'Layouts smoke test: FAIL: %s\n' "$1" >&2; exit 1; }

source_root="$repo_root/src/Suno-layouts"
manifest="$source_root/Suno-app.toml"
desktop="$source_root/data/org.projectSuno.Layouts.desktop"
metainfo="$source_root/data/org.projectSuno.Layouts.metainfo.xml"
spec="$repo_root/packaging/rpm/Suno-layouts.spec"

for required in "$manifest" "$desktop" "$metainfo" "$spec"; do
  [ -f "$required" ] || fail "missing source contract: $required"
done

grep -Fq 'id = "org.projectSuno.Layouts"' "$manifest" || fail 'application ID is not stable'
grep -Fq 'adaptive = true' "$manifest" || fail 'manifest does not declare one adaptive application'
grep -Fq 'SunoUI.Context.new_from_environment()' "$source_root/Suno_layouts/window.py" || \
  fail 'Layouts bypasses the shared presentation/input contract'
grep -Fq 'SunoUI.InspectorSection.new' "$source_root/Suno_layouts/window.py" || \
  fail 'Layouts duplicates the shared inspector component'
grep -Fq 'SunoUI.SegmentedControl.new' "$source_root/Suno_layouts/window.py" || \
  fail 'Layouts duplicates the shared segmented control'
grep -Fq 'os.replace' "$source_root/Suno_layouts/persistence.py" || \
  fail 'document save does not atomically replace its temporary sibling'
grep -Fq 'manifest.json' "$source_root/Suno_layouts/persistence.py" || \
  fail 'native format lacks readable package metadata'

# Layouts is retired (2026-09-22): its source stays, but no image may ship it.
shipped=$(grep -nE 'Suno-layouts|SUNO_LAYOUTS|org\.projectSuno\.Layouts' \
  "$repo_root/config/shared/application-packages.txt" \
  "$repo_root/config/desktop/application-packages.txt" \
  "$repo_root/config/desktop/packages.txt" \
  "$repo_root/config/desktop/inputs.env" \
  "$repo_root/scripts/build-Suno-desktop.sh" \
  "$repo_root/scripts/vm/compose-desktop-image.sh" \
  "$repo_root/scripts/vm/provision-desktop-image.sh" \
  "$repo_root/scripts/mobile/compose-fp6-rootfs.sh" || true)
if [ -n "$shipped" ]; then
  printf '%s\n' "$shipped"
  fail 'the retired Layouts app is still part of an image'
fi

if command -v rg >/dev/null 2>&1; then
  forbidden_runtime=$(rg -ni '(waydroid|android\.|webview|webkit|electron)' \
    "$source_root/Suno_layouts" "$source_root/bin" "$spec" || true)
else
  forbidden_runtime=$(grep -REni '(waydroid|android\.|webview|webkit|electron)' \
    "$source_root/Suno_layouts" "$source_root/bin" "$spec" || true)
fi
if [ -n "$forbidden_runtime" ]; then
  printf '%s\n' "$forbidden_runtime"
  fail 'Layouts depends on an Android or browser runtime'
fi

PYTHONPATH="$source_root" python3 -m unittest discover \
  -s "$source_root/tests" -p 'test_*.py' >/dev/null || fail 'Layouts unit tests failed'

if command -v desktop-file-validate >/dev/null 2>&1; then desktop-file-validate "$desktop" || fail 'desktop entry is invalid'; fi
if command -v appstreamcli >/dev/null 2>&1; then appstreamcli validate --no-net "$metainfo" || fail 'AppStream metadata is invalid'; fi

if command -v rpm >/dev/null 2>&1 && rpm -q Suno-layouts >/dev/null 2>&1; then
  rpm -ql Suno-layouts | grep -Fxq '/usr/bin/Suno-layouts' || fail 'installed RPM lacks the executable'
  rpm -ql Suno-layouts | grep -Fxq '/usr/share/applications/org.projectSuno.Layouts.desktop' || fail 'installed RPM lacks its launcher'
fi

printf 'Layouts smoke test: PASS\n'
