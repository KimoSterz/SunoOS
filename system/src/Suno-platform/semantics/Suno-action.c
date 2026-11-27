/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-action.h"

struct _SunoAction {
  GObject parent_instance;
  char *id;
  char *label;
  char *description;
  char *parameter_type;
  SunoActionRisk risk;
  gboolean enabled;
};

G_DEFINE_FINAL_TYPE(SunoAction, Suno_action, G_TYPE_OBJECT)

enum {
  PROP_0,
  PROP_ID,
  PROP_LABEL,
  PROP_DESCRIPTION,
  PROP_PARAMETER_TYPE,
  PROP_RISK,
  PROP_ENABLED,
  N_PROPS
};
static GParamSpec *properties[N_PROPS];

static void Suno_action_finalize(GObject *object) {
  SunoAction *self = SUNO_ACTION(object);
  g_clear_pointer(&self->id, g_free);
  g_clear_pointer(&self->label, g_free);
  g_clear_pointer(&self->description, g_free);
  g_clear_pointer(&self->parameter_type, g_free);
  G_OBJECT_CLASS(Suno_action_parent_class)->finalize(object);
}

static void Suno_action_get_property(GObject *object, guint prop_id,
                                     GValue *value, GParamSpec *pspec) {
  SunoAction *self = SUNO_ACTION(object);
  switch (prop_id) {
  case PROP_ID:
    g_value_set_string(value, self->id);
    break;
  case PROP_LABEL:
    g_value_set_string(value, self->label);
    break;
  case PROP_DESCRIPTION:
    g_value_set_string(value, self->description);
    break;
  case PROP_PARAMETER_TYPE:
    g_value_set_string(value, self->parameter_type);
    break;
  case PROP_RISK:
    g_value_set_enum(value, self->risk);
    break;
  case PROP_ENABLED:
    g_value_set_boolean(value, self->enabled);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, prop_id, pspec);
  }
}

static void Suno_action_set_property(GObject *object, guint prop_id,
                                     const GValue *value, GParamSpec *pspec) {
  SunoAction *self = SUNO_ACTION(object);
  switch (prop_id) {
  case PROP_ID:
    self->id = g_value_dup_string(value);
    break;
  case PROP_LABEL:
    self->label = g_value_dup_string(value);
    break;
  case PROP_DESCRIPTION:
    Suno_action_set_description(self, g_value_get_string(value));
    break;
  case PROP_PARAMETER_TYPE:
    Suno_action_set_parameter_type(self, g_value_get_string(value));
    break;
  case PROP_RISK:
    Suno_action_set_risk(self, g_value_get_enum(value));
    break;
  case PROP_ENABLED:
    Suno_action_set_enabled(self, g_value_get_boolean(value));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, prop_id, pspec);
  }
}

static void Suno_action_class_init(SunoActionClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  object_class->finalize = Suno_action_finalize;
  object_class->get_property = Suno_action_get_property;
  object_class->set_property = Suno_action_set_property;
  properties[PROP_ID] = g_param_spec_string(
      "id", NULL, NULL, NULL,
      G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  properties[PROP_LABEL] = g_param_spec_string(
      "label", NULL, NULL, NULL,
      G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  properties[PROP_DESCRIPTION] =
      g_param_spec_string("description", NULL, NULL, NULL,
                          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);
  properties[PROP_PARAMETER_TYPE] =
      g_param_spec_string("parameter-type", NULL, NULL, NULL,
                          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);
  properties[PROP_RISK] = g_param_spec_enum(
      "risk", NULL, NULL, SUNO_TYPE_ACTION_RISK, SUNO_ACTION_RISK_LOW,
      G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);
  properties[PROP_ENABLED] = g_param_spec_boolean(
      "enabled", NULL, NULL, TRUE, G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);
  g_object_class_install_properties(object_class, N_PROPS, properties);
}

static void Suno_action_init(SunoAction *self) {
  self->enabled = TRUE;
  self->risk = SUNO_ACTION_RISK_LOW;
}

SunoAction *Suno_action_new(const char *id, const char *label) {
  g_return_val_if_fail(id && *id, NULL);
  g_return_val_if_fail(label && *label, NULL);
  return g_object_new(SUNO_TYPE_ACTION, "id", id, "label", label, NULL);
}

const char *Suno_action_get_id(SunoAction *self) {
  g_return_val_if_fail(SUNO_IS_ACTION(self), NULL);
  return self->id;
}
const char *Suno_action_get_label(SunoAction *self) {
  g_return_val_if_fail(SUNO_IS_ACTION(self), NULL);
  return self->label;
}
const char *Suno_action_get_description(SunoAction *self) {
  g_return_val_if_fail(SUNO_IS_ACTION(self), NULL);
  return self->description;
}
void Suno_action_set_description(SunoAction *self, const char *value) {
  g_return_if_fail(SUNO_IS_ACTION(self));
  g_set_str(&self->description, value);
  g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_DESCRIPTION]);
}
const char *Suno_action_get_parameter_type(SunoAction *self) {
  g_return_val_if_fail(SUNO_IS_ACTION(self), NULL);
  return self->parameter_type;
}
void Suno_action_set_parameter_type(SunoAction *self, const char *value) {
  g_return_if_fail(SUNO_IS_ACTION(self));
  g_set_str(&self->parameter_type, value);
  g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_PARAMETER_TYPE]);
}
SunoActionRisk Suno_action_get_risk(SunoAction *self) {
  g_return_val_if_fail(SUNO_IS_ACTION(self), SUNO_ACTION_RISK_LOW);
  return self->risk;
}
void Suno_action_set_risk(SunoAction *self, SunoActionRisk value) {
  g_return_if_fail(SUNO_IS_ACTION(self));
  if (self->risk == value)
    return;
  self->risk = value;
  g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_RISK]);
}
gboolean Suno_action_get_enabled(SunoAction *self) {
  g_return_val_if_fail(SUNO_IS_ACTION(self), FALSE);
  return self->enabled;
}
void Suno_action_set_enabled(SunoAction *self, gboolean value) {
  g_return_if_fail(SUNO_IS_ACTION(self));
  value = !!value;
  if (self->enabled == value)
    return;
  self->enabled = value;
  g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_ENABLED]);
}
gboolean Suno_action_get_requires_confirmation(SunoAction *self) {
  g_return_val_if_fail(SUNO_IS_ACTION(self), TRUE);
  return self->risk >= SUNO_ACTION_RISK_CONSEQUENTIAL;
}

GVariant *Suno_action_to_variant(SunoAction *self) {
  GVariantBuilder builder;
  g_return_val_if_fail(SUNO_IS_ACTION(self), NULL);
  g_variant_builder_init(&builder, G_VARIANT_TYPE_VARDICT);
  g_variant_builder_add(&builder, "{sv}", "id", g_variant_new_string(self->id));
  g_variant_builder_add(&builder, "{sv}", "label",
                        g_variant_new_string(self->label));
  g_variant_builder_add(&builder, "{sv}", "enabled",
                        g_variant_new_boolean(self->enabled));
  g_variant_builder_add(
      &builder, "{sv}", "risk",
      g_variant_new_string(Suno_action_risk_to_string(self->risk)));
  if (self->description)
    g_variant_builder_add(&builder, "{sv}", "description",
                          g_variant_new_string(self->description));
  if (self->parameter_type)
    g_variant_builder_add(&builder, "{sv}", "parameter_type",
                          g_variant_new_string(self->parameter_type));
  return g_variant_ref_sink(g_variant_builder_end(&builder));
}
