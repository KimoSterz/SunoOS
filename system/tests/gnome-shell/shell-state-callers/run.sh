#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# One headless Shell over the shell-state service from source; run as an
# ordinary user inside a disposable container with the Luma Shell installed
# and the source at SSC_SOURCE (default /source). Needs dbus-run-session.
set -eu
S=${SSC_SOURCE:-/source}
export SSC_OUT=${SSC_OUT:-/out}
export HOME=/tmp/ssc-home XDG_RUNTIME_DIR=/tmp/ssc-run
rm -rf "$HOME" "$XDG_RUNTIME_DIR" /tmp/ssc-schemas
mkdir -p "$HOME/.config/glib-2.0/settings" "$XDG_RUNTIME_DIR" "$SSC_OUT" /tmp/ssc-schemas
chmod 700 "$XDG_RUNTIME_DIR"
cp /usr/share/glib-2.0/schemas/*.xml /tmp/ssc-schemas/
cp "$S/src/luma-shell-state/"*.gschema.xml /tmp/ssc-schemas/
glib-compile-schemas /tmp/ssc-schemas 2>/dev/null
printf '[org/gnome/shell]\nwelcome-dialog-last-shown-version=%s\n' "'999'" > "$HOME/.config/glib-2.0/settings/keyfile"
export GSETTINGS_SCHEMA_DIR=/tmp/ssc-schemas GSETTINGS_BACKEND=keyfile
export LIBGL_ALWAYS_SOFTWARE=1 LUMA_MUTTER_ALLOW_SOFTWARE_BLUR=1
export DBUS_SYSTEM_BUS_ADDRESS=unix:path=/tmp/ssc-run/system-bus
dbus-daemon --session --fork --nopidfile --address="$DBUS_SYSTEM_BUS_ADDRESS"
timeout 120 dbus-run-session -- bash -c '
  python3 "'"$S"'/src/luma-shell-state/luma-shell-state-service" > "$SSC_OUT/state.log" 2>&1 &
  state=$!
  trap "kill $state 2>/dev/null || true" EXIT
  for attempt in $(seq 1 50); do
    gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \
      --method org.freedesktop.DBus.GetNameOwner org.project_luma.ShellState1 >/dev/null 2>&1 && break
    sleep 0.1
  done
  gnome-shell --headless --no-x11 --virtual-monitor 1280x800 \
    --automation-script="'"$S"'/tests/gnome-shell/shell-state-callers/probe.js" > "$SSC_OUT/shell.log" 2>&1 || true
'
python3 - "$SSC_OUT" <<'PY'
import json, re, sys
out = sys.argv[1]
checks = json.load(open(f"{out}/checks.json"))
log = open(f"{out}/state.log").read()
# The Shell's own start-up reports (ReportInputCapabilities) must not be refused.
refused = re.findall(r"refused (\w+) from (\S+)", log)
checks.append({"name": "only the started program was refused", "detail": str(refused),
               "ok": bool(refused) and all(method == "SetIdleDelay" for method, _ in refused)})
for check in checks:
    print("PASS" if check["ok"] else "FAIL", check["name"], check["detail"])
assert checks and all(check["ok"] for check in checks)
PY
