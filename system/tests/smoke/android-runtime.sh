#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

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

android_diagnostics() {
  local status
  status=$(Suno-android status 2>/dev/null || true)
  if tr '\0' '\n' </proc/device-tree/compatible 2>/dev/null | \
      grep -Fxq fairphone,fp6 && \
      ! grep -Fq '"fp6_kernel_admitted": true' <<<"$status"; then
    if Suno-android status | \
        grep -Fq '"fp6_software_presentation": true'; then
      Suno-android doctor
      return
    fi
    if Suno-android doctor; then
      return 1
    fi
    Suno-android status | grep -Fq '"fp6_gpu_gate": "kernel-not-admitted"'
    return
  fi
  Suno-android doctor
}

check 'Suno Android runtime package' \
  rpm -q "${SUNO_ANDROID_EXPECTED_NEVRA:-Suno-android-runtime}"
check 'Fedora Waydroid 1.6.3 or newer' bash -c \
  'rpm --quiet --query waydroid && rpm --quiet --query --whatprovides waydroid'
check 'Binder kernel transport' bash -c \
  'grep -qw binder /proc/filesystems || { test -c /dev/binder && test -c /dev/hwbinder && test -c /dev/vndbinder; }'
check 'render node is available' bash -c 'compgen -G "/dev/dri/renderD*" >/dev/null'
check 'APK MIME contract is installed' \
  grep -Fq application/vnd.android.package-archive \
    /usr/share/mime/packages/Suno-android.xml
check 'APK default handler is Suno Application Installer' bash -c \
  'if command -v xdg-mime >/dev/null; then test "$(XDG_CURRENT_DESKTOP=GNOME xdg-mime query default application/vnd.android.package-archive)" = io.Suno.Valet.desktop; else XDG_CURRENT_DESKTOP=GNOME gio mime application/vnd.android.package-archive | sed -n 1p | grep -Fq io.Suno.Valet.desktop; fi'
check 'split-package MIME contract is installed' \
  grep -Fq application/vnd.projectSuno.android-package-set \
    /usr/share/mime/packages/Suno-android.xml
check 'split-package default handler is Suno Application Installer' bash -c \
  'if command -v xdg-mime >/dev/null; then test "$(XDG_CURRENT_DESKTOP=GNOME xdg-mime query default application/vnd.projectSuno.android-package-set)" = io.Suno.Valet.desktop; else XDG_CURRENT_DESKTOP=GNOME gio mime application/vnd.projectSuno.android-package-set | sed -n 1p | grep -Fq io.Suno.Valet.desktop; fi'
check 'split-package helper is installed with its policy' bash -c \
  'test -x /usr/libexec/Suno-waydroid-package-session && test -f /usr/share/polkit-1/actions/org.projectSuno.waydroid-package-session.policy'
check 'FP6 kernel admission and GPU watchdog are installed' bash -c \
  'test -x /usr/libexec/Suno-waydroid-fp6-gpu-watchdog && test -x /usr/libexec/Suno-waydroid-fp6-software-compositor && test -f /usr/lib/systemd/system/Suno-waydroid-fp6-gpu-watchdog.service && test -f /usr/lib/systemd/user/Suno-android-fp6-software-compositor.service'
check 'runtime broker unit has a valid hardening profile' bash -c \
  'systemd-analyze --user security Suno-android.service >/dev/null'
check 'runtime broker owns private writable package staging' bash -c \
  'systemctl --user start Suno-android.service && test "$(stat -c %a /run/user/$UID/Suno-android)" = 700 && test -w "/run/user/$UID/Suno-android"'
check 'resource policy is generated' \
  test -f /run/systemd/generator/waydroid-container.service.d/40-Suno-resource-policy.conf
check 'Android engine responds' Suno-android status
check 'Android diagnostics enforce hardware admission' android_diagnostics
check 'SDL viewer defers native-touch hint policy and detects early exit' bash -c \
  'grep -Fq '\''viewer_environment.pop("SDL_TOUCH_MOUSE_EVENTS", None)'\'' /usr/lib/python3*/site-packages/Suno_android/engine.py && grep -Fq '\''viewer_environment.pop("SDL_MOUSE_TOUCH_EVENTS", None)'\'' /usr/lib/python3*/site-packages/Suno_android/engine.py && grep -Fq '\''exit_code = viewer.poll()'\'' /usr/lib/python3*/site-packages/Suno_android/engine.py && grep -Fxq '\''RuntimeDirectoryPreserve=yes'\'' /usr/lib/systemd/user/Suno-android.service'
check 'FP6 viewer keeps clipboard and file transfer host-owned' bash -c \
  'grep -Fq '\''"/clipboard:direction-to:off,files-to:off"'\'' /usr/lib/python3*/site-packages/Suno_android/engine.py'
check 'sandboxed broker authenticates the immutable FP6 compositor unit' bash -c \
  'grep -Fq '\''fp6_software_service_admitted(session_user=session_user)'\'' /usr/lib/python3*/site-packages/Suno_android/engine.py'
check 'FP6 software lab path requires an ephemeral root-owned marker' bash -c \
  'grep -Fq '\''FP6_SOFTWARE_LAB_MARKER = Path('\'' /usr/lib/python3*/site-packages/Suno_android/engine.py && grep -Fq '\''metadata.st_uid != 0'\'' /usr/lib/python3*/site-packages/Suno_android/engine.py && grep -Fq '\''metadata.st_mode & 0o022'\'' /usr/lib/python3*/site-packages/Suno_android/engine.py'
check 'Suno-owned Android notification transport is installed' bash -c \
  'test -x /usr/libexec/Suno-waydroid-session && grep -Fxq '\''ExecStart=/usr/bin/Suno-android-session'\'' /usr/lib/systemd/user/Suno-android-session.service && python3 -c "import Suno_android.waydroid_notifications, Suno_android.notification_bridge"'


exit "$failures"
