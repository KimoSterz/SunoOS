/* ══ Depot C (24 Oct 2026): places, a list, a page ═══════════════════════════════════════════════════════════════
   Depot built the way Suno's own list apps are built (Charlie, Messages, Settings), so a store is as easy to read as
   your mail. Three panes: the places on the ground (Today, Apps, Looks, Tweaks; then Library, Updates, Sent by you),
   the list for the place, and the page for what you picked.

   · Every item's page holds its own devices: one row per device with a switch. Turning a switch on installs it there,
     from wherever you are. The page's one on/off state, Match, keeps it on every device that can run it, now and
     when a new one joins. No dialog, no checklist to fill in: the switches are the checklist.
   · Where it runs is said in words, quietly, under the name ("Every screen", "Desktop only"), never as a row of
     marks. The list's foot narrows the list to what runs on the device in your hand.
   · Updates is a place: Suno first, then each app waiting (with the devices it's waiting on), then Automatic and
     History as rows of their own. Each opens as a page: release notes, devices, Go back.
   · Sent by you is a list of what you made, each with its review as a page; New starts a submission as a page.

   On a phone the list is the screen and a pick pushes its page; Back sits top left, the page's own actions top right.
   A tablet stands all three panes up in landscape; upright, the places become the drawer. ?depot=c */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('depot') !== 'c') return;
  const ST = { place: 'today', sel: {}, stack: [], q: '', scope: 'all', libDev: 'all', pg: false, has: {}, match: null, upd: {}, sys: 'ready', pct: 0, trying: null, mine: null, nk: 'app', nforms: ['desktop', 'tablet'], auto: null, done: null, cat: '' };
  let K = null, W = null, RO = null, lastMode = '';
  const D = () => window.DEPOT_DATA;
  const PLACES = [['today', 'Today', 'sparkles'], ['apps', 'Apps', 'blocks'], ['looks', 'Looks', 'palette'], ['tweaks', 'Tweaks', 'sliders-horizontal']];
  const YOURS = [['library', 'Library', 'layers'], ['updates', 'Updates', 'refresh-cw'], ['sent', 'Sent by you', 'send']];
  const PK = { system: 'Part of Suno', suno: 'Suno app', flatpak: 'Flatpak', deb: 'Universal .deb', rpm: 'Universal .rpm', layered: 'Layered package' };
  const LOOKIC = { Sounds: 'volume-2', Font: 'type', Cursor: 'mouse-pointer-2', Theme: 'palette', Icons: 'blocks', Appearance: 'paintbrush', Wallpaper: 'image' };

  /* ── small parts ── */
  const q$ = s => W && W.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => (K && K.ic(n)) || (() => { const v = (window.__iconBundle || {})[n]; return v ? v.replace(/<!--[\s\S]*?-->/g, '').replace(/stroke-width="[\d.]+"/, 'stroke-width="1.6"').replace(/ width="24"/, '').replace(/ height="24"/, '').replace('<svg', '<svg class="i" aria-hidden="true"') : ''; })();
  const fmtN = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
  const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const forms = () => D().forms, devs = () => D().devices, formOf = id => forms().find(f => f.id === id), devOf = id => devs().find(d => d.id === id);
  const isPhone = () => W?.classList.contains('phone');
  const here = () => !isPhone() ? 'xps' : document.documentElement.dataset.form === 'tablet' ? 'x1' : 'fp6';
  /* wide: three panes · mid: places, then the list or the page · tport: list and page, places in a drawer · phone */
  const mode = () => { if (isPhone()) { const f = document.documentElement.dataset.form; return f === 'tablet' ? (document.documentElement.dataset.o === 'portrait' ? 'tport' : 'wide') : 'phone'; }
    const w = W?.clientWidth || 1200; return w < 640 ? 'phone' : w < 1020 ? 'mid' : 'wide'; };
  const stacked = () => ['phone', 'mid'].includes(mode());
  const list = (a, and = 'and') => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ` ${and} ` + a[a.length - 1];

  /* ── one shape for every kind of thing ── */
  const sealOf = a => a.dev === 'Suno' ? 'suno' : a.verified ? 'verified' : 'community';
  function item(kind, id) {
    if (kind === 'app') { const a = D().apps.find(x => x.id === id); if (!a) return null;
      return { kind, id, key: 'app:' + id, name: a.name, by: a.dev || 'Unknown developer', seal: sealOf(a), line: a.summary || `${D().cats[a.cat]?.name || 'An'} app · ${PK[a.pk]}`, runs: D().runs[id] || ['desktop', 'tablet'], hue: hash(id), a }; }
    const x = (kind === 'look' ? D().looks : D().tweaks).find(v => v.id === id); if (!x) return null;
    return { kind, id, key: kind + ':' + id, name: x.name, by: x.by, seal: x.seal, line: x.line, runs: x.runs, hue: x.hue, x };
  }
  const byKey = k => { const [kind, id] = String(k).split(':'); return ['app', 'look', 'tweak'].includes(kind) ? item(kind, id) : null; };
  const isSystem = it => it.kind === 'app' && it.a.pk === 'system';
  const can = it => devs().filter(d => it.runs.includes(d.form)).map(d => d.id);
  function has(it) { if (ST.has[it.key]) return ST.has[it.key];
    let v; if (it.kind === 'app') v = it.a.dev === 'Suno' ? can(it) : devs().filter(d => (D().installed[d.id] || []).includes(it.id)).map(d => d.id);
    else if (it.kind === 'look') v = it.id === 'prism' ? can(it) : []; else v = [...(it.x.on || [])];
    return (ST.has[it.key] = v); }
  const matched = it => ST.match.has(it.key);
  const runsHere = it => it.runs.includes(devOf(here()).form);
  /* where it runs, in words */
  function runsText(it) { const r = forms().filter(f => it.runs.includes(f.id)).map(f => f.id === 'tv' ? 'TV' : f.name.toLowerCase());
    if (r.length === forms().length) return 'Every screen'; if (r.length === 1) return r[0][0].toUpperCase() + r[0].slice(1) + ' only';
    const s = list(r); return s[0].toUpperCase() + s.slice(1); }
  const kindWord = it => it.kind === 'app' ? (D().cats[it.a.cat]?.name || 'App') : it.x.kind;
  const pending = () => D().pending.map(p => ({ ...p, devs: p.devs.filter(d => !ST.upd[p.app + d]) })).filter(p => p.devs.length);
  const upCount = () => pending().length + (ST.sys === 'restarted' ? 0 : 1);
  const devName = d => d === here() ? 'this ' + (devOf(d).form === 'desktop' ? 'computer' : devOf(d).form) : devOf(d).name;
  const short = id => ({ xps: 'XPS', x1: 'ThinkPad', fp6: 'Fairphone', tv: 'TV', home: 'Kitchen' }[id] || id);

  /* faces: an app's icon or official mark; a Look's own picture; a Tweak's glyph on its hue */
  function face(it, cls = '') {
    if (it.kind === 'app') { const a = it.a;
      if (a.icon) { const src = `${K.A}${a.icon}.svg`; return `<i class="dpc-face ${cls}" style="background-image:url(${document.documentElement.dataset.ink ? src.replace('Suno-v4-', 'Suno-ink-') : src})"></i>`; }
      if (a.mark) return `<i class="dpc-face mark ${cls}" style="--mk:${a.mark.bg}"><img src="apps/depot/marks/${a.mark.file}.svg" alt=""></i>`;
      return `<i class="dpc-face mono ${cls}" style="--h:${it.hue}">${esc(a.name.slice(0, 2))}</i>`; }
    if (it.kind === 'look') { const x = it.x;
      if (x.art) return `<i class="dpc-face pic ${cls}" style="background-image:url(${x.art})"></i>`;
      if (x.swatch) return `<i class="dpc-face sw ${cls}">${x.swatch.map(c => `<b style="background:${c}"></b>`).join('')}</i>`;
      if (x.ink) return `<i class="dpc-face ink ${cls}"><b>Aa</b></i>`;
      return `<i class="dpc-face glyph ${cls}" style="--h:${x.hue}">${ic(LOOKIC[x.kind] || 'palette')}</i>`; }
    return `<i class="dpc-face glyph ${cls}" style="--h:${it.hue}">${ic(it.x.icon)}</i>`;
  }
  const glyph = (icon, hue, cls = '') => `<i class="dpc-face glyph ${cls}" style="--h:${hue}">${ic(icon)}</i>`;
  const sealTag = it => { const s = D().seals[it.seal]; return `<span class="dpc-seal s-${it.seal}">${ic(s.icon)}${esc(s.name)}</span>`; };
  const sw = (on, attr, label, dis) => `<button type="button" class="dpc-swb" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" ${dis ? 'disabled' : attr}><i class="cfsw${on ? ' on' : ''}"></i></button>`;

  /* ── the frame ── */
  function frame() {
    const ib = W.querySelector('.ibody'); if (ib && !ib.dataset.dc) { ib.dataset.dc = 1; W.classList.remove('lsideoff');
      ib.innerHTML = `<nav class="dpside dpc-side" id="dp-side" aria-label="Depot"></nav>
        <section class="dpc-list" id="dpc-list" aria-label="List"><header class="dpc-lhead" id="dpc-lhead"></header><div class="dpc-rows" id="dpc-rows" data-phsc="1"></div><footer class="dpc-lfoot" id="dpc-lfoot"></footer></section>
        <main class="main isle dpc-main" id="dpc-main"><div class="dpc-corner" id="dpc-corner" data-phmv="1"></div><div class="dpc-page" id="dpc-page" data-phsc="1"></div><div class="fbar dpc-bar phnofit" id="dpc-bar" role="toolbar" aria-label="Depot"></div></main>`; }
    W.classList.add('dcwin');
    if (!RO) { RO = new ResizeObserver(() => { const m = mode(); if (m !== lastMode) { lastMode = m; render(); } }); RO.observe(W);
      W.addEventListener('input', e => { if (e.target.id === 'dpc-q') { ST.q = e.target.value; rows(); if (ST.q.trim() && stacked()) { ST.pg = false; layout(); } } });
      document.addEventListener('keydown', e => { if (W.hidden) return;
        if (e.key === 'Escape' && (ST.stack.length || (stacked() && ST.pg))) { back(); e.stopPropagation(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && (K.front?.()?.dataset.app === 'depot' || isPhone())) { e.preventDefault(); if (stacked()) { ST.pg = false; layout(); } q$('#dpc-q')?.focus(); } }, true); }
  }
  /* the title bar: the app and the sidebar button. On a phone it is the top row: Back on a page, and the page's own actions at the right. */
  function top() { const t = q$('#dp-top'); if (!t) return; const m = mode(), onPage = stacked() && ST.pg;
    if (m === 'phone' && onPage) t.innerHTML = `<button class="ib" type="button" data-dpc-back aria-label="Back">${ic('chevron-left')}</button>${corner(true)}`;
    else t.innerHTML = `<img src="${K.A}app-store.svg" alt=""><b>Depot</b>${K.lSideBtn(W)}`; }
  function layout() { const m = mode(); ['wide', 'mid', 'tport', 'phone'].forEach(k => W.classList.toggle('dpc-' + k, m === k)); W.classList.toggle('dpc-onpage', stacked() && ST.pg); top(); corner(); }

  /* ── the places ── */
  function side() { const el = q$('#dp-side'); if (!el) return; const cur = ST.q.trim() ? '' : ST.place, n = upCount();
    const si = (k, label, icon, em = '') => `<button class="si${cur === k ? ' on' : ''}" type="button" data-dpc-place="${k}">${ic(icon)}<span class="lab">${label}</span>${em}</button>`;
    const sys = D().system, st = ST.sys === 'restarted' ? ['ok', 'Suno is up to date'] : ST.sys === 'done' ? ['go', 'Restart to finish updating'] : ST.sys === 'run' ? ['go', `Downloading Suno · ${ST.pct}%`] : ['go', 'A Suno update is ready'];
    el.innerHTML = `<div class="scr">${PLACES.map(([k, l, i]) => si(k, l, i)).join('')}
      ${ST.place === 'apps' && !ST.q.trim() ? `<div class="dpc-cats">${Object.entries(D().cats).map(([k, c]) => `<button class="si dpc-sub${ST.cat === k ? ' on' : ''}" type="button" data-dpc-cat="${k}"><span class="lab">${esc(c.name)}</span></button>`).join('')}</div>` : ''}
      <div class="sh dpsh">Yours</div>${YOURS.map(([k, l, i]) => si(k, l, i, k === 'updates' && n ? K.lCount(n, true) : '')).join('')}</div>
      <button class="dpc-status s-${st[0]}" type="button" data-dpc-place="updates" data-dpc-pick="sys"><i></i><span><b>${esc(st[1])}</b><small>${esc(ST.sys === 'restarted' ? sys.name : sys.running)}</small></span></button>`; }

  /* ── the list ── */
  const row = (it, meta, right = '') => `<button class="dpc-row k-${it.kind}${cur() === it.key ? ' on' : ''}" type="button" data-dpc-pick="${it.key}">${face(it, it.kind === 'look' && it.x.art ? 'wide' : 'sm')}<span class="dpc-rt"><b>${esc(it.name)}</b><small>${esc(it.line)}</small><em>${meta ?? esc(kindWord(it) + ' · ' + runsText(it))}</em></span>${right}</button>`;
  const metaOf = it => { const h = has(it), me = h.includes(here()); return esc(me ? (it.kind === 'tweak' ? 'On here' : it.kind === 'look' ? 'In use here' : 'Installed') + ' · ' + runsText(it) : kindWord(it) + ' · ' + runsText(it)); };
  const lrow = (key, glyphHtml, title, line, meta, right = '') => `<button class="dpc-row${cur() === key ? ' on' : ''}" type="button" data-dpc-pick="${key}">${glyphHtml}<span class="dpc-rt"><b>${title}</b>${line ? `<small>${line}</small>` : ''}${meta ? `<em>${meta}</em>` : ''}</span>${right}</button>`;
  const sh = (t, n) => `<div class="dpc-sh">${t}${n != null ? `<span>${n}</span>` : ''}</div>`;
  const scoped = its => ST.scope === 'here' ? its.filter(runsHere) : its;
  const apps = () => D().apps.map(a => item('app', a.id)).filter(it => it && !isSystem(it));
  /* each place's list: [first pick, html] */
  function listOf(p) {
    if (ST.q.trim()) return search();
    if (p === 'today') { const t = D().today;
      return [`story:0`, t.map((s, i) => storyRow(s, i)).join('')]; }
    if (p === 'apps') { const all = scoped(apps()); let h = '', first = null;
      const add = (title, its) => { if (!its.length) return; first = first || its[0].key; h += sh(title, its.length) + its.map(it => row(it, metaOf(it))).join(''); };
      if (ST.cat) add(D().cats[ST.cat].name, all.filter(it => it.a.cat === ST.cat));
      else { const pop = D().popular.map(id => all.find(it => it.id === id)).filter(Boolean); add('Popular', pop.slice(0, 6)); add('Made by Suno', all.filter(it => it.seal === 'suno'));
        Object.entries(D().cats).forEach(([k, c]) => add(c.name, all.filter(it => it.a.cat === k && it.seal !== 'suno' && !pop.slice(0, 6).includes(it)))); }
      return [first, h || empty()]; }
    if (p === 'looks') { const its = scoped(D().looks.map(l => item('look', l.id))); return [its[0]?.key, its.map(it => row(it, metaOf(it))).join('') || empty()]; }
    if (p === 'tweaks') { const its = scoped(D().tweaks.map(t => item('tweak', t.id))), parts = [...new Set(its.flatMap(it => it.x.changes.slice(0, 1)))];
      return [its[0]?.key, parts.map(pt => sh(esc(pt)) + its.filter(it => it.x.changes[0] === pt).map(it => row(it, metaOf(it))).join('')).join('') || empty()]; }
    if (p === 'library') { const mine = libItems().filter(it => ST.libDev === 'all' || has(it).includes(ST.libDev)); let h = '';
      ['app', 'look', 'tweak'].forEach(k => { const its = mine.filter(it => it.kind === k); if (its.length) h += sh({ app: 'Apps', look: 'Looks', tweak: 'Tweaks' }[k], its.length) + its.map(it => row(it, libMeta(it))).join(''); });
      return [mine[0]?.key, h || `<p class="dpc-empty">Nothing on ${esc(devOf(ST.libDev)?.name || 'it')} yet.</p>`]; }
    if (p === 'updates') { const P = pending(), sys = D().system;
      const sysLine = ST.sys === 'restarted' ? 'Up to date' : ST.sys === 'done' ? 'Ready to restart' : ST.sys === 'run' ? `Downloading · ${ST.pct}%` : `Ready to download · ${sys.size}`;
      return ['sys', lrow('sys', glyph('sparkles', 290, 'sm'), 'Suno', esc(ST.sys === 'restarted' ? sys.name : sys.name.replace('SunoOS 0.1 · ', '')), esc(sysLine), ST.sys === 'restarted' ? '' : '<i class="dpc-dot"></i>')
        + sh('Apps', P.length || null) + (P.map(p => { const it = item('app', p.app); return lrow('up:' + p.app, face(it, 'sm'), esc(it.name), `${esc(p.from)} → ${esc(p.to)}`, esc(list(p.devs.map(short))), '<i class="dpc-dot"></i>'); }).join('') || `<p class="dpc-empty">Every app is up to date, on every device.</p>`)
        + sh('How updates happen') + lrow('auto', glyph('settings-2', 220, 'sm'), 'Automatic updates', esc(ST.auto.apps ? 'Apps update overnight' : 'Apps wait for you'), esc(ST.auto.luma === 'ask' ? 'Suno asks before it restarts' : 'Suno restarts overnight'))
        + lrow('history', glyph('history', 200, 'sm'), 'History', esc(`Last: ${ST.done[0][0] === 'suno' ? 'Suno' : item('app', ST.done[0][0])?.name}, ${ST.done[0][2]}`), '')]; }
    if (p === 'sent') { const S = ST.mine;
      return [S.length ? 'sub:0' : 'new', S.map((s, i) => lrow('sub:' + i, glyph(s.icon, s.hue, 'sm'), esc(s.name), esc({ app: 'App', look: 'Look', tweak: 'Tweak' }[s.kind]), '', `<span class="dpc-state st-${s.state}">${{ review: 'In review', checks: 'Checking', live: 'In Depot', changes: 'Needs changes' }[s.state]}</span>`)).join('')
        + lrow('new', glyph('plus', 250, 'sm dpc-new'), 'Send something new', 'An app, a Look or a Tweak', '')]; }
    return [null, ''];
  }
  const empty = () => `<p class="dpc-empty">Nothing here runs on ${esc(devOf(here()).name)}. <button class="dpc-link" type="button" data-dpc-scope="all">Show everything</button></p>`;
  function storyRow(s, i) { const key = 'story:' + i, on = cur() === key ? ' on' : '';
    const look = s.look && item('look', s.look), tw = s.tweak && item('tweak', s.tweak), a = s.app && item('app', s.app);
    const title = s.title || look?.name || tw?.name, art = s.art || look?.x.art;
    const bg = art ? `<i class="dpc-sart" style="background-image:url(${art})"></i>` : s.kind === 'row' ? `<i class="dpc-sart mosaic">${s.items.slice(0, 6).map(([k, id]) => item(k, id)).filter(Boolean).map(x => face(x, 'xs')).join('')}</i>`
      : `<i class="dpc-sart g-${s.kind}" style="--h:${tw?.hue ?? (s.form === 'tv' ? 250 : s.form === 'home' ? 50 : 200)}">${ic(tw ? tw.x.icon : s.form ? formOf(s.form).icon : 'arrow-right')}</i>`;
    return `<button class="dpc-story${on}" type="button" data-dpc-pick="${key}">${bg}<span><small>${esc(s.kick)}</small><b>${esc(title)}</b></span></button>`; }
  const libItems = () => { const ids = new Set(); devs().forEach(d => (D().installed[d.id] || []).forEach(id => ids.add(id))); ['tide', 'photos', 'messages', 'write', 'notes', 'calendar'].forEach(id => ids.add(id));
    Object.keys(ST.has).forEach(k => { if (k.startsWith('app:') && ST.has[k].length) ids.add(k.slice(4)); });
    const A = [...ids].map(id => item('app', id)).filter(it => it && has(it).length).sort((a, b) => a.name.localeCompare(b.name));
    const L = D().looks.map(l => item('look', l.id)).filter(it => has(it).length), T = D().tweaks.map(t => item('tweak', t.id)).filter(it => has(it).length);
    return [...A, ...L, ...T]; };
  function libMeta(it) { const h = has(it), c = can(it);
    if (matched(it)) return `${ic('link')}Matched · every device that runs it`;
    if (h.length === c.length) return esc(c.length === devs().length ? 'On every device' : c.length === 1 ? 'On ' + short(c[0]) : `On all ${c.length} that can run it`);
    return esc('On ' + list(h.map(short))); }
  function search() { const q = ST.q.trim().toLowerCase(), hit = it => (it.name + ' ' + it.line + ' ' + it.by).toLowerCase().includes(q);
    const swi = D().switching.find(([n]) => n.toLowerCase().includes(q) || (q.length > 3 && q.includes(n.toLowerCase())));
    const altHit = it => (it.a.alt || []).find(n => n.toLowerCase().includes(q));
    const A = apps().filter(it => hit(it) || altHit(it)), Lk = D().looks.map(l => item('look', l.id)).filter(hit), T = D().tweaks.map(t => item('tweak', t.id)).filter(hit);
    const swIts = swi ? swi[1].map(id => item('app', id)).filter(Boolean) : [];
    const rest = A.filter(it => !swIts.some(x => x.id === it.id));
    const altMeta = it => { const n = altHit(it); return swIts.some(x => x.id === it.id) ? esc(kindWord(it) + ' · ' + runsText(it)) : n ? esc(`Instead of ${n} · ${runsText(it)}`) : metaOf(it); };
    const h = (swIts.length ? `<div class="dpc-sh sw">${ic('arrow-right')}<span>Instead of ${esc(swi[0])}</span></div>` + swIts.map(it => row(it, altMeta(it))).join('') : '')
      + (rest.length ? sh(swIts.length ? 'More apps' : 'Apps', rest.length) + rest.map(it => row(it, altMeta(it))).join('') : '')
      + (Lk.length ? sh('Looks', Lk.length) + Lk.map(it => row(it, metaOf(it))).join('') : '') + (T.length ? sh('Tweaks', T.length) + T.map(it => row(it, metaOf(it))).join('') : '');
    const first = (swIts[0] || rest[0] || Lk[0] || T[0])?.key;
    return [first, h || `<div class="dpc-none">${ic('search')}<b>Nothing called “${esc(ST.q.trim())}” yet</b><small>If you make it, it can be here.</small><button class="dpc-well" type="button" data-dpc-place="sent" data-dpc-pick="new">Send something new</button></div>`]; }

  const cur = () => ST.stack.length ? null : ST.sel[ST.q.trim() ? 'search' : ST.place];
  function lhead() { const el = q$('#dpc-lhead'); if (!el) return; const p = ST.place, m = mode();
    const title = ST.q.trim() ? 'Results' : p === 'apps' && ST.cat ? D().cats[ST.cat].name : [...PLACES, ...YOURS].find(x => x[0] === p)[1];
    const sub = ST.q.trim() ? `For “${esc(ST.q.trim())}”` : { today: new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }), apps: ST.cat ? esc(D().cats[ST.cat].about) : 'For every screen you own', looks: 'Change how Suno looks', tweaks: 'Change how Suno works', library: 'What you have, on which device', updates: upCount() ? `${upCount()} waiting` : 'Everything is up to date', sent: 'What you made, and its review' }[p];
    const had = document.activeElement?.id === 'dpc-q';
    el.innerHTML = `<div class="dpc-ltitle">${m === 'tport' ? `<button class="ib" type="button" data-dpc-places aria-label="Places">${ic('panel-left')}</button>` : ''}<span><h2>${esc(title)}</h2><small>${sub}</small></span></div>
      <div class="dpc-find"><label class="srch">${ic('search')}<input id="dpc-q" type="search" placeholder="Search apps, Looks, Tweaks" aria-label="Search Depot" value="${esc(ST.q)}" autocomplete="off" spellcheck="false"></label><button class="dpc-newsq" type="button" data-dpc-newmenu aria-label="Send something new" title="Send something new">${ic('square-pen')}</button></div>`;
    if (had) { const qi = q$('#dpc-q'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } }
  function lfoot() { const el = q$('#dpc-lfoot'); if (!el) return; const p = ST.place;
    const seg = (opts, attr, curV) => `<div class="seg dpc-seg" role="tablist"><i class="ind"></i>${opts.map(([k, l, t]) => `<button type="button" role="tab" class="${curV === k ? 'on' : ''}" ${attr}="${k}"${t ? ` title="${esc(t)}" aria-label="${esc(t)}"` : ''}>${l}</button>`).join('')}</div>`;
    let h = '';
    if (ST.q.trim()) h = '';
    else if (['apps', 'looks', 'tweaks'].includes(p)) h = seg([['all', 'Everything'], ['here', 'Runs on ' + esc(short(here()))]], 'data-dpc-scope', ST.scope);
    else if (p === 'library') h = seg([['all', 'All'], ...devs().map(d => [d.id, ic(formOf(d.form).icon), d.name])], 'data-dpc-libdev', ST.libDev);
    el.innerHTML = h; el.hidden = !h; requestAnimationFrame(() => K.segs?.()); }
  function rows() { const el = q$('#dpc-rows'); if (!el) return; const k = ST.q.trim() ? 'search' : ST.place, [first, h] = listOf(ST.place);
    if (!ST.sel[k] && first && !stacked()) ST.sel[k] = first;
    if (ST.q.trim() && first && !stacked()) ST.sel.search = ST.sel.search && h.includes(`data-dpc-pick="${ST.sel.search}"`) ? ST.sel.search : first;
    el.innerHTML = h; lhead(); lfoot(); side(); page(); }

  /* ── the page ── */
  const view = () => ST.stack.length ? ST.stack[ST.stack.length - 1] : cur();
  function page() { const el = q$('#dpc-page'); if (!el) return; const v = view(), it = byKey(v);
    el.scrollTop = 0; W.style.removeProperty('--dpc-h');
    let h = '';
    if (!v) h = `<div class="dpc-blank">${ic('app-window')}<p>Pick something from the list</p></div>`;
    else if (it) h = itemPage(it);
    else if (v.startsWith('story:')) h = storyPage(+v.slice(6));
    else if (v === 'sys') h = sysPage();
    else if (v.startsWith('up:')) h = upPage(v.slice(3));
    else if (v === 'auto') h = autoPage();
    else if (v === 'history') h = historyPage();
    else if (v.startsWith('sub:')) h = subPage(+v.slice(4));
    else if (v === 'new') h = newPage();
    el.innerHTML = (ST.stack.length || (stacked() && mode() !== 'phone') ? `<button class="dpc-back" type="button" data-dpc-back>${ic('chevron-left')}<span>${esc(backLabel())}</span></button>` : '') + h;
    layout(); bar(); }
  function backLabel() { if (ST.stack.length > 1) return byKey(ST.stack[ST.stack.length - 2])?.name || 'Back';
    if (ST.stack.length) { const c = cur(); if (c?.startsWith('story:')) { const s = D().today[+c.slice(6)]; return s.title || s.kick; } return byKey(c)?.name || [...PLACES, ...YOURS].find(x => x[0] === ST.place)[1]; }
    return ST.q.trim() ? 'Results' : [...PLACES, ...YOURS].find(x => x[0] === ST.place)[1]; }

  /* the subject's own actions, at the page's top right: Share · Match · ··· (on a phone, in the top row) */
  function corner(inTop) { const it = byKey(view()), el = q$('#dpc-corner');
    const h = it && !isSystem(it) ? `<button class="ib" type="button" data-dpc-share aria-label="Share">${ic('share-2')}</button>${it.kind === 'app' ? `<button class="ib dpc-match${matched(it) ? ' lit' : ''}" type="button" data-dpc-match aria-pressed="${matched(it)}" aria-label="Keep matched" title="${matched(it) ? 'Matched: on every device that runs it' : 'Keep matched on every device'}">${ic('link')}</button>` : ''}<button class="ib" type="button" data-dpc-more aria-label="More">${ic('ellipsis')}</button>`
      : view() === 'sys' && ST.sys !== 'restarted' ? `<button class="ib" type="button" data-dpc-sysmore aria-label="More">${ic('ellipsis')}</button>` : '';
    if (inTop) return h ? `<span class="sutopr">${h}</span>` : '';
    if (el) { el.innerHTML = mode() === 'phone' ? '' : h; el.hidden = !h || mode() === 'phone'; } return ''; }

  function itemPage(it) { const x = it.x, a = it.a, h = has(it); W.style.setProperty('--dpc-h', it.hue);
    const facts = [a?.rating ? [`${a.rating.avg} ★`, `${fmtN(a.rating.n)} ratings`] : x?.n ? [fmtN(x.n), 'use it'] : ['New', 'No ratings yet'], [it.runs.length === forms().length ? 'Every screen' : it.runs.length === 1 ? runsText(it) : `${it.runs.length} screens`, it.runs.length === forms().length || it.runs.length === 1 ? 'Where it runs' : runsText(it)], a ? [PK[a.pk], [a.size, a.version].filter(Boolean).join(' · ') || '—'] : [x.kind, it.kind === 'look' ? 'Look' : 'Tweak'], [D().seals[it.seal].name, { suno: 'Made by Suno', verified: 'Reviewed by Suno', community: 'Not reviewed yet' }[it.seal]]];
    const shots = a?.shots?.length ? `<section class="dpc-sec"><h3>Pictures</h3><div class="dpc-shots">${a.shots.map(k => `<img class="${k.includes('-phone-') ? 'ph' : ''}" src="apps/depot/shots/${k}.webp" alt="" loading="lazy">`).join('')}</div></section>` : '';
    const look = it.kind === 'look' ? `<section class="dpc-sec"><div class="dpc-lbig${x.art ? '' : ' none'}" style="${x.art ? `background-image:url(${x.art})` : `--h:${x.hue}`}">${x.art ? '' : lookArt(x)}</div></section>` : '';
    const changes = it.kind === 'tweak' ? `<section class="dpc-sec"><h3>What it changes</h3><div class="dpc-chg">${x.changes.map(c => `<span>${ic('git-branch')}${esc(c)}</span>`).join('')}${x.restart ? `<span class="w">${ic('rotate-ccw')}Restarts to turn on or off</span>` : ''}</div><p class="dpc-fine">${ic('undo-2')}Turn it off and these go back exactly as they were. Suno keeps the system as it was, beside the changed one.</p></section>` : '';
    const news = a?.news ? `<section class="dpc-sec"><h3>What's new <small>${esc(a.news.v)} · ${esc(a.news.date)}</small></h3><ul class="dpc-ul">${a.news.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>` : '';
    const about = a?.desc ? `<section class="dpc-sec"><h3>About</h3>${a.desc.map(p => `<p class="dpc-p">${esc(p)}</p>`).join('')}</section>` : '';
    const reach = a?.reach ? a.reach : it.kind !== 'app' ? [['lock', 'Nothing of yours', `It can't read your files or reach the network`]] : null;
    const reachH = reach ? `<section class="dpc-sec"><h3>What it can reach</h3><div class="dpc-reach">${reach.map(([i, w, why]) => `<span>${ic(i)}<b>${esc(w)}</b><small>${esc(why)}</small></span>`).join('')}</div></section>` : a ? `<section class="dpc-sec"><h3>What it can reach</h3><p class="dpc-p dim">The maker hasn't said. Suno runs it in its own space and asks before it reaches anything of yours.</p></section>` : '';
    const reviews = a?.reviews?.length ? `<section class="dpc-sec"><h3>What people say</h3><div class="dpc-revs">${a.reviews.slice(0, 2).map(([ini, n, s, d, t]) => `<blockquote><p>${esc(t)}</p><footer><i>${esc(ini)}</i>${esc(n)} · ${'★'.repeat(s)} · ${esc(d)}</footer></blockquote>`).join('')}</div></section>` : '';
    return `<article class="dpc-it k-${it.kind}">
      <header class="dpc-hero">${x?.art ? `<i class="dpc-hbg" style="background-image:url(${x.art})"></i>` : ''}${face(it, 'xl')}<span class="dpc-ht"><small>${esc(kindWord(it))}</small><h1>${esc(it.name)}</h1><p>${esc(it.line)}</p><span class="dpc-by">${esc(it.by)}${it.seal === 'community' ? '' : `<i class="dpc-sealic" title="${esc(D().seals[it.seal].line)}">${ic(D().seals[it.seal].icon)}</i>`}</span></span></header>
      <section class="dpc-facts">${facts.map(([b, s]) => `<span><b>${esc(b)}</b><small>${esc(s)}</small></span>`).join('')}</section>
      ${isSystem(it) ? `<p class="dpc-note">${ic('lock')}Part of Suno: on every device, updated with Suno.</p>` : devCard(it)}
      ${look}${changes}${shots}${news}${about}${reviews}${reachH}</article>`; }
  function lookArt(x) { if (x.swatch) return `<span class="dpc-lsw">${x.swatch.map((c, i) => `<i style="background:${c}">${ic(['music', 'image', 'folder-open', 'mail'][i])}</i>`).join('')}</span>`;
    if (x.ink) return `<span class="dpc-ink"><b>Aa</b><i></i><i></i><i></i></span>`;
    if (x.kind === 'Sounds') return `<span class="dpc-wave">${Array.from({ length: 40 }, (_, i) => `<i style="height:${14 + Math.abs(Math.sin(i * 1.7)) * 60}%"></i>`).join('')}</span>`;
    if (x.kind === 'Font') return `<span class="dpc-font">Aa Bb Cc<small>The quick brown fox jumps over the lazy dog</small></span>`;
    if (x.kind === 'Cursor') return `<span class="dpc-cur">${ic('mouse-pointer-2')}${ic('mouse-pointer-2')}${ic('mouse-pointer-2')}</span>`;
    return `<span class="dpc-cur">${ic(LOOKIC[x.kind] || 'palette')}</span>`; }
  /* the devices: one switch each. On installs it there, wherever you are */
  function devCard(it) { const h = has(it), c = can(it), word = it.kind === 'tweak' ? 'On' : it.kind === 'look' ? 'In use' : 'Installed';
    const rowsH = devs().map(d => { const ok = c.includes(d.id), on = h.includes(d.id), asleep = d.form === 'tv';
      const st = !ok ? `No ${d.form === 'tv' ? 'TV' : formOf(d.form).name.toLowerCase()} version` : on ? (asleep && ST.has[it.key] && !(D().installed.tv || []).includes(it.id) && it.kind === 'app' ? 'Installs when it wakes' : word) : asleep ? 'Asleep' : 'Not yet';
      return `<div class="dpc-dev${ok ? '' : ' cant'}"><i class="dpc-dic">${ic(formOf(d.form).icon)}</i><span><b>${esc(d.name)}${d.id === here() ? '<em>This one</em>' : ''}</b><small>${esc(st)}</small></span>${sw(on, `data-dpc-dev="${d.id}"`, `${it.name} on ${d.name}`, !ok || (matched(it) && on))}</div>`; }).join('');
    const of = c.length === devs().length ? `your ${c.length}` : c.length === 1 ? 'the one that can run it' : `the ${c.length} that can run it`;
    const sum = matched(it) ? 'Matched: on every device that runs it, and on any new one' : h.length ? `${it.kind === 'tweak' ? 'On' : word + ' on'} ${h.length === c.length && c.length > 1 ? 'all' : h.length} of ${of}`.replace(/ of the one that can run it$/, '') : `Runs on ${c.length} of your ${devs().length} devices`;
    return `<section class="dpc-sec"><h3>On your devices <small>${esc(sum)}</small></h3><div class="dpc-devs">${rowsH}</div></section>`; }

  function storyPage(i) { const s = D().today[i]; let h = '';
    const card = it => `<button class="dpc-card" type="button" data-dpc-open="${it.key}">${face(it, 'md')}<span><b>${esc(it.name)}</b><small>${esc(it.line)}</small><em>${esc(runsText(it))}</em></span></button>`;
    if (s.kind === 'everywhere') { const it = item('app', s.app);
      h = `<header class="dpc-shero" style="--h:${s.hue}"><i class="dpc-hbg" style="background-image:url(${s.art})"></i><span><small>${esc(s.kick)}</small><h1>${esc(s.title)}</h1><p>${esc(s.blurb)}</p></span></header>
        <section class="dpc-sec"><div class="dpc-cards one">${card(it)}</div></section>
        <section class="dpc-sec"><h3>Where it goes</h3><div class="dpc-screens">${forms().map(f => { const d = devs().find(x => x.form === f.id); return `<span class="${it.runs.includes(f.id) ? '' : 'off'}"><i>${ic(f.icon)}</i><b>${esc(f.name)}</b><small>${esc(d ? d.name : '')}</small></span>`; }).join('')}</div></section>`; }
    else if (s.kind === 'look') { const it = item('look', s.look);
      h = `<header class="dpc-shero tall"><i class="dpc-hbg sharp" style="background-image:url(${it.x.art})"></i><span><small>${esc(s.kick)}</small><h1>${esc(it.name)}</h1><p>${esc(it.line)}</p></span></header><section class="dpc-sec"><div class="dpc-cards one">${card(it)}</div></section>`; }
    else if (s.kind === 'tweak') { const it = item('tweak', s.tweak);
      h = `<header class="dpc-shero" style="--h:${it.hue}"><span><small>${esc(s.kick)}</small><h1>${esc(it.name)}</h1><p>${esc(s.blurb)}</p></span>${face(it, 'xl')}</header><section class="dpc-sec"><div class="dpc-cards one">${card(it)}</div></section>
        <section class="dpc-sec"><h3>What it changes</h3><div class="dpc-chg">${it.x.changes.map(c => `<span>${ic('git-branch')}${esc(c)}</span>`).join('')}</div><p class="dpc-fine">${ic('undo-2')}Turn it off and Suno is exactly as it was.</p></section>`; }
    else if (s.kind === 'switch') h = `<header class="dpc-shero plain"><span><small>${esc(s.kick)}</small><h1>${esc(s.title)}</h1><p>Search knows the names you bring. These do the same jobs, and open the same files.</p></span></header>
        <section class="dpc-sec"><div class="dpc-names">${D().switching.map(([n, ids]) => `<div class="dpc-name"><b>${esc(n)}</b>${ic('arrow-right')}<span>${ids.map(id => item('app', id)).filter(Boolean).map(it => `<button type="button" data-dpc-open="${it.key}">${face(it, 'xs')}${esc(it.name)}</button>`).join('')}</span></div>`).join('')}</div></section>`;
    else if (s.kind === 'screen') { const f = formOf(s.form), its = apps().filter(it => it.runs.includes(s.form)), d = devs().find(x => x.form === s.form);
      h = `<header class="dpc-shero g-${s.form}"><span><small>${esc(s.kick)}</small><h1>${esc(s.title)}</h1><p>${its.length} apps run on a ${esc(s.form === "tv" ? "TV" : f.name.toLowerCase())}${d ? `. Anything you get here can go straight to ${esc(d.name)}` : ''}.</p></span><i class="dpc-sbig">${ic(f.icon)}</i></header>
        <section class="dpc-sec"><div class="dpc-cards">${its.slice(0, 12).map(card).join('')}</div></section>`; }
    else if (s.kind === 'row') h = `<header class="dpc-shero plain"><span><small>${esc(s.kick)}</small><h1>${esc(s.title)}</h1></span></header><section class="dpc-sec"><div class="dpc-cards">${s.items.map(([k, id]) => item(k, id)).filter(Boolean).map(card).join('')}</div></section>`;
    return `<article class="dpc-story-pg">${h}</article>`; }

  /* ── updates ── */
  function sysPage() { const sys = D().system, done = ST.sys === 'restarted';
    const types = ['Feature', 'Improvement', 'Fix', 'Security'], notes = sys.notes || [];
    const devRows = devs().map(d => { const st = done ? 'Up to date' : d.id === here() ? { ready: 'Ready to download', run: `Downloading · ${ST.pct}%`, done: 'Ready to restart' }[ST.sys] : d.form === 'tv' ? 'Asleep · updates overnight' : d.form === 'home' ? 'Updates itself overnight' : 'Ready to download';
      return `<div class="dpc-dev"><i class="dpc-dic">${ic(formOf(d.form).icon)}</i><span><b>${esc(d.name)}${d.id === here() ? '<em>This one</em>' : ''}</b><small>${esc(st)}</small></span></div>`; }).join('');
    return `<article class="dpc-up"><header class="dpc-shero sys"><span><small>Suno · ${esc(sys.channel)}</small><h1>${esc(done ? 'Suno is up to date' : sys.name.replace('SunoOS 0.1 · ', 'SunoOS 0.1, '))}</h1><p>${esc(done ? `You're on ${sys.name}.` : sys.blurb)}</p></span>${glyph('sparkles', 290, 'xl')}</header>
      ${ST.sys === 'run' ? `<div class="dpc-prog"><i style="width:${ST.pct}%"></i></div>` : ST.sys === 'done' ? `<p class="dpc-note go">${ic('rotate-ccw')}Downloaded. Restart when you like: your windows come back where you left them.</p>` : ''}
      ${done ? '' : types.map(t => { const n = notes.filter(x => x[0] === t); return n.length ? `<section class="dpc-sec"><h3><span class="dpc-nt t-${t.toLowerCase()}">${t}</span></h3><div class="dpc-notes">${n.map(([, i, title, d]) => `<div>${ic(i)}<span><b>${esc(title)}</b><small>${esc(d)}</small></span></div>`).join('')}</div></section>` : ''; }).join('')}
      <section class="dpc-sec"><h3>On your devices</h3><div class="dpc-devs">${devRows}</div></section>
      <p class="dpc-fine">${ic('undo-2')}${done ? `Suno kept ${esc(sys.running)}, so you can go back from ··· if anything feels wrong.` : `You're on ${esc(sys.running)}. Suno keeps it after updating, so you can always go back one version.`}</p>
      <p class="dpc-fine">${ic('shield-check')}Signed by Suno, from ${esc(sys.from)}. Checked ${esc(sys.checked)}.</p></article>`; }
  function upPage(app) { const p = pending().find(x => x.app === app), it = item('app', app);
    if (!p) return `<div class="dpc-blank">${ic('circle-check')}<p>${esc(it.name)} is up to date everywhere</p></div>`;
    return `<article class="dpc-up"><header class="dpc-hero">${face(it, 'xl')}<span class="dpc-ht"><small>Update</small><h1>${esc(it.name)} ${esc(p.to)}</h1><p>${esc(p.size)} · you have ${esc(p.from)}</p></span></header>
      <section class="dpc-sec"><h3>What's new</h3><ul class="dpc-ul">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>
      <section class="dpc-sec"><h3>Waiting on</h3><div class="dpc-devs">${p.devs.map(d => `<div class="dpc-dev"><i class="dpc-dic">${ic(formOf(devOf(d).form).icon)}</i><span><b>${esc(devOf(d).name)}${d === here() ? '<em>This one</em>' : ''}</b><small>${devOf(d).form === 'tv' ? 'Asleep · updates when it wakes' : esc(p.from) + ' → ' + esc(p.to)}</small></span><button class="dpc-well sm" type="button" data-dpc-up="${app}:${d}">Update</button></div>`).join('')}</div></section>
      ${matched(it) ? `<p class="dpc-fine">${ic('link')}Matched: every device moves to ${esc(p.to)} together.</p>` : ''}</article>`; }
  function autoPage() { const A = ST.auto;
    const seg = (opts, attr, curV) => `<div class="seg dpc-seg" role="tablist"><i class="ind"></i>${opts.map(([k, l]) => `<button type="button" role="tab" class="${curV === k ? 'on' : ''}" ${attr}="${k}">${l}</button>`).join('')}</div>`;
    return `<article class="dpc-up"><header class="dpc-shero plain"><span><small>Updates</small><h1>Automatic updates</h1><p>Suno keeps apps current while you sleep. It never restarts a device without asking unless you tell it to.</p></span></header>
      <section class="dpc-sec"><h3>Apps</h3><div class="dpc-set"><div><span><b>Update apps automatically</b><small>Overnight, while each device charges</small></span>${sw(A.apps, 'data-dpc-auto="apps"', 'Update apps automatically')}</div>
        ${devs().map(d => `<div class="sub"><i class="dpc-dic">${ic(formOf(d.form).icon)}</i><span><b>${esc(d.name)}</b></span>${sw(A.apps && A.devs[d.id], `data-dpc-autodev="${d.id}"`, d.name, !A.apps)}</div>`).join('')}</div></section>
      <section class="dpc-sec"><h3>Suno</h3><div class="dpc-set"><div><span><b>Download Suno updates</b><small>In the background, on every device</small></span>${sw(A.dl, 'data-dpc-auto="dl"', 'Download Suno updates')}</div>
        <div><span><b>Restart to finish</b><small>${A.luma === 'ask' ? 'Suno asks first, on each device' : 'Overnight, if nothing is open and unsaved'}</small></span>${seg([['ask', 'Ask me'], ['night', 'Overnight']], 'data-dpc-lumaauto', A.luma)}</div></div></section>
      <section class="dpc-sec"><h3>Matched apps</h3><div class="dpc-set"><div><span><b>Keep them on the same version</b><small>A device that wakes catches up before you use it</small></span>${sw(A.matched, 'data-dpc-auto="matched"', 'Keep matched apps on the same version')}</div></div></section></article>`; }
  function historyPage() { const groups = {}; ST.done.forEach(r => (groups[r[2]] = groups[r[2]] || []).push(r));
    return `<article class="dpc-up"><header class="dpc-shero plain"><span><small>Updates</small><h1>History</h1><p>What changed, where, and when. Suno itself can always go back one version.</p></span></header>
      ${Object.entries(groups).map(([when, rs]) => `<section class="dpc-sec"><h3>${esc(when)}</h3><div class="dpc-hist">${rs.map(([id, what, , where]) => { const it = id === 'suno' ? null : item('app', id);
        return `<div>${it ? face(it, 'xs') : glyph('sparkles', 290, 'xs')}<span><b>${it ? esc(it.name) : 'Suno'}</b><small>${esc(what)} · ${esc(where)}</small></span>${id === 'suno' ? `<button class="dpc-link" type="button" data-dpc-rollback>Go back</button>` : ''}</div>`; }).join('')}</div></section>`).join('')}</article>`; }

  /* ── sent by you ── */
  const STEPS = ['Sent', 'Checks', 'Review', 'In Depot'];
  function subPage(i) { const s = ST.mine[i]; if (!s) return '';
    const at = { checks: 1, review: 2, changes: 2, live: 4 }[s.state];
    const when = ['Oct 20', 'Oct 20', s.state === 'live' ? 'Oct 21' : 'Now', s.state === 'live' ? 'Oct 22' : ''];
    return `<article class="dpc-sub"><header class="dpc-hero" style="--h:${s.hue}">${glyph(s.icon, s.hue, 'xl')}<span class="dpc-ht"><small>Your ${esc(s.kind === 'app' ? 'app' : s.kind === 'look' ? 'Look' : 'Tweak')}</small><h1>${esc(s.name)}</h1><p>${esc(s.note)}</p></span></header>
      <section class="dpc-sec"><h3>Review</h3><ol class="dpc-steps">${STEPS.map((n, k) => { const st = k < at || s.state === 'live' ? 'done' : k === at ? (s.state === 'changes' ? 'warn' : 'now') : '';
        return `<li class="s-${st}"><i>${st === 'done' ? ic('check') : st === 'warn' ? ic('circle-alert') : ''}</i><span><b>${n}</b><small>${esc(st === 'done' ? when[k] : st === 'now' ? (k === 2 ? 'A person at Suno is trying it. Usually two days.' : 'Signature, package and what it reaches. A few minutes.') : st === 'warn' ? 'Suno asked for a change' : '')}</small></span></li>`; }).join('')}</ol></section>
      ${s.state === 'changes' ? `<section class="dpc-sec"><h3>From Suno's review</h3><blockquote class="dpc-quote"><p>${esc(s.note)}</p><footer>Suno review · Oct 21</footer></blockquote></section>` : ''}
      ${s.state === 'live' ? `<section class="dpc-facts">${[['1.2k', 'Installs'], ['4.8 ★', '86 ratings'], ['Verified', 'Reviewed by Suno']].map(([b, x]) => `<span><b>${b}</b><small>${x}</small></span>`).join('')}</section>` : ''}</article>`; }
  function newPage() { const k = ST.nk, kinds = [['app', 'An app', 'package'], ['look', 'A Look', 'palette'], ['tweak', 'A Tweak', 'sliders-horizontal']];
    return `<article class="dpc-new"><header class="dpc-shero plain"><span><small>Sent by you</small><h1>Send something new</h1><p>Everyone on Suno can find it. Suno checks it in minutes; for the Verified seal, a person tries it first.</p></span></header>
      <section class="dpc-sec"><div class="dpc-kinds">${kinds.map(([x, n, i]) => `<button type="button" class="${k === x ? 'on' : ''}" data-dpc-nk="${x}">${ic(i)}<b>${n}</b></button>`).join('')}</div></section>
      <section class="dpc-sec"><div class="dpc-drop">${ic('upload')}<b>${{ app: 'Drop a Flatpak, a .deb or an .rpm', look: 'Drop the Look\'s folder or a .lumalook', tweak: 'Drop the Tweak\'s folder or a .lumatweak' }[k]}</b><small>or paste a link to where it lives</small></div></section>
      <section class="dpc-sec"><h3>Name</h3><input class="dpc-in" type="text" placeholder="${{ app: 'Recipe Box', look: 'Studio Morning', tweak: 'Kitchen Timer Tile' }[k]}"></section>
      <section class="dpc-sec"><h3>In one line</h3><input class="dpc-in" type="text" placeholder="What it does, the way you'd say it"></section>
      ${k === 'app' ? `<section class="dpc-sec"><h3>Screens it's made for <small>People see this on its page</small></h3><div class="dpc-forms">${forms().map(f => `<button type="button" class="${ST.nforms.includes(f.id) ? 'on' : ''}" data-dpc-nform="${f.id}">${ic(f.icon)}${esc(f.name)}</button>`).join('')}</div></section>` : ''}
      ${k === 'tweak' ? `<section class="dpc-sec"><h3>What it changes <small>Suno checks this against the package</small></h3><div class="dpc-forms">${['Shelf', 'Windows', 'Lock screen', 'Keyboard', 'Quick Options', 'A system service'].map((c, i) => `<button type="button" class="${i === 4 ? 'on' : ''}" data-dpc-tog>${esc(c)}</button>`).join('')}</div></section>` : ''}
      <p class="dpc-fine">${ic('shield-check')}Suno signs nothing it can't build and run. Community items go live after checks; Verified ones after review.</p></article>`; }

  /* ── the action bar: what you can do on this page ── */
  function bar() { const b = q$('#dpc-bar'); if (!b) return; const v = view(), it = byKey(v); let h = '';
    if (it) { const hv = has(it), me = here(), canHere = runsHere(it), mine = hv.includes(me), x = it.x;
      const missing = can(it).filter(d => !hv.includes(d));
      if (it.kind === 'look' && (x.art || x.ink || x.kind === 'Theme')) h += `<button class="dpc-well" type="button" data-dpc-try>${ic(ST.trying === it.id ? 'x' : 'eye')}${ST.trying === it.id ? 'Stop trying' : 'Try it here'}</button>`;
      if (isSystem(it)) h += `<button class="dpc-key" type="button" data-dpc-openapp="${it.id}">Open</button>`;
      else if (mine && it.kind === 'app') h += (missing.length ? `<button class="dpc-well" type="button" data-dpc-getall>${ic('monitor-smartphone')}Add to ${missing.length === 1 ? esc(devOf(missing[0]).name) : missing.length + ' more'}</button>` : '') + (it.a.win ? `<button class="dpc-key" type="button" data-dpc-openapp="${it.id}">Open</button>` : '');
      else if (mine) h += `<button class="dpc-well" type="button" data-dpc-dev="${me}">${it.kind === 'tweak' ? 'Turn off here' : 'Stop using here'}</button>`;
      else if (canHere) h += `<button class="dpc-key" type="button" data-dpc-dev="${me}">${it.kind === 'tweak' ? 'Turn on' : it.kind === 'look' ? 'Use' : 'Get'}</button>`;
      else if (missing.length) h += `<button class="dpc-key" type="button" data-dpc-dev="${missing[0]}">${it.kind === 'tweak' ? 'Turn on' : it.kind === 'look' ? 'Use' : 'Get'} on ${esc(devOf(missing[0]).name)}</button>`;
    }
    else if (v === 'sys') h = ST.sys === 'restarted' ? `<span class="dpc-said">${ic('circle-check')}Up to date</span>` : ST.sys === 'run' ? `<span class="dpc-said">${ic('download')}Downloading · ${ST.pct}%</span>` : `<button class="dpc-key" type="button" data-dpc-sys>${ST.sys === 'done' ? 'Restart now' : 'Download'}</button>`;
    else if (v?.startsWith('up:')) { const p = pending().find(x => x.app === v.slice(3)); if (p) h = `<button class="dpc-key" type="button" data-dpc-upall="${p.app}">Update on ${p.devs.length === 1 ? esc(devOf(p.devs[0]).name) : p.devs.length + ' devices'}</button>`; }
    else if (v === 'history') h = `<button class="dpc-well" type="button" data-dpc-pickto="auto">${ic('settings-2')}Automatic updates</button>`;
    else if (v?.startsWith('sub:')) { const s = ST.mine[+v.slice(4)]; h = s?.state === 'changes' ? `<button class="dpc-key" type="button" data-dpc-resend>Send a new version</button>` : s?.state === 'live' ? `<button class="dpc-well" type="button" data-dpc-share>${ic('share-2')}Share</button><button class="dpc-key" type="button" data-dpc-resend>Send an update</button>` : `<button class="dpc-well" type="button" data-dpc-withdraw>Withdraw</button>`; }
    else if (v === 'new') h = `<button class="dpc-key" type="button" data-dpc-send>Send for review</button>`;
    else if (v?.startsWith('story:')) { const s = D().today[+v.slice(6)], it2 = s.app ? item('app', s.app) : s.look ? item('look', s.look) : s.tweak ? item('tweak', s.tweak) : null;
      if (it2) h = `<button class="dpc-key" type="button" data-dpc-open="${it2.key}">See ${esc(it2.name)}</button>`; }
    else if (v === 'auto') h = '';
    if (v === 'sys' && ST.sys !== 'restarted' && pending().length) h = `<button class="dpc-well" type="button" data-dpc-everything>Update everything</button>` + h;
    b.innerHTML = h; b.hidden = !h; }

  /* ── doing things ── */
  function setOn(it, d, on) { const h = new Set(has(it)); on ? h.add(d) : h.delete(d); ST.has[it.key] = devs().map(x => x.id).filter(x => h.has(x));
    if (!on && matched(it)) ST.match.delete(it.key); }
  const verbed = (it, on) => it.kind === 'tweak' ? (on ? 'on' : 'off') : it.kind === 'look' ? (on ? 'in use' : 'no longer in use') : (on ? 'installing' : 'removed');
  function refresh(keepPage) { const s = q$('#dpc-page')?.scrollTop || 0; const el = q$('#dpc-rows'), [, h] = listOf(ST.place); if (el) el.innerHTML = h; side(); lhead(); lfoot(); if (keepPage) { page(); q$('#dpc-page').scrollTop = s; } }
  function pick(key) { const k = ST.q.trim() ? 'search' : ST.place; ST.sel[k] = key; ST.stack = []; ST.pg = true;
    q$('#dpc-rows')?.querySelectorAll('[data-dpc-pick]').forEach(r => r.classList.toggle('on', r.dataset.dpcPick === key)); page(); }
  function go(p, sel) { ST.place = p; ST.q = ''; ST.stack = []; if (p !== 'apps') ST.cat = ''; if (sel) { ST.sel[p] = sel; ST.pg = true; } else ST.pg = false; W.classList.remove('navopen', 'dpc-places'); rows(); q$('#dpc-rows')?.scrollTo(0, 0); }
  function back() { if (ST.stack.length) ST.stack.pop(); else ST.pg = false; page(); }
  function untry() { if (!ST.trying) return; ST.trying = null; W.classList.remove('dpc-trying'); W.style.removeProperty('--dpc-try'); }

  function render() { W = document.getElementById('w-depot'); if (!W || !K) return;
    if (!ST.match) { ST.match = new Set(D().matched.map(id => 'app:' + id)); ST.mine = D().mine.map(s => ({ ...s })); ST.done = D().done.map(r => [...r]);
      ST.auto = { apps: D().auto.apps, dl: true, suno: 'ask', matched: D().auto.matched, devs: Object.fromEntries(D().devices.map(d => [d.id, true])) }; }
    frame(); lastMode = mode(); layout(); rows(); }

  function click(e) { const t = e.target, h = s => t.closest(s); if (!W || !h('#w-depot')) return false; let b;
    if ((b = h('[data-dpc-place]'))) { go(b.dataset.dpcPlace, b.dataset.dpcPick); return true; }
    if ((b = h('[data-dpc-cat]'))) { ST.cat = ST.cat === b.dataset.dpcCat ? '' : b.dataset.dpcCat; ST.sel.apps = null; ST.pg = false; rows(); return true; }
    if (h('[data-dpc-places]')) { W.classList.toggle('dpc-places'); return true; }
    if (W.classList.contains('dpc-places') && !h('.dpc-side')) W.classList.remove('dpc-places');
    if ((b = h('[data-dpc-pick]'))) { pick(b.dataset.dpcPick); return true; }
    if ((b = h('[data-dpc-pickto]'))) { pick(b.dataset.dpcPickto); rows(); return true; }
    if ((b = h('[data-dpc-open]'))) { ST.stack.push(b.dataset.dpcOpen); ST.pg = true; page(); return true; }
    if (h('[data-dpc-back]')) { back(); return true; }
    if ((b = h('[data-dpc-scope]'))) { ST.scope = b.dataset.dpcScope; ST.sel[ST.place] = null; rows(); return true; }
    if ((b = h('[data-dpc-libdev]'))) { ST.libDev = b.dataset.dpcLibdev; ST.sel.library = null; rows(); return true; }
    if ((b = h('[data-dpc-dev]'))) { const it = byKey(view()), d = b.dataset.dpcDev; if (!it) return true; const on = !has(it).includes(d); setOn(it, d, on);
      refresh(true); K.lToast(W, `${it.name}: ${verbed(it, on)}${d === here() ? (it.kind === 'app' && on ? '' : ' here') : ' on ' + devOf(d).name}${on && devOf(d).form === 'tv' && it.kind === 'app' ? ', when it wakes' : ''}`, { icon: on ? (it.kind === 'app' ? 'download' : 'check') : 'minus' }); return true; }
    if (h('[data-dpc-getall]')) { const it = byKey(view()), miss = can(it).filter(d => !has(it).includes(d)); miss.forEach(d => setOn(it, d, true)); refresh(true); K.lToast(W, `${it.name}: installing on ${list(miss.map(d => devOf(d).name))}`, { icon: 'download' }); return true; }
    if (h('[data-dpc-match]')) { const it = byKey(view()); if (matched(it)) { ST.match.delete(it.key); K.lToast(W, `${it.name} is no longer matched. It stays where it is`, { icon: 'link' }); }
      else { ST.match.add(it.key); can(it).forEach(d => setOn(it, d, true)); ST.match.add(it.key); K.lToast(W, `${it.name} is matched: on every device that runs it`, { icon: 'link' }); } refresh(true); return true; }
    if (h('[data-dpc-share]')) { const it = byKey(view()); K.lToast(W, `Link to ${it ? it.name : 'it'} copied`, { icon: 'link' }); return true; }
    if ((b = h('[data-dpc-more]'))) { const it = byKey(view()); K.lMenu(b, `${it.kind === 'app' && has(it).length ? `<button class="crmi" type="button" data-dpc-rmall>${ic('trash-2')}Remove from every device</button>` : ''}<button class="crmi" type="button" data-dpc-report>${ic('flag')}Report a problem</button><button class="crmi" type="button" data-dpc-share>${ic('link')}Copy link</button>`); return true; }
    if (h('[data-dpc-rmall]')) { const it = byKey(view()); document.getElementById('lmenu')?.remove(); K.lConfirm(W, { title: `Remove ${it.name} from every device?`, body: 'Its settings stay in your Suno account for 30 days, in case you get it again.', action: 'Remove', icon: 'trash-2', danger: true, onOK: () => { ST.has[it.key] = []; ST.match.delete(it.key); refresh(true); K.lToast(W, `${it.name} removed everywhere`, { icon: 'trash-2' }); } }); return true; }
    if (h('[data-dpc-report]')) { document.getElementById('lmenu')?.remove(); K.lToast(W, 'Thanks. Suno review will look at it', { icon: 'flag' }); return true; }
    if ((b = h('[data-dpc-openapp]'))) { K.open?.(b.dataset.dpcOpenapp); return true; }
    if (h('[data-dpc-try]')) { const it = byKey(view()); if (ST.trying === it.id) untry(); else { ST.trying = it.id; W.classList.add('dpc-trying'); W.style.setProperty('--dpc-try', it.x.art ? `url(${it.x.art})` : 'none'); K.lToast(W, `Trying ${it.name} on this window. Nothing else changes`, { icon: 'eye' }); } bar(); return true; }
    if (h('[data-dpc-newmenu]')) { K.lMenu(h('[data-dpc-newmenu]'), [['app', 'An app', 'package'], ['look', 'A Look', 'palette'], ['tweak', 'A Tweak', 'sliders-horizontal']].map(([k, n, i]) => `<button class="crmi" type="button" data-dpc-newk="${k}">${ic(i)}${n}</button>`).join('')); return true; }
    if ((b = h('[data-dpc-newk]'))) { document.getElementById('lmenu')?.remove(); ST.nk = b.dataset.dpcNewk; go('sent', 'new'); return true; }
    if ((b = h('[data-dpc-nk]'))) { ST.nk = b.dataset.dpcNk; page(); return true; }
    if ((b = h('[data-dpc-nform]'))) { const f = b.dataset.dpcNform, i = ST.nforms.indexOf(f); i < 0 ? ST.nforms.push(f) : ST.nforms.splice(i, 1); b.classList.toggle('on'); return true; }
    if ((b = h('[data-dpc-tog]'))) { b.classList.toggle('on'); return true; }
    if (h('[data-dpc-send]')) { const name = q$('.dpc-new .dpc-in')?.value.trim() || { app: 'Untitled app', look: 'Untitled Look', tweak: 'Untitled Tweak' }[ST.nk];
      ST.mine.unshift({ kind: ST.nk, name, icon: { app: 'package', look: 'palette', tweak: 'sliders-horizontal' }[ST.nk], hue: hash(name), state: 'checks', note: 'Suno is checking the package. A few minutes.' });
      ST.sel.sent = 'sub:0'; ST.pg = true; rows(); K.lToast(W, `${name} sent. Suno is checking it`, { icon: 'send' }); return true; }
    if (h('[data-dpc-resend]')) { const i = +view().slice(4), s = ST.mine[i]; s.state = 'checks'; s.note = 'A new version. Suno is checking it.'; refresh(true); K.lToast(W, `New version of ${s.name} sent`, { icon: 'send' }); return true; }
    if (h('[data-dpc-withdraw]')) { const i = +view().slice(4), s = ST.mine[i]; K.lConfirm(W, { title: `Withdraw ${s.name}?`, body: 'It leaves review. You can send it again whenever you like.', action: 'Withdraw', icon: 'undo-2', onOK: () => { ST.mine.splice(i, 1); ST.sel.sent = null; ST.pg = false; rows(); } }); return true; }
    if ((b = h('[data-dpc-up]'))) { const [app, d] = b.dataset.dpcUp.split(':'); ST.upd[app + d] = 1; ST.done.unshift([app, `${D().pending.find(p => p.app === app).from} → ${D().pending.find(p => p.app === app).to}`, 'Today', devOf(d).name]); refresh(true); K.lToast(W, `${item('app', app).name} updated on ${devOf(d).name}`, { icon: 'refresh-cw' }); return true; }
    if ((b = h('[data-dpc-upall]'))) { const app = b.dataset.dpcUpall, p = pending().find(x => x.app === app); p.devs.forEach(d => { ST.upd[app + d] = 1; }); ST.done.unshift([app, `${p.from} → ${p.to}`, 'Today', p.devs.length > 2 ? 'Every device' : list(p.devs.map(d => devOf(d).name))]); refresh(true); K.lToast(W, `${item('app', app).name} updated on ${p.devs.length} device${p.devs.length > 1 ? 's' : ''}`, { icon: 'refresh-cw' }); return true; }
    if (h('[data-dpc-everything]')) { pending().forEach(p => p.devs.forEach(d => { ST.upd[p.app + d] = 1; ST.done.unshift([p.app, `${p.from} → ${p.to}`, 'Today', devOf(d).name]); })); if (ST.sys === 'ready') sysRun(); refresh(true); K.lToast(W, 'Updating everything, on every device', { icon: 'refresh-cw' }); return true; }
    if (h('[data-dpc-sys]')) { if (ST.sys === 'done') { ST.sys = 'restarted'; ST.done.unshift(['suno', D().system.name, 'Today', 'All devices']); refresh(true); K.lToast(W, 'Suno restarted into the new version. Your windows came back', { icon: 'rotate-ccw' }); } else if (ST.sys === 'ready') sysRun(); return true; }
    if ((b = h('[data-dpc-sysmore]'))) { K.lMenu(b, `<button class="crmi" type="button" data-dpc-rollback>${ic('undo-2')}Go back to ${esc(D().system.running.replace('SunoOS 0.1 · ', ''))}</button><button class="crmi" type="button" data-dpc-pickto="auto">${ic('settings-2')}Automatic updates</button>`); return true; }
    if (h('[data-dpc-rollback]')) { document.getElementById('lmenu')?.remove(); K.lConfirm(W, { title: `Go back to ${D().system.running}?`, body: 'Suno restarts into the version you had before. Your files, apps and settings stay as they are.', action: 'Restart', icon: 'undo-2', onOK: () => K.lToast(W, 'Suno will restart into the previous version', { icon: 'undo-2' }) }); return true; }
    if ((b = h('[data-dpc-auto]'))) { const k = b.dataset.dpcAuto; ST.auto[k] = !ST.auto[k]; refresh(true); return true; }
    if ((b = h('[data-dpc-autodev]'))) { const k = b.dataset.dpcAutodev; ST.auto.devs[k] = !ST.auto.devs[k]; refresh(true); return true; }
    if ((b = h('[data-dpc-lumaauto]'))) { ST.auto.luma = b.dataset.dpcLumaauto; refresh(true); return true; }
    return false; }
  function sysRun() { ST.sys = 'run'; ST.pct = 0; const tick = () => { ST.pct = Math.min(100, ST.pct + 9); if (ST.pct >= 100) ST.sys = 'done'; else setTimeout(tick, 160);
    if (!W.hidden) { side(); const el = q$('#dpc-rows'), [, h] = listOf(ST.place); if (el && ST.place === 'updates' && !ST.q.trim()) el.innerHTML = h; if (view() === 'sys') { const s = q$('#dpc-page').scrollTop; page(); q$('#dpc-page').scrollTop = s; } else bar(); } }; tick(); }

  window.LumaDepot = window.LumaDepotC = { render(k) { if (k) K = k; render(); }, click, state: ST, go, pick, open: key => { ST.stack.push(key); ST.pg = true; page(); } };
})();
