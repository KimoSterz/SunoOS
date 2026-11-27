/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-media-transport-lcd.h"
#include "Suno-ui-private.h"

struct _SunoMediaTransportLcd {
  GtkBox parent_instance;
  GtkWidget *start;
  GtkWidget *play;
  GtkWidget *record;
  GtkWidget *loop;
  GtkWidget *bar;
  GtkWidget *time;
  GtkWidget *readouts[3];
  GtkWidget *separator;
  gboolean playing;
  gboolean recording;
  gboolean looping;
};

G_DEFINE_FINAL_TYPE(SunoMediaTransportLcd, Suno_media_transport_lcd, GTK_TYPE_BOX)

enum { PLAY_CHANGED, RECORD_CHANGED, LOOP_CHANGED, SEEK_START, READOUT_ACTIVATED, N_SIGNALS };
static guint signals[N_SIGNALS];
static const char *const keys[] = {"tempo", "signature", "key"};
static const char *const captions[] = {"BPM", "Time signature", "Key"};

GtkWidget *Suno_media_readout_new(const char *value, const char *caption) {
  GtkWidget *button = gtk_button_new();
  GtkWidget *stack = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  GtkWidget *number = gtk_label_new("");
  GtkWidget *label = gtk_label_new(caption != NULL ? caption : "");
  gtk_widget_add_css_class(button, "SunoUI-media-readout");
  gtk_widget_add_css_class(number, "value");
  gtk_widget_add_css_class(label, "caption");
  gtk_box_append(GTK_BOX(stack), number);
  gtk_box_append(GTK_BOX(stack), label);
  gtk_button_set_child(GTK_BUTTON(button), stack);
  g_object_set_data(G_OBJECT(button), "SunoUI-readout-value", number);
  g_object_set_data_full(G_OBJECT(button), "SunoUI-readout-caption", g_strdup(caption != NULL ? caption : ""), g_free);
  Suno_media_readout_set_value(button, value);
  return button;
}

void Suno_media_readout_set_value(GtkWidget *self, const char *value) {
  g_return_if_fail(GTK_IS_BUTTON(self));
  GtkWidget *number = g_object_get_data(G_OBJECT(self), "SunoUI-readout-value");
  g_return_if_fail(GTK_IS_LABEL(number));
  gtk_label_set_text(GTK_LABEL(number), value != NULL ? value : "");
  const char *caption = g_object_get_data(G_OBJECT(self), "SunoUI-readout-caption");
  g_autofree char *name = g_strdup_printf("%s: %s", caption, value != NULL ? value : "");
  Suno_ui_set_accessible_label(self, name);
}

void Suno_media_readout_set_chip(GtkWidget *self, gboolean chip) {
  g_return_if_fail(GTK_IS_BUTTON(self));
  g_return_if_fail(g_object_get_data(G_OBJECT(self), "SunoUI-readout-value") != NULL);
  Suno_ui_set_css_class(self, "chip", chip);
}

static GtkWidget *key_button(const char *glyph, const char *label) {
  GtkWidget *button = gtk_button_new();
  gtk_button_set_child(GTK_BUTTON(button), Suno_ui_icon_image(glyph, 18));
  gtk_widget_add_css_class(button, "SunoUI-media-key");
  gtk_widget_set_tooltip_text(button, label);
  Suno_ui_set_accessible_label(button, label);
  return button;
}

static GtkWidget *lcd_cell(const char *caption, GtkWidget **value_out) {
  GtkWidget *cell = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  GtkWidget *value = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  GtkWidget *label = gtk_label_new("");
  GtkWidget *small = gtk_label_new(caption);
  gtk_widget_add_css_class(cell, "cell");
  gtk_widget_add_css_class(value, "value");
  gtk_widget_add_css_class(small, "caption");
  gtk_box_append(GTK_BOX(value), label);
  gtk_box_append(GTK_BOX(cell), value);
  gtk_box_append(GTK_BOX(cell), small);
  *value_out = label;
  return cell;
}

static void seek_start_clicked(GtkButton *button G_GNUC_UNUSED, gpointer data) {
  g_signal_emit(data, signals[SEEK_START], 0);
}

static void play_clicked(GtkButton *button G_GNUC_UNUSED, gpointer data) {
  SunoMediaTransportLcd *self = data;
  Suno_media_transport_lcd_set_playing(self, !self->playing);
  g_signal_emit(self, signals[PLAY_CHANGED], 0, self->playing);
}

static void record_clicked(GtkButton *button G_GNUC_UNUSED, gpointer data) {
  SunoMediaTransportLcd *self = data;
  Suno_media_transport_lcd_set_recording(self, !self->recording);
  g_signal_emit(self, signals[RECORD_CHANGED], 0, self->recording);
}

static void loop_clicked(GtkButton *button G_GNUC_UNUSED, gpointer data) {
  SunoMediaTransportLcd *self = data;
  Suno_media_transport_lcd_set_looping(self, !self->looping);
  g_signal_emit(self, signals[LOOP_CHANGED], 0, self->looping);
}

static void readout_clicked(GtkButton *button, gpointer data) {
  SunoMediaTransportLcd *self = data;
  for (guint i = 0; i < G_N_ELEMENTS(keys); i++)
    if (GTK_WIDGET(button) == self->readouts[i]) {
      g_signal_emit(self, signals[READOUT_ACTIVATED], 0, keys[i]);
      return;
    }
}

static void width_changed(GtkWidget *widget, int width, gpointer data G_GNUC_UNUSED) {
  SunoMediaTransportLcd *self = SUNO_MEDIA_TRANSPORT_LCD(widget);
  gboolean phone = width > 0 && width <= 600;
  for (guint i = 0; i < G_N_ELEMENTS(keys); i++)
    gtk_widget_set_visible(self->readouts[i], !phone);
  gtk_widget_set_visible(self->separator, !phone);
  gtk_widget_set_visible(self->loop, !phone);
  Suno_ui_set_css_class(widget, "phone", phone);
}

static void Suno_media_transport_lcd_class_init(SunoMediaTransportLcdClass *klass) {
  GType type = G_TYPE_FROM_CLASS(klass);
  signals[PLAY_CHANGED] = g_signal_new("play-changed", type, G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                       G_TYPE_NONE, 1, G_TYPE_BOOLEAN);
  signals[RECORD_CHANGED] = g_signal_new("record-changed", type, G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                         G_TYPE_NONE, 1, G_TYPE_BOOLEAN);
  signals[LOOP_CHANGED] = g_signal_new("loop-changed", type, G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                       G_TYPE_NONE, 1, G_TYPE_BOOLEAN);
  signals[SEEK_START] = g_signal_new("seek-start", type, G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                     G_TYPE_NONE, 0);
  signals[READOUT_ACTIVATED] = g_signal_new("readout-activated", type, G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                            G_TYPE_NONE, 1, G_TYPE_STRING);
}

static void Suno_media_transport_lcd_init(SunoMediaTransportLcd *self) {
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_HORIZONTAL);
  gtk_accessible_update_property(GTK_ACCESSIBLE(self), GTK_ACCESSIBLE_PROPERTY_LABEL, "Playback", -1);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-media-transport");
  gtk_widget_add_css_class(GTK_WIDGET(self), "lcd");

  GtkWidget *controls = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(controls, "SunoUI-media-keys");
  GtkWidget *start = key_button("skip-back", "Back to start");
  self->start = start;
  self->play = key_button("play", "Play");
  gtk_widget_add_css_class(self->play, "SunoUI-media-play");
  self->record = gtk_button_new();
  gtk_widget_add_css_class(self->record, "SunoUI-media-record");
  GtkWidget *dot = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(dot, "dot");
  gtk_widget_set_halign(dot, GTK_ALIGN_CENTER);
  gtk_widget_set_valign(dot, GTK_ALIGN_CENTER);
  gtk_widget_set_can_target(dot, FALSE);
  gtk_button_set_child(GTK_BUTTON(self->record), dot);
  Suno_ui_set_accessible_label(self->record, "Record");
  gtk_widget_set_tooltip_text(self->record, "Record");
  gtk_box_append(GTK_BOX(controls), start);
  gtk_box_append(GTK_BOX(controls), self->play);
  gtk_box_append(GTK_BOX(controls), self->record);
  gtk_box_append(GTK_BOX(self), controls);
  g_signal_connect(start, "clicked", G_CALLBACK(seek_start_clicked), self);
  g_signal_connect(self->play, "clicked", G_CALLBACK(play_clicked), self);
  g_signal_connect(self->record, "clicked", G_CALLBACK(record_clicked), self);

  GtkWidget *lcd = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(lcd, "SunoUI-media-lcd");
  gtk_box_append(GTK_BOX(lcd), lcd_cell("Bar", &self->bar));
  gtk_box_append(GTK_BOX(lcd), lcd_cell("Time", &self->time));
  gtk_box_append(GTK_BOX(self), lcd);

  for (guint i = 0; i < G_N_ELEMENTS(keys); i++) {
    GtkWidget *button = Suno_media_readout_new("", captions[i]);
    gtk_box_append(GTK_BOX(self), button);
    self->readouts[i] = button;
    Suno_media_transport_lcd_set_readout(self, keys[i], "");
    g_signal_connect(button, "clicked", G_CALLBACK(readout_clicked), self);
  }

  self->separator = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(self->separator, "SunoUI-media-separator");
  gtk_box_append(GTK_BOX(self), self->separator);
  self->loop = key_button("repeat", "Loop");
  gtk_widget_add_css_class(self->loop, "toggle");
  gtk_box_append(GTK_BOX(self), self->loop);
  g_signal_connect(self->loop, "clicked", G_CALLBACK(loop_clicked), self);
  Suno_media_transport_lcd_set_lcd(self, "", "");
  Suno_ui_width_watch(GTK_WIDGET(self), width_changed, NULL, 600);
}

GtkWidget *Suno_media_transport_lcd_new(void) {
  return g_object_new(SUNO_TYPE_MEDIA_TRANSPORT_LCD, NULL);
}

void Suno_media_transport_lcd_set_lcd(SunoMediaTransportLcd *self, const char *bar, const char *time) {
  g_return_if_fail(SUNO_IS_MEDIA_TRANSPORT_LCD(self));
  gtk_label_set_text(GTK_LABEL(self->bar), bar != NULL ? bar : "");
  gtk_label_set_text(GTK_LABEL(self->time), time != NULL ? time : "");
}

void Suno_media_transport_lcd_set_readout(SunoMediaTransportLcd *self, const char *key, const char *value) {
  g_return_if_fail(SUNO_IS_MEDIA_TRANSPORT_LCD(self));
  for (guint i = 0; i < G_N_ELEMENTS(keys); i++)
    if (g_strcmp0(key, keys[i]) == 0) {
      Suno_media_readout_set_value(self->readouts[i], value);
      return;
    }
  g_warning("Unknown media transport readout: %s", key != NULL ? key : "(null)");
}

void Suno_media_transport_lcd_set_playing(SunoMediaTransportLcd *self, gboolean playing) {
  g_return_if_fail(SUNO_IS_MEDIA_TRANSPORT_LCD(self));
  self->playing = !!playing;
  gtk_button_set_child(GTK_BUTTON(self->play), Suno_ui_icon_image(self->playing ? "pause" : "play", 18));
  Suno_ui_set_accessible_label(self->play, self->playing ? "Pause" : "Play");
  gtk_widget_set_tooltip_text(self->play, self->playing ? "Pause" : "Play");
}

void Suno_media_transport_lcd_set_recording(SunoMediaTransportLcd *self, gboolean recording) {
  g_return_if_fail(SUNO_IS_MEDIA_TRANSPORT_LCD(self));
  self->recording = !!recording;
  Suno_ui_set_css_class(self->record, "on", self->recording);
  gtk_accessible_update_state(GTK_ACCESSIBLE(self->record), GTK_ACCESSIBLE_STATE_PRESSED, self->recording, -1);
}

void Suno_media_transport_lcd_set_looping(SunoMediaTransportLcd *self, gboolean looping) {
  g_return_if_fail(SUNO_IS_MEDIA_TRANSPORT_LCD(self));
  self->looping = !!looping;
  Suno_ui_set_css_class(self->loop, "on", self->looping);
  gtk_accessible_update_state(GTK_ACCESSIBLE(self->loop), GTK_ACCESSIBLE_STATE_PRESSED, self->looping, -1);
}

GtkWidget *Suno_media_transport_lcd_get_control(SunoMediaTransportLcd *self, const char *key) {
  g_return_val_if_fail(SUNO_IS_MEDIA_TRANSPORT_LCD(self), NULL);
  if (g_strcmp0(key, "start") == 0) return self->start;
  if (g_strcmp0(key, "play") == 0) return self->play;
  if (g_strcmp0(key, "record") == 0) return self->record;
  if (g_strcmp0(key, "loop") == 0) return self->loop;
  for (guint i = 0; i < G_N_ELEMENTS(keys); i++)
    if (g_strcmp0(key, keys[i]) == 0) return self->readouts[i];
  return NULL;
}
