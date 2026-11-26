/* SPDX-License-Identifier: Apache-2.0 */
/*
 * LumaSyncStore: an app's own data, kept the same on every device of the
 * person's Luma account (ADR-057 §3.7).
 *
 * The library needs GIO alone, so non-GTK apps, games and the Rust core can
 * use it, and it is introspected (namespace LumaSync 1) for C, Python, Rust,
 * JavaScript and Vala.
 *
 * It talks to the org.projectluma.portal.Sync portal. Every call answers at
 * once from the device: reads come from the local mirror, writes are durable
 * on the device before they return and leave when Sync can send them. When
 * there is no portal (another OS, an older Luma) every call works the same
 * way against a store in the app's own data folder and the status is
 * LUMA_SYNC_STATUS_UNAVAILABLE.
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
 * luma_sync_store_fetch_changes() takes the app's token and returns the
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

#define LUMA_SYNC_MAJOR_VERSION 1

/* Limits (ADR-057 §3.3 and §5.3). Anything over is refused with
 * LUMA_SYNC_ERROR_TOO_LARGE or LUMA_SYNC_ERROR_INVALID before any work. */
#define LUMA_SYNC_MAX_NAME_BYTES 255
#define LUMA_SYNC_MAX_VALUE_BYTES (256 * 1024)
#define LUMA_SYNC_MAX_RECORDS_PER_CALL 100
#define LUMA_SYNC_MAX_ASSETS_PER_RECORD 32
#define LUMA_SYNC_MAX_INLINE_ASSET_BYTES (G_GINT64_CONSTANT (64) * 1024 * 1024)
#define LUMA_SYNC_MAX_ON_DEMAND_ASSET_BYTES (G_GINT64_CONSTANT (16) * 1000 * 1000 * 1000)
#define LUMA_SYNC_MAX_VERSIONS 4 /* the current version and up to three siblings */
#define LUMA_SYNC_MAX_LEASE_SECONDS 3600

/* ------------------------------------------------------------------ enums */

/**
 * LumaSyncStatus:
 * @LUMA_SYNC_STATUS_AVAILABLE: the app's data syncs.
 * @LUMA_SYNC_STATUS_OFF: the person turned Sync off on this device.
 * @LUMA_SYNC_STATUS_NO_ACCOUNT: the device isn't signed in to Luma Connect.
 * @LUMA_SYNC_STATUS_NOT_ALLOWED: the person turned sync off for this app.
 * @LUMA_SYNC_STATUS_OFFERED: the person hasn't answered the offer yet.
 * @LUMA_SYNC_STATUS_UNVERIFIED: the app's publisher can't be verified, so
 *   nothing is stored and every call but status is refused.
 * @LUMA_SYNC_STATUS_NOT_APPROVED: Luma hasn't approved this app (or approved
 *   another publisher's build of it).
 * @LUMA_SYNC_STATUS_REVOKED: Luma withdrew the app's approval ("Stopped by
 *   Luma"); its synced data is deleted from the Hub and every device.
 * @LUMA_SYNC_STATUS_SUSPENDED: Luma paused the app's approval ("Paused by
 *   Luma"); synced data stays, and sync resumes by itself once Luma approves
 *   the app again.
 * @LUMA_SYNC_STATUS_UNAVAILABLE: there is no Sync portal; data stays in the
 *   app's own folder on this device.
 *
 * Whether the app's data leaves the device.
 *
 * - %LUMA_SYNC_STATUS_AVAILABLE: writes are answered %LUMA_SYNC_OUTCOME_SAVED
 *   (or kept-both, conflict…) and leave in the service's next sync cycle.
 * - %LUMA_SYNC_STATUS_OFF, %LUMA_SYNC_STATUS_NO_ACCOUNT,
 *   %LUMA_SYNC_STATUS_NOT_ALLOWED, %LUMA_SYNC_STATUS_OFFERED and
 *   %LUMA_SYNC_STATUS_NOT_APPROVED: calls work locally and writes are answered
 *   %LUMA_SYNC_OUTCOME_QUEUED; they leave if the state changes, within the
 *   app's outbox cap (64 MB).
 * - %LUMA_SYNC_STATUS_REVOKED and %LUMA_SYNC_STATUS_SUSPENDED: calls work
 *   locally and writes are answered %LUMA_SYNC_OUTCOME_LOCAL: kept on this
 *   device with %LUMA_SYNC_RECORD_LOCAL_ONLY. The outbox was dropped. If Luma
 *   approves the app again, the service offers the local-only versions by
 *   itself (keep-both), oldest first, as new writes against the app's record
 *   and asset quotas and the outbox cap; while an allowance would be
 *   exceeded, offering pauses and luma_sync_usage_get_limited_by() names it,
 *   and it resumes when there is room. The app does nothing. Leases taken
 *   in these states work on this device only and never leave it.
 * - %LUMA_SYNC_STATUS_UNVERIFIED: nothing is stored; every call but status
 *   fails with %LUMA_SYNC_ERROR_REFUSED.
 * - %LUMA_SYNC_STATUS_UNAVAILABLE: no portal; data stays in the app's own
 *   folder and writes are answered %LUMA_SYNC_OUTCOME_LOCAL.
 *
 * A store's status is the app's, except that a zone label Luma hasn't
 * approved for the app gives that store %LUMA_SYNC_STATUS_NOT_APPROVED with
 * exactly the same behaviour as an app that isn't approved.
 *
 * When several apply, the first of these wins: REVOKED, SUSPENDED,
 * UNVERIFIED, UNAVAILABLE, NOT_APPROVED (for the label or the whole app), NO_ACCOUNT,
 * OFF, NOT_ALLOWED, OFFERED, AVAILABLE.
 */
typedef enum {
  LUMA_SYNC_STATUS_AVAILABLE,
  LUMA_SYNC_STATUS_OFF,
  LUMA_SYNC_STATUS_NO_ACCOUNT,
  LUMA_SYNC_STATUS_NOT_ALLOWED,
  LUMA_SYNC_STATUS_OFFERED,
  LUMA_SYNC_STATUS_UNVERIFIED,
  LUMA_SYNC_STATUS_NOT_APPROVED,
  LUMA_SYNC_STATUS_REVOKED,
  LUMA_SYNC_STATUS_SUSPENDED,
  LUMA_SYNC_STATUS_UNAVAILABLE,
} LumaSyncStatus;

/**
 * LumaSyncDeviceKind:
 * @LUMA_SYNC_DEVICE_KIND_UNKNOWN: not known (local mode).
 * @LUMA_SYNC_DEVICE_KIND_COMPUTER: a laptop or desktop.
 * @LUMA_SYNC_DEVICE_KIND_HANDHELD: a phone, tablet or handheld console.
 * @LUMA_SYNC_DEVICE_KIND_TV: a TV or set-top box.
 *
 * The device class of ADR-057 §3.4 (named kind: "class" is taken by GObject).
 */
typedef enum {
  LUMA_SYNC_DEVICE_KIND_UNKNOWN,
  LUMA_SYNC_DEVICE_KIND_COMPUTER,
  LUMA_SYNC_DEVICE_KIND_HANDHELD,
  LUMA_SYNC_DEVICE_KIND_TV,
} LumaSyncDeviceKind;

/**
 * LumaSyncOutcome:
 * @LUMA_SYNC_OUTCOME_SAVED: written over the base the app named.
 * @LUMA_SYNC_OUTCOME_CONFLICT: the base was stale and the write asked for
 *   %LUMA_SYNC_CONFLICT_FAIL, or it was a delete; nothing changed and the
 *   result carries the current record.
 * @LUMA_SYNC_OUTCOME_KEPT_BOTH: the base was stale; the write was kept and the
 *   other version became a sibling (or the other way round, by clock).
 * @LUMA_SYNC_OUTCOME_QUEUED: kept on the device and waiting to leave (Sync
 *   can't send it now); when it does it always resolves as keep-both (§3.5)
 *   and %LumaSyncStore::changed nudges the app to fetch the outcome. A queued
 *   write that is already stale against the device's mirror answers
 *   @LUMA_SYNC_OUTCOME_KEPT_BOTH instead, with %LUMA_SYNC_RECORD_QUEUED on the
 *   record.
 * @LUMA_SYNC_OUTCOME_TOO_MANY_SIBLINGS: it would have made a fifth version;
 *   nothing changed and the result carries the current record and its
 *   siblings. Call luma_sync_store_resolve_siblings() first.
 * @LUMA_SYNC_OUTCOME_LOCAL: saved on this device only and never synced: Luma
 *   revoked or suspended the app (%LUMA_SYNC_STATUS_REVOKED,
 *   %LUMA_SYNC_STATUS_SUSPENDED), or there is no portal
 *   (%LUMA_SYNC_STATUS_UNAVAILABLE).
 *
 * What a write did.
 */
typedef enum {
  LUMA_SYNC_OUTCOME_SAVED,
  LUMA_SYNC_OUTCOME_CONFLICT,
  LUMA_SYNC_OUTCOME_KEPT_BOTH,
  LUMA_SYNC_OUTCOME_QUEUED,
  LUMA_SYNC_OUTCOME_TOO_MANY_SIBLINGS,
  LUMA_SYNC_OUTCOME_LOCAL,
} LumaSyncOutcome;

/**
 * LumaSyncConflictPolicy:
 * @LUMA_SYNC_CONFLICT_KEEP_BOTH: a stale write keeps both versions (default).
 * @LUMA_SYNC_CONFLICT_FAIL: a stale write answered while the app waits fails
 *   with the current value, so the app merges. A queued write has no one to
 *   fail to and always keeps both.
 */
typedef enum {
  LUMA_SYNC_CONFLICT_KEEP_BOTH,
  LUMA_SYNC_CONFLICT_FAIL,
} LumaSyncConflictPolicy;

/**
 * LumaSyncRecordFlags:
 * @LUMA_SYNC_RECORD_NONE: nothing special.
 * @LUMA_SYNC_RECORD_DELETED: the record was deleted (only in changes).
 * @LUMA_SYNC_RECORD_QUEUED: this device's write is still waiting to leave.
 * @LUMA_SYNC_RECORD_HELD: a queued write would have made a fifth version and
 *   is held on the device until the app resolves the siblings.
 * @LUMA_SYNC_RECORD_DELETE_DROPPED: a queued delete was older than an edit from
 *   another device and was dropped; the edit stays current.
 * @LUMA_SYNC_RECORD_SIBLING: this is a sibling, not the current version.
 * @LUMA_SYNC_RECORD_MINE: written by this device.
 * @LUMA_SYNC_RECORD_LOCAL_ONLY: written while Luma had suspended or revoked
 *   the app (answered %LUMA_SYNC_OUTCOME_LOCAL). It stays on this device,
 *   never deleted by a purge; when Luma approves the app again the service
 *   offers it through the outbox by itself, keep-both against the version it
 *   was written over, and the flag clears as it is saved.
 */
typedef enum /*< flags >*/ {
  LUMA_SYNC_RECORD_NONE = 0,
  LUMA_SYNC_RECORD_DELETED = 1 << 0,
  LUMA_SYNC_RECORD_QUEUED = 1 << 1,
  LUMA_SYNC_RECORD_HELD = 1 << 2,
  LUMA_SYNC_RECORD_DELETE_DROPPED = 1 << 3,
  LUMA_SYNC_RECORD_SIBLING = 1 << 4,
  LUMA_SYNC_RECORD_MINE = 1 << 5,
  LUMA_SYNC_RECORD_LOCAL_ONLY = 1 << 6,
} LumaSyncRecordFlags;

/**
 * LumaSyncAssetState:
 * @LUMA_SYNC_ASSET_HERE: the bytes are on this device; the asset has a stream.
 * @LUMA_SYNC_ASSET_NOT_HERE: the bytes are on another device (on-demand
 *   assets); luma_sync_asset_get_where() says where.
 * @LUMA_SYNC_ASSET_FETCHING: on its way to this device; %LumaSyncStore::asset-changed
 *   reports progress.
 * @LUMA_SYNC_ASSET_GONE: no such asset or version (or the version was resolved).
 */
typedef enum {
  LUMA_SYNC_ASSET_HERE,
  LUMA_SYNC_ASSET_NOT_HERE,
  LUMA_SYNC_ASSET_FETCHING,
  LUMA_SYNC_ASSET_GONE,
} LumaSyncAssetState;

/**
 * LumaSyncAssetFlags:
 * @LUMA_SYNC_ASSET_FLAGS_NONE: an inline asset: resident, fetched with its
 *   record, at most 64 MiB.
 * @LUMA_SYNC_ASSET_FLAGS_ON_DEMAND: an on-demand asset: device-held, at most
 *   16 GB; its metadata syncs and the bytes move when a device asks or pins.
 * @LUMA_SYNC_ASSET_FLAGS_HERE: the bytes are on this device now (without it,
 *   not here: on another device, or still on their way).
 * @LUMA_SYNC_ASSET_FLAGS_PINNED: the person or the app pinned it here.
 *
 * What an asset is and where its bytes are. luma_sync_store_put_asset()
 * reads only %LUMA_SYNC_ASSET_FLAGS_ON_DEMAND.
 */
typedef enum /*< flags >*/ {
  LUMA_SYNC_ASSET_FLAGS_NONE = 0,
  LUMA_SYNC_ASSET_FLAGS_ON_DEMAND = 1 << 0,
  LUMA_SYNC_ASSET_FLAGS_HERE = 1 << 1,
  LUMA_SYNC_ASSET_FLAGS_PINNED = 1 << 2,
} LumaSyncAssetFlags;

/**
 * LumaSyncError:
 * @LUMA_SYNC_ERROR_FAILED: something else went wrong.
 * @LUMA_SYNC_ERROR_INVALID: a malformed argument (zone label, name, version).
 * @LUMA_SYNC_ERROR_TOO_LARGE: over a size cap (§5.3).
 * @LUMA_SYNC_ERROR_QUOTA: over one of the app's quotas (§5.1); the message
 *   names the allowance.
 * @LUMA_SYNC_ERROR_RATE_LIMITED: too many calls (§5.2); try later.
 * @LUMA_SYNC_ERROR_REFUSED: the app's status doesn't allow it
 *   (%LUMA_SYNC_STATUS_UNVERIFIED: no publisher can be verified).
 * @LUMA_SYNC_ERROR_NOT_FOUND: no such record.
 * @LUMA_SYNC_ERROR_BAD_DESCRIPTOR: an asset descriptor that isn't a sealed
 *   memfd or a regular file outside FUSE, or that changed while copied.
 * @LUMA_SYNC_ERROR_TIMED_OUT: a call or a copy ran past its deadline.
 * @LUMA_SYNC_ERROR_NOT_SUPPORTED: an option this Luma doesn't keep yet.
 */
typedef enum {
  LUMA_SYNC_ERROR_FAILED,
  LUMA_SYNC_ERROR_INVALID,
  LUMA_SYNC_ERROR_TOO_LARGE,
  LUMA_SYNC_ERROR_QUOTA,
  LUMA_SYNC_ERROR_RATE_LIMITED,
  LUMA_SYNC_ERROR_REFUSED,
  LUMA_SYNC_ERROR_NOT_FOUND,
  LUMA_SYNC_ERROR_BAD_DESCRIPTOR,
  LUMA_SYNC_ERROR_TIMED_OUT,
  LUMA_SYNC_ERROR_NOT_SUPPORTED,
} LumaSyncError;

#define LUMA_SYNC_ERROR (luma_sync_error_quark ())
GQuark luma_sync_error_quark (void);

#define LUMA_TYPE_SYNC_STATUS (luma_sync_status_get_type ())
#define LUMA_TYPE_SYNC_DEVICE_KIND (luma_sync_device_kind_get_type ())
#define LUMA_TYPE_SYNC_OUTCOME (luma_sync_outcome_get_type ())
#define LUMA_TYPE_SYNC_CONFLICT_POLICY (luma_sync_conflict_policy_get_type ())
#define LUMA_TYPE_SYNC_RECORD_FLAGS (luma_sync_record_flags_get_type ())
#define LUMA_TYPE_SYNC_ASSET_STATE (luma_sync_asset_state_get_type ())
#define LUMA_TYPE_SYNC_ASSET_FLAGS (luma_sync_asset_flags_get_type ())
#define LUMA_TYPE_SYNC_ERROR (luma_sync_error_get_type ())
GType luma_sync_status_get_type (void) G_GNUC_CONST;
GType luma_sync_device_kind_get_type (void) G_GNUC_CONST;
GType luma_sync_outcome_get_type (void) G_GNUC_CONST;
GType luma_sync_conflict_policy_get_type (void) G_GNUC_CONST;
GType luma_sync_record_flags_get_type (void) G_GNUC_CONST;
GType luma_sync_asset_state_get_type (void) G_GNUC_CONST;
GType luma_sync_asset_flags_get_type (void) G_GNUC_CONST;
GType luma_sync_error_get_type (void) G_GNUC_CONST;

/* The portal's wire names ("available", "not-approved", …). */
const char *luma_sync_status_to_string (LumaSyncStatus status);
LumaSyncStatus luma_sync_status_from_string (const char *text);

/* ------------------------------------------------------------------ device */

/**
 * LumaSyncDevice:
 *
 * One of the person's devices as an app sees it: a handle that is stable for
 * this app only (two apps get different handles for one device), the
 * device's class and the name the person gave it. Nothing else identifies a
 * device or a person.
 */
#define LUMA_TYPE_SYNC_DEVICE (luma_sync_device_get_type ())
G_DECLARE_FINAL_TYPE (LumaSyncDevice, luma_sync_device, LUMA, SYNC_DEVICE, GObject)

const char *luma_sync_device_get_handle (LumaSyncDevice *self);
const char *luma_sync_device_get_name (LumaSyncDevice *self);
LumaSyncDeviceKind luma_sync_device_get_kind (LumaSyncDevice *self);
gboolean luma_sync_device_get_mine (LumaSyncDevice *self);

/* ------------------------------------------------------------------ record */

/**
 * LumaSyncRecord:
 *
 * One version of a record: the current one or a sibling. Immutable.
 */
#define LUMA_TYPE_SYNC_RECORD (luma_sync_record_get_type ())
G_DECLARE_FINAL_TYPE (LumaSyncRecord, luma_sync_record, LUMA, SYNC_RECORD, GObject)

const char *luma_sync_record_get_name (LumaSyncRecord *self);
GBytes *luma_sync_record_get_value (LumaSyncRecord *self);
const char *luma_sync_record_get_version (LumaSyncRecord *self);
LumaSyncDevice *luma_sync_record_get_writer (LumaSyncRecord *self);
gint64 luma_sync_record_get_time_ms (LumaSyncRecord *self);
LumaSyncDevice *luma_sync_record_get_resolved_by (LumaSyncRecord *self);
LumaSyncRecordFlags luma_sync_record_get_flags (LumaSyncRecord *self);
gboolean luma_sync_record_get_mine (LumaSyncRecord *self);
gboolean luma_sync_record_get_held (LumaSyncRecord *self);
gboolean luma_sync_record_get_deleted (LumaSyncRecord *self);
gboolean luma_sync_record_get_delete_dropped (LumaSyncRecord *self);
const char * const *luma_sync_record_get_asset_names (LumaSyncRecord *self);
/* Asset metadata without opening it: size in bytes (-1 for no such asset)
 * and flags (on-demand, here, pinned). */
gint64 luma_sync_record_get_asset_size (LumaSyncRecord *self, const char *name);
LumaSyncAssetFlags luma_sync_record_get_asset_flags (LumaSyncRecord *self, const char *name);
GPtrArray *luma_sync_record_get_siblings (LumaSyncRecord *self);

/* ------------------------------------------------------------------ write result */

/**
 * LumaSyncWriteResult:
 *
 * What one record's write did, and the record as it now is (for a conflict
 * or too-many-siblings, the current record with its siblings).
 */
#define LUMA_TYPE_SYNC_WRITE_RESULT (luma_sync_write_result_get_type ())
G_DECLARE_FINAL_TYPE (LumaSyncWriteResult, luma_sync_write_result, LUMA, SYNC_WRITE_RESULT, GObject)

const char *luma_sync_write_result_get_name (LumaSyncWriteResult *self);
LumaSyncOutcome luma_sync_write_result_get_outcome (LumaSyncWriteResult *self);
LumaSyncRecord *luma_sync_write_result_get_record (LumaSyncWriteResult *self);

/* ------------------------------------------------------------------ changes */

/**
 * LumaSyncChanges:
 *
 * Records changed since a token, from the device's mirror: each with its
 * version, writer, time, asset names and siblings, plus the outcomes of this
 * device's queued writes (held, delete-dropped). Deleted records carry
 * %LUMA_SYNC_RECORD_DELETED and no value. The next token is the app's to
 * keep: save it once the records are applied.
 */
#define LUMA_TYPE_SYNC_CHANGES (luma_sync_changes_get_type ())
G_DECLARE_FINAL_TYPE (LumaSyncChanges, luma_sync_changes, LUMA, SYNC_CHANGES, GObject)

GPtrArray *luma_sync_changes_get_records (LumaSyncChanges *self);
const char *luma_sync_changes_get_token (LumaSyncChanges *self);
gboolean luma_sync_changes_get_more (LumaSyncChanges *self);

/* ------------------------------------------------------------------ lease */

/**
 * LumaSyncLease:
 *
 * Who holds a record's lease and until when. Advisory: it never blocks a
 * write. Carries no payload.
 */
#define LUMA_TYPE_SYNC_LEASE (luma_sync_lease_get_type ())
G_DECLARE_FINAL_TYPE (LumaSyncLease, luma_sync_lease, LUMA, SYNC_LEASE, GObject)

const char *luma_sync_lease_get_record (LumaSyncLease *self);
LumaSyncDevice *luma_sync_lease_get_holder (LumaSyncLease *self);
/* Milliseconds since the Unix epoch, UTC; 0 when no lease. */
gint64 luma_sync_lease_get_until_ms (LumaSyncLease *self);
gboolean luma_sync_lease_get_mine (LumaSyncLease *self);
/* An unexpired lease exists until luma_sync_lease_get_until_ms(). Unrelated
 * to %LUMA_SYNC_RECORD_HELD. */
gboolean luma_sync_lease_get_active (LumaSyncLease *self);

/* ------------------------------------------------------------------ asset */

/**
 * LumaSyncAsset:
 *
 * The answer to opening an asset: a read-only stream of a private, sealed
 * copy of the bytes when they are here, or where they are when not.
 */
#define LUMA_TYPE_SYNC_ASSET (luma_sync_asset_get_type ())
G_DECLARE_FINAL_TYPE (LumaSyncAsset, luma_sync_asset, LUMA, SYNC_ASSET, GObject)

const char *luma_sync_asset_get_record (LumaSyncAsset *self);
const char *luma_sync_asset_get_name (LumaSyncAsset *self);
const char *luma_sync_asset_get_version (LumaSyncAsset *self);
LumaSyncAssetState luma_sync_asset_get_state (LumaSyncAsset *self);
LumaSyncAssetFlags luma_sync_asset_get_flags (LumaSyncAsset *self);
gint64 luma_sync_asset_get_size (LumaSyncAsset *self);
LumaSyncDevice *luma_sync_asset_get_holder (LumaSyncAsset *self);
const char *luma_sync_asset_get_where (LumaSyncAsset *self);
GInputStream *luma_sync_asset_get_stream (LumaSyncAsset *self);
GBytes *luma_sync_asset_read_all (LumaSyncAsset *self, GCancellable *cancellable, GError **error);

/* ------------------------------------------------------------------ usage */

/**
 * LumaSyncUsage:
 *
 * The app's usage on this account and its limits (§5), as the device knows
 * them, and whether a limit is holding writes back.
 */
#define LUMA_TYPE_SYNC_USAGE (luma_sync_usage_get_type ())
G_DECLARE_FINAL_TYPE (LumaSyncUsage, luma_sync_usage, LUMA, SYNC_USAGE, GObject)

guint64 luma_sync_usage_get_record_bytes (LumaSyncUsage *self);
guint64 luma_sync_usage_get_record_bytes_limit (LumaSyncUsage *self);
guint64 luma_sync_usage_get_asset_bytes (LumaSyncUsage *self);
guint64 luma_sync_usage_get_asset_bytes_limit (LumaSyncUsage *self);
guint64 luma_sync_usage_get_records (LumaSyncUsage *self);
guint64 luma_sync_usage_get_records_limit (LumaSyncUsage *self);
guint luma_sync_usage_get_zones (LumaSyncUsage *self);
guint luma_sync_usage_get_zones_limit (LumaSyncUsage *self);
guint64 luma_sync_usage_get_outbox_bytes (LumaSyncUsage *self);
guint64 luma_sync_usage_get_outbox_bytes_limit (LumaSyncUsage *self);
guint luma_sync_usage_get_held (LumaSyncUsage *self);
const char *luma_sync_usage_get_limited_by (LumaSyncUsage *self);

/* ------------------------------------------------------------------ store */

/**
 * LumaSyncStore:
 *
 * One zone of the app's synced data. Signals:
 *
 * - #LumaSyncStore::changed (no arguments): a nudge that something changed
 *   on another device, or a queued write of this device has an outcome
 *   (saved, kept-both, held, delete-dropped). The app calls
 *   luma_sync_store_fetch_changes() with its token. Never fired for a write
 *   answered while the app waited.
 * - #LumaSyncStore::siblings (record name): a record gained or lost siblings
 *   through a remote write or a queued write of this device; the person may
 *   want to choose. Never fired for a %LUMA_SYNC_OUTCOME_KEPT_BOTH answered
 *   while the app waited (the answer already carries the record).
 * - #LumaSyncStore::asset-changed (record, name, state, done, total).
 * - notify::status.
 *
 * Constructing a store never touches the network or blocks on the portal;
 * the first call that needs the portal connects to it.
 */
#define LUMA_TYPE_SYNC_STORE (luma_sync_store_get_type ())
G_DECLARE_FINAL_TYPE (LumaSyncStore, luma_sync_store, LUMA, SYNC_STORE, GObject)

/* GInitable: NULL with LUMA_SYNC_ERROR_INVALID for a label that isn't
 * [a-z0-9][a-z0-9._-]{0,31}. */
LumaSyncStore *luma_sync_store_new (const char *zone, GError **error);
const char *luma_sync_store_get_zone (LumaSyncStore *self);
gboolean luma_sync_store_get_local_only (LumaSyncStore *self);

/* Status: this store's last known status (the app's, or NOT_APPROVED for a
 * label Luma hasn't approved), updated by notify::status. */
LumaSyncStatus luma_sync_store_get_status (LumaSyncStore *self);
LumaSyncDevice *luma_sync_store_get_device (LumaSyncStore *self);
LumaSyncUsage *luma_sync_store_get_usage (LumaSyncStore *self);
void luma_sync_store_refresh_status (LumaSyncStore *self, GCancellable *cancellable,
                                     GAsyncReadyCallback callback, gpointer user_data);
LumaSyncStatus luma_sync_store_refresh_status_finish (LumaSyncStore *self, GAsyncResult *result, GError **error);
LumaSyncStatus luma_sync_store_refresh_status_sync (LumaSyncStore *self, GCancellable *cancellable, GError **error);

/* Start delivering ::changed, ::siblings and ::asset-changed. One ::changed
 * nudge follows at once, so an app fetches from its saved token. */
void luma_sync_store_subscribe (LumaSyncStore *self, GCancellable *cancellable,
                                GAsyncReadyCallback callback, gpointer user_data);
gboolean luma_sync_store_subscribe_finish (LumaSyncStore *self, GAsyncResult *result, GError **error);

/* Put (Save): one record. base: the version the value was made over, or NULL
 * for a new record. */
void luma_sync_store_put (LumaSyncStore *self, const char *name, GBytes *value, const char *base,
                          LumaSyncConflictPolicy policy, GCancellable *cancellable,
                          GAsyncReadyCallback callback, gpointer user_data);
LumaSyncWriteResult *luma_sync_store_put_finish (LumaSyncStore *self, GAsyncResult *result, GError **error);
LumaSyncWriteResult *luma_sync_store_put_sync (LumaSyncStore *self, const char *name, GBytes *value,
                                               const char *base, LumaSyncConflictPolicy policy,
                                               GCancellable *cancellable, GError **error);

/* Put several records at once (at most 100): names, values and bases are
 * parallel arrays; bases may be NULL (all new). */
void luma_sync_store_put_many (LumaSyncStore *self, const char * const *names, GPtrArray *values,
                               const char * const *bases, LumaSyncConflictPolicy policy,
                               GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data);
GPtrArray *luma_sync_store_put_many_finish (LumaSyncStore *self, GAsyncResult *result, GError **error);
GPtrArray *luma_sync_store_put_many_sync (LumaSyncStore *self, const char * const *names, GPtrArray *values,
                                          const char * const *bases, LumaSyncConflictPolicy policy,
                                          GCancellable *cancellable, GError **error);

/* Get: the current version, with its siblings; NULL (no error) when there is
 * no such record. Local read. */
LumaSyncRecord *luma_sync_store_get (LumaSyncStore *self, const char *name, GCancellable *cancellable, GError **error);

/* List: records after a name, in name order, at most limit (0: 100). Local read. */
GPtrArray *luma_sync_store_list (LumaSyncStore *self, const char *after, guint limit,
                                 GCancellable *cancellable, GError **error);

/* Remove (Delete): a delete on a stale base never wins (§3.5). */
void luma_sync_store_remove (LumaSyncStore *self, const char *name, const char *base, GCancellable *cancellable,
                             GAsyncReadyCallback callback, gpointer user_data);
LumaSyncWriteResult *luma_sync_store_remove_finish (LumaSyncStore *self, GAsyncResult *result, GError **error);
LumaSyncWriteResult *luma_sync_store_remove_sync (LumaSyncStore *self, const char *name, const char *base,
                                                  GCancellable *cancellable, GError **error);

/* FetchChanges: what changed since the app's token (NULL: everything), with
 * the next token. Changes nothing in the store; call again while
 * luma_sync_changes_get_more(). */
LumaSyncChanges *luma_sync_store_fetch_changes (LumaSyncStore *self, const char *token, GCancellable *cancellable,
                                                GError **error);

/* PutAsset: fd must be a sealed memfd (F_SEAL_WRITE|F_SEAL_GROW|F_SEAL_SHRINK)
 * or a regular file outside FUSE; the service copies it with a cap and a
 * deadline. The caller keeps its fd. */
void luma_sync_store_put_asset (LumaSyncStore *self, const char *record, const char *name, int fd,
                                const char *base, LumaSyncAssetFlags flags, GCancellable *cancellable,
                                GAsyncReadyCallback callback, gpointer user_data);
LumaSyncWriteResult *luma_sync_store_put_asset_finish (LumaSyncStore *self, GAsyncResult *result, GError **error);
LumaSyncWriteResult *luma_sync_store_put_asset_sync (LumaSyncStore *self, const char *record, const char *name,
                                                     int fd, const char *base, LumaSyncAssetFlags flags,
                                                     GCancellable *cancellable, GError **error);
/* The same from bytes: the library makes the sealed memfd. */
LumaSyncWriteResult *luma_sync_store_put_asset_bytes (LumaSyncStore *self, const char *record, const char *name,
                                                      GBytes *bytes, const char *base, LumaSyncAssetFlags flags,
                                                      GCancellable *cancellable, GError **error);

/* RemoveAsset: drops one asset. A stale base is a conflict like any write. */
LumaSyncWriteResult *luma_sync_store_remove_asset (LumaSyncStore *self, const char *record, const char *name,
                                                   const char *base, GCancellable *cancellable, GError **error);

/* OpenAsset: version NULL means the current one; it may name any live
 * sibling. An unknown or resolved version answers LUMA_SYNC_ASSET_GONE. */
void luma_sync_store_open_asset (LumaSyncStore *self, const char *record, const char *name, const char *version,
                                 GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data);
LumaSyncAsset *luma_sync_store_open_asset_finish (LumaSyncStore *self, GAsyncResult *result, GError **error);
LumaSyncAsset *luma_sync_store_open_asset_sync (LumaSyncStore *self, const char *record, const char *name,
                                                const char *version, GCancellable *cancellable, GError **error);

/* On-demand assets: ask for the bytes, keep them here, or let them go.
 * Progress arrives on ::asset-changed. */
LumaSyncAssetState luma_sync_store_request_asset (LumaSyncStore *self, const char *record, const char *name,
                                                  GCancellable *cancellable, GError **error);
LumaSyncAssetState luma_sync_store_pin_asset (LumaSyncStore *self, const char *record, const char *name,
                                              gboolean pinned, GCancellable *cancellable, GError **error);
LumaSyncAssetState luma_sync_store_evict_asset (LumaSyncStore *self, const char *record, const char *name,
                                                GCancellable *cancellable, GError **error);

/* Lease: mark a record as in use here for at most an hour, renewable.
 * take_over takes it from another device. Answers who holds it. */
LumaSyncLease *luma_sync_store_lease (LumaSyncStore *self, const char *record, guint seconds, gboolean take_over,
                                      GCancellable *cancellable, GError **error);
gboolean luma_sync_store_release (LumaSyncStore *self, const char *record, GCancellable *cancellable,
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
LumaSyncWriteResult *luma_sync_store_resolve_siblings (LumaSyncStore *self, const char *record, const char *keep,
                                                       GCancellable *cancellable, GError **error);

/* The record's lease as this device knows it, without taking it: holder,
 * until_ms, active and mine. With no lease, after a release, or once a lease
 * has expired, it answers the same: active FALSE, until_ms 0, no holder.
 * Local read (§7.3: "paused on Living room TV"). */
LumaSyncLease *luma_sync_store_get_lease (LumaSyncStore *self, const char *record, GCancellable *cancellable,
                                          GError **error);

/* DeleteZone: the app's own data in this zone, on every device. Kept for 30
 * days in Settings, where the person can restore it (§9.2). */
gboolean luma_sync_store_delete_zone (LumaSyncStore *self, GCancellable *cancellable, GError **error);

G_END_DECLS
