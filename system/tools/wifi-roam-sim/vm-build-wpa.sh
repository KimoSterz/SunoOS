#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# Build the patched wpa_supplicant from /root/src/wpa (Fedora 2.11-9 tree + Suno patches).
set -euo pipefail
cd /root/src/wpa/wpa_supplicant
cp defconfig .config
export CFLAGS="-O2 -g -fPIE -DPIE -Wall -DOPENSSL_NO_ENGINE" LDFLAGS="-pie -Wl,-z,now" BINDIR=/usr/sbin LIBDIR=/usr/lib64
make -j3 wpa_supplicant >/root/src/wpa-build.log 2>&1 || { tail -30 /root/src/wpa-build.log; exit 1; }
grep -E "warning" /root/src/wpa-build.log | grep -E "events.c|scan.c|bssid_ignore|wpa_supplicant.c|bgscan_simple" || true
install -m 0755 wpa_supplicant /usr/local/sbin/wpa_supplicant-Suno
echo built
