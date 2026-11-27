/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-semantics.h"
#include <glib.h>

static void test_action_risk(void) {
  g_autoptr(SunoAction) action =
      Suno_action_new("document.delete", "Delete document");
  g_assert_false(Suno_action_get_requires_confirmation(action));
  Suno_action_set_risk(action, SUNO_ACTION_RISK_DESTRUCTIVE);
  g_assert_true(Suno_action_get_requires_confirmation(action));
  g_autoptr(GVariant) value = Suno_action_to_variant(action);
  const char *risk = NULL;
  g_assert_true(g_variant_lookup(value, "enabled", "b", NULL));
  g_assert_true(g_variant_lookup(value, "risk", "&s", &risk));
  g_assert_cmpstr(risk, ==, "destructive");
}

static void test_object_graph(void) {
  g_autoptr(SunoSemanticObject) root =
      Suno_semantic_object_new("notes", "application", "Notes");
  g_autoptr(SunoSemanticObject) note =
      Suno_semantic_object_new("note-1", "document", "Project plan");
  g_autoptr(SunoAction) open = Suno_action_new("note.open", "Open note");
  Suno_semantic_object_add_action(note, open);
  Suno_semantic_object_add_child(root, note);
  g_assert_cmpuint(
      g_list_model_get_n_items(Suno_semantic_object_get_children(root)), ==, 1);
  g_assert_cmpuint(
      g_list_model_get_n_items(Suno_semantic_object_get_actions(note)), ==, 1);
  g_autoptr(GVariant) serialized = Suno_semantic_object_to_variant(root);
  g_autoptr(GVariant) children =
      g_variant_lookup_value(serialized, "children", G_VARIANT_TYPE("aa{sv}"));
  g_assert_nonnull(children);
  g_assert_cmpuint(g_variant_n_children(children), ==, 1);
}

static void test_live_extension_action_limit(void) {
  g_autoptr(SunoLiveExtension) live =
      Suno_live_extension_new("call-1", "org.projectSuno.Calendar",
                              SUNO_LIVE_CATEGORY_CALL, "Design review");
  Suno_live_extension_set_starts_at(live, "2026-08-27T12:00:00+00:00");
  Suno_live_extension_set_expires_at(live, "2026-08-27T13:00:00+00:00");
  for (guint i = 0; i < 3; i++) {
    g_autofree char *id = g_strdup_printf("call.action-%u", i);
    g_autoptr(SunoAction) action = Suno_action_new(id, "Action");
    g_assert_true(Suno_live_extension_add_action(live, action, NULL));
  }
  g_autoptr(SunoAction) fourth = Suno_action_new("call.fourth", "Fourth");
  g_autoptr(GError) error = NULL;
  g_assert_false(Suno_live_extension_add_action(live, fourth, &error));
  g_assert_error(error, G_IO_ERROR, G_IO_ERROR_NO_SPACE);
  g_autoptr(GVariant) serialized = Suno_live_extension_to_variant(live);
  const char *app_id = NULL;
  const char *category = NULL;
  const char *expires_at = NULL;
  g_assert_true(g_variant_lookup(serialized, "app_id", "&s", &app_id));
  g_assert_true(g_variant_lookup(serialized, "category", "&s", &category));
  g_assert_true(g_variant_lookup(serialized, "expires_at", "&s", &expires_at));
  g_assert_cmpstr(app_id, ==, "org.projectSuno.Calendar");
  g_assert_cmpstr(category, ==, "call");
  g_assert_cmpstr(expires_at, ==, "2026-08-27T13:00:00+00:00");
}

int main(int argc, char **argv) {
  g_test_init(&argc, &argv, NULL);
  g_test_add_func("/Suno/action/risk", test_action_risk);
  g_test_add_func("/Suno/semantics/object-graph", test_object_graph);
  g_test_add_func("/Suno/live/action-limit", test_live_extension_action_limit);
  return g_test_run();
}
