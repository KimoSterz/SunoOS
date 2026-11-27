# SPDX-License-Identifier: Apache-2.0
project('Suno-setup', version: '0.2.0', meson_version: '>= 1.3.0', license: 'Apache-2.0')

python = import('python').find_installation('python3')
prefix = get_option('prefix')
datadir = prefix / get_option('datadir')
libexecdir = prefix / get_option('libexecdir')
sysconfdir = get_option('sysconfdir')
userunitdir = prefix / 'lib' / 'systemd' / 'user'

python.install_sources(
  'Suno_setup/__init__.py',
  'Suno_setup/__main__.py',
  'Suno_setup/app.py',
  'Suno_setup/apply.py',
  'Suno_setup/catalog.py',
  'Suno_setup/connect.py',
  'Suno_setup/handover.py',
  'Suno_setup/model.py',
  'Suno_setup/session.py',
  'Suno_setup/sheet.py',
  'Suno_setup/sheet_tv.py',
  'Suno_setup/system.py',
  'Suno_setup/welcome.py',
  'Suno_setup/setup.css',
  subdir: 'Suno_setup',
)

install_data('bin/Suno-setup', 'bin/Suno-setup-apply', install_dir: get_option('libexecdir'),
             install_mode: 'rwxr-xr-x')

# GDM's initial-setup session: GDM looks for these names and runs Suno's setup in it.
# GDM's own gnome-initial-setup.desktop starts `gnome-session --session gnome-initial-setup`. GDM only
# runs initial setup when /usr/share/gnome-session/sessions/gnome-initial-setup.session exists (a fixed
# path in gdm), so the session lives there; only gnome-initial-setup also ships it, and the package
# conflicts with that.
install_data('data/session/gnome-initial-setup.session', install_dir: datadir / 'gnome-session' / 'sessions')
install_data('data/systemd/Suno-setup.conf',
             install_dir: userunitdir / 'gnome-session@gnome-initial-setup.target.d')
install_data('data/systemd/Suno-setup.service', 'data/systemd/Suno-setup-first-session.service',
             'data/systemd/Suno-setup-first-desktop.service', 'data/systemd/Suno-setup-cover.service',
             install_dir: userunitdir)

# The session's rights, and the root helper's.
install_data('data/polkit/org.projectSuno.setup.policy', install_dir: datadir / 'polkit-1' / 'actions')
install_data('data/polkit/20-Suno-setup.rules', install_dir: datadir / 'polkit-1' / 'rules.d')
install_data('data/sysusers.conf', rename: 'Suno-setup.conf', install_dir: prefix / 'lib' / 'sysusers.d')

# The session's settings: a dconf profile over Suno's defaults.
install_data('data/dconf/gnome-initial-setup', install_dir: sysconfdir / 'dconf' / 'profile')
dconf = find_program('dconf')
custom_target('dconf-defaults',
  output: 'dconf-defaults',
  input: 'data/dconf/defaults.d/00-Suno-setup',
  command: [dconf, 'compile', '@OUTPUT@', meson.current_source_dir() / 'data' / 'dconf' / 'defaults.d'],
  install: true,
  install_dir: datadir / 'Suno-setup')

install_data('data/geoclue/90-Suno-setup.conf', install_dir: sysconfdir / 'geoclue' / 'conf.d')
install_data('data/org.projectSuno.Setup.desktop', install_dir: datadir / 'applications')
