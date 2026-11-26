/* SPDX-License-Identifier: Apache-2.0 */
/* Window sheets and the destructive confirm on a phone, a landscape phone and
 * a tablet: the sheet in the bar's frame (luma-sheet-private.h), its button
 * layout from roles, its swipe and its motion; the desktop sheet unchanged.
 *
 * With LUMA_SHEET_CAPTURE=<dir> it renders the conform captures instead
 * (scenario phone-sheet): <dir>/ol-<sheet>-<size>-<theme>.png at scale 2 and
 * <dir>/geometry-<theme>.json, in CSS px. LUMA_SHEET_CAPTURE_THEME is light
 * or dark. With LUMA_SHEET_RECORD=<dir> it records the rise, a swipe dismiss
 * and Reduce Motion at 390 × 844, every drawn frame as a PNG named by its
 * frame-clock time, with frames.csv (time, travel, sheet opacity). */
#include "luma-ui.h"
#include "luma-destructive-dialog.h"
#include "luma-sheet-private.h"

#include <math.h>

typedef enum { SHEET_CONTINUE, SHEET_SAVE, SHEET_DELETE, SHEET_LONG, N_SHEETS } Sheet;
static const char *const sheet_names[] = { "continue", "save", "delete", "long" };

typedef struct {
  GtkWidget *window;
  GtkWidget *content;
  GtkWidget *mover; /* the frame's overlay child */
  GtkWidget *card;
  GtkWidget *title, *body;
  LumaSaveSheet *save;
  LumaDestructiveDialog *dialog;
  int responses;
  LumaSaveChoice last;
  int cancelled;
} Shown;

static gboolean stop (gpointer data) { *(gboolean *) data = TRUE; return G_SOURCE_REMOVE; }

static void
spin (guint ms)
{
  gboolean done = FALSE;
  g_timeout_add (ms, stop, &done);
  while (!done)
    g_main_context_iteration (NULL, TRUE);
}

static LumaSheetFrame *
frame_of (Shown *shown)
{
  return luma_sheet_frame_get (shown->mover);
}

/* Until the sheet stops moving (or 2 s). */
static void
settle (Shown *shown)
{
  /* Reduce Motion: no travel, only the 150 ms fade. */
  if (luma_ui_reduced_motion () && frame_of (shown) != NULL
      && luma_sheet_frame_get_offset (frame_of (shown)) == 0) {
    spin (190);
    return;
  }
  for (int i = 0; i < 100; i++) {
    LumaSheetFrame *frame = frame_of (shown);
    spin (20);
    if (frame == NULL || !luma_sheet_frame_is_moving (frame))
      break;
  }
  spin (60);
}

static void
device (const char *form_factor, const char *device_class)
{
  g_setenv ("LUMA_POSTURE", "desktop", TRUE);
  if (form_factor)
    g_setenv ("LUMA_FORM_FACTOR", form_factor, TRUE);
  else
    g_unsetenv ("LUMA_FORM_FACTOR");
  g_setenv ("LUMA_DEVICE_CLASS", device_class, TRUE);
}

static GtkWidget *
find_class (GtkWidget *widget, const char *css)
{
  if (gtk_widget_has_css_class (widget, css))
    return widget;
  for (GtkWidget *child = gtk_widget_get_first_child (widget); child; child = gtk_widget_get_next_sibling (child)) {
    GtkWidget *found = find_class (child, css);
    if (found)
      return found;
  }
  return NULL;
}

static GtkWidget *
window_new (int width, int height)
{
  GtkWidget *window = gtk_window_new ();
  GtkWidget *content = gtk_box_new (GTK_ORIENTATION_VERTICAL, 0);
  GtkWidget *header = adw_header_bar_new ();
  GtkWidget *page = gtk_box_new (GTK_ORIENTATION_VERTICAL, 12);
  GtkWidget *heading = gtk_label_new ("Library");
  gtk_window_set_decorated (GTK_WINDOW (window), FALSE);
  gtk_window_set_default_size (GTK_WINDOW (window), width, height);
  gtk_label_set_xalign (GTK_LABEL (heading), 0);
  gtk_widget_add_css_class (heading, "title-1");
  gtk_widget_set_margin_start (page, 20);
  gtk_widget_set_margin_top (page, 20);
  gtk_widget_set_vexpand (page, TRUE);
  gtk_box_append (GTK_BOX (page), heading);
  gtk_box_append (GTK_BOX (content), header);
  gtk_box_append (GTK_BOX (content), page);
  gtk_window_set_child (GTK_WINDOW (window), content);
  gtk_window_present (GTK_WINDOW (window));
  spin (100);
  return window;
}

static void
save_answered (LumaSaveSheet *sheet, LumaSaveChoice choice, LumaSaveDocument *document, GFile *destination,
               gpointer data)
{
  Shown *shown = data;
  (void) sheet;
  (void) document;
  (void) destination;
  shown->responses++;
  shown->last = choice;
}

static void
dialog_cancelled (LumaDestructiveDialog *dialog, gpointer data)
{
  (void) dialog;
  ((Shown *) data)->cancelled++;
}

static void
set_words (GtkLabel *label, const char *text)
{
  gtk_label_set_label (label, text);
}

static void
phrase (GtkWidget *button, const char *text)
{
  /* The discard button's words are its first label (the key hint follows). */
  GtkWidget *label = find_class (button, "luma-save-shortcut");
  GtkWidget *box = gtk_button_get_child (GTK_BUTTON (button));
  (void) label;
  gtk_label_set_label (GTK_LABEL (gtk_widget_get_first_child (box)), text);
}

static void
show (Shown *shown, Sheet sheet)
{
  if (sheet == SHEET_DELETE) {
    shown->dialog = luma_destructive_dialog_ask (shown->content, "Delete this save state?", "This can’t be undone.",
                                                 "Delete", NULL, NULL);
    g_assert_nonnull (shown->dialog);
    g_signal_connect (shown->dialog, "cancelled", G_CALLBACK (dialog_cancelled), shown);
    shown->mover = shown->card = GTK_WIDGET (shown->dialog);
    shown->title = find_class (shown->card, "lumaui-dialog-title");
    shown->body = find_class (shown->card, "lumaui-dialog-body");
  } else {
    LumaSaveDocument *game = luma_save_document_new ("The Minish Cap");
    shown->save = luma_save_sheet_new (&game, 1, FALSE);
    g_object_unref (game);
    if (sheet == SHEET_CONTINUE) {
      set_words (luma_save_sheet_get_title_label (shown->save), "Continue from your quick save?");
      set_words (luma_save_sheet_get_body_label (shown->save), "Minish Cap was saved when you closed it.");
      gtk_button_set_label (luma_save_sheet_get_primary_button (shown->save), "Continue");
      luma_save_sheet_add_choice (shown->save, "Start Over");
      gtk_widget_set_visible (GTK_WIDGET (luma_save_sheet_get_discard_button (shown->save)), FALSE);
    } else {
      set_words (luma_save_sheet_get_title_label (shown->save), "Save before closing?");
      if (sheet == SHEET_LONG) {
        GString *words = g_string_new ("The Minish Cap · 1 h 12 min played.");
        for (int i = 0; i < 40; i++)
          g_string_append (words, " The quick save keeps the room, the items and the time of day.");
        set_words (luma_save_sheet_get_body_label (shown->save), words->str);
        g_string_free (words, TRUE);
      } else {
        set_words (luma_save_sheet_get_body_label (shown->save), "The Minish Cap · 1 h 12 min played");
      }
      phrase (GTK_WIDGET (luma_save_sheet_get_discard_button (shown->save)), "Don’t Save");
    }
    g_signal_connect (shown->save, "response", G_CALLBACK (save_answered), shown);
    luma_save_sheet_present (shown->save, GTK_WINDOW (shown->window));
    shown->mover = GTK_WIDGET (shown->save);
    shown->card = luma_save_sheet_get_card (shown->save);
    shown->title = GTK_WIDGET (luma_save_sheet_get_title_label (shown->save));
    shown->body = GTK_WIDGET (luma_save_sheet_get_body_label (shown->save));
  }
  settle (shown);
}

static Shown *
shown_new (int width, int height, Sheet sheet)
{
  Shown *shown = g_new0 (Shown, 1);
  shown->window = window_new (width, height);
  shown->content = gtk_window_get_child (GTK_WINDOW (shown->window));
  show (shown, sheet);
  return shown;
}

/* Take the sheet down and wait until it has left. */
static void
shown_close (Shown *shown)
{
  gboolean motion = !luma_ui_reduced_motion ();
  if (shown->save != NULL) {
    if (luma_save_sheet_get_open (shown->save))
      luma_save_sheet_activate_cancel (shown->save);
    g_clear_object (&shown->save);
  }
  if (shown->dialog != NULL && luma_layer_host_get_modal (luma_layer_host_window_host (shown->content)) != NULL)
    luma_destructive_dialog_close (shown->dialog);
  shown->dialog = NULL;
  spin (motion ? 330 : 30);
  shown->responses = shown->cancelled = 0;
}

static void
shown_free (Shown *shown)
{
  shown_close (shown);
  gtk_window_destroy (GTK_WINDOW (shown->window));
  spin (30);
  g_free (shown);
}

/* Geometry needs no motion: Reduce Motion makes the sheets settle in 150 ms. */
static void
calm (gboolean on)
{
  g_object_set (gtk_settings_get_default (), "gtk-enable-animations", !on, NULL);
}

static graphene_rect_t
bounds (Shown *shown, GtkWidget *widget)
{
  graphene_rect_t rect;
  g_assert_true (gtk_widget_compute_bounds (widget, shown->window, &rect));
  return rect;
}

#define assert_near(a, b) g_assert_cmpfloat_with_epsilon ((double) (a), (double) (b), 1.01)

/* The foot's buttons, the row first, then the quiet rows. */
static GPtrArray *
foot_buttons (Shown *shown)
{
  GPtrArray *buttons = g_ptr_array_new ();
  GtkWidget *foot = find_class (shown->card, "luma-sheet-frame-foot");
  g_assert_nonnull (foot);
  for (GtkWidget *child = gtk_widget_get_first_child (foot); child; child = gtk_widget_get_next_sibling (child)) {
    if (GTK_IS_BUTTON (child)) {
      if (gtk_widget_get_visible (child))
        g_ptr_array_add (buttons, child);
      continue;
    }
    for (GtkWidget *b = gtk_widget_get_first_child (child); b; b = gtk_widget_get_next_sibling (b))
      if (GTK_IS_BUTTON (b) && gtk_widget_get_visible (b))
        g_ptr_array_add (buttons, b);
  }
  return buttons;
}

static const char *
button_words (GtkWidget *button)
{
  GtkWidget *child = gtk_button_get_child (GTK_BUTTON (button));
  if (GTK_IS_LABEL (child))
    return gtk_label_get_label (GTK_LABEL (child));
  if (child != NULL && GTK_IS_LABEL (gtk_widget_get_first_child (child)))
    return gtk_label_get_label (GTK_LABEL (gtk_widget_get_first_child (child)));
  return gtk_button_get_label (GTK_BUTTON (button));
}

static const char *
button_kind (GtkWidget *button)
{
  if (gtk_widget_has_css_class (button, "luma-sheet-key"))
    return "key";
  if (gtk_widget_has_css_class (button, "luma-sheet-danger"))
    return "danger";
  if (gtk_widget_has_css_class (button, "luma-sheet-fill"))
    return "fill";
  if (gtk_widget_has_css_class (button, "luma-sheet-quiet-destructive"))
    return "quiet red";
  if (gtk_widget_has_css_class (button, "luma-sheet-quiet"))
    return "quiet";
  return "?";
}

/* The sheet's corner is cut round: its top-left pixel is clear, its middle is not. */
static void
assert_round (GtkWidget *card)
{
  GdkPaintable *paintable = gtk_widget_paintable_new (card);
  int width = gtk_widget_get_width (card), height = gtk_widget_get_height (card);
  GtkSnapshot *snapshot = gtk_snapshot_new ();
  GskRenderNode *node;
  GskRenderer *renderer = gtk_native_get_renderer (gtk_widget_get_native (card));
  GdkTexture *texture;
  GdkTextureDownloader *downloader;
  g_autofree guchar *pixels = NULL;
  gsize stride;
  gdk_paintable_snapshot (paintable, snapshot, width, height);
  node = gtk_snapshot_free_to_node (snapshot);
  g_assert_nonnull (node);
  texture = gsk_renderer_render_texture (renderer, node, &GRAPHENE_RECT_INIT (0, 0, width, height));
  downloader = gdk_texture_downloader_new (texture);
  gdk_texture_downloader_set_format (downloader, GDK_MEMORY_R8G8B8A8);
  stride = width * 4;
  pixels = g_malloc (stride * height);
  gdk_texture_downloader_download_into (downloader, pixels, stride);
  /* 26 round: (2, 2) is outside the curve; (13, 13) is on the sheet. */
  g_assert_cmpint (pixels[2 * stride + 2 * 4 + 3], <, 40);
  g_assert_cmpint (pixels[(height / 2) * stride + (width / 2) * 4 + 3], >, 240);
  g_assert_cmpint (pixels[(height - 3) * stride + 2 * 4 + 3], <, 40); /* round at the foot too */
  gdk_texture_downloader_free (downloader);
  g_object_unref (texture);
  gsk_render_node_unref (node);
  g_object_unref (paintable);
}

static void
dump (Shown *shown, GtkWidget *widget, int depth)
{
  graphene_rect_t r;
  g_auto (GStrv) classes = gtk_widget_get_css_classes (widget);
  g_autofree char *joined = g_strjoinv (".", classes);
  if (!gtk_widget_compute_bounds (widget, shown->window, &r))
    r = GRAPHENE_RECT_INIT (-1, -1, -1, -1);
  int min_h = 0, nat_h = 0;
  if (gtk_widget_get_visible (widget) && r.size.width > 0)
    gtk_widget_measure (widget, GTK_ORIENTATION_VERTICAL, (int) r.size.width, &min_h, &nat_h, NULL, NULL);
  g_test_message ("%*s%s.%s %s %.0f,%.0f %.0fx%.0f (h min %d nat %d)", depth * 2, "", G_OBJECT_TYPE_NAME (widget),
                  joined, gtk_widget_get_visible (widget) ? "" : "(hidden)", r.origin.x, r.origin.y, r.size.width,
                  r.size.height, min_h, nat_h);
  if (GTK_IS_LABEL (widget)) {
    PangoLayout *layout = gtk_label_get_layout (GTK_LABEL (widget));
    PangoRectangle logical;
    g_autofree char *font = pango_font_description_to_string (
        pango_context_get_font_description (gtk_widget_get_pango_context (widget)));
    g_autofree char *attrs = pango_layout_get_attributes (layout)
        ? pango_attr_list_to_string (pango_layout_get_attributes (layout)) : g_strdup ("-");
    pango_layout_get_pixel_extents (layout, NULL, &logical);
    g_test_message ("%*s  font '%s' lines %d logical %dx%d attrs %s", depth * 2, "", font,
                    pango_layout_get_line_count (layout), logical.width, logical.height, attrs);
  }
  if (depth < 7)
    for (GtkWidget *c = gtk_widget_get_first_child (widget); c; c = gtk_widget_get_next_sibling (c))
      dump (shown, c, depth + 1);
}

static void
check_frame (Shown *shown, Sheet sheet, int width, int height)
{
  if (g_getenv ("LUMA_SHEET_DUMP"))
    dump (shown, shown->mover, 0);
  LumaSheetFrame *frame = frame_of (shown);
  graphene_rect_t card, title, body, scroll;
  g_autoptr (GPtrArray) buttons = NULL;
  int expect_width = MIN (width - 32, 560);
  GtkWidget *last;

  g_assert_nonnull (frame);
  g_assert_true (luma_sheet_frame_is_framed (frame));
  g_assert_true (gtk_widget_has_css_class (shown->card, "luma-sheet-frame"));
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), ==, 0);
  card = bounds (shown, shown->card);
  title = bounds (shown, shown->title);
  body = bounds (shown, shown->body);
  scroll = bounds (shown, find_class (shown->card, "luma-sheet-frame-body"));
  g_test_message ("%s at %dx%d: sheet %.1f,%.1f %.1fx%.1f", sheet_names[sheet], width, height, card.origin.x,
                  card.origin.y, card.size.width, card.size.height);
  {
    graphene_rect_t mover = bounds (shown, shown->mover), parent = bounds (shown, gtk_widget_get_parent (shown->card));
    g_auto (GStrv) classes = gtk_widget_get_css_classes (shown->card);
    g_autofree char *joined = g_strjoinv (" ", classes);
    g_test_message ("  mover %.1f,%.1f %.1fx%.1f; card parent %.1f,%.1f %.1fx%.1f; card %dx%d margins %d %d %d %d [%s]",
                    mover.origin.x, mover.origin.y, mover.size.width, mover.size.height, parent.origin.x,
                    parent.origin.y, parent.size.width, parent.size.height, gtk_widget_get_width (shown->card),
                    gtk_widget_get_height (shown->card), gtk_widget_get_margin_start (shown->card),
                    gtk_widget_get_margin_end (shown->card), gtk_widget_get_margin_top (shown->card),
                    gtk_widget_get_margin_bottom (shown->card), joined);
  }
  /* The bar's place: 16 a side (centred, no wider than 560), 34 up. */
  assert_near (card.size.width, expect_width);
  assert_near (card.origin.x, (width - expect_width) / 2.0);
  assert_near (card.origin.y + card.size.height, height - 34);
  g_assert_cmpfloat (card.size.height, <=, height - 120 + 0.5);
  /* No grabber, no document, no icon. */
  g_assert_false (find_class (shown->card, "lumaui-drawer-handle") != NULL
                  && gtk_widget_get_visible (find_class (shown->card, "lumaui-drawer-handle")));
  if (find_class (shown->card, "luma-save-mark") != NULL)
    g_assert_false (gtk_widget_get_visible (find_class (shown->card, "luma-save-mark")));
  /* Padding 20 at the top, 12 at the sides; the words 12 in, as wide as the column. */
  assert_near (scroll.origin.y, card.origin.y + 20);
  assert_near (title.origin.y, card.origin.y + 20);
  assert_near (title.origin.x, card.origin.x + 12);
  assert_near (title.size.width, card.size.width - 24);
  assert_near (body.origin.y, title.origin.y + title.size.height + 6);
  assert_round (shown->card);

  buttons = foot_buttons (shown);
  if (sheet == SHEET_DELETE || sheet == SHEET_LONG)
    g_assert_cmpuint (buttons->len, ==, sheet == SHEET_DELETE ? 2 : 3);
  else
    g_assert_cmpuint (buttons->len, ==, 3);
  {
    GtkWidget *left = buttons->pdata[0], *right = buttons->pdata[1];
    graphene_rect_t l = bounds (shown, left), r = bounds (shown, right);
    const char *left_words = sheet == SHEET_CONTINUE ? "Start Over" : "Cancel";
    const char *right_words = sheet == SHEET_CONTINUE ? "Continue" : sheet == SHEET_DELETE ? "Delete" : "Save";
    g_assert_cmpstr (button_words (left), ==, left_words);
    g_assert_cmpstr (button_words (right), ==, right_words);
    g_assert_cmpstr (button_kind (left), ==, "fill");
    g_assert_cmpstr (button_kind (right), ==, sheet == SHEET_DELETE ? "danger" : "key");
    /* Side by side, equal, 8 apart, 48 tall, the primary on the right. */
    assert_near (l.size.height, 48);
    assert_near (r.size.height, 48);
    assert_near (l.origin.y, r.origin.y);
    assert_near (l.size.width, r.size.width);
    assert_near (l.origin.x, card.origin.x + 12);
    assert_near (r.origin.x, l.origin.x + l.size.width + 8);
    assert_near (r.origin.x + r.size.width, card.origin.x + card.size.width - 12);
    if (sheet != SHEET_LONG)
      assert_near (l.origin.y, body.origin.y + body.size.height + 16);
    if (buttons->len == 3) {
      GtkWidget *quiet = buttons->pdata[2];
      graphene_rect_t q = bounds (shown, quiet);
      gboolean red = sheet != SHEET_CONTINUE;
      g_assert_cmpstr (button_words (quiet), ==, red ? "Don’t Save" : "Cancel");
      g_assert_cmpstr (button_kind (quiet), ==, red ? "quiet red" : "quiet");
      assert_near (q.size.height, 44);
      assert_near (q.size.width, card.size.width - 24);
      assert_near (q.origin.y, l.origin.y + 48 + (red ? 12 : 8));
    }
  }
  last = buttons->pdata[buttons->len - 1];
  {
    graphene_rect_t b = bounds (shown, last);
    assert_near (b.origin.y + b.size.height, card.origin.y + card.size.height - 12);
  }
}

static void
test_swipe_rule (void)
{
  g_assert_false (luma_sheet_swipe_dismisses (59, 200, 0.1));
  g_assert_true (luma_sheet_swipe_dismisses (61, 200, 0.1));
  g_assert_true (luma_sheet_swipe_dismisses (10, 200, 0.51));
  g_assert_false (luma_sheet_swipe_dismisses (10, 200, 0.49));
  g_assert_false (luma_sheet_swipe_dismisses (-30, 200, 2));
}

static const struct {
  int width, height;
  const char *form_factor, *device_class;
  LumaSheetPosture posture;
} sizes[] = {
  { 390, 844, "phone", "handheld", LUMA_SHEET_POSTURE_PHONE },
  { 360, 780, "phone", "handheld", LUMA_SHEET_POSTURE_PHONE },
  { 844, 390, "phone", "handheld", LUMA_SHEET_POSTURE_FLOATING },
  { 1024, 768, NULL, "tablet", LUMA_SHEET_POSTURE_FLOATING },
};

static void
test_geometry (void)
{
  calm (TRUE);
  for (guint i = 0; i < G_N_ELEMENTS (sizes); i++) {
    Shown *shown;
    device (sizes[i].form_factor, sizes[i].device_class);
    shown = shown_new (sizes[i].width, sizes[i].height, SHEET_CONTINUE);
    for (Sheet sheet = SHEET_CONTINUE; sheet <= SHEET_DELETE; sheet++) {
      if (sheet != SHEET_CONTINUE)
        show (shown, sheet);
      g_assert_cmpint (gtk_widget_get_width (shown->window), ==, sizes[i].width);
      g_assert_cmpint (luma_sheet_frame_get_posture (frame_of (shown)), ==, sizes[i].posture);
      check_frame (shown, sheet, sizes[i].width, sizes[i].height);
      shown_close (shown);
    }
    shown_free (shown);
  }
  calm (FALSE);
}

/* Long content: the head and body scroll, the buttons stay pinned at the foot. */
static void
test_long (void)
{
  calm (TRUE);
  for (guint i = 0; i < G_N_ELEMENTS (sizes); i += 2) {
    Shown *shown;
    GtkAdjustment *adjustment;
    graphene_rect_t card;
    device (sizes[i].form_factor, sizes[i].device_class);
    shown = shown_new (sizes[i].width, sizes[i].height, SHEET_LONG);
    card = bounds (shown, shown->card);
    assert_near (card.size.height, sizes[i].height - 120);
    adjustment = gtk_scrolled_window_get_vadjustment (
        GTK_SCROLLED_WINDOW (find_class (shown->card, "luma-sheet-frame-body")));
    g_assert_cmpfloat (gtk_adjustment_get_upper (adjustment), >, gtk_adjustment_get_page_size (adjustment) + 100);
    check_frame (shown, SHEET_LONG, sizes[i].width, sizes[i].height);
    shown_free (shown);
  }
  calm (FALSE);
}

/* The desktop keeps its sheet: hung from the title bar, 360 wide, the buttons stacked. */
static void
test_desktop (void)
{
  Shown *shown;
  graphene_rect_t card, header, primary, cancel;
  calm (TRUE);
  device (NULL, "desktop");
  shown = shown_new (1024, 768, SHEET_SAVE);
  spin (120); /* calm: the desktop sheet drops without motion */
  g_assert_cmpint (luma_sheet_frame_get_posture (frame_of (shown)), ==, LUMA_SHEET_POSTURE_DESKTOP);
  g_assert_false (gtk_widget_has_css_class (shown->card, "luma-sheet-frame"));
  g_assert_null (find_class (shown->card, "luma-sheet-frame-foot"));
  g_assert_true (gtk_widget_get_visible (find_class (shown->card, "luma-save-mark")));
  card = bounds (shown, shown->card);
  header = bounds (shown, gtk_widget_get_first_child (shown->content));
  assert_near (card.size.width, 360);
  assert_near (card.origin.x, (1024 - 360) / 2.0);
  assert_near (card.origin.y, header.origin.y + header.size.height);
  primary = bounds (shown, GTK_WIDGET (luma_save_sheet_get_primary_button (shown->save)));
  cancel = bounds (shown, GTK_WIDGET (luma_save_sheet_get_cancel_button (shown->save)));
  g_assert_cmpfloat (cancel.origin.y, >, primary.origin.y + primary.size.height);
  assert_near (primary.size.width, cancel.size.width);
  shown_free (shown);

  shown = shown_new (1024, 768, SHEET_DELETE);
  g_assert_false (luma_modal_handle_get_is_drawer (
      luma_layer_host_get_modal (luma_layer_host_window_host (shown->content))));
  g_assert_null (frame_of (shown));
  g_assert_true (gtk_widget_get_visible (find_class (shown->card, "lumaui-dialog-icon")));
  shown_free (shown);
  calm (FALSE);
}

/* A size class change lays an open sheet out again in place. */
static void
test_resize (void)
{
  Shown *shown;
  calm (TRUE);
  device (NULL, "desktop");
  shown = shown_new (390, 844, SHEET_SAVE);
  g_assert_true (luma_sheet_frame_is_framed (frame_of (shown)));
  gtk_window_set_default_size (GTK_WINDOW (shown->window), 1024, 768);
  gtk_widget_queue_resize (shown->window);
  spin (400);
  if (gtk_widget_get_width (shown->window) < 900) {
    shown_free (shown);
    calm (FALSE);
    g_test_skip ("the compositor kept the window's first size");
    return;
  }
  g_assert_cmpint (luma_sheet_frame_get_posture (frame_of (shown)), ==, LUMA_SHEET_POSTURE_DESKTOP);
  g_assert_false (gtk_widget_has_css_class (shown->card, "luma-sheet-frame"));
  g_assert_true (luma_save_sheet_get_open (shown->save));
  g_assert_true (gtk_widget_get_parent (GTK_WIDGET (luma_save_sheet_get_discard_button (shown->save)))
                 == shown->card);
  gtk_window_set_default_size (GTK_WINDOW (shown->window), 390, 844);
  gtk_widget_queue_resize (shown->window);
  spin (400);
  check_frame (shown, SHEET_SAVE, 390, 844);
  shown_free (shown);
  calm (FALSE);
}

static void
test_swipe (void)
{
  Shown *shown;
  LumaSheetFrame *frame;
  double height;
  device ("phone", "handheld");

  /* Short of 30 %, slowly: back in place, nothing answered. */
  shown = shown_new (390, 844, SHEET_CONTINUE);
  frame = frame_of (shown);
  height = gtk_widget_get_height (shown->mover);
  luma_sheet_frame_drag (frame, height * 0.2);
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), >, height * 0.19);
  luma_sheet_frame_drag (frame, -40);
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), >=, -12); /* the rubber band */
  g_assert_false (luma_sheet_frame_release (frame, height * 0.2, 0.1));
  settle (shown);
  g_assert_cmpfloat (fabs (luma_sheet_frame_get_offset (frame)), <, 0.5);
  g_assert_cmpint (shown->responses, ==, 0);
  /* Past 30 %: Cancel. */
  g_assert_true (luma_sheet_frame_release (frame, height * 0.35, 0.1));
  settle (shown);
  g_assert_cmpint (shown->responses, ==, 1);
  g_assert_cmpint (shown->last, ==, LUMA_SAVE_CHOICE_CANCEL);
  shown_close (shown);

  /* A flick: 10 px at 0.8 px/ms is Cancel. */
  show (shown, SHEET_SAVE);
  g_assert_true (luma_sheet_frame_release (frame_of (shown), 10, 0.8));
  settle (shown);
  g_assert_cmpint (shown->last, ==, LUMA_SAVE_CHOICE_CANCEL);
  shown_close (shown);

  /* The destructive confirm, through the layer host: the same rule. */
  show (shown, SHEET_DELETE);
  g_assert_true (luma_sheet_frame_release (frame_of (shown), 200, 0.1));
  spin (400);
  g_assert_cmpint (shown->cancelled, ==, 1);
  shown_close (shown);

  /* A sheet with no Cancel doesn't go. */
  show (shown, SHEET_SAVE);
  gtk_widget_set_visible (GTK_WIDGET (luma_save_sheet_get_cancel_button (shown->save)), FALSE);
  g_assert_false (luma_sheet_frame_release (frame_of (shown), 400, 2));
  settle (shown);
  g_assert_cmpint (shown->responses, ==, 0);
  g_assert_true (luma_save_sheet_get_open (shown->save));
  gtk_widget_set_visible (GTK_WIDGET (luma_save_sheet_get_cancel_button (shown->save)), TRUE);
  shown_free (shown);
}

/* In from below the screen; out the same way; the swipe springs back. */
static void
test_motion (void)
{
  Shown *shown = g_new0 (Shown, 1);
  LumaSheetFrame *frame;
  double first;
  device ("phone", "handheld");
  shown->window = window_new (390, 844);
  shown->content = gtk_window_get_child (GTK_WINDOW (shown->window));
  {
    LumaSaveDocument *game = luma_save_document_new ("The Minish Cap");
    shown->save = luma_save_sheet_new (&game, 1, FALSE);
    g_object_unref (game);
  }
  luma_save_sheet_present (shown->save, GTK_WINDOW (shown->window));
  shown->mover = GTK_WIDGET (shown->save);
  shown->card = luma_save_sheet_get_card (shown->save);
  frame = frame_of (shown);
  g_assert_true (luma_sheet_frame_is_moving (frame));
  spin (60);
  first = luma_sheet_frame_get_offset (frame);
  g_assert_cmpfloat (first, >, 34); /* still below its place, rising */
  spin (600);
  g_assert_false (luma_sheet_frame_is_moving (frame));
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), ==, 0);
  luma_save_sheet_activate_cancel (shown->save);
  g_assert_null (luma_window_get_presented_sheet (GTK_WINDOW (shown->window)));
  g_assert_nonnull (gtk_widget_get_parent (shown->mover)); /* leaving, still on the layer */
  spin (120);
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), >, 0);
  spin (400);
  g_assert_null (gtk_widget_get_parent (shown->mover));
  shown_free (shown);
}

/* Reduced motion: no travel, a 150 ms cross-fade; a swipe still dismisses. */
static void
test_reduced_motion (void)
{
  Shown *shown = g_new0 (Shown, 1);
  LumaSheetFrame *frame;
  device ("phone", "handheld");
  g_object_set (gtk_settings_get_default (), "gtk-enable-animations", FALSE, NULL);
  g_assert_true (luma_ui_reduced_motion ());
  shown->window = window_new (390, 844);
  shown->content = gtk_window_get_child (GTK_WINDOW (shown->window));
  {
    LumaSaveDocument *game = luma_save_document_new ("The Minish Cap");
    shown->save = luma_save_sheet_new (&game, 1, FALSE);
    g_object_unref (game);
  }
  g_signal_connect (shown->save, "response", G_CALLBACK (save_answered), shown);
  luma_save_sheet_present (shown->save, GTK_WINDOW (shown->window));
  shown->mover = GTK_WIDGET (shown->save);
  shown->card = luma_save_sheet_get_card (shown->save);
  frame = frame_of (shown);
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), ==, 0);
  spin (40);
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), ==, 0);
  g_assert_cmpfloat (gtk_widget_get_opacity (shown->mover), <, 1);
  spin (250);
  g_assert_cmpfloat (gtk_widget_get_opacity (shown->mover), ==, 1);
  luma_sheet_frame_drag (frame, 150);
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), ==, 0); /* no travel under the finger */
  g_assert_true (luma_sheet_frame_release (frame, 300, 0.1));
  spin (60);
  g_assert_cmpfloat (luma_sheet_frame_get_offset (frame), ==, 0);
  g_assert_cmpfloat (gtk_widget_get_opacity (shown->mover), <, 1);
  spin (250);
  g_assert_cmpint (shown->last, ==, LUMA_SAVE_CHOICE_CANCEL);
  g_object_set (gtk_settings_get_default (), "gtk-enable-animations", TRUE, NULL);
  shown_free (shown);
}

/* An application's own sheet through luma_window_present_sheet(), built the way OpenLator
 * builds its launch prompt: a scrim box, a clamp, a card of the kit's classes. */
static int prompt_cancels;
static void
prompt_cancel (GtkButton *button, gpointer window)
{
  (void) button;
  prompt_cancels++;
  luma_window_dismiss_sheet (GTK_WINDOW (window)); /* as OpenLator's Cancel does */
}

static void
test_custom_sheet (void)
{
  GtkWidget *window, *scrim, *clamp, *card, *title, *body, *actions, *primary, *cancel;
  Shown *shown = g_new0 (Shown, 1);
  graphene_rect_t c, p, k;
  calm (TRUE);
  device ("phone", "handheld");
  window = shown->window = window_new (390, 844);
  shown->content = gtk_window_get_child (GTK_WINDOW (window));
  scrim = gtk_box_new (GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_add_css_class (scrim, "luma-save-scrim");
  gtk_widget_set_hexpand (scrim, TRUE);
  gtk_widget_set_vexpand (scrim, TRUE);
  clamp = adw_clamp_new ();
  adw_clamp_set_maximum_size (ADW_CLAMP (clamp), 380);
  gtk_widget_set_valign (clamp, GTK_ALIGN_START);
  gtk_widget_set_margin_start (clamp, 16);
  gtk_widget_set_margin_end (clamp, 16);
  card = gtk_box_new (GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_add_css_class (card, "luma-save-sheet");
  title = gtk_label_new ("Game can’t start");
  gtk_widget_add_css_class (title, "luma-save-title");
  body = gtk_label_new ("This game needs a system file.");
  gtk_widget_add_css_class (body, "luma-save-body");
  actions = gtk_box_new (GTK_ORIENTATION_VERTICAL, 8);
  primary = gtk_button_new_with_label ("Find File");
  gtk_widget_add_css_class (primary, "luma-save-primary");
  cancel = gtk_button_new_with_label ("Not Now");
  gtk_widget_add_css_class (cancel, "luma-save-secondary");
  g_signal_connect (cancel, "clicked", G_CALLBACK (prompt_cancel), window);
  gtk_box_append (GTK_BOX (actions), primary);
  gtk_box_append (GTK_BOX (actions), cancel);
  gtk_box_append (GTK_BOX (card), title);
  gtk_box_append (GTK_BOX (card), body);
  gtk_box_append (GTK_BOX (card), actions);
  adw_clamp_set_child (ADW_CLAMP (clamp), card);
  gtk_box_append (GTK_BOX (scrim), clamp);
  g_object_ref_sink (scrim);
  luma_window_present_sheet (GTK_WINDOW (window), scrim, NULL);
  gtk_widget_add_css_class (scrim, "open");
  shown->mover = scrim;
  shown->card = card;
  settle (shown);
  c = bounds (shown, card);
  p = bounds (shown, primary);
  k = bounds (shown, cancel);
  assert_near (c.origin.x, 16);
  assert_near (c.size.width, 358);
  assert_near (c.origin.y + c.size.height, 844 - 34);
  assert_near (p.origin.y, k.origin.y);         /* side by side */
  g_assert_cmpfloat (p.origin.x, >, k.origin.x); /* the primary on the right */
  assert_near (p.size.height, 48);
  g_assert_true (luma_sheet_frame_release (frame_of (shown), 400, 0.1));
  g_assert_cmpint (prompt_cancels, ==, 1);
  /* Taken down, the card is given back as it was. */
  spin (350);
  g_assert_null (gtk_widget_get_parent (scrim));
  g_assert_true (gtk_widget_get_parent (primary) == actions && gtk_widget_get_parent (cancel) == actions);
  g_assert_true (gtk_widget_get_parent (actions) == card && gtk_widget_get_first_child (card) == title);
  g_assert_true (gtk_widget_get_parent (card) == clamp);
  g_assert_cmpint (gtk_widget_get_margin_start (clamp), ==, 16);
  g_assert_cmpint (adw_clamp_get_maximum_size (ADW_CLAMP (clamp)), ==, 380);
  /* Presented again with no Cancel: one full-width primary, and a swipe leaves it up. */
  gtk_widget_set_visible (cancel, FALSE);
  luma_window_present_sheet (GTK_WINDOW (window), scrim, NULL);
  settle (shown);
  p = bounds (shown, primary);
  assert_near (p.size.width, 334);
  g_assert_false (luma_sheet_frame_release (frame_of (shown), 400, 2));
  g_assert_true (luma_window_get_presented_sheet (GTK_WINDOW (window)) == scrim);
  luma_window_dismiss_sheet (GTK_WINDOW (window));
  spin (250);
  g_object_unref (scrim);
  gtk_window_destroy (GTK_WINDOW (window));
  g_free (shown);
  calm (FALSE);
}

/* The on-screen keyboard: the sheet rides 12 above the keys, easing as they rise and fall, at
 * most the space left less 76. */
static void
test_keyboard (void)
{
  Shown *shown;
  graphene_rect_t card;
  LumaSheetFrame *frame;
  g_assert_cmpint (luma_sheet_keyboard_cover (800, 844, 300, TRUE), ==, 300);  /* the keys over the window */
  g_assert_cmpint (luma_sheet_keyboard_cover (500, 844, 300, TRUE), ==, 0);    /* the Shell shrank it */
  g_assert_cmpint (luma_sheet_keyboard_cover (800, 844, 300, FALSE), ==, -1);  /* not at the screen's foot */
  g_assert_cmpint (luma_sheet_keyboard_cover (800, 844, 0, TRUE), ==, -1);     /* down */

  device ("phone", "handheld");
  shown = shown_new (390, 844, SHEET_CONTINUE);
  frame = frame_of (shown);
  g_assert_cmpfloat (luma_sheet_frame_get_gap (frame), ==, 34);
  /* Up, the window already above it: 12 over its foot, eased in. */
  luma_sheet_simulate_keyboard (0);
  spin (60);
  g_assert_cmpfloat (luma_sheet_frame_get_gap (frame), <, 34);
  g_assert_cmpfloat (luma_sheet_frame_get_gap (frame), >, 12);
  spin (400);
  card = bounds (shown, shown->card);
  assert_near (card.origin.y + card.size.height, 844 - 12);
  /* Up over the window: 12 above the keys' top. */
  luma_sheet_simulate_keyboard (300);
  spin (400);
  card = bounds (shown, shown->card);
  assert_near (card.origin.y + card.size.height, 844 - 300 - 12);
  /* Down again. */
  luma_sheet_simulate_keyboard (-1);
  spin (400);
  card = bounds (shown, shown->card);
  assert_near (card.origin.y + card.size.height, 844 - 34);
  shown_close (shown);
  /* Long content with the keys up: the space left less 76, the buttons still pinned. */
  luma_sheet_simulate_keyboard (300);
  calm (TRUE);
  show (shown, SHEET_LONG);
  card = bounds (shown, shown->card);
  assert_near (card.size.height, 844 - 300 - 76);
  assert_near (card.origin.y + card.size.height, 844 - 300 - 12);
  {
    g_autoptr (GPtrArray) buttons = foot_buttons (shown);
    graphene_rect_t last = bounds (shown, buttons->pdata[buttons->len - 1]);
    assert_near (last.origin.y + last.size.height, card.origin.y + card.size.height - 12);
  }
  luma_sheet_simulate_keyboard (-1);
  shown_free (shown);
  calm (FALSE);
}

/* Landscape safe area: a notch or rounded corner adds to the 16 gutter. */
static void
test_side_inset (void)
{
  /* A portrait panel with a 180 × 120 notch at the top centre, as display-geometry.json has it. */
  static const char profile[] =
      "{\"schema\": 1, \"nativeWidth\": 1080, \"nativeHeight\": 2424,"
      " \"cutouts\": [{\"x\": 450, \"y\": 0, \"width\": 180, \"height\": 120}]}";
  static const char folded[] =
      "{\"schema\": 2, \"displays\": ["
      " {\"connector\": \"DSI-1\", \"nativeWidth\": 1080, \"nativeHeight\": 2424, \"cutouts\": []},"
      " {\"connector\": \"DSI-2\", \"nativeWidth\": 1080, \"nativeHeight\": 2424,"
      "  \"cutouts\": [{\"x\": 450, \"y\": 0, \"width\": 180, \"height\": 120}]}]}";
  Shown *shown;
  graphene_rect_t card;
  /* Landscape, either way round: the notch's 42 px come off both sides. */
  g_assert_cmpint (luma_sheet_side_inset (profile, NULL, 844, 390, 86, 356), ==, 42);
  /* Upright, the notch is above the sheet's band. */
  g_assert_cmpint (luma_sheet_side_inset (profile, NULL, 390, 844, 86, 810), ==, 0);
  g_assert_cmpint (luma_sheet_side_inset (folded, "DSI-2", 844, 390, 86, 356), ==, 42);
  g_assert_cmpint (luma_sheet_side_inset (folded, "DSI-1", 844, 390, 86, 356), ==, 0);
  g_assert_cmpint (luma_sheet_side_inset ("{broken", NULL, 844, 390, 86, 356), ==, 0);

  calm (TRUE);
  device ("phone", "handheld");
  luma_sheet_simulate_side_inset (50);
  shown = shown_new (640, 360, SHEET_SAVE);
  card = bounds (shown, shown->card);
  assert_near (card.size.width, 640 - 2 * (16 + 50));
  assert_near (card.origin.x, 16 + 50);
  luma_sheet_simulate_side_inset (-1);
  shown_free (shown);
  calm (FALSE);
}

/* ── Captures for conform ── */

static void
rect_json (GString *json, const char *name, graphene_rect_t rect)
{
  g_string_append_printf (json, "\"%s\": [%.1f, %.1f, %.1f, %.1f]", name, rect.origin.x, rect.origin.y,
                          rect.size.width, rect.size.height);
}

static void
string_json (GString *json, const char *text)
{
  g_string_append_c (json, '"');
  for (const char *c = text; *c; c++) {
    if (*c == '"' || *c == '\\')
      g_string_append_c (json, '\\');
    g_string_append_c (json, *c);
  }
  g_string_append_c (json, '"');
}

static gboolean
capture_png (GtkWidget *window, const char *path)
{
  int width = gtk_widget_get_width (window), height = gtk_widget_get_height (window);
  GdkPaintable *paintable = gtk_widget_paintable_new (window);
  GtkSnapshot *snapshot = gtk_snapshot_new ();
  GskRenderNode *node;
  GdkTexture *texture;
  gtk_snapshot_scale (snapshot, 2, 2);
  gdk_paintable_snapshot (paintable, snapshot, width, height);
  node = gtk_snapshot_free_to_node (snapshot);
  g_object_unref (paintable);
  if (node == NULL) /* not drawn yet */
    return FALSE;
  texture = gsk_renderer_render_texture (gtk_native_get_renderer (GTK_NATIVE (window)), node,
                                         &GRAPHENE_RECT_INIT (0, 0, width * 2, height * 2));
  g_assert_true (gdk_texture_save_to_png (texture, path));
  g_object_unref (texture);
  gsk_render_node_unref (node);
  return TRUE;
}

static int
capture (const char *dir, const char *theme)
{
  static const struct {
    const char *name;
    int width, height;
    const char *form_factor, *device_class;
  } shots[] = {
    { "390", 390, 844, "phone", "handheld" },
    { "360", 360, 780, "phone", "handheld" },
    { "landscape", 844, 390, "phone", "handheld" },
    { "tablet", 1024, 768, NULL, "tablet" },
  };
  g_autoptr (GString) json = g_string_new ("{");
  g_autofree char *geometry = g_strdup_printf ("%s/geometry-%s.json", dir, theme);
  gboolean first = TRUE;

  g_mkdir_with_parents (dir, 0755);
  for (guint i = 0; i < G_N_ELEMENTS (shots); i++)
    for (Sheet sheet = SHEET_CONTINUE; sheet < N_SHEETS; sheet++) {
      g_autofree char *key = NULL, *png = NULL;
      g_autoptr (GPtrArray) buttons = NULL;
      Shown *shown;
      if (sheet == SHEET_LONG && i != 0 && i != 2)
        continue;
      key = g_strdup_printf ("ol-%s-%s-%s", sheet_names[sheet], shots[i].name, theme);
      png = g_strdup_printf ("%s/%s.png", dir, key);
      device (shots[i].form_factor, shots[i].device_class);
      shown = shown_new (shots[i].width, shots[i].height, sheet);
      g_assert_true (capture_png (shown->window, png));
      g_string_append_printf (json, "%s\n  \"%s\": {\"window\": [%d, %d], ", first ? "" : ",", key,
                              gtk_widget_get_width (shown->window), gtk_widget_get_height (shown->window));
      first = FALSE;
      rect_json (json, "sheet", bounds (shown, shown->card));
      g_string_append (json, ", ");
      rect_json (json, "title", bounds (shown, shown->title));
      g_string_append (json, ", ");
      rect_json (json, "body", bounds (shown, shown->body));
      g_string_append (json, ", ");
      rect_json (json, "scroll", bounds (shown, find_class (shown->card, "luma-sheet-frame-body")));
      g_string_append (json, ", \"buttons\": [");
      buttons = foot_buttons (shown);
      for (guint b = 0; b < buttons->len; b++) {
        g_string_append (json, b ? ", {\"label\": " : "{\"label\": ");
        string_json (json, button_words (buttons->pdata[b]));
        g_string_append (json, ", \"kind\": ");
        string_json (json, button_kind (buttons->pdata[b]));
        g_string_append (json, ", ");
        rect_json (json, "rect", bounds (shown, buttons->pdata[b]));
        g_string_append (json, "}");
      }
      g_string_append (json, "]}");
      g_print ("%s\n", png);
      shown_free (shown);
    }
  g_string_append (json, "\n}\n");
  return g_file_set_contents (geometry, json->str, -1, NULL) ? 0 : 1;
}

/* ── Motion recordings: every drawn frame, timed by the frame clock ── */

typedef struct {
  GtkWidget *window;
  LumaSheetFrame *frame;
  GtkWidget *mover;
  char *dir;
  gulong paint;
  GString *log;
  gint64 start;
  guint n;
  double drag_to;        /* a swipe driven frame by frame: the finger to here over 160 ms */
  gint64 drag_start;
} Recording;

/* Each frame as drawn (after paint), timed by the frame clock. */
static void
record_paint (GdkFrameClock *clock, gpointer data)
{
  Recording *rec = data;
  gint64 now = gdk_frame_clock_get_frame_time (clock);
  double ms;
  g_autofree char *png = NULL;
  if (rec->start == 0)
    rec->start = now;
  if (rec->mover == NULL && luma_window_get_presented_sheet (GTK_WINDOW (rec->window)) != NULL) {
    rec->mover = luma_window_get_presented_sheet (GTK_WINDOW (rec->window));
    rec->frame = luma_sheet_frame_get (rec->mover);
  }
  ms = (now - rec->start) / 1000.0;
  png = g_strdup_printf ("%s/%04u-%07.1fms.png", rec->dir, rec->n, ms);
  if (!capture_png (rec->window, png))
    return;
  rec->n++;
  g_string_append_printf (rec->log, "%.1f,%.2f,%.3f,%s\n", ms,
                          rec->frame != NULL && rec->mover != NULL && luma_sheet_frame_get (rec->mover) == rec->frame
                            ? luma_sheet_frame_get_offset (rec->frame) : -1,
                          rec->mover != NULL ? gtk_widget_get_opacity (rec->mover) : -1, strrchr (png, '/') + 1);
}

/* Keeps frames coming, and moves a scripted finger frame by frame. */
static gboolean
record_tick (GtkWidget *widget, GdkFrameClock *clock, gpointer data)
{
  Recording *rec = data;
  gint64 now = gdk_frame_clock_get_frame_time (clock);
  (void) widget;
  if (rec->drag_to > 0 && rec->frame != NULL) {
    double t;
    if (rec->drag_start == 0)
      rec->drag_start = now;
    t = MIN (1.0, (now - rec->drag_start) / 160000.0);
    luma_sheet_frame_drag (rec->frame, rec->drag_to * t);
    if (t >= 1.0) {
      double to = rec->drag_to;
      rec->drag_to = 0;
      luma_sheet_frame_release (rec->frame, to, to / 160.0);
    }
  }
  return G_SOURCE_CONTINUE;
}

static Recording *
record_start (GtkWidget *window, const char *dir, const char *name)
{
  Recording *rec = g_new0 (Recording, 1);
  rec->window = window;
  rec->dir = g_build_filename (dir, name, NULL);
  g_mkdir_with_parents (rec->dir, 0755);
  rec->log = g_string_new ("ms,offset_px,sheet_opacity,frame\n");
  rec->paint = g_signal_connect (gtk_widget_get_frame_clock (window), "after-paint", G_CALLBACK (record_paint), rec);
  return rec;
}

static void
record_finish (Recording *rec, guint tick)
{
  g_autofree char *csv = g_build_filename (rec->dir, "frames.csv", NULL);
  gtk_widget_remove_tick_callback (rec->window, tick);
  g_signal_handler_disconnect (gtk_widget_get_frame_clock (rec->window), rec->paint);
  g_file_set_contents (csv, rec->log->str, -1, NULL);
  g_string_free (rec->log, TRUE);
  g_print ("%s: %u frames\n", rec->dir, rec->n);
  g_free (rec->dir);
  g_free (rec);
}

static int
record (const char *dir)
{
  Shown *shown = g_new0 (Shown, 1);
  Recording *rec;
  guint tick;
  double height;
  device ("phone", "handheld");
  shown->window = window_new (390, 844);
  shown->content = gtk_window_get_child (GTK_WINDOW (shown->window));

  /* 1. The rise (420 ms on cubic-bezier(.2,.9,.25,1)). */
  rec = record_start (shown->window, dir, "motion-rise");
  tick = gtk_widget_add_tick_callback (shown->window, record_tick, rec, NULL);
  show (shown, SHEET_CONTINUE);
  spin (300);
  record_finish (rec, tick);

  /* 2. A swipe past 30 %: the finger over 160 ms, then the 260 ms leave. */
  rec = record_start (shown->window, dir, "motion-swipe-dismiss");
  rec->mover = shown->mover;
  rec->frame = frame_of (shown);
  tick = gtk_widget_add_tick_callback (shown->window, record_tick, rec, NULL);
  spin (100); /* frames flowing, the sheet at rest */
  height = gtk_widget_get_height (shown->mover);
  rec->drag_to = height * 0.4;
  spin (700);
  record_finish (rec, tick);
  g_clear_object (&shown->save);

  /* 3. Reduce Motion: a 150 ms cross-fade in, then out. */
  calm (TRUE);
  rec = record_start (shown->window, dir, "motion-reduced");
  tick = gtk_widget_add_tick_callback (shown->window, record_tick, rec, NULL);
  show (shown, SHEET_SAVE);
  spin (250);
  luma_save_sheet_activate_cancel (shown->save);
  spin (300);
  record_finish (rec, tick);
  calm (FALSE);
  shown_free (shown);
  return 0;
}

int
main (int argc, char **argv)
{
  const char *dir = g_getenv ("LUMA_SHEET_CAPTURE");
  const char *theme = g_getenv ("LUMA_SHEET_CAPTURE_THEME");
  g_autoptr (GSettings) interface = NULL;
  GSettingsSchemaSource *source;
  g_autoptr (GSettingsSchema) schema = NULL;

  gtk_test_init (&argc, &argv, NULL);
  adw_init ();
  source = g_settings_schema_source_get_default ();
  schema = source != NULL ? g_settings_schema_source_lookup (source, "org.gnome.desktop.interface", TRUE) : NULL;
  if (schema != NULL && g_settings_schema_has_key (schema, "color-scheme")) {
    interface = g_settings_new ("org.gnome.desktop.interface");
    g_settings_set_string (interface, "color-scheme",
                           g_strcmp0 (theme, "dark") == 0 ? "prefer-dark" : "default");
  }
  g_object_set (gtk_settings_get_default (), "gtk-font-name", "Figtree 11", NULL);
  luma_init ();
  if (dir != NULL && *dir != '\0')
    return capture (dir, theme != NULL ? theme : "light");
  if (g_getenv ("LUMA_SHEET_RECORD") != NULL && *g_getenv ("LUMA_SHEET_RECORD") != '\0')
    return record (g_getenv ("LUMA_SHEET_RECORD"));

  g_test_add_func ("/lumaui/phone-sheet/swipe-rule", test_swipe_rule);
  g_test_add_func ("/lumaui/phone-sheet/geometry", test_geometry);
  g_test_add_func ("/lumaui/phone-sheet/long", test_long);
  g_test_add_func ("/lumaui/phone-sheet/desktop", test_desktop);
  g_test_add_func ("/lumaui/phone-sheet/resize", test_resize);
  g_test_add_func ("/lumaui/phone-sheet/custom-sheet", test_custom_sheet);
  g_test_add_func ("/lumaui/phone-sheet/keyboard", test_keyboard);
  g_test_add_func ("/lumaui/phone-sheet/side-inset", test_side_inset);
  g_test_add_func ("/lumaui/phone-sheet/swipe", test_swipe);
  g_test_add_func ("/lumaui/phone-sheet/motion", test_motion);
  g_test_add_func ("/lumaui/phone-sheet/reduced-motion", test_reduced_motion);
  return g_test_run ();
}
