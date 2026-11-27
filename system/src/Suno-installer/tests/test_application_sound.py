# SPDX-License-Identifier: Apache-2.0
"""Each application's own PulseAudio server and the microphone permission (app_sound, data/pipewire)."""
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from Suno_installer import app_permissions, app_sound, package_access, session_boundary

DATA = Path(__file__).resolve().parents[1] / "data/pipewire"
APP = "org.projectSuno.Installed.deb-Suno-test-player"


def text(name):
    return (DATA / name).read_text(encoding="utf-8")


def code(name):
    """The file without its comments."""
    return "\n".join(line for line in text(name).splitlines() if not line.lstrip().startswith(("#", "--")))


class Units(unittest.TestCase):
    def test_instance_names_are_systemd_escaped(self):
        self.assertEqual(app_sound.escape(APP), "org.projectSuno.Installed.deb\\x2dSuno\\x2dtest\\x2dplayer")
        self.assertEqual(app_sound.escape(".hidden/x"), "\\x2ehidden-x")
        self.assertEqual(app_sound.unit("org.mozilla.firefox"), "Suno-application-sound@org.mozilla.firefox.socket")
        if shutil.which("systemd-escape"):
            for app in (APP, "org.gnome.Lollypop", "io.github.a_b-c.D"):
                done = subprocess.run(["systemd-escape", app], capture_output=True, text=True, check=True)
                self.assertEqual(app_sound.escape(app), done.stdout.strip())

    def test_only_application_ids(self):
        for bad in ("", ".x", "a/b", "a b", "a;b", "../x"):
            self.assertFalse(app_sound.valid(bad), bad)
        self.assertTrue(app_sound.valid(APP))

    def test_start_returns_the_listening_socket(self):
        with tempfile.TemporaryDirectory(dir="/tmp") as folder:  # a socket path has 108 bytes
            runtime, units = Path(folder) / "run", Path(folder) / "units"
            units.mkdir()
            calls = []

            def runner(argv, **_):
                calls.append(argv)
                path = app_sound.socket_path(APP, runtime)
                path.parent.mkdir(parents=True)
                server = socket.socket(socket.AF_UNIX)
                server.bind(str(path))
                self.addCleanup(server.close)
                return SimpleNamespace(returncode=0)

            self.assertIsNone(app_sound.start(APP, runtime, runner=runner, directories=(units,)))  # no unit installed
            (units / "Suno-application-sound@.socket").touch()
            found = app_sound.start(APP, runtime, runner=runner, directories=(units,))
            self.assertEqual(found, runtime / "Suno-sound" / APP / "native")
            self.assertEqual(calls, [["systemctl", "--user", "start", app_sound.unit(APP)]])
            self.assertIsNone(app_sound.start("../x", runtime, runner=runner, directories=(units,)))

    def test_removal_stops_and_disables_socket_and_server(self):
        calls = []
        app_sound.disable(APP, runner=lambda argv, **_: calls.append(argv))
        self.assertEqual(calls, [["systemctl", "--user", "disable", "--now", app_sound.unit(APP),
                                  app_sound.unit(APP, "service")]])
        with patch.object(app_sound, "disable") as disable, \
                patch("Suno_installer.app_permissions.Permissions.forget"), \
                patch("Suno_installer.flatpak_permissions.forget"), patch("Suno_installer.native_messaging.forget_app"):
            package_access.forget(APP)
        disable.assert_called_once_with(APP)

    def test_units_point_at_one_folder_that_goes_with_the_socket(self):
        unit = text("Suno-application-sound@.socket")
        self.assertIn("ListenStream=%t/Suno-sound/%I/native", unit)
        self.assertIn("ExecStopPost=/usr/bin/rm -rf %t/Suno-sound/%I", unit)
        self.assertIn("ExecStart=/usr/libexec/Suno-application-sound %I", text("Suno-application-sound@.service"))


class ServerConfig(unittest.TestCase):
    def test_the_identity_rule_comes_last_and_matches_every_client(self):
        config = code("Suno-application-sound.conf.in")
        rules = config[config.index("pulse.rules"):]
        last = rules[rules.rindex("matches"):]
        self.assertIn('matches = [ { client.api = "~.*" } { client.api = null } ]', last)
        for line in ('pipewire.client.access = "Suno-application"', 'pipewire.access.portal.app_id = "@APP@"',
                     'remote.name = "pipewire-0-application-pulse"'):
            self.assertIn(line, last)

    def test_no_modules_no_bus_name_no_start_up_commands(self):
        config = code("Suno-application-sound.conf.in")
        self.assertIn("pulse.allow-module-loading = false", config)
        self.assertIn('server.dbus-name = ""', config)
        self.assertNotIn("pulse.cmd", config)
        self.assertIn('{ address = "@ADDRESS@" client.access = "Suno-application" }', config)

    def test_wrapper_refuses_what_is_not_an_application_id(self):
        for bad in ("", ".x", "a/b", "a|b", "$(id)"):
            done = subprocess.run(["sh", str(DATA / "Suno-application-sound"), bad], capture_output=True,
                                  env={"XDG_RUNTIME_DIR": "/nonexistent", "PATH": os.environ.get("PATH", "")})
            self.assertEqual(done.returncode, 2, bad)


class Script(unittest.TestCase):
    def test_both_wireplumber_generations(self):
        script = code("application-sound.lua")
        self.assertIn("if PermissionManager ~= nil then", script)
        self.assertIn("client:update_permissions (permissions)", script)  # 0.5.14

    def test_recordings_are_held_and_withdrawals_end_them(self):
        script = code("application-sound.lua")
        self.assertIn('pps:call ("lookup", "devices", "microphone")', script)
        self.assertIn('before = "linking/find-defined-target"', script)
        self.assertIn('client:send_error (node ["bound-id"], -13', script)
        self.assertIn("node:request_destroy ()", script)
        self.assertIn('before = "client/find-config-access"', script)


class Boundary(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.runtime = Path(folder.name)
        (self.runtime / "pulse").mkdir()
        for name in ("pipewire-0", "pipewire-0-application", "pulse/native"):
            (self.runtime / name).touch()
        self.own = self.runtime / "Suno-sound" / APP / "native"
        self.own.parent.mkdir(parents=True)
        self.own.touch()

    def test_the_application_gets_its_own_server_and_never_the_sessions(self):
        inside = Path("/run/user/1000")
        with patch.object(app_sound, "start", return_value=self.own) as start:
            view = session_boundary.view(self.runtime, inside, {}, app=APP)
        start.assert_called_once_with(APP, self.runtime)
        mounts = {str(mount.source): str(mount.inside) for mount in view.mounts}
        self.assertEqual(mounts[str(self.own)], "/run/user/1000/pulse/native")
        self.assertNotIn(str(self.runtime / "pulse/native"), mounts)
        self.assertEqual(view.environment["PULSE_SERVER"], "unix:/run/user/1000/pulse/native")

    def test_without_its_server_it_has_no_pulseaudio_at_all(self):
        with patch.object(app_sound, "start", return_value=None):
            for app in ("", APP):
                view = session_boundary.view(self.runtime, Path("/run/user/1000"), {}, app=app)
                self.assertNotIn(str(self.runtime / "pulse/native"), [str(mount.source) for mount in view.mounts])
                self.assertNotIn("PULSE_SERVER", view.environment)


class Defaults(unittest.TestCase):
    def test_a_flatpak_asking_for_pulseaudio_uses_the_microphone(self):
        self.assertIn("microphone", package_access.flatpak_uses({"Context · sockets": "wayland;pulseaudio;"}))
        self.assertIn("microphone", package_access.flatpak_uses({"Context · filesystems": "xdg-run/pipewire-0"}))
        self.assertNotIn("microphone", package_access.flatpak_uses({"Context · sockets": "wayland;"}))

    def test_calls_and_recorders_use_it_by_what_they_are(self):
        self.assertIn("microphone", app_permissions.plan(categories=["Network", "Telephony"])["uses"])
        self.assertIn("microphone", app_permissions.plan(categories=["AudioVideo", "Recorder"])["uses"])
        self.assertNotIn("microphone", app_permissions.plan(categories=["Audio", "Player", "Music"])["uses"])

    def test_install_allows_what_it_asked_for_unless_answered(self):
        model = app_permissions.Permissions(app_permissions.MemoryStore())
        model.install(APP, {"files": {"level": "chooser"}, "uses": ["microphone"]})
        self.assertEqual(model.store.lookup("devices", "microphone")[APP], ["yes"])
        model.set_device("other", "microphone", False)
        model.install("other", {"files": {"level": "chooser"}, "uses": ["microphone"]})
        self.assertEqual(model.store.lookup("devices", "microphone")["other"], ["no"])
        model.install("quiet", {"files": {"level": "chooser"}, "uses": []})
        self.assertNotIn("quiet", model.store.lookup("devices", "microphone"))


class Migration(unittest.TestCase):
    def test_once_keeps_it_for_what_records_and_never_overrides_an_answer(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"XDG_STATE_HOME": folder}):
            model = app_permissions.Permissions(app_permissions.MemoryStore())
            model.set_device("org.example.Said.No", "microphone", False)
            records = {APP: {"format": "deb"}, "org.projectSuno.Installed.editor": {"format": "deb"},
                       "org.projectSuno.Installed.chat": {"format": "rpm"}}
            flatpaks = {"org.example.Recorder": {"format": "flatpak"}, "org.example.Quiet": {"format": "flatpak"},
                        "org.example.Said.No": {"format": "flatpak"}}
            sockets = {"org.example.Recorder": (["pulseaudio"], []), "org.example.Quiet": (["wayland"], []),
                       "org.example.Said.No": (["pulseaudio"], [])}
            categories = {"org.projectSuno.Installed.chat": ["Network", "InstantMessaging"]}
            model.store.set(app_permissions.TABLE, "uses", APP, ["microphone"])
            allowed = app_sound.migrate(model, records=records, flatpaks=flatpaks, metadata=sockets.__getitem__,
                                        categories=lambda app, _record: categories.get(app, []))
            self.assertEqual(sorted(allowed), sorted([APP, "org.projectSuno.Installed.chat", "org.example.Recorder"]))
            rows = model.store.lookup("devices", "microphone")
            self.assertEqual(rows["org.example.Said.No"], ["no"])
            self.assertNotIn("org.example.Quiet", rows)
            self.assertNotIn("org.projectSuno.Installed.editor", rows)
            self.assertEqual(app_sound.migrate(model, records=records, flatpaks=flatpaks, metadata=sockets.__getitem__,
                                               categories=lambda *_: []), [])


@unittest.skipUnless(all(shutil.which(tool) for tool in ("pipewire", "pw-dump", "pactl")),
                     "needs pipewire, pw-dump and pactl")
class Server(unittest.TestCase):
    """A PipeWire daemon with the sockets file, and one application's server: the client cannot name itself."""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        root = Path(self.directory.name)
        self.runtime = root / "run"
        self.runtime.mkdir(mode=0o700)
        fragments = root / "config/pipewire/pipewire.conf.d"
        fragments.mkdir(parents=True)
        shutil.copy(DATA / "60-Suno-application-socket.conf", fragments)
        clean = {key: value for key, value in os.environ.items()
                 if key not in ("PIPEWIRE_REMOTE", "PIPEWIRE_CORE", "PIPEWIRE_RUNTIME_DIR", "PULSE_SERVER")}
        self.environment = {**clean, "XDG_RUNTIME_DIR": str(self.runtime), "XDG_CONFIG_HOME": str(root / "config"),
                            "HOME": str(root)}
        self.processes = [subprocess.Popen(["pipewire"], env=self.environment, stdout=subprocess.DEVNULL,
                                           stderr=subprocess.DEVNULL)]
        self.wait_for(self.runtime / "pipewire-0-application-pulse")
        self.processes.append(subprocess.Popen(
            ["sh", str(DATA / "Suno-application-sound"), APP],
            env={**self.environment, "SUNO_APPLICATION_SOUND_TEMPLATE": str(DATA / "Suno-application-sound.conf.in")},
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        self.address = app_sound.socket_path(APP, self.runtime)
        self.wait_for(self.address)

    def wait_for(self, path):
        deadline = time.monotonic() + 15
        while not path.exists():
            if any(process.poll() is not None for process in self.processes) or time.monotonic() > deadline:
                self.tearDown()
                self.skipTest("no PipeWire server in this environment")
            time.sleep(0.1)

    def tearDown(self):
        for process in reversed(getattr(self, "processes", [])):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(10)
                except subprocess.TimeoutExpired:
                    process.kill()
        self.directory.cleanup()

    def test_the_client_is_named_by_its_server(self):
        spoof = "pipewire.client.access=allowed pipewire.access.portal.app_id=org.example.Other remote.name=pipewire-0"
        waiting = subprocess.Popen(["pactl", "info"], env={**self.environment, "PULSE_SERVER": f"unix:{self.address}",
                                                          "PULSE_PROP": spoof},
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            found = None
            deadline = time.monotonic() + 15
            while found is None and time.monotonic() < deadline:
                time.sleep(0.3)
                dump = subprocess.run(["pw-dump"], env=self.environment, capture_output=True, timeout=15)
                for item in json.loads(dump.stdout or b"[]"):
                    properties = (item.get("info") or {}).get("props") or {}
                    if item.get("type", "").endswith(":Client") and properties.get("application.name") == "pactl":
                        found = properties
            self.assertIsNotNone(found, "the application's client never reached PipeWire")
            self.assertEqual(found.get("pipewire.sec.socket"), "pipewire-0-application-pulse")
            self.assertEqual(found.get("pipewire.access.portal.app_id"), APP)
            self.assertEqual(found.get("pipewire.access"), "Suno-application")
        finally:
            waiting.kill()
            waiting.wait()


if __name__ == "__main__":
    unittest.main()
