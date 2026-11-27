/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-ui.h"
#include "Suno-action-center.h"

static gboolean stop(gpointer data) {
  *(gboolean *)data = TRUE;
  return G_SOURCE_REMOVE;
}
static void spin(void) {
  gboolean done = FALSE;
  g_timeout_add(300, stop, &done);
  while (!done)
    g_main_context_iteration(NULL, TRUE);
}

static GtkWidget *find_class(GtkWidget *widget, const char *css) {
  if (gtk_widget_has_css_class(widget, css))
    return widget;
  for (GtkWidget *child = gtk_widget_get_first_child(widget); child; child = gtk_widget_get_next_sibling(child)) {
    GtkWidget *found = find_class(child, css);
    if (found)
      return found;
  }
  return NULL;
}

static void count(gpointer instance G_GNUC_UNUSED, gpointer data) { (*(int *)data)++; }

static char *last_state;
static void state_changed(SunoActionCenter *center G_GNUC_UNUSED, const char *state, gpointer data G_GNUC_UNUSED) {
  g_free(last_state);
  last_state = g_strdup(state);
}

static int sends;
static char *last_mode;
static void send_activated(GSimpleAction *action G_GNUC_UNUSED, GVariant *param G_GNUC_UNUSED, gpointer data G_GNUC_UNUSED) {
  sends++;
}
static void mode_changed(SunoActionEditor *editor G_GNUC_UNUSED, const char *key, gpointer data G_GNUC_UNUSED) {
  g_free(last_mode);
  last_mode = g_strdup(key);
}

static SunoBarItem *action(const char *icon, const char *label, const char *tooltip);

static char *search_event;
static int search_changes, search_activations;
static void search_changed(SunoBarItem *item G_GNUC_UNUSED, const char *text, gpointer data G_GNUC_UNUSED) {
  search_changes++;
  g_free(search_event);
  search_event = g_strdup(text);
}
static void search_activated(SunoBarItem *item G_GNUC_UNUSED, const char *text, gpointer data G_GNUC_UNUSED) {
  search_activations++;
  g_free(search_event);
  search_event = g_strdup(text);
}

static void test_search_and_modes(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 1000, 700);
  GtkWidget *content = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_window_set_child(GTK_WINDOW(window), content);
  SunoActionCenter *center = SUNO_ACTION_CENTER(Suno_action_center_new(NULL));
  Suno_action_center_attach(center, content);
  GtkWidget *modes_widget = Suno_mode_switch_new("View mode");
  SunoModeSwitch *modes = SUNO_MODE_SWITCH(modes_widget);
  Suno_mode_switch_add(modes, "grid", "Grid", "layout-grid");
  Suno_mode_switch_add(modes, "list", "List", "list");
  Suno_mode_switch_add(modes, "columns", "Columns", "columns-3");
  SunoBarItem *mode_item = Suno_bar_item_new_modes(modes);
  SunoBarItem *search = Suno_bar_item_new_search("Search Launch");
  g_signal_connect(search, "search-changed", G_CALLBACK(search_changed), NULL);
  g_signal_connect(search, "search-activated", G_CALLBACK(search_activated), NULL);
  SunoBarItem *back = action("arrow-left", NULL, "Back");
  SunoBarItem *normal[] = {back, search, mode_item};
  Suno_action_center_show_bar(center, normal, G_N_ELEMENTS(normal), NULL);
  gtk_window_present(GTK_WINDOW(window));
  spin();
  GtkWidget *entry = find_class(GTK_WIDGET(center), "SunoUI-bar-search");
  g_assert_true(GTK_IS_SEARCH_ENTRY(entry));
  g_assert_true(find_class(GTK_WIDGET(center), "SunoUI-modes") == modes_widget);
  g_assert_true(gtk_widget_has_css_class(modes_widget, "in-bar"));
  g_assert_cmpstr(Suno_bar_item_search_get_text(search), ==, "");
  gtk_editable_set_text(GTK_EDITABLE(entry), "invoice");
  g_assert_cmpint(search_changes, ==, 1);
  g_assert_cmpstr(search_event, ==, "invoice");
  g_signal_emit_by_name(entry, "activate");
  g_assert_cmpint(search_activations, ==, 1);
  Suno_mode_switch_set_current(modes, "list");
  SunoBarItem *selected[] = {Suno_bar_item_new_chip("invoice.pdf", "file", FALSE),
                             action("copy", NULL, "Copy"), action("ellipsis", NULL, "More")};
  Suno_action_center_show_bar(center, selected, G_N_ELEMENTS(selected), NULL);
  g_assert_true(GTK_IS_BUTTON(Suno_bar_item_get_active_control(selected[1])));
  GtkWidget *more_button = Suno_bar_item_get_active_control(selected[2]);
  g_assert_true(GTK_IS_BUTTON(more_button));
  GtkWidget *menu = Suno_floating_menu_new("File actions");
  Suno_floating_menu_add_item(SUNO_FLOATING_MENU(menu), "Rename", "pencil", NULL, NULL, "win.rename", FALSE);
  Suno_floating_menu_popup(SUNO_FLOATING_MENU(menu), more_button);
  g_assert_true(Suno_floating_menu_get_is_open(SUNO_FLOATING_MENU(menu)));
  Suno_floating_menu_close(SUNO_FLOATING_MENU(menu));
  g_assert_null(Suno_bar_item_get_active_control(back));
  GtkWidget *search_host = gtk_widget_get_parent(entry);
  g_assert_nonnull(search_host);
  g_assert_null(gtk_widget_get_parent(search_host));
  g_assert_null(gtk_widget_get_parent(modes_widget));
  Suno_action_center_show_bar(center, normal, G_N_ELEMENTS(normal), NULL);
  g_assert_null(Suno_bar_item_get_active_control(selected[1]));
  g_assert_true(find_class(GTK_WIDGET(center), "SunoUI-bar-search") == entry);
  g_assert_true(find_class(GTK_WIDGET(center), "SunoUI-modes") == modes_widget);
  g_assert_cmpstr(gtk_editable_get_text(GTK_EDITABLE(entry)), ==, "invoice");
  g_assert_cmpstr(Suno_mode_switch_get_current(modes), ==, "list");
  Suno_bar_item_search_set_text(search, "report");
  g_assert_cmpstr(gtk_editable_get_text(GTK_EDITABLE(entry)), ==, "report");
  g_assert_cmpint(search_changes, ==, 1); /* programmatic sync is quiet */
  Suno_bar_item_search_focus(search);
  GtkWidget *focused = gtk_window_get_focus(GTK_WINDOW(window));
  g_assert_true(focused == entry || (focused != NULL && gtk_widget_is_ancestor(focused, entry)));
  g_object_unref(selected[0]);
  g_object_unref(selected[1]);
  g_object_unref(selected[2]);
  g_object_unref(back);
  g_object_unref(search);
  g_object_unref(mode_item);
  gtk_window_destroy(GTK_WINDOW(window));
  g_clear_pointer(&search_event, g_free);
  search_changes = search_activations = 0;
}

/* GTK may retain the focused entry until the next frame after a bar swap.
 * Retiring its model must disconnect callbacks even while that widget survives. */
static void test_retired_search(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 1000, 700);
  GtkWidget *content = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_window_set_child(GTK_WINDOW(window), content);
  SunoActionCenter *center = SUNO_ACTION_CENTER(Suno_action_center_new(NULL));
  Suno_action_center_attach(center, content);
  SunoBarItem *search = Suno_bar_item_new_search("Search files");
  SunoBarItem *weak_search = search;
  g_object_add_weak_pointer(G_OBJECT(search), (gpointer *)&weak_search);
  SunoBarItem *items[] = {search};
  Suno_action_center_show_bar(center, items, 1, NULL);
  gtk_window_present(GTK_WINDOW(window));
  spin();
  Suno_bar_item_search_focus(search);
  GtkWidget *entry = g_object_ref(Suno_bar_item_search_get_entry(search));
  g_assert_true(GTK_IS_SEARCH_ENTRY(entry));
  g_object_unref(search);
  Suno_action_center_show_bar(center, NULL, 0, NULL);
  spin();
  g_assert_null(weak_search);
  /* A retained widget must be harmless after its model is gone. */
  gtk_editable_set_text(GTK_EDITABLE(entry), "retired widget");
  g_signal_emit_by_name(entry, "activate");
  g_object_unref(entry);
  gtk_window_destroy(GTK_WINDOW(window));
  spin();
}

static void test_search_phone_fold(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 390, 700);
  GtkWidget *content = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_window_set_child(GTK_WINDOW(window), content);
  SunoActionCenter *center = SUNO_ACTION_CENTER(Suno_action_center_new(NULL));
  Suno_action_center_attach(center, content);
  SunoBarItem *search = Suno_bar_item_new_search("Search places");
  SunoBarItem *items[] = {search};
  Suno_action_center_show_bar(center, items, 1, NULL);
  gtk_window_present(GTK_WINDOW(window));
  spin();
  GtkWidget *host = find_class(GTK_WIDGET(center), "SunoUI-bar-search-host");
  GtkWidget *entry = find_class(host, "SunoUI-bar-search");
  g_assert_cmpint(gtk_widget_get_width(GTK_WIDGET(window)), <, SUNO_TIER_PHONE_BELOW);
  g_assert_true(gtk_widget_has_css_class(host, "folded"));
  g_assert_cmpint(gtk_widget_get_width(host), <=, 48); /* v71: a phone bar's controls are 48 */
  Suno_bar_item_search_set_keep(search, TRUE);
  spin();
  g_assert_false(gtk_widget_has_css_class(host, "folded"));
  g_assert_true(gtk_stack_get_visible_child(GTK_STACK(host)) == entry);
  g_assert_true(Suno_bar_item_search_get_entry(search) == entry);
  g_assert_true(gtk_widget_has_css_class(entry, "keep"));
  g_assert_cmpint(gtk_widget_get_height(entry), ==, 48);
  g_assert_cmpint(gtk_widget_get_width(host), >=, gtk_widget_get_width(window) - 44);
  graphene_rect_t entry_bounds;
  g_assert_true(gtk_widget_compute_bounds(entry, host, &entry_bounds));
  g_assert_cmpfloat(entry_bounds.size.width, ==, gtk_widget_get_width(host));
  Suno_bar_item_search_set_keep(search, FALSE);
  spin();
  g_assert_true(gtk_widget_has_css_class(host, "folded"));
  GtkWidget *button = find_class(host, "SunoUI-bar-button");
  g_signal_emit_by_name(button, "clicked");
  g_assert_true(gtk_stack_get_visible_child(GTK_STACK(host)) == entry);
  gtk_editable_set_text(GTK_EDITABLE(entry), "Kansas City");
  g_assert_cmpstr(Suno_bar_item_search_get_text(search), ==, "Kansas City");
  gtk_window_destroy(GTK_WINDOW(window));
  g_object_unref(search);
}

static SunoBarItem *action(const char *icon, const char *label, const char *tooltip) {
  SunoBarItem *item = Suno_bar_item_new_action(icon, label, NULL);
  if (tooltip)
    Suno_bar_item_set_tooltip(item, tooltip);
  return item;
}

static void test_items(void) {
  SunoBarItem *share = Suno_bar_item_new_action("share-2", "Share", "win.share");
  g_assert_cmpint(Suno_bar_item_get_kind(share), ==, SUNO_BAR_ITEM_ACTION);
  Suno_bar_item_set_primary(share, TRUE);
  GtkWidget *button = g_object_ref_sink(Suno_bar_item_create_control(share, "tool"));
  g_assert_true(gtk_widget_has_css_class(button, "SunoUI-bar-button"));
  g_assert_true(gtk_widget_has_css_class(button, "tool"));
  g_assert_true(gtk_widget_has_css_class(button, "primary"));
  g_assert_false(gtk_widget_has_css_class(button, "icon"));
  g_assert_cmpstr(gtk_actionable_get_action_name(GTK_ACTIONABLE(button)), ==, "win.share");
  int activated = 0;
  g_signal_connect(share, "activated", G_CALLBACK(count), &activated);
  g_signal_emit_by_name(button, "clicked");
  g_assert_cmpint(activated, ==, 1);
  g_object_unref(button);

  SunoBarItem *summary = Suno_bar_item_new_chip_action("Σ 42 · 3 cells", "square-dashed", NULL);
  Suno_bar_item_set_tooltip(summary, "Average 14 · min 2 · max 30");
  int summary_activated = 0;
  g_signal_connect(summary, "activated", G_CALLBACK(count), &summary_activated);
  GtkWidget *summary_button = g_object_ref_sink(Suno_bar_item_create_control(summary, "bar"));
  g_assert_true(GTK_IS_BUTTON(summary_button));
  g_assert_true(gtk_widget_has_css_class(summary_button, "SunoUI-bar-chip"));
  g_assert_cmpstr(gtk_widget_get_tooltip_text(summary_button), ==, "Average 14 · min 2 · max 30");
  g_signal_emit_by_name(summary_button, "clicked");
  g_assert_cmpint(summary_activated, ==, 1);
  g_object_unref(summary_button);
  g_object_unref(summary);

  SunoBarItem *heart = action("heart", NULL, "Favourite");
  Suno_bar_item_set_active(heart, TRUE);
  Suno_bar_item_set_danger(heart, TRUE);
  Suno_bar_item_set_sensitive(heart, FALSE);
  button = g_object_ref_sink(Suno_bar_item_create_control(heart, "bubble"));
  g_assert_true(gtk_widget_has_css_class(button, "icon"));
  g_assert_true(gtk_widget_has_css_class(button, "on"));
  g_assert_true(gtk_widget_has_css_class(button, "danger"));
  g_assert_false(gtk_widget_get_sensitive(button));
  g_assert_cmpstr(gtk_widget_get_tooltip_text(button), ==, "Favourite");
  g_object_unref(button);

  SunoBarItem *chip = Suno_bar_item_new_chip("3 photos", "image", TRUE);
  GtkWidget *control = g_object_ref_sink(Suno_bar_item_create_control(chip, NULL));
  g_assert_true(gtk_widget_has_css_class(control, "SunoUI-bar-chip"));
  GtkWidget *close = find_class(control, "SunoUI-bar-chip-close");
  int dismissed = 0;
  g_signal_connect(chip, "dismissed", G_CALLBACK(count), &dismissed);
  g_signal_emit_by_name(close, "clicked");
  g_assert_cmpint(dismissed, ==, 1);
  g_object_unref(control);

  /* A thumbnail replaces the fallback glyph, while Done remains actionable. */
  GdkPaintable *preview = gdk_paintable_new_empty(28, 28);
  Suno_bar_item_chip_set_paintable(chip, preview);
  g_object_unref(preview);
  control = g_object_ref_sink(Suno_bar_item_create_control(chip, NULL));
  g_assert_nonnull(find_class(control, "SunoUI-bar-chip-preview"));
  g_assert_null(find_class(control, "SunoUI-bar-chip-icon"));
  g_signal_emit_by_name(find_class(control, "SunoUI-bar-chip-close"), "clicked");
  g_assert_cmpint(dismissed, ==, 2);
  g_object_unref(control);

  /* Refusals. */
  SunoBarItem *bare = Suno_bar_item_new_action("bold", NULL, NULL);
  g_test_expect_message(G_LOG_DOMAIN, G_LOG_LEVEL_CRITICAL, "*needs a tooltip*");
  control = g_object_ref_sink(Suno_bar_item_create_control(bare, "bar"));
  g_test_assert_expected_messages();
  g_object_unref(control);
  SunoBarItem *prompt = Suno_bar_item_new_prompt("Reply…");
  g_test_expect_message(G_LOG_DOMAIN, G_LOG_LEVEL_CRITICAL, "*prompt belongs to the action center*");
  g_assert_null(Suno_bar_item_create_control(prompt, "bar"));
  g_test_assert_expected_messages();

  g_object_unref(share);
  g_object_unref(heart);
  g_object_unref(chip);
  g_object_unref(bare);
  g_object_unref(prompt);
}

static void test_center(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 1000, 700);
  GtkWidget *content = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_window_set_child(GTK_WINDOW(window), content);
  GSimpleActionGroup *group = g_simple_action_group_new();
  GSimpleAction *send = g_simple_action_new("send", NULL);
  g_signal_connect(send, "activate", G_CALLBACK(send_activated), NULL);
  g_action_map_add_action(G_ACTION_MAP(group), G_ACTION(send));
  gtk_widget_insert_action_group(window, "test", G_ACTION_GROUP(group));
  SunoLayerHost *host = Suno_layer_host_install(GTK_WINDOW(window));
  gtk_window_present(GTK_WINDOW(window));
  spin();

  GtkWidget *editor = Suno_action_editor_new("Reply", "reply");
  Suno_action_editor_add_mode(SUNO_ACTION_EDITOR(editor), "one", "Reply", "reply");
  Suno_action_editor_add_mode(SUNO_ACTION_EDITOR(editor), "fwd", "Forward", "forward");
  Suno_action_editor_set_summary(SUNO_ACTION_EDITOR(editor), "to {}", "Priya <3");
  GtkWidget *to = Suno_action_editor_add_field(SUNO_ACTION_EDITOR(editor), "To", NULL);
  g_assert_true(GTK_IS_ENTRY(to));
  g_assert_true(Suno_action_editor_get_field(SUNO_ACTION_EDITOR(editor), "To") == to);
  g_assert_null(Suno_action_editor_get_field(SUNO_ACTION_EDITOR(editor), "Cc"));
  SunoBarItem *send_item = Suno_bar_item_new_action("send-horizontal", "Send", "test.send");
  Suno_action_editor_set_primary(SUNO_ACTION_EDITOR(editor), send_item);
  g_signal_connect(editor, "mode-changed", G_CALLBACK(mode_changed), NULL);
  int discarded = 0;
  g_signal_connect(editor, "discarded", G_CALLBACK(count), &discarded);

  GtkWidget *center = Suno_action_center_new(SUNO_ACTION_EDITOR(editor));
  g_assert_cmpstr(Suno_action_center_get_state(SUNO_ACTION_CENTER(center)), ==, "hidden");
  g_assert_false(gtk_widget_get_visible(center));
  g_signal_connect(center, "state-changed", G_CALLBACK(state_changed), NULL);
  Suno_action_center_attach(SUNO_ACTION_CENTER(center), content);
  g_assert_true(gtk_widget_get_parent(center) == GTK_WIDGET(host));

  SunoBarItem *prompt = Suno_bar_item_new_prompt("Reply to Priya…");
  SunoBarItem *attach = action("paperclip", NULL, "Attach");
  SunoBarItem *items[] = {prompt, attach};
  int prompted = 0;
  g_signal_connect(prompt, "activated", G_CALLBACK(count), &prompted);
  Suno_action_center_show_bar(SUNO_ACTION_CENTER(center), items, 2, NULL);
  GtkWidget *prompt_control = Suno_action_center_get_bar_control(SUNO_ACTION_CENTER(center), 0);
  GtkWidget *attach_control = Suno_action_center_get_bar_control(SUNO_ACTION_CENTER(center), 1);
  g_assert_true(GTK_IS_BUTTON(prompt_control));
  g_assert_true(GTK_IS_BUTTON(attach_control));
  g_assert_null(Suno_action_center_get_bar_control(SUNO_ACTION_CENTER(center), 2));
  g_assert_cmpstr(last_state, ==, "bar");
  g_assert_true(gtk_widget_has_css_class(center, "bar"));
  GtkWidget *bar = find_class(center, "SunoUI-ac-bar");
  g_assert_true(gtk_widget_has_css_class(bar, "wide"));
  g_assert_false(gtk_widget_has_css_class(bar, "double"));
  spin();
  /* A wide bar: min(700, width - 48), 24 above the foot. */
  graphene_rect_t bounds;
  g_assert_true(gtk_widget_compute_bounds(center, GTK_WIDGET(host), &bounds));
  g_assert_cmpint((int)bounds.size.width, ==, 700);
  g_assert_cmpint((int)(bounds.origin.y + bounds.size.height), ==, gtk_widget_get_height(GTK_WIDGET(host)) - 24);

  /* A toast clears the bar. */
  SunoToast *toast = Suno_toast_show(content, "Saved", NULL);
  g_assert_cmpint(gtk_widget_get_margin_bottom(GTK_WIDGET(toast)), >=, 24 + (int)bounds.size.height);
  Suno_toast_dismiss(toast);

  /* The prompt grows the editor. */
  GtkWidget *prompt_button = find_class(center, "SunoUI-ac-prompt");
  g_signal_emit_by_name(prompt_button, "clicked");
  g_assert_cmpint(prompted, ==, 1);
  g_assert_cmpstr(Suno_action_center_get_state(SUNO_ACTION_CENTER(center)), ==, "editor");
  g_assert_true(gtk_widget_get_visible(find_class(center, "SunoUI-ac-editor")));
  g_assert_false(gtk_widget_get_visible(bar));
  spin();
  g_assert_true(gtk_widget_has_css_class(find_class(center, "SunoUI-ac-editor"), "shown"));

  /* Write, fold: the prompt shows the draft. */
  GtkWidget *view = find_class(editor, "SunoUI-ac-text");
  gtk_text_buffer_set_text(gtk_text_view_get_buffer(GTK_TEXT_VIEW(view)), "See you\n  at  noon", -1);
  g_assert_false(gtk_widget_get_visible(find_class(editor, "SunoUI-ac-placeholder")));
  Suno_action_center_fold(SUNO_ACTION_CENTER(center));
  g_assert_cmpstr(last_state, ==, "bar");
  GtkWidget *label = gtk_button_get_child(GTK_BUTTON(prompt_button));
  g_assert_cmpstr(gtk_label_get_label(GTK_LABEL(label)), ==, "Draft: See you at noon");
  g_assert_true(gtk_widget_has_css_class(prompt_button, "has-draft"));
  g_autofree char *draft = Suno_action_editor_get_draft(SUNO_ACTION_EDITOR(editor));
  g_assert_cmpstr(draft, ==, "See you\n  at  noon");

  /* Ctrl+Return's primary runs the GAction. */
  Suno_action_center_grow(SUNO_ACTION_CENTER(center));
  g_assert_true(Suno_action_editor_run_primary(SUNO_ACTION_EDITOR(editor)));
  g_assert_cmpint(sends, ==, 1);

  /* Modes: the header's menu picks through the editor's action. */
  GtkWidget *mode = find_class(editor, "SunoUI-ac-mode");
  g_assert_false(gtk_widget_has_css_class(mode, "static"));
  g_assert_nonnull(find_class(mode, "SunoUI-ac-mode-chevron"));
  gtk_widget_activate_action(mode, "SunoUI-editor.mode", "s", "fwd");
  g_assert_cmpstr(last_mode, ==, "fwd");

  /* Discard forgets the draft and folds. */
  GtkWidget *discard = find_class(find_class(editor, "SunoUI-ac-footer"), "SunoUI-bar-button");
  g_signal_emit_by_name(discard, "clicked");
  g_assert_cmpint(discarded, ==, 1);
  g_assert_cmpstr(last_state, ==, "bar");
  g_assert_null(Suno_action_editor_get_draft(SUNO_ACTION_EDITOR(editor)));
  g_assert_cmpstr(gtk_label_get_label(GTK_LABEL(label)), ==, "Reply to Priya…");

  /* Double height, then split, then hidden. */
  SunoBarItem *context = Suno_bar_item_new_context("reply", "Replying to {}", "Priya", TRUE);
  Suno_action_center_show_bar(SUNO_ACTION_CENTER(center), items, 2, context);
  g_assert_cmpstr(last_state, ==, "double");
  g_assert_true(gtk_widget_get_visible(find_class(center, "SunoUI-ac-context")));
  SunoBarItem *first[] = {Suno_bar_item_new_chip("3 photos", NULL, FALSE)};
  SunoBarItem *second[] = {action("trash-2", NULL, "Delete")};
  Suno_action_center_show_split(SUNO_ACTION_CENTER(center), first, 1, second, 1);
  g_assert_cmpstr(last_state, ==, "split");
  g_assert_true(gtk_widget_has_css_class(center, "split"));
  g_assert_cmpint(gtk_orientable_get_orientation(GTK_ORIENTABLE(find_class(center, "SunoUI-ac-split"))), ==,
                  GTK_ORIENTATION_HORIZONTAL);
  Suno_action_center_hide_bar(SUNO_ACTION_CENTER(center));
  g_assert_false(gtk_widget_get_visible(center));

  /* Two primaries on one bar are refused. */
  SunoBarItem *a = action("check", "Done", NULL), *b = action("send", "Send", NULL);
  Suno_bar_item_set_primary(a, TRUE);
  Suno_bar_item_set_primary(b, TRUE);
  SunoBarItem *both[] = {a, b};
  g_test_expect_message(G_LOG_DOMAIN, G_LOG_LEVEL_CRITICAL, "*one primary*");
  Suno_action_center_show_bar(SUNO_ACTION_CENTER(center), both, 2, NULL);
  g_test_assert_expected_messages();

  g_object_unref(a);
  g_object_unref(b);
  g_object_unref(first[0]);
  g_object_unref(second[0]);
  g_object_unref(context);
  g_object_unref(prompt);
  g_object_unref(attach);
  g_object_unref(send_item);
  g_object_unref(send);
  g_object_unref(group);
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_no_editor(void) {
  GtkWidget *center = g_object_ref_sink(Suno_action_center_new(NULL));
  g_assert_null(Suno_action_center_get_editor(SUNO_ACTION_CENTER(center)));
  g_test_expect_message(G_LOG_DOMAIN, G_LOG_LEVEL_CRITICAL, "*nothing to grow into*");
  Suno_action_center_grow(SUNO_ACTION_CENTER(center));
  g_test_assert_expected_messages();
  GtkWidget *editor = Suno_action_editor_new("Edit", "pencil");
  GtkWidget *mode = find_class(editor, "SunoUI-ac-mode");
  g_assert_true(gtk_widget_has_css_class(mode, "static"));
  g_assert_false(gtk_widget_get_can_target(mode));
  g_assert_true(gtk_widget_has_css_class(editor, "composer"));
  GtkWidget *form = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_box_append(GTK_BOX(form), gtk_entry_new());
  Suno_action_editor_set_body(SUNO_ACTION_EDITOR(editor), form);
  g_assert_false(gtk_widget_has_css_class(editor, "composer"));
  g_assert_null(find_class(editor, "SunoUI-ac-text"));
  g_assert_null(Suno_action_editor_get_draft(SUNO_ACTION_EDITOR(editor)));
  Suno_action_editor_set_draft_summary(SUNO_ACTION_EDITOR(editor), "2 changes");
  g_autofree char *draft = Suno_action_editor_get_draft(SUNO_ACTION_EDITOR(editor));
  g_assert_cmpstr(draft, ==, "2 changes");
  g_assert_false(Suno_action_editor_run_primary(SUNO_ACTION_EDITOR(editor)));
  Suno_action_center_set_editor(SUNO_ACTION_CENTER(center), SUNO_ACTION_EDITOR(editor));
  g_assert_true(Suno_action_center_get_editor(SUNO_ACTION_CENTER(center)) == SUNO_ACTION_EDITOR(editor));
  g_object_unref(center);
}

/* Settings' display check (v70 cfKeep): a question chip, then "Go back" and the "Keep" key, words alone. */
static void test_words_alone(void) {
  SunoBarItem *back = Suno_bar_item_new_action(NULL, "Go back", NULL);
  SunoBarItem *keep = Suno_bar_item_new_action("", "Keep", NULL);
  g_assert_nonnull(back);
  Suno_bar_item_set_primary(keep, TRUE);
  GtkWidget *button = g_object_ref_sink(Suno_bar_item_create_control(back, "bar"));
  g_assert_true(gtk_widget_has_css_class(button, "text"));
  GtkWidget *child = gtk_button_get_child(GTK_BUTTON(button));
  g_assert_true(GTK_IS_LABEL(child));
  g_assert_cmpstr(gtk_label_get_label(GTK_LABEL(child)), ==, "Go back");
  GtkWidget *key = g_object_ref_sink(Suno_bar_item_create_control(keep, "bar"));
  g_assert_true(gtk_widget_has_css_class(key, "primary"));
  SunoBarItem *question = Suno_bar_item_new_context(NULL, "Keep these display settings?", NULL, FALSE);
  g_assert_nonnull(question);
  GtkWidget *center = g_object_ref_sink(Suno_action_center_new(NULL));
  SunoBarItem *items[] = {back, keep};
  Suno_action_center_show_bar(SUNO_ACTION_CENTER(center), items, 2, question);
  g_object_unref(center);
  g_object_unref(key);
  g_object_unref(button);
  g_object_unref(question);
  g_object_unref(keep);
  g_object_unref(back);
}

/* Settings' "Hidden network" sheet (v70 cfSheet): two field rows, Cancel then Join; no composer, discard or hint. */
static void test_form(void) {
  GtkWidget *window = gtk_window_new();
  GtkWidget *editor = Suno_action_editor_new("Hidden network", "wifi");
  Suno_action_editor_set_summary(SUNO_ACTION_EDITOR(editor), "Join a network that doesn’t show its name.", NULL);
  Suno_action_editor_add_field(SUNO_ACTION_EDITOR(editor), "Name", NULL);
  Suno_action_editor_add_field(SUNO_ACTION_EDITOR(editor), "Password", NULL);
  SunoBarItem *join = Suno_bar_item_new_action(NULL, "Join", NULL);
  Suno_action_editor_set_primary(SUNO_ACTION_EDITOR(editor), join);
  Suno_action_editor_set_form(SUNO_ACTION_EDITOR(editor), "Cancel");
  gtk_widget_set_size_request(editor, 720, -1);
  gtk_window_set_child(GTK_WINDOW(window), editor);
  gtk_window_present(GTK_WINDOW(window));
  for (int i = 0; i < 30; i++) {
    while (g_main_context_iteration(NULL, FALSE));
    g_usleep(4000);
  }
  g_assert_true(gtk_widget_has_css_class(editor, "form"));
  GtkWidget *footer = gtk_widget_get_last_child(editor);
  GtkWidget *primary = gtk_widget_get_last_child(footer);
  GtkWidget *cancel = gtk_widget_get_prev_sibling(primary);
  g_assert_true(gtk_widget_has_css_class(primary, "primary"));
  g_assert_true(gtk_widget_has_css_class(cancel, "SunoUI-ac-cancel"));
  g_assert_false(gtk_widget_get_visible(gtk_widget_get_first_child(footer))); /* discard */
  int visible_rows = 0;
  for (GtkWidget *child = gtk_widget_get_first_child(editor); child; child = gtk_widget_get_next_sibling(child))
    if (gtk_widget_has_css_class(child, "SunoUI-ac-field")) {
      g_assert_cmpint(gtk_widget_get_height(child), ==, 44 - 1); /* its content, above the hairline */
      visible_rows++;
    } else if (GTK_IS_SCROLLED_WINDOW(child)) {
      g_assert_false(gtk_widget_get_visible(child));
    }
  g_assert_cmpint(visible_rows, ==, 2);
  g_assert_cmpint(gtk_widget_get_height(cancel), ==, 36);
  gtk_window_destroy(GTK_WINDOW(window));
  g_object_unref(join);
}

/* ── v71: the bar grows ── */

static GtkWidget *center_window(int width, GtkWidget **content_out, GtkWidget **center_out) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), width, 700);
  GtkWidget *content = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_window_set_child(GTK_WINDOW(window), content);
  Suno_layer_host_install(GTK_WINDOW(window));
  gtk_window_present(GTK_WINDOW(window));
  spin();
  GtkWidget *center = Suno_action_center_new(NULL);
  Suno_action_center_attach(SUNO_ACTION_CENTER(center), content);
  *content_out = content;
  *center_out = center;
  return window;
}

static int panels_made;
static GtkWidget *details_panel(SunoBarItem *item G_GNUC_UNUSED, gpointer data G_GNUC_UNUSED) {
  panels_made++;
  GtkWidget *panel = Suno_bar_panel_new("Details");
  Suno_bar_panel_add_row(panel, "copy", "Copy link", NULL, FALSE);
  Suno_bar_panel_add_row(panel, "trash-2", "Move to Trash", NULL, TRUE);
  return panel;
}

static char *last_grown;
static int grown_changes;
static void grown_changed(SunoActionCenter *center G_GNUC_UNUSED, const char *key, gpointer data G_GNUC_UNUSED) {
  g_free(last_grown);
  last_grown = g_strdup(key);
  grown_changes++;
}

static GtkWidget *control_named(GtkWidget *row, const char *name) {
  for (GtkWidget *c = gtk_widget_get_first_child(row); c; c = gtk_widget_get_next_sibling(c))
    if (g_strcmp0(gtk_widget_get_tooltip_text(c), name) == 0)
      return c;
  return NULL;
}

static void test_panel_close(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(402, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  SunoBarItem *item = action("mic", "New", "New memo");
  Suno_bar_item_set_primary(item, TRUE);
  Suno_bar_item_set_keep_label(item, TRUE);
  Suno_bar_item_set_panel(item, "new", details_panel, NULL, NULL);
  Suno_bar_item_set_panel_close(item, TRUE);
  SunoBarItem *items[] = {item};
  Suno_action_center_show_bar(ac, items, 1, NULL);
  spin();
  GtkWidget *button = control_named(find_class(center, "SunoUI-ac-row"), "New memo");
  g_assert_nonnull(button);
  GtkWidget *original = gtk_button_get_child(GTK_BUTTON(button));
  for (guint i = 0; i < 3; i++) {
    if (i == 1)
      Suno_action_center_grow_panel(ac, "new", Suno_bar_panel_new("New memo"));
    else
      g_signal_emit_by_name(button, "clicked");
    spin();
    g_assert_cmpstr(Suno_action_center_get_grown(ac), ==, "new");
    g_assert_true(GTK_IS_IMAGE(gtk_button_get_child(GTK_BUTTON(button))));
    g_assert_cmpstr(gtk_widget_get_tooltip_text(button), ==, "Close");
    g_assert_false(gtk_widget_has_css_class(button, "primary"));
    g_assert_cmpint(gtk_widget_get_width(button), ==, 48);
    if (i == 1)
      Suno_action_center_fold(ac);
    else
      g_signal_emit_by_name(button, "clicked");
    spin();
    g_assert_null(Suno_action_center_get_grown(ac));
    g_assert_true(gtk_button_get_child(GTK_BUTTON(button)) == original);
    g_assert_true(gtk_widget_has_css_class(button, "primary"));
    g_assert_true(gtk_widget_has_css_class(button, "labelled"));
    g_assert_cmpstr(gtk_widget_get_tooltip_text(button), ==, "New memo");
  }
  gtk_window_destroy(GTK_WINDOW(window));
  g_object_unref(item);
}

static void test_document_toolbar_panel_width(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(402, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  SunoBarItem *items[] = {action("type", NULL, "Formatting"),
                         action("list-checks", NULL, "Checklist"),
                         action("image", NULL, "Photo"),
                         Suno_bar_item_new_rule(), action("square-pen", NULL, "New note")};
  Suno_bar_item_set_primary(items[4], TRUE);
  Suno_action_center_show_bar(ac, items, G_N_ELEMENTS(items), NULL);
  Suno_action_center_grow_panel(ac, "format", Suno_bar_panel_new("Formatting"));
  spin();
  Suno_action_center_set_toolbar(ac, TRUE);
  spin();
  GtkWidget *row = find_class(center, "SunoUI-ac-row");
  for (GtkWidget *child = gtk_widget_get_first_child(row); child; child = gtk_widget_get_next_sibling(child)) {
    if (GTK_IS_BUTTON(child)) {
      graphene_rect_t bounds;
      g_assert_true(gtk_widget_compute_bounds(child, center, &bounds));
      g_assert_cmpfloat(bounds.size.width, ==, 48);
    }
  }
  Suno_action_center_fold(ac);
  gtk_window_destroy(GTK_WINDOW(window));
  for (guint i = 0; i < G_N_ELEMENTS(items); i++)
    g_object_unref(items[i]);
}

static void test_grow(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(1000, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  SunoBarItem *items[] = {action("copy", NULL, "Copy"), action("info", NULL, "Details"), action("x", NULL, "Clear")};
  Suno_bar_item_set_panel(items[1], "details", details_panel, NULL, NULL);
  Suno_action_center_show_bar(ac, items, G_N_ELEMENTS(items), NULL);
  g_signal_connect(center, "grown-changed", G_CALLBACK(grown_changed), NULL);
  spin();
  GtkWidget *bar = find_class(center, "SunoUI-ac-bar");
  GtkWidget *row = find_class(center, "SunoUI-ac-row");
  int idle_width = gtk_widget_get_width(center);
  g_assert_cmpint(idle_width, <, 380);
  /* An idle bar's panel is there, hidden, as Python's. */
  g_assert_false(gtk_widget_get_visible(find_class(center, "SunoUI-ac-panel")));

  GtkWidget *details = control_named(row, "Details");
  g_assert_nonnull(details);
  g_signal_emit_by_name(details, "clicked");
  g_assert_cmpstr(Suno_action_center_get_grown(ac), ==, "details");
  g_assert_cmpstr(last_grown, ==, "details");
  g_assert_cmpint(panels_made, ==, 1);
  GtkWidget *panel = find_class(center, "SunoUI-ac-panel");
  g_assert_true(gtk_widget_get_visible(panel));
  g_assert_true(gtk_widget_get_parent(panel) == bar);
  g_assert_true(gtk_widget_get_first_child(bar) == panel); /* above the row, in the same glass */
  g_assert_true(gtk_widget_has_css_class(details, "on")); /* the open panel's action is the raised chip */
  g_assert_true(gtk_widget_has_css_class(center, "grown"));
  g_assert_false(gtk_widget_get_hexpand(control_named(row, "Copy"))); /* they share the width only on a phone */
  spin();
  g_assert_cmpint(gtk_widget_get_width(center), ==, 380); /* min(380, 1000 − 24) */
  g_assert_true(gtk_widget_get_visible(row)); /* the row holds */

  /* The same button again folds it. */
  g_signal_emit_by_name(details, "clicked");
  g_assert_null(Suno_action_center_get_grown(ac));
  g_assert_null(last_grown);
  g_assert_false(gtk_widget_has_css_class(details, "on"));
  g_assert_false(gtk_widget_get_visible(find_class(center, "SunoUI-ac-panel")));
  spin();
  g_assert_cmpint(gtk_widget_get_width(center), ==, idle_width);

  /* An action in the row folds an open panel; so does a panel row after it acts. */
  g_signal_emit_by_name(details, "clicked");
  g_signal_emit_by_name(control_named(row, "Copy"), "clicked");
  g_assert_null(Suno_action_center_get_grown(ac));
  g_signal_emit_by_name(details, "clicked");
  GtkWidget *panel_row = find_class(find_class(center, "SunoUI-ac-panel"), "SunoUI-panel-row");
  g_signal_emit_by_name(panel_row, "clicked");
  g_assert_null(Suno_action_center_get_grown(ac));

  /* grow_panel and fold, directly; a new bar folds an open panel. */
  Suno_action_center_grow_panel(ac, "share", Suno_bar_panel_new("Share"));
  g_assert_cmpstr(Suno_action_center_get_grown(ac), ==, "share");
  Suno_action_center_fold(ac);
  g_assert_null(Suno_action_center_get_grown(ac));
  Suno_action_center_grow_panel(ac, "share", Suno_bar_panel_new("Share"));
  Suno_action_center_show_bar(ac, items, G_N_ELEMENTS(items), NULL);
  g_assert_null(Suno_action_center_get_grown(ac));

  /* A field that is the point of the panel replaces the row, the bottom-most thing. */
  GtkWidget *to = gtk_entry_new();
  Suno_action_center_grow_entry(ac, "new", Suno_bar_panel_new("Suggestions"), to);
  GtkWidget *entry_row = gtk_widget_get_last_child(bar); /* SunoUI-ac-row.entry, the bottom-most */
  g_assert_true(gtk_widget_has_css_class(entry_row, "entry"));
  g_assert_true(gtk_widget_get_visible(entry_row));
  g_assert_false(gtk_widget_get_visible(row));
  g_assert_true(gtk_widget_get_parent(to) == entry_row);
  Suno_action_center_fold(ac);
  g_assert_true(gtk_widget_get_visible(row));
  g_assert_false(gtk_widget_get_visible(entry_row));

  /* A menu rises from the bar: sections, and a submenu as a second page with ‹ back. */
  GMenu *menu = g_menu_new();
  g_menu_append(menu, "Rename", "win.rename");
  GMenu *open_in = g_menu_new();
  g_menu_append(open_in, "Viewer", "win.open::viewer");
  g_menu_append_submenu(menu, "Open in", G_MENU_MODEL(open_in));
  Suno_action_center_grow_menu(ac, "more", G_MENU_MODEL(menu), NULL);
  g_assert_cmpstr(Suno_action_center_get_grown(ac), ==, "more");
  GtkWidget *stack = find_class(center, "SunoUI-ac-panel-content");
  g_assert_true(GTK_IS_STACK(stack));
  g_assert_cmpstr(gtk_stack_get_visible_child_name(GTK_STACK(stack)), ==, "root");
  Suno_action_center_grow_menu(ac, "more", G_MENU_MODEL(menu), NULL); /* again: folds */
  g_assert_null(Suno_action_center_get_grown(ac));
  g_object_unref(open_in);
  g_object_unref(menu);

  for (guint i = 0; i < G_N_ELEMENTS(items); i++)
    g_object_unref(items[i]);
  gtk_window_destroy(GTK_WINDOW(window));
}

/* Light dismiss: the window watches a primary press (capture phase) and Esc while the bar is rooted. */
static GtkEventController *dismiss_controller(GtkWidget *window, GType type) {
  GListModel *model = gtk_widget_observe_controllers(window);
  GtkEventController *found = NULL;
  for (guint i = 0; i < g_list_model_get_n_items(model) && found == NULL; i++) {
    GtkEventController *controller = g_list_model_get_item(model, i);
    if (G_TYPE_CHECK_INSTANCE_TYPE(controller, type) &&
        g_strcmp0(gtk_event_controller_get_name(controller), "SunoUI-light-dismiss") == 0)
      found = controller;
    g_object_unref(controller);
  }
  g_object_unref(model);
  return found;
}

static int field_commits;
static void field_left(GtkEventControllerFocus *focus G_GNUC_UNUSED, gpointer data G_GNUC_UNUSED) { field_commits++; }

static void test_light_dismiss(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(1000, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  GtkWidget *canvas = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_vexpand(canvas, TRUE);
  gtk_box_append(GTK_BOX(content), canvas);
  SunoBarItem *items[] = {action("info", NULL, "Details")};
  Suno_bar_item_set_panel(items[0], "details", details_panel, NULL, NULL);
  Suno_action_center_show_bar(ac, items, G_N_ELEMENTS(items), NULL);
  spin();
  GtkEventController *press = dismiss_controller(window, GTK_TYPE_GESTURE_CLICK);
  GtkEventController *keys = dismiss_controller(window, GTK_TYPE_EVENT_CONTROLLER_KEY);
  g_assert_nonnull(press);
  g_assert_nonnull(keys);
  g_assert_cmpint(gtk_event_controller_get_propagation_phase(press), ==, GTK_PHASE_CAPTURE);
  g_assert_cmpuint(gtk_gesture_single_get_button(GTK_GESTURE_SINGLE(press)), ==, GDK_BUTTON_PRIMARY);
  graphene_rect_t where;
  g_assert_true(gtk_widget_compute_bounds(canvas, window, &where));
  double x = where.origin.x + where.size.width / 2, y = where.origin.y + where.size.height / 2;

  /* A panel with a field: a press inside keeps it, a press outside folds it and the field commits. */
  GtkWidget *panel = Suno_bar_panel_new("Style");
  GtkWidget *field = gtk_entry_new();
  GtkEventController *focus = gtk_event_controller_focus_new();
  g_signal_connect(focus, "leave", G_CALLBACK(field_left), NULL);
  gtk_widget_add_controller(field, focus);
  gtk_box_append(GTK_BOX(panel), field);
  Suno_action_center_grow_panel(ac, "style", panel);
  spin();
  gtk_widget_grab_focus(field);
  graphene_rect_t bar;
  g_assert_true(gtk_widget_compute_bounds(find_class(center, "SunoUI-ac-bar"), window, &bar));
  g_signal_emit_by_name(press, "pressed", 1, (double)(bar.origin.x + bar.size.width / 2),
                        (double)(bar.origin.y + bar.size.height / 2));
  g_assert_cmpstr(Suno_action_center_get_grown(ac), ==, "style");
  int before = field_commits;
  g_signal_emit_by_name(press, "pressed", 1, x, y);
  g_assert_null(Suno_action_center_get_grown(ac));
  g_assert_cmpint(field_commits, >, before);

  /* Esc anywhere folds a grown bar; at rest it is not taken. */
  gboolean handled = FALSE;
  Suno_action_center_grow_panel(ac, "share", Suno_bar_panel_new("Share"));
  g_signal_emit_by_name(keys, "key-pressed", GDK_KEY_Escape, 0, 0, &handled);
  g_assert_true(handled);
  g_assert_null(Suno_action_center_get_grown(ac));
  handled = TRUE;
  g_signal_emit_by_name(keys, "key-pressed", GDK_KEY_Escape, 0, 0, &handled);
  g_assert_false(handled);

  /* The editor folds the same way. */
  GtkWidget *editor = Suno_action_editor_new("Reply", "reply");
  Suno_action_center_set_editor(ac, SUNO_ACTION_EDITOR(editor));
  Suno_action_center_grow(ac);
  g_assert_cmpstr(Suno_action_center_get_state(ac), ==, "editor");
  g_signal_emit_by_name(press, "pressed", 1, x, y);
  g_assert_cmpstr(Suno_action_center_get_state(ac), ==, "bar");

  /* An editor that works on content in place keeps it: a press or Esc on its target is part of the edit. */
  GtkWidget *photo = gtk_entry_new(); /* stands for Photos' viewport, focusable while cropping */
  gtk_box_prepend(GTK_BOX(content), photo);
  GtkWidget *edit = Suno_action_editor_new("Edit", "sliders-horizontal");
  Suno_action_editor_set_target(SUNO_ACTION_EDITOR(edit), photo);
  g_assert_true(Suno_action_editor_get_target(SUNO_ACTION_EDITOR(edit)) == photo);
  Suno_action_center_set_editor(ac, SUNO_ACTION_EDITOR(edit));
  Suno_action_center_grow(ac);
  spin();
  graphene_rect_t on;
  g_assert_true(gtk_widget_compute_bounds(photo, window, &on));
  GtkWidget *hit = gtk_widget_pick(window, on.origin.x + on.size.width / 2, on.origin.y + on.size.height / 2,
                                   GTK_PICK_DEFAULT);
  g_assert_true(hit == photo || gtk_widget_is_ancestor(hit, photo));
  g_signal_emit_by_name(press, "pressed", 1, (double)(on.origin.x + on.size.width / 2),
                        (double)(on.origin.y + on.size.height / 2));
  g_assert_cmpstr(Suno_action_center_get_state(ac), ==, "editor");
  gtk_widget_grab_focus(photo);
  handled = TRUE;
  g_signal_emit_by_name(keys, "key-pressed", GDK_KEY_Escape, 0, 0, &handled);
  g_assert_false(handled);
  g_assert_cmpstr(Suno_action_center_get_state(ac), ==, "editor");
  g_signal_emit_by_name(press, "pressed", 1, x, y);
  g_assert_cmpstr(Suno_action_center_get_state(ac), ==, "bar");
  gtk_box_remove(GTK_BOX(content), photo);

  /* Unrooted, the window no longer carries the bar's controllers. */
  gtk_overlay_remove_overlay(GTK_OVERLAY(gtk_widget_get_parent(center)), center);
  g_assert_null(dismiss_controller(window, GTK_TYPE_GESTURE_CLICK));
  g_assert_null(dismiss_controller(window, GTK_TYPE_EVENT_CONTROLLER_KEY));
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_phone(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(400, &content, &center);
  if (gtk_widget_get_width(window) >= SUNO_TIER_PHONE_BELOW) {
    g_test_skip("the display did not give a phone-width window");
    gtk_window_destroy(GTK_WINDOW(window));
    return;
  }
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  SunoBarItem *items[] = {
      action("search", "Search", NULL),     action("folder-plus", "New folder", NULL),
      action("copy", "Copy", NULL),         action("share-2", "Share", NULL),
      action("move", "Move", NULL),         action("info", "Details", NULL),
      action("pencil", "Rename", NULL),     action("archive", "Compress", NULL),
      action("trash-2", "Delete", NULL),    Suno_bar_item_new_action("check", "Done", NULL),
  };
  /* Adjacent formatting actions must remain reachable when their entire
   * recessed group moves into the phone overflow panel. */
  for (guint i=3;i<9;i++) Suno_bar_item_set_group(items[i], "Grouped tools");
  Suno_bar_item_set_primary(items[9], TRUE);
  Suno_bar_item_set_keep_label(items[9], TRUE);
  Suno_bar_item_set_danger(items[8], TRUE);
  Suno_action_center_show_bar(ac, items, G_N_ELEMENTS(items), NULL);
  spin();
  spin();
  g_assert_true(gtk_widget_has_css_class(center, "phone"));
  GtkWidget *row = find_class(center, "SunoUI-ac-row");
  /* Icons only on a phone; the labelled primary keeps its words. */
  for (GtkWidget *c = gtk_widget_get_first_child(row); c; c = gtk_widget_get_next_sibling(c)) {
    if (!gtk_widget_has_css_class(c, "SunoUI-bar-button"))
      continue;
    g_assert_cmpint(gtk_widget_get_height(c) >= 48 || !gtk_widget_get_visible(c), ==, TRUE);
    if (gtk_widget_has_css_class(c, "primary"))
      g_assert_false(gtk_widget_has_css_class(c, "glyph-only")); /* it keeps its label */
    else if (gtk_widget_has_css_class(c, "labelled"))
      g_assert_true(gtk_widget_has_css_class(c, "glyph-only"));
  }
  /* Too many for the width: the rest go in ⋯, before the primary; the first control and the primary stay. */
  GtkWidget *more = control_named(row, "More");
  g_assert_nonnull(more);
  g_assert_true(gtk_widget_has_css_class(gtk_widget_get_next_sibling(more), "primary"));
  g_assert_true(gtk_widget_get_visible(gtk_widget_get_first_child(row)));
  g_assert_cmpint(gtk_widget_get_width(center), <=, 400 - 24);
  g_signal_emit_by_name(more, "clicked");
  g_assert_cmpstr(Suno_action_center_get_grown(SUNO_ACTION_CENTER(center)), ==, "more");
  GtkWidget *panel = find_class(find_class(center, "SunoUI-ac-panel"), "SunoUI-panel-list");
  int rows = 0;
  GtkWidget *last = NULL;
  for (GtkWidget *c = gtk_widget_get_first_child(panel); c; c = gtk_widget_get_next_sibling(c))
    if (gtk_widget_has_css_class(c, "SunoUI-panel-row")) {
      rows++;
      last = c;
    }
  g_assert_cmpint(rows, >=, 6); /* every grouped member stays available */
  g_assert_true(gtk_widget_has_css_class(last, "danger")); /* the destructive row goes last */
  spin();
  /* Grown on a phone: the full width less 16 a side. */
  g_assert_cmpint(gtk_widget_get_width(center), ==, gtk_widget_get_width(content) - 32);
  Suno_action_center_fold(ac);
  Suno_action_center_show_bar(ac, items, 1, NULL);
  Suno_action_center_set_phone_wide(ac, TRUE);
  spin();
  g_assert_cmpint(gtk_widget_get_width(center), ==, gtk_widget_get_width(content) - 32);
  Suno_action_center_set_phone_wide(ac, FALSE);
  spin();
  g_assert_cmpint(gtk_widget_get_width(center), <, gtk_widget_get_width(content) - 32);
  for (guint i = 0; i < G_N_ELEMENTS(items); i++)
    g_object_unref(items[i]);
  gtk_window_destroy(GTK_WINDOW(window));
}

static int releases;
static void test_hold(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(1000, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  SunoBarItem *items[] = {action("copy", NULL, "Copy")};
  Suno_action_center_show_bar(ac, items, 1, NULL);
  g_signal_connect(center, "released", G_CALLBACK(count), &releases);
  Suno_action_center_hold(ac, "Moving", "Budget.xlsx", NULL, NULL);
  g_assert_true(Suno_action_center_get_holding(ac));
  GtkWidget *hold = find_class(center, "SunoUI-ac-hold");
  g_assert_true(gtk_widget_get_visible(hold));
  g_assert_cmpstr(gtk_label_get_label(GTK_LABEL(find_class(hold, "SunoUI-ac-hold-kind"))), ==, "MOVING");
  GtkWidget *ask = find_class(center, "SunoUI-ac-where-prompt");
  g_assert_cmpstr(gtk_label_get_label(GTK_LABEL(ask)), ==, "Where are we moving this?");
  g_assert_false(gtk_widget_get_visible(find_class(center, "SunoUI-ac-row")));
  SunoBarItem *here = Suno_bar_item_new_action(NULL, "Move here", NULL);
  Suno_action_center_set_hold_target(ac, "Move to", "Documents", "folder", here);
  g_assert_null(find_class(center, "SunoUI-ac-where-prompt"));
  GtkWidget *where = find_class(center, "SunoUI-ac-where");
  g_assert_nonnull(find_class(where, "primary"));
  g_assert_nonnull(find_class(where, "keep-label"));
  /* The bar shows across views: a new bar keeps the held row. */
  Suno_action_center_show_bar(ac, items, 1, NULL);
  g_assert_true(Suno_action_center_get_holding(ac));
  spin();
  g_assert_cmpint(gtk_widget_get_width(center), ==, 380);
  /* ✕ lets go. */
  GtkWidget *let_go = g_object_get_data(G_OBJECT(hold), "SunoUI-let-go");
  g_signal_emit_by_name(let_go, "clicked");
  g_assert_cmpint(releases, ==, 1);
  g_assert_false(Suno_action_center_get_holding(ac));
  g_assert_false(gtk_widget_get_visible(find_class(center, "SunoUI-ac-hold")));
  g_assert_true(gtk_widget_get_visible(find_class(center, "SunoUI-ac-row")));
  g_object_unref(here);
  g_object_unref(items[0]);
  gtk_window_destroy(GTK_WINDOW(window));
}

static char *v71_searched;
static void v71_search_changed(SunoBarItem *item G_GNUC_UNUSED, const char *text, gpointer data G_GNUC_UNUSED) {
  g_free(v71_searched);
  v71_searched = g_strdup(text);
}

static void test_search(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(1000, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  /* The released persistent search item (platform .89), made v71's collapsed glyph. */
  SunoBarItem *search = Suno_bar_item_new_search("Search");
  Suno_bar_item_search_set_collapsed(search, TRUE);
  g_assert_cmpint(Suno_bar_item_get_kind(search), ==, SUNO_BAR_ITEM_SEARCH);
  g_signal_connect(search, "search-changed", G_CALLBACK(v71_search_changed), NULL);
  SunoBarItem *items[] = {search, action("plus", NULL, "Add")};
  Suno_action_center_show_bar(ac, items, 2, NULL);
  spin();
  GtkWidget *row = find_class(center, "SunoUI-ac-row");
  GtkWidget *host = find_class(row, "SunoUI-bar-search-host");
  g_assert_nonnull(host);
  g_assert_true(gtk_widget_has_css_class(host, "folded")); /* a glyph at every width while empty */
  /* Pressed, the bar turns into the field in place: the bottom-most row, with ✕. */
  GtkWidget *glyph = gtk_stack_get_visible_child(GTK_STACK(host));
  g_signal_emit_by_name(glyph, "clicked");
  GtkWidget *entry_row = gtk_widget_get_last_child(find_class(center, "SunoUI-ac-bar"));
  g_assert_true(gtk_widget_get_visible(entry_row));
  g_assert_true(gtk_widget_get_parent(host) == entry_row);
  g_assert_false(gtk_widget_get_visible(row));
  g_assert_false(gtk_widget_has_css_class(host, "folded"));
  GtkWidget *entry = find_class(host, "SunoUI-bar-search");
  g_assert_cmpstr(gtk_search_entry_get_placeholder_text(GTK_SEARCH_ENTRY(entry)), ==, "Search");
  GtkWidget *search_icon = gtk_widget_get_first_child(entry);
  g_assert_true(GTK_IS_IMAGE(search_icon));
  g_autofree char *expected_icon = Suno_ui_icon_name("search");
  g_assert_cmpstr(gtk_image_get_icon_name(GTK_IMAGE(search_icon)), ==, expected_icon);
  gtk_editable_set_text(GTK_EDITABLE(entry), "budget");
  g_assert_cmpstr(v71_searched, ==, "budget");
  g_assert_cmpstr(Suno_bar_item_search_get_text(search), ==, "budget");
  /* ✕ closes it: the field clears, the row comes back with the glyph in its place. */
  GtkWidget *close = control_named(entry_row, "Close search");
  g_assert_nonnull(close);
  g_signal_emit_by_name(close, "clicked");
  g_assert_cmpstr(v71_searched, ==, "");
  g_assert_true(gtk_widget_get_visible(row));
  g_assert_true(gtk_widget_get_parent(host) == row);
  g_assert_true(gtk_widget_get_first_child(row) == host);
  g_assert_false(gtk_widget_get_visible(entry_row));
  g_assert_true(gtk_widget_has_css_class(host, "folded"));
  /* The released default (not collapsed): a field that stays in the row at desktop width. */
  SunoBarItem *keep = Suno_bar_item_new_search("Search files");
  SunoBarItem *kept[] = {keep, action("plus", NULL, "Add")};
  Suno_action_center_show_bar(ac, kept, 2, NULL);
  GtkWidget *kept_host = find_class(find_class(center, "SunoUI-ac-row"), "SunoUI-bar-search-host");
  g_assert_nonnull(kept_host);
  g_assert_false(gtk_widget_has_css_class(kept_host, "folded"));
  g_object_unref(keep);
  g_object_unref(kept[1]);
  g_object_unref(items[1]);
  g_object_unref(search);
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_safe_area(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(1000, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  GtkWidget *scroller = gtk_scrolled_window_new();
  gtk_widget_set_vexpand(scroller, TRUE);
  GtkWidget *list = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  for (int i = 0; i < 60; i++)
    gtk_box_append(GTK_BOX(list), gtk_label_new("A line"));
  gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroller), list);
  gtk_box_append(GTK_BOX(content), scroller);
  Suno_action_center_attach_scroller(ac, GTK_SCROLLED_WINDOW(scroller));
  SunoBarItem *items[] = {action("copy", NULL, "Copy")};
  Suno_action_center_show_bar(ac, items, 1, NULL);
  spin();
  graphene_rect_t bar, box;
  GtkWidget *host = GTK_WIDGET(Suno_layer_host_window_host(content));
  g_assert_true(gtk_widget_compute_bounds(center, host, &bar));
  g_assert_true(gtk_widget_compute_bounds(scroller, host, &box));
  int expected = (int)(box.origin.y + box.size.height - bar.origin.y + 0.5f) + 20;
  g_assert_cmpint(gtk_widget_get_margin_bottom(list), ==, expected);
  /* A grown panel floats over the page: the room stays the row's. */
  Suno_action_center_grow_panel(ac, "details", Suno_bar_panel_new("Details"));
  spin();
  g_assert_cmpint(gtk_widget_get_margin_bottom(list), ==, expected);
  /* Only a showing bar counts. */
  Suno_action_center_hide_bar(ac);
  spin();
  g_assert_cmpint(gtk_widget_get_margin_bottom(list), ==, 0);
  g_object_unref(items[0]);
  gtk_window_destroy(GTK_WINDOW(window));
}

/* v71 panel parts, the foot, a sheet, SharePanel, panel-changed. */
static char *panel_key, *share_choice, *share_person;
static void panel_changed(SunoActionCenter *c G_GNUC_UNUSED, const char *key, gpointer d G_GNUC_UNUSED) {
  g_free(panel_key);
  panel_key = g_strdup(key);
}
static void shared(SunoSharePanel *p G_GNUC_UNUSED, const char *choice, const char *person, gpointer d G_GNUC_UNUSED) {
  g_free(share_choice);
  g_free(share_person);
  share_choice = g_strdup(choice);
  share_person = g_strdup(person);
}

static void test_parts(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(1000, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  SunoBarItem *items[] = {action("share-2", NULL, "Share")};
  Suno_action_center_show_bar(ac, items, 1, NULL);
  g_signal_connect(center, "panel-changed", G_CALLBACK(panel_changed), NULL);
  const char *people[] = {"Priya Raman", "Nora Lind", NULL};
  GtkWidget *share = Suno_share_panel_new(NULL, people);
  g_signal_connect(share, "chosen", G_CALLBACK(shared), NULL);
  Suno_action_center_grow_panel(ac, "share", share);
  g_assert_cmpstr(panel_key, ==, "share");
  GtkWidget *person = find_class(share, "SunoUI-share-panel-person");
  g_signal_emit_by_name(person, "clicked");
  g_assert_cmpstr(share_choice, ==, "send-to");
  g_assert_cmpstr(share_person, ==, "Priya Raman");
  g_assert_cmpstr(panel_key, ==, ""); /* it folded */
  /* Tiles and choices. */
  GtkWidget *panel = Suno_bar_panel_new("View as");
  GtkWidget *tiles = Suno_bar_tiles_new(2, FALSE, FALSE);
  Suno_bar_tiles_add(tiles, "layout-grid", "Grid", NULL, TRUE, FALSE);
  GtkWidget *list = Suno_bar_tiles_add(tiles, "list", "List", NULL, FALSE, FALSE);
  gtk_box_append(GTK_BOX(panel), tiles);
  GtkWidget *choices = Suno_panel_choices_new(NULL);
  Suno_panel_choices_add(choices, "name", "Name", NULL);
  Suno_panel_choices_add(choices, "date", "Date", NULL);
  Suno_panel_choices_set_decoration(choices, "name", "arrow-up");
  Suno_panel_choices_set_document_style(choices, TRUE);
  g_assert_true(gtk_box_get_homogeneous(GTK_BOX(choices)));
  g_assert_true(gtk_widget_get_hexpand(gtk_widget_get_first_child(choices)));
  Suno_panel_choices_set_document_style(choices, FALSE);
  g_assert_false(gtk_box_get_homogeneous(GTK_BOX(choices)));
  g_assert_false(gtk_widget_get_hexpand(gtk_widget_get_first_child(choices)));
  gtk_box_append(GTK_BOX(panel), choices);
  g_assert_true(gtk_widget_has_css_class(gtk_widget_get_first_child(choices), "on"));
  g_signal_emit_by_name(gtk_widget_get_last_child(choices), "clicked");
  g_assert_true(gtk_widget_has_css_class(gtk_widget_get_last_child(choices), "on"));
  Suno_action_center_grow_panel(ac, "view", panel);
  g_signal_emit_by_name(gtk_widget_get_last_child(choices), "clicked");
  g_assert_cmpstr(Suno_action_center_get_grown(ac), ==, "view"); /* a choice leaves it open */
  g_signal_emit_by_name(list, "clicked");
  g_assert_null(Suno_action_center_get_grown(ac)); /* a tile folds it */
  GtkWidget *row = Suno_bar_panel_add_row(Suno_bar_panel_new(NULL), "folder", "Home", NULL, FALSE);
  Suno_bar_panel_row_set_state(row, FALSE, TRUE);
  g_assert_true(gtk_widget_has_css_class(row, "current"));
  /* The two-row foot, and a sheet. */
  GtkWidget *field = gtk_entry_new();
  Suno_action_center_set_foot(ac, field);
  GtkWidget *foot = find_class(center, "SunoUI-ac-foot");
  g_assert_true(gtk_widget_get_visible(foot));
  g_assert_true(gtk_widget_get_parent(field) == foot);
  Suno_action_center_set_foot(ac, NULL);
  g_assert_false(gtk_widget_get_visible(foot));
  SunoModalHandle *sheet = Suno_action_center_sheet(ac, gtk_label_new("form"), "Add a provider");
  g_assert_nonnull(sheet);
  g_assert_true(gtk_widget_has_css_class(Suno_modal_handle_get_card(sheet), "SunoUI-bar-frame"));
  Suno_modal_handle_close(sheet);
  spin();
  g_object_unref(items[0]);
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_compact_picker(void) {
  SunoBarItem *item = Suno_bar_item_new_action("image", "Library", NULL);
  Suno_bar_item_set_dropdown(item, TRUE, TRUE);
  GtkWidget *control = g_object_ref_sink(Suno_bar_item_create_control(item, "bar"));
  g_assert_true(gtk_widget_has_css_class(control, "compact-picker"));
  g_assert_true(gtk_widget_has_css_class(control, "keep-label"));
  GtkWidget *line = gtk_button_get_child(GTK_BUTTON(control));
  g_assert_cmpstr(gtk_image_get_icon_name(GTK_IMAGE(gtk_widget_get_last_child(line))), ==, "SunoUI-chevron-down-symbolic");
  g_object_unref(control);
  g_object_unref(item);
}

static void test_bar_bottom(void) {
  GtkWidget *window = gtk_window_new();
  gtk_window_set_default_size(GTK_WINDOW(window), 600, 420);
  GtkWidget *content = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_window_set_child(GTK_WINDOW(window), content);
  SunoLayerHost *host = Suno_layer_host_install(GTK_WINDOW(window));
  GtkWidget *center = Suno_action_center_new(NULL);
  Suno_action_center_set_bar_bottom(SUNO_ACTION_CENTER(center), 16);
  Suno_action_center_attach(SUNO_ACTION_CENTER(center), content);
  SunoBarItem *icon = action("check", NULL, "Confirm");
  SunoBarItem *items[] = {icon};
  Suno_action_center_show_bar(SUNO_ACTION_CENTER(center), items, 1, NULL);
  gtk_window_present(GTK_WINDOW(window));
  spin();
  graphene_rect_t bounds;
  g_assert_true(gtk_widget_compute_bounds(center, GTK_WIDGET(host), &bounds));
  g_assert_cmpint((int)(bounds.origin.y + bounds.size.height), ==,
                  gtk_widget_get_height(GTK_WIDGET(host)) - 16);
  GtkWidget *button = find_class(center, "SunoUI-bar-button");
  g_assert_cmpint(gtk_widget_get_width(button), ==, 36);
  g_assert_cmpint(gtk_widget_get_height(button), ==, 36);

  SunoBarItem *format = action("chevron-down", "Currency", NULL);
  Suno_bar_item_set_icon_trailing(format, TRUE);
  SunoBarItem *align[3] = {
    action("text-align-start", NULL, "Left"),
    action("text-align-center", NULL, "Centre"),
    action("text-align-end", NULL, "Right"),
  };
  for (guint i = 0; i < 3; i++)
    Suno_bar_item_set_group(align[i], "Align");
  SunoBarItem *grouped[] = {format, align[0], align[1], align[2]};
  Suno_action_center_show_bar(SUNO_ACTION_CENTER(center), grouped, G_N_ELEMENTS(grouped), NULL);
  spin();
  GtkWidget *format_control = gtk_widget_get_first_child(find_class(center, "SunoUI-ac-row"));
  GtkWidget *line = gtk_button_get_child(GTK_BUTTON(format_control));
  g_assert_true(GTK_IS_LABEL(gtk_widget_get_first_child(line)));
  GtkWidget *group = find_class(center, "SunoUI-bar-group");
  g_assert_nonnull(group);
  g_assert_cmpint(gtk_accessible_get_accessible_role(GTK_ACCESSIBLE(group)), ==, GTK_ACCESSIBLE_ROLE_GROUP);
  g_assert_cmpint(gtk_widget_get_width(group), >=, 126);
  for (GtkWidget *child = gtk_widget_get_first_child(group); child; child = gtk_widget_get_next_sibling(child))
    g_assert_cmpint(gtk_widget_get_width(child), ==, 42);
  g_object_unref(format);
  for (guint i = 0; i < 3; i++) g_object_unref(align[i]);
  g_object_unref(icon);
  gtk_window_destroy(GTK_WINDOW(window));
}

static void test_spacer_preserves_navigation_width(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(402, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  SunoBarItem *items[] = {action("chevron-left", "Thursday", "Back"),
                         Suno_bar_item_new_spacer(), action("x", NULL, "Close")};
  Suno_bar_item_set_keep_label(items[0], TRUE);
  Suno_action_center_show_bar(ac, items, 3, NULL);
  spin();
  GtkWidget *back = Suno_action_center_get_bar_control(ac, 0);
  int width = gtk_widget_get_width(back);
  Suno_action_center_grow_panel(ac, "details", Suno_bar_panel_new("Details"));
  spin();
  g_assert_false(gtk_widget_get_hexpand(back));
  g_assert_cmpint(gtk_widget_get_width(back), ==, width);
  g_assert_cmpint(width, <, 150);
  gtk_window_destroy(GTK_WINDOW(window));
  for (guint i = 0; i < 3; i++) g_object_unref(items[i]);
}

static void test_phone_grown_inset(void) {
  GtkWidget *content, *center;
  GtkWidget *window = center_window(402, &content, &center);
  SunoActionCenter *ac = SUNO_ACTION_CENTER(center);
  SunoBarItem *items[] = {action("info", NULL, "Details")};
  Suno_action_center_show_bar(ac, items, 1, NULL);
  spin();
  int resting = gtk_widget_get_width(center);
  g_assert_cmpint(Suno_action_center_get_phone_grown_inset(ac), ==, -1);
  Suno_action_center_grow_panel(ac, "details", Suno_bar_panel_new("Details"));
  spin();
  g_assert_cmpint(gtk_widget_get_width(center), ==, 370);
  Suno_action_center_set_phone_grown_inset(ac, 20);
  spin();
  g_assert_cmpint(gtk_widget_get_width(center), ==, 362);
  Suno_action_center_set_phone_grown_inset(ac, 16);
  const int widths[] = {720, 1180, 360, 402};
  for (guint i = 0; i < G_N_ELEMENTS(widths); i++) {
    gtk_window_set_default_size(GTK_WINDOW(window), widths[i], 700);
    spin();
    g_assert_cmpint(gtk_widget_get_width(center), ==, widths[i] < 560 ? widths[i] - 32 : 380);
  }
  Suno_action_center_fold(ac);
  spin();
  g_assert_cmpint(gtk_widget_get_width(center), ==, resting);
  Suno_action_center_set_phone_grown_inset(ac, -1);
  g_assert_cmpint(Suno_action_center_get_phone_grown_inset(ac), ==, -1);
  gtk_window_destroy(GTK_WINDOW(window));
  g_object_unref(items[0]);
}

static void test_square_chip_preview(void) {
  const int widths[] = {1000, 400};
  for (guint i = 0; i < G_N_ELEMENTS(widths); i++) {
    GtkWidget *window = gtk_window_new();
    gtk_window_set_default_size(GTK_WINDOW(window), widths[i], 500);
    GtkWidget *host = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
    gtk_window_set_child(GTK_WINDOW(window), host);
    SunoActionCenter *center = SUNO_ACTION_CENTER(Suno_action_center_new(NULL));
    Suno_action_center_attach(center, host);
    SunoBarItem *chip = Suno_bar_item_new_chip("Camera", "app-window", TRUE);
    GdkPaintable *portrait = gdk_paintable_new_empty(100, 300);
    Suno_bar_item_chip_set_paintable(chip, portrait);
    g_object_unref(portrait);
    SunoBarItem *items[] = {chip};
    Suno_action_center_show_bar(center, items, 1, NULL);
    gtk_window_present(GTK_WINDOW(window));
    spin();
    GtkWidget *preview = find_class(GTK_WIDGET(center), "SunoUI-bar-chip-preview");
    g_assert_nonnull(preview);
    g_assert_cmpint(gtk_widget_get_width(preview), ==, 28);
    g_assert_cmpint(gtk_widget_get_height(preview), ==, 28);
    gtk_window_destroy(GTK_WINDOW(window));
    g_object_unref(chip);
  }
}

/* The editor focuses its first field with the text selected; a hidden body takes no room; Esc to cancel. */
static void test_editor_focus_and_empty_body(void) {
  GtkWidget *window = gtk_window_new();
  GtkWidget *editor = Suno_action_editor_new("Rename", "pencil");
  GtkWidget *entry = gtk_entry_new();
  gtk_editable_set_text(GTK_EDITABLE(entry), "Camera");
  Suno_action_editor_add_field(SUNO_ACTION_EDITOR(editor), "Name", entry);
  Suno_action_editor_add_field(SUNO_ACTION_EDITOR(editor), "Note", NULL);
  GtkWidget *body = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_visible(body, FALSE);
  Suno_action_editor_set_body(SUNO_ACTION_EDITOR(editor), body);
  gtk_window_set_child(GTK_WINDOW(window), editor);
  gtk_window_present(GTK_WINDOW(window));
  spin();
  g_assert_true(gtk_widget_has_css_class(editor, "bodyless"));
  g_assert_false(gtk_widget_get_visible(gtk_widget_get_parent(gtk_widget_get_parent(body))) &&
                 gtk_widget_get_visible(body));
  Suno_action_editor_focus_content(SUNO_ACTION_EDITOR(editor));
  int start = -1, end = -1;
  g_assert_true(gtk_widget_has_focus(entry) || gtk_widget_is_ancestor(gtk_root_get_focus(GTK_ROOT(window)), entry));
  g_assert_true(gtk_editable_get_selection_bounds(GTK_EDITABLE(entry), &start, &end));
  g_assert_cmpint(start, ==, 0);
  g_assert_cmpint(end, ==, 6);
  gtk_widget_set_visible(body, TRUE);
  g_assert_false(gtk_widget_has_css_class(editor, "bodyless"));
  gtk_window_destroy(GTK_WINDOW(window));
}

int main(int argc, char **argv) {
  g_test_init(&argc, &argv, NULL);
  if (!gtk_init_check())
    return 77;
  Suno_ui_install();
  g_test_add_func("/SunoUI/action-center/items", test_items);
  g_test_add_func("/SunoUI/action-center/editor-focus-empty-body", test_editor_focus_and_empty_body);
  g_test_add_func("/SunoUI/action-center/square-chip-preview", test_square_chip_preview);
  g_test_add_func("/SunoUI/action-center/phone-grown-inset", test_phone_grown_inset);
  g_test_add_func("/SunoUI/action-center/spacer-navigation", test_spacer_preserves_navigation_width);
  g_test_add_func("/SunoUI/action-center/compact-picker", test_compact_picker);
  g_test_add_func("/SunoUI/action-center/center", test_center);
  g_test_add_func("/SunoUI/action-center/no-editor", test_no_editor);
  g_test_add_func("/SunoUI/action-center/words-alone", test_words_alone);
  g_test_add_func("/SunoUI/action-center/search-modes", test_search_and_modes);
  g_test_add_func("/SunoUI/action-center/search-phone", test_search_phone_fold);
  g_test_add_func("/SunoUI/action-center/retired-search", test_retired_search);
  g_test_add_func("/SunoUI/action-center/form", test_form);
  g_test_add_func("/SunoUI/action-center/grow", test_grow);
  g_test_add_func("/SunoUI/action-center/light-dismiss", test_light_dismiss);
  g_test_add_func("/SunoUI/action-center/panel-close", test_panel_close);
  g_test_add_func("/SunoUI/action-center/document-toolbar-panel-width", test_document_toolbar_panel_width);
  g_test_add_func("/SunoUI/action-center/phone", test_phone);
  g_test_add_func("/SunoUI/action-center/hold", test_hold);
  g_test_add_func("/SunoUI/action-center/search", test_search);
  g_test_add_func("/SunoUI/action-center/safe-area", test_safe_area);
  g_test_add_func("/SunoUI/action-center/parts", test_parts);
  g_test_add_func("/SunoUI/action-center/bar-bottom", test_bar_bottom);
  return g_test_run();
}
