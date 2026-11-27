/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include "Suno-enums.h"
#include <gio/gio.h>

G_BEGIN_DECLS

#define SUNO_TYPE_ACTION (Suno_action_get_type())
G_DECLARE_FINAL_TYPE(SunoAction, Suno_action, SUNO, ACTION, GObject)

SunoAction *Suno_action_new(const char *id, const char *label);
const char *Suno_action_get_id(SunoAction *self);
const char *Suno_action_get_label(SunoAction *self);
const char *Suno_action_get_description(SunoAction *self);
void Suno_action_set_description(SunoAction *self, const char *description);
const char *Suno_action_get_parameter_type(SunoAction *self);
void Suno_action_set_parameter_type(SunoAction *self,
                                    const char *parameter_type);
SunoActionRisk Suno_action_get_risk(SunoAction *self);
void Suno_action_set_risk(SunoAction *self, SunoActionRisk risk);
gboolean Suno_action_get_enabled(SunoAction *self);
void Suno_action_set_enabled(SunoAction *self, gboolean enabled);
gboolean Suno_action_get_requires_confirmation(SunoAction *self);
GVariant *Suno_action_to_variant(SunoAction *self);

G_END_DECLS
