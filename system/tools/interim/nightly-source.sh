#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# nightly-source.sh SHA [SOURCE_ROOT]: the nightly's source checkout from the interim repo.
# Creates SOURCE_ROOT/main-<sha8> (default: the canonical root's source/ directory, where
# every control script reads CAN/source/main-<sha8>) as a clean checkout of SHA from
# /srv/dev-storage/git/luma.git, which must have SHA on its main. Its origin points at the
# interim repo, so later fetches never reach GitHub. Prints the checkout path.
# Then, in the night's control dir: preflight with --artifacts (see the nightly runbook).
set -euo pipefail
REPO=${LUMA_INTERIM_REPO:-/srv/dev-storage/git/luma.git}
sha=$(git -C "$REPO" rev-parse --verify "${1:?usage: nightly-source.sh SHA [SOURCE_ROOT]}^{commit}")
root=${2:-/srv/luma-build/os-recovery-20261009/fs/source}
git -C "$REPO" merge-base --is-ancestor "$sha" refs/heads/main || { echo "nightly-source: ${sha:0:8} is not on interim main" >&2; exit 1; }
S=$root/main-${sha:0:8}
if [ -e "$S" ]; then
  [ "$(git -C "$S" rev-parse HEAD)" = "$sha" ] && [ -z "$(git -C "$S" status --porcelain)" ] \
    || { echo "nightly-source: $S exists and is not a clean checkout of ${sha:0:8}" >&2; exit 1; }
else
  umask 022
  git clone -q --no-checkout "$REPO" "$S.tmp"
  git -C "$S.tmp" -c advice.detachedHead=false checkout -q --detach "$sha"
  mv "$S.tmp" "$S"
fi
echo "$S"
