#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# sandbox.sh APP-ID COMMAND...: COMMAND as a Flatpak would run it. A sandbox
# with APP-ID's /.flatpak-info, reaching the session bus only through
# xdg-dbus-proxy, itself sandboxed with the same file (as flatpak run does).
set -eu
app=$1; shift
dir=$(mktemp -d /tmp/tvr-sandbox.XXXXXX)
printf '[Application]\nname=%s\n' "$app" > "$dir/info"
root=(--ro-bind /usr /usr --ro-bind /etc /etc --symlink usr/lib /lib --symlink usr/lib64 /lib64
      --symlink usr/bin /bin --symlink usr/sbin /sbin --proc /proc --dev /dev --bind /tmp /tmp
      --ro-bind "${TVR_SOURCE:-/source}" "${TVR_SOURCE:-/source}" --ro-bind "$dir/info" /.flatpak-info --die-with-parent)
bwrap "${root[@]}" xdg-dbus-proxy "$DBUS_SESSION_BUS_ADDRESS" "$dir/bus" --filter \
  --own="$app" --talk=org.projectluma.Shell.Remote &
for _ in $(seq 1 50); do [ -S "$dir/bus" ] && break; sleep 0.1; done
exec bwrap "${root[@]}" --setenv DBUS_SESSION_BUS_ADDRESS "unix:path=$dir/bus" "$@"
