#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Build the Suno-disks RPM; see build-Suno-python-app.sh.
exec "$(dirname -- "$0")/build-Suno-python-app.sh" Suno-disks "$@"
