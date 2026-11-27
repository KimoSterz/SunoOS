/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <adwaita.h>

G_BEGIN_DECLS

/**
 * SunoSaveChoice:
 * @SUNO_SAVE_CHOICE_SAVE: save this document; for an untitled one, into the
 *   destination the person chose on the sheet
 * @SUNO_SAVE_CHOICE_DISCARD: close this document without saving it
 * @SUNO_SAVE_CHOICE_CANCEL: keep editing; a quit in progress stops
 * @SUNO_SAVE_CHOICE_QUIT: every document of a quit is answered, or the person
 *   chose Discard all: quit now
 * @SUNO_SAVE_CHOICE_OTHER: the other choice the application added with
 *   Suno_save_sheet_add_choice()
 *
 * What the person chose on the save sheet. The application acts on each one.
 */
typedef enum {
  SUNO_SAVE_CHOICE_SAVE,
  SUNO_SAVE_CHOICE_DISCARD,
  SUNO_SAVE_CHOICE_CANCEL,
  SUNO_SAVE_CHOICE_QUIT,
  SUNO_SAVE_CHOICE_OTHER,
} SunoSaveChoice;

GType Suno_save_choice_get_type (void);
#define SUNO_TYPE_SAVE_CHOICE (Suno_save_choice_get_type ())

/**
 * SunoSheetRole:
 * @SUNO_SHEET_ROLE_NONE: not one of the sheet's answers
 * @SUNO_SHEET_ROLE_PRIMARY: the answer the sheet is for (Save, Continue); the default
 * @SUNO_SHEET_ROLE_SECONDARY: the other equal choice (Start Over)
 * @SUNO_SHEET_ROLE_CANCEL: changes nothing; Escape, the back gesture, a swipe
 *   down and a tap outside the sheet are this answer
 * @SUNO_SHEET_ROLE_DESTRUCTIVE: a destructive third choice (Don't Save),
 *   never filled and never the default
 * @SUNO_SHEET_ROLE_DESTRUCTIVE_ACTION: the destructive action the sheet asks
 *   about (Delete), drawn in the danger fill beside Cancel
 *
 * What each button on a sheet means. The kit lays a sheet's buttons out from
 * their roles, in the shape the window's size class calls for: on a phone two
 * choices side by side with the primary on the right, and a third as a quiet
 * row beneath. Buttons with the sheet classes have roles already:
 * `Suno-save-primary` is the primary, `Suno-save-secondary` Cancel,
 * `Suno-save-discard` destructive, `SunoUI-dialog-cancel` Cancel and
 * `SunoUI-dialog-action` the destructive action.
 */
typedef enum {
  SUNO_SHEET_ROLE_NONE,
  SUNO_SHEET_ROLE_PRIMARY,
  SUNO_SHEET_ROLE_SECONDARY,
  SUNO_SHEET_ROLE_CANCEL,
  SUNO_SHEET_ROLE_DESTRUCTIVE,
  SUNO_SHEET_ROLE_DESTRUCTIVE_ACTION,
} SunoSheetRole;

GType Suno_sheet_role_get_type (void);
#define SUNO_TYPE_SHEET_ROLE (Suno_sheet_role_get_type ())

void          Suno_sheet_button_set_role (GtkWidget *button,
                                          SunoSheetRole role);
SunoSheetRole Suno_sheet_button_get_role (GtkWidget *button);

/* ── The facts about one unsaved document ─────────────────────────────── */

#define SUNO_TYPE_SAVE_DOCUMENT (Suno_save_document_get_type ())
G_DECLARE_FINAL_TYPE (SunoSaveDocument, Suno_save_document, SUNO, SAVE_DOCUMENT, GObject)

SunoSaveDocument *Suno_save_document_new              (const char       *name);
const char       *Suno_save_document_get_name         (SunoSaveDocument *self);
void              Suno_save_document_set_never_saved  (SunoSaveDocument *self,
                                                       gboolean          never_saved);
gboolean          Suno_save_document_get_never_saved  (SunoSaveDocument *self);
void              Suno_save_document_set_unsaved_seconds (SunoSaveDocument *self,
                                                          double            seconds);
double            Suno_save_document_get_unsaved_seconds (SunoSaveDocument *self);
void              Suno_save_document_set_window       (SunoSaveDocument *self,
                                                       GtkWindow        *window);
GtkWindow        *Suno_save_document_get_window       (SunoSaveDocument *self);
void              Suno_save_document_set_extension    (SunoSaveDocument *self,
                                                       const char       *extension);
void              Suno_save_document_add_place        (SunoSaveDocument *self,
                                                       const char       *label,
                                                       const char       *path);
void              Suno_save_document_set_recovery_copy (SunoSaveDocument *self,
                                                        gboolean          recovery_copy);
void              Suno_save_document_set_kind         (SunoSaveDocument *self,
                                                       const char       *kind);

/* ── The sheet ─────────────────────────────────────────────────────────── */

#define SUNO_TYPE_SAVE_SHEET (Suno_save_sheet_get_type ())
G_DECLARE_FINAL_TYPE (SunoSaveSheet, Suno_save_sheet, SUNO, SAVE_SHEET, GtkWidget)

SunoSaveSheet *Suno_save_sheet_new              (SunoSaveDocument * const *documents,
                                                 guint                     n_documents,
                                                 gboolean                  quitting);
void           Suno_save_sheet_present          (SunoSaveSheet *self,
                                                 GtkWindow     *window);
void           Suno_save_sheet_activate_primary (SunoSaveSheet *self);
void           Suno_save_sheet_activate_cancel  (SunoSaveSheet *self);
void           Suno_save_sheet_activate_discard (SunoSaveSheet *self);
void           Suno_save_sheet_finish_save      (SunoSaveSheet *self,
                                                 const char    *problem);
void           Suno_save_sheet_show_error       (SunoSaveSheet *self,
                                                 const char    *message);
const char    *Suno_save_sheet_get_case         (SunoSaveSheet *self);
gboolean       Suno_save_sheet_get_open         (SunoSaveSheet *self);
GtkLabel      *Suno_save_sheet_get_title_label  (SunoSaveSheet *self);
GtkLabel      *Suno_save_sheet_get_body_label   (SunoSaveSheet *self);
GtkLabel      *Suno_save_sheet_get_error_label  (SunoSaveSheet *self);
GtkButton     *Suno_save_sheet_get_primary_button (SunoSaveSheet *self);
GtkButton     *Suno_save_sheet_get_cancel_button  (SunoSaveSheet *self);
GtkButton     *Suno_save_sheet_get_discard_button (SunoSaveSheet *self);
GtkButton     *Suno_save_sheet_add_choice       (SunoSaveSheet *self,
                                                 const char    *label);
GtkEntry      *Suno_save_sheet_get_name_entry   (SunoSaveSheet *self);
GtkDropDown   *Suno_save_sheet_get_where        (SunoSaveSheet *self);
GtkWidget     *Suno_save_sheet_get_card         (SunoSaveSheet *self);
SunoSaveSheet *Suno_save_sheet_get_for_window   (GtkWindow     *window);

/* ── The request: one question, or a quit over several documents ──────── */

#define SUNO_TYPE_SAVE_REQUEST (Suno_save_request_get_type ())
G_DECLARE_FINAL_TYPE (SunoSaveRequest, Suno_save_request, SUNO, SAVE_REQUEST, GObject)

SunoSaveRequest *Suno_save_request_new         (SunoSaveDocument * const *documents,
                                                guint                     n_documents,
                                                gboolean                  quitting);
void             Suno_save_request_present     (SunoSaveRequest *self,
                                                GtkWindow       *window);
void             Suno_save_request_finish_save (SunoSaveRequest *self,
                                                const char      *problem);
void             Suno_save_request_cancel      (SunoSaveRequest *self);
SunoSaveSheet   *Suno_save_request_get_sheet   (SunoSaveRequest *self);

/* ── The window's sheet layer ─────────────────────────────────────────── */

void       Suno_window_set_sheet_layer       (GtkWindow          *window,
                                              GtkOverlay         *layer,
                                              GtkWidget          *content,
                                              GtkWidget          *title_bar);
void       Suno_window_present_sheet         (GtkWindow          *window,
                                              GtkWidget          *sheet,
                                              GtkEventController *keys);
void       Suno_window_dismiss_sheet         (GtkWindow          *window);
GtkWidget *Suno_window_get_presented_sheet   (GtkWindow          *window);

void       Suno_ui_tokens_provided_by_application (void);

G_END_DECLS
