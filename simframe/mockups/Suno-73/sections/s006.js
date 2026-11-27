      <div class="vwclip" style="width:${vw}px;height:${vh}px"><img id="vw-img" src="${f.src}" alt="" style="width:${W}px;height:${H}px;left:${c ? -c.x : 0}px;top:${c ? -c.y : 0}px;filter:${vwFilter(f.id)}" draggable="false"></div>
      <svg class="vwann" id="vw-ann" viewBox="${c ? `${c.x} ${c.y} ${c.w} ${c.h}` : `0 0 ${W} ${H}`}" preserveAspectRatio="none"></svg>
      ${VW.live && f.text ? `<div class="vwlive" style="width:${W}px;height:${H}px;left:${c ? -c.x : 0}px;top:${c ? -c.y : 0}px">${f.text.map(l => `<span class="${l.k ? 'dd ' + l.k : ''}" style="left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;font-size:${l.h * .92}px" ${l.k ? `data-vwdd="${l.k}"` : ''}>${esc(l.t)}</span>`).join('')}</div>` : ''}
      ${VW.cropping ? vwCropUI(f) : ''}</div>
      ${VW.pick ? `<div class="vwloupe" id="vw-loupe" hidden><i class="lp"></i><span></span></div>` : ''}`;
    $('#vw-zoom') && ($('#vw-zoom').textContent = Math.round(z * 100) + '%'); vwAnnDraw(); }
  function vwCropUI(f) { const [W, H] = vwNat(f), c = VW.cropBox || (VW.cropBox = { x: W * .08, y: H * .08, w: W * .84, h: H * .84 });
    return `<div class="vwcrop" id="vw-crop" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px"><i class="g1"></i><i class="g2"></i><i class="g3"></i><i class="g4"></i>${['nw', 'ne', 'sw', 'se'].map(k => `<b class="h ${k}" data-vwch="${k}"></b>`).join('')}</div>`; }

  /* The lease: a real-looking PDF with fields to fill and a line to sign. */
  function vwLease() { const fld = (k, ph, w = 220) => `<input class="vwfld" data-vwfld="${k}" placeholder="${ph}" style="width:${w}px" value="${esc((VW.fields || {})[k] || '')}">`;
    return `<article class="vwpage" data-page="1"><svg class="vwann pg" data-pgann="1" viewBox="0 0 612 792"></svg><h1>Commercial Lease Renewal</h1><p class="sub">Studio 4, 118 Alameda Avenue, Oakland, California</p>
        <p>This renewal (the “Renewal”) is made between <b>Marsh &amp; Co. Property</b> (“Landlord”) and ${fld('tenant', 'Tenant name')} (“Tenant”), and extends the lease dated ${fld('orig', 'Original lease date', 150)} on the terms below.</p>
        <h2>1. Term</h2><p>The term is extended for twelve (12) months, beginning January 1, 2027 and ending December 31, 2027.</p><h2>2. Rent</h2><p>Monthly rent remains <b>$4,850.00</b>, due on the first of each month. The annual rent review moves from January to March.</p><h2>3. Use</h2><p>The premises are to be used as a design and software studio, and for no other purpose without the Landlord’s written consent.</p><footer>Page 1 of 3</footer></article>
      <article class="vwpage" data-page="2"><svg class="vwann pg" data-pgann="2" viewBox="0 0 612 792"></svg><h2>4. Maintenance</h2><p>Tenant keeps the interior in good repair. Landlord maintains the roof, structure, and building systems, and responds to urgent repairs within two business days.</p><h2>5. Insurance</h2><p>Tenant carries general liability insurance of not less than $1,000,000 per occurrence and names Landlord as an additional insured.</p><h2>6. Notices</h2><p>Notices are given in writing to the addresses above, or by email to the addresses the parties have agreed.</p><footer>Page 2 of 3</footer></article>
      <article class="vwpage" data-page="3"><svg class="vwann pg" data-pgann="3" viewBox="0 0 612 792"></svg><h2>7. Everything else</h2><p>All other terms of the original lease remain in force. This Renewal may be signed electronically and in counterparts.</p>
        <div class="vwsigs"><div><span class="ln" data-vwsigline="t"></span><small>Tenant · Date ${fld('date', 'MM/DD/YYYY', 110)}</small></div><div><span class="ln"><i class="theirs">Theo Marsh</i></span><small>Landlord · September 21, 2026</small></div></div><footer>Page 3 of 3</footer></article>`; }

  /* ── Mark up: a layer beside the file, never in it ── */
  const vwList = () => (VW.ann[VW.cur] = VW.ann[VW.cur] || []);
  function vwShape(a, i) { const sel = VW.selA === i ? ' sel' : '', st = `stroke="${a.c}" stroke-width="${a.w}"`;
    if (a.t === 'pen' || a.t === 'hl') return `<path class="a${sel}${a.t === 'hl' ? ' hl' : ''}" data-ai="${i}" d="${a.d}" fill="none" ${st} stroke-linecap="round" stroke-linejoin="round"/>`;
    if (a.t === 'rect') return `<rect class="a${sel}" data-ai="${i}" x="${Math.min(a.x, a.x + a.W)}" y="${Math.min(a.y, a.y + a.H)}" width="${Math.abs(a.W)}" height="${Math.abs(a.H)}" rx="${a.w * 1.2}" fill="none" ${st}/>`;
    if (a.t === 'ellipse') return `<ellipse class="a${sel}" data-ai="${i}" cx="${a.x + a.W / 2}" cy="${a.y + a.H / 2}" rx="${Math.abs(a.W / 2)}" ry="${Math.abs(a.H / 2)}" fill="none" ${st}/>`;
    if (a.t === 'arrow') { const ang = Math.atan2(a.H, a.W), L = a.w * 4.5, ex = a.x + a.W, ey = a.y + a.H; return `<g class="a${sel}" data-ai="${i}"><line x1="${a.x}" y1="${a.y}" x2="${ex - Math.cos(ang) * L * .6}" y2="${ey - Math.sin(ang) * L * .6}" ${st} stroke-linecap="round"/><path d="M${ex},${ey} L${ex - L * Math.cos(ang - .45)},${ey - L * Math.sin(ang - .45)} L${ex - L * Math.cos(ang + .45)},${ey - L * Math.sin(ang + .45)} Z" fill="${a.c}"/></g>`; }
    if (a.t === 'text') return `<text class="a${sel}" data-ai="${i}" x="${a.x}" y="${a.y}" fill="${a.c}" font-size="${a.w * 6}" font-weight="650" font-family="Figtree, sans-serif" paint-order="stroke" stroke="${a.c === '#111111' ? '#fff' : 'rgba(0,0,0,.35)'}" stroke-width="${a.w * .5}">${esc(a.s)}</text>`;
    if (a.t === 'step') return `<g class="a${sel}" data-ai="${i}"><circle cx="${a.x}" cy="${a.y}" r="${a.w * 4}" fill="${a.c}" stroke="#fff" stroke-width="${a.w * .6}"/><text x="${a.x}" y="${a.y + a.w * 1.5}" text-anchor="middle" fill="${a.c === '#ffffff' ? '#111' : '#fff'}" font-size="${a.w * 4.2}" font-weight="700" font-family="Figtree, sans-serif">${a.n}</text></g>`;
    if (a.t === 'redact') return `<rect class="a${sel}" data-ai="${i}" x="${Math.min(a.x, a.x + a.W)}" y="${Math.min(a.y, a.y + a.H)}" width="${Math.abs(a.W)}" height="${Math.abs(a.H)}" fill="#0b0b0c"/>`;
    if (a.t === 'blur') return `<foreignObject class="a${sel}" data-ai="${i}" x="${Math.min(a.x, a.x + a.W)}" y="${Math.min(a.y, a.y + a.H)}" width="${Math.abs(a.W)}" height="${Math.abs(a.H)}"><div xmlns="http://www.w3.org/1999/xhtml" class="vwblur"></div></foreignObject>`;
    if (a.t === 'sig') return `<g class="a${sel}" data-ai="${i}" transform="translate(${a.x},${a.y}) scale(${a.s || 1})"><path d="${VWSIG}" fill="none" stroke="${a.c || '#1b2a6b'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    return ''; }
  const VWSIG = 'M2 30 C10 8 18 4 20 14 C22 26 12 40 10 34 C8 26 30 10 34 22 C36 30 30 34 34 28 C38 22 42 18 44 26 C46 32 50 22 54 20 C58 18 56 30 62 28 C66 26 70 16 74 22 C76 26 78 30 84 24 M60 38 C80 34 110 32 140 30';
  function vwAnnDraw() { const f = vwF(VW.cur); if (!f) return; const L = vwList();
    if (f.pdf) $$('#vw-stage svg[data-pgann]').forEach(s => s.innerHTML = L.map((a, i) => a.pg === +s.dataset.pgann ? vwShape(a, i) : '').join(''));
    else { const s = $('#vw-ann'); if (s) s.innerHTML = L.map(vwShape).join(''); }
    vwSide(); }
  /* Text goes where you click: a field opens right there (no dialog); Enter or clicking away places it, Esc drops it */
  function vwTextAt(e, st, done) { $('#vw-tin')?.remove(); const r = st.getBoundingClientRect();
    st.insertAdjacentHTML('beforeend', `<input class="vwtin" id="vw-tin" placeholder="Type here" aria-label="Text to place" spellcheck="false" style="left:${Math.round(e.clientX - r.left)}px;top:${Math.round(e.clientY - r.top)}px">`);
    const i = $('#vw-tin'); let over = false; const fin = keep => { if (over) return; over = true; const v = i.value.trim(); i.remove(); if (keep && v) done(v); };
    i.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); fin(true); } else if (ev.key === 'Escape') { ev.preventDefault(); fin(false); } });
    i.addEventListener('blur', () => fin(true)); setTimeout(() => i.focus()); }
  function vwPt(e, svg) { const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return [vb.x + (e.clientX - r.left) / r.width * vb.width, vb.y + (e.clientY - r.top) / r.height * vb.height]; }
  function vwDown(e) { const f = vwF(VW.cur); if (!f || VW.cmp) return; const st = $('#vw-stage'); if (!st.contains(e.target) || e.button) return;
    if (VW.cropping) return vwCropDrag(e);
    if (VW.pick && !f.pdf) { vwPickAt(e, true); return; }
    if (VW.mode !== 'markup') { if (!f.pdf && (VW.zoom || 0) > VW.fit && !e.target.closest('.vwlive')) { const sx = e.clientX, sy = e.clientY, p0 = VW.pan.slice(); const mv = ev => { VW.pan = [p0[0] + ev.clientX - sx, p0[1] + ev.clientY - sy]; $('#vw-doc').style.transform = $('#vw-doc').style.transform.replace(/translate\([^)]*\)\)/, `translate(calc(-50% + ${VW.pan[0]}px), calc(-50% + ${VW.pan[1]}px))`); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); vwStage(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); } return; }
    const svg = f.pdf ? e.target.closest('.vwpage')?.querySelector('svg') : $('#vw-ann'); if (!svg) return; if (e.target.closest('.vwfld, .vwtin')) return; e.preventDefault();
    const [x, y] = vwPt(e, svg), L = vwList(), pg = f.pdf ? +svg.dataset.pgann : 0, sc = f.pdf ? .5 : Math.max(1, vwNat(f)[0] / 900), w = VW.width * sc;
    if (VW.tool === 'select') { const hitA = e.target.closest('[data-ai]'); VW.selA = hitA ? +hitA.dataset.ai : null; vwAnnDraw(); vwBar(); if (!hitA) return; const a = L[VW.selA], [sx, sy] = [x, y], o = JSON.parse(JSON.stringify(a));
      const mv = ev => { const [nx, ny] = vwPt(ev, svg), dx = nx - sx, dy = ny - sy; if (a.d) a.d = o.d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (m, px, py) => `${(+px + dx).toFixed(1)},${(+py + dy).toFixed(1)}`); else { a.x = o.x + dx; a.y = o.y + dy; } vwAnnDraw(); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); return; }
    VW.redo[VW.cur] = [];
    if (VW.tool === 'text') { vwTextAt(e, $('#vw-stage'), s => { L.push({ t: 'text', x, y, c: VW.color, w, s, pg }); vwAnnDraw(); vwBar(); }); return; }
    if (VW.tool === 'step') { L.push({ t: 'step', x, y, c: VW.color, w, n: L.filter(a => a.t === 'step').length + 1, pg }); vwAnnDraw(); vwBar(); return; }
    if (VW.tool === 'sign') { L.push({ t: 'sig', x: x - 20, y: y - 36, s: f.pdf ? 1.1 : sc * 2.4, pg, c: '#1b2a6b' }); vwAnnDraw(); vwBar(); vwToast('Signed. The signature stays beside the file until you save a copy'); return; }
    const a = VW.tool === 'pen' || VW.tool === 'hl' ? { t: VW.tool, d: `M${x.toFixed(1)},${y.toFixed(1)}`, c: VW.tool === 'hl' ? VW.color + '66' : VW.color, w: VW.tool === 'hl' ? w * 3.2 : w, pg } : { t: VW.tool, x, y, W: 0, H: 0, c: VW.color, w, pg };
    L.push(a); const mv = ev => { const [nx, ny] = vwPt(ev, svg); if (a.d != null) a.d += ` L${nx.toFixed(1)},${ny.toFixed(1)}`; else { a.W = nx - x; a.H = ny - y; if (ev.shiftKey && (a.t === 'rect' || a.t === 'ellipse')) a.H = Math.sign(a.H || 1) * Math.abs(a.W); } vwAnnDraw(); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (a.W != null && Math.abs(a.W) < 4 && Math.abs(a.H) < 4) L.pop(); vwAnnDraw(); vwBar(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }

  /* ── Adjust: crop and light ── */
  function vwCropDrag(e) { const f = vwF(VW.cur), svg = $('#vw-ann'), h = e.target.closest('[data-vwch]'), inBox = e.target.closest('#vw-crop'); if (!svg || (!h && !inBox)) return; e.preventDefault();
    const [W, H] = vwNat(f), c = VW.cropBox, o = { ...c }, [sx, sy] = vwPt(e, svg), ar = { square: 1, '16:9': 16 / 9, '4:5': 4 / 5, orig: W / H }[VW.aspect];
    const mv = ev => { const [x, y] = vwPt(ev, svg), dx = x - sx, dy = y - sy;
      if (!h) { c.x = Math.max(0, Math.min(W - c.w, o.x + dx)); c.y = Math.max(0, Math.min(H - c.h, o.y + dy)); }
      else { const k = h.dataset.vwch; if (k.includes('w')) { c.x = Math.max(0, Math.min(o.x + o.w - 40, o.x + dx)); c.w = o.x + o.w - c.x; } if (k.includes('e')) c.w = Math.max(40, Math.min(W - o.x, o.w + dx)); if (k.includes('n')) { c.y = Math.max(0, Math.min(o.y + o.h - 40, o.y + dy)); c.h = o.y + o.h - c.y; } if (k.includes('s')) c.h = Math.max(40, Math.min(H - o.y, o.h + dy)); if (ar) { c.h = Math.min(c.w / ar, H - c.y); c.w = c.h * ar; } }
      Object.assign($('#vw-crop').style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px' }); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }
  function vwSetAspect(k) { const f = vwF(VW.cur), [W, H] = vwNat(f), ar = { square: 1, '16:9': 16 / 9, '4:5': 4 / 5, orig: W / H }[k]; VW.aspect = k; if (ar && VW.cropBox) { const c = VW.cropBox, cw = Math.min(W * .9, H * .9 * ar); c.w = cw; c.h = cw / ar; c.x = (W - c.w) / 2; c.y = (H - c.h) / 2; } vwStage(); vwBar(); }

  /* ── Pick a colour ── */
  let vwCv = null;
  function vwPickAt(e, commit) { const img = $('#vw-img'), lp = $('#vw-loupe'), f = vwF(VW.cur); if (!img || !lp) return; const r = img.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { lp.hidden = true; return; }
    if (!vwCv || vwCv.id !== f.id) { vwCv = document.createElement('canvas'); vwCv.id = f.id; vwCv.width = img.naturalWidth; vwCv.height = img.naturalHeight; vwCv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0); }
    const px = Math.floor((e.clientX - r.left) / r.width * vwCv.width), py = Math.floor((e.clientY - r.top) / r.height * vwCv.height), d = vwCv.getContext('2d').getImageData(px, py, 1, 1).data, hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    const sr = $('#vw-stage').getBoundingClientRect(); lp.hidden = false; Object.assign(lp.style, { left: (e.clientX - sr.left) + 'px', top: (e.clientY - sr.top) + 'px' });
    const lpi = lp.querySelector('.lp'), Z = 10; Object.assign(lpi.style, { backgroundImage: `url('${f.src}')`, backgroundSize: `${r.width * Z}px ${r.height * Z}px`, backgroundPosition: `${-(e.clientX - r.left) * Z + 60}px ${-(e.clientY - r.top) * Z + 60}px` }); lp.querySelector('span').innerHTML = `<i style="background:${hex}"></i>${hex}`;
    if (commit) { VW.picks = [hex, ...VW.picks.filter(x => x !== hex)].slice(0, 6); navigator.clipboard?.writeText(hex).catch(() => {}); vwToast(`Copied ${hex}`); vwBar(); } }

  /* ── Compare ── */
  function vwCompare() { const [a, b] = VW.cmp.map(vwF), st = $('#vw-stage'), m = VW.cmpMode;
    st.innerHTML = m === 'side' ? `<div class="vwcmp side"><figure><img src="${a.src}" alt=""><figcaption>${esc(a.n)}</figcaption></figure><figure><img src="${b.src}" alt=""><figcaption>${esc(b.n)}</figcaption></figure></div>`
      : `<div class="vwcmp ${m}" id="vw-cmp"><img src="${a.src}" alt="" class="base"><img src="${b.src}" alt="" class="top" style="${m === 'swipe' ? `clip-path:inset(0 0 0 ${VW.cmpX * 100}%)` : ''}">${m === 'swipe' ? `<i class="vwhandle" style="left:${VW.cmpX * 100}%"><b>${ic('chevrons-up-down')}</b></i><span class="vwlab l">${esc(a.n)}</span><span class="vwlab r">${esc(b.n)}</span>` : `<span class="vwlab l">Only what changed is bright</span>`}</div>`; }

  /* ── Information ── */
  /* The one SunoUI details pane (#17): closed until Information opens it, a drawer on a phone */
  function vwInfo() { const box = $('#vw-info'), f = vwF(VW.cur); $('#w-viewer').classList.toggle('noinfo', !VW.info); if (!lDPShow(box, { open: VW.info, subject: f && !f.gone })) return; const [W, H] = f.pdf ? [612, 792] : vwNat(f), L = (VW.ann[f.id] || []), adj = Object.values(VW.adj[f.id] || {}).some(v => v) || VW.crop[f.id] || VW.rot[f.id] || VW.flip[f.id];
    const rows = [['Kind', f.kind], ['Size', f.sz], [f.pdf ? 'Pages' : 'Dimensions', f.pdf ? '3 · US Letter' : `${W} × ${H}`], ['Modified', f.id === 'frame' ? '15 September 2026' : 'Today, 9:40 AM'], ['Where', f.where]];
    box.innerHTML = lDP({ title: 'Information', close: 'data-vwinfo', body: `<b class="vwiname">${esc(f.n)}</b><small class="vwis">${f.pdf ? 'PDF · 3 pages' : `${(W * H / 1e6).toFixed(1)} MP · ${W} × ${H}`}</small>
      ${lDP.kv(rows.map(([k, v]) => [k, esc(v)]))}
      ${f.exif ? lDP.lab('Camera') + lDP.kv([['Lens', '23 mm · ƒ/2'], ['Exposure', '1/250 s · ISO 400'], ['Taken', '21 September, 5:48 PM'], ['Place', 'Oakland, California']]) : ''}
      ${f.text ? `${lDP.lab('Text in this image')}<p class="vwnote">${f.text.length} lines found, including a date, a phone number and a total. Turn on Text to select them.</p>` : ''}
      ${L.length || adj ? `${lDP.lab('Changes')}<p class="vwnote">${(L.length ? `${L.length} mark${L.length > 1 ? 's' : ''}` : '') + (L.length && adj ? ' and ' : '') + (adj ? (L.length ? 'adjustments' : 'Adjustments') : '')}, kept beside the file. The original stays as you opened it until you save.</p>` : ''}
      ${L.length || adj ? `<div class="vwiact"><button class="bt fill" type="button" data-vwrevert>Revert</button>${vwSaveBtn(false)}</div>` : ''}` }); }

  /* ── The bar: the mode first, then what that mode needs ── */
  // Save is one key with its alternatives beside it: Save as a new file, Share, or Copy to the clipboard
  const vwSaveBtn = dis => `<span class="lsplit${dis ? ' dis' : ''}"><button type="button" data-vwsave1 ${dis ? 'disabled' : ''}>Save</button><i></i><button type="button" class="lsplitc" data-vwsavem data-lmenu ${dis ? 'disabled' : ''} aria-label="More ways to save">${ic('chevron-down')}</button></span>`;
  /* Viewer on a phone: the file fills the width on black. One bar in two rows: on top, the file (its thumbnail, name and
     size; tap for your recent files, which replaces the sidebar) and Information; under a hairline, what you do with it:
     Mark up, Adjust, Text (when it has some), Open in, Share. Mark up and Adjust keep their own bars, with Done. */
  const vwNarrow = () => { const w = $('#w-viewer'); return !!w?.clientWidth && w.clientWidth < 560; };
  function vwBarPhone(bar, f) { const X = VW.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    $('#vw-corner')?.setAttribute('hidden', ''); bar.classList.add('phnofit', 'vwphbar');
    const files = X === 'files' ? `<div class="fexp fmore2 vwfiles">${VWF.map(x => `<button class="fexr2${x.id === VW.cur ? ' on' : ''}${x.gone ? ' gone' : ''}" type="button" data-vwopen="${x.id}">${x.gone ? `<i class="vwth ph">${ic('image')}</i>` : x.pdf ? `<i class="vwth pdf"><span></span><span></span><span></span></i>` : `<i class="vwth" style="background-image:url('${x.src}')"></i>`}<span>${esc(x.n)}<small>${x.gone ? 'Moved or deleted' : x.sz}</small></span></button>`).join('')}<button class="fexr2" type="button" data-vwtodo="Filer opens as a picker">${ic('folder-open')}<span>Open a file</span></button></div>`
      : X === 'info' ? `<div class="fexp vwinfo2">${$('#vw-info').innerHTML || ''}</div>` : '';
    const top = `<div class="vwr1"><button class="vwfile2${X === 'files' ? ' on' : ''}" type="button" data-vwpx="files" aria-expanded="${X === 'files'}">${f.pdf ? `<i class="vwth pdf sm"><span></span><span></span></i>` : `<i class="vwth sm" style="background-image:url('${f.src}')"></i>`}<span><b>${esc(f.n)}</b><small>${f.sz}</small></span>${ic('chevron-down')}</button>${ib('data-vwpx="info"', 'info', 'Information', X === 'info')}</div>`;
    const row = VW.mode === 'view' ? `<div class="vwr2">${ib('data-vwmode="markup"', f.pdf ? 'signature' : 'pen-line', f.pdf ? 'Sign and mark' : 'Mark up')}${f.pdf ? '' : ib('data-vwmode="adjust"', 'sliders-horizontal', 'Adjust')}${f.text ? ib('data-vwlive', 'scan-text', 'Text', VW.live) : ''}${ib('data-vwopenin', 'square-arrow-out-up-right', 'Open in')}${ib('data-share', 'share-2', 'Share')}</div>` : '';
    bar.classList.toggle('phgrow', !!files);
    if (VW.mode !== 'view' || VW.cmp) return false;
    setBar(bar, files + top + row); return true; }
  function vwBar() { const f = vwF(VW.cur), bar = $('#vw-bar'); if (!f) return; let h;
    if (vwNarrow() && vwBarPhone(bar, f)) { vwPalette(); vwAdjPanel(); return; } if (vwNarrow() && VW.mode !== 'view') { bar.classList.add('phnofit', 'vwphbar', 'vwmodebar'); } else if (!vwNarrow()) bar.classList.remove('phnofit', 'vwphbar', 'phgrow', 'vwmodebar');
    vwCorner(f); const modes = '';
    if (VW.cmp) { const [a, b] = VW.cmp.map(vwF); h = `<span class="ctxc">${ic('columns-2')}Comparing<em>${esc(a.n.replace(/\.\w+$/, ''))} · ${esc(b.n.replace(/\.\w+$/, ''))}</em></span>${seg([['swipe', 'Swipe'], ['side', 'Side by side'], ['diff', 'Difference']], VW.cmpMode, 'data-vwcmpm', 'Compare')}<button class="ib" type="button" data-vwswap title="Swap">${ic('arrow-left-right')}</button><span class="vr"></span><button class="ib" type="button" data-vwcmpx title="Done">${ic('x')}</button>`; }
    else if (VW.mode === 'markup') { const L = vwList();
      h = `${VW.selA != null ? `<button class="ib" type="button" data-vwdel title="Delete mark">${ic('trash-2')}</button>` : ''}<button class="ib" type="button" data-vwundo title="Undo" ${L.length ? '' : 'disabled'}>${ic('undo')}</button><button class="ib" type="button" data-vwredo title="Redo" ${(VW.redo[VW.cur] || []).length ? '' : 'disabled'}>${ic('redo')}</button>${vwSaveBtn(!L.length)}`; }
    else if (VW.mode === 'adjust') { const a = VW.adj[VW.cur] || {};
      h = `${VW.cropping ? `${seg([['free', 'Free'], ['orig', 'Original'], ['square', 'Square'], ['16:9', '16:9'], ['4:5', '4:5']], VW.aspect, 'data-vwasp', 'Aspect')}<button class="bt" type="button" data-vwcropx>Cancel</button><button class="bt key" type="button" data-vwcropok>Crop</button>`
        : `<button class="bt" type="button" data-vwcrop>${ic('crop')}Crop</button><button class="ib" type="button" data-vwrot title="Rotate">${ic('rotate-ccw')}</button><button class="ib" type="button" data-vwflip title="Flip">${ic('arrow-left-right')}</button><span class="vr"></span><button class="bt" type="button" data-vwauto>${ic('wand-sparkles')}Auto</button><button class="ib" type="button" data-vwhold title="Hold to see the original">${ic('eye')}</button>${vwSaveBtn(false)}`}`; }
    else { const z = Math.round((VW.zoom || VW.fit) * 100);
      h = `${f.pdf ? `<span class="vwpg">3 pages</span>` : `<span class="vwzw"><button class="ib" type="button" data-vwz="-1" title="Zoom out" aria-label="Zoom out">${ic('minus')}</button><button class="vwzb" type="button" data-vwz="0" id="vw-zoom" title="Fit to window">${z}%</button><button class="ib" type="button" data-vwz="1" title="Zoom in" aria-label="Zoom in">${ic('plus')}</button></span><span class="vr"></span>
        ${f.text ? `<button class="bt${VW.live ? ' on' : ''} vwtext" type="button" data-vwlive>${ic('scan-text')}Text</button>` : ''}`}
`; }
    setBar(bar, h); if (vwNarrow() && VW.mode !== 'view' && !VW.cmp) bar.insertAdjacentHTML('afterbegin', `<button class="ib" type="button" data-vwmode="view" aria-label="Close" title="Close">${ic('x')}</button>`); vwPalette(); vwAdjPanel(); }
  /* Top right: the modes and the file itself (Open in, Share, Information), per the SunoUI placement rule */
  function vwCorner(f) { let c = $('#vw-corner'); if (!c) { $('#vw-main').insertAdjacentHTML('beforeend', '<div class="flo lcorner" id="vw-corner"></div>'); c = $('#vw-corner'); } c.hidden = !!VW.cmp;
    c.innerHTML = `${lModes([['view', 'View', 'eye'], ['markup', f.pdf ? 'Sign and mark' : 'Mark up', f.pdf ? 'signature' : 'pen-line'], ...(f.pdf ? [] : [['adjust', 'Adjust', 'sliders-horizontal']])], VW.mode, 'data-vwmode')}<button class="ib" type="button" data-vwopenin title="Open in" aria-label="Open in" aria-haspopup="menu">${ic('square-arrow-out-up-right')}</button><button class="ib" type="button" data-share title="Share" aria-label="Share">${ic('share-2')}</button><button class="ib${VW.info ? ' on' : ''}" type="button" data-vwinfo title="Information" aria-label="Information" aria-pressed="${!!VW.info}">${ic('info')}</button>`; requestAnimationFrame(segs); }
  function vwPalette() { const p = $('#vw-pal'), f = vwF(VW.cur), on = VW.mode === 'markup' && !VW.cmp; p.classList.toggle('on', on); if (!on) return;
    p.innerHTML = VWTOOLS.filter(([k]) => f.pdf ? ['select', 'hl', 'text', 'sign', 'redact', 'pen'].includes(k) : k !== 'sign' || true).map(([k, i, t]) => `<button class="ib${VW.tool === k ? ' on' : ''}" type="button" data-vwtool="${k}" title="${t}" aria-label="${t}">${ic(i)}</button>`).join('')
      + `<span class="vr"></span><button class="vwsty" type="button" data-vwsty data-lmenu title="Color and width" aria-label="Color and width"><i style="--c:${VW.color}"></i>${ic('chevron-down')}</button>`;
    const m = $('#lmenu .vwstyp'); if (m) { m.innerHTML = vwStyHTML(f); requestAnimationFrame(segs); } }
  const vwStyHTML = f => `<div class="vwcols">${VWCOL.map(c => `<button type="button" class="${VW.color === c ? 'on' : ''}" style="--c:${c}" data-vwcol="${c}" aria-label="Colour"></button>`).join('')}</div>${f.pdf ? '' : seg([['3', '<i class="vwwd s"></i>'], ['6', '<i class="vwwd m"></i>'], ['12', '<i class="vwwd l"></i>']], String(VW.width), 'data-vwwid', 'Width', 'ico')}`;
  function vwAdjPanel() { const p = $('#vw-adj'), on = VW.mode === 'adjust' && !VW.cmp && !VW.cropping; p.classList.toggle('on', on); if (!on) return; const a = VW.adj[VW.cur] || {};
    const any = Object.values(a).some(v => v); let grp = '';
    p.innerHTML = `<div class="vwah"><b>Adjust</b><button class="vwreset" type="button" data-vwreset ${any ? '' : 'disabled'}>Reset</button></div><div class="vwasc">${VWADJ.map(([k, n, lo, hi, g]) => `${g !== grp ? `${grp ? '<hr>' : ''}<h6>${(grp = g) === 'Straighten' ? '' : g}</h6>` : ''}<label class="vwsl"><span>${n}<em>${a[k] ? (a[k] > 0 ? '+' : '') + a[k] : '0'}</em></span><input type="range" min="${lo}" max="${hi}" value="${a[k] || 0}" data-vwadj="${k}"></label>`).join('')}</div>`; }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-vwq]')) { VW.q = e.target.value; vwSide(); const i = $('[data-vwq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
  const vwToast = (msg, icon) => lToast($('#w-viewer'), msg, { icon: icon || (/^Copied/.test(msg) ? 'copy' : /moved or deleted/.test(msg) ? 'triangle-alert' : 'check') });   // the SunoUI toast

  function vwClick(e, hit) { const q = s => hit(s), f = vwF(VW.cur);
    if (vwNarrow()) { const px = q('[data-vwpx]'); if (px) { const k = px.dataset.vwpx; VW.px = VW.px === k ? '' : k; if (k === 'info' && VW.px) { VW.info = true; vwInfo(); } vwBar(); return true; } if (q('[data-vwopen]') || q('[data-vwmode]') || q('[data-vwtodo]')) VW.px = ''; }
    const op = q('[data-vwopen]'); if (op) { const id = op.dataset.vwopen; if ((e.metaKey || e.ctrlKey || e.shiftKey) && !vwF(id).gone && !vwF(id).pdf) { VW.sel.has(id) ? VW.sel.delete(id) : VW.sel.add(id); VW.sel.add(VW.cur); if (VW.sel.size >= 2) { VW.cmp = [...VW.sel].slice(-2); VW.cmpMode = 'swipe'; VW.cmpX = .5; vwStage(); vwBar(); } vwSide(); return true; } VW.sel.clear(); vwOpen(id); return true; }
    const td = q('[data-vwtodo]'); if (td) { vwToast(td.dataset.vwtodo); return true; }
    const md = q('[data-vwmode]'); if (md) { VW.mode = md.dataset.vwmode; VW.cropping = false; VW.pick = false; VW.live = false; VW.selA = null; if (VW.mode === 'markup' && f.pdf) VW.tool = 'sign'; vwStage(); vwBar(); return true; }
    const tl = q('[data-vwtool]'); if (tl) { VW.tool = tl.dataset.vwtool; VW.selA = null; vwAnnDraw(); vwBar(); return true; }
    const sy = q('[data-vwsty]'); if (sy) { if ($('#lmenu')) { $('#lmenu').remove(); return true; } lMenu(sy, `<div class="vwstyp">${vwStyHTML(f)}</div>`); requestAnimationFrame(segs); return true; }
    const cl = q('[data-vwcol]'); if (cl) { VW.color = cl.dataset.vwcol; const L = vwList(); if (VW.selA != null && L[VW.selA]) { L[VW.selA].c = VW.color; vwAnnDraw(); } vwBar(); return true; }
    const wd = q('[data-vwwid]'); if (wd) { VW.width = +wd.dataset.vwwid; vwBar(); return true; }
    if (q('[data-vwundo]')) { const L = vwList(); if (L.length) (VW.redo[VW.cur] = VW.redo[VW.cur] || []).push(L.pop()); VW.selA = null; vwAnnDraw(); vwBar(); vwInfo(); return true; }
    if (q('[data-vwredo]')) { const r = VW.redo[VW.cur] || []; if (r.length) vwList().push(r.pop()); vwAnnDraw(); vwBar(); vwInfo(); return true; }
    if (q('[data-vwdel]')) { vwList().splice(VW.selA, 1); VW.selA = null; vwAnnDraw(); vwBar(); return true; }
    if (q('[data-vwsave1]')) { $('#lmenu')?.remove(); vwToast(`Saved ${f.n}. The original is kept in its history`); return true; }
    const svm = q('[data-vwsavem]'); if (svm) { if ($('#lmenu')) { $('#lmenu').remove(); return true; } lMenu(svm, crMi('data-vwsave', 'copy-plus', 'Save as…') + crMi('data-share', 'share-2', 'Share…') + crMi('data-vwclip', 'clipboard', 'Copy to clipboard')); return true; }
    if (q('[data-vwclip]')) { $('#lmenu')?.remove(); vwToast('Copied to the clipboard'); return true; }
    if (q('#lmenu [data-share]')) $('#lmenu')?.remove();
    if (q('[data-vwsave]')) { $('#lmenu')?.remove(); const n = f.n.replace(/(\.\w+)$/, ' (marked up)$1'); vwToast(`Saved a copy: ${n}${f.exif && VW.noLoc !== false ? ', without its location' : ''}${vwList().some(a => a.t === 'redact') ? '. Redacted areas are gone for good in the copy' : ''}`); return true; }
    if (q('[data-vwrevert]')) { VW.ann[f.id] = []; VW.adj[f.id] = {}; delete VW.crop[f.id]; VW.rot[f.id] = 0; VW.flip[f.id] = false; vwStage(); vwInfo(); vwBar(); vwToast('Back to the original'); return true; }
    const z = q('[data-vwz]'); if (z) { const k = +z.dataset.vwz, cur = VW.zoom || VW.fit; VW.zoom = k === 0 ? (VW.zoom && Math.abs(VW.zoom - 1) > .01 ? (VW.zoom === VW.fit ? 1 : 0) : (VW.zoom ? 0 : 1)) : Math.max(.1, Math.min(8, cur * (k > 0 ? 1.4 : 1 / 1.4))); if (!VW.zoom) VW.pan = [0, 0]; vwStage(); vwBar(); return true; }
    if (q('[data-vwlive]')) { VW.live = !VW.live; VW.pick = false; vwStage(); vwBar(); if (VW.live) vwToast('Select text in the image, or tap a highlighted item'); return true; }
    const dd = q('[data-vwdd]'); if (dd && getSelection().isCollapsed) { const k = dd.dataset.vwdd, t = dd.textContent; $('#vw-pop')?.remove(); const w = $('#w-viewer'), wr = w.getBoundingClientRect(), r = dd.getBoundingClientRect();
      w.insertAdjacentHTML('beforeend', `<div class="crpop" id="vw-pop">${{ date: crMi('data-vwddgo="Added to Calendar: Parcel & Post, Sep 18"', 'calendar', 'Add to Calendar'), tel: crMi('data-vwddgo="Calling (510) 555-0183 with your phone"', 'phone', 'Call') + crMi('data-vwddgo="Added to Contacts"', 'users', 'Add to Contacts'), money: crMi('data-vwddgo="Converted: €57.40, £48.90"', 'wallet', 'Convert currency'), addr: crMi('data-vwddgo="Opening in Maps"', 'map-pin', 'Open in Maps') }[k]}${crMi(`data-vwddgo="Copied"`, 'copy', `Copy “${esc(t)}”`)}</div>`);
      const p = $('#vw-pop'); p.style.left = Math.max(8, r.left - wr.left) + 'px'; p.style.top = (r.bottom - wr.top + 6) + 'px'; return true; }
    const dg = q('[data-vwddgo]'); if (dg) { $('#vw-pop')?.remove(); vwToast(dg.dataset.vwddgo); return true; }
    if (!q('#vw-pop')) $('#vw-pop')?.remove();
    if (q('[data-vwpick]') && !q('[data-vwcopy]')) { VW.pick = !VW.pick; VW.live = false; vwStage(); vwBar(); if (VW.pick) vwToast('Move over the image. Click to copy a colour'); return true; }
    const cp = q('[data-vwcopy]'); if (cp) { navigator.clipboard?.writeText(cp.dataset.vwcopy).catch(() => {}); vwToast('Copied ' + cp.dataset.vwcopy); return true; }
    const voi = q('[data-vwopenin]'); if (voi) { if ($('#lmenu')) { $('#lmenu').remove(); return true; } lOpenIn(voi, f.pdf ? 'pdf' : 'img', f.n); return true; }
    if (q('[data-vwinfo]')) { VW.info = !VW.info; vwInfo(); vwBar(); requestAnimationFrame(vwStage); return true; }
    if (q('[data-vwloc]')) { VW.noLoc = VW.noLoc === false; vwInfo(); return true; }
    if (q('[data-vwshare]')) { vwToast(`Share opens with ${f.exif ? 'location removed, ' : ''}PNG, JPEG, WebP and PDF`); return true; }
    if (q('[data-vwcrop]')) { VW.cropping = true; VW.cropBox = null; VW.aspect = 'free'; vwStage(); vwBar(); return true; }
    const asp = q('[data-vwasp]'); if (asp) { vwSetAspect(asp.dataset.vwasp); return true; }
    if (q('[data-vwcropx]')) { VW.cropping = false; vwStage(); vwBar(); return true; }
    if (q('[data-vwcropok]')) { VW.crop[f.id] = { ...VW.cropBox }; VW.cropping = false; VW.zoom = 0; vwStage(); vwBar(); vwInfo(); vwToast('Cropped. The original is untouched'); return true; }
    if (q('[data-vwrot]')) { VW.rot[f.id] = ((VW.rot[f.id] || 0) - 90) % 360; vwStage(); vwInfo(); return true; }
    if (q('[data-vwflip]')) { VW.flip[f.id] = !VW.flip[f.id]; vwStage(); vwInfo(); return true; }
    if (q('[data-vwauto]')) { VW.adj[f.id] = { exp: 12, con: 18, sat: 14, warm: 6, str: 0 }; vwStage(); vwBar(); vwInfo(); vwToast('Auto: a little brighter and richer'); return true; }
    if (q('[data-vwreset]')) { VW.adj[f.id] = {}; vwStage(); vwBar(); vwInfo(); return true; }
    const cm = q('[data-vwcmpm]'); if (cm) { VW.cmpMode = cm.dataset.vwcmpm; vwStage(); vwBar(); return true; }
    if (q('[data-vwswap]')) { VW.cmp.reverse(); vwStage(); vwBar(); return true; }
    if (q('[data-vwcmpx]')) { VW.cmp = null; VW.sel.clear(); vwSide(); vwStage(); vwBar(); return true; }
    const pg = q('[data-vwpage]'); if (pg) { { const sc = $('#vw-pscroll'), el = $(`#vw-pscroll .vwpage[data-page="${pg.dataset.vwpage}"]`); if (el) sc.scrollTo({ top: el.offsetTop - 60, behavior: 'smooth' }); } $$('.vwpages button').forEach(b => b.classList.toggle('on', b === pg)); return true; }
    return false; }
  function renderViewer() { const w = $('#w-viewer'); w.classList.toggle('lsideoff', !lSideOn(w)); $('#vw-top').innerHTML = `<img src="${A}viewer.svg" alt=""><b>Viewer</b><span class="chev">${ic('chevron-down')}</span>${lSideBtn(w)}`; vwOpen(VW.cur);
    const st = $('#vw-stage'); st.addEventListener('pointerdown', vwDown);
    st.addEventListener('pointermove', e => { if (VW.pick) vwPickAt(e, false); if (VW.cmp && VW.cmpMode === 'swipe' && e.buttons === 1) { const r = $('#vw-cmp').getBoundingClientRect(); VW.cmpX = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); $('#vw-cmp .top').style.clipPath = `inset(0 0 0 ${VW.cmpX * 100}%)`; $('#vw-cmp .vwhandle').style.left = VW.cmpX * 100 + '%'; } });
    st.addEventListener('pointerleave', () => { const l = $('#vw-loupe'); if (l) l.hidden = true; });
    st.addEventListener('wheel', e => { const f = vwF(VW.cur); if (!f || f.pdf || VW.cmp || !(e.ctrlKey || e.metaKey)) return; e.preventDefault(); VW.zoom = Math.max(.1, Math.min(8, (VW.zoom || VW.fit) * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); vwStage(); const zb = $('#vw-zoom'); if (zb) zb.textContent = Math.round(VW.zoom * 100) + '%'; }, { passive: false });
    new ResizeObserver(() => { if (!VW.cmp) vwStage(); }).observe(st); }
  document.addEventListener('input', e => { const a = e.target.closest?.('[data-vwadj]'); if (a) { const f = vwF(VW.cur); (VW.adj[f.id] = VW.adj[f.id] || {})[a.dataset.vwadj] = +a.value; a.previousElementSibling.querySelector('em').textContent = (+a.value > 0 ? '+' : '') + a.value; $('#vw-adj .vwreset')?.toggleAttribute('disabled', !Object.values(VW.adj[f.id]).some(v => v));
      if (a.dataset.vwadj === 'str') vwStage(); else $('#vw-img').style.filter = vwFilter(f.id); clearTimeout(vwInfo.t); vwInfo.t = setTimeout(vwInfo, 300); }
    const fl = e.target.closest?.('[data-vwfld]'); if (fl) (VW.fields = VW.fields || {})[fl.dataset.vwfld] = fl.value; });
  document.addEventListener('pointerdown', e => { if (e.target.closest?.('[data-vwhold]')) { VW.hold = true; $('#vw-img') && ($('#vw-img').style.filter = 'none'); const up = () => { VW.hold = false; const f = vwF(VW.cur); $('#vw-img') && ($('#vw-img').style.filter = vwFilter(f.id)); removeEventListener('pointerup', up); }; addEventListener('pointerup', up); } });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'viewer' || e.target.closest?.('input,textarea')) return; const L = VWF.filter(f => !f.gone), i = L.findIndex(f => f.id === VW.cur);
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); $(e.shiftKey ? '[data-vwredo]' : '[data-vwundo]')?.click(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' && VW.mode === 'view') { vwOpen(L[Math.min(L.length - 1, i + 1)].id); } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' && VW.mode === 'view') { vwOpen(L[Math.max(0, i - 1)].id); }
    else if ((e.key === 'Backspace' || e.key === 'Delete') && VW.selA != null) $('[data-vwdel]')?.click(); else if (e.key === 'Escape') { if (VW.cropping) $('[data-vwcropx]')?.click(); else if (VW.cmp) $('[data-vwcmpx]')?.click(); else if (VW.pick) $('[data-vwpick]')?.click(); } });

  /* ══ Valet ═══════════════════════════════════════════════════════════════════
     A valet takes your keys and gives you a ticket. Open an app file and Valet hands you one: the app,
     lit by its own colours, what it can use (tap to say no), and Install. The stub holds the facts.
     When it's done the app drives itself to the dock. Removing an app uses the same ticket. */
  const VLFMT = { flatpak: 'Flatpak', appimage: 'AppImage', deb: 'Debian package', rpm: 'RPM package', apk: 'Android app', exe: 'Windows app' };
  const VLA = [
    { id: 'kiln', n: 'Kiln', dev: 'Kiln Labs', ok: true, file: 'kiln-2.4.1.flatpakref', fmt: 'flatpak', v: '2.4.1', sz: '38 MB', inst: '214 MB', g: 'image', a: 'oklch(0.72 0.15 45)', b: 'oklch(0.52 0.16 20)', desc: 'Photo editor',
      runs: 'Runs in a sandbox. It sees only the photos and folders you give it.', src: 'Flathub', sig: 'Kiln Labs', perms: [['Network', 'globe', true, 'Syncs presets'], ['Pictures', 'image', true, 'Opens and saves photos'], ['Camera', 'camera', false, 'Tethered shooting'], ['Notifications', 'bell', true, '']], adds: [['file-text', 'Opens .jpg, .png, .tiff and camera raw files']], net: ['api.kilnlabs.app', 'presets.kilnlabs.app'], rt: 'org.freedesktop.Platform 24.08 (already installed, shared)' },
    { id: 'driftwood', n: 'Driftwood', dev: 'Driftwood Software', ok: true, file: 'driftwood_1.8.2_amd64.deb', fmt: 'deb', v: '1.8.2', sz: '64 MB', inst: '190 MB', g: 'notebook-pen', a: 'oklch(0.78 0.08 80)', b: 'oklch(0.55 0.09 60)', desc: 'Notes and outlines', have: '1.7.0',
      runs: 'Runs as a normal Suno app on a shared Debian 12 runtime that Suno keeps patched.', src: 'apt.driftwood.app', sig: 'Driftwood Software', perms: [['Home folder', 'folder', true, 'Command-line tools see your real files'], ['Network', 'globe', true, 'Sync']], adds: [['terminal', 'A command: driftwood'], ['bell', 'A background sync service (you’ll be asked first)'], ['file-text', 'Opens .md and .opml files']], net: ['sync.driftwood.app'], rt: 'Debian 12 runtime (shared with 4 other apps)', scripts: 'postinst ran in a recording sandbox. It tried to add a service and a command; both were turned into Suno equivalents.' },
    { id: 'labelpress', n: 'LabelPress', dev: 'LabelPress Inc.', ok: true, file: 'labelpress-driver-4.0.x86_64.rpm', fmt: 'rpm', v: '4.0.0', sz: '12 MB', inst: '41 MB', g: 'printer', a: 'oklch(0.7 0.02 250)', b: 'oklch(0.45 0.02 250)', desc: 'Label printer driver',
      runs: 'Runs on a Fedora 44 runtime. RPMs never change the system itself.', warn: 'USB printing won’t work: its kernel driver isn’t signed. Network printing will.', src: 'rpm.labelpress.com', sig: 'LabelPress Inc.', perms: [['Printers', 'printer', true, 'Adds a print queue'], ['USB devices', 'cpu', false, 'Needs the kernel driver']], adds: [['printer', 'A printer: LabelPress LP-2'], ['cpu', 'A kernel driver (DKMS), which can’t be loaded yet']], net: [], rt: 'Fedora 44 runtime (downloads on first use, 180 MB)', scripts: 'post-install asked to build a kernel module with DKMS. Suno skipped that step.' },
    { id: 'tessera', n: 'Tessera', dev: 'Unknown developer', ok: false, file: 'Tessera-0.9.3-x86_64.AppImage', fmt: 'appimage', v: '0.9.3', sz: '112 MB', inst: '112 MB', g: 'layout-grid', a: 'oklch(0.72 0.12 300)', b: 'oklch(0.5 0.14 280)', desc: 'Tile map editor',
      runs: 'Not signed. Valet runs it in a sandbox unless you turn that off.', sandbox: true, src: 'github.com', sig: '', perms: [['Documents', 'folder', true, ''], ['Network', 'globe', true, '']], adds: [['file-text', 'Opens .tmx files']], net: ['Not declared. Valet will show you what it connects to'] },
    { id: 'garden', n: 'Pixel Garden', dev: 'Small Sprout Games', ok: true, file: 'pixel-garden-3.1.apk', fmt: 'apk', v: '3.1', sz: '86 MB', inst: '150 MB', g: 'sunrise', a: 'oklch(0.8 0.14 130)', b: 'oklch(0.55 0.15 150)', desc: 'Game',
      runs: 'Runs in Suno’s Android layer, in its own space, like on a phone.', src: 'Signed APK', sig: 'Small Sprout Games', perms: [['Notifications', 'bell', true, 'Garden reminders'], ['Storage', 'folder', false, 'Save screenshots'], ['Location', 'map-pin', false, 'Weather in the garden']], adds: [], net: ['play.smallsprout.games'] },
    { id: 'ledger', n: 'Ledger 5', dev: 'Northfield Accounting', ok: true, file: 'Ledger5-Setup.exe', fmt: 'exe', v: '5.2', sz: '220 MB', inst: '640 MB', g: 'receipt', a: 'oklch(0.7 0.1 160)', b: 'oklch(0.45 0.1 180)', desc: 'Accounting',
      runs: 'Runs through Suno’s Windows layer in its own private space.', src: 'northfield.com', sig: 'Northfield Accounting', perms: [['Documents', 'folder', true, 'Company files'], ['Downloads', 'download', true, 'Bank statements'], ['Network', 'globe', true, 'Bank feeds']], adds: [['file-text', 'Opens .ldg files']], net: ['feeds.northfield.com'], rt: 'A private Windows space: 1.1 GB, shared by all Windows apps' }
  ];
  const VLI = [{ id: 'harbor', n: 'Harbor', fmt: 'flatpak', g: 'waves', a: 'oklch(0.7 0.1 220)', b: 'oklch(0.45 0.12 240)', when: '12 August', parts: [['App', 312, 1], ['Cache', 860, 1], ['Settings', 4, 0], ['Saved data', 38, 0]] },
    { id: 'driftwood', n: 'Driftwood', fmt: 'deb', g: 'notebook-pen', a: 'oklch(0.78 0.08 80)', b: 'oklch(0.55 0.09 60)', when: '2 September', v: '1.7.0', parts: [['App', 180, 1], ['Cache', 64, 1], ['Settings', 2, 0], ['Notes database', 210, 0]] }];
  const VL = { view: 'install', app: 'kiln', adv: false, prog: 0, step: '', done: false, rm: null, keep: true, removed: false, perms: {}, sandbox: true, when: '' };
  const vlA = id => VLA.find(a => a.id === id), vlI = id => VLI.find(a => a.id === id);
  const vlIcon = (a, sz) => `<span class="vlic" style="--a:${a.a};--b:${a.b};width:${sz}px;height:${sz}px">${ic(a.g)}</span>`;
  const vlMB = n => n >= 1000 ? (n / 1000).toFixed(2) + ' GB' : n + ' MB';
  const vlEditable = a => a.fmt === 'flatpak' || a.fmt === 'apk' || a.fmt === 'exe';

  /* Valet on a phone: one column, like a phone's install prompt. The app (icon, name, who made it), its facts as one
     strip, who signed it, then what it may use as switch rows. Advanced is a row that grows the bar. Install, Update,
     Remove or Open sit in the bar at the thumb, with Cancel beside them; progress runs inside the bar. */
  const vlNarrow = () => { const w = $('#w-valet'); return !!w?.clientWidth && w.clientWidth < 560; };
  function vlRenderPhone() { const b = $('#vl-body'), w = $('#w-valet'); w.classList.add('vlph'); let bar = $('#vl-phbar'); if (!bar) { $('#vl-main').insertAdjacentHTML('beforeend', '<div class="fbar vlphbar phnofit" id="vl-phbar"></div>'); bar = $('#vl-phbar'); }
    let page = '', row = '', panel = '';
    if (VL.view === 'home') { w.classList.add('blank'); page = `<div class="vlp-home"><span class="vldi">${ic('download')}</span><h1>Install an app</h1><p>Open a .flatpakref, .deb, .rpm, AppImage, .apk or .exe from Files or a download, and it opens here.</p></div>`; row = `<button class="bt pri vlp-wide" type="button" data-vlpick>${ic('folder-open')}<span>Choose a file</span></button>`; }
    else if (VL.view === 'install') { w.classList.remove('blank'); const a = vlA(VL.app), have = VLI.find(x => x.id === a.id), up = have?.v && have.v !== a.v, same = have && !up, busy = VL.prog > 0 && !VL.done, ed = vlEditable(a);
      w.style.setProperty('--a', a.a); w.style.setProperty('--b', a.b);
      const sw = (on, attr, off) => `<i class="cfsw${on ? ' on' : ''}"></i>`;
      const perms = a.perms.map(([n, i, on, why], k) => { const key = a.id + k, v = VL.perms[key] ?? on, can = ed && !busy && !VL.done; return `<button class="vlp-row" type="button" ${can ? `data-vlperm="${key}"` : 'disabled'}>${ic(i)}<span><b>${n}</b>${why ? `<small>${why}</small>` : ''}</span>${can ? sw(v) : `<em>${v ? 'Allowed' : 'Not allowed'}</em>`}</button>`; }).join('');
      page = `<header class="vlp-hd"><div class="vlhero${busy ? ' busy' : ''}${VL.done ? ' done' : ''}" id="vl-hero">${vlIcon(a, 96)}</div><h1>${esc(a.n)}</h1><p class="vtdev${a.ok ? '' : ' warn'}">${esc(a.desc)} · ${ic(a.ok ? 'shield-check' : 'triangle-alert')}${esc(a.dev)}</p>
          ${VL.done ? `<p class="vtdone">${ic('check')}Installed ${VL.when}. It’s in Apps.</p>` : same ? '<p class="vtnote">Already installed. Reinstalling keeps its settings.</p>' : up ? `<p class="vtnote">Update from ${have.v}. Settings and data stay.</p>` : ''}</header>
        <div class="vlp-facts">${[['Version', up ? `${have.v} → ${a.v}` : a.v], ['Size', a.inst], ['Format', VLFMT[a.fmt]], ['From', esc(a.src)]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
        <p class="vlp-sig ${a.sig ? 'ok' : 'warn'}">${ic(a.sig ? 'shield-check' : 'triangle-alert')}${a.sig ? `Signed by ${esc(a.sig)}` : 'Not signed'}<span class="mono">${esc(a.file)}</span></p>
        ${a.warn && !VL.done ? `<p class="vtwarn">${ic('triangle-alert')}${esc(a.warn)}</p>` : ''}
        <h6 class="vlp-h">What it can use${ed && !busy && !VL.done ? '<span>Tap to allow or block</span>' : ''}</h6>
        <div class="vlp-list">${a.sandbox ? `<button class="vlp-row" type="button" ${busy || VL.done ? 'disabled' : 'data-vlsand'}>${ic(VL.sandbox ? 'shield' : 'shield-off')}<span><b>${VL.sandbox ? 'Sandboxed' : 'Not sandboxed'}</b><small>${VL.sandbox ? 'Sees Documents and files you open' : 'Sees your whole home folder'}</small></span>${busy || VL.done ? '' : sw(VL.sandbox)}</button>` : ''}${perms}</div>
        <div class="vlp-list"><button class="vlp-row" type="button" data-vlpx="adv">${ic('list')}<span><b>Advanced</b><small>How it runs, network, package</small></span>${ic('chevron-right')}</button></div>`;
      panel = VL.px === 'adv' ? `<div class="fexp vlp-adv">${vlAdvanced(a).replace('class="vladv', 'class="vladv on')}</div>` : '';
      row = VL.done ? `<button class="bt fill vlp-half" type="button" data-vlcancel>Done</button><button class="bt pri vlp-half" type="button" data-vltodo="Opening ${esc(a.n)}">Open ${esc(a.n)}</button>`
        : busy ? `<div class="vlprog vlp-prog"><i style="width:${VL.prog}%"></i><span>${VL.step}</span></div>`
        : `<button class="bt fill vlp-half" type="button" data-vlcancel>Cancel</button><button class="bt pri vlp-half" type="button" data-vlgo>${same ? 'Reinstall' : up ? 'Update' : 'Install'}</button>`; }
    else { w.classList.remove('blank'); const a = vlI(VL.rm), all = a.parts.reduce((t, p) => t + p[1], 0), free = VL.keep ? a.parts.filter(p => p[2]).reduce((t, p) => t + p[1], 0) : all; w.style.setProperty('--a', a.a); w.style.setProperty('--b', a.b);
      page = `<header class="vlp-hd"><div class="vlhero${VL.removed ? ' gone' : ''}" id="vl-hero">${vlIcon(a, 96)}</div><h1>${VL.removed ? `${a.n} removed` : `Remove ${a.n}?`}</h1><p class="vtdev">${VLFMT[a.fmt]} · installed ${a.when}</p>${VL.removed ? `<p class="vtdone">${ic('check')}${vlMB(free)} freed</p>` : ''}</header>
        ${VL.removed ? '' : `<div class="vlp-list">${[['1', 'Keep settings and data', 'Reinstalling picks up where you left off'], ['0', 'Remove everything', 'Settings, caches and saved data go too']].map(([k, n, sub]) => `<button class="vlp-row" type="button" data-vlkeep="${k}">${ic((VL.keep ? '1' : '0') === k ? 'circle-check' : 'circle')}<span><b>${n}</b><small>${sub}</small></span></button>`).join('')}</div>`}
        <h6 class="vlp-h">Stored on this phone</h6><div class="vlp-list">${a.parts.map(([n, sz, goes]) => { const g = !VL.keep || goes; return `<div class="vlp-row st ${VL.removed && g ? 'gone' : g ? 'goes' : 'stays'}"><span><b>${n}</b></span><em>${vlMB(sz)}${VL.removed ? '' : ` · ${g ? 'removed' : 'kept'}`}</em></div>`; }).join('')}</div>
        <p class="vlp-total"><span>${VL.removed ? 'Freed' : 'Frees'}</span><b>${vlMB(free)}</b></p>`;
      row = VL.removed ? `<button class="bt pri vlp-wide" type="button" data-vlcancel>Done</button>` : `<button class="bt fill vlp-half" type="button" data-vlcancel>Cancel</button><button class="bt vlp-half vlp-red" type="button" data-vlrmgo>Remove</button>`; }
    b.innerHTML = `<div class="vlp">${page}</div>`; bar.classList.toggle('phgrow', !!panel); setBar(bar, panel + row); }
  function vlRender() { const b = $('#vl-body'), w = $('#w-valet'); let main = '', stub = '', lit = null;
    if (vlNarrow()) return vlRenderPhone(); w.classList.remove('vlph'); $('#vl-phbar')?.remove();
    if (VL.view === 'home') {
      w.style.removeProperty('--a'); w.style.removeProperty('--b'); w.classList.add('blank');
      b.innerHTML = `<div class="vtmain vtdrop"><span class="vldi">${ic('download')}</span><b>Drop an app here</b><button class="bt key" type="button" data-vlpick>Choose a file…</button></div>
        <aside class="vtstub ghost">${'<div><i></i><i></i></div>'.repeat(5)}</aside>`; return; }
    w.classList.remove('blank');
    if (VL.view === 'install') { const a = lit = vlA(VL.app), have = VLI.find(x => x.id === a.id), up = have?.v && have.v !== a.v, same = have && !up, busy = VL.prog > 0 && !VL.done, ed = vlEditable(a);
      const chip = ([n, i, on], k) => { const key = a.id + k, v = VL.perms[key] ?? on; return `<button type="button" class="vtcan${v ? ' on' : ''}" ${ed && !busy && !VL.done ? `data-vlperm="${key}"` : 'disabled'} title="${v ? `${n}: allowed` : `${n}: not allowed`}">${ic(i)}${n}</button>`; };
      main = `<header class="vthd"><div class="vlhero${busy ? ' busy' : ''}${VL.done ? ' done' : ''}" id="vl-hero">${vlIcon(a, 72)}</div>
          <div><h1>${esc(a.n)}</h1><p class="vtdev${a.ok ? '' : ' warn'}">${esc(a.desc)} · ${ic(a.ok ? 'shield-check' : 'triangle-alert')}${esc(a.dev)}</p></div></header>
        <div class="vtmid">${VL.done ? `<p class="vtdone">${ic('check')}In Apps</p>` : same ? '<p class="vtnote">Already installed. Reinstalling keeps its settings.</p>' : up ? `<p class="vtnote">Update from ${have.v}. Settings and data stay.</p>` : ''}
          <div class="vtcanrow"><span>Permissions${ed && !busy && !VL.done ? '<em>Tap to allow or block</em>' : ''}</span>${a.sandbox ? `<button type="button" class="vtcan sand${VL.sandbox ? ' on' : ''}" ${busy || VL.done ? 'disabled' : 'data-vlsand'} title="${VL.sandbox ? 'Sees Documents and files you open' : 'Sees your whole home folder'}">${ic(VL.sandbox ? 'shield' : 'shield-off')}${VL.sandbox ? 'Sandboxed' : 'Not sandboxed'}</button>` : ''}${a.perms.map(chip).join('')}</div>
          ${a.warn && !VL.done ? `<p class="vtwarn">${ic('triangle-alert')}${esc(a.warn)}</p>` : ''}</div>
        <div class="vtact">${VL.done ? `<button class="bt key" type="button" data-vltodo="Opening ${esc(a.n)}">Open ${esc(a.n)}</button><button class="bt quiet" type="button" data-vlcancel>Done</button>`
          : busy ? `<div class="vlprog"><i style="width:${VL.prog}%"></i><span>${VL.step}</span></div>`
          : `<button class="bt key" type="button" data-vlgo>${same ? 'Reinstall' : up ? 'Update' : 'Install'}</button><button class="bt quiet" type="button" data-vlcancel>Cancel</button>`}</div>`;
      const f = (k, v, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><dt>${k}</dt><dd>${v}</dd></div>`;
      stub = `${VL.done ? `<p class="vtstamp">${ic('check')}Installed ${VL.when}</p>` : `<p class="vtfile" title="${esc(a.file)}">${esc(a.file)}</p>`}
        <dl class="vtpairs">${f('Version', up ? `${have.v} → ${a.v}` : a.v)}${f('Size', a.inst)}${f('Format', VLFMT[a.fmt])}${f('From', esc(a.src))}${f('Signed by', a.sig ? `${ic('shield-check')}${esc(a.sig)}` : 'Not signed', 'wide ' + (a.sig ? 'ok' : 'warn'))}</dl>
        <button class="bt sm vtadv" type="button" data-vladv>Advanced</button>`; }
    else { const a = lit = vlI(VL.rm), all = a.parts.reduce((s, p) => s + p[1], 0), free = VL.keep ? a.parts.filter(p => p[2]).reduce((s, p) => s + p[1], 0) : all;
      main = `<header class="vthd"><div class="vlhero${VL.removed ? ' gone' : ''}" id="vl-hero">${vlIcon(a, 72)}</div><div><h1>${VL.removed ? `${a.n} removed` : `Remove ${a.n}?`}</h1><p class="vtdev">${VLFMT[a.fmt]} · installed ${a.when}</p></div></header>
        <div class="vtmid">${VL.removed ? `<p class="vtdone">${ic('check')}${vlMB(free)} freed</p>` : `<div class="vtpick"><button type="button" class="vtcan${VL.keep ? ' on' : ''}" data-vlkeep="1">Keep settings and data</button><button type="button" class="vtcan${VL.keep ? '' : ' on'}" data-vlkeep="0">Remove everything</button></div>
          <p class="vtnote">Files in Documents and Pictures aren’t touched.</p>`}</div>
        <div class="vtact">${VL.removed ? '<button class="bt key" type="button" data-vlcancel>Done</button>' : `<button class="bt danger" type="button" data-vlrmgo>Remove ${esc(a.n)}</button><button class="bt quiet" type="button" data-vlcancel>Cancel</button>`}</div>`;
      stub = `<p class="vtfile">Stored on this computer</p><dl>${a.parts.map(([n, s, goes]) => { const g = !VL.keep || goes; return `<div class="${VL.removed && g ? 'gone' : g ? 'goes' : 'stays'}"><dt>${n}</dt><dd>${vlMB(s)}${VL.removed ? '' : `<em>${g ? 'removed' : 'kept'}</em>`}</dd></div>`; }).join('')}</dl>
        <p class="vttotal"><span>${VL.removed ? 'Freed' : 'Frees'}</span><b>${vlMB(free)}</b></p>`; }
    w.style.setProperty('--a', lit.a); w.style.setProperty('--b', lit.b);
    b.innerHTML = `<div class="vtmain">${main}</div><aside class="vtstub">${stub}</aside>${VL.view === 'install' ? vlAdvanced(lit) : ''}`; }

  function vlAdvanced(a) { const sect = (t, body) => `<section><h6>${t}</h6>${body}</section>`, row = (k, v, mono) => `<div><dt>${k}</dt><dd${mono ? ' class="mono"' : ''}>${v}</dd></div>`;
    return `<div class="vladv${VL.adv ? ' on' : ''}"><header><b>Advanced</b><span>${esc(a.file)}</span><button class="ib" type="button" data-vladv title="Close">${ic('x')}</button></header><div class="scr">
      ${sect('How it runs', `<p>${esc(a.runs)}</p>${a.rt ? `<dl>${row('Runtime', esc(a.rt))}</dl>` : ''}${a.scripts ? `<p class="vlfine">${ic('terminal')}${esc(a.scripts)}</p>` : ''}`)}
      ${sect('Permissions', `<div class="vlperms">${a.perms.map(([n, i, on, why], k) => `<div class="vlperm">${ic(i)}<span><b>${n}</b>${why ? `<small>${why}</small>` : ''}</span><em>${(VL.perms[a.id + k] ?? on) ? 'Allowed' : 'Not allowed'}</em></div>`).join('')}</div>`)}
      ${a.adds.length ? sect('What it adds to Suno', `<ul class="vladds">${a.adds.map(([i, t]) => `<li>${ic(i)}${esc(t)}</li>`).join('')}</ul>`) : ''}
      ${sect('Network', `<ul class="vladds">${(a.net.length ? a.net : ['Doesn’t use the network']).map(d => `<li>${ic('globe')}${esc(d)}</li>`).join('')}</ul>`)}
      ${sect('Package', `<dl>${row('Architecture', a.fmt === 'apk' ? 'arm64, x86_64' : 'x86_64')}${row('Download', a.sz)}${row('Installed size', a.inst)}${row('SHA-256', `<button type="button" class="vlsha" data-vltodo="Copied the checksum">9f2c 41ab 7e08 … c3d1 ${ic('copy')}</button>`, 1)}</dl>`)}
    </div></div>`; }

  const VLSTEPS = { flatpak: ['Checking the signature', 'Downloading from Flathub', 'Setting up the sandbox', 'Adding it to Apps'], deb: ['Checking the signature', 'Matching a Debian 12 runtime', 'Running install scripts in a sandbox', 'Adding it to Apps'], rpm: ['Checking the signature', 'Downloading the Fedora 44 runtime', 'Running install scripts in a sandbox', 'Adding it to Apps'], appimage: ['Checking the file', 'Setting up the sandbox', 'Adding it to Apps'], apk: ['Checking the signature', 'Preparing the Android layer', 'Adding it to Apps'], exe: ['Checking the signature', 'Preparing a Windows space', 'Running the installer', 'Adding it to Apps'] };
  function vlInstall() { const a = vlA(VL.app), steps = VLSTEPS[a.fmt]; let i = 0; VL.adv = false;
    const tick = () => { if (VL.view !== 'install' || VL.app !== a.id) return; VL.step = steps[Math.min(steps.length - 1, Math.floor(i / 100 * steps.length))]; VL.prog = Math.max(3, i);
      const bar = $('#vl-body .vlprog'); if (bar) { bar.querySelector('i').style.width = VL.prog + '%'; bar.querySelector('span').textContent = VL.step; } else vlRender();
      if (i >= 100) { const have = VLI.find(x => x.id === a.id); if (have) have.v = a.v; else VLI.unshift({ id: a.id, n: a.n, fmt: a.fmt, g: a.g, a: a.a, b: a.b, when: 'today', v: a.v, parts: [['App', parseInt(a.inst), 1], ['Cache', 0, 1], ['Settings', 1, 0], ['Saved data', 0, 0]] });
        VL.when = 'today, ' + new Date().toTimeString().slice(0, 5); setTimeout(() => { VL.done = true; VL.prog = 0; vlPark(a); vlRender(); }, 250); return; }
      i = Math.min(100, i + 4 + Math.random() * 7); setTimeout(tick, 140); };
    tick(); }
  // The app drives itself into Apps: the icon lifts off the ticket and lands in the Apps button on the shelf.
  function vlPark(a) { const from = $('#vl-hero .vlic'); if (!from) return; const r = from.getBoundingClientRect(), dest = $('.shelf .l .sb'), shown = dest && dest.getClientRects().length > 0;   // the shelf is fixed, so offsetParent is always null
    const t = shown ? dest.getBoundingClientRect() : { left: r.left + r.width / 2 - 16, top: innerHeight + 40, width: 32, height: 32 }, s = 22 / r.width;
    const fly = from.cloneNode(true); Object.assign(fly.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', margin: 0, zIndex: 9999, pointerEvents: 'none' }); document.body.appendChild(fly);
    const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
    fly.animate([{ transform: 'none' }, { transform: `translate(${dx * .3}px, ${dy * .1 - 50}px) scale(.7)`, offset: .4 }, { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: .2 }], { duration: 900, easing: 'cubic-bezier(.45, 0, .2, 1)' })
      .onfinish = () => { fly.remove(); if (shown) dest.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(.95)' }, { transform: 'scale(1)' }], { duration: 480, easing: 'ease-out' }); }; }
  function vlToast(msg) { lToast($('#w-valet'), msg, { icon: /^Opening|^Opens/.test(msg) ? 'square-arrow-out-up-right' : 'check' }); }   // the SunoUI toast
  function vlPop(anchor, html) { $('#vl-pop')?.remove(); const w = $('#w-valet'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop vlpop" id="vl-pop">${html}</div>`); const p = $('#vl-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left + r.width / 2 - p.offsetWidth / 2)) + 'px'; p.style.top = (r.bottom - wr.top + 6) + 'px'; }
  function vlClick(e, hit) { const q = s => hit(s);
    if (vlNarrow()) { if (q('[data-vlpx]')) { VL.px = VL.px === 'adv' ? '' : 'adv'; vlRender(); return true; } if (q('#vl-phbar [data-vladv]')) { VL.px = ''; vlRender(); return true; } if (q('[data-vlgo]') || q('[data-vlcancel]') || q('[data-vlrmgo]')) VL.px = ''; }
    if (q('button[disabled]')) return true;
    if (q('.vlmenu')) return true;   // the menu opened on pointer-down; its own click must not close it
    if (!q('#vl-pop')) $('#vl-pop')?.remove();
    const pk = q('[data-vlpick]'); if (pk) { vlPop(pk, '<h6>Downloads</h6>' + VLA.map(a => crMi(`data-vlopen="${a.id}"`, 'file-text', esc(a.file))).join('')); return true; }
    const op = q('[data-vlopen]'); if (op) { $('#vl-pop')?.remove(); Object.assign(VL, { view: 'install', app: op.dataset.vlopen, adv: false, prog: 0, done: false, sandbox: true }); vlRender(); return true; }
    if (q('[data-vlcancel]')) { $('#vl-pop')?.remove(); Object.assign(VL, { view: 'home', prog: 0, done: false, removed: false, adv: false }); vlRender(); return true; }
    if (q('[data-vladv]')) { VL.adv = !VL.adv; $('#vl-body .vladv')?.classList.toggle('on', VL.adv); return true; }
    if (q('[data-vlgo]')) { vlInstall(); return true; }
    if (q('[data-vlsand]')) { VL.sandbox = !VL.sandbox; vlRender(); return true; }
    const pm = q('[data-vlperm]'); if (pm) { const k = pm.dataset.vlperm, a = vlA(VL.app), idx = +k.slice(a.id.length); VL.perms[k] = !(VL.perms[k] ?? a.perms[idx][2]); vlRender(); return true; }
    const rm = q('[data-vlrm]'); if (rm) { $('#vl-pop')?.remove(); Object.assign(VL, { view: 'remove', rm: rm.dataset.vlrm, keep: true, removed: false }); vlRender(); return true; }
    const kp = q('[data-vlkeep]'); if (kp) { VL.keep = kp.dataset.vlkeep === '1'; vlRender(); return true; }
    if (q('[data-vlrmgo]')) { VL.removed = true; vlRender(); const i = VLI.findIndex(x => x.id === VL.rm); setTimeout(() => { if (i >= 0 && VL.removed) VLI.splice(i, 1); }, 0); return true; }
    const td = q('[data-vltodo]'); if (td) { vlToast(td.dataset.vltodo); return true; }
    return false; }
  function renderValet() { $('#vl-top').innerHTML = `<img src="${A}valet.svg" alt=""><b>Valet</b><button class="chev vlmenu" type="button" aria-label="Valet menu">${ic('chevron-down')}</button>`; vlRender();
    $('#vl-top .vlmenu').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if ($('#vl-pop')) { $('#vl-pop').remove(); return; }
      vlPop(e.currentTarget, crMi('data-vlcancel', 'download', 'Install an app…') + '<span class="crsep"></span><h6>Remove</h6>' + VLI.map(a => crMi(`data-vlrm="${a.id}"`, 'trash-2', `${a.n}…`)).join('')); }); }

  /* ══ Memos ═══════════════════════════════════════════════════════════════════
     Say it, and find it again. Every recording is transcribed; the words light up as it plays, and any
     word takes you to that moment. Search looks inside what was said, not just the titles.
     The recording sits in a deck: a deep well holding the waveform and the transport, like a tape deck set
     into the page. The floating bar says which memo it's on and keeps Record as its key. */
  const meSeed = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296); };
  const meWave = (id, n, music) => { const r = meSeed(id); let v = .4; return Array.from({ length: n }, (_, i) => { v = Math.max(.08, Math.min(1, v + (r() - .5) * (music ? .25 : .5))); const gap = !music && r() < .06 ? .06 : 0; return gap || v * (.55 + .45 * Math.sin(i / (music ? 3 : 7)) ** 2); }); };
  const MEM = [
    { id: 'dry', t: 'Launch dry run', when: 'Today, 9:52 AM', grp: 'Today', dur: 252, where: 'Studio', fav: true, marks: [64, 171],
      tx: [['You', 'Okay, dry run for the launch walkthrough. Priya opens with the milestones slide, then I do the live demo.'], ['Priya', 'Keep the demo under two minutes. Start with Filer, because everyone gets it instantly.'], ['You', 'Then Messages, then the shelf. The notification lip is the moment people will remember.'], ['Nora', 'We need the homepage crop on screen while you talk about Tide.'], ['You', 'Good. Last thing: the ISO link goes live at seven thirty sharp, not before.']] },
    { id: 'lip', t: 'Idea: notifications as a lip', when: 'Today, 8:14 AM', grp: 'Today', dur: 48, where: 'Walking',
      tx: [['You', 'What if notifications drop out of the top edge like the drawers in Write, and then tuck back in, leaving a little tab that buzzes. Not in your way, but you know it’s there.']] },
    { id: 'theo', t: 'Call with Theo about the lease', when: 'Yesterday, 4:30 PM', grp: 'This week', dur: 365, where: 'Studio',
      tx: [['Theo', 'Same terms as this year, except the rent review moves from January to March.'], ['You', 'That works. Can we add a clause about the roof repairs?'], ['Theo', 'I’ll ask. They usually agree to two business days for urgent repairs.'], ['You', 'Great. Send page four and I’ll sign it this week.']] },
    { id: 'playlist', t: 'Saturday dinner playlist', when: 'Monday, 7:02 PM', grp: 'This week', dur: 80, where: 'Kitchen',
      tx: [['You', 'For Maya’s dinner: start with Pet Sounds, then something slower. No more than two hours. Bring dessert, not wine.']] },
    { id: 'hum', t: 'Melody', when: 'Sunday, 11:40 PM', grp: 'This week', dur: 32, music: true, tx: [] }
  ];
  MEM.forEach(m => { m.wave = meWave(m.id, 160, m.music); const words = m.tx.flatMap(([who, s], k) => s.split(' ').map(w => ({ w, who, k }))); m.words = words.map((x, i) => ({ ...x, at: (i + .5) / Math.max(1, words.length) * m.dur * .96 })); });
  const ME = { cur: 'dry', t: 0, playing: false, speed: 1, skip: false, enhance: true, rec: null, q: '', view: 'all', deleted: [], raf: 0 };
  const meM = id => MEM.find(m => m.id === id) || ME.deleted.find(m => m.id === id);
  const meFmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function meSide() { const q = ME.q.toLowerCase(), list = (ME.view === 'deleted' ? ME.deleted : MEM.filter(m => ME.view !== 'fav' || m.fav)).filter(m => !q || (m.t + ' ' + m.tx.map(x => x[1]).join(' ')).toLowerCase().includes(q)); let g = '';
    const hit = m => { if (!q) return ''; const all = m.tx.map(x => x[1]).join(' '), i = all.toLowerCase().indexOf(q); if (i < 0) return ''; const a = Math.max(0, i - 24); return `<em class="mehit">…${esc(all.slice(a, i))}<mark>${esc(all.slice(i, i + q.length))}</mark>${esc(all.slice(i + q.length, i + q.length + 30))}…</em>`; };
    $('#me-side').innerHTML = `<div class="scr melist">${ME.view !== 'all' ? lFiltHead(ME.view === 'fav' ? 'Favorites' : 'Recently deleted', 'data-meview', 'all') : ''}${ME.rec ? `<div class="merow rec"><i class="medot"></i><span><b>Recording…</b><small>${meFmt(ME.rec.t)}</small></span></div>` : ''}${list.map(m => { const h = ME.view !== 'deleted' && m.grp !== g ? `<div class="megh">${(g = m.grp)}</div>` : '';
        return h + `<button class="merow${ME.cur === m.id ? ' on' : ''}" type="button" data-meopen="${m.id}"><span><b>${m.fav ? `<i class="mefav">${ic('star')}</i>` : ''}${esc(m.t)}</b><small>${m.when} · ${meFmt(m.dur)}</small>${hit(m)}</span><svg class="memini" viewBox="0 0 40 16" preserveAspectRatio="none">${m.wave.filter((_, i) => i % 4 === 0).map((v, i) => `<rect x="${i}" y="${8 - v * 7}" width=".6" height="${v * 14}"/>`).join('')}</svg></button>`; }).join('') || `<p class="menone">${ME.view === 'deleted' ? 'Deleted memos stay here for 30 days.' : q ? 'Nothing was said like that.' : 'No memos yet.'}</p>`}</div>
      ${meNarrow() ? meListBar() : lFoot({ q: { attr: 'data-meq', ph: 'Search what was said', value: ME.q }, filter: { items: [['all', 'All', 'layers'], ['fav', 'Favorites', 'star'], ['deleted', 'Recently deleted', 'trash-2']], cur: ME.view, attr: 'data-meview' } })}`; }
  function meWaveHTML(m, live) { const bars = live ? ME.rec.wave : m.wave, n = bars.length, p = live ? 1 : ME.t / m.dur;
    return `<div class="mewave${live ? ' live' : ''}" ${live ? '' : 'data-mescrub'} style="--mp:${(p * 100).toFixed(2)}%">${live ? '' : '<i class="merail"></i>'}${bars.map((v, i) => `<i style="height:${(v * 100).toFixed(1)}%" class="${i / n < p ? 'p' : ''}"></i>`).join('')}${live ? '' : `<span class="mehead" style="left:${p * 100}%"></span>`}</div>`; }
  /* phone: the title island (‹ | what's open) replaces the floating Back and the in-page heading */
  function meIsl() { const w = $('#w-memos'); let i = $('#me-isl'); if (!meNarrow() || (!ME.rec && !meM(ME.cur))) { i?.remove(); return; } if (!i) { $('#me-main').insertAdjacentHTML('beforeend', '<div class="meisl" id="me-isl"></div>'); i = $('#me-isl'); }
    const m = meM(ME.cur), t = ME.rec ? 'New memo' : m.t, sub = ME.rec ? `${ME.rec.paused ? 'Paused' : 'Recording'} · Studio` : `${m.when} · ${meFmt(m.dur)}`;
    i.innerHTML = `<button class="meislb" type="button" data-meback aria-label="Back to Memos">${ic('chevron-left')}</button><span class="meisli">${ME.rec ? `<i class="medot${ME.rec.paused ? ' paused' : ''}"></i>` : ''}<span><b>${esc(t)}</b><small>${esc(sub)}</small></span></span>`; }
  function meMain() { setTimeout(meIsl); const b = $('#me-body');
    if (ME.rec) { const r = ME.rec; b.innerHTML = `<div class="mepad"><div class="mehd"><span class="meeye rec"><i class="medot"></i>Recording</span><h1>New memo</h1><p>${r.paused ? 'Paused' : 'Listening'} · Studio</p></div>
        <div class="medeck rec"><div class="metime big">${meFmt(r.t)}<small>.${String(Math.floor(r.t * 10) % 10)}</small></div>${meWaveHTML(null, true)}</div>
        <div class="metx live">${r.said.map(w => `<span>${esc(w)} </span>`).join('')}<i class="mecaret"></i></div></div>`; return; }
    const m = meM(ME.cur); if (!m) { b.innerHTML = `<div class="meempty">${ic('mic')}<b>No memo open</b><span>Record one, or pick one from the list.</span></div>`; return; }
    let who = '';
    b.innerHTML = `<div class="mepad"><div class="mehd"><span class="meeye">${m.when} · ${m.where || 'Unknown place'}</span><h1 contenteditable="true" spellcheck="false" data-metitle>${esc(m.t)}</h1></div>
      <div class="medeck">${meWaveHTML(m)}
        <div class="medctl"><div class="metime"><span id="me-now">${meFmt(ME.t)}</span><small>/ ${meFmt(m.dur)}</small></div>
          <div class="metrans"><button class="ib" type="button" data-meskip="-15" title="Back 15 seconds">${ic('rotate-ccw')}</button><button class="meplay" type="button" data-meplay title="Play (Space)">${ic(ME.playing ? 'pause' : 'play')}</button><button class="ib" type="button" data-meskip="15" title="Forward 15 seconds">${ic('rotate-cw')}</button></div>
          <button class="bt sm mespd" type="button" data-mespeed>${ME.speed}×${ic('chevron-down')}</button></div></div>
      <div class="metx">${m.music ? `<p class="menotx">${ic('music')}No speech in this one. It sounds like music, so Memos kept it as audio.</p>` : m.tx.map(([sp], k) => { const ws = m.words.filter(w => w.k === k), show = sp !== who; who = sp; return `<p>${show ? `<b class="mesp">${sp}</b>` : ''}${ws.map(w => `<span data-meat="${w.at.toFixed(2)}" class="${w.at <= ME.t ? 'said' : ''}">${esc(w.w)}</span>`).join(' ')}</p>`; }).join('')}</div></div>`; }
  /* Memos on a phone: list first, like Voice Memos. The list's foot is the bar: Search, Show (All, Favorites, Recently
     deleted), and New memo, which grows the bar with the microphone and Start recording. A memo's page has one bar
     (Share, Favorite, Trim, ⋯), no corner island; recording turns it into the time, Pause and Done. */
  const meNarrow = () => { const w = $('#w-memos'); return !!w?.clientWidth && w.clientWidth < 560; };
  function meListBar() { const X = ME.px || '';
    const panel = X === 'new' ? `<div class="fexp menew2"><div class="fexh">New memo</div><div class="fexs">${[['phone', 'smartphone', 'This phone'], ['buds', 'headphones', 'Studio headphones']].map(([k, i, n]) => `<button type="button" class="fsch${(ME.mic || 'phone') === k ? ' on' : ''}" data-memic="${k}">${ic(i)}${n}</button>`).join('')}</div>
        <button class="fexr2" type="button" data-meenh2>${ic('sparkles')}<span>Reduce background noise</span><i class="cfsw${ME.enhance ? ' on' : ''}"></i></button><button class="bt merecgo" type="button" data-merec><i></i>Start recording</button></div>`
      : X === 'show' ? `<div class="fexp"><div class="fexh">Show</div><div class="fexs">${[['all', 'All', 'layers'], ['fav', 'Favorites', 'star'], ['deleted', 'Recently deleted', 'trash-2']].map(([k, n, i]) => `<button type="button" class="fsch${ME.view === k ? ' on' : ''}" data-meview="${k}">${ic(i)}${n}</button>`).join('')}</div></div>` : '';
    return `<div class="fbar melbar phnofit${panel ? ' phgrow' : ''}">${panel}<label class="srch keep">${ic('search')}<input placeholder="Search what was said" value="${esc(ME.q)}" data-meq aria-label="Search memos"></label><button class="ib${X === 'show' || ME.view !== 'all' ? ' on' : ''}" type="button" data-mepx="show" aria-label="Show" title="Show">${ic('list-filter')}</button><button class="${X === 'new' ? 'ib on' : 'bt pri menewb'}" type="button" data-mepx="new" aria-label="${X === 'new' ? 'Close' : 'New memo'}">${X === 'new' ? ic('x') : `${ic('mic')}<span>New</span>`}</button></div>`; }
  function meBarPhone(bar, m) { const X = ME.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    bar.classList.add('phnofit', 'mephbar'); $('#me-corner').hidden = true; let panel = '', row = '';
    meIsl();
    if (ME.rec) row = `<span class="merec2"><i class="medot"></i><b>${ME.rec.paused ? 'Paused' : 'Recording'}</b><em>${meFmt(ME.rec.t)}</em></span>${ib('data-mepause', ME.rec.paused ? 'mic' : 'pause', ME.rec.paused ? 'Resume' : 'Pause')}<button class="bt pri medone2" type="button" data-mestop>Done</button>`;
    else if (ME.view === 'deleted' && m) row = `<button class="bt pri medone2" type="button" data-merestore>${ic('rotate-ccw')}<span>Put back</span></button><button class="bt fill medone2" type="button" data-mepurge><span>Delete for good</span></button>`;
    else if (m) { panel = X === 'share' ? `<div class="fexp fshare2"><div class="fexh">Send to</div><div class="fshp">${['PR', 'NF', 'SK', 'TH', 'MO'].map(k => `<button type="button" data-medo="Sent to ${esc(ppl(k).n.split(' ')[0])}">${av(k, 48)}<span>${esc(ppl(k).n.split(' ')[0])}</span></button>`).join('')}</div>
          <div class="fsha">${[['music', 'Audio', 'Audio saved as .m4a'], ['file-text', 'Transcript', 'Transcript saved as .txt'], ['copy', 'Copy text', 'Transcript copied'], ['radio-tower', 'Nearby', 'Looking for devices nearby']].map(([i, n, t]) => `<button type="button" class="fvt" data-medo="${t}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`
        : X === 'more' ? `<div class="fexp fmore2">${[['data-merename', 'pencil', 'Rename'], ['data-meretx', 'rotate-cw', 'Transcribe again'], ['data-medup', 'copy', 'Duplicate'], ['data-medel', 'trash-2', 'Delete', ' red']].map(([a, i, n, r]) => `<button class="fexr2${r || ''}" type="button" ${a}>${ic(i)}<span>${n}</span></button>`).join('')}</div>` : '';
      row = `${ib('data-mepx="share"', 'share-2', 'Share', X === 'share')}${ib('data-mefav', 'star', m.fav ? 'Remove from Favorites' : 'Favorite', m.fav)}${ib('data-metrim', 'scissors', 'Trim')}${ib('data-mepx="more"', 'ellipsis', 'More', X === 'more')}`; }
    bar.classList.toggle('phgrow', !!panel); bar.hidden = !row; if (row) setBar(bar, panel + row); }
  function meBar() { const m = meM(ME.cur), bar = $('#me-bar'); let h;
    if (meNarrow()) return meBarPhone(bar, m); bar.classList.remove('phnofit', 'mephbar', 'phgrow');
    const ctx = m => `<span class="ctxc"><i class="mectxi">${ic('mic')}</i>${esc(m.t)}<em>${meFmt(m.dur)}</em></span>`;
    if (ME.rec) h = `<span class="ctxc merec"><i class="medot"></i>${ME.rec.paused ? 'Paused' : 'Recording'}<em>${meFmt(ME.rec.t)}</em></span><button class="bt" type="button" data-mepause>${ic(ME.rec.paused ? 'mic' : 'pause')}${ME.rec.paused ? 'Resume' : 'Pause'}</button><button class="bt mestop" type="button" data-mestop>${ic('square')}Done</button>`;
    else if (ME.view === 'deleted' && m) h = `<button class="bt key" type="button" data-merestore>${ic('rotate-ccw')}Put back</button><button class="bt" type="button" data-mepurge>Delete for good</button>`;
    // One memo on screen, so the bar doesn't repeat its name: it's all actions. Rare or destructive ones stay behind ···
    else h = `${m ? `<button class="bt" type="button" data-metrim>${ic('scissors')}Trim</button><span class="vr"></span>` : ''}<button class="bt merecb" type="button" data-merec title="Record (R)"><i></i>Record</button>`;
    setBar(bar, h);
    /* top right: the memo itself (Favorite, Share, ···); per the SunoUI placement rule */
    const c = $('#me-corner'); c.hidden = !m || !!ME.rec || ME.view === 'deleted'; c.innerHTML = c.hidden ? '' : `<button class="bt" type="button" data-meshare data-share>${ic('share-2')}Share</button><button class="ib${m.fav ? ' on' : ''}" type="button" data-mefav title="${m.fav ? 'Remove from Favorites' : 'Favorite'}" aria-label="Favorite" aria-pressed="${!!m.fav}">${ic('star')}</button><button class="ib" type="button" data-memore title="More" aria-label="More">${ic('ellipsis')}</button>`; }
  function meFrame() { const m = meM(ME.cur); if (!m || ME.rec) return; const p = ME.t / m.dur, now = $('#me-now'); if (now) now.textContent = meFmt(ME.t);
    const bars = $$('#me-body .mewave i:not(.merail)'); bars.forEach((b, i) => b.classList.toggle('p', i / bars.length < p)); const hd = $('#me-body .mehead'); if (hd) hd.style.left = p * 100 + '%'; $('#me-body .mewave')?.style.setProperty('--mp', p * 100 + '%');
    $$('#me-body .metx span[data-meat]').forEach(s => s.classList.toggle('said', +s.dataset.meat <= ME.t)); const last = [...$$('#me-body .metx span.said')].pop(); $$('#me-body .metx span.cur').forEach(x => x.classList.remove('cur')); if (last && ME.playing) last.classList.add('cur'); }
  function mePlay(on) { cancelAnimationFrame(ME.raf); ME.playing = on; const pb = $('#me-body [data-meplay]'); if (pb) pb.innerHTML = ic(on ? 'pause' : 'play'); if (!on) return; const m = meM(ME.cur); if (ME.t >= m.dur - .2) ME.t = 0; let last = performance.now();
    const loop = now => { const dt = (now - last) / 1000; last = now; const w = m.words.find(x => x.at > ME.t), quiet = ME.skip && w && w.at - ME.t > 1.2; ME.t = Math.min(m.dur, ME.t + dt * ME.speed * (quiet ? 4 : 1)); meFrame(); if (ME.t >= m.dur) { mePlay(false); return; } ME.raf = requestAnimationFrame(loop); }; ME.raf = requestAnimationFrame(loop); }
  const ME_SAY = 'Reminder for tomorrow: pick up the loft keys from Theo before ten, then test the projector with the launch deck. Bring the long HDMI cable.'.split(' ');
  function meRecord() { mePlay(false); ME.rec = { t: 0, wave: [], said: [], paused: false, marks: [] }; const r = meSeed('rec' + Date.now()); let last = performance.now(), nextW = 1.2;
    const loop = now => { if (!ME.rec) return; const dt = (now - last) / 1000; last = now; if (!ME.rec.paused) { ME.rec.t += dt; if (ME.rec.wave.length === 0 || ME.rec.t * 12 > ME.rec.wave.length) { ME.rec.wave.push(Math.max(.06, Math.min(1, .25 + r() * .75 * Math.abs(Math.sin(ME.rec.t * 2.3))))); if (ME.rec.wave.length > 150) ME.rec.wave.shift(); }
        if (ME.rec.t > nextW && ME.rec.said.length < ME_SAY.length) { ME.rec.said.push(ME_SAY[ME.rec.said.length]); nextW = ME.rec.t + .22 + r() * .25; } }
      meRecFrame(); const c = $('#me-bar .merec em'); if (c) c.textContent = meFmt(ME.rec.t); ME.raf = requestAnimationFrame(loop); };
    meSide(); meMain(); meBar(); ME.raf = requestAnimationFrame(loop); }
  function meRecFrame() { const be = $('#me-bar .merec2 em'); if (be && ME.rec) be.textContent = meFmt(ME.rec.t); const r = ME.rec, t = $('#me-body .metime.big'), w = $('#me-body .mewave.live'), x = $('#me-body .metx.live'); if (!t || !w || !x) return meMain();
    const sr = $('#me-side .merow.rec small'); if (sr) sr.textContent = meFmt(r.t);
    t.innerHTML = `${meFmt(r.t)}<small>.${String(Math.floor(r.t * 10) % 10)}</small>`; w.innerHTML = r.wave.map(v => `<i style="height:${(v * 100).toFixed(1)}%"></i>`).join('');
    const have = x.querySelectorAll('span').length; if (r.said.length > have) x.lastElementChild.insertAdjacentHTML('beforebegin', r.said.slice(have).map(s => `<span>${esc(s)} </span>`).join('')); }
  function meStop() { cancelAnimationFrame(ME.raf); const r = ME.rec; ME.rec = null; const id = 'm' + Date.now(), dur = Math.max(2, Math.round(r.t)), text = r.said.join(' ');
    const m = { id, t: text ? text.split(' ').slice(0, 5).join(' ').replace(/[:,.]$/, '') : 'New memo', when: 'Just now', grp: 'Today', dur, where: 'Studio', marks: r.marks, tx: text ? [['You', text]] : [], wave: meWave(id, 160) };
    const words = text ? text.split(' ') : []; m.words = words.map((w, i) => ({ w, who: 'You', k: 0, at: (i + .5) / words.length * dur * .96 })); MEM.unshift(m); ME.cur = id; ME.t = 0; meSide(); meMain(); meBar(); meToast('Saved and transcribed'); }
  function meToast(msg, undo, icon) { meToast.u = undo; lToast($('#w-memos'), msg, { undo, icon }); }
  function mePop(anchor, html) { $('#me-pop')?.remove(); const w = $('#w-memos'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop" id="me-pop">${html}</div>`); const p = $('#me-pop'); p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left + r.width / 2 - p.offsetWidth / 2)) + 'px'; p.style.bottom = (wr.bottom - r.top + 8) + 'px'; }
  function meClick(e, hit) { const q = s => hit(s);
    if (q('[data-meback]')) { $('#w-memos').querySelector(':scope > .phback')?.click(); return true; }   /* the island's ‹ does what the phone Back did */
    if (meNarrow()) { const px = q('[data-mepx]'); if (px) { const k = px.dataset.mepx; ME.px = ME.px === k ? '' : k; if (k === 'share' || k === 'more') meBar(); else meSide(); return true; }
      const mc = q('[data-memic]'); if (mc) { ME.mic = mc.dataset.memic; meSide(); return true; }
      if (q('[data-meenh2]')) { ME.enhance = !ME.enhance; meSide(); return true; }
      const md = q('[data-medo]'); if (md) { ME.px = ''; meBar(); meToast(md.dataset.medo); return true; }
      if (q('[data-merec]')) { ME.px = ''; $('#w-memos').classList.remove('navopen'); meRecord(); meSide(); return true; }
      if (q('[data-meview]') || q('[data-meopen]') || q('[data-merename]') || q('[data-meretx]') || q('[data-medup]') || q('[data-medel]') || q('[data-mefav]') || q('[data-metrim]')) { const was = ME.px; ME.px = ''; if (was === 'show') setTimeout(meSide); else if (was) setTimeout(meBar); } }
    if (!q('#me-pop') && !q('[data-memore],[data-mespeed],[data-meshare]')) $('#me-pop')?.remove();
    if (q('[data-medup]')) { $('#me-pop')?.remove(); meToast('Duplicated'); return true; }
    const op = q('[data-meopen]'); if (op) { mePlay(false); ME.cur = op.dataset.meopen; ME.t = 0; meSide(); meMain(); meBar(); return true; }
    const vw = q('[data-meview]'); if (vw) { ME.view = vw.dataset.meview; const list = ME.view === 'deleted' ? ME.deleted : MEM.filter(m => ME.view !== 'fav' || m.fav); if (list[0] && !list.some(m => m.id === ME.cur)) { ME.cur = list[0].id; ME.t = 0; } else if (!list.length) ME.cur = null; meSide(); meMain(); meBar(); return true; }
    if (q('[data-merec]')) { meRecord(); return true; }
    if (q('[data-mestop]')) { meStop(); return true; }
    if (q('[data-mepause]')) { ME.rec.paused = !ME.rec.paused; meBar(); const p = $('#me-body .mehd p'); if (p) p.textContent = `${ME.rec.paused ? 'Paused' : 'Listening'} · Studio`; return true; }
    if (q('[data-memark]')) { ME.rec.marks.push(ME.rec.t); meToast('Marked ' + meFmt(ME.rec.t)); return true; }
    if (q('[data-meplay]')) { mePlay(!ME.playing); return true; }
    const sk = q('[data-meskip]'); if (sk) { const m = meM(ME.cur); ME.t = Math.max(0, Math.min(m.dur, ME.t + +sk.dataset.meskip)); meFrame(); return true; }
    const at = q('[data-meat]'); if (at) { ME.t = +at.dataset.meat; meFrame(); if (!ME.playing) mePlay(true); return true; }
    if (q('[data-mespeed]')) { mePop(q('[data-mespeed]'), `<h6 class="mnph">Speed</h6>${[.75, 1, 1.25, 1.5, 2].map(s => crMi(`data-mespd="${s}"`, '', s + '×', ME.speed === s ? ' on' : '')).join('')}<span class="crsep"></span>${crMi('data-meskipsil', 'skip-forward', `Skip silences${ME.skip ? ' ✓' : ''}`)}${crMi('data-meenh', 'wand-sparkles', `Enhance voice${ME.enhance ? ' ✓' : ''}`)}`); return true; }
    const sp = q('[data-mespd]'); if (sp) { ME.speed = +sp.dataset.mespd; $('#me-pop')?.remove(); const b = $('#me-body [data-mespeed]'); if (b) b.innerHTML = `${ME.speed}×${ic('chevron-down')}`; return true; }
    if (q('[data-meskipsil]')) { ME.skip = !ME.skip; $('#me-pop')?.remove(); meToast(ME.skip ? 'Silences are skipped' : 'Playing everything'); return true; }
    if (q('[data-meenh]')) { ME.enhance = !ME.enhance; $('#me-pop')?.remove(); meToast(ME.enhance ? 'Background noise reduced' : 'Original sound'); return true; }
    if (q('[data-mefav]')) { const m = meM(ME.cur); m.fav = !m.fav; meSide(); meBar(); return true; }
    if (q('[data-meshare]')) { mePop(q('[data-meshare]'), crMi('data-mesh="audio"', 'music', 'Audio (.m4a)') + crMi('data-mesh="text"', 'file-text', 'Transcript (.txt)') + crMi('data-mesh="copy"', 'copy', 'Copy transcript')); return true; }
    const shr = q('[data-mesh]'); if (shr) { $('#me-pop')?.remove(); meToast({ audio: 'Share opens with the audio', text: 'Share opens with the transcript', copy: 'Transcript copied' }[shr.dataset.mesh]); return true; }
    if (q('#lmenu .crmi')) setTimeout(() => $('#lmenu')?.remove());
    if (q('[data-memore]')) { lMenu(q('[data-memore]'), crMi('data-merename', 'pencil', 'Rename') + crMi('data-meretx', 'rotate-cw', 'Transcribe again') + crMi('data-medup', 'copy', 'Duplicate') + '<span class="crsep"></span>' + crMi('data-medel', 'trash-2', 'Delete', ' red')); return true; }
    if (q('[data-merename]')) { $('#me-pop')?.remove(); const h = $('[data-metitle]'); h.focus(); getSelection().selectAllChildren(h); return true; }
    if (q('[data-metrim]') || q('[data-meretx]')) { $('#me-pop')?.remove(); meToast(q('[data-metrim]') ? 'Drag the ends of the waveform to trim' : 'Transcribing again, on this device'); return true; }
    if (q('[data-medel]')) { $('#me-pop')?.remove(); mePlay(false); const i = MEM.findIndex(m => m.id === ME.cur), m = MEM.splice(i, 1)[0]; ME.deleted.unshift(m); ME.cur = MEM[i]?.id || MEM[i - 1]?.id; ME.t = 0; meSide(); meMain(); meBar(); meToast(`“${m.t}” moved to Deleted`, () => { ME.deleted.shift(); MEM.splice(i, 0, m); ME.cur = m.id; meSide(); meMain(); meBar(); }); return true; }
    if (q('[data-merestore]')) { const i = ME.deleted.findIndex(m => m.id === ME.cur), m = ME.deleted.splice(i, 1)[0]; MEM.unshift(m); ME.view = 'all'; meSide(); meMain(); meBar(); meToast('Put back'); return true; }
    if (q('[data-mepurge]')) { const m = ME.deleted.find(x => x.id === ME.cur); lConfirm($('#w-memos'), { title: `Delete “${m?.t || 'this memo'}” for good?`, body: 'The recording and its words are removed from this computer. This can’t be undone.', action: 'Delete', onOK: () => { const i = ME.deleted.findIndex(x => x.id === ME.cur); ME.deleted.splice(i, 1); ME.cur = ME.deleted[0]?.id || null; meSide(); meMain(); meBar(); meToast('Deleted for good', null, 'trash-2'); } }); return true; }
    return false; }
  function renderMemos() { $('#me-top').innerHTML = `<img src="${A}memo.svg" alt=""><b>Memos</b><span class="chev">${ic('chevron-down')}</span>`; meSide(); meMain(); meBar();
    $('#me-body').addEventListener('pointerdown', e => { const w = e.target.closest('[data-mescrub]'); if (!w) return; const m = meM(ME.cur), set = ev => { const r = w.getBoundingClientRect(); ME.t = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * m.dur; meFrame(); }; set(e); const mv = ev => set(ev), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-meq]')) { ME.q = e.target.value; meSide(); const i = $('[data-meq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if (e.target.matches?.('[data-metitle]')) { const m = meM(ME.cur); m.t = e.target.textContent.trim() || 'Untitled'; clearTimeout(meSide.t); meSide.t = setTimeout(meSide, 300); } });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'memos' || e.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    if (e.key === ' ') { e.preventDefault(); ME.rec ? $('[data-mepause]')?.click() : $('[data-meplay]')?.click(); } else if (e.key === 'r' || e.key === 'R') { if (!ME.rec) meRecord(); } else if (e.key === 'Escape' && ME.rec) meStop(); });

  /* ══ Tasks ═══════════════════════════════════════════════════════════════════
     Three panes, three questions. Left: where does this belong (views and lists, some shared). Middle: what
     should I do (today, upcoming, a list). Right: everything about one task (when, who, notes, steps, talk). */
  const TKL = [
    { id: 'personal', n: 'Personal', h: 250, ppl: [] }, { id: 'launch', n: 'Launch', h: 45, ppl: ['PR', 'NF', 'SK'], secs: ['Before launch', 'Launch day', 'After'] },
    { id: 'home', n: 'Home', h: 150, ppl: ['AR'] }, { id: 'groc', n: 'Groceries', h: 90, ppl: ['AR'] }];
  let tkId = 100;
  const tkT = (o) => ({ id: 't' + (tkId++), done: false, pri: 0, notes: '', subs: [], who: [], act: [], ...o });
  const TKT = [
    tkT({ t: 'Finish the walkthrough deck', l: 'launch', sec: 0, due: 0, time: '5:00 PM', pri: 3, who: ['PR'], flag: true, notes: 'Milestones up front, pricing out. Priya owns the deck; Nick owns slide 7.', subs: [['Milestones slide', true], ['Homepage crop on slide 2', true], ['ISO timeline on slide 7', true], ['Cut the pricing section', false], ['Speaker notes', false]],
      act: [['PR', 'created this', '2 days ago'], ['NF', 'finished “Homepage crop on slide 2”', 'Yesterday'], ['me', 'c', 'Timeline is on slide 7 now.', 'Yesterday'], ['PR', 'c', 'Perfect. Speaker notes tonight, then we’re done.', '9:41 AM']] }),
    tkT({ t: 'Dry run with Priya and Nora', l: 'launch', sec: 0, due: 0, time: '7:30 PM', pri: 2, who: ['me', 'PR', 'NF'], act: [['PR', 'created this', '9:42 AM']] }),
    tkT({ t: 'Call Dad back', l: 'personal', due: 0, pri: 2, act: [['me', 'created this', 'Monday']] }),
    tkT({ t: 'Pay the water bill', l: 'home', due: -1, pri: 1, who: ['me'], notes: '$48.20, due yesterday. Autopay failed because the card expired.', act: [['AR', 'assigned this to you', 'Sunday']] }),
    tkT({ t: 'Record the demo video', l: 'launch', sec: 0, due: 1, pri: 2, who: ['SK'], subs: [['Script', true], ['Screen capture', false], ['Voiceover', false]] }),
    tkT({ t: 'ISO sign-off checklist', l: 'launch', sec: 1, due: 7, time: '10:00 AM', pri: 3, who: ['me'], flag: true, subs: [['Clean boot on the ThinkPad', false], ['Depot channels point at stable', false], ['Release notes signed off', false], ['Checksums published', false], ['Upgrade from the last nightly', false]] }),
    tkT({ t: 'Fix the kitchen light', l: 'home', due: 3, pri: 0, who: ['AR'] }),
    tkT({ t: 'Dessert for Maya’s dinner', l: 'groc', due: 3, pri: 1 }), tkT({ t: 'Oat milk', l: 'groc' }), tkT({ t: 'Coffee beans', l: 'groc' }),
    tkT({ t: 'Renew passport', l: 'personal', due: 5, pri: 1, notes: 'Photos are in Pictures › Documents.' }),
    tkT({ t: 'Press kit for the launch', l: 'launch', sec: 2, due: 9, who: ['NF'] }), tkT({ t: 'Thank-you notes to the beta testers', l: 'launch', sec: 2 }),
    tkT({ t: 'Book the dentist', l: 'personal' }), tkT({ t: 'Homepage crop', l: 'launch', sec: 0, done: true, who: ['NF'] }), tkT({ t: 'Order the loft keys', l: 'launch', sec: 0, done: true, who: ['me'] })
  ];
  const TK = { det: true, q: '', draft: '', view: 'today', sel: null, showDone: false, parse: null, sug: true };
  const tkL = id => TKL.find(l => l.id === id), tkTask = id => TKT.find(t => t.id === id);
  const TKDAY0 = new Date(2026, 8, 23);
  const tkDay = d => d == null ? '' : d < 0 ? (d === -1 ? 'Yesterday' : `${-d} days ago`) : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d < 7 ? new Date(TKDAY0.getTime() + d * 864e5).toLocaleDateString([], { weekday: 'long' }) : new Date(TKDAY0.getTime() + d * 864e5).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const TKPRI = [['None', ''], ['Low', 'oklch(0.72 0.12 250)'], ['Medium', 'oklch(0.8 0.14 80)'], ['High', 'oklch(0.68 0.18 25)']];
  const tkAv = (k, sz) => k === 'me' ? av('me', sz) : PPL[k] ? av(k, sz) : `<i class="av round" style="width:${sz}px;height:${sz}px"></i>`;
  const tkName = k => k === 'me' ? 'You' : PPL[k]?.n.split(' ')[0] || k;
  const TKV = [['today', 'Today', 'sun'], ['upcoming', 'Upcoming', 'calendar'], ['mine', 'Assigned to me', 'user'], ['flag', 'Flagged', 'flag'], ['done', 'Done', 'check-check']];
  const tkIn = (t, v) => v === 'today' ? !t.done && t.due != null && t.due <= 0 : v === 'upcoming' ? !t.done && t.due != null && t.due > 0 : v === 'mine' ? !t.done && t.who.includes('me') : v === 'flag' ? !t.done && t.flag : v === 'done' ? t.done : t.l === v;

  function tkSide() { const cnt = v => TKT.filter(t => tkIn(t, v) && (TKV.some(x => x[0] === v) || !t.done)).length;
    $('#tk-side').innerHTML = `${TKV.map(([k, n, i]) => `<button class="tki${TK.view === k ? ' on' : ''}" type="button" data-tkview="${k}">${ic(i)}<span>${n}</span>${lCount(cnt(k), k === 'today' && TKT.some(t => !t.done && t.due < 0))}</button>`).join('')}
      <div class="tksh tkshl">Lists<button class="ib" type="button" data-tktodo="Name it, pick a colour, and share it if you like" title="New list" aria-label="New list">${ic('plus')}</button></div>${TKL.map(l => `<button class="tki${TK.view === l.id ? ' on' : ''}" type="button" data-tkview="${l.id}"><i class="tkdot" style="--h:${l.h}"></i><span>${l.n}</span>${l.ppl.length ? `<span class="tkstk">${l.ppl.slice(0, 3).map(k => tkAv(k, 18)).join('')}</span>` : ''}${lCount(cnt(l.id))}</button>`).join('')}
      <div class="shead sfoot tkfoot"><label class="srch">${ic('search')}<input placeholder="Search tasks" value="${esc(TK.q)}" data-tkq></label></div>`; }
  function tkRow(t, showList) { const l = tkL(t.l), subsDone = t.subs.filter(s => s[1]).length, coms = t.act.filter(a => a[1] === 'c').length;
    const meta = [showList ? `<span class="tkm"><i class="tkdot" style="--h:${l.h}"></i>${l.n}</span>` : '', t.due != null && TK.view !== 'today' || t.due < 0 ? `<span class="tkm${t.due < 0 ? ' late' : ''}">${ic('calendar')}${tkDay(t.due)}${t.time ? ', ' + t.time : ''}</span>` : t.time ? `<span class="tkm">${ic('clock')}${t.time}</span>` : '', t.subs.length ? `<span class="tkm">${ic('list')}${subsDone}/${t.subs.length}</span>` : '', coms ? `<span class="tkm">${ic('message-square')}${coms}</span>` : '', t.notes ? `<span class="tkm">${ic('file-text')}</span>` : ''].filter(Boolean).join('');
    return `<div class="tkrow${t.done ? ' done' : ''}${TK.sel === t.id ? ' sel' : ''}" data-tkpick="${t.id}"><button class="tkck" type="button" data-tkck="${t.id}" style="--p:${TKPRI[t.pri][1] || 'var(--ink-3)'}" aria-label="Complete"><i>${ic('check')}</i></button>
      <span class="tktx"><b>${esc(t.t)}${t.flag ? `<i class="tkfl">${ic('flag')}</i>` : ''}</b>${meta ? `<span class="tkmeta">${meta}</span>` : ''}</span>${t.who.filter(k => k !== 'me' || t.who.length > 1).length ? `<span class="tkstk">${t.who.slice(0, 3).map(k => tkAv(k, 24)).join('')}</span>` : ''}</div>`; }
  function tkMain() { const v = TK.view, l = tkL(v), smart = TKV.find(x => x[0] === v); let groups = [];
    const qq = TK.q.trim().toLowerCase(), list = TKT.filter(t => tkIn(t, v) && (v === 'done' || !t.done) && (!qq || t.t.toLowerCase().includes(qq)));
    if (v === 'today') { groups = [['Overdue', list.filter(t => t.due < 0), 'late'], ['Today', list.filter(t => t.due === 0)]]; }
    else if (v === 'upcoming') { const days = [...new Set(list.map(t => t.due))].sort((a, b) => a - b); groups = days.map(d => [tkDay(d), list.filter(t => t.due === d)]); }
    else if (l && l.secs) groups = l.secs.map((s, i) => [s, list.filter(t => (t.sec || 0) === i)]);
    else groups = [['', list]];
    const doneHere = l ? TKT.filter(t => t.l === v && t.done) : [], all = TKT.filter(t => (l ? t.l === v : tkIn(t, v)) || (v === 'today' && t.done && t.due === 0)), dn = v === 'today' ? TKT.filter(t => t.done && (t.due ?? 1) <= 0).length : doneHere.length, tot = list.length + dn;
    const sug = v === 'today' && TK.sug ? TKT.filter(t => !t.done && t.due > 0 && t.due <= 3).slice(0, 3) : [];
    const ring = tot ? `<svg class="tkring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle cx="18" cy="18" r="15" class="p" style="stroke-dasharray:${(dn / tot * 94.2).toFixed(1)} 94.2"/></svg><span class="tkrt"><b>${dn} of ${tot}</b><small>done</small></span>` : '';
    $('#tk-body').innerHTML = `<div class="tkpad"><header class="tkhd"><div><h1>${l ? l.n : smart[1]}</h1><p>${v === 'today' ? TKDAY0.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : l ? (l.ppl.length ? `Shared with ${l.ppl.map(tkName).join(', ')}` : 'Only you') : v === 'upcoming' ? 'The next few weeks' : ''}</p></div>
        ${l ? `<button class="tkshare" type="button" data-tkshare>${l.ppl.length ? `<span class="tkstk">${['me', ...l.ppl].slice(0, 4).map(k => tkAv(k, 26)).join('')}</span>` : ''}${ic('users')}<span>${l.ppl.length ? 'Shared' : 'Share'}</span></button>` : ''}</header>
      ${groups.map(([g, ts, cls]) => ts.length || (l && l.secs) ? `<section class="tkgrp${cls ? ' ' + cls : ''}">${g ? `<h6>${g}${lCount(ts.length)}</h6>` : ''}${ts.map(t => tkRow(t, !l)).join('') || '<p class="tknone">Nothing here yet.</p>'}</section>` : '').join('') || `<div class="tkclear">${ic('check-check')}<b>All clear</b><span>${v === 'today' ? 'Nothing left for today.' : 'Nothing here.'}</span></div>`}
      ${v === 'today' && tkNarrow() ? `<button class="tkplanb" type="button" data-tkplango><span class="tkpli">${ic('layers')}</span><span><b>Plan my day</b><small>${TKT.filter(t => !t.done && t.due !== 0).slice(0, 6).length} things could fit today. Swipe through them.</small></span>${ic('chevron-right')}</button>` : ''}
      ${sug.length ? `<section class="tkgrp sug"><h6>Suggested for today<button class="lnk" type="button" data-tksugx>Hide</button></h6>${sug.map(t => `<div class="tkrow sug">${ic('sunrise')}<span class="tktx"><b>${esc(t.t)}</b><span class="tkmeta"><span class="tkm"><i class="tkdot" style="--h:${tkL(t.l).h}"></i>${tkL(t.l).n}</span><span class="tkm">${ic('calendar')}${tkDay(t.due)}</span></span></span><button class="bt sm fill" type="button" data-tktoday="${t.id}">${ic('plus')}Today</button></div>`).join('')}</section>` : ''}
      ${(l ? doneHere : []).length ? `<section class="tkgrp donegrp"><button class="tkdt" type="button" data-tkshowdone>${ic(TK.showDone ? 'chevron-down' : 'chevron-right')}${doneHere.length} done</button>${TK.showDone ? doneHere.map(t => tkRow(t)).join('') : ''}</section>` : ''}</div>`; }
  function tkDetail() { const t = tkTask(TK.sel), box = $('#tk-det'), on = lDPShow(box, { open: TK.det, subject: t }); $('#w-tasks').classList.toggle('nodet', !on); if (!on) return; const l = tkL(t.l), sd = t.subs.filter(s => s[1]).length;
    box.innerHTML = `${lDP({ title: 'Task', close: 'data-tkdetx' }).replace('<div class="ldpb"></div>', '')}<div class="scr ldpb"><div class="tkdh"><button class="tkck big${t.done ? ' on' : ''}" type="button" data-tkck="${t.id}" style="--p:${TKPRI[t.pri][1] || 'var(--ink-3)'}"><i>${ic('check')}</i></button><h2 contenteditable="true" spellcheck="false" data-tktitle>${esc(t.t)}</h2><button class="ib${t.flag ? ' on' : ''}" type="button" data-tkflag title="Flag" aria-label="Flag" aria-pressed="${!!t.flag}">${ic('flag')}</button></div>
      <dl class="tkprops">
        <div><dt>${ic('calendar')}Due</dt><dd><button class="tkchip${t.due < 0 ? ' late' : ''}" type="button" data-tkdue>${t.due == null ? 'Add a date' : tkDay(t.due) + (t.time ? ', ' + t.time : '')}</button>${t.due != null ? `<button class="tkchip q" type="button" data-tktodo="Repeat: daily, weekly, monthly, or custom">${ic('repeat')}Repeat</button>` : ''}</dd></div>
        <div><dt>${ic('flag')}Priority</dt><dd class="tkpri">${TKPRI.map(([n, c], i) => `<button type="button" class="${t.pri === i ? 'on' : ''}" style="--c:${c || 'var(--ink-3)'}" data-tkpri="${i}">${n}</button>`).join('')}</dd></div>
        <div><dt>${ic('user')}Assigned</dt><dd>${t.who.map(k => `<span class="tkperson">${tkAv(k, 22)}${tkName(k)}</span>`).join('')}<button class="tkchip q" type="button" data-tkassign>${ic('plus')}${t.who.length ? '' : 'Someone'}</button></dd></div>
        <div><dt>${ic('list')}List</dt><dd><button class="tkchip" type="button" data-tkmove><i class="tkdot" style="--h:${l.h}"></i>${l.n}${l.secs ? ` › ${l.secs[t.sec || 0]}` : ''}</button>${l.ppl.length ? `<span class="tksharedw">${ic('users')}Shared with ${l.ppl.map(tkName).join(', ')}</span>` : ''}</dd></div>
      </dl>
      ${lDP.lab('Notes')}<div class="tknotes" contenteditable="true" data-tknotes data-ph="Anything worth remembering">${esc(t.notes)}</div>
      ${lDP.lab('Steps', t.subs.length ? `<em class="tkof">${sd} of ${t.subs.length}</em>` : '')}${t.subs.length ? `<span class="tkstepbar"><i style="width:${sd / t.subs.length * 100}%"></i></span>` : ''}
      <div class="tksubs">${t.subs.map(([s, d], i) => `<button class="tksub${d ? ' on' : ''}" type="button" data-tksub="${i}"><i>${ic('check')}</i><span>${esc(s)}</span></button>`).join('')}<label class="tksubadd">${ic('plus')}<input data-tksubadd placeholder="Add a step"></label></div>
      ${lDP.lab('Comments')}<div class="tkact">${t.act.map(a => a[1] === 'c' ? `<div class="tkcom${a[0] === 'me' ? ' me' : ''}">${tkAv(a[0], 26)}<div><span><b>${tkName(a[0])}</b><time>${a[3]}</time></span><p>${esc(a[2])}</p></div></div>` : `<div class="tkev">${tkAv(a[0], 18)}<span><b>${tkName(a[0])}</b> ${esc(a[1])}</span><time>${a[2]}</time></div>`).join('') || '<p class="tknone">No activity yet.</p>'}</div></div>
      <label class="tkcomp">${av('me', 26)}<input data-tkcomment placeholder="${l.ppl.length ? 'Write a comment. @ to mention someone' : 'Add a comment for yourself'}"><button class="ib" type="button" data-tksend title="Send">${ic('arrow-up')}</button></label>`; }
  /* Tasks on a phone: two rows, like Calendar. Top: which list you're looking at (Today, Upcoming, your lists: a dropdown
     that replaces the sidebar) and Search; bottom: "Add a task", always there, understood as you type. A picked task
     grows the bar with everything about it, and the row becomes Complete, Today, Tomorrow, Flag and ✕. */
  const tkNarrow = () => { const w = $('#w-tasks'); return !!w?.clientWidth && w.clientWidth < 560; };
  function tkBarPhone(bar, t, l) { const X = TK.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    bar.classList.add('phnofit', 'tkphbar'); bar.classList.remove('adding'); const cnt = v => TKT.filter(x => tkIn(x, v) && (TKV.some(y => y[0] === v) || !x.done)).length;
    if (t && TK.det) { bar.classList.add('phgrow'); setBar(bar, `<div class="fexp tkdet2">${$('#tk-det').innerHTML}</div><div class="tkr1">${t.done ? `<button class="bt fill tkprim" type="button" data-tkck="${t.id}">${ic('rotate-ccw')}<span>Not done</span></button>` : `<button class="bt pri tkprim" type="button" data-tkck="${t.id}">${ic('check')}<span>Complete</span></button>`}${ib('data-tkwhen="0"', 'sun', 'Today')}${ib('data-tkwhen="1"', 'sunrise', 'Tomorrow')}${ib('data-tkflag', 'flag', 'Flag', !!t.flag)}${ib('data-tkdetx', 'x', 'Close')}</div>`); return; }
    const cur = l ? [l.n, 'list'] : (TKV.find(x => x[0] === TK.view) || TKV[0]).slice(1).reverse().reverse(), curName = l ? l.n : (TKV.find(x => x[0] === TK.view) || TKV[0])[1], curIc = l ? null : (TKV.find(x => x[0] === TK.view) || TKV[0])[2];
    const panel = X === 'lists' ? `<div class="fexp fmore2 tklists2"><div class="fsha c3">${TKV.slice(0, 3).map(([k, n, i]) => `<button type="button" class="fvt${TK.view === k ? ' on' : ''}" data-tkview="${k}">${ic(i)}<span>${n}${cnt(k) ? ` · ${cnt(k)}` : ''}</span></button>`).join('')}</div>${TKV.slice(3).map(([k, n, i]) => `<button class="fexr2${TK.view === k ? ' on' : ''}" type="button" data-tkview="${k}">${ic(i)}<span>${n}</span><em>${cnt(k) || ''}</em></button>`).join('')}<div class="fexh">Lists</div>${TKL.map(x => `<button class="fexr2${TK.view === x.id ? ' on' : ''}" type="button" data-tkview="${x.id}"><i class="tkdot" style="--h:${x.h}"></i><span>${x.n}${x.ppl.length ? `<small>Shared with ${x.ppl.map(tkName).join(', ')}</small>` : ''}</span><em>${cnt(x.id) || ''}</em></button>`).join('')}<button class="fexr2" type="button" data-tktodo="Name it, pick a color, and share it if you like">${ic('plus')}<span>New list</span></button></div>`
      : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, `${panel}<div class="tkr1"><button class="tklist2${X === 'lists' ? ' on' : ''}" type="button" data-tkpx="lists" aria-expanded="${X === 'lists'}">${curIc ? ic(curIc) : `<i class="tkdot" style="--h:${l.h}"></i>`}<b>${esc(curName)}</b>${ic('chevron-down')}</button><span class="sp"></span>${ib('data-tkpx="search"', 'search', 'Search', X === 'search' || !!TK.q)}</div>
      <div class="tkr2">${X === 'search' ? `<label class="tkbadd">${ic('search')}<input data-tkq placeholder="Search tasks" value="${esc(TK.q)}" aria-label="Search tasks"></label><button class="ib" type="button" data-tkpx="search" aria-label="Close search">${ic('x')}</button>` : `<label class="tkbadd">${ic('plus')}<input data-tkadd placeholder="${l ? `Add to ${l.n}` : 'Add a task'}, like Call Theo tomorrow 3pm" value="${esc(TK.draft)}" autocomplete="off"><span class="tkchips" id="tk-chips"></span></label>`}</div>`);
    if (X === 'search') setTimeout(() => $('#tk-bar [data-tkq]')?.focus(), 30); }
  function tkBar() { const t = tkTask(TK.sel), bar = $('#tk-bar'), l = tkL(TK.view), was = document.activeElement?.matches?.('[data-tkadd]');
    if (tkNarrow()) return tkBarPhone(bar, t, l); bar.classList.remove('phnofit', 'tkphbar', 'phgrow');
    bar.classList.toggle('adding', !!TK.adding);
    // Adding: the bar becomes the field. Otherwise it names the task you're on and what you can do to it, with New task at the end.
    if (TK.adding) setBar(bar, `<label class="tkbadd">${ic('plus')}<input data-tkadd placeholder="${l ? `Add to ${l.n}` : 'Add a task'}, like “Call Theo tomorrow 3pm”" value="${esc(TK.draft)}" autocomplete="off"><span class="tkchips" id="tk-chips"></span></label><button class="bt" type="button" data-tkaddx>Done</button>`);
    else setBar(bar, `${t && TK.det ? `<span class="ctxc tkctx"><i class="tkdot" style="--h:${tkL(t.l).h}"></i><span>${esc(t.t)}</span><button type="button" class="crx" data-tkdetx aria-label="Close">${ic('x')}</button></span><button class="ib" type="button" data-tkdue title="Due date" aria-label="Due date">${ic('calendar')}</button><button class="ib" type="button" data-tkmove title="Move to list" aria-label="Move to list">${ic('list')}</button><button class="ib" type="button" data-tkmore title="More" aria-label="More">${ic('ellipsis')}</button><span class="vr"></span>` : ''}<button class="bt key" type="button" data-tknew>${ic('plus')}New task</button>`);
    if (TK.adding) { const i = $('[data-tkadd]'); requestAnimationFrame(() => { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); } return;
    setBar(bar, t && !t.done ? `<button class="bt key" type="button" data-tkck="${t.id}">${ic('check')}Complete</button><button class="bt" type="button" data-tkwhen="0">Today</button><button class="bt" type="button" data-tkwhen="1">Tomorrow</button><span class="vr"></span><button class="ib" type="button" data-tkmore title="More">${ic('ellipsis')}</button>`
      : `<button class="bt key" type="button" data-tknew>${ic('plus')}New task</button><button class="bt" type="button" data-tkplan>${ic('sunrise')}Plan my day</button>`); }
  function tkAll() { tkSide(); tkMain(); tkDetail(); tkBar(); }
  /* ── Plan my day (phone): the week's loose tasks as a stack of cards. Swipe right for today, left for not today; the
     card tilts and lights the way it's going. At the end, what today now holds. ── */
  function tkPlan() { let el = $('#tk-plan'); const P = TK.plan; if (!P) { el?.remove(); return; } if (!el) { $('#w-tasks').insertAdjacentHTML('beforeend', '<div class="tkplan" id="tk-plan"></div>'); el = $('#tk-plan'); }
    const card = (t, k) => { const l = tkL(t.l); return `<div class="tkpc${k ? ' back' : ''}" style="--k:${k}" data-tkpc="${t.id}"><span class="tkpcl"><i class="tkdot" style="--h:${l.h}"></i>${esc(l.n)}</span><h2>${esc(t.t)}</h2>
      <p class="tkpcm">${t.due < 0 ? `<em class="late">${ic('calendar')}Was due ${tkDay(t.due).toLowerCase()}</em>` : t.due != null ? `<em>${ic('calendar')}${tkDay(t.due)}</em>` : '<em>No date</em>'}${t.time ? `<em>${ic('clock')}${t.time}</em>` : ''}${t.subs.length ? `<em>${ic('list')}${t.subs.filter(x => x[1]).length}/${t.subs.length} steps</em>` : ''}</p>
      ${t.notes ? `<p class="tkpcn">${esc(t.notes)}</p>` : ''}${t.who.filter(k => k !== 'me').length ? `<span class="tkpcw">${t.who.filter(k => k !== 'me').map(k => tkAv(k, 26)).join('')}<small>With ${t.who.filter(k => k !== 'me').map(tkName).join(', ')}</small></span>` : ''}<b class="tkstamp r">Today</b><b class="tkstamp l">Not today</b></div>`; };
    if (P.i >= P.ids.length) { const today = TKT.filter(t => !t.done && t.due === 0 || t.due < 0 && !t.done);
      el.innerHTML = `<div class="tkph"><b>Plan my day</b><button class="ib" type="button" data-tkplanx aria-label="Close">${ic('x')}</button></div><div class="tkpend"><span class="tkpendi">${ic('sunrise')}</span><h2>Today holds ${today.length} thing${today.length === 1 ? '' : 's'}</h2><p>You added ${P.yes.length} and moved ${P.no.length} to later.</p><div class="tkpendl">${today.slice(0, 6).map(t => `<span><i class="tkdot" style="--h:${tkL(t.l).h}"></i>${esc(t.t)}</span>`).join('')}</div><button class="bt pri tkpgo" type="button" data-tkplanx>Start the day</button></div>`; return; }
    const rest = P.ids.slice(P.i, P.i + 3).map(tkTask);
    el.innerHTML = `<div class="tkph"><b>Plan my day</b><span>${P.i + 1} of ${P.ids.length}</span><button class="ib" type="button" data-tkplanx aria-label="Close">${ic('x')}</button></div><div class="tkpstack">${rest.map((t, k) => card(t, k)).reverse().join('')}</div>
      <div class="tkpacts"><button class="tkpno" type="button" data-tkpdo="-1">${ic('arrow-left')}<span>Not today</span></button><button class="tkpskip" type="button" data-tkpdo="0">Skip</button><button class="tkpyes" type="button" data-tkpdo="1"><span>Today</span>${ic('arrow-right')}</button></div>`;
    const top = el.querySelector('.tkpc:not(.back)'); if (!top) return; let x0 = null, dx = 0;
    top.onpointerdown = e => { x0 = e.clientX; top.setPointerCapture(e.pointerId); top.style.transition = 'none'; };
    top.onpointermove = e => { if (x0 == null) return; dx = e.clientX - x0; top.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; top.classList.toggle('gor', dx > 60); top.classList.toggle('gol', dx < -60); };
    top.onpointerup = () => { if (x0 == null) return; x0 = null; top.style.transition = ''; if (Math.abs(dx) > 100) tkPlanDo(dx > 0 ? 1 : -1); else { top.style.transform = ''; top.classList.remove('gor', 'gol'); } dx = 0; }; }
  function tkPlanDo(d) { const P = TK.plan, t = tkTask(P.ids[P.i]), top = $('#tk-plan .tkpc:not(.back)');
    if (d > 0) { t.due = 0; t.act.push(['me', 'planned this for today', 'Just now']); P.yes.push(t.id); } else if (d < 0) { if (t.due == null || t.due <= 0) t.due = 1; P.no.push(t.id); }
    if (top) { top.style.transition = 'transform .28s var(--ease), opacity .28s'; top.style.transform = d ? `translateX(${d * 480}px) rotate(${d * 18}deg)` : 'translateY(-40px) scale(.9)'; top.style.opacity = 0; }
    setTimeout(() => { P.i++; tkPlan(); tkMain(); }, 240); }
  function tkToast(msg, undo) { tkToast.u = undo; lToast($('#w-tasks'), msg, { undo }); }
  function tkPop(anchor, html, up) { if (anchor.closest('#tk-bar')) up = true; $('#tk-pop')?.remove(); const w = $('#w-tasks'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop" id="tk-pop">${html}</div>`); const p = $('#tk-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left)) + 'px'; if (up) p.style.bottom = (wr.bottom - r.top + 8) + 'px'; else p.style.top = (r.bottom - wr.top + 6) + 'px'; }
  /* "Call Theo tomorrow 3pm !high #Launch @Priya" */
  function tkParse(s) { const o = { t: s }; const take = (re, f) => { const m = o.t.match(re); if (m) { f(m); o.t = o.t.replace(m[0], ' '); } };
    take(/\b(today|tonight)\b/i, () => o.due = 0); take(/\btomorrow\b/i, () => o.due = 1); take(/\bnext week\b/i, () => o.due = 7);
    take(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i, m => { const d = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1].toLowerCase()); o.due = ((d - 3 + 7) % 7) || 7; });
    take(/\b(\d{1,2})(?::(\d\d))?\s?(am|pm)\b/i, m => o.time = `${m[1]}:${m[2] || '00'} ${m[3].toUpperCase()}`);
    take(/!+(high|med(?:ium)?|low)?/i, m => o.pri = m[1] ? { high: 3, med: 2, medium: 2, low: 1 }[m[1].toLowerCase()] : Math.min(3, m[0].length));
    take(/#(\w+)/, m => { const l = TKL.find(x => x.n.toLowerCase().startsWith(m[1].toLowerCase())); if (l) o.l = l.id; });
    take(/@(\w+)/, m => { const k = Object.keys(PPL).find(k => PPL[k].n.toLowerCase().startsWith(m[1].toLowerCase())); if (k) o.who = [k]; });
    o.t = o.t.replace(/\s+/g, ' ').trim(); return o; }
  function tkClick(e, hit) { const q = s => hit(s);
    if (q('[data-tkplango]')) { TK.plan = { ids: TKT.filter(t => !t.done && t.due !== 0).slice(0, 6).map(t => t.id), i: 0, yes: [], no: [] }; tkPlan(); return true; }
    const pd = q('[data-tkpdo]'); if (pd) { tkPlanDo(+pd.dataset.tkpdo); return true; }
    if (q('[data-tkplanx]')) { const P = TK.plan; TK.plan = null; tkPlan(); tkAll(); if (P && P.yes.length) tkToast(`${P.yes.length} added to today`); return true; }
    if (tkNarrow()) { const px = q('[data-tkpx]'); if (px) { const k = px.dataset.tkpx; TK.px = TK.px === k ? '' : k; tkBar(); return true; } if (q('[data-tkview]') || q('[data-tktodo]')) TK.px = ''; }
    if (!q('#tk-pop') && !q('[data-tkmore],[data-tkdue],[data-tkassign],[data-tkmove],[data-tkshare]')) $('#tk-pop')?.remove();
    const vw = q('[data-tkview]'); if (vw) { TK.view = vw.dataset.tkview; const f = TKT.find(t => tkIn(t, TK.view) && !t.done); TK.sel = f?.id || null; tkAll(); return true; }
    const ck = q('[data-tkck]'); if (ck) { const t = tkTask(ck.dataset.tkck); t.done = !t.done; if (t.done) { const row = $(`[data-tkpick="${t.id}"]`); row?.classList.add('going'); t.act.push(['me', 'completed this', 'Just now']); setTimeout(() => { if (TK.sel === t.id) { const nx = TKT.find(x => tkIn(x, TK.view) && !x.done); TK.sel = nx?.id || t.id; } tkAll(); }, 420); tkToast(`Done: ${t.t}`, () => { t.done = false; t.act.pop(); TK.sel = t.id; tkAll(); }); $(`[data-tkpick="${t.id}"] .tkck`)?.classList.add('on'); } else tkAll(); return true; }
    if (q('[data-tkdetx]')) { TK.det = false; tkDetail(); tkBar(); return true; }
    const pk = q('[data-tkpick]'); if (pk && !q('button')) { TK.sel = pk.dataset.tkpick; TK.det = true; $$('#tk-body .tkrow').forEach(r => r.classList.toggle('sel', r.dataset.tkpick === TK.sel)); tkDetail(); tkBar(); return true; }
    const td = q('[data-tktodo]'); if (td) { tkToast(td.dataset.tktodo); return true; }
    if (q('[data-tknew]')) { TK.adding = true; tkBar(); return true; }
    if (q('[data-tkaddx]')) { TK.adding = false; TK.draft = ''; tkBar(); return true; }
    if (q('[data-tkplan]')) { TK.view = 'today'; TK.sug = true; tkAll(); tkToast('Three tasks from this week could fit today'); return true; }
    const tt = q('[data-tktoday]'); if (tt) { const t = tkTask(tt.dataset.tktoday), was = t.due; t.due = 0; t.act.push(['me', 'moved this to today', 'Just now']); tkAll(); tkToast(`Added to today: ${t.t}`, () => { t.due = was; t.act.pop(); tkAll(); }); return true; }
    if (q('[data-tksugx]')) { TK.sug = false; tkMain(); return true; }
    if (q('[data-tkshowdone]')) { TK.showDone = !TK.showDone; tkMain(); return true; }
    const wn = q('[data-tkwhen]'); if (wn) { const t = tkTask(TK.sel); t.due = +wn.dataset.tkwhen; t.act.push(['me', `moved this to ${tkDay(t.due).toLowerCase()}`, 'Just now']); tkAll(); tkToast(`Moved to ${tkDay(t.due).toLowerCase()}`); return true; }
    if (q('[data-tkflag]')) { const t = tkTask(TK.sel); t.flag = !t.flag; tkAll(); return true; }
    const pr = q('[data-tkpri]'); if (pr) { const t = tkTask(TK.sel); t.pri = +pr.dataset.tkpri; tkAll(); return true; }
    const sb = q('[data-tksub]'); if (sb) { const t = tkTask(TK.sel), s = t.subs[+sb.dataset.tksub]; s[1] = !s[1]; if (s[1]) t.act.push(['me', `finished “${s[0]}”`, 'Just now']); tkDetail(); tkMain(); return true; }
    if (q('[data-tksend]')) { tkComment(); return true; }
    if (q('[data-tkdue]')) { tkPop(q('[data-tkdue]'), [[0, 'Today', 'sun'], [1, 'Tomorrow', 'sunrise'], [3, 'This weekend', 'calendar'], [7, 'Next week', 'calendar'], [null, 'No date', 'x']].map(([d, n, i]) => crMi(`data-tkdueset="${d}"`, i, `${n}${d != null ? `<small>${tkDay(d)}</small>` : ''}`)).join('')); return true; }
    const ds = q('[data-tkdueset]'); if (ds) { const t = tkTask(TK.sel); t.due = ds.dataset.tkdueset === 'null' ? null : +ds.dataset.tkdueset; $('#tk-pop')?.remove(); tkAll(); return true; }
    if (q('[data-tkassign]')) { const t = tkTask(TK.sel), l = tkL(t.l); tkPop(q('[data-tkassign]'), `<div class="tkasp"><h6 class="mnph">Assign to</h6>${['me', ...l.ppl].map(k => `<button class="tkaw${t.who.includes(k) ? ' on' : ''}" type="button" data-tkwho="${k}">${tkAv(k, 28)}<span><b>${k === 'me' ? 'You' : PPL[k].n}</b><small>${k === 'me' ? 'Owner' : PPL[k].u ? '@' + PPL[k].u : 'Can edit'}</small></span>${t.who.includes(k) ? ic('check') : ''}</button>`).join('')}<span class="crsep"></span><button class="crmi" type="button" data-tktodo="${l.ppl.length ? `Invite someone to ${l.n}: they'll see every task in it` : `Share ${l.n} first. Then you can assign its tasks`}">${ic('user-plus')}<span>${l.ppl.length ? `Invite someone to ${l.n}…` : `Share ${l.n} to assign people…`}</span></button></div>`); return true; }
    const wh = q('[data-tkwho]'); if (wh) { const t = tkTask(TK.sel), k = wh.dataset.tkwho; t.who = t.who.includes(k) ? t.who.filter(x => x !== k) : [...t.who, k]; if (t.who.includes(k)) t.act.push(['me', `assigned this to ${tkName(k)}`, 'Just now']); $('#tk-pop')?.remove(); tkAll(); return true; }
    if (q('[data-tkmove]')) { tkPop(q('[data-tkmove]'), TKL.map(l => `<button class="crmi" type="button" data-tkmoveto="${l.id}"><i class="tkdot" style="--h:${l.h}"></i><span>${l.n}</span></button>`).join('')); return true; }
    const mv = q('[data-tkmoveto]'); if (mv) { const t = tkTask(TK.sel); t.l = mv.dataset.tkmoveto; t.sec = 0; $('#tk-pop')?.remove(); tkAll(); tkToast(`Moved to ${tkL(t.l).n}`); return true; }
    if (q('[data-tkshare]')) { const l = tkL(TK.view); tkPop(q('[data-tkshare]'), `<div class="tkshp"><h6 class="mnph">Sharing ${l.n}</h6>${['me', ...l.ppl].map(k => `<div class="tkshr">${tkAv(k, 28)}<span><b>${k === 'me' ? 'You' : PPL[k].n}</b><small>${k === 'me' ? 'Owner' : 'Can edit'}</small></span></div>`).join('')}<label class="tkinv">${ic('plus')}<input placeholder="Invite by name or @username" data-tkinv></label><button class="crmi" type="button" data-tktodo="Link copied. Anyone with it can view">${ic('link')}<span>Copy a view-only link</span></button></div>`); return true; }
    if (q('[data-tkmore]')) { tkPop(q('[data-tkmore]'), crMi('data-tktodo="Duplicated"', 'copy', 'Duplicate') + crMi('data-tktodo="Pick a list below"', 'list', 'Move to list…') + crMi('data-tktodo="Converted into a list with 0 tasks"', 'layers', 'Turn into a list') + '<span class="crsep"></span>' + crMi('data-tkdel', 'trash-2', 'Delete', ' red'), true); return true; }
    if (q('[data-tkdel]')) { const i = TKT.findIndex(t => t.id === TK.sel), t = TKT.splice(i, 1)[0]; $('#tk-pop')?.remove(); TK.sel = TKT.find(x => tkIn(x, TK.view) && !x.done)?.id || null; tkAll(); tkToast(`Deleted: ${t.t}`, () => { TKT.splice(i, 0, t); TK.sel = t.id; tkAll(); }); return true; }
    return false; }
  function tkComment() { const i = $('[data-tkcomment]'), t = tkTask(TK.sel); if (!i?.value.trim()) return; t.act.push(['me', 'c', i.value.trim(), 'Just now']); tkDetail(); tkMain(); const s = $('#tk-det .scr'); s.scrollTop = s.scrollHeight; }
  function renderTasks() { $('#tk-top').innerHTML = `<img src="../icons/Suno-v4-tasks.svg" alt=""><b>Tasks</b><span class="chev">${ic('chevron-down')}</span>`; tkAll(); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-tkq]')) { TK.q = e.target.value; tkMain(); return; }
    if (e.target.matches?.('[data-tkadd]')) { TK.draft = e.target.value; const o = tkParse(e.target.value), c = $('#tk-chips'); if (!c) return;
      c.innerHTML = [o.due != null ? `<i>${ic('calendar')}${tkDay(o.due)}${o.time ? ', ' + o.time : ''}</i>` : o.time ? `<i>${ic('clock')}${o.time}</i>` : '', o.pri ? `<i style="color:${TKPRI[o.pri][1]}">${ic('flag')}${TKPRI[o.pri][0]}</i>` : '', o.l ? `<i><b class="tkdot" style="--h:${tkL(o.l).h}"></b>${tkL(o.l).n}</i>` : '', o.who ? `<i>${tkAv(o.who[0], 16)}${tkName(o.who[0])}</i>` : ''].join(''); }
    if (e.target.matches?.('[data-tktitle]')) { tkTask(TK.sel).t = e.target.textContent.trim(); clearTimeout(tkSide.t); tkSide.t = setTimeout(tkMain, 400); }
    if (e.target.matches?.('[data-tknotes]')) tkTask(TK.sel).notes = e.target.innerText; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.matches?.('[data-tkadd]')) { TK.adding = false; TK.draft = ''; tkBar(); return; } if (e.key !== 'Enter') return;
    if (e.target.matches?.('[data-tkadd]') && e.target.value.trim()) { TK.draft = ''; const o = tkParse(e.target.value), l = tkL(TK.view); const t = tkT({ t: o.t || 'New task', l: o.l || (l ? l.id : 'personal'), due: o.due ?? (TK.view === 'today' ? 0 : null), time: o.time, pri: o.pri || 0, who: o.who || [], act: [['me', 'created this', 'Just now']] }); TKT.unshift(t); TK.sel = t.id; tkAll(); $('[data-tkadd]').focus(); tkToast(`Added to ${tkL(t.l).n}${t.due != null ? ', ' + tkDay(t.due).toLowerCase() : ''}`); }
    if (e.target.matches?.('[data-tksubadd]') && e.target.value.trim()) { tkTask(TK.sel).subs.push([e.target.value.trim(), false]); tkDetail(); tkMain(); $('[data-tksubadd]').focus(); }
    if (e.target.matches?.('[data-tkcomment]')) tkComment();
    if (e.target.matches?.('[data-tkinv]') && e.target.value.trim()) { $('#tk-pop')?.remove(); tkToast(`Invited ${e.target.value.trim()}. They’ll see ${tkL(TK.view).n} once they accept`); } });

  /* ══ Disks ═══════════════════════════════════════════════════════════════════
     Every drive and what's on it, as facts: sizes, formats, health readings, speeds. Everything GNOME Disks
     can do is here. Actions a volume can't take right now stay visible and locked, with the reason on hover.
     Anything that erases asks you to type the name first. */
  const dskSize = g => g >= 1000 ? (g / 1000).toFixed(g % 1000 ? 1 : 0).replace(/\.0$/, '') + ' TB' : g >= 1 ? Math.round(g) + ' GB' : Math.round(g * 1000) + ' MB';
  const DSKC = { blue: 'oklch(0.7 0.13 250)', violet: 'oklch(0.7 0.13 295)', amber: 'oklch(0.78 0.13 75)', green: 'oklch(0.72 0.14 155)', pink: 'oklch(0.72 0.14 350)', slate: 'oklch(0.62 0.03 250)' };
  const DSK = [
    { id: 'nvme', n: 'Suno SSD', grp: 'In this computer', kind: 'ssd', model: 'NVMe SSD, 512 GB', dev: '/dev/nvme0n1', size: 512, scheme: 'GPT', fixed: true,
      health: ['ok', 'Healthy', [['Bad sectors', '0'], ['Last self-test', 'Passed · today, 21:14'], ['Powered on', '2 yr 4 mo'], ['Temperature', '38 °C'], ['Written', '41 TB'], ['Spare blocks', '100%']]],
      speed: [3400, 2100],
      vols: [{ n: 'EFI', c: 'amber', size: .63, used: .015, fs: 'FAT32', mount: '/boot/efi', part: 'p1', uuid: '6B35-F4BE', role: 'The firmware reads this one first when the computer starts.', sys: true },
        { n: 'Boot', c: 'violet', size: 2.1, used: 1.4, fs: 'Ext4', mount: '/boot', part: 'p2', uuid: '8c1a33fe-b902-71dd-4c0a-90fe21b7c455', role: 'How this computer starts up.', sys: true },
        { n: 'Suno', c: 'blue', size: 509, used: 214, fs: 'Btrfs', mount: '/', part: 'p3', uuid: '4f7b21c8-9ea3-4d1e-bb70-2c5f9e18a4d2', role: 'Suno, your apps, and everything in your Home folder.', sys: true }] },
    { id: 'ext', n: 'Archive HD', grp: 'Plugged in', kind: 'hdd', model: 'USB hard drive, 2 TB', dev: '/dev/sda', size: 2000, scheme: 'GPT',
      health: ['warn', 'Needs attention', [['Bad sectors', '3', 'warn'], ['Last self-test', 'Passed · 12 Sep'], ['Powered on', '6 yr 1 mo'], ['Temperature', '44 °C'], ['Written', '96 TB'], ['Spare blocks', '91%', 'warn']]],
      speed: [118, 104],
      vols: [{ n: 'Archive', c: 'green', size: 1400, used: 1180, fs: 'Btrfs', mount: '/run/media/nick/Archive', part: '1', uuid: 'a91e77d2-0c3b-4a55-9f18-6d2e40bb7c31', role: 'Your backups and finished projects.' },
        { n: 'Vault', c: 'slate', size: 180, used: 64, fs: 'Btrfs', luks: true, locked: true, mount: null, part: '2', uuid: '3d0f88aa-51e2-4c7b-8a02-7e11c9a3f6d4', role: 'Encrypted. Nothing on it can be read without the passphrase.' },
        { n: 'Scratch', c: 'pink', size: 400, used: 12, fs: 'exFAT', mount: null, part: '3', uuid: '9C4A-11D7', role: 'Readable on Windows and Macs as well.' }] },
    { id: 'usb', n: 'USB stick', grp: 'Plugged in', kind: 'usb', model: 'USB flash drive, 64 GB', dev: '/dev/sdb', size: 64, scheme: 'MBR',
      health: ['none', 'Not reported', []], speed: [152, 41],
      vols: [{ n: 'LUMA-1.0', c: 'amber', size: 6.2, used: 5.9, fs: 'ISO 9660', mount: null, part: '1', uuid: '2026-09-22-18-00-00-00', role: 'A Suno installer written to this stick. It can start a computer.' }] }
  ];
  const DSS = { cur: 'nvme', vol: 2, sheet: null, bench: null, test: null };
  const dskD = () => DSK.find(d => d.id === DSS.cur);
  const dskSegs = d => { const out = []; let at = 0; d.vols.forEach((v, i) => out.push({ ...v, i })); const used = d.vols.reduce((s, v) => s + v.size, 0); if (d.size - used > .5) out.push({ free: true, n: 'Free space', size: d.size - used, i: d.vols.length }); return out; };
  const dskIco = k => ({ ssd: 'hard-drive', hdd: 'database', usb: 'usb', iso: 'disc' }[k] || 'hard-drive');

  function dskSide() { const row = d => `<button class="si${DSS.cur === d.id ? ' on' : ''}" type="button" data-dskd="${d.id}" title="${esc(d.model)}">${ic(dskIco(d.kind))}<span class="lab">${esc(d.n)}</span>${d.health[0] === 'warn' ? '<i class="dskwarn" title="Needs attention"></i>' : ''}<em>${dskSize(d.size)}</em></button>`;
    const grp = g => DSK.filter(d => d.grp === g).map(row).join('');
    $('#dsk-side').innerHTML = `<div class="scr"><div class="sh">This computer</div>${grp('In this computer')}${DSK.some(d => d.grp === 'Plugged in') ? `<div class="sh">Plugged in</div>${grp('Plugged in')}` : ''}
      <div class="sh">Disk images<button class="ib" type="button" data-dskattach title="Attach a disk image…" aria-label="Attach a disk image">${ic('plus')}</button></div>${grp('Disk images') || '<p class="dskempty">None attached</p>'}</div>`; }
  function dskMain() { const d = dskD(), segs = dskSegs(d), v = segs[DSS.vol] || segs[0], H = d.health;
    const min = 4, tot = segs.reduce((s, x) => s + Math.max(x.size, d.size * min / 100), 0), used = d.vols.reduce((a, x) => a + (x.locked ? 0 : x.used), 0);
    $('#dsk-body').innerHTML = `<div class="dskpad"><header class="dskhd"><div><h1>${esc(d.n)}</h1><p>${esc(d.model)} · <span class="mono">${d.dev}</span> · ${d.scheme === 'GPT' ? 'GPT' : 'MBR'}</p></div>
        <button class="dskhp ${H[0]}" type="button" data-dsksheet="health">${ic(H[0] === 'ok' ? 'shield-check' : H[0] === 'warn' ? 'triangle-alert' : 'circle-help')}${H[1]}</button></header>
      <div class="dskmap" aria-hidden="true">${segs.map(s => { const w = Math.max(s.size, d.size * min / 100) / tot * 100; return `<button class="dskseg${s.free ? ' free' : ''}${DSS.vol === s.i ? ' on' : ''}" type="button" tabindex="-1" data-dskv="${s.i}" title="${esc(s.n)} · ${dskSize(s.size)}" style="flex:0 0 ${w.toFixed(2)}%;--c:${DSKC[s.c] || 'transparent'}">${s.free || s.locked ? '' : `<i class="u" style="width:${Math.min(100, s.used / s.size * 100)}%"></i>`}${w > 13 ? `<span><b>${s.locked ? ic('lock') : ''}${esc(s.n)}</b><small>${dskSize(s.size)}</small></span>` : ''}</button>`; }).join('')}</div>
