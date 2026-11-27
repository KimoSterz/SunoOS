#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in cpio curl mktemp podman rpm2cpio sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required RPM build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] || {
  printf 'error: build the Suno libadwaita RPM on a Fedora Linux host\n' >&2
  exit 1
}

architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$architecture" in
  x86_64)
    builder_container=$FEDORA_RPM_BUILD_CONTAINER
    package_nevra=$LIBADWAITA_NEVRA
    ;;
  aarch64)
    builder_container=$FEDORA_RPM_BUILD_CONTAINER_AARCH64
    package_nevra=libadwaita-1.9.3-${LIBADWAITA_SUNO_RELEASE}.fc44.aarch64
    ;;
  *)
    printf 'error: unsupported libadwaita target architecture: %s\n' "$architecture" >&2
    exit 1
    ;;
esac
export SUNO_RPM_BUILDER_ARCHITECTURE=$architecture

cache_dir="$repo_root/build/cache/srpm"
output_dir="$repo_root/build/packages/libadwaita"
mkdir -p "$cache_dir" "$output_dir"

srpm="$cache_dir/$LIBADWAITA_SRPM"
bash "$repo_root/scripts/packages/fetch-source-rpm.sh" \
  "$srpm" "$LIBADWAITA_SRPM_SHA256" "$LIBADWAITA_SRPM_URL"

printf '%s  %s\n' "$LIBADWAITA_SRPM_SHA256" "$srpm" |
  sha256sum --check --status || {
    printf 'error: libadwaita source RPM checksum mismatch\n' >&2
    exit 1
  }

work_dir=$(mktemp -d "$output_dir/work.XXXXXX")
extract_dir="$work_dir/srpm"
rpmbuild_dir="$work_dir/rpmbuild"
mkdir -p "$extract_dir" "$rpmbuild_dir/BUILD" "$rpmbuild_dir/BUILDROOT" \
  "$rpmbuild_dir/RPMS" "$rpmbuild_dir/SOURCES" \
  "$rpmbuild_dir/SPECS" "$rpmbuild_dir/SRPMS"

(
  cd "$extract_dir"
  rpm2cpio "$srpm" >payload.cpio
  cpio -idm --quiet <payload.cpio
  rm -f payload.cpio
)

mv "$extract_dir/libadwaita.spec" "$rpmbuild_dir/SPECS/"
find "$extract_dir" -maxdepth 1 -type f -exec mv -t "$rpmbuild_dir/SOURCES" {} +
install -m 0644 \
  "$repo_root/patches/libadwaita/0001-Suno-light-design-system.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0002-Suno-title-label-metrics.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0003-Suno-title-label-baseline.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0004-prairie-generic-headerbar-contract.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0005-Suno-application-components.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0006-stylesheet-add-shared-Suno-work-islands.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0007-Suno-application-window-elevation.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0008-Suno-connected-window-controls.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0009-Suno-appkit-component-boundaries.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0010-Suno-native-surface-integrity-and-global-chrome.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0011-Suno-native-command-surfaces.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0012-Suno-generic-application-identity.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0013-Suno-stable-backdrop-materials.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0014-Suno-native-application-surfaces.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0015-Suno-application-identity-resolution.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0016-Suno-generic-command-row.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0017-Suno-native-surface-rhythm.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0018-Suno-identity-title-duplicates.patch" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 \
  "$repo_root/patches/libadwaita/0019-Suno-dark-design-system.patch" \
  "$repo_root/patches/libadwaita/0020-Suno-title-slot-and-sidebar-islands.patch" \
  "$repo_root/patches/libadwaita/0021-Suno-split-island-shadows.patch" \
  "$repo_root/patches/libadwaita/0022-Suno-sidebar-pane-command-host.patch" \
  "$repo_root/patches/libadwaita/0023-Suno-one-title-row-per-window.patch" \
  "$repo_root/patches/libadwaita/0024-Suno-menu-contract.patch" \
  "$rpmbuild_dir/SOURCES/"

cp "$repo_root/patches/libadwaita/0025-Suno-decision-sheets.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0026-Suno-shared-preferences-surfaces.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0027-Suno-quiet-workflow-surfaces.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0028-test-fixtures-use-fat-object-links.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0029-Suno-adaptive-navigation-contrast.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0030-Suno-shared-navigation-islands.patch" "$rpmbuild_dir/SOURCES/"

cp "$repo_root/patches/libadwaita/0031-Suno-native-workflow-material-ownership.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0032-Suno-focus-invariant-window-elevation.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0033-Suno-compact-menu-width.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0034-Suno-maximized-window-corners.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0036-Suno-tiled-window-corners.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0037-Suno-identity-inset-and-pointer-state.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0038-Suno-header-ink-and-tiled-stroke.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0039-Suno-quiet-filled-controls.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0040-Suno-frost-glass-light-title-rows.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0041-Suno-frost-glass-frosted-title-band.patch" "$rpmbuild_dir/SOURCES/"
cp "$repo_root/patches/libadwaita/0042-Suno-one-glass-material-for-every-window.patch" "$rpmbuild_dir/SOURCES/"

install -m 0644 "$repo_root/patches/libadwaita/0043-Suno-preserve-generic-client-layout.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/toolkit-native/generic-client.py" "$rpmbuild_dir/SOURCES/"

(
  cd "$rpmbuild_dir/SPECS"
  # Image-based hosts ship git but not patch; both refuse fuzz here.
  if command -v patch >/dev/null 2>&1; then
    patch --batch --forward --fuzz=0 -p1 \
      <"$repo_root/patches/libadwaita/0000-Suno-fedora-spec.patch"
  elif command -v git >/dev/null 2>&1; then
    GIT_CEILING_DIRECTORIES="$rpmbuild_dir" git apply -p1 --whitespace=nowarn "$repo_root/patches/libadwaita/0000-Suno-fedora-spec.patch"
  else
    printf 'error: patch or git is needed to apply the libadwaita spec patch\n' >&2
    exit 1
  fi
)
# A spec patch that applied as a no-op builds the stock package; the Release
# says whether it applied (scripts/packages/spec-release.sh).
. "$repo_root/scripts/packages/spec-release.sh"
Suno_assert_spec_release "$rpmbuild_dir/SPECS/libadwaita.spec" \
  "$LIBADWAITA_SUNO_RELEASE" || exit 1

# Match the shared toolkit provider to this target and release. A stock
# builder GTK would make the generic-client surface checks measure another UI.
gtk_nevra=${GTK4_NEVRA%.x86_64}.$architecture
gtk_dir="$repo_root/build/packages/gtk4/RPMS/$architecture"
[ -f "$gtk_dir/$gtk_nevra.rpm" ] || {
  printf 'error: build the matching GTK4 provider first: %s\n' "$gtk_nevra" >&2
  exit 1
}
install -d -m 0755 "$rpmbuild_dir/Suno-toolkit"
for built in "$gtk_dir"/gtk4-*.rpm; do
  [ -f "$built" ] || continue
  case "$(basename "$built")" in *-debuginfo-*|*-debugsource-*) continue ;; esac
  install -m 0644 "$built" "$rpmbuild_dir/Suno-toolkit/"
done

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" \
  "$builder_container" '
    set -euo pipefail
    dnf5 -y install rpm-build dnf5-plugins
    dnf5 -y install ./Suno-toolkit/gtk4-*.rpm
    dnf5 -y builddep SPECS/libadwaita.spec
    rpmbuild -ba --noclean --define "_smp_build_ncpus 4" --define "_topdir $PWD" SPECS/libadwaita.spec

    topdir=$PWD
    main_rpm=$(find "$topdir/RPMS/'"$architecture"'" -maxdepth 1 -type f \
      -name "libadwaita-[0-9]*.rpm" -print -quit)
    test -n "$main_rpm"
    verify_dir=$(mktemp -d)
    cd "$verify_dir"
    rpm2cpio "$main_rpm" >payload.cpio
    cpio -idm --quiet <payload.cpio
    rm -f payload.cpio
    gresource extract ./usr/lib64/libadwaita-1.so.0 \
      /org/gnome/Adwaita/styles/gtk.css >gtk.css
    grep -Fq "@define-color headerbar_bg_color #f2f3f5" gtk.css
    grep -Fq -- "--accent-blue: #4878b8" gtk.css
    grep -Fq "headerbar { min-height: 42px" gtk.css
    grep -Fq ".Suno-title-label { min-height: 22px; padding: 4px 0 0; font-family: \"Figtree\"; font-size: 12.5px; font-weight: 600; }" gtk.css
    grep -Fq "@define-color Suno_window #f1f2f3" gtk.css
    grep -Fq "@define-color Suno_window #21252b" gtk.css
    grep -Fq "@define-color Suno_content #fbfbfa" gtk.css
    grep -Fq "@define-color Suno_content #2a2e34" gtk.css
    grep -Fq "headerbar .Suno-identity-button > button" gtk.css
    grep -Fq "headerbar .Suno-identity-icon { min-width: 22px; min-height: 22px; border-radius: 6px; }" gtk.css
    grep -Fq "headerbar .Suno-identity-icon > image { -gtk-icon-size: 20px; }" gtk.css
    grep -Fq ".Suno-window-body { padding: 0 9px 9px; }" gtk.css
    grep -Fq "0 10px 20px -14px RGB(25 27 31/40%)" gtk.css
    grep -Fq ".Suno-island { background-color: @Suno_content; border: 1px solid @Suno_line; border-radius: 10px; box-shadow: 0 2px 5px RGB(25 27 31/16%), 0 18px 36px -16px RGB(25 27 31/48%); }" gtk.css
    grep -Fq ".Suno-command-bar { min-height: 40px; margin: 0 9px 8px; padding: 0 8px; border: 1px solid @Suno_line; border-radius: 10px; background-color: @Suno_content" gtk.css
    grep -Fq ".Suno-command-group > button, .Suno-command-group > menubutton > button { min-width: 30px; min-height: 30px" gtk.css
    grep -Fq "window.Suno-app-window headerbar.Suno-titlebar:backdrop > windowhandle { filter: none; transition: none; }" gtk.css
    grep -Fq "window.Suno-app-window .Suno-command-bar:backdrop, window.Suno-app-window .Suno-island:backdrop { background-color: @Suno_content" gtk.css
    grep -Fq "window.Suno-files-window, window.Suno-calculator-window, window.Suno-app-window" gtk.css
    grep -Fq "0 54px 110px -28px RGB(25 27 31/56%)" gtk.css
    grep -Fq "0 64px 120px -30px RGB(9 11 14/82%)" gtk.css
    grep -Fq "headerbar windowcontrols, windowcontrols.Suno-window-controls" gtk.css
    grep -Fq "background-color: @Suno_content" gtk.css
    grep -Fq "margin-top: 9px" gtk.css
    ! grep -Fq "overflow: hidden" gtk.css
    grep -Fq ".Suno-island-split > .sidebar-pane, .Suno-island-split > .content-pane { background-color: transparent; border: none; outline: none; box-shadow: none; --shade-color: transparent; }" gtk.css
    ! grep -Fq "windowtitle .title, .Suno-title-label" gtk.css
    grep -Fq "windowtitle .title { min-height: 16px; }" gtk.css
    grep -Fq "headerbar button.image-button > image, headerbar menubutton > button > image { -gtk-icon-size: 14px; color: var(--headerbar-fg-color); }" gtk.css
    grep -Fq "headerbar windowcontrols > button > image, headerbar windowcontrols > button.image-button > image { -gtk-icon-size: 10px; }" gtk.css
    grep -Fq -- "-gtk-icon-size: 11px" gtk.css
    grep -Fq ".collapse-spacing { padding-top: 0; padding-bottom: 0; }" gtk.css
    grep -Fq "windowcontrols > button, windowcontrols > button.image-button { min-width: 20px; min-height: 20px; padding: 0; }" gtk.css
    grep -Fq "toolbarview > .top-bar { background-color: var(--headerbar-bg-color); color: var(--headerbar-fg-color); }" gtk.css
    # Patch0032 replaced the historical focus-dependent decoration recipe.
    grep -Fq "window.csd.maximized:not(.fullscreen) { --window-radius: 15px; border-radius: var(--window-radius); outline: none; }" gtk.css
    grep -Fq -- "--window-radius: 0px" gtk.css
    grep -Fq "0 54px 110px -28px RGB(25 27 31/56%)" gtk.css
    grep -Fq ".navigation-sidebar > row { border-radius: 8px; min-height: 14px; padding: 7px 11px; margin: 1px 10px; color: var(--sidebar-fg-color); font-size: 12.5px; }" gtk.css
    grep -Fq ".navigation-sidebar > row:selected:hover, .navigation-sidebar > row:selected.has-open-popup { background-color: color-mix(in srgb, currentColor 13%, transparent); }" gtk.css
    grep -aFq "#4878b8" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-automatic-identity" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-no-automatic-identity" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "notify::application" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-identity-display" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-native-window" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-adw-native-window" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-native-work-surface" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-window-toolbar-view" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-split-surface" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-command-title" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-command-host" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-pane-command-host" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-window-title-row" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-pane-toolbar" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-no-command-row" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-has-command-row" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-repeats-identity" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "adw-Suno-work-surface-overflow" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "application-x-executable" ./usr/lib64/libadwaita-1.so.0
    grep -Fq "headerbar.Suno-command-host { padding: 0; }" gtk.css
    grep -Fq "headerbar.Suno-command-host > windowhandle { min-height: 42px; }" gtk.css
    grep -Fq "headerbar.Suno-command-host > .Suno-command-bar { margin: 0 9px 8px; }" gtk.css
    grep -Fq "headerbar windowtitle.Suno-repeats-identity { opacity: 0; }" gtk.css
    grep -Fq "headerbar box.Suno-identity-button { min-height: 24px; padding: 5px 8px 5px 4px; border-radius: 10px;" gtk.css
    grep -Fq "@define-color view_bg_color #2a2e34" gtk.css
    grep -Fq "@define-color window_bg_color #21252b" gtk.css
    # Patch0041: frost and glass title rows are a frosted band, not a veil.
    grep -Fq "#161b20" gtk.css
    # Patch0042: one material for every window. The treatment class no longer
    # depends on an application using the kit window, the title band, menus
    # and popovers take one veil, and islands are opaque paper.
    #
    # These are the values, not the word "glass": a rule that names an
    # undefined colour is dropped by GTK without a word, which is how the
    # title band went missing in every application outside the kit. Each of
    # these has been seen to fail against a build without Patch0042.
    #
    # No apostrophes in here. This whole block is a single-quoted argument,
    # and one apostrophe ends it: the container then receives a different
    # command, which is how two icon checks ran against nothing for
    # seventeen releases (docs/development/checks-that-check-nothing.md).
    grep -Fq -- "--Suno-veil: rgba(250, 250, 251, 0.85)" gtk.css
    grep -Fq -- "--Suno-veil: rgba(248, 249, 250, 0.90)" gtk.css
    grep -Fq -- "--Suno-paper: #fbfbfa" gtk.css
    grep -Fq "linear-gradient(to bottom, var(--Suno-veil), var(--Suno-veil))" gtk.css
    grep -Fq "background-color: var(--Suno-paper)" gtk.css
    grep -Fq "background-color: var(--Suno-veil)" gtk.css
    # The title band must not name a colour this stylesheet does not define.
    ! grep -Fq "linear-gradient(to bottom, @Suno_chrome, @Suno_chrome)" gtk.css
    # Plain text on a translucent surface.
    grep -Fq "text-shadow: none; -gtk-icon-shadow: none;" gtk.css
    # The style manager applies the treatment to every toplevel and redefines
    # the palette names for it, which is what makes every existing Suno rule
    # in this sheet follow the treatment without being touched.
    grep -aFq "Suno-treatment-glass" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "Suno-treatment-frost" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "org.projectSuno.shell-state" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "@define-color Suno_chrome rgba(250,250,251,0.85);" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "@define-color Suno_island #ffffff;" ./usr/lib64/libadwaita-1.so.0
    grep -aFq "@define-color Suno_window rgba(255,255,255,0.30);" ./usr/lib64/libadwaita-1.so.0
    # And the title row paints nothing, whether or not the window is csd.
    grep -Fq "window.Suno-treatment-frost, window.Suno-treatment-glass { --headerbar-bg-color: transparent" gtk.css
  '

stable_rpms="$output_dir/RPMS/$architecture"
stable_srpms="$output_dir/SRPMS"
rm -rf "$stable_rpms" "$output_dir/SHA256SUMS"
install -d -m 0755 "$stable_rpms" "$stable_srpms"
install -m 0644 \
  "$rpmbuild_dir/RPMS/$architecture/$package_nevra.rpm" \
  "$stable_rpms/"
# The rest of the binary packages as well. The platform package builds and
# runs its checks against this toolkit, not Fedora's, so it needs -devel from
# the same build; copying only the library left it silently on the stock one.
# A copy that produced nothing must say so, so the count is asserted.
copied=0
for built in "$rpmbuild_dir/RPMS/$architecture"/libadwaita-*.rpm; do
  [ -f "$built" ] || continue
  install -m 0644 "$built" "$stable_rpms/"
  copied=$((copied + 1))
done
if [ "$copied" -lt 2 ]; then
  printf 'error: copied %s libadwaita RPMs from %s, expected the library and at least -devel\n' \
    "$copied" "$rpmbuild_dir/RPMS/$architecture" >&2
  exit 1
fi
install -m 0644 \
  "$rpmbuild_dir/SRPMS/libadwaita-1.9.3-${LIBADWAITA_SUNO_RELEASE}.fc44.src.rpm" \
  "$stable_srpms/"

(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno libadwaita packages: %s\n' "$output_dir"
