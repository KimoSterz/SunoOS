#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""A TV app's side of org.projectluma.Shell.Remote1: optionally a window (with
an application ID when given), then the calls, each answer printed as one JSON
line ("show#0", "claim#1", ...); "sleepN" waits N ms. Stays until killed."""
import json
import sys
import time

import gi
gi.require_version("Gtk", "4.0")
from gi.repository import Gio, GLib, Gtk  # noqa: E402

title, actions = sys.argv[1], sys.argv[2].split(",")
if len(sys.argv) > 3:
    GLib.set_prgname(sys.argv[3])
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)


def call(method, parameters=None):
    try:
        bus.call_sync("org.projectluma.Shell.Remote", "/org/projectluma/Shell/Remote",
                      "org.projectluma.Shell.Remote1", method, parameters, None,
                      Gio.DBusCallFlags.NO_AUTO_START, 5000, None)
        return "ok"
    except GLib.Error as error:
        return Gio.DBusError.get_remote_error(error) or error.message


window = None
if title != "-":
    Gtk.init()
    window = Gtk.Window(title=title, default_width=320, default_height=200)
    window.present()
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline and not window.is_active():
        GLib.MainContext.default().iteration(False)
        time.sleep(0.01)
    print(json.dumps({"title": title, "active": window.is_active()}), flush=True)

for index, action in enumerate(actions):
    if action.startswith("sleep"):
        deadline = time.monotonic() + int(action[5:]) / 1000
        while time.monotonic() < deadline:
            GLib.MainContext.default().iteration(False)
            time.sleep(0.01)
        continue
    method = {"show": ("ShowQuickPanel", None),
              "claim": ("ClaimGamepads", GLib.Variant("(b)", (True,)))}[action]
    print(json.dumps({"title": title, "action": f"{action}#{index}", "answer": call(*method)}), flush=True)

loop = GLib.MainLoop()
loop.run()
