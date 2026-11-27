  /* Quick Options state */
  const QD = { exp: 'desktop', out: 'buds', vol: 48, bri: 72, outOpen: false, netOpen: false, more: false, night: false, air: false, loc: true, cast: false, hot: false, net: 'north', netBusy: '', scanning: false, scanned: false, found: [], P: {}, fresh: '' };
  const QDEV = [{ id: 'buds', n: 'Fable Buds', k: 'headphones', st: 'on', bat: 82 }, { id: 'keys', n: 'Studio Keys', k: 'keyboard', st: 'on', bat: 64 }, { id: 'mouse', n: 'Arc Mouse', k: 'mouse', st: 'off' }];
  const QNEAR = [{ id: 'nova', n: 'Nova Keyboard', k: 'keyboard', code: '482915' }, { id: 'pebble', n: 'Pebble Mouse', k: 'mouse' }, { id: 'room', n: 'Room Speaker', k: 'speaker' }];
  const QNETS = [{ id: 'north', n: 'Studio North', note: 'Strong' }, { id: 'phone', n: 'Nick\u2019s Phone', note: 'Hotspot' }, { id: 'guest', n: 'Studio Guest', note: 'Secured' }];
  const QI = { headphones: 'headphones', keyboard: 'keyboard', mouse: 'mouse', speaker: 'speaker', monitor: 'monitor', laptop: 'laptop' };
  const qOuts = () => [...QDEV.filter(d => (d.k === 'headphones' || d.k === 'speaker') && d.st === 'on').map(d => ({ id: d.id, n: d.n, k: d.k, sub: 'Bluetooth' })), { id: 'int', n: 'Speakers', k: 'laptop', sub: 'Built in' }, { id: 'hdmi', n: 'Studio Display', k: 'monitor', sub: 'HDMI' }];
  const qsl = (k, ic, label) => `<div class="sl" data-qsl="${k}"><i class="fillb" style="width:${QD[k]}%"></i>${G(ic)}<span>${label}</span><em>${QD[k]}%</em></div>`;
  const qAll = () => { refreshPop(); renderStatus(); };
  const q2sl = (k, ic) => { const v = k === 'vol' ? QD.vol : QD.bri; return `<div class="q2s">${G(ic)}<span class="q2tr" data-q2sl="${k}"><i class="fillb" style="width:${v}%"></i><i class="q2th" style="left:${v}%"></i></span><em data-q2v="${k}">${v}%</em></div>`; };
  const q2sw = on => `<i class="q2sw${on ? ' on' : ''}"></i>`;
  const q2row = (attr, ic, t, sub, right = '', cls = '') => `<button type="button" class="q2r${cls ? ' ' + cls : ''}" ${attr}><span class="q2i">${ic}</span><span class="q2t"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${right}</button>`;
  /* Experience: which shell this computer wears. Desktop is this one; Tablet and Mobile are the touch shell (phone.js), whose
     size class the screen decides; Automatic follows the hardware (a keyboard attached means Desktop). */
  const QEXP = { auto: ['Automatic', 'monitor-smartphone'], desktop: ['Desktop', 'monitor'], tablet: ['Tablet', 'tablet'], mobile: ['Mobile', 'smartphone'] };
  function qExp(k) { QD.exp = k; QD.page = ''; qAll(); if (k === 'desktop' || k === 'auto') return;
    setTimeout(() => { const u = new URL(location.href); u.searchParams.delete('desktop'); u.searchParams.set('phone', '1'); u.searchParams.set('exp', k); const w = [...document.querySelectorAll('.win:not([hidden]):not(.min)')].sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0))[0]; if (w?.dataset.app) u.searchParams.set('app', w.dataset.app); location.replace(u); }, 260); }
  function qPage(p) { const head = (t, k, on) => `<div class="q2h"><button class="q" type="button" data-q2page="" aria-label="Back">${G('chevron-left')}</button><b>${t}</b>${k ? `<button type="button" class="q2hs" data-q2tog="${k}" aria-label="Turn ${t} on or off">${q2sw(on)}</button>` : ''}</div>`;
    const more = (pg, t) => `<button class="q2more" type="button" data-q2set="${pg}">${t}</button>`;
    if (p === 'wifi') { const on = L.get('wifi');
      return `<div class="q2 pg">${head('Wi‑Fi', 'wifi', on)}${on ? `<div class="q2l">${QNETS.map(x => { const cur = x.id === QD.net && !S.offline, busy = QD.netBusy === x.id; return q2row(`data-qnet="${x.id}"`, busy ? '<i class="spin"></i>' : G('wifi'), esc(x.n), busy ? 'Connecting…' : cur ? 'Connected' : x.note, cur ? G('check') : '', cur ? 'on' : ''); }).join('')}</div>` : '<p class="q2off">Wi‑Fi is off</p>'}
        <div class="q2l">${q2row('data-q2tog="air"', G('plane'), 'Airplane mode', '', q2sw(L.get('airplane')))}${q2row('data-q2tog="hot"', G('hotspot'), 'Hotspot', L.get('hotspot') ? 'Sharing this connection' : 'Share this connection', q2sw(L.get('hotspot')))}</div>${more('wifi', 'Wi‑Fi settings')}</div>`; }
    if (p === 'bt') { const on = L.get('bt');
      if (!on) return `<div class="q2 pg">${head('Bluetooth', 'bt', false)}<p class="q2off">Bluetooth is off</p>${more('bluetooth', 'Bluetooth settings')}</div>`;
      const mine = QDEV.map(d => q2row(`data-qconn="${d.id}"`, d.st === 'busy' ? '<i class="spin"></i>' : G(QI[d.k]), esc(d.n), d.st === 'busy' ? 'Connecting…' : d.st === 'on' ? `${QD.out === d.id ? 'Playing sound' : 'Connected'}${d.bat ? ' · ' + d.bat + '%' : ''}` : 'Not connected', '', d.st === 'on' ? 'on' : '')).join('');
      const near = QD.found.map(id => { const d = QNEAR.find(x => x.id === id), pp = QD.P[id]; return typeof pp === 'number' ? `<div class="q2code code"><p>Type this on <b>${esc(d.n)}</b>, then press Enter.</p><span class="dg">${[...d.code].map((c, i) => `<i class="${i < pp ? 't' : ''}">${c}</i>`).join('')}</span></div>`
        : q2row(`data-qpair="${id}"`, pp === 'pairing' ? '<i class="spin"></i>' : G(QI[d.k]), esc(d.n), pp === 'pairing' ? 'Pairing…' : 'Tap to pair', '', 'new'); }).join('');
      return `<div class="q2 pg">${head('Bluetooth', 'bt', true)}<div class="q2l">${mine}</div><div class="q2lab">Nearby${QD.scanning ? '<span class="scan"><i></i>Looking</span>' : `<button class="lnk" type="button" data-qscan>Look again</button>`}</div>${near ? `<div class="q2l">${near}</div>` : QD.scanning ? '' : '<p class="q2off">Nothing new nearby. Put a device in pairing mode.</p>'}${more('bluetooth', 'Bluetooth settings')}</div>`; }
    if (p === 'out') return `<div class="q2 pg">${head('Sound output')}<div class="q2l">${qOuts().map(x => q2row(`data-qout="${x.id}"`, G(QI[x.k]), esc(x.n), x.sub, x.id === QD.out ? G('check') : '', x.id === QD.out ? 'on' : '')).join('')}</div>${more('sound', 'Sound settings')}</div>`;
    if (p === 'exp') return `<div class="q2 pg">${head('Experience')}<div class="q2l q2xl">${Object.entries(QEXP).map(([k, [t]]) => `<button type="button" class="q2r${QD.exp === k ? ' on' : ''}" data-q2exp="${k}"><span class="q2t"><b>${t}</b></span>${QD.exp === k ? '<i class="q2rad"></i>' : ''}</button>`).join('')}</div></div>`;
    if (p === 'power') return `<div class="q2 pg">${head('Power')}<div class="q2l">${[['moon', 'Sleep'], ['rotate-cw', 'Restart…'], ['power', 'Power off…'], ['log-out', 'Sign out…']].map(([i, t]) => q2row('data-q2pw', G(i), t)).join('')}</div>${more('power', 'Power settings')}</div>`;
    return ''; }
  function qScan() { if (QD.scanning) return; QD.scanning = true; QD.scanned = true; QD.found = []; qAll();
    QNEAR.forEach((d, i) => setTimeout(() => { if (!QDEV.some(x => x.id === d.id)) { QD.found.push(d.id); QD.fresh = d.id; qAll(); QD.fresh = ''; } }, 600 + i * 800));
    setTimeout(() => { QD.scanning = false; qAll(); }, 600 + QNEAR.length * 800 + 1400); }
  function qPair(id) { const d = QNEAR.find(x => x.id === id); QD.P[id] = 'pairing'; qAll();
    const fin = () => { delete QD.P[id]; QD.found = QD.found.filter(x => x !== id); QDEV.push({ id, n: d.n, k: d.k, st: 'on', fresh: true, bat: d.k === 'mouse' ? 100 : undefined }); if (d.k === 'speaker') QD.out = id; qAll(); setTimeout(() => { QDEV.forEach(x => x.fresh = false); }, 600); };
    if (d.code) setTimeout(() => { QD.P[id] = 0; qAll(); const tick = () => { QD.P[id]++; qAll(); if (QD.P[id] < d.code.length) setTimeout(tick, 320); else setTimeout(fin, 500); }; setTimeout(tick, 1100); }, 800);
    else setTimeout(fin, 1400); }
  const PW = { cal: 304, qs: 372, music: 320, call: 300, grid: 440, wx: 320, tapp: 272, run: 320, nfl: 320, apps: 230, sheet: 600, fold: 440 };
  let grownI = null, grownKind = '';
  /* Live extensions (music, a call) grow into their big player in place. Everything else opens above the island that asked,
     so the clock and Quick Options stay in view. */
  function growable(el) { const i = el.closest('.island'); return i && i.classList.contains('mat') && i.classList.contains('live') ? i : null; }
  function grow(i, kind) {
    if (grownI && grownI !== i) shrink(true);
    const ex = i.querySelector(':scope > .exp'), ew = kind === 'grid' ? Math.max(PW.grid, grownI === i ? i._w0 : i.offsetWidth) : PW[kind];
    if (grownI !== i) { i._w0 = i.offsetWidth; i._h0 = i.offsetHeight; i.style.width = i._w0 + 'px'; i.style.height = i._h0 + 'px';
      if (i.parentElement.id === 'free') { const p = S.free[i.dataset.id]; if (p.y + i._h0 / 2 > H / 2) { i.style.top = 'auto'; i.style.bottom = (H - p.y - i._h0) + 'px'; } if (p.x + ew > W - INS) { i.style.left = 'auto'; i.style.right = (W - p.x - i._w0) + 'px'; } } }
    ex.style.setProperty('--ew', ew + 'px'); ex.className = 'exp k-' + kind; ex.innerHTML = POP[kind]();
    const eh = Math.min(ex.scrollHeight, H - 2 * INS - 20); void i.offsetWidth;
    i.classList.add('sizing', 'grown'); i.style.width = ew + 'px'; i.style.height = eh + 'px'; grownI = i; grownKind = kind; hideTip(); closePop(); if (kind === 'qs') QD.page = ''; }
  function shrink(now) { const i = grownI; if (!i) return; QD.page = ''; grownI = null; grownKind = ''; i.classList.remove('grown'); i.style.width = i._w0 + 'px'; i.style.height = i._h0 + 'px'; clearTimeout(i._t);
    const done = () => { i.classList.remove('sizing'); i.style.width = i.style.height = i.style.bottom = i.style.right = ''; if (i.parentElement?.id === 'free') { const p = S.free[i.dataset.id]; i.style.left = p.x + 'px'; i.style.top = p.y + 'px'; } };
    if (now) done(); else i._t = setTimeout(done, 520); }
  function openPop(kind, anchor) { const gi = growable(anchor); if (gi) { if (grownI === gi && grownKind === kind) return shrink(); return grow(gi, kind); }
    if (popKind === kind) return closePop(); if (popAnchor) popAnchor.classList.remove('act'); if (kind === 'qs') QD.page = ''; pop.style.width = PW[kind] + 'px'; popKind = kind; popAnchor = anchor; anchor.classList.add('act'); pop.className = 'pop k-' + kind; pop.innerHTML = POP[kind](); placePop(); requestAnimationFrame(() => pop.classList.add('on')); hideTip(); }
  function placePop() { if (!popKind) return; const a = rel(popAnchor), is = rel(popAnchor.closest('.island') || popAnchor), e = edgeOf(popAnchor), pw = pop.offsetWidth, ph = pop.offsetHeight, m = 10; let x, y, fx = 0, fy = 0;
    const isl0 = popAnchor.closest('.island'), side = isl0?.classList.contains('status') ? 'end' : isl0?.classList.contains('dock') ? 'start' : 'mid';
    if (e === 'bottom' || e === 'top') { x = side === 'end' ? is.x + is.w - pw : side === 'start' ? is.x : a.x + a.w / 2 - pw / 2; y = e === 'bottom' ? is.y - ph - m : is.y + is.h + m; fy = e === 'bottom' ? 8 : -8; }
    else { y = a.y + a.h / 2 - ph / 2; x = e === 'left' ? is.x + is.w + m : is.x - pw - m; fx = e === 'left' ? -8 : 8; }
    x = Math.max(INS, Math.min(W - INS - pw, x)); y = Math.max(INS, Math.min(H - INS - ph, y));
    Object.assign(pop.style, { left: x + 'px', top: y + 'px' }); pop.style.setProperty('--fx', fx + 'px'); pop.style.setProperty('--fy', fy + 'px'); }
  function closePop() { popAnchor?.classList.remove('act'); popKind = ''; popAnchor = null; QD.page = ''; pop.classList.remove('on'); }
  function refreshPop() { if (grownI) { const ex = grownI.querySelector(':scope > .exp'); ex.innerHTML = POP[grownKind](); grownI.style.height = Math.min(ex.scrollHeight, H - 2 * INS - 20) + 'px'; return; } if (!popKind) return; pop.innerHTML = POP[popKind](); placePop(); }

  const EVS = [{ d: 23, t: 'Launch walkthrough', s: 'Studio', at: '7:30 PM', c: 'oklch(0.72 0.13 250)' }, { d: 23, t: 'Dinner with Nora', s: 'Duende', at: '8:45 PM', c: 'oklch(0.72 0.13 30)' }, { d: 25, t: 'ISO sign-off', s: 'Build room', at: '10:00 AM', c: 'oklch(0.72 0.13 150)' }, { d: 30, t: 'Launch prep', s: '', at: 'All day', c: 'oklch(0.72 0.13 300)' }];
  const POP = {
    nfl() { const H = HUD(), [fk, fl] = H.freshLine(); return `<div class="ph"><h3>Huddle</h3><button class="q" type="button" data-act="nflopen" data-tip="Open Huddle">${G('arrow-up-right')}</button></div><div class="nfbig">${hudRows(true)}</div><p class="nffresh f-${fk}"><i></i>${esc(fl)}</p>`; },
    tapp: () => tPop(), run: () => runPop(), fold: () => foldPop(), apps: () => appsPop(), sheet: () => sheetPop(),
    cal() { const now = new Date(), y = now.getFullYear(), mo = now.getMonth(), first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate(), prev = new Date(y, mo, 0).getDate(), td = now.getDate(); let cells = '';
      for (let i = 0; i < 42; i++) { const d = i - first + 1, inM = d >= 1 && d <= days, n = inM ? d : d < 1 ? prev + d : d - days; if (i >= 35 && d > days && (first + days) <= 35) break;
        cells += `<button type="button" class="${inM ? '' : 'mute'}${inM && d === td ? ' today' : ''}${inM && EVS.some(e => e.d === d) ? ' ev' : ''}">${n}</button>`; }
      const up = EVS.filter(e => e.d >= td).slice(0, 3);
      return `<div class="ph"><h3>${now.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3><button class="q" type="button" data-act="qs" data-tip="Quick Options">${G('sliders-horizontal')}</button></div>
        <div class="cg">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span>${x}</span>`).join('')}${cells}</div>
        <div class="evs">${up.map(e => `<div class="ev1" style="--c:${e.c}"><i></i><span><b>${esc(e.t)}</b><small>${e.d === td ? 'Today' : new Date(y, mo, e.d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}${e.s ? ' · ' + esc(e.s) : ''}</small></span><em>${e.at}</em></div>`).join('')}</div>`; },
    qs() { if (QD.page) return qPage(QD.page);
      const outs = qOuts(), o = outs.find(x => x.id === QD.out) || outs[0], net = QNETS.find(x => x.id === QD.net), conn = QDEV.filter(d => d.st === 'on'), wOn = L.get('wifi'), bOn = L.get('bt');
      const btSub = !bOn ? 'Off' : conn.length === 1 ? conn[0].n : conn.length ? `${conn.length} devices` : 'No devices';
      const pill = (k, ic, t, sub, on) => `<div class="q2p${on ? ' on' : ''}"><button type="button" class="q2pm" data-q2tog="${k}"><span class="q2i">${G(ic)}</span><span class="q2t"><b>${t}</b><small>${esc(sub)}</small></span></button><button type="button" class="q2pc" data-q2page="${k}" aria-label="${t} options">${G('chevron-right')}</button></div>`;
      const tg = (k, ic, t, on) => `<button type="button" class="q2g${on ? ' on' : ''}" data-q2tog="${k}"><span class="q2i">${G(ic)}</span>${t}</button>`;
      const d0 = new Date();
      return `<div class="q2">
        <div class="q2hd"><b>${d0.toLocaleDateString([], { weekday: 'long' })}</b><span>${d0.toLocaleDateString([], { month: 'long', day: 'numeric' })}</span><button class="q2b" type="button" data-q2set="power" data-tip="${S.low ? 'About 40 min left' : '5 h 40 min left'}">${G(S.low ? 'battery-low' : 'battery')}${S.low ? 14 : 74}%</button></div>
        <div class="q2sls">${q2sl('vol', QD.vol === 0 ? 'volume-x' : 'volume-2')}<button class="q2sb" type="button" data-q2page="out" data-tip="${esc(o.n)}">${G(QI[o.k])}</button>
          ${q2sl('bri', 'sun')}<button class="q2sb${L.get('autoBright') ? ' on' : ''}" type="button" data-q2tog="autoB" data-tip="Automatic brightness"><small>Auto</small></button></div>
        <div class="q2ps">${pill('wifi', wOn && !S.offline ? 'wifi' : 'wifi-off', 'Wi‑Fi', !wOn ? 'Off' : S.offline ? 'Not connected' : net.n, wOn)}${pill('bt', 'bluetooth', 'Bluetooth', btSub, bOn)}</div>
        <div class="q2ts">${tg('dnd', 'moon', 'Do Not Disturb', S.dnd)}${tg('night', 'sunset', 'Night Light', L.get('night'))}${tg('saver', 'leaf', 'Battery Saver', L.get('pmode') === 'save')}${tg('dark', 'sun-moon', 'Dark Style', S.theme === 'dark')}</div>
        <div class="q2ts">${tg('air', 'plane', 'Airplane', L.get('airplane'))}${tg('tiling', 'columns-2', 'Tiling', S.tiling)}${tg('cast', 'cast', 'Cast', QD.cast)}${tg('hot', 'radio-tower', 'Hotspot', L.get('hotspot'))}</div>
        ${C.on ? `<div class="q2mic"><span class="q2i">${G(C.muted ? 'mic-off' : 'mic')}</span><span class="q2t"><b>${C.muted ? 'Microphone muted' : 'Microphone in use'}</b><small>Call with ${PRIYA.n}</small></span><button type="button" data-act="mute">${C.muted ? 'Unmute' : 'Mute'}</button></div>` : ''}
        <div class="q2f"><button class="q2x" type="button" data-q2page="exp">${G(QEXP[QD.exp][1])}<span>${QEXP[QD.exp][0]}</span>${G('chevron-down')}</button><span class="sp"></span><button class="q" type="button" data-act="set" data-tip="Settings">${G('settings')}</button><button class="q" type="button" data-q2lock data-tip="Lock">${G('lock')}</button><button class="q" type="button" data-q2page="power" data-tip="Power">${G('power')}</button></div></div>`; },
    qsOld() { const t = (k, ic, n, sub, on) => `<button class="tile${on ? ' on' : ''}" type="button" data-tile="${k}"><span class="ti">${G(ic)}</span><span><b>${n}</b><small>${sub}</small></span></button>`;
      const d = new Date(); return `<div class="ph"><button type="button" class="qhd" data-act="cal"><b>${(d.getHours() % 12) || 12}:${String(d.getMinutes()).padStart(2, '0')}</b><span>${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span></button></div><div class="tiles">${t('wifi', 'wifi', 'Wi‑Fi', 'Home', true)}${t('bt', 'bluetooth', 'Bluetooth', 'Headphones', true)}${t('dnd', 'moon', 'Do Not Disturb', S.dnd ? 'On' : 'Off', S.dnd)}${t('dark', S.theme === 'dark' ? 'moon' : 'sun', 'Dark style', S.theme === 'dark' ? 'On' : 'Off', S.theme === 'dark')}${t('tiling', 'columns-2', 'Tiling', S.tiling ? 'On' : 'Off', S.tiling)}${t('night', 'sunset', 'Night light', 'At sunset', false)}</div>
        <div class="slide">${G('volume-2')}<span class="tr" data-slide="vol"><i style="width:62%"></i><u style="left:62%"></u></span></div>
        <div class="slide">${G('sun')}<span class="tr" data-slide="bri"><i style="width:80%"></i><u style="left:80%"></u></span></div>
        <div class="qfoot"><span class="bat">${G('battery')}<span><b>82%</b> · about 6 hours left</span></span><button class="q" type="button" data-act="set" data-tip="Settings">${G('settings-2')}</button><button class="q" type="button" data-tip="Lock">${G('lock')}</button><button class="q" type="button" data-tip="Power">${G('power')}</button></div>`; },
    wx() { const H2 = [['Now', 'cloud-rain', 59, 60], ['9 PM', 'cloud-drizzle', 58, 30], ['10 PM', 'cloud', 57, 0], ['11 PM', 'moon', 55, 0], ['12 AM', 'moon', 54, 0]];
      return `<div class="wxtop"><span><small>Oakland</small><b>${WXL.t}°</b><em>${WXL.where} · H 71° L 53°</em></span>${G(WXL.c)}</div><p class="wxsay2">Light rain until about 9 PM, then clearing.</p>
        <div class="wxhrs">${H2.map(([h, c, t, r]) => `<span><small>${h}</small>${G(c)}<i>${r ? r + '%' : ''}</i><b>${t}°</b></span>`).join('')}</div>
        <div class="wxdl">${[['Today', 'cloud-rain', 53, 71], ...WXL.days.map(([d, c, t]) => [d, c, t - 18, t])].map(([d, c, lo, hi]) => `<div><b>${d}</b>${G(c)}<span>${lo}°</span><i><u style="left:${(lo - 48) / 30 * 100}%;right:${100 - (hi - 48) / 30 * 100}%"></u></i><span>${hi}°</span></div>`).join('')}</div>
        <button class="from wxopen" type="button" data-launch="weather"><img src="${LICON('weather')}" alt="">Open Weather</button>`; },
    music() { const [tt, d] = TRACKS[M.i]; return `<div class="mtop"><span class="art" style="background-image:url(${PH}pet-sounds.webp)"></span><span><b>${esc(tt)}</b><small>The Beach Boys · Pet Sounds</small><button class="from" type="button" data-launch="tide" data-tip="Open Tide"><img src="${LICON('tide')}" alt="">Tide</button></span></div>
      <div class="scrub"><span class="tr" data-scrub><i id="mp-bar" style="width:${M.t / d * 100}%"></i></span><span class="tt"><span id="mp-t">${mmss(M.t)}</span><span>-${mmss(d - M.t)}</span></span></div>
      <div class="mctl"><button class="q" type="button" data-act="mprev" aria-label="Previous">${G('skip-back')}</button><button class="q big" type="button" data-act="mplay" aria-label="${M.playing ? 'Pause' : 'Play'}">${G(M.playing ? 'pause' : 'play')}</button><button class="q" type="button" data-act="mnext" aria-label="Next">${G('skip-forward')}</button></div>`; },
    call() { const s = (Date.now() - C.t0) / 1000; return `<span class="art face" style="${faceBg(PRIYA, 72)}"></span><b>${PRIYA.n}</b><small data-bind="ct">${mmss(s)}</small>
      <div class="crow"><button type="button" data-act="mute" class="${C.muted ? 'on' : ''}"><span>${G(C.muted ? 'mic-off' : 'mic')}</span>${C.muted ? 'Unmute' : 'Mute'}</button><button type="button" data-act="video" class="${C.video ? 'on' : ''}"><span>${G('video')}</span>Camera</button><button type="button" data-act="share" class="${C.share ? 'on' : ''}"><span>${G('screen-share')}</span>Share</button><button type="button" class="end" data-act="hang"><span>${G('phone-off')}</span>End</button></div>`; },
    grid() { return `<label class="srch">${G('search')}<input placeholder="Search apps and files"></label><div class="ga">${ALL().map(id => `<button type="button" data-launch="${id}"><span class="dapp"><span class="ic" style="background-image:url(${LICON(id)})"></span></span>${esc(LNAME(id))}</button>`).join('')}</div>`; }
  };

  /* ── Tooltip ───────────────────────────────────────────────────────────── */
  const tip = $('#tip'); let tipFor = null;
  function showTip(el) { if ((popKind && pop.contains(el)) || el.closest('.grown') || el === popAnchor) return; tipFor = el; tip.textContent = el.dataset.tip; tip.classList.add('on'); const a = rel(el), e = edgeOf(el), tw = tip.offsetWidth, th = 26, m = 12; let x, y;
    if (e === 'bottom') { x = a.x + a.w / 2 - tw / 2; y = a.y - th - m - 6; } else if (e === 'top') { x = a.x + a.w / 2 - tw / 2; y = a.y + a.h + m + 6; } else if (e === 'left') { x = a.x + a.w + m + 8; y = a.y + a.h / 2 - th / 2; } else { x = a.x - tw - m - 8; y = a.y + a.h / 2 - th / 2; }
    tip.style.left = Math.max(6, Math.min(W - tw - 6, x)) + 'px'; tip.style.top = Math.max(6, y) + 'px'; }
  function hideTip() { tipFor = null; tip.classList.remove('on'); }
  scr.addEventListener('pointerover', e => { const t = e.target.closest('.island [data-tip], .nl [data-tip], .pop [data-tip]'); if (t && t !== tipFor) showTip(t); else if (!t && tipFor) hideTip(); });
  scr.addEventListener('pointerleave', hideTip);

  /* ── Interaction ───────────────────────────────────────────────────────── */
  let dragged = false;
  scr.addEventListener('click', e => { const hit = s => e.target.closest(s); if (dragged) { dragged = false; return; }
    const act = hit('[data-act]')?.dataset.act; let el = hit('[data-act]');
    /* a panel opened from inside another panel hangs from the clock island, not from a button that is about to be redrawn */
    if (el && el.closest('#pop') && ['tapp', 'qs', 'cal'].includes(act)) { const z = isl.status.querySelector(act === 'cal' ? '[data-act="cal"]' : '.pza, .gz, .pzs') || isl.status; closePop(); el = z; }
    if (act === 'grid' || act === 'cal' || act === 'qs' || act === 'music' || act === 'call' || act === 'wx' || act === 'run' || act === 'apps' || act === 'sheet' || act === 'nfl') { if (act === 'apps') PW.apps = TRAY.length * 46 + 10; return openPop(act, el); }
    if (act === 'pad') { $('#pad')?.classList.contains('on') ? padClose() : padOpen(); return; }
    if (act === 'fold') { const f = el.dataset.f; if (popKind === 'fold' && FCUR === f) return closePop(); if (popKind === 'fold') closePop(); FCUR = f; FPATH = []; FUNF.clear(); FSO = false; PW.fold = { shelf: 660, sheet: 460, days: 380 }[FOPEN] || 440; openPop('fold', el); foldCaret(el); return; }
    if (hit('[data-fsort]')) { FSO = !FSO; refreshPop(); fsWire(); return; }
    { const so = hit('[data-fsortto]'); if (so) { FSORT = so.dataset.fsortto; FSO = false; refreshPop(); fsWire(); return; } }
    if (FSO && hit('#pop')) { FSO = false; refreshPop(); fsWire(); }
    { const fsb = hit('[data-fscroll]'); if (fsb) { const sh = pop.querySelector('.fshelf'); sh.scrollBy({ left: +fsb.dataset.fscroll * 3 * 126, behavior: 'smooth' }); return; } }
    { const fs = hit('[data-fsub]'); if (fs) { FPATH.push(fs.dataset.fsub); refreshPop(); fsWire(); return; } }
    if (hit('[data-fup]')) { FPATH.pop(); refreshPop(); fsWire(); return; }
    { const fv = hit('[data-fview]'); if (fv) { FVIEW = fv.dataset.fview; refreshPop(); return; } }
    { const fu = hit('[data-funf]'); if (fu) { const n = fu.dataset.funf; FUNF.has(n) ? FUNF.delete(n) : FUNF.add(n); refreshPop(); return; } }
    if (act === 'tapp') { const id = hit('[data-app]')?.dataset.app; if (popKind === 'tapp' && TCUR !== id) closePop(); TCUR = id; return openPop('tapp', el); }
    { const tm = hit('[data-tmenu]'); if (tm) { const [id, k] = tm.dataset.tmenu.split(':'); tAct(id, k); return; } }
    if (act === 'nflopen') { closePop(); shrink(true); L.open?.('huddle'); return; }
    if (act === 'evjoin') { EVL.on = false; layout(); L.open?.('phone'); return; }
    if (act === 'recpause') { if (RCL.paused) { RCL.t0 = Date.now(); RCL.paused = false; } else { RCL.acc += Date.now() - RCL.t0; RCL.paused = true; } renderRec(); return; }
    if (act === 'recstop') { RCL.on = false; layout(); return; }
    if (act && act.startsWith('tg:')) { const k = act.slice(3); TGL[k] = !TGL[k]; if (k === 'dnd') { S.dnd = TGL.dnd; renderStatus(); } renderTg(); return; }
    if (act === 'mplay') { M.playing = !M.playing; renderMusic(); refreshPop(); return; }
    if (act === 'mnext' || act === 'mprev') { M.i = (M.i + (act === 'mnext' ? 1 : TRACKS.length - 1)) % TRACKS.length; M.t = 0; renderMusic(); refreshPop(); return; }
    if (act === 'mute') { C.muted = !C.muted; renderCall(); renderStatus(); refreshPop(); return; }
    if (act === 'video' || act === 'share') { C[act] = !C[act]; refreshPop(); return; }
    if (act === 'hang') { C.on = false; closePop(); shrink(true); renderStatus(); layout(); return; }
    if (act === 'dnd') { S.dnd = !S.dnd; L.dnd(S.dnd); renderStatus(); openTray(); return; }
    const qk = hit('[data-q]'); if (qk) { QD[qk.dataset.q] = !QD[qk.dataset.q]; qAll(); return; }
    const qo = hit('[data-qout]'); if (qo) { QD.out = qo.dataset.qout; QD.outOpen = false; qAll(); return; }
    if (hit('[data-qscan]')) { qScan(); return; }
    const qp = hit('[data-qpair]'); if (qp) { if (QD.P[qp.dataset.qpair] == null) qPair(qp.dataset.qpair); return; }
    const qc = hit('[data-qconn]'); if (qc) { const d = QDEV.find(x => x.id === qc.dataset.qconn); if (d.st === 'on') { d.st = 'off'; if (QD.out === d.id) QD.out = 'int'; qAll(); } else { d.st = 'busy'; qAll(); setTimeout(() => { d.st = 'on'; qAll(); }, 1000); } return; }
    const qn = hit('[data-qnet]'); if (qn) { const id = qn.dataset.qnet; if (id === QD.net && !S.offline) return; QD.netBusy = id; qAll(); setTimeout(() => { QD.netBusy = ''; QD.net = id; S.offline = false; qAll(); renderInspector(); }, 1200); return; }
    const qt = hit('[data-qtog]'); if (qt) { const k = qt.dataset.qtog;
      if (k === 'dnd') { S.dnd = !S.dnd; L.dnd(S.dnd); if (NS === 'has') rest(); } else if (k === 'tiling') { S.tiling = !S.tiling; const keep = grownI; tile(lastRes); } else QD[k] = !QD[k];
      qAll(); renderInspector(); return; }
    { const gx = hit('[data-ngrp]'); if (gx) { TOPEN.add(gx.dataset.ngrp); openTray(); return; } }
    if (act === 'clear') { NQ = []; BADGE = 0; renderDock(); openTray(); setTimeout(rest, 700); return; }
    if (act === 'set') { shrink(true); closePop(); L.open('settings'); return; }
    const qx = hit('[data-q2exp]'); if (qx) { qExp(qx.dataset.q2exp); return; }
    const qg = hit('[data-q2page]'); if (qg) { QD.page = qg.dataset.q2page; if (QD.page === 'bt' && !QD.scanned && L.get('bt')) setTimeout(qScan, 300); if (QD.page === 'out') QD.outOpen = false; qAll(); return; }
    const q2 = hit('[data-q2tog]'); if (q2) { const k = q2.dataset.q2tog, flip = c => L.set(c, !L.get(c));
      if (k === 'wifi') flip('wifi'); else if (k === 'bt') flip('bt'); else if (k === 'night') flip('night'); else if (k === 'autoB') flip('autoBright'); else if (k === 'air') flip('airplane'); else if (k === 'hot') flip('hotspot'); else if (k === 'cast') QD.cast = !QD.cast; else if (k === 'tiling') { S.tiling = !S.tiling; tile(lastRes); }
      else if (k === 'saver') L.set('pmode', L.get('pmode') === 'save' ? 'bal' : 'save'); else if (k === 'dark') L.mode(S.theme === 'dark' ? 'light' : 'dark');
      else if (k === 'dnd') { S.dnd = !S.dnd; L.dnd(S.dnd); if (NS === 'has') rest(); }
      qAll(); return; }
    const qs2 = hit('[data-q2set]'); if (qs2) { shrink(true); L.settings(qs2.dataset.q2set); return; }
    if (hit('[data-q2lock]') || hit('[data-q2pw]')) { shrink(); return; }
    const app = hit('.island [data-app]'); if (app) { const id = app.dataset.app; if (id === 'messages') BADGE = 0; const was = RUN.has(id); L.dock(id); if (!was) { const d = $(`[data-app="${id}"]`, isl.dock); d?.classList.add('launch'); setTimeout(() => d?.classList.remove('launch'), 1700); } return; }
    const ln = hit('[data-launch]'); if (ln) { padClose(); shrink(true); closePop(); L.open(ln.dataset.launch); return; }
    const tl = hit('[data-tile]'); if (tl) { const k = tl.dataset.tile;
      if (k === 'dnd') { S.dnd = !S.dnd; renderStatus(); if (NS === 'has') rest(); }
      else if (k === 'dark') { S.theme = S.theme === 'dark' ? 'light' : 'dark'; Object.values(WINS).forEach(w => syncMode(w.firstChild)); scr.dataset.theme = S.theme; save(); }
      else if (k === 'tiling') { S.tiling = !S.tiling; const st = S.tiling; layout(); openPop('qs', $('[data-act="qs"]')); return; }
      else tl.classList.toggle('on');
      refreshPop(); renderInspector(); return; }
    // Notifications
    const nx = hit('[data-ndis]'); if (nx) { e.stopPropagation(); dismiss(nx.dataset.ndis); return; }
    const na = hit('[data-nact]'); if (na) { const [id, a] = na.dataset.nact.split(':'), n = NQ.find(x => x.id === +id);
      if (a === 'Accept') { NQ = NQ.filter(x => x !== n); C.on = true; C.t0 = Date.now(); C.muted = false; rest(); renderStatus(); layout(); isl.call.classList.add('enter'); setTimeout(() => isl.call.classList.remove('enter'), 600); return; }
      if (a === 'Decline') { n.urgent = false; n.title = PRIYA.n; n.body = 'Missed Suno call'; n.acts = ['Call back', 'Message']; n.at = Date.now(); rest(); setTimeout(buzz, 480); return; }
      if (a === 'Call back') { NQ = NQ.filter(x => x !== n); C.on = true; C.t0 = Date.now(); rest(); layout(); return; }
      dismiss(id); if (['Join', 'Show', 'Open', 'Update'].includes(a) && NAPP[n?.app]) L.open(NAPP[n.app]); return; }
    const ns = hit('[data-nsend]'); if (ns) { sendReply(ns.dataset.nsend); return; }
    const card = hit('.nl .ncard'); if (card && !hit('input,button,label')) { const n = NQ.find(x => x.id === +card.dataset.nid); dismiss(card.dataset.nid); if (n && NAPP[n.app]) L.open(NAPP[n.app]); return; }
    if (hit('.nl') && (NS === 'has' || NS === 'idle')) { openTray(); return; }
  });
  function sendReply(id) { const n = NQ.find(x => x.id === +id), i = $(`[data-reply="${id}"]`); if (!n || !i?.value.trim()) return; n.sent = true; if (BADGE) BADGE = 0; renderDock(); setLip('card', cardHTML(n)); setTimeout(() => { NQ = NQ.filter(x => x !== n); rest(); }, 1300); }
  scr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.reply) sendReply(e.target.dataset.reply); });
  nl.addEventListener('focusin', () => clearTimeout(nTimer));
  nl.addEventListener('pointerenter', () => { if (NS === 'has') setLip('has', pillHTML(true)); });
  nl.addEventListener('pointerleave', () => { if (NS === 'has') setLip('has', pillHTML(false)); });
  document.addEventListener('pointerdown', e => { const t = e.composedPath()[0]; if (!(t instanceof Element)) return;
    if (popKind && !pop.contains(t) && !t.closest('[data-act]')) closePop();
    if (grownI && !grownI.contains(t)) shrink();
    if (NS === 'tray' && !nl.contains(t)) rest(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { padClose(); closePop(); shrink(); if (NS === 'tray') rest(); if ($('#plate').classList.contains('on')) $('#plate').classList.remove('on'); } });

  scr.addEventListener('pointerdown', e => { const tr = e.target.closest('[data-q2sl]'); if (!tr) return; const k = tr.dataset.q2sl, r = tr.getBoundingClientRect();
    const set = ev => { const v = Math.round(Math.max(k === 'bri' ? .05 : 0, Math.min(1, (ev.clientX - r.left) / r.width)) * 100); QD[k] = v; tr.querySelector('.fillb').style.width = v + '%'; tr.querySelector(".q2th").style.left = v + '%'; const em = $(`[data-q2v="${k}"]`); if (em) em.textContent = v + '%'; };
    set(e); const mv = ev => set(ev), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); L.set(k === 'vol' ? 'vol' : 'd.int.bright', QD[k]); qAll(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  scr.addEventListener('pointerdown', e => { const sl = e.target.closest('[data-qsl]'); if (!sl) return; const k = sl.dataset.qsl, r = sl.getBoundingClientRect();
    const set = ev => { QD[k] = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * 100); const cur = $(`[data-qsl="${k}"]`); if (cur) { cur.querySelector('.fillb').style.width = QD[k] + '%'; cur.querySelector('em').textContent = QD[k] + '%'; } };
    set(e); const mv = ev => set(ev), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); qAll(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  // Sliders and scrubbers
  scr.addEventListener('pointerdown', e => { const tr = e.target.closest('.slide .tr, [data-scrub]'); if (!tr) return; const set = ev => { const r = tr.getBoundingClientRect(), p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      if (tr.dataset.scrub != null) { M.t = Math.round(p * TRACKS[M.i][1]); refreshPop(); } else { tr.querySelector('i').style.width = p * 100 + '%'; tr.querySelector('u').style.left = p * 100 + '%'; } };
    set(e); const mv = ev => set(ev), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });

  // Free islands: drag anywhere; they snap to the edges.
  scr.addEventListener('pointerdown', e => { if (S.attach !== 'free') return; const i = e.target.closest('.free > .island'); if (!i) return; const s = scr.getBoundingClientRect(), k = s.width / W, p = S.free[i.dataset.id], sx = e.clientX, sy = e.clientY; let moved = false;
    const mv = ev => { const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; i.classList.add('dragging'); closePop(); hideTip();
      let x = p.x + dx, y = p.y + dy; const w = i.offsetWidth, h = i.offsetHeight; x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y));
      if (x < 30) x = INS; if (y < 30) y = INS; if (W - w - x < 30) x = W - w - INS; if (H - h - y < 30) y = H - h - INS; i.style.left = x + 'px'; i.style.top = y + 'px'; i._p = { x, y }; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) { S.free[i.dataset.id] = i._p; i.classList.remove('dragging'); dragged = true; setTimeout(() => dragged = false, 0); save(); } };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); });

  // Tuck: the edge brings the shelf back.
  let peekT = 0;
  scr.addEventListener('pointerover', e => { if (!S.tuck) return; const h = e.target.closest('[data-hot]'); if (h) { clearTimeout(peekT); const r = ROWS[h.dataset.hot]; r.classList.add('peek'); r.classList.remove('tucked'); } });
  Object.values(ROWS).forEach(r => { r.addEventListener('pointerenter', () => clearTimeout(peekT)); r.addEventListener('pointerleave', () => { if (!S.tuck) return; peekT = setTimeout(() => { if (popKind && r.contains(popAnchor)) return; r.classList.remove('peek'); r.classList.add('tucked'); }, 500); }); });

  /* ── Timers ────────────────────────────────────────────────────────────── */
  setInterval(() => { tickClock(); tickCall();
    if (RCL.on && !RCL.paused) { const rt = $('#rec-t'); if (rt) rt.textContent = mmss(recSecs()); }
    if (EVL.on && Date.now() % 60000 < 1100) { const was = isl.ev.isConnected; renderEv(); if (was !== liveIds().includes('ev')) layout(); }
    if (M.on && M.playing) { M.t++; if (M.t >= TRACKS[M.i][1]) { M.i = (M.i + 1) % TRACKS.length; M.t = 0; renderMusic(); } const b = $('#m-prog'); if (b) b.style.width = M.t / TRACKS[M.i][1] * 100 + '%'; const rg = $('#m-ring'); if (rg) rg.style.strokeDashoffset = 100 - M.t / TRACKS[M.i][1] * 100; const pb = $('#mp-bar'); if (pb) { pb.style.width = M.t / TRACKS[M.i][1] * 100 + '%'; $('#mp-t').textContent = mmss(M.t); } }
    if (C.on) { const f = $('.lcall .art.face'); if (f) f.style.setProperty('--lvl', C.muted ? 0 : (.2 + Math.random() * .8).toFixed(2)); }
    if (NS === 'has' && fresh && ++idleBuzz % 14 === 0) buzz(); }, 1000);

  /* ── Icon plate ────────────────────────────────────────────────────────── */
  function openPlate() { const one = (v, sz) => `<span class="dapp" data-v="${v}"><span class="ic" style="background-image:url(${IC}music.svg)"></span></span>`;
    $('#plate').innerHTML = `<div class="card"><button class="q x" type="button" data-plate-x aria-label="Close">${G('x')}</button>
      <div class="hero"><span class="dapp"><span class="ic" style="background-image:url(${IC}music.svg)"></span></span></div>
      <div><h3>Dock icons</h3><p class="lede">A tile of the app's own colour, cut as a squircle and lit from above like the window frame. The artwork stays flat and graphic; the tile gets just enough depth to sit on the shelf. That's the difference between a sticker and a key.</p>
      <dl><dt>1</dt><dd><b>Squircle, 30% radius.</b> Continuous corners, so the curve starts gently. A plain 22% radius looks stamped out; a circle loses the grid.</dd>
      <dt>2</dt><dd><b>1px top light.</b> The same light source as window frames and bar buttons, so the icons belong to the system.</dd>
      <dt>3</dt><dd><b>Half-pixel rim.</b> A faint inner edge keeps dark icons from dissolving into a dark shelf.</dd>
      <dt>4</dt><dd><b>Base shade and a contact shadow.</b> A 1px shade inside, then a tight 2px shadow and a soft 10px one. The tile rests on the shelf; it doesn't hover over it.</dd>
      <dt>5</dt><dd><b>No gloss, no bevel, no reflection.</b> Depth comes from light, never from chrome.</dd>
      <dt>6</dt><dd><b>40px on a 56px shelf</b> (36 compact, 48 large). A 4px dot under a running app, a 12px bar under the one you're in, an accent dot when it wants you.</dd></dl></div>
      <div class="cmp"><figure>${one('flat')}<figcaption>Flat</figcaption></figure><figure>${one('lit')}<figcaption>Lit · default</figcaption></figure><figure>${one('deep')}<figcaption>Deep</figcaption></figure>
      <div class="strip">${APPS.slice(0, 9).map(([id]) => `<span class="dapp" data-v="${S.icon}"><span class="ic" style="background-image:url(${IC}${id}.svg)"></span></span>`).join('')}</div></div></div>`;
    $('#plate').classList.add('on'); }

  function renderInspector() {}
  function captureFree() { if (S.attach === 'free') return; [isl.dock, isl.status, isl.music, isl.call].forEach(i => { if (!i.isConnected) return; const r = rel(i); S.free[i.dataset.id] = { x: Math.round(r.x), y: Math.round(r.y) }; }); }

  /* ── Fit the 1440×900 screen into the stage ─────────────────────────────── */
  function fit() { W = desk.clientWidth; H = desk.clientHeight; placePop(); }
  let rsT = 0; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { fit(); S.liveMax = 2; layout(); }, 120); });

  S.clock = 'quiet'; S.theme = document.body.dataset.mode || 'dark'; S.mat = document.body.dataset.mat === 'frost' ? 'frost' : 'solid'; S.dnd = !!L.getDnd(); QD.vol = L.get('vol'); QD.bri = L.get('d.int.bright');
  renderDock(); renderFolders(); renderStatus(); renderMusic(); renderCall(); renderWx(); renderEv(); renderRec(); renderTg(); renderNfl();
  fit(); layout(); rest();
  /* Suno drives the shell: which windows are open, the mode, Do Not Disturb */
  window.lumaLive = (k, on) => { if (k === 'rec') { RCL.on = on; RCL.t0 = Date.now() - 14e3; RCL.acc = 0; RCL.paused = false; } if (k === 'ev') { EVL.on = on; EVL.forced = on; EVL.t = on ? 'Product sync' : 'Walkthrough'; EVL.at = Date.now() + 8 * 60e3; } if (k === 'tg') TGL.on = on; if (k === 'wx') S.wx = on; if (k === 'music') M.on = on; if (k === 'call') { C.on = on; C.t0 = Date.now(); } renderEv(); renderRec(); renderTg(); renderWx(); renderMusic(); renderCall(); layout(); };
  window.lumaShell = {
    sync(run, front) { RUN = new Set(run); FOCUS = front || ''; renderDock(); },
    theme(m) { if (S.theme === m) return; S.theme = m; scr.dataset.theme = m; save(); },
    mat(m) { if (S.mat === m) return; S.mat = m; scr.dataset.mat = m; save(); },
    /* the dash and the tiler, as first login (desktop/setup.js) and Settings choose them: suno, onebar (Cupertino), taskbar (Redmond) */
    preset(p) { if (!PRESETS[p] || !PRESETS[p].edge) return; Object.assign(S, JSON.parse(JSON.stringify(PRESETS[p])), { preset: p }); S.liveMax = 2; layout(); },
    tiling(v) { S.tiling = !!v; layout(); },
    dnd(v) { S.dnd = !!v; renderStatus(); if (NS === 'has' || NS === 'idle') rest(); refreshPop(); },
    notify(n) { notify(n); },
    /* D-Ink: the shelf in ink (desktop/dink-shell.css); the dock redraws so it picks up the ink icons */
    ink(v) { v = v || ''; if ((S.ink || '') === v) return; S.ink = v; IC = U(v ? '../icons/Suno-ink-' : '../icons/Suno-v4-'); if (v) scr.dataset.ink = v; else delete scr.dataset.ink; if (v && !ROOT.querySelector('#dinkcss')) { const l = document.createElement('link'); l.id = 'dinkcss'; l.rel = 'stylesheet'; l.href = 'desktop/dink-shell.css'; ROOT.prepend(l); } renderDock(); renderStatus(); try { refreshPop(); } catch (e) {} },
    state: S, tick() { tickClock(); renderStatus(); }, tray: () => openTray(), notify: n => notify(n) };   // state/tick: for Studio checks
  if (document.documentElement.dataset.ink) window.lumaShell.ink(document.documentElement.dataset.ink);
  L.ready();
  /* A few things happen while you look around: a message drops from the top edge, waits, then tucks back into the lip. */
  const MSG = ['Pushed the new shelf build. Want to try it before dinner?', 'Also: the notification lip is so good.', 'Ok, heading out. Call if anything breaks.'];
  setTimeout(() => notify({ app: 'messages', face: PRIYA, title: 'Priya Raman', body: MSG[0], reply: true }), 2600);
  setTimeout(() => { S.soonAt = Date.now() + 15 * 60e3 - 20e3; tickClock(); renderEv(); layout(); }, 44000);
  setTimeout(() => notify({ app: 'calendar', title: 'Launch walkthrough in 15 minutes', body: 'Studio \u00b7 with Priya, Nora and Theo', acts: ['Join', 'Snooze'] }), 45000);
  setTimeout(() => notify({ app: 'files', title: 'suno-nightly.iso is ready', body: 'Downloads \u00b7 4.1 GB', acts: ['Show', 'Open'] }), 110000);
  setTimeout(() => notify({ app: 'messages', face: PRIYA, title: 'Priya Raman', body: MSG[1], reply: true }), 190000);
})();
})();
