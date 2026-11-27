/* SPDX-License-Identifier: Apache-2.0 */
/* SunoUI creative family (KB-D): SunoLayer and SunoLayerTree (v70 .sulyr). */
#include "Suno-creative-layers.h"
#include "Suno-creative-private.h"

/* ── SunoLayer ── */

enum {
  LAYER_PROP_0,
  LAYER_PROP_ID,
  LAYER_PROP_NAME,
  LAYER_PROP_ICON,
  LAYER_PROP_VISIBLE,
  LAYER_PROP_CAN_HIDE,
  LAYER_PROP_DETAIL,
  LAYER_PROP_EXPANDED,
  LAYER_N_PROPS
};
static GParamSpec *layer_props[LAYER_N_PROPS];

struct _SunoLayer {
  GObject parent_instance;
  char *id;
  char *name;
  char *icon;
  char *detail;
  gboolean visible;
  gboolean can_hide;
  gboolean expanded;
  GListStore *children;
};

G_DEFINE_FINAL_TYPE(SunoLayer, Suno_layer, G_TYPE_OBJECT)

static void set_string(char **slot, const char *value, GObject *object, GParamSpec *pspec) {
  if (g_strcmp0(*slot, value) == 0)
    return;
  g_free(*slot);
  *slot = g_strdup(value);
  g_object_notify_by_pspec(object, pspec);
}

static void Suno_layer_get_property(GObject *object, guint id, GValue *value, GParamSpec *pspec) {
  SunoLayer *self = SUNO_LAYER(object);
  switch (id) {
  case LAYER_PROP_ID: g_value_set_string(value, self->id); break;
  case LAYER_PROP_NAME: g_value_set_string(value, self->name); break;
  case LAYER_PROP_ICON: g_value_set_string(value, self->icon); break;
  case LAYER_PROP_VISIBLE: g_value_set_boolean(value, self->visible); break;
  case LAYER_PROP_CAN_HIDE: g_value_set_boolean(value, self->can_hide); break;
  case LAYER_PROP_DETAIL: g_value_set_string(value, self->detail); break;
  case LAYER_PROP_EXPANDED: g_value_set_boolean(value, self->expanded); break;
  default: G_OBJECT_WARN_INVALID_PROPERTY_ID(object, id, pspec);
  }
}

static void Suno_layer_set_property(GObject *object, guint id, const GValue *value, GParamSpec *pspec) {
  SunoLayer *self = SUNO_LAYER(object);
  switch (id) {
  case LAYER_PROP_ID: g_free(self->id); self->id = g_value_dup_string(value); break;
  case LAYER_PROP_NAME: Suno_layer_set_name(self, g_value_get_string(value)); break;
  case LAYER_PROP_ICON: Suno_layer_set_icon(self, g_value_get_string(value)); break;
  case LAYER_PROP_VISIBLE: Suno_layer_set_visible(self, g_value_get_boolean(value)); break;
  case LAYER_PROP_CAN_HIDE: Suno_layer_set_can_hide(self, g_value_get_boolean(value)); break;
  case LAYER_PROP_DETAIL: Suno_layer_set_detail(self, g_value_get_string(value)); break;
  case LAYER_PROP_EXPANDED: Suno_layer_set_expanded(self, g_value_get_boolean(value)); break;
  default: G_OBJECT_WARN_INVALID_PROPERTY_ID(object, id, pspec);
  }
}

static void Suno_layer_finalize(GObject *object) {
  SunoLayer *self = SUNO_LAYER(object);
  g_free(self->id);
  g_free(self->name);
  g_free(self->icon);
  g_free(self->detail);
  g_clear_object(&self->children);
  G_OBJECT_CLASS(Suno_layer_parent_class)->finalize(object);
}

static void Suno_layer_class_init(SunoLayerClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  object_class->finalize = Suno_layer_finalize;
  object_class->get_property = Suno_layer_get_property;
  object_class->set_property = Suno_layer_set_property;
  GParamFlags rw = G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS;
  layer_props[LAYER_PROP_ID] = g_param_spec_string("id", NULL, NULL, NULL,
                                                   G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  layer_props[LAYER_PROP_NAME] = g_param_spec_string("name", NULL, NULL, NULL, rw);
  layer_props[LAYER_PROP_ICON] = g_param_spec_string("icon", NULL, NULL, NULL, rw);
  layer_props[LAYER_PROP_VISIBLE] = g_param_spec_boolean("visible", NULL, NULL, TRUE, rw);
  layer_props[LAYER_PROP_CAN_HIDE] = g_param_spec_boolean("can-hide", NULL, NULL, TRUE, rw);
  layer_props[LAYER_PROP_DETAIL] = g_param_spec_string("detail", NULL, NULL, NULL, rw);
  layer_props[LAYER_PROP_EXPANDED] = g_param_spec_boolean("expanded", NULL, NULL, TRUE, rw);
  g_object_class_install_properties(object_class, LAYER_N_PROPS, layer_props);
}

static void Suno_layer_init(SunoLayer *self) {
  self->visible = TRUE;
  self->can_hide = TRUE;
  self->expanded = TRUE;
  self->children = g_list_store_new(SUNO_TYPE_LAYER);
}

SunoLayer *Suno_layer_new(const char *id, const char *name, const char *icon) {
  g_return_val_if_fail(id != NULL && *id != '\0', NULL);
  g_return_val_if_fail(name != NULL, NULL);
  g_return_val_if_fail(icon != NULL && *icon != '\0', NULL);
  return g_object_new(SUNO_TYPE_LAYER, "id", id, "name", name, "icon", icon, NULL);
}

const char *Suno_layer_get_id(SunoLayer *self) {
  g_return_val_if_fail(SUNO_IS_LAYER(self), NULL);
  return self->id;
}

const char *Suno_layer_get_name(SunoLayer *self) {
  g_return_val_if_fail(SUNO_IS_LAYER(self), NULL);
  return self->name;
}

void Suno_layer_set_name(SunoLayer *self, const char *name) {
  g_return_if_fail(SUNO_IS_LAYER(self));
  set_string(&self->name, name, G_OBJECT(self), layer_props[LAYER_PROP_NAME]);
}

const char *Suno_layer_get_icon(SunoLayer *self) {
  g_return_val_if_fail(SUNO_IS_LAYER(self), NULL);
  return self->icon;
}

void Suno_layer_set_icon(SunoLayer *self, const char *icon) {
  g_return_if_fail(SUNO_IS_LAYER(self));
  set_string(&self->icon, icon, G_OBJECT(self), layer_props[LAYER_PROP_ICON]);
}

gboolean Suno_layer_get_visible(SunoLayer *self) {
  g_return_val_if_fail(SUNO_IS_LAYER(self), FALSE);
  return self->visible;
}

void Suno_layer_set_visible(SunoLayer *self, gboolean visible) {
  g_return_if_fail(SUNO_IS_LAYER(self));
  if (self->visible == !!visible)
    return;
  self->visible = !!visible;
  g_object_notify_by_pspec(G_OBJECT(self), layer_props[LAYER_PROP_VISIBLE]);
}

void Suno_layer_set_can_hide(SunoLayer *self, gboolean can_hide) {
  g_return_if_fail(SUNO_IS_LAYER(self));
  if (self->can_hide == !!can_hide)
    return;
  self->can_hide = !!can_hide;
  g_object_notify_by_pspec(G_OBJECT(self), layer_props[LAYER_PROP_CAN_HIDE]);
}

gboolean Suno_layer_get_can_hide(SunoLayer *self) {
  g_return_val_if_fail(SUNO_IS_LAYER(self), FALSE);
  return self->can_hide;
}

void Suno_layer_set_detail(SunoLayer *self, const char *detail) {
  g_return_if_fail(SUNO_IS_LAYER(self));
  set_string(&self->detail, detail, G_OBJECT(self), layer_props[LAYER_PROP_DETAIL]);
}

const char *Suno_layer_get_detail(SunoLayer *self) {
  g_return_val_if_fail(SUNO_IS_LAYER(self), NULL);
  return self->detail;
}

void Suno_layer_set_expanded(SunoLayer *self, gboolean expanded) {
  g_return_if_fail(SUNO_IS_LAYER(self));
  if (self->expanded == !!expanded)
    return;
  self->expanded = !!expanded;
  g_object_notify_by_pspec(G_OBJECT(self), layer_props[LAYER_PROP_EXPANDED]);
}

gboolean Suno_layer_get_expanded(SunoLayer *self) {
  g_return_val_if_fail(SUNO_IS_LAYER(self), FALSE);
  return self->expanded;
}

GListModel *Suno_layer_get_children(SunoLayer *self) {
  g_return_val_if_fail(SUNO_IS_LAYER(self), NULL);
  return G_LIST_MODEL(self->children);
}

void Suno_layer_append(SunoLayer *self, SunoLayer *child) {
  g_return_if_fail(SUNO_IS_LAYER(self));
  g_return_if_fail(SUNO_IS_LAYER(child) && child != self);
  g_list_store_append(self->children, child);
}

/* ── SunoLayerTree ── */

enum {
  TREE_SELECTION_CHANGED,
  TREE_ACTIVATED,
  TREE_VISIBILITY_CHANGED,
  TREE_RENAMED,
  TREE_MOVE_REQUESTED,
  TREE_CONTEXT_REQUESTED,
  TREE_N_SIGNALS
};
static guint tree_signals[TREE_N_SIGNALS];

typedef struct {
  SunoLayer *layer;  /* ref */
  SunoLayer *parent; /* ref, or NULL at the top */
  guint index;       /* among its siblings */
  int depth;
  GtkWidget *row;
} Row;

typedef struct {
  GObject *object; /* ref */
  gulong handler;
} Watch;

typedef enum { DROP_NONE, DROP_ABOVE, DROP_BELOW, DROP_INTO } DropAt;

struct _SunoLayerTree {
  GtkWidget parent_instance;
  GtkWidget *list;
  GListModel *layers;
  GPtrArray *rows;    /* Row */
  GPtrArray *watches; /* Watch */
  GHashTable *selected;
  char *renaming;
  char *focus_after;
  guint rebuild_id;
  gboolean syncing;
};

G_DEFINE_FINAL_TYPE(SunoLayerTree, Suno_layer_tree, GTK_TYPE_WIDGET)

static void row_free(gpointer data) {
  Row *row = data;
  g_clear_object(&row->layer);
  g_clear_object(&row->parent);
  g_free(row);
}

static void watch_free(gpointer data) {
  Watch *watch = data;
  g_signal_handler_disconnect(watch->object, watch->handler);
  g_object_unref(watch->object);
  g_free(watch);
}

static void rebuild(SunoLayerTree *self);

static gboolean rebuild_idle(gpointer user_data) {
  SunoLayerTree *self = user_data;
  self->rebuild_id = 0;
  rebuild(self);
  return G_SOURCE_REMOVE;
}

static void schedule_rebuild(SunoLayerTree *self) {
  if (self->rebuild_id == 0)
    self->rebuild_id = g_idle_add(rebuild_idle, self);
}

static void watched_changed(SunoLayerTree *self) {
  schedule_rebuild(self);
}

static void watch(SunoLayerTree *self, gpointer object, const char *signal) {
  Watch *entry = g_new0(Watch, 1);
  entry->object = g_object_ref(object);
  entry->handler = g_signal_connect_swapped(object, signal, G_CALLBACK(watched_changed), self);
  g_ptr_array_add(self->watches, entry);
}

static Row *row_for_layer(SunoLayerTree *self, SunoLayer *layer) {
  for (guint i = 0; i < self->rows->len; i++) {
    Row *row = g_ptr_array_index(self->rows, i);
    if (row->layer == layer)
      return row;
  }
  return NULL;
}

static Row *row_for_widget(SunoLayerTree *self, GtkWidget *widget) {
  for (guint i = 0; i < self->rows->len; i++) {
    Row *row = g_ptr_array_index(self->rows, i);
    if (row->row == widget || gtk_widget_is_ancestor(widget, row->row))
      return row;
  }
  return NULL;
}

/* Rename in place */

static void finish_rename(SunoLayerTree *self, gboolean commit, const char *text) {
  if (self->renaming == NULL)
    return;
  g_autofree char *id = g_steal_pointer(&self->renaming);
  g_free(self->focus_after);
  self->focus_after = g_strdup(id);
  SunoLayer *layer = Suno_layer_tree_find(self, id);
  g_autofree char *name = text != NULL ? g_strstrip(g_strdup(text)) : NULL;
  if (commit && layer != NULL && name != NULL && *name != '\0' && g_strcmp0(name, layer->name) != 0) {
    Suno_layer_set_name(layer, name);
    g_signal_emit(self, tree_signals[TREE_RENAMED], 0, layer);
  }
  schedule_rebuild(self);
}

static void rename_activated(GtkEntry *entry, gpointer user_data) {
  finish_rename(SUNO_LAYER_TREE(user_data), TRUE, gtk_editable_get_text(GTK_EDITABLE(entry)));
}

static void rename_left(GtkEventControllerFocus *focus, gpointer user_data) {
  GtkWidget *entry = gtk_event_controller_get_widget(GTK_EVENT_CONTROLLER(focus));
  finish_rename(SUNO_LAYER_TREE(user_data), TRUE, gtk_editable_get_text(GTK_EDITABLE(entry)));
}

static gboolean rename_key(GtkEventControllerKey *keys G_GNUC_UNUSED, guint keyval, guint code G_GNUC_UNUSED,
                           GdkModifierType state G_GNUC_UNUSED, gpointer user_data) {
  if (keyval != GDK_KEY_Escape)
    return FALSE;
  finish_rename(SUNO_LAYER_TREE(user_data), FALSE, NULL);
  return TRUE;
}

static void name_pressed(GtkGestureClick *gesture, int n_press, double x G_GNUC_UNUSED, double y G_GNUC_UNUSED,
                         gpointer user_data) {
  SunoLayerTree *self = user_data;
  if (n_press != 2)
    return;
  Row *row = row_for_widget(self, gtk_event_controller_get_widget(GTK_EVENT_CONTROLLER(gesture)));
  if (row == NULL)
    return;
  gtk_gesture_set_state(GTK_GESTURE(gesture), GTK_EVENT_SEQUENCE_CLAIMED);
  Suno_layer_tree_rename(self, row->layer->id);
}

/* The caret and the eye */

static void caret_clicked(GtkButton *button, gpointer user_data) {
  SunoLayerTree *self = user_data;
  Row *row = row_for_widget(self, GTK_WIDGET(button));
  if (row == NULL)
    return;
  g_free(self->focus_after);
  self->focus_after = g_strdup(row->layer->id);
  Suno_layer_set_expanded(row->layer, !row->layer->expanded);
}

static void eye_clicked(GtkButton *button, gpointer user_data) {
  SunoLayerTree *self = user_data;
  Row *row = row_for_widget(self, GTK_WIDGET(button));
  if (row == NULL)
    return;
  SunoLayer *layer = g_object_ref(row->layer);
  Suno_layer_set_visible(layer, !layer->visible);
  g_signal_emit(self, tree_signals[TREE_VISIBILITY_CHANGED], 0, layer);
  g_object_unref(layer);
}

/* Moving: dragging a row, or Alt+Up/Down */

static gboolean is_within(SunoLayer *layer, SunoLayer *ancestor) {
  if (layer == ancestor)
    return TRUE;
  GListModel *children = G_LIST_MODEL(ancestor->children);
  for (guint i = 0; i < g_list_model_get_n_items(children); i++) {
    g_autoptr(SunoLayer) child = g_list_model_get_item(children, i);
    if (is_within(layer, child))
      return TRUE;
  }
  return FALSE;
}

static void request_move(SunoLayerTree *self, SunoLayer *layer, SunoLayer *parent, guint index) {
  g_signal_emit(self, tree_signals[TREE_MOVE_REQUESTED], 0, layer, parent, index);
}

static GdkContentProvider *drag_prepare(GtkDragSource *source, double x G_GNUC_UNUSED, double y G_GNUC_UNUSED,
                                        gpointer user_data) {
  SunoLayerTree *self = user_data;
  Row *row = row_for_widget(self, gtk_event_controller_get_widget(GTK_EVENT_CONTROLLER(source)));
  if (row == NULL || self->renaming != NULL)
    return NULL;
  return gdk_content_provider_new_typed(G_TYPE_STRING, row->layer->id);
}

static DropAt drop_at(Row *row, double y) {
  int height = gtk_widget_get_height(row->row);
  gboolean holds = g_list_model_get_n_items(G_LIST_MODEL(row->layer->children)) > 0;
  if (holds) {
    if (y < height * 0.25)
      return DROP_ABOVE;
    if (y > height * 0.75 && !row->layer->expanded)
      return DROP_BELOW;
    return DROP_INTO;
  }
  return y < height * 0.5 ? DROP_ABOVE : DROP_BELOW;
}

static void clear_drop(GtkWidget *row) {
  gtk_widget_remove_css_class(row, "drop-above");
  gtk_widget_remove_css_class(row, "drop-below");
  gtk_widget_remove_css_class(row, "drop-into");
}

static GdkDragAction drop_motion(GtkDropTarget *target, double x G_GNUC_UNUSED, double y, gpointer user_data) {
  SunoLayerTree *self = user_data;
  Row *row = row_for_widget(self, gtk_event_controller_get_widget(GTK_EVENT_CONTROLLER(target)));
  if (row == NULL)
    return 0;
  clear_drop(row->row);
  DropAt at = drop_at(row, y);
  gtk_widget_add_css_class(row->row, at == DROP_ABOVE ? "drop-above" : at == DROP_BELOW ? "drop-below" : "drop-into");
  return GDK_ACTION_MOVE;
}

static void drop_leave(GtkDropTarget *target, gpointer user_data G_GNUC_UNUSED) {
  clear_drop(gtk_event_controller_get_widget(GTK_EVENT_CONTROLLER(target)));
}

static gboolean drop_done(GtkDropTarget *target, const GValue *value, double x G_GNUC_UNUSED, double y,
                          gpointer user_data) {
  SunoLayerTree *self = user_data;
  GtkWidget *widget = gtk_event_controller_get_widget(GTK_EVENT_CONTROLLER(target));
  clear_drop(widget);
  Row *row = row_for_widget(self, widget);
  SunoLayer *moving = Suno_layer_tree_find(self, g_value_get_string(value));
  if (row == NULL || moving == NULL || is_within(row->layer, moving))
    return FALSE;
  DropAt at = drop_at(row, y);
  if (at == DROP_INTO)
    request_move(self, moving, row->layer, 0);
  else
    request_move(self, moving, row->parent, row->index + (at == DROP_BELOW ? 1 : 0));
  return TRUE;
}

/* Keys */

static Row *focused_row(SunoLayerTree *self) {
  GtkRoot *root = gtk_widget_get_root(GTK_WIDGET(self));
  GtkWidget *focus = root != NULL ? gtk_root_get_focus(root) : NULL;
  return focus != NULL ? row_for_widget(self, focus) : NULL;
}

static gboolean list_key(GtkEventControllerKey *keys G_GNUC_UNUSED, guint keyval, guint code G_GNUC_UNUSED,
                         GdkModifierType state, gpointer user_data) {
  SunoLayerTree *self = user_data;
  if (self->renaming != NULL)
    return FALSE;
  Row *row = focused_row(self);
  if (row == NULL)
    return FALSE;
  gboolean alt = (state & GDK_ALT_MASK) != 0;
  gboolean holds = g_list_model_get_n_items(G_LIST_MODEL(row->layer->children)) > 0;
  switch (keyval) {
  case GDK_KEY_Return:
  case GDK_KEY_KP_Enter:
    g_signal_emit(self, tree_signals[TREE_ACTIVATED], 0, row->layer);
    return TRUE;
  case GDK_KEY_F2:
    Suno_layer_tree_rename(self, row->layer->id);
    return TRUE;
  case GDK_KEY_Right:
    if (holds && !row->layer->expanded) {
      g_free(self->focus_after);
      self->focus_after = g_strdup(row->layer->id);
      Suno_layer_set_expanded(row->layer, TRUE);
      return TRUE;
    }
    return FALSE;
  case GDK_KEY_Left:
    if (holds && row->layer->expanded) {
      g_free(self->focus_after);
      self->focus_after = g_strdup(row->layer->id);
      Suno_layer_set_expanded(row->layer, FALSE);
      return TRUE;
    }
    return FALSE;
  case GDK_KEY_Up:
  case GDK_KEY_Down:
    if (!alt)
      return FALSE;
    {
      GListModel *siblings = row->parent != NULL ? G_LIST_MODEL(row->parent->children) : self->layers;
      guint n = g_list_model_get_n_items(siblings);
      if ((keyval == GDK_KEY_Up && row->index == 0) || (keyval == GDK_KEY_Down && row->index + 1 >= n))
        return TRUE;
      g_free(self->focus_after);
      self->focus_after = g_strdup(row->layer->id);
      /* Positions count before the layer leaves: past the next sibling is + 2. */
      request_move(self, row->layer, row->parent, keyval == GDK_KEY_Up ? row->index - 1 : row->index + 2);
      return TRUE;
    }
  default:
    return FALSE;
  }
}

static void row_activated(GtkListBox *list G_GNUC_UNUSED, GtkListBoxRow *list_row, gpointer user_data) {
  SunoLayerTree *self = user_data;
  Row *row = row_for_widget(self, GTK_WIDGET(list_row));
  if (row != NULL)
    g_signal_emit(self, tree_signals[TREE_ACTIVATED], 0, row->layer);
}

static void row_context_pressed(GtkGestureClick *gesture, int n_press G_GNUC_UNUSED,
                                double x, double y, gpointer user_data) {
  SunoLayerTree *self = user_data;
  GtkWidget *widget = gtk_event_controller_get_widget(GTK_EVENT_CONTROLLER(gesture));
  Row *row = row_for_widget(self, widget);
  if (row == NULL)
    return;
  gtk_gesture_set_state(GTK_GESTURE(gesture), GTK_EVENT_SEQUENCE_CLAIMED);
  g_signal_emit(self, tree_signals[TREE_CONTEXT_REQUESTED], 0, row->layer, widget, x, y);
}

static void selection_changed(GtkListBox *list G_GNUC_UNUSED, gpointer user_data) {
  SunoLayerTree *self = user_data;
  if (self->syncing)
    return;
  g_autoptr(GHashTable) now = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, NULL);
  for (guint i = 0; i < self->rows->len; i++) {
    Row *row = g_ptr_array_index(self->rows, i);
    if (gtk_list_box_row_is_selected(GTK_LIST_BOX_ROW(row->row)))
      g_hash_table_add(now, g_strdup(row->layer->id));
  }
  /* Selected layers inside collapsed parents stay selected. */
  GHashTableIter iter;
  gpointer id;
  g_hash_table_iter_init(&iter, self->selected);
  while (g_hash_table_iter_next(&iter, &id, NULL)) {
    SunoLayer *layer = Suno_layer_tree_find(self, id);
    if (layer != NULL && row_for_layer(self, layer) == NULL)
      g_hash_table_add(now, g_strdup(id));
  }
  gboolean same = g_hash_table_size(now) == g_hash_table_size(self->selected);
  g_hash_table_iter_init(&iter, now);
  while (same && g_hash_table_iter_next(&iter, &id, NULL))
    same = g_hash_table_contains(self->selected, id);
  for (guint i = 0; i < self->rows->len; i++) {
    Row *row = g_ptr_array_index(self->rows, i);
    Suno_ui_set_css_class(gtk_list_box_row_get_child(GTK_LIST_BOX_ROW(row->row)), "selected",
                          g_hash_table_contains(now, row->layer->id));
  }
  if (same)
    return;
  g_hash_table_remove_all(self->selected);
  g_hash_table_iter_init(&iter, now);
  while (g_hash_table_iter_next(&iter, &id, NULL))
    g_hash_table_add(self->selected, g_strdup(id));
  g_signal_emit(self, tree_signals[TREE_SELECTION_CHANGED], 0);
}

/* Building the rows */

static GtkWidget *build_row(SunoLayerTree *self, Row *row) {
  SunoLayer *layer = row->layer;
  GtkWidget *box = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  GtkGesture *context = gtk_gesture_click_new();
  gtk_gesture_single_set_button(GTK_GESTURE_SINGLE(context), GDK_BUTTON_SECONDARY);
  g_signal_connect(context, "pressed", G_CALLBACK(row_context_pressed), self);
  gtk_widget_add_controller(box, GTK_EVENT_CONTROLLER(context));
  gtk_widget_add_css_class(box, "SunoUI-creative-layer");
  Suno_ui_set_css_class(box, "hidden", !layer->visible);
  Suno_ui_set_css_class(box, "selected", g_hash_table_contains(self->selected, layer->id));
  gboolean holds = g_list_model_get_n_items(G_LIST_MODEL(layer->children)) > 0;
  if (holds) {
    GtkWidget *caret = Suno_ui_icon_button("chevron-right", layer->expanded ? "Collapse" : "Expand",
                                           "SunoUI-creative-layer-caret", FALSE, NULL);
    gtk_widget_set_tooltip_text(caret, NULL);
    gtk_widget_set_focusable(caret, FALSE);
    Suno_ui_set_css_class(caret, "open", layer->expanded);
    gtk_accessible_update_state(GTK_ACCESSIBLE(caret), GTK_ACCESSIBLE_STATE_EXPANDED, layer->expanded, -1);
    g_signal_connect(caret, "clicked", G_CALLBACK(caret_clicked), self);
    gtk_box_append(GTK_BOX(box), caret);
  } else {
    GtkWidget *blank = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
    gtk_widget_add_css_class(blank, "SunoUI-creative-layer-caret");
    gtk_box_append(GTK_BOX(box), blank);
  }
  /* The depth indents from the caret (v70: 4 px + 16 px a level). */
  gtk_widget_set_margin_start(gtk_widget_get_first_child(box), row->depth * SUNO_UI_CREATIVE_LAYER_INDENT);
  GtkWidget *icon = Suno_ui_icon_image(layer->icon, 0);
  gtk_widget_add_css_class(icon, "SunoUI-creative-layer-icon");
  gtk_box_append(GTK_BOX(box), icon);
  if (g_strcmp0(self->renaming, layer->id) == 0) {
    GtkWidget *entry = gtk_entry_new();
    gtk_editable_set_text(GTK_EDITABLE(entry), layer->name);
    gtk_editable_set_width_chars(GTK_EDITABLE(entry), 4);
    gtk_widget_set_hexpand(entry, TRUE);
    gtk_widget_add_css_class(entry, "SunoUI-creative-layer-rename");
    Suno_ui_set_accessible_label(entry, "Name");
    g_signal_connect(entry, "activate", G_CALLBACK(rename_activated), self);
    GtkEventController *focus = gtk_event_controller_focus_new();
    g_signal_connect(focus, "leave", G_CALLBACK(rename_left), self);
    gtk_widget_add_controller(entry, focus);
    GtkEventController *keys = gtk_event_controller_key_new();
    g_signal_connect(keys, "key-pressed", G_CALLBACK(rename_key), self);
    gtk_widget_add_controller(entry, keys);
    gtk_box_append(GTK_BOX(box), entry);
  } else {
    GtkWidget *name = gtk_label_new(layer->name);
    gtk_label_set_ellipsize(GTK_LABEL(name), PANGO_ELLIPSIZE_END);
    gtk_label_set_xalign(GTK_LABEL(name), 0);
    gtk_widget_set_hexpand(name, TRUE);
    gtk_widget_add_css_class(name, "SunoUI-creative-layer-name");
    GtkGesture *click = gtk_gesture_click_new();
    g_signal_connect(click, "pressed", G_CALLBACK(name_pressed), self);
    gtk_widget_add_controller(name, GTK_EVENT_CONTROLLER(click));
    gtk_box_append(GTK_BOX(box), name);
  }
  if (layer->detail != NULL && *layer->detail != '\0') {
    GtkWidget *detail = gtk_label_new(layer->detail);
    gtk_widget_add_css_class(detail, "SunoUI-creative-layer-detail");
    gtk_box_append(GTK_BOX(box), detail);
  }
  if (layer->can_hide) {
    g_autofree char *label = g_strdup_printf("%s %s", layer->visible ? "Hide" : "Show", layer->name);
    GtkWidget *eye = Suno_ui_icon_button(layer->visible ? "eye" : "eye-off", label, "SunoUI-creative-layer-eye",
                                         FALSE, NULL);
    gtk_widget_set_tooltip_text(eye, label);
    gtk_widget_set_focusable(eye, FALSE);
    g_signal_connect(eye, "clicked", G_CALLBACK(eye_clicked), self);
    gtk_box_append(GTK_BOX(box), eye);
  }

  /* A tree item (v70's rows are the tree's own, not buttons), at its level. */
  GtkWidget *list_row = g_object_new(GTK_TYPE_LIST_BOX_ROW, "accessible-role", GTK_ACCESSIBLE_ROLE_TREE_ITEM, NULL);
  /* Rows select; they are not buttons (v70 .sulyr). Enter still activates
   * (list_key), a double click renames. */
  gtk_list_box_row_set_activatable(GTK_LIST_BOX_ROW(list_row), FALSE);
  gtk_accessible_update_property(GTK_ACCESSIBLE(list_row), GTK_ACCESSIBLE_PROPERTY_LEVEL, row->depth + 1, -1);
  gtk_list_box_row_set_child(GTK_LIST_BOX_ROW(list_row), box);
  Suno_ui_set_accessible_label(list_row, layer->name);
  if (holds)
    gtk_accessible_update_state(GTK_ACCESSIBLE(list_row), GTK_ACCESSIBLE_STATE_EXPANDED, layer->expanded, -1);
  GtkDragSource *source = gtk_drag_source_new();
  gtk_drag_source_set_actions(source, GDK_ACTION_MOVE);
  g_signal_connect(source, "prepare", G_CALLBACK(drag_prepare), self);
  gtk_widget_add_controller(list_row, GTK_EVENT_CONTROLLER(source));
  GtkDropTarget *target = gtk_drop_target_new(G_TYPE_STRING, GDK_ACTION_MOVE);
  g_signal_connect(target, "motion", G_CALLBACK(drop_motion), self);
  g_signal_connect(target, "leave", G_CALLBACK(drop_leave), self);
  g_signal_connect(target, "drop", G_CALLBACK(drop_done), self);
  gtk_widget_add_controller(list_row, GTK_EVENT_CONTROLLER(target));
  return list_row;
}

static void flatten(SunoLayerTree *self, GListModel *model, SunoLayer *parent, int depth) {
  watch(self, model, "items-changed");
  guint n = g_list_model_get_n_items(model);
  for (guint i = 0; i < n; i++) {
    g_autoptr(GObject) item = g_list_model_get_item(model, i);
    if (!SUNO_IS_LAYER(item)) {
      g_critical("a layer tree shows SunoLayer items only");
      continue;
    }
    SunoLayer *layer = SUNO_LAYER(item);
    watch(self, layer, "notify");
    Row *row = g_new0(Row, 1);
    row->layer = g_object_ref(layer);
    row->parent = parent != NULL ? g_object_ref(parent) : NULL;
    row->index = i;
    row->depth = depth;
    g_ptr_array_add(self->rows, row);
    row->row = build_row(self, row);
    gtk_list_box_append(GTK_LIST_BOX(self->list), row->row);
    if (layer->expanded)
      flatten(self, G_LIST_MODEL(layer->children), layer, depth + 1);
    else
      watch(self, layer->children, "items-changed");
  }
}

static void rebuild(SunoLayerTree *self) {
  g_clear_handle_id(&self->rebuild_id, g_source_remove);
  Row *had = focused_row(self);
  if (had != NULL && self->focus_after == NULL)
    self->focus_after = g_strdup(had->layer->id);
  self->syncing = TRUE;
  g_ptr_array_set_size(self->watches, 0);
  gtk_list_box_remove_all(GTK_LIST_BOX(self->list));
  g_ptr_array_set_size(self->rows, 0);
  if (self->layers != NULL)
    flatten(self, self->layers, NULL, 0);
  for (guint i = 0; i < self->rows->len; i++) {
    Row *row = g_ptr_array_index(self->rows, i);
    if (g_hash_table_contains(self->selected, row->layer->id))
      gtk_list_box_select_row(GTK_LIST_BOX(self->list), GTK_LIST_BOX_ROW(row->row));
  }
  self->syncing = FALSE;
  g_autofree char *focus = g_steal_pointer(&self->focus_after);
  for (guint i = 0; i < self->rows->len; i++) {
    Row *row = g_ptr_array_index(self->rows, i);
    if (g_strcmp0(row->layer->id, self->renaming) == 0) {
      GtkWidget *entry = NULL;
      for (GtkWidget *child = gtk_widget_get_first_child(gtk_list_box_row_get_child(GTK_LIST_BOX_ROW(row->row)));
           child != NULL; child = gtk_widget_get_next_sibling(child))
        if (GTK_IS_ENTRY(child))
          entry = child;
      if (entry != NULL) {
        gtk_widget_grab_focus(entry);
        gtk_editable_select_region(GTK_EDITABLE(entry), 0, -1);
      }
    } else if (focus != NULL && g_strcmp0(row->layer->id, focus) == 0) {
      gtk_widget_grab_focus(row->row);
    }
  }
}

static void Suno_layer_tree_dispose(GObject *object) {
  SunoLayerTree *self = SUNO_LAYER_TREE(object);
  g_clear_handle_id(&self->rebuild_id, g_source_remove);
  if (self->watches != NULL)
    g_ptr_array_set_size(self->watches, 0);
  if (self->rows != NULL)
    g_ptr_array_set_size(self->rows, 0);
  g_clear_pointer(&self->list, gtk_widget_unparent);
  g_clear_object(&self->layers);
  G_OBJECT_CLASS(Suno_layer_tree_parent_class)->dispose(object);
}

static void Suno_layer_tree_finalize(GObject *object) {
  SunoLayerTree *self = SUNO_LAYER_TREE(object);
  g_clear_pointer(&self->rows, g_ptr_array_unref);
  g_clear_pointer(&self->watches, g_ptr_array_unref);
  g_clear_pointer(&self->selected, g_hash_table_unref);
  g_clear_pointer(&self->renaming, g_free);
  g_clear_pointer(&self->focus_after, g_free);
  G_OBJECT_CLASS(Suno_layer_tree_parent_class)->finalize(object);
}

static void Suno_layer_tree_class_init(SunoLayerTreeClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS(klass);
  object_class->dispose = Suno_layer_tree_dispose;
  object_class->finalize = Suno_layer_tree_finalize;
  gtk_widget_class_set_layout_manager_type(widget_class, GTK_TYPE_BIN_LAYOUT);
  /**
   * SunoLayerTree::selection-changed:
   * @self: the tree
   *
   * A person changed which layers are selected; read them with
   * Suno_layer_tree_get_selected().
   */
  tree_signals[TREE_SELECTION_CHANGED] = g_signal_new("selection-changed", G_TYPE_FROM_CLASS(klass),
                                                      G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL, G_TYPE_NONE, 0);
  /**
   * SunoLayerTree::activated:
   * @self: the tree
   * @layer: the layer a person activated (Enter on its row)
   */
  tree_signals[TREE_ACTIVATED] = g_signal_new("activated", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL,
                                              NULL, NULL, G_TYPE_NONE, 1, SUNO_TYPE_LAYER);
  /**
   * SunoLayerTree::visibility-changed:
   * @self: the tree
   * @layer: the layer a person showed or hid (its #SunoLayer:visible is already set)
   */
  tree_signals[TREE_VISIBILITY_CHANGED] = g_signal_new("visibility-changed", G_TYPE_FROM_CLASS(klass),
                                                       G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL, G_TYPE_NONE, 1,
                                                       SUNO_TYPE_LAYER);
  /**
   * SunoLayerTree::renamed:
   * @self: the tree
   * @layer: the layer a person renamed (its #SunoLayer:name is already set)
   */
  tree_signals[TREE_RENAMED] = g_signal_new("renamed", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL, NULL,
                                            NULL, G_TYPE_NONE, 1, SUNO_TYPE_LAYER);
  /**
   * SunoLayerTree::move-requested:
   * @self: the tree
   * @layer: the layer a person moved
   * @parent: (nullable): its new parent, or %NULL for the top level
   * @index: its new position among @parent's children, counted before it
   *   leaves its old place
   *
   * The app moves the layer in its document (and so in the models).
   */
  tree_signals[TREE_MOVE_REQUESTED] = g_signal_new("move-requested", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST,
                                                   0, NULL, NULL, NULL, G_TYPE_NONE, 3, SUNO_TYPE_LAYER,
                                                   SUNO_TYPE_LAYER, G_TYPE_UINT);
  /**
   * SunoLayerTree::context-requested:
   * @self: the tree
   * @layer: the layer under the pointer
   * @anchor: its row, for presenting the menu
   * @x: pointer x in the row
   * @y: pointer y in the row
   */
  tree_signals[TREE_CONTEXT_REQUESTED] = g_signal_new("context-requested", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST,
                                                       0, NULL, NULL, NULL, G_TYPE_NONE, 4, SUNO_TYPE_LAYER,
                                                       GTK_TYPE_WIDGET, G_TYPE_DOUBLE, G_TYPE_DOUBLE);
}

static void Suno_layer_tree_init(SunoLayerTree *self) {
  Suno_creative_install();
  self->rows = g_ptr_array_new_with_free_func(row_free);
  self->watches = g_ptr_array_new_with_free_func(watch_free);
  self->selected = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, NULL);
  self->list = g_object_new(GTK_TYPE_LIST_BOX, "accessible-role", GTK_ACCESSIBLE_ROLE_TREE, NULL);
  gtk_widget_add_css_class(self->list, "SunoUI-creative-layers");
  gtk_list_box_set_selection_mode(GTK_LIST_BOX(self->list), GTK_SELECTION_MULTIPLE);
  gtk_list_box_set_activate_on_single_click(GTK_LIST_BOX(self->list), FALSE);
  Suno_ui_set_accessible_label(self->list, "Layers");
  g_signal_connect(self->list, "selected-rows-changed", G_CALLBACK(selection_changed), self);
  g_signal_connect(self->list, "row-activated", G_CALLBACK(row_activated), self);
  GtkEventController *keys = gtk_event_controller_key_new();
  gtk_event_controller_set_propagation_phase(keys, GTK_PHASE_CAPTURE);
  g_signal_connect(keys, "key-pressed", G_CALLBACK(list_key), self);
  gtk_widget_add_controller(self->list, keys);
  gtk_widget_set_parent(self->list, GTK_WIDGET(self));
}

GtkWidget *Suno_layer_tree_new(GListModel *layers) {
  GtkWidget *self = g_object_new(SUNO_TYPE_LAYER_TREE, NULL);
  if (layers != NULL)
    Suno_layer_tree_set_layers(SUNO_LAYER_TREE(self), layers);
  return self;
}

void Suno_layer_tree_set_layers(SunoLayerTree *self, GListModel *layers) {
  g_return_if_fail(SUNO_IS_LAYER_TREE(self));
  g_return_if_fail(layers == NULL || G_IS_LIST_MODEL(layers));
  g_set_object(&self->layers, layers);
  rebuild(self);
}

GListModel *Suno_layer_tree_get_layers(SunoLayerTree *self) {
  g_return_val_if_fail(SUNO_IS_LAYER_TREE(self), NULL);
  return self->layers;
}

static SunoLayer *find_in(GListModel *model, const char *id, GPtrArray *path) {
  guint n = g_list_model_get_n_items(model);
  for (guint i = 0; i < n; i++) {
    g_autoptr(SunoLayer) layer = g_list_model_get_item(model, i);
    if (!SUNO_IS_LAYER(layer))
      continue;
    if (g_strcmp0(layer->id, id) == 0)
      return layer;
    if (path != NULL)
      g_ptr_array_add(path, layer);
    SunoLayer *found = find_in(G_LIST_MODEL(layer->children), id, path);
    if (found != NULL)
      return found;
    if (path != NULL)
      g_ptr_array_remove_index(path, path->len - 1);
  }
  return NULL;
}

SunoLayer *Suno_layer_tree_find(SunoLayerTree *self, const char *id) {
  g_return_val_if_fail(SUNO_IS_LAYER_TREE(self), NULL);
  g_return_val_if_fail(id != NULL, NULL);
  return self->layers != NULL ? find_in(self->layers, id, NULL) : NULL;
}

void Suno_layer_tree_set_selected(SunoLayerTree *self, const char *const *ids) {
  g_return_if_fail(SUNO_IS_LAYER_TREE(self));
  g_hash_table_remove_all(self->selected);
  for (guint i = 0; ids != NULL && ids[i] != NULL; i++) {
    g_hash_table_add(self->selected, g_strdup(ids[i]));
    /* Open the way to it. */
    g_autoptr(GPtrArray) path = g_ptr_array_new();
    if (self->layers != NULL && find_in(self->layers, ids[i], path) != NULL)
      for (guint j = 0; j < path->len; j++)
        Suno_layer_set_expanded(g_ptr_array_index(path, j), TRUE);
  }
  rebuild(self);
}

char **Suno_layer_tree_get_selected(SunoLayerTree *self) {
  g_return_val_if_fail(SUNO_IS_LAYER_TREE(self), NULL);
  g_autoptr(GStrvBuilder) builder = g_strv_builder_new();
  g_autoptr(GHashTable) seen = g_hash_table_new(g_str_hash, g_str_equal);
  for (guint i = 0; i < self->rows->len; i++) {
    Row *row = g_ptr_array_index(self->rows, i);
    if (g_hash_table_contains(self->selected, row->layer->id)) {
      g_strv_builder_add(builder, row->layer->id);
      g_hash_table_add(seen, row->layer->id);
    }
  }
  GHashTableIter iter;
  gpointer id;
  g_hash_table_iter_init(&iter, self->selected);
  while (g_hash_table_iter_next(&iter, &id, NULL))
    if (!g_hash_table_contains(seen, id))
      g_strv_builder_add(builder, id);
  return g_strv_builder_end(builder);
}

void Suno_layer_tree_rename(SunoLayerTree *self, const char *id) {
  g_return_if_fail(SUNO_IS_LAYER_TREE(self));
  g_return_if_fail(id != NULL);
  if (Suno_layer_tree_find(self, id) == NULL) {
    g_critical("unknown layer '%s'", id);
    return;
  }
  g_free(self->renaming);
  self->renaming = g_strdup(id);
  rebuild(self);
}
