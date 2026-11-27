/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <glib-object.h>

G_BEGIN_DECLS

typedef enum {
  SUNO_ACTION_RISK_PASSIVE,
  SUNO_ACTION_RISK_LOW,
  SUNO_ACTION_RISK_CONSEQUENTIAL,
  SUNO_ACTION_RISK_DESTRUCTIVE,
  SUNO_ACTION_RISK_SECURITY_SENSITIVE,
} SunoActionRisk;

typedef enum {
  SUNO_PRIVACY_PUBLIC,
  SUNO_PRIVACY_PRIVATE,
  SUNO_PRIVACY_SENSITIVE,
  SUNO_PRIVACY_SECRET,
} SunoPrivacy;

typedef enum {
  SUNO_LIVE_CATEGORY_CALL,
  SUNO_LIVE_CATEGORY_MEDIA,
  SUNO_LIVE_CATEGORY_TIMER,
  SUNO_LIVE_CATEGORY_NAVIGATION,
  SUNO_LIVE_CATEGORY_EVENT,
  SUNO_LIVE_CATEGORY_TRANSFER,
  SUNO_LIVE_CATEGORY_RECORDING,
  SUNO_LIVE_CATEGORY_INSTALLATION,
  SUNO_LIVE_CATEGORY_GENERIC,
} SunoLiveCategory;

#define SUNO_TYPE_ACTION_RISK (Suno_action_risk_get_type())
#define SUNO_TYPE_PRIVACY (Suno_privacy_get_type())
#define SUNO_TYPE_LIVE_CATEGORY (Suno_live_category_get_type())

GType Suno_action_risk_get_type(void) G_GNUC_CONST;
GType Suno_privacy_get_type(void) G_GNUC_CONST;
GType Suno_live_category_get_type(void) G_GNUC_CONST;
const char *Suno_action_risk_to_string(SunoActionRisk value);
const char *Suno_privacy_to_string(SunoPrivacy value);
const char *Suno_live_category_to_string(SunoLiveCategory value);

G_END_DECLS
