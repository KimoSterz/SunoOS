project('Suno-media-bridge', version: '0.1.0', meson_version: '>= 1.3.0')
python = import('python').find_installation('python3')
python.install_sources('Suno_media_bridge/__init__.py', 'Suno_media_bridge/kodi.py', 'Suno_media_bridge/mpris.py',
                       'Suno_media_bridge/service.py', subdir: 'Suno_media_bridge')
install_data('data/Suno-media-bridge.service', install_dir: get_option('prefix') / 'lib/systemd/user')
install_data('data/Suno-media-bridge.in', install_dir: get_option('libexecdir'), rename: 'Suno-media-bridge',
             install_mode: 'rwxr-xr-x')
