import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const out = GLib.getenv('LOCK_OUT');
const lines = [];
const sleep = ms => new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { r(); return GLib.SOURCE_REMOVE; }));
const state = tag => lines.push(`${tag}: shield=${Boolean(Main.screenShield)} active=${Main.screenShield?.active} locked=${Main.screenShield?.locked} session=${Boolean(Main.screenShield?._loginSession)} mode=${Main.sessionMode.currentMode}`);
async function main() {
    await sleep(6000);
    state('start');
    // What `loginctl lock-sessions` does: logind's LockSessions emits Lock on each session.
    try {
        await Gio.DBus.system.call('org.freedesktop.login1', '/org/freedesktop/login1', 'org.freedesktop.login1.Manager',
            'LockSessions', null, null, Gio.DBusCallFlags.NONE, 5000, null);
    } catch (e) { lines.push(`LockSessions: ${e.message}`); }
    await sleep(3000);
    state('after logind Lock');
    GLib.file_set_contents(out, lines.join('\n') + '\n');
    global.context.terminate();
}
export function init() { GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => { main(); return GLib.SOURCE_REMOVE; }); }
export async function run() { await new Promise(() => {}); }
