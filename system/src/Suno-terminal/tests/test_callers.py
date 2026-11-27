# SPDX-License-Identifier: Apache-2.0
"""Terminal's callers: Open over D-Bus opens folders only; RunProgram runs a
program for the host and the signed Filer, never another app; a downloaded
program waits for Return."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gi.repository import Gio, GLib  # noqa: E402
from Suno_terminal import callers  # noqa: E402

HOST = {'cgroup': '0::/user.slice/user@1000.service/app.slice/app-gnome-org.gnome.Console-9.scope\n',
        'label': 'unconfined_u:unconfined_r:unconfined_t:s0', 'flatpak_info': '', 'same_host': True}


def flatpak(app):
    return {**HOST, 'flatpak_info': f'[Application]\nname={app}\n', 'same_host': False,
            'cgroup': f'0::/user.slice/user@1000.service/app.slice/app-flatpak-{app}-1.scope\n'}


class Classify(unittest.TestCase):
    def test_the_host_may_run_programs(self):
        self.assertTrue(callers.classify(':1.4', 9, HOST, None).may_run)

    def test_an_app_opens_folders_only(self):
        for found in (flatpak('org.example.Evil'), {**HOST, 'same_host': False},
                      {**HOST, 'flatpak_info': None}, {**HOST, 'flatpak_info': 'garbage'},
                      {**HOST, 'cgroup': '0::/app.slice/app-Suno-x-1.scope'},
                      {**HOST, 'label': 'u:r:Suno_application.process:s0:c1,c2'}):
            with self.subTest(found=found):
                caller = callers.classify(':1.4', 9, found, lambda _sender: 'org.gnome.Nautilus')
                self.assertTrue(caller.sandboxed)
                self.assertFalse(caller.may_run)

    def test_the_signed_filer_runs_programs_and_a_look_alike_does_not(self):
        self.assertTrue(callers.classify(':1.4', 9, flatpak('org.gnome.Nautilus'),
                                         lambda _sender: 'org.gnome.Nautilus').may_run)
        for authenticate in (lambda _sender: 'org.projectSuno.Notes',
                             mock.Mock(side_effect=PermissionError('unsigned'))):
            self.assertFalse(callers.classify(':1.4', 9, flatpak('org.gnome.Nautilus'), authenticate).may_run)


class OfficialOrigin(unittest.TestCase):
    """Files is the signed Filer only as the installer's authenticate() decides it:
    the system installation's Suno remote, its pinned key, a signed deployed commit.
    Driven through callers.py's own wrapper (_authenticate) into the installer."""

    def setUp(self):
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'Suno-installer'))
        try:
            from Suno_installer import app_data_broker, native_app_roles  # noqa: F401
        except ImportError as error:
            self.skipTest(f'the installer is not importable here: {error}')
        self.broker, self.roles = app_data_broker, native_app_roles

    def classify(self, authenticate):
        with mock.patch.object(self.broker, 'authenticate', authenticate):
            return callers.classify(':1.4', 9, flatpak('org.gnome.Nautilus'),
                                    lambda sender: callers._authenticate(None, sender))

    def test_the_official_signed_filer_may_run_programs(self):
        caller = self.classify(lambda _connection, _sender: 'org.gnome.Nautilus')
        self.assertEqual((caller.app_id, caller.may_run), ('org.gnome.Nautilus', True))

    def test_the_same_id_from_another_origin_may_not(self):
        for problem in (self.roles.RoleProblem('other-source', 'org.gnome.Nautilus comes from other'),
                        self.roles.RoleProblem('unsigned', 'no maintained Suno signature'),
                        self.roles.RoleProblem('source-invalid', 'the Suno remote fails its checks')):
            with self.subTest(code=problem.code):
                caller = self.classify(mock.Mock(side_effect=problem))
                self.assertTrue(caller.sandboxed)
                self.assertFalse(caller.may_run)


class Downloads(unittest.TestCase):
    def test_a_downloaded_program_waits_for_return(self):
        with tempfile.TemporaryDirectory() as tmp:
            downloads = Path(tmp) / 'Downloads'; downloads.mkdir()
            inside, outside = downloads / 'tool', Path(tmp) / 'tool'
            for path in (inside, outside):
                path.write_text('#!/bin/sh\n'); path.chmod(0o755)
            self.assertTrue(callers.came_from_internet(str(inside), str(downloads)))
            self.assertFalse(callers.came_from_internet(str(outside), str(downloads)))
            try:
                os.setxattr(outside, 'user.xdg.origin.url', b'https://example.com/tool')
            except OSError:
                return
            self.assertTrue(callers.came_from_internet(str(outside), str(downloads)))


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

    def connection(self, values, fds):
        connection = mock.Mock()
        connection.call_with_unix_fd_list_sync.return_value = (
            GLib.Variant('(a{sv})', ({'UnixUserID': GLib.Variant('u', os.getuid()),
                                      'ProcessID': GLib.Variant('u', os.getpid()), **values},)), fds)
        return connection

    def test_a_named_but_undelivered_descriptor_makes_the_caller_a_sandbox(self):
        for fds in (None, self.Fds([]), self.Fds([5], broken=True)):
            with self.subTest(fds=fds):
                caller = callers.resolve(self.connection({'ProcessFD': GLib.Variant('h', 0)}, fds), ':1.4')
                self.assertTrue(caller.sandboxed)
                self.assertFalse(caller.may_run)

    @unittest.skipUnless(sys.platform.startswith('linux'), 'needs /proc')
    def test_without_a_descriptor_the_pid_is_held_by_its_start_time(self):
        with mock.patch.object(callers, 'classify', return_value=callers.Caller(':1.4', os.getpid(), False, '', True)):
            self.assertFalse(callers.resolve(self.connection({}, None), ':1.4').sandboxed)
            starts = iter(['1', '2'])
            with mock.patch.object(callers, 'process_start', side_effect=lambda pid: next(starts)):
                self.assertTrue(callers.resolve(self.connection({}, None), ':1.4').sandboxed)


class Timers:
    """GLib.timeout_add and source_remove, driven by hand."""

    def __init__(self):
        self.now, self.next, self.sources = 0, 1, {}

    def add(self, ms, callback):
        source, self.next = self.next, self.next + 1
        self.sources[source] = (self.now + ms, callback)
        return source

    def remove(self, source):
        self.sources.pop(source, None)

    def advance(self, ms):
        self.now += ms
        for source, (due, callback) in sorted(self.sources.items(), key=lambda item: item[1][0]):
            if source in self.sources and due <= self.now:
                del self.sources[source]
                callback()


class WaitsForThePrompt(unittest.TestCase):
    def gate(self):
        timers, delivered = Timers(), []
        gate = callers.PromptGate(delivered.append, idle_ms=150, timeout_ms=5000,
                                  timeout_add=timers.add, source_remove=timers.remove)
        return gate, timers, delivered

    def test_nothing_is_typed_before_the_shell_has_drawn_its_prompt(self):
        gate, timers, delivered = self.gate()
        timers.advance(1000)
        self.assertEqual(delivered, [])

    def test_it_is_typed_once_the_prompt_has_settled(self):
        gate, timers, delivered = self.gate()
        gate.output(); timers.advance(100)
        gate.prompt(); timers.advance(100)  # still drawing: the quiet starts again
        self.assertEqual(delivered, [])
        timers.advance(60)
        self.assertEqual(delivered, [True])
        gate.output(); timers.advance(6000)
        self.assertEqual(delivered, [True], 'once only')

    def test_a_shell_that_never_settles_gets_plain_typing(self):
        gate, timers, delivered = self.gate()
        timers.advance(5000)
        self.assertEqual(delivered, [False])
        gate, timers, delivered = self.gate()
        for _ in range(60):
            gate.output(); timers.advance(100)  # output that never stops
        self.assertEqual(delivered, [False])

    def test_a_cancelled_gate_types_nothing(self):
        gate, timers, delivered = self.gate()
        gate.output(); gate.cancel(); timers.advance(6000)
        self.assertEqual(delivered, [])

    def test_plain_typing_has_no_paste_markers_and_no_return_when_confirming(self):
        plain = callers.typed_command("/home/a/Downloads/run me", confirm=True, bracketed=False)
        self.assertEqual(plain, b"'/home/a/Downloads/run me'")
        self.assertNotIn(b'\x1b', plain)
        self.assertNotIn(b'\n', plain)
        self.assertEqual(callers.typed_command('/usr/bin/true', confirm=False, bracketed=False), b'/usr/bin/true\n')


SERVICE = textwrap.dedent('''
    import json, sys
    sys.path.insert(0, sys.argv[1])
    from gi.repository import Gio, GLib
    from Suno_terminal import callers
    from Suno_terminal.callers import RUN_XML
    def handle(connection, sender, path, interface, method, parameters, invocation):
        caller = callers.resolve(connection, sender)
        print(json.dumps({'sandboxed': caller.sandboxed, 'app': caller.app_id, 'may_run': caller.may_run}), flush=True)
        invocation.return_value(None)
    def acquired(connection, name):
        pass
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    bus.register_object('/org/projectSuno/Terminal', Gio.DBusNodeInfo.new_for_xml(RUN_XML).interfaces[0], handle, None, None)
    Gio.bus_own_name_on_connection(bus, 'org.projectSuno.Terminal', 0, None, None)
    loop = GLib.MainLoop(); GLib.timeout_add_seconds(30, loop.quit); loop.run()
''')

CLIENT = textwrap.dedent('''
    from gi.repository import Gio, GLib
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    bus.call_sync('org.projectSuno.Terminal', '/org/projectSuno/Terminal', 'org.projectSuno.Terminal1', 'RunProgram',
                  GLib.Variant('(sa{sv})', ('file:///usr/bin/true', {})), None, Gio.DBusCallFlags.NONE, 5000, None)
''')

DRIVER = textwrap.dedent('''
    set -eu
    python3 "$WORK/service.py" "$SOURCE" > "$WORK/out" &
    for _ in $(seq 1 50); do gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \\
      --method org.freedesktop.DBus.NameHasOwner org.projectSuno.Terminal | grep -q true && break; sleep 0.1; done
    python3 "$WORK/client.py"
    if [ -n "${SANDBOX:-}" ]; then
      info=$(mktemp); printf '[Application]\\nname=org.example.Evil\\n' > "$info"
      root=(--ro-bind /usr /usr --ro-bind /etc /etc --symlink usr/lib /lib --symlink usr/lib64 /lib64
            --symlink usr/bin /bin --proc /proc --dev /dev --bind /tmp /tmp --ro-bind "$info" /.flatpak-info)
      bwrap "${root[@]}" xdg-dbus-proxy "$DBUS_SESSION_BUS_ADDRESS" "$WORK/proxy" --filter \\
        --talk=org.projectSuno.Terminal >/dev/null 2>&1 &
      for _ in $(seq 1 50); do [ -S "$WORK/proxy" ] && break; sleep 0.1; done
      bwrap "${root[@]}" --setenv DBUS_SESSION_BUS_ADDRESS "unix:path=$WORK/proxy" python3 "$WORK/client.py"
    fi
    sleep 0.5
    kill $(jobs -p) 2>/dev/null || true
''')


@unittest.skipUnless(sys.platform.startswith('linux') and shutil.which('dbus-run-session'), 'needs a session bus')
class OverTheBus(unittest.TestCase):
    def test_run_program_names_its_real_caller(self):
        work = Path(tempfile.mkdtemp(prefix='terminal-callers-', dir='/tmp'))
        self.addCleanup(shutil.rmtree, work, True)
        (work / 'service.py').write_text(SERVICE); (work / 'client.py').write_text(CLIENT)
        sandbox = bool(shutil.which('bwrap') and shutil.which('xdg-dbus-proxy')) and subprocess.run(
            ['bwrap', '--ro-bind', '/', '/', 'true'], capture_output=True).returncode == 0
        env = {**os.environ, 'WORK': str(work), 'SOURCE': str(Path(__file__).resolve().parents[1]),
               'SANDBOX': '1' if sandbox else ''}
        env.pop('DBUS_SESSION_BUS_ADDRESS', None)
        result = subprocess.run(['dbus-run-session', '--', 'bash', '-c', DRIVER], env=env,
                                capture_output=True, text=True, timeout=90)
        self.assertEqual(result.returncode, 0, result.stderr)
        seen = [json.loads(line) for line in (work / 'out').read_text().splitlines() if line.startswith('{')]
        self.assertEqual(seen[0], {'sandboxed': False, 'app': '', 'may_run': True})
        if sandbox:
            self.assertEqual(seen[1], {'sandboxed': True, 'app': 'org.example.Evil', 'may_run': False})


class TypedAtThePrompt(unittest.TestCase):
    def test_control_characters_are_refused(self):
        for name in ('a\x15b', 'a\x0fb', 'a\x1b[201~; rm -rf ~', 'a\nb', 'a\x7fb', 'a\rb'):
            with self.subTest(name=repr(name)):
                self.assertFalse(callers.plain_path('/home/a/Downloads/' + name))
                with self.assertRaises(ValueError):
                    callers.typed_command('/home/a/Downloads/' + name, confirm=True)

    def test_a_program_is_pasted_literally(self):
        typed = callers.typed_command("/home/a/Downloads/run me 'now'", confirm=True)
        self.assertEqual(typed, b"\x1b[200~'/home/a/Downloads/run me '\"'\"'now'\"'\"''\x1b[201~")
        self.assertTrue(callers.typed_command('/usr/bin/true', confirm=False).endswith(b'\x1b[201~\n'))


@unittest.skipUnless(shutil.which('git'), 'needs git')
class GitInAnAppsFolder(unittest.TestCase):
    def test_a_planted_fsmonitor_or_hook_does_not_run_in_an_app_opened_session(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, marker = Path(tmp) / 'repo', Path(tmp) / 'ran'
            subprocess.run(['git', 'init', '-q', str(folder)], check=True)
            hook = Path(tmp) / 'evil'
            hook.write_text(f'#!/bin/sh\ntouch {marker}\n'); hook.chmod(0o755)
            subprocess.run(['git', '-C', str(folder), 'config', 'core.fsmonitor', str(hook)], check=True)
            base = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
            base['HOME'] = tmp
            guarded = dict(item.split('=', 1) for item in callers.guarded_environment(base))
            subprocess.run(['git', 'status'], cwd=folder, env=guarded, capture_output=True)
            self.assertFalse(marker.exists(), 'core.fsmonitor ran in a guarded session')
            subprocess.run(['git', 'status'], cwd=folder, env=base, capture_output=True)
            self.assertTrue(marker.exists(), 'the planted fsmonitor is live without the guard')

    def test_the_notice_names_the_app_and_folder_printably(self):
        self.assertEqual(callers.opened_notice('Evil\x1b]0;x', '/tmp/a\nb'),
                         b'\x1b[2mOpened by Evil?]0;x in /tmp/a?b\x1b[0m\r\n')


if __name__ == '__main__':
    unittest.main()
