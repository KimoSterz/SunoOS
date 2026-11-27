#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
fail() { printf 'Darkroom smoke test: FAIL: %s\n' "$1" >&2; exit 1; }
source_root="$repo_root/src/Suno-darkroom"

for required in "$source_root/Suno-app.toml" "$source_root/data/org.projectSuno.Darkroom.desktop" "$repo_root/packaging/rpm/Suno-darkroom.spec"; do
  [ -f "$required" ] || fail "missing source contract: $required"
done
grep -Fq 'id = "org.projectSuno.Darkroom"' "$source_root/Suno-app.toml" || fail 'application ID is not stable'
grep -Fq 'presentation_modes = ["windowed", "fullscreen-mobile"]' "$source_root/Suno-app.toml" || fail 'one manifest does not cover desktop and mobile'
grep -Fq 'SunoUI.Context.new_from_environment()' "$source_root/Suno_darkroom/window.py" || fail 'Darkroom bypasses capability context'
grep -Fq 'SunoUI.Histogram.new()' "$source_root/Suno_darkroom/window.py" || fail 'Darkroom does not use shared histogram'
grep -Fq 'SunoUI.CurveEditor.new()' "$source_root/Suno_darkroom/window.py" || fail 'Darkroom does not use shared curves'
grep -Fq 'ImageCms.profileToProfile' "$source_root/Suno_darkroom/engine.py" || fail 'embedded profiles are not converted for display'
grep -Fq 'max_dimension=None' "$source_root/Suno_darkroom/engine.py" || fail 'export does not reopen full-resolution source'
grep -Fq 'os.replace' "$source_root/Suno_darkroom/model.py" || fail 'documents are not atomically finalized'
# Creative applications are optional Depot installs, never baseline roles.
grep -Fxq 'Suno-darkroom' "$repo_root/config/shared/application-exclusions.txt" || fail 'optional app is not excluded from phone images'
grep -Fxq 'Suno-darkroom' "$repo_root/config/os/removed-packages.txt" || fail 'optional app is not excluded from desktop images'
if grep -Fxq 'Suno-darkroom' "$repo_root/config/shared/application-packages.txt"; then fail 'optional app leaked into shared defaults'; fi

PYTHONPATH="$source_root" python3 -m unittest discover -s "$source_root/tests" -p 'test_*.py' >/dev/null || fail 'unit tests failed'
printf 'Darkroom smoke test: PASS\n'

