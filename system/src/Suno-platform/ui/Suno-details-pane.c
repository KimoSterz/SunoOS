/* SPDX-License-Identifier: Apache-2.0 */
/* The details pane and its rows: the twin of structure_details.py (Python). */
#include "Suno-details-pane.h"
#include "Suno-layer-host.h"
#include "Suno-toast.h"
#include "Suno-island.h"
#include "Suno-ui-private.h"

/* A label that asks for no width: the pane's width decides (_label). */
static GtkWidget *pane_label(const char *text, const char *css, float xalign, gboolean ellipsize) {
  GtkWidget *label = gtk_label_new(text);
  gtk_label_set_xalign(GTK_LABEL(label), xalign);
  if (ellipsize) {
    gtk_label_set_ellipsize(GTK_LABEL(label), PANGO_ELLIPSIZE_END);
    gtk_label_set_max_width_chars(GTK_LABEL(label), 1);
  }
  gtk_widget_add_css_class(label, css);
  return label;
}

static char *who_label(const char *title, const char *subtitle) {
  if (subtitle != NULL && *subtitle != '\0')
    return g_strdup_printf("%s, %s", title, subtitle);
  return g_strdup(title);
}

/* ── DetailsRow ──────────────────────────────────────────────────────── */

enum { ROW_ACTIVATED, N_ROW_SIGNALS };
static guint row_signals[N_ROW_SIGNALS];

struct _SunoDetailsRow {
  GtkBox parent_instance;
  GtkWidget *button;
  GtkWidget *actions;
};

G_DEFINE_FINAL_TYPE(SunoDetailsRow, Suno_details_row, GTK_TYPE_BOX)

static void row_clicked(GtkButton *button G_GNUC_UNUSED, gpointer user_data) {
  g_signal_emit(user_data, row_signals[ROW_ACTIVATED], 0);
}

static void Suno_details_row_class_init(SunoDetailsRowClass *klass) {
  /**
   * SunoDetailsRow::activated:
   * @self: the row
   *
   * The row itself (not one of its actions) was activated.
   */
  row_signals[ROW_ACTIVATED] = g_signal_new("activated", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL,
                                            NULL, NULL, G_TYPE_NONE, 0);
}

static void Suno_details_row_init(SunoDetailsRow *self) {
  Suno_ui_install();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_HORIZONTAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-details-row");
}

GtkWidget *Suno_details_row_new(const char *title, const char *subtitle, GtkWidget *lead) {
  g_return_val_if_fail(title != NULL, NULL);
  g_return_val_if_fail(lead == NULL || GTK_IS_WIDGET(lead), NULL);
  SunoDetailsRow *self = g_object_new(SUNO_TYPE_DETAILS_ROW, NULL);
  self->button = gtk_button_new();
  gtk_widget_set_hexpand(self->button, TRUE);
  gtk_widget_add_css_class(self->button, "SunoUI-details-who");
  GtkWidget *line = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(line, "SunoUI-details-line");
  if (lead != NULL) {
    gtk_widget_set_valign(lead, GTK_ALIGN_CENTER);
    gtk_box_append(GTK_BOX(line), lead);
  }
  GtkWidget *text = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_valign(text, GTK_ALIGN_CENTER);
  gtk_widget_set_hexpand(text, TRUE);
  gtk_box_append(GTK_BOX(text), pane_label(title, "SunoUI-details-name", 0, TRUE));
  if (subtitle != NULL && *subtitle != '\0') {
    GtkWidget *sub = pane_label(subtitle, "SunoUI-details-sub", 0, TRUE);
    gtk_widget_set_tooltip_text(sub, subtitle);
    gtk_box_append(GTK_BOX(text), sub);
  }
  gtk_box_append(GTK_BOX(line), text);
  gtk_button_set_child(GTK_BUTTON(self->button), line);
  g_autofree char *name = who_label(title, subtitle);
  Suno_ui_set_accessible_label(self->button, name);
  g_signal_connect(self->button, "clicked", G_CALLBACK(row_clicked), self);
  gtk_box_append(GTK_BOX(self), self->button);
  self->actions = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_set_valign(self->actions, GTK_ALIGN_CENTER);
  gtk_widget_add_css_class(self->actions, "SunoUI-details-actions");
  gtk_widget_set_visible(self->actions, FALSE);
  gtk_box_append(GTK_BOX(self), self->actions);
  return GTK_WIDGET(self);
}

void Suno_details_row_add_action(SunoDetailsRow *self, const char *icon, const char *label,
                                 const char *action_name) {
  g_return_if_fail(SUNO_IS_DETAILS_ROW(self));
  g_return_if_fail(icon != NULL && label != NULL && action_name != NULL);
  GtkWidget *button = Suno_ui_icon_button(icon, label, "SunoUI-details-action", FALSE, NULL);
  gtk_actionable_set_detailed_action_name(GTK_ACTIONABLE(button), action_name);
  gtk_box_append(GTK_BOX(self->actions), button);
  gtk_widget_set_visible(self->actions, TRUE);
}

/* ── DetailsItem ─────────────────────────────────────────────────────── */

struct _SunoDetailsItem {
  GtkButton parent_instance;
  GtkWidget *line;
  GtkWidget *lead; /* the icon or the lead widget */
  GtkWidget *trail;
};

G_DEFINE_FINAL_TYPE(SunoDetailsItem, Suno_details_item, GTK_TYPE_BUTTON)

static void Suno_details_item_class_init(SunoDetailsItemClass *klass G_GNUC_UNUSED) {}

static void Suno_details_item_init(SunoDetailsItem *self) {
  Suno_ui_install();
  gtk_widget_set_hexpand(GTK_WIDGET(self), TRUE);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-details-item");
  self->line = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(self->line, "SunoUI-details-line");
  gtk_button_set_child(GTK_BUTTON(self), self->line);
}

GtkWidget *Suno_details_item_new(const char *title, const char *subtitle, const char *icon) {
  g_return_val_if_fail(title != NULL, NULL);
  SunoDetailsItem *self = g_object_new(SUNO_TYPE_DETAILS_ITEM, NULL);
  if (icon != NULL) {
    self->lead = Suno_ui_icon_image(icon, 0);
    gtk_widget_add_css_class(self->lead, "SunoUI-details-item-icon");
    gtk_widget_add_css_class(self->lead, "SunoUI-hue-tint"); /* the hue of the page it is on, if any */
    gtk_box_append(GTK_BOX(self->line), self->lead);
  }
  GtkWidget *text = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_valign(text, GTK_ALIGN_CENTER);
  gtk_widget_set_hexpand(text, TRUE);
  gtk_box_append(GTK_BOX(text), pane_label(title, "SunoUI-details-name", 0, TRUE));
  if (subtitle != NULL && *subtitle != '\0')
    gtk_box_append(GTK_BOX(text), pane_label(subtitle, "SunoUI-details-sub", 0, TRUE));
  gtk_box_append(GTK_BOX(self->line), text);
  g_autofree char *name = who_label(title, subtitle);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), name);
  return GTK_WIDGET(self);
}

void Suno_details_item_set_lead(SunoDetailsItem *self, GtkWidget *lead) {
  g_return_if_fail(SUNO_IS_DETAILS_ITEM(self));
  g_return_if_fail(lead == NULL || GTK_IS_WIDGET(lead));
  if (self->lead != NULL)
    gtk_box_remove(GTK_BOX(self->line), self->lead);
  self->lead = lead;
  if (lead != NULL) {
    gtk_widget_set_valign(lead, GTK_ALIGN_CENTER);
    gtk_box_prepend(GTK_BOX(self->line), lead);
  }
}

void Suno_details_item_set_trail(SunoDetailsItem *self, GtkWidget *trail) {
  g_return_if_fail(SUNO_IS_DETAILS_ITEM(self));
  g_return_if_fail(trail == NULL || GTK_IS_WIDGET(trail));
  if (self->trail != NULL)
    gtk_box_remove(GTK_BOX(self->line), self->trail);
  self->trail = trail;
  if (trail != NULL) {
    gtk_widget_set_valign(trail, GTK_ALIGN_CENTER);
    gtk_box_append(GTK_BOX(self->line), trail);
  }
}

void Suno_details_item_set_selected(SunoDetailsItem *self, gboolean selected) {
  g_return_if_fail(SUNO_IS_DETAILS_ITEM(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "on", selected);
}

/* ── AddRow ──────────────────────────────────────────────────────────── */

struct _SunoAddRow {
  GtkButton parent_instance;
  GtkWidget *shortcut;
  GtkWidget *text;
};

G_DEFINE_FINAL_TYPE(SunoAddRow, Suno_add_row, GTK_TYPE_BUTTON)

static void Suno_add_row_class_init(SunoAddRowClass *klass G_GNUC_UNUSED) {}

static void Suno_add_row_init(SunoAddRow *self) {
  Suno_ui_install();
  gtk_widget_set_hexpand(GTK_WIDGET(self), TRUE);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-add-row");
}

void Suno_add_row_set_document(SunoAddRow *self, gboolean document) {
  g_return_if_fail(SUNO_IS_ADD_ROW(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "document", document);
  if (self->text != NULL)
    gtk_label_set_max_width_chars(GTK_LABEL(self->text), document ? -1 : 1);
  gtk_widget_set_hexpand(GTK_WIDGET(self), !document);
  gtk_widget_set_halign(GTK_WIDGET(self), document ? GTK_ALIGN_START : GTK_ALIGN_FILL);
}

static void add_row_width(GtkWidget *widget, int width G_GNUC_UNUSED, gpointer data G_GNUC_UNUSED) {
  SunoAddRow *self = SUNO_ADD_ROW(widget);
  gtk_widget_set_visible(self->shortcut, !Suno_ui_is_phone(widget));
}

GtkWidget *Suno_add_row_new(const char *label, const char *icon, const char *shortcut) {
  g_return_val_if_fail(label != NULL, NULL);
  SunoAddRow *self = g_object_new(SUNO_TYPE_ADD_ROW, NULL);
  GtkWidget *line = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(line, "SunoUI-details-line");
  GtkWidget *mark = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_set_halign(mark, GTK_ALIGN_CENTER);
  gtk_widget_set_valign(mark, GTK_ALIGN_CENTER);
  gtk_widget_set_hexpand(mark, FALSE);
  gtk_widget_add_css_class(mark, "SunoUI-add-mark");
  GtkWidget *glyph = Suno_ui_icon_image(icon != NULL ? icon : "user-plus", 0);
  gtk_widget_set_hexpand(glyph, TRUE);
  gtk_widget_set_halign(glyph, GTK_ALIGN_CENTER);
  gtk_box_append(GTK_BOX(mark), glyph);
  gtk_box_append(GTK_BOX(line), mark);
  GtkWidget *text = pane_label(label, "SunoUI-add-label", 0, TRUE);
  self->text = text;
  gtk_widget_set_hexpand(text, TRUE);
  gtk_box_append(GTK_BOX(line), text);
  if (shortcut != NULL && *shortcut != '\0') {
    guint key = 0;
    GdkModifierType mods = 0;
    g_autofree char *shown = NULL;
    if (gtk_accelerator_parse(shortcut, &key, &mods) && key != 0)
      shown = gtk_accelerator_get_label(key, mods);
    self->shortcut = g_object_new(GTK_TYPE_LABEL, "label", shown != NULL ? shown : shortcut, "valign",
                                  GTK_ALIGN_CENTER, "accessible-role", GTK_ACCESSIBLE_ROLE_PRESENTATION, NULL);
    gtk_widget_add_css_class(self->shortcut, "SunoUI-add-shortcut");
    gtk_box_append(GTK_BOX(line), self->shortcut);
    gtk_accessible_update_property(GTK_ACCESSIBLE(self), GTK_ACCESSIBLE_PROPERTY_KEY_SHORTCUTS, shortcut, -1);
    Suno_ui_width_watch(GTK_WIDGET(self), add_row_width, NULL, (SUNO_TIER_PHONE_BELOW - 1));
  }
  gtk_button_set_child(GTK_BUTTON(self), line);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), label);
  return GTK_WIDGET(self);
}

/* ── FactRow ─────────────────────────────────────────────────────────── */

struct _SunoFactRow {
  GtkBox parent_instance;
  char *value;
};

G_DEFINE_FINAL_TYPE(SunoFactRow, Suno_fact_row, GTK_TYPE_BOX)

static void Suno_fact_row_finalize(GObject *object) {
  g_free(SUNO_FACT_ROW(object)->value);
  G_OBJECT_CLASS(Suno_fact_row_parent_class)->finalize(object);
}

static void Suno_fact_row_class_init(SunoFactRowClass *klass) {
  G_OBJECT_CLASS(klass)->finalize = Suno_fact_row_finalize;
  gtk_widget_class_set_accessible_role(GTK_WIDGET_CLASS(klass), GTK_ACCESSIBLE_ROLE_GROUP);
}

static void Suno_fact_row_init(SunoFactRow *self) {
  Suno_ui_install();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_HORIZONTAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-fact-row");
}

static void fact_copy_clicked(GtkButton *button G_GNUC_UNUSED, gpointer user_data) {
  Suno_fact_row_copy(user_data);
}

GtkWidget *Suno_fact_row_new(const char *icon, const char *label, const char *value, gboolean copy) {
  g_return_val_if_fail(icon != NULL && label != NULL && value != NULL, NULL);
  SunoFactRow *self = g_object_new(SUNO_TYPE_FACT_ROW, NULL);
  self->value = g_strdup(value);
  GtkWidget *glyph = Suno_ui_icon_image(icon, 0);
  gtk_widget_add_css_class(glyph, "SunoUI-fact-icon");
  gtk_box_append(GTK_BOX(self), glyph);
  GtkWidget *text = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_valign(text, GTK_ALIGN_CENTER);
  gtk_widget_set_hexpand(text, TRUE);
  gtk_box_append(GTK_BOX(text), pane_label(label, "SunoUI-fact-label", 0, TRUE));
  GtkWidget *shown = pane_label(value, "SunoUI-fact-value", 0, TRUE);
  gtk_label_set_selectable(GTK_LABEL(shown), TRUE);
  gtk_widget_set_can_focus(shown, FALSE);
  gtk_widget_set_tooltip_text(shown, value);
  gtk_box_append(GTK_BOX(text), shown);
  gtk_box_append(GTK_BOX(self), text);
  g_autofree char *name = g_strdup_printf("%s: %s", label, value);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), name);
  if (copy) {
    g_autofree char *lower = g_utf8_strdown(label, -1);
    g_autofree char *tip = g_strdup_printf("Copy %s", lower);
    GtkWidget *button = Suno_ui_icon_button("copy", tip, "SunoUI-fact-copy", FALSE, NULL);
    g_signal_connect(button, "clicked", G_CALLBACK(fact_copy_clicked), self);
    gtk_box_append(GTK_BOX(self), button);
  }
  return GTK_WIDGET(self);
}

void Suno_fact_row_copy(SunoFactRow *self) {
  g_return_if_fail(SUNO_IS_FACT_ROW(self));
  gdk_clipboard_set_text(gtk_widget_get_clipboard(GTK_WIDGET(self)), self->value);
  if (gtk_widget_get_root(GTK_WIDGET(self)) != NULL)
    Suno_toast_show(GTK_WIDGET(self), "Copied", "copied");
}

/* ── DetailsPhotos ───────────────────────────────────────────────────── */

#define PHOTO_COLUMNS 3

enum { PHOTO_ACTIVATED, N_PHOTO_SIGNALS };
static guint photo_signals[N_PHOTO_SIGNALS];

struct _SunoDetailsPhotos {
  GtkGrid parent_instance;
};

G_DEFINE_FINAL_TYPE(SunoDetailsPhotos, Suno_details_photos, GTK_TYPE_GRID)

static void Suno_details_photos_class_init(SunoDetailsPhotosClass *klass) {
  /**
   * SunoDetailsPhotos::photo-activated:
   * @self: the grid
   * @index: the photo's place in the list
   */
  photo_signals[PHOTO_ACTIVATED] = g_signal_new("photo-activated", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST,
                                                0, NULL, NULL, NULL, G_TYPE_NONE, 1, G_TYPE_UINT);
}

static void Suno_details_photos_init(SunoDetailsPhotos *self) {
  Suno_ui_install();
  gtk_grid_set_column_homogeneous(GTK_GRID(self), TRUE);
  gtk_grid_set_row_homogeneous(GTK_GRID(self), TRUE);
  gtk_grid_set_column_spacing(GTK_GRID(self), SUNO_UI_STRUCTURE_DETAILS_PHOTO_GAP);
  gtk_grid_set_row_spacing(GTK_GRID(self), SUNO_UI_STRUCTURE_DETAILS_PHOTO_GAP);
  gtk_widget_set_overflow(GTK_WIDGET(self), GTK_OVERFLOW_HIDDEN);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-details-photos");
}

static void photo_released(GtkGestureClick *click, int n_press G_GNUC_UNUSED, double x G_GNUC_UNUSED,
                           double y G_GNUC_UNUSED, gpointer user_data) {
  GtkWidget *frame = gtk_event_controller_get_widget(GTK_EVENT_CONTROLLER(click));
  guint index = GPOINTER_TO_UINT(g_object_get_data(G_OBJECT(frame), "Suno-photo-index"));
  g_signal_emit(user_data, photo_signals[PHOTO_ACTIVATED], 0, index);
}

GtkWidget *Suno_details_photos_new(GListModel *items) {
  g_return_val_if_fail(items == NULL || G_IS_LIST_MODEL(items), NULL);
  GtkWidget *self = g_object_new(SUNO_TYPE_DETAILS_PHOTOS, NULL);
  Suno_details_photos_set_items(SUNO_DETAILS_PHOTOS(self), items);
  return self;
}

void Suno_details_photos_set_items(SunoDetailsPhotos *self, GListModel *items) {
  g_return_if_fail(SUNO_IS_DETAILS_PHOTOS(self));
  g_return_if_fail(items == NULL || G_IS_LIST_MODEL(items));
  GtkWidget *child;
  while ((child = gtk_widget_get_first_child(GTK_WIDGET(self))) != NULL)
    gtk_grid_remove(GTK_GRID(self), child);
  guint n = items != NULL ? g_list_model_get_n_items(items) : 0;
  for (guint index = 0; index < n; index++) {
    g_autoptr(GObject) item = g_list_model_get_item(items, index);
    if (!GDK_IS_PAINTABLE(item) && !G_IS_FILE(item)) {
      g_critical("a details photo is a GdkPaintable or a GFile, not a %s", G_OBJECT_TYPE_NAME(item));
      continue;
    }
    GtkWidget *picture = gtk_picture_new();
    gtk_picture_set_content_fit(GTK_PICTURE(picture), GTK_CONTENT_FIT_COVER);
    gtk_picture_set_can_shrink(GTK_PICTURE(picture), TRUE);
    if (GDK_IS_PAINTABLE(item))
      gtk_picture_set_paintable(GTK_PICTURE(picture), GDK_PAINTABLE(item));
    else
      gtk_picture_set_file(GTK_PICTURE(picture), G_FILE(item));
    GtkWidget *frame = gtk_aspect_frame_new(0.5f, 0.5f, 1.0f, FALSE);
    gtk_aspect_frame_set_child(GTK_ASPECT_FRAME(frame), picture);
    gtk_widget_set_hexpand(frame, TRUE);
    gtk_widget_add_css_class(frame, "SunoUI-details-photo");
    g_object_set_data(G_OBJECT(frame), "Suno-photo-index", GUINT_TO_POINTER(index));
    GtkGesture *click = gtk_gesture_click_new();
    g_signal_connect(click, "released", G_CALLBACK(photo_released), self);
    gtk_widget_add_controller(frame, GTK_EVENT_CONTROLLER(click));
    gtk_grid_attach(GTK_GRID(self), frame, (int)(index % PHOTO_COLUMNS), (int)(index / PHOTO_COLUMNS), 1, 1);
  }
}

/* ── DetailsPane ─────────────────────────────────────────────────────── */

enum { PROP_0, PROP_SHOWN, N_PROPS };
static GParamSpec *pane_props[N_PROPS];

struct _SunoDetailsPane {
  GtkBox parent_instance;
  GtkWidget *sheet; /* strong: it travels between the slot and a drawer */
  GtkWidget *handle;
  GtkWidget *header;
  GtkWidget *leading;
  GtkWidget *title_label;
  GtkWidget *title_content;
  GtkWidget *close_button;
  GtkWidget *back_button; /* DP1: "Back to Tuesday", hidden until set */
  GCallback back_callback;
  gpointer back_data;
  int closable; /* DP1: -1 follows main (a side pane closes), 0 or 1 as asked */
  GtkWidget *body;
  GtkWidget *scroller;
  GtkWidget *footer;
  GdkFrameClock *drawer_clock;
  gulong drawer_frame;
  gboolean presenting_drawer;
  GtkWidget *last_facts; /* the block facts join, while it is the body's last child */
  GtkWidget *last_list;  /* the list rows join, likewise */
  gboolean main;
  gboolean embedded;
  gboolean wanted;
  gboolean shown;
  GObject *subject;
  SunoModalHandle *drawer;
  gboolean drawer_closed;
  gulong drawer_handler;
  GtkEventController *esc;
  GtkWidget *esc_root; /* weak */
  GtkWidget *return_focus; /* weak */
  GPtrArray *info_buttons; /* weak GtkToggleButton pointers */
};

G_DEFINE_FINAL_TYPE(SunoDetailsPane, Suno_details_pane, GTK_TYPE_BOX)

static void pane_apply(SunoDetailsPane *self, gboolean on);
static void pane_reclaim(SunoDetailsPane *self);
static void info_button_gone(gpointer data, GObject *where);

static gboolean pane_is_drawer(SunoDetailsPane *self) {
  return self->drawer != NULL && !self->drawer_closed;
}

static void pane_set_shown(SunoDetailsPane *self, gboolean on) {
  if (on != self->shown) {
    self->shown = on;
    g_object_notify_by_pspec(G_OBJECT(self), pane_props[PROP_SHOWN]);
  }
}

static void pane_sync_info_buttons(SunoDetailsPane *self, gboolean on) {
  for (guint i = 0; i < self->info_buttons->len; i++) {
    GtkToggleButton *button = g_ptr_array_index(self->info_buttons, i);
    if (gtk_toggle_button_get_active(button) != on)
      gtk_toggle_button_set_active(button, on);
  }
}

/* Esc */

static gboolean pane_key(GtkEventControllerKey *keys G_GNUC_UNUSED, guint keyval, guint code G_GNUC_UNUSED,
                         GdkModifierType state G_GNUC_UNUSED, gpointer user_data) {
  SunoDetailsPane *self = user_data;
  if (keyval != GDK_KEY_Escape || self->main || !self->shown || pane_is_drawer(self))
    return FALSE;
  GtkRoot *root = gtk_widget_get_root(GTK_WIDGET(self));
  GtkWidget *focus = root != NULL ? gtk_root_get_focus(root) : NULL;
  if (focus != NULL && (GTK_IS_EDITABLE(focus) ||
                        (gtk_widget_get_parent(focus) != NULL && GTK_IS_EDITABLE(gtk_widget_get_parent(focus)))))
    return FALSE;
  Suno_details_pane_close(self);
  return TRUE;
}

static void pane_listen_esc(SunoDetailsPane *self, gboolean on) {
  GtkWidget *root = GTK_WIDGET(gtk_widget_get_root(GTK_WIDGET(self)));
  if (self->esc != NULL && (!on || self->esc_root != root)) {
    if (self->esc_root != NULL)
      gtk_widget_remove_controller(self->esc_root, self->esc);
    self->esc = NULL;
    g_clear_weak_pointer(&self->esc_root);
  }
  if (on && self->esc == NULL && root != NULL && !self->main) {
    self->esc = gtk_event_controller_key_new();
    g_signal_connect(self->esc, "key-pressed", G_CALLBACK(pane_key), self);
    gtk_widget_add_controller(root, self->esc);
    g_set_weak_pointer(&self->esc_root, root);
  }
}

/* Focus */

static void pane_remember_focus(SunoDetailsPane *self) {
  GtkRoot *root = gtk_widget_get_root(GTK_WIDGET(self));
  GtkWidget *focus = root != NULL ? gtk_root_get_focus(root) : NULL;
  if (focus != NULL && !gtk_widget_is_ancestor(focus, self->sheet))
    g_set_weak_pointer(&self->return_focus, focus);
}

static void pane_return_focus(SunoDetailsPane *self) {
  GtkWidget *target = self->return_focus;
  g_clear_weak_pointer(&self->return_focus);
  GtkRoot *root = gtk_widget_get_root(GTK_WIDGET(self));
  GtkWidget *focus = root != NULL ? gtk_root_get_focus(root) : NULL;
  gboolean in_pane = focus == NULL || gtk_widget_is_ancestor(focus, self->sheet) || focus == self->sheet;
  if (in_pane && target != NULL && gtk_widget_get_root(target) == root && gtk_widget_get_mapped(target))
    gtk_widget_grab_focus(target);
}

/* Beside the island, or a drawer */

static void pane_drop_drawer(SunoDetailsPane *self) {
  if (self->drawer_clock != NULL)
    g_clear_signal_handler(&self->drawer_frame, self->drawer_clock);
  g_clear_object(&self->drawer_clock);
  if (self->drawer == NULL)
    return;
  if (!self->drawer_closed) {
    self->drawer_closed = TRUE;
    Suno_modal_handle_close(self->drawer);
  }
  g_clear_signal_handler(&self->drawer_handler, self->drawer);
  g_clear_object(&self->drawer);
}

/* Bring the sheet back beside the island (from a drawer). */
static void pane_reclaim(SunoDetailsPane *self) {
  pane_drop_drawer(self);
  GtkWidget *parent = gtk_widget_get_parent(self->sheet);
  if (parent == GTK_WIDGET(self))
    return;
  if (parent != NULL) {
    if (GTK_IS_OVERLAY(parent))
      gtk_overlay_remove_overlay(GTK_OVERLAY(parent), self->sheet);
    else
      gtk_widget_unparent(self->sheet);
  }
  const char *drop[] = {"SunoUI-modal", "drawer", "shown", "nudge"};
  for (guint i = 0; i < G_N_ELEMENTS(drop); i++)
    gtk_widget_remove_css_class(self->sheet, drop[i]);
  Suno_ui_set_css_class(self->sheet, "Suno-island", !self->embedded);
  gtk_widget_set_can_target(self->sheet, TRUE);
  gtk_widget_set_halign(self->sheet, GTK_ALIGN_FILL);
  gtk_widget_set_valign(self->sheet, GTK_ALIGN_FILL);
  gtk_widget_set_vexpand(self->sheet, TRUE);
  gtk_widget_set_visible(self->handle, FALSE);
  gtk_scrolled_window_set_propagate_natural_height(GTK_SCROLLED_WINDOW(self->scroller), FALSE);
  gtk_scrolled_window_set_max_content_height(GTK_SCROLLED_WINDOW(self->scroller), -1);
  gtk_widget_set_visible(self->sheet, self->shown && !Suno_ui_is_phone(GTK_WIDGET(self)));
  gtk_box_append(GTK_BOX(self), self->sheet);
}

static gboolean reclaim_later_cb(gpointer user_data) {
  SunoDetailsPane *self = user_data;
  if (!pane_is_drawer(self) && gtk_widget_get_parent(self->sheet) != GTK_WIDGET(self))
    pane_reclaim(self);
  return G_SOURCE_REMOVE;
}

static void pane_reclaim_later(SunoDetailsPane *self) {
  guint delay = MAX(1u, Suno_ui_duration(SUNO_UI_MOTION_DIALOG_FADE_MS, FALSE)) + 20;
  g_timeout_add_full(G_PRIORITY_DEFAULT, delay, reclaim_later_cb, g_object_ref(self), g_object_unref);
}

static gboolean entering_done(gpointer user_data) {
  gtk_widget_remove_css_class(user_data, "entering");
  return G_SOURCE_REMOVE;
}

static void pane_as_side(SunoDetailsPane *self) {
  gboolean entering = !gtk_widget_get_visible(self->sheet) || pane_is_drawer(self);
  pane_reclaim(self);
  gtk_widget_set_visible(self->sheet, TRUE);
  pane_listen_esc(self, !self->embedded);
  if (self->embedded) {
    gtk_widget_set_vexpand(self->sheet, FALSE);
    gtk_widget_set_vexpand(self->scroller, FALSE);
    gtk_scrolled_window_set_propagate_natural_height(GTK_SCROLLED_WINDOW(self->scroller), TRUE);
  }
  if (entering) {
    pane_remember_focus(self);
    if (!Suno_ui_reduced_motion()) {
      gtk_widget_add_css_class(self->sheet, "entering");
      Suno_ui_on_next_frame(self->sheet, entering_done, self->sheet);
    }
  }
}

static void drawer_cancelled(SunoModalHandle *handle G_GNUC_UNUSED, gpointer user_data) {
  /* Tapped outside, swiped down or Esc: the drawer fades, then the sheet comes home. */
  SunoDetailsPane *self = user_data;
  self->drawer_closed = TRUE;
  self->wanted = FALSE;
  if (self->shown) {
    pane_set_shown(self, FALSE);
    pane_sync_info_buttons(self, FALSE);
  }
  pane_reclaim_later(self);
}

static void pane_limit_drawer_body(SunoDetailsPane *self, int height) {
  if (height <= 0)
    return;
  int footer_height = 0;
  if (gtk_widget_get_visible(self->footer))
    gtk_widget_measure(self->footer, GTK_ORIENTATION_VERTICAL, -1, NULL, &footer_height, NULL, NULL);
  int share = height * SUNO_UI_STRUCTURE_DETAILS_PHONE_MAX_HEIGHT_PCT / 100;
  int maximum = MAX(120, share - SUNO_UI_STRUCTURE_DETAILS_HEADER_HEIGHT - 24 - footer_height);
  if (gtk_scrolled_window_get_max_content_height(GTK_SCROLLED_WINDOW(self->scroller)) != maximum)
    gtk_scrolled_window_set_max_content_height(GTK_SCROLLED_WINDOW(self->scroller), maximum);
}

/* Observe allocation frames without asking GTK to animate an unchanged drawer. */
static void pane_drawer_resized(GdkFrameClock *clock G_GNUC_UNUSED, gpointer data) {
  SunoDetailsPane *self = data;
  if (!pane_is_drawer(self))
    return;
  SunoLayerHost *host = Suno_layer_host_window_host(GTK_WIDGET(self));
  if (host != NULL)
    pane_limit_drawer_body(self, gtk_widget_get_height(GTK_WIDGET(host)));
}

static void pane_drawer_unmapped(GtkWidget *widget G_GNUC_UNUSED, gpointer data) {
  SunoDetailsPane *self = data;
  if (self->drawer_clock != NULL)
    g_clear_signal_handler(&self->drawer_frame, self->drawer_clock);
  g_clear_object(&self->drawer_clock);
}

static void pane_drawer_mapped(GtkWidget *widget, gpointer data) {
  SunoDetailsPane *self = data;
  pane_drawer_unmapped(widget, self);
  if (!pane_is_drawer(self) || !gtk_widget_get_mapped(widget))
    return;
  GdkFrameClock *clock = gtk_widget_get_frame_clock(widget);
  if (clock != NULL) {
    self->drawer_clock = g_object_ref(clock);
    self->drawer_frame = g_signal_connect(clock, "after-paint", G_CALLBACK(pane_drawer_resized), self);
  }
}

static void pane_as_drawer(SunoDetailsPane *self) {
  if (self->presenting_drawer || pane_is_drawer(self))
    return;
  self->presenting_drawer = TRUE;
  pane_remember_focus(self);
  pane_listen_esc(self, FALSE);
  SunoLayerHost *host = Suno_layer_host_window_host(GTK_WIDGET(self));
  if (host == NULL) {
    self->presenting_drawer = FALSE;
    return;
  }
  pane_reclaim(self);
  gtk_box_remove(GTK_BOX(self), self->sheet);
  gtk_widget_set_visible(self->sheet, TRUE);
  gtk_widget_remove_css_class(self->sheet, "Suno-island");
  gtk_widget_add_css_class(self->sheet, "drawer");
  gtk_widget_set_visible(self->handle, TRUE);
  pane_limit_drawer_body(self, gtk_widget_get_height(GTK_WIDGET(host)));
  gtk_scrolled_window_set_propagate_natural_height(GTK_SCROLLED_WINDOW(self->scroller), TRUE);
  gtk_widget_set_vexpand(self->sheet, FALSE);
  SunoModalHandle *handle = Suno_layer_host_present_modal(host, self->sheet, NULL, SUNO_DRAWER_MODE_ALWAYS);
  if (handle == NULL) {
    self->presenting_drawer = FALSE;
    return;
  }
  self->drawer = g_object_ref(handle);
  self->drawer_closed = FALSE;
  self->drawer_handler = g_signal_connect(handle, "cancelled", G_CALLBACK(drawer_cancelled), self);
  pane_drawer_mapped(self->sheet, self);
  self->presenting_drawer = FALSE;
}

static void pane_hide(SunoDetailsPane *self) {
  pane_listen_esc(self, FALSE);
  if (pane_is_drawer(self)) {
    self->drawer_closed = TRUE;
    Suno_modal_handle_close(self->drawer); /* it fades; the sheet comes home afterwards */
    pane_reclaim_later(self);
  } else {
    pane_reclaim(self);
    gtk_widget_set_visible(self->sheet, FALSE);
  }
}

static void pane_apply(SunoDetailsPane *self, gboolean on) {
  if (!on)
    pane_hide(self);
  else if (!self->embedded && Suno_ui_is_phone(GTK_WIDGET(self))) {
    if (gtk_widget_get_mapped(GTK_WIDGET(self)))
      pane_as_drawer(self);
  } else {
    pane_as_side(self);
  }
  pane_set_shown(self, on);
  pane_sync_info_buttons(self, on);
  if (!on)
    pane_return_focus(self);
}

static void pane_reflow(SunoDetailsPane *self) {
  if (self->shown)
    pane_apply(self, TRUE);
}

static void pane_width(GtkWidget *widget, int width G_GNUC_UNUSED, gpointer data G_GNUC_UNUSED) {
  pane_reflow(SUNO_DETAILS_PANE(widget));
}

static void pane_map(GtkWidget *widget) {
  GTK_WIDGET_CLASS(Suno_details_pane_parent_class)->map(widget);
  pane_reflow(SUNO_DETAILS_PANE(widget));
}

static void pane_unmap(GtkWidget *widget) {
  SunoDetailsPane *self = SUNO_DETAILS_PANE(widget);
  /* A pane in a view that is not showing never floats over the window. */
  if (pane_is_drawer(self))
    pane_reclaim(self);
  GTK_WIDGET_CLASS(Suno_details_pane_parent_class)->unmap(widget);
}

static gboolean pane_update(SunoDetailsPane *self) {
  if (self->subject == NULL && !self->main)
    self->wanted = FALSE;
  gboolean on = self->main || (self->wanted && self->subject != NULL);
  pane_apply(self, on);
  return on;
}

static void Suno_details_pane_get_property(GObject *object, guint prop_id, GValue *value, GParamSpec *pspec) {
  SunoDetailsPane *self = SUNO_DETAILS_PANE(object);
  switch (prop_id) {
  case PROP_SHOWN:
    g_value_set_boolean(value, self->shown);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, prop_id, pspec);
  }
}

static void Suno_details_pane_dispose(GObject *object) {
  SunoDetailsPane *self = SUNO_DETAILS_PANE(object);
  pane_drop_drawer(self);
  if (self->esc != NULL && self->esc_root != NULL)
    gtk_widget_remove_controller(self->esc_root, self->esc);
  self->esc = NULL;
  g_clear_weak_pointer(&self->esc_root);
  g_clear_weak_pointer(&self->return_focus);
  if (self->info_buttons != NULL) {
    for (guint i = 0; i < self->info_buttons->len; i++)
      g_object_weak_unref(g_ptr_array_index(self->info_buttons, i), info_button_gone, self);
    g_ptr_array_set_size(self->info_buttons, 0);
  }
  g_clear_object(&self->subject);
  if (self->sheet != NULL && gtk_widget_get_parent(self->sheet) != NULL &&
      gtk_widget_get_parent(self->sheet) != GTK_WIDGET(self)) {
    GtkWidget *parent = gtk_widget_get_parent(self->sheet);
    if (GTK_IS_OVERLAY(parent))
      gtk_overlay_remove_overlay(GTK_OVERLAY(parent), self->sheet);
    else
      gtk_widget_unparent(self->sheet);
  }
  g_clear_object(&self->sheet);
  G_OBJECT_CLASS(Suno_details_pane_parent_class)->dispose(object);
}

static void Suno_details_pane_finalize(GObject *object) {
  g_clear_pointer(&SUNO_DETAILS_PANE(object)->info_buttons, g_ptr_array_unref);
  G_OBJECT_CLASS(Suno_details_pane_parent_class)->finalize(object);
}

static void Suno_details_pane_class_init(SunoDetailsPaneClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS(klass);
  object_class->get_property = Suno_details_pane_get_property;
  object_class->dispose = Suno_details_pane_dispose;
  object_class->finalize = Suno_details_pane_finalize;
  widget_class->map = pane_map;
  widget_class->unmap = pane_unmap;
  /**
   * SunoDetailsPane:shown:
   *
   * Whether the pane shows (beside the island or as a drawer).
   */
  pane_props[PROP_SHOWN] = g_param_spec_boolean("shown", NULL, NULL, FALSE,
                                                G_PARAM_READABLE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);
  g_object_class_install_properties(object_class, N_PROPS, pane_props);
}

static void close_clicked(GtkButton *button G_GNUC_UNUSED, gpointer user_data) {
  Suno_details_pane_close(user_data);
}

static void back_clicked(GtkButton *button G_GNUC_UNUSED, gpointer user_data) {
  SunoDetailsPane *self = user_data;
  if (self->back_callback != NULL)
    ((void (*)(gpointer))self->back_callback)(self->back_data);
}

static gboolean pane_closable(SunoDetailsPane *self) {
  return self->closable < 0 ? !self->main : self->closable;
}

static void Suno_details_pane_init(SunoDetailsPane *self) {
  Suno_ui_install();
  self->info_buttons = g_ptr_array_new();
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_VERTICAL);
  gtk_widget_set_hexpand(GTK_WIDGET(self), FALSE);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-details-slot");

  /* The sheet is the pane itself: beside the island on a computer, the
   * drawer's card on a phone. The slot stays in the app's layout. */
  self->sheet = g_object_ref_sink(g_object_new(SUNO_TYPE_ISLAND, "orientation", GTK_ORIENTATION_VERTICAL, "hexpand",
                                               FALSE, "vexpand", TRUE, "accessible-role",
                                               GTK_ACCESSIBLE_ROLE_REGION, NULL));
  g_signal_connect(self->sheet, "map", G_CALLBACK(pane_drawer_mapped), self);
  g_signal_connect(self->sheet, "unmap", G_CALLBACK(pane_drawer_unmapped), self);
  gtk_widget_add_css_class(self->sheet, "SunoUI-details");
  gtk_widget_add_css_class(self->sheet, "Suno-island");
  gtk_widget_set_overflow(self->sheet, GTK_OVERFLOW_HIDDEN);
  self->handle = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_set_halign(self->handle, GTK_ALIGN_CENTER);
  gtk_widget_add_css_class(self->handle, "SunoUI-drawer-handle");
  gtk_widget_set_visible(self->handle, FALSE);
  gtk_box_append(GTK_BOX(self->sheet), self->handle);

  self->header = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(self->header, "SunoUI-details-header");
  self->closable = -1;
  self->back_button = Suno_ui_icon_button("chevron-left", "Back", "SunoUI-details-close", FALSE, NULL);
  gtk_widget_add_css_class(self->back_button, "SunoUI-details-back");
  gtk_widget_set_visible(self->back_button, FALSE);
  g_signal_connect(self->back_button, "clicked", G_CALLBACK(back_clicked), self);
  gtk_box_append(GTK_BOX(self->header), self->back_button);
  self->title_label = pane_label("Details", "SunoUI-details-title", 0, TRUE);
  gtk_widget_set_hexpand(self->title_label, TRUE);
  gtk_box_append(GTK_BOX(self->header), self->title_label);
  self->close_button = Suno_ui_icon_button("x", "Close", "SunoUI-details-close", FALSE, NULL);
  g_signal_connect(self->close_button, "clicked", G_CALLBACK(close_clicked), self);
  gtk_box_append(GTK_BOX(self->header), self->close_button);
  gtk_box_append(GTK_BOX(self->sheet), self->header);

  self->body = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_add_css_class(self->body, "SunoUI-details-body");
  self->scroller = gtk_scrolled_window_new();
  gtk_scrolled_window_set_policy(GTK_SCROLLED_WINDOW(self->scroller), GTK_POLICY_NEVER, GTK_POLICY_EXTERNAL);
  gtk_widget_set_vexpand(self->scroller, TRUE);
  gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(self->scroller), self->body);
  gtk_widget_add_css_class(self->scroller, "SunoUI-details-scroll");
  gtk_box_append(GTK_BOX(self->sheet), self->scroller);
  self->footer = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_add_css_class(self->footer, "SunoUI-details-footer");
  gtk_widget_set_visible(self->footer, FALSE);
  gtk_box_append(GTK_BOX(self->sheet), self->footer);
  gtk_box_append(GTK_BOX(self), self->sheet);
  gtk_widget_set_visible(self->sheet, FALSE);
  Suno_ui_width_watch(GTK_WIDGET(self), pane_width, NULL, (SUNO_TIER_PHONE_BELOW - 1));
}

GtkWidget *Suno_details_pane_new(const char *title, gboolean main) {
  SunoDetailsPane *self = g_object_new(SUNO_TYPE_DETAILS_PANE, NULL);
  Suno_details_pane_set_title(self, title != NULL ? title : "Details");
  if (main)
    Suno_details_pane_set_main(self, TRUE);
  return GTK_WIDGET(self);
}

void Suno_details_pane_set_title(SunoDetailsPane *self, const char *title) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(title != NULL);
  gtk_label_set_label(GTK_LABEL(self->title_label), title);
  Suno_ui_set_accessible_label(self->sheet, title);
}

void Suno_details_pane_set_leading(SunoDetailsPane *self, GtkWidget *leading) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  if (self->leading == leading)
    return;
  g_return_if_fail(leading == NULL || (GTK_IS_WIDGET(leading) && gtk_widget_get_parent(leading) == NULL));
  if (self->leading != NULL)
    gtk_box_remove(GTK_BOX(self->header), self->leading);
  self->leading = leading;
  if (leading != NULL) {
    gtk_widget_set_valign(leading, GTK_ALIGN_CENTER);
    gtk_widget_add_css_class(leading, "SunoUI-details-leading");
    gtk_box_insert_child_after(GTK_BOX(self->header), leading, self->back_button);
  }
}

void Suno_details_pane_set_title_content(SunoDetailsPane *self, GtkWidget *content) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  if (self->title_content == content)
    return;
  g_return_if_fail(content == NULL || (GTK_IS_WIDGET(content) && gtk_widget_get_parent(content) == NULL));
  if (self->title_content != NULL)
    gtk_box_remove(GTK_BOX(self->header), self->title_content);
  self->title_content = content;
  gtk_widget_set_visible(self->title_label, content == NULL);
  if (content != NULL) {
    gtk_widget_set_valign(content, GTK_ALIGN_CENTER);
    gtk_widget_set_hexpand(content, TRUE);
    gtk_widget_add_css_class(content, "SunoUI-details-title-content");
    gtk_box_insert_child_after(GTK_BOX(self->header), content, self->title_label);
  }
}

void Suno_details_pane_add(SunoDetailsPane *self, GtkWidget *widget) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(GTK_IS_WIDGET(widget));
  gtk_box_append(GTK_BOX(self->body), widget);
}

void Suno_details_pane_add_hero(SunoDetailsPane *self, const char *title, const char *subtitle,
                                GtkWidget *lead) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(title != NULL);
  g_return_if_fail(lead == NULL || GTK_IS_WIDGET(lead));
  GtkWidget *hero = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_halign(hero, GTK_ALIGN_FILL);
  gtk_widget_add_css_class(hero, "SunoUI-details-hero");
  if (lead != NULL) {
    gtk_widget_set_halign(lead, GTK_ALIGN_CENTER);
    gtk_box_append(GTK_BOX(hero), lead);
  }
  GtkWidget *name = gtk_label_new(title);
  gtk_label_set_wrap(GTK_LABEL(name), TRUE);
  gtk_label_set_justify(GTK_LABEL(name), GTK_JUSTIFY_CENTER);
  gtk_label_set_wrap_mode(GTK_LABEL(name), PANGO_WRAP_WORD_CHAR);
  gtk_label_set_max_width_chars(GTK_LABEL(name), 1);
  gtk_widget_set_hexpand(name, TRUE);
  gtk_widget_add_css_class(name, "SunoUI-details-hero-title");
  gtk_box_append(GTK_BOX(hero), name);
  if (subtitle != NULL && *subtitle != '\0')
    gtk_box_append(GTK_BOX(hero), pane_label(subtitle, "SunoUI-details-hero-sub", 0.5f, TRUE));
  Suno_details_pane_add(self, hero);
}

void Suno_details_pane_set_header_visible(SunoDetailsPane *self, gboolean visible) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  gtk_widget_set_visible(self->header, visible);
}

void Suno_details_pane_add_subject(SunoDetailsPane *self, const char *title,
                                   const char *subtitle, GtkWidget *lead) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(title != NULL);
  g_return_if_fail(lead == NULL || GTK_IS_WIDGET(lead));
  GtkWidget *subject = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(subject, "SunoUI-details-subject");
  if (lead != NULL) {
    gtk_widget_set_valign(lead, GTK_ALIGN_CENTER);
    gtk_box_append(GTK_BOX(subject), lead);
  }
  GtkWidget *words = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_valign(words, GTK_ALIGN_CENTER);
  gtk_widget_set_hexpand(words, TRUE);
  GtkWidget *name = pane_label(title, "SunoUI-file-summary-title", 0, FALSE);
  gtk_label_set_ellipsize(GTK_LABEL(name), PANGO_ELLIPSIZE_END);
  gtk_label_set_max_width_chars(GTK_LABEL(name), 1);
  gtk_box_append(GTK_BOX(words), name);
  if (subtitle != NULL && *subtitle != '\0') {
    GtkWidget *caption = pane_label(subtitle, "SunoUI-file-summary-subtitle", 0, FALSE);
    gtk_label_set_ellipsize(GTK_LABEL(caption), PANGO_ELLIPSIZE_END);
    gtk_label_set_max_width_chars(GTK_LABEL(caption), 1);
    gtk_box_append(GTK_BOX(words), caption);
  }
  gtk_box_append(GTK_BOX(subject), words);
  Suno_details_pane_add(self, subject);
}

void Suno_details_pane_add_section(SunoDetailsPane *self, const char *label, const char *action_label,
                                   const char *action_name) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(label != NULL);
  GtkWidget *heading = g_object_new(GTK_TYPE_BOX, "orientation", GTK_ORIENTATION_HORIZONTAL, "accessible-role",
                                    GTK_ACCESSIBLE_ROLE_HEADING, NULL);
  gtk_widget_add_css_class(heading, "SunoUI-details-section");
  GtkWidget *text = pane_label(label, "SunoUI-details-section-label", 0, TRUE);
  gtk_widget_set_hexpand(text, TRUE);
  gtk_box_append(GTK_BOX(heading), text);
  Suno_ui_set_accessible_label(heading, label);
  if (action_label != NULL) {
    GtkWidget *button = gtk_button_new_with_label(action_label);
    gtk_widget_set_valign(button, GTK_ALIGN_CENTER);
    gtk_widget_add_css_class(button, "SunoUI-details-section-action");
    if (action_name != NULL)
      gtk_actionable_set_detailed_action_name(GTK_ACTIONABLE(button), action_name);
    gtk_box_append(GTK_BOX(heading), button);
  }
  Suno_details_pane_add(self, heading);
}

void Suno_details_pane_add_fact(SunoDetailsPane *self, const char *key, const char *value) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(key != NULL && value != NULL);
  GtkWidget *facts = self->last_facts;
  if (facts == NULL || gtk_widget_get_last_child(self->body) != facts) {
    facts = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
    gtk_widget_add_css_class(facts, "SunoUI-details-facts");
    Suno_details_pane_add(self, facts);
    self->last_facts = facts;
  }
  GtkWidget *row = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(row, "SunoUI-details-fact");
  GtkWidget *name = gtk_label_new(key);
  gtk_label_set_xalign(GTK_LABEL(name), 0);
  gtk_widget_set_valign(name, GTK_ALIGN_START);
  gtk_widget_add_css_class(name, "SunoUI-details-key");
  gtk_box_append(GTK_BOX(row), name);
  GtkWidget *shown = gtk_label_new(value);
  gtk_label_set_xalign(GTK_LABEL(shown), 1);
  gtk_widget_set_hexpand(shown, TRUE);
  gtk_label_set_wrap(GTK_LABEL(shown), TRUE);
  gtk_label_set_selectable(GTK_LABEL(shown), TRUE);
  gtk_label_set_wrap_mode(GTK_LABEL(shown), PANGO_WRAP_WORD_CHAR);
  gtk_label_set_max_width_chars(GTK_LABEL(shown), 1);
  gtk_label_set_justify(GTK_LABEL(shown), GTK_JUSTIFY_RIGHT);
  gtk_widget_add_css_class(shown, "SunoUI-details-value");
  gtk_widget_set_can_focus(shown, FALSE); /* selectable by pointer; Tab goes to controls */
  gtk_box_append(GTK_BOX(row), shown);
  g_autofree char *spoken = g_strdup_printf("%s: %s", key, value);
  Suno_ui_set_accessible_label(row, spoken);
  gtk_box_append(GTK_BOX(facts), row);
}

void Suno_details_pane_add_row(SunoDetailsPane *self, GtkWidget *row) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(GTK_IS_WIDGET(row));
  if (!SUNO_IS_DETAILS_ROW(row) && !SUNO_IS_DETAILS_ITEM(row) && !SUNO_IS_FACT_ROW(row) && !SUNO_IS_ADD_ROW(row)) {
    g_critical("a details list holds SunoDetailsRow, SunoDetailsItem, SunoFactRow and SunoAddRow, not a %s",
               G_OBJECT_TYPE_NAME(row));
    if (g_object_is_floating(row))
      g_object_unref(g_object_ref_sink(row));
    return;
  }
  GtkWidget *group = self->last_list;
  if (group == NULL || gtk_widget_get_last_child(self->body) != group) {
    group = g_object_new(GTK_TYPE_BOX, "orientation", GTK_ORIENTATION_VERTICAL, "accessible-role",
                         GTK_ACCESSIBLE_ROLE_LIST, NULL);
    gtk_widget_add_css_class(group, "SunoUI-details-list");
    Suno_details_pane_add(self, group);
    self->last_list = group;
  }
  gtk_box_append(GTK_BOX(group), row);
}

SunoDetailsPhotos *Suno_details_pane_add_photos(SunoDetailsPane *self, GListModel *items) {
  g_return_val_if_fail(SUNO_IS_DETAILS_PANE(self), NULL);
  g_return_val_if_fail(G_IS_LIST_MODEL(items), NULL);
  GtkWidget *photos = Suno_details_photos_new(items);
  Suno_details_pane_add(self, photos);
  return SUNO_DETAILS_PHOTOS(photos);
}

void Suno_details_pane_set_footer(SunoDetailsPane *self, GtkWidget *widget) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(widget == NULL || GTK_IS_WIDGET(widget));
  GtkWidget *current = gtk_widget_get_first_child(self->footer);
  if (current == widget)
    return;
  g_return_if_fail(widget == NULL || gtk_widget_get_parent(widget) == NULL);
  if (current != NULL)
    gtk_box_remove(GTK_BOX(self->footer), current);
  if (widget != NULL)
    gtk_box_append(GTK_BOX(self->footer), widget);
  gtk_widget_set_visible(self->footer, widget != NULL);
}

void Suno_details_pane_clear(SunoDetailsPane *self) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  GtkWidget *child;
  while ((child = gtk_widget_get_first_child(self->body)) != NULL)
    gtk_box_remove(GTK_BOX(self->body), child);
  self->last_facts = self->last_list = NULL;
  Suno_details_pane_set_footer(self, NULL);
}

gboolean Suno_details_pane_show(SunoDetailsPane *self, gboolean open) {
  g_return_val_if_fail(SUNO_IS_DETAILS_PANE(self), FALSE);
  self->wanted = !!open;
  return pane_update(self);
}

void Suno_details_pane_set_subject(SunoDetailsPane *self, GObject *subject) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  g_return_if_fail(subject == NULL || G_IS_OBJECT(subject));
  g_set_object(&self->subject, subject);
  pane_update(self);
}

GObject *Suno_details_pane_get_subject(SunoDetailsPane *self) {
  g_return_val_if_fail(SUNO_IS_DETAILS_PANE(self), NULL);
  return self->subject;
}

void Suno_details_pane_set_embedded(SunoDetailsPane *self, gboolean embedded) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  self->embedded = !!embedded;
  Suno_ui_set_css_class(self->sheet, "embedded", self->embedded);
  Suno_ui_set_css_class(self->sheet, "Suno-island", !self->embedded);
  gtk_widget_set_vexpand(self->sheet, !self->embedded);
  gtk_widget_set_vexpand(self->scroller, !self->embedded);
  gtk_scrolled_window_set_propagate_natural_height(GTK_SCROLLED_WINDOW(self->scroller), self->embedded);
  pane_reflow(self);
}

void Suno_details_pane_set_raised(SunoDetailsPane *self, gboolean raised) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  Suno_ui_set_css_class(self->sheet, "raised", raised);
}

void Suno_details_pane_set_main(SunoDetailsPane *self, gboolean main) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  self->main = !!main;
  gtk_widget_set_visible(self->close_button, pane_closable(self));
  pane_update(self);
}

void Suno_details_pane_set_closable(SunoDetailsPane *self, gboolean closable) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  self->closable = !!closable;
  gtk_widget_set_visible(self->close_button, pane_closable(self));
}

void Suno_details_pane_set_back(SunoDetailsPane *self, const char *label, GCallback on_back, gpointer user_data) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  gboolean shown = label != NULL && *label != '\0';
  self->back_callback = shown ? on_back : NULL;
  self->back_data = shown ? user_data : NULL;
  gtk_widget_set_visible(self->back_button, shown);
  GtkWidget *header = gtk_widget_get_parent(self->back_button);
  if (shown)
    gtk_widget_add_css_class(header, "with-back");
  else
    gtk_widget_remove_css_class(header, "with-back");
  g_autofree char *name = shown ? g_strdup_printf("Back to %s", label) : g_strdup("Back");
  gtk_widget_set_tooltip_text(self->back_button, shown ? name : NULL);
  gtk_accessible_update_property(GTK_ACCESSIBLE(self->back_button), GTK_ACCESSIBLE_PROPERTY_LABEL, name, -1);
}

gboolean Suno_details_pane_get_main(SunoDetailsPane *self) {
  g_return_val_if_fail(SUNO_IS_DETAILS_PANE(self), FALSE);
  return self->main;
}

void Suno_details_pane_close(SunoDetailsPane *self) {
  g_return_if_fail(SUNO_IS_DETAILS_PANE(self));
  if (self->main)
    return;
  self->wanted = FALSE;
  pane_apply(self, FALSE);
}

gboolean Suno_details_pane_toggle(SunoDetailsPane *self) {
  g_return_val_if_fail(SUNO_IS_DETAILS_PANE(self), FALSE);
  return Suno_details_pane_show(self, !self->shown);
}

gboolean Suno_details_pane_get_shown(SunoDetailsPane *self) {
  g_return_val_if_fail(SUNO_IS_DETAILS_PANE(self), FALSE);
  return self->shown;
}

gboolean Suno_details_pane_get_is_drawer(SunoDetailsPane *self) {
  g_return_val_if_fail(SUNO_IS_DETAILS_PANE(self), FALSE);
  return pane_is_drawer(self);
}

static void info_toggled(GtkToggleButton *button, gpointer user_data) {
  SunoDetailsPane *self = user_data;
  gboolean active = gtk_toggle_button_get_active(button);
  if (active != self->shown) {
    Suno_details_pane_show(self, active);
    if (gtk_toggle_button_get_active(button) != self->shown) /* nothing to describe: it stays closed */
      gtk_toggle_button_set_active(button, self->shown);
  }
}

static void info_button_gone(gpointer data, GObject *where) {
  SunoDetailsPane *self = data;
  g_ptr_array_remove(self->info_buttons, where);
}

GtkWidget *Suno_details_pane_info_button(SunoDetailsPane *self) {
  g_return_val_if_fail(SUNO_IS_DETAILS_PANE(self), NULL);
  GtkWidget *button = Suno_ui_icon_button("info", "Information", "SunoUI-corner-button", TRUE, NULL);
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(button), self->shown);
  g_signal_connect_object(button, "toggled", G_CALLBACK(info_toggled), self, 0);
  g_ptr_array_add(self->info_buttons, button);
  g_object_weak_ref(G_OBJECT(button), info_button_gone, self);
  return button;
}
