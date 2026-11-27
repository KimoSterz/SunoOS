/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-action-bar.h"

struct _SunoActionBar {
  GtkBox parent_instance;
  GtkWidget *leading;
  GtkWidget *center;
  GtkWidget *trailing;
  GtkWidget *title;
};
G_DEFINE_FINAL_TYPE(SunoActionBar, Suno_action_bar, GTK_TYPE_BOX)
static void Suno_action_bar_class_init(SunoActionBarClass *klass) {
  (void)klass;
}
static void Suno_action_bar_init(SunoActionBar *s) {
  gtk_orientable_set_orientation(GTK_ORIENTABLE(s), GTK_ORIENTATION_HORIZONTAL);
  gtk_box_set_spacing(GTK_BOX(s), 9);
  gtk_widget_add_css_class(GTK_WIDGET(s), "Suno-action-bar");
  s->leading = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 6);
  s->center = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 6);
  s->trailing = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 6);
  gtk_widget_set_hexpand(s->center, TRUE);
  gtk_widget_set_halign(s->center, GTK_ALIGN_FILL);
  gtk_widget_set_halign(s->trailing, GTK_ALIGN_END);
  s->title = gtk_label_new("");
  gtk_label_set_ellipsize(GTK_LABEL(s->title), PANGO_ELLIPSIZE_END);
  gtk_label_set_xalign(GTK_LABEL(s->title), 0);
  gtk_widget_set_hexpand(s->title, TRUE);
  gtk_widget_add_css_class(s->title, "Suno-action-title");
  gtk_box_append(GTK_BOX(s->center), s->title);
  /* A bar centres what it holds. A box hands each child its own full height,
   * so a 28px control inside a 46px bar is drawn 46px tall however the sheet
   * states it — the reason Suno's controls came out uniformly too tall. */
  gtk_widget_set_valign(s->leading, GTK_ALIGN_CENTER);
  gtk_widget_set_valign(s->center, GTK_ALIGN_CENTER);
  gtk_widget_set_valign(s->trailing, GTK_ALIGN_CENTER);
  gtk_widget_set_valign(s->title, GTK_ALIGN_CENTER);
  gtk_box_append(GTK_BOX(s), s->leading);
  gtk_box_append(GTK_BOX(s), s->center);
  gtk_box_append(GTK_BOX(s), s->trailing);
}

/* Centre every control a bar already holds. Applications that fill a plain box
 * with the toolbar class call this once the bar is built; the kit's own bars
 * do it as they go. */
void Suno_ui_centre_controls(GtkWidget *bar) {
  GtkWidget *child;

  g_return_if_fail(GTK_IS_WIDGET(bar));
  for (child = gtk_widget_get_first_child(bar); child != NULL;
       child = gtk_widget_get_next_sibling(child)) {
    if (gtk_widget_get_valign(child) == GTK_ALIGN_FILL)
      gtk_widget_set_valign(child, GTK_ALIGN_CENTER);
  }
}
GtkWidget *Suno_action_bar_new(void) {
  return g_object_new(SUNO_TYPE_ACTION_BAR, NULL);
}
void Suno_action_bar_set_title(SunoActionBar *s, const char *t) {
  g_return_if_fail(SUNO_IS_ACTION_BAR(s));
  gtk_label_set_label(GTK_LABEL(s->title), t ? t : "");
}
const char *Suno_action_bar_get_title(SunoActionBar *s) {
  g_return_val_if_fail(SUNO_IS_ACTION_BAR(s), NULL);
  return gtk_label_get_label(GTK_LABEL(s->title));
}
void Suno_action_bar_add_leading(SunoActionBar *s, GtkWidget *w) {
  g_return_if_fail(SUNO_IS_ACTION_BAR(s));
  g_return_if_fail(GTK_IS_WIDGET(w));
  if (gtk_widget_get_valign(w) == GTK_ALIGN_FILL)
    gtk_widget_set_valign(w, GTK_ALIGN_CENTER);
  gtk_box_append(GTK_BOX(s->leading), w);
}
void Suno_action_bar_add_trailing(SunoActionBar *s, GtkWidget *w) {
  g_return_if_fail(SUNO_IS_ACTION_BAR(s));
  g_return_if_fail(GTK_IS_WIDGET(w));
  if (gtk_widget_get_valign(w) == GTK_ALIGN_FILL)
    gtk_widget_set_valign(w, GTK_ALIGN_CENTER);
  gtk_box_append(GTK_BOX(s->trailing), w);
}
GtkWidget *Suno_action_bar_get_leading(SunoActionBar *s) {
  g_return_val_if_fail(SUNO_IS_ACTION_BAR(s), NULL);
  return s->leading;
}
GtkWidget *Suno_action_bar_get_center(SunoActionBar *s) {
  g_return_val_if_fail(SUNO_IS_ACTION_BAR(s), NULL);
  return s->center;
}
GtkWidget *Suno_action_bar_get_trailing(SunoActionBar *s) {
  g_return_val_if_fail(SUNO_IS_ACTION_BAR(s), NULL);
  return s->trailing;
}
