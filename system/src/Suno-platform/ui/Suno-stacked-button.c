/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of action_stack.StackedButton / StackedButtons (Python). */
#include "Suno-stacked-button.h"
#include "Suno-ui-private.h"

#define STACKED_LABEL_CHARS 14

struct _SunoStackedButton {
  GtkButton parent_instance;
  gboolean danger;
};

G_DEFINE_FINAL_TYPE(SunoStackedButton, Suno_stacked_button, GTK_TYPE_BUTTON)

static void Suno_stacked_button_class_init(SunoStackedButtonClass *klass G_GNUC_UNUSED) {}

static void Suno_stacked_button_init(SunoStackedButton *self) {
  Suno_ui_install();
  gtk_widget_set_hexpand(GTK_WIDGET(self), TRUE);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-stacked-button");
}

GtkWidget *Suno_stacked_button_new(const char *icon, const char *label, gboolean danger) {
  g_return_val_if_fail(icon != NULL && *icon != '\0', NULL);
  g_return_val_if_fail(label != NULL, NULL);
  SunoStackedButton *self = g_object_new(SUNO_TYPE_STACKED_BUTTON, NULL);
  self->danger = danger;
  if (danger)
    gtk_widget_add_css_class(GTK_WIDGET(self), "danger");
  GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_halign(box, GTK_ALIGN_CENTER);
  gtk_widget_set_valign(box, GTK_ALIGN_CENTER);
  gtk_widget_add_css_class(box, "SunoUI-stacked-content");
  GtkWidget *glyph = Suno_ui_icon_image(icon, 0);
  gtk_widget_add_css_class(glyph, "SunoUI-stacked-icon");
  gtk_widget_set_halign(glyph, GTK_ALIGN_CENTER);
  /* A short label always fits (its width is asked for); a long one ellipsizes. */
  glong length = g_utf8_strlen(label, -1);
  GtkWidget *text = gtk_label_new(label);
  gtk_label_set_ellipsize(GTK_LABEL(text), PANGO_ELLIPSIZE_END);
  gtk_label_set_width_chars(GTK_LABEL(text), (int)MIN(length, STACKED_LABEL_CHARS));
  gtk_label_set_max_width_chars(GTK_LABEL(text), STACKED_LABEL_CHARS);
  gtk_widget_add_css_class(text, "SunoUI-stacked-label");
  gtk_box_append(GTK_BOX(box), glyph);
  gtk_box_append(GTK_BOX(box), text);
  gtk_button_set_child(GTK_BUTTON(self), box);
  if (length > STACKED_LABEL_CHARS)
    gtk_widget_set_tooltip_text(GTK_WIDGET(self), label);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), label);
  return GTK_WIDGET(self);
}

struct _SunoStackedButtons {
  GtkBox parent_instance;
  guint count;
};

G_DEFINE_FINAL_TYPE(SunoStackedButtons, Suno_stacked_buttons, GTK_TYPE_BOX)

static void Suno_stacked_buttons_map(GtkWidget *widget) {
  SunoStackedButtons *self = SUNO_STACKED_BUTTONS(widget);
  if (self->count != 2 && self->count != 3)
    g_critical("stacked buttons come in equal pairs or trios (this group has %u)", self->count);
  GTK_WIDGET_CLASS(Suno_stacked_buttons_parent_class)->map(widget);
}

static void Suno_stacked_buttons_class_init(SunoStackedButtonsClass *klass) {
  GTK_WIDGET_CLASS(klass)->map = Suno_stacked_buttons_map;
}

static void Suno_stacked_buttons_init(SunoStackedButtons *self) {
  Suno_ui_install();
  /* Spacing is the stack token (border-spacing in the sheet), not a number here. */
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_HORIZONTAL);
  gtk_box_set_homogeneous(GTK_BOX(self), TRUE);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-stacked-buttons");
}

GtkWidget *Suno_stacked_buttons_new(gboolean small) {
  GtkWidget *self = g_object_new(SUNO_TYPE_STACKED_BUTTONS, NULL);
  if (small)
    gtk_widget_add_css_class(self, "SunoUI-stack-small");
  return self;
}

void Suno_stacked_buttons_append(SunoStackedButtons *self, SunoStackedButton *button) {
  g_return_if_fail(SUNO_IS_STACKED_BUTTONS(self));
  g_return_if_fail(SUNO_IS_STACKED_BUTTON(button));
  if (self->count >= 3) {
    g_critical("stacked buttons come in equal pairs or trios; not adding a fourth");
    return;
  }
  self->count++;
  gtk_box_append(GTK_BOX(self), GTK_WIDGET(button));
}
