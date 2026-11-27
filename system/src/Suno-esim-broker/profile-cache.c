/* SPDX-License-Identifier: Apache-2.0 */
#include "profile-cache.h"
#include <string.h>
struct _SunoEsimSnapshot { gatomicrefcount refs; SunoEsimStore store; };
SunoEsimSnapshot *Suno_esim_snapshot_take(SunoEsimStore *store) {
  SunoEsimSnapshot *s=g_new0(SunoEsimSnapshot,1);g_atomic_ref_count_init(&s->refs);
  s->store=*store;memset(store,0,sizeof *store);return s;
}
SunoEsimSnapshot *Suno_esim_snapshot_ref(SunoEsimSnapshot *s) {if(s)g_atomic_ref_count_inc(&s->refs);return s;}
void Suno_esim_snapshot_unref(SunoEsimSnapshot *s) {
  if(s && g_atomic_ref_count_dec(&s->refs)){Suno_esim_store_clear(&s->store);g_free(s);}
}
const SunoEsimStore *Suno_esim_snapshot_store(SunoEsimSnapshot *s) {return s?&s->store:NULL;}
void Suno_esim_cache_init(SunoEsimCache *c) {
  g_mutex_init(&c->lock);c->senders=g_hash_table_new_full(g_str_hash,g_str_equal,g_free,(GDestroyNotify)Suno_esim_snapshot_unref);
}
void Suno_esim_cache_clear(SunoEsimCache *c) {g_clear_pointer(&c->senders,g_hash_table_unref);g_mutex_clear(&c->lock);}
SunoEsimSnapshot *Suno_esim_cache_get(SunoEsimCache *c,const char *sender) {
  g_mutex_lock(&c->lock);SunoEsimSnapshot *s=Suno_esim_snapshot_ref(g_hash_table_lookup(c->senders,sender));g_mutex_unlock(&c->lock);return s;
}
SunoEsimSnapshot *Suno_esim_cache_any(SunoEsimCache *c) {
  GHashTableIter iter;gpointer value=NULL;SunoEsimSnapshot *s=NULL;
  g_mutex_lock(&c->lock);g_hash_table_iter_init(&iter,c->senders);
  if(g_hash_table_iter_next(&iter,NULL,&value))s=Suno_esim_snapshot_ref(value);
  g_mutex_unlock(&c->lock);return s;
}
gboolean Suno_esim_cache_put(SunoEsimCache *c,const char *sender,SunoEsimSnapshot *s,GCancellable *cancel) {
  gboolean ok=FALSE;
  if(!g_dbus_is_unique_name(sender) || !s || !s->store.sender || !s->store.generation || !s->store.profiles || !g_str_equal(s->store.sender,sender))return FALSE;
  g_mutex_lock(&c->lock);
  /* Cancel/remove is ordered by the same short lock; no hardware/bus calls inside. */
  if(!g_cancellable_is_cancelled(cancel) && (g_hash_table_contains(c->senders,sender) || g_hash_table_size(c->senders)<SUNO_ESIM_MAX_CLIENTS)){
    g_hash_table_replace(c->senders,g_strdup(sender),Suno_esim_snapshot_ref(s));ok=TRUE;
  }
  g_mutex_unlock(&c->lock);return ok;
}
void Suno_esim_cache_remove(SunoEsimCache *c,const char *sender) {g_mutex_lock(&c->lock);g_hash_table_remove(c->senders,sender);g_mutex_unlock(&c->lock);}
void Suno_esim_cache_invalidate(SunoEsimCache *c) {g_mutex_lock(&c->lock);g_hash_table_remove_all(c->senders);g_mutex_unlock(&c->lock);}
