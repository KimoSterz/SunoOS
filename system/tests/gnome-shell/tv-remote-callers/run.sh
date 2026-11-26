#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# A headless Shell with the TV Remote service from source (tvInput.js,
# callerWindow.js) and real callers: host windows, a host program without a
# window, and Flatpak-style sandboxes behind xdg-dbus-proxy. Run as an ordinary
# user in a disposable container with the Luma Shell, bubblewrap and
# xdg-dbus-proxy installed and the source at TVR_SOURCE (default /source).
set -eu
S=${TVR_SOURCE:-/source}
export TVR_SOURCE=$S TVR_OUT=${TVR_OUT:-/out}
export HOME=/tmp/tvr-home XDG_RUNTIME_DIR=/tmp/tvr-run
rm -rf "$HOME" "$XDG_RUNTIME_DIR" /tmp/tvr-schemas /tmp/tvr-sandbox.*
mkdir -p "$HOME/.config/glib-2.0/settings" "$XDG_RUNTIME_DIR" "$TVR_OUT" /tmp/tvr-schemas
chmod 700 "$XDG_RUNTIME_DIR"
cp /usr/share/glib-2.0/schemas/*.xml /tmp/tvr-schemas/
cp "$S/src/luma-shell-state/"*.gschema.xml /tmp/tvr-schemas/
glib-compile-schemas /tmp/tvr-schemas 2>/dev/null
printf '[org/gnome/shell]\nwelcome-dialog-last-shown-version=%s\n' "'999'" > "$HOME/.config/glib-2.0/settings/keyfile"
# A native app the window tracker knows by its desktop ID.
mkdir -p "$HOME/.local/share/applications"
printf '[Desktop Entry]\nType=Application\nName=Native TV app\nExec=true\nStartupWMClass=org.example.NativeTv\n' \
  > "$HOME/.local/share/applications/org.example.NativeTv.desktop"
export GSETTINGS_SCHEMA_DIR=/tmp/tvr-schemas GSETTINGS_BACKEND=keyfile
export LIBGL_ALWAYS_SOFTWARE=1 LUMA_MUTTER_ALLOW_SOFTWARE_BLUR=1 GDK_BACKEND=wayland
export DBUS_SYSTEM_BUS_ADDRESS=unix:path=/tmp/tvr-run/system-bus
dbus-daemon --session --fork --nopidfile --address="$DBUS_SYSTEM_BUS_ADDRESS"
rm -f "$TVR_OUT/checks.json"
timeout 150 dbus-run-session -- gnome-shell --headless --no-x11 --virtual-monitor 1280x800 \
  --automation-script="$S/tests/gnome-shell/tv-remote-callers/probe.js" > "$TVR_OUT/shell.log" 2>&1 || true
python3 - "$TVR_OUT" <<'PY'
import json, sys
checks = json.load(open(f"{sys.argv[1]}/checks.json"))
for check in checks:
    print("PASS" if check["ok"] else "FAIL", check["name"], check["detail"])
assert checks and all(check["ok"] for check in checks)
PY
