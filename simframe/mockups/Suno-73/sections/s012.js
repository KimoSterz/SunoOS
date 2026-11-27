
  function cfGo(id) { if (id === '~disks') { cfOpenApp('disks'); return; } CFV.pg = id; CFV.joinNet = null; CFV.keyEdit = null; if (CFV.q) { CFV.q = ''; $('#cf-q').value = ''; } $('#cf-pop')?.remove(); cfAll(); if (id === 'bluetooth') cfScan(); }
  function cfOpenApp(a) { const w = $('#w-' + a); if (w) { w.hidden = false; w.classList.remove('min'); focusWin(w); } cfToast(`Opening ${cfName(a)}`); }

  function settingsClick(e, hit) { const q = s => hit(s);
    if (q('button[disabled]')) return true;
    if (!q('#cf-pop') && !q('[data-cfpk],[data-cfact="addsrc"]')) $('#cf-pop')?.remove();
    if (CFV.keyEdit && !q('[data-cfkey]')) { CFV.keyEdit = null; cfMain(); }
    const p = q('[data-cfp]'); if (p) { cfGo(p.dataset.cfp); return true; }
    const s = q('[data-cfsw]'); if (s) { const k = s.dataset.cfsw; cfS(k, !cfG(k)); cfFx(k); cfAll(); return true; }
    const st = q('[data-cfset]'); if (st) { const [k, v] = st.dataset.cfset.split('|'); cfS(k, v); $('#cf-pop')?.remove(); cfFx(k); cfAll(); return true; }
    const pkb = q('[data-cfpk]'); if (pkb) { const k = pkb.dataset.cfpk, cur = String(cfG(k)); if ($('#cf-pop')?.dataset.k === k) { $('#cf-pop').remove(); return true; }
      cfPop(pkb, cfOP(CFV.pk[k] || []).map(([v, n]) => `<button class="crmi${String(v) === cur ? ' on' : ''}" type="button" data-cfset="${k}|${v}"><span>${esc(n)}</span>${String(v) === cur ? ic('check') : ''}</button>`).join('')); $('#cf-pop').dataset.k = k; return true; }
    const sa = q('[data-cfsa]'); if (sa) { const x = CF.sa[+sa.dataset.cfsa]; x[1] = !x[1]; cfMain(); return true; }
    const cp = q('[data-cfcopy]'); if (cp) { navigator.clipboard?.writeText(cp.dataset.cfcopy).catch(() => {}); cfToast('Copied'); return true; }
    const op = q('[data-cfopen]'); if (op) { cfOpenApp(op.dataset.cfopen); return true; }
    if (q('[data-cfclose]')) { cfShut(); return true; }
    if (q('[data-cfgo]')) { const f = CFV.sheet; cfShut(); f?.(); return true; }
    if (q('[data-cfkeep]')) { cfKept(); cfToast('Display settings kept'); return true; }
    if (q('[data-cfrevert]')) { cfRevert(); return true; }
    const jn = q('[data-cfjoin]'); if (jn) { CF.join = jn.dataset.cfjoin; cfFx('join'); cfMain(); return true; }
    const dp = q('[data-cfdisp]'); if (dp) { if (!CFV.dragged) { CF.dsel = dp.dataset.cfdisp; cfMain(); } return true; }
    const mt = q('[data-cfmtab]'); if (mt) { CF.mtab = mt.dataset.cfmtab; cfMain(); return true; }
    const rt = q('[data-cfrdt]'); if (rt) { CF.rdTab = rt.dataset.cfrdt; cfMain(); return true; }
    if (q('[data-cfislback]')) { $('#w-settings > .phback')?.click(); return true; }
    const md = q('[data-cfmode]'); if (md) { $(`[data-set-mode="${md.dataset.cfmode}"]`)?.click(); cfAll(); return true; }
    const ac = q('[data-cfacc]'); if (ac) { CF.acc = +ac.dataset.cfacc; cfFx('acc'); cfAll(); return true; }
    const wl = q('[data-cfwall]'); if (wl) { CF.wall = wl.dataset.cfwall; cfFx('wall'); cfAll(); return true; }
    const pr = q('[data-cfpre]'); if (pr) { const x = CFPRE.find(p => p[0] === pr.dataset.cfpre); CF.preset = x[0]; Object.assign(CF, x[2]); cfAll(); return true; }
    const ou = q('[data-cfout]'); if (ou) { CF.out = ou.dataset.cfout; cfAll(); cfToast(`Sound now plays through ${CFOUT.find(o => o.id === CF.out).n}`); return true; }
    const nt = q('[data-cfnet]'); if (nt) { const n = CFNETS.find(x => x.n === nt.dataset.cfnet); if (!n) { CFV.joinNet = null; cfMain(); return true; }
      if (n.lock && !n.known) { CFV.joinNet = CFV.joinNet === n.n ? null : n.n; cfMain(); setTimeout(() => $('[data-cfpass]')?.focus(), 40); return true; }
      cfConnect(n.n); return true; }
    const j2 = q('[data-cfjoin2]'); if (j2) { const n = CFNETS.find(x => x.n === j2.dataset.cfjoin2); n.known = true; CFV.joinNet = null; cfConnect(n.n); return true; }
    const pa = q('[data-cfpair]'); if (pa) { const d = CFNEAR.find(x => x.id === pa.dataset.cfpair); if (CFV.pairing) return true; CFV.pairing = d; cfMain();
      setTimeout(() => { CFNEAR.splice(CFNEAR.indexOf(d), 1); CFV.near = Math.max(0, CFV.near - 1); CFBT.push({ id: d.id, n: d.n, i: d.i, kind: d.kind, on: true, bat: d.id === 'k2' ? 90 : null }); CFV.pairing = null; cfAll(); cfToast(`${d.n} is connected`); }, d.code ? 3200 : 1600); return true; }
    const bc = q('[data-cfbtc]'); if (bc) { const d = CFBT.find(x => x.id === bc.dataset.cfbtc); d.on = !d.on; cfAll(); return true; }
    const bx = q('[data-cfbtx]'); if (bx) { const d = CFBT.find(x => x.id === bx.dataset.cfbtx); cfSheet(`Forget ${esc(d.n)}?`, 'You’ll need to pair it again to use it.', () => { CFBT.splice(CFBT.indexOf(d), 1); cfAll(); }, 'Forget', true); return true; }
    const fg = q('[data-cfforget]'); if (fg) { const n = fg.dataset.cfforget; cfSheet(`Forget ${esc(n)}?`, 'This computer won’t join it on its own any more, and the password is removed.', () => { CFKNOWN.splice(CFKNOWN.indexOf(n), 1); if (CF.net === n) CF.net = null; const x = CFNETS.find(z => z.n === n); if (x) x.known = false; cfAll(); }, 'Forget', true); return true; }
    const ky = q('[data-cfkey]'); if (ky) { CFV.keyEdit = CFV.keyEdit === ky.dataset.cfkey ? null : ky.dataset.cfkey; cfMain(); return true; }
    const sr = q('[data-cfsrc]'); if (sr) { CF.src = sr.dataset.cfsrc; cfMain(); return true; }
    const sx = q('[data-cfsrcx]'); if (sx) { CF.srcs = CF.srcs.filter(x => x !== sx.dataset.cfsrcx); if (!CF.srcs.includes(CF.src)) CF.src = CF.srcs[0]; cfMain(); return true; }
    const as = q('[data-cfaddsrc]'); if (as) { const n = as.dataset.cfaddsrc; if (!CF.srcs.includes(n)) CF.srcs.push(n); $('#cf-pop')?.remove(); cfMain(); return true; }
    const a = q('[data-cfact]'); if (a) { cfAct(a.dataset.cfact, a); return true; }
    return false; }
  function cfConnect(n) { CFV.connecting = n; cfMain(); setTimeout(() => { CF.net = n; CFV.connecting = null; if (!CFKNOWN.includes(n)) CFKNOWN.push(n); cfAll(); }, 1300); }
  function cfAct(k, el) { const T = {
      qr: () => { const n = CF.net || 'Studio North'; cfSheet(`Join ${esc(n)}`, 'Point a phone’s camera at the code.', null, 'Done', false, `<div class="cfqrw big">${cfQR(n + 'wpa3')}<div><em>Password</em><span class="mono">maple-harbor-2208</span></div></div>`); },
      forget: () => cfSheet(`Forget ${esc(CF.net)}?`, 'This computer won’t join it on its own any more, and the password is removed.', () => { CFKNOWN.splice(CFKNOWN.indexOf(CF.net), 1); CFNETS.find(z => z.n === CF.net).known = false; CF.net = null; cfGo('wifi'); }, 'Forget', true),
      hidden: () => cfSheet('Join a hidden network', 'Type its name exactly as it was set up.', () => cfToast('Looking for the network…'), 'Join', false, `<div class="cfform"><input placeholder="Network name" aria-label="Network name"><input type="password" placeholder="Password" aria-label="Password"></div>`),
      vpnadd: () => cfSheet('Add a VPN', 'Import a file from your VPN provider, or enter the details.', () => cfToast('Choose a file to import'), 'Import file…'),
      btsend: () => cfToast('Choose files, then a device'),
      addwall: () => cfToast('Choose a picture in Filer'),
      nightoff: () => { CF.night = false; cfAll(); cfToast('Night Light is off until tomorrow'); },
      test: () => { CFV.test = Date.now(); cfMain(); setTimeout(() => { CFV.test = 0; if (CFV.pg === 'sound') cfMain(); }, 3000); },
      addsrc: () => { const opts = Object.keys(CFKB.L).concat(['Español', 'Italiano', '日本語', '한국어']).filter(x => !CF.srcs.includes(x)); cfPop(el, `<h6>Add a layout</h6>` + opts.map(n => `<button class="crmi" type="button" data-cfaddsrc="${esc(n)}"><span>${esc(n)}</span></button>`).join('')); },
      addprinter: () => cfToast('Looking for printers on Studio North…'), testpage: () => cfToast('Test page sent to Brother HL-L2350DW'),
      rmprinter: () => cfSheet('Remove Brother HL-L2350DW?', 'You can add it again later.', () => cfToast('Printer removed'), 'Remove', true),
      connect: () => cfToast(`Opens ${esc(el.closest('.cfrow').querySelector('b').textContent)} sign-in`),
      rmacct: () => cfSheet('Remove this account?', 'Mail, events and contacts from it leave this computer. Nothing is deleted online.', () => cfGo('accounts'), 'Remove', true),
      clearhist: () => cfSheet('Clear recent files?', 'The files stay where they are. Only the list is cleared.', () => cfToast('Recent files cleared'), 'Clear', true),
      emptytrash: () => cfSheet('Empty the trash?', '214 items, 1.2 GB. They can’t be brought back.', () => cfToast('Trash emptied'), 'Empty trash', true),
      cleartemp: () => cfToast('380 MB of temporary files deleted'),
      settime: () => cfToast('Pick a date and time'), pic: () => cfToast('Choose a picture'), pw: () => cfSheet('Change your password', 'Your files and saved passwords stay as they are.', () => cfToast('Password changed'), 'Change', false, `<div class="cfform"><input type="password" placeholder="Current password" aria-label="Current password"><input type="password" placeholder="New password" aria-label="New password"></div>`),
      adduser: () => cfSheet('Add someone', 'They get their own files, settings and apps.', () => cfToast('Account added'), 'Add', false, `<div class="cfform"><input placeholder="Full name" aria-label="Full name"><input placeholder="Username" aria-label="Username"></div>`),
      parental: () => cfToast('Opens Parental Controls'), pwreset: () => cfToast('Priya sets a new password when she next signs in'),
      rmuser: () => cfSheet('Remove Priya Raman?', 'Her account goes. Choose whether her files stay in /home.', () => cfGo('users'), 'Remove', true),
      reveal: () => { CFV.rev = !CFV.rev; cfMain(); }, reader: () => cfToast('Opens screen reader settings'), flash: () => { const m = $('#cf-main'); m.classList.add('cfflash'); setTimeout(() => m.classList.remove('cfflash'), 400); },
      copysys: () => { navigator.clipboard?.writeText('SunoOS 0.1 nightly 20260923\nLinux 6.16.8-suno1\nSuno Shell 1.0 on Wayland').catch(() => {}); cfToast('System details copied'); },
      clearcache: () => cfToast('Cache cleared'), uninstall: () => { const n = cfPg(CFV.pg).n; lConfirm($('#w-settings'), { title: `Uninstall ${n}?`, body: `${n} is removed from this computer. You can get it again from Depot.`, action: 'Uninstall', icon: 'trash-2', option: 'Also remove its data', onOK: data => { cfGo('apps'); cfToast(`${n} uninstalled${data ? ' with its data' : '. Its data is kept'}`, 'trash-2'); } }); },
      signout: () => cfSheet('Sign out of your Suno account?', 'Messages and sync stop on this computer until you sign in again. Your files stay.', () => cfToast('Signed out'), 'Sign out', true),
      addplace: () => cfToast('Choose a folder in Filer')
    }; T[k]?.(); }

  /* Displays: drag the second screen to where it sits on the desk. It snaps to the nearest edge on release. */
  function cfArrDown(e) { const m = e.target.closest('[data-cfdisp="ext"]'); if (!m || CF.join !== 'join') return; const A2 = CFV.ak, box = $('#cf-arr').getBoundingClientRect(), r = m.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; CFV.dragged = false;
    const mv = ev => { const x = ev.clientX - box.left - dx, y = ev.clientY - box.top - dy; if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 3) CFV.dragged = true; m.style.left = x + 'px'; m.style.top = y + 'px'; m.classList.add('drag'); };
    const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (!CFV.dragged) return;
      const ix = A2.ox + (0 - A2.x0) * A2.k, iy = A2.oy + (0 - A2.y0) * A2.k, iw = A2.iw * A2.k, ih = A2.ih * A2.k, x = parseFloat(m.style.left), y = parseFloat(m.style.top), w = A2.ew * A2.k, h = A2.eh * A2.k;
      const cx = x + w / 2 - (ix + iw / 2), cy = y + h / 2 - (iy + ih / 2);
      const side = Math.abs(cy) / (ih + h) > Math.abs(cx) / (iw + w) && cy < 0 ? 'top' : cx < 0 ? 'left' : 'right';
      const off = side === 'top' ? (x - ix) / (iw - w || 1) : (y - iy) / (ih - h || 1);
      CF.arr = { side, off: Math.max(-.2, Math.min(1.2, isFinite(off) ? off : .5)) }; cfFx('arr'); cfMain(); setTimeout(() => { CFV.dragged = false; }, 0); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); }

  /* Live things: the clock, the microphone level, the test tone, keys you press */
  function cfLive() { const w = $('#w-settings'); if (!w || w.hidden) return;
    if (CFV.pg === 'datetime' && !CFV.q) { const t = $('#cf-time'); if (t) t.textContent = cfTime(); }
    if (CFV.pg === 'sound' && !CFV.q) { const lv = (el, amp) => el && [...el.children].forEach((b, i) => b.classList.toggle('on', i < amp * el.children.length));
      const tt = CFV.test ? (Date.now() - CFV.test) / 1000 : 0; lv($('#cf-outm'), CFV.test ? (.45 + Math.random() * .35) * CF.vol / 100 : 0);
      const talk = (Math.sin(Date.now() / 900) + 1) / 2; lv($('#cf-inm'), CF.mic ? (.08 + Math.random() * .5 * talk) * CF.inVol / 100 : 0); } }
  setInterval(cfLive, 120);
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'settings') return;
    if (CFV.keyEdit && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) { e.preventDefault(); if (e.key === 'Escape') { CFV.keyEdit = null; cfMain(); return; }
      const combo = [e.shiftKey && 'Shift', e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.metaKey && 'Super', e.key.length === 1 ? e.key.toUpperCase() : e.key].filter(Boolean).join(' ');
      CFSHORT.forEach(g => g[1].forEach(x => { if (x[0] === CFV.keyEdit) x[1] = combo; })); CFV.keyEdit = null; cfMain(); cfToast('Shortcut changed'); return; }
    if (CFV.pg === 'keyboard' && !e.target.closest('input')) { const k = $(`#cf-kb kbd[data-code="${e.code}"]`); if (k) { k.classList.add('hit'); setTimeout(() => k.classList.remove('hit'), 180); } }
    if ((e.key === 'f' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !e.target.closest('input'))) { e.preventDefault(); $('#cf-q').focus(); }
    if (e.key === 'Escape') { if (!$('#cf-sheet').hidden) cfShut(); else if (CFV.q) { CFV.q = ''; $('#cf-q').value = ''; cfAll(); } else if ($('#cf-pop')) $('#cf-pop').remove(); }
    if (e.key === 'Enter' && !$('#cf-sheet').hidden && !e.target.closest('[data-cfclose]')) { e.preventDefault(); $('[data-cfgo]')?.click(); }
    if (e.key === 'ArrowLeft' && e.altKey) { const p = cfPg(CFV.pg); if (p.up) cfGo(p.up); } });

  function renderSettings() { const sw = $('#w-settings'); sw.classList.toggle('lsideoff', !lSideOn(sw)); $('#cf-top').innerHTML = `<img src="${A}settings.svg" alt=""><b>Settings</b><span class="chev">${ic('chevron-down')}</span>${lSideBtn(sw)}`;
    $('#cf-side .cfq').insertAdjacentHTML('afterbegin', ic('search'));
    const w = $('#w-settings');
    $('#cf-q').addEventListener('input', e => { CFV.q = e.target.value.trim(); cfAll(); });
    $('#cf-q').addEventListener('keydown', e => { if (e.key === 'Enter') { const h = cfSearch(CFV.q.toLowerCase())[0]; if (h) cfGo(h.pg); } });
    w.addEventListener('input', e => { const r = e.target.closest('[data-cfrg]'); if (r) { const k = r.dataset.cfrg; cfS(k, r.value); const o = r.parentNode.querySelector('output'); if (o) { const row = r.closest('.cfrow'); o.textContent = k === 'vol' ? r.value + '%' : o.textContent.replace(/^[\d.-]+/, r.value); }
        if (k === 'gap') { const t = $('.cftiles'); if (t) t.outerHTML = cfTiles(); } if (k === 'nightT') $('.cftemp')?.style.setProperty('--t', r.value + '%'); if (k === 'isz') {} return; }
      const t = e.target.closest('[data-cftx]'); if (t) { cfS(t.dataset.cftx, t.value); if (t.dataset.cftx === 'devName') { const m = $('.cfhd p'); if (m && CFP[CFV.pg]?.meta) m.innerHTML = CFP[CFV.pg].meta(); } } });
    w.addEventListener('change', e => { if (e.target.closest('[data-cfrg]')) { const k = e.target.dataset.cfrg; if (!['vol', 'nightT', 'gap'].includes(k)) cfMain(); } });
    $('#cf-body').addEventListener('pointerdown', cfArrDown);
    cfAll(); }

  /* ══ Playground (v73): an agentic development environment ═══════════════════════════════════════════════
     Describe what you want to make; an agent builds it, proves it works, and keeps the project in order. The window has
     three things in it: the projects and their goals (rail), the conversation for one goal (centre, where the agent's work
     arrives as cards), and the Stage (the real product, running). Everything else opens from those: the Project book, Places,
     People, Usage, and the code one step down. The sample is Kiln, class sign-ups for Maya's pottery studio, built by Nick,
     Priya and Sam. Nothing here talks to a real agent, server or bill; state lives in this browser (playground73-*). */
  const PGKEY = 'playground73-state', PGUIKEY = 'playground73-ui';
  const PGICON = $('.shelf .dk[data-app="playground"] img')?.getAttribute('src') || '';
  const pgG = {
    tablet: mk('<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 18h2"/>'),
    diff: mk('<path d="M12 3v14"/><path d="M5 10h14"/><path d="M5 21h14"/>'),
    coins: mk('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>'),
    sprout: mk('<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>'),
    bulb: mk('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
    userx: mk('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5"/><path d="m22 8-5 5"/>'),
    stop: mk('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
    ext: mk('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    goal: mk('<path d="M12 13V2l8 4-8 4"/><path d="M20.6 10.5a9 9 0 1 1-12.3-6.4"/><path d="M7.6 10.1a4.5 4.5 0 1 0 8.4 1.3"/>'),
    map: mk('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/><path d="M6.5 10v4a3 3 0 0 0 3 3H14"/>'),
    vault: mk('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8V7.5M12 16.5v-1.3M15.2 12h1.3M7.5 12h1.3"/><path d="M6 20v1.5M18 20v1.5"/>'),
    ballot: mk('<path d="M9 11 7 13l-1.5-1.5"/><path d="M13 12h5"/><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M13 8h5M6 8h3"/>'),
    branch: mk('<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7"/><path d="M18 10.5c0 4-6 3-11 6"/>'),
    restore: mk('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
    handoff: mk('<path d="M4 12h12"/><path d="m12 8 4 4-4 4"/><path d="M20 5v14"/>'),
    checker: mk('<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
    plug: mk('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/>'),
    cert: mk('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 9h6M7 12h4"/><circle cx="16.5" cy="17" r="2.5"/><path d="m15 19-1 3 2.5-1 2.5 1-1-3"/>')
  };
  const pic = n => pgG[n] || ic(n);
  const pgClone = x => JSON.parse(JSON.stringify(x));

  /* ── Marks: Kiln's arch, the other projects, the agents (glyph tiles, never a company's logo) ── */
  const KLMARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#b5532f"/><path d="M8.5 25V15.5a7.5 7.5 0 0 1 15 0V25" fill="none" stroke="#fff8ee" stroke-width="2.3"/><path d="M6.5 25h19" stroke="#fff8ee" stroke-width="2.3" stroke-linecap="round"/><path d="M16 23.2c-1.7 0-2.8-1.2-2.8-2.7 0-1.7 1.5-2.6 2-4.3 1 .9 1.7 1.6 1.7 2.8.4-.4.8-1 .9-1.7.8.9 1.1 1.8 1.1 2.8 0 1.8-1.2 3.1-2.9 3.1z" fill="#ffc06a"/></svg>';
  const pgPmark = (p, cls = '') => { const m = { kiln: KLMARK,
      plants: '<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#3f8f5a"/><path d="M16 25V14" stroke="#eaf7ec" stroke-width="2.2" stroke-linecap="round"/><path d="M16 17c-4.5 0-7-2.6-7-7 4.6 0 7 2.4 7 7zM16 15c0-4 2.4-6.6 7-6.6 0 4.2-2.4 6.6-7 6.6z" fill="#eaf7ec"/></svg>',
      game: '<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#3d63d8"/><circle cx="12" cy="18" r="6" fill="#ffd25a"/><circle cx="21" cy="12" r="4.2" fill="#ff7aa8"/><circle cx="22" cy="22" r="3" fill="#7de3ff"/></svg>',
      classes: '<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#8a5a3c"/><path d="M9 14h14l-1.6 9.5a2 2 0 0 1-2 1.5h-6.8a2 2 0 0 1-2-1.5z" fill="#f6e6d4"/><ellipse cx="16" cy="14" rx="7" ry="2" fill="#e2c3a3"/></svg>' };
    return `<i class="pgpm ${cls}">${m[p] || m.kiln}</i>`; };
  const PGAG = {
    ari: { n: 'Ari', img: A + 'ari.svg', kind: 'Suno’s agent', sub: 'Your ChatGPT plan or Suno credits', who: 'Shared with the team', head: '$8.20 of credits left this month', pct: 82, reset: 'Tops up Nov 1', share: 'team', where: 'this', can: true },
    claude: { n: 'Claude', h: 42, g: 'sparkles', kind: 'Personal plan', plan: 'Max plan', who: 'Yours', head: '62% of the week left', pct: 62, reset: 'Resets Tue 9 AM', share: 'me', where: 'this', can: true },
    codex: { n: 'Codex', h: 165, g: 'code', kind: 'Personal plan', plan: 'Plus plan', who: 'Yours', head: 'Plenty left today', pct: 88, reset: 'Resets in 3 h', share: 'me', where: 'this', can: true },
    qwen: { n: 'Qwen 27B', h: 292, g: 'cpu', kind: 'Local model', plan: 'On this computer', who: 'Shared with the team', head: 'Free, and nothing leaves this computer', pct: 100, reset: 'Best for smaller jobs', share: 'team', where: 'this', can: true },
    team: { n: 'Team key', h: 232, g: 'key-round', kind: 'API key', plan: 'Anthropic API key', who: 'Set up by Priya · shared', head: '$6.40 of $25 this month', pct: 26, reset: 'Cap resets Nov 1', share: 'team', where: 'dev', can: true },
    priya: { n: 'Priya’s Claude', h: 42, g: 'sparkles', kind: 'Teammate’s plan', plan: 'Max plan', who: 'Priya’s', mate: 'PR', head: '40% of her week left', pct: 40, reset: 'Works on team tasks, up to 20% of her week', share: 'me', where: 'priya', can: false },
    sam: { n: 'Sam’s Codex', h: 165, g: 'code', kind: 'Teammate’s plan', plan: 'Plus plan', who: 'Sam’s', mate: 'SK', head: 'Not shared', pct: 0, reset: 'Sam hasn’t opted in to team tasks', share: 'me', where: 'sam', can: false }
  };
  const pgAm = (k, cls = '') => { const a = PGAG[k] || PGAG.ari; return a.img ? `<i class="pgam img ${cls}"><img src="${a.img}" alt=""></i>` : `<i class="pgam ${cls}" style="--h:${a.h}">${ic(a.g)}${a.mate ? `<span class="pgamav">${av(a.mate, cls === 'lg' ? 18 : 14)}</span>` : ''}</i>`; };
  const pgWhereN = { this: 'This computer', dev: 'Dev server', priya: 'Priya’s computer', sam: 'Sam’s computer' };
  const pgAv0 = (ini, h, sz) => `<i class="av round" style="width:${sz}px;height:${sz}px;background:oklch(0.62 0.12 ${h});font-size:${Math.round(sz * .38)}px">${ini}</i>`;
  const pgFirst = k => k === 'me' ? 'You' : (ppl(k)?.n || '').split(' ')[0];

  /* ── The sample world ── */
  const PGPLACES = [
    { id: 'this', n: 'This computer', sub: 'Nick’s laptop', role: 'Your workspace', icon: 'laptop', st: 'on', does: 'Where you talk to the agent. Your copy of the project is kept in sync here.' },
    { id: 'dev', n: 'Dev server', sub: 'The box in the closet · 203.0.113.7', role: 'Development', icon: 'server', st: 'on', up: 'Up 12 days', does: 'Runs the app and the agents, including Stage, so teammates can work while laptops are closed.' },
    { id: 'prod', n: 'Production server', sub: 'A small VPS · kiln.studio', role: 'Production', icon: 'globe', st: 'on', up: 'Live · 34 people this week', does: 'The live app. Agents can’t write here. Changes arrive only through a reviewed release.' },
    { id: 'android', n: 'Android emulator', sub: 'Runs on the Dev server', role: 'Preview', icon: 'smartphone', st: 'idle', does: 'Try Kiln on an Android phone without owning one.' },
    { id: 'iphone', n: 'Cloud iPhone', sub: 'A rented Mac · $0.10 a minute while open', role: 'Preview', icon: 'smartphone', st: 'off', does: 'An iPhone simulator on a Mac you rent by the minute. It only costs while it’s open.' }
  ];
  const PGPEOPLE = [
    { k: 'me', n: 'Nick', role: 'Owner', here: true, where: 'In Add a waitlist', devs: 2 },
    { k: 'PR', n: 'Priya Raman', role: 'Builder', here: true, where: 'Watching her agent in Fix reminder texts', devs: 2 },
    { k: 'SK', n: 'Sam Kaur', role: 'Reviewer', here: false, where: 'Here 2 hours ago', devs: 1 }
  ];
  const PGROLES = { Owner: 'Everything, including who’s on the project', Builder: 'Asks agents for changes, edits, and releases with approval', Reviewer: 'Comments on and approves releases', Viewer: 'Can look, not change' };
  const PGVAULT = [['Texting service key', 'Used by Production and Stage', 'Priya'], ['Production database password', 'Production only', 'Nick'], ['Suno Connect app secret', 'Used for sign-in', 'Nick'], ['Team key', 'Anthropic API key, capped at $25 a month', 'Priya'], ['Email service key', 'For the waitlist’s backup email', 'Ari, on Tuesday']];
  const PGKN = [['Classes hold eight people', 'There are eight wheels, so every class caps at eight. Maya never overbooks.', 'Maya, via Nick', 'Sep 26'],
    ['Phone numbers need the country code', 'The texting service rejects numbers without +1. Found while fixing reminders.', 'Priya’s agent', 'Today'],
    ['How Kiln looks', 'Warm clay and cream, Newsreader for headings, Atkinson Hyperlegible for everything else. Buttons are pill shaped.', 'Ari', 'Sep 27'],
    ['Maya checks bookings on her phone', 'She manages the studio from her phone between classes, so her view has to work one-handed.', 'Nick', 'Sep 26']];

  /* Kiln's four classes this week. The Stage has its own copy of the bookings, so its numbers are test numbers. */
  const KLCLS = [
    { t: 'Wheel basics', d: 'TUE', n: 13, when: '6:30 PM · with Maya', left: 3, price: 45 },
    { t: 'Glaze night', d: 'THU', n: 15, when: '7:00 PM · with Jo', left: 0, wait: { stage: 4, live: 0 }, price: 40 },
    { t: 'Open studio', d: 'SAT', n: 17, when: '10:00 AM · drop in', left: 5, price: 25 },
    { t: 'Throwing bowls', d: 'SUN', n: 18, when: '2:00 PM · with Maya', left: 6, price: 50 }
  ];
  /* "Photos" of the studio, painted: shelves of pots, a wheel, bowls drying, the kiln itself */
  const KLART = [['#e3b08a', '#8c4a2b', 'shelf'], ['#cdbb9f', '#5d4a3b', 'wheel'], ['#e9c6a3', '#a0522d', 'bowls'], ['#bcc6a8', '#55644a', 'vase'], ['#ecd2b4', '#b5532f', 'kiln'], ['#d9c5ab', '#6e5040', 'mugs']];
  function klArt(i) { const [bg, fg, kind] = KLART[i % KLART.length], pot = (x, y, w, h, c) => `<g fill="${c}"><ellipse cx="${x}" cy="${y - h * .42}" rx="${w / 2}" ry="${h * .42}"/><rect x="${x - w * .2}" y="${y - h}" width="${w * .4}" height="${h * .34}" rx="2"/><ellipse cx="${x}" cy="${y - h}" rx="${w * .25}" ry="${h * .06}"/></g>`;
    const bowl = (x, y, w, c) => `<path d="M${x - w / 2} ${y - w * .3}Q${x} ${y + w * .22} ${x + w / 2} ${y - w * .3}Z" fill="${c}"/>`, mug = (x, y, c) => `<g><rect x="${x - 9}" y="${y - 22}" width="18" height="22" rx="4" fill="${c}"/><circle cx="${x + 11}" cy="${y - 11}" r="5" fill="none" stroke="${c}" stroke-width="3"/></g>`;
    const light = `<rect x="96" y="0" width="54" height="112" fill="#fff" opacity=".16"/><rect x="0" y="0" width="150" height="112" fill="url(#kg${i})"/>`;
    const art = { shelf: `<rect x="0" y="50" width="150" height="4" fill="${fg}" opacity=".55"/><rect x="0" y="94" width="150" height="4" fill="${fg}" opacity=".55"/>${pot(26, 50, 20, 30, fg)}${pot(54, 50, 14, 22, '#f4e6d4')}${pot(80, 50, 22, 34, '#6f7d5c')}${pot(110, 50, 16, 26, fg)}${bowl(34, 94, 30, '#f4e6d4')}${pot(72, 94, 18, 28, '#c4703f')}${bowl(112, 94, 34, fg)}`,
      wheel: `<ellipse cx="75" cy="88" rx="56" ry="12" fill="${fg}" opacity=".85"/><ellipse cx="75" cy="84" rx="38" ry="8" fill="#9a8877"/><path d="M58 84Q60 50 75 44Q90 50 92 84Z" fill="#c4865a"/><ellipse cx="75" cy="45" rx="9" ry="3" fill="#a96b44"/><path d="M28 70q10-16 26-10M122 70q-10-16-26-10" stroke="#f4e6d4" stroke-width="7" stroke-linecap="round" fill="none"/>`,
      bowls: `${bowl(40, 70, 46, fg)}${bowl(40, 58, 40, '#f4e6d4')}${bowl(98, 74, 52, '#6f7d5c')}${bowl(98, 61, 44, fg)}${bowl(98, 50, 36, '#f4e6d4')}<rect x="0" y="80" width="150" height="32" fill="${fg}" opacity=".25"/>`,
      vase: `<rect x="0" y="86" width="150" height="26" fill="${fg}" opacity=".35"/>${pot(48, 88, 30, 58, fg)}${pot(92, 88, 22, 40, '#f4e6d4')}${pot(120, 88, 14, 24, '#b5532f')}`,
      kiln: `<path d="M30 112V58a45 45 0 0 1 90 0v54Z" fill="${fg}"/><path d="M48 112V66a27 27 0 0 1 54 0v46Z" fill="#3a1d10"/><path d="M75 104c-10 0-16-7-16-15 0-10 9-15 12-25 6 5 10 9 10 16 3-2 5-6 5-10 5 5 7 11 7 17 0 10-7 17-18 17z" fill="#ffb347"/><path d="M75 104c-5 0-8-3.5-8-7.5 0-5 4.5-7.5 6-12.5 3 2.5 5 4.5 5 8 1.5-1 2.5-3 2.5-5 2.5 2.5 3.5 5.5 3.5 8.5 0 5-3.5 8.5-9 8.5z" fill="#ffe08a"/>`,
      mugs: `<rect x="0" y="70" width="150" height="4" fill="${fg}" opacity=".5"/>${mug(24, 70, fg)}${mug(58, 70, '#f4e6d4')}${mug(92, 70, '#6f7d5c')}${mug(126, 70, '#c4703f')}<rect x="0" y="74" width="150" height="38" fill="${fg}" opacity=".18"/>` }[kind];
    return `<svg viewBox="0 0 150 112" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="kg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#3a1d10" stop-opacity=".18"/></linearGradient></defs><rect width="150" height="112" fill="${bg}"/>${light}${art}</svg>`; }

  /* ── State: what the person did here, kept in this browser. The sample itself is computed, never stored. ── */
  function pgFresh() { return { v: 1, proj: 'kiln', goal: { kiln: 'waitlist' }, add: {}, ag: { ari: 'ari', waitlist: 'ari', texts: 'priya', photos: 'ari', signin: 'claude', gifts: 'ari' },
    wl: { phase: 'decide', choice: null }, rel: {}, heads: {}, gifts: 'paused', texts: 'priya', extra: [], projects: [], hist: [], home: 'dev',
    access: { PR: true, SK: true }, places: [], members: [], conn: { claudeTeam: false, claudeCap: 20, claudeWhere: 'this', qwenShare: true, qwenWhere: 'this', teamCap: 25, ariShare: true, codexWhere: 'this' },
    look: false, seq: 1 }; }
  let PG; try { PG = JSON.parse(localStorage.getItem(PGKEY) || 'null'); } catch (e) {} if (!PG || PG.v !== 1) PG = pgFresh();
  let PGU; try { PGU = JSON.parse(localStorage.getItem(PGUIKEY) || 'null'); } catch (e) {} PGU = Object.assign({ dev: 'phone', env: 'stage', wide: false, term: true }, PGU || {});
  const pgSave = () => { try { localStorage.setItem(PGKEY, JSON.stringify(PG)); localStorage.setItem(PGUIKEY, JSON.stringify(PGU)); } catch (e) {} };
  /* What isn't kept: which sheet or page is open, the picker, Point and Record, live runs */
  const PGX = { sheet: null, page: null, pick: false, point: null, pointing: false, rec: 0, recT: 0, stageOn: false, kl: { scr: 'home', c: 0 }, sel: {}, fresh: new Set(), busy: {}, draft: {}, bookAt: 'brief', code: { file: null, mode: 'diff' }, hist: 'all', term: [], usage: null, light: null, newq: '', relRun: null, flash: null };

  const pgW = () => $('#w-playground');
  const pgNarrow = () => { const w = pgW(); return !!w?.clientWidth && w.clientWidth < 560; };
  const pgCompact = () => { const w = pgW(); return !!w?.clientWidth && w.clientWidth < 1060 && !pgNarrow(); };
  const pgProj = () => PG.proj === 'kiln' ? { id: 'kiln', n: 'Kiln', mark: 'kiln', what: 'Class sign-ups for Maya’s pottery studio', path: '~/Documents/Playground Projects/Kiln' } : (() => { const p = PG.projects.find(x => x.id === PG.proj); return p ? { ...p, mark: p.tpl, path: `~/Documents/Playground Projects/${p.n}` } : null; })();

  /* ── Goals: the threads of work. Their state is derived from what has happened, never typed twice. ── */
  const PGKILN = [
    { id: 'ari', t: 'Talk to Ari', chat: true },
    { id: 'waitlist', t: 'Add a waitlist', by: 'me', began: 'Started by you on Tuesday' },
    { id: 'texts', t: 'Fix reminder texts', by: 'PR', began: 'Priya’s goal · started today at 9:20 AM' },
    { id: 'photos', t: 'Studio photos on the home page', by: 'me', began: 'Started by you on Wednesday' },
    { id: 'signin', t: 'Sign in with Suno Connect', by: 'me', began: 'Started by you on Sep 30' },
    { id: 'gifts', t: 'Gift a class', by: 'me', began: 'Started by you on Sep 28' }
  ];
  const pgGoals = () => PG.proj === 'kiln' ? [...PGKILN.slice(0, 1), ...PG.extra.filter(g => g.proj === 'kiln').slice().reverse(), ...PGKILN.slice(1)] : (PG.projects.find(p => p.id === PG.proj)?.goals || []);
  const pgGoal = () => { const gs = pgGoals(), id = PG.goal[PG.proj]; return gs.find(g => g.id === id) || gs[0] || null; };
  function pgState(g) { if (!g) return { k: 'draft', l: '' };
    if (g.chat) return { k: 'chat', l: 'Kiln’s general chat', s: 'The whole project' };
    const run = PGX.busy[g.id];
    if (g.id === 'waitlist') { const p = PG.wl.phase; return p === 'decide' ? { k: 'needs', l: 'Needs you', s: 'Needs you · one decision' } : p === 'build' ? { k: 'work', l: 'Working', s: `Working · ${PGAG[PG.ag.waitlist]?.n || 'Ari'}` } : p === 'review' ? { k: 'review', l: 'Ready to review', s: 'Ready to review' } : { k: 'live', l: 'Live', s: 'Live · released today' }; }
    if (g.id === 'texts') return PG.texts === 'priya' ? { k: 'work', l: 'Working', s: 'Working · Priya’s agent' } : { k: 'work', l: 'Working', s: 'Working · Ari, picked up from Priya' };
    if (g.id === 'photos') return PG.rel.photos ? { k: 'live', l: 'Live', s: 'Live · released today' } : { k: 'review', l: 'Ready to review', s: 'Ready to review · Sam approved' };
    if (g.id === 'signin') return { k: 'live', l: 'Live', s: 'Live since Tuesday' };
    if (g.id === 'gifts') return { paused: { k: 'paused', l: 'Paused', s: 'Paused · after the holidays' }, on: { k: 'needs', l: 'Needs you', s: 'Needs you · a plan to agree' }, work: { k: 'work', l: 'Working', s: 'Working · Ari' }, done: PG.rel.gifts ? { k: 'live', l: 'Live', s: 'Live · released today' } : { k: 'review', l: 'Ready to review', s: 'Ready to review · on Stage' } }[PG.gifts];
    if (PG.rel[g.id]) return { k: 'live', l: 'Live', s: 'Live · released today' };
    if (run) return { k: 'work', l: 'Working', s: `Working · ${PGAG[PG.ag[g.id]]?.n || 'Ari'}` };
    const ph = g.phase || 'draft'; return { draft: { k: 'draft', l: 'New', s: 'Not started yet' }, needs: { k: 'needs', l: 'Needs you', s: 'Needs you · a plan to agree' }, work: { k: 'work', l: 'Working', s: 'Working · Ari' }, review: { k: 'review', l: 'Ready to review', s: 'Ready to review' }, done: { k: 'live', l: 'Done', s: 'Done · on Stage' }, live: { k: 'live', l: 'Live', s: 'Live' } }[ph] || { k: 'draft', l: '', s: '' }; }
  const pgK = k => k === 'review' ? 'rvw' : k;   /* .review is the simulator's review bar, so the state's class is .rvw */
  const pgGlyph = (g, st) => g.chat ? `<i class="pgg chat"><img src="${A}ari.svg" alt=""></i>` : `<i class="pgg ${pgK(st.k)}" aria-hidden="true"></i>`;

  /* ── Each goal's conversation: the sample is computed here; what happens in this browser is appended (PG.add) ── */
  const pgF = (p, a = 0, d = 0, k = 'M') => [p, a, d, k];
  const PGFILES_WL = [pgF('src/lib/ClassCard.svelte', 18, 4), pgF('src/lib/Waitlist.svelte', 41, 0, 'A'), pgF('src/lib/server/waitlist.ts', 64, 0, 'A'), pgF('src/lib/server/db/schema.sql', 9, 0), pgF('src/routes/+page.svelte', 6, 2), pgF('src/routes/maya/+page.svelte', 22, 1), pgF('tests/waitlist.test.ts', 52, 0, 'A')];
  const PGFILES_OFFER = [pgF('src/lib/server/offers.ts', 58, 0, 'A'), pgF('src/lib/server/waitlist.ts', 12, 3), pgF('src/lib/server/notify.ts', 21, 2), pgF('src/lib/ClassCard.svelte', 1, 1), pgF('tests/offers.test.ts', 47, 0, 'A')];
  function pgBase(gid) { if (PG.proj !== 'kiln') return [];
    const day = t => ({ k: 'day', t }), me = (t, at, x = {}) => ({ k: 'me', t, at, ...x }), say = (t, x = {}) => ({ k: 'say', ag: 'ari', t: [].concat(t), ...x });
    if (gid === 'ari') return [day('Today'), me('Morning. Where are we with Kiln?', '9:02 AM'),
      say(['Morning, Nick. Kiln is live, and 34 people booked a class through it this week.', 'The waitlist needs one decision from you before it can go further. Priya’s agent is fixing the reminder texts that didn’t arrive, and Sam has approved the studio photos, so they’re waiting for you.'],
        { id: 'a1', chips: [['Add a waitlist', 'waitlist'], ['Fix reminder texts', 'texts'], ['Studio photos', 'photos']], dur: '2.4 s' }),
      { k: 'cost', id: 'a2', t: 'Kiln this week', sub: 'Ari used $1.12 of the team’s credits. Priya’s agent did the texts work on her own plan.', pct: 14, label: '$1.12 of $8 a week' }];
    if (gid === 'waitlist') return [day('Tuesday'), me('Glaze night fills up every week. When a class is full, let people join a waitlist, and offer them the spot if someone cancels.', '4:10 PM'),
      say('Good idea. Here’s how I’d build it. Have a look, and say go when it’s right.', { dur: '5.2 s' }),
      { k: 'plan', id: 'wl-plan', title: 'Add a waitlist', st: 'agreed', at: 'You said go · Tue 4:12 PM', size: 'Medium · about 40 minutes of work', cost: 'About $0.60 of Ari credits', stories: [
        ['Someone can join the waitlist for a full class', ['When all eight wheels are booked, the button says Join waitlist', 'After joining, they see their place in line']],
        ['When a spot opens, the first person waiting is offered it', ['Cancelling a booking sends an offer to whoever is first', 'If they don’t claim it within 2 hours, the offer moves to the next person']],
        ['Maya can see who’s waiting', ['Each class in Maya’s view lists its waitlist in order']]] },
      { k: 'step', id: 'wl-s1', st: 'done', title: 'Added the waitlist and the Join waitlist button', files: PGFILES_WL, el: '12 min', spend: '$0.31' },
      day('Today'), say('The waitlist works on Stage, and people can join it. Before I build the offer, there’s one thing only you can decide.', { at: '9:40 AM', dur: '1.9 s' }),
      { k: 'dec', id: 'wl-dec', gid: 'waitlist', q: 'How should someone hear that a spot opened?', chosen: PG.wl.choice, opts: [
        { k: 'text', t: 'A text message', d: 'Most people see it within minutes. About 1¢ a text, through the same service as the reminders.' },
        { k: 'email', t: 'An email', d: 'Free, but slower. Many people check email once or twice a day, so the 2 hours could run out before they see it.' },
        { k: 'both', t: 'A text, then an email if the text fails', d: 'The most reliable, and it costs the same as a text. Once Priya’s fix for failed texts lands, even fewer will need the email.', rec: true }],
        def: 'If you’d rather not choose, say “you pick” and I’ll go with a text, then an email.' }];
    if (gid === 'texts') return [day('Today'), { k: 'them', who: 'PR', t: 'Two people said they never got a reminder for Tuesday’s class. Can you find out why and fix it?', at: '9:20 AM' },
      say(['Found it. Both numbers were saved without a country code, so the texting service turned them away.', 'I’ll fix how numbers are saved, correct the ones already in Kiln, and resend the two reminders.'], { ag: 'priya', dur: '6.8 s', where: 'priya' }),
      { k: 'plan', id: 'tx-plan', title: 'Fix reminder texts', st: 'agreed', at: 'Priya said go · 9:23 AM', size: 'Small · about 20 minutes of work', cost: 'On Priya’s plan · about 3% of her week', ag: 'priya', stories: [
        ['Every reminder reaches a real phone', ['A number typed as 510 555 0142 is saved as +1 510 555 0142', 'Numbers already saved without a country code are corrected']],
        ['Maya hears when a text still fails', ['A failed reminder shows on the class page in Maya’s view']]] },
      { k: 'step', id: 'tx-s1', st: 'live', ag: PG.texts === 'priya' ? 'priya' : 'ari', where: PG.texts === 'priya' ? 'priya' : 'this', title: 'Fixing how phone numbers are saved',
        subs: ['Found 14 numbers without a country code', 'Fixing how new numbers are saved', 'Correcting the 14 saved numbers', 'Resending the two missed reminders', 'Running the checks'],
        files: [pgF('src/lib/server/phone.ts', 24, 6), pgF('src/lib/server/bookings.ts', 7, 3), pgF('tests/phone.test.ts', 31, 0, 'A')] }];
    if (gid === 'photos') return [day('Wednesday'), me('Maya sent six photos of the studio. Put them on the home page so people can see the space before they book.', '11:30 AM'),
      say('Lovely photos. I’ll put them in a row under the welcome that you can swipe, sized so the page stays quick on phones.', { dur: '3.0 s' }),
      { k: 'step', id: 'ph-s1', st: 'done', title: 'Added a row of studio photos to the home page', files: [pgF('src/routes/+page.svelte', 14, 1), pgF('src/lib/StudioPhotos.svelte', 38, 0, 'A'), pgF('static/studio/ (6 photos)', 6, 0, 'A')], el: '5 min', spend: '$0.09' },
      { k: 'heads', id: 'ph-h', key: 'photos', t: 'I made the photo files smaller, from 2.1 MB to 340 KB in total, so the home page loads quickly on a phone. They look the same.' },
      { k: 'proof', id: 'ph-proof', scr: { feat: { photos: true } }, at: 'Checked Wednesday, 11:41 AM', checks: [
        ['The home page shows six studio photos in a row you can swipe', 'pass', 'Studio photos'], ['The Book buttons are still on the first screen of a phone', 'pass', 'Book Wheel basics'],
        ['Each photo has a description for people using a screen reader', 'pass', 'Studio photos'], ['The page loads in under a second on a slow phone connection', 'pass', null]] },
      { k: 'them', who: 'SK', t: 'Looks great on my phone. Approved from me.', at: '2:05 PM' },
      { k: 'review', id: 'ph-rev', gid: 'photos' }];
    if (gid === 'signin') return [day('Sep 30'), me('Let people sign in with Suno Connect instead of making up a password.', '10:15 AM'),
      say('Good call. Nobody has to remember another password, and Kiln never has to keep one.', { ag: 'claude', dur: '4.4 s' }),
      { k: 'dec', id: 'si-dec', gid: 'signin', q: 'People who booked before sign-in existed: should their bookings follow them?', chosen: 'match', ag: 'claude', opts: [
        { k: 'match', t: 'Yes, match them by phone number', d: 'When someone signs in with the same number, their bookings appear. Nothing to do for them.', rec: true },
        { k: 'fresh', t: 'No, start everyone fresh', d: 'Simpler, but 212 bookings would look like they vanished.' }], at: 'You chose · Sep 30' },
      { k: 'step', id: 'si-s1', st: 'done', ag: 'claude', title: 'Added Sign in with Suno Connect', files: [pgF('src/hooks.server.ts', 28, 2), pgF('src/lib/server/auth.ts', 74, 0, 'A'), pgF('src/routes/signin/+page.svelte', 46, 0, 'A'), pgF('src/lib/server/bookings.ts', 19, 4)], el: '18 min', spend: '4% of your Claude week' },
      { k: 'proof', id: 'si-proof', ag: 'claude', scr: { feat: { signin: true } }, at: 'Checked Oct 6, 5:21 PM', checks: [['Signing in takes one tap with Suno Connect, with no password', 'pass', 'Your account'], ['Someone who booked before sees their bookings after signing in', 'pass', null], ['Signing out leaves bookings where they are', 'pass', null]] },
      { k: 'review', id: 'si-rev', gid: 'signin' },
      { k: 'note', icon: 'radio', t: '<b>Released to Production</b> on Tuesday at 5:40 PM · restore point 14' },
      day('Today'), say('21 people have signed in with Suno Connect since Tuesday, and nobody has asked for a password reset.', { ag: 'claude', at: '8:00 AM', dur: '1.2 s' })];
    if (gid === 'gifts') return [day('Sep 28'), me('Let people buy a class as a gift for someone else.', '3:42 PM'),
      say('Nice idea for the holidays. Here’s a first plan. It takes payments, so I’ve kept it as small as it can be.', { dur: '6.1 s' }),
      { k: 'plan', id: 'gf-plan', title: 'Gift a class', st: PG.gifts === 'paused' ? 'paused' : PG.gifts === 'on' ? 'proposed' : 'started', size: 'Large · about 2 hours of work', cost: 'About $2.40 of Ari credits, plus card fees on each gift', stories: [
        ['Someone can buy a class as a gift', ['Each class has a Give as a gift button', 'The buyer pays and gets a gift code to pass on']],
        ['The person who receives it can book with the code', ['Entering the code at booking makes the class free']]] },
      { k: 'note', icon: 'pause', t: 'You paused this on Oct 2: <b>“after the holiday rush”</b>' }];
    const xg = pgGoals().find(g => g.id === gid); return xg?.base || [];
  }
  const pgThread = gid => [...pgBase(gid), ...(PG.add[pgKey(gid)] || [])];

  /* ── Rendering the cards ── */
  const pgFoot = (ag, where, dur) => { const a = PGAG[ag] || PGAG.ari, wn = pgWhereN[where || (ag === 'priya' ? 'priya' : 'this')];
    return `<div class="pgfoot2">${pgAm(ag)}<span>${esc(a.n)}${a.plan && ag !== 'qwen' && !a.mate ? ` · ${a.who === 'Yours' ? 'your ' + a.plan.replace(' plan', '') : esc(a.plan)}` : ''}</span><span>${ic(where === 'dev' ? 'server' : 'house')}${wn}</span>${dur ? `<span>${dur}</span>` : ''}</div>`; };
  const pgCk = (t, st) => `<span class="pgst ${st}">${st === 'pass' ? ic('check') : st === 'fail' ? ic('x') : st === 'run' ? '<i class="pgspin"></i>' : ''}</span>`;
  function pgItem(it, gid) { const f = PGX.fresh.has(it.id) ? ' pgfresh' : '', id = it.id ? ` data-pgi="${it.id}"` : '';
    switch (it.k) {
      case 'day': return `<div class="pgday">${esc(it.t)}</div>`;
      case 'note': return `<div class="pgnote${f}"${id}>${ic(it.icon || 'info')}<span>${it.t}</span></div>`;
      case 'me': return `<div class="pgme${f}"${id}><p>${it.pt ? `<span class="pgpt">${ic('mouse-pointer-click')}${esc(it.pt)}</span>` : ''}${esc(it.t)}</p>${it.at ? `<small>${esc(it.at)}</small>` : ''}</div>`;
      case 'them': return `<div class="pgthem${f}"${id}>${av(it.who, 28)}<p>${esc(it.t)}</p><small>${pgFirst(it.who)}${it.at ? ' · ' + esc(it.at) : ''}</small></div>`;
      case 'think': return `<div class="pgthink"${id}><span class="pgdots"><i></i><i></i><i></i></span>${esc(PGAG[it.ag]?.n || 'Ari')} is ${esc(it.t || 'thinking')}</div>`;
      case 'say': return `<div class="pgsay${f}"${id}>${it.t.map(p => `<p>${esc(p)}</p>`).join('')}${it.chips ? `<div class="pgchips">${it.chips.map(([l, g]) => { const gg = pgGoals().find(x => x.id === g), st = pgState(gg); return `<button class="pgchip" type="button" data-pggoal="${g}">${pgGlyph(gg || {}, st)}${esc(l)}</button>`; }).join('')}</div>` : ''}${pgFoot(it.ag, it.where, it.dur)}</div>`;
      case 'plan': return pgPlan(it, f, id);
      case 'step': return pgStep(it, f, id);
      case 'dec': return pgDec(it, f, id);
      case 'proof': return pgProof(it, f, id);
      case 'heads': { const u = PG.heads[it.key]; return `<div class="pgc pgheads${u ? ' undone' : ''}${f}"${id}><i>${ic('triangle-alert')}</i><div><b>${u ? 'Undone' : 'Heads-up: I changed something you didn’t ask for'}</b><p>${esc(it.t)}</p></div><button class="bt sm fill" type="button" data-pgheads="${it.key}">${ic(u ? 'rotate-ccw' : 'undo-2')}${u ? 'Redo' : 'Undo'}</button></div>`; }
      case 'review': return pgRevCard(it, f, id);
      case 'handoff': return pgHandoff(it, f, id, gid);
      case 'cost': return `<div class="pgc${f}"${id}><div class="pgcost"><i>${pic('coins')}</i><div><b>${esc(it.t)}</b><span class="pgmeter"><i style="width:${it.pct}%"></i>${it.add ? `<i class="add" style="left:${it.pct}%;width:${it.add}%"></i>` : ''}</span><small>${esc(it.sub)}</small></div>${it.label ? `<small style="align-self:flex-start">${esc(it.label)}</small>` : ''}</div></div>`;
      case 'brief': return pgBriefCard(it, f, id);
      case 'recipe': return pgRecipeCard(it, f, id);
      case 'q': return pgQCard(it, f, id);
      case 'reveal': return pgReveal(it, f, id);
      case 'next': return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk">${pic('goal')}What next?</span></div><p class="pgct">A few goals that would make ${esc(it.pn)} better</p><div class="pgnext">${it.items.map(([t, s], i) => `<button type="button" data-pgnext="${i}" data-pgi2="${it.id}">${pic('goal')}<span><b>${esc(t)}</b><small>${esc(s)}</small></span>${ic('arrow-right')}</button>`).join('')}</div></div>`;
      case 'newgoal': { const g = pgGoals().find(x => x.id === it.gid); return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk">${pic('goal')}New goal</span></div><p class="pgct">${esc(it.t)}</p><div class="pgcb"><p>${esc(it.d)}</p></div><div class="pgcf">${g ? `<button class="bt sm fill" type="button" data-pggoal="${g.id}">${ic('arrow-right')}Open the goal</button><span class="pgsub">It’s in the rail under Kiln</span>` : ''}</div></div>`; }
    } return ''; }
  function pgPlan(it, f, id) { const ag = it.ag || 'ari';
    const head = it.st === 'agreed' ? `<span class="pgagreed">${ic('check')}${esc(it.at)}</span>` : it.st === 'paused' ? `<span class="pgr">Paused</span>` : it.st === 'started' ? `<span class="pgagreed">${ic('check')}You said go</span>` : `<span class="pgr">Waiting for you</span>`;
    return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk">${ic('list-checks')}Plan</span>${head}</div><p class="pgct">${esc(it.title)}</p>
      <div class="pgcb"><div class="pgstories">${it.stories.map(([t, cks], i) => `<div class="pgstory"><i>${i + 1}</i><b>${esc(t)}</b><div class="pgchecks">${cks.map(c => `<span class="pgck">${ic('eye')}<span>${esc(c)}</span></span>`).join('')}</div></div>`).join('')}</div>
      <div class="pgest"><div><small>Size</small><b>${esc(it.size)}</b></div><div><small>Cost</small><b>${esc(it.cost)}</b></div></div></div>
      ${it.st === 'proposed' ? `<div class="pgcf"><button class="bt key" type="button" data-pgplango="${it.id}">${ic('play')}Go</button><button class="bt fill" type="button" data-pgplanchg="${it.id}">${ic('pencil')}Change something</button><span class="sp"></span><span class="pgsub">Checks you can see are how I’ll prove it’s done</span></div>` : ''}</div>`; }
  function pgStep(it, f, id) { const ag = it.ag || 'ari', open = PGX.sel['f' + it.id];
    const files = it.files || [], shown = it.st === 'run' ? files.slice(0, it.nf ?? files.length) : files;
    const flist = open ? `<div class="pgfiles">${shown.map(([p, a, d, k]) => `<button class="pgfile" type="button" data-pgcode="${esc(p)}">${ic(k === 'A' ? 'plus' : 'file-text')}${esc(p)}<em>${a ? `<ins>+${a}</ins>` : ''}${d ? `<del>−${d}</del>` : ''}</em></button>`).join('')}</div>` : '';
    if (it.st === 'done') return `<div class="pgc pgstep${f}"${id}><div class="pgfold"><span class="pgok">${ic('check')}</span><b>${esc(it.title)}</b><small>${files.length} files · ${esc(it.el || '')}${it.spend ? ' · ' + esc(it.spend) : ''}</small>
      <button class="ib" type="button" data-pgfiles="${it.id}" title="${open ? 'Hide' : 'Show'} the files" aria-label="Files">${ic(open ? 'chevron-up' : 'chevron-down')}</button><button class="ib" type="button" data-pgcode="" title="Show the change" aria-label="Show the change">${ic('code')}</button></div>${open ? `<div class="pgfoldx"><div style="height:10px"></div>${flist}<div class="pgcf flat"><button class="bt sm fill" type="button" data-pgcode="">${pic('diff')}Show the change</button><button class="bt sm fill" type="button" data-pgterm>${ic('terminal')}Terminal</button></div></div>` : ''}</div>`;
    const live = it.st === 'live', i = it.i ?? 0, subs = it.subs || [];
    const el = live ? `${Math.floor((PGX.tick - PGX.t0) / 60000) + 14} min` : (it.secs != null ? pgDur(it.secs) : '0:00');
    return `<div class="pgc pgstep${f}"${id}><div class="pgch"><span class="pgk work"><i class="pgspin"></i>${live && ag === 'priya' ? 'Priya’s agent is working' : 'Working'}</span><span class="pgr">${ag === 'priya' ? 'Priya’s computer' : 'This computer'}</span></div>
      <p class="pgct">${esc(it.title)}</p>
      <div class="pgsubs">${subs.map((s, k) => `<span class="${k < i ? 'sdone' : k === i ? 'snow' : 'snext'}">${k < i ? ic('check') : k === i ? '<i class="pgspin"></i>' : ''}${esc(s)}</span>`).join('')}</div>
      <div class="pgbar${live ? ' indef' : ''}"><i style="width:${Math.round((it.pct || 0) * 100)}%"></i></div>
      <div class="pgstats"><span>${ic('timer')}<b>${el}</b></span><button type="button" data-pgfiles="${it.id}">${ic('file-text')}<b>${shown.length}</b> ${shown.length === 1 ? 'file' : 'files'} touched${ic(open ? 'chevron-up' : 'chevron-down')}</button><span>${pic('coins')}<b>${live && ag === 'priya' ? 'On Priya’s plan' : esc(it.spendNow || '$0.00')}</b></span><span class="sp"></span>${live && ag === 'priya' ? '' : `<button type="button" data-pgcode="">${ic('code')}Show the change</button>`}</div>${flist}</div>`; }
  const pgDur = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function pgDec(it, f, id) { const sel = PGX.sel['d' + it.id], ch = it.chosen, ag = it.ag || 'ari';
    return `<div class="pgc pgdec${f}"${id}><div class="pgch"><span class="pgk needs">${ic('hand')}${ch ? 'Your decision' : 'Only you can decide'}</span>${ch ? `<span class="pgagreed">${ic('check')}${esc(it.at || 'You chose · just now')}</span>` : ''}</div><p class="pgct">${esc(it.q)}</p>
      <div class="pgcb"><div class="pgopts">${it.opts.map(o => `<button class="pgopt${ch ? (ch === o.k ? ' picked' : ' dim') : sel === o.k ? ' on' : ''}" type="button" ${ch ? 'disabled' : `data-pgopt="${o.k}" data-pgdec="${it.id}"`} role="radio" aria-checked="${(ch || sel) === o.k}"><i></i><b>${esc(o.t)}${o.rec ? `<span class="pgrecm">${ic('star')}Recommended</span>` : ''}</b><span>${esc(o.d)}</span></button>`).join('')}</div>
      ${ch ? '' : `<p class="pgdef">${esc(it.def)}</p>`}</div>
      ${ch ? '' : `<div class="pgcf"><button class="bt key" type="button" data-pgdecide="${it.id}"${sel ? '' : ' disabled'}>${ic('check')}Decide</button><button class="bt fill" type="button" data-pgdecpick="${it.id}">${ic('sparkles')}You pick</button><span class="sp"></span><span class="pgsub">Ari waits for this. Nothing else is blocked.</span></div>`}</div>`; }
  function pgProof(it, f, id) { const ag = it.ag || 'ari', run = it.checks.some(c => c[1] === 'run'), pass = it.checks.filter(c => c[1] === 'pass').length;
    return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk ${run ? 'work' : pass === it.checks.length ? 'good' : 'needs'}">${pic('checker')}Proof</span><span class="pgr">${run ? 'Checking now…' : `${pass} of ${it.checks.length} checks passed`}</span></div>
      <div class="pgproof"><div class="pgshot" role="button" tabindex="0" data-pglight="${it.id}" aria-label="${it.rec ? 'Play the recording' : 'See the screenshot larger'}"><span class="pgshotin">${it.pv ? pvHTML(PG.projects.find(p => p.id === it.pv) || PGTPL.plants, { dev: 'phone' }) : klHTML({ dev: 'phone', env: 'stage', shot: true, ...(it.scr || {}) })}</span>${it.rec ? `<span class="pgplay"><b>${ic('play')}</b></span><span class="pgdur">${esc(it.rec)}</span>` : ''}</div>
        <div><div class="pgpchecks">${it.checks.map(([t, st, ev], k) => `<${ev ? `button type="button" data-pgev="${it.id}:${k}"` : 'div'} class="pgpck">${pgCk(t, st)}<span>${esc(t)}</span>${ev ? `<em>See it</em>` : '<em></em>'}</${ev ? 'button' : 'div'}>`).join('')}</div>
        <p class="pgby">${ic('shield-check')}<span>Checked by Playground’s checker, separately from ${esc(PGAG[ag]?.n || 'Ari')}${it.at ? ` · ${esc(it.at)}` : ''}</span></p></div></div>
      <div class="pgcf flat"><button class="bt sm fill" type="button" data-pgcode="">${pic('diff')}Show the change</button>${it.rec ? `<button class="bt sm fill" type="button" data-pglight="${it.id}">${ic('circle-play')}Play the recording</button>` : ''}<button class="bt sm fill" type="button" data-pgonstage>${ic('smartphone')}Try it on Stage</button></div></div>`; }
  const PGREV = {
    waitlist: { t: 'Add a waitlist', changes: ['When a class is full, its button says Join waitlist instead of a grey Full.', 'People who join see their place in line.', 'When someone cancels, the first person waiting gets a text, or an email if the text fails, and has 2 hours to claim the spot.', 'Maya sees each class’s waitlist in her view.'],
      data: ['Adds a waitlist table and an offers table. Nothing is removed.', 'The 212 existing bookings are untouched.', 'Tested on Stage with its own copy of the data, so no real person got a text.'], checks: 'wl-proof', dec: 'How people hear about an open spot', feat: { waitlist: true, offer: true } },
    photos: { t: 'Studio photos on the home page', changes: ['The home page shows six photos of the studio, in a row you can swipe.', 'The Book buttons stay on the first screen.'], data: ['No changes to data.', 'Adds six photos, 340 KB in total.'], checks: 'ph-proof', reviewer: 'SK', feat: { photos: true } },
    signin: { t: 'Sign in with Suno Connect', changes: ['People sign in with one tap instead of making up a password.'], data: ['Adds an accounts table and links 212 bookings to it by phone number.'], checks: 'si-proof', feat: { signin: true } }
  };
  /* goals made here get a review built from their own plan and proof */
  const pgRevFor = gid => { if (PGREV[gid]) return PGREV[gid]; if (PG.proj !== 'kiln') return null; const g = pgGoals().find(x => x.id === gid), th = pgThread(gid), plan = th.find(x => x.k === 'plan'), pf = [...th].reverse().find(x => x.k === 'proof');
    if (!g || !plan || !pf) return null; return { t: g.t, changes: plan.stories.filter(([t]) => !/^Nothing/.test(t)).map(([t]) => t.replace(/[.…]+$/, '') + '.'), data: gid === 'gifts' ? ['Adds a gifts table for codes. Nothing is removed.', 'Payments run in test mode on Stage.'] : ['Nothing is removed. Existing bookings are untouched.'], checks: pf.id, feat: {} }; };
  const pgRevState = gid => { const r = pgRevFor(gid); if (!r) return {}; const pf = pgThread(gid).find(x => x.id === r.checks), cks = pf?.checks || [], pass = cks.length && cks.every(c => c[1] === 'pass');
    const decOpen = gid === 'waitlist' && !PG.wl.choice, released = gid === 'signin' || !!PG.rel[gid]; return { r, cks, pass, decOpen, released, ok: pass && !decOpen }; };
  function pgRevCard(it, f, id) { const s = pgRevState(it.gid), r = s.r; if (!r) return '';
    return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk ${s.released ? 'live' : 'rvw'}">${ic(s.released ? 'radio' : 'eye')}${s.released ? 'Released' : 'Ready to review'}</span>${s.released ? `<span class="pgr">${it.gid === 'signin' ? 'Tue 5:40 PM' : 'Today'}</span>` : ''}</div><p class="pgct">${esc(r.t)}</p>
      <div class="pgrv"><span class="pgrvr">${pgCk('', s.pass ? 'pass' : 'wait')}<span><b>${s.cks.filter(c => c[1] === 'pass').length} of ${s.cks.length}</b> checks passed</span></span>
        <span class="pgrvr">${ic('users')}<span><b>${r.changes.length}</b> ${r.changes.length === 1 ? 'thing changes' : 'things change'} for people</span></span>
        <span class="pgrvr">${ic('database')}<span>${esc(r.data[0])}</span></span>
        ${r.reviewer ? `<span class="pgrvr">${av(r.reviewer, 18)}<span><b>${pgFirst(r.reviewer)}</b> approved it</span></span>` : ''}</div>
      <div class="pgcf"><button class="bt ${s.released ? 'fill' : 'key'}" type="button" data-pgreview="${it.gid}">${ic(s.released ? 'eye' : 'radio')}${s.released ? 'See what changed' : 'Review and release'}</button><span class="pgsub">${s.released ? 'Restore point saved' : `Goes to <b>Production</b>, kiln.studio`}</span></div></div>`; }
  function pgHandoff(it, f, id, gid) { const from = PGAG[it.from], to = PGAG[it.to], draft = it.st === 'draft';
    return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk">${pic('handoff')}Handoff</span>${it.st === 'sent' ? `<span class="pgagreed">${ic('check')}${esc(to.n)} picked it up</span>` : it.st === 'cancel' ? '<span class="pgr">Cancelled</span>' : ''}</div>
      <p class="pgct">${draft ? `Handing this goal to ${esc(to.n)}` : `Handed to ${esc(to.n)}`}</p>
      <div class="pgho">${pgAm(it.from)}<b>${esc(from.n)}</b>${ic('arrow-right')}${pgAm(it.to)}<b>${esc(to.n)}</b><span class="pgsub" style="margin-left:auto">${esc(to.kind)}${to.plan ? ' · ' + esc(to.plan) : ''}</span></div>
      <div class="pghobrief"><label>${draft ? `What ${esc(to.n)} reads first. Change anything before it starts.` : `What ${esc(to.n)} read first`}</label>${draft ? `<textarea data-pghobrief="${it.id}" spellcheck="false">${esc(it.brief)}</textarea>` : `<div class="pgbrieft">${esc(it.brief)}</div>`}</div>
      ${draft ? `<div class="pgcf flat" style="padding-top:12px"><button class="bt key" type="button" data-pghogo="${it.id}">${ic('arrow-right')}Continue with ${esc(to.n)}</button><button class="bt fill" type="button" data-pghox="${it.id}">Cancel</button><span class="sp"></span><span class="pgsub">The plan, decisions and history stay in the project folder</span></div>` : '<div style="height:14px"></div>'}</div>`; }
  function pgBriefCard(it, f, id) { const p = it.p, ed = PGX.sel['e' + it.id];
    return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk">${ic('file-text')}Brief</span><span class="pgr">One page · ${esc(p.n)}</span></div><p class="pgct">${esc(p.n)}: ${esc(p.brief.title)}</p>
      <div class="pgcb"><dl class="pgkv"><div><dt>What it is</dt><dd${ed ? ' contenteditable="true"' : ''}>${esc(p.brief.what)}</dd></div><div><dt>Who it’s for</dt><dd${ed ? ' contenteditable="true"' : ''}>${esc(p.brief.who)}</dd></div><div><dt>Where</dt><dd${ed ? ' contenteditable="true"' : ''}>${esc(p.brief.where)}</dd></div><div><dt>Good looks like</dt><dd${ed ? ' contenteditable="true"' : ''}>${esc(p.brief.good)}</dd></div></dl></div>
      ${it.final ? '' : `<div class="pgcf flat"><button class="bt sm fill" type="button" data-pgbriefed="${it.id}">${ic(ed ? 'check' : 'pencil')}${ed ? 'Done editing' : 'Edit'}</button></div>`}</div>`; }
  function pgRecipeCard(it, f, id) { const p = it.p, more = PGX.sel['m' + it.id];
    return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk">${ic('layers')}Recipe</span><span class="pgr">How it’s built, in plain words</span></div><p class="pgct">${esc(p.recipe.line)}</p>
      <div class="pgcb"><div class="pgrec">${p.recipe.rows.map(([g, a, b, why]) => `<div class="pgrecr"><i>${ic(g)}</i><div><b>${esc(a)} <em>· ${esc(b)}</em></b><span>${esc(why)}</span></div></div>`).join('')}</div>
      ${more ? `<div class="pgmore">${p.recipe.more.map(x => `<p>${esc(x)}</p>`).join('')}</div>` : ''}</div>
      ${it.ask ? `<div class="pgcf"><button class="bt key" type="button" data-pgcreate="${it.id}">${ic('sparkles')}Looks good, create ${esc(p.n)}</button><button class="bt fill" type="button" data-pgrecmore="${it.id}">${ic(more ? 'chevron-up' : 'info')}${more ? 'Less' : 'Explain more'}</button></div>` : `<div class="pgcf flat"><button class="bt sm fill" type="button" data-pgrecmore="${it.id}">${ic(more ? 'chevron-up' : 'info')}${more ? 'Less' : 'Explain more'}</button></div>`}</div>`; }
  function pgQCard(it, f, id) { return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk">${ic('message-circle')}Question ${it.n} of 3</span></div><p class="pgct">${esc(it.q)}</p>
      <div class="pgq"><div class="pgchips">${it.opts.map((o, k) => `<button class="pgchip${it.picked === k ? ' on' : ''}" type="button" ${it.picked != null ? 'disabled' : `data-pgq="${it.id}:${k}"`}>${it.picked === k ? ic('check') : ''}${esc(o)}</button>`).join('')}</div>${it.hint ? `<span class="pgsub" style="font-size:12px;color:var(--ink-3)">${esc(it.hint)}</span>` : ''}</div></div>`; }
  function pgReveal(it, f, id) { const p = PG.projects.find(x => x.id === it.pid); if (!p) return ''; const path = `~/Documents/Playground Projects/${p.n}`, show = PGX.sel['a' + it.id];
    return `<div class="pgc${f}"${id}><div class="pgch"><span class="pgk good">${ic('folder-open')}Made</span><span class="pgr">Just now</span></div><p class="pgct">${esc(p.n)} lives in <span class="pgpath">${esc(path)}</span></p>
      <div class="pgcb"><p>It’s a real folder on this computer. Everything ${esc(p.n)} needs stays inside it, and every agent works only in here.</p>
      <div class="pgtree"><div class="pgtr">${ic('folder-open')}<b>${esc(p.n)}/</b><span></span></div>
        <div class="pgtr in">${ic('folder')}<b>src/</b><span>The app itself</span></div>
        <button class="pgtr in" type="button" data-pgagents="${it.id}">${ic('file-text')}<b>AGENTS.md</b><span>The rules every agent follows here</span></button>
        <div class="pgtr in">${ic('list-checks')}<b>.playground/goals/</b><span>The plan, one file per goal</span></div>
        <div class="pgtr in">${ic('history')}<b>.playground/activity.jsonl</b><span>The history, written as it happens</span></div></div>
      ${show ? `<div class="pgagmd">${esc(pgAgentsMd(p.n, path))}</div>` : ''}</div>
      <div class="pgcf flat"><button class="bt sm fill" type="button" data-pgagents="${it.id}">${ic(show ? 'chevron-up' : 'eye')}${show ? 'Hide AGENTS.md' : 'Read AGENTS.md'}</button><button class="bt sm fill" type="button" data-pgfiler="${esc(path)}">${ic('folder')}Show in Filer</button></div></div>`; }
  const pgAgentsMd = (n, path) => `# You are working inside Playground\n\nPlayground is an application on Suno that lets anyone build a project and manage every part of it. This project is **${n}**, and it lives in this folder:\n${path}\n\n- Everything you create stays inside this folder.\n- Keep Playground up to date as you work: record goals, steps, decisions and anything worth remembering with the Playground tools (playground.*).\n- Prove your changes with the preview and the checks before you call them done.\n- Never change production directly. Propose a release.\n- When a decision belongs to the person, ask them.`;

  /* ── Kiln itself: Maya's studio, as people see it. Stage shows what's being built; Live shows what people have. ── */
  function klFeat(env) { const st = env === 'stage', wlOn = st || !!PG.rel.waitlist, offer = st ? !!PG.wl.choice && PG.wl.phase !== 'decide' : !!PG.rel.waitlist;
    const relabel = (st ? PG.wl.phase !== 'decide' && !!PG.wl.choice : !!PG.rel.waitlist) && !PG.heads.wlfull;
    return { photos: st || !!PG.rel.photos, waitlist: wlOn, offer, signin: true, full: relabel ? 'Class full' : 'Full' }; }
  const KLSB = `<div class="klsb"><b>9:41</b><span>${ic('wifi')}<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2" y="7" width="18" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4.5" y="9.5" width="11" height="5" rx="1.2"/><rect x="21" y="10" width="1.6" height="4" rx=".8"/></svg></span></div>`;
  function klHTML(o = {}) { const env = o.env || 'stage', dev = o.dev || 'phone', F = { ...klFeat(env), ...(o.feat || {}) }, k = o.shot ? (o.k || { scr: 'home' }) : PGX.kl;
    const wide = dev === 'desk' || dev === 'app', tab = dev === 'tablet', pv = dev === 'phone';
    const cls = KLCLS.map((c, i) => { const full = !c.left, w = c.wait?.[env] || 0;
      const btn = full ? (F.waitlist ? `<button class="klbtn alt" type="button" data-klwait="${i}" data-kp="the Join waitlist button">Join waitlist</button>` : `<button class="klbtn off" type="button" data-kp="the ${F.full} button">${F.full}</button>`) : `<button class="klbtn" type="button" data-klbook="${i}" data-kp="the Book button on ${c.t}">Book</button>`;
      const spots = full ? `<span class="klspots full">${F.full}</span>${F.waitlist && w ? `<span class="klwait">${w} waiting</span>` : ''}` : `<span class="klspots${c.left <= 3 ? ' few' : ''}">${c.left} of 8 wheels left</span>`;
      return `<article class="klc" data-kp="the ${c.t} class"><span class="kld"><small>${c.d}</small><b>${c.n}</b></span><h3>${c.t}</h3><p>${c.when}</p><div class="klact">${spots}${btn}</div></article>`; }).join('');
    const c = KLCLS[k.c ?? 0], waitN = (c.wait?.[env] || 0) + 1, ord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][waitN - 1] || `#${waitN}`;
    const over = k.scr === 'book' ? `<div class="klsheet" data-phmv="1"><h2>${c.t}</h2><p>${['Tue Oct 13', 'Thu Oct 15', 'Sat Oct 17', 'Sun Oct 18'][k.c ?? 0]} · ${c.when} · $${c.price}</p><div class="klfield"><small>Name</small><span>Nick</span></div><div class="klfield"><small>Phone</small><span>+1 510 555 0108</span></div><div class="kltog"><span>Text me the day before</span><i></i></div><button class="klbig" type="button" data-klconfirm data-kp="the Book my wheel button">Book my wheel</button></div>`
      : k.scr === 'booked' ? `<div class="kldone" data-phmv="1"><i>${ic('check')}</i><h2>You’re booked</h2><p>See you ${['Tuesday at 6:30', 'Thursday at 7', 'Saturday at 10', 'Sunday at 2'][k.c ?? 0]}. We’ll text you the day before.</p><button class="klbig" type="button" data-klhome>Done</button></div>`
      : k.scr === 'wait' ? `<div class="klsheet" data-phmv="1"><h2>Join the waitlist</h2><p>${c.t} is full. If someone cancels, the first person waiting is offered the spot.</p><div class="klfield"><small>Name</small><span>Nick</span></div><div class="klfield"><small>Phone</small><span>+1 510 555 0108</span></div>${F.offer ? `<div class="klfield"><small>We’ll reach you</small><span>${PG.wl.choice === 'email' ? 'By email' : PG.wl.choice === 'text' ? 'By text' : 'By text, then email if it doesn’t arrive'}</span></div>` : ''}<button class="klbig alt" type="button" data-kljoin data-kp="the Join the waitlist button">Join the waitlist</button></div>`
      : k.scr === 'waited' ? `<div class="kldone wl" data-phmv="1"><span class="klpos">#${waitN}</span><h2>You’re ${ord} in line</h2><p>${F.offer ? `If a spot opens in ${c.t}, we’ll ${PG.wl.choice === 'email' ? 'email' : 'text'} you, and you’ll have 2 hours to claim it.` : `If a spot opens in ${c.t}, we’ll let you know.`}</p><button class="klbig" type="button" data-klhome>Done</button></div>` : '';
    const notif = o.notif ? `<div class="klnotif" data-phmv="1"><i>${ic('message-square')}</i><b>Kiln · now</b><span>A spot opened in Glaze night, Thu 7 PM. Tap to claim it. It’s held for you until 9:14 PM.</span></div>` : '';
    return `<div class="kl${wide ? ' wide' : ''}${tab ? ' kltab' : ''}" data-klenv="${env}">${pv ? KLSB : ''}<div class="klscroll">
      <header class="klhd"><span class="klmk">${KLMARK}</span><b>Kiln</b><nav class="klnav"><span class="on">Classes</span><span>My bookings</span><span>The studio</span></nav><span class="klsp"></span>${F.signin ? `<button class="klme" type="button" data-kp="your account">N</button>` : `<span class="klsign"><i></i>Sign in</span>`}</header>
      <section class="klhero" data-kp="the welcome"><small>Maya’s pottery studio</small><h1>Find your wheel this week</h1><p>Small classes, eight wheels, every level welcome.</p></section>
      ${F.photos ? `<div class="klph" data-kp="the studio photos">${[0, 1, 2, 3, 4, 5].map(i => `<i role="img" aria-label="Studio photo ${i + 1}">${klArt(i)}</i>`).join('')}</div>` : ''}
      <div class="klh2"><h2>This week</h2><span>Oct 13 to 18</span></div><div class="klcls">${cls}</div>
      </div>
      ${pv || tab ? `<nav class="kltabs"><span class="on">${ic('calendar')}Classes</span><span>${ic('ticket') || ic('bookmark')}My bookings</span><span>${ic('map-pin')}Studio</span></nav>` : ''}${over}${notif}</div>`; }

  /* ── New projects: three templates, each with its own first version ── */
  const PGTPL = {
    plants: { tpl: 'plants', n: 'Sprig', ex: 'A tool to track my plant watering', g: 'leaf', what: 'A plant watering tracker',
      qs: [['Who will use it?', ['Just me', 'Me and my family', 'Anyone with the link']], ['Where will they use it?', ['On phones', 'On computers', 'Both'], 'Phones it is. It can install like an app, so it sits on your home screen.'], ['Does it need to remember things?', ['Remember my plants', 'Plants, and who watered them', 'Nothing to remember']]],
      brief: a => ({ title: 'know which plants are thirsty', what: 'A simple way to keep track of when each plant was last watered, and which ones need water today.', who: a[0] === 'Just me' ? 'You, at home.' : a[0] === 'Me and my family' ? 'You and your family, at home.' : 'Anyone you send the link to.', where: a[1] === 'On computers' ? 'On a computer, in the browser.' : a[1] === 'Both' ? 'Phones and computers. It installs like an app on a phone.' : 'On a phone. It installs like an app.', good: 'Opening it shows what needs water today. Logging a watering is one tap.' }),
      recipe: { line: 'A web app that works great on phones', rows: [['layout-grid', 'Pages', 'SvelteKit', 'Small and quick, and easy for any agent to work on.'], ['database', 'Saving', 'A small database file (SQLite)', 'It lives inside the project folder, so your plants never leave this computer.'], ['user', 'Sign-in', 'None for now', 'It’s just you. Suno Connect can be added in one goal if family joins.'], ['house', 'Runs on', 'This computer, for now', 'Move it to a server when you want it on your phone away from home.']],
        more: ['A web app is a website that behaves like an app. It works in any browser, and on a phone it can be added to the home screen.', 'SvelteKit is the toolkit the pages are made with. You never need to touch it; it’s here so you know what Ari is using.', 'SQLite keeps everything in one file inside the project. Backing up the folder backs up your plants.'] },
      subs: ['Setting up the folder and the pages', 'Drawing the list of plants', 'Adding Water now and the last-watered dates', 'Starting the preview', 'Running the checks'],
      checks: ['Opening it shows the plants that need water today first', 'Tapping Water now moves a plant to Watered today', 'It fits a phone screen with nothing cut off'],
      next: [['Remind me when a plant is thirsty', 'A gentle morning notification for the plants that need water'], ['Add a photo of each plant', 'So you can tell the two ferns apart'], ['Share it with my family', 'They can log waterings too']] },
    game: { tpl: 'game', n: 'Bubble Pop', ex: 'A game my little brother can play on his phone', g: 'gamepad-2', what: 'A tapping game',
      qs: [['How old is he?', ['Under 6', '6 to 9', '10 and up']], ['Where will he play?', ['On a phone', 'On a tablet', 'Both'], 'It can install like an app, so it opens without the browser bars.'], ['Should it remember anything?', ['His best score', 'Nothing at all', 'Scores for the whole family']]],
      brief: a => ({ title: 'pop as many bubbles as you can', what: 'A bright, simple game: bubbles float up, you tap them to pop them before they reach the top.', who: `Your little brother${a[0] === 'Under 6' ? ', who is still learning to read, so no words needed to play' : a[0] === '6 to 9' ? ', aged 6 to 9' : ''}.`, where: a[1] === 'On a tablet' ? 'On a tablet. It installs like an app.' : 'On a phone. It installs like an app.', good: 'He can start playing without help, and a round lasts about a minute.' }),
      recipe: { line: 'A web game that works on phones and tablets', rows: [['layout-grid', 'Pages', 'SvelteKit', 'One page for the game and one for the score.'], ['sparkles', 'Game', 'Plain HTML canvas', 'No game engine needed for something this size, so it loads instantly.'], ['database', 'Saving', 'His best score, on his device', 'Nothing is sent anywhere.'], ['house', 'Runs on', 'This computer, for now', 'Put it on a server when you want it on his phone.']],
        more: ['A canvas is a drawing surface in the browser. Ari draws the bubbles on it many times a second.', 'Scores are kept on the device itself, so there are no accounts and nothing to sign in to.'] },
      subs: ['Setting up the folder and the page', 'Drawing the bubbles', 'Making taps pop them', 'Starting the preview', 'Running the checks'],
      checks: ['Bubbles float up from the bottom of the screen', 'Tapping a bubble pops it and adds a point', 'The buttons are big enough for small fingers'],
      next: [['Add sounds when a bubble pops', 'With a mute button for quiet times'], ['Make it get faster', 'A little quicker every ten bubbles'], ['Put it on his phone', 'Move it to a server so it works away from home']] },
    classes: { tpl: 'classes', n: 'Clay Club', ex: 'A sign-up page for my pottery classes', g: 'calendar', what: 'Class sign-ups',
      qs: [['Who will sign up?', ['Students', 'Parents for their kids', 'Both']], ['Where will they sign up?', ['On phones', 'On computers', 'Both'], 'Most people book on their phone, so it’s built phone first.'], ['Do people need to sign in or pay?', ['Just their name and number', 'Sign in', 'Sign in and pay']]],
      brief: a => ({ title: 'book a spot in a pottery class', what: 'A page that lists this week’s classes and lets people book a spot.', who: a[0] === 'Parents for their kids' ? 'Parents booking for their kids.' : a[0] === 'Both' ? 'Students, and parents booking for their kids.' : 'Students.', where: a[1] === 'On computers' ? 'On a computer, in the browser.' : 'Phones first, and computers too.', good: 'Booking a class takes under a minute, and nobody gets double-booked.' }),
      recipe: { line: 'A web app that works great on phones', rows: [['layout-grid', 'Pages', 'SvelteKit', 'Quick to load, easy to change.'], ['database', 'Data', 'A small database (SQLite)', 'Classes and bookings in one file.'], ['user', 'Sign-in', 'Name and number only', 'Suno Connect can come later.'], ['house', 'Runs on', 'This computer, for now', 'Move it to a server before you share the link.']],
        more: ['A web app is a website that behaves like an app.', 'SQLite keeps classes and bookings in a single file inside the project folder.'] },
      subs: ['Setting up the folder and the pages', 'Listing this week’s classes', 'Adding the Book button', 'Starting the preview', 'Running the checks'],
      checks: ['The page lists this week’s classes with the spots left', 'Booking a class takes one form', 'It fits a phone screen with nothing cut off'],
      next: [['Send a reminder the day before', 'A text so nobody forgets'], ['Add a waitlist for full classes', 'Offer the spot when someone cancels'], ['Put it online', 'Add a server so students can reach it']] }
  };
  const pgTplFor = q => { const s = q.toLowerCase(); return /game|play|brother|sister|kid|bubble/.test(s) ? 'game' : /class|pottery|sign.?up|book|lesson|course|studio/.test(s) ? 'classes' : 'plants'; };
  function pvHTML(p, o = {}) { const dev = o.dev || 'phone', wide = dev === 'desk' || dev === 'app';
    if (p.tpl === 'game') { const b = [[22, 18, 34, '#ff7aa8'], [64, 40, 24, '#ffd25a'], [40, 62, 42, '#7de3ff'], [78, 74, 30, '#a78bfa'], [18, 84, 22, '#6ee7a8'], [70, 22, 18, '#7de3ff']];
      return `<div class="kpv kpvg${wide ? ' wide' : ''}">${dev === 'phone' ? '<div class="kpvsb"><b>9:41</b></div>' : ''}<div class="kpvgtop"><b>Bubble Pop</b><span>Score <em>12</em></span></div><div class="kpvgfield">${b.map(([x, y, s, c]) => `<i style="left:${x}%;top:${y}%;width:${s * (wide ? 1.4 : 1.8)}px;height:${s * (wide ? 1.4 : 1.8)}px;--c:${c}"></i>`).join('')}<span class="kpvpop" style="left:58%;top:52%">+1</span></div><div class="kpvgbot"><button type="button">${ic('pause')}</button><span>Best 31</span></div></div>`; }
    if (p.tpl === 'classes') return `<div class="kpv kpvc${wide ? ' wide' : ''}">${dev === 'phone' ? '<div class="kpvsb"><b>9:41</b></div>' : ''}<header>${pgPmark('classes', 'sm')}<b>Clay Club</b></header><h1>Classes this week</h1>${[['Mon 12', 'Beginners wheel', '4 spots left'], ['Wed 14', 'Hand building', '2 spots left'], ['Sat 17', 'Family clay morning', '6 spots left']].map(([d, t, s]) => `<div class="kpvcrow"><small>${d}</small><b>${t}</b><span>${s}</span><button type="button">Book</button></div>`).join('')}</div>`;
    const pl = [['Fern', '6 days ago', 'thirsty'], ['Monstera', '4 days ago', 'thirsty'], ['Snake plant', '9 days ago', 'ok'], ['Pothos', 'Watered today', 'done'], ['Basil', 'Watered today', 'done']];
    return `<div class="kpv kpvp${wide ? ' wide' : ''}">${dev === 'phone' ? '<div class="kpvsb"><b>9:41</b></div>' : ''}<header>${pgPmark('plants', 'sm')}<b>Sprig</b><span>${ic('plus')}</span></header><h1>2 plants are thirsty</h1><p>Thursday · Basil and the pothos are done</p>
      <h2>Needs water</h2>${pl.filter(x => x[2] !== 'done').map(([n, w, s]) => `<div class="kpvprow${s === 'ok' ? ' ok' : ''}"><i>${ic('leaf')}</i><span><b>${n}</b><small>Last watered ${w}</small></span>${s === 'thirsty' ? `<button type="button">${ic('droplet')}Water now</button>` : '<em>Not yet</em>'}</div>`).join('')}
      <h2>Watered today</h2>${pl.filter(x => x[2] === 'done').map(([n]) => `<div class="kpvprow done"><i>${ic('check')}</i><span><b>${n}</b><small>Watered at 8:10 AM</small></span></div>`).join('')}</div>`; }

  /* ── The Stage: a device frame, scaled to the room it has ── */
  const PGDEV = { phone: [391, 806], tablet: [860, 1140], desk: [1280, 840], app: [1000, 700] };
  function pgDevice(dev, inner, env) { if (dev === 'phone') return `<div class="pgdev phone"><div class="pgscr">${inner}</div></div>`;
    if (dev === 'tablet') return `<div class="pgdev tablet"><div class="pgscr">${inner}</div></div>`;
    if (dev === 'desk') return `<div class="pgdev desk"><div class="pgbrow"><i></i><i></i><i></i><span>${ic(env === 'live' ? 'lock' : 'server')}${env === 'live' ? 'kiln.studio' : 'Stage · on the Dev server · your team only'}</span></div><div class="pgscr">${inner}</div></div>`;
    return `<div class="pgdev appw"><div class="pgappbar"><span class="klmk">${PG.proj === 'kiln' ? KLMARK : pgPmark(pgProj()?.tpl || 'plants')}</span>${esc(pgProj()?.n || 'Kiln')}<span class="pgwc">${ic('minus')}${ic('square')}${ic('x')}</span></div><div class="pgscr">${inner}</div></div>`; }
  function pgFit() { const cv = $('#pg-canvas'), wr = cv?.querySelector('.pgdevwrap'); if (!wr) return; const [w, h] = PGDEV[wr.dataset.dev] || PGDEV.phone;
    const aw = cv.clientWidth - 28, ah = cv.clientHeight - 24; if (aw < 40 || ah < 40) return; const s = Math.min(1, aw / w, ah / h);
    wr.style.width = Math.round(w * s) + 'px'; wr.style.height = Math.round(h * s) + 'px'; const d = wr.firstElementChild; if (d) { d.style.transform = `scale(${s})`; d.style.transformOrigin = '0 0'; } }
  function pgStage() { const el = $('#pg-stage'); if (!el) return; const p = pgProj(), kiln = PG.proj === 'kiln', dev = PGU.dev, env = kiln ? PGU.env : 'stage';
    const np = !kiln ? PG.projects.find(x => x.id === PG.proj) : null, ready = kiln || np?.preview;
    const devs = [['phone', ic('smartphone'), 'Phone'], ['tablet', pic('tablet'), 'Tablet'], ['desk', ic('monitor'), 'Desktop'], ['app', ic('app-window'), 'App window']];
    const inner = kiln ? klHTML({ dev, env }) : np?.preview ? pvHTML(np, { dev }) : '';
    const canvas = ready ? `<div class="pgdevwrap" data-dev="${dev}">${pgDevice(dev, inner, env)}</div>` : np?.building ? `<div class="pgbuilding"><i class="pgspin"></i><span>Starting the preview…</span></div>` : `<div class="pgempty"><i>${ic('smartphone')}</i><b>Nothing to show yet</b><span>${np ? 'The first version appears here as soon as Ari has something real.' : 'Describe what you want to make, and the first version appears here.'}</span></div>`;
    const cap = !ready ? '' : env === 'live' ? `<i class="stat"></i><span><b>Live</b> · kiln.studio · 34 people booked this week</span>` : kiln ? `<i class="pgsd"></i><span><b>Stage</b> · on the Dev server · its own copy of the bookings</span>` : `<i class="pgsd"></i><span><b>Stage</b> · on this computer · only you can see it</span>`;
    el.innerHTML = `<div class="pgsth">${seg(devs.map(([k, g, t]) => [k, g, t]), dev, 'data-pgdev', 'Device', 'ico')}<span class="sp"></span>${kiln ? seg([['stage', '<i class="pgsd"></i>Stage'], ['live', '<i class="stat"></i>Live']], env, 'data-pgenv', 'Stage or Live', 'pgenv') : ''}
        ${pgNarrow() ? '' : `<button class="ib" type="button" data-pgwide title="${PGU.wide ? 'Make the Stage smaller' : 'Make the Stage bigger'}" aria-label="Resize the Stage">${ic(PGU.wide ? 'minimize-2' : 'maximize-2')}</button>`}<button class="ib pgx" type="button" data-pgstx aria-label="Close the Stage">${ic('x')}</button></div>
      <div class="pgcanvas" id="pg-canvas">${PGX.pointing ? `<span class="pgpointtip" data-phmv="1">${ic('mouse-pointer-click')}Click anything to talk about it</span>` : ''}${canvas}</div>
      <div class="pgcap">${cap}</div>
      <div class="fbar phnofit pgstbar" id="pg-stbar">${ready ? `<button class="bt${PGX.pointing ? ' on' : ''}" type="button" data-pgpoint>${ic('mouse-pointer-click')}Point</button>
        ${PGX.rec ? `<button class="bt rec" type="button" data-pgrec><i class="pgrecdot"></i><b>${pgDur((Date.now() - PGX.rec) / 1000)}</b>Stop</button>` : `<button class="bt" type="button" data-pgrec>${ic('circle-dot')}Record</button>`}
        <button class="bt" type="button" data-pgopen>${pic('ext')}Open${ic('chevron-down')}</button>` : `<button class="bt" type="button" disabled>${ic('mouse-pointer-click')}Point</button><button class="bt" type="button" disabled>${ic('circle-dot')}Record</button><button class="bt" type="button" disabled>${pic('ext')}Open</button>`}</div>`;
    el.classList.toggle('pgpointing', PGX.pointing); segs(); setTimeout(pgFit, 0); setTimeout(pgFit, 80); }

  /* ── The frame: title bar, rail, conversation, composer ── */
  const pgKey = gid => PG.proj === 'kiln' ? gid : PG.proj === 'new' ? 'new' : PG.proj + '/' + gid;
  function pgTop() { const p = pgProj(), here = PG.proj === 'kiln' ? ['PR'] : [], sp = PGAG.ari, g = pgGoal(), st = pgState(g);
    $('#pg-top').innerHTML = `${NAVBTN}<img src="${PGICON}" alt=""><b>Playground</b><span class="chev">${ic('chevron-down')}</span>
      ${p ? `<span class="pgdiv"></span><button class="pgproj" type="button" data-pgbook title="Open the Project book">${pgPmark(p.mark || 'kiln')}${esc(p.n)}<em>Project book</em>${ic('book-open')}</button>` : ''}
      <span class="pgtbr">${p ? `${PG.proj === 'kiln' ? `<button class="pghere" type="button" data-pgsheet="people" title="Priya is here now. Sam was here 2 hours ago."><span class="pgstk"><span class="pgpres">${av('PR', 24)}</span><span class="pgpres away">${av('SK', 24)}</span></span><span>People</span></button>` : `<button class="pgtb" type="button" data-pgsheet="people">${ic('users')}<span>People</span></button>`}
        <button class="pgtb${PGX.sheet === 'places' ? ' on' : ''}" type="button" data-pgsheet="places" title="Where ${esc(p.n)} lives and runs">${ic('server')}<span>Places</span><i class="stat"></i></button>
        <button class="pgtb${PGX.sheet === 'usage' ? ' on' : ''}" type="button" data-pgsheet="usage" title="Agents, models and money">${ic('gauge')}<span>Usage</span><i class="pgmini"><i style="width:${PG.ag[g?.id] === 'claude' ? 38 : 18}%"></i></i></button>` : ''}
</span>
      <button class="pgtb pgstbtn${PGX.stageOn ? ' on' : ''}" type="button" data-pgstbtn title="Show the Stage">${ic('smartphone')}<span>Stage</span>${PG.proj === 'kiln' ? '<i class="stat"></i>' : ''}</button>
      ${PGX.page && pgNarrow() ? `<button class="pgphback" type="button" data-pgback data-phmv="1">${ic('chevron-left')}<span>${esc(g?.t || 'Back')}</span></button>` : ''}`; }
  function pgSide() { const all = [{ id: 'kiln', n: 'Kiln', mark: 'kiln', what: 'Class sign-ups for Maya’s studio' }, ...PG.projects.map(p => ({ id: p.id, n: p.n, mark: p.tpl, what: p.what }))];
    const goals = () => { const cur = pgGoal(); return `<div class="pggoals">${pgGoals().map(g => { const st = pgState(g), on = cur?.id === g.id && !PGX.page;
        return `<button class="pggl${on ? ' on' : ''}${g.chat ? ' chat' : ''}" type="button" data-pggoal="${g.id}">${pgGlyph(g, st)}<span><b>${esc(g.t)}</b>${g.chat ? '' : `<small class="${pgK(st.k)}">${esc(st.s)}</small>`}</span>${g.by && g.by !== 'me' ? `<i class="pgpres${g.by === 'PR' ? '' : ' away'}" title="${esc(ppl(g.by).n)}${g.by === 'PR' ? ' is here' : ''}">${av(g.by, 20)}</i>` : ''}</button>`; }).join('')}
        <button class="pggl add" type="button" data-pgnewgoal>${ic('plus')}<span><b>New goal</b></span></button></div>`; };
    $('#pg-side').innerHTML = `<div class="sh">Projects<button class="ib" type="button" data-pgnewproj title="New project" aria-label="New project">${ic('plus')}</button></div>
      <div class="scr">${all.map(p => { const on = PG.proj === p.id; return `<button class="pgprow${on ? ' on' : ''}" type="button" ${on ? 'data-pgprojmenu' : `data-pgproj="${p.id}"`}>${pgPmark(p.mark)}<span><b>${esc(p.n)}</b><small>${esc(p.what)}</small></span>${on ? `<span class="ib" aria-hidden="true">${ic('ellipsis')}</span>` : ''}</button>${on ? goals() : ''}`; }).join('')}
        ${PG.proj === 'new' ? `<button class="pggl on" type="button"><i class="pgg draft"></i><span><b>New project</b><small>${PGX.nw?.tpl ? 'Ari is asking a few questions' : 'Describe what you want to make'}</small></span></button>` : `<button class="pggl add" type="button" data-pgnewproj>${ic('plus')}<span><b>New project</b></span></button>`}</div>
      <div class="pgfoot pgphonly">${PG.proj !== 'new' ? `<button class="si" type="button" data-pgbook>${ic('book-open')}<span class="lab">Project book</span></button><button class="si" type="button" data-pgsheet="people">${ic('users')}<span class="lab">People</span>${PG.proj === 'kiln' ? '<em>Priya is here</em>' : ''}</button><button class="si" type="button" data-pgsheet="places">${ic('server')}<span class="lab">Places</span></button><button class="si" type="button" data-pgsheet="usage">${ic('gauge')}<span class="lab">Usage</span></button>` : ''}</div>`; }
  function pgTtl() { const w = pgW(); if (!w?.clientWidth) return; const g = pgGoal(), st = pgState(g), p = pgProj();
    if (!pgNarrow()) { lNavTtl(w, null); return; }
    const t = PG.proj === 'new' ? 'New project' : PGX.page === 'book' ? 'Project book' : PGX.page === 'code' ? 'The code' : PGX.page === 'review' ? 'Review' : g?.t || 'Playground';
    lNavTtl(w, t, PG.proj === 'new' ? 'Playground' : `${p?.n || ''}${g && !g.chat && !PGX.page ? ' · ' + st.l : ''}`); }
  function pgMain(keep) { const b = $('#pg-body'); if (!b) return; const y = b.scrollTop;
    if (PG.proj === 'new' && !PGX.nw?.tpl) { b.innerHTML = pgNewHero(); return; }
    const g = PG.proj === 'new' ? { id: 'new', t: 'New project' } : pgGoal(); if (!g) { b.innerHTML = ''; return; }
    const st = pgState(g), items = PG.proj === 'new' ? (PG.add.new || []) : pgThread(g.id), ag = PG.ag[pgKey(g.id)] || PG.ag[g.id] || 'ari';
    const meta = g.chat ? `<span>The whole project. Ask anything, or start a goal from here.</span>` : PG.proj === 'new' ? `<span>Ari asks a few questions, then makes the project</span>` : `<span class="pgpill ${pgK(st.k)}">${st.k === 'work' ? '<i class="pgspin"></i>' : ''}${esc(st.l)}</span><span>${esc(g.began || 'Started just now')}</span><i class="d"></i><span>${pgAm(g.id === 'texts' && PG.texts === 'priya' ? 'priya' : ag, 'sm')}${g.id === 'texts' && PG.texts === 'priya' ? 'Priya’s Claude, on her computer' : `${esc(PGAG[ag]?.n || 'Ari')}, on ${ag === 'team' ? 'the Dev server' : 'this computer'}`}</span>`;
    b.innerHTML = `<div class="pgthread"><header class="pghd"><div class="pghdr"><div><h1>${esc(g.t)}</h1><div class="pgmeta">${meta}</div></div>${g.chat || PG.proj === 'new' ? '' : `<button class="ib" type="button" data-pggmore title="More" aria-label="More for this goal">${ic('ellipsis')}</button>`}</div></header>
      ${items.map(it => pgItem(it, g.id)).join('')}${PGX.busy[pgKey(g.id)] === 'think' ? pgItem({ k: 'think', ag, t: PGX.thinkT }) : ''}</div>`;
    b.scrollTop = keep ? y : b.scrollHeight; }
  function pgNewHero() { return `<div class="pgnew"><img class="pgnewmark" src="${PGICON}" alt=""><h1>What do you want to make?</h1><p>Say it the way you’d tell a friend. Ari asks a couple of questions, makes a real folder for it, and gets a first version on screen.</p>
      <div class="pgbig"><textarea id="pg-newq" rows="3" placeholder="A little app that…" aria-label="What do you want to make?">${esc(PGX.newq || '')}</textarea><div><button class="ib" type="button" data-pgmic title="Say it instead" aria-label="Say it instead">${ic('mic')}</button><small>Press Return to start</small><span class="sp"></span><button class="bt key" type="button" data-pgnewgo>${ic('sparkles')}Start</button></div></div>
      <div class="pgexs"><small>Or start from one of these</small>${Object.values(PGTPL).map(t => `<button class="pgex" type="button" data-pgex="${t.tpl}">${ic(t.g)}<span>${esc(t.ex)}</span>${ic('arrow-right').replace('class="i"', 'class="i pgarr"')}</button>`).join('')}</div></div>`; }
  /* the composer: who's working first, then what you want. Someone else's goal, or a paused one, says so instead. */
  function pgBar() { const bar = $('#pg-bar'); if (!bar) return; const g = pgGoal(), ph = pgNarrow();
    bar.className = 'fbar phnofit pgcomp'; bar.hidden = !!(PG.proj === 'new' && !PGX.nw?.tpl) || !!PGX.page;
    bar.style.display = bar.hidden ? 'none' : ''; if (bar.hidden) { bar.innerHTML = ''; return; }
    if (g?.id === 'texts' && PG.texts === 'priya' && PG.proj === 'kiln') { bar.classList.add('pgbanbar'); bar.innerHTML = `<div class="pgban">${av('PR', 30)}<span><b>This is Priya’s goal.</b> Her agent is working on it right now, on her computer.</span><button class="bt fill" type="button" data-pgmsg="PR">${ic('message-square')}Message Priya</button><button class="bt key" type="button" data-pgpickup>${pic('handoff')}Pick it up</button></div>`; return; }
    if (g?.id === 'gifts' && PG.gifts === 'paused' && PG.proj === 'kiln') { bar.classList.add('pgbanbar'); bar.innerHTML = `<div class="pgban"><i class="pgg paused" style="margin-left:8px"></i><span><b>Paused on Oct 2.</b> Nothing runs until you resume it.</span><button class="bt key" type="button" data-pgresume>${ic('play')}Resume</button></div>`; return; }
    const key = pgKey(g?.id || 'new'), ag = PG.ag[key] || 'ari', a = PGAG[ag], busy = PGX.busy[key], draft = PGX.draft[key] || '';
    const ph1 = PG.proj === 'new' ? 'Answer, or tell Ari more…' : g?.chat ? `Ask ${a.n} about ${pgProj()?.n || 'the project'}, or start a goal…` : busy ? `${a.n} is working. You can still add something…` : g?.id === 'signin' ? 'Ask about sign-in, or start a follow-up…' : `Tell ${a.n} what to change…`;
    const pt = PGX.point ? `<span class="pgptchip">${ic('mouse-pointer-click')}Pointing at ${esc(PGX.point)}<button type="button" data-pgptx aria-label="Stop pointing">${ic('x')}</button></span>` : '';
    const agentBtn = `<button class="pgagent${PGX.pick ? ' on' : ''}" type="button" data-pgagentbtn aria-haspopup="true" aria-expanded="${PGX.pick}" title="Who works on this goal">${pgAm(ag)}${ph ? '' : `<span>${esc(a.n)}<small>${esc(ag === 'ari' ? 'Suno credits' : a.plan || a.kind)}</small></span>${ic('chevron-down')}`}</button>`;
    const send = `<button class="bt key pgsend${draft.trim() ? ' on' : ''}" type="button" data-pgsend aria-label="Send">${ic('arrow-up')}</button>`;
    if (ph) { bar.innerHTML = `${PGX.pick ? `<div class="fexp pgexp">${pgPicker()}</div>` : ''}${pt ? `<div class="pgptrow">${pt}</div>` : ''}<div class="pgrow1">${agentBtn}<div class="pgin"><textarea id="pg-q" rows="1" placeholder="${esc(PG.proj === 'new' ? 'Tell Ari more…' : `Tell ${a.n}…`)}" aria-label="Message">${esc(draft)}</textarea><button class="ib" type="button" data-pgattach aria-label="Attach">${ic('paperclip')}</button></div>${send}</div>`; return; }
    bar.innerHTML = `${agentBtn}<div class="pgin">${pt}<textarea id="pg-q" rows="1" placeholder="${esc(ph1)}" aria-label="Message">${esc(draft)}</textarea></div><button class="ib" type="button" data-pgattach title="Attach a file or a screenshot" aria-label="Attach">${ic('paperclip')}</button>${send}`;
    pgAuto(); }
  const pgAuto = () => { const t = $('#pg-q'); if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(150, t.scrollHeight) + 'px'; };
  /* the picker: every connection, whose it is, what's left, where it runs, and the one rule about personal plans */
  function pgPicker() { const key = pgKey(pgGoal()?.id || 'new'), cur = PG.ag[key] || 'ari';
    const row = k => { const a = PGAG[k], on = cur === k, where = k === 'qwen' ? PG.conn.qwenWhere : k === 'claude' ? PG.conn.claudeWhere : k === 'codex' ? PG.conn.codexWhere : a.where;
      return `<button class="pgpr${on ? ' on' : ''}" type="button" data-pgpickag="${k}">${pgAm(k, 'md')}<b>${esc(a.n)}<em>${esc(k === 'ari' ? 'Suno’s agent' : a.plan)}</em></b>${on ? `<span class="pgck2">${ic('check')}</span>` : '<span></span>'}
        <small><span class="pghead">${esc(a.head)}</span><span>${ic(where === 'dev' ? 'server' : 'house')}${pgWhereN[where]}</span><span>${ic(a.share === 'team' ? 'users' : 'lock')}${a.share === 'team' ? (k === 'team' ? 'Priya’s, shared' : 'Shared with the team') : 'Just you'}</span></small></button>`; };
    return `<h6>Who works on this goal<span>Switching keeps the thread</span></h6>${['ari', 'claude', 'codex', 'qwen', 'team'].map(row).join('')}
      <h6>Your teammates</h6>${['priya', 'sam'].map(k => { const a = PGAG[k]; return `<div class="pgpr mate">${pgAm(k, 'md')}<b>${esc(a.n)}<em>${esc(a.plan)}</em></b>${k === 'priya' ? `<button class="bt sm fill" type="button" data-pggive="PR">Give to Priya</button>` : '<span></span>'}<small><span>${esc(a.reset)}</span></small></div>`; }).join('')}
      <div class="pgrule">${ic('lock')}<span>Personal plans like Claude Max or ChatGPT Plus are for one person, so they’re never shared. Teammates use the team key, a local model or Ari, or hand the work to the plan’s owner.</span></div>
      <span class="crsep"></span><button class="crmi" type="button" data-pgsheet="usage">${ic('gauge')}<span>Usage and sharing</span></button>`; }
  function pgPickOpen() { pgW().querySelector('#pg-pick')?.remove(); if (!PGX.pick || pgNarrow()) return; const w = pgW(), b = w.querySelector('[data-pgagentbtn]'); if (!b) return;
    w.insertAdjacentHTML('beforeend', `<div class="crpop pgpick" id="pg-pick">${pgPicker()}</div>`); const p = $('#pg-pick'), wr = w.getBoundingClientRect(), r = b.getBoundingClientRect();
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left)) + 'px'; p.style.bottom = Math.round(wr.bottom - r.top + 10) + 'px'; p.style.top = 'auto'; }

  /* ── Sheets: Places, People, Usage, and the QR for your phone ── */
  const pgSw = (on, attr, lock) => `<button class="pgsw${on ? ' on' : ''}${lock ? ' lock' : ''}" type="button" role="switch" aria-checked="${on}" ${lock ? 'disabled' : attr}></button>`;
  const pgTag = (t, cls = '', g) => `<span class="pgtag ${cls}">${g ? ic(g) : ''}${esc(t)}</span>`;
  function pgSheet() { const w = pgW(), sh = $('#pg-sheet'); if (!sh) return; const k = PGX.sheet;
    w.classList.toggle('pgsheeton', !!k); if (!k) { sh.classList.remove('show'); return; }
    const p = pgProj(), kiln = PG.proj === 'kiln', head = (t, s, back) => `<div class="pgshh">${back ? `<button class="ib back" type="button" data-pgusageback aria-label="Back to Usage">${ic('chevron-left')}</button>` : ''}<div><h2>${t}</h2><p>${s}</p></div><button class="ib" type="button" data-pgshx aria-label="Close">${ic('x')}</button></div>`;
    let html = '';
    if (k === 'places') { const home = PG.home, places = [...(kiln ? PGPLACES : PGPLACES.slice(0, 1)), ...PG.places];
      html = head('Places', `Where ${esc(p?.n || 'the project')} lives and runs`) + `<div class="pgshb">
        <h3>Home</h3><div class="pghome"><button type="button" class="${home === 'dev' && kiln ? 'on' : ''}" data-pghome="dev"${kiln ? '' : ' disabled'}><i>${ic('server')}</i><b>Dev server</b><small>${kiln ? 'The box in the closet. Always on.' : 'Add a server first'}</small></button><button type="button" class="${home === 'this' || !kiln ? 'on' : ''}" data-pghome="this"><i>${ic('laptop')}</i><b>This computer</b><small>Nick’s laptop</small></button></div>
        ${home === 'this' || !kiln ? `<div class="pgwarn">${ic('triangle-alert')}<span><b>Teammates can work only while this computer is on.</b> If it sleeps, their previews and agents pause until it wakes. That’s fine for a project of your own.</span></div>` : `<div class="pginfo" style="margin-top:10px">${ic('refresh-ccw')}<span>${esc(p.n)} lives on the Dev server, so Priya and Sam can work any time. <b>Your copy</b> stays in sync at <span class="pgpath">${esc(p.path)}</span>, so you can read and plan offline.</span></div>`}
        <h3>Places<button class="pglnk" type="button" data-pgaddplace>${ic('plus')}Add a place</button></h3>
        ${PGX.addPlace ? `<div class="pgaddw">${seg([['ari', 'Tell Ari'], ['ssh', 'SSH details']], PGX.addPlace, 'data-pgaddmode', 'How to add it')}
          ${PGX.addPlace === 'ari' ? `<div class="pgfield">${ic('message-circle')}<input id="pg-placeq" placeholder="Our test server is at 203.0.113.9" value="Our test server is at 203.0.113.9" aria-label="Tell Ari about the place"><button class="bt key" type="button" data-pgaddgo>Add</button></div><p class="pgsm" style="margin:0;font-size:12px;color:var(--ink-3)">Ari connects, works out what the machine can do, and suggests a role.</p>`
            : `<div class="pgform"><label class="pgfield wide">${ic('globe')}<input value="203.0.113.9" aria-label="Address"></label><label class="pgfield">${ic('user')}<input value="kiln" aria-label="User name"></label><label class="pgfield">${ic('hash') || ic('plug')}<input value="22" aria-label="Port"></label></div>
              <div style="display:flex;align-items:center;gap:8px">${seg([['dev', 'Development'], ['prod', 'Production'], ['prev', 'Preview']], 'prev', 'data-pgrole2', 'Role')}<span class="sp" style="flex:1"></span><button class="bt key" type="button" data-pgaddgo>Connect</button></div>`}</div><div style="height:10px"></div>` : ''}
        <div class="pglist">${places.map(pl => `<div class="pgrow"><i>${ic(pl.icon)}</i><b>${esc(pl.n)}${pgTag(pl.role, pl.role === 'Production' ? 'red' : pl.role === 'Development' ? 'run' : '', pl.role === 'Production' ? 'lock' : null)}</b><small>${esc(pl.sub)}${pl.does ? `<br>${esc(pl.does)}` : ''}</small><span class="pgend"><em>${pl.st === 'on' ? `<i class="stat" style="width:6px;height:6px;margin-right:6px"></i>${esc(pl.up || 'On')}` : pl.st === 'idle' ? 'Sleeping' : 'Not open'}</em></span></div>`).join('')}</div>
        ${kiln ? `<h3>Who can get in</h3><p class="pgsm">Nobody passes keys around. Each person’s device has its own key, tied to their Suno Connect identity, and the servers let them in with a certificate Kiln signs. It lasts 8 hours and renews on its own.</p>
        <div class="pglist">${[['me', 'Nick', 'This laptop and your phone', 'Owner'], ['PR', 'Priya Raman', 'Her laptop and her phone', 'Builder'], ['SK', 'Sam Kaur', 'His laptop', 'Reviewer'], ...PG.members.map(m => [null, m.n, 'Invited · not set up yet', m.role])].map(([k2, n, d, r]) => { const on = !k2 || k2 === 'me' || PG.access[k2] !== false;
          return `<div class="pgrow${on ? '' : ' dim'}">${k2 ? av(k2, 34) : pgAv0(n[0], 120, 34)}<b>${esc(n)}${pgTag(r)}</b><small>${on ? `${pic('cert')} ` : ''}${on ? esc(d) + (k2 && k2 !== 'me' ? ' · certificate valid until 6:10 PM' : '') : 'No access. Their certificates stopped working everywhere.'}</small><span class="pgend">${k2 && k2 !== 'me' ? `<button class="bt sm fill" type="button" data-pgaccess="${k2}">${on ? 'Remove' : 'Let back in'}</button>` : ''}</span></div>`; }).join('')}</div>
        <h3>Project vault</h3><div class="pglist"><div class="pgrow"><i>${pic('vault')}</i><b>${PGVAULT.length} secrets${pgTag('End-to-end encrypted', 'good', 'lock')}</b><small>Locked to the devices of the people on Kiln. The Hub only ever carries scrambled data, so not even Suno can read these.</small></div>
          ${PGVAULT.map(([n, u, by]) => `<div class="pgrow"><i>${ic('key-round')}</i><b>${esc(n)}</b><small>${esc(u)} · added by ${esc(by)}</small><span class="pgend"><em>••••••</em></span></div>`).join('')}</div>
        <h3>Keeping things safe</h3><div class="pglist">
          <div class="pgrow"><i>${ic('shield-check')}</i><b>Agents can’t change Production</b><small>Changes go live only through Review, and every release saves a restore point you can go back to.</small><span class="pgend">${pgSw(true, '', true)}</span></div>
          <div class="pgrow"><i>${ic('folder')}</i><b>Agents stay inside the Kiln folder</b><small>They can write only in the project, and reach the internet through a short list of allowed sites: the texting service, the email service and the package registry.</small></div>
          <div class="pgrow"><i>${ic('database')}</i><b>Stage has its own copy of the bookings</b><small>Testing never texts a real person. Undo covers data as well as code.</small></div></div>` : `<h3>Sharing</h3><div class="pginfo">${ic('info')}<span>${esc(p?.n || 'This project')} lives on this computer. Add a server when you want teammates, or want it on your phone away from home.</span></div>`}</div>`; }
    if (k === 'people') { const ppl2 = kiln ? PGPEOPLE : PGPEOPLE.slice(0, 1);
      html = head('People', kiln ? `${3 + PG.members.length} people on Kiln · Priya is here now` : `Just you on ${esc(p?.n || 'this project')}`) + `<div class="pgshb">
        <h3>Invite someone</h3><div class="pgfield">${ic('user-plus')}<input id="pg-invq" placeholder="Suno Connect name or email" aria-label="Suno Connect name or email">${seg([['Builder', 'Builder'], ['Reviewer', 'Reviewer'], ['Viewer', 'Viewer']], PGX.invRole || 'Builder', 'data-pginvrole', 'Role')}<button class="bt key" type="button" data-pginvite>Invite</button></div>
        <p class="pgsm" style="margin-top:8px">Everyone gets the full Playground app on their own computer, never a cut-down web page.</p>
        <h3>On ${esc(p?.n || 'the project')}</h3><div class="pglist">${ppl2.map(m => `<div class="pgrow"><span class="pgpres${m.here ? '' : ' away'}">${av(m.k, 34)}</span><b>${esc(m.n)}${m.k === 'me' ? ' (you)' : ''}${pgTag(m.role)}</b><small>${esc(PGROLES[m.role])}<br>${m.here ? '<b style="color:var(--good);font-weight:600">Here now</b> · ' : ''}${esc(m.where)}</small><span class="pgend">${m.k === 'me' ? '' : `<button class="bt sm fill" type="button" data-pgrolebtn="${m.k}">${ic('chevron-down')}Role</button>`}</span></div>`).join('')}
          ${PG.members.map(m => `<div class="pgrow">${pgAv0(m.n[0].toUpperCase(), 120, 34)}<b>${esc(m.n)}${pgTag(m.role)}</b><small>Invited just now · they’ll get the app and an invitation</small><span class="pgend"><em>Waiting</em></span></div>`).join('')}</div>
        <h3>What everyone shares</h3><div class="pgtwo"><div><h4>${ic('refresh-ccw')}Synced to everyone</h4><ul><li>Goals and their conversations</li><li>Decisions</li><li>The Project book</li><li>History</li></ul></div><div><h4>${ic('radio')}Streamed from the ${kiln ? 'Dev server' : 'home computer'}</h4><ul><li>The running app on Stage</li><li>Terminals</li><li>Agents at work, live</li></ul></div></div>
        <div class="pginfo" style="margin-top:8px">${ic('info')}<span>If the ${kiln ? 'Dev server' : 'home computer'} is off, everyone can still read and plan. Previews and agents wait until it’s back.</span></div>
        <h3>Take a look</h3><div class="pglist"><div class="pgrow"><i>${ic('eye')}</i><b>A read-only link</b><small>For people without Playground, like Maya or a friend. They see Stage and can leave comments. They can’t change anything, and it’s never how a teammate works.</small><span class="pgend">${pgSw(PG.look, 'data-pglook')}</span></div>
          ${PG.look ? `<div class="pgrow"><i>${ic('link')}</i><b><span class="pgpath">look.suno.app/kiln-7fa3</span></b><small>Shows Stage only · expires in 7 days</small><span class="pgend"><button class="bt sm fill" type="button" data-pgcopy>${ic('copy')}Copy</button></span></div>` : ''}</div></div>`; }
    if (k === 'usage' && PGX.usage) { const id = PGX.usage, a = PGAG[id], c = PG.conn, personal = id === 'claude' || id === 'codex', where = id === 'qwen' ? c.qwenWhere : id === 'claude' ? c.claudeWhere : id === 'codex' ? c.codexWhere : a.where;
      html = head(esc(a.n), esc(a.kind) + (a.plan ? ' · ' + esc(a.plan) : ''), true) + `<div class="pgshb"><div class="pgconnh">${pgAm(id, 'lg')}<div><b>${esc(a.n)}</b><small>${esc(id === 'ari' ? 'Paid with your ChatGPT plan (Sign in with ChatGPT) or Suno credits' : id === 'team' ? 'An Anthropic API key Priya set up for the team' : id === 'qwen' ? 'Runs on this computer with 32 GB of memory' : `Your ${a.plan}, signed in through ${id === 'claude' ? 'Claude’s' : 'Codex’s'} own program`)}</small></div></div>
        <div class="pglist"><div class="pgrow"><i>${ic('gauge')}</i><b>${esc(a.head)}</b><small><span class="pgmeter" style="margin:6px 0 4px"><i style="width:${a.pct}%"></i></span>${esc(a.reset)}</small></div></div>
        <h3>Who can use it</h3><div class="pglist">${personal ? `<div class="pgopt2"><div><b>Just you</b><small>Personal plans can’t be shared with other people. That’s ${id === 'claude' ? 'Anthropic’s' : 'OpenAI’s'} rule, and it keeps your account safe.</small></div>${ic('lock')}</div>
            <div class="pgopt2"><div><b>Work on team tasks</b><small>Your agent picks up goals given to you, or from Kiln’s shared queue, on your plan and your computer. You see everything it does and can stop it any time.</small>${c.claudeTeam && id === 'claude' ? `<label class="pgslider"><span>Up to</span><input type="range" min="5" max="50" step="5" value="${c.claudeCap}" data-pgcap="claudeCap"><b>${c.claudeCap}%</b><span>of my week</span></label>` : ''}</div>${pgSw(id === 'claude' && c.claudeTeam, `data-pgconn="claudeTeam"`, id !== 'claude')}</div>`
          : `<div class="pgopt2"><div><b>Share with the team</b><small>${id === 'team' ? 'Priya shared it. Anyone on Kiln can pick it, and every run says it used the team key.' : id === 'qwen' ? 'Local models are yours to share. Teammates’ goals can run on it when it’s on the Dev server.' : 'Ari’s credits are shared by default. Every run is labelled with who started it.'}</small></div>${pgSw(id === 'qwen' ? c.qwenShare : true, id === 'qwen' ? 'data-pgconn="qwenShare"' : '', id !== 'qwen')}</div>
            <div class="pgopt2"><div><b>Spending cap</b><small>${id === 'team' ? 'Agents stop and ask before going over.' : id === 'qwen' ? 'Free to run. It uses this computer’s memory and power.' : 'Ari asks before a goal goes over.'}</small>${id === 'team' ? `<label class="pgslider"><span>$</span><input type="range" min="5" max="100" step="5" value="${c.teamCap}" data-pgcap="teamCap"><b>$${c.teamCap}</b><span>a month</span></label>` : ''}</div>${id === 'team' ? '' : `<em class="pgsub" style="font-style:normal;font-size:12.5px;color:var(--ink-2)">${id === 'qwen' ? 'None needed' : '$8 a week'}</em>`}</div>
            <div class="pgopt2"><div><b>Owner</b><small>${id === 'team' ? 'Priya. Only she can change the key or the cap.' : 'You.'}</small></div></div>`}</div>
        <h3>Where it runs</h3><div class="pglist"><div class="pgopt2"><div><b>${pgWhereN[where]}</b><small>${where === 'dev' ? (personal ? 'On the server it’s still your private seat: your sign-in is encrypted to you, and it only works on your goals.' : 'On the Dev server, so teammates’ goals can use it while laptops are closed.') : 'Runs here. It pauses when this computer sleeps.'}</small></div>${id === 'team' ? '<em class="pgsub" style="font-style:normal;font-size:12.5px;color:var(--ink-2)">Priya decides</em>' : id === 'ari' ? '' : `<button class="bt sm fill" type="button" data-pgwh="${id}:${where === 'dev' ? 'this' : 'dev'}">${ic(where === 'dev' ? 'laptop' : 'server')}${where === 'dev' ? 'Bring it back here' : 'Move to the server'}</button>`}</div></div>
        ${id === 'qwen' ? `<div class="pginfo" style="margin-top:10px">${pgic('bulb')}<span>A model this size does real work in <b>Private mode</b>, with a 64k memory for the conversation. When a job is too big for it, it hands up to Ari and tells you.</span></div>` : ''}</div>`; }
    else if (k === 'usage') { const c = PG.conn, rows = ['ari', 'claude', 'codex', 'qwen', 'team'];
      html = head('Usage', `Agents, models and money on ${esc(p?.n || 'the project')}`) + `<div class="pgshb">
        <h3>Your connections</h3><div class="pglist">${rows.map(id => { const a = PGAG[id], team = id === 'claude' ? c.claudeTeam : a.share === 'team';
          return `<button class="pgrow" type="button" data-pgusage="${id}">${pgAm(id, 'md')}<b>${esc(a.n)}${pgTag(id === 'ari' ? 'Suno credits' : a.kind)}</b><small><span class="pghead"><span class="pgmeter" style="width:90px"><i style="width:${a.pct}%"></i></span>${esc(a.head)}</span></small><span class="pgend"><em>${id === 'claude' && c.claudeTeam ? 'Team tasks' : team ? 'Team' : 'Just you'}</em><span class="pgchev">${ic('chevron-right')}</span></span></button>`; }).join('')}</div>
        <div class="pgrule" style="margin:10px 0 0">${ic('lock')}<span>Personal plans are for one person, so they’re never shared. Your agent can still <b>work on team tasks</b>, on your plan, if you choose.</span></div>
        ${kiln ? `<h3>The team’s capacity</h3><p class="pgsm">People choose to show how much they have left. They share the number, never the account.</p><div class="pglist pgcap2">
          ${[['me', 'You · Claude Max', '62% of the week left', 62, c.claudeTeam ? `Team tasks up to ${c.claudeCap}%` : 'Just you'], ['PR', 'Priya · Claude Max', '40% of her week left', 40, 'Team tasks up to 20%'], ['SK', 'Sam · Codex Plus', 'Not showing', 0, 'Just Sam']].map(([k2, n, h, pct, s]) => `<div class="pgcapr">${av(k2, 26)}<b>${esc(n)}</b><em>${esc(s)}</em><span class="pgmeter"><i style="width:${pct}%"></i></span><small>${esc(h)}</small></div>`).join('')}</div>
        <h3>This month on Kiln</h3><div class="pglist">${[['sparkles', 'Ari credits', '$1.80', 'Shared by everyone'], ['key-round', 'Team key', `$6.40 of $${c.teamCap}`, 'Priya’s, capped'], ['server', 'Hosting', '$6.00', 'The Production VPS'], ['message-square', 'Texts', '$0.84', '84 reminders and offers']].map(([g, n, v, s]) => `<div class="pgrow"><i>${ic(g)}</i><b>${n}</b><small>${s}</small><span class="pgend"><em style="font-size:13px;color:var(--ink);font-weight:600">${v}</em></span></div>`).join('')}
          <div class="pgrow"><i>${pic('coins')}</i><b>Total so far</b><small>Personal plans aren’t counted here. They’re paid for by their owners.</small><span class="pgend"><em style="font-size:13px;color:var(--ink);font-weight:700">$15.04</em></span></div></div>
        <h3>Recent runs</h3><p class="pgsm">Every run says whose model it used.</p><div class="pglist">${[['priya', 'Fix reminder texts', 'Priya’s Claude, on her computer', 'Running'], ['ari', 'Add a waitlist', 'Ari, Suno credits', '$0.31'], ['ari', 'Studio photos on the home page', 'Ari, Suno credits', '$0.09'], ['claude', 'Sign in with Suno Connect', 'Your Claude, on this computer', '4% of your week']].map(([ag, t, s, v]) => `<div class="pgrow">${pgAm(ag, 'md')}<b>${t}</b><small>${s}</small><span class="pgend"><em>${v}</em></span></div>`).join('')}</div>` : ''}</div>`; }
    if (k === 'qr') html = head('Open on your phone', 'Stage, on the phone in your hand') + `<div class="pgshb"><div class="pgqr">${pgQR()}<small>Point your phone’s camera at this. Stage opens in the browser, over your home network. Nothing to install.</small></div></div>`;
    sh.innerHTML = html; sh.classList.toggle('pgsmall', k === 'qr'); sh.classList.add('show'); segs(); }
  const pgic = n => pic(n);
  function pgQR() { let s = 7, cells = ''; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280, N = 25, finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#111"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#111"/>`;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const inF = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9); if (!inF && rnd() > .52) cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`; }
    return `<svg viewBox="-1 -1 ${N + 2} ${N + 2}" shape-rendering="crispEdges">${cells}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}</svg>`; }

  /* ── Pages that take the room: the Project book, the code, the review ── */
  const PGHIST = [['agent', 'Today, 9:24 AM', 'Priya’s agent started on Fix reminder texts', 'On Priya’s Claude, on her computer'], ['decision', 'Today, 9:40 AM', 'Ari asked how waitlisted people should hear about a spot', 'Waiting for Nick'],
    ['review', 'Wednesday, 2:05 PM', 'Sam approved Studio photos on the home page', ''], ['agent', 'Wednesday, 11:41 AM', 'Ari made the studio photos smaller', 'A heads-up you kept'], ['release', 'Tuesday, 5:40 PM', 'Released Sign in with Suno Connect', 'Restore point 14', 14],
    ['decision', 'Tuesday, 4:12 PM', 'You agreed the waitlist plan', 'Medium, about $0.60'], ['release', 'Monday, 6:02 PM', 'Released Booking reminders', 'Restore point 13', 13], ['undo', 'Oct 3', 'You undid a change to the class order', 'Ari had sorted classes by price'],
    ['decision', 'Sep 30', 'You chose to match old bookings by phone number', 'For sign-in'], ['release', 'Sep 29', 'Released the first version of Kiln', 'Restore point 1', 1], ['agent', 'Sep 26', 'Ari created Kiln', '~/Documents/Playground Projects/Kiln']];
  const pgHistAll = () => [...PG.hist, ...PGHIST];
  function pgPage() { const el = $('#pg-page'); if (!el) return; const pg = PGX.page; if (!pg) { el.innerHTML = ''; return; }
    const g = pgGoal(), back = `<button class="bt pgback" type="button" data-pgback>${ic('chevron-left')}${esc(g?.t || 'Back')}</button>`;
    if (pg === 'book') { el.innerHTML = `<div class="pgpg"><div class="pgpgh">${back}<span class="sp"></span><button class="bt sm fill" type="button" data-pgfiler="${esc(pgProj()?.path || '')}">${ic('folder')}Show in Filer</button></div><div class="pgpgb" id="pg-bookb">${pgBook()}</div></div>`; return; }
    if (pg === 'code') { el.innerHTML = `<div class="pgpg"><div class="pgpgh">${back}<span class="sp"></span><small>${esc(pgProj()?.path || '')}</small></div>${pgCode()}</div>`; const tb = $('#pg-termb'); if (tb) tb.scrollTop = tb.scrollHeight; return; }
    if (pg === 'review') { el.innerHTML = `<div class="pgpg"><div class="pgpgh">${back}<span class="sp"></span></div><div class="pgpgb">${pgReview(PGX.revGid)}</div>${pgRelBar(PGX.revGid)}</div>`; segs(); } }
  function pgBook() { const p = pgProj(), kiln = PG.proj === 'kiln', np = !kiln && PG.projects.find(x => x.id === PG.proj), secs = [['brief', 'Brief', 'file-text'], ['goals', 'Goals and plan', 'list-checks'], ['decisions', 'Decisions', 'hand'], ['knowledge', 'Knowledge', 'book-open'], ['built', 'How it’s built', 'layers'], ['places', 'Places', 'server'], ['people', 'People', 'users'], ['usage', 'Usage and money', 'gauge'], ['history', 'History', 'history'], ['code', 'Code', 'code']];
    const brief = kiln ? { what: 'A phone-first web app where people book a wheel class at Maya’s studio, join a waitlist when it’s full, and get a reminder the day before.', who: 'Maya’s students, mostly booking on their phones, and Maya herself, checking her day between classes.', where: 'Phones first. It works on computers too.', good: 'Booking takes under a minute, nobody is double-booked, and nobody misses a class because a reminder didn’t arrive.', not: 'Payments and gift cards, for now.' } : np.brief;
    const gs = pgGoals().filter(g => !g.chat), byK = k => gs.filter(g => k.includes(pgState(g).k));
    const tile = g => { const st = pgState(g); return `<button class="pgtile" type="button" data-pggoal="${g.id}">${pgGlyph(g, st)}<b>${esc(g.t)}</b><small>${g.by && g.by !== 'me' ? av(g.by, 14) : ''}${esc(st.s)}</small></button>`; };
    const decs = kiln ? [[PG.wl.choice ? `Waitlist offers go by ${PG.wl.choice === 'both' ? 'text, then email if the text fails' : PG.wl.choice}` : 'Still open: how waitlisted people hear about a spot', PG.wl.choice ? 'You · today' : 'Asked by Ari · today', PG.wl.choice ? 'Most people see a text within minutes, and the email catches the rest.' : 'Waiting for you in Add a waitlist.', !PG.wl.choice],
      ['Old bookings follow people when they sign in', 'You · Sep 30', 'Matched by phone number, so 212 bookings didn’t look like they vanished.'], ['Sign in with Suno Connect, not passwords', 'You · Sep 30', 'Nobody has to remember another password, and Kiln never keeps one.'], ['Stage gets its own copy of the bookings', 'Ari suggested, Priya agreed · Sep 27', 'So testing never texts a real person.'], ['Classes cap at eight', 'Maya, via you · Sep 26', 'One wheel each.']] : [['Start on this computer', 'You · just now', 'Move to a server when you want it on your phone away from home.']];
    const hist = pgHistAll().filter(h => PGX.hist === 'all' || h[0] === PGX.hist);
    return `<div class="pgbook"><nav class="pgtoc" aria-label="Sections"><b>${esc(p.n)}</b>${secs.map(([k, n, g]) => `<button type="button" data-pgtoc="${k}" class="${PGX.bookAt === k ? 'on' : ''}">${ic(g)}${n}</button>`).join('')}</nav>
      <article class="pgdoc"><div class="pgdoch">${pgPmark(p.mark, 'lg')}<div><h1>${esc(p.n)}</h1><p>${esc(p.what)}</p></div></div><div class="pgdocpath">${ic('folder')}<span class="pgpath">${esc(p.path)}</span>${pgTag(kiln ? 'In sync with the Dev server' : 'On this computer', 'good', 'check')}</div>
      <section class="pgsec" id="pgb-brief"><h2>Brief</h2><p>One page: what it is and what good looks like. Ari updates it when a decision changes it.</p><div class="pgbox"><dl class="pgkv"><div><dt>What it is</dt><dd>${esc(brief.what)}</dd></div><div><dt>Who it’s for</dt><dd>${esc(brief.who)}</dd></div><div><dt>Where</dt><dd>${esc(brief.where)}</dd></div><div><dt>Good looks like</dt><dd>${esc(brief.good)}</dd></div>${brief.not ? `<div><dt>Not now</dt><dd>${esc(brief.not)}</dd></div>` : ''}</dl></div></section>
      <section class="pgsec" id="pgb-goals"><h2>Goals and plan</h2><p>This is the task list. It moves on its own as goals move.</p><div class="pgnnl">
        <div class="pgcol"><h3>Now<em>${byK(['work', 'needs']).length}</em></h3>${byK(['work', 'needs']).map(tile).join('') || '<p>Nothing running</p>'}</div>
        <div class="pgcol"><h3>Next<em>${byK(['review', 'draft']).length}</em></h3>${byK(['review', 'draft']).map(tile).join('') || '<p>Nothing waiting</p>'}</div>
        <div class="pgcol"><h3>Later<em>${byK(['paused']).length + (kiln ? 1 : 0)}</em></h3>${byK(['paused']).map(tile).join('')}${kiln ? `<div class="pgtile"><i class="pgg draft"></i><b>Show Maya’s glaze colours</b><small>An idea from Maya</small></div>` : ''}</div></div>
        <div class="pgbox" style="margin-top:10px"><div class="pgrows">${byK(['live']).map(g => `<button class="pgrow" type="button" data-pggoal="${g.id}" style="width:100%;text-align:left"><i>${ic('check')}</i><b>${esc(g.t)}</b><small>${esc(pgState(g).s)}</small></button>`).join('')}${kiln ? `<div class="pgrow"><i>${ic('check')}</i><b>Booking reminders</b><small>Live since Monday</small></div><div class="pgrow"><i>${ic('check')}</i><b>A first version of Kiln</b><small>Live since Sep 29</small></div>` : ''}</div></div></section>
      <section class="pgsec" id="pgb-decisions"><h2>Decisions</h2><p>What was decided, by whom, and why.</p><div class="pgbox"><div class="pgrows">${decs.map(([t, w, why, open]) => `<div class="pgrow"><i>${ic(open ? 'hand' : 'check')}</i><b>${esc(t)}${open ? pgTag('Needs you', 'amber') : ''}</b><small>${esc(w)} · ${esc(why)}</small></div>`).join('')}</div></div></section>
      <section class="pgsec" id="pgb-knowledge"><h2>Knowledge<button class="bt sm fill" type="button" data-pgknadd>${ic('plus')}Add a note</button></h2><p>Notes, research and house rules that Ari and the team have added. Every agent reads these.</p><div class="pgbox"><div class="pgrows">${(kiln ? PGKN : [['Plants and how often they need water', 'Ari started this list from the brief.', 'Ari', 'Just now']]).map(([t, d, by, when]) => `<div class="pgrow"><i>${pgic('bulb')}</i><b>${esc(t)}</b><small>${esc(d)}<br>${esc(by)} · ${esc(when)}</small></div>`).join('')}</div></div></section>
      <section class="pgsec" id="pgb-built"><h2>How it’s built</h2><p>The recipe, and the parts of the app each journey goes through.</p>
        <div class="pgbox"><div class="pgrec">${(kiln ? [['layout-grid', 'Pages', 'SvelteKit', 'A web app that works great on phones.'], ['database', 'Data', 'A small database on the server (SQLite)', 'Bookings, waitlists and classes in one file. Stage has its own copy.'], ['log-in', 'Sign-in', 'Suno Connect', 'One tap, no passwords.'], ['message-square', 'Texts and email', 'A texting service and an email service', 'Reminders and waitlist offers.'], ['server', 'Runs on', 'The Dev server for Stage, a small VPS for Production', 'See Places.']] : np.recipe.rows).map(([g, a, b, why]) => `<div class="pgrecr"><i>${ic(g)}</i><div><b>${esc(a)} <em>· ${esc(b)}</em></b><span>${esc(why)}</span></div></div>`).join('')}</div></div>
        ${kiln ? `<div class="pgjour" style="margin-top:10px">${[['Someone books a class', '', [['Page', 'This week’s classes', 'routes/+page'], ['Data', 'Bookings', 'bookings'], ['Text', 'Reminder the day before', 'notify.ts']]],
          ['Someone joins a waitlist', PG.rel.waitlist ? ' · live since today' : ' · on Stage, not live yet', [['Page', 'Join waitlist', 'Waitlist.svelte'], ['Data', 'Waitlist', 'waitlist'], ['Text and email', 'The offer', 'offers.ts']], true],
          ['Maya checks her day', '', [['Page', 'Maya’s view', 'routes/maya'], ['Data', 'Bookings and waitlists', 'bookings, waitlist']]]].map(([t, s, nodes, nw]) => `<div class="pgjr"><b>${esc(t)}<em>${esc(s)}</em></b><div class="pgjn">${nodes.map(([k2, n, f], i) => `${i ? `<i>${ic('arrow-right')}</i>` : ''}<span class="${nw ? 'new' : ''}"><small>${k2}</small><b>${esc(n)}</b><em>${esc(f)}</em></span>`).join('')}</div></div>`).join('')}</div>` : ''}</section>
      <section class="pgsec" id="pgb-places"><h2>Places<button class="bt sm fill" type="button" data-pgsheet="places">${ic('server')}Manage places</button></h2><p>Where it lives and runs, and who can get in.</p><div class="pgbox"><div class="pgrows">${(kiln ? PGPLACES.slice(0, 3) : PGPLACES.slice(0, 1)).map(pl => `<div class="pgrow"><i>${ic(pl.icon)}</i><b>${esc(pl.n)}${pgTag(pl.role)}</b><small>${esc(pl.sub)}</small></div>`).join('')}</div></div></section>
      <section class="pgsec" id="pgb-people"><h2>People<button class="bt sm fill" type="button" data-pgsheet="people">${ic('users')}Manage people</button></h2><p>Members and their roles.</p><div class="pgbox"><div class="pgrows">${(kiln ? PGPEOPLE : PGPEOPLE.slice(0, 1)).map(m => `<div class="pgrow">${av(m.k, 34)}<b>${esc(m.n)}${pgTag(m.role)}</b><small>${esc(PGROLES[m.role])}</small></div>`).join('')}</div></div></section>
      <section class="pgsec" id="pgb-usage"><h2>Usage and money<button class="bt sm fill" type="button" data-pgsheet="usage">${ic('gauge')}Open Usage</button></h2><p>Model use, hosting and services this month.</p>${kiln ? `<div class="pgstats2"><div><small>Ari credits</small><b>$1.80</b><em>Shared</em></div><div><small>Team key</small><b>$6.40</b><em>of $${PG.conn.teamCap} cap</em></div><div><small>Hosting</small><b>$6.00</b><em>Production VPS</em></div><div><small>Texts</small><b>$0.84</b><em>84 sent</em></div></div>` : `<div class="pgstats2"><div><small>Ari credits</small><b>$0.06</b><em>Setting up</em></div><div><small>Hosting</small><b>$0</b><em>This computer</em></div></div>`}</section>
      <section class="pgsec" id="pgb-history"><h2>History</h2><p>Everything that happened, with restore points. Going back covers the code and the data.</p>
        <div class="pgfilt">${[['all', 'Everything'], ['release', 'Releases'], ['decision', 'Decisions'], ['agent', 'Agent work'], ['review', 'Reviews'], ['undo', 'Undone']].map(([k2, n]) => `<button type="button" class="${PGX.hist === k2 ? 'on' : ''}" data-pghf="${k2}">${n}</button>`).join('')}</div>
        <div class="pgbox"><div class="pgrows">${(kiln ? hist : [['agent', 'Just now', `Ari created ${p.n}`, p.path]]).map(([k2, when, t, s, rp]) => `<div class="pgrow"><i>${ic({ agent: 'sparkles', decision: 'hand', release: 'radio', review: 'eye', undo: 'undo-2' }[k2] || 'history')}</i><b>${esc(t)}</b><small>${esc(when)}${s ? ' · ' + esc(s) : ''}</small><span class="pgend">${rp && rp < pgRp() ? `<button class="bt sm fill" type="button" data-pgrestore="${rp}">${pic('restore')}Go back to this</button>` : rp ? '<em>Live now</em>' : ''}</span></div>`).join('') || `<div class="pgrow"><i>${ic('history')}</i><b>Nothing here yet</b></div>`}</div></div></section>
