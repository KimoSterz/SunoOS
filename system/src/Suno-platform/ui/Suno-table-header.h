/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_table.py: TableHeader, Column, ColumnViewHeader,
 * Selection (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoSortDirection:
 * @SUNO_SORT_NONE: unsorted
 * @SUNO_SORT_ASCENDING: ascending ("ascending" in Python)
 * @SUNO_SORT_DESCENDING: descending ("descending" in Python)
 */
typedef enum {
  SUNO_SORT_NONE,
  SUNO_SORT_ASCENDING,
  SUNO_SORT_DESCENDING,
} SunoSortDirection;
GType Suno_sort_direction_get_type(void);
#define SUNO_TYPE_SORT_DIRECTION (Suno_sort_direction_get_type())

/**
 * SunoTableHeader:
 *
 * The recessed, sortable header bar for a list built from rows. A click on a
 * heading sorts by it, or reverses it; the kit shows the arrow and speaks the
 * sort, the app sorts (#SunoTableHeader::sort-changed: const char *key,
 * #SunoSortDirection direction).
 */
#define SUNO_TYPE_TABLE_HEADER (Suno_table_header_get_type())
G_DECLARE_FINAL_TYPE(SunoTableHeader, Suno_table_header, SUNO, TABLE_HEADER, GtkBox)

/**
 * Suno_table_header_new:
 *
 * Returns: (transfer floating): a new header; add columns in order
 */
GtkWidget *Suno_table_header_new(void);
/**
 * Suno_table_header_add_column:
 * @self: a header
 * @key: (nullable): the column's sort key; %NULL for a plain label
 * @label: the heading
 * @expand: whether it shares what room is left
 * @width: a fixed width for a narrow column (a track number), or -1
 * @end: whether the heading (and the column's numbers) align to the end
 */
void Suno_table_header_add_column(SunoTableHeader *self, const char *key, const char *label,
                                  gboolean expand, int width, gboolean end);
/**
 * Suno_table_header_set_sort:
 * @self: a header
 * @key: (nullable): the sorted column, %NULL for none
 * @direction: the direction
 *
 * Show the list as sorted by @key, without emitting
 * #SunoTableHeader::sort-changed.
 */
void Suno_table_header_set_sort(SunoTableHeader *self, const char *key, SunoSortDirection direction);
/**
 * Suno_table_header_get_sort_key:
 * @self: a header
 *
 * Returns: (nullable): the sorted column's key
 */
const char *Suno_table_header_get_sort_key(SunoTableHeader *self);
SunoSortDirection Suno_table_header_get_sort_direction(SunoTableHeader *self);
/**
 * Suno_table_header_activate_column:
 * @self: a header
 * @key: a sortable column's key
 *
 * What a click on its heading does.
 *
 * Returns: the new direction
 */
SunoSortDirection Suno_table_header_activate_column(SunoTableHeader *self, const char *key);
/**
 * Suno_table_header_align:
 * @self: a header
 * @row: a row whose children are its cells, one per column
 *
 * Give a row's cells the header's column widths.
 */
void Suno_table_header_align(SunoTableHeader *self, GtkWidget *row);

/**
 * SunoColumnViewHeader:
 *
 * A #GtkColumnView's own header in the SunoUI look: the recessed bar, the
 * Lucide arrows, the sort spoken on each heading. For Filer's list view.
 * It follows the view's sorter by itself.
 */
#define SUNO_TYPE_COLUMN_VIEW_HEADER (Suno_column_view_header_get_type())
G_DECLARE_FINAL_TYPE(SunoColumnViewHeader, Suno_column_view_header, SUNO, COLUMN_VIEW_HEADER, GObject)

/**
 * Suno_table_header_for_column_view:
 * @view: a column view
 *
 * Give @view's header the SunoUI bar, arrows and sort state (once per view).
 *
 * Returns: (transfer none): the header, owned by @view
 */
SunoColumnViewHeader *Suno_table_header_for_column_view(GtkColumnView *view);
/**
 * Suno_column_view_header_sync:
 * @self: a header
 *
 * Read the view's sorter again (it is also followed by itself).
 */
void Suno_column_view_header_sync(SunoColumnViewHeader *self);
/**
 * Suno_column_view_header_set_visible:
 * @self: a column view header
 * @visible: whether to show the sortable headings
 *
 * Hide or restore the native heading row, including its layout space. This
 * lets the same #GtkColumnView present grouped search results and a sortable
 * list without application CSS or an empty row above the results.
 */
void Suno_column_view_header_set_visible(SunoColumnViewHeader *self, gboolean visible);
/**
 * Suno_column_view_header_get_visible:
 * @self: a column view header
 *
 * Returns: whether the native heading row is visible
 */
gboolean Suno_column_view_header_get_visible(SunoColumnViewHeader *self);
/**
 * Suno_column_view_header_get_sort_key:
 * @self: a header
 *
 * Returns: (nullable): the sorted column's id (#GtkColumnViewColumn:id)
 */
const char *Suno_column_view_header_get_sort_key(SunoColumnViewHeader *self);
SunoSortDirection Suno_column_view_header_get_sort_direction(SunoColumnViewHeader *self);

/**
 * Suno_selection_apply:
 * @widget: a #GtkListBox, #GtkFlowBox, #GtkListView, #GtkGridView or
 *   #GtkColumnView
 *
 * Its selected rows wear the one selection look, the raised chip.
 */
void Suno_selection_apply(GtkWidget *widget);
/**
 * Suno_selection_mark:
 * @widget: a row an app selects by hand (a tile, a column-view step)
 * @selected: whether it is selected
 */
void Suno_selection_mark(GtkWidget *widget, gboolean selected);
/**
 * Suno_selection_trail:
 * @widget: an earlier step of a path (column view)
 * @on: whether it is on the path
 *
 * The same shape as the chip, quieter.
 */
void Suno_selection_trail(GtkWidget *widget, gboolean on);

G_END_DECLS
