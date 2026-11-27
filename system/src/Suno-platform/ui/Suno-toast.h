/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of action_toast.Toast (Python). ToastHost is #SunoLayerHost. */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoToast:
 *
 * One toast for what just happened, centred on the region it belongs to and
 * kept above that region's floating bar. It stays 2.4 s, 4 s with Undo, and a
 * busy toast until Suno_toast_dismiss(). A new toast replaces the region's
 * current one.
 *
 * Kinds (unknown kinds are refused, the table is action_toast.TOAST_KINDS):
 * "done", "added", "saved", "sent", "place", "favourite", "unfavourite",
 * "copied", "deleted", "archived", "downloaded", "notified", "signed-out",
 * "paused", "undone", "opening", "warning", "error".
 *
 * Emits #SunoToast::undo when Undo is pressed.
 */
#define SUNO_TYPE_TOAST (Suno_toast_get_type())
G_DECLARE_FINAL_TYPE(SunoToast, Suno_toast, SUNO, TOAST, GtkBox)

/**
 * Suno_toast_new:
 * @message: what happened
 * @kind: (nullable): a toast kind; %NULL is "done"
 * @undo: whether it has an Undo button
 * @busy: whether it leads with a spinner instead of the kind's glyph
 *
 * The toast card alone, not shown anywhere (Python's `Toast(...)`); apps use
 * Suno_toast_show() and friends. An unknown kind is refused (critical, %NULL).
 *
 * Returns: (transfer floating) (nullable): a new toast
 */
GtkWidget *Suno_toast_new(const char *message, const char *kind, gboolean undo, gboolean busy);
/**
 * Suno_toast_show:
 * @where: a widget in the region the toast belongs to
 * @message: what happened ("Copied")
 * @kind: (nullable): a toast kind; %NULL is "done"
 *
 * Returns: (transfer none): the toast, valid until it goes
 */
SunoToast *Suno_toast_show(GtkWidget *where, const char *message, const char *kind);
/**
 * Suno_toast_show_with_undo:
 * @where: a widget in the region
 * @message: what happened ("Deleted 3 photos")
 * @kind: (nullable): a toast kind
 *
 * A toast with Undo; connect to #SunoToast::undo on the result.
 *
 * Returns: (transfer none): the toast
 */
SunoToast *Suno_toast_show_with_undo(GtkWidget *where, const char *message, const char *kind);
/**
 * Suno_toast_show_busy:
 * @where: a widget in the region
 * @message: what is happening ("Uploading…")
 *
 * A spinner toast that stays until Suno_toast_dismiss().
 *
 * Returns: (transfer none): the toast
 */
SunoToast *Suno_toast_show_busy(GtkWidget *where, const char *message);
void Suno_toast_dismiss(SunoToast *self);
/**
 * Suno_toast_get_timeout_ms:
 * @self: a toast
 *
 * Returns: how long it stays, 0 when busy
 */
guint Suno_toast_get_timeout_ms(SunoToast *self);
/**
 * Suno_toast_kind_is_known:
 * @kind: a kind
 *
 * Returns: whether the kit knows @kind
 */
gboolean Suno_toast_kind_is_known(const char *kind);

G_END_DECLS
