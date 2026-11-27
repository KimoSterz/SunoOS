# SPDX-License-Identifier: Apache-2.0
"""The independently delivered UI must not import host identity owners."""
import ast
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


class UiContract(unittest.TestCase):
    def test_actual_ui_imports_lightweight_wire_contracts_only(self):
        source = Path(__file__).resolve().parents[1] / 'Suno_continuity'
        tree = ast.parse((source / 'application.py').read_text())
        imports = {node.module for node in ast.walk(tree) if isinstance(node, ast.ImportFrom) and node.level}
        self.assertIn('phone_contract', imports)
        self.assertIn('companion_contract', imports)
        self.assertNotIn('daemon', imports)
        self.assertNotIn('companion_desktop', imports)
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory) / 'Suno_continuity'
            package.mkdir()
            for name in ('__init__.py', 'phone_contract.py', 'companion_contract.py'):
                shutil.copyfile(source / name, package / name)
            code = '''import sys
sys.path.insert(0, sys.argv[1])
from Suno_continuity.phone_contract import BUS, PATH
from Suno_continuity.companion_contract import DEFAULT_PHONE_TO_DESKTOP, DEFAULT_DESKTOP_TO_PHONE
assert BUS == "org.projectSuno.Connect1"
assert PATH == "/org/projectSuno/Connect"
assert "messages.read" not in DEFAULT_DESKTOP_TO_PHONE
assert "camera.stream" not in DEFAULT_DESKTOP_TO_PHONE
assert "notifications.mirror" in DEFAULT_PHONE_TO_DESKTOP
assert not any(name in sys.modules for name in ("Suno_continuity.daemon", "Suno_continuity.account", "Suno_continuity.policy", "Suno_continuity.transport", "cryptography"))
'''
            result = subprocess.run([sys.executable, '-B', '-I', '-c', code, directory], capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
