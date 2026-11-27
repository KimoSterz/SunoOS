/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
/* Broker memory only, joined to an immutable actual public snapshot. */
typedef struct { SunoEsimSnapshot *snapshot;SunoMmBinding *binding;gint64 until; } SunoProfileNativeBinding;
static GMutex profile_native_lock;
static GHashTable *profile_native_bindings;
static SunoMmBinding *profile_native_copy(const SunoMmBinding *b){
 SunoMmBinding *n;if(!b)return NULL;n=g_new0(SunoMmBinding,1);n->owner=g_strdup(b->owner);n->sim=g_strdup(b->sim);n->handle=g_strdup(b->handle);n->generation=b->generation;n->epoch=b->epoch;return n;
}
static gboolean profile_native_same(const SunoMmBinding *a,const SunoMmBinding *b){
 return a&&b&&a->epoch&&a->epoch==b->epoch&&!g_strcmp0(a->owner,b->owner)&&!g_strcmp0(a->sim,b->sim);
}
static void profile_native_free(gpointer data){
 SunoProfileNativeBinding *n=data;Suno_esim_snapshot_unref(n->snapshot);Suno_mm_binding_free(n->binding);g_free(n);
}
static void profile_native_clear(const gchar *sender){
 g_mutex_lock(&profile_native_lock);
 if(profile_native_bindings){if(sender)g_hash_table_remove(profile_native_bindings,sender);else g_hash_table_remove_all(profile_native_bindings);}
 g_mutex_unlock(&profile_native_lock);
}
static gboolean profile_native_put(const gchar *sender,SunoEsimSnapshot *snapshot,SunoMmBinding **binding,GCancellable *cancel){
 gboolean ok=FALSE;SunoProfileNativeBinding *n;
 if(!sender||!snapshot||!binding||!*binding||!(*binding)->epoch||!(*binding)->generation)return FALSE;
 g_mutex_lock(&profile_native_lock);
 if(!profile_native_bindings)profile_native_bindings=g_hash_table_new_full(g_str_hash,g_str_equal,g_free,profile_native_free);
 if(!g_cancellable_is_cancelled(cancel)&&(g_hash_table_contains(profile_native_bindings,sender)||g_hash_table_size(profile_native_bindings)<SUNO_ESIM_MAX_CLIENTS)){
  n=g_new0(SunoProfileNativeBinding,1);n->snapshot=Suno_esim_snapshot_ref(snapshot);n->binding=*binding;*binding=NULL;n->until=g_get_monotonic_time()+5*60*G_USEC_PER_SEC;
  g_hash_table_replace(profile_native_bindings,g_strdup(sender),n);ok=TRUE;
 }
 g_mutex_unlock(&profile_native_lock);return ok;
}
static SunoMmBinding *profile_native_get(const gchar *sender,SunoEsimSnapshot *snapshot,const SunoMmBinding *current){
 SunoProfileNativeBinding *n;SunoMmBinding *copy=NULL;
 g_mutex_lock(&profile_native_lock);n=profile_native_bindings?g_hash_table_lookup(profile_native_bindings,sender):NULL;
 if(n&&n->snapshot==snapshot&&g_get_monotonic_time()<n->until&&profile_native_same(n->binding,current))copy=profile_native_copy(n->binding);
 g_mutex_unlock(&profile_native_lock);return copy;
}
