/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <gtk/gtk.h>
G_BEGIN_DECLS
#define SUNO_TYPE_CHOICE_LIST (Suno_choice_list_get_type())
G_DECLARE_FINAL_TYPE(SunoChoiceList, Suno_choice_list, SUNO, CHOICE_LIST, GtkBox)
/** A described single-selection list. "changed" emits the chosen string key. */
GtkWidget *Suno_choice_list_new(gboolean panel);
void Suno_choice_list_append(SunoChoiceList *self, const char *key, const char *title, const char *detail);
/** Programmatic selection does not emit "changed". */
void Suno_choice_list_set_selected(SunoChoiceList *self, const char *key);
const char *Suno_choice_list_get_selected(SunoChoiceList *self);
G_END_DECLS
