#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
source "$repo_root/config/desktop/inputs.env"
architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$architecture" in
  x86_64) image=$FEDORA_RPM_BUILD_CONTAINER ;;
  aarch64) image=$FEDORA_RPM_BUILD_CONTAINER_AARCH64 ;;
  *) echo 'unsupported metadata builder architecture' >&2; exit 1 ;;
esac
export SUNO_RPM_BUILDER_ARCHITECTURE=$architecture
work="$repo_root/build/packages/Suno-apk-metadata.$architecture.work"
mkdir -p "$work"/{SOURCES,SPECS,BUILD,BUILDROOT,RPMS,SRPMS}
mkdir -p "$work/Suno-apk-metadata"
cp -R "$repo_root/src/Suno-installer/apk-metadata/." "$work/Suno-apk-metadata/"
cp "$repo_root/packaging/rpm/Suno-apk-metadata.spec" "$work/SPECS/"
cp "$repo_root/LICENSE.md" "$work/SOURCES/"
"$repo_root/scripts/packages/run-in-rpm-builder.sh" "$work" "$image" '
 set -euo pipefail
 dnf5 -y install cargo rust gcc rpm-build python3 acl
 cd Suno-apk-metadata
 mkdir -p .cargo
 cargo vendor --locked vendor > .cargo/config.toml
 python3 collect-licenses.py
 cd ..
 tar --exclude=target -czf SOURCES/Suno-apk-metadata.tar.gz Suno-apk-metadata
 rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-apk-metadata.spec
'
output="$repo_root/build/packages/Suno-apk-metadata/$architecture"
mkdir -p "$output"
cp "$work/RPMS/$architecture/"*.rpm "$output/"
cp "$work/SRPMS/"*.rpm "$output/"
sha256sum "$output/"*.rpm
