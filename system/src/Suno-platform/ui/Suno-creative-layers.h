/* SPDX-License-Identifier: Apache-2.0 */
/*
 * SunoUI creative family (KB-D): the layer tree (v70 .sulyr, .sucar,
 * .sueye) and the layer it shows.
 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SunoLayer:
 *
 * One thing in a document's layer tree: a frame, shape, text, image, chart
 * or heading. The app owns its layers and keeps them current; the tree
 * shows whatever they say, and follows their changes.
 */
#define SUNO_TYPE_LAYER (Suno_layer_get_type())
G_DECLARE_FINAL_TYPE(SunoLayer, Suno_layer, SUNO, LAYER, GObject)

/**
 * Suno_layer_new:
 * @id: the layer's stable id in the document
 * @name: its name ("Hero")
 * @icon: a Lucide glyph for its kind ("hash" for a frame, "square", "type")
 *
 * Returns: (transfer full): a new, visible, expanded layer without children
 */
SunoLayer *Suno_layer_new(const char *id, const char *name, const char *icon);

const char *Suno_layer_get_id(SunoLayer *self);
const char *Suno_layer_get_name(SunoLayer *self);
void Suno_layer_set_name(SunoLayer *self, const char *name);
const char *Suno_layer_get_icon(SunoLayer *self);
void Suno_layer_set_icon(SunoLayer *self, const char *icon);
gboolean Suno_layer_get_visible(SunoLayer *self);
void Suno_layer_set_visible(SunoLayer *self, gboolean visible);
/**
 * Suno_layer_set_can_hide:
 * @self: a layer
 * @can_hide: whether its row has the eye (an outline's headings have none)
 */
void Suno_layer_set_can_hide(SunoLayer *self, gboolean can_hide);
gboolean Suno_layer_get_can_hide(SunoLayer *self);
/**
 * Suno_layer_set_detail:
 * @self: a layer
 * @detail: (nullable): a quiet note at the row's end ("E2:E24", a count)
 */
void Suno_layer_set_detail(SunoLayer *self, const char *detail);
const char *Suno_layer_get_detail(SunoLayer *self);
void Suno_layer_set_expanded(SunoLayer *self, gboolean expanded);
gboolean Suno_layer_get_expanded(SunoLayer *self);

/**
 * Suno_layer_get_children:
 * @self: a layer
 *
 * The layer's children, topmost first, as a #GListStore of #SunoLayer the
 * app may edit directly.
 *
 * Returns: (transfer none): the children
 */
GListModel *Suno_layer_get_children(SunoLayer *self);
/**
 * Suno_layer_append:
 * @self: a layer
 * @child: a layer to put last (lowest) among its children
 */
void Suno_layer_append(SunoLayer *self, SunoLayer *child);

/**
 * SunoLayerTree:
 *
 * A document's layers as a tree (v70 .sulyr), topmost first: a caret opens
 * a layer's children, its icon says what it is, and an eye (shown on hover,
 * or always while hidden) shows or hides it. Selection is the object
 * selection (one token, shared with the canvas): click chooses, Ctrl adds,
 * Shift extends. Enter activates a layer; F2 or a double click renames it;
 * dragging a row, or Alt+Up and Alt+Down, asks to move it.
 *
 * The tree changes the #SunoLayer properties a person edits (name, visible,
 * expanded) and says so; it never moves layers itself, it asks with
 * #SunoLayerTree::move-requested.
 *
 * Tree: list.SunoUI-creative-layers > row > box.SunoUI-creative-layer(.selected)(.hidden)
 *   ├ button.SunoUI-creative-layer-caret(.open) | box.SunoUI-creative-layer-caret
 *   ├ image.SunoUI-creative-layer-icon
 *   ├ label.SunoUI-creative-layer-name (entry.SunoUI-creative-layer-rename while renaming)
 *   ├ label.SunoUI-creative-layer-detail
 *   └ button.SunoUI-creative-layer-eye
 */
#define SUNO_TYPE_LAYER_TREE (Suno_layer_tree_get_type())
G_DECLARE_FINAL_TYPE(SunoLayerTree, Suno_layer_tree, SUNO, LAYER_TREE, GtkWidget)

/**
 * Suno_layer_tree_new:
 * @layers: (nullable): the top-level layers, topmost first (#SunoLayer items)
 *
 * Returns: (transfer floating): a new layer tree
 */
GtkWidget *Suno_layer_tree_new(GListModel *layers);

void Suno_layer_tree_set_layers(SunoLayerTree *self, GListModel *layers);
/**
 * Suno_layer_tree_get_layers:
 * @self: a layer tree
 * Returns: (transfer none) (nullable): the top-level layers
 */
GListModel *Suno_layer_tree_get_layers(SunoLayerTree *self);

/**
 * Suno_layer_tree_set_selected:
 * @self: a layer tree
 * @ids: (array zero-terminated=1) (nullable): the selected layers' ids
 *
 * Select layers (the canvas's selection) without emitting
 * #SunoLayerTree::selection-changed. Collapsed parents of a selected layer
 * open so it shows.
 */
void Suno_layer_tree_set_selected(SunoLayerTree *self, const char *const *ids);
/**
 * Suno_layer_tree_get_selected:
 * @self: a layer tree
 * Returns: (transfer full) (array zero-terminated=1): the selected ids, topmost first
 */
char **Suno_layer_tree_get_selected(SunoLayerTree *self);

/**
 * Suno_layer_tree_find:
 * @self: a layer tree
 * @id: a layer's id
 * Returns: (transfer none) (nullable): the layer
 */
SunoLayer *Suno_layer_tree_find(SunoLayerTree *self, const char *id);

/**
 * Suno_layer_tree_rename:
 * @self: a layer tree
 * @id: a layer's id
 *
 * Start renaming a layer in place, as F2 would.
 */
void Suno_layer_tree_rename(SunoLayerTree *self, const char *id);

G_END_DECLS
