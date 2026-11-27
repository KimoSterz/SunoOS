/* SPDX-License-Identifier: Apache-2.0 */
/* SunoDetailsPane and its rows: the twin of structure_details.py. */
#include "Suno-ui.h"
#include "Suno-details-pane.h"
#include "Suno-layer-host.h"

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

static int count(GtkWidget *box) {
  int n = 0;
  for (GtkWidget *c = gtk_widget_get_first_child(box); c != NULL; c = gtk_widget_get_next_sibling(c))
    n++;
  return n;
}

static GtkWidget *sheet_of(GtkWidget *pane) { return gtk_widget_get_first_child(pane); }

static GtkWidget *body_of(GtkWidget *sheet) {
  GtkWidget *scroller = gtk_widget_get_prev_sibling(gtk_widget_get_last_child(sheet));
  g_assert_true(GTK_IS_SCROLLED_WINDOW(scroller));
  return gtk_viewport_get_child(GTK_VIEWPORT(gtk_scrolled_window_get_child(GTK_SCROLLED_WINDOW(scroller))));
}

static void notified(GObject *object G_GNUC_UNUSED, GParamSpec *pspec G_GNUC_UNUSED, gpointer data) {
  (*(int *)data)++;
}

static void counted(GObject *object G_GNUC_UNUSED, gpointer data) { (*(int *)data)++; }

static void photo(GObject *object G_GNUC_UNUSED, guint index, gpointer data) { *(guint *)data = index; }

static void test_rows(void) {
  GtkWidget *row = g_object_ref_sink(Suno_details_row_new("Priya Raman", "@priya", NULL));
  g_assert_true(gtk_widget_has_css_class(row, "SunoUI-details-row"));
  GtkWidget *actions = gtk_widget_get_last_child(row);
  g_assert_false(gtk_widget_get_visible(actions));
  Suno_details_row_add_action(SUNO_DETAILS_ROW(row), "phone", "Call", "win.call");
  g_assert_true(gtk_widget_get_visible(actions));
  g_assert_true(gtk_widget_has_css_class(gtk_widget_get_first_child(actions), "SunoUI-details-action"));
  int activated = 0;
  g_signal_connect(row, "activated", G_CALLBACK(counted), &activated);
  g_signal_emit_by_name(gtk_widget_get_first_child(row), "clicked");
  g_assert_cmpint(activated, ==, 1);
  g_object_unref(row);

  GtkWidget *item = g_object_ref_sink(Suno_details_item_new("Standup", "Every weekday", "calendar"));
  g_assert_true(GTK_IS_BUTTON(item));
  GtkWidget *line = gtk_button_get_child(GTK_BUTTON(item));
  g_assert_true(gtk_widget_has_css_class(gtk_widget_get_first_child(line), "SunoUI-details-item-icon"));
  GtkWidget *lead = gtk_label_new("x");
  Suno_details_item_set_lead(SUNO_DETAILS_ITEM(item), lead);
  g_assert_true(gtk_widget_get_first_child(line) == lead);
  g_assert_cmpint(count(line), ==, 2);
  GtkWidget *trail = gtk_label_new("9:30");
  Suno_details_item_set_trail(SUNO_DETAILS_ITEM(item), trail);
  g_assert_true(gtk_widget_get_last_child(line) == trail);
  Suno_details_item_set_trail(SUNO_DETAILS_ITEM(item), NULL);
  g_assert_cmpint(count(line), ==, 2);
  Suno_details_item_set_selected(SUNO_DETAILS_ITEM(item), TRUE);
  g_assert_true(gtk_widget_has_css_class(item, "on"));
  g_object_unref(item);

  GtkWidget *add = g_object_ref_sink(Suno_add_row_new("Add people", NULL, "<Control>n"));
  g_assert_true(gtk_widget_has_css_class(add, "SunoUI-add-row"));
  line = gtk_button_get_child(GTK_BUTTON(add));
  g_assert_true(gtk_widget_has_css_class(gtk_widget_get_last_child(line), "SunoUI-add-shortcut"));
  GtkWidget *add_label = gtk_widget_get_next_sibling(gtk_widget_get_first_child(line));
  Suno_add_row_set_document(SUNO_ADD_ROW(add), TRUE);
  g_assert_cmpint(gtk_label_get_max_width_chars(GTK_LABEL(add_label)), ==, -1);
  Suno_add_row_set_document(SUNO_ADD_ROW(add), FALSE);
  g_assert_cmpint(gtk_label_get_max_width_chars(GTK_LABEL(add_label)), ==, 1);
  g_object_unref(add);

  GtkWidget *fact = g_object_ref_sink(Suno_fact_row_new("phone", "Mobile", "+44 7700 900123", TRUE));
  GtkWidget *copy = gtk_widget_get_last_child(fact);
  g_assert_true(gtk_widget_has_css_class(copy, "SunoUI-fact-copy"));
  g_assert_cmpstr(gtk_widget_get_tooltip_text(copy), ==, "Copy mobile");
  Suno_fact_row_copy(SUNO_FACT_ROW(fact)); /* no window: the clipboard only, no toast */
  g_object_unref(fact);
}

static void test_photos(void) {
  g_autoptr(GListStore) store = g_list_store_new(G_TYPE_OBJECT);
  for (int i = 0; i < 5; i++) {
    g_autoptr(GdkPaintable) paintable = gdk_paintable_new_empty(40, 40);
    g_list_store_append(store, paintable);
  }
  GtkWidget *photos = g_object_ref_sink(Suno_details_photos_new(G_LIST_MODEL(store)));
  g_assert_cmpint(count(photos), ==, 5);
  GtkWidget *fifth = gtk_grid_get_child_at(GTK_GRID(photos), 1, 1);
  g_assert_nonnull(fifth);
  g_assert_true(gtk_widget_has_css_class(fifth, "SunoUI-details-photo"));
  guint index = 0;
  g_signal_connect(photos, "photo-activated", G_CALLBACK(photo), &index);
  g_signal_emit_by_name(photos, "photo-activated", 4);
  g_assert_cmpuint(index, ==, 4);
  g_autoptr(GListStore) wrong = g_list_store_new(G_TYPE_OBJECT);
  g_autoptr(GObject) thing = g_object_new(G_TYPE_OBJECT, NULL);
  g_list_store_append(wrong, thing);
  g_test_expect_message(G_LOG_DOMAIN, G_LOG_LEVEL_CRITICAL, "*GdkPaintable or a GFile*");
  Suno_details_photos_set_items(SUNO_DETAILS_PHOTOS(photos), G_LIST_MODEL(wrong));
  g_test_assert_expected_messages();
  g_assert_cmpint(count(photos), ==, 0);
  g_object_unref(photos);
}

/* Inspect the rendered surface, including children, rather than a CSS name.
 * The native pane must draw the same inset above its content as Python's pane. */
static int island_shades(GskRenderNode *node) {
  switch (gsk_render_node_get_node_type(node)) {
  case GSK_INSET_SHADOW_NODE:
    return gsk_inset_shadow_node_get_blur_radius(node) == 8 &&
           gsk_inset_shadow_node_get_spread(node) == -2 &&
           gsk_inset_shadow_node_get_dy(node) == 3;
  case GSK_CONTAINER_NODE: {
    int total = 0;
    for (guint i = 0; i < gsk_container_node_get_n_children(node); i++)
      total += island_shades(gsk_container_node_get_child(node, i));
    return total;
  }
  case GSK_CLIP_NODE: return island_shades(gsk_clip_node_get_child(node));
  case GSK_ROUNDED_CLIP_NODE: return island_shades(gsk_rounded_clip_node_get_child(node));
  case GSK_TRANSFORM_NODE: return island_shades(gsk_transform_node_get_child(node));
  case GSK_OPACITY_NODE: return island_shades(gsk_opacity_node_get_child(node));
  case GSK_SHADOW_NODE: return island_shades(gsk_shadow_node_get_child(node));
  default: return 0;
  }
}

static void test_inset_surface(void) {
  GtkWidget *window = gtk_window_new();
  GtkWidget *pane = Suno_details_pane_new("Information", TRUE);
  gtk_window_set_default_size(GTK_WINDOW(window), 1024, 500);
  gtk_window_set_child(GTK_WINDOW(window), pane);
  gtk_window_present(GTK_WINDOW(window));
  settle();
  for (int dark = 0; dark < 2; dark++) {
    adw_style_manager_set_color_scheme(adw_style_manager_get_default(), dark ?
      ADW_COLOR_SCHEME_FORCE_DARK : ADW_COLOR_SCHEME_FORCE_LIGHT);
    settle();
    GtkWidget *sheet = sheet_of(pane);
    GdkPaintable *paintable = gtk_widget_paintable_new(sheet);
    GtkSnapshot *snapshot = gtk_snapshot_new();
    gdk_paintable_snapshot(paintable, snapshot, gtk_widget_get_width(sheet), gtk_widget_get_height(sheet));
    GskRenderNode *node = gtk_snapshot_free_to_node(snapshot);
    g_assert_nonnull(node);
    g_assert_cmpint(island_shades(node), ==, 1);
    gsk_render_node_unref(node);
    g_object_unref(paintable);
  }
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_content(void) {
  GtkWidget *pane = g_object_ref_sink(Suno_details_pane_new(NULL, FALSE));
  GtkWidget *sheet = sheet_of(pane);
  GtkWidget *header = gtk_widget_get_next_sibling(gtk_widget_get_first_child(sheet));
  GtkWidget *back = gtk_widget_get_first_child(header);
  GtkWidget *title = gtk_widget_get_next_sibling(back);
  GtkWidget *leading = gtk_image_new_from_icon_name("document-open-symbolic");
  Suno_details_pane_set_leading(SUNO_DETAILS_PANE(pane), leading);
  g_object_ref(leading);
  g_assert_true(gtk_widget_get_next_sibling(back) == leading);
  g_assert_true(gtk_widget_get_next_sibling(leading) == title);
  g_assert_true(gtk_widget_has_css_class(leading, "SunoUI-details-leading"));
  Suno_details_pane_set_leading(SUNO_DETAILS_PANE(pane), leading); /* no-op */
  g_assert_true(gtk_widget_get_next_sibling(back) == leading);
  GtkWidget *replacement = gtk_label_new("T");
  Suno_details_pane_set_leading(SUNO_DETAILS_PANE(pane), replacement);
  g_object_ref(replacement);
  g_assert_null(gtk_widget_get_parent(leading));
  g_assert_true(gtk_widget_get_next_sibling(back) == replacement);
  Suno_details_pane_set_leading(SUNO_DETAILS_PANE(pane), NULL);
  g_assert_null(gtk_widget_get_parent(replacement));
  g_assert_true(gtk_widget_get_next_sibling(back) == title);
  GtkWidget *entry = gtk_entry_new();
  Suno_details_pane_set_title_content(SUNO_DETAILS_PANE(pane), entry);
  g_object_ref(entry);
  g_assert_false(gtk_widget_get_visible(title));
  g_assert_true(gtk_widget_get_next_sibling(title) == entry);
  g_assert_true(gtk_widget_get_next_sibling(entry) == gtk_widget_get_last_child(header));
  g_assert_true(gtk_widget_get_hexpand(entry));
  Suno_details_pane_set_title_content(SUNO_DETAILS_PANE(pane), entry);
  Suno_details_pane_set_title_content(SUNO_DETAILS_PANE(pane), NULL);
  g_assert_true(gtk_widget_get_visible(title));
  g_assert_null(gtk_widget_get_parent(entry));
  g_object_unref(entry);
  g_object_unref(leading);
  g_object_unref(replacement);
  g_assert_true(gtk_widget_has_css_class(pane, "SunoUI-details-slot"));
  g_assert_true(gtk_widget_has_css_class(sheet, "SunoUI-details"));
  g_assert_false(gtk_widget_get_visible(sheet));
  GtkWidget *body = body_of(sheet);
  Suno_details_pane_add_hero(SUNO_DETAILS_PANE(pane), "Launch crew", "4 people", NULL);
  Suno_details_pane_add_fact(SUNO_DETAILS_PANE(pane), "Created", "Sep 2");
  Suno_details_pane_add_fact(SUNO_DETAILS_PANE(pane), "Encryption", "End-to-end");
  Suno_details_pane_add_section(SUNO_DETAILS_PANE(pane), "People", "View all", "win.people");
  Suno_details_pane_add_row(SUNO_DETAILS_PANE(pane), Suno_details_row_new("Priya", NULL, NULL));
  Suno_details_pane_add_row(SUNO_DETAILS_PANE(pane), Suno_add_row_new("Add people", NULL, NULL));
  Suno_details_pane_add_fact(SUNO_DETAILS_PANE(pane), "Size", "2 MB");
  g_assert_cmpint(count(body), ==, 5); /* hero, facts, section, list, facts */
  GtkWidget *facts = gtk_widget_get_next_sibling(gtk_widget_get_first_child(body));
  g_assert_true(gtk_widget_has_css_class(facts, "SunoUI-details-facts"));
  g_assert_cmpint(count(facts), ==, 2);
  GtkWidget *list = gtk_widget_get_prev_sibling(gtk_widget_get_last_child(body));
  g_assert_true(gtk_widget_has_css_class(list, "SunoUI-details-list"));
  g_assert_cmpint(count(list), ==, 2);
  g_test_expect_message(G_LOG_DOMAIN, G_LOG_LEVEL_CRITICAL, "*details list holds*");
  Suno_details_pane_add_row(SUNO_DETAILS_PANE(pane), gtk_label_new("nope"));
  g_test_assert_expected_messages();
  Suno_details_pane_clear(SUNO_DETAILS_PANE(pane));
  g_assert_cmpint(count(body), ==, 0);
  g_object_unref(pane);
}

static void test_show(void) {
  GtkWidget *pane = g_object_ref_sink(Suno_details_pane_new("Info", FALSE));
  int notifies = 0;
  g_signal_connect(pane, "notify::shown", G_CALLBACK(notified), &notifies);
  GtkWidget *info = g_object_ref_sink(Suno_details_pane_info_button(SUNO_DETAILS_PANE(pane)));
  /* Nothing to describe: Info keeps it closed. */
  g_assert_false(Suno_details_pane_show(SUNO_DETAILS_PANE(pane), TRUE));
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(info), TRUE);
  g_assert_false(gtk_toggle_button_get_active(GTK_TOGGLE_BUTTON(info)));
  g_autoptr(GObject) subject = g_object_new(G_TYPE_OBJECT, NULL);
  Suno_details_pane_set_subject(SUNO_DETAILS_PANE(pane), subject);
  g_assert_false(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(info), TRUE);
  g_assert_true(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  g_assert_true(gtk_widget_get_visible(sheet_of(pane)));
  g_assert_cmpint(notifies, ==, 1);
  /* The wish is kept while the subject changes. */
  g_autoptr(GObject) next = g_object_new(G_TYPE_OBJECT, NULL);
  Suno_details_pane_set_subject(SUNO_DETAILS_PANE(pane), next);
  g_assert_true(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  g_assert_true(Suno_details_pane_get_subject(SUNO_DETAILS_PANE(pane)) == next);
  /* The subject goes away: it closes and forgets. */
  Suno_details_pane_set_subject(SUNO_DETAILS_PANE(pane), NULL);
  g_assert_false(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  g_assert_false(gtk_toggle_button_get_active(GTK_TOGGLE_BUTTON(info)));
  Suno_details_pane_set_subject(SUNO_DETAILS_PANE(pane), subject);
  g_assert_false(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  g_assert_true(Suno_details_pane_toggle(SUNO_DETAILS_PANE(pane)));
  Suno_details_pane_close(SUNO_DETAILS_PANE(pane));
  g_assert_false(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  g_assert_cmpint(notifies, ==, 4);
  /* A main pane stays open, without a close button. */
  Suno_details_pane_set_main(SUNO_DETAILS_PANE(pane), TRUE);
  g_assert_true(Suno_details_pane_get_main(SUNO_DETAILS_PANE(pane)));
  g_assert_true(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  Suno_details_pane_close(SUNO_DETAILS_PANE(pane));
  g_assert_true(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  g_object_unref(info);
  g_object_unref(pane);
}

static void test_drawer(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 400, 700);
  GtkWidget *box = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  GtkWidget *pane = Suno_details_pane_new("Details", FALSE);
  Suno_details_pane_add_fact(SUNO_DETAILS_PANE(pane), "Size", "2 MB");
  gtk_box_append(GTK_BOX(box), gtk_label_new("island"));
  gtk_box_append(GTK_BOX(box), pane);
  gtk_window_set_child(GTK_WINDOW(window), box);
  gtk_window_present(GTK_WINDOW(window));
  settle();
  g_autoptr(GObject) subject = g_object_new(G_TYPE_OBJECT, NULL);
  Suno_details_pane_set_subject(SUNO_DETAILS_PANE(pane), subject);
  g_assert_true(Suno_details_pane_show(SUNO_DETAILS_PANE(pane), TRUE));
  g_assert_true(Suno_details_pane_get_is_drawer(SUNO_DETAILS_PANE(pane)));
  g_assert_null(gtk_widget_get_first_child(pane));
  SunoLayerHost *host = Suno_layer_host_window_host(pane);
  SunoModalHandle *modal = Suno_layer_host_get_modal(host);
  g_assert_nonnull(modal);
  GtkWidget *sheet = Suno_modal_handle_get_card(modal);
  g_assert_true(gtk_widget_has_css_class(sheet, "drawer"));
  /* Tapped outside: it closes and the sheet comes home. */
  int notifies = 0;
  g_signal_connect(pane, "notify::shown", G_CALLBACK(notified), &notifies);
  Suno_modal_handle_cancel(modal);
  g_assert_false(Suno_details_pane_get_shown(SUNO_DETAILS_PANE(pane)));
  g_assert_cmpint(notifies, ==, 1);
  settle();
  g_assert_true(gtk_widget_get_first_child(pane) == sheet);
  g_assert_false(gtk_widget_get_visible(sheet));
  g_assert_true(gtk_widget_has_css_class(sheet, "Suno-island"));
  /* Open again, then widen: it goes back beside the island. */
  Suno_details_pane_show(SUNO_DETAILS_PANE(pane), TRUE);
  g_assert_true(Suno_details_pane_get_is_drawer(SUNO_DETAILS_PANE(pane)));
  gtk_window_set_default_size(GTK_WINDOW(window), 1000, 700);
  settle();
  g_assert_false(Suno_details_pane_get_is_drawer(SUNO_DETAILS_PANE(pane)));
  g_assert_true(gtk_widget_get_first_child(pane) == sheet);
  g_assert_true(gtk_widget_get_visible(sheet));
  g_assert_false(gtk_widget_has_css_class(sheet, "drawer"));
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_embedded(void) {
  const int widths[] = {360, 402, 720, 1180};
  for (guint i = 0; i < G_N_ELEMENTS(widths); i++) {
    GtkWidget *window = gtk_window_new();
    gtk_widget_add_css_class(window, "Suno-app-window");
    gtk_widget_add_css_class(window, "SunoUI-phone-device");
    gtk_window_set_default_size(GTK_WINDOW(window), widths[i], 700);
    GtkWidget *host = Suno_layer_host_new(gtk_label_new("Files"));
    gtk_window_set_child(GTK_WINDOW(window), host);
    SunoActionCenter *center = SUNO_ACTION_CENTER(Suno_action_center_new(NULL));
    Suno_action_center_attach(center, host);
    SunoBarItem *items[] = { Suno_bar_item_new_action("copy", "Copy", NULL),
                            Suno_bar_item_new_action("info", "Details", NULL),
                            Suno_bar_item_new_action("x", "Done", NULL) };
    Suno_action_center_show_bar(center, items, 3, NULL);
    GtkWidget *pane = Suno_details_pane_new("Details", TRUE);
    Suno_details_pane_set_embedded(SUNO_DETAILS_PANE(pane), TRUE);
    Suno_details_pane_set_closable(SUNO_DETAILS_PANE(pane), FALSE);
    Suno_details_pane_set_header_visible(SUNO_DETAILS_PANE(pane), FALSE);
    GtkWidget *thumbnail = gtk_image_new_from_icon_name("image-x-generic-symbolic");
    gtk_image_set_pixel_size(GTK_IMAGE(thumbnail), 44);
    Suno_details_pane_add_subject(SUNO_DETAILS_PANE(pane),
        "A long selected photo name that must fit the panel.webp", "Image · 412 KB", thumbnail);
    Suno_details_pane_add_fact(SUNO_DETAILS_PANE(pane), "Kind", "Text document");
    Suno_details_pane_add_fact(SUNO_DETAILS_PANE(pane), "Size", "2.3 kB");
    gtk_window_present(GTK_WINDOW(window)); settle();
    Suno_action_center_grow_panel(center, "details", pane); settle();
    g_assert_false(gtk_widget_has_css_class(sheet_of(pane), "Suno-island"));
    g_assert_false(Suno_details_pane_get_is_drawer(SUNO_DETAILS_PANE(pane)));
    g_assert_true(gtk_widget_is_ancestor(sheet_of(pane), GTK_WIDGET(center)));
    GtkWidget *copy = Suno_action_center_get_bar_control(center, 0);
    g_assert_true(gtk_widget_get_mapped(copy));
    graphene_rect_t row, panel;
    g_assert_true(gtk_widget_compute_bounds(copy, window, &row));
    g_assert_true(gtk_widget_compute_bounds(pane, window, &panel));
    g_assert_cmpfloat(panel.size.height, <, 260);
    GtkWidget *subject = gtk_widget_get_first_child(body_of(sheet_of(pane)));
    graphene_rect_t summary;
    g_assert_true(gtk_widget_compute_bounds(subject, pane, &summary));
    g_assert_cmpfloat(summary.origin.x + summary.size.width, <=, gtk_widget_get_width(pane));
    g_assert_cmpint(gtk_widget_get_height(thumbnail), ==, 44);
    g_assert_cmpfloat(row.origin.y, >=, panel.origin.y + panel.size.height);
    g_assert_cmpfloat(row.origin.y + row.size.height, <=, gtk_widget_get_height(window));
    Suno_action_center_fold(center); settle();
    g_assert_true(gtk_widget_get_mapped(copy));
    g_assert_null(Suno_action_center_get_grown(center));
    for (guint n = 0; n < G_N_ELEMENTS(items); n++) g_object_unref(items[n]);
    gtk_window_destroy(GTK_WINDOW(window));
  }
}

static void test_fixed_footer(void) {
  for (int width = 400; width <= 1024; width += 624) {
    GtkWidget *window = gtk_window_new();
    gtk_window_set_default_size(GTK_WINDOW(window), width, 700);
    GtkWidget *pane = Suno_details_pane_new("Sources", FALSE);
    gtk_window_set_child(GTK_WINDOW(window), pane);
    for (int i = 0; i < 40; i++)
      Suno_details_pane_add(SUNO_DETAILS_PANE(pane), gtk_label_new("A long source list"));
    GtkWidget *action = g_object_ref_sink(gtk_button_new_with_label("Add source"));
    Suno_details_pane_set_footer(SUNO_DETAILS_PANE(pane), action);
    Suno_details_pane_set_footer(SUNO_DETAILS_PANE(pane), action); /* no-op */
    GtkWidget *footer = gtk_widget_get_parent(action);
    g_assert_true(gtk_widget_has_css_class(footer, "SunoUI-details-footer"));
    g_assert_true(gtk_widget_get_visible(footer));
    GtkWidget *other = g_object_ref_sink(gtk_box_new(GTK_ORIENTATION_VERTICAL, 0));
    GtkWidget *parented = gtk_label_new("Already parented");
    gtk_box_append(GTK_BOX(other), parented);
    g_test_expect_message(G_LOG_DOMAIN, G_LOG_LEVEL_CRITICAL, "*gtk_widget_get_parent(widget) == NULL*");
    Suno_details_pane_set_footer(SUNO_DETAILS_PANE(pane), parented);
    g_test_assert_expected_messages();
    g_assert_true(gtk_widget_get_parent(parented) == other);
    gtk_window_present(GTK_WINDOW(window)); settle();
    g_autoptr(GObject) subject = g_object_new(G_TYPE_OBJECT, NULL);
    Suno_details_pane_set_subject(SUNO_DETAILS_PANE(pane), subject);
    g_assert_true(Suno_details_pane_show(SUNO_DETAILS_PANE(pane), TRUE)); settle();
    g_assert_true(gtk_widget_get_mapped(action));
    for (int height = 700; height >= 420; height -= 280) {
      gtk_window_set_default_size(GTK_WINDOW(window), width, height); settle();
      graphene_rect_t bounds;
      g_assert_true(gtk_widget_compute_bounds(action, window, &bounds));
      g_assert_cmpfloat(bounds.origin.y, >=, 0);
      g_assert_cmpfloat(bounds.origin.y + bounds.size.height, <=, gtk_widget_get_height(window));
      GtkWidget *scroller = gtk_widget_get_prev_sibling(footer);
      GtkAdjustment *adjustment = gtk_scrolled_window_get_vadjustment(GTK_SCROLLED_WINDOW(scroller));
      gtk_adjustment_set_value(adjustment, gtk_adjustment_get_upper(adjustment)); settle();
      graphene_rect_t after;
      g_assert_true(gtk_widget_compute_bounds(action, window, &after));
      g_assert_cmpfloat(after.origin.y, ==, bounds.origin.y);
    }
    Suno_details_pane_clear(SUNO_DETAILS_PANE(pane));
    g_assert_null(gtk_widget_get_parent(action));
    g_assert_false(gtk_widget_get_visible(footer));
    g_object_unref(action); g_object_unref(other);
    gtk_window_destroy(GTK_WINDOW(window));
  }
}

int main(int argc, char **argv) {
  gtk_init();
  Suno_init();
  g_test_init(&argc, &argv, NULL);
  g_test_add_func("/SunoUI/details/fixed-footer", test_fixed_footer);
  g_test_add_func("/SunoUI/details/embedded", test_embedded);
  g_test_add_func("/SunoUI/details-pane/rows", test_rows);
  g_test_add_func("/SunoUI/details-pane/photos", test_photos);
  g_test_add_func("/SunoUI/details-pane/content", test_content);
  g_test_add_func("/SunoUI/details-pane/show", test_show);
  g_test_add_func("/SunoUI/details-pane/drawer", test_drawer);
  g_test_add_func("/SunoUI/details/inset-surface", test_inset_surface);
  return g_test_run();
}
