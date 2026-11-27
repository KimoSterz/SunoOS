#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Publish a gate-passing build to its channel (ADR-030 sections 3 to 5).
#
#   publish-channel.sh --build-id YYYYMMDD.N [--dry-run]
#
# Refuses unless: the build is clean; its gate result is "pass" for exactly
# this candidate commit; the gate proved the update from the channel's current
# head and the automatic and manual rollbacks (or the channel is empty, which
# makes this its first release); and the candidate's parent is still the
# channel head. Then the signed candidate is copied into the channel
# repository, deltas are generated, the ref moves, the summary is signed, a
# fresh client verifies it, and the release manifest, provenance, SBOM, gate
# record and package list are written beside the release in the repository
# (Suno/releases/<version>/), the manifest signed with the release key.
#
# Publication writes the local staging repositories only; the served copy is
# switched by scripts/os/stage-webroot.sh and scripts/os/sync-to-cdn.sh.

set -euo pipefail
. "$(dirname -- "$0")/lib/common.sh"
. "$(dirname -- "$0")/lib/channel.sh"

build_id=
dry_run=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --build-id) build_id=${2:?}; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    *) printf 'usage: %s --build-id ID [--dry-run]\n' "$0" >&2; exit 2 ;;
  esac
done

Suno_os_require_root
Suno_os_require_tools ostree gpg python3 flock
Suno_os_check_host

build_dir="$SUNO_OS_ROOT/builds/$build_id"
for file in build.env export.env gate-result.json provenance.json sbom.spdx.json packages-installed.tsv os-release; do
  [ -s "$build_dir/$file" ] || Suno_os_die "build is missing $file: $build_dir"
done
Suno_os_load_build_env "$build_dir/build.env"
Suno_os_load_env "$build_dir/export.env"
channel=$SUNO_OS_CHANNEL
ref=$SUNO_EXPORT_REF
[ "$ref" = "$(Suno_os_channel_ref "$channel")" ] || Suno_os_die 'exported ref differs from the selected build architecture/channel'
candidate=$SUNO_EXPORT_CANDIDATE
candidate_repo="$SUNO_OS_ROOT/ostree/candidate-repo"
repo=$(Suno_os_channel_repo "$channel")

[ "$SUNO_SOURCE_DIRTY" = false ] || Suno_os_die 'refusing to publish a build from a dirty source checkout'
[ -z "${SUNO_SOURCE_SNAPSHOT_SHA256:-}" ] && [ -z "${SUNO_RELEASE_CHECKS_SHA256:-}" ] || Suno_os_die 'refusing to publish a private source snapshot'

Suno_os_publication_lock
Suno_os_init_channel_repo "$repo"
if [ "$SUNO_OS_ARCH" = aarch64 ]; then
  ostree refs --repo="$repo" | grep -q "^Suno/$SUNO_OS_MAJOR/x86_64/" ||
    Suno_os_die 'ARM publication requires the canonical shared repository with its existing x86 refs; import the candidate into that workflow'
fi
protected_refs=$(ostree refs --repo="$repo" | while IFS= read -r other; do
  # Collection summary regeneration advances this shared metadata ref.
  [ "$other" = "$ref" ] || [ "$other" = ostree-metadata ] || \
    printf '%s %s\n' "$other" "$(ostree rev-parse --repo="$repo" "$other")"
done)
head=$(Suno_os_channel_head "$repo" "$ref")

if python3 - "$build_dir/gate-result.json" <<'PY'
import json, sys
sys.exit(0 if json.load(open(sys.argv[1])).get('schema') == 'org.projectSuno.targeted-desktop-gate/v1' else 1)
PY
then
  python3 "$Suno_os_repo_root/scripts/os/lib/targeted_desktop_gate.py" \
    --gate "$build_dir/gate-result.json" --candidate "$candidate" --previous "${head:-}" \
    --architecture "$SUNO_OS_ARCH" \
    --provenance-sha256 "$(sha256sum "$build_dir/provenance.json" | cut -d' ' -f1)" \
    >/dev/null || Suno_os_die 'targeted desktop qualification does not allow publication'
else
python3 - "$build_dir/gate-result.json" "$candidate" "${head:-}" <<'PY' || Suno_os_die 'the gate result does not allow publication'
import json, sys
gate = json.load(open(sys.argv[1], encoding="utf-8"))
candidate, head = sys.argv[2], sys.argv[3]
problems = []
if gate.get("commit") != candidate:
    problems.append(f"gate tested {gate.get('commit')}, not {candidate}")
if gate.get("result") != "pass":
    problems.append(f"gate result is {gate.get('result')}")
if gate.get("fresh") != "pass":
    problems.append(f"fresh install stage is {gate.get('fresh')}")
if gate.get("no_account") != "pass":
    problems.append(f"no-account install stage is {gate.get('no_account')}")
if head:
    if (gate.get("previous_commit") or "") != head:
        problems.append(f"gate updated from {gate.get('previous_commit')}, but the channel head is {head}")
    for stage in ("update", "rollback"):
        if gate.get(stage) != "pass":
            problems.append(f"{stage} stage is {gate.get(stage)} and the channel already has releases")
else:
    for stage in ("update", "rollback"):
        if gate.get(stage) not in ("pass", "not-applicable"):
            problems.append(f"{stage} stage is {gate.get(stage)}")
for problem in problems:
    print("error: " + problem, file=sys.stderr)
sys.exit(1 if problems else 0)
PY
fi

parent=$(ostree rev-parse --repo="$candidate_repo" "$candidate^" 2>/dev/null || true)
[ "$parent" = "$head" ] ||
  Suno_os_die "candidate parent ${parent:-none} is not the channel head ${head:-none}; re-export and re-gate"

version=$SUNO_OS_VERSION
release_dir="$(Suno_os_releases_path "$repo")/$version"
[ ! -e "$release_dir" ] || Suno_os_die "release metadata already exists: $release_dir"

if [ "$dry_run" -eq 1 ]; then
  printf 'would publish %s as %s on %s in %s\n' "$candidate" "$version" "$ref" "$repo"
  printf '  parent: %s\n' "${head:-none (first release of the channel)}"
  Suno_os_delta_plan "$candidate_repo" "$candidate" | sed 's/^/  delta: /'
  exit 0
fi

Suno_os_check_space 15
Suno_os_gpg_unlock
trap Suno_os_gpg_lock EXIT

Suno_os_log "copying $candidate into $repo"
ostree pull-local --repo="$repo" --untrusted "$candidate_repo" "$candidate" >/dev/null
deltas=$(Suno_os_advance_channel "$repo" "$ref" "$candidate" | tail -n 1)

while read -r other expected; do
  [ -z "$other" ] || [ "$(ostree rev-parse --repo="$repo" "$other")" = "$expected" ] ||
    Suno_os_die 'publication changed another architecture/channel ref'
done <<<"$protected_refs"

published=$(date -u +%Y-%m-%dT%H:%M:%SZ)
install -d -m 0755 "$release_dir"
cp "$build_dir/provenance.json" "$build_dir/sbom.spdx.json" "$build_dir/gate-result.json" \
  "$build_dir/os-release" "$release_dir/"
cut -f1-5 "$build_dir/packages-installed.tsv" >"$release_dir/packages.tsv"
# The exact Suno pin set, which the next release's notes are checked against.
cp "$build_dir/Suno-packages.manifest" "$release_dir/Suno-packages.manifest"
root_dirtree=$(python3 "$Suno_os_repo_root/scripts/os/lib/ostree_metadata.py" root-dirtree "$repo" "$candidate")
python3 "$Suno_os_repo_root/scripts/os/lib/provenance.py" manifest \
  --output "$release_dir/manifest.json" \
  --version "$version" --channel "$channel" --ref "$ref" \
  --commit "$candidate" --parent "$head" --root-dirtree "$root_dirtree" \
  --provenance "$build_dir/provenance.json" --gate "$build_dir/gate-result.json" \
  --deltas "$deltas" --published "$published"
for file in manifest.json provenance.json sbom.spdx.json gate-result.json; do
  Suno_os_sign_file "$release_dir/$file"
done
# The channel's latest release metadata, for installers and Switchboard.
channel_metadata="$(Suno_os_arch_path "$repo/Suno/channels")"
install -d -m 0755 "$channel_metadata"
cp "$release_dir/manifest.json" "$channel_metadata/$channel.json"
Suno_os_sign_file "$channel_metadata/$channel.json"
install -D -m 0644 "$SUNO_OS_KEYS/Suno-os-release.gpg" "$repo/Suno/keys/Suno-os-release.gpg"
install -D -m 0644 "$SUNO_OS_KEYS/Suno-os-release.asc" "$repo/Suno/keys/Suno-os-release.asc"

cat >"$build_dir/publish.env" <<EOF
SUNO_PUBLISH_CHANNEL=$channel
SUNO_PUBLISH_REF=$ref
SUNO_PUBLISH_COMMIT=$candidate
SUNO_PUBLISH_PARENT=$head
SUNO_PUBLISH_VERSION=$version
SUNO_PUBLISH_UTC=$published
EOF
Suno_os_log "published $version ($candidate) on $ref"
printf '%s\n' "$candidate"
