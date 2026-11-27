/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <gtk/gtk.h>
G_BEGIN_DECLS
void Suno_reorder_hint_begin (GtkWidget *list, GtkWidget *source);
void Suno_reorder_hint_clear (GtkWidget *list);
void Suno_reorder_hint_set_target (GtkWidget *list, GtkWidget *row, gboolean after);
gboolean Suno_reorder_hint_is_after (GtkWidget *row, double y);
void Suno_reorder_hint_end (GtkWidget *list);
G_END_DECLS
