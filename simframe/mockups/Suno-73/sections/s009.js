      if (q('#cv-bar [data-cvpinsp]')) { CV.px = ''; cvBarPhone(); return true; }
      const tb = q('[data-cvtab]'); if (tb && q('#cv-bar')) { CV.tab = tb.dataset.cvtab; cvBarPhone(); return true; }
      if (q('[data-cvsel]') && q('#cv-bar')) { setTimeout(() => { CV.px = ''; cvBarPhone(); }); } if (q('[data-cvdo="del"]')) CV.px = ''; }
    if (q('#cv-work') && !q('.supanel, .fbar, .wrzoom')) return true;   // the work area handles its own pointer
    if (!q('#cv-pop')) $('#cv-pop')?.remove();
    const tl = q('[data-cvtool]'); if (tl) { const k = tl.dataset.cvtool; if (k === 'shape') { cvPop(tl, [['rect', 'square', 'Rectangle', 'R'], ['ellipse', 'circle', 'Ellipse', 'O'], ['line', 'minus', 'Line', 'L']].map(([k2, i, n, s]) => `<button class="crmi${CV.tool === k2 ? ' on' : ''}" type="button" data-cvtool="${k2}">${ic(i)}<span>${n}</span><kbd class="sukbd">${s}</kbd></button>`).join(''), true); return true; } $('#cv-pop')?.remove(); if (CV.pen) cvPenEnd(false); CV.tool = k; cvTools(); return true; }
    const sl = q('[data-cvsel]'); if (sl && !q('[data-cvopen],[data-cveye]')) { const id = sl.dataset.cvsel; CV.sel = e.shiftKey ? (CV.sel.includes(id) ? CV.sel.filter(i => i !== id) : [...CV.sel, id]) : [id]; cvDraw(); cvPanels(); return true; }
    const op = q('[data-cvopen]'); if (op) { const id = op.dataset.cvopen; CV.open[id] = !(CV.open[id] ?? true); cvLeft(); return true; }
    const ey = q('[data-cveye]'); if (ey) { const n = cvG(ey.dataset.cveye); n.hidden = !n.hidden; cvAll(); return true; }
    if (q('[data-cvleft]')) { CV.left = !CV.left; if (cvPhone() && CV.left) CV.pinsp = false; cvPanels(); return true; }
    if (q('[data-cvpinsp]')) { CV.pinsp = !CV.pinsp; if (CV.pinsp) CV.left = false; cvPanels(); return true; }
    if (q('[data-cvfocus]')) { CV.focus = !CV.focus; cvPanels(); cvTopR(); return true; }
    const tb = q('[data-cvtab]'); if (tb) { CV.tab = tb.dataset.cvtab; cvLeft(); requestAnimationFrame(segs); return true; }
    const it = q('[data-cvitab]'); if (it) { CV.itab = it.dataset.cvitab; cvInsp(); return true; }
    if (q('[data-cvpage]')) { cvPop(q('[data-cvpage]'), '<h6>Pages</h6>' + ['Launch', 'Brand', 'Archive'].map(p => `<button class="crmi${CV.page === p ? ' on' : ''}" type="button" data-cvpg="${p}"><span>${p}</span></button>`).join('') + '<span class="crsep"></span><button class="crmi" type="button" data-cvtodo="New page"><span>New page</span></button>'); return true; }
    const pg = q('[data-cvpg]'); if (pg) { $('#cv-pop')?.remove(); if (pg.dataset.cvpg !== CV.page) cvToast(`${pg.dataset.cvpg} is empty in this mockup`); return true; }
    const sw = q('[data-cvsw]'); if (sw) { cvSel().forEach(n => { if (n.t === 'text') n.color = sw.dataset.cvsw; else if (n.t !== 'image') n.fill = sw.dataset.cvsw; }); cvAll(); return true; }
    const ts = q('[data-cvts]'); if (ts) { const S = cvSel().filter(n => n.t === 'text'); if (!S.length) { cvToast('Select some text first'); return true; } S.forEach(n => Object.assign(n, { ff: ts.dataset.f, fw: +ts.dataset.w, fs: +ts.dataset.s, h: Math.round(+ts.dataset.s * n.lh) })); cvAll(); return true; }
    const cp = q('[data-cvcomp]'); if (cp) { cvComp(cp.dataset.cvcomp); return true; }
    const im = q('[data-cvimg]'); if (im) { const s = cvSel()[0]; if (s?.t === 'image') { s.img = PH + im.dataset.cvimg + '.webp'; cvAll(); return true; } const fr = s ? (s.t === 'frame' ? s : cvG(s.parent)) : CV.nodes[0]; const n = cvAdd({ t: 'image', name: 'Photo', parent: fr?.id || null, x: 60, y: 60, w: 400, h: 300, r: 16, img: PH + im.dataset.cvimg + '.webp' }); CV.sel = [n.id]; cvAll(); return true; }
    const al = q('[data-cval]'); if (al) { cvAlignDo(al.dataset.cval); return true; }
    if (q('[data-cvwrap]')) { const S = cvSel(), b = cvBounds(S), f = cvAdd({ t: 'frame', name: 'Frame', x: b.x - 40, y: b.y - 40, w: b.w + 80, h: b.h + 80, fill: '#ffffff' }); CV.nodes.splice(CV.nodes.indexOf(f), 1); CV.nodes.unshift(f); S.forEach(n => { n.parent = f.id; }); CV.sel = [f.id]; cvAll(); return true; }
    if (q('[data-cvdist]')) { const S = cvSel().sort((a, b) => a.x - b.x); if (S.length > 2) { const b = cvBounds(S), gap = (b.w - S.reduce((s, n) => s + n.w, 0)) / (S.length - 1); let x = b.x; S.forEach(n => { cvMove(n, x - n.x, 0); x += n.w + gap; }); cvAll(); } return true; }
    const ta = q('[data-cvta]'); if (ta) { cvSel()[0].align = ta.dataset.cvta; cvAll(); return true; }
    const fm = q('[data-cvfmt]'); if (fm) { CV.exp.fmt = fm.dataset.cvfmt; cvInsp(); return true; }
    const sc = q('[data-cvsc]'); if (sc) { CV.exp.sc = +sc.dataset.cvsc; cvInsp(); return true; }
    const ex = q('[data-cvexp]'); if (ex) { const f = cvG(ex.dataset.cvexp); cvToast(`Exported “${f.name}${CV.exp.fmt === 'PNG' || CV.exp.fmt === 'JPG' ? (CV.exp.sc > 1 ? '@' + CV.exp.sc + 'x' : '') : ''}.${CV.exp.fmt.toLowerCase()}” to Pictures`); return true; }
    if (q('[data-cvexpall]')) { cvToast('Exported 3 frames to Pictures › Launch kit', { icon: 'share' }); return true; }
    const cl = q('[data-cvclr]'); if (cl) { const k = cl.dataset.cvclr; cvPop(cl, `<div class="supal">${CVSW.map(c => `<button type="button" style="--c:${c}" data-cvpick="${k}" data-c="${c}"></button>`).join('')}${k === 'fill' ? `<button type="button" class="grad" style="--c:linear-gradient(160deg, #1d2346, #0b0d18)" data-cvpick="fill" data-c="linear-gradient(160deg, #1d2346, #0b0d18)" title="Night"></button><button type="button" class="grad" style="--c:linear-gradient(135deg, #f2b544, #e8553b)" data-cvpick="fill" data-c="linear-gradient(135deg, #f2b544, #e8553b)" title="Sunset"></button>` : ''}</div>`); return true; }
    const pk = q('[data-cvpick]'); if (pk) { const k = pk.dataset.cvpick, c = pk.dataset.c; cvSel().forEach(n => { if (k === 'stroke') n.stroke.c = c; else n[k] = c; }); $('#cv-pop')?.remove(); cvAll(); return true; }
    if (q('[data-cvstroke]')) { cvSel()[0].stroke = { c: '#16161a', w: 2 }; cvAll(); return true; }
    if (q('[data-cvunstroke]')) { delete cvSel()[0].stroke; cvAll(); return true; }
    if (q('[data-cvshadow]')) { const n = cvSel()[0]; n.shadow = !n.shadow; cvAll(); return true; }
    if (q('[data-cvswap]')) { CV.tab = 'assets'; CV.left = true; cvLeft(); cvToast('Pick a photo from Assets'); return true; }
    if (q('[data-cvpreset]')) { cvPop(q('[data-cvpreset]'), CVSIZE.map(([n, w, h]) => `<button class="crmi" type="button" data-cvsize="${w}x${h}" data-n="${n}"><span>${n}</span><kbd class="sukbd">${w} × ${h}</kbd></button>`).join('')); return true; }
    const sz = q('[data-cvsize]'); if (sz) { const [w, h] = sz.dataset.cvsize.split('x').map(Number), n = cvSel()[0]; n.w = w; n.h = h; n.name = sz.dataset.n; $('#cv-pop')?.remove(); cvAll(); return true; }
    if (q('[data-cvfont]')) { cvPop(q('[data-cvfont]'), Object.keys(CVFONT).map(f => `<button class="crmi" type="button" data-cvff="${f}"><span style="font-family:${CVFONT[f]};font-size:15px">${f}</span></button>`).join('')); return true; }
    const ff = q('[data-cvff]'); if (ff) { cvSel()[0].ff = ff.dataset.cvff; $('#cv-pop')?.remove(); cvAll(); return true; }
    if (q('[data-cvmore]')) { cvPop(q('[data-cvmore]'), `<button class="crmi" type="button" data-cvdo="dup"><span>Duplicate</span><kbd class="sukbd">⌘D</kbd></button><button class="crmi" type="button" data-cvdo="front"><span>Bring to front</span><kbd class="sukbd">]</kbd></button><button class="crmi" type="button" data-cvdo="back"><span>Send to back</span><kbd class="sukbd">[</kbd></button><button class="crmi" type="button" data-cvdo="zoom"><span>Zoom to selection</span><kbd class="sukbd">⇧2</kbd></button><span class="crsep"></span><button class="crmi red" type="button" data-cvdo="del"><span>Delete</span><kbd class="sukbd">⌫</kbd></button>`); return true; }
    const dd = q('[data-cvdo]'); if (dd) { $('#cv-pop')?.remove(); cvDo(dd.dataset.cvdo); return true; }
    if (q('[data-cvzoom]')) { cvPop(q('[data-cvzoom]'), `<button class="crmi" type="button" data-cvz="in"><span>Zoom in</span><kbd class="sukbd">⌘+</kbd></button><button class="crmi" type="button" data-cvz="out"><span>Zoom out</span><kbd class="sukbd">⌘−</kbd></button><button class="crmi" type="button" data-cvz="fit"><span>Fit everything</span><kbd class="sukbd">⇧1</kbd></button><button class="crmi" type="button" data-cvz="1"><span>Actual size</span><kbd class="sukbd">⌘0</kbd></button><span class="crsep"></span><button class="crmi" type="button" data-cvz="focus"><span>Hide panels</span><kbd class="sukbd">\\</kbd></button>`, true); return true; }
    const zz = q('[data-cvz]'); if (zz) { $('#cv-pop')?.remove(); const k = zz.dataset.cvz; if (k === 'focus') { CV.focus = true; cvPanels(); } else if (k === 'fit') { cvFit(); cvAll(); } else cvZoom(k === 'in' ? CV.cam.z * 1.25 : k === 'out' ? CV.cam.z / 1.25 : 1); return true; }
    const td = q('[data-cvtodo]'); if (td) { $('#cv-pop')?.remove(); cvToast(td.dataset.cvtodo); return true; }
    return false; }
  function cvDo(k) { if (k === 'del') cvDel(); else if (k === 'dup') cvDup(); else if (k === 'zoom') { cvFit(CV.sel); cvAll(); }
    else if (k === 'front' || k === 'back') { cvSel().forEach(n => { CV.nodes.splice(CV.nodes.indexOf(n), 1); k === 'front' ? CV.nodes.push(n) : CV.nodes.unshift(n); }); cvAll(); } }
  function renderCanvas() { $('#cv-top').innerHTML = `<img src="${A}designer.svg" alt=""><b>Launch kit</b><span class="sumeta">Canvas · Saved</span><span class="sutopr" id="cv-topr"></span>`; cvTopR();
    $('#w-canvas').addEventListener('luma-phone', e => { CV.left = !e.detail; CV.pinsp = false; setTimeout(() => { cvFit(); cvAll(); }, 120); });
    const w = $('#cv-work'); w.addEventListener('pointerdown', cvPtr); w.addEventListener('pointermove', cvPtrMove); w.addEventListener('pointerup', cvPtrUp); w.addEventListener('pointercancel', cvPtrUp);
    w.addEventListener('dblclick', e => { if (CV.pen) { cvPenEnd(false); return; } const n = e.target.closest('#cv-space [data-cvn]'); if (n && cvG(n.dataset.cvn)?.t === 'text' && CV.tool === 'move') { CV.edit = n.dataset.cvn; cvAll(); } });
    w.addEventListener('wheel', e => { if (e.target.closest('.supanel')) return; e.preventDefault(); const wr = w.getBoundingClientRect(); if (e.ctrlKey || e.metaKey) cvZoom(CV.cam.z * Math.exp(-e.deltaY * .01), e.clientX - wr.left, e.clientY - wr.top); else { CV.cam.x -= e.deltaX; CV.cam.y -= e.deltaY; cvDraw(); } }, { passive: false });
    new ResizeObserver(() => { if (!CV.fitted && w.clientWidth > 200) { CV.fitted = true; cvFit(w.clientWidth < 560 ? undefined : CV.nodes.filter(n => !n.parent).slice(0, 2).map(n => n.id)); cvAll(); } else cvOver(); }).observe(w);
    cvAll(); }
  document.addEventListener('input', e => { const t = e.target; if (!t.closest?.('#w-canvas')) return; const n = cvSel()[0];
    if (t.matches('[data-cvname]') && n) { n.name = t.value; cvLeft(); cvDraw(); return; }
    const k = t.dataset.cvp; if (!k || !n) return; const p = n.parent ? cvG(n.parent) : null, v = parseFloat(t.value);
    if (k === 'fill' || k === 'color') { if (/^[0-9a-f]{6}$/i.test(t.value)) { n[k] = '#' + t.value; cvDraw(); t.previousElementSibling.style.setProperty('--c', n[k]); } return; }
    if (k === 'sc') { if (/^[0-9a-f]{6}$/i.test(t.value)) { n.stroke.c = '#' + t.value; cvDraw(); } return; }
    if (Number.isNaN(v)) return;
    if (k === 'x') cvMove(n, v + (p ? p.x : 0) - n.x, 0); else if (k === 'y') cvMove(n, 0, v + (p ? p.y : 0) - n.y); else if (k === 'op') n.op = Math.max(0, Math.min(100, v)) / 100; else if (k === 'sw') n.stroke.w = v; else n[k] = v;
    if (k === 'fs' && n.t === 'text') n.h = Math.round(v * n.lh); cvDraw(); });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'canvas') return; const inField = e.target.closest?.('input, [contenteditable="true"]');
    if (CV.edit) { if (e.key === 'Escape') { e.preventDefault(); $(`[data-cvn="${CV.edit}"] .cvtx`)?.blur(); } return; } if (inField) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (k === ' ' && !CV.space) { CV.space = true; $('#cv-work').dataset.tool = 'hand'; e.preventDefault(); return; }
    if (mod && k === 'd') { e.preventDefault(); cvDup(); return; } if (mod && (k === '=' || k === '+')) { e.preventDefault(); cvZoom(CV.cam.z * 1.25); return; } if (mod && k === '-') { e.preventDefault(); cvZoom(CV.cam.z / 1.25); return; } if (mod && k === '0') { e.preventDefault(); cvZoom(1); return; }
    if (mod) return;
    if (e.key === '!' || (e.shiftKey && k === '1')) { cvFit(); cvAll(); return; } if (e.key === '@' || (e.shiftKey && k === '2')) { if (CV.sel.length) { cvFit(CV.sel); cvAll(); } return; }
    if (e.key === '\\') { CV.focus = !CV.focus; cvPanels(); cvTopR(); return; }
    if (e.key === 'Escape') { if (CV.pen) cvPenEnd(false); else { CV.sel = []; CV.focus = false; cvAll(); } return; } if (e.key === 'Enter' && CV.pen) { cvPenEnd(false); return; }
    if ((e.key === 'Backspace' || e.key === 'Delete') && CV.sel.length) { e.preventDefault(); cvDel(); return; }
    if (e.key.startsWith('Arrow') && CV.sel.length) { e.preventDefault(); const s = e.shiftKey ? 10 : 1; cvSel().forEach(n => cvMove(n, k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0)); cvDraw(); cvInsp(); return; }
    if (e.key === ']' || e.key === '[') { cvDo(e.key === ']' ? 'front' : 'back'); return; }
    const tools = { v: 'move', f: 'frame', r: 'rect', o: 'ellipse', l: 'line', p: 'pen', t: 'text', i: 'image', h: 'hand', c: 'comment' }; if (tools[k]) { if (CV.pen && k !== 'p') cvPenEnd(false); CV.tool = tools[k]; cvTools(); } });
  document.addEventListener('keyup', e => { if (e.key === ' ' && CV.space) { CV.space = false; const w = $('#cv-work'); if (w) w.dataset.tool = CV.tool; } });

  /* ══ Grid ════════════════════════════════════════════════════════════════════
     A spreadsheet without the ribbon. The grid is the island. The floating bar is about what you've selected:
     it leads with the selection itself (a cell, or the sum of a range), then how it looks, then what to insert.
     The formula line floats at the top and colours its references to match the grid. Click a column's letter
     and the inspector tells you what that column is. Charts and shapes float over the cells and behave exactly
     like they do in Canvas. */
  const GRCATS = { Venue: 265, Printing: 25, Travel: 200, Food: 140, Software: 300, Equipment: 60 };
  const GRL = 'ABCDEFGHIJKL'.split(''), grK = (r, c) => GRL[c] + (r + 1), grRC = k => { const m = /^([A-Z])(\d+)$/.exec(k); return [+m[2] - 1, GRL.indexOf(m[1])]; };
  const GR = { cur: 'Budget', sel: { a: [6, 4], b: [6, 4] }, edit: null, left: false, focus: false, obj: null, col: null, drag: null, pop: null, sheets: {} };
  (function seed() {
    const rows = [['2026-09-02', 'Loft deposit', 'Venue', 'The Loft', 1500], ['2026-09-03', 'Poster print run', 'Printing', 'Kessel Print', 640], ['2026-09-03', 'Train to Oakland', 'Travel', 'BART', 12.4], ['2026-09-05', 'Team lunch', 'Food', 'Tartine', 86.5],
      ['2026-09-06', 'Domain renewal', 'Software', 'Porkbun', 11], ['2026-09-08', 'Microphone', 'Equipment', 'B&H', 229], ['2026-09-09', 'Flyers, A5', 'Printing', 'Kessel Print', 180], ['2026-09-10', 'Coffee with Theo', 'Food', 'Sightglass', 14.25],
      ['2026-09-12', 'Loft balance', 'Venue', 'The Loft', 600], ['2026-09-12', 'HDMI cables', 'Equipment', 'B&H', 38.9], ['2026-09-14', 'Stickers', 'Printing', 'Sticker Mule', 96], ['2026-09-15', 'Rideshare', 'Travel', 'Lyft', 23.6],
      ['2026-09-16', 'Press photo prints', 'Printing', 'Kessel Print', 72], ['2026-09-18', 'Font licence', 'Software', 'Klim', 180], ['2026-09-19', 'Rehearsal snacks', 'Food', 'Rainbow', 64.35], ['2026-09-20', 'Projector rental', 'Equipment', 'Rental Co', 110],
      ['2026-09-22', 'Banner', 'Printing', 'Kessel Print', 118], ['2026-09-23', 'Parking', 'Travel', 'SFMTA', 18], ['2026-09-24', 'Chair rental', 'Venue', 'Party Rentals', 95], ['2026-09-25', 'Water and ice', 'Food', 'Safeway', 27.9],
      ['2026-09-26', 'Name badges', 'Printing', 'Sticker Mule', 42], ['2026-09-28', 'Train to San Jose', 'Travel', 'Caltrain', 15.5], ['2026-09-29', 'Thank-you cards', 'Printing', 'Paper Source', 0]];
    rows[22][4] = Math.round((4212 - rows.slice(0, 22).reduce((s, r) => s + r[4], 0)) * 100) / 100;
    const B = { cells: {}, w: [104, 190, 124, 140, 118, 76, 40, 60, 60, 60, 60, 60], types: { A: 'date', B: 'text', C: 'tag', D: 'text', E: 'currency', F: 'check' }, rows: 40, name: 'Budget' }, set = (k, v, x = {}) => { B.cells[k] = { v: String(v), ...x }; };
    ['Date', 'Item', 'Category', 'Vendor', 'Amount', 'Paid'].forEach((h, c) => set(grK(0, c), h, { hd: true }));
    rows.forEach((r, i) => { r.forEach((v, c) => set(grK(i + 1, c), v)); set(grK(i + 1, 5), i < 19 ? 'TRUE' : 'FALSE'); });
    set('D25', 'Total', { b: true, al: 'right' }); set('E25', '=SUM(E2:E24)', { b: true }); set('D26', 'Average', { al: 'right' }); set('E26', '=AVERAGE(E2:E24)'); set('D27', 'Still to pay', { al: 'right' }); set('E27', '=SUMIF(F2:F24, "FALSE", E2:E24)');
    const S = { cells: {}, w: [150, 130, 100, 60, 60, 60, 60, 60, 60, 60, 60, 60], types: { A: 'tag', B: 'currency', C: 'percent' }, rows: 30, name: 'Summary' }, s2 = (k, v, x = {}) => { S.cells[k] = { v: String(v), ...x }; };
    ['Category', 'Spent', 'Share'].forEach((h, c) => s2(grK(0, c), h, { hd: true }));
    Object.keys(GRCATS).forEach((c, i) => { s2(`A${i + 2}`, c); s2(`B${i + 2}`, `=SUMIF(Budget!C2:C24, A${i + 2}, Budget!E2:E24)`); s2(`C${i + 2}`, `=B${i + 2}/B$9`); });
    s2('A9', 'Total', { b: true }); s2('B9', '=SUM(B2:B7)', { b: true }); s2('C9', '=SUM(C2:C7)', { b: true });
    GR.sheets = { Budget: B, Summary: S, Receipts: { cells: { A1: { v: 'Receipt', hd: true }, B1: { v: 'File', hd: true } }, w: [160, 220, 100, 100, 100, 100, 60, 60, 60, 60, 60, 60], types: {}, rows: 30, name: 'Receipts' } };
    GR.objs = [{ id: 'o1', sheet: 'Budget', t: 'area', title: 'Spent over September', x: 836, y: 24, w: 400, h: 250, auto: true }, { id: 'o2', sheet: 'Summary', t: 'bar', title: 'Spent by category', x: 470, y: 20, w: 460, h: 300, auto: true }];
  })();
  const grSh = () => GR.sheets[GR.cur];

  /* ── Formulas: + − × ÷ ^, comparisons, refs, ranges, other sheets, and the functions people actually use ── */
  const GRFN = { SUM: ['SUM(value, …)', 'Adds numbers or ranges'], AVERAGE: ['AVERAGE(value, …)', 'The mean of the numbers'], COUNT: ['COUNT(value, …)', 'How many numbers'], MIN: ['MIN(value, …)', 'The smallest number'], MAX: ['MAX(value, …)', 'The largest number'],
    SUMIF: ['SUMIF(range, match, sum_range)', 'Adds the rows where range matches'], IF: ['IF(test, then, otherwise)', 'Picks a value by a test'], ROUND: ['ROUND(value, places)', 'Rounds to decimal places'], ABS: ['ABS(value)', 'Drops the sign'] };
  function grEval(sheet, key, seen = new Set()) { const S = GR.sheets[sheet], c = S?.cells[key]; if (!c || c.v === '') return null; const raw = c.v;
    if (raw[0] !== '=') { if (raw === 'TRUE' || raw === 'FALSE') return raw; const n = Number(raw); return raw.trim() !== '' && !Number.isNaN(n) && !/^\d{4}-\d\d-\d\d$/.test(raw) ? n : raw; }
    const id = sheet + '!' + key; if (seen.has(id)) return '#CYCLE'; seen.add(id); try { const v = grFormula(raw.slice(1), sheet, seen); seen.delete(id); return v; } catch (e) { seen.delete(id); return typeof e === 'string' ? e : '#ERROR'; } }
  function grFormula(src, sheet, seen) { const T = []; const re = /\s*(?:(\d+(?:\.\d+)?)|"([^"]*)"|([A-Z][A-Z0-9]*)\s*\(|((?:[A-Za-z]+!)?\$?[A-Z]\$?\d+(?::\$?[A-Z]\$?\d+)?)|(<>|>=|<=|[-+*/^(),=<>&]))/y; let m, at = 0;
    while (at < src.length) { re.lastIndex = at; m = re.exec(src); if (!m || m[0] === '') { if (/^\s*$/.test(src.slice(at))) break; throw '#ERROR'; } at = re.lastIndex; T.push(m[1] ? { n: +m[1] } : m[2] !== undefined ? { s: m[2] } : m[3] ? { f: m[3] } : m[4] ? { r: m[4] } : { o: m[5] }); }
    let i = 0; const pk = () => T[i], nx = () => T[i++], op = o => pk()?.o === o && nx();
    const cellsOf = r => { let [sh, ref] = r.includes('!') ? r.split('!') : [sheet, r]; ref = ref.replace(/\$/g, ''); const [a, b = a] = ref.split(':'), [r1, c1] = grRC(a), [r2, c2] = grRC(b), out = []; for (let rr = Math.min(r1, r2); rr <= Math.max(r1, r2); rr++) for (let cc = Math.min(c1, c2); cc <= Math.max(c1, c2); cc++) out.push(grEval(sh, grK(rr, cc), seen)); return out; };
    const num = v => { if (typeof v === 'string' && v[0] === '#') throw v; return typeof v === 'number' ? v : v === null ? 0 : Number.isNaN(+v) ? 0 : +v; };
    const flat = args => args.flat().filter(v => typeof v === 'number');
    const F = { SUM: a => flat(a).reduce((s, v) => s + v, 0), AVERAGE: a => { const f = flat(a); if (!f.length) throw '#DIV/0!'; return f.reduce((s, v) => s + v, 0) / f.length; }, COUNT: a => flat(a).length, MIN: a => Math.min(...flat(a)), MAX: a => Math.max(...flat(a)), ABS: a => Math.abs(num(a[0])),
      ROUND: a => { const p = 10 ** num(a[1] ?? 0); return Math.round(num(a[0]) * p) / p; }, IF: a => (a[0] && a[0] !== 'FALSE' ? a[1] : a[2] ?? false),
      SUMIF: a => { const [rg, crit, sr = rg] = a, m = String(crit); return rg.reduce((s, v, k) => s + (String(v) === m ? num(sr[k]) : 0), 0); } };
    const prim = () => { const t = nx(); if (!t) throw '#ERROR'; if (t.n !== undefined) return t.n; if (t.s !== undefined) return t.s;
      if (t.r) { const c = cellsOf(t.r); return t.r.includes(':') ? c : c[0] ?? 0; }
      if (t.f) { if (!F[t.f]) throw '#NAME?'; const args = []; if (!op(')')) { do args.push(cmp()); while (op(',')); if (!op(')')) throw '#ERROR'; } return F[t.f](args); }
      if (t.o === '(') { const v = cmp(); if (!op(')')) throw '#ERROR'; return v; } if (t.o === '-') return -num(unary()); throw '#ERROR'; };
    const unary = () => op('-') ? -num(unary()) : pow(); const pow = () => { const a = prim(); return op('^') ? num(a) ** num(unary()) : a; };
    const mul = () => { let a = unary(); for (;;) { if (op('*')) a = num(a) * num(unary()); else if (op('/')) { const b = num(unary()); if (b === 0) throw '#DIV/0!'; a = num(a) / b; } else return a; } };
    const add = () => { let a = mul(); for (;;) { if (op('+')) a = num(a) + num(mul()); else if (op('-')) a = num(a) - num(mul()); else if (op('&')) a = String(a) + String(mul()); else return a; } };
    const cmp = () => { const a = add(), o = pk()?.o; if (['=', '<>', '<', '>', '<=', '>='].includes(o)) { nx(); const b = add(); return { '=': a == b, '<>': a != b, '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b }[o] ? 'TRUE' : 'FALSE'; } return a; };
    const v = cmp(); if (i < T.length) throw '#ERROR'; return Array.isArray(v) ? v[0] : v; }

  const GRMONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function grShow(v, type) { if (v === null) return ''; if (typeof v === 'string' && v[0] === '#') return `<span class="grerr">${v}</span>`;
    if (type === 'check') return `<i class="grck${v === 'TRUE' ? ' on' : ''}">${v === 'TRUE' ? ic('check') : ''}</i>`;
    if (type === 'tag' && typeof v === 'string' && GRCATS[v] !== undefined) return `<span class="grtag" style="--h:${GRCATS[v]}">${esc(v)}</span>`;
    if (type === 'date' && /^\d{4}-\d\d-\d\d$/.test(v)) { const [, m, d] = v.split('-'); return `${GRMONTH[+m - 1]} ${+d}`; }
    if (typeof v === 'number') return type === 'currency' ? (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : type === 'percent' ? (v * 100).toFixed(1) + '%' : (Math.round(v * 1e6) / 1e6).toLocaleString('en-US');
    return esc(String(v)); }
  const grRange = () => { const { a, b } = GR.sel; return { r1: Math.min(a[0], b[0]), r2: Math.max(a[0], b[0]), c1: Math.min(a[1], b[1]), c2: Math.max(a[1], b[1]) }; };
  const grRangeName = () => { const r = grRange(); return r.r1 === r.r2 && r.c1 === r.c2 ? grK(r.r1, r.c1) : `${grK(r.r1, r.c1)}:${grK(r.r2, r.c2)}`; };
  const GRREFC = [250, 25, 150, 300, 60];

  /* ── The grid ── */
  function grDraw() { const S = grSh(), body = $('#gr-grid'); if (!body) return; const cols = S.w.slice(0, 10);
    body.style.gridTemplateColumns = `44px ${cols.map(w => w + 'px').join(' ')}`;
    let h = `<div class="grcor"></div>${cols.map((_, c) => `<div class="grch${GR.col === c ? ' on' : ''}" data-grcol="${c}">${GRL[c]}${S.types[GRL[c]] ? `<i>${grTypeIc(S.types[GRL[c]])}</i>` : ''}</div>`).join('')}`;
    for (let r = 0; r < S.rows; r++) { if (GR.cur === 'Budget' && GR.hide?.length && r >= 1 && r <= 23 && GR.hide.includes(grEval('Budget', `C${r + 1}`))) continue;   // filtered rows aren't drawn
      h += `<div class="grrh" data-grrow="${r}">${r + 1}</div>`;
      for (let c = 0; c < cols.length; c++) { const k = grK(r, c), cell = S.cells[k], v = grEval(GR.cur, k), type = cell?.hd ? null : S.types[GRL[c]];
        const cls = ['grc', cell?.hd ? 'hd' : '', cell?.hd && !S.cells[grK(r, c - 1)]?.hd ? 'hs' : '', cell?.hd && !S.cells[grK(r, c + 1)]?.hd ? 'he' : '', cell?.b ? 'b' : '', typeof v === 'number' || type === 'check' ? 'num' : '', r === 0 && cell?.hd ? 'frz' : ''].join(' ');
        h += `<div class="${cls}" data-gc="${k}" style="${cell?.al ? `justify-content:${cell.al === 'right' ? 'flex-end' : cell.al === 'center' ? 'center' : 'flex-start'};` : ''}${cell?.fill ? `background:${cell.fill};` : ''}${cell?.i ? 'font-style:italic;' : ''}">${grShow(v, type)}</div>`; } }
    body.innerHTML = h; grObjs(); grSelDraw(); }
  const grTypeIc = t => ic({ date: 'calendar', text: 'type', tag: 'tag', currency: 'dollar-sign', check: 'square-check', percent: 'percent', number: 'hash' }[t] || 'type');
  // A chart you haven't moved sits beside the table when there's room, and under the totals when there isn't
  function grPlace() { const sc = $('#gr-scroll'), S = grSh(); if (!sc || sc.clientWidth < 200) return; const vis = sc.clientWidth - parseFloat(getComputedStyle($('#gr-work')).getPropertyValue('--gl')) - 10,   // the inspector floats over the sheet, so opening it doesn't move the chart
      used = Object.keys(S.cells).map(grRC), cols = Math.max(...used.map(x => x[1])) + 1, rows = Math.max(...used.map(x => x[0])) + 1, tw = S.w.slice(0, cols).reduce((s, w) => s + w, 0);   // beside or under the table that's actually there
    GR.objs.filter(o => o.auto && o.sheet === GR.cur).forEach(o => { const room = vis - 44 - tw - 24 - 16; if (room >= 300) Object.assign(o, { x: tw + 24, y: 24, w: Math.min(440, room), h: 250 }); else Object.assign(o, { x: 0, y: (rows + 1) * 32 + 16, w: Math.max(260, Math.min(600, vis - 44 - 16)), h: 250 }); }); }
  function grObjs() { grPlace(); const lay = $('#gr-objs'); lay.innerHTML = GR.objs.filter(o => o.sheet === GR.cur).map(o => `<div class="grobj ${o.t}${o.shape ? ' ' + o.shape : ''}${GR.obj === o.id ? ' on' : ''}" data-grobj="${o.id}" style="left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px">${o.t === 'shape' ? '' : `<b>${esc(o.title)}</b>${grChart(o)}`}</div>`).join(''); }
  function grChart(o) { const W = o.w - 32, H = o.h - 64;
    if (o.t === 'bar') { const d = Object.keys(GRCATS).map((c, i) => [c, grEval('Summary', `B${i + 2}`)]).sort((a, b) => b[1] - a[1]), mx = Math.max(...d.map(x => x[1])), bh = H / d.length;
      return `<svg class="grsvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${d.map(([c, v], i) => `<g transform="translate(0 ${i * bh})"><text x="0" y="${bh / 2 + 4}" class="gl">${c}</text><rect x="86" y="${bh * .18}" width="${Math.max(2, (W - 170) * v / mx)}" height="${bh * .64}" rx="5" style="fill:oklch(0.7 0.13 ${GRCATS[c]})"/><text x="${92 + (W - 170) * v / mx}" y="${bh / 2 + 4}" class="gv">$${Math.round(v).toLocaleString('en-US')}</text></g>`).join('')}</svg>`; }
    const pts = []; let run = 0; for (let r = 1; r <= 23; r++) { const d = grEval('Budget', `A${r + 1}`), v = grEval('Budget', `E${r + 1}`); if (typeof v === 'number') { run += v; pts.push([+String(d).slice(8), run]); } }
    const mx = Math.max(...pts.map(p => p[1])) * 1.08, X = d => (d - 1) / 29 * W, Y = v => H - 18 - v / mx * (H - 26), line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ');
    return `<svg class="grsvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><linearGradient id="grg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(0.7 0.14 250)" stop-opacity=".45"/><stop offset="1" stop-color="oklch(0.7 0.14 250)" stop-opacity="0"/></linearGradient></defs>
      ${[0, .5, 1].map(f => `<line x1="0" x2="${W}" y1="${Y(mx / 1.08 * f)}" y2="${Y(mx / 1.08 * f)}" class="gg"/><text x="0" y="${Y(mx / 1.08 * f) - 4}" class="gv r">$${Math.round(mx / 1.08 * f / 100) / 10}k</text>`).join('')}
      <path d="${line} L${X(pts[pts.length - 1][0])} ${H - 18} L${X(pts[0][0])} ${H - 18}Z" fill="url(#grg)"/><path d="${line}" class="gline"/>${pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.5" class="gdot"/>`).join('')}
      ${[1, 8, 15, 22, 29].map(d => `<text x="${X(d)}" y="${H - 2}" class="gl c">Sep ${d}</text>`).join('')}</svg>`; }
  function grSelDraw() { const lay = $('#gr-sel'), g = $('#gr-grid'); if (!lay || !g) return; const S = grSh(), R = grRange(), a = g.querySelector(`[data-gc="${grK(R.r1, R.c1)}"]`), b = g.querySelector(`[data-gc="${grK(R.r2, R.c2)}"]`), act = g.querySelector(`[data-gc="${grK(...GR.sel.a)}"]`); if (!a || !b) { lay.innerHTML = ''; return; }
    const box = (el1, el2) => ({ l: el1.offsetLeft, t: el1.offsetTop, w: el2.offsetLeft + el2.offsetWidth - el1.offsetLeft, h: el2.offsetTop + el2.offsetHeight - el1.offsetTop });
    const rb = box(a, b), ab = box(act, act); let h = '';
    const src = S.cells[grK(...GR.sel.a)]?.v || ''; if (src[0] === '=' && !GR.obj) { let k = 0; src.replace(/(?:([A-Za-z]+)!)?\$?([A-Z])\$?(\d+)(?::\$?([A-Z])\$?(\d+))?/g, (m, sh, c1, r1, c2, r2) => { if (sh && sh !== GR.cur) { k++; return m; } const e1 = g.querySelector(`[data-gc="${c1}${r1}"]`), e2 = g.querySelector(`[data-gc="${c2 || c1}${r2 || r1}"]`); if (e1 && e2) { const q = box(e1, e2); h += `<i class="grref" style="left:${q.l}px;top:${q.t}px;width:${q.w}px;height:${q.h}px;--h:${GRREFC[k % 5]}"></i>`; } k++; return m; }); }
    if (!GR.obj) { if (rb.w !== ab.w || rb.h !== ab.h) h += `<i class="grrange" style="left:${rb.l}px;top:${rb.t}px;width:${rb.w}px;height:${rb.h}px"></i>`; h += `<i class="gract" style="left:${ab.l}px;top:${ab.t}px;width:${ab.w}px;height:${ab.h}px"></i><i class="grfill" style="left:${rb.l + rb.w}px;top:${rb.t + rb.h}px"></i>`; }
    const o = GR.obj && GR.objs.find(x => x.id === GR.obj); if (o) h += `<div class="cvbox" style="left:${o.x + 44}px;top:${o.y + 32}px;width:${o.w}px;height:${o.h}px">${['nw', 'ne', 'se', 'sw'].map(d => `<i class="cvh ${d}" data-grh="${d}"></i>`).join('')}<em>${o.w} × ${o.h}</em></div>`;
    lay.innerHTML = h; $$('#gr-grid .grch, #gr-grid .grrh').forEach(x => x.classList.remove('lit')); for (let c = R.c1; c <= R.c2; c++) g.querySelector(`[data-grcol="${c}"]`)?.classList.add('lit'); for (let r = R.r1; r <= R.r2; r++) g.querySelector(`[data-grrow="${r}"]`)?.classList.add('lit'); }

  /* ── The formula line, the bar, the panels ── */
  function grLip() { const S = grSh(), k = grK(...GR.sel.a), raw = S.cells[k]?.v || '', o = GR.obj && GR.objs.find(x => x.id === GR.obj);
    let k2 = 0; const col = raw[0] === '=' ? esc(raw).replace(/(?:([A-Za-z]+)!)?\$?[A-Z]\$?\d+(?::\$?[A-Z]\$?\d+)?/g, m => `<b style="--h:${GRREFC[k2++ % 5]}">${m}</b>`).replace(/([A-Z]{2,})\(/g, '<em>$1</em>(') : esc(raw);
    const sb = GR.left ? '' : `<button class="grsheetb" type="button" data-grleft title="Sheets">${ic('table')}<b>${GR.cur}</b>${ic('chevron-down')}</button><i class="grsep"></i>`;   // folded sheets live at the start of the formula line
    $('#gr-lip').innerHTML = sb + (o ? `<span class="grname">${ic('chart-column')}</span><span class="grfx on">Chart from ${o.t === 'bar' ? 'Summary!A2:B7' : 'Budget!A2:E24'}</span>` : `<button class="grname" type="button" data-grgoto title="Go to a cell">${grRangeName()}</button><i class="grfxi">ƒ</i><label class="grfx"><input data-grfx value="${esc(raw)}" spellcheck="false" placeholder="Value or formula"><span class="grfxv">${col || '<i>Empty</i>'}</span></label>`) + (GR.col == null && !o ? `<button class="grcolb" type="button" data-grcol="${GR.sel.a[1]}" title="What this column is">${grTypeIc(S.types[GRL[GR.sel.a[1]]] || 'text')}Column ${GRL[GR.sel.a[1]]}</button>` : ''); }
  /* A selected chart gets the chart's tools in the bar (its type, the cells it shows, copy, delete); cells get cell formatting */
  function grChartBar(o) { setBar($('#gr-bar'), `<span class="ctxc grctx">${ic('chart-column')}${esc(o.title)}</span>${seg([['bar', 'Bar'], ['area', 'Area']], o.t, 'data-grct', 'Chart type')}
      <button class="bt" type="button" data-grtodo="Select the cells this chart shows" title="The cells this chart shows">${ic('table')}${o.t === 'bar' ? 'Summary!A2:B7' : 'Budget!A2:E24'}</button><span class="vr"></span>
      <button class="ib" type="button" data-grtodo="Chart copied as an image" title="Copy as image" aria-label="Copy as image">${ic('image')}</button><button class="ib" type="button" data-grdel title="Delete chart" aria-label="Delete chart">${ic('trash-2')}</button>`); requestAnimationFrame(segs); }
  /* Grid on a phone: the sheet gets the screen, the formula line stays on top. One bar: the cell you're on (or the sum
     of a range), then Format (the column's type, bold, italic, alignment and fill grow the bar), Insert (chart, shape,
     function), Sort, and ⋯ (Share, export, sheets). */
  const grNarrow = () => { const w = $('#w-grid'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };
  function grBarPhone() { const bar = $('#gr-bar'), S = grSh(), R = grRange(), one = R.r1 === R.r2 && R.c1 === R.c2, cell = S.cells[grK(...GR.sel.a)] || {}, type = S.types[GRL[GR.sel.a[1]]] || 'text', X = GR.px || '';
    $('#w-grid').classList.add('grphone'); bar.classList.add('phnofit', 'grphbar');
    const ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    let ctx = `<span class="grctx2">${ic('square-dashed')}<b>${grRangeName()}</b></span>`;
    if (!one) { const vals = []; for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) { const v = grEval(GR.cur, grK(r, c)); if (typeof v === 'number') vals.push(v); } if (vals.length) ctx = `<span class="grctx2">Σ<b>${(Math.round(vals.reduce((t, v) => t + v, 0) * 100) / 100).toLocaleString('en-US')}</b><small>${vals.length} cells</small></span>`; }
    const TY = [['text', 'Text'], ['number', 'Number'], ['currency', 'Currency'], ['percent', 'Percent'], ['date', 'Date'], ['tag', 'Tag'], ['check', 'Checkbox']];
    const panel = X === 'fmt' ? `<div class="fexp grfmt2"><div class="fexh">Column ${GRL[GR.sel.a[1]]} holds</div><div class="fexs">${TY.map(([k, n]) => `<button type="button" class="fsch${type === k ? ' on' : ''}" data-grqt="${k}">${n}</button>`).join('')}</div>
        <div class="wrfrow"><button type="button" class="${cell.b ? 'on' : ''}" data-grb aria-label="Bold">${ic('bold')}</button><button type="button" class="${cell.i ? 'on' : ''}" data-gri aria-label="Italic">${ic('italic')}</button>${[['left', 'text-align-start'], ['center', 'text-align-center'], ['right', 'text-align-end']].map(([k, i]) => `<button type="button" class="${cell.al === k ? 'on' : ''}" data-gral="${k}" aria-label="Align ${k}">${ic(i)}</button>`).join('')}</div>
        <div class="fexh">Fill</div><div class="wrhl">${['transparent', 'oklch(0.7 0.13 25 / .22)', 'oklch(0.8 0.13 80 / .25)', 'oklch(0.72 0.13 150 / .22)', 'oklch(0.7 0.12 250 / .22)', 'oklch(0.7 0.12 300 / .22)'].map(c => `<button type="button" data-grfc="${c}" style="--hc:${c}" aria-label="Fill"></button>`).join('')}</div></div>`
      : X === 'ins' ? `<div class="fexp"><div class="fsha">${[['chart', 'chart-column', 'Chart'], ['shape', 'square', 'Shape'], ['fn', 'sigma', 'Function']].map(([k, i, n]) => `<button type="button" class="fvt" data-grins="${k}">${ic(i)}<span>${n}</span></button>`).join('')}<button type="button" class="fvt" data-grsort="${GR.sel.a[1]}">${ic('arrow-up-down')}<span>Sort</span></button></div></div>`
      : X === 'more' ? `<div class="fexp fmore2"><div class="fexh">Sheets</div>${Object.keys(GR.sheets).map(n => `<button class="fexr2${GR.cur === n ? ' on' : ''}" type="button" data-grsheet="${n}">${ic('table')}<span>${n}</span></button>`).join('')}<div class="fexh">This spreadsheet</div><button class="fexr2" type="button" data-share>${ic('share-2')}<span>Share</span></button><button class="fexr2" type="button" data-grtodo="Saved as budget.xlsx in Documents">${ic('download')}<span>Export as Excel</span></button><button class="fexr2" type="button" data-grtodo="Saved as budget.csv in Documents">${ic('file-text')}<span>Export as CSV</span></button></div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, `${panel}<div class="grr">${ctx}<span class="sp"></span>${ib('data-grpx="fmt"', 'type', 'Format', X === 'fmt')}${ib('data-grpx="ins"', 'plus', 'Insert', X === 'ins')}${ib('data-grpx="more"', 'ellipsis', 'More', X === 'more')}</div>`); }
  function grBar() { const oc = GR.obj && GR.objs.find(x => x.id === GR.obj); if (oc) return grChartBar(oc);
    if (grNarrow() && !oc) return grBarPhone(); if (!grNarrow()) { $('#w-grid').classList.remove('grphone'); $('#gr-bar').classList.remove('phnofit', 'grphbar', 'phgrow'); } const S = grSh(), R = grRange(), one = R.r1 === R.r2 && R.c1 === R.c2, cell = S.cells[grK(...GR.sel.a)] || {}, type = S.types[GRL[GR.sel.a[1]]] || 'auto';
    let ctx = `<span class="ctxc grctx">${ic('square-dashed')}${grRangeName()}</span>`;
    if (!one) { const vals = []; for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) { const v = grEval(GR.cur, grK(r, c)); if (typeof v === 'number') vals.push(v); }
      const cur = S.types[GRL[R.c1]] === 'currency', f = v => cur ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (Math.round(v * 100) / 100).toLocaleString('en-US');
      if (vals.length) ctx = `<button class="ctxc grctx sum" type="button" data-grsum title="Average ${f(vals.reduce((s, v) => s + v, 0) / vals.length)} · min ${f(Math.min(...vals))} · max ${f(Math.max(...vals))}">Σ<b>${f(vals.reduce((s, v) => s + v, 0))}</b><span>${vals.length} cells</span></button>`; }
    setBar($('#gr-bar'), `${ctx}<button class="bt grfmt" type="button" data-grtype>${({ auto: 'Automatic', text: 'Text', currency: 'Currency', date: 'Date', tag: 'Tag', check: 'Checkbox', percent: 'Percent', number: 'Number' })[type]}${ic('chevron-down')}</button>
      <span class="wrgrp" role="group" aria-label="Character"><button class="ib${cell.b ? ' on' : ''}" type="button" data-grb title="Bold ⌘B" aria-label="Bold">${ic('bold')}</button><button class="ib${cell.i ? ' on' : ''}" type="button" data-gri title="Italic ⌘I" aria-label="Italic">${ic('italic')}</button></span>
      ${seg([['left', ic('text-align-start'), 'Left'], ['center', ic('text-align-center'), 'Centre'], ['right', ic('text-align-end'), 'Right']], cell.al || '', 'data-gral', 'Align', 'ico wide')}<button class="ib grfillb wide" type="button" data-grfill title="Fill">${ic('droplets')}<i style="background:${cell.fill || 'var(--ink-4)'}"></i></button>
      <span class="vr wide"></span><button class="ib wide" type="button" data-grins="chart" title="Chart" aria-label="Chart">${ic('chart-column')}</button><button class="ib wide" type="button" data-grins="shape" title="Shapes · same as Canvas" aria-label="Shape">${ic('square')}</button><button class="ib wide" type="button" data-grins="fn" title="Function" aria-label="Function">${ic('sigma')}</button>`); }
  function grLeft() { const el = $('#gr-left'); el.className = 'supanel l' + (!GR.left || GR.focus ? ' min' : '') + (GR.focus ? ' gone' : '');
    if (!GR.left) { el.className = 'supanel l min gone'; el.innerHTML = ''; return; }
    const rowsOf = s => Object.keys(GR.sheets[s].cells).map(k => grRC(k)[0]).reduce((m, r) => Math.max(m, r), 0);
    el.innerHTML = `<header class="suph1"><button class="supage" type="button" data-grtodo="Workbook: September budget.xlsx"><b>September budget</b>${ic('chevron-down')}</button><button class="ib" type="button" data-grleft title="Hide sheets" aria-label="Hide sheets">${ic($('#w-grid').classList.contains('phone') ? 'x' : 'panel-left')}</button></header>
      <div class="suscroll"><h6 class="suh">Sheets</h6>${Object.keys(GR.sheets).map(s => `<div class="sulyr${GR.cur === s ? ' lsel' : ''}" style="--d:0" data-grsheet="${s}"${GR.cur === s ? ' aria-current="page"' : ''}><i class="sucar"></i>${ic('table')}<span>${s}</span>${lCount(rowsOf(s)).replace('<em', `<em title="${rowsOf(s)} rows"`)}</div>`).join('')}<button class="sulyr add" type="button" data-grtodo="New sheet"><i class="sucar"></i>${ic('plus')}<span>New sheet</span></button>
      <h6 class="suh">On this sheet</h6>${GR.objs.filter(o => o.sheet === GR.cur).map(o => `<div class="sulyr${GR.obj === o.id ? ' on' : ''}" style="--d:0" data-grpick="${o.id}"><i class="sucar"></i>${ic(o.t === 'shape' ? 'square' : 'chart-column')}<span>${esc(o.title)}</span></div>`).join('') || '<p class="grnone">No charts yet</p>'}
      <h6 class="suh">Named ranges</h6>${(GR.cur === 'Budget' ? [['Total', 'E25'], ['Amounts', 'E2:E24'], ['Categories', 'C2:C24']] : [['Totals', 'B2:B7']]).map(([n, r]) => `<div class="sulyr" style="--d:0" data-grjump="${r}"><i class="sucar"></i>${ic('bookmark')}<span>${n}</span><em class="suem">${r}</em></div>`).join('')}</div>`; }
  function grInsp() { const el = $('#gr-right'), S = grSh(), o = GR.obj && GR.objs.find(x => x.id === GR.obj), sec = (t, b, add = '') => `<section class="susec"><header><b>${t}</b>${add}</header>${b}</section>`;
    if (GR.focus) { el.className = 'supanel r min gone'; return; }
    if (!o && GR.col == null) { el.className = 'supanel r min gone'; el.innerHTML = ''; return; }
    el.className = 'supanel r';
    if (o) { el.innerHTML = `<header class="suinsph">${ic('chart-column')}<input class="suname" data-grtitle value="${esc(o.title)}" spellcheck="false"><button class="ib" type="button" data-grclose title="Close" aria-label="Close">${ic('x')}</button></header><div class="suscroll">
      ${sec('Chart', seg([['bar', 'Bar'], ['area', 'Area']], o.t, 'data-grct', 'Chart type'))}${sec('Data', `<div class="sufld"><span>${ic('table')}</span><input value="${o.t === 'bar' ? 'Summary!A2:B7' : 'Budget!A2:E24'}" readonly></div><p class="sunote">Updates when the sheet changes</p>`)}
      ${sec('Layout', `<div class="sugrid2"><label class="sufld"><span>W</span><input data-grow="w" value="${o.w}"></label><label class="sufld"><span>H</span><input data-grow="h" value="${o.h}"></label></div>`)}
      ${sec('Arrange', lStack([{ icon: 'image', label: 'Copy as image', attr: 'data-grtodo="Chart copied as an image"' }, { icon: 'trash-2', label: 'Delete', attr: 'data-grdel', danger: true }], 'sm'))}</div>`; requestAnimationFrame(segs); return; }
    const c = GR.col, L = GRL[c], t = S.types[L] || 'text', head = S.cells[`${L}1`]?.v || `Column ${L}`, vals = []; for (let r = 1; r < S.rows; r++) { if ((S.cells[grK(r, c)]?.v || '')[0] === '=') continue; const v = grEval(GR.cur, grK(r, c)); if (v !== null) vals.push(v); } const nums = vals.filter(v => typeof v === 'number');
    const f = v => grShow(v, t === 'currency' ? 'currency' : 'number').replace(/<[^>]+>/g, '');
    el.innerHTML = `<header class="suinsph">${grTypeIc(t)}<b>${esc(head)}</b><span class="suem">Column ${L}</span><button class="ib" type="button" data-grclose title="Close" aria-label="Close">${ic('x')}</button></header><div class="suscroll">
      ${sec('Type', `<div class="grtypes">${[['text', 'Text'], ['number', 'Number'], ['currency', 'Currency'], ['percent', 'Percent'], ['date', 'Date'], ['tag', 'Tag'], ['check', 'Checkbox']].map(([k, n]) => `<button type="button" class="${t === k ? 'on' : ''}" data-grsettype="${k}">${grTypeIc(k)}<span>${n}</span></button>`).join('')}</div>`)}
      ${sec('Sort', `<div class="surow2"><button class="bt sm fill" type="button" data-grsort="1">${t === 'currency' || t === 'number' ? 'Low to high' : 'A to Z'}</button><button class="bt sm fill" type="button" data-grsort="-1">${t === 'currency' || t === 'number' ? 'High to low' : 'Z to A'}</button></div>`)}
      ${t === 'tag' ? sec('Show', `<div class="grfilt">${Object.keys(GRCATS).map(k => `<button type="button" class="${(GR.hide || []).includes(k) ? '' : 'on'}" data-grfilt="${k}"><i class="grck${(GR.hide || []).includes(k) ? '' : ' on'}">${(GR.hide || []).includes(k) ? '' : ic('check')}</i><span class="grtag" style="--h:${GRCATS[k]}">${k}</span></button>`).join('')}</div>`) : ''}
      ${nums.length ? sec('Summary', `<dl class="grdl">${[['Sum', f(nums.reduce((s, v) => s + v, 0))], ['Average', f(nums.reduce((s, v) => s + v, 0) / nums.length)], ['Smallest', f(Math.min(...nums))], ['Largest', f(Math.max(...nums))], ['Filled', `${vals.length} of ${S.rows - 1}`]].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`) : sec('Summary', `<dl class="grdl"><div><dt>Filled</dt><dd>${Math.max(0, vals.length - 1)} cells</dd></div><div><dt>Different values</dt><dd>${new Set(vals.slice(1)).size}</dd></div></dl>`)}
      ${sec('Width', `<label class="sufld"><span>W</span><input data-grcw value="${S.w[c]}"><em>px</em></label>`)}</div>`; }
  function grPanels() { grLeft(); grInsp(); requestAnimationFrame(() => { grObjs(); grSelDraw(); }); $('#gr-work').classList.toggle('lopen', GR.left && !GR.focus); $('#gr-work').classList.toggle('ropen', !GR.focus && (!!GR.obj || GR.col != null)); }
  function grAll() { grDraw(); grLip(); grBar(); grPanels(); }
  const grToast = (msg, o) => lToast($('#w-grid'), msg, o);   // one notice for the whole OS
  function grPop(anchor, html, up) { $('#gr-pop')?.remove(); const w = $('#w-grid'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop supop" id="gr-pop">${html}</div>`); const p = $('#gr-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left)) + 'px'; if (up) p.style.bottom = (wr.bottom - r.top + 8) + 'px'; else p.style.top = (r.bottom - wr.top + 6) + 'px'; }

  /* ── Editing ── */
  function grStartEdit(init) { const g = $('#gr-grid'), k = grK(...GR.sel.a), el = g.querySelector(`[data-gc="${k}"]`); if (!el) return; GR.edit = k; const raw = init ?? (grSh().cells[k]?.v || '');
    $('#gr-sel').insertAdjacentHTML('beforeend', `<input class="gredit" id="gr-edit" value="${esc(raw)}" spellcheck="false" style="left:${el.offsetLeft}px;top:${el.offsetTop}px;min-width:${el.offsetWidth}px;height:${el.offsetHeight}px">`);
    const i = $('#gr-edit'); i.focus({ preventScroll: true }); i.setSelectionRange(i.value.length, i.value.length); grAuto(i); }
  function grCommit(move = [1, 0], cancel) { const i = $('#gr-edit'); if (!GR.edit) return; const S = grSh(); if (!cancel && i) { const v = i.value; S.cells[GR.edit] = { ...(S.cells[GR.edit] || {}), v }; if (v === '' && !S.cells[GR.edit].b && !S.cells[GR.edit].fill) delete S.cells[GR.edit]; }
    GR.edit = null; $('#gr-pop')?.remove(); if (!cancel) { const [r, c] = GR.sel.a; GR.sel.a = GR.sel.b = [Math.max(0, Math.min(S.rows - 1, r + move[0])), Math.max(0, Math.min(9, c + move[1]))]; } grAll(); }
  function grAuto(i) { const m = /=(?:.*[(,+\-*/^ ])?([A-Z]{1,})$/i.exec(i.value.slice(0, i.selectionStart)); $('#gr-pop')?.remove(); if (!m || !i.value.startsWith('=')) return; const q = m[1].toUpperCase(), list = Object.keys(GRFN).filter(f => f.startsWith(q)); if (!list.length) return;
    GR.ac = { q, list, at: 0 }; grPop(i, `<div class="grac">${list.map((f, k) => `<button type="button" class="${k ? '' : 'on'}" data-grfn="${f}"><b>${GRFN[f][0].replace(/\(.*/, '')}</b><code>${GRFN[f][0].replace(/^\w+/, '')}</code><small>${GRFN[f][1]}</small></button>`).join('')}</div>`); }
  function grPickFn(f) { const i = $('#gr-edit') || $('[data-grfx]'); if (!i) return; const pos = i.selectionStart, before = i.value.slice(0, pos).replace(/[A-Z]+$/i, ''); i.value = before + f + '(' + i.value.slice(pos); i.focus(); const p = before.length + f.length + 1; i.setSelectionRange(p, p); $('#gr-pop')?.remove(); }

  function grClick(e, hit) { const q = s => hit(s);
    if (grNarrow()) { const px = q('[data-grpx]'); if (px) { const k = px.dataset.grpx; GR.px = GR.px === k ? '' : k; grBarPhone(); return true; }
      if (q('#gr-bar [data-grqt]') || q('#gr-bar [data-grb]') || q('#gr-bar [data-gri]') || q('#gr-bar [data-gral]') || q('#gr-bar [data-grfc]')) setTimeout(grBarPhone);
      if (q('#gr-bar [data-grins]') || q('#gr-bar [data-grsheet]') || q('#gr-bar [data-grsort]') || q('#gr-bar [data-grtodo]') || q('#gr-bar [data-share]')) GR.px = ''; }
    if (q('#gr-edit')) return true;
    if (!q('#gr-pop')) $('#gr-pop')?.remove();
    const fn = q('[data-grfn]'); if (fn) { grPickFn(fn.dataset.grfn); return true; }
    if (q('[data-grleft]')) { GR.left = !GR.left; grPanels(); grLip(); requestAnimationFrame(grSelDraw); return true; }
    const sh = q('[data-grsheet]'); if (sh) { GR.cur = sh.dataset.grsheet; GR.sel = { a: [1, 0], b: [1, 0] }; GR.obj = null; GR.col = null; grAll(); return true; }
    const pk = q('[data-grpick]'); if (pk) { GR.obj = pk.dataset.grpick; GR.col = null; grAll(); return true; }
    const jp = q('[data-grjump]'); if (jp) { const [a, b = a] = jp.dataset.grjump.split(':'); GR.sel = { a: grRC(a), b: grRC(b) }; GR.obj = null; grAll(); return true; }
    const col = q('[data-grcol]'); if (col && (q('.grcolb') || q('.grch'))) { const c = +col.dataset.grcol; GR.col = GR.col === c && q('.grch') ? null : c; GR.obj = null; if (q('.grch')) GR.sel = { a: [1, c], b: [grSh().rows - 1, c] }; grAll(); return true; }
    if (q('[data-grclose]')) { GR.col = null; GR.obj = null; grAll(); return true; }
    const st = q('[data-grsettype]'); if (st) { grSh().types[GRL[GR.col]] = st.dataset.grsettype; grAll(); return true; }
    const so = q('[data-grsort]'); if (so) { grSort(GR.col, +so.dataset.grsort); return true; }
    const fl = q('[data-grfilt]'); if (fl) { const k = fl.dataset.grfilt; GR.hide = GR.hide || []; GR.hide = GR.hide.includes(k) ? GR.hide.filter(x => x !== k) : [...GR.hide, k]; grFilter(); return true; }
    const ct = q('[data-grct]'); if (ct) { const o = GR.objs.find(x => x.id === GR.obj); o.t = ct.dataset.grct; grObjs(); grInsp(); grBar(); return true; }
    if (q('[data-grdel]')) { grDelObj(); return true; }
    if (q('[data-grb]') || q('[data-gri]')) { const k = q('[data-grb]') ? 'b' : 'i'; grEach(c => { c[k] = !c[k]; }); grAll(); return true; }
    const al = q('[data-gral]'); if (al) { grEach(c => { c.al = al.dataset.gral; }); grAll(); return true; }
    if (q('[data-grfill]')) { grPop(q('[data-grfill]'), `<div class="supal">${['transparent', 'oklch(0.7 0.13 25 / .22)', 'oklch(0.8 0.13 80 / .25)', 'oklch(0.72 0.13 150 / .22)', 'oklch(0.7 0.12 250 / .22)', 'oklch(0.7 0.12 300 / .22)'].map(c => `<button type="button" style="--c:${c}" data-grfc="${c}"${c === 'transparent' ? ' class="none" title="No fill"' : ''}></button>`).join('')}</div>`, true); return true; }
    const fc = q('[data-grfc]'); if (fc) { grEach(c => { c.fill = fc.dataset.grfc === 'transparent' ? '' : fc.dataset.grfc; }); $('#gr-pop')?.remove(); grAll(); return true; }
    if (q('[data-grtype]')) { const c = GR.sel.a[1]; grPop(q('[data-grtype]'), '<h6>Format column ' + GRL[c] + '</h6>' + [['text', 'Text'], ['number', 'Number'], ['currency', 'Currency'], ['percent', 'Percent'], ['date', 'Date'], ['tag', 'Tag'], ['check', 'Checkbox']].map(([k, n]) => `<button class="crmi${(grSh().types[GRL[c]] || 'text') === k ? ' on' : ''}" type="button" data-grqt="${k}">${grTypeIc(k)}<span>${n}</span></button>`).join(''), true); return true; }
    const qt = q('[data-grqt]'); if (qt) { grSh().types[GRL[GR.sel.a[1]]] = qt.dataset.grqt; $('#gr-pop')?.remove(); grAll(); return true; }
    const ins = q('[data-grins]'); if (ins) { const k = ins.dataset.grins;
      if (k === 'shape') { grPop(ins, [['rect', 'square', 'Rectangle', 'R'], ['ellipse', 'circle', 'Ellipse', 'O'], ['line', 'minus', 'Line', 'L']].map(([k2, i, n, s]) => `<button class="crmi" type="button" data-grshape="${k2}">${ic(i)}<span>${n}</span><kbd class="sukbd">${s}</kbd></button>`).join(''), true); return true; }
      if (k === 'fn') { const i = $('[data-grfx]'); i.focus(); i.value = '='; grPop(i, `<div class="grac">${Object.keys(GRFN).map(f => `<button type="button" data-grfn="${f}"><b>${f}</b><code>${GRFN[f][0].replace(/^\w+/, '')}</code><small>${GRFN[f][1]}</small></button>`).join('')}</div>`); return true; }
      const id = 'o' + Date.now(); GR.objs.push({ id, sheet: GR.cur, t: 'bar', title: 'Spent by category', x: 460, y: 340, w: 420, h: 260 }); GR.obj = id; GR.col = null; grAll(); grToast('Chart made from the Summary totals'); return true; }
    const sp = q('[data-grshape]'); if (sp) { $('#gr-pop')?.remove(); const id = 'o' + Date.now(); GR.objs.push({ id, sheet: GR.cur, t: 'shape', title: { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line' }[sp.dataset.grshape], shape: sp.dataset.grshape, x: 520, y: 120, w: 160, h: sp.dataset.grshape === 'line' ? 4 : 120 }); GR.obj = id; grAll(); return true; }
    if (q('[data-grgoto]')) { grPop(q('[data-grgoto]'), '<h6>Go to</h6>' + ['A1', 'E25', 'Summary!B9'].map(r => `<button class="crmi" type="button" data-grgo="${r}"><span>${r}</span></button>`).join('')); return true; }
    const go = q('[data-grgo]'); if (go) { $('#gr-pop')?.remove(); let [s, r] = go.dataset.grgo.includes('!') ? go.dataset.grgo.split('!') : [GR.cur, go.dataset.grgo]; GR.cur = s; GR.sel = { a: grRC(r), b: grRC(r) }; GR.obj = null; grAll(); return true; }
    const td = q('[data-grtodo]'); if (td) { grToast(td.dataset.grtodo); return true; }
    if (q('[data-grsum]')) { grToast(q('[data-grsum]').title); return true; }
    return false; }
  function grDelObj() { const was = GR.objs.slice(), o = GR.objs.find(x => x.id === GR.obj); GR.objs = GR.objs.filter(x => x.id !== GR.obj); GR.obj = null; grAll();
    if (o) grToast(`Deleted ${esc(o.title)}`, { icon: 'trash-2', undo: () => { GR.objs = was; GR.obj = o.id; grAll(); } }); }
  function grEach(fn) { const S = grSh(), R = grRange(); for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) { const k = grK(r, c); S.cells[k] = S.cells[k] || { v: '' }; fn(S.cells[k]); } }
  function grSort(c, dir) { const S = grSh(), last = GR.cur === 'Budget' ? 24 : 7, rows = []; for (let r = 1; r < last; r++) rows.push(GRL.slice(0, 6).map(L => S.cells[`${L}${r + 1}`]));
    const key = row => { const v = grEval(GR.cur, `${GRL[c]}${rows.indexOf(row) + 2}`); return v; }, keyed = rows.map((row, i) => [row, grEval(GR.cur, `${GRL[c]}${i + 2}`)]);
    keyed.sort((a, b) => (a[1] > b[1] ? 1 : a[1] < b[1] ? -1 : 0) * dir); keyed.forEach(([row], i) => row.forEach((cell, cc) => { const k = `${GRL[cc]}${i + 2}`; if (cell) S.cells[k] = cell; else delete S.cells[k]; }));
    grAll(); grToast(`Sorted by ${S.cells[`${GRL[c]}1`]?.v || 'column ' + GRL[c]}`); }
  function grFilter() { const hide = GR.hide || []; grAll(); grToast(hide.length ? `Hiding ${hide.join(', ')}` : 'Showing every category'); }

  function grPtr(e) { const cell = e.target.closest('[data-gc]'), o = e.target.closest('[data-grobj]'), hnd = e.target.closest('[data-grh]'); if (e.button) return;
    if (GR.edit && !e.target.closest('#gr-edit')) { const i = $('#gr-edit'); if (i?.value.startsWith('=') && cell) { e.preventDefault(); const k = cell.dataset.gc; const p = i.selectionStart; i.value = i.value.slice(0, p) + k + i.value.slice(p); i.setSelectionRange(p + k.length, p + k.length); GR.drag = { k: 'ref', i, start: k, p }; return; } grCommit([0, 0]); }
    if (hnd) { const ob = GR.objs.find(x => x.id === GR.obj); GR.drag = { k: 'size', o: ob, d: hnd.dataset.grh, x0: e.clientX, y0: e.clientY, r0: { ...ob } }; e.preventDefault(); return; }
    if (o) { GR.obj = o.dataset.grobj; GR.col = null; const ob = GR.objs.find(x => x.id === GR.obj); GR.drag = { k: 'obj', o: ob, x0: e.clientX, y0: e.clientY, r0: { ...ob } }; grObjs(); grSelDraw(); grLip(); grBar(); grPanels(); e.preventDefault(); return; }
    const rh = e.target.closest('[data-grrow]'); if (rh) { const r = +rh.dataset.grrow; GR.sel = { a: [r, 0], b: [r, 9] }; GR.obj = null; grLip(); grBar(); grSelDraw(); grPanels(); return; }
    if (!cell) return; const rc = grRC(cell.dataset.gc); GR.obj = null; if (e.shiftKey) GR.sel.b = rc; else GR.sel = { a: rc, b: rc };
    if (e.detail === 2) { grLip(); grBar(); grSelDraw(); grPanels(); grStartEdit(); return; }
    const S = grSh(), c = S.cells[cell.dataset.gc]; if (S.types[GRL[rc[1]]] === 'check' && !c?.hd && e.target.closest('.grck')) { S.cells[cell.dataset.gc] = { ...(c || {}), v: c?.v === 'TRUE' ? 'FALSE' : 'TRUE' }; grAll(); return; }
    GR.drag = { k: 'sel' }; grLip(); grBar(); grSelDraw(); grPanels(); }
  function grPtrMove(e) { const D = GR.drag; if (!D) return;
    if (D.k === 'sel') { const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#gr-grid [data-gc]'); if (cell) { const rc = grRC(cell.dataset.gc); if (rc[0] !== GR.sel.b[0] || rc[1] !== GR.sel.b[1]) { GR.sel.b = rc; grSelDraw(); grLip(); } } return; }
    if (D.k === 'ref') { const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#gr-grid [data-gc]'); if (cell) { const ref = cell.dataset.gc === D.start ? D.start : `${D.start}:${cell.dataset.gc}`, i = D.i, rest = i.value.slice(D.p).replace(/^[A-Z]\d+(?::[A-Z]\d+)?/, ''); i.value = i.value.slice(0, D.p) + ref + rest; } return; }
    const dx = e.clientX - D.x0, dy = e.clientY - D.y0, o = D.o;
    o.auto = false; if (D.k === 'obj') { o.x = Math.max(0, Math.round(D.r0.x + dx)); o.y = Math.max(0, Math.round(D.r0.y + dy)); }
    else { if (D.d.includes('e')) o.w = Math.max(160, Math.round(D.r0.w + dx)); if (D.d.includes('s')) o.h = Math.max(120, Math.round(D.r0.h + dy)); if (D.d.includes('w')) { o.w = Math.max(160, Math.round(D.r0.w - dx)); o.x = D.r0.x + D.r0.w - o.w; } if (D.d.includes('n')) { o.h = Math.max(120, Math.round(D.r0.h - dy)); o.y = D.r0.y + D.r0.h - o.h; } }
    grObjs(); grSelDraw(); }
  function grPtrUp() { if (GR.drag?.k === 'sel') grBar(); if (GR.drag?.k === 'ref') $('#gr-edit')?.focus(); if (GR.drag?.k === 'size' || GR.drag?.k === 'obj') grInsp(); GR.drag = null; }
  function renderGrid() { $('#gr-top').innerHTML = `<img src="${A}spreadsheets.svg" alt=""><b>September budget</b><span class="sumeta">Grid · Saved</span><span class="sutopr">${av('TH', 26)}<button class="bt sm fill" type="button" data-share>${ic('share-2')}Share</button><button class="ib" type="button" data-lmenu data-docmore title="More" aria-label="More">${ic('ellipsis')}</button></span>`;
    const w = $('#gr-scroll'); w.addEventListener('pointerdown', grPtr); addEventListener('pointermove', grPtrMove); addEventListener('pointerup', grPtrUp);
    w.addEventListener('scroll', () => $('#gr-work').classList.toggle('scrolled', w.scrollTop > 2)); new ResizeObserver(() => { grObjs(); grSelDraw(); }).observe(w); grAll(); }
  document.addEventListener('input', e => { const t = e.target;
    if (t.id === 'gr-edit') { grAuto(t); const f = $('[data-grfx]'); if (f) f.value = t.value; return; }
    if (t.matches?.('[data-grfx]')) { if (!GR.edit) { GR.edit = grK(...GR.sel.a); } grSh().cells[GR.edit] = { ...(grSh().cells[GR.edit] || {}), v: t.value }; grAuto(t); return; }
    if (t.matches?.('[data-grcw]')) { const v = +t.value; if (v > 30) { grSh().w[GR.col] = v; grDraw(); } return; }
    if (t.matches?.('[data-grow]')) { const o = GR.objs.find(x => x.id === GR.obj), v = +t.value; if (v > 60) { o[t.dataset.grow] = v; grObjs(); grSelDraw(); } return; }
    if (t.matches?.('[data-grtitle]')) { const o = GR.objs.find(x => x.id === GR.obj); o.title = t.value; grObjs(); grSelDraw(); } });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'grid') return; const t = e.target, S = grSh();
    if (GR.ac && $('#gr-pop .grac') && (e.key === 'Tab' || (e.key === 'Enter' && $('#gr-pop .grac button.on')))) { e.preventDefault(); grPickFn($('#gr-pop .grac button.on').dataset.grfn); return; }
    if (t.id === 'gr-edit') { if (e.key === 'Enter') { e.preventDefault(); grCommit([e.shiftKey ? -1 : 1, 0]); } else if (e.key === 'Tab') { e.preventDefault(); grCommit([0, e.shiftKey ? -1 : 1]); } else if (e.key === 'Escape') { e.preventDefault(); grCommit([0, 0], true); } return; }
    if (t.matches?.('[data-grfx]')) { if (e.key === 'Enter') { e.preventDefault(); GR.edit = null; $('#gr-pop')?.remove(); const [r, c] = GR.sel.a; GR.sel.a = GR.sel.b = [Math.min(S.rows - 1, r + 1), c]; t.blur(); grAll(); } else if (e.key === 'Escape') { t.blur(); GR.edit = null; grAll(); } return; }
    if (t.closest?.('input, textarea, [contenteditable="true"]')) return;
    const mod = e.metaKey || e.ctrlKey; if (e.key === '\\') { GR.focus = !GR.focus; grPanels(); requestAnimationFrame(grSelDraw); return; }
    if (mod && (e.key === 'b' || e.key === 'i')) { e.preventDefault(); grEach(c => { c[e.key] = !c[e.key]; }); grAll(); return; } if (mod) return;
    if (GR.obj && (e.key === 'Backspace' || e.key === 'Delete')) { grDelObj(); return; }
    if (e.key === 'Escape') { GR.obj = null; GR.col = null; grAll(); return; }
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [1, 0], Tab: [0, 1] }[e.key];
    if (mv) { e.preventDefault(); const m = e.key === 'Tab' && e.shiftKey ? [0, -1] : mv, base = e.shiftKey && e.key.startsWith('Arrow') ? GR.sel.b : GR.sel.a, n = [Math.max(0, Math.min(S.rows - 1, base[0] + m[0])), Math.max(0, Math.min(9, base[1] + m[1]))]; if (e.shiftKey && e.key.startsWith('Arrow')) GR.sel.b = n; else GR.sel = { a: n, b: n }; GR.obj = null; grLip(); grBar(); grSelDraw(); grPanels(); const el = $(`#gr-grid [data-gc="${grK(...n)}"]`); el?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { grEach(c => { c.v = ''; }); grAll(); return; }
    if (e.key === 'F2') { grStartEdit(); return; }
    if (e.key.length === 1 && !e.altKey) { e.preventDefault(); grStartEdit(e.key); } });

  /* ══ Stage ═══════════════════════════════════════════════════════════════════
     Presentations, from the same family as Canvas: a slide is a frame, and everything on it is the same object
     with the same inspector, handles and keys. Slides float top left, notes float bottom left, the inspector
     appears with a selection. Magic move is the default: anything with the same name on the next slide
     glides to its new place. Present opens a presenter view with the next slide, your notes and a timer. */
  const STW = 1920, STH = 1080, STNIGHT = 'linear-gradient(160deg, #1d2346, #0b0d18)', STPAPER = '#f6f3ee';
  let STID = 1;
  const stN = o => ({ id: 's' + STID++, op: 1, rot: 0, r: 0, fill: '#d9d9d9', ...o });
  const stT = o => stN({ t: 'text', ff: 'Figtree', fw: 400, fs: 48, lh: 1.2, ls: 0, color: '#ffffff', align: 'left', h: Math.round((o.fs || 48) * (o.lh || 1.2)), ...o });
  const stWord = (x, y, fs, color, extra = {}) => stT({ name: 'Wordmark', text: 'Luma 1.0', x, y, w: fs * 4.6, fs, fw: 650, ls: -.04, color, h: Math.round(fs * 1.05), lh: 1.05, ...extra });
  const ST = { cur: 0, sel: [], tool: 'move', left: true, notes: true, focus: false, itab: 'design', slidePanel: false, edit: null, drag: null, present: null, slides: [
    { name: 'Title', bg: STNIGHT, trans: 'magic', notes: 'Welcome, everyone. Priya opens with the milestones, then I do the live demo. Keep it under two minutes.', nodes: [
      stN({ t: 'ellipse', name: 'Glow', x: 1080, y: -360, w: 1180, h: 1180, fill: 'radial-gradient(circle, rgba(111,124,255,.7), rgba(111,124,255,0) 66%)' }),
      stT({ name: 'Eyebrow', text: 'LAUNCH WALKTHROUGH', x: 164, y: 300, w: 900, fs: 34, fw: 600, ls: .22, color: '#aab4ff' }), stWord(150, 360, 230, '#ffffff'),
      stT({ name: 'Subtitle', text: 'A better computer. October 14.', x: 164, y: 640, w: 1300, fs: 58, color: '#c9ccdf' })] },
    { name: 'Why now', bg: STPAPER, trans: 'magic', notes: 'Pause after the second sentence. Let it land.', nodes: [stWord(160, 110, 44, '#16161a'),
      stT({ name: 'Statement', text: 'Computers got louder. We made one that’s calm.', x: 160, y: 300, w: 1500, h: 330, ff: 'Instrument Serif', fs: 132, lh: 1.02, ls: -.01, color: '#16161a' })] },
    { name: 'Milestones', bg: STPAPER, trans: 'magic', notes: 'Priya: RC2 passed on all twelve test laptops. Press photos went out October 1.', nodes: [stWord(160, 110, 44, '#16161a'),
      stT({ name: 'Title', text: 'Getting to October', x: 160, y: 230, w: 1300, fs: 96, fw: 650, ls: -.03, color: '#16161a', h: 110 }),
      stN({ t: 'rect', name: 'Track', x: 178, y: 616, w: 1520, h: 4, fill: 'rgba(22,22,26,.18)' }),
      ...[['RC1', 'August 12'], ['RC2', 'September 20'], ['Press', 'October 1'], ['Launch', 'October 14']].flatMap(([a, b], i) => [stN({ t: 'ellipse', name: `Dot ${i + 1}`, x: 160 + i * 500, y: 600, w: 36, h: 36, fill: i === 3 ? '#e8553b' : '#6f7cff' }),
        stT({ name: `Milestone ${i + 1}`, text: `${a}\n${b}`, x: 160 + i * 500, y: 670, w: 420, h: 120, fs: 40, lh: 1.35, color: '#16161a', fw: 500 })])] },
    { name: 'Twelve', bg: STNIGHT, trans: 'magic', notes: 'Sam ran every install himself. Thank him here.', nodes: [
      stT({ name: 'Big number', text: '12', x: 150, y: 170, w: 800, h: 440, fs: 440, fw: 650, lh: 1, ls: -.05, color: '#ffffff' }),
      stT({ name: 'Caption', text: 'test laptops. Every install passed.', x: 170, y: 650, w: 820, h: 170, fs: 64, lh: 1.25, color: '#c9ccdf' }),
      stN({ t: 'image', name: 'Photo', x: 1100, y: 150, w: 660, h: 780, r: 40, img: PH + 'life-work-suite.webp' })] },
    { name: 'The loft', bg: '#0b0d18', trans: 'fade', notes: 'Nora: this is where it all happened.', nodes: [
      stN({ t: 'image', name: 'Full bleed', x: 0, y: 0, w: STW, h: STH, img: PH + 'life-hero-studio.webp' }), stN({ t: 'rect', name: 'Shade', x: 0, y: 560, w: STW, h: 520, fill: 'linear-gradient(transparent, rgba(0,0,0,.72))' }),
      stT({ name: 'Caption', text: 'Built in the open, in a loft in Oakland.', x: 130, y: 900, w: 1500, fs: 64, color: '#ffffff', fw: 500 })] },
    { name: 'Demo', bg: STNIGHT, trans: 'magic', notes: 'Filer first, because everyone gets it instantly. Then Messages, then the shelf and the notification lip.', nodes: [
      stT({ name: 'Title', text: 'Live demo', x: 160, y: 200, w: 1200, fs: 132, fw: 650, ls: -.03, color: '#ffffff', h: 150 }),
      ...['Filer', 'Messages', 'The shelf'].flatMap((n, i) => [stN({ t: 'rect', name: `Card ${i + 1}`, x: 160 + i * 540, y: 520, w: 480, h: 260, r: 36, fill: 'rgba(255,255,255,.08)', stroke: { c: 'rgba(255,255,255,.14)', w: 2 } }),
        stT({ name: `Card label ${i + 1}`, text: `${i + 1}  ${n}`, x: 210 + i * 540, y: 690, w: 400, fs: 52, fw: 600, color: '#ffffff' })])] },
    { name: 'Thanks', bg: STNIGHT, trans: 'magic', notes: 'The ISO link goes live at 7:30, not before.', nodes: [
      stN({ t: 'ellipse', name: 'Glow', x: 360, y: -200, w: 1200, h: 1200, fill: 'radial-gradient(circle, rgba(111,124,255,.55), rgba(111,124,255,0) 66%)' }),
      stWord(520, 380, 190, '#ffffff', { align: 'center', w: 880 }), stT({ name: 'URL', text: 'simplyluma.com', x: 560, y: 640, w: 800, fs: 58, color: '#aab4ff', align: 'center' })] }
  ] };
  const stS = () => ST.slides[ST.cur], stG = id => stS().nodes.find(n => n.id === id), stSel = () => ST.sel.map(stG).filter(Boolean);
  const STFONT = { Figtree: 'Figtree, system-ui, sans-serif', 'Instrument Serif': "'Instrument Serif', Georgia, serif", Georgia: 'Georgia, serif' };

  /* ── Drawing a slide: the same objects as Canvas ── */
  function stNode(n, key) { let st = `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;${n.op < 1 ? `opacity:${n.op};` : ''}${n.rot ? `transform:rotate(${n.rot}deg);` : ''}`;
    if (n.t === 'rect') st += `background:${n.fill};border-radius:${n.r}px;`; if (n.t === 'ellipse') st += `background:${n.fill};`; if (n.t === 'image') st += `background-image:url('${n.img}');border-radius:${n.r}px;`;
    if (n.stroke) st += `box-shadow:inset 0 0 0 ${n.stroke.w}px ${n.stroke.c};`;
    const inner = n.t === 'text' ? `<span class="cvtx" style="font-family:${STFONT[n.ff]};font-size:${n.fs}px;font-weight:${n.fw};line-height:${n.lh};letter-spacing:${n.ls}em;color:${n.color};text-align:${n.align}"${ST.edit === n.id ? ' contenteditable="true" spellcheck="false"' : ''}>${esc(n.text)}</span>` : '';
    return `<div class="cvn cv-${n.t}" ${key ? `data-stk="${esc(n.name)}"` : `data-stn="${n.id}"`} style="${st}">${inner}</div>`; }
  const stSlideHTML = (s, key) => s.nodes.map(n => stNode(n, key)).join('');
  const stNarrow = () => { const w = $('#st-work')?.clientWidth; return !!w && w < 560; };
  function stFit() { const w = $('#st-work'); if (!w) return 1;
    if (stNarrow()) { const T = 120, z = (w.clientWidth - 32) / STW; ST.z = z; ST.ox = 16; ST.oy = T; stStrip(); return z; }
    $('#st-strip')?.remove();
    const L = (ST.left || ST.notes) && !ST.focus ? 282 : 36, R = (ST.sel.length || ST.slidePanel) && !ST.focus ? 306 : 36, T = 36, B = 104;   // the slide sits beside the left column and the inspector
    const z = Math.min((w.clientWidth - L - R) / STW, (w.clientHeight - T - B) / STH); ST.z = z; ST.ox = L + (w.clientWidth - L - R - STW * z) / 2; ST.oy = T + (w.clientHeight - T - B - STH * z) / 2; return z; }
  function stDraw() { const el = $('#st-slide'); if (!el) return; const s = stS(); stFit(); el.style.cssText = `width:${STW}px;height:${STH}px;background:${s.bg};transform:translate(${ST.ox}px, ${ST.oy}px) scale(${ST.z})`; el.innerHTML = stSlideHTML(s);
    if (ST.edit) { const sp = el.querySelector(`[data-stn="${ST.edit}"] .cvtx`); if (sp) { sp.focus(); const r = document.createRange(); r.selectNodeContents(sp); getSelection().removeAllRanges(); getSelection().addRange(r); sp.addEventListener('blur', stEndEdit, { once: true }); } }
    stOver(); }
  function stOver() { const o = $('#st-over'); if (!o) return; const S = stSel(); let h = ''; const sc = n => ({ x: ST.ox + n.x * ST.z, y: ST.oy + n.y * ST.z, w: n.w * ST.z, h: n.h * ST.z });
    const hv = ST.hover && !ST.sel.includes(ST.hover) && stG(ST.hover); if (hv && !ST.drag) { const r = sc(hv); h += `<i class="cvhov" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></i>`; }
    if (S.length && !ST.edit) { const x = Math.min(...S.map(n => n.x)), y = Math.min(...S.map(n => n.y)), X = Math.max(...S.map(n => n.x + n.w)), Y = Math.max(...S.map(n => n.y + n.h)), r = sc({ x, y, w: X - x, h: Y - y });
      h += `<div class="cvbox" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">${S.length === 1 ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(d => `<i class="cvh ${d}" data-sth="${d}"></i>`).join('') : ''}<em>${Math.round(X - x)} × ${Math.round(Y - y)}</em></div>`;
      if (ST.drag?.k === 'move') { const cx = x + (X - x) / 2; if (Math.abs(cx - STW / 2) < 4) h += `<i class="stguide v" style="left:${ST.ox + STW / 2 * ST.z}px;top:${ST.oy}px;height:${STH * ST.z}px"></i>`; } }
    o.innerHTML = h; }

  /* Stage on a phone: under the slide, every slide as a strip you swipe through; tap one to go to it. Then the notes. */
  function stStrip() { const w = $('#st-work'); let el = $('#st-strip'); if (!stNarrow()) { el?.remove(); return; }
    if (!el) { w.insertAdjacentHTML('beforeend', '<div class="ststrip" id="st-strip"></div>'); el = $('#st-strip'); }
    const tw = 104, k = tw / STW, top = ST.oy + STH * ST.z + 18; el.style.top = top + 'px';
    el.innerHTML = `<button class="stsh" type="button" data-stslide aria-label="Slide settings"><b>Slide ${ST.cur + 1}</b><span>of ${ST.slides.length} · ${esc(stS().name || '')}</span>${ic('sliders-horizontal')}</button><div class="strow">${ST.slides.map((s, i) => `<button class="stth${i === ST.cur ? ' on' : ''}" type="button" data-stgo="${i}" aria-label="Slide ${i + 1}"><span class="stmini" style="width:${tw}px;height:${STH * k}px"><span style="width:${STW}px;height:${STH}px;background:${s.bg};transform:scale(${k})">${stSlideHTML(s)}</span></span><em>${i + 1}</em></button>`).join('')}<button class="stadd" type="button" data-stnew aria-label="New slide">${ic('plus')}</button></div>
      ${stS().notes ? `<div class="stpn"><b>${ic('notebook-pen')}Notes</b><p>${esc(stS().notes)}</p></div>` : ''}`;
    /* its own taps: the slide canvas underneath treats pointer events as drawing */
    el.onpointerdown = e => e.stopPropagation(); el.onclick = e => { const g = e.target.closest('[data-stgo]'); if (g) { e.stopPropagation(); ST.cur = +g.dataset.stgo; ST.sel = []; stAll(); } if (e.target.closest('[data-stslide]')) { e.stopPropagation(); ST.slidePanel = true; ST.sel = []; stAll(); } };
    requestAnimationFrame(() => { const r = el.querySelector('.strow'), on = el.querySelector('.stth.on'); if (r && on) r.scrollLeft = on.offsetLeft - (r.clientWidth - on.offsetWidth) / 2; }); }
  /* ── Panels: slides top left, notes bottom left, inspector top right ── */
  function stLeft() { const el = $('#st-left'); el.className = 'supanel l' + (!ST.left || ST.focus ? ' min' : '') + (ST.focus ? ' gone' : '') + (ST.notes ? ' short' : '');
    if (!ST.left) { el.innerHTML = `<button class="supill" type="button" data-stleft>${ic('gallery-vertical')}<b>Slide ${ST.cur + 1}</b><span>of ${ST.slides.length}</span></button>`; return; }
    const tw = 188, k = tw / STW;
    el.innerHTML = `<header class="suph1"><button class="supage" type="button" data-sttodo="Launch walkthrough.stage"><b>Launch walkthrough</b>${ic('chevron-down')}</button><button class="ib" type="button" data-stleft title="Hide slides" aria-label="Hide slides">${ic($('#w-stage').classList.contains('phone') ? 'x' : 'panel-left')}</button></header>
      <div class="suscroll stthumbs">${ST.slides.map((s, i) => `<button class="stth${i === ST.cur ? ' on' : ''}" type="button" data-stgo="${i}"><em>${i + 1}</em><span class="stmini" style="width:${tw}px;height:${STH * k}px"><span style="width:${STW}px;height:${STH}px;background:${s.bg};transform:scale(${k})">${stSlideHTML(s)}</span></span>${s.trans === 'magic' && i ? `<i class="stmm" title="Magic move from the slide before">${ic('sparkles')}</i>` : ''}</button>`).join('')}
        <button class="stadd" type="button" data-stnew>${ic('plus')}New slide</button></div>`; }
  function stNotes() { const el = $('#st-notes'); el.className = 'supanel stnotes' + (!ST.notes || ST.focus ? ' min' : '') + (ST.focus ? ' gone' : '');
    el.innerHTML = !ST.notes ? `<button class="supill" type="button" data-stnotes>${ic('notebook-pen')}Notes</button>` : `<header><b>${ic('notebook-pen')}Notes</b><span>Only you see these</span><button class="ib sm" type="button" data-stnotes title="Hide notes" aria-label="Hide notes">${ic('minus')}</button></header><textarea data-stnote spellcheck="true" placeholder="What you want to say on this slide">${esc(stS().notes || '')}</textarea>`; }
  const stHex = c => /^#/.test(c) ? c.toUpperCase().slice(1) : c.includes('gradient') ? 'Gradient' : c.startsWith('rgba') ? 'Tint' : c;
  function stInsp() { const el = $('#st-right'), S = stSel(), s = stS(); if (ST.focus) { el.className = 'supanel r min gone'; return; }
    const sec = (t, b, add = '') => `<section class="susec"><header><b>${t}</b>${add}</header>${b}</section>`, fld = (k, l, v, u = '') => `<label class="sufld"><span>${l}</span><input data-stp="${k}" value="${v}" inputmode="decimal">${u ? `<em>${u}</em>` : ''}</label>`;
    const clr = (k, c) => `<div class="suclrrow"><button class="suclr" type="button" data-stclr="${k}" style="--c:${c}"></button><input class="suhex" data-stp="${k}" value="${stHex(c)}" spellcheck="false"${/gradient|rgba/.test(c) ? ' readonly' : ''}></div>`;
    if (!S.length && !ST.slidePanel && !(stNarrow() && ST.px === 'insp')) { el.className = 'supanel r min'; el.innerHTML = `<button class="supill" type="button" data-stslide>${ic('rectangle-horizontal')}Slide ${ST.cur + 1}</button>`; return; }
    el.className = 'supanel r';
    if (!S.length) { el.innerHTML = `<header class="suinsph">${ic('rectangle-horizontal')}<b>Slide ${ST.cur + 1} · ${esc(s.name)}</b><button class="ib" type="button" data-stclose title="Close" aria-label="Close">${ic('x')}</button></header><div class="suscroll">
      ${sec('Background', `<div class="stbgs">${[['Night', STNIGHT], ['Paper', STPAPER], ['Ink', '#16161a'], ['Sand', '#e9e2d6'], ['Iris', 'linear-gradient(135deg, #6f7cff, #aab4ff)']].map(([n, c]) => `<button type="button" class="${s.bg === c ? 'on' : ''}" data-stbg="${c}" style="--c:${c}" title="${n}"></button>`).join('')}</div>`)}
      ${sec('Transition', `<div class="sttrans">${[['magic', 'sparkles', 'Magic move', 'Things with the same name glide into place'], ['fade', 'blend', 'Fade', ''], ['none', 'square', 'Cut', '']].map(([k, i, n, d]) => `<button type="button" class="${s.trans === k ? 'on' : ''}" data-sttr="${k}">${ic(i)}<span><b>${n}</b>${d ? `<small>${d}</small>` : ''}</span></button>`).join('')}</div>`)}
      ${sec('Arrange', lStack([{ icon: 'copy', label: 'Duplicate', attr: 'data-stdup' }, { icon: 'trash-2', label: 'Delete', attr: 'data-stdelslide', danger: true, disabled: ST.slides.length < 2 }], 'sm'))}</div>`; requestAnimationFrame(segs); return; }
    const n = S[0], one = S.length === 1;
    el.innerHTML = `<header class="suinsph">${one ? `${ic({ text: 'type', rect: 'square', ellipse: 'circle', image: 'image' }[n.t])}<input class="suname" data-stname value="${esc(n.name)}" spellcheck="false">` : `${ic('layers')}<b>${S.length} objects</b>`}<button class="ib" type="button" data-stclose title="Close" aria-label="Close">${ic('x')}</button></header>
      ${seg([['design', 'Design'], ['animate', 'Animate']], ST.itab, 'data-stitab', 'Inspector', 'sutabs')}<div class="suscroll">${ST.itab === 'animate' ? sec('Build in', `<div class="sttrans">${[['none', 'square', 'Already there'], ['appear', 'eye', 'Appear'], ['fade', 'blend', 'Fade in'], ['rise', 'arrow-up', 'Rise']].map(([k, i, l]) => `<button type="button" class="${(n.build || 'none') === k ? 'on' : ''}" data-stbuild="${k}">${ic(i)}<span><b>${l}</b></span></button>`).join('')}</div><p class="sunote">${n.name} on slide ${ST.cur + 1}${ST.slides[ST.cur + 1]?.nodes.some(m => m.name === n.name) ? `. Moves to its place on slide ${ST.cur + 2} with magic move.` : ''}</p>`)
      : sec('Align to slide', `<div class="sualign">${[['l', 'Left'], ['c', 'Centre'], ['r', 'Right'], ['t', 'Top'], ['m', 'Middle'], ['b', 'Bottom']].map(([k, t]) => `<button class="ib" type="button" data-stal="${k}" title="Align ${t.toLowerCase()}">${ic({ l: 'align-start-vertical', c: 'align-center-vertical', r: 'align-end-vertical', t: 'align-start-horizontal', m: 'align-center-horizontal', b: 'align-end-horizontal' }[k])}</button>`).join('')}</div>`)
        + (one ? sec('Layout', `<div class="sugrid2">${fld('x', 'X', Math.round(n.x))}${fld('y', 'Y', Math.round(n.y))}${fld('w', 'W', Math.round(n.w))}${fld('h', 'H', Math.round(n.h))}${fld('rot', '↻', n.rot, '°')}${n.t === 'rect' || n.t === 'image' ? fld('r', '◜', n.r) : '<i></i>'}</div>`)
        + (n.t === 'text' ? sec('Text', `<button class="suselect" type="button" data-stfont style="font-family:${STFONT[n.ff]}">${n.ff}${ic('chevron-down')}</button><div class="sugrid2">${fld('fs', 'Size', n.fs)}${fld('fw', 'Weight', n.fw)}${fld('lh', 'Line', n.lh)}${fld('ls', 'Track', n.ls)}</div>${seg([['left', ic('text-align-start'), 'Left'], ['center', ic('text-align-center'), 'Centre'], ['right', ic('text-align-end'), 'Right']], n.align, 'data-stta', 'Align', 'ico')}${clr('color', n.color)}`) : '')
        + sec('Appearance', `<div class="sugrid2">${fld('op', 'Opacity', Math.round(n.op * 100), '%')}<span></span></div>`) + (n.t === 'text' ? '' : n.t === 'image' ? sec('Fill', `<div class="suimg" style="background-image:url('${n.img}')"><button class="bt sm" type="button" data-sttodo="The file picker opens for images">Replace…</button></div>`) : sec('Fill', clr('fill', n.fill))) : '')}</div>`;
    requestAnimationFrame(segs); }
  /* Stage on a phone: the slide, the strip and the notes stay as they are; ‹ Launch walkthrough top left. One bar in two
     rows: the tools and Layout across the top; under a hairline, the slide's actions (Slide settings, which grow the
     inspector in the bar, New, Duplicate, Delete), or for a selected element, Style and Done. */
  function stBarPhone() { const bar = $('#st-bar'), S = stSel(), X = ST.px || ''; $('#w-stage').classList.add('stph'); bar.classList.add('phnofit', 'stphbar');
    if (!$('#st-ptop')) $('#st-work').insertAdjacentHTML('beforeend', `<div class="rlptop" id="st-ptop"><button class="flo rlback2" type="button" data-sttodo="Your decks are in Files, under Documents">${ic('chevron-left')}<span>Launch walkthrough</span></button></div>`);
    const t = (k, icn, label) => `<button class="cvt2${ST.tool === k || (k === 'shape' && ['rect', 'ellipse'].includes(ST.tool)) ? ' on' : ''}" type="button" data-sttool="${k}" aria-label="${label}">${ic(icn)}</button>`;
    const ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}<span>${label}</span></button>`;
    const panel = X === 'insp' ? `<div class="fexp cvpan">${$('#st-right').innerHTML}</div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, `${panel}<div class="cvr1">${t('move', 'mouse-pointer-2', 'Move')}${t('text', 'type', 'Text')}${t('shape', ST.tool === 'ellipse' ? 'circle' : 'square', 'Shapes')}${t('image', 'image', 'Image')}<button class="stlay2" type="button" data-stlayouts>${ic('layout-template')}<span>Layout</span>${ic('chevron-down')}</button></div>
      <div class="cvr2">${S.length ? `${ib('data-stpx="insp"', 'sliders-horizontal', 'Style', X === 'insp')}${ib('data-stdesel', 'x', 'Done')}` : `${ib('data-stpx="insp"', 'rectangle-horizontal', 'Slide', X === 'insp')}${ib('data-stnew', 'plus', 'New')}${ib('data-stdup', 'copy', 'Duplicate')}${ib('data-stdelslide', 'trash-2', 'Delete')}`}</div>`);
    $('#st-work').dataset.tool = ST.tool; }
  function stTools() { if (stNarrow()) return stBarPhone(); $('#w-stage').classList.remove('stph'); $('#st-bar').classList.remove('phnofit', 'stphbar', 'phgrow'); $('#st-ptop')?.remove();
    const t = (k, icn, label, key) => `<button class="sut${ST.tool === k || (k === 'shape' && ['rect', 'ellipse'].includes(ST.tool)) ? ' on' : ''}" type="button" data-sttool="${k}" title="${label} · ${key}">${ic(icn)}${k === 'shape' ? '<i class="sumore"></i>' : ''}</button>`;
    setBar($('#st-bar'), `${t('move', 'mouse-pointer-2', 'Move', 'V')}${t('text', 'type', 'Text', 'T')}${t('shape', ST.tool === 'ellipse' ? 'circle' : 'square', 'Shapes', 'R')}${t('image', 'image', 'Image', 'I')}<span class="vr"></span>
      <button class="bt stlay" type="button" data-stlayouts>${ic('layout-template')}Layout${ic('chevron-down')}</button><button class="sut" type="button" data-stnew title="New slide · ⌘⏎">${ic('plus')}</button>`); $('#st-work').dataset.tool = ST.tool; }
  function stPanels() { stLeft(); stNotes(); stInsp(); }
  function stAll() { stDraw(); stPanels(); stTools(); }
  const stToast = (msg, o) => lToast($('#w-stage'), msg, o);   // one notice for the whole OS
  function stPop(anchor, html, up) { $('#st-pop')?.remove(); const w = $('#w-stage'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop supop" id="st-pop">${html}</div>`); const p = $('#st-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left + r.width / 2 - p.offsetWidth / 2)) + 'px'; if (up) p.style.bottom = (wr.bottom - r.top + 8) + 'px'; else p.style.top = (r.bottom - wr.top + 6) + 'px'; }
  const STLAY = { Title: s => [stT({ name: 'Title', text: 'Title', x: 160, y: 380, w: 1500, fs: 150, fw: 650, ls: -.03, color: s.dark ? '#fff' : '#16161a', h: 170 }), stT({ name: 'Subtitle', text: 'Subtitle', x: 164, y: 580, w: 1200, fs: 56, color: s.dark ? '#c9ccdf' : '#5a5a60' })],
    Statement: s => [stT({ name: 'Statement', text: 'Say one thing, and say it well.', x: 160, y: 300, w: 1500, h: 330, ff: 'Instrument Serif', fs: 132, lh: 1.02, color: s.dark ? '#fff' : '#16161a' })],
    'Big number': s => [stT({ name: 'Big number', text: '100%', x: 150, y: 200, w: 1500, h: 420, fs: 400, fw: 650, lh: 1, ls: -.05, color: s.dark ? '#fff' : '#16161a' }), stT({ name: 'Caption', text: 'What the number means', x: 170, y: 650, w: 1200, fs: 64, color: s.dark ? '#c9ccdf' : '#5a5a60' })],
    Photo: () => [stN({ t: 'image', name: 'Full bleed', x: 0, y: 0, w: STW, h: STH, img: PH + 'life-sync-terrace.webp' }), stT({ name: 'Caption', text: 'A caption for the photo', x: 130, y: 900, w: 1500, fs: 64, color: '#ffffff', fw: 500 })],
    Blank: () => [] };
  function stNew(lay = 'Title') { const dark = lay !== 'Statement', s = { name: lay, bg: dark ? STNIGHT : STPAPER, trans: 'magic', notes: '', nodes: STLAY[lay]({ dark }) }; ST.slides.splice(ST.cur + 1, 0, s); ST.cur++; ST.sel = []; stAll(); requestAnimationFrame(() => $('#st-left .stth.on')?.scrollIntoView({ block: 'nearest' })); }

  /* ── Editing: the same hands as Canvas ── */
  function stEndEdit() { const n = stG(ST.edit); if (n) { const sp = $(`#st-slide [data-stn="${n.id}"] .cvtx`); if (sp) { n.text = sp.innerText.replace(/\n$/, '') || 'Text'; n.h = Math.max(Math.round(n.fs * n.lh), Math.round(sp.offsetHeight)); } } ST.edit = null; stAll(); }
  function stPtr(e) { const w = $('#st-work'); if (e.button > 1 || e.target.closest('.supanel, .fbar, .crpop')) return; $('#st-pop')?.remove(); if (ST.edit && !e.target.closest(`[data-stn="${ST.edit}"]`)) stEndEdit(); if (ST.edit) return;
    const wr = w.getBoundingClientRect(), sx = (e.clientX - wr.left - ST.ox) / ST.z, sy = (e.clientY - wr.top - ST.oy) / ST.z, hnd = e.target.closest('[data-sth]')?.dataset.sth, hit = e.target.closest('#st-slide [data-stn]'), s = stS();
    if (ST.tool === 'text') { const n = stT({ name: 'Text', text: 'Type something', x: Math.round(sx), y: Math.round(sy), w: 900, color: /f6|e9/i.test(s.bg) ? '#16161a' : '#ffffff' }); s.nodes.push(n); ST.sel = [n.id]; ST.edit = n.id; ST.tool = 'move'; stAll(); return; }
    if (['rect', 'ellipse', 'image'].includes(ST.tool)) { const n = stN({ t: ST.tool, name: { rect: 'Rectangle', ellipse: 'Ellipse', image: 'Image' }[ST.tool], x: Math.round(sx), y: Math.round(sy), w: 0, h: 0, fill: '#6f7cff', img: ST.tool === 'image' ? PH + 'life-ari-street.webp' : undefined, r: ST.tool === 'image' ? 24 : 0 }); s.nodes.push(n); ST.sel = [n.id]; ST.drag = { k: 'draw', n, x0: sx, y0: sy }; stDraw(); stPanels(); return; }
    if (hnd) { const n = stSel()[0]; ST.drag = { k: 'size', d: hnd, n, r0: { x: n.x, y: n.y, w: n.w, h: n.h }, x0: sx, y0: sy }; return; }
    if (hit) { const id = hit.dataset.stn; if (e.shiftKey) ST.sel = ST.sel.includes(id) ? ST.sel.filter(i => i !== id) : [...ST.sel, id]; else if (!ST.sel.includes(id)) ST.sel = [id];
      if (e.detail === 2 && stG(id).t === 'text') { ST.edit = id; stAll(); return; } ST.drag = { k: 'move', x0: sx, y0: sy, last: [0, 0] }; ST.slidePanel = false; stDraw(); stPanels(); return; }
    ST.sel = []; stDraw(); stPanels(); }
  function stPtrMove(e) { const w = $('#st-work'); if (!w) return; const wr = w.getBoundingClientRect(), sx = (e.clientX - wr.left - ST.ox) / ST.z, sy = (e.clientY - wr.top - ST.oy) / ST.z, D = ST.drag;
    if (!D) { const h = e.target.closest?.('#st-slide [data-stn]')?.dataset.stn || null; if (h !== ST.hover) { ST.hover = h; stOver(); } return; }
    if (D.k === 'move') { let dx = Math.round(sx - D.x0), dy = Math.round(sy - D.y0); const S = stSel(), cx = Math.min(...S.map(n => n.x)) + (Math.max(...S.map(n => n.x + n.w)) - Math.min(...S.map(n => n.x))) / 2 + dx - D.last[0]; if (Math.abs(cx - STW / 2) < 12) dx += Math.round(STW / 2 - cx);   // snaps to the slide's centre
      S.forEach(n => { n.x += dx - D.last[0]; n.y += dy - D.last[1]; }); D.last = [dx, dy]; stDraw(); return; }
    if (D.k === 'draw') { const n = D.n; n.x = Math.round(Math.min(D.x0, sx)); n.y = Math.round(Math.min(D.y0, sy)); n.w = Math.round(Math.abs(sx - D.x0)); n.h = Math.round(Math.abs(sy - D.y0)); if (e.shiftKey) n.h = n.w; stDraw(); return; }
    if (D.k === 'size') { const r = { ...D.r0 }, dx = sx - D.x0, dy = sy - D.y0, d = D.d; if (d.includes('e')) r.w = Math.max(4, D.r0.w + dx); if (d.includes('s')) r.h = Math.max(4, D.r0.h + dy); if (d.includes('w')) { r.w = Math.max(4, D.r0.w - dx); r.x = D.r0.x + D.r0.w - r.w; } if (d.includes('n')) { r.h = Math.max(4, D.r0.h - dy); r.y = D.r0.y + D.r0.h - r.h; }
      Object.assign(D.n, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }); stDraw(); } }
  function stPtrUp() { const D = ST.drag; if (!D) return; ST.drag = null; if (D.k === 'draw') { if (D.n.w < 6) { D.n.w = 400; D.n.h = 300; } ST.tool = 'move'; stTools(); } stDraw(); stPanels(); }

  /* ── Present: presenter view, with magic move ── */
  function stPresent(from = ST.cur) { ST.present = { i: from, t0: Date.now(), audience: false }; document.body.insertAdjacentHTML('beforeend', `<div class="stpres" id="st-pres"><div class="stpstage" id="st-pstage"><div class="stpslide" id="st-pslide"></div></div><aside class="stpside" id="st-pside"></aside>
      <footer class="stpbar"><button class="ib" type="button" data-stpv="-1" title="Previous">${ic('chevron-left')}</button><span id="st-pcount"></span><button class="ib" type="button" data-stpv="1" title="Next">${ic('chevron-right')}</button><i></i><button class="bt sm" type="button" data-stpaud>Audience view</button><button class="bt sm" type="button" data-stpx>End · Esc</button></footer></div>`);
    const p = $('#st-pres'); p.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) { stPGo(1); return; } if (b.dataset.stpv) stPGo(+b.dataset.stpv); if ('stpx' in b.dataset) stPEnd(); if ('stpaud' in b.dataset) { ST.present.audience = !ST.present.audience; p.classList.toggle('aud', ST.present.audience); b.textContent = ST.present.audience ? 'Presenter view' : 'Audience view'; stPFit(); } });
    addEventListener('resize', stPFit); stPShow(null); ST.present.tick = setInterval(stPSide, 1000); requestAnimationFrame(() => p.classList.add('on')); }
  function stPFit() { const st = $('#st-pstage'), sl = $('#st-pslide'); if (!st || !sl) return; const z = Math.min(st.clientWidth / STW, st.clientHeight / STH); sl.style.transform = `translate(${(st.clientWidth - STW * z) / 2}px, ${(st.clientHeight - STH * z) / 2}px) scale(${z})`; }
  function stPShow(prev) { const s = ST.slides[ST.present.i], el = $('#st-pslide'), magic = prev && s.trans === 'magic', fade = prev && s.trans === 'fade';
    el.style.background = s.bg; el.style.transition = magic || fade ? 'background .7s ease' : 'none'; const have = new Map([...el.children].map(c => [c.dataset.stk, c])), keep = new Set();
    s.nodes.forEach(n => { const html = stNode(n, true), old = magic ? have.get(n.name) : null;
      if (old && !keep.has(n.name)) { keep.add(n.name); const tmp = document.createElement('div'); tmp.innerHTML = html; const nw = tmp.firstElementChild; old.classList.add('glide'); old.setAttribute('style', nw.getAttribute('style')); const sp = old.querySelector('.cvtx'), nsp = nw.querySelector('.cvtx'); if (sp && nsp) { sp.setAttribute('style', nsp.getAttribute('style')); sp.textContent = nsp.textContent; } el.appendChild(old); }
      else { el.insertAdjacentHTML('beforeend', html); const nw = el.lastElementChild; nw.dataset.stk = keep.has(n.name) ? n.name + '·' : n.name; if (prev) { nw.style.opacity = 0; requestAnimationFrame(() => requestAnimationFrame(() => { nw.classList.add('glide'); nw.style.opacity = n.op; })); } } });
    have.forEach((c, k) => { if (!keep.has(k) || !magic) { if (!prev) { c.remove(); return; } c.classList.add('glide'); c.style.opacity = 0; setTimeout(() => c.remove(), 700); } });
    stPFit(); stPSide(); }
  function stPGo(d) { const P = ST.present, n = P.i + d; if (n < 0) return; if (n >= ST.slides.length) { stPEnd(); return; } P.i = n; stPShow(true); }
  function stPSide() { const P = ST.present; if (!P) return; const s = ST.slides[P.i], nx = ST.slides[P.i + 1], el = $('#st-pside'), sec = Math.floor((Date.now() - P.t0) / 1000), k = 300 / STW;
    $('#st-pcount').textContent = `${P.i + 1} of ${ST.slides.length}`;
    el.innerHTML = `<div class="stptime"><b>${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</b><span>Elapsed</span></div><h6>Next</h6>${nx ? `<span class="stmini" style="width:300px;height:${STH * k}px"><span style="width:${STW}px;height:${STH}px;background:${nx.bg};transform:scale(${k})">${stSlideHTML(nx)}</span></span>` : '<p class="stpend">End of the show</p>'}<h6>Notes</h6><p class="stpnotes">${esc(s.notes || 'No notes for this slide.')}</p>`; }
  function stPEnd() { const P = ST.present; if (!P) return; clearInterval(P.tick); removeEventListener('resize', stPFit); const p = $('#st-pres'); p.classList.remove('on'); setTimeout(() => p.remove(), 300); ST.cur = P.i; ST.present = null; stAll(); }

  function stClick(e, hit) { const q = s => hit(s);
    if (stNarrow()) { const px = q('[data-stpx]'); if (px) { ST.px = ST.px === 'insp' ? '' : 'insp'; stInsp(); stBarPhone(); return true; }
      if (q('[data-stdesel]')) { ST.sel = []; ST.px = ''; stAll(); return true; }
      if (q('#st-bar [data-stclose]')) { ST.px = ''; ST.slidePanel = false; stAll(); return true; }
      if (q('[data-stnew]') || q('[data-stdelslide]') || q('[data-stgo]')) ST.px = ''; }
    if (q('#st-work') && !q('.supanel, .fbar')) return true;
    if (!q('#st-pop')) $('#st-pop')?.remove();
    const tl = q('[data-sttool]'); if (tl) { const k = tl.dataset.sttool; if (k === 'shape') { stPop(tl, [['rect', 'square', 'Rectangle', 'R'], ['ellipse', 'circle', 'Ellipse', 'O']].map(([k2, i, n, s]) => `<button class="crmi" type="button" data-sttool="${k2}">${ic(i)}<span>${n}</span><kbd class="sukbd">${s}</kbd></button>`).join(''), true); return true; } $('#st-pop')?.remove(); ST.tool = k; stTools(); return true; }
    const go = q('[data-stgo]'); if (go) { ST.cur = +go.dataset.stgo; ST.sel = []; stAll(); return true; }
    if (q('[data-stleft]')) { ST.left = !ST.left; stAll(); return true; } if (q('[data-stnotes]')) { ST.notes = !ST.notes; stNotes(); return true; }
    if (q('[data-stnew]')) { stNew('Title'); return true; }
    if (q('[data-stlayouts]')) { stPop(q('[data-stlayouts]'), `<div class="stlays">${Object.keys(STLAY).map(k => `<button type="button" data-stlay="${k}"><i class="stlv ${k.replace(' ', '').toLowerCase()}"><b></b><b></b></i><span>${k}</span></button>`).join('')}</div>`, true); return true; }
    const ly = q('[data-stlay]'); if (ly) { $('#st-pop')?.remove(); stNew(ly.dataset.stlay); stToast(`New ${ly.dataset.stlay.toLowerCase()} slide`); return true; }
    if (q('[data-stslide]')) { ST.slidePanel = true; ST.sel = []; stAll(); return true; }
    if (q('[data-stclose]')) { ST.slidePanel = false; ST.sel = []; stAll(); return true; }
    const bg = q('[data-stbg]'); if (bg) { stS().bg = bg.dataset.stbg; stAll(); return true; }
    const tr = q('[data-sttr]'); if (tr) { stS().trans = tr.dataset.sttr; stPanels(); return true; }
    const bd = q('[data-stbuild]'); if (bd) { stSel().forEach(n => { n.build = bd.dataset.stbuild; }); stInsp(); return true; }
    const it = q('[data-stitab]'); if (it) { ST.itab = it.dataset.stitab; stInsp(); return true; }
    const al = q('[data-stal]'); if (al) { const k = al.dataset.stal; stSel().forEach(n => { if (k === 'l') n.x = 160; if (k === 'c') n.x = Math.round((STW - n.w) / 2); if (k === 'r') n.x = STW - 160 - n.w; if (k === 't') n.y = 110; if (k === 'm') n.y = Math.round((STH - n.h) / 2); if (k === 'b') n.y = STH - 110 - n.h; }); stAll(); return true; }
    const ta = q('[data-stta]'); if (ta) { stSel()[0].align = ta.dataset.stta; stAll(); return true; }
    const cl = q('[data-stclr]'); if (cl) { const k = cl.dataset.stclr; stPop(cl, `<div class="supal">${['#16161a', '#ffffff', '#f6f3ee', '#1a1f3a', '#6f7cff', '#aab4ff', '#e8553b', '#f2b544', '#3ddc84', '#c9ccdf'].map(c => `<button type="button" style="--c:${c}" data-stpick="${k}" data-c="${c}"></button>`).join('')}</div>`); return true; }
    const pk = q('[data-stpick]'); if (pk) { stSel().forEach(n => { n[pk.dataset.stpick] = pk.dataset.c; }); $('#st-pop')?.remove(); stAll(); return true; }
    if (q('[data-stfont]')) { stPop(q('[data-stfont]'), Object.keys(STFONT).map(f => `<button class="crmi" type="button" data-stff="${f}"><span style="font-family:${STFONT[f]};font-size:15px">${f}</span></button>`).join('')); return true; }
    const ff = q('[data-stff]'); if (ff) { stSel()[0].ff = ff.dataset.stff; $('#st-pop')?.remove(); stAll(); return true; }
    if (q('[data-stdup]')) { const s = stS(), c = { ...s, nodes: s.nodes.map(n => ({ ...n, id: 's' + STID++ })) }; ST.slides.splice(ST.cur + 1, 0, c); ST.cur++; stAll(); stToast('Slide duplicated', { icon: 'copy' }); return true; }
    if (q('[data-stdelslide]')) { if (ST.slides.length > 1) { const i = ST.cur, gone = ST.slides.splice(i, 1)[0]; ST.cur = Math.max(0, i - 1); ST.slidePanel = false; stAll();
      stToast(`Deleted slide ${i + 1}`, { icon: 'trash-2', undo: () => { ST.slides.splice(i, 0, gone); ST.cur = i; stAll(); } }); } return true; }
    if (q('[data-stpresent]')) { stPresent(); return true; }
    const td = q('[data-sttodo]'); if (td) { stToast(td.dataset.sttodo); return true; }
    return false; }
  function renderStage() { $('#st-top').innerHTML = `<img src="${A}presentations.svg" alt=""><b>Launch walkthrough</b><span class="sumeta">Stage · Saved</span><span class="sutopr">${av('PR', 26)}${av('NF', 26)}<button class="bt sm fill" type="button" data-share>${ic('share-2')}Share</button><button class="bt sm key stplay" type="button" data-stpresent>${ic('play')}Present</button><button class="ib" type="button" data-lmenu data-docmore title="More" aria-label="More">${ic('ellipsis')}</button></span>`;
    $('#w-stage').addEventListener('luma-phone', e => { ST.left = ST.notes = !e.detail; setTimeout(stAll, 120); });
    const w = $('#st-work'); w.addEventListener('pointerdown', stPtr); w.addEventListener('pointermove', stPtrMove); addEventListener('pointerup', stPtrUp);
    w.addEventListener('dblclick', e => { const n = e.target.closest('#st-slide [data-stn]'); if (n && stG(n.dataset.stn)?.t === 'text') { ST.edit = n.dataset.stn; stAll(); } });
    new ResizeObserver(() => { stDraw(); }).observe(w); stAll(); }
  document.addEventListener('input', e => { const t = e.target; if (!t.closest?.('#w-stage')) return;
    if (t.matches('[data-stnote]')) { stS().notes = t.value; return; } const n = stSel()[0]; if (!n) return;
    if (t.matches('[data-stname]')) { n.name = t.value; return; } const k = t.dataset.stp; if (!k) return;
    if (k === 'fill' || k === 'color') { if (/^[0-9a-f]{6}$/i.test(t.value)) { n[k] = '#' + t.value; stDraw(); t.previousElementSibling.style.setProperty('--c', n[k]); } return; }
    const v = parseFloat(t.value); if (Number.isNaN(v)) return; if (k === 'op') n.op = Math.max(0, Math.min(100, v)) / 100; else n[k] = v; if (k === 'fs') n.h = Math.round(v * n.lh); stDraw(); stLeft(); });
  document.addEventListener('keydown', e => { if (ST.present) { if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); stPGo(1); } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); stPGo(-1); } else if (e.key === 'Escape') stPEnd(); return; }
    if (front()?.dataset.app !== 'stage') return; if (ST.edit) { if (e.key === 'Escape') $(`#st-slide [data-stn="${ST.edit}"] .cvtx`)?.blur(); return; } if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && e.key === 'Enter') { e.preventDefault(); if (e.altKey) stPresent(); else stNew('Title'); return; } if (mod && k === 'd') { e.preventDefault(); const s = stS(), out = stSel().map(n => { const c = { ...n, id: 's' + STID++, x: n.x + 30, y: n.y + 30 }; s.nodes.push(c); return c.id; }); ST.sel = out; stAll(); return; } if (mod) return;
    if (e.key === '\\') { ST.focus = !ST.focus; stAll(); return; } if (e.key === 'Escape') { ST.sel = []; ST.slidePanel = false; stAll(); return; }
    if ((e.key === 'Backspace' || e.key === 'Delete') && ST.sel.length) { e.preventDefault(); const s = stS(), was = s.nodes.slice(), sel = ST.sel.slice(), S = stSel(); s.nodes = s.nodes.filter(n => !ST.sel.includes(n.id)); ST.sel = []; stAll();
      stToast(S.length === 1 ? `Deleted ${esc(S[0].name)}` : `Deleted ${S.length} objects`, { icon: 'trash-2', undo: () => { s.nodes = was; ST.sel = sel; stAll(); } }); return; }
    if (e.key.startsWith('Arrow')) { e.preventDefault(); if (ST.sel.length) { const s2 = e.shiftKey ? 10 : 1; stSel().forEach(n => { n.x += k === 'arrowleft' ? -s2 : k === 'arrowright' ? s2 : 0; n.y += k === 'arrowup' ? -s2 : k === 'arrowdown' ? s2 : 0; }); stDraw(); stInsp(); } else { const d = k === 'arrowdown' || k === 'arrowright' ? 1 : -1; ST.cur = Math.max(0, Math.min(ST.slides.length - 1, ST.cur + d)); stAll(); } return; }
    const tools = { v: 'move', t: 'text', r: 'rect', o: 'ellipse', i: 'image' }; if (tools[k]) { ST.tool = tools[k]; stTools(); } });

  /* ══ Session ═════════════════════════════════════════════════════════════════
     Music, calmly. The island is the arrangement. The floating bar is the transport and every readout you need
     while you play. Nothing else is on screen until you reach for it: select a track and its library appears
     beside it; select anything and the inspector says what it is; double-click a region and its editor rises
     from the bottom; press X for the mixer. Same panels, same inspector, same keys as the rest of the suite. */
  const SESEC = [['Intro', 1, 8, 250], ['Verse', 9, 24, 150], ['Chorus', 25, 32, 25], ['Bridge', 33, 40, 300], ['Chorus', 41, 48, 25]];
  const SELIB = { Drums: ['Studio kit|Tight, dry, close mics', 'Brushes|Soft jazz brushes', 'Vintage 808|Deep boom, snappy clap', 'Live room|Big, roomy, loose'], Bass: ['Finger bass|Round, fingered, warm', 'Upright|Double bass, plucked', 'Analog sub|Sine sub, clean low end', 'Pick bass|Bright attack, bridge pickup'],
    Keys: ['Electric piano|Warm tines, soft bark', 'Grand piano|Close mic, bright', 'Felt piano|Muted, intimate', 'Organ|Drawbars, slow rotary'], Pads: ['Warm pad|Slow attack, wide', 'Glass pad|Shimmer, airy top', 'Tape strings|Worn, wobbly, lovely'],
    Vocal: ['Clean vocal|EQ, gentle compression', 'Warm radio|Band-limited, saturated', 'Big room|Plate reverb, slapback'], Guitar: ['Clean amp|Glassy, a little spring', 'Crunch|Pushed valve amp', 'Direct|Dry DI, nothing added'] };
  const SE = { sel: { t: null, r: null }, playing: false, pos: 25, tempo: 95, sig: '4/4', key: 'D minor', loop: { on: true, a: 25, b: 33 }, click: false, rec: false, editor: null, mixer: false, lib: false, focus: false, drag: null, notes: {}, meters: {}, tracks: [
    { id: 'drums', n: 'Drums', kind: 'midi', lib: 'Drums', icon: 'drum', h: 250, inst: 'Studio kit', vol: -4, pan: 0, rev: 12, dly: 0, fx: ['EQ', 'Compressor'], regions: [[1, 8, 'Intro beat'], [9, 16, 'Verse'], [25, 8, 'Chorus'], [33, 8, 'Bridge'], [41, 8, 'Chorus']] },
    { id: 'bass', n: 'Bass', kind: 'midi', lib: 'Bass', icon: 'guitar', h: 35, inst: 'Finger bass', vol: -6, pan: 0, rev: 0, dly: 0, fx: ['EQ', 'Compressor'], regions: [[9, 16, 'Verse bass'], [25, 8, 'Chorus bass'], [33, 8, 'Bridge bass'], [41, 8, 'Chorus bass']] },
    { id: 'keys', n: 'Keys', kind: 'midi', lib: 'Keys', icon: 'piano', h: 160, inst: 'Electric piano', vol: -8, pan: -18, rev: 24, dly: 10, fx: ['EQ', 'Tremolo'], regions: [[1, 24, 'Keys'], [25, 8, 'Chorus stabs'], [41, 8, 'Chorus stabs']] },
    { id: 'guitar', n: 'Guitar', kind: 'audio', lib: 'Guitar', icon: 'guitar', h: 70, inst: 'Clean amp', vol: -9, pan: 22, rev: 18, dly: 14, fx: ['Amp', 'EQ'], regions: [[25, 8, 'Guitar take 3'], [41, 8, 'Guitar take 3']] },
    { id: 'pads', n: 'Pads', kind: 'midi', lib: 'Pads', icon: 'audio-lines', h: 290, inst: 'Warm pad', vol: -14, pan: 0, rev: 40, dly: 0, fx: ['EQ'], regions: [[1, 8, 'Pad swell'], [33, 16, 'Pads']] },
    { id: 'vox', n: 'Lead vocal', kind: 'audio', lib: 'Vocal', icon: 'mic', h: 350, inst: 'Clean vocal', vol: -3, pan: 0, rev: 20, dly: 8, fx: ['EQ', 'Compressor', 'De-esser'], regions: [[9, 16, 'Verse vocal'], [25, 8, 'Chorus vocal'], [33, 8, 'Bridge vocal'], [41, 8, 'Chorus vocal']] },
    { id: 'harm', n: 'Harmonies', kind: 'audio', lib: 'Vocal', icon: 'mic', h: 320, inst: 'Big room', vol: -10, pan: 0, rev: 34, dly: 12, fx: ['EQ', 'Compressor'], regions: [[25, 8, 'Harmony'], [41, 8, 'Harmony']] }
  ] };
  SE.tracks.forEach(t => { t.regions = t.regions.map(([s, l, n], i) => ({ id: `${t.id}${i}`, n, s, l })); t.mute = false; t.solo = false; t.arm = t.id === 'vox'; });
  const seT = id => SE.tracks.find(t => t.id === id), seR = id => SE.tracks.flatMap(t => t.regions.map(r => ({ ...r, t }))).find(r => r.id === id);
  const seRegion = id => { for (const t of SE.tracks) { const r = t.regions.find(x => x.id === id); if (r) return [t, r]; } return [];};
  function seNotes(r, t) { if (SE.notes[r.id]) return SE.notes[r.id]; const rnd = meSeed(r.id), out = [], per = t.id === 'drums' ? 8 : t.id === 'bass' ? 4 : t.id === 'pads' ? 1 : 2;
    for (let b = 0; b < r.l; b++) for (let k = 0; k < per; k++) { if (t.id !== 'drums' && rnd() < .18) continue; const p = t.id === 'drums' ? [36, 38, 42, 42][k % 4] : t.id === 'bass' ? 38 + [0, 0, 5, 7, 3][Math.floor(rnd() * 5)] : 57 + Math.floor(rnd() * 14);
      out.push({ s: b + k / per, l: t.id === 'drums' ? .06 : (1 / per) * (t.id === 'pads' ? 1 : .8), p, v: .55 + rnd() * .45 }); }
    return SE.notes[r.id] = out; }
  const seBars = () => { const a = $('#se-lanes'); return a ? Math.max(18, (a.clientWidth - 16) / 48) : 22; };
  const seFmtPos = p => { const bar = Math.floor(p), beat = Math.floor((p - bar) * 4) + 1, div = Math.floor(((p - bar) * 4 % 1) * 4) + 1; return [bar, beat, div]; };
  const seTime = p => { const s = (p - 1) * 4 * 60 / SE.tempo; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor(s * 10 % 10)}`; };

  /* ── The arrangement ── */
  function seWave(r, w, h) { const rnd = meSeed(r.id + 'w'), n = Math.max(8, Math.floor(w / 2.2)); let v = .4, top = '', bot = ''; for (let i = 0; i <= n; i++) { v = Math.max(.08, Math.min(1, v + (rnd() - .5) * .5)); const a = v * (.45 + .55 * Math.abs(Math.sin(i / 5))) * h / 2, x = (i / n * w).toFixed(1); top += `${i ? 'L' : 'M'}${x} ${(h / 2 - a).toFixed(1)}`; bot = `L${x} ${(h / 2 + a).toFixed(1)}` + bot; }
    return `<svg class="sewave" width="${w}" height="${h}" preserveAspectRatio="none" viewBox="0 0 ${w} ${h}"><path d="${top}${bot}Z"/></svg>`; }
  function seMidi(r, t, w, h) { const ns = seNotes(r, t), lo = Math.min(...ns.map(n => n.p)), hi = Math.max(...ns.map(n => n.p)) + 1, rng = Math.max(6, hi - lo);
    return `<svg class="semidi" width="${w}" height="${h}">${ns.map(n => `<rect x="${(n.s / r.l * w).toFixed(1)}" y="${((hi - n.p - 1) / rng * (h - 4) + 2).toFixed(1)}" width="${Math.max(1.5, n.l / r.l * w).toFixed(1)}" height="2.4" rx="1"/>`).join('')}</svg>`; }
  function seArr() { const lanes = $('#se-lanes'), heads = $('#se-heads'), TH = 64; if (!lanes || lanes.clientWidth < 200) return; const ppb = seBars(); lanes.style.setProperty('--ppb', ppb + 'px');   // hidden windows measure zero; draw when shown
    heads.innerHTML = `<div class="sehh"><b>Late light</b><span>${SE.tracks.length} tracks · ${SE.key}</span></div>` + SE.tracks.map((t, i) => `<div class="sehead${SE.sel.t === t.id ? ' on' : ''}" data-setrack="${t.id}" style="--h:${t.h}"><i class="sestrip"></i><span class="seic">${ic(t.icon)}</span><div class="sename"><b>${esc(t.n)}</b><small>${esc(t.inst)}</small></div>
      <div class="semsr"><button type="button" class="${t.mute ? 'on m' : ''}" data-semute="${t.id}" title="Mute">M</button><button type="button" class="${t.solo ? 'on s' : ''}" data-sesolo="${t.id}" title="Solo">S</button>${t.kind === 'audio' ? `<button type="button" class="${t.arm ? 'on r' : ''}" data-searm="${t.id}" title="Record">●</button>` : ''}</div><i class="semeter"><i id="se-m-${t.id}"></i></i></div>`).join('') + `<button class="seaddtrack" type="button" data-setodo="New track: instrument, audio or drummer">${ic('plus')}Track</button>`;
    const ruler = `<div class="seruler">${SESEC.map(([n, a, b, h]) => `<span class="sesec" style="left:${(a - 1) * ppb}px;width:${(b - a + 1) * ppb}px;--h:${h}">${n}</span>`).join('')}${Array.from({ length: 12 }, (_, i) => `<em style="left:${(i * 4) * ppb}px">${i * 4 + 1}</em>`).join('')}${SE.loop.on ? `<i class="seloop" style="left:${(SE.loop.a - 1) * ppb}px;width:${(SE.loop.b - SE.loop.a) * ppb}px" title="Loop ${SE.loop.a}–${SE.loop.b}"></i>` : ''}</div>`;
    lanes.innerHTML = ruler + `<div class="setracks" style="background-size:${ppb * 4}px ${TH}px, ${ppb}px ${TH}px">${SE.tracks.map((t, i) => `<div class="selane${SE.sel.t === t.id ? ' on' : ''}${t.mute ? ' muted' : ''}" data-selane="${t.id}" style="--h:${t.h}">${t.regions.map(r => { const w = r.l * ppb - 2;
        return `<div class="sereg ${t.kind}${SE.sel.r === r.id ? ' on' : ''}${SE.editor === r.id ? ' open' : ''}" data-sereg="${r.id}" style="left:${(r.s - 1) * ppb + 1}px;width:${w}px"><b>${esc(r.n)}</b>${t.kind === 'audio' ? seWave(r, w - 2, 38) : seMidi(r, t, w - 8, 36)}<i class="seresize" data-seresize="${r.id}"></i></div>`; }).join('')}</div>`).join('')}</div><i class="sehead-line" id="se-ph" style="left:${(SE.pos - 1) * ppb}px"></i>`;
    seLCD(); }
  function seLCD() { const [b, bt, d] = seFmtPos(SE.pos), el = $('#se-lcd'); if (el) el.innerHTML = `<span><b>${b}<i>.</i>${bt}<i>.</i>${d}</b><small>Bar</small></span><span><b>${seTime(SE.pos)}</b><small>Time</small></span>`;
    const ph = $('#se-ph'); if (ph) ph.style.left = (SE.pos - 1) * seBars() + 'px'; }

  /* ── Transport: the bar is every control and readout you need while playing ── */
  /* Session on a phone: the tracks get the screen. One bar in two rows: the transport on top (back, play, record, where
     you are); under a hairline, the song's settings (tempo, loop, click, mixer) or, with a track picked, what you do to
     it (Sounds from its library, Mute, Solo, Arm, Details), each growing the bar. */
  const seNarrow = () => { const w = $('#w-session'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };
  function seBarPhone() { const bar = $('#se-bar'), X = SE.px || '', t = seT(SE.sel.t); $('#w-session').classList.add('seph'); bar.classList.add('phnofit', 'sephbar');
    const ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}<span>${label}</span></button>`;
    const panel = t && X === 'lib' ? `<div class="fexp cvpan">${$('#se-lib').innerHTML}</div>` : (t || SE.sel.r) && X === 'insp' ? `<div class="fexp cvpan">${$('#se-right').innerHTML}</div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, `${panel}<div class="ser1"><button class="ib" type="button" data-seback aria-label="Back to start">${ic('skip-back')}</button><button class="seplay${SE.playing ? ' on' : ''}" type="button" data-seplay aria-label="Play">${ic(SE.playing ? 'pause' : 'play')}</button><button class="serec${SE.rec ? ' on' : ''}" type="button" data-serecord aria-label="Record"><i></i></button><div class="selcd" id="se-lcd"></div></div>
      <div class="cvr2">${t ? `${ib('data-sepx="lib"', 'library-big', 'Sounds', X === 'lib')}${ib(`data-semute="${t.id}"`, 'volume-x', 'Mute', !!t.mute)}${ib(`data-sesolo="${t.id}"`, 'headphones', 'Solo', !!t.solo)}${ib(`data-searm="${t.id}"`, 'circle-dot', 'Arm', !!t.arm)}${ib('data-sepx="insp"', 'sliders-horizontal', 'Details', X === 'insp')}${ib('data-sedesel', 'x', 'Done')}`
        : `<button class="seread" type="button" data-setempo><b>${SE.tempo}</b><small>BPM</small></button><span class="sp"></span>${ib('data-seloop', 'repeat', 'Loop', SE.loop.on)}${ib('data-seclick', 'metronome', 'Click', SE.click)}${ib('data-semixer', 'sliders-vertical', 'Mixer', SE.mixer)}`}</div>`); seLCD(); }
  function seBar() { if (seNarrow()) return seBarPhone(); $('#w-session').classList.remove('seph'); $('#se-bar').classList.remove('phnofit', 'sephbar', 'phgrow'); setBar($('#se-bar'), `<button class="ib" type="button" data-seback title="Back to start · ⏎">${ic('skip-back')}</button><button class="seplay${SE.playing ? ' on' : ''}" type="button" data-seplay title="Play · Space">${ic(SE.playing ? 'pause' : 'play')}</button><button class="serec${SE.rec ? ' on' : ''}" type="button" data-serecord title="Record · R"><i></i></button>
      <div class="selcd" id="se-lcd"></div><button class="seread" type="button" data-setempo title="Tempo"><b>${SE.tempo}</b><small>BPM</small></button><button class="seread" type="button" data-setodo="Time signature: 4/4"><b>${SE.sig}</b><small>Time</small></button><button class="seread wide" type="button" data-setodo="Key: D minor"><b>${SE.key}</b><small>Key</small></button>
      <span class="vr"></span><button class="ib${SE.loop.on ? ' on' : ''}" type="button" data-seloop title="Loop · C">${ic('repeat')}</button><button class="ib${SE.click ? ' on' : ''}" type="button" data-seclick title="Click · K">${ic('metronome')}</button><button class="ib${SE.mixer ? ' on' : ''}" type="button" data-semixer title="Mixer · X">${ic('sliders-vertical')}</button>`); seLCD(); }

  /* ── Panels appear with context ── */
  // The library is an island that opens on the left when a track is selected, and closes with it
  function seLib() { const el = $('#se-lib'), w = $('#w-session'), t = seT(SE.sel.t), open = !!t && SE.lib && !SE.focus && !SE.mixer; w.classList.toggle('libopen', open); if (!open) return;
    const list = SELIB[t.lib].map(x => x.split('|'));
    el.innerHTML = `<div class="vwih"><b>Library</b><button class="ib" type="button" data-selib title="Close the library · Y">${ic('x')}</button></div><p class="selibsub">Sounds for ${esc(t.n)}</p>
      <label class="srch selq">${ic('search')}<input placeholder="Search sounds" data-selq></label><div class="scr">${list.map(([n, d]) => `<button class="selitem${t.inst === n ? ' on' : ''}" type="button" data-sesound="${esc(n)}"><span><b>${n}</b><small>${d}</small></span>${t.inst === n ? ic('check') : ''}<i class="sepv" data-seprev="${esc(n)}" title="Preview">${ic('play')}</i></button>`).join('')}
      <h6 class="suh">More</h6><button class="selitem" type="button" data-setodo="Sounds you've made live in Music › Session"><span><b>Your sounds</b><small>Saved from your own tweaks</small></span>${ic('chevron-right')}</button></div>`; }
  function seInsp() { const el = $('#se-right'), sec = (t, b, add = '') => `<section class="susec"><header><b>${t}</b>${add}</header>${b}</section>`; if (SE.focus || SE.mixer || (SE.lib && SE.sel.t && !SE.sel.r)) { el.className = 'supanel r min gone'; return; }
    const [t, r] = SE.sel.r ? seRegion(SE.sel.r) : [seT(SE.sel.t)]; if (!t) { el.className = 'supanel r min gone'; return; } el.className = 'supanel r';
    const sl = (k, label, v, min, max, unit, fmt = v => v) => `<label class="seslider"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${v}" data-seset="${k}" style="--h:${t.h}"><em data-sev="${k}">${fmt(v)}${unit}</em></label>`;
    if (r) { el.innerHTML = `<header class="suinsph"><i class="sesw" style="--h:${t.h}"></i><input class="suname" data-sername value="${esc(r.n)}" spellcheck="false"><button class="ib" type="button" data-seclose title="Close">${ic('x')}</button></header><div class="suscroll">
        ${sec('Region', `<dl class="sedl"><div><dt>Track</dt><dd>${esc(t.n)}</dd></div><div><dt>Starts</dt><dd>Bar ${r.s}</dd></div><div><dt>Length</dt><dd>${r.l} bars</dd></div><div><dt>Section</dt><dd>${(SESEC.find(s => r.s >= s[1] && r.s <= s[2]) || ['—'])[0]}</dd></div></dl>`)}
        ${t.kind === 'midi' ? sec('Notes', `${sl('tr', 'Transpose', r.tr || 0, -12, 12, ' st', v => (v > 0 ? '+' : '') + v)}${sl('vel', 'Velocity', r.vel ?? 100, 1, 127, '')}<button class="bt sm fill suwide2" type="button" data-sequant>Quantize to 1/16</button>`) : sec('Audio', `${sl('gain', 'Gain', r.gain || 0, -24, 12, ' dB', v => (v > 0 ? '+' : '') + v)}${sl('fin', 'Fade in', r.fin || 0, 0, 100, ' ms')}${sl('fout', 'Fade out', r.fout || 20, 0, 400, ' ms')}`)}
        ${sec('Arrange', `<div class="surow2"><button class="bt sm fill" type="button" data-seopen="${r.id}">${ic(t.kind === 'midi' ? 'piano' : 'audio-lines')}Edit</button><button class="bt sm fill" type="button" data-sedup="${r.id}">Duplicate</button></div>`)}</div>`; return; }
    el.innerHTML = `<header class="suinsph"><i class="sesw" style="--h:${t.h}"></i><input class="suname" data-setname value="${esc(t.n)}" spellcheck="false"><button class="ib" type="button" data-seclose title="Close">${ic('x')}</button></header><div class="suscroll">
      ${sec(t.kind === 'midi' ? 'Instrument' : 'Voice', `<button class="suselect" type="button" data-selib>${esc(t.inst)}${ic('chevron-down')}</button>`)}
      ${sec('Level', `${sl('vol', 'Volume', t.vol, -60, 6, ' dB', v => (v > 0 ? '+' : '') + v)}${sl('pan', 'Pan', t.pan, -50, 50, '', v => v == 0 ? 'C' : v < 0 ? 'L' + -v : 'R' + v)}`)}
      ${sec('Sends', `${sl('rev', 'Reverb', t.rev, 0, 100, '%')}${sl('dly', 'Delay', t.dly, 0, 100, '%')}`)}
      ${sec('Effects', `<div class="sefx">${t.fx.map((f, i) => `<div class="sefxr"><i class="sefxon${t.off?.[i] ? '' : ' on'}" data-sefx="${i}"></i><span>${f}</span><button class="ib sm" type="button" data-setodo="${f} opens as a floating panel">${ic('sliders-vertical')}</button></div>`).join('')}</div>`, `<button class="ib sm" type="button" data-setodo="Add an effect: EQ, compressor, reverb, delay, saturation…">${ic('plus')}</button>`)}
      ${sec('Routing', `<dl class="sedl"><div><dt>Input</dt><dd>${t.kind === 'audio' ? 'Studio mic, input 1' : 'Keyboard, all channels'}</dd></div><div><dt>Output</dt><dd>Main out</dd></div></dl>`)}</div>`; }
  function seEditor() { const el = $('#se-editor'), id = SE.editor; if (!id || SE.focus || SE.mixer) { el.className = 'seeditor'; el.innerHTML = ''; return; } const [t, r] = seRegion(id); el.className = 'seeditor on';
    const W = el.clientWidth || 800;
    if (t.kind === 'audio') { const w = W - 150; el.innerHTML = `<header><i class="sesw" style="--h:${t.h}"></i><b>${esc(r.n)}</b><span>${esc(t.n)} · bars ${r.s}–${r.s + r.l - 1}</span><i></i><button class="bt sm fill" type="button" data-setodo="Split at the playhead">Split</button><button class="bt sm fill" type="button" data-setodo="Reversed">Reverse</button><button class="ib" type="button" data-seedclose title="Close · Esc">${ic('x')}</button></header>
        <div class="seaudio" style="--h:${t.h}">${seWave(r, w, 150)}<i class="sefade in" style="width:${10 + (r.fin || 0) / 4}px"></i><i class="sefade out" style="width:${14 + (r.fout || 20) / 4}px"></i><i class="segain" style="top:${50 - (r.gain || 0) * 2}%"></i></div>`; return; }
    const ns = seNotes(r, t), lo = t.id === 'drums' ? 35 : Math.min(...ns.map(n => n.p)) - 2, hi = t.id === 'drums' ? 46 : Math.max(...ns.map(n => n.p)) + 3, rows = hi - lo, show = Math.min(r.l, 8), kw = 44, w = W - kw - 40, rh = Math.max(7, Math.min(13, 190 / rows)), NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    el.innerHTML = `<header><i class="sesw" style="--h:${t.h}"></i><b>${esc(r.n)}</b><span>${esc(t.inst)} · first ${show} of ${r.l} bars</span><i></i><span class="seqz">Grid 1/16</span><button class="bt sm fill" type="button" data-sequant>Quantize</button><button class="ib" type="button" data-seedclose title="Close · Esc">${ic('x')}</button></header>
      <div class="seroll" style="--h:${t.h};--rh:${rh}px"><div class="sekeys">${Array.from({ length: rows }, (_, i) => { const p = hi - 1 - i, n = NAMES[p % 12]; return `<i class="${n.includes('♯') ? 'bk' : ''}">${n === 'C' ? 'C' + (Math.floor(p / 12) - 1) : t.id === 'drums' ? ({ 36: 'Kick', 38: 'Snare', 42: 'Hat' }[p] || '') : ''}</i>`; }).join('')}</div>
      <div class="segrid" id="se-grid" data-lo="${lo}" data-hi="${hi}" data-bars="${show}" style="width:${w}px;height:${rows * rh}px;background-size:${w / show}px 100%, ${w / show / 4}px 100%, 100% ${rh}px">${ns.filter(n => n.s < show).map((n, i) => `<i class="senote" data-senote="${ns.indexOf(n)}" style="left:${n.s / show * w}px;top:${(hi - 1 - n.p) * rh}px;width:${Math.max(4, n.l / show * w - 1)}px;height:${rh - 1}px;opacity:${.45 + n.v * .55}"></i>`).join('')}</div></div>`; }
  function seMixer() { const el = $('#se-mixer'); if (!SE.mixer) { el.className = 'semixer'; return; } el.className = 'semixer on';
    const strip = (t, master) => `<div class="sestrip2${SE.sel.t === t.id ? ' on' : ''}" style="--h:${t.h}" data-setrack="${t.id}"><b>${esc(t.n)}</b><div class="seslots">${(t.fx || []).slice(0, 3).map(f => `<span>${f}</span>`).join('')}</div>${master ? '' : `<input type="range" class="sepan" min="-50" max="50" value="${t.pan}" data-sepan="${t.id}" title="Pan">`}
      <div class="sefader"><i class="semeter v"><i id="se-mm-${t.id}"></i></i><div class="setrack" data-sefader="${t.id}"><i class="sefcap" style="bottom:${(t.vol + 60) / 66 * 100}%"></i></div></div><em>${t.vol > 0 ? '+' : ''}${t.vol} dB</em>${master ? '<small>Main out</small>' : `<div class="semsr"><button type="button" class="${t.mute ? 'on m' : ''}" data-semute="${t.id}">M</button><button type="button" class="${t.solo ? 'on s' : ''}" data-sesolo="${t.id}">S</button></div>`}</div>`;
    el.innerHTML = `<header><b>Mixer</b><span>${SE.tracks.length} tracks · 48 kHz</span><i></i><button class="ib" type="button" data-semixer title="Close · X">${ic('x')}</button></header><div class="sestrips">${SE.tracks.map(t => strip(t)).join('')}<span class="sesep"></span>${strip({ id: 'main', n: 'Main', h: 0, vol: 0, fx: ['Limiter'] }, true)}</div>`; }
  function sePanels() { if (seNarrow()) { SE.lib = true; } const was = $('#w-session').classList.contains('libopen'); seLib(); if (was !== $('#w-session').classList.contains('libopen')) setTimeout(seArr, 320); seInsp(); seEditor(); seMixer(); $('#se-work').classList.toggle('edopen', !!SE.editor && !SE.mixer && !SE.focus); }
  function seAll() { seArr(); sePanels(); seBar(); }
  function seToast(msg, icon) { lToast($('#w-session'), msg, { icon: icon || 'check' }); }

  /* ── Playing ── */
  function sePlay(on) { SE.playing = on; seBar(); cancelAnimationFrame(SE.raf); if (!on) { $$('[id^="se-m"] ').forEach(m => m.style.height = m.style.width = '0'); return; } let last = performance.now();
    const loop = now => { const dt = (now - last) / 1000; last = now; SE.pos += dt * SE.tempo / 60 / 4; if (SE.loop.on && SE.pos >= SE.loop.b) SE.pos = SE.loop.a; if (SE.pos > 49) { SE.pos = 1; }
      seLCD(); const anySolo = SE.tracks.some(t => t.solo);
      SE.tracks.forEach(t => { const live = !t.mute && (!anySolo || t.solo) && t.regions.some(r => SE.pos >= r.s && SE.pos < r.s + r.l), lv = live ? Math.min(1, (t.vol + 60) / 60 * (.55 + Math.random() * .45)) : 0, prev = SE.meters[t.id] || 0, v = lv > prev ? lv : prev * .9; SE.meters[t.id] = v;
        const m = document.getElementById('se-m-' + t.id); if (m) m.style.width = v * 100 + '%'; const mm = document.getElementById('se-mm-' + t.id); if (mm) mm.style.height = v * 100 + '%'; });
      const mm = document.getElementById('se-mm-main'); if (mm) mm.style.height = Math.min(1, Object.values(SE.meters).reduce((s, v) => s + v, 0) / 4) * 100 + '%';
      $$('#se-lanes .sereg').forEach(el => { const [t, r] = seRegion(el.dataset.sereg); el.classList.toggle('live', SE.pos >= r.s && SE.pos < r.s + r.l); });
      SE.raf = requestAnimationFrame(loop); }; SE.raf = requestAnimationFrame(loop); }

  function seClick(e, hit) { const q = s => hit(s);
    if (seNarrow()) { const px = q('[data-sepx]'); if (px) { const k = px.dataset.sepx; SE.px = SE.px === k ? '' : k; seBarPhone(); return true; }
      if (q('[data-sedesel]')) { SE.sel = { t: null, r: null }; SE.px = ''; seAll(); return true; }
      if (q('[data-semute]') || q('[data-sesolo]') || q('[data-searm]') || q('[data-setrack]') || q('[data-sereg]')) setTimeout(seBarPhone); }
    if (!q('#se-pop')) $('#se-pop')?.remove();
    if (q('[data-seplay]')) { sePlay(!SE.playing); return true; }
    if (q('[data-seback]')) { SE.pos = 1; seLCD(); return true; }
    if (q('[data-serecord]')) { SE.rec = !SE.rec; if (SE.rec && !SE.playing) sePlay(true); seBar(); seToast(SE.rec ? 'Recording on Lead vocal' : 'Take saved as “Chorus vocal 2”'); return true; }
    if (q('[data-seloop]')) { SE.loop.on = !SE.loop.on; seAll(); return true; } if (q('[data-seclick]')) { SE.click = !SE.click; seBar(); return true; } if (q('[data-semixer]')) { SE.mixer = !SE.mixer; seBar(); sePanels(); return true; }
    if (q('[data-setempo]')) { const tempos = [80, 95, 110, 120]; SE.tempo = tempos[(tempos.indexOf(SE.tempo) + 1) % tempos.length]; seBar(); seToast(`${SE.tempo} BPM`); return true; }
    const mu = q('[data-semute]'); if (mu) { const t = seT(mu.dataset.semute); t.mute = !t.mute; seArr(); seMixer(); return true; }
    const so = q('[data-sesolo]'); if (so) { const t = seT(so.dataset.sesolo); t.solo = !t.solo; seArr(); seMixer(); return true; }
    const ar = q('[data-searm]'); if (ar) { const t = seT(ar.dataset.searm); t.arm = !t.arm; seArr(); return true; }
    const tr = q('[data-setrack]'); if (tr && !q('[data-sefader],[data-sepan]')) { SE.sel = { t: tr.dataset.setrack, r: null }; if (tr.dataset.setrack === 'main') return true; seArr(); sePanels(); return true; }
    if (q('[data-selib]')) { SE.lib = !!q('.suselect') || !SE.lib; seLib(); seInsp(); setTimeout(seArr, 320); return true; }
    const pv = q('[data-seprev]'); if (pv) { seToast(`Previewing ${pv.dataset.seprev}`); return true; }
    const sd = q('[data-sesound]'); if (sd) { const t = seT(SE.sel.t); t.inst = sd.dataset.sesound; seArr(); sePanels(); seToast(`${t.n} is now ${t.inst}`); return true; }
    if (q('[data-seclose]')) { SE.lib = false; SE.sel = { t: null, r: null }; seArr(); sePanels(); return true; }
    const op = q('[data-seopen]'); if (op) { SE.editor = op.dataset.seopen; seArr(); sePanels(); return true; }
    if (q('[data-seedclose]')) { SE.editor = null; seArr(); sePanels(); return true; }
    const du = q('[data-sedup]'); if (du) { const [t, r] = seRegion(du.dataset.sedup), c = { ...r, id: r.id + 'd' + Date.now(), s: r.s + r.l }; t.regions.push(c); SE.sel.r = c.id; seArr(); sePanels(); return true; }
    if (q('[data-sequant]')) { const id = SE.editor || SE.sel.r; if (id) { const [t, r] = seRegion(id); seNotes(r, t).forEach(n => { n.s = Math.round(n.s * 4) / 4; }); seArr(); seEditor(); seToast('Quantized to 1/16'); } return true; }
    const fx = q('[data-sefx]'); if (fx) { const t = seT(SE.sel.t), i = +fx.dataset.sefx; t.off = t.off || []; t.off[i] = !t.off[i]; seInsp(); return true; }
    const td = q('[data-setodo]'); if (td) { seToast(td.dataset.setodo); return true; }
    return false; }
  function sePtr(e) { const reg = e.target.closest('[data-sereg]'), rs = e.target.closest('[data-seresize]'), lane = e.target.closest('[data-selane]'), ruler = e.target.closest('.seruler'), grid = e.target.closest('#se-grid'), fader = e.target.closest('[data-sefader]');
    if (fader) { const t = seT(fader.dataset.sefader) || { id: 'main', vol: 0 }; SE.drag = { k: 'fader', t, el: fader }; seFader(e); return; }
    if (grid) { const note = e.target.closest('[data-senote]'), [t, r] = seRegion(SE.editor), ns = seNotes(r, t); if (note) { ns.splice(+note.dataset.senote, 1); seEditor(); seArr(); return; }
      const g = grid.getBoundingClientRect(), bars = +grid.dataset.bars, hi = +grid.dataset.hi, rows = hi - +grid.dataset.lo, s = Math.floor((e.clientX - g.left) / g.width * bars * 4) / 4, p = hi - 1 - Math.floor((e.clientY - g.top) / g.height * rows);
