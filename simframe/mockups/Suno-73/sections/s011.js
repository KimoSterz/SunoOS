    requestAnimationFrame(() => { $('#lc-scrim')?.classList.add('on'); $('#lc')?.classList.add('on'); $('#lc [data-lui-cno]')?.focus(); }); }
  lConfirm.close = quiet => { $('#lc-scrim')?.remove(); $('#lc')?.remove(); const r = lConfirm.ret; lConfirm.ret = null; if (!quiet && r?.isConnected) r.focus?.(); };
  document.addEventListener('keydown', e => { const d = $('#lc'); if (!d) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); lConfirm.close(); return; }
    if (e.key === 'Tab') { const f = [...d.querySelectorAll('button')], i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } }, true);

  /* SunoUI: Category pill. lCat('media'): the category's own colour from the shared map (--cat-*). */
  const LCAT = { create: 'Create', work: 'Work', media: 'Media', play: 'Play', tools: 'Tools' };
  const lCat = k => `<span class="lcat" data-cat="${k}">${esc(LCAT[k] || k)}</span>`;

  /* SunoUI: Table header. lTHead([[key, label, cls]], { k, dir }, 'data-x'): a recessed bar; each heading sorts, again reverses. */
  const lTHead = (cols, sort, attr) => `<thead class="lthead"><tr>${cols.map(([k, n, cls = '']) => { const on = sort && sort.k === k; return `<th class="${cls}" scope="col" aria-sort="${on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" ${attr}="${k}">${esc(n)}${on ? ic(sort.dir > 0 ? 'arrow-up' : 'arrow-down') : ''}</button></th>`; }).join('')}</tr></thead>`;

  /* SunoUI: Sidebar foot. lFoot({ q: { attr, ph, value }, filter: { items: [[key, label, icon]], cur, attr }, add: { attr, label, icon }, sug: { id, html } }).
     The filter's menu opens upward; when a filter is on the button lights and the list names it with lFiltHead(label, attr, allKey). */
  function lFoot(o) { const f = o.filter, cur = f && (f.items.find(x => x[0] === f.cur) || f.items[0]);
    return `<div class="shead sfoot lfoot">${o.sug ? `<div class="lsug" ${o.sug.id ? `id="${o.sug.id}"` : ''} role="listbox" aria-label="Places"${o.sug.html ? '' : ' hidden'}>${o.sug.html || ''}</div>` : ''}<label class="srch">${ic('search')}<input ${o.q.attr} placeholder="${esc(o.q.ph)}" aria-label="${esc(o.q.ph)}" value="${esc(o.q.value || '')}" autocomplete="off" spellcheck="false"></label>${f ? `<button class="snew lfilt${cur !== f.items[0] ? ' on' : ''}" type="button" data-lui-filter="${esc(JSON.stringify(f))}" title="Show: ${esc(cur[1])}" aria-label="Show: ${esc(cur[1])}" aria-haspopup="menu">${ic('list-filter')}</button>` : ''}${o.add ? `<button class="snew" type="button" ${o.add.attr} title="${esc(o.add.label)}" aria-label="${esc(o.add.label)}">${ic(o.add.icon || 'plus')}</button>` : ''}</div>`; }
  const lFiltHead = (label, attr, allKey) => `<div class="lfhead"><span>${esc(label)}</span><button type="button" ${attr}="${allKey}">Show all</button></div>`;

  /* SunoUI: Place search. lPlaceSug(query, selected, attr) fills the list above the foot field: resolved places, or "No places match". */
  const LPLACES = [['kc', 'Kansas City', 'MO', '64105', 2, 21], ['nyc', 'New York', 'NY', '10001', 3, 40], ['chi', 'Chicago', 'IL', '60601', 2, 27], ['sea', 'Seattle', 'WA', '98101', 0, 150],
    ['aus', 'Austin', 'TX', '78701', 2, 30], ['den', 'Denver', 'CO', '80202', 1, 60], ['lon', 'London', 'United Kingdom', '', 8, 200], ['par', 'Paris', 'France', '', 9, 210], ['ber', 'Berlin', 'Germany', '', 9, 220],
    ['syd', 'Sydney', 'Australia', '', 17, 90], ['mex', 'Mexico City', 'Mexico', '', 1, 45], ['tor', 'Toronto', 'Canada', '', 3, 180], ['kcks', 'Kansas City', 'KS', '66101', 2, 21], ['sf', 'San Francisco', 'CA', '94103', 0, 240]]
    .map(([id, n, r, zip, off, h]) => ({ id, n, r, zip, off, h }));
  const lPlaceFind = q => { q = q.trim().toLowerCase(); return q ? LPLACES.filter(p => `${p.n} ${p.r} ${p.zip}`.toLowerCase().includes(q) || (p.zip && p.zip.startsWith(q))).slice(0, 5) : []; };
  const lPlaceSug = (q, sel = 0, attr = 'data-lui-place') => { const l = lPlaceFind(q); return l.length ? l.map((p, i) => `<button class="lsugi${i === sel ? ' on' : ''}" type="button" role="option" aria-selected="${i === sel}" ${attr}="${p.id}">${ic('map-pin')}<span><b>${esc(p.n)}, ${esc(p.r)}</b>${p.zip ? `<small>${p.zip}</small>` : ''}</span>${i === sel ? '<kbd>Return</kbd>' : ''}</button>`).join('') : '<p class="lsugnone">No places match</p>'; };

  /* SunoUI: Navigation trail (G3, 25 Sep). lTrail({ back: { label, attr }, title, meta: [..] }): where you came from, inline with where you are,
     "‹ Albums · 12 albums" on one line. Before a title the chevron stands alone (its name says where it goes); with no title it carries the name. */
  const lTrail = o => { const b = o.back, m = (o.meta || []).filter(Boolean); return `<nav class="lnt" aria-label="Navigation">${b ? `<button class="lntb${o.title ? ' ico' : ''}" type="button" ${b.attr} title="Back to ${esc(b.label)}" aria-label="Back to ${esc(b.label)}">${ic('chevron-left')}${o.title ? '' : `<span>${esc(b.label)}</span>`}</button>` : ''}${o.title ? `<h1>${esc(o.title)}</h1>` : ''}${m.length ? `<span class="lntm">${m.map((p, i) => `${o.title || i ? '<i class="d"></i>' : ''}<span>${p}</span>`).join('')}</span>` : ''}</nav>`; };
  /* SunoUI: Field (G3). lField(label, inputAttrs, value): a label over a recessed well; lfhint for the line under it. */
  const lField = (label, attr = '', v = '') => `<label class="lfld"><span>${esc(label)}</span><input ${attr} value="${esc(v)}"></label>`;
  /* SunoUI: Table header on grid rows. lTHead.grid([[key, label, cls]], { k, dir }, 'data-x', cls): the same recessed, sortable bar for lists
     laid out as grid or flex rows (Tide, Monitor, Disks, the file picker). A column with no key is a plain label (or an empty cell). */
  lTHead.grid = (cols, sort, attr, cls = '') => `<div class="lthgrid${cls ? ' ' + cls : ''}">${cols.map(([k, n = '', c = '']) => { if (!k) return `<span class="${c}">${esc(n)}</span>`; const on = sort && sort.k === k;
    return `<button type="button" class="${c}" ${attr}="${k}" aria-sort="${on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${esc(n)}${on ? ic(sort.dir > 0 ? 'arrow-up' : 'arrow-down') : ''}</button>`; }).join('')}</div>`;

  /* SunoUI: Sidebar toggle. lSideBtn(win) is the one control that hides and shows a window's sidebar: Lucide panel-left in the title bar,
     just after the app's name, F9 (as GNOME Files), the sidebar sliding closed with the window's ease. Remembered per window (lSideOn(win)
     at render). Each app says what "closed" means in its CSS (.lsideoff). On a phone it opens the sidebar as a drawer (.navopen) instead. */
  function lSideKey(w) { return 'luma70-side-' + w.id; }
  function lSideOn(w) { try { return localStorage.getItem(lSideKey(w)) !== '0'; } catch (e) { return true; } }
  function lSideBtn(w) { const on = !w.classList.contains('lsideoff'), l = on ? 'Hide sidebar' : 'Show sidebar'; return `<button class="ib lsidebtn" type="button" data-lside aria-pressed="${on}" aria-label="${l}" title="${l} (F9)" aria-keyshortcuts="F9">${ic('panel-left')}</button>`; }
  function lSide(w, on) { if (!w) return; if (w.classList.contains('phone') && w.clientWidth < 600) { w.classList.toggle('navopen'); return; } on = on ?? w.classList.contains('lsideoff'); w.classList.toggle('lsideoff', !on);
    try { localStorage.setItem(lSideKey(w), on ? '1' : '0'); } catch (e) {} w.querySelectorAll('.lsidebtn').forEach(b => b.outerHTML = lSideBtn(w)); }
  desk.addEventListener('click', e => { const b = e.target.closest('[data-lside]'); if (b) { e.stopPropagation(); lSide(b.closest('.win')); return; } const w = e.target.closest('.win.navopen'); if (w && e.target.closest('.vside :is([data-vtab], [data-vopen], [data-vnew]), :is(.dpside, .cfside) .si, .nside [data-nopen]:not(:has([data-ntw]:hover)), .vwside [data-vwopen]')) w.classList.remove('navopen');
    else if (w?.classList.contains('phone') && w.querySelector('.lsidebtn') && !e.target.closest('.vside, .dpside, .cfside, .nside, .vwside, .rail, .pside, [data-navtoggle], #lmenu')) w.classList.remove('navopen');   /* a tap beside the drawer closes it */ }, true);
  document.addEventListener('keydown', e => { if (e.key !== 'F9' || e.ctrlKey || e.metaKey || e.altKey) return; const w = front(); if (w?.querySelector('.lsidebtn')) { e.preventDefault(); lSide(w); } });

  /* SunoUI: Title island. On a phone, ☰ and the name of what you're looking at are ONE island: the menu glyph, a title, a line under it.
     Tap it for the sidebar. lNavTtl(win, title, sub); a null title puts the plain ☰ back. Use it wherever a place needs naming beside ☰. */
  document.addEventListener('scroll', e => { const t = e.target; if (t?.matches?.('.crnav, .pside')) t.closest('.win')?.classList.toggle('islscrolled', t.scrollTop > 2); }, true);   // the grown island's header shadows a scrolled list
  document.addEventListener('click', e => { const b = e.target.closest?.('#w-filer.navopen .fisl button'); if (b) { e.stopPropagation(); e.preventDefault(); b.closest('.win').classList.remove('navopen'); } }, true);   // the grown Filer island: either half closes it
  function lNavTtl(w, t, sub) { const b = w?.querySelector('.navbtn'); if (!b) return;
    if (!t) { if (b.classList.contains('hasttl')) { b.classList.remove('hasttl'); b.innerHTML = SVG.menu; b.setAttribute('aria-label', 'Places'); } return; }
    b.classList.add('hasttl'); b.innerHTML = `${SVG.menu}<span class="lnt"><b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`; b.setAttribute('aria-label', `${t}. Show the sidebar`); }

  /* SunoUI: Toast. lToast(win, msg, { icon: 'check' | 'map-pin' | 'heart' | 'copy' | 'trash-2' …, undo: fn }). One place: centred on the visible
     island, just above its bottom bar. Plain text; announced to screen readers; 4 s when it can be undone. */
  function lToast(w, msg, o = {}) { if (!w) return; if (typeof o === 'function') o = { undo: o };
    let t = w.querySelector(':scope > .ltoast'); if (!t) { w.insertAdjacentHTML('beforeend', '<div class="ftoast ltoast" role="status" aria-live="polite"></div>'); t = w.querySelector(':scope > .ltoast'); }
    const k = o.icon || 'check', wr = w.getBoundingClientRect(), isle = [...w.querySelectorAll('.main.isle'), ...w.querySelectorAll('.isle')].find(x => x.offsetWidth > 200) || w, ir = isle.getBoundingClientRect();
    /* clear whatever sits at the foot, a grown bar included (its panel is part of it), so the toast is never behind it */
    const bars = [...w.querySelectorAll('.fbar, .mbar, .lac, .lacsplit, .cr2c')].filter(b => b.offsetWidth && !b.hidden).map(b => b.getBoundingClientRect()).filter(b => ir.bottom - b.bottom < 48 && (b.height < 320 || w.classList.contains('phone')));
    const top = bars.length ? Math.min(...bars.map(b => b.top)) - 12 : ir.bottom - 18;
    t.dataset.kind = k; t.innerHTML = `${ic(k)}<span>${msg}</span>${o.undo ? '<button class="bt sm fill" type="button" data-lui-undo>Undo</button>' : ''}`;
    t.style.left = Math.round(ir.left + ir.width / 2 - wr.left) + 'px'; t.style.bottom = Math.round(wr.bottom - top) + 'px';
    lToast.undo = o.undo || null; lToast.el = t; t.classList.add('on'); clearTimeout(lToast.t); lToast.t = setTimeout(() => { t.classList.remove('on'); lToast.undo = null; }, o.undo ? 4000 : 2400); }

  /* SunoUI clicks: the shared parts' own buttons (dialog, toast Undo, Open in, filter picker, contact actions). Returns true when handled. */
  function luiClick(e, hit) { const win = e.target.closest('.win');
    if (hit('[data-lui-cno]')) { lConfirm.close(); return true; }
    if (hit('[data-lui-cok]')) { const o = lConfirm.o, opt = $('#lc [data-lui-copt]')?.getAttribute('aria-checked') === 'true'; lConfirm.close(); o?.onOK?.(opt); return true; }
    if (hit('[data-lui-copt]')) { const c = hit('[data-lui-copt]'); c.setAttribute('aria-checked', c.getAttribute('aria-checked') === 'true' ? 'false' : 'true'); return true; }
    if (hit('#lc-scrim')) { const d = $('#lc'); d?.classList.remove('nudge'); void d?.offsetWidth; d?.classList.add('nudge'); return true; }
    if (hit('[data-lui-undo]')) { const u = lToast.undo; lToast.undo = null; lToast.el?.classList.remove('on'); u?.(); return true; }
    const op = hit('[data-lui-open]'); if (op) { $('#lmenu')?.remove(); if (op.closest('#f-bar')) setTimeout(() => { F.selExp = null; filerBar(); }, 0); const a = op.dataset.luiOpen, n = op.dataset.luiName; lToast(win, a === 'other' ? 'Choose an app to open it with' : `Opening ${n ? n + ' ' : ''}in ${cfName(a)}`, { icon: a === 'other' ? 'app-window' : 'square-arrow-out-up-right' }); return true; }
    const fl = hit('[data-lui-filter]'); if (fl) { if ($('#lmenu') && luiClick.m === fl) { $('#lmenu').remove(); luiClick.m = null; return true; } luiClick.m = fl; const f = JSON.parse(fl.dataset.luiFilter);
      lMenu(fl, `<h6>Show</h6>${f.items.map(([k, l, i]) => crMi(`${f.attr}="${k}"`, i, l, k === f.cur ? ' on' : '')).join('')}`); $('#lmenu')?.classList.add('lfiltmenu', 'ldrawer'); return true; }
    if (hit('#lmenu.lfiltmenu .crmi')) setTimeout(() => $('#lmenu.lfiltmenu')?.remove());
    const ca = hit('[data-lui-ca]'); if (ca) { if (win?.luiCA?.(ca.dataset.luiCa, ca.dataset.luiP)) return true; const p = ppl(ca.dataset.luiP), f = (p?.n || '').split(' ')[0]; lToast(win, { message: `Opening your conversation with ${f} in Messages`, call: `Calling ${f}…`, video: `Video calling ${f}…`, email: `New email to ${f} in Charlie` }[ca.dataset.luiCa], { icon: { message: 'message-square', call: 'phone', video: 'video', email: 'mail' }[ca.dataset.luiCa] }); return true; }
    const td = hit('[data-lui-todo]'); if (td) { lToast(win, td.dataset.luiTodo); return true; }
    return false; }
  /* A details pane closes with Esc (unless it's the app's main view) */
  document.addEventListener('keydown', e => { if (e.key !== 'Escape' || e.defaultPrevented || $('#lc, #lmenu')) return; const b = front()?.querySelector('.ldp:not([hidden]):not([data-main]) .ldph [aria-label="Close"]'); if (b && !e.target.closest?.('input, textarea, [contenteditable]')) b.click(); });

  /* ══ The SunoUI window: every shared part, its states, and where it's used ══ */
  const LUI = { side: true, gsort: { k: 'title', dir: 1 }, sort: { k: 'name', dir: 1 }, det: true, ac: 'bar', mode: 'view', filter: 'all', q: '', qi: 0, sel: 'Receipts.grid' };
  const LUISECS = [['type', 'Type scale', 'type'], ['count', 'Count badge', 'hash'], ['details', 'Details pane', 'panel-right'], ['stack', 'Stacked button', 'square-stack'], ['parity', 'Mini cards', 'users'],
    ['bubble', 'Selection bubble', 'highlighter'], ['ac', 'Action center', 'panel-bottom'], ['place', 'Placement and modes', 'layout-template'], ['open', 'Open in', 'square-arrow-out-up-right'], ['file', 'File card', 'file-text'],
    ['confirm', 'Destructive dialog', 'triangle-alert'], ['toast', 'Toast', 'check'], ['cat', 'Category pill', 'tag'], ['table', 'Table header', 'table'], ['foot', 'Sidebar foot', 'list-filter'],
    ['psearch', 'Place search', 'map-pin'], ['acct', 'Account card', 'user'], ['sky', 'Lit backgrounds', 'sun'], ['share', 'Share, Export, Upload', 'share-2'],
    ['side', 'Sidebar toggle', 'panel-left'], ['menu', 'Menu drawer', 'menu'], ['trail', 'Navigation trail', 'chevron-left'], ['field', 'Field', 'text-cursor-input'], ['stat', 'Status dot', 'circle-dot'], ['msg', 'Message bubble', 'message-square']];
  function luiDetails() { const c = { n: 'Launch crew' };
    return `<aside class="ldp" id="lui-dp" aria-label="Details"${LUI.det ? '' : ' hidden'}>${lDP({ title: 'Details', close: 'data-luidet', body:
      `<div class="ldphero">${cvAv(CONVOS[0], 64)}<b>${c.n}</b><small>4 people</small></div>
      ${lDP.lab('Conversation')}${lDP.kv([['Created', 'Sep 2'], ['Encryption', 'End-to-end'], ['Notifications', 'On']])}
      ${lDP.lab('People')}<div class="ldplist">${['PR', 'NF', 'SK'].map(k => lDP.row({ av: av(k, 32), n: ppl(k).n, sub: '@' + ppl(k).u, attr: `data-lui-todo="Opening ${esc(ppl(k).n)} in Contacts"`,
        acts: lDP.act('message-square', 'Message ' + ppl(k).n.split(' ')[0], `data-lui-ca="message" data-lui-p="${k}"`) + lDP.act('phone', 'Call', `data-lui-ca="call" data-lui-p="${k}"`) })).join('')}${lAddRow('Add people', 'data-lui-todo="Type a name or @username"')}</div>
      ${lDP.lab('Also with these people')}<div class="ldplist">${lDPItem({ lead: ic('mail'), n: 'Press kit review', sub: 'Priya · Tuesday', attr: 'data-lui-todo="Opening the thread in Charlie"' })}${lDPItem({ lead: ic('calendar'), n: 'Launch rehearsal', sub: 'Sep 29 · 10:00 AM', attr: 'data-lui-todo="Opening the event in Calendar"' })}</div>
      ${lDP.lab('Photos and files', '<button type="button" data-lui-todo="All 48 photos and 6 files">View all</button>')}<div class="ldpph">${['life-sync-terrace.webp', 'life-hero-studio.webp', 'life-ari-street.webp'].map(f => `<img src="${PH + f}" alt="">`).join('')}</div><div style="height:8px"></div>${lFile({ n: 'launch-deck.stage', k: 'deck', sz: '18.4 MB' }, { open: 'data-lui-todo="Opening launch-deck.stage in Stage"' })}
      ${lStack([{ icon: 'log-out', label: 'Leave', attr: 'data-luileave' }, { icon: 'trash-2', label: 'Delete', attr: 'data-luidel', danger: true }])}` })}</aside>`; }
  function luiAC() { const s = LUI.ac, field = `<button class="lacfield" type="button" data-luiac="editor">${LUI.draft ? 'Draft: ' + esc(LUI.draft.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()) : 'Reply to Priya and Nora…'}</button><button class="ib" type="button" title="Attach" aria-label="Attach">${ic('paperclip')}</button>`;
    if (s === 'editor') return `<div class="lac enter" id="lui-lac"><div class="lach"><button class="lacmode" type="button">${ic('reply-all')}Reply all${ic('chevron-down')}</button><span>to <b>Priya Raman, Nora Feld</b></span></div>
      <div class="lactools"><button class="ib" type="button" title="Bold">${ic('bold')}</button><button class="ib" type="button" title="Italic">${ic('italic')}</button><button class="ib" type="button" title="Underline">${ic('underline')}</button><span class="vr"></span><button class="ib" type="button" title="Bulleted list">${ic('list')}</button><button class="ib" type="button" title="Link">${ic('link')}</button><span class="sp"></span><button class="ib" type="button" title="Attach">${ic('paperclip')}</button></div>
      <div class="laced" contenteditable="true" data-ph="Write your reply">${LUI.draft || ''}</div><div class="lacft"><button class="ib" type="button" title="Discard" aria-label="Discard" data-luiac="bar">${ic('trash-2')}</button><span class="sp"></span><small>Esc to fold · ⌘ Return</small><button class="bt key" type="button" data-luiac="bar">${ic('send-horizontal')}Send</button></div></div>`;
    if (s === 'double') return `<div class="fbar lac2"><div class="lacctx">${ic('reply')}<span>Replying to <b>Priya’s</b> message</span></div><div class="lacrow">${field}</div></div>`;
    if (s === 'split') return `<div class="lacsplit"><div class="fbar"><span class="ctxc">${ic('image')}3 photos</span><button class="bt" type="button">${ic('share-2')}Share</button></div><div class="fbar"><button class="bt" type="button">${ic('heart')}Favorite</button><button class="ib" type="button" title="Delete" aria-label="Delete">${ic('trash-2')}</button></div></div>`;
    return `<div class="fbar"><div class="lacrow" style="width:min(560px, calc(100cqw - 72px))">${field}</div></div>`; }
  function luiPlace() { const tools = LUI.mode === 'markup' ? `<button class="ib on" type="button" title="Pen">${ic('pen-tool')}</button><button class="ib" type="button" title="Highlight">${ic('highlighter')}</button><button class="ib" type="button" title="Text">${ic('type')}</button><button class="ib" type="button" title="Shapes">${ic('square')}</button>`
      : LUI.mode === 'adjust' ? `<button class="bt" type="button">${ic('crop')}Crop</button><button class="ib" type="button" title="Rotate">${ic('rotate-ccw')}</button><button class="bt" type="button">${ic('wand-sparkles')}Auto</button>`
      : `<button class="ib" type="button" title="Zoom out" aria-label="Zoom out">${ic('minus')}</button><span class="count">100%</span><button class="ib" type="button" title="Zoom in" aria-label="Zoom in">${ic('plus')}</button><button class="bt" type="button">Fit</button>`;
    return `<div class="flo lcorner">${lModes([['view', 'View', 'eye'], ['markup', 'Mark up', 'pen-line'], ['adjust', 'Adjust', 'sliders-horizontal']], LUI.mode, 'data-luimode')}<button class="ib" type="button" data-luiopenin title="Open in" aria-label="Open in">${ic('square-arrow-out-up-right')}</button><button class="ib" type="button" data-share title="Share" aria-label="Share">${ic('share-2')}</button><button class="ib" type="button" title="Information" aria-label="Information">${ic('info')}</button></div><div class="fbar">${tools}</div>`; }
  function luiFootDemo() { const all = [['Launch dry run', 'Today, 9:52 AM', 1], ['Idea: notifications as a lip', 'Today, 8:14 AM', 0], ['Call with Theo', 'Yesterday', 0], ['Saturday dinner playlist', 'Monday', 1]], names = { all: 'All memos', fav: 'Favorites', deleted: 'Recently deleted' };
    const l = LUI.filter === 'fav' ? all.filter(x => x[2]) : LUI.filter === 'deleted' ? [['Old idea', '28 days left', 0]] : all;
    return `<div class="luiside"><div class="scr">${LUI.filter !== 'all' ? lFiltHead(names[LUI.filter], 'data-luifilt', 'all') : ''}${l.map(([t, s], i) => `<div class="luirow${i ? '' : ' on'}" style="height:44px;width:100%"><span style="display:grid"><b style="font-weight:600;color:var(--ink)">${t}</b><small class="t-caption">${s}</small></span></div>`).join('')}</div>
      ${lFoot({ q: { attr: 'data-luifq', ph: 'Search what was said' }, filter: { items: [['all', 'All', 'layers'], ['fav', 'Favorites', 'star'], ['deleted', 'Recently deleted', 'trash-2']], cur: LUI.filter, attr: 'data-luifilt' } })}</div>
      <div class="luiside"><div class="scr"><div class="luirow on" style="width:100%">${ic('inbox')}<span>Inbox</span>${lCount(2, true)}</div><div class="luirow" style="width:100%">${ic('file-text')}<span>Drafts</span>${lCount(1)}</div><div class="luirow" style="width:100%">${ic('send-horizontal')}<span>Sent</span></div>${lAddRow('Add account', 'data-lui-todo="Account setup opens: your Suno account first, then others"', 'plus')}</div>
      ${lFoot({ q: { attr: 'data-luifq2', ph: 'Search mail' }, add: { attr: 'data-lui-todo="New email"', label: 'New email', icon: 'square-pen' } })}</div>`; }
  function luiSug() { const s = $('#lui-sug'); if (!s) return; s.hidden = !LUI.q.trim(); s.innerHTML = LUI.q.trim() ? lPlaceSug(LUI.q, LUI.qi, 'data-luiplace') : ''; }
  function renderLumaUI() { const w = $('#w-lumaui'); if (!w) return; $('#lui-top').innerHTML = `<img src="${FAV}" alt=""><b>SunoUI</b><span class="chev">${ic('chevron-down')}</span>`;
    $('#lui-nav').innerHTML = `<h6>Components</h6>${LUISECS.map(([k, n, i]) => `<button type="button" data-luigo="${k}">${ic(i)}<span>${n}</span></button>`).join('')}`;
    const sec = (k, h, p, body) => `<section class="luisec" id="lui-${k}"><h2>${h}</h2><p>${p}</p>${body}</section>`, file = (f, o) => lFile(f, o);
    $('#lui-body').innerHTML = `<div class="luipad"><header><h1>SunoUI</h1><p>The shared parts from the Studio audit. Apps use these; they don't restyle them.</p></header>
      ${sec('type', 'Type scale', 'Figtree, five roles and a label. Numbers that change are tabular. <code>.t-display</code> <code>.t-title-1</code> <code>.t-title-2</code> <code>.t-body</code> <code>.t-caption</code> <code>.t-label</code> <code>.t-numeric</code>, or the <code>--t-*</code> tokens.',
        `<div class="luistage col luitype"><div><code>display 72/600</code><span class="t-display">9:41<small>:07 AM</small></span></div><div><code>title 1 · 24/650</code><span class="t-title-1">Launch walkthrough</span></div><div><code>title 2 · 15/650</code><span class="t-title-2">Lisbon</span></div><div><code>body · 13/400</code><span class="t-body">Light rain from around 6 PM, gone by 9 PM.</span></div><div><code>numeric · 30/500</code><span class="t-numeric">1,248<small>mph</small></span></div><div><code>caption · 11.5/500</code><span class="t-caption">Today · +3 h</span></div><div><code>label · 11.5/600</code><span class="t-label">People</span></div></div>`)}
      ${sec('count', 'Count badge', 'A pill with tabular numbers: neutral for totals, accent for unread or needs attention; never 0. <code>lCount(n, accent)</code>. Used in Charlie’s sidebar and filter.',
        `<div class="luistage col"><div class="luirow on">${ic('inbox')}<span>Inbox</span>${lCount(3, true)}</div><div class="luirow">${ic('file-text')}<span>Drafts</span>${lCount(1)}</div><div class="luirow">${ic('download')}<span>Updates</span>${lCount(12, true)}</div><div class="luirow">${ic('archive')}<span>Archive</span>${lCount(1248)}</div></div>`)}
      ${sec('details', 'Details pane', 'One pane for Details and Information: recessed into the frame, header with a hairline and close, facts with hairlines, lists with full-row hover, the Add row, Stacked buttons last. Closed by default, Info opens it, Esc or its subject going away closes it; a drawer on a phone. <code>&lt;aside class="ldp"&gt;</code> + <code>lDP()</code>, <code>lDPShow()</code>. Used in Filer’s Information.',
        `<div class="luiframe"><main class="isle"><div class="luicontent"><b>Launch crew</b>The conversation${LUI.det ? '' : ` · <button class="bt sm fill" type="button" data-luidet>${ic('info')}Details</button>`}</div></main>${luiDetails()}</div>`)}
      ${sec('stack', 'Stacked button', 'Icon on top, label below, on the raised chip. Equal pairs or trios; <code>.sm</code> for tight panes; <code>danger</code> is red and still confirms. <code>lStack([{ icon, label, attr, danger, disabled }], size)</code>.',
        `<div class="luistage col"><div style="width:300px">${lStack([{ icon: 'log-out', label: 'Leave', attr: 'data-luileave' }, { icon: 'trash-2', label: 'Delete', danger: true, attr: 'data-luidel' }])}</div><div style="width:300px">${lStack([{ icon: 'refresh-cw', label: 'Sync now', attr: 'data-lui-todo="Synced just now"' }, { icon: 'pencil', label: 'Edit' }, { icon: 'log-out', label: 'Sign out', disabled: true }], 'sm')}</div></div>`)}
      ${sec('parity', 'Contact actions and mini cards', 'The owning app defines the look, the others embed a mini version: <code>lContactActs(key)</code> and <code>lContactCard(key)</code> from Contacts, <code>lEventCard()</code> from Calendar, <code>lSongCard()</code> from Tide, <code>lPlaceCard()</code> from Maps, <code>lFile()</code> from Filer.',
        `<div class="luistage col"><div style="width:376px;max-width:100%">${lContactActs('PR')}</div></div><div class="luistage">${lContactCard('PR')}${lEventCard({ t: 'Launch rehearsal', mon: 'Sep', day: '29', when: '10:00 AM', where: 'Studio', h: 150 })}${lSongCard({ t: 'God Only Knows', a: 'The Beach Boys', al: 'Pet Sounds', img: PH + 'pet-sounds.webp' })}${lPlaceCard({ n: 'Duende', addr: '468 19th St', eta: '9 min', icon: 'utensils' })}${file({ n: 'launch-deck.stage', k: 'deck', sz: '18.4 MB' }, { open: 'data-lui-todo="Opening in Stage"' })}</div>`)}
      ${sec('bubble', 'Selection bubble', 'Write’s bubble for every rich-text surface (Write, Notes, Charlie, Messages, Leaf): the common marks just above the selection, flipping below near the top; it waits for the drag to finish and hides on typing or scrolling. Arrows move inside it, Esc hides it, Alt+F10 reaches it. <code>lBubble(bar, host, rect, html)</code> on a <code>.selbar</code>. Select some words:',
        `<div class="luistage" id="lui-bhost" style="padding:28px 20px"><p class="luied" contenteditable="true" spellcheck="false" id="lui-ed">Freeze strings on the 10th. Launch day is October 1: film at nine, download at ten, and press all day. Select any of these words and the marks float just above them.</p><div class="selbar" id="lui-sel"></div></div>`)}
      ${sec('ac', 'Action center', 'The floating bar grows in place instead of opening a dialog: bar, double height, the full editor (Charlie’s reply, ported), or split in two. It caps at the island and its text scrolls; Esc folds it back and keeps what you typed; on a phone it spans the width. <code>.fbar</code> <code>.fbar.lac2</code> <code>.lac</code> <code>.lacsplit</code>, <code>lAC.open()</code>, <code>lAC.bind()</code>.',
        `<div class="luistage col" style="gap:14px">${seg([['bar', 'Bar'], ['double', 'Double'], ['editor', 'Editor'], ['split', 'Split']], LUI.ac, 'data-luiac', 'State')}<div class="luiframe" style="height:400px"><main class="isle" id="lui-acisle"><div class="luicontent"><b>Launch walkthrough deck</b>Priya, Nora and you · 4 messages</div>${luiAC()}</main></div></div>`)}
      ${sec('place', 'Placement and modes', 'Top right holds the mode switch and the thing itself (Open in, Share, Edit, Info, ···); the bottom bar holds what you do in this mode right now. Modes are icon plus label; a narrow window keeps only the current label. <code>.flo.lcorner</code> + <code>lModes()</code>.',
        `<div class="luiframe" style="height:340px"><main class="isle" id="lui-plisle"><div class="luicontent" style="top:60px"><b>Offsite-hero.jpg</b>1672 × 941</div>${luiPlace()}</main></div>`)}
      ${sec('open', 'Open in', 'Open wears the default app’s own icon and says where it opens. Open in lists every app that can, the best Suno app first, the default marked, then Other app. <code>lOpenBtn(kind)</code>, <code>lOpenIn(anchor, kind, name)</code>.',
        `<div class="luistage">${lOpenBtn('deck', 'data-lui-todo="Opening launch-deck.stage in Stage"')}${lOpenBtn('img', 'data-lui-todo="Opening terrace.webp in Viewer"')}${lOpenBtn('sheet', 'data-lui-todo="Opening budget-q4.grid in Grid"')}<button class="bt fill" type="button" data-luiopenin="img">${ic('square-arrow-out-up-right')}Open in…</button><button class="bt fill" type="button" data-luiopenin="audio">${ic('square-arrow-out-up-right')}Open a song in…</button></div>`)}
      ${sec('file', 'File card', 'One card for a file anywhere: the file’s own face (never larger than its square), the name cut in the middle so the extension stays, size and kind, and Open with the app’s icon. States go in the second line. <code>lFile(f, { sub, extra, act, open })</code>.',
        `<div class="luistage">${file({ n: 'suno-1.0-nightly-x86_64.iso', k: 'iso', sz: '2.1 of 3.1 GB' }, { sub: '38 s left', extra: '<span class="lprog"><i style="width:68%"></i></span>', act: `<button class="lfx" type="button" title="Pause" aria-label="Pause">${ic('pause')}</button><button class="lfx" type="button" title="Cancel" aria-label="Cancel">${ic('x')}</button>` })}
        ${file({ n: 'homepage-hero-final-final.webp', k: 'img', sz: '1.8 MB', src: PH + 'life-hero-writing.webp' }, { sub: 'Just now', open: 'data-lui-todo="Opening in Viewer"' })}
        ${file({ n: 'press-kit.zip', k: 'zip', sz: '48 MB' }, { sub: '<span class="lfbad">Failed: the server stopped responding</span>', act: '<span class="bt sm fill" role="button" data-lui-todo="Retrying">Retry</span>' })}
        ${file({ n: 'setup-helper.flatpakref', k: 'app' }, { sub: '<span class="lfwarn">Not from a source you use</span>', act: '<span class="bt sm fill" role="button" data-lui-todo="Kept. It won’t run until you open it in Valet">Keep…</span>' })}</div>`)}
      ${sec('confirm', 'Destructive dialog', 'For what can’t come back. Centred on the asking window (a drawer on a phone): icon, the question, one line of consequence, Cancel and the red action as equal buttons. Cancel has focus, Esc cancels. Reversible things get a toast with Undo instead. <code>lConfirm(win, { title, body, action, option, onOK })</code>.',
        `<div class="luistage"><button class="bt fill" type="button" data-luidel>${ic('trash-2')}Delete a conversation</button><button class="bt fill" type="button" data-luiun>${ic('package')}Uninstall an app</button></div>`)}
      ${sec('toast', 'Toast', 'One place (centred on the island, above its bar), a plain line, the icon for what happened, Undo when it can be undone. <code>lToast(win, msg, { icon, undo })</code>.',
        `<div class="luistage">${[['Added to Favorites', 'heart'], ['Removed from Favorites', 'heart', 1], ['Added Kansas City, MO', 'map-pin'], ['Copied', 'copy'], ['Conversation deleted', 'trash-2', 1]].map(([m, i, u]) => `<button class="bt fill" type="button" data-luitoast="${m}" data-luiti="${i}"${u ? ' data-luiu' : ''}>${ic(i)}${m}</button>`).join('')}</div>`)}
      ${sec('cat', 'Category pill', 'Depot’s category colours wherever a category shows: one map, light and dark, AA text. <code>lCat(key)</code>, tokens <code>--cat-*</code>. Used on Depot’s cards.',
        `<div class="luistage">${Object.keys(LCAT).map(lCat).join('')}</div>`)}
      ${sec('table', 'Table header and selection', 'One header for every list view: a recessed bar, each heading sorts (again reverses), <code>aria-sort</code> says which. <code>lTHead(cols, sort, attr)</code>, used in Filer’s list; lists built from grid or flex rows use the same bar, <code>lTHead.grid(cols, sort, attr, cls)</code> (Tide’s songs, Monitor, Disks, the file picker). One selection look, the raised chip (<code>.lsel</code>); earlier steps of a path are a quieter trail (<code>.ltrail</code>).',
        `<div class="luistage col"><table class="luitable">${lTHead([['name', 'Name'], ['kind', 'Kind'], ['size', 'Size']], LUI.sort, 'data-luisort')}<tbody>${[['budget-q4.grid', 'Grid spreadsheet', 96], ['launch-deck.stage', 'Stage presentation', 18400], ['why-letter.pdf', 'PDF document', 2100]].sort((a, b) => LUI.sort.dir * (LUI.sort.k === 'size' ? a[2] - b[2] : String(a[LUI.sort.k === 'kind' ? 1 : 0]).localeCompare(b[LUI.sort.k === 'kind' ? 1 : 0]))).map(([n, k, s], i) => `<tr class="${i === 1 ? 'on' : ''}"><td>${n}</td><td class="dim">${k}</td><td class="dim num">${s >= 1000 ? (s / 1000).toFixed(1) + ' MB' : s + ' KB'}</td></tr>`).join('')}</tbody></table>
        <div class="luigrid">${lTHead.grid([['', ''], ['title', 'Title'], ['album', 'Album'], ['time', 'Time', 'd']], LUI.gsort, 'data-luigsort')}${[['God Only Knows', 'Pet Sounds', 175], ['Wouldn’t It Be Nice', 'Pet Sounds', 153], ['Here Today', 'Pet Sounds', 172]].sort((a, b) => LUI.gsort.dir * (LUI.gsort.k === 'time' ? a[2] - b[2] : String(a[LUI.gsort.k === 'album' ? 1 : 0]).localeCompare(b[LUI.gsort.k === 'album' ? 1 : 0]))).map(([t, al, d], n) => `<div class="luigr"><span>${n + 1}</span><b>${t}</b><span>${al}</span><span class="d">${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}</span></div>`).join('')}</div>
        <div class="luicols"><div><button type="button" class="ltrail">Projects${ic('chevron-right')}</button><button type="button">Personal site${ic('chevron-right')}</button></div><div><button type="button" class="ltrail">Taxes 2026${ic('chevron-right')}</button><button type="button">Archive${ic('chevron-right')}</button></div><div><button type="button">Return.pdf</button><button type="button" class="lsel">Receipts.grid</button></div></div></div>`)}
      ${sec('foot', 'Sidebar foot', 'Search at the foot, then a filter picker whose menu opens upward (lit when a filter is on, and the list names it) or the raised New square. Adding an account or a source is a list row. <code>lFoot()</code>, <code>lFiltHead()</code>, <code>lAddRow()</code>. Used in Memos.',
        `<div class="luistage">${luiFootDemo()}</div>`)}
      ${sec('psearch', 'Place search', 'The field is the whole flow: places open above it as you type, Enter or a click adds the top or chosen one, no match says so in the list. <code>lFoot({ sug })</code> + <code>lPlaceSug()</code>. Used in Weather.',
        `<div class="luistage"><div class="luiside" style="height:300px"><div class="scr">${['Oakland', 'Lisbon', 'Tokyo'].map((n, i) => `<div class="luirow${i ? '' : ' on'}" style="width:100%">${ic('map-pin')}<span>${n}</span></div>`).join('')}</div>${lFoot({ q: { attr: 'data-luiq', ph: 'Add a city or ZIP', value: LUI.q }, sug: { id: 'lui-sug', html: LUI.q.trim() ? lPlaceSug(LUI.q, LUI.qi, 'data-luiplace') : '' } })}</div><p class="luinote" style="align-self:flex-end">Try “64105”, “Kansas” or “Atlantis”.</p></div>`)}
      ${sec('acct', 'Account card', 'The person at the top of a sidebar, in its own subtle frame, a section gap above the list. <code>.lacct</code>. Used in Settings.',
        `<div class="luistage"><div class="luiside" style="height:auto"><button class="lacct" type="button" data-lui-todo="Opening your Suno account">${av('me', 36)}<span><b style="display:block;font-weight:600">Nick</b><small class="t-caption">Suno account</small></span>${ic('chevron-right')}</button><div class="luirow on" style="width:100%">${ic('wifi')}<span>Wi-Fi</span></div><div class="luirow" style="width:100%">${ic('bluetooth')}<span>Bluetooth</span></div></div></div>`)}
      ${sec('sky', 'Cards on a lit background', 'On a light sky the card sits darker than the sky (a deep blue-black frost) so white text passes AA; secondary text is 90% white. Where colour means nothing, use a plain card. <code>.lskycard</code>, <code>--card-sky</code>, <code>.lcard</code>. Used in Weather.',
        `<div class="luisky d">${[['Rain', '80%', 'Light rain 6 PM to 9 PM.'], ['Wind', '11 mph', 'From the west'], ['UV index', '5', 'Moderate']].map(([h, b, p]) => `<section class="lskycard"><h6>${h}</h6><b class="t-numeric">${b}</b><p>${p}</p></section>`).join('')}</div><div class="luisky g" style="margin-top:10px">${[['Sunset', '7:02 PM', 'Sunrise was 7:01 AM'], ['Humidity', '64%', 'Dew point 50°']].map(([h, b, p]) => `<section class="lskycard"><h6>${h}</h6><b class="t-numeric">${b}</b><p>${p}</p></section>`).join('')}<section class="lcard" style="padding:12px 14px 14px"><h6 class="t-label" style="margin:0 0 8px">Plain card</h6><b class="t-numeric">+3 h</b><p class="t-caption">Lisbon, today</p></section></div>`)}
      ${sec('share', 'Share, Export, Upload', 'Each icon has one meaning. Share is <code>share-2</code> everywhere; <code>share</code> means Export (save a copy elsewhere); <code>upload</code> means Upload.',
        `<div class="luistage luiicons"><span>${ic('share-2')}Share</span><span>${ic('share')}Export</span><span>${ic('upload')}Upload</span></div>`)}
      ${sec('side', 'Sidebar toggle', 'One control hides and shows a sidebar: panel-left in the title bar just after the app’s name, F9, pressed while the sidebar shows, remembered per window. Each app says what closed means (Viola keeps its tab icons; the others give the room to the content); on a phone it opens the sidebar as a drawer. <code>lSideBtn(win)</code>, <code>lSide(win)</code>, <code>lSideOn(win)</code>, <code>.lsideoff</code>. Used in Filer, Photos, Viola, Depot, Settings, Notes and Viewer.',
        `<div class="luiframe luisidef${LUI.side ? '' : ' off'}"><div class="tbar"><img src="${A}files.svg" alt=""><b>Filer</b><button class="ib lsidebtn" type="button" data-luiside aria-pressed="${LUI.side}" aria-label="${LUI.side ? 'Hide' : 'Show'} sidebar" title="${LUI.side ? 'Hide' : 'Show'} sidebar (F9)">${ic('panel-left')}</button></div><div><nav class="luisb">${[['house', 'Home', 1], ['file-text', 'Documents'], ['download', 'Downloads'], ['image', 'Pictures']].map(([i, n, on]) => `<div class="luirow${on ? ' on' : ''}">${ic(i)}<span>${n}</span></div>`).join('')}</nav><main class="isle"><div class="luicontent"><b>Home</b>12 folders · 4 files</div></main></div></div>`)}
      ${sec('menu', 'Menu drawer', 'Every shared menu (Open in, the sidebar-foot filter, ···, style and zoom) is the usual popover on a computer and a bottom drawer on a phone: full width, a grab handle, rows sized for a thumb, the window dimmed behind it. Nothing to do per app: <code>lMenu(anchor, html)</code> does it. Try it with Phone on.',
        `<div class="luistage"><button class="bt fill" type="button" data-luimenu>${ic('ellipsis')}Open a menu</button></div>`)}
      ${sec('trail', 'Navigation trail', 'Where you came from sits inline with where you are, never as a framed Back button on a row of its own. Before a title the chevron stands alone (its name says where it goes); with no title it carries the name. <code>lTrail({ back: { label, attr }, title, meta })</code>. Used in Tide and its Sources pane.',
        `<div class="luistage col" style="gap:18px">${lTrail({ back: { label: 'Albums', attr: 'data-lui-todo="Back to Albums"' }, title: 'The Beach Boys', meta: ['12 albums', '214 songs'] })}${lTrail({ back: { label: 'Sources', attr: 'data-lui-todo="Back to Sources"' } })}</div>`)}
      ${sec('field', 'Field', 'A label above a recessed well (the search well), the accent ring on focus, a caption hint below. <code>lField(label, inputAttrs, value)</code> and <code>.lfhint</code>. Used in Tide’s Add source.',
        `<div class="luistage col"><div style="width:320px;max-width:100%">${lField('Server address', 'placeholder="music.example.com" aria-label="Server address"')}${lField('Username', 'placeholder="nick" aria-label="Username"', 'nick')}<p class="lfhint">Suno signs in with a token; the password isn’t kept.</p></div></div>`)}
      ${sec('stat', 'Status dot', 'A small dot for how a connection or job is doing: green is fine, accent and breathing is working, red needs you and always says why in words beside it. <code>.stat</code>, <code>.stat.busy</code>, <code>.stat.bad</code>.',
        `<div class="luistage col">${[['', 'Connected'], ['busy', 'Syncing 214 songs'], ['bad', 'Can’t reach the server: check the address']].map(([k, t]) => `<div class="luirow" style="width:auto"><i class="stat ${k}"></i><span>${t}</span></div>`).join('')}</div>`)}
      ${sec('msg', 'Message bubble', 'Messages owns the look; every thread uses it (Messages, Charlie). Theirs is the raised chip, yours the accent gradient in white; 18 round, 6 where one sender’s run joins. <code>.msg.theirs|.mine</code> › <code>.mcol</code> › <code>.bub</code>, tokens <code>--lbub-*</code> and <code>--mbub</code>.',
        `<div class="luistage col"><div class="luimsgs">${[['theirs first', 'Freeze strings on the 10th?'], ['theirs last', 'Then we film at nine.'], ['mine first', 'Works for me.'], ['mine last', 'I’ll book the studio.']].map(([c, t]) => `<div class="msg ${c}"><div class="mcol"><div class="bub"><span class="mt">${t}</span></div></div></div>`).join('')}</div></div>`)}
      </div>`;
    requestAnimationFrame(segs); }
  function luiRe(k) { const b = $('#lui-body'), y = b.scrollTop; renderLumaUI(); b.scrollTop = y; if (k) $(k)?.focus(); }
  function luiClickApp(e, hit) {
    const go = hit('[data-luigo]'); if (go) { $('#lui-' + go.dataset.luigo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); $$('#lui-nav button').forEach(b => b.classList.toggle('on', b === go)); return true; }
    if (hit('[data-luidet]')) { LUI.det = !LUI.det; luiRe(); return true; }
    if (hit('[data-luiside]')) { LUI.side = !LUI.side; const f = $('#lui-side .luisidef'), b = f.querySelector('[data-luiside]'), l = LUI.side ? 'Hide sidebar' : 'Show sidebar'; f.classList.toggle('off', !LUI.side); b.setAttribute('aria-pressed', LUI.side); b.setAttribute('aria-label', l); b.title = l + ' (F9)'; return true; }
    const mn = hit('[data-luimenu]'); if (mn) { if ($('#lmenu') && luiClick.m === mn) { $('#lmenu').remove(); luiClick.m = null; return true; } luiClick.m = mn; lMenu(mn, `<h6>Sort by</h6>${crMi('data-lui-todo="Sorted by name"', 'file-text', 'Name', ' on')}${crMi('data-lui-todo="Sorted by date"', 'calendar', 'Date modified')}${crMi('data-lui-todo="Sorted by size"', 'hard-drive', 'Size')}`); $('#lmenu')?.classList.add('ldrawer'); return true; }
    const gs = hit('[data-luigsort]'); if (gs) { const k = gs.dataset.luigsort; LUI.gsort = { k, dir: LUI.gsort.k === k ? -LUI.gsort.dir : 1 }; luiRe(`[data-luigsort="${k}"]`); return true; }
    if (hit('[data-luidel]')) { lConfirm($('#w-lumaui'), { title: 'Delete this conversation?', body: 'It’s removed from this computer. Others in the conversation keep their copy.', action: 'Delete', onOK: () => lToast($('#w-lumaui'), 'Conversation deleted', { icon: 'trash-2' }) }); return true; }
    if (hit('[data-luileave]')) { lConfirm($('#w-lumaui'), { title: 'Leave Launch crew?', body: 'You won’t get new messages. Someone can add you back.', action: 'Leave', icon: 'log-out', onOK: () => lToast($('#w-lumaui'), 'You left Launch crew', { icon: 'log-out' }) }); return true; }
    if (hit('[data-luiun]')) { lConfirm($('#w-lumaui'), { title: 'Uninstall Kiln?', body: 'Kiln is removed from this computer. Your files stay where they are.', action: 'Uninstall', icon: 'package', option: 'Also remove its data', onOK: d => lToast($('#w-lumaui'), d ? 'Kiln and its data removed' : 'Kiln uninstalled', { icon: 'trash-2' }) }); return true; }
    const ac = hit('[data-luiac]'); if (ac) { const ed = $('#lui-lac .laced'); if (ed) LUI.draft = ac.closest('.lacft') ? '' : ed.innerHTML; LUI.ac = ac.dataset.luiac; luiRe(); if (LUI.ac === 'editor') { const el = $('#lui-lac'); lAC.bind(el, () => { LUI.draft = $('#lui-lac .laced')?.innerHTML || ''; LUI.ac = 'bar'; luiRe('#lui-acisle .lacfield'); }); el.querySelector('.laced')?.focus(); } return true; }
    const md = hit('[data-luimode]'); if (md) { LUI.mode = md.dataset.luimode; const i = $('#lui-plisle'); i.querySelectorAll('.lcorner, .fbar').forEach(x => x.remove()); i.insertAdjacentHTML('beforeend', luiPlace()); requestAnimationFrame(segs); return true; }
    const oi = hit('[data-luiopenin]'); if (oi) { if ($('#lmenu') && luiClick.m === oi) { $('#lmenu').remove(); luiClick.m = null; return true; } luiClick.m = oi; lOpenIn(oi, oi.dataset.luiopenin || 'img', oi.dataset.luiopenin === 'audio' ? 'God Only Knows.flac' : 'Offsite-hero.jpg'); return true; }
    const to = hit('[data-luitoast]'); if (to) { lToast($('#w-lumaui'), to.dataset.luitoast, { icon: to.dataset.luiti, undo: to.hasAttribute('data-luiu') ? () => lToast($('#w-lumaui'), 'Undone', { icon: 'undo' }) : null }); return true; }
    const so = hit('[data-luisort]'); if (so) { const k = so.dataset.luisort; LUI.sort = { k, dir: LUI.sort.k === k ? -LUI.sort.dir : 1 }; luiRe(`[data-luisort="${k}"]`); return true; }
    const fi = hit('[data-luifilt]'); if (fi) { LUI.filter = fi.dataset.luifilt; setTimeout(() => $('#lmenu')?.remove()); luiRe(); return true; }
    const pl = hit('[data-luiplace]'); if (pl) { const p = LPLACES.find(x => x.id === pl.dataset.luiplace); LUI.q = ''; LUI.qi = 0; luiRe(); lToast($('#w-lumaui'), `Added ${p.n}, ${p.r}`, { icon: 'map-pin' }); return true; }
    return false; }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-luiq]')) { LUI.q = e.target.value; LUI.qi = 0; luiSug(); } });
  document.addEventListener('keydown', e => { if (!e.target.matches?.('[data-luiq]')) return; const l = lPlaceFind(LUI.q);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); LUI.qi = (LUI.qi + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % Math.max(1, l.length); luiSug(); }
    if (e.key === 'Enter' && l[LUI.qi]) { e.preventDefault(); $(`#lui-sug [data-luiplace="${l[LUI.qi].id}"]`)?.click(); }
    if (e.key === 'Escape') { LUI.q = ''; e.target.value = ''; luiSug(); } });
  document.addEventListener('selectionchange', () => { const s = getSelection(), ed = $('#lui-ed'), bar = $('#lui-sel'); if (!ed || !bar) return;
    if (!s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode)) { lBubble.hide(bar); return; } const n = s.toString().trim().split(/\s+/).length;
    lBubble(bar, $('#lui-bhost'), s.getRangeAt(0).getBoundingClientRect(), `<button class="ib" type="button" aria-label="Bold" title="Bold">${ic('bold')}</button><button class="ib" type="button" aria-label="Italic" title="Italic">${ic('italic')}</button><button class="ib" type="button" aria-label="Highlight" title="Highlight">${ic('highlighter')}</button><button class="ib" type="button" aria-label="Link" title="Link">${ic('link')}</button><span class="vr"></span><button class="ib" type="button" aria-label="More" title="More">${ic('ellipsis')}</button><span class="wrsel">${n} ${n === 1 ? 'word' : 'words'}</span>`); });
  document.addEventListener('scroll', e => { if (e.target.id === 'lui-body') lBubble.hide($('#lui-sel')); }, true);

  /* ══ Settings ═════════════════════════════════════════════════════════════════
     Everything GNOME Settings offers, in Suno's form. Every page opens on the thing itself: the network you're
     on, the displays as they sit on the desk, where sound is going, the battery's day, the keyboard under your
     hands. The rows under it are the settings, and they act at once. Search finds rows, not pages, and a row it
     finds works right there in the results. */
  const CF = {
    wifi: true, net: 'Studio North', airplane: false, hotspot: false, hsName: 'Nick’s ThinkPad', hsPass: 'lantern-orbit-42', autoJoin: true, allUsers: true, metered: 'auto',
    eth: false, vpn: false, proxy: 'off',
    bt: true,
    join: 'join', dsel: 'ext', arr: { side: 'top', off: .5 },
    d: { int: { res: '1920 × 1200', hz: '60 Hz', scale: '125', rot: 'Landscape', bright: 72, prof: 'Built-in, factory calibrated', primary: false },
      ext: { res: '3840 × 2160', hz: '60 Hz', scale: '150', rot: 'Landscape', hdr: false, prof: 'Dell U2723QE', primary: true } },
    night: true, nightWhen: 'sun', nightFrom: '21:00', nightTo: '06:30', nightT: 55,
    out: 'spk', vol: 62, bal: 0, cfg: 'Stereo', overamp: false, inDev: 'int', inVol: 70, alert: 'Default', lv: { system: 80, tide: 100, viola: 70, messages: 90, reel: 100 },
    pmode: 'bal', charge: 'max', pbtn: 'suspend', pct: true, autoBright: true, dim: true, autoSaver: true, blank: '5', susBat: true, susBatD: '15', susAc: false, susAcD: '60',
    mtab: 'touchpad', mBtn: 'left', mSpeed: 0, mAccel: true, mNat: false, tp: true, tpType: true, tSpeed: 20, tSec: 'two', tTap: true, tScroll: 'two', tNat: true,
    srcs: ['English (US)'], src: 'English (US)', perWin: 'all', altKey: 'AltRight', compose: 'off',
    acc: 250, wall: 'prism', tint: true,
    preset: 'suno', edge: 'bottom', spread: 'spread', joined: 'separate', float: 'floating', hide: 'never', isz: 40,
    tile: true, gap: 8, edgeTile: true, hot: true, edges: true, ws: 'dynamic', wsN: 4, wsMon: 'primary', swi: 'current',
    dnd: false, lockN: true, nshow: '6', na: { messages: true, charlie: true, calendar: true, phone: true, tasks: true, clock: true, depot: true, tide: false, maps: false },
    sa: [['filer', true], ['settings', true], ['calc', true], ['contacts', true], ['calendar', true], ['charlie', true], ['notes', true], ['tide', true], ['depot', true], ['term', false]], askAri: true,
    sl: { Home: true, Documents: true, Downloads: true, Music: true, Pictures: true, Videos: true, 'Archive HD': false },
    def: { web: 'viola', mail: 'charlie', cal: 'calendar', music: 'tide', video: 'viewer', photo: 'photos' }, media: { audio: 'tide', photos: 'photos', video: 'viewer', software: 'ask' }, neverMedia: false,
    lock: { blank: '5', auto: true, delay: '0', notes: true }, loc: true, cam: true, mic: true, hist: true, histKeep: '30', trash: true, temp: true, trashAge: '30', diag: 'ask', tbolt: false,
    appLoc: { maps: true, weather: true, clock: false }, appCam: { camera: true, messages: true, phone: true }, appMic: { memos: true, messages: true, phone: true, session: true },
    limit: false, limitH: '6', gray: true, eyes: true, move: false, moveS: '5-60', brSound: true,
    a11yMenu: false, hc: false, motion: false, large: false, cursor: 'default', soundKeys: false, scrollbars: false, reader: false,
    vAlert: false, vAlertHow: 'window', osk: false, rep: true, repDelay: 50, repSpeed: 60, blink: true, blinkS: 50, sticky: false, slow: false, bounce: false, kbdA11y: false,
    mkeys: false, locate: false, dbl: 40, hold: false, hover: false, zoom: false, zoomX: 2, zoomF: 'push', cross: false, invert: false,
    devName: 'Nick’s ThinkPad', fileShare: false, fsPass: true, media2: false,
    lang: 'en-US', fmt: 'US', loginLang: 'en-US',
    autoTime: true, autoZone: true, zone: 'America/Chicago', h24: false, wday: true, date: true, secs: false, wnum: false,
    autoLogin: false, finger: false, pType: 'std', pAuto: false,
    rdShare: false, rdCtl: false, rdLogin: false, rdTab: 'share', ssh: false,
    sync: { look: true, wifi: true, shelf: true }, myName: 'Nick', hsBand: 'auto',
    prDef: true, prPaper: 'Letter', prDuplex: 'long', prProf: 'Automatic', fmMail: true, fmCal: true, fmCon: true, fmFiles: false, ncFiles: true, ncCal: true, ncCon: false
  };
  const CFV = { pg: 'wifi', q: '', pk: {}, joinNet: null, connecting: null, near: 0, pairing: null, test: 0, keep: null, keyEdit: null, rev: false };
  const cfG = k => k.split('.').reduce((o, p) => o?.[p], CF);
  const cfS = (k, v) => { const ps = k.split('.'), last = ps.pop(), o = ps.reduce((o, p) => o[p], CF); o[last] = typeof o[last] === 'number' ? +v : typeof o[last] === 'boolean' ? v === true || v === 'true' : v; };
  const cfOP = o => o.map(x => Array.isArray(x) ? x : [x, x]);
  const cfIco = id => $(`.dk[data-app="${id}"] img`)?.getAttribute('src') || `${A}settings.svg`;
  const cfName = id => $(`.dk[data-app="${id}"]`)?.getAttribute('aria-label') || id;
  const CFMINS = [['1', '1 minute'], ['2', '2 minutes'], ['3', '3 minutes'], ['5', '5 minutes'], ['8', '8 minutes'], ['10', '10 minutes'], ['15', '15 minutes'], ['0', 'Never']];

  /* Row builders: each returns a plain description, drawn by cfRow and searchable by cfIndex */
  const rSw = (key, t, s, o) => ({ k: 'sw', key, t, s, ...o }), rRd = (key, val, t, s, o) => ({ k: 'rd', key, val, t, s, ...o });
  const rPk = (key, t, s, opts, o) => ({ k: 'pk', key, t, s, opts, ...o }), rSg = (key, t, s, opts, o) => ({ k: 'sg', key, t, s, opts, ...o });
  const rRg = (key, t, s, min, max, step, o) => ({ k: 'rg', key, t, s, min, max, step, ...o }), rNv = (to, t, s, v, o) => ({ k: 'nv', to, t, s, v, ...o });
  const rVl = (t, v, o) => ({ k: 'vl', t, v, ...o }), rBt = (act, t, s, label, o) => ({ k: 'bt', act, t, s, label, ...o }), rTx = (key, t, s, o) => ({ k: 'tx', key, t, s, ...o });
  const rCu = (html, o) => ({ k: 'cu', html, ...o });

  function cfRow(r) {
    if (!r || r.hide) return '';
    if (r.k === 'cu') return `<div class="cfrow cu${r.cls ? ' ' + r.cls : ''}">${r.html}</div>`;
    const lead = r.img ? `<img class="cfimg" src="${r.img}" alt="">` : r.av ? r.av : r.i ? `<span class="cfri">${ic(r.i)}</span>` : '';
    const txt = `<span class="cft"><b>${esc(r.t)}</b>${r.s ? `<em>${r.s}</em>` : ''}</span>`, L = r.lock ? ` disabled title="${esc(r.lock)}"` : '';
    let ctl = '', tag = 'div', attr = '';
    if (r.k === 'sw') { const on = !!cfG(r.key); tag = 'button'; attr = ` type="button" data-cfsw="${r.key}" role="switch" aria-checked="${on}"${L}`; ctl = `<i class="cfsw${on ? ' on' : ''}"></i>`; }
    else if (r.k === 'rd') { const on = String(cfG(r.key)) === String(r.val); tag = 'button'; attr = ` type="button" data-cfset="${r.key}|${r.val}" role="radio" aria-checked="${on}"${L}`; ctl = `<i class="cfrd${on ? ' on' : ''}"></i>`; }
    else if (r.k === 'pk') { CFV.pk[r.key] = r.opts; const cur = cfOP(r.opts).find(o => String(o[0]) === String(cfG(r.key))); ctl = `<button class="cfpk" type="button" data-cfpk="${r.key}" aria-haspopup="listbox"${L}>${r.lock ? ic('lock') : ''}<span>${esc(cur ? cur[1] : cfG(r.key))}</span>${ic('chevron-down')}</button>`; }
    else if (r.k === 'sg') ctl = seg(cfOP(r.opts).map(([v, n]) => [`${r.key}|${v}`, n]), `${r.key}|${cfG(r.key)}`, 'data-cfset', r.t, 'cfseg');
    else if (r.k === 'rg') { const v = cfG(r.key); ctl = `<span class="cfrg">${r.lo ? `<small>${r.lo}</small>` : ''}<input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" data-cfrg="${r.key}" aria-label="${esc(r.t)}"${L}>${r.hi ? `<small>${r.hi}</small>` : ''}${r.fmt ? `<output>${r.fmt(v)}</output>` : ''}</span>`; }
    else if (r.k === 'nv') { tag = 'button'; attr = ` type="button" data-cfp="${r.to}"${L}`; ctl = `${r.pill || ''}${r.v != null ? (/^\d+$/.test(r.v) ? lCount(+r.v) : `<span class="cfv">${esc(r.v)}</span>`) : ''}${ic('chevron-right')}`; }
    else if (r.k === 'vl') ctl = `<span class="cfv${r.mono ? ' mono' : ''}">${esc(r.v)}</span>${r.copy ? `<button class="ib cfcp" type="button" data-cfcopy="${esc(r.copy === true ? r.v : r.copy)}" title="Copy" aria-label="Copy">${ic('copy')}</button>` : ''}`;
    else if (r.k === 'bt') ctl = `<button class="bt fill sm cfbt${r.danger ? ' danger' : ''}" type="button" data-cfact="${r.act}"${L}>${r.lock ? ic('lock') : ''}${esc(r.label)}</button>`;
    else if (r.k === 'tx') ctl = `<input class="cftx${r.mono ? ' mono' : ''}" type="text" value="${esc(cfG(r.key))}" data-cftx="${r.key}" aria-label="${esc(r.t)}" spellcheck="false"${L}>`;
    return `<${tag} class="cfrow ${r.k}${r.lock ? ' locked' : ''}${r.cls ? ' ' + r.cls : ''}"${attr}>${lead}${txt}<span class="cfc">${ctl}</span></${tag}>`;
  }
  const cfGroups = gs => gs.filter(g => g && !g.hide && g.r.some(r => r && !r.hide)).map(g => `<section class="cfgrp">${g.h ? `<h6>${g.h}${g.x || ''}</h6>` : ''}<div class="cfcard">${g.r.map(cfRow).join('')}</div>${g.f ? `<p class="cfnote">${g.f}</p>` : ''}</section>`).join('');
  const cfTop = key => `<button class="cftop" type="button" data-cfsw="${key}" role="switch" aria-checked="${!!cfG(key)}" aria-label="Turn on or off"><i class="cfsw big${cfG(key) ? ' on' : ''}"></i></button>`;

  /* ── Data the pages draw from ───────────────────────────────────────────────── */
  const CFNETS = [{ n: 'Studio North', sig: 4, lock: true, known: true, band: '5 GHz' }, { n: 'Studio North Guest', sig: 3, lock: false, known: true, band: '2.4 GHz' }, { n: 'Priya’s phone', sig: 3, lock: true, band: '5 GHz' },
    { n: 'Harbor Café', sig: 2, lock: false, band: '2.4 GHz' }, { n: 'Maple Court 2F', sig: 2, lock: true, band: '5 GHz' }, { n: 'Coastline Rail', sig: 1, lock: true, band: '2.4 GHz' }];
  const CFKNOWN = ['Studio North', 'Studio North Guest', 'Coastline Rail', 'Harbor Café', 'Suno Office', 'Home'];
  const CFBT = [{ id: 'hp', n: 'WH-1000XM5', i: 'headphones', kind: 'Headphones', on: true, bat: 80 }, { id: 'ms', n: 'MX Master 3S', i: 'mouse', kind: 'Mouse', on: true, bat: 55 }, { id: 'kb', n: 'Keychron K3', i: 'keyboard', kind: 'Keyboard', on: false }];
  const CFNEAR = [{ id: 'jbl', n: 'JBL Flip 6', i: 'volume-2', kind: 'Speaker' }, { id: 'px', n: 'Pixel 9', i: 'smartphone', kind: 'Phone' }, { id: 'k2', n: 'MX Keys', i: 'keyboard', kind: 'Keyboard', code: '482 913' }];
  const CFOUT = [{ id: 'spk', n: 'Speakers', s: 'Built in', i: 'volume-2' }, { id: 'hp', n: 'WH-1000XM5', s: 'Bluetooth', i: 'headphones' }, { id: 'dock', n: 'Studio monitors', s: 'USB dock', i: 'music' }];
  const CFDISP = { int: { n: 'Built-in display', m: '14″ · ThinkPad', w: 1920, h: 1200, res: ['1920 × 1200', '1680 × 1050', '1280 × 800'], hz: ['60 Hz', '48 Hz'] },
    ext: { n: 'Dell U2723QE', m: '27″ · USB-C', w: 3840, h: 2160, res: ['3840 × 2160', '2560 × 1440', '1920 × 1080'], hz: ['60 Hz', '50 Hz', '30 Hz'] } };
  const CFACC = [[250, 'Blue'], [195, 'Teal'], [150, 'Green'], [95, 'Yellow'], [55, 'Orange'], [25, 'Red'], [350, 'Pink'], [300, 'Purple']];
  const CFWALL = [['prism', 'Prism'], ['meadow', 'Meadow'], ['blue-fog', 'Blue fog'], ['ember', 'Ember'], ['suno-creatives', 'Creatives']];
  const CFPRE = [['suno', 'Suno', { edge: 'bottom', spread: 'spread', joined: 'separate', float: 'floating' }], ['one', 'One bar', { edge: 'bottom', spread: 'together', joined: 'joined', float: 'floating' }],
    ['grown', 'Grown', { edge: 'bottom', spread: 'together', joined: 'separate', float: 'edge' }], ['tabs', 'Tabs', { edge: 'bottom', spread: 'spread', joined: 'separate', float: 'edge' }],
    ['taskbar', 'Taskbar', { edge: 'bottom', spread: 'spread', joined: 'joined', float: 'edge' }], ['split', 'Split', { edge: 'bottom', spread: 'spread', joined: 'separate', float: 'floating' }],
    ['side', 'Side', { edge: 'left', spread: 'spread', joined: 'separate', float: 'floating' }], ['free', 'Free', { edge: 'bottom', spread: 'spread', joined: 'separate', float: 'floating' }]];
  const CFFMT = { US: ['United States', 'Thursday, September 24, 2026', '3:42 PM', '1,234,567.89', '$1,234.56', 'Imperial', 'Letter'], GB: ['United Kingdom', 'Thursday 24 September 2026', '15:42', '1,234,567.89', '£1,234.56', 'Metric', 'A4'],
    DE: ['Deutschland', 'Donnerstag, 24. September 2026', '15:42', '1.234.567,89', '1.234,56 €', 'Metric', 'A4'], FR: ['France', 'jeudi 24 septembre 2026', '15:42', '1 234 567,89', '1 234,56 €', 'Metric', 'A4'],
    IN: ['India', 'Thursday, 24 September 2026', '3:42 pm', '12,34,567.89', '₹1,234.56', 'Metric', 'A4'], JP: ['日本', '2026年9月24日木曜日', '15:42', '1,234,567.89', '￥1,235', 'Metric', 'A4'] };
  const CFLANG = [['en-US', 'English (United States)'], ['en-GB', 'English (United Kingdom)'], ['de-DE', 'Deutsch'], ['es-ES', 'Español'], ['fr-FR', 'Français'], ['hi-IN', 'हिन्दी'], ['ja-JP', '日本語'], ['pt-BR', 'Português (Brasil)']];
  const CFZONE = [['America/Chicago', 'Chicago'], ['America/New_York', 'New York'], ['America/Los_Angeles', 'Los Angeles'], ['Europe/London', 'London'], ['Europe/Berlin', 'Berlin'], ['Asia/Kolkata', 'Kolkata'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney']];
  const CFAPPS = ['filer', 'photos', 'viola', 'write', 'tide', 'messages', 'notes', 'contacts', 'calendar', 'charlie', 'maps', 'camera', 'memos', 'ari', 'canvas', 'reel', 'term', 'depot'];
  const CFSZ = { filer: [12, 3, 41], photos: [38, 2100, 610], viola: [210, 340, 820], write: [64, 88, 12], tide: [52, 18400, 230], messages: [71, 960, 140], notes: [9, 14, 3], contacts: [8, 22, 1], calendar: [14, 6, 4], charlie: [48, 3200, 260],
    maps: [96, 410, 1300], camera: [22, 0, 18], memos: [11, 640, 2], ari: [140, 5200, 90], canvas: [180, 720, 400], reel: [320, 9800, 2400], term: [6, 1, 0], depot: [58, 30, 380] };
  const CFPERMS = { maps: ['loc'], weather: ['loc'], camera: ['cam', 'mic'], messages: ['cam', 'mic', 'notif', 'bg'], memos: ['mic'], reel: ['mic'], ari: ['bg', 'shot', 'search'], filer: ['search'], charlie: ['notif', 'bg', 'search'], calendar: ['notif', 'bg', 'search'], tide: ['notif', 'bg', 'search', 'wall'] };
  const CFPERM = { search: ['Search', 'Offers results when you search'], notif: ['Notifications', 'Shows notifications'], bg: ['Run in background', 'Keeps working when its window is closed'], shot: ['Screenshots', 'Can take pictures of the screen at any time'],
    wall: ['Change wallpaper', 'Can set the desktop background'], sound: ['Sounds', 'Plays sounds'], inh: ['Keyboard shortcuts', 'Can block system shortcuts while focused'], cam: ['Camera', 'Takes pictures and video'], mic: ['Microphone', 'Records sound'], loc: ['Location', 'Knows where this computer is'] };
  const CFAP = {};
  const CFSHORT = [['Windows', [['Close window', 'Alt F4'], ['Maximise', 'Super ↑'], ['Tile left', 'Super ←'], ['Tile right', 'Super →'], ['Hide window', 'Super H'], ['Switch windows', 'Alt Tab']]],
    ['Workspaces', [['Next workspace', 'Super PgDn'], ['Previous workspace', 'Super PgUp'], ['Move window to next workspace', 'Shift Super PgDn']]],
    ['Shelf', [['Open the app launcher', 'Super'], ['Quick Options', 'Super S'], ['Show notifications', 'Super V'], ['Open app 1–9 on the shelf', 'Super 1']]],
    ['Screenshots', [['Take a screenshot', 'Print'], ['Screenshot a window', 'Alt Print'], ['Record the screen', 'Shift Ctrl Alt R']]],
    ['Launchers', [['Filer', 'Super E'], ['Ask Ari', 'Super Space'], ['Terminal', 'Ctrl Alt T'], ['Settings', 'Super I']]],
    ['Accessibility', [['Zoom in', 'Super Alt ='], ['Zoom out', 'Super Alt -'], ['Screen reader', 'Super Alt S']]]];
  const CFKB = { codes: [['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'], ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
    ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'], ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'], ['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'ContextMenu', 'ControlRight']],
    w: { Backspace: 1.9, Tab: 1.5, Backslash: 1.4, CapsLock: 1.8, Enter: 2.1, ShiftLeft: 2.35, ShiftRight: 2.55, ControlLeft: 1.3, MetaLeft: 1.3, AltLeft: 1.3, Space: 6, AltRight: 1.3, ContextMenu: 1.3, ControlRight: 1.3 },
    L: { 'English (US)': ['` 1 2 3 4 5 6 7 8 9 0 - = ⌫', 'Tab q w e r t y u i o p [ ] \\', 'Caps a s d f g h j k l ; \' Return', 'Shift z x c v b n m , . / Shift', 'Ctrl Super Alt _ Alt Menu Ctrl'],
      'Deutsch': ['^ 1 2 3 4 5 6 7 8 9 0 ß ´ ⌫', 'Tab q w e r t z u i o p ü + #', 'Caps a s d f g h j k l ö ä Return', 'Shift y x c v b n m , . - Shift', 'Strg Super Alt _ AltGr Menu Strg'],
      'Français': ['² & é " \' ( - è _ ç à ) = ⌫', 'Tab a z e r t y u i o p ^ $ *', 'Caps q s d f g h j k l m ù Return', 'Shift w x c v b n , ; : ! Shift', 'Ctrl Super Alt _ AltGr Menu Ctrl'] } };
  const CFWEEK = [['Fri', 200], ['Sat', 105], ['Sun', 130], ['Mon', 340], ['Tue', 370], ['Wed', 295], ['Today', 252]];
  const cfHM = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : m + ' min';
  const cfBars = n => `<span class="cfsig" title="${['Weak', 'Fair', 'Good', 'Excellent'][n - 1]} signal">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}" style="height:${2 + i * 3}px"></i>`).join('')}</span>`;
  const cfDN = k => k === 'int' ? CFDISP.int.n : CFDISP.ext.n;

  /* ── Pages ─────────────────────────────────────────────────────────────────── */
  const CFP = {
    me: { n: 'Suno account', i: 'user', h: 250, meta: () => '@nick · nick@simplyluma.com',
      hero: () => `<div class="cfid">${av('me', 64)}<div><b>Nick</b><em>@nick</em><span>Messages, sync and Depot use this account</span></div></div>`,
      body: () => [{ h: 'Account', r: [rTx('myName', 'Name', 'Shown to people you message'), rVl('Username', '@nick', { s: 'How people find you in Messages' }), rVl('Email', 'nick@simplyluma.com'), rBt('pw', 'Password', 'Changed in June', 'Change…')] },
        { h: 'Keep in step across your computers', r: [rSw('sync.look', 'Appearance and wallpaper'), rSw('sync.wifi', 'Wi‑Fi networks'), rSw('sync.shelf', 'Shelf layout')] },
        { h: 'Signed in', r: [rVl('Nick’s ThinkPad', 'This computer', { i: 'monitor' }), rVl('Studio desktop', 'Yesterday', { i: 'monitor' })] },
        { r: [rBt('signout', 'Sign out of this computer', 'Your files stay. Messages and sync stop until you sign in again.', 'Sign out…', { danger: true })] }] },

    wifi: { n: 'Wi‑Fi', i: 'wifi', g: 'Connections', h: 250, em: () => CF.wifi ? (CF.net || 'Not connected') : 'Off', top: () => cfTop('wifi'),
      meta: () => !CF.wifi ? 'Wi‑Fi is off' : CF.net ? `Connected to ${esc(CF.net)}` : `${CFNETS.length} networks nearby`,
      hero: () => { if (!CF.wifi) return `<div class="cfoff">${ic('wifi')}<b>Wi‑Fi is off</b><button class="bt pri" type="button" data-cfsw="wifi">Turn on</button></div>`;
        const n = CFNETS.find(x => x.n === CF.net); if (!n) return `<div class="cfoff">${ic('wifi')}<b>Not connected</b><em>Pick a network below</em></div>`;
        return `<div class="cfnow"><div class="cfbig">${cfBars(n.sig)}</div><div class="cfnowt"><b>${esc(n.n)}</b><em>${['Weak', 'Fair', 'Good', 'Excellent'][n.sig - 1]} signal · ${n.lock ? 'Secured' : 'Open'} · ${CF.metered === 'yes' ? 'Metered' : 'Unlimited data'}</em></div><div class="cfnowa"><button class="bt fill" type="button" data-cfact="qr">Share</button><button class="bt fill" type="button" data-cfp="wifi-net">Details</button></div></div>`; },
      body: () => [CF.wifi && { h: 'Nearby', r: [...CFNETS.filter(n => n.n !== CF.net).map(n => rCu(cfNetRow(n), { t: n.n, cls: CFV.joinNet === n.n ? 'open' : '' })), rBt('hidden', 'Hidden network', 'Join a network that doesn’t show its name', 'Join…')] },
        { h: 'More', r: [rNv('wifi-known', 'Known networks', 'Networks this computer joins on its own', String(CFKNOWN.length)), rNv('hotspot', 'Hotspot', 'Share this computer’s connection', CF.hotspot ? 'On' : 'Off'), rSw('airplane', 'Airplane mode', 'Turns off Wi‑Fi, Bluetooth and mobile data')] }] },
    'wifi-net': { get n() { return CF.net || 'Network'; }, up: 'wifi', meta: () => 'Connected · WPA3 · 5 GHz',
      body: () => [{ r: [rSw('autoJoin', 'Join automatically'), rSw('allUsers', 'Available to everyone on this computer'), rPk('metered', 'Metered', 'Suno holds back big downloads on metered networks', [['auto', 'Automatic'], ['yes', 'Yes'], ['no', 'No']])] },
        { h: 'Connection', r: [rVl('Signal', 'Excellent'), rVl('Speed', '1.2 Gb/s'), rVl('Security', 'WPA3'), rVl('Band', '5 GHz, channel 149')] },
        { h: 'Addresses', r: [rVl('IPv4', '192.168.10.24', { mono: true, copy: true }), rVl('IPv6', 'fe80::9a3b:2cff:fe41:7d10', { mono: true, copy: true }), rVl('Router', '192.168.10.1', { mono: true }), rVl('DNS', 'Automatic', {})] },
        { r: [rBt('qr', 'Share this network', 'Show a code a phone can scan', 'Share…'), rBt('forget', 'Forget this network', 'The password is removed from this computer', 'Forget…', { danger: true })] }] },
    'wifi-known': { n: 'Known networks', up: 'wifi', meta: () => `${CFKNOWN.length} networks`,
      body: () => [{ r: CFKNOWN.map(k => rCu(`<span class="cfri">${ic(k === CF.net ? 'wifi' : CFNETS.some(n => n.n === k) ? 'wifi-high' : 'wifi-low')}</span><span class="cft"><b>${esc(k)}</b><em>${k === CF.net ? 'Connected' : CFNETS.some(n => n.n === k) ? 'In range' : 'Not nearby'}</em></span><span class="cfc"><button class="bt cfbt" type="button" data-cfforget="${esc(k)}">Forget</button></span>`, { t: k })) }] },
    hotspot: { n: 'Hotspot', up: 'wifi', top: () => cfTop('hotspot'), meta: () => CF.hotspot ? 'Other devices can join this computer' : 'Off',
      hero: () => CF.hotspot ? `<div class="cfqrw">${cfQR(CF.hsName + CF.hsPass)}<div><b>${esc(CF.hsName)}</b><em>Scan to join, or type the password</em><span class="mono">${esc(CF.hsPass)}</span></div></div>` : '',
      body: () => [{ r: [rTx('hsName', 'Network name'), rTx('hsPass', 'Password', '', { mono: true }), rPk('hsBand', 'Band', '', [['auto', 'Automatic'], ['5', '5 GHz'], ['2', '2.4 GHz']])] }], hc: 'qr' },

    network: { n: 'Network', i: 'ethernet-port', g: 'Connections', h: 220, meta: () => `Cable unplugged · VPN ${CF.vpn ? 'on' : 'off'}`,
      body: () => [{ h: 'Wired', r: [rSw('eth', 'Ethernet', 'Cable unplugged', { i: 'ethernet-port', lock: 'Plug in a cable to use Ethernet' })] },
        { h: 'VPN', r: [rSw('vpn', 'Studio North VPN', CF.vpn ? 'Connected' : 'WireGuard', { i: 'shield' }), rCu(lAddRow('Add a VPN', 'data-cfact="vpnadd"', 'plus'))] },
        { h: 'Proxy', r: [rPk('proxy', 'Proxy', 'For networks that require one', [['off', 'Off'], ['auto', 'Automatic'], ['manual', 'Manual']])] }] },

    bluetooth: { n: 'Bluetooth', i: 'bluetooth', g: 'Connections', h: 255, em: () => CF.bt ? 'On' : 'Off', top: () => cfTop('bt'),
      meta: () => CF.bt ? `${CFBT.filter(d => d.on).length} connected · visible as “${esc(CF.devName)}”` : 'Bluetooth is off',
      hero: () => { if (!CF.bt) return `<div class="cfoff">${ic('bluetooth')}<b>Bluetooth is off</b><button class="bt pri" type="button" data-cfsw="bt">Turn on</button></div>`;
        const near = CFNEAR.slice(0, CFV.near);
        return `<div class="cfscan"><span class="cfpulse"></span><b>Looking for devices</b><em>Put a device in pairing mode and it appears here</em></div><div class="cfnear">${near.map(d => { const p = CFV.pairing?.id === d.id;
          return `<button class="cfndev${p ? ' pairing' : ''}" type="button" data-cfpair="${d.id}">${ic(d.i)}<b>${esc(d.n)}</b><em>${p ? (d.code ? `Type <span class="mono">${d.code}</span> on it, then Return` : 'Pairing…') : d.kind}</em></button>`; }).join('')}${near.length < CFNEAR.length ? '<span class="cfndev ghost"></span>' : ''}</div>`; },
      body: () => [CF.bt && { h: 'Your devices', r: CFBT.map(d => rCu(`<span class="cfri">${ic(d.i)}</span><span class="cft"><b>${esc(d.n)}</b><em>${d.on ? `Connected${d.bat ? ` · ${d.bat}% battery` : ''}` : 'Not connected'}</em></span><span class="cfc"><button class="bt cfbt" type="button" data-cfbtc="${d.id}">${d.on ? 'Disconnect' : 'Connect'}</button><button class="ib" type="button" data-cfbtx="${d.id}" title="Forget" aria-label="Forget ${esc(d.n)}">${ic('x')}</button></span>`, { t: d.n })) },
        CF.bt && { r: [rBt('btsend', 'Send files', 'To a phone or computer nearby', 'Send…')] }] },

    appearance: { n: 'Appearance', i: 'palette', g: 'Desktop', meta: () => `${document.body.dataset.mode === 'light' ? 'Light' : 'Dark'} · ${CFACC.find(a => a[0] === CF.acc)[1]} accent · ${CFWALL.find(w => w[0] === CF.wall)[1]}`,
      hero: () => `<div class="cfstyles">${['light', 'dark'].map(m => `<button class="cfstyle${document.body.dataset.mode === m ? ' on' : ''}" type="button" data-cfmode="${m}"><span class="cfmini ${m}" style="background-image:url('${WP}${CF.wall}.png')"><i class="w"><i></i><i></i><i></i></i><i class="w2"></i></span><b>${m === 'light' ? 'Light' : 'Dark'}</b></button>`).join('')}</div>`,
      body: () => [{ h: 'Accent', r: [rCu(`<div class="cfaccs">${CFACC.map(([h, n]) => `<button class="cfacc${CF.acc === h ? ' on' : ''}" type="button" data-cfacc="${h}" style="--h:${h}" title="${n}" aria-label="${n}"></button>`).join('')}</div>`, { t: 'Accent colour' })] },
        { h: 'Background', r: [rCu(`<div class="cfwalls">${CFWALL.map(([k, n]) => `<button class="cfwall${CF.wall === k ? ' on' : ''}" type="button" data-cfwall="${k}" title="${n}" style="background-image:url('${WP}${k}.png')"></button>`).join('')}<button class="cfwall add" type="button" data-cfact="addwall" title="Add a picture">${ic('plus')}</button></div>`, { t: 'Background wallpaper' })] },
        { h: 'Windows', r: [rSw('tint', 'Tint windows with what they hold', 'A frame takes a little colour from its album, photo or folder')] }] },
    shelf: { n: 'Shelf', i: 'panel-bottom', g: 'Desktop', h: 190, meta: () => `${CFPRE.find(p => p[0] === CF.preset)?.[1] || 'Custom'} · ${CF.hide === 'never' ? 'always shown' : CF.hide === 'touch' ? 'hides when a window touches it' : 'hides until you point at it'}`,
      hero: () => `<div class="cfdesk" style="background-image:url('${WP}${CF.wall}.png')">${cfShelf()}</div><div class="cfpres">${CFPRE.map(([k, n]) => `<button type="button" class="${CF.preset === k ? 'on' : ''}" data-cfpre="${k}">${n}</button>`).join('')}</div>`,
      body: () => [{ h: 'Arrangement', r: [rSg('edge', 'Position', '', [['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']]), rSg('spread', 'Islands', 'Together in the middle, or spread to the ends', [['together', 'Together'], ['spread', 'Spread']]),
          rSg('joined', 'Surface', '', [['separate', 'Separate'], ['joined', 'One bar']]), rSg('float', 'Edge', 'Float above the edge, or grow out of it', [['floating', 'Floating'], ['edge', 'Attached']])] },
        { h: 'Behaviour', r: [rPk('hide', 'Hide the shelf', '', [['never', 'Never'], ['touch', 'When a window touches it'], ['always', 'Until you point at it']]), rRg('isz', 'Icon size', '', 32, 56, 4, { fmt: v => v + ' px' })] },
        { h: 'Status island', r: [rNv('datetime', 'Clock', 'Format, weekday and seconds'), rNv('power', 'Battery percentage', '', CF.pct ? 'Shown' : 'Hidden')] }] },
    windows: { n: 'Windows & Workspaces', i: 'square-stack', g: 'Desktop', h: 170, meta: () => `${CF.tile ? 'Tiling' : 'Free windows'} · ${CF.ws === 'dynamic' ? 'workspaces come and go' : CF.wsN + ' workspaces'}`,
      hero: () => cfTiles(),
      body: () => [{ h: 'Tiling', r: [rSw('tile', 'Tile windows', 'New windows sit side by side instead of on top of each other'), rRg('gap', 'Space between windows', '', 0, 24, 2, { fmt: v => v + ' px', hide: !CF.tile }), rSw('edgeTile', 'Drag to an edge to tile', 'Drop a window on the left, right or top edge')] },
        { h: 'General', r: [rSw('hot', 'Hot corner', 'Point at the top left corner to see all windows'), rSw('edges', 'Screen edges', 'Drag a window against an edge to resize it')] },
        { h: 'Workspaces', r: [rRd('ws', 'dynamic', 'As many as you need', 'Empty workspaces go away on their own'), rRd('ws', 'fixed', 'A fixed number'), rRg('wsN', 'Number of workspaces', '', 1, 9, 1, { fmt: v => v, hide: CF.ws !== 'fixed' })] },
        { h: 'On more than one display', r: [rRd('wsMon', 'primary', 'Workspaces on the main display only'), rRd('wsMon', 'all', 'Workspaces on every display')] },
        { h: 'Switching apps', r: [rRd('swi', 'current', 'Apps on this workspace'), rRd('swi', 'all', 'Apps on every workspace')] }] },
    notifications: { n: 'Notifications', i: 'bell', g: 'Desktop', h: 20, top: () => `<span class="cftopl">Do Not Disturb</span>${cfTop('dnd')}`,
      meta: () => CF.dnd ? 'Do Not Disturb is on. Calls still come through.' : `${Object.values(CF.na).filter(Boolean).length} apps can notify you`,
      hero: () => `<div class="cflip${CF.dnd ? ' dnd' : ''}" style="background-image:url('${WP}${CF.wall}.png')"><i class="lip">${CF.dnd ? `${ic('bell-off')}<b>3</b>` : ''}</i>${CF.dnd ? '' : `<div class="cfcardn"><img src="${cfIco('messages')}" alt=""><div><b>Priya Raman</b><em>Timeline is on slide 7</em></div><span>now</span></div>`}</div>`,
      body: () => [{ r: [rSw('lockN', 'On the lock screen', 'Show who a notification is from while locked'), rPk('nshow', 'Stay on screen for', 'Then it tucks into the top edge', [['4', '4 seconds'], ['6', '6 seconds'], ['10', '10 seconds'], ['0', 'Until dismissed']])] },
        { h: 'Apps', r: Object.keys(CF.na).map(a => rSw('na.' + a, cfName(a), null, { img: cfIco(a) })) }] },
    search: { n: 'Search', i: 'search', g: 'Desktop', h: 240, meta: () => `Searching ${CF.sa.filter(x => x[1]).length} apps and ${Object.values(CF.sl).filter(Boolean).length} places`,
      body: () => [{ h: 'Results come from', f: 'Drag to change the order results appear in.', r: CF.sa.map(([a, on], i) => rCu(`<span class="cfgrip">${ic('grip-vertical')}</span><img class="cfimg" src="${cfIco(a)}" alt=""><span class="cft"><b>${esc(cfName(a))}</b></span><span class="cfc"><button class="cfswb" type="button" data-cfsa="${i}" role="switch" aria-checked="${on}" aria-label="${esc(cfName(a))}"><i class="cfsw${on ? ' on' : ''}"></i></button></span>`, { t: cfName(a) + ' search results' })) },
        { h: 'Places', r: [rNv('search-places', 'Folders to search', 'Filer looks inside these', Object.values(CF.sl).filter(Boolean).length + ' folders')] },
        { h: 'Ari', r: [rSw('askAri', 'Offer to ask Ari', 'When nothing matches what you typed')] }] },
    'search-places': { n: 'Folders to search', up: 'search', meta: () => 'Filer and search look inside these',
      body: () => [{ r: Object.keys(CF.sl).map(k => rSw('sl.' + k, k, k === 'Archive HD' ? 'External drive' : null, { i: k === 'Archive HD' ? 'hard-drive' : k === 'Home' ? 'house' : 'folder' })) }, { r: [rBt('addplace', 'Another folder', '', 'Add…')] }] },

    displays: { n: 'Displays', i: 'monitor', g: 'Devices', h: 200, meta: () => `Two displays · ${CF.join === 'join' ? 'one desk across both' : 'showing the same thing'}`,
      hero: () => `${seg([['join', 'Join'], ['mirror', 'Mirror']], CF.join, 'data-cfjoin', 'Multiple displays', 'cfjoin')}<div class="cfarr" id="cf-arr">${cfArr()}</div><p class="cfhint">${CF.join === 'join' ? 'Drag to match where your displays sit on the desk' : 'Both displays show the same picture'}</p>`, hc: 'disp',
      body: () => { const k = CF.join === 'mirror' ? 'ext' : CF.dsel, d = CFDISP[k], p = 'd.' + k + '.';
        return [{ h: CF.join === 'mirror' ? 'Both displays' : cfDN(k), r: [rPk(p + 'res', 'Resolution', '', d.res), rPk(p + 'hz', 'Refresh rate', '', d.hz), rSg(p + 'scale', 'Scale', 'How big things look', [['100', '100%'], ['125', '125%'], ['150', '150%'], ['175', '175%'], ['200', '200%']]),
          rPk(p + 'rot', 'Orientation', '', ['Landscape', 'Portrait right', 'Portrait left', 'Landscape, flipped']), k === 'ext' ? rSw(p + 'hdr', 'HDR', 'Brighter highlights in videos and photos that support it') : rRg(p + 'bright', 'Brightness', '', 5, 100, 1, { fmt: v => v + '%' }),
          CF.join === 'join' ? rSw(p + 'primary', 'Main display', 'Holds the shelf and new windows', { lock: CF.d[k].primary ? 'Choose the other display to move the shelf' : null }) : null, rPk(p + 'prof', 'Color profile', '', k === 'ext' ? ['Dell U2723QE', 'sRGB', 'Display P3'] : ['Built-in, factory calibrated', 'sRGB'])] },
          { r: [rNv('nightlight', 'Night Light', 'Warmer colors at night, easier on the eyes', CF.night ? 'On' : 'Off', { i: 'moon' })] }]; } },
    nightlight: { n: 'Night Light', up: 'displays', top: () => cfTop('night'), meta: () => !CF.night ? 'Off' : CF.nightWhen === 'sun' ? 'From sunset to sunrise' : `From ${CF.nightFrom} to ${CF.nightTo}`,
      hero: () => { const [a, b] = CF.nightWhen === 'sun' ? [18.87, 6.97] : [CF.nightFrom, CF.nightTo].map(t => +t.slice(0, 2) + t.slice(3) / 60), P = x => x / 24 * 100;
        return `<div class="cfnl"><div class="cftemp" style="--t:${CF.nightT}%"><i></i></div><div class="cfday">${a > b ? `<i style="left:${P(a)}%;right:0"></i><i style="left:0;width:${P(b)}%"></i>` : `<i style="left:${P(a)}%;width:${P(b - a)}%"></i>`}<b style="left:${P(new Date().getHours() + new Date().getMinutes() / 60)}%"></b></div><div class="cfdayl"><span>Midnight</span><span>6 AM</span><span>Noon</span><span>6 PM</span><span>Midnight</span></div></div>`; },
      body: () => [{ r: [rRd('nightWhen', 'sun', 'Sunset to sunrise', 'Follows the sun where you are'), rRd('nightWhen', 'manual', 'Set times'), rPk('nightFrom', 'From', '', ['19:00', '20:00', '21:00', '22:00', '23:00'], { hide: CF.nightWhen !== 'manual' }), rPk('nightTo', 'To', '', ['05:30', '06:00', '06:30', '07:00', '08:00'], { hide: CF.nightWhen !== 'manual' })] },
        { r: [rRg('nightT', 'Color temperature', '', 0, 100, 1, { lo: 'Cooler', hi: 'Warmer' })] }, { r: [rBt('nightoff', 'Turn off until tomorrow', '', 'Turn off')] }] },
    sound: { n: 'Sound', i: 'volume-2', g: 'Devices', h: 330, meta: () => `Playing through ${CFOUT.find(o => o.id === CF.out).n} · ${CF.vol}%`,
      hero: () => `<div class="cfouts">${CFOUT.map(o => `<button class="cfout${CF.out === o.id ? ' on' : ''}" type="button" data-cfout="${o.id}">${ic(o.i)}<b>${esc(o.n)}</b><em>${o.s}</em></button>`).join('')}</div><div class="cfvol">${ic('volume-2')}<input type="range" min="0" max="${CF.overamp ? 150 : 100}" step="1" value="${CF.vol}" data-cfrg="vol" aria-label="Volume"><output>${CF.vol}%</output></div><div class="cfmeter" id="cf-outm">${'<i></i>'.repeat(32)}</div>`, hc: 'snd',
      body: () => [{ h: 'Output', r: [rPk('cfg', 'Configuration', '', ['Stereo', 'Mono']), rRg('bal', 'Balance', '', -100, 100, 1, { lo: 'Left', hi: 'Right' }), rBt('test', 'Test', 'Plays a sound from each speaker in turn', CFV.test ? 'Playing…' : 'Test'), rSw('overamp', 'Over-amplification', 'Lets the volume go past 100%. Sound may distort.')] },
        { h: 'Input', r: [rPk('inDev', 'Microphone', '', [['int', 'Built-in microphone'], ['hp', 'WH-1000XM5']]), rRg('inVol', 'Input volume', '', 0, 100, 1, { fmt: v => v + '%' }), rCu(`<span class="cft"><b>Level</b><em>Speak to test it</em></span><span class="cfc"><span class="cfmeter in" id="cf-inm">${'<i></i>'.repeat(24)}</span></span>`, { t: 'Microphone level' })] },
        { h: 'More', r: [rNv('sound-levels', 'Volume by app', 'Each app’s own level'), rNv('sound-alert', 'Alert sound', 'The sound when something needs you', CF.alert)] }] },
    'sound-levels': { n: 'Volume by app', up: 'sound', meta: () => 'Apps playing sound now, and system sounds',
      body: () => [{ r: [['system', 'System sounds', null, 'volume-2'], ['tide', 'Tide'], ['viola', 'Viola'], ['messages', 'Messages'], ['reel', 'Reel']].map(([k, n, _, i]) => rRg('lv.' + k, n, '', 0, 100, 1, { fmt: v => v + '%', ...(i ? { i } : { img: cfIco(k) }) })) }] },
    'sound-alert': { n: 'Alert sound', up: 'sound', meta: () => CF.alert,
      body: () => [{ r: ['Default', 'Click', 'Hum', 'String', 'Swing', 'None'].map(n => rRd('alert', n, n)) }] },
    power: { n: 'Power', i: 'battery-medium', g: 'Devices', h: 145, em: () => '78%', meta: () => 'On battery · about 5 h 10 min left',
      hero: () => `<div class="cfbat"><div class="cfcell"><i style="width:78%"></i></div><div class="cfbatt"><b>78%</b><em>About 5 h 10 min left</em></div></div><div class="cfdaych">${cfBatDay()}</div><div class="cfmodes">${[['perf', 'Performance', 'zap', 'Fast, runs warmer'], ['bal', 'Balanced', 'gauge', 'Speed and battery'], ['save', 'Power saver', 'battery-medium', 'Longer battery']].map(([k, n, i, s]) => `<button class="cfmode${CF.pmode === k ? ' on' : ''}" type="button" data-cfset="pmode|${k}">${ic(i)}<b>${n}</b><em>${s}</em></button>`).join('')}</div>`, hc: 'pwr',
      body: () => [{ h: 'Charging', r: [rRd('charge', 'max', 'Charge to full', 'Uses the whole battery. It wears out faster.'), rRd('charge', 'health', 'Stop at 80%', 'The battery lasts more years')] },
        { h: 'Connected devices', r: [rVl('MX Master 3S', '55%', { i: 'mouse' }), rVl('WH-1000XM5', '80%', { i: 'headphones' })] },
        { h: 'Saving power', r: [rSw('autoBright', 'Automatic brightness', 'Follows the light in the room'), rSw('dim', 'Dim when idle'), rSw('autoSaver', 'Power saver when low', 'Turns on at 20%'), rPk('blank', 'Turn the screen off after', '', CFMINS)] },
        { h: 'Sleep', r: [rSw('susBat', 'Sleep on battery'), rPk('susBatD', 'After', '', [['15', '15 minutes'], ['20', '20 minutes'], ['30', '30 minutes'], ['60', '1 hour']], { hide: !CF.susBat }), rSw('susAc', 'Sleep when plugged in'), rPk('susAcD', 'After', '', [['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours']], { hide: !CF.susAc })] },
        { h: 'General', r: [rPk('pbtn', 'Power button', '', [['suspend', 'Sleep'], ['off', 'Power off'], ['nothing', 'Nothing']]), rSw('pct', 'Battery percentage', 'Shown in the shelf')] }] },
    mouse: { n: 'Mouse & Touchpad', i: 'mouse', g: 'Devices', h: 280, meta: () => 'MX Master 3S and the built-in touchpad',
      hero: () => `${seg([['mouse', 'Mouse'], ['touchpad', 'Touchpad']], CF.mtab, 'data-cfmtab', 'Device', 'cfjoin')}<div class="cfdemo">${cfPoint()}</div>`, hc: 'mse',
      body: () => CF.mtab === 'mouse' ? [{ r: [rSg('mBtn', 'Primary button', 'The one you click with', [['left', 'Left'], ['right', 'Right']]), rRg('mSpeed', 'Pointer speed', '', -100, 100, 1, { lo: 'Slow', hi: 'Fast' }), rSw('mAccel', 'Acceleration', 'The pointer goes further when you move quickly'), rSg('mNat', 'Scrolling', '', [['false', 'Traditional'], ['true', 'Natural']])] }]
        : [{ r: [rSw('tp', 'Touchpad'), rSw('tpType', 'Off while typing'), rRg('tSpeed', 'Pointer speed', '', -100, 100, 1, { lo: 'Slow', hi: 'Fast' })] },
          { h: 'Clicking', r: [rSw('tTap', 'Tap to click', 'A light tap counts as a click'), rRd('tSec', 'two', 'Two fingers for a right click'), rRd('tSec', 'corner', 'Click the bottom right corner to right click')] },
          { h: 'Scrolling', r: [rSg('tScroll', 'Scroll with', '', [['two', 'Two fingers'], ['edge', 'The edge']]), rSg('tNat', 'Direction', 'Natural moves the page with your fingers', [['false', 'Traditional'], ['true', 'Natural']])] }] },
    keyboard: { n: 'Keyboard', i: 'keyboard', g: 'Devices', h: 60, meta: () => `${esc(CF.src)} · ${CF.srcs.length === 1 ? 'one layout' : CF.srcs.length + ' layouts'}`,
      hero: () => `<div class="cfkb" id="cf-kb">${cfKeys()}</div><p class="cfhint">${CF.altKey !== 'off' ? `<i class="cfk1"></i>Hold for accents and symbols` : ''}${CF.compose !== 'off' ? `<i class="cfk2"></i>Compose` : ''}<span>Press a key to try it</span></p>`, hc: 'kbd',
      body: () => [{ h: 'Layouts', r: CF.srcs.map(s => rCu(`<span class="cfgrip">${ic('grip-vertical')}</span><span class="cft"><b>${esc(s)}</b>${s === CF.src ? '<em>In use</em>' : ''}</span><span class="cfc">${s === CF.src ? '' : `<button class="bt fill sm cfbt" type="button" data-cfsrc="${esc(s)}">Use</button>`}${CF.srcs.length > 1 ? `<button class="ib" type="button" data-cfsrcx="${esc(s)}" title="Remove" aria-label="Remove ${esc(s)}">${ic('x')}</button>` : ''}</span>`, { t: s })).concat(rCu(lAddRow('Add a layout', 'data-cfact="addsrc"', 'plus')))
          .concat(CF.srcs.length > 1 ? [rRd('perWin', 'all', 'Same layout in every window'), rRd('perWin', 'win', 'Each window remembers its layout')] : []) },
        { h: 'Typing special characters', r: [rPk('altKey', 'Accents and symbols key', 'Hold it and type a letter', [['off', 'None'], ['AltRight', 'Right Alt'], ['AltLeft', 'Left Alt'], ['ContextMenu', 'Menu']]), rPk('compose', 'Compose key', 'Press it, then two characters: o then e makes œ', [['off', 'None'], ['ContextMenu', 'Menu'], ['CapsLock', 'Caps Lock'], ['ControlRight', 'Right Ctrl']])] },
        { r: [rNv('shortcuts', 'Keyboard shortcuts', 'See and change them', null, { i: 'keyboard' })] }] },
    shortcuts: { n: 'Keyboard shortcuts', up: 'keyboard', meta: () => 'Click a shortcut to change it',
      body: () => CFSHORT.map(([h, list]) => ({ h, r: list.map(([n, k]) => rCu(`<span class="cft"><b>${esc(n)}</b></span><span class="cfc"><button class="cfkeys${CFV.keyEdit === n ? ' edit' : ''}" type="button" data-cfkey="${esc(n)}">${CFV.keyEdit === n ? 'Press the new keys…' : k.split(' ').map(x => `<kbd>${esc(x)}</kbd>`).join('')}</button></span>`, { t: n + ' shortcut' })) })) },
    printers: { n: 'Printers', i: 'printer', g: 'Devices', h: 30, meta: () => 'One printer · ready', top: () => `<button class="bt fill" type="button" data-cfact="addprinter">${ic('plus')}Add printer</button>`,
      hero: () => `<div class="cfprn"><span class="cfbadge">${ic('printer')}</span><div class="cfprnt"><b>Brother HL-L2350DW</b><em><i class="dot"></i>Ready · no jobs waiting</em><div class="cftoner"><span>Toner</span><span class="lprog"><i style="width:64%"></i></span><span>64%</span></div></div><div class="cfnowa"><button class="bt fill" type="button" data-cfact="testpage">Test page</button></div></div>`,
      body: () => [{ h: 'Brother HL-L2350DW', r: [rSw('prDef', 'Default printer'), rPk('prPaper', 'Paper', '', ['Letter', 'A4', 'Legal']), rPk('prDuplex', 'Two-sided', '', [['long', 'Flip on long edge'], ['short', 'Flip on short edge'], ['off', 'One-sided']]), rPk('prProf', 'Color profile', '', ['Automatic', 'Black and white'])] },
        { r: [rBt('rmprinter', 'Remove this printer', '', 'Remove…', { danger: true })] }] },

    apps: { n: 'Apps', i: 'layout-grid', g: 'You', h: 300, meta: () => `${CFAPPS.length} apps · ${cfGB(CFAPPS.reduce((s, a) => s + CFSZ[a].reduce((x, y) => x + y, 0), 0))} with their data`,
      body: () => [{ r: [rNv('defaults', 'Default apps', 'Which app opens links, mail, music and photos', null, { i: 'app-window' }), rNv('media', 'Removable media', 'What happens when you plug in a drive or phone', null, { i: 'usb' })] },
        { h: 'Installed', r: CFAPPS.map(a => rNv('app:' + a, cfName(a), null, cfGB(CFSZ[a].reduce((x, y) => x + y, 0)), { img: cfIco(a), pill: cfCat(a) })) }] },
    defaults: { n: 'Default apps', up: 'apps', meta: () => 'Opens links, files and media',
      body: () => [{ r: [['web', 'Web', ['viola']], ['mail', 'Mail', ['charlie']], ['cal', 'Calendar', ['calendar']], ['music', 'Music', ['tide']], ['video', 'Video', ['viewer', 'reel']], ['photo', 'Photos', ['photos', 'viewer', 'darkroom']]].map(([k, n, o]) => rPk('def.' + k, n, '', o.map(a => [a, cfName(a)]))) }] },
    media: { n: 'Removable media', up: 'apps', meta: () => CF.neverMedia ? 'Nothing opens on its own' : 'When you plug in a drive, phone or disc',
      body: () => [{ r: [rSw('neverMedia', 'Never open anything on its own')] }, { hide: CF.neverMedia, r: [['audio', 'Music'], ['photos', 'Photos'], ['video', 'Videos'], ['software', 'Software']].map(([k, n]) => rPk('media.' + k, n, '', [['ask', 'Ask what to do'], ['folder', 'Open the folder'], ['nothing', 'Do nothing'], ...(k === 'audio' ? [['tide', 'Play in Tide']] : k === 'photos' ? [['photos', 'Import into Photos']] : k === 'video' ? [['viewer', 'Play in Viewer']] : [])])) }] },

    accounts: { n: 'Online Accounts', i: 'at-sign', g: 'You', h: 265, meta: () => 'Two accounts',
      body: () => [{ h: 'Connected', r: [rNv('acct-fm', 'Fastmail', 'nick@studionorth.net', 'Mail, calendar, contacts', { i: 'mail' }), rNv('acct-nc', 'Nextcloud', 'cloud.studionorth.net', 'Files, calendar', { i: 'cloud' })] },
        { h: 'Connect an account', r: [['Google', 'globe'], ['Microsoft 365', 'briefcase'], ['Microsoft Exchange', 'briefcase'], ['Fastmail', 'mail'], ['Nextcloud', 'cloud'], ['Mail (IMAP and SMTP)', 'mail'], ['WebDAV', 'server'], ['Enterprise login', 'key-round']].map(([n, i]) => rBt('connect', n, null, 'Connect…', { i })) }] },
    'acct-fm': { n: 'Fastmail', up: 'accounts', meta: () => 'nick@studionorth.net', body: () => [{ h: 'Use this account for', r: [rSw('fmMail', 'Mail', 'In Charlie'), rSw('fmCal', 'Calendar'), rSw('fmCon', 'Contacts'), rSw('fmFiles', 'Files', 'In Filer')] }, { r: [rBt('rmacct', 'Remove this account', 'Mail and events from it leave this computer', 'Remove…', { danger: true })] }] },
    'acct-nc': { n: 'Nextcloud', up: 'accounts', meta: () => 'cloud.studionorth.net', body: () => [{ h: 'Use this account for', r: [rSw('ncFiles', 'Files', 'In Filer'), rSw('ncCal', 'Calendar'), rSw('ncCon', 'Contacts')] }, { r: [rBt('rmacct', 'Remove this account', '', 'Remove…', { danger: true })] }] },
    privacy: { n: 'Privacy & Security', i: 'shield', g: 'You', h: 150, meta: () => `Screen locks ${CF.lock.auto ? 'when it turns off' : 'only when you lock it'} · location ${CF.loc ? 'on' : 'off'}`,
      hero: () => `<div class="cffacts">${[['Disk encryption', 'On'], ['Secure Boot', 'On'], ['Firmware', 'Up to date']].map(([n, v]) => `<div class="cffact">${ic('shield-check')}<b>${v}</b><em>${n}</em></div>`).join('')}</div>`,
      body: () => [{ r: [rNv('p-lock', 'Screen lock', 'When the screen locks, and what shows on it', null, { i: 'lock' }), rNv('p-loc', 'Location', 'Apps that can see where you are', CF.loc ? 'On' : 'Off', { i: 'map-pin' }), rNv('p-cam', 'Camera', '', CF.cam ? 'On' : 'Off', { i: 'camera' }), rNv('p-mic', 'Microphone', '', CF.mic ? 'On' : 'Off', { i: 'mic' })] },
        { r: [rNv('p-files', 'File history and trash', 'Recent files, the trash and temporary files', null, { i: 'history' }), rNv('p-diag', 'Problem reports', '', { never: 'Off', ask: 'Ask first', auto: 'Automatic' }[CF.diag], { i: 'triangle-alert' }), rNv('p-dev', 'Device security', 'Encryption, Secure Boot and firmware', null, { i: 'shield-check' })] }] },
    'p-lock': { n: 'Screen lock', up: 'privacy', meta: () => CF.lock.auto ? 'Locks when the screen turns off' : 'Locks only when you lock it',
      body: () => [{ r: [rPk('lock.blank', 'Turn the screen off after', '', CFMINS), rSw('lock.auto', 'Lock when the screen turns off'), rPk('lock.delay', 'Lock after', 'Time to wake it without your password', [['0', 'Straight away'], ['30', '30 seconds'], ['60', '1 minute'], ['300', '5 minutes']], { hide: !CF.lock.auto }), rSw('lock.notes', 'Notifications on the lock screen')] }] },
    'p-loc': { n: 'Location', up: 'privacy', top: () => cfTop('loc'), meta: () => CF.loc ? 'Worked out from nearby Wi‑Fi networks' : 'No app can see where you are',
      body: () => [{ hide: !CF.loc, h: 'Apps that asked', r: Object.keys(CF.appLoc).map(a => rSw('appLoc.' + a, cfName(a), a === 'maps' ? 'Last used today' : null, { img: cfIco(a) })) }] },
    'p-cam': { n: 'Camera', up: 'privacy', top: () => cfTop('cam'), meta: () => CF.cam ? 'Apps you allow can use the camera' : 'No app can use the camera',
      body: () => [{ hide: !CF.cam, h: 'Apps that asked', r: Object.keys(CF.appCam).map(a => rSw('appCam.' + a, cfName(a), null, { img: cfIco(a) })) }] },
    'p-mic': { n: 'Microphone', up: 'privacy', top: () => cfTop('mic'), meta: () => CF.mic ? 'Apps you allow can use the microphone' : 'No app can use the microphone',
      body: () => [{ hide: !CF.mic, h: 'Apps that asked', r: Object.keys(CF.appMic).map(a => rSw('appMic.' + a, cfName(a), null, { img: cfIco(a) })) }] },
    'p-files': { n: 'File history and trash', up: 'privacy', meta: () => CF.hist ? 'Remembering files you open' : 'Not remembering files you open',
      body: () => [{ h: 'Recent files', r: [rSw('hist', 'Remember files I open', 'Shown in Recent and in search'), rPk('histKeep', 'Keep for', '', [['1', '1 day'], ['7', '7 days'], ['30', '30 days'], ['forever', 'Forever']], { hide: !CF.hist }), rBt('clearhist', 'Clear recent files', '', 'Clear…', { danger: true })] },
        { h: 'Trash and temporary files', r: [rSw('trash', 'Empty the trash on its own'), rSw('temp', 'Delete temporary files on their own'), rPk('trashAge', 'After', '', [['1', '1 day'], ['7', '7 days'], ['30', '30 days']], { hide: !CF.trash && !CF.temp }), rBt('emptytrash', 'Empty the trash', '1.2 GB in 214 items', 'Empty…', { danger: true }), rBt('cleartemp', 'Delete temporary files', '380 MB', 'Delete…')] }] },
    'p-diag': { n: 'Problem reports', up: 'privacy', meta: () => 'When an app crashes, a report can help the Suno team fix it',
      body: () => [{ r: [rRd('diag', 'never', 'Don’t send'), rRd('diag', 'ask', 'Ask me each time', 'You see what’s in it first'), rRd('diag', 'auto', 'Send automatically')] }] },
    'p-dev': { n: 'Device security', up: 'privacy', meta: () => 'Every check passed',
      body: () => [{ r: [rVl('Disk encryption', 'On', { i: 'lock' }), rVl('Secure Boot', 'On', { i: 'shield-check' }), rVl('TPM', 'Version 2.0', { i: 'cpu' }), rVl('Firmware', 'Up to date', { i: 'refresh-cw' })] },
        { h: 'Thunderbolt', r: [rSw('tbolt', 'Allow new Thunderbolt devices', 'Devices you already use keep working')] }] },
    wellbeing: { n: 'Wellbeing', i: 'hourglass', g: 'You', h: 120, meta: () => `Today ${cfHM(CFWEEK[6][1])} · ${cfHM(Math.round(CFWEEK.reduce((s, x) => s + x[1], 0) / 7))} a day this week`,
      hero: () => cfWeek(),
      body: () => [{ h: 'Screen time', r: [rSw('limit', 'Daily limit'), rPk('limitH', 'Limit', '', ['2', '3', '4', '5', '6', '8'].map(h => [h, h + ' hours']), { hide: !CF.limit }), rSw('gray', 'Grey screen at the limit', 'Colours drain away once you’re over', { hide: !CF.limit })] },
        { h: 'Breaks', r: [rSw('eyes', 'Rest your eyes', 'Look into the distance for 20 seconds, every 20 minutes'), rSw('move', 'Move around', 'A reminder to stand up'), rPk('moveS', 'How often', '', [['5-30', '5 minutes every half hour'], ['5-60', '5 minutes every hour'], ['10-60', '10 minutes every hour']], { hide: !CF.move }), rSw('brSound', 'Sound when a break ends')] }] },
    a11y: { n: 'Accessibility', i: 'accessibility', g: 'You', h: 235, meta: () => { const n = ['hc', 'motion', 'large', 'reader', 'osk', 'sticky', 'slow', 'bounce', 'mkeys', 'zoom', 'vAlert'].filter(k => CF[k]).length; return n ? `${n} turned on` : 'Nothing turned on'; },
      body: () => [{ r: [rSw('a11yMenu', 'In Quick Options', 'Keep these settings one click away')] },
        { r: [rNv('a-see', 'Seeing', 'Contrast, text size, motion, screen reader', null, { i: 'eye' }), rNv('a-hear', 'Hearing', 'Visual alerts', null, { i: 'volume-2' }), rNv('a-type', 'Typing', 'Screen keyboard, repeat keys, typing assist', null, { i: 'keyboard' }), rNv('a-point', 'Pointing and clicking', 'Mouse keys, double-click, hover click', null, { i: 'mouse-pointer-2' }), rNv('a-zoom', 'Zoom', 'Magnify part of the screen', CF.zoom ? 'On' : 'Off', { i: 'zoom-in' })] }] },
    'a-see': { n: 'Seeing', up: 'a11y', meta: () => 'Make things easier to see',
      body: () => [{ r: [rSw('hc', 'High contrast', 'Stronger edges and text'), rSw('motion', 'Less motion', 'Fades instead of slides and zooms'), rSw('large', 'Larger text'), rPk('cursor', 'Pointer size', '', [['default', 'Default'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Larger'], ['xxl', 'Largest']]), rSw('scrollbars', 'Always show scroll bars'), rSw('soundKeys', 'Sound for lock keys', 'A beep when Caps Lock or Num Lock turns on or off')] },
        { h: 'Screen reader', r: [rSw('reader', 'Screen reader', 'Reads out what’s on screen. Super Alt S turns it on or off.'), rBt('reader', 'Voice and speed', '', 'Open…')] }] },
    'a-hear': { n: 'Hearing', up: 'a11y', meta: () => 'See alerts as well as hear them',
      body: () => [{ r: [rSw('vAlert', 'Visual alerts', 'Flash when the alert sound plays'), rSg('vAlertHow', 'Flash', '', [['window', 'The window'], ['screen', 'The whole screen']], { hide: !CF.vAlert }), rBt('flash', 'Try it', '', 'Flash', { hide: !CF.vAlert }), rSw('overamp', 'Over-amplification', 'Lets the volume go past 100%')] }] },
    'a-type': { n: 'Typing', up: 'a11y', meta: () => 'Keyboard help',
      body: () => [{ r: [rSw('osk', 'Screen keyboard', 'Appears when you tap a text field')] }, { h: 'Repeat keys', r: [rSw('rep', 'Repeat when held'), rRg('repDelay', 'Delay', '', 0, 100, 1, { lo: 'Short', hi: 'Long', hide: !CF.rep }), rRg('repSpeed', 'Speed', '', 0, 100, 1, { lo: 'Slow', hi: 'Fast', hide: !CF.rep })] },
        { h: 'Text cursor', r: [rSw('blink', 'Blinking'), rRg('blinkS', 'Speed', '', 0, 100, 1, { lo: 'Slow', hi: 'Fast', hide: !CF.blink })] },
        { h: 'Typing assist', r: [rSw('sticky', 'Sticky keys', 'Press Ctrl, then C, instead of both at once'), rSw('slow', 'Slow keys', 'A key has to be held a moment to count'), rSw('bounce', 'Bounce keys', 'Ignores quick repeats of the same key'), rSw('kbdA11y', 'Turn these on from the keyboard', 'Press Shift five times')] }] },
    'a-point': { n: 'Pointing and clicking', up: 'a11y', meta: () => 'Mouse and click help',
      body: () => [{ r: [rSw('mkeys', 'Mouse keys', 'Move the pointer with the number pad'), rSw('locate', 'Find the pointer', 'Press Ctrl to show where it is'), rRg('dbl', 'Double-click speed', '', 0, 100, 1, { lo: 'Slow', hi: 'Fast' })] },
        { h: 'Click assist', r: [rSw('hold', 'Hold to right click', 'Press and hold the main button'), rSw('hover', 'Hover click', 'Clicks when the pointer rests')] }] },
    'a-zoom': { n: 'Zoom', up: 'a11y', top: () => cfTop('zoom'), meta: () => CF.zoom ? `${CF.zoomX}×` : 'Off · Super Alt = zooms in',
      body: () => [{ r: [rRg('zoomX', 'Magnification', '', 1, 10, .5, { fmt: v => v + '×' }), rPk('zoomF', 'Follow the pointer', '', [['push', 'Push the view along'], ['center', 'Keep it centred'], ['prop', 'Move in proportion']]), rSw('cross', 'Crosshairs'), rSw('invert', 'Invert colors')] }] },

    sharing: { n: 'Sharing', i: 'share-2', g: 'System', h: 185, meta: () => `Visible as “${esc(CF.devName)}” on Studio North`,
      body: () => [{ r: [rTx('devName', 'Computer name', 'How it appears to other devices')] },
        { h: 'On this network', r: [rSw('fileShare', 'File sharing', 'Your Public folder'), rSw('fsPass', 'Ask for a password', null, { hide: !CF.fileShare }), rSw('media2', 'Media sharing', 'Music, videos and photos, for TVs and speakers')] },
        { r: [rNv('remote', 'Remote desktop', 'Use this computer from another one', CF.rdShare || CF.rdLogin ? 'On' : 'Off', { i: 'monitor-up' }), rNv('ssh', 'Secure Shell', 'Sign in from a terminal', CF.ssh ? 'On' : 'Off', { i: 'terminal' })] }] },
    region: { n: 'Region & Language', i: 'languages', g: 'System', h: 95, meta: () => `${CFLANG.find(l => l[0] === CF.lang)[1]} · ${CFFMT[CF.fmt][0]} formats`,
      hero: () => { const f = CFFMT[CF.fmt]; return `<div class="cffmt">${[['Date', f[1]], ['Time', f[2]], ['Number', f[3]], ['Money', f[4]], ['Measures', f[5]], ['Paper', f[6]]].map(([n, v]) => `<div><em>${n}</em><b>${esc(v)}</b></div>`).join('')}</div>`; },
      body: () => [{ h: 'You', r: [rPk('lang', 'Language', 'Menus and windows', CFLANG), rPk('fmt', 'Formats', 'Dates, times, numbers and money', Object.entries(CFFMT).map(([k, v]) => [k, v[0]]))] },
        { h: 'Sign-in screen', r: [rPk('loginLang', 'Language', 'For everyone on this computer', CFLANG)] }] },
    datetime: { n: 'Date & Time', i: 'clock', g: 'System', h: 50, meta: () => `${CFZONE.find(z => z[0] === CF.zone)[1]} · ${CF.autoTime ? 'set automatically' : 'set by hand'}`,
      hero: () => `<div class="cfclock"><b id="cf-time">${cfTime()}</b><em id="cf-date">${cfDate()}</em><span>${ic('map-pin')}${CFZONE.find(z => z[0] === CF.zone)[1]} · ${cfZoneName()}</span></div>`,
      body: () => [{ r: [rSw('autoTime', 'Set the time automatically', 'From the internet'), rBt('settime', 'Date and time', cfDate(), 'Change…', { lock: CF.autoTime ? 'Turn off automatic time first' : null }), rSw('autoZone', 'Set the time zone automatically', 'From your location'), rPk('zone', 'Time zone', '', CFZONE, { lock: CF.autoZone ? 'Turn off automatic time zone first' : null })] },
        { h: 'Clock', r: [rSg('h24', 'Time format', '', [['false', 'AM/PM'], ['true', '24-hour']]), rSw('wday', 'Weekday'), rSw('date', 'Date'), rSw('secs', 'Seconds')] },
        { h: 'Calendar', r: [rSw('wnum', 'Week numbers')] }] },
    users: { n: 'Users', i: 'users', g: 'System', h: 290, meta: () => 'You and Priya',
      hero: () => `<div class="cfid">${av('me', 64)}<div><b>Nick</b><em>Administrator · signed in</em></div><button class="bt fill" type="button" data-cfact="pic">Change picture</button></div>`,
      body: () => [{ h: 'Your account', r: [rBt('pw', 'Password', 'Changed in June', 'Change…', { i: 'key-round' }), rSw('finger', 'Fingerprint', 'Unlock with the reader on the keyboard', { i: 'fingerprint' }), rSw('autoLogin', 'Sign in automatically', 'Anyone who turns on this computer gets in', { i: 'lock-open' }), rVl('Account type', 'Administrator', { s: 'Can install apps and change anything', i: 'user' })] },
        { h: 'Other people', r: [rNv('user-priya', 'Priya Raman', 'Standard · last in yesterday', null, { av: av('PR', 32) }), rCu(lAddRow('Add someone', 'data-cfact="adduser"'))] }] },
    'user-priya': { n: 'Priya Raman', up: 'users', meta: () => 'Standard account', hero: () => `<div class="cfid">${av('PR', 64)}<div><b>Priya Raman</b><em>${CF.pType === 'admin' ? 'Administrator' : 'Standard'} · last in yesterday</em></div></div>`,
      body: () => [{ r: [rSg('pType', 'Account type', '', [['std', 'Standard'], ['admin', 'Administrator']]), rSw('pAuto', 'Sign in automatically'), rBt('parental', 'Parental controls', 'Apps, web and screen time for this person', 'Open…'), rBt('pwreset', 'Password', 'Set a new one for Priya', 'Reset…')] },
        { r: [rBt('rmuser', 'Remove Priya', 'Choose whether her files stay', 'Remove…', { danger: true })] }] },
    remote: { n: 'Remote Desktop', i: 'monitor-up', g: 'System', h: 210, meta: () => CF.rdShare ? 'Others can see this screen' : CF.rdLogin ? 'Others can sign in remotely' : 'Off',
      top: () => seg([['share', 'Share this screen'], ['login', 'Sign in remotely']], CF.rdTab, 'data-cfrdt', 'Mode', 'cftabs'),
      body: () => CF.rdTab === 'share' ? [{ r: [rSw('rdShare', 'Desktop sharing', 'Someone can see your screen while you’re signed in'), rSw('rdCtl', 'Let them use the mouse and keyboard', null, { hide: !CF.rdShare })] }, !CF.rdShare ? null : cfConn()]
        : [{ r: [rSw('rdLogin', 'Remote sign-in', 'Sign in to this computer when nobody is using it')] }, !CF.rdLogin ? null : cfConn()] },
    ssh: { n: 'Secure Shell', i: 'terminal', g: 'System', h: 160, meta: () => CF.ssh ? 'Signing in from a terminal is allowed' : 'Off',
      body: () => [{ r: [rSw('ssh', 'Secure Shell', 'Sign in to this computer from a terminal elsewhere')] }, CF.ssh && { h: 'Connect with', r: [rVl('Command', 'ssh nick@nicks-thinkpad.local', { mono: true, copy: true })] }] },
    about: { n: 'About', i: 'info', g: 'System', h: 250, meta: () => `${esc(CF.devName)} · SunoOS 0.1`,
      hero: () => `<div class="cfabout"><img src="${FAV}" alt=""><div><b>SunoOS 0.1</b><em>Nightly · 23 September 2026</em><span><i class="dot"></i>Up to date</span></div><button class="bt fill" type="button" data-cfopen="depot">Updates</button></div>`,
      body: () => [{ r: [rTx('devName', 'Computer name')] },
        { h: 'Hardware', r: [rVl('Model', 'ThinkPad X1 Carbon Gen 12'), rVl('Memory', '32 GB'), rVl('Processor', 'Intel Core Ultra 7 155U'), rVl('Graphics', 'Intel Arc'), rNv('~disks', 'Storage', '215 GB used of 512 GB', 'Open Disks')] },
        { h: 'Software', r: [rVl('Updates', 'Nightly channel', { s: 'Change it in Depot' }), rNv('about-sys', 'System details', 'For support and bug reports')] }] },
    'about-sys': { n: 'System details', up: 'about', meta: () => 'Copy these into a bug report', top: () => `<button class="bt fill" type="button" data-cfact="copysys">${ic('copy')}Copy all</button>`,
      body: () => [{ r: [rVl('Suno', '1.0 nightly 20260923', { mono: true }), rVl('Kernel', 'Linux 6.16.8-suno1', { mono: true }), rVl('Desktop', 'Suno Shell 1.0 on Wayland', { mono: true }), rVl('Firmware', 'N3XET47W (1.22)', { mono: true }), rVl('Processor', 'Intel Core Ultra 7 155U × 14', { mono: true }), rVl('Graphics', 'Intel Arc (MTL)', { mono: true }), rVl('Disk', 'Samsung PM9C1a 512 GB', { mono: true })] }] }
  };
  const cfGB = mb => mb >= 1000 ? (mb / 1000).toFixed(1).replace(/\.0$/, '') + ' GB' : mb + ' MB';
  const cfConn = () => ({ h: 'How to connect', r: [rVl('Address', 'nicks-thinkpad.local', { mono: true, copy: true }), rVl('Username', 'nick', { mono: true, copy: true }), rVl('Password', CFV.rev ? 'tern-5ivy-quartz' : '••••••••••', { mono: true }), rBt('reveal', 'Show password', '', CFV.rev ? 'Hide' : 'Show')] });
  const cfTime = () => new Date().toLocaleTimeString(CF.h24 ? 'en-GB' : 'en-US', { timeZone: CF.zone, hour: 'numeric', minute: '2-digit', ...(CF.secs ? { second: '2-digit' } : {}) });
  const cfDate = () => new Date().toLocaleDateString('en-US', { timeZone: CF.zone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const cfZoneName = () => new Intl.DateTimeFormat('en-US', { timeZone: CF.zone, timeZoneName: 'long' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName').value;
  function cfAppPage(a) { if (CFAP[a]) return CFAP[a]; const perms = CFPERMS[a] || ['notif', 'search'], sz = CFSZ[a] || [20, 10, 5]; perms.forEach(p => { if (CF['perm_' + a + p] == null) CF['perm_' + a + p] = true; });
    return CFAP[a] = { n: cfName(a), up: 'apps', meta: () => `Version 1.0 · from Depot · ${cfGB(sz[0] + sz[1] + sz[2])}`,
      hero: () => `<div class="cfid"><img class="cfappi" src="${cfIco(a)}" alt=""><div><b>${esc(cfName(a))}</b><em>From Depot · updates with Suno</em></div><button class="bt fill" type="button" data-cfopen="${a}">Open</button></div>`,
      body: () => [{ h: 'Allowed to', r: perms.map(p => rSw('perm_' + a + p, CFPERM[p][0], CFPERM[p][1])) },
        { h: 'Storage', r: [rVl('App', cfGB(sz[0])), rVl('Documents and data', cfGB(sz[1])), rVl('Cache', cfGB(sz[2])), rBt('clearcache', 'Clear cache', 'It fills up again as you use the app', 'Clear')] },
        CFSYS.includes(a) ? { r: [rVl('Part of Suno', '', { i: 'lock', s: `${esc(cfName(a))} comes with the system and updates with it, so it can’t be uninstalled` })] } : { r: [rBt('uninstall', `Uninstall ${cfName(a)}`, 'Keeps your documents unless you choose otherwise', 'Uninstall…', { danger: true })] }] }; }
  const CFSYS = ['filer', 'viola', 'term', 'depot', 'settings'], cfCat = a => { const d = typeof app === 'function' && app({ term: 'terminal', memos: 'memo' }[a] || a); return d ? lCat(d.cat) : ''; };
  const cfPg = id => id.startsWith('app:') ? cfAppPage(id.slice(4)) : CFP[id] || CFP.wifi;
  const CFGRPS = [['', ['wifi', 'network', 'bluetooth']], ['Desktop', ['appearance', 'shelf', 'windows', 'notifications', 'search']], ['Devices', ['displays', 'sound', 'power', 'mouse', 'keyboard', 'printers']],
    ['You', ['apps', 'accounts', 'privacy', 'wellbeing', 'a11y']], ['System', ['sharing', 'region', 'datetime', 'users', 'remote', 'ssh', 'about']]];
  const cfRoot = id => { let p = cfPg(id), k = id; while (p.up) { k = p.up; p = cfPg(k); } return k; };

  /* ── Hero drawings ─────────────────────────────────────────────────────────── */
  function cfNetRow(n) { const open = CFV.joinNet === n.n, conn = CFV.connecting === n.n;
    return `<button class="cfnet" type="button" data-cfnet="${esc(n.n)}">${cfBars(n.sig)}<span class="cft"><b>${esc(n.n)}</b>${conn ? '<em>Connecting…</em>' : n.known ? '<em>Saved</em>' : ''}</span><span class="cfc">${n.lock ? ic('lock') : ''}</span></button>${open ? `<div class="cfjoinf"><input type="password" placeholder="Password" data-cfpass aria-label="Password for ${esc(n.n)}"><button class="bt" type="button" data-cfnet="">Cancel</button><button class="bt pri" type="button" data-cfjoin2="${esc(n.n)}">Join</button></div>` : ''}`; }
  function cfQR(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; const N = 25, cells = [], fin = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([a, b]) => x >= a && x < a + 7 && y >= b && y < b + 7);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (fin(x, y)) continue; h = (h * 1103515245 + 12345) >>> 0; if ((h >> 16) & 1) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`); }
    const f = (a, b) => `<rect x="${a}" y="${b}" width="7" height="7"/><rect x="${a + 1}" y="${b + 1}" width="5" height="5" fill="#fff"/><rect x="${a + 2}" y="${b + 2}" width="3" height="3"/>`;
    return `<svg class="cfqr" viewBox="-2 -2 ${N + 4} ${N + 4}"><rect x="-2" y="-2" width="${N + 4}" height="${N + 4}" fill="#fff"/><g fill="#111">${cells.join('')}${f(0, 0)}${f(N - 7, 0)}${f(0, N - 7)}</g></svg>`; }
  function cfArr() { if (CF.join === 'mirror') return `<div class="cfmon mirror on" style="left:50%;top:50%;width:190px;height:110px;transform:translate(-50%,-50%)"><b>Both</b><em>3840 × 2160</em></div>`;
    const sz = k => { const d = CF.d[k], [w, h] = d.res.split(' × ').map(Number), s = +d.scale / 100, rot = /Portrait/.test(d.rot); return rot ? [h / s, w / s] : [w / s, h / s]; };
    const [iw, ih] = sz('int'), [ew, eh] = sz('ext'), a = CF.arr; let ex, ey;
    if (a.side === 'top') { ex = (iw - ew) * a.off; ey = -eh; } else if (a.side === 'left') { ex = -ew; ey = (ih - eh) * a.off; } else { ex = iw; ey = (ih - eh) * a.off; }
    const x0 = Math.min(0, ex), y0 = Math.min(0, ey), W = Math.max(iw, ex + ew) - x0, H = Math.max(ih, ey + eh) - y0, k = Math.min(520 / W, 190 / H), ox = (560 - W * k) / 2, oy = (216 - H * k) / 2;
    CFV.ak = { k, ox, oy, x0, y0, iw, ih, ew, eh };
    const box = (id, x, y, w, h, n) => `<div class="cfmon${CF.dsel === id ? ' on' : ''}" data-cfdisp="${id}" style="left:${ox + (x - x0) * k}px;top:${oy + (y - y0) * k}px;width:${w * k - 4}px;height:${h * k - 4}px"><b>${n}</b><em>${CF.d[id].primary ? 'Main' : ''}</em></div>`;
    return box('int', 0, 0, iw, ih, 'Built-in') + box('ext', ex, ey, ew, eh, 'Dell'); }
  function cfShelf() { const e = CF.edge, sp = CF.spread === 'spread', jn = CF.joined === 'joined', at = CF.float === 'edge', split = CF.preset === 'split', free = CF.preset === 'free', vert = e !== 'bottom';
    const apps = ['filer', 'viola', 'tide', 'messages', 'charlie', 'photos', 'write'].map(a => `<img src="${cfIco(a)}" alt="">`).join('');
    const clock = `<span class="cfclk">${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/ ?[AP]M/, '')}</span>`;
    const cls = `cfsh ${vert ? 'v ' + e : 'h'}${at ? ' at' : ''}`;
    if (free) return `<div class="${cls} free" style="left:18px;bottom:14px">${apps}</div><div class="cfsh h free" style="right:18px;top:14px">${clock}</div>`;
    if (split) return `<div class="${cls} mid">${apps}</div><div class="cfsh h top${at ? ' at' : ''}">${clock}</div>`;
    if (jn) return `<div class="${cls} full${sp ? '' : ' mid'}">${apps}<span class="cfsp"></span>${clock}</div>`;
    return `<div class="${cls} ${sp ? 'mid' : 'pair'}">${apps}</div><div class="${cls} ${sp ? 'end' : 'pair2'}">${clock}</div>`; }
  function cfTiles() { const g = CF.gap * .6 + 2, W = 360, H = 176;
    const t = CF.tile ? [[g, g, W * .56 - g * 1.5, H - g * 2], [W * .56 + g * .5, g, W * .44 - g * 1.5, H / 2 - g * 1.5], [W * .56 + g * .5, H / 2 + g * .5, W * .44 - g * 1.5, H / 2 - g * 1.5]] : [[22, 18, 200, 120], [120, 44, 190, 112], [70, 70, 160, 92]];
    return `<div class="cftiles" style="background-image:url('${WP}${CF.wall}.png')">${t.map(([x, y, w, h], i) => `<i style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${3 - i}"><img src="${cfIco(['write', 'viola', 'messages'][i])}" alt=""></i>`).join('')}</div>`; }
  function cfBatDay() { const L = [100, 100, 100, 100, 100, 100, 99, 97, 93, 86, 79, 71, 64, 80, 94, 88, 78], now = L.length; let h = '';
    for (let i = 0; i < 24; i++) { const v = L[i], ch = i > 0 && L[i] > L[i - 1] || i < 7; h += `<i class="${v == null ? 'fut' : ch ? 'chg' : ''}" style="height:${v == null ? 6 : Math.max(6, v * .56)}px"></i>`; }
    return `<div class="cfbars">${h}</div><div class="cfdayl"><span>Midnight</span><span>6 AM</span><span>Noon</span><span>6 PM</span><span></span></div>`; }
  function cfPoint() { const nat = CF.mtab === 'mouse' ? CF.mNat : CF.tNat;
    const dir = CF.mtab === 'mouse' ? (nat ? 'down' : 'up') : (nat ? 'up' : 'down'), page = `<div class="cfpg ${dir}"><div>${'<i></i>'.repeat(9)}</div></div>`;
    return CF.mtab === 'mouse' ? `<div class="cfmouse ${CF.mBtn}"><i class="l"></i><i class="r"></i><i class="wh"></i></div>${page}<p class="cfdl"><b>${nat ? 'Natural' : 'Traditional'}</b><em>Roll the wheel towards you and the page moves ${nat ? 'down' : 'up'}</em></p>`
      : `<div class="cfpad${CF.tp ? '' : ' off'}"><i></i><i></i></div>${page}<p class="cfdl"><b>${nat ? 'Natural' : 'Traditional'}</b><em>${nat ? 'The page follows your fingers' : 'Fingers move the scroll bar, the page goes the other way'}</em></p>`; }
  function cfKeys() { const L = CFKB.L[CF.src] || CFKB.L['English (US)'];
    return CFKB.codes.map((row, r) => `<div class="cfkr">${row.map((c, i) => { const lab = L[r].split(' ')[i] || ''; return `<kbd data-code="${c}" style="flex:${CFKB.w[c] || 1}" class="${CF.altKey === c ? 'k1' : ''}${CF.compose === c ? ' k2' : ''}${lab.length > 1 ? ' wd' : ''}">${lab === '_' ? '' : esc(lab)}</kbd>`; }).join('')}</div>`).join(''); }
  function cfWeek() { const mx = 420, avg = CFWEEK.reduce((s, x) => s + x[1], 0) / 7, lim = CF.limit ? +CF.limitH * 60 : null;
    return `<div class="cfweek"><div class="cfwb">${CFWEEK.map(([d, m], i) => `<div class="${i === 6 ? 'today' : ''}${lim && m > lim ? ' over' : ''}"><span>${cfHM(m)}</span><i style="height:${m / mx * 130}px"></i><em>${d}</em></div>`).join('')}<hr style="bottom:${avg / mx * 130 + 21}px" title="Daily average">${lim ? `<hr class="lim" style="bottom:${lim / mx * 130 + 21}px" title="Daily limit">` : ''}</div></div>`; }

  /* ── Drawing ───────────────────────────────────────────────────────────────── */
  function cfSide() { const q = CFV.q.toLowerCase(), hits = q ? cfSearch(q) : null;
    const row = id => { const p = CFP[id], n = hits ? hits.filter(h => cfRoot(h.pg) === id).length : 0, on = !hits && cfRoot(CFV.pg) === id;
      return `<button class="si${on ? ' on' : ''}${hits && !n ? ' dim' : ''}" type="button" data-cfp="${id}">${ic(p.i)}<span class="lab">${esc(p.n)}</span>${hits ? lCount(n) : p.em ? `<em>${esc(p.em())}</em>` : ''}</button>`; };
    $('#cf-nav').innerHTML = `<button class="cfme lacct${cfRoot(CFV.pg) === 'me' && !hits ? ' on' : ''}" type="button" data-cfp="me">${av('me', 34)}<span><b>Nick</b><em>Suno account</em></span>${ic('chevron-right')}</button>` + CFGRPS.map(([h, ids]) => `${h ? `<div class="sh">${h}</div>` : ''}${ids.map(row).join('')}`).join('');
  }
  function cfMain() { const b = $('#cf-body'), w = $('#w-settings'); CFV.pk = {};
    if (CFV.q) { const hits = cfSearch(CFV.q.toLowerCase()), by = []; hits.forEach(h => { let g = by.find(x => x.pg === h.pg); if (!g) by.push(g = { pg: h.pg, r: [] }); if (h.r) g.r.push(h.r); });
      w.style.setProperty('--cfh', 250);
      b.innerHTML = `<div class="cfpage"><header class="cfhd"><div><h1>${hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'No results'}</h1><p>${hits.length ? `For “${esc(CFV.q)}”. Change them right here.` : `Nothing matches “${esc(CFV.q)}”`}</p></div></header>
        ${by.map(g => { const p = cfPg(g.pg), crumb = p.up ? `${esc(cfPg(p.up).n)} › ${esc(p.n)}` : esc(p.n); return `<section class="cfgrp"><h6><button class="cfcrumb" type="button" data-cfp="${g.pg}">${crumb}${ic('chevron-right')}</button></h6>${g.r.length ? `<div class="cfcard">${g.r.map(cfRow).join('')}</div>` : ''}</section>`; }).join('')}</div>`;
      b.dataset.pg = ''; return; }
    const p = cfPg(CFV.pg), same = b.dataset.pg === CFV.pg, y = b.scrollTop, up = p.up ? cfPg(p.up) : null;
    w.style.setProperty('--cfh', p.h ?? cfPg(cfRoot(CFV.pg)).h ?? CF.acc);
    const hero = p.hero ? p.hero() : '';
    b.innerHTML = `<div class="cfpage">${up ? `<button class="cfback" type="button" data-cfp="${p.up}">${ic('chevron-left')}${esc(up.n)}</button>` : ''}
      <header class="cfhd"><div><h1>${esc(p.n)}</h1><p>${p.meta ? p.meta() : ''}</p></div>${p.top ? `<div class="cfhda">${p.top()}</div>` : ''}</header>
      ${hero ? `<div class="cfhero ${p.hc || ''}">${hero}</div>` : ''}${cfGroups(p.body ? p.body() : [])}</div>`;
    b.dataset.pg = CFV.pg; b.scrollTop = same ? y : 0; cfIsl(p, up); }
  /* phone: Back and the page are one title island: ‹ (to the parent page, or the list) | the page and its summary */
  function cfIsl(p, up) { const w = $('#w-settings'); let i = $('#cf-isl'); if (!w.classList.contains('phone') || w.classList.contains('navopen') || CFV.q) { i?.remove(); return; }
    if (!i) { $('#cf-body').parentElement.insertAdjacentHTML('beforeend', '<div class="cfisl" id="cf-isl"></div>'); i = $('#cf-isl'); }
    const meta = (p.meta ? p.meta() : '').replace(/<[^>]+>/g, '');
    i.innerHTML = `<button class="cfislb" type="button" ${up ? `data-cfp="${p.up}"` : 'data-cfislback'} aria-label="Back to ${esc(up ? up.n : 'Settings')}">${ic('chevron-left')}</button><span class="cfisli"><b>${esc(p.n)}</b>${meta ? `<small>${esc(meta)}</small>` : ''}</span>`; }
  function cfAll() { cfSide(); cfMain(); }
  function cfSearch(q) { const out = [], seen = new Set();
    const pages = [...Object.keys(CFP), ...CFAPPS.map(a => 'app:' + a)];
    pages.forEach(id => { const p = cfPg(id); let rows = []; try { rows = (p.body ? p.body() : []).filter(Boolean).flatMap(g => g.hide ? [] : g.r.filter(r => r && !r.hide)); } catch (e) { rows = []; }
      const pm = p.n.toLowerCase().includes(q) && !id.startsWith('app:');
      rows.forEach(r => { const t = `${r.t || ''} ${(r.s || '').replace(/<[^>]+>/g, '')}`.toLowerCase(); if ((t.includes(q) || (pm && out.filter(o => o.pg === id).length < 3)) && !seen.has(id + (r.t || '') + (r.key || ''))) { seen.add(id + (r.t || '') + (r.key || '')); out.push({ pg: id, r }); } });
      if (pm && !out.some(o => o.pg === id)) out.push({ pg: id }); });
    return out.slice(0, 40); }

  function cfPop(anchor, html) { $('#cf-pop')?.remove(); const w = $('#w-settings'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop cfpop ldrawer" id="cf-pop">${html}</div>`); const p = $('#cf-pop');
    p.style.minWidth = Math.max(200, r.width) + 'px'; p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.right - wr.left - p.offsetWidth)) + 'px';
    const below = r.bottom - wr.top + 6; if (below + p.offsetHeight > wr.height - 8) p.style.top = Math.max(8, r.top - wr.top - p.offsetHeight - 6) + 'px'; else p.style.top = below + 'px'; }
  const cfToast = (msg, icon) => lToast($('#w-settings'), msg, { icon: icon || (/^Copied|copied$/.test(msg) ? 'copy' : /^Opening|^Opens/.test(msg) ? 'square-arrow-out-up-right' : 'check') });
  /* Anything that can't come back asks through the standard SunoUI destructive dialog; the sheet stays for forms (join, add, change) */
  function cfSheet(h, line, go, label, danger, extra = '') { if (danger) { lConfirm($('#w-settings'), { title: h.replace(/&amp;/g, '&').replace(/&#39;|&quot;/g, "'"), body: line, action: label, icon: label === 'Sign out' ? 'log-out' : 'trash-2', onOK: () => go?.() }); return; } CFV.sheet = go;
    /* A form grows the bar in place (SunoUI action center), never a sheet over the page: a header naming the task, one labelled row per
       field, then Cancel and the action. Esc or Cancel folds it away; Enter does the action. */
    const icon = { Join: 'wifi', Change: 'key-round', Add: 'user-plus', 'Import file…': 'shield', Done: 'qr-code' }[label] || 'settings';
    const fields = /class="cfform"/.test(extra) ? [...extra.matchAll(/<input ([^>]*)>/g)].map(m => { const a = m[1], l = (a.match(/aria-label="([^"]*)"/) || [])[1] || ''; return `<div class="lacf"><label>${l}</label><input ${a.replace(/placeholder="[^"]*"/, `placeholder="${/password/i.test(l) ? 'Required' : 'Type here'}"`)}></div>`; }).join('') : '';
    const s = $('#cf-sheet'); s.innerHTML = `<div class="lach"><span class="lacmode">${ic(icon)}${h}</span><span>${line || ''}</span></div>${fields}${fields || !extra ? '' : `<div class="cflacb">${extra}</div>`}
      <div class="lacft"><span class="sp"></span>${go ? '<button class="bt" type="button" data-cfclose>Cancel</button>' : ''}<button class="bt key" type="button" data-cfgo>${label}</button></div>`;
    lAC.open(s); lAC.bind(s, () => cfShut()); setTimeout(() => (s.querySelector('input') || s.querySelector('[data-cfgo]'))?.focus({ preventScroll: true }), 60); }
  const cfShut = () => { CFV.sheet = null; const s = $('#cf-sheet'); if (s) s.hidden = true; };

  /* Display changes wait for a yes, and go back on their own if the picture is gone */
  function cfKeep() { if (!CFV.keep) CFV.keep = { snap: JSON.parse(JSON.stringify({ d: CF.d, arr: CF.arr, join: CF.join })), n: 15 };
    else CFV.keep.n = 15;
    const bar = $('#cf-bar'); bar.hidden = false; const draw = () => { bar.innerHTML = `<span class="cfkq">Keep these display settings?</span><span class="cfkn">Going back in ${CFV.keep.n} s</span><button class="bt" type="button" data-cfrevert>Go back</button><button class="bt key" type="button" data-cfkeep>Keep</button>`; };
    draw(); clearInterval(cfKeep.t); cfKeep.t = setInterval(() => { if (!CFV.keep) return clearInterval(cfKeep.t); CFV.keep.n--; if (CFV.keep.n <= 0) cfRevert(); else draw(); }, 1000); }
  function cfRevert() { if (CFV.keep) Object.assign(CF, JSON.parse(JSON.stringify(CFV.keep.snap))); cfKept(); cfMain(); cfToast('Display settings put back'); }
  function cfKept() { CFV.keep = null; clearInterval(cfKeep.t); $('#cf-bar').hidden = true; }

  function cfFx(k) {
    if (k === 'acc') document.documentElement.style.setProperty('--acc', CF.acc);
    if (k === 'wall') { document.body.style.setProperty('--wall', `url("${new URL(WP + CF.wall + '.png', location.href).href}")`); window.lumaDesk?.wall(CF.wall); }
    if (k === 'large') $('#cf-body').classList.toggle('big', CF.large);
    if (k === 'hc') $('#w-settings').classList.toggle('cfhc', CF.hc);
    if (k === 'dnd') window.lumaShell?.dnd(CF.dnd);
    if (k === 'airplane' && CF.airplane) { CF.wifi = false; CF.bt = false; }
    if ((k === 'wifi' || k === 'bt') && cfG(k)) CF.airplane = false;
    if (k === 'wifi' && !CF.wifi) CFV.joinNet = null;
    if (k === 'bt' && CF.bt) cfScan();
    if (k === 'autoTime' || k === 'autoZone') {}
    if (/^d\.(int|ext)\.primary$/.test(k)) { const o = k.includes('int') ? 'ext' : 'int'; CF.d[o].primary = !cfG(k); }
    if (/^d\.|^join$|^arr$/.test(k) && !/bright|prof|primary/.test(k)) cfKeep();
    if (['edge', 'spread', 'joined', 'float'].includes(k)) CF.preset = CFPRE.find(p => Object.entries(p[2]).every(([a, b]) => CF[a] === b) && !['split', 'free'].includes(p[0]))?.[0] || 'custom';
  }
  function cfScan() { CFV.near = 0; clearTimeout(cfScan.t); const next = () => { if (CFV.pg !== 'bluetooth' || !CF.bt || CFV.near >= CFNEAR.length) return; CFV.near++; if (!CFV.q) cfMain(); cfScan.t = setTimeout(next, 2200); }; cfScan.t = setTimeout(next, 1400); }
