#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# The Continue banner in every state of its design (ADR-055; design-center
# mockups/continue), captured from a headless Suno Shell (patches/
# gnome-shell 0395) in dark and light mode: OUTDIR/<state>-<mode>.png and
# banner-<mode>.json with each part's geometry.
#
#   run.sh OUTDIR
#   POSTURE=phone run.sh OUTDIR   the phone forms: lip card offer and
#                                  restoring, the result drawer (400x860)
#   POSTURE=tv run.sh OUTDIR      the TV home's hero (1920x1080); ART=file.jpg
#                                 gives the item artwork (a JPEG under 96 KB)
set -euo pipefail
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
out=$1
rm -rf "$out/runtime" "$out/config"
mkdir -p "$out/runtime" "$out/config/glib-2.0/settings" "$out/data/applications"
posture=${POSTURE:-desktop}
monitor=1920x1080; driver=driver.js
[ "$posture" = desktop ] || driver=driver-forms.js
[ "$posture" = phone ] && monitor=400x860
# Tablet: landscape 1280x800; TABLET=portrait for 800x1280.
[ "$posture" = tablet ] && monitor=$([ "${TABLET:-}" = portrait ] && echo 800x1280 || echo 1280x800)
# DRIVER=depot: the Depot icon lookup, with its own home and cache.
depot_env=()
if [ "${DRIVER:-}" = depot ]; then
  driver=driver-depot.js; MODES=${MODES:-dark}
  depot_env=(HOME="$out/home" XDG_CACHE_HOME="$out/cache")
fi
# The TV's own TV apps: Tide, with a TV presentation (X-Suno-TV).
cat >"$out/data/applications/org.projectSuno.Tide.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Tide
Icon=org.projectSuno.Tide
Exec=true
X-Suno-TV=true
DESKTOP
chmod 0700 "$out/runtime"
# Phone and TV: the presentation needs the screen shield, which the Shell
# builds only with logind and GDM there: their stand-in on the system bus.
logind=
if [ "$posture" != desktop ]; then
  mkdir -p /run/systemd/seats
  python3 "$here/../session-restore/fake-logind.py" --log "$out/logind.log" & logind=$!
  sleep 2
fi
for mode in ${MODES:-dark light}; do
  scheme=$([ "$mode" = dark ] && echo prefer-dark || echo prefer-light)
  # The conform backdrops: #808080 for light, the reference's dark desktop for dark.
  backdrop=$([ "$mode" = dark ] && echo '#0f1218' || echo '#808080')
  # A phone lip card is the dark lip material in both modes, over #0f1218.
  case $posture in phone|tablet) backdrop='#0f1218' ;; esac
  cat >"$out/config/glib-2.0/settings/keyfile" <<KEYFILE
[org/gnome/shell]
welcome-dialog-last-shown-version='999'

[org/gnome/desktop/interface]
enable-animations=false
font-name='Figtree 11'
color-scheme='$scheme'
icon-theme='Prairie'

[org/gnome/desktop/background]
picture-uri=''
picture-uri-dark=''
picture-options='none'
color-shading-type='solid'
primary-color='$backdrop'
KEYFILE
  # The reference's clock: about 16:20 local, so 14:20 today reads "2 h ago".
  utc=$(date -u +%H:%M); off=$(( 16 * 60 + 20 - (10#${utc%:*} * 60 + 10#${utc#*:}) ))
  (( off > 720 )) && off=$(( off - 1440 )); (( off <= -720 )) && off=$(( off + 1440 ))
  sign=-; (( off < 0 )) && { sign=+; off=$(( -off )); }
  tz=$(printf 'SUNO%s%02d:%02d' "$sign" $(( off / 60 )) $(( off % 60 )))
  env -u DISPLAY -u WAYLAND_DISPLAY TZ="$tz" "${depot_env[@]}" \
    XDG_RUNTIME_DIR="$out/runtime" XDG_CONFIG_HOME="$out/config" XDG_DATA_HOME="$out/data" \
    GSETTINGS_BACKEND=keyfile LIBGL_ALWAYS_SOFTWARE=1 GTK_A11Y=none NO_AT_BRIDGE=1 \
    SUNO_BANNER_OUT="$out" SUNO_BANNER_MODE="$mode" SUNO_BANNER_POSTURE="$posture" SUNO_BANNER_ART="${ART:-}" \
    dbus-run-session -- timeout 180 gnome-shell --headless --virtual-monitor "$monitor" \
      --automation-script="$here/$driver" >"$out/shell-$posture-$mode.log" 2>&1 || :
done
[ -n "$logind" ] && kill "$logind"
ls "$out"/*.png | wc -l
