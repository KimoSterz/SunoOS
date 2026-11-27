/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUNO_TYPE_SEGMENTED_CONTROL (Suno_segmented_control_get_type())
G_DECLARE_FINAL_TYPE(SunoSegmentedControl, Suno_segmented_control, SUNO,
                     SEGMENTED_CONTROL, GtkBox)

GtkWidget *Suno_segmented_control_new(void);
void Suno_segmented_control_append(SunoSegmentedControl *self,
                                   const char *id, const char *label);
void Suno_segmented_control_set_selected(SunoSegmentedControl *self,
                                         const char *id);
const char *Suno_segmented_control_get_selected(SunoSegmentedControl *self);

G_END_DECLS
