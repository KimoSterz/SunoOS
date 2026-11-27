# SPDX-License-Identifier: GPL-3.0-only
"""Find on page over Chromium's own find (FindTabHelper), shown in the page bar.

Ctrl+F, or Find on page in the browser menu (the phone's ⋯ panel), turns the
bar's row into the find row (design: handoffs viola-find-20261124): the field
with the match count at its end, Previous, Next and ✕. Typing searches live;
Return and Shift+Return, F3 and Shift+F3, Ctrl+G and Shift+Ctrl+G, or Down and
Up (a TV remote, anywhere in the row) step through matches, wrapping. Esc or ✕
closes it, clears the highlights and gives focus back to the page. Clicking
into the page leaves it open. Switching tab, navigating or reloading closes
it; the query is kept for the window's next find.

Two parts. `NativeFind` is the find itself: the query, the engine's count,
stepping and closing, with no widgets. A view renders it: `BarFindRow` puts it
in the ActionCenter's entry row. Another presentation (a TV bar) implements
the same few methods (`show`, `hide`, `render`, `refocus`, `diagnostics`) over
the same model.

The engine (patch 0001, HandleNativeFind) accepts `find:query` only from the
window's own overlay surface, only for its active page's DevTools target, and
reports `find:result` there; the services adapter forwards that result here.
An engine whose bridge does not carry those channels (before patch 0010)
leaves find unavailable: the row says so, and the browser carries on.
"""
from urllib.parse import urlsplit

from gi.repository import Gdk, GLib, Gtk
from browser_services import HostChannelUnavailable
from Suno_appkit import BarAction, BarSearch
from Suno_appkit.action_center import make_control
from Suno_appkit import SunoUI_tokens

# Matches the engine overlay's own find field: one query per pause in typing.
QUERY_DELAY_MS = 120
# HandleNativeFind rejects longer text.
MAX_QUERY_BYTES = 4096
# A match this close above the bar counts as under it.
REVEAL_MARGIN = 8

_MODIFIERS = (Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.ALT_MASK |
              Gdk.ModifierType.SUPER_MASK | Gdk.ModifierType.META_MASK)


def count_text(active, matches):
    if not matches:
        return 'No matches'
    # While the engine is still scanning it reports matches before an active one.
    return f'{max(0, active)} of {matches}'


def page_identity(state):
    """A tab and its document; a change of fragment only is the same page."""
    state = state or {}
    url = state.get('activeUrl') or ''
    try:
        url = urlsplit(url)._replace(fragment='').geturl()
    except ValueError:
        pass
    return state.get('activeTabId'), url


def step_key(keyval, state):
    """+1 or -1 for a key that steps through matches anywhere in the window."""
    shift = bool(state & Gdk.ModifierType.SHIFT_MASK)
    meaningful = state & _MODIFIERS
    if keyval == Gdk.KEY_F3 and not meaningful:
        return -1 if shift else 1
    if keyval in (Gdk.KEY_g, Gdk.KEY_G) and meaningful == Gdk.ModifierType.CONTROL_MASK:
        return -1 if shift else 1
    return None


def row_key(keyval, state, *, in_field):
    """What a key does in the find row: 'close', +1, -1 or None.

    Esc closes from anywhere in the row; Up and Down step from anywhere in it
    (a TV remote). Return and Shift+Return step from the field; on a button
    Return is the button's own."""
    shift = bool(state & Gdk.ModifierType.SHIFT_MASK)
    plain = not state & _MODIFIERS
    if keyval == Gdk.KEY_Escape and plain:
        return 'close'
    if in_field and keyval in (Gdk.KEY_Return, Gdk.KEY_KP_Enter, Gdk.KEY_ISO_Enter) and plain:
        return -1 if shift else 1
    if keyval == Gdk.KEY_Down and plain and not shift:
        return 1
    if keyval == Gdk.KEY_Up and plain and not shift:
        return -1
    return None


class NativeFind:
    """The window's find: query, count, step and close. A view renders it."""

    def __init__(self, host, view=None):
        self.host = host
        self.query = ''
        self.active = False
        self.result = None
        self.page = None
        self.loading = False
        self.timer = None
        self.failed = False
        self.view = view or BarFindRow(self, host)
        keys = Gtk.EventControllerKey(propagation_phase=Gtk.PropagationPhase.CAPTURE)
        keys.connect('key-pressed', self.window_key)
        host.add_controller(keys)
        self.window_keys = keys

    # ── what a view shows ──────────────────────────────────────────────────

    @property
    def available(self):
        """False when this engine's bridge does not carry find (or refused it)."""
        return bool(getattr(self.host.services, 'find_available', False)) and not self.failed

    def found(self):
        """The engine's result for the current query, or None."""
        result = self.result
        if self.query and result and result.get('text') == self.query:
            return result
        return None

    @property
    def matches(self):
        found = self.found()
        return int(found.get('matches') or 0) if found else 0

    @property
    def count(self):
        """'' (no query, or no answer yet), '2 of 4', 'No matches' or 'Unavailable'."""
        if not self.available:
            return 'Unavailable'
        found = self.found()
        if not found:
            return ''
        return count_text(int(found.get('active') or 0), self.matches)

    @property
    def no_matches(self):
        """The count's stronger ink: nothing matches, or find is unavailable."""
        return not self.available or (bool(self.found()) and not self.matches)

    @property
    def can_step(self):
        return self.available and self.matches > 0

    # ── actions ────────────────────────────────────────────────────────────

    def open(self):
        """Ctrl+F: show the row (or focus its field again) with the last query selected."""
        if not self.host.services or not (self.host.state or {}).get('activeTabId'):
            return
        if self.active:
            self.view.refocus()
            return
        self.page = page_identity(self.host.state)
        self.loading = bool((self.host.state or {}).get('loading'))
        self.active = True
        self.result = None
        self.view.show()
        if self.query:
            self.search(forward=True)

    def set_query(self, text):
        """The field changed: search live, once typing pauses."""
        if text == self.query:
            return
        self.query = text
        self._cancel_timer()

        def run():
            self.timer = None
            if self.active:
                self.search(forward=True)
            return GLib.SOURCE_REMOVE
        self.timer = GLib.timeout_add(QUERY_DELAY_MS, run)
        self.view.render()

    def step(self, direction):
        if not self.active:
            self.open()
            return
        if not self.query:
            return
        self._cancel_timer()
        self.search(forward=direction > 0)

    def close(self, *, refocus=True):
        """Esc or ✕: end the find, clear the highlights, give the bar its row back."""
        if not self.active:
            return
        self.active = False
        self._end()
        self.view.hide()
        if refocus:
            self.host.page.grab_focus()

    def closed_by_view(self):
        """The view's row went away on its own (the bar's ✕, the bar tucked)."""
        self.close()

    def state_changed(self, state):
        if not self.active:
            return
        loading = bool((state or {}).get('loading'))
        started, self.loading = loading and not self.loading, loading
        # Another tab, another document, or a load (a reload too) ends the find.
        if page_identity(state) != self.page or started:
            self.close(refocus=False)

    # ── the engine ─────────────────────────────────────────────────────────

    def search(self, *, forward):
        """One find request; the same text again steps to the next match (Chromium wraps)."""
        target = getattr(self.host.page_input, 'target', None)
        text = self.query if len(self.query.encode('utf-8')) <= MAX_QUERY_BYTES else ''
        if not self.available or not target:
            return
        self._send('find:query', {'text': text, 'targetId': target, 'forward': bool(forward)})
        if not text:
            self.result = None
            self.view.render()

    def receive(self, result):
        """find:result from the engine, on the GTK thread."""
        if (not self.active or not isinstance(result, dict)
                or result.get('targetId') != getattr(self.host.page_input, 'target', None)
                or result.get('text') != self.query):
            return GLib.SOURCE_REMOVE
        self.result = result
        self.view.render()
        if hasattr(self.view, 'reveal'):
            self.view.reveal(result)
        return GLib.SOURCE_REMOVE

    def _end(self):
        self._cancel_timer()
        self.result = None
        if self.available:
            self._send('find:close')

    def _send(self, channel, payload=None):
        services = self.host.services

        def work():
            try:
                services.send('overlay', channel, payload)
            except HostChannelUnavailable:
                GLib.idle_add(self._refused)
        self.host.submit(work)

    def _refused(self):
        """The bridge refused find after all: say so in the row; nothing else stops."""
        self.failed = True
        self.result = None
        self.view.render()
        return GLib.SOURCE_REMOVE

    def _cancel_timer(self):
        if self.timer is not None:
            GLib.source_remove(self.timer)
            self.timer = None

    # ── keys anywhere in the window ────────────────────────────────────────

    def window_key(self, _controller, keyval, _code, state):
        direction = step_key(keyval, state)
        if direction is None:
            return False
        if self.active and self.query:
            self.step(direction)
        else:
            self.open()
        return True

    def diagnostics(self):
        return {'active': self.active, 'query': self.query, 'count': self.count,
                'rect': (self.found() or {}).get('rect'),
                **self.view.diagnostics()}


class BarFindRow:
    """The find row in Viola's page bar (the SunoUI ActionCenter's entry row).

    The bar keeps its size, place and material; its row becomes the field
    (search glyph, query, count at its end), Previous, Next and ✕. On a
    desktop the row fills the bar's resting width rather than shrinking it."""

    def __init__(self, model, host):
        self.model = model
        self.host = host
        self.item = None
        self.count = None
        self.keys = ()
        self.field = None
        self.row_keys = None
        self.width = 0
        self.composing = False
        self.rule = None
        self.stop_keyboard = None
        self.keyboard = False

    @property
    def center(self):
        return self.host.responsive.center

    @property
    def tv(self):
        """TV posture: the bar is SunoUI's bar on demand (TV-HANDOFF.md, "Find on page on TV")."""
        return bool(getattr(self.center, 'tv_demand', False))

    # ── the view contract ──────────────────────────────────────────────────

    def show(self):
        responsive = self.host.responsive
        if self.host.open_popover:
            self.host.open_popover.popdown()
        self.host.address_suggestions.close()
        responsive.reveal_bar()
        # The bar's resting width, before its row is swapped (a desktop keeps it).
        center = self.center
        self.width = max(center.get_width() if center.get_mapped() else 0,
                         center.measure(Gtk.Orientation.HORIZONTAL, -1)[1])
        center.close_search()
        responsive.panel = None
        self.build(focus=True)
        if self.tv and not center.tv_opened:
            # Find is a field the person asked for: the bar comes up on it, the keyboard with it.
            center.tv_open(self.host.page, focus=self.field)

    def hide(self):
        if self.center.searching and self.item is not None:
            item, self.item = self.item, None
            item.on_close = None
            self.center.close_search()
        self._forget()
        self.center.set_size_request(-1, -1)

    def refocus(self):
        self.host.responsive.reveal_bar()
        if not self.center.searching:
            self._forget()
            self.build(focus=True)
        else:
            self.focus_field(select=True)

    def render(self):
        if self.count is None:
            return
        model = self.model
        text = model.count
        if self.count.get_label() != text:
            self.count.set_label(text)
            self.count.update_property([Gtk.AccessibleProperty.LABEL], [text])
        self.count.set_visible(bool(text))
        (self.count.add_css_class if model.no_matches else self.count.remove_css_class)('none')
        for key in self.keys:
            key.set_sensitive(model.can_step)

    # ── the active match clear of the bar ──────────────────────────────────

    def covered(self):
        """How much of the page view, from its bottom, the bar (and a TV keyboard) covers now."""
        page = self.host.page
        if self.tv and hasattr(self.center, 'tv_covered'):
            return self.center.tv_covered()
        bar = self.center.bar
        if not bar.get_mapped():
            return 0
        valid, bounds = bar.compute_bounds(page)
        return max(0, round(page.get_height() - bounds.get_y())) if valid else 0

    def reveal(self, result):
        """Scroll the active match clear of the bar, about a third of the way down what is left.

        The engine scrolls a match into its view first; this moves it only when the
        bar would hide it (on a TV, when it is outside the middle of the clear space)."""
        rect = result.get('rect') if isinstance(result, dict) else None
        page_input = getattr(self.host, 'page_input', None)
        if not rect or not result.get('final', True) or page_input is None or not page_input.session:
            return
        clear = self.host.page.get_height() - self.covered()
        if clear <= 0:
            return
        top, bottom = rect['y'], rect['y'] + rect['height']
        low, high = (clear * 0.25, clear * 0.75) if self.tv else (0, clear - REVEAL_MARGIN)
        if top >= low and bottom <= high:
            return
        zoom = (page_input.viewport or {}).get('input_zoom') or 1
        delta = ((top + bottom) / 2 - clear / 3) / zoom
        page_input.page_requests.call('Runtime.evaluate', {
            'expression': f'window.scrollBy({{top: {delta:.1f}, behavior: "instant"}}); true',
            'returnByValue': True}, page_input.session, lambda _result: None)

    # ── building the row ───────────────────────────────────────────────────

    def build(self, *, focus):
        """Put the find row in the bar (again, after the bar's row is rebuilt)."""
        model = self.model
        self.item = BarSearch('Find on page', label='Find on page', text=model.query,
                              on_change=model.set_query, on_close=self.closed_by_bar)
        self.center.open_search(self.item)
        live = getattr(self.center, '_search', None)
        if live is not None:
            # Clicking into the page leaves find open, even with an empty field.
            live[1].on_empty_leave = None
        row = self.center.entry_row
        row.add_css_class('viola-find')
        well = row.get_first_child()
        well.add_css_class('viola-find-field')
        self.field = _descendant_text(well)
        if self.field is not None:
            # A search field: no capitals, no spelling marks, no emoji (an on-screen keyboard starts lowercase).
            self.field.set_input_hints(Gtk.InputHints.LOWERCASE | Gtk.InputHints.NO_SPELLCHECK
                                       | Gtk.InputHints.NO_EMOJI)
        # The count is the field's own end: after the query, in place of its clear key.
        self.count = Gtk.Label(visible=False, accessible_role=Gtk.AccessibleRole.STATUS)
        self.count.add_css_class('viola-find-count')
        self.count.add_css_class('numeric')
        clear = live[1].clear_button if live is not None else None
        if clear is not None:
            # The field's clear key never shows in find: the count holds its place.
            clear.set_child_visible(False)
            clear.set_visible(False)
            clear.connect('notify::visible', lambda b, _p: b.get_visible() and b.set_visible(False))
            self.count.insert_before(well, clear)
        else:
            well.append(self.count)
        # Previous and Next go between the field and ✕ (the row's last key).
        close = row.get_last_child()
        self.keys = []
        for icon, tooltip, name, direction in (
                ('chevron-up', 'Previous (Shift+Enter)', 'Previous match', -1),
                ('chevron-down', 'Next (Enter)', 'Next match', 1)):
            key = make_control(BarAction(icon, tooltip=tooltip,
                                         on_activate=lambda d=direction: model.step(d)))
            key.update_property([Gtk.AccessibleProperty.LABEL], [name])
            key.insert_before(row, close)
            self.keys.append(key)
        close.set_tooltip_text('Close (Esc)')
        close.update_property([Gtk.AccessibleProperty.LABEL], ['Close find'])
        if self.tv:
            # On a TV the bar's divider stands before ✕; the keyboard's action key reads Find.
            from Suno_appkit.action_center import RULE, make_control as control
            self.rule = control(RULE)
            self.rule.insert_before(row, close)
            if self.field is not None:
                from Suno_appkit.tv_keyboard import set_keyboard_action, watch_tv_keyboard
                set_keyboard_action(self.field, 'Find')
                self.stop_keyboard = watch_tv_keyboard(self.keyboard_changed)
            self.center.tv_refresh()
        self.row_keys = Gtk.EventControllerKey(propagation_phase=Gtk.PropagationPhase.CAPTURE)
        self.row_keys.connect('key-pressed', self.row_key)
        row.add_controller(self.row_keys)
        if self.field is not None:
            # Return belongs to an input method while it composes.
            self.field.connect('preedit-changed', self.preedit)
        self.fit()
        self.render()
        if focus:
            GLib.idle_add(lambda: (model.active and self.focus_field(select=True), False)[1])

    def focus_field(self, *, select):
        if self.field is None or not self.field.get_mapped():
            return False
        self.field.grab_focus()
        if select:
            self.field.select_region(0, -1)
        return True

    def preedit(self, _text, preedit):
        self.composing = bool(preedit)

    # Design: in a window the field sits 8 in from the bar's edge (the bar's 4
    # padding and 4 more) and 8 before Previous, and the keys are 4 apart; on a
    # phone the field is flush with the bar's 6 padding and everything is 6
    # apart. The kit's entry row spaces its children 4 in a window and 2 on a
    # phone; these margins make up the rest.
    FIELD_MARGINS = {False: (4, 4), True: (0, 4), 'tv': (0, 0)}
    KEY_MARGIN = {False: 0, True: 4, 'tv': 0}

    def fit(self):
        """A desktop bar keeps its resting width while it finds; a phone bar spans the window."""
        if not self.model.active or not self.center.searching:
            return
        phone = getattr(self.host.responsive, 'phone', False)
        form = 'tv' if self.tv else bool(phone)
        well = self.center.entry_row.get_first_child()
        if well is not None:
            start, end = self.FIELD_MARGINS[form]
            if (well.get_margin_start(), well.get_margin_end()) != (start, end):
                well.set_margin_start(start)
                well.set_margin_end(end)
            gap = self.KEY_MARGIN[form]
            later = list(self.keys[1:]) + [self.center.entry_row.get_last_child()]
            for key in later:
                if key is not None and key.get_margin_start() != gap:
                    key.set_margin_start(gap)
        width = -1
        if not phone and self.width:
            host = self.center.get_parent()
            inset = (2 * SunoUI_tokens.TV['layout']['safe_x'] * self.center._tv.unit() if self.tv
                     else SunoUI_tokens.ACTION_CENTER['bar_inset'])
            room = host.get_width() - round(inset) if host else 0
            width = min(self.width, room) if room > 0 else self.width
        if self.center.get_size_request()[0] != width:
            self.center.set_size_request(width, -1)

    def closed_by_bar(self):
        # ✕, or the bar gave its row back (tucked away): the bar already closed the row.
        self.item = None
        self.model.closed_by_view()

    def hold(self):
        """The bar is about to give its row back for a rebuild; that is not a close."""
        if self.item is not None:
            self.item.on_close = None

    def rebuilt(self):
        """The bar's row was rebuilt (layout, extensions): bring the find row back."""
        if self.model.active and not self.center.searching:
            focus = self.host.get_focus()
            # Focus returns to the field only if the rebuild took it from there.
            take = (focus is None or not focus.get_mapped()
                    or focus is self.field or focus.is_ancestor(self.center))
            self._forget()
            self.build(focus=take)

    def _forget(self):
        if self.stop_keyboard is not None:
            self.stop_keyboard()
            self.stop_keyboard = None
        self.keyboard = False
        if self.rule is not None and self.rule.get_parent() is not None:
            self.rule.get_parent().remove(self.rule)
        self.rule = None
        row = self.center.entry_row
        if self.row_keys is not None:
            row.remove_controller(self.row_keys)
            self.row_keys = None
        row.remove_css_class('viola-find')
        self.item = self.count = self.field = None
        self.keys = ()
        self.composing = False

    # ── keys in the row ────────────────────────────────────────────────────

    def row_key(self, _controller, keyval, _code, state):
        if self.composing:
            return False
        focus = self.host.get_focus()
        if self.tv and focus is not None and focus is self.field and keyval in (
                Gdk.KEY_Return, Gdk.KEY_KP_Enter, Gdk.KEY_ISO_Enter):
            if self.keyboard:
                return False   # the keyboard's Find key: it puts the keyboard away (keyboard_changed)
            self.reopen_keyboard()   # OK on the field: the keyboard again, with the query
            return True
        action = row_key(keyval, state, in_field=focus is not None and focus is self.field)
        if action == 'close':
            self.model.close()
            return True
        if action is not None:
            self.model.step(action)
            return True
        return False

    # ── the TV keyboard ────────────────────────────────────────────────────

    def keyboard_changed(self, visible, _height):
        was, self.keyboard = self.keyboard, bool(visible)
        if not was or visible or not self.model.active or self.field is None or not self.field.has_focus():
            return
        # Find (the action key) or Back put the keyboard away: the remote goes to Next when
        # there are matches, else stays on the field; an empty field closes find.
        if not self.model.query:
            self.model.close()
        elif self.model.can_step and len(self.keys) > 1:
            self.keys[1].grab_focus()
            root = self.host
            root.set_focus_visible(True)

    def reopen_keyboard(self):
        field = self.field
        if field is None:
            return
        self.host.set_focus(None)
        field.grab_focus()
        field.set_position(-1)

    # ── conform and QA ─────────────────────────────────────────────────────

    def diagnostics(self):
        """The find row's geometry in window pixels."""
        def rect(widget):
            if widget is None or not widget.get_mapped():
                return None
            valid, bounds = widget.compute_bounds(self.host)
            return [round(bounds.get_x(), 1), round(bounds.get_y(), 1),
                    round(bounds.get_width(), 1), round(bounds.get_height(), 1)] if valid else None
        active = self.model.active and self.center.searching
        row = self.center.entry_row if active else None
        children = []
        child = row.get_first_child() if row is not None else None
        while child is not None:
            children.append(child)
            child = child.get_next_sibling()
        return {'bar': rect(self.center.bar) if active else None,
                'resting_bar': None if active else rect(self.center.bar),
                'window': [self.host.get_width(), self.host.get_height()],
                'phone': bool(getattr(self.host.responsive, 'phone', False)),
                'field': rect(children[0]) if children else None,
                'count_rect': rect(self.count) if active else None,
                'buttons': [rect(button) for button in children[1:]],
                'focus_in_field': bool(self.field is not None and self.field.has_focus()),
                'scale': self.host.get_scale_factor()}


def _descendant_text(widget):
    child = widget.get_first_child()
    while child is not None:
        if isinstance(child, Gtk.Text):
            return child
        found = _descendant_text(child)
        if found is not None:
            return found
        child = child.get_next_sibling()
    return None
