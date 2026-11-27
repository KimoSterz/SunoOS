/* SPDX-License-Identifier: GPL-2.0-or-later
 * MM-owner-context only. Native close/teardown callbacks supply terminal facts;
 * client EOF, process exit, timeout and reset acknowledgement never do.
 */
#ifndef SUNO_PROFILE_TERMINAL_REGISTRY_H
#define SUNO_PROFILE_TERMINAL_REGISTRY_H
#include <gio/gio.h>
#include <string.h>
typedef enum {
    SUNO_PROFILE_PENDING,
    SUNO_PROFILE_CLOSE_CONFIRMED,
    SUNO_PROFILE_RECOVERY_PENDING,
    SUNO_PROFILE_RECOVERY_REFUSED,
    SUNO_PROFILE_NATIVE_TEARDOWN_CONFIRMED,
    SUNO_PROFILE_NO_CHANNEL_DISPATCHED
} SunoProfileTerminalState;
typedef struct {
    gatomicrefcount refs;
    gchar *handle;
    gchar *sender;
    guint64 generation;
    guint64 candidate_epoch;
    gboolean diagnostic_open_response_lost;
    gssize operation;
    gint64 recovery_deadline;
    gint64 terminal_at;
    SunoProfileTerminalState state;
} SunoProfileTerminal;
static SunoProfileTerminal *Suno_profile_terminal_ref(SunoProfileTerminal *r) {
    g_atomic_ref_count_inc(&r->refs);return r;
}
static void Suno_profile_terminal_free(gpointer value) {
    SunoProfileTerminal *r=value;
    if(g_atomic_ref_count_dec(&r->refs)){
        g_free(r->handle); g_free(r->sender); g_free(r);
    }
}
/* A registry is attached to the SIM object; MM restart destroys it. The broker
 * binds responses to the same MM unique owner and cannot reuse old handles. */
static GHashTable *Suno_profile_terminal_registry_new(void) {
    return g_hash_table_new_full(g_str_hash,g_str_equal,g_free,Suno_profile_terminal_free);
}
static SunoProfileTerminal *Suno_profile_terminal_issue(GHashTable *registry,
    const gchar *sender,gssize operation,guint64 generation,gint64 now) {
    if(!sender || !g_dbus_is_unique_name(sender) || operation<0 || !generation || now<=0)
        return NULL;
    GHashTableIter it; gpointer value;
    g_hash_table_iter_init(&it,registry);
    while(g_hash_table_iter_next(&it,NULL,&value)) {
        SunoProfileTerminal *r=value;
        if(r->operation==operation && r->generation==generation && !r->terminal_at)
            return NULL;
        if(r->terminal_at && now-r->terminal_at>=300*G_USEC_PER_SEC)
            g_hash_table_iter_remove(&it);
    }
    /* Never evict a pending or uncertain owner to admit another request. */
    if(g_hash_table_size(registry)>=64) return NULL;
    SunoProfileTerminal *r=g_new0(SunoProfileTerminal,1);
    g_atomic_ref_count_init(&r->refs);
    r->handle=g_uuid_string_random(); r->sender=g_strdup(sender);
    r->operation=operation; r->generation=generation;
    r->state=SUNO_PROFILE_PENDING;
    g_hash_table_insert(registry,g_strdup(r->handle),r);
    return r;
}
static SunoProfileTerminal *Suno_profile_terminal_lookup(GHashTable *registry,
    const gchar *handle,const gchar *sender) {
    if(!handle || !sender)
        return NULL;
    guint length=0;while(length<37 && handle[length])length++;
    if(length!=36 || !g_uuid_string_is_valid(handle))
        return NULL;
    SunoProfileTerminal *r=g_hash_table_lookup(registry,handle);
    return r && !g_strcmp0(r->sender,sender) ? r : NULL;
}
static gboolean Suno_profile_terminal_observe(SunoProfileTerminal *r,
    gssize operation,guint64 generation,SunoProfileTerminalState state,gint64 now) {
    if(!r || r->operation!=operation || r->generation!=generation || now<=0)
        return FALSE;
    if(r->terminal_at) return r->state==state;
    if(state==SUNO_PROFILE_PENDING) return FALSE;
    if(state==SUNO_PROFILE_CLOSE_CONFIRMED || state==SUNO_PROFILE_NATIVE_TEARDOWN_CONFIRMED || state==SUNO_PROFILE_NO_CHANNEL_DISPATCHED) {
        r->state=state; r->terminal_at=now; return TRUE;
    }
    if(state==SUNO_PROFILE_RECOVERY_PENDING) {
        if(r->state==SUNO_PROFILE_RECOVERY_REFUSED) return FALSE;
        if(!r->recovery_deadline) r->recovery_deadline=now+30*G_USEC_PER_SEC;
        r->state=state; return TRUE;
    }
    if(state==SUNO_PROFILE_RECOVERY_REFUSED && r->recovery_deadline && now>=r->recovery_deadline) {
        r->state=state; return TRUE;
    }
    return FALSE;
}
static gboolean Suno_profile_terminal_safe_to_release(const SunoProfileTerminal *r) {
    return r && r->terminal_at && (r->state==SUNO_PROFILE_CLOSE_CONFIRMED ||
        r->state==SUNO_PROFILE_NATIVE_TEARDOWN_CONFIRMED || r->state==SUNO_PROFILE_NO_CHANNEL_DISPATCHED);
}
#endif
