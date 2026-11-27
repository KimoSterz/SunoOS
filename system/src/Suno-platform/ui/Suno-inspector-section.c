/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-inspector-section.h"

struct _SunoInspectorSection {
  GtkBox parent_instance;
  GtkToggleButton *disclosure;
  GtkLabel *title;
  GtkWidget *child;
};

enum { EXPANDED_CHANGED, N_SIGNALS };
static guint signals[N_SIGNALS];

G_DEFINE_FINAL_TYPE(SunoInspectorSection, Suno_inspector_section, GTK_TYPE_BOX)

static void expanded_changed(GObject *object, GParamSpec *spec,
                             gpointer user_data) {
  SunoInspectorSection *self = SUNO_INSPECTOR_SECTION(user_data);
  (void)object;
  (void)spec;
  if (self->child != NULL)
    gtk_widget_set_visible(self->child,
                           gtk_toggle_button_get_active(self->disclosure));
  g_signal_emit(self, signals[EXPANDED_CHANGED], 0,
                gtk_toggle_button_get_active(self->disclosure));
}

static void Suno_inspector_section_dispose(GObject *object) {
  SunoInspectorSection *self = SUNO_INSPECTOR_SECTION(object);
  self->child = NULL;
  G_OBJECT_CLASS(Suno_inspector_section_parent_class)->dispose(object);
}

static void Suno_inspector_section_class_init(SunoInspectorSectionClass *klass) {
  G_OBJECT_CLASS(klass)->dispose = Suno_inspector_section_dispose;
  signals[EXPANDED_CHANGED] =
      g_signal_new("expanded-changed", G_TYPE_FROM_CLASS(klass),
                   G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL, G_TYPE_NONE, 1,
                   G_TYPE_BOOLEAN);
}

static void Suno_inspector_section_init(SunoInspectorSection *self) {
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_VERTICAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-inspector-section");
  self->disclosure = GTK_TOGGLE_BUTTON(gtk_toggle_button_new());
  gtk_toggle_button_set_active(self->disclosure, TRUE);
  gtk_widget_add_css_class(GTK_WIDGET(self->disclosure),
                           "Suno-inspector-disclosure");
  GtkWidget *header = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 6);
  GtkWidget *chevron = gtk_image_new_from_icon_name("pan-end-symbolic");
  gtk_widget_add_css_class(chevron, "Suno-inspector-chevron");
  self->title = GTK_LABEL(gtk_label_new(""));
  gtk_label_set_xalign(self->title, 0.0f);
  gtk_widget_set_hexpand(GTK_WIDGET(self->title), TRUE);
  gtk_widget_add_css_class(GTK_WIDGET(self->title), "Suno-section-heading");
  gtk_box_append(GTK_BOX(header), chevron);
  gtk_box_append(GTK_BOX(header), GTK_WIDGET(self->title));
  gtk_button_set_child(GTK_BUTTON(self->disclosure), header);
  gtk_box_append(GTK_BOX(self), GTK_WIDGET(self->disclosure));
  g_signal_connect(self->disclosure, "notify::active",
                   G_CALLBACK(expanded_changed), self);
}

GtkWidget *Suno_inspector_section_new(const char *title) {
  SunoInspectorSection *self =
      g_object_new(SUNO_TYPE_INSPECTOR_SECTION, NULL);
  Suno_inspector_section_set_title(self, title);
  return GTK_WIDGET(self);
}

void Suno_inspector_section_set_title(SunoInspectorSection *self,
                                      const char *title) {
  g_return_if_fail(SUNO_IS_INSPECTOR_SECTION(self));
  gtk_label_set_label(self->title, title ? title : "");
  gtk_accessible_update_property(GTK_ACCESSIBLE(self->disclosure),
                                 GTK_ACCESSIBLE_PROPERTY_LABEL,
                                 title ? title : "", -1);
}

void Suno_inspector_section_set_child(SunoInspectorSection *self,
                                      GtkWidget *child) {
  g_return_if_fail(SUNO_IS_INSPECTOR_SECTION(self));
  g_return_if_fail(child == NULL || GTK_IS_WIDGET(child));
  if (self->child == child)
    return;
  if (self->child != NULL)
    gtk_box_remove(GTK_BOX(self), self->child);
  self->child = child;
  if (child != NULL) {
    gtk_widget_set_visible(child,
                           gtk_toggle_button_get_active(self->disclosure));
    gtk_box_append(GTK_BOX(self), child);
  }
}

GtkWidget *Suno_inspector_section_get_child(SunoInspectorSection *self) {
  g_return_val_if_fail(SUNO_IS_INSPECTOR_SECTION(self), NULL);
  return self->child;
}

void Suno_inspector_section_set_expanded(SunoInspectorSection *self,
                                         gboolean expanded) {
  g_return_if_fail(SUNO_IS_INSPECTOR_SECTION(self));
  gtk_toggle_button_set_active(self->disclosure, expanded);
}

gboolean Suno_inspector_section_get_expanded(SunoInspectorSection *self) {
  g_return_val_if_fail(SUNO_IS_INSPECTOR_SECTION(self), FALSE);
  return gtk_toggle_button_get_active(self->disclosure);
}
