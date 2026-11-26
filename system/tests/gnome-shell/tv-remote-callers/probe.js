// SPDX-License-Identifier: Apache-2.0
// The TV Remote service (tvInput.js from source) in a headless Shell, with real
// callers: ShowQuickPanel answers only the app whose window has the focus, and
// a gamepad claim follows the claimant's app, also through xdg-dbus-proxy.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SOURCE = GLib.getenv('TVR_SOURCE') ?? '/source';
const OUT = GLib.getenv('TVR_OUT') ?? '/out';
const HERE = `${SOURCE}/tests/gnome-shell/tv-remote-callers`;
const checks = [];
const check = (name, ok, detail = '') => {
    checks.push({name, ok: Boolean(ok), detail: String(detail)});
    console.log(`[tv-remote-callers] ${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};
const sleep = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));
Gio._promisify(Gio.DataInputStream.prototype, 'read_line_async', 'read_line_finish_utf8');

const children = [];
// A client's answers, one JSON object per line, as they come.
function spawn(argv) {
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.STDOUT_PIPE});
    const child = launcher.spawnv(argv);
    children.push(child);
    const stream = new Gio.DataInputStream({base_stream: child.get_stdout_pipe()});
    const lines = [];
    (async () => {
        for (;;) {
            const [line] = await stream.read_line_async(GLib.PRIORITY_DEFAULT, null);
            if (line === null)
                return;
            try {
                lines.push(JSON.parse(line));
            } catch {}
        }
    })().catch(() => {});
    return lines;
}

async function answer(lines, action, timeout = 15000) {
    for (let waited = 0; waited < timeout; waited += 100) {
        const found = lines.find(line => line.action === action);
        if (found)
            return found.answer;
        await sleep(100);
    }
    return 'no answer';
}

const host = (title, actions, appId = null) =>
    spawn(['python3', `${HERE}/client.py`, title, actions, ...(appId ? [appId] : [])]);
const sandboxed = (app, title, actions) =>
    spawn(['bash', `${HERE}/sandbox.sh`, app, 'python3', `${HERE}/client.py`, title, actions]);
const windowTitled = title => global.get_window_actors().map(actor => actor.meta_window)
    .find(window => window.get_title() === title);

async function work() {
    const {TvInput} = await import(`file://${SOURCE}/src/luma-shell-presentation/tvInput.js`);
    const {actsForFocusedApp} = await import(`file://${SOURCE}/src/luma-shell-presentation/callerWindow.js`);
    const Main = await import('resource:///org/gnome/shell/ui/main.js');
    const {default: St} = await import('gi://St');
    let shown = 0;
    const tv = new TvInput({home: () => {}, showQuickPanel: () => shown++});
    await sleep(500);

    // A host app asks over its own focused window.
    const appLines = host('Host TV app', 'show');
    check('the focused host app opens the quick panel', await answer(appLines, 'show#0') === 'ok' && shown === 1,
        JSON.stringify(appLines));

    // A host program without a window asks over someone else's.
    const strayLines = host('-', 'show');
    const stray = await answer(strayLines, 'show#0');
    check('a program without the focused window is refused', /AccessDenied/.test(stray) && shown === 1, stray);

    // A Flatpak-style app: its bus process is xdg-dbus-proxy, not its window.
    const gameLines = sandboxed('org.example.TvGame', 'Sandboxed game', 'show,claim');
    const gameShow = await answer(gameLines, 'show#0');
    check('the focused sandboxed app opens the quick panel through its proxy', gameShow === 'ok' && shown === 2,
        `${gameShow} ${JSON.stringify(gameLines)}`);
    check('its gamepad claim is taken', await answer(gameLines, 'claim#1') === 'ok');
    const game = windowTitled('Sandboxed game');
    check('the game window is named by its sandbox', game?.get_sandboxed_app_id() === 'org.example.TvGame',
        game?.get_sandboxed_app_id());
    const focusedGame = global.display.focus_window === game;
    check('while the game has the focus its claim keeps the pads', focusedGame && tv._context().window?.claimed === true,
        JSON.stringify({focusedGame, context: tv._context().window}));

    // Another sandbox, no window: refused, and its claim never matches the game.
    const otherLines = sandboxed('org.example.Other', '-', 'show');
    const other = await answer(otherLines, 'show#0');
    check('another sandbox is refused over the game', /AccessDenied/.test(other) && shown === 2, other);

    // Focus back on the host app: the game's claim does not follow the focus.
    const hostWindow = windowTitled('Host TV app');
    hostWindow?.activate(global.get_current_time());
    await sleep(500);
    check("the host app's window is not claimed by the game", global.display.focus_window === hostWindow &&
        tv._context().window?.claimed === false, JSON.stringify(tv._context().window));

    // Exact IDs: a Flatpak named like the game but for its case is someone else.
    const caseLines = sandboxed('Org.Example.TvGame', '-', 'show');
    game?.activate(global.get_current_time());
    await sleep(500);
    const caseAnswer = await answer(caseLines, 'show#0');
    check('a case variant of the focused app is refused', global.display.focus_window === game &&
        /AccessDenied/.test(caseAnswer), caseAnswer);

    // A Flatpak named like a native app's desktop ID does not own the native window.
    const nativeLines = host('Native TV app', 'show,sleep9000,show', 'org.example.NativeTv');
    const nativeFirst = await answer(nativeLines, 'show#0');
    const native = windowTitled('Native TV app');
    const tracker = (await import('gi://Shell')).default.WindowTracker.get_default().get_window_app(native)?.get_id();
    check('the native app opens the quick panel over its window', nativeFirst === 'ok' &&
        tracker === 'org.example.NativeTv.desktop', `${nativeFirst} ${tracker}`);
    const twinLines = sandboxed('org.example.NativeTv', '-', 'show');
    const twin = await answer(twinLines, 'show#0');
    check("a Flatpak with the native app's ID can't own its window", global.display.focus_window === native &&
        /AccessDenied/.test(twin), twin);

    // A Shell modal holds the keys: no quick panel, no label, even for the focused app.
    const modal = new St.Widget({reactive: true, can_focus: true});
    Main.uiGroup.add_child(modal);
    const grab = Main.pushModal(modal);
    const nativeCaller = {pid: native.get_pid(), sandboxed: false, appId: ''};
    const labelDuringModal = actsForFocusedApp(nativeCaller, native, Main.modalCount, global.stage.key_focus, global.stage);
    const nativeSecond = await answer(nativeLines, 'show#2');
    Main.popModal(grab);
    modal.destroy();
    await sleep(300);
    check('the focused app is refused while a Shell modal is up', /AccessDenied/.test(nativeSecond), nativeSecond);
    check('a keyboard label during a Shell modal is ignored', labelDuringModal === false &&
        actsForFocusedApp(nativeCaller, native, 0, null, global.stage) === true, String(labelDuringModal));
    tv.destroy();
}

let started = false;
export function init() {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => {
        if (!started) {
            started = true;
            work().catch(e => check('the probe ran to the end', false, `${e}\n${e.stack}`)).finally(() => {
                for (const child of children)
                    child.force_exit();
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
