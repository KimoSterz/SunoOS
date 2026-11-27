/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI layers, the one place floating parts appear: the twin of
 * structure_layers.py (LayerHost, ModalHandle) and action_toast.ToastHost.
 *
 * A window gets a host at its root on first use (below the title row on a
 * SunoApplicationWindow); an app may put one around a region so toasts centre
 * on it. present_modal() shows a card over a scrim: centred on a computer, a
 * bottom drawer at phone width. Esc cancels, Tab stays inside, the content
 * behind can't take focus, focus returns where it was. A click on the scrim
 * nudges a dialog and closes a drawer; dragging a drawer down closes it.
 */
#include "Suno-layer-host.h"
#include "Suno-sheet-private.h"
#include "Suno-ui-private.h"

#include <adwaita.h>

G_DEFINE_ENUM_TYPE(SunoDrawerMode, Suno_drawer_mode,
                   G_DEFINE_ENUM_VALUE(SUNO_DRAWER_MODE_AUTO, "auto"),
                   G_DEFINE_ENUM_VALUE(SUNO_DRAWER_MODE_NEVER, "never"),
                   G_DEFINE_ENUM_VALUE(SUNO_DRAWER_MODE_ALWAYS, "always"))

/* ── ModalHandle ─────────────────────────────────────────────────────── */

struct _SunoModalHandle {
  GObject parent_instance;
  SunoLayerHost *host; /* weak */
  GtkWidget *card;     /* weak */
  GtkWidget *scrim;    /* weak */
  GtkWidget *return_focus; /* weak */
  GtkEventController *keys;
  GtkWidget *keys_root; /* weak */
  gboolean drawer;
  gboolean closed;
  SunoSheetFrame *frame; /* a question in the bar's frame (Suno-sheet-private.h) */
  guint nudge_source;
};

G_DEFINE_FINAL_TYPE(SunoModalHandle, Suno_modal_handle, G_TYPE_OBJECT)

enum { HANDLE_CANCELLED, N_HANDLE_SIGNALS };
static guint handle_signals[N_HANDLE_SIGNALS];

static void Suno_layer_host_modal_closed(SunoLayerHost *self, SunoModalHandle *handle, gboolean quiet);

static void Suno_modal_handle_dispose(GObject *object) {
  SunoModalHandle *self = SUNO_MODAL_HANDLE(object);
  g_clear_handle_id(&self->nudge_source, g_source_remove);
  g_clear_pointer(&self->frame, Suno_sheet_frame_free);
  g_clear_weak_pointer(&self->host);
  g_clear_weak_pointer(&self->card);
  g_clear_weak_pointer(&self->scrim);
  g_clear_weak_pointer(&self->return_focus);
  g_clear_weak_pointer(&self->keys_root);
  G_OBJECT_CLASS(Suno_modal_handle_parent_class)->dispose(object);
}

static void Suno_modal_handle_class_init(SunoModalHandleClass *klass) {
  G_OBJECT_CLASS(klass)->dispose = Suno_modal_handle_dispose;
  /**
   * SunoModalHandle::cancelled:
   *
   * The card was closed as Cancel or Esc would (a tap on a drawer's scrim, a
   * swipe down), not by its own action.
   */
  handle_signals[HANDLE_CANCELLED] = g_signal_new("cancelled", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST,
                                                  0, NULL, NULL, NULL, G_TYPE_NONE, 0);
}

static void Suno_modal_handle_init(SunoModalHandle *self G_GNUC_UNUSED) {}

void Suno_modal_handle_close(SunoModalHandle *self) {
  g_return_if_fail(SUNO_IS_MODAL_HANDLE(self));
  if (self->closed)
    return;
  self->closed = TRUE;
  if (self->host != NULL)
    Suno_layer_host_modal_closed(self->host, self, FALSE);
}

static void Suno_modal_handle_close_quiet(SunoModalHandle *self) {
  if (self->closed)
    return;
  self->closed = TRUE;
  if (self->host != NULL)
    Suno_layer_host_modal_closed(self->host, self, TRUE);
}

void Suno_modal_handle_cancel(SunoModalHandle *self) {
  g_return_if_fail(SUNO_IS_MODAL_HANDLE(self));
  if (self->closed)
    return;
  g_object_ref(self);
  Suno_modal_handle_close(self);
  g_signal_emit(self, handle_signals[HANDLE_CANCELLED], 0);
  g_object_unref(self);
}

static gboolean nudge_end(gpointer user_data) {
  SunoModalHandle *self = user_data;
  self->nudge_source = 0;
  if (self->card != NULL)
    gtk_widget_remove_css_class(self->card, "nudge");
  return G_SOURCE_REMOVE;
}

static gboolean nudge_start(gpointer user_data) {
  SunoModalHandle *self = user_data;
  if (self->card != NULL)
    gtk_widget_add_css_class(self->card, "nudge");
  g_object_unref(self);
  return G_SOURCE_REMOVE;
}

void Suno_modal_handle_nudge(SunoModalHandle *self) {
  g_return_if_fail(SUNO_IS_MODAL_HANDLE(self));
  if (Suno_ui_reduced_motion() || self->card == NULL)
    return;
  gtk_widget_remove_css_class(self->card, "nudge");
  Suno_ui_on_next_frame(self->card, nudge_start, g_object_ref(self));
  g_clear_handle_id(&self->nudge_source, g_source_remove);
  self->nudge_source = g_timeout_add(Suno_ui_duration(SUNO_UI_MOTION_NUDGE_MS, FALSE) + 20, nudge_end, self);
}

GtkWidget *Suno_modal_handle_get_card(SunoModalHandle *self) {
  g_return_val_if_fail(SUNO_IS_MODAL_HANDLE(self), NULL);
  return self->card;
}

gboolean Suno_modal_handle_get_is_drawer(SunoModalHandle *self) {
  g_return_val_if_fail(SUNO_IS_MODAL_HANDLE(self), FALSE);
  return self->drawer;
}

/* ── LayerHost ───────────────────────────────────────────────────────── */

typedef struct {
  char *layer_name;
  SunoModalHandle *modal; /* owned */
  GPtrArray *bars;        /* weak refs held by the array's free func */
} SunoLayerHostPrivate;

/* Python's LayerHost is a Gtk.Overlay: keep the `overlay` node, no wrapper. */
SUNO_DEFINE_OPAQUE_SUBTYPE(SunoLayerHost, Suno_layer_host, GTK_TYPE_OVERLAY)

#define PRIV(self) Suno_layer_host_get_instance_private(SUNO_LAYER_HOST(self))

static void bar_gone(gpointer data, GObject *where_the_object_was) {
  GPtrArray *bars = data;
  g_ptr_array_remove(bars, where_the_object_was);
}

static void Suno_layer_host_dispose(GObject *object) {
  SunoLayerHostPrivate *priv = PRIV(object);
  if (priv->modal != NULL) {
    priv->modal->closed = TRUE;
    g_clear_object(&priv->modal);
  }
  if (priv->bars != NULL) {
    for (guint i = 0; i < priv->bars->len; i++)
      g_object_weak_unref(g_ptr_array_index(priv->bars, i), bar_gone, priv->bars);
    g_clear_pointer(&priv->bars, g_ptr_array_unref);
  }
  G_OBJECT_CLASS(Suno_layer_host_parent_class)->dispose(object);
}

static void Suno_layer_host_finalize(GObject *object) {
  g_free(PRIV(object)->layer_name);
  G_OBJECT_CLASS(Suno_layer_host_parent_class)->finalize(object);
}

static void Suno_layer_host_class_init(SunoLayerHostClass *klass) {
  G_OBJECT_CLASS(klass)->dispose = Suno_layer_host_dispose;
  G_OBJECT_CLASS(klass)->finalize = Suno_layer_host_finalize;
}

static void Suno_layer_host_init(SunoLayerHost *self) {
  SunoLayerHostPrivate *priv = PRIV(self);
  priv->layer_name = g_strdup("content");
  priv->bars = g_ptr_array_new();
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-layer-host");
}

static GtkWidget *Suno_layer_host_new_named(GtkWidget *child, const char *name) {
  GtkWidget *self = g_object_new(SUNO_TYPE_LAYER_HOST, NULL);
  g_free(PRIV(self)->layer_name);
  PRIV(self)->layer_name = g_strdup(name);
  if (child != NULL)
    gtk_overlay_set_child(GTK_OVERLAY(self), child);
  return self;
}

GtkWidget *Suno_layer_host_new(GtkWidget *child) {
  g_return_val_if_fail(child == NULL || GTK_IS_WIDGET(child), NULL);
  return Suno_layer_host_new_named(child, "content");
}

GtkWidget *Suno_layer_host_new_window(GtkWidget *child) {
  return Suno_layer_host_new_named(child, "window");
}

void Suno_layer_host_set_child(SunoLayerHost *self, GtkWidget *child) {
  g_return_if_fail(SUNO_IS_LAYER_HOST(self));
  gtk_overlay_set_child(GTK_OVERLAY(self), child);
}

GtkWidget *Suno_layer_host_get_child(SunoLayerHost *self) {
  g_return_val_if_fail(SUNO_IS_LAYER_HOST(self), NULL);
  return gtk_overlay_get_child(GTK_OVERLAY(self));
}

const char *Suno_layer_host_get_layer_name(gpointer host) {
  g_return_val_if_fail(SUNO_IS_LAYER_HOST(host), NULL);
  return PRIV(host)->layer_name;
}

void Suno_layer_host_add_layer(gpointer host, GtkWidget *widget) {
  g_return_if_fail(SUNO_IS_LAYER_HOST(host));
  gtk_overlay_add_overlay(GTK_OVERLAY(host), widget);
}

void Suno_layer_host_remove_layer(gpointer host, GtkWidget *widget) {
  g_return_if_fail(SUNO_IS_LAYER_HOST(host));
  if (gtk_widget_get_parent(widget) == GTK_WIDGET(host))
    gtk_overlay_remove_overlay(GTK_OVERLAY(host), widget);
}

GPtrArray *Suno_layer_host_get_tracked_bars(gpointer host) {
  g_return_val_if_fail(SUNO_IS_LAYER_HOST(host), NULL);
  return PRIV(host)->bars;
}

void Suno_layer_host_track_bar(SunoLayerHost *self, GtkWidget *bar) {
  g_return_if_fail(SUNO_IS_LAYER_HOST(self));
  g_return_if_fail(GTK_IS_WIDGET(bar));
  SunoLayerHostPrivate *priv = PRIV(self);
  if (g_ptr_array_find(priv->bars, bar, NULL))
    return;
  g_ptr_array_add(priv->bars, bar);
  g_object_weak_ref(G_OBJECT(bar), bar_gone, priv->bars);
}

SunoLayerHost *Suno_layer_host_install(GtkWindow *window) {
  g_return_val_if_fail(GTK_IS_WINDOW(window), NULL);
  SunoLayerHost *own = g_object_get_data(G_OBJECT(window), "Suno-layer-host");
  if (own != NULL)
    return own;
  gboolean adw = ADW_IS_APPLICATION_WINDOW(window) || ADW_IS_WINDOW(window);
  GtkWidget *content = ADW_IS_APPLICATION_WINDOW(window) ? adw_application_window_get_content(ADW_APPLICATION_WINDOW(window))
                       : ADW_IS_WINDOW(window)           ? adw_window_get_content(ADW_WINDOW(window))
                                                         : gtk_window_get_child(window);
  if (SUNO_IS_LAYER_HOST(content) && g_strcmp0(PRIV(content)->layer_name, "window") == 0)
    return SUNO_LAYER_HOST(content);
  if (content != NULL)
    g_object_ref(content);
  /* Take focus out while the tree is whole and put it back after: unparenting the focused page makes
   * GTK synthesize the focus change on a detached widget, and the refs it takes then are never
   * dropped (Settings' Apps view outlived its window whenever the first toast or dialog installed
   * the host while a row had focus). */
  GtkWidget *focus = gtk_root_get_focus(GTK_ROOT(window));
  if (focus != NULL && content != NULL && (focus == content || gtk_widget_is_ancestor(focus, content))) {
    g_object_ref(focus);
    gtk_root_set_focus(GTK_ROOT(window), NULL);
  } else {
    focus = NULL;
  }
  if (ADW_IS_APPLICATION_WINDOW(window))
    adw_application_window_set_content(ADW_APPLICATION_WINDOW(window), NULL);
  else if (ADW_IS_WINDOW(window))
    adw_window_set_content(ADW_WINDOW(window), NULL);
  else
    gtk_window_set_child(window, NULL);
  GtkWidget *host = Suno_layer_host_new_named(content, "window");
  if (content != NULL)
    g_object_unref(content);
  if (ADW_IS_APPLICATION_WINDOW(window))
    adw_application_window_set_content(ADW_APPLICATION_WINDOW(window), host);
  else if (adw)
    adw_window_set_content(ADW_WINDOW(window), host);
  else
    gtk_window_set_child(window, host);
  if (focus != NULL) {
    if (gtk_widget_get_root(focus) == GTK_ROOT(window))
      gtk_widget_grab_focus(focus);
    g_object_unref(focus);
  }
  Suno_ui_install();
  return SUNO_LAYER_HOST(host);
}

SunoLayerHost *Suno_layer_host_for_widget(GtkWidget *widget) {
  g_return_val_if_fail(GTK_IS_WIDGET(widget), NULL);
  for (GtkWidget *node = widget; node != NULL; node = gtk_widget_get_parent(node))
    if (SUNO_IS_LAYER_HOST(node))
      return SUNO_LAYER_HOST(node);
  GtkRoot *root = gtk_widget_get_root(widget);
  if (!GTK_IS_WINDOW(root)) {
    g_critical("SunoUI layers need a widget that is inside a window");
    return NULL;
  }
  return Suno_layer_host_install(GTK_WINDOW(root));
}

SunoLayerHost *Suno_layer_host_window_host(GtkWidget *widget) {
  g_return_val_if_fail(GTK_IS_WIDGET(widget), NULL);
  for (GtkWidget *node = widget; node != NULL; node = gtk_widget_get_parent(node))
    if (SUNO_IS_LAYER_HOST(node) && g_strcmp0(PRIV(node)->layer_name, "window") == 0)
      return SUNO_LAYER_HOST(node);
  GtkRoot *root = gtk_widget_get_root(widget);
  if (!GTK_IS_WINDOW(root)) {
    g_critical("SunoUI layers need a widget that is inside a window");
    return NULL;
  }
  return Suno_layer_host_install(GTK_WINDOW(root));
}

SunoModalHandle *Suno_layer_host_get_modal(SunoLayerHost *self) {
  g_return_val_if_fail(SUNO_IS_LAYER_HOST(self), NULL);
  return PRIV(self)->modal;
}

/* Focusable, sensitive, visible controls inside a widget, in order. */
static void focusables_walk(GtkWidget *node, GPtrArray *found) {
  for (GtkWidget *child = gtk_widget_get_first_child(node); child != NULL;
       child = gtk_widget_get_next_sibling(child)) {
    if (!gtk_widget_get_visible(child) || !gtk_widget_is_sensitive(child))
      continue;
    if (gtk_widget_get_focusable(child) && gtk_widget_get_can_focus(child))
      g_ptr_array_add(found, child);
    else
      focusables_walk(child, found);
  }
}

static gboolean modal_key(GtkEventControllerKey *controller G_GNUC_UNUSED, guint keyval,
                          guint keycode G_GNUC_UNUSED, GdkModifierType state, gpointer user_data) {
  SunoModalHandle *handle = user_data;
  if (handle->closed || handle->card == NULL)
    return FALSE;
  if (keyval == GDK_KEY_Escape) {
    Suno_modal_handle_cancel(handle);
    return TRUE;
  }
  if (keyval == GDK_KEY_Tab || keyval == GDK_KEY_ISO_Left_Tab || keyval == GDK_KEY_KP_Tab) {
    g_autoptr(GPtrArray) items = g_ptr_array_new();
    focusables_walk(handle->card, items);
    if (items->len == 0)
      return TRUE;
    GtkRoot *root = gtk_widget_get_root(handle->card);
    GtkWidget *focus = root != NULL ? gtk_root_get_focus(root) : NULL;
    int current = -1;
    for (guint i = 0; i < items->len && focus != NULL; i++) {
      GtkWidget *item = g_ptr_array_index(items, i);
      if (focus == item || gtk_widget_is_ancestor(focus, item)) {
        current = (int)i;
        break;
      }
    }
    gboolean backwards = keyval == GDK_KEY_ISO_Left_Tab || (state & GDK_SHIFT_MASK) != 0;
    int n = (int)items->len;
    int next = ((current + (backwards ? -1 : 1)) % n + n) % n;
    gtk_widget_grab_focus(g_ptr_array_index(items, (guint)next));
    return TRUE;
  }
  return FALSE;
}

static void scrim_released(GtkGestureClick *gesture G_GNUC_UNUSED, int n_press G_GNUC_UNUSED,
                           double x G_GNUC_UNUSED, double y G_GNUC_UNUSED, gpointer user_data) {
  SunoModalHandle *handle = user_data;
  if (handle->drawer)
    Suno_modal_handle_cancel(handle);
  else
    Suno_modal_handle_nudge(handle);
}

static void drawer_drag_end(GtkGestureDrag *gesture G_GNUC_UNUSED, double x G_GNUC_UNUSED, double y,
                            gpointer user_data) {
  if (y > 80)
    Suno_modal_handle_cancel(user_data);
}

typedef struct {
  SunoModalHandle *handle;
  GtkWidget *initial_focus;
} Shown;

static gboolean modal_shown(gpointer user_data) {
  Shown *shown = user_data;
  SunoModalHandle *handle = shown->handle;
  if (!handle->closed && handle->card != NULL) {
    if (handle->scrim != NULL)
      gtk_widget_add_css_class(handle->scrim, "shown");
    gtk_widget_add_css_class(handle->card, "shown");
    GtkWidget *target = shown->initial_focus;
    if (target == NULL) {
      g_autoptr(GPtrArray) items = g_ptr_array_new();
      focusables_walk(handle->card, items);
      target = items->len > 0 ? g_ptr_array_index(items, 0) : NULL;
    }
    if (target != NULL)
      gtk_widget_grab_focus(target);
  }
  g_clear_object(&shown->initial_focus);
  g_object_unref(handle);
  g_free(shown);
  return G_SOURCE_REMOVE;
}

#define SUNO_LAYER_DRAWER_GUTTER 16
#define SUNO_LAYER_DRAWER_BOTTOM 34
#define SUNO_LAYER_DRAWER_HEADROOM 120

SunoModalHandle *Suno_layer_host_present_modal(SunoLayerHost *self, GtkWidget *card, GtkWidget *initial_focus,
                                               SunoDrawerMode mode) {
  g_return_val_if_fail(SUNO_IS_LAYER_HOST(self), NULL);
  g_return_val_if_fail(GTK_IS_WIDGET(card), NULL);
  g_return_val_if_fail(initial_focus == NULL || GTK_IS_WIDGET(initial_focus), NULL);
  SunoLayerHostPrivate *priv = PRIV(self);
  if (priv->modal != NULL)
    Suno_modal_handle_close_quiet(priv->modal);
  Suno_ui_install();
  gboolean drawer = mode == SUNO_DRAWER_MODE_ALWAYS ||
                    (mode == SUNO_DRAWER_MODE_AUTO && Suno_ui_is_phone_width(GTK_WIDGET(self)));
  /* A question (the destructive confirm) is placed and moved by the window sheets' frame engine: the
   * bar's place, the whole travel, the swipe; centred no wider than 560 on a tablet. */
  gboolean question = drawer && Suno_sheet_is_question(card);

  GtkWidget *scrim = g_object_new(GTK_TYPE_BOX, "hexpand", TRUE, "vexpand", TRUE, "can-focus", FALSE, NULL);
  gtk_widget_add_css_class(scrim, "SunoUI-scrim");
  gtk_widget_add_css_class(card, "SunoUI-modal");
  /* A confirm keeps the modal scrim even as a drawer (v70 .lcscrim at phone width too); a menu drawer
   * dims deeper (v70 .ldrawer). */
  Suno_ui_set_css_class(scrim, "drawer", drawer && !gtk_widget_has_css_class(card, "SunoUI-dialog"));
  Suno_ui_set_css_class(card, "drawer", drawer);
  gtk_widget_set_halign(card, drawer ? GTK_ALIGN_FILL : GTK_ALIGN_CENTER);
  gtk_widget_set_valign(card, drawer ? GTK_ALIGN_END : GTK_ALIGN_CENTER);
  if (drawer) {
    /* v71: menus, sheets and the phone's confirm rise from the bar's place, in its frame: on the 16 px
     * gutter, 34 above the foot, up to the full height less 120 (the card scrolls past that). */
    gtk_widget_set_margin_start(card, SUNO_LAYER_DRAWER_GUTTER);
    gtk_widget_set_margin_end(card, SUNO_LAYER_DRAWER_GUTTER);
    gtk_widget_set_margin_bottom(card, SUNO_LAYER_DRAWER_BOTTOM);
    gtk_widget_set_margin_top(card, SUNO_LAYER_DRAWER_HEADROOM - SUNO_LAYER_DRAWER_BOTTOM);
  }

  SunoModalHandle *handle = g_object_new(SUNO_TYPE_MODAL_HANDLE, NULL);
  g_set_weak_pointer(&handle->host, self);
  g_set_weak_pointer(&handle->card, card);
  g_set_weak_pointer(&handle->scrim, scrim);
  handle->drawer = drawer;
  priv->modal = handle; /* the host's reference, until it closes */
  /* The card keeps its handle alive, so the pointer returned stays valid
   * while the card exists. */
  g_object_set_data_full(G_OBJECT(card), "Suno-modal-handle", g_object_ref(handle), g_object_unref);

  if (!question) { /* the frame takes a question's taps and swipes */
    GtkGesture *click = gtk_gesture_click_new();
    g_signal_connect(click, "released", G_CALLBACK(scrim_released), handle);
    gtk_widget_add_controller(scrim, GTK_EVENT_CONTROLLER(click));
  }
  if (drawer && !question) {
    GtkGesture *drag = gtk_gesture_drag_new();
    g_signal_connect(drag, "drag-end", G_CALLBACK(drawer_drag_end), handle);
    gtk_widget_add_controller(card, GTK_EVENT_CONTROLLER(drag));
  }

  GtkRoot *root = gtk_widget_get_root(GTK_WIDGET(self));
  g_set_weak_pointer(&handle->return_focus, root != NULL ? gtk_root_get_focus(root) : NULL);
  GtkWidget *content = gtk_overlay_get_child(GTK_OVERLAY(self));
  if (content != NULL) {
    gtk_widget_set_can_focus(content, FALSE);
    gtk_widget_set_can_target(content, FALSE);
  }
  gtk_overlay_add_overlay(GTK_OVERLAY(self), scrim);
  gtk_overlay_add_overlay(GTK_OVERLAY(self), card);
  if (question) {
    gtk_widget_add_css_class(scrim, "Suno-sheet-dim");
    Suno_sheet_frame_watch_overlay(GTK_OVERLAY(self));
    handle->frame = Suno_sheet_frame_new(GTK_OVERLAY(self), card, card, scrim, FALSE);
    Suno_sheet_frame_set_posture(handle->frame, Suno_sheet_posture(GTK_WIDGET(self)));
    Suno_sheet_frame_enter(handle->frame);
  }

  if (root != NULL) {
    GtkEventController *keys = gtk_event_controller_key_new();
    gtk_event_controller_set_propagation_phase(keys, GTK_PHASE_CAPTURE);
    g_signal_connect(keys, "key-pressed", G_CALLBACK(modal_key), handle);
    gtk_widget_add_controller(GTK_WIDGET(root), keys);
    handle->keys = keys;
    g_set_weak_pointer(&handle->keys_root, GTK_WIDGET(root));
  }

  Shown *shown = g_new0(Shown, 1);
  shown->handle = g_object_ref(handle);
  shown->initial_focus = initial_focus != NULL ? g_object_ref(initial_focus) : NULL;
  Suno_ui_on_next_frame(card, modal_shown, shown);
  return handle;
}

typedef struct {
  SunoLayerHost *host; /* weak */
  GtkWidget *card;
  GtkWidget *scrim;
  SunoSheetFrame *frame;
} Removal;

static gboolean modal_remove(gpointer user_data) {
  Removal *removal = user_data;
  g_clear_pointer(&removal->frame, Suno_sheet_frame_free);
  GtkWidget *widgets[] = {removal->card, removal->scrim};
  for (guint i = 0; i < G_N_ELEMENTS(widgets); i++) {
    if (widgets[i] != NULL && removal->host != NULL &&
        gtk_widget_get_parent(widgets[i]) == GTK_WIDGET(removal->host))
      gtk_overlay_remove_overlay(GTK_OVERLAY(removal->host), widgets[i]);
    g_clear_object(&widgets[i]);
  }
  g_clear_weak_pointer(&removal->host);
  g_free(removal);
  return G_SOURCE_REMOVE;
}

typedef struct {
  SunoLayerHost *host; /* weak */
  GtkWidget *target;   /* weak */
} ReturnFocus;

static gboolean return_focus_idle(gpointer user_data) {
  ReturnFocus *back = user_data;
  if (back->host != NULL && back->target != NULL) {
    GtkRoot *root = gtk_widget_get_root(GTK_WIDGET(back->host));
    if (root != NULL && gtk_widget_get_root(back->target) == root && gtk_widget_get_mapped(back->target) &&
        PRIV(back->host)->modal == NULL)
      gtk_widget_grab_focus(back->target);
  }
  g_clear_weak_pointer(&back->host);
  g_clear_weak_pointer(&back->target);
  g_free(back);
  return G_SOURCE_REMOVE;
}

static void Suno_layer_host_modal_closed(SunoLayerHost *self, SunoModalHandle *handle, gboolean quiet) {
  SunoLayerHostPrivate *priv = PRIV(self);
  g_object_ref(handle);
  if (priv->modal == handle)
    g_clear_object(&priv->modal);
  if (handle->keys != NULL && handle->keys_root != NULL)
    gtk_widget_remove_controller(handle->keys_root, handle->keys);
  handle->keys = NULL;
  GtkWidget *content = gtk_overlay_get_child(GTK_OVERLAY(self));
  if (content != NULL && priv->modal == NULL) {
    gtk_widget_set_can_focus(content, TRUE);
    gtk_widget_set_can_target(content, TRUE);
  }
  if (handle->scrim != NULL)
    gtk_widget_remove_css_class(handle->scrim, "shown");
  if (handle->card != NULL) {
    gtk_widget_remove_css_class(handle->card, "shown");
    gtk_widget_set_can_target(handle->card, FALSE);
  }
  Removal *removal = g_new0(Removal, 1);
  g_set_weak_pointer(&removal->host, self);
  removal->card = handle->card != NULL ? g_object_ref(handle->card) : NULL;
  removal->scrim = handle->scrim != NULL ? g_object_ref(handle->scrim) : NULL;
  guint delay = quiet ? 0 : Suno_ui_duration(SUNO_UI_MOTION_DIALOG_FADE_MS, FALSE);
  /* A question leaves the way it came; it is taken off the layer once it is off screen. */
  if (handle->frame != NULL) {
    removal->frame = g_steal_pointer(&handle->frame);
    delay = quiet ? 0 : Suno_sheet_frame_leave(removal->frame, NULL, NULL);
  }
  if (delay > 0)
    g_timeout_add(delay, modal_remove, removal);
  else
    modal_remove(removal);
  /* Focus goes back on an idle, through a weak pointer: an app that re-renders on the answer destroys
   * the widget it came from, and focusing a doomed widget left GTK's focus-change refs on its page
   * (Settings, 28 Sep: its view root leaked a ref per confirm). */
  if (!quiet && handle->return_focus != NULL) {
    ReturnFocus *back = g_new0(ReturnFocus, 1);
    g_set_weak_pointer(&back->host, self);
    g_set_weak_pointer(&back->target, handle->return_focus);
    g_idle_add(return_focus_idle, back);
  }
  g_object_unref(handle);
}
