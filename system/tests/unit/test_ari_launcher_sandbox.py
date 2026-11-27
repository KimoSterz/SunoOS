# SPDX-License-Identifier: Apache-2.0
"""Ari's native path never admits one of Suno's launcher sandboxes."""
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'src/Suno-ari'))


class LauncherSandbox(unittest.TestCase):
    def test_app_Suno_scopes_and_host_dbus_proxies_are_sandboxes(self):
        try:
            from ari.host_identity import launcher_sandbox
        except ImportError as error:
            self.skipTest(f'Ari needs PyGObject here: {error}')
        for leaf, exe, expected in (('app-Suno-tool-42.scope', '/usr/bin/tool', True),
                                    ('app-gnome-x-1.scope', '/usr/bin/xdg-dbus-proxy', True),
                                    ('app-gnome-x-1.scope', '/usr/bin/python3', False)):
            with tempfile.TemporaryDirectory() as tmp:
                base = Path(tmp) / '9'
                base.mkdir()
                (base / 'cgroup').write_text(f'0::/user.slice/user@1000.service/app.slice/{leaf}\n')
                os.symlink(exe, base / 'exe')
                self.assertIs(launcher_sandbox(9, Path(tmp)), expected, (leaf, exe))


if __name__ == '__main__':
    unittest.main()
