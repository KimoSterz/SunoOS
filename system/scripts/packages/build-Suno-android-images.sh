#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
if [ "${1:-}" = --reference ]; then
  [ "$#" -eq 1 ] || { printf 'error: unexpected reference arguments\n' >&2; exit 2; }
  exec "$repo_root/scripts/packages/build-Suno-android-images-reference.sh"
fi
[ "$#" -eq 0 ] || { printf 'usage: %s [--reference]\n' "$0" >&2; exit 2; }
source "$repo_root/config/desktop/inputs.env"
arch=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$arch" in
  x86_64|aarch64) ;;
  *) printf 'error: unsupported Android image architecture: %s\n' "$arch" >&2; exit 1 ;;
esac
# The package holds image files and no compiled code: build every target in
# the host's own builder (rpmbuild --target) rather than under emulation.
case "$(uname -m)" in
  x86_64) builder_container=$FEDORA_RPM_BUILD_CONTAINER ;;
  aarch64) builder_container=$FEDORA_RPM_BUILD_CONTAINER_AARCH64 ;;
  *) printf 'error: unsupported RPM builder host: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac
: "${SUNO_ANDROID_TERMINAL_PAIR_DIR:?actual terminal native image pair required}"
: "${SUNO_ANDROID_IMAGE_MEMBERS:?actual read-only inside-image membership proof required}"
export SUNO_RPM_BUILDER_ARCHITECTURE=$(uname -m)
output="$repo_root/build/packages/Suno-android-images/$arch"
mkdir -p "$output"
work="$output/work.native.$(python3 -c 'import uuid; print(uuid.uuid4().hex)')"
python3 -B -I "$repo_root/scripts/android/stage-native-image-package.py" \
  "$SUNO_ANDROID_TERMINAL_PAIR_DIR" "$SUNO_ANDROID_IMAGE_MEMBERS" "$work" "$repo_root" "$arch"
# Recount only allocations already made by staging, then preserve the original
# full scratch forecast and 10 GiB physical floor through normal RPM stages.
python3 -B -I - "$work" <<'PY'
import json, os, pathlib, shutil, sys
root=pathlib.Path(sys.argv[1]); receipt=json.loads((root/'STAGED-INPUTS.json').read_text())
allocated=sum(p.stat().st_blocks*512 for p in root.rglob('*') if p.is_file() and not p.is_symlink())
remaining=max(0, receipt['actual_full_scratch_budget']-allocated)
if shutil.disk_usage(root).free < remaining+receipt['physical_reserve_bytes']:
    raise SystemExit('Insufficient measured remaining scratch plus 10 GiB reserve')
PY
"$repo_root/scripts/packages/run-in-rpm-builder.sh" "$work" "$builder_container" "
  set -euo pipefail
  dnf5 -y install rpm-build python3
  rpmbuild -ba --target $arch --define \"_topdir \$PWD\" SPECS/Suno-android-images.spec
  test \"\$(find RPMS -name 'Suno-android-images-*.$arch.rpm' | wc -l)\" -eq 1
  test \"\$(find SRPMS -name 'Suno-android-images-*.src.rpm' | wc -l)\" -eq 1
"
mkdir -p "$output/RPMS" "$output/SRPMS"
find "$work/RPMS" -name 'Suno-android-images-*.rpm' -exec cp --reflink=auto -t "$output/RPMS" {} +
find "$work/SRPMS" -name 'Suno-android-images-*.src.rpm' -exec cp --reflink=auto -t "$output/SRPMS" {} +
find "$output/RPMS" "$output/SRPMS" -type f -name '*.rpm' -print0 |
  sort -z | xargs -0 sha256sum > "$output/SHA256SUMS"
test -s "$output/SHA256SUMS"
