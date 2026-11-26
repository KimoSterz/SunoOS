// SPDX-License-Identifier: GPL-2.0-or-later
// Luma Connect Sync in the Shell (0384, lumaConnectSyncModel.js): the status
// cell only when there's something to say, each state's words and its one
// action (cs.js STATES), banners for storage full and removed but never for
// conflicts, the approval card's words, that cards stay until answered and
// leave on every device once one answers, Not me never the default, and the
// restoring tile that opens Valet instead of the app.
// Run: gjs -m connect-sync-policy.js js/ui/lumaConnectSyncModel.js
const gjs = typeof globalThis.ARGV !== 'undefined';
const args = gjs ? globalThis.ARGV : process.argv.slice(2);
const print = gjs ? globalThis.print : console.log;
const path = args[0].startsWith('/') ? args[0]
    : `${gjs ? (await import('gi://GLib')).default.get_current_dir() : process.cwd()}/${args[0]}`;
const M = await import(`file://${path}`);

let passed = 0;
function check(value, message) {
    if (!value)
        throw new Error(`FAIL: ${message}`);
    passed++;
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const NOW = Math.floor(new Date(2026, 10, 21, 20, 25).getTime() / 1000);
const base = {enabled: true, attention: null, last_sync: NOW - 120, storage: {used: 0, quota: 5 * 1024 ** 3}};
const st = (state, attention = null, extra = {}) => ({...base, state, attention, ...extra});

// The cell: hidden when up to date, off or joining; shown for syncing, paused, attention.
check(!M.cell(st('up_to_date')).visible, 'up to date shows nothing');
check(!M.cell(st('off')).visible, 'off shows nothing');
check(!M.cell(st('joining')).visible, 'joining shows nothing');
check(!M.cell(null).visible, 'no service shows nothing');
check(!M.cell({...st('paused'), enabled: false}).visible, 'turned off by the person shows nothing');
check(M.cell(st('syncing')).visible && M.cell(st('syncing')).icon === M.ICON['refresh-cw'], 'syncing: refresh-cw');
check(M.cell(st('paused')).icon === M.ICON['cloud-off'], 'paused: cloud-off');
const conflict = st('attention', {reason: 'conflict', detail: 'Kiln changed on two devices', app: 'kiln', from: 'Dell XPS 14', at: NOW - 600});
const quota = st('attention', {reason: 'quota', used: 5 * 1024 ** 3, quota: 5 * 1024 ** 3});
const revoked = st('attention', {reason: 'revoked', by: 'Dell XPS 14', at: NOW - 60});
check(M.cell(conflict).icon === M.ICON['cloud-alert'] && M.cell(conflict).tone === 'warn', 'conflict: amber cloud-alert');
check(M.cell(quota).icon === M.ICON['cloud-alert'] && M.cell(quota).tone === 'warn', 'quota: amber cloud-alert');
check(M.cell(revoked).tone === 'bad', 'revoked: red');

// The popover's words and its one action (cs.js STATES).
const p = s => M.popover(s, NOW);
const syncing = p(st('syncing', null, {progress: {left: 34 * 1024 ** 2, from: 'Dell XPS 14', fraction: 0.64}}));
check(syncing.title === 'Syncing' && syncing.sub === '34 MB left · from Dell XPS 14' && syncing.progress === 0.64 &&
    syncing.action === null, 'syncing');
check(eq([p(st('up_to_date')).title, p(st('up_to_date')).sub], ['Up to date', 'Synced 2 minutes ago']), 'done');
const paused = p(st('paused', null, {metered: true}));
check(eq([paused.title, paused.sub, paused.action], ['Paused', 'On a metered connection', 'Sync now']), 'paused');
const c = p(conflict);
check(eq([c.title, c.sub, c.message, c.action], ['Kiln changed on two devices', 'Kept both · today',
    'This device’s copy is in use. The copy from Dell XPS 14 is kept for 30 days.', 'Show versions']), 'conflict');
const q = p(quota);
check(eq([q.title, q.sub, q.message, q.action], ['Storage full', '5 GB of 5 GB',
    'New changes stay on this device until there’s room.', 'Manage storage']), 'quota');
const r = p(revoked);
check(eq([r.title, r.sub, r.message, r.action], ['Removed from Sync', 'On Dell XPS 14 · today',
    'This device no longer syncs. Everything on it stays. Sign in to Luma Connect again to rejoin.', 'Sign in again']),
'revoked');
// Each action goes somewhere: the service or Settings.
check(eq(M.ACTION['Sync now'], {method: 'SyncNow'}), 'Sync now calls SyncNow');
check(M.ACTION['Sign in again'].app === 'org.projectluma.Connect.desktop', 'Sign in again opens the Luma Connect sign-in');
check(eq(M.actionTarget('Show versions', c.subject).route, ['sync', 'versions', 'kiln']), 'Show versions opens the app\'s versions');
check(eq(M.ACTION['Manage storage'].route, ['sync']), 'Manage storage opens Sync settings');
for (const view of [paused, c, q, r])
    check(M.ACTION[view.action], `${view.action} has somewhere to go`);

// Banners: storage full and removed, once on entering; conflicts never.
check(M.banner(st('syncing'), quota)?.title === 'Storage full', 'quota posts a banner');
check(M.banner(quota, quota) === null, 'only once');
check(M.banner(st('up_to_date'), revoked)?.action === 'Sign in again', 'revoked posts a banner');
// A recovery-key join: a banner, not a card, with Remove… to Settings' confirm.
const kj = M.keyJoinBanner('d9', 'ThinkPad');
check(kj.title === 'ThinkPad joined with your recovery key' && kj.body === 'If this wasn’t you, remove it now.', 'key-join banner words');
check(eq(kj.actions, ['Remove…', 'It was me']) && eq(kj.route, ['sync', 'remove', 'd9']), 'key-join banner actions');
check(M.banner(st('up_to_date'), conflict) === null, 'a conflict never posts a banner');
check(M.banner(null, quota).source === 'Luma Connect', 'the banner names Luma Connect');

// The approval card.
const request = {id: 'j1', device: 'd2', name: 'ThinkPad', class: 'computer', code: '418207', created_at: 1};
const card = M.card(request);
check(card.title === 'Approve ThinkPad?' && card.sub === 'Computer · wants to sync with your devices', 'card title');
check(card.body === 'Only approve if the ThinkPad shows this code. It will get your passwords, apps and settings.', 'card body');
check(eq(card.code, ['418', '207']), 'the code in two groups of three');
check(eq(card.buttons, ['Not me', 'Approve']) && card.focus === 0, 'Not me first, and the focus starts on it');
check(M.card({...request, class: 'handheld'}).icon === M.ICON.smartphone, 'a handheld');
check(M.card({...request, class: 'tv'}).icon === M.ICON.tv, 'a TV');
// It stays until answered, and leaves once answered anywhere (the request
// leaves ListJoinRequests). Nothing times out.
let shown = M.cards([], [request]);
check(shown.length === 1, 'a request raises a card');
shown = M.cards(shown, [request]);
check(shown.length === 1, 'it stays while unanswered');
check(M.cards(shown, []).length === 0, 'answered on another device: it leaves');
check(M.cards([], [{...request, tampered: true}]).length === 0, 'a tampered request raises no card');
// B3: the card comes before its code; Approve waits for it. B2: a held request has no card.
const early = M.card({...request, code: null});
check(early.early && early.code.length === 0 && /appears here in a moment/.test(early.body) && early.waiting === 'Waiting for its code',
    'before its code: the words say so and the code waits');
check(!M.card(request).early, 'with its code: the approval card');
check(M.cards([], [{...request, held: true}]).length === 0, 'a held request raises no card');
// S1: a replaced recovery key is said in the island until the new words are kept.
const fresh = {state: 'attention', enabled: true, attention: {reason: 'new_recovery_key', at: 1}};
check(M.kind(fresh) === 'newkey' && M.cell(fresh).visible, 'a new recovery key shows the cell');
const pop = M.popover(fresh, 1);
check(pop.title === 'New recovery key' && pop.sub === 'Your old words stopped working' && pop.action === 'Show new key…' && pop.tone === M.TONE.warn,
    'the new key popover');
check(JSON.stringify(M.actionTarget('Show new key…')) === JSON.stringify({route: ['sync', 'newkey']}), 'Show new key… opens Settings');

// Restoring.
check(M.appIdForDesktop('org.gnome.TextEditor.desktop') === 'org.gnome.TextEditor', 'desktop id');
const t = M.tile({app: 'kiln', state: 'restoring', progress: 0.44});
check(t && t.opacity === 140 && t.saturation === 0.5 && t.ring === 0.44 && t.caption === 'Restoring…', 'the tile');
check(eq(t.launch, ['luma-installer', '--restore', 'kiln']), 'opening it shows its row in Valet');
check(M.tile({app: 'kiln', state: 'ready'}) === null, 'a ready app launches');
check(M.tile({app: 'x', state: 'unavailable'}) === null, 'an unavailable app has no tile');
check(M.openValet([], [{app: 'kiln', state: 'installing'}]), 'Valet opens when apps start arriving');
check(!M.openValet([{app: 'kiln', state: 'installing'}], [{app: 'kiln', state: 'restoring'}]), 'only once');

// St reads a negative margin as a huge width (the phone page laid out at 0 px): none in this patch's styles.
const cssPath = path.replace(/js\/ui\/lumaConnectSyncModel\.js$/, 'data/theme/luma-shelf.css');
const css = gjs ? new TextDecoder().decode((await import('gi://GLib')).default.file_get_contents(cssPath)[1])
    : (await import('node:fs')).readFileSync(cssPath, 'utf8');
const block = css.slice(css.indexOf('── Luma Connect Sync (design-center'));
check(block.length > 100 && !/margin[^;{}]*:\s*[^;{}]*-\d/.test(block), 'no negative margins in the Connect Sync styles');

// Words never used (HANDOFF-UI.md).
const words = JSON.stringify([syncing, paused, c, q, r, card, M.popover(st('up_to_date'), NOW)]);
for (const banned of ['ASK', 'envelope', 'zone', 'HPKE', 'end-to-end', 'seed phrase', 'mnemonic'])
    check(!words.includes(banned), `never "${banned}"`);

print(`connect-sync-policy: ${passed} checks passed`);
