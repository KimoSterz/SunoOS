project(
  'Suno-developer-platform',
  'c',
  version: '0.1.0',
  license: 'Apache-2.0',
  meson_version: '>= 1.3.0',
  default_options: ['c_std=c17', 'warning_level=2', 'werror=true'],
)

gnome = import('gnome')
pkg = import('pkgconfig')

glib_dep = dependency('glib-2.0', version: '>= 2.80')
gobject_dep = dependency('gobject-2.0', version: '>= 2.80')
gio_dep = dependency('gio-2.0', version: '>= 2.80')
gtk_dep = dependency('gtk4', version: '>= 4.18')
adw_dep = dependency('libadwaita-1', version: '>= 1.7')
wayland_client_dep = dependency('wayland-client', version: '>= 1.23', required: get_option('wayland'))
gio_unix_dep = dependency('gio-unix-2.0', required: false)
build_introspection = get_option('introspection').allowed() and meson.can_run_host_binaries()

subdir('appearance')
subdir('semantics')
if gio_unix_dep.found()
  subdir('sync')
endif
subdir('ui')
if get_option('tests')
  subdir('tests')
endif

install_subdir('schemas', install_dir: get_option('datadir') / 'Suno-platform')
install_subdir('protocols', install_dir: get_option('datadir') / 'Suno-platform')
install_subdir('sdk/Suno_sdk/templates', install_dir: get_option('datadir') / 'Suno-platform')
install_data(
  'ui/Suno-ui.css',
  'appkit/Suno-appkit-base.css',
  'appkit/Suno-appkit-high-contrast-tokens.css',
  'appkit/Suno-appkit-high-contrast.css',
  'appkit/Suno-appkit.css', 'appkit/Suno-appkit-tokens.css',
  'appkit/Suno-empty-state-tokens.css',
  'appkit/Suno-appkit-dark.css', 'appkit/Suno-appkit-dark-tokens.css',
  'appkit/Suno-appkit-frost-tokens.css',
  'appkit/Suno-appkit-frost.css',
  'appkit/Suno-appkit-glass-tokens.css',
  'appkit/Suno-appkit-glass.css',
  'appkit/SunoUI-palette.css', 'appkit/SunoUI-toolkit.css',
  install_dir: get_option('datadir') / 'Suno-appkit',
)
# SunoUI family sheets (Suno-appkit-<family>.css and its -dark/-frost/-glass/
# -high-contrast variants) are found on disk, the way the kit finds them, so a
# new part family needs no build change.
SunoUI_family_css = []
_family_list = run_command(find_program('python3'), '-c',
  'import pathlib, re, sys\n'
  + 'core = {"base", "tokens", "dark", "frost", "glass", "high"}\n'
  + 'rx = re.compile(r"^Suno-appkit-([a-z][a-z0-9_]*)(-(dark|frost|glass|high-contrast))?[.]css$")\n'
  + 'for p in sorted(pathlib.Path(sys.argv[1]).glob("Suno-appkit-*.css")):\n'
  + '    m = rx.match(p.name)\n'
  + '    if m and m.group(1) not in core and not p.name.endswith("-tokens.css"): print(p.name)\n',
  meson.current_source_dir() / 'appkit', check: true)
foreach _sheet : _family_list.stdout().strip().split('\n')
  if _sheet != ''
    SunoUI_family_css += 'appkit' / _sheet
  endif
endforeach
if SunoUI_family_css.length() > 0
  install_data(SunoUI_family_css, install_dir: get_option('datadir') / 'Suno-appkit')
endif
install_subdir('appkit/fonts', install_dir: get_option('datadir') / 'Suno-appkit')
install_subdir(
  'appkit/icons',
  # hicolor declares scalable/actions, not symbolic/actions.  Symbolic SVGs are
  # identified by their -symbolic name and recoloured by GTK after lookup.
  install_dir: get_option('datadir') / 'icons/hicolor/scalable/actions',
  strip_directory: true,
)
install_data(
  'broker/org.projectSuno.SemanticBroker1.xml',
  install_dir: get_option('datadir') / 'dbus-1/interfaces',
)

# Native compatibility surfaces share App Kit geometry without a second UI runtime.
install_headers(
  'compat/Suno-window-frame.h', 'compat/Suno-frame-tokens.h', 'compat/Suno-frame-glyphs.h',
  subdir: 'Suno-1/compat',
)

# A tap reaches the prepared Python/GTK runtime without starting Python twice.
executable('Suno-app-launch', 'apphost/Suno-app-launch.c',
  c_args: ['-DSuno_LAUNCHER_DIR="' + get_option('prefix') / get_option('libexecdir') / 'Suno-app-launchers' + '"'],
  install: true, install_dir: get_option('libexecdir'))

install_emptydir(get_option('libexecdir') / 'Suno-app-launchers')

# Opt-in preparation for the explicitly declared native OS applications.
shared_module('Suno-app-prepare', 'apphost/native-prepare.c',
  dependencies: [gtk_dep, meson.get_compiler('c').find_library('dl')],
  install: true)
install_data('apphost/native-prewarm.py', rename: 'Suno-native-app-prewarm',
  install_mode: 'rwxr-xr-x', install_dir: get_option('libexecdir'))
install_data('apphost/native.json', install_dir: get_option('datadir') / 'Suno-app-host')
install_data('apphost/tv.json', install_dir: get_option('datadir') / 'Suno-app-host')
