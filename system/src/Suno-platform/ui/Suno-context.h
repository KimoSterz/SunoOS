/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <glib-object.h>

G_BEGIN_DECLS

typedef enum {
  SUNO_PRESENTATION_WINDOWED,
  SUNO_PRESENTATION_FULLSCREEN_MOBILE,
} SunoPresentationMode;

typedef enum {
  SUNO_INPUT_POINTER,
  SUNO_INPUT_TOUCH,
} SunoInputMode;

#define SUNO_TYPE_PRESENTATION_MODE (Suno_presentation_mode_get_type())
#define SUNO_TYPE_INPUT_MODE (Suno_input_mode_get_type())
GType Suno_presentation_mode_get_type(void) G_GNUC_CONST;
GType Suno_input_mode_get_type(void) G_GNUC_CONST;

#define SUNO_TYPE_CONTEXT (Suno_context_get_type())
G_DECLARE_FINAL_TYPE(SunoContext, Suno_context, SUNO, CONTEXT, GObject)

SunoContext *Suno_context_new(SunoPresentationMode presentation,
                              SunoInputMode input);
SunoContext *Suno_context_new_from_environment(void);
SunoPresentationMode Suno_context_get_presentation(SunoContext *self);
SunoInputMode Suno_context_get_input(SunoContext *self);
gboolean Suno_context_get_decorated(SunoContext *self);
gboolean Suno_context_get_touch_targets(SunoContext *self);
const char *Suno_context_get_experience(SunoContext *self);
/**
 * Suno_context_get_tv:
 * @self: a context
 *
 * Whether the shell is in TV posture (the `tv` property, live from the
 * shell-state `Posture`; `SUNO_POSTURE=tv` forces it). Since API level 5.
 */
gboolean Suno_context_get_tv(SunoContext *self);

G_END_DECLS
