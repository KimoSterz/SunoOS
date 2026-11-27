# SPDX-License-Identifier: Apache-2.0
import json
import os
from pathlib import Path
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from Suno_continuity.connect_ui_broker import APP, ConnectUIBroker, command_plan, require_connect_if_sandbox
from native_sender_fixture import NativeSender

class Invocation:
    def __init__(self): self.ready=threading.Event();self.error=None;self.value=None
    def return_dbus_error(self,name,message): self.error=(name,message);self.ready.set()
    def return_value(self,value): self.value=value;self.ready.set()
class GLib:
    @staticmethod
    def idle_add(callback): return callback()
    @staticmethod
    def Variant(kind,value): return value

class ConnectUI(unittest.TestCase):
    def test_fixed_commands_and_no_arbitrary_paths_options_hub_or_fields(self):
        self.assertEqual(command_plan({'operation':'status','values':{}}),(['status','--json'],45,None))
        self.assertEqual(command_plan({'operation':'service','values':{'id':'notes','enabled':False}})[0],['service','notes','off'])
        plan=command_plan({'operation':'profile','values':{'name':'Owned name','discoverable_by_phone':True}})
        self.assertEqual(plan[0],['profile','set','--stdin','--json']); self.assertEqual(json.loads(plan[2])['name'],'Owned name')
        plan=command_plan({'operation':'connect','values':{'code':'ABCD-1234','name':'Laptop'}})
        self.assertEqual(plan[0][2],'https://hub.simplyluma.com')
        for invalid in ({'operation':'status','values':{'path':'/etc/passwd'}},
            {'operation':'service','values':{'id':'secret','enabled':True}},
            {'operation':'service','values':{'id':'notes','enabled':1}},
            {'operation':'profile','values':{'token':'secret'}},
            {'operation':'profile','values':{'phone':'x'*257}},
            {'operation':'connect','values':{'code':'CODE','name':'Laptop','hub':'https://evil.invalid'}},
            {'operation':'shell','values':{}}, {'operation':'sign-out','values':{'device':'x\n--force'}}):
            with self.subTest(invalid=invalid),self.assertRaises(ValueError):command_plan(invalid)

    def test_auth_before_work_bounded_queue_and_reply_never_exposes_failure_detail(self):
        ran=[]
        def runner(args,timeout,body,cancelled):
            ran.append(args);return 0,'{"signed_in":false}',''
        broker=ConnectUIBroker(authenticate=lambda *_:APP,runner=runner);self.addCleanup(broker.close)
        values=[json.dumps({'operation':'status','values':{}})]
        request=Invocation();broker.dispatch(None,':1.2',values,request,GLib)
        self.assertTrue(request.ready.wait(2));self.assertIsNone(request.error)
        self.assertEqual(json.loads(request.value[0])['code'],0);self.assertEqual(ran,[['status','--json']])
        for auth in (lambda *_:'org.projectSuno.Notes',lambda *_:(_ for _ in ()).throw(PermissionError('token path'))):
            broker.authenticate=auth;request=Invocation();broker.dispatch(None,':1.2',values,request,GLib)
            self.assertEqual(request.error[1],'Connect access is unavailable.')
        self.assertEqual(len(ran),1)
        broker.authenticate=lambda *_:APP
        broker.slots.acquire();broker.slots.acquire()
        try:
            request=Invocation();broker.dispatch(None,':1.2',values,request,GLib);self.assertIsNotNone(request.error)
        finally:broker.slots.release();broker.slots.release()
        self.assertEqual(len(ran),1)

    def test_status_does_not_wait_for_an_active_sync(self):
        started=threading.Event();release=threading.Event()
        def runner(args,timeout,body,cancelled):
            if args == ['push']:
                started.set();release.wait(2)
            return 0,'{}',''
        broker=ConnectUIBroker(authenticate=lambda *_:APP,runner=runner)
        self.addCleanup(broker.close);self.addCleanup(release.set)
        sync=Invocation();broker.dispatch(None,':1.2',[json.dumps({'operation':'sync','values':{}})],sync,GLib)
        self.assertTrue(started.wait(1))
        status=Invocation();broker.dispatch(None,':1.2',[json.dumps({'operation':'status','values':{}})],status,GLib)
        self.assertTrue(status.ready.wait(1),'status blocked behind sync')
        self.assertIsNone(status.error);self.assertFalse(sync.ready.is_set())
        release.set();self.assertTrue(sync.ready.wait(1))

    def test_native_real_pid_absence_and_foreign_uid_inspection_failure_closed(self):
        require_connect_if_sandbox(NativeSender(),':native','GetState')
        class Foreign(NativeSender):
            uid=os.getuid()+1
        with self.assertRaises(PermissionError):require_connect_if_sandbox(Foreign(),':foreign','GetState')
        with patch('pathlib.Path.open',side_effect=PermissionError('inspection refused')):
            with self.assertRaises(PermissionError):require_connect_if_sandbox(NativeSender(),':native','GetState')
        with patch('pathlib.Path.open',side_effect=OSError('proc unavailable')):
            with self.assertRaises(OSError):require_connect_if_sandbox(NativeSender(),':native','GetState')


class NativeMeansThisSession(unittest.TestCase):
    """A caller without a sandbox file is native only in this session's filesystem."""

    def test_a_process_in_another_mount_namespace_is_refused(self):
        import shutil, subprocess, time
        if not shutil.which('unshare') or subprocess.run(['unshare', '-Urm', 'true'], capture_output=True).returncode:
            self.skipTest('no unprivileged mount namespaces here')
        child = subprocess.Popen(['unshare', '-Urm', 'sleep', '30'])
        self.addCleanup(child.kill)
        time.sleep(0.3)
        class Foreign(NativeSender):
            def pid(self):
                return child.pid
        with self.assertRaises(PermissionError):
            require_connect_if_sandbox(Foreign(), ':foreign', 'GetState')

    def test_a_named_but_undelivered_process_descriptor_is_refused(self):
        class Broken:
            def get_length(self): return 1
            def get(self, _index): raise RuntimeError('invalid descriptor')
        for fds in (None, Broken()):
            sender = NativeSender(); sender.extra = {'ProcessFD': 0}; sender.fds = fds
            with self.subTest(fds=fds), self.assertRaises(PermissionError):
                require_connect_if_sandbox(sender, ':native', 'GetState')

    def test_without_a_process_descriptor_the_pid_is_held_by_its_start_time(self):
        starts = iter(['100', '200'])
        with patch('Suno_installer.app_data_broker._start', side_effect=lambda pid: next(starts)), \
                self.assertRaises(PermissionError):
            require_connect_if_sandbox(NativeSender(), ':native', 'GetState')

    def test_a_delivered_process_descriptor_holds_the_pid(self):
        fd = os.pidfd_open(os.getpid())
        class Fds:
            def get_length(self): return 1
            def get(self, _index): return os.dup(fd)
        sender = NativeSender(); sender.extra = {'ProcessFD': 0}; sender.fds = Fds()
        try:
            self.assertFalse(require_connect_if_sandbox(sender, ':native', 'GetState')[1])
        finally:
            os.close(fd)

    def test_this_session_is_native_and_named_by_its_scope(self):
        app, sandboxed = require_connect_if_sandbox(NativeSender(), ':native', 'GetState')
        self.assertFalse(sandboxed)


class ReplyGoesToConnectOnly(unittest.TestCase):
    def test_the_phone_notification_is_unicast_to_connect(self):
        from unittest.mock import Mock
        from gi.repository import GLib as RealGLib
        from Suno_continuity.daemon import Daemon
        daemon = Daemon.__new__(Daemon)
        daemon.GLib = RealGLib
        daemon.connection = Mock()
        daemon._connect_listeners = set()
        daemon._remember_connect(':1.40')
        daemon._emit_reply({'title': 'Mum', 'text': 'call me'})
        destinations = [call.args[0] for call in daemon.connection.emit_signal.call_args_list]
        self.assertEqual(destinations, [':1.40'])
        self.assertNotIn(None, destinations)


class LauncherSandboxesAreNotNative(unittest.TestCase):
    def test_app_Suno_scopes_and_host_dbus_proxies(self):
        import tempfile
        from Suno_continuity import connect_ui_broker
        for leaf, exe, expected in (('app-Suno-tool-42.scope', '/usr/bin/tool', True),
                                    ('app-gnome-x-1.scope', '/usr/bin/xdg-dbus-proxy', True),
                                    ('app-gnome-x-1.scope', '/usr/bin/python3', False)):
            with tempfile.TemporaryDirectory() as tmp:
                base = Path(tmp) / '9'
                base.mkdir()
                (base / 'cgroup').write_text(f'0::/user.slice/user@1000.service/app.slice/{leaf}\n')
                os.symlink(exe, base / 'exe')
                self.assertIs(connect_ui_broker._launcher_sandbox(9, Path(tmp)), expected, (leaf, exe))

if __name__=='__main__':unittest.main()
