/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_type.TypeLabel (Python); apply_type is Suno_ui_apply_type(). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoTypeLabel:
 *
 * A label in one type role, with an optional small unit after it ("72 °").
 */
#define SUNO_TYPE_TYPE_LABEL (Suno_type_label_get_type())
G_DECLARE_FINAL_TYPE(SunoTypeLabel, Suno_type_label, SUNO, TYPE_LABEL, GtkBox)

/**
 * Suno_type_label_new:
 * @text: (nullable): the text
 * @role: (nullable): a type role (see Suno_ui_apply_type()); %NULL is "body"
 *
 * Returns: (transfer floating): a new label
 */
GtkWidget *Suno_type_label_new(const char *text, const char *role);
void Suno_type_label_set_text(SunoTypeLabel *self, const char *text);
const char *Suno_type_label_get_text(SunoTypeLabel *self);
void Suno_type_label_set_role(SunoTypeLabel *self, const char *role);
const char *Suno_type_label_get_role(SunoTypeLabel *self);
/**
 * Suno_type_label_set_unit:
 * @self: a label
 * @unit: (nullable): the small unit after the text
 */
void Suno_type_label_set_unit(SunoTypeLabel *self, const char *unit);
void Suno_type_label_set_wrap(SunoTypeLabel *self, gboolean wrap);

G_END_DECLS
