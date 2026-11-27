/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-ui.h"
#include "Suno-appearance.h"

#include <adwaita.h>

/* The token provider is kept so the treatment can be swapped while the
 * application runs. A window that keeps whichever treatment happened to be set
 * at startup reads as a bug the moment the desktop switches to dark. */
static GtkCssProvider *Suno_token_provider = NULL;
static SunoSurfacePolicy *Suno_surface_policy = NULL;
static GtkCssProvider *Suno_legacy_provider = NULL;
/* SunoUI's own window and toolkit sheets (ADR-052): the frame, title row,
 * identity, controls, gutter, islands, menus, materials and libadwaita's
 * colour names, which the patched libadwaita used to carry. */
static GtkCssProvider *Suno_toolkit_palette_provider = NULL;
static GtkCssProvider *Suno_toolkit_provider = NULL;
static GtkCssProvider *Suno_media_provider = NULL;
static GtkCssProvider *Suno_bar_provider = NULL;
static GtkCssProvider *Suno_rows_provider = NULL;
/* libadwaita computes its default (blue) accent in C, so the palette alone
 * cannot restate it: this names Suno's blue as the accent only while the
 * accent is the default, and a person's own accent choice still wins. */
static GtkCssProvider *Suno_toolkit_accent_provider = NULL;
/* Frost and Glass restate the kit's colours above the theme (SETTINGS), where
 * Suno's patched libadwaita used to, so a translucent window is one material
 * whatever built it. The values are SunoUI-palette.css's. */
static GtkCssProvider *Suno_material_provider = NULL;

/* What colour a window is painted is one decision for the whole process, and
 * every toplevel carries it as `Suno-treatment-<name>`, kit window or not (it
 * used to be Suno's patched libadwaita that made it, patch 0042). */
static const char *Suno_treatment = NULL;
static GListModel *Suno_toplevels = NULL;

static void Suno_apply_treatment(void) {
  static const char *const treatments[] = {"light", "dark", "frost", "glass"};
  if (Suno_treatment == NULL || Suno_toplevels == NULL)
    return;
  for (guint i = 0; i < g_list_model_get_n_items(Suno_toplevels); i++) {
    g_autoptr(GtkWidget) window = g_list_model_get_item(Suno_toplevels, i);
    for (guint t = 0; t < G_N_ELEMENTS(treatments); t++) {
      g_autofree char *css_class = g_strconcat("Suno-treatment-", treatments[t], NULL);
      if (g_str_equal(treatments[t], Suno_treatment))
        gtk_widget_add_css_class(window, css_class);
      else
        gtk_widget_remove_css_class(window, css_class);
    }
  }
}

static void Suno_toplevels_changed(GListModel *model G_GNUC_UNUSED, guint position G_GNUC_UNUSED,
                                   guint removed G_GNUC_UNUSED, guint added G_GNUC_UNUSED,
                                   gpointer data G_GNUC_UNUSED) {
  Suno_apply_treatment();
}

static void Suno_set_material(const char *treatment) {
  static const char *const roles[] = {
    "window", "content", "island", "chrome", "chrome_secondary", "menu",
    "ink", "muted", "faint", "line", "fill", "hover", "selected",
  };
  g_autoptr(GString) sheet = g_string_new(NULL);
  if (Suno_material_provider == NULL)
    return;
  if (g_str_equal(treatment, "frost") || g_str_equal(treatment, "glass"))
    for (guint i = 0; i < G_N_ELEMENTS(roles); i++)
      g_string_append_printf(sheet, "@define-color Suno_%s @SunoUI_%s_%s;",
                             roles[i], treatment, roles[i]);
  gtk_css_provider_load_from_string(Suno_material_provider, sheet->str);
}

/* Sheets an application registers through Suno_ui_add_style_resource(). A
 * sheet that names an AppKit colour — @Suno_ink, @Suno_content — takes the
 * value current when it is parsed, so it is parsed again whenever the tokens
 * change; otherwise a sheet loaded before the desktop's preference arrived
 * keeps light colours inside a dark window. */
typedef struct {
  GtkCssProvider *provider;
  char *resource;
} SunoStyleResource;

static GPtrArray *Suno_style_resources = NULL;
static const char Suno_backdrop_data_key[] = "Suno-ui-surface-backdrop";

static void
Suno_bind_window_backdrop (GtkApplication *application G_GNUC_UNUSED,
                           GtkWindow      *window,
                           gpointer        data G_GNUC_UNUSED)
{
  SunoSurfaceBackdrop *backdrop;

  if (g_object_get_data (G_OBJECT (window), Suno_backdrop_data_key) != NULL)
    return;

  backdrop = Suno_surface_backdrop_new (window);
  g_object_set_data_full (G_OBJECT (window), Suno_backdrop_data_key,
                          backdrop, g_object_unref);
}

static void
Suno_bind_application_windows (void)
{
  GApplication *application = g_application_get_default ();

  if (!GTK_IS_APPLICATION (application))
    return;

  g_signal_connect (application, "window-added",
                    G_CALLBACK (Suno_bind_window_backdrop), NULL);
  for (GList *item = gtk_application_get_windows (GTK_APPLICATION (application));
       item != NULL; item = item->next)
    Suno_bind_window_backdrop (GTK_APPLICATION (application), item->data, NULL);
}

static void Suno_reload_style_resources(void) {
  guint index;

  if (Suno_style_resources == NULL)
    return;
  for (index = 0; index < Suno_style_resources->len; index++) {
    SunoStyleResource *sheet = g_ptr_array_index(Suno_style_resources, index);
    gtk_css_provider_load_from_resource(sheet->provider, sheet->resource);
  }
}

static gboolean Suno_prefers_dark(void) {
  AdwStyleManager *manager;

  /* GNOME does not set gtk-application-prefer-dark-theme; there is no such
   * key. The desktop publishes its choice as the portal's
   * org.freedesktop.appearance colour-scheme, which is what AdwStyleManager
   * reads. Asking GtkSettings instead reports light on a dark desktop. */
  if (!adw_is_initialized())
    adw_init();

  manager = adw_style_manager_get_default();
  if (manager != NULL && adw_style_manager_get_dark(manager))
    return TRUE;

  /* The portal answers for the treatment, but it is not always there — it can
   * fail to start, and it is absent from a bare session. Falling through to
   * light on a dark desktop is the worst possible answer, so the desktop's own
   * setting is asked directly before believing it. */
  {
    GSettingsSchemaSource *source = g_settings_schema_source_get_default();
    GSettingsSchema *schema =
        source != NULL ? g_settings_schema_source_lookup(
                             source, "org.gnome.desktop.interface", TRUE)
                       : NULL;

    if (schema != NULL) {
      gboolean dark = FALSE;

      if (g_settings_schema_has_key(schema, "color-scheme")) {
        GSettings *interface = g_settings_new("org.gnome.desktop.interface");
        g_autofree char *scheme =
            g_settings_get_string(interface, "color-scheme");
        dark = g_strcmp0(scheme, "prefer-dark") == 0;
        g_object_unref(interface);
      }
      g_settings_schema_unref(schema);
      return dark;
    }
  }
  return FALSE;
}

/* GTK 4.20 lets each provider say which colour scheme and contrast its @media
 * queries see, and libadwaita sets its own from the style manager rather than
 * from GtkSettings. The toolkit sheets follow the same answer, or their dark
 * and high-contrast rules would stay light beside libadwaita's. */
static void Suno_toolkit_follow_scheme(void) {
#if GTK_CHECK_VERSION(4, 20, 0)
  AdwStyleManager *manager = adw_style_manager_get_default();
  GtkInterfaceColorScheme scheme = adw_style_manager_get_dark(manager)
      ? GTK_INTERFACE_COLOR_SCHEME_DARK : GTK_INTERFACE_COLOR_SCHEME_LIGHT;
  GtkInterfaceContrast contrast = adw_style_manager_get_high_contrast(manager)
      ? GTK_INTERFACE_CONTRAST_MORE : GTK_INTERFACE_CONTRAST_NO_PREFERENCE;
  GtkCssProvider *providers[] = {Suno_toolkit_palette_provider, Suno_toolkit_provider,
                                 Suno_media_provider, Suno_rows_provider};
  for (guint i = 0; i < G_N_ELEMENTS(providers); i++)
    if (providers[i] != NULL)
      g_object_set(providers[i], "prefers-color-scheme", scheme,
                   "prefers-contrast", contrast, NULL);
#endif
}

static void Suno_toolkit_follow_accent(void) {
  if (Suno_toolkit_accent_provider == NULL)
    return;
  AdwStyleManager *manager = adw_style_manager_get_default();
  gtk_css_provider_load_from_string(
      Suno_toolkit_accent_provider,
      adw_style_manager_get_accent_color(manager) == ADW_ACCENT_COLOR_BLUE
          ? "@define-color accent_bg_color @SunoUI_accent_blue;" : "");
}

static void Suno_accent_changed(GObject *object G_GNUC_UNUSED,
                                GParamSpec *pspec G_GNUC_UNUSED,
                                gpointer data G_GNUC_UNUSED) {
  Suno_toolkit_follow_accent();
}

static void Suno_load_tokens(void) {
  static gboolean loading = FALSE;
  if (loading || Suno_token_provider == NULL)
    return;
  loading = TRUE;
  AdwStyleManager *manager = adw_style_manager_get_default();
  const gboolean high_contrast = adw_style_manager_get_high_contrast(manager) ||
      (Suno_surface_policy && Suno_surface_policy_get_locked(Suno_surface_policy));
  gboolean chosen = Suno_surface_policy && Suno_surface_policy_get_has_selection(Suno_surface_policy);
  const char *effective = Suno_surface_policy != NULL ?
      Suno_surface_policy_get_effective(Suno_surface_policy) : "light";
  gboolean dark = chosen && g_str_equal(effective, "dark");
  gboolean frost = chosen && g_str_equal(effective, "frost");
  gboolean glass = chosen && g_str_equal(effective, "glass");
  adw_style_manager_set_color_scheme(manager, !chosen || high_contrast ? ADW_COLOR_SCHEME_DEFAULT :
      dark ? ADW_COLOR_SCHEME_FORCE_DARK : ADW_COLOR_SCHEME_FORCE_LIGHT);
  if (!chosen || high_contrast)
    dark = Suno_prefers_dark();
  Suno_set_material(high_contrast ? "high-contrast" : frost ? "frost" : glass ? "glass" : "");
  Suno_treatment = !high_contrast && frost ? "frost" : !high_contrast && glass ? "glass"
                   : dark ? "dark" : "light";
  if (Suno_toplevels == NULL) {
    Suno_toplevels = gtk_window_get_toplevels();
    g_signal_connect(Suno_toplevels, "items-changed", G_CALLBACK(Suno_toplevels_changed), NULL);
  }
  Suno_apply_treatment();

  /* Applications name the AppKit's colours, so those are the ones the library
   * has to define. The Suno themes ship gtk-3.0 directories only, which leaves
   * a GTK 4 application with no other source for them. */
  gtk_css_provider_load_from_resource(
      Suno_token_provider,
      high_contrast ? "/org/projectSuno/platform/Suno-appkit-high-contrast-tokens.css" :
      frost ? "/org/projectSuno/platform/Suno-appkit-frost-tokens.css" :
      glass ? "/org/projectSuno/platform/Suno-appkit-glass-tokens.css" :
      dark ? "/org/projectSuno/platform/Suno-appkit-dark-tokens.css"
           : "/org/projectSuno/platform/Suno-appkit-tokens.css");

  /* The older surface names this library styles itself. They overlap the
   * AppKit set — Suno_ink is in both — so loading a fixed light copy after the
   * AppKit sheet would put light ink back on dark chrome, which is exactly the
   * unreadable result this replaced. It follows the treatment as well. */
  if (Suno_legacy_provider != NULL)
    gtk_css_provider_load_from_resource(
        Suno_legacy_provider,
        high_contrast ? "/org/projectSuno/platform/Suno-appkit-high-contrast-tokens.css" :
        frost ? "/org/projectSuno/platform/Suno-appkit-frost-tokens.css" :
        glass ? "/org/projectSuno/platform/Suno-appkit-glass-tokens.css" :
        dark ? "/org/projectSuno/platform/Suno-tokens-dark.css"
             : "/org/projectSuno/platform/Suno-tokens.css");

  /* The toolkit sheet names the kit's colours, which a sheet takes when it
   * is parsed: parse it again for the new treatment. */
  if (Suno_toolkit_provider != NULL)
    gtk_css_provider_load_from_resource(
        Suno_toolkit_provider, "/org/projectSuno/platform/SunoUI-toolkit.css");
  if (Suno_media_provider != NULL)
    gtk_css_provider_load_from_resource(
        Suno_media_provider, "/org/projectSuno/platform/Suno-appkit-media.css");
  if (Suno_bar_provider != NULL)
    gtk_css_provider_load_from_resource(
        Suno_bar_provider, "/org/projectSuno/platform/Suno-appkit-bar.css");
  if (Suno_rows_provider != NULL)
    gtk_css_provider_load_from_resource(
        Suno_rows_provider, "/org/projectSuno/platform/Suno-appkit-rows.css");
  Suno_toolkit_follow_scheme();

  Suno_reload_style_resources();
  loading = FALSE;
}

/* Called by the native Wayland adapter when the compositor advertises (or
 * withdraws) its real background-effect capability. Unknown remains false. */
void Suno_ui_set_surface_capabilities(gboolean available) {
  if (Suno_surface_policy == NULL)
    return;
  Suno_surface_policy_set_capabilities(
      Suno_surface_policy, available, available, available);
}

void Suno_ui_add_style_resource(const char *resource_path, guint priority) {
  GdkDisplay *display;
  SunoStyleResource *sheet;

  g_return_if_fail(resource_path != NULL);
  display = gdk_display_get_default();
  if (display == NULL)
    return;
  Suno_init();

  sheet = g_new0(SunoStyleResource, 1);
  sheet->provider = gtk_css_provider_new();
  sheet->resource = g_strdup(resource_path);
  gtk_css_provider_load_from_resource(sheet->provider, sheet->resource);
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(sheet->provider), priority);

  if (Suno_style_resources == NULL)
    Suno_style_resources = g_ptr_array_new();
  g_ptr_array_add(Suno_style_resources, sheet);
}

static void Suno_surface_changed(SunoSurfacePolicy *policy G_GNUC_UNUSED,
                                 gpointer data G_GNUC_UNUSED) {
  Suno_load_tokens();
}

static void Suno_dark_changed(GObject *object G_GNUC_UNUSED,
                              GParamSpec *pspec G_GNUC_UNUSED,
                              gpointer data G_GNUC_UNUSED) {
  Suno_load_tokens();
}

void Suno_init(void) {
  static gsize initialized = 0;
  GdkDisplay *display;
  GtkCssProvider *provider;
  AdwStyleManager *manager;

  display = gdk_display_get_default();
  if (display == NULL)
    return;

  if (!g_once_init_enter(&initialized))
    return;

  Suno_surface_policy = Suno_surface_policy_new(SUNO_SURFACE_TARGET_APPLICATION);
  g_signal_connect(Suno_surface_policy, "changed", G_CALLBACK(Suno_surface_changed), NULL);
  Suno_token_provider = gtk_css_provider_new();
  Suno_legacy_provider = gtk_css_provider_new();

  /* Above whatever libadwaita the system has (THEME), below the kit's
   * components and application sheets (APPLICATION). On Suno's patched
   * libadwaita the two say the same thing and this copy decides, so nothing
   * is drawn twice; on a stock one it is what draws the Suno window. */
  Suno_toolkit_palette_provider = gtk_css_provider_new();
  gtk_css_provider_load_from_resource(
      Suno_toolkit_palette_provider, "/org/projectSuno/platform/SunoUI-palette.css");
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_toolkit_palette_provider),
      GTK_STYLE_PROVIDER_PRIORITY_THEME + 1U);
  Suno_toolkit_provider = gtk_css_provider_new();
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_toolkit_provider),
      GTK_STYLE_PROVIDER_PRIORITY_THEME + 1U);
  Suno_media_provider = gtk_css_provider_new();
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_media_provider),
      GTK_STYLE_PROVIDER_PRIORITY_THEME + 1U);
  Suno_bar_provider = gtk_css_provider_new();
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_bar_provider),
      GTK_STYLE_PROVIDER_PRIORITY_APPLICATION + 1U);
  Suno_rows_provider = gtk_css_provider_new();
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_rows_provider),
      GTK_STYLE_PROVIDER_PRIORITY_THEME + 1U);
  Suno_material_provider = gtk_css_provider_new();
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_material_provider),
      GTK_STYLE_PROVIDER_PRIORITY_SETTINGS);
  Suno_toolkit_accent_provider = gtk_css_provider_new();
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_toolkit_accent_provider),
      GTK_STYLE_PROVIDER_PRIORITY_THEME + 1U);
  Suno_toolkit_follow_accent();

  Suno_load_tokens();
  /* The older names first, then the AppKit set: at one priority the provider
   * added later wins, and where the two overlap (Suno_ink: #1f2937 in the old
   * light sheet, #14161a in SunoUI) the design's value is the AppKit's, as a
   * Python SunoUI application has it. */
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_legacy_provider),
      GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(Suno_token_provider),
      GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);


  /* Fable's proportions for plain GTK widgets. This is loaded at APPLICATION
   * priority, not THEME: at THEME it merely ties with Adwaita, whose selectors
   * are the more specific ones, so Adwaita won every disagreement — window
   * controls as three separate circles, buttons a third too tall, scales with
   * their own padding. Applications load their own sheets at APPLICATION + 1
   * and still have the last word. */
  provider = gtk_css_provider_new();
  gtk_css_provider_load_from_resource(
      provider, "/org/projectSuno/platform/Suno-appkit-base.css");
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(provider),
      GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
  g_object_unref(provider);
  /* The family sheets (rows, media) sit where Python's install_appkit puts them: at APPLICATION,
   * after the component sheet, so a family's own rules win over base's general ones as in a Python
   * app (Settings, 28 Sep: C rows kept base's ink and padding over the Settings variant's). */
  /* The token sheet also carries the generated type roles; GTK settles a property between providers
   * of one priority by the order they were added, not by specificity, so it rejoins after the component
   * sheet or base's body line height beats every role (Settings, 28 Sep: row-title 19, not 18). */
  GtkCssProvider *families[] = {Suno_token_provider, Suno_media_provider, Suno_rows_provider};
  for (guint i = 0; i < G_N_ELEMENTS(families); i++) {
    gtk_style_context_remove_provider_for_display(display, GTK_STYLE_PROVIDER(families[i]));
    gtk_style_context_add_provider_for_display(display, GTK_STYLE_PROVIDER(families[i]),
                                               GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
  }

  provider = gtk_css_provider_new();
  gtk_css_provider_load_from_resource(provider,
                                      "/org/projectSuno/platform/Suno-ui.css");
  gtk_style_context_add_provider_for_display(
      display, GTK_STYLE_PROVIDER(provider),
      GTK_STYLE_PROVIDER_PRIORITY_APPLICATION + 2U);
  g_object_unref(provider);

  manager = adw_style_manager_get_default();
  if (manager != NULL) {
    g_signal_connect(manager, "notify::dark", G_CALLBACK(Suno_dark_changed), NULL);
    g_signal_connect(manager, "notify::high-contrast", G_CALLBACK(Suno_dark_changed), NULL);
    g_signal_connect(manager, "notify::accent-color", G_CALLBACK(Suno_accent_changed), NULL);
  }

  /* One shared native binding follows every window in an application that
   * opts into Suno-ui. SunoApplicationWindow already creates one explicitly;
   * Suno_surface_backdrop_new() deduplicates that request. */
  Suno_bind_application_windows ();

  g_once_init_leave(&initialized, 1);
}
