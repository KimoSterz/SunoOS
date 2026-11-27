/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

#include "Suno-audio-meter.h"
#include "Suno-volume-slider.h"

G_BEGIN_DECLS

/**
 * SunoMixerStrip:
 *
 * A mixer's channel strip, a fixed-width column (the
 * `--SunoUI-mixer-strip-width` token): the channel's name (ellipsized, the
 * full name as its tooltip) over its device, then a dB scale beside an
 * upright SunoVolumeSlider carrying a stereo SunoAudioMeter (peak hold and
 * ballistics are the meter's), the value readout, and Mute and Monitor keys.
 * An app's or device's icon can head it (Suno_mixer_strip_set_gicon()), and
 * either key can be left out (an output without monitoring, a fixed input):
 * the strip is a generic channel, for an app's audio panel or the system's
 * volume mixer alike.
 *
 * The fader runs from the range's low end (spoken and shown as −∞) to its
 * top; 0 dB is marked and a double click returns to it. Up and Down step
 * 1 dB, Page Up and Down 6 dB, Home and End go to the ends, the wheel steps,
 * and M mutes from anywhere in the strip. Only the person's moves emit
 * ::moved, ::mute-toggled and ::monitor-toggled; the setters are silent.
 *
 * In RTL the strip's names and keys mirror; the scale, fader and meter do
 * not, since they are read against one another.
 *
 * Tree: SunoUI-mixer-strip(.muted)(.monitoring) > box.SunoUI-mixer-content >
 * box.SunoUI-mixer-head > (image.SunoUI-mixer-icon, label.SunoUI-mixer-name,
 * label.SunoUI-mixer-device), box.SunoUI-mixer-body > (.SunoUI-mixer-scale, SunoUI-volume-slider),
 * label.SunoUI-mixer-readout, box.SunoUI-mixer-keys >
 * button.SunoUI-mixer-key.mute, button.SunoUI-mixer-key.monitor.
 */
#define SUNO_TYPE_MIXER_STRIP (Suno_mixer_strip_get_type())
G_DECLARE_FINAL_TYPE(SunoMixerStrip, Suno_mixer_strip, SUNO, MIXER_STRIP, GtkWidget)

/**
 * Suno_mixer_strip_new:
 * @label: the channel's name
 * @subtitle: (nullable): its device, or NULL
 *
 * Returns: a strip at 0 dB on a −60 to +6 dB fader
 */
GtkWidget *Suno_mixer_strip_new(const char *label, const char *subtitle);
void Suno_mixer_strip_set_label(SunoMixerStrip *self, const char *label);
const char *Suno_mixer_strip_get_label(SunoMixerStrip *self);
/**
 * Suno_mixer_strip_set_subtitle:
 * @self: a strip
 * @subtitle: (nullable): the device, or NULL for none
 */
void Suno_mixer_strip_set_subtitle(SunoMixerStrip *self, const char *subtitle);
const char *Suno_mixer_strip_get_subtitle(SunoMixerStrip *self);
void Suno_mixer_strip_set_range(SunoMixerStrip *self, double min_db, double max_db);
/**
 * Suno_mixer_strip_get_range:
 * @self: a strip
 * @min_db: (out) (optional): the fader's low end
 * @max_db: (out) (optional): its top
 */
void Suno_mixer_strip_get_range(SunoMixerStrip *self, double *min_db, double *max_db);
void Suno_mixer_strip_set_db(SunoMixerStrip *self, double db);
double Suno_mixer_strip_get_db(SunoMixerStrip *self);
void Suno_mixer_strip_set_muted(SunoMixerStrip *self, gboolean muted);
gboolean Suno_mixer_strip_get_muted(SunoMixerStrip *self);
void Suno_mixer_strip_set_monitoring(SunoMixerStrip *self, gboolean monitoring);
gboolean Suno_mixer_strip_get_monitoring(SunoMixerStrip *self);
/**
 * Suno_mixer_strip_set_gicon:
 * @self: a strip
 * @icon: (nullable): the channel's icon (an app's, a device's), or NULL for none
 */
void Suno_mixer_strip_set_gicon(SunoMixerStrip *self, GIcon *icon);
/**
 * Suno_mixer_strip_get_gicon:
 * @self: a strip
 *
 * Returns: (transfer none) (nullable): the channel's icon
 */
GIcon *Suno_mixer_strip_get_gicon(SunoMixerStrip *self);
/**
 * Suno_mixer_strip_set_icon_name:
 * @self: a strip
 * @icon: (nullable): a Lucide name ("mic") for the kit's glyph, or a theme or application icon name
 */
void Suno_mixer_strip_set_icon_name(SunoMixerStrip *self, const char *icon);
/**
 * Suno_mixer_strip_set_mute_visible:
 * @self: a strip
 * @visible: whether the strip offers Mute (and M mutes)
 */
void Suno_mixer_strip_set_mute_visible(SunoMixerStrip *self, gboolean visible);
gboolean Suno_mixer_strip_get_mute_visible(SunoMixerStrip *self);
/**
 * Suno_mixer_strip_set_monitor_visible:
 * @self: a strip
 * @visible: whether the strip offers Monitor
 */
void Suno_mixer_strip_set_monitor_visible(SunoMixerStrip *self, gboolean visible);
gboolean Suno_mixer_strip_get_monitor_visible(SunoMixerStrip *self);
/**
 * Suno_mixer_strip_set_levels_db:
 * @self: a strip
 * @left_db: the left (or mono) level in dBFS
 * @right_db: the right level in dBFS
 *
 * Feeds the strip's meter, as Suno_audio_meter_set_levels_db().
 */
void Suno_mixer_strip_set_levels_db(SunoMixerStrip *self, double left_db, double right_db);
/**
 * Suno_mixer_strip_set_levels:
 * @self: a strip
 * @left: the left (or mono) linear amplitude, 1.0 = 0 dBFS
 * @right: the right linear amplitude
 *
 * Feeds the strip's meter, as Suno_audio_meter_set_levels().
 */
void Suno_mixer_strip_set_levels(SunoMixerStrip *self, double left, double right);
/**
 * Suno_mixer_strip_get_fader:
 * @self: a strip
 *
 * Returns: (transfer none): the strip's fader
 */
SunoVolumeSlider *Suno_mixer_strip_get_fader(SunoMixerStrip *self);
/**
 * Suno_mixer_strip_get_meter:
 * @self: a strip
 *
 * Returns: (transfer none): the meter along the fader
 */
SunoAudioMeter *Suno_mixer_strip_get_meter(SunoMixerStrip *self);
/**
 * Suno_mixer_strip_get_mute_button:
 * @self: a strip
 *
 * Returns: (transfer none): the Mute key
 */
GtkWidget *Suno_mixer_strip_get_mute_button(SunoMixerStrip *self);
/**
 * Suno_mixer_strip_get_monitor_button:
 * @self: a strip
 *
 * Returns: (transfer none): the Monitor key
 */
GtkWidget *Suno_mixer_strip_get_monitor_button(SunoMixerStrip *self);

/**
 * SunoMixerRow:
 *
 * Mixer strips left to right (right to left in RTL), `--SunoUI-mixer-strip-row-gap`
 * apart, in a row that scrolls sideways when they do not all fit. The row is
 * never narrower than one strip and never taller or shorter than its strips
 * ask, so a strip is never clipped and nothing spills past the panel's edge;
 * it fits a DockTile(fit=True). Left and Right move between the strips'
 * faders.
 *
 * Tree: SunoUI-mixer-row > scrolledwindow > viewport > box.SunoUI-mixer-strips.
 */
#define SUNO_TYPE_MIXER_ROW (Suno_mixer_row_get_type())
G_DECLARE_FINAL_TYPE(SunoMixerRow, Suno_mixer_row, SUNO, MIXER_ROW, GtkWidget)

GtkWidget *Suno_mixer_row_new(void);
void Suno_mixer_row_append(SunoMixerRow *self, SunoMixerStrip *strip);
void Suno_mixer_row_remove(SunoMixerRow *self, SunoMixerStrip *strip);
guint Suno_mixer_row_get_n_strips(SunoMixerRow *self);
/**
 * Suno_mixer_row_get_strip:
 * @self: a row
 * @index: a strip's place, from the start
 *
 * Returns: (transfer none) (nullable): that strip, or NULL past the end
 */
SunoMixerStrip *Suno_mixer_row_get_strip(SunoMixerRow *self, guint index);

G_END_DECLS
