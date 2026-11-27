/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include "profile-store.h"
#define SUNO_ESIM_MAX_CLIENTS 32
/* Immutable after construction. A worker's reference survives disconnect/invalidation. */
typedef struct _SunoEsimSnapshot SunoEsimSnapshot;
typedef struct { GMutex lock; GHashTable *senders; } SunoEsimCache;
SunoEsimSnapshot *Suno_esim_snapshot_take(SunoEsimStore *store);
SunoEsimSnapshot *Suno_esim_snapshot_ref(SunoEsimSnapshot *snapshot);
void Suno_esim_snapshot_unref(SunoEsimSnapshot *snapshot);
const SunoEsimStore *Suno_esim_snapshot_store(SunoEsimSnapshot *snapshot);
void Suno_esim_cache_init(SunoEsimCache *cache);
void Suno_esim_cache_clear(SunoEsimCache *cache);
SunoEsimSnapshot *Suno_esim_cache_any(SunoEsimCache *cache);
SunoEsimSnapshot *Suno_esim_cache_get(SunoEsimCache *cache,const char *sender);
gboolean Suno_esim_cache_put(SunoEsimCache *cache,const char *sender,SunoEsimSnapshot *snapshot,GCancellable *cancel);
void Suno_esim_cache_remove(SunoEsimCache *cache,const char *sender);
void Suno_esim_cache_invalidate(SunoEsimCache *cache);
