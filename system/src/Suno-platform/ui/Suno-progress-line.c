/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-progress-line.h"
#include "Suno-ui-private.h"

#include <math.h>

struct _SunoProgressLine {
  GtkWidget parent_instance;
  GtkWidget *fill;
  double fraction;
  char *label;
};
G_DEFINE_FINAL_TYPE(SunoProgressLine, Suno_progress_line, GTK_TYPE_WIDGET)

static const char *const sizes[] = {"row", "tile", "meter", "hero", "well"};
static const char *const tones[] = {"accent", "good", "neutral", "warning", "danger", "chart"};

static gboolean one_of(const char *value, const char *const *choices, guint n) {
  for (guint i = 0; i < n; i++)
    if (g_str_equal(value, choices[i]))
      return TRUE;
  return FALSE;
}

static void speak(SunoProgressLine *self) {
  int percent = (int)round(self->fraction * 100);
  g_autofree char *text = g_strdup_printf("%d%%", percent);
  gtk_accessible_update_property(GTK_ACCESSIBLE(self), GTK_ACCESSIBLE_PROPERTY_VALUE_MIN, 0.0,
                                 GTK_ACCESSIBLE_PROPERTY_VALUE_MAX, 100.0, GTK_ACCESSIBLE_PROPERTY_VALUE_NOW,
                                 (double)percent, GTK_ACCESSIBLE_PROPERTY_VALUE_TEXT, text, -1);
  if (self->label != NULL)
    Suno_ui_set_accessible_label(GTK_WIDGET(self), self->label);
}

static void progress_measure(GtkWidget *widget G_GNUC_UNUSED, GtkOrientation orientation G_GNUC_UNUSED,
                             int for_size G_GNUC_UNUSED, int *minimum, int *natural, int *min_baseline,
                             int *nat_baseline) {
  /* The track's height is its CSS min-height; its width is whatever it is given. */
  *minimum = *natural = 0;
  *min_baseline = *nat_baseline = -1;
}

static void progress_allocate(GtkWidget *widget, int width, int height, int baseline G_GNUC_UNUSED) {
  SunoProgressLine *self = SUNO_PROGRESS_LINE(widget);
  int filled = (int)round(width * self->fraction);
  int x = gtk_widget_get_direction(widget) == GTK_TEXT_DIR_RTL ? width - filled : 0;
  gtk_widget_set_child_visible(self->fill, filled > 0);
  gtk_widget_allocate(self->fill, filled, height, -1, gsk_transform_translate(NULL, &GRAPHENE_POINT_INIT(x, 0)));
}

static void progress_dispose(GObject *object) {
  SunoProgressLine *self = SUNO_PROGRESS_LINE(object);
  g_clear_pointer(&self->fill, gtk_widget_unparent);
  g_clear_pointer(&self->label, g_free);
  G_OBJECT_CLASS(Suno_progress_line_parent_class)->dispose(object);
}

static void Suno_progress_line_class_init(SunoProgressLineClass *klass) {
  G_OBJECT_CLASS(klass)->dispose = progress_dispose;
  GTK_WIDGET_CLASS(klass)->measure = progress_measure;
  GTK_WIDGET_CLASS(klass)->size_allocate = progress_allocate;
  gtk_widget_class_set_accessible_role(GTK_WIDGET_CLASS(klass), GTK_ACCESSIBLE_ROLE_PROGRESS_BAR);
}

static void Suno_progress_line_init(SunoProgressLine *self) {
  Suno_ui_install();
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-progress");
  gtk_widget_set_hexpand(GTK_WIDGET(self), TRUE);
  gtk_widget_set_valign(GTK_WIDGET(self), GTK_ALIGN_CENTER);
  gtk_widget_set_overflow(GTK_WIDGET(self), GTK_OVERFLOW_HIDDEN);
  self->fill = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(self->fill, "SunoUI-progress-fill");
  gtk_widget_set_parent(self->fill, GTK_WIDGET(self));
}

GtkWidget *Suno_progress_line_new(double fraction, const char *size, const char *tone) {
  if (size == NULL)
    size = "row";
  if (tone == NULL)
    tone = "accent";
  g_return_val_if_fail(one_of(size, sizes, G_N_ELEMENTS(sizes)), NULL);
  g_return_val_if_fail(one_of(tone, tones, G_N_ELEMENTS(tones)), NULL);
  SunoProgressLine *self = g_object_new(SUNO_TYPE_PROGRESS_LINE, NULL);
  gtk_widget_add_css_class(GTK_WIDGET(self), size);
  gtk_widget_add_css_class(GTK_WIDGET(self), tone);
  Suno_progress_line_set_fraction(self, fraction);
  return GTK_WIDGET(self);
}

void Suno_progress_line_set_fraction(SunoProgressLine *self, double fraction) {
  g_return_if_fail(SUNO_IS_PROGRESS_LINE(self));
  self->fraction = isnan(fraction) ? 0.0 : CLAMP(fraction, 0.0, 1.0); /* NaN is nothing done */
  speak(self);
  gtk_widget_queue_allocate(GTK_WIDGET(self));
}

double Suno_progress_line_get_fraction(SunoProgressLine *self) {
  g_return_val_if_fail(SUNO_IS_PROGRESS_LINE(self), 0.0);
  return self->fraction;
}

void Suno_progress_line_set_label(SunoProgressLine *self, const char *label) {
  g_return_if_fail(SUNO_IS_PROGRESS_LINE(self));
  g_free(self->label);
  self->label = g_strdup(label);
  speak(self);
}
