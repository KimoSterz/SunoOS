/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI creative family (KB-D): the tool bar (v70 .sutools) and its
 * floating variant, the tool palette (#vw-pal).
 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoToolBarKind:
 * @SUNO_TOOL_BAR_KIND_BAR: the 40 px raised strip docked at the bottom of a
 *   #SunoCreativeWorkspace; the chosen tool is raised (a state, never the key)
 * @SUNO_TOOL_BAR_KIND_PALETTE: the floating palette over a picture (Viewer's
 *   mark-up tools); 36 px tools, the chosen one is the key
 */
typedef enum {
  SUNO_TOOL_BAR_KIND_BAR,
  SUNO_TOOL_BAR_KIND_PALETTE,
} SunoToolBarKind;

GType Suno_tool_bar_kind_get_type(void) G_GNUC_CONST;
#define SUNO_TYPE_TOOL_BAR_KIND (Suno_tool_bar_kind_get_type())

/**
 * SunoToolBar:
 *
 * The tools of a creative app, one of which is current. Each tool has a
 * Lucide glyph, a name and a one-key shortcut, shown as "Move · V". A
 * flyout groups alternatives (Rectangle, Ellipse, Line) behind one tool
 * that shows the member last chosen and a corner mark; pressing it opens
 * the flyout (a drawer on a phone). Arrows move between tools; the
 * shortcut keys choose them anywhere in the window, except while typing.
 *
 * Emits #SunoToolBar::tool-changed when a person picks a tool, never for
 * Suno_tool_bar_set_current().
 *
 * Tree: box.SunoUI-creative-tools(.bar|.palette)
 *   ├ button.SunoUI-creative-tool(.on)(.flyout) > overlay > image (+ box.SunoUI-creative-tool-more)
 *   └ separator.SunoUI-creative-tools-separator
 */
#define SUNO_TYPE_TOOL_BAR (Suno_tool_bar_get_type())
G_DECLARE_FINAL_TYPE(SunoToolBar, Suno_tool_bar, SUNO, TOOL_BAR, GtkBox)

/**
 * Suno_tool_bar_new:
 * @kind: the bar or the palette
 *
 * Returns: (transfer floating): a new, empty tool bar
 */
GtkWidget *Suno_tool_bar_new(SunoToolBarKind kind);

/**
 * Suno_tool_bar_add_tool:
 * @self: a tool bar
 * @key: the tool's stable key ("move")
 * @icon: a Lucide glyph ("mouse-pointer-2")
 * @label: its name ("Move")
 * @shortcut: (nullable): its one key ("V"), or %NULL
 *
 * Add a tool. The first tool added is current until another is chosen.
 */
void Suno_tool_bar_add_tool(SunoToolBar *self, const char *key, const char *icon, const char *label,
                            const char *shortcut);

/**
 * Suno_tool_bar_add_flyout:
 * @self: a tool bar
 * @key: the group's key ("shape")
 * @label: its name ("Shapes")
 *
 * Add a flyout; give it members with Suno_tool_bar_add_flyout_tool(). The
 * group shows its first member until another is chosen.
 */
void Suno_tool_bar_add_flyout(SunoToolBar *self, const char *key, const char *label);

/**
 * Suno_tool_bar_add_flyout_tool:
 * @self: a tool bar
 * @flyout: a flyout's key
 * @key: the tool's key ("ellipse")
 * @icon: a Lucide glyph ("circle")
 * @label: its name ("Ellipse")
 * @shortcut: (nullable): its one key ("O")
 */
void Suno_tool_bar_add_flyout_tool(SunoToolBar *self, const char *flyout, const char *key, const char *icon,
                                   const char *label, const char *shortcut);

/**
 * Suno_tool_bar_add_separator:
 * @self: a tool bar
 *
 * A hairline between groups of tools (making tools and viewing tools).
 */
void Suno_tool_bar_add_separator(SunoToolBar *self);

/**
 * Suno_tool_bar_set_current:
 * @self: a tool bar
 * @key: a tool's key (a flyout member's, not the flyout's)
 */
void Suno_tool_bar_set_current(SunoToolBar *self, const char *key);
const char *Suno_tool_bar_get_current(SunoToolBar *self);

/**
 * Suno_tool_bar_open_flyout:
 * @self: a tool bar
 * @flyout: a flyout's key
 *
 * Open a flyout as a person pressing it would.
 */
void Suno_tool_bar_open_flyout(SunoToolBar *self, const char *flyout);

/**
 * Suno_tool_bar_activate_shortcut:
 * @self: a tool bar
 * @key: a key name ("v" or "V")
 *
 * Choose the tool whose shortcut is @key, as pressing it would.
 *
 * Returns: whether a tool had that shortcut
 */
gboolean Suno_tool_bar_activate_shortcut(SunoToolBar *self, const char *key);

G_END_DECLS
