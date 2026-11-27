  function renderCalendar() { $('#cal-body').addEventListener('scroll', calTrack, { passive: true }); new ResizeObserver(() => { if (CS.view === 'month') cmFit(); }).observe($('#cal-body')); $('#cal-top').innerHTML = `<img src="${A}calendar.svg" alt=""><b>Calendar</b><span class="chev">${ic('chevron-down')}</span>`; calBar(); calBody(); calDet(); }

  /* ══ Depot ═════════════════════════════════════════════════════════════════
     Find something good, trust it, get it, keep it current. Discover is editorial and lit by the apps;
     an app page leads with what it can reach; one key goes Get → a progress ring → Open. Navigation and
     search live in the floating bar. Third-party apps get neutral monograms: we don't redraw their logos. */
  const DCAT = { create: ['Create', 'Make pictures, films and music', 25], work: ['Work', 'Write, plan and talk', 250], media: ['Media', 'Watch, listen and look', 330], play: ['Play', 'Games and the places they live', 150], tools: ['Tools', 'Keep the computer tidy', 200] };
  const DCATIC = { create: 'palette', work: 'briefcase', media: 'clapperboard', play: 'gamepad-2', tools: 'wrench' };
  const DCATIMG = { create: 'life-suite-bg-canvas', work: 'life-work-suite', media: 'life-suite-bg-sessions', play: 'life-hero-home', tools: 'life-professionals-loft' };
  const DA = [];
  const da = (id, n, t, cat, o = {}) => DA.push({ id, n, t, cat, size: o.size || '—', rating: o.rating || 4.7, reviews: o.reviews || 320, ...o });
  // Made for Suno (real icons, real screenshots)
  da('tide', 'Tide', 'Your music, from everywhere you keep it', 'media', { suno: 1, icon: 'music', shot: 'tide', inst: 1, size: '38 MB', rating: 4.9, reviews: 1204, reach: [['music-2', 'Your Music folder', 'Reads it to build your library'], ['headphones', 'Your music server', 'Only if you add one, like Navidrome'], ['shield-check', 'No account needed', 'Nothing about what you play leaves']] });
  da('photos', 'Photos', 'Every photo you’ve taken, beautifully kept', 'media', { suno: 1, icon: 'photos', shot: 'photos', inst: 1, size: '44 MB', rating: 4.8 });
  da('filer', 'Filer', 'Files, with a tray you can carry', 'tools', { suno: 1, icon: 'files', shot: 'filer', inst: 1, size: '21 MB', rating: 4.8 });
  da('write', 'Write', 'Documents, beautifully set and easy to share', 'work', { suno: 1, icon: 'documents', shot: 'write', inst: 1, size: '62 MB', rating: 4.7 });
  da('viola', 'Viola', 'A calmer way to browse', 'work', { suno: 1, icon: 'browser', shot: 'viola', inst: 1, size: '118 MB', rating: 4.6 });
  da('messages', 'Messages', 'Talk to anyone, privately', 'work', { suno: 1, icon: 'messages', shot: 'messages', inst: 1, size: '33 MB', rating: 4.8 });
  da('notes', 'Notes', 'Catch a thought, share it with anyone', 'work', { suno: 1, icon: 'notes', shot: 'notes', inst: 1, size: '12 MB', rating: 4.9 });
  da('calendar', 'Calendar', 'See what’s next and when you’re free', 'work', { suno: 1, icon: 'calendar', shot: 'calendar', inst: 1, size: '18 MB' });
  da('contacts', 'Contacts', 'Everyone you know, in one place', 'work', { suno: 1, icon: 'contacts', shot: 'contacts', inst: 1, size: '9 MB' });
  da('terminal', 'Terminal', 'A quiet, fast command line', 'tools', { suno: 1, icon: 'terminal', shot: 'term', inst: 1, size: '8 MB', rating: 4.9 });
  da('stage', 'Stage', 'Presentations that look designed', 'work', { suno: 1, icon: 'presentations', size: '71 MB' });
  da('grid', 'Grid', 'Spreadsheets without the dread', 'work', { suno: 1, icon: 'spreadsheets', size: '54 MB' });
  da('canvas', 'Canvas', 'Design anything, from posters to apps', 'create', { suno: 1, icon: 'designer', size: '96 MB', rating: 4.8 });
  da('darkroom', 'Focus', 'Develop your photos like film', 'create', { suno: 1, icon: 'photo-editor', inst: 1, size: '88 MB', rating: 4.8 });
  da('reel', 'Reel', 'Edit video on a timeline that stays out of the way', 'create', { suno: 1, icon: 'video-editor', size: '140 MB' });
  da('sessions', 'Sessions', 'Record, arrange and mix music', 'create', { suno: 1, icon: 'daw', size: '212 MB', rating: 4.7 });
  da('memo', 'Memo', 'Voice notes that write themselves down', 'tools', { suno: 1, icon: 'memo', inst: 1, size: '14 MB' });
  da('camera', 'Camera', 'Photos and video from any camera', 'media', { suno: 1, icon: 'camera', inst: 1, size: '11 MB' });
  da('maps', 'Maps', 'Find your way, without being followed', 'tools', { suno: 1, icon: 'maps', size: '46 MB' });
  da('weather', 'Weather', 'The sky, at a glance', 'tools', { suno: 1, icon: 'weather', inst: 1, size: '6 MB' });
  da('vault', 'Vault', 'Passwords and passkeys, synced privately', 'tools', { suno: 1, icon: 'vault', size: '15 MB', rating: 4.9 });
  // Third party (monograms)
  da('blender', 'Blender', 'Free and open 3D creation', 'create', { mono: ['Bl', 30], size: '477 MB', rating: 4.8, reviews: 2890 });
  da('gimp', 'GIMP', 'High-end image editing', 'create', { mono: ['Gi', 45], size: '100 MB', rating: 4.3 });
  da('audacity', 'Audacity', 'Record and edit audio', 'create', { mono: ['Au', 260], size: '24 MB', rating: 4.5 });
  da('obsidian', 'Obsidian', 'Markdown notes that link together', 'work', { mono: ['Ob', 285], size: '231 MB', rating: 4.7, pk: 'flatpak' });
  da('signal', 'Signal', 'Private messenger', 'work', { mono: ['Si', 235], size: '165 MB', rating: 4.6 });
  da('libre', 'LibreOffice', 'The office suite, free forever', 'work', { mono: ['Lo', 150], size: '327 MB', rating: 4.2 });
  da('spotify', 'Spotify', 'Online music streaming', 'media', { mono: ['Sp', 145], size: '180 MB', rating: 4.4, pk: 'flatpak' });
  da('vlc', 'VLC', 'Plays everything', 'media', { mono: ['Vl', 55], size: '53 MB', rating: 4.7 });
  da('kodi', 'Kodi', 'Your media centre', 'media', { mono: ['Ko', 205], size: '96 MB', rating: 4.5 });
  da('obs', 'OBS Studio', 'Record and stream', 'media', { mono: ['Ob', 0, 1], size: '199 MB', rating: 4.6 });
  da('steam', 'Steam', 'Your games library', 'play', { mono: ['St', 225], size: '4 MB', rating: 4.6, reviews: 5120, pk: 'layered' });
  da('heroic', 'Heroic', 'Epic and GOG games', 'play', { mono: ['He', 250], size: '326 MB', rating: 4.5 });
  da('moonlight', 'Moonlight', 'Stream games from your PC', 'play', { mono: ['Mo', 180], size: '8 MB', rating: 4.6 });
  da('supertux', 'SuperTux', 'A classic side-scroller', 'play', { mono: ['Su', 95], size: '160 MB', rating: 4.4 });
  da('discord', 'Discord', 'Talk, play, hang out', 'work', { mono: ['Di', 265], size: '92 MB', rating: 4.3, pk: 'deb' });
  const app = id => DA.find(a => a.id === id);
  /* How each app is installed, which decides how it comes off (#35): part of Suno (can't be removed), a Suno app or a Flatpak, a universal
     .deb or .rpm (ADR-050), or a package layered onto the system (removed at the next restart) */
  const DSYS = ['filer', 'viola', 'terminal'], DPK = { system: 'Part of Suno', suno: 'Suno app', flatpak: 'Flatpak', deb: 'Universal .deb', rpm: 'Universal .rpm', layered: 'Layered package' };
  const dPk = a => DSYS.includes(a.id) ? 'system' : a.pk || (a.luma ? 'suno' : 'flatpak');
  const DS3 = { sort: { k: 'name', dir: 1 } };
  const DS2 = { view: 'discover', app: null, cat: null, q: '', hist: [], jobs: {}, sysUpd: 'ready', sysP: 0 };
  const dIcon = (a, sz = 56) => a.icon ? `<img class="dic" src="${A}${a.icon}.svg" alt="" style="width:${sz}px;height:${sz}px">` : `<span class="dic mono" style="width:${sz}px;height:${sz}px;--mh:${a.mono[1]};font-size:${Math.round(sz * .36)}px">${a.mono[0]}</span>`;
  const stars = r => `<span class="dstars" style="--r:${r / 5 * 100}%">★★★★★</span>`;
  function dBtn(a, big, key) { const j = DS2.jobs[a.id], k = big || key ? ' key' : '';
    if (j != null) return `<button class="dget run${big ? ' big' : ''}" type="button" data-dstop="${a.id}" aria-label="Installing ${j}%"><i class="ring round" style="--p:${j}"></i>${big ? `Installing ${j}%` : ''}</button>`;
    if (a.upd && a.inst) return `<button class="dget${big ? ' big' : ''} key" type="button" data-dupd="${a.id}">Update</button>`;
    return a.inst ? `<button class="dget${big ? ' big' : ''}${k}" type="button" data-dopen="${a.id}">Open</button>` : `<button class="dget${big ? ' big' : ''}${k}" type="button" data-dget="${a.id}">Get</button>`; }
  const tile = a => `<div class="dtile" data-dapp="${a.id}" role="button" tabindex="0"><div class="dtv" style="--hh:${a.mono ? a.mono[1] : 250}"${a.icon ? ` data-dhic="${a.icon}"` : ''}>${a.shot ? `<img src="depot/${a.shot}-dark.webp" alt="" loading="lazy">` : dIcon(a, 72)}</div><div class="dtb">${dIcon(a, 40)}<span class="dptx"><b>${esc(a.n)}</b><span>${esc(a.t)}</span></span>${dBtn(a)}</div></div>`;
  const li = a => `<div class="dli" data-dapp="${a.id}" role="button" tabindex="0">${dIcon(a, 48)}<span class="dptx"><b>${esc(a.n)}</b><span>${esc(a.t)}</span><em>${lCat(a.cat)}${stars(a.rating)}</em></span>${dBtn(a)}</div>`;
  const card = a => `<div class="dcard" data-dapp="${a.id}" role="button" tabindex="0">${lCat(a.cat)}${dIcon(a, 56)}<b>${esc(a.n)}</b><span>${esc(a.t)}</span>${dBtn(a)}</div>`;
  const row = a => `<div class="drow" data-dapp="${a.id}" role="button" tabindex="0">${dIcon(a, 48)}<span class="dptx"><b>${esc(a.n)}</b><span>${esc(a.t)}</span><em>${lCat(a.cat)}${a.size}</em></span>${dBtn(a)}</div>`;
  // two kinds of shelf: a list in columns (with hairlines), or cards that scroll sideways
  const shelf = (title, sub, list, kind = 'rows', more) => `<section class="dshelf"><header><h2>${title}</h2>${sub ? `<span>${sub}</span>` : ''}${more ? `<button class="dmore" type="button" ${more}>See all</button>` : ''}</header>${kind === 'tiles' ? `<div class="dcards hscroll">${list.map(card).join('')}</div>` : `<div class="dlist">${list.map(li).join('')}</div>`}</section>`;
  /* Depot on a phone, the way phone stores lay out: a page title, a row of feature cards you swipe (not a hero that
     fills the screen), then shelves: unframed app icons that scroll sideways, a ranked list with hairlines, categories. */
  const dNarrow = () => ($('#w-depot .ibody')?.clientWidth || 999) < 560;
  function discoverPhone() { const t = app('tide'), st = (k, h, kick, title, ids) => `<section class="dfc story" data-dcat="${k}" role="button" tabindex="0" style="--sh2:${h}"><div class="dfct"><span class="kick">${kick}</span><h3>${title}</h3></div><div class="dfcst">${ids.map(i => dIcon(app(i), 44)).join('')}</div></section>`;
    return `<header class="dph2"><h1>Discover</h1><p>Apps for Suno, checked and signed</p></header>
      <div class="dfeat">${`<section class="dfc" data-dapp="tide" role="button" tabindex="0" style="--hh:95"><img class="dfcbg" src="depot/tide-dark.png" alt=""><div class="dfct"><span class="kick">Editor’s choice</span><h3>Your music, from everywhere you keep it.</h3></div><div class="dfcapp">${dIcon(t, 40)}<span><b>Tide</b><small>Music · ${stars(t.rating)} ${t.rating}</small></span>${dBtn(t)}</div></section>`}${st('create', 25, 'Start a studio', 'Make music on Suno', ['sessions', 'audacity', 'tide'])}${st('play', 225, 'Game night', 'Your games already work here', ['steam', 'heroic', 'moonlight'])}</div>
      <section class="dshelf"><header><h2>Made for Suno</h2><button class="dmore" type="button" data-dcat="suno">See all</button></header><div class="dicons">${DA.filter(a => a.luma).slice(0, 10).map(a => `<div class="dic" data-dapp="${a.id}" role="button" tabindex="0">${dIcon(a, 64)}<b>${esc(a.n)}</b><span>${esc(DCAT[a.cat]?.[0] || '')}</span></div>`).join('')}</div></section>
      <section class="dshelf"><header><h2>Popular on Suno</h2></header><div class="dlist2">${['blender', 'obsidian', 'spotify', 'signal', 'vlc', 'steam', 'gimp', 'discord', 'libre'].map(app).map((a, i) => `<div class="dli2" data-dapp="${a.id}" role="button" tabindex="0"><em>${i + 1}</em>${dIcon(a, 52)}<span class="dptx"><b>${esc(a.n)}</b><span>${esc(a.t)}</span></span>${dBtn(a)}</div>`).join('')}</div></section>
      <section class="dshelf"><header><h2>Categories</h2></header><div class="dcatl">${Object.entries(DCAT).map(([k, [n, sub, h]]) => `<button class="dcl" type="button" data-dcat="${k}" style="--ch2:${h}"><i class="dcli">${ic(DCATIC[k])}</i><span><b>${n}</b><small>${sub}</small></span>${ic('chevron-right')}</button>`).join('')}</div></section>`; }
  function discover() { if (dNarrow()) return discoverPhone(); const hero = app('tide');
    return `<section class="dhero" data-dapp="tide" role="button" tabindex="0" style="--hh:95"><img class="dhbg" src="${PH}life-hero-studio.webp" alt=""><div class="dhtx"><span class="kick">Made for Suno · Editor’s choice</span><h1>Your music,<br>from everywhere<br>you keep it.</h1><p>Tide plays the files on this computer and your own music server, lit by whatever you’re listening to.</p>
        <div class="dhacts">${dBtn(hero, true)}<span class="dmeta">${stars(hero.rating)} ${hero.rating}</span></div></div><img class="dhshot" src="depot/tide-dark.png" alt=""></section>
      ${shelf('Made for Suno', 'Free, private, and they work together', DA.filter(a => a.luma).slice(0, 10), 'tiles', 'data-dcat="suno"')}
      <div class="dstories">
        <section class="dstory" style="--sh2:25" data-dcat="create" role="button" tabindex="0"><span class="kick">Start a studio</span><h3>Make music on Suno</h3><p>Record in Sessions, clean up in Audacity, and master anywhere. No subscriptions.</p><div class="dstack">${['sessions', 'audacity', 'tide'].map(i => dIcon(app(i), 52)).join('')}</div></section>
        <section class="dstory" style="--sh2:225" data-dcat="play" role="button" tabindex="0"><span class="kick">Game night</span><h3>Your games already work here</h3><p>Steam, Epic and GOG libraries run as they are. Stream the rest from your PC.</p><div class="dstack">${['steam', 'heroic', 'moonlight'].map(i => dIcon(app(i), 52)).join('')}</div></section></div>
      ${shelf('Popular on Suno', 'What people install first', ['blender', 'obsidian', 'spotify', 'signal', 'vlc', 'steam', 'gimp', 'discord', 'libre'].map(app))}
      <section class="dshelf"><header><h2>Categories</h2></header><div class="dcatl">${Object.entries(DCAT).map(([k, [n, s, h]]) => `<button class="dcl" type="button" data-dcat="${k}" style="--ch2:${h}"><i class="dcli">${ic(DCATIC[k])}</i><span><b>${n}</b><small>${s}</small></span>${lCount(DA.filter(a => a.cat === k).length)}</button>`).join('')}</div></section>`; }
  function catPage(k) { if (k === 'suno') return `<header class="dph" style="--ch2:25"><img class="dphic" src="${FAV}" alt=""><span><h1>Made for Suno</h1><p>Free, private, and they work together · ${DA.filter(a => a.luma).length} apps</p></span></header>${shelf('', '', DA.filter(a => a.luma))}`;
    const [n, s, h] = DCAT[k], l = DA.filter(a => a.cat === k);
    return `<header class="dph" style="--ch2:${h}"><i class="dcli big">${ic(DCATIC[k])}</i><span><h1>${n}</h1><p>${s} · ${l.length} apps</p></span></header>${l.some(a => a.luma) ? shelf('Made for Suno', '', l.filter(a => a.luma), 'tiles') : ''}${l.some(a => !a.luma) ? shelf(l.some(a => a.luma) ? 'From other developers' : 'Everything in ' + n, '', l.filter(a => !a.luma)) : ''}`; }
  function appPage(id) { const a = app(id), rv = [['PR', 'Priya', 'Finally, my Navidrome server and my laptop in one place. The album colour thing is gorgeous.'], ['TH', 'Theo', 'Gapless playback that actually works. The queue survives a restart.']];
    return `<section class="dapp" style="--hh:${a.hue ?? (a.mono ? a.mono[1] : 250)}" data-dhue="${a.icon || ''}">${a.icon ? `<img class="dappbg" src="${A}${a.icon}.svg" alt="">` : '<i class="dappbg mono"></i>'}<div class="dapph">${dIcon(a, 108)}<div class="dapptx"><h1>${esc(a.n)}</h1><span class="dmk">${a.luma ? `Suno ${VERIF}` : 'Community package'}${lCat(a.cat)}</span><p>${esc(a.t)}</p>
        <div class="dhacts">${dBtn(a, true)}${a.inst ? dMoreBtn(a, 'big') : ''}${a.inst ? `<span class="dinst">${ic('check')}${a.luma ? 'Installed with Suno' : 'Installed'}</span>` : `<span class="dinst">${a.size}</span>`}</div></div></div>
      <div class="dfacts"><div><b>${a.rating}</b>${stars(a.rating)}<span>${a.reviews.toLocaleString()} ratings</span></div><div><b>${a.size}</b><span>Size</span></div><div><b>${a.luma ? 'Suno' : 'GPL 3.0'}</b><span>${a.luma ? 'Made by' : 'License'}</span></div><div><b>${a.inst ? DPK[dPk(a)] : a.luma ? 'Suno app' : 'Flatpak'}</b><span>Package</span></div></div></section>
      <div class="dshots3">${(a.shot ? [`depot/${a.shot}-dark.webp`, `depot/${a.shot}-light.webp`, `depot/${a.shot}-dark.webp`] : (() => { const L = ['life-hero-studio', 'life-work-suite', 'life-suite-bg-canvas', 'life-hero-home', 'life-sync-terrace', 'life-suite-bg-sessions', 'life-professionals-loft', 'life-ari-street'], k = DA.indexOf(a); return [0, 1, 2].map(i => PH + L[(k + i * 3) % L.length] + '.webp'); })()).map((src, i) => `<img src="${src}" alt="${esc(a.n)}, screenshot ${i + 1}" loading="lazy">`).join('')}</div>
      <div class="dcols"><section><h2>Description</h2><p class="dp">${esc(a.t)}. ${a.luma ? 'It comes with Suno, updates with Suno, and works with the rest of your apps: share from anywhere, find it in search, and pick up where you left off on your phone.' : 'It’s packaged for Suno and kept up to date automatically. Updates are checked and signed before they reach you.'}</p>
          <h2>Ratings and reviews</h2><div class="drevs">${rv.map(([k, n, t]) => `<div class="drev">${av(k, 28)}<span><b>${n}</b>${stars(5)}<p>${t}</p></span></div>`).join('')}</div></section>
        <section><h2>Details</h2><dl class="facts dwell">${[['Version', a.luma ? '1.0 (nightly 0922)' : '2.4.1'], ['Updated', 'Sep 22, 2026'], ['Size', a.size], ['Made by', a.luma ? 'Suno' : a.n + ' developers'], ['License', a.luma ? 'Apache 2.0' : 'GPL 3.0'], ['Package', a.inst ? DPK[dPk(a)] : a.luma ? 'Suno app' : 'Flatpak']].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section></div>
      ${shelf(a.luma ? 'More from Suno' : 'You might also like', '', DA.filter(x => x.cat === a.cat && x.id !== a.id).slice(0, 4), 'tiles')}`; }
  /* Your apps is a list view, so it uses the SunoUI table header (#2): sort by name, category, how it's installed or size. Each row has
     Open and ··· (Uninstall, #35) */
  const dMoreBtn = (a, cls = '') => `<button class="ib dmorebtn ${cls}" type="button" data-dmenu="${a.id}" aria-label="More for ${esc(a.n)}" title="More" aria-haspopup="menu">${ic('ellipsis')}</button>`;
  function yours() { const l = DA.filter(a => a.inst), { k, dir } = DS3.sort, sz = a => parseFloat(a.size) * (/GB/.test(a.size) ? 1e3 : 1) || 0;
    const s = [...l].sort((a, b) => dir * (k === 'size' ? sz(a) - sz(b) : k === 'cat' ? DCAT[a.cat][0].localeCompare(DCAT[b.cat][0]) : k === 'kind' ? DPK[dPk(a)].localeCompare(DPK[dPk(b)]) : a.n.localeCompare(b.n)));
    return `<header class="dph"><span><h1>Your apps</h1><p>${l.length} on this computer. Suno apps update with the system; the rest update on their own.</p></span></header>
      <table class="flist dtab">${lTHead([['name', 'Name'], ['cat', 'Category'], ['kind', 'Installed as', 'wide'], ['size', 'Size', 'num'], ['', '', 'act']], DS3.sort, 'data-dsort')}<tbody>${s.map(a => `<tr data-dapp="${a.id}" tabindex="0"><td class="n"><span>${dIcon(a, 28)}${esc(a.n)}</span></td><td>${lCat(a.cat)}</td><td class="dim wide">${DPK[dPk(a)]}</td><td class="dim num">${a.size}</td><td class="act"><span>${dBtn(a)}${dMoreBtn(a)}</span></td></tr>`).join('')}</tbody></table>`; }
  /* Uninstall, for every kind of install, through the standard destructive dialog; data stays unless you say so. Part of Suno says why instead */
  function dUninstall(id) { const a = app(id), pk = dPk(a), win = $('#w-depot'); if (pk === 'system') return;
    const body = { layered: `${a.n} comes off the next time you restart. Until then it keeps working.`, deb: `${a.n} and the parts it installed with it are removed from this computer.`, rpm: `${a.n} and the parts it installed with it are removed from this computer.` }[pk] || `${a.n} is removed from this computer. You can get it again from Depot.`;
    lConfirm(win, { title: `Uninstall ${a.n}?`, body, action: 'Uninstall', icon: 'trash-2', option: 'Also remove its data', onOK: data => { a.inst = 0; delete a.upd; depRender(true);
      lToast(win, pk === 'layered' ? `${a.n} comes off when you restart${data ? ', with its data' : ''}` : `${a.n} uninstalled${data ? ' with its data' : '. Its data is kept'}`, { icon: 'trash-2' }); } }); }
  function updates() { const u = DA.filter(a => a.upd && a.inst), sp = DS2.sysUpd;
    return `<section class="dsys"><i class="dsysbg"></i><div class="dsysh"><img src="${FAV}" alt=""><span><span class="kick">System update</span><h1>SunoOS 0.1 · nightly September 22</h1><p>Adjustable scroll speed for mice and touchpads, plus 14 more changes.</p></span></div>
        ${sp === 'ready' ? `<div class="dhacts"><button class="dget big key" type="button" data-dsys>Update now</button><button class="bt dnewb${DS2.news ? ' on' : ''}" type="button" data-dnew>What’s new${ic('chevron-down')}</button><span class="dinst">312 MB · you can keep working</span></div>`
          : sp === 'run' ? `<div class="dprog"><i style="width:${DS2.sysP}%"></i></div><p class="dinst">Downloading ${DS2.sysP}% · you can keep working. Suno asks before it restarts.</p>`
          : `<div class="dhacts"><button class="dget big key" type="button" data-dtodo="Restarting into SunoOS 0.1 nightly 0922…">Restart now</button><span class="dinst">${ic('check')}Ready. Restart whenever you like.</span></div>`}
        ${DS2.news ? `<div class="dsnotes">${[['Feature', 'sparkles', 'Adjustable scroll speed', 'Set how fast mice and touchpads scroll, in Settings › Mouse and touchpad.'], ['Improvement', 'folder', 'Filer’s tray remembers', 'What you were carrying is still there after a restart.'], ['Improvement', 'music-2', 'Tide fades between tracks', 'Choose how long in Tide’s settings, or turn it off.'], ['Improvement', 'zap', 'Faster wake from sleep', 'Opening the lid gets you back to work about a second sooner.'], ['Fix', 'wrench', '11 fixes', 'For things you told us about, from Calendar to Quick Options.'], ['Security', 'shield-check', '2 security fixes', 'Both in system libraries. Nothing you need to do.']].map(([k, i, t, d]) => `<div class="dsnote dsk-${k.toLowerCase()}"><i>${ic(i)}</i><span><em>${k}</em><b>${t}</b><small>${d}</small></span></div>`).join('')}</div><button class="dfull" type="button" data-dtodo="The full notes open in Viola">Read the full release notes${ic('chevron-right')}</button>` : ''}</section>
      ${u.length ? `<section class="dshelf"><header><h2>Apps</h2><span>${u.length} update${u.length > 1 ? 's' : ''}</span><button class="dget key dupall" type="button" data-dupall>Update all</button></header><div class="dupds">${u.map(a => `<div class="dupd" data-dapp="${a.id}" role="button" tabindex="0">${dIcon(a, 48)}<span class="dptx"><b>${esc(a.n)}</b><span>1.0.159 → ${a.upd} · ${a.size}</span><em>Faster start-up and a fix for screen sharing</em></span>${dBtn(a)}</div>`).join('')}</div></section>` : `<section class="dshelf"><header><h2>Apps</h2></header><p class="dallup">${ic('check')}Every app is up to date</p></section>`}
      <section class="dshelf"><header><h2>Recently updated</h2></header><div class="drows">${[].map(([i, v, w]) => `<div class="drow quiet">${dIcon(app(i), 36)}<span class="dptx"><b>${app(i).n}</b><span>Updated automatically · ${v} · ${w}</span></span><button class="dget" type="button" data-dtodo="Went back to the previous version of ${app(i).n}">Go back</button></div>`).join('')}</div></section>
      <section class="dshelf"><header><h2>This computer</h2></header><dl class="facts dwell">${[['Running', 'SunoOS 0.1 · nightly September 16'], ['Channel', 'Nightly'], ['Updates from', 'dl.simplyluma.com'], ['Signature', `${ic('shield-check')}Verified`], ['Last checked', '6 hours ago']].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>`; }
  function results() { const q = DS2.q.toLowerCase(), l = DA.filter(a => (a.n + ' ' + a.t + ' ' + DCAT[a.cat][0]).toLowerCase().includes(q));
    return `<header class="dph"><span><h1>${l.length ? `${l.length} result${l.length > 1 ? 's' : ''}` : 'No results'}</h1><p>for “${esc(DS2.q)}”</p></span></header>${l.length ? shelf('', '', l) : `<p class="dempty">Try a different word, or browse a category.</p>`}`; }
  function depRender(keep) { const b = $('#dp-body'), v = DS2.view, top = b.scrollTop;
    const bk = DS2.hist.length && (v === 'app' || v === 'cat'), prev = DS2.hist[DS2.hist.length - 1], bl = !prev ? 'Back' : prev.view === 'cat' ? (prev.cat === 'suno' ? 'Made for Suno' : DCAT[prev.cat][0]) : prev.view === 'app' ? app(prev.app).n : { discover: 'Discover', apps: 'Your apps', updates: 'Updates' }[prev.view];
    b.innerHTML = `<div class="dpad">${bk && !DS2.q ? `<button class="dbk" type="button" data-dback aria-label="Back to ${esc(bl)}"><i class="dbki">${ic('chevron-left')}</i><span>${esc(bl)}</span></button>` : ''}${DS2.q ? results() : v === 'app' ? appPage(DS2.app) : v === 'cat' ? catPage(DS2.cat) : v === 'apps' ? yours() : v === 'updates' ? updates() : discover()}</div>`; b.scrollTop = keep ? top : 0;
    $('#dp-back').hidden = true;
    $$('#dp-body .dtv[data-dhic]').forEach(el => sampleHue(`${A}${el.dataset.dhic}.svg`, h => el.style.setProperty('--hh', h)));
    const ah = $('#dp-body .dapp'); if (ah?.dataset.dhue) sampleHue(`${A}${ah.dataset.dhue}.svg`, h => ah.style.setProperty('--hh', h));
    dSide(); }
  function dSide() { const u = DA.filter(a => a.upd && a.inst).length + (DS2.sysUpd !== 'done' ? 1 : 0), cur = DS2.q ? null : DS2.view === 'cat' ? 'cat:' + DS2.cat : DS2.view;
    const it = (k, icn, n, attr, em = '') => `<button class="si${cur === k ? ' on' : ''}" type="button" ${attr}>${icn}<span class="lab">${n}</span>${em}</button>`, q = $('#dp-q'), had = document.activeElement === q;
    $('#dp-side').innerHTML = `<div class="scr">${it('discover', ic('star'), 'Discover', 'data-dview="discover"')}${it('apps', ic('layout-grid'), 'Your apps', 'data-dview="apps"')}${it('updates', ic('download'), 'Updates', 'data-dview="updates"', lCount(u, true))}
      <div class="sh dpsh">Categories</div>${Object.entries(DCAT).map(([k, [n]]) => it('cat:' + k, `<i class="dsi" style="--ch2:${DCAT[k][2]}">${ic(DCATIC[k])}</i>`, n, `data-dcat="${k}"`)).join('')}</div>
      <div class="shead sfoot dpfoot"><label class="srch">${ic('search')}<input id="dp-q" placeholder="Search apps" aria-label="Search apps" value="${esc(DS2.q)}"></label></div>`;
    const qi = $('#dp-q'); qi.oninput = () => { DS2.q = qi.value.trim(); depRender(); }; qi.onkeydown = e => { if (e.key === 'Escape') { qi.value = ''; DS2.q = ''; depRender(); } }; if (had) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }  dPhBar(u, cur); }
  /* Depot on a phone (under 560): a store's tab bar at the thumb. Discover, Your apps and Updates (with its count),
     Browse (the categories, in the drawer) and Search, which turns the bar into the search field in place. */
  function dPhBar(u, cur) { const w = $('#w-depot'), nw = ($('#w-depot .ibody')?.clientWidth || 999) < 560; w.classList.toggle('dpnarrow', nw); let bar = $('#dp-phbar');
    if (!nw) { bar?.remove(); return; } if (!bar) { $('#dp-main').insertAdjacentHTML('beforeend', '<div class="fbar dpphbar" id="dp-phbar" role="tablist" aria-label="Depot"></div>'); bar = $('#dp-phbar'); }
    const had = document.activeElement?.id === 'dp-pq';
    if (DS2.searching || DS2.q) { bar.classList.add('dpsearching'); bar.innerHTML = `<label class="srch dppq">${ic('search')}<input id="dp-pq" placeholder="Apps and games" value="${esc(DS2.q)}" aria-label="Search apps"></label><button class="ib" type="button" data-dpsearchx aria-label="Close search">${ic('x')}</button>`;
      const q = $('#dp-pq'); q.oninput = () => { DS2.q = q.value.trim(); depRender(); }; q.onkeydown = e => { if (e.key === 'Escape') { DS2.q = ''; DS2.searching = false; depRender(); } }; if (had || DS2.searching) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } return; }
    bar.classList.remove('dpsearching'); bar.classList.add('phnofit', 'dpph2'); const X = DS2.px || '';
    const tv = cur && !String(cur).startsWith('cat:') ? cur : DS2.view === 'app' ? (DS2.hist[0]?.view || 'discover') : DS2.view === 'cat' ? 'cat' : 'discover';
    const SEC = { discover: ['star', 'Discover'], apps: ['layout-grid', 'Your apps'], updates: ['download', 'Updates'], cat: [DCATIC[DS2.cat] || 'compass', DS2.cat === 'suno' ? 'Made for Suno' : DCAT[DS2.cat]?.[0] || 'Browse'] }[tv] || ['star', 'Discover'];
    const panel = X === 'sec' ? `<div class="fexp dpsec"><div class="fsha c3">${[['discover', 'star', 'Discover'], ['apps', 'layout-grid', 'Your apps'], ['updates', 'download', 'Updates']].map(([k, i, n]) => `<button type="button" class="fvt${tv === k ? ' on' : ''}" data-dview="${k}">${ic(i)}<span>${n}${k === 'updates' && u ? ` · ${u}` : ''}</span></button>`).join('')}</div><div class="fexh">Categories</div>${Object.entries(DCAT).map(([k, [n, sub, h]]) => `<button class="fexr2${DS2.view === 'cat' && DS2.cat === k ? ' on' : ''}" type="button" data-dcat="${k}"><i class="dcli" style="--ch2:${h}">${ic(DCATIC[k])}</i><span>${n}<small>${sub}</small></span></button>`).join('')}</div>` : '';
    bar.classList.toggle('phgrow', !!panel); bar.classList.remove('dpappbar');
    if (DS2.view === 'app' && !panel) { const a = app(DS2.app); bar.classList.add('dpappbar');
      bar.innerHTML = `<span class="dpappid">${dIcon(a, 32)}<span><b>${esc(a.n)}</b><small>${a.inst ? (a.luma ? 'Installed with Suno' : 'Installed') : a.size}</small></span></span><span class="sp"></span><button class="ib" type="button" data-ctodo="Sharing ${esc(a.n)}" data-dshare="${a.id}" aria-label="Share ${esc(a.n)}" title="Share">${ic('share-2')}</button>${a.inst && dPk(a) !== 'system' ? `<button class="ib dpun" type="button" data-dun="${a.id}" aria-label="Uninstall ${esc(a.n)}" title="Uninstall">${ic('trash-2')}</button>` : ''}${dBtn(a, false, true)}`; return; }   /* the menu only ever held Uninstall, so the bar shows it directly; system apps can't be uninstalled and show nothing */
    bar.innerHTML = `${panel}<button class="dpsec2${X === 'sec' ? ' on' : ''}" type="button" data-dppx="sec" aria-expanded="${X === 'sec'}">${ic(SEC[0])}<b>${esc(SEC[1])}</b>${u && tv !== 'updates' ? `<em class="tbadge dpsecb">${u}</em>` : ''}${ic('chevron-down')}</button><span class="sp"></span><button class="ib" type="button" data-dpsearch aria-label="Search" title="Search">${ic('search')}</button>`; }
  function dBar() { return dSide(); const u = DA.filter(a => a.upd && a.inst).length + (DS2.sysUpd !== 'done' ? 1 : 0), cur = DS2.q ? null : ['discover', 'apps', 'updates'].includes(DS2.view) ? DS2.view : null;
    if (!$('#dp-q')) setBar($('#dp-bar'), `<span id="dp-bk"></span><div class="seg" role="group" aria-label="Depot"><i class="ind"></i><button type="button" data-dview="discover">${ic('star')}Discover</button><button type="button" data-dview="apps">${ic('layout-grid')}Your apps</button><button type="button" data-dview="updates">${ic('download')}Updates<em class="dbadge" id="dp-ub"></em></button></div>
      <span class="vr dgap"></span><label class="dsearch">${ic('search')}<input id="dp-q" placeholder="Search apps" aria-label="Search apps"></label>`);
    const bk = DS2.hist.length && (DS2.view === 'app' || DS2.view === 'cat'); $('#dp-bk').innerHTML = bk ? `<button class="ib" type="button" data-dback title="Back" aria-label="Back">${ic('chevron-left')}</button><span class="vr dgap"></span>` : '';
    $$('#dp-bar [data-dview]').forEach(x => x.classList.toggle('on', x.dataset.dview === cur)); $('#dp-bar .seg .ind').style.opacity = cur ? 1 : 0; requestAnimationFrame(segs);
    const ub = $('#dp-ub'); ub.textContent = u || ''; ub.hidden = !u;
    const q = $('#dp-q'); q.oninput = () => { DS2.q = q.value.trim(); depRender(); }; q.onkeydown = e => { if (e.key === 'Escape') { q.value = ''; DS2.q = ''; depRender(); } }; }
  function go2(view, extra = {}) { if (!DS2.q) DS2.hist.push({ view: DS2.view, app: DS2.app, cat: DS2.cat }); Object.assign(DS2, { view, ...extra }); DS2.q = ''; depRender(); }
  function install(id, upd) { const a = app(id); DS2.jobs[id] = 0; depRender(true);
    const t = setInterval(() => { DS2.jobs[id] = Math.min(100, DS2.jobs[id] + 7 + Math.round(Math.random() * 9)); if (DS2.jobs[id] >= 100) { clearInterval(t); delete DS2.jobs[id]; a.inst = 1; if (upd) delete a.upd; dToast(`${a.n} is ${upd ? 'up to date' : 'installed'}`); } depRender(true); }, 160); }
  const dToast = msg => lToast($('#w-depot'), msg, { icon: /^Opening/.test(msg) ? 'square-arrow-out-up-right' : 'check' });   // the SunoUI toast
  function depClick(e, hit) { if (hit('#lmenu .crmi')) setTimeout(() => $('#lmenu')?.remove());
    if (dNarrow()) { const px = hit('[data-dppx]'); if (px) { DS2.px = DS2.px === 'sec' ? '' : 'sec'; dSide(); return true; } if (hit('[data-dview]') || hit('[data-dcat]') || hit('[data-dpsearch]') || hit('[data-dapp]')) DS2.px = ''; }
    const g = hit('[data-dget]'); if (g) { e.stopPropagation(); install(g.dataset.dget); return true; }
    const up = hit('[data-dupd]'); if (up) { e.stopPropagation(); install(up.dataset.dupd, true); return true; }
    if (hit('[data-dupall]')) { DA.filter(a => a.upd && a.inst).forEach(a => install(a.id, true)); return true; }
    if (hit('[data-dback]')) { const h = DS2.hist.pop(); if (h) Object.assign(DS2, h); depRender(); return true; }
    const op = hit('[data-dopen]'); if (op) { e.stopPropagation(); dToast(`Opening ${app(op.dataset.dopen).n}`); return true; }
    if (hit('[data-dstop]')) { e.stopPropagation(); return true; }
    const so = hit('[data-dsort]'); if (so) { const k = so.dataset.dsort; if (k) { DS3.sort = { k, dir: DS3.sort.k === k ? -DS3.sort.dir : 1 }; depRender(true); $(`#dp-body [data-dsort="${k}"]`)?.focus(); } return true; }
    const dm = hit('[data-dmenu]'); if (dm) { e.stopPropagation(); if ($('#lmenu') && dMenu.b === dm) { $('#lmenu').remove(); dMenu.b = null; return true; } dMenu.b = dm; dMenu(dm, app(dm.dataset.dmenu)); return true; }
    const un = hit('[data-dun]'); if (un) { $('#lmenu')?.remove(); dUninstall(un.dataset.dun); return true; }
    if (hit('#lmenu .dsysnote')) return true;
    const v = hit('[data-dview]'); if (v) { DS2.hist = []; DS2.view = v.dataset.dview; DS2.q = ''; depRender(); return true; }
    if (hit('[data-dpsearch]')) { DS2.searching = true; depRender(); return true; }
    if (hit('[data-dpsearchx]')) { DS2.searching = false; DS2.q = ''; depRender(); return true; }
    const dtab = hit('[data-dptab]'); if (dtab) { DS2.hist = []; DS2.q = ''; DS2.searching = false; DS2.view = dtab.dataset.dview; depRender(); return true; }
    const c = hit('[data-dcat]'); if (c) { $('#w-depot').classList.remove('navopen'); if (c.closest('#dp-side')) { DS2.hist = [{ view: 'discover' }]; DS2.view = 'cat'; DS2.cat = c.dataset.dcat; DS2.q = ''; depRender(); return true; } go2('cat', { cat: c.dataset.dcat }); return true; }
    const ap = hit('[data-dapp]'); if (ap) { go2('app', { app: ap.dataset.dapp }); return true; }
    if (hit('#dp-back')) { const h = DS2.hist.pop(); if (h) Object.assign(DS2, h); depRender(); return true; }
    if (hit('[data-dsys]')) { DS2.sysUpd = 'run'; DS2.sysP = 0; depRender(true); const t = setInterval(() => { DS2.sysP = Math.min(100, DS2.sysP + 6); if (DS2.sysP >= 100) { clearInterval(t); DS2.sysUpd = 'done'; } if (DS2.view === 'updates') depRender(true); else dBar(); }, 200); return true; }
    if (hit('[data-dnew]')) { DS2.news = !DS2.news; depRender(true); return true; }
    const td = hit('[data-dtodo]'); if (td) { dToast(td.dataset.dtodo); return true; }
    return false; }
  const VERIF = SVG['badge-check'];
  function dMenu(b, a) { const sys = dPk(a) === 'system';
    lMenu(b, `${DS2.view === 'app' ? '' : crMi(`data-dapp="${a.id}"`, 'info', 'About this app') + '<span class="crsep"></span>'}${sys
      ? `<div class="dsysnote">${ic('lock')}<span><b>Part of Suno</b><small>${esc(a.n)} comes with the system and updates with it, so it can't be uninstalled.</small></span></div>`
      : crMi(`data-dun="${a.id}"`, 'trash-2', 'Uninstall\u2026', ' red')}`); }
  /* Depot, next (22 Oct 2026): apps/depot/ draws Depot now; it gets the shared parts it needs and nothing else. The code above
     stays for Settings, which reads Depot's categories through app(). */
  if (window.LumaDepot) { const DK = { A, ic, esc, seg: (...a) => seg(...a), segs: () => segs(), setBar: (...a) => setBar(...a), lSideBtn: w => lSideBtn(w), lCount: (...a) => lCount(...a), lTHead: (...a) => lTHead(...a),
      lToast: (...a) => lToast(...a), lConfirm: (...a) => lConfirm(...a), lMenu: (...a) => lMenu(...a), crMi: (...a) => crMi(...a), shOpen: b => shOpen(b), sampleHue: (s, cb) => sampleHue(s, cb), front: () => front(), open: id => window.lumaPhone && $('#w-depot').classList.contains('phone') ? lumaPhone.open(id) : dtOpen(id) };
    renderDepot = () => LumaDepot.render(DK); depRender = () => LumaDepot.render(); depClick = (e, hit) => LumaDepot.click(e, hit); }
  /* Discord (third-party client mockup): apps/discord/ draws it, handed only the shared parts it uses */
  /* Huddle: apps/huddle/ draws it, handed only the shared parts it uses */
  function renderHuddle() { if (window.LumaHuddle) LumaHuddle.render({ A, ic, esc, lSideBtn: w => lSideBtn(w), lToast: (...a) => lToast(...a), lMenu: (...a) => lMenu(...a), segs: () => segs(), front: () => front() }); }
  function renderDiscord() { if (window.LumaDiscord) LumaDiscord.render({ A, ic, esc, PPL, av: (k, sz) => av(k, sz), lToast: (...a) => lToast(...a), lMenu: (...a) => lMenu(...a), crMi: (...a) => crMi(...a), lCount: (...a) => lCount(...a), front: () => front() }); }
  function renderDepot() { const w = $('#w-depot'); w.classList.toggle('lsideoff', !lSideOn(w)); $('#dp-top').innerHTML = `<img src="${A}app-store.svg" alt=""><b>Depot</b><span class="chev">${ic('chevron-down')}</span>${lSideBtn(w)}`; $('#dp-back').innerHTML = ic('chevron-left'); depRender();
    document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'depot') return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); $('#dp-q').focus(); } else if (e.key === 'Escape' && !e.target.closest('input') && DS2.hist.length) $('#dp-back').click(); }); }

  const WP2 = [
    { id: 'oak', n: 'Oakland', r: 'California', off: 0, base: 62, amp: 9, rain: [18, 21], rise: 421, set: 1142, aq: 28, uv: 5, wind: [11, 250], hum: 64, me: 1 },
    { id: 'lis', n: 'Lisbon', r: 'Portugal', off: 8, base: 74, amp: 8, rain: null, rise: 441, set: 1181, aq: 19, uv: 7, wind: [8, 320], hum: 52 },
    { id: 'tok', n: 'Tokyo', r: 'Japan', off: 16, base: 71, amp: 6, rain: [2, 9], rise: 330, set: 1080, aq: 41, uv: 3, wind: [6, 40], hum: 78 },
    { id: 'sac', n: 'Sacramento', r: 'California', off: 0, base: 78, amp: 13, rain: null, rise: 418, set: 1135, aq: 35, uv: 7, wind: [5, 180], hum: 38 } ];
  const WS2 = { place: 'oak', sel: null, unit: 'F' };
  const wpl = () => WP2.find(p => p.id === WS2.place);
  const localNow = p => (nowMin() + p.off * 60 + 1440) % 1440;
  const tempAt = (p, m) => p.base + p.amp * Math.sin(((m / 60) - 9) / 24 * 2 * Math.PI) - (p.rain && m / 60 >= p.rain[0] && m / 60 < p.rain[1] ? 4 : 0);
  const condAt = (p, m) => { const h = (m / 60) % 24; if (p.rain && h >= p.rain[0] - 1 && h < p.rain[0]) return 'cloud'; if (p.rain && h >= p.rain[0] && h < p.rain[1]) return 'rain'; if (p.id === 'tok' && h >= 10 && h < 16) return 'part'; return 'clear'; };
  const rainPct = (p, m) => { const h = (m / 60) % 24; return p.rain && h >= p.rain[0] && h < p.rain[1] ? Math.round(40 + 40 * Math.sin((h - p.rain[0] + .5) / (p.rain[1] - p.rain[0]) * Math.PI)) : 0; };
  const deg = f => WS2.unit === 'F' ? Math.round(f) : Math.round((f - 32) * 5 / 9);
  const hm = m => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return `${(h % 12) || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };
  const hh = m => { const h = Math.floor(((m % 1440) + 1440) % 1440 / 60); return `${(h % 12) || 12} ${h < 12 ? 'AM' : 'PM'}`; };
  const isNight = (p, m) => m < p.rise || m > p.set;
  const skyKind = (p, m) => { const c = condAt(p, m); if (c === 'rain' || c === 'cloud') return 'r'; if (m < p.rise - 25 || m > p.set + 25) return 'n'; return Math.min(Math.abs(m - p.rise), Math.abs(m - p.set)) < 75 ? 'g' : 'd'; };
  const CW = { clear: 'Clear', part: 'Partly cloudy', cloud: 'Cloudy', rain: 'Light rain' };
  const GL = { sun: '<circle cx="16" cy="16" r="6.5" style="fill:#ffc93d"/><g style="stroke:#ffc93d" stroke-width="2.2" stroke-linecap="round"><path d="M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3M7.2 7.2l2.1 2.1M22.7 22.7l2.1 2.1M7.2 24.8l2.1-2.1M22.7 9.3l2.1-2.1"/></g>',
    moon: '<path d="M22.5 20.6A9.5 9.5 0 0 1 12 6.2a10 10 0 1 0 13.8 13.1 9.4 9.4 0 0 1-3.3 1.3Z" style="fill:var(--gm)"/>',
    cloud: '<path d="M9.5 25h13.2a5.3 5.3 0 0 0 .8-10.5 7.8 7.8 0 0 0-14.8 1.9A4.4 4.4 0 0 0 9.5 25Z" style="fill:var(--gc)"/>',
    rain: '<path d="M9.5 20h13.2a5.3 5.3 0 0 0 .8-10.5A7.8 7.8 0 0 0 8.7 11.4 4.4 4.4 0 0 0 9.5 20Z" style="fill:var(--gc)"/><g style="stroke:#4aa8f5" stroke-width="2.2" stroke-linecap="round"><path d="M11 23.5l-1.4 3.5M16 23.5l-1.4 3.5M21 23.5l-1.4 3.5"/></g>',
    part: '<circle cx="12" cy="12" r="5.5" style="fill:#ffc93d"/><g style="stroke:#ffc93d" stroke-width="2" stroke-linecap="round"><path d="M12 1.4v2.6M12 20v2.6M1.4 12h2.6M20 12h2.6M4.5 4.5l1.84 1.84M19.5 4.5l-1.84 1.84M4.5 19.5l1.84-1.84M17.66 17.66l1.84 1.84"/></g><path d="M11.5 27h12a4.8 4.8 0 0 0 .7-9.5 7 7 0 0 0-13.3 1.7 3.9 3.9 0 0 0 .6 7.8Z" style="fill:var(--gc)"/>',
    ncloud: '<path d="M17 8.5a6.5 6.5 0 0 1-6.3 8.2A7 7 0 0 0 16.5 12Z" style="fill:var(--gm)"/><path d="M11.5 27h12a4.8 4.8 0 0 0 .7-9.5 7 7 0 0 0-13.3 1.7 3.9 3.9 0 0 0 .6 7.8Z" style="fill:var(--gc)"/>' };
  const glyph = (c, m, p, sz = 26) => { const n = isNight(p, m), k = c === 'clear' ? (n ? 'moon' : 'sun') : c === 'part' && n ? 'ncloud' : c; return `<svg class="wgl" width="${sz}" height="${sz}" viewBox="0 0 32 32" aria-hidden="true">${GL[k]}</svg>`; };
  const hiLo = p => { const d = Array.from({ length: 24 }, (_, k) => tempAt(p, k * 60)); return [Math.max(...d), Math.min(...d)]; };
  function sentence(p) { const now = localNow(p);
    if (p.rain && now / 60 < p.rain[1]) return now / 60 < p.rain[0] ? `Dry for now. Light rain from around ${hh(p.rain[0] * 60)}, gone by ${hh(p.rain[1] * 60)}.` : `Light rain until about ${hh(p.rain[1] * 60)}, then clearing.`;
    return isNight(p, now) ? 'A clear, quiet night. Cool by morning.' : 'Clear and dry all day. A cool evening.'; }
  const week = p => Array.from({ length: 10 }, (_, k) => { const sh = [0, 3, -2, -4, 1, 5, 6, 2, -1, 0][k], cond = p.id === 'oak' ? ['rain', 'part', 'clear', 'clear', 'cloud', 'clear', 'clear', 'part', 'rain', 'clear'][k] : p.id === 'tok' ? ['rain', 'rain', 'part', 'cloud', 'clear', 'clear', 'part', 'rain', 'cloud', 'clear'][k] : ['clear', 'clear', 'part', 'clear', 'clear', 'clear', 'part', 'clear', 'clear', 'cloud'][k];
    return { k, lo: p.base - p.amp + sh - 1, hi: p.base + p.amp + sh, c: cond, r: cond === 'rain' ? [40, 70, 55][k % 3] : 0 }; });
  function weekRows(p) { const d = week(p), mn = Math.min(...d.map(x => x.lo)), mx = Math.max(...d.map(x => x.hi)), nowT = tempAt(p, localNow(p));
    return d.map(x => `<div class="wkr"><b>${x.k ? dOf(TODAY + x.k).toLocaleDateString([], { weekday: 'short' }) : 'Today'}</b><span class="wki">${glyph(x.c, 720, p, 22)}<em>${x.r ? x.r + '%' : ''}</em></span><span class="num lo">${deg(x.lo)}°</span><span class="wkb"><i style="left:${(x.lo - mn) / (mx - mn) * 100}%;right:${100 - (x.hi - mn) / (mx - mn) * 100}%"></i>${x.k ? '' : `<u style="left:${(nowT - mn) / (mx - mn) * 100}%"></u>`}</span><span class="num">${deg(x.hi)}°</span></div>`).join(''); }
  const dayEvents = p => p.me && typeof dayEvs === 'function' ? dayEvs(TODAY).filter(e => !e.all && e.e > localNow(p)) : [];
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function wxToast(msg, icon) { lToast($('#w-weather'), msg, { icon: icon || 'map-pin' }); }
  /* ══ Weather (B · object) ══════════════════════════════════════════════════
     A neutral page; the day is told as one sentence, one number, and one band of sky. The band is the only
     colour: 24 hours of the sky's actual light from now, with rain hatched in. Point along it to read any hour. */
  const bandCol = (p, m) => { const k = skyKind(p, m); return k === 'n' ? 'oklch(0.3 0.07 275)' : k === 'g' ? 'oklch(0.72 0.13 45)' : k === 'r' ? 'oklch(0.55 0.035 245)' : 'oklch(0.68 0.11 238)'; };
  function wbTabs() { $('#wb-tabs').innerHTML = `<div class="wbtplaces">${WP2.map(p => `<button type="button" class="wbt${p.id === WS2.place ? ' on' : ''}" data-wxp="${p.id}"><i class="wsky ${skyKind(p, localNow(p))}"></i>${p.n}</button>`).join('')}</div><button class="ib" type="button" data-wxadd aria-label="Add a place">${ic('plus')}</button><span class="sp"></span>${seg([['F', '°F'], ['C', '°C']], WS2.unit, 'data-wxu', 'Units')}`; requestAnimationFrame(segs); }
  function wbBody() { const p = wpl(), now = localNow(p), start = Math.floor(now / 60) * 60, [hi, lo] = hiLo(p), N = 24, ev = dayEvents(p);
    const stops = Array.from({ length: N + 1 }, (_, i) => `${bandCol(p, (start + i * 60) % 1440)} ${(i / N * 100).toFixed(2)}%`).join(', ');
    const rains = Array.from({ length: N }, (_, i) => rainPct(p, (start + i * 60) % 1440) ? `<i style="left:${i / N * 100}%;width:${100 / N}%"></i>` : '').join('');
    const marks = [[p.rise, 'Sunrise'], [p.set, 'Sunset']].map(([x, n]) => { const o = ((x - start) % 1440 + 1440) % 1440; return o < N * 60 ? `<span class="wbm" style="left:${o / (N * 60) * 100}%"><i></i>${n} ${hm(x)}</span>` : ''; }).join('');
    $('#wb-body').innerHTML = `<div class="wbpad"><p class="wbsay">${sentence(p)}</p>
      <section class="wbnow"><div class="wbtemp num" id="wb-t">${deg(tempAt(p, now))}°</div><div class="wbmeta"><b id="wb-c">${CW[condAt(p, now)]}</b><span id="wb-w">${p.me ? 'Oakland, now' : `${p.n}, ${hm(now)}`}</span><span>High ${deg(hi)}° · Low ${deg(lo)}°</span></div><div class="wbg" id="wb-g">${glyph(condAt(p, now), now, p, 88)}</div></section>
      <section class="wbband"><div class="wbtemps">${Array.from({ length: 9 }, (_, i) => { const m = (start + i * 180) % 1440; return `<span style="left:${i * 3 / N * 100}%"><b class="num">${deg(tempAt(p, m))}°</b></span>`; }).join('')}</div>
        <div class="wbstrip" id="wb-strip" style="background:linear-gradient(90deg, ${stops})"><div class="wbrain">${rains}</div><i class="wbcur" id="wb-cur"></i></div>
        <div class="wbhours">${Array.from({ length: 9 }, (_, i) => `<span style="left:${i * 3 / N * 100}%">${i ? hh(start + i * 180) : 'Now'}</span>`).join('')}</div><div class="wbmarks">${marks}</div></section>
      ${ev.length ? `<section class="wbday">${ev.map(e => { const c = condAt(p, e.s); return `<span class="wbe"><b>${esc(e.t)}</b>${hm(e.s)} · ${glyph(c, e.s, p, 16)} ${deg(tempAt(p, e.s))}°${c === 'rain' ? ' · <em>bring a jacket</em>' : ''}</span>`; }).join('')}</section>` : ''}
      <section class="wbstats">${[[`${p.wind[0]}`, 'mph wind', `from the ${dirs[Math.round(p.wind[1] / 45) % 8]}`], [`${p.uv}`, 'UV index', p.uv >= 6 ? 'high at midday' : 'moderate'], [`${p.aq}`, 'air quality', p.aq < 50 ? 'good' : 'moderate'], [`${p.hum}%`, 'humidity', `dew point ${deg(p.base - 12)}°`]].map(([v, l, n]) => `<div><b class="num">${v}</b><span>${l}</span><em>${n}</em></div>`).join('')}</section>
      <section class="wbweek"><h2>Ten days</h2><div class="wk">${weekRows(p)}</div></section></div>`;
    const s = $('#wb-strip'), cur = $('#wb-cur'), show = f => { const m = (start + Math.round(f * N) * 60) % 1440; cur.style.left = (f * 100) + '%'; cur.style.opacity = 1; $('#wb-t').textContent = deg(tempAt(p, m)) + '°'; $('#wb-c').textContent = CW[condAt(p, m)]; $('#wb-w').textContent = f ? `At ${hm(m)}` : (p.me ? 'Oakland, now' : `${p.n}, ${hm(now)}`); $('#wb-g').innerHTML = glyph(condAt(p, m), m, p, 88); };
    s.onpointermove = e => { const r = s.getBoundingClientRect(); show(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }; s.onpointerleave = () => { show(0); cur.style.opacity = 0; }; }
  /* ══ Weather, lock-in: the sky is the page ════════════════════════════════════
     Places are cards in the sidebar, each lit by its own sky. The island is the sky where you're looking: the place,
     the temperature and the conditions centred on it, then glass cards (hours, ten days, rain, wind, sun, air). */
  const WXQ = { q: '', i: 0 };
  /* A place picked from the SunoUI place search joins the list with a plausible sky for its latitude */
  function wxAdd(id) { const g = LPLACES.find(x => x.id === id); if (!g) return; let p = WP2.find(x => x.id === id);
    if (!p) { p = { id, n: g.n, r: g.r, off: g.off, base: 60 + (g.h % 17), amp: 8, rain: g.h % 3 ? null : [15, 18], rise: 400 + g.h % 60, set: 1120 + g.h % 50, aq: 20 + g.h % 30, uv: 3 + g.h % 5, wind: [4 + g.h % 9, g.h], hum: 40 + g.h % 35 }; WP2.push(p); }
    WS2.place = id; WXQ.q = ''; WXQ.i = 0; renderWx(); $('#wb-body').scrollTop = 0; lToast($('#w-weather'), `Added ${g.n}, ${g.r}`, { icon: 'map-pin' }); }
  function wxSide() { const q = WXQ.q.toLowerCase(), had = document.activeElement?.matches?.('[data-wxq]');
    $('#wx-side').innerHTML = `<div class="scr wxplaces">${WP2.map(p => { const m = localNow(p), [hi, lo] = hiLo(p);
      return `<button type="button" class="wxpl${p.id === WS2.place ? ' on' : ''}" data-wxp="${p.id}"><span class="wxplg2">${glyph(condAt(p, m), m, p, 26)}</span><span class="wxplt"><b>${p.n}${p.me ? ic('navigation') : ''}</b><small>${p.me ? 'My location' : hm(m)} · ${CW[condAt(p, m)]}</small></span><span class="wxplr"><b>${deg(tempAt(p, m))}°</b><small>${deg(hi)}° / ${deg(lo)}°</small></span></button>`; }).join('')}</div>
      ${lFoot({ q: { attr: 'data-wxq', ph: 'Add a city or ZIP', value: WXQ.q }, sug: { id: 'wx-sug', html: WXQ.q.trim() ? lPlaceSug(WXQ.q, WXQ.i, 'data-wxpick') : '' } }).replace('lfoot', 'lfoot wxfoot')}`;
    if (had) { const i = $('[data-wxq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  /* ══ Weather on a phone (v71 rethink) ════════════════════════════════════════
     Most people have one place. So the phone app is about yours: what matters today in plain words, any warning first,
     your own plans with the weather at each, then the numbers. The bar picks how you look (Today, Hourly, 10 days,
     Radar); Alerts (what Weather tells you about) and Places sit beside it, smaller, because you set them once. */
  const wxNarrow = () => { const w = $('#w-weather'); return !!w?.clientWidth && w.clientWidth < 560; };
  const WXAL = { oak: [{ lvl: 'warn', icon: 'wind', t: 'Wind advisory', when: 'Today, 3 PM to 9 PM', d: 'Gusts up to 45 mph in the hills. Tie down anything loose outside, and expect a slow drive over the bridge.', src: 'National Weather Service' }] };
  const WXN = { severe: true, rain: true, aq: false, daily: true };
  function wxBodyPhone() { const p = wpl(), now = localNow(p), [hi, lo] = hiLo(p), start = Math.floor(now / 60) * 60, k = skyKind(p, now), W = week(p), mn = Math.min(...W.map(x => x.lo)), mx = Math.max(...W.map(x => x.hi)), nowT = tempAt(p, now), V = WS2.v || 'today', al = WXAL[p.id] || [], ev = dayEvents(p);
    const w = $('#w-weather'); w.dataset.sky = k; w.classList.add('wxph');
    const days = () => W.map(x => `<div class="wxday"><b>${x.k ? dOf(TODAY + x.k).toLocaleDateString([], { weekday: 'short' }) : 'Today'}</b><span class="wxdi">${glyph(x.c, 720, p, 22)}<em>${x.r ? x.r + '%' : ''}</em></span><span class="lo">${deg(x.lo)}°</span><span class="wxbar"><i style="left:${(x.lo - mn) / (mx - mn) * 100}%;right:${100 - (x.hi - mn) / (mx - mn) * 100}%"></i>${x.k ? '' : `<u style="left:${(nowT - mn) / (mx - mn) * 100}%"></u>`}</span><span>${deg(x.hi)}°</span></div>`).join('');
    const hero = `<header class="wxhero2"><button class="wxloc2" type="button" data-wxpx="places">${p.me ? ic('navigation') : ic('map-pin')}${esc(p.n)}${ic('chevron-down')}</button><div class="wxt2"><span class="num">${deg(nowT)}°</span>${glyph(condAt(p, now), now, p, 64)}</div><p class="wxc2">${CW[condAt(p, now)]} · H ${deg(hi)}° L ${deg(lo)}°</p></header>`;
    let body = '';
    if (V === 'today') {
      const say = sentence(p) + (al.length ? ` ${al[0].t} from 3 PM.` : '');
      /* "What's next": the one change coming in the next hours, as a small timeline, so you can glance and know */
      const nx = (() => { const out = []; let prev = condAt(p, now); for (let i = 1; i <= 12; i++) { const m = (start + i * 60) % 1440, c = condAt(p, m); if (c !== prev) { out.push([m, c, i]); prev = c; } } const sr = ((isNight(p, now) ? p.rise : p.set) - now + 1440) % 1440; if (sr < 720) out.push([(now + sr) % 1440, isNight(p, now) ? 'rise' : 'set', Math.round(sr / 60)]); return out.sort((a, b) => a[2] - b[2]).slice(0, 3); })();
      const nxHTML = nx.length ? `<section class="wxnext">${nx.map(([m, c, h]) => `<div><span class="wxnh">${h < 1 ? 'Soon' : `In ${h} h`}</span>${c === 'rise' || c === 'set' ? `<i class="wxni">${ic(c === 'rise' ? 'sunrise' : 'sunset')}</i>` : glyph(c, m, p, 26)}<b>${c === 'rise' ? 'Sunrise' : c === 'set' ? 'Sunset' : CW[c]}</b><small>${hm(m)}</small></div>`).join('<i class="wxnarr"></i>')}</section>` : '';
      body = `${hero}<p class="wxsay2">${say}</p>${nxHTML}
        ${al.map(a => `<section class="wxalert ${a.lvl}" role="alert"><div class="wxalh">${ic('triangle-alert')}<b>${a.t}</b><span>${a.when}</span></div><p>${a.d}</p><small>${a.src}</small></section>`).join('')}
        ${ev.length ? `<section class="wxcard2"><h6>${ic('calendar')}Your day</h6>${ev.slice(0, 3).map(e => { const c = condAt(p, e.s); return `<div class="wxev"><span><b>${esc(e.t)}</b><small>${hm(e.s)}</small></span>${glyph(c, e.s, p, 22)}<em>${deg(tempAt(p, e.s))}°${c === 'rain' ? ' · bring a jacket' : ''}</em></div>`; }).join('')}</section>` : ''}
        <section class="wxcard2"><h6>${ic('clock')}Next hours</h6><div class="wxhrow hscroll">${Array.from({ length: 13 }, (_, i) => { const m = (start + i * 60) % 1440, r = rainPct(p, m); return `<div class="wxh${i ? '' : ' wxnow'}"><small>${i ? hh(m).replace(' ', '') : 'Now'}</small>${glyph(condAt(p, m), m, p, 26)}<em>${r ? r + '%' : ''}</em><b>${deg(tempAt(p, m))}°</b></div>`; }).join('')}</div></section>
        <div class="wxtiles">${[['umbrella', 'Rain', p.rain ? `${Math.max(...Array.from({ length: 24 }, (_, i) => rainPct(p, i * 60)))}%` : '0%', p.rain ? `${hh(p.rain[0] * 60)} to ${hh(p.rain[1] * 60)}` : 'None today'], ['wind', 'Wind', `${p.wind[0]} mph`, `from the ${dirs[Math.round(p.wind[1] / 45) % 8]}`], ['sun', 'UV', `${p.uv}`, p.uv >= 6 ? 'High at midday' : 'Moderate'], ['leaf', 'Air', `${p.aq}`, p.aq < 50 ? 'Good' : 'Moderate'], [isNight(p, now) ? 'sunrise' : 'sunset', isNight(p, now) ? 'Sunrise' : 'Sunset', hm(isNight(p, now) ? p.rise : p.set), ''], ['droplets', 'Humidity', `${p.hum}%`, `Dew point ${deg(p.base - 12)}°`]].map(([i, n, v, sub]) => `<div class="wxtile">${ic(i)}<span>${n}</span><b>${v}</b><small>${sub}</small></div>`).join('')}</div>`; }
    else if (V === 'hourly') body = `<header class="wxph2"><h1>Hourly</h1><p>${esc(p.n)} · next 24 hours</p></header><div class="wxhlist">${Array.from({ length: 24 }, (_, i) => { const m = (start + i * 60) % 1440, r = rainPct(p, m); return `<div class="wxhr${i ? '' : ' wxhrnow'}"><b>${i ? hh(m) : 'Now'}</b>${glyph(condAt(p, m), m, p, 24)}<span>${CW[condAt(p, m)]}</span><em>${r ? `${ic('umbrella')}${r}%` : ''}</em><strong class="num">${deg(tempAt(p, m))}°</strong></div>`; }).join('')}</div>`;
    else if (V === 'days') body = `<header class="wxph2"><h1>10 days</h1><p>${esc(p.n)}</p></header><section class="wxcard2"><div class="wxdays">${days()}</div></section>`;
    else { const t = WS2.rt || 0; body = `<header class="wxph2"><h1>Radar</h1><p>${esc(p.n)} · rain and storms, next 2 hours</p></header>
      <div class="wxradar"><svg viewBox="0 0 360 420" preserveAspectRatio="xMidYMid slice" aria-label="Rain radar">${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 45}" y1="0" x2="${i * 45 + 30}" y2="420"/><line x1="0" y1="${i * 52}" x2="360" y2="${i * 52 - 20}"/>`).join('')}
        <g class="wxrg" transform="translate(${-80 + t * 18} ${t * 6})"><ellipse cx="120" cy="150" rx="90" ry="46" class="r1"/><ellipse cx="140" cy="150" rx="52" ry="26" class="r2"/><ellipse cx="150" cy="148" rx="20" ry="10" class="r3"/><ellipse cx="40" cy="260" rx="70" ry="30" class="r1"/></g>
        <circle cx="200" cy="200" r="7" class="me"/><text x="212" y="205">${esc(p.n)}</text></svg>
        <div class="wxrt"><button class="ib" type="button" data-wxplay aria-label="Play">${ic(WS2.rplay ? 'pause' : 'play')}</button><input type="range" min="0" max="8" value="${t}" data-wxrt aria-label="Time"><b>${t ? `+${t * 15} min` : 'Now'}</b></div>
        <div class="wxlegend"><span><i class="r1"></i>Light</span><span><i class="r2"></i>Moderate</span><span><i class="r3"></i>Heavy</span></div></div>`; }
    $('#wb-body').innerHTML = `<div class="wxpad2">${body}</div>`; wxBarPhone(); }
  function wxBarPhone() { let bar = $('#wx-phbar'); if (!bar) { $('#wb-main').insertAdjacentHTML('beforeend', '<div class="fbar wxphbar phnofit" id="wx-phbar"></div>'); bar = $('#wx-phbar'); }
    const X = WS2.px || '', V = WS2.v || 'today', p = wpl(), al = WXAL[p.id] || [], VW = [['today', 'Today', 'sun'], ['hourly', 'Hourly', 'clock'], ['days', '10 days', 'calendar'], ['radar', 'Radar', 'radar']], cv = VW.find(x => x[0] === V);
    const sw = (k, n, sub) => `<button class="fexr2" type="button" data-wxn="${k}"><span>${n}<small>${sub}</small></span><i class="cfsw${WXN[k] ? ' on' : ''}"></i></button>`;
    const panel = X === 'view' ? `<div class="fexp"><div class="fsha">${VW.map(([k, n, i]) => `<button type="button" class="fvt${V === k ? ' on' : ''}" data-wxv="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`
      : X === 'alerts' ? `<div class="fexp wxalp">${al.length ? `<div class="fexh">Now</div>${al.map(a => `<div class="wxalert sm ${a.lvl}"><div class="wxalh">${ic('triangle-alert')}<b>${a.t}</b><span>${a.when}</span></div></div>`).join('')}` : '<p class="wxnone">No warnings where you are.</p>'}<div class="fexh">Tell me about</div>${sw('severe', 'Severe weather', 'Storms, heat, wind and flood warnings')}${sw('rain', 'Rain starting soon', '15 minutes before, where you are')}${sw('aq', 'Unhealthy air', 'When the air quality passes 100')}${sw('daily', 'Tomorrow, the night before', 'A one-line forecast at 8 PM')}</div>`
      : X === 'places' ? `<div class="fexp fmore2 wxplp">${WP2.map(q => { const m = localNow(q); return `<button class="fexr2${q.id === WS2.place ? ' on' : ''}" type="button" data-wxp="${q.id}">${glyph(condAt(q, m), m, q, 24)}<span>${esc(q.n)}${q.me ? ' · My location' : ''}<small>${CW[condAt(q, m)]} · ${hm(m)}</small></span><em>${deg(tempAt(q, m))}°</em></button>`; }).join('')}<div class="fexh">Units</div><div class="fexs">${[['F', '°F'], ['C', '°C']].map(([k, n]) => `<button type="button" class="fsch${WS2.unit === k ? ' on' : ''}" data-wxu="${k}">${n}</button>`).join('')}</div></div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, `${panel}<button class="wxvw${X === 'view' ? ' on' : ''}" type="button" data-wxpx="view" aria-expanded="${X === 'view'}">${ic(cv[2])}<b>${cv[1]}</b>${ic('chevron-down')}</button><span class="sp"></span><button class="ib wxbell${X === 'alerts' ? ' on' : ''}" type="button" data-wxpx="alerts" aria-label="Alerts${al.length ? ', ' + al.length : ''}" title="Alerts">${ic('bell')}${al.length ? `<em>${al.length}</em>` : ''}</button><button class="ib${X === 'places' ? ' on' : ''}" type="button" data-wxpx="places" aria-label="Places" title="Places">${ic('map-pin')}</button>`); }
  function wxBody() { if (wxNarrow()) return wxBodyPhone(); $('#w-weather').classList.remove('wxph'); $('#wx-phbar')?.remove(); const p = wpl(), now = localNow(p), [hi, lo] = hiLo(p), start = Math.floor(now / 60) * 60, k = skyKind(p, now), W = week(p), mn = Math.min(...W.map(x => x.lo)), mx = Math.max(...W.map(x => x.hi)), nowT = tempAt(p, now);
    $('#w-weather').dataset.sky = k;
    const hours = Array.from({ length: 25 }, (_, i) => { const m = (start + i * 60) % 1440, r = rainPct(p, m); return `<div class="wxh${i ? '' : ' wxnow'}"><small>${i ? hh(m).replace(' ', '') : 'Now'}</small>${glyph(condAt(p, m), m, p, 26)}<em>${r ? r + '%' : ''}</em><b>${deg(tempAt(p, m))}°</b></div>`; }).join('');
    const night = isNight(p, now), sunF = Math.max(0, Math.min(1, (now - p.rise) / (p.set - p.rise))), sx = 8 + sunF * 144, sy = 64 - Math.sin(sunF * Math.PI) * 50;
    const card = (icn, title, body, cls = '') => `<section class="wxcard lskycard ${cls}"><h6>${ic(icn)}${title}</h6>${body}</section>`;
    const rainMax = p.rain ? Math.max(...Array.from({ length: 24 }, (_, i) => rainPct(p, i * 60))) : 0;
    $('#wb-body').innerHTML = `<div class="wxpad">
      <header class="wxhero"><span class="wxloc">${p.me ? `${ic('navigation')}My location` : hm(now)}</span><h1>${p.n}</h1><div class="wxt">${deg(nowT)}°</div><p class="wxc">${CW[condAt(p, now)]}</p><p class="wxhl">H ${deg(hi)}° · L ${deg(lo)}°</p></header>
      <section class="wxcard lskycard wxhours"><p class="wxsay">${sentence(p)}</p><div class="wxhrow hscroll">${hours}</div></section>
      <div class="wxgrid">
        ${card('calendar', 'Ten days', `<div class="wxdays">${W.map(x => `<div class="wxday"><b>${x.k ? dOf(TODAY + x.k).toLocaleDateString([], { weekday: 'short' }) : 'Today'}</b><span class="wxdi">${glyph(x.c, 720, p, 22)}<em>${x.r ? x.r + '%' : ''}</em></span><span class="lo">${deg(x.lo)}°</span><span class="wxbar"><i style="left:${(x.lo - mn) / (mx - mn) * 100}%;right:${100 - (x.hi - mn) / (mx - mn) * 100}%"></i>${x.k ? '' : `<u style="left:${(nowT - mn) / (mx - mn) * 100}%"></u>`}</span><span>${deg(x.hi)}°</span></div>`).join('')}</div>`, 'tall')}
        <div class="wxsmall">
          ${card('umbrella', 'Rain', `<b class="wxbig">${rainMax}%</b><p>${p.rain ? `Light rain ${hh(p.rain[0] * 60)} to ${hh(p.rain[1] * 60)}.` : 'None expected today.'}</p>`)}
          ${card('wind', 'Wind', `<div class="wxwind"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34"/>${['N', 'E', 'S', 'W'].map((d, i) => `<text x="${(40 + 26 * Math.sin(i * Math.PI / 2)).toFixed(1)}" y="${(44 - 26 * Math.cos(i * Math.PI / 2)).toFixed(1)}">${d}</text>`).join('')}<path d="M40 16 L45 40 L40 36 L35 40 Z" transform="rotate(${p.wind[1] + 180} 40 40)"/></svg><span><b class="wxbig">${p.wind[0]}</b><small>mph from the ${dirs[Math.round(p.wind[1] / 45) % 8]}</small></span></div>`)}
          ${card('sun', 'UV index', `<b class="wxbig">${p.uv}</b><p>${p.uv >= 6 ? 'High around midday' : 'Moderate'}</p><span class="wxuv"><i style="left:${p.uv / 11 * 100}%"></i></span>`)}
          ${card(night ? 'sunrise' : 'sunset', night ? 'Sunrise' : 'Sunset', `<b class="wxbig">${hm(night ? p.rise : p.set)}</b><svg class="wxarc" viewBox="0 0 160 72" aria-hidden="true"><path d="M8 64 Q80 -36 152 64"/><line x1="0" y1="64" x2="160" y2="64"/>${night ? '' : `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="6"/>`}</svg><p>${night ? `Sunset was ${hm(p.set)}` : `Sunrise was ${hm(p.rise)}`}</p>`)}
          ${card('droplets', 'Humidity', `<b class="wxbig">${p.hum}%</b><p>Dew point ${deg(p.base - 12)}°</p>`)}
          ${card('leaf', 'Air quality', `<b class="wxbig">${p.aq}</b><p>${p.aq < 50 ? 'Good. Fine for everyone.' : 'Moderate'}</p><span class="wxaq"><i style="left:${Math.min(100, p.aq / 150 * 100)}%"></i></span>`)}
        </div></div></div>`; }
  function renderWx() { wxSide(); wxBody(); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-wxrt]')) { WS2.rt = +e.target.value; wxBody(); const r = $('#wb-body [data-wxrt]'); r?.focus(); return; } if (e.target.matches?.('[data-wxq]')) { WXQ.q = e.target.value; WXQ.i = 0; const g = $('#wx-sug'); if (g) { g.hidden = !WXQ.q.trim(); g.innerHTML = WXQ.q.trim() ? lPlaceSug(WXQ.q, 0, 'data-wxpick') : ''; } } });
  document.addEventListener('keydown', e => { if (!e.target.matches?.('[data-wxq]')) return; const l = lPlaceFind(WXQ.q), g = $('#wx-sug');
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && l.length) { e.preventDefault(); WXQ.i = (WXQ.i + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length; if (g) g.innerHTML = lPlaceSug(WXQ.q, WXQ.i, 'data-wxpick'); }
    else if (e.key === 'Enter' && l[WXQ.i]) { e.preventDefault(); wxAdd(l[WXQ.i].id); }
    else if (e.key === 'Escape' && WXQ.q) { WXQ.q = ''; e.target.value = ''; if (g) { g.hidden = true; g.innerHTML = ''; } } });
  function wxClick(e, hit) { if (wxNarrow()) { const px = hit('[data-wxpx]'); if (px) { const k = px.dataset.wxpx; WS2.px = WS2.px === k ? '' : k; wxBarPhone(); return true; }
      const vv = hit('[data-wxv]'); if (vv) { WS2.v = vv.dataset.wxv; WS2.px = ''; wxBody(); $('#wb-body').scrollTop = 0; return true; }
      const nn = hit('[data-wxn]'); if (nn) { const k = nn.dataset.wxn; WXN[k] = !WXN[k]; wxBarPhone(); return true; }
      if (hit('[data-wxplay]')) { WS2.rplay = !WS2.rplay; clearInterval(WS2.rpi); if (WS2.rplay) WS2.rpi = setInterval(() => { WS2.rt = ((WS2.rt || 0) + 1) % 9; if (WS2.v === 'radar' && $('#w-weather').classList.contains('wxph')) wxBody(); else clearInterval(WS2.rpi); }, 600); wxBody(); return true; }
      if (hit('[data-wxp]') || hit('[data-wxu]')) WS2.px = ''; }
    const pl = hit('[data-wxp]'); if (pl) { WS2.place = pl.dataset.wxp; renderWx(); $('#wb-body').scrollTop = 0; return true; } const u = hit('[data-wxu]'); if (u) { WS2.unit = u.dataset.wxu; renderWx(); return true; }
    const pk = hit('[data-wxpick]'); if (pk) { wxAdd(pk.dataset.wxpick); return true; }
    if (hit('[data-wxadd]')) { $('[data-wxq]')?.focus(); return true; } return false; }
  function renderWeather() { $('#wx-top').innerHTML = `${NAVBTN}<img src="${A}weather.svg" alt=""><b>Weather</b><span class="chev">${ic('chevron-down')}</span>`; renderWx(); setInterval(renderWx, 60000); }

  const CKC = [['Oakland', 0], ['New York', 3], ['London', 8], ['Lisbon', 8], ['Tokyo', 16], ['Sydney', 17]];
  const CK = { find: { on: false, q: '', i: 0 }, mode: 'clock', alarms: [{ id: 1, m: 390, label: 'Wake up', days: 'Weekdays', on: true }, { id: 2, m: 480, label: 'Weekend', days: 'Sat, Sun', on: false }, { id: 3, m: 855, label: 'Launch walkthrough', days: 'Today', on: true }],
    sw: { run: false, t0: 0, acc: 0, laps: [] }, tm: { dur: 300, left: 300, run: false, end: 0, label: 'Timer', done: false }, raf: 0 };
  const pad2 = n => String(n).padStart(2, '0');
  const mm2 = m => `${(Math.floor(m / 60) % 12) || 12}:${pad2(m % 60)}`, ap2 = m => (m % 1440) < 720 ? 'AM' : 'PM';
  const swMs = () => CK.sw.acc + (CK.sw.run ? performance.now() - CK.sw.t0 : 0);
  const fmtSw = ms => { const t = Math.floor(ms / 10), cs = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000); return `${pad2(m)}:${pad2(s)}<small>.${pad2(cs)}</small>`; };
  const tmLeft = () => CK.tm.run ? Math.max(0, (CK.tm.end - performance.now()) / 1000) : CK.tm.left;
  const fmtTm = s => { s = Math.ceil(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return h ? `${h}:${pad2(m)}:${pad2(x)}` : `${pad2(m)}:${pad2(x)}`; };
  const nextAlarm = () => { const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(); let best = null; CK.alarms.filter(a => a.on).forEach(a => { const d = (a.m - nm + 1440) % 1440 || 1440; if (!best || d < best.d) best = { a, d }; }); return best; };
  const baseMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const cityKind = m => m < 400 || m > 1150 ? 'n' : m < 470 || m > 1080 ? 'g' : 'd';
  const PRESETS = [[60, '1 min'], [180, '3 min'], [300, '5 min'], [600, '10 min'], [1500, 'Focus 25'], [3600, '1 hour']];
  function ckToast(msg, icon) { lToast($('#w-clock'), msg, { icon: icon || 'bell' }); }
  /* Add a city: the same SunoUI place search as Weather. Type a city or ZIP, the matches open above the field, Enter or a click adds it. */
  const ckSugHTML = () => CK.find.q.trim() ? lPlaceSug(CK.find.q, CK.find.i, 'data-ckpick') : (() => { const have = CKC.map(c => c[0]); return LPLACES.filter(g => !have.includes(g.n)).slice(0, 5).map(g => `<button class="lsugi" type="button" ${'data-ckpick'}="${g.id}">${ic('map-pin')}<span><b>${esc(g.n)}, ${esc(g.r)}</b></span></button>`).join(''); })();
  function ckAddPlace(id) { const g = LPLACES.find(x => x.id === id); if (!g) return; if (!CKC.some(c => c[0] === g.n)) CKC.push([g.n, g.off]); CK.find = { on: false, q: '', i: 0 }; cbMin = -1; ckRedraw(); lToast($('#w-clock'), `Added ${esc(g.n)}, ${esc(g.r)}`, { icon: 'map-pin' }); }
  document.addEventListener('input', e => { if (!e.target.matches?.('[data-ckq]')) return; CK.find.q = e.target.value; CK.find.i = 0; const g = $('#ck-sug'); if (g) g.innerHTML = ckSugHTML(); });
  document.addEventListener('keydown', e => { if (!e.target.matches?.('[data-ckq]')) return; const l = lPlaceFind(CK.find.q), g = $('#ck-sug');
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && l.length) { e.preventDefault(); CK.find.i = (CK.find.i + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length; if (g) g.innerHTML = ckSugHTML(); }
    else if (e.key === 'Enter' && l[CK.find.i]) { e.preventDefault(); ckAddPlace(l[CK.find.i].id); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); CK.find = { on: false, q: '', i: 0 }; cbMin = -1; ckRedraw(); } }, true);
  document.addEventListener('focusout', e => { if (e.target.matches?.('[data-ckq]') && !CK.find.q.trim()) setTimeout(() => { if (CK.find.on && !document.activeElement?.closest?.('.ckfind')) { CK.find = { on: false, q: '', i: 0 }; cbMin = -1; ckRedraw(); } }, 150); });
  const CKALL = [['Los Angeles', 0], ['Denver', 1], ['Chicago', 2], ['New York', 3], ['São Paulo', 4], ['London', 8], ['Lisbon', 8], ['Paris', 9], ['Berlin', 9], ['Cairo', 10], ['Nairobi', 10], ['Dubai', 11], ['Mumbai', 12.5], ['Singapore', 15], ['Hong Kong', 15], ['Seoul', 16], ['Tokyo', 16], ['Sydney', 17], ['Auckland', 19]];
  function ckAddHTML(q = '') { const have = CKC.map(c => c[0]), l = CKALL.filter(([n]) => !have.includes(n) && (!q || n.toLowerCase().includes(q.toLowerCase()))).slice(0, 8), base = baseMin();
    return `<div class="ckaddp"><label class="ckaq">${ic('search')}<input data-ckcq placeholder="Search cities" value="${esc(q)}" autocomplete="off"></label><div class="ckaddl">${l.map(([n, off]) => `<button class="crmi" type="button" data-ckcity="${n}|${off}"><span>${n}</span><em>${ckT(base + off * 60).join(' ')}</em></button>`).join('') || '<p class="shnone">No cities match</p>'}</div></div>`; }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-ckcq]')) { const l = e.target.closest('.ckaddp').querySelector('.ckaddl'); l.outerHTML = ckAddHTML(e.target.value).match(/<div class="ckaddl">[\s\S]*<\/div>(?=<\/div>$)/)[0]; } });
  function ckCommon(e, hit, redraw) {
    if (hit('[data-ckfindx]')) { CK.find = { on: false, q: '', i: 0 }; cbMin = -1; redraw(); return true; }
    if (hit('[data-ckedit2]')) { CK.edit = !CK.edit; cbMin = -1; redraw(); return true; }
    const rm = hit('[data-ckrm]'); if (rm) { const n = rm.dataset.ckrm, i = CKC.findIndex(c => c[0] === n), was = CKC[i]; CKC.splice(i, 1); cbMin = -1; redraw(); lToast($('#w-clock'), `Removed ${esc(n)}`, { icon: 'trash-2', undo: () => { CKC.splice(i, 0, was); cbMin = -1; redraw(); } }); return true; }
    const ac = hit('[data-ckaddcity]'); if (ac) { CK.edit = false; CK.find = { on: true, q: '', i: 0 }; cbMin = -1; redraw(); setTimeout(() => $('[data-ckq]')?.focus(), 30); return true; }
    const pk = hit('[data-ckpick]'); if (pk) { ckAddPlace(pk.dataset.ckpick); return true; }
    const cy = hit('[data-ckcity]'); if (cy) { const [n, off] = cy.dataset.ckcity.split('|'); CKC.push([n, +off]); $('#lmenu')?.remove(); cbMin = -1; redraw(); ckToast(`Added ${n}`); return true; }
    const md = hit('[data-ckm]'); if (md) { CK.mode = md.dataset.ckm; redraw(); return true; }
    const al = hit('[data-ckal]'); if (al) { const a = CK.alarms.find(x => x.id === +al.dataset.ckal); a.on = !a.on; redraw(); return true; }
    if (hit('[data-cknew]')) { CK.alarms.push({ id: Date.now(), m: 420, label: 'Alarm', days: 'Tomorrow', on: true }); redraw(); ckToast('Alarm set for 7:00 AM tomorrow'); return true; }
    const sw = hit('[data-cksw]'); if (sw) { const k = sw.dataset.cksw, s = CK.sw; if (k === 'toggle') { if (s.run) { s.acc += performance.now() - s.t0; s.run = false; } else { s.t0 = performance.now(); s.run = true; } } if (k === 'lap') s.laps.push(swMs()); if (k === 'reset') { s.acc = 0; s.laps = []; } redraw(); return true; }
    const pr = hit('[data-cktm]'); if (pr) { Object.assign(CK.tm, { dur: +pr.dataset.cktm, left: +pr.dataset.cktm, run: false, done: false, label: pr.textContent }); redraw(); return true; }
    const t2 = hit('[data-cktm2]'); if (t2) { const t = CK.tm; if (t2.dataset.cktm2 === 'cancel') Object.assign(t, { left: t.dur, run: false, done: false }); else if (t.run) { t.left = tmLeft(); t.run = false; } else { if (t.done || t.left <= 0) { t.left = t.dur; t.done = false; } t.end = performance.now() + t.left * 1000; t.run = true; } redraw(); return true; }
    const td = hit('[data-cktodo]'); if (td) { ckToast(td.dataset.cktodo); return true; } return false; }
  const ckActions = () => CK.mode === 'alarms' ? `<button class="bt key" type="button" data-cknew>${ic('plus')}New alarm</button>`
    : CK.mode === 'sw' ? `<button class="bt fill" type="button" data-cksw="${CK.sw.run ? 'lap' : 'reset'}" ${!CK.sw.run && !swMs() ? 'disabled' : ''}>${CK.sw.run ? 'Lap' : 'Reset'}</button><button class="bt key${CK.sw.run ? ' stop' : ''}" type="button" data-cksw="toggle">${CK.sw.run ? 'Stop' : swMs() ? 'Resume' : 'Start'}</button>`
    : CK.mode === 'tm' ? `<button class="bt fill" type="button" data-cktm2="cancel" ${CK.tm.left === CK.tm.dur && !CK.tm.run && !CK.tm.done ? 'disabled' : ''}>Cancel</button><button class="bt key${CK.tm.run ? ' stop' : ''}" type="button" data-cktm2="toggle">${CK.tm.run ? 'Pause' : CK.tm.done ? 'Again' : CK.tm.left < CK.tm.dur ? 'Resume' : 'Start'}</button>` : '';
  function ckLoop(frame) { cancelAnimationFrame(CK.raf); const loop = () => { if (!$('#w-clock').hidden) { frame(); if (CK.tm.run && tmLeft() <= 0) { CK.tm.run = false; CK.tm.left = 0; CK.tm.done = true; ckToast(`${CK.tm.label} is done`); ckRedraw(); } } CK.raf = requestAnimationFrame(loop); }; loop(); }
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'clock' || e.target.closest('input')) return; if (e.key === ' ') { e.preventDefault(); $(CK.mode === 'sw' ? '[data-cksw="toggle"]' : '[data-cktm2="toggle"]')?.click(); } else if (/^[1-4]$/.test(e.key)) { CK.mode = ['clock', 'alarms', 'sw', 'tm'][+e.key - 1]; ckRedraw(); } });
  const CLKI = SVG['clock'], SWI = SVG['timer'], TMI = SVG['hourglass'];
  /* ══ Clock (B · object) ════════════════════════════════════════════════════
     Instruments, not screens. A clean analog face with a sweeping orange second hand; the world as a row of small
     faces, light by day and dark by night; a stopwatch dial with a minute sub-dial; a kitchen timer you wind by dragging. */
  const PT = (r, a) => [110 + r * Math.sin(a * Math.PI / 180), 110 - r * Math.cos(a * Math.PI / 180)];
  function dial(o = {}) { const nums = o.nums || [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    return `<circle cx="110" cy="110" r="104" class="fbz"/><circle cx="110" cy="110" r="97" class="fdl"/>${Array.from({ length: 60 }, (_, i) => { const [x1, y1] = PT(93, i * 6), [x2, y2] = PT(i % 5 ? 88 : 83, i * 6); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${i % 5 ? 'fmn' : 'fhr'}"/>`; }).join('')}
      ${o.noNums ? '' : nums.map((n, i) => { const [x, y] = PT(70, i * 30); return `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}">${n}</text>`; }).join('')}`; }
  const hand = (a, len, w, cls, tail = 14) => `<rect x="${110 - w / 2}" y="${110 - len}" width="${w}" height="${len + tail}" rx="${w / 2}" class="${cls}" transform="rotate(${a.toFixed(2)} 110 110)"/>`;
  function face(d, o = {}) { const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    return `<svg class="cbf${o.night ? ' night' : ''}" viewBox="0 0 220 220" aria-hidden="true">${dial(o)}${o.alarm != null ? `<path d="M110 7 l-6 10 h12 Z" class="fam" transform="rotate(${o.alarm / 2} 110 110)"/>` : ''}
      ${hand(h * 30, 50, 7, 'fhh', 12)}${hand(m * 6, 78, 4.5, 'fmh', 14)}${o.noSec ? '' : `${hand(s * 6, 86, 1.6, 'fsh', 22)}<circle cx="110" cy="110" r="5" class="fsc"/>`}<circle cx="110" cy="110" r="${o.noSec ? 4 : 2}" class="fcc"/></svg>`; }
  function swFace() { const ms = swMs(), s = ms / 1000 % 60, mi = ms / 60000 % 30;
    return `<svg class="cbf" viewBox="0 0 220 220" aria-hidden="true">${dial({ nums: [60, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] })}
      <circle cx="110" cy="150" r="22" class="fsub"/>${Array.from({ length: 6 }, (_, i) => { const a = i * 60, x1 = 110 + 20 * Math.sin(a * Math.PI / 180), y1 = 150 - 20 * Math.cos(a * Math.PI / 180), x2 = 110 + 16 * Math.sin(a * Math.PI / 180), y2 = 150 - 16 * Math.cos(a * Math.PI / 180); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="fhr"/>`; }).join('')}
      <rect x="109" y="132" width="2" height="20" rx="1" class="fmh" transform="rotate(${mi * 12} 110 150)"/><circle cx="110" cy="150" r="2.5" class="fcc"/>
      <text x="110" y="82" class="fdg">${fmtSw(ms).replace(/<\/?small>/g, '')}</text>${hand(s * 6, 88, 1.8, 'fsh', 22)}<circle cx="110" cy="110" r="5" class="fsc"/><circle cx="110" cy="110" r="2" class="fcc"/></svg>`; }
  function tmFace() { const l = tmLeft(), f = Math.min(1, l / 3600), a = f * 360, [x, y] = PT(97, a), large = a > 180 ? 1 : 0;
    const wedge = f >= .999 ? `<circle cx="110" cy="110" r="97" class="fwd"/>` : f > 0 ? `<path d="M110 110 L110 13 A97 97 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" class="fwd"/>` : '';
    return `<svg class="cbf tmr${CK.tm.done ? ' done' : ''}" viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="104" class="fbz"/><circle cx="110" cy="110" r="97" class="fdl"/>${wedge}
      ${Array.from({ length: 60 }, (_, i) => { const [x1, y1] = PT(93, i * 6), [x2, y2] = PT(i % 5 ? 89 : 84, i * 6); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${i % 5 ? 'fmn' : 'fhr'}"/>`; }).join('')}
      ${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((n, i) => { const [tx, ty] = PT(72, i * 30); return `<text x="${tx.toFixed(1)}" y="${(ty + 5).toFixed(1)}">${n}</text>`; }).join('')}
      <circle cx="110" cy="110" r="30" class="fknob"/><rect x="104" y="84" width="12" height="52" rx="6" class="fgrip" transform="rotate(${a} 110 110)"/></svg>`; }
  /* ══ Clock, lock-in: a calm digital clock. Places in the sidebar; the time set large in Figtree; lists with hairlines. ══ */
  const ckT = m => { const h = Math.floor(((m % 1440) + 1440) % 1440 / 60), mi = ((m % 60) + 60) % 60; return [`${(h % 12) || 12}:${pad2(mi)}`, h < 12 ? 'AM' : 'PM']; };
  const ckRel = off => off === 0 ? 'Local time' : `${Math.abs(off)} hour${Math.abs(off) > 1 ? 's' : ''} ${off > 0 ? 'ahead' : 'behind'}`;
  function ckSide() { const n = nextAlarm(), it = (k, icn, lab, em = '') => `<button class="si${CK.mode === k ? ' on' : ''}" type="button" data-ckm="${k}">${ic(icn)}<span class="lab">${lab}</span>${em}</button>`;
    $('#ck-side').innerHTML = `${it('clock', 'globe', 'World clock')}${it('alarms', 'alarm-clock', 'Alarms', n ? `<em class="ckem">${ckT(n.a.m).join(' ')}</em>` : '')}${it('sw', 'timer', 'Stopwatch', CK.sw.run ? '<i class="ckrun"></i>' : '')}${it('tm', 'hourglass', 'Timer', CK.tm.run ? `<em class="ckem" id="ck-tmside">${fmtTm(tmLeft())}</em>` : '')}`; }
  function cbBody() { const b = $('#cb-body'), m = CK.mode; let h = '';
    if (m === 'clock') h = `<div class="ckhero"><div class="ckbig t-display" id="cb-big"></div><p class="ckdate t-body" id="cb-date"></p></div><div class="ckcities" id="cb-world"></div>`;
    else if (m === 'alarms') { const n = nextAlarm(); h = `<div class="ckhero sm"><p class="ckeyebrow t-label">${n ? 'Next alarm' : 'No alarms on'}</p>${n ? `<div class="ckbig t-display">${ckT(n.a.m)[0]}<small>${ckT(n.a.m)[1]}</small></div><p class="ckdate t-body">${esc(n.a.label)} · in ${Math.floor(n.d / 60)} h ${n.d % 60} min</p>` : ''}</div>
      <section class="cksec"><h6>Alarms</h6><div class="cklist">${CK.alarms.sort((a, c) => a.m - c.m).map(a => `<div class="ckrow${a.on ? '' : ' off'}" data-ckedit="${a.id}"><span class="ckrt"><b class="t-title-2">${esc(a.label)}</b><small class="t-caption">${a.days}</small></span><b class="cktime t-numeric">${ckT(a.m)[0]}<small>${ckT(a.m)[1]}</small></b><button class="cksw${a.on ? ' on' : ''}" type="button" data-ckal="${a.id}" aria-label="Turn ${esc(a.label)} ${a.on ? 'off' : 'on'}"></button></div>`).join('')}</div></section>`; }
    else if (m === 'sw') h = `<div class="ckhero"><div class="ckbig t-display" id="cb-big"></div></div><section class="cksec" id="cb-lapsw"${CK.sw.laps.length ? '' : ' hidden'}><div class="cklaph"><span>Lap</span><span>Time</span><span>Total</span></div><div class="cklist" id="cb-laps"></div></section>`;
    else h = `<div class="ckhero"><div class="ckring"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" class="tr"/><circle cx="100" cy="100" r="92" class="tp" id="cb-tmring" pathLength="100"/></svg><div class="ckbig t-display" id="cb-big"></div><p class="ckdate t-body" id="cb-cap"></p></div></div><section class="cksec"><h6 class="t-label">Quick timers</h6><div class="ckpre">${PRESETS.map(([s2, n]) => `<button type="button" class="${CK.tm.dur === s2 && !CK.tm.run ? 'on' : ''}" data-cktm="${s2}">${n}</button>`).join('')}</div></section>`;
    b.innerHTML = `<div class="cbpad ckpad">${h}</div>`;
    const acts = CK.mode === 'clock' ? '' : ckActions();
    const places = `<div class="seg ckplaces" role="group" aria-label="Clock"><i class="ind"></i>${[['clock', 'globe', 'World'], ['alarms', 'alarm-clock', 'Alarms'], ['sw', 'timer', 'Stopwatch'], ['tm', 'hourglass', 'Timer']].map(([k, i, n]) => `<button type="button" class="${CK.mode === k ? 'on' : ''}" data-ckm="${k}" title="${n}" aria-label="${n}">${ic(i)}<span>${n}</span>${k === 'alarms' ? lCount(CK.alarms.filter(a => a.on).length) : ''}${k === 'tm' && CK.tm.run ? `<em class="ckem" id="ck-tmside">${fmtTm(tmLeft())}</em>` : k === 'sw' && CK.sw.run ? '<i class="ckrun"></i>' : ''}</button>`).join('')}</div>`;
    if (CK.mode === 'clock' && CK.find.on) { const bar = $('#cb-bar'), nw = ckNarrow();
      bar.classList.add('phgrow', 'ckfindbar'); bar.classList.toggle('phnofit', nw); bar.classList.toggle('ckphbar', nw); bar.hidden = false;
      setBar(bar, `<div class="fexp ckfindp"><div class="fexh">Add a city</div><div id="ck-sug" class="ckfsug">${ckSugHTML()}</div></div><div class="ckfind ckfrow"><label class="srch keep">${ic('search')}<input data-ckq placeholder="City or ZIP" value="${esc(CK.find.q)}" autocomplete="off" aria-label="Add a city or ZIP"></label><button class="bt fill" type="button" data-ckfindx>Cancel</button></div>`);
      const nowM = baseMin(); $('#w-clock').dataset.sky = cityKind(nowM); cbFrame(true); return; }
    $('#cb-bar').classList.remove('ckfindbar', 'cktabbar');
    if (ckNarrow()) { const X = CK.px || '', MD = [['clock', 'globe', 'World'], ['alarms', 'alarm-clock', 'Alarms'], ['sw', 'timer', 'Stopwatch'], ['tm', 'hourglass', 'Timer']], cm = MD.find(x => x[0] === CK.mode), bar = $('#cb-bar');
      const E = CK.ed, DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], wheel = (k, vals, cur) => `<div class="ckwh" data-ckwh="${k}">${['', '', ...vals, '', ''].map((v, i) => `<span${v !== '' && v === cur ? ' class="on"' : ''}>${v}</span>`).join('')}</div>`;
      if (X === 'alarm' && E) { const h = Math.floor(E.m / 60), mm = E.m % 60, h12 = (h % 12) || 12;
        bar.classList.add('phnofit', 'ckphbar', 'phgrow');
        setBar(bar, `<div class="fexp ckal2"><div class="fexh">${E.id ? 'Edit alarm' : 'New alarm'}</div><div class="ckwheels">${wheel('h', Array.from({ length: 12 }, (_, i) => String(i + 1)), String(h12))}<b>:</b>${wheel('m', Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')), String(mm - mm % 5).padStart(2, '0'))}${wheel('ap', ['AM', 'PM'], h < 12 ? 'AM' : 'PM')}<i class="ckwsel"></i></div>
          <div class="ckdays">${DAYS.map((d, i) => `<button type="button" class="${E.days.includes(i) ? 'on' : ''}" data-ckday="${i}" aria-label="${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}">${d}</button>`).join('')}</div>
          <label class="cfield">${ic('tag')}<input data-cklabel value="${esc(E.label)}" placeholder="Label" aria-label="Label"></label>
          <button class="fexr2" type="button" data-cksnooze>${ic('alarm-clock')}<span>Snooze</span><i class="cfsw${E.snooze !== false ? ' on' : ''}"></i></button>${E.id ? `<button class="fexr2 red" type="button" data-ckaldel>${ic('trash-2')}<span>Delete alarm</span></button>` : ''}</div>
          <div class="ckalrow"><button class="bt fill" type="button" data-ckpx="alarm">Cancel</button><button class="bt pri" type="button" data-cksave>Save</button></div>`);
        requestAnimationFrame(() => $$('#cb-bar .ckwh').forEach(wh => { const on = wh.querySelector('.on'); if (on) wh.scrollTop = on.offsetTop - 80; let tm; wh.onscroll = () => { clearTimeout(tm); tm = setTimeout(() => { const i = Math.round(wh.scrollTop / 40), sp = wh.children[i + 2]; if (!sp || sp.textContent === '') return; wh.querySelectorAll('span').forEach(x => x.classList.toggle('on', x === sp)); const k = wh.dataset.ckwh, v = sp.textContent, H = Math.floor(CK.ed.m / 60), M = CK.ed.m % 60;
          if (k === 'h') CK.ed.m = (((+v % 12) + (H >= 12 ? 12 : 0)) * 60) + M; else if (k === 'm') CK.ed.m = H * 60 + +v; else CK.ed.m = ((H % 12) + (v === 'PM' ? 12 : 0)) * 60 + M; }, 90); }; })); return; }
      /* one row, as Phone: the four places as icon tabs, then what this place does, as icons */
      const kb = (attr, icn, label, cls = 'ib', off = false) => `<button class="${cls}" type="button" ${attr} aria-label="${label}" title="${label}"${off ? ' disabled' : ''}>${ic(icn)}</button>`;
      const a2 = CK.mode === 'clock' ? '' : CK.mode === 'alarms' ? kb('data-cknew', 'plus', 'New alarm', 'bt key ckk')
        : CK.mode === 'sw' ? kb(`data-cksw="${CK.sw.run ? 'lap' : 'reset'}"`, CK.sw.run ? 'flag' : 'rotate-ccw', CK.sw.run ? 'Lap' : 'Reset', 'ib', !CK.sw.run && !swMs()) + kb('data-cksw="toggle"', CK.sw.run ? 'pause' : 'play', CK.sw.run ? 'Stop' : swMs() ? 'Resume' : 'Start', 'bt key ckk' + (CK.sw.run ? ' stop' : ''))
        : kb('data-cktm2="cancel"', 'x', 'Cancel', 'ib', CK.tm.left === CK.tm.dur && !CK.tm.run && !CK.tm.done) + kb('data-cktm2="toggle"', CK.tm.run ? 'pause' : CK.tm.done ? 'rotate-ccw' : 'play', CK.tm.run ? 'Pause' : CK.tm.done ? 'Again' : CK.tm.left < CK.tm.dur ? 'Resume' : 'Start', 'bt key ckk' + (CK.tm.run ? ' stop' : ''));
      bar.classList.add('phnofit', 'ckphbar', 'cktabbar'); bar.classList.remove('phgrow');
      setBar(bar, `${MD.map(([k, i2, nm]) => `<button type="button" role="tab" class="ib cktab${CK.mode === k ? ' on' : ''}" data-ckm="${k}" aria-selected="${CK.mode === k}" aria-label="${nm}" title="${nm}">${ic(i2)}${k === 'alarms' && CK.alarms.some(x => x.on) ? `<em>${CK.alarms.filter(x => x.on).length}</em>` : (k === 'tm' && CK.tm.run) || (k === 'sw' && CK.sw.run) ? '<i class="ckrun"></i>' : ''}</button>`).join('')}${a2 ? `<span class="sp"></span>${a2}` : ''}`); $('#cb-bar').hidden = false; }
    else { $('#cb-bar').classList.remove('phnofit', 'ckphbar', 'phgrow'); setBar($('#cb-bar'), places + (acts ? `<span class="vr"></span>${acts}` : '')); $('#cb-bar').hidden = false; requestAnimationFrame(segs); }
    const nowM = baseMin(), sky = m === 'clock' ? cityKind(nowM) : m === 'alarms' ? 'n' : m === 'tm' ? 'g' : 'd'; $('#w-clock').dataset.sky = sky; cbLaps(); cbFrame(true); }
  function cbLaps() { const L = $('#cb-laps'); if (!L) return; const laps = CK.sw.laps, d = laps.map((x, i) => x - (laps[i - 1] || 0)), best = Math.min(...d), worst = Math.max(...d); $('#cb-lapsw').hidden = !laps.length;
    L.innerHTML = d.map((x, i) => ({ x, i })).reverse().map(({ x, i }) => { const t = d.length > 2 && x === best ? 'best' : d.length > 2 && x === worst ? 'worst' : ''; return `<div class="ckrow lap ${t}"><span class="ckrt"><b>${i + 1}</b>${t ? `<em>${t === 'best' ? 'Fastest' : 'Slowest'}</em>` : ''}</span><b class="num">${fmtSw(x)}</b><b class="num">${fmtSw(laps[i])}</b></div>`; }).join(''); }
  let cbMin = -1;
  function cbFrame(force) { const now = new Date(), m = CK.mode, big = $('#cb-big');
    if (m === 'clock' && big) { const [t, ap] = ckT(now.getHours() * 60 + now.getMinutes()); big.innerHTML = `${t}<small>:${pad2(now.getSeconds())}</small><small>${ap}</small>`; $('#cb-date').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + ' · Oakland';
      if (force || now.getMinutes() !== cbMin) { cbMin = now.getMinutes(); const base = baseMin(); const W = $('#cb-world'); W.innerHTML = CKC.filter(c => c[1]).map(([n, off]) => { const x = base + off * 60, k = cityKind(((x % 1440) + 1440) % 1440), day = x >= 1440 ? 'Tomorrow' : x < 0 ? 'Yesterday' : 'Today', [tt, aa] = ckT(x);
        return `<div class="ckcity lcard${CK.edit ? ' editing' : ''}" data-ckcard="${esc(n)}"><button class="ckrm" type="button" data-ckrm="${esc(n)}" aria-label="Remove ${esc(n)}">${ic('x')}</button><i class="ckgrip" aria-hidden="true">${ic('grip-vertical')}</i><span class="ckch"><b class="t-title-2">${n}</b><span title="${k === 'n' ? 'Night' : 'Day'}">${ic(k === 'n' ? 'moon' : 'sun')}</span></span><b class="cktime t-numeric">${tt}<small>${aa}</small></b><small class="t-caption">${day} · ${off > 0 ? '+' : ''}${off} h</small></div>`; }).join('') + `<button class="ckcity add" type="button" data-ckaddcity aria-label="Add a city">${ic('plus')}</button>`; } }
    else if (m === 'sw' && big) big.innerHTML = fmtSw(swMs());
    else if (m === 'tm' && big) { const l = tmLeft(); big.innerHTML = fmtTm(l); $('#cb-tmring').style.strokeDashoffset = (100 - (CK.tm.dur ? l / CK.tm.dur * 100 : 0)); $('#cb-cap').textContent = CK.tm.done ? `${CK.tm.label} is done` : CK.tm.run ? `Rings at ${new Date(Date.now() + l * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `${CK.tm.label} · ready`; const sd = $('#ck-tmside'); if (sd) sd.textContent = fmtTm(l); } }
  function ckRedraw() { cbBody(); }
  /* World: drag a city to move it. With a mouse, press and move; on a phone, hold a moment (or use the handle while editing). */
  (function ckDrag() { let st = null;
    const end = () => { if (!st) return; clearTimeout(st.tm); if (st.on) { st.card.classList.remove('dragging'); st.card.style.transform = ''; const order = [...st.grid.querySelectorAll('[data-ckcard]')].map(c => c.dataset.ckcard), home = CKC.filter(c => !c[1]); const by = Object.fromEntries(CKC.map(c => [c[0], c])); CKC.splice(0, CKC.length, ...home, ...order.map(n => by[n])); cbMin = -1; ckRedraw(); } document.body.classList.remove('ckdragging'); st = null; };
    document.addEventListener('pointerdown', e => { const card = e.target.closest?.('#w-clock [data-ckcard]'); if (!card || e.target.closest('[data-ckrm]') || e.button > 0) return;
      st = { card, grid: card.parentElement, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== 'mouse', grip: !!e.target.closest('.ckgrip') };
      if (st.touch && !st.grip) st.tm = setTimeout(() => { if (st) { st.on = true; if (!CK.edit) { CK.edit = true; st.grid.querySelectorAll('[data-ckcard]').forEach(c => c.classList.add('editing')); } card.classList.add('dragging'); document.body.classList.add('ckdragging'); navigator.vibrate?.(8); } }, 300); });
    document.addEventListener('pointerdown', e => { if (CK.edit && e.target.closest?.('#w-clock') && !e.target.closest('[data-ckcard]')) { CK.edit = false; cbMin = -1; ckRedraw(); } }, true);
    document.addEventListener('pointermove', e => { if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.on) { if (st.touch && !st.grip) { if (Math.hypot(dx, dy) > 8) { clearTimeout(st.tm); st = null; } return; } if (Math.hypot(dx, dy) < 6) return; st.on = true; st.card.classList.add('dragging'); document.body.classList.add('ckdragging'); }
      e.preventDefault(); st.card.style.transform = `translate(${dx}px, ${dy}px)`;
      st.card.style.pointerEvents = 'none'; const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ckcard]'); st.card.style.pointerEvents = '';
      if (over && over !== st.card && over.parentElement === st.grid) { const r0 = st.card.getBoundingClientRect(), cards = [...st.grid.querySelectorAll('[data-ckcard]')], after = cards.indexOf(over) > cards.indexOf(st.card); over[after ? 'after' : 'before'](st.card); const r1 = st.card.getBoundingClientRect(); st.x += r1.left - r0.left; st.y += r1.top - r0.top; st.card.style.transform = `translate(${e.clientX - st.x}px, ${e.clientY - st.y}px)`; } }, { passive: false });
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
    document.addEventListener('click', e => { if (document.body.classList.contains('ckdragging')) { e.stopPropagation(); e.preventDefault(); } }, true); })();
  const ckNarrow = () => { const w = $('#w-clock'); return !!w?.clientWidth && w.clientWidth < 560; };
  function ckClick(e, hit) { if (ckNarrow()) { const px = hit('[data-ckpx]'); if (px) { CK.px = CK.px ? '' : px.dataset.ckpx; if (!CK.px) CK.ed = null; cbBody(); return true; } if (hit('[data-ckm]')) CK.px = '';
      if (hit('[data-cknew]')) { CK.ed = { id: null, m: 420, label: 'Alarm', days: [], snooze: true }; CK.px = 'alarm'; cbBody(); return true; }
      const ed = hit('[data-ckedit]'); if (ed && !hit('.cksw')) { const a = CK.alarms.find(x => x.id === +ed.dataset.ckedit); const DS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; CK.ed = { id: a.id, m: a.m, label: a.label, days: a.days === 'Weekdays' ? [0, 1, 2, 3, 4] : a.days === 'Sat, Sun' ? [5, 6] : DS.map((d, i) => a.days.includes(d) ? i : -1).filter(i => i >= 0), snooze: true }; CK.px = 'alarm'; cbBody(); return true; }
      const dy = hit('[data-ckday]'); if (dy) { const i = +dy.dataset.ckday, D = CK.ed.days; CK.ed.days = D.includes(i) ? D.filter(x => x !== i) : [...D, i].sort(); dy.classList.toggle('on'); return true; }
      if (hit('[data-cksnooze]')) { CK.ed.snooze = CK.ed.snooze === false; hit('[data-cksnooze]').querySelector('.cfsw').classList.toggle('on'); return true; }
      if (hit('[data-cksave]')) { const E = CK.ed, lb = $('#cb-bar [data-cklabel]')?.value.trim() || 'Alarm', d = E.days.length === 7 ? 'Every day' : E.days.join() === '0,1,2,3,4' ? 'Weekdays' : E.days.join() === '5,6' ? 'Sat, Sun' : E.days.length ? E.days.map(i => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]).join(', ') : 'Tomorrow';
        if (E.id) Object.assign(CK.alarms.find(x => x.id === E.id), { m: E.m, label: lb, days: d, on: true }); else CK.alarms.push({ id: Date.now(), m: E.m, label: lb, days: d, on: true });
        const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), left = ((E.m - nm) + 1440) % 1440; CK.ed = null; CK.px = ''; cbBody(); ckToast(`Alarm set for ${Math.floor(left / 60)} h ${left % 60} min from now`); return true; }
      if (hit('[data-ckaldel]')) { const id = CK.ed.id, i = CK.alarms.findIndex(x => x.id === id), a = CK.alarms.splice(i, 1)[0]; CK.ed = null; CK.px = ''; cbBody(); lToast($('#w-clock'), 'Alarm deleted', { undo: () => { CK.alarms.splice(i, 0, a); cbBody(); } }); return true; } }
    const r = ckCommon(e, hit, ckRedraw); if (r && CK.mode === 'sw') cbLaps(); return r; }
  function renderClock() { $('#ck-top').innerHTML = `<img src="${A}clock.svg" alt=""><b>Clock</b><span class="chev">${ic('chevron-down')}</span>`; ckRedraw(); ckLoop(() => cbFrame()); }

  /* ══ Charlie ═════════════════════════════════════════════════════════════════
     Mail as conversation. A thread reads like Messages: one bubble per email, yours on the right.
     HTML mail arrives as paper; you write your reply as a bubble in place. The bar works on whatever
     you've picked: the thread, one message, an attachment, a sentence you selected, your draft. */
  const CRP = { MS: { n: 'Maya Singh', h: 20, mail: 'maya@fieldhouse.co' }, BO: { n: 'Ben Okoro', h: 140, mail: 'ben@simplyluma.com' }, EN: { n: 'Eli Novak', h: 285, mail: 'eli@simplyluma.com' } };
  const CRB = { rail: { n: 'Coastline Rail', mono: 'C', c: '#0f5d73', mail: 'tickets@coastlinerail.com' }, light: { n: 'Slow Light', mono: 'S', c: '#8a5a2b', mail: 'letters@slowlight.email' }, parcel: { n: 'Parcel & Post', mono: 'P', c: '#3d4b8f', mail: 'orders@parcelandpost.com' } };
  const crWho = k => k === 'me' ? { n: 'You' } : CRB[k] || PPL[k] || CRP[k] || { n: k, h: 250 };
  const crFirst = k => k === 'me' ? 'you' : CRB[k] ? CRB[k].n : crWho(k).n.split(' ')[0];
  const crAv = (k, sz) => CRB[k] ? `<i class="crbrand" style="width:${sz}px;height:${sz}px;background:${CRB[k].c};font-size:${Math.round(sz * .44)}px">${CRB[k].mono}</i>`
    : PPL[k] ? av(k, sz) : `<i class="av round crmono" style="width:${sz}px;height:${sz}px;background:oklch(0.6 0.1 ${crWho(k).h});font-size:${Math.round(sz * .38)}px">${crWho(k).n.split(' ').map(w => w[0]).join('').slice(0, 2)}</i>`;
  const crMail = k => k === 'me' ? 'nick@simplyluma.com' : crWho(k).mail || (crWho(k).u ? crWho(k).u + '@simplyluma.com' : '');

  /* HTML mail, as senders really send it: inline styles, fixed width, their own colours. */
  const crQR = () => { let s = ''; for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { const f = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13), ring = f && (x % 20 === 0 || y % 20 === 0 || x === 6 || y === 6 || x === 14 || y === 14 || ((x > 1 && x < 5 || x > 15 && x < 19) && (y > 1 && y < 5 || y > 15 && y < 19)));
    const on = f ? ring : ((x * 7 + y * 13 + x * y) % 5 < 2); s += `<i style="background:${on ? '#1d2230' : 'transparent'}"></i>`; } return s; };
  const CRH = {
    rail: () => `<body style="margin:0;background:#f1efe9;font:14px/1.5 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d2230"><div style="max-width:560px;margin:0 auto;padding:26px 22px 30px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px"><div style="width:30px;height:30px;border-radius:8px;background:#0f5d73;color:#fff;font-weight:700;display:grid;place-items:center">C</div><b style="font-size:15px">Coastline Rail</b><span style="margin-left:auto;font-size:12px;color:#6b7280">Booking CR-48213</span></div>
      <div style="background:#fff;border-radius:16px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;font-weight:600">Thursday, October 1 · One way</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin:12px 0 18px"><div><div style="font-size:32px;font-weight:700;letter-spacing:-.02em">7:05</div><div style="color:#4b5563">Oakland Jack London</div></div><div style="color:#9aa0a8;font-size:12px;padding-bottom:6px">1 h 52 m</div><div style="text-align:right"><div style="font-size:32px;font-weight:700;letter-spacing:-.02em">8:57</div><div style="color:#4b5563">Sacramento Valley</div></div></div>
        <div style="display:flex;gap:22px;align-items:center;border-top:1px dashed #d8d4ca;padding-top:18px"><div style="display:grid;grid-template-columns:repeat(21,1fr);width:118px;height:118px;flex:none">${crQR()}</div>
          <table style="font-size:13px;border-collapse:collapse;width:100%"><tr><td style="color:#6b7280;padding:3px 0">Passenger</td><td style="text-align:right;font-weight:600">Nick</td></tr><tr><td style="color:#6b7280;padding:3px 0">Coach · Seat</td><td style="text-align:right;font-weight:600">3 · 14A, window</td></tr><tr><td style="color:#6b7280;padding:3px 0">Fare</td><td style="text-align:right;font-weight:600">$31.00</td></tr></table></div></div>
      <p style="color:#6b7280;font-size:12.5px;margin:18px 2px">Show this code on board. Changes are free until two hours before departure.</p>
      <a style="display:inline-block;background:#0f5d73;color:#fff;padding:11px 18px;border-radius:10px;font-weight:600;font-size:13.5px">Add to calendar</a> <a style="display:inline-block;color:#0f5d73;padding:11px 12px;font-weight:600;font-size:13.5px">Manage booking</a></div></body>`,
    light: img => { const ph = (f, h) => img ? `<img src="../social-suno/photos/${f}.webp" style="display:block;width:100%;height:${h}px;object-fit:cover;border-radius:6px">` : `<div style="height:${h}px;border-radius:6px;background:#e6e0d6;display:grid;place-items:center;color:#a39b8f;font-size:12px">Image</div>`;
      return `<body style="margin:0;background:#fbf8f3;font:15px/1.65 Georgia,'Times New Roman',serif;color:#2a2622"><div style="max-width:580px;margin:0 auto;padding:30px 24px 36px">
      <div style="text-align:center;font:600 11px/1 -apple-system,Helvetica,sans-serif;letter-spacing:.24em;color:#8a5a2b;text-transform:uppercase">Slow Light · No. 112</div>
      <h1 style="font-weight:400;font-size:30px;line-height:1.2;text-align:center;margin:14px 0 22px">The hour after the golden hour</h1>
      ${ph('life-hero-studio', 280)}<p style="margin:18px 0">Everyone chases the gold. This week we stayed out after it, when the light goes blue and soft and a room starts to glow from the inside.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0">${ph('life-sync-terrace', 170)}${ph('life-professionals-loft', 170)}</div>
      <p style="margin:0 0 18px">Three things to try: expose for the window, not the room. Let the lamps clip. And wait ten minutes longer than feels reasonable.</p>
      <a style="display:inline-block;border:1px solid #2a2622;padding:10px 18px;border-radius:999px;font:600 13px -apple-system,Helvetica,sans-serif">Read the full letter</a>
      <p style="margin:30px 0 0;font:12px/1.5 -apple-system,Helvetica,sans-serif;color:#9a9186;text-align:center">You're getting this because you subscribed at slowlight.email. <u>Unsubscribe</u></p></div></body>`; },
    parcel: () => `<body style="margin:0;background:#eef0f6;font:14px/1.5 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e2233"><div style="max-width:540px;margin:0 auto;padding:26px 22px 30px">
      <b style="display:block;font-size:17px;color:#3d4b8f;margin-bottom:16px">Parcel &amp; Post</b>
      <div style="background:#fff;border-radius:14px;padding:22px 22px 12px"><div style="font-size:20px;font-weight:700">Thanks, Nick. It's on the way.</div><div style="color:#6b7280;margin:4px 0 16px">Order #2048 · arriving Friday, September 25</div>
        <table style="width:100%;border-collapse:collapse;font-size:13.5px">${[['Linen notebook, A5 × 2', '$24.00'], ['Brass pen, medium nib', '$38.00'], ['Shipping', '$0.00']].map(([a, b]) => `<tr><td style="padding:9px 0;border-top:1px solid #eceef4">${a}</td><td style="text-align:right;border-top:1px solid #eceef4">${b}</td></tr>`).join('')}
        <tr><td style="padding:12px 0;border-top:2px solid #1e2233;font-weight:700">Total</td><td style="text-align:right;border-top:2px solid #1e2233;font-weight:700">$62.00</td></tr></table></div>
      <a style="display:inline-block;margin-top:16px;background:#3d4b8f;color:#fff;padding:11px 18px;border-radius:10px;font-weight:600">Track package</a></div></body>`
  };

  /* Threads */
  const CRT = [
    { id: 'deck', subj: 'Launch walkthrough deck', box: 'inbox', flag: true, msgs: [
      { id: 'd1', from: 'PR', to: ['me', 'NF'], day: 'Tuesday', at: 'Tue 4:12 PM', text: ['Hi both,', 'Here’s v3 of the walkthrough deck. I moved the milestones slide up front and cut the pricing section; we can talk to that live.', 'Two things I need before Thursday:\n• Nick: the ISO timeline for slide 7\n• Nora: the homepage crop for slide 2'], sig: 'Priya Raman\nDesign lead, Suno', files: [{ n: 'launch-walkthrough-v3.stage', k: 'deck', sz: '18.4 MB' }, { n: 'milestones.pdf', k: 'pdf', sz: '412 KB' }] },
      { id: 'd2', from: 'NF', to: ['PR', 'me'], at: 'Tue 5:03 PM', text: ['Crop’s in. I went with the wider one; it breathes better on the slide.'], imgs: ['life-sync-terrace'], quote: 'On Tue, Sep 22, Priya Raman wrote:\nHere’s v3 of the walkthrough deck. I moved the milestones slide up front and cut the pricing section…' },
      { id: 'd3', from: 'me', to: ['PR', 'NF'], day: 'Yesterday', at: 'Wed 9:15 AM', text: ['Timeline is on slide 7: nightly ISO on the 28th, sign-off on the 30th, launch on the 1st.', 'Looks great, both of you.'] },
      { id: 'd4', from: 'PR', to: ['me', 'NF'], day: 'Today', at: '9:41 AM', un: true, text: ['Perfect. Last thing: can you both do a 20-minute dry run at 7:30 tonight? I’ll send an invite.'] }] },
    { id: 'lease', subj: 'Studio lease renewal', box: 'inbox', msgs: [
      { id: 'l1', from: 'TH', to: ['me'], day: 'Today', at: '8:02 AM', un: true, text: ['Hi Nick,', 'Attached is the draft for the 2027 renewal. Same terms as this year, except the landlord wants to move the rent review from January to March.', 'If that works for you, sign page 4 and I’ll send it over. Happy to walk through it by phone.'], sig: 'Theo Marsh\nMarsh & Co. Property · (510) 555-0199', files: [{ n: 'Lease-2027-draft.pdf', k: 'pdf', sz: '1.2 MB' }] }] },
    { id: 'rail', subj: 'Your tickets: Oakland to Sacramento', box: 'inbox', upd: true, msgs: [{ id: 'r1', from: 'rail', to: ['me'], day: 'Today', at: '7:30 AM', un: true, html: 'rail', snip: 'Thursday, October 1 · 7:05 → 8:57 · Coach 3, seat 14A' }] },
    { id: 'offsite', subj: 'Photos from the offsite', box: 'inbox', msgs: [
      { id: 'o1', from: 'SK', to: ['me'], day: 'Monday', at: 'Mon 6:40 PM', text: ['A few favorites. The full set is in Photos under “Offsite”.'], imgs: ['life-hero-studio', 'life-professionals-loft', 'life-work-suite', 'life-hero-writing'] },
      { id: 'o2', from: 'me', to: ['SK'], at: 'Mon 7:02 PM', text: ['These are great. The second one might be the new homepage.'] }] },
    { id: 'light', subj: 'The hour after the golden hour', box: 'inbox', upd: true, msgs: [{ id: 'g1', from: 'light', to: ['me'], day: 'Monday', at: 'Mon 6:00 AM', html: 'light', blocked: true, snip: 'Everyone chases the gold. This week we stayed out after it…' }] },
    { id: 'iso', subj: 'Re: ISO sign-off checklist', box: 'inbox', msgs: [
      { id: 'i1', from: 'BO', to: ['me', 'EN'], day: 'Sunday', at: 'Sun 11:20 AM', text: ['Checklist for the 30th. Anything missing?', '1. Clean boot on the ThinkPad and the test box\n2. Depot channels point at stable\n3. Release notes signed off\n4. Checksums published'], files: [{ n: 'signoff.sheet', k: 'sheet', sz: '48 KB' }] },
      { id: 'i2', from: 'EN', to: ['BO', 'me'], at: 'Sun 2:05 PM', text: ['Add “upgrade from the last nightly”. That’s what bit us last time.'] }] },
    { id: 'dinner', subj: 'Dinner Saturday?', box: 'inbox', acct: 'home', msgs: [
      { id: 'n1', from: 'MS', to: ['me'], day: 'Sep 19', at: 'Sat 3:30 PM', card: { t: 'Dinner at Maya’s', mon: 'Sep', day: '26', when: 'Saturday, 7:00 PM', where: 'Maya’s place', h: 150 }, text: ['We’re doing dinner at ours on the 26th. Seven-ish? Bring nothing, or maybe dessert.'] }] },
    { id: 'parcel', subj: 'Receipt for order #2048', box: 'inbox', acct: 'home', upd: true, msgs: [{ id: 'p1', from: 'parcel', to: ['me'], day: 'Sep 18', at: 'Fri 10:14 AM', html: 'parcel', snip: 'Thanks, Nick. It’s on the way. Arriving Friday, September 25.' }] },
    { id: 'speakers', subj: 'Speaker list for launch night', box: 'drafts', draft: 'Thinking Priya opens, then a two-minute demo, then', msgs: [] },
    { id: 'venue', subj: 'Venue confirmed', box: 'sent', msgs: [{ id: 'v1', from: 'me', to: ['NF', 'PR'], day: 'Sep 17', at: 'Thu 1:10 PM', text: ['The loft is booked for the 1st, 6 to 10 PM.'] }] }
  ];
  const CR = { px: '', det: false, keep: null, acct: 'all', comp: { text: '', mode: null, re: null }, box: 'inbox', unread: false, q: '', open: 'deck', bundle: false, sel: null, att: null, tsel: null, draft: null, full: {}, imgs: {}, quote: {}, newTo: [], newSubj: '' };
  const crT = id => CRT.find(t => t.id === id);
  const crOthers = t => [...new Set(t.msgs.flatMap(m => [m.from, ...(m.to || [])]))].filter(k => k !== 'me');
  const crLast = t => t.msgs[t.msgs.length - 1];
  const crUn = t => t.msgs.some(m => m.un);
  const crIsBrand = t => t.msgs[0] && CRB[t.msgs[0].from];
  const crSnip = t => { if (t.box === 'drafts') return t.draft; const m = crLast(t); return (m.from === 'me' ? 'You: ' : '') + (m.snip || (m.text || []).find(x => !/^(hi|hey)\b.*,$/i.test(x)) || ''); };
  const crNames = t => { const o = crOthers(t); return o.length === 1 ? crWho(o[0]).n : o.map(crFirst).join(', '); };
  const CRBOX = [['inbox', 'Inbox', 'inbox'], ['flagged', 'Flagged', 'star'], ['drafts', 'Drafts', 'file-text'], ['sent', 'Sent', 'send-horizontal'], ['archive', 'Archive', 'archive'], ['trash', 'Trash', 'trash-2']];
  const CRACCT = [['suno', 'Suno', 'nick@simplyluma.com', 250], ['home', 'Personal', 'nick@studionorth.net', 150]];
  const crInBox = (t, b, a = CR.acct) => (a === 'all' || (t.acct || 'suno') === a) && (b === 'flagged' ? t.flag && t.box !== 'trash' : t.box === b);
  /* Left column: every account, and the mailboxes inside it. */
  function crNav() { const un = (a, b = 'inbox') => CRT.filter(t => crInBox(t, b, a) && crUn(t)).length, cnt = (a, b) => CRT.filter(t => crInBox(t, b, a)).length;
    const item = (a, b, n, i, c) => `<button class="crni${CR.acct === a && CR.box === b ? ' on' : ''}" type="button" data-crnav="${a}:${b}">${ic(i)}<span>${n}</span>${lCount(c, b === 'inbox')}</button>`;
    $('#cr-nav').innerHTML = `
      ${item('all', 'inbox', 'All inboxes', 'inbox', un('all'))}${item('all', 'flagged', 'Flagged', 'star', cnt('all', 'flagged'))}
      ${CRACCT.map(([a, n, mail, h]) => `<div class="crnh"><i style="background:oklch(0.68 0.12 ${h})"></i><span><b>${n}</b><small>${mail}</small></span></div>
        ${item(a, 'inbox', 'Inbox', 'inbox', un(a))}${item(a, 'drafts', 'Drafts', 'file-text', cnt(a, 'drafts'))}${item(a, 'sent', 'Sent', 'send-horizontal', '')}${item(a, 'archive', 'Archive', 'archive', '')}${a === 'suno' ? item(a, 'trash', 'Trash', 'trash-2', '') : ''}`).join('')}
      <div class="crnh lbl"><span><b>Labels</b></span></div><button class="crni" type="button" data-crtodo="Launch: 4 threads"><i class="crlbl" style="background:oklch(0.72 0.14 30)"></i><span>Launch</span></button><button class="crni" type="button" data-crtodo="Receipts: 2 threads"><i class="crlbl" style="background:oklch(0.72 0.12 150)"></i><span>Receipts</span></button>
      <div class="crnfoot">${lAddRow('Add account', 'data-craddacct', 'plus')}</div>`; }

  function crRow(t, sub) { const m = crLast(t), un = crUn(t), o = crOthers(t), n = t.msgs.length;
    const face = crIsBrand(t) ? crAv(m.from, 38) : o.length > 1 ? `<span class="crstk">${o.slice(0, 2).map(k => crAv(k, 28)).join('')}</span>` : crAv(o[0] || 'me', 38);
    return `<button class="crrow${un ? ' un' : ''}${CR.open === t.id ? ' on' : ''}${sub ? ' sub' : ''}" type="button" data-crt="${t.id}">${face}<span class="crtx">
      <span class="l1"><b>${t.box === 'drafts' ? '<i class="crdr">Draft</i>' : ''}${esc(t.box === 'drafts' ? t.subj : crNames(t))}</b>${n > 1 ? lCount(n) : ''}<time>${m ? m.at.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d.*/, '$1') : ''}</time></span>
      <span class="l2">${t.box === 'drafts' ? '' : esc(t.subj)}${t.msgs.some(x => x.files || x.imgs) ? ic('paperclip') : ''}${t.flag ? `<i class="crfl">${ic('star')}</i>` : ''}${un ? '<i class="crdot"></i>' : ''}</span>
      <span class="l3">${esc(crSnip(t))}</span></span></button>`; }
  function crSide() { const b = CRBOX.find(x => x[0] === CR.box), q = CR.q.trim().toLowerCase();
    let list = CRT.filter(t => crInBox(t, CR.box) && (!CR.unread || crUn(t) || t.id === CR.keep) && (!q || (t.subj + ' ' + crNames(t) + ' ' + t.msgs.map(m => (m.text || []).join(' ')).join(' ')).toLowerCase().includes(q)));
    let rows = '';
    if (CR.box === 'inbox' && !q && list.length) { const ppl = list.filter(t => !t.upd), upd = list.filter(t => t.upd), nu = upd.filter(crUn).length;
      const bundle = upd.length ? `<button class="crrow bundle${CR.bundle ? ' open' : ''}" type="button" data-crbundle><span class="crstk sq">${upd.slice(0, 3).map(t => crAv(t.msgs[0].from, 26)).join('')}</span><span class="crtx"><span class="l1"><b>Updates</b>${lCount(nu, true)}<i class="crchev">${ic('chevron-down')}</i></span><span class="l3">${upd.map(t => CRB[t.msgs[0].from].n).join(', ')}</span></span></button>${CR.bundle ? upd.map(t => crRow(t, true)).join('') : ''}` : '';
      rows = ppl.slice(0, 2).map(t => crRow(t)).join('') + bundle + ppl.slice(2).map(t => crRow(t)).join(''); }
    else rows = list.map(t => crRow(t)).join('');
    if (!list.length) rows = `<div class="crnone2">${ic(CR.unread ? 'mail-check' : 'inbox')}<b>${q ? `Nothing matches “${esc(CR.q)}”` : CR.unread ? 'You’re all caught up' : `Nothing in ${b[1]}`}</b></div>`;
    const unread = CRT.filter(t => crInBox(t, CR.box) && crUn(t)).length;
    $('#cr-side').innerHTML = `<div class="crsh"><label class="srch">${ic('search')}<input placeholder="Search mail" value="${esc(CR.q)}" data-crq></label><button class="snew" type="button" data-crnew title="New email" aria-label="New email">${ic('square-pen')}</button></div>
      <div class="scr crlist">${rows}</div>
      <div class="sidetabs crtabs">${seg([['0', 'All'], ['1', `Unread${lCount(unread, true)}`]], CR.unread ? '1' : '0', 'data-crunv', 'Show')}</div>${crNarrow() || phTab() ? `<div class="fbar crlbar phnofit"><label class="srch keep">${ic('search')}<input placeholder="Search" value="${esc(CR.q)}" data-crq aria-label="Search mail"></label><button class="ib crunb${CR.unread ? ' on' : ''}" type="button" data-crunv="${CR.unread ? '0' : '1'}" aria-pressed="${CR.unread}" aria-label="${CR.unread ? 'Show all mail' : 'Show only unread'}" title="Only unread">${ic('mail-check')}${unread ? `<i class="crunn">${unread}</i>` : ''}</button><button class="bt pri" type="button" data-crnew aria-label="New email" title="New email">${ic('square-pen')}</button></div>` : ''}`; requestAnimationFrame(segs); }
  /* Charlie on a phone: the list's foot is the action bar (Search, Unread, New email). A thread's bar is two rows split by a
     hairline: the quick reply on top, then who you're answering (tap to switch Reply, Reply all, Forward) and the thread's
     actions. A selected message or attachment turns the bar into its actions. Menus and details grow the bar. */
  const crNarrow = () => { const w = $('#w-charlie'); return !!w?.clientWidth && w.clientWidth < 560; };
  function crBarPhone(bar, t) { const X = CR.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    bar.classList.add('phnofit', 'crphbar'); bar.classList.remove('comp'); bar.hidden = false;
    if (CR.att) { const [mid, j] = CR.att.split(':'), img = j[0] === 'i';
      bar.classList.remove('phgrow', 'cr2row'); setBar(bar, `<button class="bt pri crpo" type="button" data-cropen>${ic(img ? 'eye' : 'app-window')}<span>${img ? 'View' : 'Open'}</span></button>${ib('data-crsave', 'download', 'Save')}${ib(`data-crreply="one" data-crof="${mid}"`, 'reply', 'Reply')}${ib('data-crfwdatt', 'forward', 'Forward')}${ib('data-crdesel', 'x', 'Done')}`); return; }
    if (CR.sel) { const m = t.msgs.find(x => x.id === CR.sel), mine = m.from === 'me', many = (m.to || []).filter(k => k !== 'me').length + (mine ? 0 : 1) > 1;
      const panel = X === 'msg' ? `<div class="fexp fmore2">${crMi('data-crunread', 'mail', 'Mark unread from here')}${crMi('data-crsrc', 'file-text', 'Show original')}${crMi('data-crprint', 'printer', 'Print')}${crMi('data-crdel', 'trash-2', 'Delete message', ' red')}</div>` : '';
      bar.classList.toggle('phgrow', !!panel); bar.classList.remove('cr2row');
      setBar(bar, `${panel}${ib('data-crreply="one"', 'reply', 'Reply')}${many ? ib('data-crreply="all"', 'reply-all', 'Reply all') : ''}${ib('data-crreply="fwd"', 'forward', 'Forward')}${ib('data-crcopymsg', 'copy', 'Copy text')}${ib('data-crpx="msg"', 'ellipsis', 'More', X === 'msg')}${ib('data-crdesel', 'x', 'Done')}`); return; }
    const brand = crIsBrand(t), c = CR.comp, many = crOthers(t).length > 1, mode = c.mode || (many ? 'all' : 'one'), to = mode === 'all' ? crOthers(t) : [c.re ? (c.re.from === 'me' ? c.re.to[0] : c.re.from) : (crLast(t).from === 'me' ? crLast(t).to[0] : crLast(t).from)];
    const o = crOthers(t), acct = CRACCT.find(a => a[0] === (t.acct || 'suno')), nf = t.msgs.reduce((n, m) => n + (m.files || []).length + (m.imgs || []).length, 0);
    const panel = X === 'mode' ? `<div class="fexp fmore2">${[['one', 'reply', `Reply to ${esc(crFirst(c.re ? c.re.from : crLast(t).from === 'me' ? crLast(t).to[0] : crLast(t).from))}`], ...(many ? [['all', 'reply-all', 'Reply all']] : []), ['fwd', 'forward', 'Forward']].map(([k, i, n]) => crMi(`data-crcmodeset="${k}"`, i, n, mode === k ? ' on' : '')).join('')}</div>`
      : X === 'more' ? `<div class="fexp fmore2">${crMi('data-crpx="info"', 'info', 'Details')}${crMi('data-crunread', 'mail', 'Mark unread')}${crMi('data-crmove', 'folder', 'Move to…')}${crMi('data-crmute', 'bell-off', 'Mute this thread')}${t.id === 'light' ? crMi('data-crunsub', 'bell-off', 'Unsubscribe') : ''}${crMi('data-crprint', 'printer', 'Print')}${crMi('data-crdel', 'trash-2', 'Delete thread', ' red')}</div>`
      : X === 'info' ? `<div class="fexp crinfo2"><button class="fexr2 fback" type="button" data-crpx="more">${ic('chevron-left')}<span>Details</span></button>${[...o, ...(o.length > 1 ? ['me'] : [])].map(k => `<div class="crprow">${crAv(k, 36)}<span><b>${esc(k === 'me' ? 'You' : crWho(k).n)}</b><small>${esc(crMail(k))}</small></span></div>`).join('')}
        <dl><dt>Messages</dt><dd>${t.msgs.length}</dd><dt>Account</dt><dd>${acct ? acct[1] : 'Suno'}</dd>${nf ? `<dt>Attachments</dt><dd>${nf}</dd>` : ''}</dl></div>` : '';
    bar.classList.toggle('phgrow', !!panel); bar.classList.add('cr2row');
    const row1 = brand ? '' : `<div class="crr1">${c.re ? `<div class="crcre">${ic('reply')}<span>Replying to <b>${esc(crFirst(c.re.from))}’s</b> message</span><button type="button" class="crx" data-crcrex aria-label="Cancel">${ic('x')}</button></div>` : ''}<div class="crcrow"><button class="crqf" type="button" data-crexpand>${ic('reply')}<span>${CR.keep?.t === CR.open && CR.keep.html ? `Draft: ${esc(CR.keep.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim())}` : `Reply to ${esc(to.map(crFirst).join(' and '))}…`}</span></button>${ib('data-cradd2', 'paperclip', 'Attach')}</div></div>`;
    const who = brand ? `<span class="crwho2">${crAv(t.msgs[0].from, 30)}<span><b>${esc(crWho(t.msgs[0].from).n)}</b><small>${esc(crMail(t.msgs[0].from))}</small></span></span>`
      : `<button class="crwho2${X === 'mode' ? ' on' : ''}" type="button" data-crpx="mode" aria-expanded="${X === 'mode'}" title="Reply, reply all or forward">${ic(mode === 'all' ? 'reply-all' : 'reply')}<span><b>${mode === 'all' ? 'Reply all' : 'Reply'}</b><small>to ${esc(to.map(crFirst).join(', '))}</small></span>${ic('chevron-down')}</button>`;
    setBar(bar, `${panel}<div class="crr2">${who}<span class="sp"></span>${ib('data-crarch', 'archive', 'Archive')}${ib('data-crstar', 'star', t.flag ? 'Unflag' : 'Flag', t.flag)}${ib('data-crpx="more"', 'ellipsis', 'More', X === 'more' || X === 'info')}</div>${row1}`); }

  /* What a thread is: who's in it, then the facts. On a phone the title island grows into this */
  function crInfoBody(t) { const o = crOthers(t), acct = CRACCT.find(a => a[0] === (t.acct || 'suno')), nf = t.msgs.reduce((n, m) => n + (m.files || []).length + (m.imgs || []).length, 0);
    return `${[...o, ...(o.length > 1 ? ['me'] : [])].map(k => `<div class="crprow">${crAv(k, 36)}<span><b>${esc(k === 'me' ? 'You' : crWho(k).n)}</b><small>${esc(crMail(k))}</small></span></div>`).join('')}
        <dl><dt>Messages</dt><dd>${t.msgs.length}</dd><dt>Account</dt><dd>${acct ? acct[1] : 'Suno'}</dd>${nf ? `<dt>Attachments</dt><dd>${nf}</dd>` : ''}</dl>`; }
  function crHead() { const h = $('#cr-head');
    if (CR.open === 'new') { h.innerHTML = ''; return; }
    const t = crT(CR.open); if (!t || t.box === 'drafts') { h.innerHTML = ''; return; }
    const brand = crIsBrand(t), o = crOthers(t), n = t.msgs.length;
    if (crNarrow() || phWide()) { h.innerHTML = `<div class="crisl${CR.isl ? ' open' : ''}"><div class="crislr"><button class="crislb" type="button" data-crback aria-label="Back to ${esc(CR.box === 'inbox' ? 'the inbox' : CR.box)}">${ic('chevron-left')}</button><button class="crisli" type="button" data-crisl aria-expanded="${!!CR.isl}" aria-label="${esc(t.subj)}. Details">${brand ? crAv(t.msgs[0].from, 30) : `<span class="crstk">${o.slice(0, 2).map(k => crAv(k, 30)).join('')}</span>`}<span><b>${esc(t.subj)}</b><small>${esc(crNames(t))}${n > 1 ? ` \u00b7 ${n} messages` : ''}</small></span></button></div>${CR.isl ? `<div class="crislp crinfo2">${crInfoBody(t)}</div>` : ''}</div>`; return; }
    h.innerHTML = `<button class="flo crsubj" type="button" data-crppl title="Who's in this conversation">${brand ? crAv(t.msgs[0].from, 36) : `<span class="crstk">${o.slice(0, 3).map(k => crAv(k, 36)).join('')}</span>`}<span><b>${esc(t.subj)}</b><small>${brand ? esc(crMail(t.msgs[0].from)) : `${esc(o.map(crFirst).join(', '))} and you${n > 1 ? ` \u00b7 ${n} messages` : ''}`}</small></span>${ic('chevron-down')}</button>
      <div class="flo crright">${brand && t.id === 'light' ? `<button class="bt" type="button" data-crunsub>Unsubscribe</button><span class="vr"></span>` : ''}<button class="ib" type="button" data-crarch title="Archive" aria-label="Archive">${ic('archive')}</button><button class="ib${t.flag ? ' on flag' : ''}" type="button" data-crstar title="${t.flag ? 'Unflag' : 'Flag'}" aria-label="Flag" aria-pressed="${!!t.flag}">${ic('star')}</button><button class="ib${CR.det ? ' on' : ''}" type="button" data-crppl title="Details" aria-label="Details">${ic('info')}</button><button class="ib" type="button" data-crmore="thread" title="More">${ic('ellipsis')}</button></div>`; }

  const CRFT = { deck: ['STAGE', 'oklch(0.66 0.15 55)'], pdf: ['PDF', 'oklch(0.6 0.17 25)'], sheet: ['SHEET', 'oklch(0.6 0.13 150)'], img: ['PNG', 'oklch(0.6 0.12 250)'], zip: ['ZIP', 'oklch(0.55 0.02 250)'] };
  const crFile = (f, key) => lFile(f, { tag: 'button', sel: CR.att === key, attr: `data-cratt="${key}"`, open: `data-crofile="${key}"` });
  function crText(m) { const paras = (m.text || []).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    return paras + (m.quote ? `<button class="crqt" type="button" data-crqt="${m.id}" title="${CR.quote[m.id] ? 'Hide' : 'Show'} quoted text">${CR.quote[m.id] ? 'Hide quoted text' : '•••'}</button>${CR.quote[m.id] ? `<blockquote>${esc(m.quote).replace(/\n/g, '<br>')}</blockquote>` : ''}` : '')
      + (m.sig ? `<div class="crsig">${esc(m.sig).replace(/\n/g, '<br>')}</div>` : ''); }
  function crPaper(m) { const open = CR.full[m.id], img = !m.blocked || CR.imgs[m.id];
    return `<div class="crpaper${open ? ' open' : ''}"><iframe sandbox="allow-same-origin" scrolling="no" title="Email" data-crif="${m.id}" srcdoc="${esc(CRH[m.html](img))}"></iframe><i class="crfade"></i></div>
      <div class="crpbar">${m.blocked && !img ? `<span class="crpriv">${ic('shield')}Images hidden to keep you private</span><button class="bt sm" type="button" data-crimgs="${m.id}">Load images</button>` : '<span></span>'}<button class="bt sm fill" type="button" data-crfull="${m.id}">${open ? 'Show less' : 'Show full email'}</button></div>`; }
  function crMsgHTML(t, m) { const out = m.from === 'me';
    const media = (m.imgs ? `<div class="crimgs n${Math.min(m.imgs.length, 4)}">${m.imgs.map((f, j) => `<button class="crimg${CR.att === m.id + ':i' + j ? ' sel' : ''}" type="button" data-cratt="${m.id}:i${j}" style="background-image:url(${PH}${f}.webp)" aria-label="Photo"></button>`).join('')}</div>` : '')
      + (m.files ? `<div class="crfiles">${m.files.map((f, j) => crFile(f, m.id + ':' + j)).join('')}</div>` : '') + (m.card ? lEventCard(m.card) : '');
    return `<div class="crmsg ${out ? 'out' : 'in'}${m.html ? ' html' : ''}${CR.sel === m.id ? ' sel' : ''}" data-crm="${m.id}">${out ? '' : `<span class="crwho">${crAv(m.from, 34)}</span>`}
      <div class="crcol">${out ? '' : `<span class="crmav">${crAv(m.from, 26)}</span>`}<div class="crmeta">${out ? '' : `<b>${esc(crWho(m.from).n)}</b>`}${m.to && !m.html && (m.to.length > 1 || out) ? `<span>to ${esc(m.to.map(crFirst).join(', '))}</span>` : ''}<time>${m.sending ? 'Sending…' : m.at}${out && !m.sending && m.fresh ? ' · Sent' : ''}</time></div>
      <div class="crbub${m.html ? ' paper' : ''}">${m.html ? crPaper(m) : crText(m)}</div>${media}</div></div>`; }
  function crDraftHTML() { const d = CR.draft, names = d.to.map(k => crWho(k).n).join(', ');
    return `<div class="crmsg out draft" id="cr-draft"><div class="crcol"><div class="crmeta"><span class="crtol">${d.mode === 'new' ? 'New email' : d.mode === 'fwd' ? 'Forward' : d.mode === 'all' ? 'Reply all' : 'Reply'}${names ? ` · to ${esc(names)}` : d.mode === 'fwd' ? ' · choose who' : ''}</span></div>
      <div class="crbub">${d.re ? `<div class="crqs"><b>${esc(crWho(d.re.from).n)}</b>${esc(d.re.text)}</div>` : ''}${d.mode === 'fwd' && d.fwd ? `<div class="crfwd">${ic('forward')}<span><b>${esc(d.fwd.subj)}</b><small>${d.fwd.n} message${d.fwd.n > 1 ? 's' : ''}${d.fwd.files ? ` · ${d.fwd.files} attachment${d.fwd.files > 1 ? 's' : ''}` : ''} included</small></span></div>` : ''}
        <div class="crdraft" contenteditable="true" spellcheck="true" data-ph="${d.mode === 'fwd' ? 'Add a note (optional)' : d.mode === 'new' ? 'Write your email…' : 'Write your reply…'}">${d.html || ''}</div>
        <div class="crfiles crdatts">${d.atts.map((f, j) => `<span class="crf mini"><span class="crft" style="background:${CRFT[f.k][1]}">${CRFT[f.k][0]}</span><span><b>${esc(f.n)}</b><small>${f.sz}</small></span><button type="button" class="crx" data-crunatt="${j}" aria-label="Remove">${ic('x')}</button></span>`).join('')}</div></div></div></div>`; }
  function crBody() { const b = $('#cr-body'), t = crT(CR.open);
    if (CR.open === 'new') { b.innerHTML = `<div class="crpad crnewpad"></div>`; crPadFit(); return; }
    if (!t) { b.innerHTML = `<div class="crempty">${ic('mail')}<b>Nothing open</b><span>Pick a conversation, or start a new one.</span></div>`; return; }
    if (t.box === 'drafts') { crStartNew(t); return; }
    let day = '';
    const html = t.msgs.map(m => { const d = m.day && m.day !== day ? (day = m.day, `<div class="crday">${m.day}</div>`) : ''; return d + crMsgHTML(t, m); }).join('');
    const top = crNarrow() ? (() => { const o = crOthers(t), brand = crIsBrand(t), first = t.msgs[0], n = t.msgs.length, one = brand || o.length === 1, k1 = brand ? first.from : o[0];
      return `<div class="crtop2"><h1>${esc(t.subj)}</h1><button class="crsc" type="button" data-crpx="info" title="Details">${one ? crAv(k1, 44) : `<span class="crstk">${o.slice(0, 3).map(k => crAv(k, 36)).join('')}</span>`}
        <span class="crsct"><b>${esc(one ? crWho(k1).n : o.map(crFirst).join(', ') + ' and you')}</b><small>${esc(one ? crMail(k1) : `${o.length + 1} people`)}</small></span>
