#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

protocol=src/Suno-platform/protocols/ext-background-effect-v1.xml
printf '%s  %s\n' \
  e463b7863c97d7be05489b52b15cd0b3a5d8290b51340f62023b47d03b4217e3 \
  "$protocol" | sha256sum -c - >/dev/null

python3 scripts/developer/generate-Suno-platform-tokens.py --check
python3 -m py_compile src/Suno-platform/appkit/Suno_appkit/widgets.py

grep -Fq "rgba(241,242,243,.73)" \
  src/Suno-platform/appkit/Suno-appkit-frost-tokens.css
grep -Fq "rgba(255,255,255,.31)" \
  src/Suno-platform/appkit/Suno-appkit-glass-tokens.css
grep -Fq "'blur_px': <38.0>" src/Suno-platform/appearance/Suno-surface-recipes.h
grep -Fq "'saturation': <1.45>" src/Suno-platform/appearance/Suno-surface-recipes.h
grep -Fq "'blur_px': <24.0>" src/Suno-platform/appearance/Suno-surface-recipes.h
grep -Fq "'saturation': <1.65>" src/Suno-platform/appearance/Suno-surface-recipes.h

grep -Fq "meta_backend_is_rendering_hardware_accelerated" \
  patches/mutter/0006-wayland-Vendor-protocol-and-gate-blur-capability.patch
grep -Fq "meta_surface_actor_get_texture (self)" \
  patches/mutter/0007-compositor-Fix-opaque-region-after-surface-content-backport.patch
grep -Fq "Suno_surface_backdrop_new" \
  src/Suno-platform/ui/Suno-application-window.c
grep -Fq "was_available != Suno_surface_backdrop_get_available(self)" \
  src/Suno-platform/ui/Suno-surface-backdrop.c
grep -Fq "g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_AVAILABLE])" \
  src/Suno-platform/ui/Suno-surface-backdrop.c
grep -Fq "window.Suno-translucent.Suno-treatment-frost headerbar.Suno-titlebar" \
  src/Suno-platform/ui/Suno-ui.css
grep -Fq "window.Suno-translucent.Suno-treatment-glass headerbar.Suno-titlebar" \
  src/Suno-platform/ui/Suno-ui.css
grep -Fq "toolbarview.Suno-window-toolbar-view > .top-bar" \
  src/Suno-platform/ui/Suno-ui.css
grep -Fq '"SUNO_APPKIT_STRUCTURE_PATH", "Suno-ui.css"' \
  src/Suno-platform/appkit/Suno_appkit/widgets.py
grep -Fq "Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 2" \
  src/Suno-platform/appkit/Suno_appkit/widgets.py
grep -Fq "GTK_STYLE_PROVIDER_PRIORITY_APPLICATION + 2U" \
  src/Suno-platform/ui/Suno-ui-init.c
if rg -n '\.Suno-(app|application)-window \.title' \
    src/Suno-platform/appkit/Suno-appkit-base.css; then
  printf 'error: AppKit globally overrides libadwaita row title typography\n' >&2
  exit 1
fi
grep -Fq "Suno_surface_backdrop_display_is_available" \
  patches/gnome-control-center/0011-appearance-Add-native-Suno-surface-treatments.patch
grep -Fq "this._materialBinding.setEnabled(visible)" \
  patches/gnome-shell/0045-Suno-surface-materials.patch
rg -Fq "this._surface.setSurfaceVisible(surfaceMode === 'connected', castShadows)" \
  patches/gnome-shell
rg -Fq "island.setSurfaceVisible(surfaceMode === 'separate', castShadows)" \
  patches/gnome-shell

if rg -n 'g_timeout_add|GLib\.timeout_add|setInterval|Shell\.Screenshot|org\.gnome\.Shell\.Screenshot' \
    src/Suno-platform/ui/Suno-surface-backdrop.c \
    patches/gnome-shell/0045-Suno-surface-materials.patch \
    patches/gnome-control-center/0011-appearance-Add-native-Suno-surface-treatments.patch; then
  printf 'error: Surface Treatments introduced a polling or screenshot path\n' >&2
  exit 1
fi

bash -n scripts/packages/build-mutter.sh
bash -n scripts/packages/build-gnome-shell.sh
bash -n scripts/packages/build-gnome-control-center.sh
grep -Fq 'surface_candidate_release=1.Suno.99.surfacepreview20260908.8' \
  scripts/packages/build-gnome-shell.sh
grep -Fq '0047-Suno-shelf-settle-and-artwork-background.patch' \
  scripts/packages/build-gnome-shell.sh
grep -Fq 'background-gradient-start: transparent' \
  patches/gnome-shell/0047-Suno-shelf-settle-and-artwork-background.patch
grep -Fq 'this._statusHover.remove_all_transitions()' \
  patches/gnome-shell/0047-Suno-shelf-settle-and-artwork-background.patch
grep -Fq '0048-Suno-shelf-artwork-only.patch' \
  scripts/packages/build-gnome-shell.sh
grep -Fq "artwork.add_style_class_name('Suno-shelf-artwork')" \
  patches/gnome-shell/0048-Suno-shelf-artwork-only.patch
grep -Fq 'box-shadow: none !important' \
  patches/gnome-shell/0048-Suno-shelf-artwork-only.patch
grep -Fq '0049-Suno-shelf-direct-paint-damage.patch' \
  scripts/packages/build-gnome-shell.sh
grep -Fq 'Clutter.OffscreenRedirect.NEVER' \
  patches/gnome-shell/0049-Suno-shelf-direct-paint-damage.patch
grep -Fq 'Clutter.OffscreenRedirect.ALWAYS' \
  patches/gnome-shell/0049-Suno-shelf-direct-paint-damage.patch
grep -Fq '0050-Suno-status-island-material-owner.patch' \
  scripts/packages/build-gnome-shell.sh
for treatment in light dark frost glass; do
  grep -Fq "Suno-shelf-material.Suno-status-cluster.Suno-surface-$treatment" \
    patches/gnome-shell/0050-Suno-status-island-material-owner.patch
done
grep -Fq 'Suno-shelf-root.Suno-shelf-connected' \
  patches/gnome-shell/0050-Suno-status-island-material-owner.patch
grep -Fq 'surface_candidate_release=1.Suno.12.preview20260908' \
  scripts/packages/build-gnome-control-center.sh
if rg -n 'GNOME_(SHELL|CONTROL_CENTER)_SUNO_RELEASE' \
    scripts/packages/build-gnome-shell.sh \
    scripts/packages/build-gnome-control-center.sh; then
  printf 'error: Surface preview artifact paths depend on accepted tuple pins\n' >&2
  exit 1
fi
git diff --check

printf 'Surface Treatments source contracts: PASS\n'
