/* SPDX-License-Identifier: Apache-2.0 */
#include "Suno-navigation-sidebar.h"
#include "Suno-ui-private.h"
#include "Suno-ui-tokens-private.h"

struct _SunoNavigationSidebar {
  GtkBox parent_instance;
  GtkWidget *header;
  GtkWidget *list;
  GtkWidget *footer;
  GtkWidget *scroll;
  gboolean footer_fade;
  char *variant;
  gboolean tv, rail;
  gboolean header_shown, footer_shown; /* as the app left them, for leaving TV posture */
  GtkAlign valign_shown;
};
G_DEFINE_FINAL_TYPE(SunoNavigationSidebar, Suno_navigation_sidebar, GTK_TYPE_BOX)

static const char *const variants[] = {"people", "destinations", "resources", "files", "tree", "settings"};
static const int variant_widths[] = {SUNO_UI_NAV_PEOPLE_WIDTH, SUNO_UI_NAV_DESTINATIONS_WIDTH,
                                     SUNO_UI_NAV_RESOURCES_WIDTH, SUNO_UI_NAV_FILES_WIDTH,
                                     SUNO_UI_NAV_TREE_WIDTH, SUNO_UI_NAV_SETTINGS_WIDTH};

static void mark_body(SunoNavigationSidebar *self, gboolean shown) {
  GtkWidget *body = gtk_widget_get_parent(GTK_WIDGET(self));
  while (body != NULL && !gtk_widget_has_css_class(body, "Suno-window-body"))
    body = gtk_widget_get_parent(body);
  if (body == NULL) return;
  int count = GPOINTER_TO_INT(g_object_get_data(G_OBJECT(body), "Suno-frame-sidebars"));
  count = MAX(0, count + (shown ? 1 : -1));
  g_object_set_data(G_OBJECT(body), "Suno-frame-sidebars", GINT_TO_POINTER(count));
  Suno_ui_set_css_class(body, "SunoUI-frame-sidebar", count > 0);
}

/* v70 .cfside's own right padding is its gap to the island: in the Settings variant the frame
 * gives none of its own (the frame box's spacing is 0 while it is shown). */
static void frame_gap(SunoNavigationSidebar *self, gboolean shown) {
  /* The frame box may hold the sidebar through a wrapper (SunoSidebarToggle's revealer). */
  GtkWidget *frame = gtk_widget_get_parent(GTK_WIDGET(self));
  while (frame != NULL && !GTK_IS_BOX(frame))
    frame = gtk_widget_get_parent(frame);
  if (frame == NULL || g_strcmp0(self->variant, "settings") != 0)
    return;
  gtk_box_set_spacing(GTK_BOX(frame), shown ? 0 : SUNO_UI_WINDOW_GUTTER);
}

static void sidebar_mapped(GtkWidget *widget, gpointer data G_GNUC_UNUSED) {
  mark_body(SUNO_NAVIGATION_SIDEBAR(widget), TRUE);
  frame_gap(SUNO_NAVIGATION_SIDEBAR(widget), TRUE);
}
static void sidebar_unmapped(GtkWidget *widget, gpointer data G_GNUC_UNUSED) {
  mark_body(SUNO_NAVIGATION_SIDEBAR(widget), FALSE);
  /* Hidden (the toggle's revealer, a phone), it gives no gap either: the body's own 8 is the island's inset. */
  frame_gap(SUNO_NAVIGATION_SIDEBAR(widget), TRUE);
}

static void Suno_navigation_sidebar_dispose(GObject *object) {
  SunoNavigationSidebar *self = SUNO_NAVIGATION_SIDEBAR(object);
  g_clear_pointer(&self->variant, g_free);
  G_OBJECT_CLASS(Suno_navigation_sidebar_parent_class)->dispose(object);
}
static void sidebar_snapshot(GtkWidget *widget, GtkSnapshot *snapshot) {
  SunoNavigationSidebar *self = SUNO_NAVIGATION_SIDEBAR(widget);
  GtkAdjustment *adjustment = gtk_scrolled_window_get_vadjustment(GTK_SCROLLED_WINDOW(self->scroll));
  gboolean fading = self->footer_fade && gtk_widget_get_visible(self->footer) &&
    gtk_adjustment_get_value(adjustment) + gtk_adjustment_get_page_size(adjustment) < gtk_adjustment_get_upper(adjustment) - 1;
  for (GtkWidget *child = gtk_widget_get_first_child(widget); child; child = gtk_widget_get_next_sibling(child)) {
    if (!gtk_widget_get_visible(child)) continue;
    graphene_rect_t bounds;
    if (child != self->scroll || !fading || !gtk_widget_compute_bounds(child, widget, &bounds) || bounds.size.height <= 0) {
      gtk_widget_snapshot_child(widget, child, snapshot);
      continue;
    }
    float fade = MIN(24.f, bounds.size.height / 3.f);
    GskColorStop stops[] = {{0, {1, 1, 1, 1}}, {1 - fade / bounds.size.height, {1, 1, 1, 1}}, {1, {1, 1, 1, 0}}};
    graphene_point_t start = GRAPHENE_POINT_INIT(bounds.origin.x, bounds.origin.y);
    graphene_point_t end = GRAPHENE_POINT_INIT(bounds.origin.x, bounds.origin.y + bounds.size.height);
    gtk_snapshot_push_mask(snapshot, GSK_MASK_MODE_ALPHA);
    gtk_snapshot_append_linear_gradient(snapshot, &bounds, &start, &end, stops, G_N_ELEMENTS(stops));
    gtk_snapshot_pop(snapshot);
    gtk_widget_snapshot_child(widget, child, snapshot);
    gtk_snapshot_pop(snapshot);
  }
}
static void sidebar_scroll_changed(GtkAdjustment *adjustment G_GNUC_UNUSED, GtkWidget *widget) {
  gtk_widget_queue_draw(widget);
}
void Suno_navigation_sidebar_set_footer_fade(SunoNavigationSidebar *self, gboolean enabled) {
  g_return_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self));
  self->footer_fade = enabled;
  gtk_widget_queue_draw(GTK_WIDGET(self));
}

static void Suno_navigation_sidebar_class_init(SunoNavigationSidebarClass *klass) {
  G_OBJECT_CLASS(klass)->dispose = Suno_navigation_sidebar_dispose;
  GTK_WIDGET_CLASS(klass)->snapshot = sidebar_snapshot;
}

static void Suno_navigation_sidebar_init(SunoNavigationSidebar *self) {
  gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_VERTICAL);
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-navigation-sidebar");
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-sidebar-surface");
  gtk_widget_set_hexpand(GTK_WIDGET(self), FALSE);
  gtk_widget_set_margin_end(GTK_WIDGET(self), SUNO_UI_SIDEBAR_GUTTER);
  gtk_widget_set_size_request(GTK_WIDGET(self), SUNO_UI_SIDEBAR_WIDTH - 2 * SUNO_UI_SIDEBAR_GUTTER, -1);
  self->header = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_visible(self->header, FALSE);
  gtk_box_append(GTK_BOX(self), self->header);
  GtkWidget *scroll = gtk_scrolled_window_new();
  self->scroll = scroll;
  self->footer_fade = TRUE;
  GtkAdjustment *adjustment = gtk_scrolled_window_get_vadjustment(GTK_SCROLLED_WINDOW(scroll));
  g_signal_connect_object(adjustment, "value-changed", G_CALLBACK(sidebar_scroll_changed), self, 0);
  g_signal_connect_object(adjustment, "changed", G_CALLBACK(sidebar_scroll_changed), self, 0);
  gtk_scrolled_window_set_policy(GTK_SCROLLED_WINDOW(scroll), GTK_POLICY_NEVER, GTK_POLICY_AUTOMATIC);
  /* A visible navigation scrollbar gets its own track at the sidebar's edge;
   * it must never paint over destination labels or the selected chip. */
  gtk_scrolled_window_set_overlay_scrolling(GTK_SCROLLED_WINDOW(scroll), FALSE);
  gtk_widget_set_vexpand(scroll, TRUE);
  self->list = gtk_list_box_new();
  gtk_widget_add_css_class(self->list, "Suno-navigation-list");
  gtk_list_box_set_selection_mode(GTK_LIST_BOX(self->list), GTK_SELECTION_SINGLE);
  gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroll), self->list);
  gtk_box_append(GTK_BOX(self), scroll);
  self->footer = gtk_box_new(GTK_ORIENTATION_VERTICAL, 4);
  gtk_widget_add_css_class(self->footer, "Suno-navigation-footer");
  gtk_widget_set_visible(self->footer, FALSE);
  gtk_box_append(GTK_BOX(self), self->footer);
  g_signal_connect(self, "map", G_CALLBACK(sidebar_mapped), NULL);
  g_signal_connect(self, "unmap", G_CALLBACK(sidebar_unmapped), NULL);
}

GtkWidget *Suno_navigation_sidebar_new(const char *variant, const char *width) {
  GtkWidget *self = g_object_new(SUNO_TYPE_NAVIGATION_SIDEBAR, NULL);
  Suno_navigation_sidebar_set_variant(SUNO_NAVIGATION_SIDEBAR(self), variant, width);
  return self;
}

void Suno_navigation_sidebar_set_variant(SunoNavigationSidebar *self, const char *variant, const char *width) {
  g_return_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self));
  int pixels = SUNO_UI_SIDEBAR_WIDTH;
  if (variant != NULL) {
    guint i;
    for (i = 0; i < G_N_ELEMENTS(variants); i++)
      if (g_str_equal(variant, variants[i])) break;
    g_return_if_fail(i < G_N_ELEMENTS(variants));
    pixels = variant_widths[i];
  }
  if (width != NULL) {
    if (g_str_equal(width, "narrow")) pixels = SUNO_UI_NAV_WIDTHS_NARROW;
    else if (g_str_equal(width, "regular")) pixels = SUNO_UI_NAV_WIDTHS_REGULAR;
    else if (g_str_equal(width, "wide")) pixels = SUNO_UI_NAV_WIDTHS_WIDE;
    else { g_return_if_fail(FALSE); }
  }
  if (self->variant != NULL) {
    g_autofree char *old = g_strconcat("SunoUI-sidebar-", self->variant, NULL);
    gtk_widget_remove_css_class(GTK_WIDGET(self), old);
  }
  g_free(self->variant);
  self->variant = g_strdup(variant);
  Suno_ui_set_css_class(GTK_WIDGET(self), "SunoUI-sidebar-variant", variant != NULL || width != NULL);
  if (variant != NULL) {
    g_autofree char *name = g_strconcat("SunoUI-sidebar-", variant, NULL);
    gtk_widget_add_css_class(GTK_WIDGET(self), name);
  }
  gtk_widget_set_size_request(GTK_WIDGET(self), pixels - 2 * SUNO_UI_SIDEBAR_GUTTER, -1);
}

void Suno_navigation_sidebar_append_header(SunoNavigationSidebar *self, GtkWidget *child) {
  g_return_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self) && GTK_IS_WIDGET(child));
  gtk_box_append(GTK_BOX(self->header), child);
  gtk_widget_set_visible(self->header, TRUE);
}
void Suno_navigation_sidebar_append_footer(SunoNavigationSidebar *self, GtkWidget *child) {
  g_return_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self) && GTK_IS_WIDGET(child));
  gtk_box_append(GTK_BOX(self->footer), child);
  gtk_widget_set_visible(self->footer, TRUE);
}
static void row_tv(GtkWidget *row, gboolean tv, gboolean rail);
void Suno_navigation_sidebar_append_row(SunoNavigationSidebar *self, GtkListBoxRow *row) {
  g_return_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self) && GTK_IS_LIST_BOX_ROW(row));
  gtk_list_box_append(GTK_LIST_BOX(self->list), GTK_WIDGET(row));
  if (self->tv && SUNO_IS_NAVIGATION_ROW(row))
    row_tv(GTK_WIDGET(row), TRUE, self->rail);
}
void Suno_navigation_sidebar_append_section(SunoNavigationSidebar *self, const char *label) {
  g_return_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self) && label != NULL);
  GtkWidget *row = gtk_list_box_row_new();
  gtk_list_box_row_set_selectable(GTK_LIST_BOX_ROW(row), FALSE);
  gtk_list_box_row_set_activatable(GTK_LIST_BOX_ROW(row), FALSE);
  gtk_widget_add_css_class(row, "Suno-navigation-section");
  gtk_widget_add_css_class(row, "SunoUI-row-section");
  GtkWidget *line = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(line, "Suno-navigation-heading-line");
  GtkWidget *heading = gtk_label_new(label);
  gtk_label_set_xalign(GTK_LABEL(heading), 0);
  gtk_widget_set_hexpand(heading, TRUE);
  gtk_widget_add_css_class(heading, "Suno-navigation-heading");
  gtk_box_append(GTK_BOX(line), heading);
  gtk_list_box_row_set_child(GTK_LIST_BOX_ROW(row), line);
  Suno_ui_set_accessible_label(row, label);
  gtk_list_box_append(GTK_LIST_BOX(self->list), row);
  gtk_widget_set_visible(heading, !self->tv); /* on a TV a section is a hairline */
}
void Suno_navigation_sidebar_clear(SunoNavigationSidebar *self) {
  g_return_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self));
  for (GtkWidget *child = gtk_widget_get_first_child(self->list); child != NULL; ) {
    GtkWidget *next = gtk_widget_get_next_sibling(child);
    gtk_list_box_remove(GTK_LIST_BOX(self->list), child);
    child = next;
  }
}
GtkListBox *Suno_navigation_sidebar_get_list(SunoNavigationSidebar *self) {
  g_return_val_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self), NULL);
  return GTK_LIST_BOX(self->list);
}

/* Opted-in native sidebars keep their GtkListBoxRow objects, action handlers,
 * selection and DnD. A compact rail only changes the presentation of rows
 * with the common icon/label structure; other row types remain untouched.
 * Calling adapt_live again after an app adds rows dresses the new ones. */
static void adapt_live_rail_rows(GtkWidget *widget, gboolean roomy) {
  if (GTK_IS_LIST_BOX_ROW(widget)) {
    GtkWidget *child = gtk_list_box_row_get_child(GTK_LIST_BOX_ROW(widget));
    if (GTK_IS_REVEALER(child)) child = gtk_revealer_get_child(GTK_REVEALER(child));
    if (GTK_IS_BOX(child)) {
      GtkWidget *icon = gtk_widget_get_first_child(child);
      GtkWidget *label = icon != NULL ? gtk_widget_get_next_sibling(icon) : NULL;
      if (GTK_IS_IMAGE(icon) && GTK_IS_LABEL(label)) {
        gtk_orientable_set_orientation(GTK_ORIENTABLE(child), GTK_ORIENTATION_VERTICAL);
        gtk_box_set_spacing(GTK_BOX(child), roomy ? 4 : 2);
        gtk_widget_set_valign(child, GTK_ALIGN_CENTER);
        gtk_widget_set_halign(icon, GTK_ALIGN_CENTER);
        gtk_widget_set_margin_end(icon, 0);
        gtk_widget_set_halign(label, GTK_ALIGN_FILL);
        gtk_widget_set_margin_end(label, 0);
        gtk_label_set_xalign(GTK_LABEL(label), 0.5f);
        gtk_label_set_ellipsize(GTK_LABEL(label), roomy ? PANGO_ELLIPSIZE_NONE : PANGO_ELLIPSIZE_END);
        gtk_label_set_wrap(GTK_LABEL(label), roomy);
        gtk_label_set_wrap_mode(GTK_LABEL(label), PANGO_WRAP_WORD_CHAR);
        gtk_label_set_max_width_chars(GTK_LABEL(label), roomy ? 18 : 10);
        gtk_widget_set_size_request(widget, -1, roomy ? 64 : 60);
        gtk_widget_add_css_class(widget, "Suno-live-rail-row");
        GtkWidget *header = gtk_list_box_row_get_header(GTK_LIST_BOX_ROW(widget));
        if (header != NULL) {
          /* The first section title adds noise to a rail. Subsequent
           * section headings mark the boundary before drives and favorites. */
          gtk_widget_set_visible(header, roomy && GTK_IS_BOX(header));
          if (roomy && GTK_IS_BOX(header)) {
            gtk_widget_add_css_class(header, "Suno-live-rail-section");
            GtkWidget *heading = gtk_widget_get_last_child(header);
            if (GTK_IS_LABEL(heading)) gtk_label_set_xalign(GTK_LABEL(heading), 0.5f);
          }
        }
      }
    }
  }
  for (GtkWidget *child = gtk_widget_get_first_child(widget); child != NULL;
       child = gtk_widget_get_next_sibling(child))
    adapt_live_rail_rows(child, roomy);
}

void Suno_navigation_sidebar_adapt_live(AdwOverlaySplitView *split_view,
                                        GtkWidget *live_sidebar,
                                        const char *width) {
  g_return_if_fail(ADW_IS_OVERLAY_SPLIT_VIEW(split_view));
  g_return_if_fail(GTK_IS_WIDGET(live_sidebar));
  GtkWidget *surface = adw_overlay_split_view_get_sidebar(split_view);
  g_return_if_fail(surface != NULL);
  GtkWidget *ancestor = live_sidebar;
  while (ancestor != NULL && ancestor != surface)
    ancestor = gtk_widget_get_parent(ancestor);
  g_return_if_fail(ancestor == surface);

  int pixels = 0;
  if (g_strcmp0(width, "rail") == 0) pixels = 88; /* Filer v70 outside rail */
  else if (g_strcmp0(width, "rail-wide") == 0) pixels = 120;
  else if (g_strcmp0(width, "narrow") == 0) pixels = SUNO_UI_NAV_WIDTHS_NARROW;
  else if (g_strcmp0(width, "regular") == 0) pixels = SUNO_UI_NAV_WIDTHS_REGULAR;
  else if (g_strcmp0(width, "wide") == 0) pixels = SUNO_UI_NAV_WIDTHS_WIDE;
  else { g_return_if_fail(FALSE); }

  gtk_widget_add_css_class(GTK_WIDGET(split_view), "Suno-live-sidebar-split");
  gtk_widget_add_css_class(surface, "Suno-live-sidebar-surface");
  gtk_widget_add_css_class(live_sidebar, "Suno-live-sidebar");
  Suno_ui_set_css_class(surface, "Suno-live-sidebar-rail", pixels == 88 || pixels == 120);
  Suno_ui_set_css_class(surface, "Suno-live-sidebar-roomy", pixels == 120);
  if (pixels == 88 || pixels == 120) adapt_live_rail_rows(live_sidebar, pixels == 120);
  gtk_widget_set_overflow(surface, GTK_OVERFLOW_HIDDEN);
  gtk_widget_set_size_request(surface, pixels, -1);
  /* Set the bounds in the safe order, as libadwaita requires min <= max
   * throughout the update. This leaves the app's live split view intact. */
  double current_max = adw_overlay_split_view_get_max_sidebar_width(split_view);
  if (pixels > current_max) {
    adw_overlay_split_view_set_max_sidebar_width(split_view, pixels);
    adw_overlay_split_view_set_min_sidebar_width(split_view, pixels);
  } else {
    adw_overlay_split_view_set_min_sidebar_width(split_view, pixels);
    adw_overlay_split_view_set_max_sidebar_width(split_view, pixels);
  }
  GtkWidget *parent = gtk_widget_get_parent(GTK_WIDGET(split_view));
  if (parent != NULL) {
    gtk_widget_add_css_class(parent, "Suno-window-body");
    gtk_widget_add_css_class(parent, "SunoUI-frame-sidebar");
  }
}

struct _SunoNavigationRow {
  GtkListBoxRow parent_instance;
  GtkWidget *line;
  GtkWidget *lead;
  GtkWidget *trail;
  GtkWidget *title;
  GtkWidget *subtitle;
  GtkWidget *meta;
  gboolean tv; /* in the TV island: the title alone */
};
G_DEFINE_FINAL_TYPE(SunoNavigationRow, Suno_navigation_row, GTK_TYPE_LIST_BOX_ROW)
static void row_tv(GtkWidget *widget, gboolean tv, gboolean rail) {
  SunoNavigationRow *self = SUNO_NAVIGATION_ROW(widget);
  self->tv = tv;
  GtkWidget *labels = gtk_widget_get_parent(gtk_widget_get_parent(self->title));
  gtk_widget_set_visible(labels, !rail);
  gtk_widget_set_visible(self->meta, !tv && *gtk_label_get_text(GTK_LABEL(self->meta)) != '\0');
  gtk_widget_set_visible(self->subtitle, !tv && *gtk_label_get_text(GTK_LABEL(self->subtitle)) != '\0');
  if (self->trail != NULL) gtk_widget_set_visible(self->trail, !tv);
  gtk_widget_set_halign(self->line, rail ? GTK_ALIGN_CENTER : GTK_ALIGN_FILL);
  if (tv) gtk_widget_set_tooltip_text(widget, NULL);
}

static void Suno_navigation_row_class_init(SunoNavigationRowClass *klass G_GNUC_UNUSED) {}
static void speak(SunoNavigationRow *self) {
  const char *title = gtk_label_get_text(GTK_LABEL(self->title));
  const char *subtitle = gtk_label_get_text(GTK_LABEL(self->subtitle));
  g_autofree char *text = subtitle != NULL && *subtitle ? g_strdup_printf("%s, %s", title, subtitle) : g_strdup(title);
  Suno_ui_set_accessible_label(GTK_WIDGET(self), text);
}
static void Suno_navigation_row_init(SunoNavigationRow *self) {
  gtk_widget_add_css_class(GTK_WIDGET(self), "Suno-navigation-row");
  gtk_widget_add_css_class(GTK_WIDGET(self), "SunoUI-row");
  gtk_widget_add_css_class(GTK_WIDGET(self), "lead-none");
  self->line = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(self->line, "Suno-navigation-line");
  gtk_widget_add_css_class(self->line, "SunoUI-row-line");
  GtkWidget *labels = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_hexpand(labels, TRUE);
  gtk_widget_set_valign(labels, GTK_ALIGN_CENTER);
  gtk_widget_add_css_class(labels, "SunoUI-row-labels");
  GtkWidget *first = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(first, "SunoUI-row-first");
  self->title = gtk_label_new("");
  gtk_label_set_xalign(GTK_LABEL(self->title), 0);
  gtk_widget_set_hexpand(self->title, TRUE);
  gtk_widget_add_css_class(self->title, "Suno-navigation-title");
  gtk_widget_add_css_class(self->title, "SunoUI-row-title");
  gtk_box_append(GTK_BOX(first), self->title);
  self->meta = gtk_label_new("");
  gtk_widget_add_css_class(self->meta, "SunoUI-row-meta");
  /* A value at the row's end is short (v70 .cfside .si em: at most 92 wide) and ellipsizes. */
  gtk_label_set_ellipsize(GTK_LABEL(self->meta), PANGO_ELLIPSIZE_END);
  gtk_label_set_max_width_chars(GTK_LABEL(self->meta), 16);
  gtk_widget_set_visible(self->meta, FALSE);
  gtk_box_append(GTK_BOX(first), self->meta);
  GtkWidget *second = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
  gtk_widget_add_css_class(second, "SunoUI-row-second");
  self->subtitle = gtk_label_new("");
  gtk_label_set_xalign(GTK_LABEL(self->subtitle), 0);
  gtk_widget_set_hexpand(self->subtitle, TRUE);
  gtk_widget_add_css_class(self->subtitle, "Suno-navigation-subtitle");
  gtk_widget_add_css_class(self->subtitle, "SunoUI-row-subtitle");
  gtk_box_append(GTK_BOX(second), self->subtitle);
  gtk_box_append(GTK_BOX(labels), first);
  gtk_box_append(GTK_BOX(labels), second);
  gtk_box_append(GTK_BOX(self->line), labels);
  gtk_list_box_row_set_child(GTK_LIST_BOX_ROW(self), self->line);
}
GtkWidget *Suno_navigation_row_new(const char *title, const char *subtitle) {
  GtkWidget *row = g_object_new(SUNO_TYPE_NAVIGATION_ROW, NULL);
  Suno_navigation_row_set_title(SUNO_NAVIGATION_ROW(row), title);
  Suno_navigation_row_set_subtitle(SUNO_NAVIGATION_ROW(row), subtitle);
  return row;
}
void Suno_navigation_row_set_title(SunoNavigationRow *self, const char *title) {
  g_return_if_fail(SUNO_IS_NAVIGATION_ROW(self));
  gtk_label_set_text(GTK_LABEL(self->title), title != NULL ? title : "");
  speak(self);
}
void Suno_navigation_row_set_subtitle(SunoNavigationRow *self, const char *subtitle) {
  g_return_if_fail(SUNO_IS_NAVIGATION_ROW(self));
  gtk_label_set_text(GTK_LABEL(self->subtitle), subtitle != NULL ? subtitle : "");
  gtk_widget_set_visible(self->subtitle, !self->tv && subtitle != NULL && *subtitle != '\0');
  speak(self);
}
void Suno_navigation_row_set_meta(SunoNavigationRow *self, const char *meta) {
  g_return_if_fail(SUNO_IS_NAVIGATION_ROW(self));
  gtk_label_set_text(GTK_LABEL(self->meta), meta != NULL ? meta : "");
  gtk_widget_set_visible(self->meta, !self->tv && meta != NULL && *meta != '\0');
}
void Suno_navigation_row_set_lead(SunoNavigationRow *self, GtkWidget *lead) {
  g_return_if_fail(SUNO_IS_NAVIGATION_ROW(self) && (lead == NULL || GTK_IS_WIDGET(lead)));
  if (self->lead != NULL) gtk_box_remove(GTK_BOX(self->line), self->lead);
  self->lead = lead;
  Suno_ui_set_css_class(GTK_WIDGET(self), "lead-none", lead == NULL);
  if (lead != NULL) {
    /* The kit's row slots, as Python's RowLead: a glyph is a lead icon (its size and ink are the variant's). */
    gtk_widget_add_css_class(lead, "SunoUI-row-lead");
    if (GTK_IS_IMAGE(lead))
      gtk_widget_add_css_class(lead, "lead-icon");
    gtk_box_insert_child_after(GTK_BOX(self->line), lead, NULL);
  }
}
void Suno_navigation_row_set_trail(SunoNavigationRow *self, GtkWidget *trail) {
  g_return_if_fail(SUNO_IS_NAVIGATION_ROW(self) && (trail == NULL || GTK_IS_WIDGET(trail)));
  if (self->trail != NULL) gtk_box_remove(GTK_BOX(self->line), self->trail);
  self->trail = trail;
  if (trail != NULL) {
    gtk_widget_set_visible(trail, !self->tv);
    gtk_widget_add_css_class(trail, "SunoUI-row-trail");
    gtk_box_append(GTK_BOX(self->line), trail);
  }
}

/* The floating island (Suno-tv-frame.c): in TV posture the island carries the destinations only:
 * the header and foot step aside, a section heading is a hairline, a row shows its lead and title
 * (no meta, subtitle or trail), and the folded rail shows leads alone. Leaving restores all of it. */
static void row_tv(GtkWidget *row, gboolean tv, gboolean rail);

void Suno_navigation_sidebar_set_tv(SunoNavigationSidebar *self, gboolean tv, gboolean rail) {
  g_return_if_fail(SUNO_IS_NAVIGATION_SIDEBAR(self));
  if (tv && !self->tv) {
    self->header_shown = gtk_widget_get_visible(self->header);
    self->footer_shown = gtk_widget_get_visible(self->footer);
  }
  if (tv && !self->tv)
    self->valign_shown = gtk_widget_get_valign(GTK_WIDGET(self));
  if (tv != self->tv) {
    gtk_widget_set_visible(self->header, tv ? FALSE : self->header_shown);
    gtk_widget_set_visible(self->footer, tv ? FALSE : self->footer_shown);
    /* The island is as tall as its rows, never a full-height panel: it takes its natural height
     * from the top, and a list longer than the screen stops at the frame's bottom safe line and
     * scrolls (GTK clamps a START-aligned child to what it is given). */
    gtk_widget_set_valign(GTK_WIDGET(self), tv ? GTK_ALIGN_START : self->valign_shown);
    gtk_scrolled_window_set_propagate_natural_height(GTK_SCROLLED_WINDOW(self->scroll), tv);
  }
  self->tv = tv;
  self->rail = tv && rail;
  for (GtkWidget *row = gtk_widget_get_first_child(self->list); row != NULL; row = gtk_widget_get_next_sibling(row)) {
    if (gtk_widget_has_css_class(row, "Suno-navigation-section")) {
      GtkWidget *line = gtk_list_box_row_get_child(GTK_LIST_BOX_ROW(row));
      GtkWidget *heading = line ? gtk_widget_get_first_child(line) : NULL;
      if (heading != NULL) gtk_widget_set_visible(heading, !tv);
    } else if (SUNO_IS_NAVIGATION_ROW(row)) {
      row_tv(row, tv, rail);
    }
  }
}
