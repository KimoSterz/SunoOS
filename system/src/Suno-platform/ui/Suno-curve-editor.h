/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUNO_TYPE_CURVE_EDITOR (Suno_curve_editor_get_type())
G_DECLARE_FINAL_TYPE(SunoCurveEditor, Suno_curve_editor, SUNO, CURVE_EDITOR,
                     GtkDrawingArea)

GtkWidget *Suno_curve_editor_new(void);
void Suno_curve_editor_set_points(SunoCurveEditor *self, GVariant *points);
GVariant *Suno_curve_editor_get_points(SunoCurveEditor *self);
void Suno_curve_editor_reset(SunoCurveEditor *self);

G_END_DECLS

