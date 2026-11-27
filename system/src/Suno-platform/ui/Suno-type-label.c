/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_type.TypeLabel; apply_type is Suno_ui_apply_type() in Suno-ui-kit.c. */
#include "Suno-type-label.h"
#include "Suno-ui-private.h"

struct _SunoTypeLabel {
  GtkBox parent_instance;
  GtkWidget *label;
  GtkWidget *unit;
  const char *role;
};

G_DEFINE_FINAL_TYPE(SunoTypeLabel, Suno_type_label, GTK_TYPE_BOX)

/* The role as the kit names it ("title_1" is "title-1"), or NULL when unknown. */
static const char *type_role(const char *role) {
  g_autofree char *key = g_strdelimit(g_strdup(role), "_", '-');
  const char *const *roles = Suno_ui_type_roles();
  for (guint i = 0; roles[i] != NULL; i++)
    if (g_str_equal(roles[i], key))
      return roles[i];
  return NULL;
}

static void type_label_refresh_accessible(SunoTypeLabel *self) {
  /* Read as one phrase: "9:41 :07 AM" would be two. */
  const char *unit = gtk_label_get_label(GTK_LABEL(self->unit));
  const char *text = gtk_label_get_label(GTK_LABEL(self->label));
  g_autofree char *whole = unit[0] != '\0' ? g_strdup_printf("%s %s", text, unit) : g_strdup(text);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), whole);
}

static void Suno_type_label_class_init(SunoTypeLabelClass *klass G_GNUC_UNUSED) {}

static void Suno_type_label_init(SunoTypeLabel *self) {
  Suno_ui_install();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_HORIZONTAL);
  gtk_box_set_spacing(GTK_BOX(self), 0);
  gtk_box_set_baseline_position(GTK_BOX(self), GTK_BASELINE_POSITION_CENTER);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-type");
  self->label = gtk_label_new("");
  gtk_label_set_xalign(GTK_LABEL(self->label), 0);
  gtk_widget_set_valign(self->label, GTK_ALIGN_BASELINE_FILL);
  self->unit = gtk_label_new("");
  gtk_label_set_xalign(GTK_LABEL(self->unit), 0);
  gtk_widget_set_valign(self->unit, GTK_ALIGN_BASELINE_FILL);
  gtk_widget_add_css_class(self->unit, "SunoUI-t-unit");
  gtk_box_append(GTK_BOX(self), self->label);
  gtk_box_append(GTK_BOX(self), self->unit);
  self->role = "body";
  Suno_ui_apply_type(self->label, "body");
  Suno_ui_apply_type(GTK_WIDGET(self), "body");
  gtk_widget_set_visible(self->unit, FALSE);
  type_label_refresh_accessible(self);
}

GtkWidget *Suno_type_label_new(const char *text, const char *role) {
  if (role != NULL && type_role(role) == NULL) {
    g_critical("unknown SunoUI type role '%s'", role);
    return NULL;
  }
  SunoTypeLabel *self = g_object_new(SUNO_TYPE_TYPE_LABEL, NULL);
  Suno_type_label_set_text(self, text);
  Suno_type_label_set_role(self, role != NULL ? role : "body");
  return GTK_WIDGET(self);
}

void Suno_type_label_set_text(SunoTypeLabel *self, const char *text) {
  g_return_if_fail(SUNO_IS_TYPE_LABEL(self));
  gtk_label_set_label(GTK_LABEL(self->label), text != NULL ? text : "");
  type_label_refresh_accessible(self);
}

const char *Suno_type_label_get_text(SunoTypeLabel *self) {
  g_return_val_if_fail(SUNO_IS_TYPE_LABEL(self), NULL);
  return gtk_label_get_label(GTK_LABEL(self->label));
}

void Suno_type_label_set_role(SunoTypeLabel *self, const char *role) {
  g_return_if_fail(SUNO_IS_TYPE_LABEL(self));
  g_return_if_fail(role != NULL);
  const char *key = type_role(role);
  if (key == NULL) {
    g_critical("unknown SunoUI type role '%s'", role);
    return;
  }
  Suno_ui_apply_type(self->label, key);
  Suno_ui_apply_type(GTK_WIDGET(self), key);
  self->role = key;
}

const char *Suno_type_label_get_role(SunoTypeLabel *self) {
  g_return_val_if_fail(SUNO_IS_TYPE_LABEL(self), NULL);
  return self->role;
}

void Suno_type_label_set_unit(SunoTypeLabel *self, const char *unit) {
  g_return_if_fail(SUNO_IS_TYPE_LABEL(self));
  gboolean has_unit = unit != NULL && unit[0] != '\0';
  gtk_label_set_label(GTK_LABEL(self->unit), has_unit ? unit : "");
  gtk_widget_set_visible(self->unit, has_unit);
  type_label_refresh_accessible(self);
}

void Suno_type_label_set_wrap(SunoTypeLabel *self, gboolean wrap) {
  g_return_if_fail(SUNO_IS_TYPE_LABEL(self));
  gtk_label_set_wrap(GTK_LABEL(self->label), wrap);
  gtk_label_set_wrap_mode(GTK_LABEL(self->label), wrap ? PANGO_WRAP_WORD_CHAR : PANGO_WRAP_WORD);
}
