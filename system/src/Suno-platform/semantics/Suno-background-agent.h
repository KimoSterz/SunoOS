/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gio/gio.h>

G_BEGIN_DECLS

#define SUNO_BACKGROUND_AGENT_ERROR (Suno_background_agent_error_quark())
GQuark Suno_background_agent_error_quark(void);

/**
 * SunoBackgroundAgentError:
 * @SUNO_BACKGROUND_AGENT_ERROR_INVALID: an identifier or value was rejected
 * @SUNO_BACKGROUND_AGENT_ERROR_NOT_RUNNING: the agent is not on the bus
 * @SUNO_BACKGROUND_AGENT_ERROR_REFUSED: Suno-background refused the request
 */
typedef enum {
  SUNO_BACKGROUND_AGENT_ERROR_INVALID,
  SUNO_BACKGROUND_AGENT_ERROR_NOT_RUNNING,
  SUNO_BACKGROUND_AGENT_ERROR_REFUSED,
} SunoBackgroundAgentError;

#define SUNO_TYPE_BACKGROUND_AGENT (Suno_background_agent_get_type())
G_DECLARE_FINAL_TYPE(SunoBackgroundAgent, Suno_background_agent, SUNO,
                     BACKGROUND_AGENT, GObject)

SunoBackgroundAgent *Suno_background_agent_new(const char *app_id,
                                               const char *agent_id);
const char *Suno_background_agent_get_app_id(SunoBackgroundAgent *self);
const char *Suno_background_agent_get_agent_id(SunoBackgroundAgent *self);

gboolean Suno_background_agent_is_requested(int argc, char **argv);

gboolean Suno_background_agent_publish(SunoBackgroundAgent *self,
                                       const char *name, GVariant *value,
                                       GError **error);
void Suno_background_agent_unpublish(SunoBackgroundAgent *self,
                                     const char *name);
/**
 * Suno_background_agent_dup_values:
 * @self: an agent
 *
 * Returns: (transfer full): every published value, as `a{sv}`
 */
GVariant *Suno_background_agent_dup_values(SunoBackgroundAgent *self);

gboolean Suno_background_agent_schedule_at(SunoBackgroundAgent *self,
                                           const char *name, GDateTime *at,
                                           GError **error);
gboolean Suno_background_agent_schedule_every(SunoBackgroundAgent *self,
                                              const char *name,
                                              guint seconds, GError **error);
gboolean Suno_background_agent_unschedule(SunoBackgroundAgent *self,
                                          const char *name, GError **error);

gboolean Suno_background_agent_register(SunoBackgroundAgent *self,
                                        GDBusConnection *connection,
                                        GError **error);
void Suno_background_agent_quit(SunoBackgroundAgent *self, int status);
int Suno_background_agent_run(SunoBackgroundAgent *self, int argc,
                              char **argv);

G_END_DECLS
