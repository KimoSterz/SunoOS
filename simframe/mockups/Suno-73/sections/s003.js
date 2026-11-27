    bar.onmousedown = e => { if (e.target.closest('button')) e.preventDefault(); };   /* keep the text selection while formatting */ }
  function nBar() { if (nNarrow() || phTab()) return nBarPhone(); $('#n-bar').classList.remove('phnofit', 'nphbar', 'phgrow'); const s = getSelection(), inDocSel = s.rangeCount && !s.isCollapsed && $('#n-doc').contains(s.anchorNode), b = nBlock(), st = b ? ({ H2: 'Heading', BLOCKQUOTE: 'Quote' }[b.tagName] || (b.tagName === 'UL' && b.classList.contains('check') ? 'Checklist' : b.tagName === 'UL' ? 'List' : b.tagName === 'OL' ? 'Numbers' : 'Text')) : 'Text';
    const bar = $('#n-bar'); bar.classList.remove('sel');
    setBar(bar, `<button class="bt nstyle" type="button" data-nstyle>${st}${ic('chevron-down')}</button><span class="vr"></span>${[['bold', 'bold', 'Bold'], ['italic', 'italic', 'Italic'], ['strikeThrough', 'strikethrough', 'Strikethrough']].map(([c, i, n]) => `<button class="ib${inDocSel && nQS(c) ? ' on' : ''}" type="button" data-ncmd="${c}" aria-label="${n}" title="${n}">${ic(i)}</button>`).join('')}<button class="ib" type="button" data-nhl aria-label="Highlight" title="Highlight">${HLN}</button><button class="ib" type="button" data-nlink aria-label="Link" title="Link">${ic('link')}</button><span class="vr"></span><button class="ib${st === 'Checklist' ? ' on' : ''}" type="button" data-ncheck aria-label="Checklist" title="Checklist · type [] and a space">${CHK}</button><button class="ib${st === 'List' ? ' on' : ''}" type="button" data-ncmd="insertUnorderedList" aria-label="Bulleted list" title="List · type - and a space">${ic('list')}</button><button class="ib${st === 'Numbers' ? ' on' : ''}" type="button" data-ncmd="insertOrderedList" aria-label="Numbered list">${ic('list-ordered')}</button><span class="vr"></span><button class="ib" type="button" data-lmenu data-ninsert aria-label="Insert" title="Insert">${ic('plus')}</button>`); }
  const nCmd = (c, v) => { $('#n-doc').focus(); document.execCommand(c, false, v ?? null); nSave(); nBar(); };
  /* A list made inside an empty paragraph can end up nested in it; lift it out so it's a real block. */
  function nList2(cls) { const s = getSelection(), n = s.anchorNode; const l = (n.nodeType === 1 ? n : n.parentElement).closest('ul, ol'); if (!l) return; if (l.parentElement.tagName === 'P') { const p = l.parentElement; p.replaceWith(l); const r = document.createRange(); r.selectNodeContents(l.querySelector('li')); r.collapse(false); s.removeAllRanges(); s.addRange(r); } if (cls) l.classList.add(cls); }
  function nMarkdown() { const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return; const b = nBlock(); if (!b || b.tagName !== 'P' && b.tagName !== 'DIV') return; const t = b.textContent;
    const rule = [[/^#\s$/, () => document.execCommand('formatBlock', false, 'h2')], [/^-\s$/, () => { document.execCommand('insertUnorderedList'); nList2(); }], [/^1\.\s$/, () => { document.execCommand('insertOrderedList'); nList2(); }], [/^\[\]\s$/, () => { document.execCommand('insertUnorderedList'); nList2('check'); }], [/^>\s$/, () => document.execCommand('formatBlock', false, 'blockquote')]].find(([re]) => re.test(t.replace(/ /g, ' ')));
    if (!rule) return; b.innerHTML = '<br>'; const r = document.createRange(); r.setStart(b, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r); rule[1](); nBar(); }
  const nClose = () => $$('#w-notes .pop').forEach(p => p.remove());
  function nPop(anchor, html, cls = '', down = false) { const r = anchor.getBoundingClientRect(); nClose(); const w = $('#w-notes'), wr = w.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop ' + cls; p.innerHTML = html; w.appendChild(p);
    const left = Math.max(8, Math.min(r.left - wr.left - 6, wr.width - p.offsetWidth - 8)); Object.assign(p.style, down ? { left: Math.max(8, Math.min(r.right - wr.left - p.offsetWidth, wr.width - p.offsetWidth - 8)) + 'px', top: (r.bottom - wr.top + 8) + 'px' } : { left: left + 'px', bottom: (wr.bottom - r.top + 10) + 'px' }); return p; }
  function nToast(msg, undo, icon) { N.undo = undo || null; lToast($('#w-notes'), msg, { undo, icon }); }
  function nOpen(id) { nSave.t && clearTimeout(nSave.t); N.cur = id; nReveal(ncur()); nClose(); nSide(); nEditor(); nBar(); }
  function nNew(inside) { const cur = ncur(), par = inside ? NOTES.find(x => x.id === inside) : null;
    const n = note({ t: '', f: par ? par.f : cur.from ? 'personal' : cur.f || 'personal', parent: par ? par.id : null, at: 'Just now', html: '<p><br></p>' }); NOTES.unshift(n); N.q = ''; N.searching = false; nOpen(n.id); $('#n-title').focus(); }
  function nShare() { const n = ncur(), p = n.from ? [n.from, 'me'] : ['me', ...n.share];
    nPop($('#n-float [data-nshare].bt'), `<h6>Share “${esc(n.t || 'New note')}”</h6><label class="srch lnk">${ic('search')}<input id="n-add" placeholder="Add people by name or @username"></label>
      <div class="nppl">${p.map(k => `<div class="nperson">${av(k, 30)}<span><b>${k === 'me' ? 'You' : ppl(k).n}</b><span>${k === 'me' ? '@nick' : '@' + (ppl(k).u || 'phone')}</span></span><em>${k === (n.from || 'me') ? 'Owner' : 'Can edit'}</em></div>`).join('')}</div>
      <div class="nsug" id="n-sug">${['SK', 'AR', 'CL'].filter(k => !p.includes(k)).map(k => `<button class="mi" type="button" data-naddp="${k}">${av(k, 24)}<span><b>${ppl(k).n}</b><span class="sub">@${ppl(k).u}</span></span>${ic('plus')}</button>`).join('')}</div><hr>
      <div class="mi nlinkrow">${ic('link')}<span><b>Anyone with the link</b><span class="sub">Can view · end-to-end encrypted</span></span></div>
      <div class="pacts"><button class="bt sm fill" type="button" data-ntodo="Link copied">${ic('link')}Copy link</button><button class="bt sm key" type="button" data-ntodo="Sent to ${n.share[0] ? ppl(n.share[0]).n.split(' ')[0] : 'Messages'} in Messages">${ic('message-square')}Send in Messages</button></div>`, 'nsharepop', true); setTimeout(() => $('#n-add')?.focus(), 20); }
  function nIsl() { let i = $('#n-isl'); const n = ncur(), w = $('#w-notes'); if (!w.classList.contains('phone') || w.classList.contains('navopen') || !n) { i?.remove(); return; }
    if (!i) { $('#n-main').insertAdjacentHTML('beforeend', '<div class="nisl" id="n-isl"></div>'); i = $('#n-isl'); }
    const sh = n.share.filter(k => k !== 'me'), fold = n.f ? FOLD[n.f][0] : 'Notes', ed = /^(Today|Just now)/i.test(n.at) ? 'Edited just now' : `Edited ${n.at}`, sub = n.live ? `${ppl(n.live).n.split(' ')[0]} is here · ${ed}` : sh.length ? `Shared with ${sh.length} · ${ed}` : ed;   /* as iOS Notes: ‹ names the folder you go back to */
    i.classList.toggle('open', !!N.isl);
    i.innerHTML = `<div class="nislr"><button class="nislb" type="button" data-nback aria-label="All notes">${ic('chevron-left')}</button><button class="nisli" type="button" data-nisl aria-expanded="${!!N.isl}" aria-label="${esc(fold)}. Note details"><span><b>${esc(fold)}</b><small>${n.live ? '<i class="ond round"></i>' : ''}${esc(sub)}</small></span></button></div>
      ${N.isl ? `<div class="nislp"><div class="fsha nislt">${[['data-npin', 'pin', n.pinned ? 'Pinned' : 'Pin', n.pinned], ['data-ntodo="Link copied"', 'link', 'Copy link'], ['data-nislmove', 'folder', 'Move'], ['data-ndup', 'copy', 'Duplicate']].map(([a, ico, t, on]) => `<button type="button" class="fvt${on ? ' on' : ''}" ${a}>${ic(ico)}<span>${t}</span></button>`).join('')}</div>
        <div class="fexh">People${sh.length ? `<em>${sh.length + 1}</em>` : ''}</div><div class="nislpp">${['me', ...sh].map(k => `<div class="nislpr">${av(k, 34)}<span><b>${k === 'me' ? 'You' : esc(ppl(k).n)}</b><small>${k === 'me' ? 'Owner' : n.live === k ? '<i class="ond round"></i>Here now' : 'Can edit'}</small></span></div>`).join('')}<button class="nislpr add" type="button" data-ntodo="Add people by name, @username or email"><i class="nisladd">${ic('user-plus')}</i><span><b>Add people</b><small>By name, @username or email</small></span></button></div>
        <div class="nislfoot"><button class="fexr2" type="button" data-ntodo="Exported as Markdown">${ic('download')}<span>Export as Markdown</span></button><button class="fexr2 red" type="button" data-ndel>${ic('trash-2')}<span>Delete note</span></button></div></div>` : ''}`; }
  function nClick(e, hit) {
    if (hit('[data-nback]')) { N.isl = false; $('#w-notes').querySelector(':scope > .phback')?.click(); setTimeout(nIsl, 30); return true; }
    if (hit('[data-nisl]')) { N.isl = !N.isl; N.px = ''; nBarPhone(); return true; }
    if (hit('[data-nislmove]')) { N.isl = false; N.px = 'move'; nBarPhone(); return true; }
    if (N.isl && !hit('#n-isl')) { N.isl = false; nIsl(); }
    if ($('#w-notes').classList.contains('phone')) { const lp = hit('[data-nlpx]'); if (lp) { N.lpx = N.lpx === lp.dataset.nlpx ? '' : lp.dataset.nlpx; nSide(); return true; }
      const pf = hit('[data-npfold]'); if (pf) { N.pfold = pf.dataset.npfold || null; N.lpx = ''; nSide(); return true; }
      if (hit('#n-side [data-nnew]')) { N.lpx = ''; nNew(); $('#w-notes').classList.remove('navopen'); return true; } }
    const mk = hit('[data-nmark]'); if (mk) { const key = mk.dataset.nmark === 'page' ? 'n:' + N.cur : mk.dataset.nmark;
      lPick(mk, markOf(key), m => { NMARK[key] = m; if (key.startsWith('f:') && m.t !== 'emoji' && m.h != null) FOLD[key.slice(2)][1] = m.h; nSide(); nPic();
        const fresh = mk.dataset.nmark === 'page' ? $('#n-pic') : $(`#n-side [data-nmark="${key}"]`); if (fresh && LP.anchor) { LP.anchor = fresh; fresh.classList.add('lpon'); } if (key.startsWith('f:')) { const sc = $('#n-scroll').scrollTop; nEditor(); $('#n-scroll').scrollTop = sc; } }); return true; }
    if (!hit('.pop')) nClose();
    const tw = hit('[data-ntw]'); if (tw && (hit('.tw') || tw.classList.contains('fd'))) { const k = tw.dataset.ntw; N.open.has(k) ? N.open.delete(k) : N.open.add(k); nSide(); return true; }
    const ni = hit('[data-nnewin]'); if (ni) { nClose(); nNew(+ni.dataset.nnewin); return true; }
    const nh = hit('[data-nnewhere]'); if (nh) { nClose(); const n = note({ t: '', f: nh.dataset.nnewhere, at: 'Just now', html: '<p><br></p>' }); NOTES.unshift(n); nOpen(n.id); $('#n-title').focus(); return true; }
    const fi = hit('[data-nfolderin]'); if (fi) { N.newIn = fi.dataset.nfolderin; }
    const o = hit('[data-nopen]'); if (o) { nOpen(+o.dataset.nopen); return true; }
    if (hit('[data-nfpick]')) { const cnt = k => k === 'all' ? NOTES.length : k === 'shared' ? NOTES.filter(n => n.share.length || n.from).length : NOTES.filter(n => n.f === k).length;
      nPop(hit('[data-nfpick]'), `${[['all', 'All notes', null], ...Object.entries(FOLD).map(([k, [n, h]]) => [k, n, h]), ['shared', 'Shared with me', null]].map(([k, n, h], i, a) => `${i === a.length - 1 ? '<hr>' : ''}<button class="mi" type="button" data-nfolder="${k}" ${h != null ? `style="--nh:${h}"` : ''}>${h != null ? '<i class="fdot round"></i>' : ic(k === 'shared' ? 'users' : 'layers')}<span>${n}</span><em class="fc">${cnt(k)}</em>${N.f === k ? `<span class="end">${ic('check')}</span>` : ''}</button>`).join('')}<hr><button class="mi" type="button" data-nnewfolder>${ic('plus')}<span>New folder</span></button>`, 'nfolderpop', true); return true; }
    const f = hit('[data-nfolder]'); if (f) { N.f = f.dataset.nfolder; nClose(); nSide(); return true; }
    if (hit('[data-nnew]')) { nNew(); return true; }
    if (hit('[data-nsearch]')) { N.searching = true; nSide(); $('#n-q').focus(); return true; }
    if (hit('[data-nsearchx]')) { N.searching = false; N.q = ''; nSide(); return true; }
    if (hit('[data-nnewfolder]') || fi) { if (!fi) N.newIn = null; nPop(hit('[data-nnewfolder]') || $('#n-side [data-nnewfolder]'), `<h6>New folder${N.newIn ? ' in ' + esc(FOLD[N.newIn][0]) : ''}</h6><label class="srch lnk"><input id="n-fname" placeholder="Folder name"></label><div class="swrow">${[20, 95, 150, 200, 250, 330].map((h, i) => `<button type="button" class="sw1 round${i === 2 ? ' on' : ''}" data-nsw="${h}" style="--nh:${h}"></button>`).join('')}</div><div class="pacts"><button class="bt sm key" type="button" data-nmkfolder>Create</button></div>`, 'nfpop', true); setTimeout(() => $('#n-fname').focus(), 20); return true; }
    const sw = hit('[data-nsw]'); if (sw) { $$('.sw1').forEach(x => x.classList.toggle('on', x === sw)); return true; }
    if (hit('[data-nmkfolder]')) { const v = $('#n-fname').value.trim() || 'New folder', h = +($('.sw1.on')?.dataset.nsw || 150), k = 'f' + Date.now(); FOLD[k] = [v, h, N.newIn]; N.open.add('f' + k); if (N.newIn) N.open.add('f' + N.newIn); N.newIn = null; nClose(); nSide(); nToast(`Created “${esc(v)}”`); return true; }
    if (hit('[data-nshare]') && nNarrow()) { N.px = N.px === 'share' ? null : 'share'; nBar(); return true; }
    if (hit('[data-nshare]')) { nShare(); return true; }
    const ap = hit('[data-naddp]'); if (ap) { const n = ncur(); n.share.push(ap.dataset.naddp); nShare(); nTop(); nSide(); nToast(`Shared with ${ppl(ap.dataset.naddp).n}. They’ll see it in Notes and in Messages.`); return true; }
    const td = hit('[data-ntodo]'); if (td) { nClose(); nToast(td.dataset.ntodo); return true; }
    const npx = hit('[data-npx]'); if (npx) { const v = npx.dataset.npx; N.px = N.px === v ? null : v; nBar(); return true; }
    if (hit('[data-npin]')) { const n = ncur(); n.pinned = !n.pinned; nTop(); nSide(); if (N.px) { N.px = null; nBar(); nToast(n.pinned ? 'Pinned' : 'Unpinned', null, 'pin'); } return true; }
    if (hit('[data-nmore]')) { const n = ncur(); nPop(hit('[data-nmore]'), `${[['data-nmove', 'folder', 'Move to folder'], ['data-ndup', 'copy', 'Duplicate'], ['data-ntodo="Exported as Markdown"', 'download', 'Export as Markdown'], ['data-ntodo="Opened in Write"', 'file-text', 'Open in Write']].map(([a, i, t]) => `<button class="mi" type="button" ${a}>${ic(i)}<span>${t}</span></button>`).join('')}<hr><button class="mi danger" type="button" data-ndel>${ic('trash-2')}<span>Delete note</span></button>`, 'nmorepop', true); return true; }
    if (hit('[data-nmove]')) { const a = hit('[data-nmove]').closest('.pop') ? $('#n-float [data-nmore]') : hit('[data-nmove]'); nPop(a, `<h6>Move to</h6>${Object.entries(FOLD).map(([k, [n, h]]) => { let d = 0, f = k; while ((f = fParent(f))) d++; return [k, n, h, d]; }).map(([k, n, h, d]) => `<button class="mi" type="button" data-nmoveto="${k}" style="--nh:${h};padding-left:${10 + d * 16}px"><i class="fdot round"></i><span>${n}</span>${ncur().f === k ? `<span class="end">${ic('check')}</span>` : ''}</button>`).join('')}`, 'nmorepop', !hit('#n-meta')); return true; }
    const mt = hit('[data-nmoveto]'); if (mt) { N.px = null; const n = ncur(), snap = nSnap(); setF(n, mt.dataset.nmoveto); n.parent = null; nReveal(n); nClose(); nSide(); nEditor(); nToast(`Moved to ${FOLD[n.f][0]}`, () => { nRestore(snap); }); return true; }
    if (hit('[data-ndup]') || hit('[data-ndel]')) N.px = null;
    if (hit('[data-ndup]')) { const n = ncur(), c = note({ ...JSON.parse(JSON.stringify(n)), id: undefined, t: n.t + ' copy', pinned: false, live: null, at: 'Just now' }); c.id = NID++; NOTES.unshift(c); nOpen(c.id); nToast('Duplicated'); return true; }
    if (hit('[data-ndel]')) { const n = ncur(), i = NOTES.indexOf(n); NOTES.splice(i, 1); nOpen((NOTES[i] || NOTES[i - 1]).id); nToast(`Deleted “${esc(n.t)}”`, () => { NOTES.splice(i, 0, n); nOpen(n.id); }); return true; }
    const c = hit('[data-ncmd]'); if (c) { nCmd(c.dataset.ncmd); return true; }
    if (hit('[data-nhl]')) { document.execCommand('styleWithCSS', false, true); nCmd('hiliteColor', '#fde68a'); return true; }
    if (hit('[data-nlink]')) { nCmd('createLink', 'https://simplyluma.com'); return true; }
    if (hit('[data-ncheck]')) { $('#n-doc').focus(); const b = nBlock(); if (b?.tagName === 'UL') b.classList.toggle('check'); else { document.execCommand('insertUnorderedList'); nList2('check'); } nSave(); nBar(); return true; }
    if (hit('[data-nstyle]')) { nPop(hit('[data-nstyle]'), `<h6>Style</h6>${[['h2', 'Heading', 'p-h2'], ['p', 'Text', 'p-p'], ['blockquote', 'Quote', 'p-q']].map(([k, n, cl]) => `<button class="mi" type="button" data-nblock="${k}"><span class="prev ${cl}">${n}</span></button>`).join('')}`, 'stylepop'); return true; }
    const bl = hit('[data-nblock]'); if (bl) { nClose(); nCmd('formatBlock', bl.dataset.nblock); return true; }
    const ins = hit('[data-ninsert]'); if (ins) { lMenu(ins, crMi('data-nphoto', 'image', 'Image\u2026') + crMi('data-nfile', 'paperclip', 'File\u2026') + crMi('data-ndiv', 'minus', 'Divider') + '<span class="crsep"></span>' + crMi(`data-nnewin="${N.cur}"`, 'file-text', 'Note inside this one')); return true; }
    if (hit('[data-ndiv]')) { $('#lmenu')?.remove(); $('#n-doc').focus(); document.execCommand('insertHTML', false, '<hr><p><br></p>'); nSave(); return true; }
    if (hit('[data-nfile]')) { $('#lmenu')?.remove(); lToast($('#w-notes'), 'Choose a file to attach'); return true; }
    if (hit('[data-nphoto]')) { $('#lmenu')?.remove(); $('#n-doc').focus(); document.execCommand('insertHTML', false, `<figure contenteditable="false"><img src="${PH}life-sync-terrace.webp" alt=""></figure><p><br></p>`); nSave(); return true; }
    const li = hit('#n-doc ul.check > li'); if (li && e.offsetX < 28) { li.classList.toggle('done'); nSave(); return true; }
    return false; }
  (() => { const w = $('#w-notes'); if (!w) return;
    $('#n-doc').addEventListener('input', e => { if (e.inputType === 'insertText' && e.data === ' ') nMarkdown(); nSave(); });
    $('#n-title').addEventListener('input', () => nSave('title'));
    $('#n-title').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const d = $('#n-doc'); d.focus(); if (!d.firstElementChild) d.innerHTML = '<p><br></p>'; const r = document.createRange(); r.selectNodeContents(d.firstElementChild); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } });
    w.addEventListener('mousedown', e => { if (e.target.closest('#n-bar button, #w-notes .stylepop button')) e.preventDefault(); });
    document.addEventListener('selectionchange', () => { if (front()?.dataset.app === 'notes') nBar(); });
    w.addEventListener('contextmenu', e => { const r = e.target.closest('#n-side [data-nopen]'); if (!r) return; e.preventDefault(); nOpen(+r.dataset.nopen); const n = ncur();
      nPop(r, `${[['data-npin', 'pin', n.pinned ? 'Unpin' : 'Pin'], [`data-nnewin="${n.id}"`, 'plus', 'New note inside'], ['data-nshare', 'users', 'Share…'], ['data-nmove', 'folder', 'Move to folder'], ['data-ndup', 'copy', 'Duplicate']].map(([a, i, t]) => `<button class="mi" type="button" ${a}>${ic(i)}<span>${t}</span></button>`).join('')}<hr><button class="mi danger" type="button" data-ndel>${ic('trash-2')}<span>Delete</span></button>`, 'nmorepop', true);
      const p = $('#w-notes .nmorepop'), wr = w.getBoundingClientRect(); Object.assign(p.style, { left: (e.clientX - wr.left) + 'px', top: (e.clientY - wr.top) + 'px' }); });
    document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'notes') return; const k = e.key.toLowerCase(), m = e.ctrlKey || e.metaKey;
      if (m && k === 'n') { e.preventDefault(); nNew(); } else if (m && k === 'f') { e.preventDefault(); N.searching = true; nSide(); $('#n-q').focus(); } else if (k === 'escape') nClose(); }); })();
  const nSnap = () => ({ f: JSON.stringify(FOLD), n: NOTES.map(n => [n.id, n.f, n.parent]) });
  function nRestore(s) { const f = JSON.parse(s.f); Object.keys(FOLD).forEach(k => delete FOLD[k]); Object.assign(FOLD, f); s.n.forEach(([id, fo, pa]) => { const n = NOTES.find(x => x.id === id); if (n) { n.f = fo; n.parent = pa; } }); nSide(); nEditor(); nToast('Undone'); }
  (() => { const w = $('#w-notes'); if (!w) return; const clear = () => $$('#n-side .drop').forEach(x => x.classList.remove('drop'));
    const ok = (t) => { const d = N.drag; if (!d || !t) return false;
      if (t.dataset.dropf) { const k = t.dataset.dropf; return d.type === 'n' ? true : k !== d.id && !inFolder(k, d.id); }
      if (t.dataset.dropn) { const id = +t.dataset.dropn; return d.type === 'n' && id !== d.id && !isDesc(id, d.id); }
      if (t.hasAttribute('data-droproot')) return d.type === 'f'; return false; };
    w.addEventListener('dragstart', e => { const r = e.target.closest?.('[data-dragn], [data-dragf]'); if (!r) return; N.drag = r.dataset.dragn ? { type: 'n', id: +r.dataset.dragn } : { type: 'f', id: r.dataset.dragf }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'suno-note'); });
    w.addEventListener('dragover', e => { const t = e.target.closest('[data-dropf], [data-dropn], [data-droproot]'); clear(); if (!ok(t)) return; e.preventDefault(); t.classList.add('drop'); });
    w.addEventListener('drop', e => { const t = e.target.closest('[data-dropf], [data-dropn], [data-droproot]'); clear(); if (!ok(t)) return; e.preventDefault(); const d = N.drag, s = nSnap(); N.drag = null; let msg;
      if (d.type === 'n') { const n = NOTES.find(x => x.id === d.id); if (t.dataset.dropf) { setF(n, t.dataset.dropf); n.parent = null; msg = `Moved “${esc(n.t)}” to ${FOLD[n.f][0]}`; } else { const p = NOTES.find(x => x.id === +t.dataset.dropn); setF(n, p.f); n.parent = p.id; N.open.add('n' + p.id); msg = `“${esc(n.t)}” is now inside “${esc(p.t)}”`; } nReveal(n); }
      else { FOLD[d.id][2] = t.dataset.dropf || null; if (t.dataset.dropf) N.open.add('f' + t.dataset.dropf); msg = `Moved ${esc(FOLD[d.id][0])} ${t.dataset.dropf ? 'into ' + esc(FOLD[t.dataset.dropf][0]) : 'to the top'}`; }
      nSide(); nEditor(); nToast(msg, () => nRestore(s)); });
    w.addEventListener('dragend', () => { N.drag = null; clear(); });
    w.addEventListener('contextmenu', e => { const r = e.target.closest('#n-side .fd'); if (!r) return; e.preventDefault(); e.stopImmediatePropagation(); const k = r.dataset.dropf;
      nPop(r, `<h6>${esc(FOLD[k][0])}</h6><button class="mi" type="button" data-nnewhere="${k}">${ic('plus')}<span>New note here</span></button><button class="mi" type="button" data-nfolderin="${k}">${ic('folder-plus')}<span>New folder inside</span></button>`, 'nmorepop', true);
      const p = $('#w-notes .nmorepop'), wr = w.getBoundingClientRect(); Object.assign(p.style, { left: (e.clientX - wr.left) + 'px', top: (e.clientY - wr.top) + 'px' }); }, true); })();
  function renderNotes() { const w = $('#w-notes'); w.classList.toggle('lsideoff', !lSideOn(w)); $('#n-top').innerHTML = `<img src="${A}notes.svg" alt=""><b>Notes</b><span class="chev">${ic('chevron-down')}</span>${lSideBtn(w)}`; nSide(); nEditor(); nBar(); }

  Object.assign(SVG, { 'user-plus': SVG['user-plus'],
    cake: SVG['cake'],
    briefcase: SVG['briefcase'],
    scan: SVG['scan'],
    send: SVG['send'],
    'at-sign': SVG['at-sign'] });
  /* ══ Contacts ══════════════════════════════════════════════════════════════
     People, not a form. The list: your card, favourite faces, then A to Z. A contact is lit like a Messages room:
     their face, @username, one row of actions (Message is the key), then what you share with them across Suno,
     what they can see of you, and a private note. Add people by @username or your code; phone numbers are optional. */
  Object.assign(PPL, { AC: { n: 'Ada Chen', u: 'ada', h: 200 }, BO: { n: 'Ben Okoro', u: 'benok', h: 30 }, CD: { n: 'Carmen Díaz', u: 'carmen', h: 350 }, EN: { n: 'Eli Novak', u: 'eli', h: 230 },
    GP: { n: 'Grace Park', u: 'grace.p', h: 300 }, HS: { n: 'Hana Sato', u: 'hana', h: 180 }, KM: { n: 'Kofi Mensah', u: 'kofi', h: 60 }, MS2: { n: 'Maya Singh', u: 'maya', h: 320 },
    OH: { n: 'Omar Haddad', u: 'omar', h: 140 }, RA: { n: 'Ruth Adler', u: null, phone: '+1 (212) 555-0107', h: 10 }, ZM: { n: 'Zoe Martin', u: 'zoe', h: 270 } });
  const CX = {
    PR: { fav: 1, lists: ['launch'], phone: '+1 (415) 555-0199', email: 'priya@simplyluma.com', work: 'Suno · Design', bday: 'March 14', addr: 'Oakland, California', note: 'Oat milk, no sugar. Loves the Pet Sounds sleeve as much as I do.' },
    NF: { fav: 1, lists: ['launch'], phone: '+1 (510) 555-0133', email: 'nora@simplyluma.com', work: 'Suno · Press', bday: 'November 2', addr: 'Berkeley, California' },
    MO: { fav: 1, lists: ['family'], phone: '+1 (510) 555-0142', bday: 'June 2', addr: 'Sacramento, California', note: 'Birthday dinner: Thai place on J Street.' },
    TH: { fav: 1, phone: '+1 (628) 555-0170', email: 'theo.marsh@proton.me', bday: 'August 19', addr: 'San Francisco, California' },
    SK: { lists: ['launch'], email: 'sam@simplyluma.com', work: 'Suno · Engineering' }, AR: { email: 'alex@ruizstudio.co', work: 'Ruiz Studio' }, CL: { phone: '+1 (510) 555-0181' }, JK: {},
    RA: { lists: ['family'], phone: '+1 (212) 555-0107', bday: 'January 30' }, KM: { lists: ['launch'], work: 'Suno · Community' } };
  const LISTS = { launch: 'Launch team', family: 'Family' };
  /* the rest of the address book: enough people that the list reads like a real one */
  Object.assign(PPL, { X00: { n: 'Aaron Fischer', u: 'aaronf', h: 20 }, X01: { n: 'Amara Osei', u: 'amara', h: 67 }, X02: { n: 'Anya Petrova', u: 'anya', h: 114 }, X03: { n: 'Beatriz Souza', u: 'bia', h: 161 }, X04: { n: 'Bram de Vries', u: 'bram', h: 208 }, X05: { n: 'Caleb Wright', u: null, phone: '+1 (510) 555-0125', h: 255 }, X06: { n: 'Chloé Martin', u: 'chloe', h: 302 }, X07: { n: 'Daniel Park', u: 'dpark', h: 349 }, X08: { n: 'Diego Alvarez', u: 'diego', h: 36 }, X09: { n: 'Elena Rossi', u: 'elena', h: 83 }, X10: { n: 'Emma Lindqvist', u: 'emmal', h: 130 }, X11: { n: 'Farah Haddad', u: 'farah', h: 177 }, X12: { n: 'Felix Braun', u: null, phone: '+1 (925) 555-0132', h: 224 }, X13: { n: 'Grace Liu', u: 'grace', h: 271 }, X14: { n: 'Hana Sato', u: 'hana', h: 318 }, X15: { n: 'Hugo Laurent', u: 'hugo', h: 5 }, X16: { n: 'Imani Brooks', u: 'imani', h: 52 }, X17: { n: 'Isaac Cohen', u: null, phone: '+1 (510) 555-0137', h: 99 }, X18: { n: 'Jade Nguyen', u: 'jade', h: 146 }, X19: { n: 'Jonas Weber', u: 'jonas', h: 193 }, X20: { n: 'Kai Tanaka', u: 'kai', h: 240 }, X21: { n: 'Kiara Patel', u: 'kiara', h: 287 }, X22: { n: 'Leo Moretti', u: null, phone: '+1 (510) 555-0142', h: 334 }, X23: { n: 'Lucía Romero', u: 'lucia', h: 21 }, X24: { n: 'Marcus Hill', u: 'marcus', h: 68 }, X25: { n: 'Mei Chen', u: 'mei', h: 115 }, X26: { n: 'Mia Svensson', u: null, phone: '+1 (628) 555-0146', h: 162 }, X27: { n: 'Noah Bennett', u: 'noahb', h: 209 }, X28: { n: 'Olivia Grant', u: 'olivia', h: 256 }, X29: { n: 'Omar Farouk', u: 'omar', h: 303 }, X30: { n: 'Paulo Silva', u: 'paulo', h: 350 }, X31: { n: 'Quinn Harper', u: 'quinn', h: 37 }, X32: { n: 'Rafael Costa', u: null, phone: '+1 (510) 555-0152', h: 84 }, X33: { n: 'Rosa Jiménez', u: 'rosa', h: 131 }, X34: { n: 'Samir Nasser', u: 'samir', h: 178 }, X35: { n: 'Sofia Ricci', u: 'sofia', h: 225 }, X36: { n: 'Tomás Ortega', u: 'tomas', h: 272 }, X37: { n: 'Uma Reddy', u: 'uma', h: 319 }, X38: { n: 'Victor Hugo Lima', u: null, phone: '+1 (415) 555-0158', h: 6 }, X39: { n: 'Wren Adler', u: 'wren', h: 53 }, X40: { n: 'Yara Haddad', u: 'yara', h: 100 }, X41: { n: 'Zoe Kim', u: 'zoek', h: 147 } });
  Object.assign(CX, { X00: { work: 'Architect', phone: '+1 (628) 555-0120' }, X01: { phone: '+1 (415) 555-0121' }, X02: { work: 'Photographer', phone: '+1 (925) 555-0122' }, X03: { phone: '+1 (510) 555-0123' }, X04: { work: 'Sound engineer', phone: '+1 (510) 555-0124' }, X06: { work: 'Illustrator', phone: '+1 (628) 555-0126' }, X07: { phone: '+1 (510) 555-0127' }, X08: { work: 'Suno · Engineering', phone: '+1 (415) 555-0128' }, X09: { phone: '+1 (510) 555-0129' }, X10: { work: 'Product designer', phone: '+1 (510) 555-0130' }, X11: { phone: '+1 (925) 555-0131' }, X12: { work: 'Landlord' }, X13: { work: 'Pediatrician', phone: '+1 (510) 555-0133' }, X14: { phone: '+1 (415) 555-0134' }, X15: { work: 'Chef · Nopa', phone: '+1 (510) 555-0135' }, X16: { phone: '+1 (925) 555-0136' }, X17: { work: 'Plumber' }, X18: { work: 'Suno · Support', phone: '+1 (510) 555-0138' }, X19: { phone: '+1 (415) 555-0139' }, X20: { work: 'Climbing coach', phone: '+1 (510) 555-0140' }, X21: { phone: '+1 (925) 555-0141' }, X23: { work: 'Translator', phone: '+1 (415) 555-0143' }, X24: { phone: '+1 (510) 555-0144' }, X25: { work: 'Suno · Engineering', phone: '+1 (415) 555-0145' }, X26: { work: 'Dentist' }, X27: { phone: '+1 (925) 555-0147' }, X28: { work: 'Editor, The Verge', phone: '+1 (415) 555-0148' }, X29: { phone: '+1 (510) 555-0149' }, X30: { phone: '+1 (628) 555-0150' }, X31: { work: 'Suno · Community', phone: '+1 (415) 555-0151' }, X33: { phone: '+1 (415) 555-0153' }, X34: { work: 'Accountant', phone: '+1 (628) 555-0154' }, X35: { phone: '+1 (510) 555-0155' }, X36: { phone: '+1 (510) 555-0156' }, X37: { work: 'Suno · Design', phone: '+1 (510) 555-0157' }, X39: { work: 'Musician', phone: '+1 (925) 555-0159' }, X40: { phone: '+1 (925) 555-0160' }, X41: { phone: '+1 (628) 555-0161' } });
  const CT = { cur: 'PR', q: '', searching: false, list: 'all', edit: false, shareMine: { PR: true } };
  const cx = k => CX[k] || (CX[k] = {});
  const cName = k => k === 'me' ? 'Nick' : ppl(k).n;
  const people = () => Object.keys(PPL).filter(k => k !== 'me').filter(k => CT.list === 'all' || (CT.list === 'fav' ? cx(k).fav : (cx(k).lists || []).includes(CT.list)))
    .filter(k => !CT.q || (ppl(k).n + ' ' + (ppl(k).u || '') + ' ' + (cx(k).work || '')).toLowerCase().includes(CT.q.toLowerCase())).sort((a, b) => ppl(a).n.localeCompare(ppl(b).n));
  function ctSide() { const list = people(), favs = Object.keys(PPL).filter(k => cx(k).fav), lname = CT.list === 'all' ? 'All contacts' : CT.list === 'fav' ? 'Favorites' : LISTS[CT.list];
    const groups = {}; list.forEach(k => (groups[ppl(k).n[0].toUpperCase()] = groups[ppl(k).n[0].toUpperCase()] || []).push(k));
    const row = k => `<button class="ctrow${CT.cur === k ? ' on' : ''}" type="button" data-ct="${k}">${av(k, 34)}<span><b>${esc(ppl(k).n)}</b><span>${ppl(k).u ? '@' + ppl(k).u : 'Phone contact'}</span></span></button>`;
    $('#c-side').innerHTML = `
      <div class="scr">${CT.list !== 'all' ? lFiltHead(lname, 'data-clist', 'all') : ''}${!CT.q && CT.list === 'all' ? `<div class="cmecard"><button class="ctrow me${CT.cur === 'me' ? ' on' : ''}" type="button" data-ct="me">${av('me', 34)}<span><b>Nick</b><span>My card · @nick</span></span>${ic('chevron-right')}</button></div>` : ''}
        ${Object.entries(groups).map(([l, ks]) => `<div class="sh">${l}</div>${ks.map(row).join('')}`).join('') || `<div class="fhint">No one matches.</div>`}</div>
      ${lFoot({ q: { attr: 'id="c-q"', ph: 'Search people', value: CT.q }, filter: { items: [['all', 'All contacts', 'users'], ['fav', 'Favorites', 'star'], ...Object.entries(LISTS).map(([k, v]) => [k, v, 'list'])], cur: CT.list, attr: 'data-clist' }, add: { attr: 'data-cadd', label: 'Add a person', icon: 'user-plus' } })}`; requestAnimationFrame(segs);
    const i = $('#c-q'); if (i) { i.oninput = () => { CT.q = i.value; ctSide(); const x = $('#c-q'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }; i.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); CT.searching = false; CT.q = ''; ctSide(); } }; } }
  function together(k) { const out = [];
    CONVOS.filter(c => c.dm === k || (c.group || []).includes(k)).forEach(c => { const x = lastOf(c); out.push({ ic: 'message-square', t: who(c).n, s: preview(c, x), at: x.day === 'Today' || !x.day ? x.at : x.day, app: 'Messages' }); });
    NOTES.filter(n => n.share.includes(k) || n.from === k).forEach(n => out.push({ ic: 'file-text', t: n.t, s: n.from ? 'Shared with you' : 'You both can edit', at: n.at.replace('Today, ', ''), app: 'Notes' }));
    if (k === 'PR') out.push({ ic: 'image', t: 'Press photos', s: '12 photos in a shared album', at: 'Today', app: 'Photos' }, { file: { n: 'launch-deck.stage', k: 'deck', sz: '18.4 MB' }, s: 'Sent to you in Launch crew', app: 'Stage' });
    return out; }
  function ctMain() { const k = CT.cur, p = k === 'me' ? { n: 'Nick', u: 'nick', h: 250 } : ppl(k), c = k === 'me' ? { phone: '+1 (510) 555-0100', email: 'nick@simplyluma.com', work: 'Suno · Founder' } : cx(k), me = k === 'me', onLuma = !!p.u;
    const bg = p.face; $('#c-light').style.backgroundImage = bg ? `url('${PH}${bg[0]}.webp')` : 'none'; $('#c-light').style.backgroundPosition = bg ? `${bg[1] * 100}% ${bg[2] * 100}%` : ''; $('#w-contacts').style.setProperty('--ch', p.h);
    const E = CT.edit, fld = (key, label, val, icon) => (val || E) ? `<div class="crow2">${ic(icon)}<span><em>${label}</em>${E ? `<input data-cf="${key}" value="${esc(val || '')}" placeholder="Add ${label.toLowerCase()}">` : `<b>${esc(val)}</b>`}</span>${!E && val ? `<button class="ib" type="button" data-ccopy="${esc(val)}" aria-label="Copy ${label}">${ic('copy')}</button>` : ''}</div>` : '';
    const tg = me ? [] : together(k);
    $('#c-body').innerHTML = `<div class="chero">${av(me ? 'me' : k, 116)}<h1>${E && !me ? `<input class="cname" data-cf="name" value="${esc(p.n)}">` : esc(p.n)}</h1>
        <div class="csub">${onLuma ? `<span class="handle">@${p.u}</span><span class="onl2"><i class="round"></i>On Suno</span>` : `<span class="handle">${esc(p.phone)}</span><span class="onl2 off">Not on Suno</span>`}</div>${c.work ? `<div class="cwork">${esc(c.work)}</div>` : ''}
        ${me || E ? '' : lContactActs(k)}</div>
      <div class="cgrid">
        <section class="ccard"><h6>Contact</h6>${fld('phone', 'Mobile', c.phone || (!onLuma && p.phone), 'phone')}${fld('email', 'Email', c.email, 'mail')}${fld('bday', 'Birthday', c.bday, 'cake')}${fld('addr', 'Address', c.addr, 'map-pin')}${fld('work', 'Work', c.work, 'briefcase')}
          ${!E && !c.phone && !c.email && !c.bday && !c.addr ? `<p class="cempty">Only their @username. That’s all you need to reach someone on Suno.</p>` : ''}</section>
        ${me ? `<section class="ccard"><h6>What people see</h6><p class="cp">Your name, photo and <b>@nick</b>. Your phone number and email stay hidden unless you share them with someone.</p><div class="crow2">${ic('link')}<span><em>Your link</em><b>simplyluma.com/@nick</b></span><button class="ib" type="button" data-ccopy="simplyluma.com/@nick" aria-label="Copy link">${ic('copy')}</button></div></section>`
          : `<section class="ccard ctog"><h6>Together</h6><div class="tgl">${tg.length ? tg.map(x => x.file ? lFile(x.file, { sub: x.s, cls: 'tgfile', open: `data-ctodo="Opening ${esc(x.file.n)} in ${x.app}"` }) : `<button class="tgi" type="button" data-ctodo="Opening in ${x.app}">${ic(x.ic)}<span><b>${esc(x.t)}</b><span>${esc(x.s)}</span></span><em>${x.at}</em></button>`).join('') : `<p class="cempty">Nothing shared yet. Conversations, notes and files you share with ${esc(p.n.split(' ')[0])} will gather here.</p>`}</div></section>`}
        ${me ? '' : onLuma ? `<section class="ccard"><h6>What ${esc(p.n.split(' ')[0])} sees</h6><p class="cp">Your name, photo and <b>@nick</b>.${CT.shareMine[k] ? ' And your mobile number.' : ' Your number stays hidden.'}</p>
          <div class="crow2 tog">${ic('phone')}<span><b>Share my mobile number</b><em>Only with ${esc(p.n.split(' ')[0])}</em></span><button class="sw${CT.shareMine[k] ? ' on' : ''}" type="button" data-cshare aria-label="Share my mobile number"></button></div></section>`
          : `<section class="ccard invite"><h6>Not on Suno</h6><p class="cp">Texts with ${esc(p.n.split(' ')[0])} go through the phone network and aren’t encrypted. Invite them, and they can keep their number.</p><button class="bt fill" type="button" data-ctodo="Invite sent to ${esc(p.n.split(' ')[0])}">${ic('send')}Invite ${esc(p.n.split(' ')[0])}</button></section>`}
        ${me ? '' : `<section class="ccard"><h6>Private note</h6><div class="cnote" contenteditable="true" data-ph="Only you can see this" data-cnote="${k}">${esc(c.note || '')}</div><span class="cnh">${ic('lock')}Only you can see this</span></section>`}
      </div>`;
    $('#c-float').innerHTML = E ? `<button class="bt" type="button" data-ccancel>Cancel</button><button class="bt key" type="button" data-csave>Done</button>`
      : `<button class="bt" type="button" ${me ? 'data-cmycode' : 'data-share'} title="Share" aria-label="Share">${ic('share-2')}<span>Share</span></button><button class="bt key" type="button" data-cedit>${ic('pencil')}<span>Edit</span></button>${me ? '' : `<button class="ib" type="button" data-cmore aria-label="More" title="More">${ic('ellipsis')}</button>`}`;
    $('#c-float').hidden = false; $('#c-bar').classList.remove('on');
    $('#c-scroll').scrollTop = 0; CT.px = null; ctPhBar(); }
  const cClose = () => $$('#w-contacts .pop').forEach(p => p.remove());
  function cPop(anchor, html, cls = '', down = true) { const r = anchor.getBoundingClientRect(); cClose(); const w = $('#w-contacts'), wr = w.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop ' + cls; p.innerHTML = html; w.appendChild(p);
    if (down && r.bottom - wr.top + 8 + p.offsetHeight > wr.height - 8) down = false; else if (!down && r.top - wr.top - 8 - p.offsetHeight < 8) down = true;   // stay inside the window
    Object.assign(p.style, { left: Math.max(8, Math.min(r.left - wr.left - 4, wr.width - p.offsetWidth - 8)) + 'px' }, down ? { top: (r.bottom - wr.top + 8) + 'px' } : { top: 'auto', bottom: (wr.bottom - r.top + 8) + 'px' }); return p; }
  function cToast(msg, o) { lToast($('#w-contacts'), msg, o); }
  const qr = () => { let s = 7, h = ''; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280, finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".8"/>`;
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) { if ((x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)) continue; if (rnd() > .52) h += `<rect x="${x}" y="${y}" width="1" height="1" rx=".3"/>`; }
    return `<svg class="qr" viewBox="-.5 -.5 26 26" fill="currentColor">${h}${finder(.5, .5)}${finder(17.5, .5)}${finder(.5, 17.5)}</svg>`; };
  function ctClick(e, hit) {
    if (!hit('.pop')) cClose();
    const px = hit('[data-cpx]'); if (px) { const v = px.dataset.cpx; CT.px = CT.px === v ? null : v; ctPhBar(); return true; }
    if (hit('[data-cpcode]')) { CT.px = 'code'; ctPhBar(); return true; }
    if (hit('[data-cpblock]')) { const f = cName(CT.cur).split(' ')[0]; CT.px = null; ctPhBar(); cToast(`${f} is blocked`, { icon: 'shield' }); return true; }
    if (hit('[data-cpdel]')) { const k = CT.cur, n = cName(k); delete PPL[k]; CT.px = null; CT.cur = 'me'; ctSide(); ctMain(); $('#w-contacts').classList.add('navopen'); cToast(`${esc(n)} deleted`, { icon: 'trash-2' }); return true; }
    const c = hit('[data-ct]'); if (c) { CT.cur = c.dataset.ct; CT.edit = false; ctSide(); ctMain(); $('#w-contacts').classList.remove('navopen'); return true; }
    if (hit('[data-csearch]')) { CT.searching = true; ctSide(); $('#c-q').focus(); return true; }
    if (hit('[data-csearchx]')) { CT.searching = false; CT.q = ''; ctSide(); return true; }
    if (hit('[data-clists]')) { const n = k => k === 'all' ? Object.keys(PPL).length - 1 : k === 'fav' ? Object.keys(PPL).filter(x => cx(x).fav).length : Object.keys(PPL).filter(x => (cx(x).lists || []).includes(k)).length;
      cPop(hit('[data-clists]'), `${[['all', 'All contacts', 'users'], ['fav', 'Favorites', 'star'], ...Object.entries(LISTS).map(([k, v]) => [k, v, 'list'])].map(([k, v, i]) => `<button class="mi" type="button" data-clist="${k}">${ic(i)}<span>${v}</span><em class="fc">${n(k)}</em>${CT.list === k ? `<span class="end">${ic('check')}</span>` : ''}</button>`).join('')}<hr><button class="mi" type="button" data-ctodo="New list">${ic('plus')}<span>New list</span></button>`, 'nfolderpop'); return true; }
    const l = hit('[data-clist]'); if (l) { CT.list = l.dataset.clist; CT.px = null; cClose(); $('#lmenu')?.remove(); ctSide(); ctPhBar(); return true; }
    if (hit('[data-cadd]')) { const anchor = hit('[data-cadd]'); cPop(anchor, `<h6>Add a person</h6><label class="srch lnk">${ic('user')}<input id="c-addq" placeholder="Username, phone or email" autocomplete="off" spellcheck="false"></label><div id="c-addres"></div><hr>
      <button class="mi" type="button" data-cmycode>${ic('scan')}<span><b>Show my code</b><span class="sub">Someone scans it to add you</span></span></button><button class="mi" type="button" data-ctodo="Scanning with the camera…">${ic('camera')}<span><b>Scan a code</b><span class="sub">Add someone from their code</span></span></button>`, 'caddpop', false);
      const i = $('#c-addq'); i.focus(); i.oninput = () => { const v = i.value.trim(), lv = v.replace(/^@/, '').toLowerCase(), isMail = /\S+@\S+\.\S+/.test(v), isPhone = /^[+\d][\d\s().-]{5,}$/.test(v);
        const hits = !isMail && !isPhone && lv.length > 1 ? Object.keys(PPL).filter(k => PPL[k].u && PPL[k].u.startsWith(lv)).slice(0, 3) : [];
        $('#c-addres').innerHTML = isMail || isPhone ? `<button class="mi cnewrow" type="button" data-cnewc="${isMail ? 'email' : 'phone'}:${esc(v)}">${ic(isMail ? 'mail' : 'phone')}<span><b>New contact</b><span class="sub">${esc(v)}</span></span><span class="end bt sm fill">Add</span></button>`
          : hits.length ? hits.map(k => `<button class="mi" type="button" data-cnew="${k}">${av(k, 30)}<span><b>${esc(PPL[k].n)}</b><span class="sub">@${PPL[k].u} · On Suno</span></span><span class="end bt sm fill">${people().includes(k) ? 'Open' : 'Add'}</span></button>`).join('')
          : lv.length > 1 ? `<p class="cnone">No one on Suno is @${esc(lv)}. Try their phone or email.</p>` : ''; };
      i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#c-addres .mi')?.click(); } }; return true; }
    const nc = hit('[data-cnewc]'); if (nc) { const [kind, v] = nc.dataset.cnewc.split(/:(.*)/s); const key = 'NEW' + Date.now(); PPL[key] = { n: 'New contact', ini: ' ', fresh: true, u: null, h: 200, ...(kind === 'phone' ? { phone: v } : {}) }; Object.assign(cx(key), kind === 'phone' ? { phone: v } : { email: v });
      cClose(); CT.q = ''; CT.cur = key; CT.edit = true; CT.px = null; $('#w-contacts').classList.remove('navopen'); ctSide(); ctMain(); const n = $('#c-body .cname'); if (n) { n.value = ''; n.placeholder = 'Name'; n.focus(); } return true; }
    const nw = hit('[data-cnew]'); if (nw) { const k = nw.dataset.cnew, was = people().includes(k); cClose(); CT.cur = k; CT.px = null; $('#w-contacts').classList.remove('navopen'); ctSide(); ctMain(); if (!was) cToast(`Added ${ppl(k).n}. They’ll see a request in Messages.`); return true; }
    if (hit('[data-cmycode]')) { cPop(hit('[data-cmycode]') || $('[data-cadd]'), `<div class="mycode">${qr()}<b>@nick</b><span>simplyluma.com/@nick</span><div class="pacts"><button class="bt sm fill" type="button" data-ccopy="simplyluma.com/@nick">${ic('link')}Copy link</button></div></div>`, 'codepop'); return true; }
    const cp = hit('[data-ccopy]'); if (cp) { navigator.clipboard?.writeText(cp.dataset.ccopy).catch(() => {}); cToast('Copied', { icon: 'copy' }); return true; }
    const td = hit('[data-ctodo]'); if (td) { cClose(); if (CT.px && hit('#c-phbar')) { CT.px = null; ctPhBar(); } cToast(td.dataset.ctodo); return true; }
    if (hit('[data-cshare]')) { CT.shareMine[CT.cur] = !CT.shareMine[CT.cur]; ctMain(); cToast(CT.shareMine[CT.cur] ? `${ppl(CT.cur).n.split(' ')[0]} can now see your number` : 'Your number is hidden again'); return true; }
    if (hit('[data-cfav]')) { const x = cx(CT.cur); x.fav = !x.fav; ctSide(); const keep = CT.px; ctMain(); if (cNarrow()) { CT.px = keep; ctPhBar(); cToast(x.fav ? `${esc(cName(CT.cur).split(' ')[0])} is a favourite` : 'Removed from favourites', { icon: 'star' }); } return true; }
    if (hit('[data-cshareto]')) { cPop(hit('[data-cshareto]'), `<h6>Share ${esc(ppl(CT.cur).n.split(' ')[0])}’s contact</h6>${['NF', 'SK', 'TH'].filter(k => k !== CT.cur).map(k => `<button class="mi" type="button" data-ctodo="Sent to ${ppl(k).n} in Messages">${av(k, 28)}<span><b>${ppl(k).n}</b><span class="sub">In Messages</span></span></button>`).join('')}<hr><button class="mi" type="button" data-ccopy="simplyluma.com/@${ppl(CT.cur).u || ''}">${ic('link')}<span>Copy their link</span></button>`, 'nmorepop'); return true; }
    if (hit('[data-cmore]')) { cPop(hit('[data-cmore]'), `<button class="mi danger" type="button" data-cblock>${ic('shield')}<span>Block</span></button><button class="mi danger" type="button" data-cdel>${ic('trash-2')}<span>Delete contact</span></button>`, 'nmorepop'); return true; }
    if (hit('[data-cblock]')) { cClose(); const n = ppl(CT.cur).n, f = n.split(' ')[0]; lConfirm($('#w-contacts'), { title: `Block ${n}?`, body: `${f} can’t message or call you, and isn’t told. You can unblock them here.`, action: 'Block', icon: 'shield', onOK: () => cToast(`${f} is blocked`, { icon: 'shield' }) }); return true; }
    if (hit('[data-cdel]')) { cClose(); const n = ppl(CT.cur).n; lConfirm($('#w-contacts'), { title: `Delete ${n}?`, body: 'Their card is removed from your contacts. Your conversations with them stay in Messages.', action: 'Delete', onOK: () => cToast('Contact deleted', { icon: 'trash-2' }) }); return true; }
    if (hit('[data-cedit]')) { cClose(); CT.edit = true; ctMain(); if (cNarrow()) $('#w-contacts').classList.remove('navopen'); $('#c-body input')?.focus(); return true; }
    if (hit('[data-ccancel]')) { CT.edit = false; ctMain(); return true; }
    if (hit('[data-csave]')) { const x = cx(CT.cur); $$('#c-body [data-cf]').forEach(i => { if (i.dataset.cf === 'name') { const p = ppl(CT.cur); if (i.value.trim()) { p.n = i.value.trim(); delete p.ini; delete p.fresh; } } else x[i.dataset.cf] = i.value.trim(); }); CT.edit = false; ctSide(); ctMain(); cToast('Saved'); return true; }
    return false; }
  (() => { const w = $('#w-contacts'); if (!w) return;
    w.addEventListener('input', e => { const n = e.target.closest('[data-cnote]'); if (n) cx(n.dataset.cnote).note = n.innerText; });
    document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'contacts') return; const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'f') { e.preventDefault(); CT.searching = true; ctSide(); $('#c-q').focus(); } else if (k === 'escape') { cClose(); if (CT.edit) { CT.edit = false; ctMain(); } } }); })();

  /* ── Contacts on a phone: the action bar (the list's search, lists and add; a person's edit, share, favourite and
     the rest). Panels grow out of it; nothing opens as a popover or a dialog. ── */
  const cNarrow = () => { const b = $('#w-contacts .ibody'); return !!b?.clientWidth && b.clientWidth < 560; };
  const CLISTS = () => [['all', 'All contacts', 'users'], ['fav', 'Favorites', 'star'], ...Object.entries(LISTS).map(([k, v]) => [k, v, 'list'])];
  const cCount = k => k === 'all' ? Object.keys(PPL).length - 1 : k === 'fav' ? Object.keys(PPL).filter(x => cx(x).fav).length : Object.keys(PPL).filter(x => (cx(x).lists || []).includes(k)).length;
  function ctPhBar() { const w = $('#w-contacts'); let bar = $('#c-phbar');
    if (!cNarrow() || !w.classList.contains('phone')) { bar?.remove(); w.classList.remove('cphone'); return; }
    w.classList.add('cphone'); if (!bar) { w.insertAdjacentHTML('beforeend', '<div class="fbar cphbar phnofit" id="c-phbar"></div>'); bar = $('#c-phbar'); }
    const listing = w.classList.contains('navopen'), P = CT.px, k = CT.cur, me = k === 'me', f = me ? 'you' : cName(k).split(' ')[0];
    let panel = '', row = '';
    if (listing) {
      if (P === 'lists') panel = `<div class="fexp"><div class="fexh">Show</div>${CLISTS().map(([id, n, i]) => `<button class="fexr2${CT.list === id ? ' on' : ''}" type="button" data-clist="${id}">${ic(i)}<span>${n}</span><em class="fcnt">${cCount(id)}</em>${CT.list === id ? ic('check') : ''}</button>`).join('')}</div>`;
      if (P === 'add') panel = `<div class="fexp caddp"><div class="fexh">Add a person</div><div id="c-paddres"></div>
        <div class="fsha c2">${[['scan', 'Show my code', 'data-cpcode'], ['camera', 'Scan a code', 'data-ctodo="Scanning with the camera…"']].map(([i, n, a]) => `<button type="button" class="fvt" ${a}>${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`;
      if (P === 'code') panel = `<div class="fexp ccodep">${qr()}<b>@nick</b><span>simplyluma.com/@nick</span><button class="bt fill" type="button" data-ccopy="simplyluma.com/@nick">${ic('link')}Copy link</button></div>`;
      const lname = CLISTS().find(x => x[0] === CT.list)[1];
      row = P === 'add' ? `<label class="srch keep">${ic('user-plus')}<input id="c-paddq" placeholder="Username, phone or email" autocomplete="off" spellcheck="false" aria-label="Add a person"></label><button class="ib" type="button" data-cpx="add" aria-label="Close" title="Close">${ic('x')}</button>` : `<label class="srch keep">${ic('search')}<input id="c-pq" placeholder="Search" value="${esc(CT.q)}" aria-label="Search people"></label><button class="ib${P === 'lists' || CT.list !== 'all' ? ' on' : ''}" type="button" data-cpx="lists" aria-label="Lists: ${lname}" title="${lname}">${ic('list-filter')}</button><button class="ib${P === 'add' || P === 'code' ? ' on' : ''}" type="button" data-cpx="add" aria-label="Add a person" title="Add a person">${ic('user-plus')}</button>`;
    } else if (CT.edit) {
      row = `<button class="bt ccancel" type="button" data-ccancel>Cancel</button><button class="bt pri cdone" type="button" data-csave>Done</button>`;
    } else {
      if (P === 'share') panel = me ? `<div class="fexp ccodep">${qr()}<b>@nick</b><span>simplyluma.com/@nick</span></div><div class="fexp fshare2 ccodeq"><div class="fsha">${[['message-square', 'Messages'], ['mail', 'Email'], ['link', 'Copy link'], ['radio-tower', 'Nearby']].map(([i, n]) => `<button type="button" class="fvt" ${n === 'Copy link' ? 'data-ccopy="simplyluma.com/@nick"' : `data-ctodo="Sharing your card with ${n}"`}>${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`
        : `<div class="fexp fshare2"><div class="fexh">Send ${esc(f)}’s card to</div><div class="fshp">${['NF', 'SK', 'TH', 'MO', 'AR'].filter(x => x !== k).slice(0, 5).map(x => `<button type="button" data-ctodo="Sent ${esc(f)}’s card to ${esc(ppl(x).n.split(' ')[0])}">${av(x, 48)}<span>${esc(ppl(x).n.split(' ')[0])}</span></button>`).join('')}</div>
          <div class="fsha">${[['message-square', 'Messages'], ['mail', 'Email'], ['link', 'Copy link'], ['radio-tower', 'Nearby']].map(([i, n]) => `<button type="button" class="fvt" data-ctodo="${n === 'Copy link' ? 'Link copied' : `Sharing ${esc(f)}’s card with ${n}`}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`;
      if (P === 'more') panel = `<div class="fexp fmore2"><button class="fexr2" type="button" data-ctodo="Added ${esc(f)} to a list">${ic('list-plus')}<span>Add to list</span></button><button class="fexr2" type="button" data-ctodo="Merged with duplicate">${ic('merge')}<span>Link a duplicate</span></button><button class="fexr2 red" type="button" data-cpx="block">${ic('shield')}<span>Block ${esc(f)}</span></button><button class="fexr2 red" type="button" data-cpx="del">${ic('trash-2')}<span>Delete contact</span></button></div>`;
      if (P === 'block') panel = `<div class="fexp cconf"><b>Block ${esc(cName(k))}?</b><p>${esc(f)} can’t message or call you, and isn’t told. You can unblock them here.</p><div class="cconfb"><button class="bt fill" type="button" data-cpx="more">Cancel</button><button class="bt danger" type="button" data-cpblock>${ic('shield')}Block</button></div></div>`;
      if (P === 'del') panel = `<div class="fexp cconf"><b>Delete ${esc(cName(k))}?</b><p>Their card is removed. Your conversations with them stay in Messages.</p><div class="cconfb"><button class="bt fill" type="button" data-cpx="more">Cancel</button><button class="bt danger" type="button" data-cpdel>${ic('trash-2')}Delete</button></div></div>`;
      row = me ? `<button class="bt pri cedit" type="button" data-cedit>${ic('pencil')}<span>Edit</span></button><button class="ib${P === 'share' ? ' on' : ''}" type="button" data-cpx="share" aria-label="Share my card" title="Share my card">${ic('share-2')}</button>`
        : `<button class="bt pri cedit" type="button" data-cedit>${ic('pencil')}<span>Edit</span></button><button class="ib${P === 'share' ? ' on' : ''}" type="button" data-cpx="share" aria-label="Share contact" title="Share contact">${ic('share-2')}</button><button class="ib cfavb${cx(k).fav ? ' on' : ''}" type="button" data-cfav aria-label="${cx(k).fav ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${!!cx(k).fav}">${ic('star')}</button><button class="ib${['more', 'block', 'del'].includes(P) ? ' on' : ''}" type="button" data-cpx="more" aria-label="More" title="More">${ic('ellipsis')}</button>`;
    }
    bar.classList.toggle('phgrow', !!panel); bar.classList.toggle('cbarlist', listing);
    bar.innerHTML = panel + row;
    const q = $('#c-pq'); if (q) q.oninput = () => { CT.q = q.value; ctSide(); ctPhBar(); const n = $('#c-pq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    const a = $('#c-paddq'); if (a) { setTimeout(() => a.focus(), 40); a.oninput = () => { const v = a.value.trim(), lv = v.replace(/^@/, '').toLowerCase(), isMail = /\S+@\S+\.\S+/.test(v), isPhone = /^[+\d][\d\s().-]{5,}$/.test(v);
      const hits = !isMail && !isPhone && lv.length > 1 ? Object.keys(PPL).filter(x => PPL[x].u && PPL[x].u.startsWith(lv)).slice(0, 3) : [];
      $('#c-paddres').innerHTML = isMail || isPhone ? `<button class="bt pri cnewb" type="button" data-cnewc="${isMail ? 'email' : 'phone'}:${esc(v)}">${ic('user-plus')}<span>Add ${esc(v)} as a new contact</span></button>`
        : hits.length ? hits.map(x => `<button class="fexr2" type="button" data-cnew="${x}">${av(x, 28)}<span>${esc(PPL[x].n)} <small>@${PPL[x].u}</small></span>${people().includes(x) ? ic('chevron-right') : ic('plus')}</button>`).join('')
        : lv.length > 1 ? `<p class="cnone">No one on Suno is @${esc(lv)}. Try their phone or email.</p>` : ''; }; } }
  function renderContacts() { $('#c-top').innerHTML = `<img src="${A}contacts.svg" alt=""><b>Contacts</b><span class="chev">${ic('chevron-down')}</span>`; ctSide(); ctMain();
    const w = $('#w-contacts'); new MutationObserver(() => { const l = w.classList.contains('navopen'); if (l !== CT.wasList) { CT.wasList = l; CT.px = null; ctPhBar(); } }).observe(w, { attributes: true, attributeFilter: ['class'] }); }

  /* ══ Terminal ══════════════════════════════════════════════════════════════
     The prompt is the floating bar: session on the left, the command field in the middle (your path and
     branch as its prefix, ghost suggestions from history), splits on the right. Output arrives in blocks:
     the command, a status dot and how long it took. Click a block and the bar acts on it instead. */
  const TFS = { '/home/nick': ['Documents/', 'Downloads/', 'Music/', 'Pictures/', 'Projects/', '.bashrc'], '/home/nick/Projects': ['suno/', 'website/'],
    '/home/nick/Projects/suno': ['Makefile', 'README.md', 'package.json', 'src/', 'build.sh*'], '/home/nick/Projects/suno/src': ['main.rs', 'shell.rs', 'window.rs'],
    '/home/nick/Projects/website': ['index.html', 'blog/', 'assets/'], '/home/nick/Documents': ['launch-plan.md', 'why-letter.pdf'], '/home/nick/Downloads': ['suno-1.0-x86_64.iso', 'press-kit.zip'],
    '/home/nick/Music': [], '/home/nick/Pictures': ['terrace.webp', 'studio.webp'] };
  const TFILE = { 'README.md': '# Suno\nA better computer. Free, open source, yours.\n\nBuild with `make`, run with `./build.sh --dev`.', 'package.json': '{\n  "name": "suno-shell",\n  "version": "1.0.0",\n  "private": true\n}',
    '.bashrc': 'export EDITOR=editor\nalias ll="ls -la"\neval "$(suno prompt)"', 'launch-plan.md': '# Launch plan\nOctober 14. Film at 9, download at 10.' };
  const TCMDS = ['cat', 'cd', 'clear', 'date', 'echo', 'exit', 'git status', 'git log', 'help', 'history', 'ls', 'll', 'lumafetch', 'suno update', 'pwd', 'uname -a', 'uptime', 'whoami'];
  let PID = 1, BID = 1; const mkPane = cwd => ({ id: PID++, cwd: cwd || '/home/nick', blocks: [], hist: [], busy: null });
  const TT = { tabs: [], cur: 0, active: null, fs: 13.5, hist: ['cd Projects/suno', 'git status', 'git log', 'lumafetch', 'suno update'], hi: -1, sel: null };
  const tab = () => TT.tabs[TT.cur];
  const panesOf = n => n.t === 'p' ? [n.p] : [...panesOf(n.a), ...panesOf(n.b)];
  const paneById = id => panesOf(tab().root).find(p => p.id === id);
  const act = () => paneById(TT.active);
  const short = d => d.replace('/home/nick', '~');
  const BRANCH = SVG['git-branch'];
  const SPLITR = SVG['columns-2'], SPLITD = SVG['rows-2'];
  const SPARK = SVG['sparkle'], REDO = SVG['rotate-cw'];
  const sessName = t => { if (t.name) return t.name; const p = panesOf(t.root)[0]; return p.cwd === '/home/nick' ? 'Home' : p.cwd.split('/').pop(); };
  const sessIcon = t => { const ps = panesOf(t.root); return ps.some(p => p.busy) ? '<i class="tspin round"></i>' : ic(ps[0].cwd === '/home/nick' ? 'house' : 'folder'); };
  const branchOf = cwd => cwd.includes('Projects/suno') ? 'main' : null;
  function newTab(cwd) { const p = mkPane(cwd); TT.tabs.push({ root: { t: 'p', p } }); TT.cur = TT.tabs.length - 1; TT.active = p.id; return p; }
  /* Blocks */
  const blockHTML = (p, b) => `<div class="tb ${b.status}${TT.sel === b.id ? ' sel' : ''}" data-tblock="${b.id}">${b.cmd != null ? `<div class="tbh"><span class="tbp">${esc(short(b.cwd))}${branchOf(b.cwd) ? `<i class="tbr">${BRANCH}${branchOf(b.cwd)}</i>` : ''}</span><span class="tbc">${esc(b.cmd)}</span><span class="tbm">${b.status === 'run' ? '<i class="tspin round"></i>running' : `<i class="dot round"></i>${b.dur}`}</span></div>` : ''}${b.out.length ? `<div class="tbo">${b.out.join('\n')}</div>` : ''}</div>`;
  function paneRender(p) { const el = $(`#tm-panes [data-tmpane="${p.id}"] .tblocks`); if (!el) return; el.innerHTML = p.blocks.map(b => blockHTML(p, b)).join('') || `<div class="tempty">Type a command below. <b>help</b> shows a few to try.</div>`; const s = el.parentElement; s.scrollTop = s.scrollHeight; }
  function renderNode(n) { if (n.t === 'p') return `<section class="tpane isle${n.p.id === TT.active ? ' act' : ''}" data-tmpane="${n.p.id}"><button class="tpx" type="button" data-tmx="${n.p.id}" aria-label="Close pane" title="Close pane · Ctrl Shift W"><svg viewBox="0 0 43 43" aria-hidden="true"><path class="f" d="M42 0 A10 10 0 0 0 32 10 L32 20 A12 12 0 0 1 20 32 L10 32 A10 10 0 0 0 0 42 L0 42 L0 0 L42 0 Z"/><path class="h" d="M42 -0.5 A10.5 10.5 0 0 0 31.5 10 L31.5 20 A11.5 11.5 0 0 1 20 31.5 L10 31.5 A10.5 10.5 0 0 0 -0.5 42"/><path class="e" d="M42 0.5 A9.5 9.5 0 0 0 32.5 10 L32.5 20 A12.5 12.5 0 0 1 20 32.5 L10 32.5 A9.5 9.5 0 0 0 0.5 42"/></svg>${ic('x')}</button><div class="tscroll"><div class="tblocks"></div></div></section>`; return `<div class="tsplitbox ${n.dir}">${renderNode(n.a)}${renderNode(n.b)}</div>`; }
  function tmRender() { const box = $('#tm-panes'); box.style.setProperty('--tfs', TT.fs + 'px'); box.innerHTML = renderNode(tab().root); panesOf(tab().root).forEach(paneRender); tmBar(); }
  /* The bar: the prompt, or (with a block selected) what you can do with that block. */
  /* Terminal on a phone: a phone has no Esc, Tab, Ctrl or arrows, so the bar's top row is those keys (plus the symbols a
     shell needs that phone keyboards bury), then a hairline, then the command line: the session (tap to switch, rename,
     start one; it grows the bar), the field with its prompt, and Run. A selected block turns the bar into its actions. */
  const tmNarrow = () => { const w = $('#w-term'); return !!w?.clientWidth && w.clientWidth < 560; };
  function tmBarPhone(bar, p) { const X = TT.px || '', ib = (attr, icn, label) => `<button class="ib" type="button" ${attr} aria-label="${label}" title="${label}">${icn}</button>`;
    bar.classList.add('phnofit', 'tmphbar');
    if (TT.sel != null) { bar.classList.remove('phgrow'); const b = p.blocks.find(x => x.id === TT.sel);
      setBar(bar, `<div class="tmselh">${ic('terminal')}<span>${esc(b.cmd || 'Welcome')}</span></div><div class="tmrow">${ib('data-tmb="out"', ic('copy'), 'Copy output')}${ib('data-tmb="cmd"', ic('clipboard'), 'Copy command')}${ib('data-tmb="rerun"', REDO, 'Run again')}${ib('data-tmb="note"', ic('file-text'), 'Send to Notes')}${ib('data-tmb="ari"', SPARK, 'Ask Ari')}${ib('data-tmb="done"', ic('x'), 'Done')}</div>`); return; }
    const t = tab(), br = branchOf(p.cwd);
    const panel = X === 'sess' ? `<div class="fexp tmsessp">${TT.tabs.map((x, i) => { const ps = panesOf(x.root), busy = ps.find(q => q.busy); return `<div class="tmsrow${i === TT.cur ? ' on' : ''}"><button type="button" class="tmsgo" data-tmtab="${i}">${sessIcon(x)}<span>${esc(sessName(x))}<small>${esc(short(ps[0].cwd))}${busy ? ` · running ${esc(busy.busy)}` : ''}</small></span></button><button class="ib" type="button" data-tmren2="${i}" aria-label="Rename" title="Rename">${ic('pencil')}</button>${TT.tabs.length > 1 ? `<button class="ib" type="button" data-tmclose="${i}" aria-label="Close session" title="Close">${ic('x')}</button>` : ''}</div>`; }).join('')}<button class="bt pri tmnewb" type="button" data-tmnew>${ic('plus')}New session</button></div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    const keys = [['Escape', 'esc'], ['Tab', 'tab'], ['^C', '⌃C'], ['ArrowUp', ic('arrow-up')], ['ArrowDown', ic('arrow-down')], ['|', '|'], ['~', '~'], ['/', '/'], ['-', '-'], ['*', '*'], ['>', '>'], ['&', '&']];
    setBar(bar, `${panel}<div class="tmkeys" role="group" aria-label="Keys">${keys.map(([k, l]) => `<button type="button" data-tmkey="${esc(k)}" aria-label="${esc(k)}">${l}</button>`).join('')}</div>
      <div class="tmrow"><button class="tmsess2${X === 'sess' ? ' on' : ''}" type="button" data-tmpx="sess" aria-label="Sessions: ${esc(sessName(t))}" aria-expanded="${X === 'sess'}">${sessIcon(t)}${TT.tabs.length > 1 ? `<em>${TT.tabs.length}</em>` : ''}</button>
        <label class="tfield"><span class="tpre">${esc(short(p.cwd))}${br ? `<i class="tbr">${BRANCH}${br}</i>` : ''}<b>$</b></span><span class="tinw"><input id="tm-in" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Command" placeholder="${p.busy ? `Running ${esc(p.busy)}…` : ''}"><span class="tghost" aria-hidden="true"><span class="tg1"></span><span class="tg2"></span></span></span></label>
        <button class="bt pri tmrun" type="button" data-tmrun aria-label="Run" title="Run">${ic('corner-down-left')}</button></div>`);
    const i = $('#tm-in'); i.oninput = ghost; }
  function tmBar() { const bar = $('#tm-bar'), p = act();
    if (tmNarrow()) return tmBarPhone(bar, p); bar.classList.remove('phnofit', 'tmphbar', 'phgrow');
    if (TT.sel != null) { const b = p.blocks.find(x => x.id === TT.sel);
      setBar(bar, `<span class="ctxc">${ic('terminal')}<span>${esc(b.cmd || 'Welcome')}</span></span><button class="bt fill" type="button" data-tmb="out">${ic('copy')}Copy output</button><button class="bt fill" type="button" data-tmb="cmd">Copy command</button><button class="ib" type="button" data-tmb="rerun" aria-label="Run again" title="Run again">${REDO}</button>
        <button class="ib" type="button" data-tmb="note" aria-label="Send to Notes" title="Send to Notes">${ic('file-text')}</button><button class="bt fill ari" type="button" data-tmb="ari">${SPARK}Ask Ari</button><span class="sp"></span><button class="bt key" type="button" data-tmb="done">Done</button>`); return; }
    const t = tab(), n = TT.tabs.length, br = branchOf(p.cwd);
    $('#tm-top .tmtabsw')?.remove();
    /* The sessions button lists sessions only; New session and the splits are actions, so they sit in the bar (#29) */
    setBar(bar, `<button class="ctxc tmsess" type="button" data-tmsess title="Sessions" aria-haspopup="menu">${sessIcon(t)}<span>${esc(sessName(t))}</span>${n > 1 ? `<em>${TT.cur + 1}/${n}</em>` : ''}${ic('chevron-down')}</button><label class="tfield"><span class="tpre">${esc(short(p.cwd))}${br ? `<i class="tbr">${BRANCH}${br}</i>` : ''}<b>$</b></span><span class="tinw"><input id="tm-in" spellcheck="false" autocomplete="off" aria-label="Command" placeholder="${p.busy ? `Running ${esc(p.busy)}…  Ctrl C to stop` : ''}"><span class="tghost" aria-hidden="true"><span class="tg1"></span><span class="tg2"></span></span></span>${'<kbd class="tkey">⏎</kbd>'}</label><span class="tmacts"><button class="ib" type="button" data-tmnew aria-label="New session" title="New session · Ctrl Shift T" aria-keyshortcuts="Control+Shift+T">${ic('plus')}</button><button class="ib" type="button" data-tmsplit="row" aria-label="Split right" title="Split right · Ctrl Shift D" aria-keyshortcuts="Control+Shift+D">${SPLITR}</button><button class="ib" type="button" data-tmsplit="col" aria-label="Split down" title="Split down · Ctrl Shift E" aria-keyshortcuts="Control+Shift+E">${SPLITD}</button></span>`);
    const i = $('#tm-in'); i.oninput = ghost; setTimeout(() => { if (front()?.dataset.app === 'term') i.focus({ preventScroll: true }); }, 0); }
  /* Sessions are tabs, in the title bar beside the app's name, with the split controls after them */
  function tmTabs() { const top = $('#tm-top'); if (!top) return; top.querySelector('.tmtabsw')?.remove();
    top.insertAdjacentHTML('beforeend', `<div class="tmtabsw"><div class="tmtabs" role="tablist">${TT.tabs.map((t, i) => `<button type="button" role="tab" aria-selected="${i === TT.cur}" class="${i === TT.cur ? 'on' : ''}" data-tmtab="${i}" title="${esc(short(panesOf(t.root)[0].cwd))} · Ctrl ${i + 1}">${sessIcon(t)}<span>${esc(sessName(t))}</span>${TT.tabs.length > 1 ? `<i class="tx" data-tmclose="${i}" role="button" aria-label="Close session">${ic('x')}</i>` : ''}</button>`).join('')}</div>
      <button class="ib" type="button" data-tmnew aria-label="New session" title="New session · Ctrl Shift T">${ic('plus')}</button><span class="vr"></span><button class="ib" type="button" data-tmsplit="row" aria-label="Split right" title="Split right · Ctrl Shift D">${SPLITR}</button><button class="ib" type="button" data-tmsplit="col" aria-label="Split down" title="Split down · Ctrl Shift E">${SPLITD}</button></div>`); }
  function ghost() { const i = $('#tm-in'); if (!i) return; const v = i.value; let g = '';
    if (v) { const h = [...TT.hist].reverse().find(x => x.startsWith(v) && x !== v) || TCMDS.find(x => x.startsWith(v) && x !== v) || ''; g = h.slice(v.length); }
    $('#tm-bar .tg1').textContent = v; $('#tm-bar .tg2').textContent = g; TT.ghost = g; }
  const resolve = (cwd, a) => { if (!a || a === '~') return '/home/nick'; let path = a.startsWith('/') ? a : a.startsWith('~') ? '/home/nick' + a.slice(1) : cwd + '/' + a; const parts = []; path.split('/').forEach(x => { if (!x || x === '.') return; if (x === '..') parts.pop(); else parts.push(x); }); return '/' + parts.join('/'); };
  const fmtName = x => x.endsWith('/') ? `<span class="tm-dir">${x.slice(0, -1)}</span>` : x.endsWith('*') ? `<span class="tm-exe">${x.slice(0, -1)}</span>` : x.startsWith('.') ? `<span class="tm-mut">${x}</span>` : x;
  const lsFmt = (items, long) => long ? items.map(x => `<span class="tm-mut">${x.endsWith('/') ? 'drwxr-xr-x' : '-rw-r--r--'}  nick  ${x.endsWith('/') ? ' 4.0K' : ' 1.2K'}  Sep 23 15:04</span>  ${fmtName(x)}`).join('\n') : items.map(fmtName).join('   ');
  const LUMAFETCH = () => `<span class="lf"><span class="lfa" aria-hidden="true">   ▄▄▄███▄▄▄\n ▄███████████▄\n▐█████████████▌\n▐█████████████▌\n ▀███████████▀\n   ▀▀▀███▀▀▀</span><span><span class="tm-u">nick</span><span class="tm-mut">@</span><span class="tm-u">thinkpad</span>\n<span class="tm-mut">──────────────</span>\n<span class="tm-b">OS</span>       SunoOS 0.1 x86_64\n<span class="tm-b">Host</span>     ThinkPad X1 Carbon Gen 12\n<span class="tm-b">Kernel</span>   6.11.4-suno\n<span class="tm-b">Uptime</span>   3 days, 4 hours\n<span class="tm-b">Shell</span>    bash 5.2\n<span class="tm-b">CPU</span>      Intel Core Ultra 7 165U (14)\n<span class="tm-b">Memory</span>   6.1 GiB / 32 GiB\n<span class="lfsw">${[25, 60, 95, 150, 200, 250, 300, 340].map(h => `<i style="background:oklch(0.7 0.14 ${h})"></i>`).join('')}</span></span></span>`;
  function run(p, line) { const raw = line.trim(); if (!raw) return; TT.hist.push(raw); TT.hi = -1;
    const b = { id: BID++, cmd: raw, cwd: p.cwd, out: [], status: 'run', dur: '' }, t0 = performance.now(); p.blocks.push(b);
    const [c, ...args] = raw.split(/\s+/), a = args.join(' '), say = s => b.out.push(s), err = s => { b.out.push(`<span class="tm-err">${s}</span>`); b.status = 'err'; };
    const done = () => { if (b.status === 'run') b.status = 'ok'; const ms = performance.now() - t0 + 4 + Math.random() * 30; b.dur = ms > 1000 ? (ms / 1000).toFixed(1) + 's' : Math.round(ms) + 'ms'; paneRender(p); tmBar(); };
    switch (c) {
      case 'clear': p.blocks = []; paneRender(p); return;
      case 'pwd': say(esc(p.cwd)); break; case 'whoami': say('nick'); break; case 'date': say(new Date().toString().replace(/ GMT.*/, '')); break;
      case 'uname': say(a.includes('-a') ? 'Linux thinkpad 6.11.4-suno #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux' : 'Linux'); break;
      case 'uptime': say(' 15:04:12 up 3 days,  4:21,  1 user,  load average: 0.42, 0.38, 0.35'); break;
      case 'echo': say(esc(a.replace(/^["']|["']$/g, '').replace('$USER', 'nick').replace('$HOME', '/home/nick'))); break;
      case 'history': say(TT.hist.map((h, i) => `<span class="tm-mut">${String(i + 1).padStart(4)}</span>  ${esc(h)}`).join('\n')); break;
      case 'help': say(`Try  <span class="tm-b">cd Projects/suno</span>  ·  <span class="tm-b">git status</span>  ·  <span class="tm-b">cat README.md</span>  ·  <span class="tm-b">suno update</span>  ·  <span class="tm-b">lumafetch</span>\n<span class="tm-mut">Tab or → accepts a suggestion · click any block to copy, rerun or ask Ari about it · Ctrl Shift D / E split · Ctrl Shift T new session</span>`); break;
      case 'cd': { const d = resolve(p.cwd, a); if (TFS[d]) p.cwd = d; else err(`cd: ${esc(a)}: No such file or directory`); break; }
      case 'ls': case 'll': { const long = c === 'll' || /-\w*l/.test(a), path = a.replace(/-\w+/g, '').trim(), d = resolve(p.cwd, path || '.'), items = TFS[d]; if (!items) { err(`ls: cannot access '${esc(path)}': No such file or directory`); break; }
        const show = /-\w*a/.test(a) || c === 'll' ? items : items.filter(x => !x.startsWith('.')); if (show.length) say(lsFmt(show, long)); break; }
      case 'cat': { const f = a.split('/').pop(); if (TFILE[f]) say(esc(TFILE[f])); else err(`cat: ${esc(a || '')}: No such file or directory`); break; }
      case 'git': if (!p.cwd.includes('Projects/suno')) { err('fatal: not a git repository (or any of the parent directories): .git'); break; }
        if (args[0] === 'log') say(`<span class="tm-y">a41f2c9</span> Tray: carry files between folders\n<span class="tm-y">7c03e1b</span> Tide: the deck grows from the frame\n<span class="tm-y">19be8d0</span> Kit: recessed, raised, floating`);
        else say(`On branch <span class="tm-g">main</span>\nChanges not staged for commit:\n  <span class="tm-err">modified:   src/window.rs</span>\n  <span class="tm-err">modified:   README.md</span>`); break;
      case 'lumafetch': say(LUMAFETCH()); break;
      case 'suno': if (args[0] !== 'update') { say('usage: suno update'); break; }
        p.busy = raw; paneRender(p); tmBar(); say('Checking the nightly channel…'); let k = 0; const steps = [['tide', '2.4.1'], ['write', '1.9.0'], ['filer', '3.2.0'], ['kernel', '6.11.5']];
        const tick = setInterval(() => { if (k < steps.length) { const [n, v] = steps[k++]; say(`  <span class="tm-g">↓</span> ${n.padEnd(8)} ${v}  <span class="tm-bar"><i></i></span>`); paneRender(p); } else { clearInterval(tick); say(`<span class="tm-g">✓</span> 4 updates installed. Restart when you like; nothing is waiting on you.`); p.busy = null; done(); } }, 500); return;
      case 'exit': p.blocks.pop(); closePane(p.id); return;
      default: err(`${esc(c)}: command not found`); }
    done(); }
  function split(dir) { const t = tab(), cur = act(), np = mkPane(cur.cwd);
    const rep = n => n.t === 'p' ? (n.p.id === cur.id ? { t: 's', dir, a: n, b: { t: 'p', p: np } } : n) : { ...n, a: rep(n.a), b: rep(n.b) }; t.root = rep(t.root); TT.active = np.id; TT.sel = null; tmRender(); }
  function closePane(id) { const t = tab(); if (t.root.t === 'p') { closeTab(TT.cur); return; }
    const rm = n => n.t === 'p' ? n : (n.a.t === 'p' && n.a.p.id === id) ? n.b : (n.b.t === 'p' && n.b.p.id === id) ? n.a : { ...n, a: rm(n.a), b: rm(n.b) }; t.root = rm(t.root); TT.active = panesOf(t.root)[0].id; tmRender(); }
  function closeTab(i) { if (TT.tabs.length === 1) { TT.tabs = []; newTab(); tmRender(); return; } TT.tabs.splice(i, 1); TT.cur = Math.min(TT.cur, TT.tabs.length - 1); TT.active = panesOf(tab().root)[0].id; tmRender(); }
  const tmClose = () => $$('#w-term .pop').forEach(x => x.remove());
  const tmToast = msg => lToast($('#w-term'), msg, { icon: /copied/.test(msg) ? 'copy' : /^Ari/.test(msg) ? 'sparkle' : 'check' });   // the SunoUI toast
  /* Your sessions, and only them: the current one marked, each with its folder and what's running; Rename and Close on hover (or focus);
     arrows move through them. With one session it says so. On a phone it's a drawer. */
  function tmSessHTML() { return `<h6>Sessions</h6>${TT.tabs.map((t, i) => { const ps = panesOf(t.root), busy = ps.find(p => p.busy);
      return `<button class="mi${i === TT.cur ? ' on' : ''}" type="button" data-tmtab="${i}"${i === TT.cur ? ' aria-current="true"' : ''}>${sessIcon(t)}<span><b>${esc(sessName(t))}</b><span class="sub">${esc(short(ps[0].cwd))}${busy ? ` · running ${esc(busy.busy)}` : ''}${ps.length > 1 ? ` · ${ps.length} panes` : ''}</span></span><kbd>Ctrl ${i + 1}</kbd><i class="tx" data-tmren="${i}" role="button" tabindex="-1" aria-label="Rename session" title="Rename">${ic('pencil')}</i>${TT.tabs.length > 1 ? `<i class="tx" data-tmclose="${i}" role="button" tabindex="-1" aria-label="Close session" title="Close">${ic('x')}</i>` : ''}</button>`; }).join('')}<hr>${lAddRow('New session', 'data-tmnew', 'plus', 'Ctrl Shift T')}`; }
  function tmClick(e, hit) {
    if (!hit('.pop')) tmClose();
    const x = hit('[data-tmx]'); if (x) { closePane(+x.dataset.tmx); return true; }
    if (tmNarrow()) { const px = hit('[data-tmpx]'); if (px) { TT.px = TT.px === 'sess' ? '' : 'sess'; tmBar(); return true; }
      const ky = hit('[data-tmkey]'); if (ky) { const i = $('#tm-in'), k = ky.dataset.tmkey; if (!i) return true;
        if (['|', '~', '/', '-', '*', '>', '&'].includes(k)) { const a = i.selectionStart ?? i.value.length; i.value = i.value.slice(0, a) + k + i.value.slice(i.selectionEnd ?? a); i.setSelectionRange(a + 1, a + 1); ghost(); }
        else if (k === 'Escape') { i.value = ''; ghost(); }
        else i.dispatchEvent(new KeyboardEvent('keydown', k === '^C' ? { key: 'c', ctrlKey: true, bubbles: true } : { key: k, bubbles: true }));
        i.focus({ preventScroll: true }); return true; }
      if (hit('[data-tmrun]')) { const i = $('#tm-in'); i?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; }
      const rn2 = hit('[data-tmren2]'); if (rn2) { const i2 = +rn2.dataset.tmren2, t2 = TT.tabs[i2], nm = prompt('Session name', sessName(t2)); if (nm != null) { t2.name = nm.trim() || null; } tmBar(); return true; }
      if (hit('[data-tmtab]') || hit('[data-tmnew]') || hit('[data-tmclose]')) TT.px = ''; }
    if (hit('[data-tmsess]') && $('#w-term .tsesspop')) { tmClose(); return true; }
    if (hit('[data-tmsess]')) { const r = hit('[data-tmsess]').getBoundingClientRect(), w = $('#w-term'), wr = w.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop tsesspop';
      if ($('#w-term .tsesspop')) { tmClose(); return true; } p.setAttribute('role', 'menu'); p.innerHTML = tmSessHTML();
      w.appendChild(p); Object.assign(p.style, { left: (r.left - wr.left - 4) + 'px', bottom: (wr.bottom - r.top + 10) + 'px' }); p.querySelector('.mi.on')?.focus(); return true; }
    /* Rename is the row itself becoming a field: Enter or leaving it keeps the name, Esc puts the row back (empty = the folder's name again) */
    const rn = hit('[data-tmren]'); if (rn) { e.stopPropagation(); const i = +rn.dataset.tmren, t = TT.tabs[i], row = rn.closest('.mi'), was = t.name; t.name = null; const def = sessName(t); t.name = was;
      row.outerHTML = `<div class="mi on tmrenrow">${sessIcon(t)}<input class="tmrenin" data-tmrenin="${i}" value="${esc(was || def)}" placeholder="${esc(def)}" aria-label="Session name" spellcheck="false"></div>`;
      const inp = $('#w-term [data-tmrenin]'); inp.focus(); inp.select(); return true; }
    const tc = hit('[data-tmclose]'); if (tc) { e.stopPropagation(); tmClose(); closeTab(+tc.dataset.tmclose); return true; }
    const t = hit('[data-tmtab]'); if (t) { tmClose(); TT.cur = +t.dataset.tmtab; TT.active = panesOf(tab().root)[0].id; TT.sel = null; tmRender(); return true; }
    if (hit('[data-tmnew]')) { tmClose(); newTab(act()?.cwd); TT.sel = null; tmRender(); return true; }
    const sp = hit('[data-tmsplit]'); if (sp) { tmClose(); split(sp.dataset.tmsplit); return true; }
    const bb = hit('[data-tmb]'); if (bb) { const p = act(), b = p.blocks.find(x => x.id === TT.sel), k = bb.dataset.tmb, txt = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
      if (k === 'done') { TT.sel = null; paneRender(p); tmBar(); return true; }
      if (k === 'out') { navigator.clipboard?.writeText(txt(b.out.join('\n'))).catch(() => {}); tmToast('Output copied'); }
      if (k === 'cmd') { navigator.clipboard?.writeText(b.cmd || '').catch(() => {}); tmToast('Command copied'); }
      if (k === 'note') tmToast(`Sent “${esc(b.cmd || 'output')}” to Notes`);
      if (k === 'ari') tmToast(b.status === 'err' ? 'Ari: that command isn’t installed. Want me to find it in Depot?' : 'Ari: two files changed since your last commit: window.rs and the README.');
      if (k === 'rerun') { TT.sel = null; p.cwd = b.cwd; run(p, b.cmd); }
      return true; }
    const bl = hit('#tm-panes .tb'); const pn = hit('[data-tmpane]');
    if (pn) { const id = +pn.dataset.tmpane; if (TT.active !== id) { TT.active = id; TT.sel = null; $$('#tm-panes .tpane').forEach(x => x.classList.toggle('act', +x.dataset.tmpane === id)); } }
    if (bl && !getSelection().toString()) { const id = +bl.dataset.tblock; TT.sel = TT.sel === id ? null : id; paneRender(act()); tmBar(); return true; }
    if (pn) { TT.sel = null; paneRender(act()); tmBar(); return true; }
    return false; }
  function tmRenDone(inp, keep) { if (!inp?.isConnected || inp.dataset.done) return; inp.dataset.done = 1; const t = TT.tabs[+inp.dataset.tmrenin];
    if (t && keep) { const v = inp.value.trim(); t.name = v && v !== inp.placeholder ? v : null; tmRender(); tmClose(); tmToast(`Renamed to ${esc(sessName(t))}`); }
    else { const p = inp.closest('.pop'); if (p) { p.innerHTML = tmSessHTML(); p.querySelector(`[data-tmtab="${inp.dataset.tmrenin}"]`)?.focus(); } } }
  document.addEventListener('keydown', e => { const inp = e.target.closest?.('[data-tmrenin]'); if (!inp) return; e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); tmRenDone(inp, true); } else if (e.key === 'Escape') { e.preventDefault(); tmRenDone(inp, false); } }, true);
  document.addEventListener('focusout', e => { if (e.target.matches?.('[data-tmrenin]')) setTimeout(() => tmRenDone(e.target, true)); });
  (() => { const w = $('#w-term'); if (!w) return;
    document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'term') return; const k = e.key, m = e.ctrlKey || e.metaKey, i = $('#tm-in');
      if (m && e.shiftKey && k.toLowerCase() === 't') { e.preventDefault(); newTab(act()?.cwd); tmRender(); return; }
      if (m && e.shiftKey && k.toLowerCase() === 'd') { e.preventDefault(); split('row'); return; }
      if (m && e.shiftKey && k.toLowerCase() === 'e') { e.preventDefault(); split('col'); return; }
      if (m && e.shiftKey && k.toLowerCase() === 'w') { e.preventDefault(); closePane(TT.active); return; }
      if (m && /^[1-9]$/.test(k) && TT.tabs[+k - 1]) { e.preventDefault(); TT.cur = +k - 1; TT.active = panesOf(tab().root)[0].id; tmRender(); return; }
      if (m && (k === '=' || k === '-')) { e.preventDefault(); TT.fs = Math.max(10, Math.min(20, TT.fs + (k === '=' ? 1 : -1))); $('#tm-panes').style.setProperty('--tfs', TT.fs + 'px'); return; }
      if (k === 'Escape' && TT.sel != null) { TT.sel = null; paneRender(act()); tmBar(); return; }
      const sp = e.target.closest?.('.tsesspop'); if (sp && (k === 'ArrowDown' || k === 'ArrowUp')) { e.preventDefault(); const r = [...sp.querySelectorAll('.mi, .laddrow')], j = r.indexOf(document.activeElement); r[(j + (k === 'ArrowDown' ? 1 : -1) + r.length) % r.length]?.focus(); return; }
      if (sp && k === 'Escape') { tmClose(); $('#tm-bar [data-tmsess]')?.focus(); return; }
      if (sp && (k === 'Delete' || k === 'Backspace') && TT.tabs.length > 1) { const m = document.activeElement.closest('[data-tmtab]'); if (m) { e.preventDefault(); tmClose(); closeTab(+m.dataset.tmtab); } return; }
      if (e.target !== i) return; const p = act();
      if (k === 'Enter') { e.preventDefault(); if (p.busy) return; const v = i.value; i.value = ''; ghost(); run(p, v); }
      else if ((k === 'Tab' || (k === 'ArrowRight' && i.selectionStart === i.value.length)) && TT.ghost) { e.preventDefault(); i.value += TT.ghost; ghost(); }
      else if (k === 'Tab') { e.preventDefault(); const parts = i.value.split(' '), last = parts.pop(), dir = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : '', pool = (TFS[resolve(p.cwd, dir || '.')] || []).map(x => dir + x.replace('*', '')), mm = pool.filter(x => x.startsWith(last));
        if (mm.length === 1) i.value = [...parts, mm[0]].join(' '); else if (mm.length > 1) tmToast(mm.map(x => x.split('/').filter(Boolean).pop()).join('  ·  ')); ghost(); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); const H = TT.hist; if (!H.length) return; TT.hi = k === 'ArrowUp' ? (TT.hi < 0 ? H.length - 1 : Math.max(0, TT.hi - 1)) : (TT.hi < 0 ? -1 : TT.hi + 1); if (TT.hi >= H.length) TT.hi = -1; i.value = TT.hi < 0 ? '' : H[TT.hi]; ghost(); }
      else if (m && k.toLowerCase() === 'l') { e.preventDefault(); p.blocks = []; paneRender(p); }
      else if (m && k.toLowerCase() === 'c' && !getSelection().toString()) { e.preventDefault(); if (p.busy) tmToast('Stopped'); i.value = ''; ghost(); } }); })();
  function renderTerm() { $('#tm-top').innerHTML = `<img src="${A}terminal.svg" alt=""><b>Terminal</b><span class="chev">${ic('chevron-down')}</span>`; const p = newTab(); p.blocks.push({ id: BID++, cmd: null, cwd: p.cwd, out: [`<span class="tm-mut tm-hello">SunoOS 0.1 · bash 5.2 · ${new Date().toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</span>`, LUMAFETCH()], status: 'ok', dur: '' }); tmRender(); }

  /* ══ Calendar ══════════════════════════════════════════════════════════════
     Two questions: what's next, and when am I free. Flow shows time as a stream: days run on, nights fold
     away, a glowing line marks now, and free time is drawn as time you can hold. Week and Month are one click
     away. Type what you want in the bar ("Lunch with Priya Fri 1pm"); click an event for a drawer from the corner. */
  const CALS = { work: ['Work', 250], personal: ['Personal', 150], family: ['Family', 25], hol: ['Holidays', 60] };
  const CBASE = new Date(2026, 8, 21), TODAY = 2, DS = 7 * 60, DE = 22 * 60, PXM = .9;
  const dOf = o => new Date(2026, 8, 21 + o);
  const fmtT = m => { const h = Math.floor(m / 60), mm = m % 60; return `${(h % 12) || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };
  const fmtD = (o, long) => dOf(o).toLocaleDateString([], long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
  const dur = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`;
  let EID = 1; const ev = (o, s, e, t, cal, x = {}) => ({ id: EID++, o, s, e, t, cal, ...x });
  const EVS = [];
  for (let o = 0; o < 26; o++) { const wd = dOf(o).getDay(); if (wd > 0 && wd < 6) EVS.push(ev(o, 570, 585, 'Standup', 'work', { people: ['PR', 'NF', 'SK'], loc: 'Suno Hub' })); }
  EVS.push(ev(0, 660, 720, 'Design review', 'work', { people: ['PR', 'NF'] }), ev(0, 1110, 1200, 'Dinner with Nora', 'personal', { people: ['NF'], loc: 'Nopa, Divisadero St' }),
    ev(1, 0, 0, 'First day of autumn', 'hol', { all: true }), ev(1, 780, 840, 'Lunch with Alex', 'personal', { people: ['AR'], loc: 'Tartine Manufactory' }), ev(1, 900, 990, 'Fairphone build review', 'work', { people: ['SK'] }),
    ev(2, 630, 690, 'Press call · The Verge', 'work', { people: ['NF'], loc: 'Video call', video: true }), ev(2, 840, 900, 'Launch walkthrough', 'work', { people: ['PR', 'NF', 'SK'], loc: 'The studio', note: 'Bring the Fairphone build. Walk the installer end to end.' }), ev(2, 1050, 1095, 'Call Dad', 'family', { people: ['MO'] }),
    ev(3, 720, 780, 'Podcast recording', 'work', { loc: 'Studio B', note: 'Talking points are in Notes → Launch → Press.' }), ev(3, 960, 1020, '1:1 with Priya', 'work', { people: ['PR'] }),
    ev(4, 660, 720, 'Mirror load test', 'work', { people: ['SK'] }), ev(4, 1140, 1320, 'Movie night', 'personal', { people: ['TH', 'CL'], loc: 'Theo’s place' }),
    ev(5, 600, 780, 'Climbing', 'personal', { people: ['TH', 'CL', 'AR'], loc: 'Mission Cliffs' }), ev(6, 660, 750, 'Brunch with Dad', 'family', { people: ['MO'], loc: 'Sacramento' }),
    ev(7, 900, 960, 'Tech Central bi-weekly', 'work'), ev(8, 600, 660, 'Launch rehearsal', 'work', { people: ['PR', 'NF', 'SK'] }), ev(9, 0, 0, 'Release candidate', 'work', { all: true }),
    ev(10, 720, 810, 'Lunch with Lena', 'personal', { people: ['CL'] }), ev(12, 600, 720, 'Farmers market', 'personal'), ev(15, 0, 0, 'Press preview', 'work', { all: true }), ev(21, 0, 0, 'Columbus Day', 'hol', { all: true }), ev(23, 0, 0, 'SunoOS 0.1 launch', 'work', { all: true, people: ['PR', 'NF', 'SK'] }));
  const CS = { view: 'month', anchor: TODAY, sel: null, day: TODAY, off: {}, q: '', draft: null, rsvp: {}, panel: (() => { try { return localStorage.getItem('luma70-cal-panel') !== '0'; } catch (x) { return true; } })(), pick: false };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const visible = e => !CS.off[e.cal];
  const dayEvs = o => EVS.filter(e => e.o === o && visible(e)).sort((a, b) => (b.all ? 1 : 0) - (a.all ? 1 : 0) || a.s - b.s);
  const evStyle = e => `--eh:${CALS[e.cal][1]}`;
  const faces2 = (ks, sz = 18) => ks?.length ? `<span class="nfaces">${ks.map(k => av(k, sz)).join('')}</span>` : '';
  function lanes(list) { const out = []; list.forEach(e => { let l = 0; while (out.some(x => x.l === l && x.e.s < e.e && e.s < x.e.e)) l++; out.push({ e, l }); }); return out.map(x => ({ ...x, n: Math.max(...out.filter(y => y.e.s < x.e.e && x.e.s < y.e.e).map(y => y.l)) + 1 })); }
  function freeGaps(o, list) { const wd = dOf(o).getDay(), from = wd === 0 || wd === 6 ? 600 : 540, to = 1080, busy = list.filter(e => !e.all).map(e => [e.s, e.e]).sort((a, b) => a[0] - b[0]); const gaps = []; let t = o === TODAY ? Math.max(from, Math.ceil(nowMin() / 15) * 15) : from;
    busy.forEach(([s, e]) => { if (Math.min(s, to) - t >= 60) gaps.push([t, Math.min(s, to)]); t = Math.max(t, e); }); if (to - t >= 60) gaps.push([t, to]); return gaps.filter(([s, e]) => e - s >= 60 && !(o === TODAY && e < nowMin())); }
  function daySentence(o) { const l = dayEvs(o).filter(e => !e.all), free = freeGaps(o, l).reduce((n, [s, e]) => n + e - s, 0), next = o === TODAY ? l.find(e => e.e > nowMin()) : l[0];
    return [l.length ? `${l.length} ${l.length === 1 ? 'thing' : 'things'}` : 'Nothing planned', next && o === TODAY ? `next: ${next.t} at ${fmtT(next.s)}` : '', free ? `${dur(free)} free` : ''].filter(Boolean).join(' · '); }
  function evBlock(e, top, h, lane, n, past) { return `<button class="cev${past ? ' past' : ''}${CS.sel === e.id ? ' on' : ''}${h < 34 ? ' tiny' : ''}" type="button" data-cev="${e.id}" style="${evStyle(e)};top:${top}px;height:${Math.max(h, 18)}px;left:calc(${lane / n * 100}% + 2px);width:calc(${100 / n}% - 4px)">
      <b>${esc(e.t)}</b><span>${fmtT(e.s)}${h >= 34 ? ` – ${fmtT(e.e)}` : ''}${e.loc && h >= 64 ? ` · ${esc(e.loc)}` : ''}</span>${h >= 80 ? faces2(e.people, 18) : ''}</button>`; }
  /* Flow */
  function flowHTML() { let h = ''; const nm = nowMin();
    for (let o = 0; o < 14; o++) { const list = dayEvs(o), all = list.filter(e => e.all), timed = list.filter(e => !e.all), past = o < TODAY, today = o === TODAY, H = (DE - DS) * PXM;
      if (o) h += `<div class="cnight">${MOON}<span>Night</span></div>`;
      h += `<section class="cday${today ? ' today' : ''}${past ? ' past' : ''}" data-cday="${o}"><header class="cdh"><b>${dOf(o).toLocaleDateString([], { weekday: 'long' })}</b><span>${dOf(o).toLocaleDateString([], { month: 'long', day: 'numeric' })}${today ? ' · Today' : ''}</span><em>${daySentence(o)}</em>${all.map(e => `<button class="call" type="button" data-cev="${e.id}" style="${evStyle(e)}">${esc(e.t)}</button>`).join('')}</header>
        <div class="ctrack" style="height:${H}px">${Array.from({ length: (DE - DS) / 60 + 1 }, (_, i) => `<i class="hr" style="top:${i * 60 * PXM}px">${today && Math.abs(nowMin() - (DS + i * 60)) < 18 ? '' : `<span>${fmtT(DS + i * 60).replace(':00', '')}</span>`}</i>`).join('')}
        <div class="cev-lane">${freeGaps(o, list).map(([s, e]) => `<button class="cfree" type="button" data-chold="${o}:${s}:${e}" style="top:${(s - DS) * PXM}px;height:${(e - s) * PXM}px"><span>${dur(e - s)} free</span><em>Hold this time</em></button>`).join('')}
        ${lanes(timed).map(({ e, l, n }) => evBlock(e, (e.s - DS) * PXM, (e.e - e.s) * PXM, l, n, past || (today && e.e < nm))).join('')}</div>
        ${today && nm > DS && nm < DE ? `<i class="cnow" style="top:${(nm - DS) * PXM}px"><b>${calNarrow() ? fmtT(nm).replace(/\s*[AP]M$/i, '') : fmtT(nm)}</b></i>` : ''}</div></section>`; }
    return `<div class="cflow">${h}</div>`; }
  /* Week */
  function weekHTML() { const n = calNarrow() ? 3 : 7, start = n === 3 ? CS.anchor : CS.anchor - ((dOf(CS.anchor).getDay() + 6) % 7), nm = nowMin(), H = (DE - DS) * PXM;
    return `<div class="cweek${n === 3 ? ' c3' : ''}"><div class="cwh"><i></i>${Array.from({ length: n }, (_, i) => { const o = start + i; return `<div class="${o === TODAY ? 'today' : ''}"><span>${dOf(o).toLocaleDateString([], { weekday: 'short' })}</span><b>${dOf(o).getDate()}</b>${dayEvs(o).filter(e => e.all).map(e => `<button class="call" type="button" data-cev="${e.id}" style="${evStyle(e)}">${esc(e.t)}</button>`).join('')}</div>`; }).join('')}</div>
      <div class="cwb"><div class="cwt" style="height:${H}px">${Array.from({ length: (DE - DS) / 60 + 1 }, (_, i) => `<span style="top:${i * 60 * PXM}px">${fmtT(DS + i * 60).replace(':00', '')}</span>`).join('')}</div>
      ${Array.from({ length: n }, (_, i) => { const o = start + i, list = dayEvs(o).filter(e => !e.all); return `<div class="cwc${o === TODAY ? ' today' : ''}${o < TODAY ? ' past' : ''}" data-cslot="${o}" style="height:${H}px">${Array.from({ length: (DE - DS) / 60 }, (_, k) => `<i class="hr2" style="top:${k * 60 * PXM}px"></i>`).join('')}
        ${lanes(list).map(({ e, l, n }) => evBlock(e, (e.s - DS) * PXM, (e.e - e.s) * PXM, l, n, o < TODAY || (o === TODAY && e.e < nm))).join('')}${o === TODAY && nm > DS && nm < DE ? `<i class="cnow" style="top:${(nm - DS) * PXM}px"></i>` : ''}</div>`; }).join('')}</div></div>`; }
  /* Phone and narrow windows (under 560): a compact month of dots over the chosen day's agenda, as a phone
     calendar reads: the month to find a day, the day to see what's in it and what's free. */
  const calNarrow = () => ($('#w-calendar .ibody')?.clientWidth || 999) < 560;
  function pmonthHTML() { const a = dOf(CS.anchor), first = new Date(a.getFullYear(), a.getMonth(), 1), lead = (first.getDay() + 6) % 7, o0 = Math.round((first - CBASE) / 864e5) - lead, days = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate(), wk = Math.ceil((lead + days) / 7);
    if (CS.day == null || dOf(CS.day).getMonth() !== a.getMonth()) CS.day = dOf(TODAY).getMonth() === a.getMonth() ? TODAY : o0 + lead;
    const cells = Array.from({ length: 7 * wk }, (_, i) => { const o = o0 + i, d = dOf(o), inM = d.getMonth() === a.getMonth(), l = dayEvs(o), cals = [...new Set(l.map(e => e.cal))].slice(0, 3);
      return `<button type="button" class="pmd${inM ? '' : ' out'}${o === TODAY ? ' today' : ''}${o < TODAY ? ' past' : ''}${CS.day === o ? ' on' : ''}" data-cdayp="${o}" aria-label="${fmtD(o, true)}, ${l.length ? l.length + ' events' : 'nothing planned'}"><b>${d.getDate()}</b><span class="pdots">${cals.map(c => `<i style="--eh:${CALS[c][1]}"></i>`).join('')}</span></button>`; }).join('');
    const o = CS.day, l = dayEvs(o), free = freeGaps(o, l), nm = nowMin();
    const rows = l.map(e => `<button class="pev${o < TODAY || (o === TODAY && !e.all && e.e < nm) ? ' past' : ''}${CS.sel === e.id ? ' on' : ''}" type="button" data-cev="${e.id}" style="${evStyle(e)}"><span class="pt">${e.all ? '<b>All day</b>' : `<b>${fmtT(e.s)}</b><small>${fmtT(e.e)}</small>`}</span><i class="pbar"></i><span class="px"><b>${esc(e.t)}</b>${e.loc ? `<small>${e.video ? ic('video') : ''}${esc(e.loc)}</small>` : ''}</span>${faces2(e.people, 22)}</button>`).join('');
    return `<div class="pmonth"><div class="pmh">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div><div class="pmg" data-cswipe>${cells}</div>
      <section class="pday"><header><b>${o === TODAY ? 'Today' : dOf(o).toLocaleDateString([], { weekday: 'long' })}</b><span>${dOf(o).toLocaleDateString([], { weekday: o === TODAY ? 'long' : undefined, month: 'long', day: 'numeric' })}</span></header>
        <p class="psum">${daySentence(o)}</p>
        ${l.length ? `<div class="pevs">${rows}</div>` : ''}
        ${free.length ? `<h6>Free</h6><div class="pfree">${free.map(([s, e]) => `<button class="cfree2" type="button" data-chold="${o}:${s}:${e}"><span>${fmtT(s)} – ${fmtT(e)}</span><em>${dur(e - s)}</em><b>Hold</b></button>`).join('')}</div>` : ''}
        <button class="padd" type="button" data-cnewon="${o}">${ic('plus')}<span>Add an event on ${o === TODAY ? 'today' : dOf(o).toLocaleDateString([], { weekday: 'long' })}</span></button></section></div>`; }
  /* Month */
  function monthHTML() { if (calNarrow()) return pmonthHTML(); const a = dOf(CS.anchor), first = new Date(a.getFullYear(), a.getMonth(), 1), lead = (first.getDay() + 6) % 7, o0 = Math.round((first - CBASE) / 864e5) - lead;
    return `<div class="cmonth"><div class="cmh">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span>${d}</span>`).join('')}</div><div class="cmg" style="--wk:${Math.ceil((lead + new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate()) / 7)}">${Array.from({ length: 7 * Math.ceil((lead + new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate()) / 7) }, (_, i) => { const o = o0 + i, d = dOf(o), l = dayEvs(o), inM = d.getMonth() === a.getMonth();
      return `<div class="cmd${inM ? '' : ' out'}${o === TODAY ? ' today' : ''}${o < TODAY ? ' past' : ''}${CS.day === o ? ' on' : ''}" role="button" tabindex="0" data-cdayp="${o}" data-n="${l.length}"><b>${d.getDate()}</b>${l.slice(0, 3).map(e => `<button type="button" class="cml${e.all ? ' all' : ''}${CS.sel === e.id ? ' on' : ''}" data-cev="${e.id}" style="${evStyle(e)}">${e.all ? '' : `<i>${fmtT(e.s).replace(' ', '')}</i>`}<u>${esc(e.t)}</u></button>`).join('')}${l.length > 3 ? `<em>${l.length - 3} more</em>` : ''}</div>`; }).join('')}</div></div>`; }
  function calHead() { const o = CS.anchor, v = CS.view; let t, sub;
    if (v === 'month') { t = dOf(o).toLocaleDateString([], { month: 'long', year: 'numeric' }); sub = `${EVS.filter(e => dOf(e.o).getMonth() === dOf(o).getMonth() && visible(e)).length} events`; }
    else if (v === 'week') { const s = o - ((dOf(o).getDay() + 6) % 7); t = `${dOf(s).toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${dOf(s + 6).toLocaleDateString([], { month: 'short', day: 'numeric' })}`; sub = `${Array.from({ length: 7 }, (_, i) => dayEvs(s + i).length).reduce((a, b) => a + b, 0)} events this week`; }
    else { const o2 = CS.flowAt ?? CS.anchor; t = fmtD(o2, true) + (o2 === TODAY ? ' · Today' : ''); sub = daySentence(o2); }
    const nw = calNarrow(); $('#w-calendar').classList.toggle('calnarrow', nw);
    if (nw) { /* the phone head: the month (or the day) large, the year small beside it; the calendars as their dots, top right */
      const d0 = v === 'flow' ? dOf(CS.flowAt ?? CS.anchor) : dOf(o), big = v === 'flow' ? d0.toLocaleDateString([], { weekday: 'long' }) : d0.toLocaleDateString([], { month: 'long' }), small = v === 'flow' ? d0.toLocaleDateString([], { month: 'long', day: 'numeric' }) : String(d0.getFullYear());
      /* one title island, as Ari's: the month (tap for the month picker) and, past a full-height hairline, the calendars as their dots */
      $('#cal-head').innerHTML = `<button class="chead phead" type="button" data-cjump aria-label="${big} ${small}. Jump to a month"><b>${big}</b><span>${small}</span>${ic('chevron-down')}</button><button class="ccal" type="button" data-ccals title="Calendars" aria-label="Calendars">${Object.entries(CALS).map(([k, [, h]]) => `<i class="round${CS.off[k] ? ' off' : ''}" style="--eh:${h}"></i>`).join('')}</button>`;
      $('#cal-cals').innerHTML = ''; return; }
    $('#cal-head').innerHTML = `<button class="chead" type="button" data-cjump><span><b>${t}</b><span>${sub}</span></span>${ic('chevron-down')}</button>`;
    $('#cal-cals').innerHTML = `${lModes([['flow', 'Flow', 'list'], ['week', 'Week', 'columns-3'], ['month', 'Month', 'layout-grid']], CS.view, 'data-cview', 'View')}<button class="ccal" type="button" data-ccals title="Calendars">${Object.entries(CALS).map(([k, [, h]]) => `<i class="round${CS.off[k] ? ' off' : ''}" style="--eh:${h}"></i>`).join('')}<span>Calendars</span></button><button class="ib${calPanelOn() ? ' on' : ''}" type="button" data-cpanel aria-label="Day panel" title="Day panel" aria-pressed="${calPanelOn()}">${ic('panel-right')}</button>`; requestAnimationFrame(segs); }
  const calPanelOn = () => CS.panel && (!$('#w-calendar').classList.contains('phone') || CS.pick);
  function calBar() { calDraftCard(); const bar = $('#cal-bar'); bar.hidden = !!CS.draft; if (CS.draft) { setTimeout(() => { const t = $('#cal-draft [data-cdt="t"]'); if (t && !t.value) t.focus(); }, 30); return; }
    /* narrow: the bar is Today, the views and a key to add; the key turns the bar into the "Add an event" field in place */
    /* narrow (v71 pass): two rows. Top: how you're looking (Flow, 3 days, Month, as a dropdown) and a small Today that
       shows today's date; bottom: "Add an event", always there. A picked event or day grows the bar with its details. */
    if (calNarrow()) { const X = CS.px || '', VW = [['flow', 'Flow', 'list'], ['week', '3 days', 'columns-3'], ['month', 'Month', 'layout-grid']], cv = VW.find(x => x[0] === CS.view) || VW[2], td = dOf(TODAY);
      const det = CS.pick && CS.panel && $('#cal-det') && !$('#cal-det').hidden;
      const panel = X === 'view' ? `<div class="fexp"><div class="fsha c3">${VW.map(([k, n, i]) => `<button type="button" class="fvt${CS.view === k ? ' on' : ''}" data-cview="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>` : det ? `<div class="fexp caldet2">${$('#cal-det').innerHTML}</div>` : '';
      bar.classList.remove('calcomp'); bar.classList.add('phnofit', 'calph'); bar.classList.toggle('phgrow', !!panel);
      /* a picked event or day: the panel has no header of its own; Back (to the day) and Close sit in the bar's own row */
      const ev = det && CS.sel != null && EVS.find(x => x.id === CS.sel), r1 = det ? `<div class="calr1">${ev ? `<button class="calnav" type="button" data-cback aria-label="Back to ${esc(dOf(ev.o).toLocaleDateString([], { weekday: 'long' }))}">${ic('chevron-left')}<b>${esc(dOf(ev.o).toLocaleDateString([], { weekday: 'long' }))}</b></button>` : `<button class="calvw${X === 'view' ? ' on' : ''}" type="button" data-calpx="view" aria-expanded="${X === 'view'}">${ic(cv[2])}<b>${cv[1]}</b>${ic('chevron-down')}</button>`}<span class="sp"></span><button class="ib calx" type="button" data-cclose aria-label="Close" title="Close">${ic('x')}</button></div>` : null;
      setBar(bar, `${panel}${r1 ?? `<div class="calr1"><button class="calvw${X === 'view' ? ' on' : ''}" type="button" data-calpx="view" aria-expanded="${X === 'view'}">${ic(cv[2])}<b>${cv[1]}</b>${ic('chevron-down')}</button><span class="sp"></span><button class="caltd" type="button" data-ctoday aria-label="Go to today" title="Today"><small>${td.toLocaleDateString([], { month: 'short' }).toUpperCase()}</small><b>${td.getDate()}</b></button></div>`}
        <div class="calr2"><label class="cadd">${ic('plus')}<input id="cal-q" placeholder="Add an event, like Lunch Fri 1pm" value="${esc(CS.q)}" aria-label="Add an event"><span class="cprev" id="cal-prev"></span></label></div>`);
      const i = $('#cal-q'), grow = () => { const v = i.value.trim(), s0 = Math.ceil((nowMin() + 30) / 60) * 60; CS.draft = CS.keep && CS.keep.src === v ? CS.keep : { ...(parseEv(v) || { o: CS.day ?? TODAY, s: s0, e: s0 + 60, t: '', people: [], cal: 'personal' }), src: v, alert: 10 }; CS.keep = null; CS.q = ''; CS.px = ''; CS.pick = false; calBar(); };
      i.oninput = () => { CS.q = i.value; const d = parseEv(i.value); $('#cal-prev').innerHTML = d ? `${fmtD(d.o)} · ${fmtT(d.s)}` : ''; };
      i.onkeydown = e => { if (e.key === 'Enter') grow(); if (e.key === 'Escape') { i.value = ''; CS.q = ''; i.blur(); } };
      $('#cal-bar .cadd > svg.i')?.addEventListener('click', grow); return; }
    bar.classList.remove('phnofit', 'calph');
    bar.classList.toggle('calcomp', calNarrow());
    setBar(bar, `<label class="cadd">${ic('plus')}<input id="cal-q" placeholder="${calNarrow() ? 'Lunch with Priya Fri 1pm' : 'Add an event, like “Lunch with Priya Fri 1pm”'}" value="${esc(CS.q)}" aria-label="Add an event"><span class="cprev" id="cal-prev"></span></label>${calNarrow() ? `<button class="ib" type="button" data-ccomposex aria-label="Cancel" title="Cancel">${ic('x')}</button>` : ''}`);
    if (CS.compose) setTimeout(() => $('#cal-q')?.focus(), 40);
    const i = $('#cal-q'), grow = () => { const v = i.value.trim(), s0 = Math.ceil((nowMin() + 30) / 60) * 60; CS.draft = CS.keep && CS.keep.src === v ? CS.keep : { ...(parseEv(v) || { o: CS.day ?? TODAY, s: s0, e: s0 + 60, t: '', people: [], cal: 'personal' }), src: v, alert: 10 }; CS.keep = null; CS.q = ''; CS.compose = false; calBar(); };
    i.oninput = () => { CS.q = i.value; const d = parseEv(i.value); $('#cal-prev').innerHTML = d ? `${fmtD(d.o)} · ${fmtT(d.s)}${d.people?.length ? ' · ' + d.people.map(k => ppl(k).n.split(' ')[0]).join(', ') : ''}` : ''; };
    i.onkeydown = e => { if (e.key === 'Enter') grow(); if (e.key === 'Escape') { i.value = ''; CS.q = ''; CS.keep = null; i.blur(); } };
    $('#cal-bar .cadd > svg.i')?.addEventListener('click', grow); }
  /* New event: the bar grows into the editor in place (SunoUI action center, Charlie's reply editor): what was understood from what you
     typed, ready to check and change, then Create. Esc folds it back to the bar and keeps it. */
  const CALERT = [[0, 'None'], [-1, 'At the start'], [10, '10 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [1440, '1 day before']];
  function calDraftCard() { const el = $('#cal-draft'), d = CS.draft; if (!el) return; if (!d) { el.hidden = true; el.innerHTML = ''; return; }
    const was = !el.hidden, q = (CS.dq || '').trim().toLowerCase(), sug = q ? Object.keys(PPL).filter(k => k !== 'me' && !d.people.includes(k) && ppl(k).n.toLowerCase().includes(q)).slice(0, 3) : [];
    if (!el._lacCollapse) lAC.bind(el, () => { const k = CS.draft; if (!k) return; k.t = $('#cal-draft [data-cdt="t"]')?.value ?? k.t; CS.keep = k; CS.q = k.src || k.t; CS.draft = null; CS.dq = ''; calBar(); setTimeout(() => $('#cal-q')?.focus(), 40); });
    el.style.setProperty('--eh', CALS[d.cal][1]);
    el.innerHTML = `<div class="lach"><strong class="lacmode">${ic('calendar')}New event</strong><span>${d.src ? `from “<b>${esc(d.src)}</b>”` : `on <b>${esc(fmtD(d.o, true))}</b>`}</span></div>
      <div class="calacb"><input class="cdname" data-cdt="t" value="${esc(d.t)}" placeholder="Event name" aria-label="Event name" autocomplete="off" spellcheck="false">
      <div class="cdrow">${ic('clock')}<button class="cdchip" type="button" data-cdpick="o">${fmtD(d.o)}</button><button class="cdchip" type="button" data-cdpick="s">${fmtT(d.s)}</button><span class="cdto">to</span><button class="cdchip" type="button" data-cdpick="e">${fmtT(d.e)}</button><em>${dur(d.e - d.s)}</em></div>
      <div class="cdrow">${ic('map-pin')}<input data-cdt="loc" value="${esc(d.loc || '')}" placeholder="Add a place or a video call" aria-label="Place" autocomplete="off"></div>
      <div class="cdrow cdppl">${ic('users')}${d.people.map(k => `<span class="cdp">${av(k, 20)}${esc(ppl(k).n.split(' ')[0])}<button type="button" data-cdrm="${k}" aria-label="Remove ${esc(ppl(k).n)}">${ic('x')}</button></span>`).join('')}<input data-cdq value="${esc(CS.dq || '')}" placeholder="${d.people.length ? 'Add someone else' : 'Invite people'}" aria-label="Invite people" autocomplete="off"></div>
      ${sug.length ? `<div class="cdsug">${sug.map((k, i) => `<button type="button" class="${i ? '' : 'first'}" data-cdadd="${k}">${av(k, 24)}<span>${esc(ppl(k).n)}</span></button>`).join('')}</div>` : ''}
      <div class="cdrow">${ic('calendar')}<button class="cdchip" type="button" data-ccalpick style="--eh:${CALS[d.cal][1]}"><i class="cdot round"></i>${CALS[d.cal][0]}${ic('chevron-down')}</button><span class="sp"></span>${ic('bell')}<button class="cdchip" type="button" data-calert>${(CALERT.find(a => a[0] === (d.alert ?? 10)) || CALERT[2])[1]}${ic('chevron-down')}</button></div></div>
      <div class="lacft"><button class="ib" type="button" data-cdraftx title="Discard" aria-label="Discard">${ic('trash-2')}</button><span class="sp"></span><small>Esc to fold · Return to create</small><button class="bt key" type="button" data-cdraftok>${ic('check')}Create</button></div>`;
    if (!was) lAC.open(el); }
  const CDTIMES = Array.from({ length: 34 }, (_, i) => 420 + i * 30);
  /* "Lunch with Priya Fri 1pm for 90m" → an event */
  function parseEv(str) { let s = ' ' + str.trim() + ' '; if (str.trim().length < 3) return null; let o = null, st = null, len = 60;
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    s = s.replace(/\s(today|tonight)\s/i, (_, w) => { o = TODAY; if (/night/i.test(w)) st = st ?? 1140; return ' '; }).replace(/\stomorrow\s/i, () => { o = TODAY + 1; return ' '; });
    s = s.replace(/\s(?:on\s)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s/i, (_, w) => { const t = days.indexOf(w.toLowerCase().slice(0, 3)); let k = TODAY + ((t - dOf(TODAY).getDay() + 7) % 7 || 7); o = k; return ' '; });
    s = s.replace(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\s/i, (m, h, mm, ap) => { if (!ap && !mm && +h > 12) return m; h = +h; if (ap?.toLowerCase() === 'pm' && h < 12) h += 12; if (!ap && h < 8) h += 12; st = h * 60 + (+mm || 0); return ' '; });
    s = s.replace(/\sfor\s(\d+(?:\.\d+)?)\s?(h|hr|hours?|m|min|minutes?)\s/i, (_, n, u) => { len = /^h/i.test(u) ? Math.round(n * 60) : +n; return ' '; });
    let loc = null; s = s.replace(/\s(?:at|@)\s+([A-Z][\w'’&.-]*(?:\s+[A-Z][\w'’&.-]*)*)\s/, (_, pl) => { loc = pl; return ' '; });   // "at Nopa" is the place
    const t = s.trim().replace(/\s+/g, ' '), people = Object.keys(PPL).filter(k => k !== 'me' && new RegExp('\\b' + ppl(k).n.split(' ')[0] + '\\b', 'i').test(t));
    if (o == null) o = TODAY; if (st == null) st = Math.min(DE - 60, Math.ceil((nowMin() + 30) / 60) * 60);
    const cal = /stand|review|call|press|launch|meeting|sync/i.test(t) ? 'work' : people.includes('MO') ? 'family' : 'personal';
    return { o, s: st, e: Math.min(24 * 60, st + len), t: t.charAt(0).toUpperCase() + t.slice(1), people, cal, ...(loc ? { loc } : {}) }; }
  /* The panel on the right is the SunoUI details pane and Calendar's main view: open by default on today, then whichever day you pick;
     an event opens in the same pane with a way back. × or the corner toggle hides it (remembered); on a phone it's a drawer you open. */
  function calDet() { calDet0(); if (calNarrow()) calBar(); }
  function calDet0() { const d = $('#cal-det'), on = calPanelOn(); $('#cal-cals [data-cpanel]')?.classList.toggle('on', on); if (!on) { d.hidden = true; return; }
    if (CS.day == null) CS.day = TODAY; lDPShow(d, { main: true });
    const e = CS.sel != null && EVS.find(x => x.id === CS.sel); if (!e) { CS.sel = null; return dayDet(d); }
    const ro = e.cal === 'hol', me = CS.rsvp[e.id] || 'yes', ppl2 = e.people || [], RS = { yes: 'Going', maybe: 'Maybe', no: 'Can’t go' }, ans = k => k === 'me' ? RS[me] : k === 'SK' ? 'Maybe' : 'Going';
    const row = k => { const f = k === 'me' ? '' : ppl(k).n.split(' ')[0]; return lDP.row({ av: av(k, 32), n: k === 'me' ? 'You' : ppl(k).n, sub: k === 'me' ? `Organiser · ${ans(k)}` : ans(k), attr: k === 'me' ? 'disabled' : `data-lui-todo="Opening ${esc(ppl(k).n)} in Contacts" title="Open in Contacts"`,
      acts: k === 'me' ? '' : lDP.act('message-square', 'Message ' + f, `data-lui-ca="message" data-lui-p="${k}"`) + lDP.act('mail', 'Email ' + f, `data-lui-ca="email" data-lui-p="${k}"`) }); };
    d.innerHTML = lDP({ title: ro ? 'Holiday' : 'Event', close: 'data-cclose', body: `<div class="calev"><div class="calevh" style="${evStyle(e)}"><i></i><b>${esc(e.t)}</b><small>${fmtD(e.o, true)}</small><small>${e.all ? 'All day' : `${fmtT(e.s)} – ${fmtT(e.e)} · ${dur(e.e - e.s)}`}</small></div>
      ${ro ? '' : `<div class="cevtiles"><button type="button" data-ctodo="Editing “${esc(e.t)}”">${ic('pencil')}<span>Edit</span></button><button type="button" data-share>${ic('share-2')}<span>Share</span></button><button type="button" data-ctodo="Duplicated “${esc(e.t)}”">${ic('copy')}<span>Duplicate</span></button><button class="danger" type="button" data-cdel>${ic('trash-2')}<span>Delete</span></button></div>`}
      ${e.video ? `<button class="bt key wide3" type="button" data-ctodo="Joining the call…">${ic('video')}Join call</button>` : ''}
      ${ppl2.length && !ro ? `${lDP.lab('Your answer')}${seg([['yes', 'Going'], ['maybe', 'Maybe'], ['no', 'Can’t go']], me, 'data-crsvp', 'Your answer', 'calrsvp')}` : ''}
      ${lDP.lab('Details')}${lDP.kv([['Calendar', `<span class="calcal" style="${evStyle(e)}"><i class="cdot round"></i>${CALS[e.cal][0]}</span>`], ...(ro ? [] : [['Alert', e.all ? 'The day before, 9:00 AM' : '10 minutes before']])])}
      ${e.loc && !e.video ? `${lDP.lab('Place')}${lPlaceCard({ n: e.loc, addr: '12 min away' })}` : ''}
      ${ppl2.length ? `${lDP.lab('People', lCount(ppl2.length + 1))}<div class="ldplist">${['me', ...ppl2].map(row).join('')}${lAddRow('Message everyone', 'data-ctodo="A new conversation with everyone in Messages"', 'message-square')}</div>` : ''}
      ${e.note ? `${lDP.lab('Notes')}<p class="cnote2">${esc(e.note)}</p>` : ''}${ro ? `<p class="calnone">Holidays are read-only.</p>` : ''}</div>` })
      .replace('<header class="ldph">', `<header class="ldph"><button class="ib calback" type="button" data-cback aria-label="Back to ${esc(dOf(e.o).toLocaleDateString([], { weekday: 'long' }))}" title="Back">${ic('chevron-left')}</button>`);
    requestAnimationFrame(segs); }
  function dayDet(d) { const o = CS.day, l = dayEvs(o), free = freeGaps(o, l), wd = dOf(o).toLocaleDateString([], { weekday: 'long' });
    d.innerHTML = lDP({ title: o === TODAY ? 'Today' : wd, close: 'data-cclose', body: `<div class="calday"><b>${dOf(o).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</b><small>${daySentence(o).replace(/^Nothing planned( · )?/, '') || 'No free time'}</small></div>
      ${l.length ? '' : `<p class="calnone">Nothing on ${o === TODAY ? 'today' : wd}</p>`}<div class="ldplist">${l.map(e => lDPItem({ lead: '<i class="cbar3"></i>', n: e.t, sub: `${e.all ? 'All day' : `${fmtT(e.s)} – ${fmtT(e.e)}`}${e.loc ? ' · ' + esc(e.loc) : ''}`, attr: `data-cev="${e.id}"`, style: evStyle(e), trail: faces2(e.people, 18) })).join('')}${lAddRow('Add an event', `data-cnewon="${o}"`, 'plus')}</div>
      ${free.length ? `${lDP.lab('Free')}${free.map(([s, e]) => `<button class="cfree2" type="button" data-chold="${o}:${s}:${e}"><span>${fmtT(s)} – ${fmtT(e)}</span><em>${dur(e - s)}</em><b>Hold</b></button>`).join('')}` : ''}` }); }
  // a month cell shows what fits and counts the rest
  function cmFit() { $$('#cal-body .cmd').forEach(c => { const ev = [...c.querySelectorAll('.cml')], tot = +c.dataset.n || ev.length; ev.forEach(x => x.hidden = false); let m = c.querySelector('em'); if (!m) { m = document.createElement('em'); c.appendChild(m); } m.hidden = true;
    let shown = Math.min(ev.length, 3); const fits = () => c.scrollHeight <= c.clientHeight + 1; ev.forEach((x, i) => x.hidden = i >= shown); m.textContent = `${tot - shown} more`; m.hidden = tot <= shown;
    while (!fits() && shown > 0) { shown--; ev[shown].hidden = true; m.textContent = `${tot - shown} more`; m.hidden = false; } }); }
  function calHeadScroll() { const b = $('#cal-body'); if (b._hs) return; b._hs = 1; b.addEventListener('scroll', () => { const y = calNarrow() && CS.view === 'month' ? Math.min(b.scrollTop, 90) : 0;   /* only the month grid scrolls the head away; Flow and 3 days keep it, their day header pins under it */ [$('#cal-head'), $('#cal-cals')].forEach(el => { if (el) { el.style.transform = y ? `translateY(${-y}px)` : ''; el.style.opacity = y ? String(Math.max(0, 1 - y / 60)) : ''; } }); }, { passive: true }); }
  function calBody(scroll) { calHeadScroll(); const b = $('#cal-body'); b.innerHTML = CS.view === 'flow' ? flowHTML() : CS.view === 'week' ? weekHTML() : monthHTML(); calHead(); if (CS.view === 'month') cmFit();
    if (scroll !== false) requestAnimationFrame(() => { if (CS.view === 'month') { b.scrollTop = 0; return; } const nm = Math.max(DS, nowMin() - 120), day = CS.view === 'flow' ? $(`#cal-body [data-cday="${CS.anchor}"]`) : null;
      b.scrollTop = CS.view === 'flow' ? (day ? day.offsetTop - 70 + (CS.anchor === TODAY ? (nm - DS) * PXM : 0) : 0) : (nm - DS) * PXM; CS.flowAt = null; calTrack(); }); }
  const calClose = () => $$('#w-calendar .pop').forEach(p => p.remove());
  function calToast(msg, o) { lToast($('#w-calendar'), msg, o); }
  function cjDraw(p) { if (!p) return; const y = CS.jy, cnt = m => EVS.filter(e => visible(e) && dOf(e.o).getFullYear() === y && dOf(e.o).getMonth() === m).length, am = dOf(CS.anchor), tm = dOf(TODAY);
    p.innerHTML = `<div class="cj3h"><button class="ib" type="button" data-cjy="${y - 1}" aria-label="${y - 1}">${ic('chevron-left')}</button><b class="${y === tm.getFullYear() ? 'cjn' : ''}">${y}</b><button class="ib" type="button" data-cjy="${y + 1}" aria-label="${y + 1}">${ic('chevron-right')}</button><button class="bt sm fill" type="button" data-ctoday>Today</button></div>
      <div class="cj3m">${Array.from({ length: 12 }, (_, m) => { const n = cnt(m), lv = n ? Math.min(5, Math.ceil(n / 5)) : 0, past = y < tm.getFullYear() || (y === tm.getFullYear() && m < tm.getMonth());
        return `<button type="button" class="${m === am.getMonth() && y === am.getFullYear() ? 'on' : ''}${m === tm.getMonth() && y === tm.getFullYear() ? ' cjn' : ''}${past ? ' past' : ''}" data-cjm="${m}" aria-label="${new Date(y, m, 1).toLocaleDateString([], { month: 'long' })}, ${n ? `${n} event${n > 1 ? 's' : ''}` : 'nothing planned'}"><b>${new Date(y, m, 1).toLocaleDateString([], { month: 'short' })}</b><em aria-hidden="true">${Array.from({ length: 5 }, (_, k) => `<i${k < lv ? ' class="f"' : ''}></i>`).join('')}</em></button>`; }).join('')}</div>`; }
  function calClick(e, hit) {
    if (!hit('.pop')) calClose();
    if (calNarrow()) { const px = hit('[data-calpx]'); if (px) { CS.px = CS.px === 'view' ? '' : 'view'; if (CS.px) CS.pick = false; calBar(); return true; } if (hit('[data-cview]') || hit('[data-ctoday]')) CS.px = ''; if (hit('#cal-bar [data-cclose]')) { CS.pick = false; CS.sel = null; calDet(); return true; } }
    const v = hit('[data-cview]'); if (v) { CS.view = v.dataset.cview; calBody(); calBar(); return true; }
    if (hit('[data-ctoday]')) { CS.anchor = TODAY; CS.day = TODAY; CS.jy = null; calClose(); calBody(); return true; }
    if (hit('[data-ccompose]')) { CS.compose = true; calBar(); return true; }
    if (hit('[data-ccomposex]')) { CS.compose = false; CS.q = ''; calBar(); return true; }
    const st = hit('[data-cstep]'); if (st) { calStep(+st.dataset.cstep); return true; }
    if (hit('[data-cback]')) { CS.sel = null; $$('#cal-body [data-cev]').forEach(x => x.classList.remove('on')); calDet(); return true; }
    if (hit('[data-cpanel]')) { const on = !calPanelOn(); CS.panel = on; CS.pick = on; try { localStorage.setItem('luma70-cal-panel', on ? '1' : '0'); } catch (x) {} calDet(); return true; }
    if (hit('[data-calert]')) { calClose(); const b = hit('[data-calert]'), w = $('#w-calendar'), wr = w.getBoundingClientRect(), r = b.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop cdpop'; p.innerHTML = CALERT.map(([v, n]) => `<button class="mi${v === (CS.draft.alert ?? 10) ? ' on' : ''}" type="button" data-calertset="${v}"><span>${n}</span></button>`).join(''); w.appendChild(p);
      Object.assign(p.style, { left: Math.min(r.left - wr.left, wr.width - 190) + 'px', bottom: (wr.bottom - r.top + 6) + 'px' }); return true; }
    const al = hit('[data-calertset]'); if (al) { CS.draft.alert = +al.dataset.calertset; calClose(); calDraftCard(); return true; }
    const ce = hit('[data-cev]'); if (ce) { const id = +ce.dataset.cev; CS.sel = CS.sel === id && !hit('#cal-det') ? null : id; CS.day = EVS.find(x => x.id === id)?.o ?? CS.day; CS.panel = true; CS.pick = true; $$('#cal-body [data-cev]').forEach(x => x.classList.toggle('on', +x.dataset.cev === CS.sel)); $$('#cal-body .cmd').forEach(x => x.classList.remove('on')); calDet(); return true; }
    const dp = hit('[data-cdayp]'); if (dp && calNarrow() && CS.view === 'month') { const o = +dp.dataset.cdayp; CS.sel = null; CS.day = o; if (dOf(o).getMonth() !== dOf(CS.anchor).getMonth()) CS.anchor = o; calBody(false); calHead(); return true; }
    if (dp) { const o = +dp.dataset.cdayp; CS.sel = null; CS.day = o; CS.panel = true; CS.pick = true; $$('#cal-body .cmd').forEach(x => x.classList.toggle('on', +x.dataset.cdayp === CS.day)); $$('#cal-body [data-cev]').forEach(x => x.classList.remove('on')); calDet(); return true; }
    const nw = hit('[data-cnewon]'); if (nw) { const o = +nw.dataset.cnewon; CS.draft = { o, s: 600, e: 660, t: '', people: [], cal: 'personal', alert: 10 }; calBar(); return true; }
    const rv = hit('[data-crsvp]'); if (rv) { CS.rsvp[CS.sel] = rv.dataset.crsvp; calDet(); calToast({ yes: 'You’re going', maybe: 'You might go', no: 'You can’t go. We’ll let them know.' }[rv.dataset.crsvp]); return true; }
    if (hit('[data-cmore]')) { const r = hit('[data-cmore]').getBoundingClientRect(), w = $('#w-calendar'), wr = w.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop'; p.style.width = '210px';
      p.innerHTML = `<button class="mi" type="button" data-ctodo="Duplicated">${ic('copy')}<span>Duplicate</span></button><button class="mi" type="button" data-ctodo="Link copied">${ic('link')}<span>Copy link</span></button><hr><button class="mi danger" type="button" data-cdel>${ic('trash-2')}<span>Delete event</span></button>`;
      w.appendChild(p); Object.assign(p.style, { right: (wr.right - r.right) + 'px', top: (r.bottom - wr.top + 6) + 'px' }); return true; }
    if (hit('[data-cjump]')) { if ($('#w-calendar .cjpop2')) { calClose(); return true; } calClose(); const r = hit('[data-cjump]').getBoundingClientRect(), w = $('#w-calendar'), wr = w.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop cjpop2'; CS.jy = dOf(CS.anchor).getFullYear();
      w.appendChild(p); cjDraw(p); Object.assign(p.style, { left: (r.left - wr.left) + 'px', top: (r.bottom - wr.top + 8) + 'px' }); return true; }
    const jy = hit('[data-cjy]'); if (jy) { CS.jy = +jy.dataset.cjy; cjDraw($('#w-calendar .cjpop2')); return true; }
    const jm = hit('[data-cjm]'); if (jm) { const t = new Date(CS.jy, +jm.dataset.cjm, 1); CS.anchor = Math.round((t - CBASE) / 864e5); CS.view = CS.view === 'flow' ? 'month' : CS.view; calClose(); calBody(); calBar(); return true; }
    if (hit('[data-cclose]')) { CS.panel = false; CS.pick = false; try { localStorage.setItem('luma70-cal-panel', '0'); } catch (x) {} calDet(); return true; }
    const hd = hit('[data-chold]'); if (hd) { const [o, s, en] = hd.dataset.chold.split(':').map(Number); CS.draft = { o, s, e: Math.min(en, s + 60), t: 'Focus time', people: [], cal: 'personal' }; calBar(); return true; }
    const go = hit('[data-cgo]'); if (go) { CS.anchor = +go.dataset.cgo; CS.view = 'flow'; calBody(); calBar(); return true; }
    const sl = hit('[data-cslot]'); if (sl && !hit('.cev')) { const r = sl.getBoundingClientRect(), m = Math.round(((e.clientY - r.top) / PXM + DS) / 30) * 30; CS.draft = { o: +sl.dataset.cslot, s: m, e: m + 60, t: '', people: [], cal: 'personal' }; calBar(); return true; }
    if (hit('[data-cdraftx]')) { const d = CS.draft; CS.draft = null; CS.dq = ''; calBar(); calToast('Draft discarded', { icon: 'trash-2', undo: () => { CS.draft = d; calBar(); } }); return true; }
    const cp = hit('[data-cdpick]'); if (cp) { const k = cp.dataset.cdpick, d = CS.draft, opts = k === 'o' ? Array.from({ length: 8 }, (_, i) => [TODAY + i, i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtD(TODAY + i)]) : CDTIMES.filter(t => k === 'e' ? t > d.s : true).map(t => [t, fmtT(t)]);
      calClose(); const w = $('#w-calendar'), wr = w.getBoundingClientRect(), r = cp.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop cdpop'; p.innerHTML = opts.map(([v, n]) => `<button class="mi${v === d[k] ? ' on' : ''}" type="button" data-cdset="${k}:${v}"><span>${n}</span></button>`).join(''); w.appendChild(p);
      Object.assign(p.style, { left: (r.left - wr.left) + 'px', bottom: (wr.bottom - r.top + 6) + 'px' }); p.querySelector('.on')?.scrollIntoView({ block: 'center' }); return true; }
    const cds = hit('[data-cdset]'); if (cds) { const [k, v] = cds.dataset.cdset.split(':'), d = CS.draft, len = d.e - d.s; d[k] = +v; if (k === 's') d.e = Math.min(24 * 60, d.s + len); calClose(); calDraftCard(); return true; }
    const cda = hit('[data-cdadd]'); if (cda) { CS.draft.people.push(cda.dataset.cdadd); CS.dq = ''; calDraftCard(); $('#cal-draft [data-cdq]')?.focus(); return true; }
    const cdr = hit('[data-cdrm]'); if (cdr) { CS.draft.people = CS.draft.people.filter(k => k !== cdr.dataset.cdrm); calDraftCard(); return true; }
    if (hit('[data-cdraftok]')) { const d = CS.draft; const n = ev(d.o, d.s, d.e, d.t || 'New event', d.cal, { people: d.people, ...(d.loc ? { loc: d.loc } : {}) }); EVS.push(n); CS.draft = null; CS.dq = ''; CS.anchor = d.o; calBody(); calBar(); requestAnimationFrame(() => $$(`#cal-body [data-cev="${n.id}"]`).forEach(x => { x.classList.add('cfresh'); x.scrollIntoView({ block: 'nearest' }); })); calToast(`Added “${esc(n.t)}” on ${fmtD(n.o)} at ${fmtT(n.s)}${n.people?.length ? '. Invites sent.' : ''}`, { icon: 'calendar' }); return true; }
    if (hit('[data-ccalpick]')) { const r = hit('[data-ccalpick]').getBoundingClientRect(), w = $('#w-calendar'), wr = w.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop'; p.style.width = '200px';
      p.innerHTML = Object.entries(CALS).filter(([k]) => k !== 'hol').map(([k, [n, h]]) => `<button class="mi" type="button" data-ccalset="${k}" style="--eh:${h}"><i class="cdot round"></i><span>${n}</span>${CS.draft.cal === k ? `<span class="end">${ic('check')}</span>` : ''}</button>`).join(''); w.appendChild(p); Object.assign(p.style, { left: (r.left - wr.left) + 'px', bottom: (wr.bottom - r.top + 10) + 'px' }); return true; }
    const cs = hit('[data-ccalset]'); if (cs) { CS.draft.cal = cs.dataset.ccalset; calClose(); calBar(); return true; }
    if (hit('[data-ccals]')) { const r = hit('[data-ccals]').getBoundingClientRect(), w = $('#w-calendar'), wr = w.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop ccalpop';
      p.innerHTML = `<h6>Calendars</h6>${Object.entries(CALS).map(([k, [n, h]]) => `<button class="mi" type="button" data-ctog="${k}" style="--eh:${h}"><i class="cchk${CS.off[k] ? '' : ' on'}"></i><span>${n}</span>${lCount(EVS.filter(e => e.cal === k).length)}</button>`).join('')}<hr><button class="mi" type="button" data-ctodo="Subscribe to a calendar">${ic('plus')}<span>Add a calendar</span></button>`;
      w.appendChild(p); Object.assign(p.style, { right: (wr.right - r.right) + 'px', top: (r.bottom - wr.top + 8) + 'px' }); return true; }
    const tg = hit('[data-ctog]'); if (tg) { const k = tg.dataset.ctog; CS.off[k] = !CS.off[k]; tg.querySelector('.cchk').classList.toggle('on', !CS.off[k]); calBody(false); return true; }
    if (hit('[data-cdel]')) { calClose(); const i = EVS.findIndex(x => x.id === CS.sel), gone = EVS[i]; EVS.splice(i, 1); CS.sel = null; calDet(); calBody(false); calToast(`Deleted “${esc(gone.t)}”`, { icon: 'trash-2', undo: () => { EVS.splice(i, 0, gone); CS.sel = gone.id; calBody(false); calDet(); } }); return true; }
    const td = hit('[data-ctodo]'); if (td) { calClose(); calToast(td.dataset.ctodo); return true; }
    return false; }
  const MOON = SVG['moon'];
  Object.assign(SVG, { calendar: SVG.calendar });
  (() => { document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'calendar' || e.target.closest('input')) return; const k = e.key.toLowerCase();
      if (k === 'escape') { calClose(); if (CS.draft) { CS.draft = null; calBar(); } else if (CS.sel != null) { CS.sel = null; calDet(); calBody(false); } }
      else if (k === 't') { CS.anchor = TODAY; calBody(); } else if (k === 'n' || k === 'c') { e.preventDefault(); $('#cal-q')?.focus(); }
      else if (['1', '2', '3'].includes(k)) { CS.view = ['flow', 'week', 'month'][+k - 1]; calBody(); calBar(); } });
    new ResizeObserver(() => { const ph = $('#w-calendar').classList.contains('phone'), nw = calNarrow(); if (ph !== CS.wasPhone) { CS.wasPhone = ph; CS.pick = false; calDet(); calHead(); }
      if (nw !== CS.wasNarrow) { CS.wasNarrow = nw; CS.compose = false; calHead(); calBar(); calBody(false); } }).observe($('#w-calendar .ibody'));
    /* a sideways swipe on the month moves a month */
    let sx = null; $('#cal-body').addEventListener('pointerdown', e => { if (e.target.closest('[data-cswipe]')) sx = [e.clientX, e.clientY]; });
    addEventListener('pointerup', e => { if (!sx) return; const dx = e.clientX - sx[0], dy = e.clientY - sx[1]; sx = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) calStep(dx < 0 ? 1 : -1); }); })();
  /* one step back or on: a month, a week (three days when narrow), or a day */
  function calStep(k) { if (CS.view === 'month') { const a = dOf(CS.anchor), t = new Date(a.getFullYear(), a.getMonth() + k, 1); CS.anchor = Math.round((t - CBASE) / 864e5); CS.day = null; }
    else CS.anchor += CS.view === 'week' ? k * (calNarrow() ? 3 : 7) : k; calBody(); }
  function calTrack() { if (CS.view !== 'flow') return; const b = $('#cal-body'), top = b.scrollTop + 90; let at = 0; $$('#cal-body .cday').forEach(d => { if (d.offsetTop <= top) at = +d.dataset.cday; }); if (at !== CS.flowAt) { CS.flowAt = at; calHead(); } }
