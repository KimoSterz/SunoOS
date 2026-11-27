semantics_headers = files(
  'Suno-action.h',
  'Suno-background-agent.h',
  'Suno-enums.h',
  'Suno-live-extension.h',
  'Suno-semantic-object.h',
  'Suno-semantics.h',
)

semantics_sources = files(
  'Suno-action.c',
  'Suno-background-agent.c',
  'Suno-enums.c',
  'Suno-live-extension.c',
  'Suno-semantic-object.c',
)

semantics_inc = include_directories('.')
semantics_lib = library(
  'Suno-semantics-1',
  semantics_sources,
  version: '0.1.0',
  soversion: '0',
  dependencies: [glib_dep, gobject_dep, gio_dep],
  include_directories: semantics_inc,
  install: true,
)

semantics_dep = declare_dependency(
  link_with: semantics_lib,
  include_directories: semantics_inc,
  dependencies: [glib_dep, gobject_dep, gio_dep],
)

install_headers(semantics_headers, subdir: 'Suno-1/Suno-semantics')

pkg.generate(
  semantics_lib,
  name: 'Suno Semantics',
  description: 'Semantic application and Live Extension contracts for Suno',
  filebase: 'Suno-semantics-1',
  subdirs: 'Suno-1/Suno-semantics',
  requires: ['glib-2.0', 'gobject-2.0', 'gio-2.0'],
)

if build_introspection
  semantics_gir = gnome.generate_gir(
    semantics_lib,
    sources: semantics_sources + semantics_headers,
    namespace: 'SunoSemantics',
    nsversion: '1',
    identifier_prefix: 'Suno',
    symbol_prefix: 'Suno',
    includes: ['GObject-2.0', 'Gio-2.0'],
    header: 'Suno-semantics.h',
    install: true,
  )
endif
