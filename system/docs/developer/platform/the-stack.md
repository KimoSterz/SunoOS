---
title: The stack
summary: The toolkit, libraries, languages, portals, media and document engines a Suno app is built on, and which parts Suno owns.
order: 1
section: Platform
---

# The stack

Suno does not invent a new app runtime. It uses the standard Linux desktop
stack and adds SunoUI, its own toolkit layer, on top of GTK 4.

```text
  Your app
  ─────────────────────────────────────────────────────────────
  SunoUI: Suno_appkit (Python) and SunoUI-1 (C)  ·  SunoSemantics-1
  ─────────────────────────────────────────────────────────────
  GTK 4 (rendering, input, accessibility)
  ─────────────────────────────────────────────────────────────
  GLib and GIO  ·  Pango  ·  Figtree  ·  Prairie icons  ·  AT-SPI
  Portals  ·  PipeWire  ·  GStreamer  ·  LibreOfficeKit (Office)
  ─────────────────────────────────────────────────────────────
  Flatpak sandbox on the org.projectSuno.Platform//44 runtime
```

## Engine and toolkit

**GTK 4** is the engine. It renders, handles input and input methods, speaks to
Wayland and exposes accessibility. Suno does not fork GTK, and your app uses the
standard GTK 4 API. Suno’s own build of GTK 4, which is also the one in the Suno
runtime, carries a set of patches on top of the upstream release.

**SunoUI** is the toolkit your app is written against. It draws everything
people see in a Suno app: the window frame, the title row and identity, the
window controls, islands, and every component. It owns the design tokens, the
motion and the phone layouts. Your app states what it needs through semantic
APIs and SunoUI decides how it looks, so a change to the Suno design reaches
every Suno app without an app update.

libadwaita is not part of the Suno look, and a SunoUI app shows no Adwaita
styling. SunoUI still uses some of libadwaita’s non-visual helpers, such as
breakpoints and navigation pages, and some SunoUI types are built on libadwaita
classes, so you will see `Adw` names in the API.

Rules of thumb:

- Use SunoUI components for everything visible: windows, islands, commands,
  navigation, controls, dialogs, toasts and empty states.
- Build what SunoUI does not offer from plain GTK widgets and
  [color tokens](../design/color.md), inside your own islands.
- Do not ship a second theme, a `GTK_THEME` override, or CSS that restyles
  SunoUI parts.

### Apps not built with SunoUI

On Suno today, Suno’s builds of GTK 4 and libadwaita still add parts of the
Suno look to GTK apps that do not use SunoUI, such as the title row and the
identity. That styling is being moved into SunoUI, so it can change between Suno
releases. Do not design around it. If you want the Suno window, use SunoUI. See
[bringing an existing GTK app](../getting-started/existing-gtk-apps.md).

## The platform libraries

| Library | Language | Contents |
| --- | --- | --- |
| `Suno_appkit` | Python 3.11+ | SunoUI’s Python package: `AppWindow`, `Island`, split views, commands and menus, navigation, controls and every SunoUI part. [Reference](../kit/appkit-reference.md) |
| `SunoUI-1` (`libSuno-ui-1`) | C, introspectable | SunoUI’s C library: `SunoApplicationWindow`, `SunoIsland`, `SunoAdaptiveScaffold`, `SunoContext`, `Suno_init()` and the SunoUI parts. [Reference](../kit/SunoUI-reference.md), [SunoUI for C](../kit/SunoUI-c.md) |
| `SunoSemantics-1` (`libSuno-semantics-1`) | C, introspectable | Semantic objects, actions with risk levels, privacy classes, Live Extensions. [Semantics and actions](../kit/semantics-and-actions.md) |
| `SunoAppearance-1` (`libSuno-appearance-1`) | C, introspectable | The surface policy SunoUI uses internally to follow light, dark, Frost, Glass and high contrast. You rarely call it directly. |

The C libraries use the parallel-installable `-1` namespace. The platform is a
0.1.0 preview and is not ABI stable; incompatible changes come with a version
bump and a migration note in the [changelog](../CHANGELOG.md).

## Languages

| Language | Status | How | Example apps |
| --- | --- | --- | --- |
| **Python 3** | Supported, recommended for most apps | PyGObject plus `Suno_appkit`. Suno and the Suno runtime ship Python 3.14; SunoUI requires 3.11 or newer. | Reel, Proof, Tide |
| **C** | Supported | `SunoUI-1`: `pkg-config Suno-ui-1`, `#include <Suno-ui.h>` | SunoUI itself |
| **C++** | Supported | `SunoUI-1` directly, from C++20 | Grid, Stage, Session, Write |
| Other languages | Not supported yet | Only through GObject introspection of `SunoUI-1` (namespace `SunoUI`). There are no examples or tests. | None |

Choose Python unless you need a native engine. Python has the most complete
API, including the command registry and navigation history. The C library
carries the same SunoUI parts with the same look (see
[SunoUI for C](../kit/SunoUI-c.md)); in C, commands are `GAction` names.

## Portals

Apps reach the outside of their sandbox through
[XDG desktop portals](https://flatpak.github.io/xdg-desktop-portal/). Suno runs
`xdg-desktop-portal` with the GNOME and GTK backends, plus Suno’s own backends
for **Open With** (`org.freedesktop.impl.portal.AppChooser`), screen sharing
(`org.freedesktop.impl.portal.ScreenCast`) and background activity
(`org.freedesktop.impl.portal.Background`). GTK uses portals automatically for
`GtkFileDialog`, `GtkUriLauncher`, printing, notifications through
`GApplication`, and inhibiting suspend. Use portals first; see
[permissions and privacy](../permissions-and-privacy.md).

## Media: PipeWire and GStreamer

- **Audio and video capture, screencasting, routing:** PipeWire. Session talks
  to `libpipewire-0.3` directly for low-latency audio. Most apps should not;
  use GStreamer or the camera and screencast portals.
- **Playback, decoding, editing:** GStreamer 1.x. Reel builds timelines, preview
  and export on GStreamer Editing Services, which the Suno runtime includes;
  Tide plays music through GStreamer. `GtkMediaFile` and `GtkVideo` also use
  GStreamer.
- Publish playback to the system with MPRIS (`org.mpris.MediaPlayer2`) so the
  shell’s media controls work, as Tide does.
- The runtime is built from Fedora packages, so patent-encumbered codecs may be
  missing. Handle a missing decoder with a clear message.

## Documents: LibreOfficeKit

Write, Grid and Stage use **LibreOfficeKit 26.2** as their layout and
file-compatibility engine behind a Suno interface. On the Flatpak runtime it
comes as the `org.projectSuno.Platform.Office` extension. LibreOfficeKit is
process-global, so keep every call to it on one thread, as Write does.

## Type, icons and accessibility

- **Figtree** is the interface typeface on every Suno surface. Your app gets it
  through SunoUI and fontconfig; do not bundle another UI font. See
  [typography](../design/typography.md).
- **Prairie** is Suno’s icon theme, inheriting the Adwaita and hicolor icon
  themes. Symbolic icons are Lucide-style outlined glyphs recolored by GTK. See
  [icons](../design/icons.md).
- **AT-SPI** carries accessibility. Every SunoUI component sets GTK accessible
  names and roles; your custom widgets must too. See
  [accessibility](../design/accessibility.md).

## The operating system underneath

Suno is image-based. The system image updates atomically and can roll back, and
apps do not install into it. That is why Depot apps are Flatpaks, and why your
app should never expect to write outside its own data directories or depend on
host-only files from inside its sandbox. See
[runtimes and distributions](runtimes-and-distributions.md).
