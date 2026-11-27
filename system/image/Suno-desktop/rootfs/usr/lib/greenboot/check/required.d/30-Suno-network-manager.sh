#!/usr/bin/bash
# SPDX-License-Identifier: Apache-2.0
# Suno health check (ADR-030 section 6): NetworkManager is running and answers
# on the system bus. Connectivity is deliberately not required: a machine that
# boots offline is healthy and must not roll back.
set -euo pipefail
# greenboot 0.16 restarts the computer whenever a required check fails, update
# or not, so this check enforces only on the trial boots of a newly finalized
# deployment (Suno-update's helper, docs/os/Suno-update.md) and reports without
# failing on every other boot.
. /usr/lib/Suno-update/Suno-greenboot-common.sh
timeout=${SUNO_HEALTH_NETWORK_TIMEOUT:-120}
deadline=$(($(Suno_uptime) + timeout))
while [ "$(Suno_uptime)" -lt "$deadline" ]; do
  if systemctl is-active --quiet NetworkManager.service &&
     state=$(timeout 15 busctl --system --timeout=10 get-property \
       org.freedesktop.NetworkManager /org/freedesktop/NetworkManager \
       org.freedesktop.NetworkManager State 2>/dev/null); then
    printf 'Suno: NetworkManager is running (state %s)\n' "${state#u }"
    exit 0
  fi
  systemctl is-failed --quiet NetworkManager.service && break
  sleep 2
done
systemctl status NetworkManager.service --no-pager --lines=20 >&2 || true
Suno_check_failed 'Suno: NetworkManager is not running or does not answer on D-Bus'
