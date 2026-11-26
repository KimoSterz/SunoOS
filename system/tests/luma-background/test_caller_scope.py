# SPDX-License-Identifier: MPL-2.0
"""Who may ask what: the portal backend answers only xdg-desktop-portal, apps
read only their own agent and login item, AgentChanged is unicast, and a
caller that can't be read is not taken for a native one."""
import os
import shutil
from dataclasses import replace
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from gi.repository import Gio, GLib

from luma_background import identity as identity_module
from luma_background.identity import Caller, IdentityError, IdentityResolver
from luma_background.manager import Refused
from luma_background.portal import BACKEND_PATH, BackgroundPortal
from luma_background.service import BackgroundService

APP, OTHER = 'org.projectluma.Messages', 'org.projectluma.Clock'


class FakeProc:
    """A /proc for one pid, beside a real /proc/self."""

    def __init__(self):
        self.root = Path(tempfile.mkdtemp(prefix='bg-proc-'))
        self.pid = 4242
        base = self.root / str(self.pid)
        (base / 'ns').mkdir(parents=True)
        (base / 'root').mkdir()
        (base / 'cgroup').write_text('0::/user.slice/user@1000.service/app.slice/app-gnome-x-1.scope\n')
        self.started('1000')
        (self.root / 'self').mkdir()
        os.symlink('/', self.root / 'self' / 'root')
        (self.root / 'self' / 'ns').mkdir()
        os.symlink(os.readlink('/proc/self/ns/mnt'), self.root / 'self' / 'ns' / 'mnt')

    def base(self):
        return self.root / str(self.pid)

    def started(self, start):
        fields = ['S'] + ['0'] * 18 + [start] + ['0'] * 30
        (self.root / str(self.pid) / 'stat').write_text(f'{self.pid} (x) {" ".join(fields)}\n')

    def cleanup(self):
        shutil.rmtree(self.root, ignore_errors=True)


def credentials(proc, extra=None, fds=None):
    values = {'UnixUserID': GLib.Variant('u', os.getuid()), 'ProcessID': GLib.Variant('u', proc.pid)}
    values.update(extra or {})
    return GLib.Variant('(a{sv})', (values,)), fds


def resolver(proc, authenticate=None, **kwargs):
    connection = mock.Mock()
    connection.call_with_unix_fd_list_sync.return_value = credentials(proc, **kwargs)
    return IdentityResolver(connection, proc=proc.root, authenticate=authenticate)


class IdentityFailsClosed(unittest.TestCase):
    def setUp(self):
        self.proc = FakeProc()
        self.addCleanup(self.proc.cleanup)

    def test_an_unreadable_or_malformed_sandbox_file_is_refused(self):
        info = self.proc.base() / 'root/.flatpak-info'
        info.write_text('[Application]\nname=org.example.App\n')
        info.chmod(0)
        if os.access(info, os.R_OK):
            self.skipTest('running as root: the file stays readable')
        with self.assertRaises(IdentityError):
            resolver(self.proc).resolve(':1.5')
        info.chmod(0o644)
        info.write_text('not a key file')
        with self.assertRaises(IdentityError):
            resolver(self.proc).resolve(':1.5')
        info.write_text('[Application]\nname=../evil\n')
        with self.assertRaises(IdentityError):
            resolver(self.proc).resolve(':1.5')

    def test_a_named_but_undelivered_process_descriptor_is_refused(self):
        class Broken:
            def get_length(self):
                return 1

            def get(self, _index):
                raise GLib.Error('invalid descriptor')

        for extra, fds in (({'ProcessFD': GLib.Variant('h', 0)}, None),
                           ({'ProcessFD': GLib.Variant('h', 2)}, Gio.UnixFDList.new()),
                           ({'ProcessFD': GLib.Variant('h', 0)}, Broken())):
            with self.subTest(extra=extra, fds=fds), self.assertRaises(IdentityError):
                resolver(self.proc, extra=extra, fds=fds).resolve(':1.5')

    def test_without_a_process_descriptor_the_pid_is_held_by_its_start_time(self):
        self.assertFalse(resolver(self.proc).resolve(':1.5').sandboxed)
        resolve = resolver(self.proc)
        real = resolve._resolve

        def reused(*args):
            self.proc.started('2000')  # the pid now names another process
            return real(*args)

        with mock.patch.object(resolve, '_resolve', reused), self.assertRaises(IdentityError):
            resolve.resolve(':1.5')
        (self.proc.base() / 'stat').unlink()
        with self.assertRaises(IdentityError):
            resolver(self.proc).resolve(':1.5')

    def test_a_flatpak_must_be_its_signed_deployment(self):
        (self.proc.base() / 'root/.flatpak-info').write_text(f'[Application]\nname={APP}\n')
        self.assertEqual(resolver(self.proc, lambda *_: APP).resolve(':1.5').app_id, APP)
        for authenticate in (lambda *_: OTHER, mock.Mock(side_effect=PermissionError('unsigned'))):
            with self.subTest(authenticate=authenticate), self.assertRaises(IdentityError):
                resolver(self.proc, authenticate).resolve(':1.5')

    def test_a_process_in_another_filesystem_is_never_a_trusted_program(self):
        # Its root is not ours: /usr/bin/gnome-control-center there is anything.
        os.symlink('/usr/bin/gnome-control-center', self.proc.base() / 'exe')
        os.symlink('mnt:[1]', self.proc.base() / 'ns/mnt')
        caller = resolver(self.proc).resolve(':1.5')
        self.assertEqual(caller.executable, '')
        self.assertFalse(resolver(self.proc).is_trusted_host(caller))

    def test_only_the_portal_frontend_passes_for_it(self):
        resolve = IdentityResolver(mock.Mock())
        frontend = Caller(':1.9', 9, os.getuid(), '', False, 'xdg-desktop-portal.service',
                          '/usr/libexec/xdg-desktop-portal')
        resolve.connection.call_sync.return_value = GLib.Variant('(s)', (':1.9',))
        owned = SimpleNamespace(st_uid=0, st_mode=0o100755)
        with mock.patch.object(identity_module.os, 'stat', return_value=owned):
            for caller, expected in ((frontend, True),
                                     (replace(frontend, unit='app-gnome-x-1.scope'), False),
                                     (replace(frontend, executable='/usr/bin/python3'), False),
                                     (replace(frontend, sandboxed=True), False)):
                with self.subTest(caller=caller), mock.patch.object(resolve, 'resolve', return_value=caller):
                    self.assertIs(resolve.is_portal_frontend(':1.9'), expected)
            resolve.connection.call_sync.return_value = GLib.Variant('(s)', (':1.10',))
            with mock.patch.object(resolve, 'resolve', return_value=frontend):
                self.assertFalse(resolve.is_portal_frontend(':1.9'), 'not the owner of portal.Desktop')


@unittest.skipUnless(shutil.which('dbus-run-session') and sys.platform.startswith('linux'), 'needs a session bus')
class PortalBackendOnItsOwnConnection(unittest.TestCase):
    def test_apps_cannot_reach_or_use_the_backend(self):
        code = r'''
import json
from gi.repository import Gio, GLib
from luma_background.portal import BACKEND_PATH, BackgroundPortal
address = Gio.dbus_address_get_for_bus_sync(Gio.BusType.SESSION, None)
flags = Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION
main = Gio.bus_get_sync(Gio.BusType.SESSION, None)
backend = Gio.DBusConnection.new_for_address_sync(address, flags, None, None)
app = Gio.DBusConnection.new_for_address_sync(address, flags, None, None)
frontend = Gio.DBusConnection.new_for_address_sync(address, flags, None, None)
notified = []
BackgroundPortal(backend, lambda app_id, reply: (notified.append(app_id), reply(1)), lambda app_id: None,
                 is_frontend=lambda sender: sender == frontend.get_unique_name())
def call(connection, destination, method, args, signature):
    out = {}
    def done(c, r):
        try:
            out['value'] = c.call_finish(r).unpack()
        except GLib.Error as error:
            out['error'] = Gio.DBusError.get_remote_error(error)
    connection.call(destination, BACKEND_PATH, 'org.freedesktop.impl.portal.Background', method, args,
                    GLib.VariantType.new(signature), Gio.DBusCallFlags.NONE, 5000, None, done)
    while not out:
        GLib.MainContext.default().iteration(True)
    return out
notify = GLib.Variant('(oss)', ('/org/freedesktop/portal/desktop/request/1_1/t', 'org.example.Victim', 'Victim'))
print(json.dumps({
    'app-notify': call(app, backend.get_unique_name(), 'NotifyBackground', notify, '(ua{sv})'),
    'app-state': call(app, backend.get_unique_name(), 'GetAppState', None, '(a{sv})'),
    'main-has-no-backend': call(app, main.get_unique_name(), 'NotifyBackground', notify, '(ua{sv})'),
    'frontend-notify': call(frontend, backend.get_unique_name(), 'NotifyBackground',
        GLib.Variant('(oss)', ('/org/freedesktop/portal/desktop/request/1_1/u', 'org.example.Victim', 'Victim')),
        '(ua{sv})'),
    'notified': notified}))
'''
        env = {**os.environ}
        env.pop('DBUS_SESSION_BUS_ADDRESS', None)
        result = subprocess.run(['dbus-run-session', '--', sys.executable, '-c', code], env=env,
                                capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)
        import json
        report = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(report['app-notify'].get('error'), 'org.freedesktop.DBus.Error.AccessDenied')
        self.assertEqual(report['app-state'].get('error'), 'org.freedesktop.DBus.Error.AccessDenied')
        self.assertTrue(report['main-has-no-backend'].get('error', '').endswith(('UnknownObject', 'UnknownMethod')),
                        report['main-has-no-backend'])
        self.assertIn('value', report['frontend-notify'])
        self.assertEqual(report['notified'], ['org.example.Victim'])


class ReadsAndSignalsAreScoped(unittest.TestCase):
    def service(self, trusted=False):
        service = BackgroundService.__new__(BackgroundService)
        service.connection = mock.Mock()
        service.identity = mock.Mock()
        service.identity.is_trusted_host.return_value = trusted
        service.manager = mock.Mock()
        service.manager.list.return_value = [{'app-id': APP, 'name': 'Messages'}, {'app-id': OTHER, 'name': 'Clock'}]
        service.manager.describe.side_effect = lambda app, reader=None: {'app-id': app, 'name': app}
        service.manager.agents = {APP: object(), OTHER: object()}
        service.login_items = mock.Mock()
        service.login_items.list.return_value = [{'app-id': APP + '.desktop'}, {'app-id': OTHER + '.desktop'}]
        service.login_items.describe.side_effect = lambda desktop_id: {'app-id': desktop_id}
        service._listeners = {}
        return service

    def caller(self, app=APP):
        return Caller(':1.21', 1234, 1000, app, True)

    def test_an_app_reads_only_its_own_agent(self):
        service, invocation = self.service(), mock.Mock()
        service._method_ListAgents(self.caller(), None, invocation)
        agents = invocation.return_value.call_args.args[0].unpack()[0]
        self.assertEqual([agent['app-id'] for agent in agents], [APP])
        with self.assertRaises(Refused):
            service._method_GetAgent(self.caller(), GLib.Variant('(s)', (OTHER,)), mock.Mock())
        service._method_GetAgent(self.caller(), GLib.Variant('(s)', (APP,)), invocation)

    def test_settings_and_the_dock_read_every_agent(self):
        service, invocation = self.service(trusted=True), mock.Mock()
        service._method_ListAgents(self.caller(''), None, invocation)
        self.assertEqual(len(invocation.return_value.call_args.args[0].unpack()[0]), 2)
        service._method_GetAgent(self.caller(''), GLib.Variant('(s)', (OTHER,)), invocation)

    def test_an_app_reads_only_its_own_login_item(self):
        service, invocation = self.service(), mock.Mock()
        service._method_ListLoginItems(self.caller(), None, invocation)
        self.assertEqual([item['app-id'] for item in invocation.return_value.call_args.args[0].unpack()[0]],
                         [APP + '.desktop'])
        with self.assertRaises(Refused):
            service._method_GetLoginItem(self.caller(), GLib.Variant('(s)', (OTHER + '.desktop',)), mock.Mock())

    def test_agent_changed_is_unicast_to_its_app_and_the_trusted(self):
        service = self.service()
        service._listeners = {':1.30': APP, ':1.31': OTHER}
        service._changed_apps, service._changed_all, service._emit_source = {APP}, False, 1
        service._login_items_changed = lambda: None
        with mock.patch.object(BackgroundService, '_trusted_listeners', return_value=[':1.2']):
            service._emit()
        sent = [(call.args[0], call.args[3]) for call in service.connection.emit_signal.call_args_list]
        self.assertEqual(sorted(sent), [(':1.2', 'AgentChanged'), (':1.30', 'AgentChanged')])
        self.assertNotIn(None, [destination for destination, signal in sent if signal == 'AgentChanged'])


class NamesAreNotShared(unittest.TestCase):
    def test_both_names_are_taken_outright_and_a_squatter_stops_the_service(self):
        from luma_background import service as module
        owned = []

        def own(connection, name, flags, acquired, lost):
            owned.append((name, flags))
            if name == module.BACKEND_NAME:
                # Someone already holds the backend name.
                GLib.idle_add(lambda: (lost(connection, name), False)[1])
            return len(owned)

        fake = mock.Mock()
        fake.prepare.side_effect = lambda then: then()
        with mock.patch.object(module, 'BackgroundService', return_value=fake), \
                mock.patch.object(module.Gio, 'bus_get_sync', return_value=mock.Mock()), \
                mock.patch.object(module.Gio.DBusConnection, 'new_for_address_sync', return_value=mock.Mock()), \
                mock.patch.object(module.Gio, 'dbus_address_get_for_bus_sync', return_value='unix:path=/x'), \
                mock.patch.object(module.Gio, 'bus_own_name_on_connection', side_effect=own), \
                mock.patch.object(module.GLib, 'timeout_add_seconds', return_value=0):
            code = module.main([])
        self.assertEqual(code, 1)
        flags = dict(owned)
        self.assertEqual(flags[module.BACKEND_NAME], module.Gio.BusNameOwnerFlags.DO_NOT_QUEUE)
        self.assertEqual(flags[module.BUS_NAME], module.Gio.BusNameOwnerFlags.DO_NOT_QUEUE)


class NoHiddenShell(unittest.TestCase):
    """A non-dumpable caller in an org.gnome.Shell@x unit holding org.gnome.Shell is not the Shell."""

    def test_an_unreadable_caller_in_the_shells_unit_is_not_trusted(self):
        proc = FakeProc()
        self.addCleanup(proc.cleanup)
        base = proc.base()
        (base / 'cgroup').write_text('0::/user.slice/user-1000.slice/user@1000.service/session.slice/org.gnome.Shell@x.service\n')
        (base / 'cmdline').write_bytes(b'/usr/bin/gnome-shell\0')
        (base / 'comm').write_text('gnome-shell\n')
        real_stat, real_readlink = Path.stat, os.readlink
        hidden = str(base)

        def stat(path, *args, **kwargs):
            if str(path).startswith(hidden + '/root'):
                raise PermissionError(13, 'non-dumpable')
            return real_stat(path, *args, **kwargs)

        def readlink(path, *args, **kwargs):
            if str(path).startswith(hidden + '/'):
                raise PermissionError(13, 'non-dumpable')
            return real_readlink(path, *args, **kwargs)

        resolver_ = resolver(proc)
        resolver_.connection.call_sync.return_value = GLib.Variant('(s)', (':1.5',))
        with mock.patch.object(Path, 'stat', stat), mock.patch.object(identity_module.os, 'readlink', readlink):
            caller = resolver_.resolve(':1.5')
        self.assertEqual(caller.executable, '')
        self.assertFalse(resolver_.is_trusted_host(caller))


if __name__ == '__main__':
    unittest.main()
