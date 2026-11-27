# SPDX-License-Identifier: Apache-2.0
"""The Suno-sync command, as a person runs it, against the fake Hub: a recovery key the person never got must
never happen. Turning Sync on with --words-file claims the file first; if it can't, Sync stays off."""
from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from fake_hub import FakeHub, serve  # noqa: E402
from harness import enrol_fake  # noqa: E402
from test_service import write_registration  # noqa: E402

RUN = "import sys; sys.path.insert(0, sys.argv[1]); from Suno_connect_sync import cli; sys.exit(cli.main(sys.argv[2:]))"


class CliTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="lcs-cli-"))
        self.fake = FakeHub()
        self.server = serve(self.fake)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.home = self.root / "home"
        self.home.mkdir()
        device, token = enrol_fake(self.url, "owner", "Desktop")
        write_registration(self.home, self.url, device, token, "Desktop")

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        shutil.rmtree(self.root, ignore_errors=True)

    def sync(self, *args: str) -> subprocess.CompletedProcess:
        env = {**os.environ, "HOME": str(self.home), "XDG_DATA_HOME": str(self.home / ".local/share"),
               "XDG_STATE_HOME": str(self.home / ".local/state"), "XDG_RUNTIME_DIR": str(self.home),
               "SUNO_CONNECT_SYNC_KEYSTORE": f"file:{self.home / 'keys'}", "GSETTINGS_BACKEND": "memory"}
        return subprocess.run([sys.executable, "-c", RUN, str(HERE.parent), *args], env=env, capture_output=True, text=True, timeout=120)

    def epoch(self) -> int:
        return self.fake.acct("owner")["epoch"]

    def test_setup_with_a_file_that_exists_leaves_sync_off(self) -> None:
        taken = self.root / "words.txt"
        taken.write_text("someone's notes\n")
        result = self.sync("setup", "--words-file", str(taken))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.epoch(), 0, "Sync was turned on although the recovery key had nowhere to go")
        self.assertEqual(taken.read_text(), "someone's notes\n", "an existing file is never touched")

    def test_setup_with_a_folder_that_is_missing_leaves_sync_off(self) -> None:
        result = self.sync("setup", "--words-file", str(self.root / "no-such-folder" / "words.txt"))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.epoch(), 0)

    def test_setup_writes_the_words_privately_then_turns_sync_on(self) -> None:
        target = self.root / "words.txt"
        result = self.sync("setup", "--words-file", str(target))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.epoch(), 1)
        self.assertEqual(len(target.read_text().split()), 24)
        self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
        # The same file again: refused before anything happens, and the first key stays as it was.
        before = target.read_text()
        again = self.sync("setup", "--words-file", str(target))
        self.assertNotEqual(again.returncode, 0)
        self.assertEqual(target.read_text(), before)

    def test_a_failed_setup_leaves_no_empty_file(self) -> None:
        self.assertEqual(self.sync("setup", "--words-file", str(self.root / "first.txt")).returncode, 0)
        second = self.root / "second.txt"
        result = self.sync("setup", "--words-file", str(second))     # the account already has Sync: setup refuses
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(second.exists(), "the claimed file goes again when nothing was made")


if __name__ == "__main__":
    unittest.main()
