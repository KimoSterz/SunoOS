/* SPDX-License-Identifier: Apache-2.0 */
/* LumaSyncStore (ADR-057 §3.7): one zone of an app's synced data, through org.projectluma.portal.Sync, or from
 * the app's own data folder when there is no portal (status UNAVAILABLE). */

#define _GNU_SOURCE 1
#include "luma-sync-private.h"

#include <fcntl.h>
#ifdef __linux__
#include <sys/mman.h>
#endif
#include <string.h>
#include <unistd.h>

#define CALL_TIMEOUT_MS (35 * 1000)
#define ASSET_TIMEOUT_MS (160 * 1000)

struct _LumaSyncStore
{
  GObject parent_instance;

  char *zone;
  GMainContext *context;          /* where signals are emitted: the thread-default context at construction */

  GMutex lock;
  gboolean resolved;              /* the backend was chosen */
  GDBusConnection *connection;    /* portal mode */
  LumaSyncLocal *local;           /* no-portal mode */
  guint signal_ids[3];

  LumaSyncStatus status;
  LumaSyncDevice *device;
  LumaSyncUsage *usage;
};

static void luma_sync_store_initable_iface_init (GInitableIface *iface);

G_DEFINE_FINAL_TYPE_WITH_CODE (LumaSyncStore, luma_sync_store, G_TYPE_OBJECT,
                               G_IMPLEMENT_INTERFACE (G_TYPE_INITABLE, luma_sync_store_initable_iface_init))

enum { PROP_0, PROP_ZONE, PROP_STATUS, PROP_LOCAL_ONLY, N_PROPS };
enum { SIGNAL_CHANGED, SIGNAL_SIBLINGS, SIGNAL_ASSET_CHANGED, N_SIGNALS };

static GParamSpec *props[N_PROPS];
static guint signals[N_SIGNALS];

/* ------------------------------------------------------------------ object */

static void
luma_sync_store_dispose (GObject *object)
{
  LumaSyncStore *self = LUMA_SYNC_STORE (object);

  for (guint i = 0; i < G_N_ELEMENTS (self->signal_ids); i++)
    {
      if (self->signal_ids[i] && self->connection)
        g_dbus_connection_signal_unsubscribe (self->connection, self->signal_ids[i]);
      self->signal_ids[i] = 0;
    }
  g_clear_object (&self->connection);
  g_clear_object (&self->device);
  g_clear_object (&self->usage);
  G_OBJECT_CLASS (luma_sync_store_parent_class)->dispose (object);
}

static void
luma_sync_store_finalize (GObject *object)
{
  LumaSyncStore *self = LUMA_SYNC_STORE (object);

  g_clear_pointer (&self->local, luma_sync_local_free);
  g_clear_pointer (&self->context, g_main_context_unref);
  g_free (self->zone);
  g_mutex_clear (&self->lock);
  G_OBJECT_CLASS (luma_sync_store_parent_class)->finalize (object);
}

static void
luma_sync_store_get_property (GObject *object, guint id, GValue *value, GParamSpec *pspec)
{
  LumaSyncStore *self = LUMA_SYNC_STORE (object);

  switch (id)
    {
    case PROP_ZONE: g_value_set_string (value, self->zone); break;
    case PROP_STATUS: g_value_set_enum (value, luma_sync_store_get_status (self)); break;
    case PROP_LOCAL_ONLY: g_value_set_boolean (value, luma_sync_store_get_local_only (self)); break;
    default: G_OBJECT_WARN_INVALID_PROPERTY_ID (object, id, pspec);
    }
}

static void
luma_sync_store_set_property (GObject *object, guint id, const GValue *value, GParamSpec *pspec)
{
  LumaSyncStore *self = LUMA_SYNC_STORE (object);

  switch (id)
    {
    case PROP_ZONE: self->zone = g_value_dup_string (value); break;
    default: G_OBJECT_WARN_INVALID_PROPERTY_ID (object, id, pspec);
    }
}

static void
luma_sync_store_class_init (LumaSyncStoreClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->dispose = luma_sync_store_dispose;
  object_class->finalize = luma_sync_store_finalize;
  object_class->get_property = luma_sync_store_get_property;
  object_class->set_property = luma_sync_store_set_property;

  /**
   * LumaSyncStore:zone:
   *
   * The zone's label.
   */
  props[PROP_ZONE] = g_param_spec_string ("zone", NULL, NULL, NULL,
                                          G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  /**
   * LumaSyncStore:status:
   *
   * The store's last known status.
   */
  props[PROP_STATUS] = g_param_spec_enum ("status", NULL, NULL, LUMA_TYPE_SYNC_STATUS, LUMA_SYNC_STATUS_UNAVAILABLE,
                                          G_PARAM_READABLE | G_PARAM_STATIC_STRINGS | G_PARAM_EXPLICIT_NOTIFY);
  /**
   * LumaSyncStore:local-only:
   *
   * Whether there is no Sync portal, so data stays in the app's own folder.
   */
  props[PROP_LOCAL_ONLY] = g_param_spec_boolean ("local-only", NULL, NULL, FALSE,
                                                 G_PARAM_READABLE | G_PARAM_STATIC_STRINGS | G_PARAM_EXPLICIT_NOTIFY);
  g_object_class_install_properties (object_class, N_PROPS, props);

  /**
   * LumaSyncStore::changed:
   * @self: the store
   *
   * Something changed on another device, or a queued write has an outcome: fetch from your token.
   */
  signals[SIGNAL_CHANGED] = g_signal_new ("changed", G_TYPE_FROM_CLASS (klass), G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                          G_TYPE_NONE, 0);
  /**
   * LumaSyncStore::siblings:
   * @self: the store
   * @record: the record's name
   *
   * A record gained or lost siblings through another device or a queued write.
   */
  signals[SIGNAL_SIBLINGS] = g_signal_new ("siblings", G_TYPE_FROM_CLASS (klass), G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                           G_TYPE_NONE, 1, G_TYPE_STRING);
  /**
   * LumaSyncStore::asset-changed:
   * @self: the store
   * @record: the record's name
   * @name: the asset's name
   * @state: where the bytes are now
   * @done: bytes here
   * @total: the asset's size
   *
   * An asset's bytes moved.
   */
  signals[SIGNAL_ASSET_CHANGED] = g_signal_new ("asset-changed", G_TYPE_FROM_CLASS (klass), G_SIGNAL_RUN_LAST, 0, NULL, NULL,
                                                NULL, G_TYPE_NONE, 5, G_TYPE_STRING, G_TYPE_STRING, LUMA_TYPE_SYNC_ASSET_STATE,
                                                G_TYPE_INT64, G_TYPE_INT64);
}

static void
luma_sync_store_init (LumaSyncStore *self)
{
  g_mutex_init (&self->lock);
  self->status = LUMA_SYNC_STATUS_UNAVAILABLE;
  self->context = g_main_context_ref_thread_default ();
}

static gboolean
luma_sync_store_initable_init (GInitable *initable, GCancellable *cancellable G_GNUC_UNUSED, GError **error)
{
  LumaSyncStore *self = LUMA_SYNC_STORE (initable);

  if (!luma_sync_label_is_valid (self->zone))
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID,
                   "A zone label is 1 to 32 of a-z, 0-9, '.', '_' and '-', starting with a letter or digit");
      return FALSE;
    }
  return TRUE;
}

static void
luma_sync_store_initable_iface_init (GInitableIface *iface)
{
  iface->init = luma_sync_store_initable_init;
}

/**
 * luma_sync_store_new:
 * @zone: the zone's label, `[a-z0-9][a-z0-9._-]{0,31}`
 * @error: a #GError
 *
 * Makes a store for one zone of the app's data. Never touches the network or blocks on the portal.
 *
 * Returns: (transfer full) (nullable): the store, or %NULL with %LUMA_SYNC_ERROR_INVALID for a bad label
 */
LumaSyncStore *
luma_sync_store_new (const char *zone, GError **error)
{
  return g_initable_new (LUMA_TYPE_SYNC_STORE, NULL, error, "zone", zone, NULL);
}

/**
 * luma_sync_store_get_zone:
 * @self: a store
 *
 * Returns: the zone's label
 */
const char *
luma_sync_store_get_zone (LumaSyncStore *self)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), NULL);
  return self->zone;
}

/* ------------------------------------------------------------------ signals from the portal */

typedef struct
{
  LumaSyncStore *self;
  char *signal;
  GVariant *params;
} Pending;

static void
pending_free (Pending *p)
{
  g_object_unref (p->self);
  g_free (p->signal);
  g_variant_unref (p->params);
  g_free (p);
}

static void set_status_from_variant (LumaSyncStore *self, GVariant *status);

static gboolean
deliver (gpointer data)
{
  Pending *p = data;
  LumaSyncStore *self = p->self;

  if (g_str_equal (p->signal, "StatusChanged"))
    {
      g_autoptr(GVariant) status = g_variant_get_child_value (p->params, 0);
      set_status_from_variant (self, status);
    }
  else if (g_str_equal (p->signal, "Changed"))
    {
      const char *zone;
      g_autoptr(GVariant) details = NULL;
      g_autofree const char **siblings = NULL;

      g_variant_get (p->params, "(&s@a{sv})", &zone, &details);
      if (g_str_equal (zone, self->zone))
        {
          g_signal_emit (self, signals[SIGNAL_CHANGED], 0);
          if (g_variant_lookup (details, "siblings", "^a&s", &siblings))
            for (guint i = 0; siblings[i]; i++)
              g_signal_emit (self, signals[SIGNAL_SIBLINGS], 0, siblings[i]);
        }
    }
  else if (g_str_equal (p->signal, "AssetChanged"))
    {
      const char *zone, *record, *name, *state = "gone";
      g_autoptr(GVariant) progress = NULL;
      gint64 done = 0, total = 0;

      g_variant_get (p->params, "(&s&s&s@a{sv})", &zone, &record, &name, &progress);
      g_variant_lookup (progress, "state", "&s", &state);
      g_variant_lookup (progress, "done", "x", &done);
      g_variant_lookup (progress, "total", "x", &total);
      if (g_str_equal (zone, self->zone))
        g_signal_emit (self, signals[SIGNAL_ASSET_CHANGED], 0, record, name,
                       g_str_equal (state, "here") ? LUMA_SYNC_ASSET_HERE
                       : g_str_equal (state, "not-here") ? LUMA_SYNC_ASSET_NOT_HERE
                       : g_str_equal (state, "fetching") ? LUMA_SYNC_ASSET_FETCHING : LUMA_SYNC_ASSET_GONE,
                       done, total);
    }
  return G_SOURCE_REMOVE;
}

static void
on_portal_signal (GDBusConnection *connection G_GNUC_UNUSED, const char *sender G_GNUC_UNUSED,
                  const char *path G_GNUC_UNUSED, const char *iface G_GNUC_UNUSED, const char *signal, GVariant *params,
                  gpointer user_data)
{
  LumaSyncStore *self = user_data;
  Pending *p = g_new0 (Pending, 1);
  const char *types[] = { "(sa{sv})", "(ssssa{sv})", "(a{sv})" };
  const char *names[] = { "Changed", "AssetChanged", "StatusChanged" };
  gboolean ok = FALSE;

  for (guint i = 0; i < G_N_ELEMENTS (names); i++)
    if (g_str_equal (signal, names[i]) && g_variant_is_of_type (params, G_VARIANT_TYPE (types[i])))
      ok = TRUE;
  if (!ok)
    {
      g_free (p);
      return;
    }
  p->self = g_object_ref (self);
  p->signal = g_strdup (signal);
  p->params = g_variant_ref (params);
  g_main_context_invoke_full (self->context, G_PRIORITY_DEFAULT, deliver, p, (GDestroyNotify) pending_free);
}

/* ------------------------------------------------------------------ the backend */

static char *
local_folder (void)
{
  return g_build_filename (g_get_user_data_dir (), "luma-sync", "v1", NULL);
}

/* Portal or local, chosen once: the portal when org.freedesktop.portal.Desktop answers for org.projectluma.portal.Sync. */
static gboolean
ensure_backend (LumaSyncStore *self, GCancellable *cancellable, GError **error G_GNUC_UNUSED)
{
  g_autoptr(GMutexLocker) locker = g_mutex_locker_new (&self->lock);
  g_autoptr(GDBusConnection) bus = NULL;
  g_autoptr(GVariant) version = NULL;
  gboolean local_mode;

  if (self->resolved)
    return TRUE;
  local_mode = g_strcmp0 (g_getenv ("LUMA_SYNC_LOCAL_ONLY"), "1") == 0;
  if (!local_mode)
    bus = g_bus_get_sync (G_BUS_TYPE_SESSION, cancellable, NULL);
  if (bus != NULL)
    version = g_dbus_connection_call_sync (bus, LUMA_SYNC_PORTAL_NAME, LUMA_SYNC_PORTAL_PATH, "org.freedesktop.DBus.Properties",
                                           "Get", g_variant_new ("(ss)", LUMA_SYNC_PORTAL_IFACE, "version"),
                                           G_VARIANT_TYPE ("(v)"), G_DBUS_CALL_FLAGS_NONE, 5000, cancellable, NULL);
  if (version != NULL)
    {
      const char *names[] = { "Changed", "AssetChanged", "StatusChanged" };

      self->connection = g_steal_pointer (&bus);
      g_main_context_push_thread_default (self->context);
      for (guint i = 0; i < G_N_ELEMENTS (names); i++)
        self->signal_ids[i] = g_dbus_connection_signal_subscribe (self->connection, LUMA_SYNC_PORTAL_NAME,
                                                                  LUMA_SYNC_PORTAL_IFACE, names[i], LUMA_SYNC_PORTAL_PATH,
                                                                  NULL, G_DBUS_SIGNAL_FLAGS_NONE, on_portal_signal,
                                                                  self, NULL);
      g_main_context_pop_thread_default (self->context);
    }
  else
    {
      g_autofree char *folder = local_folder ();
      self->local = luma_sync_local_new (folder);
    }
  self->resolved = TRUE;
  if (self->local != NULL)
    {
      g_clear_pointer (&locker, g_mutex_locker_free);
      g_object_notify_by_pspec (G_OBJECT (self), props[PROP_LOCAL_ONLY]);
    }
  return TRUE;
}

/* A portal call (zone included by the caller), answered by the portal or the local store. */
static GVariant *
call (LumaSyncStore *self, const char *method, GVariant *params, GUnixFDList *fds, GUnixFDList **out_fds, const char *reply_type,
      GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) owned = g_variant_ref_sink (params);
  GVariant *reply;

  if (!ensure_backend (self, cancellable, error))
    return NULL;
  if (self->local != NULL)
    reply = luma_sync_local_call (self->local, method, g_variant_ref (owned), fds, out_fds, error);
  else
    reply = g_dbus_connection_call_with_unix_fd_list_sync (self->connection, LUMA_SYNC_PORTAL_NAME, LUMA_SYNC_PORTAL_PATH,
                                                           LUMA_SYNC_PORTAL_IFACE, method, g_variant_ref (owned),
                                                           G_VARIANT_TYPE (reply_type), G_DBUS_CALL_FLAGS_NONE,
                                                           fds ? ASSET_TIMEOUT_MS : CALL_TIMEOUT_MS, fds, out_fds,
                                                           cancellable, error);
  if (reply == NULL)
    {
      if (error && *error && g_dbus_error_is_remote_error (*error))
        g_dbus_error_strip_remote_error (*error);
      return NULL;
    }
  reply = g_variant_ref_sink (reply);
  if (!g_variant_is_of_type (reply, G_VARIANT_TYPE (reply_type)))
    {
      g_variant_unref (reply);
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_FAILED, "Sync for apps answered unexpectedly");
      return NULL;
    }
  return reply;
}

/**
 * luma_sync_store_get_local_only:
 * @self: a store
 *
 * Returns: whether there is no Sync portal (known after the first call)
 */
gboolean
luma_sync_store_get_local_only (LumaSyncStore *self)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), FALSE);
  return self->local != NULL;
}

/* ------------------------------------------------------------------ status */

/* The store's status from GetStatus: the app's, or NOT_APPROVED for a label Luma hasn't approved (§3.4). */
static LumaSyncStatus
status_value (LumaSyncStore *self, GVariant *status)
{
  const char *text = "unavailable";
  g_autoptr(GVariant) labels = g_variant_lookup_value (status, "labels", G_VARIANT_TYPE_STRING_ARRAY);
  LumaSyncStatus value;

  g_variant_lookup (status, "status", "&s", &text);
  value = luma_sync_status_from_string (text);
  if (labels != NULL && value != LUMA_SYNC_STATUS_REVOKED && value != LUMA_SYNC_STATUS_SUSPENDED
      && value != LUMA_SYNC_STATUS_UNVERIFIED && value != LUMA_SYNC_STATUS_UNAVAILABLE)
    {
      g_autofree const char **list = g_variant_get_strv (labels, NULL);
      if (!g_strv_contains (list, self->zone))
        value = LUMA_SYNC_STATUS_NOT_APPROVED;
    }
  return value;
}

static void
set_status_from_variant (LumaSyncStore *self, GVariant *status)
{
  g_autoptr(GVariant) device = g_variant_lookup_value (status, "device", G_VARIANT_TYPE_VARDICT);
  g_autoptr(GVariant) usage = g_variant_lookup_value (status, "usage", G_VARIANT_TYPE_VARDICT);
  g_autoptr(GVariant) limits = g_variant_lookup_value (status, "limits", G_VARIANT_TYPE_VARDICT);
  LumaSyncStatus value = status_value (self, status);
  gboolean changed;

  g_mutex_lock (&self->lock);
  changed = value != self->status;
  self->status = value;
  if (device != NULL)
    {
      g_clear_object (&self->device);
      self->device = luma_sync_device_new_from_variant (device);
    }
  if (usage != NULL)
    {
      g_clear_object (&self->usage);
      self->usage = luma_sync_usage_new_from_variant (usage, limits);
    }
  g_mutex_unlock (&self->lock);
  if (changed)
    g_object_notify_by_pspec (G_OBJECT (self), props[PROP_STATUS]);
}

/**
 * luma_sync_store_get_status:
 * @self: a store
 *
 * Returns: the last known status (%LUMA_SYNC_STATUS_UNAVAILABLE until one is known)
 */
LumaSyncStatus
luma_sync_store_get_status (LumaSyncStore *self)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), LUMA_SYNC_STATUS_UNAVAILABLE);
  return self->status;
}

/**
 * luma_sync_store_get_device:
 * @self: a store
 *
 * Returns: (transfer none) (nullable): this device as the app sees it, once the status is known
 */
LumaSyncDevice *
luma_sync_store_get_device (LumaSyncStore *self)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), NULL);
  return self->device;
}

/**
 * luma_sync_store_get_usage:
 * @self: a store
 *
 * Returns: (transfer none) (nullable): the app's usage and limits, once known
 */
LumaSyncUsage *
luma_sync_store_get_usage (LumaSyncStore *self)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), NULL);
  return self->usage;
}

static void
status_notify (gpointer data)
{
  g_object_unref (data);
}

static gboolean
status_on_context (gpointer data)
{
  LumaSyncStore *self = g_object_get_data (G_OBJECT (data), "luma-sync-store");
  GVariant *status = g_object_get_data (G_OBJECT (data), "luma-sync-status");

  set_status_from_variant (self, status);
  return G_SOURCE_REMOVE;
}

/**
 * luma_sync_store_refresh_status_sync:
 * @self: a store
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Asks for the app's status now (GetStatus) and updates #LumaSyncStore:status.
 *
 * Returns: the status
 */
LumaSyncStatus
luma_sync_store_refresh_status_sync (LumaSyncStore *self, GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GVariant) status = NULL;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), LUMA_SYNC_STATUS_UNAVAILABLE);
  reply = call (self, "GetStatus", g_variant_new ("()"), NULL, NULL, "(a{sv})", cancellable, error);
  if (reply == NULL)
    return self->status;
  status = g_variant_get_child_value (reply, 0);
  if (g_main_context_is_owner (self->context))
    set_status_from_variant (self, status);
  else
    {
      /* notify::status is emitted in the store's own context, never on a worker thread */
      GObject *carrier = g_object_new (G_TYPE_OBJECT, NULL);
      g_object_set_data_full (carrier, "luma-sync-store", g_object_ref (self), g_object_unref);
      g_object_set_data_full (carrier, "luma-sync-status", g_variant_ref (status), (GDestroyNotify) g_variant_unref);
      g_main_context_invoke_full (self->context, G_PRIORITY_DEFAULT, status_on_context, carrier, status_notify);
    }
  return status_value (self, status);
}

/* ------------------------------------------------------------------ async on a worker thread */

typedef GObject *(*SyncCall) (LumaSyncStore *self, gpointer args, GCancellable *cancellable, GError **error);

typedef struct
{
  SyncCall fn;
  gpointer args;
  GDestroyNotify free_args;
} AsyncCall;

static void
async_call_free (AsyncCall *a)
{
  if (a->free_args)
    a->free_args (a->args);
  g_free (a);
}

static void
async_thread (GTask *task, gpointer source, gpointer data, GCancellable *cancellable)
{
  AsyncCall *a = data;
  GError *error = NULL;
  GObject *result = a->fn (LUMA_SYNC_STORE (source), a->args, cancellable, &error);

  if (error != NULL)
    g_task_return_error (task, error);
  else
    g_task_return_pointer (task, result, result ? g_object_unref : NULL);
}

static void
run_async (LumaSyncStore *self, gpointer tag, SyncCall fn, gpointer args, GDestroyNotify free_args, GCancellable *cancellable,
           GAsyncReadyCallback callback, gpointer user_data)
{
  g_autoptr(GTask) task = g_task_new (self, cancellable, callback, user_data);
  AsyncCall *a = g_new0 (AsyncCall, 1);

  a->fn = fn;
  a->args = args;
  a->free_args = free_args;
  g_task_set_source_tag (task, tag);
  g_task_set_task_data (task, a, (GDestroyNotify) async_call_free);
  g_task_run_in_thread (task, async_thread);
}

static gpointer
finish_pointer (LumaSyncStore *self, GAsyncResult *result, gpointer tag, GError **error)
{
  g_return_val_if_fail (g_task_is_valid (result, self), NULL);
  g_return_val_if_fail (g_task_get_source_tag (G_TASK (result)) == tag, NULL);
  return g_task_propagate_pointer (G_TASK (result), error);
}

static GObject *
status_fn (LumaSyncStore *self, gpointer args G_GNUC_UNUSED, GCancellable *cancellable, GError **error)
{
  GError *local_error = NULL;
  LumaSyncStatus status = luma_sync_store_refresh_status_sync (self, cancellable, &local_error);
  GObject *box;

  if (local_error)
    {
      g_propagate_error (error, local_error);
      return NULL;
    }
  box = g_object_new (G_TYPE_OBJECT, NULL);
  g_object_set_data (box, "status", GINT_TO_POINTER (status + 1));
  return box;
}

/**
 * luma_sync_store_refresh_status:
 * @self: a store
 * @cancellable: (nullable): a #GCancellable
 * @callback: (scope async): called when done
 * @user_data: data for @callback
 *
 * Asks for the app's status now.
 */
void
luma_sync_store_refresh_status (LumaSyncStore *self, GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data)
{
  g_return_if_fail (LUMA_IS_SYNC_STORE (self));
  run_async (self, luma_sync_store_refresh_status, status_fn, NULL, NULL, cancellable, callback, user_data);
}

/**
 * luma_sync_store_refresh_status_finish:
 * @self: a store
 * @result: the result
 * @error: a #GError
 *
 * Returns: the status
 */
LumaSyncStatus
luma_sync_store_refresh_status_finish (LumaSyncStore *self, GAsyncResult *result, GError **error)
{
  g_autoptr(GObject) box = finish_pointer (self, result, luma_sync_store_refresh_status, error);

  return box ? (LumaSyncStatus) (GPOINTER_TO_INT (g_object_get_data (box, "status")) - 1) : self->status;
}

/* ------------------------------------------------------------------ subscribe */

static gboolean
nudge (gpointer data)
{
  g_signal_emit (data, signals[SIGNAL_CHANGED], 0);
  return G_SOURCE_REMOVE;
}

static GObject *
subscribe_fn (LumaSyncStore *self, gpointer args G_GNUC_UNUSED, GCancellable *cancellable, GError **error)
{
  const char *zones[] = { self->zone, NULL };
  g_autoptr(GVariant) reply = call (self, "Subscribe", g_variant_new ("(^as)", zones), NULL, NULL, "()", cancellable, error);

  if (reply == NULL)
    return NULL;
  luma_sync_store_refresh_status_sync (self, cancellable, NULL);
  g_main_context_invoke_full (self->context, G_PRIORITY_DEFAULT, nudge, g_object_ref (self), g_object_unref);
  return g_object_new (G_TYPE_OBJECT, NULL);
}

/**
 * luma_sync_store_subscribe:
 * @self: a store
 * @cancellable: (nullable): a #GCancellable
 * @callback: (scope async): called when done
 * @user_data: data for @callback
 *
 * Starts ::changed, ::siblings and ::asset-changed; one ::changed follows at once.
 */
void
luma_sync_store_subscribe (LumaSyncStore *self, GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data)
{
  g_return_if_fail (LUMA_IS_SYNC_STORE (self));
  run_async (self, luma_sync_store_subscribe, subscribe_fn, NULL, NULL, cancellable, callback, user_data);
}

/**
 * luma_sync_store_subscribe_finish:
 * @self: a store
 * @result: the result
 * @error: a #GError
 *
 * Returns: whether the store is subscribed
 */
gboolean
luma_sync_store_subscribe_finish (LumaSyncStore *self, GAsyncResult *result, GError **error)
{
  g_autoptr(GObject) done = finish_pointer (self, result, luma_sync_store_subscribe, error);

  return done != NULL;
}

/* ------------------------------------------------------------------ records */

static GPtrArray *
results_from (GVariant *reply)
{
  g_autoptr(GVariant) list = g_variant_get_child_value (reply, 0);
  GPtrArray *out = g_ptr_array_new_with_free_func (g_object_unref);

  for (gsize i = 0; i < g_variant_n_children (list); i++)
    {
      g_autoptr(GVariant) entry = g_variant_get_child_value (list, i);
      g_ptr_array_add (out, luma_sync_write_result_new_from_variant (entry));
    }
  return out;
}

/**
 * luma_sync_store_put_many_sync:
 * @self: a store
 * @names: (array zero-terminated=1): record names
 * @values: (element-type GBytes): their values, as many as @names
 * @bases: (array zero-terminated=1) (nullable): the versions each was made over ("" for new); %NULL for all new
 * @policy: what a stale write does
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Writes up to 100 records at once.
 *
 * Returns: (transfer container) (element-type LumaSyncWriteResult) (nullable): one result per record
 */
GPtrArray *
luma_sync_store_put_many_sync (LumaSyncStore *self, const char * const *names, GPtrArray *values, const char * const *bases,
                               LumaSyncConflictPolicy policy, GCancellable *cancellable, GError **error)
{
  g_auto(GVariantBuilder) records = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("a(says)"));
  g_auto(GVariantBuilder) options = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
  g_autoptr(GVariant) reply = NULL;
  guint n;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), NULL);
  g_return_val_if_fail (names != NULL && values != NULL, NULL);
  n = g_strv_length ((char **) names);
  if (n != values->len || (bases != NULL && g_strv_length ((char **) bases) != n))
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID, "names, values and bases must be as many");
      return NULL;
    }
  for (guint i = 0; i < n; i++)
    {
      GBytes *value = g_ptr_array_index (values, i);
      g_variant_builder_add (&records, "(s@ays)", names[i],
                             g_variant_new_from_bytes (G_VARIANT_TYPE_BYTESTRING, value, TRUE),
                             bases && bases[i] ? bases[i] : "");
    }
  g_variant_builder_add (&options, "{sv}", "on_conflict",
                         g_variant_new_string (policy == LUMA_SYNC_CONFLICT_FAIL ? "fail" : "keep-both"));
  reply = call (self, "Save", g_variant_new ("(sa(says)a{sv})", self->zone, &records, &options), NULL, NULL, "(aa{sv})",
                cancellable, error);
  return reply ? results_from (reply) : NULL;
}

/**
 * luma_sync_store_put_sync:
 * @self: a store
 * @name: the record's name
 * @value: its value (at most 256 KiB)
 * @base: (nullable): the version it was made over, %NULL for a new record
 * @policy: what a stale write does
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): what the write did
 */
LumaSyncWriteResult *
luma_sync_store_put_sync (LumaSyncStore *self, const char *name, GBytes *value, const char *base, LumaSyncConflictPolicy policy,
                          GCancellable *cancellable, GError **error)
{
  const char *names[] = { name, NULL };
  const char *bases[] = { base ? base : "", NULL };
  g_autoptr(GPtrArray) values = g_ptr_array_new ();
  g_autoptr(GPtrArray) results = NULL;

  g_return_val_if_fail (name != NULL && value != NULL, NULL);
  g_ptr_array_add (values, value);
  results = luma_sync_store_put_many_sync (self, names, values, bases, policy, cancellable, error);
  if (results == NULL || results->len != 1)
    return NULL;
  return g_object_ref (g_ptr_array_index (results, 0));
}

typedef struct
{
  GStrv names;
  GPtrArray *values;
  GStrv bases;
  LumaSyncConflictPolicy policy;
} PutArgs;

static void
put_args_free (PutArgs *a)
{
  g_strfreev (a->names);
  g_ptr_array_unref (a->values);
  g_strfreev (a->bases);
  g_free (a);
}

static PutArgs *
put_args (const char * const *names, GPtrArray *values, const char * const *bases, LumaSyncConflictPolicy policy)
{
  PutArgs *a = g_new0 (PutArgs, 1);

  a->names = g_strdupv ((char **) names);
  a->values = g_ptr_array_new_with_free_func ((GDestroyNotify) g_bytes_unref);
  for (guint i = 0; values && i < values->len; i++)
    g_ptr_array_add (a->values, g_bytes_ref (g_ptr_array_index (values, i)));
  a->bases = bases ? g_strdupv ((char **) bases) : NULL;
  a->policy = policy;
  return a;
}

static GObject *
put_one_fn (LumaSyncStore *self, gpointer data, GCancellable *cancellable, GError **error)
{
  PutArgs *a = data;
  return G_OBJECT (luma_sync_store_put_sync (self, a->names[0], g_ptr_array_index (a->values, 0), a->bases ? a->bases[0] : NULL,
                                             a->policy, cancellable, error));
}

/**
 * luma_sync_store_put:
 * @self: a store
 * @name: the record's name
 * @value: its value
 * @base: (nullable): the version it was made over, %NULL for new
 * @policy: what a stale write does
 * @cancellable: (nullable): a #GCancellable
 * @callback: (scope async): called when done
 * @user_data: data for @callback
 *
 * Writes one record (Save).
 */
void
luma_sync_store_put (LumaSyncStore *self, const char *name, GBytes *value, const char *base, LumaSyncConflictPolicy policy,
                     GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data)
{
  const char *names[] = { name, NULL };
  const char *bases[] = { base ? base : "", NULL };
  g_autoptr(GPtrArray) values = g_ptr_array_new ();

  g_return_if_fail (LUMA_IS_SYNC_STORE (self));
  g_ptr_array_add (values, value);
  run_async (self, luma_sync_store_put, put_one_fn, put_args (names, values, bases, policy), (GDestroyNotify) put_args_free,
             cancellable, callback, user_data);
}

/**
 * luma_sync_store_put_finish:
 * @self: a store
 * @result: the result
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): what the write did
 */
LumaSyncWriteResult *
luma_sync_store_put_finish (LumaSyncStore *self, GAsyncResult *result, GError **error)
{
  return finish_pointer (self, result, luma_sync_store_put, error);
}

static GObject *
put_many_fn (LumaSyncStore *self, gpointer data, GCancellable *cancellable, GError **error)
{
  PutArgs *a = data;
  GPtrArray *results = luma_sync_store_put_many_sync (self, (const char * const *) a->names, a->values,
                                                      (const char * const *) a->bases, a->policy, cancellable, error);
  GObject *box;

  if (results == NULL)
    return NULL;
  box = g_object_new (G_TYPE_OBJECT, NULL);
  g_object_set_data_full (box, "results", results, (GDestroyNotify) g_ptr_array_unref);
  return box;
}

/**
 * luma_sync_store_put_many:
 * @self: a store
 * @names: (array zero-terminated=1): record names
 * @values: (element-type GBytes): their values
 * @bases: (array zero-terminated=1) (nullable): their bases
 * @policy: what a stale write does
 * @cancellable: (nullable): a #GCancellable
 * @callback: (scope async): called when done
 * @user_data: data for @callback
 *
 * Writes up to 100 records at once.
 */
void
luma_sync_store_put_many (LumaSyncStore *self, const char * const *names, GPtrArray *values, const char * const *bases,
                          LumaSyncConflictPolicy policy, GCancellable *cancellable, GAsyncReadyCallback callback,
                          gpointer user_data)
{
  g_return_if_fail (LUMA_IS_SYNC_STORE (self));
  run_async (self, luma_sync_store_put_many, put_many_fn, put_args (names, values, bases, policy),
             (GDestroyNotify) put_args_free, cancellable, callback, user_data);
}

/**
 * luma_sync_store_put_many_finish:
 * @self: a store
 * @result: the result
 * @error: a #GError
 *
 * Returns: (transfer container) (element-type LumaSyncWriteResult) (nullable): one result per record
 */
GPtrArray *
luma_sync_store_put_many_finish (LumaSyncStore *self, GAsyncResult *result, GError **error)
{
  g_autoptr(GObject) box = finish_pointer (self, result, luma_sync_store_put_many, error);

  return box ? g_ptr_array_ref (g_object_get_data (box, "results")) : NULL;
}

/**
 * luma_sync_store_get:
 * @self: a store
 * @name: the record's name
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Reads the device's copy.
 *
 * Returns: (transfer full) (nullable): the current version with its siblings, or %NULL (no error) for no such record
 */
LumaSyncRecord *
luma_sync_store_get (LumaSyncStore *self, const char *name, GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GVariant) record = NULL;
  gboolean found;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && name != NULL, NULL);
  reply = call (self, "Get", g_variant_new ("(ss)", self->zone, name), NULL, NULL, "(ba{sv})", cancellable, error);
  if (reply == NULL)
    return NULL;
  g_variant_get (reply, "(b@a{sv})", &found, &record);
  return found ? luma_sync_record_new_from_variant (record) : NULL;
}

static GPtrArray *
records_from (GVariant *list)
{
  GPtrArray *out = g_ptr_array_new_with_free_func (g_object_unref);

  for (gsize i = 0; i < g_variant_n_children (list); i++)
    {
      g_autoptr(GVariant) entry = g_variant_get_child_value (list, i);
      g_ptr_array_add (out, luma_sync_record_new_from_variant (entry));
    }
  return out;
}

/**
 * luma_sync_store_list:
 * @self: a store
 * @after: (nullable): list records after this name
 * @limit: at most this many (0: 100)
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer container) (element-type LumaSyncRecord) (nullable): records in name order
 */
GPtrArray *
luma_sync_store_list (LumaSyncStore *self, const char *after, guint limit, GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GVariant) list = NULL;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), NULL);
  reply = call (self, "List", g_variant_new ("(ssu)", self->zone, after ? after : "", limit), NULL, NULL, "(aa{sv}s)",
                cancellable, error);
  if (reply == NULL)
    return NULL;
  list = g_variant_get_child_value (reply, 0);
  return records_from (list);
}

/**
 * luma_sync_store_remove_sync:
 * @self: a store
 * @name: the record's name
 * @base: (nullable): the version the app is deleting
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Deletes a record (Delete). A delete on a stale base never wins.
 *
 * Returns: (transfer full) (nullable): what the delete did
 */
LumaSyncWriteResult *
luma_sync_store_remove_sync (LumaSyncStore *self, const char *name, const char *base, GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GPtrArray) results = NULL;
  g_auto(GVariantBuilder) items = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("a(ss)"));

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && name != NULL, NULL);
  g_variant_builder_add (&items, "(ss)", name, base ? base : "");
  reply = call (self, "Delete", g_variant_new ("(sa(ss)a{sv})", self->zone, &items, NULL), NULL, NULL, "(aa{sv})",
                cancellable, error);
  if (reply == NULL)
    return NULL;
  results = results_from (reply);
  return results->len == 1 ? g_object_ref (g_ptr_array_index (results, 0)) : NULL;
}

typedef struct
{
  char *a, *b, *c, *d;
  int fd;
  guint flags;
} StrArgs;

static void
str_args_free (StrArgs *s)
{
  g_free (s->a);
  g_free (s->b);
  g_free (s->c);
  g_free (s->d);
  if (s->fd >= 0)
    close (s->fd);
  g_free (s);
}

static StrArgs *
str_args (const char *a, const char *b, const char *c, const char *d, int fd, guint flags)
{
  StrArgs *s = g_new0 (StrArgs, 1);

  s->a = g_strdup (a);
  s->b = g_strdup (b);
  s->c = g_strdup (c);
  s->d = g_strdup (d);
  s->fd = fd;
  s->flags = flags;
  return s;
}

static GObject *
remove_fn (LumaSyncStore *self, gpointer data, GCancellable *cancellable, GError **error)
{
  StrArgs *s = data;
  return G_OBJECT (luma_sync_store_remove_sync (self, s->a, s->b, cancellable, error));
}

/**
 * luma_sync_store_remove:
 * @self: a store
 * @name: the record's name
 * @base: (nullable): the version the app is deleting
 * @cancellable: (nullable): a #GCancellable
 * @callback: (scope async): called when done
 * @user_data: data for @callback
 *
 * Deletes a record.
 */
void
luma_sync_store_remove (LumaSyncStore *self, const char *name, const char *base, GCancellable *cancellable,
                        GAsyncReadyCallback callback, gpointer user_data)
{
  g_return_if_fail (LUMA_IS_SYNC_STORE (self));
  run_async (self, luma_sync_store_remove, remove_fn, str_args (name, base, NULL, NULL, -1, 0), (GDestroyNotify) str_args_free,
             cancellable, callback, user_data);
}

/**
 * luma_sync_store_remove_finish:
 * @self: a store
 * @result: the result
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): what the delete did
 */
LumaSyncWriteResult *
luma_sync_store_remove_finish (LumaSyncStore *self, GAsyncResult *result, GError **error)
{
  return finish_pointer (self, result, luma_sync_store_remove, error);
}

/**
 * luma_sync_store_fetch_changes:
 * @self: a store
 * @token: (nullable): the app's token, %NULL for everything
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * What changed since @token, with the next token. Changes nothing in the store.
 *
 * Returns: (transfer full) (nullable): the changes
 */
LumaSyncChanges *
luma_sync_store_fetch_changes (LumaSyncStore *self, const char *token, GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GVariant) list = NULL;
  g_autoptr(GPtrArray) records = NULL;
  const char *next;
  gboolean more;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), NULL);
  reply = call (self, "FetchChanges", g_variant_new ("(ssa{sv})", self->zone, token ? token : "", NULL), NULL, NULL,
                "(aa{sv}sb)", cancellable, error);
  if (reply == NULL)
    return NULL;
  g_variant_get (reply, "(@aa{sv}&sb)", &list, &next, &more);
  records = records_from (list);
  return luma_sync_changes_new (records, next, more);
}

/* ------------------------------------------------------------------ assets */

/**
 * luma_sync_store_put_asset_sync:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @fd: a sealed memfd or a regular file outside FUSE; the caller keeps it
 * @base: (nullable): the record's current version (%NULL for a new record)
 * @flags: %LUMA_SYNC_ASSET_FLAGS_ON_DEMAND for an on-demand asset
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): what the write did
 */
LumaSyncWriteResult *
luma_sync_store_put_asset_sync (LumaSyncStore *self, const char *record, const char *name, int fd, const char *base,
                                LumaSyncAssetFlags flags, GCancellable *cancellable, GError **error)
{
  g_autoptr(GUnixFDList) fds = g_unix_fd_list_new ();
  g_auto(GVariantBuilder) options = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GVariant) result = NULL;
  int index;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && record != NULL && name != NULL, NULL);
  index = g_unix_fd_list_append (fds, fd, error);
  if (index < 0)
    return NULL;
  g_variant_builder_add (&options, "{sv}", "on_demand", g_variant_new_boolean ((flags & LUMA_SYNC_ASSET_FLAGS_ON_DEMAND) != 0));
  reply = call (self, "PutAsset", g_variant_new ("(ssshsa{sv})", self->zone, record, name, index, base ? base : "", &options),
                fds, NULL, "(a{sv})", cancellable, error);
  if (reply == NULL)
    return NULL;
  result = g_variant_get_child_value (reply, 0);
  return luma_sync_write_result_new_from_variant (result);
}

static GObject *
put_asset_fn (LumaSyncStore *self, gpointer data, GCancellable *cancellable, GError **error)
{
  StrArgs *s = data;
  return G_OBJECT (luma_sync_store_put_asset_sync (self, s->a, s->b, s->fd, s->c, (LumaSyncAssetFlags) s->flags, cancellable,
                                                   error));
}

/**
 * luma_sync_store_put_asset:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @fd: a sealed memfd or a regular file; duplicated, the caller keeps it
 * @base: (nullable): the record's current version
 * @flags: %LUMA_SYNC_ASSET_FLAGS_ON_DEMAND for an on-demand asset
 * @cancellable: (nullable): a #GCancellable
 * @callback: (scope async): called when done
 * @user_data: data for @callback
 *
 * Adds or replaces an asset (PutAsset).
 */
void
luma_sync_store_put_asset (LumaSyncStore *self, const char *record, const char *name, int fd, const char *base,
                           LumaSyncAssetFlags flags, GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data)
{
  g_return_if_fail (LUMA_IS_SYNC_STORE (self));
  run_async (self, luma_sync_store_put_asset, put_asset_fn, str_args (record, name, base, NULL, fcntl (fd, F_DUPFD_CLOEXEC, 3),
                                                                      flags),
             (GDestroyNotify) str_args_free, cancellable, callback, user_data);
}

/**
 * luma_sync_store_put_asset_finish:
 * @self: a store
 * @result: the result
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): what the write did
 */
LumaSyncWriteResult *
luma_sync_store_put_asset_finish (LumaSyncStore *self, GAsyncResult *result, GError **error)
{
  return finish_pointer (self, result, luma_sync_store_put_asset, error);
}

/**
 * luma_sync_store_put_asset_bytes:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @bytes: the asset's bytes
 * @base: (nullable): the record's current version
 * @flags: %LUMA_SYNC_ASSET_FLAGS_ON_DEMAND for an on-demand asset
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * The same as luma_sync_store_put_asset_sync(), from bytes: the library makes the sealed memfd.
 *
 * Returns: (transfer full) (nullable): what the write did
 */
LumaSyncWriteResult *
luma_sync_store_put_asset_bytes (LumaSyncStore *self, const char *record, const char *name, GBytes *bytes, const char *base,
                                 LumaSyncAssetFlags flags, GCancellable *cancellable, GError **error)
{
  gsize size;
  const guint8 *data = g_bytes_get_data (bytes, &size);
  int fd = -1;
  LumaSyncWriteResult *result;

#ifdef __linux__
  fd = memfd_create ("luma-sync-asset", MFD_CLOEXEC | MFD_ALLOW_SEALING);
#endif
  if (fd < 0)
    {
      g_autofree char *path = NULL;
      fd = g_file_open_tmp ("luma-sync-asset-XXXXXX", &path, error);
      if (fd < 0)
        return NULL;
      unlink (path);
    }
  for (gsize done = 0; done < size;)
    {
      ssize_t n = write (fd, data + done, size - done);
      if (n <= 0)
        {
          close (fd);
          g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_FAILED, "The asset couldn't be prepared");
          return NULL;
        }
      done += (gsize) n;
    }
#ifdef __linux__
  fcntl (fd, F_ADD_SEALS, F_SEAL_WRITE | F_SEAL_GROW | F_SEAL_SHRINK | F_SEAL_SEAL);
#endif
  result = luma_sync_store_put_asset_sync (self, record, name, fd, base, flags, cancellable, error);
  close (fd);
  return result;
}

/**
 * luma_sync_store_remove_asset:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @base: (nullable): the record's current version
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): what the write did
 */
LumaSyncWriteResult *
luma_sync_store_remove_asset (LumaSyncStore *self, const char *record, const char *name, const char *base,
                              GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GVariant) result = NULL;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && record != NULL && name != NULL, NULL);
  reply = call (self, "RemoveAsset", g_variant_new ("(ssss)", self->zone, record, name, base ? base : ""), NULL, NULL,
                "(a{sv})", cancellable, error);
  if (reply == NULL)
    return NULL;
  result = g_variant_get_child_value (reply, 0);
  return luma_sync_write_result_new_from_variant (result);
}

/**
 * luma_sync_store_open_asset_sync:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @version: (nullable): a live version of the record, %NULL for the current one
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): the asset: a stream of a private sealed copy, or where the bytes are
 */
LumaSyncAsset *
luma_sync_store_open_asset_sync (LumaSyncStore *self, const char *record, const char *name, const char *version,
                                 GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GVariant) info = NULL;
  g_autoptr(GUnixFDList) fds = NULL;
  const char *state;
  gint32 handle = -1;
  int fd = -1;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && record != NULL && name != NULL, NULL);
  reply = call (self, "OpenAsset", g_variant_new ("(ssss)", self->zone, record, name, version ? version : ""), NULL, &fds,
                "(sa{sv})", cancellable, error);
  if (reply == NULL)
    return NULL;
  g_variant_get (reply, "(&s@a{sv})", &state, &info);
  if (g_variant_lookup (info, "fd", "h", &handle) && fds != NULL)
    fd = g_unix_fd_list_get (fds, handle, NULL);
  return luma_sync_asset_new (record, name, state, info, fd);
}

static GObject *
open_asset_fn (LumaSyncStore *self, gpointer data, GCancellable *cancellable, GError **error)
{
  StrArgs *s = data;
  return G_OBJECT (luma_sync_store_open_asset_sync (self, s->a, s->b, s->c, cancellable, error));
}

/**
 * luma_sync_store_open_asset:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @version: (nullable): a live version, %NULL for the current one
 * @cancellable: (nullable): a #GCancellable
 * @callback: (scope async): called when done
 * @user_data: data for @callback
 *
 * Opens an asset.
 */
void
luma_sync_store_open_asset (LumaSyncStore *self, const char *record, const char *name, const char *version,
                            GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data)
{
  g_return_if_fail (LUMA_IS_SYNC_STORE (self));
  run_async (self, luma_sync_store_open_asset, open_asset_fn, str_args (record, name, version, NULL, -1, 0),
             (GDestroyNotify) str_args_free, cancellable, callback, user_data);
}

/**
 * luma_sync_store_open_asset_finish:
 * @self: a store
 * @result: the result
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): the asset
 */
LumaSyncAsset *
luma_sync_store_open_asset_finish (LumaSyncStore *self, GAsyncResult *result, GError **error)
{
  return finish_pointer (self, result, luma_sync_store_open_asset, error);
}

static LumaSyncAssetState
asset_state_call (LumaSyncStore *self, const char *method, GVariant *params, GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = call (self, method, params, NULL, NULL, "(sa{sv})", cancellable, error);
  const char *state;

  if (reply == NULL)
    return LUMA_SYNC_ASSET_GONE;
  g_variant_get (reply, "(&s@a{sv})", &state, NULL);
  return g_str_equal (state, "here") ? LUMA_SYNC_ASSET_HERE
       : g_str_equal (state, "not-here") ? LUMA_SYNC_ASSET_NOT_HERE
       : g_str_equal (state, "fetching") ? LUMA_SYNC_ASSET_FETCHING : LUMA_SYNC_ASSET_GONE;
}

/**
 * luma_sync_store_request_asset:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Asks for an on-demand asset's bytes.
 *
 * Returns: where the bytes are
 */
LumaSyncAssetState
luma_sync_store_request_asset (LumaSyncStore *self, const char *record, const char *name, GCancellable *cancellable,
                               GError **error)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), LUMA_SYNC_ASSET_GONE);
  return asset_state_call (self, "RequestAsset", g_variant_new ("(sss)", self->zone, record, name), cancellable, error);
}

/**
 * luma_sync_store_pin_asset:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @pinned: keep it here, or not
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: where the bytes are
 */
LumaSyncAssetState
luma_sync_store_pin_asset (LumaSyncStore *self, const char *record, const char *name, gboolean pinned, GCancellable *cancellable,
                           GError **error)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), LUMA_SYNC_ASSET_GONE);
  return asset_state_call (self, "PinAsset", g_variant_new ("(sssb)", self->zone, record, name, pinned), cancellable, error);
}

/**
 * luma_sync_store_evict_asset:
 * @self: a store
 * @record: the record's name
 * @name: the asset's name
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Lets this device's copy go (never the only copy).
 *
 * Returns: where the bytes are
 */
LumaSyncAssetState
luma_sync_store_evict_asset (LumaSyncStore *self, const char *record, const char *name, GCancellable *cancellable, GError **error)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), LUMA_SYNC_ASSET_GONE);
  return asset_state_call (self, "EvictAsset", g_variant_new ("(sss)", self->zone, record, name), cancellable, error);
}

/* ------------------------------------------------------------------ leases, siblings, zones */

static LumaSyncLease *
lease_call (LumaSyncStore *self, const char *method, GVariant *params, GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = call (self, method, params, NULL, NULL, "(a{sv})", cancellable, error);
  g_autoptr(GVariant) lease = NULL;

  if (reply == NULL)
    return NULL;
  lease = g_variant_get_child_value (reply, 0);
  return luma_sync_lease_new_from_variant (lease);
}

/**
 * luma_sync_store_lease:
 * @self: a store
 * @record: the record's name
 * @seconds: for how long, at most 3600
 * @take_over: take it from another device
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): who holds the lease now
 */
LumaSyncLease *
luma_sync_store_lease (LumaSyncStore *self, const char *record, guint seconds, gboolean take_over, GCancellable *cancellable,
                       GError **error)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && record != NULL, NULL);
  return lease_call (self, "Lease", g_variant_new ("(ssub)", self->zone, record, seconds, take_over), cancellable, error);
}

/**
 * luma_sync_store_release:
 * @self: a store
 * @record: the record's name
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: whether the call succeeded
 */
gboolean
luma_sync_store_release (LumaSyncStore *self, const char *record, GCancellable *cancellable, GError **error)
{
  g_autoptr(LumaSyncLease) lease = NULL;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && record != NULL, FALSE);
  lease = lease_call (self, "Release", g_variant_new ("(ss)", self->zone, record), cancellable, error);
  return lease != NULL;
}

/**
 * luma_sync_store_get_lease:
 * @self: a store
 * @record: the record's name
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): the lease as this device knows it, without taking it
 */
LumaSyncLease *
luma_sync_store_get_lease (LumaSyncStore *self, const char *record, GCancellable *cancellable, GError **error)
{
  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && record != NULL, NULL);
  return lease_call (self, "GetLease", g_variant_new ("(ss)", self->zone, record), cancellable, error);
}

/**
 * luma_sync_store_resolve_siblings:
 * @self: a store
 * @record: the record's name
 * @keep: the version the person chose
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): what the resolve did
 */
LumaSyncWriteResult *
luma_sync_store_resolve_siblings (LumaSyncStore *self, const char *record, const char *keep, GCancellable *cancellable,
                                  GError **error)
{
  g_autoptr(GVariant) reply = NULL;
  g_autoptr(GVariant) result = NULL;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self) && record != NULL && keep != NULL, NULL);
  reply = call (self, "ResolveSiblings", g_variant_new ("(sss)", self->zone, record, keep), NULL, NULL, "(a{sv})", cancellable,
                error);
  if (reply == NULL)
    return NULL;
  result = g_variant_get_child_value (reply, 0);
  return luma_sync_write_result_new_from_variant (result);
}

/**
 * luma_sync_store_delete_zone:
 * @self: a store
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Deletes the app's data in this zone on every device (restorable in Settings for 30 days).
 *
 * Returns: whether it was deleted
 */
gboolean
luma_sync_store_delete_zone (LumaSyncStore *self, GCancellable *cancellable, GError **error)
{
  g_autoptr(GVariant) reply = NULL;

  g_return_val_if_fail (LUMA_IS_SYNC_STORE (self), FALSE);
  reply = call (self, "DeleteZone", g_variant_new ("(s)", self->zone), NULL, NULL, "()", cancellable, error);
  return reply != NULL;
}
