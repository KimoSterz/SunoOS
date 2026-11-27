// SPDX-License-Identifier: Apache-2.0
import {statusGlyph} from '../../../src/Suno-shell-presentation/layout.js';
function assert(value, message) { if (!value) throw Error(message); }
const cases = {
    'network-wireless-signal-excellent-symbolic': 'SunoUI-wifi-symbolic',
    'network-wireless-signal-good-symbolic': 'SunoUI-wifi-high-symbolic',
    'network-wireless-signal-weak-symbolic': 'Suno-status-wifi-zero-symbolic',
    'network-wireless-disabled-symbolic': 'Suno-wifi-off-symbolic',
    'network-cellular-signal-ok-symbolic': 'Suno-status-signal-medium-symbolic',
    'network-cellular-offline-symbolic': 'Suno-status-signal-zero-symbolic',
    'audio-volume-muted-symbolic': 'SunoUI-volume-x-symbolic',
    'audio-volume-medium-symbolic': 'SunoUI-volume-1-symbolic',
    'battery-level-90-symbolic': 'Suno-status-battery-full-symbolic',
    'battery-level-50-symbolic': 'SunoUI-battery-medium-symbolic',
    'battery-level-10-symbolic': 'Suno-status-battery-warning-symbolic',
    'battery-level-40-charging-symbolic': 'Suno-status-battery-charging-symbolic',
    'battery-level-100-charged-symbolic': 'Suno-status-battery-full-symbolic',
    'org.gnome.Settings-accessibility-symbolic': 'SunoUI-accessibility-symbolic',
    'accessibility-menu-symbolic': 'SunoUI-accessibility-symbolic',
    'airplane-mode-symbolic': 'SunoUI-plane-symbolic',
};
for (const [name, glyph] of Object.entries(cases))
    assert(statusGlyph(name) === glyph, `${name} must draw as ${glyph}, got ${statusGlyph(name)}`);
assert(statusGlyph('SunoUI-wifi-symbolic') === null, 'a SunoUI glyph is left as it is');
assert(statusGlyph('some-unknown-symbolic') === null, 'an icon without a glyph is left as it is');
print('status glyphs ok');
