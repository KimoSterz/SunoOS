  function wrClick(e, hit) {
    if (wrNarrow()) { const px = hit('[data-wpx]'); if (px) { const k = px.dataset.wpx; W.px = W.px === k ? '' : k; writeBar(); return true; }
      if (hit('[data-wblock]') || hit('[data-wins]') || hit('[data-wgo]') || hit('[data-wfocus]') || hit('[data-wtodo]') || hit('[data-wcomment]') || hit('[data-wdone]')) { W.px = ''; setTimeout(writeBar); }
      if (hit('[data-walign]')) { wFocus(); document.execCommand({ left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }[hit('[data-walign]').dataset.walign]); return true; }
      if (hit('[data-whlc]')) { wFocus(); document.execCommand('hiliteColor', false, hit('[data-whlc]').dataset.whlc); return true; } }
    const fig = hit('#wr-doc figure'); if (fig && !hit('figcaption')) { W.img = fig; W.pickT = Date.now(); wSetCtx('image'); W.right = W.right || false; writeBar(); writeInsp(); selBar(); return true; }
    const cmd = hit('[data-wcmd]'); if (cmd) { wFocus(); document.execCommand(cmd.dataset.wcmd); W.range = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : W.range; writeBar(); writeInsp(); writeOutRows(); selBar(); return true; }
    if (hit('[data-wcheck]')) { wFocus(); document.execCommand('insertUnorderedList'); const b = blockAt(); if (b?.tagName === 'UL') b.classList.toggle('check'); writeInsp(); return true; }
    if (hit('[data-wlink]')) { wFocus(); document.execCommand('createLink', false, 'https://simplyluma.com'); selBar(); return true; }
    if (hit('[data-wcomment]')) { wFocus(); addComment(); return true; }
    const cl = hit('[data-wcolor]'); if (cl) { wFocus(); document.execCommand('foreColor', false, cl.dataset.wcolor); return true; }
    const hl = hit('[data-whlc]'); if (hl) { $('#lmenu')?.remove(); wFocus(); document.execCommand('hiliteColor', false, hl.dataset.whlc); return true; }
    const sty = hit('[data-wstyles]'); if (sty) { const cur = styleOf(W.blk); wMenu(sty, 'sty', `<h6>Paragraph style</h6>${STY.map(([k, n, c]) => crMi(`data-wblock="${k}"`, '', `<span class="${c}">${n}</span>`, k === cur ? ' on' : '')).join('')}`); return true; }
    const bl = hit('[data-wblock]'); if (bl) { $('#lmenu')?.remove(); wFocus(); document.execCommand('formatBlock', false, bl.dataset.wblock); W.blk = blockAt(); renderWrite(); return true; }
    const fn = hit('[data-wfont]'); if (fn) { wMenu(fn, 'font', `<h6>Font</h6>${WFONTS.map(([n, f]) => crMi(`data-wfontset="${n}"`, '', `<span style="font-family:${f}">${n}</span>`)).join('')}`); return true; }
    const fs = hit('[data-wfontset]'); if (fs) { $('#lmenu')?.remove(); if (W.blk) W.blk.style.fontFamily = WFONTS.find(f => f[0] === fs.dataset.wfontset)[1]; writeInsp(); return true; }
    const hm = hit('[data-whl]'); if (hm) { wMenu(hm, 'hl', `<h6>Highlight</h6><div class="wrsw2" style="padding:4px 6px 6px;width:216px">${WHL.map(([n, c]) => `<button type="button" class="${c === 'transparent' ? 'none' : ''}" style="--c:${c}" data-whlc="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>`); return true; }
    const am = hit('[data-walignm]'); if (am) { wMenu(am, 'al', `<h6>Alignment</h6>${[['left', 'align-left', 'Left'], ['center', 'align-center', 'Centre'], ['right', 'align-right', 'Right'], ['justify', 'align-justify', 'Justify']].map(([k, i, n]) => crMi(`data-walign="${k}"`, i, n)).join('')}`); return true; }
    const al = hit('[data-walign]'); if (al) { $('#lmenu')?.remove(); wFocus(); document.execCommand({ left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' }[al.dataset.walign]); writeBar(); writeInsp(); return true; }
    const ins = hit('[data-winsert]'); if (ins) { wMenu(ins, 'ins', `<h6>Insert</h6>${crMi('data-wins="image"', 'image', 'Photo')}${crMi('data-wins="table"', 'table', 'Table')}${crMi('data-wins="check"', 'list-checks', 'Checklist')}${crMi('data-wins="rule"', 'minus', 'Divider')}${crMi('data-wins="quote"', 'text-quote', 'Quote')}`); return true; }
    const wi = hit('[data-wins]'); if (wi) { $('#lmenu')?.remove(); wFocus(); const k = wi.dataset.wins;
      if (k === 'check') { document.execCommand('insertHTML', false, '<ul class="check"><li>&nbsp;</li></ul>'); }
      else if (k === 'quote') document.execCommand('formatBlock', false, 'blockquote');
      else document.execCommand('insertHTML', false, k === 'table' ? '<table><tr><th>Column</th><th>Column</th><th>Column</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table><p><br></p>' : k === 'rule' ? '<hr><p><br></p>' : `<figure contenteditable="false"><img src="${PH}life-hero-writing.webp" alt=""></figure><p><br></p>`);
      writeOutRows(); writeStat(); return true; }
    const pg = hit('[data-wpage]'); if (pg) { wMenu(pg, 'pg', `<h6>Page size</h6>${Object.entries(WPAGE).map(([k, p]) => crMi(`data-wpageset="${k}"`, '', `${p.n} · ${p.d}`, k === W.page ? ' on' : '')).join('')}`); return true; }
    const ps = hit('[data-wpageset]'); if (ps) { $('#lmenu')?.remove(); W.page = ps.dataset.wpageset; writeFit(); writeInsp(); return true; }
    const mg = hit('[data-wmargin]'); if (mg) { wMenu(mg, 'mg', `<h6>Margins</h6>${Object.entries(WMARG).map(([k, [n]]) => crMi(`data-wmarginset="${k}"`, '', n, k === W.margin ? ' on' : '')).join('')}`); return true; }
    const ms = hit('[data-wmarginset]'); if (ms) { $('#lmenu')?.remove(); W.margin = ms.dataset.wmarginset; writeFit(); writeInsp(); return true; }
    const zm = hit('[data-wzoom]'); if (zm) { wMenu(zm, 'zm', `<h6>Zoom</h6>${crMi('data-wz="fit"', '', 'Fit to window', W.zoom === 'fit' ? ' on' : '')}<span class="crsep"></span>${[.75, 1, 1.25, 1.5].map(z => crMi(`data-wz="${z}"`, '', Math.round(z * 100) + '%', W.zoom === z ? ' on' : '')).join('')}`); return true; }
    const wz = hit('[data-wz]'); if (wz) { $('#lmenu')?.remove(); W.zoom = wz.dataset.wz === 'fit' ? 'fit' : +wz.dataset.wz; writeFit(); return true; }
    const stt = hit('[data-wstat]'); if (stt) { const c = wCounts(); wMenu(stt, 'st', `<h6>This document</h6><div class="wrinfo"><span>Words</span><b>${c.w.toLocaleString()}</b><span>Characters</span><b>${c.ch.toLocaleString()}</b><span>Paragraphs</span><b>${c.para}</b><span>Pages</span><b>${c.pages}</b><span>Reading time</span><b>${c.min} min</b></div>`); return true; }
    if (hit('[data-wleft]')) { W.left = !W.left; writeOut(); writeFit(); return true; }
    if (hit('[data-wright]')) { W.right = !W.right; writeInsp(); writeTop(); writeFit(); return true; }
    const rt = hit('[data-wrtab]'); if (rt) { W.rtab = rt.dataset.wrtab; writeInsp(); writeTop(); return true; }
    if (hit('[data-wfind]')) { if (W.left && document.activeElement?.id === 'd-fq') { W.left = false; closeFind(); writeOut(); writeFit(); } else openFind(); return true; }
    if (hit('[data-wfmt]')) { const open = W.right && W.rtab === 'format'; W.right = !open; W.rtab = 'format'; W.focus = false; writeInsp(); writeTop(); writeFit(); return true; }
    if (hit('[data-wcms]')) { const open = W.right && W.rtab === 'comments'; W.right = !open; W.rtab = 'comments'; W.focus = false; writeInsp(); writeTop(); writeFit(); return true; }
    if (hit('[data-wfocus]')) { W.focus = !W.focus; renderWrite(); $('#d-sel').classList.remove('show'); return true; }
    const fst = hit('[data-wfstep]'); if (fst) { if (W.fcount) { W.fi = (W.fi + +fst.dataset.wfstep + W.fcount) % W.fcount; runFind(); wFindGo(); } return true; }
    if (hit('[data-wrep]')) { W.rep = !W.rep; writeOut(); $(W.rep ? '#d-fr' : '#d-fq')?.focus(); return true; }
    if (hit('[data-wrepone]') || hit('[data-wrepall]')) { const v = $('#d-fr')?.value ?? '', all = !!hit('[data-wrepall]'), rs = all ? [...(W.franges || [])].reverse() : [W.franges?.[W.fi]].filter(Boolean);
      rs.forEach(r => { r.deleteContents(); r.insertNode(document.createTextNode(v)); }); doc().normalize(); const n = rs.length; runFind(); writeOutRows(); writeStat(); if (n) lToast($('#w-write'), all ? `Replaced ${n}` : 'Replaced 1'); return true; }
    const go = hit('[data-wgo]'); if (go) { const h = wHs()[+go.dataset.wgo], d = $('#d-desk'); d.scrollTo({ top: d.scrollTop + h.getBoundingClientRect().top - d.getBoundingClientRect().top - 24, behavior: 'smooth' }); W.here = h; writeOutRows(); return true; }
    const mk = hit('#wr-doc mark.cm'); if (mk) { W.cm = mk.dataset.cm; W.right = true; W.rtab = 'comments'; wMarks(); writeInsp(); writeTop(); writeFit(); $(`[data-wcm="${W.cm}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return false; }
    const rs = hit('[data-wresolve]'); if (rs) { const id = rs.dataset.wresolve, c = CMS.find(x => x.id === id), m = doc().querySelector(`mark[data-cm="${id}"]`); if (m) m.replaceWith(...m.childNodes); CMS.splice(CMS.indexOf(c), 1); W.cm = null; writeInsp(); writeTop(); if (!c.draft) lToast($('#w-write'), 'Comment resolved'); return true; }
    const po = hit('[data-wpost]'); if (po) { const c = CMS.find(x => x.id === po.dataset.wpost), v = $(`[data-wdraft="${c.id}"]`).value.trim(); if (!v) return true; c.t = v; c.draft = false; writeInsp(); writeTop(); return true; }
    const rp = hit('[data-wreply]'); if (rp) { const c = CMS.find(x => x.id === rp.dataset.wreply); c.replying = !c.replying; writeInsp(); if (c.replying) $(`[data-wreplyt="${c.id}"]`)?.focus(); return true; }
    const rq = hit('[data-wrepost]'); if (rq) { const c = CMS.find(x => x.id === rq.dataset.wrepost), v = $(`[data-wreplyt="${c.id}"]`).value.trim(); if (!v) return true; (c.re = c.re || []).push({ who: 'me', at: 'Now', t: v }); c.replying = false; writeInsp(); return true; }
    const cc = hit('[data-wcm]'); if (cc && !hit('button,textarea')) { W.cm = cc.dataset.wcm; wMarks(); writeInsp(); wToCm(W.cm); return true; }
    const tb = hit('[data-wtbl]'); if (tb) { wTbl(tb.dataset.wtbl); return true; }
    const sw = hit('[data-wsw]'); if (sw) { wSwitch(sw.dataset.wsw); return true; }
    const im = hit('[data-wimg]'); if (im) { wImg(im.dataset.wimg); return true; }
    const isz = hit('[data-wimgsz]'); if (isz && W.img) { const k = isz.dataset.wimgsz; W.img.classList.remove('s', 'm', 'l'); if (k !== 'full') W.img.classList.add(k); W.img.dataset.sz = k; writeBar(); writeInsp(); return true; }
    if (hit('[data-wdone]')) { const o = W.ctx === 'table' ? W.tbl : W.img, nx = o?.nextElementSibling; W.img = null; wSetCtx('text'); W.range = null;   // Done leaves the caret just after the object
      if (nx) { const r = document.createRange(); r.selectNodeContents(nx); r.collapse(true); W.range = r; } wFocus(); writeBar(); writeInsp(); return true; }
    const td = hit('[data-wtodo]'); if (td) { lToast($('#w-write'), td.dataset.wtodo); return true; }
    if (W.ctx === 'image' && !hit('#d-insp') && !hit('#d-bar') && !hit('#lmenu')) { W.img = null; wSetCtx('text'); writeBar(); writeInsp(); }
    return false; }
  function wrChange(e) { const t = e.target, b = W.blk && doc().contains(W.blk) ? W.blk : null;
    if (t.matches('[data-wprop]') && b) { const v = parseFloat(t.value); if (isNaN(v)) return; const k = t.dataset.wprop;
      if (k === 'size') b.style.fontSize = (v / .75) + 'px'; else if (k === 'line') b.style.lineHeight = v; else if (k === 'before') b.style.marginTop = (v / .75) + 'px'; else if (k === 'after') b.style.marginBottom = (v / .75) + 'px'; writeStat(); }
    if (t.matches('[data-walt]') && W.img) W.img.querySelector('img').alt = t.value; }

  /* ══ Tide ══════════════════════════════════════════════════════════════ */
  const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; }, mmss = n => Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0'), tl = l => l.map(([t, d]) => ({ t, d }));
  const ALBUMS = [
    { id: 'pet', t: 'Pet Sounds', a: 'The Beach Boys', y: 1966, img: PH + 'pet-sounds.webp', h: 95, h2: 80, h3: 150, label: 'Capitol', note: 'Recorded across four months in Los Angeles, with most of the arrangements written and produced by Brian Wilson.',
      tr: tl([['Wouldn’t It Be Nice', '2:33'], ['You Still Believe in Me', '2:36'], ['That’s Not Me', '2:31'], ['Don’t Talk (Put Your Head on My Shoulder)', '2:58'], ['I’m Waiting for the Day', '3:06'], ['Let’s Go Away for Awhile', '2:24'], ['Sloop John B', '2:58'], ['God Only Knows', '2:51'], ['I Know There’s an Answer', '3:14'], ['Here Today', '2:59'], ['I Just Wasn’t Made for These Times', '3:12'], ['Pet Sounds', '2:37'], ['Caroline, No', '2:52']]) },
    { id: 'hdn', t: 'A Hard Day’s Night', a: 'The Beatles', y: 1964, img: PH + 'album-hdn.webp', h: 255, h2: 230, h3: 265, label: 'Parlophone', note: 'The first Beatles album made up entirely of their own songs, written alongside the film of the same name.',
      tr: tl([['A Hard Day’s Night', '2:34'], ['I Should Have Known Better', '2:43'], ['If I Fell', '2:19'], ['I’m Happy Just to Dance With You', '1:56'], ['And I Love Her', '2:29'], ['Tell Me Why', '2:08'], ['Can’t Buy Me Love', '2:11'], ['Any Time at All', '2:11'], ['I’ll Cry Instead', '1:46'], ['Things We Said Today', '2:35'], ['When I Get Home', '2:16'], ['You Can’t Do That', '2:34'], ['I’ll Be Back', '2:24']]) },
    { id: 'rum', t: 'Rumours', a: 'Fleetwood Mac', y: 1977, img: PH + 'album-rum.webp', h: 45, h2: 70, h3: 20, label: 'Warner Bros.', note: 'Written and recorded while the band’s two couples were separating, which is most of what the songs are about.',
      tr: tl([['Second Hand News', '2:56'], ['Dreams', '4:14'], ['Never Going Back Again', '2:14'], ['Don’t Stop', '3:13'], ['Go Your Own Way', '3:43'], ['Songbird', '3:20'], ['The Chain', '4:30'], ['You Make Loving Fun', '3:31'], ['I Don’t Want to Know', '3:15'], ['Oh Daddy', '3:56'], ['Gold Dust Woman', '4:56']]) },
    { id: 'kob', t: 'Kind of Blue', a: 'Miles Davis', y: 1959, img: PH + 'album-kob.webp', h: 245, h2: 215, h3: 260, label: 'Columbia', note: 'Recorded in two sessions, largely from sketches the players saw for the first time in the studio.', tr: tl([['So What', '9:22'], ['Freddie Freeloader', '9:46'], ['Blue in Green', '5:37'], ['All Blues', '11:33'], ['Flamenco Sketches', '9:26']]) },
    { id: 'blue', t: 'Blue', a: 'Joni Mitchell', y: 1971, img: PH + 'album-blue.webp', h: 230, h2: 200, h3: 250 }, { id: 'harv', t: 'Harvest', a: 'Neil Young', y: 1972, img: PH + 'album-harv.webp', h: 65, h2: 90, h3: 40 }, { id: 'abbey', t: 'Abbey Road', a: 'The Beatles', y: 1969, img: PH + 'album-abbey.webp', h: 200, h2: 180, h3: 230 },
    { id: 'rain', t: 'In Rainbows', a: 'Radiohead', y: 2007, img: PH + 'album-rain.webp', h: 25, h2: 330, h3: 290 }, { id: 'curr', t: 'Currents', a: 'Tame Impala', y: 2015, img: PH + 'album-curr.webp', h: 300, h2: 20, h3: 280 }, { id: 'ram', t: 'Random Access Memories', a: 'Daft Punk', y: 2013, img: PH + 'album-ram.webp', h: 60, h2: 80, h3: 30 },
    { id: 'blonde', t: 'Blonde', a: 'Frank Ocean', y: 2016, img: PH + 'album-blonde.webp', h: 150, h2: 100, h3: 170 }, { id: 'ff', t: 'Fleet Foxes', a: 'Fleet Foxes', y: 2008, img: PH + 'album-ff.webp', h: 120, h2: 95, h3: 150 }];
  const AL = id => ALBUMS.find(a => a.id === id);
  const PLS = [{ id: 'sun', t: 'Sunday morning', h: 70, h2: 95, h3: 40, n: 42 }, { id: 'focus', t: 'Focus', h: 230, h2: 200, h3: 260, n: 88 }, { id: 'road', t: 'Road trip', h: 25, h2: 50, h3: 350, n: 61 }, { id: 'launch', t: 'Launch week', h: 300, h2: 320, h3: 270, n: 17 }];
  const cover = (x, plain) => x.img ? `<span class="cv"><img src="${x.img}" alt="" draggable="false"></span>` : `<span class="cv${plain ? ' plain' : ''}" style="--h:${x.h};--h2:${x.h2};--h3:${x.h3}"><b>${esc(x.t)}</b><span>${esc(x.a || 'Playlist')}</span></span>`;
  const T = { view: 'album', album: 'pet', hist: [], playing: true, cur: { al: 'pet', i: 7 }, pos: 64, vol: 70, shuf: false, rep: false, queue: false, now: false, nowTab: 'next', src: false, out: false, device: 'This computer', liked: { 'pet:7': 1, 'pet:0': 1 }, q: '', pane: null, srcAt: null, sort: { k: 'album', dir: 1 } };
  /* Where the music comes from. Sources and Up next open in the LumaUI details pane beside the room (on a phone, the drawer). */
  const TSRC = [{ id: 'nd', n: 'Navidrome', icon: 'server', st: 'ok', remote: 1, sub: 'Up to date · 19,333 songs', kv: [['Server', 'music.home.lan'], ['Account', 'nick'], ['Songs', '19,333'], ['Last sync', '4 minutes ago'], ['Password', 'In your keyring']] },
    { id: 'dev', n: 'This device', icon: 'monitor', st: 'ok', sub: 'Music folder · 412 songs', kv: [['Folder', '~/Music'], ['Songs', '412'], ['Last sync', 'Watching for changes']] },
    { id: 'dl', n: 'Downloads', icon: 'download', st: 'busy', sub: 'Downloading 3 songs', kv: [['Kept offline', '38 songs · 312 MB'], ['Downloading', '3 songs']] }];
  const tBack = () => { const h = T.hist[T.hist.length - 1]; return h ? { label: h[0] === 'album' ? AL(h[1]).t : { albums: 'Albums', artists: 'Artists', songs: 'Songs' }[h[0]] || 'Listen now', attr: 'data-tback' } : null; };
  const curAl = () => AL(T.cur.al), curTr = () => curAl().tr[T.cur.i];
  const setAh = h => $('#w-tide').style.setProperty('--ah', h);
  function tHue() { const a = T.view === 'album' ? AL(T.album) : curAl(); if (a.img) sampleHue(a.img, setAh); else setAh(a.h); }
  const trRow = (a, i, songs) => { const t = a.tr[i], cur = T.cur.al === a.id && T.cur.i === i, lk = T.liked[a.id + ':' + i];
    return `<div class="tr${cur ? ' cur' : ''}" data-tplay="${a.id}:${i}"><span class="n ${cur && !T.playing ? 'paused' : ''}">${cur ? '<span class="bars"><i></i><i></i><i></i></span>' : `<span>${i + 1}</span>`}${ic('play')}</span><span class="t">${esc(t.t)}</span>${songs ? `<span class="al">${esc(a.t)} · ${esc(a.a)}</span>` : ''}<button class="lk${lk ? ' on' : ''}" type="button" data-tlike="${a.id}:${i}" aria-label="Love">${ic('heart')}</button><span class="d">${t.d}</span></div>`; };
  /* Tide in the kit. The title bar holds search, because in a music library you mostly find by name.
     The sidebar is places and playlists, with the library's state at its foot. The album is the
     room: its colour washes the island and lights the player below it, on the frame. */
  /* Tide, the deck. Four places don't earn a sidebar: they are tabs in the title bar, and the
     room gets the whole window. What is playing is the deck, a tinted glass object floating
     at the foot of the room with the record's sleeve standing up out of it. */
  function tideTop() {
    // The title bar says which app this is; where you are in the library floats top right, like every island app
    $('#t-top').innerHTML = `<img src="${A}music.svg" alt=""><b>Tide</b><span class="chev">${ic('chevron-down')}</span>`;
    const open = (T.searching || T.q) && !tNarrow();   /* on a phone, search lives in the tab bar */
    $('#t-float').innerHTML = `<div class="ttabs" id="t-tabs"></div>${open ? `<label class="srch tsrch">${ic('search')}<input id="t-q" placeholder="Search" value="${esc(T.q)}" aria-label="Search music"><button class="fqx" type="button" data-tsearchx aria-label="Close search">${ic('x')}</button></label>` : `<button class="ib tsbtn" type="button" data-tsearch aria-label="Search" title="Search · Ctrl F">${ic('search')}</button>`}<button class="ib tsbtn${T.pane === 'sources' ? ' on' : ''}" type="button" data-tpane="sources" aria-label="Sources" title="Sources" aria-pressed="${T.pane === 'sources'}">${ic('library')}${TSRC.some(s => s.st !== 'ok') ? `<i class="stat ${TSRC.some(s => s.st === 'bad') ? 'bad' : 'busy'}"></i>` : ''}</button>`;
    const qf = $('#t-q'); if (qf) { qf.oninput = () => { T.q = qf.value; T.view = 'songs'; tideSide(); tideMain(); }; qf.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); T.q = ''; T.searching = false; tideTop(); tideSide(); tideMain(); } }; } }
  function tideSide() { const cur = T.view === 'album' ? 'albums' : T.view;
    $('#t-tabs').innerHTML = seg([['albums', 'Albums'], ['artists', 'Artists'], ['songs', 'Songs']], cur, 'data-tview', 'Library'); requestAnimationFrame(segs); tidePhBar(); }
  /* Tide on a phone (the window under 560): a music app first. Where you are in the library is the action bar at the thumb:
     Listen now, Albums, Artists, Songs and Search, each an icon over its name. What's playing floats just above it as a
     mini player; tap it for Now Playing, full screen. Search turns the bar into the search field, in place. */
  const tNarrow = () => ($('#w-tide .ibody')?.clientWidth || 999) < 560;
  /* Share on a phone grows Tide's bar (from an album, or from Now Playing, which closes to show it) */
  function sh0(hit) { const sh = hit('[data-share]'); if (!sh || !sh.closest('#w-tide') || !tNarrow()) return false; T.shareWhat = T.now ? curTr().t : T.view === 'album' ? AL(T.album).t : curAl().t; if (T.now) { T.now = false; tideNow(); } T.px = 'share'; tidePhBar(); return true; }
  /* v71 phone pass: one bar, like every other app's, holding what's playing and where you are. Its top row is the mini
     player (a thin neutral progress line under it); a hairline; then the section you're in (tap to switch Listen now,
     Albums, Artists, Songs), Search, and Volume, which grows a slider and where it plays. Share grows the bar too. */
  function tidePhBar() { const w = $('#w-tide'), nw = tNarrow(); w.classList.toggle('tnarrow', nw); let bar = $('#t-phbar');
    if (!nw) { bar?.remove(); return; } if (!bar) { $('#t-bot').insertAdjacentHTML('afterend', '<div class="fbar tphbar phnofit" id="t-phbar" aria-label="Tide"></div>'); bar = $('#t-phbar'); }
    bar.hidden = !!T.now; const X = T.px || '', a = curAl(), t = curTr(), dur = secs(t.d);
    const cur = T.searching || T.q ? 'search' : T.view === 'album' ? (T.hist.length ? (T.hist[0][0] === 'album' ? 'albums' : T.hist[0][0]) : 'albums') : ['albums', 'artists', 'songs'].includes(T.view) ? T.view : 'home';
    const SEC = [['home', 'house', 'Listen now'], ['albums', 'disc-3', 'Albums'], ['artists', 'mic-vocal', 'Artists'], ['songs', 'music', 'Songs']], sec = SEC.find(x => x[0] === cur) || SEC[0];
    const panel = X === 'lib' ? `<div class="fexp"><div class="fsha">${SEC.map(([k, i, n]) => `<button type="button" class="fvt${cur === k ? ' on' : ''}" data-tview="${k}" data-ttabroot>${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`
      : X === 'vol' ? `<div class="fexp tvolp"><div class="fexh">Volume</div><label class="tvolr">${ic('volume-1')}<input class="rng" id="t-vol" type="range" min="0" max="100" value="${T.vol}" style="--p:${T.vol}%" aria-label="Volume">${ic('volume-2')}</label>
          <div class="fexh">Playing on</div>${[['This computer', 'smartphone', 'This phone', 'Speaker'], ['Studio headphones', 'headphones', 'Studio headphones', 'Bluetooth · 80%'], ['Kitchen', 'speaker', 'Kitchen', 'Speaker on your network']].map(([k, i, n, sub]) => `<button class="fexr2${T.device === k ? ' on' : ''}" type="button" data-tdev="${k}">${ic(i)}<span>${n}<small>${sub}</small></span>${T.device === k ? ic('check') : ''}</button>`).join('')}</div>`
      : X === 'share' ? `<div class="fexp fshare2"><div class="fexh">Send ${esc(T.shareWhat || a.t)} to</div><div class="fshp">${['PR', 'NF', 'SK', 'TH', 'MO'].map(k => `<button type="button" data-tshdo="Sent to ${esc(ppl(k).n.split(' ')[0])}">${av(k, 48)}<span>${esc(ppl(k).n.split(' ')[0])}</span></button>`).join('')}</div>
          <div class="fsha">${[['message-square', 'Messages', 'Opening Messages'], ['mail', 'Email', 'Opening a new email'], ['link', 'Copy link', 'Link copied'], ['radio-tower', 'Nearby', 'Looking for devices nearby']].map(([i, n, m]) => `<button type="button" class="fvt" data-tshdo="${m}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    const mini = `<div class="tpmini"><button class="tmhit" type="button" data-tnow aria-label="Now playing: ${esc(t.t)}, ${esc(a.a)}">${cover(a, 1)}<span class="tmt"><b>${esc(t.t)}</b><span>${esc(a.a)}</span></span></button><button class="ib tmpp" type="button" data-tpp aria-label="${T.playing ? 'Pause' : 'Play'}">${ic(T.playing ? 'pause' : 'play')}</button><button class="ib" type="button" data-tstep="1" aria-label="Next">${ic('skip-forward')}</button><i class="tmprog" id="t-mprog" style="--p:${T.pos / dur * 100}%"></i></div>`;
    const row = cur === 'search' ? `<label class="srch keep tphq">${ic('search')}<input id="t-q" placeholder="Artists, albums and songs" value="${esc(T.q)}" aria-label="Search music"></label><button class="ib" type="button" data-tsearchx aria-label="Close search" title="Close search">${ic('x')}</button>`
      : `<button class="tsec2${X === 'lib' ? ' on' : ''}" type="button" data-tpx="lib" aria-expanded="${X === 'lib'}">${ic(sec[1])}<b>${sec[2]}</b>${ic('chevron-down')}</button><span class="sp"></span><button class="ib" type="button" data-tsearch aria-label="Search" title="Search">${ic('search')}</button><button class="ib${X === 'vol' ? ' on' : ''}" type="button" data-tpx="vol" aria-label="Volume and output" title="Volume" aria-expanded="${X === 'vol'}">${ic(T.device === 'This computer' ? 'volume-2' : 'headphones')}</button>`;
    const had = document.activeElement?.id === 't-q';
    bar.innerHTML = `${panel}${mini}<div class="tprow">${row}</div>`;
    const qf = $('#t-q'); if (qf) { qf.oninput = () => { T.q = qf.value; T.view = 'songs'; tideMain(); }; qf.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); T.q = ''; T.searching = false; tideSide(); tideMain(); } }; if (had || !T.q) { qf.focus(); qf.setSelectionRange(qf.value.length, qf.value.length); } } }
  const heroBg = a => `<i class="herobg" style="${a.img ? `background-image:url('${a.img}')` : `background:radial-gradient(60% 80% at 30% 20%, oklch(0.75 0.12 ${a.h2}), transparent), linear-gradient(155deg, oklch(0.55 0.13 ${a.h}), oklch(0.3 0.09 ${a.h3}))`}"></i>`;
  function tideMain() { const sc = $('#t-body'); let html = '';
    if (T.view === 'album') { const a = AL(T.album), mins = a.tr ? Math.round(a.tr.reduce((n, t) => n + secs(t.d), 0) / 60) : 0, here = T.cur.al === a.id && T.playing;
      const more = ALBUMS.filter(x => x.a === a.a && x.id !== a.id).concat(ALBUMS.filter(x => x.a !== a.a && x.id !== a.id)).slice(0, 7);
      html = `${heroBg(a)}<section class="hero">${cover(a)}<div>${T.hist.length ? `<div class="kick">${lTrail({ back: tBack() })}</div>` : '<div class="kick">Album</div>'}<h2>${esc(a.t)}</h2><div class="by"><button type="button" data-tview="artists">${esc(a.a)}</button></div><div class="m2">${a.y}${a.tr ? ` · ${a.tr.length} songs · ${mins} min` : ''}</div>
        <div class="acts"><button class="bt pri" type="button" data-tplayall="${a.id}">${ic(here ? 'pause' : 'play')}${here ? 'Pause' : 'Play'}</button><button class="bt fill" type="button" data-tshufall="${a.id}">${ic('shuffle')}Shuffle</button>
        <button class="ib${T.liked['al:' + a.id] ? ' loved' : ''}" type="button" data-tlike="al:${a.id}" aria-label="Love album">${ic('heart')}</button><button class="ib" type="button" data-share aria-label="Share album">${ic('share-2')}</button><button class="ib" type="button" aria-label="More">${ic('ellipsis')}</button></div></div></section>
        ${a.tr ? `<div class="tl">${a.tr.map((_, i) => trRow(a, i)).join('')}</div><div class="tfoot">${a.label ? `${a.y} · ${esc(a.label)}<br>` : ''}${esc(a.note || '')}</div>` : `<p class="tfoot">This album is still being added from your library.</p>`}
        <div class="row2"><h3>More to listen to</h3><div class="acrow">${more.map(x => `<button class="acard" type="button" data-talbum="${x.id}">${cover(x)}<strong>${esc(x.t)}</strong><span>${esc(x.a)}</span></button>`).join('')}</div></div><div style="height:28px"></div>`;
    } else { let title = '', m = [], inner = '';
      if (T.view === 'albums') { title = 'Albums'; m = [`${ALBUMS.length} albums`, 'Recently played first']; inner = `<div class="agrid">${ALBUMS.map(x => `<button class="acard" type="button" data-talbum="${x.id}">${cover(x)}<strong>${esc(x.t)}</strong><span>${esc(x.a)} · ${x.y}</span></button>`).join('')}</div>`; }
      else if (T.view === 'artists') { const arts = [...new Map(ALBUMS.map(x => [x.a, x])).values()]; title = 'Artists'; m = [`${arts.length} artists`];
        inner = `<div class="artgrid">${arts.map(x => { const n = ALBUMS.filter(y => y.a === x.a).length; return `<button class="artist" type="button" data-talbum="${x.id}">${x.img ? `<span class="face" style="--h:${x.h};background:url('${x.img}') center/cover"></span>` : `<span class="face" style="--h:${x.h}">${esc(x.a.replace(/^The /, '')[0])}</span>`}<strong>${esc(x.a)}</strong><span>${n} album${n > 1 ? 's' : ''}</span></button>`; }).join('')}</div>`; }
      else if (T.view === 'songs') { const s = T.q.trim().toLowerCase(), rows = ALBUMS.filter(a => a.tr).flatMap(a => a.tr.map((t, i) => ({ a, i, t }))).filter(r => !s || (r.t.t + ' ' + r.a.t + ' ' + r.a.a).toLowerCase().includes(s));
        const sk = T.sort.k, sd = T.sort.dir; rows.sort((x, y) => sd * (sk === 'time' ? secs(x.t.d) - secs(y.t.d) : sk === 'title' ? x.t.t.localeCompare(y.t.t) : x.a.t.localeCompare(y.a.t) || x.i - y.i));
        const sArts = s ? [...new Map(ALBUMS.filter(x => x.a.toLowerCase().includes(s)).map(x => [x.a, x])).values()] : [], sAls = s ? ALBUMS.filter(x => (x.t + ' ' + x.a).toLowerCase().includes(s)) : [];
        const groups = s && tNarrow() ? `${sArts.length ? `<h3 class="tsh">Artists</h3><div class="tsarts">${sArts.map(x => { const n = ALBUMS.filter(y => y.a === x.a).length; return `<button class="tsart" type="button" data-talbum="${x.id}">${x.img ? `<span class="face" style="--h:${x.h};background:url('${x.img}') center/cover"></span>` : `<span class="face" style="--h:${x.h}">${esc(x.a.replace(/^The /, '')[0])}</span>`}<span><b>${esc(x.a)}</b><small>Artist · ${n} album${n > 1 ? 's' : ''}</small></span></button>`; }).join('')}</div>` : ''}${sAls.length ? `<h3 class="tsh">Albums</h3><div class="acrow tsals">${sAls.map(x => `<button class="acard" type="button" data-talbum="${x.id}">${cover(x)}<strong>${esc(x.t)}</strong><span>${esc(x.a)}</span></button>`).join('')}</div>` : ''}${rows.length ? '<h3 class="tsh">Songs</h3>' : ''}${!rows.length && !sArts.length && !sAls.length ? `<p class="tsnone">Nothing matches “${esc(T.q.trim())}”.</p>` : ''}` : '';
        title = s ? 'Results' : 'Songs'; m = [s ? (tNarrow() ? [sArts.length && `${sArts.length} artist${sArts.length > 1 ? 's' : ''}`, sAls.length && `${sAls.length} album${sAls.length > 1 ? 's' : ''}`, `${rows.length} song${rows.length === 1 ? '' : 's'}`].filter(Boolean).join(', ') : `${rows.length} songs match “${esc(T.q.trim())}”`) : `${rows.length} songs`]; inner = `${groups}<div class="songs">${lTHead.grid([['', ''], ['title', 'Title'], ['album', 'Album'], ['', ''], ['time', 'Time', 'd']], T.sort, 'data-tsort', 'tr th')}${rows.map(r => trRow(r.a, r.i, true)).join('')}</div>`; }
      else { const c = curAl(); title = 'Listen now'; m = ['Picked from what you play here', `<button class="lstat" type="button" data-tpane="sources"><i class="stat"></i>Library up to date · 3 sources</button>`];
        inner = `<div class="feat2"><button class="feature" type="button" data-talbum="${c.id}" style="--fh:${hueCache[c.img] ?? c.h}">${cover(c)}<span><small>Jump back in</small><b>${esc(c.t)}</b><span>${esc(c.a)} · you stopped at ${esc(curTr().t)}</span></span></button>
          <button class="feature" type="button" data-talbum="kob" style="--fh:245">${cover(AL('kob'))}<span><small>For a quiet evening</small><b>Kind of Blue</b><span>Miles Davis · 5 songs · 46 min</span></span></button></div>
          <div class="row2" style="padding-left:0;padding-right:0"><h3>Recently played</h3><div class="acrow">${ALBUMS.slice(0, 8).map(x => `<button class="acard" type="button" data-talbum="${x.id}">${cover(x)}<strong>${esc(x.t)}</strong><span>${esc(x.a)}</span></button>`).join('')}</div></div>`; }
      html = `<header class="ttl tttl">${lTrail({ back: tBack(), title, meta: m })}</header><div class="pagepad">${inner}</div>`; }
    const top = sc.scrollTop; sc.innerHTML = html; sc.scrollTop = T._keep ? top : 0; T._keep = false; tHue(); }
  function qItems() { const a = curAl(); return a.tr.map((t, i) => ({ a, i, t })).filter(x => x.i >= T.cur.i); }
  const qHTML = (list, head) => list.map((x, n) => `${n === 1 ? `<div class="qlab">${head}</div>` : ''}<button class="qi${n === 0 ? ' cur' : ''}" type="button" data-tplay="${x.a.id}:${x.i}">${cover(x.a, 1)}<span class="tx"><b>${esc(x.t.t)}</b><span>${esc(x.a.a)}</span></span><em>${x.t.d}</em></button>`).join('');
  function tideQueue() { if (T.queue) T.pane = 'queue'; else if (T.pane === 'queue') T.pane = null; tidePane(); }
  const tSrcBtns = s => s.remote ? lStack([{ icon: 'refresh-cw', label: 'Sync now', attr: `data-tsrcsync="${s.id}"` }, { icon: 'pencil', label: 'Edit', attr: `data-tsrcat="edit:${s.id}"` }], 'sm') + lStack([s.st === 'bad' ? { icon: 'key-round', label: 'Sign in', attr: `data-tsrcat="edit:${s.id}"` } : { icon: 'log-out', label: 'Sign out', attr: `data-tsrcout="${s.id}"` }, { icon: 'trash-2', label: 'Remove', attr: `data-tsrcrm="${s.id}"`, danger: 1 }], 'sm', 'tsrc2')
    : lStack([{ icon: 'refresh-cw', label: 'Sync now', attr: `data-tsrcsync="${s.id}"` }, { icon: 'folder', label: 'Show in Filer', attr: `data-tsrcfiler="${s.id}"` }], 'sm');
  const tSrcIco = (s, lg) => `<span class="tsrci${lg ? ' lg' : ''}">${ic(s.icon)}<i class="stat ${s.st}"></i></span>`;
  function tSrcMenu(a, id) { const s = TSRC.find(x => x.id === id); if (!s) return; lMenu(a, `<h6>${esc(s.n)}</h6>${crMi(`data-tsrcsync="${id}"`, 'refresh-cw', 'Sync now')}${s.remote ? crMi(`data-tsrcat="edit:${id}"`, 'pencil', 'Edit') + crMi(`data-tsrcout="${id}"`, 'log-out', 'Sign out') + '<span class="crsep"></span>' + crMi(`data-tsrcrm="${id}"`, 'trash-2', 'Remove', ' red') : crMi(`data-tsrcfiler="${id}"`, 'folder', 'Show in Filer')}`); }
  function tidePane() { const p = $('#t-pane'); if (!p) return; if (!lDPShow(p, { open: !!T.pane, subject: true })) { p.innerHTML = ''; requestAnimationFrame(shapeDeck); return; }
    if (T.pane === 'queue') { const list = qItems(); p.setAttribute('aria-label', 'Up next'); p.innerHTML = lDP({ title: 'Up next', close: 'data-tqueue', body: `${lDP.lab('Playing from ' + curAl().t, '<button type="button" data-tqclear>Clear</button>')}<div class="tqlist">${qHTML(list, `Then ${list.length - 1} more`)}</div>` }); requestAnimationFrame(shapeDeck); return; }
    const at = T.srcAt || '', ed = at.startsWith('edit:') ? TSRC.find(x => x.id === at.slice(5)) : null, s = TSRC.find(x => x.id === at), back = lTrail({ back: { label: 'Sources', attr: 'data-tsrcat=""' } });
    let body = '';
    if (at === 'add' || ed) body = `${back}<div class="tsrchead">${tSrcIco({ icon: 'server', st: ed ? ed.st : '' })}<span><b>Navidrome or Subsonic</b><small>Any server that speaks Subsonic</small></span></div>${lField('Server address', 'data-tsrcf="url" placeholder="music.example.com" spellcheck="false" autocomplete="off"', ed ? ed.kv[0][1] : '')}${lField('Username', 'data-tsrcf="user" spellcheck="false" autocomplete="off"', ed ? ed.kv[1][1] : '')}${lField('Password', `data-tsrcf="pw" type="password" autocomplete="off"${ed ? ' placeholder="Unchanged"' : ''}`)}<p class="lfhint">Kept in your keyring on this computer.</p><div class="tsrcgo"><button class="bt key" type="button" data-tsrcconnect="${ed ? ed.id : ''}">${ed ? 'Save' : 'Connect'}</button></div>`;
    else if (s) body = `${back}<div class="ldphero">${tSrcIco(s, 1)}<b>${esc(s.n)}</b><small>${esc(s.sub)}</small></div>${lDP.kv(s.kv.map(([k, v]) => [k, esc(v)]))}${tSrcBtns(s)}`;
    else body = `<div class="ldplist">${TSRC.map(x => lDP.row({ av: tSrcIco(x), n: x.n, sub: x.sub, attr: `data-tsrcat="${x.id}" data-tsrcrow="${x.id}"`, acts: lDP.act('refresh-cw', 'Sync now', `data-tsrcsync="${x.id}"`) + lDP.act('ellipsis', 'More', `data-tsrcmore="${x.id}" data-lmenu`) })).join('')}${lAddRow('Add source', 'data-tsrcat="add"', 'plus')}</div>`;
    p.setAttribute('aria-label', 'Sources'); p.innerHTML = lDP({ title: ed ? 'Edit ' + ed.n : at === 'add' ? 'Add source' : s ? s.n : 'Sources', close: 'data-tpane="sources"', body }); requestAnimationFrame(shapeDeck); }
  function tideNow() { const n = $('#t-now'); n.hidden = !T.now; if ($('#t-phbar')) $('#t-phbar').hidden = !!T.now; $('#t-bot')?.classList.toggle('nowing', T.now); if (!T.now) return; const a = curAl(), t = curTr();
    n.classList.toggle('tnowph', tNarrow());
    if (tNarrow()) { const dur = secs(t.d), lk = T.liked[a.id + ':' + T.cur.i], q = T.nowq;
      /* Now Playing on a phone: the sleeve large, then the song, the scrubber, the transport, the volume, and a row for
         Up next and where it plays. Up next shrinks the sleeve to a header and lists what's coming. */
      n.innerHTML = `<div class="bg" style="${a.img ? `background-image:url('${a.img}')` : `background:linear-gradient(155deg, oklch(0.6 0.13 ${a.h}), oklch(0.28 0.09 ${a.h3}))`}"></div>
        <header class="tnh"><button class="ib" type="button" data-tnow aria-label="Close now playing">${ic('chevron-down')}</button><span><small>Playing from</small><b>${esc(a.t)}</b></span><button class="ib" type="button" data-share aria-label="Share">${ic('share-2')}</button></header>
        ${q ? `<div class="tnq"><div class="tnqh">${cover(a, 1)}<span><b>${esc(t.t)}</b><span>${esc(a.a)}</span></span></div><div class="qlab">Up next</div><div class="tnql">${qHTML(qItems().slice(1), '')}</div></div>`
          : `<div class="tnart">${cover(a)}</div><div class="tnt"><span><b>${esc(t.t)}</b><button type="button" data-tview="artists">${esc(a.a)}</button></span><button class="ib${lk ? ' loved' : ''}" type="button" data-tlike="${a.id}:${T.cur.i}" aria-label="Love">${ic('heart')}</button></div>`}
        <div class="tnscrub"><input class="rng" id="t-rng" type="range" min="0" max="${dur}" value="${T.pos}" style="--p:${T.pos / dur * 100}%" aria-label="Position"><span><em id="t-pos">${mmss(T.pos)}</em><em id="t-rem">−${mmss(dur - T.pos)}</em></span></div>
        <div class="tnctl"><button class="ib${T.shuf ? ' on' : ''}" type="button" data-tshuf aria-label="Shuffle">${ic('shuffle')}</button><button class="ib tnskip" type="button" data-tstep="-1" aria-label="Previous">${ic('skip-back')}</button><button class="tnpp" type="button" data-tpp aria-label="${T.playing ? 'Pause' : 'Play'}">${ic(T.playing ? 'pause' : 'play')}</button><button class="ib tnskip" type="button" data-tstep="1" aria-label="Next">${ic('skip-forward')}</button><button class="ib${T.rep ? ' on' : ''}" type="button" data-trep aria-label="Repeat">${ic('repeat')}</button></div>
        <label class="tnvol">${ic('volume-1')}<input class="rng" id="t-vol" type="range" min="0" max="100" value="${T.vol}" style="--p:${T.vol}%" aria-label="Volume">${ic('volume-2')}</label>
        <div class="tnfoot"><button class="ib${q ? ' on' : ''}" type="button" data-tnowq aria-label="Up next" aria-pressed="${!!q}">${ic('list-music')}</button><button class="tndev" type="button" data-tout>${ic(T.device === 'This computer' ? 'smartphone' : 'headphones')}<span>${T.device === 'This computer' ? 'This phone' : esc(T.device)}</span></button><button class="ib" type="button" aria-label="More">${ic('ellipsis')}</button></div>`; return; }
    n.innerHTML = `<div class="bg" style="${a.img ? `background-image:url('${a.img}')` : `background:linear-gradient(155deg, oklch(0.6 0.13 ${a.h}), oklch(0.28 0.09 ${a.h3}))`}"></div><button class="close" type="button" data-tnow aria-label="Close now playing">${ic('chevron-down')}</button>
      <div class="stage"><span class="big">${cover(a)}</span><h2>${esc(t.t)}</h2><div class="who">${esc(a.a)} · ${esc(a.t)} · ${a.y}</div></div>
      <div class="side2">${seg([['next', 'Up next'], ['about', 'About']], T.nowTab, 'data-tnowtab', 'Now playing', 'tabs2')}<div class="list2">${T.nowTab === 'next' ? qHTML(qItems(), 'Next from ' + esc(a.t)) : `<div class="about"><p>${esc(a.note || '')}</p><dl><dt>Released</dt><dd>${a.y}</dd>${a.label ? `<dt>Label</dt><dd>${esc(a.label)}</dd>` : ''}<dt>In your library</dt><dd>Navidrome, on your home server</dd></dl></div>`}</div></div>`; requestAnimationFrame(segs); }
  function tideBot() { const a = curAl(), t = curTr(), dur = secs(t.d), lk = T.liked[a.id + ':' + T.cur.i];
    const deck = $('#t-bot'), setH = h => { deck.style.setProperty('--ah', h); deck.style.setProperty('--dh', h); }; if (a.img) sampleHue(a.img, setH); else setH(a.h);   // lit by what is playing
    deck.classList.toggle('tmini', tNarrow());
    if (tNarrow()) { deck.style.width = deck.style.left = ''; deck.innerHTML = ''; tidePhBar(); return; }
    deck.querySelector(':scope > .dkshape')?.remove(); deck.innerHTML = `<button class="sleeve" type="button" data-talbum="${a.id}" aria-label="Open ${esc(a.t)}" title="Open ${esc(a.t)}">${cover(a, 1)}</button>
      <div class="dmid"><div class="dtx"><span class="dtl"><b>${esc(t.t)}</b><button class="ib dlove${lk ? ' loved' : ''}" type="button" data-tlike="${a.id}:${T.cur.i}" aria-label="Love" title="Love">${ic('heart')}</button></span><span><button type="button" data-tview="artists">${esc(a.a)}</button> · <button type="button" data-talbum="${a.id}">${esc(a.t)}</button></span></div></div>
      <div class="dctlw"><div class="dctl"><button class="ib wide${T.shuf ? ' on' : ''}" type="button" data-tshuf aria-label="Shuffle">${ic('shuffle')}</button><button class="ib fillicon" type="button" data-tstep="-1" aria-label="Previous">${ic('skip-back')}</button>
        <button class="pp" type="button" data-tpp aria-label="${T.playing ? 'Pause' : 'Play'}">${ic(T.playing ? 'pause' : 'play')}</button><button class="ib fillicon" type="button" data-tstep="1" aria-label="Next">${ic('skip-forward')}</button><button class="ib wide${T.rep ? ' on' : ''}" type="button" data-trep aria-label="Repeat">${ic('repeat')}</button></div>
        <div class="scrub"><span id="t-pos">${mmss(T.pos)}</span><input class="rng" id="t-rng" type="range" min="0" max="${dur}" value="${T.pos}" style="--p:${T.pos / dur * 100}%" aria-label="Position"><span id="t-rem">−${mmss(dur - T.pos)}</span></div></div>
      <div class="dend wide"><button class="ib${T.queue ? ' on' : ''}" type="button" data-tqueue aria-label="Up next">${ic('list')}</button><button class="ib${T.out ? ' on' : ''}" type="button" data-tout aria-label="Play on ${esc(T.device)}">${ic(T.device === 'This computer' ? 'monitor' : 'headphones')}</button>
        <span class="vol">${ic('volume-2')}<input class="rng" id="t-vol" type="range" min="0" max="100" value="${T.vol}" style="--p:${T.vol}%" aria-label="Volume"></span></div>`;
    shapeDeck(); $('#t-main .pop')?.remove();
    if (T.out) $('#t-main').insertAdjacentHTML('beforeend', `<div class="pop outpop"><h6>Play on</h6>${[['This computer', 'monitor', 'Built-in speakers'], ['Studio headphones', 'headphones', 'Bluetooth · 80%'], ['Kitchen', 'volume-2', 'Speaker on your network']].map(([n, i, s]) => `<button class="mi" type="button" data-tdev="${n}">${ic(i)}<span><b>${n}</b><span class="sub">${s}</span></span>${T.device === n ? `<span class="end">${ic('check')}</span>` : ''}</button>`).join('')}</div>`); }
  /* The deck is part of the frame: one shape rising from the bottom edge into the room, with concave shoulders.
     The fill traces the exact boundary; strokes sit on whole pixels (dark on the island side, lit on the frame side). */
  function shapeDeck() { const deck = $('#t-bot'), body = deck?.parentElement; if (!deck || !body.clientWidth || deck.classList.contains('tmini')) return; const F = 18, R = 20, B = 84, H = B + 7;
    const room = $('#t-main'), rw = room?.offsetWidth || body.clientWidth, rl = room?.offsetLeft || 0; const Wd = Math.round(Math.min(880, rw - ($('#w-tide').classList.contains('phone') ? 44 : 96))); deck.style.width = Wd + 'px'; deck.style.left = Math.round(rl + (rw - Wd) / 2) + 'px';
    let svg = deck.querySelector(':scope > .dkshape'); if (!svg) { deck.insertAdjacentHTML('afterbegin', '<svg class="dkshape" aria-hidden="true"><defs><radialGradient id="dkglow" cx="14%" cy="0%" r="75%" gradientTransform="scale(1 2.4)"><stop offset="0" style="stop-color:var(--dglow)"/><stop offset="1" style="stop-color:var(--dglow);stop-opacity:0"/></radialGradient></defs><path class="s"/><path class="f"/><path class="g"/><path class="h"/><path class="e"/></svg>'); svg = deck.querySelector(':scope > .dkshape'); }
    const path = d => `M0 ${B - d} A${F - d} ${F - d} 0 0 0 ${F - d} ${B - F} L${F - d} ${R} A${R + d} ${R + d} 0 0 1 ${F + R} ${-d} L${F + Wd - R} ${-d} A${R + d} ${R + d} 0 0 1 ${F + Wd + d} ${R} L${F + Wd + d} ${B - F} A${F - d} ${F - d} 0 0 0 ${2 * F + Wd} ${B - d}`;
    const W2 = 2 * F + Wd; svg.setAttribute('width', W2); svg.setAttribute('height', H + 1); svg.setAttribute('viewBox', `0 -1 ${W2} ${H + 1}`);
    const fill = `${path(0)} L${W2} ${H} L0 ${H} Z`; svg.querySelector('.f').setAttribute('d', fill); svg.querySelector('.g').setAttribute('d', fill);
    svg.querySelector('.e').setAttribute('d', path(.5)); svg.querySelector('.h').setAttribute('d', path(-.5)); svg.querySelector('.s').setAttribute('d', path(.5)); }
  new ResizeObserver(() => { shapeDeck(); const nw = tNarrow(); if (nw !== T.wasNarrow) { T.wasNarrow = nw; tidePhBar(); tideBot(); tideNow(); } }).observe($('#w-tide .ibody'));
  $('#w-tide').addEventListener('contextmenu', e => { const r = e.target.closest('[data-tsrcrow]'); if (!r) return; e.preventDefault(); tSrcMenu(r, r.dataset.tsrcrow); });
  $('#w-tide').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-tsrcf]')) $('#t-pane [data-tsrcconnect]')?.click(); });
  const tideAll = () => { tideTop(); tideSide(); tideMain(); tideQueue(); tideNow(); tideBot(); };
  const tideRefresh = () => { T._keep = true; tideMain(); tideQueue(); tideNow(); tideBot(); };
  function tPlay(al, i) { T.cur = { al, i }; T.pos = 0; T.playing = true; tideRefresh(); }
  function tStep(d) { const a = curAl(); let i = T.cur.i + d; if (T.shuf && d > 0) i = Math.floor(Math.random() * a.tr.length); if (d < 0 && T.pos > 3) { T.pos = 0; tideRefresh(); return; }
    if (i >= a.tr.length) { if (!T.rep) { T.playing = false; T.pos = 0; tideRefresh(); return; } i = 0; } tPlay(a.id, Math.max(0, i)); }
  function tGo(view, album) { T.hist.push([T.view, T.album]); T.view = view; if (album) T.album = album; T.now = false; tideSide(); tideMain(); tideNow(); }
  setInterval(() => { if (!T.playing) return; T.pos++; const dur = secs(curTr().d); if (T.pos >= dur) { tStep(1); return; }
    const r = $('#t-rng'); if (r && document.activeElement !== r) { r.value = T.pos; r.style.setProperty('--p', T.pos / dur * 100 + '%'); }
    const p = $('#t-pos'), m = $('#t-rem'); if (p) p.textContent = mmss(T.pos); if (m) m.textContent = '−' + mmss(dur - T.pos); $('#t-mprog')?.style.setProperty('--p', T.pos / dur * 100 + '%'); }, 1000);

  /* ══ Messages ══════════════════════════════════════════════════════════════
     Conversations on the frame, the conversation as the island, the composer grown from the frame.
     Everyone is an @username; everything is end-to-end encrypted; texts from a Luma phone share the inbox.
     Click a message and the composer becomes that message's actions; Done or Esc brings it back. */
  const SMILE = SVG['smile'];
  const BELLOFF = SVG['bell-off'];
  const PEN = SVG['pen-line'];
  const PPL = {
    me: { n: 'You', ini: 'N', u: 'nick', h: 250 },
    PR: { n: 'Priya Raman', u: 'priya', h: 330, on: true, face: ['life-ari-street', .705, .2, 5.2] },
    NF: { n: 'Nora Feld', u: 'nora', h: 45, on: true, face: ['life-sync-terrace', .36, .27, 5] },
    SK: { n: 'Sam Kaur', u: 'samk', h: 200, face: ['life-suite-bg-write', .47, .3, 5] },
    TH: { n: 'Theo Marsh', u: 'theo', h: 350, face: ['take-back', .575, .12, 5.4] },
    MO: { n: 'Dad', u: null, phone: '+1 (510) 555-0142', h: 20, face: ['life-hero-home', .8, .33, 6] },
    AR: { n: 'Alex Ruiz', u: 'alexr', h: 262, face: ['life-professionals-loft', .55, .36, 5.2] },
    JK: { n: 'Jordan Kim', u: 'jordan.k', h: 100 },
    CL: { n: 'Lena Okafor', u: 'lena', h: 160, face: ['life-suite-bg-canvas', .575, .3, 5.4] } };
  let MID = 1; const m = (from, t, extra = {}) => ({ id: MID++, from, t, at: '10:02 AM', ...extra });
  const CONVOS = [
    { id: 'crew', name: 'Launch crew', h: 285, group: ['PR', 'NF', 'SK'], pinned: true, unread: 3, typing: null, msgs: [
      m('SK', 'Morning! RC2 finished building overnight', { day: 'Yesterday', at: '9:14 PM' }),
      m('SK', 'Installer passed on all twelve test laptops 🎉', { at: '9:15 PM', reacts: { '🎉': ['PR', 'NF', 'me'] } }),
      m('me', 'Amazing. Let’s freeze strings tomorrow morning.', { at: '9:40 PM', status: 'read' }),
      m('PR', 'Shot the press photos this morning, first pick:', { day: 'Today', at: '9:31 AM' }),
      m('PR', null, { kind: 'photo', src: PH + 'life-hero-studio.webp', at: '9:31 AM', reacts: { '❤️': ['NF', 'me'] } }),
      m('NF', 'That’s the one. Can we get a crop for the homepage hero?', { at: '9:33 AM' }),
      m('PR', null, { kind: 'file', name: 'launch-deck.stage', size: '18.4 MB', app: 'presentations', at: '9:48 AM' }),
      m('PR', 'Updated deck with the new milestones', { at: '9:48 AM' }),
      m('NF', null, { kind: 'voice', dur: 23, at: '9:52 AM' }),
      m('me', 'Love it. I’ll go through the deck before lunch', { at: '9:58 AM', status: 'read', reply: 7 }),
      m('SK', 'simplyluma.com is live on the new server btw', { at: '10:02 AM', link: { host: 'simplyluma.com', title: 'Luma — A better computer.', img: PH + 'life-hero-writing.webp' } }) ] },
    { id: 'priya', dm: 'PR', pinned: true, unread: 0, msgs: [ m('PR', 'Are we still on for the walkthrough at 2?', { day: 'Today', at: '8:40 AM' }), m('PR', null, { kind: 'event', card: { t: 'Launch walkthrough', mon: 'Sep', day: '25', when: '2:00 PM', where: 'Studio', h: 285 }, at: '8:40 AM' }), m('me', 'Yes, bring the Fairphone build', { at: '8:42 AM', status: 'read' }), m('PR', 'Will do 👍', { at: '8:43 AM' }) ] },
    { id: 'mom', dm: 'MO', sms: true, unread: 1, msgs: [ m('MO', 'Saw the article about Luma. Proud of you kid. Call me this weekend', { day: 'Today', at: '11:05 AM' }) ] },
    { id: 'theo', dm: 'TH', unread: 0, msgs: [ m('TH', null, { kind: 'song', card: { t: 'God Only Knows', a: 'The Beach Boys', al: 'Pet Sounds', img: PH + 'pet-sounds.webp' }, day: 'Yesterday', at: '6:18 PM' }), m('TH', null, { kind: 'voice', dur: 41, at: '6:20 PM' }), m('me', 'Haha yes. Saturday works', { at: '6:31 PM', status: 'read' }) ] },
    { id: 'climb', name: 'Climbing Saturday', h: 150, group: ['TH', 'CL', 'AR'], muted: true, unread: 0, msgs: [ m('CL', null, { kind: 'place', card: { n: 'Mission Cliffs', addr: '2295 Harrison St', eta: '14 min' }, day: 'Yesterday', at: '4:01 PM' }), m('CL', 'Gym at 10, coffee after?', { at: '4:02 PM' }) ] },
    { id: 'alex', dm: 'AR', unread: 0, msgs: [ m('AR', 'Sent you the invoice, no rush', { day: 'Monday', at: '3:12 PM' }) ] },
    { id: 'nora', dm: 'NF', unread: 0, msgs: [ m('me', 'Thanks for the notes on the letter', { day: 'Sep 19', at: '5:40 PM', status: 'read' }), m('NF', 'Anytime. It reads really well now', { at: '5:44 PM' }) ] } ];
  const REQUESTS = [{ who: 'JK', t: 'Hi! Saw your post on the Hub about Fairphone support…' }];
  const MS = { cur: 'crew', q: '', acct: 'all', accts: null, gm: false, filter: 'all', sel: null, reply: null, details: false, playing: null, voiceAt: {}, nav: false, comp: false, rich: {} };
  const cv = () => CONVOS.find(c => c.id === MS.cur);
  CONVOS[0].unread = 0;   // the open conversation is read
  const ppl = k => PPL[k];
  const who = c => c.dm ? ppl(c.dm) : { n: c.name };
  const faceImg = (p, sz) => { const [f, fx, fy, z] = p.face, w = sz * z, h = w * 9 / 16; return `<img src="${PH}${f}.webp" alt="" style="width:${w}px;height:${h}px;left:${sz / 2 - fx * w}px;top:${sz / 2 - fy * h}px">`; };
  const av0 = (k, sz = 40) => { const p = ppl(k); return p.img ? `<i class="av round" style="width:${sz}px;height:${sz}px;background-image:url('${p.img}')"></i>` : `<i class="av round" style="width:${sz}px;height:${sz}px;background:oklch(0.62 0.12 ${p.h});font-size:${Math.round(sz * .36)}px">${p.ini || (w => (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase())(p.n.split(' '))}</i>`; };
  const av = (k, sz = 40) => { const p = ppl(k); return p.face ? `<i class="av face round" style="width:${sz}px;height:${sz}px">${faceImg(p, sz)}</i>` : av0(k, sz); };
  const cvAv = (c, sz = 40) => c.dm ? av(c.dm, sz) : `<span class="gav" style="width:${sz}px;height:${sz}px">${av(c.group[0], sz * .7)}${av(c.group[1], sz * .7)}</span>`;
  const hueOf = (c, cb) => cb(c.h ?? ppl(c.dm).h);   // a colour per person (photos are mostly warm, so sampling made every room orange)
  const lastOf = c => c.msgs[c.msgs.length - 1];
  const mBody = x => x.kind === 'photo' ? 'Photo' : x.kind === 'file' ? x.name : x.kind === 'voice' ? 'Voice message' : x.kind === 'place' ? x.card.n : x.kind === 'event' ? x.card.t : x.kind === 'song' ? `${x.card.t} · ${x.card.a}` : x.kind === 'contact' ? ppl(x.card).n : x.t;
  const preview = (c, x) => { const body = mBody(x); return (x.from === 'me' ? 'You: ' : c.group ? ppl(x.from).n.split(' ')[0] + ': ' : '') + body; };
  const mmss2 = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  /* Messages on a phone: the list's foot is an action bar (Search, New message growing in place), and a conversation's
     bar is two rows: what you're writing on top, a hairline, then who it's with and what you can do with them. Every
     choice (attach, emoji, details, more) grows that same bar; nothing opens a drawer or popover. */
  const mNarrow = () => { const w = $('#w-messages'); return !!w?.clientWidth && w.clientWidth < 560; };
  const mSug = () => ['TH', 'AR', 'CL', 'NF', 'SK'].filter(k => !MS.nq || (ppl(k).n + ' ' + (ppl(k).u || '')).toLowerCase().includes(MS.nq.toLowerCase())).slice(0, 4);
  function mListBar() { const newp = MS.px === 'new';
    const panel = newp ? `<div class="fexp mnewp"><div class="fexh">New message</div>
      ${mSug().map(k => { const c = CONVOS.find(x => x.dm === k); return `<button class="fexr2" type="button" ${c ? `data-mcvgo="${c.id}"` : `data-mtodo="Starting a conversation with ${esc(ppl(k).n)}"`}>${av(k, 36)}<span>${esc(ppl(k).n)}<small>${ppl(k).u ? '@' + ppl(k).u : ppl(k).phone || ''}</small></span></button>`; }).join('')}
      <button class="fexr2" type="button" data-mmycode>${ic('scan')}<span>Let someone add you<small>Show your code or send your link</small></span></button></div>` : '';
    return `<div class="fbar mlbar phnofit${newp ? ' phgrow' : ''}">${panel}${newp ? `<label class="srch keep">${ic('user')}<input id="m-nq" placeholder="To: name, username or phone" value="${esc(MS.nq || '')}" aria-label="To"></label>` : `<label class="srch keep">${ic('search')}<input id="m-q" placeholder="Search" value="${esc(MS.q)}" aria-label="Search"><button class="fqx" type="button" data-msearchx aria-label="Clear search">${ic('x')}</button></label>`}<button class="${newp ? 'ib' : 'bt pri'}" type="button" data-mpx="new" aria-label="${newp ? 'Close' : 'New message'}" title="New message" aria-expanded="${newp}">${ic(newp ? 'x' : 'square-pen')}</button></div>`; }
  function msgTop() { $('#m-top').innerHTML = `<img src="${A}messages.svg" alt=""><b>Messages</b><span class="chev">${ic('chevron-down')}</span>`; }
  function msgSide() { const q = MS.q.toLowerCase();
    const list = CONVOS.filter(c => MS.acct === 'all' || (MS.acct === 'gm' ? c.gm : MS.acct === 'sms' ? c.sms : !c.gm && !c.sms)).filter(c => !q || (who(c).n + ' ' + (c.dm ? ppl(c.dm).u || '' : '') + ' ' + c.msgs.map(x => x.t || '').join(' ')).toLowerCase().includes(q)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    const row = c => { const x = lastOf(c), p = c.dm ? ppl(c.dm) : null;
      return `<button class="crow${c.id === MS.cur ? ' on' : ''}${c.unread ? ' un' : ''}${c.muted ? ' muted' : ''}" type="button" data-mcv="${c.id}"><span class="fwrap">${cvAv(c, 46)}${p?.on ? '<i class="onl round"></i>' : ''}</span>
        <span class="ctx"><span class="l1"><b>${esc(who(c).n)}</b><span class="tm">${c.sms ? 'SMS · ' : c.gm ? '<span class="rcs">RCS</span> · ' : ''}${x.day === 'Today' || !x.day ? x.at : x.day}</span></span>
        <span class="l2">${c.typing ? '<span class="dots sm"><i></i><i></i><i></i></span>' : `<span class="pv">${esc(preview(c, x))}</span>`}${c.unread ? lCount(c.unread, true) : c.pinned ? `<span class="pinm">${ic('pin')}</span>` : ''}</span></span></button>`; };
    $('#m-side').innerHTML = `
      <div class="scr">${list.map(row).join('')}${!list.length ? `<div class="fhint">No one matches “${esc(MS.q)}”.</div>` : ''}</div>${mNarrow() || phTab() ? mListBar() : `<div class="shead sfoot"><label class="srch">${ic('search')}<input id="m-q" placeholder="Search people and messages" value="${esc(MS.q)}" aria-label="Search"><button class="fqx" type="button" data-msearchx aria-label="Clear search">${ic('x')}</button></label><button class="snew" type="button" data-mnew aria-label="New message" title="New message · Ctrl N">${ic('square-pen')}</button></div>`}`;
    const nq = $('#m-nq'); if (nq) { nq.oninput = () => { MS.nq = nq.value; msgSide(); const n = $('#m-nq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; if (!MS.nq) nq.focus(); }
    const i = $('#m-q'); if (i) { i.oninput = () => { MS.q = i.value; msgSide(); const n = $('#m-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; i.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); MS.searching = false; MS.q = ''; msgSide(); } }; } }
  function msgHead() { const c = cv(), p = c.dm ? ppl(c.dm) : null;
    const sub = c.typing ? `${ppl(c.typing).n.split(' ')[0]} is typing…` : p ? (c.sms ? `Text message` : c.gm ? 'RCS · Google Messages' : p.on ? '<i class="ond round"></i>Active now' : `@${p.u}`) : `${c.group.length + 1} people`;
    if (mNarrow() || phWide()) {   /* phone, tablet and fold: the title island. ‹ | who, then Call and Video; tap who and it grows into the conversation's info and options */
      /* grown: the conversation's options as tiles, who's in it (groups), the facts inset, then its photos and files. Nothing repeats the header. */
      const tile = (attr, icn, label, on) => `<button type="button" class="fvt${on ? ' on' : ''}" ${attr}>${ic(icn)}<span>${label}</span></button>`;
      const body = MS.isl ? `<div class="mislp"><div class="fsha mislt${c.dm ? '' : ' c3'}">${tile('data-mpin', 'pin', c.pinned ? 'Pinned' : 'Pin', c.pinned)}${tile('data-mmute', c.muted ? 'bell-off' : 'bell', c.muted ? 'Muted' : 'Mute', c.muted)}${tile('data-mtodo="Search in this conversation"', 'search', 'Search')}${c.dm ? tile(`data-mtodo="Opening ${esc(who(c).n)} in Contacts"`, 'user', 'Contact') : ''}</div>
        ${c.group ? `<div class="fexh">People<em>${c.group.length + 1}</em></div><div class="mislpp">${[...c.group, 'me'].map(k => `<button class="mislpr" type="button" ${k === 'me' ? 'disabled' : `data-mtodo="Opening ${esc(ppl(k).n)} in Contacts"`}>${av(k, 34)}<span><b>${k === 'me' ? 'You' : esc(ppl(k).n)}</b><small>${ppl(k).u ? '@' + ppl(k).u : ''}</small></span></button>`).join('')}</div>` : ''}
        <dl class="mislkv"><div><dt>Encryption</dt><dd>${c.sms ? 'Text message, not encrypted' : 'End-to-end'}</dd></div>${c.sms ? '' : '<div><dt>Safety code</dt><dd class="num">48213 90552 17608</dd></div>'}</dl>
        <div class="fexh">Photos and files</div><div class="mislph">${PHOTOS.slice(0, 4).map(x => `<img src="${x.src}" alt="">`).join('')}</div></div>` : '';
      $('#m-head').innerHTML = `<div class="misl${MS.isl ? ' open' : ''}"><div class="mislr"><button class="mislb" type="button" data-mnav aria-label="Conversations">${ic('chevron-left')}</button><button class="misli" type="button" data-misl aria-expanded="${!!MS.isl}" aria-label="${esc(who(c).n)}. Details">${cvAv(c, 30)}<span><b>${esc(who(c).n)}</b><small>${sub}</small></span></button><button class="ib" type="button" data-mcall="voice" aria-label="Call" title="Call">${ic('phone')}</button><button class="ib" type="button" data-mcall="video" aria-label="Video call" title="Video call">${ic('video')}</button></div>${body}</div>`;
      hueOf(c, h => { $('#w-messages').style.setProperty('--ch', h); }); return; }
    $('#m-head').innerHTML = `<button class="flo mback" type="button" data-mnav aria-label="Conversations">${ic('chevron-left')}</button>
      <button class="flo mwho" type="button" data-mdetails title="Details">${cvAv(c, 36)}<span><b>${esc(who(c).n)}</b><span>${sub}</span></span></button><span class="sp"></span>
      <span class="flo macts"><button class="ib" type="button" data-mcall="voice" aria-label="Call">${ic('phone')}</button><button class="ib" type="button" data-mcall="video" aria-label="Video call">${ic('video')}</button><button class="ib${c.pinned ? ' lit' : ''}" type="button" data-mpin aria-label="${c.pinned ? 'Unpin' : 'Pin'}" title="${c.pinned ? 'Unpin' : 'Pin'}">${ic('pin')}</button><button class="ib${MS.details ? ' on' : ''}" type="button" data-mdetails aria-label="Details" title="Details">${SVG.info}</button></span>`;
    hueOf(c, h => { $('#w-messages').style.setProperty('--ch', h); }); }
  const MFILE = { presentations: ['Stage presentation', 'Stage'], editor: ['Markdown', 'Write'], documents: ['Write document', 'Write'], spreadsheets: ['Grid spreadsheet', 'Grid'] };
  function bubble(c, x, i, arr) { const prev = arr[i - 1], next = arr[i + 1], same = (a, b) => a && b && a.from === b.from && !b.day;
    const first = !same(prev, x), last = !same(x, next), mine = x.from === 'me', p = ppl(x.from);
    let inner = '';
    if (x.reply) { const r = c.msgs.find(y => y.id === x.reply); if (r) inner += `<button class="rq" type="button" data-mjump="${r.id}"><b>${r.from === 'me' ? 'You' : ppl(r.from).n.split(' ')[0]}</b><span>${esc(preview({}, r).replace(/^You: /, ''))}</span></button>`; }
    if (x.kind === 'photo') inner += `<img class="mph" src="${x.src}" alt="">`;
    else if (x.kind === 'file') { const fk = { presentations: 'deck', editor: 'md', documents: 'doc', spreadsheets: 'sheet', notes: 'note' }[x.app] || 'deck'; inner += lFile({ n: x.name, k: fk, sz: x.size }, { open: `data-mtodo="Opening in ${lFileApp(fk)}"` }); }
    else if (x.kind === 'voice') { const at = MS.voiceAt[x.id] || 0, on = MS.playing === x.id, bars = Array.from({ length: 34 }, (_, k) => 5 + Math.round(Math.abs(Math.sin(k * 1.7 + x.id) * 13) + (k % 3) * 2));
      inner += `<span class="mvoice"><button class="mkey round" type="button" data-mplay="${x.id}" aria-label="${on ? 'Pause' : 'Play'}">${ic(on ? 'pause' : 'play')}</button><span class="wave">${bars.map((h, k) => `<i style="height:${h}px" class="${k / bars.length < at / x.dur ? 'p' : ''}"></i>`).join('')}</span><span class="vd num">${mmss2(on || at ? x.dur - at : x.dur)}</span></span>`; }
    else if (x.card) inner += { place: lPlaceCard, event: lEventCard, song: lSongCard, contact: lContactCard }[x.kind](x.card);
    if (x.t) inner += x.html ? `<span class="mt rich">${x.html}</span>` : `<span class="mt">${esc(x.t)}</span>`;
    if (x.link) inner += `<span class="mlink"><img src="${x.link.img}" alt=""><span><b>${esc(x.link.title)}</b><span>${x.link.host}</span></span></span>`;
    const rx = x.reacts && Object.keys(x.reacts).length ? `<span class="rx">${Object.entries(x.reacts).map(([e, ks]) => `<button type="button" class="${ks.includes('me') ? 'me' : ''}" data-mreact="${x.id}:${e}">${e}${ks.length > 1 ? `<b>${ks.length}</b>` : ''}</button>`).join('')}</span>` : '';
    const cls = ['msg', mine ? 'mine' : 'theirs', first ? 'first' : '', last ? 'last' : '', x.kind ? 'k-' + x.kind : '', MS.sel === x.id ? 'sel' : '', x.fresh ? 'fresh' : ''].join(' ');
    return `${x.day ? `<div class="mday">${x.day}</div>` : ''}<div class="${cls}" data-mid="${x.id}">
      ${!mine && c.group ? (last ? av(x.from, 28) : '<i class="avsp"></i>') : ''}<div class="mcol">${!mine && c.group && first ? `<span class="mname" style="color:oklch(0.78 0.1 ${p.h})">${p.n.split(' ')[0]}</span>` : ''}
      <div class="bub">${inner}</div>${rx}${mine && last && x.status ? `<span class="rcpt">${x.status === 'sending' ? 'Sending…' : x.status === 'sent' ? ic('check') + 'Sent' : x.status === 'delivered' ? ic('check-check') + 'Delivered' : `<span class="rd">${ic('check-check')}</span>Read ${x.at}`}</span>` : ''}</div>
      <span class="mtime">${x.at}</span></div>`; }
  function msgBody(keep) { const c = cv(), b = $('#m-body'), atEnd = b.scrollHeight - b.scrollTop - b.clientHeight < 60;
    const p = c.dm ? ppl(c.dm) : null, bg = ppl(c.dm || c.group[0]).face;
    $('#m-light').style.backgroundImage = bg ? `url('${PH}${bg[0]}.webp')` : 'none'; $('#m-light').style.backgroundPosition = bg ? `${bg[1] * 100}% ${bg[2] * 100}%` : '';
    b.innerHTML = `<div class="mthread"><div class="mintro">${c.group ? `<span class="gbig">${[...c.group, 'me'].map(k => av(k, 56)).join('')}</span>` : av(c.dm, 88)}<b>${esc(who(c).n)}</b><span class="u">${p ? (p.u ? '@' + p.u : p.phone) : c.group.map(k => ppl(k).n.split(' ')[0]).join(', ') + ' and you'}</span>
      <span class="lockl">${c.sms ? `${ic('message-square')}Text messages aren’t encrypted. <button type="button" data-mtodo="Invite sent: they can keep their number">Invite ${esc(who(c).n)} to Luma</button>` : `${ic('lock')}End-to-end encrypted. Only the people here can read this.`}</span></div>
      ${c.msgs.map((x, i, a) => bubble(c, x, i, a)).join('')}${c.typing ? `<div class="msg theirs first last typing">${c.group ? av(c.typing, 28) : ''}<div class="mcol"><div class="bub"><span class="dots"><i></i><i></i><i></i></span></div></div></div>` : ''}</div>`;
    if (!keep || atEnd) b.scrollTop = b.scrollHeight; c.msgs.forEach(x => delete x.fresh); mShape(); }
  /* A run of messages from one person reads as one flowing block. Corners are round only where a bubble is free; they
     tighten only where two bubbles touch: always along the sender's side, and on the far side where a bubble rests on a
     wider one below it (or sits under a wider one above). Cards (events, places, files) and photos join in the same way. */
  function mShape() { const b = $('#m-body'); if (!b || !b.clientWidth) return; const R = 18, J = 5, vis = m => { const u = m.querySelector('.bub'); return u?.querySelector(':scope > .lmini, :scope > .lfc') || u; };
    const rows = [...b.querySelectorAll('.msg:not(.typing)')]; let g = [];
    const flush = () => { const W = g.map(m => vis(m).getBoundingClientRect().width); g.forEach((m, k) => { const mine = m.classList.contains('mine'), v = vis(m), up = k > 0, dn = k < g.length - 1;
        const sTop = up ? J : R, sBot = dn ? J : R, fTop = up && W[k - 1] >= W[k] - 3 ? J : R, fBot = dn && W[k + 1] >= W[k] - 3 ? J : R;
        const [tl, tr, br, bl] = mine ? [fTop, sTop, sBot, fBot] : [sTop, fTop, fBot, sBot];
        v.classList.add('mshaped'); v.style.setProperty('--rtl', tl + 'px'); v.style.setProperty('--rtr', tr + 'px'); v.style.setProperty('--rbr', br + 'px'); v.style.setProperty('--rbl', bl + 'px'); }); g = []; };
    rows.forEach(m => { if (m.classList.contains('first')) flush(); g.push(m); if (m.classList.contains('last')) flush(); }); flush(); }
  new ResizeObserver(() => mShape()).observe($('#m-body'));
  /* The composer: text by default; a message's actions when one is selected. It grows into the editor (LumaUI action center,
     Charlie's reply editor): the context line when replying, the full editor with formatting on demand. */
  function msgBar() { const bar = $('#m-bar'), c = cv(); bar.classList.toggle('acting', MS.sel != null); bar.classList.remove('tight');
    if (MS.sel != null && mNarrow()) { MS.comp = false; mComp(); bar.hidden = false; const x = c.msgs.find(y => y.id === MS.sel), mine = x.from === 'me';
      /* a held message on a phone: reactions as one big row (tap to react), then what you do with it as labelled tiles */
      bar.classList.add('acting', 'mselph'); bar.querySelector('.mcin').innerHTML = `<div class="mreact2">${EMO.slice(0, 6).map(e => `<button type="button" data-mreact="${x.id}:${e}" class="${x.reacts?.[e]?.includes('me') ? 'on' : ''}">${e}</button>`).join('')}</div>
        <div class="fsha mact2">${[['data-mreplyto', 'reply', 'Reply'], ...(x.t ? [['data-mcopy', 'copy', 'Copy']] : []), ['data-mfwd', 'forward', 'Forward'], ['data-mpinmsg', 'pin', 'Pin'], ['data-mdelmsg', 'trash-2', mine ? 'Unsend' : 'Delete']].map(([a2, i, n]) => `<button type="button" class="fvt${i === 'trash-2' ? ' red' : ''}" ${a2}>${ic(i)}<span>${n}</span></button>`).join('')}</div>`; shapeGrow(); return; }
    bar.classList.remove('mselph');
    if (MS.sel != null) { MS.comp = false; mComp(); bar.hidden = false; const x = c.msgs.find(y => y.id === MS.sel), mine = x.from === 'me', by = mine ? 'You' : ppl(x.from).n.split(' ')[0], txt = mBody(x);
      const face = x.kind === 'photo' ? `<img class="msubth" src="${x.src}" alt="">` : x.kind === 'voice' ? ic('mic') : x.kind === 'file' ? ic('file-text') : x.kind === 'event' ? ic('calendar') : x.kind === 'place' ? ic('map-pin') : x.kind === 'song' ? ic('music') : '';
      bar.querySelector('.mcin').innerHTML = `<span class="msubj" role="status" aria-label="Selected: ${esc(by)}, ${esc(txt)}">${c.group ? av(x.from, 22) : ''}${face}<span>${esc(txt)}</span><button class="ib" type="button" data-mdone aria-label="Done" title="Done">${ic('x')}</button></span>
        <button class="bt fill" type="button" data-mreplyto title="Reply">${ic('reply')}<span>Reply</span></button><button class="bt fill" type="button" data-mreactpop title="React">${SMILE}<span>React</span></button>${x.t ? `<button class="bt fill" type="button" data-mcopy title="Copy">${ic('copy')}<span>Copy</span></button>` : ''}
        <button class="ib" type="button" data-mmore aria-label="More" title="More">${ic('ellipsis')}</button>`;
      shapeGrow(); return; }
    const r = MS.reply ? c.msgs.find(y => y.id === MS.reply) : null;
    if (MS.comp) { bar.hidden = true; mComp(); return; } bar.hidden = false; mComp();
    bar.querySelector('.mcin').innerHTML = `${r ? `<div class="lacctx">${ic('reply')}<span>Replying to <b>${r.from === 'me' ? 'yourself' : esc(ppl(r.from).n.split(' ')[0])}</b>: ${esc(mBody(r))}</span><button class="ib" type="button" data-mreplyx aria-label="Cancel reply" title="Cancel reply">${ic('x')}</button></div>` : ''}
      <div class="mrow"><button class="ib" type="button" data-mattach aria-label="Attach" title="Photo, file or location">${ic('plus')}</button>
        <div class="mfield"><textarea id="m-in" rows="1" placeholder="${c.sms ? 'Text message' : 'Message ' + esc(c.dm ? ppl(c.dm).n.split(' ')[0] : c.name)}" aria-label="Message"></textarea><button class="ib emo" type="button" data-memoji aria-label="Emoji" title="Emoji">${SMILE}</button><button class="ib emo" type="button" data-mgrow aria-label="Formatting and more room" title="Formatting and more room">${ic('maximize-2')}</button></div>
        <button class="send round" id="m-send" type="button" data-msend aria-label="Send">${ic('mic')}</button></div>`;
    if (mNarrow()) bar.querySelector('.mcin').insertAdjacentHTML('afterbegin', mPanel(c));   /* who, Call and Video live in the title island now */ bar.classList.toggle('mgrown', mNarrow() && !!MS.px && MS.px !== 'new');
    const t = $('#m-in'); t.value = MS.draft?.[c.id] || ''; grow(t); t.oninput = () => { (MS.draft = MS.draft || {})[c.id] = t.value; delete MS.rich[c.id]; grow(t); };
    t.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    shapeGrow(); }
  function mWhoRow(c) { const p = c.dm ? ppl(c.dm) : null, X = MS.px;
    const sub = c.typing ? `${ppl(c.typing).n.split(' ')[0]} is typing…` : p ? (c.sms ? 'Text message' : p.on ? '<i class="ond round"></i>Active now' : `@${p.u}`) : `${c.group.length + 1} people`;
    return `<div class="mwhorow"><button class="mwho2${X === 'info' ? ' on' : ''}" type="button" data-mpx="info" aria-expanded="${X === 'info'}" title="Details">${cvAv(c, 32)}<span><b>${esc(who(c).n)}</b><small>${sub}</small></span></button><span class="sp"></span>
      <button class="ib" type="button" data-mcall="voice" aria-label="Call" title="Call">${ic('phone')}</button><button class="ib" type="button" data-mcall="video" aria-label="Video call" title="Video call">${ic('video')}</button><button class="ib${X === 'more' ? ' on' : ''}" type="button" data-mpx="more" aria-label="More" title="More" aria-expanded="${X === 'more'}">${ic('ellipsis')}</button></div>`; }
  function mPanel(c) { const X = MS.px, p = c.dm ? ppl(c.dm) : null;
    if (X === 'attach') return `<div class="fexp"><div class="fsha c3">${[['image', 'Photo', 'photo'], ['file-text', 'File', 'file'], ['map-pin', 'Location', 'loc']].map(([i, n, k]) => `<button type="button" class="fvt" data-msendk="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`;
    if (X === 'emoji') return `<div class="fexp"><div class="emrow memo2">${['😀', '😂', '🥹', '😍', '🤔', '😎', '🙌', '👍', '🎉', '🔥', '❤️', '🙏'].map(x => `<button type="button" data-mins="${x}">${x}</button>`).join('')}</div></div>`;
    if (X === 'more') return `<div class="fexp fmore2"><button class="fexr2" type="button" data-mpin>${ic('pin')}<span>${c.pinned ? 'Unpin' : 'Pin'}</span></button><button class="fexr2" type="button" data-mmute>${ic(c.muted ? 'bell' : 'bell-off')}<span>${c.muted ? 'Unmute' : 'Mute'}</span></button><button class="fexr2" type="button" data-mtodo="Search in this conversation">${ic('search')}<span>Search in conversation</span></button>${c.dm ? `<button class="fexr2" type="button" data-mtodo="Opening ${esc(who(c).n)} in Contacts">${ic('user')}<span>Open in Contacts</span></button>` : ''}</div>`;
    if (X === 'info') { const ph = PHOTOS.slice(0, 4);
      return `<div class="fexp minfo2"><div class="mi2h">${c.group ? `<span class="gbig">${c.group.slice(0, 3).map(k => av(k, 40)).join('')}</span>` : av(c.dm, 56)}<span><b>${esc(who(c).n)}</b><small>${p ? (p.u ? '@' + p.u : p.phone || '') : c.group.map(k => ppl(k).n.split(' ')[0]).join(', ') + ' and you'}</small></span></div>
        <dl><dt>Notifications</dt><dd>${c.muted ? 'Muted' : 'On'}</dd><dt>Encryption</dt><dd>${c.sms ? 'Text message, not encrypted' : 'End-to-end'}</dd>${c.sms ? '' : '<dt>Safety code</dt><dd class="num">48213 90552 17608</dd>'}</dl>
        <div class="fexh">Photos and files</div><div class="mi2ph">${ph.map(x => `<img src="${x.src}" alt="">`).join('')}</div></div>`; }
    return ''; }
  /* The editor the bar grows into: who it's for on top, the tools above the text, Send at the foot. Esc folds it back and keeps the draft. */
  function mComp() { const el = $('#m-comp'), c = cv(); if (!el) return; if (!MS.comp) { el.hidden = true; el.innerHTML = ''; delete el.dataset.cv; return; }
    const r = MS.reply ? c.msgs.find(y => y.id === MS.reply) : null, was = !el.hidden && el.dataset.cv === c.id, first = c.dm ? ppl(c.dm).n.split(' ')[0] : c.name;
    const tool = (k, n, i) => `<button class="ib" type="button" data-rtfmt="${k}" title="${n}" aria-label="${n}">${ic(i)}</button>`;
    el.dataset.cv = c.id;
    el.innerHTML = `<div class="lach"><strong class="lacmode">${ic(r ? 'reply' : 'message-square')}${r ? 'Reply' : 'Message'}</strong><span>to <b>${esc(c.dm ? ppl(c.dm).n : c.name)}</b></span></div>
      <div class="lactools">${tool('bold', 'Bold', 'bold')}${tool('italic', 'Italic', 'italic')}${tool('strikeThrough', 'Strikethrough', 'strikethrough')}<span class="vr"></span>${tool('insertUnorderedList', 'Bulleted list', 'list')}${tool('link', 'Link', 'link')}<span class="sp"></span><button class="ib" type="button" data-memoji title="Emoji" aria-label="Emoji">${SMILE}</button><button class="ib" type="button" data-mattach title="Photo, file or location" aria-label="Attach">${ic('paperclip')}</button></div>
      ${r ? `<div class="lacctx">${ic('reply')}<span>Replying to <b>${r.from === 'me' ? 'yourself' : esc(ppl(r.from).n.split(' ')[0])}</b>: ${esc(mBody(r))}</span></div>` : ''}
      <div class="laced" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Message" data-ph="${c.sms ? 'Text message' : 'Message ' + esc(first)}">${MS.rich[c.id] ?? esc(MS.draft?.[c.id] || '').replace(/\n/g, '<br>')}</div>
      <div class="lacft"><button class="ib" type="button" data-mcompx title="Discard" aria-label="Discard">${ic('trash-2')}</button><span class="sp"></span><small>Esc to fold · Return to send</small><button class="bt key" type="button" data-mcsend>${ic('send-horizontal')}Send</button></div>`;
    if (!el._lacCollapse) lAC.bind(el, () => { MS.comp = false; msgBar(); setTimeout(() => { const t = $('#m-in'); t?.focus(); t?.setSelectionRange(t.value.length, t.value.length); }, 40); });
    if (!was) lAC.open(el); const ed = el.querySelector('.laced');
    ed.oninput = () => { MS.rich[c.id] = ed.innerHTML; (MS.draft = MS.draft || {})[c.id] = ed.innerText.replace(/\n$/, ''); };
    ed.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mSendRich(); } };
    $('#m-body').style.paddingBottom = (el.offsetHeight + 30) + 'px'; }
  function mCompFocus() { setTimeout(() => { const ed = $('#m-comp .laced'); if (!ed) return; ed.focus(); getSelection().collapse(ed, ed.childNodes.length); }, 40); }
  function mSendRich() { const ed = $('#m-comp .laced'), c = cv(), t = ed?.innerText.trim(); if (!t) { ed?.focus(); return; }
    const html = ed.innerHTML; MS.comp = false; delete MS.rich[c.id]; send({ t, html }); }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; const s = $('#m-send'); if (s) { const has = t.value.trim().length > 0; s.classList.toggle('go', has); s.innerHTML = has ? ic('arrow-up') : ic('mic'); s.setAttribute('aria-label', has ? 'Send' : 'Record a voice message'); } shapeGrow(); }
  /* The composer takes the island's width (capped); the selected message's bar sizes to its content, centred, capped at the island;
     on a phone both span the width. */
  function shapeGrow() { const el = $('#m-bar'), island = $('#m-main'); if (!el || !island.clientWidth) return;
    const room = island.clientWidth, phone = $('#w-messages').classList.contains('phone');
    if (el.classList.contains('acting') && !phone) { el.style.width = ''; el.style.left = '0px'; el.style.maxWidth = (room - 32) + 'px'; el.classList.toggle('tight', el.scrollWidth > room - 32);
      const Wd = Math.min(el.offsetWidth, room - 32); el.style.left = Math.round(island.offsetLeft + (room - Wd) / 2) + 'px'; }
    else { const Wd = Math.round(phone ? room - 32 : Math.min(720, room - (room < 520 ? 20 : 56))); el.style.maxWidth = ''; el.style.width = Wd + 'px'; el.style.left = Math.round(island.offsetLeft + (room - Wd) / 2) + 'px'; }
    const comp = $('#m-comp'); $('#m-body').style.paddingBottom = ((comp && !comp.hidden ? comp.offsetHeight : el.offsetHeight) + 30) + 'px'; }
  function renderMsgs() { msgTop(); msgSide(); msgHead(); msgBody(); msgBar(); msgDetails(); }
  function openCv(id) { MS.px = ''; MS.cur = id; MS.sel = null; MS.reply = null; MS.nav = false; MS.comp = false; $('#w-messages').classList.remove('navopen'); const c = cv(); c.unread = 0; msgSide(); msgHead(); msgBody(); msgBar(); msgDetails(); setTimeout(() => $('#m-in')?.focus(), 30); }
  const REPLIES = { crew: [['PR', 'Perfect, I’ll flag anything that looks off'], ['NF', 'Sounds good 🙌']], priya: [['PR', 'On it']], theo: [['TH', 'See you then!']], nora: [['NF', 'Ha, likewise']], alex: [['AR', 'Thanks!']], climb: [['CL', '👍']], mom: [['MO', 'Talk soon']] };
  function send(extra) { const c = cv(), t = $('#m-in'), v = t?.value.trim(); if (!v && !extra) return;
    const x = m('me', extra ? null : v, { at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), status: 'sending', fresh: true, reply: MS.reply, ...(extra || {}) });
    if (lastOf(c).day === undefined && !c.msgs.some(y => y.day === 'Today')) x.day = 'Today';
    c.msgs.push(x); MS.reply = null; if (MS.draft) MS.draft[c.id] = ''; msgBody(); msgBar(); msgSide(); $('#m-in')?.focus();
    setTimeout(() => { x.status = c.sms ? 'sent' : 'delivered'; if (MS.cur === c.id) msgBody(true); }, 350);
    if (c.sms) return;
    setTimeout(() => { x.status = 'read'; const r = (REPLIES[c.id] || [])[0]; if (r) c.typing = r[0]; if (MS.cur === c.id) { msgBody(true); msgHead(); } msgSide(); }, 1300);
    setTimeout(() => { const list = REPLIES[c.id] || []; const r = list.shift(); c.typing = null; if (r) { c.msgs.push(m(r[0], r[1], { at: x.at, fresh: true })); list.push(r); if (MS.cur !== c.id) c.unread++; } if (MS.cur === c.id) { msgBody(true); msgHead(); } msgSide(); }, 3200); }
  /* Accounts: chats from other networks, signed in on this device, beside your Luma chats and your phone's texts. The title menu
     lists them (as Charlie's lists mail accounts); Add account opens the details pane on the networks, then the network's own page:
     what it does, the honest caveat, and its one way in. Google Messages signs in like Messages for web; the phone stays the sender. */
  const MNETS = [['gm', 'Google Messages', 'Texts and RCS from your Android phone'], ['wa', 'WhatsApp', 'Link Luma as one of your devices'], ['sg', 'Signal', 'Link Luma as one of your devices'], ['tg', 'Telegram', 'Unofficial client · a code or your number']];
  const mNet = (k, lg) => `<span class="mnet ${k}${lg ? ' lg' : ''}">${k === 'gm' ? '<img src="apps/marks/google-messages.svg" alt="">' : k === 'wa' ? '<img src="../social-luma/apps/whatsapp.svg" alt="">' : k === 'luma' ? `<img src="${FAV}" alt="">` : k === 'sms' ? ic('smartphone') : ''}</span>`;
  Object.assign(PPL, { MC: { n: 'Maya Chen', u: null, phone: '+1 (415) 555-0187', h: 300 }, BO: { n: 'Ben Ortiz', u: null, phone: '+1 (510) 555-0119', h: 195 }, GR: { n: 'Grace Lee', u: null, phone: '+1 (628) 555-0164', h: 25 } });
  const GCONVOS = [
    { id: 'g-maya', dm: 'MC', gm: true, unread: 2, msgs: [m('MC', 'Can you send me the photos from Saturday?', { day: 'Today', at: '11:24 AM' }), m('MC', 'The ones from the lake especially 🙏', { at: '11:24 AM' })] },
    { id: 'g-ben', dm: 'BO', gm: true, unread: 1, msgs: [m('BO', 'Running 10 min late, grab us a table', { day: 'Today', at: '11:12 AM' })] },
    { id: 'g-grace', dm: 'GR', gm: true, unread: 0, msgs: [m('me', 'Happy birthday!! 🎂', { day: 'Today', at: '9:03 AM', status: 'read' }), m('GR', 'Thank you!! Dinner Friday?', { at: '9:20 AM' })] } ];
  function mAccounts() { const pg = MS.accts, back = (label, to) => lTrail({ back: { label, attr: `data-maccts="${to}"` } }), net = MNETS[0];
    let title = 'Accounts', body;
    if (pg === 'add') { title = 'Add an account'; body = `${back('Accounts', 'list')}<div class="ldplist">${MNETS.filter(([k]) => k !== 'gm' || !MS.gm).map(([k, n, sub]) => lDP.row({ av: mNet(k), n, sub, attr: k === 'gm' ? 'data-maccts="gm"' : `data-mtodo="${n}: link it from your phone"` })).join('')}</div>`; }
    else if (pg === 'gm') { title = 'Add Google Messages'; body = `${back('Add an account', 'add')}<div class="ldphero">${mNet('gm', 1)}<b>${net[1]}</b></div><p class="mnetd">Texts and RCS chats from Google Messages on your Android phone. Your phone stays the one that sends them.</p>
      <div class="mnetw">${ic('triangle-alert')}<span>Google doesn’t offer this officially. It signs in the way Messages for web does, and Google could change or stop it at any time.</span></div>
      <div class="mnetgo"><button class="bt pri" type="button" data-mgsign>${ic('log-in')}Sign in with Google</button></div><p class="lfhint">Your sign-in stays in this device’s keyring and your chats are stored only on this device.</p>`; }
    else if (pg === 'gmwait') { title = 'Add Google Messages'; body = `<div class="ldphero">${mNet('gm', 1)}<b>Signing in…</b></div><div class="mnetwait"><span class="tspin"></span><span>Sign in with your Google account in the browser window that just opened. It closes by itself once you’re signed in.</span></div>`; }
    else if (pg === 'gmok') { title = 'Google Messages'; body = `<div class="ldphero">${mNet('gm', 1)}<b>Google Messages</b><span class="mnetok">${ic('circle-check')}Connected</span></div>${lDP.kv([['Phone', 'Pixel 8'], ['Chats', String(GCONVOS.length)], ['Stored', 'On this device']])}<div class="mnetgo"><button class="bt pri" type="button" data-maccts="">Done</button></div>`; }
    else body = `${lDP.lab('On this device')}<div class="ldplist">${lDP.row({ av: mNet('luma'), n: 'Luma', sub: '@nick · end-to-end encrypted' })}${lDP.row({ av: mNet('sms'), n: 'Text messages', sub: 'From your Luma phone' })}</div>
      ${lDP.lab('Accounts')}<div class="ldplist">${MS.gm ? lDP.row({ av: mNet('gm'), n: 'Google Messages', sub: 'Connected · Pixel 8', attr: 'data-maccts="gmok"' }) : ''}${lAddRow('Add account', 'data-maccts="add"', 'plus')}</div><p class="lfhint">Chats from other networks, signed in on this device. Nothing passes through a Luma server.</p>`;
    return lDP({ title, close: 'data-maccts=""', body }); }
  function mGSign() { MS.accts = 'gmwait'; msgDetails();
    setTimeout(() => { if (MS.accts !== 'gmwait') return; MS.gm = true; CONVOS.unshift(...GCONVOS.filter(g => !CONVOS.includes(g))); MS.accts = 'gmok'; msgSide(); msgDetails(); }, 2400); }
  /* Details: the LumaUI details pane. Closed by default; Info or the name opens it; Esc or × closes it. The person's own actions
     are Contacts' (lContactActs); facts get hairlines; people get full-row hover and quiet actions; Leave and Delete are stacked buttons. */
  function msgDetails() { const d = $('#m-det'), c = cv(); if (MS.accts !== null) { if (lDPShow(d, { open: true, subject: true })) { d.setAttribute('aria-label', 'Accounts'); d.innerHTML = mAccounts(); } return; } d.setAttribute('aria-label', 'Details'); if (!lDPShow(d, { open: MS.details, subject: c })) return; const members = c.dm ? [c.dm] : c.group, p = c.dm ? ppl(c.dm) : null;
    const photos = c.msgs.filter(x => x.kind === 'photo').map(x => x.src).concat([PH + 'life-sync-terrace.webp', PH + 'life-work-suite.webp', PH + 'life-suite-bg-stage.webp']).slice(0, 6);
    const person = k => { const me = k === 'me', q = ppl(k) || {}, known = me || people().includes(k), muted = (c.mutedP || []).includes(k), f = me ? '' : q.n.split(' ')[0];
      return lDP.row({ av: av(k, 32), n: me ? 'You' : q.n, sub: muted ? 'Muted here' : me ? '@nick' : q.u ? '@' + q.u : q.phone || '', attr: me ? 'disabled' : `data-mpo="${k}" title="${known ? 'Open in Contacts' : 'Add to Contacts'}"`,
        acts: me ? '' : lDP.act('message-square', 'Message ' + f, `data-mpm="${k}"`) + lDP.act('phone', 'Call ' + f, `data-mpc="${k}"`) + lDP.act('bell-off', `${muted ? 'Unmute' : 'Mute'} ${f} here`, `data-mpmute="${k}" aria-pressed="${muted}"`) }); };
    d.innerHTML = lDP({ title: 'Details', close: 'data-mdetails', body: `<div class="ldphero">${c.dm ? av(c.dm, 72) : cvAv(c, 64)}<b>${esc(who(c).n)}</b><small>${p ? (p.u ? '@' + esc(p.u) : esc(p.phone)) : members.length + 1 + ' people'}</small></div>
      ${c.dm ? lContactActs(c.dm, { size: 'sm' }) : lStack([{ icon: 'phone', label: 'Call', attr: 'data-mcall="voice"' }, { icon: 'video', label: 'Video', attr: 'data-mcall="video"' }], 'sm', 'lcacts')}
      ${lDP.lab('Conversation', `<button type="button" data-mmute>${c.muted ? 'Unmute' : 'Mute'}</button>`)}${lDP.kv([['Started', c.dm ? 'Aug 14' : 'Sep 2'], ['Notifications', c.muted ? 'Muted' : 'On'], ['Encryption', c.sms ? 'None (text message)' : 'End-to-end'], ...(c.sms ? [] : [['Safety code', '48213 90552 17608']])]).replace('<dd>48213', '<dd class="num" title="Compare this code with theirs to verify">48213')}
      ${c.group ? `${lDP.lab('People')}<div class="ldplist">${[...members, 'me'].map(person).join('')}${lAddRow('Add people', 'data-mtodo="Add people: type a name or @username"')}</div>` : ''}
      ${lDP.lab('Photos and files', '<button type="button" data-mtodo="All 48 photos and 6 files">View all</button>')}<div class="ldpph">${photos.map(src => `<img src="${src}" alt="">`).join('')}</div>${lFile({ n: 'launch-deck.stage', k: 'deck', sz: '18.4 MB' }, { open: 'data-mtodo="Opening launch-deck.stage in Stage"' })}
      ${lStack([...(c.group ? [{ icon: 'log-out', label: 'Leave', attr: 'data-mleave' }] : []), { icon: 'trash-2', label: 'Delete', attr: 'data-mdel', danger: true }])}` }); }
  /* Messages' own details already are Messages: its contact actions act here instead of opening another app */
  $('#w-messages').luiCA = (a, k) => { if (a === 'message') { MS.details = false; msgHead(); msgDetails(); shapeGrow(); $('#m-in')?.focus(); return true; } if (a === 'call' || a === 'video') { mToast(`${a === 'video' ? 'Video calling' : 'Calling'} ${ppl(k).n}…`, { icon: a === 'video' ? 'video' : 'phone' }); return true; } return false; };
  const mClose = () => $$('#w-messages .pop').forEach(p => p.remove());
  function mPop(anchor, html, cls = '') { const r = anchor.getBoundingClientRect(); mClose(); const w = $('#w-messages'), wr = w.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop ' + cls; p.innerHTML = html; w.appendChild(p);
    Object.assign(p.style, { left: Math.max(8, Math.min(r.left - wr.left - 6, wr.width - p.offsetWidth - 8)) + 'px', bottom: (wr.bottom - r.top + 10) + 'px' }); return p; }
  /* LumaUI toast, centred on the conversation just above whatever floats at its foot (the composer lives beside the island) */
  function mToast(msg, o) { const w = $('#w-messages'); lToast(w, msg, o); const t = lToast.el, b = [$('#m-comp'), $('#m-bar')].find(x => x && !x.hidden && x.offsetHeight); if (t && b) t.style.bottom = Math.round(w.getBoundingClientRect().bottom - b.getBoundingClientRect().top + 12) + 'px'; }
  function react(id, e) { const x = cv().msgs.find(y => y.id === id); x.reacts = x.reacts || {}; const ks = x.reacts[e] = x.reacts[e] || []; const i = ks.indexOf('me'); i > -1 ? ks.splice(i, 1) : ks.push('me'); if (!ks.length) delete x.reacts[e]; msgBody(true); }
  const EMO = ['❤️', '😂', '👍', '🎉', '😮', '🙏'];
  function msgClick(e, hit) {
    if (!hit('.pop')) mClose();
    if (hit('[data-msearch]')) { MS.searching = true; msgSide(); $('#m-q').focus(); return true; }
    if (hit('[data-msearchx]')) { MS.searching = false; MS.q = ''; msgSide(); return true; }
    const cvb = hit('[data-mcv]'); if (cvb) { openCv(cvb.dataset.mcv); return true; }
    const fl = hit('[data-mfilter]'); if (fl) { MS.filter = fl.dataset.mfilter; msgSide(); return true; }
    if (hit('#m-top b, #m-top .chev')) { const it = (k, label, sub, mark) => `<button class="crmi${MS.acct === k ? ' on' : ''}" type="button" data-macct="${k}">${mark}<span>${label}${sub ? `<small>${sub}</small>` : ''}</span></button>`;
      lMenu(hit('#m-top b, #m-top .chev'), `<h6>Accounts</h6>${it('all', 'All chats', '', ic('inbox'))}${it('luma', 'Luma', '@nick', mNet('luma'))}${it('sms', 'Text messages', 'Your Luma phone', mNet('sms'))}${MS.gm ? it('gm', 'Google Messages', 'Pixel 8', mNet('gm')) : ''}<span class="crsep"></span>${crMi('data-maccts="add"', 'plus', 'Add account…')}${crMi('data-maccts="list"', 'settings', 'Manage accounts')}`); return true; }
    const ma = hit('[data-macct]'); if (ma) { $('#lmenu')?.remove(); MS.acct = ma.dataset.macct; msgSide(); return true; }
    const mp = hit('[data-maccts]'); if (mp) { $('#lmenu')?.remove(); MS.accts = mp.dataset.maccts || null; if (MS.accts) MS.details = false; msgHead(); msgDetails(); requestAnimationFrame(shapeGrow); return true; }
    if (hit('[data-mgsign]')) { mGSign(); return true; }
    if (mNarrow()) { const px = hit('[data-mpx]'); if (px) { const k = px.dataset.mpx; MS.px = MS.px === k ? '' : k; MS.nq = ''; if (k === 'new') msgSide(); else msgBar(); return true; }
      const cg = hit('[data-mcvgo]'); if (cg) { MS.px = ''; MS.nq = ''; openCv(cg.dataset.mcvgo); msgSide(); return true; }
      if (hit('[data-mattach]')) { MS.px = MS.px === 'attach' ? '' : 'attach'; msgBar(); return true; }
      if (hit('[data-memoji]') && !hit('#m-comp')) { MS.px = MS.px === 'emoji' ? '' : 'emoji'; msgBar(); return true; }
      if (hit('[data-mpin]') || hit('[data-mmute]') || hit('[data-mtodo]') || hit('[data-msendk]') || hit('[data-mmycode]') || hit('[data-mgrow]')) { const was = MS.px; MS.px = ''; if (was === 'new') setTimeout(msgSide); else setTimeout(msgBar); } }
    if (hit('[data-misl]')) { MS.isl = !MS.isl; msgHead(); return true; }
    if (MS.isl && !hit('#m-head .misl')) { MS.isl = false; msgHead(); }
    if (hit('[data-mnav]')) { MS.isl = false; $('#w-messages').classList.toggle('navopen'); return true; }
    if (hit('[data-mdetails]')) { MS.accts = null; MS.details = !MS.details; msgHead(); msgDetails(); requestAnimationFrame(shapeGrow); return true; }
    if (hit('[data-mgrow]')) { MS.comp = true; msgBar(); mCompFocus(); return true; }
    if (hit('[data-mcsend]')) { mSendRich(); return true; }
    if (hit('[data-mcompx]')) { const c = cv(), was = { d: MS.draft?.[c.id], r: MS.rich[c.id] }; MS.comp = false; delete MS.rich[c.id]; if (MS.draft) MS.draft[c.id] = ''; msgBar();
      mToast('Draft discarded', { icon: 'trash-2', undo: () => { (MS.draft = MS.draft || {})[c.id] = was.d || ''; if (was.r) MS.rich[c.id] = was.r; MS.comp = true; msgBar(); mCompFocus(); } }); return true; }
    if (hit('[data-mmore]')) { const x = cv().msgs.find(y => y.id === MS.sel), mine = x?.from === 'me'; lMenu(hit('[data-mmore]'), crMi('data-mfwd', 'forward', 'Forward') + crMi('data-mpinmsg', 'pin', 'Pin') + '<span class="crsep"></span>' + crMi('data-mdelmsg', 'trash-2', mine ? 'Delete for everyone' : 'Delete for me', ' red')); return true; }
    if (hit('[data-mfwd]')) { $('#lmenu')?.remove(); mToast('Forward: choose a conversation', { icon: 'forward' }); return true; }
    if (hit('[data-mpinmsg]')) { $('#lmenu')?.remove(); mToast('Pinned to the top of this conversation', { icon: 'pin' }); return true; }
    if (hit('[data-mdelmsg]')) { $('#lmenu')?.remove(); const c = cv(), i = c.msgs.findIndex(y => y.id === MS.sel); if (i < 0) return true; const x = c.msgs[i], mine = x.from === 'me'; c.msgs.splice(i, 1); MS.sel = null; msgBody(true); msgBar(); msgSide();
      mToast(mine ? 'Deleted for everyone' : 'Deleted for you', { icon: 'trash-2', undo: () => { c.msgs.splice(i, 0, x); if (MS.cur === c.id) msgBody(true); msgSide(); } }); return true; }
    if (hit('[data-mmute]')) { const c = cv(); c.muted = !c.muted; msgSide(); msgDetails(); msgHead(); mToast(c.muted ? 'Muted. You won’t be notified.' : 'Unmuted'); return true; }
    const call = hit('[data-mcall]'); if (call) { const c = cv(); mToast(c.sms ? `Calling ${who(c).n} on your phone…` : `${call.dataset.mcall === 'video' ? 'Video calling' : 'Calling'} ${who(c).n}… (calls arrive after launch)`); return true; }
    const td = hit('[data-mtodo]'); if (td) { mClose(); mToast(td.dataset.mtodo); return true; }
    if (hit('[data-mnew]')) { mPop(hit('[data-mnew]'), `<h6>New message</h6><label class="srch lnk">${ic('user')}<input placeholder="Name, username or phone" autofocus></label>${['TH', 'AR', 'CL'].map(k => `<button class="mi" type="button" data-mtodo="Starting a conversation with ${ppl(k).n}">${av(k, 28)}<span><b>${ppl(k).n}</b><span class="sub">@${ppl(k).u}</span></span></button>`).join('')}<hr><button class="mi" type="button" data-mmycode>${ic('scan')}<span><b>Let someone add you</b><span class="sub">Show your code or send your link</span></span></button>`, 'newpop');
      const p = $('#w-messages .newpop'), r = hit('[data-mnew]').getBoundingClientRect(), wr = $('#w-messages').getBoundingClientRect(); Object.assign(p.style, { top: 'auto', bottom: (wr.bottom - r.top + 6) + 'px' }); setTimeout(() => p.querySelector('input')?.focus(), 20); return true; }   // opens upward from the sidebar's foot
    if (hit('[data-mreq]')) { mToast('1 request from @jordan.k: accept, or delete without them knowing'); return true; }
    if (hit('[data-mattach]')) { mPop(hit('[data-mattach]'), `<h6>Send</h6>${[['image', 'Photo or video', 'photo'], ['file-text', 'File', 'file'], ['map-pin', 'Location', 'loc']].map(([i, n, k]) => `<button class="mi" type="button" data-msendk="${k}">${ic(i)}<span>${n}</span></button>`).join('')}`); return true; }
    const sk = hit('[data-msendk]'); if (sk) { mClose(); const k = sk.dataset.msendk; send(k === 'photo' ? { kind: 'photo', src: PH + 'life-sync-terrace.webp' } : k === 'file' ? { kind: 'file', name: 'launch-plan.md', size: '14 KB', app: 'documents' } : { t: '📍 Shared location · Oakland, CA' }); return true; }
    if (hit('[data-memoji]')) { mPop(hit('[data-memoji]'), `<div class="emrow">${['😀', '😂', '🥹', '😍', '🤔', '😎', '🙌', '👍', '🎉', '🔥', '❤️', '🙏'].map(x => `<button type="button" data-mins="${x}">${x}</button>`).join('')}</div>`, 'emopop'); return true; }
    const ins = hit('[data-mins]'); if (ins) { mClose(); const ed = $('#m-comp .laced'); if (ed) { ed.focus(); getSelection().collapse(ed, ed.childNodes.length); document.execCommand('insertText', false, ins.dataset.mins); return true; } const t = $('#m-in'); t.value += ins.dataset.mins; t.oninput(); t.focus(); return true; }
    if (hit('[data-msend]')) { if ($('#m-in')?.value.trim()) send(); else mToast('Hold to record a voice message'); return true; }
    const pl = hit('[data-mplay]'); if (pl) { const id = +pl.dataset.mplay, x = cv().msgs.find(y => y.id === id); if (MS.playing === id) { MS.playing = null; clearInterval(MS.pt); } else { clearInterval(MS.pt); MS.playing = id; MS.pt = setInterval(() => { MS.voiceAt[id] = (MS.voiceAt[id] || 0) + 1; if (MS.voiceAt[id] >= x.dur) { MS.voiceAt[id] = 0; MS.playing = null; clearInterval(MS.pt); } msgBody(true); }, 1000); } msgBody(true); return true; }
    const rc = hit('[data-mreact]'); if (rc) { const [id, em] = rc.dataset.mreact.split(':'); react(+id, em); return true; }
    if (hit('[data-mpin]')) { const c = cv(); c.pinned = !c.pinned; msgSide(); msgHead(); mToast(c.pinned ? `${who(c).n} pinned` : `${who(c).n} unpinned`); return true; }
    const po = hit('[data-mpo]'); if (po) { const k = po.dataset.mpo, known = people().includes(k); if (window.lumaDesk) lumaDesk.open('contacts'); CT.cur = k; if (!known) { CT.edit = true; } ctSide(); ctMain(); mToast(known ? `Opening ${ppl(k).n} in Contacts` : `Add ${ppl(k).n} to your contacts`); return true; }
    const pm = hit('[data-mpm]'); if (pm) { const k = pm.dataset.mpm, d = CONVOS.find(x => x.dm === k); if (d) { MS.details = false; openCv(d.id); msgDetails(); } else mToast(`New conversation with ${ppl(k).n}`); return true; }
    const pc = hit('[data-mpc]'); if (pc) { mToast(`Calling ${ppl(pc.dataset.mpc).n}…`); return true; }
    const pu = hit('[data-mpmute]'); if (pu) { const c = cv(), k = pu.dataset.mpmute; c.mutedP = c.mutedP || []; const i = c.mutedP.indexOf(k); if (i >= 0) c.mutedP.splice(i, 1); else c.mutedP.push(k); msgDetails(); mToast(i >= 0 ? `${ppl(k).n.split(' ')[0]} unmuted here` : `${ppl(k).n.split(' ')[0]} is muted here. You still see their messages, without alerts.`); return true; }
    if (hit('[data-mleave]')) { lConfirm($('#w-messages'), { title: `Leave ${who(cv()).n}?`, body: 'You won’t get new messages. The others keep the conversation, and someone can add you back.', action: 'Leave', icon: 'log-out', onOK: () => mToast('You left the conversation', { icon: 'log-out' }) }); return true; }
    if (hit('[data-mdel]')) { lConfirm($('#w-messages'), { title: 'Delete this conversation?', body: 'It’s removed from this computer. Others in the conversation keep their copy.', action: 'Delete', onOK: () => mToast('Conversation deleted', { icon: 'trash-2' }) }); return true; }
    if (hit('[data-mpclose]')) { mClose(); return true; }
    if (hit('[data-mmycode]')) { mPop(hit('[data-mmycode]'), `<div class="mycode">${qr()}<b>@nick</b><span>simplyluma.com/@nick</span><div class="pacts"><button class="bt sm fill" type="button" data-mcopylink>${ic('link')}Copy link</button></div></div>`, 'codepop'); return true; }
    if (hit('[data-mcopylink]')) { navigator.clipboard?.writeText('simplyluma.com/@nick').catch(() => {}); mClose(); mToast('Link copied'); return true; }
    const qrb = hit('[data-mqr]'); if (qrb) { const [id, em] = qrb.dataset.mqr.split(':'); if (em === 'reply') { MS.reply = +id; MS.sel = null; msgBar(); msgBody(true); $('#m-in').focus(); } else react(+id, em); return true; }
    const jm = hit('[data-mjump]'); if (jm) { const el = $(`#m-body [data-mid="${jm.dataset.mjump}"]`); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.classList.add('flash'); setTimeout(() => el?.classList.remove('flash'), 1200); return true; }
    if (hit('[data-mreplyto]')) { MS.reply = MS.sel; MS.sel = null; msgBody(true); msgBar(); $('#m-in')?.focus(); return true; }
    if (hit('[data-mreplyx]')) { MS.reply = null; msgBar(); return true; }
    if (hit('[data-mreactpop]')) { mPop(hit('[data-mreactpop]'), `<div class="emrow">${EMO.map(x => `<button type="button" data-mreact="${MS.sel}:${x}">${x}</button>`).join('')}</div>`, 'emopop'); return true; }
    if (hit('[data-mcopy]')) { const x = cv().msgs.find(y => y.id === MS.sel); navigator.clipboard?.writeText(x.t).catch(() => {}); mToast('Copied', { icon: 'copy' }); return true; }
    if (hit('[data-mdone]')) { MS.sel = null; msgBody(true); msgBar(); return true; }
    const bub = hit('#m-body .bub'); if (bub && !hit('button')) { const id = +bub.closest('[data-mid]').dataset.mid; MS.sel = MS.sel === id ? null : id; MS.reply = null; msgBody(true); msgBar(); return true; }
    if (hit('#m-body') && MS.sel != null && !hit('.qbar')) { MS.sel = null; msgBody(true); msgBar(); return true; }
    return false; }
  /* Hovering a message offers the three things people do most: love, laugh, reply. */
  (() => { const w = $('#w-messages'); if (!w) return; const q = document.createElement('div'); q.className = 'qbar'; $('#m-main').appendChild(q);
    $('#m-body').addEventListener('mousemove', e => { const msg = e.target.closest('.msg:not(.typing)'); if (!msg || MS.sel != null) { if (!e.target.closest('.qbar')) q.classList.remove('on'); return; }
      const b = msg.querySelector('.bub').getBoundingClientRect(), mr = $('#m-main').getBoundingClientRect(), id = msg.dataset.mid, mine = msg.classList.contains('mine');
      q.innerHTML = `${['❤️', '😂', '👍'].map(x => `<button type="button" data-mqr="${id}:${x}">${x}</button>`).join('')}<button type="button" class="qrep" data-mqr="${id}:reply" aria-label="Reply">${ic('reply')}</button>`;
      q.style.top = Math.round(b.top - mr.top + Math.min(b.height, 44) / 2 - 18) + 'px'; q.style.left = Math.round(mine ? b.left - mr.left - q.offsetWidth - 8 : b.right - mr.left + 8) + 'px'; q.classList.add('on'); });
    $('#m-body').addEventListener('mouseleave', e => { if (!e.relatedTarget?.closest?.('.qbar')) q.classList.remove('on'); });
    q.addEventListener('mouseleave', () => q.classList.remove('on'));
    /* A conversation stays pinned to its newest message unless you've scrolled up to read. */
    let stick = true; $('#m-body').addEventListener('scroll', () => { q.classList.remove('on'); const b = $('#m-body'); stick = b.scrollHeight - b.scrollTop - b.clientHeight < 60; }, { passive: true });
    new ResizeObserver(() => { shapeGrow(); if (stick) { const b = $('#m-body'); b.scrollTop = b.scrollHeight; } }).observe($('#w-messages .ibody'));
    new ResizeObserver(() => { if (stick) { const b = $('#m-body'); b.scrollTop = b.scrollHeight; } }).observe($('#m-body'));
    document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'messages') return; const k = e.key.toLowerCase();
      if (k === 'escape') { if ($('#lc, #lmenu')) return; mClose(); if (MS.sel != null) { MS.sel = null; msgBody(true); msgBar(); e.preventDefault(); } else if (MS.reply != null) { MS.reply = null; msgBar(); e.preventDefault(); } else if (MS.details) { MS.details = false; msgHead(); msgDetails(); shapeGrow(); e.preventDefault(); } }
      else if ((e.ctrlKey || e.metaKey) && k === 'f') { e.preventDefault(); MS.searching = true; msgSide(); $('#m-q').focus(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'n') { e.preventDefault(); $('[data-mnew]').click(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'arrowup' || k === 'arrowdown')) { e.preventDefault(); const i = CONVOS.findIndex(c => c.id === MS.cur), n = CONVOS[(i + (k === 'arrowdown' ? 1 : CONVOS.length - 1)) % CONVOS.length]; openCv(n.id); } }); })();
  /* Rich text in Messages, Notes and Charlie: LumaUI's selection bubble (Write's), the common marks just above the selection
     (bold, italic, highlight, link, ··· for the rest). It waits for the selection to settle, hides on typing, scrolling or
     deselecting; Alt+F10 reaches it, arrows move in it, Esc hides it. The editors' own toolbars stay where they are. */
  const RT = { eds: [['#m-comp .laced', '#m-sel', '#m-main'], ['#n-doc', '#n-sel', '#n-main'], ['#cr-comp .cr2ed', '#cr-sel', '#cr-main']] };
  function rtCmd(k) { if (k === 'link') document.execCommand('createLink', false, 'https://simplyluma.com'); else if (k === 'highlight') { document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, '#fde68a'); document.execCommand('styleWithCSS', false, false); } else document.execCommand(k); }
  const rtBtn = (k, n, i) => `<button class="ib" type="button" data-rtfmt="${k}" title="${n}" aria-label="${n}">${ic(i)}</button>`;
  document.addEventListener('selectionchange', () => { clearTimeout(RT.t); RT.t = setTimeout(() => { const s = getSelection();
    RT.eds.forEach(([e, b, h]) => { const ed = $(e), bar = $(b); if (!bar) return; if (!ed || !s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode) || !s.toString().trim()) { lBubble.hide(bar); return; }
      lBubble(bar, $(h), s.getRangeAt(0).getBoundingClientRect(), rtBtn('bold', 'Bold', 'bold') + rtBtn('italic', 'Italic', 'italic') + rtBtn('highlight', 'Highlight', 'highlighter') + rtBtn('link', 'Link', 'link') + `<span class="vr"></span><button class="ib" type="button" data-rtmore title="More formatting" aria-label="More formatting">${ic('ellipsis')}</button>`); }); }, 200); });
  document.addEventListener('scroll', e => { if (!e.target.closest?.('.selbar')) RT.eds.forEach(([ b]) => lBubble.hide($(b))); }, true);
  document.addEventListener('mousedown', e => { if (e.target.closest?.('[data-rtfmt], [data-rtmore]')) e.preventDefault(); }, true);
  document.addEventListener('click', e => { const m = e.target.closest?.('[data-rtmore]'), b = e.target.closest?.('[data-rtfmt]'); if (!m && !b) return; e.stopPropagation(); e.preventDefault();
    if (m) { lMenu(m, `<h6>Format</h6>${[['underline', 'Underline', 'underline'], ['strikeThrough', 'Strikethrough', 'strikethrough'], ['insertUnorderedList', 'Bulleted list', 'list'], ['insertOrderedList', 'Numbered list', 'list-ordered'], ['removeFormat', 'Plain text', 'type']].map(([k, n, i]) => crMi(`data-rtfmt="${k}"`, i, n)).join('')}`); return; }
    const own = b.closest('.lac, .cr2c')?.querySelector('[contenteditable="true"]'); if (own && !own.contains(getSelection().anchorNode)) own.focus();
    rtCmd(b.dataset.rtfmt); $('#lmenu')?.remove(); const n = getSelection().anchorNode, ed = (n?.nodeType === 1 ? n : n?.parentElement)?.closest('[contenteditable="true"]'); ed?.dispatchEvent(new Event('input', { bubbles: true })); }, true);

  /* ══ Notes ═════════════════════════════════════════════════════════════════
     Catch a thought, find it again, share it. No page and no toolbar above the words: you write
     straight onto the island. Folders are colours (chips above the list; the room is lit by the note's
     folder). Sharing is presence: who's here, their live cursor, and one Share button, all @usernames. */
  const FOLD = { launch: ['Launch', 285, null], press: ['Press', 285, 'launch'], personal: ['Personal', 150, null], recipes: ['Recipes', 45, 'personal'], ideas: ['Ideas', 200, null] };
  let NID = 1; const note = o => ({ id: NID++, at: 'Sep 18', share: [], ...o });
  const NOTES = [
    note({ t: 'Launch checklist', f: 'launch', pinned: true, at: 'Today, 10:40 AM', share: ['PR', 'NF'], live: 'PR', html: `<p>Everything that has to be true before we press the button on October 14.</p><ul class="check"><li class="done">Freeze strings</li><li class="done">Installer tested on twelve laptops</li><li>Press photos picked</li><li>Fairphone build signed</li><li>Mirrors load-tested at 3× our estimate</li></ul><h2>Day of</h2><p id="n-live">Short film goes up at 9, the download an hour later. </p>` }),
    note({ t: 'Groceries', f: 'personal', pinned: true, at: 'Today, 8:12 AM', share: ['MO'], html: `<ul class="check"><li>Oat milk</li><li>Sourdough flour</li><li class="done">Coffee beans</li><li>Lemons</li><li>Something for Dad’s birthday</li></ul>` }),
    note({ t: 'Podcast interview', f: 'press', at: 'Yesterday', html: `<p>Talking points for Thursday.</p><ul><li>Why a computer should feel like yours again</li><li>Free, and why that isn’t a catch</li><li>What Ari does and doesn’t do</li></ul><blockquote>We didn’t want to build another thing that asks for your attention.</blockquote>` }),
    note({ t: 'Sourdough', f: 'recipes', at: 'Sep 20', html: `<figure contenteditable="false"><img src="${PH}life-hero-home.webp" alt=""></figure><p>500 g flour, 350 g water, 100 g starter, 10 g salt.</p><ol><li>Mix, rest an hour</li><li>Four sets of folds, 30 minutes apart</li><li>Shape, cold proof overnight</li><li>Bake at 250°, lid on for 20, off for 25</li></ol>` }),
    note({ t: 'App ideas', f: 'ideas', at: 'Sep 19', html: `<p>Things I’d want on my own computer:</p><ul><li>A clipboard you can see (done: Filer’s tray)</li><li>Notes that know who they’re shared with</li><li>A music app lit by the album</li></ul>` }),
    note({ t: 'Books to read', f: 'personal', at: 'Sep 12', html: `<ul class="check"><li class="done">The Design of Everyday Things</li><li>Hackers &amp; Painters</li><li>A Pattern Language</li></ul>` }),
    note({ t: 'Cabin Wi-Fi', f: 'personal', at: 'Aug 30', html: `<p>Network: <b>Pinecrest</b><br>Password: bring-snacks-2026</p>` }),
    note({ t: 'Day-of run sheet', f: 'launch', parent: 1, at: 'Today, 9:02 AM', share: ['PR'], html: `<p>Minute by minute for October 14.</p><ul><li>8:30 Everyone on the call</li><li>9:00 Film goes live</li><li>10:00 Download opens</li></ul>` }),
    note({ t: 'Press list', f: 'press', at: 'Sep 21', html: `<ul class="check"><li class="done">The Verge</li><li>Ars Technica</li><li>It’s FOSS</li></ul>` }),
    note({ t: 'Feeding the starter', f: 'recipes', parent: 4, at: 'Sep 20', html: `<p>Equal parts flour and water by weight, every morning. Keep it on the counter in summer.</p>` }),
    note({ t: 'Climbing gear', f: null, from: 'TH', at: 'Sep 21', share: ['TH'], html: `<p>For Saturday. Theo is bringing the rope.</p><ul class="check"><li>Shoes</li><li>Chalk</li><li>Harness</li></ul>` }) ];
  const N = { cur: 1, f: 'all', q: '', searching: false, undo: null, open: new Set(['flaunch', 'fpersonal', 'n1']), drag: null, newIn: null };
  const ncur = () => NOTES.find(x => x.id === N.cur);
  const nHue = n => n.f ? FOLD[n.f][1] : 20;
  const NMARK = {};   // folders default to a dot in their colour; pages to the page icon
  const markOf = key => NMARK[key] || (key.startsWith('f:') ? { t: 'dot', h: FOLD[key.slice(2)][1] } : { t: 'icon', v: 'file-text', h: null });
  const nMarkBtn = key => `<button class="lmkb" type="button" data-nmark="${key}" aria-label="Change icon" title="Change icon">${lMark(markOf(key))}</button>`;
  const nText = h => { const d = document.createElement('div'); d.innerHTML = h.replace(/<\/(li|p|h2|blockquote|figure)>|<br>/g, ' '); return d.textContent.replace(/\s+/g, ' ').trim(); };
  const faces = (ks, sz = 18) => `<span class="nfaces">${ks.map(k => av(k, sz)).join('')}</span>`;
  function nList() { const q = N.q.toLowerCase();
    let l = NOTES.filter(n => N.f === 'all' ? true : N.f === 'shared' ? n.share.length || n.from : n.f === N.f);
    if (q) l = l.filter(n => (n.t + ' ' + nText(n.html)).toLowerCase().includes(q)); return l; }
  const fParent = k => FOLD[k]?.[2] ?? null;
  const inFolder = (f, k) => { while (f) { if (f === k) return true; f = fParent(f); } return false; };
  const kidsOf = n => NOTES.filter(x => x.parent === n.id);
  const isDesc = (a, b) => { let x = NOTES.find(n => n.id === a); while (x?.parent) { if (x.parent === b) return true; x = NOTES.find(n => n.id === x.parent); } return false; };   /* is note a inside note b */
  const setF = (n, f) => { n.f = f; kidsOf(n).forEach(c => setF(c, f)); };
  function nReveal(n) { if (n.from) return; let f = n.f; while (f) { N.open.add('f' + f); f = fParent(f); } let x = n; while (x.parent) { N.open.add('n' + x.parent); x = NOTES.find(y => y.id === x.parent); } }
  /* Notes on a phone: list first, like Memos and Messages. A large title, the folder you're in (a dropdown that grows the
     folder tree in the bar), then notes as rows with a line of their text, newest first, pinned on top. The bar is Search
     and New note. Opening a note pushes it; Back returns to the list. */
  function nSidePhone() { const q = N.q.toLowerCase(), F = N.pfold || null, fname = F ? FOLD[F][0] : 'All notes', X = N.lpx || '';
    let l = NOTES.filter(n => (!F || inFolder(n.f, F)) && (!q || (n.t + ' ' + nText(n.html)).toLowerCase().includes(q)));
    const pin = l.filter(n => n.pinned), rest = l.filter(n => !n.pinned);
    const row = n => `<button class="nrow2${n.id === N.cur ? ' on' : ''}" type="button" data-nopen="${n.id}" style="--nh:${nHue(n)}"><span class="nr2t"><b>${esc(n.t || 'New note')}</b>${n.share.length ? faces(n.share, 18) : ''}</span><span class="nr2p"><em>${n.at.replace('Today, ', '')}</em>${esc(nText(n.html).slice(0, 90)) || 'No text yet'}</span><span class="nr2f"><i class="fdot round"></i>${n.f ? esc(FOLD[n.f]?.[0] || '') : 'Notes'}</span></button>`;
    const fl = (parent, d) => Object.keys(FOLD).filter(k => fParent(k) === parent).map(k => `<button class="fexr2${F === k ? ' on' : ''}" type="button" data-npfold="${k}" style="padding-left:${10 + d * 18}px"><i class="fdot round" style="background:oklch(0.72 0.14 ${FOLD[k][1]})"></i><span>${esc(FOLD[k][0])}</span><em>${NOTES.filter(n => inFolder(n.f, k)).length}</em></button>${fl(k, d + 1)}`).join('');
    const panel = X === 'fold' ? `<div class="fexp fmore2 nfold2"><button class="fexr2${!F ? ' on' : ''}" type="button" data-npfold="">${ic('notebook')}<span>All notes</span><em>${NOTES.length}</em></button>${fl(null, 0)}<button class="fexr2" type="button" data-nnewfolder>${ic('folder-plus')}<span>New folder</span></button></div>` : '';
    $('#n-side').innerHTML = `<div class="scr nlist2"><header class="nlh"><h1>Notes</h1><button class="nfsel" type="button" data-nlpx="fold">${F ? `<i class="fdot round" style="background:oklch(0.72 0.14 ${FOLD[F][1]})"></i>` : ''}${esc(fname)}${ic('chevron-down')}</button></header>
      ${pin.length ? `<div class="nlsh">${ic('pin')}Pinned</div>${pin.map(row).join('')}` : ''}${rest.length ? `${pin.length ? '<div class="nlsh">Notes</div>' : ''}${rest.map(row).join('')}` : ''}${!l.length ? `<p class="fhint">${q ? 'No notes match.' : 'No notes here yet.'}</p>` : ''}</div>
      <div class="fbar nlbar phnofit${panel ? ' phgrow' : ''}">${panel}${X === 'search' ? `<label class="nlq">${ic('search')}<input id="n-q" placeholder="Search notes" value="${esc(N.q)}" aria-label="Search notes"></label><button class="ib" type="button" data-nlpx="search" aria-label="Close search">${ic('x')}</button>` : `<button class="nlq" type="button" data-nlpx="search">${ic('search')}<span>${N.q ? esc(N.q) : 'Search'}</span></button><button class="bt pri" type="button" data-nnew aria-label="New note">${ic('square-pen')}<span>New</span></button>`}</div>`;
    const i = $('#n-q'); if (i) { i.oninput = () => { N.q = i.value; nSide(); const x = $('#n-q'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }; setTimeout(() => i.focus(), 30); } }
  function nSide() { const q = N.q.toLowerCase();
    if ($('#w-notes').classList.contains('phone')) return nSidePhone();
    const row = n => `<button class="nrow${n.id === N.cur ? ' on' : ''}" type="button" data-nopen="${n.id}" style="--nh:${nHue(n)}"><span class="l1"><i class="fdot round"></i><b>${esc(n.t || 'New note')}</b>${n.share.length ? faces(n.share, 16) : ''}</span>
      <span class="l2"><span class="tm">${n.at.replace('Today, ', '')}</span><span class="pv">${esc(nText(n.html).slice(0, 80)) || 'No text yet'}</span></span></button>`;
    const leaf = (n, d) => { const k = kidsOf(n), open = N.open.has('n' + n.id);
      return `<div class="trow nt${n.id === N.cur ? ' on' : ''}" style="--d:${d};--nh:${nHue(n)}" data-nopen="${n.id}" draggable="true" data-dragn="${n.id}" data-dropn="${n.id}">${k.length ? `<button class="tw${open ? ' open' : ''}" type="button" data-ntw="n${n.id}" aria-label="${open ? 'Collapse' : 'Expand'}">${ic('chevron-right')}</button>` : '<i class="tw"></i>'}${nMarkBtn('n:' + n.id)}<span class="lab">${esc(n.t || 'New note')}</span>${n.share.length ? faces(n.share, 16) : ''}</div>${open ? k.map(c => leaf(c, d + 1)).join('') : ''}`; };
    const folder = (k, d) => { const [nm, h] = FOLD[k], open = N.open.has('f' + k), cnt = NOTES.filter(n => inFolder(n.f, k)).length;
      return `<div class="trow fd" style="--d:${d};--nh:${h}" data-ntw="f${k}" draggable="true" data-dragf="${k}" data-dropf="${k}"><span class="tw${open ? ' open' : ''}">${ic('chevron-right')}</span>${nMarkBtn('f:' + k)}<span class="lab">${esc(nm)}</span>${lCount(cnt)}</div>${open ? tree(k, d + 1) : ''}`; };
    const tree = (parent, d) => Object.keys(FOLD).filter(k => fParent(k) === parent).map(k => folder(k, d)).join('') + NOTES.filter(n => (n.f ?? null) === parent && !n.parent && !n.from).map(n => leaf(n, d)).join('');
    let body;
    if (q) { const l = NOTES.filter(n => (n.t + ' ' + nText(n.html)).toLowerCase().includes(q)); body = l.map(row).join('') || `<div class="fhint">No notes match.</div>`; }
    else { const pinned = NOTES.filter(n => n.pinned), shared = NOTES.filter(n => n.from);
      body = `${pinned.length ? `<div class="sh">Pinned</div>${pinned.map(n => `<div class="trow nt tpin${n.id === N.cur ? ' on' : ''}" style="--d:0;--nh:${nHue(n)}" data-nopen="${n.id}"><i class="tw"></i>${nMarkBtn('n:' + n.id)}<span class="lab">${esc(n.t)}</span>${n.share.length ? faces(n.share, 16) : ''}</div>`).join('')}` : ''}
        <div class="sh" data-droproot>Folders<button class="ib" type="button" data-nnewfolder aria-label="New folder" title="New folder">${ic('plus')}</button></div>${tree(null, 0)}${shared.length ? `<div class="sh">Shared with me</div>${shared.map(n => leaf(n, 0)).join('')}` : ''}`; }
    $('#n-side').innerHTML = `
      <div class="scr">${body}</div><div class="shead sfoot"><label class="srch">${ic('search')}<input id="n-q" placeholder="Search notes" value="${esc(N.q)}" aria-label="Search notes"><button class="fqx" type="button" data-nsearchx aria-label="Clear search">${ic('x')}</button></label><button class="snew" type="button" data-nnew aria-label="New note" title="New note · Ctrl N">${ic('square-pen')}</button></div>`;
    const i = $('#n-q'); if (i) { i.oninput = () => { N.q = i.value; nSide(); const x = $('#n-q'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }; i.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); N.searching = false; N.q = ''; nSide(); } }; } }
  function nTop() { const n = ncur(), p = n.share.filter(k => k !== 'me');
    $('#n-float').innerHTML = `${p.length || n.from ? `<button class="npeople" type="button" data-nshare data-share title="${n.from ? 'Shared by ' + ppl(n.from).n : 'Shared with ' + p.map(k => ppl(k).n.split(' ')[0]).join(' and ')}">${faces(n.from ? [n.from] : p, 28)}${n.live ? `<span class="ntyping"><i class="ond round"></i>${ppl(n.live).n.split(' ')[0]} is here</span>` : ''}</button>` : ''}
      <button class="bt" type="button" data-nshare data-share>${ic('share-2')}Share</button>
      <button class="ib${n.pinned ? ' lit' : ''}" type="button" data-npin aria-label="${n.pinned ? 'Unpin' : 'Pin'}" title="${n.pinned ? 'Unpin' : 'Pin'}">${ic('pin')}</button><button class="ib" type="button" data-nmore aria-label="More">${ic('ellipsis')}</button>`; }
  function nEditor() { const n = ncur(), m = $('#w-notes'); m.style.setProperty('--nh', nHue(n));
    const path = []; let f = n.f; while (f) { path.unshift(`<span class="crumb" style="--nh:${FOLD[f][1]}">${esc(FOLD[f][0])}</span>`); f = fParent(f); }
    const up = []; let x = n; while (x.parent) { x = NOTES.find(y => y.id === x.parent); up.unshift(`<button class="crumb" type="button" data-nopen="${x.id}">${esc(x.t)}</button>`); }
    $('#n-meta').innerHTML = `${n.f ? `<button class="npath" type="button" data-nmove title="Move" style="--nh:${nHue(n)}">${lMark(markOf('f:' + n.f))}${path.join(`<span class="cs">/</span>`)}</button>${up.length ? `<span class="cs">/</span>${up.join('<span class="cs">/</span>')}` : ''}` : `<span class="fchip sm">${ic('users')}From ${ppl(n.from).n.split(' ')[0]}</span>`}<span class="ed">Edited ${n.at.replace('Today, ', 'today at ').replace(/^Yesterday$/, 'yesterday')}</span>`;
    nPic(); $('#n-title').textContent = n.t; $('#n-doc').innerHTML = n.html; const k = kidsOf(n);
    $('#n-kids').innerHTML = `${k.length ? `<div class="kh">Inside this note</div>${k.map(c => `<button class="kid" type="button" data-nopen="${c.id}">${ic('file-text')}<span><b>${esc(c.t)}</b><span>${esc(nText(c.html).slice(0, 90))}</span></span>${ic('chevron-right')}</button>`).join('')}` : ''}<button class="kadd" type="button" data-nnewin="${n.id}">${ic('plus')}New note inside</button>`; $('#n-scroll').scrollTop = 0; nTop(); nLive(); }
  function nPic() { const k = 'n:' + N.cur, b = $('#n-pic'); if (!b) return; const set = !!NMARK[k]; b.className = 'npic' + (set ? '' : ' add'); b.innerHTML = set ? lMark(NMARK[k], 'xl') : `${ic('smile')}Add icon`; }
  function nSave(field) { const n = ncur(); if (field === 'title') n.t = $('#n-title').innerText.trim(); else { const c = $('#n-doc').cloneNode(true); c.querySelector('.peer')?.remove(); n.html = c.innerHTML; }
    n.at = 'Just now'; $('#n-meta .ed').textContent = 'Edited just now'; clearTimeout(nSave.t); nSave.t = setTimeout(nSide, 250); }
  /* Presence: Priya is in the launch checklist, writing. Her cursor carries her name. */
  function nLive() { clearInterval(N.lt); $('#n-doc .peer')?.remove(); const n = ncur(), el = $('#n-live'); if (!n.live || !el) return;
    const k = n.live, p = ppl(k), caret = document.createElement('span'); caret.className = 'peer'; caret.contentEditable = 'false'; caret.style.setProperty('--ph', p.h); caret.innerHTML = `<i></i><b>${p.n.split(' ')[0]}</b>`; el.appendChild(caret);
    const text = N.liveLeft ?? 'Priya posts the letter at 10:30, Nora answers press from the Hub all day, and we meet at 4 to decide on the phone release.'; let i = 0;
    N.lt = setInterval(() => { if (!document.contains(caret)) { clearInterval(N.lt); return; } if (i >= text.length) { clearInterval(N.lt); N.liveLeft = ''; nSave(); return; } const c = text[i++]; caret.before(document.createTextNode(c)); N.liveLeft = text.slice(i); if (i % 12 === 0) nSave(); }, 70); }
  /* The bar: block tools at rest; inline tools while words are selected. */
  const HLN = SVG['highlighter'], CHK = SVG['list-checks'];
  const nQS = c => { try { return document.queryCommandState(c); } catch (e) { return false; } };
  function nBlock() { const s = getSelection(); if (!s.rangeCount) return null; let x = s.anchorNode; const d = $('#n-doc'); if (!d.contains(x)) return null; while (x && x.parentNode !== d) x = x.parentNode; return x?.nodeType === 1 ? x : null; }
  /* ── Notes on a phone ─────────────────────────────────────────────────────────────────────────
     The bar: Aa (formatting), checklist, share, ⋯ and the one primary, a new note. Formatting, sharing and the
     note's other actions grow out of the bar; the top keeps only ☰ and who's in the note with you. */
  const nNarrow = () => { const m = $('#n-main'); return !!m?.clientWidth && m.clientWidth < 560; };
  function nBarPhone() { const bar = $('#n-bar'), n = ncur(), P = N.px, b = nBlock(), s = getSelection(), inSel = s.rangeCount && !s.isCollapsed && $('#n-doc').contains(s.anchorNode);
    const st = b ? ({ H2: 'h2', BLOCKQUOTE: 'blockquote' }[b.tagName] || (b.tagName === 'UL' && b.classList.contains('check') ? 'check' : b.tagName === 'UL' ? 'ul' : b.tagName === 'OL' ? 'ol' : 'p')) : 'p';
    bar.classList.add('phnofit', 'nphbar'); bar.classList.remove('sel');
    let panel = '';
    if (P === 'fmt') panel = `<div class="fexp nfmt"><div class="nfs">${[['h2', 'Heading', 'data-nblock="h2"'], ['p', 'Text', 'data-nblock="p"'], ['blockquote', 'Quote', 'data-nblock="blockquote"']].map(([k, t, a]) => `<button type="button" class="fsch nfs-${k}${st === k ? ' on' : ''}" ${a}>${t}</button>`).join('')}</div>
      <div class="nfr">${[['bold', 'bold', 'Bold', 'data-ncmd="bold"'], ['italic', 'italic', 'Italic', 'data-ncmd="italic"'], ['strikeThrough', 'strikethrough', 'Strikethrough', 'data-ncmd="strikeThrough"']].map(([c, i, t, a]) => `<button class="ib${inSel && nQS(c) ? ' on' : ''}" type="button" ${a} aria-label="${t}">${ic(i)}</button>`).join('')}<button class="ib" type="button" data-nhl aria-label="Highlight">${HLN}</button><button class="ib" type="button" data-nlink aria-label="Link">${ic('link')}</button></div><div class="nfr nfl"><span class="vr"></span><button class="ib${st === 'ul' ? ' on' : ''}" type="button" data-ncmd="insertUnorderedList" aria-label="Bulleted list">${ic('list')}</button><button class="ib${st === 'ol' ? ' on' : ''}" type="button" data-ncmd="insertOrderedList" aria-label="Numbered list">${ic('list-ordered')}</button></div></div>`;   /* Checklist lives in the bar now */
    if (P === 'share') { const p = n.share.filter(k => k !== 'me');
      panel = `<div class="fexp nshp"><div class="fexh">${p.length ? 'In this note' : 'Share this note'}</div>${p.map(k => `<div class="nsr">${av(k, 36)}<span><b>${esc(ppl(k).n)}</b><small>${n.live === k ? 'Here now' : 'Can edit'}</small></span></div>`).join('')}
        <div class="fshp">${['PR', 'NF', 'SK', 'TH', 'MO'].filter(k => !p.includes(k)).slice(0, 4).map(k => `<button type="button" data-ntodo="Shared with ${esc(ppl(k).n.split(' ')[0])}">${av(k, 44)}<span>${esc(ppl(k).n.split(' ')[0])}</span></button>`).join('')}<button type="button" class="nshadd" data-ntodo="Add people by name, @username or email"><i>${ic('plus')}</i><span>Add</span></button></div>
        <div class="fsha c2">${[['link', 'Copy link'], ['send', 'Send a copy']].map(([i, t]) => `<button type="button" class="fvt" data-ntodo="${t === 'Copy link' ? 'Link copied' : 'Choose where to send a copy'}">${ic(i)}<span>${t}</span></button>`).join('')}</div></div>`; }
    if (P === 'more') panel = `<div class="fexp fmore2"><button class="fexr2" type="button" data-npin>${ic('pin')}<span>${n.pinned ? 'Unpin' : 'Pin to the top'}</span></button><button class="fexr2" type="button" data-npx="move">${ic('folder')}<span>Move to folder</span>${ic('chevron-right')}</button><button class="fexr2" type="button" data-ndup>${ic('copy')}<span>Duplicate</span></button><button class="fexr2" type="button" data-ntodo="Exported as Markdown">${ic('download')}<span>Export as Markdown</span></button><button class="fexr2 red" type="button" data-ndel>${ic('trash-2')}<span>Delete note</span></button></div>`;
    if (P === 'move') panel = `<div class="fexp fmore2"><button class="fexr2 fback" type="button" data-npx="more">${ic('chevron-left')}<span>Move to</span></button>${Object.entries(FOLD).map(([k, [nm, h]]) => { let d = 0, f = k; while ((f = fParent(f))) d++; return `<button class="fexr2" type="button" data-nmoveto="${k}" style="--nh:${h};padding-left:${10 + d * 20}px"><i class="fdot round"></i><span>${nm}</span>${n.f === k ? ic('check') : ''}</button>`; }).join('')}</div>`;
    bar.classList.toggle('phgrow', !!panel);
    nIsl();   /* who and what this note is lives in the title island; the bar is for writing */
    bar.innerHTML = `${panel}<button class="ib${P === 'fmt' ? ' on' : ''}" type="button" data-npx="fmt" aria-label="Formatting" title="Formatting"><span class="naa">Aa</span></button><button class="ib${st === 'check' ? ' on' : ''}" type="button" data-ncheck aria-label="Checklist" title="Checklist">${CHK}</button><button class="ib" type="button" data-nphoto aria-label="Add a photo" title="Add a photo">${ic('image')}</button><span class="nbsep"></span><button class="bt pri nnewb" type="button" data-nnew aria-label="New note" title="New note">${ic('square-pen')}</button>`;
