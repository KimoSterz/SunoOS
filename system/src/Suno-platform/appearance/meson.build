appearance_sources = files('Suno-appearance.c')
appearance_headers = files('Suno-appearance.h')
appearance_lib = library('Suno-appearance-1', appearance_sources,
  version: '0.1.0', soversion: '0',
  dependencies: [glib_dep, gobject_dep, gio_dep], install: true)
appearance_dep = declare_dependency(link_with: appearance_lib,
  include_directories: include_directories('.'),
  dependencies: [glib_dep, gobject_dep, gio_dep])
install_headers(appearance_headers, subdir: 'Suno-1/Suno-appearance')
pkg.generate(appearance_lib, name: 'Suno Appearance',
  description: 'Shared native surface tokens and accessibility/capability policy',
  filebase: 'Suno-appearance-1', subdirs: 'Suno-1/Suno-appearance',
  requires: ['glib-2.0', 'gobject-2.0', 'gio-2.0'])
if build_introspection
  appearance_gir = gnome.generate_gir(appearance_lib,
    sources: appearance_sources + appearance_headers,
    namespace: 'SunoAppearance', nsversion: '1', identifier_prefix: 'Suno',
    symbol_prefix: 'Suno', includes: ['GObject-2.0', 'Gio-2.0'],
    header: 'Suno-appearance.h', install: true)
endif
