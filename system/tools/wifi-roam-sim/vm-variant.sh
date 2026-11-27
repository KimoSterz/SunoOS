#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# before: Fedora packages (/root/rpms-stock). after: Suno RPMs from CI (/root/rpms).
# after-dev: patched wpa_supplicant built in the VM, stock NetworkManager.
set -euo pipefail
v=$1
systemctl stop NetworkManager wpa_supplicant 2>/dev/null || true
umount /usr/sbin/wpa_supplicant 2>/dev/null || true
rm -f /etc/NetworkManager/conf.d/95-iwd.conf   # wpa_supplicant backend for every variant here
systemctl stop iwd 2>/dev/null || true
case $v in
  before|after-dev) rpm -U --oldpackage --replacepkgs --nodeps /root/rpms-stock/*.rpm ;;
  after|after-new) rpm -U --oldpackage --replacepkgs --nodeps /root/rpms/*.rpm ;;
esac
# after-new: the CI packages with wpa_supplicant rebuilt in the VM from the current patches
case $v in after-dev|after-new) mount --bind /usr/local/sbin/wpa_supplicant-Suno /usr/sbin/wpa_supplicant ;; esac
systemctl start NetworkManager
sleep 3
q=$(rpm -q NetworkManager wpa_supplicant)
echo "$q"
case $v in
  after|after-new) echo "$q" | grep -q 'NetworkManager-1.56.1-2.Suno.2' && echo "$q" | grep -q 'wpa_supplicant-2.11-9.Suno.1' ;;
  *) ! echo "$q" | grep -q Suno ;;
esac
