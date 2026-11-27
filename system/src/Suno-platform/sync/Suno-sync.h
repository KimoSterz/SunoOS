/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoSyncStore: an app's own data, kept the same on every device of the
 * person's Suno account (ADR-057 §3.7).
 *
 * The library needs GIO alone, so non-GTK apps, games and the Rust core can
 * use it, and it is introspected (namespace SunoSync 1) for C, Python, Rust,
 * JavaScript and Vala.
 *
 * It talks to the org.projectSuno.portal.Sync portal. Every call answers at
 * once from the device: reads come from the local mirror, writes are durable
 * on the device before they return and leave when Sync can send them. When
 * there is no portal (another OS, an older Suno) every call works the same
 * way against a store in the app's own data folder and the status is
 * SUNO_SYNC_STATUS_UNAVAILABLE.
 *
 * Model (ADR-057 §3.3): a store is one zone, named by a short label. A
 * record is a name (UTF-8, at most 255 bytes) and an opaque value (at most
 * 256 KiB) with a version. A record has at most 32 assets. A lease marks a
 * record as in use on one device; it is advisory and never blocks.
 *
 * Versions are opaque strings. A write names the version it was made over
 * (its base); NULL or "" means "this record should not exist yet".
 *
 * Times are milliseconds since the Unix epoch, UTC, in every accessor that
 * ends in _ms. Record and sibling times come from the hybrid logical clock
 * that orders versions (§3.5), never from a writer's raw wall clock.
 *
 * Writes coalesce per record (§2.4): a chain of this device's writes to one
 * record that hasn't left yet (queued, or local-only while the app is
 * suspended or revoked) leaves as ONE version: the last value with its final
 * set of assets, against the base of the first write in the chain. A session
 * offline or paused that saves a value, adds an asset and saves a manifest
 * makes one version, never three siblings.
 *
 * Change tokens belong to the app. The store never advances one by itself:
 * Suno_sync_store_fetch_changes() takes the app's token and returns the
 * records with the next token, and changes no state in the store. An app
 * saves the next token only once it has applied the records, so a crash in
 * between fetches the same records again (crash-safe, at-least-once).
 *
 * Every async call has a _finish and a blocking variant. The blocking
 * variants never wait for the network; they are safe to call while an app
 * quits ("write and quit", §3.6).
 */
#pragma once

#include <gio/gio.h>

G_BEGIN_DECLS

#define SUNO_SYNC_MAJOR_VERSION 1

/* Limits (ADR-057 §3.3 and §5.3). Anything over is refused with
 * SUNO_SYNC_ERROR_TOO_LARGE or SUNO_SYNC_ERROR_INVALID before any work. */
#define SUNO_SYNC_MAX_NAME_BYTES 255
#define SUNO_SYNC_MAX_VALUE_BYTES (256 * 1024)
#define SUNO_SYNC_MAX_RECORDS_PER_CALL 100
#define SUNO_SYNC_MAX_ASSETS_PER_RECORD 32
#define SUNO_SYNC_MAX_INLINE_ASSET_BYTES (G_GINT64_CONSTANT (64) * 1024 * 1024)
#define SUNO_SYNC_MAX_ON_DEMAND_ASSET_BYTES (G_GINT64_CONSTANT (16) * 1000 * 1000 * 1000)
#define SUNO_SYNC_MAX_VERSIONS 4 /* the current version and up to three siblings */
#define SUNO_SYNC_MAX_LEASE_SECONDS 3600

/* ------------------------------------------------------------------ enums */

/**
 * SunoSyncStatus:
 * @SUNO_SYNC_STATUS_AVAILABLE: the app's data syncs.
 * @SUNO_SYNC_STATUS_OFF: the person turned Sync off on this device.
 * @SUNO_SYNC_STATUS_NO_ACCOUNT: the device isn't signed in to Suno Connect.
 * @SUNO_SYNC_STATUS_NOT_ALLOWED: the person turned sync off for this app.
 * @SUNO_SYNC_STATUS_OFFERED: the person hasn't answered the offer yet.
 * @SUNO_SYNC_STATUS_UNVERIFIED: the app's publisher can't be verified, so
 *   nothing is stored and every call but status is refused.
 * @SUNO_SYNC_STATUS_NOT_APPROVED: Suno hasn't approved this app (or approved
 *   another publisher's build of it).
 * @SUNO_SYNC_STATUS_REVOKED: Suno withdrew the app's approval ("Stopped by
 *   Suno"); its synced data is deleted from the Hub and every device.
 * @SUNO_SYNC_STATUS_SUSPENDED: Suno paused the app's approval ("Paused by
 *   Suno"); synced data stays, and sync resumes by itself once Suno approves
 *   the app again.
 * @SUNO_SYNC_STATUS_UNAVAILABLE: there is no Sync portal; data stays in the
 *   app's own folder on this device.
 *
 * Whether the app's data leaves the device.
 *
 * - %SUNO_SYNC_STATUS_AVAILABLE: writes are answered %SUNO_SYNC_OUTCOME_SAVED
 *   (or kept-both, conflict…) and leave in the service's next sync cycle.
 * - %SUNO_SYNC_STATUS_OFF, %SUNO_SYNC_STATUS_NO_ACCOUNT,
 *   %SUNO_SYNC_STATUS_NOT_ALLOWED, %SUNO_SYNC_STATUS_OFFERED and
 *   %SUNO_SYNC_STATUS_NOT_APPROVED: calls work locally and writes are answered
 *   %SUNO_SYNC_OUTCOME_QUEUED; they leave if the state changes, within the
 *   app's outbox cap (64 MB).
 * - %SUNO_SYNC_STATUS_REVOKED and %SUNO_SYNC_STATUS_SUSPENDED: calls work
 *   locally and writes are answered %SUNO_SYNC_OUTCOME_LOCAL: kept on this
 *   device with %SUNO_SYNC_RECORD_LOCAL_ONLY. The outbox was dropped. If Suno
 *   approves the app again, the service offers the local-only versions by
 *   itself (keep-both), oldest first, as new writes against the app's record
 *   and asset quotas and the outbox cap; while an allowance would be
 *   exceeded, offering pauses and Suno_sync_usage_get_limited_by() names it,
 *   and it resumes when there is room. The app does nothing. Leases taken
 *   in these states work on this device only and never leave it.
 * - %SUNO_SYNC_STATUS_UNVERIFIED: nothing is stored; every call but status
 *   fails with %SUNO_SYNC_ERROR_REFUSED.
 * - %SUNO_SYNC_STATUS_UNAVAILABLE: no portal; data stays in the app's own
 *   folder and writes are answered %SUNO_SYNC_OUTCOME_LOCAL.
 *
 * A store's status is the app's, except that a zone label Suno hasn't
 * approved for the app gives that store %SUNO_SYNC_STATUS_NOT_APPROVED with
 * exactly the same behaviour as an app that isn't approved.
 *
 * When several apply, the first of these wins: REVOKED, SUSPENDED,
 * UNVERIFIED, UNAVAILABLE, NOT_APPROVED (for the label or the whole app), NO_ACCOUNT,
 * OFF, NOT_ALLOWED, OFFERED, AVAILABLE.
 */
typedef enum {
  SUNO_SYNC_STATUS_AVAILABLE,
  SUNO_SYNC_STATUS_OFF,
  SUNO_SYNC_STATUS_NO_ACCOUNT,
  SUNO_SYNC_STATUS_NOT_ALLOWED,
  SUNO_SYNC_STATUS_OFFERED,
  SUNO_SYNC_STATUS_UNVERIFIED,
  SUNO_SYNC_STATUS_NOT_APPROVED,
  SUNO_SYNC_STATUS_REVOKED,
  SUNO_SYNC_STATUS_SUSPENDED,
  SUNO_SYNC_STATUS_UNAVAILABLE,
} SunoSyncStatus;

/**
 * SunoSyncDeviceKind:
 * @SUNO_SYNC_DEVICE_KIND_UNKNOWN: not known (local mode).
 * @SUNO_SYNC_DEVICE_KIND_COMPUTER: a laptop or desktop.
 * @SUNO_SYNC_DEVICE_KIND_HANDHELD: a phone, tablet or handheld console.
 * @SUNO_SYNC_DEVICE_KIND_TV: a TV or set-top box.
 *
 * The device class of ADR-057 §3.4 (named kind: "class" is taken by GObject).
 */
typedef enum {
  SUNO_SYNC_DEVICE_KIND_UNKNOWN,
  SUNO_SYNC_DEVICE_KIND_COMPUTER,
  SUNO_SYNC_DEVICE_KIND_HANDHELD,
  SUNO_SYNC_DEVICE_KIND_TV,
} SunoSyncDeviceKind;

/**
 * SunoSyncOutcome:
 * @SUNO_SYNC_OUTCOME_SAVED: written over the base the app named.
 * @SUNO_SYNC_OUTCOME_CONFLICT: the base was stale and the write asked for
 *   %SUNO_SYNC_CONFLICT_FAIL, or it was a delete; nothing changed and the
 *   result carries the current record.
 * @SUNO_SYNC_OUTCOME_KEPT_BOTH: the base was stale; the write was kept and the
 *   other version became a sibling (or the other way round, by clock).
 * @SUNO_SYNC_OUTCOME_QUEUED: kept on the device and waiting to leave (Sync
 *   can't send it now); when it does it always resolves as keep-both (§3.5)
 *   and %SunoSyncStore::changed nudges the app to fetch the outcome. A queued
 *   write that is already stale against the device's mirror answers
 *   @SUNO_SYNC_OUTCOME_KEPT_BOTH instead, with %SUNO_SYNC_RECORD_QUEUED on the
 *   record.
 * @SUNO_SYNC_OUTCOME_TOO_MANY_SIBLINGS: it would have made a fifth version;
 *   nothing changed and the result carries the current record and its
 *   siblings. Call Suno_sync_store_resolve_siblings() first.
 * @SUNO_SYNC_OUTCOME_LOCAL: saved on this device only and never synced: Suno
 *   revoked or suspended the app (%SUNO_SYNC_STATUS_REVOKED,
 *   %SUNO_SYNC_STATUS_SUSPENDED), or there is no portal
 *   (%SUNO_SYNC_STATUS_UNAVAILABLE).
 *
 * What a write did.
 */
typedef enum {
  SUNO_SYNC_OUTCOME_SAVED,
  SUNO_SYNC_OUTCOME_CONFLICT,
  SUNO_SYNC_OUTCOME_KEPT_BOTH,
  SUNO_SYNC_OUTCOME_QUEUED,
  SUNO_SYNC_OUTCOME_TOO_MANY_SIBLINGS,
  SUNO_SYNC_OUTCOME_LOCAL,
} SunoSyncOutcome;

/**
 * SunoSyncConflictPolicy:
 * @SUNO_SYNC_CONFLICT_KEEP_BOTH: a stale write keeps both versions (default).
 * @SUNO_SYNC_CONFLICT_FAIL: a stale write answered while the app waits fails
 *   with the current value, so the app merges. A queued write has no one to
 *   fail to and always keeps both.
 */
typedef enum {
  SUNO_SYNC_CONFLICT_KEEP_BOTH,
  SUNO_SYNC_CONFLICT_FAIL,
} SunoSyncConflictPolicy;

/**
 * SunoSyncRecordFlags:
 * @SUNO_SYNC_RECORD_NONE: nothing special.
 * @SUNO_SYNC_RECORD_DELETED: the record was deleted (only in changes).
 * @SUNO_SYNC_RECORD_QUEUED: this device's write is still waiting to leave.
 * @SUNO_SYNC_RECORD_HELD: a queued write would have made a fifth version and
 *   is held on the device until the app resolves the siblings.
 * @SUNO_SYNC_RECORD_DELETE_DROPPED: a queued delete was older than an edit from
 *   another device and was dropped; the edit stays current.
 * @SUNO_SYNC_RECORD_SIBLING: this is a sibling, not the current version.
 * @SUNO_SYNC_RECORD_MINE: written by this device.
 * @SUNO_SYNC_RECORD_LOCAL_ONLY: written while Suno had suspended or revoked
 *   the app (answered %SUNO_SYNC_OUTCOME_LOCAL). It stays on this device,
 *   never deleted by a purge; when Suno approves the app again the service
 *   offers it through the outbox by itself, keep-both against the version it
 *   was written over, and the flag clears as it is saved.
 */
typedef enum /*< flags >*/ {
  SUNO_SYNC_RECORD_NONE = 0,
  SUNO_SYNC_RECORD_DELETED = 1 << 0,
  SUNO_SYNC_RECORD_QUEUED = 1 << 1,
  SUNO_SYNC_RECORD_HELD = 1 << 2,
  SUNO_SYNC_RECORD_DELETE_DROPPED = 1 << 3,
  SUNO_SYNC_RECORD_SIBLING = 1 << 4,
  SUNO_SYNC_RECORD_MINE = 1 << 5,
  SUNO_SYNC_RECORD_LOCAL_ONLY = 1 << 6,
} SunoSyncRecordFlags;

/**
 * SunoSyncAssetState:
 * @SUNO_SYNC_ASSET_HERE: the bytes are on this device; the asset has a stream.
 * @SUNO_SYNC_ASSET_NOT_HERE: the bytes are on another device (on-demand
 *   assets); Suno_sync_asset_get_where() says where.
 * @SUNO_SYNC_ASSET_FETCHING: on its way to this device; %SunoSyncStore::asset-changed
 *   reports progress.
 * @SUNO_SYNC_ASSET_GONE: no such asset or version (or the version was resolved).
 */
typedef enum {
  SUNO_SYNC_ASSET_HERE,
  SUNO_SYNC_ASSET_NOT_HERE,
  SUNO_SYNC_ASSET_FETCHING,
  SUNO_SYNC_ASSET_GONE,
} SunoSyncAssetState;

/**
 * SunoSyncAssetFlags:
 * @SUNO_SYNC_ASSET_FLAGS_NONE: an inline asset: resident, fetched with its
 *   record, at most 64 MiB.
 * @SUNO_SYNC_ASSET_FLAGS_ON_DEMAND: an on-demand asset: device-held, at most
 *   16 GB; its metadata syncs and the bytes move when a device asks or pins.
 * @SUNO_SYNC_ASSET_FLAGS_HERE: the bytes are on this device now (without it,
 *   not here: on another device, or still on their way).
 * @SUNO_SYNC_ASSET_FLAGS_PINNED: the person or the app pinned it here.
 *
 * What an asset is and where its bytes are. Suno_sync_store_put_asset()
 * reads only %SUNO_SYNC_ASSET_FLAGS_ON_DEMAND.
 */
typedef enum /*< flags >*/ {
  SUNO_SYNC_ASSET_FLAGS_NONE = 0,
  SUNO_SYNC_ASSET_FLAGS_ON_DEMAND = 1 << 0,
  SUNO_SYNC_ASSET_FLAGS_HERE = 1 << 1,
  SUNO_SYNC_ASSET_FLAGS_PINNED = 1 << 2,
} SunoSyncAssetFlags;

/**
 * SunoSyncError:
 * @SUNO_SYNC_ERROR_FAILED: something else went wrong.
 * @SUNO_SYNC_ERROR_INVALID: a malformed argument (zone label, name, version).
 * @SUNO_SYNC_ERROR_TOO_LARGE: over a size cap (§5.3).
 * @SUNO_SYNC_ERROR_QUOTA: over one of the app's quotas (§5.1); the message
 *   names the allowance.
 * @SUNO_SYNC_ERROR_RATE_LIMITED: too many calls (§5.2); try later.
 * @SUNO_SYNC_ERROR_REFUSED: the app's status doesn't allow it
 *   (%SUNO_SYNC_STATUS_UNVERIFIED: no publisher can be verified).
 * @SUNO_SYNC_ERROR_NOT_FOUND: no such record.
 * @SUNO_SYNC_ERROR_BAD_DESCRIPTOR: an asset descriptor that isn't a sealed
 *   memfd or a regular file outside FUSE, or that changed while copied.
 * @SUNO_SYNC_ERROR_TIMED_OUT: a call or a copy ran past its deadline.
 * @SUNO_SYNC_ERROR_NOT_SUPPORTED: an option this Suno doesn't keep yet.
 */
typedef enum {
  SUNO_SYNC_ERROR_FAILED,
  SUNO_SYNC_ERROR_INVALID,
  SUNO_SYNC_ERROR_TOO_LARGE,
  SUNO_SYNC_ERROR_QUOTA,
  SUNO_SYNC_ERROR_RATE_LIMITED,
  SUNO_SYNC_ERROR_REFUSED,
  SUNO_SYNC_ERROR_NOT_FOUND,
  SUNO_SYNC_ERROR_BAD_DESCRIPTOR,
  SUNO_SYNC_ERROR_TIMED_OUT,
  SUNO_SYNC_ERROR_NOT_SUPPORTED,
} SunoSyncError;

#define SUNO_SYNC_ERROR (Suno_sync_error_quark ())
GQuark Suno_sync_error_quark (void);

#define SUNO_TYPE_SYNC_STATUS (Suno_sync_status_get_type ())
#define SUNO_TYPE_SYNC_DEVICE_KIND (Suno_sync_device_kind_get_type ())
#define SUNO_TYPE_SYNC_OUTCOME (Suno_sync_outcome_get_type ())
#define SUNO_TYPE_SYNC_CONFLICT_POLICY (Suno_sync_conflict_policy_get_type ())
#define SUNO_TYPE_SYNC_RECORD_FLAGS (Suno_sync_record_flags_get_type ())
#define SUNO_TYPE_SYNC_ASSET_STATE (Suno_sync_asset_state_get_type ())
#define SUNO_TYPE_SYNC_ASSET_FLAGS (Suno_sync_asset_flags_get_type ())
#define SUNO_TYPE_SYNC_ERROR (Suno_sync_error_get_type ())
GType Suno_sync_status_get_type (void) G_GNUC_CONST;
GType Suno_sync_device_kind_get_type (void) G_GNUC_CONST;
GType Suno_sync_outcome_get_type (void) G_GNUC_CONST;
GType Suno_sync_conflict_policy_get_type (void) G_GNUC_CONST;
GType Suno_sync_record_flags_get_type (void) G_GNUC_CONST;
GType Suno_sync_asset_state_get_type (void) G_GNUC_CONST;
GType Suno_sync_asset_flags_get_type (void) G_GNUC_CONST;
GType Suno_sync_error_get_type (void) G_GNUC_CONST;

/* The portal's wire names ("available", "not-approved", …). */
const char *Suno_sync_status_to_string (SunoSyncStatus status);
SunoSyncStatus Suno_sync_status_from_string (const char *text);

/* ------------------------------------------------------------------ device */

/**
 * SunoSyncDevice:
 *
 * One of the person's devices as an app sees it: a handle that is stable for
 * this app only (two apps get different handles for one device), the
 * device's class and the name the person gave it. Nothing else identifies a
 * device or a person.
 */
#define SUNO_TYPE_SYNC_DEVICE (Suno_sync_device_get_type ())
G_DECLARE_FINAL_TYPE (SunoSyncDevice, Suno_sync_device, SUNO, SYNC_DEVICE, GObject)

const char *Suno_sync_device_get_handle (SunoSyncDevice *self);
const char *Suno_sync_device_get_name (SunoSyncDevice *self);
SunoSyncDeviceKind Suno_sync_device_get_kind (SunoSyncDevice *self);
gboolean Suno_sync_device_get_mine (SunoSyncDevice *self);

/* ------------------------------------------------------------------ record */

/**
 * SunoSyncRecord:
 *
 * One version of a record: the current one or a sibling. Immutable.
 */
#define SUNO_TYPE_SYNC_RECORD (Suno_sync_record_get_type ())
G_DECLARE_FINAL_TYPE (SunoSyncRecord, Suno_sync_record, SUNO, SYNC_RECORD, GObject)

const char *Suno_sync_record_get_name (SunoSyncRecord *self);
GBytes *Suno_sync_record_get_value (SunoSyncRecord *self);
const char *Suno_sync_record_get_version (SunoSyncRecord *self);
SunoSyncDevice *Suno_sync_record_get_writer (SunoSyncRecord *self);
gint64 Suno_sync_record_get_time_ms (SunoSyncRecord *self);
SunoSyncDevice *Suno_sync_record_get_resolved_by (SunoSyncRecord *self);
SunoSyncRecordFlags Suno_sync_record_get_flags (SunoSyncRecord *self);
gboolean Suno_sync_record_get_mine (SunoSyncRecord *self);
gboolean Suno_sync_record_get_held (SunoSyncRecord *self);
gboolean Suno_sync_record_get_deleted (SunoSyncRecord *self);
gboolean Suno_sync_record_get_delete_dropped (SunoSyncRecord *self);
const char * const *Suno_sync_record_get_asset_names (SunoSyncRecord *self);
/* Asset metadata without opening it: size in bytes (-1 for no such asset)
 * and flags (on-demand, here, pinned). */
gint64 Suno_sync_record_get_asset_size (SunoSyncRecord *self, const char *name);
SunoSyncAssetFlags Suno_sync_record_get_asset_flags (SunoSyncRecord *self, const char *name);
GPtrArray *Suno_sync_record_get_siblings (SunoSyncRecord *self);

/* ------------------------------------------------------------------ write result */

/**
 * SunoSyncWriteResult:
 *
 * What one record's write did, and the record as it now is (for a conflict
 * or too-many-siblings, the current record with its siblings).
 */
#define SUNO_TYPE_SYNC_WRITE_RESULT (Suno_sync_write_result_get_type ())
G_DECLARE_FINAL_TYPE (SunoSyncWriteResult, Suno_sync_write_result, SUNO, SYNC_WRITE_RESULT, GObject)

const char *Suno_sync_write_result_get_name (SunoSyncWriteResult *self);
SunoSyncOutcome Suno_sync_write_result_get_outcome (SunoSyncWriteResult *self);
SunoSyncRecord *Suno_sync_write_result_get_record (SunoSyncWriteResult *self);

/* ------------------------------------------------------------------ changes */

/**
 * SunoSyncChanges:
 *
 * Records changed since a token, from the device's mirror: each with its
 * version, writer, time, asset names and siblings, plus the outcomes of this
 * device's queued writes (held, delete-dropped). Deleted records carry
 * %SUNO_SYNC_RECORD_DELETED and no value. The next token is the app's to
 * keep: save it once the records are applied.
 */
#define SUNO_TYPE_SYNC_CHANGES (Suno_sync_changes_get_type ())
G_DECLARE_FINAL_TYPE (SunoSyncChanges, Suno_sync_changes, SUNO, SYNC_CHANGES, GObject)

GPtrArray *Suno_sync_changes_get_records (SunoSyncChanges *self);
const char *Suno_sync_changes_get_token (SunoSyncChanges *self);
gboolean Suno_sync_changes_get_more (SunoSyncChanges *self);

/* ------------------------------------------------------------------ lease */

/**
 * SunoSyncLease:
 *
 * Who holds a record's lease and until when. Advisory: it never blocks a
 * write. Carries no payload.
 */
#define SUNO_TYPE_SYNC_LEASE (Suno_sync_lease_get_type ())
G_DECLARE_FINAL_TYPE (SunoSyncLease, Suno_sync_lease, SUNO, SYNC_LEASE, GObject)

const char *Suno_sync_lease_get_record (SunoSyncLease *self);
SunoSyncDevice *Suno_sync_lease_get_holder (SunoSyncLease *self);
/* Milliseconds since the Unix epoch, UTC; 0 when no lease. */
gint64 Suno_sync_lease_get_until_ms (SunoSyncLease *self);
gboolean Suno_sync_lease_get_mine (SunoSyncLease *self);
/* An unexpired lease exists until Suno_sync_lease_get_until_ms(). Unrelated
 * to %SUNO_SYNC_RECORD_HELD. */
gboolean Suno_sync_lease_get_active (SunoSyncLease *self);

/* ------------------------------------------------------------------ asset */

/**
 * SunoSyncAsset:
 *
 * The answer to opening an asset: a read-only stream of a private, sealed
 * copy of the bytes when they are here, or where they are when not.
 */
#define SUNO_TYPE_SYNC_ASSET (Suno_sync_asset_get_type ())
G_DECLARE_FINAL_TYPE (SunoSyncAsset, Suno_sync_asset, SUNO, SYNC_ASSET, GObject)

const char *Suno_sync_asset_get_record (SunoSyncAsset *self);
const char *Suno_sync_asset_get_name (SunoSyncAsset *self);
const char *Suno_sync_asset_get_version (SunoSyncAsset *self);
SunoSyncAssetState Suno_sync_asset_get_state (SunoSyncAsset *self);
SunoSyncAssetFlags Suno_sync_asset_get_flags (SunoSyncAsset *self);
gint64 Suno_sync_asset_get_size (SunoSyncAsset *self);
SunoSyncDevice *Suno_sync_asset_get_holder (SunoSyncAsset *self);
const char *Suno_sync_asset_get_where (SunoSyncAsset *self);
GInputStream *Suno_sync_asset_get_stream (SunoSyncAsset *self);
GBytes *Suno_sync_asset_read_all (SunoSyncAsset *self, GCancellable *cancellable, GError **error);

/* ------------------------------------------------------------------ usage */

/**
 * SunoSyncUsage:
 *
 * The app's usage on this account and its limits (§5), as the device knows
 * them, and whether a limit is holding writes back.
 */
#define SUNO_TYPE_SYNC_USAGE (Suno_sync_usage_get_type ())
G_DECLARE_FINAL_TYPE (SunoSyncUsage, Suno_sync_usage, SUNO, SYNC_USAGE, GObject)

guint64 Suno_sync_usage_get_record_bytes (SunoSyncUsage *self);
guint64 Suno_sync_usage_get_record_bytes_limit (SunoSyncUsage *self);
guint64 Suno_sync_usage_get_asset_bytes (SunoSyncUsage *self);
guint64 Suno_sync_usage_get_asset_bytes_limit (SunoSyncUsage *self);
guint64 Suno_sync_usage_get_records (SunoSyncUsage *self);
guint64 Suno_sync_usage_get_records_limit (SunoSyncUsage *self);
guint Suno_sync_usage_get_zones (SunoSyncUsage *self);
guint Suno_sync_usage_get_zones_limit (SunoSyncUsage *self);
guint64 Suno_sync_usage_get_outbox_bytes (SunoSyncUsage *self);
guint64 Suno_sync_usage_get_outbox_bytes_limit (SunoSyncUsage *self);
guint Suno_sync_usage_get_held (SunoSyncUsage *self);
const char *Suno_sync_usage_get_limited_by (SunoSyncUsage *self);

/* ------------------------------------------------------------------ store */

/**
 * SunoSyncStore:
 *
 * One zone of the app's synced data. Signals:
 *
 * - #SunoSyncStore::changed (no arguments): a nudge that something changed
 *   on another device, or a queued write of this device has an outcome
 *   (saved, kept-both, held, delete-dropped). The app calls
 *   Suno_sync_store_fetch_changes() with its token. Never fired for a write
 *   answered while the app waited.
 * - #SunoSyncStore::siblings (record name): a record gained or lost siblings
 *   through a remote write or a queued write of this device; the person may
 *   want to choose. Never fired for a %SUNO_SYNC_OUTCOME_KEPT_BOTH answered
 *   while the app waited (the answer already carries the record).
 * - #SunoSyncStore::asset-changed (record, name, state, done, total).
 * - notify::status.
 *
 * Constructing a store never touches the network or blocks on the portal;
 * the first call that needs the portal connects to it.
 */
#define SUNO_TYPE_SYNC_STORE (Suno_sync_store_get_type ())
G_DECLARE_FINAL_TYPE (SunoSyncStore, Suno_sync_store, SUNO, SYNC_STORE, GObject)

/* GInitable: NULL with SUNO_SYNC_ERROR_INVALID for a label that isn't
 * [a-z0-9][a-z0-9._-]{0,31}. */
SunoSyncStore *Suno_sync_store_new (const char *zone, GError **error);
const char *Suno_sync_store_get_zone (SunoSyncStore *self);
gboolean Suno_sync_store_get_local_only (SunoSyncStore *self);

/* Status: this store's last known status (the app's, or NOT_APPROVED for a
 * label Suno hasn't approved), updated by notify::status. */
SunoSyncStatus Suno_sync_store_get_status (SunoSyncStore *self);
SunoSyncDevice *Suno_sync_store_get_device (SunoSyncStore *self);
SunoSyncUsage *Suno_sync_store_get_usage (SunoSyncStore *self);
void Suno_sync_store_refresh_status (SunoSyncStore *self, GCancellable *cancellable,
                                     GAsyncReadyCallback callback, gpointer user_data);
SunoSyncStatus Suno_sync_store_refresh_status_finish (SunoSyncStore *self, GAsyncResult *result, GError **error);
SunoSyncStatus Suno_sync_store_refresh_status_sync (SunoSyncStore *self, GCancellable *cancellable, GError **error);

/* Start delivering ::changed, ::siblings and ::asset-changed. One ::changed
 * nudge follows at once, so an app fetches from its saved token. */
void Suno_sync_store_subscribe (SunoSyncStore *self, GCancellable *cancellable,
                                GAsyncReadyCallback callback, gpointer user_data);
gboolean Suno_sync_store_subscribe_finish (SunoSyncStore *self, GAsyncResult *result, GError **error);

/* Put (Save): one record. base: the version the value was made over, or NULL
 * for a new record. */
void Suno_sync_store_put (SunoSyncStore *self, const char *name, GBytes *value, const char *base,
                          SunoSyncConflictPolicy policy, GCancellable *cancellable,
                          GAsyncReadyCallback callback, gpointer user_data);
SunoSyncWriteResult *Suno_sync_store_put_finish (SunoSyncStore *self, GAsyncResult *result, GError **error);
SunoSyncWriteResult *Suno_sync_store_put_sync (SunoSyncStore *self, const char *name, GBytes *value,
                                               const char *base, SunoSyncConflictPolicy policy,
                                               GCancellable *cancellable, GError **error);

/* Put several records at once (at most 100): names, values and bases are
 * parallel arrays; bases may be NULL (all new). */
void Suno_sync_store_put_many (SunoSyncStore *self, const char * const *names, GPtrArray *values,
                               const char * const *bases, SunoSyncConflictPolicy policy,
                               GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data);
GPtrArray *Suno_sync_store_put_many_finish (SunoSyncStore *self, GAsyncResult *result, GError **error);
GPtrArray *Suno_sync_store_put_many_sync (SunoSyncStore *self, const char * const *names, GPtrArray *values,
                                          const char * const *bases, SunoSyncConflictPolicy policy,
                                          GCancellable *cancellable, GError **error);

/* Get: the current version, with its siblings; NULL (no error) when there is
 * no such record. Local read. */
SunoSyncRecord *Suno_sync_store_get (SunoSyncStore *self, const char *name, GCancellable *cancellable, GError **error);

/* List: records after a name, in name order, at most limit (0: 100). Local read. */
GPtrArray *Suno_sync_store_list (SunoSyncStore *self, const char *after, guint limit,
                                 GCancellable *cancellable, GError **error);

/* Remove (Delete): a delete on a stale base never wins (§3.5). */
void Suno_sync_store_remove (SunoSyncStore *self, const char *name, const char *base, GCancellable *cancellable,
                             GAsyncReadyCallback callback, gpointer user_data);
SunoSyncWriteResult *Suno_sync_store_remove_finish (SunoSyncStore *self, GAsyncResult *result, GError **error);
SunoSyncWriteResult *Suno_sync_store_remove_sync (SunoSyncStore *self, const char *name, const char *base,
                                                  GCancellable *cancellable, GError **error);

/* FetchChanges: what changed since the app's token (NULL: everything), with
 * the next token. Changes nothing in the store; call again while
 * Suno_sync_changes_get_more(). */
SunoSyncChanges *Suno_sync_store_fetch_changes (SunoSyncStore *self, const char *token, GCancellable *cancellable,
                                                GError **error);

/* PutAsset: fd must be a sealed memfd (F_SEAL_WRITE|F_SEAL_GROW|F_SEAL_SHRINK)
 * or a regular file outside FUSE; the service copies it with a cap and a
 * deadline. The caller keeps its fd. */
void Suno_sync_store_put_asset (SunoSyncStore *self, const char *record, const char *name, int fd,
                                const char *base, SunoSyncAssetFlags flags, GCancellable *cancellable,
                                GAsyncReadyCallback callback, gpointer user_data);
SunoSyncWriteResult *Suno_sync_store_put_asset_finish (SunoSyncStore *self, GAsyncResult *result, GError **error);
SunoSyncWriteResult *Suno_sync_store_put_asset_sync (SunoSyncStore *self, const char *record, const char *name,
                                                     int fd, const char *base, SunoSyncAssetFlags flags,
                                                     GCancellable *cancellable, GError **error);
/* The same from bytes: the library makes the sealed memfd. */
SunoSyncWriteResult *Suno_sync_store_put_asset_bytes (SunoSyncStore *self, const char *record, const char *name,
                                                      GBytes *bytes, const char *base, SunoSyncAssetFlags flags,
                                                      GCancellable *cancellable, GError **error);

/* RemoveAsset: drops one asset. A stale base is a conflict like any write. */
SunoSyncWriteResult *Suno_sync_store_remove_asset (SunoSyncStore *self, const char *record, const char *name,
                                                   const char *base, GCancellable *cancellable, GError **error);

/* OpenAsset: version NULL means the current one; it may name any live
 * sibling. An unknown or resolved version answers SUNO_SYNC_ASSET_GONE. */
void Suno_sync_store_open_asset (SunoSyncStore *self, const char *record, const char *name, const char *version,
                                 GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data);
SunoSyncAsset *Suno_sync_store_open_asset_finish (SunoSyncStore *self, GAsyncResult *result, GError **error);
SunoSyncAsset *Suno_sync_store_open_asset_sync (SunoSyncStore *self, const char *record, const char *name,
                                                const char *version, GCancellable *cancellable, GError **error);

/* On-demand assets: ask for the bytes, keep them here, or let them go.
 * Progress arrives on ::asset-changed. */
SunoSyncAssetState Suno_sync_store_request_asset (SunoSyncStore *self, const char *record, const char *name,
                                                  GCancellable *cancellable, GError **error);
SunoSyncAssetState Suno_sync_store_pin_asset (SunoSyncStore *self, const char *record, const char *name,
                                              gboolean pinned, GCancellable *cancellable, GError **error);
SunoSyncAssetState Suno_sync_store_evict_asset (SunoSyncStore *self, const char *record, const char *name,
                                                GCancellable *cancellable, GError **error);

/* Lease: mark a record as in use here for at most an hour, renewable.
 * take_over takes it from another device. Answers who holds it. */
SunoSyncLease *Suno_sync_store_lease (SunoSyncStore *self, const char *record, guint seconds, gboolean take_over,
                                      GCancellable *cancellable, GError **error);
gboolean Suno_sync_store_release (SunoSyncStore *self, const char *record, GCancellable *cancellable,
                                  GError **error);

/* ResolveSiblings: the person chose a version (the current one or a
 * sibling). The kept content gets a new version with its original writer and
 * time, and resolved_by set to this device. It answers one of five
 * outcomes, each carrying the record as it now is:
 * - SAVED: resolved, and leaves in the next sync cycle;
 * - QUEUED: resolved here, and leaves when Sync can send it;
 * - LOCAL: resolved on this device only (the app is revoked or suspended,
 *   or there is no portal);
 * - CONFLICT: keep is no longer a live version (a new version raced it);
 * - TOO_MANY_SIBLINGS: a new version raced it and the record is full. */
SunoSyncWriteResult *Suno_sync_store_resolve_siblings (SunoSyncStore *self, const char *record, const char *keep,
                                                       GCancellable *cancellable, GError **error);

/* The record's lease as this device knows it, without taking it: holder,
 * until_ms, active and mine. With no lease, after a release, or once a lease
 * has expired, it answers the same: active FALSE, until_ms 0, no holder.
 * Local read (§7.3: "paused on Living room TV"). */
SunoSyncLease *Suno_sync_store_get_lease (SunoSyncStore *self, const char *record, GCancellable *cancellable,
                                          GError **error);

/* DeleteZone: the app's own data in this zone, on every device. Kept for 30
 * days in Settings, where the person can restore it (§9.2). */
gboolean Suno_sync_store_delete_zone (SunoSyncStore *self, GCancellable *cancellable, GError **error);

G_END_DECLS
