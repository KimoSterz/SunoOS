/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of action_stack.StackedButton / StackedButtons (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoStackedButton:
 *
 * One action: a Lucide glyph over a short label. Activates its #GtkActionable
 * action or emits #GtkButton::clicked. Disabled reads as flat and muted.
 */
#define SUNO_TYPE_STACKED_BUTTON (Suno_stacked_button_get_type())
G_DECLARE_FINAL_TYPE(SunoStackedButton, Suno_stacked_button, SUNO, STACKED_BUTTON, GtkButton)

/**
 * Suno_stacked_button_new:
 * @icon: a Lucide glyph ("log-out")
 * @label: a short word ("Leave")
 * @danger: whether it is destructive (red)
 *
 * Returns: (transfer floating): a new button
 */
GtkWidget *Suno_stacked_button_new(const char *icon, const char *label, gboolean danger);

/**
 * SunoStackedButtons:
 *
 * An equal pair or trio of #SunoStackedButton. Any other count is refused
 * (critical) when the group is shown.
 */
#define SUNO_TYPE_STACKED_BUTTONS (Suno_stacked_buttons_get_type())
G_DECLARE_FINAL_TYPE(SunoStackedButtons, Suno_stacked_buttons, SUNO, STACKED_BUTTONS, GtkBox)

/**
 * Suno_stacked_buttons_new:
 * @small: the compact variant
 *
 * Returns: (transfer floating): a new, empty group
 */
GtkWidget *Suno_stacked_buttons_new(gboolean small);
void Suno_stacked_buttons_append(SunoStackedButtons *self, SunoStackedButton *button);

G_END_DECLS
