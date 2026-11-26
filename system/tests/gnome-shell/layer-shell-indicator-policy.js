// SPDX-License-Identifier: GPL-2.0-or-later
// The overlay status cell, its popover and the offer (0381,
// lumaLayerShellIndicatorModel.js): which apps the cell shows and "+N" past
// two, the tooltip, the popover's "what · how long", the 2 s grace, the
// offer's sentences and that neither answer is a default (on TV the focus
// starts on Not now), and one name tag per app on its largest surface.
// Run: gjs -m layer-shell-indicator-policy.js js/ui/lumaLayerShellIndicatorModel.js
const gjs = typeof globalThis.ARGV !== 'undefined';
const args = gjs ? globalThis.ARGV : process.argv.slice(2);
const print = gjs ? globalThis.print : console.log;
const path = args[0].startsWith('/') ? args[0]
    : `${gjs ? (await import('gi://GLib')).default.get_current_dir() : process.cwd()}/${args[0]}`;
const V = await import(`file://${path}`);

let passed = 0;
function check(value, message) {
    if (!value)
        throw new Error(`FAIL: ${message}`);
    passed++;
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Surfaces rows: (app, namespace, layer, using, faded, held, since).
const OVERLAY = 3, TOP = 2;
const surfaces = [
    ['diskord', 'voice', OVERLAY, 4, false, false, 100],
    ['huddle', 'call-bubble', OVERLAY, 4, false, false, 200],
    ['diskord', 'chat', OVERLAY, 4, true, false, 150],
    ['bar', 'waybar', TOP, 2, false, false, 10],
    ['held', 'hud', OVERLAY, 0, false, true, 0],
];

// Only mapped overlay surfaces count, one entry per app, least recent first.
const apps = V.overlayApps(surfaces);
check(eq(apps.map(a => a.app), ['diskord', 'huddle']), 'overlay apps, least recent first');
check(apps[0].first === 100 && apps[0].since === 150, 'an app spans its surfaces');
check(V.overlayApps([]).length === 0, 'no surfaces, no apps');

// The cell: one or two icons, then the most recent and "+N".
check(eq(V.cell([]), {icons: [], more: 0}), 'empty cell');
check(eq(V.cell(['a']), {icons: ['a'], more: 0}), 'one app');
check(eq(V.cell(['a', 'b']), {icons: ['a', 'b'], more: 0}), 'two apps stacked');
check(eq(V.cell(['a', 'b', 'c']), {icons: ['c'], more: 2}), 'three apps: the most recent and +2');
check(eq(V.cell(['a', 'b', 'c', 'd', 'e']), {icons: ['e'], more: 4}), 'five apps: +4');

// The tooltip.
check(V.tooltip(['Diskord']) === 'Diskord is displaying over other apps', 'tooltip, one app');
check(V.tooltip(['Diskord', 'Huddle', 'Playground']) === '3 apps are displaying over other apps', 'tooltip, several');
check(V.tooltip(['Diskord'], true) === 'Diskord has the keyboard', 'tooltip, keyboard');

// The keyboard cell.
check(V.keyboardApp([['k', 'launcher', TOP, 8, false, false, 1]]) === 'k', 'an app holding the keyboard');
check(V.keyboardApp([['k', 'launcher', TOP, 8, false, true, 1]]) === null, 'a held surface holds nothing');

// "what · how long".
check(V.what('discord-voice') === 'Voice overlay' && V.what('call-bubble') === 'Call bubble' &&
    V.what('mangohud') === 'Game stats' && V.what('anything') === 'Overlay', 'namespaces in words');
check(V.since(100, 110) === 'now' && V.since(0, 240) === '4 min' && V.since(0, 7300) === '2 h', 'how long');
check(V.detail(apps[0], 100 + 4 * 60) === 'Voice overlay · 4 min', 'popover detail');

// Present while any overlay shows, gone 2 s after the last.
let state = V.presence(1, {visible: false, hideAt: 0}, 0);
check(state.visible && !state.hideAt, 'shown with an overlay');
state = V.presence(0, state, 1000);
check(state.visible && state.hideAt === 1000 + V.GRACE_MS, 'kept for the grace');
check(V.presence(0, state, 2999).visible, 'still there inside the grace');
check(!V.presence(0, state, 3000).visible, 'gone after the grace');
check(V.presence(1, state, 2500).visible && !V.presence(1, state, 2500).hideAt, 'an overlay back inside the grace keeps it');
check(!V.presence(0, {visible: false, hideAt: 0}, 5).visible, 'never shown, stays hidden');

// The offer.
check(V.OFFER_TEXT[4].replace('%s', 'Diskord') === 'Allow Diskord to display over games and full-screen apps?', 'overlay sentence');
check(V.OFFER_TEXT[2].replace('%s', 'Diskord') === 'Allow Diskord to add a panel to the desktop?', 'panel sentence');
check(V.OFFER_TEXT[1].replace('%s', 'Diskord') === 'Allow Diskord to draw the desktop background?', 'background sentence');
check(V.OFFER_TEXT[8].replace('%s', 'Diskord') === 'Allow Diskord to take the keyboard?', 'keyboard sentence');
check(V.OFFER_TITLE[4] === 'Display over other apps' && V.OFFER_TITLE[2] === 'Add a panel' &&
    V.OFFER_TITLE[1] === 'Desktop background' && V.OFFER_TITLE[8] === 'Take the keyboard',
'offer titles are the capabilities\' names, as in Settings');
check(V.ROW_ICON.tv === 48 && V.ROW_ICON.desktop === 32 && V.ROW_ICON.phone === 32,
    'popover row icon: 48 px on TV (x1.5), 32 px elsewhere');
check(V.offerFocus('desktop') === null && V.offerFocus('phone') === null, 'no default answer');
check(V.offerFocus('tv') === 'not-now', 'TV focus on Not now');

// One name tag per app, on its largest faded surface.
check(eq(V.tagTargets([]), []), 'no faded surfaces, no tags');
check(eq(V.tagTargets([{key: 'voice', app: 'd', area: 220 * 172}, {key: 'chat', app: 'd', area: 736 * 636}]),
    ['chat']), 'one tag for an app, on its largest surface');
check(eq(V.tagTargets([{key: 'a1', app: 'a', area: 10}, {key: 'b1', app: 'b', area: 5}, {key: 'a2', app: 'a', area: 10}]),
    ['a1', 'b1']), 'one tag per app; a tie keeps the first');

print(`layer-shell-indicator-policy: ${passed} checks passed`);
