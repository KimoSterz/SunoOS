#!/usr/bin/env node
// lumaui-conform, pixel mode: the spec PNG of each state against an app PNG the caller
// supplies (Viola, the Shell: anything that is not a GTK widget tree). No element matching.
//   node pixel_compare.js --scenario scenarios/<app>.json --dir DIR --pngs PNGDIR
// PNGDIR holds <state>.png (or <variant>/<state>.png, e.g. dark/ light-phone/). The app PNG is
// scaled to the spec window's size when it differs (and the report says so). Writes
// DIR/pixel-<state>.png (spec | app | heat), DIR/heat-<state>.png, DIR/REPORT.md and
// DIR/pixel.json; exits 0 when every state passes.
// A state passes when its mean ΔE (CIE76, over the whole window) is at most max_mean (3) and
// at most max_over10 (2%) of its pixels differ by more than ΔE 10; scenario.pixel overrides both.
// Region scores: the scenario's groups (spec selectors) and a 4×3 grid of the window.
// Accepted deviations with "mode": "pixel" (accepted-deviations.json, or --deviations) apply
// to the states their "states" pattern names in the "apps" listed: "scope" (a scenario group,
// grown by "pad" px) limits the verdict to those pixels; "max_mean" with "waive_over10" judges
// the state by its mean ΔE alone; "variants" limits a deviation to those variants
// (dark-phone, ...). Each applied deviation is named in the report.
// Fills: scenario.pixel.fills names a group whose boxes are fills (surfaces, wells, chips,
// icons, buttons); "fill heat" is the share of their pixels over ΔE 10, leaving out text
// (each spec text box grown by 2 px) and a 2 px rim at each fill box's edge. With
// scenario.pixel.max_fill_over10 set, a state passes only with fill heat at or under it.
// Under a scope deviation, only fill pixels inside the scope count.
// scenario.pixel.exclude_groups names groups whose boxes are left out of every score (image
// content such as artwork, which measures scaling rather than design), 1 px beyond each box;
// the heat map greys them.
// An accepted deviation's "fill_exclude" names groups whose pixels the fill-heat check skips
// (they still count toward the mean): canonical kit controls drawn by the real toolkit.
// scenario.pixel.glyphs_as_text: icon glyphs (Lucide strokes) count as text: left out of fill heat.
// scenario.pixel.text_pad (default 2): how far beyond each text box text pixels reach, for a
// surface whose type metrics are accepted as built (the shell's banner).
// scenario.pixel.material: [{group, edge}] translucent material inside those boxes is left out of
// every score, except where text is (a shell button's fill). Its edge ring (edge px) is material too,
// so it is judged by geometry alone: at most pixel.max_edge_over10 (default 5%) over ΔE 10.
// An accepted deviation's max_edge_over10 raises that limit for its states (a control whose
// width follows its label's advance).
// {group, edge, keep}: a group named by keep (art on that surface, a tile) stays scored inside it.
// With a surface material (keep set), an edge pixel is judged by what it is in each image: which
// material it shows (the nearest of that image's commonest colours in each material, the surface or
// a button's fill, within ΔE 20) or none. An edge pixel that differs by ΔE 10 is hot unless both images show the
// same material there; so a translucent material's own colour never reads as a misplaced edge. Inside kept art, a pixel that
// is the surface in both images (a tile's round corners) is material too.
// scenario.pixel.fill_rim (default 2): the rim at each fill box's edge the fill check leaves to edges.
// scenario.pixel.mean_without_text: the verdict's mean leaves out text (and glyphs, with the above);
// the report gives both means.
// A spec captured at a device scale (scenario spec.scale) has its boxes, the 2 px text growth and
// rims and a scope's pad scaled to the PNG.
const fs = require('fs'), path = require('path');
const { chromium } = require('./lib/playwright');

const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i < 0 ? null : args[i + 1]; };
const scenario = JSON.parse(fs.readFileSync(opt('scenario'), 'utf8')), dir = opt('dir'), pngs = opt('pngs');
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'spec-meta.json'), 'utf8'));
const variant = `${meta.theme}${meta.phone ? '-phone' : ''}`;
const limits = Object.assign({ max_mean: 3, max_over10: 0.02, exclude_groups: [] }, scenario.pixel || {});
const devFile = opt('deviations') || path.join(__dirname, 'accepted-deviations.json');
const deviations = (fs.existsSync(devFile) ? JSON.parse(fs.readFileSync(devFile, 'utf8')).deviations || [] : [])
  .filter(d => d.mode === 'pixel' && (!d.apps || d.apps.includes(scenario.app)) && (!d.variants || d.variants.includes(variant)));
const appPng = st => [path.join(pngs, variant, `${st}.png`), path.join(pngs, `${st}.png`)].find(f => fs.existsSync(f));
const data = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const browser = await chromium.launch(), page = await browser.newPage();
  const rows = [], out = [];
  for (const st of meta.states.map(s => s.name)) {
    const sp = path.join(dir, `spec-${st}.png`), ap = appPng(st);
    if (!ap) { rows.push({ state: st, missing: true }); continue; }
    const spec = JSON.parse(fs.readFileSync(path.join(dir, `spec-${st}.json`), 'utf8'));
    const k = +(scenario.spec.scale || 1);
    if (k !== 1) {
      const sc = b => ({ ...b, x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k });
      spec.groups = (spec.groups || []).map(g => ({ ...g, boxes: g.boxes.map(sc) }));
      spec.texts = (spec.texts || []).map(t => (t.box ? { ...t, box: sc(t.box) } : t));
      spec.icons = (spec.icons || []).map(t => (t.box ? { ...t, box: sc(t.box) } : t));
    }
    if (scenario.pixel?.glyphs_as_text) spec.texts = [...(spec.texts || []), ...(spec.icons || []).filter(i => i.box)];
    const applied = deviations.filter(d => new RegExp(d.states || '.').test(st));
    const scopeDev = applied.find(d => d.scope);
    if (scopeDev) {
      const grp = (spec.groups || []).find(g => g.name === scopeDev.scope), pad = scopeDev.pad || 0;
      spec.groups = [...(spec.groups || []), { name: '@scope', boxes: (grp ? grp.boxes : []).map(b => ({ x: b.x - pad * k, y: b.y - pad * k, w: b.w + 2 * pad * k, h: b.h + 2 * pad * k })) }];
    }
    const fillGroup = scenario.pixel?.fills ? (spec.groups || []).find(g => g.name === scenario.pixel.fills) : null;
    const noFill = applied.flatMap(d => d.fill_exclude || [])
      .flatMap(n => ((spec.groups || []).find(g => g.name === n) || { boxes: [] }).boxes);
    const textBoxes = (spec.texts || []).map(t => t.box).filter(Boolean);
    const scopeBoxes = scopeDev ? (spec.groups.find(g => g.name === '@scope') || { boxes: [] }).boxes : null;
    const r = await page.evaluate(async ({ a, b, groups, fills, texts, scope, excludeGroups, m, rim, noFill, material }) => {
      const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]); const W = ia.width, H = ia.height;
      const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      const ca = cv(W, H), cb = cv(W, H), xa = ca.getContext('2d', { willReadFrequently: true }), xb = cb.getContext('2d', { willReadFrequently: true });
      xa.drawImage(ia, 0, 0); xb.fillStyle = '#000'; xb.fillRect(0, 0, W, H); xb.drawImage(ib, 0, 0, W, H);
      const A = xa.getImageData(0, 0, W, H).data, Bd = xb.getImageData(0, 0, W, H).data;
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }, g = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
      const LAB = (r, gg, bb) => { const R = lin(r), G = lin(gg), Bb = lin(bb); const X = (R * 0.4124 + G * 0.3576 + Bb * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + Bb * 0.0722, Z = (R * 0.0193 + G * 0.1192 + Bb * 0.9505) / 1.08883; return [116 * g(Y) - 16, 500 * (g(X) - g(Y)), 200 * (g(Y) - g(Z))]; };
      // The material colours of each image: the commonest colour inside each material group's boxes
      // (a surface, a button's fill). With a keep-surface, edge pixels are judged by which of them they are.
      const surf = material.find(mt => mt.keep && !mt.ring);
      const modalOf = (D, name) => { const n = new Map(); let best = -1, most = 0;
        for (const gr of groups.filter(g => g.name === name)) for (const bx of gr.boxes)
          for (let y = Math.max(0, Math.floor(bx.y)); y < Math.min(H, bx.y + bx.h); y++) for (let x = Math.max(0, Math.floor(bx.x)); x < Math.min(W, bx.x + bx.w); x++) {
            const i = (y * W + x) * 4, key = (D[i] >> 2) << 12 | (D[i + 1] >> 2) << 6 | (D[i + 2] >> 2), c = (n.get(key) || 0) + 1; n.set(key, c); if (c > most) { most = c; best = i; } }
        return best < 0 ? null : LAB(D[best], D[best + 1], D[best + 2]); };
      const near = (l, s) => Math.hypot(l[0] - s[0], l[1] - s[1], l[2] - s[2]) <= 8;
      const sa = surf ? modalOf(A, surf.group) : null, sb = surf ? modalOf(Bd, surf.group) : null;
      const kinds = surf ? material.filter(mt => !mt.ring).map(mt => [modalOf(A, mt.group), modalOf(Bd, mt.group)]).filter(([x, y]) => x && y) : [];
      // The nearest material (a pixel on an anti-aliased border between two takes the nearer one), none past ΔE 20.
      const kindOf = (l, side) => { let best = -1, d = 20; kinds.forEach((pair, n) => { const e = Math.hypot(l[0] - pair[side][0], l[1] - pair[side][1], l[2] - pair[side][2]); if (e <= d) { d = e; best = n; } }); return best; };
      const skip = new Uint8Array(W * H);
      for (const gr of groups.filter(gr => excludeGroups.includes(gr.name))) for (const bx of gr.boxes)
        // 1 px beyond the box: the image's own edge pixels are resampled too.
        for (let y = Math.max(0, Math.floor(bx.y) - 1); y < Math.min(H, Math.ceil(bx.y + bx.h) + 1); y++)
          for (let x = Math.max(0, Math.floor(bx.x) - 1); x < Math.min(W, Math.ceil(bx.x + bx.w) + 1); x++) skip[y * W + x] = 1;
      const edge = new Uint8Array(W * H);
      // A ring ({group, ring}): the material just outside those boxes (a badge's dark ring) is left out,
      // and with ring_radius (the box's own corner) so is the ring that shows inside its rounded corners.
      const outsideCorner = (bx, x, y, r) => { const cx = Math.min(Math.max(x + 0.5, bx.x + r), bx.x + bx.w - r), cy = Math.min(Math.max(y + 0.5, bx.y + r), bx.y + bx.h - r);
        return Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r - 0.5; };
      for (const mt of material.filter(mt => mt.ring)) for (const gr of groups.filter(gr => gr.name === mt.group)) for (const bx of gr.boxes)
        for (let y = Math.max(0, Math.floor(bx.y - mt.ring)); y < Math.min(H, bx.y + bx.h + mt.ring); y++)
          for (let x = Math.max(0, Math.floor(bx.x - mt.ring)); x < Math.min(W, bx.x + bx.w + mt.ring); x++)
            // the ring's anti-aliased inner pixel (1 px, at the scale) belongs to the ring too
            if (!(y >= bx.y + mt.inner && y < bx.y + bx.h - mt.inner && x >= bx.x + mt.inner && x < bx.x + bx.w - mt.inner) || (mt.ringRadius && outsideCorner(bx, x, y, mt.ringRadius))) skip[y * W + x] = 1;
      for (const mt of material.filter(mt => !mt.ring)) for (const gr of groups.filter(gr => gr.name === mt.group)) for (const bx of gr.boxes) {
        const kept = mt.keep ? groups.filter(g => g.name === mt.keep).flatMap(g => g.boxes) : [];
        for (let y = Math.max(0, Math.floor(bx.y - mt.edge)); y < Math.min(H, bx.y + bx.h + mt.edge); y++)
          for (let x = Math.max(0, Math.floor(bx.x - mt.edge)); x < Math.min(W, bx.x + bx.w + mt.edge); x++) {
            if (texts.some(t => x >= t.x - m && x < t.x + t.w + m && y >= t.y - m && y < t.y + t.h + m)) continue;
            if (kept.some(k => x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h)) {
              // Art stays scored, except where both images show the surface through it (a tile's round corners).
              const i = (y * W + x) * 4;
              if (!(sa && sb && near(LAB(A[i], A[i + 1], A[i + 2]), sa) && near(LAB(Bd[i], Bd[i + 1], Bd[i + 2]), sb))) continue;
            }
            const inner = y >= bx.y + mt.edge && y < bx.y + bx.h - mt.edge && x >= bx.x + mt.edge && x < bx.x + bx.w - mt.edge;
            if (!inner) edge[y * W + x] = 1;
            skip[y * W + x] = 1;
          }
      }
      const dE = new Float32Array(W * H); let over10 = 0, sum = 0, counted = 0;
      for (let k = 0; k < W * H; k++) { if (skip[k]) continue; const i = k * 4, p = LAB(A[i], A[i + 1], A[i + 2]), q = LAB(Bd[i], Bd[i + 1], Bd[i + 2]);
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); dE[k] = d; sum += d; counted++; if (d > 10) over10++; }
      let edgePx = 0, edgeHot = 0;
      for (let k = 0; k < W * H; k++) { if (!edge[k]) continue; const i = k * 4, p = LAB(A[i], A[i + 1], A[i + 2]), q = LAB(Bd[i], Bd[i + 1], Bd[i + 2]);
        edgePx++;
        if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= 10) continue;
        // A colour difference on a translucent material is no edge when both images show the same material there.
        if (kinds.length) { const ka = kindOf(p, 0), kb = kindOf(q, 1); if (ka >= 0 && ka === kb) continue; }
        edgeHot++; }
      const ch = cv(W, H), xh = ch.getContext('2d'), H2 = xh.createImageData(W, H);
      for (let k = 0; k < W * H; k++) { const i = k * 4, l = (A[i] * 0.3 + A[i + 1] * 0.59 + A[i + 2] * 0.11) * 0.35, t = Math.min(1, Math.max(0, (dE[k] - 3) / 27));
        if (skip[k]) { H2.data[i] = H2.data[i + 1] = H2.data[i + 2] = 96; H2.data[i + 3] = 255; continue; }
        H2.data[i] = l + (255 - l) * t; H2.data[i + 1] = l * (1 - t) + 40 * t; H2.data[i + 2] = l * (1 - t) + 40 * t; H2.data[i + 3] = 255; }
      xh.putImageData(H2, 0, 0);
      const side = cv(W * 3 + 32, H + 28), xs = side.getContext('2d'); xs.fillStyle = '#16171a'; xs.fillRect(0, 0, side.width, side.height);
      xs.font = '600 14px sans-serif'; xs.fillStyle = '#e4e8ea'; ['v70 spec', 'app', 'difference (red = ΔE up to 30)'].forEach((t, i) => xs.fillText(t, i * (W + 16) + 4, 18));
      xs.drawImage(ca, 0, 28); xs.drawImage(cb, W + 16, 28); xs.drawImage(ch, 2 * (W + 16), 28);
      const score = (name, boxes) => { let s = 0, c = 0, o = 0; for (const bx of boxes) for (let y = Math.max(0, Math.floor(bx.y)); y < Math.min(H, bx.y + bx.h); y++) for (let x = Math.max(0, Math.floor(bx.x)); x < Math.min(W, bx.x + bx.w); x++) { if (skip[y * W + x]) continue; const d = dE[y * W + x]; s += d; c++; if (d > 10) o++; }
        return { name, mean: c ? s / c : 0, over10: c ? o / c : 0, px: c }; };
      const regions = groups.filter(gr => gr.boxes.length && !excludeGroups.includes(gr.name)).map(gr => score(gr.name, gr.boxes));
      for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 4; gx++) regions.push(score(`grid ${'top middle bottom'.split(' ')[gy]} ${gx + 1}/4`, [{ x: gx * W / 4, y: gy * H / 3, w: W / 4, h: H / 3 }]));
      let fillPx = 0, fillHot = 0;
      if (fills) {
        const inText = (x, y) => texts.some(t => x >= t.x - m && x < t.x + t.w + m && y >= t.y - m && y < t.y + t.h + m);
        const seen = new Uint8Array(W * H);
        for (const bx of fills) for (let y = Math.max(0, Math.ceil(bx.y + rim)); y < Math.min(H, bx.y + bx.h - rim); y++) for (let x = Math.max(0, Math.ceil(bx.x + rim)); x < Math.min(W, bx.x + bx.w - rim); x++) {
          const k = y * W + x; if (seen[k] || skip[k] || inText(x, y)) continue;
          if (noFill.some(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h)) continue;
          if (scope && !scope.some(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h)) continue; seen[k] = 1; fillPx++; if (dE[k] > 10) fillHot++; }
      }
      return { W, H, appW: ib.width, appH: ib.height, mean: counted ? sum / counted : 0, over10: counted ? over10 / counted : 0, excluded: W * H - counted, regions,
        fill_over10: fills ? (fillPx ? fillHot / fillPx : 0) : null, fill_px: fillPx,
        edge_over10: edgePx ? edgeHot / edgePx : null, edge_px: edgePx,
        ...(() => { // the mean without text (and glyphs), over the scope when there is one
          const inT = (x, y) => texts.some(t => x >= t.x - m && x < t.x + t.w + m && y >= t.y - m && y < t.y + t.h + m);
          let s2 = 0, c2 = 0;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (skip[y * W + x]) continue;
            if (scope && !scope.some(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h)) continue;
            if (inT(x, y)) continue; s2 += dE[y * W + x]; c2++; }
          return { mean_without_text: c2 ? s2 / c2 : 0 }; })(),
        heat: ch.toDataURL('image/png'), side: side.toDataURL('image/png') };
    }, { a: data(sp), b: data(ap), groups: spec.groups || [], fills: fillGroup ? fillGroup.boxes : null, texts: textBoxes, scope: scopeBoxes, excludeGroups: limits.exclude_groups, m: (scenario.pixel?.text_pad ?? 2) * k, rim: (scenario.pixel?.fill_rim ?? 2) * k, noFill,
      material: (scenario.pixel?.material || []).map(mt => ({ group: mt.group, edge: (mt.edge ?? 2) * k, ring: (mt.ring || 0) * k, inner: (mt.ring ? (mt.inner ?? 1) : 0) * k, ringRadius: (mt.ring_radius || 0) * k, keep: mt.keep || null })) });
    fs.writeFileSync(path.join(dir, `heat-${st}.png`), Buffer.from(r.heat.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(dir, `pixel-${st}.png`), Buffer.from(r.side.split(',')[1], 'base64'));
    delete r.heat; delete r.side;
    r.state = st; r.app = path.relative(pngs, ap);
    const scoped = scopeDev && r.regions.find(g => g.name === '@scope');
    if (scoped) { r.window_mean = r.mean; r.window_over10 = r.over10; r.mean = scoped.mean; r.over10 = scoped.over10; }
    const meanLimit = Math.min(limits.max_mean, ...applied.filter(d => d.max_mean != null).map(d => d.max_mean));
    const waive = applied.some(d => d.waive_over10);
    r.deviations = applied.map(d => d.id);
    const fillLimit = Math.max(limits.max_fill_over10 ?? 0, ...applied.filter(d => d.max_fill_over10 != null).map(d => d.max_fill_over10));
    const edgeLimit = Math.max(limits.max_edge_over10 ?? 0.05, ...applied.filter(d => d.max_edge_over10 != null).map(d => d.max_edge_over10));
    const edgeOk = r.edge_over10 == null || r.edge_over10 <= edgeLimit;
    const fillOk = limits.max_fill_over10 == null || r.fill_over10 == null || r.fill_over10 <= fillLimit;
    const judged = scenario.pixel?.mean_without_text ? r.mean_without_text : r.mean;
    r.pass = (!scopeDev || (scoped && scoped.px > 0)) && judged <= meanLimit && (waive || r.over10 <= limits.max_over10) && fillOk && edgeOk;
    rows.push(r);
  }
  await browser.close();
  const pass = rows.length > 0 && rows.every(r => r.pass);
  const pct = v => (v * 100).toFixed(2) + '%', f1 = v => v.toFixed(2);
  out.push(`# ${scenario.title || scenario.app} (pixel mode, ${variant}): ${pass ? 'PASS' : 'FAIL'}`, '',
    `Spec PNG against the app PNGs in \`${pngs}\`. A state passes at mean ΔE ≤ ${limits.max_mean} and ≤ ${pct(limits.max_over10)} of pixels over ΔE 10.` +
      (limits.exclude_groups.length ? ` Left out of every score (grey in the heat map): ${limits.exclude_groups.join(', ')}.` : ''), '',
    '| state | app PNG | mean ΔE | pixels over ΔE 10 | verdict |', '|---|---|---|---|---|');
  for (const r of rows) out.push(r.missing ? `| ${r.state} | missing (${r.state}.png) | | | FAIL |`
    : `| ${r.state} | ${r.app}${r.appW !== r.W || r.appH !== r.H ? ` (${r.appW}×${r.appH} scaled to ${r.W}×${r.H})` : ''} | ${f1(r.mean)}${r.mean_without_text != null ? ` (${f1(r.mean_without_text)} without text)` : ''} | ${pct(r.over10)}${r.fill_over10 != null ? ` (fills ${pct(r.fill_over10)})` : ''} | ${r.pass ? 'PASS' : 'FAIL'}${r.deviations.length ? ` (accepted: ${r.deviations.join(', ')})` : ''} |`);
  for (const r of rows.filter(x => !x.missing)) {
    out.push('', `## ${r.state}`, '', `![side by side](pixel-${r.state}.png)`, '', '| region | mean ΔE | over ΔE 10 |', '|---|---|---|');
    for (const g of [...r.regions].sort((a, b) => b.mean - a.mean)) out.push(`| ${g.name} | ${f1(g.mean)} | ${pct(g.over10)} |`);
  }
  fs.writeFileSync(path.join(dir, 'REPORT.md'), out.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'pixel.json'), JSON.stringify({ variant, limits, pass, states: rows }, null, 1));
  console.log(`${pass ? 'PASS' : 'FAIL'} (pixel): ${rows.map(r => r.missing ? `${r.state} missing` : `${r.state} ΔE ${f1(r.mean)} (${f1(r.mean_without_text)} without text), ${pct(r.over10)} over 10${r.fill_over10 != null ? `, fills ${pct(r.fill_over10)}` : ''}${r.edge_over10 != null ? `, edges ${pct(r.edge_over10)}` : ''}`).join('; ')}. Report: ${path.join(dir, 'REPORT.md')}`);
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e.message || e); process.exit(3); });
