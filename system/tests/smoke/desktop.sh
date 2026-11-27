#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
inputs_file="$repo_root/config/desktop/inputs.env"
if [ ! -r "$inputs_file" ]; then
  # Composition copies the immutable pin set alongside this standalone test.
  # A smoke payload must never infer product versions from the running image.
  inputs_file=/var/tmp/Suno-desktop-inputs.env
fi
if [ -r "$inputs_file" ]; then
  # shellcheck disable=SC1090
  . "$inputs_file"
fi
# This immutable source pin set names the same releases for both CPUs. The
# machine's architecture selects the RPM suffix; old handheld preview aliases
# must not replace the current desktop source selection.
architecture=$(uname -m)
case "$architecture" in x86_64|aarch64) ;; *) printf 'Unsupported desktop architecture\n' >&2; exit 2 ;; esac
while IFS= read -r pin; do
  case "$pin" in *_AARCH64_NEVRA|*_X86_64_NEVRA) continue ;; *_NEVRA) ;; *) continue ;; esac
  value=${!pin}
  case "$value" in *.x86_64|*.aarch64) printf -v "$pin" '%s' "${value%.*}.$architecture" ;; esac
done < <(compgen -A variable)
SUNO_DEVELOPER_PLATFORM_NEVRA=${SUNO_DEVELOPER_PLATFORM_X86_64_NEVRA%.x86_64}.$architecture

: "${PRAIRIE_CORE_APPS_NEVRA:?desktop smoke requires the pinned desktop inputs}"
: "${SUNO_DEVELOPER_PLATFORM_NEVRA:?desktop smoke requires the pinned desktop inputs}"

failures=0
check() {
  description=$1
  shift
  if "$@"; then
    printf 'PASS  %s\n' "$description"
  else
    printf 'FAIL  %s\n' "$description"
    failures=$((failures + 1))
  fi
}

# Profiles declare unavailable capabilities explicitly; all other smoke gates
# remain the same. This signed image declaration never substitutes for the
# signed first-party application baseline or its handoff checks.
capability_manifest=/usr/share/Suno/desktop-capabilities.json
check 'desktop capabilities match the declared supported profile' python3 - "$capability_manifest" "$architecture" <<'PYPROFILE'
import json, sys
value = json.load(open(sys.argv[1]))
assert value['schema'] == 'org.projectSuno.desktop-capabilities/v1'
assert value['architecture'] == sys.argv[2]
expected = {'desktop': True, 'android_apps': True, 'windows_apps': True, 'casting': True, 'phone': False}
if value['profile'] == 'arm-preview':
    assert sys.argv[2] == 'aarch64'
    expected.update(windows_apps=False, casting=False, phone=True)
else:
    assert value['profile'] == 'full'
assert value['capabilities'] == expected
registry = json.load(open('/usr/share/Suno/desktop-profiles.json'))
assert registry['schema'] == 'org.projectSuno.desktop-profiles/v1'
selection = registry['profiles'][value['profile']]
assert sys.argv[2] in selection['architectures']
for key in ('capabilities', 'excluded_packages', 'excluded_package_prefixes'):
    assert value[key] == selection[key]
PYPROFILE
capability_enabled() {
  python3 -c 'import json,sys; sys.exit(0 if json.load(open(sys.argv[1]))["capabilities"][sys.argv[2]] else 1)' "$capability_manifest" "$1"
}
check 'unsupported profile capability providers are absent' python3 - "$capability_manifest" <<'PYABSENT'
import json, subprocess, sys
value = json.load(open(sys.argv[1]))
installed = subprocess.check_output(['rpm', '-qa', '--qf', '%{NAME}\n'], text=True).splitlines()
assert not [name for name in installed if name in value['excluded_packages'] or name.startswith(tuple(value['excluded_package_prefixes']))]
PYABSENT

check 'Suno GNOME Control Center package' \
  rpm -q "gnome-control-center-50.4-${GNOME_CONTROL_CENTER_SUNO_RELEASE}.fc44.${architecture}"
check 'Suno GNOME Control Center filesystem package' \
  rpm -q "gnome-control-center-filesystem-50.4-${GNOME_CONTROL_CENTER_SUNO_RELEASE}.fc44.noarch"
check 'Suno GNOME Shell package' \
  rpm -q "$GNOME_SHELL_NEVRA"
# Location remains owned by the standard permission frontend/Access backend.
# These are installation/API gates, not permission or hardware acceptance.
check 'Maps has its native location permission and provider dependencies' \
  rpm -q libportal libportal-gtk4 xdg-desktop-portal xdg-desktop-portal-gnome geoclue2
check 'Maps location portal namespaces are introspectable' python3 -c '
import gi
gi.require_version("Xdp", "1.0")
gi.require_version("XdpGtk4", "1.0")
from gi.repository import Xdp, XdpGtk4
assert hasattr(Xdp.Portal, "location_monitor_start")
assert hasattr(XdpGtk4, "parent_new_gtk")
'
check 'Suno GNOME Shell common package' \
  rpm -q "$GNOME_SHELL_COMMON_NEVRA"
check 'shared Suno shell-state package' \
  rpm -q "$SUNO_SHELL_STATE_NEVRA"
check 'shared Suno libhandy package' \
  rpm -q "$LIBHANDY_NEVRA"
check 'Suno update agent package' \
  rpm -q "$SUNO_UPDATE_NEVRA"
check 'update checks are scheduled' \
  systemctl is-enabled Suno-updated.timer
check 'update agent answers on the system bus' \
  busctl --system get-property org.projectSuno.Update1 /org/projectSuno/Update1 org.projectSuno.Update1 State
check 'update agent never asks rpm-ostree to reboot or apply live' \
  bash -c "! grep -REq '\"(reboot|apply-live)\", GLib.Variant\\(\"b\", True' /usr/lib/python3*/site-packages/Suno_update"
# Phones label the journal socket syslogd_t (no systemd initramfs): every
# service may still log, hostnamed may replace default-hostname, and homed
# never sees /var/home as var_t (config/desktop/selinux/Suno_journal.cil,
# Suno-selinux-run.conf, Suno-selinux-homedirs.service).
check 'SELinux refused no service the journal, default-hostname or /var/home this boot' bash -c \
  "! journalctl -b -q --no-pager _TRANSPORT=audit | grep -F 'avc:  denied' | grep -Eq 'path=\"/run/systemd/journal/socket\"|:systemd_hostnamed_t:.* tcontext=[^ ]*:init_var_run_t:|:systemd_homed_t:.* tcontext=[^ ]*:var_t:'"
# Suno Cast (ADR-034): one session service and its backends, started only by
# D-Bus activation when something asks for them, never at login.
if capability_enabled casting && [ -n "${SUNO_CAST_NEVRA:-}" ]; then
  check 'Suno Cast service package' rpm -q "$SUNO_CAST_NEVRA"
  check 'Suno Cast shared backend helper package' rpm -q "$SUNO_CAST_BACKEND_COMMON_NEVRA"
  check 'Suno Cast Google Cast backend package' rpm -q "$SUNO_CAST_GOOGLECAST_NEVRA"
  check 'Suno Cast Miracast backend package' rpm -q "$SUNO_CAST_MIRACAST_NEVRA"
  check 'Suno Cast DLNA backend package' rpm -q "$SUNO_CAST_DLNA_NEVRA"
  check 'Suno Cast test backend is not shipped' bash -c '! rpm -q Suno-cast-loopback >/dev/null 2>&1'
  check 'AirPlay casting is not shipped' bash -c '! rpm -q Suno-cast-airplay >/dev/null 2>&1'
  check 'Suno Cast and its backends start only by D-Bus activation' bash -c '
    for name in org.projectSuno.Cast1 org.projectSuno.Cast1.Backend.GoogleCast \
                org.projectSuno.Cast1.Backend.Miracast org.projectSuno.Cast1.Backend.DLNA; do
      grep -Eq "^SystemdService=Suno-cast[a-z-]*\.service$" "/usr/share/dbus-1/services/$name.service" || exit 1
    done
    ! grep -q "^\[Install\]" /usr/lib/systemd/user/Suno-cast*.service &&
    ! compgen -G "/usr/lib/systemd/user/*.wants/Suno-cast*" >/dev/null &&
    ! compgen -G "/etc/systemd/user/*.wants/Suno-cast*" >/dev/null &&
    ! grep -rlsq Suno-cast /etc/xdg/autostart /usr/share/gnome/autostart'
  check 'Suno Cast is not running in any session just because someone logged in' bash -c '
    for user in $(loginctl list-users --no-legend | awk "{ print \$2 }"); do
      [ "$(systemctl --user -M "$user@" is-active Suno-cast.service 2>/dev/null)" != active ] || exit 1
    done'
  check 'SELinux denied nothing to Suno Cast this boot' bash -c \
    "! journalctl -b -q --no-pager _TRANSPORT=audit | grep -F 'avc:  denied' | grep -Eq 'comm=\"Suno-cast|exe=\"/usr/libexec/Suno-cast'"
  check 'GNOME Shell logged no JavaScript errors from Cast' bash -c \
    "! journalctl -b -q --no-pager -o cat _COMM=gnome-shell | grep -E 'JS ERROR|TypeError|ReferenceError|SyntaxError|Gjs-CRITICAL' -A6 | grep -Eq 'SunoCast(Dialogs|Sheet)?\\.js|status/cast\\.js'"
fi
check 'shared shell-state schema' test -f \
  /usr/share/glib-2.0/schemas/org.projectSuno.shell-state.gschema.xml
check 'shared Suno GTK/Phosh presentation' test -f \
  /usr/share/themes/Suno/gtk-3.0/gtk.css
check 'shared Suno dark GTK/Phosh presentation' test -f \
  /usr/share/themes/Suno-dark/gtk-3.0/gtk.css
check 'shared shell-state broker is session-bound' test -L \
  /usr/lib/systemd/user/graphical-session.target.wants/Suno-shell-state.service
check 'Fedora first-login Tour is absent' \
  bash -c '! rpm -q gnome-tour >/dev/null 2>&1 && [ ! -e /usr/share/applications/org.gnome.Tour.desktop ]'
check 'Suno Files package' \
  rpm -q "$NAUTILUS_NEVRA"
check 'Suno Files extensions package' \
  rpm -q "$NAUTILUS_EXTENSIONS_NEVRA"
check 'native Suno Calculator package' rpm -q "$SUNO_CALCULATOR_NEVRA"
check 'native Suno Terminal package' rpm -q "$SUNO_TERMINAL_NEVRA"
check 'default Tide package' rpm -q "$SUNO_TIDE_NEVRA"
check 'default Tide owns a valid installed launcher' bash -c '
  test -s /usr/share/applications/org.projectSuno.Tide.desktop &&
  desktop-file-validate /usr/share/applications/org.projectSuno.Tide.desktop &&
  test "$(rpm -qf --qf "%{NAME}" /usr/share/applications/org.projectSuno.Tide.desktop)" = Suno-tide
'
check 'native Suno Disks package' rpm -q "$SUNO_DISKS_NEVRA"
# Prairie core apps own Calendar and Text Editor (config/desktop/
# system-flatpak-replacements.txt); the GNOME packages are not composed.
check 'Prairie core apps replace GNOME Calendar' \
  bash -c '! rpm -q gnome-calendar >/dev/null 2>&1'
check 'Suno Relay package' \
  rpm -q "$SUNO_RELAY_NEVRA"
if capability_enabled windows_apps; then
check 'Relay Wine Explorer integration' \
  rpm -q "$WINE_RELAY_EXPLORER_NEVRA"
check 'Relay Windows engine' rpm -q wine
check 'Relay NTSYNC loader' rpm -q ntsync-autoload
check 'Relay Direct3D translation' rpm -q wine-dxvk
check 'Relay reviewed component helper' rpm -q winetricks
fi
# The unified Suno application installer receives Windows, Android and Linux
# packages and hands Windows programs to Relay.
check 'the Suno application installer owns Windows executable files' \
  grep -Fq 'application/x-ms-dos-executable=io.Suno.Valet.desktop;' \
    /etc/xdg/gnome-mimeapps.list
check 'Relay has no always-on service' \
  bash -c '! systemctl list-unit-files --no-legend | grep -q Suno-relay'
check 'legacy Dash to Dock is absent from desktop composition' \
  bash -c '! rpm -q gnome-shell-extension-dash-to-dock'
check 'Suno-patched Tiling Shell package' \
  rpm -q "$TILING_SHELL_NEVRA"
check 'Suno Tiling Quick Toggle package' \
  rpm -q "$SUNO_TILING_TOGGLE_NEVRA"
check 'Suno backgrounds package' \
  rpm -q "$SUNO_BACKGROUNDS_NEVRA"
check 'Suno graphical boot package' \
  rpm -q "$SUNO_BOOT_THEME_NEVRA"
check 'Plymouth script plugin' \
  rpm -q "$PLYMOUTH_PLUGIN_SCRIPT_NEVRA"
check 'Prairie light Plymouth details renderer' \
  rpm -q "$PLYMOUTH_NEVRA"
check 'Prairie Plymouth dependency family is release-aligned' \
  rpm -q "$PLYMOUTH_CORE_LIBS_NEVRA" "$PLYMOUTH_GRAPHICS_LIBS_NEVRA" "$PLYMOUTH_SCRIPTS_NEVRA" \
    "$PLYMOUTH_PLUGIN_LABEL_NEVRA" "$PLYMOUTH_PLUGIN_TWO_STEP_NEVRA" \
    "$PLYMOUTH_SYSTEM_THEME_NEVRA" "$PLYMOUTH_THEME_SPINNER_NEVRA"
check 'Plymouth script plugin can take over from the firmware logo' \
  grep -aqF SetFirmwareBackgroundOpacity /usr/lib64/plymouth/script.so
check 'Suno boot splash is installed with its prompt artwork' \
  bash -c 'cd /usr/share/plymouth/themes/Suno-loading && test -s Suno-loading.script && test -s Suno-wordmark.png && test -s Suno-loading-dot.png && test -s prompt-lock.png && test -s prompt-field.png && test -s prompt-bullet.png && test -s prompt-capslock.png'
check 'Suno boot splash hands off from the firmware logo' \
  grep -Fq 'Window.SetFirmwareBackgroundOpacity' /usr/share/plymouth/themes/Suno-loading/Suno-loading.script
check 'Suno firmware-logo presentation stays available to administrators' \
  bash -c 'cd /usr/share/plymouth/themes/Suno-firmware && test -s Suno-firmware.plymouth && test -s lock.png && test -s entry.png && test -s bullet.png && test -s watermark.png && test -s throbber-0001.png && test -s keymap-render.png'
check 'shared package carries the handheld presentation without selecting it' test -f \
  /usr/share/plymouth/themes/Suno-loading-handheld/Suno-loading-handheld.script
check 'Suno Plymouth theme owns the canonical default selector' \
  test "$(readlink /usr/share/plymouth/themes/default.plymouth)" = \
    Suno-loading/Suno-loading.plymouth
# ADR-045: Suno selects its splash in /usr/share/plymouth/plymouthd.defaults,
# and /etc/plymouth/plymouthd.conf is an administrator template with no
# settings. The theme that counts is the one Plymouth resolves.
check 'Suno Plymouth theme is selected' \
  test "$(plymouth-set-default-theme)" = Suno-loading
check 'Suno selects its splash in the Plymouth defaults' \
  grep -Fxq 'Theme=Suno-loading' /usr/share/plymouth/plymouthd.defaults
check 'Suno boot splash setting is the packaged desktop default' \
  cmp -s /etc/plymouth/plymouthd.conf /usr/share/Suno/boot/plymouthd.conf
check 'Suno boot splash migration is wanted at boot' \
  test -L /usr/lib/systemd/system/sysinit.target.wants/Suno-boot-splash-migrate.service
check 'locally built initramfs images follow the boot splash migration' \
  test -x /usr/lib/dracut/modules.d/46Suno-boot-splash/module-setup.sh
check 'initramfs carries the selected Suno boot splash' \
  bash -c 'lsinitrd "/usr/lib/modules/$(uname -r)/initramfs.img" 2>/dev/null | grep -Fq usr/share/plymouth/themes/Suno-loading/prompt-field.png || lsinitrd 2>/dev/null | grep -Fq usr/share/plymouth/themes/Suno-loading/prompt-field.png'
check 'GRUB shows a five-second graphical startup surface' \
  bash -c "grub2-editenv list | grep -Fxq 'timeout_style=menu' && grub2-editenv list | grep -Fxq 'timeout=5'"
check 'Atomic GRUB configuration consumes its persistent policy' \
  grep -Fq 'load_env' /boot/grub2/grub.cfg
check 'Atomic GRUB configuration sources the Suno advanced surface' \
  grep -Fq 'source $prefix/Suno.cfg' /boot/grub2/grub.cfg
check 'Suno GRUB theme is installed on the boot filesystem' \
  test -s /boot/grub2/themes/Suno/theme.txt
check 'Suno GRUB font is installed on the boot filesystem' \
  test -s /boot/grub2/themes/Suno/prairie.pf2
check 'graphical quiet kernel arguments are active' \
  bash -c "grep -qw rhgb /proc/cmdline && grep -qw quiet /proc/cmdline"
check 'Prairie icon-theme package' \
  rpm -q "$PRAIRIE_ICON_THEME_NEVRA"

prairie_status_symbols_are_installed() {
  local icon
  for icon in \
    network-wireless-signal-excellent-symbolic.svg \
    network-wireless-signal-good-symbolic.svg \
    network-wireless-signal-ok-symbolic.svg \
    network-wireless-signal-weak-symbolic.svg \
    network-wireless-signal-none-symbolic.svg \
    network-wired-symbolic.svg \
    audio-volume-muted-symbolic.svg \
    audio-volume-low-symbolic.svg \
    audio-volume-medium-symbolic.svg \
    audio-volume-high-symbolic.svg \
    system-shutdown-symbolic.svg; do
    test -f "/usr/share/icons/Prairie/symbolic/status/$icon" || return 1
  done
}

check 'Prairie status symbol family' prairie_status_symbols_are_installed

prairie_window_control_symbols_are_installed() {
  local icon
  for icon in \
    window-minimize-symbolic.svg \
    window-maximize-symbolic.svg \
    window-restore-symbolic.svg \
    window-close-symbolic.svg; do
    test -f "/usr/share/icons/Prairie/symbolic/actions/$icon" || return 1
  done
}

check 'Prairie window-control symbol family' \
  prairie_window_control_symbols_are_installed
check 'Figtree system font package' \
  rpm -q "$FIGTREE_NEVRA"
check 'Caveat handwriting font package' \
  rpm -q "$CAVEAT_NEVRA"
check 'Caveat does not take over the generic sans family' \
  bash -c 'test "$(fc-match --format="%{family[0]}" sans-serif)" != Caveat'
check 'Suno GTK window-material package' \
  rpm -q "$GTK4_NEVRA"
check 'Suno GTK 3 compatibility design-system package' \
  rpm -q "$GTK3_NEVRA"
check 'Suno libadwaita design-system package' \
  rpm -q "$LIBADWAITA_NEVRA"
check 'Prairie core apps replace GNOME Text Editor' \
  bash -c '! rpm -q gnome-text-editor >/dev/null 2>&1'
check 'bundled Text Editor does not retain the Fedora system Flatpak runtime' \
  bash -c '! flatpak info --system org.gnome.TextEditor >/dev/null 2>&1'
check 'Characters is not installed (Super+. picker replaces it)' \
  bash -c '! rpm -q gnome-characters >/dev/null 2>&1'
check 'Characters is not installed as a system Flatpak' \
  bash -c '! flatpak info --system org.gnome.Characters >/dev/null 2>&1'
check 'unsupported GNOME Extensions frontend is absent' bash -c '! rpm -q gnome-extensions-app >/dev/null 2>&1'
check 'Extensions does not retain the Fedora system Flatpak runtime' \
  bash -c '! flatpak info --system org.gnome.Extensions >/dev/null 2>&1'
check 'compiled Suno dconf database' test -f /etc/dconf/db/Suno
check 'compiled Prairie GDM dconf database' test -f /etc/dconf/db/gdm

libadwaita_selected_sidebar_hover_is_invariant() {
  LC_ALL=C grep -aFq \
    '.navigation-sidebar > row:selected:hover, .navigation-sidebar > row:selected.has-open-popup { background-color: color-mix(in srgb, currentColor 13%, transparent); }' \
    /usr/lib64/libadwaita-1.so.0
}

check 'selected sidebar rows keep the Prairie selection tint on hover' \
  libadwaita_selected_sidebar_hover_is_invariant

libadwaita_generic_headerbar_contract_is_installed() {
  LC_ALL=C grep -aFq \
    'headerbar { min-height: 42px' \
    /usr/lib64/libadwaita-1.so.0 &&
  ! LC_ALL=C grep -aFq \
    'windowtitle .title, .Suno-title-label' \
    /usr/lib64/libadwaita-1.so.0 &&
  LC_ALL=C grep -aFq \
    'windowtitle .title { min-height: 16px; }' \
    /usr/lib64/libadwaita-1.so.0 &&
  LC_ALL=C grep -aFq \
    'headerbar button.image-button > image, headerbar menubutton > button > image { -gtk-icon-size: 14px; color: var(--headerbar-fg-color); }' \
    /usr/lib64/libadwaita-1.so.0
}

check 'generic libadwaita title bars use intrinsic text and Prairie bar metrics' \
  libadwaita_generic_headerbar_contract_is_installed

check 'retired Layouts app is not installed' bash -c '! rpm -q Suno-layouts >/dev/null 2>&1'
# Office, Creative and Studio are optional Depot collections. Query package
# names so any accidentally included release fails, including instrument data.
collection_package_absent() {
  ! rpm -q "$1" >/dev/null 2>&1
}
for package in Suno-write Suno-grid-preview Suno-stage-preview \
               Suno-canvas-preview Suno-reel Suno-darkroom Suno-session \
               Suno-session-instruments sfizz; do
  check "optional Depot collection package $package is absent" \
    collection_package_absent "$package"
done

collection_launcher_absent() {
  [ ! -e "$1" ] && [ ! -L "$1" ]
}
for launcher in org.projectSuno.Write io.Suno.Grid io.Suno.Stage \
                org.projectSuno.Canvas org.projectSuno.Reel \
                org.projectSuno.Darkroom org.projectSuno.Session; do
  check "optional Depot collection launcher $launcher is absent" \
    collection_launcher_absent "/usr/share/applications/$launcher.desktop"
done
# Owner-requested baseline exclusions are checked by package name and exact
# launchers. GIO verifies hidden provider metadata without concealing duplicates.
for package in gnome-disk-utility gnome-calculator ptyxis gnome-terminal \
               gnome-console yelp firefox gnome-extensions-app openemu-linux Suno-imager Suno-displays; do
  check "excluded baseline application $package is absent" collection_package_absent "$package"
done
for launcher in org.gnome.DiskUtility org.gnome.Calculator org.gnome.Ptyxis \
                org.gnome.Terminal org.gnome.Console org.gnome.Extensions \
                firefox yelp org.projectSuno.Imager org.projectSuno.Displays org.openemu.OpenEmuLinux.Development; do
  check "excluded baseline launcher $launcher is absent" \
    collection_launcher_absent "/usr/share/applications/$launcher.desktop"
done
check 'GIO hides Mods, retaining Suno native roles' \
  env XDG_DATA_DIRS=/usr/share/Suno/desktop-overrides:/usr/local/share:/usr/share python3 - <<'PYGIO'
import ctypes
import ctypes.util
from pathlib import Path
lib = ctypes.CDLL(ctypes.util.find_library('gio-2.0'))
lib.g_desktop_app_info_new.argtypes = [ctypes.c_char_p]
lib.g_desktop_app_info_new.restype = ctypes.c_void_p
lib.g_app_info_should_show.argtypes = [ctypes.c_void_p]
lib.g_app_info_should_show.restype = ctypes.c_int
lib.g_desktop_app_info_get_filename.argtypes = [ctypes.c_void_p]
lib.g_desktop_app_info_get_filename.restype = ctypes.c_char_p
for desktop in ('org.projectSuno.Mods',):
    app = lib.g_desktop_app_info_new((desktop + '.desktop').encode())
    assert app and not lib.g_app_info_should_show(app), desktop
    expected = '/usr/share/Suno/desktop-overrides/applications/' + desktop + '.desktop'
    assert lib.g_desktop_app_info_get_filename(app).decode() == expected, desktop
for desktop in ('org.projectSuno.Calculator', 'org.projectSuno.Terminal', 'org.projectSuno.Disks.Preview', 'org.projectSuno.Tide'):
    app = lib.g_desktop_app_info_new((desktop + '.desktop').encode())
    assert app and lib.g_app_info_should_show(app), desktop
print('PASS: 1 hidden provider, 4 visible native applications')
PYGIO
check 'exact shared Search package installed' rpm -q "$SUNO_SEARCH_NEVRA"

check 'Prism desktop payload hash' \
  bash -c "printf '%s  %s\n' \
    $SUNO_PRISM_SHA256 \
    /usr/share/backgrounds/Suno/prism.png | sha256sum --check --status"
check 'Prism handheld payload hash' \
  bash -c "printf '%s  %s\n' \
    $SUNO_PRISM_HANDHELD_SHA256 \
    /usr/share/backgrounds/Suno/Suno-prism.png | sha256sum --check --status"
check 'Prism appears in GNOME background metadata' \
  grep -Fq '<name>Prism</name>' \
    /usr/share/gnome-background-properties/Suno-backgrounds.xml

gtk_compatibility_identity_contract_is_installed() {
  LC_ALL=C grep -aFq 'gtk-header-bar-Suno-identity-owner' \
    /usr/lib64/libgtk-4.so.1 &&
  LC_ALL=C grep -aFq 'Suno-no-automatic-identity' \
    /usr/lib64/libgtk-4.so.1 &&
  LC_ALL=C grep -aFq 'Suno-identity-display' \
    /usr/lib64/libgtk-4.so.1 &&
  LC_ALL=C grep -aFq 'notify::application' \
    /usr/lib64/libgtk-4.so.1 &&
  LC_ALL=C grep -aFq 'gtk3-header-bar-Suno-identity-owner' \
    /usr/lib64/libgtk-3.so.0 &&
  LC_ALL=C grep -aFq 'Suno-identity-display' \
    /usr/lib64/libgtk-3.so.0 &&
  LC_ALL=C grep -aFq 'Suno-automatic-identity' \
    /usr/lib64/libgtk-3.so.0 &&
  LC_ALL=C grep -aFq 'notify::application' \
    /usr/lib64/libgtk-3.so.0 &&
  LC_ALL=C grep -aFq 'hdy-header-bar-Suno-identity-owner' \
    /usr/lib64/libhandy-1.so.0 &&
  LC_ALL=C grep -aFq 'Suno-automatic-identity' \
    /usr/lib64/libhandy-1.so.0 &&
  LC_ALL=C grep -aFq 'notify::application' \
    /usr/lib64/libhandy-1.so.0 &&
  LC_ALL=C grep -aFq 'notify::application' \
    /usr/lib64/libadwaita-1.so.0
}

check 'GTK 3 and GTK 4 own the shared compatibility identity contract' \
  gtk_compatibility_identity_contract_is_installed

native_application_surface_contract_is_installed() {
  LC_ALL=C grep -aFq 'Suno-native-window' \
    /usr/lib64/libgtk-4.so.1 &&
  LC_ALL=C grep -aFq 'Suno-native-work-surface' \
    /usr/lib64/libgtk-4.so.1 &&
  LC_ALL=C grep -aFq 'Suno-native-window' \
    /usr/lib64/libgtk-3.so.0 &&
  LC_ALL=C grep -aFq 'Suno-native-work-surface' \
    /usr/lib64/libgtk-3.so.0 &&
  LC_ALL=C grep -aFq 'Suno-hdy-native-window' \
    /usr/lib64/libhandy-1.so.0 &&
  LC_ALL=C grep -aFq 'Suno-native-work-surface' \
    /usr/lib64/libhandy-1.so.0 &&
  LC_ALL=C grep -aFq 'Suno-adw-native-window' \
    /usr/lib64/libadwaita-1.so.0 &&
  LC_ALL=C grep -aFq 'Suno-window-toolbar-view' \
    /usr/lib64/libadwaita-1.so.0 &&
  LC_ALL=C grep -aFq 'Suno-native-work-surface' \
    /usr/lib64/libadwaita-1.so.0 &&
  grep -Fq 'window.Suno-native-window:not(.Suno-no-native-surfaces)' \
    /usr/share/themes/Suno/gtk-3.0/Suno-common.css &&
  grep -Fq 'window.Suno-hdy-native-window:not(.Suno-no-native-surfaces) .Suno-native-work-surface' \
    /usr/share/themes/Suno/gtk-3.0/Suno-common.css
}

check 'native GTK application windows own the shared Suno surface contract' \
  native_application_surface_contract_is_installed

check 'Prairie inherits complete upstream icon themes' \
  grep -Fxq 'Inherits=Adwaita,hicolor' \
    /usr/share/icons/Prairie/index.theme
check 'Prairie ships the Filer full-color icon' \
  test -f /usr/share/icons/Prairie/scalable/apps/org.gnome.Nautilus.svg
check 'Prairie ships the Filer symbolic icon' \
  test -f /usr/share/icons/Prairie/symbolic/apps/org.gnome.Nautilus-symbolic.svg
check 'Prairie ships the Calculator full-color icon' \
  test -f /usr/share/icons/Prairie/scalable/apps/org.gnome.Calculator.svg
check 'Prairie ships the Calculator symbolic icon' \
  test -f /usr/share/icons/Prairie/symbolic/apps/org.gnome.Calculator-symbolic.svg
check 'native Suno Calculator owns its current icon lookup identity' \
  grep -Fxq 'Icon=Suno-v3-calculator' \
    /usr/share/applications/org.projectSuno.Calculator.desktop
check 'Prairie preserves the upstream RPM Firefox artwork' \
  test ! -e /usr/share/icons/Prairie/scalable/apps/firefox.svg
check 'Prairie preserves the upstream Flatpak Firefox artwork' \
  test ! -e /usr/share/icons/Prairie/scalable/apps/org.mozilla.firefox.svg
check 'Prairie ships both canonical Trash states' \
  test -f /usr/share/icons/Prairie/scalable/places/user-trash.svg
check 'Prairie ships the full Trash state' \
  test -f /usr/share/icons/Prairie/scalable/places/user-trash-full.svg
check 'Prairie ships byte-identical Trash aliases for the dock context' \
  cmp /usr/share/icons/Prairie/scalable/places/user-trash-full.svg \
    /usr/share/icons/Prairie/scalable/apps/user-trash-full.svg
check 'Filer keeps the upstream icon lookup identity' \
  grep -Fxq 'Icon=org.gnome.Nautilus' \
    /usr/share/applications/org.gnome.Nautilus.desktop
check 'Figtree is the preferred generic sans family' \
  bash -c 'test "$(fc-match --format="%{family[0]}" sans-serif)" = Figtree'
check 'GTK embeds the Suno native light-mode window elevation' \
  grep -aFq '0 54px 110px -28px rgba(25, 27, 31, 0.56)' /usr/lib64/libgtk-4.so.1
check 'GTK embeds the Suno native dark-mode window elevation' \
  grep -aFq '0 64px 120px -30px rgba(9, 11, 14, 0.82)' /usr/lib64/libgtk-4.so.1

check 'shared Suno core applications package is installed' \
  rpm -q "$PRAIRIE_CORE_APPS_NEVRA"
check 'shared Suno Developer Platform package is installed' \
  rpm -q "$SUNO_DEVELOPER_PLATFORM_NEVRA"
check 'Suno Semantics introspection is installed' test -f \
  /usr/lib64/girepository-1.0/SunoSemantics-1.typelib
check 'Suno UI introspection is installed' test -f \
  /usr/lib64/girepository-1.0/SunoUI-1.typelib

for app_id in Messages Phone Contacts Calendar Weather Tasks VoiceMemos Notes Photos Clock Camera; do
  check "Suno ${app_id} launcher is visible on desktop" \
    test -f "/usr/share/applications/org.projectSuno.${app_id}.desktop"
  check "Suno ${app_id} launcher is not hidden on desktop" \
    bash -c "! grep -Eq '^(NoDisplay=true|OnlyShowIn=.*Mobile)' '/usr/share/applications/org.projectSuno.${app_id}.desktop'"
done

check 'Prairie Messages owns SMS links on desktop' \
  bash -c "test \"$(xdg-mime query default x-scheme-handler/sms)\" = org.projectSuno.Messages.desktop"
check 'the Suno application installer owns Windows application packages on desktop' \
  bash -c "test \"$(XDG_CURRENT_DESKTOP=GNOME xdg-mime query default application/vnd.microsoft.portable-executable)\" = io.Suno.Valet.desktop"
check 'Prairie Phone owns telephone links on desktop' \
  bash -c "test \"$(xdg-mime query default x-scheme-handler/tel)\" = org.projectSuno.Phone.desktop"

control_center_contains() {
  LC_ALL=C grep -aFq "$1" /usr/bin/gnome-control-center
}

tiling_shell_modes_are_safe() {
  extension_dir=/usr/share/gnome-shell/extensions/tilingshell@ferrarodomenico.com
  bad_path=$(find "$extension_dir" \
    \( -type d ! -perm 0755 -o -type f ! -perm 0644 \) \
    -print -quit)
  test -z "$bad_path"
}

tiling_shell_drag_layout_is_default() {
  extension_dir=/usr/share/gnome-shell/extensions/tilingshell@ferrarodomenico.com
  actual=$(GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" \
    gsettings get org.gnome.shell.extensions.tilingshell \
    show-layout-while-dragging)
  test "$actual" = true
}

tiling_shell_control_escapes_drag() {
  extension_dir=/usr/share/gnome-shell/extensions/tilingshell@ferrarodomenico.com
  actual=$(GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" \
    gsettings get org.gnome.shell.extensions.tilingshell \
    tiling-system-deactivation-key)
  test "$actual" = "['0']" &&
    grep -Fq ')) && !isTilingSystemDeactivated' \
      "$extension_dir/components/tilingsystem/tilingManager.js"
}

tiling_shell_uses_quick_settings_only() {
  extension_dir=/usr/share/gnome-shell/extensions/tilingshell@ferrarodomenico.com
  test "$(GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" \
    gsettings get org.gnome.shell.extensions.tilingshell show-indicator)" = false &&
    grep -Fq '<method name="newLayout"' "$extension_dir/dbus.js" &&
    grep -Fq '<method name="selectLayout">' "$extension_dir/dbus.js" &&
    grep -Fq 'function createLayoutPreview' \
      /usr/share/gnome-shell/extensions/tiling-toggle@project-suno.local/extension.js &&
    grep -Fq 'SettingsSchemaSource.new_from_directory' \
      /usr/share/gnome-shell/extensions/tiling-toggle@project-suno.local/extension.js
}

nautilus_has_Suno_ui_markers() {
  grep -aFq 'slot.search-global' /usr/bin/nautilus &&
    grep -aFq 'sidebar_resize_handle' /usr/bin/nautilus &&
    grep -aFq 'Suno-titlebar' /usr/bin/nautilus &&
    grep -aFq 'Suno-secondary-toolbar' /usr/bin/nautilus &&
    grep -aFq 'transform: translate(0, 1px)' /usr/bin/nautilus &&
    grep -aFq 'Suno-path-menu' /usr/bin/nautilus &&
    grep -aFq 'gtk_scrolled_window_set_propagate_natural_width' /usr/bin/nautilus &&
    grep -aFq '%s is empty' /usr/bin/nautilus &&
    grep -aFq 'prairie-folder-empty' /usr/bin/nautilus &&
    ! grep -aFq 'Suno_files_window_bg' /usr/bin/nautilus
}

nautilus_sidebar_default_is_178() {
  test "$(gsettings get org.gnome.nautilus.window-state sidebar-width)" = 178
}

# SunoUI Filer (patch 0080): the grid opens at upstream's medium 96px step,
# which with two 14px margins is v70's 124px tile.
nautilus_grid_default_is_v70_medium() {
  test "$(gsettings get org.gnome.nautilus.icon-view default-zoom-level)" = "'medium'"
}

gnome_shell_has_Suno_shelf() {
  shell_library=/usr/lib64/gnome-shell/libshell-18.so
  grep -aFq "left: ['dateMenu']" "$shell_library" &&
    grep -aFq "center: ['liveExtensions']" "$shell_library" &&
    ! grep -aFq 'Suno-panel-background-blur' "$shell_library" &&
    grep -aFq 'Suno-clock-time' "$shell_library" &&
    grep -aFq 'Suno-secondary-status-text' "$shell_library" &&
    grep -aFq "dateFormat = N_('%a, %b %-d')" "$shell_library" &&
    grep -aFq 'new St.Widget({width: 9})' "$shell_library" &&
    grep -aFq 'const edgeInset = 14 * scaleFactor' "$shell_library" &&
    grep -aFq 'this._timeDisplay.translation_y' "$shell_library" &&
    grep -aFq 'class PrairieLoginClock' "$shell_library" &&
    grep -aFq 'class PrairieLoginPowerButton' "$shell_library" &&
    grep -aFq 'login-dialog-prompt-entry prairie-login-entry' "$shell_library" &&
    grep -aFq 'else if (!Main.sessionMode.hasOverview)' "$shell_library" &&
    grep -aFq 'Keep the completed Prairie authentication surface stable' "$shell_library" &&
    grep -aFq 'call_start_session_when_ready_sync(serviceName, true, null)' "$shell_library" &&
    grep -aFq 'class LiveExtensionsIndicator' "$shell_library" &&
    grep -aFq 'class Shelf extends St.Widget' "$shell_library" &&
    grep -aFq 'org.projectSuno.shell-state' "$shell_library" &&
    grep -aFq 'vfunc_get_preferred_width(forHeight)' "$shell_library" &&
    grep -aFq 'LEGACY_DESKTOP_DOCK_UUID' "$shell_library" &&
    grep -aFq 'SHELF_STYLESHEET_URI' "$shell_library" &&
    grep -aFq 'load_stylesheet(this._stylesheet)' "$shell_library" &&
    grep -aFq "_settings.get_string('shelf-surface-mode')" "$shell_library" &&
    grep -aFq 'recursiveUnpack' "$shell_library" &&
    grep -aFq '_isValidExtension' "$shell_library"
}

check 'Touchpad Settings describes three-finger Activities gesture' \
  control_center_contains 'Swipe Up with Three Fingers'
check 'GNOME Shell owns the Suno Shelf, clock, and native dock lifecycle' \
  gnome_shell_has_Suno_shelf
check 'Touchpad Settings describes three-finger workspace gesture' \
  control_center_contains 'Swipe Left or Right with Three Fingers'
check 'Tiling Shell payload uses safe normalized modes' \
  tiling_shell_modes_are_safe
check 'Tiling Shell reveals layout while dragging by default' \
  tiling_shell_drag_layout_is_default
check 'Control suppresses both drag zones and the final tile assignment' \
  tiling_shell_control_escapes_drag
check 'Tiling layouts live in Quick Settings without a default panel indicator' \
  tiling_shell_uses_quick_settings_only
check 'Tiling Shell ships Suno Split as a fresh-profile layout' \
  grep -Fq 'Suno Split' \
    /usr/share/gnome-shell/extensions/tilingshell@ferrarodomenico.com/settings/settings.js
check 'Files ships the global Search and resize-handle UI' \
  nautilus_has_Suno_ui_markers
check 'Files sidebar is narrow and resizable by default' \
  nautilus_sidebar_default_is_178
check 'Filer grid starts at the v70 tile size (upstream medium)' \
  nautilus_grid_default_is_v70_medium

empty_config=$(mktemp -d)
trap 'rm -rf "$empty_config"' EXIT
read_default() {
  XDG_CONFIG_HOME="$empty_config" dconf read "$1"
}

check_value() {
  description=$1
  key=$2
  expected=$3
  actual=$(read_default "$key")
  if [ "$actual" = "$expected" ]; then
    printf 'PASS  %s\n' "$description"
  else
    printf 'FAIL  %s (expected %s, got %s)\n' \
      "$description" "$expected" "${actual:-<empty>}"
    failures=$((failures + 1))
  fi
}

check_schema_default() {
  description=$1
  schema=$2
  key=$3
  expected=$4
  actual=$(XDG_CONFIG_HOME="$empty_config" gsettings get "$schema" "$key")
  if [ "$actual" = "$expected" ]; then
    printf 'PASS  %s\n' "$description"
  else
    printf 'FAIL  %s (expected %s, got %s)\n' \
      "$description" "$expected" "${actual:-<empty>}"
    failures=$((failures + 1))
  fi
}

check_schema_default 'desktop Filer retains the full storage view by default' \
  org.gnome.nautilus.preferences personal-storage-only false
check_value 'Prairie Calendar is the desktop calendar command' \
  /org/gnome/desktop/default-applications/office/calendar/exec "'prairie-calendar'"
if capability_enabled android_apps; then
check 'Suno Android integration package' \
  rpm -q "$SUNO_ANDROID_RUNTIME_NEVRA"
check 'Fedora Waydroid engine' rpm --quiet --query waydroid
check 'APK MIME integration' grep -Fq application/vnd.android.package-archive \
  /usr/share/mime/packages/Suno-android.xml
check 'APK installer broker' test -f \
  /usr/share/dbus-1/services/org.projectSuno.ApplicationInstaller1.service
fi
check_value '12-hour clock default' \
  /org/gnome/desktop/interface/clock-format "'12h'"

gdm_clock_format=$(DCONF_PROFILE=gdm XDG_CONFIG_HOME="$empty_config" \
  dconf read /org/gnome/desktop/interface/clock-format)
if [ "$gdm_clock_format" = "'12h'" ]; then
  printf 'PASS  Prairie GDM 12-hour clock default\n'
else
  printf 'FAIL  Prairie GDM 12-hour clock default (expected %s, got %s)\n' \
    "'12h'" "${gdm_clock_format:-<empty>}"
  failures=$((failures + 1))
fi

gdm_audible_bell=$(DCONF_PROFILE=gdm XDG_CONFIG_HOME="$empty_config" \
  dconf read /org/gnome/desktop/wm/preferences/audible-bell)
if [ "$gdm_audible_bell" = "false" ]; then
  printf 'PASS  GDM window manager bell makes no sound by default\n'
else
  printf 'FAIL  GDM window manager bell makes no sound by default (expected %s, got %s)\n' \
    "false" "${gdm_audible_bell:-<empty>}"
  failures=$((failures + 1))
fi
gdm_frame_utilization=$(DCONF_PROFILE=gdm XDG_CONFIG_HOME="$empty_config" \
  dconf read /org/gnome/mutter/frame-utilization-min)
if [ "$gdm_frame_utilization" = "uint32 512" ]; then
  printf 'PASS  GDM compositor frame threads keep their utilization clamp\n'
else
  printf 'FAIL  GDM compositor frame threads keep their utilization clamp (expected %s, got %s)\n' \
    "uint32 512" "${gdm_frame_utilization:-<empty>}"
  failures=$((failures + 1))
fi
check_value 'compositor frame threads keep their utilization clamp' \
  /org/gnome/mutter/frame-utilization-min 'uint32 512'
check_value 'weekday is shown by default' \
  /org/gnome/desktop/interface/clock-show-weekday true
check_value 'date is shown by default' \
  /org/gnome/desktop/interface/clock-show-date true
check_value 'dark appearance is the default' \
  /org/gnome/desktop/interface/color-scheme "'prefer-dark'"
check_value 'Suno GTK/Phosh presentation is shared by default' \
  /org/gnome/desktop/interface/gtk-theme "'Suno'"
check_schema_default 'Prairie is the unlocked icon-theme default' \
  org.gnome.desktop.interface icon-theme "'Prairie'"
check_value 'Figtree is the interface font default' \
  /org/gnome/desktop/interface/font-name "'Figtree 11'"
check_value 'Figtree is the proportional document font default' \
  /org/gnome/desktop/interface/document-font-name "'Figtree 11'"
check_value 'Night Light Color Temperature starts at its coolest, far-left setting' \
  /org/gnome/settings-daemon/plugins/color/night-light-temperature 'uint32 4700'
check_value 'light appearance uses Prism' \
  /org/gnome/desktop/background/picture-uri \
  "'file:///usr/share/backgrounds/Suno/prism.png'"
check_value 'dark appearance uses Prism' \
  /org/gnome/desktop/background/picture-uri-dark \
  "'file:///usr/share/backgrounds/Suno/prism.png'"
check_value 'Prism uses native zoom placement' \
  /org/gnome/desktop/background/picture-options "'zoom'"
check_value 'window controls use the Suno right-side order' \
  /org/gnome/desktop/wm/preferences/button-layout \
  "':minimize,maximize,close'"
check_value 'window manager bell makes no sound by default' \
  /org/gnome/desktop/wm/preferences/audible-bell false
gtk_settings_say_no_error_bell() {
  for settings in /etc/gtk-3.0/settings.ini /etc/gtk-4.0/settings.ini; do
    [ -f "$settings" ] || return 1
    grep -Fxq 'gtk-error-bell=0' "$settings" || return 1
  done
}
check 'GTK 3 and GTK 4 error bell is off by default' \
  gtk_settings_say_no_error_bell
check_value 'mouse natural scrolling default' \
  /org/gnome/desktop/peripherals/mouse/natural-scroll true
check_value 'adaptive mouse acceleration default' \
  /org/gnome/desktop/peripherals/mouse/accel-profile "'adaptive'"
check_value 'touchpad natural scrolling default' \
  /org/gnome/desktop/peripherals/touchpad/natural-scroll true
check_value 'touchpad tapping default' \
  /org/gnome/desktop/peripherals/touchpad/tap-to-click true
check_value 'two-finger tap uses right click' \
  /org/gnome/desktop/peripherals/touchpad/tap-button-map "'lrm'"
check_value 'bottom-right physical corner click uses right click' \
  /org/gnome/desktop/peripherals/touchpad/click-method "'areas'"
check_value 'Shelf contract is versioned' \
  /org/project-suno/shell-state/shelf-layout-version 'uint32 1'
check_value 'Shelf defaults to the bottom edge' \
  /org/project-suno/shell-state/shelf-edge "'bottom'"
check_value 'Shelf uses the centered combined layout' \
  /org/project-suno/shell-state/shelf-group-layout "'Suno'"
check_value 'Shelf islands are separate by default' \
  /org/project-suno/shell-state/shelf-surface-mode "'separate'"
check_value 'Shelf defaults to the production dark material' \
  /org/project-suno/shell-state/shelf-material "'dark'"
check_value 'Shelf is primary-monitor scoped by default' \
  /org/project-suno/shell-state/shelf-monitor-mode "'primary'"
check_value 'Shelf overflow scrolls instead of shrinking icons' \
  /org/project-suno/shell-state/shelf-overflow-mode "'scroll'"
check_value 'Shelf reserves ordinary window work area' \
  /org/project-suno/shell-state/shelf-reserve-work-area true
check_value 'Shelf v1 never auto-hides' \
  /org/project-suno/shell-state/shelf-auto-hide false
check_value 'native edge tiling is disabled' \
  /org/gnome/mutter/edge-tiling false
check_value 'native left tiling shortcut is released' \
  /org/gnome/mutter/keybindings/toggle-tiled-left '@as []'
check_value 'native right tiling shortcut is released' \
  /org/gnome/mutter/keybindings/toggle-tiled-right '@as []'
# Expected defaults are config/desktop/dconf/db/Suno.d/00-Suno-desktop.
check_value 'normal desktop loads no dock extension (tiling toggle and tray host only)' \
  /org/gnome/shell/enabled-extensions \
  "['tiling-toggle@project-suno.local', 'appindicatorsupport@rgcjonas.gmail.com']"
# The immutable OS role selects the canonical signed launcher. Invalid role
# metadata must fail; the running dock never supplies its own expectation.
expected_viola_launcher=$(python3 -c '
from Suno_installer.native_app_roles import required
print("com.rhyme.viola.desktop" if required("com.rhyme.viola") else "viola-browser.desktop")
')
check_value 'default dock has Filer first, Viola second, Ari third and the complete shipping app order' \
  /org/gnome/shell/favorite-apps \
  "['org.gnome.Nautilus.desktop', '$expected_viola_launcher', 'org.projectSuno.Ari.desktop', 'org.projectSuno.Notes.desktop', 'org.projectSuno.Photos.desktop', 'org.projectSuno.Tide.desktop', 'org.projectSuno.Calendar.desktop', 'org.projectSuno.Tasks.desktop', 'org.projectSuno.Contacts.desktop', 'org.projectSuno.Messages.desktop', 'org.projectSuno.Phone.desktop', 'org.projectSuno.Charlie.desktop', 'org.projectSuno.Maps.desktop', 'org.projectSuno.Weather.desktop', 'org.projectSuno.Clock.desktop', 'org.projectSuno.VoiceMemos.desktop', 'org.projectSuno.Camera.desktop', 'io.Suno.Monitor.desktop', 'org.projectSuno.Leaf.desktop', 'org.projectSuno.Depot.desktop', 'org.projectSuno.Terminal.desktop', 'org.projectSuno.Viewer.desktop', 'org.gnome.Settings.desktop']"

if [ "$failures" -ne 0 ]; then
  printf '\nDesktop smoke test: FAIL (%s checks)\n' "$failures"
  exit 1
fi

printf '\nDesktop smoke test: PASS\n'
