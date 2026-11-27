// SPDX-License-Identifier: Apache-2.0
// gnome-shell --automation-script (run.sh with DRIVER=depot): apps the other
// device has and this one doesn't take their name and icon from Depot's
// catalogue and media cache, for the host Depot and the Depot Flatpak.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {appGicon, appName, depotMediaPath} from 'resource:///org/gnome/shell/ui/SunoContinue.js';

const out = GLib.getenv('SUNO_BANNER_OUT');
const home = GLib.get_home_dir();
const flatpakRoot = `${home}/.var/app/org.projectSuno.Depot/cache/Suno-depot/catalogue-v1`;
const hostRoot = `${GLib.get_user_cache_dir()}/Suno-depot/catalogue-v1`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const lines = [];
const check = (name, ok, detail = '') => lines.push(`${name}: ${ok ? 'PASS' : 'FAIL'}${detail ? `, ${detail}` : ''}`);

function write(path, data, mtime = null) {
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o755);
    GLib.file_set_contents(path, data);
    if (mtime !== null)
        Gio.File.new_for_path(path).set_attribute_uint64('time::modified', mtime, 0, null);
}

const iconPath = gicon => gicon instanceof Gio.FileIcon ? gicon.get_file().get_path() : null;

function main() {
    try {
        const flatpakIcon = 'https://dl.simplyluma.com/media/listings/gone/icon-256-0123456789abcdef.png';
        const hostIcon = 'https://media.simplyluma.com/depot/org.example.Host/icon.png';
        write(`${flatpakRoot}/catalogue.json`, JSON.stringify({apps: [
            {id: 'com.example.Gone', name: 'Gone App', icon: flatpakIcon, kind: 'app'},
            {id: 'com.example.Look', name: 'A Look', icon: flatpakIcon, kind: 'look'},
            {id: 'com.example.Elsewhere', name: 'Elsewhere', icon: 'https://example.org/icon.png'},
            {id: 'com.example.Missing', name: 'Missing Picture',
                icon: {url: 'https://dl.simplyluma.com/media/listings/missing/icon-256-ffffffffffffffff.png'}},
        ]}), 1700000000);
        write(`${hostRoot}/catalogue.json`, JSON.stringify({items: [
            {id: 'org.example.Host', name: 'Host App', icon: {url: hostIcon}},
            {id: 'com.example.Gone', name: 'Host Copy', icon: hostIcon},
        ]}), 1700000000);
        write(depotMediaPath(flatpakIcon, flatpakRoot), PNG);
        write(depotMediaPath(hostIcon, hostRoot), PNG);

        check('Flatpak Depot name', appName('com.example.Gone.desktop') === 'Gone App', appName('com.example.Gone.desktop'));
        const gone = iconPath(appGicon('com.example.Gone.desktop'));
        check('Flatpak Depot icon', gone === depotMediaPath(flatpakIcon, flatpakRoot), gone ?? 'no file icon');
        check('media path matches Depot', depotMediaPath(flatpakIcon, flatpakRoot) ===
            `${flatpakRoot}/media/${GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, flatpakIcon, -1).slice(0, 32)}/icon-256-0123456789abcdef.png`);
        check('host Depot, items form', appName('org.example.Host.desktop') === 'Host App' &&
            iconPath(appGicon('org.example.Host.desktop')) === depotMediaPath(hostIcon, hostRoot));
        check('Looks and Tweaks are not apps', appName('com.example.Look.desktop') === 'Look', appName('com.example.Look.desktop'));
        check('icons only from Suno hosts', iconPath(appGicon('com.example.Elsewhere.desktop')) === null);
        check('picture not kept yet: placeholder', iconPath(appGicon('com.example.Missing.desktop')) === null &&
            appName('com.example.Missing.desktop') === 'Missing Picture');

        write(`${flatpakRoot}/catalogue.json`, JSON.stringify({apps: [
            {id: 'com.example.Gone', name: 'Gone App 2', icon: flatpakIcon}]}), 1700000100);
        check('newer catalogue read again', appName('com.example.Gone.desktop') === 'Gone App 2', appName('com.example.Gone.desktop'));
    } catch (e) {
        lines.push(`error: FAIL, ${e.stack}`);
    }
    const failed = lines.some(l => l.includes('FAIL'));
    GLib.file_set_contents(`${out}/depot.txt`, `${lines.join('\n')}\n${failed ? 'DEPOT-FAIL' : 'DEPOT-PASS'}\n`);
    global.context.terminate();
}

export function init() {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
        main();
        return GLib.SOURCE_REMOVE;
    });
}

export async function run() {
    await new Promise(() => {});
}
