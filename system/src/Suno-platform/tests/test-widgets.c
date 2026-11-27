/* SPDX-License-Identifier: Apache-2.0 */
#include <Suno-ui.h>

static void test_pane_holds_its_child(void) {
  /* The identity is the toolkit's now; the pane is the kit's, and it must
   * hold and hand back the one child an application gives it. */
  GtkWidget *pane = Suno_pane_new();
  GtkWidget *label = gtk_label_new("Library");
  Suno_pane_set_child(SUNO_PANE(pane), label);
  g_assert_true(Suno_pane_get_child(SUNO_PANE(pane)) == label);
  g_assert_true(gtk_widget_has_css_class(pane, "Suno-island") ||
                gtk_widget_has_css_class(pane, "Suno-pane"));
  g_object_ref_sink(pane);
  g_object_unref(pane);
}

static void test_inspector_section(void) {
  GtkWidget *section = Suno_inspector_section_new("Appearance");
  GtkWidget *label = gtk_label_new("Fill");
  Suno_inspector_section_set_child(SUNO_INSPECTOR_SECTION(section), label);
  g_assert_true(Suno_inspector_section_get_child(SUNO_INSPECTOR_SECTION(section)) == label);
  Suno_inspector_section_set_expanded(SUNO_INSPECTOR_SECTION(section), FALSE);
  g_assert_false(gtk_widget_get_visible(label));
  g_object_ref_sink(section);
  g_object_unref(section);
}

static void test_segmented_control(void) {
  GtkWidget *control = Suno_segmented_control_new();
  Suno_segmented_control_append(SUNO_SEGMENTED_CONTROL(control), "pages", "Pages");
  Suno_segmented_control_append(SUNO_SEGMENTED_CONTROL(control), "layers", "Layers");
  Suno_segmented_control_set_selected(SUNO_SEGMENTED_CONTROL(control), "layers");
  g_assert_cmpstr(Suno_segmented_control_get_selected(SUNO_SEGMENTED_CONTROL(control)), ==,
                  "layers");
  g_object_ref_sink(control);
  g_object_unref(control);
}

static void test_color_well(void) {
  GtkWidget *well = Suno_color_well_new();
  Suno_color_well_set_text(SUNO_COLOR_WELL(well), "#4878b8");
  const GdkRGBA *rgba = Suno_color_well_get_rgba(SUNO_COLOR_WELL(well));
  g_assert_cmpfloat_with_epsilon(rgba->red, 0.2823529, 0.001);
  g_assert_nonnull(Suno_color_well_get_text(SUNO_COLOR_WELL(well)));
  g_object_ref_sink(well);
  g_object_unref(well);
}

int main(int argc, char **argv) {
  gtk_init();
  g_test_init(&argc, &argv, NULL);
  g_test_add_func("/Suno/ui/pane", test_pane_holds_its_child);
  g_test_add_func("/Suno-ui/inspector-section", test_inspector_section);
  g_test_add_func("/Suno-ui/segmented-control", test_segmented_control);
  g_test_add_func("/Suno-ui/color-well", test_color_well);
  return g_test_run();
}
