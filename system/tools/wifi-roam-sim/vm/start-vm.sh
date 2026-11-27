#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# One test VM (4 GB, 4 vCPU, CPU-capped, in Suno-heavy.slice so the thermal guard can freeze it).
P=${WIFI_ROAM_DIR:-/srv/dev-storage/projects/wifi-roam}/vm
systemctl stop wifi-roam-vm 2>/dev/null; systemctl reset-failed wifi-roam-vm 2>/dev/null
nohup systemd-run --scope --unit=wifi-roam-vm --slice=Suno-heavy.slice -p CPUQuota=200% -p MemoryMax=5G \
  /usr/bin/qemu-system-x86_64 -enable-kvm -cpu host -smp 2 -m 4096 \
  -kernel $P/vmlinuz-vm -initrd $P/initramfs-vm.img \
  -append "root=/dev/vda rw console=ttyS0 selinux=0 net.ifnames=0" \
  -drive file=$P/rootfs.img,if=virtio,format=raw \
  -nic user,model=virtio-net-pci,hostfwd=tcp:127.0.0.1:2299-:22 \
  -display none -serial file:$P/console.log -monitor none >$P/qemu.log 2>&1 &
