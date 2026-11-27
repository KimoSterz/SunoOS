/* ══ Depot D (24 Oct 2026): your Suno ═════════════════════════════════════════════════════════════════════════════
   You don't install things on a device. You add them to your Suno, and every device you own takes what it can run,
   now and when a new one joins (Suno Connect). Depot shows the two halves of that side by side: your Suno on the
   left, the world on the right.

   · The sidebar is your library: Discover, Updates and Your Suno at the top, then everything you have (apps, Looks,
     Tweaks, what you made), narrowed to one device from its header. Search and New at its foot, as in every app.
   · Discover is drawn by screen, not by mark: shelves For your desk, For your pocket, For the living room, For the
     kitchen. Apps, Looks and Tweaks are views at the page's top right; Tweaks are found by the part of Suno they
     change.
   · An item's page shows your devices as devices, with the app on each screen where it's installed. Add grows the
     action bar into the checklist, every device that can run it already ticked, Keep matched on.
   · Your Suno draws each device's own home screen in miniature: what is where, at a glance.
   · Updates is one page: Suno first, then each app with the devices it's waiting on, then how it happens, then
     what happened.
   · New (the sidebar's square) grows the bar into a submission; what you made is in the sidebar with its review.

   On a phone the library is the drawer and search sits in the bar. ?depot=d */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('depot') !== 'd') return;
  const ST = { page: 'discover', view: 'foryou', item: null, back: [], q: '', libDev: 'all', part: '', lkind: '', cat: '', has: {}, match: null, upd: {}, sys: 'ready', pct: 0, grown: null, picks: null, keep: true, mine: null, auto: null, done: null, nk: 'app', nforms: ['desktop', 'tablet'], trying: null, sub: null };
  let K = null, W = null, RO = null, lastMode = '';
  const D = () => window.DEPOT_DATA;
  const PK = { system: 'Part of Suno', suno: 'Suno app', flatpak: 'Flatpak', deb: 'Universal .deb', rpm: 'Universal .rpm', layered: 'Layered package' };
  const LOOKIC = { Sounds: 'volume-2', Font: 'type', Cursor: 'mouse-pointer-2', Theme: 'palette', Icons: 'blocks', Appearance: 'paintbrush', Wallpaper: 'image' };
  const SHELF = { desktop: ['For your desk', 'monitor'], phone: ['For your pocket', 'smartphone'], tablet: ['For the sofa', 'tablet'], tv: ['For the living room', 'tv'], home: ['For the kitchen', 'house'] };
  const WALL = { xps: '../wallpapers/prism.png', x1: '../wallpapers/blue-fog.png', fp6: '../wallpapers/ember.png', tv: '../wallpapers/suno-creatives.png', home: '../wallpapers/meadow.png' };

  /* ── small parts ── */
  const q$ = s => W && W.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => (K && K.ic(n)) || (() => { const v = (window.__iconBundle || {})[n]; return v ? v.replace(/<!--[\s\S]*?-->/g, '').replace(/stroke-width="[\d.]+"/, 'stroke-width="1.6"').replace(/ width="24"/, '').replace(/ height="24"/, '').replace('<svg', '<svg class="i" aria-hidden="true"') : ''; })();
  const fmtN = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
  const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const forms = () => D().forms, devs = () => D().devices, formOf = id => forms().find(f => f.id === id), devOf = id => devs().find(d => d.id === id);
  const isPhone = () => W?.classList.contains('phone');
  const here = () => !isPhone() ? 'xps' : document.documentElement.dataset.form === 'tablet' ? 'x1' : 'fp6';
  const mode = () => { if (isPhone()) return document.documentElement.dataset.form === 'tablet' ? 'tablet' : 'phone'; const w = W?.clientWidth || 1200; return w < 640 ? 'phone' : w < 980 ? 'mid' : 'wide'; };
  const list = (a, and = 'and') => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ` ${and} ` + a[a.length - 1];
  const short = id => ({ xps: 'XPS', x1: 'ThinkPad', fp6: 'Fairphone', tv: 'TV', home: 'Kitchen' }[id] || id);
  const fname = f => f === 'tv' ? 'TV' : formOf(f).name.toLowerCase();

  /* ── one shape for every kind of thing ── */
  const sealOf = a => a.dev === 'Suno' ? 'suno' : a.verified ? 'verified' : 'community';
  function item(kind, id) {
    if (kind === 'app') { const a = D().apps.find(x => x.id === id); if (!a) return null;
      return { kind, id, key: 'app:' + id, name: a.name, by: a.dev || 'Unknown developer', seal: sealOf(a), line: a.summary || `${D().cats[a.cat]?.name || 'An'} app · ${PK[a.pk]}`, runs: D().runs[id] || ['desktop', 'tablet'], hue: hash(id), a }; }
    const x = (kind === 'look' ? D().looks : D().tweaks).find(v => v.id === id); if (!x) return null;
    return { kind, id, key: kind + ':' + id, name: x.name, by: x.by, seal: x.seal, line: x.line, runs: x.runs, hue: x.hue, x };
  }
  const byKey = k => { const [kind, id] = String(k).split(':'); return item(kind, id); };
  const isSystem = it => it.kind === 'app' && it.a.pk === 'system';
  const can = it => devs().filter(d => it.runs.includes(d.form)).map(d => d.id);
  function has(it) { if (ST.has[it.key]) return ST.has[it.key];
    let v; if (it.kind === 'app') v = it.a.dev === 'Suno' ? can(it) : devs().filter(d => (D().installed[d.id] || []).includes(it.id)).map(d => d.id);
    else if (it.kind === 'look') v = it.id === 'prism' ? can(it) : []; else v = [...(it.x.on || [])];
    return (ST.has[it.key] = v); }
  const matched = it => ST.match.has(it.key);
  const yourDevs = it => { const c = can(it); return c.length === devs().length ? 'all your devices' : c.length ? list(c.map(short)) : 'none of your devices'; };
  const verb = it => it.kind === 'tweak' ? 'Turn on' : it.kind === 'look' ? 'Use' : 'Add';
  const word = it => it.kind === 'tweak' ? 'On' : it.kind === 'look' ? 'In use' : 'Installed';
  const kindWord = it => it.kind === 'app' ? (D().cats[it.a.cat]?.name || 'App') : it.x.kind;
  const pending = () => D().pending.map(p => ({ ...p, devs: p.devs.filter(d => !ST.upd[p.app + d]) })).filter(p => p.devs.length);
  const upCount = () => pending().length + (ST.sys === 'restarted' ? 0 : 1);
  const apps = () => D().apps.map(a => item('app', a.id)).filter(it => it && !isSystem(it));

  function face(it, cls = '') {
    if (it.kind === 'app') { const a = it.a;
      if (a.icon) { const src = `${K.A}${a.icon}.svg`; return `<i class="dpd-face ${cls}" style="background-image:url(${document.documentElement.dataset.ink ? src.replace('Suno-v4-', 'Suno-ink-') : src})"></i>`; }
      if (a.mark) return `<i class="dpd-face mark ${cls}" style="--mk:${a.mark.bg}"><img src="apps/depot/marks/${a.mark.file}.svg" alt=""></i>`;
      return `<i class="dpd-face mono ${cls}" style="--h:${it.hue}">${esc(a.name.slice(0, 2))}</i>`; }
    if (it.kind === 'look') { const x = it.x;
      if (x.art) return `<i class="dpd-face pic ${cls}" style="background-image:url(${x.art})"></i>`;
      if (x.swatch) return `<i class="dpd-face sw ${cls}">${x.swatch.map(c => `<b style="background:${c}"></b>`).join('')}</i>`;
      if (x.ink) return `<i class="dpd-face ink ${cls}"><b>Aa</b></i>`;
      return `<i class="dpd-face glyph ${cls}" style="--h:${x.hue}">${ic(LOOKIC[x.kind] || 'palette')}</i>`; }
    return `<i class="dpd-face glyph ${cls}" style="--h:${it.hue}">${ic(it.x.icon)}</i>`;
  }
  const glyph = (icon, hue, cls = '') => `<i class="dpd-face glyph ${cls}" style="--h:${hue}">${ic(icon)}</i>`;
  const sw = (on, attr, label, dis) => `<button type="button" class="dpd-swb" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" ${dis ? 'disabled' : attr}><i class="cfsw${on ? ' on' : ''}"></i></button>`;
  const seg = (opts, attr, curV, cls = '') => `<div class="seg dpd-seg ${cls}" role="tablist"><i class="ind"></i>${opts.map(([k, l, t]) => `<button type="button" role="tab" class="${curV === k ? 'on' : ''}" ${attr}="${k}"${t ? ` title="${esc(t)}" aria-label="${esc(t)}"` : ''}>${l}</button>`).join('')}</div>`;

  /* a device, drawn as itself, with what's on its screen */
  const device = (d, inner, cls = '') => `<span class="dpd-dv f-${d.form} ${cls}"><i class="dpd-scr">${inner || ''}</i></span>`;

  /* ── the frame ── */
  function frame() {
    const ib = W.querySelector('.ibody'); if (ib && !ib.dataset.dpd) { ib.dataset.dpd = 1; W.classList.remove('lsideoff');
      ib.innerHTML = `<nav class="dpside dpd-side" id="dp-side" aria-label="Your Suno"></nav>
        <main class="main isle dpd-main" id="dpd-main"><div class="dpd-corner" id="dpd-corner" data-phmv="1"></div><div class="dpd-body" id="dpd-body" data-phsc="1"></div><div class="dpd-scrim" id="dpd-scrim" hidden></div><div class="fbar dpd-bar phnofit" id="dpd-bar" role="toolbar" aria-label="Depot"></div></main>`; }
    W.classList.add('ddwin');
    if (!RO) { RO = new ResizeObserver(() => { const m = mode(); if (m !== lastMode) { lastMode = m; render(); } }); RO.observe(W);
      W.addEventListener('input', e => { if (e.target.id === 'dpd-q' || e.target.id === 'dpd-bq') { ST.q = e.target.value; if (ST.q.trim()) { if (ST.page !== 'search' || ST.item) { ST.back.push(snap()); ST.page = 'search'; ST.item = null; } } else if (ST.page === 'search') back(true); body(); if (e.target.id === 'dpd-q') side(); else { const qi = q$('#dpd-bq'); qi?.focus(); qi?.setSelectionRange(qi.value.length, qi.value.length); } } });
      document.addEventListener('keydown', e => { if (W.hidden) return;
        if (e.key === 'Escape') { if (ST.grown) { shrink(); e.stopPropagation(); } else if (ST.back.length && !e.target.closest('input')) { back(); e.stopPropagation(); } }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && (K.front?.()?.dataset.app === 'depot' || isPhone())) { e.preventDefault(); q$(mode() === 'phone' ? '#dpd-bq' : '#dpd-q')?.focus(); } }, true); }
  }
  const snap = () => ({ page: ST.page, view: ST.view, item: ST.item, sub: ST.sub, q: ST.q });
  function top() { const t = q$('#dp-top'); if (!t) return; const deep = mode() === 'phone' && ST.back.length && ST.page !== 'search' || mode() === 'phone' && ST.item;
    t.innerHTML = deep ? `<button class="ib" type="button" data-dpd-back aria-label="Back">${ic('chevron-left')}</button>${corner(true)}` : `<img src="${K.A}app-store.svg" alt=""><b>Depot</b>${K.lSideBtn(W)}`; }

  /* ── the sidebar: your Suno ── */
  function libItems() { const ids = new Set(); devs().forEach(d => (D().installed[d.id] || []).forEach(id => ids.add(id))); ['tide', 'photos', 'messages', 'write', 'notes', 'calendar'].forEach(id => ids.add(id));
    Object.keys(ST.has).forEach(k => { if (k.startsWith('app:') && ST.has[k].length) ids.add(k.slice(4)); });
    const A = [...ids].map(id => item('app', id)).filter(it => it && has(it).length).sort((a, b) => a.name.localeCompare(b.name));
    return [...A, ...D().looks.map(l => item('look', l.id)).filter(it => has(it).length), ...D().tweaks.map(t => item('tweak', t.id)).filter(it => has(it).length)]
      .filter(it => ST.libDev === 'all' || has(it).includes(ST.libDev)); }
  function side() { const el = q$('#dp-side'); if (!el) return; const pg = ST.page, n = upCount(), mine = libItems(), sel = ST.item;
    const si = (k, l, i, em = '') => `<button class="si${pg === k && !ST.item ? ' on' : ''}" type="button" data-dpd-page="${k}">${ic(i)}<span class="lab">${l}</span>${em}</button>`;
    const lrow = it => { const up = it.kind === 'app' && pending().some(p => p.app === it.id); return `<button class="si dpd-lib${sel === it.key ? ' on' : ''}" type="button" data-dpd-item="${it.key}">${face(it, 'xs')}<span class="lab">${esc(it.name)}</span>${up ? '<i class="dpd-dot" title="Update waiting"></i>' : matched(it) ? `<i class="dpd-mk" title="Matched">${ic('link')}</i>` : ''}</button>`; };
    const A = mine.filter(it => it.kind === 'app' && it.seal !== 'suno'), AL = mine.filter(it => it.kind === 'app' && it.seal === 'suno'), LT = mine.filter(it => it.kind !== 'app'), dv = ST.libDev === 'all' ? null : devOf(ST.libDev);
    const had = document.activeElement?.id === 'dpd-q', sc = el.querySelector('.scr')?.scrollTop || 0;
    el.innerHTML = `<div class="scr">${si('discover', 'Discover', 'compass')}${si('updates', 'Updates', 'refresh-cw', n ? K.lCount(n, true) : '')}${si('suno', 'Your Suno', 'layers')}
      <div class="sh dpsh dpd-libh"><span>${dv ? `On ${esc(dv.name)}` : 'Everything you have'}</span><button class="ib" type="button" data-dpd-libmenu aria-label="Show what's on one device" title="Show what's on one device">${ic(dv ? formOf(dv.form).icon : 'monitor-smartphone')}</button></div>
      ${A.map(lrow).join('') || `<p class="dpd-sempty">Nothing added on ${esc(dv?.name || 'it')} yet</p>`}
      ${AL.length ? `<button class="si dpd-lib dpd-lumarow" type="button" data-dpd-lumaapps aria-expanded="${!!ST.lumaOpen}"><img src="assets/Suno-favicon.svg" alt=""><span class="lab">Suno's apps</span><em>${AL.length}</em>${ic(ST.lumaOpen ? 'chevron-down' : 'chevron-right')}</button>${ST.lumaOpen ? AL.map(lrow).join('') : ''}` : ''}
      ${LT.length ? `<div class="sh">Looks and Tweaks</div>${LT.map(lrow).join('')}` : ''}
      <div class="sh">Made by you</div>${ST.mine.map((s, i) => `<button class="si dpd-lib${ST.page === 'sub' && ST.sub === i && !ST.item ? ' on' : ''}" type="button" data-dpd-sub="${i}">${glyph(s.icon, s.hue, 'xs')}<span class="lab">${esc(s.name)}</span><i class="dpd-st st-${s.state}" title="${{ review: 'In review', checks: 'Checking', live: 'In Depot', changes: 'Needs changes' }[s.state]}"></i></button>`).join('')}</div>
      <div class="shead sfoot dpfoot"><label class="srch">${ic('search')}<input id="dpd-q" type="search" placeholder="Search Depot" aria-label="Search Depot" value="${esc(ST.q)}" autocomplete="off" spellcheck="false"></label><button class="dpd-newsq" type="button" data-dpd-newmenu aria-label="Send something new" title="Send something new">${ic('square-pen')}</button></div>`;
    el.querySelector('.scr').scrollTop = sc;
    if (had) { const qi = q$('#dpd-q'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } }

  /* ── the page ── */
  function body() { const el = q$('#dpd-body'); if (!el) return; const it = ST.item && byKey(ST.item);
    W.style.removeProperty('--dpd-h'); el.scrollTop = 0;
    const backBtn = ST.back.length && mode() !== 'phone' ? `<button class="dpd-back" type="button" data-dpd-back>${ic('chevron-left')}<span>Back</span></button>` : '';
    el.innerHTML = backBtn + (it ? itemPage(it) : ({ discover, updates, suno, search, sub: subPage })[ST.page]());
    W.classList.toggle('dpd-onitem', !!it); W.classList.toggle('dpd-ondisc', !it && ST.page === 'discover'); W.classList.toggle('dpd-hasback', !!backBtn); corner(); top(); bar(); requestAnimationFrame(() => K.segs?.()); }

  /* the page's top right: the views of Discover, or an item's Share · Match · ··· */
  function corner(inTop) { const el = q$('#dpd-corner'), it = ST.item && byKey(ST.item); let h = '';
    if (it && !isSystem(it)) h = `<button class="ib" type="button" data-dpd-share aria-label="Share">${ic('share-2')}</button>${it.kind === 'app' ? `<button class="ib dpd-match${matched(it) ? ' lit' : ''}" type="button" data-dpd-match aria-pressed="${matched(it)}" aria-label="Keep matched" title="${matched(it) ? 'Matched: on every device that runs it' : 'Keep matched on every device'}">${ic('link')}</button>` : ''}<button class="ib" type="button" data-dpd-more aria-label="More">${ic('ellipsis')}</button>`;
    else if (!it && ST.page === 'discover') h = seg([['foryou', 'For you'], ['apps', 'Apps'], ['looks', 'Looks'], ['tweaks', 'Tweaks']], 'data-dpd-view', ST.view, 'dpd-views');
    if (inTop) return h && it ? `<span class="sutopr">${h}</span>` : '';
    if (el) { const ph = mode() === 'phone' && it; el.innerHTML = ph ? '' : h; el.hidden = !h || ph; el.classList.toggle('views', !it); } return ''; }

  /* Discover: by screen, not by mark */
  function discover() { return ({ foryou, apps: appsView, looks: looksView, tweaks: tweaksView })[ST.view](); }
  const tile = it => `<button class="dpd-tile" type="button" data-dpd-item="${it.key}">${face(it, 'lg')}<b>${esc(it.name)}</b><small>${esc(it.line)}</small></button>`;
  const cardRow = it => `<button class="dpd-crow" type="button" data-dpd-item="${it.key}">${face(it, 'md')}<span><b>${esc(it.name)}</b><small>${esc(it.line)}</small></span>${has(it).includes(here()) ? `<em>${word(it)}</em>` : ''}</button>`;
  const head = (t, s) => `<header class="dpd-head"><h1>${t}</h1>${s ? `<p>${s}</p>` : ''}</header>`;
  function foryou() { const t = D().today, hero = t[0], hi = item('app', hero.app), lk = item('look', t[1].look), tw = item('tweak', t[2].tweak), all = apps();
    const shelves = ['desktop', 'phone', 'tv', 'home'].map(f => { const d = devs().find(x => x.form === f), its = all.filter(it => it.runs.includes(f) && !has(it).includes(d.id)).sort((a, b) => (b.a.rating?.n || 0) - (a.a.rating?.n || 0)).slice(0, 8);
      return its.length ? `<section class="dpd-shelf f-${f}"><header><i>${ic(SHELF[f][1])}</i><span><h2>${SHELF[f][0]}</h2><small>Runs on ${esc(d.name)}${d.id === here() ? ', this one' : ''}</small></span></header><div class="dpd-tiles">${its.map(tile).join('')}</div></section>` : ''; }).join('');
    return head('Discover', new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }))
      + `<section class="dpd-hero" data-dpd-item="${hi.key}" role="button" tabindex="0"><i class="dpd-hbg" style="background-image:url(${hero.art})"></i><div><small>${esc(hero.kick)}</small><h2>${esc(hero.title)}</h2><p>${esc(hero.blurb)}</p>
          <span class="dpd-hdevs">${devs().filter(d => hi.runs.includes(d.form)).map(d => device(d, face(hi, 'xs'), 'sm')).join('')}<small>On all five of your screens</small></span></div></section>
        <div class="dpd-duo"><article class="dpd-story look" data-dpd-item="${lk.key}" role="button" tabindex="0" style="background-image:url(${lk.x.art})"><div><small>${esc(t[1].kick)}</small><h3>${esc(lk.name)}</h3><p>${esc(lk.line)}</p></div></article>
          <article class="dpd-story tweak" data-dpd-item="${tw.key}" role="button" tabindex="0" style="--h:${tw.hue}"><div><small>${esc(t[2].kick)}</small>${face(tw, 'lg')}<h3>${esc(tw.name)}</h3><p>${esc(t[2].blurb)}</p></div></article></div>
        ${shelves}
        <section class="dpd-names"><h2>Coming from Windows or a Mac?</h2><p>Type the name you know. These do the same jobs.</p><div>${D().switching.map(([n, ids]) => `<button type="button" data-dpd-search="${esc(n)}"><b>${esc(n)}</b><span>${ids.slice(0, 3).map(id => item('app', id)).filter(Boolean).map(it => face(it, 'xs')).join('')}</span></button>`).join('')}</div></section>`; }
  function appsView() { const cats = D().cats, all = apps(), vis = ST.cat ? all.filter(it => it.a.cat === ST.cat) : all;
    return head('Apps', 'For every screen you own')
      + `<div class="dpd-cats">${Object.entries(cats).map(([k, c]) => `<button type="button" class="dpd-cat${ST.cat === k ? ' on' : ''}" data-dpd-cat="${k}" style="--h:${c.hue}">${ic(c.icon)}<b>${esc(c.name)}</b><small>${esc(c.about)}</small></button>`).join('')}</div>`
      + (ST.cat ? '' : `<h2 class="dpd-h2">Made by Suno</h2><div class="dpd-grid">${all.filter(it => it.seal === 'suno').slice(0, 12).map(cardRow).join('')}</div><h2 class="dpd-h2">From everyone else</h2>`)
      + `<div class="dpd-grid">${(ST.cat ? vis : vis.filter(it => it.seal !== 'suno')).map(cardRow).join('')}</div>`; }
  function looksView() { const kinds = [...new Set(D().looks.map(l => l.kind))], its = D().looks.map(l => item('look', l.id)).filter(it => !ST.lkind || it.x.kind === ST.lkind);
    return head('Looks', 'Change how Suno looks. Try one on this window first.')
      + `<div class="dpd-chips">${[['', 'All'], ...kinds.map(k => [k, k])].map(([k, n]) => `<button type="button" class="${ST.lkind === k ? 'on' : ''}" data-dpd-lkind="${k}">${esc(n)}</button>`).join('')}</div>`
      + `<div class="dpd-looks">${its.map(it => `<button class="dpd-look" type="button" data-dpd-item="${it.key}" style="--h:${it.hue}"><i class="dpd-lpic${it.x.art ? '' : ' none'}"${it.x.art ? ` style="background-image:url(${it.x.art})"` : ''}>${it.x.art ? '' : lookArt(it.x)}</i><span><b>${esc(it.name)}</b><small>${esc(it.x.kind)} · ${esc(it.by)}</small></span>${has(it).includes(here()) ? `<em>In use</em>` : ''}</button>`).join('')}</div>`; }
  function lookArt(x) { if (x.swatch) return `<span class="dpd-lsw">${x.swatch.map((c, i) => `<i style="background:${c}">${ic(['music', 'image', 'folder-open', 'mail'][i])}</i>`).join('')}</span>`;
    if (x.ink) return `<span class="dpd-ink"><b>Aa</b><i></i><i></i><i></i></span>`;
    if (x.kind === 'Sounds') return `<span class="dpd-wave">${Array.from({ length: 36 }, (_, i) => `<i style="height:${14 + Math.abs(Math.sin(i * 1.7)) * 60}%"></i>`).join('')}</span>`;
    if (x.kind === 'Font') return `<span class="dpd-font">Aa<small>The quick brown fox</small></span>`;
    if (x.kind === 'Cursor') return `<span class="dpd-cur">${ic('mouse-pointer-2')}${ic('mouse-pointer-2')}${ic('mouse-pointer-2')}</span>`;
    return `<span class="dpd-cur">${ic(LOOKIC[x.kind] || 'palette')}</span>`; }
  /* Tweaks, found by the part of Suno they change */
  const PARTS = [['Shelf', 'panel-bottom'], ['Windows', 'app-window'], ['Lock screen', 'lock'], ['Keyboard', 'keyboard'], ['Touchpad', 'mouse-pointer-2'], ['Charging', 'power'], ['Quick Options', 'toggle-right'], ['A system service', 'cpu']];
  function tweaksView() { const T = D().tweaks.map(t => item('tweak', t.id)), parts = PARTS.map(([p, i]) => [p, i, T.filter(it => it.x.changes.includes(p))]).filter(x => x[2].length), vis = ST.part ? T.filter(it => it.x.changes.includes(ST.part)) : T;
    return head('Tweaks', 'Change how Suno works. Turn one off and Suno is exactly as it was.')
      + `<div class="dpd-parts">${parts.map(([p, i, its]) => `<button type="button" class="${ST.part === p ? 'on' : ''}" data-dpd-part="${esc(p)}"><i>${ic(i)}</i><b>${esc(p === 'A system service' ? 'System' : p)}</b><small>${its.length} tweak${its.length > 1 ? 's' : ''}</small></button>`).join('')}</div>`
      + `<div class="dpd-tweaks">${vis.map(it => { const on = has(it).includes(here()); return `<div class="dpd-tw" data-dpd-item="${it.key}" role="button" tabindex="0">${face(it, 'md')}<span><b>${esc(it.name)}</b><small>${esc(it.line)}</small><em>${ic('git-branch')}Changes ${it.x.changes.map(esc).join(' · ')}</em></span>${it.runs.includes(devOf(here()).form) ? sw(on, `data-dpd-twon="${it.id}"`, it.name) : `<small class="dpd-nofit">Not for ${esc(fname(devOf(here()).form))}</small>`}</div>`; }).join('')}</div>`; }

  /* an item: your devices first, drawn as devices */
  function itemPage(it) { const x = it.x, a = it.a, h = has(it), c = can(it); W.style.setProperty('--dpd-h', it.hue);
    const banner = a ? '' : x?.art ? `<i class="dpd-ibimg" style="background-image:url(${x.art})"></i>` : `<i class="dpd-ibimg none${it.kind === 'look' ? '' : ' short'}">${it.kind === 'look' ? lookArt(x) : ''}</i>`;
    const devRow = devs().map(d => { const ok = c.includes(d.id), on = h.includes(d.id);
      return `<button type="button" class="dpd-idev${on ? ' on' : ''}${ok ? '' : ' cant'}" ${ok && !isSystem(it) ? `data-dpd-toggle="${d.id}"` : 'disabled'} aria-pressed="${on}">${device(d, on ? face(it, 'sm') : `<b>${ic(ok ? 'plus' : 'minus')}</b>`)}<span><b>${esc(d.name)}</b><small>${!ok ? `No ${fname(d.form)} version` : on ? (d.form === 'tv' && ST.has[it.key] && it.kind === 'app' && !(D().installed.tv || []).includes(it.id) && it.a.dev !== 'Suno' ? 'When it wakes' : word(it)) : d.form === 'tv' ? 'Asleep' : 'Not yet'}</small></span></button>`; }).join('');
    const facts = [a?.rating ? [`${a.rating.avg} ★`, `${fmtN(a.rating.n)} ratings`] : x?.n ? [fmtN(x.n), 'use it'] : ['New', 'No ratings yet'], [D().seals[it.seal].name, { suno: 'Made by Suno', verified: 'Reviewed by Suno', community: 'Signed, not reviewed' }[it.seal]], a ? [a.size || '—', [PK[a.pk], a.version].filter(Boolean).join(' · ')] : [x.kind, it.kind === 'look' ? 'A Look' : 'A Tweak']];
    const reach = a?.reach || (it.kind !== 'app' ? [['lock', 'Nothing of yours', `It can't read your files or reach the network`]] : null);
    const title = isSystem(it) ? 'Part of Suno, on every device' : matched(it) ? 'Matched across your Suno' : h.length ? `${word(it)} on ${h.length} of your devices` : `Runs on ${yourDevs(it)}`;
    return `<article class="dpd-it k-${it.kind}"><header class="dpd-ihead${banner ? '' : ' plain'}">${banner}<div class="dpd-iid">${face(it, 'xl')}<span><small>${esc(kindWord(it))}</small><h1>${esc(it.name)}</h1><p>${esc(it.line)}</p><em>${esc(it.by)}${it.seal !== 'community' ? `<i class="dpd-sealic">${ic(D().seals[it.seal].icon)}</i>` : ''}</em></span></div></header>
      <section class="dpd-isec"><h2>${esc(title)}</h2><div class="dpd-idevs">${devRow}</div></section>
      <div class="dpd-icols"><div>
        ${it.kind === 'tweak' ? `<section class="dpd-isec"><h2>What it changes</h2><div class="dpd-chg">${x.changes.map(cg => `<span>${ic('git-branch')}${esc(cg)}</span>`).join('')}${x.restart ? `<span class="w">${ic('rotate-ccw')}Restarts to turn on or off</span>` : ''}</div><p class="dpd-fine">${ic('undo-2')}Turn it off and these go back exactly as they were. Suno keeps the system as it was, beside the changed one.</p></section>` : ''}
        ${a?.news ? `<section class="dpd-isec"><h2>What's new <small>${esc(a.news.v)} · ${esc(a.news.date)}</small></h2><ul class="dpd-ul">${a.news.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>` : ''}
        ${a?.desc ? `<section class="dpd-isec"><h2>About</h2>${a.desc.map(p => `<p class="dpd-p">${esc(p)}</p>`).join('')}</section>` : `<section class="dpd-isec"><h2>About</h2><p class="dpd-p">${esc(it.line)}.${a && !a.desc ? ` ${esc(it.by)} hasn't written more yet.` : ''}</p></section>`}
        ${a?.shots?.length ? `<section class="dpd-isec"><h2>Pictures</h2><div class="dpd-shots">${a.shots.map(k => `<img class="${k.includes('-phone-') ? 'ph' : ''}" src="apps/depot/shots/${k}.webp" alt="" loading="lazy">`).join('')}</div></section>` : ''}
        ${a?.reviews?.length ? `<section class="dpd-isec"><h2>What people say</h2>${a.reviews.slice(0, 2).map(([ini, n, s, d, t]) => `<blockquote class="dpd-rev"><p>${esc(t)}</p><footer><i>${esc(ini)}</i>${esc(n)} · ${'★'.repeat(s)} · ${esc(d)}</footer></blockquote>`).join('')}</section>` : ''}
      </div><aside class="dpd-facts">${facts.map(([b, s]) => `<div><b>${esc(b)}</b><small>${esc(s)}</small></div>`).join('')}
        <div class="dpd-reach"><small class="dpd-k">What it can reach</small>${reach ? reach.map(([i, w, why]) => `<span>${ic(i)}<span><b>${esc(w)}</b><small>${esc(why)}</small></span></span>`).join('') : `<span>${ic('shield-check')}<span><b>Not listed</b><small>Suno runs it in its own space and asks first</small></span></span>`}</div></aside></div></article>`; }

  /* Your Suno: each device's own home screen, in miniature */
  function suno() { const ds = devs();
    const ORDER = ['xps', 'fp6', 'tv', 'home', 'x1'];
    const appsOn = d => apps().concat(D().apps.filter(a => a.pk === 'system').map(a => item('app', a.id))).filter(it => has(it).includes(d.id)).sort((a, b) => (b.seal === 'suno') - (a.seal === 'suno'));
    return head('Your Suno', `${ds.length} devices, kept in step by Suno Connect. Add something once and every device that can run it gets it.`)
      + `<div class="dpd-homes">${[...ds].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)).map(d => { const its = appsOn(d), n = pending().filter(p => p.devs.includes(d.id)).length, cap = { desktop: 18, tablet: 15, phone: 12, tv: 6, home: 6 }[d.form];
        return `<section class="dpd-home f-${d.form}"><header><i>${ic(formOf(d.form).icon)}</i><span><b>${esc(d.name)}${d.id === here() ? ' <em>This one</em>' : ''}</b><small>${its.length} apps${n ? ` · ${n} update${n > 1 ? 's' : ''}` : ''}${d.form === 'tv' ? ' · asleep' : ''}</small></span></header>
          <div class="dpd-hscr" style="background-image:url(${WALL[d.id]})"><div class="dpd-hgrid">${its.slice(0, cap).map(it => `<button type="button" data-dpd-item="${it.key}" title="${esc(it.name)}">${face(it, d.form === 'tv' ? 'tvt' : 'hs')}${d.form === 'tv' || d.form === 'home' ? `<small>${esc(it.name)}</small>` : ''}</button>`).join('')}${its.length > cap ? `<span class="dpd-hmore">+${its.length - cap}</span>` : ''}</div></div></section>`; }).join('')}</div>`
      + `<section class="dpd-isec"><h2>Matched</h2><p class="dpd-p">${ST.match.size ? `${list([...ST.match].map(k => byKey(k)?.name).filter(Boolean))} ${ST.match.size > 1 ? 'are' : 'is'} on every device that can run ${ST.match.size > 1 ? 'them' : 'it'}, and will be on the next one you sign in to.` : 'Nothing is matched yet.'}</p></section>`; }

  /* Updates: Suno first, then apps, then how, then what happened */
  function updates() { const sys = D().system, P = pending(), A = ST.auto, done = ST.sys === 'restarted';
    const notes = (sys.notes || []).map(([t, i, n, d]) => `<li><span class="dpd-nt t-${t.toLowerCase()}">${esc(t)}</span><span><b>${esc(n)}</b><small>${esc(d)}</small></span></li>`).join('');
    return head('Updates', upCount() ? `${upCount()} waiting across your devices` : 'Everything is up to date, on every device')
      + `<section class="dpd-sys${done ? ' ok' : ''}"><div class="dpd-systop">${glyph(done ? 'circle-check' : 'sparkles', done ? 150 : 290, 'lg')}<span><small>Suno · ${esc(sys.channel)}</small><h2>${done ? 'Suno is up to date' : esc(sys.name)}</h2><p>${esc(done ? `You're on ${sys.name}.` : `${sys.blurb} ${sys.size}.`)}</p></span>
          ${done ? '' : `<button class="dpd-well" type="button" data-dpd-sys ${ST.sys === 'run' ? 'disabled' : ''}>${ST.sys === 'done' ? `${ic('rotate-ccw')}Restart now` : ST.sys === 'run' ? `Downloading · ${ST.pct}%` : `${ic('download')}Download`}</button>`}</div>
        ${ST.sys === 'run' ? `<div class="dpd-prog"><i style="width:${ST.pct}%"></i></div>` : ''}
        ${done ? '' : `<ul class="dpd-notes">${notes}</ul>`}
        <p class="dpd-fine">${ic('undo-2')}<span>${done ? `Suno kept ${esc(sys.running)}. <button class="dpd-link" type="button" data-dpd-rollback>Go back</button>` : `You're on ${esc(sys.running)}. Suno keeps it, so you can always go back one version.`}</span></p></section>`
      + `<h2 class="dpd-h2">Apps</h2>` + (P.length ? `<div class="dpd-ups">${P.map(p => { const it = item('app', p.app); return `<div class="dpd-up">${face(it, 'md')}<span class="dpd-upt"><b>${esc(it.name)} <small>${esc(p.from)} → ${esc(p.to)}</small></b><small>${esc(p.notes.join('. '))}.</small>
          <span class="dpd-updevs">${p.devs.map(d => `<i title="${esc(devOf(d).name)}">${ic(formOf(devOf(d).form).icon)}${esc(short(d))}</i>`).join('')}</span></span><button class="dpd-well sm" type="button" data-dpd-upapp="${p.app}">Update</button></div>`; }).join('')}</div>`
        : `<p class="dpd-ok">${ic('circle-check')}Every app is up to date, on all ${devs().length} devices.</p>`)
      + `<h2 class="dpd-h2">How it happens</h2><div class="dpd-set">
          <div><span><b>Update apps overnight</b><small>On every device, while it charges</small></span>${sw(A.apps, 'data-dpd-auto="apps"', 'Update apps overnight')}</div>
          <div><span><b>Download Suno in the background</b><small>Ready when you are</small></span>${sw(A.dl, 'data-dpd-auto="dl"', 'Download Suno in the background')}</div>
          <div><span><b>Restart to finish Suno updates</b><small>${A.luma === 'ask' ? 'Suno asks first, on each device' : 'Overnight, if nothing is open and unsaved'}</small></span>${seg([['ask', 'Ask me'], ['night', 'Overnight']], 'data-dpd-lumaauto', A.luma)}</div>
          <div><span><b>Keep matched apps on one version</b><small>A device that wakes catches up first</small></span>${sw(A.matched, 'data-dpd-auto="matched"', 'Keep matched apps on one version')}</div></div>`
      + `<h2 class="dpd-h2">What happened</h2><div class="dpd-hist">${ST.done.slice(0, 8).map(([id, what, when, where]) => { const it = id === 'suno' ? null : item('app', id); return `<div><time>${esc(when)}</time>${it ? face(it, 'xs') : glyph('sparkles', 290, 'xs')}<span><b>${it ? esc(it.name) : 'Suno'}</b><small>${esc(what)} · ${esc(where)}</small></span></div>`; }).join('')}</div>`; }

  function search() { const q = ST.q.trim().toLowerCase(), hit = it => (it.name + ' ' + it.line + ' ' + it.by).toLowerCase().includes(q);
    const swi = D().switching.find(([n]) => n.toLowerCase().includes(q) || (q.length > 3 && q.includes(n.toLowerCase())));
    const altHit = it => (it.a.alt || []).find(n => n.toLowerCase().includes(q));
    const swIts = swi ? swi[1].map(id => item('app', id)).filter(Boolean) : [];
    const A = apps().filter(it => (hit(it) || altHit(it)) && !swIts.some(x => x.id === it.id)), Lk = D().looks.map(l => item('look', l.id)).filter(hit), T = D().tweaks.map(t => item('tweak', t.id)).filter(hit);
    const grp = (n, its) => its.length ? `<h2 class="dpd-h2">${n}</h2><div class="dpd-grid">${its.map(cardRow).join('')}</div>` : '';
    return head(`“${esc(ST.q.trim())}”`, '')
      + (swIts.length ? `<section class="dpd-instead"><small>${esc(swi[0])} isn't on Suno</small><h2>These do the same job</h2><div class="dpd-tiles">${swIts.map(tile).join('')}</div></section>` : '')
      + grp(swIts.length ? 'More' : 'Apps', A) + grp('Looks', Lk) + grp('Tweaks', T)
      + (!swIts.length && !A.length && !Lk.length && !T.length ? `<div class="dpd-none">${ic('search')}<b>Nothing called that yet</b><small>If you make it, it can be here.</small><button class="dpd-well" type="button" data-dpd-newk="app">Send something new</button></div>` : ''); }

  const STEPS = ['Sent', 'Checks', 'Review', 'In Depot'];
  function subPage() { const s = ST.mine[ST.sub]; if (!s) return discover();
    const at = { checks: 1, review: 2, changes: 2, live: 4 }[s.state];
    return `<article class="dpd-subp"><header class="dpd-subh">${glyph(s.icon, s.hue, 'xl')}<span><small>Made by you · ${{ app: 'App', look: 'Look', tweak: 'Tweak' }[s.kind]}</small><h1>${esc(s.name)}</h1><p>${esc(s.note)}</p></span></header>
      <ol class="dpd-steps">${STEPS.map((n, k) => { const st = k < at || s.state === 'live' ? 'done' : k === at ? (s.state === 'changes' ? 'warn' : 'now') : ''; return `<li class="s-${st}"><i></i><b>${n}</b><small>${st === 'done' ? ['Oct 20', 'Oct 20', 'Oct 21', 'Oct 22'][k] : st === 'now' ? (k === 2 ? 'About two days' : 'A few minutes') : st === 'warn' ? 'Asked for a change' : '&nbsp;'}</small></li>`; }).join('')}</ol>
      ${s.state === 'changes' ? `<blockquote class="dpd-rev w"><p>${esc(s.note)}</p><footer><i>${ic('badge-check')}</i>Suno review · Oct 21</footer></blockquote>` : ''}
      ${s.state === 'live' ? `<div class="dpd-stats">${[['1.2k', 'installs'], ['4.8 ★', '86 ratings'], ['3', 'devices each, on average']].map(([b, x]) => `<span><b>${b}</b><small>${x}</small></span>`).join('')}</div>` : ''}
      ${['review', 'checks'].includes(s.state) ? `<p class="dpd-p">A person at Suno installs it on a real device, tries what it changes, and reads everything it reaches. You'll hear back here.</p>` : ''}</article>`; }

  /* ── the action bar: what you can do here. It grows into the checklist or a submission ── */
  function bar() { const b = q$('#dpd-bar'), sc = q$('#dpd-scrim'); if (!b) return; const g = ST.grown; sc.hidden = !g; b.classList.toggle('grown', !!g);
    if (g) { b.innerHTML = grownBar(g); b.hidden = false; requestAnimationFrame(() => K.segs?.()); return; }
    const it = ST.item && byKey(ST.item), ph = mode() === 'phone'; let h = '';
    if (it) { const hv = has(it), miss = can(it).filter(d => !hv.includes(d)), x = it.x;
      if (it.kind === 'look' && (x.art || x.ink || x.kind === 'Theme')) h += `<button class="dpd-well" type="button" data-dpd-try>${ic(ST.trying === it.id ? 'x' : 'eye')}${ST.trying === it.id ? 'Stop trying' : 'Try it here'}</button>`;
      if (isSystem(it)) h += `<button class="dpd-key" type="button" data-dpd-openapp="${it.id}">Open</button>`;
      else if (hv.length) { if (miss.length) h += `<button class="dpd-well" type="button" data-dpd-grow="add">${ic('monitor-smartphone')}Add to ${miss.length === 1 ? esc(devOf(miss[0]).name) : miss.length + ' more'}</button>`;
        if (it.kind === 'app' && hv.includes(here()) && it.a.win) h += `<button class="dpd-key" type="button" data-dpd-openapp="${it.id}">Open</button>`;
        else if (!miss.length) h += `<button class="dpd-well" type="button" data-dpd-grow="add">${ic('monitor-smartphone')}Devices</button>`; }
      else if (can(it).length) h += `<button class="dpd-key" type="button" data-dpd-grow="add">${verb(it)} to your Suno</button>`; }
    else if (ST.page === 'updates' && (pending().length || ST.sys !== 'restarted')) h = `<button class="dpd-key" type="button" data-dpd-everything>${ic('refresh-cw')}Update everything</button>`;
    else if (ST.page === 'sub') { const s = ST.mine[ST.sub]; h = s?.state === 'changes' ? `<button class="dpd-key" type="button" data-dpd-resend>Send a new version</button>` : s?.state === 'live' ? `<button class="dpd-key" type="button" data-dpd-resend>Send an update</button>` : `<button class="dpd-well" type="button" data-dpd-withdraw>Withdraw</button>`; }
    if (ph && !it && ['discover', 'search', 'suno'].includes(ST.page)) h = `<label class="dpd-bsrch">${ic('search')}<input id="dpd-bq" type="search" placeholder="Search Depot" aria-label="Search Depot" value="${esc(ST.q)}" autocomplete="off"></label>${h}`;
    b.innerHTML = h; b.hidden = !h; }
  function grownBar(g) { const x = (i, t, s) => `<header>${i}<span><b>${t}</b>${s ? `<small>${s}</small>` : ''}</span><button class="ib" type="button" data-dpd-shrink aria-label="Close">${ic('x')}</button></header>`;
    if (g === 'add') { const it = byKey(ST.item), hv = has(it), c = can(it), n = [...ST.picks].filter(d => !hv.includes(d)).length, off = hv.filter(d => !ST.picks.has(d)).length;
      return `<div class="dpd-gx">${x(face(it, 'sm'), `${verb(it)} ${esc(it.name)}`, 'Ticked devices get it. Untick one to leave it off.')}
        <div class="dpd-pick">${devs().map(d => { const ok = c.includes(d.id), on = ST.picks.has(d.id); return `<button type="button" class="${on ? 'on' : ''}${ok ? '' : ' cant'}" ${ok ? `data-dpd-pick="${d.id}"` : 'disabled'} aria-pressed="${on}">${device(d, on ? face(it, 'xs') : '', 'sm')}<b>${esc(short(d.id))}</b><i class="dpd-tick">${ic(ok ? (on ? 'check' : 'plus') : 'minus')}</i></button>`; }).join('')}</div>
        ${it.kind === 'app' ? `<button type="button" class="dpd-keep" data-dpd-keep>${ic('link')}<span><b>Keep matched</b><small>New devices get it too, and every copy stays on one version</small></span><i class="cfsw${ST.keep ? ' on' : ''}"></i></button>` : ''}
        <footer><button class="dpd-well" type="button" data-dpd-shrink>Cancel</button><button class="dpd-key" type="button" ${n || off ? 'data-dpd-confirm' : 'data-dpd-shrink'}>${n ? `${verb(it)} on ${n === 1 ? esc(devOf([...ST.picks].find(d => !hv.includes(d))).name) : n + ' devices'}` : off ? `Remove from ${off}` : 'Done'}</button></footer></div>`; }
    if (g === 'new') { const k = ST.nk;
      return `<div class="dpd-gx">${x(glyph('square-pen', 250, 'sm'), 'Send something new', 'Checked in minutes. Reviewed for the Verified seal.')}
        <div class="dpd-gbody">${seg([['app', `${ic('package')}App`], ['look', `${ic('palette')}Look`], ['tweak', `${ic('sliders-horizontal')}Tweak`]], 'data-dpd-nk', k, 'full')}
        <div class="dpd-drop">${ic('upload')}<span><b>${{ app: 'Drop a Flatpak, .deb or .rpm', look: 'Drop the Look\'s folder', tweak: 'Drop the Tweak\'s folder' }[k]}</b><small>or paste a link to where it lives</small></span></div>
        <input class="dpd-in" id="dpd-nname" type="text" placeholder="Name">
        ${k === 'app' ? `<div class="dpd-forms"><small>Made for</small>${forms().map(f => `<button type="button" class="${ST.nforms.includes(f.id) ? 'on' : ''}" data-dpd-nform="${f.id}" title="${f.name}">${ic(f.icon)}<span>${f.name}</span></button>`).join('')}</div>` : k === 'tweak' ? `<div class="dpd-forms"><small>Changes</small>${['Shelf', 'Windows', 'Lock screen', 'Quick Options'].map((c, i) => `<button type="button" class="${i === 3 ? 'on' : ''}" data-dpd-tog><span>${c}</span></button>`).join('')}</div>` : ''}</div>
        <footer><button class="dpd-well" type="button" data-dpd-shrink>Cancel</button><button class="dpd-key" type="button" data-dpd-send>Send for review</button></footer></div>`; }
    return ''; }
  function grow(g) { ST.grown = g; if (g === 'add') { const it = byKey(ST.item), hv = has(it); ST.picks = new Set(hv.length ? [...hv, ...can(it)] : can(it)); ST.keep = it.kind === 'app' ? (matched(it) || !hv.length) : false; } bar(); }
  function shrink() { ST.grown = null; bar(); }

  /* ── doing things ── */
  function setOn(it, d, on) { const h = new Set(has(it)); on ? h.add(d) : h.delete(d); ST.has[it.key] = devs().map(x => x.id).filter(x => h.has(x)); if (!on) ST.match.delete(it.key); }
  function go(page, o = {}) { ST.back = []; ST.page = page; ST.item = null; ST.q = ''; ST.grown = null; Object.assign(ST, o); untry(); W.classList.remove('navopen'); side(); body(); }
  function open(key) { ST.back.push(snap()); ST.item = key; ST.grown = null; untry(); W.classList.remove('navopen'); side(); body(); }
  function back(quiet) { const s = ST.back.pop(); if (s) Object.assign(ST, s); else Object.assign(ST, { page: 'discover', item: null }); if (ST.page !== 'search') ST.q = ''; ST.grown = null; untry(); if (!quiet) { side(); body(); } }
  function untry() { if (!ST.trying) return; ST.trying = null; W.classList.remove('dpd-trying'); W.style.removeProperty('--dpd-try'); }
  function refresh() { const s = q$('#dpd-body')?.scrollTop || 0; side(); body(); q$('#dpd-body').scrollTop = s; }

  function render() { W = document.getElementById('w-depot'); if (!W || !K) return;
    if (!ST.match) { ST.match = new Set(D().matched.map(id => 'app:' + id)); ST.mine = D().mine.map(s => ({ ...s })); ST.done = D().done.map(r => [...r]);
      ST.auto = { apps: D().auto.apps, dl: true, suno: 'ask', matched: D().auto.matched }; }
    frame(); lastMode = mode(); ['wide', 'mid', 'phone', 'tablet'].forEach(k => W.classList.toggle('dpd-' + k, lastMode === k)); side(); body(); }

  function click(e) { const t = e.target, h = s => t.closest(s); if (!W || !h('#w-depot')) return false; let b;
    if ((b = h('[data-dpd-twon]'))) { const it = item('tweak', b.dataset.dpdTwon), on = !has(it).includes(here()); setOn(it, here(), on); refresh(); K.lToast(W, `${it.name} ${on ? 'on' : 'off'}${on ? '' : '. Suno is exactly as it was'}`, { icon: 'sliders-horizontal' }); return true; }
    if (h('[data-dpd-lumaapps]')) { ST.lumaOpen = !ST.lumaOpen; side(); return true; }
    if ((b = h('[data-dpd-page]'))) { go(b.dataset.dpdPage); return true; }
    if ((b = h('[data-dpd-item]'))) { open(b.dataset.dpdItem); return true; }
    if ((b = h('[data-dpd-sub]'))) { go('sub', { sub: +b.dataset.dpdSub }); return true; }
    if (h('[data-dpd-back]')) { back(); return true; }
    if ((b = h('[data-dpd-view]'))) { ST.view = b.dataset.dpdView; ST.cat = ''; ST.part = ''; ST.lkind = ''; body(); return true; }
    if ((b = h('[data-dpd-cat]'))) { ST.cat = ST.cat === b.dataset.dpdCat ? '' : b.dataset.dpdCat; refresh(); return true; }
    if ((b = h('[data-dpd-part]'))) { ST.part = ST.part === b.dataset.dpdPart ? '' : b.dataset.dpdPart; refresh(); return true; }
    if ((b = h('[data-dpd-lkind]'))) { ST.lkind = b.dataset.dpdLkind; refresh(); return true; }
    if ((b = h('[data-dpd-search]'))) { ST.back.push(snap()); ST.q = b.dataset.dpdSearch; ST.page = 'search'; ST.item = null; side(); body(); return true; }
    if ((b = h('[data-dpd-libmenu]'))) { K.lMenu(b, [['all', 'Everything you have', 'monitor-smartphone'], ...devs().map(d => [d.id, d.name, formOf(d.form).icon])].map(([k, n, i]) => `<button class="crmi${ST.libDev === k ? ' on' : ''}" type="button" data-dpd-libdev="${k}">${ic(i)}${esc(n)}</button>`).join('')); return true; }
    if ((b = h('[data-dpd-libdev]'))) { document.getElementById('lmenu')?.remove(); ST.libDev = b.dataset.dpdLibdev; side(); return true; }
    if ((b = h('[data-dpd-toggle]'))) { const it = byKey(ST.item), d = b.dataset.dpdToggle, on = !has(it).includes(d); setOn(it, d, on); refresh();
      K.lToast(W, `${it.name}: ${on ? (it.kind === 'app' ? 'installing on ' : it.kind === 'look' ? 'in use on ' : 'on for ') : 'removed from '}${devOf(d).name}${on && devOf(d).form === 'tv' && it.kind === 'app' ? ', when it wakes' : ''}`, { icon: on ? 'download' : 'minus' }); return true; }
    if ((b = h('[data-dpd-grow]'))) { grow(b.dataset.dpdGrow); return true; }
    if (h('[data-dpd-shrink]') || h('#dpd-scrim')) { shrink(); return true; }
    if ((b = h('[data-dpd-pick]'))) { const d = b.dataset.dpdPick; ST.picks.has(d) ? ST.picks.delete(d) : ST.picks.add(d); if (!ST.picks.has(d)) ST.keep = false; bar(); return true; }
    if (h('[data-dpd-keep]')) { ST.keep = !ST.keep; if (ST.keep) can(byKey(ST.item)).forEach(d => ST.picks.add(d)); bar(); return true; }
    if (h('[data-dpd-confirm]')) { const it = byKey(ST.item), hv = has(it), add = [...ST.picks].filter(d => !hv.includes(d)), rm = hv.filter(d => !ST.picks.has(d));
      add.forEach(d => setOn(it, d, true)); rm.forEach(d => setOn(it, d, false)); if (it.kind === 'app') { if (ST.keep) ST.match.add(it.key); else ST.match.delete(it.key); }
      ST.grown = null; refresh(); K.lToast(W, add.length ? `${it.name}: ${it.kind === 'app' ? 'installing on' : 'on'} ${list(add.map(d => devOf(d).name))}${ST.keep && it.kind === 'app' ? '. Matched' : ''}` : `${it.name} removed from ${list(rm.map(d => devOf(d).name))}`, { icon: add.length ? 'download' : 'minus' }); return true; }
    if (h('[data-dpd-match]')) { const it = byKey(ST.item); if (matched(it)) { ST.match.delete(it.key); K.lToast(W, `${it.name} is no longer matched. It stays where it is`, { icon: 'link' }); } else { can(it).forEach(d => setOn(it, d, true)); ST.match.add(it.key); K.lToast(W, `${it.name} is matched: on every device that runs it`, { icon: 'link' }); } refresh(); return true; }
    if (h('[data-dpd-share]')) { K.lToast(W, 'Link copied', { icon: 'link' }); return true; }
    if ((b = h('[data-dpd-more]'))) { const it = byKey(ST.item); K.lMenu(b, `${has(it).length ? `<button class="crmi" type="button" data-dpd-rmall>${ic('trash-2')}Remove from your Suno</button>` : ''}<button class="crmi" type="button" data-dpd-report>${ic('flag')}Report a problem</button>`); return true; }
    if (h('[data-dpd-rmall]')) { const it = byKey(ST.item); document.getElementById('lmenu')?.remove(); K.lConfirm(W, { title: `Remove ${it.name} from your Suno?`, body: 'It leaves every device. Its settings stay in your Suno account for 30 days.', action: 'Remove', icon: 'trash-2', danger: true, onOK: () => { ST.has[it.key] = []; ST.match.delete(it.key); refresh(); K.lToast(W, `${it.name} removed from every device`, { icon: 'trash-2' }); } }); return true; }
    if (h('[data-dpd-report]')) { document.getElementById('lmenu')?.remove(); K.lToast(W, 'Thanks. Suno review will look at it', { icon: 'flag' }); return true; }
    if ((b = h('[data-dpd-openapp]'))) { K.open?.(b.dataset.dpdOpenapp); return true; }
    if (h('[data-dpd-try]')) { const it = byKey(ST.item); if (ST.trying === it.id) untry(); else { ST.trying = it.id; W.classList.add('dpd-trying'); W.style.setProperty('--dpd-try', it.x.art ? `url(${it.x.art})` : 'none'); K.lToast(W, `Trying ${it.name} on this window. Nothing else changes`, { icon: 'eye' }); } bar(); return true; }
    if ((b = h('[data-dpd-newmenu]'))) { K.lMenu(b, [['app', 'An app', 'package'], ['look', 'A Look', 'palette'], ['tweak', 'A Tweak', 'sliders-horizontal']].map(([k, n, i]) => `<button class="crmi" type="button" data-dpd-newk="${k}">${ic(i)}${n}</button>`).join('')); return true; }
    if ((b = h('[data-dpd-newk]'))) { document.getElementById('lmenu')?.remove(); ST.nk = b.dataset.dpdNewk; W.classList.remove('navopen'); grow('new'); return true; }
    if ((b = h('[data-dpd-nk]'))) { ST.nk = b.dataset.dpdNk; bar(); return true; }
    if ((b = h('[data-dpd-nform]'))) { const f = b.dataset.dpdNform, i = ST.nforms.indexOf(f); i < 0 ? ST.nforms.push(f) : ST.nforms.splice(i, 1); b.classList.toggle('on'); return true; }
    if ((b = h('[data-dpd-tog]'))) { b.classList.toggle('on'); return true; }
    if (h('[data-dpd-send]')) { const name = q$('#dpd-nname')?.value.trim() || { app: 'Untitled app', look: 'Untitled Look', tweak: 'Untitled Tweak' }[ST.nk];
      ST.mine.unshift({ kind: ST.nk, name, icon: { app: 'package', look: 'palette', tweak: 'sliders-horizontal' }[ST.nk], hue: hash(name), state: 'checks', note: 'Suno is checking the package. A few minutes.' }); ST.grown = null; go('sub', { sub: 0 }); K.lToast(W, `${name} sent. Suno is checking it`, { icon: 'send' }); return true; }
    if (h('[data-dpd-resend]')) { const s = ST.mine[ST.sub]; s.state = 'checks'; s.note = 'A new version. Suno is checking it.'; refresh(); K.lToast(W, `New version of ${s.name} sent`, { icon: 'send' }); return true; }
    if (h('[data-dpd-withdraw]')) { const s = ST.mine[ST.sub]; K.lConfirm(W, { title: `Withdraw ${s.name}?`, body: 'It leaves review. You can send it again whenever you like.', action: 'Withdraw', icon: 'undo-2', onOK: () => { ST.mine.splice(ST.sub, 1); go('discover'); } }); return true; }
    if ((b = h('[data-dpd-upapp]'))) { const app = b.dataset.dpdUpapp, p = pending().find(x => x.app === app); p.devs.forEach(d => { ST.upd[app + d] = 1; }); ST.done.unshift([app, `${p.from} → ${p.to}`, 'Today', p.devs.length > 2 ? 'Every device' : list(p.devs.map(d => devOf(d).name))]); refresh(); K.lToast(W, `${item('app', app).name} updated on ${p.devs.length} device${p.devs.length > 1 ? 's' : ''}`, { icon: 'refresh-cw' }); return true; }
    if (h('[data-dpd-everything]')) { pending().forEach(p => { p.devs.forEach(d => { ST.upd[p.app + d] = 1; }); ST.done.unshift([p.app, `${p.from} → ${p.to}`, 'Today', p.devs.length > 2 ? 'Every device' : list(p.devs.map(d => devOf(d).name))]); }); if (ST.sys === 'ready') sysRun(); refresh(); K.lToast(W, 'Updating everything, on every device', { icon: 'refresh-cw' }); return true; }
    if (h('[data-dpd-sys]')) { if (ST.sys === 'done') { ST.sys = 'restarted'; ST.done.unshift(['suno', D().system.name, 'Today', 'All devices']); refresh(); K.lToast(W, 'Suno restarted into the new version. Your windows came back', { icon: 'rotate-ccw' }); } else if (ST.sys === 'ready') sysRun(); return true; }
    if (h('[data-dpd-rollback]')) { K.lConfirm(W, { title: `Go back to ${D().system.running}?`, body: 'Suno restarts into the version you had before. Your files, apps and settings stay as they are.', action: 'Restart', icon: 'undo-2', onOK: () => K.lToast(W, 'Suno will restart into the previous version', { icon: 'undo-2' }) }); return true; }
    if ((b = h('[data-dpd-auto]'))) { const k = b.dataset.dpdAuto; ST.auto[k] = !ST.auto[k]; refresh(); return true; }
    if ((b = h('[data-dpd-lumaauto]'))) { ST.auto.luma = b.dataset.dpdLumaauto; refresh(); return true; }
    return false; }
  function sysRun() { ST.sys = 'run'; ST.pct = 0; const tick = () => { ST.pct = Math.min(100, ST.pct + 9); if (ST.pct >= 100) ST.sys = 'done'; else setTimeout(tick, 160); if (!W.hidden && ST.page === 'updates' && !ST.item) refresh(); else if (!W.hidden) side(); }; tick(); }

  window.LumaDepot = window.LumaDepotD = { render(k) { if (k) K = k; render(); }, click, state: ST, go, open, grow };
})();
