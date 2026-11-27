# SPDX-License-Identifier: GPL-3.0-only
"""Find in page: the bar's row becomes the find field over Chromium's find."""
import unittest
from types import SimpleNamespace
import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Gdk', '4.0')
from gi.repository import Gdk, GLib, Gtk
from Suno_appkit import ActionCenter, BarAction, ToastHost, install_appkit
from browser_services import BRIDGE_REFUSALS, BrowserServices, HostChannelUnavailable, recoverable
from native_find import NativeFind, count_text, page_identity, row_key, step_key

SHIFT = Gdk.ModifierType.SHIFT_MASK
CTRL = Gdk.ModifierType.CONTROL_MASK
NONE = Gdk.ModifierType(0)


def settle(ms=200):
    loop = GLib.MainLoop()
    GLib.timeout_add(ms, lambda: loop.quit() or False)
    loop.run()


class Keys(unittest.TestCase):
    def test_row_keys(self):
        field = dict(in_field=True)
        self.assertEqual(row_key(Gdk.KEY_Escape, NONE, **field), 'close')
        self.assertEqual(row_key(Gdk.KEY_Return, NONE, **field), 1)
        self.assertEqual(row_key(Gdk.KEY_Return, SHIFT, **field), -1)
        self.assertEqual(row_key(Gdk.KEY_KP_Enter, SHIFT, **field), -1)
        self.assertEqual(row_key(Gdk.KEY_Down, NONE, **field), 1)   # a TV remote
        self.assertEqual(row_key(Gdk.KEY_Up, NONE, **field), -1)
        self.assertIsNone(row_key(Gdk.KEY_Return, CTRL, **field))
        self.assertIsNone(row_key(Gdk.KEY_a, NONE, **field))
        # On Previous, Next or ✕: Esc and Up/Down still act; Return is the button's own.
        self.assertEqual(row_key(Gdk.KEY_Escape, NONE, in_field=False), 'close')
        self.assertEqual(row_key(Gdk.KEY_Down, NONE, in_field=False), 1)
        self.assertIsNone(row_key(Gdk.KEY_Return, NONE, in_field=False))

    def test_window_step_keys(self):
        self.assertEqual(step_key(Gdk.KEY_F3, NONE), 1)
        self.assertEqual(step_key(Gdk.KEY_F3, SHIFT), -1)
        self.assertEqual(step_key(Gdk.KEY_g, CTRL), 1)
        self.assertEqual(step_key(Gdk.KEY_G, CTRL | SHIFT), -1)
        self.assertIsNone(step_key(Gdk.KEY_g, NONE))
        self.assertIsNone(step_key(Gdk.KEY_f, CTRL))

    def test_count_and_page(self):
        self.assertEqual(count_text(3, 12), '3 of 12')
        self.assertEqual(count_text(0, 0), 'No matches')
        self.assertEqual(count_text(-1, 5), '0 of 5')   # still scanning
        self.assertEqual(page_identity({'activeTabId': 't', 'activeUrl': 'https://a.invalid/x#y'}),
                         ('t', 'https://a.invalid/x'))


class FindBar(unittest.TestCase):
    def setUp(self):
        install_appkit()
        self.page = Gtk.Button(label='Page', vexpand=True)
        region = ToastHost(self.page)
        self.window = Gtk.Window(child=region, default_width=900, default_height=600)
        self.addCleanup(self.window.destroy)
        self.center = ActionCenter().attach(region)
        self.center.show_bar([BarAction('chevron-left', tooltip='Back'),
                              BarAction('rotate-cw', tooltip='Reload')])
        self.window.present()
        settle()
        self.sent = []
        services = SimpleNamespace(send=lambda surface, channel, payload=None:
                                   self.sent.append((surface, channel, payload)),
                                   find_available=True)
        window = self.window
        window.services = services
        window.state = {'activeTabId': 'tab-1', 'activeUrl': 'https://a.invalid/'}
        window.page_input = SimpleNamespace(target='target-1')
        window.page = self.page
        window.open_popover = None
        window.mini = False
        window.address_suggestions = SimpleNamespace(close=lambda: None)
        window.submit = lambda work, done=None: work()
        window.responsive = SimpleNamespace(center=self.center, reveal_bar=lambda: None, panel=None)
        self.find = NativeFind(window)

    def queries(self):
        return [payload for _surface, channel, payload in self.sent if channel == 'find:query']

    def test_open_types_steps_and_closes(self):
        self.find.open()
        settle()
        self.assertTrue(self.center.searching)
        field = self.window.get_focus()
        self.assertIsInstance(field, Gtk.Text)
        self.assertIs(field, self.find.view.field)
        self.assertFalse(self.find.view.count.get_visible())
        self.assertTrue(all(not key.get_sensitive() for key in self.find.view.keys))
        field.set_text('Suno')
        settle(300)
        self.assertEqual(self.queries()[-1], {'text': 'Suno', 'targetId': 'target-1', 'forward': True})
        self.assertTrue(all(surface == 'overlay' for surface, _c, _p in self.sent))
        self.find.receive({'targetId': 'target-1', 'text': 'Suno', 'active': 2, 'matches': 7})
        self.assertEqual(self.find.view.count.get_label(), '2 of 7')
        self.assertTrue(all(key.get_sensitive() for key in self.find.view.keys))
        self.find.receive({'targetId': 'target-1', 'text': 'lum', 'active': 1, 'matches': 9})
        self.assertEqual(self.find.view.count.get_label(), '2 of 7')   # a stale result is ignored
        self.find.view.row_key(None, Gdk.KEY_Return, 0, SHIFT)
        self.assertEqual(self.queries()[-1]['forward'], False)
        self.find.view.row_key(None, Gdk.KEY_Return, 0, NONE)
        self.assertEqual(self.queries()[-1]['forward'], True)
        self.find.receive({'targetId': 'target-1', 'text': 'Suno', 'active': 0, 'matches': 0})
        self.assertEqual(self.find.view.count.get_label(), 'No matches')
        self.assertTrue(self.find.view.count.has_css_class('none'))
        self.assertTrue(all(not key.get_sensitive() for key in self.find.view.keys))
        self.assertTrue(self.find.view.row_key(None, Gdk.KEY_Escape, 0, NONE))
        settle()
        self.assertFalse(self.find.active)
        self.assertFalse(self.center.searching)
        self.assertEqual(self.sent[-1][:2], ('overlay', 'find:close'))
        self.assertIs(self.window.get_focus(), self.page)

    def test_reopen_keeps_query_and_searches_again(self):
        self.find.open()
        settle()
        self.find.view.field.set_text('viola')
        settle(300)
        self.find.close()
        self.sent.clear()
        self.find.open()
        settle()
        self.assertEqual(self.find.view.field.get_text(), 'viola')
        self.assertEqual(self.find.view.field.get_selection_bounds(), (0, 5))
        self.assertEqual(self.queries()[0]['text'], 'viola')

    def test_close_button_and_tab_switch(self):
        self.find.open()
        settle()
        self.find.view.field.set_text('x')
        settle(300)
        row = self.center.entry_row
        close = row.get_last_child()
        while not isinstance(close, Gtk.Button):
            close = close.get_first_child()
        close.emit('clicked')   # ✕
        settle()
        self.assertFalse(self.find.active)
        self.assertEqual(self.sent[-1][1], 'find:close')
        self.find.open()
        settle()
        self.find.state_changed({'activeTabId': 'tab-1', 'activeUrl': 'https://a.invalid/#part'})
        self.assertTrue(self.find.active)
        self.find.state_changed({'activeTabId': 'tab-2', 'activeUrl': 'https://a.invalid/'})
        self.assertFalse(self.find.active)
        self.assertFalse(self.center.searching)

    def test_bar_rebuild_keeps_find(self):
        self.find.open()
        settle()
        self.find.view.field.set_text('kept')
        settle(300)
        self.find.view.hold()
        self.center.show_bar([BarAction('chevron-left', tooltip='Back')])
        self.find.view.rebuilt()
        settle()
        self.assertTrue(self.center.searching)
        self.assertEqual(self.find.view.field.get_text(), 'kept')

    def test_row_order_and_names(self):
        self.find.open()
        settle()
        row = self.center.entry_row
        children = []
        child = row.get_first_child()
        while child is not None:
            children.append(child)
            child = child.get_next_sibling()
        self.assertEqual(len(children), 4)   # field, Previous, Next, ✕
        self.assertTrue(self.find.view.count.is_ancestor(children[0]))
        self.assertEqual(children[1:3], list(self.find.view.keys))
        self.assertEqual(children[3].get_tooltip_text(), 'Close (Esc)')
        self.assertEqual(self.find.view.field.get_placeholder_text(), 'Find on page')
        self.assertTrue(self.find.view.field.get_input_hints() & Gtk.InputHints.LOWERCASE)

    def test_reload_closes(self):
        self.find.open()
        settle()
        self.find.state_changed({'activeTabId': 'tab-1', 'activeUrl': 'https://a.invalid/', 'loading': True})
        self.assertFalse(self.find.active)

    def test_active_match_is_kept_clear_of_the_bar(self):
        calls = []
        self.window.page_input = SimpleNamespace(
            target='target-1', session='s', viewport={'input_zoom': 2.0},
            page_requests=SimpleNamespace(call=lambda method, params, session, done: calls.append(params)))
        self.find.open()
        settle()
        self.find.view.field.set_text('Suno')
        settle(300)
        covered = self.find.view.covered()
        self.assertGreater(covered, 0)
        height = self.page.get_height()
        clear = height - covered
        self.find.receive({'targetId': 'target-1', 'text': 'Suno', 'active': 1, 'matches': 2, 'final': True,
                           'rect': {'x': 10, 'y': 40, 'width': 30, 'height': 16}})
        self.assertEqual(calls, [])   # in the clear: the engine's own scroll stands
        self.find.receive({'targetId': 'target-1', 'text': 'Suno', 'active': 2, 'matches': 2, 'final': True,
                           'rect': {'x': 10, 'y': height - 10, 'width': 30, 'height': 16}})
        self.assertEqual(len(calls), 1)   # under the bar: up to a third of the clear space
        expected = ((height - 10 + height + 6) / 2 - clear / 3) / 2.0
        self.assertIn(f'top: {expected:.1f}', calls[0]['expression'])
        self.find.receive({'targetId': 'target-1', 'text': 'Suno', 'active': 0, 'matches': 0, 'final': True})
        self.assertEqual(len(calls), 1)   # no active match, no rect: nothing moves

    def test_steps_open_find_when_closed(self):
        self.assertTrue(self.find.window_key(None, Gdk.KEY_F3, 0, NONE))
        settle()
        self.assertTrue(self.find.active)

    def test_ctrl_f_again_refocuses_and_selects(self):
        self.find.open()
        settle()
        self.find.view.field.set_text('again')
        settle(300)
        self.page.grab_focus()   # a click into the page leaves find open
        settle()
        self.assertTrue(self.find.active)
        self.find.open()
        settle()
        self.assertIs(self.window.get_focus(), self.find.view.field)
        self.assertEqual(self.find.view.field.get_selection_bounds(), (0, 5))

    def test_up_down_on_a_button_step(self):
        self.find.open()
        settle()
        self.find.view.field.set_text('tv')
        settle(300)
        self.find.receive({'targetId': 'target-1', 'text': 'tv', 'active': 1, 'matches': 3})
        self.find.view.keys[1].grab_focus()
        self.sent.clear()
        self.assertTrue(self.find.view.row_key(None, Gdk.KEY_Up, 0, NONE))
        self.assertEqual(self.queries()[-1]['forward'], False)
        self.assertFalse(self.find.view.row_key(None, Gdk.KEY_Return, 0, NONE))   # the button's own


class FakeView:
    def __init__(self):
        self.calls = []

    def __getattr__(self, name):
        if name in ('show', 'hide', 'render', 'refocus'):
            return lambda: self.calls.append(name)
        if name == 'diagnostics':
            return lambda: {}
        raise AttributeError(name)


class ModelAlone(unittest.TestCase):
    """The find model works under any view (a later TV bar renders the same object)."""

    def test_model_drives_a_view(self):
        sent = []
        host = Gtk.Window()
        self.addCleanup(host.destroy)
        host.services = SimpleNamespace(send=lambda s, c, p=None: sent.append((c, p)), find_available=True)
        host.state = {'activeTabId': 't', 'activeUrl': 'https://a.invalid/'}
        host.page_input = SimpleNamespace(target='x')
        host.page = Gtk.Button()
        host.submit = lambda work, done=None: work()
        view = FakeView()
        find = NativeFind(host, view=view)
        find.open()
        self.assertEqual(view.calls, ['show'])
        find.set_query('abc')
        settle(300)
        self.assertEqual(sent[-1], ('find:query', {'text': 'abc', 'targetId': 'x', 'forward': True}))
        find.receive({'targetId': 'x', 'text': 'abc', 'active': 2, 'matches': 4})
        self.assertEqual((find.count, find.can_step, find.no_matches), ('2 of 4', True, False))
        find.step(-1)
        self.assertEqual(sent[-1][1]['forward'], False)
        find.receive({'targetId': 'x', 'text': 'abc', 'active': 0, 'matches': 0})
        self.assertEqual((find.count, find.can_step, find.no_matches), ('No matches', False, True))
        find.open()
        self.assertEqual(view.calls[-1], 'refocus')
        find.close(refocus=False)
        self.assertEqual(view.calls[-1], 'hide')
        self.assertEqual(sent[-1], ('find:close', None))
        self.assertEqual(find.query, 'abc')


class Unavailable(unittest.TestCase):
    """An engine whose bridge lacks find: the row says so; nothing takes the host down."""

    def host(self, services):
        host = Gtk.Window()
        self.addCleanup(host.destroy)
        host.services = services
        host.state = {'activeTabId': 't', 'activeUrl': 'https://a.invalid/'}
        host.page_input = SimpleNamespace(target='x')
        host.page = Gtk.Button()
        host.submit = lambda work, done=None: work()
        return host

    def test_engine_without_find(self):
        sent = []
        host = self.host(SimpleNamespace(send=lambda *a: sent.append(a), find_available=False))
        find = NativeFind(host, view=FakeView())
        find.open()
        find.set_query('abc')
        settle(300)
        find.step(1)
        find.close(refocus=False)
        self.assertEqual(sent, [])
        self.assertEqual((find.count, find.can_step, find.no_matches), ('Unavailable', False, True))

    def test_refused_send_is_handled(self):
        def refuse(surface, channel, payload=None):
            raise HostChannelUnavailable(surface, channel)
        host = self.host(SimpleNamespace(send=refuse, find_available=True))
        view = FakeView()
        find = NativeFind(host, view=view)
        find.open()
        find.set_query('abc')
        settle(300)
        self.assertEqual(find.count, 'Unavailable')
        self.assertFalse(find.can_step)
        self.assertEqual(view.calls[-1], 'render')


class Bridge(unittest.TestCase):
    """Every channel: a refusal by the engine's bridge is a handled, recoverable failure."""

    class Engine:
        def __init__(self, exception_text=None, value=True):
            self.exception_text, self.value, self.on_event, self.calls = exception_text, value, None, []

        def call(self, method, params=None, session=None, timeout=15):
            self.calls.append((method, params))
            if method == 'Runtime.evaluate' and self.exception_text:
                return {'exceptionDetails': {'exception': {'description': 'Error: ' + self.exception_text}}}
            return {'result': {'value': self.value}}

    def services(self, engine):
        services = BrowserServices(engine, lambda _s: None)
        services.sessions = {'overlay': 'o', 'sidebar': 's'}
        return services

    def test_refusal_is_recoverable(self):
        for text in BRIDGE_REFUSALS:
            services = self.services(self.Engine(text))
            with self.assertRaises(HostChannelUnavailable) as caught:
                services.send('sidebar', 'nav:reload')
            self.assertTrue(recoverable(caught.exception))
            self.assertEqual(caught.exception.channel, 'nav:reload')

    def test_other_failures_still_fail(self):
        services = self.services(self.Engine('TypeError: x is undefined'))
        with self.assertRaises(RuntimeError) as caught:
            services.send('sidebar', 'nav:reload')
        self.assertFalse(recoverable(caught.exception))

    def test_find_probe(self):
        self.assertTrue(self.services(self.Engine()).enable_native_find())
        self.assertFalse(self.services(self.Engine(value=False)).enable_native_find())
        self.assertFalse(self.services(self.Engine('Wrong surface')).enable_native_find())


if __name__ == '__main__':
    unittest.main()
