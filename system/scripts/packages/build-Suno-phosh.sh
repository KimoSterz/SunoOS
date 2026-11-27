#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/mobile/phosh-source.env"

for tool in curl patch rpmbuild sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required Suno Phosh build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] && [ "$(uname -m)" = aarch64 ] || {
  printf 'error: build Suno Phosh on the Fedora AArch64 builder\n' >&2
  exit 1
}

output_dir="$repo_root/build/packages/Suno-phosh/aarch64"
install -d -m 0755 "$repo_root/build/packages"
# Keep compiler probes and build products on the builder's executable
# temporary filesystem.  The repository can live on a capacity-oriented
# noexec mount; only the verified RPM artifacts need to be copied back there.
work_dir=$(mktemp -d /tmp/Suno-phosh.work.XXXXXX)
trap 'rm -rf "$work_dir"' EXIT INT TERM
rpmbuild_dir="$work_dir/rpmbuild"
install -d -m 0755 "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

fetch_verified() {
  local url=$1 expected=$2 destination=$3 actual local_copy
  # A builder with no route to the upstream forges can supply the pinned
  # tarballs locally. The hash below is still checked, so the source is
  # identical either way.
  local_copy="${SUNO_PHOSH_SOURCE_DIR:-}/$(basename "$url")"
  if [ -n "${SUNO_PHOSH_SOURCE_DIR:-}" ] && [ -f "$local_copy" ]; then
    cp -- "$local_copy" "$destination"
  else
    curl -fsSL "$url" -o "$destination"
  fi
  actual=$(sha256sum "$destination" | cut -d ' ' -f 1)
  [ "$actual" = "$expected" ] || {
    printf 'error: source hash mismatch for %s: %s\n' "$destination" "$actual" >&2
    exit 1
  }
}

fetch_verified "$SUNO_PHOSH_URL" "$SUNO_PHOSH_SHA256" \
  "$rpmbuild_dir/SOURCES/phosh-$SUNO_PHOSH_COMMIT.tar.gz"
fetch_verified "$SUNO_PHOSH_GVC_URL" "$SUNO_PHOSH_GVC_SHA256" \
  "$rpmbuild_dir/SOURCES/libgnome-volume-control-$SUNO_PHOSH_GVC_COMMIT.tar.gz"
fetch_verified "$SUNO_PHOSH_CALL_UI_URL" "$SUNO_PHOSH_CALL_UI_SHA256" \
  "$rpmbuild_dir/SOURCES/libcall-ui-$SUNO_PHOSH_CALL_UI_VERSION.tar.gz"

install -m 0644 \
  "$repo_root/patches/phosh/0001-Suno-handheld-home-dock-search.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0002-Suno-status-order-search-purpose.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0003-Suno-quiet-session-handoff.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0004-Suno-fold-quick-options-before-first-frame.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0005-Suno-publish-first-complete-home-frame.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0006-Suno-commit-initial-folded-drag-state.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0007-Suno-presence-session-lock.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0008-Suno-theme-native-lockscreen.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0009-Suno-foreground-app-status-surface.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0010-Suno-semantic-status-surfaces.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0011-Suno-wallpaper-status-continuity.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0012-Suno-notification-system.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0013-Suno-responsive-quick-options-dismiss.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0014-Suno-notification-quick-options-fixups.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0015-Suno-notification-lifecycle.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0016-Suno-shared-search-client.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0017-Suno-physical-lock-carousel.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0018-Suno-single-owner-touch-drawers.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/phosh/0019-Suno-bound-favorite-dock.patch" \
  "$repo_root/patches/phosh/0020-Suno-gtk3-font-weights.patch" \
  "$repo_root/patches/phosh/0021-Suno-status-icon-proportions.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/packaging/systemd/90-Suno-phosh.conf" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/packaging/rpm/Suno-phosh.spec" \
  "$rpmbuild_dir/SPECS/"

rpmbuild -ba --define "_topdir $rpmbuild_dir" \
  --define "use_source_date_epoch_as_buildtime 1" \
  "$rpmbuild_dir/SPECS/Suno-phosh.spec"

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS" "$output_dir/SRPMS"
find "$rpmbuild_dir/RPMS" -type f -name '*.rpm' \
  -exec install -m 0644 {} "$output_dir/RPMS/" \;
find "$rpmbuild_dir/SRPMS" -type f -name '*.rpm' \
  -exec install -m 0644 {} "$output_dir/SRPMS/" \;
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno Phosh packages: %s\n' "$output_dir"
