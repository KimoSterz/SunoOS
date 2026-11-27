#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in mktemp podman sha256sum tar; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required Suno-update package build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  printf 'error: build Suno-update on the canonical Linux/x86_64 builder\n' >&2
  exit 1
fi

version=$(sed -n 's/^Version:[[:space:]]*//p' "$repo_root/packaging/rpm/Suno-update.spec")
output_dir="$repo_root/build/packages/Suno-update"
mkdir -p "$(dirname -- "$output_dir")"
work_dir=$(mktemp -d "$output_dir.work.XXXXXX")
cleanup() {
  status=$?
  trap - EXIT
  if [ "$status" = 0 ]; then
    rm -rf "$work_dir"
  else
    # A verifier failure must not discard completed RPMs and force a rebuild.
    printf 'Preserved failed package work directory: %s\n' "$work_dir" >&2
  fi
  exit "$status"
}
trap cleanup EXIT
rpmbuild_dir="$work_dir/rpmbuild"
mkdir -p "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

# A reproducible source archive: fixed order, owner and mtime; no caches.
COPYFILE_DISABLE=1 tar --sort=name --owner=0 --group=0 --numeric-owner \
  --mtime='2026-09-15 00:00:00Z' --exclude='__pycache__' --exclude='*.pyc' --exclude='._*' \
  --transform "s,^src/Suno-update,Suno-update-$version," \
  -C "$repo_root" -czf "$rpmbuild_dir/SOURCES/Suno-update-$version.tar.gz" src/Suno-update
install -m 0644 "$repo_root/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
# Suno-os-remote: the image's own remote definition and the public keys, from their one source.
install -m 0644 "$repo_root/image/Suno-desktop/rootfs/etc/ostree/remotes.d/Suno.conf" "$rpmbuild_dir/SOURCES/Suno.conf"
install -m 0644 "$repo_root/image/Suno-desktop/rootfs/etc/Suno/update-mirrorlist" "$rpmbuild_dir/SOURCES/update-mirrorlist"
install -m 0644 "$repo_root/config/os/keys/Suno-os-release.asc" "$rpmbuild_dir/SOURCES/Suno-os-release.asc"
install -m 0644 "$repo_root/config/os/keys/Suno-update-graph.pub" "$rpmbuild_dir/SOURCES/Suno-update-graph.pub"
install -m 0644 "$repo_root/packaging/rpm/Suno-update.spec" "$rpmbuild_dir/SPECS/"

# The single-quoted payload expands only inside the Fedora builder.
# shellcheck disable=SC2016
"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" "$FEDORA_RPM_BUILD_CONTAINER" '
    set -euo pipefail
    dnf5 -y install rpm-build systemd-rpm-macros python3-devel python3-gobject-base desktop-file-utils libxml2 gnupg2 ostree openssl acl
    rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-update.spec
    rpm=$(find RPMS/noarch -name "Suno-update-1*.rpm" -print -quit)
    remote_rpm=$(find RPMS/noarch -name "Suno-os-remote-*.rpm" -print -quit)
    # Check actual RPM headers, including implicit Python/doc/license dirs.
    # A shared build volume must not leak setgid or restrictive default ACL modes.
    python3 - "$rpm" "$remote_rpm" <<PY_MODES
import stat, subprocess, sys
for package in sys.argv[1:]:
    rows = subprocess.check_output(["rpm", "-qp", "--dump", package], text=True)
    directories = 0
    for row in rows.splitlines():
        fields = row.split()
        mode = int(fields[4], 8)
        if stat.S_ISDIR(mode):
            assert stat.S_IMODE(mode) == 0o755, (package, fields[0], fields[4])
            assert fields[5:7] == ["root", "root"], (package, fields[0], fields[5:7])
            directories += 1
    assert directories, package
PY_MODES
    rpm -qp --requires "$rpm" | grep -F "Suno-os-remote" >/dev/null
    rpm -qplv "$remote_rpm" | grep -E "^-rw------- .* root +root .* /etc/Suno/update-mirrorlist$" >/dev/null
    rpm -qpl "$remote_rpm" | grep -Fx /etc/ostree/remotes.d/Suno.conf >/dev/null
    rpm -qpl "$remote_rpm" | grep -Fx /etc/pki/ostree/Suno-release.gpg >/dev/null
    rpm -qpl "$remote_rpm" | grep -Fx /usr/lib/Suno-update/graph-keys.d/Suno-update-graph.pub >/dev/null
    verify=$(mktemp -d)
    cd "$verify"
    rpm2cpio "$OLDPWD/$rpm" >payload.cpio
    cpio -idm --quiet <payload.cpio
    rm payload.cpio
    test -x usr/libexec/Suno-updated
    test -x usr/bin/Suno-update
    find usr/lib/python3*/site-packages/Suno_update -name bootmenu.py | grep . >/dev/null
    test -f usr/lib/systemd/system/Suno-updated.timer
    test -f usr/share/dbus-1/system.d/org.projectSuno.Update1.conf
    test -x usr/lib/greenboot/check/required.d/43-Suno-updated.sh
    # 1.0.0-1.Suno.29: staged updates arm the boot counter; a counted-out fallback is kept.
    test -x usr/lib/Suno-update/Suno-greenboot-counter
    grep -Fxq "WantedBy=ostree-finalize-staged.service" usr/lib/systemd/system/Suno-greenboot-arm.service
    grep -Fxq "enable Suno-greenboot-arm.service" usr/lib/systemd/system-preset/80-Suno-update.preset
    grep -Fxq "enable Suno-greenboot-fallback.service" usr/lib/systemd/system-preset/80-Suno-update.preset
    # 1.0.0-1.Suno.35: device boot images follow the deployment (Suno-device-boot).
    test -x usr/libexec/Suno-device-boot
    test -d usr/lib/Suno/device-boot
    grep -Fxq "enable Suno-device-boot.service" usr/lib/systemd/system-preset/80-Suno-update.preset
    grep -Fxq "enable Suno-device-boot-confirm.service" usr/lib/systemd/system-preset/80-Suno-update.preset
    grep -Fxq "ConditionDirectoryNotEmpty=/usr/lib/Suno/device-boot" usr/lib/systemd/system/Suno-device-boot.service
    # 1.0.0-1.Suno.36: confirm marks the running slot on every boot, a trial slot only for its kernel.
    grep -Fxq "ConditionDirectoryNotEmpty=/usr/lib/Suno/device-boot" usr/lib/systemd/system/Suno-device-boot-confirm.service
    grep -Fxq "ConditionPathExists=!/usr/lib/systemd/system/greenboot-healthcheck.service" \
      usr/lib/systemd/user/grub-boot-success.timer.d/50-Suno-greenboot.conf
    desktop-file-validate usr/share/applications/org.projectSuno.Update.desktop
    xmllint --noout usr/share/dbus-1/interfaces/org.projectSuno.Update1.xml \
      usr/share/polkit-1/actions/org.projectSuno.update.policy \
      usr/share/dbus-1/system.d/org.projectSuno.Update1.conf
    for script in usr/lib/greenboot/check/required.d/*.sh usr/lib/greenboot/*/*.sh \
                  usr/lib/NetworkManager/dispatcher.d/90-Suno-update usr/lib/Suno-update/Suno-greenboot-common.sh \
                  usr/lib/Suno-update/Suno-greenboot-counter; do
      bash -n "$script"
    done
    PYTHONPATH=$(echo usr/lib/python3*/site-packages) python3 -c "import Suno_update.daemon, Suno_update.cli, Suno_update.notifier, Suno_update.boot, Suno_update.redact, Suno_update.names"
    # Review fixes that must be in the payload: Cancel on the bus, no implied logind action,
    # greenboot errors at error priority, logind inhibitor checks for Apply.
    grep -Fq "<method name=\"Cancel\"/>" usr/share/dbus-1/interfaces/org.projectSuno.Update1.xml
    ! grep -Fq "policykit.imply" usr/share/polkit-1/actions/org.projectSuno.update.policy
    grep -Fq "logger --priority user.err" usr/lib/Suno-update/Suno-greenboot-common.sh
    grep -Fq "RebootWithFlags" usr/lib/python3*/site-packages/Suno_update/system.py
    grep -Fq "KernelArgs" usr/lib/python3*/site-packages/Suno_update/rpmostree.py
    test -f "$(echo usr/lib/python3*/site-packages)/Suno_update/kargs.py"
    grep -Fq "def revocable" usr/lib/python3*/site-packages/Suno_update/preview.py
    grep -Fq "staff-media" usr/lib/python3*/site-packages/Suno_update/preview.py
    # Release names (1.0.0-1.Suno.12): the naming module and its published properties.
    grep -Fq "def booted_name" usr/lib/python3*/site-packages/Suno_update/names.py
    grep -Fq "\"booted_name\": \"s\"" usr/lib/python3*/site-packages/Suno_update/status.py
    # 1.0.0-1.Suno.15: added packages the new base ships, stale credentials, errors from another system.
    grep -Fq "def added_packages_the_base_provides" usr/lib/python3*/site-packages/Suno_update/engine.py
    grep -Fq "uninstall-packages" usr/lib/python3*/site-packages/Suno_update/rpmostree.py
    # 1.0.0-1.Suno.17: an added copy identical to the base goes, a newer one is kept.
    grep -Fq "def added_packages_in_conflict" usr/lib/python3*/site-packages/Suno_update/engine.py
    grep -Fq "def rpmvercmp" usr/lib/python3*/site-packages/Suno_update/rpmver.py
    grep -Fq "def newer" usr/lib/python3*/site-packages/Suno_update/device_repo.py
    grep -Fq "RefreshMd" usr/lib/python3*/site-packages/Suno_update/rpmostree.py
    grep -Fq '"added-package-newer"' usr/lib/python3*/site-packages/Suno_update/engine.py
    grep -Fq "\"kept_packages\": \"as\"" usr/lib/python3*/site-packages/Suno_update/status.py
    grep -Fq "def set_aside" usr/lib/python3*/site-packages/Suno_update/preview.py
    grep -Fq "def _forget_another_systems_error" usr/lib/python3*/site-packages/Suno_update/engine.py
    grep -Fq "\"removed_packages\": \"as\"" usr/lib/python3*/site-packages/Suno_update/status.py
    # 1.0.0-1.Suno.16: refusals are recognised inside the wrapped rpm-ostree transaction error.
    grep -Fq "wrapped = not error_class or error_class == \"transaction\"" usr/lib/python3*/site-packages/Suno_update/engine.py
    rpm -qp --obsoletes "$OLDPWD/$rpm" | grep -F "Suno-update-client" >/dev/null
    ! find usr/lib/systemd -type l -print -quit | grep . >/dev/null
  '

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir"/RPMS/noarch/*.rpm "$output_dir/RPMS/noarch/"
install -m 0644 "$rpmbuild_dir"/SRPMS/*.rpm "$output_dir/SRPMS/"
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno update agent package: %s\n' "$output_dir"
