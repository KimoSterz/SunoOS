#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Create the two public-channel trust anchors of ADR-030 on the build host:
#
#   * the "Suno OS Release" OpenPGP key, passphrase-protected, used only for
#     OS commits, summaries and release manifests;
#   * the Ed25519 minisign update-graph key, password-protected.
#
# Private material stays in SUNO_OS_KEYS (0700, root); passphrases in
# SUNO_OS_SECRETS (0700, root, one 0600 file each). An encrypted offline backup
# of both secret keys and the revocation certificate is written beside them
# for the owner to move to offline storage; its passphrase is a separate
# root-only file. Nothing private is printed, logged or copied elsewhere.
#
# The Recent development key and the private device key are never touched.
#
#   generate-release-keys.sh [--dry-run]

set -euo pipefail
. "$(dirname -- "$0")/lib/common.sh"

dry_run=0
case "${1:-}" in
  --dry-run) dry_run=1 ;;
  '') ;;
  *) printf 'usage: %s [--dry-run]\n' "$0" >&2; exit 2 ;;
esac

Suno_os_require_root
Suno_os_require_tools gpg gpgconf base64 tar
Suno_os_check_host

gpg_home=$(Suno_os_gpg_home)
minisign_dir="$SUNO_OS_KEYS/update-graph-minisign"
backup_dir="$SUNO_OS_KEYS/offline-backup"
uid='Suno OS Release <os-release@simplyluma.com>'

# Every step below is guarded, so an interrupted run resumes without ever
# replacing a key that already exists.
if [ -s "$SUNO_OS_KEYS/os-release-fingerprint.txt" ] &&
   [ -s "$minisign_dir/Suno-update-graph.pub" ] &&
   compgen -G "$backup_dir/Suno-os-release-keys-*.tar.gpg" >/dev/null; then
  Suno_os_log 'release keys and their offline backup already exist; nothing to do'
  printf 'os_release_fingerprint=%s\n' "$(Suno_os_gpg_fingerprint)"
  printf 'update_graph_public_key=%s\n' "$(sed -n 2p "$minisign_dir/Suno-update-graph.pub")"
  exit 0
fi

if [ "$dry_run" -eq 1 ]; then
  cat <<EOF
would create:
  $gpg_home (0700) with an ed25519 certify+sign key "$uid", no expiry
  $SUNO_OS_KEYS/os-release-fingerprint.txt
  $SUNO_OS_KEYS/Suno-os-release.gpg and .asc (public)
  $minisign_dir/Suno-update-graph.{key,pub}
  $backup_dir/Suno-os-release-keys-<date>.tar.gpg (AES256, separate passphrase)
  $SUNO_OS_SECRETS/{os-release-gpg.passphrase,update-graph-minisign.password,offline-backup.passphrase} (0600)
  $SUNO_OS_RELEASE_KEY_PATH on this host (public key, for installer builds)
EOF
  exit 0
fi

umask 077
install -d -m 0700 "$SUNO_OS_KEYS" "$gpg_home" "$minisign_dir" "$backup_dir" "$SUNO_OS_SECRETS"
printf 'allow-preset-passphrase\nmax-cache-ttl 7200\n' >"$gpg_home/gpg-agent.conf"

new_secret() {
  local file=$1
  [ -s "$file" ] && return 0
  head -c 48 /dev/urandom | base64 -w0 >"$file"
  chmod 0600 "$file"
}
new_secret "$SUNO_OS_SECRETS/os-release-gpg.passphrase"
new_secret "$SUNO_OS_SECRETS/update-graph-minisign.password"
new_secret "$SUNO_OS_SECRETS/offline-backup.passphrase"

if [ ! -s "$SUNO_OS_KEYS/os-release-fingerprint.txt" ]; then
  Suno_os_log 'generating the Suno OS Release OpenPGP key'
  gpg --batch --homedir "$gpg_home" --pinentry-mode loopback \
    --passphrase-file "$SUNO_OS_SECRETS/os-release-gpg.passphrase" \
    --quick-generate-key "$uid" ed25519 cert,sign never
fi
fingerprint=$(gpg --batch --homedir "$gpg_home" --with-colons --list-secret-keys "$uid" |
  awk -F: '$1 == "fpr" { print $10; exit }')
[[ "$fingerprint" =~ ^[0-9A-F]{40}$ ]] || Suno_os_die 'key generation produced no fingerprint'
printf '%s\n' "$fingerprint" >"$SUNO_OS_KEYS/os-release-fingerprint.txt"
chmod 0644 "$SUNO_OS_KEYS/os-release-fingerprint.txt"
gpg --batch --homedir "$gpg_home" --export "$fingerprint" >"$SUNO_OS_KEYS/Suno-os-release.gpg"
gpg --batch --homedir "$gpg_home" --export --armor "$fingerprint" >"$SUNO_OS_KEYS/Suno-os-release.asc"
chmod 0644 "$SUNO_OS_KEYS/Suno-os-release.gpg" "$SUNO_OS_KEYS/Suno-os-release.asc"

# Prove the passphrase unlocks the key non-interactively before relying on it.
probe=$(mktemp -d "$SUNO_OS_ROOT/tmp/key-probe.XXXXXX")
trap 'rm -rf "$probe"; Suno_os_gpg_lock' EXIT
printf 'probe\n' >"$probe/data"
Suno_os_gpg_unlock
gpg --batch --homedir "$gpg_home" --local-user "$fingerprint" \
  --detach-sign --output "$probe/data.sig" "$probe/data"
gpg --batch --homedir "$gpg_home" --verify "$probe/data.sig" "$probe/data" 2>/dev/null
Suno_os_gpg_lock

if [ ! -s "$minisign_dir/Suno-update-graph.key" ]; then
Suno_os_log 'generating the update-graph minisign key'
SUNO_OS_TOOLS_MOUNTS="$minisign_dir" Suno_os_tools sh -c '
  set -eu
  IFS= read -r password || [ -n "$password" ]
  printf "%s\n%s\n" "$password" "$password" |
    minisign -G -f -p "$1/Suno-update-graph.pub" -s "$1/Suno-update-graph.key" \
      -c "Suno update graph secret key" >/dev/null
' sh "$minisign_dir" <"$SUNO_OS_SECRETS/update-graph-minisign.password"
fi
[ -s "$minisign_dir/Suno-update-graph.key" ] && [ -s "$minisign_dir/Suno-update-graph.pub" ] ||
  Suno_os_die 'minisign key generation failed'
chmod 0600 "$minisign_dir/Suno-update-graph.key"
chmod 0644 "$minisign_dir/Suno-update-graph.pub"

# Prove the password unlocks the minisign key non-interactively.
printf 'probe\n' >"$probe/graph"
SUNO_OS_TOOLS_MOUNTS="$minisign_dir $probe" Suno_os_tools sh -c '
  set -eu
  minisign -S -s "$1/Suno-update-graph.key" -m "$2/graph" -x "$2/graph.minisig" >/dev/null
  minisign -V -p "$1/Suno-update-graph.pub" -m "$2/graph" -x "$2/graph.minisig" >/dev/null
' sh "$minisign_dir" "$probe" <"$SUNO_OS_SECRETS/update-graph-minisign.password"

Suno_os_log 'writing the encrypted offline backup'
stage="$probe/backup"
install -d -m 0700 "$stage"
gpg --batch --homedir "$gpg_home" --pinentry-mode loopback \
  --passphrase-file "$SUNO_OS_SECRETS/os-release-gpg.passphrase" \
  --export-secret-keys --armor "$fingerprint" >"$stage/Suno-os-release-secret.asc"
cp "$gpg_home/openpgp-revocs.d/$fingerprint.rev" "$stage/Suno-os-release-revocation.rev"
cp "$SUNO_OS_KEYS/Suno-os-release.asc" "$stage/"
cp "$minisign_dir/Suno-update-graph.key" "$minisign_dir/Suno-update-graph.pub" "$stage/"
cat >"$stage/README.txt" <<EOF
Suno OS release trust anchors, offline backup.

Suno-os-release-secret.asc   OpenPGP secret key, still protected by the
                             release key passphrase (os-release-gpg.passphrase)
Suno-os-release-revocation.rev  revocation certificate for $fingerprint
Suno-update-graph.key        minisign secret key, protected by its password
                             (update-graph-minisign.password)

This archive is encrypted with the offline backup passphrase. Keep the archive
and the three passphrases on separate offline media. See
docs/os/release-runbook.md, "Key custody and rotation".
EOF
backup="$backup_dir/Suno-os-release-keys-$(date -u +%Y%m%d).tar.gpg"
tar -C "$stage" -cf - . |
  gpg --batch --homedir "$gpg_home" --pinentry-mode loopback \
    --passphrase-file "$SUNO_OS_SECRETS/offline-backup.passphrase" \
    --yes --symmetric --cipher-algo AES256 --output "$backup"
chmod 0600 "$backup"
rm -rf "$stage"

# Installer builds on this host read the public key from the path the image
# ships it at.
install -D -m 0644 "$SUNO_OS_KEYS/Suno-os-release.gpg" "$SUNO_OS_RELEASE_KEY_PATH"

key_id=$(head -n 1 "$minisign_dir/Suno-update-graph.pub" | awk '{ print $NF }')
printf 'os_release_fingerprint=%s\n' "$fingerprint"
printf 'update_graph_key_id=%s\n' "$key_id"
printf 'update_graph_public_key=%s\n' "$(sed -n 2p "$minisign_dir/Suno-update-graph.pub")"
printf 'offline_backup=%s\n' "$backup"
