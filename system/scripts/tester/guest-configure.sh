#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
[ "$#" = 2 ]
target=$1
build_id=$2
case "$target" in
  desktop) device_class=desktop ;;
  *) printf 'error: this producer is qualified for desktop only; Mobile requires the phone shell profile\n' >&2; exit 2 ;;
esac
root=/var/tmp/Suno-tester-build/source
# Give this virtual display an honest, local Suno identity and a roomy default.
# Kernel firmware override keeps the identity consistent in Settings and apps;
# the physical OS profiles and the bundled QEMU implementation stay untouched.
install -d /usr/lib/firmware/Suno /etc/dracut.conf.d /etc/udev/hwdb.d
python3 "$root/scripts/tester/desktop-edid.py" /usr/lib/firmware/Suno/tester-desktop.bin
cat >/etc/udev/hwdb.d/90-Suno-tester-display.hwdb <<'HWDB'
# Local virtual-device identity, scoped to this disposable developer image.
acpi:LMA:*
 ID_VENDOR_FROM_DATABASE=Suno
HWDB
systemd-hwdb update
printf '%s\n' 'install_items+=" /usr/lib/firmware/Suno/tester-desktop.bin "' >/etc/dracut.conf.d/90-Suno-tester-display.conf
grubby --update-kernel=ALL --args='drm.edid_firmware=Virtual-1:Suno/tester-desktop.bin'
dracut --force --regenerate-all
# Retire the prototype from earlier tester images as well as fresh exports.
rm -rf /usr/share/gnome-shell/extensions/handheld@project-suno.local
rm -f /usr/share/Suno-tester/profiles/mobile.dconf \
  /usr/share/applications/org.projectSuno.MobileInputSettings.desktop \
  /usr/libexec/Suno-mobile-input-settings \
  /usr/share/glib-2.0/schemas/org.projectSuno.handheld.gschema.xml
install -Dm755 "$root/scripts/mobile/Suno-shell-session" /usr/local/bin/Suno-shell-session
install -Dm644 "$root/config/mobile/fp6-physical/overlay/usr/lib/systemd/user/Suno-shell-session.target" /usr/lib/systemd/user/Suno-shell-session.target
install -Dm644 "$root/config/desktop/dconf/profile/user" /etc/dconf/profile/user
install -Dm644 "$root/config/desktop/dconf/db/Suno.d/00-Suno-desktop" /usr/share/Suno-tester/profiles/desktop.dconf
install -d /usr/share/gnome-shell/extensions/tester@project-suno.local
cp -a "$root/extensions/Suno-tester/." /usr/share/gnome-shell/extensions/tester@project-suno.local/
# Source archives are extracted under a private builder umask. Installed Shell
# extensions must be traversable and readable by the graphical user.
chmod -R a+rX /usr/share/gnome-shell/extensions/tester@project-suno.local
glib-compile-schemas /usr/share/glib-2.0/schemas
install -Dm755 "$root/scripts/tester/apply-profile" /usr/libexec/Suno-tester-apply-profile
install -Dm644 "$root/config/tester/Suno-tester-profile.service" /usr/lib/systemd/system/Suno-tester-profile.service
install -d /etc/environment.d /etc/Suno /etc/greetd /etc/systemd/system/greetd.service.d
printf '%s\n' "$target" >/etc/Suno-tester-target
cat >/usr/local/bin/Suno-tester-session <<'SESSION'
#!/bin/sh
IFS= read -r SUNO_DEVICE_CLASS </etc/Suno-device-class
export SUNO_DEVICE_CLASS
# This disposable preview deliberately disables locking in its profile. Record
# that configured state before Shell starts, avoiding its first-login GDM hint.
preview_shell_data=${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell
mkdir -p "$preview_shell_data"
: >"$preview_shell_data/lock-warning-shown"
exec /usr/local/bin/Suno-shell-session
SESSION
chmod 755 /usr/local/bin/Suno-tester-session
cat >/etc/greetd/config.toml <<'GREETD'
[terminal]
vt = 1
[initial_session]
command = "/usr/local/bin/Suno-tester-session"
user = "Suno"
[default_session]
command = "agreety --cmd /usr/local/bin/Suno-tester-session"
user = "greetd"
GREETD
# The new seed must create/authorize Suno before graphical autologin starts.
cat >/etc/systemd/system/greetd.service.d/cloud-init.conf <<'UNIT'
[Unit]
After=cloud-final.service Suno-tester-profile.service
Wants=cloud-final.service
Requires=Suno-tester-profile.service
UNIT
cat >/etc/Suno/tester-image <<IDENTITY
SUNO_TESTER_IMAGE_VERSION=1
SUNO_TESTER_TARGET=$target
SUNO_TESTER_BUILD=$build_id
SUNO_HARDWARE_BACKEND=virtual
SUNO_PHYSICAL_DEVICE=false
IDENTITY
install -m644 /var/tmp/Suno-tester-build/source-identity.json /etc/Suno/tester-source.json
# An explicit developer identity; retain Fedora's vendor file and release RPM.
sed "s/@BUILD_ID@/$build_id/g" "$root/config/tester/os-release.in" >/etc/os-release.Suno-tester
mv /etc/os-release.Suno-tester /etc/os-release
rpm -qa --qf '%{NEVRA}\n' | sort >/etc/Suno/tester-packages.txt
# The preview stays awake/unlocked; it contains only a disposable developer profile.
cat >/etc/dconf/db/Suno.d/90-Suno-tester <<'DCONF'
[org/gnome/desktop/session]
idle-delay=uint32 0
[org/gnome/desktop/screensaver]
lock-enabled=false
[org/gnome/settings-daemon/plugins/power]
sleep-inactive-ac-type='nothing'
DCONF
/usr/libexec/Suno-tester-apply-profile "$target"
systemctl disable gdm.service 2>/dev/null || true
systemctl enable --force sshd.service greetd.service Suno-tester-profile.service
systemctl set-default graphical.target
# Remove the obsolete cloud web console instead of exposing another admin service.
systemctl disable cockpit.socket 2>/dev/null || true
