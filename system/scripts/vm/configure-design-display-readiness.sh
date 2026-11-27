#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  printf 'error: run this command as root inside the persistent design VM\n' >&2
  exit 1
fi

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
helper="$repo_root/ops/design-vm/Suno-wait-for-virtual-display"
unit="$repo_root/ops/design-vm/Suno-virtual-display-ready.service"

install -D -m 0755 "$helper" /usr/local/libexec/Suno-wait-for-virtual-display
install -D -m 0644 "$unit" /etc/systemd/system/Suno-virtual-display-ready.service
install -d -m 0755 /etc/systemd/system/gdm.service.wants
ln -sfn ../Suno-virtual-display-ready.service \
  /etc/systemd/system/gdm.service.wants/Suno-virtual-display-ready.service
systemctl daemon-reload
systemctl enable Suno-virtual-display-ready.service

printf 'design VM display readiness barrier installed\n'
