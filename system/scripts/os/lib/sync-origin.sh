# SPDX-License-Identifier: Apache-2.0
#
# Upload a switched webroot generation to the dl.simplyluma.com origin over
# rsync+SSH and verify what the origin serves. Run by scripts/os/sync-to-cdn.sh
# inside the pipeline tools container (read on stdin):
#
#   sync-origin.sh GENERATION APPLY PRUNE "PARTS" "MEDIA FILES"
#
# Environment: DL_RSYNC_DEST, DL_SSH_KEY, DL_HTTP_ORIGIN, DL_HOST_HEADER,
# KNOWN_HOSTS. Paths on the origin are relative to its web root.
#
# Order (standard OSTree mirroring): content-addressed objects and static
# deltas first, never overwritten; then configuration, refs and release
# metadata; the summary and its signatures last, in one transfer whose files
# are renamed into place together at its end (--delay-updates), so a client
# never reads a summary naming objects the origin does not have yet.
set -euo pipefail
generation=$1 apply=$2 prune=$3 parts=$4 media=$5
public_repo_destination=${DL_PUBLIC_REPO_DEST:-os/repo}
public_repo_link_destination=${DL_PUBLIC_REPO_LINK_DEST:-}
# Some maintained origins expose a legacy directory as the public repository.
# Keep the public URL stable and require an explicit, bounded hosting profile.
case "$public_repo_destination" in
  os/repo|os/preview-repo) ;;
  *) printf 'unsupported public repository destination\n' >&2; exit 2 ;;
esac
if [ -n "$public_repo_link_destination" ]; then
  [ "$public_repo_destination" = os/preview-repo ] && [ "$public_repo_link_destination" = /os/repo ] ||
    { printf 'unsupported public repository link destination\n' >&2; exit 2; }
fi
if [ "$public_repo_destination" = os/preview-repo ] && [[ " $parts " = *' preview '* ]]; then
  printf 'public repository profile conflicts with private preview destination\n' >&2
  exit 2
fi

ssh_cmd="ssh -i $DL_SSH_KEY -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$KNOWN_HOSTS"
rs=(rsync --recursive --links --times --omit-dir-times --perms --chmod=D0755,F0644 --no-owner --no-group
    --partial-dir=.rsync-partial --timeout=600 -e "$ssh_cmd")
fetch=("${rs[@]}")   # reads from the origin; never a dry run
[ "$apply" = 1 ] || rs+=(--dry-run --itemize-changes)
log() { printf '%s sync-origin: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# prune_repo PREFIX DESTINATION: delete from the origin the objects and static
# deltas that no kept generation (DL_KEEP_GENERATIONS, the generations served
# in the last DL_PRUNE_AFTER_HOURS) has. Deletion only (--existing with
# --ignore-existing transfers nothing), so a prune never puts a summary ahead
# of its objects. rsync merges the generations' file lists, so an object goes
# only when every one of them lacks it. Skipped when the summary the origin
# serves now is not one of the kept generations' summaries: then what the
# origin's clients may need is unknown here, and nothing is deleted.
prune_repo() {
  local prefix=$1 destination=$2 generation_dir sources=() served_match=0
  for generation_dir in ${DL_KEEP_GENERATIONS:-}; do
    [ -f "$generation_dir/$prefix/config" ] || continue
    sources+=("$generation_dir/$prefix/")
  done
  [ "${#sources[@]}" -gt 0 ] || { log "$prefix: no kept generation has this repository; origin not pruned"; return 0; }
  rm -f "$work/served-summary"
  "${fetch[@]}" "$DL_RSYNC_DEST:$destination/summary" "$work/served-summary" >/dev/null 2>&1 || true
  if [ -f "$work/served-summary" ]; then
    for generation_dir in "${sources[@]}"; do
      cmp -s "$work/served-summary" "$generation_dir/summary" && { served_match=1; break; }
    done
  fi
  [ "$served_match" = 1 ] ||
    { log "$prefix: origin not pruned: its served summary is not in a kept generation"; return 0; }
  "${rs[@]}" --existing --ignore-existing --delete-after \
    --include 'objects/***' --include 'deltas/***' --exclude '*' \
    "${sources[@]}" "$DL_RSYNC_DEST:$destination/"
  log "$prefix: pruned to ${#sources[@]} served generation(s)"
}

# transfer_bytes RSYNC-ARGS...: bytes a transfer would write (dry run).
transfer_bytes() {
  "${rs[@]}" --dry-run --stats --no-human-readable "$@" |
    sed -n 's/^Total transferred file size: \([0-9]*\) bytes$/\1/p'
}

# origin_space_check: refuse the upload unless the origin's file system has
# room for it plus DL_ORIGIN_RESERVE_GIB. The origin's root timer writes
# "<available bytes> <size bytes> <unix time>" to .Suno-origin/space in the web
# root every minute (config/os/origin/); the upload key itself cannot run df.
# A budget alone (DL_MAX_GIB) does not see what else shares the disk: on
# 2026-11-26 the budget said 18 of 25 GiB while the disk had 7 MiB left.
origin_space_check() {
  local need=0 part bytes file kind_dir kind channel prefix avail size stamp reserve
  # Graph and key uploads are a few kilobytes and renamed into place; only
  # repository and media uploads need the check.
  [[ " $parts " =~ \ (repo|preview|media|media-tree)\  ]] || return 0
  for part in $parts; do
    case "$part" in
      repo|preview)
        local source=$generation/os/repo destination=$public_repo_destination
        [ "$part" = preview ] && { source=$generation/os/preview-repo; destination=os/preview-repo; }
        [ -f "$source/config" ] || continue
        bytes=$(transfer_bytes --ignore-existing --exclude tmp/ --exclude state/ --exclude .lock "$source/" "$DL_RSYNC_DEST:$destination/")
        need=$((need + ${bytes:-0})) ;;
      media)
        for file in $media; do need=$((need + $(stat -c %s "$file"))); done ;;
      media-tree)
        for kind_dir in "$MEDIA_TREE"/staff/* "$MEDIA_TREE"/public/*; do
          [ -d "$kind_dir" ] || continue
          kind=$(basename "$(dirname "$kind_dir")") channel=$(basename "$kind_dir")
          prefix=$MEDIA_PUBLIC_PREFIX
          [ "$kind" = staff ] && prefix=$MEDIA_STAFF_PREFIX
          bytes=$(transfer_bytes --hard-links "$kind_dir/" "$DL_RSYNC_DEST:$prefix/$channel/")
          need=$((need + ${bytes:-0}))
        done ;;
    esac
  done
  rm -f "$work/space"
  "${fetch[@]}" "$DL_RSYNC_DEST:.Suno-origin/space" "$work/space" >/dev/null 2>&1 ||
    { log "upload refused: the origin reports no free space (.Suno-origin/space; install config/os/origin/)"; exit 4; }
  read -r avail size stamp <"$work/space" || true
  [[ "$avail" =~ ^[0-9]+$ && "$size" =~ ^[0-9]+$ && "$stamp" =~ ^[0-9]+$ ]] ||
    { log 'upload refused: unreadable origin space report'; exit 4; }
  [ $(( $(date -u +%s) - stamp )) -le 900 ] ||
    { log "upload refused: the origin space report is $(( ($(date -u +%s) - stamp) / 60 )) minutes old (timer stopped?)"; exit 4; }
  reserve=$(( ${DL_ORIGIN_RESERVE_GIB:-2} * 1073741824 ))
  [ $((need + reserve)) -le "$avail" ] ||
    { log "upload refused: needs $((need / 1048576)) MiB + $((reserve / 1048576)) MiB reserve, origin has $((avail / 1048576)) MiB free of $((size / 1073741824)) GiB"; exit 4; }
  log "origin space: upload $((need / 1048576)) MiB, $((avail / 1048576)) MiB free of $((size / 1073741824)) GiB"
}

sync_repo() {
  local source=$1 prefix=$2 destination=${3:-$2} file
  [ -f "$source/config" ] || { log "$prefix: no repository in this generation"; return 0; }
  local immutable=("${rs[@]}")
  if [ "$prefix" = os/repo ] && [ -n "$public_repo_link_destination" ]; then
    immutable+=(--link-dest="$public_repo_link_destination")
  fi
  "${immutable[@]}" --ignore-existing --exclude tmp/ --exclude state/ --exclude .lock \
    --include 'objects/***' --include 'deltas/***' --include 'objects/' --include 'deltas/' --exclude '*' \
    "$source/" "$DL_RSYNC_DEST:$destination/"
  "${rs[@]}" --exclude 'objects/' --exclude 'deltas/' --exclude tmp/ --exclude state/ --exclude .lock \
    --exclude summary --exclude summary.sig --exclude 'summary.idx*' --exclude 'summaries/' \
    "$source/" "$DL_RSYNC_DEST:$destination/"
  local last=()
  for file in summaries summary.idx summary.idx.sig summary summary.sig; do
    [ -e "$source/$file" ] && last+=("$file")
  done
  [ "${#last[@]}" -eq 0 ] || (cd "$source" && "${rs[@]}" --delay-updates --relative "${last[@]}" "$DL_RSYNC_DEST:$destination/")
  log "$prefix: uploaded"
}

# Retention before every upload, then the real free-space check.
for part in $parts; do
  case "$part" in
    repo) prune_repo os/repo "$public_repo_destination" ;;
    preview) prune_repo os/preview-repo os/preview-repo ;;
  esac
done
[ "$prune" = 1 ] && { log "prune complete"; exit 0; }
[ "$apply" = 1 ] && origin_space_check

for part in $parts; do
  case "$part" in
    repo) sync_repo "$generation/os/repo" os/repo "$public_repo_destination" ;;
    preview) sync_repo "$generation/os/preview-repo" os/preview-repo ;;
    graph)
      [ -d "$generation/os/graph" ] || continue
      # Signatures first, then the graphs they sign, renamed together.
      (cd "$generation/os/graph" && "${rs[@]}" --delay-updates ./ "$DL_RSYNC_DEST:os/graph/")
      log 'os/graph: uploaded' ;;
    keys)
      "${rs[@]}" "$generation/os/keys/" "$DL_RSYNC_DEST:os/keys/"
      log 'os/keys: uploaded' ;;
    media)
      for file in $media; do
        [ -f "$file.sha256" ] || { log "no .sha256 beside $file; skipped"; continue; }
        # Stable media are public; nightly and beta (staff) media go to the
        # credential-checked preview-media/ location.
        dir=preview-media
        grep -Fxq 'channel=stable' "$file.release" 2>/dev/null && dir=media
        "${rs[@]}" --ignore-existing "$file" "$DL_RSYNC_DEST:$dir/"
        "${rs[@]}" --delay-updates "$file.sha256" "$DL_RSYNC_DEST:$dir/"
        log "$dir: $(basename "$file") uploaded"
      done ;;
    media-tree)
      # The nightly media tree (scripts/os/nightly-media.sh): per kind and
      # channel, the served media, their .sha256 files, latest.json and the
      # stable latest names, which are hard links to the newest medium.
      # One transfer per directory keeps the hard links (--hard-links) and
      # renames everything into place together at its end (--delay-updates),
      # so latest.json never names a medium the origin does not have yet.
      # Media no longer in the tree are removed afterwards, delete-only.
      for kind_dir in "$MEDIA_TREE"/staff/* "$MEDIA_TREE"/public/*; do
        [ -d "$kind_dir" ] || continue
        kind=$(basename "$(dirname "$kind_dir")") channel=$(basename "$kind_dir")
        prefix=$MEDIA_PUBLIC_PREFIX
        [ "$kind" = staff ] && prefix=$MEDIA_STAFF_PREFIX
        "${rs[@]}" --hard-links --delay-updates "$kind_dir/" "$DL_RSYNC_DEST:$prefix/$channel/"
        "${rs[@]}" --existing --ignore-existing --delete-after --exclude .rsync-partial/ "$kind_dir/" "$DL_RSYNC_DEST:$prefix/$channel/"
        log "$prefix/$channel: $kind media uploaded"
      done
      # Earlier staff media under the staff prefix stay where they are (owner
      # decision 2026-09-16); only the per-channel trees above are managed.
      ;;
  esac
done
[ "$apply" = 1 ] || { log 'dry run: nothing uploaded'; exit 0; }

# Verification through the origin's virtual host.
#
# Every URL reaches curl on standard input (--config -), never as an argument,
# so the preview credential in a device path is not visible in the process
# table; curl's own error text is dropped for the same reason. Files are
# compared by SHA-256 after a complete download: the tools image has coreutils
# but not diffutils, and a pipe into a comparison that exits early makes curl
# report a write failure instead of the real result.
failures=0
fail() { log "$1"; failures=$((failures + 1)); }
# Follow only the official immutable-object handoff. Custom origin Host routing
# belongs to the first request; sending it to the media host serves the wrong
# virtual host. Policy, credentials, graphs and summaries never follow redirects.
http_request() {
  local path=$1 output=$2 method=$3 result code location
  local options=()
  [ "$method" != HEAD ] || options+=(--head)
  result=$(printf 'url = "%s/%s"\n' "$DL_HTTP_ORIGIN" "$path" |
    curl --config - --fail --silent --max-time 120 "${options[@]}" \
      -H "Host: $DL_HOST_HEADER" --output "$output" \
      --write-out '%{http_code}\n%{redirect_url}' 2>/dev/null) || return 1
  code=${result%%$'\n'*}
  location=${result#*$'\n'}
  [[ "$code" == 2[0-9][0-9] ]] && return 0
  case "$code" in 301|302|303|307|308) ;; *) return 1 ;; esac
  [[ "$path" = os/repo/objects/* &&
     "$location" = "https://media.simplyluma.com/$path" ]] || return 1
  # No custom Host and no further redirects; the final resource must succeed.
  code=$(printf 'url = "%s"\n' "$location" |
    curl --config - --proto '=https' --fail --silent --max-time 120 \
      "${options[@]}" --output "$output" --write-out '%{http_code}' 2>/dev/null) || return 1
  [[ "$code" == 2[0-9][0-9] ]]
}
# fetch URL-PATH OUTPUT-FILE
fetch() { http_request "$1" "$2" GET; }
# present URL-PATH: a final successful HEAD, including the verified media hop.
present() { http_request "$1" /dev/null HEAD; }
digest() { sha256sum <"$1" | cut -d' ' -f1; }
# served URL-PATH LOCAL-FILE LABEL: the origin serves LOCAL-FILE byte for byte
served() {
  local copy="$work/served"
  rm -f "$copy"
  fetch "$1" "$copy" || { fail "$3: not served"; return 0; }
  [ "$(digest "$copy")" = "$(digest "$2")" ] || fail "$3: served copy differs"
}
# verify_repo SOURCE URL-PREFIX LABEL (LABEL is what logs name; URL-PREFIX may
# carry a credential and is never logged)
verify_repo() {
  local source=$1 prefix=$2 label=$3 file ref commit object
  [ -f "$source/summary" ] || return 0
  for file in summary summary.sig; do
    [ -f "$source/$file" ] && served "$prefix/$file" "$source/$file" "$label/$file"
  done
  for ref in $(ostree refs --repo="$source"); do
    commit=$(ostree rev-parse --repo="$source" "$ref")
    served "$prefix/objects/${commit:0:2}/${commit:2}.commit" "$source/objects/${commit:0:2}/${commit:2}.commit" "$label: commit of $ref"
    [ -f "$source/objects/${commit:0:2}/${commit:2}.commitmeta" ] &&
      served "$prefix/objects/${commit:0:2}/${commit:2}.commitmeta" "$source/objects/${commit:0:2}/${commit:2}.commitmeta" "$label: signature of $ref"
  done
  # A sample of content objects, and every static delta's superblock.
  for object in $(cd "$source/objects" && find . -name '*.filez' | shuf -n 25 --random-source=<(yes)); do
    present "$prefix/objects/${object#./}" || fail "$label: object ${object#./} missing"
  done
  if [ -d "$source/deltas" ]; then
    for object in $(cd "$source/deltas" && find . -name superblock); do
      present "$prefix/deltas/${object#./}" || fail "$label: static delta ${object#./} missing"
    done
  fi
  log "$label: checked through $DL_HOST_HEADER"
}
for part in $parts; do
  case "$part" in
    repo) verify_repo "$generation/os/repo" os/repo os/repo ;;
    preview)
      # Served only through the credential-checked device path; the direct
      # path must stay internal.
      present os/preview-repo/summary && fail 'os/preview-repo/summary: served without a credential'
      credential=
      if [ -n "${DL_PREVIEW_CREDENTIAL_FILE:-}" ] && [ -r "$DL_PREVIEW_CREDENTIAL_FILE" ]; then
        IFS= read -r credential <"$DL_PREVIEW_CREDENTIAL_FILE" || true
      fi
      if [[ "$credential" =~ ^[A-Za-z0-9_-]{16,256}$ ]]; then
        verify_repo "$generation/os/preview-repo" "os/preview/$credential/repo" 'os/preview/<credential>/repo'
      else
        log 'os/preview-repo: no usable credential to verify through the device path (DL_PREVIEW_CREDENTIAL_FILE)'
      fi
      credential= ;;
    graph)
      [ -d "$generation/os/graph" ] || continue
      while IFS= read -r -d '' file; do
        relative=${file#"$generation/os/graph/"}
        served "os/graph/$relative" "$file" "os/graph/$relative"
      done < <(find "$generation/os/graph" -type f -print0) ;;
    keys)
      for file in "$generation"/os/keys/*; do
        served "os/keys/$(basename "$file")" "$file" "os/keys/$(basename "$file")"
      done ;;
    media)
      for file in $media; do
        # Preview media are only reachable with a credential; check stable ones.
        grep -Fxq 'channel=stable' "$file.release" 2>/dev/null || continue
        served "media/$(basename "$file").sha256" "$file.sha256" "media/$(basename "$file").sha256"
      done ;;
    media-tree)
      credential=
      if [ -n "${DL_PREVIEW_CREDENTIAL_FILE:-}" ] && [ -r "$DL_PREVIEW_CREDENTIAL_FILE" ]; then
        IFS= read -r credential <"$DL_PREVIEW_CREDENTIAL_FILE" || true
      fi
      for kind_dir in "$MEDIA_TREE"/staff/* "$MEDIA_TREE"/public/*; do
        [ -f "$kind_dir/latest.json" ] || continue
        kind=$(basename "$(dirname "$kind_dir")") channel=$(basename "$kind_dir")
        if [ "$kind" = public ]; then
          base="$MEDIA_PUBLIC_PREFIX/$channel" label="$MEDIA_PUBLIC_PREFIX/$channel"
          present "$MEDIA_STAFF_PREFIX/$channel/latest.json" && fail "$MEDIA_STAFF_PREFIX/$channel: served without a credential"
        elif [[ "$credential" =~ ^[A-Za-z0-9_-]{16,256}$ ]]; then
          base="media/preview/$credential/$channel" label="media/preview/<credential>/$channel"
        else
          log "$MEDIA_STAFF_PREFIX/$channel: no usable credential to verify the staff media (DL_PREVIEW_CREDENTIAL_FILE)"
          continue
        fi
        served "$base/latest.json" "$kind_dir/latest.json" "$label/latest.json"
        if [ -f "$kind_dir/latest.json.minisig" ]; then
          served "$base/latest.json.minisig" "$kind_dir/latest.json.minisig" "$label/latest.json.minisig"
        fi
        for file in "$kind_dir"/*.sha256; do
          served "$base/$(basename "$file")" "$file" "$label/$(basename "$file")"
        done
        for file in "$kind_dir"/*.iso; do
          [ -f "$file" ] || continue
          transport=$file
          # New media have a same-inode alias; legacy trees keep their old path.
          if [ -f "$file.download" ]; then
            [ "$file" -ef "$file.download" ] || { fail "$label: transport alias differs from ISO"; continue; }
            transport=$file.download
          fi
          present "$base/$(basename "$transport")" || fail "$label/$(basename "$transport"): not served"
        done
      done
      credential= ;;
  esac
done
[ "$failures" -eq 0 ] || { log "verification failed: $failures problems"; exit 1; }
log 'origin serves what was published'
