project('Suno-wifi-guard', version: '0.1.0', meson_version: '>= 1.3.0')
python = import('python').find_installation('python3')
python.install_sources('Suno_wifi_guard/__init__.py', 'Suno_wifi_guard/guard.py', 'Suno_wifi_guard/policy.py',
                       subdir: 'Suno_wifi_guard')
install_data('data/Suno-wifi-guard.service', install_dir: get_option('prefix') / 'lib/systemd/system')
install_data('data/Suno-wifi-guard.in', install_dir: get_option('libexecdir'), rename: 'Suno-wifi-guard',
             install_mode: 'rwxr-xr-x')
