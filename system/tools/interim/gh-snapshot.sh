#!/bin/bash
# gh-snapshot.sh [--toolkit REF] [API_PATH...]: run on a machine where `gh` can still read
# SimplyLuma/luma. Streams each `gh api` response into luma-build's offline cache
# (/srv/dev-storage/projects/luma-interim/cache/gh), which tools/interim/gh serves to
# CI jobs. --toolkit snapshots everything scripts/os/admit-desktop-toolkit.py reads for
# the toolkit cohort pinned at REF of the interim repo (main, or a branch that pins its
# own cohort run): run, artifacts, both archives, commits.
set -euo pipefail
SSH=(ssh -i ~/.ssh/luma_lab_ed25519 -o IdentitiesOnly=yes luma-build)
CACHE=/srv/dev-storage/projects/luma-interim/cache/gh
R=repos/SimplyLuma/luma
put() { # put API_PATH: stream one response into the cache
  local key; key=$(printf '%s' "${1#/}" | sed 's|[/?&=]|_|g')
  gh api "$1" | "${SSH[@]}" "cat > $CACHE/$key.part && mv $CACHE/$key.part $CACHE/$key"
  echo "cached $1"
}
paths=()
if [ "${1:-}" = --toolkit ]; then
  ref=${2:?--toolkit REF}; shift 2
  src=$("${SSH[@]}" "git -C /srv/dev-storage/git/luma.git show '$ref:scripts/os/admit-desktop-toolkit.py'")
  run=$(printf '%s\n' "$src" | sed -n 's/^run = \([0-9]*\)$/\1/p')
  [ -n "$run" ] || { echo "no pinned toolkit run found" >&2; exit 1; }
  paths+=("$R/actions/runs/$run" "$R/actions/runs/$run/artifacts?per_page=100")
  head=$(gh api "$R/actions/runs/$run" --jq .head_sha)
  paths+=("$R/git/commits/$head")
  for id in $(gh api "$R/actions/runs/$run/artifacts?per_page=100" --jq '.artifacts[]|select(.name|startswith("desktop-toolkit-"))|.id'); do
    paths+=("$R/actions/artifacts/$id" "$R/actions/artifacts/$id/zip")
  done
fi
paths+=("$@")
for p in "${paths[@]}"; do put "$p"; done
if [ -n "${run:-}" ]; then
  # A pull-request toolkit run built GitHub's test merge: admission also reads that commit.
  for id in $(gh api "$R/actions/runs/$run/artifacts?per_page=100" --jq '.artifacts[]|select(.name|startswith("desktop-toolkit-"))|.id'); do
    zip=$CACHE/$(printf '%s' "$R/actions/artifacts/$id/zip" | sed 's|[/?&=]|_|g')
    rev=$("${SSH[@]}" "python3 -c 'import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read(\"SOURCE-REVISION\").decode().strip())' $zip")
    [ "$rev" = "$head" ] || put "$R/git/commits/$rev"
  done
fi
