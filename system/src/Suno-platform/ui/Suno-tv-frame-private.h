/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <gtk/gtk.h>

G_BEGIN_DECLS
/* The floating island (Suno-tv-frame.c): a window's frame of sidebar and page, laid out for a TV
 * while the window is in TV posture. @content is the window's own content widget. */
void Suno_tv_frame_attach(GtkWindow *window, GtkWidget *content, GtkWidget *frame,
                          GtkWidget *sidebar, GtkWidget *island);
void Suno_tv_frame_set_active(GtkWindow *window, gboolean tv);
gboolean Suno_tv_frame_is_active(GtkWindow *window);
/* The page laid out again (Suno-island.c): what it drew is fitted to the TV page on the next idle. */
void Suno_tv_frame_page_changed(GtkWindow *window);
void Suno_tv_room_load(GtkWidget *room);
/* Tests: the remote key @keyval as the frame takes it; TRUE when the frame handled it. */
gboolean Suno_tv_frame_key(GtkWindow *window, guint keyval);
/* A press without its release: pressed again, it is the key repeating (tests). */
gboolean Suno_tv_frame_key_held(GtkWindow *window, guint keyval);
/* The key let go (tests). */
gboolean Suno_tv_frame_key_release(GtkWindow *window, guint keyval);
/* The TV keyboard's height in TV units (0 hidden), followed (Suno-tv-keyboard.c). */
typedef void (*SunoTvKeyboardFunc)(guint height, gpointer data);
gpointer Suno_tv_keyboard_watch(SunoTvKeyboardFunc func, gpointer data);
void Suno_tv_keyboard_unwatch(gpointer watch);
/* The TV action bar on demand (Suno-action-center.c): on a TV page an action center shows only while
 * the remote asked for it (the menu key, a held OK), holds the remote, and gives it back on Back or
 * once an action has acted. */
typedef struct _SunoActionCenter SunoActionCenter;
void Suno_action_center_set_tv_demand(SunoActionCenter *self, gboolean demand);
gboolean Suno_action_center_get_tv_demand(SunoActionCenter *self);
void Suno_action_center_tv_open(SunoActionCenter *self, GtkWidget *from);
void Suno_action_center_tv_close(SunoActionCenter *self);
gboolean Suno_action_center_get_tv_open(SunoActionCenter *self);
/* TV posture's eased edge fades (Suno-tv-fade.c), the mockups' .tv-page / .tv-fade: @draw draws what fades.
 * FALSE (nothing drawn) off a TV. */
typedef void (*SunoTvFadeDraw)(GtkWidget *widget, GtkSnapshot *snapshot);
double Suno_tv_fade_unit(GtkWidget *widget);
gboolean Suno_tv_fade_snapshot(GtkWidget *widget, GtkSnapshot *snapshot, GtkAdjustment *adjustment,
                               double top_units, double bottom_units, SunoTvFadeDraw draw);
/* A scrolled list's fades (the floating island's): put between @scroll and what it scrolls, or taken away. */
#define SUNO_TYPE_TV_FADE (Suno_tv_fade_get_type())
G_DECLARE_FINAL_TYPE(SunoTvFade, Suno_tv_fade, SUNO, TV_FADE, GtkWidget)
void Suno_tv_fade_wrap(GtkScrolledWindow *scroll, gboolean tv, double top_units, double bottom_units);
G_END_DECLS
