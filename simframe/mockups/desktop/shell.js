/* Luma desktop shell: Shelf take two (mockups/shelf-2.html), mounted over the desktop in Studio's Desktop view.
   Its code is kept as it was; the bridge (window.lumaDesk) connects it to Luma's real windows and Settings. */
(() => {
(() => {
  'use strict';
  const desk = document.getElementById('desk'), host = document.createElement('div'); host.id = 'lshell'; desk.appendChild(host);
  const ROOT = host.attachShadow({ mode: 'open' });
  ROOT.innerHTML = `<link rel="stylesheet" href="desktop/shell.css"><div class="screen" id="scr" data-theme="dark" data-mat="solid" data-icon="lit" data-shape="squircle">
    <div class="row" id="row-bottom"><div class="slot s"></div><div class="slot c"></div><div class="slot e"></div></div>
    <div class="row" id="row-top"><div class="slot s"></div><div class="slot c"></div><div class="slot e"></div></div>
    <div class="row" id="row-left"><div class="slot s"></div><div class="slot c"></div><div class="slot e"></div></div>
    <div class="row" id="row-right"><div class="slot s"></div><div class="slot c"></div><div class="slot e"></div></div>
    <div class="free" id="free"></div><div id="tucks"></div>
    <div class="nl idle" id="nl"><div class="clip" id="nclip"><div class="inner" id="ninner"></div><i class="glow"></i></div></div>
    <div class="pop" id="pop"></div><div class="tip" id="tip"></div><div class="plate" id="plate"></div></div>`;
  const $ = (s, r = ROOT) => r.querySelector(s), $$ = (s, r = ROOT) => [...r.querySelectorAll(s)];
  const L = window.lumaDesk;   // the bridge to Luma's windows and Settings
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const scr = $('#scr'), INS = 14, WG = 10; let W = desk.clientWidth, H = desk.clientHeight;
  const U = p => new URL(p, location.href).href, GL = U('../icons/'), PH = U('../social-luma/photos/');   // absolute: the shell's stylesheet lives in desktop/
  let IC = U('../icons/luma-v4-');   // D-Ink swaps it for the line drawings
  const store = { get(k, d) { try { const v = localStorage.getItem('lshell-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('lshell-' + k, JSON.stringify(v)); } catch (e) {} } };

  /* Glyphs: Lucide from ../icons, plus the few it lacks. */
  const SV = p => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const SVF = p => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  // Every glyph is a Lucide file. The transport (play, pause, skip) uses Lucide's own shapes, filled, so they read at small sizes.
  const CUSTOM = { play: SVF('<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>'), pause: SVF('<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>'),
    'skip-back': SVF('<path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"/><path d="M3 20V4" fill="none"/>'), 'skip-forward': SVF('<path d="M21 4v16" fill="none"/><path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"/>'), hotspot: null };
  const G = n => { n = n === 'hotspot' ? 'radio-tower' : n; return `<i class="g" style="--i:url('${CUSTOM[n] ? 'data:image/svg+xml,' + encodeURIComponent(CUSTOM[n]) : GL + n + '.svg'}')"></i>`; };

  /* ── State ─────────────────────────────────────────────────────────────── */
  const PRESETS = {
    luma: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'center', surface: 'separate', attach: 'float', tuck: false },
    onebar: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'center', surface: 'joined', attach: 'float', tuck: false },
    grown: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'center', surface: 'joined', attach: 'prot', tuck: false },
    taskbar: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'spread', surface: 'joined', attach: 'prot', tuck: false },
    split: { edge: { dock: 'bottom', live: 'top', status: 'top' }, align: 'spread', surface: 'separate', attach: 'float', tuck: false },
    side: { edge: { dock: 'left', live: 'left', status: 'left' }, align: 'center', surface: 'separate', attach: 'float', tuck: false },
    tabs: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'spread', surface: 'separate', attach: 'prot', tuck: false },
    free: { attach: 'free', tuck: false }
  };
  const S = Object.assign({ clock: 'glance', soonAt: 0, offline: false, low: false, preset: 'luma', theme: 'dark', mat: 'solid', icon: 'lit', shape: 'squircle', size: 45, tiling: false, notif: 'center', dnd: false, free: {} }, PRESETS.luma, store.get('state', {})); S.liveMax = 2;   // recomputed for this screen on every load
  S.edge = Object.assign({}, PRESETS.luma.edge, S.edge);
  S.size = new URLSearchParams(location.search).get('status') === 'line' ? 30 : 45;   /* the one-line concept: 30 px icons, 7 px round them. Otherwise the dock's icons are 45 px with 11 px around them (25 Oct 2026); no setting changes it, so an older stored 40 is replaced */
  const save = () => store.set('state', { clock: S.clock, preset: S.preset, theme: S.theme, mat: S.mat, icon: S.icon, shape: S.shape, size: S.size, tiling: S.tiling, notif: S.notif, edge: S.edge, align: S.align, surface: S.surface, attach: S.attach, tuck: S.tuck, free: S.free });

  /* ?showcase=1: the website's "Try it yourself" preview (Nick, 14 Oct 2026). The apps worth showing are in the dock (not utilities like Contacts or Viewer), and the
     music player's live tile steps aside to make room. Studio and the Design Center never pass it, so nothing changes there. */
  const SHOWCASE = new URLSearchParams(location.search).has('showcase');
  /* The showcase used to pin 24 apps; since the launcher (25 Oct) the website shows the same shelf as everywhere else (27 Oct 2026). */
  /* pins whose app is not on the shelf (the showcase drops the mockup-only apps) are left out of the dock */
  const PIN = ['filer', 'viola', 'tide', 'youtube', 'discord', 'messages', 'charlie', 'notes', 'write', 'photos', 'calendar', 'term', 'depot', 'settings'];
  const LDK = a => document.querySelector(`.shelf .dk[data-app="${a}"]`), LICON = a => LDK(a)?.querySelector('img')?.getAttribute('src') || '', LNAME = a => LDK(a)?.getAttribute('aria-label') || a;
  const ALL = () => [...document.querySelectorAll('.shelf .dk[data-app]')].map(d => d.dataset.app).filter(a => a !== 'picker' && a !== 'modal' && !(SHOWCASE && a === 'playground'));
  let RUN = new Set(), APPS = [];
  const NAPP = { messages: 'messages', calendar: 'calendar', 'app-store': 'depot', phone: 'phone', files: 'filer', mail: 'charlie' };
  let FOCUS = '', BADGE = 0;

  const TRACKS = [['Wouldn’t It Be Nice', 153], ['God Only Knows', 175], ['Sloop John B', 178], ['Caroline, No', 172]];
  const M = { on: true, playing: true, i: 1, t: 64 };
  const PRIYA = { n: 'Priya Raman', face: ['life-ari-street', .705, .2, 5.2] };
  const C = { on: false, t0: 0, muted: false, video: false, share: false };
  const faceBg = (p, sz) => { const [f, fx, fy, z] = p.face, w = sz * z, h = w * 9 / 16; return `background-image:url(${PH}${f}.webp);background-size:${w}px ${h}px;background-position:${-(fx * w - sz / 2)}px ${-(fy * h - sz / 2)}px`; };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ── Islands ───────────────────────────────────────────────────────────── */
  const isl = {};
  function mkIsland(id, cls) { const d = document.createElement('div'); d.className = 'island ' + cls; d.dataset.id = id; isl[id] = d; return d; }
  mkIsland('dock', 'dock'); mkIsland('status', 'status'); mkIsland('sysg', 'status sysg'); mkIsland('fold', 'folders'); mkIsland('music', 'live lmusic'); mkIsland('call', 'live lcall'); mkIsland('wx', 'live lwx'); mkIsland('ev', 'live lev'); mkIsland('rec', 'live lrec'); mkIsland('tg', 'live ltg'); mkIsland('nfl', 'live lnfl');
  const icon = (id, n, extra = '') => `<button class="dapp${RUN.has(id) ? ' run' : ''}${id === FOCUS ? ' focus' : ''}${extra}" type="button" data-app="${id}" data-tip="${n}"><span class="ic" style="background-image:url(${LICON(id)})"></span>${id === 'messages' && BADGE ? `<b class="badge">${BADGE}</b>` : ''}<i class="dot"></i></button>`;
  // Redrawing an island must not strand an open panel: re-anchor it to the redrawn button
  function keepExp(i, html) { let c = i.querySelector(':scope > .cmp'); if (!c) { i.innerHTML = '<div class="cmp"></div><div class="exp"></div>'; c = i.firstChild; }
    const held = typeof popAnchor !== 'undefined' && popAnchor && c.contains(popAnchor) ? popAnchor.dataset.act : null; c.innerHTML = html;
    if (held) { const n = c.querySelector(`[data-act="${held}"]`); if (n) { popAnchor = n; n.classList.add('act'); } } }
  function renderDock() { keepExp(isl.dock, (FOLDON ? LAUNCH : '') + (APPS = [...PIN.filter(LDK), ...[...RUN].filter(a => !PIN.includes(a))]).map(id => icon(id, LNAME(id))).join('')); }
  function renderStatus() { if (S.clock !== 'classic') return renderStatus2(); keepExp(isl.status, `<button class="clk" type="button" data-act="cal" data-tip="Calendar"><b id="clk-t"></b><small id="clk-d"></small></button><button class="qt" type="button" data-act="qs" data-tip="Quick Options">${G('wifi')}${G('volume-2')}${S.dnd ? `<span class="dnd">${G('moon')}</span>` : G('bluetooth')}${G('battery')}</button>`); tickClock(); }
  /* ── Live tiles are built from these parts only, so they stay one family ──
     lkPic: the 40px picture · lkCopy: title + grey line · lkHero: the big number + grey line
     lkWell: a 32px round control · lkKey: the tile's one main act (40px, white) */
  const lkPic = (url, cls = '') => `<span class="art${cls ? ' ' + cls : ''}" style="background-image:url(${url})"></span>`;
  const lkCopy = (t, sub) => `<span class="lcopy"><b>${t}</b><small>${sub}</small></span>`;
  const lkHero = (v, sub, id = '') => `<span class="lhero"><b${id ? ` id="${id}"` : ''}>${v}</b><small>${sub}</small></span>`;
  const lkWell = (act, g, label, extra = '') => `<button class="q" type="button" data-act="${act}" aria-label="${label}" data-tip="${label}">${G(g)}</button>`;
  const lkKey = (act, g, label, inner = '') => `<button class="q main" type="button" data-act="${act}" aria-label="${label}" data-tip="${label}">${inner}${G(g)}</button>`;
  /* Huddle's live extension: the games you follow, a line each; it grows into their scoreboards. Huddle owns the data (window.LumaHuddle). */
  const HUD = () => window.LumaHuddle, hudOn = () => (HUD()?.followed() || []).length > 0;
  function hudRows(big) { const H = HUD(), F = H.followed(), T = H.teams, old = ['stale', 'offline', 'error'].includes(H.fresh());
    const mark = id => `<i class="nfb" style="--c1:${T[id].c1};--c2:${T[id].c2}"><b>${id}</b></i>`;
    return F.slice(0, big ? 6 : 2).map(g => { const s = H.status(g), sc = !['pre', 'post'].includes(g.st), lead = side => sc && (side === 'a' ? g.as > g.hs : g.hs > g.as);
      const when = esc(s.k === 'live' || s.k === 'delay' ? s.when.replace(' · ', ' ') : s.pill), cls = `nfr k-${s.k}${old && ['live', 'delay'].includes(g.st) ? ' old' : ''}`;
      if (!big) { const row = (id, v, l) => `<span class="nfx${l ? ' ld' : ''}"><i style="--c:${T[id].c1}"></i><em>${id}</em><b>${sc ? v : ''}</b></span>`;
        const [q, c] = s.k === 'live' || s.k === 'delay' ? [g.q === 5 ? 'OT' : 'Q' + g.q, s.k === 'delay' ? 'Delay' : s.when.split(' · ')[1]] : s.k === 'half' ? ['Half', ''] : s.k === 'final' ? ['Final', g.q === 5 ? 'OT' : ''] : s.k === 'post' ? ['PPD', ''] : [s.pill.split(' ')[0], s.pill.split(' ')[1] || ''];
        return `<span class="${cls} box"><span class="nfrows">${row(g.away, g.as, lead('a'))}${row(g.home, g.hs, lead('h'))}</span><span class="nfst"><b>${q}</b>${c ? `<small>${c}</small>` : ''}</span></span>`; }
      return `<span class="${cls}">${mark(g.away)}<b class="${lead('a') ? 'ld' : ''}">${sc ? g.as : ''}</b><em>${sc ? '–' : '@'}</em><b class="${lead('h') ? 'ld' : ''}">${sc ? g.hs : ''}</b>${mark(g.home)}<small>${when}</small></span>`; }).join(''); }
  function renderNfl() { if (!HUD()) return; keepExp(isl.nfl, `<button class="lhit nfhit" type="button" data-act="nfl" data-tip="Huddle · ${HUD().freshLine()[1]}">${hudRows()}</button>`); }
  let hudWas = null; window.addEventListener('huddle-update', () => { const on = hudOn(); if (hudWas !== null && on !== hudWas) { hudWas = on; renderNfl(); layout(); return; } hudWas = on; if (!isl.nfl.isConnected) return; renderNfl(); if (grownKind === 'nfl') refreshPop(); });
  function renderMusic() { const [tt, d] = TRACKS[M.i];
    keepExp(isl.music, `<button class="lhit" type="button" data-act="music" data-tip="${esc(tt)}"><span class="art" style="background-image:url(${PH}pet-sounds.webp)"></span><span class="lcopy"><b>${esc(tt)}</b><small>The Beach Boys</small></span></button>
      <span class="lctl">${lkWell('mprev', 'skip-back', 'Previous')}<button class="q main" type="button" data-act="mplay" aria-label="${M.playing ? 'Pause' : 'Play'}">${G(M.playing ? 'pause' : 'play')}</button>${lkWell('mnext', 'skip-forward', 'Next')}</span>`); }
  /* Weather, live: now, then the next three days. Opens Weather. */
  const WXL = { t: 59, c: 'cloud-rain', where: 'Light rain', days: [['Fri', 'cloud-sun', 74], ['Sat', 'sun', 69], ['Sun', 'cloud', 67]] };
  /* Upcoming event: the calendar's own mark, what and when, and one key to join */
  const EVL = { on: true, t: 'Walkthrough', at: 0, len: 45, forced: false };
  const evAt = () => EVL.forced ? EVL.at : (S.soonAt || new Date().setHours(19, 30, 0, 0));
  function renderEv() { const at0 = evAt(), st = new Date(at0), en = new Date(at0 + EVL.len * 60e3), f = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, ''), m = Math.max(0, Math.round((at0 - Date.now()) / 60e3));
    keepExp(isl.ev, `<button class="lhit" type="button" data-app="calendar" data-tip="${esc(EVL.t)}">${lkPic(LICON('calendar'), 'appic')}${lkCopy(esc(EVL.t), `${f(st)} – ${f(en)} · ${m ? `${m} min` : 'now'}`)}</button><span class="lctl">${lkKey('evjoin', 'video', 'Join')}</span>`); }
  /* Recording: time, a live waveform, pause, stop */
  const RCL = { on: false, t0: Date.now() - 14e3, paused: false, acc: 0 };
  const recSecs = () => Math.floor((RCL.paused ? RCL.acc : RCL.acc + Date.now() - RCL.t0) / 1000);
  function renderRec() { keepExp(isl.rec, `<button class="lhit" type="button" data-app="memo" data-tip="Recording in Memos"><span class="recdot${RCL.paused ? ' p' : ''}"></span><b class="rect lheronum" id="rec-t">${mmss(recSecs())}</b><span class="recwave${RCL.paused ? ' p' : ''}">${Array.from({ length: 14 }, (_, i) => `<i style="--d:${(i * 0.13 % 1).toFixed(2)}s;--h:${[.5, .8, .4, 1, .7, .55, .9, .45, .75, .6, 1, .5, .7, .4][i]}"></i>`).join('')}</span></button><span class="lctl">${lkWell('recpause', RCL.paused ? 'mic' : 'pause', RCL.paused ? 'Resume' : 'Pause')}${lkKey('recstop', 'square', 'Stop and save').replace('q main', 'q main stop')}</span>`); }
  /* Quick toggles: the five things people flip most, round and lit when on */
  const TGL = { on: false, wifi: true, bt: true, bright: false, dnd: false, kb: false };
  function renderTg() { const t = (k, g, n) => `<button class="q tog${TGL[k] ? ' on' : ''}" type="button" data-act="tg:${k}" aria-label="${n}" data-tip="${n}">${G(g)}</button>`;
    keepExp(isl.tg, `<span class="lctl tgs">${t('wifi', 'wifi', 'Wi‑Fi')}${t('bt', 'bluetooth', 'Bluetooth')}${t('bright', 'sun-medium', 'Auto brightness')}${t('dnd', 'moon', 'Do Not Disturb')}${t('kb', 'keyboard', 'Keyboard backlight')}</span>`); }
  function renderWx() { keepExp(isl.wx, `<button class="lhit wxhit" type="button" data-act="wx" data-tip="Oakland · ${WXL.where}">${lkHero(`${WXL.t}°`, WXL.where)}<span class="wxdays">${WXL.days.map(([d, c, t]) => `<span><small>${d}</small>${G(c)}<b>${t}°</b></span>`).join('')}</span></button>`); }
  function renderCall() { keepExp(isl.call, `<button class="lhit" type="button" data-act="call" data-tip="Call with ${PRIYA.n}"><span class="art face" style="${faceBg(PRIYA, S.size)}"></span><span class="lcopy"><b>${PRIYA.n}</b><small data-bind="ct">0:00</small></span></button>
      <span class="lctl"><button class="q" type="button" data-act="mute" aria-label="Mute">${G(C.muted ? 'mic-off' : 'mic')}</button><button class="q main key-red" type="button" data-act="hang" aria-label="End call">${G('phone-off')}</button></span>`); tickCall(); }
  /* The line under the time: the date, unless something is about to happen. */
  function ctxLine() { const now = Date.now(); let at = S.soonAt, name = 'Walkthrough';
    if (!at) { const d = new Date(); d.setHours(19, 30, 0, 0); at = d.getTime(); }
    const m = Math.round((at - now) / 60e3);
    if (!S.clockEvents) { /* events live in their own tile now */ }
    const t = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return { t: SVAR === 'panel' || SVAR === 'line' ? t.replace(',', '') : t, soon: false }; }   /* panel: "Sun Oct 25", no comma (a date format setting can come later) */
  function statusBits() { const x = [], n = [], out = QD.out === 'buds' ? 'headphones' : QD.out === 'room' ? 'speaker' : 'volume-2';
    if (C.on && !C.muted) x.push(`<span class="x chip priv" title="Microphone in use">${G('mic')}Mic on</span>`);
    if (S.dnd) x.push(`<span class="x" title="Do Not Disturb">${G('moon')}</span>`);
    if (S.offline) x.push(`<span class="x warn" title="No internet">${G('wifi-off')}</span>`); else n.push(`<span class="n" title="Studio North">${G('wifi')}</span>`);
    (QD.vol === 0 ? x : n).push(`<span class="${QD.vol === 0 ? 'x' : 'n'}">${G(QD.vol === 0 ? 'volume-x' : out)}</span>`);
    if (S.low) x.push(`<span class="x chip low" title="Battery low">${G('battery-low')}14%</span>`); else n.push(`<span class="n"><span class="batt" style="--b:.74"><i></i></span></span>`);
    if (S.clock === 'glance') return [...x, ...n.filter(h => !h.includes('Studio North'))].join('');
    return [...x, ...n].join(''); }
  function renderStatus2() { if (SVAR) return renderVariant(); keepExp(isl.status, `<button class="sx" type="button" data-act="qs" data-tip="Quick Options">${statusBits()}</button><span class="vr"></span><button class="clk2" type="button" data-act="cal" data-tip="Calendar"><span class="ev" id="clk-e" hidden></span><b id="clk-t"></b><small id="clk-c"></small></button>`); tickClock(); }
  function tickClock() { if (S.clock !== 'classic') { const d = new Date(), t = $('#clk-t'), c = $('#clk-c'); if (t) t.innerHTML = `${(d.getHours() % 12) || 12}:${String(d.getMinutes()).padStart(2, '0')}<em>${d.getHours() < 12 ? 'AM' : 'PM'}</em>`;
      if (c) { const l = ctxLine(); if (c.textContent !== l.t) c.textContent = l.t; c.classList.toggle('soon', l.soon); }
      const ev = $('#clk-e'); if (ev) { const at = S.soonAt || new Date().setHours(19, 30, 0, 0), m = Math.round((at - Date.now()) / 60e3), txt = m > 0 && m <= 60 ? m + ' min' : m <= 0 && m > -30 && S.soonAt ? 'Now' : ''; ev.hidden = !txt; const h = txt ? `${G('calendar')}${txt}` : ''; if (ev.innerHTML !== h) ev.innerHTML = h; } return; } const d = new Date(), t = $('#clk-t'), s = $('#clk-d'), vert = isl.status.closest('.row.v');
    if (t) t.textContent = `${(d.getHours() % 12) || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (s) s.textContent = vert ? (d.getHours() < 12 ? 'AM' : 'PM') : d.toLocaleDateString([], { weekday: 'short', day: 'numeric' }); }
  function tickCall() { if (!C.on) return; const s = (Date.now() - C.t0) / 1000; $$('[data-bind="ct"]').forEach(e => e.textContent = C.muted ? `Muted · ${mmss(s)}` : mmss(s)); }


  /* ══ The clock island, two directions (25 Oct 2026; ?status=panel | ?status=glance) ════════════════════════════
     It holds the time and date, the system (network, mobile data, VPN, Bluetooth, camera and microphone in use, sound,
     battery, and anything an extension adds) and the apps that keep running with no window.
       panel   everything visible, organised: apps in a 2×2 grid, the system in two rows (connection; state), the
               time and date. Each zone opens its own panel: the apps lift into a tray of icons above the island.
       glance  a calm row of what matters most (camera in use, network, battery, the app that needs you, the time),
               and one sheet that lists everything with words: every indicator, every running app, any extension. */
  /* the shelf: panel is the current one (launcher, pinned apps, folders, system grid, clock); ?status=islands is the older live-tile shelf, line and glance are concepts */
  const SVAR = { islands: '', '': 'panel' }[new URLSearchParams(location.search).get('status') || ''] ?? new URLSearchParams(location.search).get('status');
  const PADV = SVAR === 'line' ? 7 : 11;   /* the padding round the shelf's contents; the shelf's height is the icon plus twice this */
  const MK = U('apps/depot/marks/');
  const TRAY = [
    { id: 'discord', n: 'Discord', bg: '#5865F2', st: 'attn', badge: 2, line: '2 mentions in #launch', menu: [['open', 'Open Discord', 'app-window'], ['mute', 'Mute for an hour', 'bell-off'], ['quit', 'Quit Discord', 'x']] },
    { id: 'nextcloud', n: 'Nextcloud', bg: '#0082C9', st: 'busy', prog: .62, line: 'Syncing 14 files', menu: [['folder', 'Open the folder', 'folder-open'], ['pause', 'Pause syncing', 'pause'], ['quit', 'Quit Nextcloud', 'x']] },
    { id: 'bitwarden', n: 'Bitwarden', bg: '#175DDC', st: 'idle', line: 'Locked', menu: [['unlock', 'Unlock', 'lock-open'], ['gen', 'Make a password', 'key-round'], ['quit', 'Quit Bitwarden', 'x']] },
    { id: 'signal', n: 'Signal', bg: '#3B45FD', st: 'idle', line: 'Nothing new', menu: [['open', 'Open Signal', 'app-window'], ['quit', 'Quit Signal', 'x']] },
    { id: 'steam', n: 'Steam', bg: '#1B2838', st: 'idle', line: 'Your games are up to date', menu: [['open', 'Open Steam', 'app-window'], ['quit', 'Quit Steam', 'x']] },
  ];
  let TCUR = '';
  const tApp = id => TRAY.find(a => a.id === id);
  const tFace = (a, cls = '') => `<i class="tf ${cls} st-${a.st}" style="--c:${a.bg};--m:url('${MK}${a.id}.svg')">${a.badge ? `<em>${a.badge}</em>` : ''}${a.st === 'busy' ? '<b class="tbusy"></b>' : ''}</i>`;
  const tBtn = (a, cls = '') => `<button class="tb ${cls}" type="button" data-act="tapp" data-app="${a.id}" aria-label="${esc(a.n)}, ${esc(a.line)}">${tFace(a)}</button>`;
  /* the system, as indicators: connection (row one), then what's in use and the machine's state (row two). Extensions add here. */
  const BAT = '<span class="batt" style="--b:.74"><i></i></span>';
  function sysList() { const out = QD.out === 'buds' ? 'headphones' : QD.out === 'room' ? 'speaker' : 'volume-2', I = [];
    I.push(S.offline ? { k: 'wifi', g: 'wifi-off', n: 'Wi-Fi', v: 'No internet', row: 1, tone: 'warn' } : { k: 'wifi', g: 'wifi', n: 'Wi-Fi', v: 'Studio North', row: 1 });
    I.push({ k: '5g', txt: '5G', n: 'Mobile data', v: '5G · strong signal', row: 1 });
    I.push({ k: 'vpn', g: 'shield-check', n: 'VPN', v: 'Mullvad · connected', row: 1 });
    I.push({ k: 'bt', g: 'bluetooth', n: 'Bluetooth', v: 'Headphones connected', row: 1 });
    I.push({ k: 'cam', g: 'camera', n: 'Camera', v: 'In use by Viola', row: 2, tone: 'cam' });
    if (C.on && !C.muted) I.push({ k: 'mic', g: 'mic', n: 'Microphone', v: 'In use by the call', row: 2, tone: 'mic' });
    if (S.dnd) I.push({ k: 'dnd', g: 'moon', n: 'Do Not Disturb', v: 'On until you turn it off', row: 2 });
    I.push({ k: 'caf', g: 'coffee', n: 'Caffeine', v: 'Keeping the screen awake', row: 2, ext: true });
    I.push({ k: 'snd', g: QD.vol === 0 ? 'volume-x' : out, n: 'Sound', v: QD.vol === 0 ? 'Muted' : '72% · headphones', row: 2 });
    I.push({ k: 'bat', bat: true, n: 'Battery', v: S.low ? '14% · plug in soon' : '74% · about 4 hours left', row: 2, tone: S.low ? 'warn' : '' });
    return I; }
  const glyph = i => i.bat ? BAT : i.txt ? `<b class="gtx">${i.txt}</b>` : G(i.g);
  const ind = i => `<span class="ind k-${i.k}${i.tone ? ' t-' + i.tone : ''}" title="${esc(i.n)} · ${esc(i.v)}">${glyph(i)}</span>`;
  const clockZone = () => `<button class="pz pzc" type="button" data-act="cal" data-tip="Calendar"><b id="clk-t"></b><small id="clk-c"></small></button>`;
  function renderVariant() { const I = sysList(); if (SVAR !== 'panel' && SVAR !== 'line') { delete isl.status.dataset.act; delete isl.status.dataset.tip; }
    if (SVAR === 'panel') {
      /* apps: one big, two side by side, or a 2×2 grid; past four the last cell says how many more */
      const n = TRAY.length, show = n > 4 ? TRAY.slice(0, 3) : TRAY, more = n > 4 ? n - 3 : 0;
      /* the system is a real grid: two rows (connection; in use and state), as many columns as the longer row (four at most), every cell the same size */
      const rowOf = r => { const list = I.filter(i => i.row === r); return list.length > 4 ? [...list.slice(0, 3).map(ind), `<span class="ind more">+${list.length - 3}</span>`] : list.map(ind); };
      const r1 = rowOf(1), r2 = rowOf(2), cols = Math.max(r1.length, r2.length), cell = h => `<span class="pc">${h || ''}</span>`;
      const pad = r => [...r, ...Array(cols - r.length).fill('')].map(cell).join('');
      const apps = [...show.map(a => tFace(a, 'pa')), ...(more ? [`<span class="pmore">+${more}</span>`] : [])], acols = apps.length > 2 ? 2 : apps.length;
      /* the apps grid is set aside for now (25 Oct 2026); apps, acols and the tray stay for when it returns */
      /* two islands: the system grid, and the time and date. Each island is one target: it lights and opens as a whole */
      keepExp(isl.sysg, `<span class="pz pzs"><span class="pgrid" style="--cols:${cols}">${pad(r1)}${pad(r2)}</span></span>`);
      keepExp(isl.status, `<span class="pz pzc"><b id="clk-t"></b><small id="clk-c"></small></span>`);
      isl.sysg.dataset.act = 'qs'; isl.sysg.dataset.tip = 'Quick Options'; isl.status.dataset.act = 'cal'; isl.status.dataset.tip = 'Calendar';
    } else if (SVAR === 'line') {
      /* one line: the indicators in one row, grouped (what's in use · connection · state), then the date and time on one line */
      const grp = g => I.filter(g).map(ind).join(''), use = grp(i => i.tone === 'cam' || i.tone === 'mic'), con = grp(i => i.row === 1), st = grp(i => i.row === 2 && i.tone !== 'cam' && i.tone !== 'mic');
      keepExp(isl.sysg, `<span class="lrow">${[use, con, st].filter(Boolean).map(h => `<span class="lg">${h}</span>`).join('<i class="lsep"></i>')}</span>`);
      keepExp(isl.status, `<span class="lclk"><small id="clk-c"></small><b id="clk-t"></b></span>`);
      isl.sysg.dataset.act = 'qs'; isl.sysg.dataset.tip = 'Quick Options'; isl.status.dataset.act = 'cal'; isl.status.dataset.tip = 'Calendar';
    } else if (SVAR === 'glance') {
      /* the few that matter most: camera or mic in use, the network, battery; the app that needs you; the time */
      const priv = I.filter(i => i.tone === 'cam' || i.tone === 'mic'), net = I.find(i => i.k === 'wifi'), bat = I.find(i => i.bat), hidden = I.length - priv.length - 2;
      const lead = TRAY.filter(a => a.st === 'attn').concat(TRAY.filter(a => a.st === 'busy')).slice(0, 2), rest = TRAY.length - lead.length;
      keepExp(isl.status, `<button class="gz" type="button" data-act="sheet" data-tip="Status and running apps">${priv.length ? `<span class="gpriv">${priv.map(i => G(i.g)).join('')}</span>` : ''}${ind(net)}<span class="gbat">${BAT}</span>${lead.length ? `<span class="vr"></span>${lead.map(a => tFace(a, 'ga')).join('')}` : ''}</button>${clockZone()}`);
    }
    tickClock(); }
  /* panel · the apps lift into a tray of icons (the same material as the dock) */
  const appsPop = () => `<div class="atray">${TRAY.map(a => tBtn(a, 'at')).join('')}</div>`;
  /* glance · one sheet that says everything, in words */
  function sheetPop() { const I = sysList(), d = new Date();
    return `<div class="sh0"><span><b>${(d.getHours() % 12) || 12}:${String(d.getMinutes()).padStart(2, '0')} <em>${d.getHours() < 12 ? 'AM' : 'PM'}</em></b><small>${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</small></span><button class="shb" type="button" data-act="cal">${G('calendar')}Calendar</button><button class="shb" type="button" data-act="qs">${G('sliders-horizontal')}Quick Options</button></div>
      <div class="shcols"><section><h4>Status</h4>${I.map(i => `<button type="button" class="shr${i.tone ? ' t-' + i.tone : ''}" data-act="qs"><span class="shg">${glyph(i)}</span><span><b>${esc(i.n)}${i.ext ? '<em>Extension</em>' : ''}</b><small>${esc(i.v)}</small></span></button>`).join('')}</section>
      <section><h4>Running in the background</h4>${TRAY.map(a => `<div class="shr app"><button type="button" class="sha" data-act="tapp" data-app="${a.id}">${tFace(a)}<span><b>${esc(a.n)}</b><small class="${a.st}">${esc(a.line)}</small></span></button><button class="q" type="button" data-tmenu="${a.id}:quit" data-tip="Quit ${esc(a.n)}">${G('x')}</button></div>`).join('') || '<p class="sub">Nothing is running in the background.</p>'}</section></div>`; }
  /* one app's controls, and everything running */
  function tPop() { const a = tApp(TCUR); if (!a) return '';
    return `<div class="tph">${tFace(a, 'lg')}<span><b>${esc(a.n)}</b><small>${esc(a.line)}</small></span></div>${a.st === 'busy' ? `<div class="tprog"><i style="width:${Math.round(a.prog * 100)}%"></i></div>` : ''}
      <div class="tml">${a.menu.map(([k, n, g]) => `<button type="button" class="tmi${k === 'quit' ? ' quit' : ''}" data-tmenu="${a.id}:${k}">${G(g)}<span>${esc(n)}</span></button>`).join('')}</div>`; }
  function runPop() { return `<div class="ph"><h3>Running in the background</h3><span class="sub">${TRAY.length} apps</span></div>
      <div class="trl">${TRAY.map(a => `<div class="tr1"><button type="button" class="trm" data-act="tapp" data-app="${a.id}">${tFace(a)}<span><b>${esc(a.n)}</b><small class="${a.st}">${esc(a.line)}</small></span></button><button class="q" type="button" data-tmenu="${a.id}:quit" data-tip="Quit ${esc(a.n)}">${G('x')}</button></div>`).join('') || '<p class="sub">Nothing is running in the background.</p>'}</div>`; }
  function tAct(id, k) { const a = tApp(id); if (!a) return;
    if (k === 'quit') TRAY.splice(TRAY.indexOf(a), 1);
    else if (k === 'mute' || k === 'open') { a.badge = 0; a.st = 'idle'; a.line = k === 'mute' ? 'Muted for an hour' : 'Nothing new'; if (k === 'open') L.open?.(a.id); }
    else if (k === 'pause') { a.st = a.st === 'busy' ? 'idle' : 'busy'; a.line = a.st === 'busy' ? 'Syncing 14 files' : 'Paused · 14 files waiting'; a.menu[1] = [ 'pause', a.st === 'busy' ? 'Pause syncing' : 'Resume syncing', a.st === 'busy' ? 'pause' : 'play' ]; }
    else if (k === 'unlock') { a.line = a.line === 'Locked' ? 'Unlocked' : 'Locked'; a.menu[0] = ['unlock', a.line === 'Locked' ? 'Unlock' : 'Lock now', a.line === 'Locked' ? 'lock-open' : 'lock']; }
    closePop(); renderStatus(); layout(); }

  /* ══ The launcher and folders (25 Oct 2026) ═══════════════════════════════════════════════════════════════════
     The launcher: Luma's own icon pinned at the start of the dock, in the same icon treatment as every app. It opens
     the app drawer: the screen blurs, and every app stands in a large grid with search on top; the shelf stays above.
     Folders: their own island between the dock and the system island. How a folder looks in it (&fl=):
       stack   a pocket in the folder's colour with its newest files standing in it
       glyph   a tinted tile with the folder's symbol and a count of what's new
     How it opens (&fo=):
       shelf   a strip of large file faces rises from the island, newest first
       sheet   a panel: grid or list, subfolders open in place (grid steps in, list unfolds)
       days    a tall list grouped by day (Today, Yesterday, Earlier), subfolders unfold in place */
  const QP = new URLSearchParams(location.search), FSTY = QP.get('fl') || 'stack', FOPEN = QP.get('fo') || 'shelf', FOLDON = SVAR === 'panel' || SVAR === 'line' || QP.has('fl') || QP.has('fo');
  const LAUNCH = `<button class="dapp dlaunch" type="button" data-act="pad" data-tip="All apps"><span class="ic" style="background-image:url(${U('assets/luma-favicon.svg')})"></span></button><span class="dsep"></span>`;
  const P0 = n => PH + n + '.webp';
  const FOLDERS = [
    { id: 'dl', n: 'Downloads', g: 'download', h: 250, fresh: 3, files: [
      { n: 'Launch deck v4.key', k: 'deck', sz: '48 MB', d: 'Today, 2:41 PM', day: 'Today' }, { n: 'Studio North invoice.pdf', k: 'pdf', sz: '220 KB', d: 'Today, 11:08 AM', day: 'Today' },
      { n: 'terrace.jpg', k: 'img', th: 'life-sync-terrace', sz: '3.2 MB', d: 'Today, 9:30 AM', day: 'Today' }, { n: 'Invoices', k: 'folder', items: 6, d: 'Yesterday', day: 'Yesterday', sub: [
        { n: 'September.pdf', k: 'pdf', sz: '180 KB' }, { n: 'August.pdf', k: 'pdf', sz: '176 KB' }, { n: 'July.pdf', k: 'pdf', sz: '181 KB' }] },
      { n: 'luma-nightly-1022.iso', k: 'zip', sz: '2.4 GB', d: 'Yesterday', day: 'Yesterday' }, { n: 'Budget 2027.xlsx', k: 'sheet', sz: '84 KB', d: 'Oct 21', day: 'Earlier' },
      { n: 'studio-walkthrough.mp4', k: 'video', th: 'life-hero-studio', sz: '312 MB', d: 'Oct 20', day: 'Earlier' }, { n: 'Pet Sounds.flac', k: 'audio', th: 'pet-sounds', sz: '41 MB', d: 'Oct 18', day: 'Earlier' }] },
    { id: 'doc', n: 'Documents', g: 'file-text', h: 40, fresh: 0, files: [
      { n: 'Launch plan.docx', k: 'doc', sz: '96 KB', d: 'Today, 1:12 PM', day: 'Today' }, { n: 'Board letter.pdf', k: 'pdf', sz: '310 KB', d: 'Yesterday', day: 'Yesterday' },
      { n: 'Contracts', k: 'folder', items: 12, d: 'Oct 22', day: 'Earlier', sub: [{ n: 'Studio lease.pdf', k: 'pdf', sz: '1.1 MB' }, { n: 'Fable NDA.pdf', k: 'pdf', sz: '240 KB' }] },
      { n: 'Q4 numbers.xlsx', k: 'sheet', sz: '120 KB', d: 'Oct 21', day: 'Earlier' }, { n: 'Keynote script.docx', k: 'doc', sz: '64 KB', d: 'Oct 19', day: 'Earlier' }] },
    { id: 'pic', n: 'Pictures', g: 'image', h: 150, fresh: 0, files: [
      { n: 'loft.jpg', k: 'img', th: 'life-professionals-loft', sz: '4.1 MB', d: 'Today', day: 'Today' }, { n: 'street.jpg', k: 'img', th: 'life-ari-street', sz: '3.6 MB', d: 'Today', day: 'Today' },
      { n: 'home.jpg', k: 'img', th: 'life-hero-home', sz: '2.9 MB', d: 'Yesterday', day: 'Yesterday' }, { n: 'writing.jpg', k: 'img', th: 'life-hero-writing', sz: '3.0 MB', d: 'Oct 22', day: 'Earlier' },
      { n: 'Screenshots', k: 'folder', items: 48, d: 'Oct 21', day: 'Earlier', sub: [{ n: 'Shelf 1.png', k: 'img', th: 'fp6-screen', sz: '1.2 MB' }] }] },
  ];
  let FCUR = 'dl', FPATH = [], FVIEW = 'grid', FSORT = 'newest', FSO = false; const FUNF = new Set();
  const FK = { pdf: ['PDF', 25], doc: ['DOC', 255], sheet: ['XLS', 150], deck: ['KEY', 45], zip: ['ISO', 265] };
  function fface(f, cls = '') {
    if (f.k === 'img' || f.k === 'video' || f.k === 'audio') return `<i class="ff pic ${cls} k-${f.k}" style="background-image:url(${P0(f.th)})">${f.k === 'video' ? `<b>${G('play')}</b>` : f.k === 'audio' ? `<b>${G('music')}</b>` : ''}</i>`;
    // a folder is Filer's folder (the same 80×64 drawing and colours as Filer's grid)
    if (f.k === 'folder') return `<i class="ff fold ${cls}"><svg viewBox="0 0 80 64" aria-hidden="true"><defs><linearGradient id="shfgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.22)"/><stop offset="1" stop-color="rgba(0,0,0,.1)"/></linearGradient></defs><path d="M4 6a4 4 0 0 1 4-4h20l6 6h38a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="var(--folder-2)"/><rect x="2" y="15" width="76" height="47" rx="6" fill="var(--folder)"/><rect x="2" y="15" width="76" height="47" rx="6" fill="url(#shfgr)"/><path d="M8 16.5h64" stroke="rgba(255,255,255,.45)" stroke-width="1" stroke-linecap="round"/></svg></i>`;
    const [t, h] = FK[f.k] || ['FILE', 265]; return `<i class="ff page ${cls}" style="--h:${h}"><b>${t}</b><u></u><u></u><u></u><s></s></i>`; }
  function renderFolders() { if (!FOLDON) return; keepExp(isl.fold, FOLDERS.map(F => {
      const top = F.files.filter(f => f.k !== 'folder').slice(0, 3);
      const inner = FSTY === 'glyph' ? `<span class="fgly" style="--h:${F.h}">${G(F.g)}</span>${F.fresh ? `<b class="badge">${F.fresh}</b>` : ''}`
        : `<span class="fpk" style="--h:${F.h}"><span class="fpf">${top.reverse().map((f, i) => `<span class="fpi" style="--i:${i}">${fface(f, 'xs')}</span>`).join('')}</span><span class="fpb">${G(F.g)}</span></span>${F.fresh ? `<b class="badge">${F.fresh}</b>` : ''}`;
      return `<button class="fbtn" type="button" data-act="fold" data-f="${F.id}" data-tip="${F.n}">${inner}</button>`; }).join('')); }
  const fcur = () => { const F = FOLDERS.find(x => x.id === FCUR); let list = F.files, name = F.n; FPATH.forEach(n => { const s = list.find(x => x.n === n); if (s?.sub) { list = s.sub; name = s.n; } });
    const KO = { folder: 0, img: 1, video: 2, audio: 3, doc: 4, pdf: 5, sheet: 6, deck: 7, zip: 8 };
    if (FSORT === 'name') list = [...list].sort((a, b) => a.n.localeCompare(b.n)); else if (FSORT === 'kind') list = [...list].sort((a, b) => (KO[a.k] ?? 9) - (KO[b.k] ?? 9) || a.n.localeCompare(b.n));
    return { F, list, name }; };
  const fsize = list => { const mb = list.reduce((t, f) => t + (!f.sz ? 0 : f.sz.endsWith('GB') ? parseFloat(f.sz) * 1024 : f.sz.endsWith('KB') ? parseFloat(f.sz) / 1024 : parseFloat(f.sz)), 0); return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB'; };
  const fmeta = f => f.k === 'folder' ? `${f.items} items` : f.sz;
  function foldPop() { const { F, list, name } = fcur(), crumbs = [F.n, ...FPATH];
    const head = `<div class="fph"><span class="fpt">${FPATH.length ? `<button class="q" type="button" data-fup aria-label="Back" data-tip="Back">${G('chevron-left')}</button>` : ''}<span><b>${esc(name)}</b><small>${FPATH.length ? esc(crumbs.slice(0, -1).join(' › ')) : `${F.files.length} items · ${fsize(F.files)}${F.fresh ? ` · <em>${F.fresh} new</em>` : ''}`}</small></span></span>
      <span class="fdd"><button class="fsel${FSO ? ' on' : ''}" type="button" data-fsort aria-haspopup="listbox" aria-expanded="${FSO}">${{ newest: 'Newest', name: 'Name', kind: 'Kind' }[FSORT]}${G('chevrons-up-down')}</button>${FSO ? `<span class="fddm" role="listbox">${[['newest', 'Newest', 'clock'], ['name', 'Name', 'arrow-down-a-z'], ['kind', 'Kind', 'shapes']].map(([k, n, g]) => `<button type="button" role="option" class="${k === FSORT ? 'on' : ''}" data-fsortto="${k}">${G(g)}<span>${n}</span>${k === FSORT ? G('check') : ''}</button>`).join('')}</span>` : ''}</span>
      ${FOPEN === 'sheet' ? `<span class="fvw"><button class="q${FVIEW === 'grid' ? ' on' : ''}" type="button" data-fview="grid" data-tip="Grid">${G('layout-grid')}</button><button class="q${FVIEW === 'list' ? ' on' : ''}" type="button" data-fview="list" data-tip="List">${G('list')}</button></span>` : ''}
      <button class="fwell" type="button" data-launch="filer" data-tip="Open in Filer"><i class="fwic" style="background-image:url(${LICON('filer')})"></i>Open</button></div>`;
    const foot = '';
    const card = f => `<button class="fc" type="button" ${f.k === 'folder' ? `data-fsub="${esc(f.n)}"` : `data-launch="${f.k === 'img' ? 'photos' : 'filer'}"`}>${fface(f, 'lg')}<b>${esc(f.n)}</b><small>${esc(fmeta(f))}</small></button>`;
    const row = (f, depth = 0) => { const open = FUNF.has(f.n); return `<button class="fr${depth ? ' d1' : ''}" type="button" ${f.k === 'folder' ? `data-funf="${esc(f.n)}"` : `data-launch="${f.k === 'img' ? 'photos' : 'filer'}"`}>${f.k === 'folder' ? `<i class="fchev${open ? ' on' : ''}">${G('chevron-right')}</i>` : '<i class="fchev sp"></i>'}${fface(f, 'sm')}<span><b>${esc(f.n)}</b><small>${esc(fmeta(f))}${f.d ? ' · ' + esc(f.d) : ''}</small></span></button>${f.k === 'folder' && open ? f.sub.map(x => row(x, 1)).join('') : ''}`; };
    if (FOPEN === 'shelf') return head + `<div class="fsw"><div class="fshelf">${list.map(card).join('')}</div><button class="fsa l" type="button" data-fscroll="-1" aria-label="Earlier">${G('chevron-left')}</button><button class="fsa r" type="button" data-fscroll="1" aria-label="More">${G('chevron-right')}</button></div>`;
    if (FOPEN === 'sheet') return head + (FVIEW === 'grid' ? `<div class="fgrid">${list.map(card).join('')}</div>` : `<div class="flist">${list.map(f => row(f)).join('')}</div>`) + foot;
    const days = [...new Set(list.map(f => f.day || 'Earlier'))];
    return head + `<div class="fdays">${days.map(d => `<h6>${d}</h6>${list.filter(f => (f.day || 'Earlier') === d).map(f => row(f)).join('')}`).join('')}</div>` + foot; }
  /* apps from elsewhere, drawn with their official marks on their own colour (the same faces as Depot's) */
  const XAPPS = [['blender', 'Blender', 'blender', '#E87D0D'], ['gimp', 'GIMP', 'gimp', '#5C5543'], ['inkscape', 'Inkscape', 'inkscape', '#1B1B1D'], ['krita', 'Krita', 'krita', '#3BABFF'], ['kdenlive', 'Kdenlive', 'kdenlive', '#527EB2'],
    ['audacity', 'Audacity', 'audacity', '#0000CC'], ['obs', 'OBS Studio', 'obsstudio', '#302E31'], ['vlc', 'VLC', 'vlcmediaplayer', '#FF8800'], ['kodi', 'Kodi', 'kodi', '#17B2E7'], ['discord-x', 'Discord', 'discord', '#5865F2'],
    ['signal', 'Signal', 'signal', '#3B45FD'], ['telegram', 'Telegram', 'telegram', '#26A5E4'], ['thunderbird', 'Thunderbird', 'thunderbird', '#0A84FF'], ['libreoffice', 'LibreOffice', 'libreoffice', '#18A303'], ['zoom', 'Zoom', 'zoom', '#0B5CFF'],
    ['steam', 'Steam', 'steam', '#1B2838'], ['vscodium', 'VSCodium', 'vscodium', '#2F80ED'], ['godot', 'Godot', 'godotengine', '#478CBF'], ['nextcloud', 'Nextcloud', 'nextcloud', '#0082C9'], ['bitwarden', 'Bitwarden', 'bitwarden', '#175DDC'],
    ['spotify', 'Spotify', 'spotify', '#1DB954'], ['firefox', 'Firefox', 'firefoxbrowser', '#FF7139'], ['obsidian', 'Obsidian', 'obsidian', '#7C3AED'], ['qbittorrent', 'qBittorrent', 'qbittorrent', '#2F67BA']];
  const padApps = () => [...ALL().filter(id => id !== 'discord').map(id => ({ id, n: LNAME(id), ic: `<span class="ic" style="background-image:url(${LICON(id)})"></span>` })),
    ...XAPPS.map(([id, n, m, bg]) => ({ id: 'x:' + id, n, ic: `<span class="ic xic" style="--c:${bg};--m:url('${MK}${m}.svg')"></span>` }))].sort((a, b) => a.n.localeCompare(b.n));
  /* pages of seven by four; search shows every match on one page */
  let PADP = 0; const PER = 28;
  /* the panel points at the folder it came from */
  function fsWire() { const sh = pop.querySelector('.fshelf'); if (!sh) return; const w = sh.parentElement, upd = () => { w.classList.toggle('at-s', sh.scrollLeft < 4); w.classList.toggle('at-e', sh.scrollLeft + sh.clientWidth > sh.scrollWidth - 4); }; sh.onscroll = upd; upd(); }
  function foldCaret(el) { requestAnimationFrame(() => { fsWire(); const pr = pop.getBoundingClientRect(), ar = el.getBoundingClientRect(); pop.style.setProperty('--cx', Math.max(30, Math.min(pr.width - 30, ar.left + ar.width / 2 - pr.left)) + 'px'); }); }
  function padGrid(q = '') { const all = padApps().filter(a => !q || a.n.toLowerCase().includes(q.toLowerCase())), pages = q ? [all] : Array.from({ length: Math.ceil(all.length / PER) }, (_, i) => all.slice(i * PER, i * PER + PER));
    PADP = q ? 0 : Math.min(PADP, pages.length - 1);
    const tile = (a, i) => `<button class="pdi" type="button" ${a.id.startsWith('x:') ? `data-xapp="${esc(a.n)}"` : `data-launch="${a.id}"`} style="--d:${Math.min(i, 30) * 10}ms"><span class="dapp">${a.ic}</span><b>${esc(a.n)}</b></button>`;
    return { pages: `<div class="pdpages" style="--p:${PADP}">${pages.map((pg, k) => `<div class="pdg${q ? ' res' + (pg.length <= 7 ? ' one' : '') : ''}">${pg.map((a, i) => tile(a, k === PADP ? i : 0)).join('') || `<p class="pdn">No app called “${esc(q)}”</p>`}</div>`).join('')}</div>`,
      dots: pages.map((_, k) => `<button type="button" class="${k === PADP ? 'on' : ''}" data-padp="${k}" aria-label="Page ${k + 1}"></button>`).join(''), n: pages.length }; }
  function padHTML() { const g = padGrid(); return `<div class="pdin"><label class="pdq">${G('search')}<input id="pdq" placeholder="Search ${padApps().length} apps" autocomplete="off" spellcheck="false"></label>
      <div class="pdv">${g.pages}</div><div class="pddots${g.n > 1 ? '' : ' off'}">${g.dots}</div></div>`; }
  function padSearch(q) { const p = $('#pad'), g = padGrid(q), v = p.querySelector('.pdv'), d = p.querySelector('.pddots'); v.innerHTML = g.pages; d.innerHTML = g.dots; d.classList.toggle('off', g.n < 2); }
  function padPage(k) { const p = $('#pad'), n = p.querySelectorAll('.pdg').length; PADP = Math.max(0, Math.min(n - 1, k)); const pg = p.querySelector('.pdpages'); pg.style.removeProperty('--dx'); pg.style.setProperty('--p', PADP); p.querySelectorAll('.pddots button').forEach((b, i) => b.classList.toggle('on', i === PADP)); }
  function padOpen() { let p = $('#pad'); if (!p) { scr.insertAdjacentHTML('beforeend', '<div class="pad" id="pad"></div>'); p = $('#pad');
      p.addEventListener('input', e => { if (e.target.id === 'pdq') padSearch(e.target.value.trim()); });
      let drag = null, moved = false;
      p.addEventListener('pointerdown', e => { const v = e.target.closest('.pdv'); if (!v || e.button) return; drag = { x: e.clientX, w: v.clientWidth, pg: v.querySelector('.pdpages') }; moved = false; });
      p.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) { moved = true; drag.pg.classList.add('drag'); drag.pg.style.setProperty('--dx', dx + 'px'); } });
      const end = e => { if (!drag) return; const dx = e.clientX - drag.x; drag.pg.classList.remove('drag'); if (moved && Math.abs(dx) > drag.w * .15) padPage(PADP - Math.sign(dx)); else padPage(PADP); drag = null; };
      p.addEventListener('pointerup', end); p.addEventListener('pointerleave', end);
      p.addEventListener('click', e => { if (moved) { moved = false; e.stopPropagation(); return; } const d = e.target.closest('[data-padp]'); if (d) { padPage(+d.dataset.padp); return; } const x = e.target.closest('[data-xapp]'); if (x) { padClose(); return; } if (!e.target.closest('.pdi, .pdq, .pddots')) padClose(); }, true);
      let wl = 0; p.addEventListener('wheel', e => { e.preventDefault(); if ($('#pdq').value.trim()) return; const now = Date.now(), d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (now - wl < 450 || Math.abs(d) < 12) return; wl = now; padPage(PADP + Math.sign(d)); }, { passive: false });
      document.addEventListener('keydown', e => { if (!p.classList.contains('on')) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { if (e.target.id === 'pdq' && e.target.value) return; e.preventDefault(); padPage(PADP + (e.key === 'ArrowRight' ? 1 : -1)); } }); }
    closePop(); PADP = 0; p.innerHTML = padHTML(); p.classList.remove('settled'); p.classList.add('on'); scr.classList.add('pad-on'); setTimeout(() => $('#pdq')?.focus(), 60); setTimeout(() => p.classList.add('settled'), 750); }
  function padClose() { $('#pad')?.classList.remove('on'); scr.classList.remove('pad-on'); }
  /* ── Layout ────────────────────────────────────────────────────────────── */
  const ROWS = { bottom: $('#row-bottom'), top: $('#row-top'), left: $('#row-left'), right: $('#row-right') };
  // The shelf holds two live tiles at most, the most urgent first: a call, a recording, an event about to start, then music, weather, toggles
  const liveIds = () => SVAR === 'panel' ? [] : [C.on && 'call', RCL.on && 'rec', hudOn() && 'nfl', EVL.on && evAt() - Date.now() < 15 * 60e3 && Date.now() - evAt() < 10 * 60e3 && 'ev', M.on && !SHOWCASE && 'music', S.wx !== false && 'wx', TGL.on && 'tg'].filter(Boolean).filter(k => !SHOWCASE || k === 'call' || k === 'rec').slice(0, S.liveMax ?? 2);   /* showcase: only tiles you start yourself, so the dock has room */
  function groups() { return [['dock', [isl.dock]], ...(FOLDON ? [['folders', [isl.fold]]] : []), ['live', liveIds().map(k => isl[k])], ['status', SVAR === 'panel' || SVAR === 'line' ? [isl.sysg, isl.status] : [isl.status]]]; }

  function layout() {
    const T = S.size + 2 * PADV;
    scr.style.setProperty('--is', S.size + 'px'); scr.dataset.theme = S.theme; scr.dataset.mat = S.mat; scr.dataset.clock = S.clock; scr.dataset.icon = S.icon; scr.dataset.shape = S.shape; if (SVAR) scr.dataset.sv = SVAR;
    if (grownI) shrink(true);
    Object.values(ROWS).forEach(r => { r.className = 'row'; r.hidden = true; $$('.slot', r).forEach(s => { s.className = 'slot ' + s.classList[1]; s.replaceChildren(); }); });
    [isl.dock, isl.fold, isl.status, isl.sysg, isl.music, isl.call, isl.wx, isl.ev, isl.rec, isl.tg, isl.nfl].forEach(i => { i.classList.remove('mat', 'dragging', 'grown', 'sizing'); i.style.left = i.style.top = i.style.width = i.style.height = i.style.bottom = i.style.right = ''; i.remove(); });
    $('#tucks').innerHTML = '';
    const used = new Set();
    if (S.attach === 'free') {
      const fr = $('#free'); fr.hidden = false;
      groups().forEach(([, list]) => list.forEach(i => { const p = S.free[i.dataset.id] || defFree(i.dataset.id); S.free[i.dataset.id] = p; i.classList.add('mat'); i.style.left = p.x + 'px'; i.style.top = p.y + 'px'; fr.appendChild(i); }));
    } else {
      $('#free').hidden = true;
      const order = { dock: 0, folders: .5, live: 1, status: 2 };
      for (const [g, list] of groups()) { if (!list.length) continue; const e = S.edge[g] || S.edge.dock, row = ROWS[e]; used.add(e);
        // a joined, spread shelf is a taskbar: apps and folders start at the left end, status at the right
        const tb = S.surface === 'joined', slot = $(S.align === 'spread' ? { dock: tb ? '.s' : '.c', folders: tb ? '.s' : '.c', live: '.s', status: '.e' }[g] : '.c', row); list.forEach(i => { i.dataset.o = order[g]; slot.appendChild(i); }); }
      for (const e of used) { const row = ROWS[e], vert = e === 'left' || e === 'right'; row.hidden = false;
        $$('.slot', row).forEach(s => [...s.children].sort((a, b) => a.dataset.o - b.dataset.o).forEach(c => s.appendChild(c)));
        row.classList.add(vert ? 'v' : 'h', 'e-' + e, S.surface);
        if (S.align === 'spread') row.classList.add('spread'); if (S.attach === 'prot') row.classList.add('prot');
        if (S.surface === 'joined' && S.align === 'spread') row.classList.add('mat', 'full');
        else if (S.surface === 'joined') $$('.slot', row).forEach(s => s.children.length && s.classList.add('mat'));
        else $$('.island', row).forEach(i => i.classList.add('mat'));
        if (S.tuck && !row.classList.contains('peek')) row.classList.add('tucked');
        if (S.tuck) $('#tucks').insertAdjacentHTML('beforeend', `<div class="tlip prot e-${e}"><i class="mat"></i></div><div class="hot e-${e}" data-hot="${e}"></div>`);
      }
    }
    // A side shelf taller than the screen steps its icons down until it fits
    for (const e of used) { if (e !== 'left' && e !== 'right') continue; const row = ROWS[e]; let is = S.size;
      const need = () => [...row.querySelectorAll('.slot > *')].reduce((h, i) => h + i.offsetHeight + 10, 0);
      while (is > 28 && need() > row.clientHeight) { is -= 2; scr.style.setProperty('--is', is + 'px'); } }
    tickClock();
    // The tiler's work area: always a gap on every side, plus whatever the shelf reserves.
    const res = { top: WG, bottom: WG, left: WG, right: WG };
    if (S.attach !== 'free') for (const e of used) res[e] = S.tuck ? WG + 6 : (S.attach === 'prot' ? 0 : INS) + T + WG;
    lastRes = res; tile(res);
    placeLip();
    closePop(); hideTip();
    save(); renderInspector();
    // If the shelf is wider than the screen, the least urgent live tile steps aside (weather first)
    requestAnimationFrame(() => { const row = isl.status.closest('.row.h'); if (!row) return; const over = [...row.querySelectorAll('.island')].some(i => { const r = i.getBoundingClientRect(), s2 = row.getBoundingClientRect(); return r.right > s2.right + 1 || r.left < s2.left - 1; });
      const n = liveIds().length; if (over && n > 0 && (S.liveMax ?? 2) > 0) { S.liveMax = Math.min(S.liveMax ?? 2, n) - 1; layout(); } });
  }
  let lastRes = { top: 10, bottom: 10, left: 10, right: 10 };
  function defFree(id) { const T = S.size + 2 * PADV; return { dock: { x: 420, y: H - T - 40 }, status: { x: W - 200, y: 28 }, music: { x: 60, y: 28 }, call: { x: 60, y: 100 } }[id]; }

  /* ── Windows: two real apps, tiled or floating ─────────────────────────── */
  const WINS = {};
  function tile(r) { L.area(r, S.tiling); }
  /* ── Notifications ─────────────────────────────────────────────────────── */
  const nl = $('#nl'), ninner = $('#ninner');
  const NA = { messages: 'Messages', calendar: 'Calendar', 'app-store': 'Depot', phone: 'Phone', files: 'Filer' };
  let NQ = [{ id: 1, app: 'app-store', title: 'Updates are ready', body: 'Viola and 3 other apps can update tonight.', acts: ['Update', 'Later'], at: Date.now() - 38 * 60e3 }, { id: 2, app: 'calendar', title: 'Launch walkthrough', body: 'Today at 7:30 PM · Studio', acts: ['Snooze'], at: Date.now() - 12 * 60e3 }];
  let NS = 'rest', nTimer = 0, nid = 3, fresh = false, idleBuzz = 0;
  const ago = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'now' : m < 60 ? m + 'm' : Math.round(m / 60) + 'h'; };
  const tileOf = n => n.face ? `<span class="nt face" style="${faceBg(n.face, 34)}"><i class="mini" style="background-image:url(${IC}${n.app}.svg)"></i></span>` : `<span class="nt" style="background-image:url(${IC}${n.app}.svg)"></span>`;
  function cardHTML(n, rest) { return `<div class="ncard${n.urgent ? ' ring' : ''}" data-nid="${n.id}">${tileOf(n)}<div><div class="nm"><span>${NA[n.app] || n.app}</span><em>${n.urgent ? 'ringing' : ago(n.at)}</em></div><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>
    ${n.sent ? `<div class="nsent">Sent</div>` : n.reply && !rest ? `<label class="nreply"><input placeholder="Reply to ${esc(n.title.split(' ')[0])}" data-reply="${n.id}"><button type="button" data-nsend="${n.id}" aria-label="Send">${G('send-horizontal')}</button></label>`
      : n.acts?.length ? `<div class="nacts">${n.acts.map(a => `<button type="button" data-nact="${n.id}:${a}" class="${a === 'Accept' ? 'yes' : a === 'Decline' ? 'no' : ''}">${a === 'Accept' ? G('phone') : a === 'Decline' ? G('phone-off') : ''}${a}</button>`).join('')}</div>` : ''}
    ${n.urgent ? '' : `<button class="x" type="button" data-ndis="${n.id}" aria-label="Dismiss">${G('x')}</button>`}</div>`; }
  function pillHTML(big) { const apps = [...new Set(NQ.map(n => n.app))].slice(0, 3), n0 = NQ[0];
    return `<div class="pill${big ? ' big' : ''}">${S.dnd ? G('moon') : ''}<span class="stack">${apps.map(a => `<i style="background-image:url(${IC}${a}.svg)"></i>`).join('')}</span>${big ? `<b>${esc(n0.title)}</b>${NQ.length > 1 ? `<small>and ${NQ.length - 1} more</small>` : ''}` : `<b>${NQ.length}</b>`}</div>`; }
  function setLip(state, html, iw) {
    const same = NS === state && state === 'has'; NS = state; nl.classList.remove('idle', 'has', 'card', 'tray'); if (!same) nl.classList.remove('show'); nl.classList.add(state);
    ninner.style.setProperty('--iw', (iw || 392) + 'px'); ninner.innerHTML = html || '';
    let w = 44, h = 5;
    /* Measured as its own shrink-to-fit box (inline styles, so a not-yet-loaded shell.css cannot make it a full-width
       block: the lip used to open across the whole screen on load), in layout pixels (scrollWidth, so a zoomed page
       measures the same), and measured again once shell.css has loaded, when the icons have their size (Nick, 14 Oct 2026). */
    if (state === 'has') { const st = ninner.style; st.position = 'absolute'; st.width = 'max-content'; w = Math.min(Math.ceil(ninner.scrollWidth) || 60, 420); st.width = ''; st.position = '';
      h = ninner.querySelector('.big') ? 32 : 22; ninner.style.setProperty('--iw', w + 'px'); }
    if (state === 'card' || state === 'tray') { w = iw || 392; h = ninner.scrollHeight; }
    nl.style.setProperty('--w', w + 'px'); nl.style.setProperty('--h', h + 'px');
    if (state !== 'idle') requestAnimationFrame(() => nl.classList.add('show'));
    nl.classList.toggle('fresh', state === 'has' && fresh && !S.dnd);
  }
  function rest() { clearTimeout(nTimer); if (NQ.length) setLip('has', pillHTML()); else setLip('idle'); }
  /* The resting lip's size depends on shell.css; measure it again as soon as that has loaded. */
  ROOT.querySelector('link[rel="stylesheet"]')?.addEventListener('load', () => { if (NS === 'has') setLip('has', pillHTML()); }, { once: true });
  function buzz() { if (S.dnd || NS !== 'has') return; nl.classList.remove('buzz'); void nl.offsetWidth; nl.classList.add('buzz'); setTimeout(() => nl.classList.remove('buzz'), 1100); }
  function notify(n) { n.id = nid++; n.at = Date.now(); NQ.unshift(n); fresh = true;
    if (n.app === 'messages') { BADGE++; renderDock(); const d = $('[data-app="messages"]', isl.dock); d?.classList.add('want', 'hop'); setTimeout(() => d?.classList.remove('hop'), 1000); }
    if (S.dnd && !n.urgent) { rest(); return; }
    showCard(n); }
  function showCard(n) { clearTimeout(nTimer); setLip('card', `<div class="tl ban">${n.acts?.includes('Join') ? upHTML(n) : rowHTML(n, 0, true)}</div>`); armRetract(n); }
  function armRetract(n) { clearTimeout(nTimer); if (n.urgent) return; nTimer = setTimeout(() => { if (nl.matches(':hover') || nl.contains(ROOT.activeElement)) return armRetract(n); rest(); setTimeout(buzz, 480); }, 6500); }
  function openTray() { clearTimeout(nTimer); fresh = false;
    setLip('tray', `<div class="th"><h3>Notifications<small>${trayCount() || ''}</small></h3><button class="q${S.dnd ? ' on' : ''}" type="button" data-act="dnd" data-tip="Do Not Disturb">${G('moon')}</button>${NQ.length ? `<button class="tx" type="button" data-act="clear">Clear all</button>` : ''}</div>
      ${NQ.length ? `<div class="tl">${trayRows()}</div>` : `<div class="tempty">${G('circle-check')}<b>You're all caught up</b></div>`}`, 400); }
  /* the tray (25 Oct 2026): one surface, no cards inside it. What's about to start leads, in its own colour; the rest
     are rows grouped by app (a group shows its newest and "n more from …" until opened), with hairlines between. */
  const TOPEN = new Set();
  const trayCount = () => { const up = NQ.find(n => n.acts?.includes('Join')), base = up && up.title.replace(/ in \d+ minutes?/, ''); return NQ.filter(n => !(up && n !== up && n.app === up.app && n.title === base)).length; };
  function rowHTML(n, more, live) { const acts = n.sent ? `<span class="nsent2">${G('check')}Sent</span>` : n.acts?.length ? `<div class="nra">${n.acts.map((a, i) => `<button type="button" data-nact="${n.id}:${a}" class="${a === 'Join' || a === 'Accept' ? 'go' : a === 'Decline' ? 'no' : i === 0 ? 'pri' : ''}">${a === 'Join' ? G('video') : a === 'Accept' ? G('phone') : a === 'Decline' ? G('phone-off') : ''}${a}</button>`).join('')}</div>` : '';
    return `<div class="nr${n.urgent ? ' ring' : ''}" data-nid="${n.id}">${tileOf(n)}<div class="nrb"><div class="nr1"><b>${esc(n.title)}</b><em>${n.urgent ? 'Ringing' : ago(n.at)}</em></div><p>${esc(n.body)}</p>${live && n.reply && !n.sent ? `<label class="nreply2"><input placeholder="Reply to ${esc(n.title.split(' ')[0])}" data-reply="${n.id}"><button type="button" data-nsend="${n.id}" aria-label="Send">${G('arrow-up')}</button></label>` : ''}${acts}${more ? `<button class="nmore2" type="button" data-ngrp="${n.app}">${G('chevron-down')}${more} more from ${esc(NA[n.app] || n.app)}</button>` : ''}</div>${n.urgent ? '' : `<button class="x" type="button" data-ndis="${n.id}" aria-label="Dismiss">${G('x')}</button>`}</div>`; }
  function upHTML(n) { const m = (n.title.match(/in (\d+) min/) || [])[1], t = n.title.replace(/ in \d+ minutes?/, '');
    return `<div class="nup" data-nid="${n.id}"><span class="nupd"><small>${new Date().toLocaleDateString([], { month: 'short' })}</small><b>${new Date().getDate()}</b></span><div class="nrb"><small class="nupk">Starting ${m ? `in ${m} min` : 'soon'}</small><b>${esc(t)}</b><p>${esc(n.body)}</p></div>
      <div class="nupa">${(n.acts || []).map(a => `<button type="button" data-nact="${n.id}:${a}" class="${a === 'Join' ? 'go' : ''}">${a === 'Join' ? G('video') : ''}${a}</button>`).join('')}</div></div>`; }
  function trayRows() { const up = NQ.find(n => n.acts?.includes('Join')), base = up && up.title.replace(/ in \d+ minutes?/, ''), rest2 = NQ.filter(n => n !== up && !(up && n.app === up.app && n.title === base)), groups = [];   /* the same event's earlier reminder folds into what's next */
    rest2.forEach(n => { const g = groups.find(x => x.app === n.app); g ? g.list.push(n) : groups.push({ app: n.app, list: [n] }); });
    return (up ? upHTML(up) : '') + groups.map(g => TOPEN.has(g.app) || g.list.length === 1 ? g.list.map(n => rowHTML(n)).join('') : rowHTML(g.list[0], g.list.length - 1)).join(''); }
  function placeLip() { const top = ROWS.top; let t = 0;
    if (!top.hidden && S.attach !== 'free' && !S.tuck && ($('.slot.c', top).children.length || S.align !== 'spread')) t = (S.attach === 'prot' ? 0 : INS) + S.size + 2 * PADV;
    nl.style.setProperty('--nt', t + 'px'); nl.classList.toggle('right', S.notif === 'right'); }
  function dismiss(id) { NQ = NQ.filter(n => n.id !== +id); if (NS === 'tray') openTray(); else rest(); }

  /* ── Popovers ──────────────────────────────────────────────────────────── */
  const pop = $('#pop'); let popKind = '', popAnchor = null;
  const rel = el => { const s = scr.getBoundingClientRect(), k = s.width / W, r = el.getBoundingClientRect(); return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k }; };
  function edgeOf(el) { const row = el.closest('.row'); if (row) return ['bottom', 'top', 'left', 'right'].find(e => row.classList.contains('e-' + e)); return rel(el).y > H / 2 ? 'bottom' : 'top'; }
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
      if (a === 'Decline') { n.urgent = false; n.title = PRIYA.n; n.body = 'Missed Luma call'; n.acts = ['Call back', 'Message']; n.at = Date.now(); rest(); setTimeout(buzz, 480); return; }
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
  /* Luma drives the shell: which windows are open, the mode, Do Not Disturb */
  window.lumaLive = (k, on) => { if (k === 'rec') { RCL.on = on; RCL.t0 = Date.now() - 14e3; RCL.acc = 0; RCL.paused = false; } if (k === 'ev') { EVL.on = on; EVL.forced = on; EVL.t = on ? 'Product sync' : 'Walkthrough'; EVL.at = Date.now() + 8 * 60e3; } if (k === 'tg') TGL.on = on; if (k === 'wx') S.wx = on; if (k === 'music') M.on = on; if (k === 'call') { C.on = on; C.t0 = Date.now(); } renderEv(); renderRec(); renderTg(); renderWx(); renderMusic(); renderCall(); layout(); };
  window.lumaShell = {
    sync(run, front) { RUN = new Set(run); FOCUS = front || ''; renderDock(); },
    theme(m) { if (S.theme === m) return; S.theme = m; scr.dataset.theme = m; save(); },
    mat(m) { if (S.mat === m) return; S.mat = m; scr.dataset.mat = m; save(); },
    /* the dash and the tiler, as first login (desktop/setup.js) and Settings choose them: luma, onebar (Cupertino), taskbar (Redmond) */
    preset(p) { if (!PRESETS[p] || !PRESETS[p].edge) return; Object.assign(S, JSON.parse(JSON.stringify(PRESETS[p])), { preset: p }); S.liveMax = 2; layout(); },
    tiling(v) { S.tiling = !!v; layout(); },
    dnd(v) { S.dnd = !!v; renderStatus(); if (NS === 'has' || NS === 'idle') rest(); refreshPop(); },
    notify(n) { notify(n); },
    /* D-Ink: the shelf in ink (desktop/dink-shell.css); the dock redraws so it picks up the ink icons */
    ink(v) { v = v || ''; if ((S.ink || '') === v) return; S.ink = v; IC = U(v ? '../icons/luma-ink-' : '../icons/luma-v4-'); if (v) scr.dataset.ink = v; else delete scr.dataset.ink; if (v && !ROOT.querySelector('#dinkcss')) { const l = document.createElement('link'); l.id = 'dinkcss'; l.rel = 'stylesheet'; l.href = 'desktop/dink-shell.css'; ROOT.prepend(l); } renderDock(); renderStatus(); try { refreshPop(); } catch (e) {} },
    state: S, tick() { tickClock(); renderStatus(); }, tray: () => openTray(), notify: n => notify(n) };   // state/tick: for Studio checks
  if (document.documentElement.dataset.ink) window.lumaShell.ink(document.documentElement.dataset.ink);
  L.ready();
  /* A few things happen while you look around: a message drops from the top edge, waits, then tucks back into the lip. */
  const MSG = ['Pushed the new shelf build. Want to try it before dinner?', 'Also: the notification lip is so good.', 'Ok, heading out. Call if anything breaks.'];
  setTimeout(() => notify({ app: 'messages', face: PRIYA, title: 'Priya Raman', body: MSG[0], reply: true }), 2600);
  setTimeout(() => { S.soonAt = Date.now() + 15 * 60e3 - 20e3; tickClock(); renderEv(); layout(); }, 44000);
  setTimeout(() => notify({ app: 'calendar', title: 'Launch walkthrough in 15 minutes', body: 'Studio \u00b7 with Priya, Nora and Theo', acts: ['Join', 'Snooze'] }), 45000);
  setTimeout(() => notify({ app: 'files', title: 'luma-nightly.iso is ready', body: 'Downloads \u00b7 4.1 GB', acts: ['Show', 'Open'] }), 110000);
  setTimeout(() => notify({ app: 'messages', face: PRIYA, title: 'Priya Raman', body: MSG[1], reply: true }), 190000);
})();
})();
