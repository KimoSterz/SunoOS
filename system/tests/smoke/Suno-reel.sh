#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
fail() { printf 'Reel smoke test: FAIL: %s\n' "$1" >&2; exit 1; }

source_root="$repo_root/src/Suno-reel"
manifest="$source_root/Suno-app.toml"
desktop="$source_root/data/org.projectSuno.Reel.desktop"
metainfo="$source_root/data/org.projectSuno.Reel.metainfo.xml"
spec="$repo_root/packaging/rpm/Suno-reel.spec"

for required in "$manifest" "$desktop" "$metainfo" "$spec"; do
  [ -f "$required" ] || fail "missing source contract: $required"
done

grep -Fq 'id = "org.projectSuno.Reel"' "$manifest" || fail 'application ID is not stable'
grep -Fq 'presentation_modes = ["windowed", "fullscreen-mobile"]' "$manifest" || \
  fail 'one manifest does not declare both presentation modes'
grep -Fq 'SunoUI.Context.new_from_environment()' \
  "$source_root/Suno_reel/window.py" || fail 'Reel bypasses presentation/input context'
grep -Fq 'SunoSemantics.SemanticObject.new' \
  "$source_root/Suno_reel/window.py" || fail 'Reel lacks semantic objects'
grep -Fq 'GES.Pipeline' "$source_root/Suno_reel/ges_engine.py" || \
  fail 'preview/export do not share the native GES timeline engine'
grep -Fq 'use_proxies=False' "$source_root/Suno_reel/export.py" || \
  fail 'export does not explicitly require source originals'
grep -Fq 'os.replace' "$source_root/Suno_reel/export.py" || \
  fail 'export does not atomically finalize its temporary sibling'

# Creative applications are optional Depot installs, never baseline roles.
grep -Fxq 'Suno-reel' "$repo_root/config/shared/application-exclusions.txt" || fail 'optional app is not excluded from phone images'
grep -Fxq 'Suno-reel' "$repo_root/config/os/removed-packages.txt" || fail 'optional app is not excluded from desktop images'
if grep -Fxq 'Suno-reel' "$repo_root/config/shared/application-packages.txt"; then fail 'optional app leaked into shared defaults'; fi

if command -v rg >/dev/null 2>&1; then
  forbidden_runtime=$(rg -ni '(waydroid|android\.media|android\.provider|webview|webkit|electron)' \
    "$source_root/Suno_reel" "$source_root/bin" "$spec" || true)
else
  forbidden_runtime=$(grep -REni '(waydroid|android\.media|android\.provider|webview|webkit|electron)' \
    "$source_root/Suno_reel" "$source_root/bin" "$spec" || true)
fi
if [ -n "$forbidden_runtime" ]; then
  printf '%s\n' "$forbidden_runtime"
  fail 'Reel depends on an Android or browser runtime'
fi

PYTHONPATH="$source_root" python3 -m unittest discover \
  -s "$source_root/tests" -p 'test_*.py' >/dev/null || fail 'Reel unit tests failed'

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "$desktop" || fail 'desktop entry is invalid'
fi
if command -v appstreamcli >/dev/null 2>&1; then
  appstreamcli validate --no-net "$metainfo" || fail 'AppStream metadata is invalid'
fi

if command -v rpm >/dev/null 2>&1 && rpm -q Suno-reel >/dev/null 2>&1; then
  rpm -ql Suno-reel | grep -Fxq '/usr/bin/Suno-reel' || \
    fail 'installed RPM lacks the Reel executable'
  rpm -ql Suno-reel | grep -Fxq '/usr/share/applications/org.projectSuno.Reel.desktop' || \
    fail 'installed RPM lacks its launcher'
fi

printf 'Reel smoke test: PASS\n'
