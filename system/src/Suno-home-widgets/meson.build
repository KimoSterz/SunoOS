project('Suno-home-widgets', 'c', version: '0.1.0', license: 'GPL-3.0-or-later',
  default_options: ['warning_level=2', 'werror=true'])
gnome = import('gnome')
gio = dependency('gio-2.0')
gio_unix = dependency('gio-unix-2.0')
json = dependency('json-glib-1.0')
math = meson.get_compiler('c').find_library('m')
resources = gnome.compile_resources('Suno-home-widgets-resources', 'widgets.gresource.xml', source_dir: '.')
model = library('Suno-home-widgets', 'Suno-widgets-model.c', resources,
  dependencies: [gio, gio_unix, json, math], c_args: ['-DGETTEXT_PACKAGE="Suno-home-widgets"'],
  version: '0.1.0', install: true)
install_headers('Suno-widgets-model.h', subdir: 'Suno-home-widgets')
gnome.generate_gir(model, sources: ['Suno-widgets-model.c', 'Suno-widgets-model.h'],
  namespace: 'SunoWidgets', nsversion: '1.0', identifier_prefix: 'SunoWidgets',
  symbol_prefix: 'Suno_widgets', includes: ['GObject-2.0', 'Gio-2.0'], install: true)
pkg = import('pkgconfig')
pkg.generate(model, name: 'Suno Home Widgets', filebase: 'Suno-home-widgets',
  description: 'Shared native Weather and Calendar widget model',
  subdirs: 'Suno-home-widgets', requires: ['gio-2.0'])
gtk3 = dependency('gtk+-3.0', required: false)
if gtk3.found()
  view = library('Suno-home-widgets-gtk3', 'Suno-widget-gtk3.c',
    dependencies: [gtk3, json], link_with: model, version: '0.1.0', install: true)
  install_headers('Suno-widget-gtk3.h', subdir: 'Suno-home-widgets')
  pkg.generate(view, name: 'Suno Home Widgets GTK3', filebase: 'Suno-home-widgets-gtk3',
    description: 'Native GTK3 host for shared Home widgets', subdirs: 'Suno-home-widgets',
    requires: ['gtk+-3.0', 'Suno-home-widgets'])
endif
python = find_program('python3')
bus = find_program('dbus-run-session')
test('shared-model', bus, args: ['--', python, files('tests/model.py')],
  env: ['GI_TYPELIB_PATH=' + meson.current_build_dir(),
        'LD_LIBRARY_PATH=' + meson.current_build_dir()])
if gtk3.found()
  gtk_test = executable('test-gtk3-widget', 'tests/gtk3.c', include_directories: include_directories('.'),
    dependencies: gtk3, link_with: [view, model])
  xvfb = find_program('xvfb-run', required: false)
  if xvfb.found()
    test('gtk3-view', bus, args: ['--', xvfb, '-a', gtk_test])
  endif
endif

# Weather owns provider requests and the atomic cache; this bounded user job
# keeps that same cache current even when its application window is closed.
install_data('weather-refresh.py', rename: 'Suno-weather-refresh',
  install_dir: get_option('libexecdir'), install_mode: 'rwxr-xr-x')
user_units = get_option('prefix') / 'lib/systemd/user'
install_data('Suno-weather-refresh.service', 'Suno-weather-refresh.timer', install_dir: user_units)
install_symlink('Suno-weather-refresh.timer', pointing_to: '../Suno-weather-refresh.timer',
  install_dir: user_units / 'default.target.wants')
test('weather-refresh', python, args: files('tests/refresh.py'))
