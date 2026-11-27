/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <gtk/gtk.h>
G_BEGIN_DECLS
#define SUNO_TYPE_APPLICATION_ICON (Suno_application_icon_get_type())
G_DECLARE_FINAL_TYPE(SunoApplicationIcon, Suno_application_icon, SUNO, APPLICATION_ICON, GObject)
/**
 * Suno_application_icon_new:
 * @artwork: the original application artwork
 *
 * Presents artwork on Suno's square gradient tile with a proportional rounded
 * mask. Folder/file thumbnails should retain their own presentation.
 *
 * Returns: (transfer full): the normalized application paintable
 */
GdkPaintable *Suno_application_icon_new(GdkPaintable *artwork);
G_END_DECLS
