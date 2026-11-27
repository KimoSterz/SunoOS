/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/* MD3: a shared, data-bound story/arrangement timeline. Frame values use the
 * caller's rational frame rate; all edit/seek signals report seconds. The kit
 * paints and reports intent; the application owns model changes and undo. */
#define SUNO_TYPE_TIMELINE (Suno_timeline_get_type())
G_DECLARE_FINAL_TYPE(SunoTimeline, Suno_timeline, SUNO, TIMELINE, GtkBox)

/* Signals: seek(double seconds), skim(double seconds; -1 when pointer leaves),
 * region-selected(const char *id), region-move(const char *id, double start_seconds),
 * region-trim(const char *id, double duration_seconds),
 * region-split(const char *id, double seconds),
 * gesture-begin/commit/cancel(const char *id, const char *action),
 * lane-action(const char *lane_id, const char *action, gboolean enabled),
 * tool-changed(const char *tool), snapping-changed(gboolean), zoom-changed(double).
 * Region actions never mutate the app's data; replace it through begin/end_update. */
GtkWidget *Suno_timeline_new(void);
void Suno_timeline_begin_update(SunoTimeline *self);
void Suno_timeline_end_update(SunoTimeline *self);
void Suno_timeline_clear(SunoTimeline *self);
void Suno_timeline_set_frame_rate(SunoTimeline *self, guint numerator, guint denominator);
void Suno_timeline_set_duration_frames(SunoTimeline *self, gint64 frames);
void Suno_timeline_set_position_frames(SunoTimeline *self, gint64 frames);
void Suno_timeline_set_loop_frames(SunoTimeline *self, gint64 start, gint64 end);
void Suno_timeline_append_marker(SunoTimeline *self, gint64 frame, const char *label);
void Suno_timeline_append_lane(SunoTimeline *self, const char *id, const char *name,
                               const char *kind, const char *icon);
void Suno_timeline_set_lane_state(SunoTimeline *self, const char *id, gboolean muted,
                                  gboolean solo, gboolean armed, double meter);
void Suno_timeline_append_region(SunoTimeline *self, const char *lane_id,
                                 const char *id, const char *name, const char *kind,
                                 gint64 start_frame, gint64 duration_frames,
                                 gboolean selected);
/**
 * Suno_timeline_set_region_waveform:
 * @self: a timeline
 * @id: region identifier
 * @peaks: (array length=n_peaks) (nullable): caller-supplied normalized peaks
 * @n_peaks: number of peaks
 *
 * The kit does no media read or cache work.
 */
void Suno_timeline_set_region_waveform(SunoTimeline *self, const char *id,
                                       const double *peaks, gsize n_peaks);
/* A MIDI note in frames relative to the region, with MIDI pitch 0..127. */
void Suno_timeline_append_note(SunoTimeline *self, const char *id,
                               gint64 offset_frame, gint64 duration_frames, guint pitch);
void Suno_timeline_set_selected_region(SunoTimeline *self, const char *id);
void Suno_timeline_set_tool(SunoTimeline *self, const char *tool);
void Suno_timeline_set_snapping(SunoTimeline *self, gboolean enabled);
void Suno_timeline_set_zoom(SunoTimeline *self, double zoom);
void Suno_timeline_set_export_status(SunoTimeline *self, const char *label,
                                     double progress_fraction);

G_END_DECLS
