/* SPDX-License-Identifier: Apache-2.0 */
/* Internal native twin of appkit/app_updates.py; not installed or introspected. */
#pragma once
#include <gtk/gtk.h>

GMenuModel *Suno_native_app_updates_menu(GtkApplication *application, GMenuModel *menu);
char *Suno_native_app_updates_parse_identity(const char *text, gsize size);
GObject *Suno_native_app_updates_new(GtkApplication *application, const char *app_id);
const char *Suno_native_app_updates_state(GObject *updates);
void Suno_native_app_updates_close(GObject *updates);
