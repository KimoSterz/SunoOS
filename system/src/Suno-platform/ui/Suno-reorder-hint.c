/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-reorder-hint.h"

static const char source_key[] = "Suno-reorder-source";
static const char target_key[] = "Suno-reorder-target";

/**
 * Suno_reorder_hint_clear:
 * @list: the reorderable list
 *
 * Clears the destination without changing the source or any row geometry.
 */
void
Suno_reorder_hint_clear (GtkWidget *list)
{
  g_return_if_fail (GTK_IS_WIDGET (list));
  GtkWidget *row = g_object_get_data (G_OBJECT (list), target_key);
  if (row != NULL) {
    gtk_widget_remove_css_class (row, "Suno-reorder-before");
    gtk_widget_remove_css_class (row, "Suno-reorder-after");
    g_object_set_data (G_OBJECT (list), target_key, NULL);
  }
}

/**
 * Suno_reorder_hint_end:
 * @list: the reorderable list
 *
 * Restores normal selection/hover presentation after completion or cancellation.
 */
void
Suno_reorder_hint_end (GtkWidget *list)
{
  g_return_if_fail (GTK_IS_WIDGET (list));
  Suno_reorder_hint_clear (list);
  GtkWidget *source = g_object_get_data (G_OBJECT (list), source_key);
  if (source != NULL) {
    gtk_widget_remove_css_class (source, "Suno-reorder-source");
    g_object_set_data (G_OBJECT (list), source_key, NULL);
  }
  gtk_widget_remove_css_class (list, "Suno-reordering");
}

/**
 * Suno_reorder_hint_begin:
 * @list: the reorderable list
 * @source: the row being dragged
 *
 * Keeps the source visible in its original slot, dimmed. This opt-in presentation
 * is shared by pointer/touch reorder operations; keyboard commands keep normal
 * focus presentation. Applications retain ownership of scope and persistence.
 */
void
Suno_reorder_hint_begin (GtkWidget *list, GtkWidget *source)
{
  g_return_if_fail (GTK_IS_WIDGET (list));
  g_return_if_fail (GTK_IS_WIDGET (source));
  Suno_reorder_hint_end (list);
  gtk_widget_add_css_class (list, "Suno-reorder-list");
  gtk_widget_add_css_class (list, "Suno-reordering");
  gtk_widget_add_css_class (source, "Suno-reorder-source");
  g_object_set_data_full (G_OBJECT (list), source_key, g_object_ref (source), g_object_unref);
}

/**
 * Suno_reorder_hint_set_target:
 * @list: the reorderable list
 * @row: a validated destination row
 * @after: whether to insert after the destination
 *
 * Draws only an insertion line, never a containment highlight. The caller must
 * use this same resolved position when committing the drop. The indicator does
 * not change allocation, so it cannot move its own hit-testing boundary.
 */
void
Suno_reorder_hint_set_target (GtkWidget *list, GtkWidget *row, gboolean after)
{
  g_return_if_fail (GTK_IS_WIDGET (list));
  g_return_if_fail (GTK_IS_WIDGET (row));
  Suno_reorder_hint_clear (list);
  if (row == g_object_get_data (G_OBJECT (list), source_key)) return;
  gtk_widget_add_css_class (row, after ? "Suno-reorder-after" : "Suno-reorder-before");
  g_object_set_data_full (G_OBJECT (list), target_key, g_object_ref (row), g_object_unref);
}

/**
 * Suno_reorder_hint_is_after:
 * @row: the destination row
 * @y: pointer/touch position in the row's coordinates
 *
 * Returns: whether the position is in the row's lower half. The vertical split
 * is independent of text direction, label length, font size and input device.
 */
gboolean
Suno_reorder_hint_is_after (GtkWidget *row, double y)
{
  g_return_val_if_fail (GTK_IS_WIDGET (row), FALSE);
  return y >= gtk_widget_get_height (row) / 2.0;
}
