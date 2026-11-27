#!/bin/bash
set -euo pipefail
cd /w
V=SUNO-0_5-PREVIEW-X86_64
mkdir -p /w/live/iso/Suno-live
mv -f /w/live/iso/images/Suno/vmlinuz /w/live/iso/images/Suno/initrd.img /w/live/iso/Suno-live/ 2>/dev/null || true
chmod 0644 /w/live/iso/Suno-live/initrd.img
TRY=$'menuentry \'Try Suno 0.5 Preview without installing\' --class fedora --class gnu-linux --class gnu --class os {\n\tlinux /Suno-live/vmlinuz root=live:CDLABEL='"$V"$' rd.live.image rd.live.overlay.overlayfs=1 quiet rhgb\n\tinitrd /Suno-live/initrd.img\n}\nsubmenu \'Troubleshooting -->\''
rm -f Suno-0.5-preview-x86_64.iso.partial
mkksiso --ks /w/add/ks/Suno.ks -a /w/add/ks/Suno-auto-test.ks -a /w/Suno-repo \
  -a /w/live/iso/LiveOS -a /w/live/iso/Suno-live \
  -V $V \
  -R "submenu 'Troubleshooting -->'" "$TRY" \
  -R "Install Fedora 44" "Install Suno 0.5 Preview" \
  -R "install Fedora 44" "install Suno 0.5 Preview" \
  -R "Rescue a Fedora system" "Rescue a Suno system" \
  -R 'set default="1"' 'set default="0"' \
  --tmp /w/tmp \
  Fedora-Silverblue-ostree-x86_64-44-1.7.iso Suno-0.5-preview-x86_64.iso.partial
mv Suno-0.5-preview-x86_64.iso.partial Suno-0.5-preview-x86_64.iso
xorriso -osirrox on -indev Suno-0.5-preview-x86_64.iso -extract /EFI/BOOT/grub.cfg /w/out-efi.cfg -extract /boot/grub2/grub.cfg /w/out-bios.cfg >/dev/null 2>&1
ls -la Suno-0.5-preview-x86_64.iso
sha256sum Suno-0.5-preview-x86_64.iso > Suno-0.5-preview-x86_64.iso.sha256
echo DONE
