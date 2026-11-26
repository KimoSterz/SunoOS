// SPDX-License-Identifier: Apache-2.0
// Which application a D-Bus caller is, and whether the focused window is its
// own. The Shell's app-facing TV services (Remote: ShowQuickPanel,
// ClaimGamepads; Keyboard: SetActionLabel) act for the focused application
// only, so they answer it and nobody else.
//
// The caller's process comes from GetConnectionCredentials, held by its pidfd
// (ProcessFD) where the bus gives one and checked again after everything else
// is read, so a reused pid can't stand in for it.
//
// A sandboxed caller (another filesystem namespace, or one the Shell can't
// read) is named by its sandbox and matched ONLY against the window's sandbox
// name, Mutter's get_sandboxed_app_id(): a Flatpak by the /.flatpak-info of its
// xdg-dbus-proxy (flatpak writes it, bwrap binds it read-only into the proxy's
// sandbox; Mutter names the window by the same file), Luma's own sandboxes by
// the installer's AppPermissions1 Identify, asked by the unique name of its
// verified owner. IDs are compared exactly (case and all), only ".desktop"
// stripped.
//
// A host program is matched by its process, or by the app scope the Shell
// started it in. That is same-user trust, not a boundary: a host process can
// spawn into, or move itself into, another app's app-gnome-*.scope (the user's
// cgroups are delegated to them), as it can already write that app's settings.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

Gio._promisify(Gio.DBusConnection.prototype, 'call');
Gio._promisify(Gio.DBusConnection.prototype, 'call_with_unix_fd_list');

const PERMISSIONS = 'org.projectluma.AppPermissions1';
const PERMISSIONS_UNIT = 'luma-app-permissions.service';
const PERMISSIONS_PROGRAM = '/usr/libexec/luma-app-permissions';

function read(path) {
    try {
        return new TextDecoder().decode(GLib.file_get_contents(path)[1]);
    } catch {
        return null;
    }
}

function link(path) {
    try {
        return GLib.file_read_link(path);
    } catch {
        return null;
    }
}

export function normalize(id) {
    return (id ?? '').replace(/\.desktop$/, '');
}

// The application a host process's app scope names (app-gnome-ID-PID.scope).
export function scopeApp(cgroup) {
    const match = (cgroup ?? '').match(/app-(?:gnome|flatpak|luma)-(.+?)-[0-9]+\.scope/);
    return match
        ? match[1].replace(/\\x([0-9a-f]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
        : '';
}

function unit(pid) {
    const lines = (read(`/proc/${pid}/cgroup`) ?? '').trim().split('\n');
    return lines[lines.length - 1].replace(/\/$/, '').split('/').pop();
}

function flatpakApp(path) {
    const info = new GLib.KeyFile();
    try {
        info.load_from_file(path, GLib.KeyFileFlags.NONE);
        return info.get_string('Application', 'name');
    } catch {
        return '';
    }
}

function sameNamespace(pid) {
    const own = link('/proc/self/ns/mnt');
    const theirs = link(`/proc/${pid}/ns/mnt`);
    return Boolean(own) && own === theirs;
}

function rootOwned(path) {
    try {
        const info = Gio.File.new_for_path(path).query_info('unix::uid,unix::mode',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        return info.get_attribute_uint32('unix::uid') === 0 &&
            (info.get_attribute_uint32('unix::mode') & 0o022) === 0;
    } catch {
        return false;
    }
}

function pidfdPid(fd) {
    const match = (read(`/proc/self/fdinfo/${fd}`) ?? '').match(/^Pid:\s*(-?\d+)/m);
    return match ? Number(match[1]) : 0;
}

// The pid of a connection, and its pidfd (-1 when the bus gives none).
async function credentials(bus, name) {
    const [reply, fds] = await bus.call_with_unix_fd_list('org.freedesktop.DBus', '/org/freedesktop/DBus',
        'org.freedesktop.DBus', 'GetConnectionCredentials', new GLib.Variant('(s)', [name]),
        new GLib.VariantType('(a{sv})'), Gio.DBusCallFlags.NONE, -1, null, null);
    const values = reply.recursiveUnpack()[0];
    const pid = Number(values.ProcessID ?? 0);
    let pidfd = -1;
    if (fds && Number.isInteger(values.ProcessFD) && values.ProcessFD < fds.get_length())
        pidfd = fds.get(values.ProcessFD);
    return {pid, pidfd};
}

function release(pidfd) {
    if (pidfd >= 0) {
        try {
            GLib.close(pidfd);
        } catch {}
    }
}

// The unique name of the installer's permission service, once its owner is the
// root-owned program running as its own unit in the host's namespace.
async function permissionsOwner(bus) {
    try {
        await bus.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus',
            'StartServiceByName', new GLib.Variant('(su)', [PERMISSIONS, 0]), null,
            Gio.DBusCallFlags.NONE, 5000, null);
    } catch {}
    const [owner] = (await bus.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus',
        'GetNameOwner', new GLib.Variant('(s)', [PERMISSIONS]), new GLib.VariantType('(s)'),
        Gio.DBusCallFlags.NONE, 5000, null)).deepUnpack();
    const {pid, pidfd} = await credentials(bus, owner);
    try {
        const argv = (read(`/proc/${pid}/cmdline`) ?? '').split('\0');
        const verified = Number.isInteger(pid) && pid > 0 && sameNamespace(pid) && unit(pid) === PERMISSIONS_UNIT &&
            argv.slice(0, 2).includes(PERMISSIONS_PROGRAM) && rootOwned(PERMISSIONS_PROGRAM) &&
            (pidfd < 0 || pidfdPid(pidfd) === pid);
        return verified ? owner : '';
    } finally {
        release(pidfd);
    }
}

async function identify(bus, pid) {
    try {
        const owner = await permissionsOwner(bus);
        if (!owner)
            return '';
        const reply = await bus.call(owner, '/org/projectluma/AppPermissions', PERMISSIONS, 'Identify',
            new GLib.Variant('(u)', [pid]), new GLib.VariantType('(ss)'), Gio.DBusCallFlags.NONE, 3000, null);
        const [app, kind] = reply.deepUnpack();
        return kind === 'host' ? '' : app;
    } catch {
        return '';
    }
}

// {pid, sandboxed, appId} for the connection that sent a call. Throws when the
// process is gone or was replaced while it was looked at.
export async function callerIdentity(sender, bus = Gio.DBus.session) {
    const {pid, pidfd} = await credentials(bus, sender);
    try {
        if (!(pid > 0) || (pidfd >= 0 && pidfdPid(pidfd) !== pid))
            throw new Error('The caller has no process');
        const flatpak = flatpakApp(`/proc/${pid}/root/.flatpak-info`);
        // Unreadable counts as sandboxed.
        const sandboxed = Boolean(flatpak) || !sameNamespace(pid);
        let appId = flatpak;
        if (!appId && sandboxed)
            appId = await identify(bus, pid);
        if (!appId && !sandboxed)
            appId = scopeApp(read(`/proc/${pid}/cgroup`));
        if (pidfd >= 0 && pidfdPid(pidfd) !== pid)
            throw new Error('The caller changed while it was looked at');
        return {pid, sandboxed, appId};
    } finally {
        release(pidfd);
    }
}

// The rule, without the Shell. A sandboxed caller owns only a window its own
// sandbox drew; a host caller its own process's windows or its scope's app's.
export function ownsIds(caller, {pid, sandboxedId, trackerId}) {
    if (!caller)
        return false;
    const id = normalize(caller.appId);
    if (caller.sandboxed)
        return id !== '' && id === normalize(sandboxedId);
    if (caller.pid > 0 && caller.pid === pid)
        return true;
    return id !== '' && id === normalize(trackerId);
}

export function windowFacts(window) {
    const app = Shell.WindowTracker.get_default().get_window_app(window);
    return {pid: window.get_pid(), sandboxedId: window.get_sandboxed_app_id?.() ?? '', trackerId: app?.get_id?.() ?? ''};
}

export function ownsWindow(caller, window) {
    return Boolean(window) && ownsIds(caller, windowFacts(window));
}

// The person is in an application window: no Shell modal (polkit, unlock, a
// Shell dialog) and no Shell actor holding the keys.
export function appHasKeys(modalCount, keyFocus, stage) {
    return modalCount === 0 && (!keyFocus || keyFocus === stage);
}

export function actsForFocusedApp(caller, window, modalCount, keyFocus, stage) {
    return appHasKeys(modalCount, keyFocus, stage) && ownsWindow(caller, window);
}
