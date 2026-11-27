/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-semantic-object.h"

struct _SunoSemanticObject {
  GObject parent_instance;
  char *id;
  char *kind;
  char *name;
  SunoPrivacy privacy;
  GListStore *actions;
  GListStore *children;
};

G_DEFINE_FINAL_TYPE(SunoSemanticObject, Suno_semantic_object, G_TYPE_OBJECT)
enum { PROP_0, PROP_ID, PROP_KIND, PROP_NAME, PROP_PRIVACY, N_PROPS };
static GParamSpec *properties[N_PROPS];

static void Suno_semantic_object_finalize(GObject *object) {
  SunoSemanticObject *self = SUNO_SEMANTIC_OBJECT(object);
  g_clear_pointer(&self->id, g_free);
  g_clear_pointer(&self->kind, g_free);
  g_clear_pointer(&self->name, g_free);
  g_clear_object(&self->actions);
  g_clear_object(&self->children);
  G_OBJECT_CLASS(Suno_semantic_object_parent_class)->finalize(object);
}
static void Suno_semantic_object_get_property(GObject *object, guint id,
                                              GValue *value,
                                              GParamSpec *pspec) {
  SunoSemanticObject *self = SUNO_SEMANTIC_OBJECT(object);
  switch (id) {
  case PROP_ID:
    g_value_set_string(value, self->id);
    break;
  case PROP_KIND:
    g_value_set_string(value, self->kind);
    break;
  case PROP_NAME:
    g_value_set_string(value, self->name);
    break;
  case PROP_PRIVACY:
    g_value_set_enum(value, self->privacy);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, id, pspec);
  }
}
static void Suno_semantic_object_set_property(GObject *object, guint id,
                                              const GValue *value,
                                              GParamSpec *pspec) {
  SunoSemanticObject *self = SUNO_SEMANTIC_OBJECT(object);
  switch (id) {
  case PROP_ID:
    self->id = g_value_dup_string(value);
    break;
  case PROP_KIND:
    self->kind = g_value_dup_string(value);
    break;
  case PROP_NAME:
    Suno_semantic_object_set_name(self, g_value_get_string(value));
    break;
  case PROP_PRIVACY:
    Suno_semantic_object_set_privacy(self, g_value_get_enum(value));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, id, pspec);
  }
}
static void Suno_semantic_object_class_init(SunoSemanticObjectClass *klass) {
  GObjectClass *oc = G_OBJECT_CLASS(klass);
  oc->finalize = Suno_semantic_object_finalize;
  oc->get_property = Suno_semantic_object_get_property;
  oc->set_property = Suno_semantic_object_set_property;
  properties[PROP_ID] = g_param_spec_string(
      "id", NULL, NULL, NULL,
      G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  properties[PROP_KIND] = g_param_spec_string(
      "kind", NULL, NULL, NULL,
      G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  properties[PROP_NAME] = g_param_spec_string(
      "name", NULL, NULL, NULL, G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);
  properties[PROP_PRIVACY] = g_param_spec_enum(
      "privacy", NULL, NULL, SUNO_TYPE_PRIVACY, SUNO_PRIVACY_PRIVATE,
      G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);
  g_object_class_install_properties(oc, N_PROPS, properties);
}
static void Suno_semantic_object_init(SunoSemanticObject *self) {
  self->privacy = SUNO_PRIVACY_PRIVATE;
  self->actions = g_list_store_new(SUNO_TYPE_ACTION);
  self->children = g_list_store_new(SUNO_TYPE_SEMANTIC_OBJECT);
}
SunoSemanticObject *Suno_semantic_object_new(const char *id, const char *kind,
                                             const char *name) {
  g_return_val_if_fail(id && *id, NULL);
  g_return_val_if_fail(kind && *kind, NULL);
  g_return_val_if_fail(name && *name, NULL);
  return g_object_new(SUNO_TYPE_SEMANTIC_OBJECT, "id", id, "kind", kind, "name",
                      name, NULL);
}
const char *Suno_semantic_object_get_id(SunoSemanticObject *self) {
  g_return_val_if_fail(SUNO_IS_SEMANTIC_OBJECT(self), NULL);
  return self->id;
}
const char *Suno_semantic_object_get_kind(SunoSemanticObject *self) {
  g_return_val_if_fail(SUNO_IS_SEMANTIC_OBJECT(self), NULL);
  return self->kind;
}
const char *Suno_semantic_object_get_name(SunoSemanticObject *self) {
  g_return_val_if_fail(SUNO_IS_SEMANTIC_OBJECT(self), NULL);
  return self->name;
}
void Suno_semantic_object_set_name(SunoSemanticObject *self,
                                   const char *value) {
  g_return_if_fail(SUNO_IS_SEMANTIC_OBJECT(self));
  g_return_if_fail(value && *value);
  g_set_str(&self->name, value);
  g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_NAME]);
}
SunoPrivacy Suno_semantic_object_get_privacy(SunoSemanticObject *self) {
  g_return_val_if_fail(SUNO_IS_SEMANTIC_OBJECT(self), SUNO_PRIVACY_SECRET);
  return self->privacy;
}
void Suno_semantic_object_set_privacy(SunoSemanticObject *self,
                                      SunoPrivacy value) {
  g_return_if_fail(SUNO_IS_SEMANTIC_OBJECT(self));
  if (self->privacy == value)
    return;
  self->privacy = value;
  g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_PRIVACY]);
}
GListModel *Suno_semantic_object_get_actions(SunoSemanticObject *self) {
  g_return_val_if_fail(SUNO_IS_SEMANTIC_OBJECT(self), NULL);
  return G_LIST_MODEL(self->actions);
}
GListModel *Suno_semantic_object_get_children(SunoSemanticObject *self) {
  g_return_val_if_fail(SUNO_IS_SEMANTIC_OBJECT(self), NULL);
  return G_LIST_MODEL(self->children);
}
void Suno_semantic_object_add_action(SunoSemanticObject *self,
                                     SunoAction *action) {
  g_return_if_fail(SUNO_IS_SEMANTIC_OBJECT(self));
  g_return_if_fail(SUNO_IS_ACTION(action));
  g_list_store_append(self->actions, action);
}
void Suno_semantic_object_add_child(SunoSemanticObject *self,
                                    SunoSemanticObject *child) {
  g_return_if_fail(SUNO_IS_SEMANTIC_OBJECT(self));
  g_return_if_fail(SUNO_IS_SEMANTIC_OBJECT(child));
  g_return_if_fail(self != child);
  g_list_store_append(self->children, child);
}
GVariant *Suno_semantic_object_to_variant(SunoSemanticObject *self) {
  GVariantBuilder b;
  GVariantBuilder actions;
  GVariantBuilder children;
  g_return_val_if_fail(SUNO_IS_SEMANTIC_OBJECT(self), NULL);
  g_variant_builder_init(&b, G_VARIANT_TYPE_VARDICT);
  g_variant_builder_add(&b, "{sv}", "schema_version",
                        g_variant_new_string("0.1"));
  g_variant_builder_add(&b, "{sv}", "id", g_variant_new_string(self->id));
  g_variant_builder_add(&b, "{sv}", "kind", g_variant_new_string(self->kind));
  g_variant_builder_add(&b, "{sv}", "name", g_variant_new_string(self->name));
  g_variant_builder_add(
      &b, "{sv}", "privacy",
      g_variant_new_string(Suno_privacy_to_string(self->privacy)));
  g_variant_builder_init(&actions, G_VARIANT_TYPE("aa{sv}"));
  for (guint i = 0; i < g_list_model_get_n_items(G_LIST_MODEL(self->actions));
       i++) {
    g_autoptr(SunoAction) action =
        g_list_model_get_item(G_LIST_MODEL(self->actions), i);
    g_autoptr(GVariant) serialized = Suno_action_to_variant(action);
    g_variant_builder_add_value(&actions, serialized);
  }
  g_variant_builder_add(&b, "{sv}", "actions", g_variant_builder_end(&actions));
  g_variant_builder_init(&children, G_VARIANT_TYPE("aa{sv}"));
  for (guint i = 0; i < g_list_model_get_n_items(G_LIST_MODEL(self->children));
       i++) {
    g_autoptr(SunoSemanticObject) child =
        g_list_model_get_item(G_LIST_MODEL(self->children), i);
    g_autoptr(GVariant) serialized = Suno_semantic_object_to_variant(child);
    g_variant_builder_add_value(&children, serialized);
  }
  g_variant_builder_add(&b, "{sv}", "children",
                        g_variant_builder_end(&children));
  return g_variant_ref_sink(g_variant_builder_end(&b));
}
