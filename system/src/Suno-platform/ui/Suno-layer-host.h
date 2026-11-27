/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI layers: the one place floating parts appear (toasts, dialogs,
 * drawers, the action center). Twin of structure_layers.py (LayerHost,
 * ModalHandle) and action_toast.py (ToastHost).
 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoModalHandle:
 *
 * An open modal card. Suno_modal_handle_close() dismisses it without telling
 * the owner; Suno_modal_handle_cancel() closes it as Esc would and emits
 * #SunoModalHandle::cancelled.
 */
#define SUNO_TYPE_MODAL_HANDLE (Suno_modal_handle_get_type())
G_DECLARE_FINAL_TYPE(SunoModalHandle, Suno_modal_handle, SUNO, MODAL_HANDLE, GObject)

void Suno_modal_handle_cancel(SunoModalHandle *self);
void Suno_modal_handle_close(SunoModalHandle *self);
/**
 * Suno_modal_handle_nudge:
 * @self: a handle
 *
 * Shake the card sideways: the window behind is not available yet.
 */
void Suno_modal_handle_nudge(SunoModalHandle *self);
/**
 * Suno_modal_handle_get_card:
 * @self: a handle
 *
 * Returns: (transfer none): the card being shown
 */
GtkWidget *Suno_modal_handle_get_card(SunoModalHandle *self);
gboolean Suno_modal_handle_get_is_drawer(SunoModalHandle *self);

/**
 * SunoLayerHost:
 *
 * An overlay (CSS node `overlay`) that owns what floats over one region. A
 * window's own host is made on first use; an app may wrap its main island in
 * one so toasts centre on it (Python's ToastHost is the same host).
 */
#define SUNO_TYPE_LAYER_HOST (Suno_layer_host_get_type())
G_DECLARE_FINAL_TYPE(SunoLayerHost, Suno_layer_host, SUNO, LAYER_HOST, GtkWidget)

/**
 * Suno_layer_host_new:
 * @child: (nullable): the region's content
 *
 * Returns: (transfer floating): a new host around @child
 */
GtkWidget *Suno_layer_host_new(GtkWidget *child);
void Suno_layer_host_set_child(SunoLayerHost *self, GtkWidget *child);
/**
 * Suno_layer_host_get_child:
 * @self: a host
 *
 * Returns: (transfer none) (nullable): the region's content
 */
GtkWidget *Suno_layer_host_get_child(SunoLayerHost *self);

/**
 * Suno_layer_host_for_widget:
 * @widget: a widget in a window
 *
 * The nearest host at or above @widget; the window's own is made on first use.
 *
 * Returns: (transfer none) (nullable): the host, %NULL when @widget has no window
 */
SunoLayerHost *Suno_layer_host_for_widget(GtkWidget *widget);

/**
 * Suno_layer_host_window_host:
 * @widget: a widget in a window
 *
 * The host of the window @widget is in: modal cards dim the whole window
 * (below the title row on a #SunoApplicationWindow).
 *
 * Returns: (transfer none) (nullable): the host
 */
SunoLayerHost *Suno_layer_host_window_host(GtkWidget *widget);

/**
 * Suno_layer_host_install:
 * @window: a window
 *
 * The window's host: its own, or its content wrapped in one (once).
 *
 * Returns: (transfer none): the host
 */
SunoLayerHost *Suno_layer_host_install(GtkWindow *window);

/**
 * SunoDrawerMode:
 * @SUNO_DRAWER_MODE_AUTO: a drawer at phone width, a centred card otherwise
 * @SUNO_DRAWER_MODE_NEVER: always a centred card
 * @SUNO_DRAWER_MODE_ALWAYS: always a bottom drawer
 */
typedef enum {
  SUNO_DRAWER_MODE_AUTO,
  SUNO_DRAWER_MODE_NEVER,
  SUNO_DRAWER_MODE_ALWAYS,
} SunoDrawerMode;
GType Suno_drawer_mode_get_type(void);
#define SUNO_TYPE_DRAWER_MODE (Suno_drawer_mode_get_type())

/**
 * Suno_layer_host_present_modal:
 * @self: a host
 * @card: the card to show over a scrim
 * @initial_focus: (nullable): what takes focus first
 * @mode: whether it is a drawer
 *
 * Show @card over a scrim: Esc and a tap on the scrim cancel it, Tab stays
 * inside, focus returns where it was when it closes.
 *
 * Returns: (transfer none): the handle, valid until the card closes
 */
SunoModalHandle *Suno_layer_host_present_modal(SunoLayerHost *self, GtkWidget *card,
                                               GtkWidget *initial_focus, SunoDrawerMode mode);

/**
 * Suno_layer_host_get_modal:
 * @self: a host
 *
 * Returns: (transfer none) (nullable): the open modal, if any
 */
SunoModalHandle *Suno_layer_host_get_modal(SunoLayerHost *self);

/**
 * Suno_layer_host_track_bar:
 * @self: a host
 * @bar: a floating bar at the foot of this region
 *
 * Keep toasts above @bar while it shows. The action center does this itself.
 */
void Suno_layer_host_track_bar(SunoLayerHost *self, GtkWidget *bar);

G_END_DECLS
