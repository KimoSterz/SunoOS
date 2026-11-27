ui_headers = files(
  'Suno-reorder-hint.h',
  'Suno-welcome-view.h',
  'Suno-empty-state.h',
  'Suno-application-icon.h',
  'Suno-action-bar.h',
  'Suno-adaptive-scaffold.h',
  'Suno-application-window.h',
  'Suno-pane.h',
  'Suno-media-fader.h',
  'Suno-audio-meter.h',
  'Suno-volume-slider.h',
  'Suno-mixer-strip.h',
  'Suno-media-row.h',
  'Suno-segmented-control.h',
  'Suno-inspector-section.h',
  'Suno-histogram.h',
  'Suno-curve-editor.h',
  'Suno-color-well.h',
  'Suno-context.h',
  'Suno-surface-backdrop.h',
  'Suno-window-shape.h',
  'Suno-window-capture.h',
  'Suno-restore.h',
  'Suno-save-sheet.h',
  'Suno-ui.h',
)

# SunoUI parts (ADR-052). A part's header joins the introspected sources with
# its implementation, in ui_part_sources.
ui_part_headers = files(
  'Suno-ui-kit.h',
  'Suno-layer-host.h',
  'Suno-mode-switch.h',
  'Suno-corner-pill.h',
  'Suno-sidebar-foot.h',
  'Suno-sidebar-toggle.h',
  'Suno-badges.h',
  'Suno-toast.h',
  'Suno-destructive-dialog.h',
  'Suno-stacked-button.h',
  'Suno-controls.h',
  'Suno-choice-list.h',
  'Suno-progress-line.h',
  'Suno-details-pane.h',
  'Suno-table-header.h',
  'Suno-action-center.h',
  'Suno-cards.h',
  'Suno-file-card.h',
  'Suno-selection-bubble.h',
  'Suno-navigation-trail-bar.h',
  'Suno-menu-drawer.h',
  'Suno-contact.h',
  'Suno-text-field.h',
  'Suno-place-search.h',
  'Suno-message-bubble.h',
  'Suno-type-label.h',
  'Suno-island.h',
  'Suno-title-island.h',
  'Suno-list-first.h',
  'Suno-tab-bar.h',
  'Suno-navigation-sidebar.h',
  'Suno-media-transport-lcd.h',
  'Suno-creative-workspace.h',
  'Suno-creative-tools.h',
  'Suno-creative-layers.h',
  'Suno-creative-properties.h',
  'Suno-arrange-view.h',
  'Suno-color-picker.h',
  'Suno-timeline.h',
)

ui_c_args = []
# GDesktopAppInfo is freedesktop-only (not on macOS, Windows or Android).
if gio_unix_dep.found() and meson.get_compiler('c').has_header('gio/gdesktopappinfo.h', dependencies: gio_unix_dep)
  ui_c_args += '-DSuno_HAVE_DESKTOP_APP_INFO'
endif
wayland_protocol_sources = []
if wayland_client_dep.found()
  ui_c_args += '-DSuno_HAVE_WAYLAND'
  wayland_scanner = find_program('wayland-scanner')
  # ext-background-effect-v1 (standard), Suno-window-shape-v1 and
  # Suno-window-capture-v1 (Suno's Mutter; the same XML is the Mutter
  # package's protocol source).
  foreach protocol : ['ext-background-effect-v1', 'Suno-window-shape-v1',
                      'Suno-window-capture-v1']
    protocol_xml = files('../protocols/' + protocol + '.xml')
    wayland_protocol_sources += custom_target(
      protocol + '-client-header',
      input: protocol_xml,
      output: protocol + '-client-protocol.h',
      command: [wayland_scanner, 'client-header', '@INPUT@', '@OUTPUT@'],
    )
    wayland_protocol_sources += custom_target(
      protocol + '-client-code',
      input: protocol_xml,
      output: protocol + '-client-protocol.c',
      command: [wayland_scanner, 'private-code', '@INPUT@', '@OUTPUT@'],
    )
  endforeach
endif

ui_sources = files(
  'Suno-reorder-hint.c',
  'Suno-welcome-view.c',
  'Suno-empty-state.c',
  'Suno-application-icon.c',
  'Suno-action-bar.c',
  'Suno-adaptive-scaffold.c',
  'Suno-application-window.c',
  'Suno-tv-frame.c',
  'Suno-tv-fade.c',
  'Suno-tv-keyboard.c',
  'Suno-native-app-updates.c',
  'Suno-pane.c',
  'Suno-media-fader.c',
  'Suno-audio-meter.c',
  'Suno-volume-slider.c',
  'Suno-mixer-strip.c',
  'Suno-media-row.c',
  'Suno-segmented-control.c',
  'Suno-inspector-section.c',
  'Suno-histogram.c',
  'Suno-curve-editor.c',
  'Suno-color-well.c',
  'Suno-context.c',
  'Suno-surface-backdrop.c',
  'Suno-window-shape.c',
  'Suno-window-capture.c',
  'Suno-restore.c',
  'Suno-save-sheet.c',
  'Suno-ui-init.c',
)

# A part joins the library, and its header the introspected sources, once its
# implementation (same stem, .c) exists; until then only the header installs.
fs = import('fs')
ui_part_sources = []
ui_part_gir_headers = []
foreach header : ui_part_headers
  stem = fs.stem(header)
  if fs.exists(stem + '.c')
    ui_part_sources += files(stem + '.c')
    ui_part_gir_headers += header
  endif
endforeach
ui_sources += ui_part_sources

ui_resources = gnome.compile_resources(
  'Suno-ui-resources',
  'Suno-ui.gresource.xml',
  source_dir: '.',
  c_name: 'Suno_ui',
)

ui_inc = include_directories('.', '../semantics')
ui_lib = library(
  'Suno-ui-1',
  ui_sources,
  wayland_protocol_sources,
  ui_resources,
  version: '0.1.0',
  soversion: '0',
  c_args: ui_c_args,
  dependencies: [glib_dep, gobject_dep, gio_dep, gio_unix_dep, gtk_dep, adw_dep, wayland_client_dep,
                 semantics_dep, appearance_dep,
                 meson.get_compiler('c').find_library('m', required: false)],
  include_directories: ui_inc,
  install: true,
)

ui_dep = declare_dependency(
  link_with: ui_lib,
  include_directories: ui_inc,
  dependencies: [gtk_dep, adw_dep, semantics_dep],
)

install_headers(ui_headers, ui_part_headers, subdir: 'Suno-1/Suno-ui')

pkg.generate(
  ui_lib,
  name: 'Suno UI',
  description: 'Adaptive GTK and libadwaita application framework for Suno',
  filebase: 'Suno-ui-1',
  subdirs: 'Suno-1/Suno-ui',
  requires: ['gtk4', 'libadwaita-1', 'Suno-semantics-1'],
)

if build_introspection
  ui_gir = gnome.generate_gir(
    ui_lib,
    sources: ui_sources + ui_headers + ui_part_gir_headers,
    namespace: 'SunoUI',
    nsversion: '1',
    identifier_prefix: 'Suno',
    symbol_prefix: 'Suno',
    includes: ['Gtk-4.0', 'Adw-1', semantics_gir[0]],
    header: 'Suno-ui.h',
    dependencies: semantics_dep,
    install: true,
  )
endif
