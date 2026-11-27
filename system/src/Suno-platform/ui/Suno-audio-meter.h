/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoAudioMeter:
 *
 * A mono or stereo level meter, −60 dB to +12 dB: a recessed track per
 * channel filled in three zones (quiet, loud from −18 dB, hot from −6 dB),
 * with a peak tick that holds 1.5 s. Rises show at once and falls follow
 * meter ballistics (24 dB/s); it animates only while a bar or tick is
 * falling, so a still meter costs nothing. A level at or above 0 dB latches
 * the `clipping` style until Suno_audio_meter_reset_clip(). The accessible
 * value and description change in 6 dB steps, not every frame.
 *
 * Bars run bottom to top by default; Suno_audio_meter_set_horizontal()
 * runs them left to right, one under the other (a mixer row).
 *
 * #SunoAudioMeter:segments 0 draws each bar as one continuous fill. N > 0
 * draws N equal segments (LED style), --SunoUI-meter-segment-gap apart: a
 * segment lights once the level reaches half way into it, each in the zone
 * colour of its middle, unlit ones in the track colour, and the peak hold is
 * the one segment it reaches, lit. A segmented bar redraws only when a
 * segment changes. `LevelMeter` in Python is this part.
 *
 * Suno_audio_meter_set_zones(FALSE) is an output's meter, one colour with
 * no zones; Suno_audio_meter_set_segment_shape() gives a segmented bar its
 * own thickness, gap and segment radius.
 *
 * Tree: box.SunoUI-audio-meter(.horizontal)(.segmented)(.plain)(.clipping) with style
 * nodes .SunoUI-meter-track, -low, -mid, -high, -peak.
 */
#define SUNO_TYPE_AUDIO_METER (Suno_audio_meter_get_type())
G_DECLARE_FINAL_TYPE(SunoAudioMeter, Suno_audio_meter, SUNO, AUDIO_METER, GtkBox)

GtkWidget *Suno_audio_meter_new(guint channels);
void Suno_audio_meter_set_channels(SunoAudioMeter *self, guint channels);
guint Suno_audio_meter_get_channels(SunoAudioMeter *self);
void Suno_audio_meter_set_levels_db(SunoAudioMeter *self, double left_db,
                                    double right_db);
void Suno_audio_meter_set_levels(SunoAudioMeter *self, double left,
                                 double right);
void Suno_audio_meter_reset_clip(SunoAudioMeter *self);
void Suno_audio_meter_set_clipped(SunoAudioMeter *self, gboolean clipped);
gboolean Suno_audio_meter_get_clipped(SunoAudioMeter *self);
double Suno_audio_meter_db_to_fraction(double db);
void Suno_audio_meter_set_horizontal(SunoAudioMeter *self, gboolean horizontal);
gboolean Suno_audio_meter_get_horizontal(SunoAudioMeter *self);
/**
 * Suno_audio_meter_set_segments:
 * @self: a meter
 * @segments: 0 for a continuous bar, or 1 to 128 segments per bar
 */
void Suno_audio_meter_set_segments(SunoAudioMeter *self, guint segments);
guint Suno_audio_meter_get_segments(SunoAudioMeter *self);
/**
 * Suno_audio_meter_set_segment_shape:
 * @self: a meter
 * @thickness: a segmented bar's thickness in px, or 0 for the bar token's
 * @gap: px between segments, or a negative number for the token's
 * @radius: each segment's corner radius, or a negative number to round
 *   only the bar's ends
 *
 * A segmented bar's own shape (a 5 px bar of 2 px rounded segments 3 px
 * apart). A continuous bar keeps the tokens' shape.
 */
void Suno_audio_meter_set_segment_shape(SunoAudioMeter *self, double thickness, double gap, double radius);
/**
 * Suno_audio_meter_get_segment_shape:
 * @self: a meter
 * @thickness: (out) (optional): the thickness in use
 * @gap: (out) (optional): the gap in use
 * @radius: (out) (optional): the segment radius, negative when unset
 */
void Suno_audio_meter_get_segment_shape(SunoAudioMeter *self, double *thickness, double *gap, double *radius);
/**
 * Suno_audio_meter_set_zones:
 * @self: a meter
 * @zones: FALSE for an output's meter: every lit segment or fill is the
 *   quiet colour, the track is the control fill, and a segmented bar holds
 *   no peak. TRUE (the default) is a recording meter with loud and hot zones.
 */
void Suno_audio_meter_set_zones(SunoAudioMeter *self, gboolean zones);
gboolean Suno_audio_meter_get_zones(SunoAudioMeter *self);
/**
 * Suno_audio_meter_get_lit_segments:
 * @self: a meter
 * @channel: 0 (left or mono) or 1 (right)
 *
 * Returns: how many segments the level lights now, from the floor; 0 when
 *   the meter is continuous
 */
guint Suno_audio_meter_get_lit_segments(SunoAudioMeter *self, guint channel);
/**
 * Suno_audio_meter_get_peak_segment:
 * @self: a meter
 * @channel: 0 or 1
 *
 * Returns: the index from the floor of the segment the peak hold lights, or
 *   -1 when no peak shows, the meter is continuous or it has no zones
 */
int Suno_audio_meter_get_peak_segment(SunoAudioMeter *self, guint channel);
/**
 * Suno_audio_meter_segments_lit_at:
 * @segments: segments per bar
 * @db: a level in dBFS
 *
 * Returns: how many of @segments segments a bar at @db lights
 */
guint Suno_audio_meter_segments_lit_at(guint segments, double db);
/**
 * Suno_audio_meter_get_level_db:
 * @self: a meter
 * @channel: 0 (left or mono) or 1 (right)
 *
 * Returns: the level the bar shows now, after ballistics
 */
double Suno_audio_meter_get_level_db(SunoAudioMeter *self, guint channel);
/**
 * Suno_audio_meter_get_peak_db:
 * @self: a meter
 * @channel: 0 or 1
 *
 * Returns: where the peak tick is now
 */
double Suno_audio_meter_get_peak_db(SunoAudioMeter *self, guint channel);

G_END_DECLS
