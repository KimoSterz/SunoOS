/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-mixer-strip.h"
#include "Suno-ui-private.h"
#include "Suno-ui-tokens-private.h"

#include <math.h>

#define WIDTH SUNO_UI_MIXER_STRIP_WIDTH
#define PADDING SUNO_UI_MIXER_STRIP_PADDING
#define CONTENT_WIDTH (WIDTH - 2 * PADDING)
#define STEP_DB 1.0
#define PAGE_DB 6.0

struct _SunoMixerStrip {
  GtkWidget parent_instance;
  GtkWidget *content;
  GtkWidget *icon;
  GtkWidget *name;
  GtkWidget *device;
  GtkWidget *scale;
  GtkWidget *fader;
  GtkWidget *readout;
  GtkWidget *mute;
  GtkWidget *monitor;
  GtkWidget *keys;
  char *label;
  char *subtitle;
  gboolean muted, monitoring;
  gboolean syncing; /* a setter is moving a key: not the person */
};

enum { PROP_0, PROP_LABEL, PROP_SUBTITLE, PROP_DB, PROP_MUTED, PROP_MONITORING, PROP_GICON, PROP_MUTE_VISIBLE,
       PROP_MONITOR_VISIBLE, N_PROPS };
static GParamSpec *props[N_PROPS];
enum { MOVED, MUTE_TOGGLED, MONITOR_TOGGLED, N_SIGNALS };
static guint signals[N_SIGNALS];

G_DEFINE_FINAL_TYPE(SunoMixerStrip, Suno_mixer_strip, GTK_TYPE_WIDGET)

static double lower_db(SunoMixerStrip *self) {
  double lower, upper;
  Suno_volume_slider_get_range(SUNO_VOLUME_SLIDER(self->fader), &lower, &upper);
  return lower;
}

/* "−12.0 dB", "0.0 dB", "+3.5 dB"; the low end is silence, "−∞ dB". */
static char *db_text(double db, double lower, gboolean unit) {
  const char *suffix = unit ? " dB" : "";
  if (db <= lower + 0.05)
    return g_strdup_printf("−∞%s", suffix);
  if (fabs(db) < 0.05)
    return g_strdup_printf("0.0%s", suffix);
  return g_strdup_printf("%s%.1f%s", db > 0 ? "+" : "−", fabs(db), suffix);
}

static void show_value(SunoMixerStrip *self) {
  g_autofree char *text = db_text(Suno_mixer_strip_get_db(self), lower_db(self), TRUE);
  gtk_label_set_label(GTK_LABEL(self->readout), text);
}

/* ── the scale: dB ticks against the fader's knob travel ── */

static char *tick_text(double db, double lower) {
  if (db <= lower + 0.05)
    return g_strdup("−∞");
  if (fabs(db) < 0.05)
    return g_strdup("0");
  return g_strdup_printf("%s%.0f", db > 0 ? "+" : "−", fabs(db));
}

static void scale_draw(GtkDrawingArea *area, cairo_t *cr, int width, int height, gpointer data) {
  SunoMixerStrip *self = data;
  SunoVolumeSlider *fader = SUNO_VOLUME_SLIDER(self->fader);
  double lower, upper;
  Suno_volume_slider_get_range(fader, &lower, &upper);
  graphene_rect_t track;
  Suno_volume_slider_get_track_bounds(fader, &track);
  graphene_point_t top;
  if (track.size.height <= SUNO_UI_VOLUME_SLIDER_TRACK ||
      !gtk_widget_compute_point(self->fader, GTK_WIDGET(area), &GRAPHENE_POINT_INIT(0, track.origin.y), &top))
    return;
  /* The knob's centre travels from half a track in from one end to the other. */
  double y0 = top.y + SUNO_UI_VOLUME_SLIDER_TRACK / 2.0, span = track.size.height - SUNO_UI_VOLUME_SLIDER_TRACK;
  GdkRGBA ink;
  gtk_widget_get_color(GTK_WIDGET(area), &ink);
  /* The ends and 0 dB first, then the marks between while they have room. */
  const double marks[] = {-12, -24, -6, -36, -48, -18, 3, -3};
  double ticks[3 + G_N_ELEMENTS(marks)];
  guint n = 0;
  ticks[n++] = upper;
  if (lower < 0 && upper > 0)
    ticks[n++] = 0;
  ticks[n++] = lower;
  for (guint i = 0; i < G_N_ELEMENTS(marks); i++)
    if (marks[i] > lower + 1 && marks[i] < upper - 1)
      ticks[n++] = marks[i];
  double placed[G_N_ELEMENTS(ticks)];
  guint n_placed = 0;
  for (guint i = 0; i < n; i++) {
    double f = CLAMP((ticks[i] - lower) / (upper - lower), 0, 1);
    double y = round(y0 + (1 - f) * span);
    g_autofree char *text = tick_text(ticks[i], lower);
    PangoLayout *layout = gtk_widget_create_pango_layout(GTK_WIDGET(area), text);
    /* Numbers read left to right in any locale: "+6", never "6+". */
    pango_context_set_base_dir(pango_layout_get_context(layout), PANGO_DIRECTION_LTR);
    pango_layout_set_auto_dir(layout, FALSE);
    pango_layout_context_changed(layout);
    int tw, th;
    pango_layout_get_pixel_size(layout, &tw, &th);
    gboolean room = TRUE;
    for (guint j = 0; j < n_placed && room; j++)
      room = fabs(placed[j] - y) >= th;
    if (room) {
      placed[n_placed++] = y;
      gdk_cairo_set_source_rgba(cr, &ink);
      cairo_rectangle(cr, width - SUNO_UI_MIXER_STRIP_SCALE_TICK, y - 0.5, SUNO_UI_MIXER_STRIP_SCALE_TICK, 1);
      cairo_fill(cr);
      double x = width - SUNO_UI_MIXER_STRIP_SCALE_TICK - 1 - tw;
      double ty = CLAMP(y - th / 2.0, 0, MAX(0, height - th));
      cairo_move_to(cr, x, round(ty));
      pango_cairo_show_layout(cr, layout);
    }
    g_object_unref(layout);
  }
}

/* ── names and the accessible tree ── */

static void name_everything(SunoMixerStrip *self) {
  const char *label = self->label ? self->label : "";
  gtk_label_set_label(GTK_LABEL(self->name), label);
  gtk_widget_set_tooltip_text(self->name, *label ? label : NULL);
  gboolean has_device = self->subtitle && *self->subtitle;
  gtk_label_set_label(GTK_LABEL(self->device), has_device ? self->subtitle : "");
  /* Without a device the line stays, empty, so every strip's fader starts at the same height. */
  gtk_widget_set_tooltip_text(self->device, has_device ? self->subtitle : NULL);
  gtk_accessible_update_property(GTK_ACCESSIBLE(self), GTK_ACCESSIBLE_PROPERTY_LABEL, label, -1);
  if (has_device)
    gtk_accessible_update_property(GTK_ACCESSIBLE(self), GTK_ACCESSIBLE_PROPERTY_DESCRIPTION, self->subtitle, -1);
  else
    gtk_accessible_reset_property(GTK_ACCESSIBLE(self), GTK_ACCESSIBLE_PROPERTY_DESCRIPTION);
  g_autofree char *volume = g_strdup_printf("%s volume", label);
  g_autofree char *level = g_strdup_printf("%s level", label);
  g_autofree char *mute = g_strdup_printf("Mute %s", label);
  g_autofree char *monitor = g_strdup_printf("Monitor %s", label);
  Suno_ui_set_accessible_label(self->fader, volume);
  Suno_ui_set_accessible_label(GTK_WIDGET(Suno_volume_slider_get_meter(SUNO_VOLUME_SLIDER(self->fader))), level);
  Suno_ui_set_accessible_label(self->mute, mute);
  Suno_ui_set_accessible_label(self->monitor, monitor);
}

/* ── state ── */

static void apply_muted(SunoMixerStrip *self, gboolean muted) {
  self->muted = muted;
  Suno_volume_slider_set_muted(SUNO_VOLUME_SLIDER(self->fader), muted);
  Suno_ui_set_css_class(GTK_WIDGET(self), "muted", muted);
  self->syncing = TRUE;
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(self->mute), muted);
  self->syncing = FALSE;
  g_object_notify_by_pspec(G_OBJECT(self), props[PROP_MUTED]);
}

static void apply_monitoring(SunoMixerStrip *self, gboolean monitoring) {
  self->monitoring = monitoring;
  Suno_ui_set_css_class(GTK_WIDGET(self), "monitoring", monitoring);
  self->syncing = TRUE;
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(self->monitor), monitoring);
  self->syncing = FALSE;
  g_object_notify_by_pspec(G_OBJECT(self), props[PROP_MONITORING]);
}

static void mute_toggled(GtkToggleButton *button, SunoMixerStrip *self) {
  gboolean active = gtk_toggle_button_get_active(button);
  if (self->syncing || active == self->muted)
    return;
  apply_muted(self, active);
  g_signal_emit(self, signals[MUTE_TOGGLED], 0, active);
}

static void monitor_toggled(GtkToggleButton *button, SunoMixerStrip *self) {
  gboolean active = gtk_toggle_button_get_active(button);
  if (self->syncing || active == self->monitoring)
    return;
  apply_monitoring(self, active);
  g_signal_emit(self, signals[MONITOR_TOGGLED], 0, active);
}

static void fader_value(GObject *fader G_GNUC_UNUSED, GParamSpec *pspec G_GNUC_UNUSED, SunoMixerStrip *self) {
  show_value(self);
  g_object_notify_by_pspec(G_OBJECT(self), props[PROP_DB]);
}

static void fader_moved(SunoVolumeSlider *fader G_GNUC_UNUSED, double value, SunoMixerStrip *self) {
  g_signal_emit(self, signals[MOVED], 0, value);
}

/* M mutes from anywhere in the strip (the fader leaves letters alone). */
static gboolean key_pressed(GtkEventControllerKey *controller G_GNUC_UNUSED, guint keyval, guint keycode G_GNUC_UNUSED,
                            GdkModifierType state, SunoMixerStrip *self) {
  if ((keyval == GDK_KEY_m || keyval == GDK_KEY_M) && gtk_widget_get_visible(self->mute) &&
      !(state & (GDK_CONTROL_MASK | GDK_ALT_MASK | GDK_SUPER_MASK | GDK_META_MASK))) {
    gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(self->mute), !self->muted);
    return TRUE;
  }
  return FALSE;
}

/* ── GtkWidget ── */

/* A fixed width whatever the names ask; as tall as the content asks at that width. */
static void measure(GtkWidget *widget, GtkOrientation orientation, int for_size G_GNUC_UNUSED, int *minimum,
                    int *natural, int *minimum_baseline G_GNUC_UNUSED, int *natural_baseline G_GNUC_UNUSED) {
  SunoMixerStrip *self = SUNO_MIXER_STRIP(widget);
  if (orientation == GTK_ORIENTATION_HORIZONTAL) {
    *minimum = *natural = CONTENT_WIDTH;
    return;
  }
  gtk_widget_measure(self->content, GTK_ORIENTATION_VERTICAL, CONTENT_WIDTH, minimum, natural, NULL, NULL);
}

static void size_allocate(GtkWidget *widget, int width, int height, int baseline) {
  gtk_widget_allocate(SUNO_MIXER_STRIP(widget)->content, width, height, baseline, NULL);
}

static void set_property(GObject *object, guint id, const GValue *value, GParamSpec *pspec) {
  SunoMixerStrip *self = SUNO_MIXER_STRIP(object);
  switch (id) {
  case PROP_LABEL: Suno_mixer_strip_set_label(self, g_value_get_string(value)); break;
  case PROP_SUBTITLE: Suno_mixer_strip_set_subtitle(self, g_value_get_string(value)); break;
  case PROP_DB: Suno_mixer_strip_set_db(self, g_value_get_double(value)); break;
  case PROP_MUTED: Suno_mixer_strip_set_muted(self, g_value_get_boolean(value)); break;
  case PROP_MONITORING: Suno_mixer_strip_set_monitoring(self, g_value_get_boolean(value)); break;
  case PROP_GICON: Suno_mixer_strip_set_gicon(self, g_value_get_object(value)); break;
  case PROP_MUTE_VISIBLE: Suno_mixer_strip_set_mute_visible(self, g_value_get_boolean(value)); break;
  case PROP_MONITOR_VISIBLE: Suno_mixer_strip_set_monitor_visible(self, g_value_get_boolean(value)); break;
  default: G_OBJECT_WARN_INVALID_PROPERTY_ID(object, id, pspec);
  }
}

static void get_property(GObject *object, guint id, GValue *value, GParamSpec *pspec) {
  SunoMixerStrip *self = SUNO_MIXER_STRIP(object);
  switch (id) {
  case PROP_LABEL: g_value_set_string(value, self->label); break;
  case PROP_SUBTITLE: g_value_set_string(value, self->subtitle); break;
  case PROP_DB: g_value_set_double(value, Suno_mixer_strip_get_db(self)); break;
  case PROP_MUTED: g_value_set_boolean(value, self->muted); break;
  case PROP_MONITORING: g_value_set_boolean(value, self->monitoring); break;
  case PROP_GICON: g_value_set_object(value, gtk_image_get_gicon(GTK_IMAGE(self->icon))); break;
  case PROP_MUTE_VISIBLE: g_value_set_boolean(value, gtk_widget_get_visible(self->mute)); break;
  case PROP_MONITOR_VISIBLE: g_value_set_boolean(value, gtk_widget_get_visible(self->monitor)); break;
  default: G_OBJECT_WARN_INVALID_PROPERTY_ID(object, id, pspec);
  }
}

static void dispose(GObject *object) {
  SunoMixerStrip *self = SUNO_MIXER_STRIP(object);
  g_clear_pointer(&self->content, gtk_widget_unparent);
  G_OBJECT_CLASS(Suno_mixer_strip_parent_class)->dispose(object);
}

static void finalize(GObject *object) {
  SunoMixerStrip *self = SUNO_MIXER_STRIP(object);
  g_free(self->label);
  g_free(self->subtitle);
  G_OBJECT_CLASS(Suno_mixer_strip_parent_class)->finalize(object);
}

static void Suno_mixer_strip_class_init(SunoMixerStripClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS(klass);
  object_class->set_property = set_property;
  object_class->get_property = get_property;
  object_class->dispose = dispose;
  object_class->finalize = finalize;
  widget_class->measure = measure;
  widget_class->size_allocate = size_allocate;
  GParamFlags flags = G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS;
  props[PROP_LABEL] = g_param_spec_string("label", NULL, NULL, NULL, flags);
  props[PROP_SUBTITLE] = g_param_spec_string("subtitle", NULL, NULL, NULL, flags);
  props[PROP_DB] = g_param_spec_double("db", NULL, NULL, -G_MAXDOUBLE, G_MAXDOUBLE, 0, flags);
  props[PROP_MUTED] = g_param_spec_boolean("muted", NULL, NULL, FALSE, flags);
  props[PROP_MONITORING] = g_param_spec_boolean("monitoring", NULL, NULL, FALSE, flags);
  props[PROP_GICON] = g_param_spec_object("gicon", NULL, NULL, G_TYPE_ICON, flags);
  props[PROP_MUTE_VISIBLE] = g_param_spec_boolean("mute-visible", NULL, NULL, TRUE, flags);
  props[PROP_MONITOR_VISIBLE] = g_param_spec_boolean("monitor-visible", NULL, NULL, TRUE, flags);
  g_object_class_install_properties(object_class, N_PROPS, props);
  /**
   * SunoMixerStrip::moved:
   * @self: the strip
   * @db: where the person moved the fader
   *
   * The person moved the fader (pointer, wheel, keys or assistive technology).
   */
  signals[MOVED] = g_signal_new("moved", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                G_TYPE_NONE, 1, G_TYPE_DOUBLE);
  /**
   * SunoMixerStrip::mute-toggled:
   * @self: the strip
   * @muted: whether the person muted the channel
   */
  signals[MUTE_TOGGLED] = g_signal_new("mute-toggled", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL, NULL,
                                       NULL, G_TYPE_NONE, 1, G_TYPE_BOOLEAN);
  /**
   * SunoMixerStrip::monitor-toggled:
   * @self: the strip
   * @monitoring: whether the person turned monitoring on
   */
  signals[MONITOR_TOGGLED] = g_signal_new("monitor-toggled", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL,
                                          NULL, NULL, G_TYPE_NONE, 1, G_TYPE_BOOLEAN);
  gtk_widget_class_set_css_name(widget_class, "SunoUI-mixer-strip");
  gtk_widget_class_set_accessible_role(widget_class, GTK_ACCESSIBLE_ROLE_GROUP);
}

static GtkWidget *strip_label(const char *css, const char *role, gboolean muted) {
  GtkWidget *label = gtk_label_new(NULL);
  gtk_widget_add_css_class(label, css);
  Suno_ui_apply_type_full(label, role, muted);
  gtk_label_set_ellipsize(GTK_LABEL(label), PANGO_ELLIPSIZE_END);
  gtk_label_set_single_line_mode(GTK_LABEL(label), TRUE);
  gtk_label_set_xalign(GTK_LABEL(label), 0.5);
  return label;
}

static GtkWidget *strip_key(const char *icon, const char *label, const char *kind, const char *shortcut) {
  GtkWidget *key = Suno_ui_icon_button(icon, label, "SunoUI-icon-only", TRUE, shortcut);
  gtk_widget_add_css_class(key, "SunoUI-mixer-key");
  gtk_widget_add_css_class(key, kind);
  return key;
}

static void Suno_mixer_strip_init(SunoMixerStrip *self) {
  Suno_ui_install();
  GtkWidget *widget = GTK_WIDGET(self);
  gtk_widget_add_css_class(widget, "SunoUI-mixer-strip");
  gtk_widget_set_vexpand(widget, TRUE);
  self->content = gtk_box_new(GTK_ORIENTATION_VERTICAL, SUNO_UI_MIXER_STRIP_GAP);
  gtk_widget_add_css_class(self->content, "SunoUI-mixer-content");
  gtk_widget_set_parent(self->content, widget);

  GtkWidget *head = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_add_css_class(head, "SunoUI-mixer-head");
  /* What the channel is (an app's or device's icon); no room is kept while it has none. */
  self->icon = gtk_image_new();
  gtk_widget_add_css_class(self->icon, "SunoUI-mixer-icon");
  gtk_image_set_pixel_size(GTK_IMAGE(self->icon), SUNO_UI_MIXER_STRIP_ICON);
  gtk_widget_set_halign(self->icon, GTK_ALIGN_CENTER);
  gtk_widget_set_visible(self->icon, FALSE);
  gtk_accessible_update_state(GTK_ACCESSIBLE(self->icon), GTK_ACCESSIBLE_STATE_HIDDEN, TRUE, -1);
  gtk_box_append(GTK_BOX(head), self->icon);
  self->name = strip_label("SunoUI-mixer-name", "label", FALSE);
  self->device = strip_label("SunoUI-mixer-device", "caption", TRUE);
  /* The strip speaks its name and device; the labels would say them twice. */
  gtk_accessible_update_state(GTK_ACCESSIBLE(self->name), GTK_ACCESSIBLE_STATE_HIDDEN, TRUE, -1);
  gtk_accessible_update_state(GTK_ACCESSIBLE(self->device), GTK_ACCESSIBLE_STATE_HIDDEN, TRUE, -1);
  gtk_box_append(GTK_BOX(head), self->name);
  gtk_box_append(GTK_BOX(head), self->device);
  gtk_box_append(GTK_BOX(self->content), head);

  GtkWidget *body = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, SUNO_UI_MIXER_STRIP_SCALE_GAP);
  gtk_widget_add_css_class(body, "SunoUI-mixer-body");
  /* The scale, fader and meter are one instrument read against one another, not text: RTL keeps
   * them as they are (the strips, names and keys mirror). */
  gtk_widget_set_direction(body, GTK_TEXT_DIR_LTR);
  gtk_widget_set_halign(body, GTK_ALIGN_CENTER);
  gtk_widget_set_vexpand(body, TRUE);
  self->scale = gtk_drawing_area_new();
  gtk_widget_add_css_class(self->scale, "SunoUI-mixer-scale");
  gtk_widget_set_direction(self->scale, GTK_TEXT_DIR_LTR);
  gtk_widget_set_size_request(self->scale, SUNO_UI_MIXER_STRIP_SCALE_WIDTH, -1);
  gtk_widget_set_can_target(self->scale, FALSE);
  gtk_accessible_update_state(GTK_ACCESSIBLE(self->scale), GTK_ACCESSIBLE_STATE_HIDDEN, TRUE, -1);
  gtk_drawing_area_set_draw_func(GTK_DRAWING_AREA(self->scale), scale_draw, self, NULL);
  self->fader = Suno_volume_slider_new(GTK_ORIENTATION_VERTICAL, -60, 6);
  SunoVolumeSlider *fader = SUNO_VOLUME_SLIDER(self->fader);
  Suno_volume_slider_set_unit(fader, "dB");
  Suno_volume_slider_set_unity(fader, 0);
  Suno_volume_slider_set_steps(fader, STEP_DB, PAGE_DB);
  Suno_volume_slider_set_meter_channels(fader, 2);
  Suno_volume_slider_set_value(fader, 0);
  gtk_widget_set_vexpand(self->fader, TRUE);
  gtk_widget_set_tooltip_text(self->fader, "Volume; double-click for 0 dB");
  g_signal_connect(fader, "notify::value", G_CALLBACK(fader_value), self);
  g_signal_connect(fader, "moved", G_CALLBACK(fader_moved), self);
  gtk_box_append(GTK_BOX(body), self->scale);
  gtk_box_append(GTK_BOX(body), self->fader);
  gtk_box_append(GTK_BOX(self->content), body);

  self->readout = strip_label("SunoUI-mixer-readout", "caption", FALSE);
  /* The fader speaks its value; the readout is its picture. */
  gtk_accessible_update_state(GTK_ACCESSIBLE(self->readout), GTK_ACCESSIBLE_STATE_HIDDEN, TRUE, -1);
  gtk_box_append(GTK_BOX(self->content), self->readout);

  GtkWidget *keys = self->keys = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, SUNO_UI_MIXER_STRIP_KEY_GAP);
  gtk_widget_add_css_class(keys, "SunoUI-mixer-keys");
  gtk_widget_set_halign(keys, GTK_ALIGN_CENTER);
  self->mute = strip_key("volume-x", "Mute", "mute", "M");
  self->monitor = strip_key("headphones", "Monitor", "monitor", NULL);
  g_signal_connect(self->mute, "toggled", G_CALLBACK(mute_toggled), self);
  g_signal_connect(self->monitor, "toggled", G_CALLBACK(monitor_toggled), self);
  gtk_box_append(GTK_BOX(keys), self->mute);
  gtk_box_append(GTK_BOX(keys), self->monitor);
  gtk_box_append(GTK_BOX(self->content), keys);

  GtkEventController *controller = gtk_event_controller_key_new();
  g_signal_connect(controller, "key-pressed", G_CALLBACK(key_pressed), self);
  gtk_widget_add_controller(widget, controller);
  name_everything(self);
  show_value(self);
}

GtkWidget *Suno_mixer_strip_new(const char *label, const char *subtitle) {
  return g_object_new(SUNO_TYPE_MIXER_STRIP, "label", label, "subtitle", subtitle, NULL);
}

void Suno_mixer_strip_set_label(SunoMixerStrip *self, const char *label) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  if (g_strcmp0(self->label, label) == 0)
    return;
  g_free(self->label);
  self->label = g_strdup(label);
  name_everything(self);
  g_object_notify_by_pspec(G_OBJECT(self), props[PROP_LABEL]);
}

const char *Suno_mixer_strip_get_label(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), NULL);
  return self->label;
}

void Suno_mixer_strip_set_subtitle(SunoMixerStrip *self, const char *subtitle) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  if (g_strcmp0(self->subtitle, subtitle) == 0)
    return;
  g_free(self->subtitle);
  self->subtitle = g_strdup(subtitle);
  name_everything(self);
  g_object_notify_by_pspec(G_OBJECT(self), props[PROP_SUBTITLE]);
}

const char *Suno_mixer_strip_get_subtitle(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), NULL);
  return self->subtitle;
}

void Suno_mixer_strip_set_range(SunoMixerStrip *self, double min_db, double max_db) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  g_return_if_fail(max_db > min_db);
  SunoVolumeSlider *fader = SUNO_VOLUME_SLIDER(self->fader);
  Suno_volume_slider_set_range(fader, min_db, max_db);
  Suno_volume_slider_set_unity(fader, min_db < 0 && max_db > 0 ? 0 : NAN);
  show_value(self);
  gtk_widget_queue_draw(self->scale);
}

void Suno_mixer_strip_get_range(SunoMixerStrip *self, double *min_db, double *max_db) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  Suno_volume_slider_get_range(SUNO_VOLUME_SLIDER(self->fader), min_db, max_db);
}

void Suno_mixer_strip_set_db(SunoMixerStrip *self, double db) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  Suno_volume_slider_set_value(SUNO_VOLUME_SLIDER(self->fader), db);
}

double Suno_mixer_strip_get_db(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), 0);
  return Suno_volume_slider_get_value(SUNO_VOLUME_SLIDER(self->fader));
}

void Suno_mixer_strip_set_muted(SunoMixerStrip *self, gboolean muted) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  if (self->muted != !!muted)
    apply_muted(self, !!muted);
}

gboolean Suno_mixer_strip_get_muted(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), FALSE);
  return self->muted;
}

void Suno_mixer_strip_set_monitoring(SunoMixerStrip *self, gboolean monitoring) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  if (self->monitoring != !!monitoring)
    apply_monitoring(self, !!monitoring);
}

void Suno_mixer_strip_set_gicon(SunoMixerStrip *self, GIcon *icon) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  g_return_if_fail(icon == NULL || G_IS_ICON(icon));
  gtk_image_set_from_gicon(GTK_IMAGE(self->icon), icon);
  gtk_widget_set_visible(self->icon, icon != NULL);
  g_object_notify_by_pspec(G_OBJECT(self), props[PROP_GICON]);
}

void Suno_mixer_strip_set_icon_name(SunoMixerStrip *self, const char *icon) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  if (icon == NULL || *icon == '\0') {
    Suno_mixer_strip_set_gicon(self, NULL);
    return;
  }
  /* A Lucide name ("mic", "monitor-speaker") is the kit's glyph; a theme or app icon name is itself. */
  g_autofree char *name = strchr(icon, '.') || g_str_has_suffix(icon, "-symbolic") ? g_strdup(icon) : Suno_ui_icon_name(icon);
  g_autoptr(GIcon) themed = g_themed_icon_new(name);
  Suno_mixer_strip_set_gicon(self, themed);
}

GIcon *Suno_mixer_strip_get_gicon(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), NULL);
  return gtk_image_get_gicon(GTK_IMAGE(self->icon));
}

static void sync_keys(SunoMixerStrip *self) {
  gtk_widget_set_visible(self->keys, gtk_widget_get_visible(self->mute) || gtk_widget_get_visible(self->monitor));
}

void Suno_mixer_strip_set_mute_visible(SunoMixerStrip *self, gboolean visible) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  gtk_widget_set_visible(self->mute, visible);
  sync_keys(self);
  g_object_notify_by_pspec(G_OBJECT(self), props[PROP_MUTE_VISIBLE]);
}

gboolean Suno_mixer_strip_get_mute_visible(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), FALSE);
  return gtk_widget_get_visible(self->mute);
}

void Suno_mixer_strip_set_monitor_visible(SunoMixerStrip *self, gboolean visible) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  gtk_widget_set_visible(self->monitor, visible);
  sync_keys(self);
  g_object_notify_by_pspec(G_OBJECT(self), props[PROP_MONITOR_VISIBLE]);
}

gboolean Suno_mixer_strip_get_monitor_visible(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), FALSE);
  return gtk_widget_get_visible(self->monitor);
}

gboolean Suno_mixer_strip_get_monitoring(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), FALSE);
  return self->monitoring;
}

void Suno_mixer_strip_set_levels_db(SunoMixerStrip *self, double left_db, double right_db) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  Suno_audio_meter_set_levels_db(Suno_mixer_strip_get_meter(self), left_db, right_db);
}

void Suno_mixer_strip_set_levels(SunoMixerStrip *self, double left, double right) {
  g_return_if_fail(SUNO_IS_MIXER_STRIP(self));
  Suno_audio_meter_set_levels(Suno_mixer_strip_get_meter(self), left, right);
}

SunoVolumeSlider *Suno_mixer_strip_get_fader(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), NULL);
  return SUNO_VOLUME_SLIDER(self->fader);
}

SunoAudioMeter *Suno_mixer_strip_get_meter(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), NULL);
  return Suno_volume_slider_get_meter(SUNO_VOLUME_SLIDER(self->fader));
}

GtkWidget *Suno_mixer_strip_get_mute_button(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), NULL);
  return self->mute;
}

GtkWidget *Suno_mixer_strip_get_monitor_button(SunoMixerStrip *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_STRIP(self), NULL);
  return self->monitor;
}

/* ── SunoMixerRow ── */

struct _SunoMixerRow {
  GtkWidget parent_instance;
  GtkWidget *scroller;
  GtkWidget *strips;
};

G_DEFINE_FINAL_TYPE(SunoMixerRow, Suno_mixer_row, GTK_TYPE_WIDGET)

static GtkWidget *focused_strip(SunoMixerRow *self) {
  GtkWidget *focus = gtk_root_get_focus(gtk_widget_get_root(GTK_WIDGET(self)));
  for (GtkWidget *w = focus; w != NULL; w = gtk_widget_get_parent(w))
    if (gtk_widget_get_parent(w) == self->strips)
      return SUNO_IS_MIXER_STRIP(w) ? w : NULL;
  return NULL;
}

/* Left and Right walk the faders, in reading order (mirrored in RTL). */
static gboolean row_key_pressed(GtkEventControllerKey *controller G_GNUC_UNUSED, guint keyval,
                                guint keycode G_GNUC_UNUSED, GdkModifierType state, SunoMixerRow *self) {
  if (state & (GDK_CONTROL_MASK | GDK_ALT_MASK | GDK_SHIFT_MASK | GDK_SUPER_MASK))
    return FALSE;
  gboolean left = keyval == GDK_KEY_Left || keyval == GDK_KEY_KP_Left;
  gboolean right = keyval == GDK_KEY_Right || keyval == GDK_KEY_KP_Right;
  if (!left && !right)
    return FALSE;
  GtkWidget *strip = focused_strip(self);
  if (strip == NULL)
    return FALSE;
  gboolean next = right != (gtk_widget_get_direction(GTK_WIDGET(self)) == GTK_TEXT_DIR_RTL);
  GtkWidget *to = next ? gtk_widget_get_next_sibling(strip) : gtk_widget_get_prev_sibling(strip);
  while (to != NULL && !(SUNO_IS_MIXER_STRIP(to) && gtk_widget_get_visible(to)))
    to = next ? gtk_widget_get_next_sibling(to) : gtk_widget_get_prev_sibling(to);
  if (to == NULL)
    return TRUE;
  gtk_widget_grab_focus(GTK_WIDGET(Suno_mixer_strip_get_fader(SUNO_MIXER_STRIP(to))));
  return TRUE;
}

static void row_dispose(GObject *object) {
  SunoMixerRow *self = SUNO_MIXER_ROW(object);
  g_clear_pointer(&self->scroller, gtk_widget_unparent);
  self->strips = NULL;
  G_OBJECT_CLASS(Suno_mixer_row_parent_class)->dispose(object);
}

static void Suno_mixer_row_class_init(SunoMixerRowClass *klass) {
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS(klass);
  G_OBJECT_CLASS(klass)->dispose = row_dispose;
  gtk_widget_class_set_layout_manager_type(widget_class, GTK_TYPE_BIN_LAYOUT);
  gtk_widget_class_set_css_name(widget_class, "SunoUI-mixer-row");
  gtk_widget_class_set_accessible_role(widget_class, GTK_ACCESSIBLE_ROLE_GROUP);
}

static void Suno_mixer_row_init(SunoMixerRow *self) {
  Suno_ui_install();
  GtkWidget *widget = GTK_WIDGET(self);
  gtk_widget_add_css_class(widget, "SunoUI-mixer-row");
  gtk_widget_set_hexpand(widget, TRUE);
  Suno_ui_set_accessible_label(widget, "Mixer");
  /* Sideways only: at least one whole strip wide, exactly as tall as the strips. */
  self->scroller = gtk_scrolled_window_new();
  gtk_scrolled_window_set_policy(GTK_SCROLLED_WINDOW(self->scroller), GTK_POLICY_AUTOMATIC, GTK_POLICY_NEVER);
  gtk_scrolled_window_set_propagate_natural_width(GTK_SCROLLED_WINDOW(self->scroller), TRUE);
  gtk_scrolled_window_set_propagate_natural_height(GTK_SCROLLED_WINDOW(self->scroller), TRUE);
  gtk_scrolled_window_set_min_content_width(GTK_SCROLLED_WINDOW(self->scroller), WIDTH);
  self->strips = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, SUNO_UI_MIXER_STRIP_ROW_GAP);
  gtk_widget_add_css_class(self->strips, "SunoUI-mixer-strips");
  gtk_widget_set_halign(self->strips, GTK_ALIGN_START);
  gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(self->scroller), self->strips);
  gtk_widget_set_parent(self->scroller, widget);
  GtkEventController *controller = gtk_event_controller_key_new();
  g_signal_connect(controller, "key-pressed", G_CALLBACK(row_key_pressed), self);
  gtk_widget_add_controller(widget, controller);
}

GtkWidget *Suno_mixer_row_new(void) { return g_object_new(SUNO_TYPE_MIXER_ROW, NULL); }

void Suno_mixer_row_append(SunoMixerRow *self, SunoMixerStrip *strip) {
  g_return_if_fail(SUNO_IS_MIXER_ROW(self));
  g_return_if_fail(SUNO_IS_MIXER_STRIP(strip));
  g_return_if_fail(gtk_widget_get_parent(GTK_WIDGET(strip)) == NULL);
  gtk_box_append(GTK_BOX(self->strips), GTK_WIDGET(strip));
}

void Suno_mixer_row_remove(SunoMixerRow *self, SunoMixerStrip *strip) {
  g_return_if_fail(SUNO_IS_MIXER_ROW(self));
  g_return_if_fail(SUNO_IS_MIXER_STRIP(strip));
  g_return_if_fail(gtk_widget_get_parent(GTK_WIDGET(strip)) == self->strips);
  gtk_box_remove(GTK_BOX(self->strips), GTK_WIDGET(strip));
}

guint Suno_mixer_row_get_n_strips(SunoMixerRow *self) {
  g_return_val_if_fail(SUNO_IS_MIXER_ROW(self), 0);
  guint n = 0;
  for (GtkWidget *w = gtk_widget_get_first_child(self->strips); w; w = gtk_widget_get_next_sibling(w))
    n++;
  return n;
}

SunoMixerStrip *Suno_mixer_row_get_strip(SunoMixerRow *self, guint index) {
  g_return_val_if_fail(SUNO_IS_MIXER_ROW(self), NULL);
  for (GtkWidget *w = gtk_widget_get_first_child(self->strips); w; w = gtk_widget_get_next_sibling(w))
    if (index-- == 0)
      return SUNO_MIXER_STRIP(w);
  return NULL;
}
