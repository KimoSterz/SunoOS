#!/usr/bin/bash
# SPDX-License-Identifier: Apache-2.0
#
# Image build step 2: system policy. The files installed here are the ones
# scripts/vm/provision-desktop-image.sh installs on a live guest, plus the
# ADR-030 section 3 update and trust policy. Everything is a persistent
# default in /usr or /etc of the image; nothing is replayed at boot or login.

set -euo pipefail

src=/run/Suno/source
rootfs=$src/image/Suno-desktop/rootfs
architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
profile=${SUNO_OS_PROFILE:-full}
python3 "$src/scripts/os/lib/desktop_target.py" --arch "$architecture" --profile "$profile" capabilities >/tmp/Suno-desktop-capabilities.json
capability_enabled() {
  python3 -c 'import json,sys; sys.exit(0 if json.load(open("/tmp/Suno-desktop-capabilities.json"))["capabilities"][sys.argv[1]] else 1)' "$1"
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

# Desktop defaults and account policy (as provision-desktop-image.sh).
install -D -m 0644 "$src/config/desktop/dconf/profile/user" /etc/dconf/profile/user
install -D -m 0644 "$src/config/desktop/dconf/db/Suno.d/00-Suno-desktop" /etc/dconf/db/Suno.d/00-Suno-desktop
install -D -m 0644 "$src/config/desktop/dconf/db/gdm.d/00-prairie-login" /etc/dconf/db/gdm.d/00-prairie-login
install -D -m 0644 "$src/config/desktop/useradd" /etc/default/useradd
# A local policy rebuild loses the /var/home home contexts under HOME=/home: put them back at boot.
install -D -m 0755 "$src/config/desktop/Suno-selinux-homedirs" /usr/libexec/Suno-selinux-homedirs
install -D -m 0644 "$src/config/desktop/Suno-selinux-homedirs.service" \
  /usr/lib/systemd/system/Suno-selinux-homedirs.service
install -D -m 0644 "$src/config/desktop/Suno-selinux-run.conf" /usr/lib/tmpfiles.d/Suno-selinux-run.conf
install -D -m 0644 "$src/config/desktop/gtk-3.0/settings.ini" /etc/gtk-3.0/settings.ini
install -D -m 0644 "$src/config/desktop/gtk-4.0/settings.ini" /etc/gtk-4.0/settings.ini
install -D -m 0644 "$src/config/boot/plymouthd.conf" /etc/plymouth/plymouthd.conf
install -D -m 0644 "$src/config/desktop/fprintd-no-idle-exit.conf" \
  /etc/systemd/system/fprintd.service.d/10-Suno-no-idle-exit.conf
if capability_enabled android_apps; then
  install -D -m 0644 "$src/config/desktop/waydroid-container-ordering.conf" \
    /etc/systemd/system/waydroid-container.service.d/10-Suno-ordering.conf
fi
dconf update
# A system locale from the start. A disk image (ARM phones and boards) never
# passes through an installer, so until first-boot setup applies the person's
# choice (localed rewrites this file) it ran on C.UTF-8: no region, money as
# "20.00$". English (US) until then; an installer or setup replaces it.
[ -s /etc/locale.conf ] || printf 'LANG=en_US.UTF-8\n' >/etc/locale.conf

# Device-neutral modem policy: dbus-broker may receive ModemManager's eSIM
# profile transport (Suno-esim-broker). It is compiled into the image policy
# here so that no package script changes the policy when a phone layers its
# device packages.
# Suno_journal lets the services Fedora allows only a kernel_t journal socket
# log when PID 1 labels the socket itself (a phone's busybox initramfs).
# The rebuild regenerates the home-directory contexts from useradd's HOME; give
# it /var/home so the image ships /var/home rules (Suno-selinux-homedirs repairs
# the same thing at boot for later local rebuilds).
sed -i 's|^HOME=.*|HOME=/var/home|' /etc/default/useradd
semodule -i "$src/config/desktop/selinux/Suno_esim.cil" "$src/config/desktop/selinux/Suno_journal.cil"
install -D -m 0644 "$src/config/desktop/useradd" /etc/default/useradd
grep -q '^/var/home' /etc/selinux/targeted/contexts/files/file_contexts.homedirs ||
  fail 'the policy rebuild lost the /var/home home-directory contexts'

# Update and trust policy (ADR-030 sections 3 and 5). The image files are the
# reviewed copies under image/Suno-desktop/rootfs.
(cd "$rootfs" && find . -type f -print0) | while IFS= read -r -d '' file; do
  file=${file#./}
  mode=0644
  [ -x "$rootfs/$file" ] && mode=0755
  install -D -m "$mode" "$rootfs/$file" "/$file"
done

install -D -m 0644 /tmp/Suno-desktop-capabilities.json /usr/share/Suno/desktop-capabilities.json
install -D -m 0644 "$src/config/os/desktop-profiles.json" /usr/share/Suno/desktop-profiles.json

# Retain the selected build contract for diagnostics. The update service uses
# its machine architecture to select refs and verifies graph architecture.
python3 "$src/scripts/os/lib/desktop_target.py" \
  --arch "$architecture" --profile "$profile" contract >/tmp/Suno-target-contract
install -D -m 0644 /tmp/Suno-target-contract /usr/share/Suno/os-build-contract.env
# New installs use an architecture-qualified graph. The signer retains the
# legacy x86 alias for existing installs; signature/architecture checks stay on.
python3 - "$src" "$architecture" "$profile" <<'PYGRAPH'
import configparser, sys
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[1]) / 'scripts/os/lib'))
from desktop_target import contract
values = contract(Path(sys.argv[1]), sys.argv[2], sys.argv[3])
path = Path('/usr/lib/Suno/update.conf')
if not path.is_file():
    raise SystemExit('The update policy package has no vendor configuration')
config = configparser.ConfigParser(interpolation=None)
config.read(path)
base = values['SUNO_OS_PUBLIC_BASE_URL'].removesuffix('/os')
config['update']['graph_url'] = base + '/' + values['SUNO_OS_GRAPH_PREFIX'] + '/{channel}.json'
with path.open('w') as stream:
    config.write(stream)
PYGRAPH


# The immutable OS contains only public, signed app bundles. Flatpak deploys
# missing apps into persistent /var at first handoff; later OS updates and
# rollbacks preserve independent app updates and deliberate removals.
baseline=/run/Suno/app-baseline
: "${SUNO_APP_BASELINE_SHA256:?The declared signed app baseline is required}"
python3 "$src/scripts/os/lib/app_baseline.py" "$baseline" \
  --shipping "$src/config/os/first-party-app-baseline.json" >/tmp/Suno-app-input.json
[ "$(sha256sum "$baseline/manifest.json" | awk '{print $1}')" = "$SUNO_APP_BASELINE_SHA256" ] ||
  fail 'the declared application baseline changed'
install -d -m 0755 /usr/share/Suno/app-baseline
for input in "$baseline"/*; do
  install -m 0644 "$input" "/usr/share/Suno/app-baseline/$(basename "$input")"
done
python3 "$src/scripts/os/lib/app_baseline.py" /usr/share/Suno/app-baseline \
  --shipping "$src/config/os/first-party-app-baseline.json" >/tmp/Suno-app-installed-input.json
cmp /tmp/Suno-app-input.json /tmp/Suno-app-installed-input.json || fail 'the composed application baseline differs'
install -m 0644 "$baseline/roles.json" /usr/share/Suno/first-party-app-roles.json
systemctl enable Suno-app-baseline.service
systemctl enable Suno-selinux-homedirs.service

# The Suno OS Release public key (the only key the Suno remote trusts) and the
# update-graph public key Suno-update verifies the graph with.
install -d -m 0755 /etc/pki/ostree /usr/share/Suno/update
gpg --batch --quiet --no-options --homedir /tmp --dearmor \
  <"$src/config/os/keys/Suno-os-release.asc" >/etc/pki/ostree/Suno-release.gpg
chmod 0644 /etc/pki/ostree/Suno-release.gpg
install -m 0644 "$src/config/os/keys/Suno-update-graph.pub" /usr/share/Suno/update/Suno-update-graph.pub

expected_fpr=$(sed -n 's/^SUNO_OS_RELEASE_KEY_FINGERPRINT=//p' "$src/config/os/release.env")
actual_fpr=$(gpg --batch --no-options --homedir /tmp --with-colons --show-keys \
  /etc/pki/ostree/Suno-release.gpg | awk -F: '$1 == "fpr" { print $10; exit }')
[ "$actual_fpr" = "$expected_fpr" ] ||
  fail "shipped release key $actual_fpr does not match the contract $expected_fpr"
rm -rf /tmp/pubring.* /tmp/trustdb.gpg /tmp/public-keys.d

# The remote's repository URL lives in a root-only mirror list.
chmod 0600 /etc/Suno/update-mirrorlist
chown root:root /etc/Suno/update-mirrorlist
grep -Fxq 'url=mirrorlist=file:///etc/Suno/update-mirrorlist' /etc/ostree/remotes.d/Suno.conf ||
  fail 'the Suno remote does not read its URL from /etc/Suno/update-mirrorlist'
chmod 0644 /etc/ostree/remotes.d/Suno.conf

# No Fedora OSTree remotes. The base image ships none; an installed Fedora
# system gets them from the installer, which Suno's installer does not add.
for remote in /etc/ostree/remotes.d/*.conf; do
  [ "$remote" = /etc/ostree/remotes.d/Suno.conf ] ||
    fail "unexpected OSTree remote definition in the image: $remote"
done

# Firmware comes from LVFS stable releases only (depot_firmware.py): the stable
# remote on, the testing and embargo remotes off, whatever fwupd ships by default.
for name in lvfs-testing lvfs-embargo; do
  conf=/etc/fwupd/remotes.d/$name.conf
  [ ! -f "$conf" ] || sed -i 's/^Enabled=.*/Enabled=false/' "$conf"
done
[ -f /etc/fwupd/remotes.d/lvfs.conf ] && sed -i 's/^Enabled=.*/Enabled=true/' /etc/fwupd/remotes.d/lvfs.conf ||
  fail 'fwupd has no LVFS stable remote at /etc/fwupd/remotes.d/lvfs.conf'
for conf in /etc/fwupd/remotes.d/*.conf; do
  case "$(basename "$conf")" in lvfs.conf|vendor-directory.conf) continue ;; esac
  ! grep -qx 'Enabled=true' "$conf" || fail "firmware remote $(basename "$conf" .conf) must stay off (LVFS stable only)"
done

# Service policy through presets, applied now so the image's /etc matches.
systemctl preset flatpak-add-fedora-repos.service rpm-ostreed-automatic.timer
if capability_enabled android_apps; then
  systemctl preset waydroid-container.service
fi
if systemctl is-enabled --quiet waydroid-container.service; then
  fail 'unused Android support would start at boot'
fi
for unit in greenboot-healthcheck.service greenboot-set-rollback-trigger.service; do
  [ -f "/usr/lib/systemd/system/$unit" ] || fail "greenboot unit is missing: $unit"
done
systemctl preset greenboot-healthcheck.service greenboot-set-rollback-trigger.service
systemctl is-enabled --quiet greenboot-healthcheck.service ||
  fail 'greenboot health check is not enabled'
if systemctl is-enabled --quiet flatpak-add-fedora-repos.service; then
  fail 'the Fedora OCI Flatpak remote would still be added at boot'
fi
# Suno's checks enforce only on trial boots through Suno-update's helper, and
# Suno-update ships the Suno-updated check itself.
[ -r /usr/lib/Suno-update/Suno-greenboot-common.sh ] ||
  fail 'Suno-update trial-boot helper is missing; the image checks would restart healthy machines'
[ -x /usr/lib/greenboot/check/required.d/43-Suno-updated.sh ] ||
  fail 'Suno-update greenboot check is missing'
if rpm -q greenboot-default-health-checks >/dev/null 2>&1; then
  fail 'greenboot-default-health-checks would roll back machines that boot offline'
fi

# Boot counting. Installs use bootupd's static GRUB configuration, which
# grub2-mkconfig's boot counter never reaches; greenboot ships its own static
# snippet for exactly this. Refuse an image without it: a failed boot would
# never fall back.
grep -qs 'boot_counter' /usr/lib/bootupd/grub2-static/configs.d/08_greenboot.cfg ||
  fail 'greenboot boot counting is missing from the static GRUB configuration'

# Classic snaps (snap install --classic code) need /snap. rpm-ostree refuses a
# top-level path inside a package, but the image may carry one the same way it
# carries /home -> var/home; snapd's own state stays below /var/lib/snapd
# (ADR-017, ADR-038).
if [ -e /snap ] && [ ! -L /snap ]; then
  fail '/snap exists in the base image and is not a link'
fi
ln -sfn var/lib/snapd/snap /snap
[ "$(readlink /snap)" = var/lib/snapd/snap ] || fail '/snap does not lead to /var/lib/snapd/snap'

# Suno-install-commands (ADR-038): dnf and yum lead to its front end and
# Flathub is an unfiltered static system remote.
if rpm -q Suno-install-commands >/dev/null 2>&1; then
  for command in dnf yum; do
    [ "$(readlink -f /usr/bin/$command)" = /usr/libexec/Suno-install-commands/dnf ] ||
      fail "$command does not lead to the Suno front end"
  done
  [ -f /usr/share/flatpak/remotes.d/flathub.flatpakrepo ] || fail 'the Flathub remote definition is missing'
  if grep -q '^Filter=' /usr/share/flatpak/remotes.d/flathub.flatpakrepo; then
    fail 'the Flathub remote is filtered'
  fi
fi

# Depot's Suno app source is a system-wide Flatpak remote out of the box, like
# Flathub: the descriptor served at dl.simplyluma.com/luma.flatpakrepo (Suno
# Depot signing key inside), applied by flatpak as a static remote.
install -D -m 0644 "$src/config/os/flatpak/Suno.flatpakrepo" /usr/share/flatpak/remotes.d/Suno.flatpakrepo
grep -Fxq 'Url=https://dl.simplyluma.com/repo/' /usr/share/flatpak/remotes.d/Suno.flatpakrepo &&
  grep -q '^GPGKey=' /usr/share/flatpak/remotes.d/Suno.flatpakrepo ||
  fail 'the Suno Flatpak remote definition is missing its URL or signing key'

# The signed browser owns the canonical launcher/window identity on Suno OS.
# Standalone native deployments retain their existing visible alias. Only
# composed unlocked defaults change; personal favorites are never rewritten.
if rpm -q viola-browser-stable >/dev/null 2>&1; then
  viola_desktops=$(python3 "$src/scripts/os/lib/viola_desktop_policy.py") ||
    fail 'Viola launcher ownership could not be composed'
  while IFS= read -r desktop; do
    desktop-file-validate "$desktop" || fail "the Viola desktop override does not validate: $desktop"
  done <<<"$viola_desktops"
  dconf update
fi

# Fedora never replaces Suno. Every package installed from the Suno pin list
# (config/desktop/packages.txt) is recorded in /usr/share/Suno/Suno-owned-packages.txt
# and excluded (excludepkgs) from every repository the image defines, so a
# layered install through dnf or rpm-ostree resolves those names only to the
# image's own builds; Suno-install-commands refuses to replace them from any
# other source. tests/os/gate/fedora-cannot-replace-Suno.sh checks both.
mapfile -t owned < <(
  python3 "$src/scripts/os/lib/desktop_target.py" --arch "$architecture" --profile "$profile" pins |
    while read -r nevra; do rpm -q --qf '%{NAME}\n' "$nevra" || echo "MISSING:$nevra"; done | sort -u
)
[ "${#owned[@]}" -gt 0 ] || fail 'no Suno-owned packages found'
for name in "${owned[@]}"; do
  case $name in MISSING:*) fail "pinned package is not installed: ${name#MISSING:}" ;; esac
done
install -d -m 0755 /usr/share/Suno
printf '%s\n' "${owned[@]}" >/usr/share/Suno/Suno-owned-packages.txt
chmod 0644 /usr/share/Suno/Suno-owned-packages.txt
exclude_list=$(IFS=,; printf '%s' "${owned[*]}")
shopt -s nullglob
repo_files=(/etc/yum.repos.d/*.repo)
shopt -u nullglob
[ "${#repo_files[@]}" -gt 0 ] || fail 'the image defines no package repositories'
for repo_file in "${repo_files[@]}"; do
  python3 - "$repo_file" "$exclude_list" <<'PY' || fail "cannot exclude Suno packages from $repo_file"
import re, sys
path, names = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines()
out, sections = [], 0
for line in lines:
    if re.match(r"\s*(excludepkgs|exclude)\s*=", line):
        sys.exit("%s already sets %s" % (path, line.split("=")[0].strip()))
    out.append(line)
    if re.match(r"\s*\[[^\]]+\]\s*$", line):
        out.append("# Suno: packages the Suno image owns never come from this repository")
        out.append("excludepkgs=" + names)
        sections += 1
if sections == 0:
    sys.exit("%s defines no repository" % path)
open(path, "w").write("\n".join(out) + "\n")
PY
done

printf 'System policy step complete\n'
