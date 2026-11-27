---
title: Install the SDK
summary: The packages that make up the Suno Developer Platform, what each contains, and how to install the Flatpak runtime and SDK from the Suno remote.
order: 1
section: Getting started
---

# Install the SDK

The Suno Developer Platform is three packages on Suno and one Flatpak SDK on
the Suno remote. This page says exactly what each one contains so you know what
you are building against.

> **Status.** The platform is version **0.1.0, preview**. The packages below
> are what Suno’s own apps build and run against. The Flatpak SDK,
> `org.projectSuno.Sdk//44`, is the way to build outside Suno and the way to
> build for Depot.

## What is already on every Suno system

Every Suno image, desktop and mobile, includes the **`Suno-developer-platform`**
package. You do not install it; it is part of the operating system. It
contains:

| Path | What it is |
| --- | --- |
| `libSuno-ui-1.so.0`, `SunoUI-1.typelib` | SunoUI’s C library, for C and C++ and for any language with GObject introspection |
| `libSuno-semantics-1.so.0`, `SunoSemantics-1.typelib` | Semantic objects, actions and Live Extension data |
| `libSuno-appearance-1.so.0`, `SunoAppearance-1.typelib` | The shared surface policy SunoUI uses to follow light, dark, Frost, Glass and high contrast |
| `Suno_appkit` (Python package) | SunoUI for Python: `AppWindow`, `Island`, commands, menus, navigation, controls and the SunoUI parts |
| `/usr/share/Suno-appkit/` | SunoUI’s stylesheets, token sheets and fonts |
| `/usr/share/icons/hicolor/scalable/actions/Suno-*.svg`, `SunoUI-*.svg` | SunoUI’s own symbolic icons |
| `Suno-semantic-broker` (user service) | The Semantic Broker that mediates agent and automation access to apps |

Because the platform is in the image, a Python app that imports `Suno_appkit`
runs on Suno with nothing else installed.

## Development packages

| Package | Contains | You need it to |
| --- | --- | --- |
| **`Suno-developer-platform-devel`** | Headers in `/usr/include/Suno-1/`, `pkg-config` files `Suno-ui-1`, `Suno-semantics-1` and `Suno-appearance-1`, GIR files, and the JSON schemas and project template in `/usr/share/Suno-platform/` | Compile C or C++ against `SunoUI-1` |
| **`Suno-developer-platform-sdk`** | The `Suno` command (also installed as `Suno-sdk`), the Python project template, and the Semantic Inspector | Create projects and run `Suno lint`, `Suno inspect`, `Suno test` and `Suno release-check` |

The SDK package requires Python 3.11 or newer and PyYAML. The devel package
requires `glib2-devel`, `gtk4-devel` and `libadwaita-devel`.

> **Where to get them.** Suno’s desktop image includes the SDK package, so the
> `Suno` command is already there. The devel package is not in the image, and
> Suno does not publish its packages in a public package repository. The
> `Suno` command is not on PyPI either. Outside Suno, and for C or C++ on Suno,
> use the Flatpak SDK below: it carries both packages.

Check what you have on Suno:

```sh
rpm -q Suno-developer-platform Suno-developer-platform-sdk
Suno --version            # Suno-sdk 0.1.0
python3 -c "import Suno_appkit; print(Suno_appkit.__file__)"
```

## The Flatpak runtime and SDK

Depot hosts apps as Flatpaks on the signed Suno remote, built on Suno’s own
runtime:

| Ref | Purpose |
| --- | --- |
| `org.projectSuno.Platform//44` | The runtime your app runs on. Built from Fedora 44’s Flatpak runtime packages, plus SunoUI (`Suno-developer-platform`), the Figtree, Caveat and IBM Plex fonts and the Prairie icon theme. |
| `org.projectSuno.Sdk//44` | The matching SDK you build with: compilers, Meson, headers, `pkg-config` files, `Suno-developer-platform-devel` and `Suno-developer-platform-sdk`, which includes the `Suno` command. |
| `org.projectSuno.Platform.Office//44` | An extension carrying LibreOfficeKit 26.2, for document apps that declare it. |

Because the runtime carries SunoUI, a Suno app looks and behaves the same on
Suno and inside the sandbox on another distribution. The remote serves
`x86_64` only for now; there are no ARM builds yet. To set it up:

```sh
flatpak remote-add --if-not-exists Suno https://dl.simplyluma.com/luma.flatpakrepo
flatpak install Suno org.projectSuno.Platform//44 org.projectSuno.Sdk//44
```

`flatpak-builder --install-deps-from=Suno` also installs them for you the first
time you build a manifest that names them.

## Tools you will also want

These are standard Linux tools, not Suno packages:

- `flatpak` and `flatpak-builder` to build and run your app in a sandbox.
- `flatpak-builder-lint`, which Suno runs on the apps it builds for the Suno
  remote. It ships inside the `org.flatpak.Builder` Flatpak.
- `appstreamcli` (package `appstream`) to validate metainfo.
- `desktop-file-validate` (package `desktop-file-utils`).
- `meson` and `ninja` for C and C++ projects.
- Accerciser or another AT-SPI inspector to check accessibility.

## Next

- [Your first app in Python](first-app-python.md)
- [Your first app in C](first-app-c.md)
- [The `Suno` command](../kit/sdk-command-line.md)
