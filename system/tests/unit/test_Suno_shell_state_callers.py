# SPDX-License-Identifier: Apache-2.0
"""The shell-state service over a real bus: setters refuse what is not the
shell or Settings, a sandbox above all; reading stays open to everyone."""

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "src/Suno-shell-state"
SETTERS = {
    "SetIdleDelay": "(u)", "SetWallpaper": "(s)", "SetAppearance": "(s)", "SetFavorites": "(as)",
    "SetHomeApps": "(as)", "SetPresentation": "(s)", "SetPosture": "(s)", "SetHomeLayout": "(ss)",
    "ReportInputCapabilities": "(s)",
}
ARGUMENTS = {
    "SetIdleDelay": [900], "SetWallpaper": ["file:///usr/share/backgrounds/x.png"],
    "SetAppearance": ["prefer-dark"], "SetFavorites": [["org.example.Evil.desktop"]],
    "SetHomeApps": [["org.example.Evil.desktop"]], "SetPresentation": ["mobile"], "SetPosture": ["tv"],
    "SetHomeLayout": ["mobile", "{}"], "ReportInputCapabilities": ["{}"],
}

CLIENT = textwrap.dedent("""
    import json, sys
    from gi.repository import Gio, GLib
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    NAME, PATH = "org.projectSuno.ShellState1", "/org/projectSuno/ShellState1"
    def call(method, signature=None, args=None, interface=NAME):
        try:
            value = bus.call_sync(NAME, PATH, interface, method,
                GLib.Variant(signature, tuple(args)) if signature else None,
                None, Gio.DBusCallFlags.NONE, 5000, None)
            return {"ok": True, "value": value.unpack() if value is not None else None}
        except GLib.Error as error:
            return {"ok": False, "error": Gio.DBusError.get_remote_error(error) or error.message}
    plan = json.loads(sys.argv[1])
    out = {}
    if len(sys.argv) > 2 and sys.argv[2] == "hide":
        # Non-dumpable, holding the Shell's name: what a host program can do.
        import ctypes
        ctypes.CDLL(None).prctl(4, 0, 0, 0, 0)  # PR_SET_DUMPABLE, 0
        bus.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "RequestName",
                      GLib.Variant("(su)", ("org.gnome.Shell", 4)), None, 0, 5000, None)
    for method, signature, args in plan:
        if method == "Get":
            out["Get"] = call("Get", "(ss)", [NAME, "Presentation"], "org.freedesktop.DBus.Properties")
        elif method == "WaitChanged":
            # args: a well-known name to own first (the Shell's), or none.
            seen, properties = [], []
            loop = GLib.MainLoop()
            if args:
                bus.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                              "RequestName", GLib.Variant("(su)", (args[0], 4)), None, 0, 5000, None)
            bus.signal_subscribe(None, NAME, "Changed", PATH, None, Gio.DBusSignalFlags.NONE,
                lambda *a: seen.append(json.loads(a[5].unpack()[1])))
            bus.signal_subscribe(None, "org.freedesktop.DBus.Properties", "PropertiesChanged", PATH, None,
                Gio.DBusSignalFlags.NONE, lambda *a: properties.append(sorted(a[5].unpack()[1])))
            print("READY", flush=True)
            GLib.timeout_add(3000, loop.quit)
            loop.run()
            out["Changed"], out["PropertiesChanged"] = seen, properties
        else:
            out[method] = call(method, signature, args)
    print(json.dumps(out), flush=True)
""")

DRIVER = textwrap.dedent("""
    set -eu
    python3 "$SERVICE" > "$WORK/service.log" 2>&1 &
    service=$!
    trap 'kill $service 2>/dev/null || true' EXIT
    for attempt in $(seq 1 50); do
      gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \\
        --method org.freedesktop.DBus.GetNameOwner org.projectSuno.ShellState1 >/dev/null 2>&1 && break
      sleep 0.1
    done
    python3 "$WORK/driver.py"
""")

DRIVER_PY = textwrap.dedent("""
    import json, os, subprocess, sys, time
    work, client, trusted = os.environ["WORK"], os.environ["CLIENT"], os.environ["TRUSTED_CLIENT"]
    setters = json.loads(os.environ["PLAN"])
    def run(prefix, path, plan, *extra):
        result = subprocess.run(prefix + [sys.executable, path, json.dumps(plan), *extra],
                                capture_output=True, text=True, timeout=60)
        if result.returncode:
            raise SystemExit(f"{prefix} failed: {result.stderr}")
        return json.loads(result.stdout.strip().splitlines()[-1])
    reads = [["GetSnapshot", None, None], ["Get", None, None]]
    full = [["GetSnapshot", None, None]]
    report = {"before": run([], trusted, full)}
    report["plain"] = run([], client, setters + reads)
    report["after_plain"] = run([], trusted, full)
    for name, prefix in json.loads(os.environ["SANDBOXES"]).items():
        report["sandbox:" + name] = run(prefix, trusted, setters + reads)
    report["after_sandbox"] = run([], trusted, full)
    report["hidden"] = run([], client, setters, "hide")
    report["after_hidden"] = run([], trusted, full)
    watchers = {key: subprocess.Popen([sys.executable, client, json.dumps([["WaitChanged", None, names]])],
                                      stdout=subprocess.PIPE, text=True)
                for key, names in (("app", None), ("shell", ["org.gnome.Shell"]))}
    for watcher in watchers.values():
        assert watcher.stdout.readline().strip() == "READY"
    time.sleep(0.3)
    report["trusted"] = run([], trusted, [["SetIdleDelay", "(u)", [600]], ["SetAppearance", "(s)", ["prefer-dark"]]])
    for key, watcher in watchers.items():
        report["watcher:" + key] = json.loads(watcher.communicate(timeout=20)[0].strip().splitlines()[-1])
    report["after_trusted"] = run([], trusted, full)
    print(json.dumps(report))
""")

STUB_SHELL_SCHEMA = """<schemalist>
  <schema id="org.gnome.shell" path="/org/gnome/shell/">
    <key name="favorite-apps" type="as"><default>[]</default></key>
  </schema>
</schemalist>
"""


def _have(*names):
    return all(shutil.which(name) for name in names)


@unittest.skipUnless(sys.platform.startswith("linux") and _have("dbus-run-session", "gdbus", "glib-compile-schemas"),
                     "needs Linux, dbus-run-session and GLib tools")
class ShellStateCallerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            import gi  # noqa: F401
            from gi.repository import Gio
        except ImportError as error:
            raise unittest.SkipTest(f"no PyGObject: {error}")
        source = Gio.SettingsSchemaSource.get_default()
        needed = ("org.gnome.desktop.background", "org.gnome.desktop.interface", "org.gnome.desktop.session",
                  "org.gnome.desktop.a11y.applications", "org.gnome.desktop.wm.preferences")
        if source is None or any(source.lookup(name, True) is None for name in needed):
            raise unittest.SkipTest("gsettings-desktop-schemas is not installed")
        cls.work = pathlib.Path(tempfile.mkdtemp(prefix="shell-state-callers-"))
        schemas = cls.work / "schemas"
        schemas.mkdir()
        for pattern in ("*.gschema.xml", "*.enums.xml"):
            for path in pathlib.Path("/usr/share/glib-2.0/schemas").glob(pattern):
                shutil.copy(path, schemas)
        shutil.copy(SOURCE / "org.projectSuno.shell-state.gschema.xml", schemas)
        if source.lookup("org.gnome.shell", True) is None:
            (schemas / "zz-test-gnome-shell.gschema.xml").write_text(STUB_SHELL_SCHEMA)
        subprocess.run(["glib-compile-schemas", str(schemas)], check=True, capture_output=True)
        (cls.work / "client.py").write_text(CLIENT)
        # A fixture the service trusts through its own environment only.
        (cls.work / "trusted-client.py").write_text(CLIENT)
        (cls.work / "driver.py").write_text(DRIVER_PY)
        sandboxes = {}
        if _have("unshare") and subprocess.run(["unshare", "-Urm", "true"], capture_output=True).returncode == 0:
            sandboxes["namespace"] = ["unshare", "-Urm"]
        if _have("bwrap"):
            info = cls.work / "flatpak-info"
            info.write_text("[Application]\nname=org.example.Evil\n")
            prefix = ["bwrap", "--ro-bind", "/usr", "/usr", "--ro-bind", "/etc", "/etc",
                      "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64",
                      "--symlink", "usr/bin", "/bin", "--symlink", "usr/sbin", "/sbin",
                      "--proc", "/proc", "--dev", "/dev", "--bind", "/tmp", "/tmp",
                      "--ro-bind", str(info), "/.flatpak-info"]
            run_dir = os.environ.get("XDG_RUNTIME_DIR")
            if run_dir and os.path.isdir(run_dir):
                prefix += ["--bind", run_dir, run_dir]
            if subprocess.run(prefix + ["true"], capture_output=True).returncode == 0:
                sandboxes["flatpak"] = prefix
        cls.sandboxes = sandboxes
        plan = [[method, SETTERS[method], ARGUMENTS[method]] for method in SETTERS]
        home = cls.work / "home"
        (home / ".config").mkdir(parents=True)
        env = {**os.environ, "HOME": str(home), "XDG_CONFIG_HOME": str(home / ".config"),
               "GSETTINGS_SCHEMA_DIR": str(schemas), "GSETTINGS_BACKEND": "keyfile",
               "WORK": str(cls.work), "SERVICE": str(SOURCE / "Suno-shell-state-service"),
               "CLIENT": str(cls.work / "client.py"), "TRUSTED_CLIENT": str(cls.work / "trusted-client.py"),
               "SUNO_SHELL_STATE_TRUSTED": str(cls.work / "trusted-client.py"),
               "PLAN": json.dumps(plan), "SANDBOXES": json.dumps(sandboxes)}
        env.pop("DBUS_SESSION_BUS_ADDRESS", None)
        result = subprocess.run(["dbus-run-session", "--", "bash", "-c", DRIVER], env=env,
                                capture_output=True, text=True, timeout=180)
        cls.log = (cls.work / "service.log").read_text() if (cls.work / "service.log").exists() else ""
        if result.returncode:
            raise AssertionError(f"driver failed: {result.stderr}\n{cls.log}")
        cls.report = json.loads(result.stdout.strip().splitlines()[-1])

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.work, ignore_errors=True)

    def snapshot(self, key):
        return json.loads(self.report[key]["GetSnapshot"]["value"][0])

    def assertRefused(self, answers):
        for method in SETTERS:
            self.assertFalse(answers[method]["ok"], method)
            self.assertEqual(answers[method]["error"], "org.freedesktop.DBus.Error.AccessDenied", method)

    def test_an_unprivileged_caller_changes_nothing(self):
        self.assertRefused(self.report["plain"])
        self.assertEqual(self.snapshot("before"), self.snapshot("after_plain"))
        self.assertIn("refused SetIdleDelay", self.log)

    def test_a_sandbox_is_refused_even_running_a_trusted_program(self):
        if not self.sandboxes:
            self.skipTest("neither unshare nor bwrap can make a sandbox here")
        for name in self.sandboxes:
            self.assertRefused(self.report["sandbox:" + name])
        self.assertEqual(self.snapshot("before"), self.snapshot("after_sandbox"))

    def test_a_hidden_caller_holding_the_shells_name_changes_nothing(self):
        if os.geteuid() == 0:
            self.skipTest("root reads a non-dumpable process anyway")
        self.assertRefused(self.report["hidden"])
        self.assertEqual(self.snapshot("before"), self.snapshot("after_hidden"))

    def test_everyone_reads_the_presentation_and_nothing_personal(self):
        keys = ["plain"] + ["sandbox:" + name for name in self.sandboxes]
        for key in keys:
            self.assertTrue(self.report[key]["GetSnapshot"]["ok"], key)
            self.assertTrue(self.report[key]["Get"]["ok"], key)
            self.assertIn(self.report[key]["Get"]["value"][0], {"desktop", "tablet", "mobile"})
            read = self.snapshot(key)
            self.assertEqual(set(read), {"schema_version", "renderer", "appearance", "presentation", "posture"}, key)
        full = self.snapshot("before")
        for personal in ("favorites", "home_apps", "wallpaper", "power", "home_layouts", "input"):
            self.assertIn(personal, full)

    def test_a_trusted_caller_changes_the_session_and_everyone_hears(self):
        self.assertTrue(self.report["trusted"]["SetIdleDelay"]["ok"], self.report["trusted"])
        self.assertTrue(self.report["trusted"]["SetAppearance"]["ok"], self.report["trusted"])
        after = self.snapshot("after_trusted")
        self.assertEqual(after["power"]["idle_delay_seconds"], 600)
        self.assertEqual(after["appearance"], "prefer-dark")
        # The full snapshot goes to the Shell's name only; apps get PropertiesChanged.
        shell, app = self.report["watcher:shell"], self.report["watcher:app"]
        self.assertTrue(any(item["power"]["idle_delay_seconds"] == 600 for item in shell["Changed"]), shell)
        self.assertEqual(app["Changed"], [], app)
        self.assertTrue(app["PropertiesChanged"], app)


if __name__ == "__main__":
    unittest.main()
