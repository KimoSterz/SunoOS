/* SPDX-License-Identifier: Apache-2.0 */
/* Twin of content_message.MessageBubble. */
#include "Suno-message-bubble.h"
#include "Suno-ui-private.h"

struct _SunoMessageBubble {
  GtkBox parent_instance;
};

G_DEFINE_FINAL_TYPE(SunoMessageBubble, Suno_message_bubble, GTK_TYPE_BOX)

static void Suno_message_bubble_class_init(SunoMessageBubbleClass *klass G_GNUC_UNUSED) {}

static void Suno_message_bubble_init(SunoMessageBubble *self) {
  Suno_ui_install();
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-message");
}

static SunoMessageBubble *message_bubble_new(gboolean mine) {
  SunoMessageBubble *self = g_object_new(SUNO_TYPE_MESSAGE_BUBBLE, NULL);
  gtk_widget_set_halign(GTK_WIDGET(self), mine ? GTK_ALIGN_END : GTK_ALIGN_START);
  gtk_widget_add_css_class(GTK_WIDGET(self), mine ? "mine" : "theirs");
  return self;
}

GtkWidget *Suno_message_bubble_new(const char *text, gboolean mine) {
  if (text == NULL) {
    g_critical("a message bubble holds text or a child");
    return NULL;
  }
  SunoMessageBubble *self = message_bubble_new(mine);
  GtkWidget *label = gtk_label_new(text);
  gtk_label_set_xalign(GTK_LABEL(label), 0);
  gtk_widget_set_hexpand(label, TRUE);
  gtk_label_set_wrap(GTK_LABEL(label), TRUE);
  gtk_label_set_selectable(GTK_LABEL(label), TRUE);
  gtk_label_set_wrap_mode(GTK_LABEL(label), PANGO_WRAP_WORD_CHAR);
  gtk_label_set_max_width_chars(GTK_LABEL(label), 42);
  gtk_widget_add_css_class(label, "SunoUI-message-text");
  gtk_box_append(GTK_BOX(self), label);
  return GTK_WIDGET(self);
}

GtkWidget *Suno_message_bubble_new_with_child(GtkWidget *child, gboolean mine) {
  if (!GTK_IS_WIDGET(child)) {
    g_critical("a message bubble holds text or a child");
    return NULL;
  }
  SunoMessageBubble *self = message_bubble_new(mine);
  gtk_widget_add_css_class(GTK_WIDGET(self), "media");
  gtk_box_append(GTK_BOX(self), child);
  return GTK_WIDGET(self);
}

void Suno_message_bubble_set_joins(SunoMessageBubble *self, gboolean above, gboolean below) {
  g_return_if_fail(SUNO_IS_MESSAGE_BUBBLE(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "join-above", above);
  Suno_ui_set_css_class(GTK_WIDGET(self), "join-below", below);
}

void Suno_message_bubble_set_selected(SunoMessageBubble *self, gboolean selected) {
  g_return_if_fail(SUNO_IS_MESSAGE_BUBBLE(self));
  Suno_ui_set_css_class(GTK_WIDGET(self), "selected", selected);
}
