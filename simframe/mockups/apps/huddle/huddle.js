/* ══ Huddle (25 Oct 2026): follow only the games you care about ════════════════════════════════════════════════════
   A desktop app first. Places on the ground (Following, Games, Standings, and the teams in your games), the page an
   island, the action bar for what you can do. Following is the reason it exists: the games you picked, side by side,
   scores large. Games is where you pick them: one tap follows, one tap stops. Standings and team pages stay light.

   Live data. In the product this module asks a scores API every 15 s while a followed game is live and the window
   is visible, every 60 s otherwise, and every 5 min on a day with nothing live (conditional requests, backing off
   on errors). Between answers the game clock runs on locally and is corrected by the next one. Nothing old ever
   passes for current: past 30 s the status says how old the scores are, past 90 s (or offline) every score is
   marked "as of" with the time it was true and live lights go grey.

   Companions: a live extension on the shelf (desktop/shell.js reads window.LumaHuddle) and a tile in the phone's
   Now panel (desktop/phone.js). Followed games are remembered between visits (localStorage). Times are the viewer's.

   Demo states: ?huddle=loading | empty | quiet (no live games) | stale | offline | error */
(() => {
  'use strict';
  const D = window.HUDDLE_DATA; if (!D) return;
  const MODE = new URLSearchParams(location.search).get('huddle') || '';
  const KEY = 'huddle-follow';
  const ST = { place: 'following', tab: 'live', conf: 'NFC', team: null, back: null, q: '', edit: false, follow: null, upd: 0, fresh: '', loading: MODE === 'loading' };
  let K = null, W = null, RO = null, lastMode = '';
  const TEAMS = Object.fromEntries(D.teams.map(t => [t.id, t]));
  if (MODE === 'quiet') D.games.forEach(g => { if (['live', 'half', 'delay'].includes(g.st)) Object.assign(g, { st: 'final', q: 4, clk: 0, pos: '', dd: '' }); });

  /* ── small parts ── */
  const q$ = s => W && W.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => (K && K.ic(n)) || (() => { const v = (window.__iconBundle || {})[n]; return v ? v.replace(/<!--[\s\S]*?-->/g, '').replace(/stroke-width="[\d.]+"/, 'stroke-width="1.6"').replace(/ width="24"/, '').replace(/ height="24"/, '').replace('<svg', '<svg class="i" aria-hidden="true"') : ''; })();
  const isPhone = () => W?.classList.contains('phone');
  const mode = () => { if (isPhone()) return document.documentElement.dataset.form === 'tablet' ? (document.documentElement.dataset.o === 'portrait' ? 'tport' : 'wide') : 'phone'; const w = W?.clientWidth || 1200; return w < 640 ? 'phone' : w < 980 ? 'mid' : 'wide'; };
  const tm = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }), wd = new Intl.DateTimeFormat(undefined, { weekday: 'short' }), wdl = new Intl.DateTimeFormat(undefined, { weekday: 'long' }), md = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  const when = t => { const n = Date.now(), d = (new Date(t).setHours(0, 0, 0, 0) - new Date(n).setHours(0, 0, 0, 0)) / 864e5;
    return d === 0 ? tm.format(t) : d === 1 ? `Tomorrow ${tm.format(t)}` : d === -1 ? `Yesterday` : d > 1 && d < 7 ? `${wd.format(t)} ${tm.format(t)}` : md.format(t); };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
  const rec = t => `${t.w}–${t.l}${t.t ? '–' + t.t : ''}`;
  const all = () => [...D.games, ...D.last];
  const game = id => all().find(g => g.id === id);

  /* ── following, remembered ── */
  function loadFollow() { let v = null; try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!Array.isArray(v)) v = ['w8-det-gb', 'w8-buf-mia']; if (MODE === 'empty') v = []; ST.follow = v.filter(id => D.games.some(g => g.id === id));
    let m = null; try { m = JSON.parse(localStorage.getItem(KEY + '-teams') || 'null'); } catch (e) {} ST.mine = Array.isArray(m) ? m.filter(id => TEAMS[id]) : ['DET', 'BUF']; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ST.follow)); localStorage.setItem(KEY + '-teams', JSON.stringify(ST.mine)); } catch (e) {} };
  /* your teams: the clubs you care about, kept between visits; a star on any team page adds or removes one */
  const mine = id => (ST.mine || []).includes(id);
  function star(id) { const on = !mine(id); ST.mine = on ? [...ST.mine, id] : ST.mine.filter(x => x !== id); save(); K.lToast(W, on ? `${TEAMS[id].name} added to your teams` : `${TEAMS[id].name} removed from your teams`, { icon: 'star', undo: () => star(id) }); paint(); }
  const following = id => ST.follow.includes(id);
  const followed = () => (ST.follow || (loadFollow(), ST.follow)).map(game).filter(Boolean).sort((a, b) => order(a) - order(b) || a.ko - b.ko);
  const order = g => ({ live: 0, half: 0, delay: 1, pre: 2, post: 3, final: 4 })[g.st];
  function toggle(id) { const g = game(id); if (!g) return; const on = !following(id); ST.follow = on ? [...ST.follow, id] : ST.follow.filter(x => x !== id); save(); share();
    K.lToast(W, on ? `Following ${TEAMS[g.away].name} at ${TEAMS[g.home].name}` : `Stopped following ${TEAMS[g.away].name} at ${TEAMS[g.home].name}`, { icon: on ? 'star' : 'x', undo: () => toggle(id) }); paint(); }

  /* ── freshness: how old the scores are, said plainly ── */
  const offline = () => MODE === 'offline', broken = () => MODE === 'error';
  function age() { return (Date.now() - ST.upd) / 1000; }
  function fresh() { const a = age(); if (broken()) return 'error'; if (offline()) return 'offline'; return a < 30 ? 'live' : a < 90 ? 'aging' : 'stale'; }
  function freshLine() { const f = fresh(), a = Math.round(age());
    if (f === 'live') return [`live`, a < 5 ? 'Updated just now' : `Updated ${a} s ago`];
    if (f === 'aging') return ['aging', `Updated ${Math.round(a / 60) || 1} min ago · checking again`];
    if (f === 'offline') return ['stale', `You're offline · scores from ${tm.format(ST.upd)}`];
    if (f === 'error') return ['stale', `Can't reach scores · last good ${tm.format(ST.upd)}`];
    return ['stale', `Not updated since ${tm.format(ST.upd)} · retrying`]; }
  const asOf = () => ['stale', 'offline', 'error'].includes(fresh());

  /* ── the clock: runs on between answers, corrected by each one ── */
  function tick() { if (asOf()) return; const live = D.games.filter(g => g.st === 'live');
    live.forEach(g => { g.clk -= 1; if (g.clk <= 0) { if (g.q === 2) Object.assign(g, { st: 'half', clk: 0, pos: '', dd: '' }); else if (g.q >= 4) { if (g.as === g.hs && g.q === 4) Object.assign(g, { q: 5, clk: 600 }); else Object.assign(g, { st: 'final', clk: 0, pos: '', dd: '' }); } else Object.assign(g, { q: g.q + 1, clk: 900 }); } }); }
  /* each answer from the API: now and then somebody scores */
  let seq = 0;
  function poll() { if (MODE === 'stale' || offline() || broken()) return; ST.upd = Date.now(); seq++;
    const live = D.games.filter(g => g.st === 'live'); if (live.length && seq % 2 === 0) { const g = live[seq % live.length], home = g.pos === g.home, pts = seq % 3 ? 3 : 7;
      if (home) g.hs += pts; else g.as += pts; g.flash = Date.now(); g.dd = '1st & 10 · own 25'; g.pos = home ? g.away : g.home; } share(); }
  const share = () => window.dispatchEvent(new CustomEvent('huddle-update'));

  /* ── team marks: the club's colours and short name ── */
  const badge = (id, cls = '') => { const t = TEAMS[id]; return `<i class="hd-badge ${cls}" style="--c1:${t.c1};--c2:${t.c2}" aria-hidden="true"><b>${id}</b></i>`; };
  function status(g) {
    if (g.st === 'live') return { k: 'live', pill: 'Live', when: `${g.q === 5 ? 'OT' : 'Q' + g.q} · ${mmss(g.clk)}` };
    if (g.st === 'half') return { k: 'half', pill: 'Halftime', when: 'Halftime' };
    if (g.st === 'delay') return { k: 'delay', pill: 'Delayed', when: `Q${g.q} · ${mmss(g.clk)}` };
    if (g.st === 'final') return { k: 'final', pill: g.q === 5 ? 'Final · OT' : 'Final', when: sameDay(g.ko, Date.now()) ? 'Today' : when(g.ko) };
    if (g.st === 'post') return { k: 'post', pill: 'Postponed', when: g.moved ? `Now ${when(g.moved)}` : 'Date to come' };
    return { k: 'pre', pill: when(g.ko), when: when(g.ko) }; }
  const scored = g => !['pre', 'post'].includes(g.st);
  const leads = (g, side) => scored(g) && (side === 'away' ? g.as > g.hs : g.hs > g.as);

  /* ── the frame ── */
  function frame() {
    const ib = W.querySelector('.ibody'); if (ib && !ib.dataset.hd) { ib.dataset.hd = 1;
      ib.innerHTML = `<nav class="dpside hdside" id="hd-side" aria-label="Huddle"></nav><main class="main isle hd-main" id="hd-main"><div class="hd-backf" id="hd-backf" data-phmv="1" hidden></div><div class="hd-corner" id="hd-corner" data-phmv="1"></div><div class="hd-page" id="hd-page" data-phsc="1"></div><div class="fbar hd-bar phnofit" id="hd-bar" role="toolbar" aria-label="Huddle"></div></main>`; }
    W.classList.add('hdwin');
    if (!RO) { RO = new ResizeObserver(() => { const m = mode(); if (m !== lastMode) { lastMode = m; paint(); } }); RO.observe(W);
      W.addEventListener('input', e => { if (e.target.id === 'hd-q') { ST.q = e.target.value; if (ST.q.trim()) { ST.team = null; } page(); } });
      document.addEventListener('keydown', e => { if (W.hidden) return; if (e.key === 'Escape') { if (ST.team) { back(); e.stopPropagation(); } else if (ST.edit) { ST.edit = false; paint(); } } }, true); } }
  function top() { const t = q$('#hd-top'); if (!t) return;
    t.innerHTML = mode() === 'phone' && ST.team ? `<button class="ib" type="button" data-hd-back aria-label="Back">${ic('chevron-left')}</button>${starBtn(ST.team)}` : `<img src="${K.A}huddle.svg" alt=""><b>Huddle</b>${isPhone() ? K.lSideBtn(W) : ''}`; }
  const starBtn = id => { const on = mine(id); return `<button class="ib hd-star${on ? ' on' : ''}" type="button" data-hd-star="${id}" aria-pressed="${on}" aria-label="${on ? 'Remove from your teams' : 'Add to your teams'}" title="${on ? 'In your teams' : 'Add to your teams'}">${ic('star')}</button>`; };

  /* ── places ── */
  function side() { const el = q$('#hd-side'); if (!el) return; const F = followed(), liveN = F.filter(g => ['live', 'half', 'delay'].includes(g.st)).length, had = document.activeElement?.id === 'hd-q';
    const si = (k, l, i, em = '') => `<button class="si${ST.place === k && !ST.team && !ST.q.trim() ? ' on' : ''}" type="button" data-hd-place="${k}">${ic(i)}<span class="lab">${l}</span>${em}</button>`;
    const teams = ST.mine;
    el.innerHTML = `<div class="scr">${si('following', 'Following', 'star', F.length ? `<em class="hd-n${liveN ? ' live' : ''}">${liveN ? '<i></i>' : ''}${F.length}</em>` : '')}${si('games', 'Games', 'calendar')}${si('standings', 'Standings', 'list-ordered')}
      ${teams.length ? `<div class="sh">Your teams</div>${teams.map(id => `<button class="si hd-tsi${ST.team === id ? ' on' : ''}" type="button" data-hd-team="${id}">${badge(id, 'xs')}<span class="lab">${esc(TEAMS[id].city === 'New York' || TEAMS[id].city === 'Los Angeles' ? TEAMS[id].city + ' ' + TEAMS[id].name : TEAMS[id].name)}</span><small>${rec(TEAMS[id])}</small></button>`).join('')}` : ''}</div>
      <div class="shead sfoot dpfoot"><label class="srch">${ic('search')}<input id="hd-q" type="search" placeholder="Find a team" aria-label="Find a team" value="${esc(ST.q)}" autocomplete="off" spellcheck="false"></label></div>`;
    if (had) { const i = q$('#hd-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }

  /* ── pages ── */
  function page() { const el = q$('#hd-page'); if (!el) return; const s = el.scrollTop;
    W.style.removeProperty('--hd-c'); W.classList.toggle('hd-onteam', !!ST.team);
    el.innerHTML = (ST.loading ? loading() : broken() && !ST.upd0 ? errorPage() : ST.q.trim() ? search() : ST.team ? teamPage(ST.team) : ({ following: followingPage, games: gamesPage, standings: standingsPage })[ST.place]());
    el.scrollTop = ST.keep ? s : 0; ST.keep = false; corner(); bar(); top();
    const bf = q$('#hd-backf'); if (bf) { const on = !!ST.team && mode() !== 'phone'; bf.hidden = !on; bf.innerHTML = on ? `<button class="ib-back" type="button" data-hd-back>${ic('chevron-left')}<span>${ST.back === 'standings' ? 'Standings' : ST.back === 'games' ? 'Games' : 'Following'}</span></button>` : ''; } }
  const head = (t, sub) => `<header class="hd-head"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</header>`;
  const banner = () => { const f = fresh(); if (!asOf()) return '';
    const [icon, title, body] = f === 'offline' ? ['wifi-off', 'You\'re offline', `These are the scores from ${tm.format(ST.upd)}. Huddle updates them as soon as you're back.`] : f === 'error' ? ['circle-alert', 'Huddle can\'t reach the scores right now', `Showing the last good update, from ${tm.format(ST.upd)}. Trying again every 30 seconds.`] : ['clock-alert', 'These scores aren\'t current', `Nothing new since ${tm.format(ST.upd)}. Huddle is trying again.`];
    return `<aside class="hd-banner">${ic(icon)}<span><b>${title}</b><small>${body}</small></span>${f === 'error' ? `<button class="hd-well sm" type="button" data-hd-retry>${ic('refresh-cw')}Try again</button>` : ''}</aside>`; };

  /* Following: the games you picked, side by side, scores large */
  function board(g) { const s = status(g), A = TEAMS[g.away], H = TEAMS[g.home], old = asOf() && ['live', 'delay'].includes(g.st), fl = g.flash && Date.now() - g.flash < 4000;
    const row = (side, t, sc) => `<button type="button" class="hd-trow${leads(g, side) ? ' lead' : ''}${g.st === 'final' && !leads(g, side) ? ' lost' : ''}" data-hd-team="${t.id}" style="--c1:${t.c1}">${badge(t.id, 'lg')}<span class="hd-tn"><b>${esc(t.name)}</b><small>${esc(t.city)} · ${rec(t)}</small></span>${g.pos === t.id && g.st === 'live' ? '<i class="hd-ball" title="Has the ball"></i>' : ''}<b class="hd-sc">${scored(g) ? sc : ''}</b></button>`;
    return `<article class="hd-board k-${s.k}${old ? ' old' : ''}${fl ? ' flash' : ''}${ST.edit ? ' editing' : ''}" style="--a:${A.c1};--h:${H.c1}">
      <header><span class="hd-pill k-${s.k}">${s.k === 'live' ? '<i></i>' : s.k === 'delay' ? ic('cloud-rain') : s.k === 'post' ? ic('calendar-clock') : ''}${esc(s.k === 'pre' ? 'Kickoff ' + s.pill : s.pill)}</span>${['live', 'delay'].includes(s.k) ? `<span class="hd-clock">${esc(s.when)}</span>` : ''}<span class="hd-tv">${esc(g.tv || '')}</span>
        <button class="ib hd-x" type="button" data-hd-follow="${g.id}" aria-label="Stop following" title="Stop following">${ic('x')}</button></header>
      ${row('away', A, g.as)}${row('home', H, g.hs)}
      <footer>${old ? `<span class="hd-asof">${ic('clock-alert')}As of ${tm.format(ST.upd)}</span>` : g.st === 'live' && g.dd ? `<span class="hd-dd"><i class="hd-ball sm"></i>${esc(g.dd)}</span>` : g.note ? `<span class="hd-note">${esc(g.note)}</span>` : g.st === 'pre' ? `<span class="hd-note">${esc(g.slot || wdl.format(g.ko))} · ${esc(g.tv)}</span>` : g.st === 'half' ? `<span class="hd-note">Second half starts soon</span>` : `<span class="hd-note">${esc(md.format(g.ko))}</span>`}</footer></article>`; }
  function followingPage() { const F = followed(), [fk, fl] = freshLine();
    if (!F.length) return head('Following') + `<div class="hd-empty">${ic('star')}<h2>Pick the games you care about</h2><p>Follow a game and it lives here, with its score, quarter and clock, and on your shelf while you work.</p><button class="hd-key" type="button" data-hd-place="games">${ic('calendar')}Browse today's games</button></div>`;
    const live = F.filter(g => ['live', 'half', 'delay'].includes(g.st)).length;
    const also = D.games.filter(g => ['live', 'half', 'delay'].includes(g.st) && !following(g.id)).sort((a, b) => order(a) - order(b));
    const chip = g => { const s = status(g), r = (id, sc, side) => `<span class="hd-cr${leads(g, side) ? ' lead' : ''}">${badge(id, 'sm')}<b>${esc(TEAMS[id].name)}</b>${g.pos === id && g.st === 'live' ? '<i class="hd-ball sm"></i>' : ''}<em>${sc}</em></span>`;
      return `<div class="hd-chip" style="--a:${TEAMS[g.away].c1};--h:${TEAMS[g.home].c1}"><header><small class="hd-cs k-${s.k}">${s.k === 'live' ? '<i></i>' : ''}${esc(s.k === 'live' || s.k === 'delay' ? s.when : s.pill)}</small><button class="hd-cadd" type="button" data-hd-follow="${g.id}" aria-label="Follow ${esc(TEAMS[g.away].name)} at ${esc(TEAMS[g.home].name)}">${ic('plus')}Follow</button></header>${r(g.away, g.as, 'away')}${r(g.home, g.hs, 'home')}</div>`; };
    return `<header class="hd-head"><h1>Following</h1><p class="hd-sub f-${fk}"><i></i>${live ? `${live} live · ` : ''}${esc(fl)}</p></header>${banner()}<div class="hd-boards n${Math.min(F.length, 3)}">${F.map(board).join('')}</div>
      ${also.length && !ST.edit ? `<section class="hd-also"><h3>Also on now</h3><div class="hd-chips">${also.map(chip).join('')}</div></section>` : ''}`; }

  /* Games: pick them. One tap follows, one tap stops */
  function card(g) { const s = status(g), on = following(g.id), A = TEAMS[g.away], H = TEAMS[g.home], old = asOf() && ['live', 'delay'].includes(g.st);
    const row = (side, t, sc) => `<span class="hd-crow${leads(g, side) ? ' lead' : ''}${g.st === 'final' && !leads(g, side) ? ' lost' : ''}">${badge(t.id, 'sm')}<b>${esc(t.name)}</b><small>${rec(t)}</small>${g.pos === t.id && g.st === 'live' ? '<i class="hd-ball sm"></i>' : ''}<em>${scored(g) ? sc : ''}</em></span>`;
    return `<article class="hd-card k-${s.k}${on ? ' on' : ''}${old ? ' old' : ''}" style="--a:${A.c1};--h:${H.c1}">
      <header><span class="hd-pill k-${s.k}">${s.k === 'live' ? '<i></i>' : s.k === 'delay' ? ic('cloud-rain') : ''}${esc(s.k === 'pre' ? s.pill : s.pill)}</span>${['live', 'delay'].includes(s.k) ? `<span class="hd-clock">${esc(s.when)}</span>` : ''}<span class="hd-tv">${esc(g.tv || '')}</span></header>
      ${row('away', A, g.as)}${row('home', H, g.hs)}
      ${g.note && s.k !== 'final' ? `<p class="hd-cnote">${esc(g.note)}</p>` : ''}
      <button type="button" class="hd-follow${on ? ' on' : ''}" data-hd-follow="${g.id}" aria-pressed="${on}" aria-label="${on ? 'Stop following' : 'Follow'} ${esc(A.name)} at ${esc(H.name)}">${ic(on ? 'check' : 'plus')}<span>${on ? 'Following' : 'Follow'}</span></button></article>`; }
  function gamesPage() { const G = D.games, t = ST.tab; let h = '';
    const grp = (title, list, sub) => list.length ? `<section class="hd-grp"><h3>${title}${sub ? `<small>${sub}</small>` : ''}</h3><div class="hd-cards">${list.map(card).join('')}</div></section>` : '';
    if (t === 'live') { const L = G.filter(g => ['live', 'half', 'delay'].includes(g.st)).sort((a, b) => order(a) - order(b));
      h = L.length ? grp('In progress', L) : `<div class="hd-empty">${ic('tv')}<h2>No games on right now</h2><p>Next up: ${esc(TEAMS[nextGame().away].name)} at ${esc(TEAMS[nextGame().home].name)}, ${esc(when(nextGame().ko))}.</p><button class="hd-well" type="button" data-hd-tab="upcoming">See what's coming up</button></div>`; }
    else if (t === 'upcoming') { const U = G.filter(g => ['pre', 'post'].includes(g.st)).sort((a, b) => a.ko - b.ko), slots = new Map();
      U.forEach(g => { const k = g.st === 'post' ? 'Postponed' : sameDay(g.ko, Date.now()) ? (new Date(g.ko).getHours() >= 18 ? `Tonight · ${tm.format(g.ko)}` : `This afternoon · ${tm.format(g.ko)}`) : `${wdl.format(g.ko)} · ${tm.format(g.ko)}`; if (!slots.has(k)) slots.set(k, []); slots.get(k).push(g); });
      h = [...slots].map(([k, list]) => grp(k, list, list[0].slot || '')).join(''); }
    else { const F = G.filter(g => g.st === 'final').sort((a, b) => b.ko - a.ko); h = grp(`Week ${D.week}`, F) + grp(`Week ${D.week - 1}`, D.last); }
    return head('Games', `Week ${D.week} · ${new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(Date.now())} · times are yours`) + banner() + h; }
  const nextGame = () => D.games.filter(g => g.st === 'pre').sort((a, b) => a.ko - b.ko)[0];

  /* Standings: a table per division */
  const pct = t => (t.w + t.t / 2) / Math.max(1, t.w + t.l + t.t);
  function divTable(conf, div, mark) { const list = D.teams.filter(t => t.conf === conf && t.div === div).sort((a, b) => pct(b) - pct(a) || b.w - a.w);
    return `<section class="hd-div"><h3>${conf} ${div}</h3><div class="hd-tbl"><div class="hd-th"><span></span><span>W</span><span>L</span><span>PCT</span><span>Streak</span></div>${list.map((t, i) => `<button type="button" class="hd-tr${t.id === mark ? ' me' : ''}" data-hd-team="${t.id}"><span class="hd-tt"><em>${i + 1}</em>${badge(t.id, 'xs')}<b>${esc(t.city === 'New York' || t.city === 'Los Angeles' ? t.city.replace('New York', 'NY').replace('Los Angeles', 'LA') + ' ' + t.name : t.name)}</b></span><span>${t.w}</span><span>${t.l}</span><span>${pct(t).toFixed(3).replace(/^0/, '')}</span><span class="${t.strk[0] === 'W' ? 'w' : 'l'}">${t.strk}</span></button>`).join('')}</div></section>`; }
  function standingsPage() { return head('Standings', `${ST.conf === 'AFC' ? 'American' : 'National'} Football Conference · after week ${D.week - 1}`) + `<div class="hd-divs">${['North', 'East', 'South', 'West'].map(d => divTable(ST.conf, d)).join('')}</div>`; }

  /* A team: record, standing, recent results, what's next */
  const placeIn = t => { const list = D.teams.filter(x => x.conf === t.conf && x.div === t.div).sort((a, b) => pct(b) - pct(a) || b.w - a.w); return list.indexOf(t) + 1; };
  const ord = n => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] || 'th');
  function teamPage(id) { const t = TEAMS[id]; W.style.setProperty('--hd-c', t.c1);
    const mine = all().filter(g => g.away === id || g.home === id), today = D.games.find(g => (g.away === id || g.home === id) && g.st !== 'final' && (sameDay(g.ko, Date.now()) || g.st === 'post'));
    const opp = (g) => g.away === id ? g.home : g.away, at = g => g.away === id ? '@' : 'vs';
    const res = mine.filter(g => g.st === 'final').sort((a, b) => b.ko - a.ko), poolA = D.teams.filter(x => x.id !== id).map(x => x.id), hs0 = [...id].reduce((h, c) => h * 17 + c.charCodeAt(0), 3);
    for (let k = 2; res.length < 4; k++) { const won = res.length < +t.strk.slice(1) ? t.strk[0] === 'W' : t.strk[0] !== 'W', a = 17 + (hs0 + k * 7) % 17, b = 6 + (hs0 + k * 3) % (a - 6), o = poolA[(hs0 + k * 11) % poolA.length], home = (hs0 + k) % 2 === 0;
      res.push({ id: 'x' + k, away: home ? o : id, home: home ? id : o, as: home ? (won ? b : a) : (won ? a : b), hs: home ? (won ? a : b) : (won ? b : a), st: 'final', q: 4, ko: Date.now() - k * 7 * 864e5 }); }
    const pool = D.teams.filter(x => x.id !== id && x.conf === t.conf).map(x => x.id), hsh = [...id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7);
    const ahead = mine.filter(g => g.st === 'pre' && !sameDay(g.ko, Date.now())).map(g => ({ g }));
    for (let k = 1; ahead.length < 3; k++) ahead.push({ opp: pool[(hsh + k * 5) % pool.length], home: (hsh + k) % 2 === 0, ko: new Date(Date.now() + k * 7 * 864e5).setHours(13 + (k % 3) * 3, k % 2 ? 0 : 25, 0, 0) });
    const resultRow = g => { const me = g.away === id ? g.as : g.hs, them = g.away === id ? g.hs : g.as, w = me > them; return `<div class="hd-rr"><span class="hd-wl ${w ? 'w' : 'l'}">${w ? 'W' : 'L'}</span><span class="hd-ro">${at(g)} ${badge(opp(g), 'xs')}<b>${esc(TEAMS[opp(g)].name)}</b></span><b class="hd-rs">${me}–${them}</b><small>${esc(when(g.ko))}</small></div>`; };
    const aheadRow = x => { const o = x.g ? opp(x.g) : x.opp, ko = x.g ? x.g.ko : x.ko, home = x.g ? x.g.home === id : x.home; return `<div class="hd-rr"><span class="hd-ro">${home ? 'vs' : '@'} ${badge(o, 'xs')}<b>${esc(TEAMS[o].name)}</b></span><small>${esc(md.format(ko))} · ${esc(tm.format(ko))}</small></div>`; };
    return `<header class="hd-team" style="--c1:${t.c1};--c2:${t.c2}">${badge(id, 'xl')}<span><small>${esc(t.city)}</small><h1>${esc(t.name)}</h1><p><b>${rec(t)}</b> · ${ord(placeIn(t))} in the ${t.conf} ${t.div} · ${t.strk[0] === 'W' ? 'won' : 'lost'} the last ${t.strk.slice(1)}</p></span></header>
      ${today ? `<section class="hd-sec"><h3>${today.st === 'post' ? 'Postponed' : 'Today'}</h3><div class="hd-cards one">${card(today)}</div></section>` : ''}
      <div class="hd-cols"><section class="hd-sec"><h3>Coming up</h3><div class="hd-list">${ahead.slice(0, 3).map(aheadRow).join('')}</div></section>
        <section class="hd-sec"><h3>Recent results</h3><div class="hd-list">${res.slice(0, 4).map(resultRow).join('') || '<p class="hd-none">No games yet this season.</p>'}</div></section></div>
      <section class="hd-sec">${divTable(t.conf, t.div, id)}</section>`; }
  function search() { const q = ST.q.trim().toLowerCase(), list = D.teams.filter(t => (t.city + ' ' + t.name + ' ' + t.id).toLowerCase().includes(q));
    return head('Teams', `Matching “${esc(ST.q.trim())}”`) + (list.length ? `<div class="hd-list wide">${list.map(t => `<button type="button" class="hd-rr btn" data-hd-team="${t.id}"><span class="hd-ro">${badge(t.id, 'sm')}<b>${esc(t.city)} ${esc(t.name)}</b></span><small>${rec(t)} · ${t.conf} ${t.div}</small></button>`).join('')}</div>` : `<p class="hd-none">No team called that.</p>`); }
  function loading() { const sk = `<article class="hd-board sk"><header><span class="hd-skl" style="width:64px"></span></header>${'<div class="hd-trow"><i class="hd-skc"></i><span class="hd-skl" style="width:40%"></span><span class="hd-skl" style="width:34px;margin-left:auto;height:28px"></span></div>'.repeat(2)}<footer><span class="hd-skl" style="width:50%"></span></footer></article>`;
    return `<header class="hd-head"><h1>Following</h1><p class="hd-sub f-aging"><i></i>Getting the latest scores…</p></header><div class="hd-boards n2">${sk}${sk}</div>`; }
  function errorPage() { return head('Following') + `<div class="hd-empty">${ic('circle-alert')}<h2>Huddle can't reach the scores</h2><p>Check your connection, or try again in a moment. Your games are saved.</p><button class="hd-key" type="button" data-hd-retry>${ic('refresh-cw')}Try again</button></div>`; }

  /* the page's top right: the views of the page you're on */
  function corner() { const el = q$('#hd-corner'); if (!el) return; let h = '';
    const seg = (opts, attr, cur) => `<div class="seg hd-seg" role="tablist"><i class="ind"></i>${opts.map(([k, l]) => `<button type="button" role="tab" class="${cur === k ? 'on' : ''}" ${attr}="${k}">${l}</button>`).join('')}</div>`;
    if (ST.team && mode() !== 'phone') { el.innerHTML = `<div class="hd-cbtn">${starBtn(ST.team)}</div>`; el.hidden = false; return; }
    if (!ST.team && !ST.q.trim() && !ST.loading) { if (ST.place === 'games') { const n = D.games.filter(g => ['live', 'half', 'delay'].includes(g.st)).length; h = seg([['live', `Live${n ? ` <small>${n}</small>` : ''}`], ['upcoming', 'Upcoming'], ['results', 'Results']], 'data-hd-tab', ST.tab); }
      else if (ST.place === 'standings') h = seg([['AFC', 'AFC'], ['NFC', 'NFC']], 'data-hd-conf', ST.conf); }
    el.innerHTML = h; el.hidden = !h; requestAnimationFrame(() => K.segs?.()); }
  /* the action bar: what you can do here */
  function bar() { const b = q$('#hd-bar'); if (!b) return; let h = ''; const F = followed(), ph = mode() === 'phone';
    if (ST.loading) h = '';
    else if (ST.team) h = '';
    else if (broken() && !ST.upd0) h = '';
    else if (ST.place === 'following' && F.length) h = ST.edit ? `<span class="hd-said">Tap ${ic('x')} to stop following a game</span><button class="hd-key" type="button" data-hd-edit>Done</button>`
      : `<button class="hd-well" type="button" data-hd-edit>${ic('square-pen')}${ph ? '' : 'Edit'}</button><button class="hd-key" type="button" data-hd-place="games">${ic('plus')}Add games</button>`;
    else if (ST.place === 'games' && F.length) h = `<button class="hd-key" type="button" data-hd-place="following">${ic('star')}Following · ${F.length}</button>`;
    b.innerHTML = h; b.hidden = !h; }

  function paint() { if (!W) return; ['wide', 'mid', 'tport', 'phone'].forEach(k => W.classList.toggle('hd-' + k, mode() === k)); side(); page(); }
  function go(p) { ST.place = p; ST.team = null; ST.q = ''; ST.edit = false; W.classList.remove('navopen'); paint(); }
  function openTeam(id) { if (!ST.team) ST.back = ST.place; ST.team = id; ST.q = ''; W.classList.remove('navopen'); paint(); }
  function back() { ST.team = null; paint(); }

  function render(k) { if (k) K = k; W = document.getElementById('w-huddle'); if (!W || !K) return; if (!ST.follow) { loadFollow(); ST.upd = MODE === 'stale' || MODE === 'offline' || MODE === 'error' ? Date.now() - 194e3 : Date.now(); ST.upd0 = MODE !== 'error'; }
    frame(); lastMode = mode(); paint(); }
  function click(e) { const t = e.target, h = s => t.closest(s); if (!W || !h('#w-huddle')) return false; let b;
    if ((b = h('[data-hd-follow]'))) { toggle(b.dataset.hdFollow); return true; }
    if ((b = h('[data-hd-star]'))) { star(b.dataset.hdStar); return true; }
    if ((b = h('[data-hd-place]'))) { go(b.dataset.hdPlace); return true; }
    if ((b = h('[data-hd-team]'))) { openTeam(b.dataset.hdTeam); return true; }
    if (h('[data-hd-back]')) { back(); return true; }
    if ((b = h('[data-hd-tab]'))) { ST.place = 'games'; ST.tab = b.dataset.hdTab; page(); return true; }
    if ((b = h('[data-hd-conf]'))) { ST.conf = b.dataset.hdConf; page(); return true; }
    if (h('[data-hd-edit]')) { ST.edit = !ST.edit; ST.keep = true; page(); return true; }
    if (h('[data-hd-retry]')) { K.lToast(W, 'Trying again…', { icon: 'refresh-cw' }); return true; }
    return false; }

  /* the clock runs every second; the API answers every 15 */
  setInterval(() => { tick(); if (W && !W.hidden && !ST.loading) { const p = q$('#hd-page'); if (p && (ST.place === 'following' || ST.place === 'games' || ST.team) && !ST.q.trim()) { ST.keep = true; page(); } if (Date.now() % 5000 < 1000) side(); } share(); }, 1000);
  setInterval(poll, 15000);
  if (ST.loading) setTimeout(() => { if (MODE === 'loading') return; ST.loading = false; paint(); }, 1800);

  /* companions read this: the shelf's live extension and the phone's Now panel */
  function compact(cls) { const F = followed(); if (!F.length) return ''; const old = asOf();
    return F.slice(0, 3).map(g => { const s = status(g); return `<span class="hd-mini ${cls || ''} k-${s.k}${old && ['live', 'delay'].includes(g.st) ? ' old' : ''}">${badge(g.away, 'xs')}<b class="${leads(g, 'away') ? 'lead' : ''}">${scored(g) ? g.as : g.away}</b><i>${scored(g) ? '–' : '@'}</i><b class="${leads(g, 'home') ? 'lead' : ''}">${scored(g) ? g.hs : g.home}</b>${badge(g.home, 'xs')}<small>${esc(s.k === 'live' || s.k === 'delay' ? s.when : s.pill)}</small></span>`; }).join(''); }
  function nowTile() { if (!ST.follow) loadFollow(); const F = followed(); if (!F.length) return '';
    return `<div class="lt hd-lt" data-open="huddle"><span class="pic hd-pic"><img src="${(K && K.A) || '../icons/Suno-v4-'}huddle.svg" alt=""></span><span class="tx hd-ltx">${compact('inow')}</span></div>`; }
  window.LumaHuddle = { render, click, state: ST, followed, status, badge, teams: TEAMS, fresh, freshLine, compact, nowTile, toggle, open: id => { go(id || 'following'); } };
})();
