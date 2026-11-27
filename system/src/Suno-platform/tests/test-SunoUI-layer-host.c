/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-ui.h"

static gboolean stop(gpointer data) {
  *(gboolean *)data = TRUE;
  return G_SOURCE_REMOVE;
}

/* Run the main loop for a few frames (tick callbacks need the frame clock). */
static void spin(void) {
  gboolean done = FALSE;
  g_timeout_add(250, stop, &done);
  while (!done)
    g_main_context_iteration(NULL, TRUE);
}

static void test_tree(void) {
  GtkWidget *label = gtk_label_new("content");
  GtkWidget *host = Suno_layer_host_new(label);
  g_object_ref_sink(host);
  g_assert_true(GTK_IS_OVERLAY(host));
  g_assert_cmpstr(gtk_widget_get_css_name(host), ==, "overlay");
  g_assert_true(gtk_widget_has_css_class(host, "SunoUI-layer-host"));
  g_assert_true(Suno_layer_host_get_child(SUNO_LAYER_HOST(host)) == label);
  g_assert_true(G_TYPE_IS_FINAL(SUNO_TYPE_LAYER_HOST));
  g_object_unref(host);
}

static void cancelled(SunoModalHandle *handle G_GNUC_UNUSED, gpointer data) { (*(int *)data)++; }

static void test_modal(void) {
  GtkWidget *window = gtk_window_new();
  GtkWidget *button = gtk_button_new_with_label("behind");
  gtk_window_set_child(GTK_WINDOW(window), button);
  gtk_window_set_default_size(GTK_WINDOW(window), 1000, 700);
  gtk_window_present(GTK_WINDOW(window));
  spin();

  SunoLayerHost *host = Suno_layer_host_for_widget(button);
  g_assert_nonnull(host);
  g_assert_true(gtk_window_get_child(GTK_WINDOW(window)) == GTK_WIDGET(host));
  g_assert_true(Suno_layer_host_window_host(button) == host);
  g_assert_true(Suno_layer_host_install(GTK_WINDOW(window)) == host);

  GtkWidget *card = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  GtkWidget *ok = gtk_button_new_with_label("Delete");
  gtk_box_append(GTK_BOX(card), ok);
  SunoModalHandle *handle = Suno_layer_host_present_modal(host, card, NULL, SUNO_DRAWER_MODE_NEVER);
  g_assert_nonnull(handle);
  g_assert_true(Suno_layer_host_get_modal(host) == handle);
  g_assert_false(Suno_modal_handle_get_is_drawer(handle));
  g_assert_true(gtk_widget_has_css_class(card, "SunoUI-modal"));
  g_assert_false(gtk_widget_get_can_target(button));
  spin();
  g_assert_true(gtk_widget_has_css_class(card, "shown"));

  int count = 0;
  g_signal_connect(handle, "cancelled", G_CALLBACK(cancelled), &count);
  Suno_modal_handle_nudge(handle);
  Suno_modal_handle_cancel(handle);
  g_assert_cmpint(count, ==, 1);
  Suno_modal_handle_cancel(handle);
  g_assert_cmpint(count, ==, 1);
  g_assert_null(Suno_layer_host_get_modal(host));
  g_assert_true(gtk_widget_get_can_target(button));

  /* A drawer, always. */
  GtkWidget *sheet = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  handle = Suno_layer_host_present_modal(host, sheet, NULL, SUNO_DRAWER_MODE_ALWAYS);
  g_assert_true(Suno_modal_handle_get_is_drawer(handle));
  g_assert_true(gtk_widget_has_css_class(sheet, "drawer"));
  /* A second modal replaces the first, quietly. */
  GtkWidget *other = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  SunoModalHandle *second = Suno_layer_host_present_modal(host, other, NULL, SUNO_DRAWER_MODE_AUTO);
  g_assert_true(Suno_layer_host_get_modal(host) == second);
  g_assert_false(Suno_modal_handle_get_is_drawer(second));
  Suno_modal_handle_close(second);
  spin();

  GtkWidget *bar = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  g_object_ref_sink(bar);
  Suno_layer_host_track_bar(host, bar);
  Suno_layer_host_track_bar(host, bar);
  g_object_unref(bar);
  gtk_window_destroy(GTK_WINDOW(window));
  spin();
}

int main(int argc, char **argv) {
  gtk_test_init(&argc, &argv, NULL);
  g_test_add_func("/SunoUI/layer-host/tree", test_tree);
  g_test_add_func("/SunoUI/layer-host/modal", test_modal);
  return g_test_run();
}
