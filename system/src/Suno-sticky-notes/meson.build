project('Suno-sticky-notes', version: '0.1.0', meson_version: '>= 1.3.0')

python = import('python').find_installation('python3')

python.install_sources(
  'Suno_sticky_notes/__init__.py',
  'Suno_sticky_notes/__main__.py',
  'Suno_sticky_notes/application.py',
  'Suno_sticky_notes/dock.py',
  'Suno_sticky_notes/glyphs.py',
  'Suno_sticky_notes/note_window.py',
  'Suno_sticky_notes/shell_dock.py',
  'Suno_sticky_notes/store.py',
  subdir: 'Suno_sticky_notes',
)

install_data(
  'data/org.projectSuno.StickyNotes.desktop',
  install_dir: get_option('datadir') / 'applications',
)
# The activation file names the installed binary, so it follows the prefix:
# /usr for the operating system's package, /app in a Flatpak.
configure_file(
  input: 'data/org.projectSuno.StickyNotes.service.in',
  output: 'org.projectSuno.StickyNotes.service',
  configuration: {'bindir': get_option('prefix') / get_option('bindir')},
  install: true,
  install_dir: get_option('datadir') / 'dbus-1' / 'services',
)
install_data(
  'data/org.projectSuno.StickyNotes.metainfo.xml',
  install_dir: get_option('datadir') / 'metainfo',
)
install_data(
  'data/org.projectSuno.StickyNotes.svg',
  install_dir: get_option('datadir') / 'icons/hicolor/scalable/apps',
)
install_data(
  'data/sticky-notes.css',
  install_dir: get_option('datadir') / 'Suno-sticky-notes',
)

configure_file(
  input: 'data/org.projectSuno.StickyNotes.in',
  output: 'org.projectSuno.StickyNotes',
  copy: true,
  install: true,
  install_dir: get_option('bindir'),
  install_mode: 'rwxr-xr-x',
)
