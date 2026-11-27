# SPDX-License-Identifier: Apache-2.0
"""Agent values reach only their readers: the person's programs and the app's
own sandbox see all, a bound signed app the shared values, any other app
nothing, and changes are unicast."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'appkit'))
from Suno_appkit import agent_readers  # noqa: E402

APP, BOUND = 'org.example.Chat', 'org.example.Phone'


class Classify(unittest.TestCase):
    def setUp(self):
        self.proc = Path(tempfile.mkdtemp(prefix='readers-proc-'))
        self.addCleanup(shutil.rmtree, self.proc, True)
        (self.proc / 'self/ns').mkdir(parents=True)
        os.symlink('/', self.proc / 'self/root')
        os.symlink(os.readlink('/proc/self/ns/mnt'), self.proc / 'self/ns/mnt')
        self.base = self.proc / '77'
        (self.base / 'ns').mkdir(parents=True)

    def sandbox(self, name):
        (self.base / 'root').mkdir()
        (self.base / 'root/.flatpak-info').write_text(f'[Application]\nname={name}\n')
        os.symlink('mnt:[1]', self.base / 'ns/mnt')

    def classify(self, **kwargs):
        return agent_readers.classify(APP, frozenset({BOUND}), pid=77, proc=self.proc, **kwargs)

    def test_the_persons_programs_read_everything(self):
        (self.base / 'cgroup').write_text('0::/user.slice/user@1000.service/app.slice/app-gnome-x-1.scope\n')
        os.symlink('/', self.base / 'root')
        os.symlink(os.readlink('/proc/self/ns/mnt'), self.base / 'ns/mnt')
        self.assertEqual(self.classify(), agent_readers.ALL)

    def test_the_apps_own_sandbox_reads_everything(self):
        self.sandbox(APP)
        self.assertEqual(self.classify(), agent_readers.ALL)

    def test_a_bound_app_reads_shared_values_once_signed(self):
        self.sandbox(BOUND)
        self.assertEqual(self.classify(authenticate=lambda: BOUND), agent_readers.SHARED)
        self.assertIsNone(self.classify(authenticate=lambda: 'org.example.Other'))
        def unsigned(): raise PermissionError('unsigned')
        self.assertIsNone(self.classify(authenticate=unsigned))

    def test_any_other_app_reads_nothing(self):
        self.sandbox('org.example.Evil')
        self.assertIsNone(self.classify(authenticate=lambda: 'org.example.Evil'))

    def test_another_filesystem_without_a_sandbox_file_reads_nothing(self):
        (self.base / 'root').mkdir()
        os.symlink('mnt:[1]', self.base / 'ns/mnt')
        self.assertIsNone(self.classify())

    def test_an_unreadable_caller_in_the_shells_unit_reads_nothing(self):
        # Non-dumpable in org.gnome.Shell@x, holding org.gnome.Shell: what any
        # host program can arrange. Neither its root nor a sandbox file can be read.
        (self.base / 'cgroup').write_text('0::/user.slice/user@1000.service/session.slice/org.gnome.Shell@x.service\n')
        (self.base / 'root').mkdir()
        (self.base / 'root').chmod(0)
        self.addCleanup((self.base / 'root').chmod, 0o755)
        from unittest import mock
        with mock.patch.object(agent_readers, 'sandbox_name', return_value=None):
            self.assertIsNone(self.classify())


class LauncherSandboxes(Classify):
    """Suno's launcher sandboxes are never the host, whatever their filesystem."""

    def host_like(self):
        os.symlink('/', self.base / 'root')
        os.symlink(os.readlink('/proc/self/ns/mnt'), self.base / 'ns/mnt')

    def test_an_app_Suno_scope_is_a_sandbox(self):
        self.host_like()
        (self.base / 'cgroup').write_text('0::/user.slice/user@1000.service/app.slice/app-Suno-tool-42.scope\n')
        self.assertIsNone(self.classify())

    def test_a_host_dbus_proxy_without_a_sandbox_file_is_a_sandbox(self):
        self.host_like()
        (self.base / 'cgroup').write_text('0::/user.slice/user@1000.service/app.slice/app-gnome-x-1.scope\n')
        os.symlink('/usr/bin/xdg-dbus-proxy', self.base / 'exe')
        self.assertIsNone(self.classify())

    def test_a_signed_Suno_apps_own_sandbox_must_be_its_signed_deployment(self):
        self.sandbox('org.projectSuno.Connect')
        connect = lambda **kwargs: agent_readers.classify('org.projectSuno.Connect', frozenset(), pid=77,
                                                          proc=self.proc, **kwargs)
        try:
            import Suno_installer.native_app_roles  # noqa: F401
        except ImportError:
            self.skipTest('Suno_installer is not importable here')
        self.assertEqual(connect(authenticate=lambda: 'org.projectSuno.Connect'), agent_readers.ALL)
        self.assertIsNone(connect(authenticate=lambda: 'org.example.Other'))
        def unsigned(): raise PermissionError('unsigned')
        self.assertIsNone(connect(authenticate=unsigned))


class ProcessHandle(unittest.TestCase):
    class Fds:
        def __init__(self, descriptors, broken=False):
            self.descriptors, self.broken = descriptors, broken

        def get_length(self):
            return len(self.descriptors)

        def get(self, index):
            if self.broken:
                from gi.repository import GLib
                raise GLib.Error('invalid descriptor')
            return self.descriptors[index]

    def test_no_process_descriptor_offered_falls_back_to_the_pid(self):
        self.assertEqual(agent_readers.delivered_pidfd({'ProcessID': 7}, None), -1)

    def test_a_named_but_undelivered_descriptor_is_refused(self):
        for values, fds in (({'ProcessFD': 0}, None), ({'ProcessFD': 1}, self.Fds([5])),
                            ({'ProcessFD': True}, self.Fds([5])), ({'ProcessFD': 0}, self.Fds([5], True)),
                            ({'ProcessFD': 0}, self.Fds([-1]))):
            with self.subTest(values=values), self.assertRaises(PermissionError):
                agent_readers.delivered_pidfd(values, fds)
        self.assertEqual(agent_readers.delivered_pidfd({'ProcessFD': 0}, self.Fds([5])), 5)

    def test_start_time(self):
        proc = Path(tempfile.mkdtemp(prefix='readers-stat-'))
        self.addCleanup(shutil.rmtree, proc, True)
        (proc / '9').mkdir()
        (proc / '9/stat').write_text('9 (a) b) ' + ' '.join(str(n) for n in range(3, 53)) + '\n')
        self.assertEqual(agent_readers.process_start(9, proc), '22')
        self.assertIsNone(agent_readers.process_start(10, proc))


AGENT = textwrap.dedent("""
    import json, sys
    sys.path.insert(0, sys.argv[1])
    from gi.repository import Gio, GLib
    from Suno_appkit import agent_readers
    agent_readers._authenticate = lambda connection, sender: 'org.example.Phone'
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    readers = agent_readers.Readers(bus, 'org.example.Chat', bound=('org.example.Phone',), shared=('online',))
    values = {'online': GLib.Variant('b', True), 'unread': GLib.Variant('u', 3)}
    xml = '<node><interface name="org.projectSuno.BackgroundAgent1"><property name="Values" type="a{sv}" access="read"/></interface></node>'
    def get(connection, sender, path, interface, name):
        return GLib.Variant('a{sv}', readers.values_for(readers.admit(sender), values) or {})
    bus.register_object('/org/projectSuno/BackgroundAgent1', Gio.DBusNodeInfo.new_for_xml(xml).interfaces[0], None, get, None)
    Gio.bus_own_name_on_connection(bus, 'org.example.Chat.Agent', 0, None, None)
    def change():
        values['unread'] = GLib.Variant('u', 4)
        readers.emit('/org/projectSuno/BackgroundAgent1', 'org.projectSuno.BackgroundAgent1', values)
        return False
    GLib.timeout_add(2500, change)
    loop = GLib.MainLoop(); GLib.timeout_add_seconds(8, loop.quit); loop.run()
""")

READER = textwrap.dedent("""
    import json, sys
    from gi.repository import Gio, GLib
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    heard = []
    bus.signal_subscribe(None, 'org.freedesktop.DBus.Properties', 'PropertiesChanged', '/org/projectSuno/BackgroundAgent1',
        None, 0, lambda *a: heard.append(sorted(a[5].unpack()[1]['Values'])))
    got = bus.call_sync('org.example.Chat.Agent', '/org/projectSuno/BackgroundAgent1', 'org.freedesktop.DBus.Properties',
        'Get', GLib.Variant('(ss)', ('org.projectSuno.BackgroundAgent1', 'Values')), None, 0, 3000, None).unpack()[0]
    loop = GLib.MainLoop(); GLib.timeout_add(4000, loop.quit); loop.run()
    print(json.dumps({'got': sorted(got), 'heard': heard}), flush=True)
""")

DRIVER = textwrap.dedent("""
    set -eu
    python3 "$WORK/agent.py" "$APPKIT" &
    for _ in $(seq 1 50); do gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \\
      --method org.freedesktop.DBus.NameHasOwner org.example.Chat.Agent | grep -q true && break; sleep 0.1; done
    sandbox() {
      info=$(mktemp); printf '[Application]\\nname=%s\\n' "$1" > "$info"; shift
      proxy=$(mktemp -u /tmp/readers-proxy.XXXXXX)
      root=(--ro-bind /usr /usr --ro-bind /etc /etc --symlink usr/lib /lib --symlink usr/lib64 /lib64
            --symlink usr/bin /bin --proc /proc --dev /dev --bind /tmp /tmp --ro-bind "$info" /.flatpak-info)
      bwrap "${root[@]}" xdg-dbus-proxy "$DBUS_SESSION_BUS_ADDRESS" "$proxy" --filter --talk=org.example.Chat.Agent >/dev/null 2>&1 &
      for _ in $(seq 1 50); do [ -S "$proxy" ] && break; sleep 0.1; done
      bwrap "${root[@]}" --setenv DBUS_SESSION_BUS_ADDRESS "unix:path=$proxy" "$@"
    }
    python3 "$WORK/reader.py" > "$WORK/host.json" &
    sandbox org.example.Evil python3 "$WORK/reader.py" > "$WORK/evil.json" &
    sandbox org.example.Phone python3 "$WORK/reader.py" > "$WORK/bound.json" &
    sandbox org.example.Chat python3 "$WORK/reader.py" > "$WORK/own.json" &
    sleep 7
    kill $(jobs -p) 2>/dev/null || true
""")


@unittest.skipUnless(sys.platform.startswith('linux') and all(shutil.which(tool) for tool in
                     ('dbus-run-session', 'bwrap', 'xdg-dbus-proxy')), 'needs a bus, bwrap and xdg-dbus-proxy')
class OverTheBus(unittest.TestCase):
    def test_each_reader_sees_and_hears_only_its_scope(self):
        work = Path(tempfile.mkdtemp(prefix='agent-readers-', dir='/tmp'))
        self.addCleanup(shutil.rmtree, work, True)
        (work / 'agent.py').write_text(AGENT); (work / 'reader.py').write_text(READER)
        env = {**os.environ, 'WORK': str(work), 'APPKIT': str(Path(__file__).resolve().parents[1] / 'appkit')}
        env.pop('DBUS_SESSION_BUS_ADDRESS', None)
        result = subprocess.run(['dbus-run-session', '--', 'bash', '-c', DRIVER], env=env,
                                capture_output=True, text=True, timeout=60)
        read = {name: json.loads((work / f'{name}.json').read_text().strip().splitlines()[-1])
                for name in ('host', 'evil', 'bound', 'own')}
        self.assertEqual(read['host'], {'got': ['online', 'unread'], 'heard': [['online', 'unread']]}, result.stderr)
        self.assertEqual(read['own'], {'got': ['online', 'unread'], 'heard': [['online', 'unread']]})
        self.assertEqual(read['bound'], {'got': ['online'], 'heard': [['online']]})
        self.assertEqual(read['evil'], {'got': [], 'heard': []})


if __name__ == '__main__':
    unittest.main()
