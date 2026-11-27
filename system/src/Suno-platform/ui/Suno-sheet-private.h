/* SPDX-License-Identifier: Apache-2.0 */
/*
 * The question sheet in the bar's frame (Suno-save-sheet.c), shared by the
 * window sheet layer and the layer host's modal questions; not installed.
 *
 * On a phone a sheet rises from the bar's place: on the 16 gutter, 34 up, 26
 * round, at most the window less 120 tall, its head and body scrolling over
 * the pinned buttons. A landscape phone, a tablet or the Fold open gets the
 * same sheet at most 560 wide, centred. The desktop keeps its own sheet.
 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

typedef enum {
  SUNO_SHEET_POSTURE_DESKTOP,
  SUNO_SHEET_POSTURE_PHONE,
  SUNO_SHEET_POSTURE_FLOATING,
  SUNO_SHEET_POSTURE_TV,
} SunoSheetPosture;

/* How a sheet presents in a window this wide (0: not laid out yet). */
SunoSheetPosture Suno_sheet_posture_for_width (int width);
/* How a sheet presents in @widget's window now. */
SunoSheetPosture Suno_sheet_posture (GtkWidget *widget);

/* Load Suno-save-sheet.css (the sheet's own and the frame's rules) once. */
void Suno_sheet_install_style (void);

/* A card asks to be presented by the frame engine when the layer host shows it
 * as a drawer (SunoDestructiveDialog's confirm). */
void     Suno_sheet_mark_question (GtkWidget *card);
gboolean Suno_sheet_is_question   (GtkWidget *card);

typedef struct _SunoSheetFrame SunoSheetFrame;

/* @mover is the overlay child the frame places and moves (the window sheet's
 * scrim widget, or the layer host's card); @card is the visible sheet inside
 * it (may be @mover); @dim is the overlay child that dims the window under it
 * (a tap on it is Cancel), shown only while framed with @dim_when_framed. */
SunoSheetFrame  *Suno_sheet_frame_new          (GtkOverlay *overlay, GtkWidget *mover, GtkWidget *card,
                                                GtkWidget *dim, gboolean dim_when_framed);
SunoSheetFrame  *Suno_sheet_frame_get          (GtkWidget *mover);
void             Suno_sheet_frame_free         (SunoSheetFrame *frame);
/* Lay the sheet out for @posture, in place and without motion. */
void             Suno_sheet_frame_set_posture  (SunoSheetFrame *frame, SunoSheetPosture posture);
SunoSheetPosture Suno_sheet_frame_get_posture  (SunoSheetFrame *frame);
/* Whether the sheet is drawn in the bar's frame (phone or floating). */
gboolean         Suno_sheet_frame_is_framed    (SunoSheetFrame *frame);
/* Rise into place (or fade, with reduced motion). */
void             Suno_sheet_frame_enter        (SunoSheetFrame *frame);
/* Leave; @done runs once the sheet is off screen. Returns the motion's length
 * in ms, 0 when nothing moves (then @done has already run). */
guint            Suno_sheet_frame_leave        (SunoSheetFrame *frame, GSourceFunc done, gpointer data);
/* Place the frame's mover and dim in @overlay; for a GtkOverlay
 * ::get-child-position handler. */
gboolean         Suno_sheet_frame_position     (GtkOverlay *overlay, GtkWidget *child, GdkRectangle *allocation);
/* Connect Suno_sheet_frame_position() to @overlay once. */
void             Suno_sheet_frame_watch_overlay (GtkOverlay *overlay);

/* The swipe: does a release @dy down a sheet @height tall, moving at
 * @velocity px/ms, dismiss it? (past 30 % or faster than 0.5 px/ms) */
gboolean Suno_sheet_swipe_dismisses (double dy, double height, double velocity);
/* Test hooks: the sheet's current travel below its place, and a scripted
 * swipe (follow to @dy, release at @velocity). */
double   Suno_sheet_frame_get_offset (SunoSheetFrame *frame);
gboolean Suno_sheet_frame_is_moving  (SunoSheetFrame *frame);
void     Suno_sheet_frame_drag       (SunoSheetFrame *frame, double dy);
gboolean Suno_sheet_frame_release    (SunoSheetFrame *frame, double dy, double velocity);

/* The on-screen keyboard (the Shell's org.projectSuno.Shell.Keyboard1): how much of a window
 * @window_height tall the keys @keyboard_height tall cover, on a @monitor_height screen; 0 when
 * the Shell already shrank the window above them, -1 when they don't meet it. */
int      Suno_sheet_keyboard_cover (int window_height, int monitor_height, int keyboard_height,
                                    gboolean at_screen_bottom);
/* Tests: the keyboard up, covering @cover px of the window (-1: down), whatever the Shell says. */
void     Suno_sheet_simulate_keyboard (int cover);
double   Suno_sheet_frame_get_gap (SunoSheetFrame *frame);
/* The side room a device's display profile (display-geometry.json, as the Shell reads it) takes
 * from a sheet in the band @band_top..@band_bottom of a @screen_w × @screen_h screen. */
int      Suno_sheet_side_inset (const char *profile_json, const char *connector, int screen_w, int screen_h,
                                int band_top, int band_bottom);
/* Tests: the side inset (-1 back to the device's). */
void     Suno_sheet_simulate_side_inset (int inset);

G_END_DECLS
