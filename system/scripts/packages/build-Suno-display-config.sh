#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
. "$repo_root/config/desktop/inputs.env"
architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$architecture" in
  x86_64) builder_container=$FEDORA_RPM_BUILD_CONTAINER ;;
  aarch64) builder_container=$FEDORA_RPM_BUILD_CONTAINER_AARCH64 ;;
  *) printf 'error: unsupported display backend build architecture: %s\n' "$architecture" >&2; exit 1 ;;
esac
export SUNO_RPM_BUILDER_ARCHITECTURE=$architecture
output_dir="$repo_root/build/packages/Suno-display-config"
mkdir -p "$output_dir"
work_dir=$(mktemp -d "$output_dir/work.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT
mkdir -p "$work_dir"/{SOURCES,SPECS} "$work_dir/source/Suno-display-config"/{Suno_displays,tests}
cp "$repo_root/src/Suno-displays/Suno_displays/"{__init__,model,displayconfig}.py "$work_dir/source/Suno-display-config/Suno_displays/"
cp "$repo_root/tests/Suno-displays/test_model.py" "$work_dir/source/Suno-display-config/tests/"
source_date_epoch=${SOURCE_DATE_EPOCH:-$(git -c safe.directory="$repo_root" -C "$repo_root" log -1 --format=%ct HEAD)}
tar -C "$work_dir/source" --sort=name --mtime="@$source_date_epoch" --owner=0 --group=0 --numeric-owner -cf - Suno-display-config | gzip -n >"$work_dir/SOURCES/Suno-display-config.tar.gz"
install -m 0644 "$repo_root/LICENSE.md" "$work_dir/SOURCES/"
install -m 0644 "$repo_root/packaging/rpm/Suno-display-config.spec" "$work_dir/SPECS/"
"$repo_root/scripts/packages/run-in-rpm-builder.sh" "$work_dir" "$builder_container" '
  set -euo pipefail
  dnf5 -q -y install rpm-build python3-devel python3-gobject-base
  rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-display-config.spec
'
mkdir -p "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$work_dir/RPMS/noarch/$SUNO_DISPLAY_CONFIG_NEVRA.rpm" "$output_dir/RPMS/noarch/"
install -m 0644 "$work_dir"/SRPMS/*.src.rpm "$output_dir/SRPMS/"
(cd "$output_dir"; sha256sum RPMS/noarch/*.rpm SRPMS/*.src.rpm >SHA256SUMS)
