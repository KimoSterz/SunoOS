// SPDX-License-Identifier: Apache-2.0
// Tablet and Mobile: an application that asked for fullscreen itself (Mutter
// 0049, MetaWindow:client-fullscreen) hides the status bar and the home
// gesture bar; a pull from the top edge peeks them for a few seconds; leaving
// fullscreen brings them back. Desktop is unchanged.
// Run: gjs -m client-fullscreen-bars.js (node client-fullscreen-bars.js works too).
import {barsStepAside, peekPull} from '../../../src/luma-shell-presentation/layout.js';

const gjs = typeof globalThis.ARGV !== 'undefined';
const files = gjs ? (await import('gi://GLib')).default : await import('node:fs');
const read = path => {
    if (!gjs) return files.readFileSync(new URL(`../../../src/luma-shell-presentation/${path}`, import.meta.url), 'utf8');
    const here = files.path_get_dirname(files.filename_from_uri(import.meta.url)[0]);
    const file = files.build_filenamev([here, '..', '..', '..', 'src', 'luma-shell-presentation', path]);
    return new TextDecoder().decode(files.file_get_contents(file)[1]);
};
const fail = message => { throw new Error(message); };
const assert = {
    ok: (value, message) => value || fail(message ?? 'expected a true value'),
    equal: (actual, expected, message) => actual === expected ||
        fail(`${message ?? 'equal'}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`),
    deepEqual: (actual, expected, message) => JSON.stringify(actual) === JSON.stringify(expected) ||
        fail(`${message ?? 'deepEqual'}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`),
    match: (text, pattern, message) => pattern.test(text) || fail(message ?? `${pattern} not found`),
};
const source = read('presentation.js');
const between = (text, start, end) => {
    const from = text.indexOf(start), to = text.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `${start.trim()} … ${end.trim()} in the source`);
    return text.slice(from, to);
};

// The model: which modes, which windows.
for (const mode of ['desktop', 'tablet', 'mobile', 'tv']) {
    const handheld = mode === 'tablet' || mode === 'mobile';
    assert.equal(barsStepAside(mode, {clientFullscreen: false}), false,
        `${mode}: a window the Shell placed fullscreen keeps the bars`);
    assert.equal(barsStepAside(mode, {clientFullscreen: true}), handheld,
        `${mode}: a window that asked for fullscreen ${handheld ? 'hides' : 'keeps'} the bars`);
    assert.equal(barsStepAside(mode, {clientFullscreen: true, home: true}), false, `${mode}: Home keeps the bars`);
    assert.equal(barsStepAside(mode, {clientFullscreen: true, peek: true}), false, `${mode}: a peek shows the bars`);
}

// The pull: a thin band at the top edge, moving down.
const status = {x: 0, y: 0, width: 1200};
assert.equal(peekPull(600, 4, 12, status), true, 'down from the top edge peeks');
assert.equal(peekPull(600, 4, -12, status), false, 'up from the top edge does not');
assert.equal(peekPull(600, 60, 12, status), false, 'a game control below the band keeps its touch');
assert.equal(peekPull(600, 30, 12, status, 2), true, 'the band follows the UI scale');
assert.equal(peekPull(1300, 4, 12, status), false, 'off the status bar\'s display');

// The presentation's own code, on stubs.
const timers = new Map();
let serial = 0;
const Main = {
    sessionMode: {isLocked: false, isGreeter: false},
    panel: {statusArea: {quickSettings: {menu: {isOpen: false}}, dateMenu: {menu: {isOpen: false}}}},
    layoutManager: {keyboardBox: {get_parent: () => ({})}},
};
const GLib = {
    PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false, SOURCE_CONTINUE: true,
    timeout_add(_priority, ms, callback) { timers.set(++serial, {ms, callback}); return serial; },
    source_remove(id) { assert.ok(timers.delete(id), 'removes a live source'); },
};
// The presentation's code runs with only these names in scope (and the
// language's own globals), as node:vm gave it before.
const context = {};
new Function('Main', 'GLib', 'barsStepAside', 'peekNotificationLip', `${between(source, 'const PEEK_MS', '\n')}
${between(source, 'function clientFullscreen(window)', '\nfunction button')}
this.clientFullscreen = clientFullscreen; this.PEEK_MS = PEEK_MS;
this.Fixture = class {
${between(source, '    // Tablet and Mobile give the screen to an application', '    _syncStatusCompositing()')}
${between(source, '    _syncGestureVisibility()', '    _setStatusWindow(window)')}
}`).call(context, Main, GLib, barsStepAside, () => null);
const runTimers = () => {
    const due = [...timers]; timers.clear();
    for (const [id, {ms, callback}] of due) if (callback()) timers.set(id, {ms, callback});
};
const fixture = mode => Object.assign(new context.Fixture(), {mode,
    _status: {visible: false}, _gestureBar: {visible: false, reactive: true, get_parent: () => null},
    _home: {visible: false}, _handheldOptions: {isOpen: false}, _tasks: {sync() {}}});
const game = {fullscreen: true, asked: false, get_client_fullscreen() { return this.asked; }};
const bars = p => [p._status.visible, p._gestureBar.visible].join();

for (const mode of ['desktop', 'tablet', 'mobile']) {
    const p = fixture(mode);
    const shown = mode === 'desktop' ? 'false,false' : 'true,true';
    p._statusWindow = game; game.asked = false; p._syncBars();
    assert.equal(bars(p), shown, `${mode}: a window placed fullscreen by the Shell keeps the bars`);
    game.asked = true; p._syncBars();
    assert.equal(bars(p), 'false,false', `${mode}: a window that asked for fullscreen has no bars`);
    p._home.visible = true; p._syncBars();
    assert.equal(bars(p), shown, `${mode}: Home brings the bars back`);
    p._home.visible = false; p._syncBars();
    if (mode === 'desktop') continue;

    p.peekBars(true);
    assert.equal(bars(p), 'true,true', `${mode}: a top-edge pull shows the bars while it lasts`);
    assert.equal(timers.size, 0, 'no timer while the pull holds them');
    p.peekBars(false);
    assert.equal(bars(p), 'true,true', `${mode}: the bars stay after the pull ends`);
    assert.deepEqual([...timers.values()].map(timer => timer.ms), [context.PEEK_MS]);
    Main.panel.statusArea.quickSettings.menu.isOpen = true; runTimers();
    assert.equal(bars(p), 'true,true', `${mode}: Quick Options opened from the peek keeps them`);
    Main.panel.statusArea.quickSettings.menu.isOpen = false; p._statusPulls = {owner: 'options'}; runTimers();
    assert.equal(bars(p), 'true,true', `${mode}: a pull started from the peeked bar keeps them`);
    p._statusPulls = {owner: null}; runTimers();
    assert.equal(bars(p), 'false,false', `${mode}: the peek ends a few seconds after the pull`);
    assert.equal(timers.size, 0);

    p.peekBars(false); p._endPeek();
    assert.equal(timers.size, 0, 'leaving handheld or destroying drops a pending peek');
    p._syncBars();
    game.asked = false; p._syncBars();
    assert.equal(bars(p), 'true,true', `${mode}: leaving fullscreen brings the bars back`);
    p._statusWindow = {get_client_fullscreen: undefined}; p._syncBars();
    assert.equal(bars(p), 'true,true', `${mode}: an older Mutter without client-fullscreen keeps the bars`);

    Main.sessionMode.isLocked = true; game.asked = true; p._statusWindow = game; p._syncBars();
    assert.equal(bars(p), 'false,false', `${mode}: locked, as before`);
    Main.sessionMode.isLocked = false;
}

// The wiring the stubs above cannot reach.
const tasks = read('tabletTasks.js');
assert.match(between(tasks, '    sync() {', '    _showLane('), /_gestureBar\.visible = !this\.home\._barsStepAside\?\.\(\)/,
    'Tablet\'s own gesture-bar visibility also steps aside');
const pulls = read('handheldOptions.js');
assert.match(between(pulls, '    _pick(gesture) {', '    _end(cancel)'), /p\._barsStepAside\(\) && peekPull\(/,
    'StatusPulls starts a peek only when the bars stepped aside');
assert.match(source, /'notify::client-fullscreen', \(\) => this\._syncBars\(\)/, 'the focused window\'s request re-syncs the bars');
assert.match(source, /clientFullscreen\(window\) && this\._tasks\.groupFor\(window\)\) this\._tasks\.fill\(window\)/,
    'a fullscreen request in a side-by-side pair takes the whole screen');
assert.match(between(source, '    _queueInkSample()', '    _sampleInk()'), /!this\._status\.visible/,
    'no ink sampling while the bars are hidden');
console.log('PASS client fullscreen hides the handheld bars; peek, restore, Desktop and older Mutter unchanged');
