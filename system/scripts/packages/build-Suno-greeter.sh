#!/bin/sh
# SPDX-License-Identifier: Apache-2.0

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/mobile/Suno-greeter.env"
output_dir=${1:-$repo_root/build/packages/Suno-greeter/aarch64}

for command in sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$command" >&2
    exit 1
  }
done

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT HUP INT TERM
install -d -m 0755 "$stage/SOURCES" "$stage/SPECS" "$output_dir"
install -m 0644 "$repo_root/src/Suno-greeter/Suno-greeter.c" "$stage/SOURCES/"
install -m 0644 "$repo_root/src/Suno-greeter/Suno-greeter-session.c" \
  "$stage/SOURCES/"
install -m 0644 "$repo_root/src/Suno-greeter/Suno-presence-compositor.c" \
  "$stage/SOURCES/"
install -m 0755 "$repo_root/scripts/mobile/Suno-phosh-client-session" \
  "$stage/SOURCES/"
install -m 0644 "$repo_root/src/Suno-greeter/Suno-greeter.css" "$stage/SOURCES/"
install -m 0644 "$repo_root/src/Suno-greeter/README.md" "$stage/SOURCES/"
install -m 0644 "$repo_root/src/Suno-greeter/LICENSE.md" "$stage/SOURCES/"
install -m 0644 "$repo_root/packaging/systemd/30-Suno-greetd-vt.conf" \
  "$stage/SOURCES/"
install -m 0644 "$repo_root/packaging/systemd/Suno-display.sysusers" \
  "$stage/SOURCES/"
install -m 0644 "$repo_root/packaging/systemd/Suno-display.tmpfiles" \
  "$stage/SOURCES/"
install -m 0644 "$repo_root/packaging/polkit/60-Suno-greeter-brightness.rules" \
  "$stage/SOURCES/"
install -m 0644 "$repo_root/packaging/rpm/Suno-greeter.spec" "$stage/SPECS/"

if [ "$(uname -s)" = Linux ] && [ "$(uname -m)" = aarch64 ]; then
  for command in gcc pkg-config rpm rpmbuild; do
    command -v "$command" >/dev/null 2>&1 || {
      printf 'Missing required native AArch64 build command: %s\n' "$command" >&2
      exit 1
    }
  done
  rpm -q gtk4-devel json-glib-devel >/dev/null
  rpmbuild -bb --define "_topdir $stage" "$stage/SPECS/Suno-greeter.spec"
  built_rpm=$(find "$stage/RPMS" -type f -name 'Suno-greeter-*.rpm' -print -quit)
  test -n "$built_rpm"
  rpm -Kv "$built_rpm"
  rpm -qlp "$built_rpm" | grep -qx /usr/bin/Suno-greeter
  rpm -qlp "$built_rpm" | grep -qx /usr/libexec/Suno-greeter-session
  rpm -qlp "$built_rpm" | grep -qx /usr/libexec/Suno-presence-compositor
  rpm -qlp "$built_rpm" | grep -qx /usr/libexec/Suno-phosh-client-session
  rpm -qlp "$built_rpm" | grep -qx /usr/share/Suno-greeter/Suno-greeter.css
  rpm -qlp "$built_rpm" | grep -qx \
    /usr/lib/systemd/system/greetd.service.d/30-Suno-greetd-vt.conf
  rpm -qlp "$built_rpm" | grep -qx \
    /usr/share/polkit-1/rules.d/60-Suno-greeter-brightness.rules
  install -m 0644 "$built_rpm" "$output_dir/"
else
  command -v podman >/dev/null 2>&1 || {
    printf 'Missing required command: podman\n' >&2
    exit 1
  }
  builder_image=${SUNO_RPM_BUILDER_IMAGE:?Set SUNO_RPM_BUILDER_IMAGE to the pinned Fedora 44 builder image}
  podman run --rm --pull=never --platform linux/arm64 \
    -v "$stage:/workspace:Z" \
    -v "$output_dir:/output:Z" \
    "$builder_image" sh -eu -c '
      dnf -y --setopt=install_weak_deps=False \
        install rpm-build gcc gtk4-devel json-glib-devel pkgconfig
      rpmbuild -bb --define "_topdir /workspace" /workspace/SPECS/Suno-greeter.spec
      rpm_path=$(find /workspace/RPMS -type f -name "Suno-greeter-*.rpm" -print -quit)
      test -n "$rpm_path"
      rpm -Kv "$rpm_path"
      rpm -qlp "$rpm_path" | grep -qx /usr/bin/Suno-greeter
      rpm -qlp "$rpm_path" | grep -qx /usr/libexec/Suno-greeter-session
      rpm -qlp "$rpm_path" | grep -qx /usr/libexec/Suno-phosh-client-session
      rpm -qlp "$rpm_path" | grep -qx /usr/share/Suno-greeter/Suno-greeter.css
      rpm -qlp "$rpm_path" | grep -qx \
        /usr/lib/systemd/system/greetd.service.d/30-Suno-greetd-vt.conf
      rpm -qlp "$rpm_path" | grep -qx \
        /usr/share/polkit-1/rules.d/60-Suno-greeter-brightness.rules
      install -m 0644 "$rpm_path" /output/
    '
fi

rpm_path="$output_dir/$SUNO_GREETER_NEVRA.rpm"
test -f "$rpm_path"
sha256sum "$rpm_path"
