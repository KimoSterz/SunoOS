/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include "Suno-action-bar.h"
#include "Suno-application-icon.h"
#include "Suno-adaptive-scaffold.h"
#include "Suno-application-window.h"
#include "Suno-pane.h"
#include "Suno-island.h"
#include "Suno-title-island.h"
#include "Suno-list-first.h"
#include "Suno-tab-bar.h"
#include "Suno-navigation-sidebar.h"
#include "Suno-media-fader.h"
#include "Suno-audio-meter.h"
#include "Suno-volume-slider.h"
#include "Suno-mixer-strip.h"
#include "Suno-media-row.h"
#include "Suno-segmented-control.h"
#include "Suno-inspector-section.h"
#include "Suno-histogram.h"
#include "Suno-curve-editor.h"
#include "Suno-color-well.h"
#include "Suno-context.h"
#include "Suno-surface-backdrop.h"
#include "Suno-window-shape.h"
#include "Suno-window-capture.h"
#include "Suno-restore.h"
#include "Suno-save-sheet.h"

/* SunoUI parts (ADR-052): the C twins of Suno_appkit's structure_*, action_*
 * and content_* parts, with the same widget trees and CSS classes. */
#include "Suno-ui-kit.h"
#include "Suno-layer-host.h"
#include "Suno-mode-switch.h"
#include "Suno-corner-pill.h"
#include "Suno-sidebar-foot.h"
#include "Suno-sidebar-toggle.h"
#include "Suno-badges.h"
#include "Suno-toast.h"
#include "Suno-destructive-dialog.h"
#include "Suno-stacked-button.h"
#include "Suno-controls.h"
#include "Suno-choice-list.h"
#include "Suno-progress-line.h"
#include "Suno-details-pane.h"
#include "Suno-table-header.h"
#include "Suno-action-center.h"
#include "Suno-cards.h"
#include "Suno-file-card.h"
#include "Suno-selection-bubble.h"
#include "Suno-navigation-trail-bar.h"
#include "Suno-menu-drawer.h"
#include "Suno-contact.h"
#include "Suno-text-field.h"
#include "Suno-place-search.h"
#include "Suno-message-bubble.h"
#include "Suno-type-label.h"
#include "Suno-media-transport-lcd.h"
#include "Suno-creative-workspace.h"
#include "Suno-timeline.h"

G_BEGIN_DECLS

void Suno_init(void);

/* Load an application's style sheet from a GResource and keep it in step with
 * the treatment: it is parsed again whenever the AppKit tokens change, so the
 * AppKit colours it names always resolve to the current treatment's values. */
void Suno_ui_add_style_resource(const char *resource_path, guint priority);

G_END_DECLS

#include "Suno-welcome-view.h"

#include "Suno-empty-state.h"

#include "Suno-reorder-hint.h"

#include "Suno-creative-tools.h"
#include "Suno-creative-layers.h"
#include "Suno-creative-properties.h"
#include "Suno-arrange-view.h"
#include "Suno-color-picker.h"
