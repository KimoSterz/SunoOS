#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""A test Flatpak app (org.example.SyncProbe) for the ADR-057 two-VM proof: it uses Connect Sync for apps only
through org.projectSuno.portal.Sync, from inside its sandbox, and prints JSON.

  sync-probe status | save ZONE NAME VALUE [BASE] | get ZONE NAME | fetch ZONE [TOKEN] | lease ZONE NAME |
             get-lease ZONE NAME | asset ZONE NAME ASSET TEXT BASE | open ZONE NAME ASSET | direct
"""
import json
import os
import sys

import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

PORTAL = ("org.freedesktop.portal.Desktop", "/org/freedesktop/portal/desktop", "org.projectSuno.portal.Sync")


def plain(value):
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        if value and all(isinstance(x, int) for x in value) and len(value) > 0 and isinstance(value, list):
            try:
                return bytes(value).decode()
            except (ValueError, UnicodeDecodeError):
                return list(value)
        return [plain(v) for v in value]
    if isinstance(value, bytes):
        return value.decode(errors="replace")
    return value


def call(bus, method, signature, args, reply, fds=None):
    result, out_fds = bus.call_with_unix_fd_list_sync(*PORTAL, method, GLib.Variant(signature, args) if signature else None,
                                                      GLib.VariantType(reply), Gio.DBusCallFlags.NONE, 60000, fds, None)
    return result.unpack(), out_fds


def main(argv):
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    cmd = argv[1]
    try:
        if cmd == "status":
            out, _ = call(bus, "GetStatus", None, None, "(a{sv})")
            return {"status": plain(out[0])}
        if cmd == "save":
            zone, name, value = argv[2:5]
            base = argv[5] if len(argv) > 5 else ""
            out, _ = call(bus, "Save", "(sa(says)a{sv})", (zone, [(name, value.encode(), base)], {}), "(aa{sv})")
            return {"results": plain(out[0])}
        if cmd == "get":
            out, _ = call(bus, "Get", "(ss)", tuple(argv[2:4]), "(ba{sv})")
            return {"found": out[0], "record": plain(out[1])}
        if cmd == "fetch":
            out, _ = call(bus, "FetchChanges", "(ssa{sv})", (argv[2], argv[3] if len(argv) > 3 else "", {}), "(aa{sv}sb)")
            return {"records": plain(out[0]), "token": out[1], "more": out[2]}
        if cmd in ("lease", "get-lease"):
            if cmd == "lease":
                out, _ = call(bus, "Lease", "(ssub)", (argv[2], argv[3], 600, False), "(a{sv})")
            else:
                out, _ = call(bus, "GetLease", "(ss)", (argv[2], argv[3]), "(a{sv})")
            return {"lease": plain(out[0])}
        if cmd == "asset":
            zone, name, asset, text, base = argv[2:7]
            fd = os.memfd_create("probe", os.MFD_ALLOW_SEALING)
            os.write(fd, text.encode())
            import fcntl
            fcntl.fcntl(fd, fcntl.F_ADD_SEALS, fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK)
            fds = Gio.UnixFDList.new()
            index = fds.append(fd)
            os.close(fd)
            out, _ = call(bus, "PutAsset", "(ssshsa{sv})", (zone, name, asset, index, base, {}), "(a{sv})", fds)
            return {"result": plain(out[0])}
        if cmd == "open":
            out, fds = call(bus, "OpenAsset", "(ssss)", (argv[2], argv[3], argv[4], ""), "(sa{sv})")
            text = ""
            if fds is not None and "fd" in out[1]:
                fd = fds.get(out[1]["fd"])
                text = os.pread(fd, 1 << 20, 0).decode(errors="replace")
                os.close(fd)
            return {"state": out[0], "text": text}
        if cmd == "direct":
            # The implementation is not reachable from a sandbox: the bus proxy has no talk permission for it.
            try:
                bus.call_sync("org.projectSuno.ConnectSync1", "/org/projectSuno/ConnectSync1/Apps", "org.projectSuno.impl.portal.Sync",
                              "GetStatus", GLib.Variant("(a{sv})", ({"app_id": GLib.Variant("s", "org.example.Victim"),
                                                                     "kind": GLib.Variant("s", "flatpak")},)),
                              None, Gio.DBusCallFlags.NONE, 10000, None)
                return {"reached": True}
            except GLib.Error as error:
                return {"reached": False, "error": Gio.DBusError.get_remote_error(error) or error.message}
        return {"error": "unknown command"}
    except GLib.Error as error:
        return {"dbus_error": Gio.DBusError.get_remote_error(error) or "", "message": error.message}


if __name__ == "__main__":
    print(json.dumps(main(sys.argv)))
