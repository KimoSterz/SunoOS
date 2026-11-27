// SPDX-License-Identifier: Apache-2.0
// Inside a headless Shell: the Shell's own connection may change the session;
// a program the Shell starts may not (trust is not inherited); reading is open.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const OUT = GLib.getenv('SSC_OUT') ?? '/out';
const NAME = 'org.projectSuno.ShellState1', PATH = '/org/projectSuno/ShellState1';
const checks = [];
const check = (name, ok, detail = '') => {
    checks.push({name, ok: Boolean(ok), detail: String(detail)});
    console.log(`[shell-state-callers] ${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};
Gio._promisify(Gio.DBusConnection.prototype, 'call');
Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

async function call(method, parameters = null) {
    try {
        const reply = await Gio.DBus.session.call(NAME, PATH, NAME, method, parameters, null,
            Gio.DBusCallFlags.NONE, 5000, null);
        return {ok: true, value: reply?.deepUnpack()};
    } catch (error) {
        return {ok: false, error: Gio.DBusError.get_remote_error(error) ?? error.message};
    }
}

async function snapshot() {
    return JSON.parse((await call('GetSnapshot')).value[0]);
}

async function work() {
    const heard = [];
    Gio.DBus.session.signal_subscribe(null, NAME, 'Changed', PATH, null, Gio.DBusSignalFlags.NONE,
        (_c, _s, _p, _i, _n, parameters) => heard.push(JSON.parse(parameters.deepUnpack()[1])));
    let answer = await call('SetPresentation', new GLib.Variant('(s)', ['tablet']));
    check('the Shell sets the presentation', answer.ok, JSON.stringify(answer));
    answer = await call('SetIdleDelay', new GLib.Variant('(u)', [480]));
    check('the Shell sets the idle delay', answer.ok, JSON.stringify(answer));
    await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => resolve()));
    check('the Shell hears Changed with the full snapshot',
        heard.some(item => item.power?.idle_delay_seconds === 480 && Array.isArray(item.favorites)),
        `${heard.length} signals`);
    const state = await snapshot();
    check('the Shell reads the full snapshot', 'favorites' in state && 'wallpaper' in state);
    check('the change is in the snapshot', state.presentation?.selected === 'tablet' &&
        state.power?.idle_delay_seconds === 480, JSON.stringify({p: state.presentation, power: state.power}));
    const child = Gio.Subprocess.new(['gdbus', 'call', '--session', '--dest', NAME, '--object-path', PATH,
        '--method', `${NAME}.SetIdleDelay`, '60'], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const [stdout, stderr] = await child.communicate_utf8_async(null, null);
    check('a program the Shell starts is refused', !child.get_successful() &&
        /AccessDenied/.test(stderr), `${stdout}${stderr}`.trim());
    check('and changed nothing', (await snapshot()).power?.idle_delay_seconds === 480);
    const reader = Gio.Subprocess.new(['gdbus', 'call', '--session', '--dest', NAME, '--object-path', PATH,
        '--method', `${NAME}.GetSnapshot`], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const [read] = await reader.communicate_utf8_async(null, null);
    check('a program the Shell starts reads no personal state', reader.get_successful() &&
        /presentation/.test(read) && !/favorites|wallpaper|idle_delay/.test(read), read.trim().slice(0, 200));
}

let started = false;
export function init() {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
        if (!started) {
            started = true;
            work().catch(e => check('the probe ran to the end', false, `${e}\n${e.stack}`)).finally(() => {
                GLib.file_set_contents(`${OUT}/checks.json`, JSON.stringify(checks));
                global.context.terminate();
            });
        }
        return GLib.SOURCE_REMOVE;
    });
}

export async function run() {
    await new Promise(() => {});
}
