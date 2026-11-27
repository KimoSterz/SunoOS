/* Suno desktop shell: Shelf take two (mockups/shelf-2.html), mounted over the desktop in Studio's Desktop view.
   Its code is kept as it was; the bridge (window.lumaDesk) connects it to Suno's real windows and Settings. */
(() => {
(() => {
  'use strict';
  const desk = document.getElementById('desk'), host = document.createElement('div'); host.id = 'lshell'; desk.appendChild(host);
  const ROOT = host.attachShadow({ mode: 'open' });
  const WARP = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="suno-warp" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="desktop/warp-map.png" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="40" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;
  ROOT.innerHTML = `<link rel="stylesheet" href="desktop/shell.css">${WARP}<div class="screen" id="scr" data-theme="dark" data-mat="solid" data-icon="lit" data-shape="squircle">
    <div class="row" id="row-bottom"><div class="slot s"></div><div class="slot c"></div><div class="slot e"></div></div>
    <div class="row" id="row-top"><div class="slot s"></div><div class="slot c"></div><div class="slot e"></div></div>
    <div class="row" id="row-left"><div class="slot s"></div><div class="slot c"></div><div class="slot e"></div></div>
    <div class="row" id="row-right"><div class="slot s"></div><div class="slot c"></div><div class="slot e"></div></div>
    <div class="free" id="free"></div><div id="tucks"></div>
    <div class="nl idle" id="nl"><div class="clip" id="nclip"><div class="inner" id="ninner"></div><i class="glow"></i></div></div>
    <div class="pop" id="pop"></div><div class="tip" id="tip"></div><div class="plate" id="plate"></div></div>`;
  const $ = (s, r = ROOT) => r.querySelector(s), $$ = (s, r = ROOT) => [...r.querySelectorAll(s)];
  const L = window.lumaDesk;   // the bridge to Suno's windows and Settings
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const scr = $('#scr'), INS = 14, WG = 10; let W = desk.clientWidth, H = desk.clientHeight;
  const U = p => new URL(p, location.href).href, GL = U('../icons/'), PH = U('../social-suno/photos/');   // absolute: the shell's stylesheet lives in desktop/
  let IC = U('../icons/Suno-v4-');   // D-Ink swaps it for the line drawings
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
    suno: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'center', surface: 'separate', attach: 'float', tuck: false },
    onebar: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'center', surface: 'joined', attach: 'float', tuck: false },
    grown: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'center', surface: 'joined', attach: 'prot', tuck: false },
    taskbar: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'spread', surface: 'joined', attach: 'prot', tuck: false },
    split: { edge: { dock: 'bottom', live: 'top', status: 'top' }, align: 'spread', surface: 'separate', attach: 'float', tuck: false },
    side: { edge: { dock: 'left', live: 'left', status: 'left' }, align: 'center', surface: 'separate', attach: 'float', tuck: false },
    tabs: { edge: { dock: 'bottom', live: 'bottom', status: 'bottom' }, align: 'spread', surface: 'separate', attach: 'prot', tuck: false },
    free: { attach: 'free', tuck: false }
  };
  const S = Object.assign({ clock: 'glance', soonAt: 0, offline: false, low: false, preset: 'suno', theme: 'dark', mat: 'solid', icon: 'lit', shape: 'squircle', size: 45, tiling: false, notif: 'center', dnd: false, free: {} }, PRESETS.suno, store.get('state', {})); S.liveMax = 2;   // recomputed for this screen on every load
  S.edge = Object.assign({}, PRESETS.suno.edge, S.edge);
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
     The launcher: Suno's own icon pinned at the start of the dock, in the same icon treatment as every app. It opens
     the app drawer: the screen blurs, and every app stands in a large grid with search on top; the shelf stays above.
     Folders: their own island between the dock and the system island. How a folder looks in it (&fl=):
       stack   a pocket in the folder's colour with its newest files standing in it
       glyph   a tinted tile with the folder's symbol and a count of what's new
     How it opens (&fo=):
       shelf   a strip of large file faces rises from the island, newest first
       sheet   a panel: grid or list, subfolders open in place (grid steps in, list unfolds)
       days    a tall list grouped by day (Today, Yesterday, Earlier), subfolders unfold in place */
  const QP = new URLSearchParams(location.search), FSTY = QP.get('fl') || 'stack', FOPEN = QP.get('fo') || 'shelf', FOLDON = SVAR === 'panel' || SVAR === 'line' || QP.has('fl') || QP.has('fo');
  const LAUNCH = `<button class="dapp dlaunch" type="button" data-act="pad" data-tip="All apps"><span class="ic" style="background-image:url(${U('assets/Suno-favicon.svg')})"></span></button><span class="dsep"></span>`;
  const P0 = n => PH + n + '.webp';
  const FOLDERS = [
    { id: 'dl', n: 'Downloads', g: 'download', h: 250, fresh: 3, files: [
      { n: 'Launch deck v4.key', k: 'deck', sz: '48 MB', d: 'Today, 2:41 PM', day: 'Today' }, { n: 'Studio North invoice.pdf', k: 'pdf', sz: '220 KB', d: 'Today, 11:08 AM', day: 'Today' },
      { n: 'terrace.jpg', k: 'img', th: 'life-sync-terrace', sz: '3.2 MB', d: 'Today, 9:30 AM', day: 'Today' }, { n: 'Invoices', k: 'folder', items: 6, d: 'Yesterday', day: 'Yesterday', sub: [
        { n: 'September.pdf', k: 'pdf', sz: '180 KB' }, { n: 'August.pdf', k: 'pdf', sz: '176 KB' }, { n: 'July.pdf', k: 'pdf', sz: '181 KB' }] },
      { n: 'suno-eclipse-1022.iso', k: 'zip', sz: '2.4 GB', d: 'Yesterday', day: 'Yesterday' }, { n: 'Budget 2027.xlsx', k: 'sheet', sz: '84 KB', d: 'Oct 21', day: 'Earlier' },
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
  const XAPPS = [];
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
