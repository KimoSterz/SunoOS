/* SPDX-License-Identifier: Apache-2.0 */
/* The value types of Suno-sync.h: enums, errors, devices, records, results, changes, leases, assets, usage.
 * Each is built from the portal's a{sv} answer (Suno-sync-private.h). */

#include "Suno-sync-private.h"

#include <string.h>

#ifdef G_OS_UNIX
#include <gio/gunixinputstream.h>
#endif

G_DEFINE_ENUM_TYPE (SunoSyncStatus, Suno_sync_status,
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_AVAILABLE, "available"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_OFF, "off"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_NO_ACCOUNT, "no-account"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_NOT_ALLOWED, "not-allowed"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_OFFERED, "offered"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_UNVERIFIED, "unverified"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_NOT_APPROVED, "not-approved"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_REVOKED, "revoked"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_SUSPENDED, "suspended"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_STATUS_UNAVAILABLE, "unavailable"))

G_DEFINE_ENUM_TYPE (SunoSyncDeviceKind, Suno_sync_device_kind,
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_DEVICE_KIND_UNKNOWN, "unknown"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_DEVICE_KIND_COMPUTER, "computer"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_DEVICE_KIND_HANDHELD, "handheld"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_DEVICE_KIND_TV, "tv"))

G_DEFINE_ENUM_TYPE (SunoSyncOutcome, Suno_sync_outcome,
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_OUTCOME_SAVED, "saved"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_OUTCOME_CONFLICT, "conflict"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_OUTCOME_KEPT_BOTH, "kept-both"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_OUTCOME_QUEUED, "queued"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_OUTCOME_TOO_MANY_SIBLINGS, "too-many-siblings"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_OUTCOME_LOCAL, "local"))

G_DEFINE_ENUM_TYPE (SunoSyncConflictPolicy, Suno_sync_conflict_policy,
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_CONFLICT_KEEP_BOTH, "keep-both"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_CONFLICT_FAIL, "fail"))

G_DEFINE_FLAGS_TYPE (SunoSyncRecordFlags, Suno_sync_record_flags,
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_RECORD_NONE, "none"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_RECORD_DELETED, "deleted"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_RECORD_QUEUED, "queued"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_RECORD_HELD, "held"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_RECORD_DELETE_DROPPED, "delete-dropped"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_RECORD_SIBLING, "sibling"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_RECORD_MINE, "mine"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_RECORD_LOCAL_ONLY, "local-only"))

G_DEFINE_ENUM_TYPE (SunoSyncAssetState, Suno_sync_asset_state,
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ASSET_HERE, "here"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ASSET_NOT_HERE, "not-here"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ASSET_FETCHING, "fetching"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ASSET_GONE, "gone"))

G_DEFINE_FLAGS_TYPE (SunoSyncAssetFlags, Suno_sync_asset_flags,
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ASSET_FLAGS_NONE, "none"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ASSET_FLAGS_ON_DEMAND, "on-demand"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ASSET_FLAGS_HERE, "here"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ASSET_FLAGS_PINNED, "pinned"))

G_DEFINE_ENUM_TYPE (SunoSyncError, Suno_sync_error,
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_FAILED, "failed"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_INVALID, "invalid"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_TOO_LARGE, "too-large"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_QUOTA, "quota"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_RATE_LIMITED, "rate-limited"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_REFUSED, "refused"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_NOT_FOUND, "not-found"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_BAD_DESCRIPTOR, "bad-descriptor"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_TIMED_OUT, "timed-out"),
  G_DEFINE_ENUM_VALUE (SUNO_SYNC_ERROR_NOT_SUPPORTED, "not-supported"))

static const GDBusErrorEntry sync_error_entries[] = {
  { SUNO_SYNC_ERROR_FAILED, SUNO_SYNC_DBUS_ERROR ".Failed" },
  { SUNO_SYNC_ERROR_INVALID, SUNO_SYNC_DBUS_ERROR ".Invalid" },
  { SUNO_SYNC_ERROR_TOO_LARGE, SUNO_SYNC_DBUS_ERROR ".TooLarge" },
  { SUNO_SYNC_ERROR_QUOTA, SUNO_SYNC_DBUS_ERROR ".Quota" },
  { SUNO_SYNC_ERROR_RATE_LIMITED, SUNO_SYNC_DBUS_ERROR ".RateLimited" },
  { SUNO_SYNC_ERROR_REFUSED, SUNO_SYNC_DBUS_ERROR ".Refused" },
  { SUNO_SYNC_ERROR_NOT_FOUND, SUNO_SYNC_DBUS_ERROR ".NotFound" },
  { SUNO_SYNC_ERROR_BAD_DESCRIPTOR, SUNO_SYNC_DBUS_ERROR ".BadDescriptor" },
  { SUNO_SYNC_ERROR_TIMED_OUT, SUNO_SYNC_DBUS_ERROR ".TimedOut" },
  { SUNO_SYNC_ERROR_NOT_SUPPORTED, SUNO_SYNC_DBUS_ERROR ".NotSupported" },
};

/**
 * Suno_sync_error_quark:
 *
 * Returns: the error domain of the Sync portal's errors; D-Bus errors of the
 *   portal arrive in it.
 */
GQuark
Suno_sync_error_quark (void)
{
  static gsize quark = 0;

  g_dbus_error_register_error_domain ("Suno-sync-error-quark", &quark, sync_error_entries,
                                      G_N_ELEMENTS (sync_error_entries));
  return (GQuark) quark;
}

static const char *const status_names[] = {
  "available", "off", "no-account", "not-allowed", "offered", "unverified", "not-approved", "revoked", "suspended",
  "unavailable",
};
G_STATIC_ASSERT (G_N_ELEMENTS (status_names) == SUNO_SYNC_STATUS_UNAVAILABLE + 1);

/**
 * Suno_sync_status_to_string:
 * @status: a status
 *
 * Returns: the portal's name for @status ("not-approved", …)
 */
const char *
Suno_sync_status_to_string (SunoSyncStatus status)
{
  g_return_val_if_fail (status <= SUNO_SYNC_STATUS_UNAVAILABLE, "unavailable");
  return status_names[status];
}

/**
 * Suno_sync_status_from_string:
 * @text: (nullable): a portal status name
 *
 * Returns: the status, or %SUNO_SYNC_STATUS_UNAVAILABLE for an unknown name
 */
SunoSyncStatus
Suno_sync_status_from_string (const char *text)
{
  for (guint i = 0; text != NULL && i < G_N_ELEMENTS (status_names); i++)
    if (g_str_equal (text, status_names[i]))
      return (SunoSyncStatus) i;
  return SUNO_SYNC_STATUS_UNAVAILABLE;
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

struct _SunoSyncDevice
{
  GObject parent_instance;
  char *handle;
  char *name;
  SunoSyncDeviceKind kind;
  gboolean mine;
};

G_DEFINE_FINAL_TYPE (SunoSyncDevice, Suno_sync_device, G_TYPE_OBJECT)

static void
Suno_sync_device_finalize (GObject *object)
{
  SunoSyncDevice *self = SUNO_SYNC_DEVICE (object);

  g_free (self->handle);
  g_free (self->name);
  G_OBJECT_CLASS (Suno_sync_device_parent_class)->finalize (object);
}

static void
Suno_sync_device_class_init (SunoSyncDeviceClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = Suno_sync_device_finalize;
}

static void
Suno_sync_device_init (SunoSyncDevice *self G_GNUC_UNUSED)
{
}

SunoSyncDevice *
Suno_sync_device_new_from_variant (GVariant *dict)
{
  SunoSyncDevice *self = g_object_new (SUNO_TYPE_SYNC_DEVICE, NULL);
  const char *kind = lookup_string (dict, "class");

  self->handle = g_strdup (lookup_string (dict, "handle"));
  self->name = g_strdup (lookup_string (dict, "name"));
  self->kind = g_str_equal (kind, "computer") ? SUNO_SYNC_DEVICE_KIND_COMPUTER
             : g_str_equal (kind, "handheld") ? SUNO_SYNC_DEVICE_KIND_HANDHELD
             : g_str_equal (kind, "tv") ? SUNO_SYNC_DEVICE_KIND_TV
             : SUNO_SYNC_DEVICE_KIND_UNKNOWN;
  self->mine = lookup_bool (dict, "mine");
  return self;
}

/**
 * Suno_sync_device_get_handle:
 * @self: a device
 * Returns: the device's handle, stable for this app only
 */
const char *Suno_sync_device_get_handle (SunoSyncDevice *self) { g_return_val_if_fail (SUNO_IS_SYNC_DEVICE (self), NULL); return self->handle; }
/**
 * Suno_sync_device_get_name:
 * @self: a device
 * Returns: the name the person gave the device
 */
const char *Suno_sync_device_get_name (SunoSyncDevice *self) { g_return_val_if_fail (SUNO_IS_SYNC_DEVICE (self), NULL); return self->name; }
/**
 * Suno_sync_device_get_kind:
 * @self: a device
 * Returns: the device's class
 */
SunoSyncDeviceKind Suno_sync_device_get_kind (SunoSyncDevice *self) { g_return_val_if_fail (SUNO_IS_SYNC_DEVICE (self), 0); return self->kind; }
/**
 * Suno_sync_device_get_mine:
 * @self: a device
 * Returns: whether it is this device
 */
gboolean Suno_sync_device_get_mine (SunoSyncDevice *self) { g_return_val_if_fail (SUNO_IS_SYNC_DEVICE (self), FALSE); return self->mine; }

/* ------------------------------------------------------------------ record */

typedef struct
{
  char *name;
  gint64 size;
  SunoSyncAssetFlags flags;
} AssetMeta;

struct _SunoSyncRecord
{
  GObject parent_instance;
  char *name;
  GBytes *value;
  char *version;
  SunoSyncDevice *writer;
  SunoSyncDevice *resolved_by;
  gint64 time_ms;
  SunoSyncRecordFlags flags;
  GStrv asset_names;
  GArray *assets;              /* AssetMeta */
  GPtrArray *siblings;         /* SunoSyncRecord */
};

G_DEFINE_FINAL_TYPE (SunoSyncRecord, Suno_sync_record, G_TYPE_OBJECT)

static void
asset_meta_clear (gpointer data)
{
  g_free (((AssetMeta *) data)->name);
}

static void
Suno_sync_record_finalize (GObject *object)
{
  SunoSyncRecord *self = SUNO_SYNC_RECORD (object);

  g_free (self->name);
  g_clear_pointer (&self->value, g_bytes_unref);
  g_free (self->version);
  g_clear_object (&self->writer);
  g_clear_object (&self->resolved_by);
  g_strfreev (self->asset_names);
  g_clear_pointer (&self->assets, g_array_unref);
  g_clear_pointer (&self->siblings, g_ptr_array_unref);
  G_OBJECT_CLASS (Suno_sync_record_parent_class)->finalize (object);
}

static void
Suno_sync_record_class_init (SunoSyncRecordClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = Suno_sync_record_finalize;
}

static void
Suno_sync_record_init (SunoSyncRecord *self G_GNUC_UNUSED)
{
}

SunoSyncRecord *
Suno_sync_record_new_from_variant (GVariant *dict)
{
  SunoSyncRecord *self = g_object_new (SUNO_TYPE_SYNC_RECORD, NULL);
  g_autoptr(GVariant) value = g_variant_lookup_value (dict, "value", G_VARIANT_TYPE_BYTESTRING);
  g_autoptr(GVariant) writer = g_variant_lookup_value (dict, "writer", G_VARIANT_TYPE_VARDICT);
  g_autoptr(GVariant) resolved = g_variant_lookup_value (dict, "resolved_by", G_VARIANT_TYPE_VARDICT);
  g_autoptr(GVariant) assets = g_variant_lookup_value (dict, "assets", G_VARIANT_TYPE ("aa{sv}"));
  g_autoptr(GVariant) siblings = g_variant_lookup_value (dict, "siblings", G_VARIANT_TYPE ("aa{sv}"));
  g_autoptr(GStrvBuilder) names = g_strv_builder_new ();

  self->name = g_strdup (lookup_string (dict, "name"));
  self->version = g_strdup (lookup_string (dict, "version"));
  self->time_ms = lookup_int64 (dict, "time_ms");
  self->flags = (SunoSyncRecordFlags) lookup_int64 (dict, "flags");
  self->value = value ? g_variant_get_data_as_bytes (value) : g_bytes_new (NULL, 0);
  self->writer = writer ? Suno_sync_device_new_from_variant (writer) : NULL;
  self->resolved_by = resolved ? Suno_sync_device_new_from_variant (resolved) : NULL;
  self->assets = g_array_new (FALSE, TRUE, sizeof (AssetMeta));
  g_array_set_clear_func (self->assets, asset_meta_clear);
  self->siblings = g_ptr_array_new_with_free_func (g_object_unref);

  for (gsize i = 0; assets != NULL && i < g_variant_n_children (assets); i++)
    {
      g_autoptr(GVariant) entry = g_variant_get_child_value (assets, i);
      AssetMeta meta = { g_strdup (lookup_string (entry, "name")), lookup_int64 (entry, "size"),
                         (SunoSyncAssetFlags) lookup_int64 (entry, "flags") };

      g_strv_builder_add (names, meta.name);
      g_array_append_val (self->assets, meta);
    }
  self->asset_names = g_strv_builder_end (names);

  for (gsize i = 0; siblings != NULL && i < g_variant_n_children (siblings); i++)
    {
      g_autoptr(GVariant) entry = g_variant_get_child_value (siblings, i);
      g_ptr_array_add (self->siblings, Suno_sync_record_new_from_variant (entry));
    }
  return self;
}

static const AssetMeta *
record_asset (SunoSyncRecord *self, const char *name)
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
 * Suno_sync_record_get_name:
 * @self: a record
 * Returns: the record's name
 */
const char *Suno_sync_record_get_name (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), NULL); return self->name; }
/**
 * Suno_sync_record_get_value:
 * @self: a record
 * Returns: (transfer none): the value (empty for a deleted record)
 */
GBytes *Suno_sync_record_get_value (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), NULL); return self->value; }
/**
 * Suno_sync_record_get_version:
 * @self: a record
 * Returns: the version, the base of the next write over it
 */
const char *Suno_sync_record_get_version (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), NULL); return self->version; }
/**
 * Suno_sync_record_get_writer:
 * @self: a record
 * Returns: (transfer none) (nullable): the device that wrote this version
 */
SunoSyncDevice *Suno_sync_record_get_writer (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), NULL); return self->writer; }
/**
 * Suno_sync_record_get_time_ms:
 * @self: a record
 * Returns: when it was written, in milliseconds since the Unix epoch, UTC (hybrid logical clock)
 */
gint64 Suno_sync_record_get_time_ms (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), 0); return self->time_ms; }
/**
 * Suno_sync_record_get_resolved_by:
 * @self: a record
 * Returns: (transfer none) (nullable): the device that chose this version among siblings
 */
SunoSyncDevice *Suno_sync_record_get_resolved_by (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), NULL); return self->resolved_by; }
/**
 * Suno_sync_record_get_flags:
 * @self: a record
 * Returns: the record's flags
 */
SunoSyncRecordFlags Suno_sync_record_get_flags (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), 0); return self->flags; }
/**
 * Suno_sync_record_get_mine:
 * @self: a record
 * Returns: whether this device wrote it
 */
gboolean Suno_sync_record_get_mine (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), FALSE); return (self->flags & SUNO_SYNC_RECORD_MINE) != 0; }
/**
 * Suno_sync_record_get_held:
 * @self: a record
 * Returns: whether a write of this device is held until the siblings are resolved
 */
gboolean Suno_sync_record_get_held (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), FALSE); return (self->flags & SUNO_SYNC_RECORD_HELD) != 0; }
/**
 * Suno_sync_record_get_deleted:
 * @self: a record
 * Returns: whether the record was deleted
 */
gboolean Suno_sync_record_get_deleted (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), FALSE); return (self->flags & SUNO_SYNC_RECORD_DELETED) != 0; }
/**
 * Suno_sync_record_get_delete_dropped:
 * @self: a record
 * Returns: whether a queued delete of this device was dropped
 */
gboolean Suno_sync_record_get_delete_dropped (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), FALSE); return (self->flags & SUNO_SYNC_RECORD_DELETE_DROPPED) != 0; }
/**
 * Suno_sync_record_get_asset_names:
 * @self: a record
 * Returns: (transfer none) (array zero-terminated=1): the asset names
 */
const char * const *Suno_sync_record_get_asset_names (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), NULL); return (const char * const *) self->asset_names; }
/**
 * Suno_sync_record_get_siblings:
 * @self: a record
 * Returns: (transfer none) (element-type SunoSyncRecord): the other live versions, newest first
 */
GPtrArray *Suno_sync_record_get_siblings (SunoSyncRecord *self) { g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), NULL); return self->siblings; }

/**
 * Suno_sync_record_get_asset_size:
 * @self: a record
 * @name: an asset name
 *
 * Returns: the asset's size in bytes, or -1 when the record has no such asset
 */
gint64
Suno_sync_record_get_asset_size (SunoSyncRecord *self, const char *name)
{
  const AssetMeta *meta;

  g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), -1);
  meta = record_asset (self, name);
  return meta ? meta->size : -1;
}

/**
 * Suno_sync_record_get_asset_flags:
 * @self: a record
 * @name: an asset name
 *
 * Returns: whether the asset is on-demand, here and pinned (none for no such asset)
 */
SunoSyncAssetFlags
Suno_sync_record_get_asset_flags (SunoSyncRecord *self, const char *name)
{
  const AssetMeta *meta;

  g_return_val_if_fail (SUNO_IS_SYNC_RECORD (self), 0);
  meta = record_asset (self, name);
  return meta ? meta->flags : SUNO_SYNC_ASSET_FLAGS_NONE;
}

/* ------------------------------------------------------------------ write result */

struct _SunoSyncWriteResult
{
  GObject parent_instance;
  char *name;
  SunoSyncOutcome outcome;
  SunoSyncRecord *record;
};

G_DEFINE_FINAL_TYPE (SunoSyncWriteResult, Suno_sync_write_result, G_TYPE_OBJECT)

static void
Suno_sync_write_result_finalize (GObject *object)
{
  SunoSyncWriteResult *self = SUNO_SYNC_WRITE_RESULT (object);

  g_free (self->name);
  g_clear_object (&self->record);
  G_OBJECT_CLASS (Suno_sync_write_result_parent_class)->finalize (object);
}

static void
Suno_sync_write_result_class_init (SunoSyncWriteResultClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = Suno_sync_write_result_finalize;
}

static void
Suno_sync_write_result_init (SunoSyncWriteResult *self G_GNUC_UNUSED)
{
}

SunoSyncWriteResult *
Suno_sync_write_result_new_from_variant (GVariant *dict)
{
  SunoSyncWriteResult *self = g_object_new (SUNO_TYPE_SYNC_WRITE_RESULT, NULL);
  g_autoptr(GVariant) record = g_variant_lookup_value (dict, "record", G_VARIANT_TYPE_VARDICT);
  const char *outcome = lookup_string (dict, "outcome");

  self->name = g_strdup (lookup_string (dict, "name"));
  self->outcome = g_str_equal (outcome, "conflict") ? SUNO_SYNC_OUTCOME_CONFLICT
                : g_str_equal (outcome, "kept-both") ? SUNO_SYNC_OUTCOME_KEPT_BOTH
                : g_str_equal (outcome, "queued") ? SUNO_SYNC_OUTCOME_QUEUED
                : g_str_equal (outcome, "too-many-siblings") ? SUNO_SYNC_OUTCOME_TOO_MANY_SIBLINGS
                : g_str_equal (outcome, "local") ? SUNO_SYNC_OUTCOME_LOCAL
                : SUNO_SYNC_OUTCOME_SAVED;
  if (record != NULL)
    self->record = Suno_sync_record_new_from_variant (record);
  return self;
}

/**
 * Suno_sync_write_result_get_name:
 * @self: a write result
 * Returns: the record's name
 */
const char *Suno_sync_write_result_get_name (SunoSyncWriteResult *self) { g_return_val_if_fail (SUNO_IS_SYNC_WRITE_RESULT (self), NULL); return self->name; }
/**
 * Suno_sync_write_result_get_outcome:
 * @self: a write result
 * Returns: what the write did
 */
SunoSyncOutcome Suno_sync_write_result_get_outcome (SunoSyncWriteResult *self) { g_return_val_if_fail (SUNO_IS_SYNC_WRITE_RESULT (self), 0); return self->outcome; }
/**
 * Suno_sync_write_result_get_record:
 * @self: a write result
 * Returns: (transfer none) (nullable): the record as it now is
 */
SunoSyncRecord *Suno_sync_write_result_get_record (SunoSyncWriteResult *self) { g_return_val_if_fail (SUNO_IS_SYNC_WRITE_RESULT (self), NULL); return self->record; }

/* ------------------------------------------------------------------ changes */

struct _SunoSyncChanges
{
  GObject parent_instance;
  GPtrArray *records;
  char *token;
  gboolean more;
};

G_DEFINE_FINAL_TYPE (SunoSyncChanges, Suno_sync_changes, G_TYPE_OBJECT)

static void
Suno_sync_changes_finalize (GObject *object)
{
  SunoSyncChanges *self = SUNO_SYNC_CHANGES (object);

  g_clear_pointer (&self->records, g_ptr_array_unref);
  g_free (self->token);
  G_OBJECT_CLASS (Suno_sync_changes_parent_class)->finalize (object);
}

static void
Suno_sync_changes_class_init (SunoSyncChangesClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = Suno_sync_changes_finalize;
}

static void
Suno_sync_changes_init (SunoSyncChanges *self G_GNUC_UNUSED)
{
}

SunoSyncChanges *
Suno_sync_changes_new (GPtrArray *records, const char *token, gboolean more)
{
  SunoSyncChanges *self = g_object_new (SUNO_TYPE_SYNC_CHANGES, NULL);

  self->records = g_ptr_array_ref (records);
  self->token = g_strdup (token);
  self->more = more;
  return self;
}

/**
 * Suno_sync_changes_get_records:
 * @self: changes
 * Returns: (transfer none) (element-type SunoSyncRecord): the changed records
 */
GPtrArray *Suno_sync_changes_get_records (SunoSyncChanges *self) { g_return_val_if_fail (SUNO_IS_SYNC_CHANGES (self), NULL); return self->records; }
/**
 * Suno_sync_changes_get_token:
 * @self: changes
 * Returns: the token to fetch from next time; the app keeps it
 */
const char *Suno_sync_changes_get_token (SunoSyncChanges *self) { g_return_val_if_fail (SUNO_IS_SYNC_CHANGES (self), NULL); return self->token; }
/**
 * Suno_sync_changes_get_more:
 * @self: changes
 * Returns: whether there is more to fetch now
 */
gboolean Suno_sync_changes_get_more (SunoSyncChanges *self) { g_return_val_if_fail (SUNO_IS_SYNC_CHANGES (self), FALSE); return self->more; }

/* ------------------------------------------------------------------ lease */

struct _SunoSyncLease
{
  GObject parent_instance;
  char *record;
  SunoSyncDevice *holder;
  gint64 until_ms;
  gboolean mine;
  gboolean active;
};

G_DEFINE_FINAL_TYPE (SunoSyncLease, Suno_sync_lease, G_TYPE_OBJECT)

static void
Suno_sync_lease_finalize (GObject *object)
{
  SunoSyncLease *self = SUNO_SYNC_LEASE (object);

  g_free (self->record);
  g_clear_object (&self->holder);
  G_OBJECT_CLASS (Suno_sync_lease_parent_class)->finalize (object);
}

static void
Suno_sync_lease_class_init (SunoSyncLeaseClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = Suno_sync_lease_finalize;
}

static void
Suno_sync_lease_init (SunoSyncLease *self G_GNUC_UNUSED)
{
}

SunoSyncLease *
Suno_sync_lease_new_from_variant (GVariant *dict)
{
  SunoSyncLease *self = g_object_new (SUNO_TYPE_SYNC_LEASE, NULL);
  g_autoptr(GVariant) holder = g_variant_lookup_value (dict, "holder", G_VARIANT_TYPE_VARDICT);

  self->record = g_strdup (lookup_string (dict, "record"));
  self->active = lookup_bool (dict, "active");
  self->mine = self->active && lookup_bool (dict, "mine");
  self->until_ms = self->active ? lookup_int64 (dict, "until_ms") : 0;
  self->holder = (holder != NULL && self->active) ? Suno_sync_device_new_from_variant (holder) : NULL;
  return self;
}

/**
 * Suno_sync_lease_get_record:
 * @self: a lease
 * Returns: the record's name
 */
const char *Suno_sync_lease_get_record (SunoSyncLease *self) { g_return_val_if_fail (SUNO_IS_SYNC_LEASE (self), NULL); return self->record; }
/**
 * Suno_sync_lease_get_holder:
 * @self: a lease
 * Returns: (transfer none) (nullable): the holding device, %NULL when no lease is active
 */
SunoSyncDevice *Suno_sync_lease_get_holder (SunoSyncLease *self) { g_return_val_if_fail (SUNO_IS_SYNC_LEASE (self), NULL); return self->holder; }
/**
 * Suno_sync_lease_get_until_ms:
 * @self: a lease
 * Returns: until when, in milliseconds since the Unix epoch, UTC; 0 when no lease is active
 */
gint64 Suno_sync_lease_get_until_ms (SunoSyncLease *self) { g_return_val_if_fail (SUNO_IS_SYNC_LEASE (self), 0); return self->until_ms; }
/**
 * Suno_sync_lease_get_mine:
 * @self: a lease
 * Returns: whether this device holds it
 */
gboolean Suno_sync_lease_get_mine (SunoSyncLease *self) { g_return_val_if_fail (SUNO_IS_SYNC_LEASE (self), FALSE); return self->mine; }
/**
 * Suno_sync_lease_get_active:
 * @self: a lease
 * Returns: whether an unexpired lease exists until Suno_sync_lease_get_until_ms()
 */
gboolean Suno_sync_lease_get_active (SunoSyncLease *self) { g_return_val_if_fail (SUNO_IS_SYNC_LEASE (self), FALSE); return self->active; }

/* ------------------------------------------------------------------ asset */

struct _SunoSyncAsset
{
  GObject parent_instance;
  char *record;
  char *name;
  char *version;
  char *where;
  SunoSyncAssetState state;
  SunoSyncAssetFlags flags;
  gint64 size;
  SunoSyncDevice *holder;
  GInputStream *stream;
};

G_DEFINE_FINAL_TYPE (SunoSyncAsset, Suno_sync_asset, G_TYPE_OBJECT)

static void
Suno_sync_asset_finalize (GObject *object)
{
  SunoSyncAsset *self = SUNO_SYNC_ASSET (object);

  g_free (self->record);
  g_free (self->name);
  g_free (self->version);
  g_free (self->where);
  g_clear_object (&self->holder);
  g_clear_object (&self->stream);
  G_OBJECT_CLASS (Suno_sync_asset_parent_class)->finalize (object);
}

static void
Suno_sync_asset_class_init (SunoSyncAssetClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = Suno_sync_asset_finalize;
}

static void
Suno_sync_asset_init (SunoSyncAsset *self G_GNUC_UNUSED)
{
}

SunoSyncAsset *
Suno_sync_asset_new (const char *record, const char *name, const char *state, GVariant *info, int fd)
{
  SunoSyncAsset *self = g_object_new (SUNO_TYPE_SYNC_ASSET, NULL);
  g_autoptr(GVariant) holder = info ? g_variant_lookup_value (info, "holder", G_VARIANT_TYPE_VARDICT) : NULL;

  self->record = g_strdup (record);
  self->name = g_strdup (name);
  self->version = g_strdup (lookup_string (info, "version"));
  self->where = g_strdup (lookup_string (info, "where"));
  self->size = lookup_int64 (info, "size");
  self->flags = (SunoSyncAssetFlags) lookup_int64 (info, "flags");
  self->state = g_str_equal (state, "here") ? SUNO_SYNC_ASSET_HERE
              : g_str_equal (state, "not-here") ? SUNO_SYNC_ASSET_NOT_HERE
              : g_str_equal (state, "fetching") ? SUNO_SYNC_ASSET_FETCHING
              : SUNO_SYNC_ASSET_GONE;
  self->holder = holder ? Suno_sync_device_new_from_variant (holder) : NULL;
#ifdef G_OS_UNIX
  if (fd >= 0)
    self->stream = g_unix_input_stream_new (fd, TRUE);
#else
  (void) fd;
#endif
  if (self->state == SUNO_SYNC_ASSET_HERE && self->stream == NULL)
    self->state = SUNO_SYNC_ASSET_GONE;
  return self;
}

/**
 * Suno_sync_asset_get_record:
 * @self: an asset
 * Returns: the record's name
 */
const char *Suno_sync_asset_get_record (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), NULL); return self->record; }
/**
 * Suno_sync_asset_get_name:
 * @self: an asset
 * Returns: the asset's name
 */
const char *Suno_sync_asset_get_name (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), NULL); return self->name; }
/**
 * Suno_sync_asset_get_version:
 * @self: an asset
 * Returns: the version of the record it belongs to
 */
const char *Suno_sync_asset_get_version (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), NULL); return self->version; }
/**
 * Suno_sync_asset_get_state:
 * @self: an asset
 * Returns: where the bytes are
 */
SunoSyncAssetState Suno_sync_asset_get_state (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), SUNO_SYNC_ASSET_GONE); return self->state; }
/**
 * Suno_sync_asset_get_flags:
 * @self: an asset
 * Returns: on-demand, here, pinned
 */
SunoSyncAssetFlags Suno_sync_asset_get_flags (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), 0); return self->flags; }
/**
 * Suno_sync_asset_get_size:
 * @self: an asset
 * Returns: its size in bytes
 */
gint64 Suno_sync_asset_get_size (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), 0); return self->size; }
/**
 * Suno_sync_asset_get_holder:
 * @self: an asset
 * Returns: (transfer none) (nullable): the device holding the bytes, for an on-demand asset
 */
SunoSyncDevice *Suno_sync_asset_get_holder (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), NULL); return self->holder; }
/**
 * Suno_sync_asset_get_where:
 * @self: an asset
 * Returns: where the bytes are, for the person ("On Dell XPS 14 · offline"), or ""
 */
const char *Suno_sync_asset_get_where (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), NULL); return self->where; }
/**
 * Suno_sync_asset_get_stream:
 * @self: an asset
 * Returns: (transfer none) (nullable): a read-only stream of a private, sealed copy, when the bytes are here
 */
GInputStream *Suno_sync_asset_get_stream (SunoSyncAsset *self) { g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), NULL); return self->stream; }

/**
 * Suno_sync_asset_read_all:
 * @self: an asset
 * @cancellable: (nullable): a #GCancellable
 * @error: a #GError
 *
 * Returns: (transfer full) (nullable): all of the asset's bytes
 */
GBytes *
Suno_sync_asset_read_all (SunoSyncAsset *self, GCancellable *cancellable, GError **error)
{
  g_autoptr(GOutputStream) out = NULL;

  g_return_val_if_fail (SUNO_IS_SYNC_ASSET (self), NULL);
  if (self->stream == NULL)
    {
      g_set_error (error, SUNO_SYNC_ERROR, SUNO_SYNC_ERROR_NOT_FOUND, "The asset's bytes aren't on this device");
      return NULL;
    }
  out = g_memory_output_stream_new_resizable ();
  if (g_output_stream_splice (out, self->stream, G_OUTPUT_STREAM_SPLICE_CLOSE_TARGET, cancellable, error) < 0)
    return NULL;
  return g_memory_output_stream_steal_as_bytes (G_MEMORY_OUTPUT_STREAM (out));
}

/* ------------------------------------------------------------------ usage */

struct _SunoSyncUsage
{
  GObject parent_instance;
  guint64 values[10];
  guint zones, zones_limit, held;
  char *limited_by;
};

G_DEFINE_FINAL_TYPE (SunoSyncUsage, Suno_sync_usage, G_TYPE_OBJECT)

static void
Suno_sync_usage_finalize (GObject *object)
{
  g_free (SUNO_SYNC_USAGE (object)->limited_by);
  G_OBJECT_CLASS (Suno_sync_usage_parent_class)->finalize (object);
}

static void
Suno_sync_usage_class_init (SunoSyncUsageClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = Suno_sync_usage_finalize;
}

static void
Suno_sync_usage_init (SunoSyncUsage *self G_GNUC_UNUSED)
{
}

enum { U_RECORD_BYTES, U_RECORD_BYTES_LIMIT, U_ASSET_BYTES, U_ASSET_BYTES_LIMIT, U_RECORDS, U_RECORDS_LIMIT,
       U_OUTBOX, U_OUTBOX_LIMIT };

SunoSyncUsage *
Suno_sync_usage_new_from_variant (GVariant *usage, GVariant *limits)
{
  SunoSyncUsage *self = g_object_new (SUNO_TYPE_SYNC_USAGE, NULL);

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
 * Suno_sync_usage_get_record_bytes:
 * @self: usage
 * Returns: record bytes
 */
guint64 Suno_sync_usage_get_record_bytes (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->values[U_RECORD_BYTES]; }
/**
 * Suno_sync_usage_get_record_bytes_limit:
 * @self: usage
 * Returns: the record bytes limit
 */
guint64 Suno_sync_usage_get_record_bytes_limit (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->values[U_RECORD_BYTES_LIMIT]; }
/**
 * Suno_sync_usage_get_asset_bytes:
 * @self: usage
 * Returns: inline asset bytes
 */
guint64 Suno_sync_usage_get_asset_bytes (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->values[U_ASSET_BYTES]; }
/**
 * Suno_sync_usage_get_asset_bytes_limit:
 * @self: usage
 * Returns: the inline asset bytes limit
 */
guint64 Suno_sync_usage_get_asset_bytes_limit (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->values[U_ASSET_BYTES_LIMIT]; }
/**
 * Suno_sync_usage_get_records:
 * @self: usage
 * Returns: live records
 */
guint64 Suno_sync_usage_get_records (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->values[U_RECORDS]; }
/**
 * Suno_sync_usage_get_records_limit:
 * @self: usage
 * Returns: the records limit
 */
guint64 Suno_sync_usage_get_records_limit (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->values[U_RECORDS_LIMIT]; }
/**
 * Suno_sync_usage_get_zones:
 * @self: usage
 * Returns: zones
 */
guint Suno_sync_usage_get_zones (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->zones; }
/**
 * Suno_sync_usage_get_zones_limit:
 * @self: usage
 * Returns: the zones limit
 */
guint Suno_sync_usage_get_zones_limit (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->zones_limit; }
/**
 * Suno_sync_usage_get_outbox_bytes:
 * @self: usage
 * Returns: bytes waiting to leave
 */
guint64 Suno_sync_usage_get_outbox_bytes (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->values[U_OUTBOX]; }
/**
 * Suno_sync_usage_get_outbox_bytes_limit:
 * @self: usage
 * Returns: the outbox cap
 */
guint64 Suno_sync_usage_get_outbox_bytes_limit (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->values[U_OUTBOX_LIMIT]; }
/**
 * Suno_sync_usage_get_held:
 * @self: usage
 * Returns: records whose write is held until their siblings are resolved
 */
guint Suno_sync_usage_get_held (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), 0); return self->held; }
/**
 * Suno_sync_usage_get_limited_by:
 * @self: usage
 * Returns: the limit holding writes back ("rate_writes", "record_bytes", …), or ""
 */
const char *Suno_sync_usage_get_limited_by (SunoSyncUsage *self) { g_return_val_if_fail (SUNO_IS_SYNC_USAGE (self), NULL); return self->limited_by; }
