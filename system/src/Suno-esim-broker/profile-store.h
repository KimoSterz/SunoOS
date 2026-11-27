/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <gio/gio.h>
#include <json-glib/json-glib.h>

typedef struct {
  char *handle, *selector, *name, *nickname, *provider;
  gboolean enabled;
} SunoEsimProfile;
typedef struct {
  char *generation, *sender;
  GPtrArray *profiles;
} SunoEsimStore;
void Suno_esim_store_clear (SunoEsimStore *store);
gboolean Suno_esim_store_load (SunoEsimStore *store, const char *sender,
                               const guint8 *json, gsize size, GError **error);
GVariant *Suno_esim_store_public (const SunoEsimStore *store);
const SunoEsimProfile *Suno_esim_store_select (const SunoEsimStore *store, const char *sender,
                                       const char *generation, const char *handle);
gboolean Suno_esim_store_equal (const SunoEsimStore *a, const SunoEsimStore *b);
