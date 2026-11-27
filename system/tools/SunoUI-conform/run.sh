#!/bin/sh
# SunoUI-conform: does a SunoUI app match the v70 design? See README.md.
#   tools/SunoUI-conform/run.sh <app> [--theme dark|light] [--phone] [--spec-only] [--compare-only DIR] [--pixel PNGDIR]
#   tools/SunoUI-conform/run.sh <app> --all      (the gate: dark, light, dark phone, light phone)
# SUNOUI_CONFORM_HOST: server (default: the whole run on the build server, this
# worktree sent over ssh), thinkpad (spec here, GTK on the ThinkPad, one at a
# time) or local (everything on this machine; what the server's container runs).
# Writes the report and images to ~/Suno/handoffs/SunoUI-port/conform/<app>/<timestamp>-<theme>[-phone]/
# and exits 0 on PASS, 1 on FAIL, 2+ when it could not run.
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo=${SUNOUI_CONFORM_REPO:-$(git -C "$here" rev-parse --show-toplevel)}
[ $# -ge 1 ] || { sed -n '2,10p' "$0" >&2; exit 2; }
app=$1; shift
route=${SUNOUI_CONFORM_HOST:-server}
case "$route" in
  server)
    # The whole run happens on the build server (conform-client.sh sends this worktree).
    case " $* " in *" --compare-only "*) ;; *)
      exec bash "$here/conform-client.sh" "$app" "$@" --worktree "$repo" \
        --out "${SUNOUI_CONFORM_OUT:-$HOME/Suno/handoffs/SunoUI-port/conform}" ;;
    esac ;;
  thinkpad|local) ;;
  *) echo "SunoUI-conform: SUNOUI_CONFORM_HOST is server, thinkpad or local" >&2; exit 2 ;;
esac
export SUNOUI_CONFORM_HOST=$route
if [ "${1:-}" = --all ]; then
  shift
  status=0
  for variant in "--theme dark" "--theme light" "--theme dark --phone" "--theme light --phone"; do
    # shellcheck disable=SC2086
    sh "$0" "$app" $variant "$@" || status=1
  done
  [ $status = 0 ] && echo "SunoUI-conform $app: PASS in light, dark and phone" || echo "SunoUI-conform $app: FAIL (see the reports above)"
  exit $status
fi
theme=dark phone= spec_only= compare_only= pixel=
while [ $# -gt 0 ]; do
  case "$1" in
    --theme) theme=$2; shift ;;
    --phone) phone=1 ;;
    --spec-only) spec_only=1 ;;
    --compare-only) compare_only=$2; shift ;;
    --pixel) pixel=$2; shift ;;
    *) echo "SunoUI-conform: unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
case "$theme" in dark|light) ;; *) echo "SunoUI-conform: --theme is dark or light" >&2; exit 2 ;; esac
scenario=$here/scenarios/$app.json
[ -f "$scenario" ] || { echo "SunoUI-conform: no scenario $scenario" >&2; exit 2; }

if [ -n "$compare_only" ]; then
  out=$compare_only
else
  stamp=${SUNOUI_CONFORM_STAMP:-$(date +%Y%m%d-%H%M%S)}
  out=${SUNOUI_CONFORM_OUT:-$HOME/Suno/handoffs/SunoUI-port/conform}/$app/$stamp-$theme${phone:+-phone}
  mkdir -p "$out"
  reference_hit=
  if [ -n "${SUNOUI_CONFORM_REFERENCE_CACHE:-}" ] && [ -n "${SUNOUI_CONFORM_REFERENCE_IDENTITY:-}" ]; then
    if python3 "$here/server/reference-cache.py" restore --cache "$SUNOUI_CONFORM_REFERENCE_CACHE" \
      --identity "$SUNOUI_CONFORM_REFERENCE_IDENTITY" --out "$out"; then reference_hit=1; fi
  fi
  if [ -z "$reference_hit" ]; then
    node "$here/spec_capture.js" --scenario "$scenario" --theme "$theme" ${phone:+--phone} --out "$out" || { echo "SunoUI-conform: the spec capture failed" >&2; exit 3; }
  fi
  [ -n "$spec_only" ] && { echo "spec only: $out"; exit 0; }
  # Pixel mode: the caller's PNGs stand in for the GTK capture; no element matching.
  [ -n "$pixel" ] && exec node "$here/pixel_compare.js" --scenario "$scenario" --dir "$out" --pngs "$pixel" --deviations "$here/accepted-deviations.json"
  sh "$here/gtk_capture.sh" "$scenario" "$out" "$theme" "$repo" || { echo "SunoUI-conform: the GTK capture failed" >&2; exit 3; }
fi
node "$here/compare.js" --scenario "$scenario" --dir "$out" --deviations "$here/accepted-deviations.json"
