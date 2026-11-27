/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoRestore:
 *
 * An app's windows and state survive log-out, restarts and crashes, and
 * continue on the person's other devices (ADR-055). Every app gets its
 * windows back in place, in the same state and order, without doing
 * anything; SunoRestore is how an app also gets its own state back: which
 * documents each window had, what it showed, unsaved text.
 *
 * Give each window a key with Suno_window_set_restore_key(). When the shell
 * takes a snapshot, #SunoRestore::save collects the app's state and
 * #SunoRestore::save-window each keyed window's. When the shell starts the
 * app to restore it, Suno_restore_restore() in the app's `activate` emits
 * #SunoRestore::restore and, for each window in the snapshot's order,
 * #SunoRestore::restore-window, in which the app re-creates the window with
 * the same key. The shell places it where it was.
 *
 * ```c
 * static void
 * activate (GApplication *app)
 * {
 *   if (Suno_restore_restore (Suno_restore_get_default (GTK_APPLICATION (app))))
 *     return;
 *   open_window (app, NULL);
 * }
 * ```
 *
 * The state is the app's own, given to the shell over
 * org.projectSuno.Session1, which only ever gives an app its own state
 * back. It travels to the person's other devices end-to-end encrypted.
 * Keep it small (a few hundred kilobytes): paths and URIs, the view, and
 * unsaved text (Suno_restore_add_document()).
 *
 * Without Suno's shell, nothing is saved and Suno_restore_restore() returns
 * %FALSE.
 */
#define SUNO_TYPE_RESTORE (Suno_restore_get_type())
G_DECLARE_FINAL_TYPE(SunoRestore, Suno_restore, SUNO, RESTORE, GObject)

/**
 * Suno_restore_get_default:
 * @application: the app
 *
 * Gets the app's #SunoRestore, made on the first call. Call it in
 * `startup` or earlier so the app takes part in snapshots from the start.
 *
 * Returns: (transfer none): the app's #SunoRestore
 */
SunoRestore *Suno_restore_get_default(GtkApplication *application);

/**
 * Suno_restore_restore:
 * @restore: a #SunoRestore
 *
 * When the shell started the app to restore it, emits #SunoRestore::restore
 * and #SunoRestore::restore-window for each saved window, once. Call it at
 * the start of `activate`.
 *
 * Returns: %TRUE when windows were re-created, so `activate` opens nothing
 *   else
 */
gboolean Suno_restore_restore(SunoRestore *restore);

/**
 * Suno_restore_get_reason:
 * @restore: a #SunoRestore
 *
 * Returns: why the app was started: "restore" (log-out, restart), "continue"
 *   (from another device), "recover" (after a crash) or "none"
 */
const char *Suno_restore_get_reason(SunoRestore *restore);

/**
 * Suno_restore_add_document:
 * @state: a window's state, in #SunoRestore::save-window
 * @uri: the document's URI, or %NULL for one never saved
 * @title: (nullable): its name as the window shows it
 * @dirty: whether it has changes not saved
 * @unsaved: (nullable): the unsaved content, for a text document
 *
 * Lists a document a window has open, under the "documents" key of @state
 * as `aa{sv}` (uri, title, dirty, unsaved). Continue on another device
 * shows which documents came along and which aren't on that device.
 */
void Suno_restore_add_document(GVariantDict *state, const char *uri,
                               const char *title, gboolean dirty,
                               const char *unsaved);

/**
 * Suno_window_set_restore_key:
 * @window: a window of the app
 * @key: (nullable): a key the app can find the window by again, such as
 *   "main" or "document:3f2a"; %NULL leaves the window out of snapshots'
 *   app state
 *
 * Names @window for restoring. The shell matches the re-created window to
 * its place by this key. Call it before the window is first shown; the
 * window must be a #GtkApplicationWindow of the app.
 */
void Suno_window_set_restore_key(GtkWindow *window, const char *key);

/**
 * Suno_window_get_restore_key:
 * @window: a window
 *
 * Returns: (nullable): the window's restore key
 */
const char *Suno_window_get_restore_key(GtkWindow *window);

G_END_DECLS
