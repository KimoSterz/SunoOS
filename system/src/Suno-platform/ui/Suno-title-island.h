/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_island.TitleIsland (Python, K-NAV, v71 lNavTtl / .fisl / .crisl). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoTitleIslandLead:
 * @SUNO_TITLE_ISLAND_LEAD_MENU: ☰, the app's places ("menu"); ☰ and the title are one control
 * @SUNO_TITLE_ISLAND_LEAD_BACK: ‹, up one level ("back"); a control of its own
 * @SUNO_TITLE_ISLAND_LEAD_NONE: no lead (Calendar's head)
 */
typedef enum {
  SUNO_TITLE_ISLAND_LEAD_MENU,
  SUNO_TITLE_ISLAND_LEAD_BACK,
  SUNO_TITLE_ISLAND_LEAD_NONE,
} SunoTitleIslandLead;
GType Suno_title_island_lead_get_type(void);
#define SUNO_TYPE_TITLE_ISLAND_LEAD (Suno_title_island_lead_get_type())

/**
 * SunoTitleIslandGrows:
 * @SUNO_TITLE_ISLAND_GROWS_AUTO: ☰ grows into a menu, otherwise into details
 * @SUNO_TITLE_ISLAND_GROWS_MENU: min(320, window − 24), stops 128 above the foot; a row picked folds it
 * @SUNO_TITLE_ISLAND_GROWS_DETAILS: a phone's width less 24, min(360, window − 24) in a window
 */
typedef enum {
  SUNO_TITLE_ISLAND_GROWS_AUTO,
  SUNO_TITLE_ISLAND_GROWS_MENU,
  SUNO_TITLE_ISLAND_GROWS_DETAILS,
} SunoTitleIslandGrows;
GType Suno_title_island_grows_get_type(void);
#define SUNO_TYPE_TITLE_ISLAND_GROWS (Suno_title_island_grows_get_type())

/**
 * SunoTitleIsland:
 *
 * The v71 title island, top left, in the bar's material: the lead as a 48 px
 * square, a full-height hairline, the title over its subtitle, optional faces
 * before it and trailing buttons after it; 48 tall, 12 from the left, 6 under
 * the title row (52 from the window's top on a phone). Tap it and it grows
 * down into its menu (the places, ☰ becoming ✕) or its information (details)
 * as one piece of glass; ✕, a second tap, Esc, a tap beside it or picking a
 * place folds it. By default it shows only at phone tier (under 560);
 * Suno_title_island_set_phone_only() keeps it at every width.
 *
 * Signals: #SunoTitleIsland::lead (the lead pressed while folded: Back, or ☰
 * with nothing to grow into), #SunoTitleIsland::title (the title pressed with
 * nothing to grow into), #SunoTitleIsland::grown (gboolean).
 *
 * The same widget tree and CSS classes as Python's TitleIsland
 * (SunoUI-title-island*), styled by Suno-appkit-base.css.
 */
#define SUNO_TYPE_TITLE_ISLAND (Suno_title_island_get_type())
G_DECLARE_FINAL_TYPE(SunoTitleIsland, Suno_title_island, SUNO, TITLE_ISLAND, GtkBox)

/**
 * SunoTitleIslandGrowFunc:
 * @island: the island about to grow
 * @user_data: the data given with the function
 *
 * Make what the island grows into, each time it grows (Python `grow=callable`).
 *
 * Returns: (transfer floating) (nullable): the panel; %NULL does not grow
 */
typedef GtkWidget *(*SunoTitleIslandGrowFunc)(SunoTitleIsland *island, gpointer user_data);

/**
 * Suno_title_island_new:
 * @lead: ☰, ‹ or none
 * @title: what you are looking at
 * @subtitle: (nullable): the line under it
 *
 * Returns: (transfer floating): a new title island
 */
GtkWidget *Suno_title_island_new(SunoTitleIslandLead lead, const char *title, const char *subtitle);
/**
 * Suno_title_island_set_title:
 * @self: an island
 * @title: the title
 * @subtitle: (nullable): the line under it; %NULL keeps the current one, "" removes it
 */
void Suno_title_island_set_title(SunoTitleIsland *self, const char *title, const char *subtitle);
void Suno_title_island_set_subtitle(SunoTitleIsland *self, const char *subtitle);
const char *Suno_title_island_get_title(SunoTitleIsland *self);
const char *Suno_title_island_get_subtitle(SunoTitleIsland *self);
/**
 * Suno_title_island_set_lead:
 * @self: an island
 * @lead: ☰, ‹ or none
 * @label: (nullable): what the lead says to assistive technology ("Back to Projects");
 *   %NULL is "Places" or "Back"
 */
void Suno_title_island_set_lead(SunoTitleIsland *self, SunoTitleIslandLead lead, const char *label);
SunoTitleIslandLead Suno_title_island_get_lead(SunoTitleIsland *self);
/**
 * Suno_title_island_set_lead_icon:
 * @self: the island
 * @icon: (nullable): a semantic icon name, or NULL for the menu glyph
 *
 * Replaces only a menu lead's folded glyph, for example with the drive kind.
 * The shared title/menu action and close-while-grown behavior are unchanged.
 * Back and lead-less islands keep their standard presentation.
 */
void Suno_title_island_set_lead_icon(SunoTitleIsland *self, const char *icon);

/**
 * Suno_title_island_set_faces:
 * @self: an island
 * @faces: (nullable): faces before the title (Messages' avatar, Charlie's stack)
 */
void Suno_title_island_set_faces(SunoTitleIsland *self, GtkWidget *faces);
/**
 * Suno_title_island_set_status:
 * @self: an island
 * @status: (nullable): a dot before the title: "record" (pulsing red), "paused", "here" (presence before the subtitle), or %NULL
 */
void Suno_title_island_set_status(SunoTitleIsland *self, const char *status);
/**
 * Suno_title_island_set_title_content:
 * @self: an island
 * @content: (nullable): the title half drawn by the app (Calendar's month); %NULL restores
 *   the title and subtitle. It stays one button.
 */
void Suno_title_island_set_title_content(SunoTitleIsland *self, GtkWidget *content);
/**
 * Suno_title_island_add_trailing:
 * @self: an island
 * @widget: a trailing button past a hairline (Messages' Call and Video), 44 × 48
 *
 * Returns: (transfer none): @widget
 */
GtkWidget *Suno_title_island_add_trailing(SunoTitleIsland *self, GtkWidget *widget);
/**
 * Suno_title_island_button_new:
 * @icon: a Lucide glyph
 * @label: its name, as tooltip and accessible label
 *
 * A trailing button for Suno_title_island_add_trailing() (Python `TitleIsland.button`).
 *
 * Returns: (transfer floating): a new button
 */
GtkWidget *Suno_title_island_button_new(const char *icon, const char *label);
/**
 * Suno_title_island_set_grow_func:
 * @self: an island
 * @func: (nullable) (scope notified): makes the panel; %NULL: nothing to grow into
 * @user_data: (closure): data for @func
 * @destroy: (destroy user_data) (nullable): frees @user_data
 * @grows: menu, details, or by the lead
 */
void Suno_title_island_set_grow_func(SunoTitleIsland *self, SunoTitleIslandGrowFunc func, gpointer user_data,
                                     GDestroyNotify destroy, SunoTitleIslandGrows grows);
/**
 * Suno_title_island_set_grow_widget:
 * @self: an island
 * @widget: (nullable): what a tap grows into: a widget that lives in the page (the
 *   sidebar, in a #GtkBox or #GtkRevealer) is borrowed and put back on fold
 * @grows: menu, details, or by the lead
 */
void Suno_title_island_set_grow_widget(SunoTitleIsland *self, GtkWidget *widget, SunoTitleIslandGrows grows);
/**
 * Suno_title_island_grow_into:
 * @self: an island
 * @widget: (nullable): what to grow into; %NULL is what the grow function or widget gives
 *
 * Returns: whether it grew
 */
gboolean Suno_title_island_grow_into(SunoTitleIsland *self, GtkWidget *widget);
void Suno_title_island_fold(SunoTitleIsland *self);
void Suno_title_island_toggle(SunoTitleIsland *self);
gboolean Suno_title_island_get_grown(SunoTitleIsland *self);
/**
 * Suno_title_island_get_panel:
 * @self: an island
 *
 * Returns: (transfer none) (nullable): what it has grown into
 */
GtkWidget *Suno_title_island_get_panel(SunoTitleIsland *self);
/**
 * Suno_title_island_float_over:
 * @self: an island
 * @where: an overlay (a #SunoLayerHost or the app's own #GtkOverlay), or a widget
 *   in a window, whose window layer host is used
 *
 * Float at the top left: 12 from the left, 6 under the title row.
 */
void Suno_title_island_float_over(SunoTitleIsland *self, GtkWidget *where);
/**
 * Suno_title_island_attach:
 * @self: an island
 * @region: as for Suno_title_island_float_over()
 *
 * The same as Suno_title_island_float_over() (the name K-C first published).
 */
void Suno_title_island_attach(SunoTitleIsland *self, GtkWidget *region);
/**
 * Suno_title_island_set_phone_only:
 * @self: an island
 * @phone_only: %TRUE (the default): it shows only under 560; %FALSE: at every width
 */
void Suno_title_island_set_phone_only(SunoTitleIsland *self, gboolean phone_only);
gboolean Suno_title_island_get_phone_only(SunoTitleIsland *self);
/**
 * Suno_title_island_follow:
 * @self: an island
 * @scroller: the page that scrolls under it
 * @until: how far it follows, in px (90)
 * @fade: how far until it is gone, in px (60)
 *
 * Fade the island as @scroller scrolls (v71 Calendar's Month).
 */
void Suno_title_island_follow(SunoTitleIsland *self, GtkScrolledWindow *scroller, int until, int fade);

/** Select standard (48px divided lead, default) or creative (44px single Back/title control). */
void Suno_title_island_set_variant(SunoTitleIsland *self, const char *variant);

G_END_DECLS
