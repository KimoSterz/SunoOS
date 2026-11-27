#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Suno-portal, as D-Bus activates it in run.sh's session: from LOCK_PORTAL
# (a source tree's src/Suno-platform/portal) when set, else installed.
if [ -n "${LOCK_PORTAL:-}" ]; then
  export PYTHONPATH=$LOCK_PORTAL
fi
exec python3 -c 'from Suno_portal.service import main; raise SystemExit(main())' \
  >>"${LOCK_OUT:-/tmp}/Suno-portal.log" 2>&1
