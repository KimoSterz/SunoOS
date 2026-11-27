#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in mktemp podman sha256sum tar; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required Android runtime build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] && [ "$(uname -m)" = x86_64 ] || {
  printf 'error: build the Android runtime RPM on the canonical Linux/x86_64 builder\n' >&2
  exit 1
}

output_dir="$repo_root/build/packages/Suno-android-runtime"
install -d -m 0755 "$(dirname -- "$output_dir")"
work_dir=$(mktemp -d "$output_dir.work.XXXXXX")
rpmbuild_dir="$work_dir/rpmbuild"
source_dir="$work_dir/Suno-android-runtime"
chmod 0755 "$work_dir"
mkdir -p "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS} "$source_dir"
cp -R "$repo_root/src/Suno-android/Suno_android" "$repo_root/src/Suno-android/tests" "$source_dir/"
cp -R "$repo_root/src/Suno-android/bin" "$repo_root/src/Suno-android/data" "$source_dir/"
mkdir -p "$source_dir/config/profiles"
cp "$repo_root/config/android/Suno-android.conf" "$source_dir/config/"
cp "$repo_root/config/android/fp6-software-weston.ini" "$source_dir/config/"
cp "$repo_root/config/android/profiles/"*.conf "$source_dir/config/profiles/"
install -m 0644 "$repo_root/LICENSES/GPL-3.0-or-later.txt" "$source_dir/COPYING.GPL-3.0"
tar -C "$work_dir" -czf "$rpmbuild_dir/SOURCES/Suno-android-runtime.tar.gz" \
  Suno-android-runtime
install -m 0644 "$repo_root/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
install -m 0644 "$repo_root/scripts/packages/counted-unittest.py" \
  "$rpmbuild_dir/SOURCES/counted-unittest.py"
install -m 0644 "$repo_root/packaging/rpm/Suno-android-runtime.spec" \
  "$rpmbuild_dir/SPECS/"
chmod -R a+rX "$rpmbuild_dir"

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" "$FEDORA_RPM_BUILD_CONTAINER" '
    set -euo pipefail
    dnf5 -y install desktop-file-utils rpm-build shared-mime-info systemd-rpm-macros systemd-devel selinux-policy-devel python3-devel python3-gobject gtk4 libadwaita
    rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-android-runtime.spec
    rpm_path=$(find RPMS/noarch -name "Suno-android-runtime-*.rpm" -print -quit)
    test -n "$rpm_path"
    rpm -qp --qf "[%{FILEMODES:octal} %{FILENAMES}\n]" "$rpm_path" > payload-modes.txt
    python3 - <<PY
import pathlib, stat
for line in pathlib.Path("payload-modes.txt").read_text().splitlines():
    mode, name = line.split(" ", 1)
    value = int(mode, 8)
    if stat.S_ISDIR(value) and stat.S_IMODE(value) != 0o755:
        raise SystemExit(f"Unexpected Android runtime directory permissions: {mode} {name}")
PY
    verify=$(mktemp -d)
    cd "$verify"
    # Fedora rpm2cpio can receive SIGPIPE after cpio has consumed a valid
    # archive; validate the cpio result rather than treating that producer-side
    # close as a corrupt package.
    set +o pipefail
    rpm2cpio "$OLDPWD/$rpm_path" | cpio -idm --quiet
    set -o pipefail
    python3 -m py_compile usr/lib/python3*/site-packages/Suno_android/*.py
    python3 -m py_compile usr/libexec/Suno-waydroid-package-session
    test -x usr/lib/systemd/system-generators/Suno-android-policy-generator
    test -x usr/libexec/Suno-waydroid-package-session
    test -x usr/libexec/Suno-waydroid-container
    test -f usr/share/selinux/packages/Suno_android_runtime.cil
    grep -Fqx "ExecStart=/usr/libexec/Suno-waydroid-container" \
      usr/lib/systemd/system/waydroid-container.service.d/25-Suno-hardware-admission.conf
    test -f usr/share/polkit-1/actions/org.projectSuno.waydroid-package-session.policy
    test -f usr/share/dbus-1/services/org.projectSuno.ApplicationInstaller1.service
    grep -Fq "application/vnd.android.package-archive" \
      usr/share/mime/packages/Suno-android.xml
    grep -Fq "application/vnd.projectSuno.android-package-set" \
      usr/share/mime/packages/Suno-android.xml
    grep -Fq "X-Purism-FormFactor=Workstation;Mobile;" \
      usr/share/applications/org.projectSuno.AndroidSettings.desktop
    grep -Fq "/smart-sizing:" \
      usr/lib/python3*/site-packages/Suno_android/engine.py
    grep -Fq '"+multitouch"' \
      usr/lib/python3*/site-packages/Suno_android/engine.py
    grep -Fq '"/clipboard:direction-to:off,files-to:off"' \
      usr/lib/python3*/site-packages/Suno_android/engine.py
    grep -Fq "viewer_environment.pop(\"SDL_TOUCH_MOUSE_EVENTS\", None)" \
      usr/lib/python3*/site-packages/Suno_android/engine.py
    grep -Fq "viewer_environment.pop(\"SDL_MOUSE_TOUCH_EVENTS\", None)" \
      usr/lib/python3*/site-packages/Suno_android/engine.py
    grep -Fq "LAUNCHER_STARTUP_RECONCILE_SECONDS = 5" \
      usr/lib/python3*/site-packages/Suno_android/service.py
    grep -Fq "exit_code = viewer.poll()" \
      usr/lib/python3*/site-packages/Suno_android/engine.py
    grep -Fqx "RuntimeDirectoryPreserve=yes" \
      usr/lib/systemd/user/Suno-android.service
    for unit in Suno-android.service Suno-android-session.service Suno-android-prewarm.service \
      Suno-android-fp6-software-compositor.service; do
      grep -Fqx "ConditionEnvironment=XDG_SESSION_CLASS=user" "usr/lib/systemd/user/$unit"
      grep -Fqx "ConditionUser=!@system" "usr/lib/systemd/user/$unit"
    done
    grep -Fq "fp6_software_service_admitted(session_user=session_user)" \
      usr/lib/python3*/site-packages/Suno_android/engine.py
    grep -Fqx "SuccessExitStatus=71" \
      usr/lib/systemd/system/Suno-waydroid-fp6-gpu-watchdog.service
    grep -Fqx "NoDisplay=true" usr/share/applications/org.projectSuno.AndroidSettings.desktop
    grep -Fqx "NoDisplay=true" usr/share/Suno/desktop-overrides/applications/Waydroid.desktop
    python3 - <<PY
import ast
from pathlib import Path
source = next(Path("usr/lib").glob("python3*/site-packages/Suno_android/engine.py"))
tree = ast.parse(source.read_text())
# Byte markers reject obsolete processes; only string values can launch argv.
if any(isinstance(node, ast.Constant) and isinstance(node.value, str)
       and node.value == "+dynamic-resolution" for node in ast.walk(tree)):
    raise SystemExit("Legacy dynamic-resolution launch argument is forbidden")
PY
  '

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir"/RPMS/noarch/*.rpm "$output_dir/RPMS/noarch/"
install -m 0644 "$rpmbuild_dir"/SRPMS/*.rpm "$output_dir/SRPMS/"
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno Android runtime package: %s\n' "$output_dir"
