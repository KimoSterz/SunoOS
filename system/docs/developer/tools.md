---
title: Tools
summary: The Suno command, the Suno Platform runtime and SDK, the SunoUI reference, Imager and Depot publishing: what each is for, how to get it, and whether it's available yet.
order: 1
section: Tools
---

# Tools

These are the tools you can use to build, check and ship a Suno app. Each one
says whether it's available now.

## The `Suno` command

**Available now, on Suno and in the Suno SDK.**

Start a project and check it against the Suno app contract. It comes with
Suno’s desktop image and with the `org.projectSuno.Sdk//44` Flatpak SDK, so
there is nothing extra to install. It is not published on PyPI.

```sh
mkdir my-app && cd my-app
Suno new "My App" --id com.example.MyApp
Suno lint
Suno inspect
Suno test
Suno release-check
```

- `Suno new` fills an empty folder (the current one unless you pass
  `--destination`) from the Python template: `Suno-app.toml`, a starter
  `src/main.py`, a Flatpak manifest, AppStream metadata, a desktop file, an
  icon and a verification scaffold, all under one app ID. Replace the
  generated Flatpak manifest before you build; see
  [project layout](getting-started/project-layout.md#flatpak-manifest).
- `Suno lint` checks `Suno-app.toml` and the files it points to against the
  app contract.
- `Suno inspect` prints your app’s platform and conformance metadata as JSON,
  with its status and anything still missing.
- `Suno test` checks the static adaptive and semantic contracts and prints the
  width and input combinations to cover. It does not run your app.
- `Suno release-check` checks the evidence an app needs for Suno Native
  status. A new project fails it until that evidence exists, and that's
  expected.

Passing `Suno lint` means your project is structurally valid. Suno Native
status takes the evidence `Suno release-check` asks for; editing
`Suno-app.toml` never earns it. It is a status the SDK reports, not a Depot
tier.

Read the full guide: [The Suno command](kit/sdk-command-line.md).

## Suno Platform and SDK

**Available now, for PCs with Intel or AMD processors.**

The Flatpak runtime Suno’s own apps ship on, and the SDK to build against it.
They live on the signed Suno remote, so you can build on Suno or on any Linux
system with Flatpak.

```sh
flatpak remote-add --if-not-exists Suno https://dl.simplyluma.com/luma.flatpakrepo
flatpak install Suno org.projectSuno.Platform//44 org.projectSuno.Sdk//44
```

ARM builds are not available yet.

Read more: [Install the SDK](getting-started/install-the-sdk.md) and
[runtimes and distributions](platform/runtimes-and-distributions.md).

## SunoUI reference

**Available now, in these docs.**

Every SunoUI component: what it's for, when to use it, and its Python and C
names. SunoUI draws the window, the title row, the controls and every
component; your app says what it needs and SunoUI decides how it looks.

Open it: [SunoUI reference](kit/SunoUI-reference.md).

## Imager

**Available now, on Suno.**

Put Suno on a USB drive to test your app on real hardware. Imager writes the
drive, then reads it back to check it holds exactly what was written. It comes
with Suno; it isn't available for macOS, Windows or other Linux systems yet.

Imager is in Depot on Suno.

## Depot publishing

**Not open yet.**

Publishing your own app to Depot opens with the developer program. Applying,
managing your apps and suggesting an app for Depot open soon. Until then,
Depot carries Suno’s own apps and apps Suno lists from other sources.

Read how it will work: [Submitting a release](publishing/submitting-a-release.md).
