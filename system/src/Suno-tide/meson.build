project('Suno-tide', version: '0.1.0', meson_version: '>= 1.3.0')

python = import('python').find_installation('python3')

python.install_sources(
  'Suno_tide/__init__.py',
  'Suno_tide/_navigation.py',
  'Suno_tide/__main__.py',
  'Suno_tide/application.py',
  'Suno_tide/identity.py',
  'Suno_tide/resources.py',
  'Suno_tide/preview.py',
  'Suno_tide/presentation.py',
  'Suno_tide/fixture.py',
  'Suno_tide/folders.py',
  'Suno_tide/fixture_application.py',
  'Suno_tide/live.py',
  'Suno_tide/recency.py',
  'Suno_tide/deferred.py',
  'Suno_tide/ui.py',
  'Suno_tide/ui_parts.py',
  'Suno_tide/ui_phone.py',
  'Suno_tide/ui_tv.py',
  'Suno_tide/credentials.py',
  'Suno_tide/credit_markup.py',
  'Suno_tide/indexer.py',
  'Suno_tide/metadata.py',
  'Suno_tide/model.py',
  'Suno_tide/mpris.py',
  'Suno_tide/automation.py',
  'Suno_tide/playback.py',
  'Suno_tide/preview_import.py',
  'Suno_tide/remote.py',
  'Suno_tide/retire_overrides.py',
  'Suno_tide/retire_overrides_main.py',
  'Suno_tide/startup.py',
  'Suno_tide/subsonic.py',
  subdir: 'Suno_tide',
)

install_data(
  'data/org.projectSuno.Tide.desktop',
  install_dir: get_option('datadir') / 'applications',
)
# The activation file names the installed binary, so it follows the prefix:
# /usr for the operating system's package, /app in a Flatpak.
configure_file(
  input: 'data/org.projectSuno.Tide.service.in',
  output: 'org.projectSuno.Tide.service',
  configuration: {'bindir': get_option('prefix') / get_option('bindir')},
  install: true,
  install_dir: get_option('datadir') / 'dbus-1' / 'services',
)
install_data(
  'data/org.projectSuno.Tide.metainfo.xml',
  install_dir: get_option('datadir') / 'metainfo',
)
install_data(
  'data/org.projectSuno.Tide.svg',
  # The wide TV tile, named by X-Suno-TV-Tile in the desktop entry.
  'data/org.projectSuno.Tide-tv.svg',
  install_dir: get_option('datadir') / 'icons/hicolor/scalable/apps',
)
install_data(
  'data/tide.css',
  install_dir: get_option('datadir') / 'Suno-tide',
)

configure_file(
  input: 'data/org.projectSuno.Tide.in',
  output: 'org.projectSuno.Tide',
  copy: true,
  install: true,
  install_dir: get_option('bindir'),
  install_mode: 'rwxr-xr-x',
)

# Retires a stale dev-preview launch override (see retire_overrides.py's
# docstring) before the session bus or GNOME Shell can read it.
install_data(
  'bin/Suno-tide-retire-preview-overrides',
  install_dir: get_option('bindir'),
  install_mode: 'rwxr-xr-x',
)
userunitdir = get_option('prefix') / 'lib' / 'systemd' / 'user'
install_data(
  'data/Suno-tide-retire-preview-overrides.service',
  install_dir: userunitdir,
)
install_symlink(
  'Suno-tide-retire-preview-overrides.service',
  pointing_to: '../Suno-tide-retire-preview-overrides.service',
  install_dir: userunitdir / 'graphical-session-pre.target.wants',
)
