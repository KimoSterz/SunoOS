/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUNO_TYPE_COLOR_WELL (Suno_color_well_get_type())
G_DECLARE_FINAL_TYPE(SunoColorWell, Suno_color_well, SUNO, COLOR_WELL, GtkBox)

GtkWidget *Suno_color_well_new(void);
void Suno_color_well_set_rgba(SunoColorWell *self, const GdkRGBA *rgba);
const GdkRGBA *Suno_color_well_get_rgba(SunoColorWell *self);
void Suno_color_well_set_text(SunoColorWell *self, const char *text);
const char *Suno_color_well_get_text(SunoColorWell *self);

G_END_DECLS
