project('Suno-displays', version: '0.1.0', meson_version: '>= 1.3.0')

python = import('python').find_installation('python3')

python.install_sources(
  'Suno_displays/__init__.py',
  'Suno_displays/__main__.py',
  'Suno_displays/application.py',
  'Suno_displays/canvas.py',
  'Suno_displays/displayconfig.py',
  'Suno_displays/model.py',
  'Suno_displays/names.py',
  'Suno_displays/settings.py',
  subdir: 'Suno_displays',
)

install_data('data/org.projectSuno.Displays.desktop', install_dir: get_option('datadir') / 'applications')
install_data('data/org.projectSuno.Displays.service', install_dir: get_option('datadir') / 'dbus-1' / 'services')
install_data('data/org.projectSuno.Displays.metainfo.xml', install_dir: get_option('datadir') / 'metainfo')
install_data('data/org.projectSuno.Displays.svg', install_dir: get_option('datadir') / 'icons/hicolor/scalable/apps')

configure_file(
  input: 'data/org.projectSuno.Displays.in',
  output: 'org.projectSuno.Displays',
  copy: true,
  install: true,
  install_dir: get_option('bindir'),
  install_mode: 'rwxr-xr-x',
)
