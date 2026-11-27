/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-ui.h"
#include <glib.h>

static void test_explicit_context(void) {
  g_autoptr(SunoContext) context =
      Suno_context_new(SUNO_PRESENTATION_FULLSCREEN_MOBILE, SUNO_INPUT_TOUCH);
  g_assert_false(Suno_context_get_decorated(context));
  g_assert_true(Suno_context_get_touch_targets(context));
}

static void test_environment_axes_are_independent(void) {
  g_setenv("SUNO_DEVICE_CLASS", "handheld", TRUE);
  g_setenv("SUNO_PRESENTATION_MODE", "windowed", TRUE);
  g_setenv("SUNO_INPUT_MODE", "pointer", TRUE);
  g_autoptr(SunoContext) context = Suno_context_new_from_environment();
  g_assert_true(Suno_context_get_decorated(context));
  g_assert_false(Suno_context_get_touch_targets(context));
  g_unsetenv("SUNO_DEVICE_CLASS");
  g_unsetenv("SUNO_PRESENTATION_MODE");
  g_unsetenv("SUNO_INPUT_MODE");
}

int main(int argc, char **argv) {
  g_test_init(&argc, &argv, NULL);
  g_test_add_func("/Suno/context/explicit", test_explicit_context);
  g_test_add_func("/Suno/context/environment",
                  test_environment_axes_are_independent);
  return g_test_run();
}
