/* SPDX-License-Identifier: Apache-2.0 */
/* SunoMediaRow: the three densities' geometry from the tokens, what a row
 * without a player or artwork shows, the person's presses and keys, and a
 * regular row stacking when it is narrow. */
#include "Suno-ui.h"

#include <math.h>

static gboolean stop(gpointer data) {
  *(gboolean *)data = TRUE;
  return G_SOURCE_REMOVE;
}

static void wait_ms(guint ms) {
  gboolean done = FALSE;
  g_timeout_add(ms, stop, &done);
  while (!done)
    g_main_context_iteration(NULL, TRUE);
}

static gboolean press(GtkWidget *widget, guint keyval) {
  GListModel *list = gtk_widget_observe_controllers(widget);
  gboolean handled = FALSE;
  for (guint i = 0; i < g_list_model_get_n_items(list); i++) {
    g_autoptr(GObject) item = g_list_model_get_item(list, i);
    if (GTK_IS_EVENT_CONTROLLER_KEY(item))
      g_signal_emit_by_name(item, "key-pressed", keyval, 0, 0, &handled);
  }
  g_object_unref(list);
  return handled;
}

/* A primary press on @widget's own click gesture. */
static void click(GtkWidget *widget) {
  GListModel *list = gtk_widget_observe_controllers(widget);
  for (guint i = 0; i < g_list_model_get_n_items(list); i++) {
    g_autoptr(GObject) item = g_list_model_get_item(list, i);
    if (GTK_IS_GESTURE_CLICK(item))
      g_signal_emit_by_name(item, "pressed", 1, 1.0, 1.0);
  }
  g_object_unref(list);
}

static graphene_rect_t bounds(GtkWidget *child, GtkWidget *row) {
  graphene_rect_t rect;
  g_assert_true(gtk_widget_compute_bounds(child, row, &rect));
  return rect;
}

static GtkWidget *find(GtkWidget *root, const char *css_class) {
  if (gtk_widget_has_css_class(root, css_class))
    return root;
  for (GtkWidget *child = gtk_widget_get_first_child(root); child; child = gtk_widget_get_next_sibling(child)) {
    GtkWidget *found = find(child, css_class);
    if (found)
      return found;
  }
  return NULL;
}

typedef struct {
  int raise, play, previous, next, mutes, volumes;
  gboolean muted;
  double volume;
} Heard;

static void on_raise(SunoMediaRow *row G_GNUC_UNUSED, Heard *heard) { heard->raise++; }
static void on_play(SunoMediaRow *row G_GNUC_UNUSED, Heard *heard) { heard->play++; }
static void on_previous(SunoMediaRow *row G_GNUC_UNUSED, Heard *heard) { heard->previous++; }
static void on_next(SunoMediaRow *row G_GNUC_UNUSED, Heard *heard) { heard->next++; }
static void on_mute(SunoMediaRow *row G_GNUC_UNUSED, gboolean muted, Heard *heard) {
  heard->mutes++;
  heard->muted = muted;
}
static void on_volume(SunoMediaRow *row G_GNUC_UNUSED, double volume, Heard *heard) {
  heard->volumes++;
  heard->volume = volume;
}

static GtkWidget *row_in_window(GtkWidget **window, int width) {
  *window = gtk_window_new();
  GtkWidget *row = Suno_media_row_new();
  gtk_widget_set_valign(row, GTK_ALIGN_START);
  gtk_window_set_default_size(GTK_WINDOW(*window), width, 400);
  gtk_window_set_child(GTK_WINDOW(*window), row);
  return row;
}

static GdkPaintable *artwork(void) {
  static const guint8 pixels[4 * 4 * 4] = {0};
  g_autoptr(GBytes) bytes = g_bytes_new_static(pixels, sizeof pixels);
  return GDK_PAINTABLE(gdk_memory_texture_new(4, 4, GDK_MEMORY_R8G8B8A8, bytes, 16));
}

/* A card's block: 44 | 1fr | auto, 16 px in, the keys over the picker. */
static void test_regular(void) {
  GtkWidget *window, *widget = row_in_window(&window, 720);
  SunoMediaRow *row = SUNO_MEDIA_ROW(widget);
  g_autoptr(GIcon) icon = g_themed_icon_new("SunoUI-volume-2-symbolic");
  g_autoptr(GdkPaintable) art = artwork();
  Suno_media_row_set_title(row, "God Only Knows");
  Suno_media_row_set_line(row, "Tide · The Beach Boys");
  Suno_media_row_set_app(row, "Tide", icon);
  Suno_media_row_set_art(row, art);
  Suno_media_row_set_transport(row, SUNO_MEDIA_ROW_PLAY_PAUSE | SUNO_MEDIA_ROW_PREVIOUS | SUNO_MEDIA_ROW_NEXT);
  Suno_media_row_set_playing(row, TRUE);
  Suno_media_row_set_meter_segments(row, 28);
  GtkWidget *chip = Suno_media_row_chip_new("SunoUI-volume-2-symbolic", "Speakers");
  Suno_media_row_set_trailing(row, chip);
  gtk_window_present(GTK_WINDOW(window));
  wait_ms(150);

  g_assert_true(gtk_widget_has_css_class(widget, "regular"));
  g_assert_false(gtk_widget_has_css_class(widget, "paused"));
  g_assert_false(gtk_widget_has_css_class(widget, "stacked"));
  g_assert_cmpint(gtk_accessible_get_accessible_role(GTK_ACCESSIBLE(widget)), ==, GTK_ACCESSIBLE_ROLE_GROUP);
  int width = gtk_widget_get_width(widget);

  graphene_rect_t art_box = bounds(Suno_media_row_get_art_widget(row), widget);
  g_assert_cmpfloat(art_box.origin.x, ==, 16);
  g_assert_cmpfloat(art_box.origin.y, ==, 16 + 2);
  g_assert_cmpfloat(art_box.size.width, ==, 44);
  g_assert_cmpfloat(art_box.size.height, ==, 44);
  /* The badge hangs 5 px off the artwork's corner. */
  graphene_rect_t badge = bounds(Suno_media_row_get_badge_widget(row), widget);
  g_assert_cmpfloat(badge.size.width, ==, 20);
  g_assert_cmpfloat(badge.origin.x + badge.size.width, ==, art_box.origin.x + 44 + 5);
  g_assert_cmpfloat(badge.origin.y + badge.size.height, ==, art_box.origin.y + 44 + 5);

  /* The words start 14 px after the artwork, at the block's top. */
  graphene_rect_t title = bounds(find(widget, "SunoUI-media-row-title"), widget);
  g_assert_cmpfloat(title.origin.x, ==, 16 + 44 + 14);
  g_assert_cmpfloat(title.origin.y, ==, 16);

  /* The play key is the 42 px raised one between two 36 px keys. */
  GtkWidget *play = Suno_media_row_get_play_button(row);
  graphene_rect_t play_box = bounds(play, widget);
  g_assert_true(gtk_widget_has_css_class(play, "play"));
  g_assert_cmpfloat(play_box.size.width, ==, 42);
  g_assert_cmpfloat(play_box.size.height, ==, 42);
  g_assert_cmpfloat(play_box.origin.y, ==, 16);
  g_assert_cmpstr(gtk_button_get_icon_name(GTK_BUTTON(play)), ==, "SunoUI-pause-filled-symbolic");
  graphene_rect_t keys = bounds(gtk_widget_get_parent(play), widget);
  g_assert_cmpfloat(keys.size.width, ==, 36 + 2 + 42 + 2 + 36);
  /* The keys start the third column and the picker ends it. */
  graphene_rect_t chip_box = bounds(chip, widget);
  g_assert_cmpfloat(chip_box.size.height, ==, 28);
  g_assert_cmpfloat(chip_box.origin.x + chip_box.size.width, ==, width - 16);
  g_assert_cmpfloat(keys.origin.x, ==, width - 16 - MAX(keys.size.width, chip_box.size.width));

  /* The volume line: glyph, 10 px, slider, 10 px, a readout at least 38 px. */
  graphene_rect_t glyph = bounds(find(widget, "SunoUI-media-row-volume"), widget);
  graphene_rect_t slider = bounds(GTK_WIDGET(Suno_media_row_get_slider(row)), widget);
  graphene_rect_t readout = bounds(find(widget, "SunoUI-media-row-readout"), widget);
  g_assert_cmpfloat(glyph.origin.x, ==, title.origin.x);
  g_assert_cmpfloat(glyph.size.width, ==, 15);
  /* The track, not the knob's overhang, sits on the line's columns. */
  graphene_rect_t track;
  Suno_volume_slider_get_track_bounds(Suno_media_row_get_slider(row), &track);
  g_assert_cmpfloat(slider.origin.x + track.origin.x, ==, glyph.origin.x + 15 + 10);
  g_assert_cmpfloat(readout.origin.x, ==, slider.origin.x + track.origin.x + track.size.width + 10);
  g_assert_cmpfloat(readout.size.width, >=, 38);
  /* The row of the slider is the picker's 28 px, 10 px under the keys. */
  g_assert_cmpfloat(chip_box.origin.y, ==, 16 + 42 + 10);
  g_assert_cmpfloat(slider.origin.y + slider.size.height / 2, ==, chip_box.origin.y + 14);

  /* The meter: 28 segments under the slider, over exactly its length. */
  SunoAudioMeter *meter = Suno_media_row_get_meter(row);
  g_assert_nonnull(meter);
  g_assert_cmpuint(Suno_audio_meter_get_segments(meter), ==, 28);
  g_assert_true(Suno_audio_meter_get_horizontal(meter));
  /* An output's level: 3 px segments 2 px apart, 1.5 px round, one colour. */
  double thickness, gap, radius;
  Suno_audio_meter_get_segment_shape(meter, &thickness, &gap, &radius);
  g_assert_cmpfloat(thickness, ==, 3);
  g_assert_cmpfloat(gap, ==, 2);
  g_assert_cmpfloat(radius, ==, 1.5);
  g_assert_false(Suno_audio_meter_get_zones(meter));
  g_assert_cmpint(gtk_widget_get_height(GTK_WIDGET(meter)), ==, 3);
  graphene_rect_t meter_box = bounds(GTK_WIDGET(meter), widget);
  g_assert_cmpfloat(meter_box.origin.x, ==, slider.origin.x + track.origin.x);
  g_assert_cmpfloat(meter_box.size.width, ==, track.size.width);
  g_assert_cmpfloat(meter_box.origin.y, ==, chip_box.origin.y + 28 + 6);
  /* The meter lies in the 10 px row gap under the volume line; 15 px close the block. */
  g_assert_cmpint(gtk_widget_get_height(widget), ==, (int)(chip_box.origin.y + 28 + 10) + 15);

  /* The service's meter position reaches the meter; paused, it rests. */
  Suno_media_row_set_level(row, 1.0);
  g_assert_cmpfloat(Suno_audio_meter_get_level_db(meter, 0), ==, 0);
  Suno_media_row_set_level(row, 0.5);
  Suno_media_row_set_playing(row, FALSE);
  Suno_media_row_set_level(row, 1.0);
  g_assert_cmpstr(gtk_button_get_icon_name(GTK_BUTTON(play)), ==, "SunoUI-play-filled-symbolic");
  if (Suno_ui_reduced_motion())
    g_assert_cmpfloat(Suno_audio_meter_get_level_db(meter, 0), ==, -60);
  g_assert_true(gtk_widget_has_css_class(widget, "paused"));

  /* The level glyph shows only while sound is coming out. */
  GtkWidget *level = gtk_widget_get_first_child(find(widget, "SunoUI-media-row-line"));
  g_assert_cmpstr(gtk_widget_get_css_name(level), ==, "SunoUI-media-row-level");
  g_assert_false(gtk_widget_get_visible(level));
  Suno_media_row_set_playing(row, TRUE);
  Suno_media_row_set_sounding(row, TRUE);
  g_assert_true(gtk_widget_get_visible(level));
  Suno_media_row_set_playing(row, FALSE);
  g_assert_false(gtk_widget_get_visible(level));
  gtk_window_destroy(GTK_WINDOW(window));
}

/* What the person does, and nothing the setters do. */
static void test_person(void) {
  GtkWidget *window, *widget = row_in_window(&window, 720);
  SunoMediaRow *row = SUNO_MEDIA_ROW(widget);
  Heard heard = {0};
  g_signal_connect(row, "raise", G_CALLBACK(on_raise), &heard);
  g_signal_connect(row, "play-pause", G_CALLBACK(on_play), &heard);
  g_signal_connect(row, "previous", G_CALLBACK(on_previous), &heard);
  g_signal_connect(row, "next", G_CALLBACK(on_next), &heard);
  g_signal_connect(row, "mute-toggled", G_CALLBACK(on_mute), &heard);
  g_signal_connect(row, "volume-changed", G_CALLBACK(on_volume), &heard);
  g_autoptr(GIcon) icon = g_themed_icon_new("SunoUI-volume-2-symbolic");
  Suno_media_row_set_title(row, "A song");
  Suno_media_row_set_app(row, "Player", icon);
  Suno_media_row_set_transport(row, SUNO_MEDIA_ROW_PLAY_PAUSE | SUNO_MEDIA_ROW_NEXT);
  Suno_media_row_set_volume(row, 60);
  Suno_media_row_set_muted(row, TRUE);
  Suno_media_row_set_muted(row, FALSE);
  Suno_media_row_set_playing(row, TRUE);
  gtk_window_present(GTK_WINDOW(window));
  wait_ms(150);
  g_assert_cmpint(heard.raise + heard.play + heard.mutes + heard.volumes, ==, 0);
  g_assert_cmpfloat(Suno_media_row_get_volume(row), ==, 60);

  /* The artwork: the first press shows the app, the second mutes. */
  GtkWidget *art = Suno_media_row_get_art_widget(row);
  click(art);
  g_assert_cmpint(heard.raise, ==, 1);
  g_assert_cmpint(heard.mutes, ==, 0);
  click(art);
  g_assert_cmpint(heard.raise, ==, 1);
  g_assert_cmpint(heard.mutes, ==, 1);
  g_assert_true(heard.muted);
  /* The row does not mute itself: its owner does, and then it says so. */
  g_assert_false(Suno_media_row_get_muted(row));
  Suno_media_row_set_muted(row, TRUE);
  g_assert_true(gtk_widget_has_css_class(widget, "muted"));
  g_assert_true(Suno_volume_slider_get_muted(Suno_media_row_get_slider(row)));
  g_assert_cmpfloat(Suno_media_row_get_volume(row), ==, 60);
  /* The badge mutes at once. */
  click(Suno_media_row_get_badge_widget(row));
  g_assert_cmpint(heard.mutes, ==, 2);
  g_assert_false(heard.muted);

  /* Keys: M mutes, Space plays or pauses, the slider moves by 5. */
  g_assert_true(press(widget, GDK_KEY_m));
  g_assert_cmpint(heard.mutes, ==, 3);
  g_assert_true(press(widget, GDK_KEY_space));
  g_assert_cmpint(heard.play, ==, 1);
  /* OK on a remote is Return. */
  g_assert_true(press(widget, GDK_KEY_Return));
  g_assert_cmpint(heard.play, ==, 2);
  heard.play = 1;
  GtkWidget *slider = GTK_WIDGET(Suno_media_row_get_slider(row));
  g_assert_true(press(slider, GDK_KEY_Right));
  g_assert_cmpfloat(Suno_media_row_get_volume(row), ==, 65);
  g_assert_cmpint(heard.volumes, ==, 1);
  g_assert_cmpfloat(heard.volume, ==, 65);
  g_assert_true(press(slider, GDK_KEY_Left));
  g_assert_true(press(slider, GDK_KEY_Left));
  g_assert_cmpfloat(Suno_media_row_get_volume(row), ==, 55);
  /* Up and Down are left for moving between rows. */
  g_assert_false(press(slider, GDK_KEY_Up));
  g_assert_false(press(slider, GDK_KEY_Down));
  /* Focus goes to the slider. */
  g_assert_true(gtk_widget_grab_focus(widget));
  g_assert_true(gtk_widget_has_focus(slider));

  g_signal_emit_by_name(Suno_media_row_get_play_button(row), "clicked");
  g_assert_cmpint(heard.play, ==, 2);
  /* A key the player does not offer is not there. */
  GtkWidget *keys = gtk_widget_get_parent(Suno_media_row_get_play_button(row));
  g_assert_false(gtk_widget_get_visible(gtk_widget_get_first_child(keys)));
  g_assert_true(gtk_widget_get_visible(gtk_widget_get_last_child(keys)));
  g_signal_emit_by_name(gtk_widget_get_last_child(keys), "clicked");
  g_assert_cmpint(heard.next, ==, 1);
  g_assert_cmpint(heard.previous, ==, 0);
  gtk_window_destroy(GTK_WINDOW(window));
}

/* An app without a player or artwork: its icon on a tile, its name, a
 * slider, and no transport. Space then does nothing. */
static void test_without_player(void) {
  GtkWidget *window, *widget = row_in_window(&window, 720);
  SunoMediaRow *row = SUNO_MEDIA_ROW(widget);
  Heard heard = {0};
  g_signal_connect(row, "play-pause", G_CALLBACK(on_play), &heard);
  g_autoptr(GIcon) icon = g_themed_icon_new("SunoUI-volume-2-symbolic");
  Suno_media_row_set_title(row, "Game");
  Suno_media_row_set_app(row, "Game", icon);
  Suno_media_row_set_playing(row, TRUE);
  gtk_window_present(GTK_WINDOW(window));
  wait_ms(150);
  g_assert_false(Suno_media_row_get_has_art(row));
  g_assert_true(gtk_widget_has_css_class(Suno_media_row_get_art_widget(row), "tile"));
  g_assert_cmpint(Suno_media_row_get_transport(row), ==, SUNO_MEDIA_ROW_NO_TRANSPORT);
  g_assert_false(gtk_widget_get_visible(Suno_media_row_get_play_button(row)));
  g_assert_false(gtk_widget_get_visible(gtk_widget_get_parent(Suno_media_row_get_play_button(row))));
  g_assert_false(gtk_widget_get_visible(find(widget, "SunoUI-media-row-line")));
  g_assert_true(gtk_widget_get_visible(GTK_WIDGET(Suno_media_row_get_slider(row))));
  g_assert_false(press(widget, GDK_KEY_space));
  g_assert_cmpint(heard.play, ==, 0);
  /* Without keys or a picker the words and the slider run to the end. */
  graphene_rect_t readout = bounds(find(widget, "SunoUI-media-row-readout"), widget);
  g_assert_cmpfloat(readout.origin.x + readout.size.width, ==, gtk_widget_get_width(widget) - 16);
  /* Artwork replaces the tile; taking it away brings the tile back. */
  g_autoptr(GdkPaintable) art = artwork();
  Suno_media_row_set_art(row, art);
  g_assert_true(Suno_media_row_get_has_art(row));
  g_assert_false(gtk_widget_has_css_class(Suno_media_row_get_art_widget(row), "tile"));
  Suno_media_row_set_art(row, NULL);
  g_assert_true(gtk_widget_has_css_class(Suno_media_row_get_art_widget(row), "tile"));
  gtk_window_destroy(GTK_WINDOW(window));
}

/* A row in a panel's well: 40 px artwork, the slider under the words, one
 * 32 px round key; under a finger a 64 px box of 44 px artwork with a 44 px key. */
static void test_compact_and_touch(void) {
  GtkWidget *window, *widget = row_in_window(&window, 340);
  SunoMediaRow *row = SUNO_MEDIA_ROW(widget);
  g_autoptr(GIcon) icon = g_themed_icon_new("SunoUI-volume-2-symbolic");
  g_autoptr(GdkPaintable) art = artwork();
  Suno_media_row_set_density(row, SUNO_MEDIA_ROW_COMPACT);
  Suno_media_row_set_title(row, "Restoring a 1978 studio synth, part two of a long series");
  Suno_media_row_set_line(row, "YouTube · on WH-1000XM5");
  Suno_media_row_set_app(row, "YouTube", icon);
  Suno_media_row_set_art(row, art);
  Suno_media_row_set_transport(row, SUNO_MEDIA_ROW_PLAY_PAUSE | SUNO_MEDIA_ROW_PREVIOUS | SUNO_MEDIA_ROW_NEXT);
  Suno_media_row_set_meter_segments(row, 28);
  Suno_media_row_set_trailing(row, Suno_media_row_chip_new("SunoUI-headphones-symbolic", "WH-1000XM5"));
  gtk_window_present(GTK_WINDOW(window));
  wait_ms(150);
  g_assert_true(gtk_widget_has_css_class(widget, "compact"));
  g_assert_true(gtk_widget_has_css_class(widget, "paused"));
  int width = gtk_widget_get_width(widget), height = gtk_widget_get_height(widget);
  g_assert_cmpint(width, ==, 340);
  /* The row token: a 60 px box. */
  g_assert_cmpint(height, ==, 60);

  graphene_rect_t art_box = bounds(Suno_media_row_get_art_widget(row), widget);
  g_assert_cmpfloat(art_box.origin.x, ==, 6);
  g_assert_cmpfloat(art_box.size.width, ==, 40);
  g_assert_cmpfloat(art_box.origin.y, ==, (height - 40) / 2);
  graphene_rect_t badge = bounds(Suno_media_row_get_badge_widget(row), widget);
  g_assert_cmpfloat(badge.size.width, ==, 17);
  g_assert_cmpfloat(badge.origin.x + 17, ==, art_box.origin.x + 40 + 4);

  GtkWidget *play = Suno_media_row_get_play_button(row);
  graphene_rect_t play_box = bounds(play, widget);
  g_assert_cmpfloat(play_box.size.width, ==, 32);
  g_assert_cmpfloat(play_box.size.height, ==, 32);
  g_assert_cmpfloat(play_box.origin.x + 32, ==, width - 4);
  g_assert_cmpfloat(play_box.origin.y, ==, (height - 32) / 2);
  g_assert_cmpstr(gtk_button_get_icon_name(GTK_BUTTON(play)), ==, "SunoUI-play-symbolic");
  /* Only play/pause, no readout, glyph, meter or picker. */
  GtkWidget *keys = gtk_widget_get_parent(play);
  g_assert_false(gtk_widget_get_visible(gtk_widget_get_first_child(keys)));
  g_assert_false(gtk_widget_get_visible(gtk_widget_get_last_child(keys)));
  g_assert_false(gtk_widget_get_visible(find(widget, "SunoUI-media-row-readout")));
  g_assert_false(gtk_widget_get_visible(find(widget, "SunoUI-media-row-volume")));
  g_assert_false(gtk_widget_get_visible(GTK_WIDGET(Suno_media_row_get_meter(row))));
  g_assert_false(gtk_widget_get_visible(Suno_media_row_get_trailing(row)));

  /* A long title is cut, never widening the row. */
  graphene_rect_t title = bounds(find(widget, "SunoUI-media-row-title"), widget);
  g_assert_cmpfloat(title.origin.x, ==, 6 + 40 + 11);
  g_assert_cmpfloat(title.origin.x + title.size.width, <=, play_box.origin.x - 11);
  /* The compact slider: a 12 px knob in a 16 px slot, 3 px under the words, 6 px short of the key's gap. */
  SunoVolumeSlider *slider = Suno_media_row_get_slider(row);
  g_assert_true(Suno_volume_slider_get_compact(slider));
  graphene_rect_t slider_box = bounds(GTK_WIDGET(slider), widget);
  g_assert_cmpfloat(slider_box.size.height, ==, 16);
  graphene_rect_t track;
  Suno_volume_slider_get_track_bounds(slider, &track);
  g_assert_cmpfloat(track.size.height, ==, 4);
  g_assert_cmpfloat(track.origin.y, ==, 6);
  g_assert_cmpfloat(slider_box.origin.x + track.origin.x, ==, title.origin.x);
  g_assert_cmpfloat(slider_box.origin.x + track.origin.x + track.size.width, ==, play_box.origin.x - 11 - 6);

  Suno_media_row_set_density(row, SUNO_MEDIA_ROW_TOUCH);
  wait_ms(100);
  g_assert_true(gtk_widget_has_css_class(widget, "touch"));
  g_assert_cmpint(gtk_widget_get_height(widget), ==, 64);
  play_box = bounds(play, widget);
  g_assert_cmpfloat(play_box.size.width, ==, 44);
  g_assert_cmpfloat(play_box.size.height, ==, 44);
  graphene_rect_t touch_art = bounds(Suno_media_row_get_art_widget(row), widget);
  g_assert_cmpfloat(touch_art.size.width, ==, 44);
  g_assert_cmpfloat(touch_art.size.height, ==, 44);
  g_assert_cmpfloat(touch_art.origin.y, ==, 10);

  /* Back to a card's block: everything it has returns. */
  Suno_media_row_set_density(row, SUNO_MEDIA_ROW_REGULAR);
  wait_ms(100);
  g_assert_false(Suno_volume_slider_get_compact(slider));
  g_assert_true(gtk_widget_get_visible(find(widget, "SunoUI-media-row-readout")));
  g_assert_true(gtk_widget_get_visible(Suno_media_row_get_trailing(row)));
  gtk_window_destroy(GTK_WINDOW(window));
}

/* Narrow, a card's block stacks: the picker drops under the slider, full width. */
static void test_stacked(void) {
  GtkWidget *window, *widget = row_in_window(&window, 390);
  SunoMediaRow *row = SUNO_MEDIA_ROW(widget);
  g_autoptr(GIcon) icon = g_themed_icon_new("SunoUI-volume-2-symbolic");
  Suno_media_row_set_title(row, "Suno launch film");
  Suno_media_row_set_line(row, "Viola · simplyluma.com");
  Suno_media_row_set_app(row, "Viola", icon);
  Suno_media_row_set_transport(row, SUNO_MEDIA_ROW_PLAY_PAUSE);
  Suno_media_row_set_meter_segments(row, 28);
  GtkWidget *chip = Suno_media_row_chip_new("SunoUI-volume-2-symbolic", "Speakers");
  Suno_media_row_set_trailing(row, chip);
  gtk_window_present(GTK_WINDOW(window));
  wait_ms(150);
  int width = gtk_widget_get_width(widget);
  g_assert_cmpint(width, <, 440);
  g_assert_true(gtk_widget_has_css_class(widget, "stacked"));
  graphene_rect_t chip_box = bounds(chip, widget);
  graphene_rect_t meter = bounds(GTK_WIDGET(Suno_media_row_get_meter(row)), widget);
  graphene_rect_t readout = bounds(find(widget, "SunoUI-media-row-readout"), widget);
  g_assert_cmpfloat(chip_box.origin.x, ==, 16);
  g_assert_cmpfloat(chip_box.size.width, ==, width - 32);
  g_assert_cmpfloat(chip_box.origin.y, ==, meter.origin.y + meter.size.height + 10);
  /* The slider line runs to the block's end. */
  g_assert_cmpfloat(readout.origin.x + readout.size.width, ==, width - 16);
  g_assert_cmpint(gtk_widget_get_height(widget), ==, (int)(chip_box.origin.y + chip_box.size.height) + 15);
  /* Nothing is wider than the block. */
  int min, nat;
  gtk_widget_measure(widget, GTK_ORIENTATION_HORIZONTAL, -1, &min, &nat, NULL, NULL);
  g_assert_cmpint(min, <=, 320);

  /* The picker says whether its choice is the default one. */
  g_assert_false(gtk_widget_has_css_class(chip, "raised"));
  Suno_media_row_chip_set(chip, "SunoUI-headphones-symbolic", "WH-1000XM5", TRUE);
  g_assert_true(gtk_widget_has_css_class(chip, "raised"));
  gtk_window_destroy(GTK_WINDOW(window));
}

/* Right to left the block mirrors. */
static void test_rtl(void) {
  GtkWidget *window, *widget = row_in_window(&window, 720);
  SunoMediaRow *row = SUNO_MEDIA_ROW(widget);
  gtk_widget_set_direction(widget, GTK_TEXT_DIR_RTL);
  g_autoptr(GIcon) icon = g_themed_icon_new("SunoUI-volume-2-symbolic");
  Suno_media_row_set_title(row, "أغنية");
  Suno_media_row_set_app(row, "Tide", icon);
  Suno_media_row_set_transport(row, SUNO_MEDIA_ROW_PLAY_PAUSE);
  gtk_window_present(GTK_WINDOW(window));
  wait_ms(150);
  int width = gtk_widget_get_width(widget);
  graphene_rect_t art_box = bounds(Suno_media_row_get_art_widget(row), widget);
  g_assert_cmpfloat(art_box.origin.x + 44, ==, width - 16);
  graphene_rect_t badge = bounds(Suno_media_row_get_badge_widget(row), widget);
  g_assert_cmpfloat(badge.origin.x, ==, art_box.origin.x - 5);
  graphene_rect_t play = bounds(Suno_media_row_get_play_button(row), widget);
  g_assert_cmpfloat(play.origin.x, <, width / 2.0);
  gtk_window_destroy(GTK_WINDOW(window));
}

/* Up and Down step row by row, past whatever sits between the rows. */
static void test_siblings(void) {
  GtkWidget *window = gtk_window_new();
  GtkWidget *list = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  GtkWidget *rows[3];
  for (guint i = 0; i < 3; i++) {
    rows[i] = Suno_media_row_new();
    Suno_media_row_set_title(SUNO_MEDIA_ROW(rows[i]), "A song");
    Suno_media_row_set_transport(SUNO_MEDIA_ROW(rows[i]), SUNO_MEDIA_ROW_PLAY_PAUSE);
    Suno_media_row_set_trailing(SUNO_MEDIA_ROW(rows[i]), Suno_media_row_chip_new("SunoUI-volume-2-symbolic", "Speakers"));
    gtk_box_append(GTK_BOX(list), rows[i]);
    if (i < 2)
      gtk_box_append(GTK_BOX(list), gtk_separator_new(GTK_ORIENTATION_HORIZONTAL));
  }
  gtk_window_set_default_size(GTK_WINDOW(window), 720, 500);
  gtk_window_set_child(GTK_WINDOW(window), list);
  gtk_window_present(GTK_WINDOW(window));
  wait_ms(150);
  g_assert_true(gtk_widget_grab_focus(rows[0]));
  g_assert_true(Suno_media_row_focus_sibling(SUNO_MEDIA_ROW(rows[0]), GTK_DIR_DOWN));
  g_assert_true(gtk_widget_has_focus(GTK_WIDGET(Suno_media_row_get_slider(SUNO_MEDIA_ROW(rows[1])))));
  g_assert_true(Suno_media_row_focus_sibling(SUNO_MEDIA_ROW(rows[1]), GTK_DIR_DOWN));
  g_assert_true(gtk_widget_has_focus(GTK_WIDGET(Suno_media_row_get_slider(SUNO_MEDIA_ROW(rows[2])))));
  g_assert_false(Suno_media_row_focus_sibling(SUNO_MEDIA_ROW(rows[2]), GTK_DIR_DOWN));
  g_assert_true(Suno_media_row_focus_sibling(SUNO_MEDIA_ROW(rows[2]), GTK_DIR_UP));
  g_assert_true(gtk_widget_has_focus(GTK_WIDGET(Suno_media_row_get_slider(SUNO_MEDIA_ROW(rows[1])))));
  g_assert_false(Suno_media_row_focus_sibling(SUNO_MEDIA_ROW(rows[0]), GTK_DIR_UP));
  gtk_window_destroy(GTK_WINDOW(window));
}

int main(int argc, char **argv) {
  gtk_test_init(&argc, &argv, NULL);
  g_test_add_func("/SunoUI/media-row/regular", test_regular);
  g_test_add_func("/SunoUI/media-row/person", test_person);
  g_test_add_func("/SunoUI/media-row/without-player", test_without_player);
  g_test_add_func("/SunoUI/media-row/compact-and-touch", test_compact_and_touch);
  g_test_add_func("/SunoUI/media-row/stacked", test_stacked);
  g_test_add_func("/SunoUI/media-row/rtl", test_rtl);
  g_test_add_func("/SunoUI/media-row/siblings", test_siblings);
  return g_test_run();
}
