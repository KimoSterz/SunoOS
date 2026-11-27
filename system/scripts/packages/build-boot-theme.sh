#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in git mktemp podman sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required boot-theme build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

output_dir="$repo_root/build/packages/boot-theme"
figtree_rpm="$repo_root/build/packages/figtree-fonts/RPMS/noarch/$FIGTREE_NEVRA.rpm"
test -f "$figtree_rpm" || {
  printf 'error: build the pinned Figtree RPM before the boot theme\n' >&2
  exit 1
}
mkdir -p "$output_dir"
work_dir=$(mktemp -d "$output_dir/work.XXXXXX")
rpmbuild_dir="$work_dir/rpmbuild"
mkdir -p "$output_dir" "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
install -m 0644 "$figtree_rpm" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/website/public/brand/Suno-wordmark.svg" \
  "$rpmbuild_dir/SOURCES/Suno-wordmark.svg"
install -m 0644 "$repo_root/assets/boot/Suno-loading-dot.svg" \
  "$rpmbuild_dir/SOURCES/Suno-loading-dot.svg"

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" "$FEDORA_RPM_BUILD_CONTAINER" '
    set -euo pipefail
    dnf5 -y install grub2-tools-extra librsvg2-tools python3 systemd-rpm-macros \
      SOURCES/google-figtree-fonts-*.rpm
    for size in 12 16 22; do
      output=SOURCES/prairie-$size.pf2
      [ "$size" != 16 ] || output=SOURCES/prairie.pf2
      grub2-mkfont --output="$output" --name=Prairie --size="$size" \
        /usr/share/fonts/google-figtree-fonts/Figtree\[wght\].ttf
      test -s "$output"
    done
    install -m 0644 /usr/share/licenses/google-figtree-fonts/OFL.txt SOURCES/OFL.txt
    sed '"'"'s/fill="currentColor"/fill="#21252B"/'"'"' \
      SOURCES/Suno-wordmark.svg >SOURCES/Suno-wordmark-render.svg
    rsvg-convert --width=2219 --height=715 \
      --output=SOURCES/Suno-wordmark.png SOURCES/Suno-wordmark-render.svg
    rsvg-convert --width=64 --height=64 \
      --output=SOURCES/Suno-loading-dot.png SOURCES/Suno-loading-dot.svg
    sed '"'"'s/fill="currentColor"/fill="#F2F3F4"/'"'"' \
      SOURCES/Suno-wordmark.svg >SOURCES/Suno-wordmark-render.svg
    rsvg-convert --width=2219 --height=715 \
      --output=SOURCES/Suno-wordmark-ink.png SOURCES/Suno-wordmark-render.svg
    sed '"'"'s/#21252B/#F2F3F4/'"'"' SOURCES/Suno-loading-dot.svg \
      >SOURCES/Suno-loading-dot-ink.svg
    rsvg-convert --width=64 --height=64 \
      --output=SOURCES/Suno-loading-dot-ink.png SOURCES/Suno-loading-dot-ink.svg
    test -s SOURCES/Suno-wordmark.png
    test -s SOURCES/Suno-loading-dot.png
    rm -f SOURCES/Suno-wordmark-render.svg
  '

install -m 0644 "$repo_root/packaging/rpm/Suno-boot-theme.spec" \
  "$rpmbuild_dir/SPECS/"
install -m 0644 "$repo_root/assets/boot/Suno-loading.plymouth" \
  "$repo_root/assets/boot/Suno-loading.script" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/assets/boot/Suno-loading-handheld.plymouth" \
  "$repo_root/assets/boot/Suno-loading-handheld.script" \
  "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/assets/boot/Suno-firmware.plymouth" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/scripts/boot/render-firmware-theme.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/config/boot/plymouthd.conf" \
  "$repo_root/config/boot/plymouthd.conf.previous" \
  "$repo_root/config/boot/Suno-boot-splash-migrate.service" \
  "$repo_root/config/boot/09_Suno_hidden_menu.cfg" \
  "$repo_root/config/boot/Suno-boot-hidden-menu.service" \
  "$rpmbuild_dir/SOURCES/"
install -m 0755 "$repo_root/config/boot/Suno-boot-hidden-menu" "$rpmbuild_dir/SOURCES/"
install -m 0755 "$repo_root/config/boot/Suno-boot-splash-migrate" "$rpmbuild_dir/SOURCES/"
install -m 0755 "$repo_root/config/boot/dracut/module-setup.sh" \
  "$rpmbuild_dir/SOURCES/Suno-boot-splash-module-setup.sh"
install -m 0755 "$repo_root/tests/smoke/boot-splash-migrate.sh" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/assets/boot/Suno-theme.script.in" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/scripts/boot/compile-theme.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/config/boot/desktop-theme.json" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/config/mobile/boot-theme.json" "$rpmbuild_dir/SOURCES/mobile-theme.json"
install -m 0644 "$repo_root/assets/boot/LICENSE" \
  "$rpmbuild_dir/SOURCES/LICENSE"
install -m 0644 "$repo_root/assets/boot/grub-theme/theme.txt" \
  "$rpmbuild_dir/SOURCES/Suno-grub-theme.txt"
install -m 0644 "$repo_root/scripts/boot/check-grub-fonts.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/config/boot/Suno.cfg" \
  "$rpmbuild_dir/SOURCES/Suno.cfg"
install -m 0755 "$repo_root/config/boot/apply-grub-policy.sh" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/scripts/boot/prepare-efi-identity.py" \
  "$repo_root/tests/unit/test_Suno_efi_identity.py" "$rpmbuild_dir/SOURCES/"

# Compile profiles inside the same Fedora rasterization boundary. A minimal
# source layout keeps this reproducible from the SRPM's retained source files.
"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" "$FEDORA_RPM_BUILD_CONTAINER" '
    set -euo pipefail
    mkdir -p profile-source/assets/boot/grub-theme profile-source/website/public/brand
    cp SOURCES/Suno-theme.script.in profile-source/assets/boot/
    cp SOURCES/Suno-grub-theme.txt profile-source/assets/boot/grub-theme/theme.txt
    cp SOURCES/Suno-wordmark.svg profile-source/website/public/brand/
    python3 SOURCES/compile-theme.py --root profile-source \
      --desktop-profile SOURCES/desktop-theme.json --mobile-profile SOURCES/mobile-theme.json \
      --output SOURCES
  '

"$repo_root/scripts/packages/run-in-rpm-builder.sh" \
  "$rpmbuild_dir" "$FEDORA_RPM_BUILD_CONTAINER" '
    set -euo pipefail
    dnf5 -y install rpm-build python3 librsvg2-tools systemd-rpm-macros
    rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-boot-theme.spec
    rpm_path=$(find RPMS/noarch -type f -name "Suno-boot-theme-*.rpm" -print -quit)
    test -n "$rpm_path"
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/Suno-loading/Suno-loading.plymouth
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/Suno-loading/Suno-loading.script
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/Suno-loading/Suno-wordmark.png
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/Suno-loading/Suno-loading-dot.png
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/Suno-loading-handheld/Suno-loading-handheld.plymouth
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/Suno-loading-handheld/Suno-loading-handheld.script
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/Suno-loading-handheld/Suno-wordmark.png
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/Suno-loading-handheld/Suno-loading-dot.png
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/Suno/boot/brand/Suno-wordmark.svg
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/plymouth/themes/default.plymouth
    # two-step will not start without lock, entry and bullet; the rest is
    # what makes it Suno rather than a text fallback.
    for image in Suno-firmware.plymouth watermark.png lock.png entry.png bullet.png \
      keyboard.png capslock.png keymap-render.png throbber-0001.png throbber-0060.png; do
      rpm -qpl "$rpm_path" |
        grep -Fx >/dev/null "/usr/share/plymouth/themes/Suno-firmware/$image"
    done
    test "$(rpm -qpl "$rpm_path" | grep -c "/Suno-firmware/throbber-[0-9]*\.png\$")" = 60
    rpm -qp --dump "$rpm_path" |
      grep -F >/dev/null "/usr/share/plymouth/themes/default.plymouth "
    rpm -qp --dump "$rpm_path" | awk '"'"'$1 == "/usr/share/plymouth/themes/default.plymouth" { print $NF }'"'"' |
      grep -Fx >/dev/null Suno-loading/Suno-loading.plymouth
    for image in prompt-lock.png prompt-field.png prompt-bullet.png prompt-capslock.png; do
      rpm -qpl "$rpm_path" |
        grep -Fx >/dev/null "/usr/share/plymouth/themes/Suno-loading/$image"
    done
    for path in /usr/share/Suno/boot/plymouthd.conf /usr/share/Suno/boot/plymouthd.conf.previous \
      /usr/libexec/Suno-boot-splash-migrate /usr/lib/systemd/system/Suno-boot-splash-migrate.service \
      /usr/lib/dracut/modules.d/46Suno-boot-splash/module-setup.sh \
      /usr/lib/systemd/system/sysinit.target.wants/Suno-boot-splash-migrate.service \
      /usr/lib/bootupd/grub2-static/configs.d/09_Suno_hidden_menu.cfg \
      /usr/libexec/Suno-boot-hidden-menu /usr/lib/systemd/system/Suno-boot-hidden-menu.service \
      /usr/lib/systemd/system/multi-user.target.wants/Suno-boot-hidden-menu.service; do
      rpm -qpl "$rpm_path" | grep -Fx >/dev/null "$path"
    done
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/Suno/boot/grub-theme/theme.txt
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/Suno/boot/grub-theme/prairie.pf2
    rpm -qpl "$rpm_path" |
      grep -Fx >/dev/null /usr/share/Suno/boot/Suno.cfg
  '

install -d -m 0755 "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir/RPMS/noarch/$SUNO_BOOT_THEME_NEVRA.rpm" \
  "$output_dir/RPMS/noarch/"
install -m 0644 "$rpmbuild_dir/SRPMS/Suno-boot-theme-${SUNO_BOOT_THEME_VERSION}-${SUNO_BOOT_THEME_RELEASE}.fc44.src.rpm" \
  "$output_dir/SRPMS/"
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno boot-theme packages: %s\n' "$output_dir"
