/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_place.py: PlaceSearch, PlaceResult, rank_places,
 * parse_coordinates (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoPlaceResult:
 *
 * A place: its name, one line of where it is, and the app's own value.
 */
#define SUNO_TYPE_PLACE_RESULT (Suno_place_result_get_type())
G_DECLARE_FINAL_TYPE(SunoPlaceResult, Suno_place_result, SUNO, PLACE_RESULT, GObject)

/**
 * Suno_place_result_new:
 * @name: the place's name
 * @subtitle: (nullable): where it is
 * @value: (nullable) (transfer none): the app's own object for it
 *
 * Returns: (transfer full): a new result
 */
SunoPlaceResult *Suno_place_result_new(const char *name, const char *subtitle, GObject *value);
const char *Suno_place_result_get_name(SunoPlaceResult *self);
const char *Suno_place_result_get_subtitle(SunoPlaceResult *self);
/**
 * Suno_place_result_get_value:
 * @self: a result
 *
 * Returns: (transfer none) (nullable): the app's value
 */
GObject *Suno_place_result_get_value(SunoPlaceResult *self);

/**
 * Suno_parse_coordinates:
 * @text: what was typed
 * @latitude: (out): the latitude
 * @longitude: (out): the longitude
 *
 * "37.32, -122.03" typed into the field.
 *
 * Returns: whether @text is a coordinate pair
 */
gboolean Suno_parse_coordinates(const char *text, double *latitude, double *longitude);

/**
 * SunoPlaceSearch:
 *
 * A place field whose suggestions open above it: after a 180 ms pause the
 * places are ranked (names that start with the text first, then names that
 * contain it), five at most; arrows move, Enter picks, Esc closes.
 *
 * The app gives it all its places (Suno_place_search_set_places()), or
 * answers #SunoPlaceSearch::search (const char *query) with
 * Suno_place_search_set_results() for a remote provider. Picking emits
 * #SunoPlaceSearch::picked (SunoPlaceResult *).
 */
#define SUNO_TYPE_PLACE_SEARCH (Suno_place_search_get_type())
G_DECLARE_FINAL_TYPE(SunoPlaceSearch, Suno_place_search, SUNO, PLACE_SEARCH, GtkBox)

/**
 * Suno_place_search_new:
 * @placeholder: (nullable): %NULL is "Add a city or ZIP"
 *
 * Returns: (transfer floating): a new field
 */
GtkWidget *Suno_place_search_new(const char *placeholder);
/**
 * Suno_place_search_set_places:
 * @self: a field
 * @places: (nullable): every #SunoPlaceResult it may offer; the kit ranks them
 */
void Suno_place_search_set_places(SunoPlaceSearch *self, GListModel *places);
/**
 * Suno_place_search_set_results:
 * @self: a field
 * @results: (nullable): #SunoPlaceResult answers to the last search, in order
 */
void Suno_place_search_set_results(SunoPlaceSearch *self, GListModel *results);
/**
 * Suno_place_search_set_exclude:
 * @self: a field
 * @filter: (nullable): places it matches are never offered (cities already added)
 */
void Suno_place_search_set_exclude(SunoPlaceSearch *self, GtkFilter *filter);
const char *Suno_place_search_get_text(SunoPlaceSearch *self);
void Suno_place_search_set_text(SunoPlaceSearch *self, const char *text);
gboolean Suno_place_search_get_list_shown(SunoPlaceSearch *self);
void Suno_place_search_search_now(SunoPlaceSearch *self);
/**
 * Suno_place_search_pick:
 * @self: a field
 * @index: a suggestion's index, or -1 for the selected one
 *
 * Returns: %FALSE when there is none
 */
gboolean Suno_place_search_pick(SunoPlaceSearch *self, int index);
void Suno_place_search_close_list(SunoPlaceSearch *self);

G_END_DECLS
