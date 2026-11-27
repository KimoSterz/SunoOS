/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include "Suno-action.h"
#include "Suno-enums.h"
#include <gio/gio.h>

G_BEGIN_DECLS

#define SUNO_TYPE_LIVE_EXTENSION (Suno_live_extension_get_type())
G_DECLARE_FINAL_TYPE(SunoLiveExtension, Suno_live_extension, SUNO,
                     LIVE_EXTENSION, GObject)

SunoLiveExtension *Suno_live_extension_new(const char *id, const char *app_id,
                                           SunoLiveCategory category,
                                           const char *title);
const char *Suno_live_extension_get_id(SunoLiveExtension *self);
const char *Suno_live_extension_get_app_id(SunoLiveExtension *self);
const char *Suno_live_extension_get_title(SunoLiveExtension *self);
const char *Suno_live_extension_get_subtitle(SunoLiveExtension *self);
void Suno_live_extension_set_subtitle(SunoLiveExtension *self,
                                      const char *subtitle);
double Suno_live_extension_get_progress(SunoLiveExtension *self);
void Suno_live_extension_set_progress(SunoLiveExtension *self, double progress);
const char *Suno_live_extension_get_expires_at(SunoLiveExtension *self);
void Suno_live_extension_set_expires_at(SunoLiveExtension *self,
                                        const char *expires_at);
const char *Suno_live_extension_get_starts_at(SunoLiveExtension *self);
void Suno_live_extension_set_starts_at(SunoLiveExtension *self,
                                       const char *starts_at);
SunoPrivacy Suno_live_extension_get_privacy(SunoLiveExtension *self);
void Suno_live_extension_set_privacy(SunoLiveExtension *self,
                                     SunoPrivacy privacy);
/**
 * Suno_live_extension_get_actions:
 * @self: a Live Extension
 *
 * Returns: (transfer none): up to three actions
 */
GListModel *Suno_live_extension_get_actions(SunoLiveExtension *self);
gboolean Suno_live_extension_add_action(SunoLiveExtension *self,
                                        SunoAction *action, GError **error);
GVariant *Suno_live_extension_to_variant(SunoLiveExtension *self);

G_END_DECLS
