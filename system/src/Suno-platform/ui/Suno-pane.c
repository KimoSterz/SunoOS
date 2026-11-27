/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-pane.h"

struct _SunoPane {
  GtkBox parent_instance;
  GtkWidget *child;
};

G_DEFINE_FINAL_TYPE(SunoPane, Suno_pane, GTK_TYPE_BOX)

static void Suno_pane_dispose(GObject *object) {
  SunoPane *self = SUNO_PANE(object);
  self->child = NULL;
  G_OBJECT_CLASS(Suno_pane_parent_class)->dispose(object);
}

static void Suno_pane_class_init(SunoPaneClass *klass) {
  G_OBJECT_CLASS(klass)->dispose = Suno_pane_dispose;
}

static void Suno_pane_init(SunoPane *self) {
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self),
                                 GTK_ORIENTATION_VERTICAL);
  gtk_widget_set_hexpand(GTK_WIDGET(self), TRUE);
  gtk_widget_set_vexpand(GTK_WIDGET(self), TRUE);
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-pane");
  /* Every pane is an island; the toolkit draws that appearance. */
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-island");
}

GtkWidget *Suno_pane_new(void) {
  return g_object_new(SUNO_TYPE_PANE, NULL);
}

void Suno_pane_set_child(SunoPane *self, GtkWidget *child) {
  g_return_if_fail(SUNO_IS_PANE(self));
  g_return_if_fail(child == NULL || GTK_IS_WIDGET(child));
  if (self->child == child)
    return;
  if (self->child != NULL)
    gtk_box_remove(GTK_BOX(self), self->child);
  self->child = child;
  if (child != NULL) {
    gtk_widget_set_hexpand(child, TRUE);
    gtk_widget_set_vexpand(child, TRUE);
    gtk_box_append(GTK_BOX(self), child);
  }
}

GtkWidget *Suno_pane_get_child(SunoPane *self) {
  g_return_val_if_fail(SUNO_IS_PANE(self), NULL);
  return self->child;
}
