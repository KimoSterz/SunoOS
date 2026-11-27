#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Build the architecture-independent Leaf RPM in a Fedora builder container.
#   scripts/packages/build-Suno-leaf.sh [container-image]
set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
output_dir="$repo_root/build/packages/Suno-leaf"
mkdir -p "$repo_root/build"
work_dir=$(mktemp -d "$repo_root/build/Suno-leaf.work.XXXXXX")
# The ordinary-user WebKit check must traverse this disposable source parent.
# mktemp defaults to 0700 even though the child rpmbuild tree is delegated.
chmod 0755 "$work_dir"
trap 'rm -rf "$work_dir"' EXIT INT TERM
mkdir -p "$work_dir"/rpmbuild/{SOURCES,SPECS}
# The package check starts the real application, which needs the pinned Suno
# Developer Platform for this machine's architecture.
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"
image=${1:-$FEDORA_RPM_BUILD_CONTAINER}
case "$(uname -m)" in
  x86_64) platform_nevra=$SUNO_DEVELOPER_PLATFORM_X86_64_NEVRA ;;
  aarch64) platform_nevra=$SUNO_DEVELOPER_PLATFORM_AARCH64_NEVRA ;;
  *) printf 'error: unsupported Leaf build architecture: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac
platform_rpm=${SUNO_PLATFORM_RPM:-$repo_root/build/packages/Suno-developer-platform/$(uname -m)/RPMS/$platform_nevra.rpm}
[ -f "$platform_rpm" ] || {
  printf 'error: build %s before Leaf: %s\n' "$platform_nevra" "$platform_rpm" >&2
  exit 1
}
mkdir -p "$work_dir/rpmbuild/platform"
cp "$platform_rpm" "$work_dir/rpmbuild/platform/"
# Upgrade the exact SDK tuple together in a development builder.
platform_dir=$(dirname "$platform_rpm")
for pattern in Suno-developer-platform-devel-*.rpm Suno-developer-platform-sdk-*.rpm; do
  for artifact in "$platform_dir"/$pattern; do
    [ ! -f "$artifact" ] || cp "$artifact" "$work_dir/rpmbuild/platform/"
  done
done
# The tarball mirrors the repository (src/<app> and tests/fixtures) because
# the tests find their fixtures by path from the repository root; the spec's
# %autosetup -n points into src/<app>.
mkdir -p "$work_dir/Suno-leaf/src"
cp -R "$repo_root/src/Suno-leaf" "$work_dir/Suno-leaf/src/Suno-leaf"
mkdir -p "$work_dir/Suno-leaf/tests/fixtures"
cp -R "$repo_root/tests/fixtures/leaf-v70.json" "$work_dir/Suno-leaf/tests/fixtures/"
cp -R "$repo_root/tests/fixtures/leaf-covers" "$work_dir/Suno-leaf/tests/fixtures/"
find "$work_dir/Suno-leaf" -type d -name __pycache__ -prune -exec rm -rf {} +
source_date_epoch=${SOURCE_DATE_EPOCH:-$(git -C "$repo_root" log -1 --format=%ct HEAD)}
tar -C "$work_dir" --sort=name --mtime="@$source_date_epoch" --owner=0 --group=0 --numeric-owner \
  -cf - Suno-leaf | gzip -n >"$work_dir/rpmbuild/SOURCES/Suno-leaf.tar.gz"
install -m 0644 "$repo_root/LICENSE.md" "$work_dir/rpmbuild/SOURCES/LICENSE.md"
install -m 0644 "$repo_root/packaging/rpm/Suno-leaf.spec" "$work_dir/rpmbuild/SPECS/"

bash "$repo_root/scripts/packages/run-in-rpm-builder.sh" "$work_dir/rpmbuild" "$image" '
  set -euo pipefail
  dnf -q -y install platform/*.rpm rpm-build python3-devel \
    desktop-file-utils libappstream-glib dbus-daemon gtk4 libadwaita python3-gobject webkitgtk6.0 \
    xorg-x11-server-Xvfb >/dev/null
  rpmspec -q --buildrequires SPECS/Suno-leaf.spec | xargs -r -d "\n" dnf5 -q -y install
  if [ "$(id -u)" = 0 ]; then
    # The reader checks must exercise WebKit as an ordinary desktop user.
    # Keep its native sandbox enabled, with the complete normal RPM checks.
    id conform >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash conform
    work=$PWD
    chown -R conform:conform "$work"
    test_home=$(mktemp -d "$work/check-home.XXXXXX")
    install -d -o conform -g conform -m0700 "$test_home" "$test_home/runtime"
    install -d -o conform -g conform "$test_home/config" "$test_home/data" "$test_home/cache" "$test_home/state"
    runuser -u conform -- env XDG_RUNTIME_DIR="$test_home/runtime" \
      XDG_CONFIG_HOME="$test_home/config" XDG_DATA_HOME="$test_home/data" \
      XDG_CACHE_HOME="$test_home/cache" XDG_STATE_HOME="$test_home/state" \
      GIO_USE_VFS=local GDK_BACKEND=x11 \
      rpmbuild -ba --define "_topdir $work" SPECS/Suno-leaf.spec
  else
    rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-leaf.spec
  fi
'
rm -rf "$output_dir"
install -d "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$work_dir"/rpmbuild/RPMS/noarch/*.rpm "$output_dir/RPMS/noarch/"
install -m 0644 "$work_dir"/rpmbuild/SRPMS/*.rpm "$output_dir/SRPMS/"
(cd "$output_dir" && find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS)
printf 'Leaf packages: %s\n' "$output_dir"
