#!/bin/bash
# lumaSession's D-Bus callers are held by the broker's pidfd (headless Shell).
# PASS: a live caller is identified; one that exits, or whose pid is reused,
# mid-check (after readable reads, or left unreaped) is refused; one whose
# details can't be read is refused; a broker without ProcessFD still answers;
# no fd is left open. Prints result.txt; CALLER-PASS or CALLER-FAIL.
set -u
out=$1; here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
rm -rf "$out"; mkdir -p "$out/runtime" "$out/config/glib-2.0/settings"; chmod 700 "$out/runtime"
printf '[org/gnome/shell]\nwelcome-dialog-last-shown-version=%s\n' "'999'" > "$out/config/glib-2.0/settings/keyfile"
env -u DISPLAY -u WAYLAND_DISPLAY XDG_RUNTIME_DIR="$out/runtime" XDG_CONFIG_HOME="$out/config" \
  GSETTINGS_BACKEND=keyfile LIBGL_ALWAYS_SOFTWARE=1 CALLER_OUT="$out/result.txt" \
  dbus-run-session -- timeout 120 gnome-shell --headless --virtual-monitor 1280x800 \
  --automation-script="$here/caller-pidfd.js" > "$out/shell.log" 2>&1
cat "$out/result.txt" 2>/dev/null || { echo "no result"; tail -20 "$out/shell.log"; }
# Every case passes; pid reuse may SKIP where ns_last_pid is read-only (an unprivileged container).
[ "$(grep -c ': PASS' "$out/result.txt" 2>/dev/null)" -ge 11 ] && ! grep -q ': FAIL' "$out/result.txt" &&
  [ "$(grep -c ': \(PASS\|SKIP\)' "$out/result.txt")" = 12 ] && echo CALLER-PASS || { echo CALLER-FAIL; exit 1; }
