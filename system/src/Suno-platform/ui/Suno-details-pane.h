/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_details.py: DetailsPane, DetailsRow, DetailsItem, AddRow,
 * FactRow, DetailsPhotos (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoDetailsRow:
 *
 * A person or thing in a details list: lead, name, one quiet line, quiet
 * actions. The whole row highlights; its actions appear on hover or focus
 * (always on a phone). Emits #SunoDetailsRow::activated when the row itself
 * is activated.
 */
#define SUNO_TYPE_DETAILS_ROW (Suno_details_row_get_type())
G_DECLARE_FINAL_TYPE(SunoDetailsRow, Suno_details_row, SUNO, DETAILS_ROW, GtkBox)

/**
 * Suno_details_row_new:
 * @title: the name
 * @subtitle: (nullable): one quiet line
 * @lead: (nullable): the lead (a #SunoPersonAvatar)
 *
 * Returns: (transfer floating): a new row
 */
GtkWidget *Suno_details_row_new(const char *title, const char *subtitle, GtkWidget *lead);
/**
 * Suno_details_row_add_action:
 * @self: a row
 * @icon: a Lucide glyph
 * @label: its name (tooltip and accessible label)
 * @action_name: the detailed #GAction name it activates
 */
void Suno_details_row_add_action(SunoDetailsRow *self, const char *icon, const char *label,
                                 const char *action_name);

/**
 * SunoDetailsItem:
 *
 * A thing in a details list (an event, a thread): its mark, a title, one
 * quiet line, a trail. A #GtkButton: use #GtkActionable or
 * #GtkButton::clicked.
 */
#define SUNO_TYPE_DETAILS_ITEM (Suno_details_item_get_type())
G_DECLARE_FINAL_TYPE(SunoDetailsItem, Suno_details_item, SUNO, DETAILS_ITEM, GtkButton)

/**
 * Suno_details_item_new:
 * @title: the title
 * @subtitle: (nullable): one quiet line
 * @icon: (nullable): a Lucide glyph as its mark
 *
 * Returns: (transfer floating): a new item
 */
GtkWidget *Suno_details_item_new(const char *title, const char *subtitle, const char *icon);
/**
 * Suno_details_item_set_lead:
 * @self: an item
 * @lead: (nullable): a lead widget in place of the icon
 */
void Suno_details_item_set_lead(SunoDetailsItem *self, GtkWidget *lead);
/**
 * Suno_details_item_set_trail:
 * @self: an item
 * @trail: (nullable): what sits at its end (a time, a count badge)
 */
void Suno_details_item_set_trail(SunoDetailsItem *self, GtkWidget *trail);
void Suno_details_item_set_selected(SunoDetailsItem *self, gboolean selected);

/**
 * SunoAddRow:
 *
 * "Add people", "Add source": a list row, not a framed button. The + sits in
 * the avatar column; an optional shortcut shows as keycaps (never on a phone).
 */
#define SUNO_TYPE_ADD_ROW (Suno_add_row_get_type())
G_DECLARE_FINAL_TYPE(SunoAddRow, Suno_add_row, SUNO, ADD_ROW, GtkButton)

/**
 * Suno_add_row_new:
 * @label: what it adds ("Add people")
 * @icon: (nullable): a Lucide glyph; %NULL is "user-plus"
 * @shortcut: (nullable): an accelerator ("<Control>n")
 *
 * Returns: (transfer floating): a new row
 */
GtkWidget *Suno_add_row_new(const char *label, const char *icon, const char *shortcut);
/* A document add action has a plain glyph and content-sized inline geometry. */
void Suno_add_row_set_document(SunoAddRow *self, gboolean document);

/**
 * SunoFactRow:
 *
 * A labelled fact: its icon, a small label over the value, and Copy on hover
 * (always in a phone drawer). Copy puts the value on the clipboard and a
 * "Copied" toast confirms it.
 */
#define SUNO_TYPE_FACT_ROW (Suno_fact_row_get_type())
G_DECLARE_FINAL_TYPE(SunoFactRow, Suno_fact_row, SUNO, FACT_ROW, GtkBox)

/**
 * Suno_fact_row_new:
 * @icon: a Lucide glyph ("phone")
 * @label: the small label ("mobile")
 * @value: the value
 * @copy: whether it offers Copy
 *
 * Returns: (transfer floating): a new row
 */
GtkWidget *Suno_fact_row_new(const char *icon, const char *label, const char *value, gboolean copy);
/**
 * Suno_fact_row_copy:
 * @self: a row
 *
 * Put the value on the clipboard and say so.
 */
void Suno_fact_row_copy(SunoFactRow *self);

/**
 * SunoDetailsPhotos:
 *
 * Photos as square thumbnails, three a row. Emits
 * #SunoDetailsPhotos::photo-activated (guint index).
 */
#define SUNO_TYPE_DETAILS_PHOTOS (Suno_details_photos_get_type())
G_DECLARE_FINAL_TYPE(SunoDetailsPhotos, Suno_details_photos, SUNO, DETAILS_PHOTOS, GtkGrid)

/**
 * Suno_details_photos_new:
 * @items: (nullable): a list of #GdkPaintable or #GFile
 *
 * Returns: (transfer floating): a new grid
 */
GtkWidget *Suno_details_photos_new(GListModel *items);
/**
 * Suno_details_photos_set_items:
 * @self: a grid
 * @items: (nullable): a list of #GdkPaintable or #GFile
 */
void Suno_details_photos_set_items(SunoDetailsPhotos *self, GListModel *items);

/**
 * SunoDetailsPane:
 *
 * The details pane: put it beside the island. It opens and closes itself
 * (Suno_details_pane_show()), becomes a bottom drawer at phone width, and
 * keeps the person's Info wish across subjects. A main pane stays open.
 * #SunoDetailsPane:shown notifies on every change.
 */
#define SUNO_TYPE_DETAILS_PANE (Suno_details_pane_get_type())
G_DECLARE_FINAL_TYPE(SunoDetailsPane, Suno_details_pane, SUNO, DETAILS_PANE, GtkBox)

/**
 * Suno_details_pane_new:
 * @title: (nullable): the header's title; %NULL is "Details"
 * @main: whether it is the view's main pane (no close button, stays open)
 *
 * Returns: (transfer floating): a new, closed pane
 */
GtkWidget *Suno_details_pane_new(const char *title, gboolean main);
void Suno_details_pane_set_title(SunoDetailsPane *self, const char *title);
/**
 * Suno_details_pane_set_leading:
 * @self: a pane
 * @leading: (nullable) (transfer floating): a small icon or widget before the header title
 *
 * Replaces the previous leading widget. Pass %NULL to remove it. The pane
 * takes ownership of @leading; it must not already have a parent.
 */
void Suno_details_pane_set_leading(SunoDetailsPane *self, GtkWidget *leading);
/**
 * Suno_details_pane_set_title_content:
 * @self: a pane
 * @content: (nullable) (transfer floating): an editable title or custom header widget
 *
 * Replaces the visible title label while set, between the optional leading
 * widget and the close button. Pass %NULL to restore the pane's title label.
 * The pane takes ownership of @content; it must not already have a parent.
 */
void Suno_details_pane_set_title_content(SunoDetailsPane *self, GtkWidget *content);
/**
 * Suno_details_pane_add:
 * @self: a pane
 * @widget: any part (a #SunoFileCard, #SunoStackedButtons)
 *
 * Append @widget to the body, in order.
 */
void Suno_details_pane_add(SunoDetailsPane *self, GtkWidget *widget);

/**
 * Suno_details_pane_set_footer:
 * @self: a details pane
 * @widget: (nullable): an unparented fixed action widget, or %NULL to clear
 *
 * Keep an action below the scrolling body in both side panes and drawers.
 * Suno_details_pane_clear() removes this footer together with the body.
 */
void Suno_details_pane_set_footer(SunoDetailsPane *self, GtkWidget *widget);
/**
 * Suno_details_pane_add_hero:
 * @self: a pane
 * @title: the subject's name
 * @subtitle: (nullable): one caption
 * @lead: (nullable): its picture
 */
void Suno_details_pane_add_hero(SunoDetailsPane *self, const char *title, const char *subtitle,
                                GtkWidget *lead);
/**
 * Suno_details_pane_add_subject:
 * @self: a pane
 * @title: the subject's name
 * @subtitle: (nullable): one caption
 * @lead: (nullable) (transfer floating): a compact picture or icon
 *
 * Append a compact horizontal subject summary for an embedded action panel.
 * The caller supplies the lead at the appropriate compact size.
 */
void Suno_details_pane_add_subject(SunoDetailsPane *self, const char *title,
                                   const char *subtitle, GtkWidget *lead);
/**
 * Suno_details_pane_set_header_visible:
 * @self: a pane
 * @visible: whether to show the pane's title/back/close header
 *
 * A panel whose subject names it can omit the redundant pane heading.
 * The containing action bar remains responsible for dismissal.
 */
void Suno_details_pane_set_header_visible(SunoDetailsPane *self, gboolean visible);

/**
 * Suno_details_pane_add_section:
 * @self: a pane
 * @label: the section label
 * @action_label: (nullable): a quiet button at its end ("View all")
 * @action_name: (nullable): the detailed #GAction name that button activates
 */
void Suno_details_pane_add_section(SunoDetailsPane *self, const char *label,
                                   const char *action_label, const char *action_name);
/**
 * Suno_details_pane_add_fact:
 * @self: a pane
 * @key: the fact's name ("Size")
 * @value: its value, selectable, wrapping
 *
 * A key and value fact. Facts added one after another share one block, a
 * hairline between each.
 */
void Suno_details_pane_add_fact(SunoDetailsPane *self, const char *key, const char *value);
/**
 * Suno_details_pane_add_row:
 * @self: a pane
 * @row: a #SunoDetailsRow, #SunoDetailsItem, #SunoFactRow or #SunoAddRow
 *
 * Rows added one after another share one list: no dividers, full-width hover.
 */
void Suno_details_pane_add_row(SunoDetailsPane *self, GtkWidget *row);
/**
 * Suno_details_pane_add_photos:
 * @self: a pane
 * @items: a list of #GdkPaintable or #GFile
 *
 * Returns: (transfer none): the photos grid
 */
SunoDetailsPhotos *Suno_details_pane_add_photos(SunoDetailsPane *self, GListModel *items);
/**
 * Suno_details_pane_clear:
 * @self: a pane
 *
 * Empty the body, to fill it again for a new subject.
 */
void Suno_details_pane_clear(SunoDetailsPane *self);
/**
 * Suno_details_pane_show:
 * @self: a pane
 * @open: whether it should show
 *
 * Open or close (the person's wish, kept across subjects).
 *
 * Returns: whether it shows
 */
gboolean Suno_details_pane_show(SunoDetailsPane *self, gboolean open);
/**
 * Suno_details_pane_set_subject:
 * @self: a pane
 * @subject: (nullable) (transfer none): what it describes now; %NULL
 *   closes the pane until there is a subject again
 */
void Suno_details_pane_set_subject(SunoDetailsPane *self, GObject *subject);
/**
 * Suno_details_pane_get_subject:
 * @self: a pane
 *
 * Returns: (transfer none) (nullable): the subject
 */
GObject *Suno_details_pane_get_subject(SunoDetailsPane *self);
/**
 * Suno_details_pane_set_embedded:
 * @self: a pane
 * @embedded: keep the contents in its parent at every width
 *
 * For details hosted by an ActionCenter panel: the parent owns scrolling,
 * the surface and dismissal. Defaults to %FALSE (responsive side pane/drawer).
 */
void Suno_details_pane_set_embedded(SunoDetailsPane *self, gboolean embedded);
void Suno_details_pane_set_main(SunoDetailsPane *self, gboolean main);
/**
 * Suno_details_pane_set_raised:
 * @self: a pane
 * @raised: a raised island of its own beside the main one (an editor's
 *   Inspector): the content surface, the island's radius, ring and shade, a
 *   gap from the island, 320 wide at least; a phone's drawer is unchanged
 */
void Suno_details_pane_set_raised(SunoDetailsPane *self, gboolean raised);
gboolean Suno_details_pane_get_main(SunoDetailsPane *self);
/**
 * Suno_details_pane_set_closable:
 * @self: the pane
 * @closable: whether it shows its close button
 *
 * A side pane closes; a main pane only when made closable (a day in Calendar).
 */
void Suno_details_pane_set_closable(SunoDetailsPane *self, gboolean closable);
/**
 * Suno_details_pane_set_back:
 * @self: the pane
 * @label: (nullable): where Back goes ("Tuesday"), or %NULL to remove it
 * @on_back: (scope forever) (nullable): called with @user_data when Back is pressed
 * @user_data: (closure): data for @on_back
 *
 * A back button before the title, for a pane that went one level in.
 */
void Suno_details_pane_set_back(SunoDetailsPane *self, const char *label, GCallback on_back, gpointer user_data);
/**
 * Suno_details_pane_close:
 * @self: a pane
 *
 * Close, as the close button and Esc do. A main pane stays.
 */
void Suno_details_pane_close(SunoDetailsPane *self);
gboolean Suno_details_pane_toggle(SunoDetailsPane *self);
gboolean Suno_details_pane_get_shown(SunoDetailsPane *self);
gboolean Suno_details_pane_get_is_drawer(SunoDetailsPane *self);
/**
 * Suno_details_pane_info_button:
 * @self: a pane
 *
 * The Information control for this pane, pressed while it shows. The
 * #SunoCornerPill uses it.
 *
 * Returns: (transfer none): the toggle button
 */
GtkWidget *Suno_details_pane_info_button(SunoDetailsPane *self);

G_END_DECLS
