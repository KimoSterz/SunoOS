#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in flock gzip podman sha256sum tar; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required Suno Mods build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] || {
  printf 'error: build the Suno Mods RPM on the canonical Fedora Linux builder\n' >&2
  exit 1
}
architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$architecture" in
  x86_64) builder_container=$FEDORA_RPM_BUILD_CONTAINER ;;
  aarch64) builder_container=$FEDORA_RPM_BUILD_CONTAINER_AARCH64 ;;
  *) printf 'error: unsupported architecture: %s\n' "$architecture" >&2; exit 1 ;;
esac
export SUNO_RPM_BUILDER_ARCHITECTURE=$architecture

output_dir="$repo_root/build/packages/Suno-mods"
mkdir -p "$(dirname "$output_dir")"
work_dir="$output_dir.work"
lock_file="$repo_root/build/packages/.Suno-mods-build.lock"
# Keep the lock in flock's parent process and close its descriptor before the
# build command is executed.  Holding the descriptor in this shell lets the
# long-lived Podman/conmon process inherit it, which permanently blocks every
# later build even after the RPM build itself has completed.
if [ "${SUNO_MODS_BUILD_LOCKED:-0}" != 1 ]; then
  exec flock --close "$lock_file" \
    env SUNO_MODS_BUILD_LOCKED=1 "$0" "$@"
fi
rm -rf "$work_dir"
install -d -m 0755 "$work_dir"
trap 'rm -rf "$work_dir"' EXIT
source_date_epoch=${SOURCE_DATE_EPOCH:-$(git -C "$repo_root" log -1 --format=%ct -- \
  src/Suno-mods \
  packaging/rpm/Suno-mods.spec \
  scripts/packages/build-Suno-mods.sh \
  scripts/packages/run-in-rpm-builder.sh \
  LICENSE.md)}
case "$source_date_epoch" in
  ''|*[!0-9]*)
    printf 'error: could not derive a source epoch from the repository HEAD\n' >&2
    exit 1
    ;;
esac
rpmbuild_dir="$work_dir/rpmbuild"
source_dir="$work_dir/Suno-mods/src/Suno-mods"
archive_dir="$work_dir/archive"
mkdir -p "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS} \
  "$source_dir" "$archive_dir"
# Use the supplied reviewed source, as the other canonical Python producers do.
# A release may seal uncommitted work without manufacturing a Git baseline.
# Explicit members exclude caches and diagnostic output from the source offer.
tar -C "$repo_root" --exclude=__pycache__ --exclude='*.pyc' --exclude=.pytest_cache -cf - \
  src/Suno-mods/Suno_mods src/Suno-mods/bin src/Suno-mods/catalog \
  src/Suno-mods/data src/Suno-mods/README.md packaging/rpm/Suno-mods.spec \
  tests/unit/test_Suno_mods.py tests/unit/test_Suno_mods_profile_boundary.py tests/unit/test_Suno_mods_profile_client.py \
  tests/fixtures/mods \
  config/desktop/packages.txt config/shared/application-packages.txt \
  examples/mods LICENSE.md | tar -xf - -C "$archive_dir"
cp -R "$archive_dir/src/Suno-mods/Suno_mods" \
  "$archive_dir/src/Suno-mods/bin" \
  "$archive_dir/src/Suno-mods/catalog" \
  "$archive_dir/src/Suno-mods/data" \
  "$source_dir/"
install -m 0644 "$archive_dir/src/Suno-mods/README.md" "$source_dir/README.md"
mkdir -p "$work_dir/Suno-mods/tests/unit" "$work_dir/Suno-mods/examples"
install -m 0644 "$archive_dir/tests/unit/test_Suno_mods.py" \
  "$archive_dir/tests/unit/test_Suno_mods_profile_boundary.py" "$archive_dir/tests/unit/test_Suno_mods_profile_client.py" "$work_dir/Suno-mods/tests/unit/"
cp -R "$archive_dir/examples/mods" "$work_dir/Suno-mods/examples/"
mkdir -p "$work_dir/Suno-mods/tests/fixtures"
cp -R "$archive_dir/tests/fixtures/mods" "$work_dir/Suno-mods/tests/fixtures/"
mkdir -p "$work_dir/Suno-mods/config/desktop" "$work_dir/Suno-mods/config/shared"
install -m 0644 "$archive_dir/config/desktop/packages.txt" "$work_dir/Suno-mods/config/desktop/"
install -m 0644 "$archive_dir/config/shared/application-packages.txt" "$work_dir/Suno-mods/config/shared/"
tar -C "$work_dir" \
  --sort=name \
  --mtime="@$source_date_epoch" \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -cf - Suno-mods | gzip -n >"$rpmbuild_dir/SOURCES/Suno-mods.tar.gz"
touch -d "@$source_date_epoch" "$rpmbuild_dir/SOURCES/Suno-mods.tar.gz"
install -m 0644 "$archive_dir/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
install -m 0644 "$archive_dir/packaging/rpm/Suno-mods.spec" "$rpmbuild_dir/SPECS/"
chmod -R a+rX "$rpmbuild_dir"

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" "$builder_container" '
    set -euo pipefail
    dnf5 -y install rpm-build python3-devel python3-gobject-base systemd-rpm-macros
    if ! rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-mods.spec >package-check.log 2>&1; then
      cat package-check.log >&2
      exit 1
    fi
    cat package-check.log
    rpm_path=$(find RPMS/noarch -name "Suno-mods-*.rpm" -print -quit)
    test -n "$rpm_path"
    verify=$(mktemp -d)
    cd "$verify"
    rpm2cpio "$OLDPWD/$rpm_path" >payload.cpio
    cpio -idm --quiet <payload.cpio
    rm -f payload.cpio
    PYTHONPYCACHEPREFIX=/tmp/Suno-mods-pycache \
      python3 -m py_compile usr/lib/python3*/site-packages/Suno_mods/*.py
    test -x usr/bin/Suno-mod
    test -x usr/bin/Suno-mods
    test -x usr/bin/Suno-mod-author
    test -x usr/bin/Suno-mod-catalog-author
    test -x usr/bin/Suno-mod-catalog-ceremony
    test -x usr/bin/Suno-mod-catalog-accept
    test -x usr/bin/Suno-mod-review
    test -x usr/bin/Suno-mod-recover
    test -x usr/bin/Suno-mod-system-health
    test -x usr/libexec/Suno-mod-transaction-service
    test -s usr/share/Suno/mods/catalog/manifests/org.projectSuno.mod.green-dock.mod.json
    test -s usr/share/Suno/mods/catalog/profiles/org.projectSuno.mod.green-dock.profile.json
    test -s usr/share/applications/org.projectSuno.Mods.desktop
    test -s usr/share/dbus-1/interfaces/org.projectSuno.ModTransactions1.xml
    test -s usr/share/polkit-1/actions/org.projectSuno.mods.policy
    test -s usr/lib/systemd/system/Suno-mod-transactions.service
    test -s usr/lib/systemd/user/Suno-mod-profiles.service
    test -s usr/share/dbus-1/services/org.projectSuno.ModProfiles1.service
    test -s usr/lib/systemd/system/Suno-mod-boot-observe.service
    test -s usr/lib/systemd/system/Suno-mod-boot-promote.service
    test -s usr/lib/systemd/system/Suno-mod-boot-watchdog.service
    test -s usr/lib/systemd/system/Suno-mod-boot-watchdog.timer
    test -L usr/lib/systemd/system/multi-user.target.wants/Suno-mod-boot-observe.service
    test -L usr/lib/systemd/system/graphical.target.wants/Suno-mod-boot-promote.service
    test -L usr/lib/systemd/system/timers.target.wants/Suno-mod-boot-watchdog.timer
    test -L usr/lib/systemd/user/graphical-session-pre.target.wants/Suno-mod-recover.service
    grep -Fq "ClosedSystemBackend" \
      usr/lib/python3*/site-packages/Suno_mods/privileged.py
    grep -Fq "ProtectSystem=strict" \
      usr/lib/systemd/system/Suno-mod-transactions.service
  '

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir"/RPMS/noarch/*.rpm "$output_dir/RPMS/noarch/"
install -m 0644 "$rpmbuild_dir"/SRPMS/*.rpm "$output_dir/SRPMS/"
install -m 0644 "$rpmbuild_dir/package-check.log" "$output_dir/PACKAGE-CHECKS.log"
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno Mods package: %s\n' "$output_dir"
