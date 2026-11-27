/* SPDX-License-Identifier: Apache-2.0 */
#pragma once

#include <gtk/gtk.h>

G_BEGIN_DECLS

/* Shared value-over-caption button, also used by the LCD transport. The
 * caller connects GtkButton::clicked and controls sensitivity. */
GtkWidget *Suno_media_readout_new(const char *value, const char *caption);
void Suno_media_readout_set_value(GtkWidget *self, const char *value);
void Suno_media_readout_set_chip(GtkWidget *self, gboolean chip);

/* The native MD1 Session transport. The app owns playback and supplies the
 * displayed values; the kit owns the controls, readouts and phone layout. */
#define SUNO_TYPE_MEDIA_TRANSPORT_LCD (Suno_media_transport_lcd_get_type())
G_DECLARE_FINAL_TYPE(SunoMediaTransportLcd, Suno_media_transport_lcd, SUNO, MEDIA_TRANSPORT_LCD, GtkBox)

/* Signals: play-changed (gboolean), record-changed (gboolean),
 * loop-changed (gboolean), seek-start (), readout-activated (const char *key).
 * The three readout keys are "tempo", "signature" and "key". */
GtkWidget *Suno_media_transport_lcd_new(void);
void Suno_media_transport_lcd_set_lcd(SunoMediaTransportLcd *self, const char *bar, const char *time);
void Suno_media_transport_lcd_set_readout(SunoMediaTransportLcd *self, const char *key, const char *value);
void Suno_media_transport_lcd_set_playing(SunoMediaTransportLcd *self, gboolean playing);
void Suno_media_transport_lcd_set_recording(SunoMediaTransportLcd *self, gboolean recording);
void Suno_media_transport_lcd_set_looping(SunoMediaTransportLcd *self, gboolean looping);

/** Return a borrowed control for action binding, accessibility or sensitivity.
 * Keys: start, play, record, loop, tempo, signature, key. Unknown keys return NULL. */
GtkWidget *Suno_media_transport_lcd_get_control(SunoMediaTransportLcd *self, const char *key);

G_END_DECLS
