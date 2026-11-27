#!/bin/sh
# Launch the staged Disks preview without enabling real-device writes.
set -eu
preview_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
export PYTHONPATH="$preview_dir/python:$preview_dir/src/Suno-disks"
export SUNO_APPKIT_ICON_PATH="$preview_dir/python/icons"
unset SUNO_DISKS_FIXTURE SUNO_DISKS_SELECTED_DRIVE SUNO_DISKS_SELECTED_VOLUME SUNO_DISKS_VIEW
export SUNO_DISKS_ALLOW_WRITES=0
exec python3 -m Suno_disks "$@"
