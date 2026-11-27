#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Shared release checks run unchanged on native KVM or cross-architecture TCG.
Suno_os_gate_vm_target() {
  local arch=$1 host=$2 kvm_available=$3
  case "$arch" in
    x86_64) gate_machine=q35; gate_console=ttyS0 ;;
    aarch64) gate_machine=virt; gate_console=ttyAMA0 ;;
    *) Suno_os_die "unsupported gate architecture: $arch"; return 1 ;;
  esac
  # Native installs retain the existing one-hour bound. ARM guests emulated
  # on x86 hosts need more time for the same verified OSTree installation.
  gate_install_wait_minutes=60
  if [ "$arch" = aarch64 ] && [ "$host" = x86_64 ]; then
    gate_install_wait_minutes=180
  fi
  gate_cpu=max
  gate_virt=qemu
  if [ "$host" = "$arch" ] && [ "$kvm_available" = yes ]; then
    gate_cpu=host-passthrough
    gate_virt=kvm
  fi
  gate_caps_args=(--arch "$arch" --machine "$gate_machine" --virttype "$gate_virt")
  gate_boot=uefi
  if [ -n "${SUNO_OS_GATE_EMULATOR:-}" ]; then
    [[ "$SUNO_OS_GATE_EMULATOR" = /* && "$SUNO_OS_GATE_EMULATOR" != *,* && -x "$SUNO_OS_GATE_EMULATOR" ]] ||
      { Suno_os_die 'gate emulator must be an executable absolute path without commas'; return 1; }
    gate_caps_args+=(--emulatorbin "$SUNO_OS_GATE_EMULATOR")
    gate_boot+=",emulator=$SUNO_OS_GATE_EMULATOR"
  fi
  gate_explicit_firmware=no
  if [ -n "${SUNO_OS_GATE_UEFI_CODE:-}${SUNO_OS_GATE_UEFI_VARS:-}" ]; then
    local path
    for path in "${SUNO_OS_GATE_UEFI_CODE:-}" "${SUNO_OS_GATE_UEFI_VARS:-}"; do
      [[ "$path" = /* && "$path" != *,* && -f "$path" && -r "$path" ]] ||
        { Suno_os_die 'gate UEFI code and variable template must both be readable absolute file paths without commas'; return 1; }
    done
    # A separate writable NVRAM is created by libvirt for every disposable VM.
    gate_boot="loader=$SUNO_OS_GATE_UEFI_CODE,loader.readonly=yes,loader.type=pflash,nvram.template=$SUNO_OS_GATE_UEFI_VARS${SUNO_OS_GATE_EMULATOR:+,emulator=$SUNO_OS_GATE_EMULATOR}"
    gate_explicit_firmware=yes
  fi
}

Suno_os_gate_vm_preflight() {
  local output=$1
  # virt-install consults global host capabilities before its explicit emulator
  # option; successful per-emulator domcaps alone does not admit this host.
  virsh --connect qemu:///system capabilities >"$output.host.xml"
  python3 - "$output.host.xml" "$SUNO_OS_ARCH" "$gate_virt" <<'PYHOST' || return
import sys
import xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
if not any(guest.findtext('os_type') == 'hvm' and
           guest.find(f"arch[@name='{sys.argv[2]}']/domain[@type='{sys.argv[3]}']") is not None
           for guest in root.findall('guest')):
    raise SystemExit('libvirt host capabilities do not advertise selected architecture/accelerator; provision its native-host emulator package before using virt-install')
PYHOST
  virsh --connect qemu:///system domcapabilities "${gate_caps_args[@]}" >"$output" ||
    { Suno_os_die "libvirt cannot run $SUNO_OS_ARCH/$gate_machine with $gate_virt; provision its emulator or set SUNO_OS_GATE_EMULATOR"; return 1; }
  python3 - "$output" "$SUNO_OS_ARCH" "$gate_virt" "$gate_explicit_firmware" <<'PY' || return
import sys
import xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
if root.findtext('arch') != sys.argv[2] or root.findtext('domain') != sys.argv[3]:
    raise SystemExit('gate libvirt capabilities do not match selected architecture/accelerator')
if sys.argv[4] != 'yes' and 'efi' not in [v.text for v in root.findall("os/enum[@name='firmware']/value")]:
    raise SystemExit('gate UEFI firmware is unavailable; provision architecture firmware or set both SUNO_OS_GATE_UEFI_CODE and SUNO_OS_GATE_UEFI_VARS')
PY
  local inputs=()
  [ -z "${SUNO_OS_GATE_EMULATOR:-}" ] || inputs+=("$SUNO_OS_GATE_EMULATOR")
  [ "$gate_explicit_firmware" != yes ] || inputs+=("$SUNO_OS_GATE_UEFI_CODE" "$SUNO_OS_GATE_UEFI_VARS")
  [ "${#inputs[@]}" -eq 0 ] || sha256sum -- "${inputs[@]}" >"$output.inputs.sha256"
}

# Give an admitted media qualification its own names and disk tree. The optional
# scope is a release build ID, never an arbitrary path supplied by a caller.
Suno_os_media_vm_run() {
  local timestamp=$1 scope=${SUNO_MEDIA_VM_SCOPE:-}
  [[ "$timestamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || { Suno_os_die 'invalid media VM timestamp'; return 1; }
  if [ -n "$scope" ]; then
    [[ "$scope" =~ ^[0-9]{8}\.[0-9]+$ ]] || { Suno_os_die 'invalid media VM scope'; return 1; }
    printf '%s-%s\n' "$scope" "$timestamp"
  else
    printf '%s\n' "$timestamp"
  fi
}
