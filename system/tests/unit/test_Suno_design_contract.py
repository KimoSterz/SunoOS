# SPDX-License-Identifier: Apache-2.0

import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class SunoDesignContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tokens = json.loads(
            (ROOT / "config/shared/design-tokens.json").read_text(encoding="utf-8")
        )["light"]
        cls.gtk3_light = (ROOT / "src/Suno-shell-state/gtk.css").read_text(
            encoding="utf-8"
        )
        cls.gtk3_dark = (ROOT / "src/Suno-shell-state/gtk-dark.css").read_text(
            encoding="utf-8"
        )
        cls.phosh_css = (
            ROOT / "src/Suno-shell-state/Suno-common.css"
        ).read_text(encoding="utf-8")
        cls.app_css = (ROOT / "src/prairie-core/style/prairie.css").read_text(encoding="utf-8")
        cls.appkit_css = (
            ROOT / "src/Suno-platform/appkit/Suno-appkit.css"
        ).read_text(encoding="utf-8")
        cls.appkit_widgets = (
            ROOT / "src/Suno-platform/appkit/Suno_appkit/widgets.py"
        ).read_text(encoding="utf-8")
        cls.appkit_base_css = (
            ROOT / "src/Suno-platform/appkit/Suno-appkit-base.css"
        ).read_text(encoding="utf-8")
        cls.tokens_css_light = (
            ROOT / "src/Suno-platform/appkit/Suno-appkit-tokens.css"
        ).read_text(encoding="utf-8")
        cls.tokens_css_dark = (
            ROOT / "src/Suno-platform/appkit/Suno-appkit-dark-tokens.css"
        ).read_text(encoding="utf-8")
        cls.libadwaita_boundary = "\n".join(
            (ROOT / "patches/libadwaita" / name).read_text(encoding="utf-8")
            for name in (
                "0009-Suno-appkit-component-boundaries.patch",
                "0010-Suno-native-surface-integrity-and-global-chrome.patch",
            )
        )
        cls.gtk_boundary = (
            ROOT / "patches/gtk4/0003-Suno-native-headerbar-chrome.patch"
        ).read_text(encoding="utf-8")
        cls.libadwaita_command_row = "\n".join(
            (ROOT / "patches/libadwaita" / name).read_text(encoding="utf-8")
            for name in (
                "0015-Suno-application-identity-resolution.patch",
                "0016-Suno-generic-command-row.patch",
                "0017-Suno-native-surface-rhythm.patch",
                "0018-Suno-identity-title-duplicates.patch",
                "0019-Suno-dark-design-system.patch",
            )
        )
        cls.gtk_command_row = (
            ROOT / "patches/gtk4/0007-Suno-generic-application-frame.patch"
        ).read_text(encoding="utf-8")
        cls.gtk3_theme = (
            ROOT / "src/Suno-shell-state/Suno-common.css"
        ).read_text(encoding="utf-8")
        cls.filer_island_boundary = (
            ROOT / "patches/nautilus/0022-Suno-final-island-spacing-and-stroke.patch"
        ).read_text(encoding="utf-8")
        cls.calculator_island_boundary = (
            ROOT
            / "patches/gnome-calculator/0008-Suno-preserve-island-elevation-overflow.patch"
        ).read_text(encoding="utf-8")

    def test_gtk3_and_phosh_use_one_native_adaptive_theme(self):
        self.assertIn("gtk-contained.css", self.gtk3_light)
        self.assertIn("gtk-contained-dark.css", self.gtk3_dark)
        self.assertIn('@import url("Suno-common.css")', self.gtk3_light)
        self.assertIn('@import url("Suno-common.css")', self.gtk3_dark)
        self.assertIn("@theme_bg_color", self.phosh_css)
        self.assertIn("phosh-top-panel", self.phosh_css)
        self.assertIn("headerbar button.titlebutton", self.phosh_css)
        self.assertIn("min-height: 42px", self.phosh_css)

    def test_shared_apps_name_their_colours(self):
        # Prairie's sheet once carried the design's colours as literals. It now
        # names the kit's tokens, so a change of palette reaches it without
        # anyone editing it — and a literal here would be a fork of the palette.
        self.assertNotRegex(self.app_css, r"#[0-9a-fA-F]{3,8}\b")
        self.assertNotIn("rgba(", self.app_css)
        self.assertNotIn("@define-color", self.app_css)
        for token in ("@Suno_ink", "@Suno_muted", "@Suno_line", "@Suno_fill", "@Suno_accent"):
            self.assertIn(token, self.app_css, token)
    def test_contract_has_bounded_motion_durations(self):
        motion = json.loads(
            (ROOT / "config/shared/design-tokens.json").read_text(encoding="utf-8")
        )["motion"]
        self.assertLessEqual(motion["fast_ms"], motion["normal_ms"])
        self.assertLessEqual(motion["normal_ms"], motion["slow_ms"])
        self.assertLessEqual(motion["slow_ms"], 400)

    def test_appkit_leaves_the_frame_to_the_toolkit(self):
        # A Suno window is dressed by the patched libadwaita: it carries the
        # toolkit's contract classes and draws no corner of its own. The
        # decoration decision stays with the presentation mode.
        # The shared frame adapter attaches the toolkit classes for every
        # AppWindow; app-specific widgets never draw the frame themselves.
        frame_adapter = (ROOT / "src/Suno-platform/appkit/Suno_appkit/window_frame.py").read_text(
            encoding="utf-8"
        )
        self.assertIn('window.add_css_class("Suno-app-window")', frame_adapter)
        self.assertIn('title_bar.add_css_class("Suno-titlebar")', frame_adapter)
        self.assertIn("self.set_decorated(decorated)", self.appkit_widgets)
        self.assertIn("PresentationMode.WINDOWED", self.appkit_widgets)
        self.assertNotIn("Suno-no-native-surfaces", self.appkit_widgets)
        self.assertNotIn("class WindowControls", self.appkit_widgets)
        self.assertNotIn("Gtk.WindowControls", self.appkit_widgets)
        # Islands still own their rounded clip.
        self.assertIn("self.set_overflow(Gtk.Overflow.HIDDEN)", self.appkit_widgets)
    def test_frame_geometry_is_stated_once_in_the_toolkit(self):
        # The corner's numbers live in the libadwaita boundary and nowhere else.
        self.assertIn("min-width: 20px", self.libadwaita_boundary)
        self.assertIn("-gtk-icon-size: 11px", self.libadwaita_boundary)
        from test_Suno_appkit_conformance import _frame_rules
        self.assertEqual(_frame_rules(self.appkit_base_css), [])
        for frame_rule in ("windowcontrols", ".Suno-window-body {",
                           ".Suno-island,", ".Suno-identity-button", ".Suno-window-root"):
            self.assertNotIn(frame_rule, self.appkit_base_css, frame_rule)
        # Inside the island the kit still states its own measurements.
        self.assertIn("border: 1px solid @Suno_line_faint", self.appkit_css)
    def test_island_elevation_is_the_toolkits(self):
        # The island's ring and two-layer shadow come from libadwaita's shared
        # work-island patch; the kit must not carry a second copy.
        adw = (ROOT / "patches/libadwaita/0006-stylesheet-add-shared-Suno-work-islands.patch").read_text(
            encoding="utf-8"
        )
        self.assertIn(".Suno-island", adw)
        self.assertIn("border-radius: 10px", adw)
        self.assertNotIn("0 18px 36px -16px", self.appkit_base_css)
        self.assertNotIn("0 18px 36px -16px", self.appkit_css)

    def test_token_vocabulary_is_the_toolkits(self):
        # One name for the design's line, fill and selection, shared with the
        # toolkit; the older names stay defined as aliases.
        for name in ("Suno_line", "Suno_fill", "Suno_selected"):
            self.assertIn(f"@define-color {name} ", self.tokens_css_light)
            self.assertIn(f"@define-color {name} ", self.tokens_css_dark)
        for old_name in ("Suno_border", "Suno_passive", "Suno_pressed"):
            self.assertIn(f"@define-color {old_name} ", self.tokens_css_dark)
            self.assertNotIn(f"@{old_name}", self.appkit_base_css)
    def test_native_chrome_is_toolkit_owned_for_libadwaita_apps(self):
        self.assertIn("headerbar windowcontrols", self.libadwaita_boundary)
        self.assertIn("min-height: 42px", self.libadwaita_boundary)
        self.assertIn("0 20px 38px -15px RGB(0 0 0 / 78%)", self.libadwaita_boundary)

    def test_native_chrome_is_toolkit_owned_for_plain_gtk_apps(self):
        self.assertIn("min-height: 42px", self.gtk_boundary)
        self.assertIn('font-family: "Figtree", sans-serif', self.gtk_boundary)
        self.assertIn("min-width: 20px", self.gtk_boundary)
        self.assertIn("border-spacing: 0", self.gtk_boundary)
        self.assertIn("0 20px 38px -15px rgba(0, 0, 0, 0.78)", self.gtk_boundary)

    def test_generic_command_row_is_toolkit_owned_and_opt_out_safe(self):
        for boundary in (self.libadwaita_command_row, self.gtk_command_row):
            with self.subTest(boundary=boundary[:40]):
                # The real widgets are re-hosted, never cloned or recreated.
                self.assertIn("Suno-command-host", boundary)
                self.assertIn("Suno-no-command-row", boundary)
                self.assertIn("Suno-has-command-row", boundary)
                self.assertIn("gtk_box_remove", boundary)
                self.assertNotIn("gtk_button_new_from_icon_name", boundary)
                # Explicit Suno product windows keep their own composition.
                self.assertIn("Suno-app-window", boundary)
                self.assertIn("Suno-files-window", boundary)
                self.assertIn("Suno-calculator-window", boundary)
                # Canonical command-row geometry.
                self.assertIn("min-height: 42px", boundary)
                self.assertIn("margin: 0 9px 8px", boundary)
                self.assertIn("min-width: 30px", boundary)

    def test_generic_identity_resolves_through_desktop_metadata(self):
        for boundary in (self.libadwaita_command_row, self.gtk_command_row):
            with self.subTest(boundary=boundary[:40]):
                self.assertIn("g_desktop_app_info_new", boundary)
                self.assertIn("g_app_info_get_display_name", boundary)
                self.assertIn("gtk_window_get_default_icon_name", boundary)
                self.assertIn('"application-x-executable"', boundary)
                self.assertIn("GTK_OVERFLOW_HIDDEN", boundary)
                self.assertIn("border-radius: 6px", boundary)

    def test_native_surface_rhythm_is_shared_across_toolkits(self):
        self.assertIn("margin: 9px 9px 9px", self.libadwaita_command_row)
        self.assertIn("margin-top: 0", self.libadwaita_command_row)
        self.assertIn("margin-top: 9px", self.gtk_command_row)
        self.assertIn("margin: 9px 9px 9px;", self.gtk3_theme)
        self.assertIn("padding: 0 8px 0 12px;", self.gtk3_theme)
        # GTK 3 accepts weights only in steps of 100; 600 is its legal value.
        self.assertIn("font-weight: 600;", self.gtk3_theme)
        self.assertNotIn("font-weight: 650;", self.gtk3_theme)
        self.assertIn("@define-color view_bg_color #2a2e34", self.libadwaita_command_row)

    def test_downstream_apps_preserve_shared_island_elevation(self):
        self.assertEqual(
            self.filer_island_boundary.count("+            margin-top: 0;"),
            2,
        )
        self.assertIn(".Suno-sidebar-surface.Suno-island", self.filer_island_boundary)
        self.assertIn("+      overflow: visible;", self.calculator_island_boundary)

    def test_gtk3_and_libhandy_host_actions_on_the_command_row(self):
        gtk3 = (ROOT / "patches/gtk3/0003-Suno-generic-command-row.patch").read_text(
            encoding="utf-8"
        )
        handy = (ROOT / "patches/libhandy/0002-Suno-generic-command-row.patch").read_text(
            encoding="utf-8"
        )
        for patch in (gtk3, handy):
            with self.subTest(patch=patch[:40]):
                self.assertIn('"Suno-command-host"', patch)
                self.assertIn('"Suno-no-command-row"', patch)
                self.assertIn("Suno_enter_command_row", patch)
                self.assertIn("Suno_leave_command_row", patch)
                # hosted actions stay the application's widgets and follow show_all
                self.assertIn("gtk_widget_show_all (priv->Suno_command_bar)", patch)
        self.assertIn("headerbar .Suno-command-bar {", self.phosh_css)
        self.assertIn("min-height: 40px;\n  margin: 0 9px 8px;", self.phosh_css)
        self.assertIn("headerbar .Suno-command-group > button:first-child:dir(rtl)", self.phosh_css)
        self.assertNotIn("-gtk-icon-size", self.phosh_css.split("Generic Suno command row")[1])

    def test_title_slot_and_split_surfaces_are_toolkit_owned(self):
        patches = {
            "patches/libadwaita/0020-Suno-title-slot-and-sidebar-islands.patch": ("Suno_host_title", "Suno-split-surface"),
            "patches/gtk4/0008-Suno-title-slot-and-paned-islands.patch": ("Suno_host_title", "Suno-pane-island"),
            "patches/gtk3/0004-Suno-title-slot-and-paned-islands.patch": ("Suno_host_title", "Suno-split-paned"),
            "patches/libhandy/0003-Suno-title-slot-and-leaflet-islands.patch": ("Suno_host_title", "Suno-split-leaflet"),
        }
        for path, markers in patches.items():
            text = (ROOT / path).read_text(encoding="utf-8")
            for marker in markers + ("Suno-command-title",):
                with self.subTest(path=path, marker=marker):
                    self.assertIn(marker, text)
        self.assertIn("leaflet.Suno-split-leaflet > *:not(separator)", self.phosh_css)
        self.assertIn("paned.Suno-split-paned > separator", self.phosh_css)
        self.assertIn("headerbar:not(.Suno-command-host)", self.phosh_css)

    def test_one_name_and_one_gutter_per_window_across_legacy_toolkits(self):
        gtk3 = (ROOT / "patches/gtk3/0005-Suno-identity-title-and-window-gutter.patch").read_text(
            encoding="utf-8"
        )
        handy = (ROOT / "patches/libhandy/0004-Suno-identity-title-repeat.patch").read_text(
            encoding="utf-8"
        )
        for text in (gtk3, handy):
            self.assertIn("Suno_update_title_repeat", text)
            self.assertIn("Suno-repeats-identity", text)
            self.assertIn("g_get_application_name ()", text)
        self.assertIn("notify::border-width", gtk3)
        self.assertIn("Suno-no-native-surfaces", gtk3)
        # Sibling islands keep their elevation off the neighbouring pane in every theme.
        gtk4 = (ROOT / "patches/gtk4/0009-Suno-split-island-shadows.patch").read_text(encoding="utf-8")
        adw = (ROOT / "patches/libadwaita/0021-Suno-split-island-shadows.patch").read_text(encoding="utf-8")
        self.assertIn("0 10px 20px -14px rgba(25, 27, 31, 0.40)", gtk4)
        self.assertIn("0 10px 20px -14px RGB(25 27 31 / 40%)", adw)
        self.assertIn("0 10px 20px -14px alpha(#191b1f, 0.40)", self.phosh_css)
        self.assertNotIn("leaflet.Suno-split-leaflet > *:not(separator) {\n  border: 1px solid alpha(@theme_fg_color, 0.10);\n  border-radius: 10px;\n  background-color: @theme_base_color;\n  color: @theme_fg_color;\n  box-shadow: 0 2px 5px alpha(#191b1f, 0.16),\n              0 18px 36px -16px", self.phosh_css)

    def test_theme_ships_dark_variant_and_pane_headers_host_the_command_row(self):
        spec = (ROOT / "packaging/rpm/Suno-shell-state.spec").read_text(encoding="utf-8")
        self.assertIn("themes/Suno/gtk-3.0/gtk-dark.css", spec)
        self.assertIn("themes/Suno-dark/gtk-3.0/gtk-dark.css", spec)
        adw = (ROOT / "patches/libadwaita/0022-Suno-sidebar-pane-command-host.patch").read_text(encoding="utf-8")
        self.assertIn("Suno_view_is_sidebar_pane_of_work_surface", adw)
        self.assertIn("Suno-pane-command-host", adw)
        self.assertIn('"sidebar-pane"', adw)

    def test_one_title_row_per_window_for_pane_header_layouts(self):
        adw = (ROOT / "patches/libadwaita/0023-Suno-one-title-row-per-window.patch").read_text(encoding="utf-8")
        handy = (ROOT / "patches/libhandy/0005-Suno-one-title-row-per-window.patch").read_text(encoding="utf-8")
        for text in (adw, handy):
            self.assertIn("Suno_update_pane_role", text)
            self.assertIn("Suno-window-title-row", text)
            self.assertIn("Suno-pane-toolbar", text)
            self.assertIn("Suno-pane-header", text)
        self.assertIn("adw_header_bar_Suno_release_identity", adw)
        self.assertIn("Suno_split_views_collapsed", adw)
        self.assertIn("hdy_leaflet_get_folded", handy)
        self.assertIn("headerbar.Suno-pane-toolbar", self.phosh_css)
        self.assertIn("headerbar.Suno-window-title-row", self.phosh_css)


if __name__ == "__main__":
    unittest.main()
