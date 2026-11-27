#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Remove a candidate that did not pass its gate from the candidate repository,
# so no signed-but-unhealthy commit lingers anywhere. The build directory, its
# logs and gate evidence stay (scripts/os/prune.sh ages them out).
#
#   discard-candidate.sh --build-id YYYYMMDD.N

set -euo pipefail
. "$(dirname -- "$0")/lib/common.sh"

case "${1:-}" in
  --build-id) build_id=${2:?} ;;
  *) printf 'usage: %s --build-id ID\n' "$0" >&2; exit 2 ;;
esac
Suno_os_require_root
build_dir="$SUNO_OS_ROOT/builds/$build_id"
[ -s "$build_dir/export.env" ] || { Suno_os_log "no candidate for $build_id"; exit 0; }
Suno_os_load_env "$build_dir/export.env"
repo="$SUNO_OS_ROOT/ostree/candidate-repo"
channel_repo=$(Suno_os_channel_repo "$(sed -n 's/^SUNO_OS_CHANNEL=//p' "$build_dir/build.env")")
if [ -f "$channel_repo/config" ] && ostree show --repo="$channel_repo" "$SUNO_EXPORT_CANDIDATE" >/dev/null 2>&1 &&
   [ -s "$build_dir/publish.env" ]; then
  Suno_os_die "$SUNO_EXPORT_CANDIDATE is published; it cannot be discarded"
fi
exec 8>"$SUNO_OS_ROOT/locks/candidate-repo.lock"
flock -w 3600 8 || Suno_os_die 'candidate repository is locked'
if [ "$(ostree rev-parse --repo="$repo" "$SUNO_EXPORT_REF" 2>/dev/null || true)" = "$SUNO_EXPORT_CANDIDATE" ]; then
  if [ -n "$SUNO_EXPORT_PARENT" ] && ostree show --repo="$repo" "$SUNO_EXPORT_PARENT" >/dev/null 2>&1; then
    ostree refs --repo="$repo" --create="$SUNO_EXPORT_REF" --force "$SUNO_EXPORT_PARENT"
  else
    ostree refs --repo="$repo" --delete "$SUNO_EXPORT_REF"
  fi
fi
ostree prune --repo="$repo" --delete-commit="$SUNO_EXPORT_CANDIDATE" >/dev/null 2>&1 || true
ostree prune --repo="$repo" --refs-only >/dev/null
printf 'SUNO_DISCARDED_UTC=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$build_dir/export.env"
Suno_os_log "discarded candidate $SUNO_EXPORT_CANDIDATE of $build_id"
