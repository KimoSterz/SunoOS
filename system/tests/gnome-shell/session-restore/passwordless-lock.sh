#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# passwordless-lock.sh OUT: as root in the Shell dev container. For a user
# with a password and one without (lumalock-password, lumalock-none), the
# headless Shell under fake-logind is locked by `loginctl lock-sessions`,
# `loginctl lock-session` and ScreenSaver.Lock (Super+L); activity keeps it
# locked; a click asks for the password, or enters when there is none.
set -u
out=$1; here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
rm -rf "$out"; mkdir -p "$out" /run/systemd/seats
[ -S /run/dbus/system_bus_socket ] || { rm -f /run/dbus/pid; mkdir -p /run/dbus; dbus-daemon --system --fork; }
for kind in password none; do
  user=lumalock-$kind
  id "$user" >/dev/null 2>&1 || useradd -m "$user"
  if [ "$kind" = password ]; then
    printf '%s:%s\n' "$user" "$(head -c 18 /dev/urandom | base64)" | chpasswd
  else
    passwd -d "$user" >/dev/null
  fi
  pkill -x accounts-daemon; sleep 1   # read the account afresh (D-Bus activation restarts it)
  d=$out/$kind
  mkdir -p "$d/runtime" "$d/config/glib-2.0/settings"
  printf '[org/gnome/shell]\nwelcome-dialog-last-shown-version=%s\n' "'999'" > "$d/config/glib-2.0/settings/keyfile"
  chown -R "$user:" "$d"; chmod 700 "$d/runtime"
  python3 "$here/fake-logind.py" --uid "$(id -u "$user")" --user "$user" --log "$d/logind.log" & logind=$!
  sleep 2
  runuser -u "$user" -- env -u DISPLAY -u WAYLAND_DISPLAY HOME="/home/$user" USER="$user" \
    XDG_RUNTIME_DIR="$d/runtime" XDG_CONFIG_HOME="$d/config" GSETTINGS_BACKEND=keyfile \
    LIBGL_ALWAYS_SOFTWARE=1 GTK_A11Y=none NO_AT_BRIDGE=1 LOCK_KIND="$kind" LOCK_OUT="$d/result.txt" \
    dbus-run-session -- timeout 180 gnome-shell --headless --virtual-monitor 1280x800 \
    --automation-script="$here/passwordless-lock.js" > "$d/shell.log" 2>&1
  kill "$logind" 2>/dev/null; wait "$logind" 2>/dev/null
  cat "$d/result.txt" 2>/dev/null || { echo "$kind: no result"; tail -20 "$d/shell.log"; }
done
results=$(cat "$out"/*/result.txt 2>/dev/null)
[ "$(grep -c ': PASS' <<<"$results")" = 20 ] && ! grep -q ': FAIL' <<<"$results" && echo LOCK-PASS || { echo LOCK-FAIL; exit 1; }
