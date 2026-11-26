#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""A stand-in for systemd-logind (and GDM's manager) on a test system bus, for the headless
Shell: one graphical session (c1) of the current user, its Lock and Unlock
signals, LockedHint, and the Manager calls the Shell makes at start-up.

  fake-logind.py [--lock-after SECONDS] [--log FILE] [--uid UID --user NAME]

With /run/systemd/seats present the Shell takes logind as there and builds
its screen shield. --lock-after emits what `loginctl lock-sessions` emits
(Lock on every session) so a test can see whether the Shell locks. --uid and
--user make the session another user's (the stand-in itself runs as root,
which owns org.freedesktop.login1)."""
import argparse
import os
import sys

from gi.repository import Gio, GLib

SESSION = "/org/freedesktop/login1/session/c1"
XML = """<node>
<interface name="org.freedesktop.login1.Manager">
  <method name="GetSession"><arg type="s" direction="in"/><arg type="o" direction="out"/></method>
  <method name="GetSessionByPID"><arg type="u" direction="in"/><arg type="o" direction="out"/></method>
  <method name="GetUser"><arg type="u" direction="in"/><arg type="o" direction="out"/></method>
  <method name="ListSessions"><arg type="a(susso)" direction="out"/></method>
  <method name="LockSessions"/>
  <method name="LockSession"><arg type="s" direction="in"/></method>
  <method name="UnlockSessions"/>
  <method name="Inhibit"><arg type="s" direction="in"/><arg type="s" direction="in"/><arg type="s" direction="in"/><arg type="s" direction="in"/><arg type="h" direction="out"/></method>
  <method name="CanSuspend"><arg type="s" direction="out"/></method>
  <method name="CanRebootToBootLoaderMenu"><arg type="s" direction="out"/></method>
  <signal name="PrepareForSleep"><arg type="b"/></signal>
</interface>
<interface name="org.freedesktop.login1.Session">
  <method name="SetLockedHint"><arg type="b" direction="in"/></method>
  <method name="Activate"/>
  <signal name="Lock"/>
  <signal name="Unlock"/>
  <property name="Id" type="s" access="read"/>
  <property name="Active" type="b" access="read"/>
  <property name="LockedHint" type="b" access="read"/>
  <property name="Class" type="s" access="read"/>
  <property name="Type" type="s" access="read"/>
  <property name="Remote" type="b" access="read"/>
  <property name="State" type="s" access="read"/>
</interface>
<interface name="org.gnome.DisplayManager.Manager">
  <method name="RegisterSession"><arg type="a{sv}" direction="in"/></method>
  <property name="Version" type="s" access="read"/>
</interface>
<interface name="org.freedesktop.login1.User">
  <property name="Display" type="(so)" access="read"/>
  <property name="Sessions" type="a(so)" access="read"/>
</interface>
</node>"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lock-after", type=float, default=0)
    parser.add_argument("--log", default="")
    parser.add_argument("--uid", type=int, default=os.getuid())
    parser.add_argument("--user", default=os.environ.get("USER", "root"))
    args = parser.parse_args()
    log = open(args.log, "a") if args.log else sys.stderr
    info = Gio.DBusNodeInfo.new_for_xml(XML)
    state = {"locked": False}
    bus = Gio.bus_get_sync(Gio.BusType.SYSTEM)

    def say(text: str) -> None:
        print(text, file=log, flush=True)

    def session_paths():
        return [SESSION, "/org/freedesktop/login1/session/auto", "/org/freedesktop/login1/session/self"]

    def emit_all(signal: str) -> None:
        # logind's LockSessions: the signal on each session's own object.
        bus.emit_signal(None, SESSION, "org.freedesktop.login1.Session", signal, None)
        say(f"emitted {signal} on {SESSION}")

    def manager(_c, sender, path, iface, method, params, inv):
        say(f"Manager.{method}{params.unpack() if params else ''} from {sender}")
        if method in ("GetSession", "GetSessionByPID"):
            inv.return_value(GLib.Variant("(o)", (SESSION,)))
        elif method == "GetUser":
            inv.return_value(GLib.Variant("(o)", (f"/org/freedesktop/login1/user/_{args.uid}",)))
        elif method == "ListSessions":
            inv.return_value(GLib.Variant("(a(susso))", ([("c1", args.uid, args.user, "seat0", SESSION)],)))
        elif method in ("LockSessions", "LockSession"):
            # `loginctl lock-sessions`, or `loginctl lock-session c1`: Lock on the session.
            emit_all("Lock")
            inv.return_value(None)
        elif method == "UnlockSessions":
            emit_all("Unlock")
            inv.return_value(None)
        elif method == "Inhibit":
            r, w = os.pipe()
            fds = Gio.UnixFDList.new_from_array([r])
            inv.return_value_with_unix_fd_list(GLib.Variant("(h)", (0,)), fds)
        else:
            inv.return_value(GLib.Variant("(s)", ("no",)))

    def session_call(_c, sender, path, iface, method, params, inv):
        say(f"Session.{method}{params.unpack()} on {path}")
        if method == "SetLockedHint":
            state["locked"] = params.unpack()[0]
        inv.return_value(None)

    def session_prop(_c, _s, path, iface, prop):
        return {"Id": GLib.Variant("s", "c1"), "Active": GLib.Variant("b", True),
                "LockedHint": GLib.Variant("b", state["locked"]), "Class": GLib.Variant("s", "user"),
                "Type": GLib.Variant("s", "wayland"), "Remote": GLib.Variant("b", False),
                "State": GLib.Variant("s", "active")}[prop]

    def user_prop(_c, _s, path, iface, prop):
        if prop == "Display":
            return GLib.Variant("(so)", ("c1", SESSION))
        return GLib.Variant("a(so)", [("c1", SESSION)])

    iface = {i.name: i for i in info.interfaces}
    bus.register_object("/org/freedesktop/login1", iface["org.freedesktop.login1.Manager"], manager, None, None)
    for path in session_paths():
        bus.register_object(path, iface["org.freedesktop.login1.Session"], session_call, session_prop, None)
    for path in (f"/org/freedesktop/login1/user/_{args.uid}", "/org/freedesktop/login1/user/self"):
        bus.register_object(path, iface["org.freedesktop.login1.User"], None, user_prop, None)
    # GDM's manager: the Shell builds its screen shield only under a display manager it knows.
    bus.register_object("/org/gnome/DisplayManager/Manager", iface["org.gnome.DisplayManager.Manager"],
                        lambda *a: a[-1].return_value(None), lambda *a: GLib.Variant("s", "50.0"), None)
    Gio.bus_own_name_on_connection(bus, "org.freedesktop.login1", Gio.BusNameOwnerFlags.NONE, None, None)
    Gio.bus_own_name_on_connection(bus, "org.gnome.DisplayManager", Gio.BusNameOwnerFlags.NONE, None, None)
    if args.lock_after:
        GLib.timeout_add(int(args.lock_after * 1000), lambda: (emit_all("Lock"), False)[1])
    say("fake logind up")
    GLib.MainLoop().run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
