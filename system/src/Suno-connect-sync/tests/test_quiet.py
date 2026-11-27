# SPDX-License-Identifier: Apache-2.0
"""The quiet-point watcher (ADR-054 §4.3): every run of an app is seen, however short; the service's own
sign-in helpers never count as the person using the app; newer state that waited on an app is applied once
the app is quiet, whether or not its close was seen. Linux only (reads /proc)."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from Suno_connect_sync import quiet  # noqa: E402

DEAD_PID = 4194000      # above any pid this test machine hands out


class WatcherTest(unittest.TestCase):
    def setUp(self) -> None:
        self.runtime = Path(tempfile.mkdtemp(prefix="quiet-"))
        (self.runtime / ".flatpak").mkdir()
        self._env = os.environ.get("XDG_RUNTIME_DIR")
        os.environ["XDG_RUNTIME_DIR"] = str(self.runtime)
        self._quiet = quiet.QUIET_SECONDS
        quiet.QUIET_SECONDS = 0.3
        quiet.HELPERS = quiet.Helpers()
        self.calls: list[set[str]] = []
        self.watcher = quiet.Watcher(on_closed=lambda apps: self.calls.append(set(apps)))
        self.sleepers: list[subprocess.Popen] = []

    def tearDown(self) -> None:
        for process in self.sleepers:
            process.kill()
            process.wait()
        quiet.QUIET_SECONDS = self._quiet
        if self._env is None:
            os.environ.pop("XDG_RUNTIME_DIR", None)
        else:
            os.environ["XDG_RUNTIME_DIR"] = self._env
        shutil.rmtree(self.runtime, ignore_errors=True)

    # -- a fake Flatpak instance folder, as `flatpak run` leaves it
    def instance(self, name: str, app: str, alive: bool) -> subprocess.Popen | None:
        folder = self.runtime / ".flatpak" / name
        folder.mkdir()
        (folder / "info").write_text(f"[Application]\nname={app}\n\n[Instance]\ninstance-id={name}\n")
        process = None
        pid = DEAD_PID
        if alive:
            process = subprocess.Popen(["sleep", "60"])
            self.sleepers.append(process)
            pid = process.pid
        (folder / "bwrapinfo.json").write_text(f'{{"child-pid": {pid}}}')
        return process

    def settle(self) -> None:
        time.sleep(quiet.QUIET_SECONDS + 0.1)
        self.watcher.poll()

    def test_a_run_between_two_looks_counts(self) -> None:
        self.watcher.poll()
        self.instance("111", "org.example.Editor", alive=False)     # started and ended before the next look
        closed = self.watcher.poll()
        self.assertEqual(closed, {"org.example.Editor"})
        self.assertFalse(self.watcher.quiet("org.example.Editor"))  # the quiet point starts at the run
        self.assertEqual(self.calls, [])
        self.settle()
        self.assertEqual(self.calls, [{"org.example.Editor"}])
        self.settle()
        self.assertEqual(self.calls, [{"org.example.Editor"}], "one call per close")

    def test_a_running_app_then_closing(self) -> None:
        self.watcher.poll()
        process = self.instance("222", "org.example.Editor", alive=True)
        self.assertEqual(self.watcher.poll(), set())
        self.assertTrue(self.watcher.is_running("org.example.Editor"))
        self.settle()
        self.assertEqual(self.calls, [], "no call while it runs")
        process.kill()
        process.wait()
        self.assertEqual(self.watcher.poll(), {"org.example.Editor"})
        self.settle()
        self.assertEqual(self.calls, [{"org.example.Editor"}])

    def test_relaunch_before_the_quiet_point_holds_it(self) -> None:
        self.watcher.poll()
        self.instance("333", "org.example.Editor", alive=False)
        self.watcher.poll()
        self.instance("334", "org.example.Editor", alive=True)
        self.watcher.poll()
        self.settle()
        self.assertEqual(self.calls, [])

    def test_first_look_ignores_old_instances(self) -> None:
        self.instance("444", "org.example.Old", alive=False)
        self.assertEqual(self.watcher.poll(), set())
        self.assertTrue(self.watcher.quiet("org.example.Old"))
        self.settle()
        self.assertEqual(self.calls, [])

    def test_helper_runs_never_count(self) -> None:
        self.watcher.poll()
        quiet.HELPERS.begin("org.example.Editor")
        self.instance("555", "org.example.Editor", alive=False)
        self.assertEqual(self.watcher.poll(), set(), "unclassified while the helper's id is unknown")
        quiet.HELPERS.identify("org.example.Editor", "555")
        self.assertEqual(self.watcher.poll(), set())
        self.assertTrue(self.watcher.quiet("org.example.Editor"))
        self.settle()
        self.assertEqual(self.calls, [])

    def test_a_person_closing_the_app_while_a_helper_runs_is_seen(self) -> None:
        # The old rule ignored any close within 10 s of a helper run; a person's edit then waited 5 minutes.
        self.watcher.poll()
        quiet.HELPERS.begin("org.example.Editor")
        self.instance("666", "org.example.Editor", alive=False)     # the helper
        self.instance("667", "org.example.Editor", alive=False)     # the person, a short run
        self.watcher.poll()
        quiet.HELPERS.identify("org.example.Editor", "666")
        self.assertEqual(self.watcher.poll(), {"org.example.Editor"})
        self.settle()
        self.assertEqual(self.calls, [{"org.example.Editor"}])

    def test_a_helper_without_an_id_unblocks_the_rest(self) -> None:
        self.watcher.poll()
        quiet.HELPERS.begin("org.example.Editor")
        self.instance("777", "org.example.Editor", alive=False)
        self.watcher.poll()
        quiet.HELPERS.identify("org.example.Editor", None)
        self.assertEqual(self.watcher.poll(), {"org.example.Editor"}, "counted rather than lost")

    def test_waiting_state_is_called_for_once_quiet(self) -> None:
        self.watcher.poll()
        process = self.instance("888", "org.example.Notes", alive=True)
        self.watcher.poll()
        self.watcher.wait_for({"org.example.Notes"})
        # The close itself is never seen as a close: the instance folder is gone (Flatpak cleaned it up).
        process.kill()
        process.wait()
        shutil.rmtree(self.runtime / ".flatpak" / "888")
        self.watcher.poll()
        self.settle()
        self.assertEqual(self.calls, [{"org.example.Notes"}])
        self.settle()
        self.assertEqual(self.calls, [{"org.example.Notes"}])

    def test_waiting_on_an_app_already_quiet_is_not_a_loop(self) -> None:
        self.watcher.poll()
        self.watcher.wait_for({"org.example.Quiet"})                # e.g. waiting for an update: no call at all
        self.settle()
        self.assertEqual(self.calls, [])

    def test_store_app_run_between_two_looks(self) -> None:
        self.watcher.poll()
        folder = self.runtime / "Suno-apps" / "deb-galculator-1"
        folder.mkdir(parents=True)
        (folder / ".running").touch()
        self.assertEqual(self.watcher.poll(), {"deb-galculator-1"})
        shutil.rmtree(folder)
        self.watcher._gone_store.add("org.example.Gone")            # what the file monitor reports for a vanished folder
        self.assertEqual(self.watcher.poll(), {"org.example.Gone"})
        self.settle()
        self.assertEqual(self.calls, [{"deb-galculator-1", "org.example.Gone"}])

    def test_the_thread_sees_a_short_run_through_the_file_monitor(self) -> None:
        try:
            import gi  # noqa: F401
        except ImportError:
            self.skipTest("no PyGObject")
        import threading
        self.watcher.interval = 30                                  # only the monitor can make it look
        thread = threading.Thread(target=self.watcher.run, daemon=True)
        thread.start()
        time.sleep(0.5)
        self.instance("999", "org.example.Editor", alive=False)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and "org.example.Editor" not in self.watcher.last_running:
            time.sleep(0.05)
        self.watcher.stop()
        thread.join(timeout=5)
        self.assertIn("org.example.Editor", self.watcher.last_running)


if __name__ == "__main__":
    unittest.main()
