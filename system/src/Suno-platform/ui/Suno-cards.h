/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_cards.py: Card, ContentLitCard, AccountCard, PersonAvatar,
 * ContentLitHeader (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoCard:
 *
 * The plain card: the raised surface, 16 round, the chip edge, 12/14/14
 * inside (or unpadded).
 */
#define SUNO_TYPE_CARD (Suno_card_get_type())
G_DECLARE_FINAL_TYPE(SunoCard, Suno_card, SUNO, CARD, GtkBox)

/**
 * Suno_card_new:
 * @child: (nullable): the card's content
 * @padded: whether the kit pads it
 *
 * Returns: (transfer floating): a new card
 */
GtkWidget *Suno_card_new(GtkWidget *child, gboolean padded);
/**
 * Suno_card_set_recessed:
 * @self: a card
 * @recessed: a well in the page rather than a chip on it (Contacts' cards)
 */
void Suno_card_set_recessed(SunoCard *self, gboolean recessed);
/**
 * Suno_card_set_shape:
 * @self: a card
 * @shape: "regular" or "stat" (a compact statistic well)
 */
void Suno_card_set_shape(SunoCard *self, const char *shape);

/**
 * SunoContentLitCard:
 *
 * A card over a lit picture (sky, photo): darker than what is behind it, with
 * white text that passes AA.
 */
#define SUNO_TYPE_CONTENT_LIT_CARD (Suno_content_lit_card_get_type())
G_DECLARE_FINAL_TYPE(SunoContentLitCard, Suno_content_lit_card, SUNO, CONTENT_LIT_CARD, GtkBox)

/**
 * Suno_content_lit_card_new:
 * @child: (nullable): the card's content
 * @padded: whether the kit pads it
 *
 * Returns: (transfer floating): a new card
 */
GtkWidget *Suno_content_lit_card_new(GtkWidget *child, gboolean padded);
/** Use a light veil over a dark scene without changing card geometry. */
void Suno_content_lit_card_set_night(SunoContentLitCard *self, gboolean night);

/**
 * SunoPersonAvatar:
 *
 * A round face: a photo, or initials on the person's category hue, sized by
 * the kit.
 */
#define SUNO_TYPE_PERSON_AVATAR (Suno_person_avatar_get_type())
G_DECLARE_FINAL_TYPE(SunoPersonAvatar, Suno_person_avatar, SUNO, PERSON_AVATAR, GtkWidget)

/**
 * Suno_person_avatar_new:
 * @name: whose face
 * @size: its diameter in px (the kit's sizes: 32, 34, 36, 40, 44)
 *
 * Returns: (transfer floating): a new avatar
 */
GtkWidget *Suno_person_avatar_new(const char *name, int size);
/**
 * Suno_person_avatar_set_picture:
 * @self: an avatar
 * @picture: (nullable): their photo
 */
void Suno_person_avatar_set_picture(SunoPersonAvatar *self, GdkPaintable *picture);
void Suno_person_avatar_set_name(SunoPersonAvatar *self, const char *name);
/**
 * Suno_person_avatar_set_hue:
 * @self: an avatar
 * @hue: the person's hue, 0–359; -1 takes it from the name
 *
 * The hue the face wears (class `SunoUI-hue-<hue>`), so a person looks the
 * same in every app.
 */
void Suno_person_avatar_set_hue(SunoPersonAvatar *self, int hue);

/**
 * SunoAccountCard:
 *
 * The person at the top of a sidebar: avatar, name, a caption, a chevron;
 * opens the account (#GtkActionable or #GtkButton::clicked).
 */
#define SUNO_TYPE_ACCOUNT_CARD (Suno_account_card_get_type())
G_DECLARE_FINAL_TYPE(SunoAccountCard, Suno_account_card, SUNO, ACCOUNT_CARD, GtkButton)

/**
 * Suno_account_card_new:
 * @name: the person's name
 * @caption: (nullable): the line under it; %NULL is "Suno account"
 *
 * Returns: (transfer floating): a new card
 */
GtkWidget *Suno_account_card_new(const char *name, const char *caption);
/**
 * Suno_account_card_set_picture:
 * @self: a card
 * @picture: (nullable): their photo
 */
void Suno_account_card_set_picture(SunoAccountCard *self, GdkPaintable *picture);
void Suno_account_card_set_selected(SunoAccountCard *self, gboolean selected);
/**
 * Suno_account_card_set_recessed:
 * @self: a card
 * @recessed: the recessed row (a smaller face), as Contacts' sidebar has it
 */
void Suno_account_card_set_recessed(SunoAccountCard *self, gboolean recessed);
/**
 * Suno_account_card_set_compact:
 * @self: an account card
 * @compact: %TRUE for v70 Settings' card (.cfme.lacct): a 34 avatar, the name 13.5/600, the caption 11.5/400
 */
void Suno_account_card_set_compact(SunoAccountCard *self, gboolean compact);
/**
 * Suno_account_card_set_hue:
 * @self: a card
 * @hue: the person's hue, 0–359; -1 takes it from the name
 */
void Suno_account_card_set_hue(SunoAccountCard *self, int hue);

/**
 * SunoContentLitHeader:
 *
 * The light at the top of an island, from a photo and a hue: the photo
 * enlarged, blurred and faded down, or the hue's wash when there is none.
 */
#define SUNO_TYPE_CONTENT_LIT_HEADER (Suno_content_lit_header_get_type())
G_DECLARE_FINAL_TYPE(SunoContentLitHeader, Suno_content_lit_header, SUNO, CONTENT_LIT_HEADER, GtkWidget)

/**
 * Suno_content_lit_header_new:
 *
 * Returns: (transfer floating): a new header with no light yet
 */
GtkWidget *Suno_content_lit_header_new(void);
/**
 * Suno_content_lit_header_set_source:
 * @self: a header
 * @picture: (nullable): their photo
 * @tone: (nullable): a category hue; %NULL takes it from @name
 * @name: (nullable): whose light it is
 */
void Suno_content_lit_header_set_source(SunoContentLitHeader *self, GdkPaintable *picture,
                                        const char *tone, const char *name);
/**
 * Suno_content_lit_header_set_focus:
 * @self: a header
 * @x: where in the photo the light centres, 0–1
 * @y: where in the photo the light centres, 0–1
 */
/**
 * Suno_content_lit_header_set_hue:
 * @self: a header
 * @hue: a person's hue, 0–359, which wins over the source's tone; -1 goes
 *   back to the tone (or the name's hue)
 */
void Suno_content_lit_header_set_hue(SunoContentLitHeader *self, int hue);
void Suno_content_lit_header_set_focus(SunoContentLitHeader *self, double x, double y);

G_END_DECLS
