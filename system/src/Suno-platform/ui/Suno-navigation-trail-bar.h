/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_trail.NavigationTrailBar (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoNavigationTrailBar:
 *
 * Where you came from, inline with where you are: "‹ Albums · 12 albums",
 * never a framed Back button on a row of its own. With a title (a page) the
 * chevron stands alone before the title-1 title ("Back to Albums" is its
 * name); without one (a pane's own trail) the chevron carries the name. With
 * nowhere to go back to there is no chevron.
 *
 * The app keeps its own history (Python binds a NavigationTrail); it tells
 * the bar where it is with Suno_navigation_trail_bar_set_place() and hears
 * #SunoNavigationTrailBar::back. Meta items with an action go somewhere.
 */
#define SUNO_TYPE_NAVIGATION_TRAIL_BAR (Suno_navigation_trail_bar_get_type())
G_DECLARE_FINAL_TYPE(SunoNavigationTrailBar, Suno_navigation_trail_bar, SUNO, NAVIGATION_TRAIL_BAR, GtkBox)

/**
 * Suno_navigation_trail_bar_new:
 * @with_title: whether it shows the current place's title (a page)
 *
 * Returns: (transfer floating): a new bar
 */
GtkWidget *Suno_navigation_trail_bar_new(gboolean with_title);
/**
 * Suno_navigation_trail_bar_set_place:
 * @self: a bar
 * @back_to: (nullable): the previous place's title; %NULL: nowhere to go back
 * @title: the current place's title
 */
void Suno_navigation_trail_bar_set_place(SunoNavigationTrailBar *self, const char *back_to,
                                         const char *title);
void Suno_navigation_trail_bar_clear_meta(SunoNavigationTrailBar *self);
/**
 * Suno_navigation_trail_bar_add_meta:
 * @self: a bar
 * @text: what the page holds ("214 songs")
 * @action_name: (nullable): a #GAction that goes there
 */
void Suno_navigation_trail_bar_add_meta(SunoNavigationTrailBar *self, const char *text,
                                        const char *action_name);

G_END_DECLS
