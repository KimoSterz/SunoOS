#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# merge-branch.sh [--pr N] [--arm-later] [--checks-only] [--full] [--detach] [--resume MERGE] BRANCH
#
# Merge queue on luma-build for gitlab.com/simplyluma/luma (source of truth since
# 2026-11-26). gitlab-sync.sh pulls GitLab branches into the interim repo; its
# post-receive hook pushes main and tags back to GitLab, which marks the MR merged.
# --pr N is the GitLab merge request number (!N). Merges BRANCH of the
# interim repo (/srv/dev-storage/git/luma.git) into its main with a merge commit
# (never a squash, so toolkit pins stay ancestors) and the rules GitHub enforced.
# Releases are assigned at merge (docs/decisions/056-release-at-merge.md): on the
# merge commit, scripts/os/release-at-merge.py commit writes main's release plus
# one for every package the change touched (spec, @RELEASE@ changelogs, pins,
# SUPPORTED_INSTALLER_RELEASE) as a release commit. That release commit is what
# CI builds and what main moves to, so the pinned RPMs are exactly the ones built.
#   1. releases: release-at-merge.py check --base main --head MERGE (the change
#      leaves assignable releases to the merge)
#   2. tests/smoke/package-release-contract.sh (pins, specs, fragments, and
#      scripts/os/lib/release_notes.py validate)
#   3. toolkit admission: when the change touches scripts/os/admit-desktop-toolkit.py
#      or the toolkit cohort's inputs, the cohort must still admit on both CPUs
#   4. tools/interim/ci.py on the merge commit: Source checks plus the package
#      builds the change selects. Branches run this in parallel; only moving main
#      is serialized (see Phase A/B below). x86_64 runs here; aarch64 jobs run in the Mac's
#      ARM VM (ci-arm.sh MERGE). Without --arm-later every aarch64 job must have
#      passed before main moves; with it the merge lands and the ARM jobs stay
#      listed as owed in merged.tsv until ci-arm.sh records them.
# Refuses on any failure, on conflicts, and on branches in deny-branches.
# The merge commit waits at refs/interim/merge/BRANCH until main is moved.
set -euo pipefail
unset XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS
[ "${LUMA_VIA_GITLAB:-}" = 1 ] || { echo "REFUSED: merges moved to GitLab - open a merge request at https://gitlab.com/simplyluma/luma/-/merge_requests and use its merge job" >&2; exit 1; }
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${LUMA_INTERIM_REPO:-/srv/dev-storage/git/luma.git}
ROOT=/srv/dev-storage/projects/luma-interim
WORK=${LUMA_INTERIM_WORK:-/srv/ssd-build/interim-ci}
ART=${LUMA_INTERIM_ARTIFACTS:-$ROOT/artifacts}
NAME="Nick McMillen" EMAIL=153555205+nmcmil@users.noreply.github.com  # the identity agents commit with
pr= arm_later=0 checks_only=0 detach=0 resume= full=0
args=("$@")
while [ $# -gt 0 ]; do
  case "$1" in
    --pr) pr=$2; shift 2 ;;
    --arm-later) arm_later=1; shift ;;
    --checks-only) checks_only=1; shift ;;
    --full) full=1; shift ;;          # GitHub's complete build selection (see ci.py)
    --detach) detach=1; shift ;;
    --resume) resume=$2; shift 2 ;;   # continue an already built merge commit (after ci-arm.sh or a stop)
    -*) echo "unknown option $1" >&2; exit 2 ;;
    *) break ;;
  esac
done
[ -x "$ROOT/gitlab-sync.sh" ] && "$ROOT/gitlab-sync.sh" >/dev/null 2>&1 || true
branch=${1:?usage: merge-branch.sh [--pr N] [--arm-later] [--checks-only] [--detach] BRANCH}
say() { echo "$(date -u +%FT%TZ) $*"; }
die() { say "REFUSED: $*"; exit 1; }
[ -d "$REPO" ] && mountpoint -q /srv/dev-storage || die "run on luma-build (no $REPO)"
grep -qxF "$branch" "$HERE/deny-branches" 2>/dev/null && die "$branch is on tools/interim/deny-branches"
[ -e "$ROOT/FROZEN" ] && die "interim merges are frozen ($ROOT/FROZEN: GitHub re-sync)"

if [ $detach = 1 ]; then
  log=$ROOT/logs/merge-$(printf '%s' "$branch" | tr '/' '_')-$(date -u +%Y%m%dT%H%M%SZ).log
  rest=(); for a in "${args[@]}"; do [ "$a" = --detach ] || rest+=("$a"); done
  (systemd-run --scope --quiet --unit="luma-interim-merge-$(date +%s)" \
     setsid nohup "$0" "${rest[@]}" > "$log" 2>&1 < /dev/null &) > /dev/null 2>&1
  echo "$log"; exit 0
fi

# Phase A runs per branch, in parallel with other branches: merge commit, rules, CI (hours for
# package builds). Phase B takes the global lock only to move main. If main moved meanwhile, the
# branch is merged again onto the new main, rules and Source checks rerun on that merge, and the
# package builds of the first merge are reused (GitHub, too, merges on checks from an older base).
exec 7> "$ROOT/locks/branch-$(printf '%s' "$branch" | tr '/' '_').lock"
flock -n 7 || die "another merge-branch.sh is running for $branch"
umask 022
W=$WORK/merge-$$; rm -rf "$W"; mkdir -p "$W"; trap 'rm -rf "$W"' EXIT
git clone -q --no-checkout "$REPO" "$W/src"; cd "$W/src"
git -c advice.detachedHead=false checkout -q -B main origin/main
head=$(git rev-parse --verify -q "origin/$branch^{commit}") || die "no branch $branch in $REPO (push it: git push interim $branch)"
git merge-base --is-ancestor "$head" origin/main && die "$branch (${head:0:8}) is already in main"
title="Merge branch '$branch' into 'main'"
export GIT_AUTHOR_NAME="$NAME" GIT_COMMITTER_NAME="$NAME" GIT_AUTHOR_EMAIL="$EMAIL" GIT_COMMITTER_EMAIL="$EMAIL"
podman image exists localhost/luma-interim-ci:2 || nice -n 10 ionice -c3 podman build -q -t localhost/luma-interim-ci:2 -f "$HERE/Containerfile" "$HERE"

merge_onto() { # merge_onto MAIN: the branch merged onto MAIN and its release commit, checked out
  git -c advice.detachedHead=false checkout -q --detach "$1"
  git merge -q --no-ff --no-edit -m "$title" -m "$([ -n "$pr" ] && echo "See merge request simplyluma/luma!$pr" || echo "Branch head ${head:0:12}")" "$head" \
    || { git merge --abort || true; die "merge conflict with main ${1:0:8}: rebase $branch onto interim main"; }
  [ -f scripts/os/release-at-merge.py ] || return 0
  python3 -B scripts/os/release-at-merge.py commit > "$W/release.log" 2>&1 \
    || { cat "$W/release.log"; die "no release at merge for $(git rev-parse --short HEAD)"; }
  sed 's/^/  /' "$W/release.log"
  cohort_onto
}

# A release that moves a toolkit package needs its cohort: built by ci.py toolkit from the
# release commit (x86_64 here, aarch64 by ci-arm.sh), pinned on top in
# config/os/desktop-toolkit-cohort.json. A cohort built for an earlier merge of this branch is
# kept when the toolkit sources are unchanged (admission compares content). With --arm-later
# the x86_64 cohort is pinned alone and the aarch64 one stays owed.
cohort=
cohort_onto() {
  local rel; rel=$(git rev-parse HEAD)
  [ "$(git log -1 --format=%ae)" = interim-release@luma-build.invalid ] || return 0
  git diff --name-only HEAD^ HEAD | grep -qE '^(packaging/rpm/(luma-developer-platform|google-figtree-fonts)\.spec|patches/(gtk4|libadwaita)/0000-luma-fedora-spec\.patch)$' || return 0
  if [ -n "$cohort" ] && python3 -B -c 'import sys; sys.path.insert(0, "scripts/os/lib"); import package_releases as pr
sys.exit(1 if any(pr.toolkit_differences(".", sys.argv[1], {})) else 0)' "$cohort"; then
    say "toolkit sources unchanged since cohort ${cohort:0:8}; keeping it"
  else
    cohort=$rel
    LUMA_INTERIM_MERGE= git push -q -f origin "$rel:refs/interim/cohort/$branch"
    if [ -f "$ART/$rel/ci.json" ]; then
      say "toolkit cohort run for ${rel:0:8} exists; using it"
    else
      say "toolkit release: building its cohort from ${rel:0:8}"
      python3 -I "$HERE/ci.py" toolkit --commit "$rel" > "$W/toolkit.log" 2>&1 || true
    fi
  fi
  local flags=(--commit "$cohort" --write config/os/desktop-toolkit-cohort.json)
  [ $arm_later = 1 ] && flags+=(--partial)
  python3 -I "$HERE/ci.py" cohort-pin "${flags[@]}" > "$W/cohort.log" 2>&1 \
    || { cat "$W/cohort.log"; tail -20 "$W/toolkit.log" 2>/dev/null; die "toolkit cohort ${cohort:0:8} not pinnable (aarch64: tools/interim/ci-arm.sh ${cohort:0:12}, or pass --arm-later)"; }
  GIT_AUTHOR_NAME="Luma interim release" GIT_AUTHOR_EMAIL=interim-release@luma-build.invalid \
  GIT_COMMITTER_NAME="Luma interim release" GIT_COMMITTER_EMAIL=interim-release@luma-build.invalid \
    git commit -q -a -m "ci: admit the interim toolkit cohort (${cohort:0:12})" \
      -m "Release-through: $(git log -1 --format=%B "$rel" | sed -n 's/^Release-through: //p')"
  say "toolkit cohort ${cohort:0:8} pinned: $(cat "$W/cohort.log")"
}

merge_of() { # merge_of COMMIT: the merge commit (COMMIT, or the merge under its release and cohort commits)
  local c; c=$(git rev-parse "$1")
  while [ "$(git log -1 --format=%ae "$c")" = interim-release@luma-build.invalid ]; do c=$(git rev-parse "$c^1"); done
  echo "$c"
}

rules() { # rules BASE MERGE: rules 1-3 in the pinned Fedora image the Source checks use
  local base=$1 merge=$2 toolkit=0 changed
  local change; change=$(merge_of "$merge")
  changed=$(git diff --name-only "$base" "$merge")
  grep -qE '^(scripts/os/admit-desktop-toolkit.py|config/os/desktop-toolkit-cohort.json|scripts/os/lib/package_releases.py|config/os/desktop-toolkit-provider-driver-equivalence.json|scripts/os/build-desktop-toolkit.sh|scripts/packages/build-(gtk4|libadwaita|luma-developer-platform|figtree-fonts).sh|patches/(gtk4|libadwaita)/|src/luma-platform/|packaging/rpm/(luma-developer-platform|google-figtree-fonts).spec)' <<< "$changed" && toolkit=1
  grep -qE '^(GTK4|LIBADWAITA|FIGTREE|LUMA_DEVELOPER_PLATFORM)_' <(git diff "$base" "$merge" -- config/desktop/inputs.env | sed -n 's/^[-+]//p') && toolkit=1
  podman run --rm --security-opt label=disable --pull=never -v "$W:$W" -w "$W/src" \
    -v "$HERE/gh:/opt/interim-gh/gh:ro" -v "$HERE/sync-noop:/opt/interim-gh/sync:ro" -v "$ROOT/cache/gh:/opt/interim-gh/cache:ro" \
    -v "$ART:/opt/interim-artifacts:ro" -e LUMA_INTERIM_TOOLKIT=/opt/interim-artifacts \
    -e LUMA_INTERIM_GH_CACHE=/opt/interim-gh/cache -e PATH=/opt/interim-gh:/usr/bin:/bin -e TOOLKIT=$toolkit \
    -e BASE="$base" -e HEAD_REV="$change" localhost/luma-interim-ci:2 bash -c '
      set -uo pipefail; git config --global --add safe.directory "*"; fail=0
      step() { echo "== $1"; shift; if "$@"; then echo "PASS rule"; else echo "FAIL rule"; fail=1; fi; }
      if [ -f scripts/os/release-at-merge.py ]; then
        step "releases assigned at merge (release-at-merge.py check)" python3 -B scripts/os/release-at-merge.py check --base "$BASE" --head "$HEAD_REV"
      else
        step "release bumps (source-release-bump.py)" python3 -B scripts/os/source-release-bump.py check --base "$BASE" --head "$HEAD_REV"
      fi
      step "package release contract + release notes validate" bash tests/smoke/package-release-contract.sh
      step "release notes validate" python3 scripts/os/lib/release_notes.py validate --repo .
      if [ "$TOOLKIT" = 1 ]; then
        for arch in x86_64 aarch64; do
          # An interim cohort pinned for x86_64 alone (--arm-later): the aarch64 one is owed.
          if python3 -c "import json,sys; p=json.load(open(\"config/os/desktop-toolkit-cohort.json\")).get(\"interim\"); sys.exit(0 if p and \"$arch\" not in p[\"records\"] else 1)"; then
            echo "== toolkit admission ($arch)"; echo "OWED rule: no interim $arch cohort pinned yet"; continue
          fi
          step "toolkit admission ($arch)" python3 scripts/os/admit-desktop-toolkit.py --architecture $arch --output /tmp/toolkit-$arch
        done
      fi
      exit $fail' > "$W/rules.log" 2>&1 || true
  grep -E '^(==|PASS|FAIL)' "$W/rules.log" | grep -v '^PASS  ' || true
  grep -q '^FAIL' "$W/rules.log" && { tail -40 "$W/rules.log"; die "merge rules failed on ${merge:0:8}"; }
  say "merge rules pass on ${merge:0:8} (toolkit admission: $([ $toolkit = 1 ] && echo checked || echo 'not touched'))"
}

verdict() { # verdict MERGE: refuse unless CI allows main to move; sets owed
  local status x86_owed
  status=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status","?"))' "$ART/$1/ci.json")
  owed=$(python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print(",".join(j["name"] for j in r["jobs"] if j.get("result",{}).get("status")=="pending"))' "$ART/$1/ci.json")
  x86_owed=$(tr ',' '\n' <<< "$owed" | grep -v '/aarch64$' | grep -c . || true)
  case "$status" in
    pass) ;;
    pending)
      [ "$x86_owed" = 0 ] || die "CI pending on luma-build jobs: $owed"
      [ $checks_only = 1 ] && { say "CHECKS-ONLY: ${1:0:8} checks and x86_64 package builds (with %check) pass; aarch64 owed: $owed; main not moved"; exit 0; }
      [ $arm_later = 1 ] || die "aarch64 jobs owed ($owed). Run tools/interim/ci-arm.sh ${1:0:12} on the Mac, then merge-branch.sh --resume ${1:0:12} $branch; or pass --arm-later" ;;
    *) die "CI $status for ${1:0:8} (record: $ART/$1/ci.json)" ;;
  esac
}

# Phase A, then Phase B; when main moved meanwhile, Phase A again on the new main, reusing the
# builds that main's own changes cannot have affected.
first=
# Reuse the package builds of this branch's last checks run when its head is unchanged.
if [ $checks_only = 0 ] && [ -z "$resume" ] && git fetch -q origin "refs/interim/merge/$branch" 2>/dev/null; then
  prev=$(git rev-parse FETCH_HEAD)
  if [ -f "$ART/$prev/ci.json" ] && [ "$(git rev-parse "$(merge_of "$prev")^2" 2>/dev/null)" = "$head" ]; then
    first=$prev; say "reusing package builds of ${prev:0:8} (last checks run of ${head:0:8})"
  fi
fi
while :; do
  if [ -n "$resume" ]; then
    merge=$(git rev-parse --verify -q "$resume^{commit}") || { git fetch -q origin "refs/interim/merge/$branch"; merge=$(git rev-parse FETCH_HEAD); }
    [ "${merge:0:${#resume}}" = "$resume" ] || die "no merge commit $resume (refs/interim/merge/$branch is ${merge:0:8})"
    [ "$(git rev-parse "$(merge_of "$merge")^2")" = "$head" ] || die "$branch moved since ${merge:0:8} was built; merge again"
    git -c advice.detachedHead=false checkout -q --detach "$merge"
    base=$(git rev-parse "$(merge_of "$merge")^1"); resume=
  else
    [ -n "${base:-}" ] || base=$(git rev-parse origin/main)
    merge_onto "$base"; merge=$(git rev-parse HEAD)
  fi
  say "main ${base:0:8}, $branch ${head:0:8}, merge commit ${merge:0:8}$([ "$(merge_of "$merge")" = "$merge" ] || echo " (release commit over $(git rev-parse --short=8 "$(merge_of "$merge")"))") ($(git diff --name-only "$base" "$merge" | wc -l) files)"
  rules "$base" "$merge"
  LUMA_INTERIM_MERGE= git push -q -f origin "$merge:refs/interim/merge/$branch"
  # checks (--checks-only) also builds the touched packages on x86_64, so their %check runs
  # before the merge; only main stays put.
  ciargs=(--commit "$merge" --base "$base"); [ $full = 1 ] && ciargs+=(--full)
  [ -f "$ART/$merge/ci.json" ] && ciargs+=(--continue)
  [ -n "$first" ] && ciargs+=(--reuse-builds "$first")
  python3 -I "$HERE/ci.py" run "${ciargs[@]}" || true
  verdict "$merge"
  [ $checks_only = 1 ] && { say "CHECKS-ONLY: ${merge:0:8} passed; main not moved"; exit 0; }

  # Phase B
  exec 8> "$ROOT/locks/merge.lock"
  flock -w 7200 8 || die "main lock busy for 2 h"
  [ -e "$ROOT/FROZEN" ] && die "interim merges are frozen ($ROOT/FROZEN: GitHub re-sync)"
  git fetch -q origin main
  now=$(git rev-parse FETCH_HEAD)
  [ "$now" = "$base" ] && break
  exec 8>&-
  say "main moved ${base:0:8} -> ${now:0:8}; merging again, reusing unaffected builds of ${merge:0:8}"
  first=$merge base=$now
done
# Move main (the repo's hook accepts only this path, and only fast-forward).
LUMA_INTERIM_MERGE=1 git push -q origin "$merge:refs/heads/main" || die "main push refused"
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$merge" "$branch" "$head" "${pr:--}" "${owed:-none}" >> "$ROOT/merged.tsv"
# Keep the server tools checkout on main.
[ -d "$ROOT/tools/.git" ] && git -C "$ROOT/tools" pull -q --ff-only origin main || true
say "MERGED $branch as ${merge:0:8} on interim main${owed:+ (ARM owed: $owed)}"
