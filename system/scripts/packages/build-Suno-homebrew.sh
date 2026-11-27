#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
. "$repo_root/config/desktop/inputs.env"
output="$repo_root/build/packages/Suno-homebrew"
mkdir -p "$output"
work=$(mktemp -d "$output/work.XXXXXX")
mkdir -p "$work"/{SOURCES,SPECS}
tar -C "$repo_root/src" -czf "$work/SOURCES/Suno-homebrew.tar.gz" Suno-homebrew
install -m0644 "$repo_root/LICENSE.md" "$work/SOURCES/"
install -m0644 "$repo_root/packaging/rpm/Suno-homebrew.spec" "$work/SPECS/"
"$repo_root/scripts/packages/run-in-rpm-builder.sh" "$work" \
  "${SUNO_HOMEBREW_RPM_BUILD_CONTAINER:-$FEDORA_RPM_BUILD_CONTAINER}" '
  set -euo pipefail
  dnf5 -y install rpm-build systemd-rpm-macros
  rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-homebrew.spec
  '
mkdir -p "$output/RPMS/noarch" "$output/SRPMS"
install -m0644 "$work/RPMS/noarch/$SUNO_HOMEBREW_NEVRA.rpm" "$output/RPMS/noarch/"
install -m0644 "$work"/SRPMS/*.src.rpm "$output/SRPMS/"
(cd "$output"; sha256sum "RPMS/noarch/$SUNO_HOMEBREW_NEVRA.rpm" >SHA256SUMS)
