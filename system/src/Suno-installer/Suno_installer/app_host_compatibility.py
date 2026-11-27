# SPDX-License-Identifier: Apache-2.0
"""Signed app metadata gates host API changes before the installed app changes.

The supported floor is maintained with the host package, not downloaded from
catalogue JSON. An app requiring a newer host keeps its existing deployment.
"""
import configparser
import re
import subprocess

SUPPORTED_INSTALLER_RELEASE = 114
# Fixed maintained host owners, never an executable/package supplied by app
# metadata. Existing OS deployments stay compatible until a real host API is
# needed; a newer app is held before its installed commit changes.
HOST_PACKAGES = {
    'core': 'prairie-core-apps', 'continuity': 'Suno-continuity',
    'background': 'Suno-background', 'monitor': 'Suno-monitor',
    'ari': 'Suno-ari', 'mods': 'Suno-mods', 'charlie': 'Suno-charlie',
    'viola': 'viola-browser-stable', 'terminal': 'Suno-terminal',
}


def installed_host_release(component, runner=subprocess.run):
    package = HOST_PACKAGES[component]
    try:
        result = runner(['rpm', '-q', '--qf', '%{VERSION}-%{RELEASE}\\n', package],
                        capture_output=True, text=True, timeout=5, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return 0
    if result.returncode or len(result.stdout) > 4096:
        return 0
    lines = result.stdout.splitlines()
    if len(lines) != 1:
        return 0  # multiple installed identities are not an API declaration
    found = re.search(r'\.Suno\.([1-9][0-9]{0,5})\.', lines[0])
    if component == 'continuity' and found is None:
        found = re.fullmatch(r'[^\s]+-0\.([1-9][0-9]{0,5})\.experiment(?:\.[A-Za-z0-9_.]+)?', lines[0])
    if component == 'viola':
        found = re.fullmatch(r'[^\s]+-[1-9][0-9]*\.viola[0-9]+\.native([1-9][0-9]{0,5})(?:\.[A-Za-z0-9_.]+)?', lines[0])
    return int(found.group(1)) if found else 0


def require_host_compatibility(metadata, supported=SUPPORTED_INSTALLER_RELEASE, *, host_release=installed_host_release):
    from .depot_flatpak import SourceUnavailable
    if not isinstance(metadata, str) or len(metadata.encode('utf-8')) > 65536:
        raise SourceUnavailable('The signed application compatibility declaration is invalid.')
    parser = configparser.ConfigParser(interpolation=None, strict=True)
    try:
        parser.read_string(metadata)
        floor = parser.get('X-Suno', 'min-host-installer', fallback='')
    except configparser.Error as error:
        raise SourceUnavailable('The signed application compatibility declaration is invalid.') from error
    # Other distributors and existing apps may have no Suno-host dependency.
    if floor and not re.fullmatch(r'[1-9][0-9]{0,5}', floor):
        raise SourceUnavailable('The signed application compatibility declaration is invalid.')
    if floor and int(floor) > supported:
        raise SourceUnavailable('This version needs a newer Suno application service. Keep the current app or update Suno first.')

    for key, value in parser.items('X-Suno') if parser.has_section('X-Suno') else ():
        if not key.startswith('min-host-') or key == 'min-host-installer':
            continue
        component = key.removeprefix('min-host-')
        if component not in HOST_PACKAGES or not re.fullmatch(r'[1-9][0-9]{0,5}', value):
            raise SourceUnavailable('This application requires a host interface this device cannot provide. Keep the current app.')
        if host_release(component) < int(value):
            raise SourceUnavailable('This version needs a newer Suno host service. Keep the current app or update Suno first.')
