// SPDX-License-Identifier: Apache-2.0
// gnome-shell --automation-script for passwordless-lock.sh: every way to
// lock (logind's Lock from `loginctl lock-sessions` and `loginctl
// lock-session`, and org.gnome.ScreenSaver.Lock, which Super+L calls) locks
// the session, for an account with a password and one without. Activity
// keeps it locked; a click on the curtain asks for the password, or, with
// no password, enters without asking.
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const kind = GLib.getenv('LOCK_KIND');
const out = GLib.getenv('LOCK_OUT');
const lines = [];
const check = (name, ok, detail = '') => lines.push(`${kind}: ${name}: ${ok ? 'PASS' : 'FAIL'}${detail ? `, ${detail}` : ''}`);
const sleep = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));

async function until(test, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (test())
            return true;
        await sleep(100);
    }
    return test();
}

function call(bus, dest, path, iface, method, params = null) {
    return new Promise((resolve, reject) => bus.call(dest, path, iface, method, params, null,
        Gio.DBusCallFlags.NONE, 5000, null, (c, r) => {
            try {
                resolve(c.call_finish(r));
            } catch (e) {
                reject(e);
            }
        }));
}

const LOGIN1 = ['org.freedesktop.login1', '/org/freedesktop/login1', 'org.freedesktop.login1.Manager'];

async function lockedHint() {
    const [value] = (await call(Gio.DBus.system, 'org.freedesktop.login1', '/org/freedesktop/login1/session/c1',
        'org.freedesktop.DBus.Properties', 'Get',
        new GLib.Variant('(ss)', ['org.freedesktop.login1.Session', 'LockedHint']))).deepUnpack();
    return value.unpack();
}

const seat = Clutter.get_default_backend().get_default_seat();
const pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
const move = (x, y) => pointer.notify_absolute_motion(GLib.get_monotonic_time(), x, y);

async function click(x, y) {
    move(x, y);
    await sleep(50);
    pointer.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
    await sleep(60);
    pointer.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
}

const ROUTES = [
    ['loginctl lock-sessions', () => call(Gio.DBus.system, ...LOGIN1, 'LockSessions')],
    ['loginctl lock-session', () => call(Gio.DBus.system, ...LOGIN1, 'LockSession', new GLib.Variant('(s)', ['c1']))],
    ['ScreenSaver.Lock (Super+L)', () => call(Gio.DBus.session, 'org.gnome.ScreenSaver', '/org/gnome/ScreenSaver',
        'org.gnome.ScreenSaver', 'Lock')],
];

async function main() {
    const shield = Main.screenShield;
    try {
        check('screen shield present', Boolean(shield));
        for (const [name, lock] of ROUTES) {
            await lock();
            const up = await until(() => shield.locked && shield.active, 8000);
            const hint = await lockedHint();
            check(`${name}: locks`, up && hint, `locked ${shield.locked}, active ${shield.active}, LockedHint ${hint}`);
            await sleep(1500);
            move(300, 300);
            await sleep(200);
            move(700, 500);
            await sleep(1500);
            check(`${name}: activity keeps it locked`, shield.locked && shield.active);
            let prompt = false;
            await click(640, 400);
            if (kind === 'none') {
                const gone = await until(() => {
                    prompt ||= Boolean(shield._dialog?._authPrompt);
                    return !shield.locked && !shield.active;
                }, 8000);
                const hintAfter = await lockedHint();
                check(`${name}: a click enters without a password`, gone && !prompt && !hintAfter,
                    `locked ${shield.locked}, active ${shield.active}, prompt ${prompt}, LockedHint ${hintAfter}`);
            } else {
                await sleep(1500);
                prompt = Boolean(shield._dialog?._authPrompt);
                check(`${name}: a click asks for the password`, shield.locked && prompt,
                    `locked ${shield.locked}, prompt ${prompt}`);
                // As GDM does after authenticating: logind's Unlock.
                await call(Gio.DBus.system, ...LOGIN1, 'UnlockSessions');
                await until(() => !shield.locked && !shield.active, 8000);
            }
            await sleep(1500);
        }
    } catch (e) {
        lines.push(`${kind}: error: FAIL, ${e}`);
    }
    GLib.file_set_contents(out, `${lines.join('\n')}\n`);
    global.context.terminate();
}

export function init() {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => {
        main();
        return GLib.SOURCE_REMOVE;
    });
}

export async function run() {
    await new Promise(() => {});
}
