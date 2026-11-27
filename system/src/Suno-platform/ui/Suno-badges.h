/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_badges.CountBadge / CategoryPill and content_contact.StatusPill (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoCountBadge:
 *
 * A count as a pill (CSS node `label`): a total ("1,284"), or with
 * attention, unread ("3", "99+"). Zero hides it.
 */
#define SUNO_TYPE_COUNT_BADGE (Suno_count_badge_get_type())
G_DECLARE_FINAL_TYPE(SunoCountBadge, Suno_count_badge, SUNO, COUNT_BADGE, GtkWidget)

/**
 * Suno_count_badge_new:
 * @count: the count
 * @attention: whether it is unread
 *
 * Returns: (transfer floating): a new badge
 */
GtkWidget *Suno_count_badge_new(int count, gboolean attention);
void Suno_count_badge_set_count(SunoCountBadge *self, int count);
int Suno_count_badge_get_count(SunoCountBadge *self);
void Suno_count_badge_set_attention(SunoCountBadge *self, gboolean attention);
gboolean Suno_count_badge_get_attention(SunoCountBadge *self);

/**
 * SunoCategoryPill:
 *
 * The category's name in the category's colour (CSS node `label`).
 * Categories: "create", "work", "media", "play", "tools".
 */
#define SUNO_TYPE_CATEGORY_PILL (Suno_category_pill_get_type())
G_DECLARE_FINAL_TYPE(SunoCategoryPill, Suno_category_pill, SUNO, CATEGORY_PILL, GtkWidget)

/**
 * Suno_category_pill_new:
 * @category: a category key
 *
 * Returns: (transfer floating): a new pill
 */
GtkWidget *Suno_category_pill_new(const char *category);
void Suno_category_pill_set_category(SunoCategoryPill *self, const char *category);
const char *Suno_category_pill_get_category(SunoCategoryPill *self);

/**
 * SunoStatusPill:
 *
 * A status as a pill: a dot in the status colour and the words for it. Kinds:
 * "on-Suno", "not-on-Suno", "online", "offline", "syncing", "error".
 */
#define SUNO_TYPE_STATUS_PILL (Suno_status_pill_get_type())
G_DECLARE_FINAL_TYPE(SunoStatusPill, Suno_status_pill, SUNO, STATUS_PILL, GtkBox)

/**
 * Suno_status_pill_new:
 * @kind: a status kind
 * @label: (nullable): words in place of the kind's own
 *
 * Returns: (transfer floating): a new pill
 */
GtkWidget *Suno_status_pill_new(const char *kind, const char *label);
/**
 * Suno_status_pill_set_kind:
 * @self: a pill
 * @kind: a status kind
 * @label: (nullable): words in place of the kind's own
 */
void Suno_status_pill_set_kind(SunoStatusPill *self, const char *kind, const char *label);
const char *Suno_status_pill_get_kind(SunoStatusPill *self);

G_END_DECLS
