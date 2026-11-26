// SPDX-License-Identifier: Apache-2.0
// gnome-shell --automation-script for the Continue banner (run.sh). Every
// state of the design (design-center mockups/continue, offer.html ?state=)
// is shown in the real banner, captured, and measured: the banner and its
// parts, the two choices' widths, the strip's icons and gaps.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import {ContinueBanner} from 'resource:///org/gnome/shell/ui/lumaContinue.js';

Gio._promisify(Shell.Screenshot.prototype, 'screenshot_area');

const out = GLib.getenv('LUMA_BANNER_OUT');
const mode = GLib.getenv('LUMA_BANNER_MODE') || 'dark';
const records = [];
const sleep = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));

// The design's snapshot: 11 windows of 8 apps on the ThinkPad, with the names
// and icons the snapshot carries (some apps aren't installed here).
const APPS = [
    ['org.projectluma.Viola.desktop', 'Viola', 'luma-v3-browser'],
    ['org.projectluma.Documents.desktop', 'Documents', 'luma-v3-documents'],
    ['org.projectluma.Notes.desktop', 'Notes', 'org.projectluma.Notes'],
    ['org.projectluma.Tide.desktop', 'Tide', 'org.projectluma.Tide'],
    ['org.gnome.Nautilus.desktop', 'Filer', 'org.gnome.Nautilus'],
    ['org.example.Kiln.desktop', 'Kiln', 'org.projectluma.Photos'],
    ['org.example.RecipeBox.desktop', 'Recipe Box', 'luma-v3-documents'],
    ['org.example.StudioMixer.desktop', 'Studio Mixer', 'luma-v3-music'],
].map(([id, name, icon]) => ({id, windows: 1, name, icon}));
const RESULT = {
    windows: 11, placed: 8, missing: ['org.example.StudioMixer.desktop'], unplaced: ['org.example.Kiln.desktop'],
    installing: ['org.example.RecipeBox.desktop'], progress: {'org.example.RecipeBox.desktop': 62}, failed: [],
    withoutDocuments: [{id: 'org.projectluma.Notes.desktop', document: 'Packing list'}],
    moved: [{id: 'org.projectluma.Viola.desktop', windows: 2}],
};

function measure(actor, depth = 0, list = []) {
    if (!actor?.visible)
        return list;
    const [x, y] = actor.get_transformed_position();
    const [w, h] = actor.get_transformed_size();
    list.push({depth, style: actor.style_class ?? '', type: actor.constructor.name,
        text: actor.text ?? actor.label ?? '', x: Math.round(x), y: Math.round(y),
        width: Math.round(w), height: Math.round(h)});
    for (const child of actor.get_children())
        measure(child, depth + 1, list);
    return list;
}

async function capture(name) {
    await sleep(900);
    // The card the notification is shown in: a desktop card in the message
    // tray's banner bin, or the lip card on a handheld.
    const find = actor => {
        if (actor.notification && actor.notification === globalThis._lumaBanner?._notification && actor.visible)
            return actor;
        for (const child of actor.get_children()) {
            const found = find(child);
            if (found)
                return found;
        }
        return null;
    };
    const bin = Main.messageTray._bannerBin;
    const message = find(global.stage);
    const banner = message?.get_parent() ?? null;
    const [x, y] = banner ? banner.get_transformed_position() : [0, 0];
    const [w, h] = banner ? banner.get_transformed_size() : [0, 0];
    const parts = banner ? measure(banner) : [];
    const tray = Main.messageTray;
    const debug = {cards: tray._cards?.length, queue: tray._notificationQueue?.length, blocked: tray._bannerBlocked,
        state: banner ? null : String(globalThis._lumaBanner?._notification?.lifecycleState),
        presentation: Main.presentation?.mode ?? Main.sessionMode.currentMode, bin: bin.get_n_children(),
        message: Boolean(message)};
    records.push({name, mode, banner: {x, y, width: w, height: h}, parts, debug});
    if (banner && w > 0) {
        const pad = 30;
        const file = Gio.File.new_for_path(`${out}/${name}-${mode}.png`);
        const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        await new Shell.Screenshot().screenshot_area(Math.max(0, x - pad), Math.max(0, y - pad),
            w + 2 * pad, h + 2 * pad, stream);
        stream.close(null);
    }
}

async function main() {
    await sleep(2000);
    const banner = new ContinueBanner();
    globalThis._lumaBanner = banner;
    // The reference's times: run.sh sets TZ so that it is about 16:20 here.
    const now = Date.now() / 1000;
    const [y, m, d] = GLib.DateTime.new_now_local().get_ymd();
    const t1420 = GLib.DateTime.new_local(y, m, d, 14, 20, 0).to_unix();
    const offer = busy => banner.offer({device: 'ThinkPad', windows: 11, apps: APPS, busy, taken: now - 240},
        () => {}, () => {});
    try {
        offer(false);
        await capture('offer');
        offer(true);
        await capture('busy');
        banner.restoring({device: 'ThinkPad', total: 11, onStop: () => {}});
        for (const id of APPS.slice(0, 3).map(a => a.id))
            banner.placed(id);
        banner.placed(APPS[0].id);
        banner.placed(APPS[1].id);
        await capture('restoring');
        banner.result({result: RESULT, apps: APPS, device: 'ThinkPad', at: Date.now() / 1000 - 240});
        await capture('partial');
        banner._notification.lumaContent.actions.find(a => a.label === 'Show')?.callback();
        await capture('list');
        banner.close();
        await sleep(1500);
        banner.result({result: {windows: 11, placed: 10, unplaced: ['org.example.Kiln.desktop'], missing: [], failed: []},
            apps: APPS, local: true, device: '', at: Date.now() / 1000});
        await capture('local');
        banner.close();
        await sleep(1500);
        banner.continued({device: 'Surface', at: t1420});
        await capture('continued');
        banner.close();
        await sleep(1500);
        banner.offer({device: 'Surface', windows: 7, apps: APPS.slice(0, 5),
            continuedAt: t1420, taken: Date.now() / 1000 - 600}, () => {}, () => {});
        await capture('reverse');
        banner.offer({device: 'Fairphone', windows: 1,
            apps: [{id: 'org.projectluma.Messages.desktop', windows: 1, name: 'Messages', icon: 'org.projectluma.Notes'}],
            handheldApp: 'org.projectluma.Messages.desktop'}, () => {}, () => {});
        await capture('handheld');
        banner.close();
        await sleep(1500);
        // Other shell banners on the same component, with their references'
        // copy (app-perms offer, Connect Sync restored and keyjoin), so a change
        // to the shared banner can be checked against them too.
        for (const [name, source, icon, title, body, actions] of [
            ['appperms', 'Tide', 'org.projectluma.Tide', 'Music folder', 'Let Tide use your Music folder?', ['Allow', 'Not now']],
            ['restored', 'Valet', 'io.luma.Valet', 'Your apps are ready', '6 apps from Dell XPS 14 are on this ThinkPad.', ['Show']],
            ['keyjoin', 'Luma Connect', 'org.projectluma.Connect', 'ThinkPad joined with your recovery key',
                'If this wasn’t you, remove it now.', ['Remove…', 'It was me']],
        ]) {
            const src = new MessageTray.Source({title: source, icon: new Gio.ThemedIcon({name: icon}),
                policy: new MessageTray.NotificationGenericPolicy()});
            Main.messageTray.add(src);
            const n = new MessageTray.Notification({source: src, title, body, isTransient: false,
                urgency: MessageTray.Urgency.HIGH});
            for (const label of actions)
                n.addAction(label, () => {});
            globalThis._lumaBanner = {_notification: n};
            src.addNotification(n);
            await capture(name);
            n.destroy();
            await sleep(1500);
        }
    } catch (e) {
        records.push({error: String(e.stack)});
    }
    GLib.file_set_contents(`${out}/banner-${mode}.json`, JSON.stringify(records, null, 1));
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
