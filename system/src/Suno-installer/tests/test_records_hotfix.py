# SPDX-License-Identifier: Apache-2.0
"""What an application can write never decides another start's folders or its
own Flatpak override: records of running applications and permission backups
(permission_views, flatpak_permissions.narrow_override)."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest import mock

from Suno_installer import flatpak_permissions, permission_views

LINUX = sys.platform.startswith("linux")
REQUIRED = os.environ.get("SUNO_REQUIRE_FLATPAK_E2E") == "1"
APP = "org.projectSuno.Installed.deb-player-0123456789ab"


class Session:
    """A home folder and a runtime directory of their own, as the environment."""

    def __init__(self, *folders):
        self.directory = tempfile.TemporaryDirectory()
        root = Path(self.directory.name).resolve()
        self.home, self.runtime = root / "home", root / "run"
        self.home.mkdir()
        self.runtime.mkdir(mode=0o700)
        for name in folders:
            (self.home / name).mkdir()
        self.patch = mock.patch.dict(os.environ, {"HOME": str(self.home), "XDG_RUNTIME_DIR": str(self.runtime),
                                                  "XDG_DATA_HOME": "", "XDG_CONFIG_HOME": ""})

    def __enter__(self):
        self.patch.start()
        return self

    def __exit__(self, *_):
        self.patch.stop()
        self.directory.cleanup()


def record(session, app, instance, state):
    folder = session.runtime / "Suno-permissions/views" / permission_views._component(app)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{instance}.json").write_text(json.dumps(state))
    return folder / f"{instance}.json"


class Records(unittest.TestCase):
    """A record in the runtime directory is the application's to rewrite: it chooses nothing."""

    def test_home_keeper_and_folders_come_from_this_side(self):
        with Session("Documents", "Music") as session:
            tampered = {"pid": os.getpid(), "home": "/", "keeper": 1, "backend": "bwrap",
                        "folders": ["Documents", "../.ssh", ".ssh", "Music/../..", "etc", "", 7]}
            with mock.patch.object(permission_views, "keeper_pid", return_value=4242) as keeper:
                view = permission_views.from_record(APP, "9", {"Documents", "../x"}, tampered)
            keeper.assert_called_with(start=False)
            self.assertEqual(view.home, session.home)
            self.assertEqual(view.keeper, 4242)
            self.assertEqual(view.folders, ["Documents"])
            self.assertEqual(view.granted, {"Documents"})
            for entry in view.entries():
                self.assertEqual(entry["real"], str(session.home / "Documents"))
                self.assertTrue(entry["view"].startswith(str(session.runtime / "Suno-permissions/views/")))
            self.assertIsNone(permission_views.from_record(APP, "9", set(), {**tampered, "backend": "sh -c x"}))

    def test_apply_running_uses_no_value_a_record_names(self):
        with Session("Documents") as session:
            record(session, APP, "1", {"pid": os.getpid(), "home": "/etc", "keeper": 1, "backend": "bwrap",
                                       "folders": ["Documents", "../../etc"]})
            applied = []
            with mock.patch.object(permission_views, "keeper_pid", return_value=0):
                self.assertEqual(permission_views.apply_running(APP, {"Documents"}), [])  # no keeper: nothing
            with mock.patch.object(permission_views, "keeper_pid", return_value=77), \
                    mock.patch.object(permission_views, "run_in_keeper",
                                      side_effect=lambda pid, entries: applied.append((pid, entries)) or []):
                (session.runtime / "Suno-permissions/views" / APP / "1" / "Documents").mkdir(parents=True)
                permission_views.apply_running(APP, {"Documents"})
            pid, entries = applied[0]
            self.assertEqual(pid, 77)
            self.assertEqual([entry["real"] for entry in entries], [str(session.home / "Documents")])

    def test_a_linked_record_is_not_read(self):
        with Session() as session:
            target = session.home / "elsewhere.json"
            target.write_text(json.dumps({"pid": os.getpid(), "folders": ["Documents"]}))
            folder = session.runtime / "Suno-permissions/views" / APP
            folder.mkdir(parents=True)
            (folder / "5.json").symlink_to(target)
            self.assertIsNone(permission_views.read_record(folder / "5.json"))
            self.assertEqual(permission_views.running(APP), [])

    def test_gate_ignores_the_home_and_keeper_it_is_handed(self):
        with Session("Documents") as session:
            state = {"app": APP, "instance": "3", "granted": ["Documents", "../.ssh"], "home": "/",
                     "folders": ["Documents", ".ssh"], "keeper": 1}
            with mock.patch.object(permission_views, "keeper_pid", return_value=55), \
                    mock.patch.object(permission_views, "gate", return_value=0) as gate:
                permission_views.gate_main([json.dumps(state), "--", "bwrap", "true"])
            view = gate.call_args[0][0]
            self.assertEqual((view.home, view.keeper, view.folders, view.granted),
                             (session.home, 55, ["Documents"], {"Documents"}))

    def test_sweep_closes_stale_starts_only_as_this_side_sees_them(self):
        with Session("Documents") as session:
            record(session, APP, "8", {"pid": 2 ** 22 + 1, "home": "/", "keeper": 1, "backend": "podman",
                                       "folders": ["Documents", "../../.."]})
            closed = []
            with mock.patch.object(permission_views.View, "close", lambda self: closed.append(
                    (self.home, self.backend, self.folders))), \
                    mock.patch.object(permission_views, "keeper_pid", return_value=0):
                permission_views.View(APP, "9", set())._sweep()
            self.assertEqual(closed, [(session.home, "podman", ["Documents"])])


@unittest.skipUnless(LINUX, "openat2 and /proc/self/fd")
class Links(unittest.TestCase):
    """Links and ../ in the runtime directory never move a bind."""

    def entry(self, session, name="Documents", **changes):
        return {"view": str(session.runtime / "Suno-permissions/views" / APP / "1" / name),
                "stub": str(permission_views.CLOSED_STUB), "real": str(session.home / name), "granted": True, **changes}

    def sync(self, entries):
        binds = []
        with mock.patch.object(permission_views, "bind", side_effect=lambda source, target: binds.append(
                (os.readlink(source) if source.startswith("/proc/self/fd/") else source,
                 os.readlink(target) if target.startswith("/proc/self/fd/") else target))), \
                mock.patch.object(permission_views, "_open_stub", side_effect=lambda path, name: os.open(
                    "/", os.O_PATH | os.O_DIRECTORY)):
            permission_views.sync(entries)
        return binds

    def test_a_plain_view_binds_the_real_folder_from_its_descriptor(self):
        with Session("Documents") as session:
            with mock.patch.object(permission_views, "mount_points", side_effect=[{}, {self.entry(session)["view"]: 1},
                                                                                 {self.entry(session)["view"]: 2}]), \
                    mock.patch.object(permission_views, "_same_fd", side_effect=[False, True]):
                binds = self.sync([self.entry(session)])
            self.assertEqual(binds[1], (str(session.home / "Documents"), self.entry(session)["view"]))

    def test_a_linked_view_folder_is_refused(self):
        with Session("Documents", ".ssh") as session:
            parent = session.runtime / "Suno-permissions/views" / APP
            parent.mkdir(parents=True)
            (parent / "1").symlink_to(session.home)  # views/APP/1/Documents -> ~/Documents
            with self.assertRaises(OSError):
                self.sync([self.entry(session)])
            shutil.rmtree(parent)
            parent.parent.mkdir(parents=True, exist_ok=True)
            parent.symlink_to(session.home / ".ssh")
            with self.assertRaises(OSError):
                self.sync([self.entry(session)])

    def test_dot_dot_and_hidden_names_are_refused(self):
        with Session("Documents", ".ssh") as session:
            for entry in (self.entry(session, real=str(session.home / ".ssh"), view=self.entry(session)["view"]),
                          self.entry(session, name=".ssh"),
                          self.entry(session, view=str(session.runtime / "Suno-permissions/views/../../x/Documents")),
                          self.entry(session, real=str(session.home / "Documents/../.ssh"))):
                with self.assertRaises(OSError):
                    self.sync([entry])

    def test_a_linked_home_folder_is_never_granted(self):
        with Session(".ssh") as session:
            (session.home / "Documents").symlink_to(session.home / ".ssh")
            with mock.patch.object(permission_views, "mount_points", return_value={self.entry(session)["view"]: 1}):
                with self.assertRaises(OSError):
                    self.sync([self.entry(session)])

    def test_a_linked_stub_is_refused(self):
        with Session("Documents", ".ssh") as session:
            (session.runtime / "Suno-refused").mkdir()
            (session.runtime / "Suno-refused" / "Documents").symlink_to(session.home / ".ssh")
            with self.assertRaises(OSError):
                permission_views._open_stub(str(session.runtime / "Suno-refused" / "Documents"), "Documents")
            with self.assertRaises(OSError):
                permission_views._open_stub(str(session.home / ".ssh"), "Documents")

    def test_stub_never_labels_through_a_link(self):
        with Session(".ssh") as session:
            (session.runtime / "Suno-refused").symlink_to(session.home)
            with mock.patch.object(permission_views, "selinux_refusals", return_value=True), \
                    mock.patch.object(os, "setxattr") as label, \
                    mock.patch.object(os, "getxattr", return_value=b"x"):
                self.assertEqual(permission_views.stub(".ssh"), permission_views.CLOSED_STUB)
                self.assertEqual(permission_views.stub("Documents"), permission_views.CLOSED_STUB)
            label.assert_not_called()

    def test_a_record_is_never_written_through_a_link(self):
        with Session("Documents") as session:
            parent = session.runtime / "Suno-permissions/views"
            parent.mkdir(parents=True)
            (parent / APP).symlink_to(session.home / "Documents")
            view = permission_views.View(APP, "1", set())
            with self.assertRaises(OSError):
                view.record()
            self.assertEqual(list((session.home / "Documents").iterdir()), [])


class RestoredOverride(unittest.TestCase):
    """A backup an application might have written can only take away."""

    METADATA = ("[Application]\nname=org.example.Notes\n\n[Context]\nfilesystems=xdg-documents;xdg-music:ro;\n"
                "shared=ipc;\nsockets=wayland;\n\n[Session Bus Policy]\norg.freedesktop.Notifications=talk\n")

    def test_host_home_and_undeclared_names_are_dropped(self):
        original = ("[Context]\nfilesystems=host;home;xdg-documents;xdg-music;!xdg-download;xdg-data/Suno;\n"
                    "shared=network;ipc;\nsockets=session-bus;wayland;!x11;\ndevices=all;\n\n"
                    "[Session Bus Policy]\norg.freedesktop.Flatpak=talk\norg.freedesktop.Notifications=see\n"
                    "org.freedesktop.secrets=none\n\n[Environment]\nGTK_THEME=Adwaita\n\n[USB Devices]\nenumerable=all\n")
        narrowed = flatpak_permissions._keyfile(flatpak_permissions.narrow_override(original, self.METADATA))
        self.assertEqual(narrowed.get("Context", "filesystems"), "xdg-documents;!xdg-download;")
        self.assertEqual(narrowed.get("Context", "shared"), "ipc;")
        self.assertEqual(narrowed.get("Context", "sockets"), "wayland;!x11;")
        self.assertFalse(narrowed.has_option("Context", "devices"))
        self.assertEqual(dict(narrowed.items("Session Bus Policy")),
                         {"org.freedesktop.Notifications": "see", "org.freedesktop.secrets": "none"})
        self.assertEqual(narrowed.get("Environment", "GTK_THEME"), "Adwaita")
        self.assertFalse(narrowed.has_section("USB Devices"))
        self.assertIsNone(flatpak_permissions.narrow_override(None, self.METADATA))

    def test_apply_restores_only_the_narrowed_backup(self):
        with Session() as session:
            data = session.home / ".local/share"
            app = "org.example.Notes"
            backups = data / "Suno/installer/permission-backups"
            backups.mkdir(parents=True, mode=0o700)
            # Written by the application, as if it had been the person's.
            (backups / f"{app}.json").write_text(json.dumps({"flatpak_id": app, "original_override":
                                                             "[Context]\nfilesystems=host;xdg-documents;\n"}))
            os.chmod(backups / f"{app}.json", 0o600)
            calls = []

            def runner(command, **_keywords):
                calls.append(command)
                return subprocess.CompletedProcess(command, 0, self.METADATA if "--show-metadata" in command else "", "")
            with mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(data)}):
                flatpak_permissions.apply(app, "folders", ["Documents"], runner=runner)
            restored = (data / "flatpak/overrides" / app).read_text()
            self.assertNotIn("host", restored)
            self.assertIn("xdg-documents", restored)


class RealMounts(unittest.TestCase):
    """The keeper's binds, for real: a keeper namespace as Suno-app-views.service makes it, joined as the
    helper joins it, as the person (or root)."""

    def test_stub_grant_revoke_release_and_a_planted_link(self):
        if not (LINUX and shutil.which("unshare")):
            if REQUIRED:
                self.fail("unshare is needed for the real mount test")
            self.skipTest("needs Linux and unshare")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / "home/Documents").mkdir(parents=True)
            (root / "home/.ssh").mkdir()
            (root / "home/Documents/f").write_text("x")
            (root / "home/.ssh/key").write_text("secret")
            (root / "run").mkdir(mode=0o700)
            (root / "stub").mkdir(mode=0o755)
            script = textwrap.dedent(f"""
                import os, json, subprocess, sys, time
                from pathlib import Path
                from Suno_installer import permission_views as v
                # A keeper as Suno-app-views.service starts it; this process joins it as the helper does.
                keeper = subprocess.Popen(["unshare", "--user", "--map-current-user", "--mount", "--propagation", "shared",
                                           "sleep", "60"])
                for _ in range(100):
                    if os.readlink(f"/proc/{{keeper.pid}}/ns/mnt") != os.readlink("/proc/self/ns/mnt"):
                        break
                    time.sleep(0.02)
                v._enter(keeper.pid)
                v.CLOSED_STUB = Path({str(root / "stub")!r})
                view = os.environ["XDG_RUNTIME_DIR"] + "/Suno-permissions/views/A/1/Documents"
                entry = {{"view": view, "stub": str(v.CLOSED_STUB), "real": os.environ["HOME"] + "/Documents", "granted": True}}
                out = {{"grant": v.sync([entry]), "granted": os.listdir(view)}}
                entry["granted"] = False
                out["revoke"] = v.sync([entry]); out["revoked"] = os.listdir(view)
                v._release([entry]); out["left"] = v.mount_points().get(view, 0)
                # A link planted where the next start's view goes is refused, not followed.
                os.makedirs(os.environ["XDG_RUNTIME_DIR"] + "/Suno-permissions/views/B", exist_ok=True)
                os.symlink(os.environ["HOME"], os.environ["XDG_RUNTIME_DIR"] + "/Suno-permissions/views/B/1")
                bad = {{"view": os.environ["XDG_RUNTIME_DIR"] + "/Suno-permissions/views/B/1/.ssh", "stub": str(v.CLOSED_STUB),
                       "real": os.environ["HOME"] + "/Documents", "granted": True}}
                try:
                    v.sync([dict(bad, view=os.environ["XDG_RUNTIME_DIR"] + "/Suno-permissions/views/B/1/Documents")])
                    out["link"] = "followed"
                except OSError:
                    out["link"] = "refused"
                out["ssh"] = sorted(os.listdir(os.environ["HOME"] + "/.ssh"))
                print(json.dumps(out))
                keeper.kill()
            """)
            env = {**os.environ, "HOME": str(root / "home"), "XDG_RUNTIME_DIR": str(root / "run"),
                   "PYTHONPATH": str(Path(permission_views.__file__).resolve().parent.parent)}
            done = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, env=env, timeout=60)
            if done.returncode:
                if REQUIRED:
                    self.fail(f"real mount test could not run: {done.stderr[-400:]}")
                self.skipTest(f"no user namespace here: {done.stderr[-200:]}")
            out = json.loads(done.stdout.strip().splitlines()[-1])
            self.assertEqual(len(out["grant"]), 2)
            self.assertEqual(out["granted"], ["f"])
            self.assertEqual(out["revoked"], [])
            self.assertEqual(out["left"], 0)
            self.assertEqual(out["link"], "refused")
            self.assertEqual(out["ssh"], ["key"])


if __name__ == "__main__":
    unittest.main()
