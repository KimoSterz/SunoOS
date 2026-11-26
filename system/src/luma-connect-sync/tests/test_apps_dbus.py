# SPDX-License-Identifier: Apache-2.0
"""org.projectluma.impl.portal.Sync on a real (private) session bus: only the portal may call it, the caller's
pidfd is checked, arguments, descriptors and answers keep their D-Bus types, and signals name their app."""
from __future__ import annotations

import fcntl
import os
import shutil
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path

import apps_testkit as kit
from apps_harness import APP, AppsBase

try:
    import gi
    gi.require_version("Gio", "2.0")
    from gi.repository import Gio, GLib
except (ImportError, ValueError):
    Gio = None

IMPL = ("org.projectluma.ConnectSync1", "/org/projectluma/ConnectSync1/Apps", "org.projectluma.impl.portal.Sync")


@unittest.skipIf(Gio is None or not shutil.which("dbus-daemon"), "needs GLib and a D-Bus daemon")
class ImplOnTheBus(AppsBase):
    def setUp(self):
        super().setUp()
        self.ready(self.a)
        caller = self.a.callers[APP]
        self.proc = Path(tempfile.mkdtemp(dir=self.root))
        kit.flatpak_info(self.proc, os.getpid(), APP, caller.app_path, caller.commit)
        self.bus = subprocess.Popen(["dbus-daemon", "--session", "--nofork", "--print-address=1", "--nopidfile"],
                                    stdout=subprocess.PIPE, text=True)
        self.address = self.bus.stdout.readline().strip()
        self.addCleanup(self.bus.wait)
        self.addCleanup(self.bus.terminate)
        from luma_connect_sync.apps_api.dbus import AppsPortal
        self.context = GLib.MainContext.new()
        self.loop = GLib.MainLoop.new(self.context, False)
        ready = threading.Event()

        def serve():
            self.context.push_thread_default()
            conn = Gio.DBusConnection.new_for_address_sync(self.address, Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT
                                                           | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION, None, None)
            self.portal = AppsPortal(lambda: self.a.api, proc=self.proc, trust_any_portal=True, roots=[caller.installation])
            self.portal.register(conn)
            conn.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "RequestName",
                           GLib.Variant("(su)", (IMPL[0], 4)), None, Gio.DBusCallFlags.NONE, -1, None)
            ready.set()
            self.loop.run()
        self.thread = threading.Thread(target=serve, daemon=True)
        self.thread.start()
        ready.wait(10)
        self.addCleanup(self.thread.join, 5)
        self.addCleanup(self.loop.quit)
        flags = Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION
        self.frontend = Gio.DBusConnection.new_for_address_sync(self.address, flags, None, None)
        self.frontend.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "RequestName",
                                GLib.Variant("(su)", ("org.freedesktop.portal.Desktop", 4)), None, Gio.DBusCallFlags.NONE, -1, None)
        self.app_name = ":1.4242"

    def call(self, conn, method, signature, args, reply, fds=None):
        pidfd = os.pidfd_open(os.getpid())
        fd_list = fds or Gio.UnixFDList.new()
        index = fd_list.append(pidfd)
        os.close(pidfd)
        caller = {"app_id": GLib.Variant("s", APP), "kind": GLib.Variant("s", "flatpak"), "pidfd": GLib.Variant("h", index),
                  "sender": GLib.Variant("s", self.app_name)}
        variant = GLib.Variant(f"(a{{sv}}{signature})", (caller, *args))
        result, out = conn.call_with_unix_fd_list_sync(*IMPL, method, variant, GLib.VariantType(reply), Gio.DBusCallFlags.NONE,
                                                       30000, fd_list, None)
        return result.unpack(), out

    def test_only_the_portal_may_call(self):
        other = Gio.DBusConnection.new_for_address_sync(self.address, Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT
                                                        | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION, None, None)
        with self.assertRaises(GLib.Error) as caught:
            self.call(other, "GetStatus", "", (), "(a{sv})")
        self.assertIn("org.projectluma.portal.Sync.Error.Refused", caught.exception.message)
        (status,), _ = self.call(self.frontend, "GetStatus", "", (), "(a{sv})")
        self.assertEqual(status["status"], "available")

    def test_the_portal_check_reads_the_peer_through_its_pidfd(self):
        """A recycled PID can't pass: the unit is read through the peer's pidfd, alive before and after (review)."""
        from luma_connect_sync.apps_api import dbus as impl
        fake = Path(tempfile.mkdtemp(dir=self.root))
        child = subprocess.Popen(["sleep", "30"])
        pidfd = os.pidfd_open(child.pid)
        (fake / str(child.pid)).mkdir()
        (fake / str(child.pid) / "cgroup").write_text("0::/user.slice/user@1000.service/app.slice/xdg-desktop-portal.service\n")
        self.assertEqual(impl.pidfd_unit(pidfd, fake), "xdg-desktop-portal.service")
        child.kill()
        child.wait()
        self.assertEqual(impl.pidfd_unit(pidfd, fake), "", "a dead process (whose PID may be reused) names no unit")
        os.close(pidfd)
        unit = self.portal.peer_unit(self.frontend.get_unique_name())
        self.assertIsInstance(unit, str)

    def test_a_caller_whose_sandbox_names_another_app_is_refused(self):
        kit.flatpak_info(self.proc, os.getpid(), "org.example.Other", self.a.callers[APP].app_path, self.a.callers[APP].commit)
        with self.assertRaises(GLib.Error) as caught:
            self.call(self.frontend, "GetStatus", "", (), "(a{sv})")
        self.assertIn("Refused", caught.exception.message)

    def test_records_assets_and_types(self):
        (results,), _ = self.call(self.frontend, "Save", "sa(says)a{sv}", ("saves", [("slot", b"bytes\x00ok", "")], {}), "(aa{sv})")
        self.assertEqual((results[0]["outcome"], bytes(results[0]["record"]["value"])), ("saved", b"bytes\x00ok"))
        version = results[0]["record"]["version"]
        fd = os.memfd_create("t", os.MFD_ALLOW_SEALING)
        os.write(fd, b"asset bytes")
        fcntl.fcntl(fd, fcntl.F_ADD_SEALS, fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK)
        fds = Gio.UnixFDList.new()
        index = fds.append(fd)
        os.close(fd)
        (put,), _ = self.call(self.frontend, "PutAsset", "ssshsa{sv}", ("saves", "slot", "state", index, version, {}), "(a{sv})", fds)
        self.assertEqual(put["outcome"], "saved")
        (state, info), out = self.call(self.frontend, "OpenAsset", "ssss", ("saves", "slot", "state", ""), "(sa{sv})")
        self.assertEqual(state, "here")
        got = out.get(info["fd"])
        self.assertEqual(os.pread(got, 100, 0), b"asset bytes")
        os.close(got)
        (records, token, more), _ = self.call(self.frontend, "FetchChanges", "ssa{sv}", ("saves", "", {}), "(aa{sv}sb)")
        self.assertEqual(([r["name"] for r in records], more), (["slot"], False))
        (lease,), _ = self.call(self.frontend, "GetLease", "ss", ("saves", "slot"), "(a{sv})")
        self.assertEqual((lease["active"], lease["until_ms"]), (False, 0))
        with self.assertRaises(GLib.Error) as caught:
            self.call(self.frontend, "Save", "sa(says)a{sv}", ("Bad Label", [("x", b"", "")], {}), "(aa{sv})")
        self.assertIn("org.projectluma.portal.Sync.Error.Invalid", caught.exception.message)

    def test_signals_name_the_subscribed_app(self):
        got = []
        self.frontend.signal_subscribe(IMPL[0], IMPL[2], "Changed", IMPL[1], None, Gio.DBusSignalFlags.NONE,
                                       lambda *a: got.append(a[5].unpack()))
        self.call(self.frontend, "Subscribe", "as", (["saves"],), "()")
        self.ready(self.b)
        self.b.api.save(self.b.ctx(), "saves", [["from-b", b"x", ""]], {})
        self.b.sync()
        self.a.sync()
        pending = [e for e in self.a.api.events if e[1] == "Changed"]
        self.assertTrue(pending, f"a's cycle saw b's write: {self.a.api.events} subs {self.portal.subs}")
        self.portal.flush()
        context = GLib.MainContext.default()
        for _ in range(200):
            context.iteration(False)
            if got:
                break
            import time
            time.sleep(0.02)
        self.assertTrue(got, "Changed reached the frontend")
        destination, zone, _details = got[0]
        self.assertEqual((destination, zone), (self.app_name, "saves"))


if __name__ == "__main__":
    unittest.main()
