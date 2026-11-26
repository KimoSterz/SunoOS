#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""Settings › Luma account › Sync driven as a person drives it, inside a test VM (run as the person, in the session).

  settings-ui.py open | setup | join | confirm | state

open:    asks the session bus for org.gnome.Settings (D-Bus activation, as the Shell's links and the Sync island do)
         and shows the Sync page; prints the process that owns org.gnome.Settings: pid, unit, program.
setup:   presses the Sync switch, saves the recovery key as the sheet asks (the words are read off the sheet and typed
         back into its Word fields; they never leave this VM), and presses Turn on Sync.
join:    presses the Sync switch on a device of an account that has Sync; prints the code the sheet shows.
confirm: presses Same code on the join sheet.
state:   prints the Sync page's title line and any error Settings shows.
Every widget is reached through AT-SPI and pressed through its own action, never through ConnectSync1 directly.
Prints one JSON line; exit status 0 when the step did what it says.
"""
from __future__ import annotations

import json
import re
import sys
import time

import gi

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi, Gio, GLib  # noqa: E402

SETTINGS = "org.gnome.Settings"


def out(ok: bool, **fields) -> None:
    print(json.dumps({"ok": ok, **fields}), flush=True)
    sys.exit(0 if ok else 1)


def walk(node):
    try:
        yield node
        for i in range(node.get_child_count()):
            child = node.get_child_at_index(i)
            if child is not None:
                yield from walk(child)
    except GLib.Error:
        return


def settings_app():
    desktop = Atspi.get_desktop(0)
    for i in range(desktop.get_child_count()):
        app = desktop.get_child_at_index(i)
        try:
            if app is not None and app.get_name() in ("gnome-control-center", "Settings", SETTINGS):
                return app
        except GLib.Error:
            pass
    return None


def find(predicate, timeout: float = 30, every: float = 0.5):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        app = settings_app()
        for node in walk(app) if app is not None else ():
            try:
                if predicate(node):
                    return node
            except GLib.Error:
                pass
        time.sleep(every)
    return None


BUTTON_ROLES = ("push button", "button")        # AT-SPI 2.52 names GTK's button role "button"


def named(role: str, name: str):
    roles = BUTTON_ROLES if role == "push button" else (role,)
    return lambda n: n.get_role_name() in roles and n.get_name() == name and showing(n)


def showing(node) -> bool:
    states = node.get_state_set()
    return states.contains(Atspi.StateType.SHOWING) and states.contains(Atspi.StateType.SENSITIVE)


def press(node) -> None:
    for i in range(node.get_n_actions()):
        if node.get_action_name(i) in ("click", "activate", "press", "toggle"):
            node.do_action(i)
            return
    node.do_action(0)


def texts(node) -> list[str]:
    found = []
    for child in walk(node):
        try:
            if child.get_role_name() == "label" and child.get_name():
                found.append(child.get_name())
        except GLib.Error:
            pass
    return found


def owner() -> dict:
    bus = Gio.bus_get_sync(Gio.BusType.SESSION)

    def call(method, args, reply):
        return bus.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", method, args,
                             GLib.VariantType(reply), Gio.DBusCallFlags.NONE, 30000, None).unpack()[0]
    name = call("GetNameOwner", GLib.Variant("(s)", (SETTINGS,)), "(s)")
    pid = call("GetConnectionUnixProcessID", GLib.Variant("(s)", (name,)), "(u)")
    cgroup = open(f"/proc/{pid}/cgroup").read().strip().rsplit("/", 1)[-1]
    import os
    return {"bus_name": name, "pid": pid, "unit": cgroup, "exe": os.readlink(f"/proc/{pid}/exe")}


def errors() -> list[str]:
    app = settings_app()
    seen = []
    for text in texts(app) if app is not None else ():
        if "NotAuthorized" in text or "Only the" in text or "Error" in text:
            seen.append(text)
    return seen


def open_page() -> None:
    bus = Gio.bus_get_sync(Gio.BusType.SESSION)
    # org.gtk.Actions.Activate on the bus name: the bus starts Settings if it isn't running (D-Bus activation).
    bus.call_sync(SETTINGS, "/org/gnome/Settings", "org.gtk.Actions", "Activate",
                  GLib.Variant("(sava{sv})", ("launch-panel", [GLib.Variant("(sav)", ("users", [GLib.Variant("s", "sync")]))], {})),
                  None, Gio.DBusCallFlags.NONE, 120000, None)
    switch = find(named("switch", "Sync"), 240)
    if switch is None:
        out(False, step="open", detail="no Sync switch on the page", owner=owner(), labels=texts(settings_app())[:40] if settings_app() else [])
    out(True, step="open", owner=owner(), on=switch.get_state_set().contains(Atspi.StateType.CHECKED))


def main_switch():
    switch = find(named("switch", "Sync"), 120)
    if switch is None:
        out(False, detail="no Sync switch", errors=errors())
    return switch


def setup() -> None:
    press(main_switch())
    heading = find(lambda n: n.get_role_name() == "label" and (n.get_name() or "").startswith("If you ever lose all your devices"), 180)
    grid = heading and settings_app()
    if grid is None:
        out(False, step="setup", detail="the recovery key sheet never showed", errors=errors())
    # The sheet's grid: a numbered label (1..24) followed by its word, in order.
    labels, words = texts(grid), {}
    for i in range(len(labels) - 1):
        if labels[i] == str(len(words) + 1) and re.fullmatch(r"[a-z]+", labels[i + 1]):
            words[len(words) + 1] = labels[i + 1]
    if len(words) != 24:
        out(False, step="setup", detail=f"{len(words)} words on the sheet")
    tick = find(lambda n: n.get_role_name() == "check box" and (n.get_name() or "").startswith("I’ve saved my recovery key"), 60)
    press(tick)
    go = find(named("push button", "Continue"), 60)
    if go is None:
        out(False, step="setup", detail="Continue never became available")
    press(go)
    fields = []
    end = time.monotonic() + 90
    while len(fields) < 3 and time.monotonic() < end:
        app = settings_app()
        fields = [n for n in walk(app) if re.fullmatch(r"Word \d+", n.get_name() or "") and n.get_role_name() in ("entry", "text") and showing(n)]
        time.sleep(0.5)
    if len(fields) != 3:
        out(False, step="setup", detail=f"{len(fields)} Word fields")
    for field in fields:
        word = words[int(field.get_name().split()[1])]
        editable = field.get_editable_text_iface()
        if editable is None or not editable.set_text_contents(word):
            out(False, step="setup", detail=f"{field.get_name()}: the field takes no text through AT-SPI")
    turn_on = find(named("push button", "Turn on Sync"), 60)
    if turn_on is None:
        out(False, step="setup", detail="Turn on Sync stayed unavailable after the three words")
    press(turn_on)
    closed = find(lambda n: n.get_name() == "Turn on Sync", 1, 1) is None
    end = time.monotonic() + 240
    while not closed and time.monotonic() < end:
        time.sleep(1)
        closed = find(lambda n: n.get_name() == "Turn on Sync" and n.get_role_name() in BUTTON_ROLES, 1, 1) is None
    out(closed and not errors(), step="setup", detail="sheet closed" if closed else "sheet still open", errors=errors())


def join() -> None:
    press(main_switch())
    code = ""
    end = time.monotonic() + 300
    while not code and time.monotonic() < end:
        app = settings_app()
        halves = [t for t in texts(app) if re.fullmatch(r"\d{3}", t)] if app is not None else []
        if len(halves) >= 2:
            code = halves[0] + halves[1]
        else:
            time.sleep(1)
    out(bool(code) and not errors(), step="join", code=code, errors=errors())


def confirm() -> None:
    same = find(named("push button", "Same code"), 120)
    if same is None:
        out(False, step="confirm", detail="no Same code button", errors=errors())
    press(same)
    time.sleep(3)
    out(not errors(), step="confirm", errors=errors())


def state() -> None:
    app = settings_app()
    out(app is not None, step="state", labels=[t for t in texts(app) if len(t) < 80][:60] if app else [], errors=errors())


def press_sync() -> None:
    press(main_switch())
    out(True, step="press-sync")


def dump() -> None:
    """Every widget a person acts on, with its role, name, states and actions (for finding the sheet's controls)."""
    app = settings_app()
    rows = []
    for node in walk(app) if app is not None else ():
        try:
            role, name = node.get_role_name(), node.get_name() or ""
            if role in ("push button", "button", "toggle button", "check box", "switch", "entry", "text", "password text") or "saved" in name:
                states = node.get_state_set()
                flags = "".join(c for c, t in (("S", Atspi.StateType.SHOWING), ("E", Atspi.StateType.SENSITIVE),
                                               ("C", Atspi.StateType.CHECKED)) if states.contains(t))
                rows.append(f"{role} '{name[:70]}' [{flags}] {[node.get_action_name(i) for i in range(node.get_n_actions())]}")
        except GLib.Error:
            pass
    print("\n".join(rows))


if __name__ == "__main__":
    {"open": open_page, "setup": setup, "join": join, "confirm": confirm, "state": state, "press-sync": press_sync,
     "dump": dump}[sys.argv[1]]()
