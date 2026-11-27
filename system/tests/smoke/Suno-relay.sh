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

check 'Suno Relay package' rpm -q Suno-relay-0.1.0-1.Suno.9.fc44.noarch
check 'Relay Wine Explorer integration' \
  rpm -q wine-Suno-relay-explorer-11.0-3.Suno.2.fc44.x86_64
check 'Wine 11 runtime' bash -c 'wine --version | grep -Eq "wine-1[1-9]"'
check 'Wine Mono is packaged' rpm -q wine-mono
check 'Wine Gecko x86 is packaged' rpm -q mingw32-wine-gecko
check 'Wine Gecko x86_64 is packaged' rpm -q mingw64-wine-gecko
check 'DXVK is packaged' rpm -q wine-dxvk
check 'Relay sandbox is packaged' rpm -q bubblewrap
check 'Relay diagnostics pass' bash -c \
  'Suno-relay doctor | grep -q '"'"'"wine_available": true'"'"''
check 'EXE handler is Relay' bash -c \
  'test "$(xdg-mime query default application/vnd.microsoft.portable-executable)" = org.projectSuno.RelayInstaller.desktop'
check 'MSI handler is Relay' bash -c \
  'test "$(xdg-mime query default application/x-msi)" = org.projectSuno.RelayInstaller.desktop'
check 'No idle Relay daemon is installed' bash -c \
  '! systemctl --user list-unit-files | grep -q Suno-relay.service'
check 'Relay Wine override is source-owned and scoped' bash -c \
  'test -x /usr/libexec/Suno-relay/wine/x86_64-windows/explorer.exe && \
   test -x /usr/lib64/wine-wow64/wine/x86_64-windows/Suno_relay.dll && \
   test -x /usr/lib64/wine-wow64/wine/i386-windows/Suno_relay.dll && \
   test -x /usr/lib64/wine-wow64/wine/x86_64-unix/Suno_relay.so && \
   strings /usr/libexec/Suno-relay/wine/x86_64-windows/explorer.exe | \
     grep -q SUNO_RELAY_NOTIFY_SOCKET'

exit "$failures"
