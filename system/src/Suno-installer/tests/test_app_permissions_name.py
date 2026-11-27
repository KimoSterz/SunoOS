# SPDX-License-Identifier: Apache-2.0
"""AppPermissions1 owns its name outright: if another process holds it, the
service exits with an error instead of queueing behind it."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]

DRIVER = textwrap.dedent('''
    set -u
    python3 -c "
from gi.repository import Gio, GLib
Gio.bus_own_name(Gio.BusType.SESSION, 'org.projectSuno.AppPermissions1', 0, None, None, None)
loop = GLib.MainLoop(); GLib.timeout_add_seconds(20, loop.quit); loop.run()" &
    for _ in $(seq 1 50); do gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \\
      --method org.freedesktop.DBus.NameHasOwner org.projectSuno.AppPermissions1 | grep -q true && break; sleep 0.1; done
    timeout 15 python3 -c "from Suno_installer.app_permissions import main; raise SystemExit(main())"
    echo "EXIT=$?"
    kill $(jobs -p) 2>/dev/null || true
''')


@unittest.skipUnless(sys.platform.startswith('linux') and shutil.which('dbus-run-session'), 'needs a session bus')
class OwnName(unittest.TestCase):
    def test_a_name_already_held_stops_the_service(self):
        home = tempfile.mkdtemp(prefix='app-permissions-name-')
        self.addCleanup(shutil.rmtree, home, True)
        env = {**os.environ, 'HOME': home, 'XDG_DATA_HOME': f'{home}/data', 'XDG_CONFIG_HOME': f'{home}/config',
               'XDG_STATE_HOME': f'{home}/state', 'PYTHONPATH': str(ROOT)}
        env.pop('DBUS_SESSION_BUS_ADDRESS', None)
        result = subprocess.run(['dbus-run-session', '--', 'bash', '-c', DRIVER], env=env,
                                capture_output=True, text=True, timeout=60)
        self.assertIn('EXIT=1', result.stdout, result.stdout + result.stderr)
        self.assertIn('held by another process', result.stderr)


if __name__ == '__main__':
    unittest.main()
