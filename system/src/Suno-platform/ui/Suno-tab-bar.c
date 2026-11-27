/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_tabs.TabBar (Python, K-NAV): the same tree and classes, styled by the shared sheet. */
#include "Suno-tab-bar.h"
#include "Suno-badges.h"
#include "Suno-layer-host.h"
#include "Suno-ui-private.h"

enum { SIG_CHANGED, N_SIGNALS };
static guint signals[N_SIGNALS];

typedef struct {
  char *key;
  GtkWidget *tab, *overlay, *dot, *count;
} Tab;

struct _SunoTabBar {
  GtkBox parent_instance;
  gboolean compact;
  GPtrArray *tabs; /* Tab */
  char *current;
  gboolean quiet;
};

G_DEFINE_FINAL_TYPE(SunoTabBar, Suno_tab_bar, GTK_TYPE_BOX)

static void tab_free(gpointer data) {
  Tab *tab = data;
  g_free(tab->key);
  g_free(tab);
}

static Tab *find_tab(SunoTabBar *self, const char *key) {
  for (guint i = 0; i < self->tabs->len; i++) {
    Tab *tab = g_ptr_array_index(self->tabs, i);
    if (g_strcmp0(tab->key, key) == 0)
      return tab;
  }
  return NULL;
}

static void tab_bar_finalize(GObject *object) {
  SunoTabBar *self = SUNO_TAB_BAR(object);
  g_ptr_array_unref(self->tabs);
  g_free(self->current);
  G_OBJECT_CLASS(Suno_tab_bar_parent_class)->finalize(object);
}

static void Suno_tab_bar_class_init(SunoTabBarClass *klass) {
  G_OBJECT_CLASS(klass)->finalize = tab_bar_finalize;
  /**
   * SunoTabBar::changed:
   * @self: the tab bar
   * @key: the place now current
   */
  signals[SIG_CHANGED] = g_signal_new("changed", G_TYPE_FROM_CLASS(klass), G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                      G_TYPE_NONE, 1, G_TYPE_STRING);
}

static void Suno_tab_bar_init(SunoTabBar *self) {
  Suno_ui_install();
  self->tabs = g_ptr_array_new_with_free_func(tab_free);
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-tab-bar");
  Suno_ui_set_accessible_label(GTK_WIDGET(self), "Places");
}

GtkWidget *Suno_tab_bar_new(gboolean compact) {
  SunoTabBar *self = g_object_new(SUNO_TYPE_TAB_BAR, "orientation", GTK_ORIENTATION_HORIZONTAL, "homogeneous",
                                  !compact, "accessible-role", GTK_ACCESSIBLE_ROLE_TAB_LIST, NULL);
  self->compact = compact;
  Suno_ui_set_css_class(GTK_WIDGET(self), "compact", compact);
  return GTK_WIDGET(self);
}

static void tab_toggled(GtkToggleButton *button, gpointer data) {
  SunoTabBar *self = SUNO_TAB_BAR(data);
  if (!gtk_toggle_button_get_active(button) || self->quiet)
    return;
  const char *key = g_object_get_data(G_OBJECT(button), "SunoUI-tab-key");
  if (g_strcmp0(key, self->current) == 0)
    return;
  g_free(self->current);
  self->current = g_strdup(key);
  g_signal_emit(self, signals[SIG_CHANGED], 0, self->current);
}

void Suno_tab_bar_add(SunoTabBar *self, const char *key, const char *label, const char *icon) {
  g_return_if_fail(SUNO_IS_TAB_BAR(self));
  g_return_if_fail(key != NULL && label != NULL && icon != NULL);
  if (find_tab(self, key) != NULL) {
    g_critical("tab keys are unique: '%s' is already a place", key);
    return;
  }
  Tab *tab = g_new0(Tab, 1);
  tab->key = g_strdup(key);
  tab->tab = g_object_new(GTK_TYPE_TOGGLE_BUTTON, "hexpand", !self->compact, "accessible-role",
                          GTK_ACCESSIBLE_ROLE_TAB, NULL);
  if (self->compact)
    gtk_widget_set_tooltip_text(tab->tab, label);
  gtk_widget_add_css_class(tab->tab, "SunoUI-tab");
  gtk_widget_remove_css_class(tab->tab, "image-button");
  Suno_ui_set_accessible_label(tab->tab, label);
  if (self->tabs->len > 0)
    gtk_toggle_button_set_group(GTK_TOGGLE_BUTTON(tab->tab),
                                GTK_TOGGLE_BUTTON(((Tab *)g_ptr_array_index(self->tabs, 0))->tab));
  tab->overlay = gtk_overlay_new();
  GtkWidget *face = g_object_new(GTK_TYPE_BOX, "orientation", GTK_ORIENTATION_VERTICAL, "halign", GTK_ALIGN_CENTER,
                                 "valign", GTK_ALIGN_CENTER, NULL);
  gtk_widget_add_css_class(face, "SunoUI-tab-face");
  gtk_box_append(GTK_BOX(face), Suno_ui_icon_image(icon, 0));
  if (!self->compact) {
    GtkWidget *name = g_object_new(GTK_TYPE_LABEL, "label", label, "ellipsize", PANGO_ELLIPSIZE_END,
                                   "single-line-mode", TRUE, NULL);
    gtk_widget_add_css_class(name, "SunoUI-tab-label");
    gtk_box_append(GTK_BOX(face), name);
  }
  gtk_overlay_set_child(GTK_OVERLAY(tab->overlay), face);
  tab->dot = g_object_new(GTK_TYPE_BOX, "halign", GTK_ALIGN_END, "valign", GTK_ALIGN_START, "visible", FALSE,
                          "can-target", FALSE, NULL);
  gtk_widget_add_css_class(tab->dot, "SunoUI-tab-dot");
  gtk_overlay_add_overlay(GTK_OVERLAY(tab->overlay), tab->dot);
  gtk_button_set_child(GTK_BUTTON(tab->tab), tab->overlay);
  g_object_set_data_full(G_OBJECT(tab->tab), "SunoUI-tab-key", g_strdup(key), g_free);
  if (self->current == NULL)
    self->current = g_strdup(key);
  self->quiet = TRUE;
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(tab->tab), g_str_equal(key, self->current));
  self->quiet = FALSE;
  g_signal_connect(tab->tab, "toggled", G_CALLBACK(tab_toggled), self);
  g_ptr_array_add(self->tabs, tab);
  gtk_box_append(GTK_BOX(self), tab->tab);
}

const char *Suno_tab_bar_get_current(SunoTabBar *self) {
  g_return_val_if_fail(SUNO_IS_TAB_BAR(self), NULL);
  return self->current;
}

void Suno_tab_bar_set_current(SunoTabBar *self, const char *key, gboolean notify) {
  g_return_if_fail(SUNO_IS_TAB_BAR(self));
  Tab *tab = find_tab(self, key);
  if (tab == NULL) {
    g_critical("unknown place '%s'", key);
    return;
  }
  gboolean changed = g_strcmp0(key, self->current) != 0;
  g_free(self->current);
  self->current = g_strdup(key);
  self->quiet = TRUE;
  gtk_toggle_button_set_active(GTK_TOGGLE_BUTTON(tab->tab), TRUE);
  self->quiet = FALSE;
  if (notify && changed)
    g_signal_emit(self, signals[SIG_CHANGED], 0, self->current);
}

void Suno_tab_bar_set_count(SunoTabBar *self, const char *key, int count, gboolean attention) {
  g_return_if_fail(SUNO_IS_TAB_BAR(self));
  Tab *tab = find_tab(self, key);
  g_return_if_fail(tab != NULL);
  if (tab->count != NULL) {
    gtk_overlay_remove_overlay(GTK_OVERLAY(tab->overlay), tab->count);
    tab->count = NULL;
  }
  if (count <= 0)
    return;
  tab->count = Suno_count_badge_new(count, attention);
  gtk_widget_add_css_class(tab->count, "SunoUI-tab-count");
  gtk_widget_set_halign(tab->count, self->compact ? GTK_ALIGN_END : GTK_ALIGN_CENTER);
  gtk_widget_set_valign(tab->count, GTK_ALIGN_START);
  gtk_widget_set_can_target(tab->count, FALSE);
  gtk_overlay_add_overlay(GTK_OVERLAY(tab->overlay), tab->count);
}

void Suno_tab_bar_set_running(SunoTabBar *self, const char *key, gboolean running) {
  g_return_if_fail(SUNO_IS_TAB_BAR(self));
  Tab *tab = find_tab(self, key);
  g_return_if_fail(tab != NULL);
  gtk_widget_set_visible(tab->dot, running);
}

void Suno_tab_bar_float_over(SunoTabBar *self, GtkWidget *where) {
  g_return_if_fail(SUNO_IS_TAB_BAR(self));
  g_return_if_fail(GTK_IS_WIDGET(where));
  GtkWidget *host = GTK_IS_OVERLAY(where) ? where : GTK_WIDGET(Suno_layer_host_window_host(where));
  if (host == NULL)
    return;
  gtk_widget_add_css_class(GTK_WIDGET(self), "floating");
  gtk_widget_set_halign(GTK_WIDGET(self), GTK_ALIGN_FILL);
  gtk_widget_set_valign(GTK_WIDGET(self), GTK_ALIGN_END);
  gtk_overlay_add_overlay(GTK_OVERLAY(host), GTK_WIDGET(self));
}

gboolean Suno_tab_bar_wants_tabs(guint n_places, gboolean all_have_icons) {
  return n_places >= SUNO_UI_TAB_BAR_MIN_PLACES && all_have_icons;
}
