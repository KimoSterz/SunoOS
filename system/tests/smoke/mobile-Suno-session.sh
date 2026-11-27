#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
launcher="$repo_root/scripts/mobile/Suno-shell-session"
watchdog="$repo_root/scripts/mobile/Suno-shell-rescue-watchdog.sh"

for script in "$launcher" "$watchdog"; do
  sh -n "$script"
done

grep -Fq 'XDG_CURRENT_DESKTOP=Suno:GNOME' "$launcher"
grep -Fq 'XDG_SESSION_TYPE=wayland' "$launcher"
grep -Fq 'gnome-shell-osk-layouts.gresource' "$launcher"
grep -Fq 'GTK_IM_MODULE=ibus' "$launcher"
grep -Fq 'XDG_SESSION_ID XDG_SEAT XDG_VTNR' "$launcher"
grep -Fq 'systemctl --user unset-environment DISPLAY WAYLAND_DISPLAY' "$launcher"
grep -Fq 'systemctl --user import-environment' "$launcher"
grep -Fq '/usr/bin/ibus-daemon --panel disable --daemonize --replace' "$launcher"
grep -Fq -- '--what=handle-power-key' "$launcher"
grep -Fq -- "--who='Suno Handheld Shell'" "$launcher"
! grep -Fq '/usr/libexec/Suno-power-key-broker &' "$launcher"
! grep -Fq 'power_broker_pid' "$launcher"
grep -Fq 'if (this._displaySleeping)' \
  "$repo_root/extensions/Suno-handheld/extension.js"
! grep -Fq 'Clutter.KEY_PowerOff' \
  "$repo_root/extensions/Suno-handheld/extension.js"
grep -Fq 'ExecStart=/usr/libexec/Suno-power-key-broker' \
  "$repo_root/extensions/Suno-handheld/Suno-power-key-broker.service"
grep -Fq 'PartOf=Suno-shell-session.target' \
  "$repo_root/extensions/Suno-handheld/Suno-power-key-broker.service"
grep -Fq 'WantedBy=Suno-shell-session.target' \
  "$repo_root/extensions/Suno-handheld/Suno-power-key-broker.service"
grep -Fq 'org.projectSuno.Keyboard1' \
  "$repo_root/extensions/Suno-handheld/extension.js"
grep -Fq 'mutter_private_sha256=49572c97fcb961550f6681efc17f066339bf6a95b447e4975019ee6b57e5d974' "$launcher"
grep -Fq 'LD_LIBRARY_PATH=$mutter_private_dir' "$launcher"
grep -Fq '/usr/bin/gnome-shell --wayland --display-server --mode=user &' "$launcher"
grep -Fq 'refresh_display_bound_services' "$launcher"
grep -Fq 'try-restart Suno-android.service' "$launcher"
grep -Fq '[ -S "$XDG_RUNTIME_DIR/$display_name" ]' "$launcher"
grep -Fq 'shell_max_attempts=3' "$launcher"

grep -Fq 'command = "phosh-session"' "$watchdog"
grep -Fq 'unlink "$run_marker"' "$watchdog"
grep -Fq 'systemctl stop greetd.service' "$watchdog"
grep -Fq 'systemctl start greetd.service' "$watchdog"

for forbidden in fastboot set_active /dev/disk /dev/mmcblk /dev/nvme; do
  if grep -Ev '^[[:space:]]*#' "$watchdog" | grep -Fq "$forbidden"; then
    printf 'error: watchdog contains forbidden operation marker: %s\n' \
      "$forbidden" >&2
    exit 1
  fi
done

printf 'Mobile Suno one-shot session contract: PASS\n'
