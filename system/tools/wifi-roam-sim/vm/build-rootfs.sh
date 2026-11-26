#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
P=${WIFI_ROAM_DIR:-/srv/dev-storage/projects/wifi-roam}
PODMAN="podman --root $P/podman/root --runroot /run/wifi-roam-podman"
$PODMAN rm -f wifi-roam-rootfs >/dev/null 2>&1 || true
$PODMAN run --name wifi-roam-rootfs --security-opt label=disable -v $P/cache/dnf:/var/cache/libdnf5 registry.fedoraproject.org/fedora:44 bash -c "
set -e
dnf5 -y --setopt=keepcache=1 install systemd systemd-udev kernel-core kernel-modules kernel-modules-core kernel-modules-internal dracut \
  NetworkManager NetworkManager-wifi wpa_supplicant hostapd iw iproute iputils procps-ng iperf3 openssh-server openssh-clients \
  python3 tcpdump gcc make pkgconf libnl3-devel openssl-devel dbus-devel libconfig-devel libevent-devel git which less strace \
  passwd e2fsprogs util-linux kmod jq dnsmasq rpm-build iwd
kver=\$(ls /lib/modules | head -1)
dracut --no-hostonly --force --kver \$kver -a \"base\" --add-drivers \"virtio_blk virtio_pci ext4\" /boot/initramfs-vm.img
cp /lib/modules/\$kver/vmlinuz /boot/vmlinuz-vm
echo \$kver > /boot/kver
"
rm -rf $P/vm/rootfs; mkdir -p $P/vm/rootfs
$PODMAN export wifi-roam-rootfs | tar -C $P/vm/rootfs -xf -
$PODMAN rm -f wifi-roam-rootfs
cp $P/vm/rootfs/boot/vmlinuz-vm $P/vm/rootfs/boot/initramfs-vm.img $P/vm/
cat $P/vm/rootfs/boot/kver
