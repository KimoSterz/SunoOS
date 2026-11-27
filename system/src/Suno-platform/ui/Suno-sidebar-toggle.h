/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_sidebar.SidebarToggle (Python). */
#pragma once

#include <gtk/gtk.h>

#include "Suno-title-island.h"

G_BEGIN_DECLS

/**
 * SunoSidebarToggle:
 *
 * Hide and show a sidebar: the panel-left button, F9, and a drawer from the
 * left at phone width. The sidebar is any widget in a box (it slides away) or
 * an #AdwOverlaySplitView (its own animation). #SunoSidebarToggle:shown
 * notifies on every change; the kit does not persist it.
 */
#define SUNO_TYPE_SIDEBAR_TOGGLE (Suno_sidebar_toggle_get_type())
G_DECLARE_FINAL_TYPE(SunoSidebarToggle, Suno_sidebar_toggle, SUNO, SIDEBAR_TOGGLE, GtkToggleButton)

/**
 * Suno_sidebar_toggle_new:
 * @sidebar: the sidebar widget, or an #AdwOverlaySplitView
 * @shown: whether it starts shown
 *
 * Returns: (transfer floating): a new toggle
 */
GtkWidget *Suno_sidebar_toggle_new(GtkWidget *sidebar, gboolean shown);
gboolean Suno_sidebar_toggle_get_shown(SunoSidebarToggle *self);
void Suno_sidebar_toggle_set_shown(SunoSidebarToggle *self, gboolean shown);
/**
 * Suno_sidebar_toggle_toggle:
 * @self: a toggle
 *
 * What the button and F9 do.
 */
void Suno_sidebar_toggle_toggle(SunoSidebarToggle *self);
/* Like toggle(), with the opening drawer's initial focus (e.g. search). */
void Suno_sidebar_toggle_toggle_with_focus(SunoSidebarToggle *self, GtkWidget *initial_focus);
/**
 * Suno_sidebar_toggle_set_island:
 * @self: a sidebar toggle
 * @island: (nullable): v71: on a phone this title island is the sidebar's ☰: it grows into the
 *   sidebar (borrowed, given back on fold; picking a row folds it), and the toggle steps aside
 *
 * Python `SidebarToggle(sidebar, island=island)`.
 */
void Suno_sidebar_toggle_set_island(SunoSidebarToggle *self, SunoTitleIsland *island);

/**
 * Suno_sidebar_toggle_set_drawer_below:
 * @self: a sidebar toggle
 * @width: exclusive layout breakpoint; default560, use901 for compact drawers
 *
 * Phone title islands keep the normal phone breakpoint independently.
 */
void Suno_sidebar_toggle_set_drawer_below(SunoSidebarToggle *self, int width);
int Suno_sidebar_toggle_get_drawer_below(SunoSidebarToggle *self);

/* Disable sidebar navigation at phone widths when an app uses another places control. */
void Suno_sidebar_toggle_set_phone_enabled(SunoSidebarToggle *self, gboolean enabled);

/* Keep the controller/menu action and adaptive sidebar while omitting the button. */
void Suno_sidebar_toggle_set_control_visible(SunoSidebarToggle *self, gboolean visible);

G_END_DECLS
