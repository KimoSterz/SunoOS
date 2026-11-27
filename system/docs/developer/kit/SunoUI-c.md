---
title: SunoUI for C
summary: The SunoUI parts in C (SunoUI-1), each next to its Python twin, the rules they share, and how to build a C or C++ app against them.
order: 12
section: Kit
---

# SunoUI for C

`SunoUI-1` is SunoUI’s C library (`libSuno-ui-1.so.0`, `#include <Suno-ui.h>`,
GIR namespace `SunoUI`). C++ apps such as Grid, Stage, Session and Write use it
directly, with the same parts as the Python apps. Each part is a final GObject
with introspection metadata, and each builds **the same widget tree with the
same CSS node names and classes** as its Python twin: one SunoUI stylesheet
(`Suno-appkit-base.css`) styles both, and a parity test walks both trees and
compares them.

The rules are the same as in Python ([principles](SunoUI-principles.md),
[behaviour](behaviour.md)): the app says *what*, SunoUI owns *how*. There are
no colour, size or duration arguments; a new look is a named variant and a
token. C apps never select `.SunoUI-*` in their own sheets.

## How the C API says things

- **Commands are `GAction` names.** Where Python takes a callback for a plain
  press, C takes a detailed action name (`"win.edit"`), the command's one
  stable ID, so menus, shortcuts and the part all bind the same command. On/off
  states are stateful boolean actions.
- **Events with data are signals.** A mode change, a sort, a confirmed
  dialog, a picked place: `changed`, `sort-changed`, `confirmed`, `picked`.
  Controls whose menu anchors to them (Open in, Share) emit a signal with the
  anchor.
- **Builders, not keyword lists.** Python's `CornerPill(share=…, actions=[…])`
  is `Suno_corner_pill_new()` then `add_share()`, `add_action()`; SunoUI still
  puts everything in its one order.
- **Misuse is a critical.** What Python refuses with `ValueError` (a lone
  stacked button, "Are you sure?", an unknown toast kind) is a `g_critical`.
  Run your tests with `G_DEBUG=fatal-criticals` so they fail on one.
- `SUNO_UI_API_LEVEL` is the C library’s API level (2 today, the same as
  Python’s `SUNOUI_API_LEVEL`), and `Suno_ui_get_api_level()` returns the level
  of the library actually loaded. It follows the policy in
  [principles](SunoUI-principles.md#api-level-compatibility-and-deprecation).

## The parts

| C (`SunoUI-1`) | Python (`Suno_appkit`) |
| --- | --- |
| **Core** `Suno-ui-kit.h`: `Suno_ui_install()`, `Suno_ui_icon_name("share-2")`, `Suno_ui_icon_new()`, `Suno_ui_apply_type(w, "title-1")`, `Suno_ui_reduced_motion()`, `Suno_ui_is_phone_width()`, `Suno_ui_count_text()`, `Suno_ui_initials()`, `Suno_ui_person_tone()` | `install_SunoUI`, `SunoUI_icon`, `apply_type`, `reduced_motion`, `structure_adapt.is_phone`, `count_text`, `content_cards.initials`, `content_cards.person_tone` |
| **Window** `SunoApplicationWindow`: `new(application, context)`, `set_identity()`, `set_menu_model()`, `set_frame(sidebar, island)`, `set_leading()`, `set_title_content(widget, centred)`, `set_trailing()`, `get_layer_host()` | `AppWindow`, with its frame, title row, identity, window controls and body |
| `SunoIsland`: `new(orientation)`, then `GtkBox.append()`; clipped content surface and inset edge | `Island(orientation=)` |
| `SunoNavigationSidebar`: `new(variant, width)`, `set_variant()`, `append_header()`, `append_footer()`, `append_section()`, `append_row()`, `clear()`, `get_list()`; `SunoNavigationRow`: `new(title, subtitle)`, `set_title/subtitle/meta/lead/trail()` | `NavigationSidebar(variant=, width=)`, `SidebarRow` destination subset |
| `SunoTypeLabel`: `new(text, role)`, `set_unit()`, `set_role()` | `TypeLabel(text, role=, unit=)` |
| `SunoLayerHost` (node `overlay`): `new(child)`, `for_widget()`, `window_host()`, `install(window)`, `present_modal(card, focus, SunoDrawerMode) → SunoModalHandle`, `track_bar(bar)`; `SunoModalHandle`: `cancel()`, `close()`, `nudge()`, `::cancelled` | `LayerHost`, `structure_layers.ModalHandle`, `ToastHost` (`track_bar`) |
| **Placement** `SunoModeSwitch`: `new(label)`, `add(key, label, icon)`, `set_current()`, `::changed(key)` | `ModeSwitch([(key, label, icon)], current=, on_change=)` |
| `SunoCornerPill`: `set_modes()`, `set_people()`, `add_open_in()` + `::open-in(anchor)`, `add_share()` + `::share(anchor)`, `add_action(icon, label, action)`, `add_state(icon, label, bool action)`, `set_info_pane(pane)` / `set_info_action()`, `set_more_menu(GMenuModel)`, `set_labelled()`, `set_primary(label)`, `edit(done)`, `stop_editing()`, `::edit-cancelled`, `::edit-done` | `CornerPill(modes=, people=, open_in=, share=, actions=, states=, info=, more=, labelled=, primary=)`, `.edit(on_cancel, on_done)` |
| **Sidebar** `SunoSidebarFoot`: `new(search)`, `add_filter(key, label, icon)`, `set_filter()`, `set_filter_count(key, n)`, `set_add(label, icon, action)`, `open_filters()`, `get_entry()`, `get_heading()`, `::search-changed(text)`, `::filter-changed(key)`; `SunoFilterHeading`: `::show-all` | `SidebarFoot(search=, on_search=, filters=, filter=, on_filter=, add=)`, `FilterHeading` |
| `SunoSidebarToggle` (a `GtkToggleButton`): `new(sidebar \| AdwOverlaySplitView, shown)`, `:shown`, `toggle()` (F9) | `SidebarToggle(sidebar, shown=, closed=)` |
| **Badges** `SunoCountBadge` (node `label`): `new(count, attention)`; `SunoCategoryPill` (node `label`): `new("media")`; `SunoStatusPill`: `new(kind, label)`, `set_kind()` | `CountBadge`, `CategoryPill`, `StatusPill` |
| **Actions** `Suno_toast_show(where, message, kind)`, `Suno_toast_show_with_undo()` + `::undo`, `Suno_toast_show_busy()`, `Suno_toast_dismiss()` | `Toast.show(where, msg, kind=, undo=, busy=)` |
| `Suno_destructive_dialog_ask(where, title, body, action, icon, option)`, `::confirmed(option_checked)`, `::cancelled` | `DestructiveDialog.ask(...)` |
| `SunoStackedButton`: `new(icon, label, danger)`; `SunoStackedButtons`: `new(small)`, `append()` (pairs or trios) | `StackedButton`, `StackedButtons` |
| **Details** `SunoDetailsPane`: `new(title, main)`, `add_hero()`, `add_section(label, action_label, action)`, `add_fact(key, value)`, `add_row(row)`, `add_photos(model)`, `add()`, `clear()`, `show(open)`, `set_subject()`, `close()`, `toggle()`, `info_button()`, `:shown` | `DetailsPane(title, main=)` with `add_facts([...])`, `add_list([...])`, `show(open=, subject=, main=)` |
| `SunoDetailsRow` (+ `add_action`, `::activated`), `SunoDetailsItem`, `SunoAddRow`, `SunoFactRow` (`copy()`), `SunoDetailsPhotos` (`::photo-activated`) | `DetailsRow`, `DetailsItem`, `AddRow`, `FactRow`, `DetailsPhotos` |
| **Tables** `SunoTableHeader`: `add_column(key, label, expand, width, end)`, `set_sort(key, SunoSortDirection)`, `activate_column()`, `align(row)`, `::sort-changed(key, direction)`; `Suno_table_header_for_column_view(view) → SunoColumnViewHeader` (for a `GtkColumnView`) | `TableHeader([Column(...)], sort=, on_sort=)`, `TableHeader.for_column_view(view)` |
| `Suno_selection_apply(list)`, `Suno_selection_mark(row, on)`, `Suno_selection_trail(row, on)` | `Selection.apply/mark/trail` |
| **Action center** `SunoBarItem`: `new_action(icon, label, action)`, `new_chip()`, `new_prompt()`, `new_context()`, `new_search(placeholder)`, `new_modes(mode_switch)`, `new_separator()`, `new_spacer()`, `set_primary/danger/active/sensitive/tooltip()` | `BarAction`, `BarChip`, `BarPrompt`, `BarContext`, `BarSearch`, a hosted `ModeSwitch`, `SEPARATOR`, `SPACER` |
| `SunoActionEditor`: `new(title, icon)`, `set_summary()`, `add_mode()`, `add_field()`, `add_tool()`, `set_body()`, `set_primary()`, `get_draft()`, `clear()`, `::mode-changed`, `::discarded` | `ActionEditor(title, icon, summary=, modes=, fields=, tools=, body=, primary=, draft=)` |
| `SunoActionCenter`: `new(editor)`, `attach(region)`, `show_bar(items, n, context)`, `show_split()`, `grow()`, `fold()`, `discard()`, `hide_bar()`, `:state` + `::state-changed` | `ActionCenter(editor).attach(host)`, `show_bar(items, context=)`, … |
| `SunoSelectionBubble`: `new(view, items, n, label)`, `show_for(rect)`, `hide()`, `set_active(icon, on)` | `SelectionBubble(view, items)` |
| **Menus** `SunoFloatingMenu`: `add_item(label, icon, gicon, note, action, selected)`, `add_shortcut_item(label, icon, shortcut, action)` (keycaps), `add_submenu(label, icon, submenu)` (cascades beside the menu: hover with a 250 ms aim grace, → opens, ← and Esc close one level; drills in place with Back on a phone), `add_heading()`, `add_separator()`, `popup(anchor)` (from the control: Menu key, Shift+F10), `popup_at(anchor, x, y)` (a context menu: its corner on the pointer or touch point in `anchor`'s coordinates, flipped at the window's edges); `Suno_menu_drawer_present_model(where, model, title)` | `action_bubble.FloatingMenu(rows).popup(anchor, x=, y=)`, `action_bubble.MenuItem(label, shortcut=, submenu=[rows])`, `MenuDrawer.present_model/present_items` |
| **Trail** `SunoNavigationTrailBar`: `new(with_title)`, `set_place(back_to, title)`, `add_meta(text, action)`, `::back` | `NavigationTrailBar(trail, meta=, title=)` |
| **Files** `SunoFileCard`: `new(file, compact)`, `set_kind/size/subtitle/tone/thumbnail/extra()`, `add_action(item)`, `::open`; `SunoOpenButton`: `new(file, type, small)`; `SunoOpenInMenu`: `new(file, type)`, `popup(anchor)`, `::app-chosen`; `Suno_file_split_name()` | `FileCard`, `OpenButton`, `OpenInMenu`, `split_name` |
| **Cards** `SunoCard`, `SunoContentLitCard`: `new(child, padded)`; `SunoAccountCard`: `new(name, caption)`; `SunoPersonAvatar`: `new(name, size)`, `set_picture()`; `SunoContentLitHeader`: `set_source(picture, tone, name)` | `Card`, `ContentLitCard`, `AccountCard`, `PersonAvatar`, `ContentLitHeader` |
| **People and places** `SunoPerson`, `SunoContactActions` (`::action` → handled), `SunoContactCard`, `SunoEventCard` (`::add`), `SunoSongCard` (`::play`), `SunoPlaceCard` (`::directions`), `Suno_contact_uri()` | `Person`, `ContactActions`, `ContactCard`, `EventCard`, `SongCard`, `PlaceCard`, `content_contact.contact_uri` |
| `SunoTextField`: `new(label, purpose)`, `set_hint()`, `::changed`, `::activate`; `SunoParagraphField`; `SunoHeroTitleField` (a `GtkEntry`): `::committed` | `TextField`, `ParagraphField`, `HeroTitleField` |
| `SunoPlaceSearch`: `set_places(model)` or `::search` + `set_results()`, `set_exclude(GtkFilter)`, `::picked`; `SunoPlaceResult`; `Suno_parse_coordinates()` | `PlaceSearch(provider, on_pick=, exclude=)`, `PlaceResult`, `rank_places`, `content_place.parse_coordinates` |
| `SunoMessageBubble`: `new(text, mine)`, `new_with_child()`, `set_joins()`, `set_selected()` | `MessageBubble(text, mine=, joined_above=, joined_below=, selected=)` |
| **Media** `SunoMediaTransportLcd`: `new()`, `set_lcd(bar, time)`, `set_readout("tempo" \| "signature" \| "key", value)`, `set_playing()`, `set_recording()`, `set_looping()`; signals `play-changed(bool)`, `record-changed(bool)`, `loop-changed(bool)`, `seek-start`, `readout-activated(key)` | `MediaTransport("lcd", lcd=…, readouts=…, on_play=…, on_record=…, on_loop=…)` |
| **Creative** `SunoCreativeWorkspace`: `new(content)`, `set_left/right(FloatingPanel)`, `set_tools(widget)`, `set_zoom(widget)`, `set_camera(zoom,x,y)`, `set_grid_visible()`, `set_focused()`; `SunoFloatingPanel`: `new(title, icon)`, `set_child()` or `add_page(key,label,child)`, `set_page()`, `set_title_menu()`, `set_title_editable()`, `set_more_menu()`, `set_summary()`, `set_folded()`, signals `page-changed(key)`, `renamed(name)` | `CreativeWorkspace(content, left=, right=, tools=, zoom=, focused=)`, `FloatingPanel(title, icon, child= or pages=)` |
| **Docks** `SunoCreativeWorkspace`: `add_panel(key, panel, SunoPanelSide)` (left, right or bottom; movable by dragging the header or from its More menu), `remove_panel()`, `get_panel()`, `move_panel(key, side, index)`, `get_layout()` / `set_layout()` (`a(ssb)`: key, side, folded), signal `layout-changed` | `CreativeWorkspace(panels=[(key, panel, side)], layout=, on_layout=)`, `creative_workspace.workspace_layout()`, `apply_layout()` |
| **Arrange** `SunoArrangeView`: `new(content)`, `set_canvas_size(w, h)`, `add_item(id, label, x, y, w, h)`, `set_item_rect/label/locked/visible/keeps_aspect/croppable()`, `set_item_crop(id, l, t, r, b)` / `get_item_crop()` (fractions of the source, 0–0.49 a side; the rect is what shows), `set_item_ghost(id, paintable)` (the uncropped source, drawn dim where a crop cuts), `set_cropping(id)` / `get_cropping()` (crop mode; property `cropping`), `set_selection(ids)` / `get_selection()` / `select_all()` (Shift+click, a rubber band from empty canvas, Ctrl+A; signal `selection-ids-changed(ids)`; two or more move, scale and nudge together inside one box, signals `group-changed(a{s(dddd)})` and `group-committed(…)`), `set_item_shown_rect(id, x, y, w, h)` / `clear_item_shown_rect(id)` (where the app's picture is on screen during a drag: the outline and crop frame follow it, the handles stay under the pointer), `get_drag_mode()` (property `drag-mode`: `move`, `resize`, `stretch`, `resize-centre`, `stretch-centre`, `crop`, `crop-centre`, `pan`, `none`), `remove_item()`, `clear()`, `set_order(ids)`, `set_selected()`, `set_snapping()`, `canvas_to_view()`; signals `selection-changed(id)`, `item-changed(id, x, y, w, h)` (every step), `item-committed(…)` (the end of a drag or a nudge), `crop-changed(id, l, t, r, b)`, `crop-committed(…)`, `item-activated(id)` (a double click on a box that can't be cropped); `Suno_arrange_snap()`. Handles: a box that keeps its aspect scales from the opposite edge or corner, Shift stretches, Alt from the centre, Ctrl crops (croppable boxes); modifiers switch a drag live; Alt on a move turns snapping off. Crop mode: double click or Enter; handles crop, a drag inside pans the source, Enter or Esc leaves | `ArrangeView(content, canvas=, items=[ArrangeItem(..., croppable=, crop=)], on_select=, on_change=, on_commit=, on_activate=, on_crop=, on_crop_commit=, on_drag_mode=)` |
| **Colour** `SunoColorPicker`: `new()`, `set_rgba()` / `get_rgba()`, `set_palette(colors)` (the document's, after Suno's), `set_with_alpha()`, `pick_from_screen()` (Screenshot portal `PickColor`), `get_recent_colors()` / `add_recent_color()` (per app, `$XDG_CONFIG_HOME/<app id>/SunoUI.ini`); signals `color-changed(rgba)` (live), `color-committed(rgba)` (once per finished change). `SunoPropertyColor`'s swatch opens it in a popover, or in `set_action_center(center)`'s grown panel; `::open-picker(picker)` → handled lets an app host it; `::color-committed` | `ColorPicker(color, palette=, with_alpha=, on_change=, on_commit=)`, `recent_colors()`, `PropertyColor(..., on_commit=, bar=)` |
| **Meter** `SunoAudioMeter`: `new(channels)`, `set_levels_db(l, r)`, `set_levels(l, r)`, `set_horizontal()`, `set_segments(n)` (0 continuous, N LED segments, `:segments`), `set_segment_shape(thickness, gap, radius)`, `set_zones(FALSE)` (an output's level: one green, no zones, no peak hold), `get_lit_segments(ch)`, `get_peak_segment(ch)`, `segments_lit_at(n, db)`, `get_level_db(ch)`, `get_peak_db(ch)`, `set_clipped()`, `reset_clip()` | `AudioMeter(channels, horizontal=, segments=, thickness=, gap=, radius=, zones=, label=)`, alias `LevelMeter`; `LevelTap(meter, source)` feeds it from GStreamer `level` while mapped |
| **Volume** `SunoVolumeSlider`: `new(orientation, lower, upper)`, `set_value()`, `set_range()`, `set_steps()`, `set_unity()`, `set_unit()`, `set_muted()`, `set_meter_channels()`, `get_meter()`, `::moved` | `VolumeSlider(lower, upper, value=, unity=, unit=, meter=, horizontal=, label=, on_move=)` |
| **Playing** `SunoMediaRow`: `new()`, `set_density(REGULAR|COMPACT|TOUCH)`, `set_title()`, `set_line()`, `set_app(name, icon)`, `set_art(paintable)` / `set_art_file(file)`, `set_transport(flags)`, `set_playing()`, `set_sounding()`, `set_volume()`, `set_muted()`, `set_meter_segments()`, `set_level(position)`, `set_trailing(widget)`, `get_slider()`, `get_meter()`; signals `raise`, `mute-toggled(muted)`, `play-pause`, `previous`, `next`, `volume-changed(percent)`; `Suno_media_row_chip_new(icon, label)`, `Suno_media_row_chip_set(chip, icon, label, raised)`; `SunoVolumeSlider`: `set_compact()` | `MediaRow(title, line, app=, icon=, art=, density=, transport=, playing=, sounding=, volume=, muted=, meter=, on_play=, on_previous=, on_next=, on_volume=, on_mute=, on_raise=)`, `MediaRowChip(icon, label, raised=)` |
| **Mixer** `SunoMixerStrip`: `new(label, subtitle)`, `set_label()`, `set_subtitle()`, `set_range(min_db, max_db)`, `set_db()`, `set_muted()`, `set_monitoring()`, `set_levels(l, r)`, `set_levels_db(l, r)`, `get_fader()`, `get_meter()`, `::moved`, `::mute-toggled`, `::monitor-toggled`; `SunoMixerRow`: `new()`, `append()`, `remove()`, `get_n_strips()`, `get_strip(i)` | `MixerStrip(name, subtitle=None, db=, min_db=, max_db=, muted=, monitoring=, on_change=, on_mute=, on_monitor=)`, `MixerRow(strips, label=)` |
| **Media** `SunoTimeline`: `new()`, `begin_update()` / `clear()` / `end_update()`, `set_frame_rate(num, den)`, `set_duration_frames()`, `append_lane()`, `set_lane_state()`, `append_region()`, `append_marker()`, `set_loop_frames()`, `set_position_frames()`, `set_selected_region()`, `set_tool()`, `set_snapping()`, `set_zoom()`, `set_export_status()`; signals in `Suno-timeline.h` | `Timeline(lanes, duration, fps, position, selected, tool, snapping, zoom, callbacks)` |

The gtk-doc comments in each header are the reference. A Python name written
with a module prefix (`content_cards.initials`) is not exported from the
`Suno_appkit` package root, so it is not covered by the
[compatibility promise](SunoUI-principles.md#api-level-compatibility-and-deprecation).

`set_frame()` accepts a `SunoNavigationSidebar` (or `NULL`) and a `SunoIsland`,
and places them in the window body with the 8px gutter. The sidebar’s named
variants use the same row styles and width tokens as Python.

The native LCD transport keeps the app's playback state and values separate
from its controls. Presses update the visible toggle immediately and emit a
signal; authoritative player updates call the setters. At a window width of
600 px or less, SunoUI keeps start, play, record and the LCD, and hides the
three auxiliary readouts and loop key. Its CSS comes from the shared media
sheet and is reloaded with the active treatment.

The native timeline accepts integer frame counts at a rational frame rate.
Seek, skim, move, trim and split signals report seconds; apps convert those
intent values into their own commands/undo and then replace the affected data.
For a whole arrangement, use `begin_update`, `clear`, the frame/lane/region
setters, then `end_update` so it paints once. `append_note` and
`set_region_waveform` accept the app's MIDI frames and normalized audio peaks;
SunoUI does no media read or cache work. `set_position_frames` moves only
the playhead, and meter-only `set_lane_state` updates only the meter. SunoUI
owns the 52 px ruler, 64 px lanes, clip and track controls, loop/marker chrome,
and 214 px desktop / 116 px phone headers. Controls remain present on phone.

## Windows that keep their shape

A window whose content has a fixed shape, such as a game or a video view,
asks Suno's compositor to keep it (C API level 10):

```c
Suno_window_set_aspect_content (window, game_view);
if (!Suno_window_set_aspect_ratio (window, 4, 3))
  /* No compositor support: keep the app's own fit-after-resize. */;
```

Only the ratio matters (4:3 and 640:480 are the same); `0, 0` removes it.
`Suno_window_set_aspect_content()` names the widget that shows the content, so
the header bar and other chrome keep their own size and the ratio holds for
that widget alone; without it the whole window keeps the ratio. Either call
may come before or after the window is shown.

The compositor keeps the ratio wherever the window goes: live while the
person drags any edge or corner, for sizes the app asks for, in tiles of
every kind (the largest size with the ratio, centred in the tile, with the
desktop showing around it) and when maximized (the same, in the maximize
area). A tile smaller than the window's minimum size leaves the window at
its minimum, at the tile's corner. Only fullscreen fills the screen, so the
content still letterboxes there. An app's "free" shape mode removes the
ratio, and the window fills its tile again.

`Suno_window_set_aspect_ratio()` returns `TRUE` when the compositor keeps
the ratio; `Suno_window_get_aspect_ratio_enforced()` asks without setting
one. Elsewhere (another compositor, X11, macOS, Windows) the calls do nothing
and return `FALSE`. Python reaches the same calls through introspection as
`SunoUI.window_set_aspect_ratio()`.

## Windows hidden from screen capture

A window that would capture itself, such as a recorder's controls or a
streaming app's preview, keeps itself out of screen captures (C API level
11):

```c
Suno_window_set_hidden_from_capture (window, TRUE);
```

Screen shares of a display or an area and screenshots of the screen show
what is behind the window; it stays on the screen as usual, and its dialogs,
menus and popovers are left out with it. Sharing the window itself still
shows it, and the share picker marks its tile "Hidden from screen sharing".
No permission is needed: hiding only removes content from captures. The call
may come before or after the window is shown; `FALSE` shows the window in
captures again.

It returns `TRUE` when the compositor hides the window;
`Suno_window_get_capture_hiding_supported()` asks without setting anything.
Elsewhere (another compositor, X11, macOS, Windows) it does nothing and
returns `FALSE`. Python apps call `AppWindow.set_hidden_from_capture()`
(`SUNOUI_API_LEVEL` 14). Xwayland apps that do not use SunoUI set the
`_SUNO_WINDOW_HIDDEN_FROM_CAPTURE` CARDINAL property on their window to 1.
See ADR-053.

## Windows and documents that come back

Every app's windows come back after a restart, a log-out or a crash, and
continue on the person's other devices: the shell restores their place,
state, order and focus. An app also gets its own state back by giving each
window a key and saving what the window needs (C API level 12):

```c
static void
save_window (SunoRestore *restore, GtkWindow *window, GVariantDict *state, gpointer data)
{
  Suno_restore_add_document (state, document_uri (window), document_title (window),
                             document_dirty (window), unsaved_text (window));
  g_variant_dict_insert (state, "scroll", "d", scroll_position (window));
}

static void
restore_window (SunoRestore *restore, const char *reason, const char *key,
                GVariant *state, gpointer app)
{
  GtkWindow *window = open_window (app, state);
  Suno_window_set_restore_key (window, key);
  gtk_window_present (window);
}

static void
startup (GApplication *app)
{
  SunoRestore *restore = Suno_restore_get_default (GTK_APPLICATION (app));
  g_signal_connect (restore, "save-window", G_CALLBACK (save_window), NULL);
  g_signal_connect (restore, "restore-window", G_CALLBACK (restore_window), app);
}

static void
activate (GApplication *app)
{
  if (Suno_restore_restore (Suno_restore_get_default (GTK_APPLICATION (app))))
    return;
  open_window (app, NULL);
}
```

Give every `GtkApplicationWindow` a key before it is first shown
(`Suno_window_set_restore_key (window, "main")`). `restore-window` comes once
per saved window, in order; the shell places each re-created window where
its key was. `save` and `restore` carry app-wide state. The reason is
`restore` (same device), `continue` (from another device) or `recover`.
Keep the state small: URIs, the view, and unsaved text. It goes only to the
shell, which gives an app only its own state back, and travels to the
person's other devices end-to-end encrypted. Python apps use
`Suno_appkit.restore.enable(app, open_window)` with `AppWindow.restore_key`,
`save_state()`, `restore_state()` and `documents()` (`SUNOUI_API_LEVEL` 15).
Without Suno's shell nothing is saved and `Suno_restore_restore()` returns
`FALSE`. See ADR-055.

## Where C differs from Python

- **Refusals come when a part is shown.** C parts are filled in after they
  are made, so "at least two modes", "at least one control", "pairs or trios"
  are checked (as criticals) when the part is first shown.
- **Buttons are always built.** C can't know at build time whether a signal
  will be connected, so Add, Directions and Play on the mini cards are always
  there (`Suno_event_card_set_add_label(card, NULL)` hides Add).
- **Menus.** The sidebar foot's filter menu is a `SunoFloatingMenu` with the
  counts as row notes; the corner pill's More is a `GtkPopoverMenu` from the
  `GMenuModel` on a computer and the menu drawer at phone width. Menu rows run
  their `GAction` on the control the menu opened from. An open floating menu
  holds itself; it goes when it closes.
- **SidebarFoot** emits `search-changed` after the typing pause (180 ms).
- **Not in C yet:** SidebarToggle's `closed=` callback, DetailsItem's `when=`,
  the editable FactRow, `BarEntry`, and the live chip's `detail` and `update()`.

## Parity

Suno’s platform tests build each part twice, from `SunoUI` (C, through GObject
introspection) and from `Suno_appkit` (Python), with the same content. They walk
both widget trees and compare every node’s CSS name, classes and visibility:
fresh, then in a 1000 px window, then at 400 px. A part whose trees differ fails
the platform’s tests, so the C and Python parts look the same in your app.

## Building against SunoUI-1

The headers, `pkg-config` files and GIR data come in the
`Suno-developer-platform-devel` package. Inside Flatpak, the
`org.projectSuno.Sdk//44` runtime provides them. Build with Meson:

```meson
Suno_ui = dependency('Suno-ui-1', version: '>= 0.1.0')
```

`Suno-ui-1` brings in GTK 4, libadwaita and `Suno-semantics-1` through its
`Requires`. See
[your first app in C](../getting-started/first-app-c.md) for a complete example.
