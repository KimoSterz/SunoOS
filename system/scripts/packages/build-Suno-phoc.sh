#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/mobile/phoc-source.env"
[ "$(uname -s)" = Linux ] && [ "$(uname -m)" = aarch64 ] || {
  echo 'error: build Suno Phoc on the Fedora AArch64 builder' >&2; exit 1;
}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM
top="$work/rpmbuild"
mkdir -p "$top"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
fetch() {
  local url=$1 expected=$2 destination=$3 local_copy
  local_copy="${SUNO_PHOC_SOURCE_DIR:-}/$(basename "$url")"
  if [ -n "${SUNO_PHOC_SOURCE_DIR:-}" ] && [ -f "$local_copy" ]; then
    cp -- "$local_copy" "$destination"
  else
    curl -fsSL "$url" -o "$destination"
  fi
  test "$(sha256sum "$destination" | cut -d' ' -f1)" = "$expected"
}
fetch "$SUNO_PHOC_URL" "$SUNO_PHOC_SHA256" "$top/SOURCES/phoc-v0.55.1.tar.gz"
fetch "$SUNO_PHOC_GVDB_URL" "$SUNO_PHOC_GVDB_SHA256" "$top/SOURCES/gvdb-$SUNO_PHOC_GVDB_COMMIT.tar.gz"
install -m 0644 "$repo_root"/patches/phoc/000*.patch "$top/SOURCES/"
install -m 0644 "$repo_root/packaging/rpm/Suno-phoc.spec" "$top/SPECS/"
rpmbuild -bb --define "_topdir $top" "$top/SPECS/Suno-phoc.spec"
out="$repo_root/build/packages/phoc/aarch64/RPMS"
mkdir -p "$out"
rpm_path=$(find "$top/RPMS" -name "$SUNO_PHOC_AARCH64_NEVRA.rpm" -print -quit)
test -n "$rpm_path"
install -m 0644 "$rpm_path" "$out/"
sha256sum "$out/$SUNO_PHOC_AARCH64_NEVRA.rpm"
