/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of action_bubble.SelectionBubble (Python). */
#pragma once

#include <gtk/gtk.h>
#include "Suno-action-center.h"

G_BEGIN_DECLS

/**
 * SunoSelectionBubble:
 *
 * Formatting marks that float over a text selection. Over a #GtkTextView it
 * follows the selection by itself (after a 200 ms settle, away while typing
 * or scrolling, below the text near the top); over anything else the app
 * calls Suno_selection_bubble_show_for(). Arrows move between marks, Esc
 * closes it, Alt+F10 moves focus into it.
 */
#define SUNO_TYPE_SELECTION_BUBBLE (Suno_selection_bubble_get_type())
G_DECLARE_FINAL_TYPE(SunoSelectionBubble, Suno_selection_bubble, SUNO, SELECTION_BUBBLE, GtkBox)

/**
 * Suno_selection_bubble_new:
 * @view: the text view (or canvas) it floats over
 * @items: (array length=n_items): its marks (%SUNO_BAR_ITEM_ACTION,
 *   %SUNO_BAR_ITEM_SEPARATOR)
 * @n_items: how many
 * @label: (nullable): what it is, for assistive technology ("Formatting")
 *
 * Returns: (transfer floating): a new bubble
 */
GtkWidget *Suno_selection_bubble_new(GtkWidget *view, SunoBarItem *const *items, guint n_items,
                                     const char *label);
/**
 * Suno_selection_bubble_show_for:
 * @self: a bubble
 * @rect: the selection's box in the view's coordinates
 */
void Suno_selection_bubble_show_for(SunoSelectionBubble *self, const GdkRectangle *rect);
void Suno_selection_bubble_hide(SunoSelectionBubble *self);
/**
 * Suno_selection_bubble_set_active:
 * @self: a bubble
 * @icon: the mark's Lucide glyph ("bold")
 * @active: whether it is on for the current selection
 */
void Suno_selection_bubble_set_active(SunoSelectionBubble *self, const char *icon, gboolean active);
gboolean Suno_selection_bubble_focus_first(SunoSelectionBubble *self);
gboolean Suno_selection_bubble_get_shown(SunoSelectionBubble *self);

G_END_DECLS
