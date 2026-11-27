/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include "Suno-action.h"
#include "Suno-enums.h"
#include <gio/gio.h>

G_BEGIN_DECLS

#define SUNO_TYPE_SEMANTIC_OBJECT (Suno_semantic_object_get_type())
G_DECLARE_FINAL_TYPE(SunoSemanticObject, Suno_semantic_object, SUNO,
                     SEMANTIC_OBJECT, GObject)

SunoSemanticObject *Suno_semantic_object_new(const char *id, const char *kind,
                                             const char *name);
const char *Suno_semantic_object_get_id(SunoSemanticObject *self);
const char *Suno_semantic_object_get_kind(SunoSemanticObject *self);
const char *Suno_semantic_object_get_name(SunoSemanticObject *self);
void Suno_semantic_object_set_name(SunoSemanticObject *self, const char *name);
SunoPrivacy Suno_semantic_object_get_privacy(SunoSemanticObject *self);
void Suno_semantic_object_set_privacy(SunoSemanticObject *self,
                                      SunoPrivacy privacy);
/**
 * Suno_semantic_object_get_actions:
 * @self: a semantic object
 *
 * Returns: (transfer none): the object's actions
 */
GListModel *Suno_semantic_object_get_actions(SunoSemanticObject *self);
/**
 * Suno_semantic_object_get_children:
 * @self: a semantic object
 *
 * Returns: (transfer none): child objects
 */
GListModel *Suno_semantic_object_get_children(SunoSemanticObject *self);
void Suno_semantic_object_add_action(SunoSemanticObject *self,
                                     SunoAction *action);
void Suno_semantic_object_add_child(SunoSemanticObject *self,
                                    SunoSemanticObject *child);
GVariant *Suno_semantic_object_to_variant(SunoSemanticObject *self);

G_END_DECLS
