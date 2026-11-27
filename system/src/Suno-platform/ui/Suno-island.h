/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/* The shared clipped content island on the Suno window frame. Children are
 * appended with the GtkBox API; the native part paints the inset edge above
 * them, as the Python Island does. */
#define SUNO_TYPE_ISLAND (Suno_island_get_type())
G_DECLARE_FINAL_TYPE(SunoIsland, Suno_island, SUNO, ISLAND, GtkBox)

GtkWidget *Suno_island_new(GtkOrientation orientation);

G_END_DECLS
