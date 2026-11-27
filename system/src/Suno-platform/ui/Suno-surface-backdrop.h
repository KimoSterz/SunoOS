/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

#define SUNO_TYPE_SURFACE_BACKDROP (Suno_surface_backdrop_get_type())
G_DECLARE_FINAL_TYPE(SunoSurfaceBackdrop, Suno_surface_backdrop, SUNO,
                     SURFACE_BACKDROP, GObject)

/**
 * Suno_surface_backdrop_new:
 * @window: the native Suno application window
 *
 * Negotiates the standardized ext-background-effect-v1 protocol for @window.
 * The object follows the shared surface policy and removes the effect whenever
 * accessibility policy or renderer capability requires an opaque fallback.
 *
 * Returns: (transfer full): the live window backdrop binding
 */
SunoSurfaceBackdrop *Suno_surface_backdrop_new(GtkWindow *window);

/**
 * Suno_surface_backdrop_get_available:
 * @self: the backdrop binding
 *
 * Returns: whether the compositor currently advertises hardware blur
 */
gboolean Suno_surface_backdrop_get_available(SunoSurfaceBackdrop *self);

/**
 * Suno_surface_backdrop_get_active:
 * @self: the backdrop binding
 *
 * Returns: whether the window currently has a live compositor blur region
 */
gboolean Suno_surface_backdrop_get_active(SunoSurfaceBackdrop *self);

/**
 * Suno_surface_backdrop_display_is_available:
 * @display: a GTK display
 *
 * Performs the same one-time native protocol discovery used by AppKit windows.
 * This is intended for Settings: it reports compositor capability without
 * creating a probe window or a parallel state service.
 *
 * Returns: whether @display advertises hardware-backed background blur
 */
gboolean Suno_surface_backdrop_display_is_available(GdkDisplay *display);

G_END_DECLS
