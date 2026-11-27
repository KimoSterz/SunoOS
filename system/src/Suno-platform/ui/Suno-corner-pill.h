/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of structure_placement.CornerPill (Python). */
#pragma once

#include <gtk/gtk.h>
#include "Suno-mode-switch.h"

G_BEGIN_DECLS

typedef struct _SunoDetailsPane SunoDetailsPane;

/**
 * SunoCornerPill:
 *
 * The top-right pill of an island: the view and the thing itself, always in
 * the one placement order, whatever order the app adds them in:
 *
 *   mode switch · who's here · Open in · Share · on/off states (Favourite) ·
 *   Information · object actions (Edit) · More
 *
 * An on state whose glyph has a "-filled" twin shows it while on; a heart
 * also takes the love colour.
 *
 * The app says what it has; the kit decides where. Plain commands are
 * #GAction names (the one stable command ID); controls whose menu anchors to
 * the pill emit a signal with the anchor.
 *
 * Signals: #SunoCornerPill::open-in (GtkWidget *anchor),
 * #SunoCornerPill::share (GtkWidget *anchor), #SunoCornerPill::edit-cancelled,
 * #SunoCornerPill::edit-done.
 */
#define SUNO_TYPE_CORNER_PILL (Suno_corner_pill_get_type())
G_DECLARE_FINAL_TYPE(SunoCornerPill, Suno_corner_pill, SUNO, CORNER_PILL, GtkBox)

/**
 * Suno_corner_pill_new:
 *
 * Returns: (transfer floating): a new pill; add at least one control
 */
GtkWidget *Suno_corner_pill_new(void);
/**
 * Suno_corner_pill_set_orientation:
 * @self: a pill
 * @orientation: horizontal pill (default) or vertical stack with inset separators
 */
void Suno_corner_pill_set_orientation(SunoCornerPill *self, GtkOrientation orientation);
/**
 * Suno_corner_pill_set_modes:
 * @self: a pill
 * @modes: the view's mode switch
 */
void Suno_corner_pill_set_modes(SunoCornerPill *self, SunoModeSwitch *modes);
/**
 * Suno_corner_pill_set_people:
 * @self: a pill
 * @people: who's here (a face pile)
 */
void Suno_corner_pill_set_people(SunoCornerPill *self, GtkWidget *people);
/**
 * Suno_corner_pill_add_open_in:
 * @self: a pill
 *
 * Offer Open in; a press emits #SunoCornerPill::open-in with the button, to
 * anchor a #SunoOpenInMenu to.
 */
void Suno_corner_pill_add_open_in(SunoCornerPill *self);
/**
 * Suno_corner_pill_add_share:
 * @self: a pill
 *
 * Offer Share (Lucide "share-2"); a press emits #SunoCornerPill::share.
 */
void Suno_corner_pill_add_share(SunoCornerPill *self);
/**
 * Suno_corner_pill_add_action:
 * @self: a pill
 * @icon: a Lucide glyph ("pencil")
 * @label: its name ("Edit")
 * @action_name: the detailed #GAction name it activates ("win.edit")
 *
 * An object action.
 */
void Suno_corner_pill_add_action(SunoCornerPill *self, const char *icon, const char *label,
                                 const char *action_name);
/**
 * Suno_corner_pill_add_state:
 * @self: a pill
 * @icon: a Lucide glyph ("heart")
 * @label: its name ("Favourite")
 * @action_name: a stateful boolean #GAction; its state is the toggle's
 *
 * An on/off state of the thing.
 */
void Suno_corner_pill_add_state(SunoCornerPill *self, const char *icon, const char *label,
                                const char *action_name);
/**
 * Suno_corner_pill_set_info_pane:
 * @self: a pill
 * @pane: the details pane Information opens and closes
 */
void Suno_corner_pill_set_info_pane(SunoCornerPill *self, SunoDetailsPane *pane);
/**
 * Suno_corner_pill_set_info_action:
 * @self: a pill
 * @action_name: a stateful boolean #GAction: whether the app's details show
 */
void Suno_corner_pill_set_info_action(SunoCornerPill *self, const char *action_name);
/**
 * Suno_corner_pill_set_more_menu:
 * @self: a pill
 * @menu: the More menu (a drawer at phone width)
 */
void Suno_corner_pill_set_more_menu(SunoCornerPill *self, GMenuModel *menu);
/**
 * Suno_corner_pill_set_labelled:
 * @self: a pill
 * @labelled: whether Share and the actions show their words on a computer
 *
 * Words fold away at phone width, except the primary action's.
 */
void Suno_corner_pill_set_labelled(SunoCornerPill *self, gboolean labelled);
/**
 * Suno_corner_pill_set_primary:
 * @self: a pill
 * @label: (nullable): the label of one added action to raise as the key
 */
void Suno_corner_pill_set_primary(SunoCornerPill *self, const char *label);
/**
 * Suno_corner_pill_edit:
 * @self: a pill
 * @done_label: (nullable): the key's word ("Done", "Save")
 *
 * Show Cancel · Done in place of the pill's controls until either is pressed
 * (#SunoCornerPill::edit-cancelled, #SunoCornerPill::edit-done) or
 * Suno_corner_pill_stop_editing() is called.
 */
void Suno_corner_pill_edit(SunoCornerPill *self, const char *done_label);
void Suno_corner_pill_stop_editing(SunoCornerPill *self);
gboolean Suno_corner_pill_get_editing(SunoCornerPill *self);

/**
 * Suno_corner_pill_set_keep_labels:
 * @self: the corner pill
 * @keep: whether labelled actions retain their words on a phone
 *
 * Keep project/navigation labels visible; the default folds icon labels.
 */
void Suno_corner_pill_set_keep_labels(SunoCornerPill *self, gboolean keep);

/** Keep the primary action filled but icon-only; its accessible name is preserved. Default FALSE. */
void Suno_corner_pill_set_primary_icon_only(SunoCornerPill *self, gboolean icon_only);

G_END_DECLS
