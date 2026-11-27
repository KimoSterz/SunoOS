// SPDX-License-Identifier: GPL-2.0-or-later
// SunoIconMask (0387): the corner is cut at the actor's corner, in the actor's
// pixels, whatever the offscreen texture's enlargement. The texture is the
// paint volume, which Clutter grows beyond the actor; a mask measured in
// texture coordinates cut a larger corner outside the icon.
// Run: gjs -m icon-mask-policy.js js/ui/iconMask.js
// (node icon-mask-policy.js ... works too).
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

const source = read(args[0]);

// The fragment code this test evaluates, line for line.
const code = source.match(/const ICON_MASK_CODE = `([^`]*)`/)?.[1] ?? '';
const declarations = source.match(/const ICON_MASK_DECLARATIONS = `([^`]*)`/)?.[1] ?? '';
for (const line of [
    'vec2 point = cogl_tex_coord_in[0].st * mask_extent + mask_origin;',
    'float r = radius * min(mask_size.x, mask_size.y);',
    'float cover = Suno_icon_cover(point, mask_size, r, squircle);',
    'if (lit > 0.5) {',
    'cogl_color_out *= cover;',
])
    assert(code.includes(line), `ICON_MASK_CODE has "${line}"`);
for (const line of [
    'uniform float squircle;',
    'uniform float lit;',
    'vec2 edge = min(p, size - p);',
    'vec2 inset = max(vec2(r) - edge, vec2(0.0));',
    'float corner = mix(length(inset), sqrt(sqrt(dot(inset2, inset2))), sq);',
    'return (1.0 - smoothstep(r - 0.5, r + 0.5, corner)) * clamp(min(edge.x, edge.y) + 0.5, 0.0, 1.0);',
])
    assert(declarations.includes(line), `ICON_MASK_DECLARATIONS has "${line}"`);
assert(/class SunoIconMask[\s\S]*?vfunc_paint_target[\s\S]*?setActorMapping\(this, 'mask'\)/.test(source),
    'SunoIconMask maps its texture to actor pixels before painting');
assert(/class SunoRoundedClip[\s\S]*?setActorMapping\(this, 'clip'\)/.test(source),
    'SunoRoundedClip shares the mapping');

// setActorMapping, run against a stand-in effect.
const start = source.indexOf('function setActorMapping(effect, prefix) {');
const end = source.indexOf('\n}\n', start);
assert(start >= 0 && end > start, 'iconMask.js has setActorMapping()');
const setActorMapping = new Function('effect', 'prefix',
    source.slice(source.indexOf('{', start) + 1, end));

function uniforms({size, volume, scale = 1}) {
    const out = {};
    const origin = Math.trunc(Math.ceil(volume.x + volume.size + 0.75) - Math.round(volume.size) - 3);
    const texture = (size - 2 * origin) * scale;
    const effect = {
        actor: {
            width: size, height: size,
            get_resource_scale: () => scale,
            get_paint_volume: () => ({
                get_origin: () => ({x: volume.x, y: volume.x}),
                get_width: () => volume.size, get_height: () => volume.size,
            }),
        },
        get_texture: () => ({get_width: () => texture, get_height: () => texture}),
        get_uniform_location: name => name,
        set_uniform_float: (name, n, values) => {
            out[name] = values;
        },
    };
    assert(setActorMapping(effect, 'mask') === true, 'the mapping is set');
    return {...out, texture};
}

const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
// The fragment code (Suno_icon_cover), one axis pair at a time.
function coverage(u, radius, extent, size, origin, squircle = 0) {
    const point = u.map((v, i) => v * extent[i] + origin[i]);
    const r = radius * Math.min(size[0], size[1]);
    const edge = point.map((p, i) => Math.min(p, size[i] - p));
    const inset = edge.map(e => Math.max(r - e, 0));
    const round = Math.hypot(...inset);
    const quartic = Math.sqrt(Math.sqrt(inset[0] ** 4 + inset[1] ** 4));
    const corner = round + (quartic - round) * squircle;
    return (1 - smoothstep(r - 0.5, r + 0.5, corner)) *
        Math.min(1, Math.max(0, Math.min(...edge) + 0.5));
}

// Coverage per actor pixel, sampling the texture at its texel centres.
function mask(size, radius, volume, squircle = 0) {
    const m = uniforms({size, volume});
    const out = new Map();
    for (let ty = 0; ty < m.texture; ty++) {
        for (let tx = 0; tx < m.texture; tx++) {
            const c = coverage([(tx + 0.5) / m.texture, (ty + 0.5) / m.texture],
                radius, m.mask_extent, m.mask_size, m.mask_origin, squircle);
            out.set(`${tx + m.mask_origin[0]},${ty + m.mask_origin[1]}`, c);
        }
    }
    return out;
}

const SIZE = 34, RADIUS = 10 / 34;
const tight = mask(SIZE, RADIUS, {x: 0, size: SIZE});
const shadowed = mask(SIZE, RADIUS, {x: -1.5, size: SIZE + 3});

// Nothing outside the actor survives, and the middle of the icon is whole.
for (const [key, c] of [...tight, ...shadowed]) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE)
        assert(c === 0, `pixel ${key} outside the actor is cut (${c})`);
}
for (let i = 0; i < SIZE; i++) {
    assert(tight.get(`${i},17`) === 1 && tight.get(`17,${i}`) === 1, `the icon's middle row and column are whole at ${i}`);
}

// The cut is the same in the actor's pixels however far the texture grows.
for (const [key, c] of tight) {
    if (shadowed.has(key))
        assert(Math.abs(shadowed.get(key) - c) < 1e-9, `pixel ${key} is cut the same (${c} vs ${shadowed.get(key)})`);
}

// A 10 px corner on 34: the corner pixel is gone, the arc is symmetric, and
// it reaches the straight edge 10 px in.
assert(tight.get('0,0') === 0, 'the corner pixel is cut');
for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
        const c = tight.get(`${x},${y}`);
        assert(Math.abs(c - tight.get(`${SIZE - 1 - x},${y}`)) < 1e-9 &&
            Math.abs(c - tight.get(`${x},${SIZE - 1 - y}`)) < 1e-9 &&
            Math.abs(c - tight.get(`${y},${x}`)) < 1e-9, `the corners match at ${x},${y}`);
    }
}
assert(tight.get('10,0') === 1 && tight.get('9,0') < 1, 'the top edge is straight from 10 px in');
// The arc's midpoint (45 degrees) sits r(1 - 1/sqrt 2) = 2.93 px in.
assert(tight.get('2,2') < 0.5 && tight.get('3,3') > 0.5, 'the arc crosses the diagonal at 2.9 px');

// The dock's squircle (shelf-2, 30% of 40): fuller than a circle of the same
// radius, the same at every corner, and the corner pixel still cut.
const squircle = mask(40, 0.3, {x: 0, size: 40}, 1);
const circle = mask(40, 0.3, {x: 0, size: 40});
assert(squircle.get('0,0') === 0, 'the squircle cuts the corner pixel');
assert(squircle.get('3,3') > circle.get('3,3') && squircle.get('2,2') >= circle.get('2,2'),
    'the squircle is fuller than the circle along the diagonal');
for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
        const c = squircle.get(`${x},${y}`);
        assert(Math.abs(c - squircle.get(`${39 - x},${39 - y}`)) < 1e-9 &&
            Math.abs(c - squircle.get(`${y},${x}`)) < 1e-9, `the squircle corners match at ${x},${y}`);
    }
}
assert(squircle.get('12,0') === 1 && squircle.get('20,20') === 1, 'the squircle is straight past its radius');

// At display scale 2 the extent is in logical pixels.
const hi = uniforms({size: SIZE, volume: {x: 0, size: SIZE}, scale: 2});
assert(hi.mask_extent[0] === SIZE + 4 && hi.mask_size[0] === SIZE && hi.mask_origin[0] === -2,
    'scale 2 maps to the same logical pixels');

print('icon mask policy: ok');
