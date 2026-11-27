/* SPDX-License-Identifier: Apache-2.0 */
/* SunoUI creative family (KB-D): the property fields (v70 .susec, .sufld,
 * .suclrrow, .suselect, .seg, .sualign). */
#include "Suno-creative-properties.h"
#include "Suno-creative-private.h"
#include "Suno-menu-drawer.h"

#include <math.h>
#include <string.h>

/* ── Arithmetic (widgets.evaluate_number's twin) ── */

typedef struct {
  const char *at;
  gboolean bad;
} Parse;

static double parse_sum(Parse *p);

static void skip_space(Parse *p) {
  while (*p->at == ' ' || *p->at == '\t')
    p->at++;
}

static double parse_primary(Parse *p) {
  skip_space(p);
  if (*p->at == '(') {
    p->at++;
    double value = parse_sum(p);
    skip_space(p);
    if (*p->at != ')') {
      p->bad = TRUE;
      return 0;
    }
    p->at++;
    return value;
  }
  char *end = NULL;
  if (!g_ascii_isdigit(*p->at) && *p->at != '.') {
    p->bad = TRUE;
    return 0;
  }
  double value = g_ascii_strtod(p->at, &end);
  if (end == p->at) {
    p->bad = TRUE;
    return 0;
  }
  p->at = end;
  return value;
}

static double parse_unary(Parse *p);

static double parse_power(Parse *p) {
  double base = parse_primary(p);
  skip_space(p);
  if (p->at[0] == '*' && p->at[1] == '*') {
    p->at += 2;
    return pow(base, parse_unary(p));
  }
  return base;
}

static double parse_unary(Parse *p) {
  skip_space(p);
  if (*p->at == '-') {
    p->at++;
    return -parse_unary(p);
  }
  if (*p->at == '+') {
    p->at++;
    return parse_unary(p);
  }
  return parse_power(p);
}

static double parse_product(Parse *p) {
  double value = parse_unary(p);
  for (;;) {
    skip_space(p);
    char op = *p->at;
    if ((op != '*' && op != '/' && op != '%') || (op == '*' && p->at[1] == '*'))
      return value;
    p->at++;
    double right = parse_unary(p);
    if (op == '*')
      value *= right;
    else if (right == 0) {
      p->bad = TRUE;
      return 0;
    } else if (op == '/')
      value /= right;
    else
      value = value - right * floor(value / right); /* Python's modulo */
  }
}

static double parse_sum(Parse *p) {
  double value = parse_product(p);
  for (;;) {
    skip_space(p);
    char op = *p->at;
    if (op != '+' && op != '-')
      return value;
    p->at++;
    double right = parse_product(p);
    value = op == '+' ? value + right : value - right;
  }
}

gboolean Suno_property_evaluate(const char *text, double *value) {
  g_return_val_if_fail(text != NULL, FALSE);
  g_autofree char *clean = g_strstrip(g_strdup(text));
  size_t len = strlen(clean);
  while (len > 0 && clean[len - 1] == '%')
    clean[--len] = '\0';
  if (g_str_has_suffix(clean, "px") || g_str_has_suffix(clean, "pt"))
    clean[len - 2] = '\0';
  g_strstrip(clean);
  if (*clean == '\0')
    return FALSE;
  Parse p = {clean, FALSE};
  double result = parse_sum(&p);
  skip_space(&p);
  if (p.bad || *p.at != '\0' || !isfinite(result))
    return FALSE;
  if (value != NULL)
    *value = result;
  return TRUE;
}

GtkWidget *Suno_property_heading_new(const char *text) {
  g_return_val_if_fail(text != NULL, NULL);
  Suno_creative_install();
  GtkWidget *label = gtk_label_new(text);
  gtk_label_set_xalign(GTK_LABEL(label), 0);
  gtk_widget_add_css_class(label, "SunoUI-creative-heading");
  gtk_accessible_update_property(GTK_ACCESSIBLE(label), GTK_ACCESSIBLE_PROPERTY_LEVEL, 3, -1);
  return label;
}

/* ── SunoPropertySection ── */

struct _SunoPropertySection {
  GtkBox parent_instance;
  GtkWidget *header;
  GtkWidget *title;
  GtkWidget *action;
  char *action_name;
};

G_DEFINE_FINAL_TYPE(SunoPropertySection, Suno_property_section, GTK_TYPE_BOX)

static void section_action_clicked(GtkButton *button, gpointer user_data) {
  SunoPropertySection *self = user_data;
  Suno_creative_activate_detailed(GTK_WIDGET(button), self->action_name);
}

static void Suno_property_section_finalize(GObject *object) {
  g_free(SUNO_PROPERTY_SECTION(object)->action_name);
  G_OBJECT_CLASS(Suno_property_section_parent_class)->finalize(object);
}

static void Suno_property_section_class_init(SunoPropertySectionClass *klass) {
  G_OBJECT_CLASS(klass)->finalize = Suno_property_section_finalize;
  gtk_widget_class_set_accessible_role(GTK_WIDGET_CLASS(klass), GTK_ACCESSIBLE_ROLE_GROUP);
}

static void Suno_property_section_init(SunoPropertySection *self) {
  Suno_creative_install();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_VERTICAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-creative-section");
  self->header = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(self->header, "SunoUI-creative-section-header");
  self->title = gtk_label_new(NULL);
  gtk_label_set_xalign(GTK_LABEL(self->title), 0);
  gtk_widget_set_hexpand(self->title, TRUE);
  gtk_widget_add_css_class(self->title, "SunoUI-creative-section-title");
  gtk_box_append(GTK_BOX(self->header), self->title);
  gtk_box_append(GTK_BOX(self), self->header);
}

GtkWidget *Suno_property_section_new(const char *title) {
  g_return_val_if_fail(title != NULL, NULL);
  SunoPropertySection *self = g_object_new(SUNO_TYPE_PROPERTY_SECTION, "accessible-role", GTK_ACCESSIBLE_ROLE_GROUP, NULL);
  gtk_label_set_text(GTK_LABEL(self->title), title);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), title);
  return GTK_WIDGET(self);
}

void Suno_property_section_set_action(SunoPropertySection *self, const char *icon, const char *label,
                                      const char *action_name) {
  g_return_if_fail(SUNO_IS_PROPERTY_SECTION(self));
  if (self->action != NULL) {
    gtk_box_remove(GTK_BOX(self->header), self->action);
    self->action = NULL;
  }
  g_free(self->action_name);
  self->action_name = g_strdup(action_name);
  if (icon == NULL)
    return;
  self->action = Suno_ui_icon_button(icon, label != NULL ? label : icon, "SunoUI-creative-section-action", FALSE, NULL);
  g_signal_connect(self->action, "clicked", G_CALLBACK(section_action_clicked), self);
  gtk_box_append(GTK_BOX(self->header), self->action);
}

void Suno_property_section_append(SunoPropertySection *self, GtkWidget *field) {
  g_return_if_fail(SUNO_IS_PROPERTY_SECTION(self));
  g_return_if_fail(GTK_IS_WIDGET(field));
  gtk_box_append(GTK_BOX(self), field);
}

void Suno_property_section_add_pair(SunoPropertySection *self, GtkWidget *start, GtkWidget *end) {
  g_return_if_fail(SUNO_IS_PROPERTY_SECTION(self));
  g_return_if_fail(GTK_IS_WIDGET(start));
  g_return_if_fail(end == NULL || GTK_IS_WIDGET(end));
  /* Consecutive pairs share one grid, so their columns line up. */
  GtkWidget *last = gtk_widget_get_last_child(GTK_WIDGET(self));
  GtkWidget *grid;
  int row = 0;
  if (last != NULL && GTK_IS_GRID(last) && gtk_widget_has_css_class(last, "SunoUI-creative-pairs")) {
    grid = last;
    row = GPOINTER_TO_INT(g_object_get_data(G_OBJECT(grid), "Suno-rows"));
  } else {
    grid = gtk_grid_new();
    gtk_grid_set_column_homogeneous(GTK_GRID(grid), TRUE);
    gtk_widget_add_css_class(grid, "SunoUI-creative-pairs");
    gtk_box_append(GTK_BOX(self), grid);
  }
  gtk_widget_set_hexpand(start, TRUE);
  gtk_grid_attach(GTK_GRID(grid), start, 0, row, 1, 1);
  if (end != NULL) {
    gtk_widget_set_hexpand(end, TRUE);
    gtk_grid_attach(GTK_GRID(grid), end, 1, row, 1, 1);
  } else {
    /* Keep the right column (v70 leaves an empty cell). */
    GtkWidget *blank = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
    gtk_widget_set_hexpand(blank, TRUE);
    gtk_grid_attach(GTK_GRID(grid), blank, 1, row, 1, 1);
  }
  g_object_set_data(G_OBJECT(grid), "Suno-rows", GINT_TO_POINTER(row + 1));
}

/* ── SunoPropertyNumber ── */

enum { NUMBER_VALUE_CHANGED, NUMBER_N_SIGNALS };
static guint number_signals[NUMBER_N_SIGNALS];

struct _SunoPropertyNumber {
  GtkBox parent_instance;
  GtkWidget *label;
  GtkWidget *text;
  GtkWidget *unit;
  double value;
  double minimum;
  double maximum;
  double step;
  guint digits;
  gboolean mixed;
  double drag_origin;
  double drag_last;
};

G_DEFINE_FINAL_TYPE(SunoPropertyNumber, Suno_property_number, GTK_TYPE_BOX)

static double number_clamp(SunoPropertyNumber *self, double value) {
  return CLAMP(value, self->minimum, self->maximum);
}

static void number_show(SunoPropertyNumber *self) {
  if (self->mixed) {
    gtk_editable_set_text(GTK_EDITABLE(self->text), "Mixed");
    return;
  }
  char buffer[G_ASCII_DTOSTR_BUF_SIZE];
  g_autofree char *format = g_strdup_printf("%%.%uf", self->digits);
  g_ascii_formatd(buffer, sizeof buffer, format, self->value);
  /* No "-0". */
  if (strcmp(buffer, "-0") == 0 || (g_str_has_prefix(buffer, "-0.") && strspn(buffer + 3, "0") == strlen(buffer + 3)))
    memmove(buffer, buffer + 1, strlen(buffer));
  gtk_editable_set_text(GTK_EDITABLE(self->text), buffer);
}

static void number_set_mixed_state(SunoPropertyNumber *self, gboolean mixed) {
  self->mixed = mixed;
  Suno_ui_set_css_class(GTK_WIDGET(self), "mixed", mixed);
  gtk_accessible_update_property(GTK_ACCESSIBLE(self->text), GTK_ACCESSIBLE_PROPERTY_DESCRIPTION,
                                 mixed ? "Several values; typing one applies it to everything selected" : "", -1);
}

static void number_apply(SunoPropertyNumber *self, double value) {
  number_set_mixed_state(self, FALSE);
  self->value = number_clamp(self, value);
  number_show(self);
  g_signal_emit(self, number_signals[NUMBER_VALUE_CHANGED], 0, self->value);
}

static void number_commit(SunoPropertyNumber *self) {
  const char *text = gtk_editable_get_text(GTK_EDITABLE(self->text));
  double parsed;
  if (self->mixed && g_strcmp0(text, "Mixed") == 0)
    return;
  if (!Suno_property_evaluate(text, &parsed)) {
    number_show(self);
    return;
  }
  parsed = number_clamp(self, parsed);
  if (!self->mixed && parsed == self->value) {
    number_show(self);
    return;
  }
  number_apply(self, parsed);
}

static void number_activated(GtkText *text G_GNUC_UNUSED, gpointer user_data) {
  number_commit(SUNO_PROPERTY_NUMBER(user_data));
}

static void number_left(GtkEventControllerFocus *focus G_GNUC_UNUSED, gpointer user_data) {
  number_commit(SUNO_PROPERTY_NUMBER(user_data));
}

static double number_amount(SunoPropertyNumber *self, GdkModifierType state) {
  if (state & GDK_SHIFT_MASK)
    return self->step * 10;
  if (state & GDK_CONTROL_MASK)
    return self->step * 0.1;
  return self->step;
}

static gboolean number_key(GtkEventControllerKey *keys G_GNUC_UNUSED, guint keyval, guint code G_GNUC_UNUSED,
                           GdkModifierType state, gpointer user_data) {
  SunoPropertyNumber *self = user_data;
  double base = self->mixed ? 0.0 : self->value;
  switch (keyval) {
  case GDK_KEY_Up:
  case GDK_KEY_KP_Up:
    number_apply(self, base + number_amount(self, state));
    return TRUE;
  case GDK_KEY_Down:
  case GDK_KEY_KP_Down:
    number_apply(self, base - number_amount(self, state));
    return TRUE;
  case GDK_KEY_Escape:
    number_show(self);
    return TRUE;
  default:
    return FALSE;
  }
}

static void number_drag_begin(GtkGestureDrag *gesture G_GNUC_UNUSED, double x G_GNUC_UNUSED, double y G_GNUC_UNUSED,
                              gpointer user_data) {
  SunoPropertyNumber *self = user_data;
  self->drag_origin = self->mixed ? 0.0 : self->value;
  self->drag_last = self->drag_origin;
}

static void number_drag_update(GtkGestureDrag *gesture, double offset_x, double offset_y G_GNUC_UNUSED,
                               gpointer user_data) {
  SunoPropertyNumber *self = user_data;
  GdkModifierType state = gtk_event_controller_get_current_event_state(GTK_EVENT_CONTROLLER(gesture));
  double value = number_clamp(self, self->drag_origin + round(offset_x / 2.0) * number_amount(self, state));
  if (value != self->drag_last) {
    self->drag_last = value;
    number_apply(self, value);
  }
}

static void number_pressed(GtkGestureClick *gesture G_GNUC_UNUSED, int n G_GNUC_UNUSED, double x G_GNUC_UNUSED,
                           double y G_GNUC_UNUSED, gpointer user_data) {
  SunoPropertyNumber *self = user_data;
  if (!gtk_widget_has_focus(self->text))
    gtk_widget_grab_focus(self->text);
}

static void Suno_property_number_class_init(SunoPropertyNumberClass *klass) {
  /* The whole well is the text field (v70 label.sufld around its input), so it
   * is an entry node and a text box; the number is its text. */
  gtk_widget_class_set_css_name(GTK_WIDGET_CLASS(klass), "entry");
  gtk_widget_class_set_accessible_role(GTK_WIDGET_CLASS(klass), GTK_ACCESSIBLE_ROLE_TEXT_BOX);
  /**
   * SunoPropertyNumber::value-changed:
   * @self: the field
   * @value: the number a person set
   */
  number_signals[NUMBER_VALUE_CHANGED] = g_signal_new("value-changed", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST,
                                                      0, NULL, NULL, NULL, G_TYPE_NONE, 1, G_TYPE_DOUBLE);
}

static void Suno_property_number_init(SunoPropertyNumber *self) {
  Suno_creative_install();
  self->step = 1.0;
  self->minimum = -G_MAXDOUBLE;
  self->maximum = G_MAXDOUBLE;
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_HORIZONTAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-creative-number");
  self->text = gtk_text_new();
  gtk_widget_set_hexpand(self->text, TRUE);
  gtk_editable_set_width_chars(GTK_EDITABLE(self->text), 2);
  gtk_text_set_input_purpose(GTK_TEXT(self->text), GTK_INPUT_PURPOSE_NUMBER);
  g_signal_connect(self->text, "activate", G_CALLBACK(number_activated), self);
  GtkEventController *focus = gtk_event_controller_focus_new();
  g_signal_connect(focus, "leave", G_CALLBACK(number_left), self);
  gtk_widget_add_controller(self->text, focus);
  GtkEventController *keys = gtk_event_controller_key_new();
  g_signal_connect(keys, "key-pressed", G_CALLBACK(number_key), self);
  gtk_widget_add_controller(self->text, keys);
  gtk_box_append(GTK_BOX(self), self->text);
  GtkGesture *click = gtk_gesture_click_new();
  gtk_event_controller_set_propagation_phase(GTK_EVENT_CONTROLLER(click), GTK_PHASE_BUBBLE);
  g_signal_connect(click, "pressed", G_CALLBACK(number_pressed), self);
  gtk_widget_add_controller(GTK_WIDGET(self), GTK_EVENT_CONTROLLER(click));
  number_show(self);
}

GtkWidget *Suno_property_number_new(const char *label, const char *unit) {
  SunoPropertyNumber *self = g_object_new(SUNO_TYPE_PROPERTY_NUMBER, "accessible-role", GTK_ACCESSIBLE_ROLE_TEXT_BOX, NULL);
  if (label != NULL && *label != '\0') {
    self->label = gtk_label_new(label);
    gtk_widget_add_css_class(self->label, "SunoUI-creative-number-label");
    gtk_label_set_xalign(GTK_LABEL(self->label), 0);
    g_autofree char *tip = g_strdup_printf("Drag to change %s", label);
    gtk_widget_set_tooltip_text(self->label, tip);
    gtk_widget_set_cursor_from_name(self->label, "ew-resize");
    GtkGesture *drag = gtk_gesture_drag_new();
    g_signal_connect(drag, "drag-begin", G_CALLBACK(number_drag_begin), self);
    g_signal_connect(drag, "drag-update", G_CALLBACK(number_drag_update), self);
    gtk_widget_add_controller(self->label, GTK_EVENT_CONTROLLER(drag));
    gtk_box_prepend(GTK_BOX(self), self->label);
    Suno_property_number_set_name(self, label);
  }
  if (unit != NULL && *unit != '\0') {
    self->unit = gtk_label_new(unit);
    gtk_widget_add_css_class(self->unit, "SunoUI-creative-number-unit");
    gtk_box_append(GTK_BOX(self), self->unit);
  }
  return GTK_WIDGET(self);
}

void Suno_property_number_set_name(SunoPropertyNumber *self, const char *name) {
  g_return_if_fail(SUNO_IS_PROPERTY_NUMBER(self));
  g_return_if_fail(name != NULL);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), name);
  Suno_ui_set_accessible_label(self->text, name);
  if (self->label != NULL) {
    g_autofree char *tip = g_strdup_printf("Drag to change %s", name);
    gtk_widget_set_tooltip_text(self->label, tip);
  }
}

void Suno_property_number_set_value(SunoPropertyNumber *self, double value) {
  g_return_if_fail(SUNO_IS_PROPERTY_NUMBER(self));
  number_set_mixed_state(self, FALSE);
  self->value = number_clamp(self, value);
  number_show(self);
}

double Suno_property_number_get_value(SunoPropertyNumber *self) {
  g_return_val_if_fail(SUNO_IS_PROPERTY_NUMBER(self), 0);
  return self->value;
}

void Suno_property_number_set_mixed(SunoPropertyNumber *self) {
  g_return_if_fail(SUNO_IS_PROPERTY_NUMBER(self));
  number_set_mixed_state(self, TRUE);
  number_show(self);
}

gboolean Suno_property_number_get_mixed(SunoPropertyNumber *self) {
  g_return_val_if_fail(SUNO_IS_PROPERTY_NUMBER(self), FALSE);
  return self->mixed;
}

void Suno_property_number_set_range(SunoPropertyNumber *self, double minimum, double maximum) {
  g_return_if_fail(SUNO_IS_PROPERTY_NUMBER(self));
  if (minimum > maximum) {
    g_critical("a number's range runs from its least to its greatest value");
    return;
  }
  self->minimum = minimum;
  self->maximum = maximum;
  if (!self->mixed) {
    self->value = number_clamp(self, self->value);
    number_show(self);
  }
}

void Suno_property_number_set_step(SunoPropertyNumber *self, double step, guint digits) {
  g_return_if_fail(SUNO_IS_PROPERTY_NUMBER(self));
  if (step <= 0) {
    g_critical("a number's step is more than 0");
    return;
  }
  self->step = step;
  self->digits = MIN(digits, 6u);
  number_show(self);
}

void Suno_property_number_set_compact(SunoPropertyNumber *self, gboolean compact) {
  g_return_if_fail(SUNO_IS_PROPERTY_NUMBER(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "compact", compact);
  gtk_widget_set_hexpand(GTK_WIDGET(self), !compact);
}

/* ── SunoPropertyColor ── */

enum { COLOR_CHANGED, COLOR_COMMITTED, COLOR_OPEN_PICKER, COLOR_N_SIGNALS };
static guint color_signals[COLOR_N_SIGNALS];

struct _SunoPropertyColor {
  GtkBox parent_instance;
  GtkWidget *swatch;
  GtkWidget *paint;
  GtkWidget *hex;
  GtkWidget *popover;
  GdkRGBA rgba;
  char *word;
  GArray *palette; /* GdkRGBA */
  char *label;
  SunoActionCenter *center; /* weak: grows with the picker instead of a popover */
};

G_DEFINE_FINAL_TYPE(SunoPropertyColor, Suno_property_color, GTK_TYPE_BOX)

char *Suno_property_color_format(const GdkRGBA *rgba) {
  g_return_val_if_fail(rgba != NULL, NULL);
  int r = (int)lround(CLAMP(rgba->red, 0, 1) * 255), g = (int)lround(CLAMP(rgba->green, 0, 1) * 255);
  int b = (int)lround(CLAMP(rgba->blue, 0, 1) * 255), a = (int)lround(CLAMP(rgba->alpha, 0, 1) * 255);
  return a == 255 ? g_strdup_printf("%02X%02X%02X", r, g, b) : g_strdup_printf("%02X%02X%02X%02X", r, g, b, a);
}

gboolean Suno_property_color_parse(const char *text, GdkRGBA *rgba) {
  g_return_val_if_fail(text != NULL, FALSE);
  g_autofree char *clean = g_strstrip(g_strdup(text));
  const char *hex = clean[0] == '#' ? clean + 1 : clean;
  size_t len = strlen(hex);
  if (len != 3 && len != 6 && len != 8)
    return FALSE;
  for (size_t i = 0; i < len; i++)
    if (!g_ascii_isxdigit(hex[i]))
      return FALSE;
  g_autofree char *full = len == 3 ? g_strdup_printf("%c%c%c%c%c%c", hex[0], hex[0], hex[1], hex[1], hex[2], hex[2])
                                   : g_strdup(hex);
  guint channels[4] = {0, 0, 0, 255};
  for (guint i = 0; i < strlen(full) / 2; i++)
    channels[i] = (guint)(g_ascii_xdigit_value(full[i * 2]) * 16 + g_ascii_xdigit_value(full[i * 2 + 1]));
  if (rgba != NULL) {
    rgba->red = channels[0] / 255.0f;
    rgba->green = channels[1] / 255.0f;
    rgba->blue = channels[2] / 255.0f;
    rgba->alpha = channels[3] / 255.0f;
  }
  return TRUE;
}

static void paint_swatch(GtkDrawingArea *area G_GNUC_UNUSED, cairo_t *cr, int width, int height, gpointer data) {
  const GdkRGBA *rgba = data;
  double radius = 8.0;
  cairo_new_sub_path(cr);
  cairo_arc(cr, width - radius, radius, radius, -G_PI / 2, 0);
  cairo_arc(cr, width - radius, height - radius, radius, 0, G_PI / 2);
  cairo_arc(cr, radius, height - radius, radius, G_PI / 2, G_PI);
  cairo_arc(cr, radius, radius, radius, G_PI, 3 * G_PI / 2);
  cairo_close_path(cr);
  gdk_cairo_set_source_rgba(cr, rgba);
  cairo_fill(cr);
}

static GtkWidget *swatch_area(const GdkRGBA *rgba) {
  GtkWidget *area = gtk_drawing_area_new();
  gtk_drawing_area_set_draw_func(GTK_DRAWING_AREA(area), paint_swatch, (gpointer)rgba, NULL);
  gtk_widget_set_can_target(area, FALSE);
  return area;
}

static void color_show(SunoPropertyColor *self) {
  if (self->word != NULL) {
    gtk_editable_set_text(GTK_EDITABLE(self->hex), self->word);
    gtk_editable_set_editable(GTK_EDITABLE(self->hex), FALSE);
  } else {
    g_autofree char *code = Suno_property_color_format(&self->rgba);
    gtk_editable_set_text(GTK_EDITABLE(self->hex), code);
    gtk_editable_set_editable(GTK_EDITABLE(self->hex), TRUE);
  }
  gtk_widget_queue_draw(self->paint);
}

static void color_apply(SunoPropertyColor *self, const GdkRGBA *rgba) {
  g_clear_pointer(&self->word, g_free);
  self->rgba = *rgba;
  color_show(self);
  g_signal_emit(self, color_signals[COLOR_CHANGED], 0, &self->rgba);
}

static void color_commit(SunoPropertyColor *self) {
  if (self->word != NULL)
    return;
  GdkRGBA parsed;
  if (!Suno_property_color_parse(gtk_editable_get_text(GTK_EDITABLE(self->hex)), &parsed) ||
      gdk_rgba_equal(&parsed, &self->rgba)) {
    color_show(self);
    return;
  }
  color_apply(self, &parsed);
  g_signal_emit(self, color_signals[COLOR_COMMITTED], 0, &self->rgba);
}

static void hex_activated(GtkEntry *entry G_GNUC_UNUSED, gpointer user_data) {
  color_commit(SUNO_PROPERTY_COLOR(user_data));
}

static void hex_left(GtkEventControllerFocus *focus G_GNUC_UNUSED, gpointer user_data) {
  color_commit(SUNO_PROPERTY_COLOR(user_data));
}

static void picker_changed(SunoColorPicker *picker G_GNUC_UNUSED, GdkRGBA *rgba, gpointer user_data) {
  SunoPropertyColor *self = user_data;
  if (self->word == NULL && gdk_rgba_equal(rgba, &self->rgba))
    return;
  color_apply(self, rgba);
}

static void picker_committed(SunoColorPicker *picker G_GNUC_UNUSED, GdkRGBA *rgba, gpointer user_data) {
  g_signal_emit(user_data, color_signals[COLOR_COMMITTED], 0, rgba);
}

/* A picker on this field: it shows the field's colour and palette, and its changes are the field's. */
static GtkWidget *picker_for(SunoPropertyColor *self) {
  GtkWidget *picker = Suno_color_picker_new();
  Suno_color_picker_set_rgba(SUNO_COLOR_PICKER(picker), &self->rgba);
  if (self->palette != NULL)
    Suno_color_picker_set_palette(SUNO_COLOR_PICKER(picker), (const GdkRGBA *)self->palette->data,
                                  self->palette->len);
  g_signal_connect_object(picker, "color-changed", G_CALLBACK(picker_changed), self, 0);
  g_signal_connect_object(picker, "color-committed", G_CALLBACK(picker_committed), self, 0);
  return picker;
}

static void swatch_clicked(GtkButton *button G_GNUC_UNUSED, gpointer user_data) {
  SunoPropertyColor *self = user_data;
  GtkWidget *picker = g_object_ref_sink(picker_for(self));
  gboolean handled = FALSE;
  g_signal_emit(self, color_signals[COLOR_OPEN_PICKER], 0, picker, &handled);
  if (!handled && self->center != NULL) {
    Suno_action_center_grow_panel(self->center, "SunoUI-color", picker);
  } else if (!handled) {
    if (self->popover == NULL) {
      self->popover = gtk_popover_new();
      gtk_widget_add_css_class(self->popover, "SunoUI-color-picker-popover");
      gtk_popover_set_has_arrow(GTK_POPOVER(self->popover), FALSE);
      gtk_widget_set_parent(self->popover, self->swatch);
    }
    gtk_popover_set_child(GTK_POPOVER(self->popover), picker);
    gtk_popover_popup(GTK_POPOVER(self->popover));
  }
  g_object_unref(picker);
}

static void Suno_property_color_dispose(GObject *object) {
  SunoPropertyColor *self = SUNO_PROPERTY_COLOR(object);
  g_clear_pointer(&self->popover, gtk_widget_unparent);
  g_clear_weak_pointer(&self->center);
  G_OBJECT_CLASS(Suno_property_color_parent_class)->dispose(object);
}

static void Suno_property_color_finalize(GObject *object) {
  SunoPropertyColor *self = SUNO_PROPERTY_COLOR(object);
  g_free(self->word);
  g_free(self->label);
  g_clear_pointer(&self->palette, g_array_unref);
  G_OBJECT_CLASS(Suno_property_color_parent_class)->finalize(object);
}

static void Suno_property_color_class_init(SunoPropertyColorClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  object_class->dispose = Suno_property_color_dispose;
  object_class->finalize = Suno_property_color_finalize;
  gtk_widget_class_set_accessible_role(GTK_WIDGET_CLASS(klass), GTK_ACCESSIBLE_ROLE_GROUP);
  /**
   * SunoPropertyColor::color-changed:
   * @self: the field
   * @rgba: the colour a person is picking or typed
   *
   * Every change, live while the picker is dragged (preview it).
   */
  color_signals[COLOR_CHANGED] = g_signal_new("color-changed", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL,
                                              NULL, NULL, G_TYPE_NONE, 1, GDK_TYPE_RGBA);
  /**
   * SunoPropertyColor::color-committed:
   * @self: the field
   * @rgba: the colour picked
   *
   * Once per finished change (a drag let go, a swatch, the eyedropper, a
   * typed code): one undo step.
   */
  color_signals[COLOR_COMMITTED] = g_signal_new("color-committed", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0,
                                                NULL, NULL, NULL, G_TYPE_NONE, 1, GDK_TYPE_RGBA);
  /**
   * SunoPropertyColor::open-picker:
   * @self: the field
   * @picker: a #SunoColorPicker on this field, ready to show
   *
   * The swatch was pressed. Return %TRUE after showing @picker yourself (a
   * grown panel of your own ActionCenter); otherwise it opens in the action
   * center set with Suno_property_color_set_action_center(), or in a popover
   * from the swatch.
   *
   * Returns: whether the handler showed the picker
   */
  color_signals[COLOR_OPEN_PICKER] = g_signal_new("open-picker", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0,
                                                  g_signal_accumulator_true_handled, NULL, NULL, G_TYPE_BOOLEAN, 1,
                                                  SUNO_TYPE_COLOR_PICKER);
}

static void Suno_property_color_init(SunoPropertyColor *self) {
  Suno_creative_install();
  self->rgba = (GdkRGBA){0, 0, 0, 1};
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_HORIZONTAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-creative-color");
  self->swatch = gtk_button_new();
  gtk_widget_add_css_class(self->swatch, "SunoUI-creative-swatch");
  gtk_widget_set_valign(self->swatch, GTK_ALIGN_CENTER);
  self->paint = swatch_area(&self->rgba);
  gtk_button_set_child(GTK_BUTTON(self->swatch), self->paint);
  g_signal_connect(self->swatch, "clicked", G_CALLBACK(swatch_clicked), self);
  gtk_accessible_update_property(GTK_ACCESSIBLE(self->swatch), GTK_ACCESSIBLE_PROPERTY_HAS_POPUP, TRUE, -1);
  gtk_box_append(GTK_BOX(self), self->swatch);
  self->hex = gtk_entry_new();
  gtk_widget_add_css_class(self->hex, "SunoUI-creative-hex");
  Suno_ui_apply_type(self->hex, "mono");
  gtk_widget_set_hexpand(self->hex, TRUE);
  gtk_editable_set_width_chars(GTK_EDITABLE(self->hex), 6);
  gtk_entry_set_max_length(GTK_ENTRY(self->hex), 16);
  g_signal_connect(self->hex, "activate", G_CALLBACK(hex_activated), self);
  GtkEventController *focus = gtk_event_controller_focus_new();
  g_signal_connect(focus, "leave", G_CALLBACK(hex_left), self);
  gtk_widget_add_controller(self->hex, focus);
  gtk_box_append(GTK_BOX(self), self->hex);
  color_show(self);
}

GtkWidget *Suno_property_color_new(const char *label) {
  g_return_val_if_fail(label != NULL, NULL);
  SunoPropertyColor *self = g_object_new(SUNO_TYPE_PROPERTY_COLOR, "accessible-role", GTK_ACCESSIBLE_ROLE_GROUP, NULL);
  self->label = g_strdup(label);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), label);
  g_autofree char *code = g_strdup_printf("%s colour code", label);
  Suno_ui_set_accessible_label(self->hex, code);
  g_autofree char *pick = g_strdup_printf("%s colour", label);
  Suno_ui_set_accessible_label(self->swatch, pick);
  return GTK_WIDGET(self);
}

void Suno_property_color_set_rgba(SunoPropertyColor *self, const GdkRGBA *rgba) {
  g_return_if_fail(SUNO_IS_PROPERTY_COLOR(self));
  g_return_if_fail(rgba != NULL);
  g_clear_pointer(&self->word, g_free);
  self->rgba = *rgba;
  color_show(self);
}

void Suno_property_color_get_rgba(SunoPropertyColor *self, GdkRGBA *rgba) {
  g_return_if_fail(SUNO_IS_PROPERTY_COLOR(self));
  g_return_if_fail(rgba != NULL);
  *rgba = self->rgba;
}

void Suno_property_color_set_word(SunoPropertyColor *self, const char *word) {
  g_return_if_fail(SUNO_IS_PROPERTY_COLOR(self));
  g_free(self->word);
  self->word = g_strdup(word);
  color_show(self);
}

void Suno_property_color_set_palette(SunoPropertyColor *self, const GdkRGBA *colors, guint n_colors) {
  g_return_if_fail(SUNO_IS_PROPERTY_COLOR(self));
  g_return_if_fail(colors != NULL || n_colors == 0);
  g_clear_pointer(&self->palette, g_array_unref);
  if (n_colors > 0) {
    self->palette = g_array_sized_new(FALSE, FALSE, sizeof(GdkRGBA), n_colors);
    g_array_append_vals(self->palette, colors, n_colors);
  }
}

void Suno_property_color_set_action_center(SunoPropertyColor *self, SunoActionCenter *center) {
  g_return_if_fail(SUNO_IS_PROPERTY_COLOR(self));
  g_return_if_fail(center == NULL || SUNO_IS_ACTION_CENTER(center));
  g_set_weak_pointer(&self->center, center);
}

void Suno_property_color_add_suffix(SunoPropertyColor *self, GtkWidget *widget) {
  g_return_if_fail(SUNO_IS_PROPERTY_COLOR(self));
  g_return_if_fail(GTK_IS_WIDGET(widget));
  gtk_widget_set_valign(widget, GTK_ALIGN_CENTER);
  gtk_box_append(GTK_BOX(self), widget);
}

/* ── SunoPropertyChoice ── */

enum { CHOICE_CHANGED, CHOICE_N_SIGNALS };
static guint choice_signals[CHOICE_N_SIGNALS];

typedef struct {
  char *key;
  char *label;
  char *icon;
  GtkWidget *segment;
} Choice;

struct _SunoPropertyChoice {
  GtkWidget parent_instance;
  SunoChoiceKind kind;
  GtkWidget *child;
  GtkWidget *value; /* the menu well's label */
  GPtrArray *choices;
  char *current;
  char *label;
  gboolean mixed;
  gboolean selecting;
};

G_DEFINE_FINAL_TYPE(SunoPropertyChoice, Suno_property_choice, GTK_TYPE_WIDGET)

GType Suno_choice_kind_get_type(void) {
  static gsize type_id = 0;
  static const GEnumValue values[] = {
    {SUNO_CHOICE_KIND_MENU, "SUNO_CHOICE_KIND_MENU", "menu"},
    {SUNO_CHOICE_KIND_SEGMENTS, "SUNO_CHOICE_KIND_SEGMENTS", "segments"},
    {0, NULL, NULL},
  };
  if (g_once_init_enter(&type_id))
    g_once_init_leave(&type_id, g_enum_register_static(g_intern_static_string("SunoChoiceKind"), values));
  return type_id;
}

static void choice_free(gpointer data) {
  Choice *choice = data;
  g_free(choice->key);
  g_free(choice->label);
  g_free(choice->icon);
  g_free(choice);
}

static Choice *find_choice(SunoPropertyChoice *self, const char *key) {
  for (guint i = 0; i < self->choices->len; i++) {
    Choice *choice = g_ptr_array_index(self->choices, i);
    if (g_strcmp0(choice->key, key) == 0)
      return choice;
  }
  return NULL;
}

static void choice_refresh(SunoPropertyChoice *self) {
  Choice *current = self->mixed ? NULL : find_choice(self, self->current);
  if (self->kind == SUNO_CHOICE_KIND_MENU) {
    gtk_label_set_text(GTK_LABEL(self->value), self->mixed ? "Mixed" : current != NULL ? current->label : "");
    g_autofree char *spoken = g_strdup_printf("%s, %s", self->label, self->mixed ? "Mixed" : current != NULL ? current->label : "");
    Suno_ui_set_accessible_label(self->child, spoken);
    return;
  }
  self->selecting = TRUE;
  for (guint i = 0; i < self->choices->len; i++) {
    Choice *choice = g_ptr_array_index(self->choices, i);
    gboolean on = choice == current;
    gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(choice->segment), on);
    Suno_ui_set_css_class(choice->segment, "on", on);
  }
  int index = -1;
  for (guint i = 0; current != NULL && i < self->choices->len; i++)
    if (g_ptr_array_index(self->choices, i) == current)
      index = (int)i;
  Suno_creative_segments_set_index(self->child, index);
  self->selecting = FALSE;
}

static void choice_select(SunoPropertyChoice *self, const char *key, gboolean notify) {
  gboolean changed = self->mixed || g_strcmp0(key, self->current) != 0;
  self->mixed = FALSE;
  g_free(self->current);
  self->current = g_strdup(key);
  choice_refresh(self);
  if (notify && changed)
    g_signal_emit(self, choice_signals[CHOICE_CHANGED], 0, self->current);
}

static void choice_pick(GSimpleAction *action G_GNUC_UNUSED, GVariant *parameter, gpointer user_data) {
  SunoPropertyChoice *self = user_data;
  const char *key = g_variant_get_string(parameter, NULL);
  if (find_choice(self, key) != NULL)
    choice_select(self, key, TRUE);
}

static void select_clicked(GtkButton *button, gpointer user_data) {
  SunoPropertyChoice *self = user_data;
  GtkWidget *menu = Suno_floating_menu_new(self->label);
  for (guint i = 0; i < self->choices->len; i++) {
    Choice *choice = g_ptr_array_index(self->choices, i);
    g_autoptr(GVariant) target = g_variant_ref_sink(g_variant_new_string(choice->key));
    g_autofree char *action = g_action_print_detailed_name("creative-choice.pick", target);
    Suno_floating_menu_add_item(SUNO_FLOATING_MENU(menu), choice->label, choice->icon, NULL, NULL, action,
                                !self->mixed && g_strcmp0(choice->key, self->current) == 0);
  }
  Suno_floating_menu_popup(SUNO_FLOATING_MENU(menu), GTK_WIDGET(button));
  if (g_object_is_floating(menu)) {
    g_object_ref_sink(menu);
    g_object_unref(menu);
  }
}

static void segment_toggled(GtkToggleButton *button, gpointer user_data) {
  SunoPropertyChoice *self = user_data;
  if (self->selecting || !gtk_toggle_button_get_active(button))
    return;
  choice_select(self, g_object_get_data(G_OBJECT(button), "Suno-choice-key"), TRUE);
}

static void Suno_property_choice_dispose(GObject *object) {
  SunoPropertyChoice *self = SUNO_PROPERTY_CHOICE(object);
  g_clear_pointer(&self->child, gtk_widget_unparent);
  G_OBJECT_CLASS(Suno_property_choice_parent_class)->dispose(object);
}

static void Suno_property_choice_finalize(GObject *object) {
  SunoPropertyChoice *self = SUNO_PROPERTY_CHOICE(object);
  g_clear_pointer(&self->choices, g_ptr_array_unref);
  g_free(self->current);
  g_free(self->label);
  G_OBJECT_CLASS(Suno_property_choice_parent_class)->finalize(object);
}

static void Suno_property_choice_class_init(SunoPropertyChoiceClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  object_class->dispose = Suno_property_choice_dispose;
  object_class->finalize = Suno_property_choice_finalize;
  gtk_widget_class_set_layout_manager_type(GTK_WIDGET_CLASS(klass), GTK_TYPE_BIN_LAYOUT);
  /**
   * SunoPropertyChoice::changed:
   * @self: the choice
   * @key: the key a person chose
   */
  choice_signals[CHOICE_CHANGED] = g_signal_new("changed", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL,
                                                NULL, NULL, G_TYPE_NONE, 1, G_TYPE_STRING);
}

static void Suno_property_choice_init(SunoPropertyChoice *self) {
  Suno_creative_install();
  self->choices = g_ptr_array_new_with_free_func(choice_free);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-creative-choice");
  gtk_widget_set_hexpand(GTK_WIDGET(self), TRUE);
  GSimpleActionGroup *group = g_simple_action_group_new();
  GSimpleAction *pick = g_simple_action_new("pick", G_VARIANT_TYPE_STRING);
  g_signal_connect(pick, "activate", G_CALLBACK(choice_pick), self);
  g_action_map_add_action(G_ACTION_MAP(group), G_ACTION(pick));
  g_object_unref(pick);
  gtk_widget_insert_action_group(GTK_WIDGET(self), "creative-choice", G_ACTION_GROUP(group));
  g_object_unref(group);
}

GtkWidget *Suno_property_choice_new(SunoChoiceKind kind, const char *label) {
  g_return_val_if_fail(label != NULL, NULL);
  SunoPropertyChoice *self = g_object_new(SUNO_TYPE_PROPERTY_CHOICE, NULL);
  self->kind = kind;
  self->label = g_strdup(label);
  if (kind == SUNO_CHOICE_KIND_MENU) {
    self->child = gtk_button_new();
    gtk_widget_add_css_class(self->child, "SunoUI-creative-select");
    GtkWidget *line = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
    self->value = gtk_label_new(NULL);
    gtk_label_set_xalign(GTK_LABEL(self->value), 0);
    gtk_label_set_ellipsize(GTK_LABEL(self->value), PANGO_ELLIPSIZE_END);
    gtk_widget_set_hexpand(self->value, TRUE);
    gtk_box_append(GTK_BOX(line), self->value);
    gtk_box_append(GTK_BOX(line), Suno_ui_icon_image("chevron-down", 0));
    gtk_button_set_child(GTK_BUTTON(self->child), line);
    gtk_accessible_update_property(GTK_ACCESSIBLE(self->child), GTK_ACCESSIBLE_PROPERTY_HAS_POPUP, TRUE, -1);
    g_signal_connect(self->child, "clicked", G_CALLBACK(select_clicked), self);
  } else {
    self->child = Suno_creative_segments_new("SunoUI-creative-segments");
    Suno_ui_set_accessible_label(self->child, label);
  }
  gtk_widget_set_parent(self->child, GTK_WIDGET(self));
  choice_refresh(self);
  return GTK_WIDGET(self);
}

void Suno_property_choice_add(SunoPropertyChoice *self, const char *key, const char *label, const char *icon) {
  g_return_if_fail(SUNO_IS_PROPERTY_CHOICE(self));
  g_return_if_fail(key != NULL && label != NULL);
  if (find_choice(self, key) != NULL) {
    g_critical("choice keys are unique: '%s' is already a choice", key);
    return;
  }
  Choice *choice = g_new0(Choice, 1);
  choice->key = g_strdup(key);
  choice->label = g_strdup(label);
  choice->icon = g_strdup(icon);
  if (self->kind == SUNO_CHOICE_KIND_SEGMENTS) {
    choice->segment = g_object_new(GTK_TYPE_TOGGLE_BUTTON, "accessible-role", GTK_ACCESSIBLE_ROLE_RADIO, NULL);
    gtk_widget_add_css_class(choice->segment, "SunoUI-creative-tab");
    if (icon != NULL) {
      gtk_button_set_child(GTK_BUTTON(choice->segment), Suno_ui_icon_image(icon, 0));
      gtk_widget_set_tooltip_text(choice->segment, label);
    } else {
      gtk_button_set_label(GTK_BUTTON(choice->segment), label);
    }
    Suno_ui_set_accessible_label(choice->segment, label);
    if (self->choices->len > 0) {
      Choice *first = g_ptr_array_index(self->choices, 0);
      gtk_toggle_button_set_group(GTK_TOGGLE_BUTTON(choice->segment), GTK_TOGGLE_BUTTON(first->segment));
    }
    g_object_set_data_full(G_OBJECT(choice->segment), "Suno-choice-key", g_strdup(key), g_free);
    g_signal_connect(choice->segment, "toggled", G_CALLBACK(segment_toggled), self);
    gtk_box_append(GTK_BOX(Suno_creative_segments_get_row(self->child)), choice->segment);
  }
  g_ptr_array_add(self->choices, choice);
  if (self->current == NULL)
    self->current = g_strdup(key);
  choice_refresh(self);
}

void Suno_property_choice_set_current(SunoPropertyChoice *self, const char *key) {
  g_return_if_fail(SUNO_IS_PROPERTY_CHOICE(self));
  g_return_if_fail(key != NULL);
  if (find_choice(self, key) == NULL) {
    g_critical("unknown choice '%s'", key);
    return;
  }
  choice_select(self, key, FALSE);
}

const char *Suno_property_choice_get_current(SunoPropertyChoice *self) {
  g_return_val_if_fail(SUNO_IS_PROPERTY_CHOICE(self), NULL);
  return self->mixed ? NULL : self->current;
}

void Suno_property_choice_set_mixed(SunoPropertyChoice *self) {
  g_return_if_fail(SUNO_IS_PROPERTY_CHOICE(self));
  self->mixed = TRUE;
  choice_refresh(self);
}

/* ── SunoAlignmentActions ── */

enum { ALIGN, ALIGN_N_SIGNALS };
static guint align_signals[ALIGN_N_SIGNALS];

struct _SunoAlignmentActions {
  GtkBox parent_instance;
  char *action_name;
};

G_DEFINE_FINAL_TYPE(SunoAlignmentActions, Suno_alignment_actions, GTK_TYPE_BOX)

static const struct {
  const char *key;
  const char *label;
  const char *icon;
} alignments[] = {
  {"left", "Align left", "align-start-vertical"},
  {"center", "Align centre", "align-center-vertical"},
  {"right", "Align right", "align-end-vertical"},
  {"top", "Align top", "align-start-horizontal"},
  {"middle", "Align middle", "align-center-horizontal"},
  {"bottom", "Align bottom", "align-end-horizontal"},
};

static void align_clicked(GtkButton *button, gpointer user_data) {
  SunoAlignmentActions *self = user_data;
  const char *key = g_object_get_data(G_OBJECT(button), "Suno-align-key");
  g_signal_emit(self, align_signals[ALIGN], 0, key);
  if (self->action_name != NULL)
    Suno_creative_activate_action(GTK_WIDGET(button), self->action_name, g_variant_new_string(key));
}

static void Suno_alignment_actions_finalize(GObject *object) {
  g_free(SUNO_ALIGNMENT_ACTIONS(object)->action_name);
  G_OBJECT_CLASS(Suno_alignment_actions_parent_class)->finalize(object);
}

static void Suno_alignment_actions_class_init(SunoAlignmentActionsClass *klass) {
  G_OBJECT_CLASS(klass)->finalize = Suno_alignment_actions_finalize;
  gtk_widget_class_set_accessible_role(GTK_WIDGET_CLASS(klass), GTK_ACCESSIBLE_ROLE_TOOLBAR);
  /**
   * SunoAlignmentActions::align:
   * @self: the alignments
   * @key: "left", "center", "right", "top", "middle" or "bottom"
   */
  align_signals[ALIGN] = g_signal_new("align", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                      G_TYPE_NONE, 1, G_TYPE_STRING);
}

static void Suno_alignment_actions_init(SunoAlignmentActions *self) {
  Suno_creative_install();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_HORIZONTAL);
  gtk_box_set_homogeneous(GTK_BOX(self), FALSE);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-creative-align");
  Suno_ui_set_accessible_label(GTK_WIDGET(self), "Align");
  for (guint i = 0; i < G_N_ELEMENTS(alignments); i++) {
    GtkWidget *button = Suno_ui_icon_button(alignments[i].icon, alignments[i].label, "SunoUI-creative-align-button",
                                            FALSE, NULL);
    gtk_widget_set_hexpand(button, TRUE);
    gtk_widget_set_halign(button, i == 0 ? GTK_ALIGN_START : i == G_N_ELEMENTS(alignments) - 1 ? GTK_ALIGN_END
                                                                                              : GTK_ALIGN_CENTER);
    g_object_set_data(G_OBJECT(button), "Suno-align-key", (gpointer)alignments[i].key);
    g_signal_connect(button, "clicked", G_CALLBACK(align_clicked), self);
    gtk_box_append(GTK_BOX(self), button);
  }
  Suno_ui_arrow_keys(GTK_WIDGET(self), GTK_ORIENTATION_HORIZONTAL, FALSE);
}

GtkWidget *Suno_alignment_actions_new(const char *action_name) {
  SunoAlignmentActions *self = g_object_new(SUNO_TYPE_ALIGNMENT_ACTIONS, "accessible-role", GTK_ACCESSIBLE_ROLE_TOOLBAR, NULL);
  self->action_name = g_strdup(action_name);
  return GTK_WIDGET(self);
}
