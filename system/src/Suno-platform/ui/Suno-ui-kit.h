/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI core for C: the API level, Lucide icons, the type scale, motion and
 * width. The twin of Suno_appkit/SunoUI.py, icons.py, content_type.py and
 * structure_adapt.py. Apps say *what*; the kit owns *how* (ADR-052,
 * docs/developer/kit/SunoUI-principles.md).
 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SUNO_UI_API_LEVEL:
 *
 * The public SunoUI API level, the same number as Python's
 * `Suno_appkit.SUNOUI_API_LEVEL`. It rises by one whenever a public name, an
 * argument or a toast kind is added; within a level nothing is removed.
 */
#define SUNO_UI_API_LEVEL 13

/**
 * Suno_ui_get_api_level:
 *
 * Returns: %SUNO_UI_API_LEVEL of the library actually loaded.
 */
int Suno_ui_get_api_level(void);

/**
 * Suno_ui_install:
 *
 * Load the kit's stylesheets and icons for the default display, once. Every
 * part calls it on construction, so an app only needs it when it styles
 * something itself before any part exists. Same as Suno_init().
 */
void Suno_ui_install(void);

/**
 * Suno_ui_icon_name:
 * @lucide: a Lucide glyph name, such as "share-2"
 *
 * The stable theme name for a Lucide glyph: "share-2" is
 * "SunoUI-share-2-symbolic". Share is "share-2", Export is "share".
 *
 * Returns: (transfer full): the icon name
 */
char *Suno_ui_icon_name(const char *lucide);

/**
 * Suno_ui_icon_new:
 * @lucide: a Lucide glyph name
 *
 * A #GtkImage of the glyph at the size the kit's CSS gives it.
 *
 * Returns: (transfer floating): a new #GtkImage
 */
GtkWidget *Suno_ui_icon_new(const char *lucide);

/**
 * Suno_ui_apply_type:
 * @widget: a widget, usually a #GtkLabel
 * @role: a type role: "display", "hero", "title-1", "title-2", "lead",
 *   "body", "caption", "label" or "numeric" (the tokens' type scale)
 *
 * Give @widget one type role, replacing any other (class `SunoUI-t-<role>`).
 * An unknown role is refused with a critical.
 */
void Suno_ui_apply_type(GtkWidget *widget, const char *role);

/**
 * Suno_ui_apply_type_full:
 * @widget: a widget
 * @role: a type role
 * @muted: set it in the quiet ink (class `SunoUI-t-muted`)
 *
 * Suno_ui_apply_type() with the muted tone (Python `apply_type(w, role, muted=True)`).
 */
void Suno_ui_apply_type_full(GtkWidget *widget, const char *role, gboolean muted);

/**
 * Suno_ui_reduced_motion:
 *
 * Returns: whether movement should become a fade (the desktop's reduced
 * motion, or animations off)
 */
gboolean Suno_ui_reduced_motion(void);

/**
 * Suno_ui_mobile_form_factor:
 *
 * Resolve phone presentation from SUNO_FORM_FACTOR, then SUNO_DEVICE_CLASS
 * or /etc/Suno-device-class, then the legacy machine-info chassis. Width
 * determines layout separately. Applications should use this shared policy
 * rather than maintaining their own device detection.
 *
 * In TV posture nothing is a phone: the TV presentation replaces the phone one.
 *
 * Returns: whether the current device uses phone presentation
 */
gboolean Suno_ui_mobile_form_factor(void);

/**
 * Suno_ui_tv_posture:
 *
 * Whether the shell is in TV posture, as the system states it: SUNO_POSTURE,
 * then the shell-state `posture` key, then a device that declares itself a
 * television (/etc/Suno-device-class) while that key is automatic. Never
 * inferred from a screen's size. A window follows the live value through its
 * #SunoContext (`tv`); see docs/developer-platform/tv-mode.md. Since API level 8.
 *
 * Returns: %TRUE in TV posture
 */
gboolean Suno_ui_tv_posture(void);

/**
 * Suno_ui_tv_unit:
 * @width: the screen or window width
 * @height: its height
 *
 * One TV layout pixel at this size: min(width/1920, height/1080). Since API level 8.
 *
 * Returns: the unit, 0 for an empty size
 */
double Suno_ui_tv_unit(int width, int height);

/**
 * Suno_ui_set_part:
 * @widget: a widget on a page
 * @part: "header", "back", "hero", "group", "card", "row", "title", "lede", "emblem", "buttons",
 *   "footnote", "ways", "way", "chips", "chip", "swatch", "subject" or %NULL
 *
 * Name the page part @widget is (class `SunoUI-part-<part>`), replacing any
 * other: the page's header (its title and one-line summary), its way back up
 * to the parent page, its hero (the thing itself), a group (a heading over a
 * card), the group's card of rows, or one row (a row that starts with a lead
 * also gets `SunoUI-part-leads`, and the lead `SunoUI-part-lead`); since API level 9 also a page's
 * title and its lede (the line under it), an emblem (the app's mark on a welcome), a row of
 * buttons (laid out in a row on a TV, Left/Right moving through it) and a footnote (on the
 * bottom safe line of a centred window), and ways (alternatives, each a "way": equal cards side
 * by side on a TV), or a row of choices drawn as themselves (chips: a wallpaper's picture is a
 * chip, an accent colour a round swatch; the one in use carries the class `on` or the checked
 * state), or a subject (a row heading its card, the thing it is about, drawn larger; also a "row";
 * the class `SunoUI-away` on it while the thing is out of reach). Nothing changes on a desktop, tablet or
 * phone; in TV posture SunoUI draws the parts at TV size (the floating
 * island's page) and Back activates the page's back part, so an app needs no
 * TV-specific code. An unknown part is
 * refused with a critical. Since API level 8.
 */
void Suno_ui_set_part(GtkWidget *widget, const char *part);

/**
 * Suno_ui_set_keyboard_action:
 * @widget: a text field (or a widget holding one)
 * @label: (nullable): what Enter does here, one short verb ("Join", "Search")
 *
 * Label the system TV keyboard's action key while @widget has the focus
 * (docs/developer-platform/tv-mode.md "Typing"); %NULL or "" returns to the
 * field's own label. Outside TV posture nothing visible changes. Since API level 8.
 */
void Suno_ui_set_keyboard_action(GtkWidget *widget, const char *label);

/**
 * Suno_window_set_tv_frame:
 * @window: an #AdwApplicationWindow
 * @content: (nullable): the window's content widget, laid over the TV room while the frame is active
 * @frame: (nullable): the box holding @sidebar and @island side by side (or @island alone)
 * @sidebar: (nullable): the window's sidebar: a #SunoNavigationSidebar, or any widget holding the
 *   destinations' #GtkListBox (it is then told by its classes: `SunoUI-tv-island`, and
 *   `SunoUI-tv-rail` while folded); %NULL for a centred window (a welcome, an error) with no island
 * @island: (nullable): the page
 *
 * The floating island for any window (docs/developer-platform/tv-mode.md): in TV posture
 * (Suno_window_set_tv_active()) @frame is drawn as the TV frame, the sidebar lifted into the
 * floating island beside the page, or the page centred in the safe area when there is no sidebar.
 * A #SunoApplicationWindow does this itself; toolkits built on other windows (Suno_appkit) call it.
 * %NULL @content, @frame or @island removes the frame. Nothing changes outside TV posture.
 * Since API level 9.
 */
void Suno_window_set_tv_frame(GtkWindow *window, GtkWidget *content, GtkWidget *frame,
                              GtkWidget *sidebar, GtkWidget *island);

/**
 * Suno_window_set_tv_active:
 * @window: a window given a frame by Suno_window_set_tv_frame()
 * @tv: whether the window is in TV posture
 *
 * Draw the window's frame as the TV frame, or restore its own layout exactly. Since API level 9.
 */
void Suno_window_set_tv_active(GtkWindow *window, gboolean tv);

/**
 * Suno_window_get_tv_active:
 * @window: a window
 *
 * Returns: whether the window's TV frame is drawn. Since API level 9.
 */
gboolean Suno_window_get_tv_active(GtkWindow *window);

/**
 * Suno_ui_is_phone_width:
 * @widget: a widget in a window
 *
 * Whether the window @widget is in is phone-width (the v71 phone tier,
 * under 560). Width adapts layout, never identity.
 *
 * Returns: %TRUE at phone width
 */
gboolean Suno_ui_is_phone_width(GtkWidget *widget);

/**
 * SunoTier:
 * @SUNO_TIER_REGULAR: wider than 900: the desktop app
 * @SUNO_TIER_COMPACT: 560 to 900: sidebars fold into drawers, inspectors into sheets
 * @SUNO_TIER_PHONE: under 560: thumb-sized chrome, the phone drawer, list-first
 *
 * The v71 tiers (2026-09-29-mobile-layer-v71.md). Crossing 560 redraws in the
 * other shape.
 */
typedef enum {
  SUNO_TIER_REGULAR,
  SUNO_TIER_COMPACT,
  SUNO_TIER_PHONE,
} SunoTier;
GType Suno_tier_get_type(void);
#define SUNO_TYPE_TIER (Suno_tier_get_type())

/**
 * SUNO_TIER_PHONE_BELOW:
 * A window narrower than this is a phone.
 */
#define SUNO_TIER_PHONE_BELOW 560
/**
 * SUNO_TIER_REGULAR_ABOVE:
 * A window wider than this is regular; from %SUNO_TIER_PHONE_BELOW up to it, compact.
 */
#define SUNO_TIER_REGULAR_ABOVE 900

/**
 * Suno_ui_tier_for_width:
 * @width: a window's width in logical pixels
 *
 * Returns: the tier of a window this wide
 */
SunoTier Suno_ui_tier_for_width(int width);
/**
 * Suno_ui_get_tier:
 * @widget: a widget in a window
 *
 * Returns: the tier of the window @widget is in now (regular before it has a width)
 */
SunoTier Suno_ui_get_tier(GtkWidget *widget);

/**
 * SunoWidthWatch:
 *
 * The window width a widget lives at, after layout (Python `WidthWatch`):
 * #SunoWidthWatch:width, #SunoWidthWatch:tier, and #SunoWidthWatch::tier-changed
 * when a resize, a move or a first showing crosses 560 or 900. A window drawn
 * while hidden redraws in its real shape when it first shows.
 */
#define SUNO_TYPE_WIDTH_WATCH (Suno_width_watch_get_type())
G_DECLARE_FINAL_TYPE(SunoWidthWatch, Suno_width_watch, SUNO, WIDTH_WATCH, GObject)

/**
 * Suno_width_watch_get:
 * @widget: a widget
 *
 * The widget's watch, made on first use and kept as long as @widget lives.
 *
 * Returns: (transfer none): the watch
 */
SunoWidthWatch *Suno_width_watch_get(GtkWidget *widget);
SunoTier Suno_width_watch_get_tier(SunoWidthWatch *self);
int Suno_width_watch_get_width(SunoWidthWatch *self);

/**
 * Suno_ui_count_text:
 * @count: the count
 * @attention: whether it needs attention (unread)
 *
 * What a count badge says: "" for 0, "1,284" for a total, "99+" past the
 * attention cap.
 *
 * Returns: (transfer full): the text
 */
char *Suno_ui_count_text(int count, gboolean attention);

/**
 * Suno_ui_initials:
 * @name: a person's or thing's name
 *
 * One or two letters for a name: "Priya Raman" is "PR"; never a digit or a
 * bracket.
 *
 * Returns: (transfer full): the initials
 */
char *Suno_ui_initials(const char *name);

/**
 * Suno_ui_person_tone:
 * @name: a name
 *
 * The hue a person or thing wears everywhere: one of the category names
 * ("create", "work", "media", "play", "tools"), picked by the name.
 *
 * Returns: (transfer none): the tone
 */
const char *Suno_ui_person_tone(const char *name);

G_END_DECLS
