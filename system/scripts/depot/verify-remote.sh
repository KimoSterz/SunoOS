#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Verify the Suno remote the way a client will see it, before it is synced.
#
# A throwaway Flatpak installation adds the remote from the generated
# Suno.flatpakrepo (so the inline key is what verifies), pointed at the local
# repository instead of the CDN, and lists every ref. Flatpak refuses an
# unsigned or wrongly signed summary, so success means the summary signature,
# the key in Suno.flatpakrepo and the ref list agree. Each app ref's commit
# signature is then checked with ostree against the same key.
#
#   verify-remote.sh [REPO_URL]    (default: file:// URL of the local repo)
set -euo pipefail
. "$(dirname -- "$0")/lib.sh"

site="$DEPOT_ROOT/site"
url=${1:-file://$depot_repo}
check_dir="$DEPOT_ROOT/work/verify-remote"

depot_in_signer bash -s -- "$site" "$url" "$check_dir" "$depot_repo" <<'SH'
set -euo pipefail
site=$1 url=$2 check=$3 repo=$4
rm -rf "$check"
mkdir -p "$check"
export FLATPAK_USER_DIR="$check/flatpak"
sed "s#^Url=.*#Url=$url#" "$site/Suno.flatpakrepo" >"$check/Suno.flatpakrepo"
flatpak remote-add --user --if-not-exists Suno "$check/Suno.flatpakrepo"
flatpak remote-ls --user --all --arch='*' --columns=ref Suno | sort >"$check/refs"
test -s "$check/refs"
cat "$check/refs"

# Commit signatures, ref by ref, against the key published in keys/
ostree init --mode=bare-user --repo="$check/sigcheck" >/dev/null
ostree remote add --repo="$check/sigcheck" --set=gpg-verify=true \
  --gpg-import="$site/keys/Suno-depot.gpg" check "$url" >/dev/null
while read -r ref; do
  ostree pull --repo="$check/sigcheck" --commit-metadata-only check "$ref" >/dev/null
done < <(ostree --repo="$repo" refs | grep -E '^(app|runtime)/')
rm -rf "$check"
echo "remote verified: summary and commit signatures match keys/Suno-depot.gpg"
SH
