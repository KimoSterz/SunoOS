project('charlie-Suno', version: '0.2.14', meson_version: '>= 1.3.0')

python = import('python').find_installation('python3')

python.install_sources(
  'charlie_Suno/__init__.py',
  'charlie_Suno/__main__.py',
  'charlie_Suno/accounts.py',
  'charlie_Suno/account_ui.py',
  'charlie_Suno/application.py',
  'charlie_Suno/avatar.py',
  'charlie_Suno/background.py',
  'charlie_Suno/engine.py',
  'charlie_Suno/fixtures.py',
  'charlie_Suno/fixture_v71.py',
  'charlie_Suno/html_reader.py',
  'charlie_Suno/mail_agent.py',
  'charlie_Suno/host_mail_wire.py',
  'charlie_Suno/host_mail.py',
  'charlie_Suno/host_mail_owner.py',
  'charlie_Suno/account_lifecycle.py',
  'charlie_Suno/host_mail_client.py',
  'charlie_Suno/mime.py',
  'charlie_Suno/model.py',
  'charlie_Suno/oauth.py',
  'charlie_Suno/secrets.py',
  'charlie_Suno/search_provider.py',
  'charlie_Suno/store.py',
  'charlie_Suno/time_display.py',
  'charlie_Suno/window.py',
  subdir: 'charlie_Suno',
)

configure_file(
  input: 'data/org.projectSuno.Charlie.in',
  output: 'org.projectSuno.Charlie',
  copy: true,
  install: true,
  install_dir: get_option('bindir'),
  install_mode: 'rwxr-xr-x',
)

install_data('data/org.projectSuno.Charlie.desktop', install_dir: get_option('datadir') / 'applications')
install_data('data/org.projectSuno.Charlie.metainfo.xml', install_dir: get_option('datadir') / 'metainfo')
install_data('data/org.projectSuno.Charlie.service', install_dir: get_option('datadir') / 'dbus-1/services')
if get_option('prefix') != '/app'
  install_data('data/org.projectSuno.MailHost1.service', install_dir: get_option('datadir') / 'dbus-1/services')
endif
install_data('data/background/org.projectSuno.Charlie.toml', install_dir: get_option('datadir') / 'Suno/background')
install_data('data/org.projectSuno.Charlie.Agent.desktop', install_dir: get_option('sysconfdir') / 'xdg/autostart')
install_data('data/org.projectSuno.Charlie.search-provider.ini', install_dir: get_option('datadir') / 'gnome-shell/search-providers')
install_data('data/charlie.css', install_dir: get_option('datadir') / 'charlie')

# One source owns every exported size. PNGs are rendered during the normal
# build, avoiding an older raster provider winning over the canonical SVG.
icon_svg = files('data/icons/hicolor/scalable/apps/org.projectSuno.Charlie.svg')
rsvg_converter = find_program('rsvg-convert')
foreach size : ['16x16', '24x24', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512']
  subdir('data/icons/hicolor' / size / 'apps')
endforeach
install_data(icon_svg, install_dir: get_option('datadir') / 'icons/hicolor/scalable/apps')
