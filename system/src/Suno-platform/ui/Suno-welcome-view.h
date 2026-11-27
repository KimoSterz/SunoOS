/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <gtk/gtk.h>
G_BEGIN_DECLS
#define SUNO_TYPE_WELCOME_VIEW (Suno_welcome_view_get_type())
G_DECLARE_FINAL_TYPE(SunoWelcomeView, Suno_welcome_view, SUNO, WELCOME_VIEW, GtkWidget)
GtkWidget *Suno_welcome_view_new(const char *title, const char *icon_name,
                                const char *description, const char *noun,
                                const char *settings_schema);
/**
 * Suno_welcome_view_get_new_button:
 * @self: the welcome view
 * Returns: (transfer none): button to bind to the existing New command
 */
GtkWidget *Suno_welcome_view_get_new_button(SunoWelcomeView *self);
/**
 * Suno_welcome_view_get_open_button:
 * @self: the welcome view
 * Returns: (transfer none): button to bind to the existing Open command
 */
GtkWidget *Suno_welcome_view_get_open_button(SunoWelcomeView *self);
gboolean Suno_welcome_view_should_show(const char *settings_schema);
G_END_DECLS
