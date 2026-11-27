---
title: Documentation changelog
summary: Dated changes to the Suno developer documentation that affect what you build, and the platform release each one describes.
order: 99
section: Overview
---

# Documentation changelog

Changes to these docs that affect what you build, newest first. Platform API
changes name the platform version they apply to.

## November 25, 2026: editors that work on content in place

**Added**

- `ActionEditor(target=)` and C `Suno_action_editor_set_target()`: the
  widget an action bar editor works on in place, such as a photo being
  edited. A press or Esc on it is part of the edit and does not fold the
  editor (platform 0.1.0-1.Suno.157, C `SUNO_UI_API_LEVEL` 13,
  `SUNOUI_API_LEVEL` 16).

**Changed**

- Light dismiss no longer consumes the press that folds a grown action bar:
  the press reaches what is under it, so a drag that starts there works.

## November 23, 2026: windows and documents that come back

**Added**

- [SunoUI in C](kit/SunoUI-c.md#windows-and-documents-that-come-back):
  `SunoRestore` and `Suno_window_set_restore_key()` give an app its
  documents, views and unsaved text back when its windows are restored after
  a restart or continued on another device; Python `Suno_appkit.restore`
  with `AppWindow.restore_key`, `save_state()`, `restore_state()` and
  `documents()` (platform 0.1.0-1.Suno.153, C `SUNO_UI_API_LEVEL` 12,
  `SUNOUI_API_LEVEL` 15).

## November 21, 2026: windows hidden from screen capture

**Added**

- [SunoUI in C](kit/SunoUI-c.md#windows-hidden-from-screen-capture):
  `Suno_window_set_hidden_from_capture()` keeps a window out of screen
  shares and screenshots of the screen while it stays on screen; Python
  `AppWindow.set_hidden_from_capture()` (platform 0.1.0-1.Suno.152, C
  `SUNO_UI_API_LEVEL` 11, `SUNOUI_API_LEVEL` 14).

## November 19, 2026: windows that keep their shape

**Added**

- [SunoUI in C](kit/SunoUI-c.md#windows-that-keep-their-shape):
  `Suno_window_set_aspect_ratio()` keeps a game or video window at a fixed
  shape, live while it is resized (platform 0.1.0-1.Suno.132, C
  `SUNO_UI_API_LEVEL` 10).

## October 8, 2026: the alpha

Suno alpha was released on October 7, 2026. The docs describe Suno Developer
Platform **0.1.0 (preview)** as it ships in the alpha.

**Changed**

- Publishing: the developer program, app ID registration, release submission,
  tester lists and suggesting an app are not open yet, and the publishing pages
  now say so.
- [Runtimes and distributions](platform/runtimes-and-distributions.md): the
  Suno remote carries `org.projectSuno.Platform//44`, `org.projectSuno.Sdk//44`,
  their Locale and GL extensions, the `org.projectSuno.Platform.Office`
  extension and Suno’s own apps, most of them on `beta`, for `x86_64` only.
- The Flatpak manifest `Suno new` writes builds the platform from a source
  repository that is not publicly reachable. Switch it to the Suno runtime and
  remove that module, as
  [project layout](getting-started/project-layout.md#flatpak-manifest) shows.
- [The stack](platform/the-stack.md): on Suno, Suno’s builds of GTK 4 and
  libadwaita still add parts of the Suno look to GTK apps that do not use
  SunoUI. Do not depend on that styling.

**Known issues**

- The SDK’s project template does not use SunoUI’s `AppWindow` or the Suno
  runtime.
- The Python and C presentation contexts disagree about tablet input. Set
  `SUNO_INPUT_MODE` if you depend on it.

## September 29, 2026: SunoUI

**Changed**

- The toolkit is called **SunoUI** throughout. SunoUI is Suno’s own layer on
  GTK 4, not a fork of GTK, and it draws the whole visible Suno app: the frame,
  title row, identity, window controls, islands and every component.
- SunoUI’s Python package is still imported as `Suno_appkit`. Its reference is
  now titled [SunoUI Python reference](kit/appkit-reference.md) at the same
  address.
- [Bringing an existing GTK app](getting-started/existing-gtk-apps.md)
  describes moving onto SunoUI instead of opt-in style classes.
- The signed Suno remote is live, with `org.projectSuno.Platform//44`,
  `org.projectSuno.Sdk//44` and Suno’s apps on the `beta` branch, for `x86_64`
  only. Install commands and per-app `.flatpakref` addresses were updated.
- Languages: Python and C are supported, and C++ apps use `SunoUI-1` directly.
  Other languages work only through GObject introspection.
- Menus: `Menu(registry, keep_parent=True)` is the menu for a
  `Gtk.MenuButton`, and the identity menu shows check marks, descriptions and
  submenus.
- Typography points to SunoUI’s type roles. `SUNOUI_API_LEVEL` is 2.
- The dialog, motion and color guidance points to SunoUI parts and tokens
  instead of libadwaita widgets and colors.

## September 17, 2026: unread badges

Describes Suno Developer Platform **0.1.0 (preview)**.

**Added**

- Kit: [background agents](kit/background-agents.md#unread-badges): the
  standard `badge` value for an app’s unread badge on its dock icon, and
  `Agent.set_badge`, `BADGE_VALUE` and `BADGE_DOT` in `Suno_appkit.background`.

## September 15, 2026: waking for alarms

Describes `Suno-background` 0.1.0.

**Added**

- Kit: [background agents](kit/background-agents.md): autostart entries
  while the agent is managed (`X-Suno-Background-Agent`), and
  `org.projectSuno.BackgroundWake1` for waking a suspended computer for an
  alarm.

## September 15, 2026: background agents

Describes Suno Developer Platform **0.1.0 (preview)** and `Suno-background`
0.1.0.

**Added**

- Kit: [background agents](kit/background-agents.md), the contract for keeping
  an app working with its windows closed: the `[background]` table, categories
  and defaults, `Suno_appkit.background`, `SunoBackgroundAgent`, the
  `org.projectSuno.Background1` and `org.projectSuno.BackgroundAgent1` D-Bus
  interfaces, and how the Background portal reaches the same decisions.
- `Suno-app.toml`: the `[background]` table and its `Suno lint` rules.
- Permissions and privacy: background activity.

## September 15, 2026: first publication

First publication of the developer documentation, describing Suno Developer
Platform **0.1.0 (preview)** and Depot publishing.

**Added**

- Overview: building for Suno, Depot tiers and how publishing works.
- Getting started: installing the SDK, a first app in Python, a first app in C
  with `SunoUI-1`, project layout, the `Suno-app.toml` reference, and bringing
  an existing GTK app.
- Platform: the stack, and runtimes, distributions and architectures.
- Kit: overview, Python reference, `SunoUI-1` reference, windows and
  islands, commands and menus, semantics and actions, adaptive layouts, and the
  `Suno` command.
- Design guidelines: principles, windows and islands, typography, color, spacing
  and sizing, icons, motion, accessibility, and writing style.
- Permissions and privacy, including the Depot permission vocabulary.
- Publishing: the developer program, app IDs and namespaces, metainfo and
  screenshots, submitting a release, the Depot Review Guidelines, updates and
  permission changes, ratings and reviews, Open in Depot links, and suggesting a
  Listed app.
- Knowledge base: FAQ and troubleshooting.
