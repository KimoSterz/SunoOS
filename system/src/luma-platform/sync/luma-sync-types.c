/* SPDX-License-Identifier: Apache-2.0 */
/* The value types of luma-sync.h: enums, errors, devices, records, results, changes, leases, assets, usage.
 * Each is built from the portal's a{sv} answer (luma-sync-private.h). */

#include "luma-sync-private.h"

#include <string.h>

#ifdef G_OS_UNIX
#include <gio/gunixinputstream.h>
#endif

G_DEFINE_ENUM_TYPE (LumaSyncStatus, luma_sync_status,
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_AVAILABLE, "available"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_OFF, "off"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_NO_ACCOUNT, "no-account"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_NOT_ALLOWED, "not-allowed"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_OFFERED, "offered"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_UNVERIFIED, "unverified"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_NOT_APPROVED, "not-approved"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_REVOKED, "revoked"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_SUSPENDED, "suspended"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_STATUS_UNAVAILABLE, "unavailable"))

G_DEFINE_ENUM_TYPE (LumaSyncDeviceKind, luma_sync_device_kind,
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_DEVICE_KIND_UNKNOWN, "unknown"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_DEVICE_KIND_COMPUTER, "computer"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_DEVICE_KIND_HANDHELD, "handheld"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_DEVICE_KIND_TV, "tv"))

G_DEFINE_ENUM_TYPE (LumaSyncOutcome, luma_sync_outcome,
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_OUTCOME_SAVED, "saved"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_OUTCOME_CONFLICT, "conflict"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_OUTCOME_KEPT_BOTH, "kept-both"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_OUTCOME_QUEUED, "queued"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_OUTCOME_TOO_MANY_SIBLINGS, "too-many-siblings"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_OUTCOME_LOCAL, "local"))

G_DEFINE_ENUM_TYPE (LumaSyncConflictPolicy, luma_sync_conflict_policy,
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_CONFLICT_KEEP_BOTH, "keep-both"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_CONFLICT_FAIL, "fail"))

G_DEFINE_FLAGS_TYPE (LumaSyncRecordFlags, luma_sync_record_flags,
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_RECORD_NONE, "none"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_RECORD_DELETED, "deleted"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_RECORD_QUEUED, "queued"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_RECORD_HELD, "held"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_RECORD_DELETE_DROPPED, "delete-dropped"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_RECORD_SIBLING, "sibling"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_RECORD_MINE, "mine"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_RECORD_LOCAL_ONLY, "local-only"))

G_DEFINE_ENUM_TYPE (LumaSyncAssetState, luma_sync_asset_state,
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ASSET_HERE, "here"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ASSET_NOT_HERE, "not-here"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ASSET_FETCHING, "fetching"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ASSET_GONE, "gone"))

G_DEFINE_FLAGS_TYPE (LumaSyncAssetFlags, luma_sync_asset_flags,
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ASSET_FLAGS_NONE, "none"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ASSET_FLAGS_ON_DEMAND, "on-demand"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ASSET_FLAGS_HERE, "here"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ASSET_FLAGS_PINNED, "pinned"))

G_DEFINE_ENUM_TYPE (LumaSyncError, luma_sync_error,
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_FAILED, "failed"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_INVALID, "invalid"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_TOO_LARGE, "too-large"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_QUOTA, "quota"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_RATE_LIMITED, "rate-limited"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_REFUSED, "refused"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_NOT_FOUND, "not-found"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_BAD_DESCRIPTOR, "bad-descriptor"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_TIMED_OUT, "timed-out"),
  G_DEFINE_ENUM_VALUE (LUMA_SYNC_ERROR_NOT_SUPPORTED, "not-supported"))

static const GDBusErrorEntry sync_error_entries[] = {
  { LUMA_SYNC_ERROR_FAILED, LUMA_SYNC_DBUS_ERROR ".Failed" },
  { LUMA_SYNC_ERROR_INVALID, LUMA_SYNC_DBUS_ERROR ".Invalid" },
  { LUMA_SYNC_ERROR_TOO_LARGE, LUMA_SYNC_DBUS_ERROR ".TooLarge" },
  { LUMA_SYNC_ERROR_QUOTA, LUMA_SYNC_DBUS_ERROR ".Quota" },
  { LUMA_SYNC_ERROR_RATE_LIMITED, LUMA_SYNC_DBUS_ERROR ".RateLimited" },
  { LUMA_SYNC_ERROR_REFUSED, LUMA_SYNC_DBUS_ERROR ".Refused" },
  { LUMA_SYNC_ERROR_NOT_FOUND, LUMA_SYNC_DBUS_ERROR ".NotFound" },
  { LUMA_SYNC_ERROR_BAD_DESCRIPTOR, LUMA_SYNC_DBUS_ERROR ".BadDescriptor" },
  { LUMA_SYNC_ERROR_TIMED_OUT, LUMA_SYNC_DBUS_ERROR ".TimedOut" },
  { LUMA_SYNC_ERROR_NOT_SUPPORTED, LUMA_SYNC_DBUS_ERROR ".NotSupported" },
};

/**
 * luma_sync_error_quark:
 *
 * Returns: the error domain of the Sync portal's errors; D-Bus errors of the
 *   portal arrive in it.
 */
GQuark
luma_sync_error_quark (void)
{
  static gsize quark = 0;

  g_dbus_error_register_error_domain ("luma-sync-error-quark", &quark, sync_error_entries,
                                      G_N_ELEMENTS (sync_error_entries));
  return (GQuark) quark;
}

static const char *const status_names[] = {
  "available", "off", "no-account", "not-allowed", "offered", "unverified", "not-approved", "revoked", "suspended",
  "unavailable",
};
G_STATIC_ASSERT (G_N_ELEMENTS (status_names) == LUMA_SYNC_STATUS_UNAVAILABLE + 1);

/**
 * luma_sync_status_to_string:
 * @status: a status
 *
 * Returns: the portal's name for @status ("not-approved", …)
 */
const char *
luma_sync_status_to_string (LumaSyncStatus status)
{
  g_return_val_if_fail (status <= LUMA_SYNC_STATUS_UNAVAILABLE, "unavailable");
  return status_names[status];
}

/**
 * luma_sync_status_from_string:
 * @text: (nullable): a portal status name
 *
 * Returns: the status, or %LUMA_SYNC_STATUS_UNAVAILABLE for an unknown name
 */
LumaSyncStatus
luma_sync_status_from_string (const char *text)
{
  for (guint i = 0; text != NULL && i < G_N_ELEMENTS (status_names); i++)
    if (g_str_equal (text, status_names[i]))
      return (LumaSyncStatus) i;
  return LUMA_SYNC_STATUS_UNAVAILABLE;
}

/* ------------------------------------------------------------------ helpers */

static const char *
lookup_string (GVariant *dict, const char *key)
{
  const char *value = NULL;

  if (dict != NULL && g_variant_lookup (dict, key, "&s", &value))
    return value;
  return "";
}

static gint64
lookup_int64 (GVariant *dict, const char *key)
{
  g_autoptr(GVariant) value = dict ? g_variant_lookup_value (dict, key, NULL) : NULL;

  if (value == NULL)
    return 0;
  if (g_variant_is_of_type (value, G_VARIANT_TYPE_INT64))
    return g_variant_get_int64 (value);
  if (g_variant_is_of_type (value, G_VARIANT_TYPE_UINT64))
    return (gint64) g_variant_get_uint64 (value);
  if (g_variant_is_of_type (value, G_VARIANT_TYPE_UINT32))
    return g_variant_get_uint32 (value);
  if (g_variant_is_of_type (value, G_VARIANT_TYPE_INT32))
    return g_variant_get_int32 (value);
  return 0;
}

static gboolean
lookup_bool (GVariant *dict, const char *key)
{
  gboolean value = FALSE;

  if (dict != NULL)
    g_variant_lookup (dict, key, "b", &value);
  return value;
}

/* ------------------------------------------------------------------ device */

struct _LumaSyncDevice
{
  GObject parent_instance;
  char *handle;
  char *name;
  LumaSyncDeviceKind kind;
  gboolean mine;
};

G_DEFINE_FINAL_TYPE (LumaSyncDevice, luma_sync_device, G_TYPE_OBJECT)

static void
luma_sync_device_finalize (GObject *object)
{
  LumaSyncDevice *self = LUMA_SYNC_DEVICE (object);

  g_free (self->handle);
  g_free (self->name);
  G_OBJECT_CLASS (luma_sync_device_parent_class)->finalize (object);
}

static void
luma_sync_device_class_init (LumaSyncDeviceClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = luma_sync_device_finalize;
}

static void
luma_sync_device_init (LumaSyncDevice *self G_GNUC_UNUSED)
{
}

LumaSyncDevice *
luma_sync_device_new_from_variant (GVariant *dict)
{
  LumaSyncDevice *self = g_object_new (LUMA_TYPE_SYNC_DEVICE, NULL);
  const char *kind = lookup_string (dict, "class");

  self->handle = g_strdup (lookup_string (dict, "handle"));
  self->name = g_strdup (lookup_string (dict, "name"));
  self->kind = g_str_equal (kind, "computer") ? LUMA_SYNC_DEVICE_KIND_COMPUTER
             : g_str_equal (kind, "handheld") ? LUMA_SYNC_DEVICE_KIND_HANDHELD
             : g_str_equal (kind, "tv") ? LUMA_SYNC_DEVICE_KIND_TV
             : LUMA_SYNC_DEVICE_KIND_UNKNOWN;
  self->mine = lookup_bool (dict, "mine");
  return self;
}

/**
 * luma_sync_device_get_handle:
 * @self: a device
 * Returns: the device's handle, stable for this app only
 */
const char *luma_sync_device_get_handle (LumaSyncDevice *self) { g_return_val_if_fail (LUMA_IS_SYNC_DEVICE (self), NULL); return self->handle; }
/**
 * luma_sync_device_get_name:
 * @self: a device
 * Returns: the name the person gave the device
 */
const char *luma_sync_device_get_name (LumaSyncDevice *self) { g_return_val_if_fail (LUMA_IS_SYNC_DEVICE (self), NULL); return self->name; }
/**
 * luma_sync_device_get_kind:
 * @self: a device
 * Returns: the device's class
 */
LumaSyncDeviceKind luma_sync_device_get_kind (LumaSyncDevice *self) { g_return_val_if_fail (LUMA_IS_SYNC_DEVICE (self), 0); return self->kind; }
/**
 * luma_sync_device_get_mine:
 * @self: a device
 * Returns: whether it is this device
 */
gboolean luma_sync_device_get_mine (LumaSyncDevice *self) { g_return_val_if_fail (LUMA_IS_SYNC_DEVICE (self), FALSE); return self->mine; }

/* ------------------------------------------------------------------ record */

typedef struct
{
  char *name;
  gint64 size;
  LumaSyncAssetFlags flags;
} AssetMeta;

struct _LumaSyncRecord
{
  GObject parent_instance;
  char *name;
  GBytes *value;
  char *version;
  LumaSyncDevice *writer;
  LumaSyncDevice *resolved_by;
  gint64 time_ms;
  LumaSyncRecordFlags flags;
  GStrv asset_names;
  GArray *assets;              /* AssetMeta */
  GPtrArray *siblings;         /* LumaSyncRecord */
};

G_DEFINE_FINAL_TYPE (LumaSyncRecord, luma_sync_record, G_TYPE_OBJECT)

static void
asset_meta_clear (gpointer data)
{
  g_free (((AssetMeta *) data)->name);
}

static void
luma_sync_record_finalize (GObject *object)
{
  LumaSyncRecord *self = LUMA_SYNC_RECORD (object);

  g_free (self->name);
  g_clear_pointer (&self->value, g_bytes_unref);
  g_free (self->version);
  g_clear_object (&self->writer);
  g_clear_object (&self->resolved_by);
  g_strfreev (self->asset_names);
  g_clear_pointer (&self->assets, g_array_unref);
  g_clear_pointer (&self->siblings, g_ptr_array_unref);
  G_OBJECT_CLASS (luma_sync_record_parent_class)->finalize (object);
}

static void
luma_sync_record_class_init (LumaSyncRecordClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = luma_sync_record_finalize;
}

static void
luma_sync_record_init (LumaSyncRecord *self G_GNUC_UNUSED)
{
}

LumaSyncRecord *
luma_sync_record_new_from_variant (GVariant *dict)
{
  LumaSyncRecord *self = g_object_new (LUMA_TYPE_SYNC_RECORD, NULL);
  g_autoptr(GVariant) value = g_variant_lookup_value (dict, "value", G_VARIANT_TYPE_BYTESTRING);
  g_autoptr(GVariant) writer = g_variant_lookup_value (dict, "writer", G_VARIANT_TYPE_VARDICT);
  g_autoptr(GVariant) resolved = g_variant_lookup_value (dict, "resolved_by", G_VARIANT_TYPE_VARDICT);
  g_autoptr(GVariant) assets = g_variant_lookup_value (dict, "assets", G_VARIANT_TYPE ("aa{sv}"));
  g_autoptr(GVariant) siblings = g_variant_lookup_value (dict, "siblings", G_VARIANT_TYPE ("aa{sv}"));
  g_autoptr(GStrvBuilder) names = g_strv_builder_new ();

  self->name = g_strdup (lookup_string (dict, "name"));
  self->version = g_strdup (lookup_string (dict, "version"));
  self->time_ms = lookup_int64 (dict, "time_ms");
  self->flags = (LumaSyncRecordFlags) lookup_int64 (dict, "flags");
  self->value = value ? g_variant_get_data_as_bytes (value) : g_bytes_new (NULL, 0);
  self->writer = writer ? luma_sync_device_new_from_variant (writer) : NULL;
  self->resolved_by = resolved ? luma_sync_device_new_from_variant (resolved) : NULL;
  self->assets = g_array_new (FALSE, TRUE, sizeof (AssetMeta));
  g_array_set_clear_func (self->assets, asset_meta_clear);
  self->siblings = g_ptr_array_new_with_free_func (g_object_unref);

  for (gsize i = 0; assets != NULL && i < g_variant_n_children (assets); i++)
    {
      g_autoptr(GVariant) entry = g_variant_get_child_value (assets, i);
      AssetMeta meta = { g_strdup (lookup_string (entry, "name")), lookup_int64 (entry, "size"),
                         (LumaSyncAssetFlags) lookup_int64 (entry, "flags") };

      g_strv_builder_add (names, meta.name);
      g_array_append_val (self->assets, meta);
    }
  self->asset_names = g_strv_builder_end (names);

  for (gsize i = 0; siblings != NULL && i < g_variant_n_children (siblings); i++)
    {
      g_autoptr(GVariant) entry = g_variant_get_child_value (siblings, i);
      g_ptr_array_add (self->siblings, luma_sync_record_new_from_variant (entry));
    }
  return self;
}

static const AssetMeta *
record_asset (LumaSyncRecord *self, const char *name)
{
  for (guint i = 0; name != NULL && i < self->assets->len; i++)
    {
      const AssetMeta *meta = &g_array_index (self->assets, AssetMeta, i);
      if (g_str_equal (meta->name, name))
        return meta;
    }
  return NULL;
}

/**
 * luma_sync_record_get_name:
 * @self: a record
 * Returns: the record's name
 */
const char *luma_sync_record_get_name (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), NULL); return self->name; }
/**
 * luma_sync_record_get_value:
 * @self: a record
 * Returns: (transfer none): the value (empty for a deleted record)
 */
GBytes *luma_sync_record_get_value (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), NULL); return self->value; }
/**
 * luma_sync_record_get_version:
 * @self: a record
 * Returns: the version, the base of the next write over it
 */
const char *luma_sync_record_get_version (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), NULL); return self->version; }
/**
 * luma_sync_record_get_writer:
 * @self: a record
 * Returns: (transfer none) (nullable): the device that wrote this version
 */
LumaSyncDevice *luma_sync_record_get_writer (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), NULL); return self->writer; }
/**
 * luma_sync_record_get_time_ms:
 * @self: a record
 * Returns: when it was written, in milliseconds since the Unix epoch, UTC (hybrid logical clock)
 */
gint64 luma_sync_record_get_time_ms (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), 0); return self->time_ms; }
/**
 * luma_sync_record_get_resolved_by:
 * @self: a record
 * Returns: (transfer none) (nullable): the device that chose this version among siblings
 */
LumaSyncDevice *luma_sync_record_get_resolved_by (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), NULL); return self->resolved_by; }
/**
 * luma_sync_record_get_flags:
 * @self: a record
 * Returns: the record's flags
 */
LumaSyncRecordFlags luma_sync_record_get_flags (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), 0); return self->flags; }
/**
 * luma_sync_record_get_mine:
 * @self: a record
 * Returns: whether this device wrote it
 */
gboolean luma_sync_record_get_mine (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), FALSE); return (self->flags & LUMA_SYNC_RECORD_MINE) != 0; }
/**
 * luma_sync_record_get_held:
 * @self: a record
 * Returns: whether a write of this device is held until the siblings are resolved
 */
gboolean luma_sync_record_get_held (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), FALSE); return (self->flags & LUMA_SYNC_RECORD_HELD) != 0; }
/**
 * luma_sync_record_get_deleted:
 * @self: a record
 * Returns: whether the record was deleted
 */
gboolean luma_sync_record_get_deleted (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), FALSE); return (self->flags & LUMA_SYNC_RECORD_DELETED) != 0; }
/**
 * luma_sync_record_get_delete_dropped:
 * @self: a record
 * Returns: whether a queued delete of this device was dropped
 */
gboolean luma_sync_record_get_delete_dropped (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), FALSE); return (self->flags & LUMA_SYNC_RECORD_DELETE_DROPPED) != 0; }
/**
 * luma_sync_record_get_asset_names:
 * @self: a record
 * Returns: (transfer none) (array zero-terminated=1): the asset names
 */
const char * const *luma_sync_record_get_asset_names (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), NULL); return (const char * const *) self->asset_names; }
/**
 * luma_sync_record_get_siblings:
 * @self: a record
 * Returns: (transfer none) (element-type LumaSyncRecord): the other live versions, newest first
 */
GPtrArray *luma_sync_record_get_siblings (LumaSyncRecord *self) { g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), NULL); return self->siblings; }

/**
 * luma_sync_record_get_asset_size:
 * @self: a record
 * @name: an asset name
 *
 * Returns: the asset's size in bytes, or -1 when the record has no such asset
 */
gint64
luma_sync_record_get_asset_size (LumaSyncRecord *self, const char *name)
{
  const AssetMeta *meta;

  g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), -1);
  meta = record_asset (self, name);
  return meta ? meta->size : -1;
}

/**
 * luma_sync_record_get_asset_flags:
 * @self: a record
 * @name: an asset name
 *
 * Returns: whether the asset is on-demand, here and pinned (none for no such asset)
 */
LumaSyncAssetFlags
luma_sync_record_get_asset_flags (LumaSyncRecord *self, const char *name)
{
  const AssetMeta *meta;

  g_return_val_if_fail (LUMA_IS_SYNC_RECORD (self), 0);
  meta = record_asset (self, name);
  return meta ? meta->flags : LUMA_SYNC_ASSET_FLAGS_NONE;
}

/* ------------------------------------------------------------------ write result */

struct _LumaSyncWriteResult
{
  GObject parent_instance;
  char *name;
  LumaSyncOutcome outcome;
  LumaSyncRecord *record;
};

G_DEFINE_FINAL_TYPE (LumaSyncWriteResult, luma_sync_write_result, G_TYPE_OBJECT)

static void
luma_sync_write_result_finalize (GObject *object)
{
  LumaSyncWriteResult *self = LUMA_SYNC_WRITE_RESULT (object);

  g_free (self->name);
  g_clear_object (&self->record);
  G_OBJECT_CLASS (luma_sync_write_result_parent_class)->finalize (object);
}

static void
luma_sync_write_result_class_init (LumaSyncWriteResultClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = luma_sync_write_result_finalize;
}

static void
luma_sync_write_result_init (LumaSyncWriteResult *self G_GNUC_UNUSED)
{
}

LumaSyncWriteResult *
luma_sync_write_result_new_from_variant (GVariant *dict)
{
  LumaSyncWriteResult *self = g_object_new (LUMA_TYPE_SYNC_WRITE_RESULT, NULL);
  g_autoptr(GVariant) record = g_variant_lookup_value (dict, "record", G_VARIANT_TYPE_VARDICT);
  const char *outcome = lookup_string (dict, "outcome");

  self->name = g_strdup (lookup_string (dict, "name"));
  self->outcome = g_str_equal (outcome, "conflict") ? LUMA_SYNC_OUTCOME_CONFLICT
                : g_str_equal (outcome, "kept-both") ? LUMA_SYNC_OUTCOME_KEPT_BOTH
                : g_str_equal (outcome, "queued") ? LUMA_SYNC_OUTCOME_QUEUED
                : g_str_equal (outcome, "too-many-siblings") ? LUMA_SYNC_OUTCOME_TOO_MANY_SIBLINGS
                : g_str_equal (outcome, "local") ? LUMA_SYNC_OUTCOME_LOCAL
                : LUMA_SYNC_OUTCOME_SAVED;
  if (record != NULL)
    self->record = luma_sync_record_new_from_variant (record);
  return self;
}

/**
 * luma_sync_write_result_get_name:
 * @self: a write result
 * Returns: the record's name
 */
const char *luma_sync_write_result_get_name (LumaSyncWriteResult *self) { g_return_val_if_fail (LUMA_IS_SYNC_WRITE_RESULT (self), NULL); return self->name; }
/**
 * luma_sync_write_result_get_outcome:
 * @self: a write result
 * Returns: what the write did
 */
LumaSyncOutcome luma_sync_write_result_get_outcome (LumaSyncWriteResult *self) { g_return_val_if_fail (LUMA_IS_SYNC_WRITE_RESULT (self), 0); return self->outcome; }
/**
 * luma_sync_write_result_get_record:
 * @self: a write result
 * Returns: (transfer none) (nullable): the record as it now is
 */
LumaSyncRecord *luma_sync_write_result_get_record (LumaSyncWriteResult *self) { g_return_val_if_fail (LUMA_IS_SYNC_WRITE_RESULT (self), NULL); return self->record; }

/* ------------------------------------------------------------------ changes */

struct _LumaSyncChanges
{
  GObject parent_instance;
  GPtrArray *records;
  char *token;
  gboolean more;
};

G_DEFINE_FINAL_TYPE (LumaSyncChanges, luma_sync_changes, G_TYPE_OBJECT)

static void
luma_sync_changes_finalize (GObject *object)
{
  LumaSyncChanges *self = LUMA_SYNC_CHANGES (object);

  g_clear_pointer (&self->records, g_ptr_array_unref);
  g_free (self->token);
  G_OBJECT_CLASS (luma_sync_changes_parent_class)->finalize (object);
}

static void
luma_sync_changes_class_init (LumaSyncChangesClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = luma_sync_changes_finalize;
}

static void
luma_sync_changes_init (LumaSyncChanges *self G_GNUC_UNUSED)
{
}

LumaSyncChanges *
luma_sync_changes_new (GPtrArray *records, const char *token, gboolean more)
{
  LumaSyncChanges *self = g_object_new (LUMA_TYPE_SYNC_CHANGES, NULL);

  self->records = g_ptr_array_ref (records);
  self->token = g_strdup (token);
  self->more = more;
  return self;
}

/**
 * luma_sync_changes_get_records:
 * @self: changes
 * Returns: (transfer none) (element-type LumaSyncRecord): the changed records
 */
GPtrArray *luma_sync_changes_get_records (LumaSyncChanges *self) { g_return_val_if_fail (LUMA_IS_SYNC_CHANGES (self), NULL); return self->records; }
/**
 * luma_sync_changes_get_token:
 * @self: changes
 * Returns: the token to fetch from next time; the app keeps it
 */
const char *luma_sync_changes_get_token (LumaSyncChanges *self) { g_return_val_if_fail (LUMA_IS_SYNC_CHANGES (self), NULL); return self->token; }
/**
 * luma_sync_changes_get_more:
 * @self: changes
 * Returns: whether there is more to fetch now
 */
gboolean luma_sync_changes_get_more (LumaSyncChanges *self) { g_return_val_if_fail (LUMA_IS_SYNC_CHANGES (self), FALSE); return self->more; }

/* ------------------------------------------------------------------ lease */

struct _LumaSyncLease
{
  GObject parent_instance;
  char *record;
  LumaSyncDevice *holder;
  gint64 until_ms;
  gboolean mine;
  gboolean active;
};

G_DEFINE_FINAL_TYPE (LumaSyncLease, luma_sync_lease, G_TYPE_OBJECT)

static void
luma_sync_lease_finalize (GObject *object)
{
  LumaSyncLease *self = LUMA_SYNC_LEASE (object);

  g_free (self->record);
  g_clear_object (&self->holder);
  G_OBJECT_CLASS (luma_sync_lease_parent_class)->finalize (object);
}

static void
luma_sync_lease_class_init (LumaSyncLeaseClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = luma_sync_lease_finalize;
}

static void
luma_sync_lease_init (LumaSyncLease *self G_GNUC_UNUSED)
{
}

LumaSyncLease *
luma_sync_lease_new_from_variant (GVariant *dict)
{
  LumaSyncLease *self = g_object_new (LUMA_TYPE_SYNC_LEASE, NULL);
  g_autoptr(GVariant) holder = g_variant_lookup_value (dict, "holder", G_VARIANT_TYPE_VARDICT);

  self->record = g_strdup (lookup_string (dict, "record"));
  self->active = lookup_bool (dict, "active");
  self->mine = self->active && lookup_bool (dict, "mine");
  self->until_ms = self->active ? lookup_int64 (dict, "until_ms") : 0;
  self->holder = (holder != NULL && self->active) ? luma_sync_device_new_from_variant (holder) : NULL;
  return self;
}

/**
 * luma_sync_lease_get_record:
 * @self: a lease
 * Returns: the record's name
 */
const char *luma_sync_lease_get_record (LumaSyncLease *self) { g_return_val_if_fail (LUMA_IS_SYNC_LEASE (self), NULL); return self->record; }
/**
 * luma_sync_lease_get_holder:
 * @self: a lease
 * Returns: (transfer none) (nullable): the holding device, %NULL when no lease is active
 */
LumaSyncDevice *luma_sync_lease_get_holder (LumaSyncLease *self) { g_return_val_if_fail (LUMA_IS_SYNC_LEASE (self), NULL); return self->holder; }
/**
 * luma_sync_lease_get_until_ms:
 * @self: a lease
 * Returns: until when, in milliseconds since the Unix epoch, UTC; 0 when no lease is active
 */
gint64 luma_sync_lease_get_until_ms (LumaSyncLease *self) { g_return_val_if_fail (LUMA_IS_SYNC_LEASE (self), 0); return self->until_ms; }
/**
 * luma_sync_lease_get_mine:
 * @self: a lease
 * Returns: whether this device holds it
 */
gboolean luma_sync_lease_get_mine (LumaSyncLease *self) { g_return_val_if_fail (LUMA_IS_SYNC_LEASE (self), FALSE); return self->mine; }
/**
 * luma_sync_lease_get_active:
 * @self: a lease
 * Returns: whether an unexpired lease exists until luma_sync_lease_get_until_ms()
 */
gboolean luma_sync_lease_get_active (LumaSyncLease *self) { g_return_val_if_fail (LUMA_IS_SYNC_LEASE (self), FALSE); return self->active; }

/* ------------------------------------------------------------------ asset */

struct _LumaSyncAsset
{
  GObject parent_instance;
  char *record;
  char *name;
  char *version;
  char *where;
  LumaSyncAssetState state;
  LumaSyncAssetFlags flags;
  gint64 size;
  LumaSyncDevice *holder;
  GInputStream *stream;
};

G_DEFINE_FINAL_TYPE (LumaSyncAsset, luma_sync_asset, G_TYPE_OBJECT)

static void
luma_sync_asset_finalize (GObject *object)
{
  LumaSyncAsset *self = LUMA_SYNC_ASSET (object);

  g_free (self->record);
  g_free (self->name);
  g_free (self->version);
  g_free (self->where);
  g_clear_object (&self->holder);
  g_clear_object (&self->stream);
  G_OBJECT_CLASS (luma_sync_asset_parent_class)->finalize (object);
}

static void
luma_sync_asset_class_init (LumaSyncAssetClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = luma_sync_asset_finalize;
}

static void
luma_sync_asset_init (LumaSyncAsset *self G_GNUC_UNUSED)
{
}

LumaSyncAsset *
luma_sync_asset_new (const char *record, const char *name, const char *state, GVariant *info, int fd)
{
  LumaSyncAsset *self = g_object_new (LUMA_TYPE_SYNC_ASSET, NULL);
  g_autoptr(GVariant) holder = info ? g_variant_lookup_value (info, "holder", G_VARIANT_TYPE_VARDICT) : NULL;

  self->record = g_strdup (record);
  self->name = g_strdup (name);
  self->version = g_strdup (lookup_string (info, "version"));
  self->where = g_strdup (lookup_string (info, "where"));
  self->size = lookup_int64 (info, "size");
  self->flags = (LumaSyncAssetFlags) lookup_int64 (info, "flags");
  self->state = g_str_equal (state, "here") ? LUMA_SYNC_ASSET_HERE
              : g_str_equal (state, "not-here") ? LUMA_SYNC_ASSET_NOT_HERE
              : g_str_equal (state, "fetching") ? LUMA_SYNC_ASSET_FETCHING
              : LUMA_SYNC_ASSET_GONE;
  self->holder = holder ? luma_sync_device_new_from_variant (holder) : NULL;
#ifdef G_OS_UNIX
  if (fd >= 0)
    self->stream = g_unix_input_stream_new (fd, TRUE);
#else
  (void) fd;
#endif
  if (self->state == LUMA_SYNC_ASSET_HERE && self->stream == NULL)
    self->state = LUMA_SYNC_ASSET_GONE;
  return self;
}

/**
 * luma_sync_asset_get_record:
 * @self: an asset
 * Returns: the record's name
 */
const char *luma_sync_asset_get_record (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), NULL); return self->record; }
/**
 * luma_sync_asset_get_name:
 * @self: an asset
 * Returns: the asset's name
 */
const char *luma_sync_asset_get_name (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), NULL); return self->name; }
/**
 * luma_sync_asset_get_version:
 * @self: an asset
 * Returns: the version of the record it belongs to
 */
const char *luma_sync_asset_get_version (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), NULL); return self->version; }
/**
 * luma_sync_asset_get_state:
 * @self: an asset
 * Returns: where the bytes are
 */
LumaSyncAssetState luma_sync_asset_get_state (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), LUMA_SYNC_ASSET_GONE); return self->state; }
/**
 * luma_sync_asset_get_flags:
 * @self: an asset
 * Returns: on-demand, here, pinned
 */
LumaSyncAssetFlags luma_sync_asset_get_flags (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), 0); return self->flags; }
/**
 * luma_sync_asset_get_size:
 * @self: an asset
 * Returns: its size in bytes
 */
gint64 luma_sync_asset_get_size (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), 0); return self->size; }
/**
 * luma_sync_asset_get_holder:
 * @self: an asset
 * Returns: (transfer none) (nullable): the device holding the bytes, for an on-demand asset
 */
LumaSyncDevice *luma_sync_asset_get_holder (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), NULL); return self->holder; }
/**
 * luma_sync_asset_get_where:
 * @self: an asset
 * Returns: where the bytes are, for the person ("On Dell XPS 14 · offline"), or ""
 */
const char *luma_sync_asset_get_where (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), NULL); return self->where; }
/**
 * luma_sync_asset_get_stream:
 * @self: an asset
 * Returns: (transfer none) (nullable): a read-only stream of a private, sealed copy, when the bytes are here
 */
GInputStream *luma_sync_asset_get_stream (LumaSyncAsset *self) { g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), NULL); return self->stream; }

/**
 * luma_sync_asset_read_all:
 * @self: an asset
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): all of the asset's bytes
 */
GBytes *
luma_sync_asset_read_all (LumaSyncAsset *self, GCancellable *cancellable, GError **error)
{
  g_autoptr(GOutputStream) out = NULL;

  g_return_val_if_fail (LUMA_IS_SYNC_ASSET (self), NULL);
  if (self->stream == NULL)
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_NOT_FOUND, "The asset's bytes aren't on this device");
      return NULL;
    }
  out = g_memory_output_stream_new_resizable ();
  if (g_output_stream_splice (out, self->stream, G_OUTPUT_STREAM_SPLICE_CLOSE_TARGET, cancellable, error) < 0)
    return NULL;
  return g_memory_output_stream_steal_as_bytes (G_MEMORY_OUTPUT_STREAM (out));
}

/* ------------------------------------------------------------------ usage */

struct _LumaSyncUsage
{
  GObject parent_instance;
  guint64 values[10];
  guint zones, zones_limit, held;
  char *limited_by;
};

G_DEFINE_FINAL_TYPE (LumaSyncUsage, luma_sync_usage, G_TYPE_OBJECT)

static void
luma_sync_usage_finalize (GObject *object)
{
  g_free (LUMA_SYNC_USAGE (object)->limited_by);
  G_OBJECT_CLASS (luma_sync_usage_parent_class)->finalize (object);
}

static void
luma_sync_usage_class_init (LumaSyncUsageClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = luma_sync_usage_finalize;
}

static void
luma_sync_usage_init (LumaSyncUsage *self G_GNUC_UNUSED)
{
}

enum { U_RECORD_BYTES, U_RECORD_BYTES_LIMIT, U_ASSET_BYTES, U_ASSET_BYTES_LIMIT, U_RECORDS, U_RECORDS_LIMIT,
       U_OUTBOX, U_OUTBOX_LIMIT };

LumaSyncUsage *
luma_sync_usage_new_from_variant (GVariant *usage, GVariant *limits)
{
  LumaSyncUsage *self = g_object_new (LUMA_TYPE_SYNC_USAGE, NULL);

  self->values[U_RECORD_BYTES] = (guint64) lookup_int64 (usage, "record_bytes");
  self->values[U_ASSET_BYTES] = (guint64) lookup_int64 (usage, "asset_bytes");
  self->values[U_RECORDS] = (guint64) lookup_int64 (usage, "records");
  self->values[U_OUTBOX] = (guint64) lookup_int64 (usage, "outbox_bytes");
  self->values[U_RECORD_BYTES_LIMIT] = (guint64) lookup_int64 (limits, "record_bytes");
  self->values[U_ASSET_BYTES_LIMIT] = (guint64) lookup_int64 (limits, "asset_bytes");
  self->values[U_RECORDS_LIMIT] = (guint64) lookup_int64 (limits, "records");
  self->values[U_OUTBOX_LIMIT] = (guint64) lookup_int64 (limits, "outbox_bytes");
  self->zones = (guint) lookup_int64 (usage, "zones");
  self->zones_limit = (guint) lookup_int64 (limits, "zones");
  self->held = (guint) lookup_int64 (usage, "held");
  self->limited_by = g_strdup (lookup_string (usage, "limited_by"));
  return self;
}

/**
 * luma_sync_usage_get_record_bytes:
 * @self: usage
 * Returns: record bytes
 */
guint64 luma_sync_usage_get_record_bytes (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->values[U_RECORD_BYTES]; }
/**
 * luma_sync_usage_get_record_bytes_limit:
 * @self: usage
 * Returns: the record bytes limit
 */
guint64 luma_sync_usage_get_record_bytes_limit (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->values[U_RECORD_BYTES_LIMIT]; }
/**
 * luma_sync_usage_get_asset_bytes:
 * @self: usage
 * Returns: inline asset bytes
 */
guint64 luma_sync_usage_get_asset_bytes (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->values[U_ASSET_BYTES]; }
/**
 * luma_sync_usage_get_asset_bytes_limit:
 * @self: usage
 * Returns: the inline asset bytes limit
 */
guint64 luma_sync_usage_get_asset_bytes_limit (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->values[U_ASSET_BYTES_LIMIT]; }
/**
 * luma_sync_usage_get_records:
 * @self: usage
 * Returns: live records
 */
guint64 luma_sync_usage_get_records (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->values[U_RECORDS]; }
/**
 * luma_sync_usage_get_records_limit:
 * @self: usage
 * Returns: the records limit
 */
guint64 luma_sync_usage_get_records_limit (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->values[U_RECORDS_LIMIT]; }
/**
 * luma_sync_usage_get_zones:
 * @self: usage
 * Returns: zones
 */
guint luma_sync_usage_get_zones (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->zones; }
/**
 * luma_sync_usage_get_zones_limit:
 * @self: usage
 * Returns: the zones limit
 */
guint luma_sync_usage_get_zones_limit (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->zones_limit; }
/**
 * luma_sync_usage_get_outbox_bytes:
 * @self: usage
 * Returns: bytes waiting to leave
 */
guint64 luma_sync_usage_get_outbox_bytes (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->values[U_OUTBOX]; }
/**
 * luma_sync_usage_get_outbox_bytes_limit:
 * @self: usage
 * Returns: the outbox cap
 */
guint64 luma_sync_usage_get_outbox_bytes_limit (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->values[U_OUTBOX_LIMIT]; }
/**
 * luma_sync_usage_get_held:
 * @self: usage
 * Returns: records whose write is held until their siblings are resolved
 */
guint luma_sync_usage_get_held (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), 0); return self->held; }
/**
 * luma_sync_usage_get_limited_by:
 * @self: usage
 * Returns: the limit holding writes back ("rate_writes", "record_bytes", …), or ""
 */
const char *luma_sync_usage_get_limited_by (LumaSyncUsage *self) { g_return_val_if_fail (LUMA_IS_SYNC_USAGE (self), NULL); return self->limited_by; }
