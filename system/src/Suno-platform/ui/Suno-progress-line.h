/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of rows_progress.ProgressLine (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoProgressLine:
 *
 * How far along something is: a thin line that fills from the start. Sizes "row" (4 px), "tile"
 * (3), "meter" (4), "hero" (8 in a well) and "well" (5 in a well, v70 `.lprog`); tones "accent",
 * "good", "neutral", "warning", "danger" and "chart". It fills the width it is given; screen readers hear its label and
 * the percentage.
 */
#define SUNO_TYPE_PROGRESS_LINE (Suno_progress_line_get_type())
G_DECLARE_FINAL_TYPE(SunoProgressLine, Suno_progress_line, SUNO, PROGRESS_LINE, GtkWidget)

/**
 * Suno_progress_line_new:
 * @fraction: how far along, 0 to 1
 * @size: (nullable): "row" (%NULL), "tile", "meter", "hero" or "well"
 * @tone: (nullable): "accent" (%NULL), "good", "neutral", "warning", "danger" or "chart"
 *
 * Returns: (transfer floating): a new progress line
 */
GtkWidget *Suno_progress_line_new(double fraction, const char *size, const char *tone);
void Suno_progress_line_set_fraction(SunoProgressLine *self, double fraction);
double Suno_progress_line_get_fraction(SunoProgressLine *self);
/**
 * Suno_progress_line_set_label:
 * @self: a progress line
 * @label: (nullable): what is progressing ("Black toner")
 */
void Suno_progress_line_set_label(SunoProgressLine *self, const char *label);

G_END_DECLS
