#!/usr/bin/env bash
# SPDX-License-Identifier: MPL-2.0
set -euo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"
output="$repo_root/build/packages/gnome-shell-extension-Suno-energy"
mkdir -p "$output"
work=$(mktemp -d "$output/work.XXXXXX")
mkdir -p "$work"/{SOURCES,SPECS}
install -m0644 "$repo_root/extensions/Suno-energy/extension.js" "$work/SOURCES/"
install -m0644 "$repo_root/extensions/Suno-energy/metadata.json" "$work/SOURCES/"
install -m0644 "$repo_root/extensions/Suno-energy/README.md" "$work/SOURCES/"
install -m0644 "$repo_root/src/Suno-energy/LICENSE" "$work/SOURCES/"
install -m0644 "$repo_root/packaging/rpm/gnome-shell-extension-Suno-energy.spec" "$work/SPECS/"
"$repo_root/scripts/packages/run-in-rpm-builder.sh" "$work" \
  "${SUNO_POLICY_RPM_BUILD_CONTAINER:-$FEDORA_RPM_BUILD_CONTAINER}" '
  set -euo pipefail
  dnf5 -y install rpm-build nodejs python3
  rpmbuild -ba --define "_topdir $PWD" SPECS/gnome-shell-extension-Suno-energy.spec
  '
mkdir -p "$output/RPMS/noarch" "$output/SRPMS"
install -m0644 "$work"/RPMS/noarch/*.rpm "$output/RPMS/noarch/"
install -m0644 "$work"/SRPMS/*.src.rpm "$output/SRPMS/"
(cd "$output"; find RPMS SRPMS -name '*.rpm' | sort | xargs sha256sum >SHA256SUMS)
printf 'Suno-energy extension: %s\n' "$output"
