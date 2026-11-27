/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUNO_TYPE_HISTOGRAM (Suno_histogram_get_type())
G_DECLARE_FINAL_TYPE(SunoHistogram, Suno_histogram, SUNO, HISTOGRAM,
                     GtkDrawingArea)

GtkWidget *Suno_histogram_new(void);
void Suno_histogram_set_channels(SunoHistogram *self, GVariant *channels);
GVariant *Suno_histogram_get_channels(SunoHistogram *self);
void Suno_histogram_set_clipping_visible(SunoHistogram *self, gboolean visible);
gboolean Suno_histogram_get_clipping_visible(SunoHistogram *self);

G_END_DECLS

