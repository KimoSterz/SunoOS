#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

failures=0
check() {
  description=$1
  shift
  if "$@"; then
    printf 'PASS  %s\n' "$description"
  else
    printf 'FAIL  %s\n' "$description"
    failures=$((failures + 1))
  fi
}

check 'aarch64 guest architecture' test "$(uname -m)" = aarch64
check 'Fedora guest identity' grep -q '^ID=fedora$' /etc/os-release
check 'Fedora 44 guest version' grep -q '^VERSION_ID="\?44"\?$' /etc/os-release
check 'mobile rootfs contract' grep -qx 'SUNO_ROOTFS_CONTRACT=mobile-v1' /etc/Suno/rootfs-contract
check 'virtual hardware backend' grep -qx 'SUNO_HARDWARE_BACKEND=virtual' /etc/Suno/rootfs-contract
check 'QEMU kernel contract' grep -qx 'SUNO_KERNEL_CONTRACT=qemu-virt' /etc/Suno/rootfs-contract
check 'twin cannot claim physical hardware' grep -qx 'SUNO_PHYSICAL_DEVICE=false' /etc/Suno/rootfs-contract
check 'FP6 reference profile' grep -qx 'SUNO_PROFILE=fp6-behavioral-twin-v1' /etc/Suno/hardware-profile
check 'portrait display width' grep -qx 'DISPLAY_WIDTH=1116' /etc/Suno/hardware-profile
check 'portrait display height' grep -qx 'DISPLAY_HEIGHT=2484' /etc/Suno/hardware-profile
check 'FP6 portrait mode offered by DRM' bash -c \
  'grep -qx 1116x2484 /sys/class/drm/card*-*/modes'
check 'virtio keyboard input' grep -q 'N: Name="QEMU Virtio Keyboard"' /proc/bus/input/devices
check 'virtio tablet input' grep -q 'N: Name="QEMU Virtio Tablet"' /proc/bus/input/devices
check 'state simulator service' systemctl is-active --quiet Suno-fp6-twin-state.service
check 'SSH service' systemctl is-active --quiet sshd.service
check 'normal scenario available' sudo Suno-fp6-twinctl scenario normal
check 'normal cellular state' sudo grep -qx 'CELLULAR_STATE=registered' /run/Suno-fp6-twin/state.env
check 'offline scenario available' sudo Suno-fp6-twinctl scenario offline
check 'offline Wi-Fi state' sudo grep -qx 'WIFI_STATE=disconnected' /run/Suno-fp6-twin/state.env
check 'offline modem signal' sudo grep -qx 'MODEM_SIGNAL_PERCENT=0' /run/Suno-fp6-twin/state.env
check 'low-battery scenario available' sudo Suno-fp6-twinctl scenario low-battery
check 'low-battery percentage' sudo grep -qx 'BATTERY_PERCENT=8' /run/Suno-fp6-twin/state.env
sudo Suno-fp6-twinctl scenario normal

failed_units=$(systemctl --failed --no-legend --plain 2>/dev/null || true)
if [ -z "$failed_units" ]; then
  printf 'PASS  no failed system units\n'
else
  printf 'FAIL  failed system units detected\n%s\n' "$failed_units"
  failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
  printf '\nMobile twin smoke test: FAIL (%s checks)\n' "$failures"
  exit 1
fi

printf '\nMobile twin smoke test: PASS\n'
