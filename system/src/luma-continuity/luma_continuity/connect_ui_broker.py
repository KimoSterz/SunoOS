# SPDX-License-Identifier: Apache-2.0
"""Fixed, signed Connect UI access to its host-owned cloud sync engine."""
from concurrent.futures import ThreadPoolExecutor
import json
from contextlib import nullcontext
import os
from pathlib import Path
import selectors
import subprocess
import threading
import time

from .connect_cloud_contract import command_plan

APP = 'org.projectluma.Connect'
METHOD = 'ConnectCloudRequest'
LIMIT = 262144


def _host_app(pid):
    """The app scope a host process runs in (app-gnome-ID-PID.scope), or ''."""
    import re
    try:
        line = Path(f'/proc/{pid}/cgroup').read_text().strip().splitlines()[-1]
    except (OSError, IndexError):
        return ''
    match = re.search(r'/app-(?:gnome|flatpak|luma)-(.+?)-[0-9]+\.scope$', line)
    return match.group(1).replace('\\x2d', '-') if match else ''


def _launcher_sandbox(pid, proc=Path('/proc')):
    """Luma's launchers sandbox store apps, capsules and AppImages in an
    app-luma-* scope and run their D-Bus proxy on the host: either is a
    sandbox, never a native caller, whatever the proxy's filter allows."""
    try:
        line = (proc / str(pid) / 'cgroup').read_text().strip().splitlines()[-1]
    except (OSError, IndexError):
        return True
    leaf = line.rstrip('/').rsplit('/', 1)[-1]
    if leaf.startswith('app-luma-') and leaf.endswith('.scope'):
        return True
    try:
        executable = os.readlink(proc / str(pid) / 'exe').removesuffix(' (deleted)')
    except OSError:
        return False
    return os.path.basename(executable) in {'xdg-dbus-proxy', 'flatpak-dbus-proxy'}


def _same_host(pid):
    try:
        root, host = Path(f'/proc/{pid}/root').stat(), Path('/proc/self/root').stat()
        return ((root.st_dev, root.st_ino) == (host.st_dev, host.st_ino)
                and os.readlink(f'/proc/{pid}/ns/mnt') == os.readlink('/proc/self/ns/mnt'))
    except OSError:
        return False


def require_connect_if_sandbox(connection, sender, method):
    """Existing native session callers remain native; sandboxes need signed UI.

    Returns (app, sandboxed): the signed app a sandbox proved, or the app
    scope a native caller runs in. A caller without a sandbox file must see
    this session's own filesystem and not be one of Luma's launcher
    sandboxes: a process in another mount namespace, in an app-luma-* scope,
    or a host xdg-dbus-proxy is not native.

    A native caller is named by its app scope. That is same-user trust, not a
    proof: any program of the person can start itself in Connect's scope (the
    user's systemd manages those scopes), so a native "Connect" is whoever
    the person runs as Connect."""
    from gi.repository import GLib, Gio
    result, fds = connection.call_with_unix_fd_list_sync('org.freedesktop.DBus', '/org/freedesktop/DBus',
        'org.freedesktop.DBus', 'GetConnectionCredentials', GLib.Variant('(s)', (sender,)),
        GLib.VariantType.new('(a{sv})'), Gio.DBusCallFlags.NONE, 5000, None, None)
    values = result.unpack()[0]
    pidfd = _delivered_pidfd(values, fds)
    try:
        return _require(connection, sender, method, values.get('UnixUserID'), values.get('ProcessID'), pidfd)
    finally:
        if pidfd >= 0:
            os.close(pidfd)


def _delivered_pidfd(values, fds):
    """-1 when the bus offers no ProcessFD (the pid is then held by its start
    time); a ProcessFD named but not delivered is refused."""
    if 'ProcessFD' not in values:
        return -1
    index = values['ProcessFD']
    try:
        if (isinstance(index, bool) or not isinstance(index, int) or fds is None
                or not 0 <= index < fds.get_length()):
            raise PermissionError('The bus named a process descriptor it did not deliver.')
        descriptor = fds.get(index)
    except PermissionError:
        raise
    except Exception as error:  # noqa: BLE001 -- GLib.Error: an invalid descriptor
        raise PermissionError('The bus delivered an invalid process descriptor.') from error
    if not isinstance(descriptor, int) or descriptor < 0:
        raise PermissionError('The bus delivered an invalid process descriptor.')
    return descriptor


def _pidfd_pid(fd):
    try:
        for line in Path(f'/proc/self/fdinfo/{fd}').read_text().splitlines():
            if line.startswith('Pid:'):
                return max(int(line.split()[1]), 0)
    except (OSError, ValueError, IndexError):
        pass
    return 0


def _require(connection, sender, method, uid, pid, pidfd):
    if not isinstance(uid, int) or not isinstance(pid, int) or uid != os.getuid() or pid <= 0:
        raise PermissionError('Connect is owned by this user session.')
    from luma_installer.app_data_broker import _start, authenticate
    before = _start(pid) if pidfd < 0 else None

    def held():
        return _pidfd_pid(pidfd) == pid if pidfd >= 0 else _start(pid) == before
    try:
        with Path(f'/proc/{pid}/root/.flatpak-info').open() as stream:
            stream.read(1)
    except FileNotFoundError:
        if not _same_host(pid) or _launcher_sandbox(pid):
            raise PermissionError('Connect callers outside a Flatpak must be this session\'s own programs.')
        app = _host_app(pid)
        if not held(): raise PermissionError('Connect caller changed.')
        return app, False
    app = authenticate(connection, sender)
    phone_calls = {'GetCallState','ExchangeCall','StartCallAudio','StopCallAudio','SetCallAudioMuted'}
    if app != APP and not (app == 'org.projectluma.Phone' and method in phone_calls):
        raise PermissionError('Only the installed Connect interface may change this account.')
    return app, True


def execute(arguments, timeout, input_text, cancelled):
    """Bound native output/time without spawning a thread per incoming request."""
    process = subprocess.Popen(['/usr/bin/luma-connect-sync', *arguments],
        stdin=subprocess.PIPE if input_text is not None else subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    selector = selectors.DefaultSelector()
    output = {'stdout': bytearray(), 'stderr': bytearray()}
    try:
        if input_text is not None:
            process.stdin.write(input_text.encode()); process.stdin.close()
        for label in output:
            pipe = getattr(process, label); os.set_blocking(pipe.fileno(), False)
            selector.register(pipe, selectors.EVENT_READ, label)
        deadline = time.monotonic() + timeout
        while selector.get_map():
            if cancelled() or time.monotonic() >= deadline:
                raise TimeoutError('Luma Connect took too long to answer.')
            for key, _mask in selector.select(0.1):
                block = os.read(key.fd, 65536)
                if not block: selector.unregister(key.fileobj); continue
                output[key.data].extend(block)
                if sum(map(len, output.values())) > LIMIT:
                    raise ValueError('Luma Connect response exceeded its size bound.')
        code = process.wait(timeout=max(0.1, deadline-time.monotonic()))
        return code, *(bytes(output[key]).decode('utf-8', errors='replace') for key in ('stdout', 'stderr'))
    finally:
        selector.close()
        if process.poll() is None:
            import signal
            os.killpg(process.pid, signal.SIGKILL); process.wait()
        for pipe in (process.stdin, process.stdout, process.stderr):
            if pipe is not None: pipe.close()


class ConnectUIBroker:
    def __init__(self, *, authenticate=None, runner=execute):
        if authenticate is None:
            from luma_installer.app_data_broker import authenticate
        self.authenticate = authenticate; self.runner = runner
        self.pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix='connect-ui')
        self.slots = threading.BoundedSemaphore(2); self.serial = threading.Lock()
        self.closed = False

    def dispatch(self, connection, sender, values, invocation, GLib):
        try:
            if self.closed or self.authenticate(connection, sender) != APP: raise PermissionError()
            if len(values) != 1 or not isinstance(values[0], str) or len(values[0].encode()) > 8192: raise ValueError()
            plan = command_plan(json.loads(values[0]))
            if not self.slots.acquire(blocking=False): raise RuntimeError()
        except Exception:
            invocation.return_dbus_error('org.projectluma.Connect1.UI.Refused', 'Connect access is unavailable.'); return
        def run():
            try:
                # Read-only status must remain available during a long sync.
                # Mutations keep their original serialization and queue bound.
                with (nullcontext() if plan[0] == ['status', '--json'] else self.serial):
                    if self.closed or self.authenticate(connection, sender) != APP: raise PermissionError()
                    code, out, err = self.runner(*plan, lambda: self.closed)
                    # A status/profile response carries only the existing public
                    # CLI report, never device.json/enrollment bearer material.
                    problem = None if code == 0 else ('This computer needs to be connected to Luma Connect again.'
                        if code == 3 else (err or out).strip().splitlines()[-1:][0] if (err or out).strip()
                        else 'Luma Connect could not be reached. Try again.')
                    response = json.dumps({'code': code, 'problem': problem, 'output': out}, allow_nan=False)
                    if len(response.encode()) > LIMIT*2: raise ValueError()
                GLib.idle_add(lambda: (invocation.return_value(GLib.Variant('(s)', (response,))), False)[1])
            except Exception:
                GLib.idle_add(lambda: (invocation.return_dbus_error('org.projectluma.Connect1.UI.Unavailable',
                    'Luma Connect information is unavailable.'), False)[1])
            finally: self.slots.release()
        try: self.pool.submit(run)
        except Exception:
            self.slots.release(); invocation.return_dbus_error('org.projectluma.Connect1.UI.Unavailable', 'Connect is closing.')

    def close(self):
        self.closed = True; self.pool.shutdown(wait=True, cancel_futures=True)
