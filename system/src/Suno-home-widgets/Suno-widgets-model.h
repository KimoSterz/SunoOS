/* SPDX-License-Identifier: GPL-3.0-or-later */
#pragma once
#include <gio/gio.h>
G_BEGIN_DECLS
#define SUNO_WIDGETS_TYPE_MODEL (Suno_widgets_model_get_type())
G_DECLARE_FINAL_TYPE (SunoWidgetsModel, Suno_widgets_model, SUNO_WIDGETS, MODEL, GObject)
/**
 * Suno_widgets_model_new:
 * @calendar_service: native calendar server bus name
 *
 * Returns: (transfer full): the shared Weather and Calendar widget model
 */
SunoWidgetsModel *Suno_widgets_model_new (const char *calendar_service);
/**
 * Suno_widgets_model_dup_snapshot:
 * @self: shared widget model
 *
 * Returns: (transfer full): JSON containing the widget's display fields
 */
char *Suno_widgets_model_dup_snapshot (SunoWidgetsModel *self);
G_END_DECLS
