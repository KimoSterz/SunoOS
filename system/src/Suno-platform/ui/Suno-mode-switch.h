/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_placement.ModeSwitch (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoModeSwitch:
 *
 * Icon and label modes on a recessed well; the current mode is the raised
 * chip, which slides to the new one. In a window 820 px wide or less only the
 * current mode keeps its label. Arrows move between modes and choose them.
 * A switch offers at least two modes, with unique keys.
 *
 * Emits #SunoModeSwitch::changed (the new key) when a person picks a mode,
 * never for Suno_mode_switch_set_current().
 */
#define SUNO_TYPE_MODE_SWITCH (Suno_mode_switch_get_type())
G_DECLARE_FINAL_TYPE(SunoModeSwitch, Suno_mode_switch, SUNO, MODE_SWITCH, GtkBox)

/**
 * Suno_mode_switch_new:
 * @label: (nullable): what the group is, for assistive technology ("Mode")
 *
 * Returns: (transfer floating): a new, empty mode switch
 */
GtkWidget *Suno_mode_switch_new(const char *label);
/**
 * Suno_mode_switch_add:
 * @self: a mode switch
 * @key: the mode's stable key
 * @label: its name ("Mark up")
 * @icon: (nullable): a Lucide glyph ("pen-line"); %NULL makes the mode words alone (the switch is then labels-only)
 *
 * Add a mode. The first one added is current until another is chosen.
 */
void Suno_mode_switch_add(SunoModeSwitch *self, const char *key, const char *label, const char *icon);
/* Keep every mode's accessible name while showing only its icon. */
void Suno_mode_switch_set_icon_only(SunoModeSwitch *self, gboolean icon_only);
gboolean Suno_mode_switch_get_icon_only(SunoModeSwitch *self);
/**
 * Suno_mode_switch_set_current:
 * @self: a mode switch
 * @key: a key already added
 *
 * Choose a mode without emitting #SunoModeSwitch::changed.
 */
void Suno_mode_switch_set_current(SunoModeSwitch *self, const char *key);
const char *Suno_mode_switch_get_current(SunoModeSwitch *self);

/**
 * Suno_mode_switch_set_fill:
 * @self: a mode switch
 * @fill: %TRUE (v71 Settings' segmented rows on a phone): it takes the width it is
 *   given, its segments share it equally, and the chip is one cell (Python
 *   `ModeSwitch(fill=True)`); works with compact
 */
void Suno_mode_switch_set_fill(SunoModeSwitch *self, gboolean fill);
gboolean Suno_mode_switch_get_fill(SunoModeSwitch *self);
/**
 * Suno_mode_switch_set_small:
 * @self: a mode switch
 * @small: TRUE for 12px labels and 6px side padding in a regular-height property row
 *
 * Labels can ellipsize in constrained rows; their full accessible names remain.
 */
void Suno_mode_switch_set_small(SunoModeSwitch *self, gboolean small);
/**
 * Suno_mode_switch_set_compact:
 * @self: a mode switch
 * @compact: %TRUE for a choice inside a settings row (v70 `.cfrow .seg`: 32 tall, 26 buttons, 12.5)
 */
void Suno_mode_switch_set_compact(SunoModeSwitch *self, gboolean compact);

/**
 * Suno_mode_switch_set_stop_width:
 * @self: a mode switch
 * @width: fixed segment width, or zero to restore content-sized segments
 *
 * Numerical stops keep equal widths and a token gap even when fill is enabled.
 * Long labels ellipsize; their accessible names and tooltips remain complete.
 */
/* Let text-only mode labels shrink with ellipsis; full accessible names remain. */
void Suno_mode_switch_set_ellipsize(SunoModeSwitch *self, gboolean ellipsize);
gboolean Suno_mode_switch_get_ellipsize(SunoModeSwitch *self);
void Suno_mode_switch_set_stop_width(SunoModeSwitch *self, int width);
int Suno_mode_switch_get_stop_width(SunoModeSwitch *self);

/**
 * Suno_mode_switch_set_status:
 * @self: a mode switch
 * @key: the mode key
 * @status: (nullable): "running" for a dot, other status text, or NULL to clear
 */
void Suno_mode_switch_set_status(SunoModeSwitch *self, const char *key, const char *status);

G_END_DECLS
