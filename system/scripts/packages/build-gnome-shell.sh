#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

# Surface Treatments remains a non-release candidate until ADR-020 and the
# native graphical gates are accepted. Keep its artifact identity local to
# this builder rather than advancing the accepted tuple in inputs.env.
surface_candidate_release=$GNOME_SHELL_SUNO_RELEASE

# The packaged verification below is one single-quoted argument. A single
# quote inside it ends that quoting and mangles the command it sits in, which
# fails silently under set -e and takes every check after it with it -- how
# "kind: 'apart'" spent releases passing by not running. Refuse to start.
verify_start=$(grep -n "builder_container\" .$" "$0" | head -1 | cut -d: -f1)
verify_end=$(grep -n "^  .$" "$0" | awk -F: -v s="${verify_start:-0}" '$1 > s {print $1; exit}')
if [ -n "$verify_start" ] && [ -n "$verify_end" ] &&
   sed -n "$((verify_start + 1)),$((verify_end - 1))p" "$0" | grep -q "'"; then
  printf 'a single quote inside the packaged-verification block would mangle it: use a pattern without one\n' >&2
  exit 1
fi

for tool in cpio curl git mktemp podman rpm2cpio sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required RPM build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] || {
  printf 'error: build the Suno GNOME Shell RPM on a Fedora Linux builder\n' >&2
  exit 1
}

architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$architecture" in
  x86_64) builder_container=$FEDORA_RPM_BUILD_CONTAINER ;;
  aarch64) builder_container=$FEDORA_RPM_BUILD_CONTAINER_AARCH64 ;;
  *) printf 'error: unsupported Shell architecture: %s\n' "$architecture" >&2; exit 1 ;;
esac
export SUNO_RPM_BUILDER_ARCHITECTURE=$architecture

cache_dir="$repo_root/build/cache/srpm"
output_dir="$repo_root/build/packages/gnome-shell"
mkdir -p "$cache_dir" "$output_dir"

srpm="$cache_dir/$GNOME_SHELL_SRPM"
if [ ! -f "$srpm" ]; then
  curl -fL --retry 3 -o "$srpm" "$GNOME_SHELL_SRPM_URL"
fi

printf '%s  %s\n' "$GNOME_SHELL_SRPM_SHA256" "$srpm" |
  sha256sum --check --status || {
    printf 'error: GNOME Shell source RPM checksum mismatch\n' >&2
    exit 1
  }

work_dir=$(mktemp -d "$output_dir/work.XXXXXX")
extract_dir="$work_dir/srpm"
rpmbuild_dir="$work_dir/rpmbuild"
srpm_cpio="$work_dir/gnome-shell.srpm.cpio"
mkdir -p "$extract_dir" "$rpmbuild_dir/BUILD" "$rpmbuild_dir/BUILDROOT" \
  "$rpmbuild_dir/RPMS" "$rpmbuild_dir/SOURCES" \
  "$rpmbuild_dir/SPECS" "$rpmbuild_dir/SRPMS"

rpm2cpio "$srpm" >"$srpm_cpio"
(
  cd "$extract_dir"
  cpio -idm --quiet <"$srpm_cpio"
)
rm -f "$srpm_cpio"

mv "$extract_dir/gnome-shell.spec" "$rpmbuild_dir/SPECS/"
find "$extract_dir" -maxdepth 1 -type f \
  -exec mv -t "$rpmbuild_dir/SOURCES" {} +
install -m 0644 "$repo_root/patches/gnome-shell/0001-Suno-panel-layout.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0002-prairie-login-lock.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0003-Suno-desktop-first-session.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0004-prairie-login-spinner-row.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0005-prairie-application-shortcuts.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0006-prairie-auth-entry-and-progress.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0007-Suno-handheld-posture.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0008-Suno-live-extensions.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0009-Suno-handheld-activity-view.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0010-Suno-shelf.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0011-Suno-presence-login.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0012-Suno-login-detail-polish.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0013-Suno-login-and-single-dash.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0014-Suno-notification-system.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0015-Suno-notification-lifecycle-stack.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0016-Suno-search-window-view.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0017-Suno-search-beam-native-providers.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0018-Suno-search-beam-layout-polish.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0019-Suno-shelf-polish.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0020-Suno-dock-icon-normalisation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0021-Suno-shelf-dock-width-follows-content.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0022-Suno-context-menu.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0023-Suno-quick-options-final-menu.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0024-Suno-box-shadow-support.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0025-Suno-beacon-notification-follow-up.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0026-Suno-native-file-dock-open.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0027-Suno-dash-layout-settings.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0028-Suno-dash-attached-shadow-policy.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0029-Suno-dash-empty-offscreen-minimum.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0030-Suno-date-menu-notification-lifecycle-import.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0031-Suno-dash-uniform-island-edges.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0032-Suno-dash-material-thickness.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0033-Suno-dash-painted-surface-allocation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0034-Suno-dash-unified-padding.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0035-Suno-dash-device-pixel-insets.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0036-Suno-dash-scaled-tile-margin.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0037-Suno-unified-status-cluster.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0038-Suno-status-clock-foreground.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0039-Suno-status-clock-balanced-inset.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0040-Suno-preserve-clock-text-paint.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0041-Suno-boot-greeter-ink-fallback.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0042-Suno-status-divider-spacing.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0043-Suno-compact-menu-width.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0044-Suno-dock-tile-geometry.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0045-Suno-surface-materials.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0046-Suno-surface-simulator-parity.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0047-Suno-shelf-settle-and-artwork-background.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0048-Suno-shelf-artwork-only.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0049-Suno-shelf-direct-paint-damage.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0050-Suno-status-island-material-owner.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0051-Suno-desktop-edge-gutters.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0052-Suno-dock-hover-viewport-padding.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0053-Suno-dock-inner-clip.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0054-Suno-minimize-dock-target.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0055-Suno-managed-window-class.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0056-Suno-hover-padding-inside-scroll-clip.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0057-Suno-search-outside-dismissal.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0058-Suno-unlock-initialization-order.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0059-Suno-media-live-island.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0060-Suno-grid-layout.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0061-Suno-wallpaper-clock-spacing.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0062-Suno-dock-menu-clearance.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0063-Suno-monitor-introspection.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0064-Suno-native-grid.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0065-Suno-session-application-lifecycle.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0066-Suno-grid-presentation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0067-Suno-grid-windows-and-rows.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0068-Suno-grid-single-row-scroll.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0069-Suno-shelf-clock-gap.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0070-Suno-grid-span-titles-dismiss.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0071-Suno-grid-centred-scroll.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0072-Suno-grid-stable-order.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0073-Suno-desktop-swipe-direction.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0074-Suno-live-extension-actions.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0075-Suno-shelf-clock-gap-spacing.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0076-Suno-sticky-dock-placement.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0077-Suno-shelf-clock-gap-ceiling.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0078-Suno-sticky-dock-chrome.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0079-Suno-sticky-dock-guard.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0080-Suno-live-extension-shelf-presentation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0081-Suno-live-island-instrumentation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0082-Suno-unlock-clock-dispose-order.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0083-Suno-live-island-event-presentation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0084-Suno-shelf-gap-right-anchor.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0085-Suno-unlock-not-gated-on-a-message.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0086-Suno-live-island-keeps-its-indicator.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0087-Suno-search-result-activation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0088-Suno-shelf-clock-group.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0089-Suno-login-typing-reaches-password.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0090-Suno-password-not-held-behind-a-message.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0091-Suno-capsule-window-belongs-to-its-launcher.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0092-Suno-quick-options-rows-fit-their-content.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0093-Suno-status-icons-live-on-the-shelf.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0094-Suno-menu-rows-grow-and-quick-options-centres.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0095-Suno-screenshot-from-search-opens.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0096-Suno-shelf-type-scale-and-activation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0097-Suno-login-wallpaper-every-display.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0098-Suno-grid-windows-travel.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0100-Suno-ask-about-new-display-arrangements.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0101-Suno-login-wallpaper-origin-and-clean-screenshots.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0102-Suno-every-window-gets-Suno-corners.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0103-Suno-log-windows-that-flash.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0104-Suno-keep-every-dock-icon-rounded.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0105-Suno-chromium-windows-get-Suno-corners.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0106-Suno-sharp-dock-icons-and-masked-windows.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0107-Suno-monitor-margins-and-centred-shelf.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0108-Suno-grid-sharp-steady-draggable-and-centred-shelf.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0109-Suno-shelf-well-and-spec-polish.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0110-Suno-shelf-status-slots-dock-and-menus.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0111-Suno-grid-full-resolution-previews.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0112-Suno-shelf-spec-parity.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0113-Suno-shelf-only-with-an-overview.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0114-Suno-chrome-stays-off-the-lock-screen.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0115-Suno-well-overflow-hover-and-drag.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0116-Suno-notification-placement-anatomy-and-beacon.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0117-Suno-dock-window-indicators-and-previews.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0118-Suno-quiet-shell-log-noise.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0119-Suno-audio-output-picker.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0120-Suno-dock-menu-background-activity.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0121-Suno-cast-quick-settings.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0122-Suno-shelf-edge-insets-at-shutdown.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0123-Suno-grid-own-wallpaper-drag-and-steady-travel.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0124-Suno-grid-uniform-card-height-and-edge-scale.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0125-Suno-dock-lists-only-apps-with-windows.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0126-Suno-live-island-call-style-and-one-tile-family.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0127-Suno-notifications-top-centre-and-anchored-tray.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0128-Suno-workspace-overview-replaces-app-grid.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0129-Suno-shelf-keeps-work-area-while-locked.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0130-Suno-live-island-call-controls-and-tray-count.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0131-Suno-shelf-surface-placement.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0132-Suno-beam-level-indicator.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0133-Suno-silent-volume-change.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0134-Suno-well-glyphs-survive-indicator-restarts.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0135-Suno-dock-items-settle-when-views-change.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0136-Suno-dock-previews-resize-and-context-menu.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0137-Suno-dock-menu-title-in-app-case.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0138-Suno-system-indicators-in-the-well.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0139-Suno-screenshot-shortcuts.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0140-Suno-search-files-and-folders.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0141-Suno-beam-island-corners-and-slider.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0142-Suno-capture-screenshot-tool.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0143-Suno-window-motion-to-dock-icon.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0144-Suno-capture-thumbnail-drag.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0145-Suno-now-playing-island-stays-whole.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0146-Suno-seal-administrator-prompt.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0147-Suno-dock-unread-badges.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0148-Suno-dock-badge-deeper-ember.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0149-Suno-screen-sharing-picker.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0150-Suno-one-ink-and-shadow-per-appearance.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0151-Suno-well-glyphs-and-hover-rhythm.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0152-Suno-shell-overlays-follow-the-treatment.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0153-Suno-search-kind-labels-and-mail.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0154-Suno-screenshots-match-blurred-surfaces.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0155-Suno-quiet-filled-controls.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0156-Suno-capture-hidden-backgrounds.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0157-Suno-frost-and-glass-menus-follow-the-ink.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0158-Suno-live-islands-survive-appearance-changes.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0159-Suno-detail-header-glyph-in-light.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0160-Suno-notifications-live-in-the-shelf.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0161-Suno-quick-options-highlights-as-one.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0162-Suno-capture-thumbnail-throw-menu-keys.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0163-Suno-sticky-dock-only-with-sticky-notes.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0164-Suno-quick-options-match-the-design.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0167-Suno-movable-shelf-islands.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0170-Suno-frost-and-glass-are-one-light-material.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0171-Suno-dash-islands-on-every-edge-and-every-setting.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0172-Suno-dash-islands-as-arranged.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0173-inputMethod-A-key-the-input-method-cannot-answer-for-still-reaches-the-window.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0174-Suno-three-fingers-switch-app-four-switch-workspace.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0175-Suno-a-tap-is-a-tap.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0180-Suno-dock-folders.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0176-Suno-dock-folders-glyph.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0181-Suno-captures-keep-every-pixel-and-each-shortcut-its-mode.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0182-Suno-notification-island-folds-into-its-edge.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0183-Suno-no-is-ready-notifications.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0184-Suno-glass-surfaces-never-blur-their-own-output.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0185-Suno-the-shell-wears-the-glass-veil.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0186-Suno-notifications-show-the-app-icon.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0187-Suno-search-finds-filer-places.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0188-Suno-dock-icons-can-be-rearranged.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0189-Suno-studio-shelf-layout.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0190-Suno-studio-upcoming-event.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0191-Suno-studio-dock-apps.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0192-Suno-studio-notification-lip.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0193-Suno-studio-quick-options.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0202-Suno-studio-card-reflow.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0203-Suno-studio-measured-metrics.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0204-Suno-studio-output-rows.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0205-Suno-lip-allocation-boundary.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0206-Suno-power-title-unavailable.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0207-Suno-hotspot-native-capability.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0208-Suno-studio-native-controls.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0209-Suno-light-notification-ink.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0210-Suno-studio-native-state-controls.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0194-Suno-status-joins-the-centred-row.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0195-Suno-two-live-tiles.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0196-Suno-smoked-frost.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0197-Suno-live-tile-family.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0198-Suno-status-row-and-apps-target.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0199-Suno-frost-controls-follow-the-smoke.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0213-Suno-notification-sheet-suffix.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0221-Suno-keep-short-lived-app-notifications.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0224-Suno-dock-without-apps-button.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0232-Suno-hotspot-radio-tower-glyph.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0233-Suno-dock-viewport-fits-monitor.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0234-Suno-notification-pill-capped-width.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0235-Suno-notification-outside-click.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0227-Suno-poster-login.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0228-Suno-poster-security-follow-up.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0229-Suno-poster-vm-layout-and-avatar.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0230-Suno-poster-pam-message-wrap.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0231-Suno-poster-pam-avatar-count.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0236-Suno-poster-ultrawide-and-monitor-backgrounds.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0237-Suno-lock-wake-respects-dnd.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0238-Suno-refused-power-action-notice.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0239-Suno-notification-sheet-suffix-after-poster.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0240-Suno-poster-fingerprint-glyph.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0241-Suno-poster-monitor-clip-and-battery-scale.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0242-Suno-poster-status-icon-and-input-proportions.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0243-Suno-shelf-arrange-precision.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0244-Suno-preview-quick-options-interaction.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0245-Suno-preview-network-scroll-and-prompts.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0246-Suno-window-corners-first-commit.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0247-Suno-wayland-visible-launcher-identity.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0248-Suno-native-symbolic-and-workarea-layout.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0249-Suno-native-raised-shadow.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0250-Suno-dash-direct-arrangement.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0251-Suno-studio-native-paint-owner.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0252-Suno-clock-natural-line-metrics.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0253-Suno-status-and-lock-clock-measured-layout.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0254-Suno-lock-osd-monitor-placement.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0255-Suno-connectivity-picker-touch-and-discovery.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0256-Suno-live-budget-scroll-dock-first.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0257-Suno-notification-nub-native-touch.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0258-Suno-unresponsive-dialog-material.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0259-Suno-android-existing-window-activation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0260-Suno-android-native-caller-admission.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0261-Suno-clock-fractional-baselines.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0262-Suno-visible-tiling-and-bounded-battery-status.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0263-Suno-quiet-dock-pinning.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0264-settings-display-preview-ownership.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0265-settings-native-keyboard-selection.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0266-notifications-dismiss-on-client-click.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0267-lock-settings-disconnect-before-dispose.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0268-tiling-wrapper-destroy-without-recursion.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0269-dash-recognized-hold-feedback.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0270-dash-settled-initial-presentation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0271-maximized-window-border-settings.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0272-dash-arrangement-carrier-order.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0273-live-installed-application-search.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0274-dash-edges-and-grouped-search.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0275-status-clock-well-and-options-polish.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0276-quick-options-device-row-geometry.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0277-login-surfaces-and-dock-battery-percentage.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0278-brightness-one-percent-and-idle-input.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0279-applications-and-downloads-drawer.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0280-retire-standalone-displays.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0280-drawer-artwork-and-grid-alignment.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0281-converged-presentation.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0282-notification-pulse-lifecycle.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0283-lucide-camera-privacy-indicator.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0284-unified-shell-surfaces.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0285-desktop-launcher-folders.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0286-android-native-notification-replies.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0287-app-menu-section-ownership.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0288-dock-wheel-reachability.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0286-dock-native-touch-scroll.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0287-calendar-island-menu-state.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0288-surface-material-owner-lifecycle.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0289-status-material-and-readiness.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0290-compact-login-action-bar.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0291-shared-handheld-startup-and-input.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0292-display-exclusions-and-notification-touch.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0293-mobile-lock-notification-island.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0294-keycap-keyboard.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0295-status-without-shelf-backdrop.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0296-shelf-presentation-wait-desktop-only.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0297-keycap-key-path.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0298-keycap-press-path-and-lock-screen.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0299-single-layer-shadows.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0300-keycap-cached-grid-and-press-overlay.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0301-keycap-layer-switch-swaps-cached-layers.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0302-keycap-warm-layers-after-every-show.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0294-notification-dismissal-policy.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0303-mobile-data-quick-toggle.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0322-tv-home.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0323-tv-keyboard.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0324-tv-input.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0325-tv-dialogs.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0326-tv-screen-edges.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0327-tv-quick-panel.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/patches/gnome-shell/0328-tv-app-switcher.patch" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tools/check-shell-shadows.py" "$rpmbuild_dir/SOURCES/"
for source in safeAreas.js powerButton.js incomingCall.js presentation.js layout.js grid.js homeEditor.js widgets.js tabletTasks.js handheldOptions.js frameTokens.js switcherDrag.js statusGrid.js fillSlider.js optionsSurface.js optionsSurface.css presentation.css appDrawer.js launcherFolders.js fileFaces.js launcherModel.js launcherFolders.css launcher.svg keycap.js keycapTokens.js keycap.css tv.js tvModel.js tvTokens.js tv-backdrop.jpg tvKeyboard.js tvInput.js tvInputModel.js tvDialogs.js tvDialogsModel.js tvScreenEdges.js tvQuickPanel.js tvQuickPanelModel.js tvAppSwitcher.js tvAppSwitcherModel.js tvPointer.js cellularStatus.js mediaRow.js mediaRowTokens.js soundPage.js soundPageModel.js callerWindow.js; do
  install -m 0644 "$repo_root/src/Suno-shell-presentation/$source" "$rpmbuild_dir/SOURCES/"
done
install -m 0644 "$repo_root/LICENSES/CC-BY-SA-4.0.txt" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/scripts/packages/check-rpm-directory-modes.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/settings-teardown.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/clock-line-metrics.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/window-application-identity.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/window-corners/first-commit.js" "$rpmbuild_dir/SOURCES/window-corners-first-commit.js"
install -m 0644 "$repo_root/tests/gnome-shell/quick-options-page.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/quick-options-network.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/notification-lip-outside-click.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/shelf-arrangement.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/monitor-introspection.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/media-selection.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/live-activity.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/popover-placement.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/shelf-surface-placement.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/screenshot-shortcuts-migrate.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/window-motion.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/seal-conversations.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/dock-badges.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/android-existing-activation.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/settings-input-source.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/keycap-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/tv-keyboard-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/tv-input-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/tv-dialogs-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/tv-quick-panel-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/tv-app-switcher-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/tv-flatpak-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/dock-folder-badge-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/date-menu-calendar-only-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/date-menu-panel-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/search-keyboard-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/app-mixer-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/sound-page-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/file-drag-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/well-overflow-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/app-permissions-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/notification-breaths-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/icon-mask-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/app-icon-plate.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/layer-shell-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/layer-shell-indicator-policy.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/gnome-shell/connect-sync-policy.js" "$rpmbuild_dir/SOURCES/"
# Keycap icons are derived from Stevia's outlines; refuse stale copies.
python3 "$repo_root/scripts/developer/generate-keycap-shell-icons.py" --check
(
  cd "$repo_root/src/Suno-shell-presentation/keycap-icons"
  tar --sort=name --owner=0 --group=0 --numeric-owner --mtime=@0 \
    -cf "$rpmbuild_dir/SOURCES/keycap-icons.tar" LICENSE Suno-keycap-*-symbolic.svg
)
install -m 0644 "$repo_root/tests/gnome-shell/screen-sharing.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/search/ranking-gjs.js" "$rpmbuild_dir/SOURCES/search-ranking-gjs.js"
install -m 0644 "$repo_root/tests/search/ranking-vectors.json" "$rpmbuild_dir/SOURCES/search-ranking-vectors.json"
install -m 0644 "$repo_root/tests/search/settings-cases.json" "$rpmbuild_dir/SOURCES/search-settings-cases.json"
install -m 0644 "$repo_root/src/Suno-search/settings-pages.json" "$rpmbuild_dir/SOURCES/search-settings-pages.json"
install -m 0644 "$repo_root/tests/search/places-gjs.js" "$rpmbuild_dir/SOURCES/search-places-gjs.js"
install -m 0644 "$repo_root/src/Suno-search/filer-places.json" "$rpmbuild_dir/SOURCES/search-filer-places.json"
install -m 0644 "$repo_root/tests/gnome-shell/session-application-lifecycle.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/scripts/packages/verify-shell-unlock.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/scripts/packages/verify-shell-unlock.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/scripts/packages/verify-shell-search.js" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/scripts/packages/verify-shell-search-theme.py" "$rpmbuild_dir/SOURCES/"
# The Shell veil is the platform veil (0185): the packaged sheets are checked
# against the same tokens the application toolkit is generated from.
install -m 0644 "$repo_root/tools/check-shell-veil.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/config/shared/design-tokens.json" "$rpmbuild_dir/SOURCES/"

# The packaged clock-width regression shapes the actual pinned Figtree font.
# Admit this normal build prerequisite explicitly rather than accepting a
# substitute font from the builder's ambient Fontconfig configuration.
figtree_rpm="$repo_root/build/packages/figtree-fonts/RPMS/noarch/$FIGTREE_NEVRA.rpm"
[ -f "$figtree_rpm" ] || {
  printf 'error: build %s before Shell: %s\n' "$FIGTREE_NEVRA" "$figtree_rpm" >&2
  exit 1
}
install -m 0644 "$figtree_rpm" "$rpmbuild_dir/SOURCES/"

# Preserve the specification's historical dependency order. Include every
# declared patch even when its legacy filename differs from its sequence ID.
while IFS= read -r patch_name; do
  install -m0644 "$repo_root/patches/gnome-shell/$patch_name" "$rpmbuild_dir/SOURCES/"
done < <(sed -n 's/^+Patch[0-9][0-9]*:[[:space:]]*\([^[:space:]]*\.patch\)$/\1/p' "$repo_root/patches/gnome-shell/0000-Suno-fedora-spec.patch")

(
  cd "$rpmbuild_dir/SPECS"
  # Inside a Git work tree (a build tree that is a clone, not an rsync) git
  # apply resolves the patch path from the top of that tree, finds
  # gnome-shell.spec outside the current directory, skips it as excluded and
  # exits 0: the build then produces stock Fedora gnome-shell-50.3-1.fc44
  # with no Suno patch at all. The ceiling stops Git looking above rpmbuild,
  # and the Release check below fails loudly if the spec was still not patched.
  GIT_CEILING_DIRECTORIES="$rpmbuild_dir" \
    git apply "$repo_root/patches/gnome-shell/0000-Suno-fedora-spec.patch"
  grep -Fxq "Release:        ${surface_candidate_release}%{?dist}" gnome-shell.spec || {
    printf "error: gnome-shell.spec is not at Release %s after the spec patch\n" \
      "$surface_candidate_release" >&2
    exit 1
  }
)

# Home widgets are imported dynamically by the running Shell, not linked by
# its compiler. The image installs the normal required widget/Core packages.
"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" \
  "$builder_container" '
    set -euo pipefail
    # Every check below is a bare command under set -e, so a failing one
    # aborts with no output at all: the log stops after the last PASS it
    # printed and the build ends without packaging, which reads exactly like
    # success to anyone grepping for FAIL. Name the command and the line.
    set -E
    Suno_verify_failed() {
      printf "VERIFY FAILED at line %s: %s\n" "$1" "$2" >&2
    }
    trap "Suno_verify_failed \$LINENO \"\$BASH_COMMAND\"" ERR
    dnf5 -y install rpm-build dnf5-plugins SOURCES/google-figtree-fonts-*.rpm
    dnf5 -y builddep SPECS/gnome-shell.spec
    rpmbuild -ba --noclean --define "_lto_cflags -flto=2" --define "_topdir $PWD" SPECS/gnome-shell.spec

    # Check RPM header modes, not the privileged builder ability to read them.
    # Both main and common packages must remain traversable by ordinary users.
    while IFS= read -r rpm_path; do
      rpm -qp --qf "[%{FILEMODES:octal} %{FILENAMES}\n]" "$rpm_path" > payload-modes.txt
      python3 SOURCES/check-rpm-directory-modes.py payload-modes.txt
    done < <(find RPMS -type f -name "*.rpm" -print)

    architecture=${SUNO_RPM_BUILDER_ARCHITECTURE:-$(rpm --eval "%{_arch}")}
    shell_rpm=$(find "RPMS/$architecture" -type f -name "gnome-shell-*.rpm" \
      ! -name "*-debuginfo-*" ! -name "*-debugsource-*" -print -quit)
    verify_dir=$(mktemp -d "$PWD/verify.XXXXXX")
    rpm2cpio "$shell_rpm" >"$verify_dir/gnome-shell.rpm.cpio"
    (
      cd "$verify_dir"
      cpio -idm --quiet <gnome-shell.rpm.cpio
      rm -f gnome-shell.rpm.cpio
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/gnome-shell-light.css >gnome-shell-light.css
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/shelf.js >Suno-dash.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/panel.js >panel-clock-metrics.js
      gjs -m "$OLDPWD/SOURCES/clock-line-metrics.js" panel-clock-metrics.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/mediaSelection.js >mediaSelection.js
      gjs -m "$OLDPWD/SOURCES/media-selection.js" mediaSelection.js
      grep -Fq "SunoShelfWorkArea" Suno-dash.js
      grep -Fq "affectsStruts: enabled" Suno-dash.js
      # Tablet and Mobile borrow Quick Settings without the Shelf backdrop.
      grep -Fq "this._actionsIsland?.setSurfaceVisible(false, false);" Suno-dash.js
      # The Shelf stops waiting for its first layout outside Desktop.
      grep -Fq "INITIAL_PRESENTATION_LIMIT_US" Suno-dash.js
      grep -Fq "Arrangement.reservations(this._monitors, reserve ? occupied : new Map(), metrics," Suno-dash.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/shelfMetrics.js >shelfMetrics.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoSurfaceMaterials.js >SunoSurfaceMaterials.js
      grep -Fq "export function resolveTreatment" SunoSurfaceMaterials.js
      grep -Fq "set_background_blur_params" SunoSurfaceMaterials.js
      grep -Fq "hardwareAccelerated" SunoSurfaceMaterials.js
      grep -Fq "SUNO_MUTTER_ALLOW_SOFTWARE_BLUR" SunoSurfaceMaterials.js
      grep -Fq "corner_radius_top_left" SunoSurfaceMaterials.js
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/Suno-shelf.css >Suno-shelf.css
      # One veil for every Frost and Glass Shell surface, equal to the
      # platform tokens, painted by no other rule, no text shadow (0185).
      python3 "$OLDPWD/SOURCES/check-shell-veil.py" \
        --tokens "$OLDPWD/SOURCES/design-tokens.json" \
        Suno-shelf.css gnome-shell-light.css
      python3 "$OLDPWD/SOURCES/check-shell-veil.py" --self-test >/dev/null
      grep -Fq "background-gradient-start: transparent" Suno-shelf.css
      grep -Fq "Suno-shelf-artwork" Suno-shelf.css
      grep -Fq "box-shadow: none !important" Suno-shelf.css
      # Filled controls (0155, ADR-043): the sheet, its ledger, and its load.
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/Suno-controls.css >Suno-controls.css
      grep -Fq "Suno-surface-light .quick-toggle:checked .quick-toggle-icon" \
        Suno-controls.css
      grep -Fq "Suno-surface-glass .Suno-status-routes .button" Suno-controls.css
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoControlInk.js >SunoControlInk.js
      grep -Fq "export const CONTROL_INK" SunoControlInk.js
      grep -Fq "CONTROLS_STYLESHEET_URI" usr/lib64/gnome-shell/libshell-18.so
      # Backdrop blurs bound the pass after their copy (0317); St matches
      # theme nodes through its selector index (0318).
      grep -aFq "ShellBlurEffect (paint box)" usr/lib64/gnome-shell/libshell-18.so
      # Blur passes draw into kept textures (0319).
      grep -aFq "ShellBlurEffect (vertical)" usr/lib64/gnome-shell/libshell-18.so
      # Modal dialogs hold the blurred backgrounds beneath them (0320).
      grep -aFq "shell_blur_effect_hold_backgrounds" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "SUNO_ST_NO_SELECTOR_INDEX" usr/lib64/gnome-shell/libst-18.so
      grep -Fq "artwork.remove_all_transitions()" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -Fq "Clutter.OffscreenRedirect.NEVER" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -Fq ".Suno-shelf-material.Suno-surface-dark" \
        Suno-shelf.css
      grep -Fq ".Suno-shelf-material.Suno-surface-glass" \
        Suno-shelf.css
      # The Quick Options island is one surface: its controls are never
      # marked on their own; the shelf washes the whole island (0161).
      grep -q "controls\.remove_style_pseudo_class(.checked.)" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -Fq "export const DASH_TILE_SIZE = 40;" shelfMetrics.js
      grep -Fq "export const DASH_TILE_GAP = 8;" shelfMetrics.js
      grep -Fq "runningIndicatorGeometry" shelfMetrics.js
      grep -Fq "shelf-span-full" Suno-dash.js
      grep -Fq "shelf-float-ends" Suno-dash.js
      grep -Fq ".Suno-secondary-status-text" gnome-shell-light.css
      grep -Fq "color: #6b7280" gnome-shell-light.css
      grep -Fq "font-size: 11.5px" gnome-shell-light.css
      grep -Fq "font-weight: 500" gnome-shell-light.css
      grep -Fq "icon-size: 16px" gnome-shell-light.css
      grep -Fq -- "-st-icon-style: symbolic" gnome-shell-light.css
      grep -Fq "background-color: #f2f3f5" gnome-shell-light.css
      grep -Fq "#panel:overview" gnome-shell-light.css
      grep -Fq "spacing: 12px" gnome-shell-light.css
      grep -Fq "margin: 0" gnome-shell-light.css
      grep -Fq -- "-natural-hpadding: 8px" gnome-shell-light.css
      grep -Fq -- "-minimum-hpadding: 6px" gnome-shell-light.css
      grep -Fq "rgba(120, 130, 145, 0.14)" gnome-shell-light.css
      grep -Fq "rgba(120, 130, 145, 0.22)" gnome-shell-light.css
      grep -Fq "#panel.Suno-handheld" gnome-shell-light.css
      grep -Fq "height: 42px" gnome-shell-light.css
      grep -Fq "min-height: 38px" gnome-shell-light.css
      grep -Fq "icon-size: 17px" gnome-shell-light.css
      grep -Fq "background-color: #ffffff" gnome-shell-light.css
      grep -Fq ".Suno-handheld .keyboard-key:active" gnome-shell-light.css
      grep -Fxq ".Suno-handheld .keyboard-key:active {" gnome-shell-light.css
      ! grep -Fq "  .Suno-handheld .keyboard-key:active" gnome-shell-light.css
      # Keycap: the keyboard loads the token-generated sheet, and the icons
      # carry St symbolic classes (derived from Stevia by the builder check).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/keyboard.js >keycap-keyboard.js
      grep -Fq "SunoPresentation/keycap.js" keycap-keyboard.js
      grep -Fq "commitPreeditText" keycap-keyboard.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoPresentation/keycap.css >keycap.css
      grep -Fq "#keyboard.Suno-keycap-light .keyboard-key" keycap.css
      grep -Fq "#keyboard.Suno-keycap-dark .keyboard-key" keycap.css
      # Key path (0297): nothing St blurs or rasterises on the CPU per key, no
      # hover restyle of the keyboard box, commits never wait at idle
      # priority, and every tracked touch end is seen.
      ! grep -Fq "box-shadow: inset" keycap.css
      ! grep -Fq "background-gradient-start" keycap.css
      ! grep -Fq "text-shadow: 0" keycap.css
      grep -Fq "Clutter.Event.add_filter(global.stage" keycap-keyboard.js
      grep -Fq "GLib.idle_add(GLib.PRIORITY_DEFAULT + 2" keycap-keyboard.js
      grep -Fq "set_input_panel_inset" keycap-keyboard.js
      # Press path and lock screen (0298): no per-press restyle or key
      # measuring, and the keyboard serves only a visible unlock entry.
      grep -Fq "page.transform_stage_point(x, y)" keycap-keyboard.js
      grep -Fq "_lockedWithoutEntry()" keycap-keyboard.js
      # Cached grid and press overlay (0300).
      grep -Fq "levelLayout.offscreen_redirect = Clutter.OffscreenRedirect.ALWAYS" keycap-keyboard.js
      grep -Fq "_showPressedCap(cell, cap)" keycap-keyboard.js
      ! grep -q "this.keyButton.add_style_pseudo_class(.active.)" keycap-keyboard.js
      # Layer switches swap cached layers by opacity (0301).
      grep -Fq "levelLayout.opacity = 0;" keycap-keyboard.js
      grep -Fq "this._gridRatio = [columns, rows];" keycap-keyboard.js
      ! grep -Fq "this._currentPage.hide();" keycap-keyboard.js
      # Layers are drawn into their caches again after every show (0302).
      grep -Fq "_warmLayerStep() {" keycap-keyboard.js
      grep -Fq "warm.drawn = !this._inputSincePaint" keycap-keyboard.js
      ! grep -Fq "this._flushId = GLib.idle_add(GLib.PRIORITY_LOW" keycap-keyboard.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/layout.js >keycap-layout.js
      ! grep -A3 "name: .keyboardBox.," keycap-layout.js | grep -Fq "track_hover"
      gresource extract usr/share/gnome-shell/gnome-shell-icons.gresource \
        /org/gnome/shell/icons/scalable/status/Suno-keycap-delete-symbolic.svg >keycap-delete.svg
      grep -Fq "foreground-stroke" keycap-delete.svg
      grep -Fq "transition-duration: 0ms" gnome-shell-light.css
      grep -Fq "background-color: #4d78b8" gnome-shell-light.css
      grep -Fq ".prairie-desktop-shortcut" gnome-shell-light.css
      grep -Fq ".prairie-login-clock-time" gnome-shell-light.css
      grep -Fq "font-size: 76px" gnome-shell-light.css
      grep -Fq ".prairie-auth-card" gnome-shell-light.css
      grep -A8 -F ".login-dialog-prompt-layout.prairie-auth-card {" \
        gnome-shell-light.css >prairie-auth-card.css
      grep -Fq "background-color: transparent" prairie-auth-card.css
      grep -Fq ".login-dialog .login-dialog-prompt-entry.prairie-login-entry:focus" \
        gnome-shell-light.css
      grep -Fq ".login-dialog-prompt-entry.prairie-login-entry:focus" \
        gnome-shell-light.css
      grep -Fq ".login-dialog-prompt-entry.prairie-login-entry:insensitive" \
        gnome-shell-light.css
      grep -Fq ".prairie-login-power-button" gnome-shell-light.css
      grep -Fq ".prairie-login-submit-button .spinner" gnome-shell-light.css
      grep -Fq "width: 18px" gnome-shell-light.css
      grep -Fq "min-height: 36px" gnome-shell-light.css
      gresource list usr/share/gnome-shell/gnome-shell-theme.gresource |
        grep -Fx /org/gnome/shell/theme/prairie-daybreak.svg >/dev/null
      gresource list usr/share/gnome-shell/gnome-shell-theme.gresource |
        grep -Fx /org/gnome/shell/theme/prairie-login-avatar.svg >/dev/null
      grep -aFq "const edgeInset = 14 * scaleFactor" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "SUNO_DEVICE_CLASS" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "HANDHELD_CARD_STEP_RATIO" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "requestClose()" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "setHandheldMode(handheldMode)" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "HANDHELD_ACTIVITY_VIEW_USES_DESKTOP_CHROME" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "const cutoutHalfWidth = this._handheldPosture ? 28 * scaleFactor : 0" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "this._timeDisplay.translation_y" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "class PrairieLoginClock" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "class PrairieLoginPowerButton" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "login-dialog-prompt-entry prairie-login-entry" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "this._defaultButtonWell.add_child(this._spinner)" \
        usr/lib64/gnome-shell/libshell-18.so
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/unlockDialog.js >unlockDialog.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/prairieLogin.js >prairieLogin.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/misc/signalTracker.js >signalTracker.js
      cp "$OLDPWD/SOURCES/settings-teardown.js" settings-teardown.js
      GSETTINGS_BACKEND=memory G_DEBUG=fatal-warnings gjs -m settings-teardown.js prairieLogin.js card
      GSETTINGS_BACKEND=memory G_DEBUG=fatal-warnings gjs -m settings-teardown.js unlockDialog.js notifications
      python3 "$OLDPWD/SOURCES/verify-shell-unlock.py" unlockDialog.js
      gjs "$OLDPWD/SOURCES/verify-shell-unlock.js" unlockDialog.js
      grep -aFq "this._posterUser.get_user_name()" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "this._ensureUserListLoaded()" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "showOverviewOnStartup: false" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "if (Main.sessionMode.showOverviewOnStartup)" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "else if (!Main.sessionMode.hasOverview)" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "_syncPlacement()" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "const NOTIFICATION_TIMEOUT = 7000" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "const MAX_VISIBLE_NOTIFICATIONS = 3" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "NotificationLifecycleState" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "Suno-notification-stack" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "Everything on this machine, in one place." \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "Search this machine" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "SearchResultsView({compact: true})" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "this._compact = params.compact" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -Fq ".Suno-search-field" gnome-shell-light.css
      grep -Fq ".Suno-search-result-kind" gnome-shell-light.css
      grep -Fq "height: 64px" gnome-shell-light.css
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoSearch.js >SunoSearch.js
      gjs "$OLDPWD/SOURCES/verify-shell-search.js" SunoSearch.js
      for variant in light dark high-contrast; do
        gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
          /org/gnome/shell/theme/gnome-shell-$variant.css >gnome-shell-$variant.css
      done
      python3 "$OLDPWD/SOURCES/verify-shell-search-theme.py" gnome-shell-{light,dark,high-contrast}.css
      # St paints one shadow per actor (0299): no stylesheet may list more.
      for sheet in optionsSurface.css presentation.css launcherFolders.css keycap.css; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/SunoPresentation/$sheet >shadow-$sheet
      done
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/Suno-shelf.css >shadow-Suno-shelf.css
      python3 "$OLDPWD/SOURCES/check-shell-shadows.py" gnome-shell-{light,dark,high-contrast}.css \
        shadow-Suno-shelf.css shadow-optionsSurface.css shadow-presentation.css \
        shadow-launcherFolders.css shadow-keycap.css
      gjs -m SunoSearch.js >SunoSearch-parse.log 2>&1 || true
      ! grep -Fq "SyntaxError" SunoSearch-parse.log
      grep -aFq "addProvider(provider)" \
        usr/lib64/gnome-shell/libshell-18.so
      ! grep -Fq "org.projectSuno.Search1" SunoSearch.js
      ! grep -Fq "GioUnix.DesktopAppInfo.new(" SunoSearch.js
      ! grep -q "get_id: () => .org\.projectSuno\.Search\.desktop." SunoSearch.js
      grep -aFq "if (sessionMode.hasOverview)" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "Failed to initialize Suno Search" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "Window View" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "const maxDashHeight = 0" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "Keep the completed Prairie authentication surface stable" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "BeginFileDrag" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "EndFileDrag" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "launch_uris_async" usr/lib64/gnome-shell/libshell-18.so
      gresource extract usr/share/gnome-shell/gnome-shell-dbus-interfaces.gresource \
        /org/gnome/shell/dbus-interfaces/org.gnome.Shell.xml >shell-interface.xml
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/misc/introspect.js >monitor-introspect.js
      gjs -m "$OLDPWD/SOURCES/monitor-introspection.js" monitor-introspect.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/sessionApplications.js >sessionApplications.js
      gjs -m "$OLDPWD/SOURCES/session-application-lifecycle.js" sessionApplications.js
      gresource extract usr/share/gnome-shell/gnome-shell-dbus-interfaces.gresource \
        /org/gnome/shell/dbus-interfaces/org.gnome.Shell.Introspect.xml >monitor-interface.xml
      grep -Fq "GetMonitorApplications" monitor-interface.xml
      grep -Fq "RequestMonitorQuit" monitor-interface.xml
      grep -Fq "BeginFileDrag" shell-interface.xml
      grep -Fq "EndFileDrag" shell-interface.xml
      grep -aFq "BeginApplicationDrag" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "actual stage coordinates for external drags" \
        usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "pointerInsidePreviousTarget" \
        usr/lib64/gnome-shell/libshell-18.so
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoDockWindows.js >SunoDockWindows.js
      grep -Fq "windowMarkKinds" shelfMetrics.js
      grep -aFq "_sizeChangesInProgress" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "org.projectSuno.AudioDevices1" usr/lib64/gnome-shell/libshell-18.so
      grep -Fq ".Suno-airplay-status" gnome-shell-light.css
      grep -aFq "org.projectSuno.Background1" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "_syncWallpaper" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "gridCardHeight" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "_renderedScale" usr/lib64/gnome-shell/libshell-18.so
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/liveActivity.js >liveActivity.js
      gjs -m "$OLDPWD/SOURCES/live-activity.js" liveActivity.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoPopoverPlacement.js >SunoPopoverPlacement.js
      gjs -m "$OLDPWD/SOURCES/popover-placement.js" SunoPopoverPlacement.js
      grep -aFq "SunoLiveCallClock" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "TrayCard" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "top-center" usr/lib64/gnome-shell/libshell-18.so
      grep -Fq "Suno-live-extension-leading-glyph" Suno-shelf.css
      grep -aFq "handle_token" usr/lib64/gnome-shell/libshell-18.so
      grep -Fq "Suno-live-extension-action-engaged" Suno-shelf.css
      test -f usr/share/icons/hicolor/scalable/status/Suno-headphones-off-symbolic.svg
      grep -Fq "Suno-notification-beacon-count" Suno-shelf.css
      grep -aFq "Only apps with a real window join the dock" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "_keepsWorkArea" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "class WorkspaceOverview extends St.Widget" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "toggle-workspace-overview-backward" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "Suno has no app grid (ADR-037)" usr/lib64/gnome-shell/libshell-18.so
      grep -Fq ".Suno-workspace-root.light .Suno-workspace-overview" gnome-shell-light.css
      grep -xq "switch-applications=\[.<Alt>Tab.\]" \
        usr/share/glib-2.0/schemas/00_org.gnome.shell.gschema.override
      # One placement rule for shelf surfaces (0131).
      gjs -m "$OLDPWD/SOURCES/shelf-surface-placement.js" shelfMetrics.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoShelfSurface.js >SunoShelfSurface.js
      grep -Fq "export function placeShelfSurface" SunoShelfSurface.js
      grep -aFq "_repositionOnShelf" usr/lib64/gnome-shell/libshell-18.so
      ! grep -aFq "gap = Math.max(gap, 8 * scale)" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "sni.signalHandlerIsConnected" usr/lib64/gnome-shell/libshell-18.so
      ! grep -Fq -- "-y-offset: 16px" Suno-shelf.css
      ! grep -Fq -- "-boxpointer-gap: 8px" Suno-shelf.css
      grep -Fq ".popup-menu-boxpointer.Suno-shelf-surface { -arrow-rise: 0; -arrow-base: 0; }" Suno-shelf.css
      # Beam presents the on-screen display (0132).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/osdWindow.js >osdWindow.js
      grep -Fq "export class OsdWindowManager" osdWindow.js
      grep -Fq "showAll(icon, label, level, maxLevel)" osdWindow.js
      grep -Fq "placeShelfSurface(quick" osdWindow.js
      grep -Fq "Atk.Live.POLITE" osdWindow.js
      for css in gnome-shell-light.css gnome-shell-dark.css gnome-shell-high-contrast.css; do
        [ -f "$css" ] || gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
          "/org/gnome/shell/theme/$css" >"$css"
        grep -Fq "width: 236px;" "$css"
        case $css in
          *dark*) grep -Fq ".Suno-beam.Suno-surface-dark {" "$css" ;;
          *) grep -Fq ".Suno-beam.Suno-surface-glass {" "$css" ;;
        esac
      done
      # No volume change sound from the slider (0133).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/status/volume.js >volume.js
      ! grep -Fq "audio-volume-change" volume.js
      grep -Fq "push_volume" volume.js
      printf "Packaged shelf surface rule, Beam and silent volume: PASS\n"
      # A dock item entrance stopped by a stage view rebuild settles at rest (0135).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/dash.js >dash.js
      grep -Fq "_settleShown()" dash.js
      grep -Fq "onStopped: () => this.destroy()," dash.js
      # Dock previews resize on close; the dock menu is grouped, titled and has Open at Login (0136).
      grep -Fq "_resizeTimeline" SunoDockWindows.js
      grep -Fq "holdSize()" SunoDockWindows.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/appMenu.js >appMenu.js
      grep -Fq "GetLoginItem" appMenu.js
      grep -Fq "LoginItemsChanged" appMenu.js
      grep -Fq "class GroupRule" appMenu.js
      ! grep -Fq "_openWindowsHeader" appMenu.js
      # The dock menu title is the app name in its own case (0137).
      grep -Fq "Suno-menu-title" appMenu.js
      ! grep -Fq "toLocaleUpperCase" appMenu.js
      grep -Fq ".popup-menu-item.Suno-menu-title > StLabel { font-size: 13px; font-weight: 700; }" Suno-shelf.css
      # System indicators join the Well instead of an island of their own (0138).
      grep -Fq "_adoptRecordingIndicator" Suno-dash.js
      grep -Fq "Suno-screen-recorded-indicator" Suno-shelf.css
      # Ctrl+Shift+1 to 4 are the only screenshot shortcuts (0139), each
      # opening its own mode (0181): the tool on its own has none.
      override=usr/share/glib-2.0/schemas/00_org.gnome.shell.gschema.override
      grep -Fxq "show-screenshot-ui=@as []" "$override"
      grep -Fxq "screenshot-window=[<Ctrl><Shift>2]" <(tr -d "\047" <"$override")
      grep -Fxq "show-screen-recording-ui=[<Ctrl><Shift>4]" <(tr -d "\047" <"$override")
      grep -Fxq "screenshot=@as []" "$override"
      ! grep -Fq "Print" "$override"
      grep -Fq "name=\"show-screenshot-ui-area\"" usr/share/gnome-control-center/keybindings/50-gnome-shell-screenshots.xml
      grep -Fq "name=\"show-screenshot-ui-screen\"" usr/share/gnome-control-center/keybindings/50-gnome-shell-screenshots.xml
      ! grep -Fq "name=\"show-screenshot-ui\"" usr/share/gnome-control-center/keybindings/50-gnome-shell-screenshots.xml
      grep -aFq "showScreenshotUIScreen" usr/lib64/gnome-shell/libshell-18.so
      grep -Fq "ConditionPathExists=!%S/Suno/migrations/screenshot-shortcuts-2" \
        usr/lib/systemd/user/Suno-screenshot-shortcuts-migrate.service
      ! grep -Fq "name=\"screenshot\"" usr/share/gnome-control-center/keybindings/50-gnome-shell-screenshots.xml
      grep -aFq "showScreenshotUIArea" usr/lib64/gnome-shell/libshell-18.so
      test -L usr/lib/systemd/user/graphical-session.target.wants/Suno-screenshot-shortcuts-migrate.service
      grep -Fq "ExecStart=/usr/bin/gjs -m /usr/lib64/gnome-shell/Suno-screenshot-shortcuts-migrate.js" \
        usr/lib/systemd/user/Suno-screenshot-shortcuts-migrate.service
      schemas=$(mktemp -d)
      # cpio stops reading once its member is out, which would end rpm2cpio
      # with SIGPIPE under pipefail: unpack from a file.
      rpm2cpio "$OLDPWD"/RPMS/noarch/gnome-shell-common-*.rpm >common.cpio
      cpio -idm --quiet ./usr/share/glib-2.0/schemas/org.gnome.shell.gschema.xml <common.cpio
      cp usr/share/glib-2.0/schemas/org.gnome.shell.gschema.xml "$override" "$schemas/"
      glib-compile-schemas --strict "$schemas"
      GSETTINGS_SCHEMA_DIR="$schemas" GSETTINGS_BACKEND=memory SUNO_MIGRATE_TEST=1 \
        gjs -m "$OLDPWD/SOURCES/screenshot-shortcuts-migrate.js" \
        "$PWD/usr/lib64/gnome-shell/Suno-screenshot-shortcuts-migrate.js" | tee migrate.log
      grep -Fxq "migration: PASS" migrate.log
      rm -rf "$schemas"
      # Beam finds files and folders and ranks every result in one list (0140).
      for module in SunoSearchRanking SunoFileIndex SunoFileSearch SunoSettingsSearch SunoFilerPlaces SunoPlacesSearch SunoSearch search; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$module.js >$module.js
      done
      gjs -m "$OLDPWD/SOURCES/search-ranking-gjs.js" "$PWD/SunoSearchRanking.js" \
        "$OLDPWD/SOURCES/search-ranking-vectors.json" "$OLDPWD/SOURCES/search-settings-cases.json" \
        "$OLDPWD/SOURCES/search-settings-pages.json" | tee search-ranking.log
      grep -Fxq "ranking (gjs): PASS" search-ranking.log
      grep -Fq "org.freedesktop.LocalSearch3" SunoFileIndex.js
      grep -Fq "remember-recent-files" SunoFileIndex.js
      grep -Fq "replacesProviderIds = [FILER_DESKTOP_ID]" SunoFileSearch.js
      grep -Fq "org.freedesktop.FileManager1" SunoFileSearch.js
      grep -Fq "new SunoFileSearch.SunoFileSearchProvider()" SunoSearch.js
      grep -Fq "this._results.revealDefault()" SunoSearch.js
      grep -Fq "new SunoSettingsSearch.SunoSettingsSearchProvider()" SunoSearch.js
      grep -Fq "launch-panel" SunoSettingsSearch.js
      grep -Fq "SUNO_MAX_SETTING_ROWS = 4" search.js
      # Beam finds the Filer places: Applications, apps, trash, bin (0187).
      gjs -m "$OLDPWD/SOURCES/search-places-gjs.js" "$PWD/SunoFilerPlaces.js" \
        "$OLDPWD/SOURCES/search-filer-places.json" | tee search-places.log
      grep -Eq "^filer places: [0-9]+ checks, 0 failures$" search-places.log
      grep -Fq "new SunoPlacesSearch.SunoPlacesSearchProvider()" SunoSearch.js
      grep -Fq "launch_uris_async([uri]" SunoPlacesSearch.js
      grep -Fq "seenLocations" search.js
      grep -Fq "addMergedRow(providerDisplay, display)" search.js
      grep -Fq ".Suno-search-dialog .Suno-search-result-reveal" gnome-shell-light.css
      rpm -qp --requires "$OLDPWD/$shell_rpm" >search-requires.txt
      grep -Fq libtinysparql search-requires.txt
      printf "Packaged Beam files and folders: PASS\n"
      # Beam keeps the kind label whole and ranks mail by its kind (0153).
      grep -Fq "overlay_scrollbars: !this._compact" search.js
      grep -Fq "this._kindLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE" search.js
      grep -Fq "SUNO_MAX_CONTENT_ROWS = 3" search.js
      grep -q "\[.mail., _(.Mail.), \[.Email.\]\]" search.js
      grep -Fq "CONTENT_KINDS.has(kind)" SunoSearchRanking.js
      # Beam takes the island radius and is a slider (0141).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/osdWindow.js >osdWindow-0141.js
      grep -Fq "export const SHELF_ISLAND_RADIUS = 18;" shelfMetrics.js
      grep -Fq "cornerRadii: SHELF_ISLAND_RADIUS" osdWindow-0141.js
      grep -Fq "Atk.Role.SLIDER" osdWindow-0141.js
      grep -Fq "_syncHold()" osdWindow-0141.js
      ! grep -Fq "Shell.util_set_hidden_from_pick(this, true)" osdWindow-0141.js
      ! grep -Fq "border-radius: 24px;" <(sed -n "/Beam: Suno/,/Suno notification-owned/p" gnome-shell-light.css)
      printf "Packaged Beam slider: PASS\n"
      # Capture replaces the GNOME screenshot panel (0142).
      for module in SunoCapture screenshot status/remoteAccess SunoShelfSurface; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$module.js >"capture-${module##*/}.js"
      done
      grep -Fq "export const CaptureBar" capture-SunoCapture.js
      grep -Fq "view.get_framebuffer() === framebuffer" capture-SunoCapture.js
      grep -Fq "export function placeShelfBar" capture-SunoShelfSurface.js
      grep -Fq "Capture.placeShelfBar({width, height})" capture-screenshot.js
      grep -Fq "this._primaryMonitorBin.hide();" capture-screenshot.js
      grep -Fq "export function showScreenshotUIWindow" capture-screenshot.js
      ! grep -Fq "Meta.KeyBindingFlags.PER_WINDOW" capture-screenshot.js
      grep -Fq "!Main.screenshotUI.hasRecordingPill" capture-remoteAccess.js
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/Suno-capture.css >Suno-capture.css
      grep -Fq ".Suno-capture-bar { height: 58px; }" Suno-capture.css
      for glyph in screen window selection record-screen record-selection close chevron check; do
        grep -Fq "strokes outlined for symbolic recolouring" \
          "usr/share/icons/hicolor/scalable/status/Suno-capture-$glyph-symbolic.svg"
      done
      schemas=$(mktemp -d)
      cpio -idm --quiet ./usr/share/glib-2.0/schemas/org.projectSuno.capture.gschema.xml <common.cpio
      cp usr/share/glib-2.0/schemas/org.projectSuno.capture.gschema.xml "$schemas/"
      glib-compile-schemas --strict "$schemas"
      GSETTINGS_SCHEMA_DIR="$schemas" GSETTINGS_BACKEND=memory \
        gsettings get org.projectSuno.capture save-to >capture-save-to.txt
      grep -Fxq pictures <(tr -d "\047" <capture-save-to.txt)
      rm -rf "$schemas"
      printf "Packaged Capture: PASS\n"
      # Captures keep every pixel, and each shortcut opens its own mode (0181).
      grep -Fq "this._paintEachScale(scale);" capture-screenshot.js
      grep -Fq "scale = this._captureScale(...logical);" capture-screenshot.js
      grep -Fq "texture = this._stageTextures?.get(scale) ?? null;" capture-screenshot.js
      grep -Fq "global.stage.paint_to_content(rect, scale, null," capture-screenshot.js
      grep -Fq "showScreenshotUIScreen" capture-screenshot.js
      grep -Fq "this._areaSelector.syncCursor();" capture-screenshot.js
      grep -Fq "if (symbol === Clutter.KEY_Escape) {" capture-screenshot.js
      grep -Fq "new PopupMenu.PopupMenu(sourceActor, 0.5, St.Side.BOTTOM)" capture-SunoCapture.js
      grep -Fq "[Mode.SELECTION, Mode.WINDOW, Mode.SCREEN]" capture-SunoCapture.js
      grep -Fq "[Mode.SCREEN]: \"show-screenshot-ui-screen\"" <(tr "\047" "\042" <capture-SunoCapture.js)
      ! grep -Fq ".Suno-capture-menu {" Suno-capture.css
      printf "Packaged sharp captures and shortcut modes: PASS\n"
      # The notification island folds into its edge; nothing announces a
      # window asking for attention (0182, 0183).
      for module in shelf SunoNotificationBeacon windowAttentionHandler SunoDockBadgeModel; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$module.js >"quiet-$module.js"
      done
      grep -Fq "this._beacon.hold();" quiet-shelf.js
      grep -Fq "this._beacon.release();" quiet-shelf.js
      grep -Fq "const BEACON_LEAVE_TIME = 150;" quiet-shelf.js
      grep -Fq "const show = this._beacon.visible && !this._beacon.held;" quiet-shelf.js
      grep -Fq "    release() {" quiet-SunoNotificationBeacon.js
      grep -Fq "Main.activateWindow(window);" quiet-windowAttentionHandler.js
      ! grep -Fq "MessageTray" quiet-windowAttentionHandler.js
      ! grep -Fq "addNotification" quiet-windowAttentionHandler.js
      grep -Fxq "export const URGENT_WINDOWS_DOT = true;" quiet-SunoDockBadgeModel.js
      printf "Packaged island fold and quiet attention: PASS\n"
      # A glass surface never blurs its own last output (0184).
      grep -aFq "SUNO_SHELL_BLUR_KEEP_STALE_BACKGROUND" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "shell_blur_effect_get_background_paint_counts" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "get_background_paint_counts" usr/lib64/gnome-shell/Shell-18.typelib
      printf "Packaged glass backdrop: PASS\n"
      # Notifications lead with the app icon, not a glyph at tile size (0186).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/messageList.js >messageList-0186.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/notificationDaemon.js >notificationDaemon-0186.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoNotificationBeacon.js >SunoNotificationBeacon-0186.js
      grep -Fq "export function isGlyphIcon(gicon)" messageList-0186.js
      grep -Fq "isGlyphIcon(sourceIcon.gicon)" messageList-0186.js
      ! grep -Fq "sourceIcon.is_symbolic" messageList-0186.js
      # The Studio lip (0192) replaced the beacon tiles: its pill stack leads
      # with the application icon, and only falls back to a glyph.
      grep -Fq "gicon: source.app?.get_icon() ?? source.icon" SunoNotificationBeacon-0186.js
      ! grep -Fq "some(name => name.endsWith(" SunoNotificationBeacon-0186.js
      grep -Fq "export function lookupNotifyingApp(name" notificationDaemon-0186.js
      grep -Fq "return lookupNotifyingApp(appId) ??" notificationDaemon-0186.js
      printf "Packaged notification app icons: PASS\n"
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoAndroidActivation.js >android-existing-activation.js
      gjs -m "$OLDPWD/SOURCES/android-existing-activation.js" android-existing-activation.js
      # Windows travel to and from their dock icon (0143).
      for module in SunoWindowPath SunoWindowMotion windowManager appDisplay; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$module.js >"motion-$module.js"
      done
      gjs -m "$OLDPWD/SOURCES/window-motion.js" motion-SunoWindowPath.js
      grep -Fq "export const MINIMIZE_TIME = 320;" motion-SunoWindowMotion.js
      grep -Fq "!settings.enable_animations" motion-SunoWindowMotion.js
      grep -Fq "_SunoDockTarget(window)" motion-windowManager.js
      grep -Fq "getShelfIconGeometry?.(window)" motion-windowManager.js
      grep -Fq "revealWindow(actor)" motion-windowManager.js
      grep -Fq "SunoWindowMotion.noteLaunch(this.app" motion-appDisplay.js
      printf "Packaged window motion: PASS\n"
      # The Capture thumbnail can be dragged into apps (0144).
      test -x usr/libexec/Suno-capture-drag
      head -1 usr/libexec/Suno-capture-drag | grep -Fxq "#!/usr/bin/gjs -m"
      grep -Fq "Gdk.FileList.new_from_array" usr/libexec/Suno-capture-drag
      grep -Fq "x-special/gnome-copied-files" usr/libexec/Suno-capture-drag
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoCapture.js >capture-drag-SunoCapture.js
      grep -Fq "export class ThumbnailDragBridge" capture-drag-SunoCapture.js
      grep -Fq "Meta.WaylandClient.new_subprocess" capture-drag-SunoCapture.js
      grep -Fq "window.hide_from_window_list()" capture-drag-SunoCapture.js
      grep -Fq "Config.LIBEXECDIR, DRAG_HELPER" capture-drag-SunoCapture.js
      printf "Packaged Capture thumbnail drag: PASS\n"
      # The now-playing island always ends whole, and reports when it did not (0145).
      for module in shelf shelfMedia SunoMediaIslandGuard; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$module.js >"island-$module.js"
      done
      grep -Fq "new MediaIslandGuard(this._mediaIsland, this._media," island-shelf.js
      grep -Fq "this._mediaGuard.stopped(motion, finished) ===" island-shelf.js
      ! grep -Fq "onComplete: () => { this._mediaIsland[property] = -1; this._sync(); }" island-shelf.js
      grep -Fq "this._crossfade(this._copy," island-shelfMedia.js
      grep -Fq "Suno shelf: the now-playing island was left" island-SunoMediaIslandGuard.js
      grep -Fq "const LOG_INTERVAL_MS = 60 * 1000;" island-SunoMediaIslandGuard.js
      printf "Packaged now-playing island guard: PASS\n"
      # Seal replaces the polkit dialog; a password is always offered (0146).
      for module in SunoSealAuth SunoSealCopy SunoSealGlyph components/polkitAgent; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$module.js >"seal-${module##*/}.js"
      done
      gjs -m "$OLDPWD/SOURCES/seal-conversations.js" seal-SunoSealAuth.js seal-SunoSealCopy.js
      grep -Fq "class AuthenticationDialog extends ModalDialog.ModalDialog" seal-polkitAgent.js
      grep -Fq "new Conversations({" seal-polkitAgent.js
      grep -Fq "nativeAgent.get_request_detail(key)" seal-polkitAgent.js
      grep -Fq "this.setInitialKeyFocus(this._entry);" seal-polkitAgent.js
      grep -Fq "this.complete(dismissed);" seal-polkitAgent.js
      if grep -Fq "prompt-dialog-password-entry" seal-polkitAgent.js; then exit 1; fi
      grep -Fq "Disconnect before cancelling" seal-SunoSealAuth.js
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/Suno-seal.css >seal-theme.css
      grep -Fq ".Suno-seal-card.Suno-surface-dark" seal-theme.css
      grep -aFq "shell_polkit_authentication_agent_get_request_detail" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "get_request_detail" usr/lib64/gnome-shell/Shell-18.typelib
      printf "Packaged Seal administrator prompt: PASS\n"
      # Unread badges on dock icons (0147).
      for module in SunoDockBadgeModel SunoDockBadges dash shelf; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$module.js >"badges-$module.js"
      done
      gjs -m "$OLDPWD/SOURCES/dock-badges.js" badges-SunoDockBadgeModel.js
      grep -Fq "#c24a0b" badges-SunoDockBadgeModel.js
      grep -Fq "com.canonical.Unity.LauncherEntry" badges-SunoDockBadges.js
      grep -Fq "publishes.includes(AGENT_BADGE_VALUE)" badges-SunoDockBadges.js
      grep -Fq "Gio.DBusCallFlags.NO_AUTO_START" badges-SunoDockBadges.js
      grep -Fq "this._badge = this._attachBadge();" badges-dash.js
      grep -Fq "this.child.badgeAccessibleName?.(text) ?? text" badges-dash.js
      grep -Fq "this._dockContent.clip_to_view = clip;" badges-shelf.js
      grep -Fq "this._setDockLength(dockLength, true);" badges-shelf.js
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/Suno-shelf.css >badges-Suno-shelf.css
      grep -Fq ".Suno-dock-badge {" badges-Suno-shelf.css
      grep -Fq -- "-Suno-badge-ring: #e9ebed;" badges-Suno-shelf.css
      grep -Fq "<key name=\"dock-badges-disabled-apps\" type=\"as\">" usr/share/glib-2.0/schemas/org.gnome.shell.gschema.xml
      printf "Packaged dock badges: PASS\n"
      # The screen sharing picker, the violet edge and the Stop pill (0149).
      for module in SunoShare SunoCapture SunoDockWindows SunoCast messageTray \
                    status/remoteAccess main; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$module.js >"share-${module##*/}.js"
      done
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/Suno-share.css >share-theme.css
      gjs -m "$OLDPWD/SOURCES/screen-sharing.js" share-SunoShare.js share-theme.css
      # The reuse the coordinator asked for has to be real in the built
      # bundle, not only in the tree: one renderer, one shelf surface, one
      # reading of the monitors, one notification setting.
      grep -Fq "export const PreviewThumbnail" share-SunoDockWindows.js
      grep -Fq "export const ShelfSurface" share-SunoCapture.js
      grep -Fq "export async function listDisplays" share-SunoCast.js
      grep -Fq "peekShare()?.silencing" share-messageTray.js
      grep -Fq "showHeldNotification" share-messageTray.js
      # The Well mark stands down while the pill is up.
      grep -Fq "pillReplacesWellMark" share-remoteAccess.js
      # The picker owns its bus name from startup, not on the first request.
      grep -Fq "SunoShare.getShare()" share-main.js
      printf "Packaged screen sharing picker: PASS\n"
      # One glyph size and one inset hover box along the shelf (0151).
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/Suno-shelf.css >Suno-shelf-0151.css
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoWell.js >SunoWell-0151.js
      grep -Fq ".Suno-well-glyph { width: 14px; height: 14px; }" Suno-shelf-0151.css
      grep -Fq ".Suno-well .Suno-well-extension .panel-button StIcon { icon-size: 14px; }" Suno-shelf-0151.css
      grep -Fq ".Suno-well-item { min-width: 28px; height: 28px; padding: 0 7px; border-radius: 8px; }" Suno-shelf-0151.css
      grep -Fq ".Suno-status-cluster .Suno-status-clock { padding: 0 8px; min-width: 56px; }" Suno-shelf-0151.css
      grep -Fq "const GLYPH_SIZE = 14;" SunoWell-0151.js
      grep -Fq "_normaliseExtensionIcons(container, indicator)" SunoWell-0151.js
      grep -Fq "Suno-well-silhouette" SunoWell-0151.js
      grep -Fq "An icon drawn as an opaque square has no" SunoWell-0151.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoFocusVisible.js >SunoFocusVisible-0151.js
      grep -Fq "remove_style_pseudo_class(\"focus\")" SunoFocusVisible-0151.js || grep -Fq "remove_style_pseudo_class" SunoFocusVisible-0151.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so /org/gnome/shell/ui/shelf.js >shelf-0151.js
      grep -Fq "new FocusVisible(this)" shelf-0151.js
      ! grep -Fq "box-shadow: 0 0 0 2px #91b6d2" Suno-shelf-0151.css
      ! grep -Fq "rgba(127,127,127,0.2)" Suno-shelf-0151.css
      grep -Fq ".Suno-shelf-media-island.Suno-surface-glass .Suno-media-control:active { background-color: rgba(25, 27, 31, 0.09); }" Suno-shelf-0151.css
      grep -Fq ".Suno-shelf-material.Suno-surface-glass.Suno-island-press { box-shadow: inset 0 0 0 200px rgba(25, 27, 31, 0.09); }" Suno-shelf-0151.css
      grep -Fq "this._beaconIsland.setBody(this._beacon);" shelf-0151.js
      grep -Fq "this._liveIsland.setBody(liveIndicator);" shelf-0151.js
      printf "Packaged shelf glyph size and hover rhythm: PASS\n"
      # Screenshots paint frost and glass surfaces as the screen does (0154).
      grep -aFq "Could not allocate the stage image" usr/lib64/gnome-shell/libshell-18.so
      printf "Packaged screenshot backdrop blur: PASS\n"
      # The countdown disc, its blur and the white of the flash are children of
      # their CaptureHidden, so no recording or screen share carries them (0156).
      grep -Fq "this._disc.add_effect_with_name(" capture-SunoCapture.js
      grep -Fq "this._disc.add_child(this._label);" capture-SunoCapture.js
      grep -Fq "never styled on itself" capture-SunoCapture.js
      printf "Packaged Capture countdown privacy: PASS\n"
      # Frost and glass menus are the light sheet menus on a veil (0157,
      # made light by 0170); the dark sheet carries no frost or glass rule.
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/gnome-shell-dark.css >menus-0157-dark.css
      gresource extract usr/share/gnome-shell/gnome-shell-theme.gresource \
        /org/gnome/shell/theme/gnome-shell-light.css >menus-0157-light.css
      grep -A1 -F ".popup-menu.Suno-surface-glass .popup-menu-content {" menus-0157-light.css |
        grep -Fq "border-color: rgba(255, 255, 255, 0.62)"
      ! grep -Fq ".popup-menu.Suno-surface-glass .popup-menu-content" menus-0157-dark.css
      printf "Packaged frost and glass menus: PASS\n"
      # A plain tray actor takes its ink from its St parent, and one indicator
      # the Well cannot adopt never drops the live islands (0158).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoWell.js >SunoWell-0158.js
      grep -Fq "while (styled && !(styled instanceof St.Widget))" SunoWell-0158.js
      ! grep -Fq "actor.connectObject(\"style-changed\"" SunoWell-0158.js
      grep -aFq "Suno Well could not adopt" usr/lib64/gnome-shell/libshell-18.so
      printf "Packaged live islands across appearance changes: PASS\n"
      # A detail header glyph is the detail ink, on or off, in light (0159).
      grep -A2 -F ".quick-toggle-menu.Suno-quick-detail .header .icon.active {" gnome-shell-light.css |
        grep -Fq "color: #30343a;"
      printf "Packaged detail header glyph: PASS\n"
      # Notifications live in the shelf: the notifications island ends the
      # row, and ordinary notifications skip the banner (0160).
      grep -q "_registerIsland(.live., this._liveIsland)" Suno-dash.js
      grep -Fq "SunoShelfIsland-" Suno-dash.js
      grep -Fq "animationRequired: true" Suno-dash.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/messageTray.js >messageTray-0160.js
      grep -Fq "export const NOTIFICATIONS_LIVE_IN_SHELF = true" messageTray-0160.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoNotificationBeacon.js >beacon-0160.js
      # The Studio lip (0192) replaced the swipe-to-dismiss island and its
      # drawer; the notifications come from the lip.
      grep -Fq "export const NotificationLip = " beacon-0160.js
      # A click outside collapses the expanded tray (0235).
      gjs -m "$OLDPWD/SOURCES/notification-lip-outside-click.js" beacon-0160.js
      # Do Not Disturb keeps the locked screen dark (0237); a refused power
      # action says so (0238).
      grep -aFq "source.policy.showInLockScreen && this._bannersShown()" usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "The system did not allow it." usr/lib64/gnome-shell/libshell-18.so
      grep -aFq "this._refused(" usr/lib64/gnome-shell/libshell-18.so
      # The sign-in fingerprint hint draws a glyph the image provides (0240).
      grep -aFq "SunoUI-fingerprint-symbolic" usr/lib64/gnome-shell/libshell-18.so
      ! grep -aEq "icon_name: .fingerprint-symbolic" usr/lib64/gnome-shell/libshell-18.so
      grep -Fq "Suno-notification-beacon-dismiss" Suno-shelf.css
      # A sync asked for inside a sync waits; the row is emptied from a copy.
      grep -Fq "this._syncAgain = true;" Suno-dash.js
      ! grep -Fq "this._group.remove_all_children()" Suno-dash.js
      printf "Packaged notifications island: PASS\n"
      # One wash and one focus ring for the whole Quick Options island (0161).
      grep -Fq "_syncActionsWash()" Suno-dash.js
      grep -Fq ".Suno-status-cluster.Suno-shelf-material .Suno-well-item:hover," Suno-shelf.css
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoWell.js >SunoWell-0161.js
      grep -B1 -F "actor.icon_name = symbolic;" SunoWell-0161.js | grep -Fq "actor.gicon = null;"
      printf "Packaged one-surface Quick Options island: PASS\n"
      # The screenshot thumbnail throws away, has a menu and keys (0162).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoCapture.js >capture-0162.js
      grep -Fq "export function flingVerdict" capture-0162.js
      grep -Fq "export async function restoreFromTrash" capture-0162.js
      grep -Fq "_openWithOther()" capture-0162.js
      grep -q "event: .menu., serial" usr/libexec/Suno-capture-drag
      printf "Packaged capture thumbnail throw and menu: PASS\n"
      # The sticky note stack only while Sticky Notes is installed (0163).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoStickyDock.js >SunoStickyDock-0163.js
      grep -Fq "export class StickyDockManager" SunoStickyDock-0163.js
      grep -Fq "ListActivatableNames" SunoStickyDock-0163.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/main.js >main-0163.js
      grep -Fq "new SunoStickyDock.StickyDockManager(" main-0163.js
      ! grep -Fq "new SunoStickyDock.SunoStickyDock()" main-0163.js
      printf "Packaged sticky note stack only with Sticky Notes: PASS\n"
      # Quick Options matches the design: two shapes, a hole-free pill grid,
      # one disclosure, sheets in flow and attached, no extra rows (0164).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/quickSettings.js >quickSettings-0164.js
      grep -Fq "class QuickSheetFrame extends St.DrawingArea" quickSettings-0164.js
      grep -Fq "export const QuickSheetRow" quickSettings-0164.js
      grep -Fq "const GRID_UNITS = 6;" quickSettings-0164.js
      grep -Fq "sheet.clear_constraints();" quickSettings-0164.js
      ! grep -Fq "QuickUtilityRow" quickSettings-0164.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/panel.js >panel-0164.js
      grep -Fq "Suno-quick-pill" panel-0164.js
      ! grep -q "label: _(.Calendar.)" panel-0164.js
      ! grep -Fq "_backgroundApps.quickSettingsItems.forEach" panel-0164.js
      grep -Fq ".Suno-sheet-frame {" gnome-shell-light.css
      grep -Fq ".Suno-quick-options.Suno-surface-glass .Suno-sheet-frame" Suno-shelf.css
      ! grep -Fq "Suno-quick-pill:checked" Suno-controls.css
      for glyph in down up; do
        test -f "usr/share/icons/hicolor/scalable/status/Suno-disclosure-$glyph-symbolic.svg"
        ! grep -Fq "stroke=" "usr/share/icons/hicolor/scalable/status/Suno-disclosure-$glyph-symbolic.svg"
      done
      printf "Packaged Quick Options polish: PASS\n"
      # Glass is the light material (0170); Frost is the approved smoked
      # glass (0196): it wears the dark classes plus Suno-surface-smoke.
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoSurfaceMaterials.js >SunoSurfaceMaterials-0170.js
      grep -Fq "export const LIGHT_FAMILY = new Set(" SunoSurfaceMaterials-0170.js
      grep -Fq "rgba(250,250,251,0.85)" SunoSurfaceMaterials-0170.js
      ! grep -Fq "rgba(28,33,40,0.86)" SunoSurfaceMaterials-0170.js
      ! grep -Fq "rgba(14, 19, 26, 0.78)" Suno-shelf.css
      grep -Fq ".popup-menu.Suno-surface-glass .popup-menu-content" gnome-shell-light.css
      grep -Fq "Suno-surface-smoke" SunoSurfaceMaterials-0170.js
      grep -Fq ".Suno-shelf-material.Suno-surface-smoke," Suno-shelf.css
      grep -Fq "background-gradient-end: rgba(26,26,30,0.84);" Suno-shelf.css
      printf "Packaged frost and glass light material: PASS\n"
      # Movable shelf islands (0167, ADR-044): the model and its tests, the
      # group controller, arrange mode, and surfaces that follow each
      # island own edge.
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/shelfArrangement.js >shelfArrangement.js
      gjs -m "$OLDPWD/SOURCES/shelf-arrangement.js" shelfArrangement.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/shelfArrange.js >shelfArrange-0167.js
      grep -Fq "export class ShelfArrange" shelfArrange-0167.js
      grep -Fq "Arrange Islands…" shelfArrange-0167.js
      grep -Fq "Atk.Live.POLITE" shelfArrange-0167.js
      grep -Fq "class ShelfGroupActor extends St.Widget" Suno-dash.js
      grep -Fq "moveFocusedIsland(bindingName, event)" Suno-dash.js
      grep -Fq "shelf-arrangement" Suno-dash.js
      ! grep -Fq "this._group.remove_all_children()" Suno-dash.js
      grep -Fq ".Suno-arrange-card" Suno-shelf.css
      for f in panel windowManager SunoShelfSurface; do
        gresource extract usr/lib64/gnome-shell/libshell-18.so \
          /org/gnome/shell/ui/$f.js >$f-0167.js
      done
      grep -Fq "setStatusParts(order, clockVertical = null)" panel-0167.js
      grep -Fq "Main.shelf?.moveFocusedIsland?.(binding.get_name(), event)" windowManager-0167.js
      grep -Fq "Main.shelf?.edgeForActor?.(island)" SunoShelfSurface-0167.js
      printf "Packaged movable shelf islands: PASS\n"
      # Dock folders (0180): the module surface, named method by method.
      # Not decoration. An edit that removes a method by accident -- a range
      # taken by index rather than by an anchor, which has happened -- builds,
      # packages and ships, and is first noticed as a dead folder in someone
      # dock. A method deliberately removed should leave this list in the
      # same commit.
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoDockFolders.js >SunoDockFolders-0180.js
      # Anchored on the declaration, leading indent and opening brace and
      # all: a bare name matches a renamed method as a substring and would
      # pass while the method it names is gone.
      for symbol in \
        "    get visible() {" "    get shown() {" "    get edge() {" \
        "    viewFor(model) {" "    _setViewFor(model, view) {" \
        "    badgeCount(model) {" "    getFolderDropTarget() {" "    pinAll(uris) {" \
        "    setFolderDragActive(active) {" "    _ensureFoldersPlaced() {" \
        "    onHeaderPress(actor, event) {" "    _onDragEvent(event) {" \
        "    _endHeaderDrag() {" "    _queueThumbnails() {" \
        "    _resolveThumbnails() {" "    openItemMenu(actor, item) {" \
        "    openTileMenu(tile) {" "    pin(uri) {" "    unpin(uri) {" \
        "    onKey(event) {"; do
        grep -Fq "$symbol" SunoDockFolders-0180.js || {
          printf "Dock folders: %s missing from the packaged module\n" "$symbol" >&2
          exit 1
        }
      done
      ! grep -Fq "global.stage.grab" SunoDockFolders-0180.js
      ! grep -Fq "view-pin-symbolic" SunoDockFolders-0180.js
      ! grep -Fq "marriedIn" SunoDockFolders-0180.js
      printf "Packaged dock folders: PASS\n"
      # The input method must not swallow a key (0173). A key it cannot
      # answer for -- a context re-targeted while windows changed, a
      # cancelled call -- goes to the window unfiltered, which is the
      # difference between typing and watching letters disappear.
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/misc/inputMethod.js >inputMethod-0173.js
      test "$(grep -c "this.notify_key_event(event, false);" inputMethod-0173.js)" = 2
      printf "Packaged input method key handling: PASS\n"
      # Three fingers switch app, four switch workspace (0174): the module
      # ships, the counts are exact, and the workspace gesture reads the
      # setting rather than assuming.
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoAppSwitch.js >SunoAppSwitch-0174.js
      grep -Fq "export class SunoAppSwitchGesture" SunoAppSwitch-0174.js
      grep -Fq "fingerCount: 3" SunoAppSwitch-0174.js
      grep -Fq "exactFingerCount: true" SunoAppSwitch-0174.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/workspaceAnimation.js >workspaceAnimation-0174.js
      grep -Fq "fingerCount: SunoWorkspaceFingers()" workspaceAnimation-0174.js
      grep -Fq "touchpad-workspace-fingers" workspaceAnimation-0174.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/swipeTracker.js >swipeTracker-0174.js
      grep -Fq "this._exactFingerCount" swipeTracker-0174.js
      grep -Fq "touchpad-gesture-migration" windowManager-0167.js
      printf "Packaged touchpad gestures: PASS\n"
      # A tap is a tap (0175): the press gesture, the tray that holds
      # nothing when it has nothing, and the mark that waits for its place.
      grep -Fq "_watchPresses()" shelfArrange-0167.js
      grep -Fq "LongPressGesture" shelfArrange-0167.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoWell.js >SunoWell-0175.js
      grep -Fq "rest.length > 0 ||" SunoWell-0175.js
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/SunoDockWindows.js >SunoDockWindows-0175.js
      grep -Fq "if (this.box)" SunoDockWindows-0175.js
      printf "Packaged tap, tray and marks: PASS\n"
      # Islands on every edge and every Dash setting (0171): shared-edge bands
      # through Mutter, pointer-aimed zones, weighted zones and the edge line,
      # the live slot, free placement, the spanning bar, float ends, the
      # protruding gap, and the Dash menu as a kit menu.
      grep -Fq "set_monitor_edge_reservation(r.monitor" Suno-dash.js
      grep -Fq "_mergeBands(resolved)" Suno-dash.js
      grep -Fq "_ghostIsland(id)" Suno-dash.js
      grep -Fq "shelf-free-placement" Suno-dash.js
      grep -Fq "margin: this._windowBorderSize() * scale," Suno-dash.js
      grep -Fq "export function zoneWeight" shelfArrangement.js
      grep -Fq "export function bandSegments" shelfArrangement.js
      grep -Fq "EdgeLine" shelfArrange-0167.js
      grep -Fq "Dash Settings…" shelfArrange-0167.js
      ! grep -Fq "Shelf Settings" shelfArrange-0167.js
      #0250 removes the blocking arrangement card. Keep checking the actual
      # direct-grab and saved folder-membership owners, not deleted UI copy.
      ! grep -Fq "_buildCard(" shelfArrange-0167.js
      grep -Fq "this._startDrag({ids: Arrangement.familyOf(grab)" shelfArrange-0167.js
      grep -Fq "shelf._preview?.groups ?? shelf.arrangement" SunoDockFolders-0180.js
      grep -Fq ".Suno-live-ghost-outline" Suno-shelf.css
      grep -Fq "_syncShort()" panel-0167.js
      printf "Packaged Dash islands on every edge and every setting: PASS\n"
      # Dash islands as arranged (0172): the live extensions glyph ships,
      # centred groups stay centred, hidden islands hold no edge, one bar
      # per edge without islands, the live family, hysteresis, free
      # placement soft snaps, the divider token.
      test -f usr/share/icons/hicolor/scalable/status/Suno-live-extensions-symbolic.svg
      # A symbolic glyph is filled, never stroked -- the attribute, not the
      # word: a glyph whose description says "two strokes" is not a stroked
      # glyph, and this check, spelled crudely, quietly ended the build here
      # from .121 onwards, so nothing after it ran and nothing was copied.
      ! grep -Eq "stroke[a-z-]*=" \
        usr/share/icons/hicolor/scalable/status/Suno-live-extensions-symbolic.svg
      # The old grid glyph is not the Dash mark any more. One place may name
      # it: what the system tray placeholder falls back to when the Suno
      # glyph is missing from the icon theme.
      test "$(grep -c view-grid-symbolic Suno-dash.js)" = 1
      grep -n view-grid-symbolic Suno-dash.js | grep -q fallback
      grep -Fq "_islandPresent(id)" Suno-dash.js
      grep -Fq "_allocateSegments(container" Suno-dash.js
      grep -Fq "SUNO_SHELF_RESERVATIONS" Suno-dash.js
      grep -Fq "setDivider(on, vertical)" Suno-dash.js
      grep -Fq "export function joinLiveFamily" shelfArrangement.js
      grep -Fq "export const HYSTERESIS" shelfArrangement.js
      grep -Fq "export const SOFT_SNAP" shelfArrangement.js
      grep -Fq "divider: " SunoSurfaceMaterials-0170.js
      # Empty edges reserve nothing; notifications come from their island.
      grep -Fq "keepMargin" Suno-dash.js
      grep -Fq "function notificationIslandPlace" messageTray-0160.js
      grep -Fq "export function getNotificationTray()" beacon-0160.js
      # .121: corners, one L without islands, the group handle, placeholders
      # only in arrange mode, the drop index, Tiling Shell never adopted,
      # windows glide with the Dash.
      grep -Fq "_cornerOwners(monitorIndex, edges)" Suno-dash.js
      grep -Fq "setJoins(joins)" Suno-dash.js
      grep -Fq "NEVER_ADOPTED" Suno-dash.js
      grep -Fq "work-area-changing" Suno-dash.js
      grep -Fq "_growIsland(island, id)" Suno-dash.js
      grep -Fq "reservedMargins(monitorIndex)" Suno-dash.js
      # .121: the system tray is a placeholder while arranging, and a drop
      # beside a group either joins it or becomes its own island.
      test -f usr/share/icons/hicolor/scalable/status/Suno-system-tray-symbolic.svg
      ! grep -Eq "stroke[a-z-]*=" \
        usr/share/icons/hicolor/scalable/status/Suno-system-tray-symbolic.svg
      # .141 (0176): the folders island names Suno-dock-folders-symbolic;
      # the glyph ships, filled, and is the one the name asks for.
      test -f usr/share/icons/hicolor/scalable/status/Suno-dock-folders-symbolic.svg
      ! grep -Eq "stroke[a-z-]*=" \
        usr/share/icons/hicolor/scalable/status/Suno-dock-folders-symbolic.svg
      grep -Fq "Suno-dock-folders-symbolic" Suno-dash.js
      grep -Fq "System tray" Suno-dash.js
      grep -Fq "export const SEPARATE_BAND" shelfArrangement.js
      # \x27 is an apostrophe. A literal one cannot appear in this block:
      # it is one single-quoted argument, so a raw apostrophe closes it and
      # the shell concatenates the pieces into a pattern that cannot match.
      grep -Pq "kind: \x27apart\x27" shelfArrangement.js
      grep -Fq "New island before %s" shelfArrange-0167.js
      grep -Fq "Suno-arrange-grip-pill" Suno-shelf.css
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/windowManager.js >windowManager-0172.js
      grep -Fq "SunoGlideFrame(window, rect" windowManager-0172.js
      grep -Fq "(from + to) / 2 < tip" shelfArrangement.js
      grep -Fq "Suno-arrange-grip-pill" shelfArrange-0167.js
      printf "Packaged Dash islands as arranged: PASS\n"
      # .147 (0188): a work-area reservation is hidden from pick, so a drag
      # over the dock reaches the Dash instead of an actor that takes no
      # drop; the icon a drag leaves behind is the dimmed source.
      grep -Fq "Shell.util_set_hidden_from_pick(actor, true);" Suno-dash.js
      grep -Fq "opacity: this._dragging ? DRAG_SOURCE_OPACITY : 255," dash.js
      printf "Packaged dock reorder: PASS\n"
      # The adopted Dash hides its Apps tile and has no separator for it (0224).
      grep -Fq "this._dash._showAppsIcon.hide();" Suno-dash.js
      ! grep -Fq "this._dash.showAppsButton?.show();" Suno-dash.js
      ! grep -Fq "this._appsDivider = new St.Widget" Suno-dash.js
      printf "Packaged dock without Apps button: PASS\n"
      # Quick Options names only glyphs the system icon set provides (0232).
      gresource extract usr/lib64/gnome-shell/libshell-18.so \
        /org/gnome/shell/ui/quickSettings.js >quickSettings-0232.js
      grep -Fq "SunoUI-radio-tower-symbolic" quickSettings-0232.js
      ! grep -Fq "SunoUI-hotspot-symbolic" quickSettings-0232.js
    )
  '

stable_rpms="$output_dir/RPMS"
stable_srpms="$output_dir/SRPMS"
install -d -m 0755 "$stable_rpms/$architecture" "$stable_rpms/noarch" "$stable_srpms"
# A release bumped in the spec patch but not here would look for RPMs that
# do not exist and copy nothing, quietly: say so instead.
for built in \
  "$rpmbuild_dir/RPMS/$architecture/gnome-shell-50.3-${surface_candidate_release}.fc44.${architecture}.rpm" \
  "$rpmbuild_dir/RPMS/noarch/gnome-shell-common-50.3-${surface_candidate_release}.fc44.noarch.rpm" \
  "$rpmbuild_dir/SRPMS/gnome-shell-50.3-${surface_candidate_release}.fc44.src.rpm"; do
  test -f "$built" || {
    printf 'no %s: surface_candidate_release (%s) is not the release the spec patch built\n' \
      "$(basename "$built")" "$surface_candidate_release" >&2
    exit 1
  }
done

install -m 0644 \
  "$rpmbuild_dir/RPMS/$architecture/gnome-shell-50.3-${surface_candidate_release}.fc44.${architecture}.rpm" \
  "$stable_rpms/$architecture/"
install -m 0644 \
  "$rpmbuild_dir/RPMS/noarch/gnome-shell-common-50.3-${surface_candidate_release}.fc44.noarch.rpm" \
  "$stable_rpms/noarch/"
install -m 0644 \
  "$rpmbuild_dir/SRPMS/gnome-shell-50.3-${surface_candidate_release}.fc44.src.rpm" \
  "$stable_srpms/"

# A build that copies nothing must not look like a build that worked: the
# three files are named, and counted, where they were put.
for placed in \
  "$stable_rpms/$architecture/gnome-shell-50.3-${surface_candidate_release}.fc44.${architecture}.rpm" \
  "$stable_rpms/noarch/gnome-shell-common-50.3-${surface_candidate_release}.fc44.noarch.rpm" \
  "$stable_srpms/gnome-shell-50.3-${surface_candidate_release}.fc44.src.rpm"; do
  test -s "$placed" || {
    printf 'the build did not put %s where the drop reads it from\n' \
      "$(basename "$placed")" >&2
    exit 1
  }
done
placed_count=$(find "$stable_rpms" "$stable_srpms" -type f -name \
  "gnome-shell*-50.3-${surface_candidate_release}.fc44.*.rpm" | wc -l)
test "$placed_count" = 3 || {
  printf 'expected 3 files for %s in the output, found %s\n' \
    "$surface_candidate_release" "$placed_count" >&2
  exit 1
}

(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno GNOME Shell packages: %s (%s files for %s)\n' \
  "$output_dir" "$placed_count" "$surface_candidate_release"
