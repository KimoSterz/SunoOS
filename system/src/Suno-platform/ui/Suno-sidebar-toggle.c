/* SPDX-License-Identifier: Apache-2.0 */
/* SunoSidebarToggle: the twin of structure_sidebar.SidebarToggle (Python). */
#include "Suno-sidebar-toggle.h"

#include <math.h>
#include "Suno-layer-host.h"
#include "Suno-ui-private.h"

#include <adwaita.h>

enum { PROP_0, PROP_SHOWN, N_PROPS };
static GParamSpec *props[N_PROPS];

struct _SunoSidebarToggle {
  GtkToggleButton parent_instance;
  GtkWidget *sidebar; /* strong: it moves between its home and the drawer */
  gboolean split;
  GtkWidget *revealer;
  SunoModalHandle *drawer;
  gboolean drawer_closed;
  gulong drawer_handler;
  GtkWidget *card; /* strong until the sidebar is home */
  GtkWidget *home_parent;   /* weak */
  GtkWidget *home_previous; /* weak */
  gboolean was_island;
  GPtrArray *row_handlers; /* RowHandler */
  SunoTitleIsland *island; /* weak: v71, the phone's ☰ is this title island's */
  gboolean last_shown;
  int drawer_below;
  gboolean phone_enabled;
  gboolean control_visible;
};

G_DEFINE_FINAL_TYPE(SunoSidebarToggle, Suno_sidebar_toggle, GTK_TYPE_TOGGLE_BUTTON)

typedef struct {
  GtkWidget *listbox;
  gulong handler;
} RowHandler;

static void toggled(GtkToggleButton *button, gpointer user_data);

static void row_handler_free(gpointer data) {
  RowHandler *row = data;
  g_clear_signal_handler(&row->handler, row->listbox);
  g_object_unref(row->listbox);
  g_free(row);
}

/* What to measure: the toggle in its title bar, or the sidebar before it is placed. */
static GtkWidget *where(SunoSidebarToggle *self) {
  return gtk_widget_get_root(GTK_WIDGET(self)) != NULL ? GTK_WIDGET(self) : self->sidebar;
}

static gboolean uses_drawer(SunoSidebarToggle *self) {
  int width = Suno_ui_window_width(where(self));
  return width > 0 && width < self->drawer_below;
}

static gboolean is_drawer(SunoSidebarToggle *self) { return self->drawer != NULL && !self->drawer_closed; }

static void sync_shown(SunoSidebarToggle *self) {
  gboolean shown = Suno_sidebar_toggle_get_shown(self);
  if (shown != self->last_shown) {
    self->last_shown = shown;
    g_object_notify_by_pspec(G_OBJECT(self), props[PROP_SHOWN]);
  }
}

static void update_label(SunoSidebarToggle *self) {
  const char *text = Suno_sidebar_toggle_get_shown(self) ? "Hide sidebar" : "Show sidebar";
  g_autofree char *tip = g_strdup_printf("%s (F9)", text);
  gtk_widget_set_tooltip_text(GTK_WIDGET(self), tip);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), text);
  sync_shown(self);
}

static void sync_revealer_visibility(GObject *object G_GNUC_UNUSED, GParamSpec *pspec G_GNUC_UNUSED, gpointer data) {
  SunoSidebarToggle *self = data;
  if (self->revealer != NULL)
    gtk_widget_set_visible(self->revealer,
      gtk_revealer_get_child(GTK_REVEALER(self->revealer)) == self->sidebar &&
      gtk_widget_get_visible(self->sidebar) &&
      (gtk_revealer_get_reveal_child(GTK_REVEALER(self->revealer)) ||
       gtk_revealer_get_child_revealed(GTK_REVEALER(self->revealer))));
}

/* Computer */

static void apply_desktop(SunoSidebarToggle *self, gboolean shown, gboolean animate) {
  if (self->split)
    adw_overlay_split_view_set_show_sidebar(ADW_OVERLAY_SPLIT_VIEW(self->sidebar), shown);
  else if (self->revealer != NULL) {
    gtk_revealer_set_transition_duration(GTK_REVEALER(self->revealer),
                                         animate ? Suno_ui_duration(SUNO_UI_MOTION_MORPH_MS, FALSE) : 0);
    gtk_revealer_set_reveal_child(GTK_REVEALER(self->revealer), shown);
  }
}

/* Phone */

static void restore_home(SunoSidebarToggle *self) {
  g_autoptr(GtkWidget) card = g_steal_pointer(&self->card);
  if (card == NULL || gtk_widget_get_parent(self->sidebar) != card)
    return;
  gtk_box_remove(GTK_BOX(card), self->sidebar);
  if (self->was_island)
    gtk_widget_add_css_class(self->sidebar, "Suno-island");
  GtkWidget *parent = self->home_parent;
  if (parent == NULL)
    return;
  if (GTK_IS_REVEALER(parent))
    gtk_revealer_set_child(GTK_REVEALER(parent), self->sidebar);
  else if (GTK_IS_BOX(parent))
    gtk_box_insert_child_after(GTK_BOX(parent), self->sidebar, self->home_previous);
}

static gboolean restore_later(gpointer user_data) {
  restore_home(user_data);
  return G_SOURCE_REMOVE;
}

static void drawer_closed(SunoSidebarToggle *self, gboolean now) {
  if (self->row_handlers != NULL)
    g_ptr_array_set_size(self->row_handlers, 0);
  if (now)
    restore_home(self);
  else
    g_timeout_add_full(G_PRIORITY_DEFAULT, MAX(1u, Suno_ui_duration(SUNO_UI_MOTION_DIALOG_FADE_MS, FALSE)) + 20,
                       restore_later, g_object_ref(self), g_object_unref);
  if (self->drawer != NULL) {
    g_clear_signal_handler(&self->drawer_handler, self->drawer);
    g_clear_object(&self->drawer);
  }
  self->drawer_closed = TRUE;
  update_label(self);
}

static void drawer_cancelled(SunoModalHandle *handle G_GNUC_UNUSED, gpointer user_data) {
  SunoSidebarToggle *self = user_data;
  self->drawer_closed = TRUE;
  drawer_closed(self, FALSE);
}

static void row_activated(GtkListBox *listbox G_GNUC_UNUSED, GtkListBoxRow *row G_GNUC_UNUSED, gpointer user_data) {
  SunoSidebarToggle *self = user_data;
  if (is_drawer(self))
    Suno_modal_handle_cancel(self->drawer);
}

static void watch_rows(SunoSidebarToggle *self, GtkWidget *widget) {
  for (GtkWidget *child = gtk_widget_get_first_child(widget); child != NULL;
       child = gtk_widget_get_next_sibling(child)) {
    if (GTK_IS_LIST_BOX(child)) {
      RowHandler *row = g_new0(RowHandler, 1);
      row->listbox = g_object_ref(child);
      row->handler = g_signal_connect(child, "row-activated", G_CALLBACK(row_activated), self);
      g_ptr_array_add(self->row_handlers, row);
    }
    watch_rows(self, child);
  }
}


/* v71's phone drawer (Python _phone_drawer, 5806-5813): out of the bottom-left corner, starting level with
 * the page title (64 from the window's top), min(328, w − 52) wide, square to the left and bottom edges
 * with one rounded corner at top right (Suno-appkit-base.css "Phone drawer"), over a .4 dim. */
static void phone_drawer(GtkWidget *card, GtkWidget *host) {
  gtk_widget_add_css_class(card, "phone-drawer");
  GtkWidget *scrim = gtk_widget_get_prev_sibling(card);
  if (scrim != NULL && gtk_widget_has_css_class(scrim, "SunoUI-scrim"))
    gtk_widget_add_css_class(scrim, "phone-drawer");
  /* Not the bar's frame (that is the bottom drawers'): the left and bottom edges. */
  gtk_widget_set_margin_start(card, 0);
  gtk_widget_set_margin_end(card, 0);
  gtk_widget_set_margin_bottom(card, 0);
  int width = gtk_widget_get_width(host);
  if (width > 0)
    gtk_widget_set_size_request(card, MIN(SUNO_UI_PHONE_DRAWER_MAX_WIDTH, width - SUNO_UI_PHONE_DRAWER_SIDE_ROOM), -1);
  /* 64 from the window's top; a host under a title row starts that much lower already. */
  int above = 0;
  GtkRoot *root = gtk_widget_get_root(host);
  graphene_point_t point;
  if (root != NULL && GTK_WIDGET(root) != host &&
      gtk_widget_compute_point(host, GTK_WIDGET(root), &GRAPHENE_POINT_INIT(0, 0), &point))
    above = (int)round(point.y);
  gtk_widget_set_margin_top(card, MAX(0, SUNO_UI_PHONE_DRAWER_TOP - above));
}

static void open_drawer(SunoSidebarToggle *self, GtkWidget *initial_focus) {
  if (is_drawer(self))
    return;
  GtkWidget *parent = gtk_widget_get_parent(self->sidebar);
  if (parent == NULL)
    return;
  if (!GTK_IS_REVEALER(parent) && !GTK_IS_BOX(parent)) {
    g_critical("SunoSidebarToggle moves a sidebar that lives in a GtkBox or a GtkRevealer");
    return;
  }
  SunoLayerHost *host = Suno_layer_host_window_host(where(self));
  if (host == NULL)
    return;
  g_set_weak_pointer(&self->home_parent, parent);
  g_set_weak_pointer(&self->home_previous, gtk_widget_get_prev_sibling(self->sidebar));
  if (GTK_IS_REVEALER(parent))
    gtk_revealer_set_child(GTK_REVEALER(parent), NULL);
  else
    gtk_box_remove(GTK_BOX(parent), self->sidebar);
  GtkWidget *card = g_object_new(GTK_TYPE_BOX, "orientation", GTK_ORIENTATION_VERTICAL, "accessible-role",
                                 GTK_ACCESSIBLE_ROLE_DIALOG, NULL);
  gtk_widget_add_css_class(card, "SunoUI-sidebar-drawer");
  Suno_ui_set_accessible_label(card, "Sidebar");
  gtk_widget_set_visible(self->sidebar, TRUE);
  /* The drawer is the floating surface; the sidebar inside it is not a second island. */
  self->was_island = gtk_widget_has_css_class(self->sidebar, "Suno-island");
  gtk_widget_remove_css_class(self->sidebar, "Suno-island");
  gtk_box_append(GTK_BOX(card), self->sidebar);
  SunoModalHandle *handle = Suno_layer_host_present_modal(host, card, initial_focus, SUNO_DRAWER_MODE_ALWAYS);
  if (handle == NULL)
    return;
  /* A side drawer: the left edge, the full height, and a tap beside it closes it. */
  gtk_widget_remove_css_class(card, "drawer");
  gtk_widget_add_css_class(card, "side-drawer");
  gtk_widget_set_halign(card, GTK_ALIGN_START);
  gtk_widget_set_valign(card, GTK_ALIGN_FILL);
  phone_drawer(card, GTK_WIDGET(host));
  self->drawer = g_object_ref(handle);
  self->drawer_closed = FALSE;
  self->drawer_handler = g_signal_connect(handle, "cancelled", G_CALLBACK(drawer_cancelled), self);
  g_set_object(&self->card, card);
  watch_rows(self, self->sidebar);
  update_label(self);
}

static void reflow(GtkWidget *widget, int width G_GNUC_UNUSED, gpointer data G_GNUC_UNUSED) {
  SunoSidebarToggle *self = SUNO_SIDEBAR_TOGGLE(widget);
  gboolean phone = Suno_ui_is_phone(where(self));
  gboolean drawer = uses_drawer(self);
  if (phone && !self->phone_enabled) {
    if (self->drawer != NULL) {
      if (is_drawer(self)) {
        self->drawer_closed = TRUE;
        Suno_modal_handle_close(self->drawer);
      }
      drawer_closed(self, TRUE);
    }
    if (self->island != NULL && Suno_title_island_get_grown(self->island))
      Suno_title_island_fold(self->island);
    apply_desktop(self, FALSE, FALSE);
    update_label(self);
    return;
  }
  if (gtk_widget_has_css_class(widget, "phone") != phone ||
      gtk_widget_has_css_class(widget, "drawer-mode") != drawer) {
    Suno_ui_set_css_class(widget, "phone", phone);
    Suno_ui_set_css_class(widget, "drawer-mode", drawer);
    gtk_button_set_child(GTK_BUTTON(self), Suno_ui_icon_image(drawer ? "menu" : "panel-left", 0));
    gtk_widget_remove_css_class(widget, "image-button");
  }
  if (self->island != NULL) {
    /* v71: a phone's ☰ is the title island's; the title bar's own toggle steps aside. */
    gtk_widget_set_visible(widget, self->control_visible && !phone);
    if (!phone && Suno_title_island_get_grown(self->island))
      Suno_title_island_fold(self->island);
  }
  if (self->split)
    return;
  if (drawer) {
    /* The column gives the content the room; the drawer shows on demand. */
    if (self->revealer != NULL) {
      gtk_revealer_set_transition_duration(GTK_REVEALER(self->revealer), 0);
      gtk_revealer_set_reveal_child(GTK_REVEALER(self->revealer), FALSE);
    }
  } else {
    if (self->drawer != NULL) {
      if (is_drawer(self)) {
        self->drawer_closed = TRUE;
        Suno_modal_handle_close(self->drawer);
      }
      drawer_closed(self, TRUE);
    }
    apply_desktop(self, gtk_toggle_button_get_active(GTK_TOGGLE_BUTTON(self)), FALSE);
  }
  update_label(self);
}

static void toggled(GtkToggleButton *button, gpointer user_data G_GNUC_UNUSED) {
  SunoSidebarToggle *self = SUNO_SIDEBAR_TOGGLE(button);
  if (!self->phone_enabled && Suno_ui_is_phone(where(self))) {
    apply_desktop(self, FALSE, FALSE);
    return;
  }
  if (uses_drawer(self) && !self->split) {
    /* A click on the button at phone width: the drawer, not the column. */
    gboolean want = gtk_toggle_button_get_active(button);
    g_signal_handlers_block_by_func(button, toggled, NULL);
    gtk_toggle_button_set_active(button, !want);
    g_signal_handlers_unblock_by_func(button, toggled, NULL);
    Suno_sidebar_toggle_toggle(self);
    return;
  }
  apply_desktop(self, gtk_toggle_button_get_active(button), TRUE);
  update_label(self);
}

static gboolean f9_pressed(GtkWidget *widget, GVariant *args G_GNUC_UNUSED, gpointer data G_GNUC_UNUSED) {
  Suno_sidebar_toggle_toggle(SUNO_SIDEBAR_TOGGLE(widget));
  return TRUE;
}

/* Put a Box-held sidebar in a revealer in place, so closing slides with the window's ease. */
static GtkWidget *wrap_in_revealer(GtkWidget *sidebar) {
  GtkWidget *parent = gtk_widget_get_parent(sidebar);
  if (parent != NULL && GTK_IS_REVEALER(parent)) {
    gtk_widget_add_css_class(parent, "SunoUI-sidebar-revealer");
    return parent;
  }
  if (parent != NULL && !GTK_IS_BOX(parent)) {
    g_critical("SunoSidebarToggle needs the sidebar in a GtkBox (or not yet placed)");
    return NULL;
  }
  GtkWidget *revealer = g_object_new(GTK_TYPE_REVEALER, "transition-type", GTK_REVEALER_TRANSITION_TYPE_SLIDE_RIGHT,
                                     "reveal-child", TRUE, "transition-duration",
                                     Suno_ui_duration(SUNO_UI_MOTION_MORPH_MS, FALSE), NULL);
  gtk_widget_add_css_class(revealer, "SunoUI-sidebar-revealer");
  if (parent != NULL) {
    GtkWidget *previous = gtk_widget_get_prev_sibling(sidebar);
    g_object_ref(sidebar);
    gtk_box_remove(GTK_BOX(parent), sidebar);
    gtk_revealer_set_child(GTK_REVEALER(revealer), sidebar);
    g_object_unref(sidebar);
    gtk_box_insert_child_after(GTK_BOX(parent), revealer, previous);
  } else {
    gtk_revealer_set_child(GTK_REVEALER(revealer), sidebar); /* the app places the sidebar's new parent */
  }
  return revealer;
}

static void Suno_sidebar_toggle_get_property(GObject *object, guint prop_id, GValue *value, GParamSpec *pspec) {
  switch (prop_id) {
  case PROP_SHOWN:
    g_value_set_boolean(value, Suno_sidebar_toggle_get_shown(SUNO_SIDEBAR_TOGGLE(object)));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, prop_id, pspec);
  }
}

static void Suno_sidebar_toggle_set_property(GObject *object, guint prop_id, const GValue *value,
                                             GParamSpec *pspec) {
  switch (prop_id) {
  case PROP_SHOWN:
    Suno_sidebar_toggle_set_shown(SUNO_SIDEBAR_TOGGLE(object), g_value_get_boolean(value));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, prop_id, pspec);
  }
}

static void Suno_sidebar_toggle_dispose(GObject *object) {
  SunoSidebarToggle *self = SUNO_SIDEBAR_TOGGLE(object);
  if (self->drawer != NULL) {
    if (is_drawer(self))
      Suno_modal_handle_close(self->drawer);
    g_clear_signal_handler(&self->drawer_handler, self->drawer);
    g_clear_object(&self->drawer);
  }
  if (self->row_handlers != NULL)
    g_ptr_array_set_size(self->row_handlers, 0);
  g_clear_object(&self->card);
  g_clear_weak_pointer(&self->home_parent);
  g_clear_weak_pointer(&self->home_previous);
  g_clear_weak_pointer(&self->island);
  g_clear_object(&self->sidebar);
  G_OBJECT_CLASS(Suno_sidebar_toggle_parent_class)->dispose(object);
}

static void Suno_sidebar_toggle_finalize(GObject *object) {
  g_clear_pointer(&SUNO_SIDEBAR_TOGGLE(object)->row_handlers, g_ptr_array_unref);
  G_OBJECT_CLASS(Suno_sidebar_toggle_parent_class)->finalize(object);
}

static void Suno_sidebar_toggle_class_init(SunoSidebarToggleClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  object_class->get_property = Suno_sidebar_toggle_get_property;
  object_class->set_property = Suno_sidebar_toggle_set_property;
  object_class->dispose = Suno_sidebar_toggle_dispose;
  object_class->finalize = Suno_sidebar_toggle_finalize;
  /**
   * SunoSidebarToggle:shown:
   *
   * Whether the sidebar shows (beside the content, or as the phone drawer).
   */
  props[PROP_SHOWN] = g_param_spec_boolean("shown", NULL, NULL, TRUE,
                                           G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);
  g_object_class_install_properties(object_class, N_PROPS, props);
}

static void Suno_sidebar_toggle_init(SunoSidebarToggle *self) {
  self->drawer_below = SUNO_TIER_PHONE_BELOW;
  self->phone_enabled = TRUE;
  self->control_visible = TRUE;
  Suno_ui_install();
  GtkWidget *widget = GTK_WIDGET(self);
  self->row_handlers = g_ptr_array_new_with_free_func(row_handler_free);
  gtk_widget_add_css_class(widget, "SunoUI-sidebar-toggle");
  gtk_button_set_child(GTK_BUTTON(self), Suno_ui_icon_image("panel-left", 0));
  gtk_widget_remove_css_class(widget, "image-button"); /* a SunoUI part, not the legacy icon-button look */
  gtk_widget_set_valign(widget, GTK_ALIGN_CENTER);
  gtk_accessible_update_property(GTK_ACCESSIBLE(self), GTK_ACCESSIBLE_PROPERTY_KEY_SHORTCUTS, "F9", -1);
}

GtkWidget *Suno_sidebar_toggle_new(GtkWidget *sidebar, gboolean shown) {
  g_return_val_if_fail(GTK_IS_WIDGET(sidebar), NULL);
  SunoSidebarToggle *self = g_object_new(SUNO_TYPE_SIDEBAR_TOGGLE, NULL);
  self->sidebar = g_object_ref(sidebar);
  self->split = ADW_IS_OVERLAY_SPLIT_VIEW(sidebar);
  if (!self->split) {
    self->revealer = wrap_in_revealer(sidebar);
    if (self->revealer != NULL) {
      g_signal_connect_object(sidebar, "notify::visible", G_CALLBACK(sync_revealer_visibility), self, 0);
      g_signal_connect_object(self->revealer, "notify::child", G_CALLBACK(sync_revealer_visibility), self, 0);
      g_signal_connect_object(self->revealer, "notify::reveal-child", G_CALLBACK(sync_revealer_visibility), self, 0);
      g_signal_connect_object(self->revealer, "notify::child-revealed", G_CALLBACK(sync_revealer_visibility), self, 0);
      sync_revealer_visibility(NULL, NULL, self);
    }
  }
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(self), shown);
  apply_desktop(self, shown, FALSE);
  self->last_shown = !!shown;
  update_label(self);
  g_signal_connect(self, "toggled", G_CALLBACK(toggled), NULL);
  /* F9 anywhere in the window, as GNOME Files. */
  GtkEventController *shortcuts = gtk_shortcut_controller_new();
  gtk_shortcut_controller_set_scope(GTK_SHORTCUT_CONTROLLER(shortcuts), GTK_SHORTCUT_SCOPE_GLOBAL);
  gtk_shortcut_controller_add_shortcut(GTK_SHORTCUT_CONTROLLER(shortcuts),
                                       gtk_shortcut_new(gtk_shortcut_trigger_parse_string("F9"),
                                                        gtk_callback_action_new(f9_pressed, NULL, NULL)));
  gtk_widget_add_controller(GTK_WIDGET(self), shortcuts);
  Suno_ui_width_watch(GTK_WIDGET(self), reflow, NULL, 0);
  return GTK_WIDGET(self);
}

gboolean Suno_sidebar_toggle_get_shown(SunoSidebarToggle *self) {
  g_return_val_if_fail(SUNO_IS_SIDEBAR_TOGGLE(self), FALSE);
  if (self->drawer != NULL)
    return is_drawer(self);
  return uses_drawer(self) && !self->split ? FALSE : gtk_toggle_button_get_active(GTK_TOGGLE_BUTTON(self));
}

void Suno_sidebar_toggle_set_shown(SunoSidebarToggle *self, gboolean shown) {
  g_return_if_fail(SUNO_IS_SIDEBAR_TOGGLE(self));
  if (Suno_sidebar_toggle_get_shown(self) != !!shown)
    Suno_sidebar_toggle_toggle(self);
}

void Suno_sidebar_toggle_toggle(SunoSidebarToggle *self) {
  Suno_sidebar_toggle_toggle_with_focus(self, NULL);
}

void Suno_sidebar_toggle_toggle_with_focus(SunoSidebarToggle *self, GtkWidget *initial_focus) {
  g_return_if_fail(SUNO_IS_SIDEBAR_TOGGLE(self));
  if (self->sidebar == NULL || (!self->phone_enabled && Suno_ui_is_phone(where(self))))
    return;
  if (self->island != NULL && Suno_ui_is_phone(where(self))) {
    Suno_title_island_toggle(self->island);
    return;
  }
  if (uses_drawer(self) && !self->split) {
    if (Suno_sidebar_toggle_get_shown(self) && is_drawer(self))
      Suno_modal_handle_cancel(self->drawer);
    else
      open_drawer(self, initial_focus);
    return;
  }
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(self), !gtk_toggle_button_get_active(GTK_TOGGLE_BUTTON(self)));
  if (initial_focus != NULL && gtk_toggle_button_get_active(GTK_TOGGLE_BUTTON(self)))
    gtk_widget_grab_focus(initial_focus);
}

void Suno_sidebar_toggle_set_island(SunoSidebarToggle *self, SunoTitleIsland *island) {
  g_return_if_fail(SUNO_IS_SIDEBAR_TOGGLE(self));
  g_return_if_fail(island == NULL || SUNO_IS_TITLE_ISLAND(island));
  if (self->island != NULL)
    Suno_title_island_set_grow_widget(self->island, NULL, SUNO_TITLE_ISLAND_GROWS_AUTO);
  g_set_weak_pointer(&self->island, island);
  if (island != NULL && self->sidebar != NULL)
    Suno_title_island_set_grow_widget(island, self->split
        ? adw_overlay_split_view_get_sidebar(ADW_OVERLAY_SPLIT_VIEW(self->sidebar))
        : self->sidebar, SUNO_TITLE_ISLAND_GROWS_MENU);
  gtk_widget_set_visible(GTK_WIDGET(self), self->control_visible &&
                         (island == NULL || !Suno_ui_is_phone(where(self))));
}

void Suno_sidebar_toggle_set_drawer_below(SunoSidebarToggle *self, int width) {
  g_return_if_fail(SUNO_IS_SIDEBAR_TOGGLE(self));
  g_return_if_fail(width > 0);
  self->drawer_below = width;
  reflow(GTK_WIDGET(self), 0, NULL);
}

int Suno_sidebar_toggle_get_drawer_below(SunoSidebarToggle *self) {
  g_return_val_if_fail(SUNO_IS_SIDEBAR_TOGGLE(self), SUNO_TIER_PHONE_BELOW);
  return self->drawer_below;
}

void Suno_sidebar_toggle_set_phone_enabled(SunoSidebarToggle *self, gboolean enabled) {
  g_return_if_fail(SUNO_IS_SIDEBAR_TOGGLE(self));
  self->phone_enabled = !!enabled;
  reflow(GTK_WIDGET(self), 0, NULL);
}

void Suno_sidebar_toggle_set_control_visible(SunoSidebarToggle *self, gboolean visible) {
  g_return_if_fail(SUNO_IS_SIDEBAR_TOGGLE(self));
  self->control_visible = !!visible;
  gtk_widget_set_visible(GTK_WIDGET(self), self->control_visible &&
    (self->island == NULL || !Suno_ui_is_phone(where(self))));
}
