/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-ui.h"

static void
test_opaque_fallback_without_wayland_protocol (void)
{
  g_autoptr(SunoSurfaceBackdrop) backdrop = NULL;
  g_autoptr(SunoSurfaceBackdrop) duplicate = NULL;
  GtkWidget *window = gtk_window_new ();

  backdrop = Suno_surface_backdrop_new (GTK_WINDOW (window));
  duplicate = Suno_surface_backdrop_new (GTK_WINDOW (window));
  g_assert_true (backdrop == duplicate);
  gtk_window_present (GTK_WINDOW (window));
  while (g_main_context_iteration (NULL, FALSE))
    ;

  g_assert_false (Suno_surface_backdrop_get_available (backdrop));
  g_assert_false (Suno_surface_backdrop_get_active (backdrop));
  g_assert_false (gtk_widget_has_css_class (window, "Suno-translucent"));
  /* The backdrop owns the blur region and nothing else. What colour a window
   * is painted is one decision for the whole display, made by libadwaita's
   * style manager for every toplevel; deciding it here, per window and from
   * whether this surface's own protocol handshake had landed, is what let two
   * windows on one desktop be two colours. */
  g_assert_false (gtk_widget_has_css_class (window, "Suno-treatment-light"));
  g_assert_false (gtk_widget_has_css_class (window, "Suno-treatment-glass"));

  gtk_window_destroy (GTK_WINDOW (window));
}

int
main (int argc, char **argv)
{
  gtk_test_init (&argc, &argv, NULL);
  g_test_add_func ("/appearance/backdrop/opaque-fallback",
                   test_opaque_fallback_without_wayland_protocol);
  return g_test_run ();
}
