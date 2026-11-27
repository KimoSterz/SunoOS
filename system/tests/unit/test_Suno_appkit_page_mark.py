"""Document marks reserve an empty slot and grow only when a mark is chosen."""
import unittest
from gi.repository import Gtk
from Suno_appkit import MarkButton, MarkValue, install_appkit, install_SunoUI
from test_Suno_appkit_list_status import settle


class PageMark(unittest.TestCase):
    def test_empty_chosen_and_ordinary_sizes(self):
        Gtk.init()
        install_appkit()
        install_SunoUI()
        page = MarkButton(kind='page')
        ordinary = MarkButton()
        column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        column.append(page)
        column.append(ordinary)
        window = Gtk.Window(child=column, default_width=360, default_height=240)
        window.add_css_class('Suno-app-window')
        window.present()
        settle()
        self.assertEqual(page.get_allocated_height(), 28)
        self.assertEqual(ordinary.get_allocated_height(), 22)
        page.mark.set_value(MarkValue(kind='icon', icon='book'))
        page.set_empty(False)
        settle()
        self.assertEqual(page.get_allocated_height(), 60)
        self.assertEqual(page.mark.get_allocated_width(), 52)
        page.set_empty(True)
        settle()
        self.assertEqual(page.get_allocated_height(), 28)
        window.close()


if __name__ == '__main__':
    unittest.main()
