---
title: Runtimes, distributions and architectures
summary: Where a Suno app runs, how it gets there, the Suno runtime and remote, what differs on other distributions, and which CPU architectures the remote carries today.
order: 2
section: Platform
---

# Runtimes, distributions and architectures

## Where your app runs

| Where | How it installs | What it runs with | Looks like |
| --- | --- | --- | --- |
| **Suno** | From Depot, as a Flatpak from the Suno remote | The `org.projectSuno.Platform//44` runtime, which carries SunoUI | Suno |
| **Other distributions with Flatpak** (Fedora Workstation, Ubuntu, Debian, Arch, openSUSE and others) | `flatpak install` from the Suno remote, a `.flatpakref`, or a software center that opens one | The same Suno runtime inside the sandbox | Suno |

SunoUI draws a Suno app’s window and components itself, so the same Flatpak
looks and behaves the same on Suno and on another distribution. Suno-specific
system features are only present on Suno: the Semantic Broker and Live
Extensions, for example. Your app must keep working without them.

SunoUI is not packaged for other distributions, so a SunoUI app cannot be
shipped there as a native RPM or DEB. Use the Flatpak.

> **Status.** The signed Suno remote is live. It carries the Suno runtimes on
> branch `44` and Suno’s own apps, for `x86_64` only. Third-party apps reach it
> through Depot publishing, which is not open yet.

## The Suno remote

| | |
| --- | --- |
| Repository | `https://dl.simplyluma.com/repo/` (OSTree, signed summary and commits) |
| Remote file | `https://dl.simplyluma.com/luma.flatpakrepo` |
| Per-app install file | `https://dl.simplyluma.com/apps/<app-id>.beta.flatpakref` for an app on the `beta` branch, `https://dl.simplyluma.com/apps/<app-id>.flatpakref` for one on `stable` |
| Branches | `stable` (the remote’s default) and `beta`. Most of Suno’s apps are on `beta` today. |
| Architectures | `x86_64` only for now |
| Signing | A dedicated Suno Depot OpenPGP key. The public key is in the `.flatpakrepo` file. |

On a system with Flatpak:

```sh
flatpak remote-add --if-not-exists Suno https://dl.simplyluma.com/luma.flatpakrepo
flatpak install Suno org.projectSuno.Tide//beta
# or, for one app:
flatpak install --from https://dl.simplyluma.com/apps/org.projectluma.Tide.beta.flatpakref
```

To build against the Suno runtime, install the runtime and the SDK:

```sh
flatpak install Suno org.projectSuno.Platform//44 org.projectSuno.Sdk//44
```

## Runtimes

| Ref | What it is |
| --- | --- |
| `org.projectSuno.Platform//44` | The runtime. Built from Fedora 44’s Flatpak runtime package set, with Suno’s builds of GTK 4 and libadwaita, SunoUI (`Suno-developer-platform`), the Figtree font and the Prairie icon theme. |
| `org.projectSuno.Sdk//44` | The SDK for `flatpak-builder`. It adds the SunoUI headers and `pkg-config` files and the `Suno` command. |
| `org.projectSuno.Platform.Locale`, `org.projectSuno.Platform.GL.default` | The runtime’s translations and default graphics drivers. Flatpak installs them with the runtime. |
| `org.projectSuno.Platform.Office` | Extension with LibreOfficeKit 26.2 for document apps. |

The branch, `44`, matches the Fedora release the runtime is built from.

### The GNOME runtime in the SDK template

`Suno new` still writes a Flatpak manifest on `org.gnome.Platform//50` that
builds `Suno-developer-platform` as its first module from a source tag. That
source repository is not publicly reachable, so the generated manifest does not
build as it is, and the GNOME runtime does not carry Figtree or the Prairie
icons. Switch `runtime`, `sdk` and `runtime-version` to the Suno runtime and
remove that module; see
[project layout](../getting-started/project-layout.md#flatpak-manifest).

## Presentations on Suno

One binary serves every Suno device. SunoUI tells your app how it is being
presented through `SunoContext` (C) and `AppContext` (Python), read from the
environment:

| Variable | Values | Default |
| --- | --- | --- |
| `SUNO_DEVICE_CLASS` | `desktop`, `tablet`, `handheld` | Read from `/etc/Suno-device-class`, else `desktop` |
| `SUNO_PRESENTATION_MODE` | `windowed`, `fullscreen-mobile` | `fullscreen-mobile` on a handheld, else `windowed` |
| `SUNO_INPUT_MODE` | `pointer`, `touch` | `touch` on a handheld, else `pointer` |

Set these yourself to test a phone presentation on a desktop:

```sh
SUNO_PRESENTATION_MODE=fullscreen-mobile SUNO_INPUT_MODE=touch python3 src/main.py
```

Inside a Flatpak, `/etc` is the runtime’s, not the host’s, so the app cannot
read the host’s `/etc/Suno-device-class`. Use the environment variables there.

> **Known difference.** The Python `AppContext` treats a `tablet` device class as
> touch input; the C `SunoContext` only switches to touch for `handheld`. Set
> `SUNO_INPUT_MODE` explicitly if you depend on it. See
> [adaptive layouts](../kit/adaptive-layouts.md).

## Architectures

| Architecture | Status |
| --- | --- |
| `x86_64` | Supported. The Suno remote carries `x86_64` runtimes and apps. |
| `aarch64` | Not on the Suno remote yet. |

`Suno release-check` asks for passing evidence on both `x86_64` and `aarch64`
before an app is a Native candidate (see
[`Suno-app.toml`](../getting-started/Suno-app-toml.md#evidence-file)), so avoid
code that assumes one architecture. Suno isn’t built for `aarch64` yet, so no
app can pass that check today.

## What changes between Suno and elsewhere

| Feature | On Suno | Elsewhere, on the Suno runtime |
| --- | --- | --- |
| Suno window, islands, identity | Yes | Yes |
| Figtree and Prairie icons | Yes | Yes, from the runtime |
| Portals | Suno’s portal configuration, including Suno’s Open With and screen sharing choosers | The host’s portal backends (GNOME, KDE and others) |
| Light, dark, high contrast | Follows Suno settings, including the Frost and Glass materials | Follows the host’s light or dark preference (the `org.freedesktop.appearance` color scheme); Frost and Glass are Suno settings and are not used |
| Semantic Broker, Live Extensions | Available | Absent; your app must not require them |
| Presentation context | Read from the environment and the device | Defaults to desktop, windowed, pointer |
