#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

desktop_descriptor="$repo_root/assets/boot/Suno-loading.plymouth"
desktop_script="$repo_root/assets/boot/Suno-loading.script"
handheld_descriptor="$repo_root/assets/boot/Suno-loading-handheld.plymouth"
handheld_script="$repo_root/assets/boot/Suno-loading-handheld.script"
mobile_config="$repo_root/config/mobile/plymouthd.conf"
spec="$repo_root/packaging/rpm/Suno-boot-theme.spec"
composer="$repo_root/scripts/mobile/compose-fp6-rootfs.sh"

grep -Fxq 'Theme=Suno-loading-handheld' "$mobile_config"
grep -Fxq 'Theme=Suno-loading' "$repo_root/config/boot/plymouthd.conf"
grep -Fq 'ScriptFile=/usr/share/plymouth/themes/Suno-loading/Suno-loading.script' \
  "$desktop_descriptor"
grep -Fq 'global.logo_source = Image("Suno-wordmark.png");' "$desktop_script"
grep -Fq 'ScriptFile=/usr/share/plymouth/themes/Suno-loading-handheld/Suno-loading-handheld.script' \
  "$handheld_descriptor"

python3 - "$repo_root" <<'PYTHON'
from pathlib import Path
import importlib.util,json,sys
root=Path(sys.argv[1])
spec=importlib.util.spec_from_file_location('boot_compiler',root/'scripts/boot/compile-theme.py')
compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
for name,path,mobile in [('Suno-loading','config/boot/desktop-theme.json',False),
                         ('Suno-loading-handheld','config/mobile/boot-theme.json',True)]:
    expected=compiler.script(json.loads((root/path).read_text()),(root/'assets/boot/Suno-theme.script.in').read_text(),mobile)
    assert (root/f'assets/boot/{name}.script').read_text()==expected
PYTHON

grep -Fq 'Source8:        Suno-wordmark.svg' "$spec"
grep -Fq '%{_datadir}/Suno/boot/brand/Suno-wordmark.svg' "$spec"
grep -Fq 'build/packages/boot-theme/RPMS/noarch/$SUNO_BOOT_THEME_NEVRA.rpm' "$composer"
grep -Fq 'config/mobile/plymouthd.conf' "$composer"
test "$SUNO_BOOT_THEME_NEVRA" = Suno-boot-theme-0.1.0-1.Suno.15.fc44.noarch

printf 'Mobile boot-theme source contract: PASS\n'
