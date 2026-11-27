/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI creative family (KB-D): the creative suite's work area and its
 * floating panels (v70 .suwork, .supanel, .supill). Canvas, Grid, Stage,
 * Session and Write build their windows from these; Python reaches them
 * through gi.repository.SunoUI (Suno_appkit.creative_workspace).
 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoPanelSide:
 * @SUNO_PANEL_SIDE_LEFT: the left panel (layers, outline, sheets; 244 px)
 * @SUNO_PANEL_SIDE_RIGHT: the right panel (the inspector; 268 px)
 * @SUNO_PANEL_SIDE_BOTTOM: the bottom dock, a row above the tools between
 *   the side docks (mixers, meters, timelines)
 *
 * Which side of a #SunoCreativeWorkspace a #SunoFloatingPanel floats on.
 */
typedef enum {
  SUNO_PANEL_SIDE_LEFT,
  SUNO_PANEL_SIDE_RIGHT,
  SUNO_PANEL_SIDE_BOTTOM,
} SunoPanelSide;

GType Suno_panel_side_get_type(void) G_GNUC_CONST;
#define SUNO_TYPE_PANEL_SIDE (Suno_panel_side_get_type())

/**
 * SunoFloatingPanel:
 *
 * A panel floating over the work (v70 .supanel): a header, optional tabs,
 * and a scrolling body. It folds to a pill naming what it holds ("Page 1 ·
 * 12 layers"), and a person unfolds it again from the pill. On a phone the
 * open panel is a bottom drawer and only one is open at a time; Esc folds
 * it.
 *
 * The header says *what* the panel is about:
 * - with a title menu (Suno_floating_panel_set_title_menu()), the title is a
 *   picker with a chevron (the page picker, .suph1), and no icon leads;
 * - otherwise the icon leads, and the title is a label or, when editable, a
 *   name field (the inspector's subject, .suinsph), which emits
 *   #SunoFloatingPanel::renamed.
 *
 * Tree: box.SunoUI-creative-panel(.left|.right)(.folded)(.gone)(.drawer)
 *   ├ box.SunoUI-creative-panel-card
 *   │   ├ box.SunoUI-creative-handle
 *   │   ├ box.SunoUI-creative-panel-header(.menu)
 *   │   │   ├ image.SunoUI-creative-panel-icon
 *   │   │   ├ label | button | entry .SunoUI-creative-panel-title
 *   │   │   ├ button.SunoUI-creative-panel-button.more
 *   │   │   └ button.SunoUI-creative-panel-button.close
 *   │   ├ box.SunoUI-creative-tabs > button.SunoUI-creative-tab …
 *   │   └ scrolledwindow.SunoUI-creative-panel-scroll > viewport > stack
 *   └ button.SunoUI-creative-pill > box > image, label.SunoUI-creative-pill-title,
 *                                         label.SunoUI-creative-pill-summary
 */
#define SUNO_TYPE_FLOATING_PANEL (Suno_floating_panel_get_type())
G_DECLARE_FINAL_TYPE(SunoFloatingPanel, Suno_floating_panel, SUNO, FLOATING_PANEL, GtkBox)

/**
 * Suno_floating_panel_new:
 * @title: what it holds ("Page 1", "Rectangle 4", "Outline")
 * @icon: a Lucide glyph for the pill and the header ("layers")
 *
 * Returns: (transfer floating): a new, open, empty panel
 */
GtkWidget *Suno_floating_panel_new(const char *title, const char *icon);

/**
 * Suno_floating_panel_set_header_actions:
 * @self: a floating panel
 * @actions: (nullable): unparented actions after the title; NULL removes them
 *
 * Keep the same action widgets when the header title or folded state changes.
 */
void Suno_floating_panel_set_header_actions(SunoFloatingPanel *self, GtkWidget *actions);

void Suno_floating_panel_set_title(SunoFloatingPanel *self, const char *title);
const char *Suno_floating_panel_get_title(SunoFloatingPanel *self);
/**
 * Suno_floating_panel_set_icon:
 * @self: a panel
 * @icon: a Lucide glyph
 */
void Suno_floating_panel_set_icon(SunoFloatingPanel *self, const char *icon);

/**
 * Suno_floating_panel_set_summary:
 * @self: a panel
 * @summary: (nullable): the quiet words after the title on the pill
 *   ("12 layers", "5 headings")
 */
void Suno_floating_panel_set_summary(SunoFloatingPanel *self, const char *summary);

/**
 * Suno_floating_panel_set_holds:
 * @self: a panel
 * @holds: (nullable): what the panel holds, for its Hide button ("layers",
 *   "outline", "inspector": "Hide layers"). By default, the first tab's name,
 *   or the title.
 */
void Suno_floating_panel_set_holds(SunoFloatingPanel *self, const char *holds);

/**
 * Suno_floating_panel_set_title_menu:
 * @self: a panel
 * @menu: (nullable): what the title picks between (pages, sheets); its
 *   actions are activated on the panel
 *
 * Make the title a picker (.suph1). %NULL makes it a plain title again.
 */
void Suno_floating_panel_set_title_menu(SunoFloatingPanel *self, GMenuModel *menu);

/**
 * Suno_floating_panel_set_title_editable:
 * @self: a panel
 * @editable: whether a person can rename the subject in the header
 *
 * The inspector's name field (.suname): Enter or leaving it commits and
 * emits #SunoFloatingPanel::renamed; Esc puts the name back.
 */
void Suno_floating_panel_set_title_editable(SunoFloatingPanel *self, gboolean editable);

/**
 * Suno_floating_panel_set_more_menu:
 * @self: a panel
 * @menu: (nullable): the subject's More menu (the ellipsis button)
 */
void Suno_floating_panel_set_more_menu(SunoFloatingPanel *self, GMenuModel *menu);

/**
 * Suno_floating_panel_set_closable:
 * @self: a panel
 * @closable: whether the header has the Hide button (panel-left on the left,
 *   panel-right on the right, x in a phone's drawer). A drawer can always
 *   be closed, closable or not.
 */
void Suno_floating_panel_set_closable(SunoFloatingPanel *self, gboolean closable);

/**
 * Suno_floating_panel_add_page:
 * @self: a panel
 * @key: the page's stable key ("layers")
 * @label: its tab's name ("Layers")
 * @child: what it shows; it scrolls in the panel
 *
 * Add a page. With two or more pages the panel shows its tabs (.sutabs);
 * with one, just the page. The first page added is current.
 */
void Suno_floating_panel_add_page(SunoFloatingPanel *self, const char *key, const char *label, GtkWidget *child);

/**
 * Suno_floating_panel_set_child:
 * @self: a panel
 * @child: (nullable): the panel's one page
 *
 * A panel without tabs: replaces every page with @child.
 */
void Suno_floating_panel_set_child(SunoFloatingPanel *self, GtkWidget *child);

/**
 * Suno_floating_panel_set_page:
 * @self: a panel
 * @key: a page's key
 *
 * Show a page without emitting #SunoFloatingPanel::page-changed.
 */
void Suno_floating_panel_set_page(SunoFloatingPanel *self, const char *key);
const char *Suno_floating_panel_get_page(SunoFloatingPanel *self);

/**
 * Suno_floating_panel_set_folded:
 * @self: a panel
 * @folded: whether it is folded to its pill
 */
void Suno_floating_panel_set_folded(SunoFloatingPanel *self, gboolean folded);
gboolean Suno_floating_panel_get_folded(SunoFloatingPanel *self);

SunoPanelSide Suno_floating_panel_get_side(SunoFloatingPanel *self);

/**
 * Suno_floating_panel_get_is_drawer:
 * @self: a panel
 *
 * Returns: whether the panel is open as a phone's bottom drawer
 */
gboolean Suno_floating_panel_get_is_drawer(SunoFloatingPanel *self);

/**
 * SunoCreativeWorkspace:
 *
 * The creative suite's work area (v70 .suwork): the canvas ground with its
 * dot grid, the app's own content, a left and a right #SunoFloatingPanel, a
 * #SunoToolBar docked at the bottom centre, and a zoom control in the bottom
 * right corner.
 *
 * The workspace owns the placement: panels float 10 px in from the top
 * corners and stop above the tool bar; in focus mode (#SunoCreativeWorkspace:focused)
 * the panels and zoom slide and fade away while the tools stay. At phone
 * width the panels fold to their pills; an unfolded one is a bottom drawer
 * (72 % of the height at most), one at a time, and the zoom control leaves.
 *
 * The dot grid follows the content's camera: Suno_creative_workspace_set_camera().
 *
 * Docks: besides the one left and right panel, an app can dock any number
 * of keyed panels (Suno_creative_workspace_add_panel()) on the left, the
 * right or the bottom. Side docks stack their panels top to bottom; open
 * ones share the height, folded ones are pills. The bottom dock is a row
 * between the side docks, above the tools, at most 40 % of the height. A
 * person moves a docked panel by dragging its header to another dock (a
 * strip shows where it lands), or from its More menu (Move up/down, Dock on
 * the left/right/at the bottom), which is also the keyboard's way. The
 * arrangement is a layout: Suno_creative_workspace_get_layout() and
 * Suno_creative_workspace_set_layout() save and restore it, and
 * #SunoCreativeWorkspace::layout-changed says when a person changed it, so
 * an app keeps named layouts (presets) by storing the variants.
 *
 * Tree: widget.SunoUI-creative-workspace(.phone)(.focused)
 *   ├ widget.SunoUI-creative-grid   (the dot colour; painted by the workspace)
 *   ├ content
 *   ├ box.SunoUI-creative-panel(.left|.right|.bottom) … (dock order)
 *   ├ box.SunoUI-creative-dock-target(.left|.right|.bottom)  (while a panel is dragged)
 *   ├ zoom (.SunoUI-creative-zoom)
 *   └ box.SunoUI-creative-tools
 */
#define SUNO_TYPE_CREATIVE_WORKSPACE (Suno_creative_workspace_get_type())
G_DECLARE_FINAL_TYPE(SunoCreativeWorkspace, Suno_creative_workspace, SUNO, CREATIVE_WORKSPACE, GtkWidget)

/**
 * Suno_creative_workspace_new:
 * @content: (nullable): the work: the canvas, sheet, slide or page; it
 *   fills the workspace under the panels and should leave its ground clear
 *
 * Returns: (transfer floating): a new workspace
 */
GtkWidget *Suno_creative_workspace_new(GtkWidget *content);

void Suno_creative_workspace_set_content(SunoCreativeWorkspace *self, GtkWidget *content);
/**
 * Suno_creative_workspace_get_content:
 * @self: a workspace
 * Returns: (transfer none) (nullable): the content
 */
GtkWidget *Suno_creative_workspace_get_content(SunoCreativeWorkspace *self);

/**
 * Suno_creative_workspace_set_left:
 * @self: a workspace
 * @panel: (nullable): the left panel
 */
void Suno_creative_workspace_set_left(SunoCreativeWorkspace *self, SunoFloatingPanel *panel);
/**
 * Suno_creative_workspace_get_left:
 * @self: a workspace
 * Returns: (transfer none) (nullable): the left panel
 */
SunoFloatingPanel *Suno_creative_workspace_get_left(SunoCreativeWorkspace *self);
/**
 * Suno_creative_workspace_set_right:
 * @self: a workspace
 * @panel: (nullable): the right panel (the inspector)
 */
void Suno_creative_workspace_set_right(SunoCreativeWorkspace *self, SunoFloatingPanel *panel);
/**
 * Suno_creative_workspace_get_right:
 * @self: a workspace
 * Returns: (transfer none) (nullable): the right panel
 */
SunoFloatingPanel *Suno_creative_workspace_get_right(SunoCreativeWorkspace *self);
/**
 * Suno_creative_workspace_add_panel:
 * @self: a workspace
 * @key: the panel's stable key in layouts ("widgets", "inspector", "audio")
 * @panel: an unparented panel
 * @side: the dock it starts in; it goes last there
 *
 * Dock a panel. It becomes movable: its header drags it to another dock,
 * and its More menu lists where it can go. Suno_creative_workspace_set_left()
 * and _set_right() are this with the keys "left" and "right".
 */
void Suno_creative_workspace_add_panel(SunoCreativeWorkspace *self, const char *key, SunoFloatingPanel *panel,
                                       SunoPanelSide side);
/**
 * Suno_creative_workspace_remove_panel:
 * @self: a workspace
 * @key: a docked panel's key; an unknown key does nothing
 */
void Suno_creative_workspace_remove_panel(SunoCreativeWorkspace *self, const char *key);
/**
 * Suno_creative_workspace_get_panel:
 * @self: a workspace
 * @key: a docked panel's key
 *
 * Returns: (transfer none) (nullable): the panel
 */
SunoFloatingPanel *Suno_creative_workspace_get_panel(SunoCreativeWorkspace *self, const char *key);
/**
 * Suno_creative_workspace_move_panel:
 * @self: a workspace
 * @key: a docked panel's key
 * @side: the dock to move it to
 * @index: its place there (0 first); -1 or past the end puts it last
 *
 * Emits #SunoCreativeWorkspace::layout-changed.
 */
void Suno_creative_workspace_move_panel(SunoCreativeWorkspace *self, const char *key, SunoPanelSide side,
                                        int index);
/**
 * Suno_creative_workspace_get_layout:
 * @self: a workspace
 *
 * The docked panels as `a(ssb)`: (key, "left" | "right" | "bottom",
 * folded) in dock order. At phone width, the folding is the computer's.
 *
 * Returns: (transfer full): the layout
 */
GVariant *Suno_creative_workspace_get_layout(SunoCreativeWorkspace *self);
/**
 * Suno_creative_workspace_set_layout:
 * @self: a workspace
 * @layout: an `a(ssb)` from Suno_creative_workspace_get_layout()
 *
 * Restore a layout. Keys the workspace doesn't have are skipped, and its
 * panels the layout doesn't name stay where they are, after the named ones.
 *
 * Returns: %FALSE when @layout is not an `a(ssb)`
 */
gboolean Suno_creative_workspace_set_layout(SunoCreativeWorkspace *self, GVariant *layout);
/**
 * Suno_creative_workspace_get_work_area:
 * @self: a workspace
 * @x: (out) (optional): left
 * @y: (out) (optional): top
 * @width: (out) (optional): width
 * @height: (out) (optional): height
 *
 * The part of the work no open docked panel or the tools cover, as of the
 * last allocation. See #SunoCreativeWorkspace::work-area-changed.
 */
void Suno_creative_workspace_get_work_area(SunoCreativeWorkspace *self, int *x, int *y, int *width, int *height);

/**
 * Suno_creative_workspace_set_tools:
 * @self: a workspace
 * @tools: (nullable): the tool bar, usually a #SunoToolBar
 */
void Suno_creative_workspace_set_tools(SunoCreativeWorkspace *self, GtkWidget *tools);

/**
 * Suno_creative_workspace_set_zoom:
 * @self: a workspace
 * @zoom: (nullable): the zoom control for the bottom right corner (the
 *   kit's zoom pill); it leaves in focus mode and at phone width
 */
void Suno_creative_workspace_set_zoom(SunoCreativeWorkspace *self, GtkWidget *zoom);

/**
 * Suno_creative_workspace_set_focused:
 * @self: a workspace
 * @focused: focus mode: only the work and its tools stay
 */
void Suno_creative_workspace_set_focused(SunoCreativeWorkspace *self, gboolean focused);
gboolean Suno_creative_workspace_get_focused(SunoCreativeWorkspace *self);

/**
 * Suno_creative_workspace_set_camera:
 * @self: a workspace
 * @zoom: the content's scale (1 is 100 %)
 * @x: the content origin's x in the workspace, in pixels
 * @y: the content origin's y
 *
 * Keep the dot grid with the content: the dots sit 64 px apart at 100 %,
 * never closer than 32 px, and move with the origin.
 */
void Suno_creative_workspace_set_camera(SunoCreativeWorkspace *self, double zoom, double x, double y);

/**
 * Suno_creative_workspace_set_grid_visible:
 * @self: a workspace
 * @visible: whether the ground shows its dot grid (Grid's sheet and Write's
 *   page have none)
 */
void Suno_creative_workspace_set_grid_visible(SunoCreativeWorkspace *self, gboolean visible);

/**
 * Suno_creative_workspace_get_is_phone:
 * @self: a workspace
 * Returns: whether the workspace is laid out for a phone
 */
gboolean Suno_creative_workspace_get_is_phone(SunoCreativeWorkspace *self);

/**
 * Suno_creative_grid_spacing:
 * @zoom: the content's scale
 *
 * The dot grid's pitch at @zoom: 64 px at 100 %, never under 32 px.
 *
 * Returns: the spacing in pixels
 */
double Suno_creative_grid_spacing(double zoom);

G_END_DECLS
