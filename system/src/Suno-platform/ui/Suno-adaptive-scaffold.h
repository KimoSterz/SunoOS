/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <adwaita.h>

G_BEGIN_DECLS

#define SUNO_TYPE_ADAPTIVE_SCAFFOLD (Suno_adaptive_scaffold_get_type())
G_DECLARE_FINAL_TYPE(SunoAdaptiveScaffold, Suno_adaptive_scaffold, SUNO,
                     ADAPTIVE_SCAFFOLD, AdwBreakpointBin)

GtkWidget *Suno_adaptive_scaffold_new(void);
void Suno_adaptive_scaffold_set_sidebar(SunoAdaptiveScaffold *self,
                                        GtkWidget *sidebar, const char *title);
void Suno_adaptive_scaffold_set_content(SunoAdaptiveScaffold *self,
                                        GtkWidget *content, const char *title);
void Suno_adaptive_scaffold_set_compact_width(SunoAdaptiveScaffold *self,
                                              guint width);
/* Opt into a configured sidebar width in logical pixels. Before either setter
 * is called, native adaptive sizing is unchanged. Getter/property describe the
 * configured preference (initially 180), not the collapsed page allocation.
 * Limits default to 160..320 and must remain within 120..640. Native child
 * minimum sizes still apply; callers should provide responsive sidebar content. */
void Suno_adaptive_scaffold_set_sidebar_width_limits(
    SunoAdaptiveScaffold *self, guint minimum_width, guint maximum_width);
void Suno_adaptive_scaffold_set_sidebar_width(SunoAdaptiveScaffold *self,
                                              guint width);
guint Suno_adaptive_scaffold_get_sidebar_width(SunoAdaptiveScaffold *self);
gboolean Suno_adaptive_scaffold_get_collapsed(SunoAdaptiveScaffold *self);
void Suno_adaptive_scaffold_set_show_content(SunoAdaptiveScaffold *self,
                                             gboolean show_content);

G_END_DECLS
