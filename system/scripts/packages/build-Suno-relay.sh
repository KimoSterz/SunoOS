#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in mktemp podman sha256sum tar; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required Relay build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] && [ "$(uname -m)" = x86_64 ] || {
  printf 'error: build the Relay RPM on the canonical Linux/x86_64 builder\n' >&2
  exit 1
}

platform_rpm="$repo_root/build/packages/Suno-developer-platform/x86_64/RPMS/$SUNO_DEVELOPER_PLATFORM_X86_64_NEVRA.rpm"
if [ ! -f "$platform_rpm" ]; then
  "$repo_root/scripts/packages/build-Suno-developer-platform.sh"
fi

output_dir="$repo_root/build/packages/Suno-relay"
mkdir -p "$(dirname -- "$output_dir")"
work_dir=$(mktemp -d "$output_dir.work.XXXXXX")
rpmbuild_dir="$work_dir/rpmbuild"
source_dir="$work_dir/Suno-relay"
chmod 0755 "$work_dir"
mkdir -p "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS} "$source_dir/config"
cp -R "$repo_root/src/Suno-relay/Suno_relay" "$repo_root/src/Suno-relay/tests" "$source_dir/"
cp -R "$repo_root/src/Suno-relay/bin" "$repo_root/src/Suno-relay/data" "$source_dir/"
cp "$repo_root/config/relay/relay.conf" "$repo_root/config/relay/fex.json" "$source_dir/config/"
tar -C "$work_dir" -czf "$rpmbuild_dir/SOURCES/Suno-relay.tar.gz" Suno-relay
install -m 0644 "$repo_root/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
install -m 0644 "$repo_root/packaging/rpm/Suno-relay.spec" "$rpmbuild_dir/SPECS/"
chmod -R a+rX "$rpmbuild_dir"

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" "$FEDORA_RPM_BUILD_CONTAINER" '
    set -euo pipefail
    dnf5 -y install desktop-file-utils rpm-build shared-mime-info python3-devel \
      dbus-daemon xorg-x11-server-Xvfb python3-gobject-base \
      /build/packages/Suno-developer-platform/x86_64/RPMS/'"$SUNO_DEVELOPER_PLATFORM_X86_64_NEVRA"'.rpm
    rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-relay.spec
    rpm_path=$(find RPMS/noarch -name "Suno-relay-[0-9]*.rpm" -print -quit)
    test -n "$rpm_path"
    verify=$(mktemp -d)
    cd "$verify"
    set +o pipefail
    rpm2cpio "$OLDPWD/$rpm_path" | cpio -idm --quiet
    set -o pipefail
    python3 -m py_compile usr/lib/python3*/site-packages/Suno_relay/*.py
    test -x usr/bin/Suno-relay
    test -x usr/bin/Suno-relay-installer
    test -x usr/bin/Suno-relay-session
    grep -Fq "application/x-ms-dos-executable" \
      usr/share/applications/org.projectSuno.RelayInstaller.desktop
    test ! -e etc/xdg/mimeapps.list
    grep -Fq "application/vnd.microsoft.portable-executable" \
      usr/share/mime/packages/Suno-relay.xml
  '

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir"/RPMS/noarch/*.rpm "$output_dir/RPMS/noarch/"
install -m 0644 "$rpmbuild_dir"/SRPMS/*.rpm "$output_dir/SRPMS/"
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno Relay package: %s\n' "$output_dir"
