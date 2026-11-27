"""A visible sidebar clear action resets the real search and returns input focus."""
import unittest
from gi.repository import Gtk
from Suno_appkit import SidebarFoot, install_appkit, install_SunoUI
from test_Suno_appkit_list_status import settle


class SidebarSearchClear(unittest.TestCase):
    def test_clear_query_and_custom_field(self):
        Gtk.init()
        install_appkit()
        install_SunoUI()
        changes = []
        foot = SidebarFoot(search='Search notes', on_search=changes.append,
                           add=('New note', 'square-pen', lambda: None))
        window = Gtk.Window(child=foot, default_width=236, default_height=48)
        window.add_css_class('Suno-app-window')
        window.present()
        settle()
        self.assertFalse(foot.clear_button.get_visible())
        foot.entry.set_text('sourdough')
        settle()
        self.assertTrue(foot.clear_button.get_visible())
        self.assertEqual(window.get_width(), 236)
        foot.clear_button.emit('clicked')
        settle()
        self.assertEqual(foot.text, '')
        self.assertEqual(changes[-1], '')
        self.assertFalse(foot.clear_button.get_visible())
        self.assertIs(window.get_focus(), foot.entry)
        custom = SidebarFoot(search=Gtk.Entry())
        self.assertIsNone(custom.clear_button)
        window.close()


if __name__ == '__main__':
    unittest.main()
