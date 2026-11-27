"""Valet's "Restoring from your other devices" (ADR-054): words, states, --restore, closing when done."""
import json
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from Suno_installer import valet_restore  # noqa: E402
from Suno_installer.valet_restore import RestoreController, RestoreModel  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = json.loads((ROOT / "tests/fixtures/valet-restore.json").read_text())


class RestoreModelTests(unittest.TestCase):
    def setUp(self):
        self.model = RestoreModel(FIXTURE["rows"], FIXTURE["devices"])
        self.rows = {r.name: r for r in self.model.rows()}

    def test_summary(self):
        self.assertEqual(self.model.summary(), "From Dell XPS 14 · 6 apps · you can use this ThinkPad while it works.")

    def test_rows_as_designed(self):
        kiln = self.rows["Kiln"]
        self.assertEqual((kiln.line, kiln.side, kiln.fraction, kiln.dimmed), (None, "180 of 410 MB", 0.44, False))
        diskord = self.rows["Diskord"]
        self.assertEqual((diskord.line, diskord.side, diskord.fraction), (None, "Installing…", 0.2))
        tide = self.rows["Tide"]
        self.assertEqual((tide.line, tide.ready, tide.fraction, tide.dimmed), ("Ready", True, None, False))
        self.assertEqual((self.rows["Recipe Box"].line, self.rows["Recipe Box"].dimmed), ("Waiting", True))
        mixer = self.rows["Studio Mixer"]
        self.assertEqual((mixer.line, mixer.dimmed), ("Not available for this device · x86 only", True))

    def test_progress_words(self):
        row = RestoreModel.row
        self.assertEqual(row({"app": "a", "state": "restoring", "progress": 0.5, "bytes": 3_000_000_000}).side, "1.5 of 3.0 GB")
        self.assertEqual(row({"app": "a", "state": "restoring", "progress": None, "bytes": None}).side, "Bringing over its data")
        self.assertEqual(row({"app": "a", "state": "installing", "progress": None}).fraction, 0.0)
        self.assertEqual(row({"app": "a", "state": "failed", "reason": ""}).line, "Couldn’t be installed")

    def test_sources(self):
        rows = [dict(FIXTURE["rows"][0]), dict(FIXTURE["rows"][1], **{"from": "pixel"})]
        devices = FIXTURE["devices"] + [{"device": "pixel", "name": "Pixel 9"}]
        self.assertTrue(RestoreModel(rows, devices).summary().startswith("From Dell XPS 14 and Pixel 9 · 2 apps"))
        self.assertTrue(RestoreModel(rows, []).summary().startswith("From your other devices · 2 apps · you can use this device"))

    def test_notification_words(self):
        done = [dict(r, state="ready") for r in FIXTURE["rows"][:5]] + [FIXTURE["rows"][5]]
        # The unavailable app stays in the list and isn't counted (design-center daccee5 banner.html?kind=restored).
        self.assertEqual(RestoreModel(done, FIXTURE["devices"]).done_notification(),
                         ("Your apps are ready", "5 apps from Dell XPS 14 are on this ThinkPad."))
        one = [dict(FIXTURE["rows"][1])]
        self.assertEqual(RestoreModel(one, []).done_notification(),
                         ("Your apps are ready", "1 app from your other devices is on this device."))
        # On a TV the Shell's TV toast shows the count as its value (design-center fbb3764).
        self.assertEqual(RestoreModel(done, FIXTURE["devices"]).done_notification(tv=True), ("Your apps are ready", "5 apps"))
        self.assertEqual(RestoreModel(one, []).done_notification(tv=True), ("Your apps are ready", "1 app"))

    def test_notification_has_show(self):
        done = [dict(r, state="ready") for r in FIXTURE["rows"]]
        made = mock.Mock()
        with mock.patch.object(valet_restore.Gio.Notification, "new", return_value=made) as new:
            note = valet_restore.done_notification(RestoreModel(done, FIXTURE["devices"]), tv=False)
        self.assertIs(note, made)
        new.assert_called_once_with("Your apps are ready")
        made.set_body.assert_called_once_with("6 apps from Dell XPS 14 are on this ThinkPad.")
        made.add_button.assert_called_once_with("Show", "app.show-restore")
        made.set_default_action.assert_called_once_with("app.show-restore")


class _Page:
    def __init__(self):
        self.models, self.wanted = [], None

    def update(self, model):
        self.models.append(model)

    def bring_wanted_into_view(self):
        pass


class _Source:
    fixture = {}

    def __init__(self, answers):
        self.answers = list(answers)

    def read(self, done):
        done(RestoreModel(self.answers.pop(0), FIXTURE["devices"]))

    def close(self):
        pass


class RestoreControllerTests(unittest.TestCase):
    def test_closes_to_a_notification_once_everything_is_done(self):
        pending = FIXTURE["rows"]
        done = [dict(r, state="ready") if r["state"] in {"restoring", "installing", "waiting"} else r for r in pending]
        finished = []
        controller = RestoreController(_Page(), finished=finished.append, source=_Source([pending, done, done]))
        self.assertEqual(finished, [])
        controller.refresh()
        self.assertEqual(len(finished), 1)
        controller.refresh()
        self.assertEqual(len(finished), 1, "told once")

    def test_opened_when_nothing_is_left_stays_open(self):
        finished = []
        RestoreController(_Page(), finished=finished.append, source=_Source([[dict(FIXTURE["rows"][1])]]))
        self.assertEqual(finished, [])


class RestoreRoutingTests(unittest.TestCase):
    def test_main_and_command_line(self):
        from Suno_installer import installer
        with mock.patch.object(installer.InstallerApplication, "run", autospec=True, return_value=0) as run:
            self.assertEqual(installer.main(["--restore", "org.example.Kiln"]), 0)
            self.assertEqual(run.call_args.args[1][1:], ["--restore", "org.example.Kiln"])
            self.assertEqual(installer.main(["--restore"]), 0)
            self.assertEqual(run.call_args.args[1][1:], ["--restore"])
        app = installer.InstallerApplication.__new__(installer.InstallerApplication)
        opened = []
        command = mock.Mock()
        command.get_arguments.return_value = ["Suno-install", "--restore", "org.example.Kiln"]
        with mock.patch.object(installer.InstallerApplication, "open_restore", lambda self, app_id=None: opened.append(app_id)), \
                mock.patch.dict("os.environ", {}, clear=False) as env:
            env.pop("SUNO_VALET_FIXTURE", None)
            installer.InstallerApplication.do_command_line(app, command)
            command.get_arguments.return_value = ["Suno-install", "--restore"]
            installer.InstallerApplication.do_command_line(app, command)
        self.assertEqual(opened, ["org.example.Kiln", None])

    def test_review_and_restore_both_route(self):
        """--restore joined --review on the same command line: each reaches its own window."""
        from Suno_installer import installer
        with mock.patch.object(installer.InstallerApplication, "run", autospec=True, return_value=0) as run, \
                mock.patch.dict("os.environ", {}, clear=False) as env:
            env.pop("SUNO_VALET_FIXTURE", None)
            for argv in (["--review", "org.example.Kiln"], ["--remove", "org.example.Kiln"],
                         ["--restore", "org.example.Kiln"], ["--restore"], ["--gapplication-service"]):
                self.assertEqual(installer.main(argv), 0)
                self.assertEqual(run.call_args.args[1][1:], argv)
            run.reset_mock()
            with mock.patch("sys.stderr"):
                for argv in (["--review"], ["--restore", "a", "b"], ["--bogus"]):
                    self.assertEqual(installer.main(argv), 2)
            run.assert_not_called()
        app = installer.InstallerApplication.__new__(installer.InstallerApplication)
        opened, windows = [], []
        command = mock.Mock()
        with mock.patch.object(installer.InstallerApplication, "open_restore", lambda self, app_id=None: opened.append(app_id)), \
                mock.patch.object(installer, "InstallerWindow", lambda app, **kw: windows.append(kw) or mock.Mock()), \
                mock.patch.dict("os.environ", {}, clear=False) as env:
            env.pop("SUNO_VALET_FIXTURE", None)
            command.get_arguments.return_value = ["Suno-install", "--review", "org.example.Kiln"]
            installer.InstallerApplication.do_command_line(app, command)
            command.get_arguments.return_value = ["Suno-install", "--restore", "org.example.Kiln"]
            installer.InstallerApplication.do_command_line(app, command)
        self.assertEqual(windows, [{"review_key": "org.example.Kiln"}])
        self.assertEqual(opened, ["org.example.Kiln"])

    def test_show_action_opens_the_list(self):
        from Suno_installer import installer
        app = installer.InstallerApplication()
        opened = []
        with mock.patch.object(installer.Adw.Application, "do_startup"), \
                mock.patch.object(installer, "cleanup_abandoned_user_transactions"), \
                mock.patch.object(installer.InstallerApplication, "open_restore", lambda self, app_id=None: opened.append(app_id)):
            installer.InstallerApplication.do_startup(app)
            app.lookup_action("show-restore").activate(None)
        self.assertEqual(opened, [None])

    def test_started_as_a_service_for_the_action(self):
        from Suno_installer import installer
        with mock.patch.object(installer.InstallerApplication, "run", autospec=True, return_value=0) as run:
            self.assertEqual(installer.main(["--gapplication-service"]), 0)
        app, argv = run.call_args.args
        self.assertEqual(argv[1:], ["--gapplication-service"])
        self.assertEqual(app.get_inactivity_timeout(), 10000)
        service = Path(__file__).resolve().parents[1] / "data/io.Suno.Valet.service"
        self.assertIn("Exec=/usr/bin/Suno-install --gapplication-service", service.read_text())


if __name__ == "__main__":
    unittest.main()
