/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_contact.py: Person, ContactActions, MiniCard, ContactCard,
 * EventCard, SongCard, PlaceCard, contact_uri (Python). StatusPill is in
 * Suno-badges.h. */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoPerson:
 *
 * Who a contact card or action row is about. #SunoPerson:username is their
 * Suno @username; a person with one is on Suno.
 */
#define SUNO_TYPE_PERSON (Suno_person_get_type())
G_DECLARE_FINAL_TYPE(SunoPerson, Suno_person, SUNO, PERSON, GObject)

/**
 * Suno_person_new:
 * @name: their name
 *
 * Returns: (transfer full): a new person
 */
SunoPerson *Suno_person_new(const char *name);
const char *Suno_person_get_name(SunoPerson *self);
void Suno_person_set_phone(SunoPerson *self, const char *phone);
const char *Suno_person_get_phone(SunoPerson *self);
void Suno_person_set_email(SunoPerson *self, const char *email);
const char *Suno_person_get_email(SunoPerson *self);
void Suno_person_set_username(SunoPerson *self, const char *username);
const char *Suno_person_get_username(SunoPerson *self);
void Suno_person_set_online(SunoPerson *self, gboolean online);
gboolean Suno_person_get_online(SunoPerson *self);
/**
 * Suno_person_set_picture:
 * @self: a person
 * @picture: (nullable): their photo
 */
void Suno_person_set_picture(SunoPerson *self, GdkPaintable *picture);
/**
 * Suno_person_get_picture:
 * @self: a person
 *
 * Returns: (transfer none) (nullable): their photo
 */
GdkPaintable *Suno_person_get_picture(SunoPerson *self);
gboolean Suno_person_get_on_Suno(SunoPerson *self);
/**
 * Suno_person_set_hue:
 * @self: a person
 * @hue: their hue, 0–359: their face and the light behind their card wear
 *   it; -1 takes it from the name
 */
void Suno_person_set_hue(SunoPerson *self, int hue);
int Suno_person_get_hue(SunoPerson *self);

/**
 * Suno_contact_uri:
 * @action: "message", "call", "video" or "email"
 * @person: who
 *
 * The link the desktop opens for @action when the app doesn't handle it.
 *
 * Returns: (transfer full): the URI, "" when there is none
 */
char *Suno_contact_uri(const char *action, SunoPerson *person);

/**
 * SunoContactActions:
 *
 * Message, Call, Video, Email for one person, in that order, each disabled
 * when impossible. #SunoContactActions::action (const char *action, returns
 * gboolean handled) lets the app handle one in place; otherwise the desktop
 * opens Suno_contact_uri(), and a failure is an error toast.
 */
#define SUNO_TYPE_CONTACT_ACTIONS (Suno_contact_actions_get_type())
G_DECLARE_FINAL_TYPE(SunoContactActions, Suno_contact_actions, SUNO, CONTACT_ACTIONS, GtkBox)

/**
 * Suno_contact_actions_new:
 * @person: who
 * @small: the compact variant (inside a mini card)
 *
 * Returns: (transfer floating): a new row
 */
GtkWidget *Suno_contact_actions_new(SunoPerson *person, gboolean small);
/**
 * Suno_contact_actions_activate_action:
 * @self: a row
 * @action: "message", "call", "video" or "email"
 *
 * Returns: whether it ran
 */
gboolean Suno_contact_actions_activate_action(SunoContactActions *self, const char *action);

/**
 * SunoContactCard:
 *
 * Contacts' mini card: the face, the name, "@username · On Suno" or the
 * number, and the actions under it.
 */
#define SUNO_TYPE_CONTACT_CARD (Suno_contact_card_get_type())
G_DECLARE_FINAL_TYPE(SunoContactCard, Suno_contact_card, SUNO, CONTACT_CARD, GtkBox)

/**
 * Suno_contact_card_new:
 * @person: who
 *
 * Returns: (transfer floating): a new card
 */
GtkWidget *Suno_contact_card_new(SunoPerson *person);
/**
 * Suno_contact_card_get_actions:
 * @self: a card
 *
 * Returns: (transfer none): its actions row (connect to its "action")
 */
SunoContactActions *Suno_contact_card_get_actions(SunoContactCard *self);

/**
 * SunoEventCard:
 *
 * Calendar's mini card: the date tile in the calendar's colour, the title,
 * when and where, Add (#SunoEventCard::add).
 */
#define SUNO_TYPE_EVENT_CARD (Suno_event_card_get_type())
G_DECLARE_FINAL_TYPE(SunoEventCard, Suno_event_card, SUNO, EVENT_CARD, GtkBox)

/**
 * Suno_event_card_new:
 * @title: the event
 * @start: when it starts
 * @all_day: whether it is all day
 * @where: (nullable): where
 * @tone: (nullable): the calendar's category hue; %NULL is "work"
 *
 * Returns: (transfer floating): a new card
 */
GtkWidget *Suno_event_card_new(const char *title, GDateTime *start, gboolean all_day,
                               const char *where, const char *tone);
/**
 * Suno_event_card_set_when:
 * @self: a card
 * @when: (nullable): words in place of the kit's time line
 */
void Suno_event_card_set_when(SunoEventCard *self, const char *when);
/**
 * Suno_event_card_set_add_label:
 * @self: a card
 * @label: (nullable): the button's word; %NULL hides Add
 */
void Suno_event_card_set_add_label(SunoEventCard *self, const char *label);

/**
 * SunoSongCard:
 *
 * Tide's mini card: the artwork, the title, artist · album, Play
 * (#SunoSongCard::play).
 */
#define SUNO_TYPE_SONG_CARD (Suno_song_card_get_type())
G_DECLARE_FINAL_TYPE(SunoSongCard, Suno_song_card, SUNO, SONG_CARD, GtkBox)

/**
 * Suno_song_card_new:
 * @title: the song
 * @artist: who
 * @album: (nullable): from
 * @artwork: (nullable): the cover
 *
 * Returns: (transfer floating): a new card
 */
GtkWidget *Suno_song_card_new(const char *title, const char *artist, const char *album,
                              GdkPaintable *artwork);

/**
 * SunoPlaceCard:
 *
 * Maps' mini card: the pin, the name, the address and how far, Directions
 * (#SunoPlaceCard::directions).
 */
#define SUNO_TYPE_PLACE_CARD (Suno_place_card_get_type())
G_DECLARE_FINAL_TYPE(SunoPlaceCard, Suno_place_card, SUNO, PLACE_CARD, GtkBox)

/**
 * Suno_place_card_new:
 * @name: the place
 * @address: where it is
 * @eta: (nullable): how far ("12 min")
 * @icon: (nullable): a Lucide glyph; %NULL is "map-pin"
 *
 * Returns: (transfer floating): a new card
 */
GtkWidget *Suno_place_card_new(const char *name, const char *address, const char *eta, const char *icon);

G_END_DECLS
