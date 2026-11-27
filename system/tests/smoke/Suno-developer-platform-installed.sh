#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

for tool in dbus-run-session gdbus Suno python3 rpm systemd-analyze timeout xvfb-run; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required installed-platform test tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

rpm -q Suno-developer-platform Suno-developer-platform-sdk
Suno semantic --help >/dev/null

test -x /usr/libexec/Suno-semantic-broker
test -x /usr/libexec/Suno-semantic-consent
test -f /usr/share/dbus-1/interfaces/org.projectSuno.SemanticBroker1.xml
test -f /usr/share/dbus-1/services/org.projectSuno.SemanticBroker1.service
test -f /usr/lib/systemd/user/Suno-semantic-broker.service
systemd-analyze verify /usr/lib/systemd/user/Suno-semantic-broker.service

python3 - <<'PY'
import gi

gi.require_version("SunoSemantics", "1")
gi.require_version("SunoUI", "1")
from gi.repository import SunoSemantics, SunoUI

root = SunoSemantics.SemanticObject.new(
    "installed-acceptance", "application", "Installed acceptance"
)
root.add_action(SunoSemantics.Action.new("accept", "Accept"))
wire = root.to_variant()
assert wire.lookup_value("id", None).get_string() == "installed-acceptance"

activity = SunoSemantics.LiveExtension.new(
    "acceptance.activity",
    "org.projectSuno.Calendar",
    SunoSemantics.LiveCategory.EVENT,
    "Acceptance event",
)
activity.set_expires_at("2026-08-28T12:00:00+00:00")
assert activity.to_variant().lookup_value("expires_at", None).get_string()

context = SunoUI.Context.new_from_environment()
assert context is not None
print("Installed Suno GIR/typelib acceptance passed")
PY

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT INT TERM

XDG_STATE_HOME="$work_dir/state" dbus-run-session -- bash -eu -c '
  /usr/libexec/Suno-semantic-broker &
  broker_pid=$!
  trap '\''kill "$broker_pid" >/dev/null 2>&1 || true'\'' EXIT
  for attempt in $(seq 1 40); do
    if gdbus introspect --session \
      --dest org.projectSuno.SemanticBroker1 \
      --object-path /org/projectSuno/SemanticBroker1 \
      >"$1/introspection.txt" 2>/dev/null; then
      break
    fi
    sleep 0.05
  done
  grep -Fq org.projectSuno.SemanticBroker1 "$1/introspection.txt"
  grep -Fq RequestAccess "$1/introspection.txt"
  grep -Fq InvokeAction "$1/introspection.txt"
  grep -Fq RegisterLiveExtension "$1/introspection.txt"
  grep -Fq ListLiveExtensions "$1/introspection.txt"
  grep -Fq LiveExtensionsChanged "$1/introspection.txt"
' _ "$work_dir"
printf 'Installed Semantic Broker startup and introspection acceptance passed\n'

XDG_STATE_HOME="$work_dir/inspector-state" dbus-run-session -- bash -eu -c '
  /usr/libexec/Suno-semantic-broker &
  broker_pid=$!
  trap '\''kill "$broker_pid" >/dev/null 2>&1 || true'\'' EXIT
  for attempt in $(seq 1 40); do
    # This lane deliberately owns a private dbus-run-session rather than a
    # graphical systemd user session. Exercise the already-managed inner CLI;
    # the real standardized app-scope transition is covered by unit tests and
    # the interactive installed-RPM acceptance lane.
    if SUNO_SEMANTIC_INSPECTOR_MANAGED=1 \
      Suno semantic list >"$1/inspector.json" 2>/dev/null; then
      exit 0
    fi
    sleep 0.05
  done
  exit 1
' _ "$work_dir"
python3 - "$work_dir/inspector.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as stream:
    assert json.load(stream) == []
print("Installed SDK Semantic Inspector broker acceptance passed")
PY

set +e
timeout 3s xvfb-run -a dbus-run-session -- \
  /usr/libexec/Suno-semantic-consent access \
  --client 'Acceptance Agent' --target Notes --scopes observe-public \
  >"$work_dir/consent.log" 2>&1
consent_status=$?
set -e
if [ "$consent_status" -ne 124 ]; then
  cat "$work_dir/consent.log" >&2
  printf 'error: broker-owned consent UI exited unexpectedly: %s\n' \
    "$consent_status" >&2
  exit 1
fi
printf 'Installed Semantic Broker consent UI acceptance passed\n'

Suno new Acceptance --id org.projectSuno.Acceptance --destination "$work_dir/app"
Suno lint "$work_dir/app/Suno-app.toml"
Suno inspect "$work_dir/app/Suno-app.toml" >/dev/null

set +e
timeout 6s xvfb-run -a dbus-run-session -- "$work_dir/app/run-app" \
  >"$work_dir/app.log" 2>&1
app_status=$?
set -e

if [ "$app_status" -ne 124 ]; then
  cat "$work_dir/app.log" >&2
  printf 'error: generated application exited unexpectedly: %s\n' "$app_status" >&2
  exit 1
fi

printf 'Installed Suno SDK generated-application acceptance passed\n'
