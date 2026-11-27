# SPDX-License-Identifier: Apache-2.0
"""A Flatpak that declares Suno's own folders reaches neither the permission
backups nor the records of running applications (flatpak_guard,
permission_views)."""
import configparser
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from Suno_installer import flatpak_guard, flatpak_permissions, permission_views

LINUX = sys.platform.startswith("linux")
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


class GlobalOverride(unittest.TestCase):
    def test_every_spelling_of_every_guarded_place(self):
        with Session() as session:
            places = flatpak_guard.guarded(uid=1000)
            for place in ("xdg-data/Suno", "~/.local/share/Suno", f"{session.home}/.local/share/Suno",
                          "xdg-data/flatpak", "~/.local/share/flatpak", "xdg-config/autostart", "~/.config/systemd",
                          "xdg-config/environment.d", "xdg-run/Suno-permissions", f"{session.runtime}/Suno-permissions",
                          "xdg-run/Suno-sound", "xdg-run/.dbus-proxy", "xdg-run/bus",
                          "xdg-run/keyring", "xdg-run/systemd"):
                self.assertIn(place, places)
            # What WirePlumber gates by Flatpak ID, and what Viola is given, stay as declared.
            for place in ("xdg-run/pipewire-0", "xdg-run/Suno-viola", "xdg-run/Suno-native-messaging"):
                self.assertNotIn(place, places)
            # Flatpak's instance records: covering them stops every start; still found when declared.
            self.assertNotIn("xdg-run/.flatpak", places)
            self.assertNotIn(f"{session.runtime}/.flatpak", places)
            self.assertIn("xdg-run/.flatpak", flatpak_guard.guarded(uid=1000, records=True))
            self.assertEqual(flatpak_guard.declared_exclusions(["xdg-run/.flatpak"], uid=1000), ["xdg-run/.flatpak"])

    def test_writes_only_what_is_missing_and_brings_back_a_removed_entry(self):
        with Session() as session:
            override = session.home / ".local/share/flatpak/overrides/global"
            calls = []

            def runner(command, **_keywords):
                calls.append(command)
                present = flatpak_guard.current(override)
                added = [argument.split("=", 1)[1] for argument in command if argument.startswith("--nofilesystem=")]
                override.parent.mkdir(parents=True, exist_ok=True)
                override.write_text("[Context]\nfilesystems=" + ";".join(present + [f"!{a}" for a in added]) + ";\n")
                return subprocess.CompletedProcess(command, 0, "", "")
            added = flatpak_guard.assert_global(runner=runner, path=override)
            self.assertIn("xdg-data/Suno", added)
            self.assertEqual(calls[0][:3], ["flatpak", "override", "--user"])
            self.assertEqual(flatpak_guard.assert_global(runner=runner, path=override), [])  # idempotent
            self.assertEqual(len(calls), 1)
            # The person's own entries stay; a removed guard comes back, alone.
            text = override.read_text().replace("!xdg-run/Suno-permissions;", "xdg-run/Suno-permissions;")
            override.write_text(text.replace("filesystems=", "filesystems=~/Projects;"))
            self.assertEqual(flatpak_guard.assert_global(runner=runner, path=override), ["xdg-run/Suno-permissions"])
            self.assertIn("~/Projects", flatpak_guard.current(override))

    @unittest.skipUnless(shutil.which("flatpak"), "needs flatpak")
    def test_flatpak_takes_them_in_a_global_override(self):
        with Session() as session:
            env = {**os.environ, "XDG_DATA_HOME": str(session.home / ".local/share")}
            with mock.patch.dict(os.environ, env):
                flatpak_guard.assert_global()
                shown = subprocess.run(["flatpak", "override", "--user", "--show"], capture_output=True, text=True,
                                       env=env).stdout
            for place in ("xdg-data/Suno", "xdg-run/Suno-permissions", "~/.local/share/Suno"):
                self.assertIn(f"!{place};", shown)
            self.assertNotIn("!xdg-run/.flatpak", shown)
            self.assertEqual(flatpak_guard.missing(session.home / ".local/share/flatpak/overrides/global"), [])

    def test_an_application_override_loses_an_earlier_guards_record_cover(self):
        from Suno_installer.flatpak_permissions import compose
        with Session():
            stale = flatpak_guard.record_covers()
            text = compose("[Context]\nfilesystems=!xdg-run/.flatpak;!xdg-data/Suno;\n", [], ["xdg-data/Suno"], [],
                           [], dropped=stale)
            self.assertNotIn(".flatpak", text)
            self.assertIn("!xdg-data/Suno", text)

    def test_takes_out_an_earlier_guards_instance_record_covers(self):
        with Session() as session:
            env = {**os.environ, "XDG_DATA_HOME": str(session.home / ".local/share")}
            path = session.home / ".local/share/flatpak/overrides/global"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("[Context]\nfilesystems=!xdg-run/.flatpak;" f"!/run/user/{os.getuid()}/.flatpak;"
                            f"!{session.runtime}/.flatpak;!xdg-download;xdg-music:ro;\n", encoding="utf-8")
            with mock.patch.dict(os.environ, env):
                flatpak_guard.assert_global()
            entries = flatpak_guard.current(path)
            self.assertFalse([item for item in entries if item.endswith("/.flatpak")], entries)
            for kept in ("!xdg-download", "xdg-music:ro", "!xdg-data/Suno"):
                self.assertIn(kept, entries)

    def test_units_run_at_sign_in_and_on_every_change(self):
        data = Path(__file__).resolve().parent.parent / "data"
        service = (data / "Suno-flatpak-guard.service").read_text()
        path = (data / "Suno-flatpak-guard.path").read_text()
        self.assertIn("ExecStart=/usr/libexec/Suno-flatpak-guard", service)
        self.assertIn("WantedBy=default.target", service)
        # Every Flatpak transaction triggers it: no start rate limit can fail it (or the path unit).
        self.assertIn("StartLimitIntervalSec=0", service.split("[Service]")[0])
        self.assertIn("PathChanged=%h/.local/share/flatpak/overrides/global", path)
        for watched in ("%h/.local/share/flatpak/.changed", "/var/lib/flatpak/.changed", "%h/.local/share/flatpak/app",
                        "/var/lib/flatpak/app", "/var/lib/flatpak/overrides"):
            self.assertIn(f"PathChanged={watched}", path)
        timer = (data / "Suno-flatpak-guard.timer").read_text()
        self.assertIn("OnUnitActiveSec=15min", timer)
        self.assertIn("WantedBy=default.target", path)
        spec_path = Path(__file__).resolve().parents[3] / "packaging/rpm/Suno-application-installer.spec"
        if not spec_path.is_file():
            self.skipTest("the spec is not beside this source tree (package build)")
        spec = spec_path.read_text()
        for line in ("default.target.wants/Suno-flatpak-guard.service", "default.target.wants/Suno-flatpak-guard.path",
                     "timers.target.wants/Suno-flatpak-guard.timer"):
            self.assertIn(line, spec)


class FakeFlatpak:
    def fake_flatpak(self, data, system, failing=()):
        """flatpak list, info --show-permissions and override, over plain files."""
        overrides = data / "flatpak/overrides"
        calls = []

        def merged(app, base):
            meta = flatpak_permissions._keyfile((base / "app" / app / "current/active/metadata").read_text())
            mine = flatpak_permissions._keyfile((overrides / app).read_text()) if (overrides / app).exists() else \
                flatpak_permissions._keyfile("")
            given = flatpak_permissions.filesystems_from_metadata((base / "app" / app / "current/active/metadata").read_text())
            given += [item for item in flatpak_guard.current(overrides / app) if not item.startswith("!")]
            removed = {item[1:] for item in flatpak_guard.current(overrides / app) if item.startswith("!")}
            files = [item for item in given if flatpak_guard._base(item) not in removed]
            policy = {**(dict(meta.items("Session Bus Policy")) if meta.has_section("Session Bus Policy") else {}),
                      **(dict(mine.items("Session Bus Policy")) if mine.has_section("Session Bus Policy") else {})}
            text = "[Context]\nfilesystems=" + ";".join(files) + ";\n"
            text += "sockets=" + meta.get("Context", "sockets", fallback="") + "\n"
            policy = {name: value for name, value in policy.items() if value != "none"}
            if policy:
                text += "\n[Session Bus Policy]\n" + "".join(f"{name}={value}\n" for name, value in policy.items())
            return text

        def runner(command, **_keywords):
            calls.append(command)
            if command[1] == "list":
                lines = []
                for base, where in ((data / "flatpak", "user"), (system, "system")):
                    for entry in sorted((base / "app").glob("*")) if (base / "app").is_dir() else []:
                        lines.append(f"{entry.name}\t{entry.name}/x86_64/stable\t{where}")
                return subprocess.CompletedProcess(command, 0, "\n".join(lines) + "\n", "")
            app = command[-1].split("/")[0]
            if app in failing:
                return subprocess.CompletedProcess(command, 1, "", "boom")
            if command[1] == "info":
                base = system if command[2] == "--system" else data / "flatpak"
                return subprocess.CompletedProcess(command, 0, merged(app, base), "")
            places = [argument.split("=", 1)[1] for argument in command if argument.startswith("--nofilesystem=")]
            grants = [argument.split("=", 1)[1] for argument in command if argument.startswith("--filesystem=")]
            names = [argument.split("=", 1)[1] for argument in command if argument.startswith("--no-talk-name=")]
            overrides.mkdir(parents=True, exist_ok=True)
            mine = flatpak_permissions._keyfile((overrides / app).read_text()) if (overrides / app).exists() else \
                flatpak_permissions._keyfile("")
            changed = {*places, *[flatpak_guard._base(item) for item in grants]}
            kept = [item for item in flatpak_guard.current(overrides / app) if flatpak_guard._base(item.lstrip("!")) not in changed]
            kept += grants
            policy = {**(dict(mine.items("Session Bus Policy")) if mine.has_section("Session Bus Policy") else {}),
                      **{name: "none" for name in names}}
            text = "[Context]\nfilesystems=" + ";".join(kept + [f"!{n}" for n in places]) + ";\n"
            if policy:
                text += "\n[Session Bus Policy]\n" + "".join(f"{name}={value}\n" for name, value in policy.items())
            (overrides / app).write_text(text)
            return subprocess.CompletedProcess(command, 0, "", "")
        return runner, calls

    def install(self, base, app, items, origin=None, extra=""):
        active = base / "app" / app / "current/active"
        active.mkdir(parents=True)
        (active / "metadata").write_text(f"[Application]\nname={app}\n\n[Context]\nfilesystems={items}\n{extra}")
        if origin is not None:
            (active / "deploy").write_bytes(origin.encode() + b"\0rest")

    def places(self, added):
        return {app: [item for item in items if ("/" in item or item in ("home", "host")) and not item.endswith(":ro")]
                for app, items in added.items()}


def real_bundle(test, session, app, filesystems, extra=""):
    """A bundle installed for this person with real flatpak (no runtime needed): its run()."""
    env = {**os.environ, "XDG_DATA_HOME": str(session.home / ".local/share")}
    build = session.home / f"build-{app}"
    (build / "app/files/bin").mkdir(parents=True)
    (build / "app/var").mkdir()
    (build / "app/files/bin/x").write_text("")
    (build / "app/metadata").write_text(f"[Application]\nname={app}\nruntime=org.freedesktop.Platform/x86_64/24.08\n"
                                        "sdk=org.freedesktop.Sdk/x86_64/24.08\n")

    def run(*command):
        return subprocess.run(command, cwd=build, env=env, capture_output=True, text=True, check=True).stdout
    try:
        run("flatpak", "build-finish", "app", "--command=x")
        with open(build / "app/metadata", "a") as stream:
            stream.write("\n[Context]\nfilesystems=" + ";".join(filesystems) + ";\n" + extra)
        run("flatpak", "build-export", "--disable-sandbox", "repo", "app")
        run("flatpak", "build-bundle", "repo", "e.flatpak", app)
        run("flatpak", "install", "-y", "--user", "--no-deps", "--bundle", "e.flatpak")
    except subprocess.CalledProcessError as error:
        reason = f"flatpak cannot install a test bundle here: {error.stderr[-200:]}"
        if os.environ.get("SUNO_REQUIRE_FLATPAK_E2E") == "1":
            test.fail(reason)
        print(f"SKIP: {reason}", file=sys.stderr)
        test.skipTest(reason)
    return run, env


class Declarations(FakeFlatpak, unittest.TestCase):
    """A bundle that declares a place inside a guarded one, in any spelling, loses it by that name."""

    def test_subpaths_and_parents_inside_guarded_places(self):
        with Session() as session:
            declared = ["xdg-data/Suno/installer/permission-backups", "xdg-data/Suno/installer:ro",
                        "~/.local/share/Suno/x", f"{session.home}/.local/share/flatpak/overrides:create",
                        "xdg-run/Suno-permissions/views", "xdg-config/autostart/x.desktop", "xdg-data/Suno",
                        "xdg-documents", "xdg-data/Sunox", "xdg-data/fonts", "~/Projects", "home", "host",
                        "!xdg-data/Suno/installer", "xdg-run/pipewire-0", "xdg-run/Suno-viola:ro"]
            found = flatpak_guard.declared_exclusions(declared, uid=1000)
            self.assertEqual(found, ["xdg-data/Suno/installer/permission-backups", "xdg-data/Suno/installer",
                                     "~/.local/share/Suno/x", f"{session.home}/.local/share/flatpak/overrides",
                                     "xdg-run/Suno-permissions/views", "xdg-config/autostart/x.desktop",
                                     "xdg-data/Suno"])

    def test_a_link_into_a_guarded_place_is_found(self):
        with Session() as session:
            (session.home / ".local/share/Suno/installer").mkdir(parents=True)
            (session.home / "shortcut").symlink_to(session.home / ".local/share/Suno/installer")
            self.assertEqual(flatpak_guard.declared_exclusions(["~/shortcut"], uid=1000), ["~/shortcut"])

    def test_each_installed_application_as_flatpak_merges_it(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Evil", "xdg-data/Suno/installer;xdg-documents;")
            self.install(system, "org.example.Sys", "~/.local/share/flatpak/overrides/x;")
            self.install(data / "flatpak", "org.example.Fine", "xdg-music;")
            overrides = data / "flatpak/overrides"
            overrides.mkdir(parents=True)
            # An override someone wrote for the fine one gives it a guarded place.
            (overrides / "org.example.Fine").write_text("[Context]\nfilesystems=xdg-run/Suno-sound;\n")
            runner, calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                added = flatpak_guard.assert_applications(runner=runner, data_home=data)
                self.assertEqual(self.places(added), {"org.example.Evil": ["xdg-data/Suno/installer"],
                                                      "org.example.Fine": ["xdg-run/Suno-sound"],
                                                      "org.example.Sys": ["~/.local/share/flatpak/overrides/x"]})
                for items in added.values():  # the permission store is out of reach of every one of them
                    self.assertIn("org.freedesktop.impl.portal.PermissionStore", items)
                    self.assertIn("org.freedesktop.impl.portal.*", items)
                self.assertIn(["flatpak", "info", "--system", "--show-permissions", "org.example.Sys/x86_64/stable"], calls)
                writes = len([c for c in calls if c[1] == "override"])
                self.assertEqual(flatpak_guard.assert_applications(runner=runner, data_home=data), {})
                self.assertEqual(len([c for c in calls if c[1] == "override"]), writes)  # nothing rewritten: no loop
                # An override rewritten to give it back is taken away again.
                (overrides / "org.example.Evil").write_text("[Context]\nfilesystems=xdg-data/Suno/installer;\n")
                self.assertEqual(self.places(flatpak_guard.assert_applications(runner=runner, data_home=data)),
                                 {"org.example.Evil": ["xdg-data/Suno/installer"]})

    def test_a_place_where_it_could_plant_a_link_is_taken_away(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            app = "org.example.Linker"
            self.install(data / "flatpak", app, f"xdg-download;xdg-download/x;~/.var/app/{app}/l;"
                                                 "xdg-music:ro;xdg-music/y;~/Projects/z;")
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                added = self.places(flatpak_guard.assert_applications(runner=runner, data_home=data))
            # Inside a place it may write, or its own data folder: taken away. Under a read-only
            # place or a place it cannot write: kept.
            self.assertEqual(sorted(added[app]), sorted(["xdg-download/x", f"~/.var/app/{app}/l"]))

    def test_full_control_is_recorded_not_taken_away(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Ide", "host;",
                         extra="\n[Session Bus Policy]\norg.freedesktop.Flatpak=talk\n")
            self.install(data / "flatpak", "org.example.Term", "xdg-documents;",
                         extra="sockets=session-bus;\n")
            self.install(data / "flatpak", "org.example.Notes", "xdg-documents;",
                         extra="\n[Session Bus Policy]\norg.freedesktop.*=talk\n")
            runner, _calls = self.fake_flatpak(data, system)
            rows = {}
            store = mock.Mock()
            store.store.set.side_effect = lambda table, entry, app, value: rows.__setitem__(app, value)
            store.store.delete.side_effect = lambda table, entry, app: rows.pop(app, None)
            store.store.lookup.return_value = {}
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                added = flatpak_guard.assert_applications(runner=runner, data_home=data, store=store)
            self.assertEqual(rows, {"org.example.Ide": ["yes"], "org.example.Term": ["yes"], "org.example.Notes": ["yes"]})
            for app in ("org.example.Ide", "org.example.Term"):
                self.assertFalse([item for item in added.get(app, []) if "portal" in item])  # its host access stays
            self.assertIn("xdg-data/Suno", added["org.example.Ide"])  # its covers still go in its own override

    def test_a_wildcard_reaching_the_permission_store_is_silenced(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Sneaky", "xdg-documents;",
                         extra="\n[Session Bus Policy]\norg.freedesktop.impl.*=talk\n")
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                added = flatpak_guard.assert_applications(runner=runner, data_home=data)
            self.assertIn("org.freedesktop.impl.*", added["org.example.Sneaky"])

    def test_a_ref_flatpak_cannot_describe_is_guarded_completely(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "aaa.example.Broken", "xdg-data/Suno/x;")
            self.install(data / "flatpak", "org.example.Evil", "xdg-data/Suno/installer;")
            runner, _calls = self.fake_flatpak(data, system, failing=("aaa.example.Broken",))
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system), self.assertRaises(OSError):
                flatpak_guard.assert_applications(runner=runner, data_home=data)  # reported, the rest still guarded
            evil = flatpak_guard.current(data / "flatpak/overrides/org.example.Evil")
            self.assertIn("!xdg-data/Suno/installer", evil)

            def failing_info(command, **keywords):
                if command[1] == "info":
                    return subprocess.CompletedProcess(command, 1, "", "Multiple branches")
                return runner(command, **keywords)
            with mock.patch.object(flatpak_guard, "warn"), self.assertRaises(OSError):
                flatpak_guard.guard_application("org.example.Evil", [("org.example.Evil/x86_64/stable", "user")],
                                                runner=failing_info, data_home=data)
            self.assertIn("!xdg-run/Suno-permissions", flatpak_guard.current(data / "flatpak/overrides/org.example.Evil"))
            self.assertIn("org.freedesktop.impl.portal.PermissionStore=none",
                          (data / "flatpak/overrides/org.example.Evil").read_text())

    def test_escaped_spellings_are_read_as_flatpak_reads_them(self):
        with Session():
            self.assertEqual(flatpak_guard.declared_exclusions([r"xdg-data/flatpa\k/overrides", r"~/.local/share/lum\a"],
                                                              uid=1000, unescape=True),
                             [r"xdg-data/flatpa\k/overrides", r"~/.local/share/lum\a"])
            self.assertEqual(flatpak_guard._split_mode(r"xdg-data/Suno/a\:ro"), (r"xdg-data/Suno/a\:ro", ""))
            self.assertEqual(flatpak_guard._split_mode(r"xdg-data/Suno/a\:ro:create"), (r"xdg-data/Suno/a\:ro", "create"))

    def test_home_and_host_are_full_control_and_keep_their_covers(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Files", "home;")
            self.install(data / "flatpak", "org.example.Viewer", "home:ro;")
            runner, _calls = self.fake_flatpak(data, system)
            rows = {}
            store = mock.Mock()
            store.store.set.side_effect = lambda table, entry, app, value: rows.__setitem__(app, value)
            store.store.delete.side_effect = lambda table, entry, app: rows.pop(app, None)
            store.store.lookup.return_value = {}
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                added = flatpak_guard.assert_applications(runner=runner, data_home=data, store=store)
            # Both are disclosed (a read-only home still reads the person's files); only the writable one
            # can rename round a cover, so only it keeps no more than its covers.
            self.assertEqual(rows, {"org.example.Files": ["yes"], "org.example.Viewer": ["yes"]})
            self.assertEqual(added["org.example.Files"], list(flatpak_guard.CORE))

    def test_home_and_host_get_the_cover_in_their_own_override(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Files", "home;")
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                added = self.places(flatpak_guard.assert_applications(runner=runner, data_home=data))
                self.assertEqual(added, {"org.example.Files": list(flatpak_guard.CORE)})
                self.assertEqual(flatpak_guard.assert_applications(runner=runner, data_home=data), {})

    def test_only_Suno_s_own_phone_keeps_its_shared_place(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(system, "org.projectSuno.Phone", "xdg-data/Suno/phone:create;xdg-data/Suno/x;", origin="Suno")
            runner, _calls = self.fake_flatpak(data, system)
            deploy = system / "app/org.projectSuno.Phone/current/active/deploy"
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system), \
                    mock.patch.object(flatpak_guard, "Suno_remote_pinned", return_value=True):
                self.assertEqual(self.places(flatpak_guard.assert_applications(runner=runner, data_home=data)),
                                 {"org.projectSuno.Phone": ["xdg-data/Suno/x"]})
                deploy.write_bytes(b"flathub\0rest")  # same name, another origin
                self.assertEqual(self.places(flatpak_guard.assert_applications(runner=runner, data_home=data)),
                                 {"org.projectSuno.Phone": ["xdg-data/Suno/phone"]})


class FailClosed(FakeFlatpak, unittest.TestCase):
    """Any query that fails locks the application down until a later run reads it again."""

    def timing_out(self, runner, what):
        def run(command, **keywords):
            if command[1] == what:
                raise subprocess.TimeoutExpired(command, 30)
            return runner(command, **keywords)
        return run

    def test_a_timeout_locks_the_application_down_and_a_later_run_gives_back(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Notes", "xdg-documents;")
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system), \
                    mock.patch.object(flatpak_guard, "warn") as warn, self.assertRaises(OSError):
                flatpak_guard.assert_applications(runner=self.timing_out(runner, "info"), data_home=data)
            self.assertIn("org.example.Notes", warn.call_args[0][0])
            override = flatpak_guard.current(data / "flatpak/overrides/org.example.Notes")
            for place in ("xdg-data/Suno", "xdg-run/Suno-permissions", "xdg-config/autostart"):
                self.assertIn(f"!{place}", override)
            self.assertNotIn("!xdg-run/.flatpak", override)
            self.assertIn("xdg-config/user-dirs.dirs:ro", override)
            self.assertIn("org.freedesktop.impl.portal.PermissionStore=none",
                          (data / "flatpak/overrides/org.example.Notes").read_text())
            # Read again: only what the guard needs stays (the store names); the lock-down's own lines go.
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                flatpak_guard.assert_applications(runner=runner, data_home=data)
            override = flatpak_guard.current(data / "flatpak/overrides/org.example.Notes")
            self.assertNotIn("!xdg-run/Suno-permissions", override)
            self.assertNotIn("xdg-config/user-dirs.dirs:ro", override)
            self.assertIn("org.freedesktop.impl.portal.PermissionStore=none",
                          (data / "flatpak/overrides/org.example.Notes").read_text())
            self.assertFalse(flatpak_guard._locked_state(data, "org.example.Notes").exists())

    def test_when_nothing_can_be_listed_every_application_is_locked_down(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.One", "xdg-documents;")
            self.install(system, "org.example.Two", "xdg-music;")
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system), \
                    mock.patch.object(flatpak_guard, "warn"), self.assertRaises(OSError):
                flatpak_guard.assert_applications(runner=self.timing_out(runner, "list"), data_home=data)
            for app in ("org.example.One", "org.example.Two"):
                self.assertIn("!xdg-data/flatpak", flatpak_guard.current(data / "flatpak/overrides" / app))

    def test_apply_fails_closed_too(self):
        with Session() as session:
            data = session.home / ".local/share"
            app = "org.example.Notes"

            def runner(command, **_keywords):
                if "--show-metadata" in command:
                    return subprocess.CompletedProcess(command, 0, "[Context]\nfilesystems=xdg-documents;\n", "")
                raise subprocess.TimeoutExpired(command, 30)
            with mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(data)}), mock.patch.object(flatpak_guard, "warn"):
                flatpak_permissions.apply(app, "folders", ["Documents"], runner=runner)
            text = (data / "flatpak/overrides" / app).read_text()
            self.assertIn("!xdg-data/Suno", text)
            self.assertIn("xdg-config/user-dirs.dirs:ro", text)
            self.assertIn("org.freedesktop.impl.portal.PermissionStore=none", text)


class DefaultApps(FakeFlatpak, unittest.TestCase):
    """The person's default applications: no application plants an entry or redirects "open with"."""

    def test_application_entries_stay_writable_for_shortcut_makers(self):
        # Browsers' "install as app" and game launchers' shortcuts write there; the launcher, not
        # the guard, decides which entries a direct open trusts.
        with Session():
            self.assertNotIn("xdg-data/applications", flatpak_guard.guarded())
            self.assertNotIn("xdg-data/applications", flatpak_guard.CORE)

    def test_an_application_that_can_write_them_gets_them_read_only(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Exact", "xdg-config/mimeapps.list;")
            self.install(data / "flatpak", "org.example.Desk", "~/.config/gnome-mimeapps.list:create;")
            self.install(data / "flatpak", "org.example.Reader", "xdg-config/mimeapps.list:ro;")
            self.install(data / "flatpak", "org.example.Plain", "xdg-download;")
            self.install(data / "flatpak", "org.example.Shortcuts", "xdg-data/applications:create;")
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                flatpak_guard.assert_applications(runner=runner, data_home=data)
            overrides = data / "flatpak/overrides"
            for app in ("org.example.Exact", "org.example.Desk"):
                override = flatpak_guard.current(overrides / app)
                self.assertIn("xdg-config/mimeapps.list:ro", override, app)
                self.assertIn("xdg-config/gnome-mimeapps.list:ro", override, app)
            for app in ("org.example.Reader", "org.example.Plain"):
                self.assertNotIn("xdg-config/mimeapps.list:ro", flatpak_guard.current(overrides / app), app)
            shortcuts = flatpak_guard.current(overrides / "org.example.Shortcuts")
            self.assertNotIn("!xdg-data/applications", shortcuts)  # its shortcuts still land
            self.assertIn("xdg-data/applications/mimeapps.list:ro", shortcuts)  # the old list beside them
            # Both lists exist, so the read-only binds do and no application can create one.
            for path in (".config/mimeapps.list", ".config/gnome-mimeapps.list", ".local/share/applications/mimeapps.list"):
                self.assertEqual((session.home / path).read_text(), "[Default Applications]\n")

    def test_a_list_the_person_has_is_never_rewritten(self):
        with Session() as session:
            (session.home / ".config").mkdir(parents=True, exist_ok=True)
            (session.home / ".config/mimeapps.list").write_text("[Default Applications]\ntext/plain=x.desktop\n")
            flatpak_guard.ensure_default_apps()
            self.assertIn("text/plain=x.desktop", (session.home / ".config/mimeapps.list").read_text())

    def test_locked_down_includes_them(self):
        with Session() as session:
            data = session.home / ".local/share"
            calls = []
            runner = lambda command, **_kw: calls.append(command) or subprocess.CompletedProcess(command, 0, "", "")
            flatpak_guard.lock_down("org.example.Broken", data, runner=runner)
            flat = " ".join(" ".join(call) for call in calls)
            self.assertIn("--filesystem=xdg-config/mimeapps.list:ro", flat)


class UserDirs(FakeFlatpak, unittest.TestCase):
    """Only the person and full-control applications may change where xdg-download lands."""

    def test_an_application_that_can_write_it_gets_it_read_only_and_loses_its_user_folders(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Writer", "~/.config/user-dirs.dirs;xdg-download;xdg-pictures/x;")
            # Write access to ~/.config itself reaches round every cover there: full control, covers only.
            self.install(data / "flatpak", "org.example.Config", "xdg-config;xdg-download;")
            self.install(data / "flatpak", "org.example.Exact", "xdg-config/user-dirs.dirs;xdg-music;")
            self.install(data / "flatpak", "org.example.Reader", "xdg-config:ro;xdg-download;")
            self.install(data / "flatpak", "org.example.Ide", "host;xdg-download;", extra="sockets=session-bus;\n")
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                added = flatpak_guard.assert_applications(runner=runner, data_home=data)
            overrides = data / "flatpak/overrides"
            writer = flatpak_guard.current(overrides / "org.example.Writer")
            self.assertIn("xdg-config/user-dirs.dirs:ro", writer)
            self.assertIn("xdg-config/user-dirs.locale:ro", writer)
            self.assertIn("!xdg-download", writer)
            self.assertIn("!xdg-pictures/x", writer)
            exact = flatpak_guard.current(overrides / "org.example.Exact")
            self.assertIn("xdg-config/user-dirs.dirs:ro", exact)
            self.assertIn("!xdg-music", exact)
            self.assertEqual(self.places(added).get("org.example.Reader", []), [])  # it cannot write the file
            self.assertNotIn("!xdg-download", flatpak_guard.current(overrides / "org.example.Reader"))
            self.assertNotIn("xdg-config/user-dirs.dirs:ro", flatpak_guard.current(overrides / "org.example.Ide"))
            self.assertNotIn("xdg-config/user-dirs.dirs:ro", flatpak_guard.current(overrides / "org.example.Config"))
            self.assertIn("!xdg-data/Suno", flatpak_guard.current(overrides / "org.example.Config"))
            # Locked: the next run trusts the file again and writes nothing new.
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                self.assertEqual(flatpak_guard.assert_applications(runner=runner, data_home=data), {})

    @unittest.skipUnless(LINUX and (shutil.which("flatpak") or os.environ.get("SUNO_REQUIRE_FLATPAK_E2E") == "1"),
                         "needs flatpak")
    def test_real_flatpak_redirect_through_user_dirs_is_closed(self):
        with Session() as session:
            (session.home / ".config").mkdir(parents=True, exist_ok=True)
            (session.home / ".config/user-dirs.dirs").write_text(flatpak_guard.DEFAULT_USER_DIRS)
            run, env = real_bundle(self, session, "org.Suno.Dirs", ["xdg-config/user-dirs.dirs", "xdg-download/x",
                                                                    "xdg-music"])
            with mock.patch.dict(os.environ, env), mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION",
                                                                     session.home / "none"):
                flatpak_guard.assert_global()
                flatpak_guard.assert_applications()
            shown = run("flatpak", "info", "--user", "--show-permissions", "org.Suno.Dirs")
            items = [item for line in shown.splitlines() if line.startswith("filesystems=")
                     for item in line.split("=", 1)[1].split(";") if item]
            # It may read where its folders are, never move them; and while it could, none of its
            # XDG user folders are given (a redirect it made before this run leads nowhere).
            self.assertIn("xdg-config/user-dirs.dirs:ro", items)
            self.assertIn("xdg-config/user-dirs.locale:ro", items)
            self.assertNotIn("xdg-download/x", items)
            self.assertNotIn("xdg-music", items)
            self.assertNotIn("xdg-config/user-dirs.dirs", items)

    def test_the_file_always_exists(self):
        with Session() as session:
            with mock.patch.object(subprocess, "run", side_effect=OSError("no xdg-user-dirs")):
                flatpak_guard.ensure_user_dirs()
            self.assertIn('XDG_DOWNLOAD_DIR="$HOME/Downloads"', (session.home / ".config/user-dirs.dirs").read_text())


class NarrowGrants(unittest.TestCase):
    """Full control unless every grant is on the one list of narrow grants."""

    def reasons(self, context, bus="", system="", Suno=False, app="org.example.App"):
        text = f"[Context]\n{context}\n"
        if bus:
            text += f"\n[Session Bus Policy]\n{bus}\n"
        if system:
            text += f"\n[System Bus Policy]\n{system}\n"
        return flatpak_guard.full_control_reasons(flatpak_permissions._keyfile(text), app, with_Suno_flatpak=Suno)

    def test_filesystems(self):
        narrow = ["xdg-documents", "xdg-download/Sub:create", "xdg-music:ro", "~/.var/app/org.example.App/x",
                  "xdg-run/pipewire-0:ro", "xdg-run/speech-dispatcher:ro", "xdg-config/kdeglobals:ro", "xdg-data/fonts:ro",
                  "/media", "/run/media/x"]
        self.assertEqual(self.reasons("filesystems=" + ";".join(narrow) + ";"), [])
        for key in ("home", "home:ro", "host", "host-root", "host-os:ro", "host-etc", "/home", "/var/home",
                    "~/.local", "~/.local/share", "~/.config", "xdg-config", "xdg-data", "xdg-config/kdeglobals",
                    "~/.var/app/org.other.App", "/tmp", "xdg-run/gvfsd", "xdg-run/dconf", "/var/run/user/1000",
                    "~/Projects", "xdg-cache", "xdg-run/pipewire-0", "xdg-run/pipewire-0:create",
                    "xdg-run/speech-dispatcher", "xdg-run/gamescope-0:create"):
            self.assertEqual(self.reasons(f"filesystems={key};"), [f"filesystem {key}"], key)

    def test_sockets_devices_features_shared(self):
        self.assertEqual(self.reasons("sockets=wayland;fallback-x11;cups;\ndevices=dri;kvm;\nfeatures=devel;multiarch;\n"
                                      "shared=network;ipc;"), [])
        for line, reason in (("sockets=x11;", "socket x11"), ("sockets=session-bus;", "socket session-bus"),
                             ("sockets=system-bus;", "socket system-bus"), ("sockets=ssh-auth;", "socket ssh-auth"),
                             ("sockets=gpg-agent;", "socket gpg-agent"), ("sockets=pcsc;", "socket pcsc"),
                             ("sockets=pulseaudio;", "socket pulseaudio"), ("devices=all;", "device all"),
                             ("devices=input;", "device input"), ("devices=usb;", "device usb"),
                             ("devices=shm;", "device shm"), ("features=bluetooth;", "feature bluetooth"),
                             ("shared=something;", "shared something")):
            self.assertEqual(self.reasons(line), [reason], line)
        # With Suno's flatpak, PulseAudio is the application's own server.
        self.assertEqual(self.reasons("sockets=pulseaudio;", Suno=True), [])

    def test_bus_names(self):
        self.assertEqual(self.reasons("", bus="org.freedesktop.Notifications=talk\norg.example.App=own\n"
                                              "org.example.App.Helper=own\norg.mpris.MediaPlayer2.app=own\n"
                                              "org.anything.Else=see\norg.freedesktop.Flatpak=none",
                                      system="org.freedesktop.UPower=talk"), [])
        for bus, reason in (("org.freedesktop.Flatpak=talk", "session bus talk org.freedesktop.Flatpak"),
                            ("org.freedesktop.*=talk", "session bus talk org.freedesktop.*"),
                            ("org.example.Other=own", "session bus own org.example.Other"),
                            ("org.freedesktop.secrets=talk", "session bus talk org.freedesktop.secrets"),
                            ("org.gnome.Shell=talk", "session bus talk org.gnome.Shell")):
            self.assertEqual(self.reasons("", bus=bus), [reason], bus)
        self.assertEqual(self.reasons("", bus="org.freedesktop.secrets=talk", Suno=True), [])
        self.assertEqual(self.reasons("", system="org.freedesktop.NetworkManager=talk"),
                         ["system bus talk org.freedesktop.NetworkManager"])
        self.assertEqual(self.reasons("", system="org.freedesktop.UPower=see"), ["system bus see org.freedesktop.UPower"])

    def test_screen_lock_is_not_narrow(self):
        self.assertEqual(self.reasons("", bus="org.gnome.ScreenSaver=talk"), ["session bus talk org.gnome.ScreenSaver"])
        self.assertEqual(self.reasons("", bus="org.freedesktop.ScreenSaver=talk"), [])

    def test_unknown_context_keys_are_full_control(self):
        self.assertEqual(self.reasons("persistent=.app;\nunset-environment=X;"), [])
        self.assertEqual(self.reasons("something-new=x;"), ["context key something-new"])

    def test_a_user_folder_the_person_put_above_a_cover(self):
        with Session() as session:
            (session.home / ".config").mkdir()
            (session.home / ".config/user-dirs.dirs").write_text('XDG_DOCUMENTS_DIR="$HOME/.local"\n')
            self.assertEqual(self.reasons("filesystems=xdg-documents;"), ["filesystem xdg-documents"])

    def test_reserved_ids_are_full_control_unless_Suno_s_own(self):
        for app in ("io.Suno.Secrets", "org.freedesktop.impl.portal", "org.gnome.Shell", "org.gnome.Shell.Extensions",
                    "org.gnome.SettingsDaemon.X", "org.gnome.keyring.Y", "org.kde.KWin", "org.kde.plasmashell",
                    "org.projectSuno.Depot", "org.freedesktop.secrets", "org.freedesktop", "org.freedesktop.portal",
                    "org.projectSuno.ShellState1", "org.kde.plasma.Foo", "org.kde.kwalletd6", "org.kde.kwalletd",
                    "org.kde.kglobalaccel", "org.gnome.Mutter.ScreenCast", "org.gnome.SessionManager",
                    "org.a11y.Bus", "org.gtk.vfs.Daemon", "org.gtk.MountOperationHandler", "ca.desrt.dconf",
                    "org.gtk.GLib.PACRunner", "org.gtk"):
            self.assertEqual(self.reasons("sockets=wayland;", app=app), [f"application ID {app} is in a reserved namespace"],
                             app)
        self.assertEqual(flatpak_guard.full_control_reasons(flatpak_permissions._keyfile("[Context]\nsockets=wayland;\n"),
                                                            "org.projectSuno.Notes", with_Suno_flatpak=False,
                                                            first_party=True), [])
        self.assertEqual(self.reasons("sockets=wayland;", app="org.gnome.Calculator"), [])
        # Soft: installable, disclosed. Session namespaces, the rest of freedesktop.org's projects, and an ID
        # equal to or above a session service in the list (reserved_ids.soft.services).
        for app in ("org.gnome.OnlineAccounts",
                    "org.gnome.evolution.dataserver.Sources5", "com.canonical.Unity", "org.ayatana.Indicator",
                    "org.freedesktop.Bustle", "org.freedesktop.fwupd", "org.gnome.Settings", "org.gtk.Notifications",
                    "org.gnome.Epiphany", "org.gnome.NautilusPreviewer", "com.feralinteractive.GameMode",
                    "org.pulseaudio", "io.snapcraft"):
            self.assertEqual(flatpak_guard.reserved_tier(app), "soft", app)
            self.assertFalse(flatpak_guard.reserved_id(app), app)
            self.assertEqual(self.reasons("sockets=wayland;", app=app),
                             [f"application ID {app} can take over a system service name"], app)
        for app in ("org.gnome.SettingsX", "org.gtk.Demo4", "org.gnome.Epiphany.Devel", "org.kde.plasmatube",
                    "org.gnome.Calculator", "ca.desrt.dconf-editor"):
            self.assertEqual(flatpak_guard.reserved_tier(app), "", app)
            self.assertEqual(self.reasons("sockets=wayland;", app=app), [], app)

    def test_flathub_s_own_applications_are_never_refused(self):
        # Every Flathub ID the hard tier once caught, and every one the soft tier catches (2026-11-24).
        for app in ("org.freedesktop.Bustle", "org.freedesktop.GstDebugViewer", "org.freedesktop.Piper",
                    "org.freedesktop.Tuhi", "org.freedesktop.adriconf", "org.freedesktop.appstream-glib",
                    "org.freedesktop.appstream.cli", "org.freedesktop.appstream.generator", "org.freedesktop.fwupd",
                    "org.gnome.Epiphany", "org.kde.plasmatube", "ca.desrt.dconf-editor", "org.gnome.Extensions",
                    "org.kde.kwalletmanager"):
            self.assertFalse(flatpak_guard.reserved_id(app), app)

    def test_reserved_is_the_same_whether_or_not_anything_runs(self):
        # Only the list decides: no bus is asked, and a Flatpak's own exported services change nothing.
        self.assertFalse(hasattr(flatpak_guard, "session_service_names"))
        parser = flatpak_permissions._keyfile("[Context]\nsockets=wayland;\n")
        ids = ("org.example.Running", "org.gnome.Settings", "org.gnome.Calculator", "org.freedesktop.Evil")
        def judge():
            return {app: (flatpak_guard.reserved_id(app), flatpak_guard.full_control(parser, app),
                          flatpak_guard.reserved_tier(app)) for app in ids}
        stopped = judge()
        with Session() as session:
            services = session.home / ".local/share/flatpak/exports/share/dbus-1/services"
            services.mkdir(parents=True)
            for app in ids:
                (services / f"{app}.service").write_text(f"[D-BUS Service]\nName={app}\n")
            bus = mock.Mock(side_effect=AssertionError("the bus was asked"))
            with mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(session.home / ".local/share")}), \
                    mock.patch.dict(sys.modules, {"gi.repository": mock.Mock(Gio=mock.Mock(bus_get_sync=bus))}):
                running = judge()
        self.assertEqual(stopped, running)
        self.assertEqual({app: value[0] for app, value in stopped.items()},
                         {"org.example.Running": False, "org.gnome.Settings": False, "org.gnome.Calculator": False,
                          "org.freedesktop.Evil": False})
        self.assertEqual({app: value[1] for app, value in stopped.items()},
                         {"org.example.Running": False, "org.gnome.Settings": True, "org.gnome.Calculator": False,
                          "org.freedesktop.Evil": True})


class FirstParty(unittest.TestCase):
    """Suno's own applications are trusted by origin only: the pinned Suno remote, system-wide."""

    KEY = bytes([0x99, 0x00, 0x0A, 0x04, 0x01, 0x02, 0x03, 0x04, 0x01, 0x00, 0x08, 0xFF, 0x01])
    OTHER = bytes([0x99, 0x00, 0x0A, 0x04, 0x09, 0x09, 0x09, 0x09, 0x01, 0x00, 0x08, 0xFF, 0x01])

    def layout(self, root, *, url="https://dl.simplyluma.com/repo/", key=None, verify="true", origin="Suno", user=False):
        import base64
        system = root / "system"
        (system / "repo").mkdir(parents=True)
        (system / "repo/config").write_text(f'[remote "Suno"]\nurl={url}\ngpg-verify={verify}\n')
        (system / "repo/Suno.trustedkeys.gpg").write_bytes(key or self.KEY)
        definition = root / "Suno.flatpakrepo"
        definition.write_text("[Flatpak Repo]\nUrl=https://dl.simplyluma.com/repo/\nGPGKey="
                              + base64.b64encode(self.KEY).decode() + "\n")
        for app in ("io.Suno.Monitor", "org.projectSuno.Notes"):
            active = system / "app" / app / "current/active"
            active.mkdir(parents=True)
            (active / "deploy").write_bytes(origin.encode() + b"\0x")
            if user:
                (root / "data/flatpak/app" / app).mkdir(parents=True)
        return system, definition

    def first_party(self, **kwargs):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            system, definition = self.layout(root, **kwargs)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system), \
                    mock.patch.object(flatpak_guard, "SUNO_REMOTE_DEFINITIONS", (definition,)):
                found = {app: flatpak_guard.Suno_origin(app, root / "data") for app in ("io.Suno.Monitor", "org.projectSuno.Notes")}
                with mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(root / "data")}):
                    excluded = flatpak_permissions.exclusions("io.Suno.Monitor", ["home"])
            return found, excluded

    def test_the_pinned_remote_system_wide(self):
        found, excluded = self.first_party()
        self.assertEqual(found, {"io.Suno.Monitor": True, "org.projectSuno.Notes": True})
        self.assertEqual(excluded, [])  # its signed manifest's access stands

    def test_anything_else_is_not_Suno_s_own(self):
        for kwargs in ({"url": "https://example.com/repo/"}, {"key": self.OTHER}, {"verify": "false"},
                       {"origin": "flathub"}, {"user": True}, {"key": self.KEY + self.OTHER},
                       {"url": "https://dl.simplyluma.com/repo/\ngpgkeypath=/tmp/k"}):
            found, excluded = self.first_party(**kwargs)
            self.assertEqual(found, {"io.Suno.Monitor": False, "org.projectSuno.Notes": False}, kwargs)
            self.assertIn("--nofilesystem=~/.ssh", excluded, kwargs)  # the full protected-path exclusions
        # A sideloaded bundle with a Suno name and no system copy at all.
        with Session() as session:
            self.assertFalse(flatpak_guard.Suno_origin("io.Suno.Fake", session.home / ".local/share"))
            self.assertIn("--nofilesystem=~/.ssh", flatpak_permissions.exclusions("org.projectSuno.Fake", ["home"]))

    def test_the_fingerprint_is_openpgp_v4(self):
        import hashlib
        body = self.KEY[3:]
        self.assertEqual(flatpak_guard._openpgp_fingerprint(self.KEY),
                         hashlib.sha1(b"\x99" + len(body).to_bytes(2, "big") + body).hexdigest().upper())
        self.assertEqual(flatpak_guard._openpgp_fingerprint(b"junk"), "")


class RealImage(unittest.TestCase):
    """The system installation exactly as a nightly ships it (fixtures/flatpak-image): the Suno
    remote applied from remotes.d, its keyring, and Suno's own applications deployed from it."""

    IMAGE = Path(__file__).resolve().parent / "fixtures/flatpak-image/system"
    DEFINITION = Path(__file__).resolve().parent.parent / "data/Suno.flatpakrepo"
    OWN = ("org.projectSuno.Phone", "org.projectSuno.Depot", "com.rhyme.viola", "io.Suno.Monitor",
           "org.gnome.Nautilus", "org.projectSuno.Charlie", "org.projectSuno.Connect", "org.projectSuno.Calendar")

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.data = Path(directory.name) / "data"
        self.data.mkdir()
        for patch in (mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", self.IMAGE),
                      mock.patch.object(flatpak_guard, "SUNO_REMOTE_DEFINITIONS", (self.DEFINITION,)),
                      mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(self.data)})):
            patch.start()
            self.addCleanup(patch.stop)

    def metadata(self, app):
        parser = configparser.ConfigParser(interpolation=None, strict=False)
        parser.optionxform = str
        parser.read_string((self.IMAGE / "app" / app / "current/active/metadata").read_text())
        return parser

    def test_the_shipped_remote_is_pinned(self):
        self.assertEqual(flatpak_guard._remote_definition(),
                         ("https://dl.simplyluma.com/repo", "069E001599679B49042FE40885FCC398C02A8BEE"))
        self.assertTrue(flatpak_guard.Suno_remote_pinned())

    def test_the_image_s_static_remote_is_the_same_definition(self):
        with mock.patch.object(flatpak_guard, "SUNO_REMOTE_DEFINITIONS",
                               (Path("/nonexistent/Suno.flatpakrepo"), self.DEFINITION)):
            self.assertTrue(flatpak_guard.Suno_remote_pinned())
        with mock.patch.object(flatpak_guard, "SUNO_REMOTE_DEFINITIONS", (Path("/nonexistent/Suno.flatpakrepo"),)):
            self.assertFalse(flatpak_guard.Suno_remote_pinned())

    def test_Suno_s_own_applications_stay_first_party(self):
        for app in self.OWN:
            self.assertTrue(flatpak_guard.Suno_origin(app, self.data), app)
        # The Phone keeps its shared folder and Depot its manifest: no protected-path exclusions.
        for app in ("org.projectSuno.Phone", "org.projectSuno.Depot"):
            self.assertEqual(flatpak_permissions.exclusions(app, ["home"]), [], app)
        (self.data / "flatpak/app/org.projectSuno.Phone").mkdir(parents=True)  # a same-named user copy
        self.assertFalse(flatpak_guard.Suno_origin("org.projectSuno.Phone", self.data))
        with mock.patch.object(flatpak_guard, "SUNO_REMOTE_DEFINITIONS", (Path("/nonexistent/Suno.flatpakrepo"),)):
            self.assertFalse(flatpak_guard.Suno_origin("org.projectSuno.Depot", self.data))

    def test_the_disclosure_is_the_same_whoever_made_it(self):
        for app in self.OWN:
            first = flatpak_guard.full_control_reasons(self.metadata(app), app, with_Suno_flatpak=True,
                                                       first_party=True)
            other = flatpak_guard.full_control_reasons(self.metadata(app), app, with_Suno_flatpak=True,
                                                       first_party=False)
            # Origin only lifts the reserved-namespace reason; every grant is judged as anyone's.
            self.assertEqual([reason for reason in other if "reserved namespace" not in reason], first, app)
            self.assertTrue(flatpak_guard.full_control(self.metadata(app), app, first_party=True), app)
            self.assertFalse(any("AppData1" in reason or "X-Suno" in reason for reason in first), app)
        with mock.patch.dict(flatpak_guard._VERSIONS, {"Suno-shell-state": ""}):  # an image without the check
            self.assertEqual(flatpak_guard.full_control_reasons(self.metadata("io.Suno.Monitor"), "io.Suno.Monitor",
                                                                with_Suno_flatpak=True, first_party=True),
                             ["session bus talk org.projectSuno.ShellState1", "acts as you outside its sandbox: sees and can stop any program you run"])

    def test_every_scoped_Suno_service_says_why(self):
        scoped = flatpak_guard.narrow_grants()["session_bus"]["talk_scoped_to_caller"]["names"]
        self.assertEqual(sorted(scoped), ["org.projectSuno.ShellState1", "org.projectSuno.AppData1"])
        self.assertTrue(all(isinstance(why, str) and len(why) > 80 for why in scoped.values()))

    def test_shell_state_is_narrow_only_where_the_installed_service_checks_its_callers(self):
        monitor = self.metadata("io.Suno.Monitor")
        def reasons(version):
            with mock.patch.dict(flatpak_guard._VERSIONS, {"Suno-shell-state": version}):
                return flatpak_guard.full_control_reasons(monitor, "io.Suno.Monitor", with_Suno_flatpak=True,
                                                          first_party=True)
        for version in ("", "0.2.0-1.Suno.41.fc44", "0.1.9-1.Suno.60.fc44"):  # absent, or before the check
            self.assertIn("session bus talk org.projectSuno.ShellState1", reasons(version), version)
        for version in ("0.2.0-1.Suno.42.fc44", "0.2.0-1.Suno.43.fc44", "0.3.0-1.Suno.1.fc44"):
            self.assertEqual(reasons(version), ["acts as you outside its sandbox: sees and can stop any program you run"], version)

    def test_the_installed_version_is_asked_of_rpm_once(self):
        calls = []
        def run(command, **_kw):
            calls.append(command)
            return subprocess.CompletedProcess(command, 0, "0.2.0-1.Suno.42.fc44", "")
        with mock.patch.dict(flatpak_guard._VERSIONS, {}, clear=True), mock.patch.object(flatpak_guard.subprocess, "run", run):
            self.assertEqual(flatpak_guard._installed_version("Suno-shell-state"), "0.2.0-1.Suno.42.fc44")
            self.assertEqual(flatpak_guard._installed_version("Suno-shell-state"), "0.2.0-1.Suno.42.fc44")
        self.assertEqual(calls, [["rpm", "-q", "--qf", "%{VERSION}-%{RELEASE}", "Suno-shell-state"]])
        with mock.patch.dict(flatpak_guard._VERSIONS, {}, clear=True), \
                mock.patch.object(flatpak_guard.subprocess, "run", side_effect=OSError("no rpm")):
            self.assertEqual(flatpak_guard._installed_version("Suno-shell-state"), "")

    def test_tiers_of_Suno_s_own_applications(self):
        # 2026-11-25, shell state checked: tier 1 only where it can act as you outside its sandbox.
        apps = sorted(path.name for path in (self.IMAGE / "app").iterdir())
        with mock.patch.dict(flatpak_guard._VERSIONS, {"Suno-shell-state": "0.2.0-1.Suno.42.fc44",
                                                       "Suno-mods": "0.1.0-1.Suno.24.fc44"}):
            tiers = {app: flatpak_guard.disclosure_tier(self.metadata(app), app, first_party=True) for app in apps}
        self.assertEqual(sorted(app for app, tier in tiers.items() if tier == 1),
                         ["io.Suno.Monitor", "org.gnome.Nautilus", "org.projectSuno.Ari", "org.projectSuno.Depot"])
        self.assertEqual(sum(tier == 2 for tier in tiers.values()), 19)

    def test_a_bound_service_is_inert_for_everyone_else(self):
        parse = flatpak_permissions._keyfile
        def tier(app, name, bus="Session"):
            parser = parse(f"[Context]\nsockets=wayland;\n\n[{bus} Bus Policy]\n{name}=talk\n")
            return flatpak_guard.disclosure_tier(parser, app, first_party=True), flatpak_guard.full_control_reasons(
                parser, app, with_Suno_flatpak=True, first_party=True)
        for name, owner in (("org.projectSuno.MonitorHost1", "io.Suno.Monitor"), ("org.projectSuno.Ari1", "org.projectSuno.Ari"),
                            ("org.projectSuno.DepotHost1", "org.projectSuno.Depot")):
            self.assertEqual(tier("org.example.Other", name), (0, []), name)
            self.assertEqual(tier(owner, name)[0], 1, name)
            self.assertTrue(tier(owner, name)[1][0].startswith(flatpak_guard.TIER1_PREFIX), name)
        for name, owner in (("org.projectSuno.ClockHost1", "org.projectSuno.Clock"), ("org.projectSuno.MailHost1", "org.projectSuno.Charlie"),
                            ("org.projectSuno.ViolaHost1", "com.rhyme.viola")):
            self.assertEqual(tier("org.example.Other", name), (0, []), name)
            self.assertEqual(tier(owner, name), (0, []), name)
        # A name no service binds stays full control, and Terminal is tier 1 for anyone.
        self.assertEqual(tier("org.example.Other", "org.projectSuno.Background1")[0], 2)
        self.assertEqual(tier("org.example.Other", "org.projectSuno.Terminal"),
                         (1, [flatpak_guard.TIER1_PREFIX + "runs any program as you"]))
        self.assertTrue(flatpak_guard.escapes(parse("[Session Bus Policy]\norg.projectSuno.Terminal=talk\n")))
        # UDisks2: its own line, tier 2.
        found = tier("org.example.Disks", "org.freedesktop.UDisks2", bus="System")
        self.assertEqual(found[0], 2)
        self.assertTrue(found[1][0].startswith("manages your drives"))

    def test_mods_profiles_narrow_only_with_the_check_first(self):
        parser = flatpak_permissions._keyfile("[Session Bus Policy]\norg.projectSuno.ModProfiles1=talk\n")
        for version, expected in (("", ["session bus talk org.projectSuno.ModProfiles1"]),
                                  ("0.1.0-1.Suno.24.creator20261007.1.fc44", ["session bus talk org.projectSuno.ModProfiles1"]),
                                  ("0.1.0-1.Suno.25.fc44", [])):
            with mock.patch.dict(flatpak_guard._VERSIONS, {"Suno-mods": version}):
                self.assertEqual(flatpak_guard.full_control_reasons(parser, "org.projectSuno.Mods", with_Suno_flatpak=True,
                                                                    first_party=True), expected, version)

    def test_user_dirs_read_only_is_narrow_and_writable_is_not(self):
        parse = flatpak_permissions._keyfile
        for key in ("xdg-config/user-dirs.dirs:ro", "xdg-config/user-dirs.locale:ro"):
            self.assertEqual(flatpak_guard.full_control_reasons(parse(f"[Context]\nfilesystems={key};\n"),
                                                                "org.example.App", with_Suno_flatpak=True), [], key)
        for key in ("xdg-config/user-dirs.dirs", "xdg-config/user-dirs.dirs:create", "xdg-config/user-dirs.dirs/x:ro"):
            self.assertTrue(flatpak_guard.full_control_reasons(parse(f"[Context]\nfilesystems={key};\n"),
                                                               "org.example.App", with_Suno_flatpak=True), key)

    def test_every_first_party_app_on_the_image(self):
        # The 23 of a nightly, with the shell state's check installed (2026-11-25): 23 full control.
        apps = sorted(path.name for path in (self.IMAGE / "app").iterdir())
        self.assertEqual(len(apps), 23)
        with mock.patch.dict(flatpak_guard._VERSIONS, {"Suno-shell-state": "0.2.0-1.Suno.42.fc44"}):
            found = {app: flatpak_guard.full_control_reasons(self.metadata(app), app, with_Suno_flatpak=True,
                                                             first_party=True) for app in apps}
        self.assertEqual(found["io.Suno.Monitor"], ["acts as you outside its sandbox: sees and can stop any program you run"])
        self.assertEqual(found["org.projectSuno.Viewer"], ["session bus talk org.projectSuno.ApplicationDirectory1"])
        self.assertFalse(any("ShellState1" in reason for reasons in found.values() for reason in reasons))
        self.assertEqual(sum(bool(reasons) for reasons in found.values()), 23)


class SunoNames(FakeFlatpak, unittest.TestCase):
    def test_a_Suno_name_without_Suno_s_origin_gets_the_protected_exclusions(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.projectSuno.Notes", "home;")  # a user copy, after Suno's apply
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                flatpak_guard.assert_applications(runner=runner, data_home=data)
            override = flatpak_guard.current(data / "flatpak/overrides/org.projectSuno.Notes")
            self.assertIn("!~/.ssh", override)
            self.assertIn("!~/.local/share/keyrings", override)
            self.assertIn("~/.bashrc:ro", override)

    def test_valet_refuses_a_reserved_id(self):
        from Suno_installer import backends
        from Suno_installer.errors import InstallerError
        for kind in ("flatpak", "flatpakref"):  # a bundle; a reference (its remote is this person's own)
            for app in ("org.freedesktop.impl.portal.Evil", "org.gnome.Shell.Evil", "org.projectSuno.Notes"):
                report = mock.Mock(kind=kind, title="X", details={"Application ID": app})
                with mock.patch.dict(sys.modules, {"Suno_installer.flatpak_backend": mock.Mock()}):
                    with self.assertRaises(InstallerError, msg=(kind, app)):
                        backends._install_flatpak(report)
                    sys.modules["Suno_installer.flatpak_backend"].install.assert_not_called()

    def test_the_transaction_judges_every_ref_whatever_the_file_said(self):
        # A reference named harmlessly that resolves to a reserved application: refused at ready.
        operations = [mock.Mock(get_ref=mock.Mock(return_value=ref)) for ref in
                      ("runtime/org.freedesktop.Platform/x86_64/24.08", "app/org.freedesktop.secrets/x86_64/stable",
                       "app/org.example.Fine/x86_64/stable", "app/org.gnome.Epiphany/x86_64/stable")]
        self.assertEqual(flatpak_guard.reserved_apps(operations), ["org.freedesktop.secrets"])
        self.assertEqual(flatpak_guard.reserved_apps(operations[2:]), [])

    def test_depot_refuses_a_reserved_id_from_any_remote_but_Suno_s(self):
        from Suno_installer import depot_flatpak
        resolved = mock.Mock(side_effect=RuntimeError("resolved"))
        with mock.patch.object(depot_flatpak, "resolve", resolved):
            for app in ("org.freedesktop.impl.portal.Evil", "org.projectSuno.Notes", "org.kde.KWin"):
                source = mock.Mock(remote="flathub", app_id=app)
                with self.assertRaises(depot_flatpak.SourceUnavailable, msg=app):
                    depot_flatpak.transaction(mock.Mock(), source)
            resolved.assert_not_called()
            # Suno's own remote (validated as Suno's in the transaction's ready check) goes on to resolve.
            with self.assertRaisesRegex(RuntimeError, "resolved"):
                depot_flatpak.transaction(mock.Mock(), mock.Mock(remote="Suno", app_id="org.projectSuno.Notes"))
            for app in ("org.gnome.Calculator", "org.gnome.Epiphany", "org.freedesktop.Bustle"):  # soft: installable
                with self.assertRaisesRegex(RuntimeError, "resolved"):
                    depot_flatpak.transaction(mock.Mock(), mock.Mock(remote="flathub", app_id=app))


class Squatting(FakeFlatpak, unittest.TestCase):
    """No Flatpak of anyone else's owns a name the desktop or Suno answers to, or reaches Suno's own."""

    def parser(self, policy):
        return flatpak_permissions._keyfile("[Session Bus Policy]\n" + "".join(f"{k}={v}\n" for k, v in policy.items()))

    def test_what_is_taken_away(self):
        policy = {"org.projectSuno.AppPermissions1": "own", "org.freedesktop.impl.portal.desktop.Suno.background": "own",
                  "org.*": "own", "io.Suno.Fabcdefghijklmn": "own", "org.projectSuno.Terminal": "talk",
                  "org.projectSuno.*": "see", "io.Suno.Secrets.x": "talk",
                  # kept: its own namespace, a soft collision, talk to the desktop's public services
                  "com.example.App.Helper": "own", "org.gnome.Epiphany.WebAppProvider": "own",
                  "org.freedesktop.FileManager1": "own",  # a file manager as "show in folder": disclosed, kept
                  "org.freedesktop.Notifications": "talk", "org.freedesktop.secrets": "talk",
                  "org.kde.StatusNotifierWatcher": "talk"}
        self.assertEqual(flatpak_guard.squatted("com.example.App", self.parser(policy), first_party=False),
                         ["org.projectSuno.AppPermissions1", "org.freedesktop.impl.portal.desktop.Suno.background",
                          "org.*", "io.Suno.Fabcdefghijklmn", "org.projectSuno.Terminal", "org.projectSuno.*",
                          "io.Suno.Secrets.x"])
        self.assertEqual(flatpak_guard.squatted("org.projectSuno.Notes", self.parser(policy), first_party=True), [])

    def test_the_guard_writes_none_even_for_an_application_that_escapes(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            squat = "\n[Session Bus Policy]\norg.projectSuno.AppPermissions1=own\norg.projectSuno.Terminal=talk\n"
            self.install(data / "flatpak", "org.example.Squat", "xdg-download;", extra=squat)
            self.install(data / "flatpak", "org.example.Ide", "host;", extra="sockets=session-bus;\n" + squat)
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                flatpak_guard.assert_applications(runner=runner, data_home=data)
            for app in ("org.example.Squat", "org.example.Ide"):
                policy = flatpak_guard._bus_policy(data / "flatpak/overrides" / app)
                self.assertEqual(policy.get("org.projectSuno.AppPermissions1"), "none", app)
                self.assertEqual(policy.get("org.projectSuno.Terminal"), "none", app)

    def test_an_escape_through_a_taken_name_keeps_the_full_guard(self):
        # Its only way out was Suno's Terminal: taken away, it is guarded as any other application,
        # and still disclosed by the line it declares.
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Out", "xdg-download;",
                         extra="\n[Session Bus Policy]\norg.projectSuno.Terminal=talk\n")
            runner, _calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system):
                flatpak_guard.assert_applications(runner=runner, data_home=data)
            policy = flatpak_guard._bus_policy(data / "flatpak/overrides/org.example.Out")
            self.assertEqual(policy.get("org.projectSuno.Terminal"), "none")
            self.assertEqual(policy.get("org.freedesktop.impl.portal.PermissionStore"), "none")  # the full guard
            declared = flatpak_permissions._keyfile("[Session Bus Policy]\norg.projectSuno.Terminal=talk\n")
            self.assertTrue(flatpak_guard.escapes(declared))
            self.assertFalse(flatpak_guard.escapes(flatpak_guard.without(declared, ["org.projectSuno.Terminal"])))
            self.assertEqual(flatpak_guard.disclosure_tier(declared, "org.example.Out"), 1)

    @unittest.skipUnless(LINUX and (shutil.which("flatpak") or os.environ.get("SUNO_REQUIRE_FLATPAK_E2E") == "1"),
                         "needs flatpak")
    def test_real_flatpak_takes_the_own_away(self):
        with Session() as session:
            run, env = real_bundle(self, session, "org.Suno.Squat", ["xdg-download"],
                                   extra="\n[Session Bus Policy]\norg.projectSuno.AppPermissions1=own\n"
                                         "org.projectSuno.*=talk\norg.example.Mine=own\n")
            before = run("flatpak", "info", "--user", "--show-permissions", "org.Suno.Squat")
            self.assertIn("org.projectSuno.AppPermissions1=own", before)
            with mock.patch.dict(os.environ, env), mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION",
                                                                     session.home / "none"):
                flatpak_guard.assert_applications()
            shown = run("flatpak", "info", "--user", "--show-permissions", "org.Suno.Squat")
            # flatpak's own merge: the override's none replaces the bundle's own and talk by the same key
            # (a name at none is not listed at all), and the bus proxy is given neither.
            self.assertNotIn("org.projectSuno.AppPermissions1", shown)
            self.assertNotIn("org.projectSuno.*", shown)
            self.assertIn("org.example.Mine=own", shown)
            policy = flatpak_guard._bus_policy(session.home / ".local/share/flatpak/overrides/org.Suno.Squat")
            self.assertEqual((policy.get("org.projectSuno.AppPermissions1"), policy.get("org.projectSuno.*")),
                             ("none", "none"))


class ReadOnlySocket(unittest.TestCase):
    @unittest.skipUnless(LINUX, "Linux")
    def test_a_socket_connects_through_a_read_only_bind(self):
        import socket as sockets
        bwrap = shutil.which("bwrap")
        if not bwrap:
            if os.environ.get("SUNO_REQUIRE_FLATPAK_E2E") == "1":
                self.fail("bwrap is needed")
            self.skipTest("needs bwrap")
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "s.sock")
            server = sockets.socket(sockets.AF_UNIX, sockets.SOCK_STREAM)
            server.bind(path)
            server.listen(1)
            done = subprocess.Popen([bwrap, "--unshare-user", "--dev-bind", "/", "/", "--ro-bind", path, path, sys.executable,
                                     "-c", f"import socket,os; s=socket.socket(socket.AF_UNIX); s.connect({path!r}); s.send(b'ok');"
                                           f"\ntry:\n os.unlink({path!r}); print('removed')\nexcept OSError as e: print('kept', e.errno)"],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            server.settimeout(10)
            connection, _ = server.accept()
            self.assertEqual(connection.recv(2), b"ok")
            out, err = done.communicate(timeout=30)
            if done.returncode and os.environ.get("SUNO_REQUIRE_FLATPAK_E2E") != "1" and "bwrap" in err:
                self.skipTest(err[-200:])
            self.assertIn("kept", out)  # it connects, and cannot be replaced
            server.close()


    def test_unknown_or_unreadable_is_full_control(self):
        parser = flatpak_permissions._keyfile("[Context]\nsockets=wayland;\n\n[Something New]\nx=y\n")
        self.assertEqual(flatpak_guard.full_control_reasons(parser, "a.b", with_Suno_flatpak=False),
                         ["unknown section Something New"])
        with mock.patch.dict(flatpak_guard._NARROW, {}, clear=True), \
                mock.patch.object(flatpak_guard, "narrow_grants", return_value={}):
            self.assertTrue(flatpak_guard.full_control(flatpak_permissions._keyfile("[Context]\n"), "a.b"))
        self.assertTrue(flatpak_guard.full_control(None, "a.b"))  # unparsable

    def test_one_file_for_every_reader(self):
        grants = flatpak_guard.narrow_grants()
        self.assertEqual(grants["schema"], "org.projectSuno.flatpak-narrow-grants/v1")
        for group in grants["filesystems"].values():
            self.assertTrue(group["why"])  # every entry says why
        for name in ("sockets", "devices", "features", "shared"):
            self.assertTrue(all(grants[name].values()))


class Authority(FakeFlatpak, unittest.TestCase):
    """Suno's record only ever narrows an override; it never widens one by itself."""

    def test_narrowed_never_widens(self):
        current = ("[Context]\nfilesystems=xdg-documents;host;xdg-music:ro;!xdg-download;\nshared=network;ipc;\n\n"
                   "[Session Bus Policy]\norg.example.Talk=own\norg.freedesktop.Flatpak=talk\n")
        expected = ("[Context]\nfilesystems=xdg-documents:ro;xdg-music;xdg-pictures;!~/.ssh;\nshared=ipc;\n\n"
                    "[Session Bus Policy]\norg.example.Talk=talk\norg.example.Other=talk\n")
        out = flatpak_permissions._sections(flatpak_permissions.narrowed(current, expected))
        files = out["Context"]["filesystems"].split(";")
        self.assertIn("xdg-documents:ro", files)        # the narrower mode
        self.assertIn("xdg-music:ro", files)
        self.assertNotIn("host", files)                 # wider than the record: gone
        self.assertNotIn("xdg-pictures", files)         # the record is wider: not added
        self.assertIn("!xdg-download", files)
        self.assertIn("!~/.ssh", files)
        self.assertEqual(out["Context"]["shared"], "ipc;")
        self.assertEqual(out["Session Bus Policy"], {"org.example.Talk": "talk"})

    def test_compose_writes_Suno_s_lines_and_the_guard_together(self):
        text = flatpak_permissions.compose("[Context]\nfilesystems=xdg-documents;!xdg-music;\n",
                                           ["--nofilesystem=~/.ssh", "--filesystem=xdg-music", "--filesystem=home"],
                                           ["xdg-data/Suno/x"], ["org.freedesktop.impl.portal.*"], ["xdg-run/Suno-sound"])
        out = flatpak_permissions._sections(text)
        files = out["Context"]["filesystems"].split(";")
        for item in ("xdg-documents", "xdg-music", "home", "!~/.ssh", "!xdg-data/Suno/x", "!xdg-run/Suno-sound"):
            self.assertIn(item, files)
        self.assertNotIn("!xdg-music", files)
        self.assertEqual(out["Session Bus Policy"], {"org.freedesktop.impl.portal.*": "none"})

    def leftovers(self, data, app):
        return [path for path in (data / "flatpak/overrides" / app,
                                  data / "Suno/installer/permission-backups" / f"{app}.json",
                                  data / "Suno/installer/permission-backups" / f"{app}.Suno.json",
                                  data / "Suno/installer/flatpak-guard/locked" / f"{app}.json") if path.exists()]

    def seed(self, data, app, original):
        backups = data / "Suno/installer/permission-backups"
        backups.mkdir(parents=True, exist_ok=True)
        (backups / f"{app}.json").write_text(json.dumps({"flatpak_id": app, "original_override": original}))
        (backups / f"{app}.Suno.json").write_text("{}")
        locked = data / "Suno/installer/flatpak-guard/locked"
        locked.mkdir(parents=True, exist_ok=True)
        (locked / f"{app}.json").write_text("{}")
        (data / "flatpak/overrides").mkdir(parents=True, exist_ok=True)
        (data / "flatpak/overrides" / app).write_text("[Context]\nfilesystems=home;!~/.ssh;!xdg-data/Suno;\n")

    def test_forget_leaves_nothing_of_Suno_s_behind(self):
        with Session() as session:
            data = session.home / ".local/share"
            app = "org.example.Gone"
            self.seed(data, app, "[Context]\nfilesystems=xdg-music;\n")
            with mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(data)}):
                flatpak_permissions.forget(app, installed=False)
                self.assertEqual(self.leftovers(data, app), [])
                flatpak_permissions.forget(app, installed=False)  # twice is fine

    def test_forget_with_a_copy_still_installed_restores_only_the_narrowed_original(self):
        with Session() as session:
            data = session.home / ".local/share"
            app = "org.example.Kept"
            self.seed(data, app, "[Context]\nfilesystems=xdg-music;host;\n")
            metadata = "[Application]\nname=org.example.Kept\n\n[Context]\nfilesystems=xdg-music;\n"
            runner = lambda command, **_: subprocess.CompletedProcess(command, 0, metadata, "")  # noqa: E731
            with mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(data)}):
                flatpak_permissions.forget(app, installed=True, runner=runner)
            restored = (data / "flatpak/overrides" / app).read_text()
            self.assertIn("xdg-music", restored)
            self.assertNotIn("host", restored)
            self.assertEqual(self.leftovers(data, app), [data / "flatpak/overrides" / app])

    def test_the_guard_cleans_up_after_any_removal_and_writes_nothing_for_it(self):
        with Session() as session:
            data, system = session.home / ".local/share", session.home / "system"
            self.install(data / "flatpak", "org.example.Stays", "xdg-documents;")
            self.seed(data, "org.example.Removed", "[Context]\nfilesystems=xdg-music;\n")
            runner, calls = self.fake_flatpak(data, system)
            with mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", system), \
                    mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(data)}):
                flatpak_guard.assert_applications(runner=runner, data_home=data)
                flatpak_guard.assert_applications(runner=runner, data_home=data)
            self.assertEqual(self.leftovers(data, "org.example.Removed"), [])
            self.assertFalse([c for c in calls if c[-1] == "org.example.Removed"])

    def test_apply_writes_the_override_once_with_the_guard_in_it(self):
        with Session() as session:
            data = session.home / ".local/share"
            app = "org.example.Notes"
            metadata = "[Application]\nname=org.example.Notes\n\n[Context]\nfilesystems=xdg-documents;xdg-data/Suno/x;\n"
            calls = []

            def runner(command, **_keywords):
                calls.append(command)
                if "--show-metadata" in command:
                    return subprocess.CompletedProcess(command, 0, metadata, "")
                if command[1] == "list":
                    return subprocess.CompletedProcess(command, 0, f"{app}\t{app}/x86_64/stable\tuser\n", "")
                if command[1] == "info":
                    return subprocess.CompletedProcess(command, 0, "[Context]\nfilesystems=xdg-documents;xdg-data/Suno/x;\n", "")
                return subprocess.CompletedProcess(command, 0, "", "")
            with mock.patch.dict(os.environ, {"XDG_DATA_HOME": str(data)}), \
                    mock.patch.object(flatpak_permissions, "_write_atomically",
                                      wraps=flatpak_permissions._write_atomically) as write:
                flatpak_permissions.apply(app, "folders", ["Documents"], runner=runner)
            write.assert_called_once()
            self.assertFalse([c for c in calls if c[1] == "override"])  # no second writer
            text = (data / "flatpak/overrides" / app).read_text()
            self.assertIn("!xdg-data/Suno/x", text)
            self.assertIn("org.freedesktop.impl.portal.PermissionStore=none", text)

    @unittest.skipUnless(LINUX and (shutil.which("flatpak") or os.environ.get("SUNO_REQUIRE_FLATPAK_E2E") == "1"),
                         "needs flatpak")
    def test_real_flatpak_takes_the_exact_name_away(self):
        with Session() as session:
            env = {**os.environ, "XDG_DATA_HOME": str(session.home / ".local/share")}
            build = session.home / "build"
            (build / "app/files/bin").mkdir(parents=True)
            (build / "app/var").mkdir()
            (build / "app/files/bin/x").write_text("")
            (build / "app/metadata").write_text("[Application]\nname=org.Suno.Evil\n"
                                                "runtime=org.freedesktop.Platform/x86_64/24.08\n"
                                                "sdk=org.freedesktop.Sdk/x86_64/24.08\n")

            def run(*command):
                return subprocess.run(command, cwd=build, env=env, capture_output=True, text=True, check=True).stdout
            try:
                run("flatpak", "build-finish", "app", "--command=x")
                # Spellings flatpak rewrites: escapes, home/..., /var/run (a link to /run).
                with open(build / "app/metadata", "a") as stream:
                    stream.write("\n[Context]\nfilesystems=xdg-data/Suno/installer/permission-backups;"
                                 "xdg-data/Suno/installer:ro;~/.local/share/Suno/x;xdg-run/Suno-permissions/views;"
                                 "xdg-data/flatpa\\\\k/overrides;home/.local/share/Suno/y;"
                                 f"/var/run/user/{os.getuid()}/Suno-sound/z;xdg-documents;"
                                 # Places where it could plant a link a later start follows.
                                 "xdg-download;xdg-download/x;~/.var/app/org.Suno.Evil/l;\n")
                run("flatpak", "build-export", "--disable-sandbox", "repo", "app")
                run("flatpak", "build-bundle", "repo", "e.flatpak", "org.Suno.Evil")
                run("flatpak", "install", "-y", "--user", "--no-deps", "--bundle", "e.flatpak")
            except subprocess.CalledProcessError as error:
                reason = f"flatpak cannot install a test bundle here: {error.stderr[-200:]}"
                if os.environ.get("SUNO_REQUIRE_FLATPAK_E2E") == "1":
                    self.fail(reason)
                print(f"SKIP: {reason}", file=sys.stderr)
                self.skipTest(reason)
            # The link it plants in its own data folder, aimed at Flatpak's overrides.
            (session.home / ".local/share/flatpak/overrides").mkdir(parents=True, exist_ok=True)
            (session.home / ".var/app/org.Suno.Evil").mkdir(parents=True, exist_ok=True)
            (session.home / ".var/app/org.Suno.Evil/l").symlink_to(session.home / ".local/share/flatpak/overrides")
            (session.home / "Downloads").mkdir(exist_ok=True)
            (session.home / "Downloads/x").symlink_to(session.home / ".local/share/Suno")
            # Someone writes the app's own override to give a guarded place back.
            run("flatpak", "override", "--user", "--filesystem=xdg-data/Suno/installer/permission-backups", "org.Suno.Evil")
            with mock.patch.dict(os.environ, env), mock.patch.object(flatpak_guard, "SYSTEM_INSTALLATION", build / "none"):
                flatpak_guard.assert_global()
                flatpak_guard.assert_applications()
            shown = run("flatpak", "info", "--user", "--show-permissions", "org.Suno.Evil")
            items = [item for line in shown.splitlines() if line.startswith("filesystems=")
                     for item in line.split("=", 1)[1].split(";") if item]
            # The merged permissions keep only what is still given: the guarded places and the
            # places a link could be planted are gone.
            self.assertEqual(sorted(items), ["xdg-documents", "xdg-download"])
            self.assertIn("org.freedesktop.impl.portal.PermissionStore=none", shown + run(
                "flatpak", "override", "--user", "--show", "org.Suno.Evil"))
            override = flatpak_guard.current(session.home / ".local/share/flatpak/overrides/org.Suno.Evil")
            for name in ("xdg-data/Suno/installer/permission-backups", "xdg-data/Suno/installer", "~/.local/share/Suno/x",
                         "xdg-run/Suno-permissions/views", "xdg-data/flatpak/overrides", "~/.local/share/Suno/y",
                         "xdg-download/x", "~/.var/app/org.Suno.Evil/l"):
                self.assertIn(f"!{name}", override)
            # Without the guard the same bundle has them all.
            run("flatpak", "override", "--user", "--reset", "org.Suno.Evil")
            shown = run("flatpak", "info", "--user", "--show-permissions", "org.Suno.Evil")
            self.assertIn("xdg-data/Suno/installer/permission-backups", shown)


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


if __name__ == "__main__":
    unittest.main()
