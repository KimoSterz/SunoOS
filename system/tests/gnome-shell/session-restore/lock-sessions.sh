#!/bin/bash
# The Shell's answer to logind's Lock (loginctl lock-sessions), headless, against fake-logind.py.
# PASS: the shield is active and locked after LockSessions. Prints result.txt and the fake logind log.
set -u
out=$1; here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
rm -rf "$out"; mkdir -p "$out/runtime" "$out/config/glib-2.0/settings"; chmod 700 "$out/runtime"
mkdir -p /run/systemd/seats
printf '[org/gnome/shell]\nwelcome-dialog-last-shown-version=%s\n' "'999'" > "$out/config/glib-2.0/settings/keyfile"
python3 "$here/fake-logind.py" --log "$out/logind.log" &
lpid=$!
sleep 2
env -u DISPLAY -u WAYLAND_DISPLAY XDG_RUNTIME_DIR="$out/runtime" XDG_CONFIG_HOME="$out/config" \
  GSETTINGS_BACKEND=keyfile LIBGL_ALWAYS_SOFTWARE=1 LOCK_OUT="$out/result.txt" XDG_SESSION_ID= \
  dbus-run-session -- timeout 120 gnome-shell --headless --virtual-monitor 1280x800 \
  --automation-script="$here/lock-sessions.js" > "$out/shell.log" 2>&1
kill $lpid
cat "$out/result.txt"; cat "$out/logind.log"
grep -q "after logind Lock: shield=true active=true locked=true" "$out/result.txt" && echo LOCK-PASS || { echo LOCK-FAIL; exit 1; }
grep -i -E "monitor session|getCurrentSessionProxy|Lock|screenShield|login session" "$out/shell.log" | head -20
