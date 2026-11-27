#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

required_tools=(flock git gzip mktemp sha256sum tar)
if [ "${SUNO_RPM_BUILDER_DIRECT:-0}" != 1 ]; then
  required_tools+=(podman)
fi
for tool in "${required_tools[@]}"; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required Suno platform build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] || {
  printf 'error: build Suno platform RPMs on a Fedora Linux builder\n' >&2
  exit 1
}
architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$architecture" in
  x86_64|aarch64) ;;
  *) printf 'error: unsupported Suno platform architecture: %s\n' "$architecture" >&2; exit 1 ;;
esac
if [ -n "${SUNO_TARGET_ARCHITECTURE:-}" ]; then
  export SUNO_RPM_BUILDER_ARCHITECTURE=$architecture
fi
builder_container=$FEDORA_RPM_BUILD_CONTAINER
if [ "$architecture" = aarch64 ]; then
  builder_container=$FEDORA_RPM_BUILD_CONTAINER_AARCH64
fi

output_dir="$repo_root/build/packages/Suno-developer-platform/$architecture"
install -d -m 0755 "$repo_root/build/packages"
work_dir="$repo_root/build/packages/Suno-developer-platform.$architecture.work"
lock_file="$repo_root/build/packages/.Suno-developer-platform.$architecture.lock"
if [ "${SUNO_PLATFORM_BUILD_LOCKED:-0}" != 1 ]; then
  exec flock --close "$lock_file" \
    env SUNO_PLATFORM_BUILD_LOCKED=1 "$0" "$@"
fi
rm -rf "$work_dir"
install -d -m 0755 "$work_dir"
cleanup_workdir() {
  if [ "${SUNO_KEEP_FAILED_BUILD:-0}" = 1 ]; then
    return
  fi
  if [ -n "${SUNO_RPM_BUILDER_EXISTING:-}" ]; then
    podman exec --user root "$SUNO_RPM_BUILDER_EXISTING" rm -rf "$work_dir"
  else
    rm -rf "$work_dir"
  fi
}
trap cleanup_workdir EXIT INT TERM
rpmbuild_dir="$work_dir/rpmbuild"
source_dir="$work_dir/Suno-developer-platform"
install -d -m 0755 "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS} "$source_dir"
cp -R "$repo_root/src/Suno-platform/." "$source_dir/"
# The installed Application Kit must carry the same action glyphs available in
# the Prairie theme. Apps may use another active icon theme at runtime.
install -d "$source_dir/appkit/Suno_appkit/icons"
install -m 0644 "$repo_root"/assets/icon-theme/Prairie/symbolic/actions/SunoUI-*.svg \
  "$source_dir/appkit/Suno_appkit/icons/"
find "$source_dir" -type d -name build -prune -exec rm -rf {} +
source_date_epoch=${SOURCE_DATE_EPOCH:-$(git -c safe.directory="$repo_root" -C "$repo_root" log -1 --format=%ct HEAD)}
case "$source_date_epoch" in
  ''|*[!0-9]*)
    printf 'error: source date epoch must be an unsigned integer\n' >&2
    exit 1
    ;;
esac
tar -C "$work_dir" --sort=name --mtime="@$source_date_epoch" --owner=0 --group=0 \
  --numeric-owner -cf - Suno-developer-platform | gzip -n >"$rpmbuild_dir/SOURCES/Suno-developer-platform.tar.gz"
install -m 0644 "$repo_root/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
install -m 0644 "$repo_root/packaging/rpm/Suno-developer-platform.spec" "$rpmbuild_dir/SPECS/"
touch -d "@$source_date_epoch" "$rpmbuild_dir"/SOURCES/* "$rpmbuild_dir"/SPECS/*

# The platform builds and runs its checks against Suno's toolkit, not Fedora's.
# The Glass surface-parity check renders a window that never loads the kit and
# compares its title band with a kit window's; against the stock toolkit there
# is no treatment on either of them and the comparison measures nothing.
libadwaita_rpms="$repo_root/build/packages/libadwaita/RPMS/$architecture"
install -d -m 0755 "$rpmbuild_dir/Suno-toolkit"
toolkit_copied=0
for toolkit_rpm in "$libadwaita_rpms"/libadwaita-*.rpm; do
  [ -f "$toolkit_rpm" ] || continue
  install -m 0644 "$toolkit_rpm" "$rpmbuild_dir/Suno-toolkit/"
  toolkit_copied=$((toolkit_copied + 1))
done
if [ "$toolkit_copied" -lt 2 ]; then
  printf 'error: found %s libadwaita RPMs in %s; build %s first with scripts/packages/build-libadwaita.sh\n' \
    "$toolkit_copied" "$libadwaita_rpms" "$LIBADWAITA_NEVRA" >&2
  exit 1
fi
libadwaita_nevra=libadwaita-1.9.3-${LIBADWAITA_SUNO_RELEASE}.fc44.$architecture
if [ ! -f "$rpmbuild_dir/Suno-toolkit/$libadwaita_nevra.rpm" ]; then
  printf 'error: %s is not among the built toolkit RPMs in %s\n' \
    "$libadwaita_nevra" "$libadwaita_rpms" >&2
  exit 1
fi

builder_command='
    set -euo pipefail
    export ATSPI_DBUS_IMPLEMENTATION=dbus-daemon
    build_log=$(mktemp)
    cleanup_log() {
      cp "$build_log" "$PWD/package-check.log"
      rm -f "$build_log"
    }
    trap cleanup_log EXIT INT TERM
    if ! dnf5 -q -y --setopt=exclude= install ./Suno-toolkit/libadwaita-*.rpm >"$build_log" 2>&1; then
      cat "$build_log" >&2
      exit 1
    fi
    if ! dnf5 -q -y --setopt=exclude= install \
      appstream desktop-file-utils \
      gcc glib2-devel gobject-introspection-devel gtk4-devel \
      libadwaita-devel meson ninja-build pkgconf-pkg-config \
      python3-devel python3-gobject python3-cairo python3-pyyaml redhat-rpm-config rpm-build \
      systemd-rpm-macros dbus-daemon weston xdotool xorg-x11-server-Xvfb xorg-x11-xauth \
      gstreamer1 gstreamer1-plugins-base gstreamer1-plugins-good >"$build_log" 2>&1; then
      cat "$build_log" >&2
      exit 1
    fi
    if ! rpmbuild -ba --define "_topdir $PWD" \
      SPECS/Suno-developer-platform.spec >"$build_log" 2>&1; then
      cat "$build_log" >&2
      exit 1
    fi
    printf "Suno Developer Platform RPM build and package checks passed.\n"
  '

if [ "${SUNO_RPM_BUILDER_DIRECT:-0}" = 1 ]; then
  [ "$(rpm --eval '%{_arch}')" = "$architecture" ] || {
    printf 'error: native platform builder does not match target architecture\n' >&2
    exit 1
  }
  (
    cd "$rpmbuild_dir"
    /bin/bash -lc "$builder_command"
  )
else
  "$repo_root/scripts/packages/run-in-rpm-builder.sh" \
    "$rpmbuild_dir" "$builder_container" "$builder_command"
fi

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir/package-check.log" "$output_dir/PACKAGE-CHECKS.log"
find "$rpmbuild_dir/RPMS" -type f -name '*.rpm' -exec install -m 0644 {} "$output_dir/RPMS/" \;
find "$rpmbuild_dir/SRPMS" -type f -name '*.rpm' -exec install -m 0644 {} "$output_dir/SRPMS/" \;
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = Enforcing ]; then
  chcon -R -t container_file_t -l s0 "$output_dir"
fi
printf 'Suno Developer Platform packages: %s\n' "$output_dir"
