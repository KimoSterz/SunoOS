#!/bin/sh
# Proposed native package check entry point; execute after host-build only.
# Private buses/display, memory settings and serial tests. Never compiles.
set -eu
if [ "$#" -ne 2 ]; then
  echo "Usage: verify-app.sh <meson-build-dir> <settings-v70.json>" >&2
  exit 2
fi
build_dir=$1
fixture=$2
test -f "$build_dir/meson-info/intro-tests.json"
test -f "$fixture"
test -x "$build_dir/shell/gnome-control-center"
private_dir=$(mktemp -d "${TMPDIR:-/tmp}/Suno-settings-check.XXXXXX")
trap 'rm -rf -- "$private_dir"' EXIT
mkdir "$private_dir/config" "$private_dir/data" "$private_dir/cache" "$private_dir/state"
mkdir -m 700 "$private_dir/runtime"
export XDG_RUNTIME_DIR="$private_dir/runtime"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
dbus-run-session --config-file="$script_dir/private-session.conf" -- xvfb-run -a -s '-screen 0 1280x1024x24' env \
  -u WAYLAND_DISPLAY -u SUNO_SETTINGS_FIXTURE -u SUNO_SETTINGS_APPLICATION_ID \
  -u SUNO_SETTINGS_PAGE -u SUNO_SETTINGS_QUERY -u SUNO_SETTINGS_VARIANT \
  -u SUNO_SETTINGS_SMOKE -u SUNO_SETTINGS_SMOKE_PHONE \
  -u APP_ID -u APPLICATION_ID \
  GDK_BACKEND=x11 GSK_RENDERER=cairo GTK_A11Y=none GSETTINGS_BACKEND=memory \
  XDG_CONFIG_HOME="$private_dir/config" XDG_DATA_HOME="$private_dir/data" \
  XDG_CACHE_HOME="$private_dir/cache" XDG_STATE_HOME="$private_dir/state" \
  DBUS_SYSTEM_BUS_ADDRESS="unix:path=$private_dir/no-system-bus" \
  SUNO_SETTINGS_TEST_FIXTURE="$fixture" \
  meson test -C "$build_dir" --no-rebuild --num-processes 1 \
    --logbase settings-integration-check --verbose --print-errorlogs \
    Suno-settings-fixture Suno-settings-view Suno-settings-search-locations \
    Suno-settings-audio Suno-settings-properties Suno-settings-preferences \
    Suno-settings-permissions Suno-settings-permission-view \
    Suno-settings-power-reads Suno-settings-applications \
    Suno-settings-identity Suno-settings-folder-portal Suno-settings-network
