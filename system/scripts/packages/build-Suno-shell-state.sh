#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in mktemp podman sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required shell-state package build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] || {
  printf 'error: build the Suno shell-state RPM on a Fedora Linux builder\n' >&2
  exit 1
}
architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$architecture" in
  x86_64) builder_container=$FEDORA_RPM_BUILD_CONTAINER ;;
  aarch64) builder_container=$FEDORA_RPM_BUILD_CONTAINER_AARCH64 ;;
  *) printf 'error: unsupported shell-state builder architecture: %s\n' "$architecture" >&2; exit 1 ;;
esac
export SUNO_RPM_BUILDER_ARCHITECTURE=$architecture

output_dir="$repo_root/build/packages/Suno-shell-state"
mkdir -p "$(dirname "$output_dir")"
work_dir=$(mktemp -d "$output_dir.work.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT
rpmbuild_dir="$work_dir/rpmbuild"
mkdir -p "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

for source in \
  Suno_shell_state.py \
  Suno-shell-state-service \
  Suno-shell-statectl \
  Suno-presentation-profile \
  Suno-presentation-profile.service \
  Suno-device-class-environment \
  org.projectSuno.shell-state.gschema.xml \
  Suno-shell-state.service \
  org.projectSuno.ShellState1.service \
  gtk.css \
  gtk-dark.css \
  gtk4.css \
  gtk4-dark.css \
  Suno-common.css \
  index.theme \
  index-dark.theme \
  gtk-translucent.css \
  gtk4-translucent.css \
  index-translucent.theme \
  Suno-tv-cec \
  Suno-tv-cec@.service \
  70-Suno-tv-cec.rules \
  README.md; do
  install -m 0644 "$repo_root/src/Suno-shell-state/$source" \
    "$rpmbuild_dir/SOURCES/$source"
done
chmod 0755 \
  "$rpmbuild_dir/SOURCES/Suno-shell-state-service" \
  "$rpmbuild_dir/SOURCES/Suno-shell-statectl" \
  "$rpmbuild_dir/SOURCES/Suno-tv-cec" \
  "$rpmbuild_dir/SOURCES/Suno-device-class-environment"
install -m 0644 "$repo_root/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
install -m 0644 "$repo_root/packaging/rpm/Suno-shell-state.spec" \
  "$rpmbuild_dir/SPECS/"

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" \
  "$builder_container" '
    set -euo pipefail
    dnf5 -y install glib2-devel python3 rpm-build systemd-rpm-macros
    glib-compile-schemas --strict --dry-run SOURCES
    python3 -m py_compile \
      SOURCES/Suno_shell_state.py \
      SOURCES/Suno-shell-state-service \
      SOURCES/Suno-shell-statectl
    rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-shell-state.spec
    rpm=$(find RPMS/noarch -name "Suno-shell-state-*.rpm" -print -quit)
    verify=$(mktemp -d)
    cd "$verify"
    rpm2cpio "$OLDPWD/$rpm" >payload.cpio
    cpio -idm --quiet <payload.cpio
    rm payload.cpio
    test -x usr/libexec/Suno-shell-state-service
    test -x usr/bin/Suno-shell-statectl
    test -f usr/share/glib-2.0/schemas/org.projectSuno.shell-state.gschema.xml
    test -L usr/lib/systemd/user/graphical-session.target.wants/Suno-shell-state.service
    test -f usr/share/themes/Suno/gtk-3.0/gtk.css
    test -f usr/share/themes/Suno/gtk-4.0/gtk.css
    test -f usr/share/themes/Suno/gtk-4.0/gtk-dark.css
    test -f usr/share/themes/Suno-dark/gtk-4.0/gtk.css
    test -f usr/share/themes/Suno-dark/gtk-4.0/gtk-dark.css
    test -f usr/share/themes/Suno/gtk-3.0/Suno-common.css
    test -f usr/share/themes/Suno-dark/gtk-3.0/gtk.css
    test -f usr/share/themes/Suno/gtk-3.0/gtk-dark.css
    test -f usr/share/themes/Suno-dark/gtk-3.0/gtk-dark.css
    # Frost and Glass for toolkits that cannot take part in a treatment.
    test -f usr/share/themes/Suno-translucent/gtk-3.0/gtk.css
    test -f usr/share/themes/Suno-translucent/gtk-3.0/Suno-base.css
    test -f usr/share/themes/Suno-translucent/gtk-3.0/Suno-common.css
    test -f usr/share/themes/Suno-translucent/gtk-4.0/gtk.css
    test -f usr/share/themes/Suno-translucent/gtk-4.0/Suno-base.css
    test -f usr/share/themes/Suno-translucent/index.theme
    grep -Fq "@define-color Suno_header_opaque #f7f8f8;" usr/share/themes/Suno-translucent/gtk-3.0/gtk.css
    grep -Fq "@define-color Suno_header_opaque #f7f8f8;" usr/share/themes/Suno-translucent/gtk-4.0/gtk.css
    grep -Fq "GtkTheme=Suno-translucent" usr/share/themes/Suno-translucent/index.theme
    grep -Fq "gtk-contained-dark.css" usr/share/themes/Suno/gtk-3.0/gtk-dark.css
    grep -Fq "headerbar.Suno-pane-toolbar" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    test -f usr/share/themes/Suno-dark/gtk-3.0/Suno-common.css
    grep -Fq "gtk-contained-dark.css" usr/share/themes/Suno-dark/gtk-3.0/gtk.css
    grep -Fq "headerbar button.titlebutton" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "headerbar button.Suno-identity-button" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "headerbar box.Suno-identity-button" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "window.Suno-hdy-native-window:not(.Suno-no-native-surfaces) .Suno-native-work-surface" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "  margin: 9px 9px 9px;" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "  padding: 0 8px 0 12px;" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "headerbar .Suno-identity-label" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    ! grep -Fq "font-weight: 650" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "phosh-top-panel" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "headerbar .Suno-command-bar {" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "headerbar .Suno-command-group > button:first-child:dir(rtl)" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "leaflet.Suno-split-leaflet > *:not(separator)" usr/share/themes/Suno/gtk-3.0/Suno-common.css
    grep -Fq "<key name=\"shelf-arrangement\" type=\"aa{sv}\">" \
      usr/share/glib-2.0/schemas/org.projectSuno.shell-state.gschema.xml
    grep -Fq "def normalize_arrangement" usr/libexec/Suno-shell-state/Suno_shell_state.py
    grep -Fq "<key name=\"shelf-free-placement\" type=\"b\">" \
      usr/share/glib-2.0/schemas/org.projectSuno.shell-state.gschema.xml
    grep -Fq "arrangement=self._arrangement()" usr/libexec/Suno-shell-state-service
    grep -Fq "org.projectSuno.ShellState1" \
      usr/share/dbus-1/services/org.projectSuno.ShellState1.service
  '

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir"/RPMS/noarch/*.rpm "$output_dir/RPMS/noarch/"
install -m 0644 "$rpmbuild_dir"/SRPMS/*.rpm "$output_dir/SRPMS/"
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno shell-state package: %s\n' "$output_dir"
