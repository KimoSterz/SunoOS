/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

#include "Suno-audio-meter.h"

G_BEGIN_DECLS

/**
 * SunoVolumeSlider:
 *
 * A volume: SunoUI's slider (a 4 px recessed track filled to the value and a
 * raised 14 px knob) standing upright for a mixer's channel strip or lying
 * flat for a row, with an optional SunoAudioMeter laid along the track over
 * exactly the track's length, so the level and the volume read on one scale.
 *
 * The range is any pair of numbers (0–100 %, 0–150 %, −60–+6 dB). A unity
 * value (100 %, 0 dB) inside the range is marked across the track, and a
 * double click returns to it. Muted, the fill and the meter go quiet but the
 * knob stays where the volume is.
 *
 * Arrows along the slider step by the small step (arrows across it are left
 * for focus), Page Up/Down by the page step, Home and End
 * go to the ends; the wheel steps; a press on the track jumps there and drags.
 * Only those moves emit ::moved; Suno_volume_slider_set_value() does not.
 *
 * Tree: SunoUI-volume-slider(.vertical|.horizontal)(.compact)(.muted) with style nodes
 * .SunoUI-volume-track, -fill, -knob, -ring, -shadow, -mark, -focus, and the
 * meter (box.SunoUI-audio-meter) as its child.
 */
#define SUNO_TYPE_VOLUME_SLIDER (Suno_volume_slider_get_type())
G_DECLARE_FINAL_TYPE(SunoVolumeSlider, Suno_volume_slider, SUNO, VOLUME_SLIDER, GtkWidget)

GtkWidget *Suno_volume_slider_new(GtkOrientation orientation, double lower, double upper);
void Suno_volume_slider_set_value(SunoVolumeSlider *self, double value);
double Suno_volume_slider_get_value(SunoVolumeSlider *self);
void Suno_volume_slider_set_range(SunoVolumeSlider *self, double lower, double upper);
void Suno_volume_slider_get_range(SunoVolumeSlider *self, double *lower, double *upper);
void Suno_volume_slider_set_steps(SunoVolumeSlider *self, double step, double page);
/**
 * Suno_volume_slider_set_unity:
 * @self: a slider
 * @unity: the value marked on the track and returned to by a double click,
 *   or NAN for none
 */
void Suno_volume_slider_set_unity(SunoVolumeSlider *self, double unity);
double Suno_volume_slider_get_unity(SunoVolumeSlider *self);
/**
 * Suno_volume_slider_set_unit:
 * @self: a slider
 * @unit: (nullable): "%" (the default) or "dB": how the value is spoken
 */
void Suno_volume_slider_set_unit(SunoVolumeSlider *self, const char *unit);
/**
 * Suno_volume_slider_set_compact:
 * @self: a slider
 * @compact: TRUE for a row in a panel: a 12 px knob in a 16 px slot (the
 *   `--SunoUI-volume-slider-compact-*` tokens) on the same 4 px track
 */
void Suno_volume_slider_set_compact(SunoVolumeSlider *self, gboolean compact);
gboolean Suno_volume_slider_get_compact(SunoVolumeSlider *self);
void Suno_volume_slider_set_muted(SunoVolumeSlider *self, gboolean muted);
gboolean Suno_volume_slider_get_muted(SunoVolumeSlider *self);
/**
 * Suno_volume_slider_set_meter_channels:
 * @self: a slider
 * @channels: 0 (no meter), 1 or 2
 *
 * Lays a SunoAudioMeter along the track: beside it standing, under it lying.
 */
void Suno_volume_slider_set_meter_channels(SunoVolumeSlider *self, guint channels);
/**
 * Suno_volume_slider_get_meter:
 * @self: a slider
 *
 * Returns: (transfer none) (nullable): the meter along the track, to feed
 *   with Suno_audio_meter_set_levels_db()
 */
SunoAudioMeter *Suno_volume_slider_get_meter(SunoVolumeSlider *self);
/**
 * Suno_volume_slider_get_track_bounds:
 * @self: a slider
 * @bounds: (out caller-allocates): where the track's ends are, in the slider
 *
 * The track as drawn: along the slider from the knob's centre at one end to
 * its centre at the other plus its rounded ends, and 4 px across. The meter
 * lies over exactly this length.
 */
void Suno_volume_slider_get_track_bounds(SunoVolumeSlider *self, graphene_rect_t *bounds);

G_END_DECLS
