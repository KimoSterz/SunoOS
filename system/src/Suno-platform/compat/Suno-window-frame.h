/* SPDX-License-Identifier: Apache-2.0
 * Shared App Kit frame geometry for native compatibility renderers.
 * No toolkit, process, input injection or client-content copying is required.
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <math.h>
#include "Suno-frame-tokens.h"

typedef struct { int x, y, width, height; } SunoFrameRect;
typedef struct {
    SunoFrameRect outer, content;
    int header;
    bool decorated;
} SunoWindowFrame;

static inline SunoWindowFrame
Suno_window_frame(int content_width, int content_height, int header, bool decorated)
{
    int gap = decorated ? SUNO_FRAME_GAP : 0;
    SunoWindowFrame f = {{0, 0, 0, 0}, {0, 0, 0, 0}, 0, false};
    f.decorated = decorated;
    f.header = decorated ? header : 0;
    f.content = (SunoFrameRect){gap, f.header, content_width, content_height};
    f.outer = (SunoFrameRect){0, 0, content_width + gap * 2,
                            content_height + f.header + gap};
    return f;
}

/* Fit a composed Android canvas in the content area without changing its
 * display size. Viewporter scales the existing buffer; input uses the inverse.
 */
static inline SunoFrameRect
Suno_frame_fit(SunoFrameRect area, int source_width, int source_height)
{
    if (source_width < 1 || source_height < 1 || area.width < 1 || area.height < 1)
        return (SunoFrameRect){area.x, area.y, 0, 0};
    double scale = fmin((double)area.width / source_width,
                        (double)area.height / source_height);
    int width = (int)fmax(1, floor(source_width * scale));
    int height = (int)fmax(1, floor(source_height * scale));
    return (SunoFrameRect){area.x + (area.width - width) / 2,
                           area.y + (area.height - height) / 2, width, height};
}

static inline double
Suno_frame_distance(double x, double y, SunoFrameRect r, double radius)
{
    radius = fmin(radius, fmin(r.width, r.height) / 2.0);
    double qx = fabs(x - (r.x + r.width / 2.0)) - (r.width / 2.0 - radius);
    double qy = fabs(y - (r.y + r.height / 2.0)) - (r.height / 2.0 - radius);
    return hypot(fmax(qx, 0), fmax(qy, 0)) + fmin(fmax(qx, qy), 0) - radius;
}

static inline double Suno_frame_coverage(double distance)
{
    return fmin(1, fmax(0, 0.5 - distance));
}

/* Two-layer App Kit elevation, from the same tokens as native surfaces.
 * The signed-distance Gaussian is evaluated only in the exposed gutter. */
static inline double Suno_frame_shadow(SunoFrameRect r, double radius,
                                       double x, double y, bool dark)
{
    double near_y = dark ? SUNO_FRAME_DARK_SHADOW_NEAR_Y : SUNO_FRAME_LIGHT_SHADOW_NEAR_Y;
    double blur = dark ? SUNO_FRAME_DARK_SHADOW_NEAR_BLUR : SUNO_FRAME_LIGHT_SHADOW_NEAR_BLUR;
    double opacity = dark ? SUNO_FRAME_DARK_SHADOW_NEAR_ALPHA : SUNO_FRAME_LIGHT_SHADOW_NEAR_ALPHA;
    double a = opacity * 0.5 * erfc(Suno_frame_distance(x, y - near_y, r, radius) / (blur * 0.70710678118));
    int spread = dark ? SUNO_FRAME_DARK_SHADOW_FAR_SPREAD : SUNO_FRAME_LIGHT_SHADOW_FAR_SPREAD;
    SunoFrameRect far = {r.x - spread, r.y - spread,
                         r.width + 2 * spread, r.height + 2 * spread};
    if (far.width > 0 && far.height > 0) {
        double far_y = dark ? SUNO_FRAME_DARK_SHADOW_FAR_Y : SUNO_FRAME_LIGHT_SHADOW_FAR_Y;
        blur = dark ? SUNO_FRAME_DARK_SHADOW_FAR_BLUR : SUNO_FRAME_LIGHT_SHADOW_FAR_BLUR;
        opacity = dark ? SUNO_FRAME_DARK_SHADOW_FAR_ALPHA : SUNO_FRAME_LIGHT_SHADOW_FAR_ALPHA;
        double b = opacity * 0.5 * erfc(Suno_frame_distance(x, y - far_y, far, fmax(0, radius + spread)) / (blur * 0.70710678118));
        a += b * (1 - a);
    }
    return a;
}

/* The same SunoUI frame palette used by the native toolkit sheets. */
typedef enum { SUNO_FRAME_LIGHT, SUNO_FRAME_DARK, SUNO_FRAME_FROST, SUNO_FRAME_GLASS } SunoFrameMaterial;
typedef struct {
    uint32_t top, bottom, ink, muted, hover, close_hover, close_ink, edge;
} SunoFrameStyle;
#define SUNO_FRAME_STYLE(M) ((SunoFrameStyle){SUNO_FRAME_##M##_WINDOW_TOP, \
    SUNO_FRAME_##M##_WINDOW_BOTTOM, SUNO_FRAME_##M##_FRAME_INK, \
    SUNO_FRAME_##M##_FRAME_MUTED, SUNO_FRAME_##M##_WINDOW_CONTROL_HOVER, \
    SUNO_FRAME_##M##_WINDOW_CLOSE_HOVER, SUNO_FRAME_##M##_WINDOW_CLOSE_HOVER_INK, \
    SUNO_FRAME_##M##_ISLAND_EDGE})
static inline SunoFrameStyle Suno_frame_style(SunoFrameMaterial material)
{
    switch (material) {
    case SUNO_FRAME_DARK: return SUNO_FRAME_STYLE(DARK);
    case SUNO_FRAME_FROST: return SUNO_FRAME_STYLE(FROST);
    case SUNO_FRAME_GLASS: return SUNO_FRAME_STYLE(GLASS);
    default: return SUNO_FRAME_STYLE(LIGHT);
    }
}
#undef SUNO_FRAME_STYLE

static inline uint32_t Suno_frame_premultiply(uint32_t color, double coverage)
{
    unsigned a = (unsigned)lround((color >> 24) * coverage);
    return (a << 24) | ((((color >> 16) & 255) * a / 255) << 16) |
        ((((color >> 8) & 255) * a / 255) << 8) | ((color & 255) * a / 255);
}
static inline uint32_t Suno_frame_over(uint32_t below, uint32_t above)
{
    unsigned inverse = 255 - (above >> 24);
    uint32_t out = 0;
    for (unsigned shift = 0; shift <= 24; shift += 8) {
        unsigned channel = ((above >> shift) & 255) + ((below >> shift) & 255) * inverse / 255;
        out |= (channel > 255 ? 255 : channel) << shift;
    }
    return out;
}

/* Transparent island interior keeps Android's real surface and input owner.
 * Maximized windows keep SunoUI's current corner treatment; fullscreen and
 * handheld bypass decoration at the caller. */
static inline uint32_t Suno_frame_pixel_material(SunoWindowFrame f, int x, int y,
                                                SunoFrameMaterial material)
{
    if (!f.decorated || x < 0 || y < 0 || x >= f.outer.width || y >= f.outer.height)
        return 0;
    /* Most of an application window is untouched Android content. Avoid
     * distance/gradient work in that area during interactive resizing. */
    if (x >= f.content.x + SUNO_FRAME_ISLAND_RADIUS + 2 &&
            x < f.content.x + f.content.width - SUNO_FRAME_ISLAND_RADIUS - 2 &&
            y >= f.content.y + SUNO_FRAME_ISLAND_RADIUS + 2 &&
            y < f.content.y + f.content.height - SUNO_FRAME_ISLAND_RADIUS - 2)
        return 0;
    double outer = Suno_frame_coverage(Suno_frame_distance(
        x + 0.5, y + 0.5, f.outer, SUNO_FRAME_WINDOW_RADIUS));
    double distance = Suno_frame_distance(x + 0.5, y + 0.5, f.content, SUNO_FRAME_ISLAND_RADIUS);
    double hole = Suno_frame_coverage(distance);
    if (hole == 1 && distance < -1.5) return 0;
    SunoFrameStyle style = Suno_frame_style(material);
    uint32_t top = Suno_frame_premultiply(style.top, outer * (1 - hole));
    uint32_t bottom = Suno_frame_premultiply(style.bottom, outer * (1 - hole));
    double progress = (double)y / (f.outer.height > 1 ? f.outer.height - 1 : 1);
    uint32_t gradient = 0;
    for (unsigned shift = 0; shift <= 24; shift += 8)
        gradient |= (uint32_t)lround(((top >> shift) & 255) * (1 - progress) +
                                    ((bottom >> shift) & 255) * progress) << shift;
    double edge = outer * hole * Suno_frame_coverage(-distance - 1);
    return Suno_frame_over(gradient, Suno_frame_premultiply(style.edge, edge));
}
static inline uint32_t Suno_frame_pixel(SunoWindowFrame f, int x, int y, bool dark, bool maximized)
{
    (void)maximized;
    return Suno_frame_pixel_material(f, x, y, dark ? SUNO_FRAME_DARK : SUNO_FRAME_LIGHT);
}

/* Individual 30px SunoUI controls, two pixels apart. Back sits immediately
 * before Minimize with the title row's shared slot spacing. */
static inline SunoFrameRect Suno_frame_controls(SunoWindowFrame f)
{
    int width = 3 * SUNO_FRAME_CONTROL_SIZE + 2 * SUNO_FRAME_CONTROL_GAP;
    return (SunoFrameRect){f.outer.width - SUNO_FRAME_CONTROL_INSET - width,
                          (f.header - SUNO_FRAME_CONTROL_SIZE) / 2,
                          width, SUNO_FRAME_CONTROL_SIZE};
}
static inline SunoFrameRect Suno_frame_back(SunoWindowFrame f)
{
    SunoFrameRect controls = Suno_frame_controls(f);
    return (SunoFrameRect){controls.x - SUNO_FRAME_BACK_GAP - SUNO_FRAME_CONTROL_SIZE,
                          controls.y, SUNO_FRAME_CONTROL_SIZE, SUNO_FRAME_CONTROL_SIZE};
}
/* Optional application compatibility action. Ordinary native window controls
 * keep their existing geometry and hit targets. Android opts into this slot. */
static inline SunoFrameRect Suno_frame_settings(SunoWindowFrame f)
{
    SunoFrameRect back = Suno_frame_back(f);
    back.x -= SUNO_FRAME_CONTROL_GAP + SUNO_FRAME_CONTROL_SIZE;
    return back;
}
/* 0 Minimize, 1 Maximize, 2 Close, 3 Android Back. */
static inline SunoFrameRect Suno_frame_control(SunoWindowFrame f, unsigned index)
{
    if (index == 3) return Suno_frame_back(f);
    SunoFrameRect r = Suno_frame_controls(f);
    r.x += (int)index * (SUNO_FRAME_CONTROL_SIZE + SUNO_FRAME_CONTROL_GAP);
    r.width = SUNO_FRAME_CONTROL_SIZE;
    return r;
}
static inline int Suno_frame_control_at(SunoWindowFrame f, int x, int y)
{
    if (!f.decorated) return -1;
    for (unsigned index = 0; index < 4; ++index) {
        SunoFrameRect r = Suno_frame_control(f, index);
        if (x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
            return (int)index;
    }
    return -1;
}
static inline uint32_t Suno_frame_button_pixel(SunoFrameRect r, int x, int y,
                                               SunoFrameMaterial material, bool close)
{
    SunoFrameStyle style = Suno_frame_style(material);
    double coverage = Suno_frame_coverage(Suno_frame_distance(
        x + 0.5, y + 0.5, r, SUNO_FRAME_CONTROL_RADIUS));
    return Suno_frame_premultiply(close ? style.close_hover : style.hover, coverage);
}

/* Values deliberately match xdg_toplevel.resize_edge, allowing a native
 * compositor resize with the real input serial; no synthetic drag machinery. */
static inline unsigned Suno_frame_resize_edge(SunoWindowFrame f, int x, int y,
                                               bool maximized)
{
    if (!f.decorated || maximized || x < 0 || y < 0 ||
        x >= f.outer.width || y >= f.outer.height) return 0;
    int band = SUNO_FRAME_RESIZE_BAND, corner = SUNO_FRAME_RESIZE_CORNER;
    bool left = x < band, right = x >= f.outer.width - band;
    bool top = y < band, bottom = y >= f.outer.height - band;
    if ((left || right) && y < corner) top = true;
    if ((left || right) && y >= f.outer.height - corner) bottom = true;
    if ((top || bottom) && x < corner) left = true;
    if ((top || bottom) && x >= f.outer.width - corner) right = true;
    return (top ? 1u : bottom ? 2u : 0u) | (left ? 4u : right ? 8u : 0u);
}

#include "Suno-frame-glyphs.h"
