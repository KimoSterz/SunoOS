/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include "luma-sync.h"

#include <gio/gunixfdlist.h>

G_BEGIN_DECLS

#define LUMA_SYNC_DBUS_ERROR "org.projectluma.portal.Sync.Error"
#define LUMA_SYNC_PORTAL_NAME "org.freedesktop.portal.Desktop"
#define LUMA_SYNC_PORTAL_PATH "/org/freedesktop/portal/desktop"
#define LUMA_SYNC_PORTAL_IFACE "org.projectluma.portal.Sync"

LumaSyncDevice *luma_sync_device_new_from_variant (GVariant *dict);
LumaSyncRecord *luma_sync_record_new_from_variant (GVariant *dict);
LumaSyncWriteResult *luma_sync_write_result_new_from_variant (GVariant *dict);
LumaSyncChanges *luma_sync_changes_new (GPtrArray *records, const char *token, gboolean more);
LumaSyncLease *luma_sync_lease_new_from_variant (GVariant *dict);
LumaSyncAsset *luma_sync_asset_new (const char *record, const char *name, const char *state, GVariant *info, int fd);
LumaSyncUsage *luma_sync_usage_new_from_variant (GVariant *usage, GVariant *limits);

gboolean luma_sync_label_is_valid (const char *label);

/* The store's data when there is no portal: the portal's methods, answered from files in the app's data folder
 * (luma-sync-local.c). Arguments and answers are exactly the portal's, so one parser serves both. */
typedef struct _LumaSyncLocal LumaSyncLocal;
LumaSyncLocal *luma_sync_local_new (const char *folder);
void luma_sync_local_free (LumaSyncLocal *local);
GVariant *luma_sync_local_call (LumaSyncLocal *local, const char *method, GVariant *parameters, GUnixFDList *fds,
                                GUnixFDList **out_fds, GError **error);

G_DEFINE_AUTOPTR_CLEANUP_FUNC (LumaSyncLocal, luma_sync_local_free)

G_END_DECLS
