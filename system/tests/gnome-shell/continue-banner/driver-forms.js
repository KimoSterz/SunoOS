// SPDX-License-Identifier: Apache-2.0
// gnome-shell --automation-script for Continue's phone and TV forms (run.sh
// with POSTURE=phone|tv; design-center mockups/continue offer.html
// ?posture=phone and the target tv-home). Phone: the lip card offer, the
// lip card while the app opens, and the result list as a bottom drawer.
// TV: the home's hero carrying what played on the ThinkPad, focus on
// Continue. Each state is captured with its parts' geometry.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ContinueBanner} from 'resource:///org/gnome/shell/ui/lumaContinue.js';

Gio._promisify(Shell.Screenshot.prototype, 'screenshot_area');

const out = GLib.getenv('LUMA_BANNER_OUT');
const mode = GLib.getenv('LUMA_BANNER_MODE') || 'dark';
const posture = GLib.getenv('LUMA_BANNER_POSTURE') || 'phone';
// Files are named as the references: tablet-landscape-*, tablet-portrait-*.
const label = () => posture !== 'tablet' ? posture
    : `tablet-${global.stage.height > global.stage.width ? 'portrait' : 'landscape'}`;
const records = [];
const sleep = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));

const NOTES = {id: 'org.projectluma.Notes.desktop', windows: 1, name: 'Notes', icon: 'org.projectluma.Notes'};
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

async function shoot(name, actor, pad = 30) {
    const [x, y] = actor ? actor.get_transformed_position() : [0, 0];
    const [w, h] = actor ? actor.get_transformed_size() : [0, 0];
    records.push({name, mode, posture, box: {x, y, width: w, height: h}, parts: actor ? measure(actor) : []});
    if (!actor || w <= 0)
        return;
    const left = Math.max(0, x - pad), top = Math.max(0, y - pad);
    const file = Gio.File.new_for_path(`${out}/${label()}-${name}-${mode}.png`);
    const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
    await new Shell.Screenshot().screenshot_area(left, top,
        Math.min(global.stage.width - left, w + 2 * pad), Math.min(global.stage.height - top, h + 2 * pad), stream);
    stream.close(null);
}

function cardOf(banner) {
    const find = actor => {
        if (actor.notification && actor.notification === banner._notification && actor.visible)
            return actor;
        for (const child of actor.get_children()) {
            const found = find(child);
            if (found)
                return found;
        }
        return null;
    };
    return find(global.stage)?.get_parent() ?? null;
}

// The pixel pass's backdrop: only the card and the desktop background show
// (no home widgets, no status bar), over the plain #0f1218. Returns undo.
function isolate(card) {
    const keep = new Set();
    for (const end of [card, Main.layoutManager._backgroundGroup]) {
        for (let a = end; a; a = a.get_parent())
            keep.add(a);
    }
    const hidden = [];
    const walk = actor => {
        for (const child of actor.get_children()) {
            if (child === card || child === Main.layoutManager._backgroundGroup)
                continue;
            if (keep.has(child)) {
                walk(child);
            } else if (child.visible) {
                child.hide();
                hidden.push(child);
            }
        }
    };
    walk(global.stage);
    return () => hidden.forEach(actor => actor.show());
}

async function isolated(name, card) {
    const undo = isolate(card);
    await sleep(300);
    await shoot(name, card);
    undo();
}

async function phone() {
    const p = Main.presentation;
    const form = posture === 'tablet' ? 'tablet' : 'mobile';
    p._snapshot({...(p._state ?? {}), presentation: {...(p._state?.presentation ?? {}), effective: form, selected: form}});
    await sleep(1500);
    const banner = new ContinueBanner();
    banner.offerApp({device: 'ThinkPad', app: NOTES, document: 'Packing list', others: 7,
        taken: Date.now() / 1000 - 240}, () => {}, () => {});
    await sleep(900);
    await isolated('offer', cardOf(banner));
    banner.restoringApp({device: 'ThinkPad', app: NOTES, document: 'Packing list'});
    banner._started = GLib.get_monotonic_time() - 14 * 1000 * 1000;   // the reference's bar at 70 %
    await sleep(900);
    await isolated('restoring', cardOf(banner));
    banner.close();
    await sleep(1200);
    banner.result({result: RESULT, apps: APPS, device: 'ThinkPad', at: Date.now() / 1000 - 240});
    await sleep(600);
    banner._notification.lumaContent.actions.find(a => a.label === 'Show')?.callback();
    await sleep(900);
    await shoot('list', banner._drawer?.actor ?? null, 0);
    records.push({presentation: p.mode});
    banner.close();
}

async function tv() {
    const p = Main.presentation;
    p._snapshot({...(p._state ?? {}), posture: {effective: 'tv', selected: 'tv'}});
    await sleep(2500);
    // The reference's item (mockups/luma-tv.html coast), with its artwork when ART is given.
    const artFile = GLib.getenv('LUMA_BANNER_ART');
    const art = artFile ? GLib.base64_encode(GLib.file_get_contents(artFile)[1]) : null;
    const shown = p._tv.setContinue({id: 'tp:1', name: 'ThinkPad', tv: true, media: {
        app: 'org.projectluma.Tide.desktop', name: 'Tide', item: 'Coastline', subtitle: 'Episode 3 · The north shore',
        kind: 'video', position: 2573, length: 4020, art}}, () => {});
    p._tv.showHome('home');
    await sleep(1500);
    records.push({shown, focus: p._tv._focus, apps: p._tv._apps.map(a => a.id),
        glyphs: p._tv._hero.buttons.map(({glyph}) => ({name: glyph.icon_name, gicon: String(glyph.gicon), size: glyph.icon_size,
            style: glyph.style, width: glyph.width, pref: glyph.get_preferred_width(-1),
            node: (n => ({minw: n.get_min_width(), pad: n.get_horizontal_padding(), len: n.get_length('icon-size'),
                cls: glyph.style_class, pseudo: glyph.pseudo_class}))(glyph.get_theme_node()),
            scale: St.ThemeContext.get_for_stage(global.stage).scale_factor, u: p._tv._u,
            kids: glyph.get_children().map(c => [c.constructor.name, c.width, c.height])}))});
    await shoot('home', p._tv._home, 0);
    await shoot('hero', p._tv._hero.actor, 0);
}

async function main() {
    await sleep(2000);
    try {
        if (posture === 'tv')
            await tv();
        else
            await phone();
    } catch (e) {
        records.push({error: String(e.stack)});
    }
    GLib.file_set_contents(`${out}/${label()}-${mode}.json`, JSON.stringify(records, null, 1));
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
