# SPDX-License-Identifier: Apache-2.0

import importlib.util
import itertools
import json
import pathlib
import subprocess
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "src/luma-shell-state/luma_shell_state.py"
SPEC = importlib.util.spec_from_file_location("luma_shell_state", MODULE_PATH)
assert SPEC and SPEC.loader
state = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(state)


class ShellStateModelTests(unittest.TestCase):
    def test_runtime_profile_reads_standardized_hints_and_boot_override(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            def write(name, value):
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(value)
            self.assertEqual(state.read_presentation_profile(root), "desktop")
            write("run/luma/experience", b"handheld\n")
            self.assertEqual(state.read_presentation_profile(root), "mobile")
            write("run/luma/experience", b"")
            write("sys/class/dmi/id/chassis_type", b"9\n")
            write("sys/firmware/devicetree/base/chassis-type", b"tablet\0")
            self.assertEqual(state.read_presentation_profile(root), "tablet")
            write("etc/luma-device-class", b"handheld\n")
            self.assertEqual(state.read_presentation_profile(root), "mobile")
            write("run/luma/experience", b"desktop\n")
            self.assertEqual(state.read_presentation_profile(root), "desktop")
            write("run/luma/experience", b"invalid")
            write("etc/luma-device-class", b"desktop")
            write("sys/firmware/devicetree/base/chassis-type", b"handset\0")
            self.assertEqual(state.read_presentation_profile(root), "mobile")
            write("sys/firmware/devicetree/base/chassis-type", b"x" * 129)
            self.assertEqual(state.read_presentation_profile(root), "desktop")

    def test_device_tree_handset_records_the_handheld_class_once(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "etc").mkdir()
            self.assertEqual(state.record_device_class(root), "")
            self.assertFalse((root / "etc/luma-device-class").exists())
            tree = root / "sys/firmware/devicetree/base/chassis-type"
            tree.parent.mkdir(parents=True)
            tree.write_bytes(b"laptop\0")
            self.assertEqual(state.record_device_class(root), "")
            tree.write_bytes(b"handset\0")
            self.assertEqual(state.record_device_class(root), "handheld")
            self.assertEqual((root / "etc/luma-device-class").read_text(), "handheld\n")
            self.assertEqual(state.read_presentation_profile(root), "mobile")
            # A device layer's own marker always wins.
            (root / "etc/luma-device-class").write_text("desktop\n")
            self.assertEqual(state.record_device_class(root), "desktop")

    def test_device_class_environment_generator(self):
        generator = ROOT / "src/luma-shell-state/luma-device-class-environment"
        text = generator.read_text()
        self.assertIn("/etc/luma-device-class", text)
        for marker, expected in (("handheld", "LUMA_DEVICE_CLASS=handheld"), ("mobile", "LUMA_DEVICE_CLASS=handheld"),
                                 ("tablet", "LUMA_DEVICE_CLASS=tablet"), ("other", ""), (None, "")):
            with tempfile.TemporaryDirectory() as directory:
                path = pathlib.Path(directory) / "luma-device-class"
                if marker is not None:
                    path.write_text(marker + "\n")
                script = text.replace("/etc/luma-device-class", str(path))
                result = subprocess.run(["sh", "-c", script], capture_output=True, text=True, check=True)
                self.assertEqual(result.stdout.strip(), expected)

    def test_home_grid_accepts_integer_widget_spans(self):
        value = {"columns": 4, "rows": 5, "pages": [[
            {"id": "weather", "kind": "widget", "x": 0, "y": 0, "w": 2, "h": 2},
            {"id": "org.example.App.desktop", "kind": "app", "x": 2, "y": 0, "w": 1, "h": 1}]]}
        for mode in ("mobile", "tablet"):
            normalized = state.normalize_home_layout(f"{mode}:4x5", value)
            self.assertEqual(normalized["version"], 1)
            self.assertEqual(normalized["pages"], value["pages"])

    def test_home_grid_rejects_overlap_and_duplicate_items(self):
        item = {"id": "org.example.App.desktop", "kind": "app", "x": 0, "y": 0, "w": 1, "h": 1}
        for pages in ([[item, {**item, "id": "org.example.Other.desktop"}]], [[item], [item]]):
            with self.assertRaises(state.InvalidState):
                state.normalize_home_layout("tablet:4x5", {"columns": 4, "rows": 5, "pages": pages})

    def test_home_grid_rejects_ambiguous_or_unbounded_positions(self):
        item = {"id": "org.example.App.desktop", "kind": "app", "x": 0, "y": 0, "w": 1, "h": 1}
        for change in ({"x": True}, {"x": 1.5}, {"y": -1}, {"w": 2}, {"h": 6}, {"x": 4}, {"kind": "command"}):
            with self.subTest(change=change), self.assertRaises(state.InvalidState):
                state.normalize_home_layout("mobile:4x5", {"columns": 4, "rows": 5, "pages": [[{**item, **change}]]})
        for profile in ("desktop:4x5", "mobile:0x5", "tablet:99x99", None):
            with self.assertRaises(state.InvalidState):
                state.normalize_home_layout(profile, {"columns": 4, "rows": 5, "pages": [[item]]})

    def test_automatic_never_infers_mobile_from_peripherals_or_posture(self):
        for values in itertools.product((None, False, True), repeat=4):
            capabilities = dict(zip(("touchscreen", "tablet_mode", "keyboard", "pointer"), values))
            for profile in ("desktop", "tablet"):
                with self.subTest(profile=profile, capabilities=capabilities):
                    self.assertNotEqual(state.presentation_state(profile=profile,
                        capabilities=capabilities)["effective"], "mobile")
            for profile in ("mobile", "handheld"):
                with self.subTest(profile=profile, capabilities=capabilities):
                    self.assertEqual(state.presentation_state(profile=profile,
                        capabilities=capabilities)["effective"], "mobile")

    def test_boot_profiles_and_standardized_hardware_categories(self):
        for requested in ("desktop", "tablet", "mobile"):
            for chassis in (None, 3, 30, 31, 32):
                self.assertEqual(state.presentation_profile(requested, "handheld", chassis), requested)
        for device in ("handheld", "mobile"):
            self.assertEqual(state.presentation_profile("", device, 32), "mobile")
        for chassis in (30, 32):
            self.assertEqual(state.presentation_profile("", "desktop", chassis), "tablet")
        for chassis in (None, 3, 31, 99):
            self.assertEqual(state.presentation_profile("", "desktop", chassis), "desktop")
    def test_explicit_presentation_survives_every_posture(self):
        for mode in ("desktop", "tablet", "mobile"):
            for posture in (None, False, True):
                for profile in ("desktop", "tablet", "mobile"):
                    result = state.presentation_state(mode, profile=profile,
                        capabilities={"touchscreen": True, "tablet_mode": posture})
                    self.assertEqual((result["effective"], result["reason"]), (mode, "user"))

    def test_automatic_uses_posture_and_profile_not_keyboard_absence(self):
        for keyboard in (False, True, None):
            result = state.presentation_state(capabilities={"keyboard": keyboard})
            self.assertEqual(result["effective"], "desktop")
        self.assertEqual(state.presentation_state(profile="tablet")["effective"], "tablet")
        for posture in (False, True):
            capabilities = {"touchscreen": True, "tablet_mode": posture, "keyboard": False}
            self.assertEqual(state.presentation_state(capabilities=capabilities)["effective"],
                             "tablet" if posture else "desktop")
            self.assertEqual(state.presentation_state(profile="mobile",
                             capabilities=capabilities)["effective"], "mobile")
        self.assertEqual(state.presentation_state(capabilities={
            "tablet_mode": True, "touchscreen": False})["effective"], "desktop")

    def test_fold_posture_picks_mobile_or_tablet_unless_chosen(self):
        for profile in ("tablet", "mobile", "desktop"):
            for fold, expected in (("folded", "mobile"), ("unfolded", "tablet")):
                result = state.presentation_state(profile=profile, fold=fold,
                    capabilities={"touchscreen": True, "tablet_mode": False})
                self.assertEqual((result["effective"], result["reason"]), (expected, "fold"))
                result = state.presentation_state("desktop", profile=profile, fold=fold)
                self.assertEqual((result["effective"], result["reason"]), ("desktop", "user"))
        for fold in (None, "", "half", 1):
            result = state.presentation_state(profile="tablet", fold=fold)
            self.assertEqual((result["effective"], result["fold"]), ("tablet", None))
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            self.assertIsNone(state.read_fold_posture(root))
            (root / "run/luma").mkdir(parents=True)
            for value, expected in ((b"folded\n", "folded"), (b"unfolded", "unfolded"),
                                    (b"open\n", None), (b"\xff", None), (b"folded" * 4, None)):
                (root / "run/luma/posture").write_bytes(value)
                self.assertEqual(state.read_fold_posture(root), expected)

    def test_presentation_rejects_ambiguous_and_untyped_observations(self):
        for mode in ("phone", "Tablet", "", None, 1):
            with self.assertRaises(state.InvalidState):
                state.normalize_presentation(mode)
        for capabilities in ({"tablet_mode": 1}, {"keyboard": "false"},
                             {"width": 1280}, [], None):
            with self.assertRaises(state.InvalidState):
                state.normalize_capabilities(capabilities)

    def test_status_cluster_contract(self):
        expected = state.normalize_status()
        self.assertEqual(expected["frame"], "none")
        self.assertEqual((expected["time_size"], expected["date_size"]), (21, 11))
        for scope in ["all", "controls", "split", "joined", "flush"]:
            self.assertEqual(state.normalize_status({"frame_scope": scope})["frame_scope"], scope)
        for value in ["#123abc", "#ABCDEF"]:
            self.assertEqual(state.normalize_status({"clock_fill": value})["clock_fill"], value)
        for value in ["red", "#fff", "#123abc; padding: 500px", None, 42]:
            self.assertEqual(state.normalize_status({"clock_fill": value})["clock_fill"], "#7f8892")
        for invalid in [{"frame": "invalid"}, {"fill_strength": "15"}, {"time_size": 22},
                        {"date_size": True}, {"controls_right": 1}]:
            with self.assertRaises(state.InvalidState):
                state.normalize_status(invalid)

    def test_legacy_gtk_theme_follows_shared_appearance(self):
        self.assertEqual(state.gtk_theme_for_appearance("prefer-dark"), "Luma-dark")
        self.assertEqual(state.gtk_theme_for_appearance("prefer-light"), "Luma")
        self.assertEqual(state.gtk_theme_for_appearance("default"), "Luma")

    def test_legacy_gtk_theme_has_one_translucent_stand_in(self):
        """A toolkit that cannot be translucent still gets a defined band.

        GTK 3, and Chromium and the Electron applications that read their
        window colours from the GTK 3 theme, cannot take part in a treatment.
        They used to keep Adwaita's window colour, which is a different colour
        again from every window that can be translucent, and that is one of
        the mismatched title bars on the desktop.
        """
        for treatment in ("frost", "glass"):
            with self.subTest(treatment=treatment):
                self.assertEqual(
                    state.gtk_theme_for_appearance("default", treatment),
                    "Luma-translucent",
                )
                self.assertEqual(
                    state.gtk_theme_for_appearance("prefer-dark", treatment),
                    "Luma-translucent",
                )
        self.assertEqual(state.gtk_theme_for_appearance("default", "light"), "Luma")
        self.assertEqual(state.gtk_theme_for_appearance("default", "dark"), "Luma-dark")

    def test_application_ids_are_ordered_and_deduplicated(self):
        self.assertEqual(
            state.normalize_app_ids(["org.example.One.desktop", "org.example.One.desktop", "two.desktop"]),
            ["org.example.One.desktop", "two.desktop"],
        )

    def test_application_ids_reject_paths_and_non_desktop_names(self):
        for value in ("org.example.App", "../app.desktop", "/tmp/app.desktop", ""):
            with self.subTest(value=value), self.assertRaises(state.InvalidState):
                state.normalize_app_ids([value])

    def test_wallpaper_is_local(self):
        self.assertEqual(
            state.normalize_wallpaper_uri("file:///usr/share/backgrounds/luma/a.jpg"),
            "file:///usr/share/backgrounds/luma/a.jpg",
        )
        with self.assertRaises(state.InvalidState):
            state.normalize_wallpaper_uri("https://example.invalid/a.jpg")

    def test_presentation_idle_defaults_preserve_explicit_preferences(self):
        for mode, seconds in (("desktop", 300), ("tablet", 120), ("mobile", 60)):
            self.assertEqual(state.presentation_idle_default(mode, None), seconds)
            self.assertEqual(state.presentation_idle_default(mode, 300, 300), seconds)
            for preference in (0, 60, 120, 300, 600):
                self.assertIsNone(state.presentation_idle_default(mode, preference))
            self.assertIsNone(state.presentation_idle_default(mode, 600, 120))
        with self.assertRaises(state.InvalidState):
            state.presentation_idle_default("automatic", None)

    def test_a_tv_never_idles_unless_its_owner_chose_a_delay(self):
        # A TV is watched, not touched: its default is never blank the screen.
        self.assertEqual(state.presentation_idle_default("tv", None), 0)
        self.assertEqual(state.presentation_idle_default("tv", 300, 300), 0)
        self.assertIsNone(state.presentation_idle_default("tv", 900))

    def test_handheld_presentations_hide_window_controls_and_desktop_restores(self):
        layout = state.presentation_button_layout
        for mode in ("tablet", "mobile"):
            # No user value: hide, and restore the system default later.
            self.assertEqual(layout(mode, None, None), (":", ""))
            # A desktop customisation is kept for Desktop.
            self.assertEqual(layout(mode, "close:", None), (":", "close:"))
            # Already owned and still hidden: nothing to do.
            self.assertEqual(layout(mode, ":", "close:"), (None, "close:"))
            # Changed while handheld: the person's choice, ownership ends.
            self.assertEqual(layout(mode, ":close", "close:"), (None, None))
            # A person who already chose no controls is left alone.
            self.assertEqual(layout(mode, ":", None), (None, None))
        self.assertEqual(layout("desktop", ":", ""), ("", None))
        self.assertEqual(layout("desktop", ":", "close:"), ("close:", None))
        self.assertEqual(layout("desktop", ":minimize,maximize,close", None), (None, None))
        with self.assertRaises(state.InvalidState):
            layout("automatic", None, None)

    def test_idle_delay_accepts_off_or_phone_safe_interval(self):
        self.assertEqual(state.normalize_idle_delay(0), 0)
        self.assertEqual(state.normalize_idle_delay(60), 60)
        for value in (1, 14, 86401, True):
            with self.subTest(value=value), self.assertRaises(state.InvalidState):
                state.normalize_idle_delay(value)

    def test_renderer_detection_is_capability_not_resolution(self):
        self.assertEqual(state.detect_renderer({"XDG_CURRENT_DESKTOP": "Phosh"}), "phosh")
        self.assertEqual(state.detect_renderer({"XDG_CURRENT_DESKTOP": "Luma:GNOME"}), "gnome")
        self.assertEqual(state.detect_renderer({}), "unknown")

    def test_empty_home_follows_favorites(self):
        snapshot = state.build_snapshot(
            favorites=["org.example.One.desktop"],
            home_apps=[],
            wallpaper_uri="file:///usr/share/backgrounds/luma/a.jpg",
            wallpaper_uri_dark="file:///usr/share/backgrounds/luma/a.jpg",
            wallpaper_style="zoom",
            appearance="prefer-light",
            idle_delay=60,
            screen_keyboard_enabled=True,
            launcher_columns=4,
            input_method="luma-latin",
            restore_app_state=True,
            renderer="phosh",
            shelf=state.normalize_shelf(
                layout_version=1,
                edge="bottom",
                dock_anchor="center",
                actions_anchor="center",
                group_layout="centered-combined",
                surface_mode="separate",
                edge_mode="floating",
                material="dark",
                monitor_mode="primary",
                overflow_mode="scroll",
                dock_visible=True,
                actions_visible=True,
                reserve_work_area=True,
                auto_hide=False,
                islands=["dock", "actions"],
            ),
        )
        self.assertEqual(snapshot["home_apps"], snapshot["favorites"])
        self.assertEqual(snapshot["renderer"], "phosh")
        self.assertEqual(snapshot["shelf"]["edge"], "bottom")
        self.assertEqual(json.loads(state.encode_snapshot(snapshot)), snapshot)

    def test_shelf_contract_is_typed_and_rejects_unsupported_policy(self):
        shelf = state.normalize_shelf(
            layout_version=1,
            edge="left",
            dock_anchor="start",
            actions_anchor="end",
            group_layout="split-ends",
            surface_mode="connected",
            edge_mode="protruding",
            material="glass",
            monitor_mode="all",
            overflow_mode="scroll",
            dock_visible=True,
            actions_visible=False,
            reserve_work_area=True,
            auto_hide=False,
            islands=["dock", "dock"],
        )
        self.assertEqual(shelf["islands"], ["dock"])
        self.assertFalse(shelf["span_full"])
        self.assertTrue(shelf["float_ends"])
        self.assertEqual(shelf["padding"], 10)
        self.assertEqual(state.normalize_shelf(**{**shelf, "group_layout": "luma"})["group_layout"], "luma")
        for padding in [4, 10, 24]:
            self.assertEqual(state.normalize_shelf(**{**shelf, "padding": padding})["padding"], padding)
        for padding in [3, 25, 10.5, True, "10"]:
            with self.assertRaises(state.InvalidState):
                state.normalize_shelf(**{**shelf, "padding": padding})
        spanning = state.normalize_shelf(**{**shelf, "span_full": True, "float_ends": False})
        self.assertTrue(spanning["span_full"])
        self.assertFalse(spanning["float_ends"])
        self.assertFalse(state.normalize_shelf(**{**spanning, "span_full": False})["float_ends"])
        with self.assertRaises(state.InvalidState):
            state.normalize_shelf(**{**shelf, "auto_hide": True})


    def test_arrangement_normalises_like_the_shell(self):
        groups = [
            {"display": "", "edge": "top", "anchor": "center", "position": 0.5, "islands": ["clock", "bogus"]},
            {"display": "", "edge": "sideways", "anchor": "start", "position": 0.5, "islands": ["media"]},
            {"display": "DP-2|DEL|0x2|X", "edge": "bottom", "anchor": "nowhere", "position": 7,
             "islands": ["dock", "clock", "live"]},
            {"display": 5, "edge": "left", "anchor": "free", "position": "x", "islands": "media"},
            {"edge": "right", "islands": []},
            "not a group",
        ]
        normalized = state.normalize_arrangement(groups)
        self.assertEqual(normalized[0]["islands"], ["clock"])
        self.assertEqual(normalized[1], {"display": "DP-2|DEL|0x2|X", "edge": "bottom", "anchor": "center",
                                         "position": 0.5, "islands": ["dock", "live"]})
        self.assertEqual(normalized[2], {"display": "", "edge": "left", "anchor": "free", "position": 0.5,
                                         "islands": ["media"]})
        self.assertEqual(len(normalized), 3)
        self.assertEqual(state.normalize_arrangement([]), [])
        self.assertEqual(state.normalize_arrangement(None), [])
        self.assertEqual(state.SHELF_PLACEABLE_ISLANDS,
                         ("dock", "live", "media", "well", "quick-options", "clock", "notifications"))

    def test_shelf_snapshot_carries_the_arrangement(self):
        shelf = state.normalize_shelf(
            layout_version=1, edge="bottom", dock_anchor="center", actions_anchor="center",
            group_layout="centered-combined", surface_mode="separate", edge_mode="floating",
            material="dark", monitor_mode="primary", overflow_mode="scroll", dock_visible=True,
            actions_visible=True, reserve_work_area=True, auto_hide=False, islands=["dock"],
            arrangement=[{"edge": "left", "anchor": "center", "islands": ["dock"]}])
        self.assertEqual(shelf["arrangement"], [{"display": "", "edge": "left", "anchor": "center",
                                                 "position": 0.5, "islands": ["dock"]}])
        default = state.normalize_shelf(**{**shelf, "arrangement": None})
        self.assertEqual(default["arrangement"], [])

    def test_schema_declares_the_arrangement_key(self):
        from pathlib import Path
        schema = (Path(__file__).resolve().parents[2] / "src/luma-shell-state/org.project_luma.shell-state.gschema.xml").read_text()
        self.assertIn('<key name="shelf-arrangement" type="aa{sv}">', schema)
        self.assertIn("<default>[]</default>", schema.split('name="shelf-arrangement"')[1].split("</key>")[0])

    def test_free_positions_snap_without_free_placement(self):
        groups = [{"edge": "top", "anchor": "free", "position": 0.1, "islands": ["media"]},
                  {"edge": "left", "anchor": "free", "position": 0.9, "islands": ["dock"]},
                  {"edge": "bottom", "anchor": "free", "position": 0.5, "islands": ["clock"]}]
        snapped = state.normalize_arrangement(groups, free_placement=False)
        self.assertEqual([g["anchor"] for g in snapped], ["start", "end", "center"])
        self.assertTrue(all(g["position"] == 0.5 for g in snapped))
        kept = state.normalize_arrangement(groups, free_placement=True)
        self.assertEqual([g["anchor"] for g in kept], ["free", "free", "free"])
        self.assertEqual(kept[0]["position"], 0.1)

    def test_schema_declares_free_placement_off(self):
        from pathlib import Path
        schema = (Path(__file__).resolve().parents[2] / "src/luma-shell-state/org.project_luma.shell-state.gschema.xml").read_text()
        block = schema.split('name="shelf-free-placement"')[1].split("</key>")[0]
        self.assertIn("<default>false</default>", block)

    def test_posture_is_tv_or_the_presentation(self):
        for presentation in ("desktop", "tablet", "mobile"):
            with self.subTest(presentation=presentation):
                off = state.posture_state(presentation=presentation)
                self.assertEqual(off["effective"], presentation)
                self.assertFalse(off["tv"])
                on = state.posture_state("tv", presentation=presentation)
                self.assertEqual((on["effective"], on["reason"], on["tv"]), ("tv", "user", True))
        self.assertEqual(state.posture_state(device="tv")["effective"], "tv")
        self.assertEqual(state.posture_state(device="tv")["reason"], "device")
        self.assertEqual(state.posture_state(presentation="bogus")["effective"], "desktop")
        self.assertEqual(state.normalize_posture("auto"), "automatic")
        for value in ("television", "desktop", "", None):
            with self.subTest(value=value), self.assertRaises(state.InvalidState):
                state.normalize_posture(value)

    def test_device_posture_reads_the_device_class(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            self.assertIsNone(state.read_device_posture(root))
            (root / "etc").mkdir()
            (root / "etc/luma-device-class").write_text("desktop\n")
            self.assertIsNone(state.read_device_posture(root))
            (root / "etc/luma-device-class").write_text("tv\n")
            self.assertEqual(state.read_device_posture(root), "tv")
            # A television is a desktop underneath: presentation is unchanged.
            self.assertEqual(state.read_presentation_profile(root), "desktop")

    def test_snapshot_posture_follows_presentation_until_tv(self):
        presentation = state.presentation_state("tablet")
        kwargs = dict(favorites=[], home_apps=[], wallpaper_uri="file:///a.jpg",
                      wallpaper_uri_dark="file:///a.jpg", wallpaper_style="zoom",
                      appearance="default", idle_delay=0, screen_keyboard_enabled=False,
                      launcher_columns=4, input_method="luma-latin", restore_app_state=True,
                      renderer="gnome", presentation=presentation)
        snapshot = state.build_snapshot(**kwargs)
        self.assertEqual(snapshot["posture"]["effective"], "tablet")
        self.assertEqual(snapshot["presentation"], presentation)
        tv = state.build_snapshot(**kwargs, posture=state.posture_state("tv", presentation="tablet"))
        self.assertEqual(tv["posture"]["effective"], "tv")
        self.assertEqual(tv["presentation"], presentation)

    def test_schema_declares_posture_automatic(self):
        schema = (ROOT / "src/luma-shell-state/org.project_luma.shell-state.gschema.xml").read_text()
        block = schema.split('name="posture"')[1].split("</key>")[0]
        self.assertIn("<default>'automatic'</default>", block)
        self.assertIn('<choice value="tv"/>', block)


class CallerAdmissionTests(unittest.TestCase):
    """Setters answer the shells, Settings and luma-shell-statectl, never a sandbox."""

    HOST = {"cgroup": "0::/user.slice/user-1000.slice/user@1000.service/app.slice/x.scope\n",
            "label": "unconfined_u:unconfined_r:unconfined_t:s0", "flatpak": False,
            "same_root": True, "same_mnt": True, "comm": "x"}

    def setUp(self):
        original = state._root_owned
        state._root_owned = lambda path: path.startswith("/usr/")
        self.addCleanup(setattr, state, "_root_owned", original)

    def facts(self, **values):
        return {**self.HOST, **values}

    def test_shell_and_settings_are_admitted(self):
        self.assertEqual(state.admit_caller(self.facts(exe="/usr/bin/gnome-shell", argv=["/usr/bin/gnome-shell"])),
                         "org.gnome.Shell")
        self.assertEqual(state.admit_caller(self.facts(exe="/usr/libexec/phosh", argv=["/usr/libexec/phosh"])),
                         "sm.puri.Phosh")
        self.assertEqual(state.admit_caller(self.facts(
            exe="/usr/bin/gnome-control-center", argv=["gnome-control-center"],
            cgroup="0::/user.slice/user@1000.service/app.slice/app-gnome-org.gnome.Settings-4242.scope")), "")

    def test_statectl_is_admitted_only_as_the_installed_script(self):
        statectl = self.facts(exe="/usr/bin/python3.14",
                              argv=["/usr/bin/python3", "-I", "/usr/bin/luma-shell-statectl"])
        self.assertEqual(state.admit_caller(statectl), "")
        # Not isolated: PYTHONPATH and user site-packages would load first.
        self.assertIsNone(state.admit_caller({**statectl, "argv": ["/usr/bin/python3", "/usr/bin/luma-shell-statectl"]}))
        self.assertIsNone(state.admit_caller({**statectl, "argv": ["/usr/bin/python3", "-I", "/home/a/luma-shell-statectl"]}))
        self.assertIsNone(state.admit_caller({**statectl, "argv": ["/usr/bin/python3", "-c"]}))
        self.assertIsNone(state.admit_caller({**statectl, "exe": "/home/a/python3"}))

    def test_other_host_programs_are_refused(self):
        for exe in ("/usr/bin/python3.14", "/usr/bin/gjs-console", "/home/a/gnome-shell", "/usr/bin/bash"):
            self.assertIsNone(state.admit_caller(self.facts(exe=exe, argv=[exe, "/tmp/x"])), exe)

    def test_a_sandbox_is_refused_whatever_it_runs(self):
        settings = self.facts(exe="/usr/bin/gnome-control-center", argv=["/usr/bin/gnome-control-center"])
        for change, reason in (
                ({"flatpak": True}, "flatpak"),
                ({"cgroup": "0::/user.slice/user@1000.service/app.slice/app-flatpak-org.x.Y-12.scope"}, "application scope"),
                ({"cgroup": "0::/user.slice/user@1000.service/app.slice/app-luma-x-12.scope"}, "application scope"),
                ({"label": "system_u:system_r:luma_application.process:s0:c1,c2"}, "application domain"),
                ({"same_mnt": False}, "another filesystem namespace"),
                ({"same_root": False}, "another filesystem namespace")):
            facts = {**settings, **change}
            self.assertEqual(state.sandbox_reason(facts), reason)
            self.assertIsNone(state.admit_caller(facts))
            self.assertIsNone(state.admit_caller(facts, extra=("/usr/bin/gnome-control-center",)))

    def test_an_unreadable_process_is_a_sandbox_even_in_the_shells_unit(self):
        # A host program can start itself as org.gnome.Shell@x, make itself
        # non-dumpable and take org.gnome.Shell (owned with ALLOW_REPLACEMENT).
        hidden = self.facts(exe=None, flatpak=None, same_root=None, same_mnt=None, argv=["/usr/bin/gnome-shell"])
        for cgroup in ("0::/user.slice/user-1000.slice/user@1000.service/session.slice/org.gnome.Shell@x.service\n",
                       "0::/user.slice/user-1000.slice/session-3.scope", "0::/app.slice/app-flatpak-org.x.Y-1.scope"):
            with self.subTest(cgroup=cgroup):
                self.assertTrue(state.sandbox_reason({**hidden, "cgroup": cgroup}))
                self.assertIsNone(state.admit_caller({**hidden, "cgroup": cgroup}))
        for one in ("flatpak", "same_root", "same_mnt"):
            partly = {**self.facts(exe="/usr/bin/gnome-control-center"), one: None}
            self.assertEqual(state.sandbox_reason(partly), "unreadable process", one)

    def test_fixture_trust_only_for_a_service_run_from_source(self):
        environment = {"LUMA_SHELL_STATE_TRUSTED": "/src/tests/client.py:relative"}
        self.assertEqual(state.fixture_trust("/usr/libexec/luma-shell-state-service", environment), ())
        self.assertEqual(state.fixture_trust("/srv/tree/src/luma-shell-state/luma-shell-state-service", environment),
                         ("/src/tests/client.py",))
        self.assertEqual(state.fixture_trust("/srv/tree/x", {}), ())

    def test_untrusted_readers_get_no_personal_state(self):
        full = {"schema_version": 2, "renderer": "gnome", "appearance": "prefer-dark",
                "presentation": {"effective": "desktop"}, "posture": {"effective": "desktop"},
                "favorites": ["a.desktop"], "home_apps": ["a.desktop"], "wallpaper": {"uri": "file:///home/a/x.png"},
                "power": {"idle_delay_seconds": 300}, "input": {"method": "x"}, "home_layouts": {"m": {}},
                "shelf": {}, "mobile": {}}
        self.assertEqual(state.public_snapshot(full), {key: full[key] for key in
                         ("schema_version", "renderer", "appearance", "presentation", "posture")})

    def test_fixture_trust_comes_only_from_the_service_environment(self):
        fixture = self.facts(exe="/usr/bin/python3.14", argv=["python3", "/src/tests/client.py"])
        self.assertIsNone(state.admit_caller(fixture))
        self.assertEqual(state.admit_caller(fixture, extra=("/src/tests/client.py",)), "")
        self.assertIsNone(state.admit_caller(fixture, extra=("relative/client.py",)))

    def test_caller_facts_read_this_process(self):
        import os
        facts = state.caller_facts(os.getpid())
        if not pathlib.Path("/proc/self/ns/mnt").exists():
            self.skipTest("no procfs")
        self.assertTrue(facts["same_mnt"])
        self.assertTrue(facts["same_root"])
        self.assertFalse(facts["flatpak"])
        self.assertEqual(state.sandbox_reason(facts), "")
        self.assertTrue(facts["exe"].startswith("/"))


class ProcessHandleTests(unittest.TestCase):
    class Fds:
        def __init__(self, descriptors, broken=False):
            self.descriptors, self.broken = descriptors, broken

        def get_length(self):
            return len(self.descriptors)

        def get(self, index):
            if self.broken:
                raise RuntimeError("invalid descriptor")
            return self.descriptors[index]

    def test_a_bus_without_process_descriptors_falls_back_to_the_pid(self):
        self.assertEqual(state.delivered_pidfd({"ProcessID": 42}, None), -1)
        self.assertEqual(state.delivered_pidfd({"ProcessID": 42}, self.Fds([])), -1)

    def test_a_named_but_undelivered_descriptor_is_refused(self):
        for values, fds in (({"ProcessFD": 0}, None),
                            ({"ProcessFD": 0}, self.Fds([])),
                            ({"ProcessFD": 3}, self.Fds([7])),
                            ({"ProcessFD": -1}, self.Fds([7])),
                            ({"ProcessFD": "0"}, self.Fds([7])),
                            ({"ProcessFD": True}, self.Fds([7])),
                            ({"ProcessFD": 0}, self.Fds([7], broken=True)),
                            ({"ProcessFD": 0}, self.Fds([-1]))):
            with self.subTest(values=values), self.assertRaises(PermissionError):
                state.delivered_pidfd(values, fds)

    def test_a_delivered_descriptor_is_used(self):
        self.assertEqual(state.delivered_pidfd({"ProcessFD": 1}, self.Fds([5, 9])), 9)

    def test_start_time_holds_the_pid_without_a_descriptor(self):
        with tempfile.TemporaryDirectory() as folder:
            proc = pathlib.Path(folder)
            (proc / "42").mkdir()
            fields = " ".join(str(n) for n in range(3, 53))
            (proc / "42/stat").write_text(f"42 (odd) name) {fields}\n")
            self.assertEqual(state.process_start(42, proc), "22")
            self.assertIsNone(state.process_start(43, proc))


if __name__ == "__main__":
    unittest.main()
