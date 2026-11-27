#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""ModTransactions1 answers only Mods, opens no prompt while closed, and
ModProfiles1 takes no operation slot before the caller is shown to be Mods."""
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'src/Suno-mods'))
from gi.repository import GLib  # noqa: E402
from Suno_mods import system_service  # noqa: E402
from Suno_mods.errors import TransactionError  # noqa: E402

INFO = '[Application]\nname={}\n[Instance]\ninstance-id=1\napp-commit={}\napp-path=/var/lib/flatpak/app/x/files\n'


class Proc:
    def __init__(self):
        self.root = Path(tempfile.mkdtemp(prefix='mods-proc-'))
        self.pid = 4321
        (self.root / '1/ns').mkdir(parents=True)
        os.symlink('/', self.root / '1/root')
        os.symlink('mnt:[4026531841]', self.root / '1/ns/mnt')
        self.base = self.root / str(self.pid)
        (self.base / 'ns').mkdir(parents=True)

    def host(self, exe='/usr/bin/python3', script='/usr/bin/Suno-mods'):
        os.symlink('/', self.base / 'root')
        os.symlink('mnt:[4026531841]', self.base / 'ns/mnt')
        os.symlink(exe, self.base / 'exe')
        (self.base / 'cmdline').write_bytes(b'/usr/bin/python3\0' + script.encode() + b'\0')

    def sandbox(self, name='org.projectSuno.Mods'):
        (self.base / 'root').mkdir()
        (self.base / 'root/.flatpak-info').write_text(INFO.format(name, 'a' * 64))
        os.symlink('mnt:[1]', self.base / 'ns/mnt')

    def admit(self, uid=1000, **kwargs):
        return system_service.admit_process(self.pid, uid, proc=self.root, **kwargs)


class Admission(unittest.TestCase):
    def setUp(self):
        self.proc = Proc()
        self.addCleanup(shutil.rmtree, self.proc.root, True)

    def test_the_signed_mods_app_is_admitted(self):
        self.proc.sandbox()
        self.assertEqual(self.proc.admit(deployment=lambda *_: None, child_of=lambda *a, **k: 99),
                         'org.projectSuno.Mods')

    def test_another_app_or_an_unsigned_mods_is_refused(self):
        self.proc.sandbox('org.example.Other')
        with self.assertRaises(TransactionError):
            self.proc.admit(deployment=lambda *_: None, child_of=lambda *a, **k: 99)
        (self.proc.base / 'root/.flatpak-info').write_text(INFO.format('org.projectSuno.Mods', 'a' * 64))
        for deployment, child_of in ((mock.Mock(side_effect=ValueError('unsigned')), lambda *a, **k: 99),
                                     (lambda *_: None, mock.Mock(side_effect=ValueError('not the proxy')))):
            with self.assertRaises(TransactionError):
                self.proc.admit(deployment=deployment, child_of=child_of)

    def test_an_unreadable_or_malformed_sandbox_is_refused(self):
        self.proc.sandbox()
        info = self.proc.base / 'root/.flatpak-info'
        info.write_text('not a key file')
        with self.assertRaises(TransactionError):
            self.proc.admit(deployment=lambda *_: None, child_of=lambda *a, **k: 99)
        info.write_text(INFO.format('org.projectSuno.Mods', 'a' * 64))
        info.chmod(0)
        if not os.access(info, os.R_OK):
            with self.assertRaises(TransactionError):
                self.proc.admit(deployment=lambda *_: None, child_of=lambda *a, **k: 99)

    def test_the_host_gallery_and_root_are_admitted_and_nothing_else(self):
        self.proc.host()
        with mock.patch.object(system_service, '_root_owned', return_value=True):
            self.assertEqual(self.proc.admit(), 'Suno-mods')
            self.assertEqual(self.proc.admit(uid=0), 'root')
        other = Proc(); self.addCleanup(shutil.rmtree, other.root, True)
        other.host(script='/home/a/Suno-mods')
        with mock.patch.object(system_service, '_root_owned', side_effect=lambda path: path.startswith('/usr/')), \
                self.assertRaises(TransactionError):
            other.admit()

    def test_a_process_in_another_filesystem_is_refused(self):
        (self.proc.base / 'root').mkdir()
        os.symlink('mnt:[1]', self.proc.base / 'ns/mnt')
        with self.assertRaises(TransactionError):
            self.proc.admit(uid=0)


class Order(unittest.TestCase):
    def service(self, admitted=True, ready=False):
        service = system_service.ModTransactionService.__new__(system_service.ModTransactionService)
        service._authority = mock.Mock()
        service._coordinator = mock.Mock()
        service._state = mock.Mock(); service._state.read.return_value = {}
        service._admit = mock.Mock(side_effect=None if admitted else TransactionError('not Mods'))
        self.addCleanup(mock.patch.stopall)
        mock.patch.object(system_service, '_recovery_ready', return_value=ready).start()
        return service

    def call(self, service, method, parameters):
        invocation = mock.Mock()
        service._method_call(None, ':1.9', '', '', method, parameters, invocation)
        return invocation

    def test_an_outsider_gets_nothing_and_no_prompt(self):
        service = self.service(admitted=False, ready=True)
        for method, parameters in (('GetStatus', None),
                                   ('StageCatalog', GLib.Variant('(sssb)', ('m', 's', 'c', True))),
                                   ('Activate', GLib.Variant('(sb)', ('x', True))),
                                   ('Rollback', GLib.Variant('(sb)', ('x', True)))):
            invocation = self.call(service, method, parameters)
            invocation.return_dbus_error.assert_called_once()
            invocation.return_value.assert_not_called()
        service._authority.check.assert_not_called()

    def test_a_closed_service_raises_no_prompt_rollback_included(self):
        service = self.service(admitted=True, ready=False)
        for method, parameters in (('StageCatalog', GLib.Variant('(sssb)', ('m', 's', 'c', True))),
                                   ('Activate', GLib.Variant('(sb)', ('x', True))),
                                   ('Rollback', GLib.Variant('(sb)', ('x', True)))):
            self.call(service, method, parameters).return_dbus_error.assert_called_once()
        service._authority.check.assert_not_called()
        service._coordinator.rollback.assert_not_called()

    def test_an_open_service_asks_polkit_for_mods(self):
        service = self.service(admitted=True, ready=True)
        self.call(service, 'Rollback', GLib.Variant('(sb)', ('x', True))).return_value.assert_called_once()
        self.assertEqual(service._authority.check.call_args.args[1], 'org.projectSuno.mods.rollback-system')
        service._coordinator.rollback.assert_called_once_with('x')


class ProcessHandle(unittest.TestCase):
    class Fds:
        def __init__(self, descriptors, broken=False):
            self.descriptors, self.broken = descriptors, broken

        def get_length(self):
            return len(self.descriptors)

        def get(self, index):
            if self.broken:
                raise GLib.Error('invalid descriptor')
            return self.descriptors[index]

    def service(self, values, fds):
        service = system_service.ModTransactionService.__new__(system_service.ModTransactionService)
        service._connection = mock.Mock()
        service._connection.call_with_unix_fd_list_sync.return_value = (GLib.Variant('(a{sv})', ({
            'UnixUserID': GLib.Variant('u', 0), 'ProcessID': GLib.Variant('u', 4321), **values},)), fds)
        return service

    def test_a_named_but_undelivered_descriptor_is_refused_before_admission(self):
        with mock.patch.object(system_service, 'admit_process') as admit:
            for fds in (None, self.Fds([]), self.Fds([5], broken=True)):
                with self.subTest(fds=fds), self.assertRaises(TransactionError):
                    self.service({'ProcessFD': GLib.Variant('h', 0)}, fds)._admit(':1.9')
            admit.assert_not_called()

    def test_without_a_descriptor_the_pid_is_held_by_its_start_time(self):
        with mock.patch.object(system_service, 'admit_process', return_value='root'):
            with mock.patch.object(system_service, 'process_start', return_value='7'):
                self.assertEqual(self.service({}, None)._admit(':1.9'), 'root')
            starts = iter(['7', '8'])
            with mock.patch.object(system_service, 'process_start', side_effect=lambda pid: next(starts)), \
                    self.assertRaises(TransactionError):
                self.service({}, None)._admit(':1.9')
            with mock.patch.object(system_service, 'process_start', return_value=None), \
                    self.assertRaises(TransactionError):
                self.service({}, None)._admit(':1.9')


class ProfilesSlots(unittest.TestCase):
    def test_no_slot_before_authentication_and_one_check_per_sender(self):
        from Suno_mods import profile_service
        service = profile_service.Service.__new__(profile_service.Service)
        service.slots = profile_service.threading.BoundedSemaphore(2)
        service.checking, service.active = set(), 0
        service.profiles = mock.Mock()
        jobs = []
        service.pool = mock.Mock(); service.pool.submit.side_effect = jobs.append
        args = GLib.Variant('(s)', ('{"operation":"read"}',))
        first, second = mock.Mock(), mock.Mock()
        service.call(None, ':1.5', '', '', 'Call', args, first)
        service.call(None, ':1.5', '', '', 'Call', args, second)
        second.return_dbus_error.assert_called_once()
        self.assertIn('Busy', second.return_dbus_error.call_args.args[0])
        replies = []
        with mock.patch('Suno_installer.app_data_broker.authenticate', return_value='org.example.Evil', create=True), \
                mock.patch.object(profile_service.GLib, 'idle_add', side_effect=lambda f, *a: replies.append(f(*a))):
            sys.modules.setdefault('Suno_installer', mock.Mock())
            sys.modules.setdefault('Suno_installer.app_data_broker', mock.Mock(authenticate=lambda *_: 'org.example.Evil'))
            for slot_holder in range(2):
                self.assertTrue(service.slots.acquire(blocking=False))
            for _ in range(2):
                service.slots.release()
            acquire = mock.Mock(wraps=service.slots.acquire)
            service.slots.acquire = acquire
            jobs[0]()
        acquire.assert_not_called()
        first.return_dbus_error.assert_called_once()
        self.assertIn('Refused', first.return_dbus_error.call_args.args[0])
        service.profiles.dispatch.assert_not_called()
        self.assertEqual(service.checking, set())


@unittest.skipUnless(shutil.which('bwrap') and sys.platform.startswith('linux'), 'needs bubblewrap')
class ProxyAndSandbox(unittest.TestCase):
    """A real proxy and sandbox pair: two bwrap processes with the same
    .flatpak-info, the proxy without /app and holding the write end of the
    instance's lifecycle pipe, the sandbox with /app and the read end."""

    def setUp(self):
        import json, subprocess
        self.tmp = Path(tempfile.mkdtemp(prefix='mods-pair-', dir='/tmp'))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.text = INFO.format('org.projectSuno.Mods', 'a' * 64)
        (self.tmp / 'info').write_text(self.text)
        (self.tmp / 'app').mkdir()
        root = ['--ro-bind', '/usr', '/usr', '--symlink', 'usr/lib64', '/lib64', '--symlink', 'usr/lib', '/lib',
                '--symlink', 'usr/bin', '/bin', '--proc', '/proc', '--dev', '/dev',
                '--ro-bind', str(self.tmp / 'info'), '/.flatpak-info']
        read_end, write_end = os.pipe()
        self.sandbox = subprocess.Popen(['bwrap', *root, '--ro-bind', str(self.tmp / 'app'), '/app', 'sleep', '30'],
                                        pass_fds=(read_end,))
        self.proxy = subprocess.Popen(['bwrap', *root, 'sleep', '30'], pass_fds=(write_end,))
        os.close(read_end); os.close(write_end)
        self.addCleanup(self.sandbox.kill); self.addCleanup(self.proxy.kill)
        import time
        time.sleep(0.5)
        self.child = self.innermost(self.sandbox.pid)
        self.proxy_pid = self.innermost(self.proxy.pid)
        record = self.tmp / 'run' / str(os.getuid()) / '.flatpak' / '1'
        record.mkdir(parents=True)
        (record / 'info').write_text(self.text)
        (record / 'bwrapinfo.json').write_text(json.dumps({'child-pid': self.child}))

    @staticmethod
    def innermost(pid):
        # bwrap forks the sandboxed command; the pipe end travels with it.
        while True:
            children = Path(f'/proc/{pid}/task/{pid}/children').read_text().split()
            if not children:
                return pid
            pid = int(children[0])

    def admit(self, **kwargs):
        import configparser
        info = configparser.ConfigParser(interpolation=None)
        info.read_string(self.text)
        return system_service.sandbox_child(info, self.text, self.proxy_pid, os.getuid(),
                                            runtime=self.tmp / 'run', trusted_proxy=lambda _pid: None, **kwargs)

    def test_the_deployment_is_checked_on_the_sandbox_not_the_proxy(self):
        child = self.admit()
        self.assertEqual(child, self.child)
        self.assertTrue(Path(f'/proc/{child}/root/app').is_dir())
        self.assertFalse(Path(f'/proc/{self.proxy_pid}/root/app').exists())

    def test_a_proxy_that_is_not_the_instances_is_refused(self):
        import json
        record = self.tmp / 'run' / str(os.getuid()) / '.flatpak' / '1'
        (record / 'bwrapinfo.json').write_text(json.dumps({'child-pid': self.proxy_pid}))
        with self.assertRaises(Exception):
            self.admit()

    def test_the_real_deployment_check_refuses_an_unsigned_mods(self):
        # Nothing named org.projectSuno.Mods is installed from the signed Suno
        # remote here: the unmocked check fails closed.
        import configparser
        from Suno_installer.app_data_broker import authenticate_deployment
        info = configparser.ConfigParser(interpolation=None)
        info.read_string(self.text)
        with self.assertRaises(Exception):
            authenticate_deployment(info, 'org.projectSuno.Mods', self.admit())


@unittest.skipUnless(sys.platform.startswith('linux'), 'needs openat2')
class UserFilesReadByRoot(unittest.TestCase):
    def setUp(self):
        self.run_dir = Path(tempfile.mkdtemp(prefix='mods-run-'))
        self.addCleanup(shutil.rmtree, self.run_dir, True)
        self.record = self.run_dir / str(os.getuid()) / '.flatpak' / '1'
        self.record.mkdir(parents=True)

    def read(self, name='info'):
        return system_service.read_user_file(self.run_dir, os.getuid(), f'.flatpak/1/{name}')

    def test_a_regular_file_is_read(self):
        (self.record / 'info').write_text('[Application]\nname=x\n')
        self.assertEqual(self.read(), b'[Application]\nname=x\n')

    def test_a_fifo_never_blocks_the_service(self):
        os.mkfifo(self.record / 'info')
        import time
        started = time.monotonic()
        with self.assertRaises((TransactionError, OSError)):
            self.read()
        self.assertLess(time.monotonic() - started, 2)

    def test_symlinks_are_never_followed(self):
        elsewhere = self.run_dir / 'elsewhere'
        elsewhere.mkdir()
        (elsewhere / 'info').write_text('[Application]\nname=org.projectSuno.Mods\n')
        (self.record / 'link').symlink_to(elsewhere / 'info')
        with self.assertRaises(OSError):
            self.read('link')
        # A symlinked instance directory.
        shutil.rmtree(self.record)
        self.record.symlink_to(elsewhere)
        with self.assertRaises(OSError):
            self.read()

    def test_a_runtime_folder_of_another_user_is_refused(self):
        (self.record / 'info').write_text('x')
        with self.assertRaises((TransactionError, OSError)):
            system_service.read_user_file(self.run_dir, os.getuid() + 1, '.flatpak/1/info')


if __name__ == '__main__':
    unittest.main()
