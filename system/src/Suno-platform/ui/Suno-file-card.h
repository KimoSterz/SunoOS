/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_file.py: FileCard, OpenButton, OpenInMenu, split_name
 * (Python). */
#pragma once

#include <gtk/gtk.h>
#include "Suno-action-center.h"

G_BEGIN_DECLS

/**
 * Suno_file_split_name:
 * @name: a file name
 * @head: (out) (transfer full): what may be cut
 * @tail: (out) (transfer full): what always shows: the extension and a few
 *   letters before it
 */
void Suno_file_split_name(const char *name, char **head, char **tail);

/**
 * SunoOpenButton:
 *
 * Open, wearing the default app's icon ("Open in Stage"). A press opens the
 * file in its default app, or activates the button's #GtkActionable action
 * when it has one.
 */
#define SUNO_TYPE_OPEN_BUTTON (Suno_open_button_get_type())
G_DECLARE_FINAL_TYPE(SunoOpenButton, Suno_open_button, SUNO, OPEN_BUTTON, GtkButton)

/**
 * Suno_open_button_new:
 * @file: (nullable): the file
 * @content_type: (nullable): its type, when there is no file yet
 * @small: the compact variant
 *
 * Returns: (transfer floating): a new button
 */
GtkWidget *Suno_open_button_new(GFile *file, const char *content_type, gboolean small);
void Suno_open_button_set_label(SunoOpenButton *self, const char *label);

/**
 * SunoOpenInMenu:
 *
 * The apps that can open a file: Suno's own first (the default first among
 * them), then the rest by name, the default marked, "Other app…" last when
 * there is a file. A card on a computer, a drawer on a phone. By default
 * choosing an app opens the file in it; connect to
 * #SunoOpenInMenu::app-chosen (GAppInfo *app, returns gboolean handled) to do
 * it yourself.
 */
#define SUNO_TYPE_OPEN_IN_MENU (Suno_open_in_menu_get_type())
G_DECLARE_FINAL_TYPE(SunoOpenInMenu, Suno_open_in_menu, SUNO, OPEN_IN_MENU, GObject)

/**
 * Suno_open_in_menu_new:
 * @file: (nullable): the file
 * @content_type: (nullable): its type, when there is no file
 *
 * Returns: (transfer full): a new menu
 */
SunoOpenInMenu *Suno_open_in_menu_new(GFile *file, const char *content_type);
/**
 * Suno_open_in_menu_popup:
 * @self: a menu
 * @anchor: the control it opens from
 */
void Suno_open_in_menu_popup(SunoOpenInMenu *self, GtkWidget *anchor);
void Suno_open_in_menu_close(SunoOpenInMenu *self);

/**
 * SunoFileCard:
 *
 * One file, one look: its face (thumbnail or type icon), its name cut in the
 * middle so the extension always shows, what kind and how big, and Open (or
 * the app's actions). Compact for a message or a list. Emits
 * #SunoFileCard::open.
 */
#define SUNO_TYPE_FILE_CARD (Suno_file_card_get_type())
G_DECLARE_FINAL_TYPE(SunoFileCard, Suno_file_card, SUNO, FILE_CARD, GtkBox)

/**
 * Suno_file_card_new:
 * @file: the file
 * @compact: the compact variant
 *
 * Returns: (transfer floating): a new card; its name, kind and size come
 *   from @file unless set
 */
GtkWidget *Suno_file_card_new(GFile *file, gboolean compact);
void Suno_file_card_set_name(SunoFileCard *self, const char *name);
/**
 * Suno_file_card_set_size:
 * @self: a card
 * @size: its size in bytes, or -1 to say nothing
 */
void Suno_file_card_set_size(SunoFileCard *self, gint64 size);
/**
 * Suno_file_card_set_kind:
 * @self: a card
 * @kind: (nullable): what it is ("Stage presentation"); %NULL asks the
 *   type database
 */
void Suno_file_card_set_kind(SunoFileCard *self, const char *kind);
void Suno_file_card_set_content_type(SunoFileCard *self, const char *content_type);
/**
 * Suno_file_card_set_subtitle:
 * @self: a card
 * @subtitle: (nullable): a line in place of kind · size
 */
void Suno_file_card_set_subtitle(SunoFileCard *self, const char *subtitle);
/**
 * Suno_file_card_set_tone:
 * @self: a card
 * @tone: (nullable): "danger" or "warning": the second line's state
 *   (a failed or stalled transfer); anything else is refused with a critical
 */
void Suno_file_card_set_tone(SunoFileCard *self, const char *tone);
/**
 * Suno_file_card_set_thumbnail:
 * @self: a card
 * @thumbnail: (nullable): its picture
 */
void Suno_file_card_set_thumbnail(SunoFileCard *self, GdkPaintable *thumbnail);
/**
 * Suno_file_card_set_extra:
 * @self: a card
 * @extra: (nullable): a widget under the name (progress)
 */
void Suno_file_card_set_extra(SunoFileCard *self, GtkWidget *extra);
/**
 * Suno_file_card_add_action:
 * @self: a card
 * @action: a %SUNO_BAR_ITEM_ACTION in place of Open
 */
void Suno_file_card_add_action(SunoFileCard *self, SunoBarItem *action);
void Suno_file_card_set_selected(SunoFileCard *self, gboolean selected);
/**
 * Suno_file_card_get_file:
 * @self: a card
 *
 * Returns: (transfer none): the file
 */
GFile *Suno_file_card_get_file(SunoFileCard *self);

G_END_DECLS
