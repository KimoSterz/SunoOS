      <div class="dskparts" role="listbox" aria-label="Volumes">${lTHead.grid([['', ''], ['', 'Volume'], ['', 'Size'], ['', 'Format'], ['', 'Mounted at']], null, '', 'dskph')}${segs.map(s => `<button class="dskpr${DSS.vol === s.i ? ' on' : ''}" type="button" role="option" aria-selected="${DSS.vol === s.i}" data-dskv="${s.i}"><i class="dsksw${s.free ? ' free' : ''}" style="background:${DSKC[s.c] || ''}"></i><b>${esc(s.n)}</b><span>${dskSize(s.size)}</span><span>${s.free ? '' : (s.luks ? 'LUKS · ' : '') + s.fs}</span><span class="mono">${s.free ? '' : s.locked ? 'Locked' : s.mount || 'Not mounted'}</span></button>`).join('')}</div>
      <div class="dskused"><span>${dskSize(used)} used of ${dskSize(d.size)}</span>${segs.some(s => s.free) ? `<span>${dskSize(segs.find(s => s.free).size)} unallocated</span>` : ''}</div>
      ${v.free ? `<section class="dskcard"><div class="dskvh"><i class="dsksw free"></i><h2>Free space</h2></div><dl class="dskdl"><div><dt>Size</dt><dd>${dskSize(v.size)}</dd></div><div><dt>After</dt><dd>${esc(segs[v.i - 1]?.n || 'Start of drive')}</dd></div><div><dt>Device</dt><dd class="mono">${d.dev}</dd></div></dl></section>`
        : `<section class="dskcard"><div class="dskvh"><i class="dsksw" style="background:${DSKC[v.c]}"></i><h2>${esc(v.n)}</h2>${v.sys ? `<span class="dsktag" title="Suno is running from this volume">${ic('lock')}System</span>` : ''}${v.luks ? `<span class="dsktag">${ic(v.locked ? 'lock' : 'lock-open')}${v.locked ? 'Locked' : 'Unlocked'}</span>` : ''}</div>
          ${v.locked ? '' : `<div class="dskbar"><i style="width:${v.used / v.size * 100}%;background:${DSKC[v.c]}"></i></div><div class="dskbu"><span><b>${dskSize(v.used)}</b> used</span><span><b>${dskSize(v.size - v.used)}</b> free</span></div>`}
          <dl class="dskdl">
            <div><dt>Device</dt><dd class="mono">${d.dev}${v.part}</dd></div><div><dt>Partition</dt><dd>${v.part.replace('p', '')} · ${v.fs === 'FAT32' && v.sys ? 'EFI System' : 'Linux filesystem'}</dd></div><div><dt>UUID</dt><dd class="mono"><button type="button" class="dsklink" data-dsktodo="Copied the UUID">${v.uuid.slice(0, 18)}${v.uuid.length > 18 ? '…' : ''}</button></dd></div></dl></section>`}
      <div class="dsktwo"><section class="dskcard sm"><div class="dskch"><h3>Health</h3><button class="bt sm fill" type="button" data-dsksheet="health"${H[0] === 'none' ? ' disabled title="This drive doesn’t report SMART data"' : ''}>SMART data</button></div>
          ${H[2].length ? `<dl class="dskfacts">${H[2].map(([a, b, w]) => `<div${w ? ' class="warn"' : ''}><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>` : '<dl class="dskfacts"><div><dt>SMART</dt><dd>Not supported by this drive</dd></div></dl>'}</section>
        <section class="dskcard sm"><div class="dskch"><h3>Speed</h3><button class="bt sm fill" type="button" data-dsksheet="bench">Test speed</button></div><dl class="dskfacts"><div><dt>Read</dt><dd>${d.speed[0].toLocaleString()} MB/s</dd></div><div><dt>Write</dt><dd>${d.speed[1] ? d.speed[1].toLocaleString() + ' MB/s' : 'Read-only'}</dd></div><div><dt>Measured</dt><dd>${DSS.bench?.r.length >= 60 ? 'Just now' : '14 Sep'}</dd></div></dl></section></div></div>`; }
  /* Disks on a phone: the bar is two rows. On top, the drive (tap to switch drives, which replaces the sidebar) and the
     drive's own ⋯; under a hairline, what you can do to the chosen volume, Mount or Unlock first. Every dialog (format,
     new volume, SMART, speed test, unlock, rename, resize, delete) grows the bar instead of floating a card. */
  const dskNarrow = () => { const w = $('#w-disks'); return !!w?.clientWidth && w.clientWidth < 560; };
  function dskBarPhone(bar, d, s) { const X = DSS.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    bar.classList.add('phnofit', 'dskphbar'); $('#dsk-sheet').classList.remove('on');
    let panel = '';
    if (DSS.sheet) panel = `<div class="fexp dskpan">${DSS.sheetHTML || ''}</div>`;
    else if (X === 'drives-off') { const grp = g => DSK.filter(x => x.grp === g).map(x => `<button class="fexr2${x.id === DSS.cur ? ' on' : ''}" type="button" data-dskd="${x.id}">${ic(dskIco(x.kind))}<span>${esc(x.n)}<small>${esc(x.model)}</small></span>${x.health[0] === 'warn' ? '<i class="dskwarn"></i>' : ''}<em>${dskSize(x.size)}</em></button>`).join('');
      panel = `<div class="fexp fmore2 dskdrv"><div class="fexh">This computer</div>${grp('In this computer')}${DSK.some(x => x.grp === 'Plugged in') ? `<div class="fexh">Plugged in</div>${grp('Plugged in')}` : ''}${DSK.some(x => x.grp === 'Disk images') ? `<div class="fexh">Disk images</div>${grp('Disk images')}` : ''}<button class="fexr2" type="button" data-dskattach>${ic('plus')}<span>Attach a disk image</span></button><div class="fexh">${esc(d.n)}</div>${dskDrive(d)}</div>`; }
    else if (X === 'dmenu') panel = `<div class="fexp fmore2 dskmn">${dskDrive(d)}</div>`;
    else if (X === 'vmenu' && s && !s.free) { const ro = s.fs === 'ISO 9660', sys = s.sys, L = (on, a) => on ? `disabled title="Suno is running from ${esc(s.n)}"` : a;
      panel = `<div class="fexp fmore2 dskmn">${sys ? `<p class="dsksysn">${ic('lock')}<span>Suno runs from ${esc(s.n)}, so it can’t be resized, repaired or deleted while it’s running.</span></p>` : ''}${(ro ? '' : crMi('data-dsksheet="rename"', 'pencil', 'Rename') + crMi(L(sys, 'data-dsksheet="resize"'), 'arrow-left-right', 'Resize')) + (s.locked || ro ? '' : crMi('data-dskrun="check"', 'check-check', 'Check filesystem') + crMi(L(sys, 'data-dskrun="repair"'), 'wrench', 'Repair filesystem')) + (s.luks && !s.locked ? crMi('data-dsklock', 'lock', 'Lock') : '') + crMi('data-dsktodo="Choose where to save the image"', 'copy', 'Create partition image') + crMi(L(sys, 'data-dskdel'), 'trash-2', 'Delete volume', ' red')}</div>`; }
    /* the drive is navigation: a title island top left that grows into the drives and the drive's actions */
    { const grp = g => DSK.filter(x => x.grp === g).map(x => `<button class="fexr2${x.id === DSS.cur ? ' on' : ''}" type="button" data-dskd="${x.id}">${ic(dskIco(x.kind))}<span>${esc(x.n)}<small>${esc(x.model)}</small></span>${x.health[0] === 'warn' ? '<i class="dskwarn"></i>' : ''}<em>${dskSize(x.size)}</em></button>`).join('');
      let isl = $('#dsk-isl'); if (!isl) { $('#dsk-main').insertAdjacentHTML('beforeend', '<div class="dskisl" id="dsk-isl"></div>'); isl = $('#dsk-isl'); }
      isl.classList.toggle('open', !!DSS.isl);
      isl.innerHTML = `<button class="dskislr" type="button" data-dskisl aria-expanded="${!!DSS.isl}"><i class="dskisli">${ic(DSS.isl ? 'x' : dskIco(d.kind))}</i><span><b>${esc(d.n)}</b><small>${dskSize(d.size)}${d.health[0] === 'none' ? '' : ` · ${d.health[1]}`}</small></span>${ic('chevron-down')}</button>${DSS.isl ? `<div class="dskislp fmore2"><div class="fexh">This computer</div>${grp('In this computer')}${DSK.some(x => x.grp === 'Plugged in') ? `<div class="fexh">Plugged in</div>${grp('Plugged in')}` : ''}${DSK.some(x => x.grp === 'Disk images') ? `<div class="fexh">Disk images</div>${grp('Disk images')}` : ''}<button class="fexr2" type="button" data-dskattach>${ic('plus')}<span>Attach a disk image</span></button><div class="fexh">${esc(d.n)}</div>${dskDrive(d)}</div>` : ''}`; }
    bar.classList.toggle('phgrow', !!panel);
    const top = '', _old = `<div class="dskr1"><button class="dskdrv2${X === 'drives' ? ' on' : ''}" type="button" data-dskpx="drives" aria-expanded="${X === 'drives'}">${ic(dskIco(d.kind))}<span><b>${esc(d.n)}</b><small>${dskSize(d.size)}${d.health[0] === 'warn' ? ' · needs attention' : ''}</small></span>${ic('chevron-down')}</button></div>`;
    let acts = '';
    if (!s) acts = '';
    else if (s.free) acts = `<button class="bt key dskk" type="button" data-dsksheet="create" aria-label="New volume" title="New volume">${ic('plus')}</button>`;
    else if (s.locked) acts = `<button class="bt key dskk" type="button" data-dsksheet="unlock" aria-label="Unlock ${esc(s.n)}" title="Unlock">${ic('lock-open')}</button>${ib('data-dsksheet="format"', 'eraser', 'Format')}${ib('data-dskpx="vmenu"', 'ellipsis', 'More', X === 'vmenu')}`;
    else { const ro = s.fs === 'ISO 9660';
      acts = `${s.sys ? '' : `<button class="ib" type="button" data-dskmount aria-label="${s.mount ? 'Unmount' : 'Mount'}" title="${s.mount ? 'Unmount' : 'Mount'}">${ic(s.mount ? 'eject' : 'hard-drive')}</button>`}${s.mount ? ib(`data-dsktodo="Opening ${s.mount} in Filer"`, 'folder-open', 'Open in Filer') : ''}${s.sys || ro ? '' : ib('data-dsksheet="format"', 'eraser', 'Format')}${ib('data-dskpx="vmenu"', 'ellipsis', 'More', X === 'vmenu')}`; }
    const vchip = s ? `<span class="dskvchip" title="${s.sys ? `Suno runs from ${esc(s.n)}` : ''}"><i style="--c:${s.free ? 'transparent' : DSKC[s.c] || 'transparent'}"${s.free ? ' class="free"' : ''}></i><b>${esc(s.free ? 'Free space' : s.n)}</b>${s.sys || s.locked ? ic('lock') : ''}</span><span class="sp"></span>` : '';
    setBar(bar, `${panel}${acts ? `<div class="dskr2">${acts}</div>` : ''}`);
    if (DSS.sheet) requestAnimationFrame(() => { const p = $('#dsk-bar .dskpan'); if (p) p.scrollTop = DSS.panScroll || 0; }); }
  function dskBar() { const d = dskD(), s = dskSegs(d)[DSS.vol], bar = $('#dsk-bar'); let h;
    if (dskNarrow()) return dskBarPhone(bar, d, s); bar.classList.remove('phnofit', 'dskphbar', 'phgrow');
    if (!s) h = ''; else if (s.free) h = `<button class="bt key" type="button" data-dsksheet="create">${ic('plus')}New volume…</button><span class="vr"></span><button class="ib" type="button" data-dskdmenu title="Drive">${ic('ellipsis')}</button>`;
    else if (s.locked) h = `<button class="bt key" type="button" data-dsksheet="unlock">${ic('lock-open')}Unlock…</button><button class="bt" type="button" data-dsksheet="format">Format…</button><span class="vr"></span><button class="ib" type="button" data-dskvmenu title="More">${ic('ellipsis')}</button>`;
    else { const lk = s.sys ? ` disabled title="Suno is running from ${esc(s.n)}"` : '';
      h = `<button class="bt${s.sys ? ' lk' : ' key'}" type="button" data-dskmount${lk}>${ic(s.sys ? 'lock' : s.mount ? 'eject' : 'hard-drive')}${s.mount ? 'Unmount' : 'Mount'}</button>${s.mount ? `<button class="bt" type="button" data-dsktodo="Opening ${s.mount} in Filer">${ic('folder')}Open</button>` : ''}${(() => { const ro = s.fs === 'ISO 9660', no = s.sys || ro; return `<button class="bt${no ? ' lk' : ''}" type="button" data-dsksheet="format"${s.sys ? lk : ro ? ' disabled title="Disk images are read-only"' : ''}>${no ? ic('lock') : ''}Format…</button>`; })()}<span class="vr"></span><button class="ib" type="button" data-dskvmenu title="More">${ic('ellipsis')}</button>`; }
    setBar(bar, h); }
  function dskAll() { dskSide(); dskMain(); dskBar(); dskSheet(); }
  const dskDrive = d => crMi('data-dsksheet="health"', 'shield-check', 'SMART data and self-tests') + crMi('data-dsksheet="bench"', 'gauge', 'Test speed') + crMi('data-dsktodo="Standby after 10 minutes, write cache on"', 'settings-2', 'Drive settings…') + crMi('data-dsktodo="Choose where to save the image"', 'copy', 'Create disk image…')
    + (d.fixed ? '' : crMi('data-dsktodo="Choose an image. The whole drive will be replaced"', 'rotate-ccw', 'Restore disk image…') + crMi('data-dskoff', 'power', d.kind === 'iso' ? 'Detach' : 'Power off') + '<span class="crsep"></span>' + crMi('data-dsksheet="disk"', 'trash-2', 'Format disk…', ' red'));
  const dskToast = msg => lToast($('#w-disks'), msg, { icon: /^Copied/.test(msg) ? 'copy' : 'check' });   // the SunoUI toast
  function dskPop(anchor, html, up) { $('#dsk-pop')?.remove(); const w = $('#w-disks'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop ldrawer" id="dsk-pop">${html}</div>`); const p = $('#dsk-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.right - wr.left - p.offsetWidth)) + 'px'; if (up) p.style.bottom = (wr.bottom - r.top + 8) + 'px'; else p.style.top = (r.bottom - wr.top + 6) + 'px'; }
  const DSKFS = [['btrfs', 'For Suno', 'Btrfs. Snapshots and compression; only Linux reads it.'], ['ext4', 'For Suno and other Linux', 'Ext4. Simple and dependable.'], ['exfat', 'For every computer', 'exFAT. Windows, Mac and Linux can all read and write it.'], ['ntfs', 'For Windows', 'NTFS. Best if it will live on a Windows computer.'], ['fat32', 'For older devices', 'FAT32. Cameras, TVs and consoles. Files up to 4 GB.']];
  function dskSheet() { const box = $('#dsk-sheet'), d = dskD(), s = dskSegs(d)[DSS.vol], k = DSS.sheet; box.classList.toggle('on', !!k && !dskNarrow()); if (!k) { box.innerHTML = ''; DSS.sheetHTML = ''; if (dskNarrow() && $('#dsk-bar .dskpan')) dskBar(); return; } const f = DSS.f = DSS.f || { fs: 'exfat', name: s?.n || 'Untitled', erase: 'quick', luks: false, size: s ? Math.round(s.size) : 0, typed: '', step: 1, pass: '' };
    let h = '';
    if (k === 'format' || k === 'create' || k === 'disk') { const target = k === 'disk' ? d.n : s.free ? 'the free space' : s.n;
      h = f.step === 1 ? `<h2>${k === 'create' ? 'New volume' : k === 'disk' ? `Format all of ${esc(d.n)}` : `Format ${esc(s.n)}`}</h2><p class="dsksub">${k === 'create' ? `Make a volume from ${dskSize(s.size)} of free space.` : k === 'disk' ? 'Every volume on this drive will be erased and replaced with one new volume.' : 'Formatting erases everything on this volume.'}</p>
        <label class="dskfld"><span>Name</span><input data-dskname value="${esc(f.name)}"></label>
        ${k === 'create' ? `<label class="dskfld"><span>Size <em>${dskSize(f.size)} of ${dskSize(s.size)}</em></span><input type="range" min="1" max="${Math.round(s.size)}" value="${f.size}" data-dsksize></label>` : ''}
        <div class="dskfs">${DSKFS.map(([id, n, dsc]) => `<button type="button" class="${f.fs === id ? 'on' : ''}" data-dskfs="${id}"><i></i><span><b>${n}</b><small>${dsc}</small></span></button>`).join('')}</div>
        <button class="dsktog" type="button" data-dskluks><span><b>Protect with a password</b><small>Encrypted with LUKS. You’ll need it every time you plug this in.</small></span><i class="cksw${f.luks ? ' on' : ''}"></i></button>
        ${k !== 'create' ? `<div class="dskrow2"><span>Erase</span>${seg([['quick', 'Quickly'], ['zero', 'Overwrite with zeros']], f.erase, 'data-dskerase', 'Erase')}</div><p class="dskfine">${f.erase === 'zero' ? `Slow (about ${Math.max(1, Math.round((k === 'disk' ? d.size : s.size) / d.speed[1] / 60 * 1000 / 60))} hours here), but the old data can’t be recovered.` : 'Fast. The old data could be recovered with special tools.'}</p>` : ''}
        <div class="dskact"><button class="bt" type="button" data-dskclose>Cancel</button><button class="bt ${k === 'create' ? 'key' : 'danger'}" type="button" data-dsknext>${k === 'create' ? 'Create' : 'Continue…'}</button></div>`
      : `<h2>Erase ${esc(target)}?</h2><p class="dsksub">Everything on ${esc(target)} will be gone${f.erase === 'zero' ? ' for good' : ''}. This can’t be undone.</p><label class="dskfld"><span>Type <b>${esc(k === 'disk' ? d.n : s.n)}</b> to confirm</span><input data-dsktyped placeholder="${esc(k === 'disk' ? d.n : s.n)}" value="${esc(f.typed)}"></label>
        <div class="dskact"><button class="bt" type="button" data-dskback>Back</button><button class="bt danger" type="button" data-dskgo ${f.typed === (k === 'disk' ? d.n : s.n) ? '' : 'disabled'}>Format</button></div>`; }
    else if (k === 'health') { const rows = d.kind === 'usb' ? [] : [['Reallocated sectors', d.health[0] === 'warn' ? '3' : '0', d.health[0] === 'warn' ? 'warn' : 'ok'], ['Pending sectors', '0', 'ok'], ['Power-on hours', d.id === 'ext' ? '53,420' : '20,512', 'ok'], ['Temperature', d.id === 'ext' ? '44 °C' : '38 °C', 'ok'], ['Unsafe shutdowns', '12', 'ok'], ['Media errors', '0', 'ok']];
      h = `<h2>SMART data</h2><p class="dsksub">${esc(d.n)} · ${d.health[1]}</p>${rows.length ? `<table class="dsktbl"><thead><tr><th>SMART attribute</th><th>Value</th><th></th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td><i class="dskst ${c}">${c === 'ok' ? 'OK' : 'Watch'}</i></td></tr>`).join('')}</tbody></table>
        ${DSS.test != null ? `<div class="dskprog"><i style="width:${DSS.test}%"></i><span>${DSS.test < 100 ? `Short self-test · ${Math.round(DSS.test)}%` : 'Self-test passed'}</span></div>` : ''}<div class="dskact"><button class="bt" type="button" data-dskclose>Close</button><button class="bt key" type="button" data-dsktest ${DSS.test != null && DSS.test < 100 ? 'disabled' : ''}>Run a short self-test</button></div>` : '<div class="dskact"><button class="bt" type="button" data-dskclose>Close</button></div>'}`; }
    else if (k === 'bench') { const b = DSS.bench || { r: [], w: [] }, mx = Math.max(d.speed[0], d.speed[1]) * 1.2, pts = a => a.map((y, i) => `${(i / 59 * 400).toFixed(1)},${(120 - y / mx * 110).toFixed(1)}`).join(' ');
      h = `<h2>Speed test</h2><p class="dsksub">${esc(d.n)} · 100 samples, files are not changed</p><svg class="dskgraph" viewBox="0 0 400 120" preserveAspectRatio="none"><polyline class="r" points="${pts(b.r)}"/><polyline class="w" points="${pts(b.w)}"/></svg>
        <div class="dsknums two"><div><b>${b.r.length ? Math.round(b.r.reduce((a, x) => a + x, 0) / b.r.length).toLocaleString() : '—'} MB/s</b><small><i class="dskk r"></i>read</small></div><div><b>${b.w.length ? Math.round(b.w.reduce((a, x) => a + x, 0) / b.w.length).toLocaleString() : '—'} MB/s</b><small><i class="dskk w"></i>write</small></div></div>
        <div class="dskact"><button class="bt" type="button" data-dskclose>Close</button><button class="bt key" type="button" data-dskbench ${DSS.bench && b.r.length < 60 ? 'disabled' : ''}>${b.r.length >= 60 ? 'Test again' : 'Start'}</button></div>`; }
    else if (k === 'unlock') h = `<h2>Unlock ${esc(s.n)}</h2><p class="dsksub">Enter the passphrase for this encrypted volume.</p><label class="dskfld"><span>Passphrase</span><input type="password" data-dskpass></label><button class="dsktog" type="button" data-dsktodo="Remembered until you log out"><span><b>Remember until I log out</b></span><i class="cksw"></i></button><div class="dskact"><button class="bt" type="button" data-dskclose>Cancel</button><button class="bt key" type="button" data-dskunlock>Unlock</button></div>`;
    else if (k === 'rename') h = `<h2>Rename ${esc(s.n)}</h2><p class="dsksub">The name you see in Filer and on other computers.</p><label class="dskfld"><span>Name</span><input data-dskname value="${esc(s.n)}"></label><div class="dskact"><button class="bt" type="button" data-dskclose>Cancel</button><button class="bt key" type="button" data-dskrename>Rename</button></div>`;
    else if (k === 'resize') h = `<h2>Resize ${esc(s.n)}</h2><p class="dsksub">It can shrink to ${dskSize(s.used * 1.05)} (what’s on it) or grow into free space next to it.</p><label class="dskfld"><span>Size <em data-dskrv>${dskSize(s.size)}</em></span><input type="range" min="${Math.ceil(s.used * 1.05)}" max="${Math.round(s.size + (dskSegs(d)[DSS.vol + 1]?.free ? dskSegs(d)[DSS.vol + 1].size : 0))}" value="${Math.round(s.size)}" data-dskresize></label><div class="dskact"><button class="bt" type="button" data-dskclose>Cancel</button><button class="bt key" type="button" data-dskresizego>Resize</button></div>`;
    if (dskNarrow()) { const was = $('#dsk-bar .dskpan'); DSS.panScroll = was ? was.scrollTop : 0; DSS.sheetHTML = h; box.classList.remove('on'); box.innerHTML = ''; const fo = document.activeElement?.matches?.('#dsk-bar input') ? document.activeElement.getAttribute('data-dskname') != null ? '[data-dskname]' : document.activeElement.matches('[data-dsktyped]') ? '[data-dsktyped]' : null : null; dskBar(); if (fo) { const i = $('#dsk-bar ' + fo); i?.focus(); } return; }
    box.innerHTML = `<div class="dskcardsh">${h}</div>`; }
  function dskRun(label, ms, then) { DSS.sheet = null; DSS.f = null; dskSheet(); const bar = $('#dsk-bar'); let p = 0; setBar(bar, `<span class="ctxc">${ic('hard-drive')}${label}</span><div class="dskprog inl"><i></i></div>`);
    const t = setInterval(() => { p = Math.min(100, p + 100 / (ms / 120)); const i = $('#dsk-bar .dskprog i'); if (i) i.style.width = p + '%'; if (p >= 100) { clearInterval(t); then(); dskAll(); } }, 120); }
  function dskClick(e, hit) { const q = s => hit(s), d = dskD(), segs = dskSegs(d), s = segs[DSS.vol];
    if (q('button[disabled]')) return true;   // locked actions show their reason on hover and do nothing
    if (!q('#dsk-pop') && !q('[data-dskvmenu],[data-dskdmenu]')) $('#dsk-pop')?.remove();
    if (dskNarrow()) { const px = q('[data-dskpx]'); if (px) { const k = px.dataset.dskpx; DSS.px = DSS.px === k ? '' : k; if (DSS.px) { DSS.sheet = null; DSS.f = null; } dskBar(); return true; }
      if (q('[data-dskd]') || q('[data-dsksheet]') || q('[data-dsktodo]') || q('[data-dskrun]') || q('[data-dsklock]') || q('[data-dskoff]') || q('[data-dskattach]') || q('[data-dskv]')) DSS.px = ''; }
    if (q('[data-dskisl]')) { DSS.isl = !DSS.isl; DSS.px = ''; DSS.sheet = null; dskBar(); return true; }
    if (DSS.isl && !q('#dsk-isl .dskislr')) { DSS.isl = false; if (!q('#dsk-isl')) dskBar(); }
    const dv = q('[data-dskd]'); if (dv) { DSS.cur = dv.dataset.dskd; DSS.vol = dskD().vols.findIndex(v => !v.sys) >= 0 ? dskD().vols.findIndex(v => !v.sys) : 0; if (DSS.cur === 'nvme') DSS.vol = 2; DSS.bench = null; DSS.test = null; dskAll(); return true; }
    const vv = q('[data-dskv]'); if (vv) { DSS.vol = +vv.dataset.dskv; dskMain(); dskBar(); return true; }
    const td = q('[data-dsktodo]'); if (td) { $('#dsk-pop')?.remove(); dskToast(td.dataset.dsktodo); return true; }
    const sh = q('[data-dsksheet]'); if (sh) { $('#dsk-pop')?.remove(); DSS.sheet = sh.dataset.dsksheet; DSS.f = null; dskSheet(); setTimeout(() => $('#dsk-sheet input')?.focus({ preventScroll: true }), 60); return true; }
    if (q('[data-dskclose]')) { DSS.sheet = null; DSS.f = null; dskSheet(); return true; }
    if (q('[data-dskattach]')) { if (!DSK.some(x => x.id === 'iso')) DSK.push({ id: 'iso', n: 'suno-nightly.iso', grp: 'Disk images', kind: 'iso', model: 'Disk image, 6.2 GB', dev: '/dev/loop0', size: 6.2, scheme: 'MBR', health: ['none', 'Not reported', []], speed: [2900, 0], vols: [{ n: 'LUMA-1.0', c: 'amber', size: 6.2, used: 6.1, fs: 'ISO 9660', mount: '/run/media/nick/LUMA-1.0', part: 'p1', uuid: '2026-09-23-18-00-00-00', role: 'The contents of the image, read-only.' }] }); DSS.cur = 'iso'; DSS.vol = 0; dskAll(); dskToast('Attached suno-nightly.iso read-only'); return true; }
    if (q('[data-dskmount]')) { const m = !s.mount; dskRun(m ? `Mounting ${s.n}` : `Unmounting ${s.n}`, 700, () => { s.mount = m ? `/run/media/nick/${s.n}` : null; d.vols[DSS.vol].mount = s.mount; dskToast(m ? `${s.n} is mounted` : `${s.n} can be unplugged safely`); }); return true; }
    const fs = q('[data-dskfs]'); if (fs) { DSS.f.fs = fs.dataset.dskfs; dskSheet(); return true; }
    if (q('[data-dskluks]')) { DSS.f.luks = !DSS.f.luks; dskSheet(); return true; }
    const er = q('[data-dskerase]'); if (er) { DSS.f.erase = er.dataset.dskerase; dskSheet(); return true; }
    if (q('[data-dsknext]')) { if (DSS.sheet === 'create') { const f = DSS.f, name = f.name || 'Untitled'; dskRun(`Creating ${name}`, 1400, () => { d.vols.push({ n: name, c: ['green', 'pink', 'violet'][d.vols.length % 3], size: f.size, used: 0, fs: { btrfs: 'Btrfs', ext4: 'Ext4', exfat: 'exFAT', ntfs: 'NTFS', fat32: 'FAT32' }[f.fs], luks: f.luks, locked: false, mount: null, part: String(d.vols.length + 1), uuid: 'e1d4' + Math.random().toString(16).slice(2, 10), role: 'A new volume. Mount it to start using it.' }); DSS.vol = d.vols.length - 1; dskToast(`${name} created`); }); return true; } const tg = DSS.sheet === 'disk' ? d.n : s.n; lConfirm($('#w-disks'), { title: `Erase ${tg}?`, body: `Everything on ${tg} will be gone${DSS.f.erase === 'zero' ? ' for good' : ''}. This can’t be undone.`, action: 'Erase', icon: 'trash-2', onOK: () => { const b = document.createElement('button'); b.dataset.dskgo = ''; $('#dsk-sheet').append(b); b.click(); b.remove(); } }); return true; }
    if (q('[data-dskback]')) { DSS.f.step = 1; dskSheet(); return true; }
    if (q('[data-dskgo]')) { const f = DSS.f, k = DSS.sheet, fsn = { btrfs: 'Btrfs', ext4: 'Ext4', exfat: 'exFAT', ntfs: 'NTFS', fat32: 'FAT32' }[f.fs];
      dskRun(k === 'disk' ? `Formatting ${d.n}` : `Formatting ${s.n}`, f.erase === 'zero' ? 3200 : 1600, () => { if (k === 'disk') { d.vols = [{ n: f.name || d.n, c: 'green', size: d.size, used: 0, fs: fsn, luks: f.luks, mount: null, part: d.kind === 'ssd' ? 'p1' : '1', uuid: 'f2c9' + Math.random().toString(16).slice(2, 10), role: 'Freshly formatted and empty.' }]; DSS.vol = 0; } else Object.assign(d.vols[DSS.vol], { n: f.name || s.n, fs: fsn, used: 0, luks: f.luks, locked: false, mount: null, role: 'Freshly formatted and empty.' }); dskToast('Formatted'); }); return true; }
    if (q('[data-dskunlock]')) { dskRun(`Unlocking ${s.n}`, 900, () => { d.vols[DSS.vol].locked = false; d.vols[DSS.vol].mount = `/run/media/nick/${s.n}`; dskToast(`${s.n} is unlocked and mounted`); }); return true; }
    if (q('[data-dskrename]')) { const n = $('[data-dskname]').value.trim() || s.n; d.vols[DSS.vol].n = n; DSS.sheet = null; dskAll(); dskToast(`Renamed to ${n}`); return true; }
    if (q('[data-dskresizego]')) { const v = +$('[data-dskresize]').value; dskRun(`Resizing ${s.n}`, 1600, () => { d.vols[DSS.vol].size = v; dskToast(`${s.n} is now ${dskSize(v)}`); }); return true; }
    if (q('[data-dsktest]')) { DSS.test = 0; dskSheet(); const t = setInterval(() => { DSS.test = Math.min(100, DSS.test + 4); if (DSS.sheet === 'health') dskSheet(); if (DSS.test >= 100) clearInterval(t); }, 120); return true; }
    if (q('[data-dskbench]')) { DSS.bench = { r: [], w: [] }; const t = setInterval(() => { const n = DSS.bench.r.length; DSS.bench.r.push(d.speed[0] * (.85 + Math.random() * .25) * (n < 4 ? n / 4 : 1)); DSS.bench.w.push(d.speed[1] * (.8 + Math.random() * .3) * (n < 4 ? n / 4 : 1)); if (DSS.sheet === 'bench') dskSheet(); if (DSS.bench.r.length >= 60) clearInterval(t); }, 70); return true; }
    if (q('[data-dskvmenu]')) { const ro = s.fs === 'ISO 9660', sys = s.sys, L = (on, a) => on ? `disabled title="Suno is running from ${esc(s.n)}"` : a;
      dskPop(q('[data-dskvmenu]'), (ro ? '' : crMi('data-dsksheet="rename"', 'pencil', 'Rename…') + crMi(L(sys, 'data-dsksheet="resize"'), 'arrow-left-right', 'Resize…')) + (s.locked || ro ? '' : crMi(`data-dskrun="check"`, 'check-check', 'Check filesystem') + crMi(L(sys, `data-dskrun="repair"`), 'wrench', 'Repair filesystem')) + (s.luks ? crMi('data-dsktodo="Enter the old passphrase, then the new one"', 'key', 'Change passphrase…') + (s.locked ? '' : crMi('data-dsklock', 'lock', 'Lock')) : '') + (ro ? '' : crMi(L(sys, 'data-dsktodo="Mount options: at startup, read-only, show in Filer"'), 'settings-2', 'Mount options…')) + '<span class="crsep"></span>' + crMi('data-dsktodo="Choose where to save the image"', 'copy', 'Create partition image…') + crMi(L(sys, 'data-dsktodo="Choose an image. Everything on this volume will be replaced"'), 'rotate-ccw', 'Restore partition image…') + '<span class="crsep"></span>' + crMi(L(sys, 'data-dskdel'), 'trash-2', 'Delete volume…', ' red') + `<span class="crsep"></span><h6>${esc(d.n)}</h6>` + dskDrive(d), true); return true; }
    if (q('[data-dskdmenu]')) { dskPop(q('[data-dskdmenu]'), dskDrive(d), true); return true; }
    if (false) { dskPop(q('[data-dskdmenu]'), crMi('data-dsksheet="health"', 'shield-check', 'SMART data and self-tests') + crMi('data-dsksheet="bench"', 'gauge', 'Test speed') + crMi('data-dsktodo="Standby after 10 minutes, write cache on"', 'settings-2', 'Drive settings…') + '<span class="crsep"></span>' + crMi('data-dsktodo="Choose where to save the image"', 'copy', 'Create disk image…') + (d.fixed ? '' : crMi('data-dsktodo="Choose an image. The whole drive will be replaced"', 'rotate-ccw', 'Restore disk image…') + crMi('data-dskoff', 'power', d.kind === 'iso' ? 'Detach' : 'Power off')) + (d.fixed ? '' : '<span class="crsep"></span>' + crMi('data-dsksheet="disk"', 'trash-2', 'Format disk…', ' red'))); return true; }
    const rn = q('[data-dskrun]'); if (rn) { $('#dsk-pop')?.remove(); const k = rn.dataset.dskrun; dskRun(`${k === 'check' ? 'Checking' : 'Repairing'} ${s.n}`, 1800, () => dskToast(k === 'check' ? `${s.n}: no errors found` : `${s.n}: repair finished`)); return true; }
    if (q('[data-dsklock]')) { $('#dsk-pop')?.remove(); d.vols[DSS.vol].locked = true; d.vols[DSS.vol].mount = null; dskAll(); dskToast(`${s.n} is locked`); return true; }
    if (q('[data-dskdel]') && dskNarrow()) { DSS.px = ''; DSS.sheet = 'del'; DSS.sheetHTML = `<h2>Delete ${esc(s.n)}?</h2><p class="dsksub">The volume and everything on it will be gone, and ${dskSize(s.size)} becomes free space.</p><div class="dskact"><button class="bt fill" type="button" data-dskclose>Cancel</button><button class="bt danger" type="button" data-dskdelgo>Delete</button></div>`; dskBar(); return true; }
    if (q('[data-dskdel]')) { $('#dsk-pop')?.remove(); DSS.sheet = 'del'; $('#dsk-sheet').classList.add('on'); $('#dsk-sheet').innerHTML = `<div class="dskcardsh"><h2>Delete ${esc(s.n)}?</h2><p class="dsksub">The volume and everything on it will be gone, and ${dskSize(s.size)} becomes free space.</p><div class="dskact"><button class="bt" type="button" data-dskclose>Cancel</button><button class="bt danger" type="button" data-dskdelgo>Delete</button></div></div>`; return true; }
    if (q('[data-dskdelgo]')) { dskRun(`Deleting ${s.n}`, 900, () => { d.vols.splice(DSS.vol, 1); DSS.vol = Math.max(0, DSS.vol - 1); dskToast('Deleted. The space is free'); }); return true; }
    if (q('[data-dskoff]')) { $('#dsk-pop')?.remove(); const i = DSK.indexOf(d); DSK.splice(i, 1); DSS.cur = DSK[0].id; DSS.vol = 2; DSS.bench = null; DSS.test = null; dskAll(); dskToast(`${d.n} ${d.kind === 'iso' ? 'detached' : 'is powered off'}`); return true; }
    return false; }
  function renderDisks() { $('#dsk-top').innerHTML = `<img src="../icons/Suno-v4-disks.svg" alt=""><b>Disks</b><span class="chev">${ic('chevron-down')}</span>`; dskAll(); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-dsktyped]')) { DSS.f.typed = e.target.value; const d = dskD(), s = dskSegs(d)[DSS.vol], want = DSS.sheet === 'disk' ? d.n : s.n; $('[data-dskgo]').disabled = e.target.value !== want; }
    if (e.target.matches?.('[data-dskname]') && DSS.f) DSS.f.name = e.target.value;
    if (e.target.matches?.('[data-dsksize]')) { DSS.f.size = +e.target.value; e.target.previousElementSibling.querySelector('em').textContent = `${dskSize(DSS.f.size)} of ${dskSize(dskSegs(dskD())[DSS.vol].size)}`; }
    if (e.target.matches?.('[data-dskresize]')) $('[data-dskrv]').textContent = dskSize(+e.target.value); });

  /* ══ Camera ══════════════════════════════════════════════════════════════════
     The camera body is a black frame with the same margin on every side of the picture. Everything you
     can change stands in one centred column beside it, made from the same parts as every other Suno app:
     a chip that says which camera, a segmented control for the mode, the shutter, a well of tools.
     On a phone the same parts restack under your thumb. */
  const CMC = [{ id: 'usb', n: 'Studio Cam', sub: '4K USB camera', raw: true, zooms: [1, 2, 4], img: PH + 'life-hero-studio.webp' },
    { id: 'phone', n: 'Nick’s phone', sub: 'Main camera, 48 MP', raw: true, zooms: [.5, 1, 2, 5], img: PH + 'life-sync-terrace.webp', phone: true },
    { id: 'front', n: 'Built-in camera', sub: '1080p, front', raw: false, zooms: [1], img: PH + 'life-hero-writing.webp', mirror: true }];
  const CMM = [['photo', 'Photo'], ['portrait', 'Portrait'], ['video', 'Video'], ['time', 'Time-lapse'], ['scan', 'Scan']];
  const CMF = { raw: ['RAW + JPEG', 'About 25 MB a photo'], jpeg: ['JPEG', 'About 4 MB a photo'], heif: ['HEIF', 'About 2 MB a photo'] };
  const CMD = [['iso', 'ISO', ['Auto', '100', '200', '400', '800', '1600', '3200']], ['ss', 'Shutter', ['Auto', '1/1000', '1/500', '1/250', '1/125', '1/60', '1/30']], ['wb', 'White balance', ['Auto', 'Daylight', 'Cloudy', 'Tungsten', '5600 K']], ['mf', 'Focus', ['Auto', 'Near', '1 m', '3 m', '∞']]];
  const CM = { cam: 'usb', mode: 'photo', flash: 'auto', timer: 0, grid: true, fmt: 'raw', aspect: '4:3', zoom: 1, pro: false, focus: null, ev: 0, rec: null, shots: [], strip: false, pop: null, iso: 'Auto', ss: 'Auto', wb: 'Auto', mf: 'Auto' };
  const cmCam = () => CMC.find(c => c.id === CM.cam);
  const cmVid = () => CM.mode === 'video' || CM.mode === 'time';
  const CMAR = { '4:3': 4 / 3, '16:9': 16 / 9, '1:1': 1, '3:2': 3 / 2 };
  const cmFmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* Camera on a phone, the way phone cameras work: black, the quick toggles along the top, the picture, zoom pills over
     its foot, the modes as a strip of words you slide through, then last shot, the shutter and flip. Settings open as a
     panel above the controls, in the same glass as every Suno panel. */
  const cmNarrow = () => { const w = $('#w-camera'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };
  function cmRenderPhone() { const c = cmCam(), vid = cmVid(), rec = !!CM.rec, last = CM.shots[0], ar = vid ? 9 / 16 : 1 / CMAR[CM.aspect];
    const t = (attr, icon, label, on, note = '', off = false) => `<button type="button" class="cmt2${on ? ' on' : ''}" ${attr} aria-label="${label}"${off ? ' disabled' : ''}>${ic(icon)}${note ? `<small>${note}</small>` : ''}</button>`;
    $('#w-camera').classList.add('cmph');
    $('#cm-body').innerHTML = `<div class="cmphone${rec ? ' rec' : ''}">
      <div class="cmtop2">${t('data-cmflash', CM.flash === 'off' ? 'zap-off' : 'zap', `Flash: ${CM.flash}`, CM.flash === 'on', CM.flash === 'auto' ? 'A' : '', vid)}${rec ? `<span class="cmtc2"><i></i><b id="cm-tc">${cmFmt(CM.rec.t)}</b></span>` : `<button type="button" class="cmfmt2" data-cmaspect${vid ? ' disabled' : ''}>${vid ? '4K · 30' : CM.aspect}</button>`}${t('data-cmtimer', 'timer', 'Timer', !!CM.timer, CM.timer ? CM.timer + 's' : '', vid)}${t('data-cmset', 'settings-2', 'Settings', CM.pop?.k === 'set')}</div>
      <div class="cmvf2" id="cm-vf"><div class="cmframe" id="cm-frame" style="aspect-ratio:${ar}"><img draggable="false" src="${c.img}" alt="" style="transform:scale(${Math.max(1, CM.zoom)})${c.mirror ? ' scaleX(-1)' : ''};filter:brightness(${1 + CM.ev * .25})">
        ${CM.mode === 'portrait' ? '<i class="cmbokeh"></i>' : ''}${CM.grid ? '<i class="cmgrid"></i>' : ''}${CM.mode === 'scan' ? '<svg class="cmscan" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="28,22 71,18 76,80 24,84"/></svg>' : ''}
        ${CM.mode === 'portrait' ? '<span class="cmtag">Portrait · f/2.0</span>' : CM.mode === 'scan' ? '<span class="cmtag">Document found</span>' : ''}
        ${CM.focus ? `<div class="cmfocus" style="left:${CM.focus[0]}%;top:${CM.focus[1]}%"><i></i><label class="cmev">${ic('sun')}<input type="range" min="-2" max="2" step=".1" value="${CM.ev}" data-cmev aria-label="Exposure"></label></div>` : ''}
        <i class="cmflash" id="cm-flash"></i><b class="cmcount" id="cm-count"></b>
        <div class="cmzoom2" role="group" aria-label="Zoom">${c.zooms.map(z => `<button type="button" class="${CM.zoom === z ? 'on' : ''}" data-cmzoom="${z}">${z < 1 ? '.5' : z}${CM.zoom === z ? '×' : ''}</button>`).join('')}</div></div></div>
      <div class="cmmodes2" role="tablist" aria-label="Mode">${CMM.map(([k, n]) => `<button type="button" role="tab" class="${CM.mode === k ? 'on' : ''}" data-cmmode="${k}"${rec ? ' disabled' : ''}>${n}</button>`).join('')}</div>
      <div class="cmbot2"><button type="button" class="cmlast2" data-cmtodo="Opening Photos"${last ? '' : ' disabled'} aria-label="Last shot">${last ? `<i style="background-image:url('${last.img}')"></i>` : ic('image')}</button>
        <button class="cmshutter2 ${CM.mode}${rec ? ' rec' : ''}" type="button" data-cmshoot aria-label="${vid ? (rec ? 'Stop' : 'Record') : 'Take photo'}"><i></i></button>
        <button type="button" class="cmflip2" data-cmflip${rec ? ' disabled' : ''} aria-label="Switch camera">${ic('refresh-ccw')}</button></div>
      ${CM.pop ? cmPopHTML() : ''}</div>`;
    requestAnimationFrame(() => { const m = $('#cm-body .cmmodes2'), on = m?.querySelector('.on'); if (on) m.scrollLeft = on.offsetLeft - m.clientWidth / 2 + on.offsetWidth / 2; }); }
  function cmRender() { const c = cmCam(), vid = cmVid(), ar = vid ? 16 / 9 : CMAR[CM.aspect], rec = !!CM.rec, last = CM.shots[0];
    if (cmNarrow()) return cmRenderPhone(); $('#w-camera').classList.remove('cmph');
    const tool = (attr, icon, label, on, note = '', off = false) => `<button type="button" class="cmt${on ? ' on' : ''}" ${attr} title="${label}" aria-label="${label}"${off ? ' disabled' : ''}>${ic(icon)}${note ? `<small>${note}</small>` : ''}</button>`;
    $('#cm-body').innerHTML = `<div class="cmvf" id="cm-vf" style="--ar:${ar}">
      <div class="cmframe" id="cm-frame"><img src="${c.img}" alt="" style="transform:scale(${Math.max(1, CM.zoom)})${c.mirror ? ' scaleX(-1)' : ''};filter:brightness(${1 + CM.ev * .25})">
        ${CM.mode === 'portrait' ? '<i class="cmbokeh"></i>' : ''}${CM.grid ? '<i class="cmgrid"></i>' : ''}
        ${CM.mode === 'scan' ? '<svg class="cmscan" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="28,22 71,18 76,80 24,84"/></svg>' : ''}
        ${rec ? `<span class="cmtag rec"><i></i><b id="cm-tc">${cmFmt(CM.rec.t)}</b></span>` : CM.mode === 'portrait' ? '<span class="cmtag">Portrait · f/2.0</span>' : CM.mode === 'scan' ? '<span class="cmtag">Document found</span>' : ''}
        ${CM.focus ? `<div class="cmfocus" style="left:${CM.focus[0]}%;top:${CM.focus[1]}%"><i></i><label class="cmev">${ic('sun')}<input type="range" min="-2" max="2" step=".1" value="${CM.ev}" data-cmev aria-label="Exposure"></label></div>` : ''}
        <i class="cmflash" id="cm-flash"></i><b class="cmcount" id="cm-count"></b></div>

      ${CM.pro && c.raw && !vid ? `<div class="cmpro" role="group" aria-label="Manual controls">${CMD.map(([k, n, opts]) => `<button class="cmdial${CM[k] !== 'Auto' ? ' set' : ''}" type="button" data-cmdial="${k}" data-opts="${opts.join('|')}"><small>${{ iso: 'ISO', ss: 'Shutter', wb: 'WB', mf: 'Focus' }[k]}</small><b>${CM[k] === 'Auto' ? 'A' : CM[k].replace(' K', 'K').replace('Daylight', 'Day').replace('Tungsten', 'Tung')}</b></button>`).join('')}<span class="cmprosep"></span><button class="cmdial" type="button" data-cmproauto title="Everything back to automatic"><small>All</small><b>Auto</b></button></div>` : ''}
      <button type="button" class="cmlast cmcorner l${CM.strip ? ' on' : ''}" data-cmstrip${last ? '' : ' disabled'} title="${last ? `${CM.shots.length} this session` : 'Nothing yet'}" aria-label="This session"><i class="th" ${last ? `style="background-image:url('${last.img}')"` : ''}>${last ? '' : ic('image')}</i></button>
      <button type="button" class="cmcam cmcorner r" data-cmcams${rec ? ' disabled' : ''} title="Camera">${ic(c.phone ? 'smartphone' : 'camera')}<span>${c.n}</span>${ic('chevron-down')}</button>
      <div class="cmbar4" id="cm-bar2"><i class="cmbg" aria-hidden="true"></i><svg class="cmedge" aria-hidden="true"><path/></svg>
        <div class="cmside l"><button type="button" class="cmmodeb" data-cmmodes${rec ? ' disabled' : ''}>${CMM.find(m => m[0] === CM.mode)[1]}${ic('chevron-down')}</button><div class="cmzoom" role="group" aria-label="Zoom">${c.zooms.map(z => `<button type="button" class="${CM.zoom === z ? 'on' : ''}" data-cmzoom="${z}"${c.zooms.length < 2 ? ' disabled' : ''}>${z < 1 ? '0.5' : z}×</button>`).join('')}</div></div>
        <span class="cmmid"></span>
        <div class="cmside r"><button type="button" class="cmshape" data-cmaspect title="${vid ? 'Video format' : 'Shape'}"${vid ? ' disabled' : ''}>${vid ? '4K' : CM.aspect}</button>${tool('data-cmflash', CM.flash === 'off' ? 'zap-off' : 'zap', `Flash: ${CM.flash}`, CM.flash === 'on', CM.flash === 'auto' ? 'A' : '', vid)}${tool('data-cmtimer', 'timer', 'Timer', !!CM.timer, CM.timer ? CM.timer + 's' : '', vid)}${tool('data-cmgrid', 'grid-2x2', 'Grid', CM.grid)}${tool('data-cmset', 'ellipsis', 'Format, shape and settings', CM.pop?.k === 'set')}</div>
        <button class="cmshutter ${CM.mode}${rec ? ' rec' : ''}" type="button" data-cmshoot aria-label="${vid ? (rec ? 'Stop' : 'Record') : 'Take photo'}"><i></i></button></div>
      ${CM.strip && last ? cmStrip() : ''}${CM.pop ? cmPopHTML() : ''}</div>`;
    requestAnimationFrame(cmShape); if (CM.pop) requestAnimationFrame(cmPlacePop); }
  /* The bar bends up around the shutter: one outline, drawn to the bar's width, used to clip the glass and draw its edge */
  /* One outline for the bar and its bump. The bump is a circle concentric with the shutter (4px of glass around it);
     two small fillets meet the bar's top edge at exactly the tangent points, so the curve flows into the bar with no seam. */
  function cmShape() { const b = $('#cm-bar2'); if (!b || !b.offsetWidth) return;   /* hidden: nothing to draw (drawing a 0-high bar gave the NaN path) */
    const W = b.offsetWidth, H = b.offsetHeight, T = CMT, r = 16, cx = W / 2, S = 30, g = 5, R0 = S + g, f = 9;
    const cy = H - 4 - S, dy = cy - T, dx = Math.sqrt((R0 + f) ** 2 - (dy + f) ** 2), k = R0 / (R0 + f); if (!(dx >= 0)) return;
    const pL = [cx + (-dx) * k, cy + (T - f - cy) * k], pR = [cx + dx * k, pL[1]];
    const d = `M0 ${T + r}A${r} ${r} 0 0 1 ${r} ${T}L${cx - dx} ${T}A${f} ${f} 0 0 0 ${pL[0]} ${pL[1]}A${R0} ${R0} 0 0 1 ${pR[0]} ${pR[1]}A${f} ${f} 0 0 0 ${cx + dx} ${T}L${W - r} ${T}A${r} ${r} 0 0 1 ${W} ${T + r}L${W} ${H - r}A${r} ${r} 0 0 1 ${W - r} ${H}L${r} ${H}A${r} ${r} 0 0 1 0 ${H - r}Z`;
    b.querySelector('.cmbg').style.clipPath = `path('${d}')`; const sv = b.querySelector('.cmedge'); sv.setAttribute('viewBox', `0 0 ${W} ${H}`); sv.setAttribute('width', W); sv.setAttribute('height', H); sv.querySelector('path').setAttribute('d', d); }
  const CMT = 26;

  function cmStrip() { return `<div class="fbar cmstrip">${CM.shots.slice(0, 6).map(s => `<span class="th" style="background-image:url('${s.img}')" title="${s.label}">${s.vid ? `<em>${s.len}</em>` : ''}</span>`).join('')}
      <i class="cmsep"></i><button class="bt key" type="button" data-cmtodo="Opening Photos">Open in Photos</button><button class="ib" type="button" data-cmstrip aria-label="Close">${ic('x')}</button></div>`; }
  function cmPopHTML() { const p = CM.pop, mi = (attr, on, b, s = '', icn = '') => `<button type="button" class="crmi${on ? ' on' : ''}" ${attr}>${icn ? ic(icn) : ''}<span>${b}${s ? `<small>${s}</small>` : ''}</span>${on ? ic('check') : ''}</button>`;
    const body = p.k === 'mode' ? '<h6>Mode</h6>' + CMM.map(([k, n]) => mi(`data-cmmode="${k}"`, CM.mode === k, n, '', { photo: 'camera', portrait: 'user', video: 'video', time: 'timer', scan: 'scan-text' }[k])).join('')
      : p.k === 'cams' ? '<h6>Camera</h6>' + CMC.map(c => mi(`data-cmcam="${c.id}"`, CM.cam === c.id, c.n, c.sub + (c.raw ? ' · RAW' : ''), c.phone ? 'smartphone' : 'camera')).join('')
      : p.k === 'fmt' ? '<h6>Format</h6>' + Object.entries(CMF).filter(([k]) => k !== 'raw' || cmCam().raw).map(([k, [n, d]]) => mi(`data-cmfmtset="${k}"`, CM.fmt === k, n, d)).join('')
      : p.k === 'aspect' ? '<h6>Shape</h6>' + ['4:3', '3:2', '16:9', '1:1'].map(a => mi(`data-cmar="${a}"`, CM.aspect === a, a)).join('')
      : p.k === 'dial' ? `<h6>${CMD.find(d => d[0] === p.dial)[1]}</h6>` + p.opts.map(o => mi(`data-cmdialset="${o}"`, CM[p.dial] === o, o)).join('')
      : (() => { const sw = CM.sw || { stab: true, mirror: true, loc: false }, tg = (k, n, sub, on, icn) => `<button type="button" class="crmi cmsw" data-cmsw="${k}">${ic(icn)}<span>${n}${sub ? `<small>${sub}</small>` : ''}</span><i class="cksw${on ? ' on' : ''}"></i></button>`, val = (n, v, icn) => `<button type="button" class="crmi cmval" data-cmtodo="${n}: ${v}">${ic(icn)}<span>${n}</span><em class="cmv">${v}</em>${ic('chevron-right')}</button>`;
        return (cmVid() ? '' : '<h6>Photo format</h6>' + Object.entries(CMF).filter(([k]) => k !== 'raw' || cmCam().raw).map(([k, [n, d]]) => mi(`data-cmfmtset="${k}"`, CM.fmt === k, n, d)).join('') + '<span class="crsep"></span>')
          + (cmCam().raw && !cmVid() ? `<button type="button" class="crmi cmsw" data-cmpro>${ic('aperture')}<span>Manual controls<small>ISO, shutter, focus, white balance</small></span><i class="cksw${CM.pro ? ' on' : ''}"></i></button>` : '')
          + tg('stab', 'Stabilization', '', sw.stab, 'vibrate') + tg('mirror', 'Mirror the front camera', '', sw.mirror, 'flip-horizontal-2') + tg('loc', 'Save where photos are taken', '', sw.loc, 'map-pin')
          + '<span class="crsep"></span>' + val('Photo size', cmCam().phone ? '48 MP' : '12 MP', 'image') + val('Video', '4K · 30 fps', 'video') + val('Save to', 'Pictures › Camera', 'folder'); })();
    return `<div class="crpop cmpop" id="cm-pop">${body}</div>`; }
  // Beside the column on a desk, above the control on a phone. Placed after it renders so we know its size.
  function cmPlacePop() { if (cmNarrow()) return; const pop = $('#cm-pop'), vf = $('#cm-vf'); if (!pop || !vf || !CM.pop) return; const a = vf.querySelector(CM.pop.sel); if (!a) return;
    const V = vf.getBoundingClientRect(), r = a.getBoundingClientRect(), W = pop.offsetWidth, H = pop.offsetHeight, side = false;
    const x = side ? r.left - V.left - W - 12 : Math.max(12, Math.min(V.width - W - 12, r.left - V.left + r.width / 2 - W / 2));
    if (a.closest('.cmpro')) { pop.style.left = (a.closest('.cmpro').getBoundingClientRect().left - V.left - W - 10) + 'px'; pop.style.top = Math.max(12, Math.min(V.height - H - 12, r.top - V.top + r.height / 2 - H / 2)) + 'px'; return; }
    const y = side ? 0 : r.top - V.top < 120 ? r.bottom - V.top + 10 : Math.max(12, r.top - V.top - H - 10);
    pop.style.left = x + 'px'; pop.style.top = y + 'px'; }
  function cmOpenPop(sel, k, extra = {}) { CM.pop = CM.pop?.sel === sel ? null : { k, sel, ...extra }; cmRender(); }

  function cmShoot() { const c = cmCam();
    if (cmVid()) { if (CM.rec) { clearInterval(CM.rec.iv); CM.shots.unshift({ img: c.img, vid: true, len: cmFmt(CM.rec.t), label: `${CM.mode === 'time' ? 'Time-lapse' : 'Video'}, ${cmFmt(CM.rec.t)}` }); CM.rec = null; cmRender(); cmToast('Saved to Pictures › Camera'); return; }
      CM.pop = null; CM.rec = { t: 0 }; CM.rec.iv = setInterval(() => { CM.rec.t++; const t = $('#cm-tc'); if (t) t.textContent = cmFmt(CM.rec.t); }, 1000); cmRender(); return; }
    const fire = () => { const f = $('#cm-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
      CM.shots.unshift({ img: c.img, label: CM.mode === 'scan' ? 'Document, PDF' : CM.mode === 'portrait' ? 'Portrait' : CMF[CM.fmt][0] });
      setTimeout(() => { cmRender(); $('.cmlast .th')?.classList.add('cmnew'); }, 160); if (CM.mode === 'scan') cmToast('Saved as a PDF in Documents'); };
    if (CM.timer) { let n = CM.timer; const el = $('#cm-count'); el.textContent = n; el.classList.add('on'); const t = setInterval(() => { n--; if (n > 0) el.textContent = n; else { clearInterval(t); el.classList.remove('on'); fire(); } }, 1000); } else fire(); }
  function cmToast(msg, icon) { lToast($('#w-camera'), msg, { icon: icon || 'check' }); }

  function cmClick(e, hit) { const q = s => hit(s);
    if (CM.pop && !q('.cmpop') && !q('[data-cmcams],[data-cmfmt],[data-cmaspect],[data-cmdial],[data-cmset],[data-cmmodes]')) { CM.pop = null; cmRender(); if (q('#cm-frame')) return true; }
    if (q('[data-cmmodes]')) { cmOpenPop('[data-cmmodes]', 'mode'); return true; }
    const md = q('[data-cmmode]'); if (md) { CM.mode = md.dataset.cmmode; CM.focus = null; CM.pop = null; cmRender(); return true; }
    if (q('[data-cmshoot]')) { cmShoot(); return true; }
    if (q('[data-cmflash]')) { CM.flash = { auto: 'on', on: 'off', off: 'auto' }[CM.flash]; cmRender(); cmToast(`Flash ${CM.flash === 'auto' ? 'automatic' : CM.flash}`); return true; }
    if (q('[data-cmtimer]')) { CM.timer = { 0: 3, 3: 10, 10: 0 }[CM.timer]; cmRender(); return true; }
    if (q('[data-cmgrid]')) { CM.grid = !CM.grid; cmRender(); return true; }
    if (q('[data-cmpro]')) { CM.pro = !CM.pro; CM.pop = null; cmRender(); return true; }
    if (q('[data-cmcams]')) { cmOpenPop('[data-cmcams]', 'cams'); return true; }
    if (q('[data-cmfmt]')) { cmOpenPop('[data-cmfmt]', 'fmt'); return true; }
    if (q('[data-cmaspect]')) { cmOpenPop('[data-cmaspect]', 'aspect'); return true; }
    if (q('[data-cmproauto]')) { CMD.forEach(([k]) => CM[k] = 'Auto'); CM.pop = null; cmRender(); cmToast('Everything is automatic again'); return true; }
    const cst = q('[data-cmsw]'); if (cst) { const k = cst.dataset.cmsw; CM.sw = CM.sw || { stab: true, mirror: true, loc: false }; CM.sw[k] = !CM.sw[k]; cmRender(); return true; }
    if (q('[data-cmset]')) { cmOpenPop('[data-cmset]', 'set'); return true; }
    const dl = q('[data-cmdial]'); if (dl) { cmOpenPop(`[data-cmdial="${dl.dataset.cmdial}"]`, 'dial', { dial: dl.dataset.cmdial, opts: dl.dataset.opts.split('|') }); return true; }
    const cs = q('[data-cmcam]'); if (cs) { cmUse(cs.dataset.cmcam); return true; }
    const fs = q('[data-cmfmtset]'); if (fs) { CM.fmt = fs.dataset.cmfmtset; cmRender(); return true; }
    const ar = q('[data-cmar]'); if (ar) { CM.aspect = ar.dataset.cmar; cmRender(); return true; }
    const ds = q('[data-cmdialset]'); if (ds) { CM[CM.pop.dial] = ds.dataset.cmdialset; CM.pop = null; cmRender(); return true; }
    const zm = q('[data-cmzoom]'); if (zm) { CM.zoom = +zm.dataset.cmzoom; cmRender(); return true; }
    if (q('[data-cmflip]')) { cmUse(CMC[(CMC.findIndex(c => c.id === CM.cam) + 1) % CMC.length].id); return true; }
    if (q('[data-cmstrip]')) { if (CM.shots.length) { CM.strip = !CM.strip; cmRender(); } return true; }
    const td = q('[data-cmtodo]'); if (td) { CM.pop = null; cmRender(); cmToast(td.dataset.cmtodo); return true; }
    const fr = q('#cm-frame'); if (fr && !q('.cmfocus')) { const r = fr.getBoundingClientRect(); CM.focus = [(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100]; CM.ev = 0; cmRender(); clearTimeout(CM.ft); CM.ft = setTimeout(() => { $('.cmfocus')?.classList.add('dim'); }, 2500); return true; }
    return false; }
  function cmUse(id) { CM.cam = id; CM.pop = null; CM.zoom = 1; const c = cmCam(); if (!c.raw) { CM.pro = false; if (CM.fmt === 'raw') CM.fmt = 'jpeg'; } cmRender(); cmToast(`Using ${c.n}`); }
  function renderCamera() { new ResizeObserver(() => { cmShape(); if ($('#w-camera').clientWidth && cmNarrow() !== $('#w-camera').classList.contains('cmph')) cmRender(); }).observe($('#cm-body')); $('#cm-top').innerHTML = `<img src="${A}camera.svg" alt=""><b>Camera</b><span class="chev">${ic('chevron-down')}</span>`; cmRender(); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-cmev]')) { CM.ev = +e.target.value; const im = $('#cm-frame img'); if (im) im.style.filter = `brightness(${1 + CM.ev * .25})`; } });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'camera' || e.target.closest?.('input')) return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cmShoot(); } });

  /* ══ Maps ════════════════════════════════════════════════════════════════════
     A calm map you can read at a glance, drawn by us. Places float up as cards; directions draw
     themselves on the streets; Go turns the map into a guide that talks to you in one line. */
  const MPP = [
    { id: 'studio', n: 'Suno Studio', k: 'building', c: 'Workplace', x: 760, y: 900, addr: '118 Alameda Ave, Studio 4', fav: 'Studio', hrs: 'Your workplace', img: PH + 'life-work-suite.webp' },
    { id: 'loft', n: 'The Loft', k: 'building', c: 'Event space', x: 1440, y: 430, addr: '2201 Broadway', fav: 'Loft', rate: 4.8, hrs: 'Launch night, Oct 1 · 6 to 10 PM', img: PH + 'life-professionals-loft.webp' },
    { id: 'home', n: 'Home', k: 'house', c: 'Home', x: 1720, y: 1080, addr: '3410 Lakeshore Ave', fav: 'Home', hrs: '', img: PH + 'life-hero-home.webp' },
    { id: 'duende', n: 'Duende', k: 'utensils', c: 'Spanish restaurant', x: 1150, y: 560, addr: '468 19th St', rate: 4.6, price: '$$$', hrs: 'Open until 11 PM', img: PH + 'life-sync-terrace.webp' },
    { id: 'door', n: 'Blue Door Coffee', k: 'coffee', c: 'Coffee', x: 980, y: 760, addr: '1520 Franklin St', rate: 4.7, price: '$', hrs: 'Open until 6 PM', img: PH + 'life-hero-studio.webp' },
    { id: 'books', n: 'Paper Lantern Books', k: 'book', c: 'Bookstore', x: 1320, y: 820, addr: '1911 Telegraph Ave', rate: 4.9, price: '$$', hrs: 'Closes at 8 PM', img: PH + 'life-hero-writing.webp' },
    { id: 'park', n: 'Lakeside Park', k: 'tree-pine', c: 'Park', x: 1580, y: 700, addr: '666 Bellevue Ave', rate: 4.8, hrs: 'Open 24 hours', img: PH + 'life-footer.webp' }
  ];
  const MPR = { drive: { t: 9, d: '2.4 mi', via: 'via Broadway' }, transit: { t: 14, d: '1 transfer', via: 'Line 6, then walk 4 min' }, walk: { t: 38, d: '1.9 mi', via: 'via Franklin St' }, bike: { t: 13, d: '2.1 mi', via: 'Mostly bike lanes' } };
  const MPROUTE = [[760, 900], [760, 820], [980, 820], [980, 640], [1180, 640], [1180, 500], [1440, 500], [1440, 430]];
  const MPSTEPS = [['arrow-up', 'Head north on Alameda Ave', '0.2 mi'], ['corner-up-right', 'Turn right onto 12th St', '0.5 mi'], ['corner-up-left', 'Turn left onto Franklin St', '0.6 mi'], ['corner-up-right', 'Turn right onto 20th St', '0.4 mi'], ['corner-up-left', 'Turn left onto Broadway', '0.5 mi'], ['map-pin', 'The Loft is on your right', '']];
  const MP = { place: null, dir: false, mode: 'drive', nav: null, layer: 'map', view: { x: 1100, y: 740, z: .78 }, q: '' };
  const mpP = id => MPP.find(p => p.id === id);
  /* The city, drawn once. */
  const MPMAP = (() => { const r = meSeed('oakland'); let s = '';
    s += `<rect class="mland" x="-400" y="-400" width="2800" height="2200"/>`;
    s += `<path class="mwater" d="M-400,-400 L380,-400 C300,0 420,300 300,560 C200,780 420,960 560,1140 C700,1300 1200,1260 1600,1330 C1900,1380 2200,1340 2400,1360 L2400,1800 L-400,1800 Z"/>`;
    s += `<path class="mpark" d="M1380,560 C1500,470 1700,500 1760,620 C1820,760 1740,880 1600,900 C1480,910 1400,820 1380,720 Z"/><path class="mwater" d="M1450,620 C1520,560 1660,580 1700,660 C1740,760 1660,840 1570,840 C1480,840 1430,760 1450,620 Z"/>`;
    s += `<rect class="mpark" x="880" y="1020" width="160" height="110" rx="14"/><rect class="mpark" x="620" y="330" width="120" height="160" rx="14"/><circle class="mpark" cx="1260" cy="330" r="60"/>`;
    for (let x = 440; x < 2300; x += 70) s += `<path class="mst" d="M${x},-200 L${x + 40},1500"/>`;
    for (let y = -200; y < 1500; y += 62) s += `<path class="mst" d="M300,${y} L2300,${y - 70}"/>`;
    [[760, 'M760,1200 L760,200'], [980, 'M980,1200 L980,100'], [1180, 'M1180,1200 L1180,0'], [1440, 'M1440,1100 L1440,-100']].forEach(([, d]) => s += `<path class="mart" d="${d}"/>`);
    [[820, 'M400,820 L1900,820'], [640, 'M500,640 L1400,640'], [500, 'M600,500 L2200,500'], [1000, 'M500,1000 L2000,1000']].forEach(([, d]) => s += `<path class="mart" d="${d}"/>`);
    s += `<path class="mfwy" d="M300,1180 C700,1120 900,1160 1200,1080 C1500,1000 1700,1020 2300,940"/><path class="mfwy" d="M1900,-200 C1860,200 1880,500 1960,900 C2020,1200 2000,1400 2020,1600"/>`;
    s += `<path class="mrail" d="M420,1130 C800,1090 1100,1120 1400,1060"/>`;
    [['UPTOWN', 1260, 420], ['OLD OAKLAND', 700, 700], ['CHINATOWN', 900, 940], ['JACK LONDON', 820, 1120], ['LAKESIDE', 1600, 960], ['ADAMS POINT', 1700, 420]].forEach(([n, x, y]) => s += `<text class="mhood" x="${x}" y="${y}">${n}</text>`);
    [['Broadway', 1452, 300, 90], ['Franklin St', 992, 380, 90], ['20th St', 1300, 492, 0], ['12th St', 560, 812, 0], ['Alameda Ave', 772, 1060, 90]].forEach(([n, x, y, rot]) => s += `<text class="mstn" x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})">${n}</text>`);
    s += `<text class="mwtr" x="120" y="720">OAKLAND ESTUARY</text><text class="mwtr" x="1500" y="740">Lake Merritt</text>`;
    return s; })();
  function mpRender() { const v = MP.view, route = MP.dir || MP.nav;
    const pois = MPP.map(p => `<g class="mpoi${MP.place === p.id ? ' on' : ''}${p.fav ? ' fav' : ''}" data-mpp="${p.id}" transform="translate(${p.x} ${p.y}) scale(${1 / v.z})"><circle r="15"/><foreignObject x="-9" y="-9" width="18" height="18"><div xmlns="http://www.w3.org/1999/xhtml" class="mpoig">${ic(p.k)}</div></foreignObject>${v.z > .6 || MP.place === p.id ? `<text y="30">${esc(p.fav || p.n)}</text>` : ''}</g>`).join('');
    const me = MP.nav ? MP.nav.pos : [760, 900];
    $('#mp-map').innerHTML = `<svg viewBox="0 0 1 1" preserveAspectRatio="none" class="mpsvg"><g id="mp-g" transform="${mpT()}">${MPMAP}
      ${route ? `<polyline class="mrtc" points="${MPROUTE.map(p => p.join(',')).join(' ')}" style="stroke-width:${22 / v.z}"/><polyline class="mrt ${MP.mode}" points="${MPROUTE.map(p => p.join(',')).join(' ')}" style="stroke-width:${12 / v.z}"/>` : ''}
      ${pois}<g class="mme" transform="translate(${me[0]} ${me[1]}) scale(${1 / v.z})"><circle r="26" class="mhalo"/><circle r="10"/></g></g></svg>`; mpSize(); }
  function mpT() { const el = $('#mp-map'), W = el?.clientWidth || 1000, H = el?.clientHeight || 700, v = MP.view; return `translate(${W / 2 - v.x * v.z} ${H / 2 - v.y * v.z}) scale(${v.z})`; }
  function mpSize() { const el = $('#mp-map'), s = el.querySelector('svg'); s.setAttribute('viewBox', `0 0 ${el.clientWidth} ${el.clientHeight}`); $('#mp-g').setAttribute('transform', mpT()); }
  function mpCard() { mpCard0(); if (mpNarrow()) mpBar(); }
  function mpCard0() { const box = $('#mp-card'), p = mpP(MP.place);
    if (MP.nav) { const st = MPSTEPS[MP.nav.step]; box.innerHTML = `<div class="mpnav"><span class="mpnavi">${ic(st[0])}</span><div><b>${st[2] ? `In ${MP.nav.left}, ` : ''}${esc(st[1].replace(/^Turn/, st[2] ? 'turn' : 'Turn'))}</b><small>Then ${esc((MPSTEPS[MP.nav.step + 1] || ['', 'you’ve arrived'])[1].toLowerCase())}</small></div></div>`; box.className = 'mpcard nav'; return; }
    if (!p) { box.className = 'mpcard off'; box.innerHTML = ''; return; } box.className = 'mpcard';
    if (MP.dir) { const R = MPR[MP.mode]; box.innerHTML = `<header class="mpdh"><button class="ib" type="button" data-mpdirx title="Back">${ic('chevron-left')}</button><div><small>From</small><b>Suno Studio</b><small>To</small><b>${esc(p.n)}</b></div><button class="ib" type="button" data-mptodo="Swapped" title="Swap">${ic('arrow-down')}</button></header>
      <div class="mpmodes">${[['drive', 'car'], ['transit', 'train-front'], ['walk', 'footprints'], ['bike', 'bike']].map(([k, i]) => `<button type="button" class="${MP.mode === k ? 'on' : ''}" data-mpmode="${k}">${ic(i)}<b>${MPR[k].t} min</b></button>`).join('')}</div>
      <div class="mproute"><div><b>${MPR[MP.mode].t} min</b><span>${MPR[MP.mode].d} · ${MPR[MP.mode].via}</span><small>Arrive ${mpEta(MPR[MP.mode].t)}${MP.mode === 'drive' ? ' · light traffic' : ''}</small></div><button class="bt key" type="button" data-mpgo>${ic('navigation')}Go</button></div>
      <ol class="mpsteps">${MPSTEPS.map(([i, t, d]) => `<li>${ic(i)}<span>${esc(t)}</span><em>${d}</em></li>`).join('')}</ol>`; return; }
    box.innerHTML = `<div class="mpimg" style="background-image:url('${p.img}')"><button class="ib" type="button" data-mpx title="Close">${ic('x')}</button></div><div class="mpc"><h2>${esc(p.n)}</h2><p class="mpmeta">${esc(p.c)}${p.rate ? ` · <b>★ ${p.rate}</b>` : ''}${p.price ? ` · ${p.price}` : ''}</p>${p.hrs ? `<p class="mphrs${/until|24/.test(p.hrs) ? ' open' : ''}">${esc(p.hrs)}</p>` : ''}
      <div class="mpacts"><button class="mpa" type="button" data-mpdir>${ic('navigation')}<span>${MPR.drive.t + (p.id === 'loft' ? 0 : 3)} min</span></button><button class="mpa" type="button" data-mptodo="Calling ${esc(p.n)}">${ic('phone')}<span>Call</span></button><button class="mpa${p.fav ? ' lit' : ''}" type="button" data-mptodo="${p.fav ? 'Already in Favorites' : 'Added to Favorites'}">${ic('star')}<span>Favorites</span></button><button class="mpa" type="button" data-share>${ic('share-2')}<span>Share</span></button></div>
      <dl class="mpdl"><div><dt>Address</dt><dd>${esc(p.addr)}, Oakland</dd></div>${p.id === 'loft' ? `<div><dt>On your calendar</dt><dd>Launch night · Thursday, 6 PM</dd></div>` : ''}</dl></div>`; }
  const mpEta = m => { const d = new Date(Date.now() + m * 60e3); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  function mpSide() { mpSide0(); if (mpNarrow() && MP.px === 'search') mpBar(); }
  /* Guides: small lists of places worth your time, from people you know or made by you; one tap puts them on the map */
  const MPG = [{ id: 'coffee', t: 'Coffee near the studio', by: 'Priya', k: 'PR', img: PH + 'life-hero-studio.webp', ps: ['door', 'books', 'park'], note: 'Where the team actually goes between meetings.' },
    { id: 'launch', t: 'Launch week', by: 'You', k: 'me', img: PH + 'life-professionals-loft.webp', ps: ['studio', 'loft', 'duende'], note: 'Studio, the venue, and dinner after.' },
    { id: 'sunday', t: 'A slow Sunday', by: 'Nora', k: 'NF', img: PH + 'life-footer.webp', ps: ['park', 'books', 'door'], note: 'Lake loop, a bookstore, one more coffee.' }];
  function mpGuideHTML() { const g = MPG.find(x => x.id === MP.guide); if (!g) return '';
    return `<div class="mpgd"><button class="fexr2 fback" type="button" data-mpguide="">${ic('chevron-left')}<span>Guides</span></button><div class="mpgh" style="background-image:url('${g.img}')"><span><b>${esc(g.t)}</b><small>${av(g.k, 18)}By ${esc(g.by)} · ${g.ps.length} places</small></span></div><p class="mpgnote">${esc(g.note)}</p>
      ${g.ps.map((id, i) => { const p = mpP(id); return `<button class="mprow" type="button" data-mpp="${p.id}"><span class="mpgn">${i + 1}</span><span><b>${esc(p.n)}</b><small>${esc(p.c)}${p.rate ? ` · ★ ${p.rate}` : ''} · ${esc(p.hrs || p.addr)}</small></span></button>`; }).join('')}
      <div class="mpgact"><button class="bt fill" type="button" data-mptodo="Saved to your Guides">${ic('bookmark')}Save</button><button class="bt fill" type="button" data-mptodo="Sent the guide to Messages">${ic('share-2')}Share</button><button class="bt pri" type="button" data-mpp="${g.ps[0]}">${ic('navigation')}Start</button></div></div>`; }
  function mpSide0() { if (MP.guide && !MP.q) { $('#mp-side').innerHTML = mpGuideHTML(); return; } const q = MP.q.toLowerCase(), res = q ? MPP.filter(p => (p.n + ' ' + p.c + ' ' + p.addr).toLowerCase().includes(q)) : [];
    /* a typed street address is a result in itself: "710 central" → 710 Central Ave, Oakland */
    const adr = /^\d+\s+[a-z]/i.test(MP.q.trim()) ? (() => { const w = MP.q.trim().replace(/\s+/g, ' ').split(' ').map(x => /^\d/.test(x) ? x : x[0].toUpperCase() + x.slice(1).toLowerCase()); if (!/^(St|Ave|Blvd|Rd|Way|Dr|Ln|Ct|Pl)\.?$/i.test(w[w.length - 1])) w.push('Ave'); return w.join(' '); })() : '';
    $('#mp-side').innerHTML = `<div class="mpme"><button class="mpmerow" type="button" data-mpme><span class="mpri me">${ic('navigation')}</span><span><b>My location</b><small>${MP.shared ? 'Shared with Priya · 1 hr left' : 'Suno Studio, 2nd St'}</small></span></button><button class="ib mpmesh${MP.shared ? ' on' : ''}" type="button" data-share="loc" aria-label="Share my location" title="Share my location">${ic('share-2')}</button></div>
      ${q ? `<hr class="mphr">${adr ? `<div class="mapsh">Address</div><button class="mprow" type="button" data-mptodo="Pinned ${esc(adr)}, Oakland"><span class="mpri">${ic('map-pin')}</span><span><b>${esc(adr)}</b><small>Oakland, California</small></span></button>` : ''}${res.length || !adr ? '<div class="mapsh">Places</div>' : ''}${res.map(p => `<button class="mprow" type="button" data-mpp="${p.id}"><span class="mpri">${ic(p.k)}</span><span><b>${esc(p.n)}</b><small>${esc(p.c)} · ${esc(p.addr)}</small></span></button>`).join('') || (adr ? '' : '<p class="mpnone">No places match. Try a name, a kind of place or a street address.</p>')}`
        : `<hr class="mphr"><div class="mapsh">Favorites</div><div class="mpfavs">${MPP.filter(p => p.fav).map(p => `<button type="button" data-mpp="${p.id}"><span>${ic(p.k)}</span>${p.fav}<small>${MPR.drive.t + (p.id === 'loft' ? 0 : p.id === 'home' ? 6 : -9 + 9)} min</small></button>`).join('')}</div>
        <hr class="mphr"><div class="mapsh">Guides</div><div class="mpguides">${MPG.map(g => `<button type="button" data-mpguide="${g.id}" style="background-image:url('${g.img}')"><span><b>${esc(g.t)}</b><small>${esc(g.by)} · ${g.ps.length} places</small></span></button>`).join('')}</div>
        <hr class="mphr"><div class="mapsh">Recents</div>${['duende', 'door', 'books'].map(id => { const p = mpP(id); return `<button class="mprow" type="button" data-mpp="${p.id}"><span class="mpri">${ic(p.k)}</span><span><b>${esc(p.n)}</b><small>${esc(p.addr)}</small></span></button>`; }).join('')}`}`; }
  const MPLAY = [['map', 'Map', 'map'], ['transit', 'Transit', 'train-front'], ['sat', 'Satellite', 'satellite']];
  /* Maps on a phone: the map is the whole screen. One bar at the bottom: search, which grows your location, favorites,
     recents and results; a picked place grows its card with Directions, Call, Favorite and Share in the row; directions
     grow the route and its steps, with Go. Map style and where-am-I stack at the top right. */
  const mpNarrow = () => { const w = $('#w-maps'); return !!w?.clientWidth && w.clientWidth < 560; };
  function mpBarPhone(bar) { const X = MP.px || '', p = mpP(MP.place), ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    bar.classList.add('phnofit', 'mpphbar'); const focused = document.activeElement?.matches?.('[data-mpq]'); let panel = '', row;
    if (MP.nav) { bar.classList.remove('phgrow'); setBar(bar, `<span class="mpeta"><b>${MP.nav.min} min</b><span>${MP.nav.mi} mi · arrive ${mpEta(MP.nav.min)}</span></span>${ib('data-mptodo="Voice guidance is on"', 'volume-2', 'Voice')}<button class="bt mpend" type="button" data-mpend>End</button>`); return; }
    if (p && MP.dir) { const R = MPR[MP.mode]; panel = `<div class="fexp mpcard2 dir">${$('#mp-card').innerHTML}</div>`; row = `<span class="mpeta"><b>${R.t} min<em>${MP.mode === 'drive' ? 'Light traffic' : ''}</em></b><span>${R.d} · arrive ${mpEta(R.t)}</span></span><button class="bt pri mpgo2" type="button" data-mpgo>${ic('navigation')}<span>Go</span></button>`; }
    else if (p) { panel = `<div class="fexp mpcard2">${$('#mp-card').innerHTML}</div>`; row = `<button class="bt pri mpgo2" type="button" data-mpdir>${ic('navigation')}<span>${MPR.drive.t + (p.id === 'loft' ? 0 : 3)} min</span></button>${ib(`data-mptodo="Calling ${esc(p.n)}"`, 'phone', 'Call')}${ib(`data-mptodo="${p.fav ? 'Already in Favorites' : 'Added to Favorites'}"`, 'star', 'Favorite', !!p.fav)}${ib('data-mppx="share"', 'share-2', 'Share', X === 'share')}${ib('data-mpx', 'x', 'Close')}`;
      if (X === 'share') panel = `<div class="fexp fshare2"><div class="fexh">Send ${esc(p.n)} to</div><div class="fshp">${['PR', 'NF', 'SK', 'TH', 'MO'].map(k => `<button type="button" data-mptodo="Sent to ${esc(ppl(k).n.split(' ')[0])}">${av(k, 48)}<span>${esc(ppl(k).n.split(' ')[0])}</span></button>`).join('')}</div><div class="fsha">${[['message-square', 'Messages'], ['mail', 'Email'], ['link', 'Copy link'], ['radio-tower', 'Nearby']].map(([i, n]) => `<button type="button" class="fvt" data-mptodo="${n === 'Copy link' ? 'Link copied' : 'Sent with ' + n}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`; }
    else { if (X === 'search') panel = MP.guide && !MP.q ? `<div class="fexp mpgpan">${mpGuideHTML()}</div>` : `<div class="fexp mpsrch2">${$('#mp-side').innerHTML}</div>`;
      else if (X === 'layers') panel = `<div class="fexp"><div class="fexh">Map style</div><div class="fsha c3">${MPLAY.map(([k, n, i]) => `<button type="button" class="fvt${MP.layer === k ? ' on' : ''}" data-mplayer="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`;
      row = `<label class="srch keep">${ic('search')}<input placeholder="Search Maps" value="${esc(MP.q)}" data-mpq autocomplete="off" spellcheck="false" aria-label="Search places and addresses"></label>${X === 'search' ? ib('data-mppx="search"', 'x', 'Close search') : ''}`; }
    bar.classList.toggle('phgrow', !!panel); setBar(bar, panel + row);
    const i = $('#mp-bar [data-mpq]'); if (i) { i.onfocus = () => { if (MP.px !== 'search') { MP.px = 'search'; mpBar(); const n = $('#mp-bar [data-mpq]'); n.focus(); } }; if (focused) { i.focus({ preventScroll: true }); i.setSelectionRange(i.value.length, i.value.length); } } }
  function mpBar() { const bar = $('#mp-bar');
    if (mpNarrow()) return mpBarPhone(bar); bar.classList.remove('phnofit', 'mpphbar', 'phgrow');
    if (MP.nav) { setBar(bar, `<span class="mpeta"><b>${MP.nav.min} min</b><span>${MP.nav.mi} mi · arrive ${mpEta(MP.nav.min)}</span></span><button class="ib" type="button" data-mptodo="Voice guidance is on" title="Voice">${ic('volume-2')}</button><button class="bt mpend" type="button" data-mpend>End</button>`); return; }
    const L = MPLAY.find(x => x[0] === MP.layer);
    setBar(bar, `<label class="mpq">${ic('search')}<input placeholder="Search places and addresses" value="${esc(MP.q)}" data-mpq autocomplete="off" spellcheck="false">${MP.q ? `<button class="mpqx" type="button" data-mpqx aria-label="Clear">${ic('x')}</button>` : ''}</label><span class="vr"></span><button class="ib" type="button" data-mpz="1" title="Zoom in">${ic('plus')}</button><button class="ib" type="button" data-mpz="-1" title="Zoom out">${ic('minus')}</button><button class="ib" type="button" data-mpme title="Where am I">${ic('navigation')}</button>`); }
  /* The map's style is a mode, so it sits in the top-right corner (SunoUI placement); the bar keeps search, zoom and where-am-I */
  function mpCorner() { const c = $('#mp-corner'); if (!c) return; c.hidden = !!MP.nav; if (mpNarrow()) { c.classList.add('mpstack'); c.innerHTML = `<button class="ib" type="button" data-mppx="layers" aria-label="Map style" title="Map style">${ic(MPLAY.find(x => x[0] === MP.layer)[2])}</button><i class="mpsep"></i><button class="ib" type="button" data-mpme aria-label="Where am I" title="Where am I">${ic('navigation')}</button>`; return; } c.classList.remove('mpstack'); c.innerHTML = lModes(MPLAY, MP.layer, 'data-mplayer', 'Map style'); requestAnimationFrame(segs); }
  function mpAll() { mpSide(); mpRender(); mpCard(); mpBar(); mpCorner(); $('#mp-map').dataset.layer = MP.layer; }
  function mpFly(x, y, z) { const v = MP.view, s = { ...v }, e = { x, y, z: z || v.z }, t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / 600), ease = 1 - Math.pow(1 - k, 3); Object.assign(MP.view, { x: s.x + (e.x - s.x) * ease, y: s.y + (e.y - s.y) * ease, z: s.z + (e.z - s.z) * ease }); $('#mp-g')?.setAttribute('transform', mpT()); if (k < 1) requestAnimationFrame(f); else mpRender(); }; requestAnimationFrame(f); }
  function mpGo() { MP.nav = { step: 0, pos: MPROUTE[0].slice(), seg: 0, t: 0, min: MPR.drive.t, mi: 2.4, left: '0.2 mi' }; MP.dir = false; mpFly(760, 900, 1.6); mpCard(); mpBar(); mpCorner();
    const len = MPROUTE.slice(1).map((p, i) => Math.hypot(p[0] - MPROUTE[i][0], p[1] - MPROUTE[i][1])), total = len.reduce((a, b) => a + b, 0); let dist = 0;
    MP.nav.iv = setInterval(() => { if (!MP.nav) return; dist = Math.min(total, dist + 9); let d = dist, i = 0; while (i < len.length - 1 && d > len[i]) { d -= len[i]; i++; } const a = MPROUTE[i], b = MPROUTE[i + 1], k = Math.min(1, d / len[i]);
      MP.nav.pos = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; MP.nav.step = Math.min(MPSTEPS.length - 1, i); const rem = 1 - dist / total; MP.nav.min = Math.max(1, Math.round(MPR.drive.t * rem)); MP.nav.mi = (2.4 * rem).toFixed(1); MP.nav.left = `${Math.max(100, Math.round((len[i] - d) * 3.2 / 10) * 10)} ft`;
      MP.view.x = MP.nav.pos[0]; MP.view.y = MP.nav.pos[1]; mpRender(); mpCard(); const e = $('#mp-bar .mpeta'); if (e) e.innerHTML = `<b>${MP.nav.min} min</b><span>${MP.nav.mi} mi · arrive ${mpEta(MP.nav.min)}</span>`;
      if (dist >= total) { clearInterval(MP.nav.iv); MP.nav = null; MP.place = 'loft'; mpAll(); mpToast('You’ve arrived at The Loft'); } }, 60); }
  function mpToast(msg, icon) { lToast($('#w-maps'), msg, { icon: icon || 'check' }); }
  function mpClick(e, hit) { const q = s => hit(s);
    const gd = q('[data-mpguide]'); if (gd) { MP.guide = gd.dataset.mpguide || null; mpSide0(); if (MP.guide) { const g = MPG.find(x => x.id === MP.guide), P = g.ps.map(mpP); mpFly(P.reduce((t, p) => t + p.x, 0) / P.length, P.reduce((t, p) => t + p.y, 0) / P.length, .8); } if (mpNarrow()) { MP.px = 'search'; mpBar(); requestAnimationFrame(() => { const f = $('#mp-bar .fexp'); if (f) f.scrollTop = 0; }); } return true; }
    if (mpNarrow()) { const px = q('[data-mppx]'); if (px) { const k = px.dataset.mppx; MP.px = MP.px === k ? '' : k; if (k === 'search' && !MP.px) { MP.q = ''; mpSide0(); } mpBar(); return true; }
      if (q('[data-mpp]')) { MP.px = ''; MP.q = ''; document.activeElement?.blur(); }
      const ly2 = q('[data-mplayer]'); if (ly2) { MP.layer = ly2.dataset.mplayer; $('#mp-map').dataset.layer = MP.layer; MP.px = ''; mpBar(); mpCorner(); return true; }
      if (q('[data-mpx]') || q('[data-mpdir]') || q('[data-mpdirx]') || q('[data-mptodo]') || q('[data-mpgo]') || q('[data-mpend]')) { MP.px = ''; setTimeout(mpBar); } }
    const pp = q('[data-mpp]'); if (pp && !MP.nav) { MP.place = pp.dataset.mpp; MP.dir = false; const p = mpP(MP.place); mpFly(p.x - 120 / MP.view.z, p.y, Math.max(MP.view.z, .95)); mpCard(); return true; }
    if (q('[data-mpx]')) { MP.place = null; mpRender(); mpCard(); mpBar(); return true; }
    if (q('[data-mpdir]')) { MP.dir = true; mpFly(1100, 660, .74); mpCard(); return true; }
    if (q('[data-mpdirx]')) { MP.dir = false; mpRender(); mpCard(); return true; }
    const md = q('[data-mpmode]'); if (md) { MP.mode = md.dataset.mpmode; mpRender(); mpCard(); return true; }
    if (q('[data-mpgo]')) { mpGo(); return true; }
    if (q('[data-mpend]')) { clearInterval(MP.nav.iv); MP.nav = null; mpAll(); return true; }
    const lb = q('[data-mplayers]'); if (lb) { if ($('#lmenu')) { $('#lmenu').remove(); return true; } lMenu(lb, MPLAY.map(([k, n, i]) => crMi(`data-mplayer="${k}"`, i, n, MP.layer === k ? ' on' : '').replace('</span></button>', `</span>${MP.layer === k ? ic('check') : ''}</button>`)).join('')); return true; }
    const ly = q('[data-mplayer]'); if (ly) { $('#lmenu')?.remove(); MP.layer = ly.dataset.mplayer; $('#mp-map').dataset.layer = MP.layer; mpBar(); mpCorner(); return true; }
    if (q('[data-mpqx]')) { MP.q = ''; mpSide(); mpBar(); $('[data-mpq]')?.focus(); return true; }
    const z = q('[data-mpz]'); if (z) { mpFly(MP.view.x, MP.view.y, Math.max(.4, Math.min(3, MP.view.z * (+z.dataset.mpz > 0 ? 1.4 : 1 / 1.4)))); return true; }
    if (q('[data-mpme]')) { mpFly(760, 900, 1.3); return true; }
    const td = q('[data-mptodo]'); if (td) { mpToast(td.dataset.mptodo); return true; }
    return false; }
  function renderMaps() { $('#mp-top').innerHTML = `<img src="${A}maps.svg" alt=""><b>Maps</b><span class="chev">${ic('chevron-down')}</span>`; mpAll();
    const m = $('#mp-map'); new ResizeObserver(() => mpSize()).observe(m);
    m.addEventListener('pointerdown', e => { if (e.target.closest('[data-mpp]') || MP.nav) return; const sx = e.clientX, sy = e.clientY, v0 = { ...MP.view }; let moved = false; m.setPointerCapture(e.pointerId);
      const mv = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.hypot(dx, dy) > 3) moved = true; MP.view.x = v0.x - dx / MP.view.z; MP.view.y = v0.y - dy / MP.view.z; $('#mp-g').setAttribute('transform', mpT()); };
      const up = () => { m.removeEventListener('pointermove', mv); m.removeEventListener('pointerup', up); if (moved) mpRender(); }; m.addEventListener('pointermove', mv); m.addEventListener('pointerup', up); });
    m.addEventListener('wheel', e => { e.preventDefault(); MP.view.z = Math.max(.4, Math.min(3, MP.view.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); $('#mp-g').setAttribute('transform', mpT()); clearTimeout(mpRender.t); mpRender.t = setTimeout(mpRender, 120); }, { passive: false }); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-mpq]')) { const had = !!MP.q; MP.q = e.target.value; mpSide(); if (had !== !!MP.q) { mpBar(); const i = $('[data-mpq]'); i.focus({ preventScroll: true }); i.setSelectionRange(i.value.length, i.value.length); } } });

  /* ══ Phone ═══════════════════════════════════════════════════════════════════
     On a desk, calls are mostly faces. People first, lit by their own photo; one button to see them,
     one to hear them. A call takes the whole island and gets out of the way of the conversation. */
  const PNNUM = { PR: '+1 (510) 555-0132', NF: '+1 (510) 555-0178', SK: '+1 (415) 555-0161', TH: '+1 (510) 555-0199', MO: '+1 (510) 555-0142', AR: '+1 (510) 555-0117', JK: '+1 (628) 555-0120', CL: '+1 (415) 555-0104' };
  const PNR = [
    { id: 'r1', who: ['PR'], kind: 'video', dir: 'out', when: 'Today, 9:41 AM', len: '12 min' },
    { id: 'r2', who: ['MO'], kind: 'voice', dir: 'missed', when: 'Today, 8:10 AM', vm: true },
    { id: 'r3', who: ['PR', 'NF', 'SK'], kind: 'video', dir: 'in', when: 'Yesterday, 4:00 PM', len: '42 min', group: 'Launch crew' },
    { id: 'r4', who: ['TH'], kind: 'voice', dir: 'in', when: 'Yesterday, 4:30 PM', len: '6 min' },
    { id: 'r5', who: ['?'], num: '+1 (415) 555-0199', kind: 'voice', dir: 'missed', when: 'Monday', spam: true },
    { id: 'r6', who: ['NF'], kind: 'voice', dir: 'out', when: 'Monday', len: '3 min' },
    { id: 'r7', who: ['AR'], kind: 'video', dir: 'in', when: 'Sunday', len: '28 min' }];
  const PNVM = [{ id: 'v1', who: 'MO', when: 'Today, 8:11 AM', len: 18, t: 'Hey, it’s Dad. Call me back when you get a chance. Nothing urgent, just want to hear how the launch prep is going.' }, { id: 'v2', who: 'JK', when: 'Friday', len: 31, t: 'Hi Nick, Jordan here. The printer for the event banners needs the final file by Tuesday. Give me a ring.' }];
  const PNFAV = ['PR', 'NF', 'MO', 'SK'];
  /* Phone reads the one address book: everyone in Contacts with a number is callable here, not a separate phone list */
  Object.keys(CX).forEach(k => { const n = CX[k].phone || PPL[k]?.phone; if (n && PPL[k] && !PNNUM[k]) PNNUM[k] = n; });
  const PN = { tab: 'pad', sel: 'r1', person: 'PR', pad: '', call: null, q: '', vmPlay: null };
  const pnName = k => k === 'me' ? 'You' : PPL[k]?.n || k;
  const pnPhoto = k => PPL[k]?.face ? PH + PPL[k].face[0] + '.webp' : null;
  const pnAv = (k, sz) => k === '?' ? `<i class="av round pnunk" style="width:${sz}px;height:${sz}px">${ic('phone')}</i>` : av(k, sz);

  function pnSide() { const q = PN.q.toLowerCase();
    const recents = PNR.map(r => { const n = r.group || (r.who[0] === '?' ? r.num : pnName(r.who[0])); return `<button class="pnrow${PN.sel === r.id ? ' on' : ''}${r.dir === 'missed' ? ' missed' : ''}" type="button" data-pnr="${r.id}">${r.who.length > 1 ? `<span class="pnstk">${r.who.slice(0, 2).map(k => pnAv(k, 28)).join('')}</span>` : pnAv(r.who[0], 38)}<span class="pntx"><b>${esc(n)}</b><small>${ic(r.dir === 'missed' ? 'phone-missed' : r.dir === 'in' ? 'phone-incoming' : 'phone-outgoing')}${r.kind === 'video' ? 'Video' : 'Voice'}${r.spam ? ' · likely spam' : r.len ? ' · ' + r.len : ' · missed'}</small></span><time>${r.when.replace(/, .*/, '')}</time></button>`; }).join('');
    let let0 = '';
    const contacts = Object.keys(PNNUM).filter(k => !q || pnName(k).toLowerCase().includes(q)).sort((a, b) => pnName(a).localeCompare(pnName(b))).map(k => { const L = pnName(k)[0].toUpperCase(), hd = !q && L !== let0 ? `<div class="pnlet">${L}</div>` : ''; let0 = L; return hd + `<button class="pnrow${PN.tab === 'contacts' && PN.person === k ? ' on' : ''}" type="button" data-pnp="${k}">${pnAv(k, 38)}<span class="pntx"><b>${esc(pnName(k))}</b><small>${PNNUM[k]}</small></span></button>`; }).join('') + (q ? '' : `<p class="pncount">${Object.keys(PNNUM).length} contacts</p>`);
    const vms = PNVM.map(v => `<button class="pnrow${PN.sel === v.id ? ' on' : ''}" type="button" data-pnvm="${v.id}">${pnAv(v.who, 38)}<span class="pntx"><b>${esc(pnName(v.who))}</b><small>${esc(v.t.slice(0, 44))}…</small></span><time>${v.when.replace(/, .*/, '')}<br>0:${String(v.len).padStart(2, '0')}</time></button>`).join('');
    $('#pn-side').innerHTML = `<div class="pnfavs"${PN.tab === 'vm' ? ' hidden' : ''}><h6>Favorites</h6>${PNFAV.map(k => `<button type="button" data-pnp="${k}" title="${pnName(k)}">${pnAv(k, 48)}<span>${pnName(k).split(' ')[0]}</span></button>`).join('')}</div>
      <div class="scr pnlist">${(PN.tab === 'recents' || PN.tab === 'pad') && !q ? recents : PN.tab === 'vm' && !q ? vms : contacts}</div>
      <div class="pnfoot"><label class="srch pnq">${ic('search')}<input placeholder="Search people and numbers" value="${esc(PN.q)}" data-pnq></label></div>`; }
  function pnMain() { const b = $('#pn-body'); $('#w-phone').classList.toggle('incall', !!PN.call);
    if (PN.call) return pnCallView();
    if (PN.tab === 'pad') { const d = PN.pad, match = d.length > 2 ? Object.keys(PNNUM).find(k => PNNUM[k].replace(/\D/g, '').includes(d.replace(/\D/g, ''))) : null;
      b.innerHTML = `<div class="pnpad"><div class="pndisp">${d ? esc(pnFmt(d)) : '<span>Type a number</span>'}</div><div class="pnmatch">${match ? `${pnAv(match, 22)}${esc(pnName(match))}` : ''}</div>
        <div class="pnkeys">${[['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', ''], ['#', '']].map(([n, l]) => `<button type="button" data-pnkey="${n}" class="${n === '*' || n === '#' ? 'pnsym' : ''}" aria-label="${n === '*' ? 'Star' : n === '#' ? 'Pound' : n}"${n === '0' ? ' title="Hold for +"' : ''}>${n === '*' ? ic('asterisk') : n === '#' ? ic('hash') : `<b>${n}</b>`}${n === '*' || n === '#' ? '' : `<small>${l}</small>`}</button>`).join('')}</div>
        <div class="pnpadact"><button class="pnbig video" type="button" data-pncall="video" ${d ? '' : 'disabled'} aria-label="Video call" title="Video call">${ic('video')}</button><button class="pnbig voice" type="button" data-pncall="voice" ${d ? '' : 'disabled'} aria-label="Call" title="Call">${ic('phone')}</button><button class="pndel" type="button" data-pndel ${d ? '' : 'disabled'} aria-label="Delete">${ic('delete')}</button></div></div>`; return; }
    const vm = PN.tab === 'vm' ? PNVM.find(v => v.id === PN.sel) : null, r = PN.tab === 'recents' ? PNR.find(x => x.id === PN.sel) : null, k = vm ? vm.who : r ? r.who[0] : PN.person, grp = r && r.who.length > 1, photo = pnPhoto(k);
    const tog = [];
    PNR.filter(x => x.who.includes(k) && x.who.length === 1).forEach(x => tog.push([x.kind === 'video' ? (x.dir === 'missed' ? 'video-off' : 'video') : x.dir === 'missed' ? 'phone-missed' : x.dir === 'in' ? 'phone-incoming' : 'phone-outgoing', `${x.kind === 'video' ? 'Video call' : 'Call'}${x.dir === 'missed' ? ', missed' : x.dir === 'in' ? ' from ' + pnName(k).split(' ')[0] : ''}`, x.len || '', x.when, x.dir === 'missed' ? 'missed' : '']));
    try { const cv = CONVOS.find(c => c.dm === k); const lm = cv?.msgs.filter(m => m.t).pop(); if (lm) tog.push(['message-square', `${lm.from === 'me' ? 'You texted' : pnName(k).split(' ')[0] + ' texted'}: “${lm.t.slice(0, 44)}${lm.t.length > 44 ? '…' : ''}”`, '', lm.at || 'Today', '']); } catch (e) {}
    try { CRT.filter(t => t.box !== 'trash' && t.msgs.length && crOthers(t).includes(k)).slice(0, 2).forEach(t => tog.push(['mail', `Email: ${t.subj}`, '', crLast(t).at, ''])); } catch (e) {}
    const hist = tog.map(([i, t, len, when, cls]) => `<li class="${cls}">${ic(i)}<span>${esc(t)}</span><em>${len}</em><time>${esc(when)}</time></li>`).join('');
    b.innerHTML = `<div class="pnperson">${photo && !grp ? `<i class="pnlight" style="background-image:url('${photo}')"></i>` : ''}<div class="pnpc">
      ${grp ? `<div class="pngrp">${r.who.map(x => pnAv(x, 84)).join('')}</div><h1>${esc(r.group)}</h1><p>${r.who.map(pnName).join(', ')} and you</p>` : k === '?' ? `${pnAv('?', 112)}<h1>${r.num}</h1><p class="pnspam">${ic('triangle-alert')}Reported as spam by 214 people</p>` : `${pnAv(k, 112)}<h1>${esc(pnName(k))}</h1><p>mobile · ${PNNUM[k]}</p>`}
      ${k === '?' ? lStack([{ icon: 'phone', label: 'Call back', attr: 'data-pncall="voice"' }, { icon: 'shield', label: 'Block', attr: 'data-pnblock', danger: true }], '', 'lcacts pnlacts') : grp ? lStack([{ icon: 'message-square', label: 'Message', attr: 'data-pntodo="Opening Launch crew in Messages"' }, { icon: 'phone', label: 'Call', attr: 'data-pncall="voice"' }, { icon: 'video', label: 'Video', attr: 'data-pncall="video"' }], '', 'lcacts pnlacts') : lContactActs(k).replace('lcacts', 'lcacts pnlacts')}
      ${vm ? `<section class="pnvm"><header><button class="pnplay" type="button" data-pnvmplay>${ic(PN.vmPlay ? 'pause' : 'play')}</button><span class="pnvbar"><i id="pn-vbar" style="width:${PN.vmPlay ? PN.vmPlay.t / vm.len * 100 : 0}%"></i></span><em>0:${String(vm.len).padStart(2, '0')}</em></header><p>${esc(vm.t)}</p><small>Transcribed on this computer</small></section>` : ''}
      ${hist && !grp && k !== '?' ? `<section class="pnhist"><h6>Together</h6><ul>${hist}</ul></section>` : ''}</div></div>`; }
  const pnFmt = d => { const x = d.replace(/\D/g, ''); return x.length === 10 ? `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}` : x.length === 7 ? `${x.slice(0, 3)}-${x.slice(3)}` : x.length > 6 ? `${x.slice(0, 3)}-${x.slice(3, 6)}-${x.slice(6)}` : d; };
  function pnCallView() { const c = PN.call, b = $('#pn-body'), who = c.who, one = who.length === 1, k = who[0], photo = pnPhoto(k);
    if (c.kind === 'voice') { const ph = $('#w-phone').classList.contains('phone'); b.innerHTML = `<div class="pncall voice${c.pad ? ' padding' : ''}">${photo ? `<i class="pnlight big" style="background-image:url('${photo}')"></i>` : ''}<div class="pncc">${c.pad && ph ? '' : pnAv(k, 140)}<h1>${esc(k === 'dial' ? pnFmt(PN.pad) : pnName(k))}</h1><p>${ph ? `<i title="End-to-end encrypted">${ic('lock')}</i><em id="pn-timer">${c.t ? pnT(c.t) : 'Calling…'}</em>` : c.t ? 'Connected' : 'Calling…'}</p>${c.pad ? `<div class="pnkeys sm">${'123456789*0#'.split('').map(n => `<button type="button" data-pnkey="${n}"><b>${n}</b></button>`).join('')}</div>` : ''}</div>${pnCtrls()}</div>`; return; }
    const tiles = [...who, 'me'].filter(x => one ? x !== 'me' : true);
    b.innerHTML = `<div class="pncall video${one ? ' one' : ' grid n' + tiles.length}${c.blur ? ' blurbg' : ''}">${tiles.map(x => `<div class="pntile${x === c.speaking ? ' speaking' : ''}${x === 'me' && c.camOff ? ' off' : ''}"><i class="pnfeed" style="background-image:url('${x === 'me' ? PH + 'life-hero-home.webp' : pnPhoto(x) || ''}');background-position:${x === 'me' ? '80% 30%' : PPL[x]?.face ? `${PPL[x].face[1] * 100}% ${PPL[x].face[2] * 100}%` : 'center'}"></i>${x === 'me' && c.camOff ? `<span class="pnoff">${av('me', 64)}</span>` : ''}<span class="pnname">${x === 'me' ? 'You' : esc(pnName(x).split(' ')[0])}${x === 'me' && c.muted ? ic('mic-off') : ''}</span></div>`).join('')}
      ${one ? `<div class="pnself${c.camOff ? ' off' : ''}" id="pn-self" style="${c.selfPos || ''}"><i class="pnfeed" style="background-image:url('${PH}life-hero-home.webp');background-position:80% 30%"></i>${c.camOff ? `<span class="pnoff">${av('me', 40)}</span>` : ''}</div>` : ''}
      ${pnCtrls()}</div>`; }
  const pnT = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  /* In a call, the controls are a Suno floating bar at the large tier: who and how long first, then you, then the call, then End (the only red). */
  /* A call on a phone, laid out the way phone calls are: who and how long at the top, then six large round controls you
     can hit without looking (two rows of three), then End, red and wide, alone at the bottom. Video keeps the picture
     full screen and fades the controls after a few seconds, back on a tap. */
  function pnCtrlsPhone() { const c = PN.call, v = c.kind === 'video', one = c.who.length === 1, k = c.who[0], who = one ? (k === 'dial' ? pnFmt(PN.pad) : pnName(k)) : 'Launch crew';
    const b = (attr, icn, label, on, cls = '') => `<button class="pnc2${on ? ' on' : ''}${cls}" type="button" ${attr} aria-label="${label}"><i>${ic(icn)}</i><span>${label}</span></button>`;
    const grid = v ? [b('data-pnmute', c.muted ? 'mic-off' : 'mic', c.muted ? 'Unmute' : 'Mute', c.muted), b('data-pncam', c.camOff ? 'video-off' : 'video', 'Camera', c.camOff), b('data-pnflip', 'refresh-ccw', 'Flip'), b('data-pnshare', 'monitor-up', 'Share', c.share), b('data-pnblur', 'sparkles', 'Effects', c.blur), b('data-pnaudio data-lmenu', 'headphones', 'Audio')]
      : [b('data-pnmute', c.muted ? 'mic-off' : 'mic', c.muted ? 'Unmute' : 'Mute', c.muted), b('data-pnkp', 'grid-3x3', 'Keypad', c.pad), b('data-pnaudio data-lmenu', 'volume-2', 'Speaker', c.out === 'spk'), b('data-pntodo="Add someone to the call"', 'user-plus', 'Add'), b('data-pnup', 'video', 'Video'), b('data-pntodo="Opening Messages"', 'message-square', 'Message')];
    return `<div class="pnctop2${v ? ' v' : ''}"><b>${esc(who)}</b><small>${c.share ? 'Sharing your screen' : `<i title="End-to-end encrypted">${ic('lock')}</i><em id="pn-timer">${c.t ? pnT(c.t) : 'Calling…'}</em>`}</small></div>
      <div class="pnctrl2${v ? ' v' : ''}"><div class="pncg">${grid.join('')}</div><div class="pnendrow">${!v && c.pad ? `<button class="pnhide" type="button" data-pnkp>Hide</button>` : '<span></span>'}<button class="pnend2" type="button" data-pnend aria-label="End call">${ic('phone-off')}</button><span></span></div></div>`; }
  function pnCtrls() { const c = PN.call, v = c.kind === 'video', one = c.who.length === 1, k = c.who[0];
    if ($('#w-phone').classList.contains('phone')) return pnCtrlsPhone();
    const who = one ? (k === 'dial' ? pnFmt(PN.pad) : pnName(k)) : 'Launch crew', face = one ? pnAv(k === 'dial' ? '?' : k, 26) : `<span class="pnstk">${c.who.slice(0, 2).map(x => pnAv(x, 22)).join('')}</span>`;
    const b = (attr, icn, title, cls = '') => `<button class="pnc${cls}" type="button" ${attr} title="${title}" aria-label="${title}">${ic(icn)}</button>`;
    return `<div class="pnctrl"><span class="pnwho">${face}<span><b>${esc(who)}</b><small>${c.share ? `${ic('monitor-up')}Sharing your screen` : `<i title="End-to-end encrypted">${ic('lock')}</i><em id="pn-timer">${c.t ? pnT(c.t) : 'Calling…'}</em>`}</small></span></span><span class="vr"></span>
      ${b('data-pnmute', c.muted ? 'mic-off' : 'mic', c.muted ? 'Unmute' : 'Mute', c.muted ? ' off' : '')}${v ? b('data-pncam', c.camOff ? 'video-off' : 'video', c.camOff ? 'Turn camera on' : 'Turn camera off', c.camOff ? ' off' : '') + b('data-pnshare', 'monitor-up', c.share ? 'Stop sharing' : 'Share screen', c.share ? ' lit' : '') + b('data-pnblur', 'sparkles', c.blur ? 'Background effects on' : 'Background effects', c.blur ? ' lit' : '') : ''}<span class="vr"></span>
      ${v ? '' : b('data-pnkp', 'grid-2x2', 'Keypad', c.pad ? ' lit' : '') + b('data-pnup', 'video', 'Switch to video')}${b('data-pnaudio data-lmenu', 'headphones', 'Audio')}${b('data-pntodo="Add someone to the call"', 'user-plus', 'Add person')}<span class="vr"></span>
      <button class="pnend" type="button" data-pnend title="End call">${ic('phone-off')}<span>End</span></button></div>`; }
  /* Phone on a phone: one search for the whole app, in the bar, beside the four places as glyphs. Type a name or any
     digits: the people who match rise out of the bar with call, message and video on each, and digits offer to call
     the number itself. No page has its own search box. */
  function pnSearchHits(q) { const t = q.trim().toLowerCase(), dg = q.replace(/\D/g, ''); if (!t) return [];
    return Object.keys(PNNUM).filter(k => pnName(k).toLowerCase().split(' ').some(w => w.startsWith(t)) || pnName(k).toLowerCase().startsWith(t) || (dg.length > 2 && PNNUM[k].replace(/\D/g, '').includes(dg))).slice(0, 5); }
  function pnBarPhone(bar) { bar.classList.add('phnofit', 'pnphbar'); const q = PN.pq || '', hits = pnSearchHits(q), dg = q.replace(/\D/g, ''), vmN = PNVM.length;
    const hl = (s, t) => { const i = t ? s.toLowerCase().indexOf(t.toLowerCase()) : -1; return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + t.length)) + '</mark>' + esc(s.slice(i + t.length)); };
    const acts = a => `<span class="pnqa"><button class="ib" type="button" data-pnqmsg="${a}" aria-label="Message">${ic('message-square')}</button><button class="ib" type="button" data-pnqcall="video:${a}" aria-label="Video call">${ic('video')}</button><button class="ib pnqcall" type="button" data-pnqcall="voice:${a}" aria-label="Call">${ic('phone')}</button></span>`;
    const panel = q.trim() ? `<div class="fexp pnres">${dg.length > 2 && dg === q.replace(/[\s()+.-]/g, '') ? `<div class="pnqr"><i class="av round pnunk" style="width:40px;height:40px">${ic('phone')}</i><span><b>${esc(pnFmt(dg))}</b><small>Call this number</small></span>${acts('#' + dg)}</div>` : ''}
      ${hits.map(k => `<div class="pnqr"><button class="pnqp" type="button" data-pnp="${k}">${pnAv(k, 40)}<span><b>${hl(pnName(k), q.trim())}</b><small>${dg.length > 2 ? hl(PNNUM[k], dg) : PNNUM[k]}</small></span></button>${acts(k)}</div>`).join('')}
      ${!hits.length && !(dg.length > 2) ? `<p class="pnnone">No one matches “${esc(q.trim())}”</p>` : ''}</div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    const tab = (k, i, n, badge = '') => `<button class="ib pntb${PN.tab === k && !q ? ' on' : ''}" type="button" data-pntab="${k}" aria-label="${n}" title="${n}">${ic(i)}${badge}</button>`;
    bar.innerHTML = `${panel}<label class="srch keep">${ic('search')}<input id="pn-pq" placeholder="Search" value="${esc(q)}" aria-label="Search people and numbers" autocomplete="off"></label>${tab('pad', 'grid-3x3', 'Keypad')}${tab('recents', 'history', 'Recents')}${tab('contacts', 'users', 'Contacts')}${tab('vm', 'voicemail', 'Voicemail', vmN ? `<em class="pnbadge">${vmN}</em>` : '')}`;
    const i = $('#pn-pq'); i.oninput = () => { PN.pq = i.value; pnBarPhone(bar); const n = $('#pn-pq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; i.onkeydown = e => { if (e.key === 'Escape') { PN.pq = ''; pnBarPhone(bar); } }; }
  function pnBar() { const bar = $('#pn-bar'); if (PN.call) { bar.hidden = true; return; } bar.hidden = false;
    if (pnNarrow()) return pnBarPhone(bar); bar.classList.remove('phnofit', 'pnphbar', 'phgrow');
    setBar(bar, seg([['pad', `${ic('grid-3x3')}<span>Keypad</span>`, 'Keypad'], ['recents', `${ic('history')}<span>Recents</span>`, 'Recents'], ['contacts', `${ic('users')}<span>Contacts</span>`, 'Contacts'], ['vm', `${ic('voicemail')}<span>Voicemail</span>`, 'Voicemail']], PN.tab, 'data-pntab', 'Phone', 'pnplaces')); requestAnimationFrame(segs); return; setBar(bar, `<button class="bt${PN.tab === 'pad' ? ' key' : ''}" type="button" data-pntab="pad">${ic('grid-2x2')}Keypad</button><button class="bt" type="button" data-pntodo="Pick people, then start a group call">${ic('user-plus')}New group call</button>`); }
  function pnAll() { pnSide(); pnMain(); pnBar(); pnList(); }
  new ResizeObserver(() => pnList()).observe(document.querySelector('#w-phone .ibody'));
  function pnToast(msg, o) { lToast($('#w-phone'), msg, o); }
  $('#w-phone').luiCA = a => { if (a === 'call' || a === 'video') { pnStart(a === 'video' ? 'video' : 'voice'); return true; } return false; };
  function pnStart(kind) { let who; if (PN.tab === 'pad') who = [Object.keys(PNNUM).find(k => PNNUM[k].replace(/\D/g, '').includes(PN.pad.replace(/\D/g, ''))) || 'dial']; else { const r = PN.tab === 'recents' && PNR.find(x => x.id === PN.sel), vm = PN.tab === 'vm' && PNVM.find(x => x.id === PN.sel); who = r ? r.who : vm ? [vm.who] : [PN.person]; }
    PN.call = { kind, who, t: 0, muted: false, camOff: false, speaking: who[0] }; pnAll();
    PN.call.iv = setInterval(() => { if (!PN.call) return; PN.call.t++; const t = $('#pn-timer'); if (t) t.textContent = pnT(PN.call.t); if (PN.call.kind === 'video' && PN.call.who.length > 1 && PN.call.t % 3 === 0) { PN.call.speaking = PN.call.who[(PN.call.t / 3) % PN.call.who.length]; $$('#pn-body .pntile').forEach((el, i) => el.classList.toggle('speaking', [...PN.call.who, 'me'][i] === PN.call.speaking)); } }, 1000);
    pnIdle(); }
  /* Phone, narrow: the list is the tab. Recents, Contacts and Voicemail open on their list (favourites on top); tapping
     one opens it, with a back button to the list. The keypad is its own page. */
  const pnNarrow = () => { const b = $('#w-phone .ibody'); return !!b?.clientWidth && b.clientWidth < 560; };
  function pnList() { const w = $('#w-phone'), on = pnNarrow() && PN.tab !== 'pad' && !PN.drill && !PN.call; w.classList.toggle('pnlistview', on); w.dataset.pnview = PN.tab;
    let b = $('#pn-lback'); if (pnNarrow() && PN.tab !== 'pad' && PN.drill && !PN.call) { if (!b) { $('#pn-main').insertAdjacentHTML('beforeend', `<button class="flo pnlback" id="pn-lback" type="button" data-pnlistback aria-label="Back">${ic('chevron-left')}<span></span></button>`); b = $('#pn-lback'); } b.querySelector('span').textContent = { recents: 'Recents', contacts: 'Contacts', vm: 'Voicemail' }[PN.tab]; } else b?.remove(); }
  function pnIdle() { const w = $('#pn-body .pncall'); if (!w) return; w.classList.remove('idle'); clearTimeout(pnIdle.t); if (PN.call?.kind === 'video') pnIdle.t = setTimeout(() => w.classList.add('idle'), 3000); }
  function pnClick(e, hit) { const q = s => hit(s);
    if (q('[data-pnblock]')) { const r = PNR.find(x => x.id === PN.sel); lConfirm($('#w-phone'), { title: `Block ${r?.num || 'this number'}?`, body: 'Calls and texts from it go straight to voicemail, and it isn’t told.', action: 'Block', icon: 'shield', onOK: () => pnToast('Blocked', { icon: 'shield' }) }); return true; }
    const qc = q('[data-pnqcall]'); if (qc) { const [kind, who] = qc.dataset.pnqcall.split(':'); PN.pq = ''; if (who.startsWith('#')) { PN.tab = 'pad'; PN.pad = who.slice(1); } else { PN.tab = 'contacts'; PN.person = who; PN.drill = true; } pnStart(kind); return true; }
    const qm = q('[data-pnqmsg]'); if (qm) { const who = qm.dataset.pnqmsg; PN.pq = ''; pnBar(); pnToast(`Opening Messages with ${who.startsWith('#') ? pnFmt(who.slice(1)) : pnName(who).split(' ')[0]}`); return true; }
    if (q('[data-pnlistback]')) { PN.drill = false; pnList(); return true; }
    const tb = q('[data-pntab]'); if (tb) { PN.drill = false; PN.pq = ''; PN.tab = tb.dataset.pntab; if (PN.tab === 'recents') PN.sel = PNR[0].id; if (PN.tab === 'vm') PN.sel = PNVM[0].id; pnAll(); return true; }
    const r = q('[data-pnr]'); if (r) { PN.sel = r.dataset.pnr; PN.drill = true; pnSide(); pnMain(); pnList(); return true; }
    const vm = q('[data-pnvm]'); if (vm) { PN.sel = vm.dataset.pnvm; PN.vmPlay = null; PN.drill = true; pnSide(); pnMain(); pnList(); return true; }
    const pp = q('[data-pnp]'); if (pp) { PN.pq = ''; PN.person = pp.dataset.pnp; if (PN.tab !== 'recents' || !pnNarrow()) PN.tab = 'contacts'; PN.drill = true; pnAll(); return true; }
    const kk = q('[data-pnkey]'); if (kk) { if (PN.call) { pnToast(`Tone ${kk.dataset.pnkey}`); return true; } PN.pad += kk.dataset.pnkey; pnMain(); return true; }
    if (q('[data-pndel]')) { PN.pad = PN.pad.slice(0, -1); pnMain(); return true; }
    const cl = q('[data-pncall]'); if (cl) { pnStart(cl.dataset.pncall); return true; }
    if (q('[data-pnend]')) { clearInterval(PN.call.iv); const t = PN.call.t; PN.call = null; pnAll(); pnToast(`Call ended · ${pnT(t)}`); return true; }
    if (q('[data-pnmute]')) { PN.call.muted = !PN.call.muted; pnMain(); pnIdle(); return true; }
    if (q('[data-pncam]')) { PN.call.camOff = !PN.call.camOff; pnMain(); pnIdle(); return true; }
    if (q('[data-pnshare]')) { PN.call.share = !PN.call.share; pnMain(); pnIdle(); if (PN.call.share) pnToast('Sharing the Launch deck window. Pick another any time'); return true; }
    if (q('[data-pnblur]')) { PN.call.blur = !PN.call.blur; pnMain(); pnIdle(); return true; }
    if (q('[data-pnkp]')) { PN.call.pad = !PN.call.pad; pnMain(); return true; }
    if (q('[data-pnflip]')) { pnToast('Using the front camera'); return true; }
    const au = q('[data-pnaudio]'); if (au) { if ($('#lmenu')) { $('#lmenu').remove(); return true; } const o = PN.call.out || 'buds'; lMenu(au, [['buds', 'headphones', 'Fable Buds'], ['spk', 'speaker', 'This computer’s speakers'], ['usb', 'mic', 'Studio mic and speakers']].map(([id, i, n]) => crMi(`data-pnout="${id}"`, i, n, o === id ? ' on' : '').replace('</span></button>', `</span>${o === id ? ic('check') : ''}</button>`)).join('')); return true; }
    const po = q('[data-pnout]'); if (po) { $('#lmenu')?.remove(); PN.call.out = po.dataset.pnout; pnToast({ buds: 'Audio on Fable Buds', spk: 'Audio on this computer’s speakers', usb: 'Audio on the studio mic and speakers' }[PN.call.out]); return true; }
    if (q('[data-pnup]')) { PN.call.kind = 'video'; pnMain(); pnIdle(); return true; }
    if (q('[data-pnvmplay]')) { const v = PNVM.find(x => x.id === PN.sel); if (PN.vmPlay) { clearInterval(PN.vmPlay.iv); PN.vmPlay = null; pnMain(); return true; } PN.vmPlay = { t: 0 }; pnMain(); PN.vmPlay.iv = setInterval(() => { PN.vmPlay.t += .25; const b = $('#pn-vbar'); if (b) b.style.width = PN.vmPlay.t / v.len * 100 + '%'; if (PN.vmPlay.t >= v.len) { clearInterval(PN.vmPlay.iv); PN.vmPlay = null; pnMain(); } }, 250); return true; }
    const td = q('[data-pntodo]'); if (td) { pnToast(td.dataset.pntodo); return true; }
    if (q('#pn-body .pncall')) { pnIdle(); }
    return false; }
  function renderPhone() { $('#pn-top').innerHTML = `<img src="${A}phone.svg" alt=""><b>Phone</b><span class="chev">${ic('chevron-down')}</span>`; pnAll();
    $('#pn-body').addEventListener('pointermove', () => pnIdle());
    $('#pn-body').addEventListener('pointerdown', e => { const s = e.target.closest('#pn-self'); if (!s) return; const box = s.parentElement.getBoundingClientRect(), r = s.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; s.setPointerCapture(e.pointerId);
      const mv = ev => { const x = Math.max(12, Math.min(box.width - r.width - 12, ev.clientX - box.left - ox)), y = Math.max(12, Math.min(box.height - r.height - 12, ev.clientY - box.top - oy)); s.style.cssText = `left:${x}px;top:${y}px;right:auto;bottom:auto`; };
      const up = () => { s.removeEventListener('pointermove', mv); s.removeEventListener('pointerup', up); const x = parseFloat(s.style.left), y = parseFloat(s.style.top), R = x > box.width / 2, B = y > box.height / 2; PN.call.selfPos = `${R ? 'right:16px' : 'left:16px'};${B ? 'bottom:96px' : 'top:64px'};left:${R ? 'auto' : '16px'};top:${B ? 'auto' : '64px'}`; s.style.cssText = PN.call.selfPos; };
      s.addEventListener('pointermove', mv); s.addEventListener('pointerup', up); }); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-pnq]')) { PN.q = e.target.value; if (PN.q) PN.tab = 'contacts'; pnSide(); const i = $('[data-pnq]'); i.focus({ preventScroll: true }); i.setSelectionRange(i.value.length, i.value.length); } });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'phone' || e.target.closest?.('input')) return; if (PN.tab === 'pad' && !PN.call && /^[0-9*#]$/.test(e.key)) { PN.pad += e.key; pnMain(); } else if (PN.tab === 'pad' && e.key === 'Backspace') { PN.pad = PN.pad.slice(0, -1); pnMain(); } else if (e.key === 'Enter' && PN.tab === 'pad' && PN.pad && !PN.call) pnStart('voice'); });

  /* ══ File picker ═══════════════════════════════════════════════════════════════
     The one picker every app uses, for opening, saving and choosing a folder. It always says who is
     asking and what for, in the title and again as the first thing on its bar. Files that don't fit
     the request stay visible but dimmed, so a folder still looks like itself. Pictures show as pictures. */
  const FPK = { doc: ['file-text', 'Document'], md: ['file-text', 'Markdown'], pdf: ['file-text', 'PDF'], sheet: ['table', 'Spreadsheet'], img: ['image', 'Image'], audio: ['music', 'Audio'], video: ['film', 'Video'], iso: ['disc', 'Disk image'], pkg: ['package', 'App package'], txt: ['file-text', 'Text'], dir: ['folder', 'Folder'] };
  const fpF = (n, k, sz, when, img) => ({ n, k, sz, when, img: img ? PH + img : null });
  const FPFS = {
    home: { n: 'Home', items: [['Desktop', 'desktop'], ['Documents', 'documents'], ['Downloads', 'downloads'], ['Music', 'music'], ['Pictures', 'pictures'], ['Videos', 'videos']].map(([n, id]) => ({ n, k: 'dir', id, when: '' })) },
    desktop: { n: 'Desktop', up: 'home', items: [fpF('Screenshot 21.40.png', 'img', '2.4 MB', 'Today, 21:40', 'life-work-suite.webp'), fpF('Launch deck.pdf', 'pdf', '8.1 MB', 'Yesterday, 18:02')] },
    documents: { n: 'Documents', up: 'home', items: [{ n: 'Launch', k: 'dir', id: 'launch', when: 'Today, 9:12' }, { n: 'Taxes 2026', k: 'dir', id: 'taxes', when: '4 Apr' }, fpF('Launch notes.md', 'md', '12 KB', 'Today, 9:12'), fpF('Lease 2026.pdf', 'pdf', '1.8 MB', '2 Sep'), fpF('Launch budget.xlsx', 'sheet', '88 KB', '12 Aug'), fpF('Wedding toast.docx', 'doc', '34 KB', '30 Jul'), fpF('Reading list.txt', 'txt', '3 KB', '14 Jun')] },
    launch: { n: 'Launch', up: 'documents', items: [fpF('Walkthrough script.md', 'md', '9 KB', 'Today, 9:40'), fpF('Press note.docx', 'doc', '41 KB', 'Yesterday, 16:12'), fpF('Homepage crop.png', 'img', '3.2 MB', 'Monday, 11:05', 'life-hero-home.webp')] },
    taxes: { n: 'Taxes 2026', up: 'documents', items: [fpF('Receipts.xlsx', 'sheet', '210 KB', '4 Apr'), fpF('Return.pdf', 'pdf', '640 KB', '4 Apr')] },
    downloads: { n: 'Downloads', up: 'home', items: [fpF('SunoOS-0.1-nightly.iso', 'iso', '6.2 GB', 'Today, 18:00'), fpF('kiln-2.4.1.flatpakref', 'pkg', '1 KB', 'Today, 14:31'), fpF('Invoice 0923.pdf', 'pdf', '96 KB', 'Today, 10:02'), fpF('Pet Sounds cover.webp', 'img', '412 KB', 'Yesterday, 22:10', 'pet-sounds.webp'), fpF('setup-notes.txt', 'txt', '2 KB', '19 Sep')] },
    music: { n: 'Music', up: 'home', items: [{ n: 'Beach Boys', k: 'dir', id: 'bb', when: '3 Sep' }, { n: 'Demos', k: 'dir', id: 'demos', when: 'Yesterday' }, { n: 'Field recordings', k: 'dir', id: 'field', when: '21 Aug' }, fpF('Melody.m4a', 'audio', '520 KB', 'Sunday, 23:40')] },
    bb: { n: 'Beach Boys', up: 'music', items: [{ n: 'Pet Sounds', k: 'dir', id: 'ps', when: '3 Sep' }] }, ps: { n: 'Pet Sounds', up: 'bb', items: [fpF('01 Wouldn’t It Be Nice.flac', 'audio', '28 MB', '3 Sep'), fpF('08 God Only Knows.flac', 'audio', '31 MB', '3 Sep')] },
    demos: { n: 'Demos', up: 'music', items: [fpF('Lip idea.wav', 'audio', '11 MB', 'Yesterday')] }, field: { n: 'Field recordings', up: 'music', items: [fpF('Rain on the loft.wav', 'audio', '64 MB', '21 Aug')] },
    pictures: { n: 'Pictures', up: 'home', items: [{ n: 'Screenshots', k: 'dir', id: 'shots', when: 'Today' }, fpF('Studio morning.webp', 'img', '1.2 MB', 'Today, 8:30', 'life-hero-studio.webp'), fpF('Writing.webp', 'img', '980 KB', 'Today, 8:31', 'life-hero-writing.webp'), fpF('Terrace.webp', 'img', '1.4 MB', 'Yesterday', 'life-sync-terrace.webp'), fpF('Ari on the street.webp', 'img', '1.1 MB', 'Yesterday', 'life-ari-street.webp'), fpF('The loft.webp', 'img', '1.6 MB', 'Monday', 'life-professionals-loft.webp'), fpF('Focus.webp', 'img', '870 KB', '14 Sep', 'life-suite-bg-darkroom.webp'), fpF('Stage.webp', 'img', '1.0 MB', '14 Sep', 'life-suite-bg-stage.webp'), fpF('Sessions.webp', 'img', '1.3 MB', '2 Sep', 'life-suite-bg-sessions.webp')] },
    shots: { n: 'Screenshots', up: 'pictures', items: [fpF('Screenshot 21.40.png', 'img', '2.4 MB', 'Today, 21:40', 'life-work-suite.webp')] },
    videos: { n: 'Videos', up: 'home', items: [fpF('Launch teaser.mp4', 'video', '84 MB', 'Monday, 19:12')] },
    ssd: { n: 'Suno SSD', items: [{ n: 'Home', k: 'dir', id: 'home', when: '' }] }, archive: { n: 'Archive', items: [{ n: 'Backups', k: 'dir', id: 'home', when: '12 Sep' }, fpF('Photos 2019.tar', 'pkg', '48 GB', '2 Jan 2020')] }
  };
  FPFS.recent = { n: 'Recent', items: [['documents', 2], ['desktop', 0], ['pictures', 1], ['downloads', 2], ['launch', 0], ['downloads', 3], ['documents', 4]].map(([f, i]) => ({ ...FPFS[f].items[i], where: FPFS[f].n })) };
  const FPS = { // who is asking, and for what
    'write-open': { app: 'Write', icon: A + 'documents.svg', ask: 'Open a document', mode: 'open', start: 'recent', filter: 'docs' },
    'photos-add': { app: 'Photos', icon: '../icons/Suno-v4-photos.svg', ask: 'Add photos', mode: 'open', start: 'pictures', filter: 'images' },
    'viewer-open': { app: 'Viewer', icon: A + 'viewer.svg', ask: 'Open an image', mode: 'open', start: 'pictures', filter: 'images' },
    'tide-folder': { app: 'Tide', icon: A + 'music.svg', ask: 'Add a music folder', mode: 'folder', start: 'music' },
    'browser-save': { app: 'Browser', icon: A + 'browser.svg', ask: 'Save download', mode: 'save', start: 'downloads', name: 'Suno launch deck.pdf', fmts: ['PDF'] },
    'write-save': { app: 'Write', icon: A + 'documents.svg', ask: 'Save a copy', mode: 'save', start: 'documents', name: 'Launch notes copy.md', fmts: ['Markdown (.md)', 'Word (.docx)', 'PDF (.pdf)', 'Plain text (.txt)'] }
  };
  const FPFILT = { docs: ['Documents', k => ['doc', 'md', 'pdf', 'txt', 'sheet'].includes(k)], images: ['Images', k => k === 'img'], all: ['All files', () => true] };
  const FP = { sc: 'write-open', at: 'recent', sel: null, view: 'list', q: '', filter: 'docs', name: '', fmt: 0, done: false, pop: null, sort: null };
  const fpS = () => FPS[FP.sc];
  function fpStart(sc) { const s = FPS[sc]; Object.assign(FP, { sc, at: s.start, sel: null, q: '', filter: s.filter || 'all', name: s.name || '', fmt: 0, view: s.filter === 'images' ? 'grid' : 'list' }); fpAll(); }
  const fpOk = it => { const s = fpS(); if (s.mode === 'folder' || s.mode === 'save') return it.k === 'dir'; return it.k === 'dir' || FPFILT[FP.filter][1](it.k); };   // what can be picked here
  const fpSz = z => { const m = String(z || '').match(/([\d.]+)\s*(KB|MB|GB)/); return m ? +m[1] * { KB: 1, MB: 1e3, GB: 1e6 }[m[2]] : -1; };
  const fpSort = l => { const s = FP.sort; if (!s) return l; return [...l].sort((a, b) => (a.k === 'dir') !== (b.k === 'dir') ? (a.k === 'dir' ? -1 : 1) : s.dir * (s.k === 'size' ? fpSz(a.sz) - fpSz(b.sz) : s.k === 'kind' ? String(a.where || FPK[a.k][1]).localeCompare(String(b.where || FPK[b.k][1])) : s.k === 'mod' ? String(a.when).localeCompare(String(b.when)) : a.n.localeCompare(b.n))); };
  function fpItems() { const q = FP.q.trim().toLowerCase(); if (!q) return fpSort(FPFS[FP.at].items);
    const seen = new Set(), out = []; Object.entries(FPFS).forEach(([id, f]) => id !== 'recent' && f.items.forEach(it => { const key = it.n + f.n; if (it.n.toLowerCase().includes(q) && !seen.has(key)) { seen.add(key); out.push({ ...it, where: f.n }); } })); return fpSort(out); }
  function fpCrumbs() { const out = []; let id = FP.at; while (id) { out.unshift(id); id = FPFS[id].up; } return out; }

  function fpSide() { const row = (id, icon, label) => `<button class="si${FP.at === id && !FP.q ? ' on' : ''}" type="button" data-fpgo="${id}">${ic(icon)}<span class="lab">${label}</span></button>`;
    $('#fp-side').innerHTML = `<div class="scr">${row('recent', 'clock', 'Recent')}<div class="sh">Places</div>${row('home', 'house', 'Home')}${row('desktop', 'monitor', 'Desktop')}${row('documents', 'file-text', 'Documents')}${row('downloads', 'download', 'Downloads')}${row('music', 'music', 'Music')}${row('pictures', 'image', 'Pictures')}${row('videos', 'film', 'Videos')}
      <div class="sh">Devices</div>${row('ssd', 'hard-drive', 'Suno SSD')}${row('archive', 'database', 'Archive')}</div>`; }
  function fpMain() { const s = fpS(), items = fpItems(), cr = fpCrumbs(), searching = !!FP.q.trim(), showWhere = searching || FP.at === 'recent';
    const thumb = it => it.img ? `<i class="fpth" style="background-image:url('${it.img}')"></i>` : `<i class="fpth ico${it.k === 'dir' ? ' dir' : ''}">${ic(FPK[it.k][0])}</i>`;
    const attrs = (it, i) => `data-fpitem="${i}" class="${fpOk(it) ? '' : 'no'}${FP.sel === i ? ' on' : ''}" title="${esc(it.n)}${fpOk(it) ? '' : ` · ${s.app} can’t open this`}"`;
    const body = !items.length ? `<p class="fpnone">${searching ? `Nothing called “${esc(FP.q)}”` : 'This folder is empty'}</p>`
      : FP.view === 'grid' ? `<div class="fpgrid">${items.map((it, i) => `<button type="button" ${attrs(it, i)}>${thumb(it)}<span>${esc(it.n)}</span></button>`).join('')}</div>`
      : `<div class="fplist${showWhere ? ' where' : ''}">${lTHead.grid([['name', 'Name'], ['kind', showWhere ? 'Where' : 'Kind'], ['size', 'Size'], ['mod', 'Modified']], FP.sort, 'data-fpsort', 'fphead')}${items.map((it, i) => `<button type="button" ${attrs(it, i)}>${thumb(it)}<b>${esc(it.n)}</b><span>${showWhere ? esc(it.where || '') : FPK[it.k][1]}</span><span>${it.sz || '—'}</span><span>${it.when}</span></button>`).join('')}</div>`;
    $('#fp-body').innerHTML = `<header class="fphd"><div>${fpNarrow() ? `<p class="fpask2"><img src="${s.icon}" alt="">${esc(s.app)} · ${esc(s.ask)}</p>` : ''}<nav class="fpcr">${searching ? '<span>Everywhere</span>' : cr.slice(0, -1).map(id => `<button type="button" data-fpgo="${id}">${FPFS[id].n}</button>${ic('chevron-right')}`).join('')}</nav>
        <h1>${searching ? 'Search' : FPFS[FP.at].n}</h1></div>
        <label class="srch fpq">${ic('search')}<input placeholder="Search" value="${esc(FP.q)}" data-fpq></label>
        ${s.mode !== 'open' ? `<button class="ib" type="button" data-fpnew title="New folder">${ic('folder-plus')}</button>` : ''}${seg([['list', ic('list'), 'List'], ['grid', ic('layout-grid'), 'Grid']], FP.view, 'data-fpview', 'View', 'ico')}</header>
      <div class="fpscroll">${body}</div>`;
    requestAnimationFrame(segs); }
  /* The file picker on a phone: a full screen over the app that asked. Who's asking and for what sits above the place's
     title; the bar is two rows: where you're looking (tap for your places and drives), search and the view; under a
     hairline, Cancel and Open (or Choose, or the name and Save). Picking or cancelling returns to the app. */
  const fpNarrow = () => { const w = $('#w-picker'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };
  function fpBarPhone() { const s = fpS(), items = fpItems(), it = items[FP.sel], X = FP.px || '', bar = $('#fp-bar'); $('#w-picker').classList.add('fpph'); bar.classList.add('phnofit', 'fpphbar');
    const PL = [['recent', 'clock', 'Recent'], ['home', 'house', 'Home'], ['desktop', 'monitor', 'Desktop'], ['documents', 'file-text', 'Documents'], ['downloads', 'download', 'Downloads'], ['music', 'music', 'Music'], ['pictures', 'image', 'Pictures'], ['videos', 'film', 'Videos'], ['ssd', 'hard-drive', 'Suno SSD'], ['archive', 'database', 'Archive']], cur = PL.find(x => x[0] === FP.at) || PL[0];
    const panel = X === 'places' ? `<div class="fexp fmore2">${PL.map(([id, i, n], k) => `${k === 1 ? '<div class="fexh">Places</div>' : k === 8 ? '<div class="fexh">Devices</div>' : ''}<button class="fexr2${FP.at === id ? ' on' : ''}" type="button" data-fpgo="${id}">${ic(i)}<span>${n}</span></button>`).join('')}${s.mode === 'open' ? `<div class="fexh">Show</div><div class="fexs">${Object.entries(FPFILT).map(([k, [n]]) => `<button type="button" class="fsch${FP.filter === k ? ' on' : ''}" data-fpfset="${k}">${n}</button>`).join('')}</div>` : ''}</div>`
      : '';
    bar.classList.toggle('phgrow', !!panel);
    const act = s.mode === 'save' ? `<label class="cfield fpnm">${ic('file-text')}<input value="${esc(FP.name)}" data-fpname spellcheck="false" aria-label="Name"></label></div><div class="fpr2"><button class="bt fill fph" type="button" data-fpcancel>Cancel</button><button class="bt pri fph" type="button" data-fpgo-key>Save</button>`
      : s.mode === 'folder' ? `<button class="bt fill fph" type="button" data-fpcancel>Cancel</button><button class="bt pri fph" type="button" data-fpgo-key ${FP.at === 'recent' && !it ? 'disabled' : ''}>Choose “${esc(it && it.k === 'dir' ? it.n : FPFS[FP.at].n)}”</button>`
      : `<button class="bt fill fph" type="button" data-fpcancel>Cancel</button><button class="bt pri fph" type="button" data-fpgo-key ${it && it.k !== 'dir' && fpOk(it) ? '' : 'disabled'}>${it && it.k !== 'dir' ? `Open “${esc(it.n.length > 16 ? it.n.slice(0, 15) + '…' : it.n)}”` : 'Open'}</button>`;
    if (X === 'search') { setBar(bar, `<div class="fpr1"><label class="srch keep" style="flex:1">${ic('search')}<input data-fpq placeholder="Search everywhere" value="${esc(FP.q)}" aria-label="Search"></label><button class="ib" type="button" data-fppx="search" aria-label="Close search">${ic('x')}</button></div>`); setTimeout(() => $('#fp-bar [data-fpq]')?.focus(), 30); return; }
    setBar(bar, `${panel}<div class="fpr1"><button class="fppl2${X === 'places' ? ' on' : ''}" type="button" data-fppx="places">${ic(cur[1])}<b>${cur[2]}</b>${ic('chevron-down')}</button><span class="sp"></span><button class="ib${X === 'search' || FP.q ? ' on' : ''}" type="button" data-fppx="search" aria-label="Search">${ic('search')}</button><button class="ib" type="button" data-fpview="${FP.view === 'grid' ? 'list' : 'grid'}" aria-label="${FP.view === 'grid' ? 'List' : 'Grid'}">${ic(FP.view === 'grid' ? 'list' : 'layout-grid')}</button></div><div class="fpr2">${act}</div>`);
    if (X === 'search') setTimeout(() => $('#fp-bar [data-fpq]')?.focus(), 30); }
  function fpBar() { if (fpNarrow()) return fpBarPhone(); $('#w-picker').classList.remove('fpph'); $('#fp-bar').classList.remove('phnofit', 'fpphbar', 'phgrow'); const s = fpS(), items = fpItems(), it = items[FP.sel], req = `<span class="fpreq"><img src="${s.icon}" alt="">${s.ask}</span>`; let h;
    if (s.mode === 'save') h = `${req}<label class="fpname"><input value="${esc(FP.name)}" data-fpname spellcheck="false" aria-label="Name"></label>${s.fmts.length > 1 ? `<button class="bt fpchip" type="button" data-fpfmt>${s.fmts[FP.fmt].split(' ')[0]}${ic('chevron-down')}</button>` : ''}<span class="vr"></span><button class="bt" type="button" data-fpcancel>Cancel</button><button class="bt key" type="button" data-fpgo-key>Save</button>`;
    else if (s.mode === 'folder') { const target = it && it.k === 'dir' ? it.n : FPFS[FP.at].n; h = `${req}<span class="vr"></span><button class="bt" type="button" data-fpcancel>Cancel</button><button class="bt key" type="button" data-fpgo-key ${FP.at === 'recent' && !it ? 'disabled' : ''}>Choose “${esc(target)}”</button>`; }
    else h = `${req}<button class="bt fpchip" type="button" data-fpfilter>${FPFILT[FP.filter][0]}${ic('chevron-down')}</button><span class="vr"></span><button class="bt" type="button" data-fpcancel>Cancel</button><button class="bt key" type="button" data-fpgo-key ${it && it.k !== 'dir' && fpOk(it) ? '' : 'disabled'}>Open</button>`;
    setBar($('#fp-bar'), h); }
  function fpAll() { const s = fpS(); $('#fp-top').innerHTML = `<img src="${s.icon}" alt=""><b>${s.app}</b><i class="fpask">${s.ask}</i><button class="chev fpmenu" type="button" aria-label="Try another request">${ic('chevron-down')}</button>`; fpSide(); fpMain(); fpBar(); }
  const fpToast = msg => lToast($('#w-picker'), msg, { icon: /didn’t|Pick a/.test(msg) ? 'info' : 'check' });   // the SunoUI toast
  function fpPop(anchor, html) { $('#fp-pop')?.remove(); const w = $('#w-picker'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop ldrawer" id="fp-pop">${html}</div>`); const p = $('#fp-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left + r.width / 2 - p.offsetWidth / 2)) + 'px';
    if (r.top - wr.top > wr.height / 2) p.style.bottom = (wr.bottom - r.top + 8) + 'px'; else p.style.top = (r.bottom - wr.top + 6) + 'px'; }
  function fpOpen(it) { if (it.k === 'dir') { FP.at = it.id; FP.sel = null; FP.q = ''; fpAll(); return; } if (!fpOk(it)) return; fpDone(`${fpS().app} opened “${it.n}”`); }
  function fpDone(msg) { if ($('#w-picker').classList.contains('phone') && window.lumaPhone) { lumaPhone.back(); setTimeout(() => { const f = [...document.querySelectorAll('.win.phone')].find(w => !w.hidden && w.id !== 'w-picker'); if (f) lToast(f, msg); }, 350); FP.sel = null; return; } fpToast(msg); FP.sel = null; fpBar(); }
  function fpKey() { const s = fpS(), it = fpItems()[FP.sel];
    if (s.mode === 'save') { const dir = it && it.k === 'dir' ? FPFS[it.id] : FPFS[FP.at]; if (FP.at === 'recent' && !(it && it.k === 'dir')) { fpToast('Pick a folder to save in'); return; }
      const clash = dir.items.some(x => x.n === FP.name), ok = () => fpDone(`Saved “${FP.name}” to ${dir.n}`);
      if (clash) lConfirm($('#w-picker'), { title: `Replace “${FP.name}”?`, body: `${dir.n} already has a file with this name. Saving replaces it.`, action: 'Replace', icon: 'replace', onOK: ok }); else ok(); return; }
    if (s.mode === 'folder') { fpDone(`Tide is adding “${it && it.k === 'dir' ? it.n : FPFS[FP.at].n}”`); return; }
    if (it) fpOpen(it); }
  function fpClick(e, hit) { const q = s => hit(s);
    if (fpNarrow()) { const i0 = q('#fp-body [data-fpitem]'); if (i0) { const it = fpItems()[+i0.dataset.fpitem]; if (it && it.k === 'dir') { fpOpen(it); return true; } } const px = q('[data-fppx]'); if (px) { const k = px.dataset.fppx; FP.px = FP.px === k ? '' : k; fpBar(); return true; } if (q('#fp-bar [data-fpgo]') || q('#fp-bar [data-fpfset]')) { FP.px = ''; setTimeout(fpBar); } }
    if (q('button[disabled]')) return true;
    if (q('.fpmenu')) return true;   // the menu opened on pointer-down; its own click must not close it
    if (!q('#fp-pop')) $('#fp-pop')?.remove();
    const g = q('[data-fpgo]'); if (g) { FP.at = g.dataset.fpgo; FP.sel = null; FP.q = ''; fpAll(); return true; }
    const it = q('[data-fpitem]'); if (it) { const i = +it.dataset.fpitem, x = fpItems()[i], now = Date.now();
      if (FP.sel === i && now - (fpClick.t || 0) < 400) { fpOpen(x); return true; } fpClick.t = now;
      if (!fpOk(x) && x.k !== 'dir') return true; FP.sel = i; if (fpS().mode === 'save' && x.k !== 'dir') FP.name = x.n; fpMain(); fpBar(); return true; }
    const v = q('[data-fpview]'); if (v) { FP.view = v.dataset.fpview; fpMain(); return true; }
    const so = q('[data-fpsort]'); if (so) { const k = so.dataset.fpsort; FP.sort = { k, dir: FP.sort?.k === k ? -FP.sort.dir : 1 }; FP.sel = null; fpMain(); fpBar(); $(`#fp-body [data-fpsort="${k}"]`)?.focus(); return true; }
    if (q('[data-fpfilter]')) { fpPop(q('[data-fpfilter]'), '<h6>Show</h6>' + Object.entries(FPFILT).filter(([k]) => k === 'all' || k === (fpS().filter || 'all')).map(([k, [n]]) => crMi(`data-fpfset="${k}"`, '', n, FP.filter === k ? ' on' : '')).join('')); return true; }
    const fs = q('[data-fpfset]'); if (fs) { FP.filter = fs.dataset.fpfset; FP.sel = null; $('#fp-pop')?.remove(); fpMain(); fpBar(); return true; }
    if (q('[data-fpfmt]')) { fpPop(q('[data-fpfmt]'), '<h6>Format</h6>' + fpS().fmts.map((f, i) => crMi(`data-fpfmtset="${i}"`, '', f, FP.fmt === i ? ' on' : '')).join('')); return true; }
    const ff = q('[data-fpfmtset]'); if (ff) { FP.fmt = +ff.dataset.fpfmtset; const ext = fpS().fmts[FP.fmt].match(/\((\.\w+)\)/)?.[1]; if (ext) FP.name = FP.name.replace(/\.\w+$/, '') + ext; $('#fp-pop')?.remove(); fpBar(); return true; }
    if (q('[data-fpnew]')) { const f = FPFS[FP.at]; if (FP.at === 'recent') return true; const id = 'new' + Date.now(); FPFS[id] = { n: 'New folder', up: FP.at, items: [] }; f.items.unshift({ n: 'New folder', k: 'dir', id, when: 'Just now' }); FP.sel = 0; fpMain(); fpBar(); return true; }
    if (q('[data-fpcancel]')) { fpDone(`${fpS().app} didn’t get a file`); return true; }
    if (q('[data-fpgo-key]')) { fpKey(); return true; }
    const sc = q('[data-fpsc]'); if (sc) { $('#fp-pop')?.remove(); fpStart(sc.dataset.fpsc); return true; }
    if (!q('.fpgrid button, .fplist button, .fpbar, #fp-bar') && q('.fpscroll')) { FP.sel = null; fpMain(); fpBar(); return true; }
    return false; }
  function renderPicker() { fpStart(FP.sc);
    $('#w-picker').addEventListener('pointerdown', e => { const m = e.target.closest('.fpmenu'); if (!m) return; e.stopPropagation(); e.preventDefault(); if ($('#fp-pop')) { $('#fp-pop').remove(); return; }
      fpPop(m, '<h6>Try a request</h6>' + Object.entries(FPS).map(([k, s]) => crMi(`data-fpsc="${k}"`, '', `${s.app} · ${s.ask}`, FP.sc === k ? ' on' : '')).join('')); }, true);
    // Save names select without the extension, so typing replaces just the name
    $('#w-picker').addEventListener('focusin', e => { if (e.target.matches('[data-fpname]')) { const v = e.target.value, dot = v.lastIndexOf('.'); setTimeout(() => e.target.setSelectionRange(0, dot > 0 ? dot : v.length), 0); } }); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-fpq]')) { FP.q = e.target.value; FP.sel = null; fpSide(); fpMain(); fpBar(); const i = $('[data-fpq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if (e.target.matches?.('[data-fpname]')) FP.name = e.target.value; });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'picker') return; const items = fpItems();
    if (e.key === 'Escape') { $('[data-fpcancel]')?.click(); return; } if (e.key === 'Enter') { e.preventDefault(); fpKey(); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.target.closest?.('[data-fpname]')) { e.preventDefault(); const n = items.length; FP.sel = FP.sel == null ? 0 : (FP.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; fpMain(); fpBar(); } });

  /* ══ Modals ══════════════════════════════════════════════════════════════════
     How Suno asks. Small, undoable decisions happen in the floating bar, in place. Real decisions come as a
     sheet that drops from the asking window's title bar and dims only that window, so you can see who is
     asking and everything else stays usable. Only the system itself interrupts the whole screen.
     Every sheet: a title that is the question, one line of fact, the destructive choice set apart on the
     left, then Cancel and the key on the right. Esc cancels, Return presses the key. */
  const MDK = {
    save: { t: 'Save changes to “Launch budget”?', p: 'Edits from the last 4 minutes aren’t saved.', left: ['Don’t save', 'Closed without saving'], key: ['Save', 'Saved'], cancel: 1 },
    delete: { t: 'Delete “Launch notes.md”?', p: 'It moves to Trash. You can put it back for 30 days.', key: ['Delete', 'Moved to Trash', 'danger'], cancel: 1 },
    purge: { t: 'Delete 3 items for good?', p: 'They skip Trash and can’t be recovered.', key: ['Delete for good', 'Deleted', 'danger'], cancel: 1 },
    rename: { t: 'Rename', field: 'Launch notes.md', key: ['Rename', 'Renamed'], cancel: 1 },
    replace: { t: 'Replace “Suno launch deck.pdf”?', p: 'Downloads already has a file with this name, changed today at 10:02.', left: ['Keep both', 'Saved as “Suno launch deck 2.pdf”'], key: ['Replace', 'Replaced'], cancel: 1 },
    report: { t: 'Report @drift.bot?', p: 'Suno sees the last 5 messages from this account. They don’t see that you reported them.', choices: ['Spam', 'Pretending to be someone', 'Harassment', 'Something else'], key: ['Report', 'Reported. Thanks', 'danger'], cancel: 1, extra: ['Also block @drift.bot', true] },
