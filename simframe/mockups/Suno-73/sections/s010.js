      ns.push({ s, l: .25, p, v: .85 }); seEditor(); seArr(); return; }
    if (ruler && !reg) { const a = $('#se-lanes').getBoundingClientRect(); SE.pos = Math.max(1, (e.clientX - a.left) / seBars() + 1); seLCD(); SE.drag = { k: 'scrub' }; return; }
    if (rs) { const [t, r] = seRegion(rs.dataset.seresize); SE.drag = { k: 'len', r, x0: e.clientX, l0: r.l }; e.stopPropagation(); return; }
    if (reg) { const [t, r] = seRegion(reg.dataset.sereg); SE.sel = { t: t.id, r: r.id }; SE.drag = { k: 'reg', r, t, x0: e.clientX, s0: r.s }; seSelPaint(); sePanels(); return; }
    if (lane) { SE.sel = { t: lane.dataset.selane, r: null }; seSelPaint(); sePanels(); } }
  // Selection repaints classes in place: redrawing here would remove the element under the pointer and the click (and double-click) would never arrive
  function seSelPaint() { $$('#se-heads .sehead').forEach(h => h.classList.toggle('on', h.dataset.setrack === SE.sel.t)); $$('#se-lanes .selane').forEach(l => l.classList.toggle('on', l.dataset.selane === SE.sel.t)); $$('#se-lanes .sereg').forEach(g => g.classList.toggle('on', g.dataset.sereg === SE.sel.r)); }
  function seFader(e) { const D = SE.drag, g = D.el.getBoundingClientRect(), f = Math.max(0, Math.min(1, (g.bottom - e.clientY) / g.height)); D.t.vol = Math.round(f * 66 - 60); if (D.t.id !== 'main') seT(D.t.id).vol = D.t.vol; const cap = D.el.querySelector('.sefcap'); cap.style.bottom = f * 100 + '%'; const em = D.el.closest('.sestrip2').querySelector('em'); em.textContent = `${D.t.vol > 0 ? '+' : ''}${D.t.vol} dB`; }
  function sePtrMove(e) { const D = SE.drag; if (!D) return;
    if (D.k === 'fader') { seFader(e); return; } if (D.k === 'scrub') { const a = $('#se-lanes').getBoundingClientRect(); SE.pos = Math.max(1, Math.min(49, (e.clientX - a.left) / seBars() + 1)); seLCD(); return; }
    const db = Math.round((e.clientX - D.x0) / seBars());
    if (D.k === 'reg') { const s = Math.max(1, Math.min(49 - D.r.l, D.s0 + db)); if (s !== D.r.s) { D.r.s = s; D.moved = true; seArr(); } }
    if (D.k === 'len') { const l = Math.max(1, Math.min(49 - D.r.s, D.l0 + db)); if (l !== D.r.l) { D.r.l = l; seArr(); } } }
  function sePtrUp() { if (SE.drag?.k === 'reg' && SE.drag.moved) seInsp(); if (SE.drag?.k === 'fader') seInsp(); SE.drag = null; }
  function renderSession() { $('#se-top').innerHTML = `<img src="${A}daw.svg" alt=""><b>Late light</b><span class="sumeta">Session · Saved</span><span class="sutopr">${av('SK', 26)}<button class="bt sm fill" type="button" data-setodo="Bounce to Music: WAV, FLAC or MP3">${ic('share')}Bounce</button><button class="ib" type="button" data-lmenu data-docmore title="More" aria-label="More">${ic('ellipsis')}</button></span>`;   // the engine detail (48 kHz · 5.3 ms) is in the Mixer header and Settings, not the title bar
    const w = $('#se-work'); w.addEventListener('pointerdown', sePtr);
    w.addEventListener('dblclick', e => { const id = e.target.closest('[data-sereg]')?.dataset.sereg || (e.target.closest('#se-lanes') && SE.sel.r); if (!id) return; const [t, r] = seRegion(id); SE.sel = { t: t.id, r: r.id }; SE.editor = r.id; seArr(); sePanels(); });   // pointerdown carries no click count; the first click re-rendered the region, so use the selection addEventListener('pointermove', sePtrMove); addEventListener('pointerup', sePtrUp);
    new ResizeObserver(() => { seArr(); seEditor(); }).observe(w); seAll(); }
  document.addEventListener('input', e => { const t = e.target; if (!t.closest?.('#w-session')) return;
    const k = t.dataset.seset; if (k) { const v = +t.value, [tr, r] = SE.sel.r ? seRegion(SE.sel.r) : [seT(SE.sel.t)], obj = r || tr; obj[k] = v; const em = t.parentElement.querySelector('em'); const unit = { vol: ' dB', gain: ' dB', tr: ' st', rev: '%', dly: '%', fin: ' ms', fout: ' ms' }[k] || '';
      em.textContent = (k === 'pan' ? (v == 0 ? 'C' : v < 0 ? 'L' + -v : 'R' + v) : ((k === 'vol' || k === 'gain' || k === 'tr') && v > 0 ? '+' : '') + v + unit); if (SE.editor) seEditor(); return; }
    if (t.matches('[data-sepan]')) { seT(t.dataset.sepan).pan = +t.value; return; }
    if (t.matches('[data-setname]')) { seT(SE.sel.t).n = t.value; seArr(); return; } if (t.matches('[data-sername]')) { seRegion(SE.sel.r)[1].n = t.value; seArr(); } });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'session' || e.target.closest?.('input, textarea')) return; const k = e.key.toLowerCase();
    if (e.key === ' ') { e.preventDefault(); sePlay(!SE.playing); return; } if (e.key === 'Enter') { SE.pos = 1; seLCD(); return; }
    if (e.key === 'Escape') { if (SE.mixer) SE.mixer = false; else if (SE.editor) SE.editor = null; else SE.sel = { t: null, r: null }; seAll(); return; }
    if (e.key === '\\') { SE.focus = !SE.focus; sePanels(); return; } if (k === 'x') { SE.mixer = !SE.mixer; seBar(); sePanels(); return; } if (k === 'c') { SE.loop.on = !SE.loop.on; seAll(); return; } if (k === 'k') { SE.click = !SE.click; seBar(); return; }
    if (k === 'r') { $('[data-serecord]')?.click(); return; } if (k === 'y') { SE.lib = !SE.lib; seLib(); seInsp(); setTimeout(seArr, 320); return; }
    if (k === 'e' && SE.sel.r) { SE.editor = SE.editor ? null : SE.sel.r; seArr(); sePanels(); return; }
    if ((e.key === 'Backspace' || e.key === 'Delete') && SE.sel.r) { const [t] = seRegion(SE.sel.r); t.regions = t.regions.filter(r => r.id !== SE.sel.r); if (SE.editor === SE.sel.r) SE.editor = null; SE.sel.r = null; seAll(); } });

  /* ══ Darkroom ════════════════════════════════════════════════════════════════
     A serious photo editor that shows one thing at a time. Two places: the Library, where you cull, and Edit,
     where you work on one photo. In the Library the bar is culling (stars, pick, reject, label) with Edit as its
     key. In Edit the photo sits on neutral grey and the bar holds the tools; the inspector becomes whichever tool
     you picked, and only one group of sliders is open at once. Looks are previews of your own photo. */
  const DRPH = [['life-sync-terrace', 'Terrace'], ['life-hero-studio', 'Studio morning'], ['life-ari-street', 'Ari, Mission St'], ['life-hero-writing', 'Writing'], ['life-professionals-loft', 'The loft'], ['life-hero-home', 'Home office'], ['life-work-suite', 'Work suite'], ['life-suite-bg-darkroom', 'Focus'], ['life-suite-bg-stage', 'Stage'],
    ['life-suite-bg-sessions', 'Sessions'], ['life-suite-bg-canvas', 'Canvas desk'], ['life-suite-bg-write', 'Notebook'], ['life-suite-bg-grid', 'Numbers'], ['life-suite-bg-reel', 'Reel'], ['life-testimonial', 'Portrait'], ['life-footer', 'Evening'], ['life-ledge-blog-1', 'Ledge'], ['take-back', 'Take back']];
  const DRCAM = [['Fujifilm X-T5', 'XF 33mm f/1.4', '1/250', 'f/2', 400], ['Fujifilm X-T5', 'XF 56mm f/1.2', '1/500', 'f/1.4', 200], ['Sony A7 IV', 'FE 35mm f/1.8', '1/160', 'f/2.8', 800]];
  const DRA0 = { exp: 0, con: 0, hi: 0, sh: 0, wh: 0, bl: 0, temp: 0, tint: 0, vib: 0, sat: 0, cla: 0, vig: 0, grain: 0, fade: 0, sharp: 20, nr: 10 };
  const DRGROUPS = [['Light', [['exp', 'Exposure', -100, 100], ['con', 'Contrast'], ['hi', 'Highlights'], ['sh', 'Shadows'], ['wh', 'Whites'], ['bl', 'Blacks']]], ['Color', [['temp', 'Temperature'], ['tint', 'Tint'], ['vib', 'Vibrance'], ['sat', 'Saturation']]],
    ['Effects', [['cla', 'Clarity'], ['vig', 'Vignette', 0, 100], ['grain', 'Grain', 0, 100], ['fade', 'Fade', 0, 100]]], ['Detail', [['sharp', 'Sharpening', 0, 100], ['nr', 'Noise reduction', 0, 100]]]];
  const DRLOOKS = [['As shot', {}], ['Portra', { temp: 18, tint: 4, sat: -10, con: -12, sh: 22, fade: 12 }], ['Tri-X', { sat: -100, con: 32, grain: 34, cla: 20 }], ['Velvia', { sat: 34, vib: 22, con: 16, bl: -10 }], ['Faded', { fade: 38, con: -18, sat: -14 }], ['Noon', { hi: -42, sh: 34, con: -6 }], ['Golden', { temp: 34, exp: 12, vib: 10 }], ['Blue hour', { temp: -30, tint: 8, exp: -10, con: 10 }]];
  const DR = { view: 'library', cur: 0, sel: [0], set: 'terrace', tool: 'adjust', open: 'Light', left: true, info: false, compare: false, split: 50, focus: false, mask: null, undo: [], photos: DRPH.map(([f, n], i) => ({ f, n, stars: [4, 5, 3, 4, 2, 5, 3, 0, 0, 4, 3, 2, 0, 4, 5, 3, 1, 4][i], flag: [1, 1, 0, 1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1, 0][i], label: [null, 'red', null, 'green', null, null, 'blue', null, null, null, 'green', null, null, null, 'red', null, null, null][i], a: { ...DRA0 }, look: 'As shot', crop: null, rot: 0, heal: [], masks: {}, cam: DRCAM[i % 3], date: `Sep ${21 - (i % 9)}`, time: `${8 + (i % 9)}:${String(10 + i * 3).slice(-2)}` })) };
  DR.photos[0].a = { ...DRA0, exp: 8, sh: 24, temp: 10, vib: 12, vig: 18 }; DR.photos[0].look = 'As shot'; DR.photos[1].look = 'Portra'; Object.assign(DR.photos[1].a, DRLOOKS[1][1]);
  const drP = () => DR.photos[DR.cur];
  const DRNOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.9'/%3E%3C/svg%3E")`;
  function drFilter(a) { const b = 1 + a.exp / 100 * .55 + a.sh / 100 * .12 + a.wh / 100 * .06 - Math.max(0, a.hi) / 100 * .02, c = 1 + a.con / 100 * .45 + a.cla / 100 * .12 - a.sh / 100 * .14 + a.hi / 100 * .1 - a.bl / 100 * .12 - a.fade / 100 * .2, s = Math.max(0, 1 + a.sat / 100 + a.vib / 100 * .5);
    return `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)}) saturate(${s.toFixed(3)})`; }
  function drLayers(a) { const t = a.temp, ti = a.tint; return `${t ? `<i class="drov" style="background:${t > 0 ? 'rgb(255,150,40)' : 'rgb(40,120,255)'};opacity:${Math.abs(t) / 100 * .32};mix-blend-mode:soft-light"></i>` : ''}${ti ? `<i class="drov" style="background:${ti > 0 ? 'rgb(255,40,200)' : 'rgb(40,220,90)'};opacity:${Math.abs(ti) / 100 * .22};mix-blend-mode:soft-light"></i>` : ''}
      ${a.fade ? `<i class="drov" style="background:rgb(230,225,215);opacity:${a.fade / 100 * .22};mix-blend-mode:lighten"></i>` : ''}${a.vig ? `<i class="drov" style="background:radial-gradient(ellipse at 50% 50%, transparent 45%, #000 100%);opacity:${a.vig / 100 * .85}"></i>` : ''}${a.grain ? `<i class="drov" style="background:${DRNOISE};opacity:${a.grain / 100 * .45};mix-blend-mode:overlay"></i>` : ''}`; }
  function drMaskLayers(p) { let h = ''; const m = p.masks; if (m.subject) { const { exp = 0, temp = 0 } = m.subject; if (exp) h += `<i class="drov" style="background:radial-gradient(ellipse 30% 44% at 52% 48%, ${exp > 0 ? '#fff' : '#000'}, transparent 70%);opacity:${Math.abs(exp) / 100 * .6};mix-blend-mode:soft-light"></i>`; if (temp) h += `<i class="drov" style="background:radial-gradient(ellipse 30% 44% at 52% 48%, ${temp > 0 ? 'rgb(255,150,40)' : 'rgb(40,120,255)'}, transparent 70%);opacity:${Math.abs(temp) / 100 * .5};mix-blend-mode:soft-light"></i>`; }
    if (m.sky) { const { exp = 0, temp = 0 } = m.sky; if (exp) h += `<i class="drov" style="background:linear-gradient(${exp > 0 ? '#fff' : '#000'}, transparent 45%);opacity:${Math.abs(exp) / 100 * .6};mix-blend-mode:soft-light"></i>`; if (temp) h += `<i class="drov" style="background:linear-gradient(${temp > 0 ? 'rgb(255,150,40)' : 'rgb(40,120,255)'}, transparent 45%);opacity:${Math.abs(temp) / 100 * .5};mix-blend-mode:soft-light"></i>`; }
    return h; }
  const drImg = (p, a = p.a, full) => `<img src="${PH}${p.f}.webp" alt="" style="filter:${drFilter(a)};${p.crop && !full ? `object-view-box:inset(${p.crop.t}% ${p.crop.r}% ${p.crop.b}% ${p.crop.l}%);` : ''}${p.rot ? `transform:rotate(${p.rot}deg) scale(${1 + Math.abs(p.rot) * .025});` : ''}">${drLayers(a)}${drMaskLayers(p)}`;

  /* ── Library: culling ── */
  const drStars = (n, attr = true) => `<span class="drstars">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"${attr ? ` data-drstar="${i}"` : ''}>${ic('star')}</i>`).join('')}</span>`;
  function drGrid() { $('#dr-body').innerHTML = `<div class="drlib"><header class="drlibh"><div><h1>Terrace</h1><p>September 21 · ${DR.photos.length} photos · ${DR.photos.filter(p => p.flag === 1).length} picks</p></div></header>
      <div class="drgrid">${DR.photos.map((p, i) => `<button type="button" class="drtile${DR.sel.includes(i) ? ' on' : ''}${p.flag === -1 ? ' rej' : ''}" data-drtile="${i}"><span class="drthumb">${drImg(p)}</span>
        <span class="drmeta">${p.stars ? drStars(p.stars, false) : '<span></span>'}${p.flag === 1 ? `<i class="drpick">${ic('flag')}</i>` : p.flag === -1 ? `<i class="drrejx">${ic('x')}</i>` : ''}${p.label ? `<i class="drlab ${p.label}"></i>` : ''}</span>${p.look !== 'As shot' || Object.keys(DRA0).some(k => p.a[k] !== DRA0[k]) ? '<em class="dredited">Edited</em>' : ''}</button>`).join('')}</div></div>`; }
  /* ── Edit: one photo, neutral grey, one tool at a time ── */
  function drEdit() { const p = drP(); $('#dr-body').innerHTML = `<div class="dredit" id="dr-edit"><div class="drstage" id="dr-stage"><div class="drpic${DR.compare ? ' cmp' : ''}" id="dr-pic"><div class="drlayer">${drImg(p, p.a, DR.tool === 'crop')}</div>${DR.compare ? `<div class="drlayer before" style="clip-path:inset(0 ${100 - DR.split}% 0 0)"><img src="${PH}${p.f}.webp" alt=""><em>Before</em></div><i class="drsplit" id="dr-split" style="left:${DR.split}%"><b>${ic('split')}</b></i><em class="drafter">After</em>` : ''}
      ${DR.tool === 'crop' ? `<div class="drcrop" id="dr-crop" style="--t:${p.crop?.t || 0}%;--r:${p.crop?.r || 0}%;--b:${p.crop?.b || 0}%;--l:${p.crop?.l || 0}%"><i class="drthirds"></i>${['nw', 'ne', 'se', 'sw'].map(d => `<i class="drch ${d}" data-drch="${d}"></i>`).join('')}</div>` : ''}${DR.tool === 'mask' && DR.mask ? `<i class="drmaskvis ${DR.mask}"></i>` : ''}${DR.tool === 'heal' ? p.heal.map(h => `<i class="drheal" style="left:${h[0]}%;top:${h[1]}%"></i>`).join('') : ''}</div></div></div>`; drFitPic(); }
  function drFitPic() { const st = $('#dr-stage'), pic = $('#dr-pic'); if (!st || !pic) return; const img = pic.querySelector('img'), p = drP(), go = () => { const iw = img.naturalWidth || 3, ih = img.naturalHeight || 2, c = DR.tool === 'crop' ? null : p.crop, cw = c ? iw * (100 - c.l - c.r) / 100 : iw, chh = c ? ih * (100 - c.t - c.b) / 100 : ih;
      const ph = $('#w-darkroom').classList.contains('phone'), L = ph ? 12 : DR.left && !DR.focus ? 270 : 40, R = ph ? 12 : !DR.focus ? 300 : 40;   // on a phone the panels are drawers, so the photo gets the width
      const W = st.clientWidth - L - R, H = st.clientHeight - (drNarrow() ? 460 : 130), k = Math.min(W / cw, H / chh); pic.style.width = cw * k + 'px'; pic.style.height = chh * k + 'px'; pic.style.left = L + (W - cw * k) / 2 + 'px'; pic.style.top = (drNarrow() ? 100 : 40) + (H - chh * k) / 2 + 'px'; };
    if (img.complete) go(); else img.onload = go; }

  /* ── Panels ── */
  function drLeft() { const el = $('#dr-left'); el.className = 'supanel l' + (!DR.left || DR.focus ? ' min' : '') + (DR.focus ? ' gone' : '');
    if (DR.view === 'edit') { if (!DR.left) { el.innerHTML = `<button class="supill" type="button" data-drleft>${ic('gallery-vertical')}<b>Terrace</b><span>${DR.cur + 1} of ${DR.photos.length}</span></button>`; return; }
      el.innerHTML = `<header class="suph1"><button class="supage" type="button" data-drlib><b>${ic('chevron-left')}Terrace</b></button><button class="ib" type="button" data-drleft title="Hide filmstrip" aria-label="Hide filmstrip">${ic('panel-left')}</button></header><div class="suscroll drstrip">${DR.photos.map((p, i) => `<button type="button" class="drst${i === DR.cur ? ' on' : ''}${p.flag === -1 ? ' rej' : ''}" data-drgo="${i}"><span class="drthumb">${drImg(p)}</span></button>`).join('')}</div>`; requestAnimationFrame(() => $('#dr-left .drst.on')?.scrollIntoView({ block: 'nearest' })); return; }
    if (!DR.left) { el.innerHTML = `<button class="supill" type="button" data-drleft>${ic('image')}<b>Terrace</b><span>${DR.photos.length} photos</span></button>`; return; }
    const row = (icn, n, c, on, attr = 'data-drtodo="This set is empty in the mockup"') => `<div class="sulyr${on ? ' lsel' : ''}" style="--d:0" ${attr}${on ? ' aria-current="page"' : ''}><i class="sucar"></i>${ic(icn)}<span>${n}</span>${typeof c === 'number' ? lCount(c) : `<em class="suem">${c}</em>`}</div>`;
    el.innerHTML = `<header class="suph1"><button class="supage" type="button" data-drtodo="Library on Luma SSD · 1,284 photos"><b>Library</b>${ic('chevron-down')}</button><button class="ib" type="button" data-drleft title="Hide library" aria-label="Hide library">${ic($('#w-darkroom').classList.contains('phone') ? 'x' : 'panel-left')}</button></header><div class="suscroll">
      ${row('image', 'All photos', 1284)}${row('flag', 'Picks', 212)}${row('download', 'Last import', 18)}<h6 class="suh">Shoots</h6>${row('calendar', 'Terrace', 'Sep 21', true, '')}${row('calendar', 'Studio', 'Sep 18')}${row('calendar', 'Loft launch', 'Sep 12')}${row('calendar', 'Street', 'Aug 30')}
      <h6 class="suh">Albums</h6>${row('bookmark', 'Portfolio', 48)}${row('bookmark', 'Launch press', 22)}</div>`; }
  function drInsp() { const el = $('#dr-right'), p = drP(), sec = (t, b, add = '') => `<section class="susec"><header><b>${t}</b>${add}</header>${b}</section>`; if (DR.focus) { el.className = 'supanel r gone'; return; } el.className = 'supanel r';
    if (DR.view === 'library') { el.className = 'supanel r min gone'; el.innerHTML = ''; return; }   // the library's information is the details pane (drInfo)
    if ($('#w-darkroom').classList.contains('phone') && !DR.pinsp && DR.sel.length && !drNarrow()) { el.className = 'supanel r min'; el.innerHTML = `<button class="supill" type="button" data-drpinsp>${ic(DR.view === 'edit' ? 'sliders-horizontal' : 'image')}<b>${DR.view === 'edit' ? 'Adjust' : 'Info'}</b></button>`; return; }
    const hist = `<div class="drhist"><svg id="dr-hist" viewBox="0 0 256 80" preserveAspectRatio="none"></svg><p><span>${p.cam[2]} · ${p.cam[3]} · ISO ${p.cam[4]}</span><span>${p.cam[1].split(' ').slice(0, 2).join(' ')}</span></p></div>`;
    const slider = (obj, [k, label, min = -100, max = 100], attr = 'data-dra') => `<label class="drsl${obj[k] !== (DRA0[k] ?? 0) ? ' set' : ''}"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${obj[k] ?? 0}" ${attr}="${k}"><em>${obj[k] > 0 && min < 0 ? '+' : ''}${obj[k] ?? 0}</em></label>`;
    let body = '', title = { adjust: 'Adjust', crop: 'Crop', looks: 'Looks', mask: 'Masks', heal: 'Heal' }[DR.tool], act = '';
    if (DR.tool === 'adjust') { act = `<button class="bt sm fill" type="button" data-drauto>Auto</button>`;
      body = DRGROUPS.map(([g, items]) => { const on = DR.open === g, mod = items.some(([k]) => p.a[k] !== DRA0[k]); return `<section class="susec drgrp${on ? ' open' : ''}"><button class="drgh" type="button" data-drgrp="${g}"><b>${g}</b>${mod ? '<i class="drdot"></i>' : ''}${ic('chevron-down')}</button>${on ? `<div class="drsls">${items.map(it => slider(p.a, it)).join('')}</div>` : ''}</section>`; }).join(''); }
    else if (DR.tool === 'looks') { body = `<div class="drlooks">${DRLOOKS.map(([n, d]) => `<button type="button" class="${p.look === n ? 'on' : ''}" data-drlook="${n}"><span class="drthumb">${drImg({ ...p, masks: {}, crop: null, rot: 0 }, { ...DRA0, ...d })}</span><b>${n}</b></button>`).join('')}</div>`; }
    else if (DR.tool === 'crop') { body = sec('Shape', `<div class="drar">${[['free', 'Free'], ['orig', 'Original'], ['1', '1:1'], ['0.8', '4:5'], ['1.5', '3:2'], ['1.778', '16:9']].map(([k, n]) => `<button type="button" class="${(DR.ar || 'orig') === k ? 'on' : ''}" data-drar="${k}">${n}</button>`).join('')}</div>`) + sec('Straighten', `<label class="drsl${p.rot ? ' set' : ''}"><span>Angle</span><input type="range" min="-15" max="15" step=".5" value="${p.rot}" data-drrot><em>${p.rot}°</em></label>`)
      + sec('Rotate', `<div class="surow2"><button class="bt sm fill" type="button" data-drtodo="Rotated 90° left">${ic('rotate-ccw')}Left</button><button class="bt sm fill" type="button" data-drtodo="Flipped">Flip</button><button class="bt sm fill" type="button" data-drcropreset>Reset</button></div>`); }
    else if (DR.tool === 'mask') { const m = DR.mask && (p.masks[DR.mask] = p.masks[DR.mask] || {}); body = sec('Select', `<div class="drmasks">${[['subject', 'Subject', 'user'], ['sky', 'Sky', 'cloud'], ['bg', 'Background', 'image'], ['brush', 'Brush', 'pencil']].map(([k, n, i]) => `<button type="button" class="${DR.mask === k ? 'on' : ''}" data-drmask="${k}">${ic(i)}<span>${n}</span>${p.masks[k] && Object.values(p.masks[k]).some(v => v) ? '<i class="drdot"></i>' : ''}</button>`).join('')}</div>`)
      + (m ? sec(`${{ subject: 'Subject', sky: 'Sky', bg: 'Background', brush: 'Brush' }[DR.mask]} only`, `<div class="drsls">${slider(m, ['exp', 'Exposure'], 'data-drm')}${slider(m, ['temp', 'Temperature'], 'data-drm')}${slider(m, ['cla', 'Clarity'], 'data-drm')}</div>`) : '<p class="drhint">Pick what to adjust on its own. The rest of the photo stays as it is.</p>'); }
    else body = `<p class="drhint">Click a spot on the photo to remove it. Focus fills it from the area around it.</p>${p.heal.length ? `<dl class="sedl">${p.heal.map((h, i) => `<div><dt>Spot ${i + 1}</dt><dd>${Math.round(h[0])}%, ${Math.round(h[1])}%</dd></div>`).join('')}</dl><button class="bt sm fill suwide2" type="button" data-drhealclear>Clear spots</button>` : ''}`;
    el.innerHTML = `<header class="suinsph">${ic({ adjust: 'sliders-vertical', crop: 'crop', looks: 'aperture', mask: 'user', heal: 'bandage' }[DR.tool])}<b>${title}</b>${act}<button class="ib" type="button" data-drreset title="Reset all">${ic('rotate-ccw')}</button></header>${DR.tool === 'adjust' || DR.tool === 'looks' ? hist : ''}<div class="suscroll">${body}</div>`;
    drHist(); if (drNarrow() && DR.view === 'edit' && $('#dr-bar .drinsp2')) drBar(); }
  /* The library's photo information: the LumaUI details pane, closed until Info, closed again when nothing is selected */
  function drInfo() { const el = $('#dr-info'), p = drP(), on = lDPShow(el, { open: DR.info || (drNarrow() && DR.px === 'info'), subject: DR.view === 'library' && DR.sel.length }); if (!on) return;
    const [cam, lens, ss, ap, iso] = p.cam, many = DR.sel.length > 1;
    el.innerHTML = lDP({ title: many ? `${DR.sel.length} photos` : p.n, close: 'data-drinfo', body: `<div class="drinfoimg"><span class="drthumb">${drImg(p)}</span></div>`
      + lDP.lab('Rating') + `<div class="drrate">${drStars(p.stars)}<span>${['Not rated', 'One star', 'Two stars', 'Three stars', 'Four stars', 'Five stars'][p.stars]}</span></div>`
      + lDP.lab('Camera') + lDP.kv([['Camera', cam], ['Lens', lens], ['Exposure', `${ss} · ${ap} · ISO ${iso}`], ['Taken', `${p.date}, ${p.time}`], ['File', `${p.f.replace('life-', 'DSCF_').replace(/-/g, '')}.RAF · 26 MB`]])
      + lDP.lab('Keywords') + `<div class="drkw">${['terrace', 'portrait', 'golden hour', 'Oakland'].map(k => `<span>${k}</span>`).join('')}<button type="button" data-drtodo="Add a keyword" title="Add a keyword" aria-label="Add a keyword">${ic('plus')}</button></div>` }); }
  /* Top right: the two modes, then the photo's own actions (Export, Share), the Info toggle in the library, and ··· */
  function drTop() { const el = $('#dr-topr'); if (!el) return; const lib = DR.view === 'library';
    el.innerHTML = `${lModes([['library', 'Library', 'layout-grid'], ['edit', 'Edit', 'sliders-vertical']], DR.view, 'data-drmode', 'View')}<span class="vr"></span>
      <button class="bt sm fill" type="button" data-share>${ic('share-2')}Share</button><button class="bt sm fill" type="button" data-drexport${lib && !DR.sel.length ? ' disabled' : ''} title="Export a copy · Ctrl+Shift+E">${ic('share')}Export</button>
      ${lib ? `<button class="ib${DR.info ? ' on' : ''}" type="button" data-drinfo title="Information · I" aria-label="Information" aria-pressed="${DR.info}">${ic('info')}</button>` : ''}<button class="ib" type="button" data-drmore data-lmenu title="More" aria-label="More">${ic('ellipsis')}</button>`;
    requestAnimationFrame(segs); }
  function drHist() { const svg = $('#dr-hist'); if (!svg) return; const p = drP(), im = new Image(); im.src = `${PH}${p.f}.webp`; const run = () => { const c = drHist.c || (drHist.c = document.createElement('canvas')); c.width = 120; c.height = 80; const x = c.getContext('2d', { willReadFrequently: true }); x.filter = drFilter(p.a); x.drawImage(im, 0, 0, 120, 80);
      const d = x.getImageData(0, 0, 120, 80).data, R = new Array(64).fill(0), G = R.slice(), B = R.slice(), L = R.slice(); for (let i = 0; i < d.length; i += 4) { R[d[i] >> 2]++; G[d[i + 1] >> 2]++; B[d[i + 2] >> 2]++; L[(d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) >> 2]++; }
      const mx = Math.max(...R, ...G, ...B) * .9, path = a => `M0 80 ${a.map((v, i) => `L${(i / 63 * 256).toFixed(1)} ${(80 - Math.min(80, v / mx * 78)).toFixed(1)}`).join(' ')} L256 80Z`;
      svg.innerHTML = `<path d="${path(R)}" class="r"/><path d="${path(G)}" class="g"/><path d="${path(B)}" class="b"/><path d="${path(L)}" class="l"/>`; }; if (im.complete) run(); else im.onload = run; }
  /* Darkroom on a phone, the way phone photo editors work. Library: the shoot you're in as a dropdown (all photos, picks,
     shoots, albums) and Import; pick photos and the bar rates them (stars, pick, reject) with Edit first. Editing: the
     photo gets the screen, ‹ Terrace top left and Export top right; the bar is the chosen tool's controls over the tools. */
  const drNarrow = () => { const w = $('#w-darkroom'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };
  function drBarPhone(bar) { const p = drP(), X = DR.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    bar.classList.add('phnofit', 'drphbar'); let top = $('#dr-ptop'); if (!top) { $('#dr-work').insertAdjacentHTML('beforeend', '<div class="drptop" id="dr-ptop"></div>'); top = $('#dr-ptop'); }
    if (DR.view === 'library') { top.innerHTML = '';
      if (!DR.sel.length) { const row = (icn, n, c, on) => `<button class="fexr2${on ? ' on' : ''}" type="button" ${on ? 'data-drpx="shoot"' : `data-drtodo="${n} is empty in the mockup"`}>${ic(icn)}<span>${n}</span><em>${c}</em></button>`;
        const panel = X === 'shoot' ? `<div class="fexp fmore2 drshoot">${row('image', 'All photos', '1,284')}${row('flag', 'Picks', 212)}${row('download', 'Last import', 18)}<div class="fexh">Shoots</div>${row('calendar', 'Terrace', 'Sep 21', true)}${row('calendar', 'Studio', 'Sep 18')}${row('calendar', 'Loft launch', 'Sep 12')}${row('calendar', 'Street', 'Aug 30')}<div class="fexh">Albums</div>${row('bookmark', 'Portfolio', 48)}${row('bookmark', 'Launch press', 22)}</div>` : '';
        bar.classList.toggle('phgrow', !!panel); setBar(bar, `${panel}<div class="drr"><button class="drshoot2${X === 'shoot' ? ' on' : ''}" type="button" data-drpx="shoot">${ic('calendar')}<b>Terrace</b>${ic('chevron-down')}</button><span class="sp"></span><button class="bt pri drprim" type="button" data-drtodo="Import from a card, a camera or a folder">${ic('download')}<span>Import</span></button></div>`); return; }
      const many = DR.sel.length > 1, panel = X === 'info' ? `<div class="fexp drinfo2">${$('#dr-info').innerHTML}</div>` : '';
      bar.classList.toggle('phgrow', true);
      setBar(bar, `${panel}<div class="drr drrate2"><span class="drsel2">${many ? `${DR.sel.length} photos` : esc(p.n)}</span>${drStars(p.stars)}<button class="ib${p.flag === 1 ? ' on pick' : ''}" type="button" data-drflag="1" aria-label="Pick">${ic('flag')}</button><button class="ib${p.flag === -1 ? ' on rej' : ''}" type="button" data-drflag="-1" aria-label="Reject">${ic('x')}</button></div>
        <div class="drr drr2"><button class="bt pri drprim" type="button" data-drmode="edit">${ic('sliders-vertical')}<span>Edit</span></button>${ib('data-drpx="info"', 'info', 'Information', X === 'info')}${ib('data-share', 'share-2', 'Share')}${ib('data-drexport', 'share', 'Export')}${ib('data-drdesel', 'circle-x', 'Done')}</div>`); return; }
    top.innerHTML = `<button class="flo drback2" type="button" data-drlib>${ic('chevron-left')}<span>Terrace</span><em>${DR.cur + 1} of ${DR.photos.length}</em></button><div class="flo drtopr2"><button class="ib" type="button" data-share aria-label="Share">${ic('share-2')}</button><button class="ib" type="button" data-drexport aria-label="Export">${ic('share')}</button></div>`;
    const t = (k, icn, label) => `<button class="drtool${DR.tool === k ? ' on' : ''}" type="button" data-drtool="${k}" aria-label="${label}">${ic(icn)}<span>${label}</span></button>`;
    bar.classList.add('phgrow'); setBar(bar, `<div class="fexp drinsp2">${$('#dr-right').innerHTML}</div><div class="drr drtools2">${t('adjust', 'sliders-vertical', 'Adjust')}${t('looks', 'aperture', 'Looks')}${t('crop', 'crop', 'Crop')}${t('mask', 'user', 'Masks')}${t('heal', 'bandage', 'Heal')}<button class="drtool${DR.compare ? ' on' : ''}" type="button" data-drcmp aria-label="Before and after">${ic('split')}<span>Compare</span></button></div>`); }
  function drBar() { const p = drP(), bar = $('#dr-bar');
    if (drNarrow()) return drBarPhone(bar); bar.classList.remove('phnofit', 'drphbar', 'phgrow'); $('#dr-ptop')?.remove();
    if (DR.view === 'library') { if (!DR.sel.length) { setBar(bar, `<button class="bt" type="button" data-drtodo="Sorted by capture time">Capture time${ic('chevron-down')}</button><span class="vr"></span><button class="bt key" type="button" data-drtodo="Import from a card, a camera or a folder">${ic('download')}Import</button>`); return; }
      const many = DR.sel.length > 1; setBar(bar, `<span class="ctxc drctx"><span class="drctxth">${drImg(p)}</span>${many ? `${DR.sel.length} photos` : esc(p.n)}</span>${drStars(p.stars)}<span class="vr"></span><button class="ib${p.flag === 1 ? ' on pick' : ''}" type="button" data-drflag="1" title="Pick · P">${ic('flag')}</button><button class="ib${p.flag === -1 ? ' on rej' : ''}" type="button" data-drflag="-1" title="Reject · X">${ic('x')}</button>
        <span class="drlabs">${['red', 'amber', 'green', 'blue'].map(c => `<button type="button" class="drlab ${c}${p.label === c ? ' on' : ''}" data-drlabel="${c}" title="${c[0].toUpperCase() + c.slice(1)} label" aria-label="${c[0].toUpperCase() + c.slice(1)} label"></button>`).join('')}</span>`); return; }
    const t = (k, icn, label, key) => `<button class="sut${DR.tool === k ? ' on' : ''}" type="button" data-drtool="${k}" title="${label} · ${key}" aria-label="${label}">${ic(icn)}</button>`;
    setBar(bar, `${t('adjust', 'sliders-vertical', 'Adjust', 'A')}${t('crop', 'crop', 'Crop', 'R')}${t('looks', 'aperture', 'Looks', 'L')}${t('mask', 'user', 'Masks', 'M')}${t('heal', 'bandage', 'Heal', 'H')}<span class="vr"></span>
      <button class="sut${DR.compare ? ' on' : ''}" type="button" data-drcmp title="Before and after · Y" aria-label="Before and after">${ic('split')}</button>`); }
  function drAll() { $('#w-darkroom').classList.toggle('drediting', DR.view === 'edit'); DR.view === 'edit' ? drEdit() : drGrid(); drLeft(); drInsp(); drInfo(); drBar(); drTop(); }
  const drToast = (msg, o) => lToast($('#w-darkroom'), msg, o);   // one notice for the whole OS
  function drUndo() { const u = DR.undo.pop(); if (!u) return false; const p = DR.photos[u.i]; Object.assign(p, { a: u.a, look: u.look, rot: u.rot, crop: u.crop, masks: u.masks }); DR.cur = u.i; drAll(); return true; }
  function drRepaint() { if (DR.view !== 'edit') return; const p = drP(), layer = $('#dr-pic .drlayer'); if (layer) layer.innerHTML = drImg(p, p.a, DR.tool === 'crop'); $$('#dr-bar .drctxth').forEach(e => e.innerHTML = drImg(p)); const s = $(`#dr-left .drst.on .drthumb`); if (s) s.innerHTML = drImg(p); clearTimeout(drRepaint.t); drRepaint.t = setTimeout(drHist, 60); }
  const drSnap = () => { const p = drP(); DR.undo.push({ i: DR.cur, a: { ...p.a }, look: p.look, rot: p.rot, crop: p.crop && { ...p.crop }, masks: JSON.parse(JSON.stringify(p.masks)) }); if (DR.undo.length > 50) DR.undo.shift(); };
  function drFlag(v) { DR.sel.forEach(i => { DR.photos[i].flag = DR.photos[i].flag === v ? 0 : v; }); drGrid(); drBar(); drInfo(); }
  function drStar(n) { DR.sel.forEach(i => { DR.photos[i].stars = DR.photos[i].stars === n ? 0 : n; }); drGrid(); drBar(); drInfo(); }

  function drClick(e, hit) { const q = s => hit(s);
    if (drNarrow()) { const px = q('[data-drpx]'); if (px) { const k = px.dataset.drpx; DR.px = DR.px === k ? '' : k; if (k === 'info') drInfo(); drBar(); return true; }
      if (q('[data-drdesel]')) { DR.sel = []; DR.px = ''; drGrid(); drBar(); return true; }
      const tl = q('[data-drtile]'); if (tl && DR.view === 'library') { const i = +tl.dataset.drtile; DR.sel = DR.sel.includes(i) && DR.sel.length === 1 ? [] : [i]; DR.cur = i; DR.px = ''; drGrid(); drBar(); return true; }
      if (q('[data-drmode]') || q('[data-drlib]')) DR.px = ''; }
    const tile = q('[data-drtile]'); if (tile) { const i = +tile.dataset.drtile; DR.sel = e.shiftKey ? [...new Set([...DR.sel, i])] : e.metaKey ? (DR.sel.includes(i) ? DR.sel.filter(x => x !== i) : [...DR.sel, i]) : [i]; DR.cur = i; if (e.detail === 2) { DR.view = 'edit'; DR.left = false; drAll(); return true; } drGrid(); drInfo(); drBar(); drTop(); return true; }
    const md = q('[data-drmode]'); if (md) { const v = md.dataset.drmode; if (v !== DR.view) { if (v === 'edit') { DR.view = 'edit'; DR.left = false; } else { DR.view = 'library'; DR.left = true; DR.compare = false; DR.sel = [DR.cur]; } drAll(); } return true; }
    if (q('[data-drinfo]')) { DR.info = !DR.info; drInfo(); drTop(); return true; }
    if (q('[data-drmore]')) { const rej = DR.photos.filter(p => p.flag === -1).length; lMenu(q('[data-drmore]'), crMi('data-drtodo="Import from a card, a camera or a folder"', 'download', 'Import…') + crMi('data-drtodo="Opening Terrace in Filer"', 'folder-open', 'Show in Filer') + (rej ? '<span class="crsep"></span>' + crMi('data-drbin', 'trash-2', `Move ${rej} rejected to Trash`, ' red') : '')); return true; }
    if (q('[data-drbin]')) { $('#lmenu')?.remove(); const was = DR.photos.slice(), n = was.filter(p => p.flag === -1).length; DR.photos = DR.photos.filter(p => p.flag !== -1); DR.cur = 0; DR.sel = []; DR.undo = []; drAll();
      drToast(`Moved ${n} rejected ${n === 1 ? 'photo' : 'photos'} to Trash`, { icon: 'trash-2', undo: () => { DR.photos = was; drAll(); } }); return true; }
    if (q('[data-drlib]')) { DR.view = 'library'; DR.left = true; DR.compare = false; DR.sel = [DR.cur]; drAll(); return true; }   // the filmstrip's own way back
    const st = q('[data-drstar]'); if (st) { drStar(+st.dataset.drstar); return true; }
    const fl = q('[data-drflag]'); if (fl) { drFlag(+fl.dataset.drflag); return true; }
    const lb = q('[data-drlabel]'); if (lb) { DR.sel.forEach(i => { DR.photos[i].label = DR.photos[i].label === lb.dataset.drlabel ? null : lb.dataset.drlabel; }); drGrid(); drBar(); return true; }
    if (q('[data-drleft]')) { DR.left = !DR.left; if (DR.left && $('#w-darkroom').classList.contains('phone')) DR.pinsp = false; drLeft(); drInsp(); if (DR.view === 'edit') drFitPic(); return true; }
    if (q('[data-drpinsp]')) { DR.pinsp = !DR.pinsp; if (DR.pinsp) DR.left = false; drLeft(); drInsp(); return true; }
    const go = q('[data-drgo]'); if (go) { DR.cur = +go.dataset.drgo; DR.mask = null; drAll(); return true; }
    const tl = q('[data-drtool]'); if (tl) { DR.tool = tl.dataset.drtool; DR.compare = false; drEdit(); drInsp(); drBar(); return true; }
    const gp = q('[data-drgrp]'); if (gp) { DR.open = DR.open === gp.dataset.drgrp ? null : gp.dataset.drgrp; drInsp(); return true; }
    const lk = q('[data-drlook]'); if (lk) { drSnap(); const p = drP(), d = DRLOOKS.find(x => x[0] === lk.dataset.drlook)[1]; p.a = { ...DRA0, ...d }; p.look = lk.dataset.drlook; drRepaint(); drInsp(); drToast(`${p.look} applied`, { icon: 'aperture', undo: drUndo }); return true; }
    if (q('[data-drauto]')) { drSnap(); Object.assign(drP().a, { exp: 10, con: 8, hi: -30, sh: 26, wh: 12, bl: -8, vib: 14 }); drRepaint(); drInsp(); drToast('Auto adjusted', { icon: 'sliders-vertical', undo: drUndo }); return true; }
    if (q('[data-drreset]')) { drSnap(); const p = drP(); p.a = { ...DRA0 }; p.look = 'As shot'; p.masks = {}; p.rot = 0; p.crop = null; p.heal = []; drEdit(); drInsp(); drToast('Reset to as shot', { icon: 'rotate-ccw', undo: drUndo }); return true; }
    if (q('[data-drcmp]')) { DR.compare = !DR.compare; drEdit(); drBar(); return true; }
    const ar = q('[data-drar]'); if (ar) { DR.ar = ar.dataset.drar; drSnap(); const p = drP(), k = +DR.ar; if (k) { const img = $('#dr-pic img'), ia = img.naturalWidth / img.naturalHeight; if (k < ia) { const w = k / ia * 100; p.crop = { t: 0, b: 0, l: (100 - w) / 2, r: (100 - w) / 2 }; } else { const h = ia / k * 100; p.crop = { l: 0, r: 0, t: (100 - h) / 2, b: (100 - h) / 2 }; } } else if (DR.ar === 'orig') p.crop = null; drEdit(); drInsp(); return true; }
    if (q('[data-drcropreset]')) { const p = drP(); p.crop = null; p.rot = 0; DR.ar = 'orig'; drEdit(); drInsp(); return true; }
    const mk2 = q('[data-drmask]'); if (mk2) { DR.mask = DR.mask === mk2.dataset.drmask ? null : mk2.dataset.drmask; drEdit(); drInsp(); return true; }
    if (q('[data-drhealclear]')) { drP().heal = []; drEdit(); drInsp(); return true; }
    if (q('[data-drexport]')) { const n = DR.view === 'library' && DR.sel.length > 1 ? DR.sel.length : 0; drToast(n ? `Exported ${n} photos to Pictures` : `Exported “${drP().n}.jpg” to Pictures`, { icon: 'share' }); return true; }
    const td = q('[data-drtodo]'); if (td) { drToast(td.dataset.drtodo); return true; }
    if (DR.view === 'library' && q('.drlib') && !q('.drtile')) { DR.sel = []; drGrid(); drInfo(); drBar(); drTop(); return true; }
    if (DR.tool === 'heal' && q('#dr-pic')) { const r = $('#dr-pic').getBoundingClientRect(); drP().heal.push([(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100]); drEdit(); drInsp(); return true; }
    return false; }
  function drPtr(e) { const sp = e.target.closest('#dr-split'); if (sp) { DR.drag = { k: 'split' }; e.preventDefault(); return; } const ch = e.target.closest('[data-drch]'), cr = e.target.closest('#dr-crop');
    if (ch) { drSnap(); DR.drag = { k: 'crop', d: ch.dataset.drch, c0: { ...(drP().crop || { t: 0, r: 0, b: 0, l: 0 }) }, x0: e.clientX, y0: e.clientY, r: $('#dr-pic').getBoundingClientRect() }; e.preventDefault(); } }
  function drMove(e) { const D = DR.drag; if (!D) return; if (D.k === 'split') { const r = $('#dr-pic').getBoundingClientRect(); DR.split = Math.max(2, Math.min(98, (e.clientX - r.left) / r.width * 100)); const b = $('#dr-pic .before'), s = $('#dr-split'); if (b) b.style.clipPath = `inset(0 ${100 - DR.split}% 0 0)`; if (s) s.style.left = DR.split + '%'; return; }
    if (D.k === 'crop') { const p = drP(), dx = (e.clientX - D.x0) / D.r.width * 100, dy = (e.clientY - D.y0) / D.r.height * 100, c = { ...D.c0 }; if (D.d.includes('w')) c.l = Math.max(0, Math.min(80 - c.r, D.c0.l + dx)); if (D.d.includes('e')) c.r = Math.max(0, Math.min(80 - c.l, D.c0.r - dx)); if (D.d.includes('n')) c.t = Math.max(0, Math.min(80 - c.b, D.c0.t + dy)); if (D.d.includes('s')) c.b = Math.max(0, Math.min(80 - c.t, D.c0.b - dy));
      p.crop = c; DR.ar = 'free'; const cr = $('#dr-crop'); if (cr) cr.style.cssText = `--t:${c.t}%;--r:${c.r}%;--b:${c.b}%;--l:${c.l}%`; } }
  function drUp() { if (DR.drag?.k === 'crop') { DR.drag = null; drEdit(); drInsp(); return; } DR.drag = null; }
  function renderDarkroom() { $('#w-darkroom').addEventListener('luma-phone', e => { DR.left = !e.detail; DR.pinsp = false; setTimeout(drAll, 120); }); $('#dr-top').innerHTML = `<img src="${A}photo-editor.svg" alt=""><b>Focus</b><span class="sumeta">1,284 photos · Luma SSD</span><span class="sutopr" id="dr-topr"></span>`;
    const w = $('#dr-work'); w.addEventListener('pointerdown', drPtr); addEventListener('pointermove', drMove); addEventListener('pointerup', drUp);
    new ResizeObserver(() => { if (DR.view === 'edit') drFitPic(); }).observe(w); drAll(); }
  document.addEventListener('input', e => { const t = e.target; if (!t.closest?.('#w-darkroom')) return; const p = drP();
    if (t.dataset.dra) { if (!drSnap.live) { drSnap(); drSnap.live = true; setTimeout(() => { drSnap.live = false; }, 600); } p.a[t.dataset.dra] = +t.value; p.look = 'Custom'; t.nextElementSibling.textContent = (+t.value > 0 && +t.min < 0 ? '+' : '') + t.value; t.closest('.drsl').classList.toggle('set', +t.value !== DRA0[t.dataset.dra]); drRepaint(); return; }
    if (t.dataset.drm) { p.masks[DR.mask][t.dataset.drm] = +t.value; t.nextElementSibling.textContent = (+t.value > 0 ? '+' : '') + t.value; drRepaint(); return; }
    if (t.matches('[data-drrot]')) { p.rot = +t.value; t.nextElementSibling.textContent = t.value + '°'; drRepaint(); } });
  document.addEventListener('dblclick', e => { const sl = e.target.closest?.('#w-darkroom .drsl input[data-dra]'); if (sl) { const p = drP(); p.a[sl.dataset.dra] = DRA0[sl.dataset.dra]; drInsp(); drRepaint(); } });   // double-click a slider to reset it
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'darkroom' || e.target.closest?.('input:not([type=range]), textarea')) return; const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
    if (mod && k === 'z') { e.preventDefault(); if (drUndo()) drToast('Undone', { icon: 'undo' }); return; } if (mod && e.shiftKey && k === 'e') { e.preventDefault(); $('#dr-topr [data-drexport]:not([disabled])')?.click(); return; } if (mod) return;
    if (e.key === '\\') { DR.focus = !DR.focus; drLeft(); drInsp(); if (DR.view === 'edit') drFitPic(); return; }
    const n = DR.photos.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); DR.cur = (DR.cur + (e.key === 'ArrowRight' ? 1 : n - 1)) % n; DR.sel = [DR.cur]; DR.mask = null; drAll(); return; }
    if (DR.view === 'library') { if (e.key === 'Enter' || k === 'e') { DR.view = 'edit'; DR.left = false; drAll(); } else if (k === 'i') { DR.info = !DR.info; drInfo(); drTop(); } else if (k === 'p') drFlag(1); else if (k === 'x') drFlag(-1); else if (k === 'u') { DR.sel.forEach(i => { DR.photos[i].flag = 0; }); drGrid(); drBar(); } else if (/^[0-5]$/.test(k)) drStar(+k); return; }
    if (k === 'g' || e.key === 'Escape') { DR.view = 'library'; DR.left = true; DR.compare = false; drAll(); return; } if (k === 'y') { DR.compare = !DR.compare; drEdit(); drBar(); return; }
    const tools = { a: 'adjust', r: 'crop', l: 'looks', m: 'mask', h: 'heal' }; if (tools[k]) { DR.tool = tools[k]; drEdit(); drInsp(); drBar(); } });

  /* One slider everywhere: keep the lit part of the track in step with the value (two-sided ranges light from zero) */
  const rngPaint = el => { const lo = +el.min || 0, hi = +el.max || 100, v = +el.value, P = x => (x - lo) / (hi - lo) * 100, z = lo < 0 && hi > 0 ? P(0) : 0; el.style.setProperty('--a', Math.min(z, P(v)) + '%'); el.style.setProperty('--b', Math.max(z, P(v)) + '%'); };
  document.addEventListener('input', e => { if (e.target.matches?.('input[type="range"]:not(.rng)')) rngPaint(e.target); }, true);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.matches('input[type="range"]:not(.rng)')) rngPaint(n); n.querySelectorAll?.('input[type="range"]:not(.rng)').forEach(rngPaint); }))).observe(document.body, { childList: true, subtree: true });
  /* ══ Reel ════════════════════════════════════════════════════════════════════
     Video, from the same family as Session and Stage. The player on top, its transport attached to it; the story
     underneath. The main storyline is magnetic: clips sit end to end and close gaps when you move or delete one.
     Titles and cutaways ride above it, sound below. The browser (media, titles, transitions, effects, LUTs, sound)
     docks on the left when you open it; the inspector docks full height on the right when something is selected,
     and the player and timeline make room. Hover the timeline to skim. */
  const RLFPS = 24;
  const RLMEDIA = [['Studio morning', 'life-hero-studio', 6], ['Writing', 'life-hero-writing', 5], ['Terrace', 'life-sync-terrace', 7], ['The loft', 'life-professionals-loft', 6], ['Mission St', 'life-ari-street', 5],
    ['Work suite', 'life-work-suite', 8], ['Evening', 'life-footer', 7], ['Home office', 'life-hero-home', 4], ['Focus', 'life-suite-bg-darkroom', 5], ['Stage', 'life-suite-bg-stage', 5], ['Sessions', 'life-suite-bg-sessions', 6], ['Portrait', 'life-testimonial', 4]];
  const RLFX = { blur: ['Gaussian blur', 'Softens the whole frame'], vignette: ['Vignette', 'Darkens the edges'], grain: ['Film grain', 'Fine, moving grain'], glow: ['Glow', 'Blooms the highlights'], sharpen: ['Sharpen', 'Crisper edges'], bw: ['Black and white', 'Luminance only'], letterbox: ['Letterbox', '2.39:1 bars'], stabilize: ['Stabilise', 'Smooths handheld shake'] };
  const RLLUT = { none: ['None', 'none', ''], warm: ['Warm film', 'sepia(.18) saturate(1.1) contrast(1.05)', 'rgb(255,170,90)'], teal: ['Teal and orange', 'saturate(1.2) contrast(1.08)', 'rgb(0,150,170)'], bleach: ['Bleach bypass', 'saturate(.55) contrast(1.25)', ''], night: ['Night', 'brightness(.8) saturate(.8) hue-rotate(-10deg)', 'rgb(40,80,200)'], soft: ['Soft pastel', 'contrast(.88) brightness(1.06) saturate(.85)', 'rgb(255,220,230)'] };
  const RLCURVE = { linear: ['Linear', 0, 0, 'M0 60L100 0'], soft: ['Soft S', 12, 0, 'M0 60C30 60 30 32 50 30S70 0 100 0'], strong: ['Strong S', 26, 0, 'M0 60C38 62 34 30 50 30S62 -2 100 0'], lift: ['Lifted blacks', -8, 6, 'M0 50C30 42 60 14 100 0'], fade: ['Matte', -14, 8, 'M0 46C30 40 60 16 100 6'] };
  const RLBLEND = ['Normal', 'Screen', 'Multiply', 'Overlay', 'Soft light', 'Lighten', 'Darken'];
  let RLID = 1;
  const rlClip = (n, img, d, x = {}) => ({ id: 'r' + RLID++, n, img: PH + img + '.webp', d, adj: { exp: 0, con: 0, hi: 0, sh: 0, wh: 0, bl: 0, temp: 0, tint: 0, sat: 0, vib: 0 }, wheel: { sh: [0, 0], mid: [0, 0], hi: [0, 0] }, curve: 'linear', lut: 'none', lutAmt: 100,
    scale: 100, px: 0, py: 0, rot: 0, ax: 50, ay: 50, crop: { l: 0, r: 0, t: 0, b: 0 }, op: 100, blend: 'Normal', speed: 100, stab: false, vol: 0, pan: 0, eq: 'Flat', nr: false, fx: [], ...x });
  const RL = { t: 12.3, playing: false, sel: null, tool: 'select', lib: false, libTab: 'media', skim: null, zoom: 1, snap: true, focus: false, exp: 'share', itab: 'video', loop: false,
    main: RLMEDIA.slice(0, 7).map(([n, f, d]) => rlClip(n, f, d)),
    over: [rlClip('Luma 1.0', '', 4, { kind: 'title', s: 1, text: 'Luma 1.0', sub: 'A better computer', style: 'big' }), rlClip('Home office', 'life-hero-home', 4, { kind: 'video', s: 18.5, scale: 42, px: 26, py: -24, blend: 'Normal' }), rlClip('October 14', '', 5, { kind: 'title', s: 37, text: 'October 14', sub: 'simplyluma.com', style: 'lower' })],
    audio: [[rlClip('Late light', '', 44, { kind: 'music', s: 0, vol: -8, h: 150 })], [rlClip('Narration, take 3', '', 11, { kind: 'voice', s: 4, vol: -3, h: 190, nr: true }), rlClip('Narration, take 3 (b)', '', 11, { kind: 'voice', s: 23, vol: -3, h: 190 })]],
    trans: {}, marks: [5.2, 20.4] };
  RL.trans[RL.main[1].id] = 'dissolve'; RL.trans[RL.main[4].id] = 'dissolve';
  Object.assign(RL.main[2], { lut: 'warm', lutAmt: 70 }); RL.main[2].wheel.hi = [.25, -.1]; RL.main[2].adj.sh = 14; RL.main[2].fx = [{ k: 'vignette', amt: 40, on: true }];
  const rlDur = () => RL.main.reduce((s, c) => s + c.d, 0);
  const rlStarts = () => { let t = 0; return RL.main.map(c => { const s = t; t += c.d; return s; }); };
  const rlAll2 = () => [...RL.main, ...RL.over, ...RL.audio.flat()];
  const rlG = id => rlAll2().find(c => c.id === id);
  const rlTC = t => { const f = Math.round(t * RLFPS), s = Math.floor(f / RLFPS); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}<i>:${String(f % RLFPS).padStart(2, '0')}</i>`; };
  const rlPPS = () => { const tl = $('#rl-lanes'); return tl ? Math.max(8, (tl.clientWidth - 24) / Math.max(rlDur(), 10) * RL.zoom) : 20; };
  const rlHue = ([x, y]) => (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, rlR = ([x, y]) => Math.min(1, Math.hypot(x, y));

  /* ── The picture: every control the inspector has shows up here ── */
  function rlFilter(c) { const a = c.adj, cv = RLCURVE[c.curve], fx = k => c.fx.find(f => f.k === k && f.on);
    let f = `brightness(${1 + a.exp / 100 * .5 + a.sh / 100 * .1 + a.wh / 100 * .06 + cv[2] / 100}) contrast(${1 + a.con / 100 * .5 - a.sh / 100 * .12 + a.hi / 100 * .08 - a.bl / 100 * .1 + cv[1] / 100}) saturate(${Math.max(0, 1 + a.sat / 100 + a.vib / 200)})`;
    if (c.lut !== 'none') f += ' ' + RLLUT[c.lut][1].replace(/\(([\d.]+)/g, (m, n) => `(${1 + (+n - 1) * c.lutAmt / 100}`).replace(/sepia\([\d.]+\)/, s => `sepia(${(parseFloat(s.slice(6)) * c.lutAmt / 100).toFixed(2)})`);
    if (fx('bw')) f += ' grayscale(1)'; if (fx('blur')) f += ` blur(${fx('blur').amt / 12}px)`; if (fx('sharpen')) f += ' contrast(1.08)'; if (fx('glow')) f += ` brightness(${1 + fx('glow').amt / 400})`;
    return f; }
  function rlOverlays(c) { let h = ''; const a = c.adj, ov = (bg, op, mode = 'soft-light') => `<i class="rlov" style="background:${bg};opacity:${op.toFixed(3)};mix-blend-mode:${mode}"></i>`;
    if (a.temp) h += ov(a.temp > 0 ? 'rgb(255,150,40)' : 'rgb(40,120,255)', Math.abs(a.temp) / 100 * .32); if (a.tint) h += ov(a.tint > 0 ? 'rgb(255,40,200)' : 'rgb(40,220,90)', Math.abs(a.tint) / 100 * .22);
    const W = c.wheel; if (rlR(W.sh)) h += ov(`hsl(${rlHue(W.sh)} 90% 45%)`, rlR(W.sh) * .35, 'multiply'); if (rlR(W.mid)) h += ov(`hsl(${rlHue(W.mid)} 90% 50%)`, rlR(W.mid) * .4); if (rlR(W.hi)) h += ov(`hsl(${rlHue(W.hi)} 90% 60%)`, rlR(W.hi) * .3, 'screen');
    if (c.lut !== 'none' && RLLUT[c.lut][2]) h += ov(RLLUT[c.lut][2], .18 * c.lutAmt / 100);
    const fx = k => c.fx.find(f => f.k === k && f.on);
    if (fx('vignette')) h += `<i class="rlov" style="background:radial-gradient(ellipse at center, transparent 45%, #000 100%);opacity:${fx('vignette').amt / 100 * .9}"></i>`;
    if (fx('grain')) h += `<i class="rlov rlgrain" style="opacity:${fx('grain').amt / 100 * .5}"></i>`;
    if (fx('glow')) h += `<i class="rlov" style="background:radial-gradient(ellipse at 50% 40%, rgba(255,240,220,.6), transparent 60%);opacity:${fx('glow').amt / 100 * .5};mix-blend-mode:screen"></i>`;
    if (fx('letterbox')) h += '<i class="rlov rlbox"></i>';
    return h; }
  /* Layers are kept, not rebuilt: one element per clip, updated in place, so nothing flashes while you play, skim or edit */
  const rlImgCache = {}; const rlWarm = src => { if (!rlImgCache[src]) { const im = new Image(); im.decoding = 'async'; im.src = src; im.decode?.().catch(() => {}); rlImgCache[src] = im; } };
  function rlLayerSpec(c, local, op = 1, over) { const k = 1 + .045 * Math.min(1, local / c.d), cr = c.crop, ken = c.fx.some(f => f.k === 'stabilize' && f.on) ? 1 : k;
    return { key: c.id, img: c.img, over: !!over, op: op * c.op / 100, blend: c.blend.toLowerCase().replace(' ', '-'),
      wrapT: over ? `translate(${c.px}%, ${c.py}%) scale(${c.scale / 100}) rotate(${c.rot}deg)` : '', origin: `${c.ax}% ${c.ay}%`,
      filter: rlFilter(c), clip: `inset(${cr.t}% ${cr.r}% ${cr.b}% ${cr.l}%)`, imgT: over ? '' : `translate(${c.px}%, ${c.py}%) rotate(${c.rot}deg) scale(${ken * c.scale / 100})`, ov: rlOverlays(c) }; }
  function rlApply(pic, specs, extraHTML) { const have = new Map([...pic.querySelectorAll(':scope > .rllayer')].map(e => [e.dataset.k, e])), keep = new Set();
    specs.forEach((sp, n) => { let el = have.get(sp.key); if (!el) { el = document.createElement('div'); el.className = 'rllayer'; el.dataset.k = sp.key; el.innerHTML = `<img src="${sp.img}" alt="" decoding="async"><span class="rlovs"></span>`; }
      keep.add(sp.key); el.classList.toggle('over', sp.over); el.style.opacity = sp.op; el.style.mixBlendMode = sp.blend; el.style.transform = sp.wrapT; el.style.transformOrigin = sp.origin; el.style.zIndex = n;
      const im = el.firstElementChild; if (im.getAttribute('src') !== sp.img) im.src = sp.img; im.style.filter = sp.filter; im.style.clipPath = sp.clip; im.style.transform = sp.imgT; im.style.transformOrigin = sp.origin;
      const ov = el.lastElementChild; if (ov.dataset.sig !== sp.ov) { ov.innerHTML = sp.ov; ov.dataset.sig = sp.ov; }
      if (el.parentNode !== pic) pic.appendChild(el); });
    have.forEach((e, k) => { if (!keep.has(k)) e.remove(); });
    let x = pic.querySelector(':scope > .rlextra'); if (!x) { x = document.createElement('div'); x.className = 'rlextra'; pic.appendChild(x); } if (x.dataset.sig !== extraHTML) { x.innerHTML = extraHTML; x.dataset.sig = extraHTML; } x.style.zIndex = 50; }
  function rlAt(t) { const st = rlStarts(); let i = st.findIndex((s, k) => t >= s && t < s + RL.main[k].d); if (i < 0) i = RL.main.length - 1;
    const over = RL.over.filter(c => t >= c.s && t < c.s + c.d); return { i, c: RL.main[i], local: t - st[i], video: over.find(c => c.kind === 'video'), title: over.find(c => c.kind === 'title'), st }; }
  function rlPaint() { const pic = $('#rl-pic'); if (!pic) return; const t = RL.skim ?? RL.t, A = rlAt(t), specs = [rlLayerSpec(A.c, A.local)];
    const next = RL.main[A.i + 1], seam = A.st[A.i] + A.c.d, tr = RL.trans[A.c.id]; let slide = '';
    if (next && tr && seam - t < .45) { const p = 1 - (seam - t) / .45; if (tr === 'black') specs[0].op *= 1 - p; else { const n = rlLayerSpec(next, 0, tr === 'slide' ? 1 : p); if (tr === 'slide') n.wrapT = `translateX(${(1 - p) * 100}%)`; specs.push(n); } }
    if (A.video) specs.push(rlLayerSpec(A.video, t - A.video.s, 1, true));
    let extra = ''; if (A.title) { const T = A.title, k = Math.min(1, (t - T.s) / .5, (T.s + T.d - t) / .5); extra += `<div class="rltitle ${T.style}" style="opacity:${k.toFixed(2)}"><b>${esc(T.text)}</b><span>${esc(T.sub || '')}</span></div>`; }
    if (RL.skim != null) extra += '<em class="rlskimtag">Skimming</em>';
    rlApply(pic, specs, extra); const tc = $('#rl-tc'); if (tc) tc.innerHTML = rlTC(t); }
  function rlFit() { const st = $('#rl-stage'), pl = $('#rl-player'); if (!st || !pl) return; if (rlNarrow()) { const w = st.clientWidth - 32; pl.style.width = w + 'px'; $('#rl-pic').style.height = w * 9 / 16 + 'px'; return; } const W = st.clientWidth - 48, H = st.clientHeight - 32 - 46, w = Math.max(200, Math.min(W, H * 16 / 9));
    pl.style.width = w + 'px'; $('#rl-pic').style.height = w * 9 / 16 + 'px'; }

  /* ── The story ── */
  function rlTL() { const lanes = $('#rl-lanes'); if (!lanes || lanes.clientWidth < 100) return; const pps = rlPPS(), dur = rlDur(), st = rlStarts(), W = Math.max(dur * pps + 40, lanes.clientWidth);
    const clipEl = (c, x, w, cls, inner) => `<div class="rlclip ${cls}${RL.sel === c.id ? ' on' : ''}" data-rlclip="${c.id}" style="left:${x}px;width:${Math.max(6, w - 2)}px;--h:${c.h ?? 250}">${inner}${c.fx?.length || (c.lut && c.lut !== 'none') ? `<i class="rlfxdot" title="Effects applied">${ic('wand-sparkles')}</i>` : ''}<i class="rltrim" data-rltrim="${c.id}"></i></div>`;
    const every = pps > 40 ? 1 : pps > 18 ? 5 : 10;
    const ruler = `<div class="rlruler" style="width:${W}px">${Array.from({ length: Math.floor(dur / every) + 1 }, (_, i) => `<em style="left:${i * every * pps}px">0:${String(i * every % 60).padStart(2, '0')}</em>`).join('')}${RL.marks.map(m => `<i class="rlmark" style="left:${m * pps}px" title="Marker"></i>`).join('')}</div>`;
    const over = `<div class="rllane over">${RL.over.map(c => clipEl(c, c.s * pps, c.d * pps, c.kind, c.kind === 'title' ? `<span class="rltl-t">${ic('type')}${esc(c.text)}</span>` : `<i class="rlstrip" style="background-image:url('${c.img}')"></i><b>${esc(c.n)}</b>`)).join('')}${RL.over.filter(c => c.kind === 'video').map(c => `<i class="rllink" style="left:${c.s * pps + 1}px"></i>`).join('')}</div>`;
    const main = `<div class="rllane main">${RL.main.map((c, i) => clipEl(c, st[i] * pps, c.d * pps, 'video', `<i class="rlstrip" style="background-image:url('${c.img}')"></i><b>${esc(c.n)}</b>`) + (RL.trans[c.id] && RL.main[i + 1] ? `<button class="rltrans" type="button" data-rltrans="${c.id}" style="left:${(st[i] + c.d) * pps - 10}px" title="${{ dissolve: 'Cross dissolve', black: 'Fade through black', slide: 'Slide' }[RL.trans[c.id]]} · click to remove">${ic('blend')}</button>` : '')).join('')}</div>`;
    const aud = RL.audio.map(lane => `<div class="rllane aud">${lane.map(c => clipEl(c, c.s * pps, c.d * pps, 'audio ' + c.kind, `<b>${c.kind === 'music' ? ic('music') : ic('mic')}${esc(c.n)}</b>${seWave({ id: c.id }, Math.max(8, c.d * pps - 8), 22)}`)).join('')}</div>`).join('');
    lanes.innerHTML = `<div class="rlinner" style="width:${W}px">${ruler}${over}${main}${aud}<i class="rlhead" id="rl-head" style="left:${RL.t * pps}px"></i><i class="rlskim" id="rl-skim" hidden></i></div>`; }
  const rlHead = () => { const h = $('#rl-head'), p = rlPPS(); if (h) h.style.left = RL.t * p + 'px'; const sk = $('#rl-skim'); if (sk) { sk.hidden = RL.skim == null; if (RL.skim != null) sk.style.left = RL.skim * p + 'px'; } };
  /* The timeline's header: what this is, then the editing tools, then zoom */
  function rlTLH() { const t = (k, icn, label, key) => `<button class="ib sm${RL.tool === k ? ' on' : ''}" type="button" data-rltool="${k}" title="${label} · ${key}">${ic(icn)}</button>`;
    $('#rl-tlh').innerHTML = `<span class="rltlinfo" id="rl-tlinfo"><span>${rlTC(rlDur()).replace(/<i>.*<\/i>/, '')} · 4K · 24p</span></span>
      <span class="rltools">${t('select', 'mouse-pointer-2', 'Select', 'A')}${t('blade', 'scissors', 'Blade', 'B')}<i class="rlsep"></i><button class="ib sm${RL.snap ? ' on' : ''}" type="button" data-rlsnap title="Snapping · N">${ic('magnet')}</button></span>
      <span class="rltlr"><button class="ib sm" type="button" data-rlzoom="out" title="Zoom out">${ic('zoom-out')}</button><button class="ib sm" type="button" data-rlzoom="in" title="Zoom in">${ic('zoom-in')}</button></span>`; }
  /* The player's own transport, attached under the picture */
  function rlCtl() { $('#rl-ctl').innerHTML = `<span class="selcd rllcd"><span><b id="rl-tc">${rlTC(RL.skim ?? RL.t)}</b><small>Timecode</small></span><span><b>${rlTC(rlDur()).replace(/<i>.*<\/i>/, '')}</b><small>Length</small></span></span>
      <span class="rltransport"><button class="ib" type="button" data-rlstart title="Start · Home">${ic('skip-back')}</button><button class="ib" type="button" data-rlstep="-1" title="Back one frame · ←">${ic('step-back')}</button><button class="seplay${RL.playing ? ' on' : ''}" type="button" data-rlplay title="Play · Space">${ic(RL.playing ? 'pause' : 'play')}</button><button class="ib" type="button" data-rlstep="1" title="Forward one frame · →">${ic('step-forward')}</button><button class="ib" type="button" data-rlend title="End · End">${ic('skip-forward')}</button></span>
      <span class="rlctlr"><button class="ib${RL.loop ? ' on' : ''}" type="button" data-rlloop title="Loop">${ic('repeat')}</button><button class="ib" type="button" data-rltodo="Plays full screen" title="Full screen">${ic('maximize-2')}</button></span>`; }
  /* ── The browser: everything you can add ── */
  function rlLib() { rlLib0(); if (rlNarrow()) rlBarPhone(); }
  function rlLib0() { const el = $('#rl-lib'), w = $('#w-reel'), open = RL.lib && !RL.focus; w.classList.toggle('libopen', open); $('#rl-libb')?.classList.toggle('on', open); if (!open) return; const T = RL.libTab, c = RL.sel && rlG(RL.sel), vid = c && !c.kind || c?.kind === 'video';
    const note = T === 'fx' || T === 'lut' ? `<p class="rlnote">${vid ? `Applies to ${esc(c.n)}` : 'Select a clip to apply to it'}</p>` : T === 'trans' ? '<p class="rlnote">Goes on the cut nearest the playhead</p>' : '';
    const body = T === 'media' ? `<div class="rlmedia">${RLMEDIA.map(([n, f, d], i) => `<button type="button" data-rladd="${i}" title="Add to the end of the story"><span style="background-image:url('${PH}${f}.webp')"><em>0:${String(d).padStart(2, '0')}</em></span><b>${n}</b></button>`).join('')}</div>`
      : T === 'titles' ? `<div class="rltitles">${[['big', 'Centred', 'Luma 1.0'], ['lower', 'Lower third', 'Priya Raman'], ['end', 'End card', 'Thank you']].map(([k, n, x]) => `<button type="button" data-rladdtitle="${k}"><span class="rltprev ${k}"><b>${x}</b></span><b>${n}</b></button>`).join('')}</div>`
      : T === 'trans' ? `<div class="rlfxgrid">${[['dissolve', 'Cross dissolve'], ['black', 'Fade through black'], ['slide', 'Slide']].map(([k, n]) => `<button type="button" data-rladdtrans="${k}"><span class="rlfxp tr-${k}"><i style="background-image:url('${PH}life-hero-studio.webp')"></i><i style="background-image:url('${PH}life-sync-terrace.webp')"></i></span><b>${n}</b></button>`).join('')}</div>`
      : T === 'fx' ? `<div class="rlfxgrid">${Object.entries(RLFX).map(([k, [n]]) => `<button type="button" data-rladdfx="${k}"${vid ? '' : ' disabled'}><span class="rlfxp fx-${k}"><i style="background-image:url('${PH}life-hero-writing.webp')"></i></span><b>${n}</b></button>`).join('')}</div>`
      : T === 'lut' ? `<div class="rlfxgrid">${Object.entries(RLLUT).filter(([k]) => k !== 'none').map(([k, [n, f, tint]]) => `<button type="button" data-rllut="${k}"${vid ? '' : ' disabled'} class="${c?.lut === k ? 'on' : ''}"><span class="rlfxp"><i style="background-image:url('${PH}life-hero-writing.webp');filter:${f}"></i>${tint ? `<i class="rlfxt" style="background:${tint}"></i>` : ''}</span><b>${n}</b></button>`).join('')}</div><button class="bt sm fill rlimport" type="button" data-rltodo="Pick a .cube file">${ic('plus')}Import a LUT (.cube)…</button>`
      : `<div class="rlgrid1">${[['Late light', 'From Session · 0:44'], ['Low tide', 'Music · 2:10'], ['Room tone', 'Sound · loop'], ['Whoosh', 'Effect · 0:01']].map(([n, d]) => `<button class="selitem" type="button" data-rltodo="Added ${n} under the story"><span><b>${n}</b><small>${d}</small></span><i class="sepv">${ic('play')}</i></button>`).join('')}</div>`;
    el.innerHTML = `<div class="vwih"><b>Browser</b><button class="ib" type="button" data-rllib title="Close · Y">${ic('x')}</button></div>
      <div class="rltabs">${[['media', 'image', 'Media'], ['titles', 'type', 'Titles'], ['trans', 'blend', 'Transitions'], ['fx', 'wand-sparkles', 'Effects'], ['lut', 'palette', 'LUTs'], ['audio', 'music', 'Sound']].map(([k, i, n]) => `<button type="button" class="${T === k ? 'on' : ''}" data-rltab="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div>${note}<div class="scr">${body}</div>`; }

  /* ── The inspector: full height, and as deep as a real editor ── */
  function rlWheel(key, label, v) { const x = 50 + v[0] * 42, y = 50 + v[1] * 42;
    return `<div class="rlwheel"><div class="rlwh" data-rlwheel="${key}"><i class="rlwpuck" style="left:${x}%;top:${y}%"></i></div><span>${label}</span><button type="button" class="rlwreset" data-rlwreset="${key}" title="Reset"${rlR(v) ? '' : ' hidden'}>Reset</button></div>`; }
  function rlInsp() { rlInsp0(); if (rlNarrow()) rlBarPhone(); }
  function rlInsp0() { const el = $('#rl-insp'), w = $('#w-reel'), c = RL.sel && rlG(RL.sel), open = !!c && !RL.focus; w.classList.toggle('inspopen', open); if (!open) return;
    const sec = (t, b, add = '') => `<section class="susec"><header><b>${t}</b>${add}</header>${b}</section>`, sl = (k, label, v, min = -100, max = 100, unit = '') => `<label class="drsl${v ? ' set' : ''}"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${v}" data-rlset="${k}"><em>${v > 0 && min < 0 ? '+' : ''}${v}${unit}</em></label>`;
    const fld = (k, l, v, u = '') => `<label class="sufld"><span>${l}</span><input data-rlf="${k}" value="${v}" inputmode="decimal">${u ? `<em>${u}</em>` : ''}</label>`;
    const audio = c.kind === 'music' || c.kind === 'voice', title = c.kind === 'title', icn = title ? 'type' : audio ? (c.kind === 'music' ? 'music' : 'mic') : 'film';
    const tabs = title ? [['text', 'Text'], ['video', 'Video']] : audio ? [['audio', 'Audio']] : [['video', 'Video'], ['colour', 'Color'], ['audio', 'Audio'], ['fx', 'Effects']];
    if (!tabs.some(([k]) => k === RL.itab)) RL.itab = tabs[0][0]; const T = RL.itab; let body = '';
    if (T === 'text') body = sec('Text', `<label class="rltext"><textarea data-rltext rows="2" spellcheck="false">${esc(c.text)}</textarea></label><label class="rltext sm"><input data-rlsub value="${esc(c.sub || '')}" placeholder="Second line"></label>`) + sec('Style', seg([['big', 'Centred'], ['lower', 'Lower third'], ['end', 'End card']], c.style, 'data-rlstyle', 'Style')) + sec('Timing', `<div class="sugrid2">${fld('d', 'Length', c.d, 's')}${fld('s', 'Starts', c.s.toFixed(1), 's')}</div>`);
    else if (T === 'video') body = sec('Transform', `<div class="sugrid2">${fld('px', 'X', c.px, '%')}${fld('py', 'Y', c.py, '%')}${fld('scale', 'Scale', c.scale, '%')}${fld('rot', '↻', c.rot, '°')}${fld('ax', 'Anchor X', c.ax, '%')}${fld('ay', 'Anchor Y', c.ay, '%')}</div>`, '<button class="rlreset" type="button" data-rlresetx title="Reset transform">Reset</button>')
      + sec('Crop', `<div class="sugrid2">${fld('crop.l', 'Left', c.crop.l, '%')}${fld('crop.r', 'Right', c.crop.r, '%')}${fld('crop.t', 'Top', c.crop.t, '%')}${fld('crop.b', 'Bottom', c.crop.b, '%')}</div>`)
      + sec('Compositing', `<button class="suselect" type="button" data-rlblend>${c.blend}${ic('chevron-down')}</button><div class="drsls">${sl('op', 'Opacity', c.op, 0, 100, '%')}</div>`)
      + (title ? '' : sec('Speed', `${seg([[25, '¼×'], [50, '½×'], [100, '1×'], [200, '2×'], [400, '4×']], c.speed, 'data-rlspeed', 'Speed')}<button class="rlcheck${c.stab ? ' on' : ''}" type="button" data-rlstab><i>${ic('check')}</i>Stabilise</button>`));
    else if (T === 'colour') body = sec('Color wheels', `<div class="rlwheels">${rlWheel('sh', 'Shadows', c.wheel.sh)}${rlWheel('mid', 'Midtones', c.wheel.mid)}${rlWheel('hi', 'Highlights', c.wheel.hi)}</div>`)
      + sec('Light', `<div class="drsls">${sl('exp', 'Exposure', c.adj.exp)}${sl('con', 'Contrast', c.adj.con)}${sl('hi', 'Highlights', c.adj.hi)}${sl('sh', 'Shadows', c.adj.sh)}${sl('wh', 'Whites', c.adj.wh)}${sl('bl', 'Blacks', c.adj.bl)}</div>`)
      + sec('Color', `<div class="drsls">${sl('temp', 'Temperature', c.adj.temp)}${sl('tint', 'Tint', c.adj.tint)}${sl('sat', 'Saturation', c.adj.sat)}${sl('vib', 'Vibrance', c.adj.vib)}</div>`)
      + sec('Curves', `<div class="rlcurves">${Object.entries(RLCURVE).map(([k, [n, , , d]]) => `<button type="button" class="${c.curve === k ? 'on' : ''}" data-rlcurve="${k}" title="${n}"><svg viewBox="-4 -4 108 68"><path d="${d}"/></svg><span>${n}</span></button>`).join('')}</div>`)
      + sec('LUT', `<button class="suselect" type="button" data-rllutpick>${RLLUT[c.lut][0]}${ic('chevron-down')}</button>${c.lut !== 'none' ? `<div class="drsls">${sl('lutAmt', 'Strength', c.lutAmt, 0, 100, '%')}</div>` : ''}`);
    else if (T === 'audio') body = sec('Level', `<div class="drsls">${sl('vol', 'Volume', c.vol, -60, 6, ' dB')}${sl('pan', 'Pan', c.pan, -50, 50)}${audio ? `${sl('fin', 'Fade in', c.fin || 0, 0, 30, '')}${sl('fout', 'Fade out', c.fout || 0, 0, 30, '')}` : ''}</div>`)
      + sec('Clean up', `<button class="rlcheck${c.nr ? ' on' : ''}" type="button" data-rlnr><i>${ic('check')}</i>Remove background noise</button><button class="rlcheck${c.hum ? ' on' : ''}" type="button" data-rlhum><i>${ic('check')}</i>Remove hum</button>`)
      + sec('Equaliser', seg(['Flat', 'Voice', 'Warm', 'Bright'].map(x => [x, x]), c.eq, 'data-rleq', 'Equaliser'));
    else body = sec('Applied', c.fx.length ? `<div class="rlfxlist">${c.fx.map((f, i) => `<div class="rlfxrow"><button type="button" class="sefxon${f.on ? ' on' : ''}" data-rlfxon="${i}" title="${f.on ? 'Turn off' : 'Turn on'}"></button><div><b>${RLFX[f.k][0]}</b>${['blur', 'vignette', 'grain', 'glow'].includes(f.k) ? `<label class="drsl set"><span>Amount</span><input type="range" min="0" max="100" value="${f.amt}" data-rlfxamt="${i}"><em>${f.amt}</em></label>` : `<small>${RLFX[f.k][1]}</small>`}</div><button class="ib sm" type="button" data-rlfxdel="${i}" title="Remove">${ic('x')}</button></div>`).join('')}</div>` : '<p class="rlnote">No effects yet.</p>', `<button class="ib sm" type="button" data-rlopenfx title="Add an effect">${ic('plus')}</button>`);
    el.innerHTML = `<header class="suinsph">${ic(icn)}<input class="suname" data-rlname value="${esc(c.n)}" spellcheck="false"><span class="suem">${c.d.toFixed(1)} s</span><button class="ib" type="button" data-rlclose title="Close">${ic('x')}</button></header>
      ${tabs.length > 1 ? seg(tabs, T, 'data-rlitab', 'Inspector', 'sutabs') : ''}<div class="scr">${body}
      <section class="susec"><div class="surow2"><button class="bt sm fill" type="button" data-rldup>Duplicate</button><button class="bt sm fill" type="button" data-rldel>Delete</button></div></section></div>`; requestAnimationFrame(segs); }
  /* Reel on a phone, the way phone video editors work: the picture on top at full width, its transport under it, the
     timeline filling the middle, and one bar. With nothing picked: Add (the browser's media, titles, transitions,
     effects, LUTs and sound grow the bar), Split at the playhead, Snap, zoom. A picked clip: Adjust (its inspector
     grows the bar), Split, Duplicate, Delete, ✕. Export sits top right. */
  const rlNarrow = () => { const w = $('#w-reel'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };
  function rlBarPhone() { const w = $('#w-reel'); w.classList.add('rlph'); let bar = $('#rl-phbar'); if (!bar) { $('#rl-work').insertAdjacentHTML('beforeend', '<div class="fbar rlphbar phnofit" id="rl-phbar"></div>'); bar = $('#rl-phbar'); }
    if (!$('#rl-ptop')) $('#rl-work').insertAdjacentHTML('beforeend', `<div class="rlptop" id="rl-ptop"><button class="flo rlback2" type="button" data-rltodo="Your projects are in Files, under Movies">${ic('chevron-left')}<span>Launch film</span></button><div class="flo rltopr2"><button class="ib" type="button" data-share aria-label="Share">${ic('share-2')}</button><button class="bt key" type="button" data-rlexport>${ic('share')}Export</button></div></div>`);
    const X = RL.px || '', c = RL.sel && rlG(RL.sel), ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}<span>${label}</span></button>`;
    const panel = c && X === 'adj' ? `<div class="fexp rlpan">${$('#rl-insp').innerHTML}</div>` : !c && RL.lib ? `<div class="fexp rlpan">${$('#rl-lib').innerHTML}</div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, panel + (c ? `<div class="rlr">${ib('data-rlpx="adj"', 'sliders-horizontal', 'Adjust', X === 'adj')}${ib('data-rlsplitnow', 'scissors', 'Split')}${ib('data-rldup', 'copy', 'Duplicate')}${ib('data-rldel', 'trash-2', 'Delete')}${ib('data-rlclose', 'x', 'Done')}</div>`
      : `<div class="rlr">${ib('data-rllib', 'plus', 'Add', RL.lib)}${ib('data-rlsplitnow', 'scissors', 'Split')}${ib('data-rlsnap', 'magnet', 'Snap', RL.snap)}${ib('data-rlzoom="out"', 'zoom-out', 'Zoom out')}${ib('data-rlzoom="in"', 'zoom-in', 'Zoom in')}</div>`)); }
  function rlLayout() { rlFit(); }   // the resize observer redraws the story once the panels have settled
  function rlAll() { rlPaint(); rlFit(); rlTLH(); rlTL(); rlCtl(); rlLib(); rlInsp(); if (rlNarrow()) rlBarPhone(); else { $('#w-reel').classList.remove('rlph'); $('#rl-phbar')?.remove(); $('#rl-ptop')?.remove(); } }
  function rlToast(msg, icon) { lToast($('#w-reel'), msg, { icon: icon || 'check' }); }
  function rlPop(anchor, html) { $('#rl-pop')?.remove(); const w = $('#w-reel'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop supop" id="rl-pop">${html}</div>`); const p = $('#rl-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left)) + 'px'; p.style.top = (r.bottom - wr.top + 6) + 'px'; }

  /* ── Editing ── */
  function rlPlay(on) { RL.playing = on; rlCtl(); cancelAnimationFrame(RL.raf); if (!on) return; let last = performance.now(); if (RL.t >= rlDur() - .05) RL.t = 0;
    const loop = now => { RL.t = RL.t + (now - last) / 1000; last = now; if (RL.t >= rlDur()) { if (RL.loop) RL.t = 0; else { RL.t = rlDur(); rlPlay(false); rlPaint(); rlHead(); return; } } if (RL.skim == null) rlPaint(); rlHead(); RL.raf = requestAnimationFrame(loop); }; RL.raf = requestAnimationFrame(loop); }
  function rlSplit(id, t) { const i = RL.main.findIndex(c => c.id === id); const cp = c => JSON.parse(JSON.stringify(c));
    if (i >= 0) { const s = rlStarts()[i], c = RL.main[i], at = t - s; if (at < .3 || at > c.d - .3) return; const b = { ...cp(c), id: 'r' + RLID++, d: c.d - at }; c.d = at; RL.main.splice(i + 1, 0, b); RL.sel = b.id; }
    else { const c = rlG(id), lane = RL.over.includes(c) ? RL.over : RL.audio.find(l => l.includes(c)), at = t - c.s; if (at < .3 || at > c.d - .3) return; const b = { ...cp(c), id: 'r' + RLID++, s: t, d: c.d - at }; c.d = at; lane.push(b); RL.sel = b.id; }
    rlAll(); rlToast('Split'); }
  function rlDelete(id) { const i = RL.main.findIndex(c => c.id === id); if (i >= 0) { if (RL.main.length > 1) { RL.main.splice(i, 1); rlToast('Deleted. The story closed the gap'); } } else { RL.over = RL.over.filter(c => c.id !== id); RL.audio = RL.audio.map(l => l.filter(c => c.id !== id)); } RL.sel = null; RL.t = Math.min(RL.t, rlDur()); rlAll(); rlLayout(); }
  function rlSelect(id) { const was = !!RL.sel; RL.sel = id; $$('#rl-lanes .rlclip').forEach(e => e.classList.toggle('on', e.dataset.rlclip === id)); rlInsp(); rlLib(); if (was !== !!id) rlLayout(); }   // selection toggles in place; the story isn't redrawn
  function rlPtr(e) { const wh = e.target.closest('[data-rlwheel]'); if (wh) { RL.drag = { k: 'wheel', key: wh.dataset.rlwheel, el: wh }; rlWheelMove(e); e.preventDefault(); return; }
    const lanes = $('#rl-lanes'); if (!e.target.closest('#rl-lanes') || e.button) return; const r = lanes.getBoundingClientRect(), pps = rlPPS(), tAt = x => Math.max(0, Math.min(rlDur(), (x - r.left + lanes.scrollLeft) / pps));
    const tr = e.target.closest('[data-rltrim]'), cl = e.target.closest('[data-rlclip]'); if (e.target.closest('[data-rltrans]')) return;
    if (tr) { const c = rlG(tr.dataset.rltrim); RL.drag = { k: 'trim', c, x0: e.clientX, d0: c.d }; e.preventDefault(); return; }
    if (cl) { const c = rlG(cl.dataset.rlclip); if (RL.tool === 'blade') { rlSplit(c.id, tAt(e.clientX)); return; } if (RL.sel !== c.id) rlSelect(c.id); RL.drag = { k: 'move', c, x0: e.clientX, s0: c.s, main: RL.main.includes(c) }; e.preventDefault(); return; }
    if (RL.sel) rlSelect(null); RL.t = tAt(e.clientX); RL.drag = { k: 'scrub' }; rlPaint(); rlHead(); }
  function rlWheelMove(e) { const D = RL.drag, r = D.el.getBoundingClientRect(), c = rlG(RL.sel); let x = ((e.clientX - r.left) / r.width - .5) / .42, y = ((e.clientY - r.top) / r.height - .5) / .42; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    c.wheel[D.key] = [Math.round(x * 100) / 100, Math.round(y * 100) / 100]; const pk = D.el.querySelector('.rlwpuck'); pk.style.left = 50 + x * 42 + '%'; pk.style.top = 50 + y * 42 + '%'; D.el.parentElement.querySelector('.rlwreset').hidden = false; rlPaint(); }
  function rlMove(e) { const D = RL.drag; if (D?.k === 'wheel') { rlWheelMove(e); return; } const lanes = $('#rl-lanes'); if (!lanes) return; const r = lanes.getBoundingClientRect(), pps = rlPPS();
    if (!D) { const inside = e.target.closest?.('#rl-lanes'); const sk = inside ? Math.max(0, Math.min(rlDur(), (e.clientX - r.left + lanes.scrollLeft) / pps)) : null; if (sk !== RL.skim) { RL.skim = sk; rlPaint(); rlHead(); } return; }
    if (D.k === 'scrub') { RL.t = Math.max(0, Math.min(rlDur(), (e.clientX - r.left + lanes.scrollLeft) / pps)); RL.skim = null; rlPaint(); rlHead(); return; }
    const dt = (e.clientX - D.x0) / pps;
    if (D.k === 'trim') { D.c.d = Math.max(.5, Math.round((D.d0 + dt) * RLFPS) / RLFPS); rlTL(); return; }
    if (D.k === 'move' && !D.main) { let s = Math.max(0, D.s0 + dt); if (RL.snap) { const ed = [RL.t, ...rlStarts(), rlDur()], near = ed.find(x => Math.abs(x - s) * pps < 8); if (near != null) s = near; } D.c.s = Math.round(s * RLFPS) / RLFPS; rlTL(); return; }
    if (D.k === 'move' && D.main) { const st = rlStarts(), i = RL.main.indexOf(D.c), mid = st[i] + D.c.d / 2 + dt, j = st.findIndex((s, k) => mid >= s && mid < s + RL.main[k].d); if (j >= 0 && j !== i) { RL.main.splice(i, 1); RL.main.splice(j, 0, D.c); D.x0 = e.clientX; rlTL(); } } }
  function rlUp() { if (RL.drag && RL.drag.k !== 'scrub') { rlPaint(); if (RL.drag.k !== 'wheel') rlInsp(); } RL.drag = null; }

  function reelClick(e, hit) { const q = s => hit(s);
    if (rlNarrow()) { const px = q('[data-rlpx]'); if (px) { RL.px = RL.px === 'adj' ? '' : 'adj'; rlBarPhone(); return true; }
      if (q('[data-rlsplitnow]')) { const A = rlAt(RL.t); rlSplit(RL.sel || A.c.id, RL.t); return true; }
      if (q('[data-rladd]') || q('[data-rladdtitle]') || q('[data-rladdtrans]')) setTimeout(() => { RL.lib = false; rlLib(); });
      if (q('[data-rlclose]') || q('[data-rldel]')) RL.px = ''; }
    if (q('#rl-lanes') && !q('[data-rltrans]')) return true;
    if (!q('#rl-pop') && !q('[data-rlblend],[data-rllutpick]')) $('#rl-pop')?.remove();
    if (q('[data-rlplay]')) { rlPlay(!RL.playing); return true; }
    if (q('[data-rlstart]')) { RL.t = 0; rlPaint(); rlHead(); return true; } if (q('[data-rlend]')) { RL.t = rlDur(); rlPaint(); rlHead(); return true; }
    const sp1 = q('[data-rlstep]'); if (sp1) { RL.t = Math.max(0, Math.min(rlDur(), RL.t + +sp1.dataset.rlstep / RLFPS)); rlPaint(); rlHead(); return true; }
    if (q('[data-rlloop]')) { RL.loop = !RL.loop; rlCtl(); return true; }
    const tl = q('[data-rltool]'); if (tl) { RL.tool = tl.dataset.rltool; rlTLH(); $('#rl-lanes').dataset.tool = RL.tool; return true; }
    if (q('[data-rlsnap]')) { RL.snap = !RL.snap; rlTLH(); return true; }
    if (q('[data-rllib]')) { RL.lib = !RL.lib; rlLib(); rlLayout(); return true; }
    if (q('[data-rlopenfx]')) { RL.lib = true; RL.libTab = 'fx'; rlLib(); rlLayout(); return true; }
    const tb = q('[data-rltab]'); if (tb) { RL.libTab = tb.dataset.rltab; rlLib(); return true; }
    const it = q('[data-rlitab]'); if (it) { RL.itab = it.dataset.rlitab; rlInsp(); return true; }
    const ad = q('[data-rladd]'); if (ad) { const [n, f, d] = RLMEDIA[+ad.dataset.rladd], c = rlClip(n, f, d); RL.main.push(c); rlAll(); rlToast(`${n} added to the end`); return true; }
    const at = q('[data-rladdtitle]'); if (at) { const k = at.dataset.rladdtitle, c = rlClip('Title', '', 4, { kind: 'title', s: RL.t, text: { big: 'Luma 1.0', lower: 'Priya Raman', end: 'Thank you' }[k], sub: { big: '', lower: 'Design', end: 'simplyluma.com' }[k], style: k }); RL.over.push(c); RL.sel = c.id; RL.itab = 'text'; rlAll(); rlLayout(); return true; }
    const ax = q('[data-rladdtrans]'); if (ax) { const A = rlAt(RL.t), c = A.local < A.c.d / 2 && A.i > 0 ? RL.main[A.i - 1] : A.c; RL.trans[c.id] = ax.dataset.rladdtrans; rlTL(); rlPaint(); rlToast('Transition added'); return true; }
    const af = q('[data-rladdfx]'); if (af) { const c = rlG(RL.sel); c.fx.push({ k: af.dataset.rladdfx, amt: 50, on: true }); RL.itab = 'fx'; rlPaint(); rlTL(); rlInsp(); rlToast(`${RLFX[af.dataset.rladdfx][0]} added to ${c.n}`); return true; }
    const lu = q('[data-rllut]'); if (lu) { const c = rlG(RL.sel); c.lut = lu.dataset.rllut; RL.itab = 'colour'; rlPaint(); rlTL(); rlInsp(); rlLib(); return true; }
    if (q('[data-rllutpick]')) { rlPop(q('[data-rllutpick]'), Object.entries(RLLUT).map(([k, [n]]) => `<button class="crmi${rlG(RL.sel).lut === k ? ' on' : ''}" type="button" data-rllutset="${k}"><span>${n}</span></button>`).join('') + '<span class="crsep"></span><button class="crmi" type="button" data-rltodo="Pick a .cube file"><span>Import a LUT…</span></button>'); return true; }
    const ls = q('[data-rllutset]'); if (ls) { rlG(RL.sel).lut = ls.dataset.rllutset; $('#rl-pop')?.remove(); rlPaint(); rlInsp(); rlTL(); return true; }
    if (q('[data-rlblend]')) { rlPop(q('[data-rlblend]'), RLBLEND.map(b => `<button class="crmi${rlG(RL.sel).blend === b ? ' on' : ''}" type="button" data-rlblendset="${b}"><span>${b}</span></button>`).join('')); return true; }
    const bs = q('[data-rlblendset]'); if (bs) { rlG(RL.sel).blend = bs.dataset.rlblendset; $('#rl-pop')?.remove(); rlPaint(); rlInsp(); return true; }
    const cu = q('[data-rlcurve]'); if (cu) { rlG(RL.sel).curve = cu.dataset.rlcurve; rlPaint(); rlInsp(); return true; }
    const wr = q('[data-rlwreset]'); if (wr) { rlG(RL.sel).wheel[wr.dataset.rlwreset] = [0, 0]; rlPaint(); rlInsp(); return true; }
    if (q('[data-rlresetx]')) { Object.assign(rlG(RL.sel), { px: 0, py: 0, scale: 100, rot: 0, ax: 50, ay: 50 }); rlPaint(); rlInsp(); return true; }
    const fo = q('[data-rlfxon]'); if (fo) { const f = rlG(RL.sel).fx[+fo.dataset.rlfxon]; f.on = !f.on; rlPaint(); rlInsp(); return true; }
    const fd = q('[data-rlfxdel]'); if (fd) { rlG(RL.sel).fx.splice(+fd.dataset.rlfxdel, 1); rlPaint(); rlInsp(); rlTL(); return true; }
    for (const k of ['stab', 'nr', 'hum']) if (q(`[data-rl${k}]`)) { const c = rlG(RL.sel); c[k] = !c[k]; if (k === 'stab') { const i = c.fx.findIndex(f => f.k === 'stabilize'); if (c.stab && i < 0) c.fx.push({ k: 'stabilize', amt: 50, on: true }); if (!c.stab && i >= 0) c.fx.splice(i, 1); } rlInsp(); rlPaint(); return true; }
    const eq = q('[data-rleq]'); if (eq) { rlG(RL.sel).eq = eq.dataset.rleq; rlInsp(); return true; }
    const trn = q('[data-rltrans]'); if (trn) { delete RL.trans[trn.dataset.rltrans]; rlTL(); rlPaint(); return true; }
    if (q('[data-rlclose]')) { rlSelect(null); return true; }
    if (q('[data-rldel]')) { rlDelete(RL.sel); return true; } if (q('[data-rldup]')) { const c = rlG(RL.sel), i = RL.main.indexOf(c); if (i >= 0) { const b = { ...JSON.parse(JSON.stringify(c)), id: 'r' + RLID++ }; RL.main.splice(i + 1, 0, b); RL.sel = b.id; } rlAll(); return true; }
    const sp = q('[data-rlspeed]'); if (sp) { const c = rlG(RL.sel), old = c.speed; c.speed = +sp.dataset.rlspeed; c.d = Math.round(c.d * old / c.speed * 10) / 10; rlAll(); return true; }
    const sy = q('[data-rlstyle]'); if (sy) { rlG(RL.sel).style = sy.dataset.rlstyle; rlPaint(); rlInsp(); return true; }
    const zm = q('[data-rlzoom]'); if (zm) { RL.zoom = Math.max(1, Math.min(6, RL.zoom * (zm.dataset.rlzoom === 'in' ? 1.5 : 1 / 1.5))); rlTL(); return true; }
    if (q('[data-rlexport]')) { rlExport(); return true; }
    const ex = q('[data-rlex]'); if (ex) { RL.exp = ex.dataset.rlex; rlExport(); return true; }
    if (q('[data-rlexx]')) { $('#w-reel').classList.remove('rlon'); $('#rl-sheet').className = 'mdsheet'; return true; }
    if (q('[data-rlexgo]')) { $('#w-reel').classList.remove('rlon'); $('#rl-sheet').className = 'mdsheet'; rlExporting(); return true; }
    const td = q('[data-rltodo]'); if (td) { $('#rl-pop')?.remove(); rlToast(td.dataset.rltodo); return true; }
    return false; }
  const RLEX = { share: ['Share', '1080p · H.264', 180], master: ['Master', '4K · ProRes 422', 11200], vertical: ['Vertical', '1080 × 1920 · for phones', 150], audio: ['Sound only', 'WAV · 48 kHz', 8] };
  function rlExport() { const s = $('#rl-sheet'), w = $('#w-reel'), mb = n => n >= 1000 ? (n / 1000).toFixed(1) + ' GB' : n + ' MB';
    s.innerHTML = `<h2>Export “Launch film”</h2><p>${Math.round(rlDur())} seconds, to Videos.</p><div class="rlexs">${Object.entries(RLEX).map(([k, [n, d, sz]]) => `<button type="button" class="rlex${RL.exp === k ? ' on' : ''}" data-rlex="${k}"><i class="rlexi ${k}"></i><span><b>${n}</b><small>${d}</small></span><em>about ${mb(sz)}</em></button>`).join('')}</div>
      <div class="mdact"><span></span><button class="bt fill" type="button" data-rlexx>Cancel</button><button class="bt key" type="button" data-rlexgo>Export</button></div>`;
    w.classList.add('rlon'); s.className = 'mdsheet rlsheet'; void s.offsetWidth; s.classList.add('show'); }
  function rlExporting() { let p = 0; const bar = $('#rl-tlinfo'); const iv = setInterval(() => { p = Math.min(100, p + 4 + Math.random() * 6); bar.innerHTML = `<b>Exporting</b><span class="rlprog"><i style="width:${p}%"></i></span><span>${Math.round(p)}%</span>`; if (p >= 100) { clearInterval(iv); rlTLH(); rlToast(`Saved “Launch film.${RL.exp === 'audio' ? 'wav' : RL.exp === 'master' ? 'mov' : 'mp4'}” to Videos`); } }, 140); }
  function renderReel() { rlAll2().forEach(c => c.img && !c.img.endsWith('/.webp') && rlWarm(c.img)); RLMEDIA.forEach(([, f]) => rlWarm(PH + f + '.webp')); $('#rl-top').innerHTML = `<img src="${A}video-editor.svg" alt=""><b>Launch film</b><span class="sumeta">Reel · Saved</span><span class="sutopr">${av('NF', 26)}<button class="bt sm fill" type="button" data-share>${ic('share-2')}Share</button><button class="bt sm key stplay" type="button" data-rlexport>${ic('share')}Export</button><button class="ib" type="button" data-lmenu data-docmore title="More" aria-label="More">${ic('ellipsis')}</button></span>`;
    $('#rl-libb').innerHTML = `${ic('layers')}<span>Browser</span>`;
    const w = $('#w-reel'); w.addEventListener('pointerdown', rlPtr); addEventListener('pointermove', rlMove); addEventListener('pointerup', rlUp);
    $('#rl-lanes').addEventListener('pointerleave', () => { if (RL.skim != null) { RL.skim = null; rlPaint(); rlHead(); } });
    $('#rl-lanes').addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); RL.zoom = Math.max(1, Math.min(6, RL.zoom * Math.exp(-e.deltaY * .01))); rlTL(); } }, { passive: false });
    let rw = 0; new ResizeObserver(() => { rlFit(); clearTimeout(rw); rw = setTimeout(rlTL, 120); }).observe($('#rl-work')); rlAll(); }
  document.addEventListener('input', e => { const t = e.target; if (!t.closest?.('#w-reel')) return; const c = RL.sel && rlG(RL.sel); if (!c) return;
    if (t.dataset.rlfxamt != null) { c.fx[+t.dataset.rlfxamt].amt = +t.value; t.nextElementSibling.textContent = t.value; rlPaint(); return; }
    const k = t.dataset.rlset; if (k) { const v = +t.value; if (k in c.adj) c.adj[k] = v; else c[k] = v; const em = t.nextElementSibling; em.textContent = (v > 0 && +t.min < 0 ? '+' : '') + v + (k === 'vol' ? ' dB' : k === 'op' || k === 'lutAmt' ? '%' : ''); t.closest('.drsl').classList.toggle('set', !!v); rlPaint(); return; }
    if (t.dataset.rlf) { const v = parseFloat(t.value), [a, b] = t.dataset.rlf.split('.'); if (!Number.isNaN(v)) { if (b) c[a][b] = v; else c[a] = v; rlPaint(); if (a === 'd' || a === 's') rlTL(); } return; }
    if (t.matches('[data-rltext]')) { c.text = t.value; c.n = t.value.split('\n')[0] || 'Title'; rlPaint(); rlTL(); return; } if (t.matches('[data-rlsub]')) { c.sub = t.value; rlPaint(); return; }
    if (t.matches('[data-rlname]')) { c.n = t.value; rlTL(); } });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'reel' || e.target.closest?.('input, textarea')) return; const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'e') { e.preventDefault(); rlExport(); return; } if (e.metaKey || e.ctrlKey) return;
    if (e.key === ' ') { e.preventDefault(); rlPlay(!RL.playing); return; } if (e.key === 'Home') { RL.t = 0; rlPaint(); rlHead(); return; } if (e.key === 'End') { RL.t = rlDur(); rlPaint(); rlHead(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); RL.t = Math.max(0, Math.min(rlDur(), RL.t + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 1 / RLFPS))); rlPaint(); rlHead(); return; }
    if (k === 'b') { RL.tool = 'blade'; rlTLH(); return; } if (k === 'a') { RL.tool = 'select'; rlTLH(); return; } if (k === 'n') { RL.snap = !RL.snap; rlTLH(); return; } if (k === 'y') { $('[data-rllib]')?.click(); return; } if (k === 'm') { RL.marks.push(RL.t); rlTL(); return; }
    if (e.key === '\\') { RL.focus = !RL.focus; rlLib(); rlInsp(); rlLayout(); return; }
    if ((e.key === 'Backspace' || e.key === 'Delete') && RL.sel) { e.preventDefault(); rlDelete(RL.sel); return; }
    if (e.key === 'Escape') { if ($('#w-reel').classList.contains('rlon')) $('[data-rlexx]')?.click(); else { RL.tool = 'select'; rlSelect(null); rlTLH(); } } });

  /* ══ Icon picker: one component for every app ════════════════════════════════
     How anything gets its mark: a coloured dot (the default), an icon, or an emoji. One colour row serves dots and icons.
     lMark(m, cls) draws a mark; lPick(anchor, mark, onPick) opens the picker beside the button that asked (a drawer on a phone). */
  const LHUE = [[250, 'Blue'], [200, 'Teal'], [150, 'Green'], [95, 'Yellow'], [55, 'Orange'], [25, 'Red'], [350, 'Pink'], [300, 'Purple'], [285, 'Violet'], [null, 'Grey']];
  const LICONS = ['folder', 'file-text', 'notebook-pen', 'sticky-note', 'book', 'book-open', 'bookmark', 'library', 'list-checks', 'square-check', 'clipboard', 'inbox', 'archive', 'tag', 'flag', 'pin', 'star', 'heart',
    'briefcase', 'building', 'house', 'calendar', 'clock', 'timer', 'hourglass', 'bell', 'mail', 'message-circle', 'phone', 'send', 'users', 'user', 'smile', 'sparkles', 'zap', 'badge-check', 'shield', 'key', 'lock',
    'globe', 'map-pin', 'compass', 'navigation', 'car', 'bike', 'train-front', 'footprints', 'tree-pine', 'leaf', 'sun', 'moon', 'cloud', 'droplets', 'waves', 'wind', 'coffee', 'utensils', 'cake',
    'camera', 'image', 'film', 'music', 'headphones', 'mic', 'guitar', 'piano', 'palette', 'pen-tool', 'pencil', 'highlighter', 'scissors', 'code', 'terminal', 'cpu', 'monitor', 'smartphone', 'database',
    'chart-column', 'chart-pie', 'receipt', 'wallet', 'credit-card', 'dollar-sign', 'package', 'wrench', 'gauge', 'activity', 'layers', 'layout-grid', 'git-branch', 'hash', 'at-sign', 'eye', 'watch'];
  const LEMOJI = [['📝', 'note memo write'], ['📓', 'notebook'], ['📚', 'books library read'], ['🔖', 'bookmark'], ['📌', 'pin'], ['📎', 'clip'], ['✅', 'done check tick'], ['⭐', 'star favourite'], ['❤️', 'heart love'], ['🔥', 'fire hot'],
    ['💡', 'idea light'], ['🎯', 'goal target'], ['🚀', 'launch rocket ship'], ['🎉', 'party celebrate'], ['🏆', 'trophy win'], ['📅', 'calendar date'], ['⏰', 'alarm clock time'], ['📣', 'announce press'], ['📰', 'news press'], ['💼', 'work briefcase'],
    ['🏠', 'home house'], ['🏡', 'garden home'], ['🧾', 'receipt tax'], ['💰', 'money'], ['💳', 'card pay'], ['🛒', 'shopping groceries cart'], ['🥕', 'groceries food carrot'], ['🍳', 'cook recipe breakfast'], ['🍝', 'pasta recipe dinner'], ['🥗', 'salad food'],
    ['☕', 'coffee'], ['🍷', 'wine'], ['🎂', 'birthday cake'], ['🎁', 'gift present'], ['✈️', 'travel plane flight'], ['🧳', 'trip luggage'], ['🗺️', 'map trip'], ['🏔️', 'mountain climb'], ['🧗', 'climbing gear'], ['⛺', 'camp tent'],
    ['🚲', 'bike'], ['🏃', 'run exercise'], ['🧘', 'yoga calm'], ['🌱', 'plant grow'], ['🌸', 'flower spring'], ['🌊', 'sea wave'], ['☀️', 'sun summer'], ['🌙', 'moon night'], ['❄️', 'snow winter'], ['🎵', 'music song'],
    ['🎸', 'guitar'], ['🎧', 'headphones listen'], ['🎬', 'film movie'], ['📷', 'camera photo'], ['🎨', 'art paint design'], ['✏️', 'pencil draft'], ['🖥️', 'computer desktop'], ['📱', 'phone mobile'], ['⌨️', 'keyboard'], ['🧪', 'test lab'],
    ['🐞', 'bug'], ['🔧', 'fix tool'], ['🔒', 'lock private'], ['🔑', 'key password wifi'], ['📶', 'wifi signal'], ['🐶', 'dog pet'], ['🐱', 'cat pet'], ['👶', 'baby'], ['👪', 'family'], ['🤝', 'meeting deal'],
    ['💬', 'chat talk'], ['📧', 'email mail'], ['📞', 'call phone'], ['🧠', 'brain think'], ['📈', 'growth chart'], ['🗂️', 'files folder'], ['📦', 'package ship'], ['🧹', 'clean chores'], ['🩺', 'health doctor'], ['💊', 'medicine']];
  const lHueCss = h => h == null ? 'var(--ink-3)' : `oklch(0.72 0.13 ${h})`;
  function lMark(m, cls = '') { m = m || { t: 'dot', h: 250 };
    if (m.t === 'emoji') return `<span class="lmk em ${cls}">${m.v}</span>`;
    if (m.t === 'icon') return `<span class="lmk ic ${cls}" style="--mc:${lHueCss(m.h)}">${ic(m.v)}</span>`;
    return `<span class="lmk ${cls}"><i class="dot" style="--mc:${lHueCss(m.h)}"></i></span>`; }
  const LP = { anchor: null, m: null, cb: null, tab: 'dot', q: '' };
  function lPickHTML() { const m = LP.m, tab = LP.tab, q = LP.q.trim().toLowerCase(), h = m.t === 'emoji' ? 250 : m.h;
    const hues = `<div class="lphues">${LHUE.map(([v, n]) => `<button type="button" class="${(tab === 'dot' ? m.t === 'dot' : m.t === 'icon') && v === m.h ? 'on' : ''}" data-lphue="${v}" title="${n}" aria-label="${n}" style="--mc:${lHueCss(v)}"><i></i></button>`).join('')}</div>`;
    const body = tab === 'dot' ? hues
      : tab === 'icon' ? `${hues}<label class="lpq">${ic('search')}<input data-lpq placeholder="Search icons" value="${esc(LP.q)}" autocomplete="off" spellcheck="false"></label><div class="lpgrid ic">${LICONS.filter(n => !q || n.replace(/-/g, ' ').includes(q)).map(n => `<button type="button" class="${m.t === 'icon' && m.v === n ? 'on' : ''}" data-lpicon="${n}" title="${n.replace(/-/g, ' ')}" style="--mc:${lHueCss(h)}">${ic(n)}</button>`).join('') || '<p class="lpnone">No icons match</p>'}</div>`
      : `<label class="lpq">${ic('search')}<input data-lpq placeholder="Search emoji" value="${esc(LP.q)}" autocomplete="off" spellcheck="false"></label><div class="lpgrid em">${LEMOJI.filter(([e, k]) => !q || k.includes(q)).map(([e]) => `<button type="button" class="${m.t === 'emoji' && m.v === e ? 'on' : ''}" data-lpemoji="${e}">${e}</button>`).join('') || '<p class="lpnone">No emoji match</p>'}</div>`;
    return `<div class="lphead">${lMark(m, 'lg')}${seg([['dot', 'Dot'], ['icon', 'Icon'], ['emoji', 'Emoji']], tab, 'data-lptab', 'Kind of mark', 'lpseg')}</div>${body}`; }
  function lPickDraw() { const p = $('#lpick'); if (!p) return; const f = document.activeElement?.matches?.('[data-lpq]'), pos = f ? document.activeElement.selectionStart : 0, gs = p.querySelector('.lpgrid')?.scrollTop || 0;
    p.innerHTML = lPickHTML(); segs(); const g = p.querySelector('.lpgrid'); if (g) g.scrollTop = gs; lPickPlace(); if (f) { const i = p.querySelector('[data-lpq]'); i?.focus(); i?.setSelectionRange(pos, pos); } }
  function lPickPlace() { const p = $('#lpick'), a = LP.anchor; if (!p || !a?.isConnected) return; const w = a.closest('.win'), wr = w.getBoundingClientRect(), r = a.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
    let x = r.left - wr.left, y = r.bottom - wr.top + 8; if (x + pw > wr.width - 8) x = wr.width - pw - 8; if (y + ph > wr.height - 8) y = Math.max(8, r.top - wr.top - ph - 8); p.style.left = Math.max(8, x) + 'px'; p.style.top = y + 'px'; }
  function lPick(anchor, mark, cb) { lPickClose(); const w = anchor.closest('.win'); Object.assign(LP, { anchor, m: { ...(mark || { t: 'dot', h: 250 }) }, cb, tab: mark?.t || 'dot', q: '' }); anchor.classList.add('lpon');
    w.insertAdjacentHTML('beforeend', '<div class="lpick" id="lpick" role="dialog" aria-label="Choose a mark"></div>'); lPickDraw(); requestAnimationFrame(() => $('#lpick')?.classList.add('on')); }
  function lPickClose() { $('#lpick')?.remove(); LP.anchor?.classList.remove('lpon'); LP.anchor = null; }
  function lPickSet(m, close) { LP.m = m; LP.cb?.(m); if (close) lPickClose(); else lPickDraw(); }
  function lPickClick(e, hit) { const t = hit('[data-lptab]'); if (t) { LP.tab = t.dataset.lptab; LP.q = ''; lPickDraw(); return; }
    const hu = hit('[data-lphue]'); if (hu) { const h = hu.dataset.lphue === 'null' ? null : +hu.dataset.lphue; if (LP.tab === 'dot') lPickSet({ t: 'dot', h }, true); else lPickSet({ t: 'icon', v: LP.m.t === 'icon' ? LP.m.v : 'star', h }, false); return; }
    const icn = hit('[data-lpicon]'); if (icn) { lPickSet({ t: 'icon', v: icn.dataset.lpicon, h: LP.m.t === 'emoji' ? 250 : LP.m.h }, true); return; }
    const em = hit('[data-lpemoji]'); if (em) { lPickSet({ t: 'emoji', v: em.dataset.lpemoji }, true); return; } }
  document.addEventListener('pointerdown', e => { if (LP.anchor && !e.target.closest('#lpick') && e.target !== LP.anchor && !LP.anchor.contains(e.target)) lPickClose(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && LP.anchor) lPickClose(); });
  document.addEventListener('input', e => { if (e.target.matches?.('[data-lpq]')) { LP.q = e.target.value; lPickDraw(); } });

  document.addEventListener('input', e => { const t = e.target; if (!t.closest?.('#cal-draft')) return; const d = CS.draft; if (!d) return;
    if (t.matches('[data-cdt]')) d[t.dataset.cdt] = t.value;
    if (t.matches('[data-cdq]')) { CS.dq = t.value; calDraftCard(); const x = $('#cal-draft [data-cdq]'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); } });
  document.addEventListener('keydown', e => { const t = e.target; if (!t.closest?.('#cal-draft')) return; if (e.key === 'Enter' && t.matches('[data-cdq]')) { e.preventDefault(); $('#cal-draft [data-cdadd]')?.click(); } else if (e.key === 'Enter') { e.preventDefault(); $('[data-cdraftok]')?.click(); } if (e.key === 'Escape') $('[data-cdraftx]')?.click(); });
  /* Photos: size and edit sliders act live */
  document.addEventListener('input', e => { const t = e.target;
    if (t.matches?.('[data-psize]')) { P.size = +t.value; $('#w-photos').style.setProperty('--pcs', P.size + 'px'); return; }
    if (t.matches?.('[data-ped]')) { const k = t.dataset.ped; P.ed[k] = +t.value; const v = $(`#p-ed [data-pedv="${k}"]`); $('#p-ed [data-prevert]')?.removeAttribute('disabled'); if (v) v.textContent = (+t.value > 0 ? '+' : '') + t.value; const img = $('#p-img'); if (img) { img.style.filter = pFilter(P.ed); } } });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-palname]')) $('#lmenu [data-palmk]')?.click(); });
  /* Scroll fade: any vertical scroller in a window gets .is-scrolled while it's scrolled down */
  document.addEventListener('scroll', e => { const el = e.target; if (!(el instanceof Element) || !el.closest('.win') || el.scrollHeight <= el.clientHeight + 2) return; el.classList.toggle('is-scrolled', el.scrollTop > 2); }, true);
  /* ══ Share: one component for every app ═══════════════════════════════════════
     Any [data-share] button opens it, anchored to the button. There is no key: sharing has no single job, so every
     target acts the moment you tap it.
       Header       what is being shared
       People       recent people on Luma, a scroller; tap to send in Messages
       Apps         where it can go, a scroller: Messages, Mail, Nearby, then apps that take it in (Notes, Photos, Canvas, Write, Ari)
       Actions      an inset list: Copy, Save a copy, Print
       Link         an inset: who the link works for (a picker), and Copy link as a raised button inside it
     Documents people work on together (Write, Notes, Canvas, Grid, Stage, Reel) open on "Work together": add people by
     name or @username, choose what each can do, and who the link works for. "Send a copy" is the file sheet. */
  const SHR = { docs: {}, spec: null, anchor: null, q: '', menu: null, sent: {}, near: false, nearFound: 0, copied: '', linkFor: 'people', mode: 'together' };
  const SHPPL = ['PR', 'NF', 'TH', 'SK', 'AR', 'AC', 'JK', 'ZM'], SHROLE = [['edit', 'Can edit'], ['comment', 'Can comment'], ['view', 'Can view']];
  const SHDOC = ['write', 'notes', 'canvas', 'grid', 'stage', 'reel'], SHNEAR = [['Priya’s ThinkPad', 'monitor'], ['Nick’s phone', 'smartphone']];
  const shFirst = k => PPL[k].n.split(' ')[0];
  function shSpec(btn) { const win = btn.closest('.win'), app = win?.dataset.app || '', title = (win?.querySelector('.ttl h1, h1')?.textContent || win?.querySelector('.tbar b')?.textContent || 'Untitled').trim(), icon = `<img src="${cfIco(app)}" alt="">`;
    if (app === 'filer') { const f = fSelFile(); return f ? { kind: 'file', img: f.k === 'img', t: f.n, sub: `${KIND[f.k]} · ${f.size}`, th: f.src ? `<img src="${f.src}" alt="">` : mini(f) } : { kind: 'file', t: 'Launch', sub: `Folder · ${FILES.length} items`, th: FOLDER }; }
    if (SHDOC.includes(app)) { const d = SHR.docs[app] ||= { people: [['PR', 'edit'], ['NF', 'comment']], link: 'off' }; return { kind: 'doc', app, t: title, sub: `${cfName(app)} · ${d.people.length ? `you and ${d.people.length} other${d.people.length > 1 ? 's' : ''}` : 'only you'}`, th: icon, d }; }
    if (app === 'calendar' && CS.sel != null) { const e = EVS.find(x => x.id === CS.sel); return { kind: 'link', t: e.t, sub: `${fmtD(e.o)} · ${e.all ? 'All day' : fmtT(e.s)}`, th: icon }; }
    if (app === 'viewer') { const f = vwF(VW.cur); if (f) return { kind: 'file', img: !f.pdf, t: f.n, sub: `${f.kind} · ${f.sz}`, th: f.pdf ? icon : `<img src="${f.src}" alt="">` }; }
    if (app === 'contacts') { const k = CT.cur, p = ppl(k); return { kind: 'contact', self: k, u: p.u, t: p.n, sub: p.u ? `simplyluma.com/@${p.u}` : 'Contact card', th: av(k, 46) }; }
    if (app === 'maps') { if (btn.dataset.share === 'loc') return { kind: 'link', t: 'My location', sub: 'Live for 1 hour · Luma Studio, 2nd St', th: `<span class="shloc">${ic('navigation')}</span>` }; const p = mpP(MP.place); if (p) return { kind: 'link', t: p.n, sub: `${p.c} · ${p.addr}, Oakland`, th: `<img src="${p.img}" alt="">` }; }
    if (app === 'youtube') return ytShare();
    if (app === 'viola' || app === 'maps' || app === 'tide') return { kind: 'link', t: title, sub: { viola: 'simplyluma.com', maps: 'A place in Maps', tide: 'An album in Tide' }[app], th: icon };
    const img = win?.querySelector('.main img:not([src$=".svg"]), .isle img:not([src$=".svg"])'); return { kind: 'file', img: app === 'photos' || app === 'viewer' || app === 'darkroom', t: title, sub: cfName(app), th: img ? `<img src="${img.getAttribute('src')}" alt="">` : icon }; }
  const shIc = a => `<span class="shic"><img src="${cfIco(a)}" alt=""></span>`, shSys = g => `<span class="shic sys">${ic(g)}</span>`;
  function shTargets(s) { const t = [['messages', 'Messages', shIc('messages')], ['charlie', 'Mail', shIc('charlie')], ['nearby', 'Nearby', shSys('radar')], ['notes', 'Notes', shIc('notes')]];
    if (s.img) t.push(['photos', 'Photos', shIc('photos')], ['canvas', 'Canvas', shIc('canvas')]); else if (s.kind !== 'link') t.push(['write', 'Write', shIc('write')]);
    t.push(['ari', 'Ari', shIc('ari')]); return t; }
  function shMenu(k, opts, cur) { return SHR.menu === k ? `<div class="shmenu">${opts.map(([v, n, sub]) => `<button type="button" class="${v === cur ? 'on' : ''}" data-shpick="${k}:${v}"><span><b>${n}</b>${sub ? `<small>${sub}</small>` : ''}</span>${v === cur ? ic('check') : ''}</button>`).join('')}${typeof k === 'number' ? `<span class="crsep"></span><button type="button" class="red" data-shrm="${k}"><span><b>Remove</b></span></button>` : ''}</div>` : ''; }
  function shHTML() { const s = SHR.spec, doc = s.kind === 'doc', together = doc && SHR.mode === 'together';
    const head = `<div class="shh"><span class="shth">${s.th}</span><span class="sht"><b>${esc(s.t)}</b><small>${esc(together || !doc ? s.sub : `A copy · ${cfName(s.app)} document`)}</small></span></div>${doc ? `<div class="shmode">${seg([['together', 'Work together'], ['copy', 'Send a copy']], SHR.mode, 'data-shmode', 'How to share', 'shseg')}</div>` : ''}`;
    const copyChip = `<button class="shchip${SHR.copied === 'link' ? ' done' : ''}" type="button" data-shcopy="link">${ic(SHR.copied === 'link' ? 'check' : 'link-2')}${SHR.copied === 'link' ? 'Copied' : 'Copy link'}</button>`;
    if (together) { const d = s.d, q = SHR.q.trim().toLowerCase(), sug = q ? Object.keys(PPL).filter(k => k !== 'me' && PPL[k].u && !d.people.some(p => p[0] === k) && (PPL[k].n.toLowerCase().includes(q) || PPL[k].u.includes(q.replace('@', '')))).slice(0, 4) : [];
      const LOPT = [['off', 'Only people with access', 'Nobody else can open it'], ['view', 'Anyone with the link can view', 'No account needed'], ['edit', 'Anyone with the link can edit', 'No account needed']], lo = LOPT.find(x => x[0] === d.link);
      return `${head}<hr class="shd"><label class="shinv">${ic('user-plus')}<input data-shq placeholder="Add people by name or @username" value="${esc(SHR.q)}" autocomplete="off" spellcheck="false"></label>
        ${sug.length ? `<div class="shsug">${sug.map((k, i) => `<button type="button" class="${i ? '' : 'first'}" data-shadd="${k}">${av(k, 28)}<span><b>${esc(PPL[k].n)}</b><small>@${PPL[k].u}</small></span><em>${i ? '' : 'Return to add'}</em></button>`).join('')}</div>` : q ? `<p class="shnone">No one called “${esc(SHR.q)}” is on Luma yet.</p>` : ''}
        <div class="shlist"><div class="shp">${av('me', 32)}<span><b>You</b><small>@nick</small></span><em>Owner</em></div>
        ${d.people.map(([k, r], i) => `<div class="shp">${av(k, 32)}<span><b>${esc(PPL[k].n)}</b><small>@${PPL[k].u}</small></span><button class="shrole" type="button" data-shmenu="${i}">${SHROLE.find(x => x[0] === r)[1]}${ic('chevron-down')}</button>${shMenu(i, SHROLE, r)}</div>`).join('')}</div>
        <div class="shlink"><span class="shli">${ic(d.link === 'off' ? 'lock' : 'globe')}</span><button class="shlpk" type="button" data-shmenu="link"><b>${lo[1]}</b><small>${lo[2]}</small>${ic('chevrons-up-down')}</button>${copyChip}${shMenu('link', LOPT, d.link)}</div>`; }
    const nearRows = SHR.near ? `<div class="shnear"><h6>${SHR.nearFound < SHNEAR.length ? '<i class="shping"></i>Looking nearby' : 'Nearby'}</h6>${SHNEAR.slice(0, SHR.nearFound).map(([n, i]) => `<button type="button" data-shnear="${esc(n)}">${ic(i)}<b>${esc(n)}</b><em>${SHR.sent['n:' + n] ? `${ic('check')}Sent` : 'Send'}</em></button>`).join('')}</div>` : '';
    const acts = s.kind === 'contact' ? [...(s.u ? [['copylink', 'link-2', 'Copy link', '']] : []), ['copy', 'copy', 'Copy contact card', ''], ['save', 'folder-down', 'Save as a file\u2026', '']] : s.kind === 'link' ? [['copylink', 'link-2', 'Copy link', 'Ctrl C'], ['qr', 'qr-code', 'Show a code to scan', '']] : [['copy', 'copy', 'Copy', 'Ctrl C'], ['save', 'folder-down', 'Save a copy…', ''], ['print', 'printer', 'Print…', 'Ctrl P']];
    const LF = [['people', 'Only people you send it to', 'They sign in to open it'], ['anyone', 'Anyone with the link', 'Can view, no account needed']], lf = LF.find(x => x[0] === SHR.linkFor);
    return `${head}<hr class="shd"><div class="shscroll shppl">${SHPPL.filter(k => k !== s.self).map(k => `<button type="button" data-shto="${k}" class="${SHR.sent[k] ? 'sent' : ''}" title="Send to ${esc(PPL[k].n)} in Messages">${av(k, 48)}${SHR.sent[k] ? `<i class="shok">${ic('check')}</i>` : ''}<span>${shFirst(k)}</span></button>`).join('')}</div>
      <hr class="shd"><div class="shscroll shapps">${shTargets(s).map(([a, n, g]) => `<button type="button" ${a === 'nearby' ? 'data-shnearby' : `data-shapp="${a}"`} class="${a === 'nearby' && SHR.near ? 'on' : ''}">${g}<span>${n}</span></button>`).join('')}</div>${nearRows}
      <div class="shacts">${acts.map(([k, g, n, kb]) => `<button type="button" data-shact="${k}">${ic(SHR.copied === k ? 'check' : g)}<b>${SHR.copied === k ? 'Copied' : n}</b>${kb ? `<kbd>${kb}</kbd>` : ''}</button>`).join('')}</div>
      ${s.kind === 'link' || s.kind === 'contact' || doc ? '' : `<div class="shlink"><span class="shli">${ic(SHR.linkFor === 'anyone' ? 'globe' : 'lock')}</span><button class="shlpk" type="button" data-shmenu="lf"><b>${lf[1]}</b><small>${lf[2]}</small>${ic('chevrons-up-down')}</button>${copyChip}${shMenu('lf', LF, SHR.linkFor)}</div>`}`; }
  function shPlace() { const p = $('#lshare'), a = SHR.anchor; if (!p || !a?.isConnected) return; const w = a.closest('.win'), wr = w.getBoundingClientRect(), r = a.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight, up = r.top - wr.top > wr.height * .5;
    p.style.left = Math.max(8, Math.min(wr.width - pw - 8, r.right - wr.left - pw)) + 'px'; p.style.top = (up ? Math.max(8, r.top - wr.top - ph - 10) : Math.min(wr.height - ph - 8, r.bottom - wr.top + 10)) + 'px'; p.classList.toggle('up', up); }
  function shDraw() { const p = $('#lshare'); if (!p) return; const f = document.activeElement?.matches?.('[data-shq]'), pos = f ? document.activeElement.selectionStart : 0, sc = [...p.querySelectorAll('.shscroll')].map(x => x.scrollLeft);
    p.innerHTML = shHTML(); p.querySelectorAll('.shscroll').forEach((x, i) => x.scrollLeft = sc[i] || 0); segs(); shPlace();
    if (f) { const i = p.querySelector('[data-shq]'); i.focus(); i.setSelectionRange(pos, pos); } }
  function shOpen(btn) { if (SHR.anchor === btn && $('#lshare')) return shClose(); shClose(); const w = btn.closest('.win'); if (!w) return;
    Object.assign(SHR, { spec: shSpec(btn), anchor: btn, q: '', menu: null, sent: {}, near: false, nearFound: 0, copied: '', mode: 'together' }); btn.classList.add('shon');
    w.insertAdjacentHTML('beforeend', '<div class="lshare" id="lshare" role="dialog" aria-label="Share"></div>'); shDraw(); requestAnimationFrame(() => $('#lshare')?.classList.add('on')); }
  function shClose() { $('#lshare')?.remove(); SHR.anchor?.classList.remove('shon'); SHR.anchor = null; SHR.spec = null; }
  const shToast = msg => lToast(SHR.anchor?.closest('.win'), msg);
  const shCopied = k => { SHR.copied = k; SHR.menu = null; shDraw(); setTimeout(() => { if (SHR.copied === k) { SHR.copied = ''; shDraw(); } }, 1600); };
  function shClick(e, hit) { const s = SHR.spec; if (!s) return;
    const md = hit('[data-shmode]'); if (md) { SHR.mode = md.dataset.shmode; SHR.menu = null; shDraw(); return; }
    const to = hit('[data-shto]'); if (to) { const k = to.dataset.shto; SHR.sent[k] = true; shDraw(); shToast(`Sent to ${shFirst(k)} in Messages`); return; }
    const ap = hit('[data-shapp]'); if (ap) { const a = ap.dataset.shapp, msg = { messages: 'A new message', charlie: 'A new email', notes: 'Added to a new note', photos: 'Added to Photos', canvas: 'Placed on a new board in Canvas', write: 'Opened in Write', ari: 'Ari has it. Ask what you like.' }[a];
      shToast(a === 'messages' || a === 'charlie' ? `${msg} with ${s.t} attached` : msg); shClose(); if (window.lumaDesk) lumaDesk.open(a); return; }
    if (hit('[data-shnearby]')) { SHR.near = !SHR.near; SHR.nearFound = 0; shDraw(); if (SHR.near) SHNEAR.forEach((_, i) => setTimeout(() => { if (!SHR.near) return; SHR.nearFound = i + 1; shDraw(); }, 700 + i * 700)); return; }
    const nd = hit('[data-shnear]'); if (nd) { SHR.sent['n:' + nd.dataset.shnear] = true; shDraw(); shToast(`Sent to ${nd.dataset.shnear}`); return; }
    const ac = hit('[data-shact]'); if (ac) { const k = ac.dataset.shact;
      if (k === 'copy' || k === 'copylink') { shCopied(k); shToast(k === 'copy' ? `${s.t} copied. Paste it into any folder or message.` : 'Link copied'); return; }
      shToast({ save: 'Choose where to save the copy', print: `Printing ${s.t} on Brother HL-L2350DW`, qr: 'Point a phone’s camera at the code' }[k]); if (k !== 'qr') shClose(); return; }
    const cp = hit('[data-shcopy]'); if (cp) { shCopied('link'); shToast('Link copied'); return; }
    const mn = hit('[data-shmenu]'); if (mn) { const v = mn.dataset.shmenu, k = /^\d+$/.test(v) ? +v : v; SHR.menu = SHR.menu === k ? null : k; shDraw(); return; }
    const pk = hit('[data-shpick]'); if (pk) { const [k, v] = pk.dataset.shpick.split(':'); if (k === 'lf') SHR.linkFor = v; else if (k === 'link') s.d.link = v; else s.d.people[+k][1] = v; SHR.menu = null; shDraw(); return; }
    const rm = hit('[data-shrm]'); if (rm) { const [k] = s.d.people.splice(+rm.dataset.shrm, 1)[0]; SHR.menu = null; s.sub = shSpec(SHR.anchor).sub; shDraw(); shToast(`${shFirst(k)} no longer has access`); return; }
    const ad = hit('[data-shadd]'); if (ad) { const k = ad.dataset.shadd; s.d.people.push([k, 'edit']); SHR.q = ''; s.sub = shSpec(SHR.anchor).sub; shDraw(); shToast(`${shFirst(k)} can edit. They’ll get a message.`); return; }
    if (SHR.menu !== null && !hit('.shmenu')) { SHR.menu = null; shDraw(); } }
  document.addEventListener('pointerdown', e => { if (!SHR.anchor) return; if (e.target.closest('#lshare, [data-share]')) return; shClose(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && SHR.anchor) { if (SHR.menu !== null) { SHR.menu = null; shDraw(); } else shClose(); } if (e.key === 'Enter' && e.target.matches?.('[data-shq]')) { const b = $('#lshare [data-shadd]'); if (b) b.click(); } });
  document.addEventListener('input', e => { if (e.target.matches?.('[data-shq]')) { SHR.q = e.target.value; shDraw(); } });
  /* The scrollers take the mouse wheel too, not only a trackpad's sideways swipe */
  /* ...and a mouse drag: grab the row and throw it. A drag never counts as a tap on what's under it. */
  document.addEventListener('pointerdown', e => { const sc = e.target.closest?.('.shscroll, .hscroll'); if (!sc || e.button !== 0) return; const x0 = e.clientX, l0 = sc.scrollLeft; let moved = false, vx = 0, lx = x0, lt = performance.now();
    const mv = ev => { const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 5) return; if (!moved) { moved = true; sc.classList.add('grab'); sc.style.scrollSnapType = 'none'; } sc.scrollLeft = l0 - dx; const t = performance.now(); vx = (ev.clientX - lx) / Math.max(1, t - lt); lx = ev.clientX; lt = t; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (!moved) return; sc.classList.remove('grab');
      let v = -vx * 16; const glide = () => { if (Math.abs(v) < .5) { sc.style.scrollSnapType = ''; return; } sc.scrollLeft += v; v *= .92; requestAnimationFrame(glide); }; glide();
      addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  document.addEventListener('wheel', e => { const sc = e.target.closest?.('.shscroll, .hscroll'); if (!sc || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault(); sc.scrollLeft += e.deltaY; }, { passive: false });

  /* A small menu anchored to any button, for the rare actions behind ··· */
  function lMenu(anchor, html) { $('#lmenu')?.remove(); const w = anchor.closest('.win'); w.insertAdjacentHTML('beforeend', `<div class="crpop" id="lmenu">${html}</div>`); const p = $('#lmenu'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(), up = r.top - wr.top > wr.height * .5;
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.right - wr.left - p.offsetWidth)) + 'px'; p.style.top = (up ? r.top - wr.top - p.offsetHeight - 8 : r.bottom - wr.top + 8) + 'px'; }
  document.addEventListener('pointerdown', e => { if ($('#lmenu') && !e.target.closest('#lmenu, [data-lmenu]')) $('#lmenu').remove(); }, true);

  /* ══ File card: one look for a file anywhere (a message, an email, a download) ═══
     The file's own face (a photo's thumbnail, or the app that opens it), its name, size and kind, and one Open. */
  const LFK = { deck: ['Stage presentation', 'presentations', 'Stage'], pdf: ['PDF document', 'viewer', 'Viewer'], sheet: ['Grid spreadsheet', 'spreadsheets', 'Grid'], img: ['Image', 'photos', 'Photos'], zip: ['ZIP archive', 'files', 'Filer'],
    md: ['Markdown', 'documents', 'Write'], doc: ['Write document', 'documents', 'Write'], iso: ['Disk image', 'files', 'Filer'], app: ['App to install', 'valet', 'Valet'], audio: ['Audio', 'music', 'Tide'], video: ['Video', 'video-editor', 'Reel'], note: ['Note', 'notes', 'Notes'] };
  /* The Open button, its label, its icon and what it does all name ONE app: the kind's default (LDEF), the same app Open in marks Default */
  const lAppI = a => $(`.dk[data-app="${a}"] img`)?.getAttribute('src') || A + 'files.svg', lAppN = a => $(`.dk[data-app="${a}"]`)?.getAttribute('aria-label') || 'Filer';
  const lFileApp = k => lAppN(LDEF[k] || 'filer');
  function lFile(f, o = {}) { const k = LFK[f.k] || LFK.zip, a = LDEF[f.k] || 'filer', tag = o.tag || 'span';
    return `<${tag} class="lfc${o.sel ? ' sel' : ''}${o.cls ? ' ' + o.cls : ''}"${tag === 'button' ? ' type="button"' : ''} ${o.attr || ''}><span class="lfth${f.src ? ' img' : ''}">${f.src ? `<img src="${f.src}" alt="">` : `<img src="${lAppI(a)}" alt="">`}${o.badge || ''}</span><span class="lftx"><b class="lmid" title="${esc(f.n)}">${lMid(f.n)}</b><small>${[f.sz, o.sub || k[0]].filter(Boolean).join(' · ')}</small>${o.extra || ''}</span>${o.act ?? `<span class="bt sm fill lopenb" role="button" tabindex="0" title="Open in ${lAppN(a)}" aria-label="Open in ${lAppN(a)}" ${o.open || `data-lui-open="${a}" data-lui-name="${esc(f.n)}"`}><img class="lappi" src="${lAppI(a)}" alt="">Open</span>`}</${tag}>`; }

  /* ══ LumaUI components (v70) ═══════════════════════════════════════════════════════════════
     The shared parts from the Studio audit. Each helper returns markup (or acts on one element); apps call these
     instead of writing their own. The LumaUI window (?app=lumaui) shows every one with its states. */

  /* LumaUI: Count badge. lCount(1284) is a total, shown exactly (1,284); lCount(2, true) is unread or needs attention, capped at 99+. Nothing for 0. */
  const lCount = (n, acc) => n ? `<em class="lcount${acc ? ' acc' : ''}">${acc ? (n > 99 ? '99+' : n) : n.toLocaleString('en-US')}</em>` : '';

  /* LumaUI: Details pane. The inside of <aside class="ldp">: lDP({ title, close: 'data-x', body }).
     Parts: lDP.kv([[key, value]]) facts with hairlines · lDP.lab(title, button) section label · lDP.row({ av, n, sub, attr, acts }) a person
     or thing with full-row hover and quiet actions (lDP.act) · lAddRow(label, attr) the "Add people" row. lDPShow opens and closes it. */
  const lDP = o => `<header class="ldph"><b>${esc(o.title || 'Details')}</b><button class="ib" type="button" ${o.close || ''} aria-label="Close" title="Close">${ic('x')}</button></header><div class="ldpb">${o.body || ''}</div>`;
  lDP.kv = rows => `<dl class="ldpkv">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  lDP.lab = (t, more = '') => `<h6 class="ldplab">${esc(t)}${more}</h6>`;
  lDP.row = o => `<div class="ldprow"><button class="ldpwho" type="button" ${o.attr || ''}>${o.av || ''}<span><b>${esc(o.n)}</b>${o.sub ? `<small title="${esc(o.sub)}">${esc(o.sub)}</small>` : ''}</span></button>${o.acts ? `<span class="ldpacts">${o.acts}</span>` : ''}</div>`;
  lDP.act = (icon, label, attr = '') => `<button class="ib" type="button" ${attr} title="${esc(label)}" aria-label="${esc(label)}">${ic(icon)}</button>`;
  const lAddRow = (label, attr = '', icon = 'user-plus', kbd = '') => `<button class="laddrow" type="button" ${attr}><span class="laddi">${ic(icon)}</span><b>${esc(label)}</b>${kbd ? `<kbd>${esc(kbd)}</kbd>` : ''}</button>`;
  /* Closed by default; Info opens it; it closes itself when its subject goes away. { main: true } is a pane that IS the app's main view (Calendar's day) and stays. */
  function lDPShow(pane, o) { if (!pane) return false; const on = !!(o.main || (o.open && o.subject)); if (o.main) pane.dataset.main = '';
    if (on && pane.hidden) { pane.hidden = false; pane.classList.remove('enter'); void pane.offsetWidth; pane.classList.add('enter'); } else if (!on) pane.hidden = true; return on; }

  /* LumaUI: Details pane item. A thing in a details-pane list (an event, a thread): its mark, a title, one quiet line, an optional trail;
     full-row hover like the people rows. lDPItem({ lead, n, sub, attr, style, trail }); sub and trail are markup. */
  function lDPItem(o) { return `<button class="ldpitem" type="button" ${o.attr || ''}${o.style ? ` style="${o.style}"` : ''}>${o.lead || ''}<span><b>${esc(o.n)}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</span>${o.trail || ''}</button>`; }

  /* LumaUI: Stacked button. lStack([{ icon, label, attr, danger, disabled }], 'sm'): icon on top, label below, in equal pairs or trios. */
  const lStack = (items, size = '', cls = '') => `<div class="lstks${size ? ' ' + size : ''}${cls ? ' ' + cls : ''}">${items.map(b => `<button class="lstk${b.danger ? ' danger' : ''}" type="button" ${b.attr || ''}${b.disabled ? ' disabled' : ''}>${ic(b.icon)}<span>${esc(b.label)}</span></button>`).join('')}</div>`;
  /* LumaUI: Contact actions. Contacts owns them; anywhere a person appears embeds this: lContactActs(personKey, { size: 'sm' }). */
  const lContactActs = (k, o = {}) => { const p = ppl(k) || {}, on = p.on || p.u; return lStack([['message-square', 'Message', 'message'], ['phone', 'Call', 'call'], ['video', 'Video', 'video', !on], ['mail', 'Email', 'email', !p.u]]
    .map(([icon, label, a, off]) => ({ icon, label, attr: `data-lui-ca="${a}" data-lui-p="${k}"`, disabled: off })), o.size || '', 'lcacts'); };

  /* LumaUI: Mini cards. The owning app's own card, shown elsewhere: a person (Contacts), an event (Calendar), a song (Tide), a place (Maps).
     Files use lFile (Filer). */
  const lContactCard = (k, o = {}) => { const p = ppl(k); return `<div class="lmini person"><span class="lmth">${av(k, 44)}</span><span><b>${esc(p.n)}</b><small>${p.u ? `<span class="onluma"><i></i>@${esc(p.u)} · On Luma</span>` : esc(p.phone || '')}</small></span>${lContactActs(k, { size: 'sm' })}</div>`; };
  const lEventCard = e => `<div class="lmini event" style="--eh:${e.h ?? 250}"><span class="lmth"><em>${esc(e.mon)}</em><strong>${esc(e.day)}</strong></span><span><b>${esc(e.t)}</b><small>${esc(e.when)}${e.where ? ' · ' + esc(e.where) : ''}</small></span><button class="bt sm" type="button" data-lui-todo="Added to Calendar">Add</button></div>`;
  const lSongCard = s => `<div class="lmini song"><span class="lmth"><img src="${s.img}" alt=""></span><span><b>${esc(s.t)}</b><small>${esc(s.a)} · ${esc(s.al)}</small></span><button class="lmplay" type="button" data-lui-todo="Playing in Tide" aria-label="Play in Tide" title="Play in Tide">${ic('play')}</button></div>`;
  const lPlaceCard = pl => `<div class="lmini place"><span class="lmth"><i>${ic(pl.icon || 'map-pin')}</i></span><span><b>${esc(pl.n)}</b><small>${esc(pl.addr)}${pl.eta ? ' · ' + esc(pl.eta) : ''}</small></span><button class="bt sm" type="button" data-lui-todo="Directions open in Maps">Directions</button></div>`;

  /* LumaUI: Selection bubble (Write's .selbar, shared). lBubble(bar, host, rect, html) shows it 10 above the selection, centred and kept
     inside host, flipping below near the top; it waits for a drag to finish. lBubble.hide(bar). Arrows move inside it; Esc hides it;
     Alt+F10 reaches it from the text. */
  function lBubble(bar, host, r, html) { if (lBubble.down) { lBubble.wait = [bar, host, r, html]; return; } if (html != null) bar.innerHTML = html;
    bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Formatting'); bar.classList.add('show');
    const hr = host.getBoundingClientRect(), bw = bar.offsetWidth, bh = bar.offsetHeight, below = r.top - hr.top - bh - 10 < 12;
    bar.classList.toggle('below', below); bar.style.left = Math.max(8, Math.min(hr.width - bw - 8, r.left + r.width / 2 - hr.left - bw / 2)) + 'px';
    bar.style.top = (below ? r.bottom - hr.top + 10 : r.top - hr.top - bh - 10) + 'px'; }
  lBubble.hide = bar => { bar?.classList.remove('show'); };
  document.addEventListener('pointerdown', e => { if (!e.target.closest?.('.selbar')) lBubble.down = true; }, true);
  document.addEventListener('pointerup', () => { lBubble.down = false; const w = lBubble.wait; lBubble.wait = null; if (w) setTimeout(() => { const s = getSelection(); if (s.rangeCount && !s.isCollapsed) lBubble(w[0], w[1], s.getRangeAt(0).getBoundingClientRect(), w[3]); }, 200); }, true);
  document.addEventListener('keydown', e => { const bar = e.target.closest?.('.selbar');
    if (bar && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const b = [...bar.querySelectorAll('button')], i = b.indexOf(document.activeElement); b[(i + (e.key === 'ArrowRight' ? 1 : -1) + b.length) % b.length]?.focus(); e.preventDefault(); }
    else if (bar && e.key === 'Escape') { lBubble.hide(bar); lBubble.ret?.focus(); }
    else if (e.altKey && e.key === 'F10') { const s = front()?.querySelector('.selbar.show'); if (s) { lBubble.ret = document.activeElement; s.querySelector('button')?.focus(); e.preventDefault(); } } });

  /* LumaUI: Action center. The bar grows in place: .fbar → .fbar.lac2 (double) → .lac (the editor, Charlie's reply) → .lacsplit.
     lAC.open(el) plays the rise; lAC.bind(el, collapse) makes Esc collapse it back to the bar, keeping what was typed. */
  const lAC = { open(el) { el.hidden = false; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }, bind(el, fn) { if (el) el._lacCollapse = fn; } };
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; const el = e.target.closest?.('.lac'); if (el && el._lacCollapse && !$('#lmenu, #cr-pop, #lc')) { e.preventDefault(); e.stopPropagation(); el._lacCollapse(); } }, true);

  /* The reference: Charlie's reply editor folds back to the bar on Esc and keeps the draft (reopening restores it) */
  lAC.bind($('#cr-comp'), () => { const d = CR.draft; if (!d || d.mode === 'new') return; const ed = $('#cr-comp .cr2ed'); if (ed) d.html = ed.innerHTML; CR.keep = d; CR.draft = null; crBody(); crBar(); setTimeout(() => $('#cr-bar [data-crexpand]')?.focus(), 60); });

  /* LumaUI: Mode switch. lModes([[key, label, icon]], cur, 'data-x'): icon plus label, for the top-right corner (.flo.lcorner). */
  const lModes = (items, cur, attr, label = 'Mode') => seg(items.map(([k, n, i]) => [k, `${ic(i)}<span>${esc(n)}</span>`, n]), cur, attr, label, 'lmodes');

  /* LumaUI: Open in. lOpenIn(anchor, kind, name) lists the apps that can open it (best Luma app first, the default marked, then Other app);
     lOpenBtn(kind, attr) is an Open button wearing the default app's icon, named "Open in <App>". */
  const LOPEN = { img: ['canvas', 'darkroom', 'viewer', 'photos'], pdf: ['viewer', 'write'], doc: ['write', 'viewer'], md: ['write', 'notes'], deck: ['stage', 'viewer'], sheet: ['grid'], video: ['reel', 'viewer'], audio: ['tide', 'session', 'memos'], zip: ['filer'], iso: ['disks', 'filer'], app: ['valet'] };
  const LDEF = { img: 'viewer', pdf: 'viewer', doc: 'write', md: 'write', deck: 'stage', sheet: 'grid', video: 'viewer', audio: 'tide', zip: 'filer', iso: 'disks', app: 'valet', note: 'notes' };
  function lOpenIn(anchor, kind, name = '') { const apps = LOPEN[kind] || ['filer'], def = LDEF[kind] || apps[0];
    lMenu(anchor, `<h6>Open in</h6>${apps.map(a => `<button class="crmi" type="button" data-lui-open="${a}" data-lui-name="${esc(name)}"><img class="lappi" src="${cfIco(a)}" alt=""><span>${esc(cfName(a))}</span>${a === def ? '<small>Default</small>' : ''}</button>`).join('')}<span class="crsep"></span>${crMi(`data-lui-open="other" data-lui-name="${esc(name)}"`, 'app-window', 'Other app…')}`);
    $('#lmenu')?.classList.add('lopenmenu', 'ldrawer'); }
  const lOpenBtn = (kind, attr = '', label = 'Open', cls = 'bt fill') => { const a = LDEF[kind] || 'filer'; return `<button class="${cls} lopenb" type="button" ${attr} title="Open in ${esc(cfName(a))}" aria-label="Open in ${esc(cfName(a))}"><img class="lappi" src="${cfIco(a)}" alt="">${label}</button>`; };
  /* The name keeps its extension when it's cut: "press-rel…ase.write" never loses ".write" */
  const lMid = n => { const m = String(n).match(/^(.+?)(.{0,5}\.[A-Za-z0-9]{1,6})$/); return m ? `<span>${esc(m[1])}</span><span>${esc(m[2])}</span>` : `<span>${esc(n)}</span>`; };

  /* LumaUI: Destructive dialog. lConfirm(win, { title, body, action: 'Delete', icon: 'trash-2', option, onOK(optionOn) }).
     For what can't come back; things you can undo use lToast with Undo instead. */
  function lConfirm(win, o) { lConfirm.close(true); if (!win) return; lConfirm.o = o; lConfirm.ret = document.activeElement;
    win.insertAdjacentHTML('beforeend', `<div class="lcscrim" id="lc-scrim"></div><div class="lconf" id="lc" role="alertdialog" aria-modal="true" aria-labelledby="lc-t" aria-describedby="lc-d"><span class="lcico">${ic(o.icon || 'trash-2')}</span><h2 id="lc-t">${esc(o.title)}</h2><p id="lc-d">${esc(o.body)}</p>${o.option ? `<button class="lcopt" type="button" role="checkbox" aria-checked="false" data-lui-copt><i>${ic('check')}</i>${esc(o.option)}</button>` : ''}<div class="lcacts2"><button class="bt fill" type="button" data-lui-cno>Cancel</button><button class="bt danger" type="button" data-lui-cok>${esc(o.action || 'Delete')}</button></div></div>`);
