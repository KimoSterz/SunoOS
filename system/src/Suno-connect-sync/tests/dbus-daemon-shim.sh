#!/bin/sh
# Test-only: a dbus-daemon from another image with its own libdbus and session.conf (the CI image has none).
args=""
for a in "$@"; do
  if [ "$a" = "--session" ]; then args="$args --config-file=/x/session.conf"; else args="$args $a"; fi
done
LD_LIBRARY_PATH=/x exec /x/dbus-daemon $args
