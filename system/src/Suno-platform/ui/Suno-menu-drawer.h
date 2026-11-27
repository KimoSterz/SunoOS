/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_drawer.MenuDrawer and action_bubble.FloatingMenu /
 * MenuItem (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/** SunoFloatAlign: horizontal alignment of a floating menu with its anchor. */
typedef enum {
  SUNO_FLOAT_ALIGN_CENTER,
  SUNO_FLOAT_ALIGN_START,
  SUNO_FLOAT_ALIGN_END,
} SunoFloatAlign;


/**
 * SunoMenuDrawer:
 *
 * A menu as a bottom drawer, the one drawer every SunoUI menu uses at phone
 * width. Rows draw their own keycaps and checks; a submenu is a second page
 * with a Back row. Emits #SunoMenuDrawer::closed.
 */
#define SUNO_TYPE_MENU_DRAWER (Suno_menu_drawer_get_type())
G_DECLARE_FINAL_TYPE(SunoMenuDrawer, Suno_menu_drawer, SUNO, MENU_DRAWER, GtkBox)

/**
 * Suno_menu_drawer_present_model:
 * @where: a widget in the window; the model's actions are activated on it
 * @model: the menu
 * @title: (nullable): the drawer's title
 *
 * Returns: (transfer none): the drawer, valid until it closes
 */
SunoMenuDrawer *Suno_menu_drawer_present_model(GtkWidget *where, GMenuModel *model, const char *title);
/** Present an app-owned grid or other menu content in the shared phone drawer.
 * @child: (transfer full): content to place below the handle and optional title
 */
SunoMenuDrawer *Suno_menu_drawer_present_child(GtkWidget *where, GtkWidget *child,
                                               const char *title);
void Suno_menu_drawer_close(SunoMenuDrawer *self);

/**
 * SunoFloatingMenu:
 *
 * A short menu anchored to a control: a card in the window's layer host on a
 * computer, the #SunoMenuDrawer on a phone. Rows are items, headings or
 * separators. Items activate their #GAction.
 */
#define SUNO_TYPE_FLOATING_MENU (Suno_floating_menu_get_type())
G_DECLARE_FINAL_TYPE(SunoFloatingMenu, Suno_floating_menu, SUNO, FLOATING_MENU, GtkBox)

/**
 * Suno_floating_menu_new:
 * @label: (nullable): what it is, for assistive technology ("Menu")
 *
 * Returns: (transfer floating): a new, empty menu
 */
GtkWidget *Suno_floating_menu_new(const char *label);
/**
 * Suno_floating_menu_add_item:
 * @self: a menu
 * @label: the row's words
 * @icon: (nullable): a Lucide glyph
 * @gicon: (nullable): an icon in place of @icon (an app's)
 * @note: (nullable): a quiet note on the right ("Default")
 * @action_name: (nullable): the detailed #GAction name it activates
 * @selected: whether it is the chosen row
 */
void Suno_floating_menu_add_item(SunoFloatingMenu *self, const char *label, const char *icon, GIcon *gicon,
                                 const char *note, const char *action_name, gboolean selected);
/**
 * Suno_floating_menu_add_rich_item:
 * @self: a menu
 * @label: the row's main text
 * @icon: (nullable): a Lucide glyph
 * @gicon: (nullable): an icon in place of @icon
 * @note: (nullable): quiet text beside the main text, such as a signature
 * @description: (nullable): a second line explaining the action
 * @action_name: (nullable): the detailed #GAction name it activates
 * @selected: whether it is the chosen row
 */
void Suno_floating_menu_add_rich_item(SunoFloatingMenu *self, const char *label, const char *icon, GIcon *gicon,
                                      const char *note, const char *description, const char *action_name,
                                      gboolean selected);
void Suno_floating_menu_add_heading(SunoFloatingMenu *self, const char *heading);
void Suno_floating_menu_add_separator(SunoFloatingMenu *self);
/**
 * Suno_floating_menu_popup:
 * @self: a menu
 * @anchor: the control it opens from (under it, or over it in the window's
 *   lower half)
 */
/**
 * Suno_floating_menu_set_picker:
 * @self: a floating menu
 * @picker: %TRUE for a choice among values (v70 Settings' .cfpop): the chosen item ends in a check,
 *   and the menu is as wide as its anchor, 200 at least, 6 below it
 */
void Suno_floating_menu_set_picker(SunoFloatingMenu *self, gboolean picker);
void Suno_floating_menu_popup(SunoFloatingMenu *self, GtkWidget *anchor);
/**
 * Suno_floating_menu_popup_at:
 * @self: a menu
 * @anchor: the widget it opens from (its actions are activated there)
 * @x: the point in @anchor's coordinates: the pointer of a right click, the
 *   touch point of a long press
 * @y: its y
 *
 * A context menu: its top start corner on the point, flipped to the point's
 * other side at the window's edges, shifted inside only when neither side
 * fits. Suno_floating_menu_popup() opens from the anchor itself (the Menu
 * key, Shift+F10).
 */
void Suno_floating_menu_popup_at(SunoFloatingMenu *self, GtkWidget *anchor, double x, double y);
/**
 * Suno_floating_menu_add_shortcut_item:
 * @self: a menu
 * @label: the row's words
 * @icon: (nullable): a Lucide glyph
 * @shortcut: its keys, shown as keycaps ("Ctrl+D")
 * @action_name: (nullable): the detailed #GAction name it activates
 */
void Suno_floating_menu_add_shortcut_item(SunoFloatingMenu *self, const char *label, const char *icon,
                                          const char *shortcut, const char *action_name);
/**
 * Suno_floating_menu_add_submenu:
 * @self: a menu
 * @label: the row's words
 * @icon: (nullable): a Lucide glyph
 * @submenu: (transfer floating): the menu it opens
 *
 * A row that cascades: hovering it (or → on it, or a click) opens @submenu
 * beside the menu, flipped at the window's edge; a pointer heading for it
 * keeps it open for 250 ms across other rows; ← and Esc close one level; a
 * leaf in it closes every level. On a phone it drills in place, with Back.
 */
void Suno_floating_menu_add_submenu(SunoFloatingMenu *self, const char *label, const char *icon,
                                    SunoFloatingMenu *submenu);
void Suno_floating_menu_close(SunoFloatingMenu *self);
gboolean Suno_floating_menu_get_is_open(SunoFloatingMenu *self);

/**
 * Suno_floating_menu_set_align:
 * @self: a menu
 * @align: alignment of the menu against its anchor
 */
void Suno_floating_menu_set_align(SunoFloatingMenu *self, SunoFloatAlign align);

G_END_DECLS
