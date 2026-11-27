/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_tabs.TabBar (Python, K-NAV, v71 phone.js tabBar / .phtabs, Clock's .cktabbar). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoTabBar:
 *
 * Parallel destinations (3 or more peer places, each with a glyph): each tab an
 * icon over its name, full width at the foot on a phone (16 from each side, 34
 * up, bar material). Compact: Clock's icon-only tabs inside an action bar (48,
 * the raised chip, a corner count, a green running dot). Signal
 * #SunoTabBar::changed (const char *key). Same tree and classes as Python's
 * TabBar (SunoUI-tab-bar, SunoUI-tab, SunoUI-tab-face, SunoUI-tab-label,
 * SunoUI-tab-dot, SunoUI-tab-count).
 */
#define SUNO_TYPE_TAB_BAR (Suno_tab_bar_get_type())
G_DECLARE_FINAL_TYPE(SunoTabBar, Suno_tab_bar, SUNO, TAB_BAR, GtkBox)

/**
 * Suno_tab_bar_new:
 * @compact: Clock's icon-only tabs for inside an action bar
 *
 * Returns: (transfer floating): a new, empty tab bar
 */
GtkWidget *Suno_tab_bar_new(gboolean compact);
/**
 * Suno_tab_bar_add:
 * @self: a tab bar
 * @key: the place's key
 * @label: its name
 * @icon: its Lucide glyph
 *
 * The first place added is current until Suno_tab_bar_set_current().
 */
void Suno_tab_bar_add(SunoTabBar *self, const char *key, const char *label, const char *icon);
const char *Suno_tab_bar_get_current(SunoTabBar *self);
/**
 * Suno_tab_bar_set_current:
 * @self: a tab bar
 * @key: a place's key
 * @notify: emit #SunoTabBar::changed when it changes
 */
void Suno_tab_bar_set_current(SunoTabBar *self, const char *key, gboolean notify);
/**
 * Suno_tab_bar_set_count:
 * @self: a tab bar
 * @key: a place's key
 * @count: a count badge (Alarms: 3); 0 removes it
 * @attention: the red one (Phone's Voicemail)
 */
void Suno_tab_bar_set_count(SunoTabBar *self, const char *key, int count, gboolean attention);
/**
 * Suno_tab_bar_set_running:
 * @self: a tab bar
 * @key: a place's key
 * @running: a green dot on the tab (a running stopwatch or timer)
 */
void Suno_tab_bar_set_running(SunoTabBar *self, const char *key, gboolean running);
/**
 * Suno_tab_bar_float_over:
 * @self: a tab bar
 * @where: an overlay, or a widget in a window (its window layer host)
 *
 * Sit full width at the foot (16 from each side, 34 up; CSS .floating).
 */
void Suno_tab_bar_float_over(SunoTabBar *self, GtkWidget *where);
/**
 * Suno_tab_bar_wants_tabs:
 * @n_places: how many places
 * @all_have_icons: whether every place has a glyph
 *
 * v71's rule: a switch between 3 or more places, each with an icon, is a tab bar on a phone.
 *
 * Returns: whether it should be one
 */
gboolean Suno_tab_bar_wants_tabs(guint n_places, gboolean all_have_icons);

G_END_DECLS
