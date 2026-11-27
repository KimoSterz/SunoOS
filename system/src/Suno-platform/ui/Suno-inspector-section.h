/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUNO_TYPE_INSPECTOR_SECTION (Suno_inspector_section_get_type())
G_DECLARE_FINAL_TYPE(SunoInspectorSection, Suno_inspector_section, SUNO,
                     INSPECTOR_SECTION, GtkBox)

GtkWidget *Suno_inspector_section_new(const char *title);
void Suno_inspector_section_set_title(SunoInspectorSection *self,
                                      const char *title);
void Suno_inspector_section_set_child(SunoInspectorSection *self,
                                      GtkWidget *child);
GtkWidget *Suno_inspector_section_get_child(SunoInspectorSection *self);
void Suno_inspector_section_set_expanded(SunoInspectorSection *self,
                                         gboolean expanded);
gboolean Suno_inspector_section_get_expanded(SunoInspectorSection *self);

G_END_DECLS
