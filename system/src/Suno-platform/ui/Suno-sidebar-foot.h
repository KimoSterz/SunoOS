/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_sidebar.SidebarFoot and FilterHeading (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoFilterHeading:
 *
 * "Favourites · Show all" at the top of a filtered list. Emits
 * #SunoFilterHeading::show-all.
 */
#define SUNO_TYPE_FILTER_HEADING (Suno_filter_heading_get_type())
G_DECLARE_FINAL_TYPE(SunoFilterHeading, Suno_filter_heading, SUNO, FILTER_HEADING, GtkBox)

/**
 * Suno_filter_heading_new:
 * @label: (nullable): the filter's name
 *
 * Returns: (transfer floating): a new heading
 */
GtkWidget *Suno_filter_heading_new(const char *label);
void Suno_filter_heading_set_label(SunoFilterHeading *self, const char *label);

/**
 * SunoSidebarFoot:
 *
 * Search, then a filter picker or the New square, at a sidebar's foot. Filter
 * and New may be used together.
 *
 * Signals: #SunoSidebarFoot::search-changed (const char *text) after the
 * typing pause, #SunoSidebarFoot::filter-changed (const char *key) when a
 * person picks a view.
 */
#define SUNO_TYPE_SIDEBAR_FOOT (Suno_sidebar_foot_get_type())
G_DECLARE_FINAL_TYPE(SunoSidebarFoot, Suno_sidebar_foot, SUNO, SIDEBAR_FOOT, GtkBox)

/**
 * Suno_sidebar_foot_new:
 * @search: the search field's placeholder ("Search contacts")
 *
 * Returns: (transfer floating): a new foot
 */
GtkWidget *Suno_sidebar_foot_new(const char *search);
/**
 * Suno_sidebar_foot_add_filter:
 * @self: a foot
 * @key: the view's stable key
 * @label: its name ("Favourites")
 * @icon: a Lucide glyph
 *
 * Add a view to the filter picker. The first one added is current.
 */
void Suno_sidebar_foot_add_filter(SunoSidebarFoot *self, const char *key, const char *label,
                                  const char *icon);
/**
 * Suno_sidebar_foot_set_filter:
 * @self: a foot
 * @key: a view's key
 *
 * Show @key as the chosen view, without emitting
 * #SunoSidebarFoot::filter-changed.
 */
void Suno_sidebar_foot_set_filter(SunoSidebarFoot *self, const char *key);
const char *Suno_sidebar_foot_get_filter(SunoSidebarFoot *self);
/**
 * Suno_sidebar_foot_set_filter_count:
 * @self: a foot
 * @key: a view's key
 * @count: how many it shows, or -1 for no badge
 */
void Suno_sidebar_foot_set_filter_count(SunoSidebarFoot *self, const char *key, int count);
/**
 * Suno_sidebar_foot_set_add:
 * @self: a foot
 * @label: what New makes ("New contact")
 * @icon: a Lucide glyph ("plus")
 * @action_name: the detailed #GAction name it activates
 */
void Suno_sidebar_foot_set_add(SunoSidebarFoot *self, const char *label, const char *icon,
                               const char *action_name);
/**
 * Suno_sidebar_foot_open_filters:
 * @self: a foot
 *
 * Open the filter menu upward from the picker (a drawer at phone width).
 */
void Suno_sidebar_foot_open_filters(SunoSidebarFoot *self);
const char *Suno_sidebar_foot_get_text(SunoSidebarFoot *self);
/**
 * Suno_sidebar_foot_get_entry:
 * @self: a foot
 *
 * Returns: (transfer none): the search field (a place search may attach to it)
 */
GtkWidget *Suno_sidebar_foot_get_entry(SunoSidebarFoot *self);
/**
 * Suno_sidebar_foot_get_heading:
 * @self: a foot
 *
 * Returns: (transfer none): the #SunoFilterHeading to put over the list
 */
SunoFilterHeading *Suno_sidebar_foot_get_heading(SunoSidebarFoot *self);

G_END_DECLS
