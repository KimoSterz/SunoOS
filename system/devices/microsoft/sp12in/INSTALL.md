# Surface Pro 12-inch, first edition (Snapdragon)

This experimental profile is for the 2025 12-inch Surface Pro with Snapdragon
X Plus X1P-42-100, retail SKU
`Surface_Pro_12in_1st_Ed_with_Snapdragon_2110`. It does not target the Intel
Surface Pro 12th Edition, Surface Pro 11, or a later 12-inch generation.

No installable Suno Surface image has been qualified yet. The profile records
source inputs; it is not a download or an instruction to install a generic ARM
ISO. Hardware results must be recorded before calling this a supported device.

## First boot and installation

The first candidate must boot from USB without installing. Check internal storage,
display, keyboard, touch, charging, Wi-Fi and recovery before selecting installation.
The installer and installed deployment must carry the same kernel release,
modules and `qcom/x1p42100-microsoft-sp12in.dtb`. UEFI boots `BOOTAA64.EFI`;
this profile does not use phone flashing, Android boot images or an EL2 loader.

Development boot requires Secure Boot to be disabled until the release kernel
and boot chain have been signed and verified. Module signatures alone do not
make a kernel trusted by the Surface firmware. Preserve the owner's disk layout,
Windows, recovery partition and existing ESP contents. Installation must show
and confirm the exact destination before any destructive action. Never rewrite
firmware variables or install a firmware update as part of a USB boot test.

## Updates: the generic ARM image plus the Surface device repository

A Surface follows the one ARM OS commit (`Suno/1/aarch64/<channel>`) like every
other ARM computer. Its kernel, `kernel-surface-pro12` (vmlinuz, modules and
`/usr/lib/modules/<release>/devicetree`, which OSTree writes into every boot
entry), comes from the signed device repository
`https://dl.simplyluma.com/os/devices/aarch64/microsoft-sp12in/` as a
client-side rpm-ostree override: Fedora's kernel packages removed,
`kernel-surface-pro12` layered (`rpm-ostree status` shows it). Every OS update
rebuilds the override on the new commit and takes newer Surface kernels from
that repository; `/etc/yum.repos.d/Suno-microsoft-sp12in.repo` and
`/etc/pki/rpm-gpg/RPM-GPG-KEY-Suno-os-release` configure it. The device tree
(`microsoft,surface-pro-12in`) selects the Surface's per-device update holds,
so a release held for the Surface never blocks other ARM devices.

The owner's firmware stays on the Surface in `/etc/Suno/device-firmware`. It
is in the initramfs through `rpm-ostree initramfs-etc` and is found through
the `firmware_class.path=/etc/Suno/device-firmware` kernel argument. No
repository carries it.

A Surface installed from a private per-device image
(`Suno/1/aarch64/microsoft-sp12in/<channel>`) moves once with
`scripts/devices/sp12in-join-generic.sh`. Run it with `--dry-run` first. It
checks the device tree, the release key, the signed device repository and the
firmware record, then stages the generic commit with the override and stops.
The previous deployment stays in the boot menu as the rollback entry.

Hardware qualification includes an actual install, update and rollback;
successful compilation or a QEMU boot is insufficient.

## Personal firmware inputs

The first candidate is an owner-requested personal test image. Firmware payloads
stay outside Git and public feeds. `firmware.manifest` records the initial core
input names and hashes from Harrison Vanderbyl's public hardware reference at
`ea0f07e66beea95898d96fbeb6daa472f4735af3`; it does not grant redistribution.

Microsoft's [Surface driver package](https://www.microsoft.com/en-us/download/details.aspx?id=108199)
can supply production firmware without running Windows. Extract only the named
files; never execute its installer on the build host. Video decode requires a
matching production-signed `qcvss8380_pa.mbn`; the ordinary test-signed blob may
be rejected by retail TrustZone. This additional file must be hash-recorded in
the personal candidate receipt before use. The core manifest alone is not a
complete firmware, DSP userspace, audio-topology or camera calibration contract.

Before enabling speaker playback, verify the relevant amplifier power-limiting
fix and audio topology. Do not reuse another device owner's sensor calibration.
Suspend, video decode and cameras remain unqualified until tested on this Surface.
