/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>
#include <adwaita.h>

G_BEGIN_DECLS

/* A frame sidebar. A named variant owns its width and row rhythm; the app
 * supplies destinations and selection through the real GtkListBox. */
#define SUNO_TYPE_NAVIGATION_SIDEBAR (Suno_navigation_sidebar_get_type())
G_DECLARE_FINAL_TYPE(SunoNavigationSidebar, Suno_navigation_sidebar, SUNO, NAVIGATION_SIDEBAR, GtkBox)

/* variant: NULL, "people", "destinations", "resources", "files", "tree";
 * width: NULL, "narrow", "regular", "wide". */
GtkWidget *Suno_navigation_sidebar_new(const char *variant, const char *width);
void Suno_navigation_sidebar_set_variant(SunoNavigationSidebar *self, const char *variant, const char *width);
void Suno_navigation_sidebar_append_header(SunoNavigationSidebar *self, GtkWidget *child);
void Suno_navigation_sidebar_append_footer(SunoNavigationSidebar *self, GtkWidget *child);
void Suno_navigation_sidebar_append_row(SunoNavigationSidebar *self, GtkListBoxRow *row);
void Suno_navigation_sidebar_append_section(SunoNavigationSidebar *self, const char *label);
void Suno_navigation_sidebar_clear(SunoNavigationSidebar *self);
/**
 * Suno_navigation_sidebar_get_list:
 * @self: a navigation sidebar
 *
 * Returns: (transfer none): the selectable list for row activation and selection
 */
GtkListBox *Suno_navigation_sidebar_get_list(SunoNavigationSidebar *self);

/* Keep an application's live sidebar and split view. This sets the shared
 * sidebar width and frame classes without moving or recreating semantic rows.
 * In "rail" mode existing icon/label rows become 60px icon-over-label rows;
 * call again after adding rows to dress the new ones. Other row types retain
 * their presentation. width: "rail" (88px), "narrow", "regular", or "wide". */
void Suno_navigation_sidebar_adapt_live(AdwOverlaySplitView *split_view,
                                        GtkWidget *live_sidebar,
                                        const char *width);

/* A shared destination row: title, optional subtitle, lead and trail slots.
 * The app may update the text without replacing the row or losing selection. */
#define SUNO_TYPE_NAVIGATION_ROW (Suno_navigation_row_get_type())
G_DECLARE_FINAL_TYPE(SunoNavigationRow, Suno_navigation_row, SUNO, NAVIGATION_ROW, GtkListBoxRow)

GtkWidget *Suno_navigation_row_new(const char *title, const char *subtitle);
void Suno_navigation_row_set_title(SunoNavigationRow *self, const char *title);
void Suno_navigation_row_set_subtitle(SunoNavigationRow *self, const char *subtitle);
void Suno_navigation_row_set_meta(SunoNavigationRow *self, const char *meta);
void Suno_navigation_row_set_lead(SunoNavigationRow *self, GtkWidget *lead);
void Suno_navigation_row_set_trail(SunoNavigationRow *self, GtkWidget *trail);

/**
 * Suno_navigation_sidebar_set_footer_fade:
 * @self: a sidebar
 * @enabled: fade overflowing content above a fixed footer
 *
 * Enabled by default. The footer remains fully opaque; the fade disappears
 * when the final row is scrolled into view so it stays readable.
 */
void Suno_navigation_sidebar_set_footer_fade(SunoNavigationSidebar *self, gboolean enabled);

G_END_DECLS
