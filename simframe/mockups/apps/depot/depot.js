/* ══ Depot A (24 Oct 2026, second pass): the store for every Luma screen ════════════════════════════════════════
   Depot holds three kinds of thing: Apps; Looks, which change how Luma looks (wallpapers, themes, icons, sounds,
   fonts, pointers); and Tweaks, which change how it works. It is built around the person's devices, which Luma
   Connect already knows.

   The LumaUI frame every app has: the title bar names the app and holds the sidebar button; the sidebar holds the
   places, what's yours, and the devices (pick one and Depot shows what runs on it), with search at its foot; the
   action bar at the bottom holds what you can do on the page you're on, and nothing else.

   · Every item says where it runs with the screens it runs on, and only those.
   · Get asks which of your devices it should go to; Keep matched adds it to every device that can run it.
   · Updates is a place of its own: Luma itself first, then apps by device, then what changed recently, with Luma's
     previous version always one step back.
   · Library is a board of what you have against where you have it.
   · Every item carries one seal (Luma, Verified, Community); every Tweak lists what it changes and can be undone.

   ?depot=b loads the other direction (depot-b.js). The simulator hands over its shared parts in render(K). */
(() => {
  'use strict';
  const ST = { place: 'today', item: null, hist: [], q: '', lens: null, sheet: null, picks: null, keep: false, chip: '', trying: null, sent: {}, upd: {}, sys: 'ready', open: {}, searching: false };
  let K = null, W = null, RO = null, lastMode = '';
  const D = () => window.DEPOT_DATA;
  const PLACES = [['today', 'Today', 'sparkles'], ['apps', 'Apps', 'blocks'], ['looks', 'Looks', 'palette'], ['tweaks', 'Tweaks', 'sliders-horizontal']];
  const YOURS = [['library', 'Library', 'layers'], ['updates', 'Updates', 'refresh-cw'], ['publish', 'Made by you', 'upload']];
  const PK = { system: 'Part of Luma', luma: 'Luma app', flatpak: 'Flatpak', deb: 'Universal .deb', rpm: 'Universal .rpm', layered: 'Layered package' };

  /* ── small parts ── */
  const q$ = s => W && W.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => (K && K.ic(n)) || (() => { const v = (window.__iconBundle || {})[n]; return v ? v.replace(/<!--[\s\S]*?-->/g, '').replace(/stroke-width="[\d.]+"/, 'stroke-width="1.6"').replace(/ width="24"/, '').replace(/ height="24"/, '').replace('<svg', '<svg class="i" aria-hidden="true"') : ''; })();
  const fmtN = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
  const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const forms = () => D().forms, devs = () => D().devices;
  const formOf = id => forms().find(f => f.id === id);
  const devOf = id => devs().find(d => d.id === id);
  const here = () => { const ph = W?.classList.contains('phone'), f = document.documentElement.dataset.form; return !ph ? 'xps' : f === 'tablet' ? 'x1' : 'fp6'; };
  const lens = () => ST.lens || here();
  const lensForm = () => lens() === 'any' ? null : devOf(lens())?.form;
  const mode = () => { const w = q$('#dq-main')?.clientWidth || W?.clientWidth || 1200; return W?.classList.contains('phone') && document.documentElement.dataset.form !== 'tablet' ? 'compact' : w < 560 ? 'compact' : w < 860 ? 'mid' : 'wide'; };

  /* ── one shape for every kind of item ── */
  const sealOfApp = a => a.dev === 'Luma' ? 'luma' : a.verified ? 'verified' : 'community';
  function item(kind, id) {
    if (kind === 'app') { const a = D().apps.find(x => x.id === id); if (!a) return null;
      return { kind, id, name: a.name, by: a.dev || 'Unknown developer', seal: sealOfApp(a), line: a.summary || `${D().cats[a.cat]?.name || 'An'} app · ${PK[a.pk]}`, runs: D().runs[id] || ['desktop', 'tablet'], hue: hash(id), a, n: a.rating?.n }; }
    const list = kind === 'look' ? D().looks : D().tweaks, x = list.find(v => v.id === id); if (!x) return null;
    return { kind, id, name: x.name, by: x.by, seal: x.seal, line: x.line, runs: x.runs, hue: x.hue, x, n: x.n };
  }
  const isSystem = it => it.kind === 'app' && it.a.pk === 'system';
  function onDevices(it) {
    if (ST.sent[it.kind + it.id]) return ST.sent[it.kind + it.id];
    const can = devs().filter(d => it.runs.includes(d.form)).map(d => d.id);
    if (it.kind === 'app') { if (it.a.dev === 'Luma') return can; return devs().filter(d => (D().installed[d.id] || []).includes(it.id)).map(d => d.id); }
    if (it.kind === 'look') return it.id === 'prism' ? can : [];
    return it.x.on || [];
  }
  const runsHere = it => !lensForm() || it.runs.includes(lensForm());
  const matched = it => D().matched.includes(it.id);
  const pending = () => D().pending.map(p => ({ ...p, devs: p.devs.filter(d => !ST.upd[p.app + d]) })).filter(p => p.devs.length);
  const updCount = () => pending().reduce((n, p) => n + p.devs.length, 0) + (ST.sys === 'restarted' ? 0 : 1);

  /* faces */
  function face(it, cls = '') {
    if (it.kind === 'app') { const a = it.a;
      if (a.icon) { const src = `${K.A}${a.icon}.svg`; return `<i class="dq-face ${cls}" style="background-image:url(${document.documentElement.dataset.ink ? src.replace('Suno-v4-', 'Suno-ink-') : src})"></i>`; }
      if (a.mark) return `<i class="dq-face mark ${cls}" style="--mk:${a.mark.bg}"><img src="apps/depot/marks/${a.mark.file}.svg" alt=""></i>`;
      return `<i class="dq-face mono ${cls}" style="--h:${it.hue}">${esc(a.name.slice(0, 2))}</i>`; }
    if (it.kind === 'look') { const x = it.x;
      if (x.art) return `<i class="dq-face pic ${cls}" style="background-image:url(${x.art})"></i>`;
      if (x.swatch) return `<i class="dq-face sw ${cls}">${x.swatch.map(c => `<b style="background:${c}"></b>`).join('')}</i>`;
      if (x.ink) return `<i class="dq-face ink ${cls}"><b>Aa</b></i>`;
      return `<i class="dq-face glyph ${cls}" style="--h:${x.hue}">${ic({ Sounds: 'volume-2', Font: 'type', Cursor: 'mouse-pointer-2', Theme: 'palette', Icons: 'blocks', Appearance: 'paintbrush' }[x.kind] || 'palette')}</i>`; }
    return `<i class="dq-face glyph ${cls}" style="--h:${it.hue}">${ic(it.x.icon)}</i>`;
  }
  /* where it runs: the screens it runs on, and only those */
  const runs = it => `<span class="dq-runs" title="Runs on ${forms().filter(f => it.runs.includes(f.id)).map(f => f.name).join(', ')}">${forms().filter(f => it.runs.includes(f.id)).map(f => ic(f.icon)).join('')}</span>`;
  const runsLab = it => `<span class="dq-runs lab">${forms().map(f => `<i class="${it.runs.includes(f.id) ? 'on' : ''}">${ic(f.icon)}<small>${f.name}</small></i>`).join('')}</span>`;
  const seal = (it, long) => { const s = D().seals[it.seal]; return `<span class="dq-seal ${it.seal}">${ic(s.icon)}${long ? s.line : s.name}</span>`; };
  const kindWord = it => it.kind === 'app' ? (D().cats[it.a.cat]?.name || 'App') : it.x.kind;
  const verb = it => it.kind === 'tweak' ? 'Turn on' : it.kind === 'look' ? 'Use' : 'Get';
  function act(it, cls = '') { const on = onDevices(it), lf = lensForm(), dv = lens() === 'any' ? null : lens();
    if (isSystem(it)) return `<button class="dq-act quiet ${cls}" type="button" data-dq-open="${it.kind}:${it.id}">Open</button>`;
    if (lf && !it.runs.includes(lf)) return `<span class="dq-act none ${cls}">Not for ${formOf(lf).name}</span>`;
    if (dv && on.includes(dv)) return `<button class="dq-act quiet ${cls}" type="button" data-dq-open="${it.kind}:${it.id}">${it.kind === 'tweak' ? 'On' : it.kind === 'look' ? 'In use' : 'Open'}</button>`;
    return `<button class="dq-act ${cls}" type="button" data-dq-get="${it.kind}:${it.id}">${verb(it)}</button>`; }

  /* ── cards and rows ── */
  const card = it => `<article class="dq-card k-${it.kind}" data-dq-item="${it.kind}:${it.id}" tabindex="0">${face(it)}<div class="dq-ct"><b>${esc(it.name)}</b><small>${esc(it.line)}</small>${runs(it)}</div>${act(it)}</article>`;
  const row = it => `<div class="dq-row" data-dq-item="${it.kind}:${it.id}" tabindex="0">${face(it, 'sm')}<span class="dq-rt"><b>${esc(it.name)}</b><small>${esc(it.line)}</small></span>${act(it)}</div>`;
  const lookCard = it => { const x = it.x;
    return `<article class="dq-look" data-dq-item="look:${it.id}" tabindex="0" style="--h:${x.hue}"><div class="dq-lpic${x.art ? ' pic' : ''}"${x.art ? ` style="background-image:url(${x.art})"` : ''}>${x.art ? '' : lookPreview(x)}<span class="dq-ltag">${esc(x.kind)}</span></div>
      <div class="dq-lt"><span><b>${esc(x.name)}</b><small>${esc(x.by)} · ${fmtN(x.n)} use it</small></span>${x.art || x.ink || x.kind === 'Theme' ? `<button class="dq-try" type="button" data-dq-try="${it.id}">Try</button>` : ''}${act(it)}</div></article>`; };
  function lookPreview(x) {
    if (x.swatch) return `<span class="dq-lsw">${x.swatch.map((c, i) => `<i style="background:${c}">${ic(['music', 'image', 'folder-open', 'mail'][i])}</i>`).join('')}</span>`;
    if (x.ink) return `<span class="dq-inkp"><b>Aa</b><i></i><i></i><i></i></span>`;
    if (x.kind === 'Sounds') return `<span class="dq-lwave">${Array.from({ length: 28 }, (_, i) => `<i style="height:${12 + Math.abs(Math.sin(i * 1.7)) * 46}%"></i>`).join('')}</span>`;
    if (x.kind === 'Font') return `<span class="dq-lfont" style="font-family:'Atkinson Hyperlegible', Figtree, sans-serif">Aa Bb<small>The quick brown fox</small></span>`;
    if (x.kind === 'Cursor') return `<span class="dq-lcur">${ic('mouse-pointer-2')}${ic('mouse-pointer-2')}${ic('mouse-pointer-2')}</span>`;
    return `<span class="dq-lglyph">${ic('palette')}</span>`; }
  const tweakRow = it => { const x = it.x, me = lens() === 'any' ? here() : lens(), on = onDevices(it).includes(me), can = runsHere(it);
    return `<div class="dq-tweak" data-dq-item="tweak:${it.id}" tabindex="0">${face(it, 'sm')}<span class="dq-tt"><b>${esc(x.name)}${x.restart ? `<em>Restart</em>` : ''}</b><small>${esc(x.line)}</small><span class="dq-chg">${ic('git-branch')}Changes ${x.changes.map(esc).join(' · ')}</span></span>
      <span class="dq-tside">${seal(it)}${can ? `<button class="dq-sw${on ? ' on' : ''}" type="button" role="switch" aria-checked="${on}" aria-label="${esc(x.name)}" data-dq-toggle="${it.id}"><i></i></button>` : `<span class="dq-act none">Not for ${formOf(lensForm()).name}</span>`}</span></div>`; };

  /* ── the frame ── */
  function frame() {
    const top = q$('#dp-top'); if (!top) return;
    if (!top.dataset.dqa) { top.dataset.dqa = 1; top.innerHTML = `<img src="${K.A}app-store.svg" alt=""><b>Depot</b>${K.lSideBtn(W)}`; }
    const ib = W.querySelector('.ibody'); if (ib && !ib.dataset.dqa) { ib.dataset.dqa = 1;
      ib.innerHTML = `<nav class="dpside dq-side" id="dp-side" aria-label="Depot"></nav><main class="main isle dq-main" id="dq-main"><div class="scroll" id="dq-body"></div><div class="fbar dq-bar phnofit" id="dq-bar" role="toolbar" aria-label="Depot"></div><div class="dq-scrim" id="dq-scrim" hidden></div><section class="dq-sheet" id="dq-sheet" hidden></section></main>`; }
    W.classList.add('dqwin');
    if (!RO) { RO = new ResizeObserver(() => { const m = mode(); if (m !== lastMode) { lastMode = m; render(); } }); RO.observe(W);
      document.addEventListener('keydown', e => { if (W.hidden) return; if (e.key === 'Escape') { if (ST.sheet) { closeSheet(); e.stopPropagation(); } else if (ST.searching) { ST.searching = false; ST.q = ''; if (ST.place === 'search') back(true); render(); } else if (ST.trying) untry(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && (K.front?.()?.dataset.app === 'depot' || W.classList.contains('phone'))) { e.preventDefault(); if (mode() === 'compact') { ST.searching = true; bar(); } q$('#dq-q, #dq-bq')?.focus(); } }, true);
      W.addEventListener('input', e => { if (e.target.id === 'dq-q' || e.target.id === 'dq-bq') { const v = e.target.value; ST.q = v; if (v.trim()) { if (ST.place !== 'search') { push(); ST.place = 'search'; ST.item = null; } } else if (ST.place === 'search') back(true); body(); if (e.target.id === 'dq-q') side(); } }); } }
  const searchField = id => `<label class="srch dq-srch">${ic('search')}<input id="${id}" type="search" placeholder="Apps, Looks, Tweaks, or a name you know" aria-label="Search Depot" value="${esc(ST.q)}" autocomplete="off" spellcheck="false"></label>`;
  const place = () => ST.item ? ST.from || 'today' : ST.place;
  function navRows(withDevs) { const cur = place(), si = (k, n, i, attr, em = '') => `<button class="si${cur === k ? ' on' : ''}" type="button" ${attr}>${ic(i)}<span class="lab">${n}</span>${em}</button>`;
    return PLACES.map(([k, n, i]) => si(k, n, i, `data-dq-place="${k}"`)).join('')
      + `<div class="sh dpsh">Yours</div>` + YOURS.map(([k, n, i]) => si(k, n, i, `data-dq-place="${k}"`, k === 'updates' ? K.lCount(updCount(), true) : '')).join('')
      + (withDevs ? `<div class="sh dpsh">Show what runs on</div>` + devs().map(d => `<button class="si dq-dsi${lens() === d.id ? ' on' : ''}" type="button" data-dq-setlens="${d.id}">${ic(formOf(d.form).icon)}<span class="lab">${esc(d.name)}</span>${d.id === here() ? '<em class="dq-this">This</em>' : ''}</button>`).join('')
        + `<button class="si dq-dsi${lens() === 'any' ? ' on' : ''}" type="button" data-dq-setlens="any">${ic('monitor-smartphone')}<span class="lab">Any screen</span></button>` : ''); }
  function side() { const el = q$('#dp-side'); if (!el) return; const had = document.activeElement?.id === 'dq-q';
    el.innerHTML = `<div class="scr">${navRows(true)}</div><div class="shead sfoot dpfoot">${searchField('dq-q')}</div>`;
    if (had) { const qi = q$('#dq-q'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } }

  /* the action bar: what you can do on this page */
  function bar() { const b = q$('#dq-bar'); if (!b) return; const m = mode(), compact = m === 'compact', it = ST.item && item(...ST.item);
    const seg = (list, attr, cur) => `<div class="seg dq-seg" role="tablist"><i class="ind"></i>${list.map(([k, n]) => `<button type="button" role="tab" class="${cur === k ? 'on' : ''}" ${attr}="${esc(k)}">${esc(n)}</button>`).join('')}</div>`;
    let h = '';
    if (compact && ST.searching) h = `${searchField('dq-bq')}<button class="ib" type="button" data-dq-searchx aria-label="Close search">${ic('x')}</button>`;
    else if (it) h = `<button class="ib" type="button" data-dq-back aria-label="Back">${ic('chevron-left')}</button><button class="ib" type="button" data-dq-share aria-label="Share">${ic('share-2')}</button>${!isSystem(it) ? `<button class="dq-act bar dq-wherebt" type="button" data-dq-get="${it.kind}:${it.id}">${ic('monitor-smartphone')}<span>${onDevices(it).length ? `On ${onDevices(it).length}` : 'Devices'}</span></button>` : ''}${act(it, 'key')}`;
    else { const s = compact ? `<button class="ib" type="button" data-dq-bsearch aria-label="Search">${ic('search')}</button>` : '';
      if (ST.place === 'apps') h = s + seg([['', 'All'], ...Object.entries(D().cats).map(([k, c]) => [k, c.name])], 'data-dq-chip', ST.chip);
      else if (ST.place === 'looks') h = s + seg([['', 'All'], ['Wallpaper', 'Wallpapers'], ['Theme', 'Themes'], ['Icons', 'Icons'], ['Sounds', 'Sounds'], ['more', 'More']], 'data-dq-chip', ST.chip);
      else if (ST.place === 'tweaks') h = s + seg([['', 'All'], ['on', 'On'], ['off', 'Off']], 'data-dq-chip', ST.chip);
      else if (ST.place === 'updates') h = s + `<button class="ib" type="button" data-dq-autoset aria-label="Automatic updates">${ic('settings-2')}</button>${pending().length || ST.sys !== 'restarted' ? `<button class="dq-act bar key" type="button" data-dq-upall>${ic('refresh-cw')}Update everything</button>` : ''}`;
      else if (ST.place === 'library') h = s + `<button class="dq-act bar" type="button" data-dq-place="updates">${ic('refresh-cw')}${updCount()} updates</button>`;
      else if (ST.place === 'publish') h = s + ['app', 'look', 'tweak'].map(k => `<button class="dq-act bar" type="button" data-dq-new="${k}">${ic({ app: 'package', look: 'palette', tweak: 'sliders-horizontal' }[k])}${{ app: 'App', look: 'Look', tweak: 'Tweak' }[k]}</button>`).join('');
      else h = s; }
    b.innerHTML = h; b.hidden = !h; requestAnimationFrame(() => K.segs?.());
    if (compact && ST.searching) setTimeout(() => { const qi = q$('#dq-bq'); if (qi && document.activeElement !== qi) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } }); }

  /* ── going places ── */
  const push = () => ST.hist.push({ place: ST.place, item: ST.item, from: ST.from, chip: ST.chip });
  function go(p) { ST.hist = []; ST.place = p; ST.item = null; ST.chip = ''; ST.q = ''; ST.searching = false; closeSheet(true); render(); q$('#dq-body')?.scrollTo(0, 0); }
  function open(kind, id) { push(); ST.from = place(); ST.item = [kind, id]; closeSheet(true); render(); q$('#dq-body')?.scrollTo(0, 0); }
  function back(quiet) { const h = ST.hist.pop(); if (h) Object.assign(ST, h); else Object.assign(ST, { place: 'today', item: null }); if (ST.place !== 'search') ST.q = ''; if (!quiet) render(); }

  /* ── pages ── */
  function body() { const el = q$('#dq-body'); if (!el) return; const m = mode();
    const cur = [...PLACES, ...YOURS].find(p => p[0] === place());
    const head = '';
    el.innerHTML = (ST.trying ? tryBanner() : '') + head + `<div class="dq-page p-${ST.item ? 'item' : ST.place}">${ST.item ? page(item(...ST.item)) : ({ today, apps, looks, tweaks, library, updates, publish, search })[ST.place]()}</div>`;
    bar(); }
  function lensBtn() { const l = lens(), d = devOf(l); return `<button class="dq-lens" type="button" data-dq-lens aria-label="Show what runs on">${ic(l === 'any' ? 'monitor-smartphone' : formOf(d.form).icon)}<span><small>For</small>${l === 'any' ? 'Any screen' : esc(d.name)}</span>${ic('chevron-down')}</button>`; }
  const intro = (t, s) => `<header class="dq-intro"><h1>${t}</h1>${s ? `<p>${s}</p>` : ''}${lensNote()}</header>`;
  const lensNote = () => { const l = lens(); if (l === here() || ['library', 'updates', 'publish'].includes(ST.place)) return ''; const d = devOf(l); return `<button class="dq-lnote" type="button" data-dq-setlens="${here()}">${ic(l === 'any' ? 'monitor-smartphone' : formOf(d.form).icon)}${l === 'any' ? 'Showing everything, whatever it runs on' : `Showing what runs on <b>${esc(d.name)}</b>`}<span>Back to this device</span></button>`; };
  const empty = () => `<p class="dq-empty">Nothing here runs on ${esc(devOf(lens())?.name || 'this screen')} yet.</p>`;
  const sec = (kick, title, inner, more) => `<section class="dq-sec"><header><span>${kick ? `<small>${kick}</small>` : ''}<h3>${title}</h3></span>${more || ''}</header>${inner}</section>`;

  /* Made for Luma: one family, presented as one thing */
  function suite() { const its = D().apps.filter(a => a.dev === 'Luma' && a.pk !== 'system').map(a => item('app', a.id)).filter(runsHere).slice(0, 16);
    return `<section class="dq-suite"><div class="dq-suitx"><img src="assets/Suno-favicon.svg" alt=""><h2>Made for Luma</h2><p>Free, private, and they work together: what you start on one device is waiting on the next.</p><span>${its.length} apps · all free</span></div>
      <div class="dq-suitg">${its.map(it => `<button type="button" class="dq-sapp" data-dq-item="app:${it.id}">${face(it)}<small>${esc(it.name)}</small></button>`).join('')}</div></section>`; }

  function today() { const t = D().today;
    return `<header class="dq-hello"><small>${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</small><h1>Today</h1></header>` + t.map(s => {
      if (s.kind === 'everywhere') { const it = item('app', s.app);
        return `<section class="dq-hero" style="--h:${s.hue}" data-dq-item="app:${s.app}"><i class="dq-hbg" style="background-image:url(${s.art})"></i><div class="dq-htx"><small>${esc(s.kick)}</small><h2>${esc(s.title)}</h2><p>${esc(s.blurb)}</p>
          <div class="dq-hfoot">${face(it, 'sm')}<span><b>${esc(it.name)}</b><small>${esc(it.by)}</small></span>${act(it)}</div></div>
          <div class="dq-hscreens">${forms().map(f => `<span class="dq-hs"><i>${ic(f.icon)}</i><small>${f.name}</small></span>`).join('')}</div></section>`; }
      if (s.kind === 'look') { const it = item('look', s.look);
        return `<section class="dq-duo"><article class="dq-story look" data-dq-item="look:${it.id}" style="background-image:url(${it.x.art})"><div><small>${esc(s.kick)}</small><h3>${esc(it.name)}</h3><p>${esc(it.line)}</p><span class="dq-sbtns"><button class="dq-try light" type="button" data-dq-try="${it.id}">Try it here</button>${act(it, 'light')}</span></div></article>${tweakStory(t.find(x => x.kind === 'tweak'))}</section>`; }
      if (s.kind === 'switch') return `<section class="dq-switch"><header><small>${esc(s.kick)}</small><h3>${esc(s.title)}</h3></header><div class="dq-names">${D().switching.map(([n, ids]) => `<button type="button" data-dq-search="${esc(n)}"><b>${esc(n)}</b>${ic('arrow-right')}<span>${ids.slice(0, 3).map(id => face(item('app', id), 'xs')).join('')}</span></button>`).join('')}</div></section>`;
      if (s.kind === 'screen') { const f = formOf(s.form), its = D().apps.map(a => item('app', a.id)).filter(it => it && !isSystem(it) && it.runs.includes(s.form)).slice(0, 6);
        return `<section class="dq-screen f-${s.form}"><header><i>${ic(f.icon)}</i><span><small>${esc(s.kick)}</small><h3>${esc(s.title)}</h3></span><button class="dq-link" type="button" data-dq-screen="${s.form}">See all ${ic('chevron-right')}</button></header><div class="dq-grid g3">${its.map(card).join('')}</div></section>`; }
      if (s.kind === 'row') return sec(esc(s.kick), esc(s.title), `<div class="dq-grid g3">${s.items.map(([k, id]) => item(k, id)).filter(Boolean).slice(0, 6).map(card).join('')}</div>`);
      return ''; }).join(''); }
  function tweakStory(s) { const it = item('tweak', s.tweak);
    return `<article class="dq-story tweak" data-dq-item="tweak:${it.id}" style="--h:${it.hue}"><div><small>${esc(s.kick)}</small>${face(it, 'lg')}<h3>${esc(it.name)}</h3><p>${esc(s.blurb)}</p><span class="dq-undo">${ic('undo-2')}Switch it off and Luma is exactly as it was</span><span class="dq-sbtns">${act(it)}</span></div></article>`; }

  function apps() { const cats = D().cats, all = D().apps.map(a => item('app', a.id)).filter(it => !isSystem(it) && runsHere(it));
    if (ST.chip) { const c = cats[ST.chip]; return intro(c.name, c.about) + `<div class="dq-grid">${all.filter(it => it.a.cat === ST.chip).map(card).join('') || empty()}</div>`; }
    const ids = new Set(all.map(it => it.id)), pop = D().popular.map(id => item('app', id)).filter(it => it && ids.has(it.id));
    return intro('Apps', 'For every screen you own') + suite() + sec('What people install first', 'Popular', `<div class="dq-grid">${pop.slice(0, 9).map(card).join('') || empty()}</div>`)
      + Object.entries(cats).map(([k, c]) => { const its = all.filter(it => it.a.cat === k && it.seal !== 'luma').slice(0, 3); return its.length ? sec(esc(c.about), esc(c.name), `<div class="dq-grid g3">${its.map(card).join('')}</div>`, `<button class="dq-link" type="button" data-dq-chip="${k}">See all ${ic('chevron-right')}</button>`) : ''; }).join(''); }
  function looks() { const main = ['Wallpaper', 'Theme', 'Icons', 'Sounds'], vis = D().looks.map(l => item('look', l.id)).filter(runsHere).filter(it => !ST.chip || (ST.chip === 'more' ? !main.includes(it.x.kind) : it.x.kind === ST.chip));
    return intro('Looks', 'Change how Luma looks. Try anything on this window first.') + `<div class="dq-looks">${vis.map(lookCard).join('') || empty()}</div>`; }
  function tweaks() { const me = lens() === 'any' ? here() : lens(), all = D().tweaks.map(t => item('tweak', t.id)).filter(it => !ST.chip || (ST.chip === 'on') === onDevices(it).includes(me));
    const kinds = [...new Set(all.map(it => it.x.kind))];
    return intro('Tweaks', 'Change how Luma works.') + `<aside class="dq-promise">${ic('undo-2')}<span><b>Every Tweak can be undone.</b> Luma keeps your system as it was beside the changed one. Switch a Tweak off and the parts it changed go back exactly as they were.</span></aside>`
      + (kinds.map(k => sec('', esc(k), `<div class="dq-tweaks">${all.filter(it => it.x.kind === k).map(tweakRow).join('')}</div>`)).join('') || empty()); }

  /* Updates: Luma first, then apps by device, then what changed recently */
  const autoRows = () => { const A = D().auto; return `<button type="button" class="dq-autorow" data-dq-auto="apps"><span><b>Update apps overnight</b><small>On every device, while it charges</small></span><i class="dq-sw${A.apps ? ' on' : ''}"><i></i></i></button>
    <button type="button" class="dq-autorow" data-dq-auto="luma"><span><b>Get Luma updates overnight</b><small>Downloads in the background; you choose when to restart</small></span><i class="dq-sw${A.luma ? ' on' : ''}"><i></i></i></button>
    <button type="button" class="dq-autorow" data-dq-auto="matched"><span><b>Keep matched apps on the same version</b><small>A device that wakes catches up before you use it</small></span><i class="dq-sw${A.matched ? ' on' : ''}"><i></i></i></button>`; };
  function updates() { const sys = D().system, P = pending(), me = here();
    const sysCard = ST.sys === 'restarted' ? `<section class="dq-sysup ok"><span class="dq-sysic">${ic('circle-check')}</span><span class="dq-syst"><b>Luma is up to date</b><small>${esc(sys.name)} · checked just now</small></span></section>`
      : `<section class="dq-sysup"><span class="dq-sysic">${ic('sparkles')}</span><span class="dq-syst"><small>Luma · ${esc(sys.channel || 'Nightly')}</small><b>${esc(sys.name)}</b><small>${esc(sys.blurb)} · ${esc(sys.size)}</small></span>
        <button class="dq-act${ST.sys === 'run' ? ' quiet' : ''}" type="button" data-dq-sys>${ST.sys === 'done' ? 'Restart' : ST.sys === 'run' ? 'Downloading…' : 'Download'}</button>
        <details class="dq-notes"${ST.open.sys ? ' open' : ''}><summary data-dq-toggleopen="sys">What's new</summary><ul>${(sys.notes || []).map(([t, i, n, d]) => `<li><span class="dq-nt t-${t.toLowerCase()}">${esc(t)}</span><b>${esc(n)}</b><small>${esc(d)}</small></li>`).join('')}</ul></details>
        <p class="dq-sysfoot">${ic('undo-2')}You're on ${esc(sys.running)}. Luma keeps it, so you can go back with one click if anything feels wrong.</p></section>`;
    const byDev = devs().map(d => ({ d, list: P.filter(p => p.devs.includes(d.id)) })).filter(g => g.list.length).sort((a, b) => (b.d.id === me) - (a.d.id === me));
    const upRow = (p, d) => { const it = item('app', p.app), k = p.app + d.id; return `<div class="dq-uprow"><span class="dq-upa" data-dq-item="app:${p.app}">${face(it, 'sm')}<span><b>${esc(it.name)}</b><small>${esc(p.from)} → ${esc(p.to)} · ${esc(p.size)}</small></span></span>
      <details${ST.open[k] ? ' open' : ''}><summary data-dq-toggleopen="${k}">What's new</summary><ul>${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details><button class="dq-act" type="button" data-dq-up="${p.app}:${d.id}">Update</button></div>`; };
    return intro('Updates', '') + sysCard
      + (byDev.length ? byDev.map(({ d, list }) => `<section class="dq-updev"><header><i>${ic(formOf(d.form).icon)}</i><span><b>${esc(d.name)}${d.id === me ? '<em class="dq-this">This</em>' : ''}</b><small>${list.length} update${list.length > 1 ? 's' : ''}${d.form === 'tv' ? ' · installs when it wakes' : ''}</small></span><button class="dq-link" type="button" data-dq-updev="${d.id}">Update ${d.id === me ? 'all here' : 'all on ' + esc(d.name)}</button></header>${list.map(p => upRow(p, d)).join('')}</section>`).join('')
        : `<section class="dq-updev done"><header><i>${ic('circle-check')}</i><span><b>Every app is up to date</b><small>On all ${devs().length} devices</small></span></header></section>`)
      + `<section class="dq-auto"><h3>Automatically</h3>${autoRows()}</section>`
      + sec('', 'Recently', `<div class="dq-done">${D().done.map(([id, what, when, where]) => { const it = id === 'luma' ? null : item('app', id); return `<div class="dq-donerow">${it ? face(it, 'xs') : `<i class="dq-face glyph xs" style="--h:290">${ic('sparkles')}</i>`}<span><b>${it ? esc(it.name) : 'Luma'}</b><small>${esc(what)} · ${esc(where)}</small></span><time>${esc(when)}</time>${id === 'luma' ? `<button class="dq-link" type="button" data-dq-rollback>Go back to this</button>` : ''}</div>`; }).join('')}</div>`); }

  /* Library: what you have, against where you have it */
  const libApps = () => { const ids = new Set(); devs().forEach(d => (D().installed[d.id] || []).forEach(id => ids.add(id))); ['tide', 'photos', 'messages', 'write', 'notes'].forEach(id => ids.add(id)); Object.keys(ST.sent).filter(k => k.startsWith('app')).forEach(k => ids.add(k.slice(3))); return [...ids].map(id => item('app', id)).filter(Boolean); };
  function library() { const ds = devs(), its = libApps().sort((a, b) => a.name.localeCompare(b.name)), me = here();
    const upd = new Set(pending().flatMap(p => p.devs.map(d => p.app + d)));
    const cell = (it, d) => { const can = it.runs.includes(d.form), has = onDevices(it).includes(d.id);
      return !can ? `<td class="c-no" title="${esc(it.name)} doesn't run on ${formOf(d.form).name}">${ic('minus')}</td>` : has ? `<td class="c-has${upd.has(it.id + d.id) ? ' c-upd' : ''}" title="${upd.has(it.id + d.id) ? 'Update waiting on ' : 'On '}${esc(d.name)}"><i></i></td>` : `<td class="c-add"><button type="button" data-dq-add="${it.id}:${d.id}" aria-label="Add ${esc(it.name)} to ${esc(d.name)}">${ic('plus')}</button></td>`; };
    return intro('Library', 'Everything you have, on every device')
      + `<section class="dq-board"><table><thead><tr><th class="nm">App</th>${ds.map(d => `<th class="${d.id === me ? 'me' : ''}" title="${esc(d.name)}"><i>${ic(formOf(d.form).icon)}</i><small>${esc(d.name)}</small></th>`).join('')}<th class="mt" title="Keep matched">${ic('link')}</th></tr></thead>
        <tbody>${its.map(it => `<tr><td class="nm" data-dq-item="app:${it.id}">${face(it, 'xs')}<b>${esc(it.name)}</b></td>${ds.map(d => cell(it, d)).join('')}<td class="mt"><button class="dq-mt${matched(it) ? ' on' : ''}" type="button" data-dq-match="${it.id}" aria-pressed="${matched(it)}" title="${matched(it) ? 'Matched: on every device that can run it' : 'Keep matched'}">${ic('link')}</button></td></tr>`).join('')}</tbody></table>
        <p class="dq-legend"><span><i class="c-has"></i>Installed</span><span><i class="c-upd"></i>Update waiting</span><span>${ic('plus')}Add</span><span>${ic('minus')}Doesn't run there</span><span>${ic('link')}Matched: on every device that can run it, now and when one joins</span></p></section>`
      + sec(`On ${esc(devOf(me).name)}`, 'Your Looks and Tweaks', `<div class="dq-rows">${[item('look', 'prism'), ...D().tweaks.filter(t => (ST.sent['tweak' + t.id] || t.on || []).includes(me)).map(t => item('tweak', t.id))].map(row).join('')}</div>`); }

  function publish() { const steps = ['Sent', 'Checks', 'Review', 'In Depot'];
    const kinds = [['app', 'An app', 'package', 'A Flatpak, a Luma app, or a .deb or .rpm Luma can run as one'], ['look', 'A Look', 'palette', 'Wallpapers, a theme, icons, sounds, a font or pointers'], ['tweak', 'A Tweak', 'sliders-horizontal', 'A change to how Luma works, listed with the parts it touches']];
    const at = s => s.state === 'live' ? 4 : s.state === 'changes' ? 3 : s.step + 1;
    return intro('Made by you', 'Send what you made to everyone on Luma')
      + `<div class="dq-kinds">${kinds.map(([k, n, i, s]) => `<button class="dq-kind" type="button" data-dq-new="${k}"><i>${ic(i)}</i><b>${n}</b><small>${s}</small><span>Start ${ic('arrow-right')}</span></button>`).join('')}</div>`
      + sec('Yours', 'Sent to Depot', `<div class="dq-subs">${D().mine.map(s => `<div class="dq-sub st-${s.state}"><i class="dq-face glyph sm" style="--h:${s.hue}">${ic(s.icon)}</i><span class="dq-st"><b>${esc(s.name)}</b><small>${esc(s.note)}</small></span>
          <ol class="dq-steps">${steps.map((n, i) => `<li class="${i < at(s) ? 's-done' : ''}${i === at(s) - 1 && s.state !== 'live' ? ' s-now' : ''}${s.state === 'changes' && i === 2 ? ' s-warn' : ''}">${n}</li>`).join('')}</ol></div>`).join('')}</div>`)
      + `<section class="dq-how"><h3>How review works</h3><ol><li><b>Checks, in minutes.</b> Luma signs nothing it can't build and run. It checks the signature, the package and everything the item asks to reach.</li><li><b>Review, for the Verified seal.</b> A person at Luma tries it on a real device and reads what it reaches. Usually two days.</li><li><b>Community, straight away.</b> Skip review and your item goes up signed, with the Community seal and its reach listed.</li></ol></section>`; }

  function search() { const q = ST.q.trim().toLowerCase(); if (!q) return '';
    const hit = it => (it.name + ' ' + it.line + ' ' + it.by).toLowerCase().includes(q);
    const sw = D().switching.find(([n]) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase()));
    const A = D().apps.map(a => item('app', a.id)).filter(it => hit(it) || (it.a.alt || []).some(n => n.toLowerCase().includes(q)));
    const Lk = D().looks.map(l => item('look', l.id)).filter(hit), T = D().tweaks.map(t => item('tweak', t.id)).filter(hit);
    const grp = (n, list) => list.length ? sec('', n, `<div class="dq-rows">${list.slice(0, 8).map(row).join('')}</div>`) : '';
    return `<header class="dq-intro"><h1>“${esc(ST.q.trim())}”</h1></header>` + (sw ? `<aside class="dq-swhit">${ic('arrow-right')}<span><b>${esc(sw[0])}</b> isn't on Luma. These do the same job:</span></aside><div class="dq-rows">${sw[1].map(id => row(item('app', id))).join('')}</div>` : '')
      + grp(sw ? 'More apps' : 'Apps', sw ? A.filter(it => !sw[1].includes(it.id)) : A) + grp('Looks', Lk) + grp('Tweaks', T) + (!sw && !A.length && !Lk.length && !T.length ? `<p class="dq-empty">Nothing called that yet. <button class="dq-link" type="button" data-dq-place="publish">Make it for Luma</button></p>` : ''); }

  /* An item's page */
  function page(it) { if (!it) return ''; const on = onDevices(it), x = it.x, a = it.a;
    const shotsK = a?.shots || [], forms2 = [...new Set(shotsK.map(k => k.includes('-phone-') ? 'phone' : 'desktop'))];
    const shotForm = ST.shotForm && forms2.includes(ST.shotForm) ? ST.shotForm : forms2[0];
    const hero = `<header class="dq-ihero k-${it.kind}" style="--h:${it.hue}">${x?.art ? `<i class="dq-ibg" style="background-image:url(${x.art})"></i>` : ''}
      <div class="dq-iid">${face(it, 'xl')}<span><small>${esc(kindWord(it))}</small><h1>${esc(it.name)}</h1><p>${esc(it.line)}</p><span class="dq-iby">${esc(it.by)} ${seal(it)}</span></span></div>
      ${it.kind === 'look' && (x.art || x.ink || x.kind === 'Theme') ? `<div class="dq-iact"><button class="dq-try" type="button" data-dq-try="${it.id}">Try it here</button></div>` : ''}</header>`;
    const where = `<section class="dq-isec"><h3>Your devices</h3><div class="dq-mydevs">${devs().map(d => { const can = it.runs.includes(d.form), has = on.includes(d.id);
      return `<span class="dq-md ${has ? 'm-has' : can ? 'm-can' : 'm-no'}">${ic(formOf(d.form).icon)}<span><b>${esc(d.name)}</b><small>${has ? (it.kind === 'tweak' ? 'On' : 'Installed') : can ? 'Not yet' : `No ${formOf(d.form).name.toLowerCase()} version`}</small></span></span>`; }).join('')}</div></section>`;
    const shots = shotsK.length ? `<section class="dq-isec"><h3>${forms2.length > 1 ? forms2.map(f => `<button type="button" class="${f === shotForm ? 'on' : ''}" data-dq-shot="${f}">${formOf(f).name}</button>`).join('') : 'Pictures'}</h3><div class="dq-shots f-${shotForm}">${shotsK.filter(k => (k.includes('-phone-') ? 'phone' : 'desktop') === shotForm).map(k => `<img src="apps/depot/shots/${k}.webp" alt="" loading="lazy">`).join('')}</div></section>` : '';
    const lookBig = it.kind === 'look' ? `<section class="dq-isec"><div class="dq-lbig${x.art ? ' pic' : ''}"${x.art ? ` style="background-image:url(${x.art})"` : ''}>${x.art ? '' : lookPreview(x)}</div></section>` : '';
    const changes = it.kind === 'tweak' ? `<section class="dq-isec"><h3>What it changes</h3><div class="dq-chgs">${x.changes.map(c => `<span>${ic('git-branch')}${esc(c)}</span>`).join('')}${x.restart ? `<span class="c-warn">${ic('rotate-ccw')}Needs a restart to turn on and off</span>` : ''}</div><aside class="dq-promise sm">${ic('undo-2')}<span>Switch it off and these go back exactly as they were. Luma keeps your system as it was, beside the changed one.</span></aside></section>` : '';
    const about = a?.desc ? `<section class="dq-isec"><h3>About</h3>${a.desc.map(p => `<p>${esc(p)}</p>`).join('')}</section>` : '';
    const news = a?.news ? `<section class="dq-isec"><h3>What's new <small>${esc(a.news.v)} · ${esc(a.news.date)}</small></h3><ul>${a.news.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>` : '';
    const rating = a?.rating ? `<span><b>${a.rating.avg} ★</b><small>${fmtN(a.rating.n)} ratings</small></span>` : x?.n ? `<span><b>${fmtN(x.n)}</b><small>use it</small></span>` : `<span><b>New</b><small>Not rated yet</small></span>`;
    const facts = `<section class="dq-facts">${rating}<span><b>Runs on</b>${runs(it)}</span><span><b>${esc(D().seals[it.seal].name)}</b><small>${esc(D().seals[it.seal].line)}</small></span>${a ? `<span><b>${esc(PK[a.pk])}</b><small>${esc(a.size || '')}${a.version ? ' · ' + esc(a.version) : ''}</small></span>` : ''}</section>`;
    const reach = a?.reach ? `<section class="dq-isec"><h3>What it can reach</h3><div class="dq-reach">${a.reach.map(([i, w, why]) => `<span>${ic(i)}<span><b>${esc(w)}</b><small>${esc(why)}</small></span></span>`).join('')}</div></section>` : it.kind !== 'app' ? `<section class="dq-isec"><h3>What it can reach</h3><div class="dq-reach"><span>${ic('lock')}<span><b>Nothing of yours</b><small>${it.kind === 'look' ? 'A Look is pictures, sounds and settings. It cannot read your files or the network.' : 'Only the parts it changes, listed above. Not your files, not the network.'}</small></span></span></div></section>` : '';
    return hero + facts + (it.kind === 'look' ? lookBig : shots) + where + changes + news + about + reach; }

  /* ── the sheet: where it goes, the lens, the places, sending something in ── */
  function sheetGet(kind, id) { const it = item(kind, id), on = onDevices(it), lf = lens() === 'any' ? here() : lens();
    ST.picks = new Set(devs().filter(d => it.runs.includes(d.form) && !on.includes(d.id) && (d.id === lf || matched(it))).map(d => d.id));
    if (!ST.picks.size) { const first = devs().find(d => it.runs.includes(d.form) && !on.includes(d.id)); if (first) ST.picks.add(first.id); }
    ST.sheet = { type: 'get', kind, id }; ST.keep = matched(it); sheet(); }
  function sheet() { const s = ST.sheet, el = q$('#dq-sheet'), sc = q$('#dq-scrim'); if (!el) return;
    if (!s) { el.hidden = true; sc.hidden = true; return; } el.hidden = false; sc.hidden = false; el.className = `dq-sheet t-${s.type} m-${mode()}`;
    const dev = (d, attrs, sub, cls, box) => `<button type="button" class="dq-dev ${cls}" ${attrs}><i class="dq-dic">${ic(formOf(d.form)?.icon || 'monitor-smartphone')}</i><span><b>${esc(d.name)}${d.id === here() ? '<em>This one</em>' : ''}</b><small>${sub}</small></span><i class="dq-box">${box ? ic('check') : ''}</i></button>`;
    if (s.type === 'get') { const it = item(s.kind, s.id), on = onDevices(it), n = ST.picks.size;
      el.innerHTML = `<header>${face(it, 'sm')}<span><b>${verb(it)} ${esc(it.name)}</b><small>${it.kind === 'tweak' ? 'Turn it on for' : 'Where should it go?'}</small></span><button class="ib" type="button" data-dq-close aria-label="Close">${ic('x')}</button></header>
        <div class="dq-devs">${devs().map(d => { const can = it.runs.includes(d.form), has = on.includes(d.id), pick = ST.picks.has(d.id);
          return dev(d, can && !has ? `data-dq-pick="${d.id}"` : 'disabled', has ? (it.kind === 'tweak' ? 'Already on' : 'Already installed') : can ? esc(d.note) : `${esc(it.name)} has no ${formOf(d.form).name.toLowerCase()} version`, `${has ? 'd-has' : ''}${can ? '' : ' d-no'}${pick ? ' d-pick' : ''}`, has || pick); }).join('')}</div>
        ${it.kind === 'app' ? `<button class="dq-keep" type="button" data-dq-keep role="switch" aria-checked="${ST.keep}">${ic('link')}<span><b>Keep matched</b><small>Add it to every device that can run it, now and when a new one joins. Same version everywhere.</small></span><i class="dq-sw${ST.keep ? ' on' : ''}"><i></i></i></button>` : ''}
        ${it.kind === 'tweak' && it.x.restart ? `<p class="dq-note">${ic('rotate-ccw')}Each device asks before it restarts.</p>` : ''}
        <footer><button class="dq-act big" type="button" data-dq-confirm ${n ? '' : 'disabled'}>${n ? `${verb(it)} on ${n} device${n > 1 ? 's' : ''}` : 'Pick a device'}</button></footer>`; }
    if (s.type === 'lens') el.innerHTML = `<header><span><b>Show what runs on</b><small>See Depot as that device sees it</small></span><button class="ib" type="button" data-dq-close aria-label="Close">${ic('x')}</button></header>
      <div class="dq-devs">${devs().map(d => dev(d, `data-dq-setlens="${d.id}"`, esc(formOf(d.form).name), lens() === d.id ? 'd-pick' : '', lens() === d.id)).join('')}${dev({ id: 'any', name: 'Any screen', form: '' }, 'data-dq-setlens="any"', 'Everything, whatever it runs on', lens() === 'any' ? 'd-pick' : '', lens() === 'any')}</div>`;
    if (s.type === 'places') el.innerHTML = `<div class="dq-psheet">${navRows(false)}</div>`;
    if (s.type === 'auto') { el.className = `dq-sheet t-get m-${mode()}`; el.innerHTML = `<header><span><b>Automatic updates</b><small>On every device</small></span><button class="ib" type="button" data-dq-close aria-label="Close">${ic('x')}</button></header><div class="dq-auto in">${autoRows()}</div>`; }
    if (s.type === 'new') el.innerHTML = `<header><span><b>Send ${s.kind === 'app' ? 'an app' : s.kind === 'look' ? 'a Look' : 'a Tweak'}</b><small>Drop it here, or point Depot at where it lives</small></span><button class="ib" type="button" data-dq-close aria-label="Close">${ic('x')}</button></header>
      <div class="dq-drop">${ic('upload')}<b>Drop a ${s.kind === 'app' ? '.flatpak, .deb or .rpm' : s.kind === 'look' ? 'folder or .lumalook' : '.lumatweak'}</b><small>or</small><label class="srch">${ic('link')}<input placeholder="https://codeberg.org/you/your-${s.kind}"></label></div>
      <ol class="dq-steps big"><li class="s-done">Sent</li><li>Checks</li><li>Review</li><li>In Depot</li></ol><footer><button class="dq-act big" type="button" data-dq-close>Send for checks</button></footer>`;
    requestAnimationFrame(() => el.classList.add('in')); }
  function closeSheet(quiet) { ST.sheet = null; const el = q$('#dq-sheet'); if (el) { el.classList.remove('in'); el.hidden = true; } const sc = q$('#dq-scrim'); if (sc) sc.hidden = true; if (!quiet) { body(); side(); } }
  function confirm() { const s = ST.sheet, it = item(s.kind, s.id), on = onDevices(it), picks = [...ST.picks]; ST.sent[it.kind + it.id] = [...new Set([...on, ...picks])];
    if (it.kind === 'app') { if (ST.keep && !matched(it)) D().matched.push(it.id); if (!ST.keep && matched(it)) D().matched.splice(D().matched.indexOf(it.id), 1); }
    const away = picks.filter(d => d !== here()).map(d => devOf(d).name), mine = picks.includes(here());
    closeSheet(); K.lToast(W, `${it.name}: ${mine ? (it.kind === 'tweak' ? 'on here' : it.kind === 'look' ? 'in use here' : 'installing here') : ''}${mine && away.length ? ' · ' : ''}${away.length ? 'sent to ' + away.join(', ') : ''}`, { icon: it.kind === 'tweak' ? 'sliders-horizontal' : 'download' }); }

  /* ── trying a Look on this window ── */
  function tryLook(id) { const it = item('look', id); ST.trying = id; const x = it.x;
    if (x.ink) document.querySelector('[data-set-ink="mono"]')?.click();
    else { W.style.setProperty('--dq-try', x.art ? `url(${x.art})` : 'none'); W.style.setProperty('--dq-tryh', x.hue); W.classList.add('dq-trying'); }
    body(); }
  function untry() { const it = ST.trying && item('look', ST.trying); if (it?.x.ink) document.querySelector('[data-set-ink=""]')?.click(); W.classList.remove('dq-trying'); W.style.removeProperty('--dq-try'); ST.trying = null; body(); }
  const tryBanner = () => { const it = item('look', ST.trying); return `<aside class="dq-trybar">${face(it, 'xs')}<span><b>Trying ${esc(it.name)}</b><small>Only this window, until you choose</small></span><button class="dq-act quiet" type="button" data-dq-untry>Undo</button><button class="dq-act" type="button" data-dq-get="look:${it.id}">Use it</button></aside>`; };

  /* ── render and clicks ── */
  function render() { W = document.getElementById('w-depot'); if (!W || !K) return; frame(); const m = mode();
    W.classList.toggle('dq-compact', m === 'compact'); W.classList.toggle('dq-mid', m === 'mid'); W.classList.toggle('dq-wide', m === 'wide');
    lastMode = m; side(); body(); sheet(); }
  const updateOne = (app, d) => { ST.upd[app + d] = 1; };
  function sysRun() { ST.sys = 'run'; body(); setTimeout(() => { ST.sys = 'done'; if (!W.hidden) render(); }, 1800); }
  function click(e) { const t = e.target, h = s => t.closest(s); if (!W || !h('#w-depot')) return false;
    let b;
    if ((b = h('[data-dq-place]'))) { go(b.dataset.dqPlace); return true; }
    if (h('[data-dq-places]')) { ST.sheet = { type: 'places' }; sheet(); return true; }
    if (h('[data-dq-lens]')) { ST.sheet = { type: 'lens' }; sheet(); return true; }
    if ((b = h('[data-dq-setlens]'))) { ST.lens = b.dataset.dqSetlens; if (['library', 'updates', 'publish', 'search'].includes(ST.place) && !ST.item) ST.place = 'apps'; closeSheet(); return true; }
    if (h('[data-dq-close]') || h('#dq-scrim')) { closeSheet(); return true; }
    if ((b = h('[data-dq-pick]'))) { const id = b.dataset.dqPick; ST.picks.has(id) ? ST.picks.delete(id) : ST.picks.add(id); sheet(); return true; }
    if (h('[data-dq-keep]')) { ST.keep = !ST.keep; const it = item(ST.sheet.kind, ST.sheet.id), on = onDevices(it); if (ST.keep) devs().filter(d => it.runs.includes(d.form) && !on.includes(d.id)).forEach(d => ST.picks.add(d.id)); sheet(); return true; }
    if (h('[data-dq-confirm]')) { confirm(); return true; }
    if ((b = h('[data-dq-get]'))) { const [k, id] = b.dataset.dqGet.split(':'); sheetGet(k, id); return true; }
    if ((b = h('[data-dq-toggle]'))) { const id = b.dataset.dqToggle, it = item('tweak', id), on = onDevices(it), me = lens() === 'any' ? here() : lens(); ST.sent['tweak' + id] = on.includes(me) ? on.filter(d => d !== me) : [...on, me]; body();
      K.lToast(W, `${it.name} ${on.includes(me) ? 'is off. Everything it changed is back as it was.' : 'is on' + (me === here() ? '' : ' on ' + devOf(me).name)}`, { icon: on.includes(me) ? 'undo-2' : 'sliders-horizontal' }); return true; }
    if ((b = h('[data-dq-add]'))) { const [id, d] = b.dataset.dqAdd.split(':'), it = item('app', id); ST.sent['app' + id] = [...new Set([...onDevices(it), d])]; body(); K.lToast(W, `${it.name}: ${d === here() ? 'installing here' : 'sent to ' + devOf(d).name}`, { icon: 'download' }); return true; }
    if ((b = h('[data-dq-match]'))) { const id = b.dataset.dqMatch, it = item('app', id), m = D().matched, i = m.indexOf(id); if (i >= 0) m.splice(i, 1); else { m.push(id); ST.sent['app' + id] = devs().filter(d => it.runs.includes(d.form)).map(d => d.id); } body();
      K.lToast(W, i >= 0 ? `${it.name} is no longer matched` : `${it.name} is matched: on every device that can run it`, { icon: 'link' }); return true; }
    if ((b = h('[data-dq-up]'))) { const [app, d] = b.dataset.dqUp.split(':'); updateOne(app, d); render(); K.lToast(W, `${item('app', app).name} updated${d === here() ? '' : ' on ' + devOf(d).name}`, { icon: 'refresh-cw' }); return true; }
    if ((b = h('[data-dq-updev]'))) { const d = b.dataset.dqUpdev; pending().filter(p => p.devs.includes(d)).forEach(p => updateOne(p.app, d)); render(); K.lToast(W, `Updating everything on ${devOf(d).name}`, { icon: 'refresh-cw' }); return true; }
    if (h('[data-dq-upall]')) { pending().forEach(p => p.devs.forEach(d => updateOne(p.app, d))); if (ST.sys === 'ready') sysRun(); render(); K.lToast(W, 'Updating every app on every device. Luma downloads in the background', { icon: 'refresh-cw' }); return true; }
    if (h('[data-dq-sys]')) { if (ST.sys === 'done') { ST.sys = 'restarted'; render(); K.lToast(W, 'Luma restarted into the new version. Your apps came back where you left them', { icon: 'rotate-ccw' }); return true; } if (ST.sys === 'ready') sysRun(); return true; }
    if (h('[data-dq-rollback]')) { K.lConfirm?.(W, { title: 'Go back to Luma 1.0 · nightly October 16?', body: 'Luma restarts into the version you had before. Your files, apps and settings stay as they are.', action: 'Restart', icon: 'undo-2', onOK: () => K.lToast(W, 'Luma will restart into the previous version', { icon: 'undo-2' }) }); return true; }
    if ((b = h('[data-dq-auto]'))) { const k = b.dataset.dqAuto, A = D().auto; A[k] = !A[k]; if (ST.sheet) sheet(); else body(); return true; }
    if (h('[data-dq-autoset]')) { ST.sheet = { type: 'auto' }; sheet(); return true; }
    if ((b = h('[data-dq-toggleopen]'))) { e.preventDefault(); const k = b.dataset.dqToggleopen; ST.open[k] = !ST.open[k]; b.parentElement.open = ST.open[k]; return true; }
    if ((b = h('[data-dq-try]'))) { tryLook(b.dataset.dqTry); return true; }
    if (h('[data-dq-untry]')) { untry(); return true; }
    if ((b = h('[data-dq-chip]'))) { ST.chip = b.dataset.dqChip; body(); q$('#dq-body')?.scrollTo(0, 0); return true; }
    if ((b = h('[data-dq-screen]'))) { const f = b.dataset.dqScreen; ST.lens = devs().find(d => d.form === f)?.id || 'any'; go('apps'); return true; }
    if ((b = h('[data-dq-search]'))) { ST.q = b.dataset.dqSearch; push(); ST.place = 'search'; ST.item = null; render(); return true; }
    if (h('[data-dq-bsearch]')) { ST.searching = true; bar(); return true; }
    if (h('[data-dq-searchx]')) { ST.searching = false; ST.q = ''; if (ST.place === 'search') back(true); render(); return true; }
    if ((b = h('[data-dq-shot]'))) { ST.shotForm = b.dataset.dqShot; body(); return true; }
    if ((b = h('[data-dq-new]'))) { ST.sheet = { type: 'new', kind: b.dataset.dqNew }; sheet(); return true; }
    if (h('[data-dq-share]')) { K.lToast(W, 'Link copied', { icon: 'link' }); return true; }
    if (h('[data-dq-back]')) { back(); return true; }
    if ((b = h('[data-dq-open]'))) { const [k, id] = b.dataset.dqOpen.split(':'), it = item(k, id); if (k === 'app' && it?.a.win && K.open) { K.open(it.a.win); return true; } open(k, id); return true; }
    if ((b = h('[data-dq-item]')) && !h('button:not([data-dq-item])')) { const [k, id] = b.dataset.dqItem.split(':'); open(k, id); return true; }
    return false; }
  const API = { render(k) { if (k) K = k; render(); }, click, go, open: (k, id) => open(k, id), state: ST, sheetGet };
  window.LumaDepotA = API;
  if ((new URLSearchParams(location.search).get('depot') || 'a') === 'a') window.LumaDepot = API;
})();
