# SPDX-License-Identifier: Apache-2.0
"""Launcher guard tests; actual GTK/D-Bus identity is checked by SunoUI_runtime."""
import os
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from Suno_monitor.preview import PREVIEW_ID, make_application


class PreviewLauncherTests(unittest.TestCase):
    def test_hook_is_set_before_constructing_the_application(self):
        app=Mock();app.get_application_id.return_value=PREVIEW_ID
        seen=[]
        def construct():
            seen.append(os.environ.get('SUNO_MONITOR_PREVIEW'))
            return app
        with patch.dict(os.environ,{},clear=True), patch.dict(sys.modules,{'Suno_monitor.application':SimpleNamespace(MonitorApplication=construct)}):
            self.assertIs(make_application([]),app)
        self.assertEqual(seen,['1'])
        app.register.assert_not_called();app.run.assert_not_called()

    def test_machine_route_uses_the_same_preview_hook(self):
        app=Mock();app.get_application_id.return_value=PREVIEW_ID
        def construct():
            self.assertEqual(os.environ.get('SUNO_MONITOR_PREVIEW'),'1')
            self.assertTrue(os.environ['SUNO_MONITOR_STYLE_PATH'].endswith('/data/machine.css'))
            return app
        with patch.dict(os.environ,{},clear=True), patch.dict(sys.modules,{'Suno_monitor.machine_application':SimpleNamespace(MonitorApplication=construct)}):
            self.assertIs(make_application(['--this-machine']),app)

    def test_stale_or_ignored_hook_cannot_register_production(self):
        for arguments,module in [([], 'application'),(['--this-machine'],'machine_application')]:
            with self.subTest(module=module):
                app=Mock();app.get_application_id.return_value='io.Suno.Monitor'
                with patch.dict(os.environ,{},clear=True), patch.dict(sys.modules,{'Suno_monitor.'+module:SimpleNamespace(MonitorApplication=lambda:app)}):
                    with self.assertRaisesRegex(RuntimeError,'non-preview application identity'):
                        make_application(arguments)
                app.register.assert_not_called();app.run.assert_not_called()
