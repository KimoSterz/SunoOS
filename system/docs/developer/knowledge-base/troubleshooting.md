---
title: Troubleshooting
summary: Fixes for common problems, from typelib and import errors to unstyled windows, missing identity menus, broken shortcuts, portal failures, dark mode, Suno lint errors and Flatpak builds.
order: 2
section: Knowledge base
---

# Troubleshooting

Each entry gives the symptom, the usual cause and the fix.

## Running your app

### `ImportError: Typelib file for namespace 'SunoUI', version '1' not found`

**Cause:** the platform package is not installed, or GObject introspection
cannot find its typelibs.

**Fix:** on Suno the platform is preinstalled; check with
`rpm -q Suno-developer-platform`. When running against a SunoUI you built yourself,
set `GI_TYPELIB_PATH` to the directory containing `SunoUI-1.typelib` and
`LD_LIBRARY_PATH` to the directory with `libSuno-ui-1.so.0`.

### `ImportError: Typelib file for namespace 'cairo', version '1.0' not found`

**Cause:** GObject introspection’s base typelibs are missing, which happens in
minimal containers.

**Fix:** install `gobject-introspection` (Fedora) alongside `python3-gobject`.

### `ModuleNotFoundError: No module named 'Suno_appkit'`

**Cause:** Python is not finding SunoUI’s Python package, often because you run
a different Python than the system one, or inside a virtual environment that
hides system packages. The package is not on PyPI, so `pip install` cannot
supply it.

**Fix:** use `/usr/bin/python3`, or create the virtual environment with
`--system-site-packages`. PyGObject and SunoUI are system packages.

### An old version of SunoUI is imported

**Cause:** a copy of `Suno_appkit` in `~/.local/lib/python3.*/site-packages`
shadows the installed package.

**Fix:** run `python3 -c "import Suno_appkit; print(Suno_appkit.__file__)"`. It
should print a path under `/usr/lib`. Remove the stray copy, and never vendor
SunoUI into your project.

### My window has no Suno styling

**Cause:** `install_appkit()` was not called, or it was called before GTK had a
display.

**Fix:** call `install_appkit()` at the top of `do_activate` (or use
`add_style_sheet()`, which calls it). In C, call `Suno_init()` after
`g_application_run()` has started, for example in your `activate` handler.

### The window has a plain title bar, not the Suno title row

**Cause:** the window is not SunoUI’s window, or SunoUI was never loaded. SunoUI
draws the frame, title row, identity and controls only on an `AppWindow` or
`SunoApplicationWindow`, after `install_appkit()` or `Suno_init()` has run.

**Fix:** create the window with `AppWindow` (Python) or
`Suno_application_window_new()` (C), and load SunoUI as described above. Inside
Flatpak, build on the `org.projectSuno.Platform` runtime so SunoUI is present.
See [why my app looks different outside Suno](faq.md#why-does-my-app-look-different-outside-Suno).

### The corner shows the wrong name or a generic icon

**Cause:** the identity comes from your desktop entry, found by your application
ID. The desktop entry is not installed, is named differently, or its `Icon=` does
not resolve.

**Fix:** make sure `Adw.Application(application_id=...)` equals your app ID, the
desktop entry is installed as `<app-id>.desktop`, and the icon is installed as
`<app-id>.svg` under `hicolor/scalable/apps`. When running from source, install
the desktop entry and icon into `~/.local/share` to test. The `title` and
`icon_name` you pass to `AppWindow` are used only when no desktop entry is
found.

### The identity menu is empty or missing a command

**Cause:** in Python, the identity menu is built when the window is created,
from commands visible at that moment. In C, `Suno_application_window_set_menu_model()`
was not called.

**Fix:** keep app-wide commands always visible and use `enabled` for
availability. Pass the full registry to `AppWindow`.

### A keyboard shortcut does nothing

**Causes and fixes:**

- The command is hidden or disabled: `registry.invoke()` refuses it. Check its
  `visible` and `enabled` predicates.
- The shortcut is written with an unknown key name. Use Linux names:
  `("Ctrl", "Shift", "S")`. Check with `accelerator(("Ctrl", "Shift", "S"))`,
  which returns `<Control><Shift>s`.
- A focused widget consumes the key (text fields take most plain keys). Use a
  modifier.
- The shell uses the shortcut. Avoid **Super** combinations.

### A button pointing at a command does nothing

**Cause:** the action name keeps the dot. Command `note.new` is action
`app.note-new`, with a dash.

### My menu button works once, then shows nothing and logs GTK criticals

**Cause:** a `Menu` or `command_popover()` lets go of its parent after a command
runs, so a `Gtk.MenuButton` that holds one loses it.

**Fix:** give the menu button `Menu(registry, keep_parent=True)`, or open a new
`command_popover(registry).present_for(button)` from a plain button’s `clicked`
handler. See [commands and menus](../kit/commands-and-menus.md#menu-buttons).

### Island corners or shadows are cut off

**Cause:** islands are inside a plain `Adw.NavigationSplitView` or
`Adw.OverlaySplitView`, which clips its pages, or your content paints an opaque
square background over the island.

**Fix:** use `IslandSplitView` or `IslandOverlaySplitView` in Python, or
`SunoAdaptiveScaffold` in C. Do not set backgrounds on the island itself; use
`@Suno_content` or transparent backgrounds for children.

### Controls are stretched to the height of their bar

**Cause:** a `Gtk.Box` gives each child its full height.

**Fix:** use `Toolbar`, or call `centre_controls(bar)` (Python) or
`Suno_ui_centre_controls(bar)` (C) after filling the bar.

### Colors are wrong after switching to dark

See [my colors are wrong in dark mode](faq.md#my-colors-are-wrong-in-dark-mode).

### Animations still run with animations turned off

**Fix:** pass durations through `motion_duration()`, or check
`gtk-enable-animations` in C. See [motion](../design/motion.md#reduced-motion).

## Portals

### The file chooser never appears

**Causes and fixes:**

- No portal service is running. On Suno it always is. In a bare container or a
  minimal session, start `xdg-desktop-portal` and a backend such as
  `xdg-desktop-portal-gtk`.
- You created the dialog without a parent window. Pass your window to
  `Gtk.FileDialog.open()`.
- You called it during startup before a window was shown. Present the window
  first.

### A portal request fails with a permission error, or silently

**Cause:** the person denied the request earlier, and the portal remembers.

**Fix:** handle the error with a clear message and a way to try again. To clear
what the portals remember for your app while you test, run
`flatpak permission-reset <app-id>`.

### Notifications do not show

**Fix:** send them with `Gio.Application.send_notification()` from a registered
application with a valid ID and installed desktop entry. Inside Flatpak no extra
permission is needed.

## `Suno lint` errors

| Error | Fix |
| --- | --- |
| `application.id must be a reverse-DNS identifier` | Use at least three parts of letters, digits and underscores, starting with a letter |
| `application.id domain components must be lowercase` | Lowercase the first two parts: `com.example.App` |
| `application.id may not end in '.desktop'` | Choose a last part other than `desktop` |
| `Flatpak id must match application.id` | Set the manifest `id` (or `app-id`) to the same ID |
| `desktop file Exec command must match the Flatpak command` | Make the first word of `Exec=` equal the manifest `command` |
| `desktop file Icon must match application.id` | Set `Icon=<app-id>` |
| `application icon filename must use application.id` | Rename the icon to `<app-id>.svg` |
| `AppStream metadata must declare org.projectSuno.ApplicationContract=0.2` | Add the `<custom>` value shown in [project layout](../getting-started/project-layout.md#appstream-metainfo) |
| `Flatpak permission is too broad for a Suno Native candidate: --filesystem=...` | Use a portal instead; see [portals first](../permissions-and-privacy.md#portals-first) |
| `Flatpak D-Bus permission may not contain a wildcard` | Name each bus name exactly |
| `responsive.test_widths must include 360` | Add `360`, `500` and `1024` |
| `lifecycle.uninstall_choices must include 'keep-data'` | Add both `keep-data` and `remove-app-data` |
| `conformance.evidence does not exist` | Create the evidence file; `Suno new` generates one |
| `YAML Flatpak manifests require the SDK's PyYAML dependency` | Install `python3-pyyaml`, or use a JSON manifest |

## `Suno release-check` errors

| Error | Fix |
| --- | --- |
| `conformance evidence source_revision must be a 40-64 character lowercase hex revision` | Record the full commit your CI tested |
| `conformance evidence lane has not passed: ...` | Run that test lane and record its real result |
| `conformance.artifacts.sbom is required` | Generate an SBOM and point `artifacts.sbom` in the evidence file at it |
| `conformance.artifacts.test_report is required` | Point `artifacts.test_report` in the evidence file at your CI’s test report |
| `Flatpak git source '...' must pin an immutable commit` | Add `"commit": "<full sha>"` to the source |
| `Flatpak archive source '...' must declare sha256` | Add the archive’s `sha256` |

## Flatpak builds

### The build cannot find `org.projectSuno.Platform//44`

**Cause:** the Suno remote is not added, or you are building for an
architecture the remote does not carry yet (it serves `x86_64` only for now).

**Fix:** add the remote with
`flatpak remote-add --if-not-exists Suno https://dl.simplyluma.com/luma.flatpakrepo`
and pass `--install-deps-from=Suno` to `flatpak-builder`, or install the runtime
yourself with `flatpak install Suno org.projectSuno.Platform//44 org.projectSuno.Sdk//44`.

### The build works on my machine but not from a clean checkout

**Causes and fixes:**

- A source is not pinned, or downloads something during the build. Pin every
  source and vendor dependencies. `Suno release-check` reports unpinned
  sources.
- A file is ignored by Git but present on your machine. Build from a clean clone
  of the commit you tag.

### My app works natively but not in Flatpak

**Causes and fixes:**

- It reads or writes outside its sandbox. Use portals and
  `GLib.get_user_data_dir()`, `get_user_config_dir()` and `get_user_cache_dir()`.
- It spawns host programs. It cannot, by design; do the work in the app or use a
  portal.
- It depends on a host file such as `/etc/Suno-device-class`. Use the
  environment and SunoUI’s context instead.
