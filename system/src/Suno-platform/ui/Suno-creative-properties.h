/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI creative family (KB-D): the inspector's property fields (v70
 * .susec, .sufld, .suclrrow, .suselect, .seg, .sualign), used by Canvas,
 * Grid, Stage, Reel and Write.
 */
#pragma once

#include <gtk/gtk.h>

#include "Suno-action-center.h"
#include "Suno-color-picker.h"

G_BEGIN_DECLS

/**
 * Suno_property_evaluate:
 * @text: what a person typed where a number is wanted ("120*2", "50%", "12pt")
 * @value: (out): the number
 *
 * Read a number, or the arithmetic typed instead of one (+ - * / % **,
 * parentheses); a trailing %, px or pt is ignored. Nothing else is evaluated.
 *
 * Returns: whether @text was a number
 */
gboolean Suno_property_evaluate(const char *text, double *value);

/**
 * Suno_property_heading_new:
 * @text: a panel's group heading ("Colours", "Named ranges")
 *
 * The quiet heading between groups in a panel (v70 .suh).
 *
 * Returns: (transfer floating): a new label
 */
GtkWidget *Suno_property_heading_new(const char *text);

/**
 * SunoPropertySection:
 *
 * One group of an inspector (v70 .susec): a title, an optional action
 * (Add a stroke, Remove), and its fields; a hairline divides it from the
 * section above. Fields go in one per row, or two a row with
 * Suno_property_section_add_pair().
 *
 * Tree: box.SunoUI-creative-section
 *   ├ box.SunoUI-creative-section-header > label.SunoUI-creative-section-title,
 *   │                                      button.SunoUI-creative-section-action
 *   └ fields … (grid.SunoUI-creative-pairs for pairs)
 */
#define SUNO_TYPE_PROPERTY_SECTION (Suno_property_section_get_type())
G_DECLARE_FINAL_TYPE(SunoPropertySection, Suno_property_section, SUNO, PROPERTY_SECTION, GtkBox)

/**
 * Suno_property_section_new:
 * @title: the section's name ("Layout", "Fill")
 * Returns: (transfer floating): a new, empty section
 */
GtkWidget *Suno_property_section_new(const char *title);
/**
 * Suno_property_section_set_action:
 * @self: a section
 * @icon: (nullable): a Lucide glyph ("plus", "minus"); %NULL removes the action
 * @label: (nullable): what it does ("Add a stroke")
 * @action_name: (nullable): the detailed #GAction it activates
 */
void Suno_property_section_set_action(SunoPropertySection *self, const char *icon, const char *label,
                                      const char *action_name);
/**
 * Suno_property_section_append:
 * @self: a section
 * @field: a field, full width
 */
void Suno_property_section_append(SunoPropertySection *self, GtkWidget *field);
/**
 * Suno_property_section_add_pair:
 * @self: a section
 * @start: the left field
 * @end: (nullable): the right field; %NULL leaves the column empty
 *
 * Two fields side by side, in equal columns (v70 .sugrid2).
 */
void Suno_property_section_add_pair(SunoPropertySection *self, GtkWidget *start, GtkWidget *end);

/**
 * SunoPropertyNumber:
 *
 * A number in a well (v70 .sufld) with a short label before it ("X", "W",
 * "↻") and an optional unit after it ("°", "%", "px"). It behaves the way
 * a design tool's numbers do: dragging the label scrubs the value, Up and
 * Down step it (Shift ten times, Ctrl a tenth), arithmetic can be typed in,
 * and a field standing for several objects that disagree says "Mixed";
 * typing then applies to all. Enter or leaving commits; Esc puts it back.
 *
 * Emits #SunoPropertyNumber::value-changed when a person changes it, never
 * for Suno_property_number_set_value().
 *
 * Tree: entry.SunoUI-creative-number(.compact)(.mixed) > label.SunoUI-creative-number-label,
 *   text, label.SunoUI-creative-number-unit
 */
#define SUNO_TYPE_PROPERTY_NUMBER (Suno_property_number_get_type())
G_DECLARE_FINAL_TYPE(SunoPropertyNumber, Suno_property_number, SUNO, PROPERTY_NUMBER, GtkBox)

/**
 * Suno_property_number_new:
 * @label: (nullable): the short label before the number ("W"); %NULL for none
 * @unit: (nullable): the unit after it ("px")
 * Returns: (transfer floating): a new field at 0
 */
GtkWidget *Suno_property_number_new(const char *label, const char *unit);
/**
 * Suno_property_number_set_name:
 * @self: a field
 * @name: what the number is, when its label is a symbol ("Rotation" for "↻")
 */
void Suno_property_number_set_name(SunoPropertyNumber *self, const char *name);
void Suno_property_number_set_value(SunoPropertyNumber *self, double value);
double Suno_property_number_get_value(SunoPropertyNumber *self);
/**
 * Suno_property_number_set_mixed:
 * @self: a field
 *
 * Say the selection disagrees, rather than showing one of its values.
 */
void Suno_property_number_set_mixed(SunoPropertyNumber *self);
gboolean Suno_property_number_get_mixed(SunoPropertyNumber *self);
/**
 * Suno_property_number_set_range:
 * @self: a field
 * @minimum: the least value
 * @maximum: the greatest value
 */
void Suno_property_number_set_range(SunoPropertyNumber *self, double minimum, double maximum);
/**
 * Suno_property_number_set_step:
 * @self: a field
 * @step: one arrow press (default 1)
 * @digits: decimals shown (default 0)
 */
void Suno_property_number_set_step(SunoPropertyNumber *self, double step, guint digits);
/**
 * Suno_property_number_set_compact:
 * @self: a field
 * @compact: the narrow 64 px field that sits in a row with others (a stroke's width)
 */
void Suno_property_number_set_compact(SunoPropertyNumber *self, gboolean compact);

/**
 * SunoPropertyColor:
 *
 * A colour (v70 .suclrrow): its swatch, and its hex code to type. The
 * swatch opens a #SunoColorPicker (with the document's palette, if set) in
 * a popover, or in an action center's grown panel
 * (Suno_property_color_set_action_center(), or #SunoPropertyColor::open-picker
 * to host it yourself). Mixed selections and
 * fills a code can't say (gradients) show a word instead, not editable.
 * Extra controls (a stroke's width, Remove) follow with
 * Suno_property_color_add_suffix().
 *
 * Emits #SunoPropertyColor::color-changed for every change a person makes
 * (live while dragging in the picker) and #SunoPropertyColor::color-committed
 * once when they finish one; never for Suno_property_color_set_rgba().
 *
 * Tree: box.SunoUI-creative-color > button.SunoUI-creative-swatch > drawingarea,
 *   entry.SunoUI-creative-hex, suffixes …
 */
#define SUNO_TYPE_PROPERTY_COLOR (Suno_property_color_get_type())
G_DECLARE_FINAL_TYPE(SunoPropertyColor, Suno_property_color, SUNO, PROPERTY_COLOR, GtkBox)

/**
 * Suno_property_color_new:
 * @label: what the colour is, for assistive technology ("Fill", "Stroke")
 * Returns: (transfer floating): a new field, black
 */
GtkWidget *Suno_property_color_new(const char *label);
void Suno_property_color_set_rgba(SunoPropertyColor *self, const GdkRGBA *rgba);
/**
 * Suno_property_color_get_rgba:
 * @self: a field
 * @rgba: (out caller-allocates): the colour
 */
void Suno_property_color_get_rgba(SunoPropertyColor *self, GdkRGBA *rgba);
/**
 * Suno_property_color_set_word:
 * @self: a field
 * @word: (nullable): what shows instead of a code ("Gradient", "Mixed");
 *   %NULL shows the code again
 */
void Suno_property_color_set_word(SunoPropertyColor *self, const char *word);
/**
 * Suno_property_color_set_palette:
 * @self: a field
 * @colors: (array length=n_colors) (nullable): the document's colours
 * @n_colors: how many
 */
void Suno_property_color_set_palette(SunoPropertyColor *self, const GdkRGBA *colors, guint n_colors);
/**
 * Suno_property_color_set_action_center:
 * @self: a field
 * @center: (nullable): grow this action center's panel with the picker
 *   instead of a popover (the field in a bar's own panel, or one beside it)
 */
void Suno_property_color_set_action_center(SunoPropertyColor *self, SunoActionCenter *center);
/**
 * Suno_property_color_add_suffix:
 * @self: a field
 * @widget: a control after the code (a compact #SunoPropertyNumber, a Remove button)
 */
void Suno_property_color_add_suffix(SunoPropertyColor *self, GtkWidget *widget);
/**
 * Suno_property_color_format:
 * @rgba: a colour
 *
 * The code the field shows: "1F6FE0", or "1F6FE080" with alpha.
 *
 * Returns: (transfer full): the code
 */
char *Suno_property_color_format(const GdkRGBA *rgba);
/**
 * Suno_property_color_parse:
 * @text: a typed code ("1f6fe0", "#1F6FE0", "fff", "1F6FE080")
 * @rgba: (out caller-allocates): the colour
 * Returns: whether @text was a colour code
 */
gboolean Suno_property_color_parse(const char *text, GdkRGBA *rgba);

/**
 * SunoChoiceKind:
 * @SUNO_CHOICE_KIND_MENU: a well naming the choice, opening a menu (v70 .suselect)
 * @SUNO_CHOICE_KIND_SEGMENTS: every choice at once, for two to four short
 *   ones (v70 .seg); a choice with an icon shows only its icon
 */
typedef enum {
  SUNO_CHOICE_KIND_MENU,
  SUNO_CHOICE_KIND_SEGMENTS,
} SunoChoiceKind;

GType Suno_choice_kind_get_type(void) G_GNUC_CONST;
#define SUNO_TYPE_CHOICE_KIND (Suno_choice_kind_get_type())

/**
 * SunoPropertyChoice:
 *
 * One of several named choices: a font, a frame size, a text alignment, an
 * export format. Emits #SunoPropertyChoice::changed when a person chooses,
 * never for Suno_property_choice_set_current().
 *
 * Tree: button.SunoUI-creative-select > box > label, image (menu), or
 *   box.SunoUI-creative-segments > button.SunoUI-creative-tab … (segments)
 */
#define SUNO_TYPE_PROPERTY_CHOICE (Suno_property_choice_get_type())
G_DECLARE_FINAL_TYPE(SunoPropertyChoice, Suno_property_choice, SUNO, PROPERTY_CHOICE, GtkWidget)

/**
 * Suno_property_choice_new:
 * @kind: a menu or segments
 * @label: what is being chosen, for assistive technology ("Font", "Align")
 * Returns: (transfer floating): a new, empty choice
 */
GtkWidget *Suno_property_choice_new(SunoChoiceKind kind, const char *label);
/**
 * Suno_property_choice_add:
 * @self: a choice
 * @key: the choice's stable key ("center")
 * @label: its name ("Centre")
 * @icon: (nullable): a Lucide glyph ("text-align-center")
 *
 * The first choice added is current until another is chosen.
 */
void Suno_property_choice_add(SunoPropertyChoice *self, const char *key, const char *label, const char *icon);
void Suno_property_choice_set_current(SunoPropertyChoice *self, const char *key);
const char *Suno_property_choice_get_current(SunoPropertyChoice *self);
/**
 * Suno_property_choice_set_mixed:
 * @self: a choice
 *
 * The selection disagrees: the menu says "Mixed", no segment is chosen.
 */
void Suno_property_choice_set_mixed(SunoPropertyChoice *self);

/**
 * SunoAlignmentActions:
 *
 * The six alignments of a selection (v70 .sualign): left, centre and right
 * edges, then top, middle and bottom. Emits #SunoAlignmentActions::align
 * with "left", "center", "right", "top", "middle" or "bottom", and
 * activates the action given, with that key as its target.
 *
 * Tree: box.SunoUI-creative-align > button.SunoUI-creative-align-button × 6
 */
#define SUNO_TYPE_ALIGNMENT_ACTIONS (Suno_alignment_actions_get_type())
G_DECLARE_FINAL_TYPE(SunoAlignmentActions, Suno_alignment_actions, SUNO, ALIGNMENT_ACTIONS, GtkBox)

/**
 * Suno_alignment_actions_new:
 * @action_name: (nullable): a #GAction taking a string ("win.align"), or %NULL
 * Returns: (transfer floating): the six alignments
 */
GtkWidget *Suno_alignment_actions_new(const char *action_name);

G_END_DECLS
