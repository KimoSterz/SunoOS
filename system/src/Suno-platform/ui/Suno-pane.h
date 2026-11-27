/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUNO_TYPE_PANE (Suno_pane_get_type())
G_DECLARE_FINAL_TYPE(SunoPane, Suno_pane, SUNO, PANE, GtkBox)

GtkWidget *Suno_pane_new(void);
void Suno_pane_set_child(SunoPane *self, GtkWidget *child);

/**
 * Suno_pane_get_child:
 * @self: a #SunoPane
 *
 * Returns: (transfer none) (nullable): the pane's current child
 */
GtkWidget *Suno_pane_get_child(SunoPane *self);

G_END_DECLS
