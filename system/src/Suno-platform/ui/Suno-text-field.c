/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_field.py: TextField, HeroTitleField, ParagraphField. */
#include "Suno-text-field.h"
#include "Suno-ui-private.h"

/* What the field holds → the input purpose the on-screen keyboard uses. */
static const struct {
  const char *name;
  GtkInputPurpose purpose;
} field_purposes[] = {
    {"text", GTK_INPUT_PURPOSE_FREE_FORM}, {"name", GTK_INPUT_PURPOSE_NAME},
    {"email", GTK_INPUT_PURPOSE_EMAIL},    {"url", GTK_INPUT_PURPOSE_URL},
    {"phone", GTK_INPUT_PURPOSE_PHONE},    {"number", GTK_INPUT_PURPOSE_NUMBER},
    {"password", GTK_INPUT_PURPOSE_PASSWORD}, {"pin", GTK_INPUT_PURPOSE_PIN},
};

/* ── TextField ──────────────────────────────────────────────────────────── */

enum { FIELD_CHANGED, FIELD_ACTIVATE, FIELD_N_SIGNALS };
static guint field_signals[FIELD_N_SIGNALS];

struct _SunoTextField {
  GtkBox parent_instance;
  GtkWidget *label;
  GtkWidget *entry;
  GtkWidget *hint;
};

G_DEFINE_FINAL_TYPE(SunoTextField, Suno_text_field, GTK_TYPE_BOX)

static void field_entry_changed(GtkEditable *editable, gpointer user_data) {
  g_signal_emit(user_data, field_signals[FIELD_CHANGED], 0, gtk_editable_get_text(editable));
}

static void field_entry_activate(GtkEntry *entry, gpointer user_data) {
  g_signal_emit(user_data, field_signals[FIELD_ACTIVATE], 0, gtk_editable_get_text(GTK_EDITABLE(entry)));
}

static gboolean text_field_grab_focus(GtkWidget *widget) {
  return gtk_widget_grab_focus(SUNO_TEXT_FIELD(widget)->entry);
}

static void Suno_text_field_class_init(SunoTextFieldClass *klass) {
  GTK_WIDGET_CLASS(klass)->grab_focus = text_field_grab_focus;
  /**
   * SunoTextField::changed:
   * @self: the field
   * @text: what is in it now
   */
  field_signals[FIELD_CHANGED] = g_signal_new("changed", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL,
                                              NULL, NULL, G_TYPE_NONE, 1, G_TYPE_STRING);
  /**
   * SunoTextField::activate:
   * @self: the field
   * @text: what is in it
   *
   * Enter was pressed in the well.
   */
  field_signals[FIELD_ACTIVATE] = g_signal_new("activate", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL,
                                               NULL, NULL, G_TYPE_NONE, 1, G_TYPE_STRING);
}

static void Suno_text_field_init(SunoTextField *self) {
  Suno_ui_install();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_VERTICAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-field");
}

GtkWidget *Suno_text_field_new(const char *label, const char *purpose) {
  if (purpose == NULL)
    purpose = "text";
  int found = -1;
  for (guint i = 0; i < G_N_ELEMENTS(field_purposes); i++)
    if (g_str_equal(field_purposes[i].name, purpose))
      found = (int)i;
  if (found < 0) {
    g_critical("a field's purpose is one of text, name, email, url, phone, number, password, pin (not '%s')",
               purpose);
    return NULL;
  }
  g_autofree char *stripped = g_strstrip(g_strdup(label != NULL ? label : ""));
  if (stripped[0] == '\0') {
    g_critical("a text field needs a label");
    return NULL;
  }
  SunoTextField *self = g_object_new(SUNO_TYPE_TEXT_FIELD, NULL);
  self->label = gtk_label_new(label);
  gtk_label_set_xalign(GTK_LABEL(self->label), 0);
  gtk_widget_add_css_class(self->label, "SunoUI-field-label");
  gtk_box_append(GTK_BOX(self), self->label);
  gboolean secret = g_str_equal(purpose, "password") || g_str_equal(purpose, "pin");
  self->entry = g_object_new(GTK_TYPE_ENTRY, "input-purpose", field_purposes[found].purpose, "visibility", !secret,
                             NULL);
  gtk_widget_add_css_class(self->entry, "SunoUI-field-well");
  gtk_accessible_update_relation(GTK_ACCESSIBLE(self->entry), GTK_ACCESSIBLE_RELATION_LABELLED_BY, self->label, NULL,
                                 -1);
  gtk_box_append(GTK_BOX(self), self->entry);
  self->hint = gtk_label_new(NULL);
  gtk_label_set_xalign(GTK_LABEL(self->hint), 0);
  gtk_label_set_wrap(GTK_LABEL(self->hint), TRUE);
  gtk_widget_set_visible(self->hint, FALSE);
  gtk_widget_add_css_class(self->hint, "SunoUI-field-hint");
  gtk_box_append(GTK_BOX(self), self->hint);
  g_signal_connect(self->entry, "changed", G_CALLBACK(field_entry_changed), self);
  g_signal_connect(self->entry, "activate", G_CALLBACK(field_entry_activate), self);
  return GTK_WIDGET(self);
}

void Suno_text_field_set_size(SunoTextField *self, const char *size) {
  g_return_if_fail(SUNO_IS_TEXT_FIELD(self));
  g_return_if_fail(g_strcmp0(size, "regular") == 0 || g_strcmp0(size, "panel") == 0);
  Suno_ui_set_css_class(GTK_WIDGET(self), "panel", g_str_equal(size, "panel"));
}

const char *Suno_text_field_get_size(SunoTextField *self) {
  g_return_val_if_fail(SUNO_IS_TEXT_FIELD(self), "regular");
  return gtk_widget_has_css_class(GTK_WIDGET(self), "panel") ? "panel" : "regular";
}

const char *Suno_text_field_get_text(SunoTextField *self) {
  g_return_val_if_fail(SUNO_IS_TEXT_FIELD(self), NULL);
  return gtk_editable_get_text(GTK_EDITABLE(self->entry));
}

void Suno_text_field_set_text(SunoTextField *self, const char *text) {
  g_return_if_fail(SUNO_IS_TEXT_FIELD(self));
  gtk_editable_set_text(GTK_EDITABLE(self->entry), text != NULL ? text : "");
}

void Suno_text_field_set_placeholder(SunoTextField *self, const char *placeholder) {
  g_return_if_fail(SUNO_IS_TEXT_FIELD(self));
  gtk_entry_set_placeholder_text(GTK_ENTRY(self->entry), placeholder != NULL && placeholder[0] ? placeholder : NULL);
}

void Suno_text_field_set_hint(SunoTextField *self, const char *hint) {
  g_return_if_fail(SUNO_IS_TEXT_FIELD(self));
  gboolean has = hint != NULL && hint[0] != '\0';
  gtk_label_set_label(GTK_LABEL(self->hint), has ? hint : "");
  gtk_widget_set_visible(self->hint, has);
  if (has)
    gtk_accessible_update_relation(GTK_ACCESSIBLE(self->entry), GTK_ACCESSIBLE_RELATION_DESCRIBED_BY, self->hint,
                                   NULL, -1);
}

/* ── HeroTitleField ─────────────────────────────────────────────────────── */

enum { HERO_COMMITTED, HERO_N_SIGNALS };
static guint hero_signals[HERO_N_SIGNALS];

struct _SunoHeroTitleField {
  GtkEntry parent_instance;
  char *before;
};

G_DEFINE_FINAL_TYPE(SunoHeroTitleField, Suno_hero_title_field, GTK_TYPE_ENTRY)

static void hero_unfocus(SunoHeroTitleField *self) {
  GtkRoot *root = gtk_widget_get_root(GTK_WIDGET(self));
  if (root != NULL)
    gtk_root_set_focus(root, NULL);
}

static void hero_remember(SunoHeroTitleField *self) {
  g_free(self->before);
  self->before = g_strdup(gtk_editable_get_text(GTK_EDITABLE(self)));
}

static void hero_focus_enter(GtkEventControllerFocus *controller G_GNUC_UNUSED, gpointer user_data) {
  hero_remember(user_data);
}

static gboolean hero_key_pressed(GtkEventControllerKey *controller G_GNUC_UNUSED, guint keyval,
                                 guint keycode G_GNUC_UNUSED, GdkModifierType state G_GNUC_UNUSED,
                                 gpointer user_data) {
  SunoHeroTitleField *self = user_data;
  if (keyval != GDK_KEY_Escape)
    return FALSE;
  gtk_editable_set_text(GTK_EDITABLE(self), self->before);
  hero_unfocus(self);
  return TRUE;
}

static void hero_activate(GtkEntry *entry, gpointer user_data G_GNUC_UNUSED) {
  Suno_hero_title_field_commit(SUNO_HERO_TITLE_FIELD(entry));
}

static void hero_finalize(GObject *object) {
  g_free(SUNO_HERO_TITLE_FIELD(object)->before);
  G_OBJECT_CLASS(Suno_hero_title_field_parent_class)->finalize(object);
}

static void Suno_hero_title_field_class_init(SunoHeroTitleFieldClass *klass) {
  G_OBJECT_CLASS(klass)->finalize = hero_finalize;
  /**
   * SunoHeroTitleField::committed:
   * @self: the field
   * @text: the new title
   *
   * Enter was pressed: the title is what is in the field now.
   */
  hero_signals[HERO_COMMITTED] = g_signal_new("committed", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL,
                                              NULL, NULL, G_TYPE_NONE, 1, G_TYPE_STRING);
}

static void Suno_hero_title_field_init(SunoHeroTitleField *self) {
  Suno_ui_install();
  GtkWidget *widget = GTK_WIDGET(self);
  gtk_editable_set_alignment(GTK_EDITABLE(self), 0.5f);
  gtk_widget_set_halign(widget, GTK_ALIGN_CENTER);
  gtk_entry_set_input_purpose(GTK_ENTRY(self), GTK_INPUT_PURPOSE_NAME);
  gtk_editable_set_width_chars(GTK_EDITABLE(self), 16);
  gtk_widget_add_css_class(widget, "SunoUI-hero-field");
  Suno_ui_apply_type(widget, "hero");
  self->before = g_strdup("");
  g_signal_connect(self, "activate", G_CALLBACK(hero_activate), NULL);
  GtkEventController *focus = gtk_event_controller_focus_new();
  g_signal_connect(focus, "enter", G_CALLBACK(hero_focus_enter), self);
  gtk_widget_add_controller(widget, focus);
  GtkEventController *keys = gtk_event_controller_key_new();
  gtk_event_controller_set_propagation_phase(keys, GTK_PHASE_CAPTURE);
  g_signal_connect(keys, "key-pressed", G_CALLBACK(hero_key_pressed), self);
  gtk_widget_add_controller(widget, keys);
}

GtkWidget *Suno_hero_title_field_new(const char *text, const char *placeholder) {
  if (placeholder == NULL)
    placeholder = "Name";
  SunoHeroTitleField *self = g_object_new(SUNO_TYPE_HERO_TITLE_FIELD, NULL);
  gtk_editable_set_text(GTK_EDITABLE(self), text != NULL ? text : "");
  gtk_entry_set_placeholder_text(GTK_ENTRY(self), placeholder);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), placeholder);
  hero_remember(self);
  Suno_hero_title_field_set_editable_title(self, TRUE);
  return GTK_WIDGET(self);
}

void Suno_hero_title_field_set_editable_title(SunoHeroTitleField *self, gboolean editable) {
  g_return_if_fail(SUNO_IS_HERO_TITLE_FIELD(self));
  gtk_editable_set_editable(GTK_EDITABLE(self), editable);
  gtk_widget_set_can_focus(GTK_WIDGET(self), editable);
  gtk_widget_set_focusable(GTK_WIDGET(self), editable);
  Suno_ui_set_css_class(GTK_WIDGET(self), "editable", editable);
}

void Suno_hero_title_field_commit(SunoHeroTitleField *self) {
  g_return_if_fail(SUNO_IS_HERO_TITLE_FIELD(self));
  hero_remember(self);
  g_signal_emit(self, hero_signals[HERO_COMMITTED], 0, self->before);
  hero_unfocus(self);
}

/* ── ParagraphField ─────────────────────────────────────────────────────── */

struct _SunoParagraphField {
  GtkTextView parent_instance;
  GtkWidget *placeholder;
};

G_DEFINE_FINAL_TYPE(SunoParagraphField, Suno_paragraph_field, GTK_TYPE_TEXT_VIEW)

static void paragraph_sync(GtkTextBuffer *buffer, gpointer user_data) {
  SunoParagraphField *self = user_data;
  gtk_widget_set_visible(self->placeholder, gtk_text_buffer_get_char_count(buffer) == 0);
}

static void Suno_paragraph_field_class_init(SunoParagraphFieldClass *klass G_GNUC_UNUSED) {}

static void Suno_paragraph_field_init(SunoParagraphField *self) {
  Suno_ui_install();
  GtkTextView *view = GTK_TEXT_VIEW(self);
  gtk_text_view_set_wrap_mode(view, GTK_WRAP_WORD_CHAR);
  gtk_text_view_set_accepts_tab(view, FALSE);
  gtk_widget_set_hexpand(GTK_WIDGET(self), TRUE);
  gtk_text_view_set_top_margin(view, 0);
  gtk_text_view_set_bottom_margin(view, 0);
  gtk_text_view_set_left_margin(view, 0);
  gtk_text_view_set_right_margin(view, 0);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-paragraph-field");
  Suno_ui_apply_type(GTK_WIDGET(self), "body");
}

GtkWidget *Suno_paragraph_field_new(const char *text, const char *placeholder, const char *label) {
  SunoParagraphField *self = g_object_new(SUNO_TYPE_PARAGRAPH_FIELD, NULL);
  GtkTextBuffer *buffer = gtk_text_view_get_buffer(GTK_TEXT_VIEW(self));
  gtk_text_buffer_set_text(buffer, text != NULL ? text : "", -1);
  self->placeholder = gtk_label_new(placeholder != NULL ? placeholder : "");
  gtk_label_set_xalign(GTK_LABEL(self->placeholder), 0);
  gtk_widget_set_can_target(self->placeholder, FALSE);
  gtk_widget_add_css_class(self->placeholder, "SunoUI-paragraph-placeholder");
  gtk_text_view_add_overlay(GTK_TEXT_VIEW(self), self->placeholder, 0, 0);
  g_signal_connect(buffer, "changed", G_CALLBACK(paragraph_sync), self);
  Suno_ui_set_accessible_label(GTK_WIDGET(self),
                               label != NULL && label[0] != '\0' ? label : (placeholder != NULL ? placeholder : ""));
  paragraph_sync(buffer, self);
  return GTK_WIDGET(self);
}

char *Suno_paragraph_field_get_text(SunoParagraphField *self) {
  g_return_val_if_fail(SUNO_IS_PARAGRAPH_FIELD(self), NULL);
  GtkTextBuffer *buffer = gtk_text_view_get_buffer(GTK_TEXT_VIEW(self));
  GtkTextIter start, end;
  gtk_text_buffer_get_bounds(buffer, &start, &end);
  return gtk_text_buffer_get_text(buffer, &start, &end, FALSE);
}

void Suno_paragraph_field_set_text(SunoParagraphField *self, const char *text) {
  g_return_if_fail(SUNO_IS_PARAGRAPH_FIELD(self));
  gtk_text_buffer_set_text(gtk_text_view_get_buffer(GTK_TEXT_VIEW(self)), text != NULL ? text : "", -1);
}
