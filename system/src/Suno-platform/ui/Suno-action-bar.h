/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUNO_TYPE_ACTION_BAR (Suno_action_bar_get_type())
G_DECLARE_FINAL_TYPE(SunoActionBar, Suno_action_bar, SUNO, ACTION_BAR, GtkBox)

GtkWidget *Suno_action_bar_new(void);

/* Centre every control a bar already holds, so a control keeps the height the
 * sheet states instead of being stretched to its bar's. */
void Suno_ui_centre_controls(GtkWidget *bar);
void Suno_action_bar_set_title(SunoActionBar *self, const char *title);
const char *Suno_action_bar_get_title(SunoActionBar *self);
void Suno_action_bar_add_leading(SunoActionBar *self, GtkWidget *widget);
void Suno_action_bar_add_trailing(SunoActionBar *self, GtkWidget *widget);
/**
 * Suno_action_bar_get_leading:
 * @self: an action bar
 *
 * Returns: (transfer none): the leading widget box
 */
GtkWidget *Suno_action_bar_get_leading(SunoActionBar *self);
/**
 * Suno_action_bar_get_center:
 * @self: an action bar
 *
 * Returns: (transfer none): the center widget box
 */
GtkWidget *Suno_action_bar_get_center(SunoActionBar *self);
/**
 * Suno_action_bar_get_trailing:
 * @self: an action bar
 *
 * Returns: (transfer none): the trailing widget box
 */
GtkWidget *Suno_action_bar_get_trailing(SunoActionBar *self);

G_END_DECLS
