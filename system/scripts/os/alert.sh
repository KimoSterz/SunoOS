#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Alert that a pipeline unit failed. Run by Suno-os-alert@.service, which
# Suno-os-nightly.service and Suno-os-media.service name in OnFailure=, so a
# failed nightly or a medium that did not pass its release-blocking checks is
# reported without anyone watching.
#
#   alert.sh UNIT
#
# 1. Appends one JSON line to $SUNO_OS_ROOT/status/alerts.jsonl and writes
#    $SUNO_OS_ROOT/status/alert-latest.json: the unit, when, the failed build
#    and the error from the unit's status file (nightly.json or
#    media-<channel>.json), never a credential.
# 2. Logs the same at priority "alert" (journalctl -p alert).
# 3. When $SUNO_OS_SECRETS/alert.env names ALERT_WEBHOOK_URL_FILE (a root-only
#    file holding one HTTPS URL), POSTs the JSON there; the URL never appears
#    in argv or logs.

set -uo pipefail
. "$(dirname -- "$0")/lib/common.sh"
unit=${1:?usage: alert.sh UNIT}
case "$unit" in
  Suno-os-nightly|Suno-os-nightly.service) status_file="$SUNO_OS_ROOT/status/nightly.json" ;;
  Suno-os-media|Suno-os-media.service) status_file=$(ls -t "$SUNO_OS_ROOT"/status/media-*.json 2>/dev/null | head -n 1) ;;
  *) status_file= ;;
esac
install -d -m 0755 "$SUNO_OS_ROOT/status"
alert=$(python3 - "$unit" "${status_file:-}" <<'PY'
import datetime, json, os, sys
unit, status_file = sys.argv[1], sys.argv[2]
status = {}
if status_file and os.path.exists(status_file):
    try:
        status = json.load(open(status_file))
    except ValueError:
        status = {}
print(json.dumps({
    "schema": "org.projectSuno.os-alert/v1",
    "unit": unit,
    "at_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "build_id": status.get("build_id"),
    "state": status.get("state"),
    "error": status.get("error") or "the unit failed before recording an error (see its journal)",
    "log": status.get("log"),
    "host": os.uname().nodename,
}, sort_keys=True))
PY
)
printf '%s\n' "$alert" >>"$SUNO_OS_ROOT/status/alerts.jsonl"
printf '%s\n' "$alert" >"$SUNO_OS_ROOT/status/alert-latest.json.new" && mv -f "$SUNO_OS_ROOT/status/alert-latest.json.new" "$SUNO_OS_ROOT/status/alert-latest.json"
logger -p user.alert -t Suno-os-alert -- "$alert"

url_file=
[ -f "$SUNO_OS_SECRETS/alert.env" ] && url_file=$(sed -n 's/^ALERT_WEBHOOK_URL_FILE=//p' "$SUNO_OS_SECRETS/alert.env" | tail -n 1)
if [ -n "$url_file" ] && [ -r "$url_file" ]; then
  url=$(head -n 1 "$url_file")
  if [[ "$url" =~ ^https:// ]]; then
    printf 'url = "%s"\n' "$url" | curl -fsS --max-time 30 -K - -H 'Content-Type: application/json' --data-binary @- \
      >/dev/null 2>&1 <<<"$alert" || logger -p user.err -t Suno-os-alert -- 'the alert webhook did not accept the alert'
  fi
fi
exit 0
