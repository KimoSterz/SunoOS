/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include "Suno-sync.h"

#include <gio/gunixfdlist.h>

G_BEGIN_DECLS

#define SUNO_SYNC_DBUS_ERROR "org.projectSuno.portal.Sync.Error"
#define SUNO_SYNC_PORTAL_NAME "org.freedesktop.portal.Desktop"
#define SUNO_SYNC_PORTAL_PATH "/org/freedesktop/portal/desktop"
#define SUNO_SYNC_PORTAL_IFACE "org.projectSuno.portal.Sync"

SunoSyncDevice *Suno_sync_device_new_from_variant (GVariant *dict);
SunoSyncRecord *Suno_sync_record_new_from_variant (GVariant *dict);
SunoSyncWriteResult *Suno_sync_write_result_new_from_variant (GVariant *dict);
SunoSyncChanges *Suno_sync_changes_new (GPtrArray *records, const char *token, gboolean more);
SunoSyncLease *Suno_sync_lease_new_from_variant (GVariant *dict);
SunoSyncAsset *Suno_sync_asset_new (const char *record, const char *name, const char *state, GVariant *info, int fd);
SunoSyncUsage *Suno_sync_usage_new_from_variant (GVariant *usage, GVariant *limits);

gboolean Suno_sync_label_is_valid (const char *label);

/* The store's data when there is no portal: the portal's methods, answered from files in the app's data folder
 * (Suno-sync-local.c). Arguments and answers are exactly the portal's, so one parser serves both. */
typedef struct _SunoSyncLocal SunoSyncLocal;
SunoSyncLocal *Suno_sync_local_new (const char *folder);
void Suno_sync_local_free (SunoSyncLocal *local);
GVariant *Suno_sync_local_call (SunoSyncLocal *local, const char *method, GVariant *parameters, GUnixFDList *fds,
                                GUnixFDList **out_fds, GError **error);

G_DEFINE_AUTOPTR_CLEANUP_FUNC (SunoSyncLocal, Suno_sync_local_free)

G_END_DECLS
