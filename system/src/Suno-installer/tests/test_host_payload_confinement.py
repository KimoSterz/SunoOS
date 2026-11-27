# SPDX-License-Identifier: Apache-2.0
"""An AppImage on the device's /usr runs in the application domain with its own categories (launcher)."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from Suno_installer import closure_launcher, launcher


class HostPayload(unittest.TestCase):
    def confine(self, level):
        arguments = ["prlimit", "bwrap", "--die-with-parent", "--ro-bind", "/usr", "/usr", "--ro-bind", "/p", "/app"]
        with tempfile.TemporaryDirectory() as folder, \
                patch.object(closure_launcher, "application_level", return_value=level), \
                patch.object(closure_launcher, "label_data") as label_data, \
                patch("Suno_installer.launcher.subprocess.run") as run:
            root, data = Path(folder) / "AppDir", Path(folder) / "data"
            root.mkdir()
            data.mkdir()
            launcher._confine_host_payload(arguments, {"sha256": "x"}, root, data)
        return arguments, label_data, run, root, data

    def test_labels_lead_the_mounts_and_the_program_runs_in_the_domain(self):
        arguments, label_data, run, root, data = self.confine("s0:c12,c345")
        self.assertEqual(arguments[1:4], ["bwrap", "--file-label", "system_u:object_r:container_file_t:s0:c12,c345"])
        self.assertEqual(arguments[-2:], ["--exec-label", "system_u:system_r:Suno_application.process:s0:c12,c345"])
        label_data.assert_called_once_with(data, "s0:c12,c345")
        run.assert_called_once_with(["chcon", "-R", launcher.PAYLOAD_LABEL, str(root)], capture_output=True, check=False)

    def test_without_selinux_nothing_changes(self):
        arguments, label_data, run, _root, _data = self.confine("")
        self.assertNotIn("--exec-label", arguments)
        self.assertNotIn("--file-label", arguments)
        label_data.assert_not_called()
        run.assert_not_called()


class Policy(unittest.TestCase):
    def test_payloads_keep_the_read_only_type_and_the_account_database_is_readable(self):
        policy = (Path(__file__).resolve().parents[1] / "data/selinux/Suno_application.cil").read_text()
        for folder in ("appimages", "portable"):
            self.assertIn(f'(filecon "HOME_DIR/\\.local/share/Suno/{folder}(/.*)?" any (system_u object_r container_ro_file_t',
                          policy)
        self.assertIn("(allow process passwd_file_t (file (getattr open read map)))", policy)
        self.assertEqual(launcher.PAYLOAD_LABEL, "system_u:object_r:container_ro_file_t:s0")


if __name__ == "__main__":
    unittest.main()
