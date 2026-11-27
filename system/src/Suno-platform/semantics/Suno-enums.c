/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-enums.h"

G_DEFINE_ENUM_TYPE(SunoActionRisk, Suno_action_risk,
                   G_DEFINE_ENUM_VALUE(SUNO_ACTION_RISK_PASSIVE, "passive"),
                   G_DEFINE_ENUM_VALUE(SUNO_ACTION_RISK_LOW, "low"),
                   G_DEFINE_ENUM_VALUE(SUNO_ACTION_RISK_CONSEQUENTIAL,
                                       "consequential"),
                   G_DEFINE_ENUM_VALUE(SUNO_ACTION_RISK_DESTRUCTIVE,
                                       "destructive"),
                   G_DEFINE_ENUM_VALUE(SUNO_ACTION_RISK_SECURITY_SENSITIVE,
                                       "security-sensitive"))

G_DEFINE_ENUM_TYPE(SunoPrivacy, Suno_privacy,
                   G_DEFINE_ENUM_VALUE(SUNO_PRIVACY_PUBLIC, "public"),
                   G_DEFINE_ENUM_VALUE(SUNO_PRIVACY_PRIVATE, "private"),
                   G_DEFINE_ENUM_VALUE(SUNO_PRIVACY_SENSITIVE, "sensitive"),
                   G_DEFINE_ENUM_VALUE(SUNO_PRIVACY_SECRET, "secret"))

G_DEFINE_ENUM_TYPE(
    SunoLiveCategory, Suno_live_category,
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_CALL, "call"),
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_MEDIA, "media"),
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_TIMER, "timer"),
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_NAVIGATION, "navigation"),
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_EVENT, "event"),
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_TRANSFER, "transfer"),
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_RECORDING, "recording"),
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_INSTALLATION, "installation"),
    G_DEFINE_ENUM_VALUE(SUNO_LIVE_CATEGORY_GENERIC, "generic"))

const char *Suno_action_risk_to_string(SunoActionRisk value) {
  switch (value) {
  case SUNO_ACTION_RISK_PASSIVE:
    return "passive";
  case SUNO_ACTION_RISK_LOW:
    return "low";
  case SUNO_ACTION_RISK_CONSEQUENTIAL:
    return "consequential";
  case SUNO_ACTION_RISK_DESTRUCTIVE:
    return "destructive";
  case SUNO_ACTION_RISK_SECURITY_SENSITIVE:
    return "security-sensitive";
  default:
    return "low";
  }
}

const char *Suno_privacy_to_string(SunoPrivacy value) {
  switch (value) {
  case SUNO_PRIVACY_PUBLIC:
    return "public";
  case SUNO_PRIVACY_PRIVATE:
    return "private";
  case SUNO_PRIVACY_SENSITIVE:
    return "sensitive";
  case SUNO_PRIVACY_SECRET:
    return "secret";
  default:
    return "secret";
  }
}

const char *Suno_live_category_to_string(SunoLiveCategory value) {
  switch (value) {
  case SUNO_LIVE_CATEGORY_CALL:
    return "call";
  case SUNO_LIVE_CATEGORY_MEDIA:
    return "media";
  case SUNO_LIVE_CATEGORY_TIMER:
    return "timer";
  case SUNO_LIVE_CATEGORY_NAVIGATION:
    return "navigation";
  case SUNO_LIVE_CATEGORY_EVENT:
    return "event";
  case SUNO_LIVE_CATEGORY_TRANSFER:
    return "transfer";
  case SUNO_LIVE_CATEGORY_RECORDING:
    return "recording";
  case SUNO_LIVE_CATEGORY_INSTALLATION:
    return "installation";
  case SUNO_LIVE_CATEGORY_GENERIC:
    return "generic";
  default:
    return "generic";
  }
}
