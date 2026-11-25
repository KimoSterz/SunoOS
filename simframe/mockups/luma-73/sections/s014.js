  desk.addEventListener('pointermove', e => { if (!drag) { if (document.documentElement.dataset.desktop === '1') { const w = e.target.closest('.win'); cur(w && !e.buttons ? edgeAt(w, e) : ''); } return; }
    const d = drag, dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.mode === 'move') { d.nx = Math.max(-d.w.offsetWidth + 160, Math.min(d.b.w - 160, d.ox + dx)); d.ny = Math.max(0, Math.min(d.b.h - d.b.dock - 60, d.oy + dy)); if (typeof dtHint === 'function' && document.documentElement.dataset.desktop === '1') dtHint(e); }
    else { const mw = 380, mh = 420, ed = d.ed;
      if (ed.includes('e')) d.nw = Math.max(mw, d.ow + dx); if (ed.includes('s')) d.nh = Math.max(mh, d.oh + dy);
      if (ed.includes('w')) { d.nw = Math.max(mw, d.ow - dx); d.nx = d.ox + d.ow - d.nw; } if (ed.includes('n')) { d.ny = Math.max(0, Math.min(d.oy + d.oh - mh, d.oy + dy)); d.nh = d.oy + d.oh - d.ny; } }
    if (!raf) raf = requestAnimationFrame(paint); });
  const endDrag = e => { if (!drag) return; const d = drag; drag = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } cur('');
    if (d.mode === 'move') { delete d.w.dataset.max; d.w.style.transform = ''; d.w.style.left = d.nx + 'px'; d.w.style.top = d.ny + 'px'; if (document.documentElement.dataset.desktop === '1' && e) dtSnap(d.w, e); }
    else Object.assign(d.w.style, { left: d.nx + 'px', top: d.ny + 'px', width: d.nw + 'px', height: d.nh + 'px' });
    void d.w.offsetWidth; requestAnimationFrame(() => d.w.classList.remove('drag')); settle(); };
  desk.addEventListener('pointerup', endDrag); desk.addEventListener('pointercancel', endDrag);
  desk.addEventListener('dblclick', e => { const b = e.target.closest('[data-drag]'); if (b && !e.target.closest('button,input,label')) { toggleMax(b.closest('.win')); setTimeout(settle, 320); } });
  desk.addEventListener('mousedown', e => { if (e.target.closest('#d-bar button, #d-insp button, #d-sel button, #w-write #lmenu button')) e.preventDefault(); });

  /* ══ One click handler ═════════════════════════════════════════════════ */
  desk.addEventListener('click', e => {
    const hit = s => e.target.closest(s), win = e.target.closest('.win');
    if (luiClick(e, hit)) return;
    if (hit('#lshare')) { shClick(e, hit); return; }
    if (hit('#lpick')) { lPickClick(e, hit); return; }
    const wb = hit('[data-w]'); if (wb) { const w = wb.closest('.win'), a = wb.dataset.w; if (a === 'close') w.hidden = true; if (a === 'min') w.classList.add('min'); if (a === 'max') { toggleMax(w); setTimeout(settle, 320); } syncDock(); return; }
    const dk = hit('.dk[data-app]'); if (dk) { const w = $('#w-' + dk.dataset.app); if (w.hidden || w.classList.contains('min')) { w.hidden = false; w.classList.remove('min'); focusWin(w); } else if (dk.classList.contains('front')) { w.classList.add('min'); syncDock(); } else focusWin(w); requestAnimationFrame(settle); return; }
    if (hit('[data-navtoggle]')) { win.classList.toggle('navopen'); return; }
    if (win && win.classList.contains('navopen') && hit('.ri')) win.classList.remove('navopen');
    if (sh0(hit)) return;
    const sh = hit('[data-share]'); if (sh && !(sh.closest('#w-notes') && nNarrow())) { shOpen(sh); return; }   /* Notes on a phone shares from its bar */
    const dm = hit('[data-docmore]'); if (dm) { lMenu(dm, crMi('data-docdo="export"', 'share', 'Export as PDF\u2026') + crMi('data-docdo="print"', 'printer', 'Print\u2026') + crMi('data-docdo="history"', 'history', 'Version history') + '<span class="crsep"></span>' + crMi('data-docdo="dup"', 'copy', 'Duplicate') + crMi('data-docdo="move"', 'folder-input', 'Move to\u2026') + '<span class="crsep"></span>' + crMi('data-docdo="trash"', 'trash-2', 'Move to Trash', ' red')); return; }
    const dd = hit('[data-docdo]'); if (dd) { $('#lmenu')?.remove(); lToast(win, { export: 'Choose where to save the PDF', print: 'Printing on Brother HL-L2350DW', history: 'Version history opens beside the document', dup: 'A copy opens in a new window', move: 'Choose a folder to move it to', trash: 'Moved to Trash. Undo from the Trash in Filer.' }[dd.dataset.docdo]); return; }
    if (!win) return;
    const app = win.dataset.app;
    if (app === 'lumaui') { luiClickApp(e, hit); return; }
    if (app === 'filer') {
      const fp = hit('[data-fplace]'); if (fp) { const k = fp.dataset.fplace; if (FROOT[k]) fGo(FROOT[k], []); else fGo('Home', FPLACE[k] ? [FPLACE[k]] : []); renderFiler(); return; }
      if (hit('[data-fcopy]')) { lToast(win, `${esc(F.sel)} copied. Paste it into any folder.`); return; }
      const fm = hit('[data-fmore]'); if (fm) { const x = fSelFile(); lMenu(fm, (x && x.k !== 'folder' ? crMi('data-fopenin', 'app-window', 'Open in\u2026') + '<span class="crsep"></span>' : '') + crMi('data-fdo="rename"', 'pencil', 'Rename…') + crMi('data-fdo="dup"', 'copy', 'Duplicate') + crMi('data-fdo="move"', 'folder-input', 'Move to…') + crMi('data-fdo="zip"', 'file-archive', 'Compress') + '<span class="crsep"></span>' + crMi('data-fdo="trash"', 'trash-2', 'Move to Trash', ' red')); $('#lmenu')?.classList.add('ldrawer'); return; }
      const fd = hit('[data-fdo]'); if (fd) { $('#lmenu')?.remove(); F.selExp = null; const k = fd.dataset.fdo, n = F.sel;
        if (k === 'trash') { const L = fHere(), i = L.findIndex(x => x.n === n); if (i >= 0) L.splice(i, 1); F.sel = null; filerBody(); filerBar(); filerTitle(); filerInfo(); lToast(win, `${esc(n)} moved to Trash`); return; }
        if (k === 'dup') { const L = fHere(), x = L.find(y => y.n === n), dot = n.lastIndexOf('.'), nn = dot > 0 ? `${n.slice(0, dot)} copy${n.slice(dot)}` : `${n} copy`; L.splice(L.indexOf(x) + 1, 0, { ...x, n: nn, mod: 'Just now' }); F.sel = nn; filerBody(); filerBar(); filerTitle(); return; }
        lToast(win, { rename: 'Type a new name, then press Return', move: 'Choose a folder to move it to', zip: `${esc(n)}.zip is ready` }[k]); return; }
      const fs = hit('[data-fscope]'); if (fs) { F.scope = fs.dataset.fscope; filerBody(); filerTitle(); if (fNarrow()) filerBar(); return; }
      if (hit('[data-fqx]')) { F.q = ''; const q = $('#f-q'); if (q) { q.value = ''; q.focus(); } filerBody(); filerTitle(); return; }
      const fso = hit('[data-fsort]'); if (fso) { const k = fso.dataset.fsort; F.sort = { k, dir: F.sort.k === k ? -F.sort.dir : 1 }; filerBody(); $(`#f-body [data-fsort="${k}"]`)?.focus(); return; }
      const fv = hit('[data-fview]'); if (fv) { F.view = fv.dataset.fview; if (F.view === 'cols' && !F.info && !win.classList.contains('phone')) { F.info = true; filerInfo(); } filerBody(); filerBar(); return; }
      const fc = hit('[data-fcol]'); if (fc) { const i = +fc.dataset.fcol, n = fc.dataset.fname, x = fDir([F.root, ...F.path][i]).find(y => y.n === n);
        if (x?.k === 'folder') fGo(F.root, [...F.path.slice(0, i), n]); else fGo(F.root, F.path.slice(0, i), n); renderFiler(); return; }
      const cr = hit('[data-fcrumb]'); if (cr) { fGo(F.root, F.path.slice(0, +cr.dataset.fcrumb)); renderFiler(); return; }
      if (hit('[data-fup]')) { fHist(-1); renderFiler(); return; }
      if (hit('[data-ffwd]')) { fHist(1); renderFiler(); return; }
      const fg = hit('[data-fgo]'); if (fg) { fGo('Home', fg.dataset.fgo ? fg.dataset.fgo.split('/') : [], fg.dataset.fname); renderFiler(); return; }
      if (hit('[data-fopen]')) { fGo(F.root, [...F.path, F.sel]); renderFiler(); return; }
      if (hit('[data-fopenin]') && fNarrow()) { F.selExp = 'openin'; filerBar(); return; }
      if (hit('[data-fopenin]')) { $('#lmenu')?.remove(); const x = fSelFile(); if (x) lOpenIn($('#f-bar [data-fmore]'), fKind(x.k), x.n); return; }
      if (hit('[data-ftodo]')) return;
      if (hit('[data-fpanelclose]')) setTimeout(() => { F.selExp = null; filerBar(); }, 0);
      const sx = hit('[data-fsexp]'); if (sx) { F.selExp = F.selExp === sx.dataset.fsexp ? null : sx.dataset.fsexp; filerBar(); return; }
      const st2 = hit('[data-fsendto], [data-fsendvia]'); if (st2) { const x = fSelFile(), to = st2.dataset.fsendto ? ppl(st2.dataset.fsendto).n.split(' ')[0] : null; F.selExp = null; filerBar(); lToast(win, to ? `Sent ${esc(x?.n || '')} to ${esc(to)}` : st2.dataset.fsendvia === 'Copy link' ? 'Link copied' : `Sharing ${esc(x?.n || '')} with ${st2.dataset.fsendvia}`, { icon: 'share-2' }); return; }
      if (hit('[data-fmovestart]')) { const x = fSelFile(); if (x) { F.moving = { x, from: [F.root, ...F.path], list: fHere() }; F.sel = null; F.selExp = null; filerBody(); filerBar(); } return; }
      if (hit('[data-fmovex]')) { F.moving = null; filerBar(); return; }
      if (hit('[data-fmovehere]')) { const m = F.moving, L = m.list, i = L.indexOf(m.x); if (i >= 0) L.splice(i, 1); fHere().unshift({ ...m.x, mod: 'Just now' }); F.moving = null; F.sel = m.x.n; filerBody(); filerTitle(); filerBar(); lToast(win, `Moved ${esc(m.x.n)} to ${esc(fCur())}`, { icon: 'folder-input' }); return; }
      if (hit('[data-fparent]')) { F.sel = null; F.exp = false; fGo(F.root, F.path.slice(0, -1)); renderFiler(); return; }
      if (hit('[data-fexp]')) { F.exp = !F.exp; filerBar(); return; }
      const fsrt = hit('[data-fsortby]'); if (fsrt) { const k = fsrt.dataset.fsortby; F.sort = { k, dir: F.sort.k === k ? -F.sort.dir : (k === 'mod' || k === 'size' ? -1 : 1) }; filerBar(); filerBody(); return; }
      if (hit('[data-fnewtodo]')) { F.exp = false; filerBar(); lToast(win, 'New folder', { icon: 'folder-plus' }); return; }
      if (hit('[data-fseltodo]')) { F.exp = false; filerBar(); lToast(win, 'Tap files to select them', { icon: 'circle-check' }); return; }
      if (hit('[data-fmovetodo]')) { lToast(win, 'Choose where to move it', { icon: 'folder-input' }); return; }
      const fi0 = hit('[data-file]'); if (fi0 && fNarrow() && F.moving) { const x = fHere().find(y => y.n === fi0.dataset.file); if (x?.k === 'folder') { fGo(F.root, [...F.path, x.n]); renderFiler(); } return; }
      if (fi0 && fNarrow()) { const x = fHere().find(y => y.n === fi0.dataset.file); if (x?.k === 'folder') { F.sel = null; F.exp = false; fGo(F.root, [...F.path, x.n]); renderFiler(); return; } }
      const fi = hit('[data-file]'); if (fi) { F.selExp = null; F.sel = fi.dataset.file; filerBody(); filerBar(); filerInfo(); return; }
      if (hit('[data-finfo]')) { F.info = !F.info; filerBar(); filerInfo(); return; }
      if (hit('[data-fdesel]') || (hit('#f-body') && !hit('[data-file]') && !hit('.fcols'))) { F.sel = null; filerBody(); filerBar(); filerInfo(); return; }
    }
    if (app === 'photos') {
      const psz = hit('[data-psz]'); if (psz) { P.size = Math.max(96, Math.min(340, P.size + 40 * +psz.dataset.psz)); $('#w-photos').style.setProperty('--pcs', P.size + 'px'); const r = $('#p-bar [data-psize]'); if (r) r.value = P.size; pCorners(); return; }
      const mm = hit('[data-pmem]'); if (mm) { const [t, l] = P.mems[+mm.dataset.pmem]; $('#p-memp')?.remove(); clearInterval(P.memi);
        $('#w-photos').insertAdjacentHTML('beforeend', `<div class="pmemp" id="p-memp"><div class="pmemi">${l.map(x => `<img src="${x.src}" alt="">`).join('')}</div><div class="pmembar">${l.map(() => '<i><u></u></i>').join('')}</div><div class="pmemt"><b>${esc(t)}</b><small>${esc(l[0].place)} · ${l.length} photos</small></div><button class="ib pmemx" type="button" data-pmemx aria-label="Close">${ic('x')}</button><button class="pmemtap l" type="button" data-pmemstep="-1" aria-label="Previous"></button><button class="pmemtap r" type="button" data-pmemstep="1" aria-label="Next"></button></div>`);
        let i = -1; const show = n => { const el = $('#p-memp'); if (!el) { clearInterval(P.memi); return; } i = (n + l.length) % l.length; el.querySelectorAll('.pmemi img').forEach((im, k) => im.classList.toggle('on', k === i)); el.querySelectorAll('.pmembar i').forEach((b, k) => { b.className = k < i ? 'done' : k === i ? 'now' : ''; }); };
        P.memShow = d => { show(i + d); clearInterval(P.memi); P.memi = setInterval(() => show(i + 1), 3200); }; requestAnimationFrame(() => P.memShow(1)); return; }
      const ms = hit('[data-pmemstep]'); if (ms) { P.memShow(+ms.dataset.pmemstep); return; }
      if (hit('[data-pmemx]')) { clearInterval(P.memi); $('#p-memp')?.remove(); return; }
      if (pNarrow()) { const px = hit('[data-ppx]'); if (px) { const k = px.dataset.ppx; P.px = P.px === k ? (k === 'del' ? 'more' : '') : k; if (k === 'search' && !P.px) { P.q = ''; photosBody(); } photosBar(); return; }
        if (hit('[data-pnewalbum]')) { P.px = 'album'; photosBar(); setTimeout(() => $('#p-bar [data-palname]')?.focus(), 30); return; }
        if (hit('[data-palmk]')) { const n = $('#p-bar [data-palname]')?.value.trim(); P.px = ''; photosBar(); lToast(win, n ? `Made the album ${n}` : 'Made a new album'); return; }
        const qs = hit('[data-pqset]'); if (qs) { P.q = P.q.toLowerCase() === qs.dataset.pqset.toLowerCase() ? '' : qs.dataset.pqset; photosBody(); photosBar(); return; }
        const ad = hit('[data-padd]'); if (ad) { const k = ad.dataset.padd; P.px = ''; photosBar(); if (k === 'files') { if (window.lumaDesk) { if (typeof fpStart === 'function') fpStart('photos-add'); lumaDesk.open('picker'); } else lToast(win, 'Choose photos in Files'); } else if (k === 'clip') lToast(win, 'Added the photo you copied'); else lToast(win, `Adding ${P.drive.c} photos from ${P.drive.n}`); return; }
        const pd = hit('[data-pdo]'); if (pd) { P.px = ''; photosBar(); lToast(win, pd.dataset.pdo); return; }
        const pg = hit('[data-pgo]'); if (pg) { P.viewer = +pg.dataset.pgo; photosBar(); return; }
        if (hit('[data-pdel]') || hit('[data-pview]') || hit('[data-pclose]') || hit('[data-pedit]')) P.px = ''; }
      const pv = hit('[data-pview]'); if (pv) { P.view = pv.dataset.pview; P.viewer = null; renderPhotos(); return; }
      if (hit('[data-pedit]')) { P.edit = true; P.ed = { ...(P.edits[P.viewer] || {}) }; photosBar(); lAC.open($('#p-ed')); return; }
      const pt = hit('[data-pedtab]'); if (pt) { P.edTab = pt.dataset.pedtab; photosBar(); return; }
      const pp = hit('[data-ppre]'); if (pp) { P.ed.pre = pp.dataset.ppre; photosBar(); return; }
      if (hit('[data-pauto]')) { P.ed = { ...P.ed, e: 10, c: 16, hi: -18, sh: 22, sat: 10, w: 4 }; photosBar(); return; }
      if (hit('[data-prot]')) { P.ed.rot = ((P.ed.rot || 0) - 90) % 360; photosBar(); return; }
      if (hit('[data-pflip]')) { P.ed.flip = !P.ed.flip; photosBar(); return; }
      if (hit('[data-pcrop]')) { lToast(win, 'Drag the corners to crop. Hold Shift to keep the shape.'); return; }
      if (hit('[data-prevert]')) { P.ed = {}; photosBar(); return; }
      if (hit('[data-pedx]')) { P.edit = false; photosBar(); return; }
      if (hit('[data-peddone]')) { const k = P.viewer; if (Object.keys(P.ed).length) P.edits[k] = { ...P.ed }; else delete P.edits[k]; P.edit = false; photosBar(); photosBody(); lToast(win, 'Saved. Revert to the original any time from Edit.'); return; }
      const pim = hit('[data-pimport]'); if (pim) { const th = PHOTOS.slice(0, 4).map(x => `<img src="${x.src}" alt="">`).join('');
        lMenu(pim, `<div class="pimp"><h6>Import</h6><div class="pimpdev">${ic('smartphone')}<span><b>Pixel 9</b><small>38 new photos since September 19</small></span></div><div class="pimps">${th}<span>+34</span></div><button class="bt pri" type="button" data-pimpall>Import all 38</button></div><span class="crsep"></span>${crMi('data-pimpfolder', 'folder', 'From a folder…')}${crMi('data-pimpcard disabled title="Insert a memory card"', 'hard-drive', 'From a memory card')}`); return; }
      if (hit('[data-pimpall]')) { $('#lmenu')?.remove(); lToast(win, 'Importing 38 photos from Pixel 9'); return; }
      if (hit('[data-pimpfolder]')) { $('#lmenu')?.remove(); if (window.lumaDesk) lumaDesk.open('picker'); else lToast(win, 'Choose a folder to import'); return; }
      const na = hit('[data-pnewalbum]'); if (na) { lMenu(na, `<div class="pnewal"><h6>New album</h6><input data-palname placeholder="Name" aria-label="Album name"><button class="bt pri" type="button" data-palmk>Create</button></div>`); setTimeout(() => $('#lmenu [data-palname]')?.focus(), 30); return; }
      if (hit('[data-palmk]')) { const n = $('#lmenu [data-palname]')?.value.trim() || 'New album', key = 'al_' + Date.now(); $('#lmenu')?.remove(); PNAV.splice(PNAV.length - 1, 0, [key, n, 'image']); P.view = key; P.viewer = null; renderPhotos(); return; }
      const pz = hit('[data-pzoom]'); if (pz) { P.zoom = pz.dataset.pzoom; photosBody(); photosBar(); return; }
      const ph = hit('[data-photo]'); if (ph) { P.viewer = +ph.dataset.photo; photosBar(); return; }
      if (hit('[data-pclose]')) { P.viewer = null; P.info = false; photosBar(); return; }
      if (hit('[data-pinfo]')) { P.info = !P.info; photosBar(); return; }
      if (hit('[data-pfav]')) { const p = PHOTOS[P.viewer], redo = () => { photosBar(); photosBody(); }; p.fav = !p.fav; redo();   // the LumaUI toast confirms it (#9)
        lToast(win, p.fav ? 'Added to Favorites' : 'Removed from Favorites', { icon: 'heart', undo: p.fav ? null : () => { p.fav = true; redo(); } }); return; }
      const pm = hit('[data-pmore]'); if (pm) { if ($('#lmenu')) { $('#lmenu').remove(); return; } lMenu(pm, crMi('data-popenin', 'app-window', 'Open in\u2026') + crMi('data-palbum', 'folder-plus', 'Add to album\u2026') + '<span class="crsep"></span>' + crMi('data-pdel', 'trash-2', 'Delete', ' red')); $('#lmenu')?.classList.add('ldrawer'); return; }
      if (hit('[data-popenin]')) { $('#lmenu')?.remove(); lOpenIn($('#p-corner [data-pmore]'), 'img', PHOTOS[P.viewer].t); return; }
      if (hit('[data-palbum]')) { $('#lmenu')?.remove(); lToast(win, 'Added to Launch', { icon: 'folder-plus' }); return; }
      if (hit('[data-pdel]')) { $('#lmenu')?.remove(); const p = PHOTOS[P.viewer], s = pset(), at = s.indexOf(p), nx = s[at + 1] || s[at - 1]; p.del = true; P.viewer = nx ? nx.i : null; photosBar(); photosBody(); renderPhotos();
        lToast(win, 'Moved to Deleted', { icon: 'trash-2', undo: () => { p.del = false; P.viewer = p.i; renderPhotos(); } }); return; }
      const st = hit('[data-pstep]'); if (st) { const s = pset(), at = s.findIndex(p => p.i === P.viewer), nx = s[at + +st.dataset.pstep]; if (nx) { P.viewer = nx.i; photosBar(); } return; }
    }
    if (app === 'viola') {
      if ((V.dl && !hit('.dlpop') && !hit('[data-vdl]')) || (V.wsp && !hit('[data-vws]') && !hit('[data-vspace]'))) { V.dl = false; V.wsp = false; $('#w-viola .pop')?.remove(); }
      if (vNarrow()) { const px = hit('[data-vpx]'); if (px) { const k = px.dataset.vpx; V.px = V.px === k ? '' : k; if (k === 'dl') V.dlNew = 0; renderViola(); return; }
        if (hit('[data-vtab]') || hit('[data-vnew]') || hit('[data-vopen]') || hit('[data-vtodo]') || hit('[data-vreload]') || hit('[data-vjump]')) V.px = ''; }
      const ct = hit('[data-vclosetab]'); if (ct) { e.stopPropagation(); const id = +ct.dataset.vclosetab, sp = SP(); sp.items = sp.items.map(it => it.group ? { ...it, tabs: it.tabs.filter(t => t.id !== id) } : it).filter(it => it.group ? it.tabs.length : it.id !== id); if (sp.on === id) sp.on = (allTabs(sp)[0] || {}).id; renderViola(); return; }
      const vt = hit('[data-vtab]'); if (vt) { SP().on = +vt.dataset.vtab; renderViola(true); return; }
      if (hit('[data-vws]')) { V.wsp = !V.wsp; renderViola(); return; }
      const vs = hit('[data-vspace]'); if (vs) { V.space = vs.dataset.vspace; V.wsp = false; renderViola(true); return; }
      const vg = hit('[data-vgroup]'); if (vg) { const it = SP().items[+vg.dataset.vgroup]; it.open = !it.open; renderViola(); return; }
      const vj = hit('[data-vjump]'); if (vj) { V.space = 'personal'; SP().on = +vj.dataset.vjump; renderViola(); return; }
      if (hit('[data-vplay]')) { V.playing = !V.playing; renderViola(); return; }
      if (hit('[data-vnew]')) { const id = V.n++; SP().items.push({ id, page: 'start' }); SP().on = id; renderViola(); setTimeout(() => $('#v-web [data-vgo]')?.focus(), 30); return; }
      if (hit('[data-vback]')) { const t = curTab(), h = V.hist[t.id]; if (h && h.length) { t.page = h.pop(); renderViola(true); } return; }
      if (hit('[data-vreload]')) { renderViola(true); return; }
      if (hit('[data-vstar]')) { e.preventDefault(); $('#lmenu')?.remove(); const t = curTab(); V.star[t.page] = !V.star[t.page]; renderViola(); return; }
      if (hit('[data-vdl]')) { V.dl = !V.dl; V.dlNew = 0; renderViola(); return; }
      if (hit('[data-vdlpause]')) { V.dlPause = !V.dlPause; $('#w-viola .dlls').innerHTML = vDownloads(); return; }
      if (hit('[data-vdlcancel]')) { lConfirm(win, { title: 'Stop this download?', body: 'luma-1.0-x86_64.iso stops, and the 2.1 GB downloaded so far is deleted.', action: 'Stop download', icon: 'x', onOK: () => lToast(win, 'Download stopped', { icon: 'x' }) }); return; }
      const vm = hit('[data-vmore]'); if (vm) { if ($('#lmenu')) { $('#lmenu').remove(); return; } const t = curTab(), pg = PAGE(t.page);
        lMenu(vm, crMi('data-vtodo="New private tab: nothing you do here is kept"', 'eye-off', 'New private tab') + '<span class="crsep"></span>' + crMi('data-vtodo="Find in page"', 'search', 'Find in page\u2026') + crMi('data-vtodo="Reader view: just the words"', 'book-open-text', 'Reader view') + `<div class="vzoom"><span>Zoom</span><button class="ib" type="button" data-vzoom="-1" aria-label="Zoom out">${ic('minus')}</button><b>${V.zoom || 100}%</b><button class="ib" type="button" data-vzoom="1" aria-label="Zoom in">${ic('plus')}</button></div>` + '<span class="crsep"></span>' + crMi(`data-vstar`, 'star', V.star[t.page] ? 'Remove bookmark' : 'Bookmark this page') + crMi('data-vtodo="Sent to the printer"', 'printer', 'Print\u2026') + '<span class="crsep"></span>' + crMi('data-vtodo="Opening Viola in Settings"', 'settings', 'Viola settings')); return; }
      const vz = hit('[data-vzoom]'); if (vz) { V.zoom = Math.max(50, Math.min(200, (V.zoom || 100) + 10 * +vz.dataset.vzoom)); $('#v-web').style.zoom = V.zoom / 100; const b = $('#lmenu .vzoom b'); if (b) b.textContent = V.zoom + '%'; return; }
      const vtd = hit('[data-vtodo]'); if (vtd) { $('#lmenu')?.remove(); lToast($('#w-viola'), vtd.dataset.vtodo); return; }
      const vo = hit('[data-vopen]'); if (vo) { vOpen(vo.dataset.vopen); return; }
    }
    if (app === 'write' && wrClick(e, hit)) return;
    if (app === 'messages' && msgClick(e, hit)) return;
    if (app === 'notes' && nClick(e, hit)) return;
    if (app === 'contacts' && ctClick(e, hit)) return;
    if (app === 'term' && tmClick(e, hit)) return;
    if (app === 'calendar' && calClick(e, hit)) return;
    if (app === 'depot' && depClick(e, hit)) return;
    if (app === 'discord' && window.LumaDiscord?.click(e)) return;
    if (app === 'huddle' && window.LumaHuddle?.click(e)) return;
    if (app === 'weather' && wxClick(e, hit)) return;
    if (app === 'clock' && ckClick(e, hit)) return;
    if (app === 'settings' && settingsClick(e, hit)) return;
    if (app === 'reel' && reelClick(e, hit)) return;
    if (app === 'darkroom' && drClick(e, hit)) return;
    if (app === 'session' && seClick(e, hit)) return;
    if (app === 'stage' && stClick(e, hit)) return;
    if (app === 'grid' && grClick(e, hit)) return;
    if (app === 'canvas' && cvClick(e, hit)) return;
    if (app === 'ari' && ariClick(e, hit)) return;
    if (app === 'calc' && caClick(e, hit)) return;
    if (app === 'tipsplit' && tsClick(e, hit)) return;
    if (app === 'modal' && mdClick(e, hit)) return;
    if (app === 'picker' && fpClick(e, hit)) return;
    if (app === 'phone' && pnClick(e, hit)) return;
    if (app === 'maps' && mpClick(e, hit)) return;
    if (app === 'camera' && cmClick(e, hit)) return;
    if (app === 'disks' && dskClick(e, hit)) return;
    if (app === 'tasks' && tkClick(e, hit)) return;
    if (app === 'playground' && pgClick(e, hit)) return;
    if (app === 'memos' && meClick(e, hit)) return;
    if (app === 'youtube' && ytClick(e, hit)) return;
    if (app === 'charlie' && crClick(e, hit)) return;
    if (app === 'monitor' && mnClick(e, hit)) return;
    if (app === 'leaf' && lfClick(e, hit)) return;
    if (app === 'viewer' && vwClick(e, hit)) return;
    if (app === 'valet' && vlClick(e, hit)) return;
    if (app === 'tide') {
      if (tNarrow() && T.px && (hit('[data-tview]') || hit('[data-tsearch]') || hit('[data-talbum]') || hit('[data-tnow]'))) T.px = '';
      if ((T.src && !hit('.srcpop') && !hit('[data-tsrc]')) || (T.out && !hit('.outpop') && !hit('[data-tout]'))) { T.src = false; T.out = false; tideBot(); }
      const lk = hit('[data-tlike]'); if (lk) { e.stopPropagation(); const k = lk.dataset.tlike; T.liked[k] = !T.liked[k]; tideRefresh(); return; }
      const pl = hit('[data-tplay]'); if (pl) { const [al, i] = pl.dataset.tplay.split(':'); if (T.cur.al === al && T.cur.i === +i) { T.playing = !T.playing; tideRefresh(); } else tPlay(al, +i); return; }
      const pa = hit('[data-tplayall]'); if (pa) { const id = pa.dataset.tplayall; if (T.cur.al === id) { T.playing = !T.playing; tideRefresh(); } else tPlay(id, 0); return; }
      const sa = hit('[data-tshufall]'); if (sa) { const a = AL(sa.dataset.tshufall); if (!a.tr) return; T.shuf = true; tPlay(a.id, Math.floor(Math.random() * a.tr.length)); return; }
      const al = hit('[data-talbum]'); if (al) { tGo('album', al.dataset.talbum); return; }
      const tv = hit('[data-tview]'); if (tv) { if (tv.hasAttribute('data-ttabroot')) { T.hist = []; T.view = tv.dataset.tview; T.now = false; T.searching = false; T.q = ''; tideSide(); tideMain(); tideNow(); tideBot(); return; } tGo(tv.dataset.tview); return; }
      const tp = hit('[data-tpane]'); if (tp) { const k = tp.dataset.tpane; T.pane = T.pane === k ? null : k; T.queue = T.pane === 'queue'; T.srcAt = null; tidePane(); tideTop(); tideSide(); tideBot(); return; }
      if (hit('[data-tqclear]')) { lToast(win, 'Cleared Up next', { icon: 'list' }); return; }
      const ts = hit('[data-tsort]'); if (ts) { const k = ts.dataset.tsort; T.sort = { k, dir: T.sort.k === k ? -T.sort.dir : 1 }; T._keep = true; tideMain(); return; }
      const sm = hit('[data-tsrcmore]'); if (sm) { e.stopPropagation(); tSrcMenu(sm, sm.dataset.tsrcmore); return; }
      const sy = hit('[data-tsrcsync]'); if (sy) { $('#lmenu')?.remove(); const s = TSRC.find(x => x.id === sy.dataset.tsrcsync); if (!s || s.st === 'busy' && s.id !== 'dl') return; const was = s.sub; s.st = 'busy'; s.sub = 'Syncing…'; tidePane(); tideTop(); tideSide();
        setTimeout(() => { s.st = 'ok'; s.sub = s.id === 'dl' ? 'Kept offline · 41 songs' : was.replace(/^Signed out$/, 'Up to date'); if (s.id === 'dl') s.kv = [['Kept offline', '41 songs · 338 MB']]; tidePane(); tideTop(); tideSide(); lToast($('#w-tide'), `${esc(s.n)} is up to date`); }, 1400); return; }
      const sf = hit('[data-tsrcfiler]'); if (sf) { $('#lmenu')?.remove(); lToast(win, `Showing ${sf.dataset.tsrcfiler === 'dl' ? 'Downloads' : 'Music'} in Filer`, { icon: 'folder' }); return; }
      const so = hit('[data-tsrcout]'); if (so) { $('#lmenu')?.remove(); const s = TSRC.find(x => x.id === so.dataset.tsrcout); lConfirm(win, { title: `Sign out of ${s.n}?`, body: 'Its songs leave your library until you sign in again. Songs kept offline stay.', action: 'Sign out', icon: 'log-out',
        onOK() { s.st = 'bad'; s.sub = 'Signed out'; s.kv = s.kv.filter(r => r[0] !== 'Password'); tidePane(); tideTop(); tideSide(); lToast(win, `Signed out of ${esc(s.n)}`, { icon: 'log-out' }); } }); return; }
      const rm = hit('[data-tsrcrm]'); if (rm) { $('#lmenu')?.remove(); const s = TSRC.find(x => x.id === rm.dataset.tsrcrm); lConfirm(win, { title: `Remove ${s.n}?`, body: `Its songs leave your library. Nothing is deleted from ${s.kv[0][1]}.`, action: 'Remove', icon: 'trash-2',
        onOK() { TSRC.splice(TSRC.indexOf(s), 1); T.srcAt = null; tidePane(); tideTop(); tideSide(); lToast(win, `Removed ${esc(s.n)}`, { icon: 'trash-2' }); } }); return; }
      const cn = hit('[data-tsrcconnect]'); if (cn) { const f = k => $(`#t-pane [data-tsrcf="${k}"]`), u = f('url').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), who = f('user').value.trim(); if (!u) { f('url').focus(); return; } if (!who) { f('user').focus(); return; }
        const ed = TSRC.find(x => x.id === cn.dataset.tsrcconnect), s = ed || { id: 'n' + TSRC.length, n: 'Navidrome', icon: 'server', remote: 1 }; s.st = 'busy'; s.sub = 'Reading your library…'; s.kv = [['Server', u], ['Account', who], ['Songs', ed ? ed.kv[2][1] : 'Counting'], ['Last sync', 'Now'], ['Password', 'In your keyring']]; if (!ed) TSRC.splice(1, 0, s);
        T.srcAt = null; tidePane(); tideTop(); tideSide(); lToast(win, ed ? `Saved ${esc(s.n)}` : `Connected to ${esc(u)}`); setTimeout(() => { s.st = 'ok'; s.sub = 'Up to date'; tidePane(); tideTop(); tideSide(); }, 1600); return; }
      const tsa = hit('[data-tsrcat]'); if (tsa) { $('#lmenu')?.remove(); T.srcAt = tsa.dataset.tsrcat || null; tidePane(); if (T.srcAt === 'add' || T.srcAt?.startsWith('edit:')) $('#t-pane [data-tsrcf="url"]')?.focus(); return; }
      if (hit('[data-tback]')) { const h = T.hist.pop(); if (h) { T.view = h[0]; T.album = h[1]; tideSide(); tideMain(); } return; }
      if (tNarrow()) { const px = hit('[data-tpx]'); if (px) { const k = px.dataset.tpx; T.px = T.px === k ? '' : k; tidePhBar(); return; }
        const sd = hit('[data-tshdo]'); if (sd) { T.px = ''; tidePhBar(); lToast(win, sd.dataset.tshdo); return; }
        if (hit('[data-tview]') || hit('[data-tsearch]') || hit('[data-talbum]') || hit('[data-tnow]')) T.px = '';
        const dv2 = hit('[data-tdev]'); if (dv2) { T.device = dv2.dataset.tdev; T.px = ''; tidePhBar(); lToast(win, `Playing on ${dv2.dataset.tdev === 'This computer' ? 'this phone' : dv2.dataset.tdev}`); return; } }
      if (hit('[data-tpp]')) { T.playing = !T.playing; tideRefresh(); return; }
      const st = hit('[data-tstep]'); if (st) { tStep(+st.dataset.tstep); return; }
      if (hit('[data-tshuf]')) { T.shuf = !T.shuf; tideBot(); return; }
      if (hit('[data-trep]')) { T.rep = !T.rep; tideBot(); return; }
      if (hit('[data-tqueue]')) { T.queue = !T.queue; tideQueue(); tideBot(); return; }
      if (hit('[data-tnow]')) { T.now = !T.now; T.nowq = false; tideNow(); return; }
      if (hit('[data-tnowq]')) { T.nowq = !T.nowq; tideNow(); return; }
      if (hit('[data-tsearch]')) { T.searching = true; tideTop(); tideSide(); $('#t-q')?.focus(); return; }
      if (hit('[data-tsearchx]')) { T.q = ''; T.searching = false; tideTop(); tideSide(); tideMain(); return; }
      const nt = hit('[data-tnowtab]'); if (nt) { T.nowTab = nt.dataset.tnowtab; tideNow(); return; }
      if (hit('[data-tsrc]')) { T.src = !T.src; T.out = false; tideBot(); return; }
      if (hit('[data-tout]')) { T.out = !T.out; T.src = false; tideBot(); return; }
      const dv = hit('[data-tdev]'); if (dv) { T.device = dv.dataset.tdev; T.out = false; tideBot(); return; }
    }
  });
  desk.addEventListener('input', e => {
    if (e.target.id === 't-rng') { T.pos = +e.target.value; const dur = secs(curTr().d); e.target.style.setProperty('--p', T.pos / dur * 100 + '%'); $('#t-pos').textContent = mmss(T.pos); $('#t-rem').textContent = '−' + mmss(dur - T.pos); }
    if (e.target.id === 't-vol') { T.vol = +e.target.value; e.target.style.setProperty('--p', T.vol + '%'); }
  });
  /* ══ LumaUI A–Z index (phone) ═══════════════════════════════════════════════════════════
     Long alphabetical lists get the letters down the right edge: touch or drag along them and the list jumps, with the
     letter shown large beside your thumb. Only letters that have people are live. */
  function lAZ(win, scroller, headSel) { const w = $(win); if (!w) return; w.querySelector(':scope > .lazidx')?.remove(); w.querySelectorAll('.lazgut').forEach(x => x.classList.remove('lazgut')); const sc = $(scroller); if (!w.classList.contains('phone') || !sc) return;
    const heads = [...sc.querySelectorAll(headSel)]; if (heads.length < 6) return; const have = new Set(heads.map(h => h.textContent.trim()[0]));
    w.insertAdjacentHTML('beforeend', `<nav class="lazidx" aria-label="Jump to a letter">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => `<b class="${have.has(l) ? '' : 'no'}">${l}</b>`).join('')}<i class="lazbub"></i></nav>`);
    sc.classList.add('lazgut');   /* the list stops short of the index: the index has its own lane */
    const nav = w.querySelector(':scope > .lazidx'), bub = nav.querySelector('.lazbub');
    const go = e => { const r = nav.getBoundingClientRect(), bs = [...nav.querySelectorAll('b')], i = Math.max(0, Math.min(25, Math.floor((e.clientY - r.top) / r.height * 26))), l = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i];
      let h = heads.find(x => x.textContent.trim()[0] >= l) || heads[heads.length - 1]; sc.scrollTop = h.offsetTop - (sc.firstElementChild?.offsetTop || 0) - 4; bub.textContent = h.textContent.trim()[0]; bub.style.top = (e.clientY - r.top) + 'px'; nav.classList.add('on'); };
    nav.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); nav.setPointerCapture(e.pointerId); go(e); nav.onpointermove = go; };
    nav.onpointerup = nav.onpointercancel = () => { nav.onpointermove = null; nav.classList.remove('on'); }; }

  /* the lists that get the index redraw often, so it follows them rather than each render */
  [['#c-side', () => lAZ('#w-contacts', '#c-side .scr', '.sh')], ['#pn-side', () => { if (PN.tab === 'contacts' && !PN.drill) lAZ('#w-phone', '#pn-side .pnlist', '.pnlet'); else $('#w-phone > .lazidx')?.remove(); }]].forEach(([sel, fn]) => { const el = $(sel); if (!el) return; let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(fn, 60); }).observe(el, { childList: true }); new ResizeObserver(() => { clearTimeout(t); t = setTimeout(fn, 60); }).observe(el.closest('.win')); });

  /* ══ LumaUI safe area above the bar (phone) ═══════════════════════════════════════════════
     One rule for every app instead of each guessing: measure the bar that floats at the bottom (one row, two rows,
     whatever it is right now) and give every scroller behind it exactly that much room at its end, plus 20px, so the last
     line always stops 20px above the bar and never further. The bar growing a panel doesn't count: panels float over the
     page, so the page doesn't jump. Inner blocks' own big bottom paddings are cancelled so the rule is the only one. */
  const LSAFE_GAP = 20;
  function lSafe(w) { if (!w || w.hidden || !w.classList.contains('phone') || !w.clientWidth) return; const wr = w.getBoundingClientRect();
    const bars = [...w.querySelectorAll('.fbar, .mbar, #t-phbar, .lac')].filter(b => { if (b.hidden || !b.offsetWidth) return false; const cs = getComputedStyle(b); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || !/absolute|fixed/.test(cs.position)) return false; const r = b.getBoundingClientRect(); if (!(r.bottom > wr.bottom - 80 && r.width > wr.width * .5 && r.height < wr.height * .7)) return false; const hitEl = document.elementFromPoint(r.left + r.width / 2, r.bottom - 12); return !!hitEl && (b.contains(hitEl) || hitEl === b); });
    if (!bars.length) return; const bar = bars.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    const pan = [...bar.querySelectorAll(':scope > .fexp, :scope .mcin > .fexp')].reduce((h, e) => h + e.getBoundingClientRect().height + 6, 0), top = bar.getBoundingClientRect().top + (bar.classList.contains('lac') ? 0 : pan);
    w.querySelectorAll('*').forEach(el => { if (el.clientHeight < 160 || el === bar || bar.contains(el) || el.closest('.fexp, .pop, #lmenu') || el.matches('.fbar, .mbar, .lac, #t-phbar')) { if (el.matches?.('.fbar, .mbar, .lac, #t-phbar') && el.classList.contains('lsafe')) { el.style.removeProperty('padding-bottom'); el.classList.remove('lsafe'); } return; }   /* an action bar is never padded as a scroller (it caused the grown-bar chin) */ const cs = getComputedStyle(el); if (!/auto|scroll/.test(cs.overflowY) || (/auto|scroll/.test(cs.overflowX) && el.scrollHeight <= el.clientHeight + 1)) return; const r = el.getBoundingClientRect(); if (r.bottom < top + 4 || r.height < 160) return;
      el.style.setProperty('padding-bottom', Math.max(LSAFE_GAP, Math.round(r.bottom - top + LSAFE_GAP)) + 'px', 'important'); el.classList.add('lsafe');
      let c = el.lastElementChild, d = 0; while (c && d < 3) { if (parseFloat(getComputedStyle(c).paddingBottom) > 24) c.classList.add('lsafec'); c = c.lastElementChild; d++; } }); }
  const lSafeAll = () => $$('.win.phone').forEach(w => { if (!w.hidden) lSafe(w); });
  { let t; const go = () => { cancelAnimationFrame(t); t = requestAnimationFrame(lSafeAll); }; new MutationObserver(go).observe(document.body, { childList: true, subtree: true }); window.addEventListener('resize', go); setInterval(lSafeAll, 1500); }

  /* ══ Phone gestures: the swipes and pinches phones have taught everyone ═══════════════════════════════
     Delegated from the document so they survive every re-render; each only acts inside a phone window. A swipe that
     acts swallows the click that would follow it. */
  const lGest = [
    { sel: '#w-camera.cmph #cm-frame', swipe: d => { if (CM.rec) return; const i = CMM.findIndex(m => m[0] === CM.mode), n = CMM[i - d]; if (n) { CM.mode = n[0]; CM.focus = null; cmRender(); } } },
    { sel: '#w-calc.canarrow #ca-disp', swipe: () => { caPress('back'); }, min: 36 },
    { sel: '#w-tide.tnarrow .tpmini .tmhit', swipe: d => tStep(-d) },
    { sel: '#w-leaf #lf-stage', swipe: d => { if (!lfNarrow()) return; lfGo(LF.spread - d); lfWake(); } }];
  document.addEventListener('pointerdown', e => { if (document.documentElement.dataset.phone == null) return; const g = lGest.find(x => e.target.closest?.(x.sel)); if (!g) return; const x0 = e.clientX, y0 = e.clientY;
    const up = ev => { document.removeEventListener('pointerup', up, true); const dx = ev.clientX - x0, dy = ev.clientY - y0; if (Math.abs(dx) > (g.min || 50) && Math.abs(dx) > Math.abs(dy) * 1.5) { LSWT = Date.now(); g.swipe(dx > 0 ? 1 : -1); } };
    document.addEventListener('pointerup', up, true); }, true);
  /* Photos: pinch the grid (or ⌃-scroll) to change how big the photos are, the way a phone library zooms */
  (() => { const pts = new Map(); let d0 = 0, s0 = 0; const body = () => $('#p-body'), dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    const set = v => { P.size = Math.max(96, Math.min(340, Math.round(v))); $('#w-photos').style.setProperty('--pcs', P.size + 'px'); pCorners(); const r = $('#p-bar [data-psize]'); if (r) r.value = P.size; };
    document.addEventListener('pointerdown', e => { if (!e.target.closest?.('#w-photos.pnarrow #p-body')) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { d0 = dist(); s0 = P.size; } }, true);
    document.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2 && d0) set(s0 * dist() / d0); }, true);
    const end = e => { pts.delete(e.pointerId); if (pts.size < 2) d0 = 0; }; document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true);
    document.addEventListener('wheel', e => { if (!e.ctrlKey || !e.target.closest?.('#w-photos.pnarrow #p-body')) return; e.preventDefault(); set(P.size * (e.deltaY < 0 ? 1.06 : 1 / 1.06)); }, { passive: false, capture: true }); })();

  /* ══ LumaUI swipe rows (phone) ══════════════════════════════════════════════════════════
     The thing phones do best with a list: slide a row to act on it without opening it. Right reveals the gentle action
     on the left edge, left reveals the other on the right edge; past 90px it commits, with the row sliding away and the
     app's own toast (with Undo where the app has one). A vertical drag stays a scroll. */
  const LSWC = { green: 'oklch(0.62 0.15 150)', orange: 'oklch(0.72 0.16 60)', blue: 'oklch(0.6 0.15 255)', red: 'oklch(0.6 0.2 25)', gray: 'oklch(0.55 0.02 260)', yellow: 'oklch(0.78 0.15 85)' };
  const lswClick = (w, attr) => { const b = document.createElement('button'); b.setAttribute(attr.split('=')[0], (attr.split('=')[1] || '').replace(/"/g, '')); b.hidden = true; $(w).appendChild(b); b.click(); b.remove(); };
  const LSW = [
    { sel: '#w-charlie .crrow[data-crt]', right: { i: 'archive', n: 'Archive', c: 'green', run: r => { const t = crT(r.dataset.crt), was = t.box; t.box = 'archive'; crSide(); crToast('Archived', () => { t.box = was; crSide(); }, 'archive'); } },
      left: { i: 'star', n: 'Flag', c: 'orange', run: r => { const t = crT(r.dataset.crt); t.flag = !t.flag; crSide(); crToast(t.flag ? 'Flagged' : 'Unflagged', null, 'star'); } } },
    { sel: '#w-messages .crow[data-mcv]', right: { i: 'pin', n: 'Pin', c: 'yellow', run: r => { const c = CONVOS.find(x => x.id === r.dataset.mcv); c.pinned = !c.pinned; msgSide(); mToast(c.pinned ? `${who(c).n} pinned` : `${who(c).n} unpinned`); } },
      left: { i: 'bell-off', n: 'Mute', c: 'blue', run: r => { const c = CONVOS.find(x => x.id === r.dataset.mcv); c.muted = !c.muted; msgSide(); mToast(c.muted ? 'Muted. You won’t be notified.' : 'Unmuted'); } } },
    { sel: '#w-tasks .tkrow[data-tkpick]', right: { i: 'check', n: 'Done', c: 'green', run: r => r.querySelector('[data-tkck]')?.click() },
      left: { i: 'sunrise', n: 'Tomorrow', c: 'orange', run: r => { const t = tkTask(r.dataset.tkpick); t.due = 1; t.act.push(['me', 'moved this to tomorrow', 'Just now']); tkAll(); tkToast('Moved to tomorrow'); } } },
    { sel: '#w-memos .merow[data-meopen]', right: { i: 'star', n: 'Favorite', c: 'yellow', run: r => { const m = meM(r.dataset.meopen); m.fav = !m.fav; meSide(); meToast(m.fav ? 'Added to Favorites' : 'Removed from Favorites', null, 'star'); } },
      left: { i: 'trash-2', n: 'Delete', c: 'red', run: r => { ME.cur = r.dataset.meopen; lswClick('#w-memos', 'data-medel'); } } },
    { sel: '#w-phone .pnrow[data-pnr]', left: { i: 'trash-2', n: 'Remove', c: 'red', run: r => { const i = PNR.findIndex(x => x.id === r.dataset.pnr), x = PNR.splice(i, 1)[0]; pnSide(); pnToast('Removed from Recents', { undo: () => { PNR.splice(i, 0, x); pnSide(); } }); } } }];
  let LSWT = 0; window.addEventListener('click', e => { if (Date.now() - LSWT < 450) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('pointerdown', e => { if (document.documentElement.dataset.phone == null || e.button > 0) return; const cfg = LSW.find(c => e.target.closest?.(c.sel)); if (!cfg) return;
    const row = e.target.closest(cfg.sel); if (!row.closest('.win.phone')) return; const x0 = e.clientX, y0 = e.clientY, par = row.parentElement; let dx = 0, on = false, u = null, done = false;
    const end = () => { document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', up, true); };
    const move = ev => { const mx = ev.clientX - x0, my = ev.clientY - y0;
      if (!on) { if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) { on = true; if (getComputedStyle(par).position === 'static') par.style.position = 'relative'; } else if (Math.abs(my) > 12) { end(); return; } else return; }
      const a = mx > 0 ? cfg.right : cfg.left; dx = a ? mx : Math.sign(mx) * Math.min(24, Math.abs(mx)) * .5;
      row.style.transition = 'none'; row.style.transform = `translateX(${dx}px)`; row.style.position = 'relative'; row.style.zIndex = 1;
      if (!u) { u = document.createElement('div'); par.insertBefore(u, row); }
      const w = Math.abs(dx), go = a && w > 90; u.className = `lswu ${dx > 0 ? 'r' : 'l'}${go ? ' go' : ''}`; u.style.cssText = `top:${row.offsetTop}px;height:${row.offsetHeight}px;${dx > 0 ? `left:${row.offsetLeft}px` : `left:${row.offsetLeft + row.offsetWidth - w}px`};width:${w}px;--c:${a ? LSWC[a.c] : 'transparent'}`;
      u.innerHTML = a ? `<span>${ic(a.i)}<b>${a.n}</b></span>` : ''; };
    const up = () => { end(); if (!on || done) return; done = true; LSWT = Date.now(); const a = dx > 0 ? cfg.right : cfg.left, go = a && Math.abs(dx) > 90;
      row.style.transition = 'transform .22s var(--ease)'; row.style.transform = go ? `translateX(${dx > 0 ? 105 : -105}%)` : '';
      if (u) { u.style.transition = 'width .22s var(--ease), left .22s var(--ease)'; if (!go) { u.style.width = '0px'; if (dx < 0) u.style.left = (row.offsetLeft + row.offsetWidth) + 'px'; } else { u.style.width = row.offsetWidth + 'px'; u.style.left = row.offsetLeft + 'px'; } }
      setTimeout(() => { u?.remove(); row.style.transform = ''; row.style.transition = ''; row.style.zIndex = ''; if (go) a.run(row); }, 230); };
    document.addEventListener('pointermove', move, true); document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true); }, true);

  /* A window that crosses the phone width (opened from hidden, resized, or dropped onto the phone) redraws its bars in the
     other shape; the phone layer is decided at render time, so it has to be told */
  [['w-viola', vNarrow, () => renderViola(), w => w.classList.contains('vnarrow')], ['w-charlie', () => crNarrow() || phTab(), () => { CR.px = ''; crSide(); crHead(); crBar(); }, () => !!$('#cr-side .crlbar') || $('#cr-bar').classList.contains('crphbar')],
   ['w-messages', () => mNarrow() || phTab(), () => { MS.px = ''; MS.isl = false; msgSide(); msgHead(); msgBar(); }, () => !!$('#m-side .mlbar')],
   ['w-notes', () => nNarrow() || phTab(), () => { N.px = ''; nBar(); }, () => $('#n-bar').classList.contains('nphbar')], ['w-filer', () => fNarrow() ? 'phone' : phWide() ? 'tablet' : 'desk', () => { F.exp = false; filerTitle(); filerBar(); }, () => $('#f-ttl .fisl') ? 'phone' : $('#f-ttl .fviews') ? 'tablet' : $('#f-bar [data-fexp], #f-bar [data-fsexp], #f-bar .fhold') ? 'phone' : 'desk'],   /* three shapes: the island, the title row with views, the desktop */ ['w-photos', pNarrow, () => { P.px = ''; photosBar(); }, w => w.classList.contains('pnarrow')], ['w-term', tmNarrow, () => { TT.px = ''; tmBar(); }, () => $('#tm-bar').classList.contains('tmphbar')], ['w-monitor', mnNarrow, () => { MN.px = ''; mnBody(); mnBar(); }, w => w.classList.contains('mnnarrow')], ['w-memos', meNarrow, () => { ME.px = ''; meSide(); meBar(); }, () => !!$('#me-side .melbar') || $('#me-bar').classList.contains('mephbar')], ['w-disks', dskNarrow, () => { DSS.px = ''; dskAll(); }, () => $('#dsk-bar').classList.contains('dskphbar')], ['w-ari', ariNarrow, () => { AR.px = ''; arBar(); }, () => $('#ari-bar').classList.contains('ariphbar')], ['w-maps', mpNarrow, () => { MP.px = ''; mpBar(); mpCorner(); }, () => $('#mp-bar').classList.contains('mpphbar')], ['w-depot', dNarrow, () => { DS2.px = ''; depRender(); }, w => w.classList.contains('dpnarrow')], ['w-valet', vlNarrow, () => { VL.px = ''; vlRender(); }, w => w.classList.contains('vlph')], ['w-weather', wxNarrow, () => { WS2.px = ''; renderWx(); }, w => w.classList.contains('wxph')], ['w-tasks', tkNarrow, () => { TK.px = ''; tkBar(); }, () => $('#tk-bar').classList.contains('tkphbar')], ['w-leaf', lfNarrow, () => { LF.px = ''; lfBar(); lfLayout(); }, () => $('#lf-bar').classList.contains('lfphbar')], ['w-viewer', vwNarrow, () => { VW.px = ''; VW.zoom = 0; vwStage(); vwBar(); }, () => $('#vw-bar').classList.contains('vwphbar')], ['w-clock', ckNarrow, () => { CK.px = ''; cbBody(); }, () => $('#cb-bar').classList.contains('ckphbar')], ['w-reel', rlNarrow, () => { RL.px = ''; rlAll(); }, w => w.classList.contains('rlph')], ['w-darkroom', drNarrow, () => { DR.px = ''; drAll(); }, () => $('#dr-bar').classList.contains('drphbar')], ['w-write', wrNarrow, () => { W.px = ''; renderWrite(); }, w => w.classList.contains('wrph')], ['w-canvas', cvNarrow, () => { CV.px = ''; cvAll(); }, w => w.classList.contains('cvph')], ['w-grid', grNarrow, () => { GR.px = ''; grAll(); }, w => w.classList.contains('grphone')], ['w-session', seNarrow, () => { SE.px = ''; seAll(); }, w => w.classList.contains('seph')], ['w-picker', fpNarrow, () => { FP.px = ''; fpAll(); }, w => w.classList.contains('fpph')], ['w-notes', () => $('#w-notes').classList.contains('phone'), () => { nSide(); nBar(); }, () => !!$('#n-side .nlist2')], ['w-stage', stNarrow, () => { ST.px = ''; stAll(); }, w => w.classList.contains('stph')]].forEach(([id, narrow, redraw, drawn]) => {
    const w = $('#' + id); if (!w) return; new ResizeObserver(() => { if (w.clientWidth && narrow() !== drawn(w)) redraw(); }).observe(w); });
  desk.addEventListener('keydown', e => { const go = e.target.closest('[data-vgo]'); if (!go || e.key !== 'Enter') return; const v = go.value.trim().toLowerCase(); go.blur();
    vOpen(v.includes('hub') ? 'hub' : v.includes('linux') ? 'post:linux' : v.includes('ai') ? 'post:ai' : v.includes('free') ? 'post:free' : v.includes('luma') ? 'home' : 'start'); });
  document.addEventListener('selectionchange', wSel);
  doc().addEventListener('input', () => { writeOutRows(); writeTop(); writeStat(); if (W.find) runFind(); });
  $('#d-desk').addEventListener('scroll', () => { $('#d-sel').classList.remove('show'); writeStat(); });
  new ResizeObserver(() => writeFit()).observe($('#d-main'));
  $('#w-write').addEventListener('change', wrChange);
  document.addEventListener('keydown', e => {
    const fw = front(); if (e.target.closest('input,textarea,[contenteditable]')) { if (fw && fw.dataset.app === 'write' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); openFind(); } return; }
    if (e.key === 'Escape') { if (P.viewer != null) { P.viewer = null; P.info = false; photosBar(); } if (T.now) { T.now = false; tideNow(); } closeFind(); if (W.ctx !== 'text') { W.img = null; wSetCtx('text'); writeBar(); writeInsp(); } if (F.sel) { F.sel = null; F.info = false; filerBody(); filerBar(); filerInfo(); } }
    if (fw && fw.dataset.app === 'tide' && e.key === ' ') { e.preventDefault(); T.playing = !T.playing; tideRefresh(); }
    if (fw && fw.dataset.app === 'photos' && P.viewer != null && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const s = pset(), at = s.findIndex(p => p.i === P.viewer), nx = s[at + (e.key === 'ArrowRight' ? 1 : -1)]; if (nx) { P.viewer = nx.i; photosBar(); } }
  });

  /* ══ Review bar, shelf, start ══════════════════════════════════════════ */
  /* The wallpaper is blurred once into an image, not by a live CSS filter: a full-screen
     live blur is recomposited on every frame a window moves, which is what made dragging choppy. */
  const wallCache = {};
  function blurWall(name) {
    if (wallCache[name]) { desk.style.backgroundImage = `url(${wallCache[name]})`; return; }
    const im = new Image(); im.src = WP + name + '.png';
    im.onload = () => { const W2 = Math.round(desk.clientWidth / 4) || 360, H2 = Math.round(desk.clientHeight / 4) || 220, c = document.createElement('canvas'); c.width = W2; c.height = H2;
      const x = c.getContext('2d'), sc = Math.max(W2 / im.width, H2 / im.height) * 1.15, w = im.width * sc, h = im.height * sc;
      x.filter = 'blur(14px) saturate(1.35)'; x.drawImage(im, (W2 - w) / 2, (H2 - h) / 2, w, h);
      wallCache[name] = c.toDataURL('image/jpeg', .92); desk.style.backgroundImage = `url(${wallCache[name]})`; };
  }
  const S = { mode: ['dark', 'light'].includes(QS.get('mode')) ? QS.get('mode') : QS.get('desktop') ? store.get('deskmode', 'dark') : store.get('mode', 'dark'),   /* ?mode=light, for links from the Design Center */ mat: store.get('mat', 'solid') === 'frost' ? 'frost' : 'solid',
    ink: ['mono', 'colour'].includes(QS.get('ink')) ? QS.get('ink') : '' };   /* D-Ink: ?ink=mono|colour, or the review bar's switch; never remembered */
  /* D-Ink swaps every v4 app icon for its ink line drawing while it is on (icons/luma-ink-*), including ones apps draw later. */
  let inkMO = null;
  const inkSwap = root => (root.matches?.('img') ? [root] : [...root.querySelectorAll?.('img[src*="luma-v4-"], img[src*="luma-ink-"]') || []]).forEach(im => { const s = im.getAttribute('src'), t = S.ink ? s.replace('luma-v4-', 'luma-ink-') : s.replace('luma-ink-', 'luma-v4-'); if (t !== s) im.setAttribute('src', t); });
  function inkApply() { if (S.ink) document.documentElement.dataset.ink = S.ink; else delete document.documentElement.dataset.ink; inkSwap(document.body);
    if (!inkMO) { inkMO = new MutationObserver(ms => { if (!S.ink) return; ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) inkSwap(n); })); }); inkMO.observe(document.body, { childList: true, subtree: true }); }
    $$('[data-set-ink]').forEach(b => b.classList.toggle('on', b.dataset.setInk === S.ink)); window.lumaShell?.ink?.(S.ink); window.lumaPhone?.ink?.(S.ink); }
  function apply() { inkApply(); window.lumaShell?.theme(S.mode); window.lumaShell?.mat?.(S.mat); body.dataset.mode = S.mode; body.dataset.mat = S.mat; store.set('mat', S.mat); store.set(QS.get('desktop') ? 'deskmode' : 'mode', S.mode); $$('[data-set-mode]').forEach(b => b.classList.toggle('on', b.dataset.setMode === S.mode));
    const wall = S.wall || (S.mode === 'dark' ? 'prism' : 'meadow');   // the wallpaper chosen in Settings, else the mode's own
    sampleHue(WP + wall + '.png', h => body.style.setProperty('--acc', h)); blurWall(wall); }
  $('.review').addEventListener('click', e => { const m = e.target.closest('[data-set-mode]'); if (m) { S.mode = m.dataset.setMode; apply(); } const ik = e.target.closest('[data-set-ink]'); if (ik) { S.ink = ik.dataset.setInk; apply(); } if (e.target.closest('#reset')) focusLayout(); if (e.target.closest('#allapps')) layout(); if (e.target.closest('#phone')) togglePhone(); });
  $('#s-q').innerHTML = `${ic('search')}<span>Search</span><kbd>Super</kbd>`;
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function tick() { const d = new Date(), h = d.getHours(), mm = String(d.getMinutes()).padStart(2, '0'); $('#s-stat').innerHTML = `${ic('bell')}${ic('wifi')}${ic('battery-medium')}<span class="clock"><b class="num">${(h % 12) || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}</b><span>${WD[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()}</span></span>`; }
  tick(); setInterval(tick, 15000);
  /* ══ Desktop (Studio's desktop view, ?desktop=1) ══════════════════════════════
     The shelf, notifications and Quick Options are Shelf take two (desktop/shell.js, from mockups/shelf-2.html),
     mounted over the desk. This is the bridge it talks to: which windows are open, where they may go, Settings.
     Windows move, resize from any edge, and tile when dropped on a screen edge. */
  const DT = () => document.documentElement.dataset.desktop === '1';
  const DTSZ = { valet: [720, 340], picker: [900, 600], calc: [360, 600], tipsplit: [340, 470], modal: [820, 600], clock: [900, 640], weather: [1000, 680] };
  const DTA = { res: { top: 10, bottom: 80, left: 10, right: 10 }, cascade: 0 };
  Object.defineProperty(DTSZ, 'playground', { get() { const b = bounds(), R = DTA.res; return [Math.min(1400, b.w - R.left - R.right - 40), Math.min(840, b.h - R.top - R.bottom - 20)]; } });   /* Playground wants room for its three columns */
  function dtOpen(a) { const w = $('#w-' + a); if (!w) return; if (document.documentElement.dataset.phone != null && window.lumaPhone) { lumaPhone.open(a); return; } const b = bounds(), R = DTA.res, aw = b.w - R.left - R.right, ah = b.h - R.top - R.bottom;
    if (w.hidden || !w.style.left) { const [sw, sh] = DTSZ[a] || [Math.min(1180, aw - 40), Math.min(740, ah - 20)], k = (DTA.cascade++ % 6) * 28;
      /* Each new window steps down and right, but never past the work area: on a small screen it used to slide under the dock (Nick, 14 Oct 2026) */
      const x = Math.max(R.left, Math.min(Math.round(R.left + (aw - sw) / 2 + k - 70), R.left + aw - sw)), y = Math.max(R.top, Math.min(Math.round(R.top + (ah - sh) / 2 + k - 50), R.top + ah - sh));
      place(w, x, y, sw, sh); }
    else { /* a window reopened where it last was: pulled back inside the work area if the screen got smaller since */
      const cw = Math.min(w.offsetWidth || parseFloat(w.style.width) || aw, aw), ch = Math.min(w.offsetHeight || parseFloat(w.style.height) || ah, ah),
        cx = Math.max(R.left, Math.min(parseFloat(w.style.left) || R.left, R.left + aw - cw)), cy = Math.max(R.top, Math.min(parseFloat(w.style.top) || R.top, R.top + ah - ch));
      if (cw !== w.offsetWidth || ch !== w.offsetHeight || cx !== parseFloat(w.style.left) || cy !== parseFloat(w.style.top)) place(w, cx, cy, cw, ch); }
    w.hidden = false; w.classList.remove('min'); focusWin(w); if (DTA.tiling) dtTile(); requestAnimationFrame(settle); }
  function dtDock(a) { const w = $('#w-' + a); if (!w) return; if (w.hidden || w.classList.contains('min')) dtOpen(a); else if (front() === w) { w.classList.add('min'); syncDock(); } else focusWin(w); }
  /* Tiling from Quick Options: the front window on the left, the rest stacked on the right, inside the shelf's work area */
  function dtTile() { const b = bounds(), R = DTA.res, g = 10, open = wins.filter(w => !w.hidden && !w.classList.contains('min')).sort((x, y) => y.style.zIndex - x.style.zIndex); if (!open.length) return;
    const X = R.left, Y = R.top, Wd = b.w - R.left - R.right, Ht = b.h - R.top - R.bottom, lw = open.length > 1 ? Math.round((Wd - g) * .58) : Wd;
    open.forEach((w, i) => { w.classList.add('snapping'); if (!i) place(w, X, Y, lw, Ht); else { const n = open.length - 1, h = (Ht - g * (n - 1)) / n; place(w, X + lw + g, Math.round(Y + (i - 1) * (h + g)), Wd - lw - g, Math.round(h)); } setTimeout(() => w.classList.remove('snapping'), 340); });
    setTimeout(settle, 340); }
  window.lumaDesk = { open: dtOpen, dock: dtDock, getDnd: () => CF.dnd,
    get: k => cfG(k), set(k, v) { cfS(k, v); cfFx(k); if (!$('#w-settings').hidden) cfAll(); },
    settings(p) { dtOpen('settings'); cfGo(p); },
    phone(a) { wins.forEach(w => { if (w.dataset.app !== a && w.classList.contains('phone')) { w.classList.remove('phone', 'navopen'); w.hidden = true; w.dispatchEvent(new CustomEvent('luma-phone', { detail: false })); } }); const w = $('#w-' + a); if (!w) return;
      w.hidden = false; w.classList.remove('min'); w.classList.add('phone'); focusWin(w); w.dispatchEvent(new CustomEvent('luma-phone', { detail: true })); setTimeout(settle, 60); },
    phoneHome() { wins.forEach(w => { if (w.classList.contains('phone')) { w.classList.remove('phone', 'navopen'); w.hidden = true; w.dispatchEvent(new CustomEvent('luma-phone', { detail: false })); } }); }, mode(m) { $(`[data-set-mode="${m}"]`)?.click(); }, mat(m) { S.mat = m === 'frost' ? 'frost' : 'solid'; apply(); }, wall(n) { S.wall = n; apply(); },
    area(r, tiling) { DTA.res = r; DTA.tiling = tiling; if (tiling) dtTile(); },
    dnd(v) { CF.dnd = v; if (!$('#w-settings').hidden) cfAll(); },
    ready() { syncDock(); requestAnimationFrame(() => { document.documentElement.classList.add('dtready'); try { parent.postMessage('luma-desk-ready', '*'); } catch (e) {} }); } };

  /* Dropping a window on an edge tiles it; the top edge fills the work area */
  function dtEdge(e) { if (!CF.edgeTile) return null; const r = desk.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, b = bounds(), R = DTA.res, g = 10, h = b.h - R.top - R.bottom, w = b.w - R.left - R.right;
    return x <= 10 ? [R.left, R.top, (w - g) / 2, h] : x >= b.w - 10 ? [R.left + (w + g) / 2, R.top, (w - g) / 2, h] : y <= 4 ? [R.left, R.top, w, h] : null; }
  function dtHint(e) { const t = dtEdge(e), s = $('#dt-snap'); if (!s) return; s.classList.toggle('on', !!t); if (t) Object.assign(s.style, { left: t[0] + 'px', top: t[1] + 'px', width: t[2] + 'px', height: t[3] + 'px' }); }
  function dtSnap(w, e) { const t = dtEdge(e); $('#dt-snap')?.classList.remove('on'); if (!t) return; w.dataset.max = JSON.stringify({ x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight }); w.classList.add('snapping'); place(w, ...t.map(Math.round)); setTimeout(() => { w.classList.remove('snapping'); settle(); }, 320); }

  /* Keep the arrangement across reloads, so a live update doesn't throw your windows away */
  function dtSave() { try { sessionStorage.setItem('dt-wins', JSON.stringify(wins.map(w => [w.dataset.app, w.hidden, w.classList.contains('min'), w.style.left, w.style.top, w.style.width, w.style.height, +w.style.zIndex || 0]))); } catch (e) {} }
  function dtRestore() { let s; try { s = JSON.parse(sessionStorage.getItem('dt-wins') || 'null'); } catch (e) {} if (!s) return false;
    s.sort((a, b) => a[7] - b[7]).forEach(([a, hid, min, l, t, w, h]) => { const el = $('#w-' + a); if (!el) return; el.hidden = hid; el.classList.toggle('min', min); Object.assign(el.style, { left: l, top: t, width: w, height: h }); if (!hid) focusWin(el); }); return true; }

  function markReady(ms) { setTimeout(() => { document.documentElement.dataset.ready = '1'; document.documentElement.classList.remove('booting'); }, ms || 0); }
  function dtInit() { document.documentElement.dataset.desktop = '1'; desk.insertAdjacentHTML('beforeend', '<i class="dtsnap" id="dt-snap"></i>');
    /* app=none: a clean desktop, every window closed (the website's preview starts here, Nick 14 Oct 2026) */
    /* showcase (the website's preview) always starts as its stand-in picture shows it, and remembers nothing */
    if (QS.has('showcase') || !dtRestore()) { if (FOCUS === 'none') { wins.forEach(x => { x.hidden = true; x.classList.remove('min'); }); requestAnimationFrame(settle); }
      else { focusLayout(); const f = $('#w-' + FOCUS), b = bounds(); if (f) place(f, Math.round((b.w - f.offsetWidth) / 2), Math.max(10, Math.round((b.h - 80 - f.offsetHeight) / 2)), f.offsetWidth, f.offsetHeight); } }
    if (!QS.has('showcase')) setInterval(dtSave, 1500);
    const sc = document.createElement('script'); sc.src = 'desktop/shell.js?v=' + Date.now(); sc.onload = () => markReady(900); document.body.appendChild(sc); }

  doc().innerHTML = DOC;
  apply(); renderYT(); renderDiscord(); renderHuddle(); renderLumaUI(); renderSettings(); renderReel(); renderDarkroom(); renderSession(); renderStage(); renderGrid(); renderCanvas(); renderAri(); renderCalc(); renderTip(); renderModal(); renderPicker(); renderPhone(); renderMaps(); renderCamera(); renderDisks(); renderTasks(); renderMemos(); renderValet(); renderViewer(); renderLeaf(); renderMonitor(); renderCharlie(); renderClock(); renderWeather(); renderDepot(); renderCalendar(); renderTerm(); renderContacts(); renderNotes(); renderMsgs(); renderFiler(); renderPhotos(); renderViola(); renderWrite(); renderPlayground(); tideAll(); QS.get('all') ? layout() : focusLayout();
  if (QS.get('phone')) { document.documentElement.dataset.desktop = '1'; document.documentElement.dataset.phone = '1'; wins.forEach(w => { w.hidden = true; });
    const sc = document.createElement('script'); sc.src = 'desktop/phone.js?v=' + Date.now(); sc.onload = () => { if (!QS.get('app') || !document.getElementById('w-' + QS.get('app'))) markReady(700); }; document.body.appendChild(sc); }
  else if (QS.get('desktop')) dtInit();
  else markReady(400);
  /* ?setup=1: first login, the system's setup sheet (desktop/setup.js); ?setup=new on the phone: "Set up new Luma" */
  if (QS.get('setup')) { const su = document.createElement('script'); su.src = 'desktop/setup.js?v=' + Date.now(); document.body.appendChild(su); }
  addEventListener('resize', () => { const b = bounds(); wins.forEach(w => { if (w.offsetLeft > b.w - 160) w.style.left = Math.max(8, b.w - w.offsetWidth - 8) + 'px'; }); settle(); });
})();
