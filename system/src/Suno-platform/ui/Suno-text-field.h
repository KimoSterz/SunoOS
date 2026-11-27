/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_field.TextField / HeroTitleField / ParagraphField (Python). */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoTextField:
 *
 * A label over a recessed well, with an optional hint under it. Purposes:
 * "text", "name", "email", "phone", "url", "number", "password", "pin". Signals:
 * #SunoTextField::changed (const char *text), #SunoTextField::activate
 * (const char *text).
 */
#define SUNO_TYPE_TEXT_FIELD (Suno_text_field_get_type())
G_DECLARE_FINAL_TYPE(SunoTextField, Suno_text_field, SUNO, TEXT_FIELD, GtkBox)

/**
 * Suno_text_field_new:
 * @label: what it asks for
 * @purpose: (nullable): the input purpose; %NULL is "text"
 *
 * Returns: (transfer floating): a new field
 */
GtkWidget *Suno_text_field_new(const char *label, const char *purpose);
/**
 * Suno_text_field_set_size:
 * @self: a field
 * @size: "regular" (38px well) or "panel" (48px well in a grown action panel)
 */
void Suno_text_field_set_size(SunoTextField *self, const char *size);
const char *Suno_text_field_get_size(SunoTextField *self);
const char *Suno_text_field_get_text(SunoTextField *self);
void Suno_text_field_set_text(SunoTextField *self, const char *text);
/**
 * Suno_text_field_set_placeholder:
 * @self: a field
 * @placeholder: (nullable): the well's placeholder
 */
void Suno_text_field_set_placeholder(SunoTextField *self, const char *placeholder);
/**
 * Suno_text_field_set_hint:
 * @self: a field
 * @hint: (nullable): the line under the well
 */
void Suno_text_field_set_hint(SunoTextField *self, const char *hint);

/**
 * SunoHeroTitleField:
 *
 * A hero title (30/700) that is also its own editor: it looks like the title
 * until focused. Enter or leaving it commits (#SunoHeroTitleField::committed,
 * const char *text); Esc puts the old title back.
 */
#define SUNO_TYPE_HERO_TITLE_FIELD (Suno_hero_title_field_get_type())
G_DECLARE_FINAL_TYPE(SunoHeroTitleField, Suno_hero_title_field, SUNO, HERO_TITLE_FIELD, GtkEntry)

/**
 * Suno_hero_title_field_new:
 * @text: (nullable): the title
 * @placeholder: (nullable): shown when empty; %NULL is "Name"
 *
 * Returns: (transfer floating): a new field
 */
GtkWidget *Suno_hero_title_field_new(const char *text, const char *placeholder);
/**
 * Suno_hero_title_field_set_editable_title:
 * @self: a field
 * @editable: %FALSE shows just the title
 */
void Suno_hero_title_field_set_editable_title(SunoHeroTitleField *self, gboolean editable);
void Suno_hero_title_field_commit(SunoHeroTitleField *self);

/**
 * SunoParagraphField:
 *
 * A paragraph that is its own editor (Contacts' private note): body text,
 * wrapping, no frame; the placeholder shows, muted, while it is empty. For a
 * labelled single line, use #SunoTextField.
 */
#define SUNO_TYPE_PARAGRAPH_FIELD (Suno_paragraph_field_get_type())
G_DECLARE_FINAL_TYPE(SunoParagraphField, Suno_paragraph_field, SUNO, PARAGRAPH_FIELD, GtkTextView)

/**
 * Suno_paragraph_field_new:
 * @text: (nullable): the paragraph
 * @placeholder: (nullable): shown while it is empty
 * @label: (nullable): its name for screen readers; %NULL is @placeholder
 *
 * Returns: (transfer floating): a new field
 */
GtkWidget *Suno_paragraph_field_new(const char *text, const char *placeholder, const char *label);
/**
 * Suno_paragraph_field_get_text:
 * @self: a field
 *
 * Returns: (transfer full): the paragraph
 */
char *Suno_paragraph_field_get_text(SunoParagraphField *self);
void Suno_paragraph_field_set_text(SunoParagraphField *self, const char *text);

G_END_DECLS
