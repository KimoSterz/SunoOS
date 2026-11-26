/* SPDX-License-Identifier: Apache-2.0 */
/* The save changes sheet: the one way every Luma application asks before it
 * closes or quits with unsaved work, in C and, through GObject introspection,
 * in Python.
 *
 * The application gives facts (the document, whether it was ever saved, when
 * its first unsaved edit happened, where its files usually go) and the sheet
 * supplies every word, the layout and the keys, so the question reads the same
 * in every application and never states anything the application did not
 * record.
 *
 * The sheet belongs to the window that asked. On a desktop it hangs from the
 * bottom of that window's title bar and dims only that window's content; other
 * windows and the desktop keep working. On a phone, a tablet or the Fold it
 * rises from the bar's place instead (the frame, below), its buttons laid out
 * from their roles. Save (or Review changes… for several documents) is
 * the one full-width primary, Cancel sits under it, and the destructive choice
 * is set apart below as a small red text button. Enter takes the primary unless
 * focus is on another control, Escape cancels, and Ctrl+D is the one key that
 * discards. Nothing destructive is ever the default. */

#include "luma-save-sheet.h"
#include "luma-sheet-private.h"
#include "luma-ui.h"
#include "luma-ui-private.h"
#include "luma-tv-frame-private.h"

#include <errno.h>
#include <math.h>
#include <string.h>

#define LUMA_SAVE_DOMAIN "luma-appkit"
#define S_(text) g_dgettext (LUMA_SAVE_DOMAIN, text)
#define NS_(one, many, n) g_dngettext (LUMA_SAVE_DOMAIN, one, many, n)

#define OPEN_MS 240
#define NAME_LIMIT 36
#define SHEET_WIDTH 360
#define LIST_VISIBLE_ROWS 5
#define LIST_ROW_HEIGHT 32

G_DEFINE_ENUM_TYPE (LumaSaveChoice, luma_save_choice,
  G_DEFINE_ENUM_VALUE (LUMA_SAVE_CHOICE_SAVE, "save"),
  G_DEFINE_ENUM_VALUE (LUMA_SAVE_CHOICE_DISCARD, "discard"),
  G_DEFINE_ENUM_VALUE (LUMA_SAVE_CHOICE_CANCEL, "cancel"),
  G_DEFINE_ENUM_VALUE (LUMA_SAVE_CHOICE_QUIT, "quit"),
  G_DEFINE_ENUM_VALUE (LUMA_SAVE_CHOICE_OTHER, "other"))

G_DEFINE_ENUM_TYPE (LumaSheetRole, luma_sheet_role,
  G_DEFINE_ENUM_VALUE (LUMA_SHEET_ROLE_NONE, "none"),
  G_DEFINE_ENUM_VALUE (LUMA_SHEET_ROLE_PRIMARY, "primary"),
  G_DEFINE_ENUM_VALUE (LUMA_SHEET_ROLE_SECONDARY, "secondary"),
  G_DEFINE_ENUM_VALUE (LUMA_SHEET_ROLE_CANCEL, "cancel"),
  G_DEFINE_ENUM_VALUE (LUMA_SHEET_ROLE_DESTRUCTIVE, "destructive"),
  G_DEFINE_ENUM_VALUE (LUMA_SHEET_ROLE_DESTRUCTIVE_ACTION, "destructive-action"))

/* ── Vitals ───────────────────────────────────────────────────────────── */

static void
vitals (GtkWindow *window, const char *kind, const char *save_case)
{
  GtkApplication *application = window ? gtk_window_get_application (window) : NULL;
  const char *unit = application ? g_application_get_application_id (G_APPLICATION (application)) : NULL;
  g_autofree char *message = NULL;

  if (unit == NULL)
    unit = "unknown";
  message = g_strdup_printf ("%s: %s (%s)", unit, kind, save_case);
  g_log_structured ("luma-appkit", G_LOG_LEVEL_INFO,
                    "MESSAGE", "%s", message,
                    "SYSLOG_IDENTIFIER", "luma-appkit",
                    "LUMA_VITALS_KIND", kind,
                    "LUMA_VITALS_UNIT", unit,
                    "LUMA_APPKIT_SAVE_CASE", save_case);
}

/* ── LumaSaveDocument ─────────────────────────────────────────────────── */

typedef struct {
  char *label;
  char *path;
} Place;

static void
place_free (gpointer data)
{
  Place *place = data;
  g_free (place->label);
  g_free (place->path);
  g_free (place);
}

struct _LumaSaveDocument {
  GObject parent_instance;
  char *name;
  gboolean never_saved;
  double unsaved_seconds;
  GWeakRef window;
  char *extension;
  GPtrArray *places;
  gboolean recovery_copy;
  char *kind;
};

G_DEFINE_FINAL_TYPE (LumaSaveDocument, luma_save_document, G_TYPE_OBJECT)

static void
luma_save_document_finalize (GObject *object)
{
  LumaSaveDocument *self = LUMA_SAVE_DOCUMENT (object);
  g_free (self->name);
  g_free (self->extension);
  g_free (self->kind);
  g_ptr_array_unref (self->places);
  g_weak_ref_clear (&self->window);
  G_OBJECT_CLASS (luma_save_document_parent_class)->finalize (object);
}

static void
luma_save_document_class_init (LumaSaveDocumentClass *klass)
{
  G_OBJECT_CLASS (klass)->finalize = luma_save_document_finalize;
}

static void
luma_save_document_init (LumaSaveDocument *self)
{
  self->unsaved_seconds = -1;
  self->places = g_ptr_array_new_with_free_func (place_free);
  self->kind = g_strdup ("document");
  self->extension = g_strdup ("");
  g_weak_ref_init (&self->window, NULL);
}

/**
 * luma_save_document_new:
 * @name: the document's name as the person knows it
 *
 * Returns: (transfer full): the facts about one unsaved document
 */
LumaSaveDocument *
luma_save_document_new (const char *name)
{
  LumaSaveDocument *self = g_object_new (LUMA_TYPE_SAVE_DOCUMENT, NULL);
  self->name = g_strdup (name ? name : "");
  return self;
}

const char *
luma_save_document_get_name (LumaSaveDocument *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_DOCUMENT (self), NULL);
  return self->name;
}

/**
 * luma_save_document_set_never_saved:
 * @self: a document
 * @never_saved: the document has never been written anywhere
 *
 * An untitled document is named and placed on the sheet itself.
 */
void
luma_save_document_set_never_saved (LumaSaveDocument *self, gboolean never_saved)
{
  g_return_if_fail (LUMA_IS_SAVE_DOCUMENT (self));
  self->never_saved = never_saved;
}

gboolean
luma_save_document_get_never_saved (LumaSaveDocument *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_DOCUMENT (self), FALSE);
  return self->never_saved;
}

/**
 * luma_save_document_set_unsaved_seconds:
 * @self: a document
 * @seconds: seconds since the first edit that is not saved yet, measured by
 *   the application; negative when the application does not record it
 *
 * The sheet states an edit age only when it is given one. It never estimates.
 */
void
luma_save_document_set_unsaved_seconds (LumaSaveDocument *self, double seconds)
{
  g_return_if_fail (LUMA_IS_SAVE_DOCUMENT (self));
  self->unsaved_seconds = seconds;
}

double
luma_save_document_get_unsaved_seconds (LumaSaveDocument *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_DOCUMENT (self), -1);
  return self->unsaved_seconds;
}

/**
 * luma_save_document_set_window:
 * @self: a document
 * @window: (nullable): the window that shows this document
 *
 * When quitting with several documents, each is reviewed in its own window.
 */
void
luma_save_document_set_window (LumaSaveDocument *self, GtkWindow *window)
{
  g_return_if_fail (LUMA_IS_SAVE_DOCUMENT (self));
  g_weak_ref_set (&self->window, window);
}

/**
 * luma_save_document_get_window:
 * @self: a document
 *
 * Returns: (transfer none) (nullable): the window, while it exists
 */
GtkWindow *
luma_save_document_get_window (LumaSaveDocument *self)
{
  GtkWindow *window;
  g_return_val_if_fail (LUMA_IS_SAVE_DOCUMENT (self), NULL);
  window = g_weak_ref_get (&self->window);
  if (window != NULL)
    g_object_unref (window);
  return window;
}

/**
 * luma_save_document_set_extension:
 * @self: a document
 * @extension: (nullable): the extension a new file gets, such as ".layouts"
 */
void
luma_save_document_set_extension (LumaSaveDocument *self, const char *extension)
{
  g_return_if_fail (LUMA_IS_SAVE_DOCUMENT (self));
  g_free (self->extension);
  self->extension = g_strdup (extension ? extension : "");
}

/**
 * luma_save_document_add_place:
 * @self: a document
 * @label: what the person calls the folder, such as "Projects"
 * @path: the folder
 *
 * The application's own folders come first in Where, then Documents and
 * Desktop, then Other location….
 */
void
luma_save_document_add_place (LumaSaveDocument *self, const char *label, const char *path)
{
  Place *place;
  g_return_if_fail (LUMA_IS_SAVE_DOCUMENT (self));
  g_return_if_fail (label != NULL && path != NULL);
  place = g_new0 (Place, 1);
  place->label = g_strdup (label);
  place->path = g_strdup (path);
  g_ptr_array_add (self->places, place);
}

/**
 * luma_save_document_set_recovery_copy:
 * @self: a document
 * @recovery_copy: the application keeps a recovery copy until the person
 *   saves or discards
 */
void
luma_save_document_set_recovery_copy (LumaSaveDocument *self, gboolean recovery_copy)
{
  g_return_if_fail (LUMA_IS_SAVE_DOCUMENT (self));
  self->recovery_copy = recovery_copy;
}

/**
 * luma_save_document_set_kind:
 * @self: a document
 * @kind: "document", "project" or "note"
 */
void
luma_save_document_set_kind (LumaSaveDocument *self, const char *kind)
{
  g_return_if_fail (LUMA_IS_SAVE_DOCUMENT (self));
  g_free (self->kind);
  self->kind = g_strdup (kind && *kind ? kind : "document");
}

/* ── Words ────────────────────────────────────────────────────────────── */

static char *
display_name (const char *name)
{
  g_auto (GStrv) words = g_strsplit_set (name ? name : "", " \t\n\r", -1);
  GString *joined = g_string_new (NULL);
  for (guint i = 0; words[i] != NULL; i++) {
    if (!*words[i])
      continue;
    if (joined->len)
      g_string_append_c (joined, ' ');
    g_string_append (joined, words[i]);
  }
  if (joined->len == 0)
    g_string_append (joined, S_("Untitled"));
  return g_string_free (joined, FALSE);
}

/* A document name in curly quotes, shortened in the middle when long. */
static char *
quoted (const char *name)
{
  g_autofree char *clean = display_name (name);
  glong length = g_utf8_strlen (clean, -1);

  if (length > NAME_LIMIT) {
    glong keep = (NAME_LIMIT - 1) / 2;
    g_autofree char *head = g_utf8_substring (clean, 0, keep);
    g_autofree char *tail = g_utf8_substring (clean, length - keep, length);
    return g_strdup_printf ("“%s…%s”", g_strchomp (head), g_strchug (tail));
  }
  return g_strdup_printf ("“%s”", clean);
}

static const char *
several_kind (LumaSaveDocument * const *documents, guint n)
{
  for (guint i = 1; i < n; i++)
    if (g_strcmp0 (documents[i]->kind, documents[0]->kind) != 0)
      return "document";
  return documents[0]->kind;
}

static char *
at_stake (LumaSaveDocument *document)
{
  double seconds = document->unsaved_seconds;
  long minutes, hours, days;

  if (seconds < 0)
    return g_strdup (S_("Your changes haven’t been saved."));
  if (seconds < 60)
    return g_strdup (S_("You have less than a minute of edits that are not saved yet."));
  minutes = lround (seconds / 60);
  if (minutes < 60)
    return g_strdup_printf (NS_("You have %ld minute of edits that are not saved yet.",
                                "You have %ld minutes of edits that are not saved yet.", minutes), minutes);
  hours = lround (minutes / 60.0);
  if (hours < 48)
    return g_strdup_printf (NS_("You have %ld hour of edits that are not saved yet.",
                                "You have %ld hours of edits that are not saved yet.", hours), hours);
  days = lround (hours / 24.0);
  return g_strdup_printf (NS_("You have %ld day of edits that are not saved yet.",
                              "You have %ld days of edits that are not saved yet.", days), days);
}

static char *
at_stake_short (LumaSaveDocument *document)
{
  double seconds = document->unsaved_seconds;
  long minutes, hours, days;

  if (document->never_saved)
    return g_strdup (S_("Never saved"));
  if (seconds < 0)
    return g_strdup (S_("Not saved"));
  if (seconds < 60)
    return g_strdup (S_("Under 1 min of edits"));
  minutes = lround (seconds / 60);
  if (minutes < 60)
    return g_strdup_printf (NS_("%ld min of edits", "%ld min of edits", minutes), minutes);
  hours = lround (minutes / 60.0);
  if (hours < 48)
    return g_strdup_printf (NS_("%ld hr of edits", "%ld hr of edits", hours), hours);
  days = lround (hours / 24.0);
  return g_strdup_printf (NS_("%ld day of edits", "%ld days of edits", days), days);
}

static char *
several_title (LumaSaveDocument * const *documents, guint n)
{
  const char *kind = several_kind (documents, n);
  if (g_str_equal (kind, "project"))
    return g_strdup_printf (NS_("Save changes to %u project before quitting?",
                                "Save changes to %u projects before quitting?", n), n);
  if (g_str_equal (kind, "note"))
    return g_strdup_printf (NS_("Save changes to %u note before quitting?",
                                "Save changes to %u notes before quitting?", n), n);
  return g_strdup_printf (NS_("Save changes to %u document before quitting?",
                              "Save changes to %u documents before quitting?", n), n);
}

static char *
several_discard_name (LumaSaveDocument * const *documents, guint n)
{
  const char *kind = several_kind (documents, n);
  if (g_str_equal (kind, "project"))
    return g_strdup_printf (NS_("Discard all %u project", "Discard all %u projects", n), n);
  if (g_str_equal (kind, "note"))
    return g_strdup_printf (NS_("Discard all %u note", "Discard all %u notes", n), n);
  return g_strdup_printf (NS_("Discard all %u document", "Discard all %u documents", n), n);
}

/* The file a name makes in a folder, or why it cannot be used. Never
 * overwrites: an existing file, or a link, is an error to show. */
static GFile *
check_name (const char *raw, const char *folder, const char *place,
            const char *extension, char **problem)
{
  g_autofree char *name = g_strstrip (g_strdup (raw ? raw : ""));
  g_autofree char *filename = NULL;
  g_autofree char *path = NULL;
  g_autofree char *shown = NULL;

  if (!*name) {
    *problem = g_strdup (S_("Give it a name."));
    return NULL;
  }
  if (strchr (name, '/') != NULL) {
    *problem = g_strdup (S_("A name can’t contain “/”."));
    return NULL;
  }
  if (name[0] == '.') {
    *problem = g_strdup (S_("A name can’t start with a dot."));
    return NULL;
  }
  {
    g_autofree char *folded_name = g_utf8_casefold (name, -1);
    g_autofree char *folded_ext = g_utf8_casefold (extension ? extension : "", -1);
    if (extension && *extension && !g_str_has_suffix (folded_name, folded_ext))
      filename = g_strconcat (name, extension, NULL);
    else
      filename = g_strdup (name);
  }
  if (strlen (filename) > 255) {
    *problem = g_strdup (S_("That name is too long."));
    return NULL;
  }
  path = g_build_filename (folder, filename, NULL);
  {
    g_autoptr (GFile) existing = g_file_new_for_path (path);
    /* A dangling link counts too: nothing is ever written over. */
    if (g_file_query_file_type (existing, G_FILE_QUERY_INFO_NOFOLLOW_SYMLINKS, NULL) == G_FILE_TYPE_UNKNOWN)
      return g_file_new_for_path (path);
  }
  {
    shown = quoted (filename);
    *problem = g_strdup_printf (S_("There is already a %s in %s."), shown, place);
    return NULL;
  }
}

/* ── Roles ────────────────────────────────────────────────────────────── */

static const char role_key[] = "luma-sheet-role";

/**
 * luma_sheet_button_set_role:
 * @button: a button on a sheet
 * @role: what it answers
 *
 * Name what a button means; the kit lays the sheet out from it.
 */
void
luma_sheet_button_set_role (GtkWidget *button, LumaSheetRole role)
{
  g_return_if_fail (GTK_IS_WIDGET (button));
  g_object_set_data (G_OBJECT (button), role_key, GINT_TO_POINTER (role + 1));
}

/**
 * luma_sheet_button_get_role:
 * @button: a button
 *
 * Returns: the role given with luma_sheet_button_set_role(), or the one its
 *   sheet class names
 */
LumaSheetRole
luma_sheet_button_get_role (GtkWidget *button)
{
  gpointer set;
  g_return_val_if_fail (GTK_IS_WIDGET (button), LUMA_SHEET_ROLE_NONE);
  set = g_object_get_data (G_OBJECT (button), role_key);
  if (set != NULL)
    return (LumaSheetRole) (GPOINTER_TO_INT (set) - 1);
  if (!GTK_IS_BUTTON (button))
    return LUMA_SHEET_ROLE_NONE;
  if (gtk_widget_has_css_class (button, "luma-save-primary"))
    return LUMA_SHEET_ROLE_PRIMARY;
  if (gtk_widget_has_css_class (button, "luma-save-secondary") || gtk_widget_has_css_class (button, "lumaui-dialog-cancel"))
    return LUMA_SHEET_ROLE_CANCEL;
  if (gtk_widget_has_css_class (button, "luma-save-discard"))
    return LUMA_SHEET_ROLE_DESTRUCTIVE;
  if (gtk_widget_has_css_class (button, "lumaui-dialog-action"))
    return LUMA_SHEET_ROLE_DESTRUCTIVE_ACTION;
  return LUMA_SHEET_ROLE_NONE;
}

/* ── Posture ──────────────────────────────────────────────────────────── */

/* The same device precedence as luma_ui_mobile_form_factor(), for the one
 * class it leaves out: a tablet asks in the floating sheet, not the desktop's. */
static gboolean
tablet_device (void)
{
  const char *names[] = { g_getenv ("LUMA_FORM_FACTOR"), g_getenv ("LUMA_DEVICE_CLASS") };
  g_autofree char *marker = NULL;
  for (guint i = 0; i < G_N_ELEMENTS (names); i++)
    if (names[i] != NULL && *names[i] != '\0') {
      g_autofree char *value = g_strstrip (g_ascii_strdown (names[i], -1));
      if (*value != '\0')
        return g_str_equal (value, "tablet");
    }
  if (g_file_get_contents ("/etc/luma-device-class", &marker, NULL, NULL))
    return g_ascii_strcasecmp (g_strstrip (marker), "tablet") == 0;
  return FALSE;
}

LumaSheetPosture
luma_sheet_posture_for_width (int width)
{
  gboolean phone_device;
  if (luma_ui_tv_posture ())
    return LUMA_SHEET_POSTURE_TV;
  phone_device = luma_ui_mobile_form_factor ();
  if (width > 0 && width < LUMA_TIER_PHONE_BELOW)
    return LUMA_SHEET_POSTURE_PHONE;
  if (width <= 0 && phone_device)
    return LUMA_SHEET_POSTURE_PHONE;
  if (phone_device || tablet_device ())
    return LUMA_SHEET_POSTURE_FLOATING;
  return LUMA_SHEET_POSTURE_DESKTOP;
}

LumaSheetPosture
luma_sheet_posture (GtkWidget *widget)
{
  g_return_val_if_fail (GTK_IS_WIDGET (widget), LUMA_SHEET_POSTURE_DESKTOP);
  return luma_sheet_posture_for_width (luma_ui_window_width (widget));
}

static const char question_key[] = "luma-sheet-question";

void
luma_sheet_mark_question (GtkWidget *card)
{
  g_object_set_data (G_OBJECT (card), question_key, GINT_TO_POINTER (1));
}

gboolean
luma_sheet_is_question (GtkWidget *card)
{
  return card != NULL && g_object_get_data (G_OBJECT (card), question_key) != NULL;
}

/* ── The frame: a sheet in the bar's place ────────────────────────────── */

/* The bar's frame (v71, kept in v73): 16 a side, 34 up, at most the window
 * less 120; the floating sheet is no wider than the phone tier. */
#define FRAME_SIDE LUMA_UI_ACTION_CENTER_FRAME_SIDE
#define FRAME_BOTTOM LUMA_UI_ACTION_CENTER_FRAME_BOTTOM
#define FRAME_ROOM LUMA_UI_ACTION_CENTER_FRAME_SHEET_ROOM
#define FRAME_FLOATING_WIDTH LUMA_TIER_PHONE_BELOW
/* A modal question travels the whole way: in over 420 ms, out over 260,
 * the scrim over 180; a sheet let go short of dismissing springs back over
 * 300 on the in curve. Reduced motion cross-fades over 150. */
#define FRAME_IN_MS 420
#define FRAME_OUT_MS 260
#define FRAME_DIM_MS 180
#define FRAME_SPRING_MS 300
#define FRAME_FADE_MS LUMA_UI_MOTION_REDUCED_FADE_MS
#define FRAME_RUBBER_BAND 12.0
#define SWIPE_SHARE 0.3
#define SWIPE_SPEED 0.5 /* px/ms */

static const double curve_in[4] = { 0.2, 0.9, 0.25, 1.0 };
static const double curve_out[4] = { 0.42, 0.0, 1.0, 1.0 };
static const double curve_ease[4] = { 0.25, 0.1, 0.25, 1.0 };

static double
bezier_axis (double a, double b, double t)
{
  /* One coordinate of a cubic Bézier from (0,0) to (1,1) with control points a and b. */
  double u = 1.0 - t;
  return 3.0 * u * u * t * a + 3.0 * u * t * t * b + t * t * t;
}

/* A CSS cubic-bezier() at progress @x. */
static double
bezier (const double curve[4], double x)
{
  double lo = 0.0, hi = 1.0, t = x;
  if (x <= 0.0)
    return 0.0;
  if (x >= 1.0)
    return 1.0;
  for (int i = 0; i < 40; i++) {
    double at = bezier_axis (curve[0], curve[2], t);
    if (fabs (at - x) < 1e-6)
      break;
    if (at < x)
      lo = t;
    else
      hi = t;
    t = (lo + hi) / 2.0;
  }
  return bezier_axis (curve[1], curve[3], t);
}

gboolean
luma_sheet_swipe_dismisses (double dy, double height, double velocity)
{
  return dy > 0 && ((height > 0 && dy > SWIPE_SHARE * height) || velocity > SWIPE_SPEED);
}

typedef struct {
  GtkWidget *widget;
  GtkWidget *parent;
  GtkWidget *prev;
  GtkAlign halign;
  gboolean hexpand;
} Moved;

typedef struct {
  GtkWidget *label;
  float xalign;
  GtkJustification justify;
  int max_chars;
  int width_request;
} LabelState;

typedef struct {
  GtkWidget *clamp;
  int maximum;
  int threshold;
} ClampState;

typedef struct {
  GtkWidget *widget;
  char *css;
} AddedClass;

typedef enum {
  MOTION_NONE,
  MOTION_ENTER,
  MOTION_SPRING,
  MOTION_LEAVE,
} Motion;

struct _LumaSheetFrame {
  GtkOverlay *overlay;   /* weak */
  GtkWidget *mover;      /* weak */
  GtkWidget *card;       /* weak */
  GtkWidget *dim;        /* weak */
  GtkWidget *clamp;      /* weak: the clamp between the mover and the card */
  LumaSheetPosture posture;
  gboolean framed;
  gboolean dim_when_framed; /* the dim is only the frame's (a window sheet dims itself on a desktop) */

  /* What the frame changed, to give back. */
  GPtrArray *moved;      /* Moved, the role buttons in document order */
  GPtrArray *card_children;
  GPtrArray *hidden;
  GArray *labels;
  GArray *clamps;
  GArray *classes;
  gboolean clamp_saved;
  int clamp_maximum, clamp_threshold, clamp_margin_start, clamp_margin_end;
  GtkAlign clamp_valign;
  GtkWidget *scroller, *content, *foot, *row;

  /* Motion. */
  double offset;          /* px below its place */
  double opacity;         /* the sheet's own, for the reduced-motion fade */
  double dim_opacity;
  Motion motion;
  gboolean waiting;       /* the rise waits for the first layout */
  gint64 start;
  double from, to, fade_from, fade_to, dim_from, dim_to;
  guint duration, dim_duration;
  const double *curve;
  gboolean fade;
  guint tick;
  GSourceFunc done;
  gpointer done_data;
  gulong unmap_handler;

  /* The swipe. */
  /* The on-screen keyboard: the gap under the sheet (34, or 12 above the keys plus what they
   * cover of the window) eases to its new value as the keyboard rises and falls. */
  double gap, gap_from, gap_to;
  gint64 gap_start;
  guint gap_tick;
  int keyboard_cover;     /* px of the window under the keys; -1 while the keyboard is down */

  GtkGesture *drag;
  gboolean dragging, denied;
  double drag_dy;
  gint64 sample_time[2];
  double sample_dy[2];
};

static const char frame_key[] = "luma-sheet-frame";
static const char frame_dim_key[] = "luma-sheet-frame-dim";
static const char framed_label_key[] = "luma-sheet-framed";

static void frame_unlayout (LumaSheetFrame *frame);
static void frame_layout (LumaSheetFrame *frame);
static void frame_apply_motion (LumaSheetFrame *frame);

LumaSheetFrame *
luma_sheet_frame_get (GtkWidget *mover)
{
  return mover != NULL ? g_object_get_data (G_OBJECT (mover), frame_key) : NULL;
}

static GtkWidget *
find_cancel (GtkWidget *node)
{
  for (GtkWidget *child = gtk_widget_get_first_child (node); child; child = gtk_widget_get_next_sibling (child)) {
    GtkWidget *found;
    if (!gtk_widget_get_visible (child))
      continue;
    if (GTK_IS_BUTTON (child) && luma_sheet_button_get_role (child) == LUMA_SHEET_ROLE_CANCEL)
      return gtk_widget_is_sensitive (child) ? child : NULL;
    found = find_cancel (child);
    if (found != NULL)
      return found;
  }
  return NULL;
}

/* A sheet answers a swipe down or a tap outside as Cancel, only when it has one. */
static gboolean
frame_cancel (LumaSheetFrame *frame)
{
  GtkWidget *cancel = frame->card != NULL ? find_cancel (frame->card) : NULL;
  if (cancel == NULL)
    return FALSE;
  /* clicked at once: activating a button answers only after its press is drawn (250 ms). */
  g_signal_emit_by_name (cancel, "clicked");
  return TRUE;
}

static void
frame_queue (LumaSheetFrame *frame)
{
  if (frame->overlay != NULL)
    gtk_widget_queue_allocate (GTK_WIDGET (frame->overlay));
}

static void
frame_apply_motion (LumaSheetFrame *frame)
{
  if (frame->mover != NULL)
    gtk_widget_set_opacity (frame->mover, frame->framed ? frame->opacity : 1.0);
  if (frame->dim != NULL)
    gtk_widget_set_opacity (frame->dim, frame->dim_opacity);
  frame_queue (frame);
}

/* The sheet's whole height, its padding and border included (not its margins). */
static double
frame_height (LumaSheetFrame *frame)
{
  graphene_rect_t bounds;
  if (frame->mover == NULL || !gtk_widget_compute_bounds (frame->mover, frame->mover, &bounds))
    return 0;
  return bounds.size.height;
}

static double
frame_travel (LumaSheetFrame *frame)
{
  return frame_height (frame) + MAX (frame->gap, FRAME_BOTTOM);
}

static gboolean
frame_tick (GtkWidget *widget, GdkFrameClock *clock, gpointer data)
{
  LumaSheetFrame *frame = data;
  gint64 now = gdk_frame_clock_get_frame_time (clock);
  double t, dim_t;
  (void) widget;

  if (frame->waiting) {
    /* The rise starts from below the screen once the sheet knows its height. */
    if (frame->mover == NULL || gtk_widget_get_height (frame->mover) <= 0) {
      frame_queue (frame);
      return G_SOURCE_CONTINUE;
    }
    frame->waiting = FALSE;
    frame->from = frame->fade ? 0 : frame_travel (frame);
    frame->start = now;
  }
  t = frame->duration ? (double) (now - frame->start) / (frame->duration * 1000.0) : 1.0;
  dim_t = frame->dim_duration ? (double) (now - frame->start) / (frame->dim_duration * 1000.0) : 1.0;
  t = CLAMP (t, 0.0, 1.0);
  dim_t = CLAMP (dim_t, 0.0, 1.0);
  if (frame->fade) {
    frame->offset = frame->to;
    frame->opacity = frame->fade_from + (frame->fade_to - frame->fade_from) * t;
  } else {
    frame->offset = frame->from + (frame->to - frame->from) * bezier (frame->curve, t);
    frame->opacity = 1.0;
  }
  frame->dim_opacity = frame->dim_from + (frame->dim_to - frame->dim_from) * bezier (curve_ease, dim_t);
  frame_apply_motion (frame);
  if (t < 1.0 || dim_t < 1.0)
    return G_SOURCE_CONTINUE;

  frame->tick = 0;
  if (frame->motion == MOTION_LEAVE && frame->done != NULL) {
    GSourceFunc done = frame->done;
    frame->done = NULL;
    frame->motion = MOTION_NONE;
    done (frame->done_data);
  } else {
    frame->motion = MOTION_NONE;
  }
  return G_SOURCE_REMOVE;
}

static void
frame_stop (LumaSheetFrame *frame)
{
  if (frame->tick != 0 && frame->mover != NULL)
    gtk_widget_remove_tick_callback (frame->mover, frame->tick);
  frame->tick = 0;
}

static void
frame_run (LumaSheetFrame *frame, Motion motion, double to, guint duration, const double *curve,
           double dim_to, guint dim_duration)
{
  frame_stop (frame);
  frame->motion = motion;
  frame->from = frame->offset;
  frame->to = to;
  frame->fade_from = frame->opacity;
  frame->dim_from = frame->dim_opacity;
  frame->dim_to = dim_to;
  frame->duration = duration;
  frame->dim_duration = dim_duration;
  frame->curve = curve;
  frame->start = g_get_monotonic_time ();
  if (frame->mover != NULL && gtk_widget_get_mapped (frame->mover) && (duration > 0 || dim_duration > 0)) {
    GdkFrameClock *clock = gtk_widget_get_frame_clock (frame->mover);
    if (clock != NULL)
      frame->start = gdk_frame_clock_get_frame_time (clock);
    frame->tick = gtk_widget_add_tick_callback (frame->mover, frame_tick, frame, NULL);
    return;
  }
  if (frame->mover != NULL && !gtk_widget_get_mapped (frame->mover) && (duration > 0 || dim_duration > 0)
      && motion == MOTION_ENTER) {
    /* Not on screen yet: the tick starts with the first frame. */
    frame->tick = gtk_widget_add_tick_callback (frame->mover, frame_tick, frame, NULL);
    return;
  }
  /* Nothing to animate. */
  frame->waiting = FALSE;
  frame->offset = to;
  frame->opacity = frame->fade ? frame->fade_to : 1.0;
  frame->dim_opacity = dim_to;
  frame->motion = MOTION_NONE;
  frame_apply_motion (frame);
  if (motion == MOTION_LEAVE && frame->done != NULL) {
    GSourceFunc done = frame->done;
    frame->done = NULL;
    done (frame->done_data);
  }
}

void
luma_sheet_frame_enter (LumaSheetFrame *frame)
{
  g_return_if_fail (frame != NULL);
  if (!frame->framed) {
    frame->offset = 0;
    frame->opacity = 1;
    frame->dim_opacity = 1;
    frame_apply_motion (frame);
    return;
  }
  frame->fade = luma_ui_reduced_motion ();
  if (frame->fade) {
    frame->offset = 0;
    frame->opacity = 0;
    frame->fade_to = 1;
    frame->dim_opacity = 0;
    frame_run (frame, MOTION_ENTER, 0, FRAME_FADE_MS, curve_ease, 1, FRAME_FADE_MS);
    return;
  }
  /* Off screen until the first layout gives the sheet its height. */
  frame->opacity = 1;
  frame->dim_opacity = 0;
  frame->offset = 100000;
  frame->waiting = TRUE;
  frame_run (frame, MOTION_ENTER, 0, FRAME_IN_MS, curve_in, 1, FRAME_DIM_MS);
  frame->waiting = frame->tick != 0;
  if (!frame->waiting)
    frame->offset = 0;
}

guint
luma_sheet_frame_leave (LumaSheetFrame *frame, GSourceFunc done, gpointer data)
{
  guint duration;
  g_return_val_if_fail (frame != NULL, 0);
  frame->done = done;
  frame->done_data = data;
  frame->waiting = FALSE;
  if (!frame->framed || frame->mover == NULL || !gtk_widget_get_mapped (frame->mover)) {
    frame_run (frame, MOTION_LEAVE, frame->offset, 0, curve_out, 0, 0);
    return 0;
  }
  frame->fade = luma_ui_reduced_motion ();
  if (frame->fade) {
    frame->fade_to = 0;
    duration = FRAME_FADE_MS;
    frame_run (frame, MOTION_LEAVE, frame->offset, duration, curve_ease, 0, FRAME_FADE_MS);
  } else {
    duration = FRAME_OUT_MS;
    frame_run (frame, MOTION_LEAVE, frame_travel (frame), duration, curve_out, 0, FRAME_DIM_MS);
  }
  return duration;
}

double
luma_sheet_frame_get_offset (LumaSheetFrame *frame)
{
  return frame->offset;
}

gboolean
luma_sheet_frame_is_moving (LumaSheetFrame *frame)
{
  return frame->tick != 0 || frame->waiting;
}

/* ── The swipe ── */

static gboolean
frame_can_scroll_up (LumaSheetFrame *frame)
{
  GtkAdjustment *adjustment;
  if (frame->scroller == NULL)
    return FALSE;
  adjustment = gtk_scrolled_window_get_vadjustment (GTK_SCROLLED_WINDOW (frame->scroller));
  return gtk_adjustment_get_value (adjustment) > 0.5;
}

static gboolean
frame_scrolls (LumaSheetFrame *frame)
{
  GtkAdjustment *adjustment;
  if (frame->scroller == NULL)
    return FALSE;
  adjustment = gtk_scrolled_window_get_vadjustment (GTK_SCROLLED_WINDOW (frame->scroller));
  return gtk_adjustment_get_upper (adjustment) - gtk_adjustment_get_page_size (adjustment) > 0.5;
}

void
luma_sheet_frame_drag (LumaSheetFrame *frame, double dy)
{
  frame_stop (frame);
  frame->motion = MOTION_NONE;
  frame->drag_dy = dy;
  if (frame->fade)
    return; /* Reduced motion: the sheet stays put; a swipe still dismisses. */
  frame->offset = dy >= 0 ? dy : -FRAME_RUBBER_BAND * (1.0 - exp (dy / (2.0 * FRAME_RUBBER_BAND)));
  frame_queue (frame);
}

gboolean
luma_sheet_frame_release (LumaSheetFrame *frame, double dy, double velocity)
{
  double height = frame_height (frame);
  frame->drag_dy = 0;
  if (luma_sheet_swipe_dismisses (dy, height, velocity) && frame_cancel (frame)) {
    if (frame->motion == MOTION_LEAVE)
      return TRUE;
    /* The application kept it up: back in place. */
  }
  frame->fade = luma_ui_reduced_motion ();
  if (frame->fade)
    frame_run (frame, MOTION_SPRING, 0, 0, curve_in, frame->dim_opacity, 0);
  else
    frame_run (frame, MOTION_SPRING, 0, FRAME_SPRING_MS, curve_in, frame->dim_opacity, 0);
  return FALSE;
}

static void
drag_begin (GtkGestureDrag *gesture, double x, double y, gpointer data)
{
  LumaSheetFrame *frame = data;
  (void) gesture;
  (void) x;
  (void) y;
  frame->dragging = FALSE;
  frame->denied = !frame->framed || frame->motion == MOTION_LEAVE || frame->posture == LUMA_SHEET_POSTURE_TV
                  || find_cancel (frame->card) == NULL;
  frame->sample_time[0] = frame->sample_time[1] = g_get_monotonic_time ();
  frame->sample_dy[0] = frame->sample_dy[1] = 0;
}

static void
drag_update (GtkGestureDrag *gesture, double dx, double dy, gpointer data)
{
  LumaSheetFrame *frame = data;
  gint64 now = g_get_monotonic_time ();
  if (frame->denied)
    return;
  if (!frame->dragging) {
    if (fabs (dy) < 6 && fabs (dx) < 6)
      return;
    /* Sideways, a scrolled body, or up over a body that scrolls: not a swipe. */
    if (fabs (dx) > fabs (dy) || (dy > 0 && frame_can_scroll_up (frame)) || (dy < 0 && frame_scrolls (frame))) {
      frame->denied = TRUE;
      return;
    }
    frame->dragging = TRUE;
    gtk_gesture_set_state (GTK_GESTURE (gesture), GTK_EVENT_SEQUENCE_CLAIMED);
  }
  /* The speed at release is measured over the last stretch of the drag. */
  if (now - frame->sample_time[1] > 16000) {
    frame->sample_time[0] = frame->sample_time[1];
    frame->sample_dy[0] = frame->sample_dy[1];
  }
  frame->sample_time[1] = now;
  frame->sample_dy[1] = dy;
  luma_sheet_frame_drag (frame, dy);
}

static void
drag_end (GtkGestureDrag *gesture, double dx, double dy, gpointer data)
{
  LumaSheetFrame *frame = data;
  double ms, velocity = 0;
  (void) gesture;
  (void) dx;
  if (!frame->dragging)
    return;
  frame->dragging = FALSE;
  ms = (g_get_monotonic_time () - frame->sample_time[0]) / 1000.0;
  if (ms > 0 && ms < 120)
    velocity = (dy - frame->sample_dy[0]) / ms;
  luma_sheet_frame_release (frame, dy, velocity);
}

static void
drag_cancel (GtkGesture *gesture, GdkEventSequence *sequence, gpointer data)
{
  LumaSheetFrame *frame = data;
  (void) gesture;
  (void) sequence;
  if (!frame->dragging)
    return;
  frame->dragging = FALSE;
  luma_sheet_frame_release (frame, 0, 0);
}

static void
dim_pressed (GtkGestureClick *gesture, int n_press, double x, double y, gpointer data)
{
  GtkWidget *dim = gtk_event_controller_get_widget (GTK_EVENT_CONTROLLER (gesture));
  LumaSheetFrame *frame = g_object_get_data (G_OBJECT (dim), frame_dim_key);
  (void) n_press;
  (void) x;
  (void) y;
  (void) data;
  if (frame != NULL && frame->framed && frame->motion != MOTION_LEAVE)
    frame_cancel (frame);
}

/* ── Placement ── */

/* ── The screen's edges: the on-screen keyboard and the panel outline ── */

#define KEYBOARD_GAP 12
#define KEYBOARD_ROOM 76
#define KEYBOARD_EASE_MS 300

static GList *live_frames;
static gpointer keyboard_watch;
static guint keyboard_units;       /* the Shell's keyboard height, TV units (0: down) */
static gboolean keyboard_simulated;
static int keyboard_simulated_cover;
static gboolean side_simulated;
static int side_simulated_inset;
static char *display_profile;      /* the device's display-geometry.json, read once */
static gboolean display_profile_read;

int
luma_sheet_keyboard_cover (int window_height, int monitor_height, int keyboard_height, gboolean at_screen_bottom)
{
  if (keyboard_height <= 0 || !at_screen_bottom)
    return -1;
  /* Where the Shell shrinks the work area for the keys (Mobile, Tablet), the window already ends
   * at their top: nothing is covered, the sheet just rides 12 above them. */
  if (window_height + keyboard_height <= monitor_height + 1)
    return 0;
  return MIN (keyboard_height, window_height);
}

static GdkMonitor *
monitor_of (GtkWidget *widget)
{
  GtkNative *native = widget != NULL ? gtk_widget_get_native (widget) : NULL;
  GdkSurface *surface = native != NULL ? gtk_native_get_surface (native) : NULL;
  return surface != NULL ? gdk_display_get_monitor_at_surface (gdk_surface_get_display (surface), surface) : NULL;
}

/* A window that fills its screen's width and ends at its bottom: maximized or full screen. */
static gboolean
fills_screen (GtkWidget *widget)
{
  GtkRoot *root = widget != NULL ? gtk_widget_get_root (widget) : NULL;
  return GTK_IS_WINDOW (root) && (gtk_window_is_maximized (GTK_WINDOW (root)) || gtk_window_is_fullscreen (GTK_WINDOW (root)));
}

static int
frame_keyboard_cover (LumaSheetFrame *frame)
{
  GdkMonitor *monitor;
  GdkRectangle geometry;
  GtkRoot *root;
  if (keyboard_simulated)
    return keyboard_simulated_cover;
  if (keyboard_units == 0 || frame->mover == NULL)
    return -1;
  monitor = monitor_of (frame->mover);
  root = gtk_widget_get_root (frame->mover);
  if (monitor == NULL || root == NULL)
    return -1;
  gdk_monitor_get_geometry (monitor, &geometry);
  /* The Shell's keyboard service (org.projectluma.Shell.Keyboard1) gives the height in TV units. */
  return luma_sheet_keyboard_cover (gtk_widget_get_height (GTK_WIDGET (root)), geometry.height,
                                    (int) lround (keyboard_units * luma_ui_tv_unit (geometry.width, geometry.height)),
                                    fills_screen (frame->mover));
}

static gboolean
frame_gap_tick (GtkWidget *widget, GdkFrameClock *clock, gpointer data)
{
  LumaSheetFrame *frame = data;
  double t = (gdk_frame_clock_get_frame_time (clock) - frame->gap_start) / (KEYBOARD_EASE_MS * 1000.0);
  (void) widget;
  t = CLAMP (t, 0.0, 1.0);
  frame->gap = frame->gap_from + (frame->gap_to - frame->gap_from) * bezier (curve_in, t);
  frame_queue (frame);
  if (t < 1.0)
    return G_SOURCE_CONTINUE;
  frame->gap_tick = 0;
  return G_SOURCE_REMOVE;
}

/* The keyboard rose, fell or changed height: the sheet's gap eases to where it now belongs. */
static void
frame_keyboard_changed (LumaSheetFrame *frame, gboolean ease)
{
  int cover = frame_keyboard_cover (frame);
  double gap = cover >= 0 ? cover + KEYBOARD_GAP : FRAME_BOTTOM;
  frame->keyboard_cover = cover;
  if (frame->gap_tick != 0 && frame->mover != NULL)
    gtk_widget_remove_tick_callback (frame->mover, frame->gap_tick);
  frame->gap_tick = 0;
  if (!ease || !frame->framed || frame->mover == NULL || !gtk_widget_get_mapped (frame->mover)
      || luma_ui_reduced_motion () || fabs (gap - frame->gap) < 0.5) {
    frame->gap = gap;
    frame_queue (frame);
    return;
  }
  frame->gap_from = frame->gap;
  frame->gap_to = gap;
  frame->gap_start = gdk_frame_clock_get_frame_time (gtk_widget_get_frame_clock (frame->mover));
  frame->gap_tick = gtk_widget_add_tick_callback (frame->mover, frame_gap_tick, frame, NULL);
}

static void
keyboard_height (guint units, gpointer data)
{
  (void) data;
  keyboard_units = units;
  for (GList *l = live_frames; l != NULL; l = l->next)
    frame_keyboard_changed (l->data, TRUE);
}

void
luma_sheet_simulate_keyboard (int cover)
{
  keyboard_simulated = TRUE;
  keyboard_simulated_cover = cover;
  for (GList *l = live_frames; l != NULL; l = l->next)
    frame_keyboard_changed (l->data, TRUE);
}

double
luma_sheet_frame_get_gap (LumaSheetFrame *frame)
{
  return frame->gap;
}

/* Exclusion rectangles (logical px of a @screen_w × @screen_h screen) from one display profile,
 * schema 1 or one entry of schema 2's displays, the way the Shell reads them (safeAreas.js). The
 * screen's rotation is not known here: a profile turned against the screen is tried both ways. */

typedef struct { const char *p; } Json;

static void json_space (Json *j) { while (*j->p == ' ' || *j->p == '\n' || *j->p == '\r' || *j->p == '\t') j->p++; }

static GVariant *json_value (Json *j, int depth);

static char *
json_string (Json *j)
{
  g_autoptr (GString) out = NULL;
  if (*j->p != '"')
    return NULL;
  out = g_string_new (NULL);
  j->p++;
  while (*j->p && *j->p != '"') {
    if (*j->p == '\\' && j->p[1])
      j->p++;
    g_string_append_c (out, *j->p++);
  }
  if (*j->p != '"')
    return NULL;
  j->p++;
  return g_string_free (g_steal_pointer (&out), FALSE);
}

/* A small JSON reader for the display profile: objects become a{sv}, arrays av, numbers d. */
static GVariant *
json_value (Json *j, int depth)
{
  json_space (j);
  if (depth > 8)
    return NULL;
  if (*j->p == '{') {
    GVariantBuilder builder;
    g_variant_builder_init (&builder, G_VARIANT_TYPE_VARDICT);
    j->p++;
    json_space (j);
    while (*j->p && *j->p != '}') {
      g_autofree char *key = json_string (j);
      GVariant *value;
      json_space (j);
      if (key == NULL || *j->p != ':')
        return g_variant_builder_clear (&builder), NULL;
      j->p++;
      value = json_value (j, depth + 1);
      if (value == NULL)
        return g_variant_builder_clear (&builder), NULL;
      g_variant_builder_add (&builder, "{sv}", key, value);
      json_space (j);
      if (*j->p == ',')
        j->p++, json_space (j);
    }
    if (*j->p != '}')
      return g_variant_builder_clear (&builder), NULL;
    j->p++;
    return g_variant_builder_end (&builder);
  }
  if (*j->p == '[') {
    GVariantBuilder builder;
    g_variant_builder_init (&builder, G_VARIANT_TYPE ("av"));
    j->p++;
    json_space (j);
    while (*j->p && *j->p != ']') {
      GVariant *value = json_value (j, depth + 1);
      if (value == NULL)
        return g_variant_builder_clear (&builder), NULL;
      g_variant_builder_add (&builder, "v", value);
      json_space (j);
      if (*j->p == ',')
        j->p++, json_space (j);
    }
    if (*j->p != ']')
      return g_variant_builder_clear (&builder), NULL;
    j->p++;
    return g_variant_builder_end (&builder);
  }
  if (*j->p == '"') {
    char *text = json_string (j);
    return text != NULL ? g_variant_new_take_string (text) : NULL;
  }
  if (g_str_has_prefix (j->p, "true") || g_str_has_prefix (j->p, "false")) {
    gboolean yes = *j->p == 't';
    j->p += yes ? 4 : 5;
    return g_variant_new_boolean (yes);
  }
  if (g_str_has_prefix (j->p, "null")) {
    j->p += 4;
    return g_variant_new_boolean (FALSE);
  }
  {
    char *end = NULL;
    double number = g_ascii_strtod (j->p, &end);
    if (end == j->p)
      return NULL;
    j->p = end;
    return g_variant_new_double (number);
  }
}

static double
dict_number (GVariant *dict, const char *key)
{
  double value = 0;
  return g_variant_lookup (dict, key, "d", &value) ? value : -1;
}

/* The side room one panel's exclusions take from a sheet whose band is @band_top..@band_bottom. */
static int
panel_side_inset (GVariant *panel, int screen_w, int screen_h, int band_top, int band_bottom)
{
  double nw = dict_number (panel, "nativeWidth"), nh = dict_number (panel, "nativeHeight");
  g_autoptr (GVariant) cutouts = g_variant_lookup_value (panel, "cutouts", G_VARIANT_TYPE ("av"));
  gboolean turned;
  double inset = 0;
  if (nw <= 0 || nh <= 0 || cutouts == NULL || screen_w <= 0 || screen_h <= 0)
    return 0;
  turned = (nw > nh) != (screen_w > screen_h);
  for (gsize i = 0; i < g_variant_n_children (cutouts); i++) {
    g_autoptr (GVariant) boxed = g_variant_get_child_value (cutouts, i);
    g_autoptr (GVariant) rect = g_variant_get_variant (boxed);
    double x, y, w, h;
    if (!g_variant_is_of_type (rect, G_VARIANT_TYPE_VARDICT))
      continue;
    x = dict_number (rect, "x"), y = dict_number (rect, "y");
    w = dict_number (rect, "width"), h = dict_number (rect, "height");
    if (x < 0 || y < 0 || w <= 0 || h <= 0)
      continue;
    /* Both quarter turns (0, 2 when upright), in logical px; a side's room is from that edge. */
    for (int way = 0; way < 2; way++) {
      double rx, ry, rw, rh, sx, sy;
      if (turned) {
        sx = screen_w / nh, sy = screen_h / nw;
        rx = way == 0 ? (nh - y - h) : y, ry = way == 0 ? x : (nw - x - w), rw = h, rh = w;
      } else {
        sx = screen_w / nw, sy = screen_h / nh;
        rx = way == 0 ? x : (nw - x - w), ry = way == 0 ? y : (nh - y - h), rw = w, rh = h;
      }
      rx *= sx, rw *= sx, ry *= sy, rh *= sy;
      if (ry >= band_bottom || ry + rh <= band_top)
        continue;
      if (rx < screen_w / 3.0)
        inset = MAX (inset, rx + rw);
      if (rx + rw > screen_w * 2 / 3.0)
        inset = MAX (inset, screen_w - rx);
    }
  }
  return (int) ceil (inset);
}

int
luma_sheet_side_inset (const char *profile_json, const char *connector, int screen_w, int screen_h,
                       int band_top, int band_bottom)
{
  Json j = { profile_json };
  g_autoptr (GVariant) root = NULL;
  g_autoptr (GVariant) displays = NULL;
  double schema;
  if (profile_json == NULL)
    return 0;
  root = json_value (&j, 0);
  if (root == NULL)
    return 0;
  root = g_variant_ref_sink (root);
  if (!g_variant_is_of_type (root, G_VARIANT_TYPE_VARDICT))
    return 0;
  schema = dict_number (root, "schema");
  if (schema == 1)
    return panel_side_inset (root, screen_w, screen_h, band_top, band_bottom);
  displays = g_variant_lookup_value (root, "displays", G_VARIANT_TYPE ("av"));
  for (gsize i = 0; schema == 2 && displays != NULL && i < g_variant_n_children (displays); i++) {
    g_autoptr (GVariant) boxed = g_variant_get_child_value (displays, i);
    g_autoptr (GVariant) panel = g_variant_get_variant (boxed);
    const char *name = NULL;
    if (g_variant_is_of_type (panel, G_VARIANT_TYPE_VARDICT) && g_variant_lookup (panel, "connector", "&s", &name)
        && g_strcmp0 (name, connector) == 0)
      return panel_side_inset (panel, screen_w, screen_h, band_top, band_bottom);
  }
  return 0;
}

void
luma_sheet_simulate_side_inset (int inset)
{
  side_simulated = inset >= 0;
  side_simulated_inset = inset;
}

/* Landscape safe area: a notch or the panel's rounded corners add to the 16 gutter. */
static int
frame_side_inset (LumaSheetFrame *frame, int width, int height)
{
  GdkMonitor *monitor;
  GdkRectangle geometry;
  if (side_simulated)
    return side_simulated_inset;
  if (width <= height || frame->mover == NULL || !fills_screen (frame->mover))
    return 0;
  monitor = monitor_of (frame->mover);
  if (monitor == NULL)
    return 0;
  gdk_monitor_get_geometry (monitor, &geometry);
  if (width < geometry.width - 1)
    return 0;
  if (!display_profile_read) {
    /* The same files the Shell reads (config/mobile/display-geometry). */
    const char *paths[] = { "/etc/luma/display-geometry.json", "/usr/share/luma/display-geometry.json" };
    display_profile_read = TRUE;
    for (guint i = 0; i < G_N_ELEMENTS (paths) && display_profile == NULL; i++)
      g_file_get_contents (paths[i], &display_profile, NULL, NULL);
  }
  return luma_sheet_side_inset (display_profile, gdk_monitor_get_connector (monitor), geometry.width,
                                geometry.height, FRAME_ROOM - FRAME_BOTTOM, height - FRAME_BOTTOM);
}

gboolean
luma_sheet_frame_position (GtkOverlay *overlay, GtkWidget *child, GdkRectangle *allocation)
{
  LumaSheetFrame *frame = g_object_get_data (G_OBJECT (child), frame_key);
  LumaSheetFrame *dims = g_object_get_data (G_OBJECT (child), frame_dim_key);
  int width = gtk_widget_get_width (GTK_WIDGET (overlay));
  int height = gtk_widget_get_height (GTK_WIDGET (overlay));
  int sheet_width, minimum = 0, natural = 0, sheet_height, ms, me, mt, mb, side, room;

  if (dims != NULL && dims->framed && dims->dim == child) {
    allocation->x = 0;
    allocation->y = 0;
    allocation->width = width;
    allocation->height = height;
    return TRUE;
  }
  if (frame == NULL || frame->mover != child)
    return FALSE;
  if (!frame->framed)
    return FALSE;
  /* The child's own margins (the layer host's drawer gives its card the frame's 16, 34 and 86)
   * wrap the place; measures include them. */
  ms = gtk_widget_get_margin_start (child);
  me = gtk_widget_get_margin_end (child);
  mt = gtk_widget_get_margin_top (child);
  mb = gtk_widget_get_margin_bottom (child);
  /* The gutter grows by the screen's own edge in landscape (a notch, a rounded corner). The sheet
   * stays centred on the bar's place. Fold and Duo: the kit has no hinge data yet, so a sheet
   * on a spanned window is centred on the whole window (follow-up: centre it on the pane that
   * holds the bar's place once the device profile describes the hinge). */
  side = FRAME_SIDE + frame_side_inset (frame, width, height);
  sheet_width = MAX (0, width - 2 * side);
  if (frame->posture == LUMA_SHEET_POSTURE_FLOATING)
    sheet_width = MIN (sheet_width, FRAME_FLOATING_WIDTH);
  gtk_widget_measure (child, GTK_ORIENTATION_HORIZONTAL, -1, &minimum, NULL, NULL, NULL);
  sheet_width = MAX (sheet_width, minimum - ms - me);
  gtk_widget_measure (child, GTK_ORIENTATION_VERTICAL, sheet_width + ms + me, &minimum, &natural, NULL, NULL);
  /* With the keyboard up the sheet rides 12 above it, at most the space left less 76. */
  room = frame->keyboard_cover >= 0 ? frame->keyboard_cover + KEYBOARD_ROOM : FRAME_ROOM;
  sheet_height = MAX (minimum - mt - mb, MIN (natural - mt - mb, height - room));
  allocation->width = sheet_width + ms + me;
  allocation->height = sheet_height + mt + mb;
  allocation->x = (width - sheet_width) / 2 - ms;
  allocation->y = height - (int) lround (frame->gap) - sheet_height - mt + (int) lround (frame->offset);
  return TRUE;
}

static gboolean
position_frame_child (GtkOverlay *overlay, GtkWidget *child, GdkRectangle *allocation, gpointer data)
{
  (void) data;
  return luma_sheet_frame_position (overlay, child, allocation);
}

void
luma_sheet_frame_watch_overlay (GtkOverlay *overlay)
{
  if (g_object_get_data (G_OBJECT (overlay), "luma-sheet-frame-watched") != NULL)
    return;
  g_object_set_data (G_OBJECT (overlay), "luma-sheet-frame-watched", GINT_TO_POINTER (1));
  g_signal_connect (overlay, "get-child-position", G_CALLBACK (position_frame_child), NULL);
}

/* ── Layout: the head and body scroll, the buttons stay pinned ── */

static void
frame_add_class (LumaSheetFrame *frame, GtkWidget *widget, const char *css)
{
  AddedClass added;
  if (widget == NULL || gtk_widget_has_css_class (widget, css))
    return;
  gtk_widget_add_css_class (widget, css);
  added.widget = g_object_ref (widget);
  added.css = g_strdup (css);
  g_array_append_val (frame->classes, added);
}

static void
frame_hide (LumaSheetFrame *frame, GtkWidget *widget)
{
  if (widget == NULL || !gtk_widget_get_visible (widget))
    return;
  gtk_widget_set_visible (widget, FALSE);
  g_ptr_array_add (frame->hidden, g_object_ref (widget));
}

static gboolean
has_any_class (GtkWidget *widget, const char *const *classes)
{
  for (guint i = 0; classes[i] != NULL; i++)
    if (gtk_widget_has_css_class (widget, classes[i]))
      return TRUE;
  return FALSE;
}

static const char *const frame_words[] = { "luma-save-title", "luma-save-body", "luma-save-error",
                                           "lumaui-dialog-title", "lumaui-dialog-body", NULL };
/* The desktop's ornaments: the document, the icon, the grabber, a key hint
 * no touch screen has. */
static const char *const frame_ornaments[] = { "luma-save-mark", "lumaui-dialog-icon", "lumaui-drawer-handle",
                                               "luma-save-shortcut", NULL };

static void
frame_hide_ornaments (LumaSheetFrame *frame, GtkWidget *node)
{
  for (GtkWidget *child = gtk_widget_get_first_child (node); child; child = gtk_widget_get_next_sibling (child))
    if (has_any_class (child, frame_ornaments))
      frame_hide (frame, child);
    else
      frame_hide_ornaments (frame, child);
}

static void
frame_adapt (LumaSheetFrame *frame, GtkWidget *node)
{
  for (GtkWidget *child = gtk_widget_get_first_child (node); child; child = gtk_widget_get_next_sibling (child)) {
    if (has_any_class (child, frame_ornaments)) {
      frame_hide (frame, child);
      continue;
    }
    if (GTK_IS_LABEL (child) && has_any_class (child, frame_words)) {
      LabelState state = { g_object_ref (child), gtk_label_get_xalign (GTK_LABEL (child)),
                           gtk_label_get_justify (GTK_LABEL (child)),
                           gtk_label_get_max_width_chars (GTK_LABEL (child)), 0 };
      GtkWidget *parent = gtk_widget_get_parent (child);
      gtk_widget_get_size_request (child, &state.width_request, NULL);
      g_array_append_val (frame->labels, state);
      /* The words fill the sheet's column, left-aligned (v73 .lconf). */
      gtk_label_set_xalign (GTK_LABEL (child), 0);
      gtk_label_set_justify (GTK_LABEL (child), GTK_JUSTIFY_LEFT);
      gtk_label_set_max_width_chars (GTK_LABEL (child), 80);
      gtk_widget_set_size_request (child, -1, -1);
      g_object_set_data (G_OBJECT (child), framed_label_key, GINT_TO_POINTER (1));
      if (ADW_IS_CLAMP (parent)) {
        ClampState clamp = { g_object_ref (parent), adw_clamp_get_maximum_size (ADW_CLAMP (parent)),
                             adw_clamp_get_tightening_threshold (ADW_CLAMP (parent)) };
        g_array_append_val (frame->clamps, clamp);
        adw_clamp_set_maximum_size (ADW_CLAMP (parent), 10000);
        adw_clamp_set_tightening_threshold (ADW_CLAMP (parent), 10000);
      }
      continue;
    }
    if (GTK_IS_BUTTON (child) || GTK_IS_SCROLLED_WINDOW (child))
      continue;
    frame_adapt (frame, child);
  }
}

static void
collect_buttons (GtkWidget *node, GPtrArray *found)
{
  for (GtkWidget *child = gtk_widget_get_first_child (node); child; child = gtk_widget_get_next_sibling (child)) {
    if (GTK_IS_BUTTON (child)) {
      if (gtk_widget_get_visible (child) && luma_sheet_button_get_role (child) != LUMA_SHEET_ROLE_NONE
          && GTK_IS_BOX (gtk_widget_get_parent (child)))
        g_ptr_array_add (found, child);
      continue;
    }
    if (GTK_IS_SCROLLED_WINDOW (child))
      continue;
    collect_buttons (child, found);
  }
}

static GtkWidget *
first_with_role (GPtrArray *buttons, LumaSheetRole role)
{
  for (guint i = 0; i < buttons->len; i++)
    if (luma_sheet_button_get_role (buttons->pdata[i]) == role)
      return buttons->pdata[i];
  return NULL;
}

static gboolean
box_shows_anything (GtkWidget *box)
{
  for (GtkWidget *child = gtk_widget_get_first_child (box); child; child = gtk_widget_get_next_sibling (child))
    if (gtk_widget_get_visible (child))
      return TRUE;
  return FALSE;
}

static void
frame_foot_add (LumaSheetFrame *frame, GtkWidget *where, GtkWidget *button, const char *look)
{
  if (button == NULL)
    return;
  GtkWidget *words = gtk_button_get_child (GTK_BUTTON (button));
  gtk_widget_set_hexpand (button, TRUE);
  gtk_widget_set_halign (button, GTK_ALIGN_FILL);
  /* A button's own row of words (Don't save and its key hint) stays centred in the wider button. */
  if (words != NULL && !GTK_IS_LABEL (words) && gtk_widget_get_halign (words) == GTK_ALIGN_FILL) {
    gtk_widget_set_halign (words, GTK_ALIGN_CENTER);
    g_object_set_data (G_OBJECT (words), "luma-sheet-centred", GINT_TO_POINTER (1));
  }
  gtk_box_append (GTK_BOX (where), button);
  frame_add_class (frame, button, look);
}

static void
frame_layout (LumaSheetFrame *frame)
{
  g_autoptr (GPtrArray) buttons = g_ptr_array_new ();
  GtkWidget *card = frame->card;
  GtkRoot *root;
  GtkWidget *focus = NULL;
  GtkWidget *primary, *secondary, *cancel, *destructive, *action, *left, *right, *own_row = NULL;

  if (frame->framed || card == NULL || !GTK_IS_BOX (card))
    return;
  root = gtk_widget_get_root (card);
  focus = root != NULL ? gtk_root_get_focus (root) : NULL;
  if (focus != NULL && !gtk_widget_is_ancestor (focus, card))
    focus = NULL;
  if (focus != NULL)
    g_object_ref (focus);

  collect_buttons (card, buttons);
  /* Two choices side by side, the primary on the right under the thumb; a
   * third as a quiet row beneath: Cancel, or the destructive one in red. A
   * destructive action that is the question stands in the danger fill. */
  primary = first_with_role (buttons, LUMA_SHEET_ROLE_PRIMARY);
  secondary = first_with_role (buttons, LUMA_SHEET_ROLE_SECONDARY);
  cancel = first_with_role (buttons, LUMA_SHEET_ROLE_CANCEL);
  destructive = first_with_role (buttons, LUMA_SHEET_ROLE_DESTRUCTIVE);
  action = first_with_role (buttons, LUMA_SHEET_ROLE_DESTRUCTIVE_ACTION);
  right = action != NULL ? action : primary;
  left = action != NULL ? cancel : secondary != NULL ? secondary : cancel;
  /* A card whose two answers already stand side by side in that order (the destructive confirm's
   * row) keeps its own row; it only moves to the foot. */
  if (left != NULL && right != NULL && gtk_widget_get_parent (left) == gtk_widget_get_parent (right)) {
    GtkWidget *pair = gtk_widget_get_parent (left);
    if (GTK_IS_ORIENTABLE (pair) && gtk_widget_get_parent (pair) == card
        && gtk_orientable_get_orientation (GTK_ORIENTABLE (pair)) == GTK_ORIENTATION_HORIZONTAL
        && gtk_widget_get_next_sibling (left) == right && gtk_widget_get_prev_sibling (left) == NULL
        && gtk_widget_get_next_sibling (right) == NULL)
      own_row = pair;
  }
  for (guint i = 0; i < buttons->len; i++) {
    GtkWidget *button = buttons->pdata[i];
    Moved *moved;
    frame_hide_ornaments (frame, button);
    if (own_row != NULL && (button == left || button == right))
      continue;
    moved = g_new0 (Moved, 1);
    moved->widget = g_object_ref (button);
    moved->parent = g_object_ref (gtk_widget_get_parent (button));
    moved->prev = gtk_widget_get_prev_sibling (button);
    moved->halign = gtk_widget_get_halign (button);
    moved->hexpand = gtk_widget_get_hexpand (button);
    if (moved->prev != NULL)
      g_object_ref (moved->prev);
    g_ptr_array_add (frame->moved, moved);
  }
  for (guint i = 0; i < frame->moved->len; i++) {
    Moved *moved = frame->moved->pdata[i];
    gtk_box_remove (GTK_BOX (moved->parent), moved->widget);
  }

  frame->content = g_object_new (GTK_TYPE_BOX, "orientation", GTK_ORIENTATION_VERTICAL, NULL);
  gtk_widget_add_css_class (frame->content, "luma-sheet-frame-content");
  while (gtk_widget_get_first_child (card) != NULL) {
    GtkWidget *child = g_object_ref (gtk_widget_get_first_child (card));
    g_ptr_array_add (frame->card_children, child);
    gtk_box_remove (GTK_BOX (card), child);
    if (child != own_row)
      gtk_box_append (GTK_BOX (frame->content), child);
  }
  /* The boxes that only held the buttons are empty now. */
  for (guint i = 0; i < frame->moved->len; i++) {
    Moved *moved = frame->moved->pdata[i];
    for (GtkWidget *box = moved->parent; box != NULL && box != frame->content && box != card && GTK_IS_BOX (box);
         box = gtk_widget_get_parent (box))
      if (!box_shows_anything (box))
        frame_hide (frame, box);
      else
        break;
  }
  frame_adapt (frame, frame->content);

  /* EXTERNAL: the body scrolls under a finger or a wheel, and a short one is no taller than its
   * words (an AUTOMATIC scrollbar's own minimum would pad it). */
  frame->scroller = g_object_new (GTK_TYPE_SCROLLED_WINDOW, "hscrollbar-policy", GTK_POLICY_NEVER,
                                  "vscrollbar-policy", GTK_POLICY_EXTERNAL,
                                  "propagate-natural-height", TRUE, "vexpand", TRUE, NULL);
  gtk_widget_add_css_class (frame->scroller, "luma-sheet-frame-body");
  gtk_scrolled_window_set_child (GTK_SCROLLED_WINDOW (frame->scroller), frame->content);
  frame->foot = gtk_box_new (GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_add_css_class (frame->foot, "luma-sheet-frame-foot");
  if (own_row != NULL) {
    frame->row = own_row;
    frame_add_class (frame, own_row, "luma-sheet-frame-row");
    frame_add_class (frame, left, "luma-sheet-fill");
    frame_add_class (frame, right, action != NULL ? "luma-sheet-danger" : "luma-sheet-key");
  } else {
    frame->row = gtk_box_new (GTK_ORIENTATION_HORIZONTAL, 0); /* 8 apart: the row's border-spacing */
    gtk_box_set_homogeneous (GTK_BOX (frame->row), TRUE);
    gtk_widget_add_css_class (frame->row, "luma-sheet-frame-row");
  }
  gtk_box_append (GTK_BOX (frame->foot), frame->row);
  gtk_box_append (GTK_BOX (card), frame->scroller);
  gtk_box_append (GTK_BOX (card), frame->foot);

  if (own_row == NULL) {
    frame_foot_add (frame, frame->row, left, "luma-sheet-fill");
    frame_foot_add (frame, frame->row, right, action != NULL ? "luma-sheet-danger" : "luma-sheet-key");
  }
  if (left != cancel)
    frame_foot_add (frame, frame->foot, cancel, "luma-sheet-quiet");
  frame_foot_add (frame, frame->foot, destructive, "luma-sheet-quiet-destructive");
  for (guint i = 0; i < buttons->len; i++) /* any other answer: a quiet row too */
    if (gtk_widget_get_parent (buttons->pdata[i]) == NULL)
      frame_foot_add (frame, frame->foot, buttons->pdata[i], "luma-sheet-quiet");
  gtk_widget_set_visible (frame->row, box_shows_anything (frame->row));

  frame_add_class (frame, card, "luma-sheet-frame");
  /* The same object as the phone confirm: its float surface comes with the class. */
  frame_add_class (frame, card, "lumaui-dialog");
  frame->framed = TRUE;
  if (focus != NULL) {
    if (gtk_widget_get_root (focus) != NULL && gtk_widget_get_mapped (focus))
      gtk_widget_grab_focus (focus);
    g_object_unref (focus);
  }
}

static void
frame_unlayout (LumaSheetFrame *frame)
{
  GtkWidget *card = frame->card;
  GtkRoot *root;
  GtkWidget *focus;

  if (!frame->framed)
    return;
  frame->framed = FALSE;
  root = card != NULL ? gtk_widget_get_root (card) : NULL;
  focus = root != NULL ? gtk_root_get_focus (root) : NULL;
  if (focus != NULL)
    g_object_ref (focus);

  for (guint i = 0; i < frame->classes->len; i++) {
    AddedClass *added = &g_array_index (frame->classes, AddedClass, i);
    gtk_widget_remove_css_class (added->widget, added->css);
    g_object_unref (added->widget);
    g_free (added->css);
  }
  g_array_set_size (frame->classes, 0);
  for (guint i = 0; i < frame->labels->len; i++) {
    LabelState *state = &g_array_index (frame->labels, LabelState, i);
    gtk_label_set_xalign (GTK_LABEL (state->label), state->xalign);
    gtk_label_set_justify (GTK_LABEL (state->label), state->justify);
    gtk_label_set_max_width_chars (GTK_LABEL (state->label), state->max_chars);
    gtk_widget_set_size_request (state->label, state->width_request, -1);
    g_object_set_data (G_OBJECT (state->label), framed_label_key, NULL);
    g_object_unref (state->label);
  }
  g_array_set_size (frame->labels, 0);
  for (guint i = 0; i < frame->clamps->len; i++) {
    ClampState *clamp = &g_array_index (frame->clamps, ClampState, i);
    adw_clamp_set_maximum_size (ADW_CLAMP (clamp->clamp), clamp->maximum);
    adw_clamp_set_tightening_threshold (ADW_CLAMP (clamp->clamp), clamp->threshold);
    g_object_unref (clamp->clamp);
  }
  g_array_set_size (frame->clamps, 0);
  for (guint i = 0; i < frame->hidden->len; i++)
    gtk_widget_set_visible (frame->hidden->pdata[i], TRUE);
  g_ptr_array_set_size (frame->hidden, 0);

  for (guint i = 0; i < frame->moved->len; i++) {
    Moved *moved = frame->moved->pdata[i];
    GtkWidget *parent = gtk_widget_get_parent (moved->widget);
    if (parent != NULL)
      gtk_box_remove (GTK_BOX (parent), moved->widget);
  }
  if (card != NULL) {
    if (frame->scroller != NULL)
      gtk_box_remove (GTK_BOX (card), frame->scroller);
    if (frame->foot != NULL)
      gtk_box_remove (GTK_BOX (card), frame->foot);
  }
  for (guint i = 0; i < frame->card_children->len; i++) {
    GtkWidget *child = frame->card_children->pdata[i];
    GtkWidget *parent = gtk_widget_get_parent (child);
    if (parent != NULL)
      gtk_box_remove (GTK_BOX (parent), child);
    if (card != NULL)
      gtk_box_append (GTK_BOX (card), child);
  }
  g_ptr_array_set_size (frame->card_children, 0);
  frame->scroller = frame->content = frame->foot = frame->row = NULL;
  for (guint i = 0; i < frame->moved->len; i++) {
    Moved *moved = frame->moved->pdata[i];
    GtkWidget *words = gtk_button_get_child (GTK_BUTTON (moved->widget));
    gtk_widget_set_halign (moved->widget, moved->halign);
    gtk_widget_set_hexpand (moved->widget, moved->hexpand);
    if (words != NULL && g_object_get_data (G_OBJECT (words), "luma-sheet-centred") != NULL) {
      gtk_widget_set_halign (words, GTK_ALIGN_FILL);
      g_object_set_data (G_OBJECT (words), "luma-sheet-centred", NULL);
    }
    if (moved->prev != NULL && gtk_widget_get_parent (moved->prev) == moved->parent)
      gtk_box_insert_child_after (GTK_BOX (moved->parent), moved->widget, moved->prev);
    else if (moved->prev == NULL)
      gtk_box_prepend (GTK_BOX (moved->parent), moved->widget);
    else
      gtk_box_append (GTK_BOX (moved->parent), moved->widget);
  }
  g_ptr_array_set_size (frame->moved, 0);

  if (focus != NULL) {
    if (gtk_widget_get_root (focus) != NULL && gtk_widget_get_mapped (focus))
      gtk_widget_grab_focus (focus);
    g_object_unref (focus);
  }
}

static void
moved_free (gpointer data)
{
  Moved *moved = data;
  g_object_unref (moved->widget);
  g_object_unref (moved->parent);
  g_clear_object (&moved->prev);
  g_free (moved);
}

/* A window that goes away mid-motion has no frames left to draw it in: finish now. */
static void
frame_unmapped (GtkWidget *mover, gpointer data)
{
  LumaSheetFrame *frame = data;
  (void) mover;
  if (frame->tick == 0 && !frame->waiting)
    return;
  frame_stop (frame);
  frame->waiting = FALSE;
  frame->offset = frame->motion == MOTION_LEAVE ? frame->to : 0;
  if (frame->motion == MOTION_LEAVE && frame->done != NULL) {
    GSourceFunc done = frame->done;
    frame->done = NULL;
    frame->motion = MOTION_NONE;
    g_idle_add (done, frame->done_data); /* not from inside the unmap */
    return;
  }
  frame->motion = MOTION_NONE;
}

static void
frame_width_changed (GtkWidget *mover, int width, gpointer data)
{
  LumaSheetFrame *frame = luma_sheet_frame_get (mover);
  LumaSheetPosture posture;
  (void) data;
  if (frame == NULL || frame->motion == MOTION_LEAVE)
    return;
  posture = luma_sheet_posture_for_width (width);
  if (posture != frame->posture)
    luma_sheet_frame_set_posture (frame, posture);
}

LumaSheetFrame *
luma_sheet_frame_new (GtkOverlay *overlay, GtkWidget *mover, GtkWidget *card, GtkWidget *dim,
                      gboolean dim_when_framed)
{
  LumaSheetFrame *frame;
  GtkWidget *clamp;

  g_return_val_if_fail (GTK_IS_OVERLAY (overlay), NULL);
  g_return_val_if_fail (GTK_IS_WIDGET (mover), NULL);
  g_return_val_if_fail (luma_sheet_frame_get (mover) == NULL, NULL);
  luma_sheet_install_style ();
  frame = g_new0 (LumaSheetFrame, 1);
  frame->moved = g_ptr_array_new_with_free_func (moved_free);
  frame->card_children = g_ptr_array_new_with_free_func (g_object_unref);
  frame->hidden = g_ptr_array_new_with_free_func (g_object_unref);
  frame->labels = g_array_new (FALSE, FALSE, sizeof (LabelState));
  frame->classes = g_array_new (FALSE, FALSE, sizeof (AddedClass));
  frame->clamps = g_array_new (FALSE, FALSE, sizeof (ClampState));
  frame->opacity = 1;
  frame->dim_opacity = 1;
  frame->dim_when_framed = dim_when_framed;
  frame->gap = FRAME_BOTTOM;
  frame->keyboard_cover = -1;
  g_set_weak_pointer (&frame->overlay, overlay);
  g_set_weak_pointer (&frame->mover, mover);
  g_set_weak_pointer (&frame->card, card != NULL ? card : mover);
  g_set_weak_pointer (&frame->dim, dim);
  clamp = frame->card != NULL && frame->card != mover ? gtk_widget_get_ancestor (frame->card, ADW_TYPE_CLAMP) : NULL;
  if (clamp != NULL && gtk_widget_is_ancestor (clamp, mover))
    g_set_weak_pointer (&frame->clamp, clamp);
  g_object_set_data (G_OBJECT (mover), frame_key, frame);
  if (dim != NULL) {
    GtkGesture *click = gtk_gesture_click_new ();
    g_object_set_data (G_OBJECT (dim), frame_dim_key, frame);
    g_signal_connect (click, "pressed", G_CALLBACK (dim_pressed), NULL);
    gtk_widget_add_controller (dim, GTK_EVENT_CONTROLLER (click));
  }
  frame->drag = gtk_gesture_drag_new ();
  gtk_event_controller_set_propagation_phase (GTK_EVENT_CONTROLLER (frame->drag), GTK_PHASE_CAPTURE);
  g_signal_connect (frame->drag, "drag-begin", G_CALLBACK (drag_begin), frame);
  g_signal_connect (frame->drag, "drag-update", G_CALLBACK (drag_update), frame);
  g_signal_connect (frame->drag, "drag-end", G_CALLBACK (drag_end), frame);
  g_signal_connect (frame->drag, "cancel", G_CALLBACK (drag_cancel), frame);
  gtk_widget_add_controller (mover, GTK_EVENT_CONTROLLER (frame->drag));
  frame->unmap_handler = g_signal_connect (mover, "unmap", G_CALLBACK (frame_unmapped), frame);
  live_frames = g_list_prepend (live_frames, frame);
  if (keyboard_watch == NULL && !keyboard_simulated)
    keyboard_watch = luma_tv_keyboard_watch (keyboard_height, NULL); /* kept for the process */
  frame_keyboard_changed (frame, FALSE);
  if (g_object_get_data (G_OBJECT (mover), "luma-sheet-width-watched") == NULL) {
    g_object_set_data (G_OBJECT (mover), "luma-sheet-width-watched", GINT_TO_POINTER (1));
    luma_ui_width_watch (mover, frame_width_changed, NULL, 0);
  }
  return frame;
}

LumaSheetPosture
luma_sheet_frame_get_posture (LumaSheetFrame *frame)
{
  return frame->posture;
}

gboolean
luma_sheet_frame_is_framed (LumaSheetFrame *frame)
{
  return frame != NULL && frame->framed;
}

/* The clamp between the window sheet's scrim and its card: the frame sets
 * the sheet's width itself, and a TV sheet stands centred. */
static void
frame_hold_clamp (LumaSheetFrame *frame, LumaSheetPosture posture)
{
  gboolean framed = posture == LUMA_SHEET_POSTURE_PHONE || posture == LUMA_SHEET_POSTURE_FLOATING;
  if (frame->clamp == NULL)
    return;
  if (!frame->clamp_saved && posture != LUMA_SHEET_POSTURE_DESKTOP) {
    frame->clamp_saved = TRUE;
    frame->clamp_maximum = adw_clamp_get_maximum_size (ADW_CLAMP (frame->clamp));
    frame->clamp_threshold = adw_clamp_get_tightening_threshold (ADW_CLAMP (frame->clamp));
    frame->clamp_margin_start = gtk_widget_get_margin_start (frame->clamp);
    frame->clamp_margin_end = gtk_widget_get_margin_end (frame->clamp);
    frame->clamp_valign = gtk_widget_get_valign (frame->clamp);
  }
  if (!frame->clamp_saved)
    return;
  adw_clamp_set_maximum_size (ADW_CLAMP (frame->clamp), framed ? 10000 : frame->clamp_maximum);
  adw_clamp_set_tightening_threshold (ADW_CLAMP (frame->clamp), framed ? 10000 : frame->clamp_threshold);
  gtk_widget_set_margin_start (frame->clamp, framed ? 0 : frame->clamp_margin_start);
  gtk_widget_set_margin_end (frame->clamp, framed ? 0 : frame->clamp_margin_end);
  gtk_widget_set_valign (frame->clamp, framed ? GTK_ALIGN_FILL
                                     : posture == LUMA_SHEET_POSTURE_TV ? GTK_ALIGN_CENTER : frame->clamp_valign);
  if (posture == LUMA_SHEET_POSTURE_DESKTOP)
    frame->clamp_saved = FALSE;
}

void
luma_sheet_frame_set_posture (LumaSheetFrame *frame, LumaSheetPosture posture)
{
  gboolean framed = posture == LUMA_SHEET_POSTURE_PHONE || posture == LUMA_SHEET_POSTURE_FLOATING;
  g_return_if_fail (frame != NULL);
  frame->posture = posture;
  if (frame->mover != NULL) {
    luma_ui_set_css_class (frame->mover, "frame", framed);
    luma_ui_set_css_class (frame->mover, "floating", posture == LUMA_SHEET_POSTURE_FLOATING);
    /* A card placed by itself (the layer host's) fills the place the frame gives it; out of the
     * frame it is a centred card again. */
    if (frame->mover == frame->card) {
      gtk_widget_set_halign (frame->mover, framed ? GTK_ALIGN_FILL : GTK_ALIGN_CENTER);
      gtk_widget_set_valign (frame->mover, framed ? GTK_ALIGN_FILL : GTK_ALIGN_CENTER);
    }
  }
  if (framed)
    frame_layout (frame);
  else
    frame_unlayout (frame);
  /* On a TV a window sheet is the TV dialog (luma-tv-frame.c's lumaui-dialog rules). */
  if (frame->card != NULL && frame->card != frame->mover && !framed)
    luma_ui_set_css_class (frame->card, "lumaui-dialog", posture == LUMA_SHEET_POSTURE_TV);
  frame_hold_clamp (frame, posture);
  if (frame->dim != NULL && frame->dim_when_framed) {
    gtk_widget_set_visible (frame->dim, framed);
    gtk_widget_set_can_target (frame->dim, framed);
  }
  if (!framed) {
    frame_stop (frame);
    frame->waiting = FALSE;
    frame->offset = 0;
    frame->opacity = 1;
  }
  frame_apply_motion (frame);
}

void
luma_sheet_frame_free (LumaSheetFrame *frame)
{
  if (frame == NULL)
    return;
  frame_stop (frame);
  live_frames = g_list_remove (live_frames, frame);
  if (frame->gap_tick != 0 && frame->mover != NULL)
    gtk_widget_remove_tick_callback (frame->mover, frame->gap_tick);
  frame->gap_tick = 0;
  frame_unlayout (frame);
  frame_hold_clamp (frame, LUMA_SHEET_POSTURE_DESKTOP);
  if (frame->mover != NULL) {
    gtk_widget_set_opacity (frame->mover, 1);
    luma_ui_set_css_class (frame->mover, "frame", FALSE);
    luma_ui_set_css_class (frame->mover, "floating", FALSE);
    if (frame->drag != NULL)
      gtk_widget_remove_controller (frame->mover, GTK_EVENT_CONTROLLER (frame->drag));
    g_clear_signal_handler (&frame->unmap_handler, frame->mover);
    g_object_set_data (G_OBJECT (frame->mover), frame_key, NULL);
  }
  if (frame->card != NULL && frame->card != frame->mover && frame->posture == LUMA_SHEET_POSTURE_TV)
    gtk_widget_remove_css_class (frame->card, "lumaui-dialog");
  if (frame->dim != NULL)
    g_object_set_data (G_OBJECT (frame->dim), frame_dim_key, NULL);
  g_clear_weak_pointer (&frame->overlay);
  g_clear_weak_pointer (&frame->mover);
  g_clear_weak_pointer (&frame->card);
  g_clear_weak_pointer (&frame->dim);
  g_clear_weak_pointer (&frame->clamp);
  g_ptr_array_unref (frame->moved);
  g_ptr_array_unref (frame->card_children);
  g_ptr_array_unref (frame->hidden);
  g_array_unref (frame->labels);
  g_array_unref (frame->classes);
  g_array_unref (frame->clamps);
  g_free (frame);
}

/* ── The window's sheet layer ─────────────────────────────────────────── */

typedef struct {
  GtkWidget *widget;
  gboolean can_target;
} ParkedWidget;

typedef struct {
  GtkEventController *controller;
  GtkPropagationPhase phase;
} ParkedController;

typedef struct {
  GtkOverlay *layer;           /* (weak, owned by the window) */
  GtkWidget *content;          /* (weak) */
  GtkWidget *title_bar;        /* (weak, nullable) */
  gboolean automatic;          /* installed here: hang below the title bar */
  GtkWidget *sheet;            /* (owned) */
  GtkEventController *keys;    /* (owned) */
  GArray *parked_controllers;
  GArray *parked_widgets;
  GWeakRef focus_before;
  LumaSheetFrame *frame;       /* the sheet up now, on a phone, tablet or TV */
  GtkWidget *dim;              /* (weak) what dims the window under a framed sheet */
} SheetHost;

/* A sheet that is leaving: it slides out before it is taken off the layer. */
typedef struct {
  GtkOverlay *layer;           /* (weak) */
  GtkWidget *sheet;            /* (owned) */
  GtkWidget *dim;              /* (owned) */
  LumaSheetFrame *frame;
} Leaving;

static const char leaving_key[] = "luma-sheet-leaving";

static const char host_key[] = "luma-sheet-host";
static const char keep_key[] = "luma-sheet-keep";

static void
host_free (gpointer data)
{
  SheetHost *host = data;
  for (guint i = 0; i < host->parked_controllers->len; i++)
    g_object_unref (g_array_index (host->parked_controllers, ParkedController, i).controller);
  for (guint i = 0; i < host->parked_widgets->len; i++)
    g_object_unref (g_array_index (host->parked_widgets, ParkedWidget, i).widget);
  g_array_unref (host->parked_controllers);
  g_array_unref (host->parked_widgets);
  g_clear_pointer (&host->frame, luma_sheet_frame_free);
  g_clear_weak_pointer (&host->dim);
  g_clear_object (&host->sheet);
  g_clear_object (&host->keys);
  g_weak_ref_clear (&host->focus_before);
  g_free (host);
}

static SheetHost *
host_new (void)
{
  SheetHost *host = g_new0 (SheetHost, 1);
  host->parked_controllers = g_array_new (FALSE, FALSE, sizeof (ParkedController));
  host->parked_widgets = g_array_new (FALSE, FALSE, sizeof (ParkedWidget));
  g_weak_ref_init (&host->focus_before, NULL);
  return host;
}

static void
keep_current_controllers (GtkWindow *window)
{
  GListModel *model = gtk_widget_observe_controllers (GTK_WIDGET (window));
  guint n = g_list_model_get_n_items (model);
  for (guint i = 0; i < n; i++) {
    g_autoptr (GtkEventController) controller = g_list_model_get_item (model, i);
    if (g_strcmp0 (gtk_event_controller_get_name (controller), "gtk-application-shortcuts") != 0)
      g_object_set_data (G_OBJECT (controller), keep_key, GINT_TO_POINTER (1));
  }
  g_object_unref (model);
}

/**
 * luma_window_set_sheet_layer:
 * @window: a window
 * @layer: the overlay above the window's content and below its title bar
 * @content: the content the sheet dims and makes wait
 * @title_bar: (nullable): the title bar, whose controls also wait
 *
 * For a window that builds its own sheet layer, such as the AppKit's
 * AppWindow. Key handlers already on the window are the toolkit's and the
 * kit's and keep working while a sheet is up; ones added later are the
 * application's and are parked. Any other window gets a layer the first time
 * it presents a sheet.
 */
void
luma_window_set_sheet_layer (GtkWindow *window, GtkOverlay *layer,
                             GtkWidget *content, GtkWidget *title_bar)
{
  SheetHost *host;
  g_return_if_fail (GTK_IS_WINDOW (window));
  g_return_if_fail (GTK_IS_OVERLAY (layer));
  g_return_if_fail (GTK_IS_WIDGET (content));
  host = host_new ();
  host->layer = layer;
  host->content = content;
  host->title_bar = title_bar;
  luma_sheet_frame_watch_overlay (layer);
  keep_current_controllers (window);
  g_object_set_data_full (G_OBJECT (window), host_key, host, host_free);
}

static void
collect_top_bars (GtkWidget *widget, GtkWidget *relative, float *bottom, GPtrArray *bars)
{
  if (!gtk_widget_get_mapped (widget))
    return;
  if (ADW_IS_HEADER_BAR (widget) || GTK_IS_HEADER_BAR (widget)) {
    graphene_rect_t bounds;
    if (gtk_widget_compute_bounds (widget, relative, &bounds) && bounds.origin.y <= 1.0f) {
      *bottom = MAX (*bottom, bounds.origin.y + bounds.size.height);
      if (bars)
        g_ptr_array_add (bars, widget);
    }
    return;
  }
  for (GtkWidget *child = gtk_widget_get_first_child (widget); child;
       child = gtk_widget_get_next_sibling (child))
    collect_top_bars (child, relative, bottom, bars);
}

/* An installed layer covers the whole window content, so the sheet and its
 * dimming start below the tallest header bar at the top of the window. */
static gboolean
position_sheet (GtkOverlay *overlay, GtkWidget *child, GdkRectangle *allocation, gpointer data)
{
  GtkWidget *content = gtk_overlay_get_child (overlay);
  float bottom = 0;
  int width = gtk_widget_get_width (GTK_WIDGET (overlay));
  int height = gtk_widget_get_height (GTK_WIDGET (overlay));
  (void) data;
  /* On a phone, a tablet or the Fold the sheet stands in the bar's place. */
  if (luma_sheet_frame_position (overlay, child, allocation))
    return TRUE;
  if (content != NULL)
    collect_top_bars (content, GTK_WIDGET (overlay), &bottom, NULL);
  bottom = MIN (bottom, (float) height);
  allocation->x = 0;
  allocation->y = (int) ceilf (bottom);
  allocation->width = width;
  allocation->height = height - allocation->y;
  return TRUE;
}

static SheetHost *
host_for_window (GtkWindow *window)
{
  SheetHost *host = g_object_get_data (G_OBJECT (window), host_key);
  GtkWidget *content;
  GtkWidget *overlay;

  if (host != NULL)
    return host;
  if (ADW_IS_APPLICATION_WINDOW (window))
    content = adw_application_window_get_content (ADW_APPLICATION_WINDOW (window));
  else if (ADW_IS_WINDOW (window))
    content = adw_window_get_content (ADW_WINDOW (window));
  else
    content = gtk_window_get_child (window);
  if (content == NULL)
    return NULL;

  /* Done once per window and kept: the content moves into an overlay so the
   * sheet can hang over it. Focus is restored when the sheet closes. */
  overlay = gtk_overlay_new ();
  gtk_widget_add_css_class (overlay, "luma-sheet-layer");
  g_object_ref (content);
  if (ADW_IS_APPLICATION_WINDOW (window))
    adw_application_window_set_content (ADW_APPLICATION_WINDOW (window), NULL);
  else if (ADW_IS_WINDOW (window))
    adw_window_set_content (ADW_WINDOW (window), NULL);
  else
    gtk_window_set_child (window, NULL);
  gtk_overlay_set_child (GTK_OVERLAY (overlay), content);
  g_object_unref (content);
  if (ADW_IS_APPLICATION_WINDOW (window))
    adw_application_window_set_content (ADW_APPLICATION_WINDOW (window), overlay);
  else if (ADW_IS_WINDOW (window))
    adw_window_set_content (ADW_WINDOW (window), overlay);
  else
    gtk_window_set_child (window, overlay);
  g_signal_connect (overlay, "get-child-position", G_CALLBACK (position_sheet), NULL);

  host = host_new ();
  host->layer = GTK_OVERLAY (overlay);
  host->content = content;
  host->automatic = TRUE;
  g_object_set_data_full (G_OBJECT (window), host_key, host, host_free);
  return host;
}

static gboolean
inside_window_controls (GtkWidget *widget, GtkWidget *stop)
{
  for (GtkWidget *w = widget; w != NULL && w != stop; w = gtk_widget_get_parent (w))
    if (GTK_IS_WINDOW_CONTROLS (w))
      return TRUE;
  return FALSE;
}

/* The title bar keeps its window controls and its drag; the application's
 * own commands in it wait with the content. */
static void
park_title_commands (SheetHost *host, GtkWidget *bar, GtkWidget *widget)
{
  for (GtkWidget *child = gtk_widget_get_first_child (widget); child;
       child = gtk_widget_get_next_sibling (child)) {
    if (GTK_IS_WINDOW_CONTROLS (child))
      continue;
    if ((GTK_IS_BUTTON (child) || GTK_IS_MENU_BUTTON (child) || GTK_IS_EDITABLE (child)
         || GTK_IS_DROP_DOWN (child) || GTK_IS_SWITCH (child) || GTK_IS_SCALE (child))
        && !inside_window_controls (child, bar)) {
      ParkedWidget parked = { g_object_ref (child), gtk_widget_get_can_target (child) };
      g_array_append_val (host->parked_widgets, parked);
      gtk_widget_set_can_target (child, FALSE);
      gtk_widget_set_can_focus (child, FALSE);
      continue;
    }
    park_title_commands (host, bar, child);
  }
}

static void
leaving_finish (Leaving *leaving)
{
  if (leaving == NULL)
    return;
  g_object_set_data (G_OBJECT (leaving->sheet), leaving_key, NULL);
  g_clear_pointer (&leaving->frame, luma_sheet_frame_free);
  if (leaving->layer != NULL) {
    if (gtk_widget_get_parent (leaving->sheet) == GTK_WIDGET (leaving->layer))
      gtk_overlay_remove_overlay (leaving->layer, leaving->sheet);
    if (leaving->dim != NULL && gtk_widget_get_parent (leaving->dim) == GTK_WIDGET (leaving->layer))
      gtk_overlay_remove_overlay (leaving->layer, leaving->dim);
  }
  g_clear_weak_pointer (&leaving->layer);
  g_clear_object (&leaving->dim);
  g_clear_object (&leaving->sheet);
  g_free (leaving);
}

static gboolean
leaving_done (gpointer data)
{
  leaving_finish (data);
  return G_SOURCE_REMOVE;
}

/* The visible sheet inside a presented sheet widget: the kit's card
 * (luma-save-sheet), or the widget itself. */
static GtkWidget *
find_card (GtkWidget *node)
{
  for (GtkWidget *child = gtk_widget_get_first_child (node); child; child = gtk_widget_get_next_sibling (child)) {
    GtkWidget *found;
    if (gtk_widget_has_css_class (child, "luma-save-sheet"))
      return child;
    found = find_card (child);
    if (found != NULL)
      return found;
  }
  return NULL;
}

static GtkWidget *
sheet_card (GtkWidget *sheet)
{
  GtkWidget *card = gtk_widget_has_css_class (sheet, "luma-save-sheet") ? sheet : find_card (sheet);
  return card != NULL ? card : sheet;
}

/**
 * luma_window_present_sheet:
 * @window: the window that asked
 * @sheet: the sheet to present: a scrim widget holding the card
 *   (`luma-save-sheet`), as #LumaSaveSheet is
 * @keys: (nullable): the sheet's own key handler; it listens on the window,
 *   ahead of everything under it, while the sheet is up
 *
 * Only this window's content dims and stops taking focus and pointer; other
 * windows stay usable. The application's key handlers and accelerators are
 * parked until the sheet is dismissed.
 *
 * On a desktop the card hangs from the title bar. In a window narrower than
 * 560, and on a phone, tablet or Fold at any width, it rises from the bar's
 * place (16 a side, 34 up, at most 560 wide), its words scroll over its pinned
 * buttons, and a swipe down or a tap outside it is Cancel when it has one
 * (#LumaSheetRole). The window's size class is followed while it is up.
 */
void
luma_window_present_sheet (GtkWindow *window, GtkWidget *sheet, GtkEventController *keys)
{
  SheetHost *host;
  GListModel *model;
  GtkWidget *dim;
  guint n;

  g_return_if_fail (GTK_IS_WINDOW (window));
  g_return_if_fail (GTK_IS_WIDGET (sheet));
  host = host_for_window (window);
  g_return_if_fail (host != NULL);
  if (host->sheet != NULL)
    luma_window_dismiss_sheet (window);

  leaving_finish (g_object_get_data (G_OBJECT (sheet), leaving_key));

  g_weak_ref_set (&host->focus_before, gtk_window_get_focus (window));
  host->sheet = g_object_ref (sheet);
  dim = g_object_new (GTK_TYPE_BOX, "visible", FALSE, "can-target", FALSE, "can-focus", FALSE, NULL);
  gtk_widget_add_css_class (dim, "luma-sheet-dim");
  gtk_overlay_add_overlay (host->layer, dim);
  gtk_overlay_set_measure_overlay (host->layer, dim, FALSE);
  g_set_weak_pointer (&host->dim, dim);
  gtk_overlay_add_overlay (host->layer, sheet);
  gtk_overlay_set_measure_overlay (host->layer, sheet, FALSE);
  gtk_overlay_set_clip_overlay (host->layer, sheet, FALSE);
  host->frame = luma_sheet_frame_new (host->layer, sheet, sheet_card (sheet), dim, TRUE);
  luma_sheet_frame_set_posture (host->frame, luma_sheet_posture (GTK_WIDGET (window)));
  luma_sheet_frame_enter (host->frame);
  gtk_widget_set_can_focus (host->content, FALSE);
  gtk_widget_set_can_target (host->content, FALSE);
  gtk_accessible_update_state (GTK_ACCESSIBLE (host->content),
                               GTK_ACCESSIBLE_STATE_HIDDEN, TRUE, -1);

  if (host->title_bar != NULL) {
    gtk_widget_set_can_focus (host->title_bar, FALSE);
    park_title_commands (host, host->title_bar, host->title_bar);
  } else if (host->automatic) {
    g_autoptr (GPtrArray) bars = g_ptr_array_new ();
    float bottom = 0;
    collect_top_bars (host->content, GTK_WIDGET (host->layer), &bottom, bars);
    for (guint i = 0; i < bars->len; i++)
      park_title_commands (host, bars->pdata[i], bars->pdata[i]);
  }

  model = gtk_widget_observe_controllers (GTK_WIDGET (window));
  n = g_list_model_get_n_items (model);
  for (guint i = 0; i < n; i++) {
    g_autoptr (GtkEventController) controller = g_list_model_get_item (model, i);
    ParkedController parked;
    if (g_object_get_data (G_OBJECT (controller), keep_key) != NULL)
      continue;
    if (!GTK_IS_EVENT_CONTROLLER_KEY (controller) && !GTK_IS_SHORTCUT_CONTROLLER (controller))
      continue;
    parked.controller = g_object_ref (controller);
    parked.phase = gtk_event_controller_get_propagation_phase (controller);
    g_array_append_val (host->parked_controllers, parked);
    gtk_event_controller_set_propagation_phase (controller, GTK_PHASE_NONE);
  }
  g_object_unref (model);

  if (keys != NULL) {
    host->keys = g_object_ref (keys);
    gtk_event_controller_set_propagation_phase (keys, GTK_PHASE_CAPTURE);
    gtk_widget_add_controller (GTK_WIDGET (window), g_object_ref (keys));
  }
}

/**
 * luma_window_dismiss_sheet:
 * @window: a window with a sheet up
 *
 * Takes the sheet down, gives the window back, and returns focus to where it
 * was when the sheet opened.
 */
void
luma_window_dismiss_sheet (GtkWindow *window)
{
  SheetHost *host;
  g_autoptr (GtkWidget) focus = NULL;

  g_return_if_fail (GTK_IS_WINDOW (window));
  host = g_object_get_data (G_OBJECT (window), host_key);
  if (host == NULL || host->sheet == NULL)
    return;
  if (host->keys != NULL) {
    gtk_widget_remove_controller (GTK_WIDGET (window), host->keys);
    g_clear_object (&host->keys);
  }
  {
    /* A sheet in the bar's frame slides out first; the window is given back now. */
    Leaving *leaving = g_new0 (Leaving, 1);
    g_set_weak_pointer (&leaving->layer, host->layer);
    leaving->sheet = g_steal_pointer (&host->sheet);
    leaving->dim = host->dim != NULL ? g_object_ref (host->dim) : NULL;
    leaving->frame = g_steal_pointer (&host->frame);
    g_clear_weak_pointer (&host->dim);
    g_object_set_data (G_OBJECT (leaving->sheet), leaving_key, leaving);
    if (leaving->frame != NULL)
      luma_sheet_frame_leave (leaving->frame, leaving_done, leaving);
    else
      leaving_finish (leaving);
  }

  for (guint i = 0; i < host->parked_controllers->len; i++) {
    ParkedController *parked = &g_array_index (host->parked_controllers, ParkedController, i);
    gtk_event_controller_set_propagation_phase (parked->controller, parked->phase);
    g_object_unref (parked->controller);
  }
  g_array_set_size (host->parked_controllers, 0);
  for (guint i = 0; i < host->parked_widgets->len; i++) {
    ParkedWidget *parked = &g_array_index (host->parked_widgets, ParkedWidget, i);
    gtk_widget_set_can_target (parked->widget, parked->can_target);
    gtk_widget_set_can_focus (parked->widget, TRUE);
    g_object_unref (parked->widget);
  }
  g_array_set_size (host->parked_widgets, 0);

  gtk_widget_set_can_focus (host->content, TRUE);
  gtk_widget_set_can_target (host->content, TRUE);
  gtk_accessible_update_state (GTK_ACCESSIBLE (host->content),
                               GTK_ACCESSIBLE_STATE_HIDDEN, FALSE, -1);
  if (host->title_bar != NULL)
    gtk_widget_set_can_focus (host->title_bar, TRUE);

  focus = g_weak_ref_get (&host->focus_before);
  g_weak_ref_set (&host->focus_before, NULL);
  if (focus != NULL && gtk_widget_get_root (focus) == GTK_ROOT (window)
      && gtk_widget_get_mapped (focus))
    gtk_widget_grab_focus (focus);
}

/**
 * luma_window_get_presented_sheet:
 * @window: a window
 *
 * Returns: (transfer none) (nullable): the sheet hanging from its title bar
 */
GtkWidget *
luma_window_get_presented_sheet (GtkWindow *window)
{
  SheetHost *host;
  g_return_val_if_fail (GTK_IS_WINDOW (window), NULL);
  host = g_object_get_data (G_OBJECT (window), host_key);
  return host ? host->sheet : NULL;
}

/* ── Style ────────────────────────────────────────────────────────────── */

static gboolean tokens_from_application = FALSE;

/**
 * luma_ui_tokens_provided_by_application:
 *
 * The process defines the AppKit colour tokens itself and keeps its sheets
 * in step with the treatment (the Python AppKit does). The save sheet then
 * loads only its own style sheet and leaves the rest of the process alone.
 */
void
luma_ui_tokens_provided_by_application (void)
{
  tokens_from_application = TRUE;
}

void
luma_sheet_install_style (void)
{
  static gboolean installed = FALSE;
  if (installed || gdk_display_get_default () == NULL)
    return;
  installed = TRUE;
  if (tokens_from_application)
    return; /* The application loads luma-save-sheet.css through its own kit. */
  luma_init ();
  /* Above luma-ui.css (APPLICATION + 2): the frame redraws the layer host's phone confirm too. */
  luma_ui_add_style_resource ("/org/projectluma/platform/luma-save-sheet.css",
                              GTK_STYLE_PROVIDER_PRIORITY_APPLICATION + 3);
}

/* ── LumaSaveSheet ────────────────────────────────────────────────────── */

struct _LumaSaveSheet {
  GtkWidget parent_instance;

  GPtrArray *documents;
  LumaSaveDocument *document;
  gboolean several;
  gboolean untitled;
  gboolean quitting;

  GtkWidget *clamp;
  GtkWidget *card;
  GtkWidget *title;
  GtkWidget *body;
  GtkWidget *name_row;
  GtkWidget *name_entry;
  GtkWidget *where;
  GtkStringList *place_labels;
  GPtrArray *places;          /* Place, in dropdown order */
  guint previous_place;
  GtkWidget *error;
  GtkWidget *primary;
  GtkWidget *cancel;
  GtkWidget *discard;
  GtkWidget *actions;
  GtkWidget *other;
  GtkEventController *keys;

  GtkWindow *window;          /* (weak) */
  gboolean presented;
  gboolean open;
  gboolean closing;
  gboolean saving;
  guint close_source;
};

enum { SHEET_RESPONSE, SHEET_CLOSED, N_SHEET_SIGNALS };
static guint sheet_signals[N_SHEET_SIGNALS];

G_DEFINE_FINAL_TYPE (LumaSaveSheet, luma_save_sheet, GTK_TYPE_WIDGET)

static void
luma_save_sheet_dispose (GObject *object)
{
  LumaSaveSheet *self = LUMA_SAVE_SHEET (object);
  g_clear_handle_id (&self->close_source, g_source_remove);
  if (self->window != NULL) {
    g_object_remove_weak_pointer (G_OBJECT (self->window), (gpointer *) &self->window);
    self->window = NULL;
  }
  g_clear_pointer (&self->clamp, gtk_widget_unparent);
  g_clear_object (&self->keys);
  G_OBJECT_CLASS (luma_save_sheet_parent_class)->dispose (object);
}

static void
luma_save_sheet_finalize (GObject *object)
{
  LumaSaveSheet *self = LUMA_SAVE_SHEET (object);
  g_ptr_array_unref (self->documents);
  g_ptr_array_unref (self->places);
  g_clear_object (&self->place_labels);
  G_OBJECT_CLASS (luma_save_sheet_parent_class)->finalize (object);
}

static void
luma_save_sheet_class_init (LumaSaveSheetClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS (klass);

  object_class->dispose = luma_save_sheet_dispose;
  object_class->finalize = luma_save_sheet_finalize;

  /**
   * LumaSaveSheet::response:
   * @sheet: the sheet
   * @choice: what the person chose
   * @document: (nullable): the document it is about; %NULL for several
   * @destination: (nullable): for an untitled document, the file to write
   *
   * A SAVE keeps the sheet up, busy, until luma_save_sheet_finish_save().
   */
  sheet_signals[SHEET_RESPONSE] =
    g_signal_new ("response", G_TYPE_FROM_CLASS (klass), G_SIGNAL_RUN_LAST,
                  0, NULL, NULL, NULL, G_TYPE_NONE, 3,
                  LUMA_TYPE_SAVE_CHOICE, LUMA_TYPE_SAVE_DOCUMENT, G_TYPE_FILE);
  /**
   * LumaSaveSheet::closed:
   * @sheet: the sheet
   *
   * The sheet is down and its window is given back.
   */
  sheet_signals[SHEET_CLOSED] =
    g_signal_new ("closed", G_TYPE_FROM_CLASS (klass), G_SIGNAL_RUN_LAST,
                  0, NULL, NULL, NULL, G_TYPE_NONE, 0);

  gtk_widget_class_set_layout_manager_type (widget_class, GTK_TYPE_BIN_LAYOUT);
  gtk_widget_class_set_css_name (widget_class, "luma-save-scrim");
  gtk_widget_class_set_accessible_role (widget_class, GTK_ACCESSIBLE_ROLE_GENERIC);
}

static void
luma_save_sheet_init (LumaSaveSheet *self)
{
  self->documents = g_ptr_array_new_with_free_func (g_object_unref);
  self->places = g_ptr_array_new_with_free_func (place_free);
  gtk_widget_add_css_class (GTK_WIDGET (self), "luma-save-scrim");
  gtk_widget_set_hexpand (GTK_WIDGET (self), TRUE);
  gtk_widget_set_vexpand (GTK_WIDGET (self), TRUE);
}

static const char *
sheet_case (LumaSaveSheet *self)
{
  return self->several ? "several" : self->untitled ? "untitled" : "named";
}

static GtkWidget *
piece (GtkWidget *mark, const char *css, int width, int height, int x, int y)
{
  GtkWidget *part = gtk_box_new (GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class (part, css);
  gtk_widget_set_size_request (part, width, height);
  gtk_widget_set_can_target (part, FALSE);
  gtk_fixed_put (GTK_FIXED (mark), part, x, y);
  return part;
}

/* A page with a folded corner and three lines, wearing the edited dot. */
static GtkWidget *
document_mark (gboolean several)
{
  GtkWidget *mark = g_object_new (GTK_TYPE_FIXED,
                                  "halign", GTK_ALIGN_CENTER,
                                  "can-target", FALSE,
                                  "can-focus", FALSE,
                                  "accessible-role", GTK_ACCESSIBLE_ROLE_PRESENTATION,
                                  NULL);
  gtk_widget_add_css_class (mark, "luma-save-mark");
  gtk_widget_set_size_request (mark, 54, 56);
  if (several)
    piece (mark, "luma-save-page-behind", 40, 48, 13, 0);
  piece (mark, "luma-save-page", 40, 48, 7, 6);
  piece (mark, "luma-save-fold", 14, 14, 33, 6);
  for (int line = 0; line < 3; line++)
    piece (mark, "luma-save-rule", 22, 2, 16, 27 + 6 * line);
  piece (mark, "luma-save-dot", 14, 14, 38, 41);
  return mark;
}

/* CSS has no text-wrap: balance. A wrapped label is as wide as its maximum
 * width in characters, so asking for the length of an even share of the lines
 * gives balanced lines instead of a long first line and a lonely last word. */
static void
balance (GtkWidget *label, const char *text, int limit)
{
  glong length = g_utf8_strlen (text, -1);
  glong lines = MAX (1, (length + limit - 1) / limit);
  gtk_label_set_max_width_chars (GTK_LABEL (label), (int) MIN (limit, (length + lines - 1) / lines + 2));
}

/* A wrapping label given the whole card wraps at the card's width, and
 * centring it does not help: alignment measures a wrapping label's width for
 * its one-line height. A clamp at the label's own natural width (its
 * character limit, in the font it is drawn in) makes the limit hold, and
 * still shrinks with a narrow window. */
static void
fit_clamp_to_label (GtkWidget *label, gpointer data)
{
  AdwClamp *clamp = data;
  int natural = 0;
  if (g_object_get_data (G_OBJECT (label), framed_label_key) != NULL)
    return; /* In the bar's frame the words fill the sheet's column. */
  gtk_widget_measure (label, GTK_ORIENTATION_HORIZONTAL, -1, NULL, &natural, NULL, NULL);
  if (natural > 0 && natural != adw_clamp_get_maximum_size (clamp)) {
    adw_clamp_set_maximum_size (clamp, natural);
    adw_clamp_set_tightening_threshold (clamp, natural);
  }
}

static GtkWidget *
wrapped_label (const char *text, const char *css, int limit, GtkWidget **label_out)
{
  GtkWidget *label = gtk_label_new (text);
  GtkWidget *clamp = adw_clamp_new ();
  gtk_label_set_wrap (GTK_LABEL (label), TRUE);
  gtk_label_set_wrap_mode (GTK_LABEL (label), PANGO_WRAP_WORD_CHAR);
  gtk_label_set_justify (GTK_LABEL (label), GTK_JUSTIFY_CENTER);
  gtk_widget_add_css_class (label, css);
  balance (label, text, limit);
  adw_clamp_set_child (ADW_CLAMP (clamp), label);
  adw_clamp_set_maximum_size (ADW_CLAMP (clamp), SHEET_WIDTH);
  g_signal_connect (label, "map", G_CALLBACK (fit_clamp_to_label), clamp);
  *label_out = label;
  return clamp;
}

static void
words (LumaSaveSheet *self, char **title, char **body)
{
  g_autofree char *name = NULL;
  g_autofree char *fact = NULL;

  if (self->several) {
    *title = several_title ((LumaSaveDocument * const *) self->documents->pdata, self->documents->len);
    *body = g_strdup (S_("Go through them one at a time, or leave without saving any of them."));
    return;
  }
  name = quoted (self->document->name);
  if (self->untitled) {
    *title = g_strdup_printf (self->quitting ? S_("Save %s before quitting?") : S_("Save %s before closing?"), name);
    fact = g_strdup (S_("It has never been saved. Give it a name and a place."));
  } else {
    *title = g_strdup_printf (S_("Save changes to %s?"), name);
    fact = at_stake (self->document);
  }
  if (self->document->recovery_copy)
    *body = g_strdup_printf ("%s %s", fact, S_("A recovery copy is kept until you save or discard."));
  else
    *body = g_steal_pointer (&fact);
}

static void clear_error (LumaSaveSheet *self);
static void place_selected (GObject *dropdown, GParamSpec *pspec, gpointer data);

static GtkWidget *
field (const char *label_text, GtkWidget *control)
{
  GtkWidget *row = gtk_box_new (GTK_ORIENTATION_HORIZONTAL, 10);
  GtkWidget *label = gtk_label_new (label_text);
  gtk_widget_add_css_class (row, "luma-save-field");
  gtk_label_set_xalign (GTK_LABEL (label), 0);
  gtk_widget_set_size_request (label, 52, -1);
  gtk_widget_set_hexpand (control, TRUE);
  gtk_box_append (GTK_BOX (row), label);
  gtk_box_append (GTK_BOX (row), control);
  gtk_accessible_update_relation (GTK_ACCESSIBLE (control),
                                  GTK_ACCESSIBLE_RELATION_LABELLED_BY, label, NULL, -1);
  return row;
}

static gboolean
same_folder (const char *a, const char *b)
{
  g_autofree char *ca = g_canonicalize_filename (a, NULL);
  g_autofree char *cb = g_canonicalize_filename (b, NULL);
  return g_str_equal (ca, cb);
}

static void
add_place (LumaSaveSheet *self, const char *label, const char *path)
{
  Place *place;
  if (path == NULL || *path == '\0')
    return;
  for (guint i = 0; i < self->places->len; i++)
    if (same_folder (((Place *) self->places->pdata[i])->path, path))
      return;
  place = g_new0 (Place, 1);
  place->label = g_strdup (label);
  place->path = g_strdup (path);
  g_ptr_array_add (self->places, place);
}

static void
build_fields (LumaSaveSheet *self)
{
  GtkWidget *fields = gtk_box_new (GTK_ORIENTATION_VERTICAL, 8);
  g_autofree char *untitled = display_name (self->document->name);
  const char *home = g_get_home_dir ();
  const char *documents = g_get_user_special_dir (G_USER_DIRECTORY_DOCUMENTS);
  const char *desktop = g_get_user_special_dir (G_USER_DIRECTORY_DESKTOP);
  g_autoptr (GPtrArray) labels = g_ptr_array_new ();

  gtk_widget_set_margin_top (fields, 16);
  gtk_widget_add_css_class (fields, "luma-save-fields");

  self->name_entry = gtk_entry_new ();
  gtk_editable_set_text (GTK_EDITABLE (self->name_entry), untitled);
  gtk_entry_set_activates_default (GTK_ENTRY (self->name_entry), FALSE);
  g_signal_connect_swapped (self->name_entry, "changed", G_CALLBACK (clear_error), self);
  self->name_row = field (S_("Name"), self->name_entry);
  gtk_box_append (GTK_BOX (fields), self->name_row);

  /* The application's own folders first, then Documents and Desktop. */
  for (guint i = 0; i < self->document->places->len; i++) {
    Place *place = self->document->places->pdata[i];
    add_place (self, place->label, place->path);
  }
  if (documents && !same_folder (documents, home))
    add_place (self, S_("Documents"), documents);
  if (desktop && !same_folder (desktop, home))
    add_place (self, S_("Desktop"), desktop);
  if (self->places->len == 0)
    add_place (self, S_("Home"), home);
  for (guint i = 0; i < self->places->len; i++)
    g_ptr_array_add (labels, ((Place *) self->places->pdata[i])->label);
  g_ptr_array_add (labels, (gpointer) S_("Other location…"));
  g_ptr_array_add (labels, NULL);
  self->place_labels = gtk_string_list_new ((const char * const *) labels->pdata);
  self->where = gtk_drop_down_new (G_LIST_MODEL (g_object_ref (self->place_labels)), NULL);
  g_signal_connect (self->where, "notify::selected", G_CALLBACK (place_selected), self);
  gtk_box_append (GTK_BOX (fields), field (S_("Where"), self->where));
  gtk_box_append (GTK_BOX (self->card), fields);
}

static void
build_list (LumaSaveSheet *self)
{
  GtkWidget *scroller = gtk_scrolled_window_new ();
  GtkWidget *listing = g_object_new (GTK_TYPE_BOX, "orientation", GTK_ORIENTATION_VERTICAL,
                                     "accessible-role", GTK_ACCESSIBLE_ROLE_LIST, NULL);

  gtk_widget_add_css_class (scroller, "luma-save-list");
  gtk_widget_set_margin_top (scroller, 14);
  gtk_scrolled_window_set_policy (GTK_SCROLLED_WINDOW (scroller), GTK_POLICY_NEVER, GTK_POLICY_AUTOMATIC);
  gtk_scrolled_window_set_propagate_natural_height (GTK_SCROLLED_WINDOW (scroller), TRUE);
  /* More than five documents scroll. */
  gtk_scrolled_window_set_max_content_height (GTK_SCROLLED_WINDOW (scroller),
                                              LIST_VISIBLE_ROWS * LIST_ROW_HEIGHT + 8);
  gtk_accessible_update_property (GTK_ACCESSIBLE (listing),
                                  GTK_ACCESSIBLE_PROPERTY_LABEL, S_("Unsaved documents"), -1);
  for (guint i = 0; i < self->documents->len; i++) {
    LumaSaveDocument *document = self->documents->pdata[i];
    g_autofree char *shown = display_name (document->name);
    g_autofree char *state = at_stake_short (document);
    g_autofree char *spoken = g_strdup_printf ("%s, %s", shown, state);
    GtkWidget *row = g_object_new (GTK_TYPE_BOX, "orientation", GTK_ORIENTATION_HORIZONTAL,
                                   "spacing", 10, "accessible-role", GTK_ACCESSIBLE_ROLE_LIST_ITEM, NULL);
    GtkWidget *name = gtk_label_new (shown);
    GtkWidget *stake = gtk_label_new (state);
    gtk_widget_add_css_class (row, "luma-save-row");
    gtk_label_set_xalign (GTK_LABEL (name), 0);
    gtk_label_set_ellipsize (GTK_LABEL (name), PANGO_ELLIPSIZE_MIDDLE);
    gtk_widget_set_hexpand (name, TRUE);
    gtk_label_set_xalign (GTK_LABEL (stake), 1);
    gtk_widget_add_css_class (stake, "luma-save-stake");
    gtk_box_append (GTK_BOX (row), name);
    gtk_box_append (GTK_BOX (row), stake);
    gtk_accessible_update_property (GTK_ACCESSIBLE (row), GTK_ACCESSIBLE_PROPERTY_LABEL, spoken, -1);
    gtk_box_append (GTK_BOX (listing), row);
  }
  gtk_scrolled_window_set_child (GTK_SCROLLED_WINDOW (scroller), listing);
  gtk_box_append (GTK_BOX (self->card), scroller);
}

static gboolean key_pressed (GtkEventControllerKey *controller, guint keyval, guint keycode,
                             GdkModifierType state, gpointer data);

static void
primary_clicked (LumaSaveSheet *self)
{
  luma_save_sheet_activate_primary (self);
}

/**
 * luma_save_sheet_new:
 * @documents: (array length=n_documents): the unsaved documents
 * @n_documents: how many; more than one asks about several when quitting
 * @quitting: the application is quitting rather than closing one window
 *
 * Most applications use #LumaSaveRequest, which also reviews several
 * documents one at a time.
 *
 * Returns: (transfer full): the sheet, not yet presented
 */
LumaSaveSheet *
luma_save_sheet_new (LumaSaveDocument * const *documents, guint n_documents, gboolean quitting)
{
  LumaSaveSheet *self;
  g_autofree char *title = NULL;
  g_autofree char *body = NULL;
  g_autofree char *discard_name = NULL;
  GtkWidget *actions, *content, *phrase, *shortcut;

  g_return_val_if_fail (documents != NULL && n_documents > 0, NULL);
  for (guint i = 0; i < n_documents; i++)
    g_return_val_if_fail (LUMA_IS_SAVE_DOCUMENT (documents[i]), NULL);

  luma_sheet_install_style ();
  self = g_object_new (LUMA_TYPE_SAVE_SHEET, NULL);
  g_object_ref_sink (self);
  for (guint i = 0; i < n_documents; i++)
    g_ptr_array_add (self->documents, g_object_ref (documents[i]));
  self->document = documents[0];
  self->several = n_documents > 1;
  self->untitled = !self->several && self->document->never_saved;
  self->quitting = quitting || self->several;

  /* 360px wide, or the window width minus 16px each side when narrower. */
  self->clamp = g_object_new (ADW_TYPE_CLAMP, "maximum-size", SHEET_WIDTH,
                              "tightening-threshold", SHEET_WIDTH,
                              "valign", GTK_ALIGN_START,
                              "margin-start", 16, "margin-end", 16, NULL);
  gtk_widget_set_parent (self->clamp, GTK_WIDGET (self));
  self->card = g_object_new (GTK_TYPE_BOX, "orientation", GTK_ORIENTATION_VERTICAL,
                             "accessible-role", GTK_ACCESSIBLE_ROLE_ALERT_DIALOG, NULL);
  gtk_widget_add_css_class (self->card, "luma-save-sheet");
  gtk_widget_add_css_class (self->card, sheet_case (self));
  adw_clamp_set_child (ADW_CLAMP (self->clamp), self->card);

  gtk_box_append (GTK_BOX (self->card), document_mark (self->several));
  words (self, &title, &body);
  gtk_box_append (GTK_BOX (self->card), wrapped_label (title, "luma-save-title", 42, &self->title));
  gtk_box_append (GTK_BOX (self->card), wrapped_label (body, "luma-save-body", 34, &self->body));

  if (self->untitled)
    build_fields (self);
  if (self->several)
    build_list (self);

  self->error = gtk_label_new (NULL);
  gtk_widget_set_visible (self->error, FALSE);
  gtk_label_set_wrap (GTK_LABEL (self->error), TRUE);
  gtk_label_set_xalign (GTK_LABEL (self->error), self->untitled ? 0 : 0.5);
  gtk_label_set_justify (GTK_LABEL (self->error), self->untitled ? GTK_JUSTIFY_LEFT : GTK_JUSTIFY_CENTER);
  gtk_widget_add_css_class (self->error, "luma-save-error");
  gtk_box_append (GTK_BOX (self->card), self->error);

  actions = self->actions = gtk_box_new (GTK_ORIENTATION_VERTICAL, 8);
  gtk_widget_set_margin_top (actions, 18);
  self->primary = gtk_button_new_with_label (self->several ? S_("Review changes…") : S_("Save"));
  gtk_widget_add_css_class (self->primary, "luma-save-primary");
  g_signal_connect_swapped (self->primary, "clicked", G_CALLBACK (primary_clicked), self);
  self->cancel = gtk_button_new_with_label (S_("Cancel"));
  gtk_widget_add_css_class (self->cancel, "luma-save-secondary");
  g_signal_connect_swapped (self->cancel, "clicked", G_CALLBACK (luma_save_sheet_activate_cancel), self);
  gtk_box_append (GTK_BOX (actions), self->primary);
  gtk_box_append (GTK_BOX (actions), self->cancel);
  gtk_box_append (GTK_BOX (self->card), actions);

  /* The destructive choice, apart and quiet: the hardest one to hit by
   * accident. The hint names its one key. */
  phrase = gtk_label_new (self->several ? S_("Discard all") : S_("Don’t save"));
  shortcut = gtk_label_new (S_("Ctrl D"));
  gtk_widget_add_css_class (shortcut, "luma-save-shortcut");
  content = gtk_box_new (GTK_ORIENTATION_HORIZONTAL, 6);
  gtk_box_append (GTK_BOX (content), phrase);
  gtk_box_append (GTK_BOX (content), shortcut);
  self->discard = g_object_new (GTK_TYPE_BUTTON, "child", content, "halign", GTK_ALIGN_CENTER, NULL);
  gtk_widget_add_css_class (self->discard, "luma-save-discard");
  g_signal_connect_swapped (self->discard, "clicked", G_CALLBACK (luma_save_sheet_activate_discard), self);
  if (self->several) {
    discard_name = several_discard_name ((LumaSaveDocument * const *) self->documents->pdata, n_documents);
  } else {
    g_autofree char *shown = display_name (self->document->name);
    discard_name = g_strdup_printf (S_("Don’t save %s"), shown);
  }
  gtk_accessible_update_property (GTK_ACCESSIBLE (self->discard),
                                  GTK_ACCESSIBLE_PROPERTY_LABEL, discard_name,
                                  GTK_ACCESSIBLE_PROPERTY_KEY_SHORTCUTS, "Control+D", -1);
  gtk_box_append (GTK_BOX (self->card), self->discard);

  /* The title names the sheet through labelled-by. The body is the
   * description as a property: a described-by relation takes precedence over
   * it, and GTK resolves that relation to an empty AT-SPI description, so a
   * screen reader would read the title alone. */
  gtk_accessible_update_property (GTK_ACCESSIBLE (self->card),
                                  GTK_ACCESSIBLE_PROPERTY_MODAL, TRUE,
                                  GTK_ACCESSIBLE_PROPERTY_DESCRIPTION, body, -1);
  gtk_accessible_update_relation (GTK_ACCESSIBLE (self->card),
                                  GTK_ACCESSIBLE_RELATION_LABELLED_BY, self->title, NULL, -1);

  self->keys = gtk_event_controller_key_new ();
  gtk_event_controller_set_name (self->keys, "luma-save-sheet-keys");
  g_signal_connect (self->keys, "key-pressed", G_CALLBACK (key_pressed), self);
  return self;
}

/* ── Places ───────────────────────────────────────────────────────────── */

static void
folder_chosen (GObject *source, GAsyncResult *result, gpointer data)
{
  LumaSaveSheet *self = data;
  g_autoptr (GFile) folder = gtk_file_dialog_select_folder_finish (GTK_FILE_DIALOG (source), result, NULL);
  g_autofree char *path = folder ? g_file_get_path (folder) : NULL;

  if (path == NULL || self->closing) {
    gtk_drop_down_set_selected (GTK_DROP_DOWN (self->where), self->previous_place);
  } else {
    g_autofree char *label = g_filename_display_basename (path);
    guint index = self->places->len;
    for (guint i = 0; i < self->places->len; i++)
      if (same_folder (((Place *) self->places->pdata[i])->path, path)) {
        index = i;
        break;
      }
    if (index == self->places->len) {
      const char *added[] = { label, NULL };
      add_place (self, label, path);
      gtk_string_list_splice (self->place_labels, index, 0, added);
    }
    gtk_drop_down_set_selected (GTK_DROP_DOWN (self->where), index);
  }
  gtk_widget_grab_focus (self->where);
  g_object_unref (self);
}

static void
place_selected (GObject *dropdown, GParamSpec *pspec, gpointer data)
{
  LumaSaveSheet *self = data;
  guint selected = gtk_drop_down_get_selected (GTK_DROP_DOWN (dropdown));
  g_autoptr (GtkFileDialog) chooser = NULL;
  g_autoptr (GFile) initial = NULL;
  (void) pspec;

  clear_error (self);
  if (selected < self->places->len) {
    self->previous_place = selected;
    return;
  }
  if (selected == GTK_INVALID_LIST_POSITION)
    return;
  /* Other location…: the system folder chooser, then back here. */
  chooser = gtk_file_dialog_new ();
  gtk_file_dialog_set_title (chooser, S_("Choose a Place"));
  gtk_file_dialog_set_modal (chooser, TRUE);
  initial = g_file_new_for_path (((Place *) self->places->pdata[self->previous_place])->path);
  gtk_file_dialog_set_initial_folder (chooser, initial);
  gtk_file_dialog_select_folder (chooser, GTK_WINDOW (gtk_widget_get_root (GTK_WIDGET (self))),
                                 NULL, folder_chosen, g_object_ref (self));
}

/* ── Presenting ───────────────────────────────────────────────────────── */

static void
focus_first (LumaSaveSheet *self)
{
  if (self->untitled && self->name_entry != NULL) {
    gtk_widget_grab_focus (self->name_entry);
    gtk_editable_select_region (GTK_EDITABLE (self->name_entry), 0, -1);
  } else {
    gtk_widget_grab_focus (self->primary);
  }
}

static gboolean
open_on_first_frame (GtkWidget *widget, GdkFrameClock *clock, gpointer data)
{
  LumaSaveSheet *self = LUMA_SAVE_SHEET (widget);
  (void) clock;
  (void) data;
  if (!self->closing) {
    gtk_widget_add_css_class (widget, "open");
    self->open = TRUE;
    focus_first (self);
  }
  return G_SOURCE_REMOVE;
}

/**
 * luma_save_sheet_present:
 * @self: a sheet
 * @window: the window that asked
 *
 * Hangs the sheet from the window's title bar and brings the window forward.
 */
void
luma_save_sheet_present (LumaSaveSheet *self, GtkWindow *window)
{
  g_return_if_fail (LUMA_IS_SAVE_SHEET (self));
  g_return_if_fail (GTK_IS_WINDOW (window));
  g_return_if_fail (!self->presented);

  self->presented = TRUE;
  self->window = window;
  g_object_add_weak_pointer (G_OBJECT (window), (gpointer *) &self->window);
  luma_window_present_sheet (window, GTK_WIDGET (self), self->keys);
  gtk_window_present (window);
  if (adw_get_enable_animations (GTK_WIDGET (self))) {
    gtk_widget_add_tick_callback (GTK_WIDGET (self), open_on_first_frame, NULL, NULL);
  } else {
    gtk_widget_add_css_class (GTK_WIDGET (self), "open");
    self->open = TRUE;
    focus_first (self);
  }
  vitals (window, "save-sheet-shown", sheet_case (self));
}

typedef struct {
  LumaSaveSheet *sheet;
  LumaSaveChoice choice;
  LumaSaveDocument *document;
  GFile *destination;
  gboolean respond;
} Closing;

static void
finish_close (Closing *closing)
{
  LumaSaveSheet *self = closing->sheet;

  self->close_source = 0;
  if (self->window != NULL
      && luma_window_get_presented_sheet (self->window) == GTK_WIDGET (self))
    luma_window_dismiss_sheet (self->window);
  g_signal_emit (self, sheet_signals[SHEET_CLOSED], 0);
  if (closing->respond)
    g_signal_emit (self, sheet_signals[SHEET_RESPONSE], 0,
                   closing->choice, closing->document, closing->destination);
  g_clear_object (&closing->document);
  g_clear_object (&closing->destination);
  g_object_unref (self);
  g_free (closing);
}

static gboolean
finish_close_later (gpointer data)
{
  finish_close (data);
  return G_SOURCE_REMOVE;
}

static void
close_sheet (LumaSaveSheet *self, gboolean respond, LumaSaveChoice choice,
             LumaSaveDocument *document, GFile *destination)
{
  Closing *closing;
  guint delay;

  if (self->closing)
    return;
  self->closing = TRUE;
  closing = g_new0 (Closing, 1);
  closing->sheet = g_object_ref (self);
  closing->respond = respond;
  closing->choice = choice;
  closing->document = document ? g_object_ref (document) : NULL;
  closing->destination = destination ? g_object_ref (destination) : NULL;
  gtk_widget_remove_css_class (GTK_WIDGET (self), "open");
  self->open = FALSE;
  delay = self->presented && adw_get_enable_animations (GTK_WIDGET (self)) ? OPEN_MS : 0;
  /* In the bar's frame the sheet slides out as it is taken down. */
  if (luma_sheet_frame_is_framed (luma_sheet_frame_get (GTK_WIDGET (self))))
    delay = 0;
  if (delay)
    self->close_source = g_timeout_add (delay, finish_close_later, closing);
  else
    finish_close (closing);
}

/* ── Choices ──────────────────────────────────────────────────────────── */

static void
set_busy (LumaSaveSheet *self, gboolean busy)
{
  self->saving = busy;
  gtk_widget_set_sensitive (self->primary, !busy);
  if (self->name_entry)
    gtk_widget_set_sensitive (self->name_entry, !busy);
  if (self->where)
    gtk_widget_set_sensitive (self->where, !busy);
}

/**
 * luma_save_sheet_activate_primary:
 * @self: a sheet
 *
 * Save, or Review changes… for several documents: as Enter or a click.
 */
void
luma_save_sheet_activate_primary (LumaSaveSheet *self)
{
  g_autoptr (GFile) destination = NULL;

  g_return_if_fail (LUMA_IS_SAVE_SHEET (self));
  if (self->closing || self->saving || !gtk_widget_get_sensitive (self->primary))
    return;
  if (self->several) {
    vitals (self->window, "save-sheet-review", sheet_case (self));
    close_sheet (self, TRUE, LUMA_SAVE_CHOICE_SAVE, NULL, NULL);
    return;
  }
  if (self->untitled) {
    guint index = MIN (gtk_drop_down_get_selected (GTK_DROP_DOWN (self->where)), self->places->len - 1);
    Place *place = self->places->pdata[index];
    g_autofree char *problem = NULL;
    destination = check_name (gtk_editable_get_text (GTK_EDITABLE (self->name_entry)),
                              place->path, place->label, self->document->extension, &problem);
    if (destination == NULL) {
      luma_save_sheet_show_error (self, problem);
      gtk_widget_grab_focus (self->name_entry);
      return;
    }
    if (g_mkdir_with_parents (place->path, 0755) != 0) {
      g_autofree char *message = g_strdup_printf (S_("%s can’t be written to. Choose another place."), place->label);
      luma_save_sheet_show_error (self, message);
      return;
    }
  }
  vitals (self->window, "save-sheet-save", sheet_case (self));
  set_busy (self, TRUE);
  g_signal_emit (self, sheet_signals[SHEET_RESPONSE], 0,
                 LUMA_SAVE_CHOICE_SAVE, self->document, destination);
}

/**
 * luma_save_sheet_finish_save:
 * @self: a sheet that answered SAVE
 * @problem: (nullable): %NULL when saved; otherwise why it could not be, in a
 *   sentence the person can act on. The sheet stays up to try again.
 */
void
luma_save_sheet_finish_save (LumaSaveSheet *self, const char *problem)
{
  g_return_if_fail (LUMA_IS_SAVE_SHEET (self));
  if (self->closing)
    return;
  set_busy (self, FALSE);
  if (problem != NULL) {
    luma_save_sheet_show_error (self, *problem ? problem : S_("It could not be saved."));
    gtk_widget_grab_focus (self->name_entry ? self->name_entry : self->primary);
    return;
  }
  close_sheet (self, FALSE, LUMA_SAVE_CHOICE_SAVE, NULL, NULL);
}

/**
 * luma_save_sheet_activate_cancel:
 * @self: a sheet
 *
 * Cancel: as Escape or a click. Nothing is saved or discarded.
 */
void
luma_save_sheet_activate_cancel (LumaSaveSheet *self)
{
  g_return_if_fail (LUMA_IS_SAVE_SHEET (self));
  if (self->closing)
    return;
  vitals (self->window, "save-sheet-cancel", sheet_case (self));
  close_sheet (self, TRUE, LUMA_SAVE_CHOICE_CANCEL, self->several ? NULL : self->document, NULL);
}

/**
 * luma_save_sheet_activate_discard:
 * @self: a sheet
 *
 * Don't save, or Discard all: as Ctrl+D or a click.
 */
void
luma_save_sheet_activate_discard (LumaSaveSheet *self)
{
  g_return_if_fail (LUMA_IS_SAVE_SHEET (self));
  if (self->closing || self->saving)
    return;
  vitals (self->window, "save-sheet-discard", sheet_case (self));
  if (self->several)
    close_sheet (self, TRUE, LUMA_SAVE_CHOICE_QUIT, NULL, NULL);
  else
    close_sheet (self, TRUE, LUMA_SAVE_CHOICE_DISCARD, self->document, NULL);
}

/**
 * luma_save_sheet_show_error:
 * @self: a sheet
 * @message: what went wrong, shown under the fields and announced
 */
void
luma_save_sheet_show_error (LumaSaveSheet *self, const char *message)
{
  g_return_if_fail (LUMA_IS_SAVE_SHEET (self));
  gtk_label_set_label (GTK_LABEL (self->error), message);
  gtk_widget_set_visible (self->error, TRUE);
  if (self->untitled) {
    gtk_widget_add_css_class (self->name_row, "error");
    gtk_accessible_update_state (GTK_ACCESSIBLE (self->name_entry),
                                 GTK_ACCESSIBLE_STATE_INVALID, GTK_ACCESSIBLE_INVALID_TRUE, -1);
    gtk_accessible_update_property (GTK_ACCESSIBLE (self->name_entry),
                                    GTK_ACCESSIBLE_PROPERTY_DESCRIPTION, message, -1);
  }
  gtk_accessible_announce (GTK_ACCESSIBLE (self->card), message,
                           GTK_ACCESSIBLE_ANNOUNCEMENT_PRIORITY_HIGH);
}

static void
clear_error (LumaSaveSheet *self)
{
  if (!gtk_widget_get_visible (self->error))
    return;
  gtk_widget_set_visible (self->error, FALSE);
  if (self->untitled) {
    gtk_widget_remove_css_class (self->name_row, "error");
    gtk_accessible_update_state (GTK_ACCESSIBLE (self->name_entry),
                                 GTK_ACCESSIBLE_STATE_INVALID, GTK_ACCESSIBLE_INVALID_FALSE, -1);
    gtk_accessible_reset_property (GTK_ACCESSIBLE (self->name_entry),
                                   GTK_ACCESSIBLE_PROPERTY_DESCRIPTION);
  }
}

/* ── Keys ─────────────────────────────────────────────────────────────── */

static gboolean
focus_within (GtkWidget *focus, GtkWidget *widget)
{
  return widget != NULL && focus != NULL && (focus == widget || gtk_widget_is_ancestor (focus, widget));
}

static void
focus_chain (LumaSaveSheet *self, GPtrArray *chain)
{
  GtkWidget *all[] = { self->name_entry, self->where, self->primary, self->other, self->cancel, self->discard };
  for (guint i = 0; i < G_N_ELEMENTS (all); i++)
    if (all[i] != NULL && gtk_widget_get_visible (all[i]) && gtk_widget_is_sensitive (all[i]))
      g_ptr_array_add (chain, all[i]);
}

static gboolean
key_pressed (GtkEventControllerKey *controller, guint keyval, guint keycode,
             GdkModifierType state, gpointer data)
{
  LumaSaveSheet *self = data;
  GdkEvent *event = gtk_event_controller_get_current_event (GTK_EVENT_CONTROLLER (controller));
  GtkNative *native = gtk_widget_get_native (GTK_WIDGET (self));
  GtkRoot *root = gtk_widget_get_root (GTK_WIDGET (self));
  GtkWidget *focus = root ? gtk_root_get_focus (root) : NULL;
  GdkModifierType modifiers = state & (GDK_CONTROL_MASK | GDK_ALT_MASK | GDK_SUPER_MASK
                                       | GDK_SHIFT_MASK | GDK_META_MASK);
  (void) keycode;

  if (self->closing)
    return TRUE;
  /* A menu opened from the sheet (Where) takes its own keys. */
  if (event != NULL && native != NULL && gdk_event_get_surface (event) != gtk_native_get_surface (native))
    return FALSE;

  if (keyval == GDK_KEY_Escape && !modifiers) {
    luma_save_sheet_activate_cancel (self);
    return TRUE;
  }
  if ((keyval == GDK_KEY_d || keyval == GDK_KEY_D) && modifiers == GDK_CONTROL_MASK) {
    luma_save_sheet_activate_discard (self);
    return TRUE;
  }
  if ((keyval == GDK_KEY_Return || keyval == GDK_KEY_KP_Enter || keyval == GDK_KEY_ISO_Enter)
      && !(modifiers & ~GDK_SHIFT_MASK)) {
    /* Enter answers with the primary, except on a control that has its own
     * answer: Cancel, Don't save, and the Where menu. */
    if (focus_within (focus, self->cancel) || focus_within (focus, self->discard)
        || focus_within (focus, self->other) || focus_within (focus, self->where))
      return FALSE;
    luma_save_sheet_activate_primary (self);
    return TRUE;
  }
  if ((keyval == GDK_KEY_Tab || keyval == GDK_KEY_ISO_Left_Tab || keyval == GDK_KEY_KP_Tab)
      && !(modifiers & ~GDK_SHIFT_MASK)) {
    g_autoptr (GPtrArray) chain = g_ptr_array_new ();
    int step = (keyval == GDK_KEY_ISO_Left_Tab || (modifiers & GDK_SHIFT_MASK)) ? -1 : 1;
    int index = -1;
    focus_chain (self, chain);
    if (chain->len == 0)
      return TRUE;
    for (guint i = 0; i < chain->len; i++)
      if (focus_within (focus, chain->pdata[i])) {
        index = (int) i;
        break;
      }
    if (index < 0)
      index = step > 0 ? 0 : (int) chain->len - 1;
    else
      index = (index + step + (int) chain->len) % (int) chain->len;
    gtk_widget_grab_focus (chain->pdata[index]);
    return TRUE;
  }
  return FALSE;
}

/* ── Accessors ────────────────────────────────────────────────────────── */

const char *
luma_save_sheet_get_case (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return sheet_case (self);
}

gboolean
luma_save_sheet_get_open (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), FALSE);
  return self->open;
}

/**
 * luma_save_sheet_get_title_label:
 * @self: a sheet
 *
 * Returns: (transfer none): the title
 */
GtkLabel *
luma_save_sheet_get_title_label (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return GTK_LABEL (self->title);
}

/**
 * luma_save_sheet_get_body_label:
 * @self: a sheet
 *
 * Returns: (transfer none): the body
 */
GtkLabel *
luma_save_sheet_get_body_label (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return GTK_LABEL (self->body);
}

/**
 * luma_save_sheet_get_error_label:
 * @self: a sheet
 *
 * Returns: (transfer none): the inline error
 */
GtkLabel *
luma_save_sheet_get_error_label (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return GTK_LABEL (self->error);
}

/**
 * luma_save_sheet_get_primary_button:
 * @self: a sheet
 *
 * Returns: (transfer none): Save or Review changes…
 */
GtkButton *
luma_save_sheet_get_primary_button (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return GTK_BUTTON (self->primary);
}

/**
 * luma_save_sheet_get_cancel_button:
 * @self: a sheet
 *
 * Returns: (transfer none): Cancel
 */
GtkButton *
luma_save_sheet_get_cancel_button (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return GTK_BUTTON (self->cancel);
}

/**
 * luma_save_sheet_get_discard_button:
 * @self: a sheet
 *
 * Returns: (transfer none): Don't save or Discard all
 */
GtkButton *
luma_save_sheet_get_discard_button (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return GTK_BUTTON (self->discard);
}

static void
other_clicked (LumaSaveSheet *self)
{
  if (self->closing || self->saving)
    return;
  vitals (self->window, "save-sheet-other", sheet_case (self));
  close_sheet (self, TRUE, LUMA_SAVE_CHOICE_OTHER, self->several ? NULL : self->document, NULL);
}

/**
 * luma_save_sheet_add_choice:
 * @self: a sheet, not yet presented
 * @label: the choice, named for what it does ("Start Over")
 *
 * A second answer beside the primary, of equal weight: on a phone it stands
 * on the left of the primary, with Cancel as a quiet row beneath. Choosing it
 * closes the sheet and answers %LUMA_SAVE_CHOICE_OTHER.
 *
 * Returns: (transfer none): the button
 */
GtkButton *
luma_save_sheet_add_choice (LumaSaveSheet *self, const char *label)
{
  GtkWidget *button;
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  g_return_val_if_fail (label != NULL, NULL);
  g_return_val_if_fail (self->other == NULL && !self->presented, NULL);
  button = self->other = gtk_button_new_with_label (label);
  gtk_widget_add_css_class (button, "luma-save-secondary");
  luma_sheet_button_set_role (button, LUMA_SHEET_ROLE_SECONDARY);
  g_signal_connect_swapped (button, "clicked", G_CALLBACK (other_clicked), self);
  gtk_box_insert_child_after (GTK_BOX (self->actions), button, self->primary);
  return GTK_BUTTON (button);
}

/**
 * luma_save_sheet_get_name_entry:
 * @self: a sheet
 *
 * Returns: (transfer none) (nullable): Name, untitled only
 */
GtkEntry *
luma_save_sheet_get_name_entry (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return self->name_entry ? GTK_ENTRY (self->name_entry) : NULL;
}

/**
 * luma_save_sheet_get_where:
 * @self: a sheet
 *
 * Returns: (transfer none) (nullable): Where, untitled only
 */
GtkDropDown *
luma_save_sheet_get_where (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return self->where ? GTK_DROP_DOWN (self->where) : NULL;
}

/**
 * luma_save_sheet_get_card:
 * @self: a sheet
 *
 * Returns: (transfer none): the sheet's card
 */
GtkWidget *
luma_save_sheet_get_card (LumaSaveSheet *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_SHEET (self), NULL);
  return self->card;
}


/**
 * luma_save_sheet_get_for_window:
 * @window: a window
 *
 * Returns: (transfer none) (nullable): the save sheet hanging from it
 */
LumaSaveSheet *
luma_save_sheet_get_for_window (GtkWindow *window)
{
  GtkWidget *sheet = luma_window_get_presented_sheet (window);
  return LUMA_IS_SAVE_SHEET (sheet) ? LUMA_SAVE_SHEET (sheet) : NULL;
}

/* ── LumaSaveRequest ──────────────────────────────────────────────────── */

struct _LumaSaveRequest {
  GObject parent_instance;
  GPtrArray *documents;
  gboolean quitting;
  GWeakRef fallback;
  LumaSaveSheet *sheet;       /* the sheet up now */
  gulong response_id;
  int review;                 /* -1: not reviewing; else the document asked about */
  gboolean active;
};

enum { REQUEST_RESPONSE, N_REQUEST_SIGNALS };
static guint request_signals[N_REQUEST_SIGNALS];

G_DEFINE_FINAL_TYPE (LumaSaveRequest, luma_save_request, G_TYPE_OBJECT)

static void
detach_sheet (LumaSaveRequest *self)
{
  if (self->sheet == NULL)
    return;
  g_clear_signal_handler (&self->response_id, self->sheet);
  g_clear_object (&self->sheet);
}

static void
luma_save_request_dispose (GObject *object)
{
  LumaSaveRequest *self = LUMA_SAVE_REQUEST (object);
  detach_sheet (self);
  G_OBJECT_CLASS (luma_save_request_parent_class)->dispose (object);
}

static void
luma_save_request_finalize (GObject *object)
{
  LumaSaveRequest *self = LUMA_SAVE_REQUEST (object);
  g_ptr_array_unref (self->documents);
  g_weak_ref_clear (&self->fallback);
  G_OBJECT_CLASS (luma_save_request_parent_class)->finalize (object);
}

static void
luma_save_request_class_init (LumaSaveRequestClass *klass)
{
  G_OBJECT_CLASS (klass)->dispose = luma_save_request_dispose;
  G_OBJECT_CLASS (klass)->finalize = luma_save_request_finalize;
  /**
   * LumaSaveRequest::response:
   * @request: the request
   * @choice: what the person chose
   * @document: (nullable): the document it is about
   * @destination: (nullable): for an untitled document, the file to write
   *
   * One document: SAVE (call luma_save_request_finish_save() once written, or
   * with the problem), DISCARD or CANCEL. Several: while reviewing, SAVE or
   * DISCARD for each document in turn; CANCEL at any point stops the quit;
   * QUIT once every document is answered, or after Discard all.
   */
  request_signals[REQUEST_RESPONSE] =
    g_signal_new ("response", G_TYPE_FROM_CLASS (klass), G_SIGNAL_RUN_LAST,
                  0, NULL, NULL, NULL, G_TYPE_NONE, 3,
                  LUMA_TYPE_SAVE_CHOICE, LUMA_TYPE_SAVE_DOCUMENT, G_TYPE_FILE);
}

static void
luma_save_request_init (LumaSaveRequest *self)
{
  self->documents = g_ptr_array_new_with_free_func (g_object_unref);
  self->review = -1;
  g_weak_ref_init (&self->fallback, NULL);
}

/**
 * luma_save_request_new:
 * @documents: (array length=n_documents): the unsaved documents
 * @n_documents: how many
 * @quitting: the application is quitting
 *
 * Returns: (transfer full): a request; connect #LumaSaveRequest::response,
 *   then luma_save_request_present()
 */
LumaSaveRequest *
luma_save_request_new (LumaSaveDocument * const *documents, guint n_documents, gboolean quitting)
{
  LumaSaveRequest *self;
  g_return_val_if_fail (documents != NULL && n_documents > 0, NULL);
  self = g_object_new (LUMA_TYPE_SAVE_REQUEST, NULL);
  for (guint i = 0; i < n_documents; i++) {
    g_return_val_if_fail (LUMA_IS_SAVE_DOCUMENT (documents[i]), self);
    g_ptr_array_add (self->documents, g_object_ref (documents[i]));
  }
  self->quitting = quitting || n_documents > 1;
  return self;
}

static void finish (LumaSaveRequest *self, LumaSaveChoice choice, LumaSaveDocument *document, GFile *destination);
static void ask (LumaSaveRequest *self, LumaSaveDocument * const *documents, guint n, GtkWindow *window);
static void review_next (LumaSaveRequest *self);

static void
emit (LumaSaveRequest *self, LumaSaveChoice choice, LumaSaveDocument *document, GFile *destination)
{
  g_signal_emit (self, request_signals[REQUEST_RESPONSE], 0, choice, document, destination);
}

static void
finish (LumaSaveRequest *self, LumaSaveChoice choice, LumaSaveDocument *document, GFile *destination)
{
  gboolean was_active = self->active;
  self->active = FALSE;
  detach_sheet (self);
  emit (self, choice, document, destination);
  if (was_active)
    g_object_unref (self);
}

static void
sheet_answered (LumaSaveSheet *sheet, LumaSaveChoice choice, LumaSaveDocument *document,
                GFile *destination, gpointer data)
{
  LumaSaveRequest *self = data;
  (void) sheet;

  if (self->review < 0 && self->documents->len > 1) {
    /* The several sheet: Review changes…, Discard all, or Cancel. */
    if (choice == LUMA_SAVE_CHOICE_SAVE) {
      detach_sheet (self);
      self->review = 0;
      review_next (self);
    } else {
      finish (self, choice, NULL, NULL);
    }
    return;
  }
  if (choice == LUMA_SAVE_CHOICE_CANCEL) {
    finish (self, LUMA_SAVE_CHOICE_CANCEL, document, NULL);
    return;
  }
  if (choice == LUMA_SAVE_CHOICE_SAVE) {
    /* The sheet stays up, busy, until luma_save_request_finish_save(). */
    emit (self, choice, document, destination);
    return;
  }
  /* DISCARD. */
  if (self->review < 0) {
    finish (self, choice, document, NULL);
    return;
  }
  detach_sheet (self);
  emit (self, choice, document, NULL);
  self->review++;
  review_next (self);
}

static GtkWindow *
window_for (LumaSaveRequest *self, LumaSaveDocument *document)
{
  GtkWindow *window = luma_save_document_get_window (document);
  g_autoptr (GtkWindow) fallback = NULL;
  if (window != NULL && gtk_widget_get_realized (GTK_WIDGET (window)))
    return window;
  fallback = g_weak_ref_get (&self->fallback);
  if (fallback != NULL && gtk_widget_get_realized (GTK_WIDGET (fallback)))
    return fallback;
  /* Any window of the quit that is still open. */
  for (guint i = 0; i < self->documents->len; i++) {
    GtkWindow *other = luma_save_document_get_window (self->documents->pdata[i]);
    if (other != NULL && gtk_widget_get_realized (GTK_WIDGET (other)))
      return other;
  }
  return NULL;
}

static void
review_next (LumaSaveRequest *self)
{
  LumaSaveDocument *document;
  GtkWindow *window;

  if ((guint) self->review >= self->documents->len) {
    finish (self, LUMA_SAVE_CHOICE_QUIT, NULL, NULL);
    return;
  }
  document = self->documents->pdata[self->review];
  window = window_for (self, document);
  if (window == NULL) {
    /* Nowhere left to ask: keep the work rather than guess. */
    finish (self, LUMA_SAVE_CHOICE_CANCEL, document, NULL);
    return;
  }
  ask (self, &document, 1, window);
}

static void
ask (LumaSaveRequest *self, LumaSaveDocument * const *documents, guint n, GtkWindow *window)
{
  LumaSaveSheet *existing = luma_save_sheet_get_for_window (window);
  if (existing != NULL)
    luma_save_sheet_activate_cancel (existing);
  self->sheet = luma_save_sheet_new (documents, n, self->quitting);
  self->response_id = g_signal_connect (self->sheet, "response", G_CALLBACK (sheet_answered), self);
  luma_save_sheet_present (self->sheet, window);
}

/**
 * luma_save_request_present:
 * @self: a request
 * @window: the window that asked
 *
 * One document asks in @window. Several ask once in @window; Review changes…
 * then brings each document's own window forward in turn and asks there. If
 * @window already shows a save sheet, that sheet is focused instead and this
 * request answers CANCEL.
 */
void
luma_save_request_present (LumaSaveRequest *self, GtkWindow *window)
{
  LumaSaveSheet *existing;

  g_return_if_fail (LUMA_IS_SAVE_REQUEST (self));
  g_return_if_fail (GTK_IS_WINDOW (window));
  g_return_if_fail (!self->active);

  existing = luma_save_sheet_get_for_window (window);
  if (existing != NULL && !existing->closing) {
    focus_first (existing);
    gtk_window_present (window);
    emit (self, LUMA_SAVE_CHOICE_CANCEL, NULL, NULL);
    return;
  }
  g_weak_ref_set (&self->fallback, window);
  self->active = TRUE;
  g_object_ref (self); /* Alive until answered. */
  ask (self, (LumaSaveDocument * const *) self->documents->pdata, self->documents->len, window);
}

/**
 * luma_save_request_finish_save:
 * @self: a request that answered SAVE
 * @problem: (nullable): %NULL once the document is written; otherwise why it
 *   could not be, shown on the sheet, which stays up
 */
void
luma_save_request_finish_save (LumaSaveRequest *self, const char *problem)
{
  LumaSaveSheet *sheet;
  g_return_if_fail (LUMA_IS_SAVE_REQUEST (self));
  if (self->sheet == NULL)
    return;
  sheet = g_object_ref (self->sheet);
  luma_save_sheet_finish_save (sheet, problem);
  if (problem == NULL) {
    if (self->review >= 0) {
      detach_sheet (self);
      self->review++;
      review_next (self);
    } else {
      self->active = FALSE;
      detach_sheet (self);
      g_object_unref (self);
    }
  }
  g_object_unref (sheet);
}

/**
 * luma_save_request_cancel:
 * @self: a request
 *
 * Takes the sheet down as Cancel would, for an application that must stop
 * asking (its window is going away for another reason).
 */
void
luma_save_request_cancel (LumaSaveRequest *self)
{
  g_return_if_fail (LUMA_IS_SAVE_REQUEST (self));
  if (self->sheet != NULL)
    luma_save_sheet_activate_cancel (self->sheet);
}

/**
 * luma_save_request_get_sheet:
 * @self: a request
 *
 * Returns: (transfer none) (nullable): the sheet up now
 */
LumaSaveSheet *
luma_save_request_get_sheet (LumaSaveRequest *self)
{
  g_return_val_if_fail (LUMA_IS_SAVE_REQUEST (self), NULL);
  return self->sheet;
}
