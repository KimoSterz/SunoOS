/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI creative family (KB-D) internals; not installed.
 */
#pragma once

#include "Suno-ui-private.h"
#include "Suno-ui.h"

G_BEGIN_DECLS

/* The creative tokens (config/shared/design-tokens.d/creative.json) the C
 * code needs for layout reach it as SUNO_UI_CREATIVE_* from
 * Suno-ui-tokens-private.h; everything else is CSS. */

/* Load Suno-appkit-creative.css once for the display; it is parsed again
 * whenever the kit's tokens change (Suno_ui_add_style_resource). Every
 * creative part calls it on construction. */
void Suno_creative_install(void);

/* A detailed action on @widget, or a critical when the name is malformed. */
void Suno_creative_activate_detailed(GtkWidget *widget, const char *detailed_action);
/* Activate @name (with @target, floating refs are sunk) from @widget, asking each
 * ancestor in turn until one resolves it. Returns whether one did. */
gboolean Suno_creative_activate_action(GtkWidget *widget, const char *name, GVariant *target);

/* A segment well (v70 .seg): box.<css_class> > overlay > (box track, box
 * .SunoUI-creative-tabs-indicator, box .SunoUI-creative-tabs-row). The row holds
 * the segments (equal widths); the raised chip is the indicator under the
 * current one, as v70's i.ind. Arrows move between segments and choose them. */
GtkWidget *Suno_creative_segments_new(const char *css_class);
GtkWidget *Suno_creative_segments_get_row(GtkWidget *segments);
/* Put the chip under segment @index (-1: none, the selection disagrees). */
void Suno_creative_segments_set_index(GtkWidget *segments, int index);

G_END_DECLS
