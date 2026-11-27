/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI creative family: SunoColorPicker, the kit's one colour picker
 * (Canvas, Grid, Streamy). #SunoPropertyColor opens it from its swatch; an
 * app may also put it in its own panel (an ActionCenter grown panel).
 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoColorPicker:
 *
 * A colour, picked by hand.
 *
 * - A saturation and brightness area over a hue strip and an opacity strip
 *   (drag, click, or focus and use the arrow keys; Shift steps ten times).
 * - Suno's palette, the document's colours (Suno_color_picker_set_palette())
 *   and the colours recently committed in this app (kept in the app's config,
 *   `$XDG_CONFIG_HOME/<app id>/SunoUI.ini`), as swatches.
 * - The eyedropper picks a colour off the screen through the Screenshot
 *   portal's PickColor; a hex field takes a typed code.
 *
 * #SunoColorPicker::color-changed follows every change (preview it live);
 * #SunoColorPicker::color-committed fires once when the person finishes: a
 * drag ends, a swatch or the eyedropper picks, a code is entered, an arrow
 * key is let go. Commit is one undo step. Suno_color_picker_set_rgba()
 * emits neither.
 *
 * Tree: box.SunoUI-color-picker
 *   ├ drawingarea.SunoUI-color-picker-area
 *   ├ drawingarea.SunoUI-color-picker-hue
 *   ├ drawingarea.SunoUI-color-picker-alpha
 *   ├ flowbox.SunoUI-color-picker-swatches (.Suno, .document, .recent) …
 *   └ box.SunoUI-color-picker-foot > button.SunoUI-color-picker-eyedropper, entry.SunoUI-creative-hex
 */
#define SUNO_TYPE_COLOR_PICKER (Suno_color_picker_get_type())
G_DECLARE_FINAL_TYPE(SunoColorPicker, Suno_color_picker, SUNO, COLOR_PICKER, GtkBox)

/**
 * Suno_color_picker_new:
 *
 * Returns: (transfer floating): a new picker, black
 */
GtkWidget *Suno_color_picker_new(void);
/**
 * Suno_color_picker_set_rgba:
 * @self: a picker
 * @rgba: the colour to show; emits nothing
 */
void Suno_color_picker_set_rgba(SunoColorPicker *self, const GdkRGBA *rgba);
/**
 * Suno_color_picker_get_rgba:
 * @self: a picker
 * @rgba: (out caller-allocates): the colour
 */
void Suno_color_picker_get_rgba(SunoColorPicker *self, GdkRGBA *rgba);
/**
 * Suno_color_picker_set_palette:
 * @self: a picker
 * @colors: (array length=n_colors) (nullable): the document's colours, shown
 *   after Suno's
 * @n_colors: how many
 */
void Suno_color_picker_set_palette(SunoColorPicker *self, const GdkRGBA *colors, guint n_colors);
/**
 * Suno_color_picker_set_with_alpha:
 * @self: a picker
 * @with_alpha: whether the colour has an opacity (the strip shows); %TRUE by default
 */
void Suno_color_picker_set_with_alpha(SunoColorPicker *self, gboolean with_alpha);
/**
 * Suno_color_picker_pick_from_screen:
 * @self: a picker
 *
 * The eyedropper: ask the Screenshot portal for a colour on the screen. The
 * picked colour (with the current opacity) is changed and committed; a
 * cancelled pick does nothing. Without the portal the eyedropper is greyed.
 */
void Suno_color_picker_pick_from_screen(SunoColorPicker *self);
/**
 * Suno_color_picker_get_recent_colors:
 * @n_colors: (out): how many
 *
 * The colours recently committed in this app, newest first.
 *
 * Returns: (array length=n_colors) (transfer full): the colours
 */
GdkRGBA *Suno_color_picker_get_recent_colors(guint *n_colors);
/**
 * Suno_color_picker_add_recent_color:
 * @rgba: a colour to keep at the front of the recent ones (pickers do this
 *   when they commit)
 */
void Suno_color_picker_add_recent_color(const GdkRGBA *rgba);

G_END_DECLS
