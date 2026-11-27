/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-context.h"
#include <gio/gio.h>
#include "Suno-ui-kit.h"

struct _SunoContext {
  GObject parent_instance;
  SunoPresentationMode presentation;
  SunoInputMode input;
  GDBusProxy *session;
  const char *experience;
  gboolean tv;
  gboolean tv_forced; /* SUNO_POSTURE decides; the bus does not override it */
};
G_DEFINE_FINAL_TYPE(SunoContext, Suno_context, G_TYPE_OBJECT)
G_DEFINE_ENUM_TYPE(SunoPresentationMode, Suno_presentation_mode,
                   G_DEFINE_ENUM_VALUE(SUNO_PRESENTATION_WINDOWED, "windowed"),
                   G_DEFINE_ENUM_VALUE(SUNO_PRESENTATION_FULLSCREEN_MOBILE,
                                       "fullscreen-mobile"))
G_DEFINE_ENUM_TYPE(SunoInputMode, Suno_input_mode,
                   G_DEFINE_ENUM_VALUE(SUNO_INPUT_POINTER, "pointer"),
                   G_DEFINE_ENUM_VALUE(SUNO_INPUT_TOUCH, "touch"))
enum { PROP_0, PROP_PRESENTATION, PROP_INPUT, PROP_EXPERIENCE, PROP_TV, N_PROPS };
static GParamSpec *properties[N_PROPS];

static void apply_session(SunoContext *self) {
  g_object_freeze_notify(G_OBJECT(self));
  g_autoptr(GVariant) mode = g_dbus_proxy_get_cached_property(self->session, "Presentation");
  if (mode && g_variant_is_of_type(mode, G_VARIANT_TYPE_STRING)) {
    const char *value = g_variant_get_string(mode, NULL);
    if (g_str_equal(value, "desktop") || g_str_equal(value, "tablet") || g_str_equal(value, "mobile")) {
      if (g_strcmp0(self->experience, value) != 0) {
        self->experience = g_intern_string(value);
        g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_EXPERIENCE]);
      }
      SunoPresentationMode presentation = g_str_equal(value, "desktop")
          ? SUNO_PRESENTATION_WINDOWED : SUNO_PRESENTATION_FULLSCREEN_MOBILE;
      if (self->presentation != presentation) {
        self->presentation = presentation;
        g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_PRESENTATION]);
      }
    }
  }
  /* The shell's effective posture (desktop, tablet, mobile or tv); an older
   * service without the property keeps the system's answer. */
  g_autoptr(GVariant) posture = g_dbus_proxy_get_cached_property(self->session, "Posture");
  if (!self->tv_forced && posture && g_variant_is_of_type(posture, G_VARIANT_TYPE_STRING)) {
    gboolean tv = g_str_equal(g_variant_get_string(posture, NULL), "tv");
    if (self->tv != tv) {
      self->tv = tv;
      g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_TV]);
    }
  }
  g_autoptr(GVariant) capabilities = g_dbus_proxy_get_cached_property(self->session, "InputCapabilities");
  gboolean touch;
  if (capabilities && g_variant_is_of_type(capabilities, G_VARIANT_TYPE("a{sb}")) &&
      g_variant_lookup(capabilities, "touchscreen", "b", &touch)) {
    SunoInputMode input = touch ? SUNO_INPUT_TOUCH : SUNO_INPUT_POINTER;
    if (self->input != input) {
      self->input = input;
      g_object_notify_by_pspec(G_OBJECT(self), properties[PROP_INPUT]);
    }
  }
  g_object_thaw_notify(G_OBJECT(self));
}

static void session_changed(GDBusProxy *proxy, GVariant *changed,
                            const char *const *invalidated, SunoContext *self) {
  (void)proxy; (void)changed; (void)invalidated;
  apply_session(self);
}

static void session_ready(GObject *source, GAsyncResult *result, gpointer data) {
  (void)source;
  g_autoptr(SunoContext) self = data;
  g_autoptr(GError) error = NULL;
  self->session = g_dbus_proxy_new_for_bus_finish(result, &error);
  if (self->session == NULL)
    return; /* Standalone apps retain their explicit environment fallback. */
  g_signal_connect_object(self->session, "g-properties-changed",
                          G_CALLBACK(session_changed), self, 0);
  apply_session(self);
}

static void Suno_context_dispose(GObject *object) {
  SunoContext *self = SUNO_CONTEXT(object);
  g_clear_object(&self->session);
  G_OBJECT_CLASS(Suno_context_parent_class)->dispose(object);
}
static void Suno_context_get_property(GObject *o, guint id, GValue *v,
                                      GParamSpec *p) {
  SunoContext *s = SUNO_CONTEXT(o);
  switch (id) {
  case PROP_PRESENTATION:
    g_value_set_enum(v, s->presentation);
    break;
  case PROP_INPUT:
    g_value_set_enum(v, s->input);
    break;
  case PROP_EXPERIENCE:
    g_value_set_string(v, s->experience);
    break;
  case PROP_TV:
    g_value_set_boolean(v, s->tv);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(o, id, p);
  }
}
static void Suno_context_set_property(GObject *o, guint id, const GValue *v,
                                      GParamSpec *p) {
  SunoContext *s = SUNO_CONTEXT(o);
  switch (id) {
  case PROP_PRESENTATION:
    s->presentation = g_value_get_enum(v);
    s->experience = s->presentation == SUNO_PRESENTATION_WINDOWED ? "desktop" : "mobile";
    break;
  case PROP_INPUT:
    s->input = g_value_get_enum(v);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID(o, id, p);
  }
}
static void Suno_context_class_init(SunoContextClass *k) {
  GObjectClass *o = G_OBJECT_CLASS(k);
  o->get_property = Suno_context_get_property;
  o->set_property = Suno_context_set_property;
  o->dispose = Suno_context_dispose;
  properties[PROP_PRESENTATION] = g_param_spec_enum(
      "presentation", NULL, NULL, SUNO_TYPE_PRESENTATION_MODE,
      SUNO_PRESENTATION_WINDOWED,
      G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  properties[PROP_INPUT] = g_param_spec_enum(
      "input", NULL, NULL, SUNO_TYPE_INPUT_MODE, SUNO_INPUT_POINTER,
      G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);
  properties[PROP_EXPERIENCE] = g_param_spec_string(
      "experience", NULL, NULL, "desktop", G_PARAM_READABLE | G_PARAM_STATIC_STRINGS);
  /* TV posture (docs/developer-platform/tv-mode.md): independent of the
   * presentation, which stays a desktop's underneath. */
  properties[PROP_TV] = g_param_spec_boolean(
      "tv", NULL, NULL, FALSE, G_PARAM_READABLE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);
  g_object_class_install_properties(o, N_PROPS, properties);
}
static void Suno_context_init(SunoContext *s) {
  s->presentation = SUNO_PRESENTATION_WINDOWED;
  s->input = SUNO_INPUT_POINTER;
  s->experience = "desktop";
}
SunoContext *Suno_context_new(SunoPresentationMode p, SunoInputMode i) {
  return g_object_new(SUNO_TYPE_CONTEXT, "presentation", p, "input", i, NULL);
}
static gboolean is_touch_profile(void) {
  const char *d = g_getenv("SUNO_DEVICE_CLASS");
  if (g_strcmp0(d, "desktop") == 0)
    return FALSE;
  if (g_strcmp0(d, "handheld") == 0 || g_strcmp0(d, "tablet") == 0 ||
      g_strcmp0(d, "mobile") == 0)
    return TRUE;
  g_autofree char *contents = NULL;
  if (g_file_get_contents("/etc/Suno-device-class", &contents, NULL, NULL)) {
    g_strstrip(contents);
    return g_strcmp0(contents, "handheld") == 0 || g_strcmp0(contents, "tablet") == 0 ||
           g_strcmp0(contents, "mobile") == 0;
  }
  return FALSE;
}
SunoContext *Suno_context_new_from_environment(void) {
  gboolean handheld = is_touch_profile();
  const char *p = g_getenv("SUNO_PRESENTATION_MODE");
  const char *i = g_getenv("SUNO_INPUT_MODE");
  SunoPresentationMode pm = handheld ? SUNO_PRESENTATION_FULLSCREEN_MOBILE
                                     : SUNO_PRESENTATION_WINDOWED;
  SunoInputMode im = handheld ? SUNO_INPUT_TOUCH : SUNO_INPUT_POINTER;
  if (p) {
    if (g_str_equal(p, "windowed"))
      pm = SUNO_PRESENTATION_WINDOWED;
    else if (g_str_equal(p, "fullscreen-mobile"))
      pm = SUNO_PRESENTATION_FULLSCREEN_MOBILE;
    else
      g_warning("Ignoring invalid SUNO_PRESENTATION_MODE=%s", p);
  }
  if (i) {
    if (g_str_equal(i, "pointer"))
      im = SUNO_INPUT_POINTER;
    else if (g_str_equal(i, "touch"))
      im = SUNO_INPUT_TOUCH;
    else
      g_warning("Ignoring invalid SUNO_INPUT_MODE=%s", i);
  }
  SunoContext *context = Suno_context_new(pm, im);
  const char *posture = g_getenv("SUNO_POSTURE");
  context->tv_forced = posture != NULL && *posture != '\0';
  context->tv = Suno_ui_tv_posture();
  g_dbus_proxy_new_for_bus(G_BUS_TYPE_SESSION, G_DBUS_PROXY_FLAGS_NONE, NULL,
      "org.projectSuno.ShellState1", "/org/projectSuno/ShellState1",
      "org.projectSuno.ShellState1", NULL, session_ready, g_object_ref(context));
  return context;
}
SunoPresentationMode Suno_context_get_presentation(SunoContext *s) {
  g_return_val_if_fail(SUNO_IS_CONTEXT(s), SUNO_PRESENTATION_WINDOWED);
  return s->presentation;
}
SunoInputMode Suno_context_get_input(SunoContext *s) {
  g_return_val_if_fail(SUNO_IS_CONTEXT(s), SUNO_INPUT_POINTER);
  return s->input;
}
gboolean Suno_context_get_decorated(SunoContext *s) {
  return Suno_context_get_presentation(s) == SUNO_PRESENTATION_WINDOWED;
}
gboolean Suno_context_get_touch_targets(SunoContext *s) {
  return Suno_context_get_input(s) == SUNO_INPUT_TOUCH;
}

gboolean Suno_context_get_tv(SunoContext *s) {
  g_return_val_if_fail(SUNO_IS_CONTEXT(s), FALSE);
  return s->tv;
}

const char *Suno_context_get_experience(SunoContext *s) {
  g_return_val_if_fail(SUNO_IS_CONTEXT(s), "desktop");
  return s->experience;
}
