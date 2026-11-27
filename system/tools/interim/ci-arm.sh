#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# ci-arm.sh COMMIT [JOB...]: run the aarch64 jobs that tools/interim/ci.py left pending
# for COMMIT, natively in the Mac's Lima VM (Suno-fold-arm; never qemu on Suno-build),
# and record them on Suno-build. Run it on the Mac from a checkout with the `interim`
# remote. Each job: fresh checkout in the VM, the workflow's pinned aarch64 Fedora
# image, the same job script as on Suno-build; artifacts stream to
# Suno-build:/srv/dev-storage/projects/Suno-interim/artifacts/COMMIT/ (no Mac disk).
set -euo pipefail
VM=${SUNO_INTERIM_ARM_VM:-Suno-fold-arm}
MIN_GIB=${SUNO_INTERIM_ARM_MIN_GIB:-6}
SSH=(ssh -i ~/.ssh/Suno_lab_ed25519 -o IdentitiesOnly=yes Suno-build)
ART=/srv/dev-storage/projects/Suno-interim/artifacts
TOOLS=/srv/dev-storage/projects/Suno-interim/tools/tools/interim
HERE=$(cd "$(dirname "$0")" && pwd)
commit=${1:?usage: ci-arm.sh COMMIT [JOB...]}; shift
commit=$("${SSH[@]}" "git -C /srv/dev-storage/git/Suno.git rev-parse --verify '$commit^{commit}'")
say() { echo "$(date -u +%FT%TZ) $*"; }
vm() { limactl shell "$VM" -- "$@"; }

record=$("${SSH[@]}" "cat $ART/$commit/ci.json")
jobs=("$@")
if [ ${#jobs[@]} = 0 ]; then
  while read -r name; do [ -n "$name" ] && jobs+=("$name"); done < <(python3 -c 'import json,sys; r=json.loads(sys.stdin.read())
for j in r["jobs"]:
    if j["arch"]=="aarch64" and j.get("result",{}).get("status")=="pending": print(j["name"])' <<< "$record")
fi
[ ${#jobs[@]} -gt 0 ] || { say "no pending aarch64 jobs for ${commit:0:8}"; exit 0; }
say "${#jobs[@]} aarch64 job(s) for ${commit:0:8}: ${jobs[*]}"

free=$(vm df -BG --output=avail / | tail -1 | tr -dc 0-9)
[ "$free" -ge "$MIN_GIB" ] || { say "REFUSED: $VM has ${free} GiB free, needs $MIN_GIB (free VM disk or set SUNO_INTERIM_ARM_MIN_GIB)"; exit 3; }

# Source: push the commit into a bare repo in the VM (incremental after the first run).
git fetch -q interim "$commit"
vm bash -c 'test -d ~/interim/Suno.git || git init -q --bare ~/interim/Suno.git; mkdir -p ~/interim/tools ~/interim/gh-cache ~/interim/work ~/interim/out'
GIT_SSH_COMMAND="ssh -F $HOME/.lima/$VM/ssh.config" git push -q -f "lima-$VM:interim/Suno.git" "$commit:refs/heads/ci"
# Tools and the offline gh cache (the aarch64 toolkit archive, not the x86 one).
"${SSH[@]}" "tar -C $TOOLS -c ci.py gh sync-noop" | vm bash -c 'tar -C ~/interim/tools -x'
# Only what aarch64 jobs read: every snapshot except the x86_64 toolkit archives.
"${SSH[@]}" "cd /srv/dev-storage/projects/Suno-interim/cache/gh/ && python3 -c 'import json,glob,os
skip=set()
for f in glob.glob(\"*_actions_artifacts_[0-9]*\"):
    if not f.endswith(\"_zip\") and json.load(open(f)).get(\"name\")==\"desktop-toolkit-x86_64\": skip.add(f+\"_zip\")
print(\"\\n\".join(sorted(set(os.listdir(\".\"))-skip)))' | tar -c -T -" | vm bash -c 'tar -C ~/interim/gh-cache -x'
printf '%s' "$record" | vm bash -c 'cat > ~/interim/ci.json'
# An interim toolkit cohort the commit pins (config/os/desktop-toolkit-cohort.json "interim"): its
# aarch64 run directory, read-only in the jobs as on Suno-build, for the admission to verify.
vm bash -c 'rm -rf ~/interim/toolkit && mkdir -p ~/interim/toolkit'
cohort=$("${SSH[@]}" "git -C /srv/dev-storage/git/Suno.git show '$commit:config/os/desktop-toolkit-cohort.json'" 2>/dev/null \
  | python3 -c 'import json,sys; print((json.load(sys.stdin).get("interim") or {}).get("commit", ""))' 2>/dev/null || true)
if [ -n "$cohort" ]; then
  "${SSH[@]}" "cd $ART/$cohort && tar -c ci.json toolkit-cohort-aarch64.json desktop-toolkit-aarch64" | vm bash -c "mkdir -p ~/interim/toolkit/$cohort && tar -C ~/interim/toolkit/$cohort -x"
  say "interim toolkit cohort ${cohort:0:8} (aarch64) copied to the VM"
fi

# The workflow's pinned aarch64 image (rootless podman in the VM).
image=$(python3 -c 'import json,sys; r=json.loads(sys.stdin.read()); print(sorted({j["image"] for j in r["jobs"] if j["arch"]=="aarch64" and j["kind"]=="build"})[0])' <<< "$record")
vm podman image exists "$image" || vm podman pull -q "$image"
rc=0
for job in "${jobs[@]}"; do
  free=$(vm df -BG --output=avail / | tail -1 | tr -dc 0-9)
  [ "$free" -ge "$MIN_GIB" ] || { say "STOPPED: $VM down to ${free} GiB free before $job"; rc=3; break; }
  say "$job ..."
  vm bash -c "rm -rf ~/interim/out/* && cd ~ && SUNO_INTERIM_WORK=~/interim/work SUNO_INTERIM_GH_CACHE=~/interim/gh-cache SUNO_INTERIM_ARTIFACTS=~/interim/toolkit \
    python3 -I ~/interim/tools/ci.py exec-job --record ~/interim/ci.json --job '$job' \
    --origin ~/interim/Suno.git --work ~/interim/work --out ~/interim/out" || rc=1
  vm bash -c 'tar -C ~/interim/out -c .' | "${SSH[@]}" "mkdir -p $ART/$commit/.arm-in && tar -C $ART/$commit/.arm-in -x"
  joblog=$(printf '%s' "$job" | tr -c 'A-Za-z0-9_.-' '_').log
  # A job whose script never started (podman or VM trouble) stays pending instead of failing CI.
  "${SSH[@]}" "cd $ART/$commit && mv .arm-in/result.json .arm-result.json && cp -a .arm-in/. . && rm -rf .arm-in && \
    if grep -q '^::step' logs/$joblog; then \
      python3 -I $TOOLS/ci.py record --commit $commit --job '$job' --result .arm-result.json --by 'ci-arm.sh ($VM)' | tail -1; \
    else echo 'INFRA: job script never started; left pending'; tail -3 logs/$joblog; fi; rm -f .arm-result.json"
  vm bash -c 'podman unshare rm -rf ~/interim/out/* ~/interim/work/*'
  say "$job done"
done
vm podman image prune -f > /dev/null 2>&1 || true
exit $rc
