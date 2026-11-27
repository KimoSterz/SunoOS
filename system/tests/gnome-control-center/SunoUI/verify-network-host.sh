#!/bin/sh
# Host Python supplies the unchanged upstream private fake NM service.
# GTestDBus creates/reaps its own bus via the approved noninstalled helper.
set -eu
test "$#" -eq 1
binary=$1
test -x "$binary"
export SUNO_SETTINGS_HOST_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"
private_dir=$(mktemp -d "${TMPDIR:-/tmp}/Suno-settings-network-host.XXXXXX")
trap 'rm -rf -- "$private_dir"' EXIT
mkdir -m 700 "$private_dir/runtime"
mkdir "$private_dir/config" "$private_dir/data" "$private_dir/cache" "$private_dir/state"
export XDG_RUNTIME_DIR="$private_dir/runtime"
export XDG_CONFIG_HOME="$private_dir/config" XDG_DATA_HOME="$private_dir/data"
export XDG_CACHE_HOME="$private_dir/cache" XDG_STATE_HOME="$private_dir/state"
export GSETTINGS_BACKEND=memory GIO_USE_VFS=local
mkdir "$private_dir/bin"
cat > "$private_dir/bin/dbus-daemon" <<'EOF'
#!/bin/sh
# Toolbox lookup uses the normal host environment; the forwarded daemon
# receives only GTestDBus's private config/socket arguments.
exec env -u XDG_CONFIG_HOME -u XDG_DATA_HOME -u XDG_CACHE_HOME \
  -u XDG_STATE_HOME -u LD_LIBRARY_PATH \
  -u DBUS_SESSION_BUS_ADDRESS -u DBUS_SYSTEM_BUS_ADDRESS \
  XDG_RUNTIME_DIR="$SUNO_SETTINGS_HOST_RUNTIME_DIR" \
  /var/home/nick/Documents/SunoDesign/overseer/host-tools/dbus-daemon "$@"
EOF
chmod 700 "$private_dir/bin/dbus-daemon"
export PATH="$private_dir/bin:$PATH"
export LD_LIBRARY_PATH=/var/home/nick/.local/share/Suno-dev/SunoUI-settings/kit-prefix/lib64
export DBUS_SYSTEM_BUS_ADDRESS="unix:path=$private_dir/no-system-bus"
unset DBUS_SESSION_BUS_ADDRESS DISPLAY WAYLAND_DISPLAY SUNO_SETTINGS_FIXTURE
unset SUNO_SETTINGS_APPLICATION_ID APP_ID APPLICATION_ID
python3 -c 'import dbus.service'
"$binary"
