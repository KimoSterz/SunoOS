#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
output_dir=${SUNO_FP6_ROOTFS_OUTPUT:-/home/Suno/build/fp6-rootfs}
report=${SUNO_FP6_ROOTFS_REPORT:-$output_dir/rootfs-smoke.txt}

[ -d "$output_dir/rootfs" ] || {
  printf 'error: missing composed rootfs: %s/rootfs\n' "$output_dir" >&2
  exit 1
}

sudo env \
  SUNO_FP6_ROOTFS="$output_dir/rootfs" \
  SUNO_FP6_ROOTFS_OUTPUT="$output_dir" \
  SUNO_FP6_PACKAGES_FILE="$repo_root/config/mobile/packages.txt" \
  SUNO_FP6_UI_PACKAGES_FILE="$repo_root/config/mobile/ui-packages.txt" \
  bash "$repo_root/tests/smoke/mobile-rootfs.sh" | sudo tee "$report"

grep -qx 'Fedora FP6 rootfs smoke test: PASS' "$report"
printf 'Fedora FP6 rootfs smoke evidence: %s\n' "$report"
