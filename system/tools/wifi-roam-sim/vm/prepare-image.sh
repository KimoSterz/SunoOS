#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
P=${WIFI_ROAM_DIR:-/srv/dev-storage/projects/wifi-roam}
R=$P/vm/rootfs
echo wifi-roam-vm > $R/etc/hostname
echo "/dev/vda / ext4 defaults 0 1" > $R/etc/fstab
mkdir -p $R/root/.ssh && cp $P/vm/vmkey.pub $R/root/.ssh/authorized_keys && chmod 700 $R/root/.ssh && chmod 600 $R/root/.ssh/authorized_keys
sed -i "s/^root:[^:]*:/root::/" $R/etc/shadow
ln -sf /usr/lib/systemd/system/multi-user.target $R/etc/systemd/system/default.target
mkdir -p $R/etc/systemd/system/multi-user.target.wants
ln -sf /usr/lib/systemd/system/sshd.service $R/etc/systemd/system/multi-user.target.wants/sshd.service
ln -sf /usr/lib/systemd/system/NetworkManager.service $R/etc/systemd/system/multi-user.target.wants/NetworkManager.service
mkdir -p $R/etc/NetworkManager/conf.d
cat > $R/etc/NetworkManager/conf.d/90-harness.conf <<EOC
[device-harness]
match-device=interface-name:wlan4
wifi.scan-rand-mac-address=no
[connectivity]
enabled=false
[keyfile]
unmanaged-devices=interface-name:wlan0;interface-name:wlan1;interface-name:wlan2;interface-name:wlan3
EOC
rm -f $R/etc/machine-id; touch $R/etc/machine-id
rm -f $P/vm/rootfs.img
mke2fs -q -t ext4 -L wifiroam -d $R $P/vm/rootfs.img 12G
ls -lsh $P/vm/rootfs.img
