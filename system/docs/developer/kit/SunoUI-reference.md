---
title: SunoUI-1 reference
summary: SunoUI's C library, SunoUI-1: initialization, the window, islands, the adaptive scaffold, context and the media and imaging controls, with properties, signals and introspection names, as they exist in platform 0.1.0.
order: 3
section: Kit
---

# SunoUI-1 reference

`SunoUI-1` (`libSuno-ui-1.so.0`) is SunoUI’s C library. It is a GObject library
with introspection metadata, so the same API is available as `SunoUI` to any
language with GObject introspection. This page covers platform
**0.1.0 (preview)**; the ABI is not yet stable.

```c
#include <Suno-ui.h>   /* pkg-config: Suno-ui-1 */
```

`Suno-ui.h` includes every public header. The `pkg-config` module requires
`gtk4`, `libadwaita-1` and `Suno-semantics-1`. SunoUI builds on libadwaita’s
window, header bar, breakpoint and split-view types and draws them with its own
sheets, which is why some types below have `Adw` parents. Every type is final
(`G_DECLARE_FINAL_TYPE`), so compose rather than subclass, and `g_autoptr()`
works for all of them.

This page covers the core types. The SunoUI parts (islands, the navigation
sidebar, toasts, dialogs, the action center, cards, fields, menus and more) are
listed next to their Python twins in [SunoUI for C](SunoUI-c.md), and the
gtk-doc comments in each header are their reference.

| Type | Parent | Purpose |
| --- | --- | --- |
| [`SunoApplicationWindow`](#Sunoapplicationwindow) | `AdwApplicationWindow` | The Suno window |
| [`SunoPane`](#Sunopane) | `GtkBox` | An island |
| [`SunoAdaptiveScaffold`](#Sunoadaptivescaffold) | `AdwBreakpointBin` | Sidebar and content that collapse on narrow widths |
| [`SunoActionBar`](#Sunoactionbar) | `GtkBox` | A bar with leading, center and trailing areas |
| [`SunoContext`](#Sunocontext) | `GObject` | Presentation and input |
| [`SunoSegmentedControl`](#Sunosegmentedcontrol) | `GtkBox` | Mutually exclusive segments |
| [`SunoInspectorSection`](#Sunoinspectorsection) | `GtkBox` | A collapsible inspector section |
| [`SunoColorWell`](#Sunocolorwell) | `GtkBox` | A color button with an editable value |
| [`SunoMediaFader`](#Sunomediafader) | `GtkScale` | A decibel fader |
| [`SunoAudioMeter`](#Sunoaudiometer) | `GtkBox` | A mono or stereo level meter |
| [`SunoVolumeSlider`](#Sunovolumeslider) | `GtkWidget` | A volume, upright or flat, with a meter along it |
| [`SunoHistogram`](#Sunohistogram) | `GtkDrawingArea` | An image histogram |
| [`SunoCurveEditor`](#Sunocurveeditor) | `GtkDrawingArea` | A tone curve editor |
| [`SunoWelcomeView`](#Sunowelcomeview) | `GtkWidget` | The welcome surface for creative apps |
| [`SunoApplicationIcon`](#Sunoapplicationicon) | `GObject` (`GdkPaintable`) | Application artwork on the Suno tile |
| [`SunoSurfaceBackdrop`](#Sunosurfacebackdrop) | `GObject` | The compositor backdrop binding for a window |

## Initialization and styles

```c
void Suno_init (void);
void Suno_ui_add_style_resource (const char *resource_path, guint priority);
void Suno_ui_centre_controls (GtkWidget *bar);
```

**`Suno_init()`** installs SunoUI on the default display: SunoUI’s window
sheets, which draw the frame, title row and controls; the token sheet for the
current appearance and a legacy token sheet at
`GTK_STYLE_PROVIDER_PRIORITY_APPLICATION`; the base sheet at the same priority;
and the structural sheet at `APPLICATION + 2`. It follows dark and
high-contrast changes and Suno’s surface policy, and binds a
`SunoSurfaceBackdrop` to every window of the default `GtkApplication`, now and
as windows are added. It does nothing without a display and runs only once.
Python: `SunoUI.init()`.

**`Suno_ui_add_style_resource()`** loads your stylesheet from a GResource path
at `priority` (use `GTK_STYLE_PROVIDER_PRIORITY_APPLICATION + 1`) and re-parses
it whenever the tokens change, so `@Suno_*` colors follow the appearance. It
calls `Suno_init()` first.

```c
Suno_ui_add_style_resource ("/com/example/Counter/counter.css",
                            GTK_STYLE_PROVIDER_PRIORITY_APPLICATION + 1);
```

**`Suno_ui_centre_controls()`** changes every child of `bar` whose vertical
alignment is `GTK_ALIGN_FILL` to `GTK_ALIGN_CENTER`, so controls keep their
designed height. Call it after filling a bar you built from a plain box.

---

## `SunoApplicationWindow`

```c
GtkWidget  *Suno_application_window_new            (GtkApplication        *application,
                                                    SunoContext           *context);
void        Suno_application_window_set_body       (SunoApplicationWindow *self,
                                                    GtkWidget             *body);
GtkWidget  *Suno_application_window_get_body       (SunoApplicationWindow *self);
void        Suno_application_window_set_identity   (SunoApplicationWindow *self,
                                                    const char            *title,
                                                    const char            *subtitle,
                                                    const char            *icon_name);
void        Suno_application_window_set_menu_model (SunoApplicationWindow *self,
                                                    GMenuModel            *menu_model);
void        Suno_application_window_set_leading    (SunoApplicationWindow *self,
                                                    GtkWidget             *widget);
void        Suno_application_window_set_title_content (SunoApplicationWindow *self,
                                                    GtkWidget             *widget,
                                                    gboolean               centred);
void        Suno_application_window_set_trailing   (SunoApplicationWindow *self,
                                                    GtkWidget             *widget);
GtkWidget  *Suno_application_window_get_title_bar  (SunoApplicationWindow *self);
GtkWidget  *Suno_application_window_get_layer_host (SunoApplicationWindow *self);
```

| Property | Type | Flags |
| --- | --- | --- |
| `context` | `SunoContext` | read, write, construct-only |

The Suno window. It carries `Suno-app-window` and `Suno-application-window`,
and contains an `AdwToolbarView` (`Suno-window-toolbar-view`) whose top bar is
an `AdwHeaderBar` carrying `Suno-titlebar` with its own title hidden. Under the
title row sits the window’s layer host (where toasts, dialogs and drawers
appear) around an `AdwBin` carrying `Suno-window-body`. SunoUI draws the frame,
identity and window controls: `Suno_init()` loads SunoUI’s window sheets, and
the window builds its own identity.

- **`_new()`** requires a `GtkApplication`. `context` may be `NULL`. When the
  context is not windowed, the window is undecorated and the title bar hidden;
  with touch input, the window carries `Suno-touch`. If the application has no
  menubar yet, a stable empty `GMenu` is installed so the identity can bind to
  it. The window also binds its compositor backdrop.
- **`_set_body()`** sets the single child of the body. Pass a `SunoPane`, a
  box of panes, or a `SunoAdaptiveScaffold`. Returns (transfer none) from
  `_get_body()`.
- **`_set_identity()`** sets the window title to `title`, or to `subtitle` and
  `title` together when `subtitle` is not empty. The name and icon drawn in the
  corner always come from the desktop entry; `icon_name` is ignored.
- **`_set_menu_model()`** sets the identity menu. The window copies the model’s
  top-level items into the application’s stable menu so the identity stays
  bound; otherwise it calls `gtk_application_set_menubar()`.
- **`_set_leading()`**, **`_set_title_content()`** and **`_set_trailing()`**
  fill the title row’s three slots: one control just after the identity (such
  as the sidebar toggle), what the window is about (after the leading control,
  or centred on the window when `centred` is true), and the window’s own
  actions before the window controls. A new widget replaces the previous one;
  `NULL` clears the slot. `_get_title_bar()` and `_get_layer_host()` return
  (transfer none) the title row and the layer host.
- Presenting an `AdwAlertDialog` on the window gives it the quiet control
  treatment. For a destructive confirmation, prefer SunoUI’s
  `Suno_destructive_dialog_ask()`.
- To give an existing `AdwApplicationWindow` subclass the Suno frame without
  rebuilding it, call `Suno_application_window_frame_adopt()`; its content,
  actions and template children stay in place.

## `SunoPane`

```c
GtkWidget *Suno_pane_new       (void);
void       Suno_pane_set_child (SunoPane *self, GtkWidget *child);
GtkWidget *Suno_pane_get_child (SunoPane *self);
```

A vertical box that expands in both directions and carries `Suno-pane` and
`Suno-island`, so SunoUI draws it as an island. `_set_child()` replaces the one
child and makes it expand. `SunoIsland` (see [SunoUI for C](SunoUI-c.md)) is
the closer twin of the Python `Island`.

## `SunoAdaptiveScaffold`

```c
GtkWidget *Suno_adaptive_scaffold_new                   (void);
void       Suno_adaptive_scaffold_set_sidebar           (SunoAdaptiveScaffold *self,
                                                          GtkWidget *sidebar, const char *title);
void       Suno_adaptive_scaffold_set_content           (SunoAdaptiveScaffold *self,
                                                          GtkWidget *content, const char *title);
void       Suno_adaptive_scaffold_set_compact_width     (SunoAdaptiveScaffold *self, guint width);
void       Suno_adaptive_scaffold_set_sidebar_width_limits (SunoAdaptiveScaffold *self,
                                                          guint minimum_width, guint maximum_width);
void       Suno_adaptive_scaffold_set_sidebar_width     (SunoAdaptiveScaffold *self, guint width);
guint      Suno_adaptive_scaffold_get_sidebar_width     (SunoAdaptiveScaffold *self);
gboolean   Suno_adaptive_scaffold_get_collapsed         (SunoAdaptiveScaffold *self);
void       Suno_adaptive_scaffold_set_show_content      (SunoAdaptiveScaffold *self,
                                                          gboolean show_content);
```

| Property | Type | Range | Default |
| --- | --- | --- | --- |
| `sidebar-width` | `guint` | 120 to 640 | 180 |

An `AdwBreakpointBin` holding an `AdwNavigationSplitView`, carrying
`Suno-adaptive-scaffold`. A breakpoint collapses the split view at
`max-width: 559px` by default, the same phone width every SunoUI part uses.

- **`_set_sidebar()`** and **`_set_content()`** wrap the widget in an
  `AdwNavigationPage` with `title` (used for the back button and accessibility
  when collapsed).
- **`_set_compact_width()`** moves the breakpoint; `width` must be 320 to 1200.
- **`_set_sidebar_width_limits()`** and **`_set_sidebar_width()`** opt into a
  fixed sidebar width in logical pixels. Until you call either, native adaptive
  sizing is unchanged. Limits default to 160 to 320 and must stay within 120 to
  640; the width is clamped to them. The getter returns the configured
  preference, not the current allocation.
- **`_get_collapsed()`** reports whether the split view is collapsed now.
- **`_set_show_content()`** shows the content page when collapsed.

## `SunoActionBar`

```c
GtkWidget  *Suno_action_bar_new          (void);
void        Suno_action_bar_set_title    (SunoActionBar *self, const char *title);
const char *Suno_action_bar_get_title    (SunoActionBar *self);
void        Suno_action_bar_add_leading  (SunoActionBar *self, GtkWidget *widget);
void        Suno_action_bar_add_trailing (SunoActionBar *self, GtkWidget *widget);
GtkWidget  *Suno_action_bar_get_leading  (SunoActionBar *self);
GtkWidget  *Suno_action_bar_get_center   (SunoActionBar *self);
GtkWidget  *Suno_action_bar_get_trailing (SunoActionBar *self);
```

A horizontal bar carrying `Suno-action-bar` with three boxes: leading, an
expanding center that starts with an ellipsizing title label
(`Suno-action-title`), and trailing. Controls added with `_add_leading()` and
`_add_trailing()` are vertically centered. The getters return the boxes
(transfer none) for anything else you need to place.

## `SunoContext`

```c
typedef enum { SUNO_PRESENTATION_WINDOWED, SUNO_PRESENTATION_FULLSCREEN_MOBILE } SunoPresentationMode;
typedef enum { SUNO_INPUT_POINTER, SUNO_INPUT_TOUCH } SunoInputMode;

SunoContext          *Suno_context_new                  (SunoPresentationMode presentation,
                                                          SunoInputMode        input);
SunoContext          *Suno_context_new_from_environment (void);
SunoPresentationMode  Suno_context_get_presentation     (SunoContext *self);
SunoInputMode         Suno_context_get_input            (SunoContext *self);
gboolean              Suno_context_get_decorated        (SunoContext *self);
gboolean              Suno_context_get_touch_targets    (SunoContext *self);
```

| Property | Type | Flags |
| --- | --- | --- |
| `presentation` | `SunoPresentationMode` (nicks `windowed`, `fullscreen-mobile`) | read, write, construct-only |
| `input` | `SunoInputMode` (nicks `pointer`, `touch`) | read, write, construct-only |

An immutable description of how the app is presented.
`_new_from_environment()` starts from the device class: when
`SUNO_DEVICE_CLASS` is `handheld`, or `/etc/Suno-device-class` contains
`handheld`, it defaults to fullscreen and touch; otherwise windowed and pointer.
`SUNO_PRESENTATION_MODE` and `SUNO_INPUT_MODE` override those defaults, and an
invalid value logs a warning and is ignored. `_get_decorated()` is true when
windowed; `_get_touch_targets()` is true for touch input.

Python: `SunoUI.Context.new_from_environment()`. SunoUI’s Python package has its own
`AppContext`, which also treats a `tablet` device class as touch input.

## `SunoSegmentedControl`

```c
GtkWidget  *Suno_segmented_control_new          (void);
void        Suno_segmented_control_append       (SunoSegmentedControl *self,
                                                  const char *id, const char *label);
void        Suno_segmented_control_set_selected (SunoSegmentedControl *self, const char *id);
const char *Suno_segmented_control_get_selected (SunoSegmentedControl *self);
```

| Signal | Signature |
| --- | --- |
| `changed` | `void (*)(SunoSegmentedControl *self, const char *id, gpointer user_data)` |

Homogeneous grouped toggle buttons carrying `Suno-segmented-control`. `id` must
not be empty. The first segment appended is selected. `changed` is emitted when
the selection moves to a different ID.

## `SunoInspectorSection`

```c
GtkWidget *Suno_inspector_section_new          (const char *title);
void       Suno_inspector_section_set_title    (SunoInspectorSection *self, const char *title);
void       Suno_inspector_section_set_child    (SunoInspectorSection *self, GtkWidget *child);
GtkWidget *Suno_inspector_section_get_child    (SunoInspectorSection *self);
void       Suno_inspector_section_set_expanded (SunoInspectorSection *self, gboolean expanded);
gboolean   Suno_inspector_section_get_expanded (SunoInspectorSection *self);
```

| Signal | Signature |
| --- | --- |
| `expanded-changed` | `void (*)(SunoInspectorSection *self, gboolean expanded, gpointer user_data)` |

A vertical section with a disclosure button (chevron and title) and one child
that is shown only when expanded. Starts expanded. The title is also the
disclosure button’s accessible name.

## `SunoColorWell`

```c
GtkWidget     *Suno_color_well_new      (void);
void           Suno_color_well_set_rgba (SunoColorWell *self, const GdkRGBA *rgba);
const GdkRGBA *Suno_color_well_get_rgba (SunoColorWell *self);
void           Suno_color_well_set_text (SunoColorWell *self, const char *text);
const char    *Suno_color_well_get_text (SunoColorWell *self);
```

| Signal | Signature |
| --- | --- |
| `changed` | `void (*)(SunoColorWell *self, gpointer user_data)` |

A `GtkColorDialogButton` (with alpha) beside an entry showing the color as
text. Typing a valid color and pressing Enter applies it; an invalid value is
reverted. `_set_text()` ignores text that does not parse. `changed` is emitted
whenever the color changes.

## `SunoMediaFader`

```c
GtkWidget *Suno_media_fader_new             (GtkOrientation orientation);
void       Suno_media_fader_set_db          (SunoMediaFader *self, double db);
double     Suno_media_fader_get_db          (SunoMediaFader *self);
void       Suno_media_fader_set_reset_db    (SunoMediaFader *self, double db);
double     Suno_media_fader_get_reset_db    (SunoMediaFader *self);
double     Suno_media_fader_db_to_amplitude (double db);
```

A `GtkScale` from −60 dB to +12 dB (step 0.1, page 3) with marks at −∞, 0 and
+12, formatting values in decibels. Double-clicking resets it to the reset
level (default 0 dB). Values are clamped to the range. Use `GtkRange::value-changed`
to follow it. `_db_to_amplitude()` returns 0 at or below −60 dB, otherwise
10^(dB/20). If you construct it with your own `adjustment`, SunoUI leaves that
adjustment’s range alone.

## `SunoAudioMeter`

```c
GtkWidget *Suno_audio_meter_new             (guint channels);
void       Suno_audio_meter_set_channels    (SunoAudioMeter *self, guint channels);
guint      Suno_audio_meter_get_channels    (SunoAudioMeter *self);
void       Suno_audio_meter_set_levels_db   (SunoAudioMeter *self, double left_db, double right_db);
void       Suno_audio_meter_set_levels      (SunoAudioMeter *self, double left, double right);
void       Suno_audio_meter_reset_clip      (SunoAudioMeter *self);
void       Suno_audio_meter_set_clipped     (SunoAudioMeter *self, gboolean clipped);
gboolean   Suno_audio_meter_get_clipped     (SunoAudioMeter *self);
double     Suno_audio_meter_db_to_fraction  (double db);
```

A mono or stereo level meter (`channels` must be 1 or 2) mapping −60 dB to
+12 dB, drawn by SunoUI: a recessed track per channel filled in three zones
(quiet, loud from −18 dB, hot from −6 dB) and a peak tick that holds 1.5 s.
Rises show at once and falls follow meter ballistics (24 dB/s); the meter
animates only while something falls, so a still one costs nothing. Bars run
bottom to top; `Suno_audio_meter_set_horizontal()` runs them left to right, one
under the other, for a mixer row. `_set_levels()` takes linear amplitudes. A
peak at or above 0 dB latches the `clipping` style until `_reset_clip()`. The
accessible value and description are updated in 6 dB steps rather than on
every frame, so screen readers are not flooded.

```c
void       Suno_audio_meter_set_segment_shape (SunoAudioMeter *self, double thickness, double gap, double radius);
void       Suno_audio_meter_get_segment_shape (SunoAudioMeter *self, double *thickness, double *gap, double *radius);
void       Suno_audio_meter_set_zones         (SunoAudioMeter *self, gboolean zones);
gboolean   Suno_audio_meter_get_zones         (SunoAudioMeter *self);
```

A segmented bar takes its own shape: the bar's thickness, the gap between
segments and each segment's corner radius, in px (0, or a negative number,
keeps the token's). `_set_zones(FALSE)` is an output's meter (`.plain`): every
lit segment is the quiet green over the control fill, with no loud or hot zone
and no peak hold. A recording meter keeps its zones.

```c
void       Suno_audio_meter_set_horizontal  (SunoAudioMeter *self, gboolean horizontal);
double     Suno_audio_meter_get_level_db    (SunoAudioMeter *self, guint channel);
double     Suno_audio_meter_get_peak_db     (SunoAudioMeter *self, guint channel);
```

## `SunoVolumeSlider`

```c
GtkWidget      *Suno_volume_slider_new                (GtkOrientation orientation, double lower, double upper);
void            Suno_volume_slider_set_value          (SunoVolumeSlider *self, double value);
double          Suno_volume_slider_get_value          (SunoVolumeSlider *self);
void            Suno_volume_slider_set_range          (SunoVolumeSlider *self, double lower, double upper);
void            Suno_volume_slider_set_steps          (SunoVolumeSlider *self, double step, double page);
void            Suno_volume_slider_set_unity          (SunoVolumeSlider *self, double unity);
void            Suno_volume_slider_set_unit           (SunoVolumeSlider *self, const char *unit);
void            Suno_volume_slider_set_muted          (SunoVolumeSlider *self, gboolean muted);
void            Suno_volume_slider_set_meter_channels (SunoVolumeSlider *self, guint channels);
SunoAudioMeter *Suno_volume_slider_get_meter          (SunoVolumeSlider *self);
void            Suno_volume_slider_get_track_bounds   (SunoVolumeSlider *self, graphene_rect_t *bounds);
/* signal */    void (*moved) (SunoVolumeSlider *self, double value);
```

A volume for mixers and sound rows: the kit's slider (a recessed 4 px track
filled to the value, a raised 14 px knob with a state ring), standing upright
for a channel strip (`GTK_ORIENTATION_VERTICAL`, 160 px natural, 48 px least)
or lying flat for a row. `_set_meter_channels(1|2)` lays a `SunoAudioMeter`
along the track over exactly the track's length (beside it standing, under it
lying, 4 px from the knob), so level and volume read on one scale; feed it
through `_get_meter()`. Across, the slider is the knob, the gap and the meter,
and never less than the 24 px hit width.

Any range works (0–100 %, 0–150 %, −60–+6 dB). A `unity` value inside the
range is marked across the track and a double click returns to it. Arrows
along the slider step by the small step (arrows across it move focus, so a
TV remote walks a column of flat sliders), Page Up/Down by the page step, Home/End go to the
ends, the wheel steps, and a press on the track jumps there and drags. Only
those moves (and an assistive technology's) emit `::moved`; `_set_value()` and
a range that clamps the value do not. Muted, the fill and the meter go quiet
and the knob stays at the volume. The accessible value text uses the unit
("68%", "−6 dB", "…, muted").

Tokens: `--SunoUI-volume-slider-*` / `SUNO_UI_VOLUME_SLIDER_*` (track, knob,
hit, meter gap, length, unity mark, focus). Style nodes:
`SunoUI-volume-slider(.vertical|.horizontal)(.muted)` with
`.SunoUI-volume-track`, `-fill`, `-knob`, `-ring`, `-shadow`, `-mark`, `-focus`.

## `SunoHistogram`

```c
GtkWidget *Suno_histogram_new                   (void);
void       Suno_histogram_set_channels          (SunoHistogram *self, GVariant *channels);
GVariant  *Suno_histogram_get_channels          (SunoHistogram *self);
void       Suno_histogram_set_clipping_visible  (SunoHistogram *self, gboolean visible);
gboolean   Suno_histogram_get_clipping_visible  (SunoHistogram *self);
```

| Property | Type | Default |
| --- | --- | --- |
| `clipping-visible` | `gboolean` | `FALSE` |

A 116px tall histogram. `channels` is a `GVariant` of type `aad` with exactly
four arrays of up to 256 values each; values are normalized to the peak.
`_get_channels()` returns a new reference to the normalized `aad`.
`clipping-visible` shows shadow and highlight clipping.

## `SunoCurveEditor`

```c
GtkWidget *Suno_curve_editor_new        (void);
void       Suno_curve_editor_set_points (SunoCurveEditor *self, GVariant *points);
GVariant  *Suno_curve_editor_get_points (SunoCurveEditor *self);
void       Suno_curve_editor_reset      (SunoCurveEditor *self);
```

| Signal | Signature |
| --- | --- |
| `changed` | `void (*)(SunoCurveEditor *self, gpointer user_data)` |

A draggable tone curve. Points are a `GVariant` of type `a(dd)` with `x` and
`y` from 0 to 1; values are clamped, and a dragged point cannot pass its
neighbors. `_reset()` restores the identity curve.

## `SunoWelcomeView`

```c
GtkWidget *Suno_welcome_view_new             (const char *title, const char *icon_name,
                                               const char *description, const char *noun,
                                               const char *settings_schema);
GtkWidget *Suno_welcome_view_get_new_button  (SunoWelcomeView *self);
GtkWidget *Suno_welcome_view_get_open_button (SunoWelcomeView *self);
gboolean   Suno_welcome_view_should_show     (const char *settings_schema);
```

The welcome surface Suno’s creative apps show when opened without a document:
a panel with the app icon, a “CREATIVE COLLECTION” eyebrow, the title, the
description, **New <noun>** and **Open…** buttons, and a “Show this when
<title> opens” check. Wider than 640px it sits beside a photograph; narrower,
it stacks over a dark scrim. Bind the buttons to your existing New and Open
commands. If `settings_schema` is installed and has a boolean `show-welcome`
key, the check is bound to it and `_should_show()` returns its value; otherwise
the check is disabled and `_should_show()` returns true. The eyebrow text is
fixed, so this view suits apps in Suno’s creative collection.

## `SunoApplicationIcon`

```c
GdkPaintable *Suno_application_icon_new (GdkPaintable *artwork);
```

Returns a new paintable (transfer full) that draws `artwork` on Suno’s square
gradient tile with a rounded mask whose radius is a quarter of the side, and a
faint outline. Use it to show application icons the way the dock does. Do not
use it for file or folder thumbnails.

## `SunoSurfaceBackdrop`

```c
SunoSurfaceBackdrop *Suno_surface_backdrop_new                  (GtkWindow  *window);
gboolean             Suno_surface_backdrop_get_available        (SunoSurfaceBackdrop *self);
gboolean             Suno_surface_backdrop_get_active           (SunoSurfaceBackdrop *self);
gboolean             Suno_surface_backdrop_display_is_available (GdkDisplay *display);
```

| Property | Type | Flags |
| --- | --- | --- |
| `available` | `gboolean` | read-only: the compositor advertises background blur |
| `active` | `gboolean` | read-only: the window has a live blur region now |

Negotiates the `ext-background-effect-v1` Wayland protocol so Frost and Glass
materials can blur what is behind a window, and removes the effect when
accessibility settings or renderer capability require an opaque surface.
`SunoApplicationWindow`, `AppWindow` and `Suno_init()` create these for you;
you only need `_display_is_available()` if you are building a settings surface.

---

## `SunoAppearance-1`

`libSuno-appearance-1` provides `SunoSurfacePolicy`, which decides the
effective surface treatment (`light`, `dark`, `frost` or `glass`) from Suno’s
settings, high contrast, reduced transparency and renderer capability. SunoUI
uses it internally; apps normally never call it. Its header is
`<Suno-appearance.h>` (`pkg-config Suno-appearance-1`).

## Introspection names

| C | Python (`gi.repository`) |
| --- | --- |
| `Suno_init()` | `SunoUI.init()` |
| `Suno_application_window_new()` | `SunoUI.ApplicationWindow.new()` |
| `Suno_context_new_from_environment()` | `SunoUI.Context.new_from_environment()` |
| `SUNO_PRESENTATION_FULLSCREEN_MOBILE` | `SunoUI.PresentationMode.FULLSCREEN_MOBILE` |
| `Suno_welcome_view_should_show()` | `SunoUI.WelcomeView.should_show()` |
