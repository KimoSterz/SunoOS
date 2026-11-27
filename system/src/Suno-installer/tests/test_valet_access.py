# SPDX-License-Identifier: Apache-2.0
"""The install sheet's permission part (valet_access, valet_review): what it shows and what Install records."""
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from Suno_installer import app_permissions, valet_review
from Suno_installer.app_permissions import MemoryStore, Permissions
from Suno_installer.valet_access import Access, NEVER, REVIEW

APP = "org.projectSuno.Installed.deb-polychrome-0123456789ab"
FOLDERS = ["Desktop", "Documents", "Downloads", "Music", "Pictures", "Videos"]


def plan(**kwargs):
    with mock.patch.object(app_permissions, "_xdg_folder", side_effect=lambda name: name):
        return app_permissions.plan(**kwargs)


class Sheet(unittest.TestCase):
    def test_suggested_level_per_app_kind_is_selected_and_tagged(self):
        for categories, level, folders in ((["Graphics", "Photography"], "folders", ["Pictures"]),
                                           (["AudioVideo", "Audio", "Player"], "folders", ["Music"]),
                                           (["System", "FileManager"], "all", []),
                                           (["Utility", "TextEditor"], "chooser", [])):
            access = Access(plan(categories=categories), folders=FOLDERS)
            self.assertEqual((access.level, access.suggested_level), (level, level))
            self.assertEqual(access.folders, folders)
        access = Access(plan(categories=["Graphics", "Photography"]), folders=FOLDERS)
        self.assertEqual(access.level_detail("folders"), "Pictures")
        self.assertEqual(access.level_detail("chooser"), "Only files you choose")
        self.assertEqual(access.level_detail("all"), "Everything in your home folder")

    def test_these_folders_not_suggested_opens_the_chooser(self):
        access = Access(plan(categories=["Utility"]), folders=FOLDERS)
        self.assertEqual(access.level_detail("folders"), "Pick folders")
        self.assertFalse(access.chooser_open())
        access.set_level("folders")
        self.assertTrue(access.chooser_open())
        access.set_folder("Music", True)
        access.set_folder("Downloads", True)
        self.assertEqual(access.level_detail("folders"), "Music, Downloads")
        chosen = access.chosen()
        self.assertEqual(chosen["files"]["level"], "folders")
        self.assertEqual(chosen["files"]["folders"], ["Music", "Downloads"])
        self.assertEqual(chosen["files"]["suggested_level"], "chooser")
        # A suggested These folders keeps its own folders and needs no chooser.
        suggested = Access(plan(categories=["Photography"]), folders=FOLDERS)
        suggested.set_level("chooser")
        suggested.set_level("folders")
        self.assertFalse(suggested.chooser_open())
        self.assertEqual(suggested.folders, ["Pictures"])

    def test_uses_only_what_it_asks_for(self):
        self.assertEqual(Access(plan(uses=["network", "camera", "notifications"])).uses,
                         ["network", "camera", "notifications"])
        self.assertEqual(Access(plan()).uses, [])  # nothing asked: no Uses block
        # A native package declares nothing and gets the network as any host program does.
        self.assertEqual(Access(plan(uses=["autostart"]), native=True).uses, ["network", "autostart"])

    def test_blocked_uses_are_recorded(self):
        with tempfile.TemporaryDirectory() as home:
            access = Access(plan(uses=["network", "camera", "background", "autostart"]))
            access.set_use("camera", False)
            access.set_use("network", False)
            access.set_use("autostart", False)
            model = Permissions(MemoryStore(), home=Path(home))
            model.install(APP, access.chosen())
            self.assertFalse(model.network(APP))
            self.assertFalse(model.autostart(APP))
            self.assertEqual(model.store.lookup("devices", "camera"), {APP: ["no"]})

    def test_device_request_on_by_default_and_off(self):
        devices = {"name": "USB lighting and keyboards", "icon": "usb", "kinds": ["lighting", "hid"], "count": 2,
                   "requests": ["lighting:1d50:6089", "hid:1532:0084"], "default": True}
        access = Access(plan(devices=devices))
        self.assertTrue(access.device_granted)
        self.assertEqual(access.device_detail(), "Its package’s device rules ask for direct access to 2 kinds of device")
        with tempfile.TemporaryDirectory() as home:
            model = Permissions(MemoryStore(), home=Path(home))
            model.install(APP, access.chosen())
            self.assertEqual(model.devices(APP), devices["requests"])
            access.set_device(False)
            model.forget(APP)
            model.install(APP, access.chosen())
            self.assertEqual(model.devices(APP), [])  # installed without the rules
            self.assertEqual(model.device_requests(APP), devices["requests"])

    def test_never_line_is_fixed(self):
        self.assertEqual(NEVER, "Never your keys, passwords, browser profiles, other apps’ data, "
                                "or anything that runs when you sign in.")
        self.assertEqual(REVIEW, "Installed from the command line with these. Change anything here.")


class Review(unittest.TestCase):
    def detail(self):
        return {"level": "folders", "folders": ["Pictures"], "suggested_level": "folders", "suggested_folders": ["Pictures"],
                "uses": ["network", "camera"], "network": False, "background": False, "autostart": False,
                "device_requests": ["lighting:1d50:6089"], "granted_devices": ["lighting:1d50:6089"]}

    def test_the_sheet_reads_what_the_command_line_recorded(self):
        access = Access(valet_review.plan_from_detail(self.detail()), review=True)
        self.assertTrue(access.review)
        self.assertEqual((access.level, access.folders, access.suggested_level), ("folders", ["Pictures"], "folders"))
        self.assertFalse(access.allowed["network"])
        self.assertTrue(access.device_granted)
        self.assertEqual(access.device["name"], "USB lighting")

    def test_a_change_applies_at_once(self):
        before = valet_review.plan_from_detail(self.detail())
        access = Access(before, review=True)
        access.set_level("chooser")
        access.set_use("network", True)
        access.set_device(False)
        service = valet_review.Service.__new__(valet_review.Service)
        calls = []
        service.call = lambda method, signature, *args, reply=None: calls.append((method, args))
        service.apply(APP, before, access)
        self.assertEqual(calls, [("SetFileLevel", (APP, "chooser")), ("SetNetwork", (APP, True)),
                                 ("SetDeviceRequests", (APP, False))])
        calls.clear()
        later = access.chosen()
        access.set_level("folders")
        access.set_folder("Music", True)
        service.apply(APP, later, access)
        self.assertEqual(calls, [("SetFileLevel", (APP, "folders")), ("SetFolder", (APP, "Music", True))])


class FlatpakRef(unittest.TestCase):
    def test_metadata_from_a_remote_this_computer_has(self):
        from Suno_installer import package_access
        with tempfile.TemporaryDirectory() as folder:
            ref = Path(folder) / "kiln.flatpakref"
            ref.write_text("[Flatpak Ref]\nName=com.kilnlabs.Kiln\nBranch=stable\nUrl=https://dl.flathub.org/repo/\n")
            calls = []

            def runner(argv, **_kwargs):
                calls.append(argv)
                out = ("flathub\thttps://dl.flathub.org/repo/\n" if argv[1] == "remotes" else
                       "[Application]\nname=com.kilnlabs.Kiln\n[Context]\nshared=network;ipc;\nfilesystems=xdg-pictures;\n")
                return mock.Mock(returncode=0, stdout=out)
            details = package_access.remote_metadata(ref, runner=runner)
        self.assertEqual(calls[1], ["flatpak", "remote-info", "--show-metadata", "flathub", "app/com.kilnlabs.Kiln//stable"])
        with mock.patch.object(app_permissions, "_xdg_folder", side_effect=lambda name: name):
            found = app_permissions.plan(declared={"filesystems": details["Context · filesystems"].split(";")},
                                         uses=package_access.flatpak_uses(details))
        self.assertEqual((found["files"]["level"], found["files"]["folders"]), ("folders", ["Pictures"]))
        self.assertEqual(found["uses"], ["network"])

    def test_unknown_remote_suggests_from_nothing(self):
        from Suno_installer import package_access
        with tempfile.TemporaryDirectory() as folder:
            ref = Path(folder) / "x.flatpakref"
            ref.write_text("[Flatpak Ref]\nName=org.example.X\nUrl=https://example.org/repo\n")
            runner = lambda argv, **_k: mock.Mock(returncode=0, stdout="flathub\thttps://dl.flathub.org/repo/\n")
            self.assertIsNone(package_access.remote_metadata(ref, runner=runner))


class AllFiles(unittest.TestCase):
    def test_flatpaks_that_declare_home_are_listed(self):
        service = app_permissions.AppPermissionsService.__new__(app_permissions.AppPermissionsService)
        with tempfile.TemporaryDirectory() as home:
            service.model = Permissions(MemoryStore(), home=Path(home))
            service.model.install(APP, {"files": {"level": "all", "reason": "sync"}})
            flatpaks = {"org.example.Files": {"format": "flatpak", "flatpak_id": "org.example.Files", "name": "Files",
                                              "origin": "flathub", "installation": "system"},
                        "org.example.Notes": {"format": "flatpak", "flatpak_id": "org.example.Notes", "name": "Notes",
                                              "origin": "flathub", "installation": "user"}}
            declared = {"org.example.Files": "all", "org.example.Notes": "chooser"}
            with mock.patch.object(app_permissions, "flatpak_apps", return_value=flatpaks), \
                    mock.patch.object(app_permissions, "installed_records", return_value={}), \
                    mock.patch.object(app_permissions, "declared_level", side_effect=lambda app: declared.get(app, "")):
                self.assertEqual(service.all_files(), ["org.example.Files", APP])
                apps = service.apps()
        self.assertEqual(apps[APP]["reason"], "sync")
        self.assertEqual(apps["org.example.Files"]["reason"], "declared")
        self.assertEqual(apps["org.example.Files"]["origin"], "Flathub")

    def test_built_in(self):
        record = {"format": "flatpak", "flatpak_id": "org.projectSuno.Filer", "origin": "Suno", "installation": "system"}
        self.assertEqual(app_permissions.origin(record), ("flatpak", "Built in"))
        self.assertEqual(app_permissions.origin({**record, "origin": "flathub"}), ("flatpak", "Flathub"))


class Depot(unittest.TestCase):
    """Depot asks with the same sheet; its catalogue keys make the plan."""

    def app(self, **kwargs):
        from types import SimpleNamespace
        base = dict(app_id="kiln", name="Kiln", categories=("Graphics",), permissions=(), channel_kind="",
                    package_kind="flatpak", flatpak_id="com.kilnlabs.Kiln")
        base.update(kwargs)
        return SimpleNamespace(**base)

    def test_plan_from_the_listing(self):
        from types import SimpleNamespace
        from Suno_installer import depot_access
        keys = [SimpleNamespace(key=k) for k in ("files.pictures", "network", "devices.camera", "notifications")]
        with mock.patch.object(app_permissions, "_xdg_folder", side_effect=lambda name: name):
            found = depot_access.plan_for_app(self.app(permissions=keys))
        self.assertEqual((found["files"]["level"], found["files"]["folders"]), ("folders", ["Pictures"]))
        self.assertEqual(found["uses"], ["network", "camera", "notifications"])
        access = Access(found)
        self.assertEqual(access.suggested_level, "folders")

    def test_only_what_the_model_installs(self):
        from Suno_installer import depot_access
        self.assertTrue(depot_access.shows_sheet(self.app()))
        self.assertTrue(depot_access.shows_sheet(self.app(package_kind="deb")))
        self.assertFalse(depot_access.shows_sheet(self.app(channel_kind="snap", package_kind="snap")))

    def test_the_choice_is_recorded_once(self):
        from Suno_installer import depot_access
        depot_access.choose("kiln", {"files": {"level": "chooser"}})
        recorded = []
        depot_access.record_flatpak("com.kilnlabs.Kiln", depot_access.take("kiln"),
                                    record=lambda app, chosen, flatpak: recorded.append((app, chosen, flatpak)))
        self.assertEqual(recorded, [("com.kilnlabs.Kiln", {"files": {"level": "chooser"}}, True)])
        self.assertIsNone(depot_access.take("kiln"))


if __name__ == "__main__":
    unittest.main()
