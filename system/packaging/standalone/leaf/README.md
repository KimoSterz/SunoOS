# Standalone Leaf for Linux

Leaf's x86_64 Flatpak packages the application from `src/Suno-leaf` in
[SimplyLuma/luma](https://gitlab.com/simplyluma/luma). It includes the selected
SunoUI, AppKit, GTK and Python dependencies and uses GNOME Platform 50 for its
WebKit EPUB renderer. It does not require the Suno desktop or Suno Platform.

## Install

```sh
flatpak install --user ./Leaf-0.1.0-x86_64.flatpak
flatpak run org.projectSuno.Leaf//standalone
```

The shared GNOME runtime downloads from Flathub when needed. A release bundle
does not configure an application update remote; install a later bundle to
update Leaf. The application exports its desktop entry and EPUB association.

Leaf can read `~/Books` and imports selected EPUBs through the desktop file
portal. Other folders can be selected in the application. Library records,
bookmarks, highlights and reading progress are saved in the application's own
Flatpak data directory. This standalone release does not provide Suno Connect
reading sync.

OPDS and Calibre libraries use network access. Their saved passwords use the
desktop Secret Service keyring. Catalogue links and redirects to other origins
never receive the library's credentials; HTTPS connections cannot downgrade.

Read aloud uses the computer's Speech Dispatcher service when it is running.
A bundled eSpeak NG basic voice supplies narration when no host service is
available. The fallback starts inside the application sandbox, uses a private
socket and stops after it becomes idle. It does not install a host service.
Installing Suno's Natural Voices manager is not required.

## Build

With the qualified Suno Platform and standalone GdkPixbuf/SVG inputs described
in `DEPENDENCIES.md`, a Speech Dispatcher Python client prefix, `readelf`, schema
compilation and Flatpak tools:

```sh
python3 scripts/standalone/build-leaf.py \
  --runtime-files PLATFORM_FILES --pixbuf-prefix LOADERS_OUTPUT/install/usr \
  --speechd-prefix SPEECHD_FILES/usr --voice-prefix VOICE_FILES/usr --output Leaf
bash scripts/standalone/build-leaf-flatpak.sh Leaf flatpak
```

Install GNOME Platform 50 in the selected Flatpak installation first. Publication
bundles are signed separately through the publisher's signing infrastructure.
The application and media player use separate standalone bus names so they can
coexist with native Leaf on Suno. WebKit's Flatpak subprocess sandbox uses the
Flatpak portal; the package does not disable it.
