#!/usr/bin/python3 -B
# SPDX-License-Identifier: Apache-2.0
"""Check maintained noarch package identities and required shipped files."""
import argparse
import hashlib
from pathlib import Path
import subprocess

REQUIRED = {
    'Suno-android-runtime': {
        '/usr/bin/Suno-android', '/usr/bin/Suno-android-settings',
        '/usr/libexec/Suno-waydroid-container',
        '/usr/libexec/Suno-waydroid-package-session',
        '/usr/share/mime/packages/Suno-android.xml',
        '/usr/share/selinux/packages/Suno_android_runtime.cil',
    },
    'Suno-shell-state': {
        '/usr/libexec/Suno-shell-state-service', '/usr/bin/Suno-shell-statectl',
        '/usr/share/glib-2.0/schemas/org.projectSuno.shell-state.gschema.xml',
        '/usr/lib/systemd/user/graphical-session.target.wants/Suno-shell-state.service',
        '/usr/share/themes/Suno/gtk-4.0/gtk.css',
    },
    'prairie-icon-theme': {
        '/usr/share/icons/Prairie/index.theme',
        '/usr/share/icons/Prairie/scalable/apps/org.gnome.Nautilus.svg',
        '/usr/share/icons/Prairie/symbolic/actions/window-close-symbolic.svg',
        '/usr/share/glib-2.0/schemas/90-prairie.gschema.override',
        '/usr/share/doc/prairie-icon-theme/LUCIDE_REFERENCE_LICENSE.txt',
    },
    'Suno-application-installer': {
        '/usr/bin/Suno-installer', '/usr/bin/Suno-depot',
        '/usr/lib/systemd/user/Suno-retired-apps.service',
        '/usr/lib/systemd/system/Suno-retired-system-apps.service',
        '/usr/lib/systemd/user/default.target.wants/Suno-retired-apps.service',
        '/usr/lib/systemd/system/multi-user.target.wants/Suno-retired-system-apps.service',
    },
    'Suno-ari': {'/usr/bin/ari', '/usr/lib/systemd/user/ari-daemon.service'},
    'Suno-openh264': {
        '/usr/bin/Suno-openh264', '/usr/share/Suno-openh264/cisco-openh264.conf',
        '/usr/lib/systemd/system/Suno-openh264.service',
        '/usr/lib/systemd/system/timers.target.wants/Suno-openh264.timer',
        '/usr/lib/systemd/system-preset/60-Suno-openh264.preset',
        '/usr/lib/tmpfiles.d/Suno-openh264.conf',
        '/usr/share/polkit-1/rules.d/50-Suno-openh264.rules',
    },
    'Suno-desktop-launcher-policy': {
        '/usr/share/Suno/system-flatpak-replacements.txt',
        '/usr/libexec/Suno-flatpak-replacements',
    },
}


def output(*command):
    return subprocess.check_output(command, text=True).strip()


def check(root, spec):
    name = output('rpmspec', '--query', '--rpms', '--qf', '%{NAME}', str(spec))
    if name not in REQUIRED:
        raise ValueError('Not a maintained noarch component')
    expected = output('rpmspec', '--query', '--rpms', '--qf', '%{NEVRA}', str(spec))
    directory = (root / 'build/packages' / name).resolve()
    packages = list(directory.glob('RPMS/**/*.rpm'))
    if len(packages) != 1:
        raise ValueError('Expected exactly one noarch binary package')
    rpm = packages[0]
    if output('rpm', '-qp', '--nosignature', '--qf', '%{ARCH}', str(rpm)) != 'noarch':
        raise ValueError('Package is not architecture independent')
    if output('rpm', '-qp', '--nosignature', '--qf', '%{NEVRA}', str(rpm)) != expected:
        raise ValueError('Built package does not match the current source spec')
    covered = set()
    for line in (directory / 'SHA256SUMS').read_text().splitlines():
        digest, relative = line.split(maxsplit=1)
        path = (directory / relative.lstrip('*')).resolve()
        if not path.is_relative_to(directory):
            raise ValueError('Checksum path escaped package output')
        with path.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != digest:
                raise ValueError('Package checksum mismatch')
        covered.add(path)
    if rpm.resolve() not in covered:
        raise ValueError('Binary package is missing checksum coverage')
    files = set(output('rpm', '-qpl', '--nosignature', str(rpm)).splitlines())
    missing = REQUIRED[name] - files
    if missing:
        raise ValueError(f'Missing shipped files: {sorted(missing)}')
    if name == 'Suno-application-installer' and not any(
            path.endswith('/site-packages/Suno_installer/retired_apps.py') for path in files):
        raise ValueError('Installer does not ship its retirement implementation')
    if name == 'Suno-ari':
        requirements = output('rpm', '-qp', '--nosignature', '--requires', str(rpm)).splitlines()
        if 'Suno-display-config' not in requirements or any(
                row.split()[0] == 'Suno-displays' for row in requirements):
            raise ValueError('Ari must depend on the headless display backend')
    print(f'Checked {expected}: checksum, noarch header and required payload')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--spec', required=True, type=Path)
    args = parser.parse_args()
    check(Path.cwd(), args.spec)


if __name__ == '__main__':
    main()
