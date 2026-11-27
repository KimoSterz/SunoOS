/* SPDX-License-Identifier: Apache-2.0 */
#include "profile-cache.h"
#include <string.h>
static SunoEsimSnapshot *snapshot(const char *sender) {
  const char *json="{\"payload\":{\"code\":0,\"data\":[{\"iccid\":\"1234567890123456789\",\"profileState\":\"disabled\",\"profileName\":\"Plan\"}]}}";
  SunoEsimStore s={0};g_assert_true(Suno_esim_store_load(&s,sender,(const guint8*)json,strlen(json),NULL));
  return Suno_esim_snapshot_take(&s);
}
static void separate_clients(void) {
  SunoEsimCache c={0};Suno_esim_cache_init(&c);g_autoptr(GCancellable) cancel=g_cancellable_new();
  SunoEsimSnapshot *a=snapshot(":1.1"),*b=snapshot(":1.2");
  g_assert_true(Suno_esim_cache_put(&c,":1.1",a,cancel));g_assert_true(Suno_esim_cache_put(&c,":1.2",b,cancel));
  SunoEsimSnapshot *held=Suno_esim_cache_get(&c,":1.1");const SunoEsimStore *s=Suno_esim_snapshot_store(held);const SunoEsimProfile *p=g_ptr_array_index(s->profiles,0);
  g_assert_nonnull(Suno_esim_store_select(s,":1.1",s->generation,p->handle));g_assert_null(Suno_esim_store_select(s,":1.2",s->generation,p->handle));
  Suno_esim_cache_remove(&c,":1.2");SunoEsimSnapshot *again=Suno_esim_cache_get(&c,":1.1");g_assert_true(again==held);Suno_esim_snapshot_unref(again);
  Suno_esim_cache_invalidate(&c);g_assert_null(Suno_esim_cache_get(&c,":1.1"));
  /* Worker still owns immutable card snapshot after disconnect/invalidation. */
  g_assert_nonnull(Suno_esim_store_select(s,":1.1",s->generation,p->handle));
  Suno_esim_snapshot_unref(a);Suno_esim_snapshot_unref(b);Suno_esim_snapshot_unref(held);Suno_esim_cache_clear(&c);
}
static void bounded_and_cancelled(void) {
  SunoEsimCache c={0};Suno_esim_cache_init(&c);g_autoptr(GCancellable) cancel=g_cancellable_new();
  for(guint i=0;i<SUNO_ESIM_MAX_CLIENTS;i++){
    g_autofree char *sender=g_strdup_printf(":1.%u",i+1);SunoEsimSnapshot *s=snapshot(sender);g_assert_true(Suno_esim_cache_put(&c,sender,s,cancel));Suno_esim_snapshot_unref(s);
  }
  SunoEsimSnapshot *excess=snapshot(":1.100"),*same=snapshot(":1.1");g_assert_false(Suno_esim_cache_put(&c,":1.100",excess,cancel));g_assert_true(Suno_esim_cache_put(&c,":1.1",same,cancel));
  g_cancellable_cancel(cancel);g_assert_false(Suno_esim_cache_put(&c,":1.1",same,cancel));g_assert_false(Suno_esim_cache_put(&c,":1.2",same,cancel));
  Suno_esim_snapshot_unref(excess);Suno_esim_snapshot_unref(same);Suno_esim_cache_clear(&c);
}
typedef struct {SunoEsimCache *cache;const char *sender;SunoEsimSnapshot *snapshot;} Racing;
static gpointer race(gpointer data) {
  Racing *r=data;g_autoptr(GCancellable) cancel=g_cancellable_new();
  for(guint i=0;i<1000;i++){
    g_assert_true(Suno_esim_cache_put(r->cache,r->sender,r->snapshot,cancel));SunoEsimSnapshot *held=Suno_esim_cache_get(r->cache,r->sender);
    if(held){g_assert_cmpstr(Suno_esim_snapshot_store(held)->sender,==,r->sender);Suno_esim_snapshot_unref(held);}
    Suno_esim_cache_remove(r->cache,r->sender);
  }return NULL;
}
static void concurrent_lifetimes(void) {
  SunoEsimCache c={0};Suno_esim_cache_init(&c);SunoEsimSnapshot *a=snapshot(":1.1"),*b=snapshot(":1.2");Racing ra={&c,":1.1",a},rb={&c,":1.2",b};
  GThread *one=g_thread_new("one",race,&ra),*two=g_thread_new("two",race,&rb);g_thread_join(one);g_thread_join(two);Suno_esim_cache_clear(&c);Suno_esim_snapshot_unref(a);Suno_esim_snapshot_unref(b);
}
int main(int argc,char **argv){g_test_init(&argc,&argv,NULL);g_test_add_func("/esim/cache/multiple-clients",separate_clients);g_test_add_func("/esim/cache/bounded-cancelled",bounded_and_cancelled);g_test_add_func("/esim/cache/concurrent-lifetimes",concurrent_lifetimes);return g_test_run();}
