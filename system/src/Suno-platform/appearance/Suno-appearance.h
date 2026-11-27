/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <gio/gio.h>

G_BEGIN_DECLS
#define SUNO_TYPE_SURFACE_POLICY (Suno_surface_policy_get_type())
G_DECLARE_FINAL_TYPE(SunoSurfacePolicy, Suno_surface_policy, SUNO, SURFACE_POLICY, GObject)

/**
 * SunoSurfaceTarget:
 * @SUNO_SURFACE_TARGET_SHELL: A compositor-owned shell actor.
 * @SUNO_SURFACE_TARGET_APPLICATION: A native application window.
 */
typedef enum {
  SUNO_SURFACE_TARGET_SHELL,
  SUNO_SURFACE_TARGET_APPLICATION,
} SunoSurfaceTarget;
#define SUNO_TYPE_SURFACE_TARGET (Suno_surface_target_get_type())
GType Suno_surface_target_get_type(void) G_GNUC_CONST;

SunoSurfacePolicy *Suno_surface_policy_new(SunoSurfaceTarget target);
/**
 * Suno_surface_policy_new_for_settings:
 * @target: Surface owner.
 * @settings: (nullable): Suno shell-state schema, or NULL for opaque defaults.
 * @interface_settings: (nullable): GNOME desktop interface schema.
 * @a11y_settings: (nullable): GNOME accessibility interface schema.
 *
 * Returns: (transfer full): A signal-driven policy; no resident helper or polling.
 */
SunoSurfacePolicy *Suno_surface_policy_new_for_settings(
    SunoSurfaceTarget target, GSettings *settings, GSettings *interface_settings,
    GSettings *a11y_settings);
/**
 * Suno_surface_policy_set_capabilities:
 * @self: The policy.
 * @hardware: Renderer has reported hardware acceleration.
 * @shell_blur: Shell owns a working backdrop renderer including saturation.
 * @application_blur: Client has negotiated a live compositor backdrop interface.
 *
 * Unknown capability is false. A stored user preference is never proof of
 * renderer support. Application capability must remain false until a real
 * per-window protocol adapter owns its blur region and capture path.
 */
void Suno_surface_policy_set_capabilities(SunoSurfacePolicy *self,
    gboolean hardware, gboolean shell_blur, gboolean application_blur);
const char *Suno_surface_policy_get_requested(SunoSurfacePolicy *self);
const char *Suno_surface_policy_get_effective(SunoSurfacePolicy *self);
/**
 * Suno_surface_policy_get_surface:
 * @self: The policy.
 *
 * The treatment a surface is painted in. It differs from the effective
 * treatment in what it refuses for: only the accessibility answers, high
 * contrast and reduced transparency. A renderer that cannot blur is a reason
 * not to ask for a blur region, not a reason for one application to be a
 * different colour from the window beside it.
 *
 * Returns: One of light, dark, frost or glass.
 */
const char *Suno_surface_policy_get_surface(SunoSurfacePolicy *self);
const char *Suno_surface_policy_get_reason(SunoSurfacePolicy *self);
gboolean Suno_surface_policy_get_has_selection(SunoSurfacePolicy *self);
gboolean Suno_surface_policy_get_locked(SunoSurfacePolicy *self);
gboolean Suno_surface_policy_get_translucency_available(SunoSurfacePolicy *self);
gboolean Suno_surface_policy_select(SunoSurfacePolicy *self, const char *treatment,
                                    GError **error);
/**
 * Suno_surface_policy_get_recipe:
 * @self: The policy.
 *
 * Returns: (transfer full): The effective surface's typed token dictionary.
 */
GVariant *Suno_surface_policy_get_recipe(SunoSurfacePolicy *self);
G_END_DECLS
