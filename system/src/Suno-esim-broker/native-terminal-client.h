/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <gio/gio.h>
typedef struct SunoMmTransport SunoMmTransport;
SunoMmTransport *Suno_mm_transport_open_current(GDBusConnection *,const gchar *,const gchar *,GError **);
gboolean Suno_mm_transport_attach(SunoMmTransport *,GSubprocessLauncher *);
void Suno_mm_transport_abandon_local_fd(SunoMmTransport *);
gboolean Suno_mm_transport_wait_terminal(SunoMmTransport *,GError **);
void Suno_mm_transport_destroy(SunoMmTransport *);

#if defined(SUNO_NATIVE_ESIM_CHANNEL_DIAGNOSTIC_ONLY) || defined(SUNO_NATIVE_ESIM_READONLY_DIAGNOSTIC_ONLY) || defined(SUNO_NATIVE_ESIM_FULL_LPAC_CANDIDATE_ONLY)
gboolean Suno_mm_transport_diagnostic_channel(GDBusConnection *,const gchar *,const gchar *,GCancellable *,GError **);
gboolean Suno_mm_transport_diagnostic_readonly(GDBusConnection *,const gchar *,const gchar *,GCancellable *,GError **);
#endif

/* Private broker memory only. Issued by exact MM terminal handle query. */
typedef struct { gchar *owner,*sim,*handle; guint64 generation,epoch; } SunoMmBinding;
void Suno_mm_binding_free(SunoMmBinding *);
SunoMmBinding *Suno_mm_transport_binding(SunoMmTransport *,GError **);
SunoMmTransport *Suno_mm_transport_open_bound(GDBusConnection *,const gchar *,const gchar *,const SunoMmBinding *,GError **);

#ifdef SUNO_NATIVE_ESIM_FULL_LPAC_CANDIDATE_ONLY
gboolean Suno_mm_transport_diagnostic_recovery(GDBusConnection *,const gchar *,const gchar *,GCancellable *,GError **);
#endif

#ifdef SUNO_NATIVE_ESIM_FULL_LPAC_CANDIDATE_ONLY
gboolean Suno_mm_transport_diagnostic_binding(GDBusConnection *,const gchar *,const gchar *,GCancellable *,GError **);
#endif
