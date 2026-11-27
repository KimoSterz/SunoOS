#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
. "$repo_root/config/desktop/inputs.env"
output="$repo_root/build/packages/Suno-sound-theme"
mkdir -p "$output"
work=$(mktemp -d "$output/work.XXXXXX")
trap 'rm -rf "$work"' EXIT INT TERM
mkdir -p "$work"/{SOURCES,SPECS}
tar -C "$repo_root/src" -czf "$work/SOURCES/Suno-sound-theme.tar.gz" Suno-sound-theme
install -m0644 "$repo_root/src/Suno-sound-theme/LICENSE" "$work/SOURCES/LICENSE"
install -m0644 "$repo_root/packaging/rpm/Suno-sound-theme.spec" "$work/SPECS/"
"$repo_root/scripts/packages/run-in-rpm-builder.sh" "$work" \
  "${SUNO_SOUND_THEME_RPM_BUILD_CONTAINER:-$FEDORA_RPM_BUILD_CONTAINER}" '
  set -euo pipefail
  dnf5 -y install rpm-build glib2 gsettings-desktop-schemas
  rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-sound-theme.spec
  '
release=$(sed -n 's/^Release:[[:space:]]*\([^%]*\)%{?dist}$/\1/p' "$repo_root/packaging/rpm/Suno-sound-theme.spec")
version=$(sed -n 's/^Version:[[:space:]]*//p' "$repo_root/packaging/rpm/Suno-sound-theme.spec")
rpm_name="Suno-sound-theme-$version-$release.fc44.noarch.rpm"
rm -rf "$output/RPMS" "$output/SRPMS"
mkdir -p "$output/RPMS/noarch" "$output/SRPMS"
install -m0644 "$work/RPMS/noarch/$rpm_name" "$output/RPMS/noarch/"
install -m0644 "$work"/SRPMS/*.src.rpm "$output/SRPMS/"
(cd "$output"; find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS)
printf 'Suno sound theme: %s\n' "$output"
