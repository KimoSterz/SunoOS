#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Build Atlas installer media that carry a channel's current release
# (ADR-030 section 9: staff media default to nightly and carry the payload).
#
#   build-staff-media.sh --atlas-source DIR --atlas-rpms DIR --output ISO
#                        [--channel nightly|beta]
#                        [--test-candidate BUILD_ID | --candidate BUILD_ID]
#                        [--preview-credential-file FILE]
#
# --preview-credential-file (nightly and beta) puts a root-only preview
# credential on the medium: Atlas writes the credential-checked repository URL
# into the installed system's root-only mirror list. The credential is never
# printed; the .release record, this build's log and Atlas's leak checks must
# not contain it, and the build fails if they do.
#
# --candidate builds the release medium from a build's exported, gated
# candidate before it is published, so a nightly's update and its medium can
# be published together (docs/os/release-process.md); the medium is the
# normal one and the .release record names candidate_build.
#
# --test-candidate builds TEST media from a build's exported candidate commit
# (signed by the release key, not published on the channel) for installer
# testing before the release has passed every gate stage: the volume id says
# TEST, and the .release record names the build and "test=true". Such media
# never go to anyone but the people testing the installer.
#
# 1. A payload repository is made from the channel head: the commit and its
#    content only (no deltas, no other refs), the Suno collection id, and a
#    summary signed with the Suno OS Release key, so the medium is exactly what
#    an online install of that release verifies.
# 2. The current OS tree's shared media builder composes the ISO with that
#    payload and the release public key as the only trust anchor. --atlas-source
#    identifies the Atlas application RPM's source separately: reusing an
#    unchanged frontend does not select obsolete architecture/kernel helpers.
# 3. The ISO's sha256 and the release it carries are written beside it.
#
# Everything is written below SUNO_OS_ROOT; containers use the pipeline's
# storage.

set -euo pipefail
. "$(dirname -- "$0")/lib/common.sh"

atlas=
rpms=
output=
channel=nightly
test_build=
candidate_build=
credential_file=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --arch) Suno_os_select_architecture "${2:?}"; shift 2 ;;
    --atlas-source) atlas=$(realpath "${2:?}"); shift 2 ;;
    --atlas-rpms) rpms=$(realpath "${2:?}"); shift 2 ;;
    --output) output=${2:?}; shift 2 ;;
    --channel) channel=${2:?}; shift 2 ;;
    --test-candidate) test_build=${2:?}; shift 2 ;;
    --candidate) candidate_build=${2:?}; shift 2 ;;
    --preview-credential-file) credential_file=$(realpath "${2:?}"); shift 2 ;;
    *) printf 'usage: %s --atlas-source DIR --atlas-rpms DIR --output ISO [--channel nightly|beta]\n' "$0" >&2; exit 2 ;;
  esac
done
[ -n "$atlas" ] && [ -n "$rpms" ] && [ -n "$output" ] || { printf 'missing arguments\n' >&2; exit 2; }
Suno_os_require_root
Suno_os_check_host
Suno_os_check_space 25
ref=$(Suno_os_channel_ref "$channel")
[ -z "$test_build" ] || [ -z "$candidate_build" ] || Suno_os_die '--test-candidate and --candidate exclude each other'
if [ -n "$test_build$candidate_build" ]; then
  Suno_os_load_build_env "$SUNO_OS_ROOT/builds/${test_build:-$candidate_build}/build.env"
  Suno_os_load_env "$SUNO_OS_ROOT/builds/${test_build:-$candidate_build}/export.env"
  boot_rpms="$SUNO_OS_ROOT/builds/${test_build:-$candidate_build}/packages/Packages"
  boot_manifest="$SUNO_OS_ROOT/builds/${test_build:-$candidate_build}/Suno-packages.manifest"
  source_repo="$SUNO_OS_ROOT/ostree/candidate-repo"
  head=$SUNO_EXPORT_CANDIDATE
  [ "$SUNO_EXPORT_REF" = "$ref" ] || Suno_os_die "build ${test_build:-$candidate_build} was exported for $SUNO_EXPORT_REF, not $ref"
  ostree show --repo="$source_repo" "$head" >/dev/null || Suno_os_die "candidate $head of ${test_build:-$candidate_build} is not in the candidate repository"
else
  source_repo=$(Suno_os_channel_repo "$channel")
  head=$(ostree rev-parse --repo="$source_repo" "$ref")
fi
version=$(python3 "$Suno_os_repo_root/scripts/os/lib/ostree_metadata.py" version "$source_repo" "$head")
if [ -z "$test_build$candidate_build" ]; then
  boot_rpms="$SUNO_OS_ROOT/rpms/pool"
  boot_manifest="$source_repo/Suno/releases/$version/Suno-packages.manifest"
fi
[ -f "$boot_manifest" ] || Suno_os_die "payload boot-package manifest missing: $boot_manifest"
media_builder="$Suno_os_repo_root/scripts/install/atlas-iso/build-installer-iso.sh"
kernel_config="$Suno_os_repo_root/config/install/atlas/runtime-kernel.env"
[ "$SUNO_OS_ARCH" = x86_64 ] || kernel_config="$Suno_os_repo_root/config/install/atlas/runtime-kernel-$SUNO_OS_ARCH.env"
. "$kernel_config"
if [ -n "$test_build$candidate_build" ]; then
  [ "$SUNO_EXPORT_KERNEL" = "$ATLAS_RUNTIME_KERNEL_NVR.$ATLAS_RUNTIME_KERNEL_ARCH" ] ||
    Suno_os_die "installer runtime kernel does not match payload: $ATLAS_RUNTIME_KERNEL_NVR.$ATLAS_RUNTIME_KERNEL_ARCH versus $SUNO_EXPORT_KERNEL"
fi
[ -d "$atlas/src/Suno-installer-atlas" ] || Suno_os_die "not an Atlas application source tree: $atlas"
[ -x "$media_builder" ] || Suno_os_die "OS media builder missing: $media_builder"

media_channel="$channel"
[ "$SUNO_OS_ARCH" = x86_64 ] || media_channel="$channel-$SUNO_OS_ARCH"
work="$SUNO_OS_ROOT/media/work-$media_channel"
payload="$SUNO_OS_ROOT/media/payload-$media_channel/repo"
rm -rf "$SUNO_OS_ROOT/media/payload-$media_channel"
install -d -m 0755 "$(dirname "$payload")" "$work" "$(dirname "$output")"
ostree init --repo="$payload" --mode=archive --collection-id="$SUNO_OS_COLLECTION_ID"
ostree pull-local --repo="$payload" "$source_repo" "$head" >/dev/null
ostree refs --repo="$payload" --create="$ref" "$head"
Suno_os_gpg_unlock
trap Suno_os_gpg_lock EXIT
ostree summary --repo="$payload" --update \
  --gpg-sign="$(Suno_os_gpg_fingerprint)" --gpg-homedir="$(Suno_os_gpg_home)"
Suno_os_gpg_lock
trap - EXIT
# Same check a device makes, with only the public key.
client=$(mktemp -d "$SUNO_OS_ROOT/tmp/media-verify.XXXXXX")
ostree init --repo="$client/repo" --mode=archive >/dev/null
ostree remote add --repo="$client/repo" --gpg-import="$SUNO_OS_KEYS/Suno-os-release.gpg" \
  --set=gpg-verify=true --set=gpg-verify-summary=true --collection-id="$SUNO_OS_COLLECTION_ID" \
  medium "file://$payload" "$ref"
ostree pull --repo="$client/repo" --commit-metadata-only medium "$ref" >/dev/null
[ "$(ostree rev-parse --repo="$client/repo" "medium:$ref")" = "$head" ] || Suno_os_die 'payload verification failed'
rm -rf "$client"
Suno_os_log "payload: $version ($head), $(du -sh "$payload" | awk '{ print $1 }')"

# Capture only this medium's selected repository. Shared candidate cache indexes
# are explicitly unusable as payload proof; their inode hashes are merely hints.
payload_body_index_sha=
if [ "${SUNO_OS_CAPTURE_PAYLOAD_BODIES:-0}" = 1 ]; then
  body_args=()
  if [ -n "${SUNO_EXPORT_BODY_INDEX_SHA256:-}" ] && [ -n "$test_build$candidate_build" ]; then
    body_args=(--previous "$SUNO_OS_ROOT/builds/${test_build:-$candidate_build}/payload-object-bodies.json"
               --previous-sha256 "$SUNO_EXPORT_BODY_INDEX_SHA256")
  fi
  body_source_revision=$(ostree show --repo="$source_repo" --print-metadata-key=org.projectSuno.source-revision "$head" | tr -d "'")
  payload_body_index_sha=$(python3 "$Suno_os_repo_root/scripts/install/atlas-iso/payload-object-reuse.py" \
    --repository "$payload" --output "$output.payload-index.json" \
    --source-revision "$body_source_revision" --candidate "$head" \
    --architecture "$SUNO_OS_ARCH" --profile "$SUNO_OS_PROFILE" --ref "$ref" "${body_args[@]}")
fi

credential_args=()
if [ -n "$credential_file" ]; then
  Suno_os_channel_is_preview "$channel" || Suno_os_die 'a preview credential is only for nightly and beta media'
  [ -r "$credential_file" ] && [ "$(stat -c %a "$credential_file")" = 600 ] ||
    Suno_os_die "preview credential file must be readable and mode 0600: $credential_file"
  credential_args=(--preview-credential-file "$credential_file")
fi

# The medium names the release it installs exactly as the release names itself
# (os-release PRETTY_NAME, ADR-040): boot menu titles and, for release media,
# the volume label ("Suno-Prairie-Beta-0-20260916"). Test media keep a TEST label.
display_name=$(ostree cat --repo="$source_repo" "$head" /usr/lib/os-release 2>/dev/null |
  sed -n 's/^PRETTY_NAME=//p' | tr -d '"' | tail -n 1)
case "$display_name" in "Suno ("*")") ;; *) display_name= ;; esac
media_args=()
[ -z "$display_name" ] || media_args+=(--display-name "$display_name")
[ -z "$test_build" ] || media_args+=(--volid "Suno-TEST-${channel^}-$SUNO_OS_ARCH")

CONTAINERS_STORAGE_CONF="$SUNO_OS_ROOT/etc/storage.conf" \
CONTAINERS_CONF="$SUNO_OS_ROOT/etc/containers.conf" \
TMPDIR="$SUNO_OS_ROOT/tmp" \
  "$media_builder" \
    --arch "$SUNO_OS_ARCH" --rpms "$rpms" --boot-rpms "$boot_rpms" --boot-manifest "$boot_manifest" \
    --work "$work" --output "$output" \
    --channel "$channel" --payload-repo "$payload" \
    --release-key "$SUNO_OS_KEYS/Suno-os-release.asc" \
    "${credential_args[@]}" "${media_args[@]}"

payload_bodies_receipt_sha=
if [ -n "$payload_body_index_sha" ]; then
  payload_bodies_receipt_sha=$(python3 "$Suno_os_repo_root/scripts/install/atlas-iso/verify-payload-bodies.py" \
    --iso "$output" --repository "$payload" \
    --body-index "$output.payload-index.json" --body-index-sha256 "$payload_body_index_sha" \
    --output "$output.payload-bodies.json")
fi
sha256sum "$output" | awk '{ print $1 }' >"$output.sha256"
cat >"$output.release" <<EOF
architecture=$SUNO_OS_ARCH
channel=$channel
ref=$ref
commit=$head
version=$version
atlas_source_revision=$(git -c "safe.directory=$atlas" -C "$atlas" rev-parse HEAD 2>/dev/null || echo unknown)
media_helpers_source_revision=$(git -c "safe.directory=$Suno_os_repo_root" -C "$Suno_os_repo_root" rev-parse HEAD 2>/dev/null || echo unknown)
payload_body_index_sha256=$payload_body_index_sha
payload_bodies_receipt_sha256=$payload_bodies_receipt_sha
release_key_fingerprint=$(Suno_os_gpg_fingerprint)
built_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
test=${test_build:+true}
test_build=$test_build
candidate_build=$candidate_build
EOF
preview_credential=${credential_file:+carried}
sed -i "s/^test_build=.*/&\npreview_credential=${preview_credential:-none}/" "$output.release"
if [ -n "$credential_file" ]; then
  # The sidecars and this job's own output must not carry the credential.
  secret=$(tr -d '\n' <"$credential_file")
  for file in "$output.release" "$output.sha256" "$output.media" "$work/logs"/* ${SUNO_OS_JOB_LOG:+"$SUNO_OS_JOB_LOG"}; do
    [ -f "$file" ] || continue
    if grep -Fq -- "$secret" "$file"; then
      unset secret
      Suno_os_die "the preview credential leaked into $file"
    fi
  done
  unset secret
fi
Suno_os_log "media: $output ($(cat "$output.sha256"))"
