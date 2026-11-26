# LumaSyncStore (ADR-057 §3.7): Connect Sync for apps, on GIO alone so non-GTK
# apps, games and the Rust core can use it. Namespace LumaSync 1.
sync_headers = files('luma-sync.h')
sync_sources = files('luma-sync-types.c', 'luma-sync-local.c', 'luma-sync-store.c')

sync_inc = include_directories('.')
sync_lib = library(
  'luma-sync-1',
  sync_sources,
  version: '0.1.0',
  soversion: '0',
  dependencies: [glib_dep, gobject_dep, gio_dep, gio_unix_dep],
  include_directories: sync_inc,
  install: true,
)

sync_dep = declare_dependency(
  link_with: sync_lib,
  include_directories: sync_inc,
  dependencies: [glib_dep, gobject_dep, gio_dep, gio_unix_dep],
)

install_headers(sync_headers, subdir: 'luma-1/luma-sync')

pkg.generate(
  sync_lib,
  name: 'Luma Sync',
  description: 'Connect Sync for apps: an app\'s own data on every device of the person\'s Luma account',
  filebase: 'luma-sync-1',
  subdirs: 'luma-1/luma-sync',
  requires: ['glib-2.0', 'gobject-2.0', 'gio-2.0', 'gio-unix-2.0'],
)

if build_introspection
  sync_gir = gnome.generate_gir(
    sync_lib,
    sources: sync_sources + sync_headers,
    namespace: 'LumaSync',
    nsversion: '1',
    identifier_prefix: 'Luma',
    symbol_prefix: 'luma',
    includes: ['GObject-2.0', 'Gio-2.0'],
    header: 'luma-sync.h',
    install: true,
  )
endif
