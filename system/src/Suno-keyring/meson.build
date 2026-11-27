# SPDX-License-Identifier: MPL-2.0
project('Suno-keyring', 'c', version: '0.3.0', meson_version: '>= 1.3.0', license: 'MPL-2.0',
        default_options: ['c_std=gnu17', 'warning_level=2'])

python = import('python').find_installation('python3')
prefix = get_option('prefix')
datadir = prefix / get_option('datadir')
sysconfdir = get_option('sysconfdir')

python.install_sources(
  'Suno_keyring/__init__.py',
  'Suno_keyring/autounlock.py',
  'Suno_keyring/cli.py',
  'Suno_keyring/first_unlock.py',
  'Suno_keyring/login.py',
  'Suno_keyring/prompt_gate.py',
  'Suno_keyring/prompter.py',
  'Suno_keyring/ready.py',
  'Suno_keyring/repair.py',
  'Suno_keyring/secrets.py',
  'Suno_keyring/service.py',
  'Suno_keyring/sheet.py',
  'Suno_keyring/sheet_tv.py',
  'Suno_keyring/state.py',
  'Suno_keyring/window.py',
  subdir: 'Suno_keyring',
)

install_data('bin/Suno-keyring', install_dir: get_option('libexecdir'), install_mode: 'rwxr-xr-x')

# The passwd stack's hook: hands the new password to Suno-keyring --pam-rewrap
# once it verifies against /etc/shadow; never prompts, never fails a change.
pam_dep = dependency('pam')
crypt_dep = dependency('libxcrypt')
shared_module('pam_Suno_keyring', 'pam/pam_Suno_keyring.c',
  name_prefix: '',
  dependencies: [pam_dep, crypt_dep],
  c_args: ['-DSuno_KEYRING_HELPER="@0@"'.format(prefix / get_option('libexecdir') / 'Suno-keyring')],
  gnu_symbol_visibility: 'hidden',
  link_args: ['-Wl,-z,relro', '-Wl,-z,now', '-Wl,--no-undefined'],
  install: true,
  install_dir: get_option('libdir') / 'security')
# The tests drive pam_chauthtok as passwd does; never installed.
executable('chauthtok', 'tests/pam/chauthtok.c', dependencies: [pam_dep], install: false)
# Adds or removes the password-change hook in the passwd PAM stack.
install_data('data/pam/Suno-keyring-pam-setup', install_dir: get_option('libexecdir'),
             install_mode: 'rwxr-xr-x')
# Recovery that needs nothing but python3-cryptography, for an older system.
install_data('tools/Suno-keyring-recover-standalone', install_dir: datadir / 'Suno-keyring',
             install_mode: 'rwxr-xr-x')

install_data('data/systemd/Suno-keyring.service', 'data/systemd/Suno-keyring-autologin.service',
             'data/systemd/Suno-keyring-verify.socket', 'data/systemd/Suno-keyring-verify@.service',
             install_dir: prefix / 'lib' / 'systemd' / 'user')
install_data('data/applications/org.projectSuno.Keyring.desktop', install_dir: datadir / 'applications')
install_data('data/glib-2.0/org.projectSuno.keyring.gschema.xml',
             install_dir: datadir / 'glib-2.0' / 'schemas')
# Checking a person's own login password needs a stack of its own.
install_data('data/pam/Suno-keyring', install_dir: sysconfdir / 'pam.d')
