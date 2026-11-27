#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Install the OS pipeline's systemd units on the build host.
#
#   install-build-host-units.sh [--branch BRANCH] [--enable-nightly] [--dry-run]
#
# Installs Suno-os.slice, Suno-os-nightly.{service,timer},
# Suno-os-graph-sign@.{service,timer}, Suno-os-http.service and
# Suno-os-https.service from config/os/systemd with this host's pipeline root
# filled in, and starts the loopback content servers. The nightly timer is
# enabled only with --enable-nightly; graph-signing timers start for each
# channel but do nothing until Hub's service token file exists.

set -euo pipefail
. "$(dirname -- "$0")/lib/common.sh"

branch=stage
enable_nightly=0
dry_run=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --branch) branch=${2:?}; shift 2 ;;
    --enable-nightly) enable_nightly=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    *) printf 'usage: %s [--branch BRANCH] [--enable-nightly] [--dry-run]\n' "$0" >&2; exit 2 ;;
  esac
done
Suno_os_require_root
[[ "$branch" =~ ^[A-Za-z0-9._/-]+$ ]] || Suno_os_die "invalid branch: $branch"

# Scheduled key use never follows the mutable nightly checkout. Seal the
# reviewed administrative control once and pin that manifest and tools image
# in the service. A later source update requires a new installer transaction.
graph_control=/var/lib/Suno-release-controls/graph-$(date -u +%Y%m%dT%H%M%SZ)-$$
graph_manifest=MANIFEST_CREATED_ON_INSTALL
graph_image=IMMUTABLE_IMAGE_RESOLVED_ON_INSTALL
if [ "$dry_run" -eq 0 ]; then
  install -d -m 0700 /var/lib/Suno-release-controls
  graph_manifest=$(python3 -B -I "$Suno_os_repo_root/scripts/depot/seal-signing-control.py" \
    seal-graph "$Suno_os_repo_root" "$graph_control")
  graph_image=$(Suno_os_podman image inspect --format '{{.Id}}' "$(Suno_os_tools_image)")
  [[ "$graph_manifest" =~ ^[a-f0-9]{64}$ ]] && [[ "$graph_image" =~ ^[a-f0-9]{64}$ ]] ||
    Suno_os_die 'graph signer control/image identity could not be sealed'
fi

units=(Suno-os.slice Suno-os-nightly.service Suno-os-media.service Suno-os-alert@.service Suno-os-nightly.timer Suno-os-graph-sign@.service
  Suno-os-graph-sign@.timer Suno-os-http.service Suno-os-https.service)
for unit in "${units[@]}"; do
  rendered=$(sed -e "s#@ROOT@#$SUNO_OS_ROOT#g" -e "s#@BRANCH@#$branch#g" \
    -e "s#@GRAPH_CONTROL@#$graph_control#g" -e "s#@GRAPH_MANIFEST@#$graph_manifest#g" \
    -e "s#@GRAPH_IMAGE@#$graph_image#g" "$Suno_os_repo_root/config/os/systemd/$unit")
  if [ "$dry_run" -eq 1 ]; then
    printf '=== /etc/systemd/system/%s\n%s\n' "$unit" "$rendered"
  else
    printf '%s\n' "$rendered" >"/etc/systemd/system/$unit.new"
    chmod 0644 "/etc/systemd/system/$unit.new"
    mv "/etc/systemd/system/$unit.new" "/etc/systemd/system/$unit"
  fi
done
[ "$dry_run" -eq 1 ] && exit 0

install -d -m 0755 "$SUNO_OS_ROOT/etc" "$SUNO_OS_ROOT/webroot"
touch "$SUNO_OS_ROOT/etc/preview-credentials.sha256"
if [ ! -s "$SUNO_OS_ROOT/etc/tls/server.crt" ]; then
  install -d -m 0700 "$SUNO_OS_ROOT/etc/tls"
  openssl req -x509 -newkey ed25519 -nodes -days 825 \
    -subj '/CN=Suno OS local CA' -keyout "$SUNO_OS_ROOT/etc/tls/ca.key" -out "$SUNO_OS_ROOT/etc/tls/ca.crt" 2>/dev/null
  openssl req -newkey ed25519 -nodes -subj '/CN=127.0.0.1' \
    -keyout "$SUNO_OS_ROOT/etc/tls/server.key" -out "$SUNO_OS_ROOT/etc/tls/server.csr" 2>/dev/null
  printf 'subjectAltName=IP:127.0.0.1,DNS:localhost\n' >"$SUNO_OS_ROOT/etc/tls/san.cnf"
  openssl x509 -req -in "$SUNO_OS_ROOT/etc/tls/server.csr" -CA "$SUNO_OS_ROOT/etc/tls/ca.crt" \
    -CAkey "$SUNO_OS_ROOT/etc/tls/ca.key" -CAcreateserial -days 825 \
    -extfile "$SUNO_OS_ROOT/etc/tls/san.cnf" -out "$SUNO_OS_ROOT/etc/tls/server.crt" 2>/dev/null
  chmod 0644 "$SUNO_OS_ROOT/etc/tls/ca.crt" "$SUNO_OS_ROOT/etc/tls/server.crt"
fi
systemctl daemon-reload
systemctl start Suno-os.slice
systemctl enable --now Suno-os-http.service Suno-os-https.service
for channel in $SUNO_OS_CHANNELS; do
  systemctl enable --now "Suno-os-graph-sign@$channel.timer"
done
if [ "$enable_nightly" -eq 1 ]; then
  systemctl enable --now Suno-os-nightly.timer
fi
systemctl list-timers 'Suno-os-*' --no-pager
