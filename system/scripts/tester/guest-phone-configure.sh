#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Configure only a disposable image containing the actual native Suno phone shell.
set -euo pipefail
[ "$(id -u)" = 0 ]
[ "$(systemd-detect-virt --vm)" = kvm ]
[ "$#" = 1 ]
build_id=$1
root=/var/tmp/Suno-tester-phone-image
[ -x /opt/Suno/phosh/libexec/phosh ]
[ -x /opt/Suno/phosh/bin/phosh-session ]
[ -x /usr/bin/phoc ]
install -d /etc/ld.so.conf.d /etc/systemd/user /etc/phosh
install -d /etc/cloud/cloud.cfg.d
# Export removes all host keys. Keep the first boot-generated identity stable
# when cloud-init rechecks its NoCloud seed; runtime host-key pinning stays strict.
printf '%s\n' 'ssh_deletekeys: false' >/etc/cloud/cloud.cfg.d/99-Suno-tester-ssh.cfg
printf '%s\n' /opt/Suno/phosh/lib64 >/etc/ld.so.conf.d/Suno-tester-phosh.conf
ldconfig
glib-compile-schemas --strict /opt/Suno/phosh/share/glib-2.0/schemas
cp -a /opt/Suno/phosh/lib/systemd/user/. /etc/systemd/user/
cat >/etc/phosh/phoc.ini <<'PHOC'
[output:Virtual-1]
mode=432x960
scale=1
PHOC
# Remove the desktop virtual EDID; the phone uses QEMU's actual portrait output.
grubby --update-kernel=ALL --remove-args='drm.edid_firmware=Virtual-1:Suno/tester-desktop.bin'
rm -f /etc/dracut.conf.d/90-Suno-tester-display.conf /usr/lib/firmware/Suno/tester-desktop.bin
dracut --force --regenerate-all
rm -rf /usr/share/gnome-shell/extensions/handheld@project-suno.local
rm -f /etc/dconf/db/Suno.d/95-Suno-tester-extensions
install -Dm755 "$root/scripts/tester/mobile-session" /usr/libexec/Suno-tester-mobile-session
install -Dm755 "$root/scripts/tester/mobile-ready.py" /usr/libexec/Suno-tester-mobile-ready
install -Dm755 "$root/scripts/tester/apply-profile" /usr/libexec/Suno-tester-apply-profile
install -Dm644 "$root/config/tester/mobile.dconf" /usr/share/Suno-tester/profiles/mobile.dconf
install -Dm644 "$root/profiles/desktop.dconf" /usr/share/Suno-tester/profiles/mobile-base.dconf
install -Dm644 "$root/profiles/handheld.dconf" /usr/share/Suno-tester/profiles/mobile-handheld.dconf
install -Dm644 "$root/config/tester/mobile-ready.service" /etc/systemd/user/Suno-tester-mobile-ready.service
install -Dm755 "$root/control/libSuno-tester-control.so" /usr/lib64/gtk-3.0/modules/libSuno-tester-control.so
install -d /etc/systemd/user/graphical-session.target.wants /etc/systemd/user/mobi.phosh.Shell.service.d /etc/systemd/user/mobi.phosh.OSK.service.d
ln -sf ../Suno-tester-mobile-ready.service /etc/systemd/user/graphical-session.target.wants/Suno-tester-mobile-ready.service
# The physical phone keeps its normal lock policy. This disposable developer VM
# intentionally starts unlocked and authorizes SSH only with its per-session key.
cat >/etc/systemd/user/mobi.phosh.Shell.service.d/99-Suno-tester.conf <<'UNIT'
[Service]
Environment=SUNO_TESTER_CONTROL=1
Environment=GTK_MODULES=/usr/lib64/gtk-3.0/modules/libSuno-tester-control.so
ExecStart=
ExecStart=/opt/Suno/phosh/libexec/phosh --unlocked
UNIT
install -Dm755 "$root/keyboard/Suno-stevia-x86_64/Suno-phosh-osk-stevia" /usr/libexec/Suno-phosh-osk-stevia
install -Dm755 "$root/keyboard/Suno-keyboard-x86_64/Suno-latinime-decoder" /usr/libexec/Suno-latinime-decoder
install -Dm644 "$root/keyboard/Suno-keyboard-x86_64/main_en.dict" /usr/share/Suno-keyboard/main_en.dict
cat >/etc/systemd/user/mobi.phosh.OSK.service.d/99-Suno-tester.conf <<'UNIT'
[Service]
Environment=POS_DEBUG=force-completion
Environment=SUNO_LATINIME_DECODER=/usr/libexec/Suno-latinime-decoder
Environment=SUNO_LATINIME_DICTIONARY=/usr/share/Suno-keyboard/main_en.dict
ExecStart=
ExecStart=/usr/libexec/Suno-phosh-osk-stevia --allow-replacement
UNIT
printf '%s\n' 'd /run/Suno-display 0755 Suno Suno -' >/etc/tmpfiles.d/Suno-tester-phone.conf
systemd-tmpfiles --create /etc/tmpfiles.d/Suno-tester-phone.conf
cat >/etc/greetd/config.toml <<'GREETD'
[terminal]
vt = 1
[initial_session]
command = "/usr/libexec/Suno-tester-mobile-session"
user = "Suno"
[default_session]
command = "agreety --cmd /usr/libexec/Suno-tester-mobile-session"
user = "greetd"
GREETD
cat >/etc/Suno/tester-image <<IDENTITY
SUNO_TESTER_IMAGE_VERSION=1
SUNO_TESTER_TARGET=mobile
SUNO_TESTER_MOBILE_RENDERER=Suno-phosh
SUNO_TESTER_BUILD=$build_id
SUNO_HARDWARE_BACKEND=virtual
SUNO_PHYSICAL_DEVICE=false
IDENTITY
printf '%s\n' mobile >/etc/Suno-tester-target
install -m644 "$root/inputs.json" /etc/Suno/tester-source.json
/usr/libexec/Suno-tester-apply-profile mobile
rpm -qa --qf '%{NEVRA}\n' | sort >/etc/Suno/tester-packages.txt
systemctl enable sshd.service greetd.service Suno-tester-profile.service
systemctl set-default graphical.target
