#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Wrap an assembled Try Suno directory as an offline Linux AppImage."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess

REPO = Path(__file__).resolve().parents[2]
RUNTIME_SHA256 = '156f4bdbde9c52d01814600013e0a273f0118dc2de98975f3c8c63427ec79074'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--portable-dir', type=Path, required=True)
p.add_argument('--runtime', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
assert hashlib.file_digest(a.runtime.open('rb'), 'sha256').hexdigest() == RUNTIME_SHA256
out = a.output.resolve()
out.mkdir(parents=True, exist_ok=False)
app = out / 'AppDir'
# The source is a task-owned immutable build result; hard links avoid duplicating
# the large guest disk during staging. No source file is edited through a link.
external = {}
for path in (a.portable_dir / 'catalog').glob('*.json'):
    manifest = json.loads(path.read_text())
    relative = manifest.get('external_image')
    if relative:
        expected = 'images/' + manifest['image']['sha256'] + ('.iso' if manifest.get('media')=='iso' else '.qcow2')
        assert relative == expected, 'External images require checksum filenames.'
        source = a.portable_dir / relative
        assert source.stat().st_size == manifest['image']['bytes']
        assert hashlib.file_digest(source.open('rb'), 'sha256').hexdigest() == manifest['image']['sha256']
        external[Path(relative).name] = relative

def omit_external(folder, names):
    return list(external) if Path(folder).resolve() == (a.portable_dir / 'images').resolve() else []

shutil.copytree(a.portable_dir, app, symlinks=True, copy_function=os.link, ignore=omit_external)
if not (app / 'Try Suno').exists() and (app / 'Suno Tester').is_file():
    (app / 'Suno Tester').rename(app / 'Try Suno')
for relative in external.values():
    target = out / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    os.link(a.portable_dir / relative, target)
# Generated launcher/metadata must not mutate their hard-linked portable inputs.
for relative in ('AppRun','.DirIcon','io.Suno.Tester.desktop','io.Suno.Tester.svg',
                 'usr/share/licenses/appimage-runtime/LICENSE'):
    (app / relative).unlink(missing_ok=True)
(app / 'AppRun').write_text('''#!/bin/sh
set -eu
tester_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$tester_dir/Try Suno" "$@"
''')
(app / 'AppRun').chmod(0o755)
(app / 'io.Suno.Tester.desktop').write_text('''[Desktop Entry]
Type=Application
Name=Try Suno
Comment=Try Suno or build apps for Mobile and Desktop
Exec=AppRun
Icon=io.Suno.Tester
Categories=Development;Emulator;
Terminal=false
''')
icon = app / 'usr/share/icons/hicolor/scalable/apps/io.Suno.Tester.svg'
assert icon.is_file(), icon
shutil.copy2(icon, app / 'io.Suno.Tester.svg')
(app / '.DirIcon').symlink_to('io.Suno.Tester.svg')
notice = app / 'usr/share/licenses/appimage-runtime'
notice.mkdir(parents=True, exist_ok=True)
shutil.copy2(REPO / 'packaging/standalone/tide/appimage-runtime.LICENSE', notice / 'LICENSE')
app.chmod(0o755)
subprocess.run(['desktop-file-validate', str(app / 'io.Suno.Tester.desktop')], check=True)
payload = out / 'payload.squashfs'
subprocess.run(['mksquashfs', str(app), str(payload), '-noappend', '-no-xattrs',
                '-all-root', '-comp', 'zstd', '-Xcompression-level', '6', '-processors', '2', '-mem', '1G'], check=True)
receipt = json.loads((a.portable_dir / 'build-receipt.json').read_text())
version = receipt.get('app_version', '0.1.0')
assert isinstance(version, str) and re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:[.-][A-Za-z0-9.-]+)?', version)
image = out / ('Try-Suno-' + version + '-linux-x86_64.AppImage')
with image.open('wb') as target:
    for source in (a.runtime, payload):
        with source.open('rb') as stream:
            shutil.copyfileobj(stream, target)
image.chmod(0o755)
with image.open('rb') as stream:
    sha = hashlib.file_digest(stream, 'sha256').hexdigest()
(out / 'SHA256SUMS').write_text(sha + '  ' + image.name + '\n')
(out / 'appimage-receipt.json').write_text(json.dumps({
    'runtime_sha256': RUNTIME_SHA256, 'sha256': sha, 'bytes': image.stat().st_size,
    'portable_source': json.loads((a.portable_dir / 'build-receipt.json').read_text())['source_commit'],
}, indent=2) + '\n')
print(str(image), sha, flush=True)
