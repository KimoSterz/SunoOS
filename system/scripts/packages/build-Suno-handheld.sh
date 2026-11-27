#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in mktemp podman sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required handheld package build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  printf 'error: build the Suno handheld RPM on the canonical Linux/x86_64 builder\n' >&2
  exit 1
fi

output_dir="$repo_root/build/packages/Suno-handheld"
mkdir -p "$(dirname "$output_dir")"
work_dir=$(mktemp -d "$output_dir.work.XXXXXX")
rpmbuild_dir="$work_dir/rpmbuild"
mkdir -p "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

install -m 0644 "$repo_root/extensions/Suno-handheld/extension.js" \
  "$rpmbuild_dir/SOURCES/extension.js"
install -m 0644 "$repo_root/extensions/Suno-handheld/metadata.json" \
  "$rpmbuild_dir/SOURCES/metadata.json"
install -m 0644 "$repo_root/extensions/Suno-handheld/README.md" \
  "$rpmbuild_dir/SOURCES/README.md"
install -m 0644 "$repo_root/extensions/Suno-handheld/handheld.css" \
  "$rpmbuild_dir/SOURCES/handheld.css"
install -m 0755 "$repo_root/extensions/Suno-handheld/Suno-power-key-broker.py" \
  "$rpmbuild_dir/SOURCES/Suno-power-key-broker.py"
install -m 0644 "$repo_root/extensions/Suno-handheld/70-Suno-handheld-power-key.rules" \
  "$rpmbuild_dir/SOURCES/70-Suno-handheld-power-key.rules"
install -m 0755 "$repo_root/extensions/Suno-handheld/Suno-mobile-input-settings.py" \
  "$rpmbuild_dir/SOURCES/Suno-mobile-input-settings.py"
install -m 0644 "$repo_root/extensions/Suno-handheld/org.projectSuno.MobileInputSettings.desktop" \
  "$rpmbuild_dir/SOURCES/org.projectSuno.MobileInputSettings.desktop"
install -m 0644 "$repo_root/extensions/Suno-handheld/org.projectSuno.handheld.gschema.xml" \
  "$rpmbuild_dir/SOURCES/org.projectSuno.handheld.gschema.xml"
install -m 0755 "$repo_root/extensions/Suno-handheld/Suno-keyboard-lab" \
  "$rpmbuild_dir/SOURCES/Suno-keyboard-lab"
install -m 0755 "$repo_root/extensions/Suno-handheld/Suno-keyboard-lab-session" \
  "$rpmbuild_dir/SOURCES/Suno-keyboard-lab-session"
install -m 0755 "$repo_root/extensions/Suno-handheld/Suno-keyboard-lab-entry.py" \
  "$rpmbuild_dir/SOURCES/Suno-keyboard-lab-entry.py"
install -m 0755 "$repo_root/extensions/Suno-handheld/Suno-kwin-keyboard-engine" \
  "$rpmbuild_dir/SOURCES/Suno-kwin-keyboard-engine"
install -m 0644 "$repo_root/extensions/Suno-handheld/Suno-power-key-broker.service" \
  "$rpmbuild_dir/SOURCES/Suno-power-key-broker.service"
install -m 0644 "$repo_root/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
install -m 0644 "$repo_root/packaging/rpm/gnome-shell-extension-Suno-handheld.spec" \
  "$rpmbuild_dir/SPECS/"

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" \
  "$FEDORA_RPM_BUILD_CONTAINER" '
    set -euo pipefail
    dnf5 -y install rpm-build
    rpmbuild -ba --define "_topdir $PWD" SPECS/gnome-shell-extension-Suno-handheld.spec
    rpm=$(find RPMS/noarch -name "gnome-shell-extension-Suno-handheld-*.rpm" -print -quit)
    verify=$(mktemp -d)
    cd "$verify"
    rpm2cpio "$OLDPWD/$rpm" | cpio -idm --quiet
    js=usr/share/gnome-shell/extensions/handheld@project-suno.local/extension.js
    grep -Fq "enabled only by the mobile capability overlay" "$js"
    grep -Fq "Main.overview.show();" "$js"
    ! grep -Fq "Main.overview.showApps()" "$js"
    grep -Fq "const MOBILE_LAUNCHER_COLUMNS = 4" "$js"
    grep -Fq "name: 'SunoHandheldHome'" "$js"
    grep -Fq "name: 'SunoHandheldAppDrawer'" "$js"
    ! grep -Fq "name: 'SunoHandheldAppSwitcher'" "$js"
    ! grep -Fq "new Shell.WindowPreviewLayout()" "$js"
    ! grep -Fq "paint_to_content" "$js"
    ! grep -Fq "pan_axis: Clutter.PanAxis.BOTH" "$js"
    ! grep -Fq "MOBILE_SWITCHER_" "$js"
    ! grep -Fq "_handleMobileSwitcherTouch" "$js"
    grep -Fq '<method name="ShowAppSwitcher"/>' "$js"
    grep -Fq "this._showWindowPicker();" "$js"
    grep -Fq "this._bottomGesture = null" "$js"
    grep -Fq "_observeBottomNavigation(event)" "$js"
    grep -Fq "const BOTTOM_GESTURE_DIRECTION_PX = 18" "$js"
    grep -Fq "this._recordGesture('bottomCandidates')" "$js"
    grep -Fq "this._recordGesture('bottomDirectionRejected')" "$js"
    ! grep -Fq "_createBottomGesture()" "$js"
    grep -Fq "this._finishBottomGesture(" "$js"
    ! grep -Fq "this._bottomGesture.connect('progress'" "$js"
    grep -Fq "this._drawerPanGesture = new Clutter.PanGesture" "$js"
    grep -Fq "_updateDrawerPan(action)" "$js"
    grep -Fq "this._hideAppDrawer(true, true)" "$js"
    grep -Fq "this._mobileLaunchPendingApp = app" "$js"
    grep -Fq "Meta.TabList.NORMAL_ALL" "$js"
    grep -Fq "this._wmPreferences.set_int('num-workspaces', 1)" "$js"
    grep -Fq "_observeEdgeNavigation(event)" "$js"
    grep -Fq "this._recordGesture('edgeCandidates')" "$js"
    grep -Fq "this._recordGesture('edgeDirectionRejected')" "$js"
    ! grep -Fq "Shell.EdgeDragGesture" "$js"
    grep -Fq "new Clutter.PanGesture" "$js"
    grep -Fq "dashtodockDashScrollview" "$js"
    grep -Fq "scrollView.hadjustment.value -= delta.get_x()" "$js"
    grep -Fq "SunoHandheldLaunchSurface" "$js"
    grep -Fq "app.state === Shell.AppState.STARTING" "$js"
    grep -Fq "if (this._displaySleeping)" "$js"
    grep -Fq "Main.screenShield?.lock?.(true)" "$js"
    grep -Fq "org.projectSuno.Handheld1" "$js"
    grep -Fq "SetExternalKeyboardVisible" "$js"
    grep -Fq "GetAndroidGeometry" "$js"
    grep -Fq "this._dockContainer.visible = !occluded" "$js"
    grep -Fq "_beginBottomGesture(action)" "$js"
    grep -Fq "_reconcileEmptyActivityView()" "$js"
    grep -Fq "_goHome()" "$js"
    grep -Fq "Meta.TabList.NORMAL" "$js"
    grep -Fq "Clutter.KEY_Left" "$js"
    grep -Fq "appId.startsWith('waydroid.')" "$js"
    grep -Fq "Clutter.KEY_Escape" "$js"
    css=usr/share/gnome-shell/extensions/handheld@project-suno.local/handheld.css
    grep -Fq "#panel.Suno-handheld" "$css"
    grep -Fq "height: 42px" "$css"
    grep -Fq "background-color: #ffffff" "$css"
    grep -Fq "icon-size: 17px" "$css"
    grep -Fq "border-radius: 999px" "$css"
    grep -Fq ".Suno-handheld .Suno-handheld-home" "$css"
    grep -Fq "global.window_group.add_child(this._homeSurface)" "$js"
    grep -Fq "_syncHomeStacking()" "$js"
    grep -Fq "_startActivityViewGuard()" "$js"
    ! grep -Fq "Clutter.EventPhase.CAPTURE" "$js"
    grep -Fq "this._drawerReturnHome" "$js"
    grep -Fq "_bottomNavigationStartY(monitor)" "$js"
    grep -Fq "event.get_coords()" "$js"
    grep -Fq '<method name="GetGestureDiagnostics">' "$js"
    grep -Fq "_recordGesture(name) {" "$js"
    ! grep -Fq "new Background.BackgroundManager" "$js"
    grep -Fq "background-color: transparent" "$css"
    grep -Fq ".Suno-handheld .Suno-handheld-app-drawer-sheet" "$css"
    ! grep -Fq ".Suno-handheld .Suno-handheld-switcher-card" "$css"
    grep -Fq -- "-st-hfade-offset: 32px" "$css"
    grep -Fq ".keyboard-key:active" "$css"
    grep -Fq "#dashtodockContainer.bottom" "$css"
    test -x usr/libexec/Suno-power-key-broker
    grep -Fq 'pmic_pwrkey' usr/lib/udev/rules.d/70-Suno-handheld-power-key.rules
    test -f usr/lib/systemd/user/Suno-power-key-broker.service
    test -x usr/libexec/Suno-mobile-input-settings
    test -f usr/share/applications/org.projectSuno.MobileInputSettings.desktop
    test -f usr/share/glib-2.0/schemas/org.projectSuno.handheld.gschema.xml
    test -x usr/libexec/Suno-keyboard-lab
    test -x usr/libexec/Suno-keyboard-lab-session
    test -x usr/libexec/Suno-keyboard-lab-entry
    test -x usr/libexec/Suno-kwin-keyboard-engine
    grep -Fq "SetExternalKeyboardVisible" usr/libexec/Suno-keyboard-lab-session
    grep -Fq "Test temporarily" usr/libexec/Suno-mobile-input-settings
  '

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir"/RPMS/noarch/*.rpm "$output_dir/RPMS/noarch/"
install -m 0644 "$rpmbuild_dir"/SRPMS/*.rpm "$output_dir/SRPMS/"
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno handheld package: %s\n' "$output_dir"
