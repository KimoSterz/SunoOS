#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""Light dismiss never takes the press: real pointer drags (XTest on X11) on content under a grown action
bar reach that content, for the Python ActionCenter and the C one (SunoUI-1).

A grown panel and an editor without a target fold on the press, and the drag still arrives. An editor whose
target is the content (Photos' crop frame) stays open: the drag is part of the edit. A press on other
content still folds it. Skipped (77) without X11, XTest or the SunoUI typelib.
"""
import ctypes
import ctypes.util
import os
import sys
import time

import gi

gi.require_version("Gdk", "4.0")
gi.require_version("Gtk", "4.0")
from gi.repository import Gdk, GLib, Gtk  # noqa: E402

Gtk.init()
if type(Gdk.Display.get_default()).__name__ != "X11Display" or not os.environ.get("DISPLAY"):
    print("skip: needs X11")
    sys.exit(77)
try:
    gi.require_version("SunoUI", "1")
    from gi.repository import SunoUI  # noqa: E402
    x11, xtst = (ctypes.CDLL(ctypes.util.find_library(lib) or f"lib{lib}.so.6") for lib in ("X11", "Xtst"))
except (ImportError, ValueError, OSError) as error:
    print(f"skip: {error}")
    sys.exit(77)

from Suno_appkit import ActionCenter, ActionEditor, BarAction, BarPrompt  # noqa: E402

x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
x11.XDefaultRootWindow.restype = ctypes.c_ulong
x11.XTranslateCoordinates.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_int, ctypes.c_int,
                                      ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int),
                                      ctypes.POINTER(ctypes.c_ulong)]
x11.XFlush.argtypes = [ctypes.c_void_p]
xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
xtst.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
display = x11.XOpenDisplay(None)
assert display


def settle(seconds: float = 0.3) -> None:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        while GLib.MainContext.default().pending():
            GLib.MainContext.default().iteration(False)
        time.sleep(0.005)


class Area(Gtk.DrawingArea):
    """Content that drags, as a crop frame or a canvas does: its gesture claims on drag-begin."""

    def __init__(self, **props) -> None:
        super().__init__(hexpand=True, vexpand=True, **props)
        self.begun, self.moved = 0, (0.0, 0.0)
        drag = Gtk.GestureDrag()
        drag.connect("drag-begin", self._begin)
        drag.connect("drag-update", lambda _g, dx, dy: setattr(self, "moved", (dx, dy)))
        self.add_controller(drag)

    def _begin(self, gesture, _x, _y) -> None:
        self.begun += 1
        self.moved = (0.0, 0.0)
        gesture.set_state(Gtk.EventSequenceState.CLAIMED)


def drag(window: Gtk.Window, area: Area, dx: float = 60, dy: float = 40) -> tuple[int, tuple[float, float]]:
    """A real press-move-release from the top-left quarter of `area`; returns what the area saw."""
    ok, rect = area.compute_bounds(window)
    assert ok
    x, y, child = ctypes.c_int(), ctypes.c_int(), ctypes.c_ulong()
    assert x11.XTranslateCoordinates(display, window.get_surface().get_xid(), x11.XDefaultRootWindow(display), 0, 0,
                                     ctypes.byref(x), ctypes.byref(y), ctypes.byref(child))
    tx, ty = window.get_surface_transform()
    sx, sy = x.value + tx + rect.get_x() + rect.get_width() / 4, y.value + ty + rect.get_y() + rect.get_height() / 4
    before = area.begun

    def move(px, py):
        xtst.XTestFakeMotionEvent(display, -1, round(px), round(py), 0)
        x11.XFlush(display)
        settle(0.04)

    move(sx, sy)
    xtst.XTestFakeButtonEvent(display, 1, True, 0)
    x11.XFlush(display)
    settle(0.06)
    for step in range(1, 7):
        move(sx + dx * step / 6, sy + dy * step / 6)
    xtst.XTestFakeButtonEvent(display, 1, False, 0)
    x11.XFlush(display)
    settle(0.2)
    return area.begun - before, area.moved


def reached(window, area, label) -> None:
    begun, moved = drag(window, area)
    assert begun == 1 and abs(moved[0] - 60) <= 2 and abs(moved[1] - 40) <= 2, (label, begun, moved)


class PythonKit:
    name = "Python"

    def __init__(self, window, body):
        self.center = ActionCenter()
        self.center.attach(body)
        self.center.show_bar([BarAction("sparkles", "Style", key="style"), BarPrompt("Edit…")])

    def grow_panel(self):
        self.center.grow("style", Gtk.Box(height_request=60))

    def grow_editor(self, target):
        self.center.set_editor(ActionEditor("Edit", "sliders-horizontal", body=Gtk.Box(height_request=40),
                                            target=target))
        self.center.grow()

    def grown(self):
        return self.center.grown

    def state(self):
        return self.center.state


class CKit:
    name = "C"

    def __init__(self, window, body):
        SunoUI.LayerHost.install(window)
        self.center = SunoUI.ActionCenter.new(None)
        self.center.attach(body)
        self.center.show_bar([SunoUI.BarItem.new_action("sparkles", "Style", None),
                              SunoUI.BarItem.new_prompt("Edit…")], None)

    def grow_panel(self):
        self.center.grow_panel("style", SunoUI.bar_panel_new("Style"))

    def grow_editor(self, target):
        editor = SunoUI.ActionEditor.new("Edit", "sliders-horizontal")
        editor.set_target(target)
        self.center.set_editor(editor)
        self.center.grow()

    def grown(self):
        return self.center.get_grown()

    def state(self):
        return self.center.get_state()


for Kit in (PythonKit, CKit):
    window = Gtk.Window(default_width=900, default_height=640, decorated=False)
    body = Gtk.Box(hexpand=True, vexpand=True)
    canvas, other = Area(), Area(width_request=220)
    body.append(other)
    body.append(canvas)
    window.set_child(body)
    window.present()
    settle(0.5)
    kit = Kit(window, body)
    settle(0.8)
    name = kit.name

    reached(window, canvas, f"{name}: at rest")

    kit.grow_panel()
    settle(0.5)
    assert kit.grown() == "style", (name, kit.grown())
    reached(window, canvas, f"{name}: under a grown panel")
    assert kit.grown() is None, f"{name}: the press outside folds the panel"

    kit.grow_editor(None)
    settle(0.5)
    assert kit.state() == "editor", (name, kit.state())
    reached(window, canvas, f"{name}: under an editor without a target")
    assert kit.state() != "editor", f"{name}: an editor without a target folds"

    kit.grow_editor(canvas)
    settle(0.5)
    assert kit.state() == "editor", (name, kit.state())
    for attempt in range(2):
        reached(window, canvas, f"{name}: on the editor's target")
        assert kit.state() == "editor", f"{name}: a drag on the target is part of the edit"
    reached(window, other, f"{name}: beside the editor's target")
    assert kit.state() != "editor", f"{name}: a press on other content folds the editor"

    window.destroy()
    settle(0.2)
    print(f"{name} ActionCenter light dismiss with a real pointer: rest, panel, editor, target PASS", flush=True)
