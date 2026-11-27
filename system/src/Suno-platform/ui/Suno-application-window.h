/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <adwaita.h>

#include "Suno-context.h"

G_BEGIN_DECLS

#define SUNO_TYPE_APPLICATION_WINDOW (Suno_application_window_get_type())
G_DECLARE_FINAL_TYPE(SunoApplicationWindow, Suno_application_window, SUNO,
                     APPLICATION_WINDOW, AdwApplicationWindow)

/**
 * Suno_application_window_new:
 * @application: the application owning the window
 * @context: (nullable): an explicit context, or %NULL to follow the session
 *
 * Returns: (transfer none): a new application window
 */
GtkWidget *Suno_application_window_new(GtkApplication *application,
                                       SunoContext *context);
/* Match Python AppWindow: a bleeding page owns the phone status inset itself.
 * Both have no visual effect on a desktop, regardless of window width. */
void Suno_application_window_set_phone_bleed(SunoApplicationWindow *self, gboolean bleed);
int Suno_application_window_get_status_inset(SunoApplicationWindow *self);
void Suno_application_window_set_body(SunoApplicationWindow *self,
                                      GtkWidget *body);

/**
 * Suno_application_window_get_body:
 * @self: an application window
 *
 * Returns: (transfer none) (nullable): the application body
 */
GtkWidget *Suno_application_window_get_body(SunoApplicationWindow *self);
/* C1 AppWindow composition: place the frame sidebar beside the content
 * island, while retaining the native title row, window layer host and gutter. */
void Suno_application_window_set_frame(SunoApplicationWindow *self, GtkWidget *sidebar, GtkWidget *island);
/* Adopt the frame of an existing AdwApplicationWindow subclass. Its content,
 * actions and template children stay in place. The first top AdwHeaderBar is
 * dressed as the Suno title row; if absent, a toolbar view is added around
 * the existing content. Returns the title row, borrowed from the window. */
GtkWidget *Suno_application_window_frame_adopt(AdwApplicationWindow *window);
/* Move a pre-existing start action behind the kit identity, or pack a new
 * unparented action there. The widget and its signals remain unchanged. */
void Suno_application_window_frame_set_leading(AdwApplicationWindow *window,
                                               GtkWidget *widget);
/* Move an adopted frame's leading control into @phone_host below 640 px,
 * returning it to the title row when the window grows. */
void Suno_application_window_frame_set_leading_phone_host(AdwApplicationWindow *window,
                                                           GtkWidget *widget,
                                                           GtkWidget *phone_host);
void Suno_application_window_frame_set_menu_model(AdwApplicationWindow *window,
                                                  GMenuModel *menu_model);
/* Named title-row slots; a new widget replaces the previous one, NULL clears. */
void Suno_application_window_set_leading(SunoApplicationWindow *self, GtkWidget *widget);
void Suno_application_window_set_title_content(SunoApplicationWindow *self, GtkWidget *widget, gboolean centred);
void Suno_application_window_set_trailing(SunoApplicationWindow *self, GtkWidget *widget);
/**
 * Suno_application_window_get_layer_host:
 * @self: a native application window
 *
 * Returns: (transfer none): the window's shared overlay host
 */
GtkWidget *Suno_application_window_get_layer_host(SunoApplicationWindow *self);
/**
 * Suno_application_window_get_title_bar:
 * @self: a native application window
 *
 * Returns: (transfer none): the title row for semantic title actions
 */
GtkWidget *Suno_application_window_get_title_bar(SunoApplicationWindow *self);
void Suno_application_window_set_identity(SunoApplicationWindow *self,
                                          const char *title,
                                          const char *subtitle,
                                          const char *icon_name);
void Suno_application_window_set_menu_model(SunoApplicationWindow *self,
                                            GMenuModel *menu_model);

void Suno_application_window_set_status_bar_style(SunoApplicationWindow *self, const char *ink);
/* Paint through Tablet system areas; the caller must inset interactive UI. */
void Suno_application_window_set_edge_to_edge(SunoApplicationWindow *self, gboolean enabled);
G_END_DECLS
