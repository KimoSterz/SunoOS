/* SPDX-License-Identifier: Apache-2.0 */
/* SunoSidebarToggle: the twin of structure_sidebar.SidebarToggle. */
#include "Suno-ui.h"
#include "Suno-sidebar-toggle.h"
#include "Suno-layer-host.h"
#include <adwaita.h>

static gboolean stop(gpointer data) {
  *(gboolean *)data = TRUE;
  return G_SOURCE_REMOVE;
}

static void settle(void) {
  gboolean done = FALSE;
  g_timeout_add(300, stop, &done);
  while (!done)
    g_main_context_iteration(NULL, TRUE);
}

static void notified(GObject *object G_GNUC_UNUSED, GParamSpec *pspec G_GNUC_UNUSED, gpointer data) {
  (*(int *)data)++;
}

static void test_desktop(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 1000, 700);
  GtkWidget *box = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  GtkWidget *sidebar = gtk_label_new("sidebar");
  gtk_box_append(GTK_BOX(box), sidebar);
  gtk_box_append(GTK_BOX(box), gtk_label_new("content"));
  GtkWidget *toggle = Suno_sidebar_toggle_new(sidebar, TRUE);
  GtkWidget *revealer = gtk_widget_get_parent(sidebar);
  g_assert_true(GTK_IS_REVEALER(revealer));
  g_assert_true(gtk_widget_get_parent(revealer) == box);
  g_assert_true(gtk_widget_get_first_child(box) == revealer);
  g_assert_true(gtk_widget_has_css_class(revealer, "SunoUI-sidebar-revealer"));
  g_assert_true(gtk_widget_has_css_class(toggle, "SunoUI-sidebar-toggle"));
  g_assert_false(gtk_widget_has_css_class(toggle, "image-button"));
  g_assert_cmpstr(gtk_widget_get_tooltip_text(toggle), ==, "Hide sidebar (F9)");
  GtkWidget *outer = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_box_append(GTK_BOX(outer), toggle);
  gtk_box_append(GTK_BOX(outer), box);
  gtk_window_set_child(GTK_WINDOW(window), outer);
  gtk_window_present(GTK_WINDOW(window));
  settle();
  int notifies = 0;
  g_signal_connect(toggle, "notify::shown", G_CALLBACK(notified), &notifies);
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(toggle));
  g_assert_false(Suno_sidebar_toggle_get_shown(SUNO_SIDEBAR_TOGGLE(toggle)));
  g_assert_false(gtk_revealer_get_reveal_child(GTK_REVEALER(revealer)));
  g_assert_cmpstr(gtk_widget_get_tooltip_text(toggle), ==, "Show sidebar (F9)");
  g_assert_cmpint(notifies, ==, 1);
  Suno_sidebar_toggle_set_shown(SUNO_SIDEBAR_TOGGLE(toggle), TRUE);
  g_assert_true(gtk_revealer_get_reveal_child(GTK_REVEALER(revealer)));
  g_assert_cmpint(notifies, ==, 2);
  Suno_sidebar_toggle_set_shown(SUNO_SIDEBAR_TOGGLE(toggle), TRUE);
  g_assert_cmpint(notifies, ==, 2);
  /* The button itself. */
  g_signal_emit_by_name(toggle, "clicked");
  g_assert_false(Suno_sidebar_toggle_get_shown(SUNO_SIDEBAR_TOGGLE(toggle)));
  g_assert_cmpint(notifies, ==, 3);
  /* Menu-only controls stay absent across title-island and size changes,
   * while the original sidebar action remains functional. */
  Suno_sidebar_toggle_set_control_visible(SUNO_SIDEBAR_TOGGLE(toggle), FALSE);
  g_assert_false(gtk_widget_get_visible(toggle));
  GtkWidget *title = g_object_ref_sink(Suno_title_island_new(SUNO_TITLE_ISLAND_LEAD_MENU, "Home", NULL));
  Suno_sidebar_toggle_set_island(SUNO_SIDEBAR_TOGGLE(toggle), SUNO_TITLE_ISLAND(title));
  gtk_window_set_default_size(GTK_WINDOW(window), 500, 700);
  settle();
  gtk_window_set_default_size(GTK_WINDOW(window), 1000, 700);
  settle();
  Suno_sidebar_toggle_set_island(SUNO_SIDEBAR_TOGGLE(toggle), NULL);
  g_assert_false(gtk_widget_get_visible(toggle));
  g_object_unref(title);
  Suno_sidebar_toggle_set_control_visible(SUNO_SIDEBAR_TOGGLE(toggle), TRUE);
  g_assert_true(gtk_widget_get_visible(toggle));
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_split(void) {
  GtkWidget *split = adw_overlay_split_view_new();
  g_object_ref_sink(split);
  GtkWidget *toggle = g_object_ref_sink(Suno_sidebar_toggle_new(split, FALSE));
  g_assert_false(adw_overlay_split_view_get_show_sidebar(ADW_OVERLAY_SPLIT_VIEW(split)));
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(toggle));
  g_assert_true(adw_overlay_split_view_get_show_sidebar(ADW_OVERLAY_SPLIT_VIEW(split)));
  g_object_unref(toggle);
  g_object_unref(split);
}

static void test_phone(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 400, 700);
  GtkWidget *box = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  GtkWidget *sidebar = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_add_css_class(sidebar, "Suno-island");
  GtkWidget *list = gtk_list_box_new();
  gtk_list_box_append(GTK_LIST_BOX(list), gtk_label_new("Inbox"));
  gtk_box_append(GTK_BOX(sidebar), list);
  gtk_box_append(GTK_BOX(box), sidebar);
  gtk_box_append(GTK_BOX(box), gtk_label_new("content"));
  GtkWidget *toggle = Suno_sidebar_toggle_new(sidebar, TRUE);
  GtkWidget *revealer = gtk_widget_get_parent(sidebar);
  GtkWidget *outer = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_box_append(GTK_BOX(outer), toggle);
  gtk_box_append(GTK_BOX(outer), box);
  gtk_window_set_child(GTK_WINDOW(window), outer);
  gtk_window_present(GTK_WINDOW(window));
  settle();
  /* The column gives the content the room. */
  g_assert_false(gtk_revealer_get_reveal_child(GTK_REVEALER(revealer)));
  int notifies = 0;
  g_signal_connect(toggle, "notify::shown", G_CALLBACK(notified), &notifies);
  g_signal_emit_by_name(toggle, "clicked");
  g_assert_true(Suno_sidebar_toggle_get_shown(SUNO_SIDEBAR_TOGGLE(toggle)));
  GtkWidget *card = gtk_widget_get_parent(sidebar);
  g_assert_true(gtk_widget_has_css_class(card, "SunoUI-sidebar-drawer"));
  g_assert_true(gtk_widget_has_css_class(card, "side-drawer"));
  g_assert_false(gtk_widget_has_css_class(sidebar, "Suno-island"));
  SunoLayerHost *host = Suno_layer_host_window_host(toggle);
  g_assert_nonnull(Suno_layer_host_get_modal(host));
  /* Choosing a row closes it; the sidebar goes home. */
  g_signal_emit_by_name(list, "row-activated", gtk_list_box_get_row_at_index(GTK_LIST_BOX(list), 0));
  g_assert_false(Suno_sidebar_toggle_get_shown(SUNO_SIDEBAR_TOGGLE(toggle)) &&
                 Suno_layer_host_get_modal(host) != NULL);
  settle();
  g_assert_true(gtk_widget_get_parent(sidebar) == revealer);
  g_assert_true(gtk_widget_has_css_class(sidebar, "Suno-island"));
  /* F9's toggle opens it again; widening closes the drawer and brings the column back. */
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(toggle));
  g_assert_true(gtk_widget_get_parent(sidebar) != revealer);
  gtk_window_set_default_size(GTK_WINDOW(window), 1000, 700);
  settle();
  g_assert_true(gtk_widget_get_parent(sidebar) == revealer);
  g_assert_true(gtk_revealer_get_reveal_child(GTK_REVEALER(revealer)));
  gtk_window_destroy(GTK_WINDOW(window));
}

/* v71: the phone drawer out of the bottom-left corner, and the title island as the phone's ☰. */
static void test_phone_drawer(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 400, 800);
  GtkWidget *body = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  GtkWidget *sidebar = gtk_list_box_new();
  gtk_list_box_append(GTK_LIST_BOX(sidebar), gtk_label_new("Home"));
  gtk_box_append(GTK_BOX(body), sidebar);
  gtk_box_append(GTK_BOX(body), gtk_label_new("content"));
  GtkWidget *toggle = Suno_sidebar_toggle_new(sidebar, TRUE);
  GtkWidget *column = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_box_append(GTK_BOX(column), toggle);
  gtk_box_append(GTK_BOX(column), body);
  gtk_window_set_child(GTK_WINDOW(window), column);
  Suno_layer_host_install(GTK_WINDOW(window));
  gtk_window_present(GTK_WINDOW(window));
  settle();
  if (gtk_widget_get_width(window) >= SUNO_TIER_PHONE_BELOW) {
    g_test_skip("the display did not give a phone-width window");
    gtk_window_destroy(GTK_WINDOW(window));
    return;
  }
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(toggle));
  settle();
  GtkWidget *card = gtk_widget_get_parent(sidebar);
  g_assert_true(gtk_widget_has_css_class(card, "phone-drawer"));
  /* 64 from the window's top: the host may already start lower (under the title row). */
  graphene_point_t at;
  g_assert_true(gtk_widget_compute_point(gtk_widget_get_parent(card), window, &GRAPHENE_POINT_INIT(0, 0), &at));
  g_assert_cmpint(gtk_widget_get_margin_top(card), ==, MAX(0, 64 - (int)at.y));
  g_assert_cmpint(gtk_widget_get_margin_start(card), ==, 0);
  g_assert_cmpint(gtk_widget_get_margin_bottom(card), ==, 0);
  int width = 0;
  gtk_widget_get_size_request(card, &width, NULL);
  g_assert_cmpint(width, ==, MIN(328, gtk_widget_get_width(window) - 52));
  g_assert_true(gtk_widget_has_css_class(gtk_widget_get_prev_sibling(card), "phone-drawer"));
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(toggle));
  settle();
  /* With a title island, ☰ is the island's: the toggle steps aside, the island grows into the sidebar. */
  GtkWidget *island = Suno_title_island_new(SUNO_TITLE_ISLAND_LEAD_MENU, "Home", "6 items");
  Suno_title_island_float_over(SUNO_TITLE_ISLAND(island), body);
  Suno_sidebar_toggle_set_island(SUNO_SIDEBAR_TOGGLE(toggle), SUNO_TITLE_ISLAND(island));
  settle();
  g_assert_false(gtk_widget_get_visible(toggle));
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(toggle));
  g_assert_true(Suno_title_island_get_grown(SUNO_TITLE_ISLAND(island)));
  g_assert_true(gtk_widget_is_ancestor(sidebar, island));
  Suno_title_island_fold(SUNO_TITLE_ISLAND(island));
  settle();
  g_assert_true(gtk_widget_is_ancestor(sidebar, body));
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_phone_disabled(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 680, 700);
  GtkWidget *body = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  GtkWidget *sidebar = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_box_append(GTK_BOX(sidebar), gtk_label_new("Places"));
  gtk_box_append(GTK_BOX(body), sidebar);
  GtkWidget *toggle = Suno_sidebar_toggle_new(sidebar, TRUE);
  Suno_sidebar_toggle_set_drawer_below(SUNO_SIDEBAR_TOGGLE(toggle), 701);
  Suno_sidebar_toggle_set_phone_enabled(SUNO_SIDEBAR_TOGGLE(toggle), FALSE);
  gtk_box_append(GTK_BOX(body), toggle);
  gtk_window_set_child(GTK_WINDOW(window), body);
  gtk_window_present(GTK_WINDOW(window)); settle();
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(toggle)); settle();
  g_assert_true(Suno_sidebar_toggle_get_shown(SUNO_SIDEBAR_TOGGLE(toggle)));
  gtk_window_set_default_size(GTK_WINDOW(window), 402, 700); settle();
  g_assert_false(gtk_widget_get_mapped(sidebar));
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(toggle)); settle();
  g_assert_false(Suno_sidebar_toggle_get_shown(SUNO_SIDEBAR_TOGGLE(toggle)));
  g_assert_false(gtk_widget_get_mapped(sidebar));
  gtk_window_set_default_size(GTK_WINDOW(window), 1180, 700); settle();
  g_assert_true(gtk_widget_get_mapped(sidebar));
  gtk_window_destroy(GTK_WINDOW(window));
}

int main(int argc, char **argv) {
  gtk_init();
  adw_init();
  Suno_init();
  g_test_init(&argc, &argv, NULL);
  g_test_add_func("/SunoUI/sidebar-toggle/desktop", test_desktop);
  g_test_add_func("/SunoUI/sidebar-toggle/phone-disabled", test_phone_disabled);
  g_test_add_func("/SunoUI/sidebar-toggle/split", test_split);
  g_test_add_func("/SunoUI/sidebar-toggle/phone", test_phone);
  g_test_add_func("/SunoUI/sidebar-toggle/phone-drawer", test_phone_drawer);
  return g_test_run();
}
