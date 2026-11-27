# SPDX-License-Identifier: MPL-2.0
project('Suno-audio-devices', version: '0.1.0', meson_version: '>= 1.3.0', license: 'MPL-2.0')

python = import('python').find_installation('python3')
prefix = get_option('prefix')
datadir = prefix / get_option('datadir')

python.install_sources(
  'Suno_audio_devices/__init__.py',
  'Suno_audio_devices/airplay.py',
  'Suno_audio_devices/apps.py',
  'Suno_audio_devices/avahi.py',
  'Suno_audio_devices/battery.py',
  'Suno_audio_devices/captures.py',
  'Suno_audio_devices/classify.py',
  'Suno_audio_devices/cli.py',
  'Suno_audio_devices/graph.py',
  'Suno_audio_devices/levels.py',
  'Suno_audio_devices/migration.py',
  'Suno_audio_devices/mixer.py',
  'Suno_audio_devices/mpris.py',
  'Suno_audio_devices/pipewire.py',
  'Suno_audio_devices/raop.py',
  'Suno_audio_devices/routing.py',
  'Suno_audio_devices/secrets.py',
  'Suno_audio_devices/service.py',
  'Suno_audio_devices/state.py',
  subdir: 'Suno_audio_devices',
)

install_data('bin/Suno-audio-devices', install_dir: get_option('libexecdir'), install_mode: 'rwxr-xr-x')

# System policy: PipeWire and WirePlumber fragments (vendor directories, so
# /etc and ~/.config keep precedence).
install_data('data/pipewire/40-Suno-network-audio-opt-in.conf',
             install_dir: datadir / 'pipewire' / 'pipewire.conf.d')
install_data('data/wireplumber/60-Suno-audio-policy.conf',
             install_dir: datadir / 'wireplumber' / 'wireplumber.conf.d')
install_data('data/wireplumber/scripts/lib/Suno-output-policy.lua',
             'data/wireplumber/scripts/lib/Suno-app-audio.lua',
             install_dir: datadir / 'wireplumber' / 'scripts' / 'lib')
install_data('data/wireplumber/scripts/Suno/output-policy.lua',
             'data/wireplumber/scripts/Suno/app-audio.lua',
             install_dir: datadir / 'wireplumber' / 'scripts' / 'Suno')

# Session service
install_data('data/systemd/Suno-audio-devices.service', install_dir: prefix / 'lib' / 'systemd' / 'user')
install_data('data/dbus/org.projectSuno.AudioDevices.service', install_dir: datadir / 'dbus-1' / 'services')
install_data('data/dbus/org.projectSuno.AudioDevices1.xml', install_dir: datadir / 'dbus-1' / 'interfaces')
install_data('data/applications/org.projectSuno.AudioDevices.desktop', install_dir: datadir / 'applications')
install_data('data/glib-2.0/org.projectSuno.audio-devices.gschema.xml',
             install_dir: datadir / 'glib-2.0' / 'schemas')
install_data('data/icons/Suno-network-speaker-symbolic.svg',
             install_dir: datadir / 'icons' / 'hicolor' / 'scalable' / 'status')
