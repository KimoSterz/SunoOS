/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_cards.py (Card, ContentLitCard, PersonAvatar, AccountCard,
 * ContentLitHeader), with content_file._Face / cap_width and SunoUI's hue. */
#include "Suno-cards.h"
#include "Suno-content-private.h"
#include "Suno-ui-private.h"

#include <adwaita.h>
#include <math.h>
#include <string.h>

/* ── hue (SunoUI.person_hue, hue_class) ─────────────────────────────────── */

static guint32 hue_crc32(const char *data) {
  guint32 crc = 0xFFFFFFFFu;
  for (const guchar *p = (const guchar *)data; *p != '\0'; p++) {
    crc ^= *p;
    for (int k = 0; k < 8; k++)
      crc = (crc >> 1) ^ (0xEDB88320u & (0u - (crc & 1u)));
  }
  return crc ^ 0xFFFFFFFFu;
}

int Suno_ui_person_hue(const char *name) {
  g_autofree char *stripped = g_strstrip(g_strdup(name != NULL ? name : ""));
  g_autofree char *folded = g_utf8_casefold(stripped, -1);
  return (int)(hue_crc32(folded) % 360u);
}

/* SunoUI.oklch_rgba: an OKLCH colour as a CSS rgba(), clipped into sRGB. */
static void oklch_rgba(GString *out, double lightness, double chroma, double hue, double alpha) {
  double radians = hue * G_PI / 180.0;
  double a = chroma * cos(radians), b = chroma * sin(radians);
  double l = pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
  double m = pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
  double s = pow(lightness - 0.0894841775 * a - 1.2914855480 * b, 3);
  double linear[3] = {4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s};
  int rgb[3];
  for (int i = 0; i < 3; i++) {
    double v = CLAMP(linear[i], 0.0, 1.0);
    v = v > 0.0031308 ? 1.055 * pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
    rgb[i] = (int)nearbyint(v * 255);
  }
  char number[G_ASCII_DTOSTR_BUF_SIZE];
  g_ascii_formatd(number, sizeof number, "%g", alpha);
  g_string_append_printf(out, "rgba(%d, %d, %d, %s)", rgb[0], rgb[1], rgb[2], number);
}

typedef struct {
  GtkCssProvider *provider;
  GHashTable *hues; /* int → present */
  gboolean pending;
} HueProvider;

static void hue_render(HueProvider *hp) {
  gboolean dark = adw_style_manager_get_dark(adw_style_manager_get_default());
  double wash_l = dark ? SUNO_UI_HUE_WASH_DARK_LIGHTNESS : SUNO_UI_HUE_WASH_LIGHT_LIGHTNESS;
  double wash_c = dark ? SUNO_UI_HUE_WASH_DARK_CHROMA : SUNO_UI_HUE_WASH_LIGHT_CHROMA;
  double wash_a = dark ? SUNO_UI_HUE_WASH_DARK_ALPHA : SUNO_UI_HUE_WASH_LIGHT_ALPHA;
  double tint_l = dark ? SUNO_UI_HUE_TINT_DARK_LIGHTNESS : SUNO_UI_HUE_TINT_LIGHT_LIGHTNESS;
  double tint_c = dark ? SUNO_UI_HUE_TINT_DARK_CHROMA : SUNO_UI_HUE_TINT_LIGHT_CHROMA;
  GString *css = g_string_new(NULL);
  for (int hue = 0; hue < 360; hue++) {
    if (!g_hash_table_contains(hp->hues, GINT_TO_POINTER(hue + 1)))
      continue;
    g_string_append_printf(css, ".SunoUI-hue-%d.SunoUI-avatar { background: ", hue);
    oklch_rgba(css, SUNO_UI_HUE_AVATAR_LIGHTNESS, SUNO_UI_HUE_AVATAR_CHROMA, hue, 1);
    g_string_append_printf(css, "; }\nbox.SunoUI-lit-wash.SunoUI-hue-%d { background-image: linear-gradient(to bottom, ",
                           hue);
    oklch_rgba(css, wash_l, wash_c, hue, wash_a);
    g_string_append(css, ", ");
    oklch_rgba(css, wash_l, wash_c, hue, 0);
    g_string_append_printf(css, "); }\n.SunoUI-hue-%d .SunoUI-hue-tint { color: ", hue);
    oklch_rgba(css, tint_l, tint_c, hue, 1);
    g_string_append_printf(css, "; }\n.SunoUI-hue-%d entry.SunoUI-hero-field.editable { box-shadow: inset 0 0 0 1px "
                                "@Suno_well_ring, inset 0 1px 2px @Suno_well_shade, 0 1px 0 @Suno_well_lip, 0 0 0 2px ",
                           hue);
    oklch_rgba(css, SUNO_UI_HUE_RING_LIGHTNESS, SUNO_UI_HUE_RING_CHROMA, hue, 1);
    g_string_append_printf(css, "; }\n.SunoUI-hue-%d entry.SunoUI-fact-input:focus-within { box-shadow: 0 0 0 2px ",
                           hue);
    oklch_rgba(css, SUNO_UI_HUE_RING_LIGHTNESS, SUNO_UI_HUE_RING_CHROMA, hue, 1);
    g_string_append(css, "; }\n");
  }
  gtk_css_provider_load_from_string(hp->provider, css->str);
  g_string_free(css, TRUE);
}

static gboolean hue_flush(gpointer data) {
  HueProvider *hp = data;
  hp->pending = FALSE;
  hue_render(hp);
  return G_SOURCE_REMOVE;
}

static void hue_dark_changed(GObject *manager G_GNUC_UNUSED, GParamSpec *pspec G_GNUC_UNUSED, gpointer data) {
  hue_render(data);
}

static HueProvider *hue_provider_for(GdkDisplay *display) {
  static GHashTable *providers = NULL;
  if (providers == NULL)
    providers = g_hash_table_new(NULL, NULL);
  HueProvider *hp = g_hash_table_lookup(providers, display);
  if (hp == NULL) {
    hp = g_new0(HueProvider, 1);
    hp->provider = gtk_css_provider_new();
    hp->hues = g_hash_table_new(NULL, NULL);
    gtk_style_context_add_provider_for_display(display, GTK_STYLE_PROVIDER(hp->provider),
                                               GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
    g_signal_connect(adw_style_manager_get_default(), "notify::dark", G_CALLBACK(hue_dark_changed), hp);
    g_hash_table_insert(providers, display, hp);
  }
  return hp;
}

const char *Suno_ui_hue_class(GtkWidget *widget, int hue) {
  g_return_val_if_fail(GTK_IS_WIDGET(widget), "");
  g_auto(GStrv) classes = gtk_widget_get_css_classes(widget);
  for (guint i = 0; classes[i] != NULL; i++) {
    const char *rest = classes[i] + strlen("SunoUI-hue-");
    if (g_str_has_prefix(classes[i], "SunoUI-hue-") && rest[0] != '\0' && strspn(rest, "0123456789") == strlen(rest))
      gtk_widget_remove_css_class(widget, classes[i]);
  }
  if (hue < 0)
    return "";
  int value = hue % 360;
  GdkDisplay *display = gtk_widget_get_display(widget);
  if (display == NULL)
    display = gdk_display_get_default();
  if (display != NULL) {
    HueProvider *hp = hue_provider_for(display);
    if (!g_hash_table_contains(hp->hues, GINT_TO_POINTER(value + 1))) {
      g_hash_table_add(hp->hues, GINT_TO_POINTER(value + 1));
      /* One reload per main-loop turn, before layout and paint. */
      if (!hp->pending) {
        hp->pending = TRUE;
        g_idle_add_full(G_PRIORITY_HIGH_IDLE, hue_flush, hp, NULL);
      }
    }
  }
  g_autofree char *name = g_strdup_printf("SunoUI-hue-%d", value);
  gtk_widget_add_css_class(widget, name);
  return g_intern_string(name);
}

/* ── _Face (content_file._Face) ─────────────────────────────────────────── */

#define SUNO_TYPE_CONTENT_FACE (Suno_content_face_get_type())
G_DECLARE_FINAL_TYPE(SunoContentFace, Suno_content_face, SUNO, CONTENT_FACE, GtkWidget)

struct _SunoContentFace {
  GtkWidget parent_instance;
  int size;
  double radius;
  GdkPaintable *paintable;
};

G_DEFINE_FINAL_TYPE(SunoContentFace, Suno_content_face, GTK_TYPE_WIDGET)

static void content_face_measure(GtkWidget *widget, GtkOrientation orientation G_GNUC_UNUSED,
                                 int for_size G_GNUC_UNUSED, int *minimum, int *natural,
                                 int *minimum_baseline, int *natural_baseline) {
  SunoContentFace *self = SUNO_CONTENT_FACE(widget);
  *minimum = *natural = self->size;
  *minimum_baseline = *natural_baseline = -1;
}

static void content_face_snapshot(GtkWidget *widget, GtkSnapshot *snapshot) {
  SunoContentFace *self = SUNO_CONTENT_FACE(widget);
  if (self->paintable == NULL)
    return;
  float size = (float)self->size;
  GskRoundedRect clip;
  gsk_rounded_rect_init_from_rect(&clip, &GRAPHENE_RECT_INIT(0, 0, size, size), (float)self->radius);
  gtk_snapshot_push_rounded_clip(snapshot, &clip);
  double width = gdk_paintable_get_intrinsic_width(self->paintable);
  double height = gdk_paintable_get_intrinsic_height(self->paintable);
  if (width <= 0)
    width = size;
  if (height <= 0)
    height = size;
  double scale = MAX(size / width, size / height); /* cover: fill the square, crop the rest */
  double drawn_w = width * scale, drawn_h = height * scale;
  gtk_snapshot_save(snapshot);
  gtk_snapshot_translate(snapshot, &GRAPHENE_POINT_INIT((float)((size - drawn_w) / 2), (float)((size - drawn_h) / 2)));
  gdk_paintable_snapshot(self->paintable, snapshot, drawn_w, drawn_h);
  gtk_snapshot_restore(snapshot);
  gtk_snapshot_pop(snapshot);
}

static void content_face_dispose(GObject *object) {
  g_clear_object(&SUNO_CONTENT_FACE(object)->paintable);
  G_OBJECT_CLASS(Suno_content_face_parent_class)->dispose(object);
}

static void Suno_content_face_class_init(SunoContentFaceClass *klass) {
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS(klass);
  G_OBJECT_CLASS(klass)->dispose = content_face_dispose;
  widget_class->measure = content_face_measure;
  widget_class->snapshot = content_face_snapshot;
  gtk_widget_class_set_accessible_role(widget_class, GTK_ACCESSIBLE_ROLE_PRESENTATION);
}

static void Suno_content_face_init(SunoContentFace *self) {
  gtk_widget_set_halign(GTK_WIDGET(self), GTK_ALIGN_CENTER);
  gtk_widget_set_valign(GTK_WIDGET(self), GTK_ALIGN_CENTER);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-file-face");
}

GtkWidget *_Suno_content_face_new(int size, double radius) {
  SunoContentFace *self = g_object_new(SUNO_TYPE_CONTENT_FACE, NULL);
  self->size = size;
  self->radius = radius;
  return GTK_WIDGET(self);
}

void _Suno_content_face_set_paintable(GtkWidget *face, GdkPaintable *paintable) {
  g_return_if_fail(SUNO_IS_CONTENT_FACE(face));
  g_set_object(&SUNO_CONTENT_FACE(face)->paintable, paintable);
  gtk_widget_queue_draw(face);
}

/* ── _CappedLayout (content_file.cap_width) ─────────────────────────────── */

#define SUNO_TYPE_CAPPED_LAYOUT (Suno_capped_layout_get_type())
G_DECLARE_FINAL_TYPE(SunoCappedLayout, Suno_capped_layout, SUNO, CAPPED_LAYOUT, GtkLayoutManager)

typedef struct {
  int width;
} SunoCappedLayoutPrivate;

SUNO_DEFINE_OPAQUE_SUBTYPE(SunoCappedLayout, Suno_capped_layout, GTK_TYPE_BOX_LAYOUT)

static void capped_layout_measure(GtkLayoutManager *manager, GtkWidget *widget, GtkOrientation orientation,
                                  int for_size, int *minimum, int *natural, int *minimum_baseline,
                                  int *natural_baseline) {
  GTK_LAYOUT_MANAGER_CLASS(Suno_capped_layout_parent_class)
      ->measure(manager, widget, orientation, for_size, minimum, natural, minimum_baseline, natural_baseline);
  if (orientation == GTK_ORIENTATION_HORIZONTAL) {
    SunoCappedLayoutPrivate *priv = Suno_capped_layout_get_instance_private(SUNO_CAPPED_LAYOUT(manager));
    *natural = MAX(*minimum, priv->width);
  }
}

static void Suno_capped_layout_class_init(SunoCappedLayoutClass *klass) {
  GTK_LAYOUT_MANAGER_CLASS(klass)->measure = capped_layout_measure;
}

static void Suno_capped_layout_init(SunoCappedLayout *self G_GNUC_UNUSED) {}

void _Suno_content_cap_width(GtkWidget *box, int width) {
  g_return_if_fail(GTK_IS_BOX(box));
  GtkLayoutManager *layout = g_object_new(SUNO_TYPE_CAPPED_LAYOUT, "orientation",
                                          gtk_orientable_get_orientation(GTK_ORIENTABLE(box)), NULL);
  ((SunoCappedLayoutPrivate *)Suno_capped_layout_get_instance_private(SUNO_CAPPED_LAYOUT(layout)))->width = width;
  gtk_widget_set_layout_manager(box, layout);
}

/* ── Card, ContentLitCard ───────────────────────────────────────────────── */

struct _SunoCard {
  GtkBox parent_instance;
};

G_DEFINE_FINAL_TYPE(SunoCard, Suno_card, GTK_TYPE_BOX)

static void Suno_card_class_init(SunoCardClass *klass G_GNUC_UNUSED) {}

static void Suno_card_init(SunoCard *self) {
  Suno_ui_install();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_VERTICAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-card");
}

GtkWidget *Suno_card_new(GtkWidget *child, gboolean padded) {
  g_return_val_if_fail(child == NULL || GTK_IS_WIDGET(child), NULL);
  GtkWidget *self = g_object_new(SUNO_TYPE_CARD, NULL);
  Suno_ui_set_css_class(self, "padded", padded);
  if (child != NULL)
    gtk_box_append(GTK_BOX(self), child);
  return self;
}

void Suno_card_set_recessed(SunoCard *self, gboolean recessed) {
  g_return_if_fail(SUNO_IS_CARD(self));
  /* A well in the page rather than a chip on it (v70 .ccard: Contacts' cards). */
  Suno_ui_set_css_class(GTK_WIDGET(self), "recessed", recessed);
}

void Suno_card_set_shape(SunoCard *self, const char *shape) {
  g_return_if_fail(SUNO_IS_CARD(self));
  g_return_if_fail(g_strcmp0(shape, "regular") == 0 || g_strcmp0(shape, "stat") == 0);
  Suno_ui_set_css_class(GTK_WIDGET(self), "stat", g_str_equal(shape, "stat"));
}

struct _SunoContentLitCard {
  GtkBox parent_instance;
};

G_DEFINE_FINAL_TYPE(SunoContentLitCard, Suno_content_lit_card, GTK_TYPE_BOX)

static void Suno_content_lit_card_class_init(SunoContentLitCardClass *klass G_GNUC_UNUSED) {}

static void Suno_content_lit_card_init(SunoContentLitCard *self) {
  Suno_ui_install();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_VERTICAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-lit-card");
}

GtkWidget *Suno_content_lit_card_new(GtkWidget *child, gboolean padded) {
  g_return_val_if_fail(child == NULL || GTK_IS_WIDGET(child), NULL);
  GtkWidget *self = g_object_new(SUNO_TYPE_CONTENT_LIT_CARD, NULL);
  Suno_ui_set_css_class(self, "padded", padded);
  if (child != NULL)
    gtk_box_append(GTK_BOX(self), child);
  return self;
}

void Suno_content_lit_card_set_night(SunoContentLitCard *self, gboolean night) {
  g_return_if_fail(SUNO_IS_CONTENT_LIT_CARD(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "night", night);
}

/* ── PersonAvatar ───────────────────────────────────────────────────────── */

struct _SunoPersonAvatar {
  GtkWidget parent_instance;
  char *name;
  int size;
  int hue; /* -1: from the name */
  GdkPaintable *picture;
};

G_DEFINE_FINAL_TYPE(SunoPersonAvatar, Suno_person_avatar, GTK_TYPE_WIDGET)

static void person_avatar_rebuild(SunoPersonAvatar *self) {
  GtkWidget *widget = GTK_WIDGET(self);
  GtkWidget *child;
  while ((child = gtk_widget_get_first_child(widget)) != NULL)
    gtk_widget_unparent(child);
  /* The person's hue (v70 .av); taken from the name when none is known, so a
   * person looks the same in every app. */
  Suno_ui_hue_class(widget, self->hue >= 0 ? self->hue : Suno_ui_person_hue(self->name));
  Suno_ui_set_css_class(widget, "picture", self->picture != NULL);
  if (self->picture != NULL) {
    GtkWidget *face = _Suno_content_face_new(self->size, self->size / 2.0);
    _Suno_content_face_set_paintable(face, self->picture);
    gtk_widget_set_parent(face, widget);
  } else {
    g_autofree char *text = Suno_ui_initials(self->name);
    GtkWidget *label;
    if (text[0] != '\0') {
      label = gtk_label_new(text);
      /* Initials grow with the face: v70 av0 sets round(size × .36). */
      PangoAttrList *attributes = pango_attr_list_new();
      pango_attr_list_insert(attributes,
                             pango_attr_size_new_absolute((int)(MAX(11.0, self->size * 0.36) * PANGO_SCALE)));
      gtk_label_set_attributes(GTK_LABEL(label), attributes);
      pango_attr_list_unref(attributes);
    } else {
      label = Suno_ui_icon_image("user", 0);
    }
    gtk_widget_add_css_class(label, "SunoUI-avatar-initials");
    gtk_widget_set_parent(label, widget);
  }
  Suno_ui_set_css_class(widget, "large", self->size >= 40);
  Suno_ui_set_css_class(widget, "small", self->size < 40);
  gtk_widget_queue_resize(widget);
}

static void person_avatar_measure(GtkWidget *widget, GtkOrientation orientation G_GNUC_UNUSED,
                                  int for_size G_GNUC_UNUSED, int *minimum, int *natural,
                                  int *minimum_baseline, int *natural_baseline) {
  *minimum = *natural = SUNO_PERSON_AVATAR(widget)->size;
  *minimum_baseline = *natural_baseline = -1;
}

static void person_avatar_size_allocate(GtkWidget *widget, int width, int height, int baseline) {
  GtkWidget *child = gtk_widget_get_first_child(widget);
  if (child != NULL)
    gtk_widget_allocate(child, width, height, baseline, NULL);
}

static void person_avatar_dispose(GObject *object) {
  GtkWidget *child;
  while ((child = gtk_widget_get_first_child(GTK_WIDGET(object))) != NULL)
    gtk_widget_unparent(child);
  g_clear_object(&SUNO_PERSON_AVATAR(object)->picture);
  G_OBJECT_CLASS(Suno_person_avatar_parent_class)->dispose(object);
}

static void person_avatar_finalize(GObject *object) {
  g_free(SUNO_PERSON_AVATAR(object)->name);
  G_OBJECT_CLASS(Suno_person_avatar_parent_class)->finalize(object);
}

static void Suno_person_avatar_class_init(SunoPersonAvatarClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS(klass);
  object_class->dispose = person_avatar_dispose;
  object_class->finalize = person_avatar_finalize;
  widget_class->measure = person_avatar_measure;
  widget_class->size_allocate = person_avatar_size_allocate;
  gtk_widget_class_set_accessible_role(widget_class, GTK_ACCESSIBLE_ROLE_PRESENTATION);
}

static void Suno_person_avatar_init(SunoPersonAvatar *self) {
  Suno_ui_install();
  gtk_widget_set_halign(GTK_WIDGET(self), GTK_ALIGN_CENTER);
  gtk_widget_set_valign(GTK_WIDGET(self), GTK_ALIGN_CENTER);
  gtk_widget_set_overflow(GTK_WIDGET(self), GTK_OVERFLOW_HIDDEN);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-avatar");
  self->name = g_strdup("");
  self->size = 40;
  self->hue = -1;
}

GtkWidget *Suno_person_avatar_new(const char *name, int size) {
  g_return_val_if_fail(name != NULL, NULL);
  SunoPersonAvatar *self = g_object_new(SUNO_TYPE_PERSON_AVATAR, NULL);
  g_free(self->name);
  self->name = g_strdup(name);
  self->size = size > 0 ? size : 40;
  person_avatar_rebuild(self);
  return GTK_WIDGET(self);
}

void Suno_person_avatar_set_picture(SunoPersonAvatar *self, GdkPaintable *picture) {
  g_return_if_fail(SUNO_IS_PERSON_AVATAR(self));
  g_return_if_fail(picture == NULL || GDK_IS_PAINTABLE(picture));
  g_set_object(&self->picture, picture);
  person_avatar_rebuild(self);
}

void Suno_person_avatar_set_name(SunoPersonAvatar *self, const char *name) {
  g_return_if_fail(SUNO_IS_PERSON_AVATAR(self));
  g_return_if_fail(name != NULL);
  g_free(self->name);
  self->name = g_strdup(name);
  person_avatar_rebuild(self);
}

void Suno_person_avatar_set_hue(SunoPersonAvatar *self, int hue) {
  g_return_if_fail(SUNO_IS_PERSON_AVATAR(self));
  self->hue = hue < 0 ? -1 : hue % 360;
  person_avatar_rebuild(self);
}

static void person_avatar_set_size(SunoPersonAvatar *self, int size) {
  self->size = size;
  person_avatar_rebuild(self);
}

/* ── AccountCard ────────────────────────────────────────────────────────── */

struct _SunoAccountCard {
  GtkButton parent_instance;
  SunoPersonAvatar *avatar;
  GtkWidget *well;
};

G_DEFINE_FINAL_TYPE(SunoAccountCard, Suno_account_card, GTK_TYPE_BUTTON)

/* Recessed, the row is the button and the well is drawn around it,
 * recessed_padding out on every side: a real CSS node allocated past the
 * button's own box, so apps and measurements see the row as the control. */
static void account_card_measure(GtkWidget *widget, GtkOrientation orientation, int for_size, int *minimum,
                                 int *natural, int *minimum_baseline, int *natural_baseline) {
  GtkWidget *child = gtk_button_get_child(GTK_BUTTON(widget));
  *minimum = *natural = 0;
  *minimum_baseline = *natural_baseline = -1;
  if (child != NULL)
    gtk_widget_measure(child, orientation, for_size, minimum, natural, minimum_baseline, natural_baseline);
}

static void account_card_size_allocate(GtkWidget *widget, int width, int height, int baseline) {
  SunoAccountCard *self = SUNO_ACCOUNT_CARD(widget);
  GtkWidget *child = gtk_button_get_child(GTK_BUTTON(widget));
  if (child != NULL)
    gtk_widget_allocate(child, width, height, baseline, NULL);
  if (self->well != NULL) {
    int pad = gtk_widget_has_css_class(widget, "compact") ? 0 : SUNO_UI_ACCOUNT_CARD_RECESSED_PADDING;
    GskTransform *shift = gsk_transform_translate(NULL, &GRAPHENE_POINT_INIT((float)-pad, (float)-pad));
    gtk_widget_allocate(self->well, width + 2 * pad, height + 2 * pad, -1, shift);
  }
}

static void account_card_dispose(GObject *object) {
  SunoAccountCard *self = SUNO_ACCOUNT_CARD(object);
  g_clear_pointer(&self->well, gtk_widget_unparent);
  G_OBJECT_CLASS(Suno_account_card_parent_class)->dispose(object);
}

static void Suno_account_card_class_init(SunoAccountCardClass *klass) {
  G_OBJECT_CLASS(klass)->dispose = account_card_dispose;
  GTK_WIDGET_CLASS(klass)->measure = account_card_measure;
  GTK_WIDGET_CLASS(klass)->size_allocate = account_card_size_allocate;
}

static void Suno_account_card_init(SunoAccountCard *self) {
  Suno_ui_install();
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-account-card");
}

GtkWidget *Suno_account_card_new(const char *name, const char *caption) {
  g_return_val_if_fail(name != NULL, NULL);
  if (caption == NULL)
    caption = "Suno account";
  SunoAccountCard *self = g_object_new(SUNO_TYPE_ACCOUNT_CARD, NULL);
  GtkWidget *line = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(line, "SunoUI-account-content");
  self->avatar = SUNO_PERSON_AVATAR(Suno_person_avatar_new(name, SUNO_UI_ACCOUNT_CARD_AVATAR));
  gtk_box_append(GTK_BOX(line), GTK_WIDGET(self->avatar));
  GtkWidget *text = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_hexpand(text, TRUE);
  gtk_widget_set_valign(text, GTK_ALIGN_CENTER);
  GtkWidget *title = gtk_label_new(name);
  gtk_label_set_xalign(GTK_LABEL(title), 0);
  gtk_label_set_ellipsize(GTK_LABEL(title), PANGO_ELLIPSIZE_END);
  gtk_widget_add_css_class(title, "SunoUI-account-name");
  gtk_box_append(GTK_BOX(text), title);
  GtkWidget *sub = gtk_label_new(caption);
  gtk_label_set_xalign(GTK_LABEL(sub), 0);
  gtk_label_set_ellipsize(GTK_LABEL(sub), PANGO_ELLIPSIZE_END);
  gtk_widget_add_css_class(sub, "SunoUI-t-caption");
  gtk_box_append(GTK_BOX(text), sub);
  gtk_box_append(GTK_BOX(line), text);
  GtkWidget *chevron = Suno_ui_icon_image("chevron-right", 0);
  gtk_widget_add_css_class(chevron, "SunoUI-account-chevron");
  gtk_box_append(GTK_BOX(line), chevron);
  gtk_button_set_child(GTK_BUTTON(self), line);
  g_autofree char *label = g_strdup_printf("%s, %s", name, caption);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), label);
  return GTK_WIDGET(self);
}

void Suno_account_card_set_picture(SunoAccountCard *self, GdkPaintable *picture) {
  g_return_if_fail(SUNO_IS_ACCOUNT_CARD(self));
  Suno_person_avatar_set_picture(self->avatar, picture);
}

void Suno_account_card_set_selected(SunoAccountCard *self, gboolean selected) {
  g_return_if_fail(SUNO_IS_ACCOUNT_CARD(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "on", selected);
}

void Suno_account_card_set_recessed(SunoAccountCard *self, gboolean recessed) {
  g_return_if_fail(SUNO_IS_ACCOUNT_CARD(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "recessed", recessed);
  person_avatar_set_size(self->avatar, recessed ? SUNO_UI_ACCOUNT_CARD_RECESSED_AVATAR : SUNO_UI_ACCOUNT_CARD_AVATAR);
  if (recessed && self->well == NULL) {
    self->well = g_object_new(GTK_TYPE_BOX, "can-target", FALSE, "accessible-role",
                              GTK_ACCESSIBLE_ROLE_PRESENTATION, NULL);
    gtk_widget_add_css_class(self->well, "SunoUI-account-well");
    gtk_widget_insert_before(self->well, GTK_WIDGET(self), gtk_button_get_child(GTK_BUTTON(self)));
    gtk_widget_set_layout_manager(GTK_WIDGET(self), NULL);
  } else if (!recessed && self->well != NULL) {
    g_clear_pointer(&self->well, gtk_widget_unparent);
    gtk_widget_set_layout_manager(GTK_WIDGET(self), gtk_bin_layout_new());
  }
}

void Suno_account_card_set_compact(SunoAccountCard *self, gboolean compact) {
  g_return_if_fail(SUNO_IS_ACCOUNT_CARD(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "compact", compact);
  gboolean recessed = gtk_widget_has_css_class(GTK_WIDGET(self), "recessed");
  person_avatar_set_size(self->avatar, compact ? SUNO_UI_ACCOUNT_CARD_COMPACT_AVATAR
                                       : recessed ? SUNO_UI_ACCOUNT_CARD_RECESSED_AVATAR : SUNO_UI_ACCOUNT_CARD_AVATAR);
}

void Suno_account_card_set_hue(SunoAccountCard *self, int hue) {
  g_return_if_fail(SUNO_IS_ACCOUNT_CARD(self));
  Suno_person_avatar_set_hue(self->avatar, hue);
}

/* ── ContentLitHeader ───────────────────────────────────────────────────── */

#define SUNO_TYPE_LIT_PICTURE (Suno_lit_picture_get_type())
G_DECLARE_FINAL_TYPE(SunoLitPicture, Suno_lit_picture, SUNO, LIT_PICTURE, GtkWidget)

/* The photo, blown up, blurred and saturated, fading out downwards (v70 .mlight). */
struct _SunoLitPicture {
  GtkWidget parent_instance;
  GdkPaintable *paintable;
  double focus_x, focus_y;
};

G_DEFINE_FINAL_TYPE(SunoLitPicture, Suno_lit_picture, GTK_TYPE_WIDGET)

/* CSS saturate() as a Gsk colour matrix (the matrix GTK uses for the filter). */
static void saturation_matrix(graphene_matrix_t *matrix, float s) {
  const float values[16] = {
      0.213f + 0.787f * s, 0.213f - 0.213f * s, 0.213f - 0.213f * s, 0.0f,
      0.715f - 0.715f * s, 0.715f + 0.285f * s, 0.715f - 0.715f * s, 0.0f,
      0.072f - 0.072f * s, 0.072f - 0.072f * s, 0.072f + 0.928f * s, 0.0f,
      0.0f,                0.0f,                0.0f,                1.0f};
  graphene_matrix_init_from_float(matrix, values);
}

static void lit_picture_snapshot(GtkWidget *widget, GtkSnapshot *snapshot) {
  SunoLitPicture *self = SUNO_LIT_PICTURE(widget);
  float width = (float)gtk_widget_get_width(widget), height = (float)gtk_widget_get_height(widget);
  if (self->paintable == NULL || width <= 0 || height <= 0)
    return;
  float top = SUNO_UI_LIT_HEADER_LIGHT_TOP, tall = SUNO_UI_LIT_HEADER_LIGHT_HEIGHT;
  float left = -0.10f * width, wide = 1.20f * width;
  float image_w = wide * SUNO_UI_LIT_HEADER_LIGHT_ZOOM_PCT / 100.0f;
  int intrinsic_w = gdk_paintable_get_intrinsic_width(self->paintable);
  int intrinsic_h = gdk_paintable_get_intrinsic_height(self->paintable);
  float ratio = (float)(intrinsic_h > 0 ? intrinsic_h : 1) / (float)(intrinsic_w > 0 ? intrinsic_w : 1);
  float image_h = image_w * ratio;
  float x = left + (wide - image_w) * (float)self->focus_x;
  float y = top + (tall - image_h) * (float)self->focus_y;
  graphene_rect_t area = GRAPHENE_RECT_INIT(left, top, wide, tall);
  gtk_snapshot_push_clip(snapshot, &GRAPHENE_RECT_INIT(0, 0, width, height));
  gtk_snapshot_push_mask(snapshot, GSK_MASK_MODE_ALPHA);
  const GskColorStop stops[2] = {
      {SUNO_UI_LIT_HEADER_MASK_START_PCT / 100.0f, {0, 0, 0, 1}},
      {SUNO_UI_LIT_HEADER_MASK_END_PCT / 100.0f, {0, 0, 0, 0}},
  };
  gtk_snapshot_append_linear_gradient(snapshot, &area, &GRAPHENE_POINT_INIT(0, top),
                                      &GRAPHENE_POINT_INIT(0, top + tall), stops, 2);
  gtk_snapshot_pop(snapshot);
  gtk_snapshot_push_blur(snapshot, SUNO_UI_LIT_HEADER_BLUR);
  graphene_matrix_t matrix;
  saturation_matrix(&matrix, (float)SUNO_UI_LIT_HEADER_SATURATE_SCALE);
  graphene_vec4_t offset;
  graphene_vec4_init(&offset, 0, 0, 0, 0);
  gtk_snapshot_push_color_matrix(snapshot, &matrix, &offset);
  gtk_snapshot_push_clip(snapshot, &area);
  gtk_snapshot_save(snapshot);
  gtk_snapshot_translate(snapshot, &GRAPHENE_POINT_INIT(x, y));
  gdk_paintable_snapshot(self->paintable, snapshot, image_w, image_h);
  gtk_snapshot_restore(snapshot);
  gtk_snapshot_pop(snapshot); /* clip to the area */
  gtk_snapshot_pop(snapshot); /* colour matrix */
  gtk_snapshot_pop(snapshot); /* blur */
  gtk_snapshot_pop(snapshot); /* mask */
  gtk_snapshot_pop(snapshot); /* clip to the widget */
}

static void lit_picture_dispose(GObject *object) {
  g_clear_object(&SUNO_LIT_PICTURE(object)->paintable);
  G_OBJECT_CLASS(Suno_lit_picture_parent_class)->dispose(object);
}

static void Suno_lit_picture_class_init(SunoLitPictureClass *klass) {
  G_OBJECT_CLASS(klass)->dispose = lit_picture_dispose;
  GTK_WIDGET_CLASS(klass)->snapshot = lit_picture_snapshot;
  gtk_widget_class_set_accessible_role(GTK_WIDGET_CLASS(klass), GTK_ACCESSIBLE_ROLE_PRESENTATION);
}

static void Suno_lit_picture_init(SunoLitPicture *self) {
  gtk_widget_set_can_target(GTK_WIDGET(self), FALSE);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-lit-picture");
  self->focus_x = self->focus_y = 0.5;
}

/* The hue glow's slot: a plain widget, as the Python part's HueGlow (css name "widget"). */
G_DECLARE_FINAL_TYPE(SunoLitGlow, Suno_lit_glow, SUNO, LIT_GLOW, GtkWidget)
struct _SunoLitGlow {
  GtkWidget parent_instance;
};
G_DEFINE_FINAL_TYPE(SunoLitGlow, Suno_lit_glow, GTK_TYPE_WIDGET)
static void Suno_lit_glow_class_init(SunoLitGlowClass *klass G_GNUC_UNUSED) {}
static void Suno_lit_glow_init(SunoLitGlow *self G_GNUC_UNUSED) {}

struct _SunoContentLitHeader {
  GtkWidget parent_instance;
  SunoLitPicture *picture;
  GtkWidget *wash;
  GtkWidget *glow; /* ID2's hue glow (rows family): hidden until hues or tone="Suno" light it */
  char *tone; /* the category given, or NULL */
  char *name;
  int hue;    /* -1: none given */
  const char *wash_class;
};

G_DEFINE_FINAL_TYPE(SunoContentLitHeader, Suno_content_lit_header, GTK_TYPE_WIDGET)

static const char *const lit_tones[] = SUNO_UI_CATEGORY_ORDER;

static gboolean is_tone(const char *name) {
  for (guint i = 0; name != NULL && i < G_N_ELEMENTS(lit_tones); i++)
    if (g_str_equal(lit_tones[i], name))
      return TRUE;
  return FALSE;
}

static void lit_header_refresh_wash(SunoContentLitHeader *self) {
  if (self->wash_class != NULL && is_tone(self->wash_class))
    gtk_widget_remove_css_class(self->wash, self->wash_class);
  if (self->tone != NULL && self->hue < 0) {
    Suno_ui_hue_class(self->wash, -1);
    self->wash_class = g_intern_string(self->tone);
    gtk_widget_add_css_class(self->wash, self->tone);
  } else {
    self->wash_class =
        Suno_ui_hue_class(self->wash, self->hue >= 0 ? self->hue : Suno_ui_person_hue(self->name));
  }
}

static void lit_header_measure(GtkWidget *widget G_GNUC_UNUSED, GtkOrientation orientation,
                               int for_size G_GNUC_UNUSED, int *minimum, int *natural, int *minimum_baseline,
                               int *natural_baseline) {
  *minimum = *natural = orientation == GTK_ORIENTATION_VERTICAL ? SUNO_UI_LIT_HEADER_WASH_HEIGHT : 0;
  *minimum_baseline = *natural_baseline = -1;
}

static void lit_header_size_allocate(GtkWidget *widget, int width, int height, int baseline) {
  SunoContentLitHeader *self = SUNO_CONTENT_LIT_HEADER(widget);
  /* The photo's light shows down to where it fades out; the wash runs the
   * header's full height. */
  int light = MAX(0, MIN(height, SUNO_UI_LIT_HEADER_LIGHT_TOP + SUNO_UI_LIT_HEADER_LIGHT_HEIGHT));
  gtk_widget_allocate(GTK_WIDGET(self->picture), width, light, baseline, NULL);
  gtk_widget_allocate(self->wash, width, height, baseline, NULL);
  gtk_widget_allocate(self->glow, width, height, baseline, NULL);
}

static void lit_header_dispose(GObject *object) {
  SunoContentLitHeader *self = SUNO_CONTENT_LIT_HEADER(object);
  if (self->picture != NULL) {
    gtk_widget_unparent(GTK_WIDGET(self->picture));
    self->picture = NULL;
  }
  g_clear_pointer(&self->wash, gtk_widget_unparent);
  g_clear_pointer(&self->glow, gtk_widget_unparent);
  G_OBJECT_CLASS(Suno_content_lit_header_parent_class)->dispose(object);
}

static void lit_header_finalize(GObject *object) {
  SunoContentLitHeader *self = SUNO_CONTENT_LIT_HEADER(object);
  g_free(self->tone);
  g_free(self->name);
  G_OBJECT_CLASS(Suno_content_lit_header_parent_class)->finalize(object);
}

static void Suno_content_lit_header_class_init(SunoContentLitHeaderClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS(klass);
  object_class->dispose = lit_header_dispose;
  object_class->finalize = lit_header_finalize;
  widget_class->measure = lit_header_measure;
  widget_class->size_allocate = lit_header_size_allocate;
  gtk_widget_class_set_accessible_role(widget_class, GTK_ACCESSIBLE_ROLE_PRESENTATION);
}

static void Suno_content_lit_header_init(SunoContentLitHeader *self) {
  Suno_ui_install();
  GtkWidget *widget = GTK_WIDGET(self);
  gtk_widget_set_can_target(widget, FALSE);
  gtk_widget_set_focusable(widget, FALSE);
  gtk_widget_set_hexpand(widget, TRUE);
  gtk_widget_set_valign(widget, GTK_ALIGN_START);
  gtk_widget_add_css_class(widget, "SunoUI-lit-header");
  self->picture = g_object_new(SUNO_TYPE_LIT_PICTURE, NULL);
  gtk_widget_set_parent(GTK_WIDGET(self->picture), widget);
  self->wash = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_set_can_target(self->wash, FALSE);
  gtk_widget_add_css_class(self->wash, "SunoUI-lit-wash");
  gtk_widget_set_parent(self->wash, widget);
  /* The Python part's HueGlow slot, the same tree; C draws no glow yet (hues=, tone="Suno"). */
  self->glow = g_object_new(Suno_lit_glow_get_type(), "can-target", FALSE, "visible", FALSE, "accessible-role",
                            GTK_ACCESSIBLE_ROLE_PRESENTATION, NULL);
  gtk_widget_add_css_class(self->glow, "SunoUI-lit-glow");
  gtk_widget_set_parent(self->glow, widget);
  self->hue = -1;
  self->name = g_strdup("");
  Suno_content_lit_header_set_source(self, NULL, NULL, NULL);
}

GtkWidget *Suno_content_lit_header_new(void) {
  return g_object_new(SUNO_TYPE_CONTENT_LIT_HEADER, NULL);
}

void Suno_content_lit_header_set_source(SunoContentLitHeader *self, GdkPaintable *picture, const char *tone,
                                        const char *name) {
  g_return_if_fail(SUNO_IS_CONTENT_LIT_HEADER(self));
  g_return_if_fail(picture == NULL || GDK_IS_PAINTABLE(picture));
  if (tone != NULL && !is_tone(tone)) {
    g_critical("a lit header's tone is one of create, work, media, play, tools (not '%s')", tone);
    return;
  }
  g_free(self->tone);
  self->tone = g_strdup(tone);
  g_free(self->name);
  self->name = g_strdup(name != NULL ? name : "");
  lit_header_refresh_wash(self);
  g_set_object(&self->picture->paintable, picture);
  gtk_widget_set_visible(GTK_WIDGET(self->picture), picture != NULL);
  gtk_widget_queue_draw(GTK_WIDGET(self->picture));
}

void Suno_content_lit_header_set_hue(SunoContentLitHeader *self, int hue) {
  g_return_if_fail(SUNO_IS_CONTENT_LIT_HEADER(self));
  self->hue = hue < 0 ? -1 : hue % 360;
  lit_header_refresh_wash(self);
}

void Suno_content_lit_header_set_focus(SunoContentLitHeader *self, double x, double y) {
  g_return_if_fail(SUNO_IS_CONTENT_LIT_HEADER(self));
  self->picture->focus_x = CLAMP(x, 0.0, 1.0);
  self->picture->focus_y = CLAMP(y, 0.0, 1.0);
  gtk_widget_queue_draw(GTK_WIDGET(self->picture));
}
