/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-application-window.h"
#include "Suno-native-app-updates-private.h"
#include "Suno-surface-backdrop.h"
#include "Suno-layer-host.h"
#include "Suno-island.h"
#include "Suno-navigation-sidebar.h"
#include "Suno-ui-private.h"
#include "Suno-tv-frame-private.h"

#ifdef SUNO_HAVE_DESKTOP_APP_INFO
#include <gio/gdesktopappinfo.h>
#endif
#include <string.h>

/* A Suno window, drawn by SunoUI (ADR-052).
 *
 * The frame, the 42px title row, the identity pill in the top-left corner,
 * the connected window controls, the 9px gutter and the islands come from
 * SunoUI's own sheets (SunoUI-palette.css and SunoUI-toolkit.css, loaded by
 * Suno_init() above libadwaita) and from the identity this widget builds. It
 * does not depend on Suno's patched libadwaita: that library builds its own
 * identity only for a header bar that has none, so on a patched system
 * nothing is drawn twice, and a stock one draws the same window.
 *
 * The identity's name and icon come from the application's desktop entry,
 * so the corner never disagrees with the dock; its menu is the application
 * menu model (set_menu_model). The application-facing API is unchanged:
 * set_identity, set_menu_model, set_body. */

struct _SunoApplicationWindow {
  AdwApplicationWindow parent_instance;
  SunoContext *context;
  GtkWidget *toolbar_view;
  GtkWidget *titlebar;
  GtkWidget *body_bin;
  GtkWidget *body_pad; /* .Suno-window-body, inside the layer host */
  GtkWidget *layer_host;
  GtkWidget *body;
  GtkWidget *identity;
  GtkWidget *title_leading;
  GtkWidget *title_content;
  GtkWidget *title_trailing;
  gboolean title_centred;
  SunoSurfaceBackdrop *backdrop;
  GSimpleAction *status_ink;
};

G_DEFINE_FINAL_TYPE(SunoApplicationWindow, Suno_application_window,
                    ADW_TYPE_APPLICATION_WINDOW)

static void add_identity(SunoApplicationWindow *self);
static gboolean tv_back(GtkEventControllerKey *controller, guint key, guint code, GdkModifierType state,
                        SunoApplicationWindow *self);

enum { PROP_0, PROP_CONTEXT, N_PROPERTIES };
static GParamSpec *properties[N_PROPERTIES];

static void apply_window_context(GtkWindow *window, GtkWidget *titlebar,
                                 SunoContext *context) {
  if (context == NULL)
    return;
  /* Windowed keeps the frame. Handheld fullscreen has none to keep: the shell
   * owns that surface's chrome, and the title row would be a second one. In TV
   * posture the shell runs the window full screen and the TV bar's place
   * carries the app's name: no title row, no window controls. */
  const gboolean tv = Suno_context_get_tv(context);
  const gboolean decorated = Suno_context_get_decorated(context) && !tv;
  Suno_ui_set_css_class(GTK_WIDGET(window), "SunoUI-tv", tv);
  Suno_tv_frame_set_active(window, tv);
  Suno_ui_set_css_class(GTK_WIDGET(window), "SunoUI-tablet-mode",
      g_str_equal(Suno_context_get_experience(context), "tablet"));
  if (decorated)
    gtk_widget_remove_css_class(GTK_WIDGET(window), "SunoUI-phone-device");
  else
    gtk_widget_add_css_class(GTK_WIDGET(window), "SunoUI-phone-device");
  gtk_window_set_decorated(window, decorated);
  gtk_widget_set_visible(titlebar, decorated);
  gtk_widget_set_can_target(titlebar, decorated);
  if (Suno_context_get_touch_targets(context))
    gtk_widget_add_css_class(GTK_WIDGET(window), "Suno-touch");
  else
    gtk_widget_remove_css_class(GTK_WIDGET(window), "Suno-touch");
}

static void apply_context(SunoApplicationWindow *self) {
  apply_window_context(GTK_WINDOW(self), self->titlebar, self->context);
}

static void adopted_context_changed(SunoContext *context, GParamSpec *pspec,
                                    AdwApplicationWindow *window) {
  (void)pspec;
  GtkWidget *titlebar = g_object_get_data(G_OBJECT(window), "Suno-adopted-titlebar");
  if (titlebar != NULL)
    apply_window_context(GTK_WINDOW(window), titlebar, context);
}

static void context_changed(SunoContext *context, GParamSpec *pspec,
                             SunoApplicationWindow *self) {
  (void)context; (void)pspec;
  apply_context(self);
}

static void Suno_application_window_get_property(GObject *object, guint id,
                                                 GValue *value,
                                                 GParamSpec *pspec) {
  SunoApplicationWindow *self = SUNO_APPLICATION_WINDOW(object);
  switch (id) {
  case PROP_CONTEXT:
    g_value_set_object(value, self->context);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, id, pspec);
  }
}

static void Suno_application_window_set_property(GObject *object, guint id,
                                                 const GValue *value,
                                                 GParamSpec *pspec) {
  SunoApplicationWindow *self = SUNO_APPLICATION_WINDOW(object);
  switch (id) {
  case PROP_CONTEXT:
    g_set_object(&self->context, g_value_get_object(value));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(object, id, pspec);
  }
}

static void Suno_application_window_constructed(GObject *object) {
  SunoApplicationWindow *self = SUNO_APPLICATION_WINDOW(object);
  G_OBJECT_CLASS(Suno_application_window_parent_class)->constructed(object);
  if (self->context == NULL)
    self->context = Suno_context_new_from_environment();
  apply_context(self);
  if (self->context != NULL)
    g_signal_connect_object(self->context, "notify", G_CALLBACK(context_changed), self, 0);
  self->status_ink = g_simple_action_new_stateful("Suno-status-ink", NULL,
                                                g_variant_new_string("auto"));
  g_simple_action_set_enabled(self->status_ink, FALSE);
  g_action_map_add_action(G_ACTION_MAP(self), G_ACTION(self->status_ink));
  /* The application is set by now (it is a construct property). */
  add_identity(self);
}

static void Suno_application_window_dispose(GObject *object) {
  SunoApplicationWindow *self = SUNO_APPLICATION_WINDOW(object);
  g_clear_object(&self->context);
  g_clear_object(&self->backdrop);
  g_clear_object(&self->status_ink);
  self->toolbar_view = NULL;
  self->titlebar = NULL;
  self->body_bin = NULL;
  self->body_pad = NULL;
  self->body = NULL;
  self->identity = NULL;
  self->title_leading = NULL;
  self->title_content = NULL;
  self->title_trailing = NULL;
  G_OBJECT_CLASS(Suno_application_window_parent_class)->dispose(object);
}

static void Suno_application_window_class_init(
    SunoApplicationWindowClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  object_class->get_property = Suno_application_window_get_property;
  object_class->set_property = Suno_application_window_set_property;
  object_class->constructed = Suno_application_window_constructed;
  object_class->dispose = Suno_application_window_dispose;
  properties[PROP_CONTEXT] = g_param_spec_object(
      "context", NULL, NULL, SUNO_TYPE_CONTEXT,
      G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  g_object_class_install_properties(object_class, N_PROPERTIES, properties);
}

static void prepare_visible_dialog(SunoApplicationWindow *self) {
  AdwDialog *dialog = adw_application_window_get_visible_dialog(ADW_APPLICATION_WINDOW(self));
  if (ADW_IS_ALERT_DIALOG(dialog))
    gtk_widget_add_css_class(GTK_WIDGET(dialog), "Suno-controls-quiet");
}

/* The name the shell shows: the desktop entry's, then the process's. */
static char *identity_name(GtkApplication *application, GtkWindow *window) {
  const char *app_id = application != NULL ?
      g_application_get_application_id(G_APPLICATION(application)) : NULL;
#ifdef SUNO_HAVE_DESKTOP_APP_INFO
  if (app_id != NULL && *app_id != '\0') {
    g_autofree char *desktop_id = g_strconcat(app_id, ".desktop", NULL);
    g_autoptr(GDesktopAppInfo) info = g_desktop_app_info_new(desktop_id);
    const char *name = info != NULL ? g_app_info_get_display_name(G_APP_INFO(info)) : NULL;
    if (name != NULL && *name != '\0')
      return g_strdup(name);
  }
#endif
  /* GLib answers the program name when no name was set, which is never
   * what the corner should say while the window has a title. */
  const char *named = g_get_application_name();
  const char *candidates[] = {g_strcmp0(named, g_get_prgname()) != 0 ? named : NULL,
                              gtk_window_get_title(window), g_get_prgname()};
  for (guint i = 0; i < G_N_ELEMENTS(candidates); i++)
    if (candidates[i] != NULL && *candidates[i] != '\0')
      return g_strdup(candidates[i]);
  return g_strdup("Application");
}

static gboolean theme_has(GtkWindow *window, const char *name) {
  return name != NULL && *name != '\0' &&
         gtk_icon_theme_has_icon(gtk_icon_theme_get_for_display(
                                     gtk_widget_get_display(GTK_WIDGET(window))),
                                 name);
}

/* The registered icon, in the order the shell resolves it. */
static GtkWidget *identity_icon(GtkApplication *application, GtkWindow *window) {
  const char *app_id = application != NULL ?
      g_application_get_application_id(G_APPLICATION(application)) : NULL;
  GtkWidget *icon = NULL;
  if (theme_has(window, gtk_window_get_icon_name(window)))
    icon = gtk_image_new_from_icon_name(gtk_window_get_icon_name(window));
  if (icon == NULL && theme_has(window, gtk_window_get_default_icon_name()))
    icon = gtk_image_new_from_icon_name(gtk_window_get_default_icon_name());
#ifdef SUNO_HAVE_DESKTOP_APP_INFO
  if (icon == NULL && app_id != NULL && *app_id != '\0') {
    g_autofree char *desktop_id = g_strconcat(app_id, ".desktop", NULL);
    g_autoptr(GDesktopAppInfo) info = g_desktop_app_info_new(desktop_id);
    GIcon *gicon = info != NULL ? g_app_info_get_icon(G_APP_INFO(info)) : NULL;
    if (G_IS_THEMED_ICON(gicon)) {
      const char *const *names = g_themed_icon_get_names(G_THEMED_ICON(gicon));
      for (guint i = 0; names != NULL && names[i] != NULL && icon == NULL; i++)
        if (theme_has(window, names[i]))
          icon = gtk_image_new_from_icon_name(names[i]);
    } else if (gicon != NULL) {
      icon = gtk_image_new_from_gicon(gicon);
    }
  }
#endif
  if (icon == NULL && theme_has(window, app_id))
    icon = gtk_image_new_from_icon_name(app_id);
  if (icon == NULL)
    icon = gtk_image_new_from_icon_name("application-x-executable");
  gtk_image_set_pixel_size(GTK_IMAGE(icon), 22); /* SunoUI.window.identity_icon */
  return icon;
}

/* The identity pill, the same parts the Python kit's WindowIdentity has.
 * `Suno-identity-button` is the class the patched libadwaita looks for before
 * building one of its own. */
static GtkWidget *identity_new(GtkApplication *application, GtkWindow *window,
                               GMenuModel *menu) {
  g_autofree char *name = identity_name(application, window);
  /* v70 .tbar: icon 22, name, chevron 14, 9 apart (SunoUI.window tokens). */
  GtkWidget *content = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 9);
  gtk_widget_add_css_class(content, "Suno-identity-content");
  gtk_widget_set_valign(content, GTK_ALIGN_CENTER);
  GtkWidget *tile = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(tile, "Suno-identity-icon");
  gtk_widget_set_name(tile, "SunoUI-identity-icon");
  gtk_widget_set_overflow(tile, GTK_OVERFLOW_HIDDEN);
  gtk_widget_set_valign(tile, GTK_ALIGN_CENTER);
  gtk_widget_set_size_request(tile, 22, 22);
  gtk_box_append(GTK_BOX(tile), identity_icon(application, window));
  gtk_box_append(GTK_BOX(content), tile);
  GtkWidget *label = gtk_label_new(name);
  gtk_label_set_ellipsize(GTK_LABEL(label), PANGO_ELLIPSIZE_END);
  gtk_label_set_max_width_chars(GTK_LABEL(label), 24);
  gtk_widget_add_css_class(label, "Suno-identity-label");
  gtk_box_append(GTK_BOX(content), label);
  GtkWidget *chevron = gtk_image_new_from_icon_name("SunoUI-chevron-down-symbolic");
  gtk_image_set_pixel_size(GTK_IMAGE(chevron), 14);
  gtk_widget_add_css_class(chevron, "Suno-identity-chevron");
  gtk_box_append(GTK_BOX(content), chevron);

  GtkWidget *button = gtk_menu_button_new();
  gtk_widget_add_css_class(button, "Suno-identity-button");
  gtk_widget_add_css_class(button, "Suno-automatic-identity");
  gtk_widget_set_name(button, "SunoUI-identity");
  gtk_widget_set_valign(button, GTK_ALIGN_CENTER);
  gtk_widget_set_tooltip_text(button, name);
  g_autofree char *spoken = g_strdup_printf("%s menu", name);
  gtk_accessible_update_property(GTK_ACCESSIBLE(button),
                                 GTK_ACCESSIBLE_PROPERTY_LABEL, spoken, -1);
  gtk_menu_button_set_child(GTK_MENU_BUTTON(button), content);
  g_autoptr(GMenuModel) updated_menu=Suno_native_app_updates_menu(application,menu);
  gtk_menu_button_set_menu_model(GTK_MENU_BUTTON(button), updated_menu);
  return button;
}

/* v70's window controls (.wctl), the same as the Python kit's WindowControls:
 * Lucide minus, maximize-2 and x in the order the desktop's decoration layout
 * gives (Close always), running GTK's own window actions, reachable with Tab.
 * The header bar's own title buttons are off, so no libadwaita draws a second set. */
/* On a phone the controls fold away at phone width (v70 .win.phone .wctl); a desktop keeps them
 * however narrow a window is tiled (Nick, 26 Sep). */
static void controls_width_changed(GtkWidget *window G_GNUC_UNUSED, int width, gpointer data) {
  gtk_widget_set_visible(GTK_WIDGET(data), width <= 0 || width > SUNO_UI_WINDOW_CONTROLS_HIDE_MAX_WIDTH);
}

/* Builds the buttons for the current decoration layout. A layout whose end is
 * explicitly empty (":", which Tablet and Mobile set) asks for no controls at
 * all; any other layout keeps Close. Rebuilt live when the layout changes. */
static void window_controls_fill(GtkWidget *box) {
  static const struct { const char *name, *glyph, *label, *action; } buttons[] = {
    {"minimize", "SunoUI-minus-symbolic", "Minimize", "window.minimize"},
    {"maximize", "SunoUI-maximize-2-symbolic", "Zoom", "window.toggle-maximized"},
    {"close", "SunoUI-x-symbolic", "Close", "window.close"},
  };
  GtkWidget *child;
  while ((child = gtk_widget_get_first_child(box)) != NULL)
    gtk_box_remove(GTK_BOX(box), child);
  g_autofree char *layout = NULL;
  g_object_get(gtk_settings_get_for_display(gtk_widget_get_display(box)),
               "gtk-decoration-layout", &layout, NULL);
  const char *end = layout != NULL && strchr(layout, ':') != NULL ? strchr(layout, ':') + 1
                    : (layout != NULL ? layout : "minimize,maximize,close");
  g_autofree char *trimmed = g_strstrip(g_strdup(end));
  gboolean none = layout != NULL && strchr(layout, ':') != NULL && trimmed[0] == '\0';
  g_auto(GStrv) parts = g_strsplit(end, ",", -1);
  gboolean has_close = FALSE;
  for (guint i = 0; parts[i] != NULL && !none; i++) {
    g_strstrip(parts[i]);
    for (guint j = 0; j < G_N_ELEMENTS(buttons); j++) {
      if (g_strcmp0(parts[i], buttons[j].name) != 0)
        continue;
      GtkWidget *button = gtk_button_new_from_icon_name(buttons[j].glyph);
      g_autofree char *id = g_strconcat("SunoUI-window-", buttons[j].name, NULL);
      gtk_widget_set_name(button, id);
      gtk_widget_add_css_class(button, "SunoUI-window-control");
      gtk_widget_add_css_class(button, buttons[j].name);
      gtk_widget_set_focus_on_click(button, FALSE);
      gtk_widget_set_valign(button, GTK_ALIGN_CENTER);
      gtk_actionable_set_action_name(GTK_ACTIONABLE(button), buttons[j].action);
      gtk_accessible_update_property(GTK_ACCESSIBLE(button), GTK_ACCESSIBLE_PROPERTY_LABEL,
                                     buttons[j].label, -1);
      gtk_box_append(GTK_BOX(box), button);
      has_close = has_close || j == 2;
    }
  }
  if (!has_close && !none) {
    GtkWidget *button = gtk_button_new_from_icon_name(buttons[2].glyph);
    gtk_widget_set_name(button, "SunoUI-window-close");
    gtk_widget_add_css_class(button, "SunoUI-window-control");
    gtk_widget_add_css_class(button, "close");
    gtk_widget_set_focus_on_click(button, FALSE);
    gtk_actionable_set_action_name(GTK_ACTIONABLE(button), buttons[2].action);
    gtk_accessible_update_property(GTK_ACCESSIBLE(button), GTK_ACCESSIBLE_PROPERTY_LABEL,
                                   buttons[2].label, -1);
    gtk_box_append(GTK_BOX(box), button);
  }
}

static void window_controls_layout_changed(GObject *settings G_GNUC_UNUSED,
                                           GParamSpec *pspec G_GNUC_UNUSED, gpointer box) {
  window_controls_fill(GTK_WIDGET(box));
}

static GtkWidget *window_controls_new(GtkWidget *widget) {
  GtkWidget *box = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0); /* 2 px is the sheet's border-spacing */
  gtk_widget_set_name(box, "SunoUI-window-controls");
  gtk_widget_add_css_class(box, "SunoUI-window-controls");
  gtk_widget_set_valign(box, GTK_ALIGN_CENTER);
  window_controls_fill(box);
  g_signal_connect_object(gtk_settings_get_for_display(gtk_widget_get_display(widget)),
                          "notify::gtk-decoration-layout",
                          G_CALLBACK(window_controls_layout_changed), box, 0);
  if (Suno_ui_mobile_form_factor())
    Suno_ui_width_watch(widget, controls_width_changed, box, SUNO_UI_WINDOW_CONTROLS_HIDE_MAX_WIDTH);
  return box;
}

static GtkWidget *find_adw_widget(GtkWidget *root, GType type) {
  if (G_TYPE_CHECK_INSTANCE_TYPE(root, type)) return root;
  for (GtkWidget *child = gtk_widget_get_first_child(root); child != NULL;
       child = gtk_widget_get_next_sibling(child)) {
    GtkWidget *found = find_adw_widget(child, type);
    if (found != NULL) return found;
  }
  return NULL;
}

/* AdwToolbarView has no public getter for individual bars. Its direct top-bar
 * wrapper is marked with libadwaita's CSS class. Search inside that wrapper
 * only: Nautilus's content has a nested bottom action header and GTK puts the
 * content before the top wrapper in child order. */
static GtkWidget *find_outer_top_header(GtkWidget *toolbar) {
  for (GtkWidget *child = gtk_widget_get_first_child(toolbar); child != NULL;
       child = gtk_widget_get_next_sibling(child))
    if (gtk_widget_has_css_class(child, "top-bar"))
      return find_adw_widget(child, ADW_TYPE_HEADER_BAR);
  return NULL;
}

GtkWidget *Suno_application_window_frame_adopt(AdwApplicationWindow *window) {
  g_return_val_if_fail(ADW_IS_APPLICATION_WINDOW(window), NULL);
  GtkWidget *previous = g_object_get_data(G_OBJECT(window), "Suno-adopted-titlebar");
  if (previous != NULL) return previous;

  GtkWidget *content = adw_application_window_get_content(window);
  GtkWidget *toolbar = content != NULL ? find_adw_widget(content, ADW_TYPE_TOOLBAR_VIEW) : NULL;
  GtkWidget *body = toolbar != NULL ? adw_toolbar_view_get_content(ADW_TOOLBAR_VIEW(toolbar)) : NULL;
  GtkWidget *titlebar = toolbar != NULL ? find_outer_top_header(toolbar) : NULL;
  if (titlebar == NULL && toolbar != NULL) {
    titlebar = adw_header_bar_new();
    adw_toolbar_view_add_top_bar(ADW_TOOLBAR_VIEW(toolbar), titlebar);
  } else if (titlebar == NULL) {
    /* Preserve the caller's content object and all of its signal bindings. */
    if (content != NULL) {
      g_object_ref(content);
      adw_application_window_set_content(window, NULL);
    }
    titlebar = adw_header_bar_new();
    GtkWidget *toolbar = adw_toolbar_view_new();
    adw_toolbar_view_add_top_bar(ADW_TOOLBAR_VIEW(toolbar), titlebar);
    body = adw_bin_new();
    if (content != NULL) {
      adw_bin_set_child(ADW_BIN(body), content);
      g_object_unref(content);
    }
    adw_toolbar_view_set_content(ADW_TOOLBAR_VIEW(toolbar), body);
    adw_application_window_set_content(window, toolbar);
  }

  gtk_widget_add_css_class(GTK_WIDGET(window), "Suno-app-window");
  gtk_widget_add_css_class(GTK_WIDGET(window), "Suno-application-window");
  gtk_widget_add_css_class(GTK_WIDGET(window), "Suno-native-window");
  gtk_widget_add_css_class(GTK_WIDGET(window), "Suno-adw-native-window");
  gtk_widget_add_css_class(titlebar, "Suno-titlebar");
  gtk_widget_set_name(titlebar, "SunoUI-title-row");
  if (body != NULL) {
    gtk_widget_add_css_class(body, "Suno-window-body");
    gtk_widget_add_css_class(body, "Suno-native-work-surface");
  }
  adw_header_bar_set_show_title(ADW_HEADER_BAR(titlebar), FALSE);
  adw_header_bar_set_show_start_title_buttons(ADW_HEADER_BAR(titlebar), FALSE);
  adw_header_bar_set_show_end_title_buttons(ADW_HEADER_BAR(titlebar), FALSE);
  GtkApplication *application = gtk_window_get_application(GTK_WINDOW(window));
  GMenuModel *menu = application != NULL ? gtk_application_get_menubar(application) : NULL;
  GtkWidget *identity = identity_new(application, GTK_WINDOW(window), menu);
  adw_header_bar_pack_start(ADW_HEADER_BAR(titlebar), identity);
  adw_header_bar_pack_end(ADW_HEADER_BAR(titlebar), window_controls_new(GTK_WIDGET(window)));
  g_object_set_data(G_OBJECT(window), "Suno-adopted-titlebar", titlebar);
  g_object_set_data(G_OBJECT(window), "Suno-adopted-identity", identity);
  /* Existing native windows adopt the same live context as SunoApplicationWindow.
   * Keep the original content, toolbar and action bindings in place. */
  SunoContext *context = Suno_context_new_from_environment();
  g_object_set_data_full(G_OBJECT(window), "Suno-adopted-context", context, g_object_unref);
  g_signal_connect_object(context, "notify", G_CALLBACK(adopted_context_changed), window, 0);
  apply_window_context(GTK_WINDOW(window), titlebar, context);
  return titlebar;
}

void Suno_application_window_frame_set_menu_model(AdwApplicationWindow *window,
                                                  GMenuModel *menu_model) {
  g_return_if_fail(ADW_IS_APPLICATION_WINDOW(window));
  g_return_if_fail(menu_model == NULL || G_IS_MENU_MODEL(menu_model));
  Suno_application_window_frame_adopt(window);
  GtkWidget *identity = g_object_get_data(G_OBJECT(window), "Suno-adopted-identity");
  g_autoptr(GMenuModel) updated_menu=Suno_native_app_updates_menu(gtk_window_get_application(GTK_WINDOW(window)),menu_model);
  gtk_menu_button_set_menu_model(GTK_MENU_BUTTON(identity), updated_menu);
}

void Suno_application_window_frame_set_leading(AdwApplicationWindow *window,
                                               GtkWidget *widget) {
  g_return_if_fail(ADW_IS_APPLICATION_WINDOW(window));
  g_return_if_fail(GTK_IS_WIDGET(widget));
  GtkWidget *titlebar = Suno_application_window_frame_adopt(window);
  g_return_if_fail(gtk_widget_get_parent(widget) == NULL ||
                   gtk_widget_is_ancestor(widget, titlebar));
  gboolean held = gtk_widget_get_parent(widget) != NULL;
  if (held) {
    g_object_ref(widget);
    adw_header_bar_remove(ADW_HEADER_BAR(titlebar), widget);
  }
  adw_header_bar_pack_start(ADW_HEADER_BAR(titlebar), widget);
  if (held) g_object_unref(widget);
}

typedef struct {
  GtkWidget *titlebar;
  GtkWidget *leading;
  GtkWidget *phone_host;
} SunoAdoptedLeading;

static void adopted_leading_width_changed(GtkWidget *window, int width, gpointer data) {
  (void)window;
  SunoAdoptedLeading *state = data;
  GtkWidget *parent = gtk_widget_get_parent(state->leading);
  if (width <= SUNO_UI_PHONE_MAX_WIDTH &&
      gtk_widget_is_ancestor(state->leading, state->titlebar)) {
    g_object_ref(state->leading);
    adw_header_bar_remove(ADW_HEADER_BAR(state->titlebar), state->leading);
    gtk_box_append(GTK_BOX(state->phone_host), state->leading);
    g_object_unref(state->leading);
  } else if (width > SUNO_UI_PHONE_MAX_WIDTH && parent == state->phone_host) {
    g_object_ref(state->leading);
    gtk_box_remove(GTK_BOX(state->phone_host), state->leading);
    adw_header_bar_pack_start(ADW_HEADER_BAR(state->titlebar), state->leading);
    g_object_unref(state->leading);
  }
  gtk_widget_set_visible(state->phone_host, width <= SUNO_UI_PHONE_MAX_WIDTH);
}

void Suno_application_window_frame_set_leading_phone_host(AdwApplicationWindow *window,
                                                           GtkWidget *widget,
                                                           GtkWidget *phone_host) {
  g_return_if_fail(ADW_IS_APPLICATION_WINDOW(window));
  g_return_if_fail(GTK_IS_WIDGET(widget));
  g_return_if_fail(GTK_IS_BOX(phone_host));
  Suno_application_window_frame_set_leading(window, widget);
  SunoAdoptedLeading *state = g_new0(SunoAdoptedLeading, 1);
  state->titlebar = Suno_application_window_frame_adopt(window);
  state->leading = widget;
  state->phone_host = phone_host;
  gtk_widget_set_visible(phone_host, FALSE);
  g_object_set_data_full(G_OBJECT(window), "Suno-adopted-leading-phone-host", state, g_free);
  Suno_ui_width_watch(GTK_WIDGET(window), adopted_leading_width_changed, state,
                      SUNO_UI_PHONE_MAX_WIDTH);
}

static void add_identity(SunoApplicationWindow *self) {
  GtkApplication *application = gtk_window_get_application(GTK_WINDOW(self));
  if (self->identity != NULL || application == NULL)
    return;
  GMenuModel *menu = g_object_get_data(G_OBJECT(application), "Suno-native-menu");
  if (menu == NULL)
    menu = gtk_application_get_menubar(application);
  self->identity = identity_new(application, GTK_WINDOW(self), menu);
  adw_header_bar_pack_start(ADW_HEADER_BAR(self->titlebar), self->identity);
}

/* The identity libadwaita builds for a title row that had none when the application arrived (an app
 * that sets its application after construction) draws its icon at 20; v70's is 22, as the kit's own.
 * Its images are brought to the kit's size when the window maps. */
static void identity_icons_to_size(GtkWidget *node) {
  for (GtkWidget *child = gtk_widget_get_first_child(node); child != NULL; child = gtk_widget_get_next_sibling(child)) {
    if (GTK_IS_IMAGE(child) && gtk_widget_has_css_class(node, "Suno-identity-icon"))
      gtk_image_set_pixel_size(GTK_IMAGE(child), SUNO_UI_WINDOW_IDENTITY_ICON);
    identity_icons_to_size(child);
  }
}

static void window_mapped(GtkWidget *widget, gpointer data G_GNUC_UNUSED) {
  SunoApplicationWindow *self = SUNO_APPLICATION_WINDOW(widget);
  if (self->titlebar != NULL)
    identity_icons_to_size(self->titlebar);
}

static void Suno_application_window_init(SunoApplicationWindow *self) {
  /* The classes SunoUI's toolkit sheet dresses: the frame on the window, the
   * work surface under the title row. The native-window pair is what the
   * patched libadwaita used to add at run time; the kit adds them itself so
   * the window is the same on any libadwaita. */
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-app-window");
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-application-window");
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-native-window");
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-adw-native-window");
  self->backdrop = Suno_surface_backdrop_new(GTK_WINDOW(self));
  g_signal_connect_swapped(self, "notify::visible-dialog", G_CALLBACK(prepare_visible_dialog), self);

  /* A real header bar: the window handle and the controls. Its own title is
   * hidden: the identity is the title. */
  self->titlebar = adw_header_bar_new();
  gtk_widget_add_css_class(self->titlebar, "Suno-titlebar");
  gtk_widget_set_name(self->titlebar, "SunoUI-title-row");
  adw_header_bar_set_show_title(ADW_HEADER_BAR(self->titlebar), FALSE);
  adw_header_bar_set_show_start_title_buttons(ADW_HEADER_BAR(self->titlebar), FALSE);
  adw_header_bar_set_show_end_title_buttons(ADW_HEADER_BAR(self->titlebar), FALSE);
  adw_header_bar_pack_end(ADW_HEADER_BAR(self->titlebar), window_controls_new(GTK_WIDGET(self)));
  g_signal_connect(self, "map", G_CALLBACK(window_mapped), NULL);
  GtkEventController *back = gtk_event_controller_key_new();
  g_signal_connect(back, "key-pressed", G_CALLBACK(tv_back), self);
  gtk_widget_add_controller(GTK_WIDGET(self), back);

  self->body_bin = adw_bin_new();
  gtk_widget_add_css_class(self->body_bin, "Suno-native-work-surface");
  /* The work surface owns its rounded clip, so no child (nor an island's
   * shadow) paints over the title row or past the surface's corners. */
  gtk_widget_set_overflow(self->body_bin, GTK_OVERFLOW_HIDDEN);
  self->toolbar_view = adw_toolbar_view_new();
  gtk_widget_add_css_class(self->toolbar_view, "Suno-window-toolbar-view");
  adw_toolbar_view_add_top_bar(ADW_TOOLBAR_VIEW(self->toolbar_view),
                               self->titlebar);
  /* The window's SunoUI layer host sits under the title row, so a dialog,
   * drawer or toast dims the window below its title bar (as the Python
   * AppWindow's does); the title row and controls stay undimmed. */
  /* The body's gutter (.Suno-window-body) is inside the layer host, so a phone's drawer spans the
   * whole window width (v70's full-width sheet at 390), not the body less its 8 a side. */
  self->body_pad = adw_bin_new();
  gtk_widget_add_css_class(self->body_pad, "Suno-window-body");
  self->layer_host = Suno_layer_host_new_window(self->body_pad);
  adw_bin_set_child(ADW_BIN(self->body_bin), self->layer_host);
  g_object_set_data(G_OBJECT(self), "Suno-layer-host", self->layer_host);
  adw_toolbar_view_set_content(ADW_TOOLBAR_VIEW(self->toolbar_view),
                               self->body_bin);
  adw_application_window_set_content(ADW_APPLICATION_WINDOW(self),
                                     self->toolbar_view);
}

GtkWidget *Suno_application_window_new(GtkApplication *application,
                                       SunoContext *context) {
  g_return_val_if_fail(GTK_IS_APPLICATION(application), NULL);
  g_return_val_if_fail(context == NULL || SUNO_IS_CONTEXT(context), NULL);
  /* The native header resolves its menu while the window is constructed.
   * Keep a mutable model alive from that point so later command registration
   * updates the same menu through GMenuModel::items-changed. */
  if (gtk_application_get_menubar(application) == NULL) {
    GMenu *menu = g_menu_new();
    gtk_application_set_menubar(application, G_MENU_MODEL(menu));
    g_object_set_data_full(G_OBJECT(application), "Suno-native-menu", menu,
                          g_object_unref);
  }
  return g_object_new(SUNO_TYPE_APPLICATION_WINDOW, "application", application,
                      "context", context, NULL);
}

void Suno_application_window_set_phone_bleed(SunoApplicationWindow *self, gboolean bleed) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "SunoUI-bleed", bleed);
}

void Suno_application_window_set_edge_to_edge(SunoApplicationWindow *self, gboolean enabled) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "SunoUI-edge-to-edge", enabled);
}

void Suno_application_window_set_status_bar_style(SunoApplicationWindow *self, const char *ink) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  g_return_if_fail(ink == NULL || g_str_equal(ink, "auto") ||
                   g_str_equal(ink, "light") || g_str_equal(ink, "dark"));
  g_simple_action_set_state(self->status_ink, g_variant_new_string(ink ? ink : "auto"));
}

int Suno_application_window_get_status_inset(SunoApplicationWindow *self) {
  g_return_val_if_fail(SUNO_IS_APPLICATION_WINDOW(self), 0);
  return gtk_widget_has_css_class(GTK_WIDGET(self), "SunoUI-phone-device") ? SUNO_UI_PHONE_FRAME_STATUS : 0;
}

void Suno_application_window_set_body(SunoApplicationWindow *self,
                                      GtkWidget *body) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  g_return_if_fail(body == NULL || GTK_IS_WIDGET(body));
  if (Suno_tv_frame_is_active(GTK_WINDOW(self)))
    Suno_tv_frame_set_active(GTK_WINDOW(self), FALSE);
  Suno_tv_frame_attach(GTK_WINDOW(self), NULL, NULL, NULL, NULL); /* a new body: no frame until set_frame */
  self->body = body;
  adw_bin_set_child(ADW_BIN(self->body_pad), body);
}

GtkWidget *Suno_application_window_get_body(SunoApplicationWindow *self) {
  g_return_val_if_fail(SUNO_IS_APPLICATION_WINDOW(self), NULL);
  return self->body;
}

/* Back that nothing in the window took, in TV posture: minimise, which returns to the TV home. */
static gboolean tv_back(GtkEventControllerKey *controller, guint key, guint code, GdkModifierType state,
                        SunoApplicationWindow *self) {
  (void)controller; (void)code; (void)state;
  if (self->context == NULL || !Suno_context_get_tv(self->context) || (key != GDK_KEY_Escape && key != GDK_KEY_Back))
    return GDK_EVENT_PROPAGATE;
  gtk_window_minimize(GTK_WINDOW(self));
  return GDK_EVENT_STOP;
}

void Suno_application_window_set_frame(SunoApplicationWindow *self, GtkWidget *sidebar, GtkWidget *island) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  g_return_if_fail(sidebar == NULL || SUNO_IS_NAVIGATION_SIDEBAR(sidebar));
  g_return_if_fail(SUNO_IS_ISLAND(island));
  GtkWidget *frame = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 8);
  gtk_widget_set_hexpand(frame, TRUE);
  gtk_widget_set_vexpand(frame, TRUE);
  if (sidebar != NULL) gtk_box_append(GTK_BOX(frame), sidebar);
  gtk_box_append(GTK_BOX(frame), island);
  Suno_application_window_set_body(self, frame);
  /* On a TV the frame is the floating island (Suno-tv-frame.c); elsewhere nothing changes. */
  Suno_tv_frame_attach(GTK_WINDOW(self), self->toolbar_view, frame, sidebar, island);
  if (self->context != NULL && Suno_context_get_tv(self->context))
    Suno_tv_frame_set_active(GTK_WINDOW(self), TRUE);
}

static void repack_start_slots(SunoApplicationWindow *self) {
  GtkWidget *leading = self->title_leading;
  GtkWidget *content = self->title_centred ? NULL : self->title_content;
  gboolean leading_held = leading != NULL && gtk_widget_get_parent(leading) != NULL;
  gboolean content_held = content != NULL && gtk_widget_get_parent(content) != NULL;
  if (leading_held) {
    g_object_ref(leading);
    adw_header_bar_remove(ADW_HEADER_BAR(self->titlebar), leading);
  }
  if (content_held) {
    g_object_ref(content);
    adw_header_bar_remove(ADW_HEADER_BAR(self->titlebar), content);
  }
  if (leading != NULL) adw_header_bar_pack_start(ADW_HEADER_BAR(self->titlebar), leading);
  if (content != NULL) adw_header_bar_pack_start(ADW_HEADER_BAR(self->titlebar), content);
  if (leading_held) g_object_unref(leading);
  if (content_held) g_object_unref(content);
}

static void swap_title_slot(SunoApplicationWindow *self, GtkWidget **slot, GtkWidget *widget, gboolean at_start) {
  g_return_if_fail(widget == NULL || GTK_IS_WIDGET(widget));
  if (*slot == widget) return;
  if (*slot != NULL) adw_header_bar_remove(ADW_HEADER_BAR(self->titlebar), *slot);
  *slot = widget;
  if (widget != NULL) {
    if (!at_start) adw_header_bar_pack_end(ADW_HEADER_BAR(self->titlebar), widget);
  }
  if (at_start) repack_start_slots(self);
}

void Suno_application_window_set_leading(SunoApplicationWindow *self, GtkWidget *widget) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  swap_title_slot(self, &self->title_leading, widget, TRUE);
}

void Suno_application_window_set_title_content(SunoApplicationWindow *self, GtkWidget *widget, gboolean centred) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  g_return_if_fail(widget == NULL || GTK_IS_WIDGET(widget));
  if (self->title_centred && self->title_content != NULL) {
    adw_header_bar_set_title_widget(ADW_HEADER_BAR(self->titlebar), NULL);
    adw_header_bar_set_show_title(ADW_HEADER_BAR(self->titlebar), FALSE);
    self->title_content = NULL;
  }
  self->title_centred = centred;
  if (centred) {
    swap_title_slot(self, &self->title_content, NULL, TRUE);
    if (widget != NULL) {
      adw_header_bar_set_title_widget(ADW_HEADER_BAR(self->titlebar), widget);
      adw_header_bar_set_show_title(ADW_HEADER_BAR(self->titlebar), TRUE);
      self->title_content = widget;
    }
  } else {
    swap_title_slot(self, &self->title_content, widget, TRUE);
  }
}

void Suno_application_window_set_trailing(SunoApplicationWindow *self, GtkWidget *widget) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  swap_title_slot(self, &self->title_trailing, widget, FALSE);
}

GtkWidget *Suno_application_window_get_layer_host(SunoApplicationWindow *self) {
  g_return_val_if_fail(SUNO_IS_APPLICATION_WINDOW(self), NULL);
  return self->layer_host;
}

GtkWidget *Suno_application_window_get_title_bar(SunoApplicationWindow *self) {
  g_return_val_if_fail(SUNO_IS_APPLICATION_WINDOW(self), NULL);
  return self->titlebar;
}

void Suno_application_window_set_identity(SunoApplicationWindow *self,
                                          const char *title,
                                          const char *subtitle,
                                          const char *icon_name) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  /* The identity's name and icon come from the desktop entry, resolved by the
   * toolkit; an application cannot put a different name in its own corner
   * than the shell shows in the dock. The window title is what the window
   * holds, and the subtitle — the open document — belongs there too. */
  (void)icon_name;
  if (subtitle != NULL && *subtitle != '\0') {
    g_autofree char *full = g_strdup_printf("%s — %s", subtitle, title != NULL ? title : "");
    gtk_window_set_title(GTK_WINDOW(self), full);
  } else {
    gtk_window_set_title(GTK_WINDOW(self), title != NULL ? title : "");
  }
}

void Suno_application_window_set_menu_model(SunoApplicationWindow *self,
                                            GMenuModel *menu_model) {
  g_return_if_fail(SUNO_IS_APPLICATION_WINDOW(self));
  g_return_if_fail(menu_model == NULL || G_IS_MENU_MODEL(menu_model));
  /* The identity shows the application's stable menu, so that is where the
   * model goes; a window made without Suno_application_window_new() points
   * its identity at the new model directly. */
  GtkApplication *application = gtk_window_get_application(GTK_WINDOW(self));
  if (application != NULL) {
    GMenu *stable = g_object_get_data(G_OBJECT(application), "Suno-native-menu");
    if (stable != NULL) {
      if (menu_model == G_MENU_MODEL(stable)) return;
      g_menu_remove_all(stable);
      if (menu_model != NULL) {
        for (int i = 0; i < g_menu_model_get_n_items(menu_model); i++) {
          GMenuItem *item = g_menu_item_new_from_model(menu_model, i);
          g_menu_append_item(stable, item);
          g_object_unref(item);
        }
      }
    } else {
      gtk_application_set_menubar(application, menu_model);
      if (self->identity != NULL)
        {
          g_autoptr(GMenuModel) updated_menu=Suno_native_app_updates_menu(application,menu_model);
          gtk_menu_button_set_menu_model(GTK_MENU_BUTTON(self->identity),updated_menu);
        }
    }
  }
}
