#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Deploy Calculator into the logged-in VM user's home and launch it without
# changing /usr, the rpm-ostree deployment, or the system application package.

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
preview_root="$repo_root/build/dev/calculator-preview"
guest=${SUNO_PREVIEW_GUEST:-Suno@192.168.122.250}
guest_key=${SUNO_PREVIEW_GUEST_KEY:-$repo_root/build/provisioning/Suno-m0-guest}
guest_root=/var/home/Suno/.local/share/project-suno/calculator-preview
runtime_root="$guest_root/runtime"
stage_runtime="$preview_root/builds/stage$runtime_root"
shared_lib=/var/home/Suno/.local/share/project-suno/files-preview/lib

test -x "$stage_runtime/bin/gnome-calculator" || {
  printf 'error: Calculator preview has not been built\n' >&2
  exit 1
}
test -f "$guest_key" || {
  printf 'error: preview guest key is missing: %s\n' "$guest_key" >&2
  exit 1
}

ssh_options=(-i "$guest_key" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

ssh "${ssh_options[@]}" "$guest" "
  export XDG_RUNTIME_DIR=/run/user/1000
  export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
  systemctl --user stop Suno-calculator-preview.service >/dev/null 2>&1 || true
  pkill -x gnome-calculator >/dev/null 2>&1 || true
  install -d -m 0755 '$runtime_root'
"
rsync -rlpt --delete -e "ssh ${ssh_options[*]}" \
  "$stage_runtime/" "$guest:$runtime_root/"

ssh "${ssh_options[@]}" "$guest" "
  export XDG_RUNTIME_DIR=/run/user/1000
  export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
  install -d -m 0755 /var/home/Suno/.local/bin \
    /var/home/Suno/.local/share/applications
  install -m 0644 \
    '$runtime_root/share/applications/org.gnome.Calculator.desktop' \
    /var/home/Suno/.local/share/applications/org.gnome.Calculator.desktop
  ln -sfn '$runtime_root/bin/gnome-calculator' \
    /var/home/Suno/.local/bin/gnome-calculator
  update-desktop-database /var/home/Suno/.local/share/applications >/dev/null 2>&1 || true
  glib-compile-schemas '$runtime_root/share/glib-2.0/schemas'
  GSETTINGS_SCHEMA_DIR='$runtime_root/share/glib-2.0/schemas' \
    gsettings set org.gnome.calculator window-size '(320, 440)'
  GSETTINGS_SCHEMA_DIR='$runtime_root/share/glib-2.0/schemas' \
    gsettings set org.gnome.calculator window-maximized false
  gdbus call --session --dest org.gnome.ScreenSaver \
    --object-path /org/gnome/ScreenSaver \
    --method org.gnome.ScreenSaver.SetActive false >/dev/null
  systemd-run --user --unit=Suno-calculator-preview --collect --no-block --quiet \
    --setenv=XDG_RUNTIME_DIR=/run/user/1000 \
    --setenv=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus \
    --setenv=XDG_SESSION_TYPE=wayland \
    --setenv=WAYLAND_DISPLAY=wayland-0 \
    --setenv=GSETTINGS_SCHEMA_DIR='$runtime_root/share/glib-2.0/schemas' \
    --setenv=LD_LIBRARY_PATH='$runtime_root/lib:$shared_lib' \
    '$runtime_root/bin/gnome-calculator'
"

printf 'Development-only Calculator preview launched from %s\n' "$guest_root"
