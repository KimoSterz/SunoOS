/* ══ Depot B (24 Oct 2026): one page, your devices ═══════════════════════════════════════════════════════════════
   The other direction to Depot A (depot.js). No places, no sidebar. The person's devices are the store's only
   navigation: they stand in a row at the top, and the page below is about the one you pick, the device you're
   holding to start with. Choosing the TV turns the page into the TV's store, from your phone.

   · One search, "Find something for XPS 14", with the jobs people come for under it (Listen, Watch, Play, Work,
     Create, Talk, and Make it yours for Looks and Tweaks).
   · The page for a device: what's waiting for it (updates, Suno's first), what's on it, what's picked for that
     kind of screen, Looks and Tweaks that fit it.
   · All devices, the last card in the row, is the library: everything you have against where you have it.
   · The action bar is the action centre (SunoUI): tap anything and the bar grows into it in place, with the
     devices to send it to already in it. Nothing opens a page or a dialog over the store.

   Loaded beside depot.js; it is Depot when the simulator is opened with ?depot=b. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('depot') !== 'b') return;
  const ST = { dev: null, q: '', job: '', grown: null, picks: null, keep: false, more: false, sent: {}, upd: {}, sys: 'ready', open: {} };
  let K = null, W = null, RO = null, lastMode = '';
  const D = () => window.DEPOT_DATA;
  const PK = { system: 'Part of Suno', suno: 'Suno app', flatpak: 'Flatpak', deb: 'Universal .deb', rpm: 'Universal .rpm', layered: 'Layered package' };
  const JOBS = [['listen', 'Listen', 'headphones', ['media'], ['tide', 'spotify', 'audacity', 'session']], ['watch', 'Watch', 'clapperboard', ['media'], ['youtube', 'vlc', 'kodi', 'reel', 'photos']], ['play', 'Play', 'gamepad-2', ['play'], []],
    ['work', 'Work', 'briefcase', ['work'], []], ['create', 'Create', 'palette', ['create'], []], ['talk', 'Talk', 'message-circle', [], ['messages', 'signal', 'telegram', 'discord', 'zoom', 'charlie', 'thunderbird']], ['yours', 'Make it yours', 'wand-sparkles', [], []]];

  const q$ = s => W && W.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => (K && K.ic(n)) || (() => { const v = (window.__iconBundle || {})[n]; return v ? v.replace(/<!--[\s\S]*?-->/g, '').replace(/stroke-width="[\d.]+"/, 'stroke-width="1.6"').replace(/ width="24"/, '').replace(/ height="24"/, '').replace('<svg', '<svg class="i" aria-hidden="true"') : ''; })();
  const fmtN = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
  const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const forms = () => D().forms, devs = () => D().devices, formOf = id => forms().find(f => f.id === id), devOf = id => devs().find(d => d.id === id);
  const here = () => { const ph = W?.classList.contains('phone'), f = document.documentElement.dataset.form; return !ph ? 'xps' : f === 'tablet' ? 'x1' : 'fp6'; };
  const dev = () => ST.dev || here();
  const form = () => dev() === 'all' ? null : devOf(dev()).form;
  const mode = () => { const w = W?.clientWidth || 1200; return W?.classList.contains('phone') && document.documentElement.dataset.form !== 'tablet' ? 'compact' : w < 600 ? 'compact' : w < 900 ? 'mid' : 'wide'; };

  const sealOfApp = a => a.dev === 'Suno' ? 'suno' : a.verified ? 'verified' : 'community';
  function item(kind, id) {
    if (kind === 'app') { const a = D().apps.find(x => x.id === id); if (!a) return null;
      return { kind, id, name: a.name, by: a.dev || 'Unknown developer', seal: sealOfApp(a), line: a.summary || `${D().cats[a.cat]?.name || 'An'} app · ${PK[a.pk]}`, runs: D().runs[id] || ['desktop', 'tablet'], hue: hash(id), a }; }
    const x = (kind === 'look' ? D().looks : D().tweaks).find(v => v.id === id); if (!x) return null;
    return { kind, id, name: x.name, by: x.by, seal: x.seal, line: x.line, runs: x.runs, hue: x.hue, x };
  }
  const isSystem = it => it.kind === 'app' && it.a.pk === 'system';
  function onDevices(it) {
    if (ST.sent[it.kind + it.id]) return ST.sent[it.kind + it.id];
    const can = devs().filter(d => it.runs.includes(d.form)).map(d => d.id);
    if (it.kind === 'app') return it.a.dev === 'Suno' ? can : devs().filter(d => (D().installed[d.id] || []).includes(it.id)).map(d => d.id);
    if (it.kind === 'look') return it.id === 'prism' ? can : [];
    return it.x.on || [];
  }
  const fits = it => !form() || it.runs.includes(form());
  const matched = it => D().matched.includes(it.id);
  const pending = d => D().pending.filter(p => p.devs.includes(d) && !ST.upd[p.app + d]);
  const sysWaiting = () => ST.sys !== 'restarted';
  const verb = it => it.kind === 'tweak' ? 'Turn on' : it.kind === 'look' ? 'Use' : 'Get';

  function face(it, cls = '') {
    if (it.kind === 'app') { const a = it.a;
      if (a.icon) { const src = `${K.A}${a.icon}.svg`; return `<i class="db-face ${cls}" style="background-image:url(${document.documentElement.dataset.ink ? src.replace('Suno-v4-', 'Suno-ink-') : src})"></i>`; }
      if (a.mark) return `<i class="db-face mark ${cls}" style="--mk:${a.mark.bg}"><img src="apps/depot/marks/${a.mark.file}.svg" alt=""></i>`;
      return `<i class="db-face mono ${cls}" style="--h:${it.hue}">${esc(a.name.slice(0, 2))}</i>`; }
    if (it.kind === 'look') { const x = it.x;
      if (x.art) return `<i class="db-face pic ${cls}" style="background-image:url(${x.art})"></i>`;
      if (x.swatch) return `<i class="db-face sw ${cls}">${x.swatch.map(c => `<b style="background:${c}"></b>`).join('')}</i>`;
      if (x.ink) return `<i class="db-face ink ${cls}"><b>Aa</b></i>`;
      return `<i class="db-face glyph ${cls}" style="--h:${x.hue}">${ic({ Sounds: 'volume-2', Font: 'type', Cursor: 'mouse-pointer-2', Theme: 'palette', Icons: 'blocks', Appearance: 'paintbrush' }[x.kind] || 'palette')}</i>`; }
    return `<i class="db-face glyph ${cls}" style="--h:${it.hue}">${ic(it.x.icon)}</i>`;
  }
  const runs = it => `<span class="db-runs">${forms().filter(f => it.runs.includes(f.id)).map(f => ic(f.icon)).join('')}</span>`;
  const state = it => { const d = dev(); if (d === 'all') return ''; const on = onDevices(it).includes(d); return on ? `<em class="db-on">${it.kind === 'tweak' ? 'On' : it.kind === 'look' ? 'In use' : 'Installed'}</em>` : ''; };

  /* the frame: the window's own title bar, the page, the bar */
  function frame() {
    const top = q$('#dp-top'); if (top && !top.dataset.db) { top.dataset.db = 1; top.innerHTML = `<img src="${K.A}app-store.svg" alt=""><b>Depot</b>`; }
    const ib = W.querySelector('.ibody'); if (ib && !ib.dataset.db) { ib.dataset.db = 1;
      ib.innerHTML = `<main class="main isle db-main" id="db-main"><div class="scroll" id="db-body"></div><div class="db-scrim" id="db-scrim" hidden></div><div class="fbar db-bar phnofit" id="db-bar" role="toolbar" aria-label="Depot"></div></main>`; }
    W.classList.add('dbwin');
    if (!RO) { RO = new ResizeObserver(() => { const m = mode(); if (m !== lastMode) { lastMode = m; render(); } }); RO.observe(W);
      W.addEventListener('input', e => { if (e.target.id === 'db-q') { ST.q = e.target.value; ST.job = ''; feed(); } });
      document.addEventListener('keydown', e => { if (W.hidden) return; if (e.key === 'Escape' && ST.grown) { shrink(); e.stopPropagation(); } }, true); } }

  /* the row of devices: the store's only navigation */
  function devRow() { const me = here();
    const card = d => { const n = pending(d.id).length + (sysWaiting() ? 1 : 0), asleep = d.form === 'tv';
      return `<button type="button" class="db-dev f-${d.form}${dev() === d.id ? ' on' : ''}" data-db-dev="${d.id}"><i class="db-dic">${ic(formOf(d.form).icon)}</i><span><b>${esc(d.name)}</b><small>${d.id === me ? 'This device' : asleep ? 'Asleep' : formOf(d.form).name}${n ? ` · <em>${n} update${n > 1 ? 's' : ''}</em>` : ''}</small></span></button>`; };
    return `<nav class="db-devs" aria-label="Your devices">${[...devs()].sort((x, y) => (y.id === me) - (x.id === me)).map(card).join('')}<button type="button" class="db-dev all${dev() === 'all' ? ' on' : ''}" data-db-dev="all"><i class="db-dic">${ic('layers')}</i><span><b>All devices</b><small>Everything you have</small></span></button></nav>`; }

  function search() { const d = dev(), name = d === 'all' ? 'any of your devices' : devOf(d).name;
    return `<section class="db-find"><label class="db-q">${ic('search')}<input id="db-q" type="search" placeholder="Find something for ${esc(name)}" value="${esc(ST.q)}" autocomplete="off" spellcheck="false"></label>
      <div class="db-jobs">${JOBS.map(([k, n, i]) => `<button type="button" class="${ST.job === k ? 'on' : ''}" data-db-job="${k}">${ic(i)}${n}</button>`).join('')}</div></section>`; }

  /* ── the page for a device ── */
  const tile = it => `<button type="button" class="db-tile k-${it.kind}" data-db-item="${it.kind}:${it.id}">${face(it, 'lg')}<b>${esc(it.name)}</b><small>${esc(it.line)}</small>${state(it)}</button>`;
  const rowI = it => `<button type="button" class="db-row" data-db-item="${it.kind}:${it.id}">${face(it, 'sm')}<span><b>${esc(it.name)}</b><small>${esc(it.line)}</small></span>${state(it) || runs(it)}</button>`;
  const poster = it => `<button type="button" class="db-poster" data-db-item="${it.kind}:${it.id}" style="--h:${it.hue}">${it.a?.shots?.length ? `<img src="apps/depot/shots/${it.a.shots[0]}.webp" alt="">` : `<i class="db-pbg"></i>`}<span>${face(it, 'sm')}<b>${esc(it.name)}</b>${state(it)}</span></button>`;
  const sec = (title, inner, sub, more) => `<section class="db-sec"><header><span><h3>${title}</h3>${sub ? `<small>${sub}</small>` : ''}</span>${more || ''}</header>${inner}</section>`;
  function updatesCard(d) { const P = pending(d), sys = D().system, n = P.length + (sysWaiting() ? 1 : 0); if (!n) return '';
    return `<section class="db-ups"><header><i>${ic('refresh-cw')}</i><span><b>${n} update${n > 1 ? 's' : ''} waiting${d === here() ? '' : ' for ' + esc(devOf(d).name)}</b><small>${[sysWaiting() ? esc(sys.name) : '', ...P.map(p => esc(item('app', p.app).name))].filter(Boolean).join(' · ')}</small></span><button class="db-act" type="button" data-db-upall="${d}">Update all</button></header>
      <div class="db-uplist">${sysWaiting() ? `<button type="button" class="db-uprow sys" data-db-grow="sys"><i class="db-face glyph sm" style="--h:290">${ic('sparkles')}</i><span><b>Suno</b><small>${esc(sys.name)} · ${esc(sys.size)}</small></span><em>${ST.sys === 'done' ? 'Restart' : ST.sys === 'run' ? 'Downloading…' : "What's new"}</em></button>` : ''}
        ${P.map(p => { const it = item('app', p.app); return `<button type="button" class="db-uprow" data-db-grow="up:${p.app}">${face(it, 'sm')}<span><b>${esc(it.name)}</b><small>${esc(p.from)} → ${esc(p.to)} · ${esc(p.notes[0])}</small></span><em>${esc(p.size)}</em></button>`; }).join('')}</div></section>`; }
  function forDevice() { const d = dev(), f = form(), dv = devOf(d), all = D().apps.map(a => item('app', a.id)).filter(it => it && !isSystem(it));
    const on = all.filter(it => onDevices(it).includes(d)), picks = all.filter(it => it.runs.includes(f) && !onDevices(it).includes(d));
    const look = D().looks.map(l => item('look', l.id)).filter(fits).slice(0, 6), tw = D().tweaks.map(t => item('tweak', t.id)).filter(fits).slice(0, 4);
    const pickTitle = { desktop: 'Picked for your desk', tablet: 'Picked for the couch', phone: 'Picked for your pocket', tv: 'Picked for the big screen', home: 'Glanceable, from across the room' }[f];
    const picksHtml = f === 'tv' ? `<div class="db-posters">${picks.slice(0, 6).map(poster).join('')}</div>` : f === 'home' ? `<div class="db-glance">${picks.slice(0, 6).map(tile).join('')}</div>` : f === 'phone' ? `<div class="db-rows">${picks.slice(0, 8).map(rowI).join('')}</div>` : `<div class="db-tiles">${picks.slice(0, 8).map(tile).join('')}</div>`;
    return updatesCard(d)
      + sec(`On ${esc(dv.name)}`, `<div class="db-shelf">${on.map(it => `<button type="button" class="db-mini" data-db-item="app:${it.id}">${face(it)}<small>${esc(it.name)}</small></button>`).join('')}</div>`, `${on.length} apps`)
      + sec(pickTitle, picksHtml || `<p class="db-empty">You have everything that runs here.</p>`, `What runs on ${esc(dv.name)} and isn't on it yet`)
      + sec('Make it yours', `<div class="db-looks">${look.map(it => `<button type="button" class="db-look" data-db-item="look:${it.id}" style="--h:${it.hue}">${it.x.art ? `<i class="db-lpic" style="background-image:url(${it.x.art})"></i>` : `<i class="db-lpic none">${face(it, 'lg')}</i>`}<span><b>${esc(it.name)}</b><small>${esc(it.x.kind)}</small></span>${state(it)}</button>`).join('')}</div>`, 'Looks change how Suno looks')
      + (tw.length ? sec('Change how it works', `<div class="db-rows">${tw.map(rowI).join('')}</div>`, 'Tweaks. Switch one off and Suno is exactly as it was') : '')
      + `<section class="db-names"><h3>Coming from Windows or a Mac?</h3><div>${D().switching.slice(0, 6).map(([n]) => `<button type="button" data-db-search="${esc(n)}">${esc(n)}</button>`).join('')}</div></section>`
      + `<button type="button" class="db-make" data-db-grow="make"><i>${ic('upload')}</i><span><b>Made something for Suno?</b><small>Send an app, a Look or a Tweak</small></span>${ic('chevron-right')}</button>`; }
  /* All devices: the library */
  function allDevices() { const ds = devs(), ids = new Set(); ds.forEach(d => (D().installed[d.id] || []).forEach(id => ids.add(id))); ['tide', 'photos', 'messages', 'write', 'notes'].forEach(id => ids.add(id)); Object.keys(ST.sent).filter(k => k.startsWith('app')).forEach(k => ids.add(k.slice(3)));
    const its = [...ids].map(id => item('app', id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    const waiting = ds.reduce((n, d) => n + pending(d.id).length, 0);
    return (waiting || sysWaiting() ? `<section class="db-ups"><header><i>${ic('refresh-cw')}</i><span><b>${waiting + (sysWaiting() ? 1 : 0)} updates across your devices</b><small>Suno installs them overnight, or now</small></span><button class="db-act" type="button" data-db-upall="all">Update everything</button></header></section>` : '')
      + sec('Everything you have', `<div class="db-board">${its.map(it => `<button type="button" class="db-brow" data-db-item="app:${it.id}">${face(it, 'xs')}<b>${esc(it.name)}</b><span class="db-bdevs">${ds.map(d => { const can = it.runs.includes(d.form), has = onDevices(it).includes(d.id), up = pending(d.id).some(p => p.app === it.id); return `<i class="${has ? (up ? 'up' : 'has') : can ? 'can' : 'no'}" title="${esc(d.name)}">${ic(formOf(d.form).icon)}</i>`; }).join('')}</span>${matched(it) ? `<em>${ic('link')}Matched</em>` : ''}</button>`).join('')}</div>`, 'Lit where it is installed; blue where an update is waiting'); }
  function results() { const q = ST.q.trim().toLowerCase(), job = JOBS.find(j => j[0] === ST.job);
    let list = [];
    if (job && job[0] === 'yours') list = [...D().looks.map(l => item('look', l.id)), ...D().tweaks.map(t => item('tweak', t.id))];
    else if (job) list = D().apps.map(a => item('app', a.id)).filter(it => it && !isSystem(it) && (job[3].includes(it.a.cat) || job[4].includes(it.id)));
    else { const hit = it => (it.name + ' ' + it.line + ' ' + it.by).toLowerCase().includes(q) || (it.a?.alt || []).some(n => n.toLowerCase().includes(q));
      const sw = D().switching.find(([n]) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase()));
      list = [...(sw ? sw[1].map(id => item('app', id)) : []), ...D().apps.map(a => item('app', a.id)), ...D().looks.map(l => item('look', l.id)), ...D().tweaks.map(t => item('tweak', t.id))].filter((it, i, a) => it && (sw?.[1].includes(it.id) || hit(it)) && a.findIndex(x => x.kind + x.id === it.kind + it.id) === i); }
    const yes = list.filter(fits), no = list.filter(it => !fits(it)), d = dev();
    return `<section class="db-res"><header><h3>${job ? esc(job[1]) : `“${esc(ST.q.trim())}”`}</h3><small>${d === 'all' ? `${yes.length} results` : `${yes.length} for ${esc(devOf(d).name)}`}</small><button class="db-link" type="button" data-db-clear>Clear</button></header><div class="db-rows">${yes.map(rowI).join('') || `<p class="db-empty">Nothing for ${esc(devOf(d)?.name || 'this')} yet.</p>`}</div>
      ${no.length ? `<details class="db-other"><summary>${no.length} more that don't run on ${esc(devOf(d).name)}</summary><div class="db-rows">${no.map(rowI).join('')}</div></details>` : ''}</section>`; }
  function feed() { const el = q$('#db-feed'); if (!el) return; el.innerHTML = ST.q.trim() || ST.job ? results() : dev() === 'all' ? allDevices() : forDevice(); q$('#db-body .db-jobs')?.querySelectorAll('[data-db-job]').forEach(b => b.classList.toggle('on', b.dataset.dbJob === ST.job)); }
  function page() { const el = q$('#db-body'); if (!el) return; const d = dev(), f = form();
    W.dataset.dbForm = f || 'all';
    el.innerHTML = `<div class="db-page">${devRow()}${search()}<div id="db-feed"></div></div>`; feed(); }

  /* ── the bar: idle it is a few keys; tapped, it grows into the thing in place ── */
  function bar() { const b = q$('#db-bar'), sc = q$('#db-scrim'); if (!b) return; const g = ST.grown; sc.hidden = !g; b.classList.toggle('grown', !!g); b.classList.toggle('more', !!(g && ST.more));
    if (!g) { const n = (dev() === 'all' ? devs().reduce((s, d) => s + pending(d.id).length, 0) : pending(dev()).length) + (sysWaiting() ? 1 : 0);
      b.innerHTML = `<button class="ib" type="button" data-db-top aria-label="Search">${ic('search')}</button>${n ? `<button class="db-act bar" type="button" data-db-grow="updates">${ic('refresh-cw')}${n} update${n > 1 ? 's' : ''}</button>` : ''}<button class="db-act bar" type="button" data-db-dev="all">${ic('layers')}All devices</button>`; return; }
    if (g === 'sys') { const sys = D().system;
      b.innerHTML = `<div class="db-gx"><header><i class="db-face glyph sm" style="--h:290">${ic('sparkles')}</i><span><b>${esc(sys.name)}</b><small>Suno · ${esc(sys.size)}</small></span><button class="ib" type="button" data-db-shrink aria-label="Close">${ic('x')}</button></header>
        <ul class="db-notes">${(sys.notes || []).map(([t, i, n, dd]) => `<li><span class="db-nt t-${t.toLowerCase()}">${esc(t)}</span><b>${esc(n)}</b><small>${esc(dd)}</small></li>`).join('')}</ul>
        <p class="db-fine">${ic('undo-2')}You're on ${esc(sys.running)}. Suno keeps it, so you can go back with one click.</p>
        <footer><button class="db-act bar" type="button" data-db-rollback>${ic('undo-2')}Go back</button><button class="db-act bar key" type="button" data-db-sys>${ST.sys === 'done' ? 'Restart now' : ST.sys === 'run' ? 'Downloading…' : 'Download'}</button></footer></div>`; return; }
    if (g === 'updates') { const ds = dev() === 'all' ? devs().map(d => d.id) : [dev()];
      b.innerHTML = `<div class="db-gx"><header><i class="db-face glyph sm" style="--h:250">${ic('refresh-cw')}</i><span><b>Updates</b><small>${dev() === 'all' ? 'Every device' : esc(devOf(dev()).name)}</small></span><button class="ib" type="button" data-db-shrink aria-label="Close">${ic('x')}</button></header>
        <div class="db-uplist">${sysWaiting() ? `<button type="button" class="db-uprow sys" data-db-grow="sys"><i class="db-face glyph sm" style="--h:290">${ic('sparkles')}</i><span><b>Suno</b><small>${esc(D().system.name)}</small></span><em>${ic('chevron-right')}</em></button>` : ''}${ds.flatMap(d => pending(d).map(p => { const it = item('app', p.app); return `<div class="db-uprow">${face(it, 'sm')}<span><b>${esc(it.name)}${ds.length > 1 ? ` <small>· ${esc(devOf(d).name)}</small>` : ''}</b><small>${esc(p.from)} → ${esc(p.to)} · ${esc(p.notes.join('. '))}</small></span><button class="db-act" type="button" data-db-up="${p.app}:${d}">Update</button></div>`; })).join('')}</div>
        <footer><button class="db-act bar" type="button" data-db-auto>${ic('settings-2')}Overnight: ${D().auto.apps ? 'on' : 'off'}</button><button class="db-act bar key" type="button" data-db-upall="${dev()}">Update all</button></footer></div>`; return; }
    if (g === 'make') { b.innerHTML = `<div class="db-gx"><header><i class="db-face glyph sm" style="--h:290">${ic('upload')}</i><span><b>Make for Suno</b><small>Send what you made to everyone on Suno</small></span><button class="ib" type="button" data-db-shrink aria-label="Close">${ic('x')}</button></header>
        <div class="db-kinds">${[['app', 'An app', 'package'], ['look', 'A Look', 'palette'], ['tweak', 'A Tweak', 'sliders-horizontal']].map(([k, n, i]) => `<button type="button" data-db-new="${k}">${ic(i)}<b>${n}</b></button>`).join('')}</div>
        <div class="db-uplist">${D().mine.map(s => `<div class="db-uprow"><i class="db-face glyph sm" style="--h:${s.hue}">${ic(s.icon)}</i><span><b>${esc(s.name)}</b><small>${esc(s.note)}</small></span><em class="st-${s.state}">${{ review: 'In review', live: 'In Depot', changes: 'Needs changes' }[s.state]}</em></div>`).join('')}</div></div>`; return; }
    if (g.startsWith('up:')) { const app = g.slice(3), it = item('app', app), p = D().pending.find(x => x.app === app);
      b.innerHTML = `<div class="db-gx"><header>${face(it, 'sm')}<span><b>${esc(it.name)} ${esc(p.to)}</b><small>${esc(p.size)} · was ${esc(p.from)}</small></span><button class="ib" type="button" data-db-shrink aria-label="Close">${ic('x')}</button></header><ul class="db-notes plain">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        <footer><button class="db-act bar key" type="button" data-db-up="${app}:${dev()}">Update</button></footer></div>`; return; }
    /* an item */
    const [kind, id] = g.split(':'), it = item(kind, id), on = onDevices(it), x = it.x, a = it.a;
    const devChips = devs().map(d => { const can = it.runs.includes(d.form), has = on.includes(d.id), pick = ST.picks.has(d.id);
      return `<button type="button" class="db-chip${has ? ' has' : pick ? ' pick' : ''}${can ? '' : ' no'}" ${can && !has ? `data-db-pick="${d.id}"` : 'disabled'} title="${can ? '' : `No ${formOf(d.form).name.toLowerCase()} version`}">${ic(formOf(d.form).icon)}<span>${esc(d.name)}</span>${has ? ic('check') : pick ? ic('check') : can ? '' : ic('minus')}</button>`; }).join('');
    const n = ST.picks.size, details = ST.more ? `<div class="db-more">${a?.shots?.length ? `<div class="db-shots">${a.shots.map(k => `<img src="apps/depot/shots/${k}.webp" alt="" loading="lazy">`).join('')}</div>` : x?.art ? `<i class="db-lbig" style="background-image:url(${x.art})"></i>` : ''}
      ${kind === 'tweak' ? `<p class="db-chg">${ic('git-branch')}Changes ${x.changes.map(esc).join(' · ')}. Switch it off and they go back exactly as they were.</p>` : ''}${a?.desc ? a.desc.map(p => `<p>${esc(p)}</p>`).join('') : ''}
      ${a?.reach ? `<div class="db-reach">${a.reach.map(([i, w, why]) => `<span>${ic(i)}<b>${esc(w)}</b><small>${esc(why)}</small></span>`).join('')}</div>` : kind !== 'app' ? `<div class="db-reach"><span>${ic('lock')}<b>Nothing of yours</b><small>It can't read your files or the network</small></span></div>` : ''}</div>` : '';
    b.innerHTML = `<div class="db-gx item k-${kind}"><header>${face(it, 'md')}<span><b>${esc(it.name)}</b><small>${esc(it.by)} · ${esc(D().seals[it.seal].name)}${a?.rating ? ` · ${a.rating.avg} ★` : x?.n ? ` · ${fmtN(x.n)} use it` : ''}</small><p>${esc(it.line)}</p></span><button class="ib" type="button" data-db-shrink aria-label="Close">${ic('x')}</button></header>
      ${details}
      ${isSystem(it) ? `<p class="db-fine">${ic('lock')}Part of Suno: on every device, updated with it.</p>` : `<div class="db-where"><small>${kind === 'tweak' ? 'Turn it on for' : 'Send it to'}</small><div class="db-chips">${devChips}</div>${kind === 'app' ? `<button type="button" class="db-keep" data-db-keep>${ic('link')}<span>Keep matched on every device that can run it</span><i class="dq-sw${ST.keep ? ' on' : ''}"><i></i></i></button>` : ''}</div>`}
      <footer><button class="db-act bar" type="button" data-db-more>${ic(ST.more ? 'chevron-down' : 'info')}${ST.more ? 'Less' : 'More'}</button>${kind === 'app' && on.includes(here()) && a.win ? `<button class="db-act bar" type="button" data-db-open="${id}">Open</button>` : ''}${isSystem(it) ? '' : `<button class="db-act bar key" type="button" data-db-confirm ${n ? '' : 'disabled'}>${n ? `${verb(it)} on ${n === 1 ? esc(devOf([...ST.picks][0]).name) : n + ' devices'}` : on.length ? `On ${on.length} device${on.length > 1 ? 's' : ''}` : 'Pick a device'}</button>`}</footer></div>`; }
  function grow(g) { ST.grown = g; ST.more = false;
    if (g && g.includes(':') && !g.startsWith('up:')) { const [k, id] = g.split(':'), it = item(k, id), on = onDevices(it), target = dev() === 'all' ? here() : dev();
      ST.picks = new Set(devs().filter(d => it.runs.includes(d.form) && !on.includes(d.id) && (d.id === target || matched(it))).map(d => d.id)); ST.keep = matched(it); }
    bar(); }
  function shrink() { ST.grown = null; ST.more = false; bar(); }

  function render() { W = document.getElementById('w-depot'); if (!W || !K) return; frame(); const m = mode();
    W.classList.toggle('db-compact', m === 'compact'); W.classList.toggle('db-mid', m === 'mid'); lastMode = m; page(); bar(); }
  function click(e) { const t = e.target, h = s => t.closest(s); if (!W || !h('#w-depot')) return false; let b;
    if ((b = h('[data-db-dev]'))) { ST.dev = b.dataset.dbDev; ST.q = ''; ST.job = ''; shrink(); page(); q$('#db-body')?.scrollTo({ top: 0, behavior: 'smooth' }); return true; }
    if ((b = h('[data-db-job]'))) { ST.job = ST.job === b.dataset.dbJob ? '' : b.dataset.dbJob; ST.q = ''; const qi = q$('#db-q'); if (qi) qi.value = ''; feed(); return true; }
    if ((b = h('[data-db-search]'))) { ST.q = b.dataset.dbSearch; ST.job = ''; const qi = q$('#db-q'); if (qi) qi.value = ST.q; feed(); q$('#db-body')?.scrollTo({ top: 0, behavior: 'smooth' }); return true; }
    if (h('[data-db-clear]')) { ST.q = ''; ST.job = ''; page(); return true; }
    if (h('[data-db-top]')) { shrink(); q$('#db-body')?.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => q$('#db-q')?.focus(), 250); return true; }
    if (h('[data-db-shrink]') || h('#db-scrim')) { shrink(); return true; }
    if ((b = h('[data-db-grow]'))) { grow(b.dataset.dbGrow); return true; }
    if ((b = h('[data-db-item]'))) { grow(b.dataset.dbItem); return true; }
    if ((b = h('[data-db-pick]'))) { const id = b.dataset.dbPick; ST.picks.has(id) ? ST.picks.delete(id) : ST.picks.add(id); bar(); return true; }
    if (h('[data-db-keep]')) { ST.keep = !ST.keep; const [k, id] = ST.grown.split(':'), it = item(k, id), on = onDevices(it); if (ST.keep) devs().filter(d => it.runs.includes(d.form) && !on.includes(d.id)).forEach(d => ST.picks.add(d.id)); bar(); return true; }
    if (h('[data-db-more]')) { ST.more = !ST.more; bar(); return true; }
    if ((b = h('[data-db-open]'))) { K.open?.(b.dataset.dbOpen); return true; }
    if (h('[data-db-confirm]')) { const [k, id] = ST.grown.split(':'), it = item(k, id), picks = [...ST.picks]; ST.sent[k + id] = [...new Set([...onDevices(it), ...picks])];
      if (k === 'app') { const m = D().matched, i = m.indexOf(id); if (ST.keep && i < 0) m.push(id); if (!ST.keep && i >= 0) m.splice(i, 1); }
      shrink(); feed(); K.lToast(W, `${it.name}: ${picks.map(d => d === here() ? (k === 'app' ? 'installing here' : 'on here') : devOf(d).name).join(', ')}`, { icon: k === 'tweak' ? 'sliders-horizontal' : 'download' }); return true; }
    if ((b = h('[data-db-up]'))) { const [app, d] = b.dataset.dbUp.split(':'); ST.upd[app + d] = 1; if (ST.grown?.startsWith('up:')) shrink(); else bar(); page(); K.lToast(W, `${item('app', app).name} updated${d === here() ? '' : ' on ' + devOf(d).name}`, { icon: 'refresh-cw' }); return true; }
    if ((b = h('[data-db-upall]'))) { const v = b.dataset.dbUpall, ds = v === 'all' ? devs().map(d => d.id) : [v]; ds.forEach(d => pending(d).forEach(p => { ST.upd[p.app + d] = 1; })); if (ST.sys === 'ready') sysRun(); shrink(); page(); K.lToast(W, v === 'all' ? 'Updating everything on every device' : `Updating everything on ${devOf(v).name}`, { icon: 'refresh-cw' }); return true; }
    if (h('[data-db-sys]')) { if (ST.sys === 'done') { ST.sys = 'restarted'; shrink(); page(); K.lToast(W, 'Suno restarted into the new version. Your apps came back where you left them', { icon: 'rotate-ccw' }); } else if (ST.sys === 'ready') sysRun(); return true; }
    if (h('[data-db-rollback]')) { K.lConfirm?.(W, { title: `Go back to ${D().system.running}?`, body: 'Suno restarts into the version you had before. Your files, apps and settings stay as they are.', action: 'Restart', icon: 'undo-2', onOK: () => K.lToast(W, 'Suno will restart into the previous version', { icon: 'undo-2' }) }); return true; }
    if (h('[data-db-auto]')) { D().auto.apps = !D().auto.apps; bar(); return true; }
    if ((b = h('[data-db-new]'))) { K.lToast(W, 'Drop a file on Depot, or paste a link to where it lives', { icon: 'upload' }); return true; }
    return false; }
  function sysRun() { ST.sys = 'run'; bar(); feed(); setTimeout(() => { ST.sys = 'done'; if (!W.hidden) { bar(); feed(); } }, 1800); }
  window.LumaDepot = window.LumaDepotB = { render(k) { if (k) K = k; render(); }, click, state: ST, grow, dev: d => { ST.dev = d; page(); bar(); } };
})();
