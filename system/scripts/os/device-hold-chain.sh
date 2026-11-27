#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# device-hold-chain.sh: per-device update holds around a shared ARM publish.
#
#   device-hold-chain.sh prepare --arch A --channel C --release VERSION --check TARGET=OKFILE...
#       Before the OS publish: for every device check whose OKFILE does not exist yet, hold TARGET on the
#       channel's current newest release, so the release is never served to that device class unheld.
#   device-hold-chain.sh resign --arch A --channel C
#       Render, sign and serve the channel graph with the current holds (graph_from_releases.py,
#       sign-update-graph.sh --no-sync, stage-webroot.sh --keep 1, sync-to-cdn.sh --apply --only graph).
#   device-hold-chain.sh wait --arch A --channel C --release VERSION --check TARGET=OKFILE... [--hours H]
#       After the publish: as each OKFILE appears, lift TARGET through VERSION and resign. A check still
#       pending after H hours (default 24) stays held; the next publish keeps it on its last good release.
#
# One ARM OS commit serves every ARM device; a device-specific check (Fairphone 6 audio, a modem, a camera)
# holds only that device class. Run with the publication environment (SUNO_OS_ROOT, keys, SUNO_OS_ARCH,
# SUNO_OS_PROFILE) as for publish-channel.sh. --lock FILE serializes with the graph refresher (flock).
# Logs '== <time> ...' lines; ends DEVICE-HOLDS-<PHASE>-DONE, or DEVICE-HOLDS-FAILED.
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
phase=${1:-}; shift || true
arch= channel= release= hours=24 lock= checks=()
while [ $# -gt 0 ]; do
  case $1 in
    --arch) arch=${2:?}; shift 2 ;;
    --channel) channel=${2:?}; shift 2 ;;
    --release) release=${2:?}; shift 2 ;;
    --check) checks+=("${2:?}"); shift 2 ;;
    --hours) hours=${2:?}; shift 2 ;;
    --lock) lock=${2:?}; shift 2 ;;
    *) echo "usage: $0 prepare|resign|wait --arch A --channel C [--release V] [--check TARGET=OKFILE]... [--hours H] [--lock F]" >&2; exit 2 ;;
  esac
done
log() { echo "== $(date -u +%FT%TZ) $*"; }
die() { log "DEVICE-HOLDS-FAILED: $*"; exit 1; }
[ -n "$arch" ] && [ -n "$channel" ] && [ -n "${SUNO_OS_ROOT:-}" ] || die "--arch, --channel and SUNO_OS_ROOT are required"
repo=$SUNO_OS_ROOT/publish/public-repo
hold_cli() { python3 "$here/device-hold.py" "$@" --arch "$arch" --channel "$channel" --root "$SUNO_OS_ROOT"; }
newest() {
  python3 - "$repo" "$arch" "$channel" "$here/lib" <<'PY'
import glob, json, sys
repo, arch, channel, lib = sys.argv[1:]
sys.path.insert(0, lib)
from desktop_paths import releases_path
from update_graph import version_key
v = [m["version"] for m in (json.load(open(p)) for p in glob.glob(str(releases_path(repo, arch) / "*" / "manifest.json")))
     if m.get("channel") == channel and not m.get("hardware_target")]
print(max(v, key=version_key) if v else "")
PY
}
resign() {
  local src=${TMPDIR:-/tmp}/device-hold-graph-$arch-$channel.json
  [ -z "$lock" ] || { exec 9>"$lock"; flock -w 600 9 || die "graph refresh lock busy"; }
  python3 "$here/lib/graph_from_releases.py" "$repo" "$channel" "$arch" > "$src" || die "graph render"
  python3 -c 'import json,sys; g=json.load(open(sys.argv[1])); [print("  ", r["version"], ",".join(h["hardware_target"] for h in r.get("device_holds", [])) or "-") for r in g["releases"][-3:]]' "$src"
  bash "$here/sign-update-graph.sh" --arch "$arch" --profile "$SUNO_OS_PROFILE" --channel "$channel" --source "$src" --no-sync || die "graph sign"
  bash "$here/stage-webroot.sh" --keep 1 | tail -1 || die "stage-webroot"
  bash "$here/sync-to-cdn.sh" --apply --only graph | tail -1 || die "sync graph"
  [ -z "$lock" ] || flock -u 9
  log "graph served with holds: $(hold_cli show | tr -d '\n ' | cut -c1-300)"
}
split() { target=${1%%=*}; ok=${1#*=}; [ -n "$target" ] && [ "$ok" != "$1" ] || die "--check wants TARGET=OKFILE, got $1"; }

case $phase in
prepare)
  [ -n "$release" ] || die "--release is required"
  good=$(newest); [ -n "$good" ] || die "no published $channel release to hold on"
  [ "$good" != "$release" ] || die "$release is already published; prepare runs before the publish"
  for c in "${checks[@]}"; do
    split "$c"
    if [ -e "$ok" ]; then log "$target check passed ($ok): no hold"; continue; fi
    hold_cli hold --target "$target" --good-through "$good" --reason "$target check pending for $release" ||
      die "hold $target"
    log "$target held on $good until $ok"
  done
  log "DEVICE-HOLDS-PREPARE-DONE" ;;
resign)
  resign; log "DEVICE-HOLDS-RESIGN-DONE" ;;
wait)
  [ -n "$release" ] || die "--release is required"
  [ "$(newest)" = "$release" ] || die "$release is not the newest published $channel release"
  pending=()
  for c in "${checks[@]}"; do split "$c"; hold_cli show | grep -q "\"$target\"" && pending+=("$c"); done
  deadline=$(( $(date +%s) + hours * 3600 ))
  while [ ${#pending[@]} -gt 0 ] && [ "$(date +%s)" -lt $deadline ]; do
    left=()
    for c in "${pending[@]}"; do
      split "$c"
      if [ -e "$ok" ]; then
        hold_cli lift --target "$target" --passed "$release" || die "lift $target"
        log "$target check passed: lifted through $release"; resign
      else left+=("$c"); fi
    done
    pending=("${left[@]+"${left[@]}"}")
    [ ${#pending[@]} -gt 0 ] && sleep 60
  done
  for c in "${pending[@]+"${pending[@]}"}"; do split "$c"; log "$target still held after ${hours} h (no $ok)"; done
  log "DEVICE-HOLDS-WAIT-DONE" ;;
*) die "unknown phase '$phase'" ;;
esac
