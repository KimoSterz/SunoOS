/* SPDX-License-Identifier: Apache-2.0 */
/* SunoSyncStore (ADR-057 §3.7): the no-portal local mode, and the portal mode against a stand-in portal on a
 * private session bus (signals, errors, the per-label status). */

#include <gio/gio.h>
#include <glib/gstdio.h>
#include <string.h>
#include "Suno-sync.h"

static GBytes *
b (const char *s)
{
  return g_bytes_new (s, strlen (s));
}

static gboolean
bytes_is (GBytes *bytes, const char *s)
{
  gsize size;
  const char *data = g_bytes_get_data (bytes, &size);
  return size == strlen (s) && memcmp (data, s, size) == 0;
}

/* ------------------------------------------------------------------ local mode */

static void
test_bad_label (void)
{
  g_autoptr(GError) error = NULL;
  g_autoptr(SunoSyncStore) store = Suno_sync_store_new ("Saves!", &error);

  g_assert_null (store);
  g_assert_error (error, SUNO_SYNC_ERROR, SUNO_SYNC_ERROR_INVALID);
}

static void
test_local_records (void)
{
  g_autoptr(GError) error = NULL;
  g_autoptr(SunoSyncStore) store = Suno_sync_store_new ("saves", &error);
  g_autoptr(SunoSyncWriteResult) first = NULL, second = NULL, stale = NULL, kept = NULL;
  g_autoptr(SunoSyncRecord) got = NULL;
  g_autoptr(GBytes) v1 = b ("level 1"), v2 = b ("level 2"), v3 = b ("other");
  char *v1_version;

  g_assert_no_error (error);
  first = Suno_sync_store_put_sync (store, "slot1", v1, NULL, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL, &error);
  g_assert_no_error (error);
  g_assert_cmpint (Suno_sync_write_result_get_outcome (first), ==, SUNO_SYNC_OUTCOME_LOCAL);
  g_assert_true (Suno_sync_store_get_local_only (store));
  g_assert_cmpint (Suno_sync_store_refresh_status_sync (store, NULL, &error), ==, SUNO_SYNC_STATUS_UNAVAILABLE);
  v1_version = g_strdup (Suno_sync_record_get_version (Suno_sync_write_result_get_record (first)));
  g_assert_cmpint (strlen (v1_version), ==, 32);

  second = Suno_sync_store_put_sync (store, "slot1", v2, v1_version, SUNO_SYNC_CONFLICT_FAIL, NULL, &error);
  g_assert_cmpint (Suno_sync_write_result_get_outcome (second), ==, SUNO_SYNC_OUTCOME_LOCAL);
  stale = Suno_sync_store_put_sync (store, "slot1", v3, v1_version, SUNO_SYNC_CONFLICT_FAIL, NULL, &error);
  g_assert_cmpint (Suno_sync_write_result_get_outcome (stale), ==, SUNO_SYNC_OUTCOME_CONFLICT);
  g_assert_true (bytes_is (Suno_sync_record_get_value (Suno_sync_write_result_get_record (stale)), "level 2"));
  kept = Suno_sync_store_put_sync (store, "slot1", v3, v1_version, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL, &error);
  g_assert_cmpint (Suno_sync_write_result_get_outcome (kept), ==, SUNO_SYNC_OUTCOME_LOCAL);
  g_assert_cmpuint (Suno_sync_record_get_siblings (Suno_sync_write_result_get_record (kept))->len, ==, 1);

  /* two versions now (level 2, other); two more fit, a fifth is refused */
  for (int i = 0; i < 3; i++)
    {
      g_autoptr(SunoSyncWriteResult) more = Suno_sync_store_put_sync (store, "slot1", v3, v1_version, SUNO_SYNC_CONFLICT_KEEP_BOTH,
                                                                       NULL, &error);
      SunoSyncOutcome want = i < 2 ? SUNO_SYNC_OUTCOME_LOCAL : SUNO_SYNC_OUTCOME_TOO_MANY_SIBLINGS;
      g_assert_cmpint (Suno_sync_write_result_get_outcome (more), ==, want);
    }

  got = Suno_sync_store_get (store, "slot1", NULL, &error);
  g_assert_nonnull (got);
  g_assert_cmpuint (Suno_sync_record_get_siblings (got)->len + 1, ==, SUNO_SYNC_MAX_VERSIONS);
  g_assert_true (Suno_sync_record_get_mine (got));
  g_assert_null (Suno_sync_store_get (store, "nope", NULL, &error));
  g_assert_no_error (error);

  /* the person picks one: one version left, resolved_by set */
  {
    SunoSyncRecord *sibling = g_ptr_array_index (Suno_sync_record_get_siblings (got), 0);
    g_autoptr(SunoSyncWriteResult) resolved = Suno_sync_store_resolve_siblings (store, "slot1",
                                                                                Suno_sync_record_get_version (sibling), NULL,
                                                                                &error);
    SunoSyncRecord *now = Suno_sync_write_result_get_record (resolved);
    g_assert_cmpuint (Suno_sync_record_get_siblings (now)->len, ==, 0);
    g_assert_nonnull (Suno_sync_record_get_resolved_by (now));
    g_assert_cmpstr (Suno_sync_record_get_version (now), !=, Suno_sync_record_get_version (sibling));
  }

  /* a stale delete never wins; on the current base it deletes */
  {
    g_autoptr(SunoSyncWriteResult) refused = Suno_sync_store_remove_sync (store, "slot1", v1_version, NULL, &error);
    g_autoptr(SunoSyncRecord) current = NULL;
    g_autoptr(SunoSyncWriteResult) deleted = NULL;

    g_assert_cmpint (Suno_sync_write_result_get_outcome (refused), ==, SUNO_SYNC_OUTCOME_CONFLICT);
    current = Suno_sync_store_get (store, "slot1", NULL, &error);
    deleted = Suno_sync_store_remove_sync (store, "slot1", Suno_sync_record_get_version (current), NULL, &error);
    g_assert_cmpint (Suno_sync_write_result_get_outcome (deleted), ==, SUNO_SYNC_OUTCOME_LOCAL);
    g_assert_null (Suno_sync_store_get (store, "slot1", NULL, &error));
  }
  g_free (v1_version);
}

static void
test_local_changes_and_limits (void)
{
  g_autoptr(GError) error = NULL;
  g_autoptr(SunoSyncStore) store = Suno_sync_store_new ("library", &error);
  g_autoptr(SunoSyncChanges) all = NULL, again = NULL, rest = NULL;
  g_autoptr(GBytes) small = b ("x");
  g_autoptr(GBytes) huge = g_bytes_new_take (g_malloc0 (256 * 1024 + 1), 256 * 1024 + 1);
  g_autofree char *long_name = g_strnfill (256, 'n');

  for (int i = 0; i < 3; i++)
    {
      g_autofree char *name = g_strdup_printf ("game%d", i);
      g_autoptr(SunoSyncWriteResult) r = Suno_sync_store_put_sync (store, name, small, NULL, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL,
                                                                   &error);
      g_assert_no_error (error);
    }
  all = Suno_sync_store_fetch_changes (store, NULL, NULL, &error);
  g_assert_cmpuint (Suno_sync_changes_get_records (all)->len, ==, 3);
  again = Suno_sync_store_fetch_changes (store, NULL, NULL, &error);
  g_assert_cmpuint (Suno_sync_changes_get_records (again)->len, ==, 3);      /* the store never advances a token */
  rest = Suno_sync_store_fetch_changes (store, Suno_sync_changes_get_token (all), NULL, &error);
  g_assert_cmpuint (Suno_sync_changes_get_records (rest)->len, ==, 0);
  g_assert_null (Suno_sync_store_fetch_changes (store, "bogus", NULL, &error));
  g_assert_error (error, SUNO_SYNC_ERROR, SUNO_SYNC_ERROR_INVALID);
  g_clear_error (&error);

  g_assert_null (Suno_sync_store_put_sync (store, "big", huge, NULL, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL, &error));
  g_assert_error (error, SUNO_SYNC_ERROR, SUNO_SYNC_ERROR_TOO_LARGE);
  g_clear_error (&error);
  g_assert_null (Suno_sync_store_put_sync (store, long_name, small, NULL, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL, &error));
  g_assert_error (error, SUNO_SYNC_ERROR, SUNO_SYNC_ERROR_TOO_LARGE);
  g_clear_error (&error);
  g_assert_null (Suno_sync_store_put_sync (store, "a\tb", small, NULL, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL, &error));
  g_assert_error (error, SUNO_SYNC_ERROR, SUNO_SYNC_ERROR_INVALID);
  g_clear_error (&error);

  {
    g_autoptr(GPtrArray) listed = Suno_sync_store_list (store, "game0", 1, NULL, &error);
    g_assert_cmpuint (listed->len, ==, 1);
    g_assert_cmpstr (Suno_sync_record_get_name (g_ptr_array_index (listed, 0)), ==, "game1");
  }
  g_assert_true (Suno_sync_store_delete_zone (store, NULL, &error));
  {
    g_autoptr(GPtrArray) listed = Suno_sync_store_list (store, NULL, 0, NULL, &error);
    g_assert_cmpuint (listed->len, ==, 0);
  }
}

static void
test_local_assets_and_leases (void)
{
  g_autoptr(GError) error = NULL;
  g_autoptr(SunoSyncStore) store = Suno_sync_store_new ("saves", &error);
  g_autoptr(GBytes) meta = b ("slot meta"), state = b ("emulator state bytes");
  g_autoptr(SunoSyncWriteResult) made = NULL, with_asset = NULL;
  g_autoptr(SunoSyncAsset) asset = NULL;
  g_autoptr(GBytes) read = NULL;
  g_autoptr(SunoSyncLease) lease = NULL, seen = NULL, none = NULL;
  SunoSyncRecord *record;

  made = Suno_sync_store_put_sync (store, "slot2", meta, NULL, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL, &error);
  with_asset = Suno_sync_store_put_asset_bytes (store, "slot2", "state", state,
                                                Suno_sync_record_get_version (Suno_sync_write_result_get_record (made)),
                                                SUNO_SYNC_ASSET_FLAGS_NONE, NULL, &error);
  g_assert_no_error (error);
  record = Suno_sync_write_result_get_record (with_asset);
  g_assert_cmpint (Suno_sync_record_get_asset_size (record, "state"), ==, (gint64) g_bytes_get_size (state));
  g_assert_true (Suno_sync_record_get_asset_flags (record, "state") & SUNO_SYNC_ASSET_FLAGS_HERE);
  g_assert_cmpint (Suno_sync_record_get_asset_size (record, "missing"), ==, -1);
  g_assert_true (bytes_is (Suno_sync_record_get_value (record), "slot meta"));

  asset = Suno_sync_store_open_asset_sync (store, "slot2", "state", NULL, NULL, &error);
  g_assert_cmpint (Suno_sync_asset_get_state (asset), ==, SUNO_SYNC_ASSET_HERE);
  read = Suno_sync_asset_read_all (asset, NULL, &error);
  g_assert_true (g_bytes_equal (read, state));
  {
    g_autoptr(SunoSyncAsset) gone = Suno_sync_store_open_asset_sync (store, "slot2", "nope", NULL, NULL, &error);
    g_assert_cmpint (Suno_sync_asset_get_state (gone), ==, SUNO_SYNC_ASSET_GONE);
  }

  none = Suno_sync_store_get_lease (store, "slot2", NULL, &error);
  g_assert_false (Suno_sync_lease_get_active (none));
  g_assert_cmpint (Suno_sync_lease_get_until_ms (none), ==, 0);
  lease = Suno_sync_store_lease (store, "slot2", 60, FALSE, NULL, &error);
  g_assert_true (Suno_sync_lease_get_mine (lease) && Suno_sync_lease_get_active (lease));
  g_assert_true (Suno_sync_store_release (store, "slot2", NULL, &error));
  seen = Suno_sync_store_get_lease (store, "slot2", NULL, &error);
  g_assert_false (Suno_sync_lease_get_active (seen));
  g_assert_null (Suno_sync_lease_get_holder (seen));
  g_assert_null (Suno_sync_store_lease (store, "slot2", 3601, FALSE, NULL, &error));
  g_assert_error (error, SUNO_SYNC_ERROR, SUNO_SYNC_ERROR_INVALID);
}

static void
on_put_done (GObject *source, GAsyncResult *result, gpointer data)
{
  g_autoptr(GError) error = NULL;
  g_autoptr(SunoSyncWriteResult) r = Suno_sync_store_put_finish (SUNO_SYNC_STORE (source), result, &error);

  g_assert_no_error (error);
  g_assert_cmpint (Suno_sync_write_result_get_outcome (r), ==, SUNO_SYNC_OUTCOME_LOCAL);
  g_main_loop_quit (data);
}

static void
test_local_async (void)
{
  g_autoptr(GError) error = NULL;
  g_autoptr(SunoSyncStore) store = Suno_sync_store_new ("async", &error);
  g_autoptr(GMainLoop) loop = g_main_loop_new (NULL, FALSE);
  g_autoptr(GBytes) value = b ("async");

  Suno_sync_store_put (store, "a", value, NULL, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL, on_put_done, loop);
  g_main_loop_run (loop);
}

/* ------------------------------------------------------------------ portal mode */

typedef struct
{
  GMainContext *context;
  GMainLoop *loop;
  GDBusConnection *connection;
  GThread *thread;
  char *address;
} FakePortal;

static const char portal_xml[] =
  "<node><interface name='org.projectSuno.portal.Sync'>"
  "<method name='GetStatus'><arg type='a{sv}' direction='out'/></method>"
  "<method name='Subscribe'><arg type='as' direction='in'/></method>"
  "<method name='Save'><arg type='s' direction='in'/><arg type='a(says)' direction='in'/><arg type='a{sv}' direction='in'/>"
  "<arg type='aa{sv}' direction='out'/></method>"
  "<method name='Delete'><arg type='s' direction='in'/><arg type='a(ss)' direction='in'/><arg type='a{sv}' direction='in'/>"
  "<arg type='aa{sv}' direction='out'/></method>"
  "<property name='version' type='u' access='read'/>"
  "</interface></node>";

static void
fake_call (GDBusConnection *c G_GNUC_UNUSED, const char *sender G_GNUC_UNUSED, const char *path G_GNUC_UNUSED,
           const char *iface G_GNUC_UNUSED, const char *method, GVariant *params, GDBusMethodInvocation *inv,
           gpointer data G_GNUC_UNUSED)
{
  if (g_str_equal (method, "GetStatus"))
    {
      g_auto(GVariantBuilder) s = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
      const char *labels[] = { "saves", NULL };
      g_variant_builder_add (&s, "{sv}", "status", g_variant_new_string ("available"));
      g_variant_builder_add (&s, "{sv}", "labels", g_variant_new_strv (labels, -1));
      g_dbus_method_invocation_return_value (inv, g_variant_new ("(@a{sv})", g_variant_builder_end (&s)));
    }
  else if (g_str_equal (method, "Subscribe"))
    g_dbus_method_invocation_return_value (inv, NULL);
  else if (g_str_equal (method, "Save"))
    {
      g_auto(GVariantBuilder) out = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("aa{sv}"));
      g_auto(GVariantBuilder) r = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
      g_auto(GVariantBuilder) rec = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
      g_autoptr(GVariant) records = g_variant_get_child_value (params, 1);
      const char *name;
      g_variant_get_child (records, 0, "(&s@ays)", &name, NULL, NULL);
      g_variant_builder_add (&rec, "{sv}", "name", g_variant_new_string (name));
      g_variant_builder_add (&rec, "{sv}", "version", g_variant_new_string ("0123456789abcdef0123456789abcdef"));
      g_variant_builder_add (&rec, "{sv}", "flags", g_variant_new_uint32 (SUNO_SYNC_RECORD_QUEUED | SUNO_SYNC_RECORD_MINE));
      g_variant_builder_add (&r, "{sv}", "name", g_variant_new_string (name));
      g_variant_builder_add (&r, "{sv}", "outcome", g_variant_new_string ("queued"));
      g_variant_builder_add (&r, "{sv}", "record", g_variant_builder_end (&rec));
      g_variant_builder_add_value (&out, g_variant_builder_end (&r));
      g_dbus_method_invocation_return_value (inv, g_variant_new ("(aa{sv})", &out));
    }
  else
    g_dbus_method_invocation_return_dbus_error (inv, "org.projectSuno.portal.Sync.Error.Quota", "record_bytes: full");
}

static GVariant *
fake_property (GDBusConnection *c G_GNUC_UNUSED, const char *sender G_GNUC_UNUSED, const char *path G_GNUC_UNUSED,
               const char *iface G_GNUC_UNUSED, const char *prop G_GNUC_UNUSED, GError **error G_GNUC_UNUSED,
               gpointer data G_GNUC_UNUSED)
{
  return g_variant_new_uint32 (1);
}

static const GDBusInterfaceVTable fake_vtable = { fake_call, fake_property, NULL, { 0 } };

static gpointer
fake_thread (gpointer data)
{
  FakePortal *fake = data;
  g_autoptr(GDBusNodeInfo) node = g_dbus_node_info_new_for_xml (portal_xml, NULL);

  g_main_context_push_thread_default (fake->context);
  fake->connection = g_dbus_connection_new_for_address_sync (fake->address,
                                                             G_DBUS_CONNECTION_FLAGS_AUTHENTICATION_CLIENT
                                                             | G_DBUS_CONNECTION_FLAGS_MESSAGE_BUS_CONNECTION,
                                                             NULL, NULL, NULL);
  g_dbus_connection_register_object (fake->connection, "/org/freedesktop/portal/desktop", node->interfaces[0], &fake_vtable,
                                     NULL, NULL, NULL);
  g_bus_own_name_on_connection (fake->connection, "org.freedesktop.portal.Desktop", G_BUS_NAME_OWNER_FLAGS_NONE, NULL, NULL,
                                NULL, NULL);
  g_main_loop_run (fake->loop);
  g_main_context_pop_thread_default (fake->context);
  return NULL;
}

static void
wait_for_name (void)
{
  g_autoptr(GDBusConnection) bus = g_bus_get_sync (G_BUS_TYPE_SESSION, NULL, NULL);

  for (int i = 0; i < 200; i++)
    {
      g_autoptr(GVariant) has = g_dbus_connection_call_sync (bus, "org.freedesktop.DBus", "/org/freedesktop/DBus",
                                                             "org.freedesktop.DBus", "NameHasOwner",
                                                             g_variant_new ("(s)", "org.freedesktop.portal.Desktop"),
                                                             G_VARIANT_TYPE ("(b)"), 0, -1, NULL, NULL);
      gboolean owned = FALSE;
      if (has)
        g_variant_get (has, "(b)", &owned);
      if (owned)
        return;
      g_usleep (10000);
    }
  g_assert_not_reached ();
}

static int changed_count, siblings_count;

static void on_changed (SunoSyncStore *s G_GNUC_UNUSED, gpointer d G_GNUC_UNUSED) { changed_count++; }
static void on_siblings (SunoSyncStore *s G_GNUC_UNUSED, const char *r, gpointer d G_GNUC_UNUSED) { if (g_str_equal (r, "slot1")) siblings_count++; }

static void
test_portal (void)
{
  g_autoptr(GTestDBus) bus = g_test_dbus_new (G_TEST_DBUS_NONE);
  FakePortal fake = { 0 };
  g_autoptr(GError) error = NULL;
  g_autoptr(SunoSyncStore) store = NULL, other = NULL;
  g_autoptr(SunoSyncWriteResult) result = NULL;
  g_autoptr(GBytes) value = b ("v");

  g_unsetenv ("SUNO_SYNC_LOCAL_ONLY");
  g_test_dbus_up (bus);
  fake.address = g_strdup (g_test_dbus_get_bus_address (bus));
  fake.context = g_main_context_new ();
  fake.loop = g_main_loop_new (fake.context, FALSE);
  fake.thread = g_thread_new ("fake-portal", fake_thread, &fake);
  wait_for_name ();

  store = Suno_sync_store_new ("saves", &error);
  other = Suno_sync_store_new ("telemetry", &error);
  g_signal_connect (store, "changed", G_CALLBACK (on_changed), NULL);
  g_signal_connect (store, "siblings", G_CALLBACK (on_siblings), NULL);

  g_assert_cmpint (Suno_sync_store_refresh_status_sync (store, NULL, &error), ==, SUNO_SYNC_STATUS_AVAILABLE);
  g_assert_false (Suno_sync_store_get_local_only (store));
  g_assert_cmpint (Suno_sync_store_get_status (store), ==, SUNO_SYNC_STATUS_AVAILABLE);
  g_assert_cmpint (Suno_sync_store_refresh_status_sync (other, NULL, &error), ==, SUNO_SYNC_STATUS_NOT_APPROVED);

  result = Suno_sync_store_put_sync (store, "slot1", value, NULL, SUNO_SYNC_CONFLICT_KEEP_BOTH, NULL, &error);
  g_assert_no_error (error);
  g_assert_cmpint (Suno_sync_write_result_get_outcome (result), ==, SUNO_SYNC_OUTCOME_QUEUED);
  g_assert_true (Suno_sync_record_get_flags (Suno_sync_write_result_get_record (result)) & SUNO_SYNC_RECORD_QUEUED);

  g_assert_null (Suno_sync_store_remove_sync (store, "slot1", NULL, NULL, &error));
  g_assert_error (error, SUNO_SYNC_ERROR, SUNO_SYNC_ERROR_QUOTA);
  g_clear_error (&error);

  /* Signals: ours (with siblings) arrive; another zone's don't. */
  {
    const char *sibs[] = { "slot1", NULL };
    g_auto(GVariantBuilder) d = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
    GDBusConnection *client = NULL;
    g_variant_builder_add (&d, "{sv}", "siblings", g_variant_new_strv (sibs, -1));
    client = g_bus_get_sync (G_BUS_TYPE_SESSION, NULL, NULL);
    g_dbus_connection_emit_signal (fake.connection, g_dbus_connection_get_unique_name (client),
                                   "/org/freedesktop/portal/desktop", "org.projectSuno.portal.Sync", "Changed",
                                   g_variant_new ("(s@a{sv})", "saves", g_variant_builder_end (&d)), NULL);
    g_dbus_connection_emit_signal (fake.connection, g_dbus_connection_get_unique_name (client),
                                   "/org/freedesktop/portal/desktop", "org.projectSuno.portal.Sync", "Changed",
                                   g_variant_new ("(s@a{sv})", "library", g_variant_new ("a{sv}", NULL)), NULL);
    g_object_unref (client);
    for (int i = 0; i < 200 && changed_count < 1; i++)
      {
        g_main_context_iteration (NULL, FALSE);
        g_usleep (5000);
      }
    for (int i = 0; i < 20; i++)
      g_main_context_iteration (NULL, FALSE);
    g_assert_cmpint (changed_count, ==, 1);
    g_assert_cmpint (siblings_count, ==, 1);
  }

  g_clear_object (&store);
  g_clear_object (&other);
  g_main_loop_quit (fake.loop);
  g_thread_join (fake.thread);
  g_clear_object (&fake.connection);
  g_main_loop_unref (fake.loop);
  g_main_context_unref (fake.context);
  g_free (fake.address);
  g_test_dbus_down (bus);
  g_setenv ("SUNO_SYNC_LOCAL_ONLY", "1", TRUE);
}

int
main (int argc, char **argv)
{
  g_autofree char *home = g_dir_make_tmp ("Suno-sync-test-XXXXXX", NULL);

  g_setenv ("XDG_DATA_HOME", home, TRUE);
  g_setenv ("SUNO_SYNC_LOCAL_ONLY", "1", TRUE);
  g_test_init (&argc, &argv, NULL);
  g_test_add_func ("/sync/bad-label", test_bad_label);
  g_test_add_func ("/sync/local/records", test_local_records);
  g_test_add_func ("/sync/local/changes-and-limits", test_local_changes_and_limits);
  g_test_add_func ("/sync/local/assets-and-leases", test_local_assets_and_leases);
  g_test_add_func ("/sync/local/async", test_local_async);
  g_test_add_func ("/sync/portal", test_portal);
  return g_test_run ();
}
