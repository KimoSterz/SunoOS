/* SPDX-License-Identifier: Apache-2.0 */
/* The no-portal mode of LumaSyncStore (ADR-057 §3.7): every portal method answered from files in the app's own
 * data folder, with the same arguments, answers and keep-both rules, so an app behaves the same on another OS or
 * an older Luma; writes answer "local" and nothing leaves the device. */

#define _GNU_SOURCE 1
#include "luma-sync-private.h"

#include <errno.h>
#include <fcntl.h>
#ifdef __linux__
#include <sys/mman.h>
#endif
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <glib/gstdio.h>

#define MAX_NAME 255
#define MAX_VALUE (256 * 1024)
#define MAX_RECORDS 100
#define MAX_VERSIONS 4
#define MAX_ASSETS 32
#define MAX_INLINE (G_GINT64_CONSTANT (64) * 1024 * 1024)
#define MAX_ON_DEMAND (G_GINT64_CONSTANT (16) * 1000 * 1000 * 1000)
#define F_DELETED 1u
#define F_SIBLING 16u
#define F_MINE 32u
#define A_ON_DEMAND 1u
#define A_HERE 2u
#define A_PINNED 4u

struct _LumaSyncLocal
{
  GMutex lock;
  char *folder;
  gint64 last_ms;
  GHashTable *leases;        /* "zone\nrecord" -> gint64* until */
};

LumaSyncLocal *
luma_sync_local_new (const char *folder)
{
  LumaSyncLocal *local = g_new0 (LumaSyncLocal, 1);

  g_mutex_init (&local->lock);
  local->folder = g_strdup (folder);
  local->leases = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_free);
  return local;
}

void
luma_sync_local_free (LumaSyncLocal *local)
{
  if (local == NULL)
    return;
  g_mutex_clear (&local->lock);
  g_free (local->folder);
  g_hash_table_unref (local->leases);
  g_free (local);
}

/* ------------------------------------------------------------------ checks */

gboolean
luma_sync_label_is_valid (const char *label)
{
  gsize len;

  if (label == NULL || !g_ascii_isalnum (label[0]) || g_ascii_isupper (label[0]))
    return FALSE;
  len = strlen (label);
  if (len > 32)
    return FALSE;
  for (gsize i = 0; i < len; i++)
    {
      char c = label[i];
      if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-'))
        return FALSE;
    }
  return TRUE;
}

static gboolean
check_label (const char *label, GError **error)
{
  if (!luma_sync_label_is_valid (label))
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID,
                   "A zone label is 1 to 32 of a-z, 0-9, '.', '_' and '-', starting with a letter or digit");
      return FALSE;
    }
  return TRUE;
}

static gboolean
check_name (const char *name, GError **error)
{
  if (name == NULL || *name == '\0' || !g_utf8_validate (name, -1, NULL))
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID, "A name is non-empty UTF-8");
      return FALSE;
    }
  if (strlen (name) > MAX_NAME)
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_TOO_LARGE, "A name is at most 255 bytes");
      return FALSE;
    }
  for (const char *p = name; *p; p++)
    if ((guchar) *p < 0x20 || *p == 0x7f)
      {
        g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID, "A name can't contain control characters");
        return FALSE;
      }
  return TRUE;
}

static gboolean
check_base (const char *base, GError **error)
{
  gsize len = base ? strlen (base) : 0;

  if (len == 0)
    return TRUE;
  if (len == 32)
    {
      gsize i;
      for (i = 0; i < 32 && g_ascii_isxdigit (base[i]) && !g_ascii_isupper (base[i]); i++)
        ;
      if (i == 32)
        return TRUE;
    }
  g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID, "That isn't a version this store gave out");
  return FALSE;
}

/* ------------------------------------------------------------------ files */

static char *
zone_dir (LumaSyncLocal *local, const char *zone, const char *sub)
{
  return g_build_filename (local->folder, zone, sub, NULL);
}

static char *
record_path (LumaSyncLocal *local, const char *zone, const char *name)
{
  g_autoptr(GString) hex = g_string_new (NULL);
  g_autofree char *dir = zone_dir (local, zone, "records");

  for (const guchar *p = (const guchar *) name; *p; p++)
    g_string_append_printf (hex, "%02x", *p);
  return g_build_filename (dir, hex->str, NULL);
}

static char *
name_from_file (const char *file)
{
  gsize len = strlen (file);
  g_autoptr(GString) out = g_string_new (NULL);

  if (len % 2 != 0)
    return NULL;
  for (gsize i = 0; i < len; i += 2)
    {
      int hi = g_ascii_xdigit_value (file[i]), lo = g_ascii_xdigit_value (file[i + 1]);
      if (hi < 0 || lo < 0)
        return NULL;
      g_string_append_c (out, (char) ((hi << 4) | lo));
    }
  return g_string_free (g_steal_pointer (&out), FALSE);
}

static gboolean
ensure_zone (LumaSyncLocal *local, const char *zone, GError **error)
{
  g_autofree char *records = zone_dir (local, zone, "records");
  g_autofree char *assets = zone_dir (local, zone, "assets");

  if (g_mkdir_with_parents (records, 0700) != 0 || g_mkdir_with_parents (assets, 0700) != 0)
    {
      int saved = errno;
      g_set_error (error, G_IO_ERROR, g_io_error_from_errno (saved), "Can't create the store's folder: %s", g_strerror (saved));
      return FALSE;
    }
  return TRUE;
}

static gboolean
write_variant (const char *path, GVariant *value, GError **error)
{
  g_autoptr(GVariant) owned = g_variant_ref_sink (value);
  g_autoptr(GBytes) bytes = g_variant_get_data_as_bytes (owned);

  return g_file_set_contents_full (path, g_bytes_get_data (bytes, NULL), (gssize) g_bytes_get_size (bytes),
                                   G_FILE_SET_CONTENTS_CONSISTENT | G_FILE_SET_CONTENTS_DURABLE, 0600, error);
}

static GVariant *
read_variant (const char *path, const GVariantType *type)
{
  char *data = NULL;
  gsize size = 0;
  g_autoptr(GBytes) bytes = NULL;
  g_autoptr(GVariant) value = NULL;

  if (!g_file_get_contents (path, &data, &size, NULL))
    return NULL;
  bytes = g_bytes_new_take (data, size);
  value = g_variant_new_from_bytes (type, bytes, FALSE);
  return g_variant_ref_sink (g_variant_get_normal_form (value));
}

/* (epoch, seq) of a zone. */
static void
zone_meta (LumaSyncLocal *local, const char *zone, char **epoch, guint64 *seq)
{
  g_autofree char *path = zone_dir (local, zone, "meta");
  g_autoptr(GVariant) meta = read_variant (path, G_VARIANT_TYPE ("(st)"));

  if (meta == NULL)
    {
      g_autofree char *fresh = g_uuid_string_random ();
      *epoch = g_strndup (fresh, 8);
      *seq = 0;
      write_variant (path, g_variant_new ("(st)", *epoch, (guint64) 0), NULL);
      return;
    }
  g_variant_get (meta, "(st)", epoch, seq);
}

static guint64
next_seq (LumaSyncLocal *local, const char *zone)
{
  g_autofree char *epoch = NULL;
  g_autofree char *path = zone_dir (local, zone, "meta");
  guint64 seq;

  zone_meta (local, zone, &epoch, &seq);
  seq++;
  write_variant (path, g_variant_new ("(st)", epoch, seq), NULL);
  return seq;
}

/* A record file: (seq, versions); a version is a{sv}: i s, v ay, t x, a a{s(sxu)}, x as, r b. */
#define RECORD_TYPE "(taa{sv})"

static GPtrArray *
load_versions (LumaSyncLocal *local, const char *zone, const char *name, guint64 *seq_out)
{
  g_autofree char *path = record_path (local, zone, name);
  g_autoptr(GVariant) record = read_variant (path, G_VARIANT_TYPE (RECORD_TYPE));
  GPtrArray *versions = g_ptr_array_new_with_free_func ((GDestroyNotify) g_variant_unref);
  g_autoptr(GVariant) list = NULL;
  guint64 seq = 0;

  if (record != NULL)
    {
      g_variant_get (record, "(t@aa{sv})", &seq, &list);
      for (gsize i = 0; i < g_variant_n_children (list); i++)
        g_ptr_array_add (versions, g_variant_get_child_value (list, i));
    }
  if (seq_out)
    *seq_out = seq;
  return versions;
}

static gboolean
store_versions (LumaSyncLocal *local, const char *zone, const char *name, GPtrArray *versions, GError **error)
{
  g_autofree char *path = record_path (local, zone, name);
  g_auto(GVariantBuilder) list = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("aa{sv}"));

  for (guint i = 0; i < versions->len; i++)
    g_variant_builder_add_value (&list, g_ptr_array_index (versions, i));
  return write_variant (path, g_variant_new ("(t@aa{sv})", next_seq (local, zone), g_variant_builder_end (&list)), error);
}

/* ------------------------------------------------------------------ versions and keep-both */

static const char *
v_id (GVariant *v)
{
  const char *id = "";
  g_variant_lookup (v, "i", "&s", &id);
  return id;
}

static gint64
v_time (GVariant *v)
{
  gint64 t = 0;
  g_variant_lookup (v, "t", "x", &t);
  return t;
}

static gboolean
v_newer (GVariant *a, GVariant *b)
{
  return v_time (a) != v_time (b) ? v_time (a) > v_time (b) : g_strcmp0 (v_id (a), v_id (b)) > 0;
}

static GVariant *
current (GPtrArray *versions)
{
  GVariant *top = NULL;

  for (guint i = 0; i < versions->len; i++)
    if (top == NULL || v_newer (g_ptr_array_index (versions, i), top))
      top = g_ptr_array_index (versions, i);
  return top;
}

static GVariant *
find_version (GPtrArray *versions, const char *id)
{
  for (guint i = 0; id != NULL && *id && i < versions->len; i++)
    if (g_str_equal (v_id (g_ptr_array_index (versions, i)), id))
      return g_ptr_array_index (versions, i);
  return NULL;
}

static gint64
local_now (LumaSyncLocal *local)
{
  gint64 now = g_get_real_time () / 1000;

  if (now <= local->last_ms)
    now = local->last_ms + 1;
  local->last_ms = now;
  return now;
}

static char *
new_id (void)
{
  guint8 raw[16];
  GString *out = g_string_sized_new (32);

  for (gsize i = 0; i < sizeof raw; i++)
    raw[i] = (guint8) g_random_int_range (0, 256);
  for (gsize i = 0; i < sizeof raw; i++)
    g_string_append_printf (out, "%02x", raw[i]);
  return g_string_free (out, FALSE);
}

static GVariant *
make_version (LumaSyncLocal *local, GBytes *value, GVariant *assets, const char *supersedes, gint64 time_ms, gboolean resolved,
              const char *id)
{
  g_auto(GVariantBuilder) b = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
  g_autofree char *fresh = id ? NULL : new_id ();
  const char *x[] = { supersedes, NULL };

  g_variant_builder_add (&b, "{sv}", "i", g_variant_new_string (id ? id : fresh));
  g_variant_builder_add (&b, "{sv}", "v", g_variant_new_from_bytes (G_VARIANT_TYPE_BYTESTRING, value, TRUE));
  g_variant_builder_add (&b, "{sv}", "t", g_variant_new_int64 (time_ms ? time_ms : local_now (local)));
  g_variant_builder_add (&b, "{sv}", "a", assets ? assets : g_variant_new ("a{s(sxu)}", NULL));
  g_variant_builder_add (&b, "{sv}", "x", g_variant_new_strv (x, (supersedes && *supersedes) ? 1 : 0));
  g_variant_builder_add (&b, "{sv}", "r", g_variant_new_boolean (resolved));
  return g_variant_ref_sink (g_variant_builder_end (&b));
}

/* versions + new, without what new supersedes. */
static GPtrArray *
merged (GPtrArray *versions, GVariant *new_version)
{
  GPtrArray *out = g_ptr_array_new_with_free_func ((GDestroyNotify) g_variant_unref);
  g_autofree const char **gone = NULL;

  g_variant_lookup (new_version, "x", "^a&s", &gone);
  for (guint i = 0; i < versions->len; i++)
    {
      GVariant *v = g_ptr_array_index (versions, i);
      if (gone == NULL || !g_strv_contains (gone, v_id (v)))
        g_ptr_array_add (out, g_variant_ref (v));
    }
  g_ptr_array_add (out, g_variant_ref (new_version));
  return out;
}

static GVariant *
device_local (void)
{
  g_auto(GVariantBuilder) b = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);

  g_variant_builder_add (&b, "{sv}", "handle", g_variant_new_string ("local"));
  g_variant_builder_add (&b, "{sv}", "name", g_variant_new_string (g_get_host_name ()));
  g_variant_builder_add (&b, "{sv}", "class", g_variant_new_string (""));
  g_variant_builder_add (&b, "{sv}", "mine", g_variant_new_boolean (TRUE));
  return g_variant_builder_end (&b);
}

static GVariant *
version_out (LumaSyncLocal *local, const char *zone, const char *name, GVariant *v, guint flags)
{
  g_auto(GVariantBuilder) b = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
  g_auto(GVariantBuilder) assets = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("aa{sv}"));
  g_autoptr(GVariant) value = g_variant_lookup_value (v, "v", G_VARIANT_TYPE_BYTESTRING);
  g_autoptr(GVariant) list = g_variant_lookup_value (v, "a", G_VARIANT_TYPE ("a{s(sxu)}"));
  gboolean resolved = FALSE;
  GVariantIter iter;
  const char *asset_name, *asset_id;
  gint64 size;
  guint32 asset_flags;

  g_variant_lookup (v, "r", "b", &resolved);
  g_variant_iter_init (&iter, list);
  while (g_variant_iter_next (&iter, "{&s(&sxu)}", &asset_name, &asset_id, &size, &asset_flags))
    {
      g_auto(GVariantBuilder) a = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
      g_autofree char *dir = zone_dir (local, zone, "assets");
      g_autofree char *file = g_build_filename (dir, asset_id, NULL);
      guint here = g_file_test (file, G_FILE_TEST_IS_REGULAR) ? A_HERE : 0;

      g_variant_builder_add (&a, "{sv}", "name", g_variant_new_string (asset_name));
      g_variant_builder_add (&a, "{sv}", "size", g_variant_new_uint64 ((guint64) size));
      g_variant_builder_add (&a, "{sv}", "flags", g_variant_new_uint32 ((asset_flags & A_ON_DEMAND) | here | A_PINNED));
      g_variant_builder_add_value (&assets, g_variant_builder_end (&a));
    }
  g_variant_builder_add (&b, "{sv}", "name", g_variant_new_string (name));
  g_variant_builder_add (&b, "{sv}", "version", g_variant_new_string (v_id (v)));
  g_variant_builder_add (&b, "{sv}", "value", value ? g_variant_ref (value) : g_variant_new_bytestring (""));
  g_variant_builder_add (&b, "{sv}", "time_ms", g_variant_new_int64 (v_time (v)));
  g_variant_builder_add (&b, "{sv}", "flags", g_variant_new_uint32 (flags | F_MINE));
  g_variant_builder_add (&b, "{sv}", "writer", device_local ());
  if (resolved)
    g_variant_builder_add (&b, "{sv}", "resolved_by", device_local ());
  g_variant_builder_add (&b, "{sv}", "assets", g_variant_builder_end (&assets));
  return g_variant_builder_end (&b);
}

static GVariant *
record_out (LumaSyncLocal *local, const char *zone, const char *name, GPtrArray *versions)
{
  GVariant *top = current (versions);
  g_auto(GVariantBuilder) siblings = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("aa{sv}"));
  g_autoptr(GPtrArray) rest = g_ptr_array_new ();
  g_autoptr(GVariant) head = NULL;
  g_auto(GVariantBuilder) b = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
  GVariantIter iter;
  const char *key;
  GVariant *value;

  if (top == NULL)
    {
      g_variant_builder_add (&b, "{sv}", "name", g_variant_new_string (name));
      g_variant_builder_add (&b, "{sv}", "version", g_variant_new_string (""));
      g_variant_builder_add (&b, "{sv}", "flags", g_variant_new_uint32 (F_DELETED));
      return g_variant_builder_end (&b);
    }
  for (guint i = 0; i < versions->len; i++)
    if (g_ptr_array_index (versions, i) != top)
      g_ptr_array_add (rest, g_ptr_array_index (versions, i));
  /* newest first */
  for (guint i = 0; i < rest->len; i++)
    for (guint j = i + 1; j < rest->len; j++)
      if (v_newer (g_ptr_array_index (rest, j), g_ptr_array_index (rest, i)))
        {
          gpointer tmp = rest->pdata[i];
          rest->pdata[i] = rest->pdata[j];
          rest->pdata[j] = tmp;
        }
  for (guint i = 0; i < rest->len; i++)
    g_variant_builder_add_value (&siblings, version_out (local, zone, name, g_ptr_array_index (rest, i), F_SIBLING));

  head = g_variant_ref_sink (version_out (local, zone, name, top, 0));
  g_variant_iter_init (&iter, head);
  while (g_variant_iter_next (&iter, "{&sv}", &key, &value))
    {
      g_variant_builder_add (&b, "{sv}", key, value);
      g_variant_unref (value);
    }
  g_variant_builder_add (&b, "{sv}", "siblings", g_variant_builder_end (&siblings));
  return g_variant_builder_end (&b);
}

static GVariant *
result_out (LumaSyncLocal *local, const char *zone, const char *name, const char *outcome, GPtrArray *versions)
{
  g_auto(GVariantBuilder) b = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);

  g_variant_builder_add (&b, "{sv}", "name", g_variant_new_string (name));
  g_variant_builder_add (&b, "{sv}", "outcome", g_variant_new_string (outcome));
  g_variant_builder_add (&b, "{sv}", "record", record_out (local, zone, name, versions));
  return g_variant_builder_end (&b);
}

/* A write of value/assets over base (§3.5): "local" when kept, else "conflict" or "too-many-siblings". */
static const char *
decide_put (LumaSyncLocal *local, GPtrArray *versions, const char *base, GBytes *value, GVariant *assets, gboolean fail,
            GPtrArray **after)
{
  GVariant *top = current (versions);
  gboolean over_current = (top == NULL && (base == NULL || *base == '\0')) || (top != NULL && g_strcmp0 (base, v_id (top)) == 0);
  g_autoptr(GVariant) fresh = NULL;

  if (!over_current && fail)
    return "conflict";
  fresh = make_version (local, value, assets, find_version (versions, base) ? base : NULL, 0, FALSE, NULL);
  *after = merged (versions, fresh);
  if ((*after)->len > MAX_VERSIONS)
    {
      g_clear_pointer (after, g_ptr_array_unref);
      return "too-many-siblings";
    }
  return "local";
}

/* ------------------------------------------------------------------ assets */

static gboolean
copy_fd (int fd, const char *dest, gint64 cap, gint64 *size_out, GError **error)
{
  g_autofree char *tmp = g_strconcat (dest, ".part", NULL);
  int out = g_open (tmp, O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
  char buf[65536];
  gint64 offset = 0;
  struct stat st;

  if (out < 0 || fstat (fd, &st) != 0 || !S_ISREG (st.st_mode))
    {
      if (out >= 0)
        close (out);
      g_unlink (tmp);
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_BAD_DESCRIPTOR, "An asset must be a regular file or a memfd");
      return FALSE;
    }
  for (;;)
    {
      ssize_t n = pread (fd, buf, sizeof buf, (off_t) offset);
      if (n < 0 && errno == EINTR)
        continue;
      if (n < 0)
        {
          close (out);
          g_unlink (tmp);
          g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_BAD_DESCRIPTOR, "The asset can't be read");
          return FALSE;
        }
      if (n == 0)
        break;
      offset += n;
      if (offset > cap || write (out, buf, (size_t) n) != n)
        {
          close (out);
          g_unlink (tmp);
          g_set_error (error, LUMA_SYNC_ERROR, offset > cap ? LUMA_SYNC_ERROR_TOO_LARGE : LUMA_SYNC_ERROR_FAILED,
                       offset > cap ? "The asset is larger than allowed" : "The asset couldn't be kept");
          return FALSE;
        }
    }
  fsync (out);
  close (out);
  if (g_rename (tmp, dest) != 0)
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_FAILED, "The asset couldn't be kept");
      return FALSE;
    }
  *size_out = offset;
  return TRUE;
}

/* A read-only descriptor of a private copy (a sealed memfd where there are memfds). */
static int
private_copy (const char *path)
{
#ifdef __linux__
  int fd = memfd_create ("luma-sync-asset", MFD_CLOEXEC | MFD_ALLOW_SEALING);
  int src = g_open (path, O_RDONLY | O_CLOEXEC, 0);
  char buf[65536];
  char proc[64];
  int reader;

  if (fd < 0 || src < 0)
    {
      if (fd >= 0)
        close (fd);
      if (src >= 0)
        close (src);
      return -1;
    }
  for (;;)
    {
      ssize_t n = read (src, buf, sizeof buf);
      if (n < 0 && errno == EINTR)
        continue;
      if (n <= 0 || write (fd, buf, (size_t) n) != n)
        break;
    }
  close (src);
  fcntl (fd, F_ADD_SEALS, F_SEAL_WRITE | F_SEAL_GROW | F_SEAL_SHRINK | F_SEAL_SEAL);
  g_snprintf (proc, sizeof proc, "/proc/self/fd/%d", fd);
  reader = g_open (proc, O_RDONLY | O_CLOEXEC, 0);
  close (fd);
  return reader;
#else
  return g_open (path, O_RDONLY | O_CLOEXEC, 0);
#endif
}

/* ------------------------------------------------------------------ the methods */

static GVariant *
m_save (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone;
  g_autoptr(GVariant) records = NULL, options = NULL;
  const char *policy = "keep-both";
  g_auto(GVariantBuilder) results = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("aa{sv}"));
  gsize n;

  g_variant_get (params, "(&s@a(says)@a{sv})", &zone, &records, &options);
  g_variant_lookup (options, "on_conflict", "&s", &policy);
  n = g_variant_n_children (records);
  if (!check_label (zone, error))
    return NULL;
  if (n == 0 || n > MAX_RECORDS)
    {
      g_set_error (error, LUMA_SYNC_ERROR, n ? LUMA_SYNC_ERROR_TOO_LARGE : LUMA_SYNC_ERROR_INVALID, "Save takes 1 to 100 records");
      return NULL;
    }
  if (!g_str_equal (policy, "keep-both") && !g_str_equal (policy, "fail"))
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID, "on_conflict is keep-both or fail");
      return NULL;
    }
  for (gsize i = 0; i < n; i++)
    {
      const char *name, *base;
      g_autoptr(GVariant) value = NULL;
      g_variant_get_child (records, i, "(&s@ays)", &name, &value, &base);
      if (!check_name (name, error) || !check_base (base, error))
        return NULL;
      if (g_variant_get_size (value) > MAX_VALUE)
        {
          g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_TOO_LARGE, "A value is at most 256 KiB");
          return NULL;
        }
    }
  if (!ensure_zone (local, zone, error))
    return NULL;
  for (gsize i = 0; i < n; i++)
    {
      const char *name, *base;
      g_autoptr(GVariant) value = NULL;
      g_autoptr(GBytes) bytes = NULL;
      g_autoptr(GPtrArray) versions = NULL;
      g_autoptr(GPtrArray) after = NULL;
      g_autoptr(GVariant) assets = NULL;
      GVariant *base_version;
      const char *outcome;

      g_variant_get_child (records, i, "(&s@ays)", &name, &value, &base);
      bytes = g_variant_get_data_as_bytes (value);
      versions = load_versions (local, zone, name, NULL);
      base_version = find_version (versions, base);
      if (base_version)
        assets = g_variant_lookup_value (base_version, "a", G_VARIANT_TYPE ("a{s(sxu)}"));
      outcome = decide_put (local, versions, base, bytes, assets ? g_variant_ref (assets) : NULL, g_str_equal (policy, "fail"),
                            &after);
      if (after != NULL && !store_versions (local, zone, name, after, error))
        return NULL;
      g_variant_builder_add_value (&results, result_out (local, zone, name, outcome, after ? after : versions));
    }
  return g_variant_new ("(aa{sv})", &results);
}

static GVariant *
m_delete (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone;
  g_autoptr(GVariant) items = NULL, options = NULL;
  g_auto(GVariantBuilder) results = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("aa{sv}"));
  gsize n;

  g_variant_get (params, "(&s@a(ss)@a{sv})", &zone, &items, &options);
  n = g_variant_n_children (items);
  if (!check_label (zone, error))
    return NULL;
  if (n == 0 || n > MAX_RECORDS)
    {
      g_set_error (error, LUMA_SYNC_ERROR, n ? LUMA_SYNC_ERROR_TOO_LARGE : LUMA_SYNC_ERROR_INVALID, "Delete takes 1 to 100 records");
      return NULL;
    }
  if (!ensure_zone (local, zone, error))
    return NULL;
  for (gsize i = 0; i < n; i++)
    {
      const char *name, *base;
      g_autoptr(GPtrArray) versions = NULL;
      g_autoptr(GPtrArray) empty = g_ptr_array_new ();
      GVariant *top;

      g_variant_get_child (items, i, "(&s&s)", &name, &base);
      if (!check_name (name, error) || !check_base (base, error))
        return NULL;
      versions = load_versions (local, zone, name, NULL);
      top = current (versions);
      if (top != NULL && g_strcmp0 (base, v_id (top)) != 0)
        {
          g_variant_builder_add_value (&results, result_out (local, zone, name, "conflict", versions));
          continue;
        }
      if (top != NULL && !store_versions (local, zone, name, empty, error))
        return NULL;
      g_variant_builder_add_value (&results, result_out (local, zone, name, "local", empty));
    }
  return g_variant_new ("(aa{sv})", &results);
}

static GVariant *
m_fetch_changes (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone, *token;
  g_autoptr(GVariant) options = NULL;
  g_autofree char *epoch = NULL;
  g_autofree char *dir = NULL;
  g_autoptr(GDir) d = NULL;
  g_autoptr(GPtrArray) rows = g_ptr_array_new_with_free_func (g_free);
  g_auto(GVariantBuilder) out = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("aa{sv}"));
  guint64 seq, after = 0, last = 0;
  guint32 limit = 200;
  const char *file;
  guint count = 0;
  gboolean more = FALSE;
  g_autofree char *next = NULL;

  g_variant_get (params, "(&s&s@a{sv})", &zone, &token, &options);
  g_variant_lookup (options, "limit", "u", &limit);
  limit = CLAMP (limit, 1, 500);
  if (!check_label (zone, error) || !ensure_zone (local, zone, error))
    return NULL;
  zone_meta (local, zone, &epoch, &seq);
  if (*token)
    {
      g_auto(GStrv) parts = g_strsplit (token, ".", 3);
      if (g_strv_length (parts) != 3 || !g_str_equal (parts[0], "local"))
        {
          g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID, "That isn't a change token this store gave out");
          return NULL;
        }
      if (g_str_equal (parts[1], epoch))
        after = g_ascii_strtoull (parts[2], NULL, 10);
    }
  dir = zone_dir (local, zone, "records");
  d = g_dir_open (dir, 0, NULL);
  /* (seq, name) of every record changed after the token, in sequence order. */
  while (d && (file = g_dir_read_name (d)) != NULL)
    {
      g_autofree char *name = name_from_file (file);
      guint64 rseq;
      g_autoptr(GPtrArray) versions = NULL;

      if (name == NULL)
        continue;
      versions = load_versions (local, zone, name, &rseq);
      if (rseq > after)
        g_ptr_array_add (rows, g_strdup_printf ("%020" G_GUINT64_FORMAT "\n%s", rseq, name));
    }
  g_ptr_array_sort_values (rows, (GCompareFunc) g_strcmp0);
  for (guint i = 0; i < rows->len; i++)
    {
      const char *row = g_ptr_array_index (rows, i);
      const char *name = strchr (row, '\n') + 1;
      g_autoptr(GPtrArray) versions = NULL;

      if (count == limit)
        {
          more = TRUE;
          break;
        }
      versions = load_versions (local, zone, name, NULL);
      g_variant_builder_add_value (&out, record_out (local, zone, name, versions));
      last = g_ascii_strtoull (row, NULL, 10);
      count++;
    }
  if (!more)
    last = MAX (seq, after);
  next = g_strdup_printf ("local.%s.%" G_GUINT64_FORMAT, epoch, last);
  return g_variant_new ("(aa{sv}sb)", &out, next, more);
}

static GVariant *
m_get (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone, *name;
  g_autoptr(GPtrArray) versions = NULL;

  g_variant_get (params, "(&s&s)", &zone, &name);
  if (!check_label (zone, error) || !check_name (name, error))
    return NULL;
  versions = load_versions (local, zone, name, NULL);
  if (versions->len == 0)
    return g_variant_new ("(b@a{sv})", FALSE, g_variant_new ("a{sv}", NULL));
  return g_variant_new ("(b@a{sv})", TRUE, record_out (local, zone, name, versions));
}

static GVariant *
m_list (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone, *after;
  guint32 limit;
  g_autofree char *dir = NULL;
  g_autoptr(GDir) d = NULL;
  g_autoptr(GPtrArray) names = g_ptr_array_new_with_free_func (g_free);
  g_auto(GVariantBuilder) out = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("aa{sv}"));
  const char *file;
  const char *next = "";
  guint count = 0;

  g_variant_get (params, "(&s&su)", &zone, &after, &limit);
  if (!check_label (zone, error) || (*after && !check_name (after, error)))
    return NULL;
  limit = limit ? MIN (limit, 500) : 100;
  dir = zone_dir (local, zone, "records");
  d = g_dir_open (dir, 0, NULL);
  while (d && (file = g_dir_read_name (d)) != NULL)
    {
      char *name = name_from_file (file);
      if (name != NULL && strcmp (name, after) > 0)
        g_ptr_array_add (names, name);
      else
        g_free (name);
    }
  g_ptr_array_sort_values (names, (GCompareFunc) strcmp);
  for (guint i = 0; i < names->len; i++)
    {
      const char *name = g_ptr_array_index (names, i);
      g_autoptr(GPtrArray) versions = load_versions (local, zone, name, NULL);

      if (versions->len == 0)
        continue;
      if (count == limit)
        {
          next = g_ptr_array_index (names, i - 1);
          break;
        }
      g_variant_builder_add_value (&out, record_out (local, zone, name, versions));
      count++;
    }
  return g_variant_new ("(aa{sv}s)", &out, next);
}

static GVariant *
assets_with (GVariant *top, const char *name, const char *asset_id, gint64 size, guint32 flags, gboolean remove)
{
  g_auto(GVariantBuilder) b = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE ("a{s(sxu)}"));
  g_autoptr(GVariant) list = top ? g_variant_lookup_value (top, "a", G_VARIANT_TYPE ("a{s(sxu)}")) : NULL;
  GVariantIter iter;
  const char *n, *id;
  gint64 s;
  guint32 f;

  if (list)
    {
      g_variant_iter_init (&iter, list);
      while (g_variant_iter_next (&iter, "{&s(&sxu)}", &n, &id, &s, &f))
        if (!g_str_equal (n, name))
          g_variant_builder_add (&b, "{s(sxu)}", n, id, s, f);
    }
  if (!remove)
    g_variant_builder_add (&b, "{s(sxu)}", name, asset_id, size, flags);
  return g_variant_ref_sink (g_variant_builder_end (&b));
}

static GVariant *
m_put_asset (LumaSyncLocal *local, GVariant *params, GUnixFDList *fds, GError **error)
{
  const char *zone, *record, *name, *base;
  gint32 handle;
  g_autoptr(GVariant) options = NULL;
  gboolean on_demand = FALSE;
  g_autofree char *asset_id = new_id ();
  g_autofree char *dir = NULL, *dest = NULL;
  g_autoptr(GPtrArray) versions = NULL, after = NULL;
  g_autoptr(GVariant) assets = NULL;
  g_autoptr(GVariant) existing = NULL;
  g_autoptr(GBytes) value = NULL;
  GVariant *top;
  gint64 size = 0;
  int fd;

  g_variant_get (params, "(&s&s&sh&s@a{sv})", &zone, &record, &name, &handle, &base, &options);
  g_variant_lookup (options, "on_demand", "b", &on_demand);
  if (!check_label (zone, error) || !check_name (record, error) || !check_name (name, error) || !check_base (base, error)
      || !ensure_zone (local, zone, error))
    return NULL;
  fd = fds ? g_unix_fd_list_get (fds, handle, error) : -1;
  if (fd < 0)
    {
      g_clear_error (error);
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_BAD_DESCRIPTOR, "No asset descriptor");
      return NULL;
    }
  dir = zone_dir (local, zone, "assets");
  dest = g_build_filename (dir, asset_id, NULL);
  if (!copy_fd (fd, dest, on_demand ? MAX_ON_DEMAND : MAX_INLINE, &size, error))
    {
      close (fd);
      return NULL;
    }
  close (fd);
  versions = load_versions (local, zone, record, NULL);
  top = current (versions);
  if (g_strcmp0 (top ? v_id (top) : "", base) != 0)
    {
      g_unlink (dest);
      return g_variant_new ("(@a{sv})", result_out (local, zone, record, "conflict", versions));
    }
  existing = top ? g_variant_lookup_value (top, "a", G_VARIANT_TYPE ("a{s(sxu)}")) : NULL;
  if (existing && g_variant_n_children (existing) >= MAX_ASSETS && !g_variant_lookup (existing, name, "(&sxu)", NULL, NULL, NULL))
    {
      g_unlink (dest);
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_TOO_LARGE, "A record has at most 32 assets");
      return NULL;
    }
  assets = assets_with (top, name, asset_id, size, on_demand ? A_ON_DEMAND : 0, FALSE);
  if (top)
    {
      g_autoptr(GVariant) v = g_variant_lookup_value (top, "v", G_VARIANT_TYPE_BYTESTRING);
      value = g_variant_get_data_as_bytes (v);
    }
  else
    value = g_bytes_new (NULL, 0);
  decide_put (local, versions, base, value, g_variant_ref (assets), TRUE, &after);
  if (after == NULL || !store_versions (local, zone, record, after, error))
    {
      g_unlink (dest);
      return after == NULL ? g_variant_new ("(@a{sv})", result_out (local, zone, record, "conflict", versions)) : NULL;
    }
  return g_variant_new ("(@a{sv})", result_out (local, zone, record, "local", after));
}

static GVariant *
m_remove_asset (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone, *record, *name, *base;
  g_autoptr(GPtrArray) versions = NULL, after = NULL;
  g_autoptr(GVariant) existing = NULL, assets = NULL, v = NULL;
  g_autoptr(GBytes) value = NULL;
  GVariant *top;

  g_variant_get (params, "(&s&s&s&s)", &zone, &record, &name, &base);
  if (!check_label (zone, error) || !check_name (record, error) || !check_name (name, error) || !check_base (base, error))
    return NULL;
  versions = load_versions (local, zone, record, NULL);
  top = current (versions);
  if (top == NULL || g_strcmp0 (v_id (top), base) != 0)
    return g_variant_new ("(@a{sv})", result_out (local, zone, record, "conflict", versions));
  existing = g_variant_lookup_value (top, "a", G_VARIANT_TYPE ("a{s(sxu)}"));
  if (!existing || !g_variant_lookup (existing, name, "(&sxu)", NULL, NULL, NULL))
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_NOT_FOUND, "The record has no asset of that name");
      return NULL;
    }
  assets = assets_with (top, name, "", 0, 0, TRUE);
  v = g_variant_lookup_value (top, "v", G_VARIANT_TYPE_BYTESTRING);
  value = g_variant_get_data_as_bytes (v);
  decide_put (local, versions, base, value, g_variant_ref (assets), TRUE, &after);
  if (after == NULL || !store_versions (local, zone, record, after, error))
    return after == NULL ? g_variant_new ("(@a{sv})", result_out (local, zone, record, "conflict", versions)) : NULL;
  return g_variant_new ("(@a{sv})", result_out (local, zone, record, "local", after));
}

static GVariant *
m_open_asset (LumaSyncLocal *local, GVariant *params, GUnixFDList **out_fds, GError **error)
{
  const char *zone, *record, *name, *version;
  g_autoptr(GPtrArray) versions = NULL;
  g_autoptr(GVariant) list = NULL;
  g_auto(GVariantBuilder) info = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
  GVariant *v;
  const char *asset_id;
  gint64 size;
  guint32 flags;
  g_autofree char *dir = NULL, *path = NULL;
  int fd;

  g_variant_get (params, "(&s&s&s&s)", &zone, &record, &name, &version);
  if (!check_label (zone, error) || !check_name (record, error) || !check_name (name, error) || !check_base (version, error))
    return NULL;
  versions = load_versions (local, zone, record, NULL);
  v = *version ? find_version (versions, version) : current (versions);
  list = v ? g_variant_lookup_value (v, "a", G_VARIANT_TYPE ("a{s(sxu)}")) : NULL;
  if (list == NULL || !g_variant_lookup (list, name, "(&sxu)", &asset_id, &size, &flags))
    return g_variant_new ("(s@a{sv})", "gone", g_variant_new ("a{sv}", NULL));
  dir = zone_dir (local, zone, "assets");
  path = g_build_filename (dir, asset_id, NULL);
  fd = private_copy (path);
  g_variant_builder_add (&info, "{sv}", "version", g_variant_new_string (v_id (v)));
  g_variant_builder_add (&info, "{sv}", "size", g_variant_new_int64 (size));
  g_variant_builder_add (&info, "{sv}", "flags", g_variant_new_uint32 ((flags & A_ON_DEMAND) | A_HERE | A_PINNED));
  if (fd < 0)
    return g_variant_new ("(s@a{sv})", "gone", g_variant_builder_end (&info));
  *out_fds = g_unix_fd_list_new ();
  g_variant_builder_add (&info, "{sv}", "fd", g_variant_new_handle (g_unix_fd_list_append (*out_fds, fd, NULL)));
  close (fd);
  return g_variant_new ("(s@a{sv})", "here", g_variant_builder_end (&info));
}

static GVariant *
m_asset_state (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone, *record, *name;
  g_autoptr(GPtrArray) versions = NULL;
  g_autoptr(GVariant) list = NULL;
  GVariant *v;

  g_variant_get_child (params, 0, "&s", &zone);
  g_variant_get_child (params, 1, "&s", &record);
  g_variant_get_child (params, 2, "&s", &name);
  if (!check_label (zone, error) || !check_name (record, error) || !check_name (name, error))
    return NULL;
  versions = load_versions (local, zone, record, NULL);
  v = current (versions);
  list = v ? g_variant_lookup_value (v, "a", G_VARIANT_TYPE ("a{s(sxu)}")) : NULL;
  return g_variant_new ("(s@a{sv})", (list && g_variant_lookup (list, name, "(&sxu)", NULL, NULL, NULL)) ? "here" : "gone",
                        g_variant_new ("a{sv}", NULL));
}

static GVariant *
lease_out (const char *record, gint64 until)
{
  g_auto(GVariantBuilder) b = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);
  gboolean active = until > g_get_real_time () / 1000;

  g_variant_builder_add (&b, "{sv}", "record", g_variant_new_string (record));
  g_variant_builder_add (&b, "{sv}", "until_ms", g_variant_new_int64 (active ? until : 0));
  g_variant_builder_add (&b, "{sv}", "mine", g_variant_new_boolean (active));
  g_variant_builder_add (&b, "{sv}", "active", g_variant_new_boolean (active));
  if (active)
    g_variant_builder_add (&b, "{sv}", "holder", device_local ());
  return g_variant_builder_end (&b);
}

static GVariant *
m_lease (LumaSyncLocal *local, const char *method, GVariant *params, GError **error)
{
  const char *zone, *record;
  g_autofree char *key = NULL;
  gint64 *until;
  gint64 now = g_get_real_time () / 1000;

  g_variant_get_child (params, 0, "&s", &zone);
  g_variant_get_child (params, 1, "&s", &record);
  if (!check_label (zone, error) || !check_name (record, error))
    return NULL;
  key = g_strdup_printf ("%s\n%s", zone, record);
  until = g_hash_table_lookup (local->leases, key);
  if (g_str_equal (method, "Lease"))
    {
      guint32 seconds;
      g_variant_get_child (params, 2, "u", &seconds);
      if (seconds < 1 || seconds > LUMA_SYNC_MAX_LEASE_SECONDS)
        {
          g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_INVALID, "A lease lasts 1 to 3600 seconds");
          return NULL;
        }
      until = g_new (gint64, 1);
      *until = now + (gint64) seconds * 1000;
      g_hash_table_replace (local->leases, g_strdup (key), until);
    }
  else if (g_str_equal (method, "Release") && until)
    *until = now;
  return g_variant_new ("(@a{sv})", lease_out (record, until ? *until : 0));
}

static GVariant *
m_resolve (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone, *record, *keep;
  g_autoptr(GPtrArray) versions = NULL;
  g_autoptr(GPtrArray) after = g_ptr_array_new_with_free_func ((GDestroyNotify) g_variant_unref);
  g_autoptr(GVariant) value = NULL, assets = NULL;
  g_autoptr(GBytes) bytes = NULL;
  GVariant *chosen;

  g_variant_get (params, "(&s&s&s)", &zone, &record, &keep);
  if (!check_label (zone, error) || !check_name (record, error) || !check_base (keep, error))
    return NULL;
  versions = load_versions (local, zone, record, NULL);
  chosen = find_version (versions, keep);
  if (chosen == NULL)
    return g_variant_new ("(@a{sv})", result_out (local, zone, record, "conflict", versions));
  value = g_variant_lookup_value (chosen, "v", G_VARIANT_TYPE_BYTESTRING);
  assets = g_variant_lookup_value (chosen, "a", G_VARIANT_TYPE ("a{s(sxu)}"));
  bytes = g_variant_get_data_as_bytes (value);
  g_ptr_array_add (after, make_version (local, bytes, g_variant_ref (assets), NULL, v_time (chosen), TRUE, NULL));
  if (!store_versions (local, zone, record, after, error))
    return NULL;
  return g_variant_new ("(@a{sv})", result_out (local, zone, record, "local", after));
}

static void
remove_tree (const char *path)
{
  g_autoptr(GDir) d = g_dir_open (path, 0, NULL);
  const char *entry;

  while (d && (entry = g_dir_read_name (d)) != NULL)
    {
      g_autofree char *child = g_build_filename (path, entry, NULL);
      if (g_file_test (child, G_FILE_TEST_IS_DIR) && !g_file_test (child, G_FILE_TEST_IS_SYMLINK))
        remove_tree (child);
      else
        g_unlink (child);
    }
  g_rmdir (path);
}

static GVariant *
m_delete_zone (LumaSyncLocal *local, GVariant *params, GError **error)
{
  const char *zone;
  g_autofree char *dir = NULL;
  g_autofree char *gone = NULL;

  g_variant_get (params, "(&s)", &zone);
  if (!check_label (zone, error))
    return NULL;
  dir = g_build_filename (local->folder, zone, NULL);
  if (!g_file_test (dir, G_FILE_TEST_IS_DIR))
    return g_variant_new ("()");
  /* Moved aside first, so the zone is gone at once; a fresh one (new epoch, new tokens) starts on the next write. */
  gone = g_strdup_printf ("%s.deleted-%" G_GINT64_FORMAT, dir, g_get_real_time ());
  if (g_rename (dir, gone) != 0)
    {
      g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_FAILED, "The zone couldn't be deleted");
      return NULL;
    }
  remove_tree (gone);
  return g_variant_new ("()");
}

static GVariant *
m_get_status (void)
{
  g_auto(GVariantBuilder) b = G_VARIANT_BUILDER_INIT (G_VARIANT_TYPE_VARDICT);

  g_variant_builder_add (&b, "{sv}", "status", g_variant_new_string ("unavailable"));
  g_variant_builder_add (&b, "{sv}", "device", device_local ());
  return g_variant_new ("(@a{sv})", g_variant_builder_end (&b));
}

GVariant *
luma_sync_local_call (LumaSyncLocal *local, const char *method, GVariant *parameters, GUnixFDList *fds,
                      GUnixFDList **out_fds, GError **error)
{
  g_autoptr(GVariant) params = g_variant_ref_sink (parameters);
  g_autoptr(GMutexLocker) locker = g_mutex_locker_new (&local->lock);

  if (g_str_equal (method, "GetStatus"))
    return m_get_status ();
  if (g_str_equal (method, "Subscribe"))
    return g_variant_new ("()");
  if (g_str_equal (method, "Save"))
    return m_save (local, params, error);
  if (g_str_equal (method, "Delete"))
    return m_delete (local, params, error);
  if (g_str_equal (method, "FetchChanges"))
    return m_fetch_changes (local, params, error);
  if (g_str_equal (method, "Get"))
    return m_get (local, params, error);
  if (g_str_equal (method, "List"))
    return m_list (local, params, error);
  if (g_str_equal (method, "PutAsset"))
    return m_put_asset (local, params, fds, error);
  if (g_str_equal (method, "RemoveAsset"))
    return m_remove_asset (local, params, error);
  if (g_str_equal (method, "OpenAsset"))
    return m_open_asset (local, params, out_fds, error);
  if (g_str_equal (method, "RequestAsset") || g_str_equal (method, "PinAsset") || g_str_equal (method, "EvictAsset"))
    return m_asset_state (local, params, error);
  if (g_str_equal (method, "Lease") || g_str_equal (method, "Release") || g_str_equal (method, "GetLease"))
    return m_lease (local, method, params, error);
  if (g_str_equal (method, "ResolveSiblings"))
    return m_resolve (local, params, error);
  if (g_str_equal (method, "DeleteZone"))
    return m_delete_zone (local, params, error);
  g_set_error (error, LUMA_SYNC_ERROR, LUMA_SYNC_ERROR_NOT_SUPPORTED, "No such call: %s", method);
  return NULL;
}
