// SPDX-License-Identifier: GPL-2.0-or-later
// The folder offer and the command-line review (0383): the standard banner's
// words, nothing offered that can't be granted, one offer per app and folder
// at a time, Allow / Not now with no default and dismissing as Not now, and a
// review that opens Valet's sheet.
// Run: gjs -m app-permissions-policy.js js/ui/SunoAppPermissionsModel.js \
//   js/ui/SunoAppPermissions.js js/ui/SunoPermissionOffer.js js/ui/messageList.js
// (node app-permissions-policy.js ... works too).
const gjs = typeof globalThis.ARGV !== 'undefined';
const args = gjs ? globalThis.ARGV : process.argv.slice(2);
const GLib = gjs ? (await import('gi://GLib')).default : null;
const fs = gjs ? null : await import('node:fs');
const read = path => (gjs ? new TextDecoder().decode(GLib.file_get_contents(path)[1])
    : fs.readFileSync(path, 'utf8'));
const print = gjs ? globalThis.print : console.log;

function assert(value, message) {
    if (!value)
        throw new Error(`FAIL: ${message}`);
}

const [modelSource, service, offer, messageList] = args.map(read);
const absolute = gjs ? GLib.canonicalize_filename(args[0], null) : (await import('node:path')).resolve(args[0]);
const Model = await import(`file://${absolute}`);
assert(modelSource.includes('export function offerWords'), 'the model module is the first argument');

const words = Model.offerWords('Tide', 'Music');
assert(words.title === 'Music folder', 'the title is the folder and "folder"');
assert(words.body === 'Let Tide use your Music folder?', 'the body is the question');
assert(words.allow === 'Allow' && words.notNow === 'Not now', 'Allow and Not now');
assert(Model.reviewWords('Kiln').title === 'Kiln installed' && Model.reviewWords('Kiln').action === 'Review',
    '"Kiln installed", with Review');

for (const folder of ['Music', 'Downloads', 'Projects'])
    assert(Model.offerable(folder), `${folder} can be offered`);
for (const folder of ['.ssh', '.local', '..', 'a/b', '', null])
    assert(!Model.offerable(folder), `${folder} is never offered`);
assert(Model.offerKey('a', 'Music') !== Model.offerKey('a', 'Pictures'), 'one offer per app and folder');

// The service decides "once per app per folder, ever"; the Shell answers with AnswerOffer.
assert(/signal_subscribe\(BUS_NAME, BUS_NAME, 'Refused'/.test(service), 'offers follow Refused');
assert(/'AnswerOffer', new GLib.Variant\('\(ssb\)', \[app, folder, allowed\]\)/.test(service),
    'the answer goes back with AnswerOffer');
assert(/this\._offers\.has\(key\)/.test(service), 'an offer showing is not shown twice');
assert(/'Suno-install', '--review', app/.test(service), 'Review opens the sheet in review mode');

// The standard banner: the app's source, the Shell's badge, two plain actions, dismiss = Not now.
assert(/new MessageTray\.Source\(\{\s*title: name,\s*icon: gicon/.test(offer), 'the app is the source');
assert(/notification\.SunoShellBadge = new Gio\.ThemedIcon\(\{name: SETTINGS_ICON\}\)/.test(offer),
    'the Settings icon is the Shell\'s badge');
assert(/addAction\(allow,/.test(offer) && /addAction\(notNow,/.test(offer), 'Allow and Not now are actions');
assert(!/setDefault|isDefault|default: true/.test(offer), 'neither answer is a default');
assert(/reason === MessageTray\.NotificationDestroyedReason\.DISMISSED\)\s*answer\(false\)/.test(offer),
    'dismissing is Not now');
assert(!/ModalDialog|Dialog\(/.test(offer.replace(/TvOfferToast[\s\S]*?\}\);/, '')), 'never a dialog');
assert(/this\._buttons\[1\]\.grab_key_focus\(\)/.test(offer), 'on a TV the remote starts on Not now');
assert(/this\._SunoShellBadge = notification\.SunoShellBadge \?\? null/.test(messageList),
    'the banner reads the Shell\'s badge');
print('app-permissions-policy: ok');
