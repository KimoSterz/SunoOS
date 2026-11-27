# SPDX-License-Identifier: Apache-2.0
"""A capsule's icon is looked up only in the icon folders it has (backends._export_container_icon)."""
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from Suno_installer import backends


class CapsuleIcon(unittest.TestCase):
    def lookup(self, root: Path, icon: str):
        """Run the capsule's lookup script with its folders moved under ``root``; return (name, exit status)."""
        seen = []

        def run(arguments, **_):
            self.assertEqual(arguments[:3], ["podman", "exec", "capsule"])
            script = arguments[-1].replace("/usr/share/", f"{root}/usr/share/")
            done = subprocess.run(["sh", "-c", script], capture_output=True, text=True)
            seen.append(done.returncode)
            if done.returncode:
                raise backends.InstallerError("Unknown backend error")
            return done

        with patch.object(backends, "_run", side_effect=run), \
                patch.object(backends, "_install_icon", side_effect=lambda copied, _app: copied):
            try:
                name = backends._export_container_icon("capsule", icon, "app")
            except ModuleNotFoundError:  # Suno_appkit, for a found icon; the lookup itself is what is tested
                name = "found"
        return name, seen[0]

    def test_a_missing_pixmaps_folder_does_not_fail_the_install(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "usr/share/icons/hicolor/48x48/apps").mkdir(parents=True)
            self.assertEqual(self.lookup(root, "recorder"), ("recorder", 0))

    def test_no_icon_folders_at_all(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(self.lookup(Path(folder), "recorder"), ("recorder", 0))

    def test_an_icon_in_the_folder_that_exists_is_found(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            found = root / "usr/share/pixmaps/recorder.png"
            found.parent.mkdir(parents=True)
            found.write_bytes(b"png")
            calls = []
            with patch.object(backends, "_best_icon_path", side_effect=lambda paths: calls.append(paths) or ""):
                self.lookup(root, "recorder")
            self.assertEqual(calls, [[str(found)]])


if __name__ == "__main__":
    unittest.main()
