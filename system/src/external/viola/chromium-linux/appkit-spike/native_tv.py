# SPDX-License-Identifier: GPL-3.0-only
"""Viola on a TV: what its bar holds, and the remote's ways to it.

In TV posture SunoUI's ActionCenter is the bar on demand (Suno_appkit
action_center_tv; design: handoffs viola-find-20261124/TV-HANDOFF.md). Viola
decides only what the bar holds and when it comes up:

- the row: Back, Forward, Reload | the address (favicon, title, host), Tabs |
  −, the zoom, + | Save, Share, ⋯; zoom and Save keep the bar up;
- ⋯ grows History, Downloads, Find on page, Reader, Clear browsing data;
- OK held on the page brings the bar up; Up at the top of the page brings it
  up on the address; a page that finishes opening peeks it for 3 s.
"""
from urllib.parse import urlsplit

from gi.repository import Gdk, GLib, Gtk, Pango
from Suno_appkit import BarAction, SunoUI_tokens
from Suno_appkit.action_center import BarWidget, RULE
from Suno_appkit.bar_panel import PanelRow, panel_list
from Suno_appkit import icons

HOLD_MS = SunoUI_tokens.TV['focus']['hold_ms']


def tv_sheet(opaque):
    """Viola's own parts in the TV bar, in TV units (the kit draws the bar and its items)."""
    from Suno_appkit.tv_stage import tv_material
    m = lambda name: tv_material(name, opaque=opaque)  # noqa: E731
    c = '.SunoUI-action-center.SunoUI-tv-demand'
    key = (f"background-image: linear-gradient(180deg, {m('key_top')}, {m('key_bottom')}); color: {m('key_ink')};"
           f" box-shadow: inset 0 1.5tv 0 {m('key_glint')}, 0 0 0 1.5tv {m('key_rim')}, 0 3tv 10tv {m('key_drop')};")
    return f"""
{c} button.viola-tv-address {{ min-width: 0; min-height: 76tv; padding: 0 26tv 0 20tv; border-radius: 22tv;
  background-color: {m('well')}; background-image: none; color: {m('ink')};
  box-shadow: inset 0 0 0 1px {m('well_rim')}, inset 0 1.5tv 3tv {m('well_shade')}; }}
{c} button.viola-tv-address > box {{ border-spacing: 16tv; }}
{c} button.viola-tv-address:focus-visible {{ {key} }}
{c} .viola-tv-favicon {{ min-width: 32tv; min-height: 32tv; border-radius: 8tv; background-color: #1d1d21; }}
{c} .viola-tv-favicon label {{ font-size: 18tv; font-weight: 800; color: white; }}
{c} label.viola-tv-title {{ font-size: 23tv; font-weight: 650; color: inherit; }}
{c} label.viola-tv-host {{ font-size: 18tv; font-weight: 600; color: {m('ink_3')}; }}
{c} button.viola-tv-address:focus-visible label.viola-tv-host {{ color: oklch(0.2 0.006 265 / 0.6); }}
{c} image.viola-tv-lock {{ -gtk-icon-size: 16tv; margin-right: 6tv; color: {m('ink_3')}; }}
{c} label.viola-tv-tab-count {{ min-width: 32tv; min-height: 32tv; padding: 0 6tv; border-radius: 10tv;
  box-shadow: inset 0 0 0 2.5tv currentColor; font-size: 17tv; font-weight: 750; }}
{c} label.viola-tv-zoom {{ min-width: 90tv; font-size: 22tv; font-weight: 650; color: {m('ink')}; font-feature-settings: "tnum"; }}
/* Find on page on a TV: the field fills the row; Previous and Next keep their words; a divider before ✕. */
{c} box.SunoUI-ac-row.viola-find entry.viola-find-field {{ min-height: 76tv; padding: 0 26tv; border-spacing: 16tv;
  border-radius: 22tv; margin: 0; }}
{c} box.SunoUI-ac-row.viola-find entry.viola-find-field > image {{ -gtk-icon-size: 32tv; opacity: 0.7; }}
{c} box.SunoUI-ac-row.viola-find entry.viola-find-field text {{ font-size: 30tv; font-weight: 600; }}
{c} box.SunoUI-ac-row.viola-find entry.viola-find-field text > placeholder {{ font-weight: 500; color: {m('ink_3')}; }}
{c} box.SunoUI-ac-row.viola-find entry.viola-find-field:focus-within text > placeholder {{ color: oklch(0.2 0.006 265 / 0.55); }}
{c} box.SunoUI-ac-row.viola-find entry.viola-find-field.SunoUI-tv-typing text {{ caret-color: oklch(0.75 0.14 250); }}
{c} box.SunoUI-ac-row.viola-find label.viola-find-count {{ font-size: 26tv; font-weight: 600; color: {m('ink_3')}; }}
{c} box.SunoUI-ac-row.viola-find label.viola-find-count.none {{ color: {m('ink_2')}; }}
{c} box.SunoUI-ac-row.viola-find entry:focus-within:not(.SunoUI-tv-typing) label.viola-find-count {{ color: oklch(0.2 0.006 265 / 0.62); }}
{c} box.SunoUI-ac-row.viola-find button:disabled {{ opacity: 0.35; filter: none; }}
"""


def host_of(url):
    try:
        parts = urlsplit(url or '')
    except ValueError:
        return url or ''
    if parts.scheme in ('http', 'https'):
        return (parts.netloc + parts.path).rstrip('/')
    return url or ''


class TvAddress(Gtk.Button):
    """The address on a TV: the page's favicon, its title, and its host under it."""

    def __init__(self, on_activate):
        super().__init__(hexpand=True, valign=Gtk.Align.CENTER)
        self.add_css_class('viola-tv-address')
        self.add_css_class('SunoUI-bar-button')
        line = Gtk.Box(spacing=0)
        self.tile = Gtk.Overlay()
        self.tile.add_css_class('viola-tv-favicon')
        self.letter = Gtk.Label()
        self.tile.set_child(self.letter)
        self.picture = Gtk.Picture(can_shrink=True, content_fit=Gtk.ContentFit.CONTAIN, visible=False)
        self.tile.add_overlay(self.picture)
        line.append(self.tile)
        words = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, valign=Gtk.Align.CENTER, hexpand=True)
        self.title = Gtk.Label(xalign=0, ellipsize=Pango.EllipsizeMode.END)
        self.title.add_css_class('viola-tv-title')
        host_line = Gtk.Box()
        self.lock = icons.image('lock')
        self.lock.add_css_class('viola-tv-lock')
        host_line.append(self.lock)
        self.host = Gtk.Label(xalign=0, ellipsize=Pango.EllipsizeMode.END, hexpand=True)
        self.host.add_css_class('viola-tv-host')
        host_line.append(self.host)
        words.append(self.title)
        words.append(host_line)
        line.append(words)
        self.set_child(line)
        self.update_property([Gtk.AccessibleProperty.LABEL], ['Address'])
        self.connect('clicked', lambda _b: on_activate())
        self.url = None

    def show_page(self, state, favicons):
        url = state.get('activeUrl', '')
        title = state.get('activeTitle') or host_of(url) or 'New tab'
        self.title.set_label(title)
        self.host.set_label(host_of(url))
        self.lock.set_visible(url.startswith('https://'))
        self.letter.set_label((title[:1] or 'V').upper())
        if url != self.url:
            self.url = url
            self.picture.set_visible(False)
            if favicons is not None and url.startswith(('https://', 'http://')):
                def done(texture, wanted=url):
                    if texture is not None and self.url == wanted:
                        self.picture.set_paintable(texture)
                        self.picture.set_visible(True)
                favicons.request(url, done)


class TvTabs(Gtk.Button):
    """Tabs, with how many are open in a rounded square before the word."""

    def __init__(self, count, on_activate):
        super().__init__(valign=Gtk.Align.CENTER)
        self.add_css_class('SunoUI-bar-button')
        self.add_css_class('viola-tv-tabs')
        line = Gtk.Box()
        line.add_css_class('SunoUI-bar-button-content')
        self.count = Gtk.Label(label=str(count))
        self.count.add_css_class('viola-tv-tab-count')
        line.append(self.count)
        words = Gtk.Label(label='Tabs')
        words.add_css_class('SunoUI-bar-button-label')
        line.append(words)
        self.set_child(line)
        self.update_property([Gtk.AccessibleProperty.LABEL], [f'Tabs, {count} open'])
        self.connect('clicked', lambda _b: on_activate())


class TvChrome:
    """The bar's TV composition and the remote's ways to it, for one window."""

    def __init__(self, chrome):
        self.chrome = chrome
        self.host = chrome.host
        self.address = TvAddress(self.edit_address)
        self.zoom = Gtk.Label(label='100%')
        self.zoom.add_css_class('SunoUI-tv-quiet')
        self.zoom.add_css_class('viola-tv-zoom')
        self.hold_source = 0
        self.loading = False
        from Suno_appkit.tv_stage import add_tv_style
        add_tv_style(tv_sheet)
        keys = Gtk.EventControllerKey(propagation_phase=Gtk.PropagationPhase.CAPTURE)
        keys.connect('key-pressed', self.key_pressed)
        keys.connect('key-released', self.key_released)
        self.host.add_controller(keys)

    @property
    def center(self):
        return self.chrome.center

    @property
    def active(self):
        # A runtime whose SunoUI has no TV mode yet keeps the desktop bar.
        return bool(getattr(self.center, 'tv_demand', False))

    def items(self, state):
        chrome = self.chrome
        self.address.show_page(state, getattr(self.host, 'favicons', None))
        services = self.host.services
        if services:
            # The page's own zoom, from the retained browser menu (the label is never a guess).
            self.host.submit(lambda: zoom_value(services), self.show_zoom)
        tabs = TvTabs(len(chrome.tabs()), chrome.show_tabs)
        for widget in (self.address, self.zoom):
            parent = widget.get_parent()
            if parent is not None:
                parent.remove(widget)
        return [
            BarAction('arrow-left', tooltip='Back', sensitive=bool(state.get('canGoBack')),
                      on_activate=lambda: self.host.send('nav:back')),
            BarAction('arrow-right', tooltip='Forward', sensitive=bool(state.get('canGoForward')),
                      on_activate=lambda: self.host.send('nav:forward')),
            BarAction('refresh-cw', tooltip='Reload', on_activate=lambda: self.host.send('nav:reload')),
            RULE,
            BarWidget(self.address),
            BarWidget(tabs),
            RULE,
            BarAction('minus', tooltip='Zoom out', stays=True, on_activate=lambda: self.zoom_by('Zoom out')),
            BarWidget(self.zoom),
            BarAction('plus', tooltip='Zoom in', stays=True, on_activate=lambda: self.zoom_by('Zoom in')),
            RULE,
            BarAction('star', 'Save', stays=True, active=self.saved(state), on_activate=self.save),
            BarAction('share', 'Share', on_activate=chrome.show_share),
            BarAction('ellipsis', tooltip='More', key='more', panel=self.more_row),
        ]

    def more_row(self):
        state = self.host.state or {}
        return panel_list([
            PanelRow('History', icon='history', on_activate=lambda: self.page('chrome://history')),
            PanelRow('Downloads', icon='download', on_activate=self.chrome.show_downloads),
            PanelRow('Find on page', icon='search', on_activate=self.chrome.find_from_panel),
            # Reader needs an article; the engine says nothing of one yet.
            PanelRow('Reader', icon='book-open', sensitive=bool(state.get('readerAvailable'))),
            PanelRow('Clear browsing data', icon='trash-2',
                     on_activate=lambda: self.page('chrome://settings/clearBrowserData')),
        ], label='More')

    # ── actions ─────────────────────────────────────────────────────────

    def page(self, url):
        if self.host.services:
            self.host.submit(lambda: self.host.services.navigate(url, new_tab=True))

    def saved(self, state):
        return any(tab['id'] == state.get('activeTabId') for tab in state.get('favorites', []))

    def save(self):
        self.chrome.toggle_pin()

    def zoom_by(self, label):
        services = self.host.services
        tab = (self.host.state or {}).get('activeTabId')
        if not services or not tab:
            return
        from native_zoom_shortcuts import activate_zoom

        def work():
            activate_zoom(services, label, tab)
            return zoom_value(services)
        self.host.submit(work, self.show_zoom)

    def show_zoom(self, value):
        if isinstance(value, (int, float)) and value > 0:
            self.zoom.set_label(f'{round(value)}%')

    def edit_address(self):
        """OK on the address: type an address or a search (the TV keyboard opens into it)."""
        chrome = self.chrome
        if chrome.search is None:
            return
        url = (self.host.state or {}).get('activeUrl', '')
        chrome.search.set_text('' if url == 'about:blank' else url)
        self.center.open_search(chrome.search)

    # ── the remote on the page ──────────────────────────────────────────

    def page_focused(self):
        focus = self.host.get_focus()
        return focus is not None and (focus is self.host.page or focus.is_ancestor(self.host.page))

    def key_pressed(self, _controller, keyval, _code, state):
        if not self.active or self.center.tv_opened or not self.page_focused():
            return False
        if state & (Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.ALT_MASK | Gdk.ModifierType.SUPER_MASK):
            return False
        if keyval in (Gdk.KEY_Return, Gdk.KEY_KP_Enter, Gdk.KEY_Select) and not self.hold_source:
            # OK held half a second on the page brings the bar up; a short OK is the page's.
            self.hold_source = GLib.timeout_add(HOLD_MS, self.held)
            return False
        if keyval in (Gdk.KEY_Up, Gdk.KEY_KP_Up):
            self.up_at_top()
        return False

    def key_released(self, _controller, keyval, _code, _state):
        if keyval in (Gdk.KEY_Return, Gdk.KEY_KP_Enter, Gdk.KEY_Select) and self.hold_source:
            GLib.source_remove(self.hold_source)
            self.hold_source = 0

    def held(self):
        self.hold_source = 0
        if self.active and not self.center.tv_opened and self.page_focused():
            self.center.tv_open(self.host.page)
        return GLib.SOURCE_REMOVE

    def up_at_top(self):
        """Up with the page at its top: the bar comes up with the remote on the address."""
        page_input = getattr(self.host, 'page_input', None)
        requests = getattr(page_input, 'page_requests', None)
        session = getattr(page_input, 'session', None)
        if requests is None or session is None:
            return

        def answered(result):
            value = ((result or {}).get('result') or {}).get('value')
            if value is True and self.active and not self.center.tv_opened and self.page_focused():
                self.center.tv_open(self.host.page, focus=self.address)
        requests.call('Runtime.evaluate', {'expression': 'window.scrollY <= 0', 'returnByValue': True},
                      session, answered)

    def state_changed(self, state):
        loading = bool((state or {}).get('loading'))
        if self.active and self.loading and not loading:
            self.center.tv_peek(3000)
        self.loading = loading


def zoom_value(services):
    """The active page's zoom (percent), from the retained browser menu's zoom row."""
    try:
        menu = services.open_menu('browser:menu', {'anchorRect': {'x': 0, 'y': 0, 'width': 28, 'height': 28}})
    except Exception:
        return None
    try:
        row = next((row for row in menu.get('items', []) if row.get('role') == 'zoom'), None)
        return row.get('value') if row else None
    finally:
        services.dismiss_menu(menu['nonce'])
