/* Suno take seventy-three: every app, the desktop view and the phone view (loaded by Suno-next-73.html). */
(async () => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem('luma69-' + k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('luma67-' + k, v); } catch (e) {} } };
  const body = document.body, desk = $('#desk');
  const PH = '../social-suno/photos/', WP = '../wallpapers/', A = '../icons/Suno-v4-', FAV = 'assets/Suno-favicon.svg';

  const ICONS = [/* Discord */ 'messages-square', 'megaphone', 'hash', 'smile-plus', 'headphone-off', 'circle-plus', 'compass', 'audio-lines', 'mic-off', 'phone-off', 'monitor-up', 'video-off', 'user-plus', 'bell-dot', 'list-tree', 'paperclip', 'image', 'log-out', 'check-check', 'copy', 'download', 'chevron-right', 'chevron-left', 'chevron-down', 'smile', 'calendar-days', 'headphones', 'x', 'search', 'pin', 'settings', 'link',
    'house', 'clapperboard', 'list-video', 'history', 'clock', 'thumbs-up', 'thumbs-down', 'arrow-down-to-line', 'list-plus', 'badge-check', 'ellipsis', 'cast', 'bookmark', 'message-circle', 'send', 'rotate-ccw', 'rotate-cw', 'volume-x', 'captions', 'picture-in-picture-2', 'minimize-2', 'menu', 'bell-ring', 'bell-off', 'user-minus', 'pin', 'shuffle', 'scissors', 'circle-x', 'flag', 'activity', 'app-window', 'arrow-down', 'arrow-right', 'arrow-up', 'badge-check', 'bell', 'bell-ring', 'blocks', 'book-open', 'bookmark', 'bot', 'calendar', 'camera', 'chart-line', 'check', 'check-check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'chevrons-up-down', 'circle-alert', 'circle-check', 'circle-dot', 'circle-play', 'clock', 'cloud', 'code', 'compass', 'copy', 'cpu', 'database', 'dollar-sign', 'download', 'droplet', 'ellipsis', 'eye', 'file', 'file-text', 'fingerprint', 'flag', 'folder', 'folder-open', 'gamepad-2', 'gauge', 'gift', 'git-branch', 'git-merge', 'globe', 'hand', 'hard-drive', 'hash', 'history', 'hourglass', 'house', 'image', 'info', 'key-round', 'laptop', 'layers', 'layout-grid', 'leaf', 'link', 'list', 'list-checks', 'lock', 'log-in', 'mail', 'map-pin', 'maximize-2', 'menu', 'message-circle', 'message-square', 'mic', 'minimize-2', 'minus', 'monitor', 'mouse-pointer-2', 'mouse-pointer-click', 'notebook-pen', 'package', 'palette', 'panel-right', 'paperclip', 'pause', 'pen-line', 'pencil', 'play', 'plus', 'power', 'qr-code', 'radio', 'receipt', 'refresh-ccw', 'rotate-ccw', 'route', 'scan-eye', 'search', 'send', 'server', 'settings-2', 'shield', 'shield-check', 'sliders-horizontal', 'smartphone', 'sparkles', 'square', 'square-arrow-out-up-right', 'star', 'sun', 'tag', 'terminal', 'timer', 'trash-2', 'triangle-alert', 'undo-2', 'user', 'user-plus', 'users', 'wallet', 'wand-sparkles', 'wifi', 'wifi-off', 'x', 'zap',
    'volume-x', 'bring-to-front', 'circle-x', 'scaling', 'message-square-plus', 'heading', 'calendar-range', 'droplet', 'calendar-days', 'refresh-ccw', 'eraser', 'octagon-x', 'corner-down-left', 'square-function', 'calculator', 'mail-check', 'wallpaper', 'bell', 'bell-off', 'square-pen', 'send', 'pin', 'list-ordered', 'bold', 'italic', 'strikethrough', 'download', 'asterisk', 'hash', 'delete', 'grid-3x3', 'history', 'users', 'voicemail', 'phone', 'video', 'message-square', 'list-filter', 'user-plus', 'user', 'scan', 'camera', 'star', 'list-plus', 'merge', 'shield', 'message-square', 'mail', 'link', 'radio-tower', 'file-archive', 'app-window', 'pencil', 'arrow-up', 'arrow-down', 'folder-input', 'folder-plus', 'circle-check', 'check', 'disc-3', 'mic-vocal', 'volume-1', 'list-music', 'text-cursor-input', 'circle-dot', 'paintbrush', 'pilcrow', 'replace', 'scan-eye', 'text-quote', 'between-horizontal-end', 'between-vertical-end', 'captions', 'highlighter', 'list-checks', 'align-left', 'align-center', 'align-right', 'align-justify', 'indent-increase', 'indent-decrease', 'panel-left', 'panel-right', 'reply', 'share', 'ellipsis', 'image', 'trash-2', 'file-text', 'chevron-left', 'chevron-right', 'chevron-down', 'chevron-up', 'search', 'layout-grid', 'list', 'folder', 'upload', 'x', 'minus', 'maximize-2', 'clock', 'house', 'file-text', 'download', 'image', 'hard-drive',
    'heart', 'users', 'map-pin', 'star', 'grid-2x2', 'trash-2', 'play', 'pause', 'wifi', 'battery-medium', 'bell', 'plus', 'rotate-cw', 'shield-check', 'volume-2', 'skip-back', 'skip-forward', 'repeat', 'music-2',
    'headphones', 'monitor', 'layers', 'bold', 'italic', 'underline', 'strikethrough', 'link', 'list-ordered', 'undo', 'redo', 'message-square', 'eye', 'table', 'check', 'tag', 'pencil', 'chevrons-up-down', 'ellipsis', 'panel-left', 'lock', 'phone', 'video', 'reply', 'forward', 'mic', 'arrow-up', 'check-check', 'pin', 'map-pin', 'copy', 'message-square', 'users', 'bell', 'type', 'strikethrough', 'list-ordered', 'bold', 'italic', 'link', 'folder', 'download', 'file-text', 'folder-plus', 'layers', 'mail', 'camera', 'shield', 'star', 'list', 'image', 'terminal', 'calendar', 'map-pin', 'headphones', 'music-2', 'wifi', 'folder', 'users', 'star', 'layout-grid', 'download', 'shield-check', 'arrow-up', 'arrow-down', 'sun', 'paperclip', 'square-pen', 'reply-all', 'archive', 'send-horizontal', 'inbox', 'printer', 'cpu', 'book-open', 'bookmark', 'library-big', 'minimize-2', 'mouse-pointer-2', 'square', 'circle', 'arrow-up-right', 'droplets', 'eye-off', 'zoom-in', 'zoom-out', 'pipette', 'crop', 'rotate-ccw', 'arrow-left-right', 'wand-sparkles', 'circle-help', 'columns-2', 'notebook-pen', 'sunrise', 'receipt', 'waves', 'smartphone', 'triangle-alert', 'globe', 'flag', 'scissors', 'skip-forward', 'music', 'user', 'repeat', 'check-check', 'database', 'gauge', 'settings-2', 'arrow-left-right', 'check-check', 'timer', 'grid-2x2', 'smartphone', 'camera', 'video', 'sun', 'arrow-up', 'arrow-down', 'phone', 'star', 'upload', 'volume-2', 'minus', 'map-pin', 'phone', 'video', 'headphones', 'grid-2x2', 'message-square', 'users', 'lock', 'triangle-alert', 'play', 'pause', 'x', 'film', 'table', 'folder-plus', 'clock', 'house', 'monitor', 'music', 'database', 'list', 'cpu', 'mail', 'moon', 'paperclip', 'arrow-up', 'square-pen', 'message-circle', 'house', 'copy', 'download', 'ellipsis', 'mouse-pointer-2', 'square', 'circle', 'minus', 'type', 'layers', 'panel-left', 'eye', 'eye-off', 'upload', 'plus', 'ellipsis', 'message-circle', 'image', 'chevron-right', 'calendar', 'tag', 'percent', 'bold', 'italic', 'table', 'bookmark', 'x', 'notebook-pen', 'play', 'chevron-left', 'eye', 'arrow-up', 'mic', 'play', 'pause', 'star', 'user', 'rotate-ccw', 'download', 'calendar', 'bookmark', 'pencil', 'upload', 'columns-3', 'zoom-in', 'zoom-out', 'scissors', 'film', 'aperture', 'app-window', 'audio-lines', 'bandage', 'bar-chart-3', 'bike', 'blend', 'book', 'building', 'car', 'chart-column', 'cloud', 'coffee', 'cog', 'compass', 'component', 'corner-up-left', 'corner-up-right', 'delete', 'disc', 'dollar-sign', 'drum', 'eject', 'gallery-vertical', 'guitar', 'hand', 'hash', 'highlighter', 'history', 'info', 'key', 'key-round', 'layout-template', 'library', 'lock-open', 'magnet', 'memory-stick', 'menu', 'metronome', 'mic-off', 'monitor-up', 'navigation', 'package', 'palette', 'pen-tool', 'phone-incoming', 'phone-missed', 'phone-off', 'phone-outgoing', 'piano', 'power', 'rectangle-horizontal', 'refresh-cw', 'scan-text', 'shield-off', 'shuffle', 'sigma', 'signature', 'sliders-vertical', 'sparkles', 'split', 'square-check', 'square-dashed', 'step-back', 'step-forward', 'text-align-center', 'text-align-end', 'text-align-start', 'undo-2', 'usb', 'user-plus', 'utensils', 'video-off', 'voicemail', 'wallet', 'wrench', 'zap', 'zap-off', 'tree-pine', 'at-sign', 'badge-check', 'bell-off', 'briefcase', 'cake', 'git-branch', 'hourglass', 'list-checks', 'pen-line', 'rows-2', 'scan', 'send', 'smile', 'sparkle', 'activity', 'align-center', 'align-center-horizontal', 'align-center-vertical', 'align-end-horizontal', 'align-end-vertical', 'align-left', 'align-right', 'align-start-horizontal', 'align-start-vertical', 'code', 'footprints', 'frame', 'train-front', 'bluetooth', 'grip-vertical', 'server', 'square-stack', 'keyboard', 'ethernet-port', 'share-2', 'accessibility', 'panel-bottom', 'mouse', 'languages', 'wifi-high', 'wifi-low', 'fingerprint', 'sun-moon', 'settings', 'layout-dashboard', 'radar', 'link-2', 'folder-input', 'file-archive', 'qr-code', 'folder-down', 'sticky-note', 'clipboard', 'leaf', 'wind', 'chart-pie', 'credit-card', 'watch', 'log-out', 'flip-horizontal-2', 'sliders-horizontal', 'map', 'satellite', 'quote', 'share', 'book-open-text', 'grid-3x3', 'speaker', 'folder-open', 'copy-plus', 'clapperboard', 'gamepad-2', 'vibrate', 'alarm-clock', 'sunset', 'umbrella', 'square-arrow-out-up-right', 'list-filter', 'arrow-up-down'];
  const SVG = {};
  /* every icon in one request (icons/_bundle.json, from icon-bundle.py); anything not in it is fetched on its own */
  let IB = {}; try { IB = await (await fetch('../icons/_bundle.json', { cache: 'force-cache' })).json(); } catch (e) {} window.__iconBundle = IB;
  await Promise.all(ICONS.map(async n => { try { SVG[n] = (IB[n] || await (await fetch('../icons/' + n + '.svg')).text()).replace(/<!--[\s\S]*?-->/g, '')
    .replace(/stroke-width="[\d.]+"/, 'stroke-width="1.6"').replace(/ width="24"/, '').replace(/ height="24"/, '').replace('<svg', '<svg class="i" aria-hidden="true"'); } catch (e) { SVG[n] = ''; } }));
  const mk = p => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ic = n => SVG[n] || '';
  $$('[data-icon]').forEach(el => el.innerHTML = ic(el.dataset.icon));

  /* ── Shared pieces ─────────────────────────────────────────────────────── */
  const meta = parts => parts.filter(Boolean).map((p, i) => (i ? '<i class="d"></i>' : '') + `<span>${p}</span>`).join('');
  const WCTL = `<div class="wctl"><button type="button" data-w="min" aria-label="Minimize">${ic('minus')}</button><button type="button" data-w="max" aria-label="Zoom">${ic('maximize-2')}</button><button type="button" data-w="close" aria-label="Close">${ic('x')}</button></div>`;
  $$('.win').forEach(w => w.insertAdjacentHTML('beforeend', WCTL));
  const NAVBTN = `<button class="ib navbtn" type="button" data-navtoggle aria-label="Places">${SVG.menu}</button>`;
  const seg = (items, cur, attr, label, cls = '') => `<div class="seg ${cls}" role="group" aria-label="${label}"><i class="ind"></i>${items.map(([k, n, t]) => `<button type="button" class="${cur === k ? 'on' : ''}" ${attr}="${k}"${t ? ` aria-label="${t}" title="${t}"` : ''}>${n}</button>`).join('')}</div>`;
  function placeInd(s) { const on = s.querySelector('button.on'), ind = s.querySelector('.ind'); if (!on || !ind) return; ind.style.left = on.offsetLeft + 'px'; ind.style.width = on.offsetWidth + 'px'; }
  const segs = () => $$('.seg').forEach(placeInd);
  const ri = (key, attr, label, icon, on, extra = '') => `<button class="ri${on ? ' on' : ''}" type="button" ${attr}="${key}" title="${esc(label)}"><span class="ico">${ic(icon)}</span><span class="lab">${esc(label)}</span>${extra}</button>`;
  const setBar = (el, html) => { const sig = html.length + html.slice(0, 80); el.innerHTML = html; if (el.dataset.sig && el.dataset.sig !== sig) { el.classList.remove('morph'); void el.offsetWidth; el.classList.add('morph'); } el.dataset.sig = sig; requestAnimationFrame(segs); };
  const hueCache = {};
  function sampleHue(src, cb) {
    if (hueCache[src] != null) return cb(hueCache[src]);
    const im = new Image(); im.src = src; im.onload = () => { try {
      const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 32, 32);
      const d = x.getImageData(0, 0, 32, 32).data; let sx = 0, sy = 0, ws = 0;
      for (let i = 0; i < d.length; i += 4) { const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) continue;
        const dl = mx - mn, l = (mx + mn) / 2, s2 = dl / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h = (h * 60 + 360) % 360;
        const w = s2 * s2 * (1 - Math.abs(l - .5)); sx += Math.cos(h * Math.PI / 180) * w; sy += Math.sin(h * Math.PI / 180) * w; ws += w; }
      if (ws) { hueCache[src] = Math.round(((Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360 + 20) % 360); cb(hueCache[src]); }
    } catch (e) {} };
  }

  /* ══ Filer ═════════════════════════════════════════════════════════════ */
  const FOLDER = `<svg class="folder" viewBox="0 0 80 64" aria-hidden="true"><path d="M4 6a4 4 0 0 1 4-4h20l6 6h38a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="var(--folder-2)"/>
    <rect x="2" y="15" width="76" height="47" rx="6" fill="var(--folder)"/><rect x="2" y="15" width="76" height="47" rx="6" fill="url(#fgr)"/><path d="M8 16.5h64" stroke="rgba(255,255,255,.45)" stroke-width="1" stroke-linecap="round"/></svg>`;
  body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="fgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.22)"/><stop offset="1" stop-color="rgba(0,0,0,.1)"/></linearGradient></defs></svg>`);
  const KIND = { folder: 'Folder', md: 'Markdown', pdf: 'PDF document', img: 'Image', deck: 'Stage presentation', sheet: 'Grid spreadsheet', doc: 'Write document', video: 'Video', audio: 'Voice memo', iso: 'Disk image', pkg: 'App to install' };
  const APPOF = { deck: 'presentations', sheet: 'spreadsheets', doc: 'documents', md: 'documents', audio: 'memo' };
  const FILES = [
    { n: 'Press kit', k: 'folder', size: '12 items', mod: 'Today, 9:40 AM' }, { n: 'Screens', k: 'folder', size: '48 items', mod: 'Yesterday' }, { n: 'Website', k: 'folder', size: '31 items', mod: 'Sep 19' }, { n: 'Fonts', k: 'folder', size: '6 items', mod: 'Sep 2' },
    { n: 'hero-writing.webp', k: 'img', src: PH + 'life-hero-writing.webp', size: '412 KB', mod: 'Today, 10:04 AM', dim: '2000 × 1125', tags: ['design'] },
    { n: 'field-desk.webp', k: 'img', src: PH + 'life-footer.webp', size: '388 KB', mod: 'Today, 10:02 AM', dim: '1672 × 941' },
    { n: 'ari-demo.mov', k: 'video', src: PH + 'life-work-suite.webp', len: '2:14', size: '1.2 GB', mod: 'Sep 16', dim: '3840 × 2160' },
    { n: 'launch-deck.stage', k: 'deck', ext: 'STAGE', size: '18.4 MB', mod: 'Sep 20', tags: ['launch'] }, { n: 'budget-q4.grid', k: 'sheet', ext: 'GRID', size: '96 KB', mod: 'Sep 18', tags: ['personal'] },
    { n: 'press-release.write', k: 'doc', ext: 'WRITE', size: '48 KB', mod: 'Sep 17', tags: ['launch'] }, { n: 'launch-plan.md', k: 'md', ext: 'MD', size: '14 KB', mod: 'Today, 9:12 AM', tags: ['launch'] },
    { n: 'why-letter.pdf', k: 'pdf', ext: 'PDF', size: '2.1 MB', mod: 'Yesterday' }, { n: 'terrace.webp', k: 'img', src: PH + 'life-sync-terrace.webp', size: '356 KB', mod: 'Yesterday', dim: '1800 × 1013', tags: ['design'] },
    { n: 'standup.ogg', k: 'audio', ext: 'OGG', size: '3.4 MB', mod: 'Sep 15' }];
  const TAGS = { launch: ['Launch', 45], design: ['Design', 255], personal: ['Personal', 150] };
  const PLACES = [['recent', 'Recent', 'clock'], ['home', 'Home', 'house'], ['documents', 'Documents', 'file-text'], ['downloads', 'Downloads', 'download'], ['pictures', 'Pictures', 'image'], ['projects', 'Projects', 'folder']];
  const F = { sort: { k: 'name', dir: 1 }, root: 'Home', path: ['Projects', 'Launch'], view: 'grid', sel: null, q: '', scope: 'here', info: false };
  // The column view walks this: Home, then a folder, then its contents, then the thing you picked
  const FTREE = { Home: [['Desktop', 'folder'], ['Documents', 'folder'], ['Downloads', 'folder'], ['Music', 'folder'], ['Pictures', 'folder'], ['Projects', 'folder']],
    Projects: [['Archive 2025', 'folder'], ['Launch', 'folder'], ['Personal site', 'folder'], ['Taxes 2026', 'folder']], Documents: [['Letters', 'folder'], ['Lease 2026.pdf', 'pdf'], ['Reading list.md', 'md']],
    Pictures: [['Screenshots', 'folder'], ['Terrace.webp', 'img'], ['Studio morning.webp', 'img']], Downloads: [['SunoOS-0.1-nightly.iso', 'iso'], ['kiln-2.4.1.flatpakref', 'pkg'], ['Invoice 0923.pdf', 'pdf']],
    Desktop: [['Screenshot 21.40.png', 'img']], Music: [['Pet Sounds', 'folder'], ['Demos', 'folder']], 'Personal site': [['index.html', 'md'], ['styles.css', 'md']], 'Archive 2025': [['Old deck.stage', 'deck']], 'Taxes 2026': [['Return.pdf', 'pdf'], ['Receipts.grid', 'sheet']],
    'Press kit': [['logo.svg', 'img'], ['press-photo-1.webp', 'img'], ['boilerplate.md', 'md']], Screens: [['filer.webp', 'img'], ['photos.webp', 'img']], Website: [['hero.webp', 'img'], ['copy.md', 'md']], Fonts: [['Figtree.ttf', 'md'], ['Instrument Serif.otf', 'md']] };
  FTREE['Fable SSD'] = [['Home', 'folder'], ['Suno', 'folder']]; FTREE.Suno = [['Apps', 'folder'], ['Wallpapers', 'folder']]; FTREE.Archive = [['Archive 2025', 'folder'], ['Photo backups', 'folder']];
  /* Where you are: a root (Home, Recent or a drive) and the folders below it. Every folder's contents come from fDir, so the title, its count,
     the search field and the columns all name the same place (audit #5, #6) */
  const FROOT = { recent: 'Recent', ssd: 'Fable SSD', hd: 'Archive' }, FPLACE = { documents: 'Documents', downloads: 'Downloads', pictures: 'Pictures', projects: 'Projects' };
  const FDIRS = { Launch: FILES }, FSZ = { md: '14 KB', pdf: '1.8 MB', img: '2.4 MB', deck: '12.1 MB', sheet: '64 KB', iso: '3.2 GB', pkg: '2 KB', doc: '40 KB' }, FPICS = ['life-hero-studio', 'life-footer', 'life-sync-terrace', 'life-work-suite'];
  function fDir(n) { if (FDIRS[n]) return FDIRS[n]; if (n === 'Recent') return FDIRS[n] = FILES.filter(x => x.k !== 'folder' && /Today|Yesterday/.test(x.mod));
    return FDIRS[n] = (FTREE[n] || []).map(([m, k], i) => ({ n: m, k, ext: k === 'pkg' ? 'PKG' : m.includes('.') ? m.split('.').pop().toUpperCase().slice(0, 4) : '', ...(k === 'img' && !/\.svg$/.test(m) ? { src: PH + FPICS[i % 4] + '.webp' } : {}),
      size: k === 'folder' ? `${(m === 'Launch' ? FILES : FTREE[m] || []).length} items` : FSZ[k] || '24 KB', mod: ['Sep 21', 'Sep 18', 'Sep 12', 'Aug 30', 'Aug 14', 'Jul 2'][i % 6] })); }
  const fCur = () => F.path.at(-1) || F.root, fHere = () => fDir(fCur()), fSelFile = () => F.sel ? fHere().find(x => x.n === F.sel) : null, fKind = k => k === 'pkg' ? 'app' : k;
  /* Back and Forward are history, as in any file manager: every move to another folder is remembered; Back with no history goes up a level */
  const fLoc = () => ({ root: F.root, path: F.path.slice() });
  const fGo = (root, path, sel = null, hist) => { if (!hist && (F.root !== root || String(F.path) !== String(path))) { (F.back = F.back || []).push(fLoc()); F.fwd = []; }
    F.root = root; F.path = path; F.sel = sel; F.q = ''; F.scope = 'here'; };
  function fHist(dir) { const from = dir < 0 ? F.back : F.fwd, to = dir < 0 ? 'fwd' : 'back'; if (!from?.length) { if (dir < 0 && F.path.length) fGo(F.root, F.path.slice(0, -1)); return; }
    (F[to] = F[to] || []).push(fLoc()); const l = from.pop(); fGo(l.root, l.path, null, true); }
  document.addEventListener('keydown', e => { if (front()?.id !== 'w-filer' || !e.altKey || e.target.closest?.('input, textarea, [contenteditable="true"]') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return; e.preventDefault(); fHist(e.key === 'ArrowLeft' ? -1 : 1); renderFiler(); });
  const art = f => f.src ? `<span class="shot"><img src="${f.src}" alt="" loading="lazy" draggable="false">${f.k === 'video' ? `<span class="play">${ic('play')}</span><span class="len">${f.len}</span>` : ''}</span>`
    : f.k === 'folder' ? FOLDER : `<span class="paper-ic">${APPOF[f.k] ? `<img src="${A}${APPOF[f.k]}.svg" alt="">` : '<span class="lines"><i></i><i></i><i></i><i></i></span>'}<span class="ext">${f.ext}</span></span>`;
  const mini = f => f.src ? `<img src="${f.src}" alt="">` : f.k === 'folder' ? FOLDER : APPOF[f.k] ? `<img src="${A}${APPOF[f.k]}.svg" alt="">` : ic('file-text');
  const fRows = () => fHere().filter(f => !F.q || f.n.toLowerCase().includes(F.q.toLowerCase()));
  /* Search gives results, not a filtered folder: where each one lives, the match highlighted, a line of text when the words are inside */
  const FSNIP = { 'launch-plan.md': 'Freeze strings on the 10th. Launch day is October 14: film at 9, download at 10, press all day.', 'press-release.write': 'SunoOS 0.1 launches October 14 as a free download for any PC.',
    'why-letter.pdf': 'Why we built Suno: a computer that feels calm again.', 'boilerplate.md': 'Suno is a desktop operating system. It launches October 14.', 'copy.md': 'Your computer, calm again. Launch film and download on the 14th.' };
  function fIndex() { const out = [], walk = (dir, path) => fDir(dir).forEach(x => { out.push({ ...x, p: path, where: ['Home', ...path].join(' › ') }); if (x.k === 'folder') walk(x.n, [...path, x.n]); }); walk('Home', []); return out; }
  function fSearch() { const q = F.q.trim().toLowerCase(), m = x => x.n.toLowerCase().includes(q) || (FSNIP[x.n] || '').toLowerCase().includes(q), all = fIndex().filter(m), home = F.root === 'Home';
    all.forEach(x => { x.here = home ? F.path.every((d, i) => x.p[i] === d) : fHere().some(y => y.n === x.n); x.direct = x.here && (!home || x.p.length === F.path.length); });
    return { q, here: all.filter(x => x.here), away: all.filter(x => !x.here) }; }
  function filerResults() { const { q, here, away } = fSearch();
    const hl = t => { const i = t.toLowerCase().indexOf(q); return i < 0 ? esc(t) : `${esc(t.slice(0, i))}<mark>${esc(t.slice(i, i + q.length))}</mark>${esc(t.slice(i + q.length))}`; };
    const snip = x => { const t = FSNIP[x.n]; if (!t || !t.toLowerCase().includes(q)) return ''; const i = t.toLowerCase().indexOf(q), a = Math.max(0, i - 30); return `<em>${a ? '…' : ''}${hl(t.slice(a))}</em>`; };
    const icon = mini, cur = esc(fCur());
    const row = x => `<button type="button" class="fres${x.direct && x.n === F.sel ? ' on' : ''}" ${x.direct ? `data-file="${esc(x.n)}"` : `data-fgo="${esc(x.p.join('/'))}" data-fname="${esc(x.n)}"`}><span class="mini">${icon(x)}</span><span class="frt"><b>${hl(x.n)}</b>${snip(x)}<small>${esc(x.where)}</small></span><span class="dim">${KIND[x.k] || ''}</span><span class="dim">${x.mod || ''}</span></button>`;
    const grp = (h, l) => l.length ? `<section class="fresg"><h6>${h}${lCount(l.length)}</h6>${l.map(row).join('')}</section>` : '';
    if (!here.length && !(F.scope === 'all' && away.length)) return `<div class="fnone"><b>No results for “${esc(F.q)}”${F.scope === 'here' ? ` in ${cur}` : ''}</b>${F.scope === 'here' && away.length ? `<button type="button" data-fscope="all">${away.length} elsewhere in Home</button>` : ''}</div>`;
    return `<div class="fresults">${grp(`In ${cur}`, here)}${F.scope === 'all' ? grp('Elsewhere in Home', away) : away.length ? `<button class="fmore" type="button" data-fscope="all">${away.length} more elsewhere in Home${ic('chevron-right')}</button>` : ''}</div>`; }
  /* List view sorts by the SunoUI table header: folders first, then the chosen column */
  const fBytes = z => { const m = String(z).match(/([\d.]+)\s*(KB|MB|GB|items)/); return m ? +m[1] * ({ KB: 1, MB: 1e3, GB: 1e6, items: 0 }[m[2]]) : 0; };
  const fSorted = rows => { const { k, dir } = F.sort; return [...rows].sort((a, b) => (a.k === 'folder') !== (b.k === 'folder') ? (a.k === 'folder' ? -1 : 1)
    : dir * (k === 'size' ? fBytes(a.size) - fBytes(b.size) : k === 'kind' ? KIND[a.k].localeCompare(KIND[b.k]) : k === 'mod' ? fHere().indexOf(a) - fHere().indexOf(b) : a.n.localeCompare(b.n))); };
  function filerBody() { if (fNarrow() && F.view === 'cols') F.view = 'grid';
    if (F.q.trim()) { $('#f-body').innerHTML = filerResults(); return; }
    const rows = fRows();
    if (F.view === 'cols') { $('#f-body').innerHTML = filerCols(); requestAnimationFrame(filerSnap); setTimeout(filerSnap, 360); return; }
    if (!rows.length) { $('#f-body').innerHTML = `<div class="fnone"><b>${esc(fCur())} is empty</b></div>`; return; }
    $('#f-body').innerHTML = F.view === 'grid'
      ? `<div class="fgrid">${rows.map(f => `<button class="tile${f.n === F.sel ? ' on' : ''}" type="button" data-file="${esc(f.n)}"><span class="art">${art(f)}</span><span class="tname">${esc(f.n)}</span><span class="tmeta">${f.size}</span></button>`).join('')}</div>`
      : `<table class="flist">${lTHead([['name', 'Name'], ['kind', 'Kind'], ['size', 'Size'], ['mod', 'Modified']], F.sort, 'data-fsort')}<tbody>${fSorted(rows).map(f => `<tr class="${f.n === F.sel ? 'on' : ''}" data-file="${esc(f.n)}"><td class="n"><span><span class="mini">${mini(f)}</span>${esc(f.n)}</span></td><td class="dim">${KIND[f.k]}</td><td class="dim num">${f.size}</td><td class="dim">${f.mod}</td></tr>`).join('')}</tbody></table>`;
  }
  // Columns land on a column edge, so none is ever half shown
  function filerSnap() { const c = $('#f-body .fcols'); if (!c) return; const W = c.clientWidth, n = c.children.length, vis = Math.min(n, Math.max(1, Math.floor(W / 208))), w = c.closest('.phone') ? W : Math.min(280, Math.floor(W / vis));
    [...c.children].forEach(x => { x.style.flex = `0 0 ${w}px`; }); c.style.paddingRight = n > vis ? (W - vis * w) + 'px' : '0px'; c.scrollLeft = c.scrollWidth; }
  /* One column per level of the path: a folder opens the next column, a file is selected in its column (its details are in Information).
     Columns keep a comfortable width, so a wide window shows more of the path; a deep path slides its first columns away to the left
     (the path in the title walks back), and a phone shows one column at a time. The path trail is quiet; the active choice is the chip (#3, #4). */
  function filerCols() { const lv = [F.root, ...F.path], sel = fSelFile();
    const row = (x, i, st) => `<button type="button" class="fcrow${st ? ' ' + st : ''}" data-fcol="${i}" data-fname="${esc(x.n)}"${st === 'on' ? ' aria-current="true"' : ''}><span class="mini">${mini(x)}</span><span class="lab">${esc(x.n)}</span>${x.k === 'folder' ? ic('chevron-right') : ''}</button>`;
    return `<div class="fcols">${lv.map((d, i) => `<div class="fcol">${fDir(d).map(x => row(x, i, x.n === F.path[i] ? (i === F.path.length - 1 && !sel ? 'on' : 'trail') : i === lv.length - 1 && sel && x.n === sel.n ? 'on' : '')).join('') || '<p class="fcnone">Empty folder</p>'}</div>`).join('')}</div>`; }
  const fNarrow = () => { const m = $('#f-main'); return !!m?.clientWidth && m.clientWidth < 560; };
  /* A tablet (desktop/phone.js formOf) keeps the phone's bars and title islands with its wider panes; the desktop's bars are for a mouse. */
  const phTab = () => document.documentElement.dataset.form === 'tablet';
  const phWide = () => ['tablet', 'fold'].includes(document.documentElement.dataset.form);   /* the fold too: its desktop heads are hidden on .phone, so the island names the page */
  /* Filer on a phone. The bar is search and ⋯. ⋯ grows the bar upward into the view (grid or list; columns don't fit
     a phone), the sort, and New folder. With something selected, the bar is that thing's actions, nothing else:
     you can see what you picked, so the bar doesn't name it again, and a folder opens with a tap. */
  const FSORT = [['name', 'Name'], ['mod', 'Date'], ['size', 'Size'], ['kind', 'Kind']];
  function filerBarPhone(f, cur) { const bar = $('#f-bar');
    /* Moving: the file is held in a second row of the bar while you walk to where it goes. The row says what you're
       holding; ✕ lets it go. The bar's own row becomes the one thing to do next: Move here. */
    if (F.moving) { const m = F.moving, here = [F.root, ...F.path].join('/'), same = here === m.from.join('/');
      bar.classList.add('phgrow');
      setBar(bar, `<div class="fhold"><span class="fhth${m.x.src ? ' img' : ''}">${mini(m.x)}</span><span class="fhtx"><small>Moving</small><b>${esc(m.x.n)}</b></span><button class="ib" type="button" data-fmovex aria-label="Stop moving" title="Stop moving">${ic('x')}</button></div>
        <div class="fhrow">${same ? `<span class="fhwhere">Where are we moving this?</span>` : `<span class="fhwhere"><small>Move to</small><b>${ic('folder')}${esc(fCur())}</b></span><button class="bt pri fhere" type="button" data-fmovehere>Move here</button>`}</div>`); return; }
    /* Selected: the bar is the item's actions. Details and ⋯ grow the bar upward instead of opening a drawer. ✕ lets
       go of the selection (a tick would mean "done something"; this is "never mind"). */
    if (f) { const pan = F.selExp;
      const facts = [['Kind', KIND[f.k]], ['Size', f.size], ['Modified', f.mod], ['Where', [F.root, ...F.path].join(' › ')], ...(f.dim ? [['Dimensions', f.dim]] : []), ...(f.len ? [['Length', f.len]] : [])].filter(r => r[1]);
      const panel = pan === 'info' ? `<div class="fexp finfo2"><div class="fih"><span class="fhth${f.src ? ' img' : ''}">${mini(f)}</span><span><b>${esc(f.n)}</b><small>${KIND[f.k] || ''}${f.size ? ' · ' + f.size : ''}</small></span></div><dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`
        : pan === 'share' ? `<div class="fexp fshare2"><div class="fexh">Send to</div><div class="fshp">${['PR', 'NF', 'SK', 'TH', 'MO'].map(k => `<button type="button" data-fsendto="${k}">${av(k, 48)}<span>${esc(ppl(k).n.split(' ')[0])}</span></button>`).join('')}</div>
          <div class="fsha">${[['message-square', 'Messages'], ['mail', 'Email'], ['link', 'Copy link'], ['radio-tower', 'Nearby']].map(([i, n]) => `<button type="button" class="fvt" data-fsendvia="${n}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`
        : pan === 'openin' ? (() => { const kind = fKind(f.k), apps = LOPEN[kind] || ['filer'], def = LDEF[kind] || apps[0];
            return `<div class="fexp fmore2"><button class="fexr2 fback" type="button" data-fsexp="more">${ic('chevron-left')}<span>Open in</span></button>${apps.map(a => `<button class="fexr2" type="button" data-lui-open="${a}" data-lui-name="${esc(f.n)}" data-fpanelclose><img class="lappi" src="${cfIco(a)}" alt=""><span>${esc(cfName(a))}</span>${a === def ? '<small class="fdef">Default</small>' : ''}</button>`).join('')}<button class="fexr2" type="button" data-lui-open="other" data-lui-name="${esc(f.n)}" data-fpanelclose>${ic('app-window')}<span>Other app…</span></button></div>`; })()
        : pan === 'more' ? `<div class="fexp fmore2">${f.k !== 'folder' ? `<button class="fexr2" type="button" data-fopenin>${ic('app-window')}<span>Open in…</span>${ic('chevron-right')}</button>` : ''}<button class="fexr2" type="button" data-fdo="rename">${ic('pencil')}<span>Rename</span></button><button class="fexr2" type="button" data-fdo="dup">${ic('copy')}<span>Duplicate</span></button><button class="fexr2" type="button" data-fdo="zip">${ic('file-archive')}<span>Compress</span></button><button class="fexr2 red" type="button" data-fdo="trash">${ic('trash-2')}<span>Move to Trash</span></button></div>` : '';
      bar.classList.toggle('phgrow', !!panel);
      setBar(bar, `${panel}<button class="ib" type="button" data-fcopy aria-label="Copy" title="Copy">${ic('copy')}</button><button class="ib${pan === 'share' ? ' on' : ''}" type="button" data-fsexp="share" aria-label="Share" title="Share" aria-expanded="${pan === 'share'}">${ic('share-2')}</button><button class="ib" type="button" data-fmovestart aria-label="Move" title="Move">${ic('folder-input')}</button><button class="ib${pan === 'info' ? ' on' : ''}" type="button" data-fsexp="info" aria-label="Details" title="Details" aria-expanded="${pan === 'info'}">${SVG.info}</button><button class="ib${pan === 'more' || pan === 'openin' ? ' on' : ''}" type="button" data-fsexp="${pan === 'openin' ? 'openin' : 'more'}" aria-label="More" title="More" aria-expanded="${pan === 'more'}">${ic('ellipsis')}</button><button class="ib" type="button" data-fdesel aria-label="Clear selection" title="Clear selection">${ic('x')}</button>`); return; }
    /* ⋯ grows the bar into a small control room: how this folder looks, how it's ordered, and the two things you do
       to a folder itself. Tiles, not a settings list: each choice is something you can see before you tap it. */
    const dir = F.sort.dir < 0, sortBtn = ([k, n]) => `<button type="button" class="fsch${F.sort.k === k ? ' on' : ''}" data-fsortby="${k}">${n}${F.sort.k === k ? ic(dir ? 'arrow-down' : 'arrow-up') : ''}</button>`;
    const exp = F.exp ? `<div class="fexp">
      <div class="fexh">View</div>
      <div class="fexv">${[['grid', 'layout-grid', 'Grid'], ['list', 'list', 'List']].map(([k, i, n]) => `<button type="button" class="fvt${(F.view === 'cols' ? 'grid' : F.view) === k ? ' on' : ''}" data-fview="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div>
      <div class="fexh">Sort by</div>
      <div class="fexs">${FSORT.map(sortBtn).join('')}</div></div>` : '';
    /* while searching: this folder by default, everywhere one tap away, above the field */
    const scope = !F.exp && F.q.trim() ? `<div class="fscope2">${[['here', ic('folder'), esc(fCur())], ['all', ic('hard-drive'), 'Everywhere']].map(([k, i, n]) => `<button type="button" class="fsch${F.scope === k ? ' on' : ''}" data-fscope="${k}">${i}${n}</button>`).join('')}</div>` : '';
    bar.classList.toggle('phgrow', !!F.exp || !!scope);
    setBar(bar, `${exp}${scope}<label class="srch keep">${ic('search')}<input id="f-q" placeholder="Search" value="${esc(F.q)}" aria-label="Search ${cur}"><button class="fqx" type="button" data-fqx aria-label="Clear search">${ic('x')}</button></label><button class="ib" type="button" data-fnewtodo aria-label="New folder" title="New folder">${ic('folder-plus')}</button><button class="ib${F.exp ? ' on' : ''}" type="button" data-fexp aria-label="${F.exp ? 'Close' : 'View and sort'}" aria-expanded="${!!F.exp}">${ic(F.exp ? 'x' : 'ellipsis')}</button>`); requestAnimationFrame(segs); }
  function filerBar() {
    const f = fSelFile(), cur = esc(fCur());
    if (fNarrow() || phWide()) { filerBarPhone(f, cur); const q = $('#f-q'); if (q) { q.oninput = () => { const had = !!F.q.trim(); F.q = q.value; filerBody(); filerTitle(); if (had !== !!F.q.trim()) { filerBar(); const n = $('#f-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }; } return; }
    /* The chip is the file card at bar size: the file's own face, its name cut in the middle, its size. Open wears the default app's icon (#7, #13) */
    setBar($('#f-bar'), f
      ? `<span class="who"><span class="th${f.src ? ' img' : ''}">${mini(f)}</span><b class="lmid" title="${esc(f.n)}">${lMid(f.n)}</b><span class="wide">${f.size}</span><button class="whox" type="button" data-fdesel aria-label="Clear selection" title="Clear selection">${ic('x')}</button></span><span class="vr"></span>
         ${f.k === 'folder' ? `<button class="bt" type="button" data-fopen title="Open ${esc(f.n)}">${ic('folder-open')}<span class="wide">Open</span></button>` : lOpenBtn(fKind(f.k), `data-lui-open="${LDEF[fKind(f.k)] || 'filer'}" data-lui-name="${esc(f.n)}"`, '<span class="wide">Open</span>', 'bt')}<button class="bt" type="button" data-fcopy>${ic('copy')}<span class="wide">Copy</span></button><button class="bt" type="button" data-share>${ic('share-2')}<span class="wide">Share</span></button>
         <button class="ib${F.info ? ' on' : ''}" type="button" data-finfo aria-label="Information" title="Information">${SVG.info}</button><button class="ib" type="button" data-lmenu data-fmore aria-label="More" title="More">${ic('ellipsis')}</button>`
      : `<button class="ib" type="button" data-fup aria-label="Back" title="Back · Alt Left"${F.back?.length || F.path.length ? '' : ' disabled'}>${ic('chevron-left')}</button><button class="ib wide" type="button" data-ffwd aria-label="Forward" title="Forward · Alt Right"${F.fwd?.length ? '' : ' disabled'}>${ic('chevron-right')}</button><span class="vr"></span>
         <label class="srch">${ic('search')}<input id="f-q" placeholder="Search ${cur}" value="${esc(F.q)}" aria-label="Search ${cur}"><button class="fqx" type="button" data-fqx aria-label="Clear search">${ic('x')}</button></label><span class="vr"></span>
         ${seg([['grid', ic('layout-grid'), 'Grid'], ['list', ic('list'), 'List'], ['cols', ic('columns-3'), 'Columns']], F.view, 'data-fview', 'View', 'ico')}<button class="ib${F.info ? ' on' : ''}" type="button" data-finfo aria-label="Information" title="Information">${SVG.info}</button><span class="vr"></span><button class="bt pri" type="button">${ic('plus')}<span class="wide">New folder</span></button>`);
    const q = $('#f-q'); if (q) { q.oninput = () => { F.q = q.value; filerBody(); filerTitle(); }; q.onkeydown = e => { if (e.key === 'Escape' && q.value) { e.stopPropagation(); q.value = ''; F.q = ''; filerBody(); filerTitle(); } }; }
  }
  function filerTitle() { const cur = fCur(), rows = fRows(), up = [F.root, ...F.path.slice(0, -1)];
    const lead = fNarrow() && F.path.length ? `<button class="ib navback" type="button" data-fparent aria-label="Back to ${esc(up[up.length - 1])}">${ic('chevron-left')}</button>` : NAVBTN;
    if (fNarrow() && !F.q.trim()) { const par = F.path.length ? up[up.length - 1] : '';   /* phone: the title island, as Charlie and Ari */
      $('#f-ttl').innerHTML = `<div class="fisl">${F.path.length ? `<button class="fislb" type="button" data-fparent aria-label="Back to ${esc(par)}">${ic('chevron-left')}</button>` : `<button class="fislb" type="button" data-navtoggle aria-label="Places">${SVG.menu}</button>`}<button class="fisli" type="button" data-navtoggle aria-label="${esc(cur)}. Places"><b>${esc(cur)}</b><small>${par ? esc(par) + ' · ' : ''}${rows.length} ${rows.length === 1 ? 'item' : 'items'}</small></button></div>`; return; }
    $('#f-ttl').innerHTML = `${lead}<div><h1>${esc(cur)}</h1><div class="meta">${F.path.length ? up.map((c, i) => `${i ? '<span>›</span>' : ''}<button type="button" data-fcrumb="${i}">${esc(c)}</button>`).join('') + '<i class="d"></i>' : ''}${meta([`${rows.length} ${rows.length === 1 ? 'item' : 'items'}`])}</div></div>${phWide() ? `<div class="fviews">${seg([['grid', ic('layout-grid'), 'Grid'], ['list', ic('list'), 'List']], F.view === 'cols' ? 'grid' : F.view, 'data-fview', 'View', 'ico')}</div>` : ''}`;   /* tablet: views in the title row, the bar holds actions */ if (phWide()) requestAnimationFrame(segs);
    if (F.q.trim()) { const r = fSearch(), n = r.here.length + (F.scope === 'all' ? r.away.length : 0); $('#f-ttl').innerHTML = `${NAVBTN}<div><h1>${n ? n + (n === 1 ? ' result' : ' results') : 'No results'}</h1><div class="meta"><span>for \u201c${esc(F.q.trim())}\u201d</span></div>${seg([['here', esc(cur)], ['all', 'Everywhere']], F.scope, 'data-fscope', 'Search in', 'fscope')}</div>`; segs(); } }
  function filerInfo() { const d = $('#f-dock'), w = $('#w-filer'); w.classList.toggle('finfo', F.info); if (F.view === 'cols') setTimeout(filerSnap, 360); if (!lDPShow(d, { open: F.info, subject: true })) { d.innerHTML = ''; return; } const f = fSelFile(), rows = fHere(), cur = fCur(), launch = cur === 'Launch';
    const facts = f ? [['Kind', KIND[f.k]], ['Size', f.size], ['Modified', f.mod], ['Where', [F.root, ...F.path].join(' › ')], ...(f.dim ? [['Dimensions', f.dim]] : []), ...(f.len ? [['Length', f.len]] : [])]
      : [['Kind', FROOT.ssd === cur || FROOT.hd === cur ? 'Drive' : 'Folder'], ['Contains', `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`], ...(launch ? [['Size on disk', '1.24 GB']] : []), ['Modified', launch ? 'Today, 10:04 AM' : 'Sep 21'], ...(F.path.length ? [['Where', [F.root, ...F.path.slice(0, -1)].join(' › ')]] : []), ...(launch ? [['Shared with', 'Priya, Nora']] : [])];
    d.innerHTML = lDP({ title: 'Information', close: 'data-finfo', body: `<div class="pv">${f ? (f.src ? `<img src="${f.src}" alt="">` : art(f)) : FOLDER}</div><h3>${esc(f ? f.n : cur)}</h3>
      ${lDP.kv(facts.map(([k, v]) => [k, esc(v)]))}
      ${f?.tags ? `${lDP.lab('Tags')}<div class="chips">${f.tags.map(t => `<span class="chip"><i style="--c:oklch(0.72 0.13 ${TAGS[t][1]})"></i>${TAGS[t][0]}</span>`).join('')}</div>` : ''}` }); }
  function renderFiler() {
    const place = F.root !== 'Home' ? Object.keys(FROOT).find(k => FROOT[k] === F.root) : F.path.length ? Object.keys(FPLACE).find(k => FPLACE[k] === F.path[0]) : 'home';
    $('#f-rail').innerHTML = `${PLACES.map(([k, n, i]) => ri(k, 'data-fplace', n, i, place === k)).join('')}<span class="rsep"></span>
      ${ri('ssd', 'data-fplace', 'Fable SSD', 'hard-drive', place === 'ssd', '<span class="cap"><i style="width:58%"></i></span>')}${ri('hd', 'data-fplace', 'Archive', 'hard-drive', place === 'hd', '<span class="cap"><i style="width:84%"></i></span>')}`;
    filerTitle(); filerBody(); filerBar(); filerInfo();
    $('#f-body').ondblclick = e => { const t = e.target.closest('[data-file]'), x = t && fHere().find(y => y.n === t.dataset.file); if (!x) return;
      if (x.k === 'folder') { fGo(F.root, [...F.path, x.n]); renderFiler(); } else lToast($('#w-filer'), `Opening ${esc(x.n)} in ${cfName(LDEF[fKind(x.k)] || 'filer')}`, { icon: 'square-arrow-out-up-right' }); };
  }

  /* ══ Photos ════════════════════════════════════════════════════════════ */
  const PHOTOS = [['life-hero-writing', 'Writing at home', 'Oakland', 'Today', '10:42 AM', 1], ['life-suite-bg-write', 'Laptop on the boardwalk', 'Venice', 'Today', '10:18 AM', 0],
    ['life-sync-terrace', 'Terrace, morning', 'Lisbon', 'Today', '8:05 AM', 1], ['life-work-suite', 'At the desk', 'Brooklyn', 'Today', '7:51 AM', 0], ['life-ari-street', 'On the way in', 'Brooklyn', 'Today', '7:30 AM', 0],
    ['life-suite-bg-canvas', 'Posters on the floor', 'Los Angeles', 'Saturday', '4:12 PM', 0], ['life-suite-bg-sessions', 'Band practice', 'Nashville', 'Saturday', '2:40 PM', 1], ['life-suite-bg-reel', 'Skate shoot', 'Los Angeles', 'Saturday', '11:05 AM', 0],
    ['life-suite-bg-stage', 'Showing the deck', 'Austin', 'Saturday', '10:20 AM', 0], ['life-footer', 'A desk in a field', 'Sonoma', 'Saturday', '8:44 AM', 1], ['life-testimonial', 'Picnic', 'Sonoma', 'Saturday', '8:10 AM', 0],
    ['life-hero-home', 'Kitchen table', 'Portland', 'Sep 14', '6:30 PM', 0], ['life-professionals-loft', 'The loft', 'Chicago', 'Sep 14', '3:15 PM', 0], ['life-ledge-blog-1', 'Two at work', 'Chicago', 'Sep 14', '2:02 PM', 0],
    ['life-hero-studio', 'Studio floor', 'Oakland', 'Sep 14', '11:48 AM', 1], ['life-suite-bg-grid', 'Papers and a calculator', 'Venice', 'Sep 14', '10:31 AM', 0], ['life-suite-bg-darkroom', 'Shooting the coast', 'Big Sur', 'Sep 14', '7:12 AM', 1],
    ['take-back', 'Pink coat', 'Mexico City', 'Sep 14', '6:58 AM', 0], ['W:prism', 'Prism', 'Wallpaper', 'Aug 30', '9:00 PM', 0], ['W:meadow', 'Meadow', 'Wallpaper', 'Aug 30', '9:00 PM', 0], ['W:blue-fog', 'Blue fog', 'Wallpaper', 'Aug 30', '9:00 PM', 0], ['W:ember', 'Ember', 'Wallpaper', 'Aug 30', '9:00 PM', 0]
  ].map(([f, t, place, day, time, fav], i) => ({ i, src: f.startsWith('W:') ? WP + f.slice(2) + '.png' : PH + f + '.webp', t, place, day, time, fav: !!fav, wall: f.startsWith('W:') }));
  const DAYSUB = { Today: 'Tuesday, September 22', Saturday: 'September 19', 'Sep 14': 'Sunday, September 14', 'Aug 30': 'Sunday, August 30' };
  const PNAV = [['library', 'Library', 'image'], ['fav', 'Favorites', 'heart'], ['people', 'People', 'users'], ['places', 'Places', 'map-pin'], null, ['launch', 'Launch', 'star'], ['walls', 'Wallpapers', 'grid-2x2'], ['deleted', 'Deleted', 'trash-2']];
  const P = { view: 'library', zoom: 'days', q: '', px: '', clip: 5, drive: null, viewer: null, info: false, size: 168, edit: false, ed: {}, edits: {} };
  /* Edits are kept as numbers and drawn as CSS filters, so the original is never touched */
  const PPRE = { vivid: 'saturate(1.35) contrast(1.08)', warm: 'sepia(.22) saturate(1.18) brightness(1.02)', cool: 'hue-rotate(-12deg) saturate(1.06) brightness(1.02)', mono: 'grayscale(1) contrast(1.12)', fade: 'contrast(.86) brightness(1.08) saturate(.78)' };
  const pFilter = d => !d || !Object.keys(d).length ? '' : `${PPRE[d.pre] || ''} brightness(${(1 + (d.e || 0) / 200 + (d.sh || 0) / 700).toFixed(3)}) contrast(${(1 + (d.c || 0) / 160 - (d.sh || 0) / 900 + (d.hi || 0) / 900).toFixed(3)}) saturate(${(1 + (d.sat || 0) / 100).toFixed(3)}) sepia(${(Math.max(0, d.w || 0) / 260).toFixed(3)}) hue-rotate(${(Math.min(0, d.w || 0) / 6).toFixed(1)}deg)`;
  const pXform = d => d && (d.rot || d.flip) ? `rotate(${d.rot || 0}deg) scaleX(${d.flip ? -1 : 1})` : '';
  const pStyle = d => { const f = pFilter(d), t = pXform(d); return f || t ? ` style="${f ? `filter:${f};` : ''}${t ? `transform:${t};` : ''}"` : ''; };
  function pset() { let s = PHOTOS.filter(p => !p.del); if (P.view === 'fav') s = s.filter(p => p.fav); if (P.view === 'walls') s = s.filter(p => p.wall); if (P.view === 'launch') s = s.filter(p => !p.wall && p.day !== 'Sep 14'); if (P.view === 'deleted') s = PHOTOS.filter(p => p.del); if (P.view.startsWith('al_')) s = [];
    if (P.q) { const q = P.q.toLowerCase(); s = s.filter(p => (p.t + ' ' + p.place).toLowerCase().includes(q)); } return s; }
  const cell = p => `<figure class="pc" data-photo="${p.i}"><img src="${p.src}" alt="${esc(p.t)}" loading="lazy" draggable="false"${pStyle(P.edits[p.i])}>${p.fav ? `<span class="fav">${ic('heart')}</span>` : ''}</figure>`;
  function photosBody() {
    const set = pset(); let html = '';
    if (!set.length) html = `<p style="color:var(--ink-3);padding:30px 2px">${P.view === 'deleted' ? 'Nothing was deleted in the last 30 days.' : P.view.startsWith('al_') ? 'No photos in this album yet.' : 'No photos match.'}</p>`;
    else if (P.zoom === 'years') html = `<div class="years">${[['2026', PHOTOS[0], PHOTOS.length], ['2025', PHOTOS[17], 1840], ['2024', PHOTOS[9], 2346]].map(([y, p, c]) => `<button class="year" type="button" data-pzoom="months"><img src="${p.src}" alt="" loading="lazy"><b>${y}</b><span>${c.toLocaleString()} photos</span></button>`).join('')}</div>`;
    else if (P.zoom === 'months') html = [['September', set.filter(p => !p.wall)], ['August', set.filter(p => p.wall)]].filter(g => g[1].length).map(([m, g]) => `<div class="day"><b>${m}</b><span>${g.length} photos</span></div><div class="pgrid big">${g.map(cell).join('')}</div>`).join('');
    else if (P.zoom === 'all') html = `<div class="pgrid" style="margin-top:6px">${set.map(cell).join('')}</div>`;
    else html = [...new Set(set.map(p => p.day))].map(d => { const g = set.filter(p => p.day === d); return `<div class="day"><b>${d}</b><span>${DAYSUB[d]} · ${[...new Set(g.map(p => p.place))].slice(0, 2).join(' and ')}</span></div><div class="pgrid">${g.map(cell).join('')}</div>`; }).join('');
    /* Memories (phone, the library's top): a few days worth seeing again, made from where and when the photos were taken. Tap one
       and it plays: its photos one after another, full screen, with its title */
    if (pNarrow() && P.view === 'library' && !P.q && P.zoom !== 'years') { const byPlace = pl => PHOTOS.filter(x => !x.del && x.place === pl), MEM = [['Saturday in Sonoma', byPlace('Sonoma'), 'Two days ago'], ['Los Angeles', byPlace('Los Angeles'), 'This week'], ['Chicago, the loft', byPlace('Chicago'), 'Sep 14'], ['Brooklyn mornings', byPlace('Brooklyn'), 'Today']].filter(m => m[1].length);
      html = `<section class="pmem"><h2>Memories</h2><div class="pmemrow">${MEM.map(([t, l, when], i) => `<button type="button" class="pmemc" data-pmem="${i}"><img src="${l[0].src}" alt=""><span><b>${esc(t)}</b><small>${when} · ${l.length} photos</small></span></button>`).join('')}</div></section>` + html; P.mems = MEM; }
    $('#p-body').innerHTML = html; $('#w-photos').style.setProperty('--pcs', P.size + 'px'); pCorners();
    const it = PNAV.find(x => x && x[0] === P.view);
    $('#p-ttl').innerHTML = `${NAVBTN}<div><h1>${it[1]}</h1><div class="meta">${set.length ? meta([`${set.length} photos`, `${new Set(set.map(p => p.place)).size} places`, 'September 2026']) : meta(['Nothing here'])}</div></div>`;
  }
  /* A day's photos are one shape: every corner on its outside edge is round, every inner one square. Worked out from each tile's real
     neighbours (a corner is outside when neither side next to it has a tile), so it holds at any width and on a phone (#8) */
  function pCorners() { $$('#p-body .pgrid').forEach(g => { const t = [...g.children], n = t.length, c = Math.max(1, getComputedStyle(g).gridTemplateColumns.split(' ').length);
    t.forEach((x, i) => { const col = i % c, L = col > 0, R = col < c - 1 && i + 1 < n, U = i >= c, D = i + c < n;
      x.dataset.r = [!U && !L && 'tl', !U && !R && 'tr', !D && !R && 'br', !D && !L && 'bl'].filter(Boolean).join(' '); }); }); }
  new ResizeObserver(() => pCorners()).observe($('#p-body'));
  /* ── Photos on a phone ─────────────────────────────────────────────────────────────────────────────
     One bar, always. In the library it is where you move through your photos: which collection (the old sidebar),
     how far zoomed out (Years to All, the way you actually travel through a library), then Search and Add, both
     small because you rarely need them. Viewing a photo, the same bar becomes that photo's actions; you step
     between photos by swiping or on the filmstrip, so there is no pager. Every choice grows the bar, never a drawer. */
  const pNarrow = () => { const m = $('#p-main'); return !!m?.clientWidth && m.clientWidth < 560 && !phTab(); };   /* a tablet's library keeps its view island and sidebar, even upright */
  const PPLACES = () => [...new Set(PHOTOS.filter(p => !p.del).map(p => p.place))];
  function photosBarPhone() { const win = $('#w-photos'), bar = $('#p-bar'), X = P.px || '';
    win.classList.add('pnarrow'); bar.classList.add('phnofit', 'pphbar'); bar.hidden = !!P.edit; $('#p-view').hidden = true; $('#p-corner')?.setAttribute('hidden', '');
    $('#p-strip')?.remove(); $('#p-back')?.remove();
    if (P.viewer == null) {
      const count = v => v === 'library' ? PHOTOS.filter(p => !p.del).length : v === 'fav' ? PHOTOS.filter(p => p.fav && !p.del).length : v === 'walls' ? PHOTOS.filter(p => p.wall && !p.del).length : v === 'deleted' ? PHOTOS.filter(p => p.del).length : v === 'launch' ? PHOTOS.filter(p => !p.del && !p.wall && p.day !== 'Sep 14').length : '';
      const cover = v => (v === 'walls' ? PHOTOS.find(p => p.wall) : v === 'fav' ? PHOTOS.find(p => p.fav) : PHOTOS[3])?.src;
      const panel = X === 'places' ? `<div class="fexp ppx">
          <div class="fsha">${PNAV.slice(0, 4).map(([k, n, i]) => `<button type="button" class="fvt${P.view === k ? ' on' : ''}" data-pview="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div>
          <div class="fexh">Albums<button class="ppnew" type="button" data-pnewalbum>${ic('plus')}New album</button></div>
          ${PNAV.slice(5).map(([k, n, i]) => `<button class="fexr2${P.view === k ? ' on' : ''}" type="button" data-pview="${k}">${k === 'deleted' ? `<i class="ppth ic">${ic(i)}</i>` : `<img class="ppth" src="${cover(k)}" alt="">`}<span>${n}</span><small>${count(k)}</small></button>`).join('')}</div>`
        : X === 'album' ? `<div class="fexp ppx"><div class="fexh">New album</div><label class="cfield">${ic('folder-plus')}<input data-palname placeholder="Album name" aria-label="Album name"></label><button class="bt pri ppmk" type="button" data-palmk>Create album</button></div>`
        : X === 'search' ? `<div class="fexp ppx"><div class="fexh">${P.q ? `${pset().length} ${pset().length === 1 ? 'photo' : 'photos'}` : 'Places'}</div><div class="fexs">${PPLACES().slice(0, 8).map(pl => `<button type="button" class="fsch${P.q.toLowerCase() === pl.toLowerCase() ? ' on' : ''}" data-pqset="${esc(pl)}">${ic('map-pin')}${esc(pl)}</button>`).join('')}</div></div>`
        : X === 'add' ? `<div class="fexp fmore2 ppx"><div class="fexh">Add photos</div>
          <button class="fexr2" type="button" data-padd="files">${ic('folder-open')}<span>From Files</span>${ic('chevron-right')}</button>
          ${P.clip ? `<button class="fexr2" type="button" data-padd="clip"><img class="ppth" src="${PHOTOS[P.clip].src}" alt=""><span>Paste<small>The photo you copied</small></span></button>` : ''}
          ${P.drive ? `<button class="fexr2" type="button" data-padd="drive">${ic('hard-drive')}<span>${esc(P.drive.n)}<small>${P.drive.c} new photos</small></span>${ic('chevron-right')}</button>` : ''}</div>` : '';
      bar.classList.toggle('phgrow', !!panel || X === 'zoom');
      const ZM = [['years', 'Years', 'calendar-range'], ['months', 'Months', 'calendar-days'], ['days', 'Days', 'calendar'], ['all', 'All photos', 'layout-grid']], zc = ZM.find(z => z[0] === P.zoom);
      const zpanel = X === 'zoom' ? `<div class="fexp"><div class="fexh">Show by</div><div class="fsha">${ZM.map(([k, n, i]) => `<button type="button" class="fvt${P.zoom === k ? ' on' : ''}" data-pzoom="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div>${P.zoom === 'years' ? '' : `<div class="fexh">Photo size</div><div class="ppsize"><button class="ib" type="button" data-psz="-1" aria-label="Smaller">${ic('zoom-out')}</button><input type="range" min="96" max="340" step="4" value="${P.size}" data-psize aria-label="Photo size"><button class="ib" type="button" data-psz="1" aria-label="Larger">${ic('zoom-in')}</button></div>`}</div>` : '';
      const cur = PNAV.find(x => x && x[0] === P.view) || PNAV[0];
      setBar(bar, X === 'search'
        ? `${panel}<label class="srch keep">${ic('search')}<input id="p-q" placeholder="Search" value="${esc(P.q)}" aria-label="Search photos"></label><button class="ib" type="button" data-ppx="search" aria-label="Close search" title="Close search">${ic('x')}</button>`
        : `${panel}${zpanel}<button class="ppchip${X === 'places' ? ' on' : ''}" type="button" data-ppx="places" aria-expanded="${X === 'places'}">${ic(cur[2])}<b>${cur[1]}</b>${ic('chevron-down')}</button><button class="ppchip${X === 'zoom' ? ' on' : ''}" type="button" data-ppx="zoom" aria-expanded="${X === 'zoom'}"><b>${zc[1].replace(' photos', '')}</b>${ic('chevron-down')}</button><span class="sp"></span><button class="ib${P.q ? ' on' : ''}" type="button" data-ppx="search" aria-label="Search" title="Search">${ic('search')}</button><button class="ib${X === 'add' ? ' on' : ''}" type="button" data-ppx="add" aria-label="Add photos" title="Add photos" aria-expanded="${X === 'add'}">${ic('plus')}</button>`);
      const q = $('#p-q'); if (q) { q.oninput = () => { P.q = q.value; photosBody(); photosBar(); const n = $('#p-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; if (!q.value) q.focus(); }
      return; }
    /* Viewing: Back top left, the photo edge to edge, a filmstrip to scrub, and the photo's actions in the bar */
    const set = pset(), at = set.findIndex(p => p.i === P.viewer), p = PHOTOS[P.viewer], back = (PNAV.find(x => x && x[0] === P.view) || [0, 'Library'])[1];
    /* one island: ‹ | the photo's title, where and when (as Charlie and Notes) */
    $('#p-main').insertAdjacentHTML('beforeend', `<div class="flo pisl" id="p-back"><button class="pislb" type="button" data-pclose aria-label="Back to ${esc(back)}">${ic('chevron-left')}</button><span class="pisli"><b>${esc(p.t)}</b><small>${esc(p.place)} · ${esc(DAYSUB[p.day])}, ${esc(p.time)}</small></span></div>`);
    if (P.edit) return;
    $('#p-main').insertAdjacentHTML('beforeend', `<div class="pstrip" id="p-strip" aria-label="Photos">${set.map(x => `<button type="button" class="${x.i === P.viewer ? 'on' : ''}" data-pgo="${x.i}" aria-label="${esc(x.t)}"><img src="${x.src}" alt="" loading="lazy"${pStyle(P.edits[x.i])}></button>`).join('')}</div>`);
    requestAnimationFrame(() => requestAnimationFrame(() => { const st = $('#p-strip'), on = st?.querySelector('.on'); if (on) st.scrollLeft = on.offsetLeft - st.clientWidth / 2 + on.offsetWidth / 2; }));
    const facts = [['Taken', `${DAYSUB[p.day]}, ${p.time}`], ['Place', p.place], ['Camera', p.wall ? 'Made in Canvas' : 'Suno phone · 24 MP'], ['Stored', 'This phone'], ['Backup', 'Suno Connect'], ...(P.edits[p.i] ? [['Edits', 'Original kept']] : [])];
    const panel = X === 'info' ? `<div class="fexp finfo2"><div class="fih"><img class="ppth big" src="${p.src}" alt=""${pStyle(P.edits[p.i])}><span><b>${esc(p.t)}</b><small>${esc(p.place)} · ${at + 1} of ${set.length}</small></span></div><dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`
      : X === 'share' ? `<div class="fexp fshare2"><div class="fexh">Send to</div><div class="fshp">${['PR', 'NF', 'SK', 'TH', 'MO'].map(k => `<button type="button" data-pdo="Sent to ${esc(ppl(k).n.split(' ')[0])}">${av(k, 48)}<span>${esc(ppl(k).n.split(' ')[0])}</span></button>`).join('')}</div>
        <div class="fsha">${[['message-square', 'Messages', 'Opening Messages'], ['mail', 'Email', 'Opening a new email'], ['copy', 'Copy', 'Photo copied'], ['radio-tower', 'Nearby', 'Looking for devices nearby']].map(([i, n, t]) => `<button type="button" class="fvt" data-pdo="${t}">${ic(i)}<span>${n}</span></button>`).join('')}</div></div>`
      : X === 'more' ? `<div class="fexp fmore2"><button class="fexr2" type="button" data-pdo="Added to Launch">${ic('folder-plus')}<span>Add to album</span></button><button class="fexr2" type="button" data-pdo="Set as your wallpaper">${ic('wallpaper')}<span>Use as wallpaper</span></button><button class="fexr2" type="button" data-pdo="Duplicated">${ic('copy')}<span>Duplicate</span></button><button class="fexr2" type="button" data-pdo="Saved to Files">${ic('download')}<span>Save to Files</span></button><button class="fexr2 red" type="button" data-ppx="del">${ic('trash-2')}<span>Delete photo</span></button></div>`
      : X === 'del' ? `<div class="fexp cconf"><b>Delete this photo?</b><p>It stays in Deleted for 30 days, then it’s gone from every device.</p><div class="cconfb"><button class="bt fill" type="button" data-ppx="more">Cancel</button><button class="bt danger" type="button" data-pdel>${ic('trash-2')}Delete</button></div></div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    const fl = p.fav ? 'Remove from Favorites' : 'Add to Favorites';
    setBar(bar, `${panel}<button class="bt pri pped" type="button" data-pedit>${ic('sliders-horizontal')}<span>Edit</span></button><button class="ib${X === 'share' ? ' on' : ''}" type="button" data-ppx="share" aria-label="Share" title="Share" aria-expanded="${X === 'share'}">${ic('share-2')}</button><button class="ib${p.fav ? ' faved' : ''}" type="button" data-pfav aria-pressed="${!!p.fav}" aria-label="${fl}" title="${fl}">${ic('heart')}</button><button class="ib${X === 'info' ? ' on' : ''}" type="button" data-ppx="info" aria-label="Details" title="Details" aria-expanded="${X === 'info'}">${ic('info')}</button><button class="ib${X === 'more' || X === 'del' ? ' on' : ''}" type="button" data-ppx="more" aria-label="More" title="More" aria-expanded="${X === 'more'}">${ic('ellipsis')}</button>`);
  }
  function photosBar() {
    const win = $('#w-photos'); if ($('#p-view')) $('#p-view').hidden = P.viewer != null; $('#p-main .viewer')?.remove(); $('#p-main .panel')?.remove(); win.classList.toggle('viewing', P.viewer != null); if (P.viewer == null) { P.edit = false; $('#p-ed')?.remove(); $('#p-bar').hidden = false; } pDet(); pCorner();
    if (pNarrow()) { if (P.viewer != null) { const set = pset(), at = set.findIndex(p => p.i === P.viewer), p = PHOTOS[P.viewer];
        $('#p-main').insertAdjacentHTML('beforeend', `<div class="viewer${P.edit ? ' editing' : ''}"><div class="vt"><b>${esc(p.t)}</b><span>${esc(p.place)} · ${esc(DAYSUB[p.day])} · ${esc(p.time)}</span></div><img id="p-img" src="${p.src}" alt="${esc(p.t)}"${pStyle(P.edit ? P.ed : P.edits[p.i])}></div>`);
        if (P.edit) { P.px = ''; photosEditor(p); $('#p-bar').hidden = true; }
        else { const im = $('#p-main .viewer'); let x0 = null; im.onpointerdown = e => { x0 = e.clientX; }; im.onpointerup = e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
          if (Math.abs(dx) > 40) { const nx = set[at + (dx < 0 ? 1 : -1)]; if (nx) { P.viewer = nx.i; P.px = ''; photosBar(); } } else if (P.px) { P.px = ''; photosBar(); } else win.classList.toggle('pimm'); }; } }
      else win.classList.remove('pimm');
      return photosBarPhone(); }
    win.classList.remove('pnarrow'); $('#p-bar').classList.remove('phnofit', 'pphbar', 'phgrow'); $('#p-strip')?.remove(); $('#p-back')?.remove();
    if (P.viewer == null) {
      /* The bar holds what you do every time: search and import. How the library is laid out (years to all, photo
         size) is a view choice, set once and left: it floats top right, like every island app's view control. */
      $('#p-view').hidden = false; $('#p-view').innerHTML = `${seg([['years', 'Years'], ['months', 'Months'], ['days', 'Days'], ['all', 'All']], P.zoom, 'data-pzoom', 'Zoom')}${P.zoom === 'years' ? '' : `<span class="psize wide" title="Photo size">${ic('zoom-out')}<input type="range" min="96" max="300" step="4" value="${P.size}" data-psize aria-label="Photo size">${ic('zoom-in')}</span>`}`; requestAnimationFrame(segs);
      setBar($('#p-bar'), `<label class="srch">${ic('search')}<input id="p-q" placeholder="Search places, people" value="${esc(P.q)}" aria-label="Search photos"></label><span class="vr"></span><button class="bt pri" type="button" data-lmenu data-pimport>${ic('upload')}<span class="wide">Import</span></button>`);
      const q = $('#p-q'); q.oninput = () => { P.q = q.value; photosBody(); }; return;
    }
    const set = pset(), at = set.findIndex(p => p.i === P.viewer), p = PHOTOS[P.viewer];
    $('#p-main').insertAdjacentHTML('beforeend', `<div class="viewer${P.edit ? ' editing' : ''}"><div class="vt"><b>${esc(p.t)}</b><span>${esc(p.place)} · ${esc(DAYSUB[p.day])} · ${esc(p.time)}</span></div><img id="p-img" src="${p.src}" alt="${esc(p.t)}"${pStyle(P.edit ? P.ed : P.edits[p.i])}></div>`);
    /* Edit grows the bar into the editor in place (SunoUI action center), never a side panel: the tool groups as a switch in its header,
       the chosen group's controls, then Revert, Cancel and Done. The photo sits above it. */
    photosEditor(p);
    const back = (PNAV.find(x => x && x[0] === P.view) || [0, 'Library'])[1];
    $('#p-bar').hidden = !!P.edit; if (P.edit) { pCorner(); return; }   /* the bar became the editor */
    /* The photo's own actions sit top right (Favorite, Share, Information, Edit, ···); the bar keeps what you do right now: back and step */
    setBar($('#p-bar'), `<button class="bt pback" type="button" data-pclose title="Back to ${esc(back)}">${ic('chevron-left')}${esc(back)}</button>
      <span class="pager"><button class="ib" type="button" data-pstep="-1" ${at > 0 ? '' : 'disabled'} aria-label="Previous" title="Previous">${ic('chevron-left')}</button><span class="count">${at + 1} of ${set.length}</span><button class="ib" type="button" data-pstep="1" ${at < set.length - 1 ? '' : 'disabled'} aria-label="Next" title="Next">${ic('chevron-right')}</button></span>`);
  }
  function photosEditor(p) {
    const pedsl = (k, n) => `<div class="pedsl"><span><b>${n}</b><em data-pedv="${k}">${(P.ed[k] || 0) > 0 ? '+' : ''}${P.ed[k] || 0}</em></span><input type="range" min="-100" max="100" step="1" value="${P.ed[k] || 0}" data-ped="${k}" aria-label="${n}"></div>`;
    $('#p-ed')?.remove();
    if (P.edit) { const t = P.edTab || 'light', grid = (...r) => `<div class="pedgrid">${r.join('')}</div>`;
      const body = t === 'looks' ? `<div class="ppre">${[['', 'Original'], ['vivid', 'Vivid'], ['warm', 'Warm'], ['cool', 'Cool'], ['mono', 'Mono'], ['fade', 'Fade']].map(([k, n]) => `<button type="button" class="${(P.ed.pre || '') === k ? 'on' : ''}" data-ppre="${k}"><img src="${p.src}" alt=""${k ? ` style="filter:${PPRE[k]}"` : ''}><span>${n}</span></button>`).join('')}</div>`
        : t === 'colour' ? grid(pedsl('w', 'Warmth'), pedsl('sat', 'Saturation'))
        : t === 'crop' ? `<div class="pcrop"><button class="bt fill" type="button" data-prot>${ic('rotate-ccw')}Rotate</button><button class="bt fill" type="button" data-pflip>${ic('flip-horizontal-2')}Flip</button><button class="bt fill" type="button" data-pcrop>${ic('crop')}Crop</button></div>`
        : grid(pedsl('e', 'Exposure'), pedsl('c', 'Contrast'), pedsl('hi', 'Highlights'), pedsl('sh', 'Shadows'));
      if (pNarrow()) { const tabs = [['looks', 'Looks', 'palette'], ['light', 'Light', 'sun'], ['colour', 'Color', 'droplet'], ['crop', 'Crop', 'crop']];
        $('#p-main').insertAdjacentHTML('beforeend', `<div class="lac ped phed" id="p-ed" role="group" aria-label="Edit"><div class="pedh2"><button class="bt" type="button" data-pedx>Cancel</button><b>Edit</b><button class="bt pri" type="button" data-peddone>Done</button></div>
          <div class="pedb">${body}</div>
          <div class="pedtabs2">${tabs.map(([k, n, i]) => `<button type="button" class="${t === k ? 'on' : ''}" data-pedtab="${k}">${ic(i)}<span>${n}</span></button>`).join('')}<i class="pedsep"></i><button type="button" data-pauto>${ic('wand-sparkles')}<span>Auto</span></button><button type="button" data-prevert${Object.keys(P.ed).length ? '' : ' disabled'}>${ic('rotate-ccw')}<span>Revert</span></button></div></div>`);
        lAC.bind($('#p-ed'), () => { P.edit = false; photosBar(); }); return; }
      $('#p-main').insertAdjacentHTML('beforeend', `<div class="lac ped" id="p-ed" role="group" aria-label="Edit"><div class="lach"><b class="lacmode">${ic('sliders-horizontal')}Edit</b>${seg([['looks', 'Looks'], ['light', 'Light'], ['colour', 'Color'], ['crop', 'Crop']], t, 'data-pedtab', 'Tools')}<i class="sp"></i><button class="bt sm" type="button" data-pauto title="Let Photos adjust it">${ic('wand-sparkles')}Auto</button></div>
        <div class="pedb">${body}</div><div class="lacft"><button class="bt" type="button" data-prevert${Object.keys(P.ed).length ? '' : ' disabled'}>Revert to original</button><span class="sp"></span><button class="bt" type="button" data-pedx>Cancel</button><button class="bt key" type="button" data-peddone>Done</button></div></div>`);
      lAC.bind($('#p-ed'), () => { P.edit = false; photosBar(); }); requestAnimationFrame(segs); }
  }
  function pCorner() { let c = $('#p-corner'); const p = PHOTOS[P.viewer]; if (!c) { $('#p-main').insertAdjacentHTML('beforeend', '<div class="flo lcorner" id="p-corner"></div>'); c = $('#p-corner'); }
    c.hidden = P.viewer == null || P.edit; if (c.hidden) return; const fl = p.fav ? 'Remove from Favorites' : 'Add to Favorites';
    c.innerHTML = `<button class="ib" type="button" data-share aria-label="Share" title="Share">${ic('share-2')}</button><button class="ib${p.fav ? ' faved on' : ''}" type="button" data-pfav aria-pressed="${p.fav}" aria-label="${fl}" title="${fl}">${ic('heart')}</button><button class="ib${P.info ? ' on' : ''}" type="button" data-pinfo aria-pressed="${!!P.info}" aria-label="Information" title="Information">${ic('info')}</button><button class="bt pri" type="button" data-pedit>${ic('pencil')}<span class="wide">Edit</span></button><button class="ib" type="button" data-pmore aria-label="More" title="More" aria-haspopup="menu">${ic('ellipsis')}</button>`;   /* the SunoUI order: Share, the on/off states, the action, then ··· */ }
  /* Information is the one SunoUI details pane: closed until you ask, gone when the photo closes (#17) */
  function pDet() { const d = $('#p-det'), p = PHOTOS[P.viewer]; if (!lDPShow(d, { open: P.info && !P.edit, subject: P.viewer != null })) { d.innerHTML = ''; return; }
    d.innerHTML = lDP({ title: 'Information', close: 'data-pinfo', body: `<p class="pdockt">${esc(p.t)}</p>${lDP.kv([['Taken', `${esc(DAYSUB[p.day])}, ${esc(p.time)}`], ['Place', esc(p.place)], ['Camera', p.wall ? 'Made in Canvas' : 'Suno phone · 24 MP'], ['Stored', 'This computer'], ['Backup', '<i class="pbk"></i>Suno Connect'], ...(P.edits[p.i] ? [['Edits', 'Yes · original kept']] : [])])}` }); }
  function renderPhotos() {
    const row = x => `<button class="si${P.view === x[0] ? ' on' : ''}" type="button" data-pview="${x[0]}">${ic(x[2])}<span class="lab">${x[1]}</span>${x[0] === 'library' ? lCount(PHOTOS.filter(p => !p.del).length) : ''}</button>`;
    $('#p-rail').innerHTML = `<div class="scr"><div class="sh">Library</div>${PNAV.slice(0, 4).map(row).join('')}<div class="sh">Albums<button class="ib" type="button" data-lmenu data-pnewalbum aria-label="New album" title="New album">${ic('plus')}</button></div>${PNAV.slice(5).map(row).join('')}</div>
      <button class="tstatus" type="button" title="Photos from this computer and your phone stay in step"><i class="stat"></i><span class="tx">Synced with Suno Connect</span></button>`;
    photosBody(); photosBar();
  }

  /* Filer and Photos build their title bars in the page; the button joins them once */
  ['w-filer', 'w-photos'].forEach(id => { const w = $('#' + id); w.classList.toggle('lsideoff', !lSideOn(w)); w.querySelector('.tbar').insertAdjacentHTML('beforeend', lSideBtn(w)); });

  /* ══ Viola ═════════════════════════════════════════════════════════════ */
  const POSTS = {
    linux: { t: 'What actually is Linux?', tags: ['Computing 101', 'Linux'], d: 'September 19, 2026 · 6 minute read', img: 'life-ledge-blog-1', q: 'Linux is a kernel, not the whole computer.',
      p: ['Most people who ask what Linux is are really asking what their computer is. The honest answer is a stack: something that talks to the hardware, something that manages your files and windows, and the apps you actually came for.', 'The kernel is the part nobody sees. It decides which program gets the processor, how memory is shared, and how a keypress becomes a letter on the screen.', 'That is why two computers can both run Linux and feel nothing alike. What makes a system yours is everything above the kernel, and that is the part we build.'] },
    free: { t: 'The future of software is free.', tags: ['Opinion'], d: 'September 12, 2026 · 5 minute read', img: 'life-suite-bg-canvas', q: 'The best tools should not be a subscription.', p: ['Every tool on this computer is included, and none of them will ask you for money later.', 'Software gets cheaper to make every year. The price people pay for it keeps going up. Somewhere in between is a business model we decided not to have.'] },
    open: { t: 'Our thoughts on open source.', tags: ['Community'], d: 'September 4, 2026 · 7 minute read', img: 'life-professionals-loft', q: 'Open is not a feature. It is the foundation.', p: ['Suno stands on decades of other people’s work. The least we can do is make ours as easy to read, change and give back.'] },
    ai: { t: 'Suno and AI.', tags: ['Ari'], d: 'August 28, 2026 · 12:40 video', img: 'life-suite-bg-sessions', video: true, q: 'An assistant should ask before it acts.', p: ['Ari runs on your computer, not ours. It can move files, draft a note and find a setting, and it asks you before it does anything you would want to know about.'] },
    sv: { t: 'Silicon Valley 2.0', tags: ['Industry'], d: 'August 20, 2026 · 8 minute read', img: 'life-work-suite', q: 'We have been here before, and we know how it ends.', p: ['Every generation of computing starts open and ends locked. This one does not have to.'] }};
  const PAGE = k => k.startsWith('post:') ? { title: POSTS[k.slice(5)].t, host: 'simplyluma.com', path: '/blog/' + k.slice(5), fav: FAV }
    : { home: { title: 'Suno — A better computer.', host: 'simplyluma.com', path: '', fav: FAV }, hub: { title: 'Community — Suno Hub', host: 'hub.simplyluma.com', path: '/community', fav: FAV }, start: { title: 'Start page', host: '', path: '', fav: A + 'browser.svg', start: true } }[k];
  const V = { dlNew: 2, zoom: 100, space: 'personal', n: 30, star: {}, playing: true, dl: false, wsp: false, hist: {},
    spaces: { personal: { name: 'Personal', h: 75, on: 1, items: [{ id: 1, page: 'home' }, { id: 2, page: 'post:linux' }, { group: 'Reading', gh: 250, open: true, tabs: [{ id: 3, page: 'post:free' }, { id: 4, page: 'post:open' }, { id: 5, page: 'post:ai', audio: true }] }, { id: 6, page: 'start' }] },
      work: { name: 'Work', h: 250, on: 11, items: [{ id: 11, page: 'hub' }, { group: 'Launch', gh: 45, open: true, tabs: [{ id: 12, page: 'post:sv' }, { id: 13, page: 'home' }] }, { group: 'Research', gh: 150, open: false, tabs: [{ id: 14, page: 'post:open' }, { id: 15, page: 'post:linux' }] }, { id: 16, page: 'start' }] } } };
  const SP = () => V.spaces[V.space], allTabs = sp => sp.items.flatMap(it => it.group ? it.tabs : [it]);
  const curTab = () => allTabs(SP()).find(t => t.id === SP().on) || allTabs(SP())[0];
  function webHTML(k) {
    const nav = `<div class="w-nav"><b>suno<i>.</i></b><span>Why Suno</span><span>Creative Collection</span><span>Ari</span><span>Blog</span><span class="dl2">Download Suno</span></div>`;
    if (k === 'start') return `<div class="w-start"><img class="mark" src="${A}browser.svg" alt=""><label class="q">${ic('search')}<input placeholder="Search the web or type an address" data-vgo aria-label="Search the web"></label>
      <div class="w-tiles">${[['home', 'Suno', FAV], ['post:linux', 'Blog', FAV], ['hub', 'Hub', FAV], ['start', 'Depot', A + 'app-store.svg'], ['start', 'Maps', A + 'maps.svg'], ['start', 'Mail', A + 'mail.svg']].map(([p, n, f]) => `<button class="w-tile" type="button" data-vopen="${p}"><span class="tb2"><img src="${f}" alt=""></span>${n}</button>`).join('')}</div></div>`;
    if (k === 'hub') { const T = [['Welcome to the Suno Hub', 'Start here · pinned', 'NF', 45, '128 replies'], ['Show us your desktop', 'Screenshots', 'SO', 150, '64 replies'], ['Fairphone 6 support thread', 'Hardware', 'AV', 250, '41 replies'], ['Tiling presets for ultrawide screens', 'Ideas', 'PR', 320, '23 replies'], ['Stage exports to PDF with notes?', 'Help', 'NM', 200, '9 replies']];
      return nav + `<div class="w-hub"><h2>Community</h2><p class="lede">Questions, ideas and what people are making with Suno.</p><div class="cats"><span class="on">Latest</span><span>Help</span><span>Ideas</span><span>Hardware</span><span>Screenshots</span></div>${T.map(([t, c, i, h, r]) => `<div class="th"><span class="av" style="background:oklch(0.6 0.13 ${h})">${i}</span><span><b>${t}</b><span>${c}</span></span><em>${r}</em></div>`).join('')}</div>`; }
    if (k.startsWith('post:')) { const p = POSTS[k.slice(5)];
      return nav + `<article class="w-post"><div class="tags">${p.tags.map(t => `<span>${t}</span>`).join('')}</div><h2>${p.t}</h2><div class="when">${p.d}</div><figure><img src="${PH}${p.img}.webp" alt="">${p.video ? `<span class="vid">${V.playing ? 'Playing' : 'Paused'} · 4:12 of 12:40</span>` : ''}</figure><p>${p.p[0]}</p><blockquote>${p.q}</blockquote>${p.p.slice(1).map(x => `<p>${x}</p>`).join('')}</article>`; }
    return nav + `<section class="w-hero"><img src="${PH}life-hero-writing.webp" alt=""><div class="copy"><h2>A better computer.</h2><p>Suno is a free, open-source operating system, designed around how we believe computers should actually feel today.</p><div class="ctas"><span class="a">Download Suno</span><span class="b">See what's inside</span></div></div></section>
      <section class="w-sec"><h3>Your computer shouldn't end at the edge of a screen. <span>With Suno, it doesn't.</span></h3><div class="w-cards"><div class="w-card"><img src="${PH}life-professionals-loft.webp" alt=""><b>A focused, full-scale workspace.</b></div><div class="w-card"><img src="${PH}life-sync-terrace.webp" alt=""><b>Full apps, made for your fingers.</b></div><div class="w-card"><img src="${PH}life-ari-street.webp" alt=""><b>Your real computer in your pocket.</b></div></div></section>`;
  }
  /* Viola in the kit. The title bar says where you are (the address, a recessed field). The floating
     bar holds what you do to the page, and tucks away while you read. The tab list sits on the frame. */
  function renderViola(load) {
    const sp = SP(), t = curTab(), pg = PAGE(t.page), h = V.hist[t.id] || [];
    const vw = $('#w-viola'); if (!vw.dataset.side) { vw.dataset.side = 1; vw.classList.toggle('lsideoff', !lSideOn(vw)); }
    /* The page's title is centred on the window, its site icon attached; when room runs out it slides off centre and truncates (#12) */
    $('#v-top').innerHTML = `<span class="vtl"><img src="${A}browser.svg" alt=""><b>Viola</b><span class="chev">${ic('chevron-down')}</span>${lSideBtn(vw)}</span><span class="vttl" title="${esc(pg.title)}${pg.host ? ' · ' + esc(pg.host) : ''}"><img src="${pg.fav}" alt=""><span>${esc(pg.title)}</span></span><span class="vtr"></span>`;
    const addr = `<label class="vaddr">${pg.start ? ic('search') : `<span class="lock" title="Secure · trackers blocked">${ic('shield-check')}</span>`}<span class="shown">${pg.start ? '<span>Search or type an address</span>' : `<b>${pg.host}</b><span>${pg.path}</span>`}</span>
        <input value="${pg.start ? '' : esc(pg.host + pg.path)}" placeholder="Search or type an address" data-vgo aria-label="Address and search" spellcheck="false">${pg.start ? '' : `<button class="star${V.star[t.page] ? ' on' : ''}" type="button" data-vstar aria-label="Bookmark">${ic('star')}</button>`}</label>`;
    setBar($('#v-nav'), `<button class="ib" type="button" data-vback aria-label="Back" title="Back" ${h.length ? '' : 'disabled'}>${ic('chevron-left')}</button><button class="ib" type="button" disabled aria-label="Forward">${ic('chevron-right')}</button><button class="ib" type="button" data-vreload aria-label="Reload" title="Reload">${ic('rotate-cw')}</button>
      ${addr}<button class="ib" type="button" data-share aria-label="Share page" title="Share">${ic('share-2')}</button><button class="ib${V.dl ? ' on' : ''}" type="button" data-vdl aria-label="Downloads" title="Downloads">${ic('download')}${lCount(V.dlNew, true)}</button><button class="ib" type="button" data-vmore data-lmenu aria-label="More" title="More">${ic('ellipsis')}</button>`);
    vw.classList.toggle('vnarrow', vNarrow()); if (vNarrow()) vBarPhone(); else $('#v-nav').classList.remove('phnofit', 'vphbar', 'phgrow');
    const row = x => { const p = PAGE(x.page); return `<button class="si tab${x.id === sp.on ? ' on' : ''}" type="button" data-vtab="${x.id}" title="${esc(p.title)}"><img class="vfav" src="${p.fav}" alt=""><span class="lab">${esc(p.title)}</span>${x.audio ? `<span class="snd">${ic('volume-2')}</span>` : ''}<span class="x" data-vclosetab="${x.id}" role="button" aria-label="Close tab">${ic('x')}</span></button>`; };
    const pl = allTabs(V.spaces.personal).find(x => x.audio);
    $('#v-side').innerHTML = `<button class="wsbtn" type="button" data-vws style="--sh:${sp.h}"><i></i><span>${sp.name}</span><em>${allTabs(sp).length} tabs</em>${ic('chevrons-up-down')}</button>
      <div class="pins">${[['home', FAV, 'simplyluma.com'], ['start', A + 'mail.svg', 'Mail'], ['start', A + 'calendar.svg', 'Calendar'], ['start', A + 'maps.svg', 'Maps']].map(([p, f, n]) => `<button class="pin" type="button" data-vopen="${p}" title="${n}"><img src="${f}" alt="${n}"></button>`).join('')}</div>
      <div class="tabs">${sp.items.map((it, gi) => it.group ? `<div class="grp${it.open ? ' open' : ''}"><button class="grph" type="button" data-vgroup="${gi}" style="--gh:${it.gh}"><span class="gsw"></span>${esc(it.group)}${lCount(it.tabs.length)}${ic('chevron-down')}</button>${it.open ? it.tabs.map(row).join('') : ''}</div>` : row(it)).join('')}
        <button class="si" type="button" data-vnew>${ic('plus')}<span class="lab">New tab</span></button></div>
      ${pl ? media({ art: `${PH}life-suite-bg-sessions.webp`, title: 'Suno and AI.', from: 'simplyluma.com', at: 252, len: 760, playing: V.playing, jump: pl.id }) : ''}`;
    const web = $('#v-web'); web.className = 'scroll' + (pg.start ? ' start' : ''); web.innerHTML = webHTML(t.page); web.scrollTop = 0; vTuck(false, true);
    if (load) { const l = $('#v-load'); l.classList.remove('go'); void l.offsetWidth; l.classList.add('go'); }
    $('#w-viola .pop')?.remove();
    if (V.dl) $('#v-main').insertAdjacentHTML('beforeend', `<div class="pop dlpop"><div class="dlh"><h6>Downloads</h6><button class="lnk" type="button" data-vtodo="Opening Downloads in Filer">Show all</button></div>
      <div class="dlls">${vDownloads()}</div></div>`);
    if (V.dl) requestAnimationFrame(() => { const p = $('#w-viola .dlpop'), b = $('#v-nav [data-vdl]'), m = $('#v-main'); if (!p || !b) return; const mr = m.getBoundingClientRect(), br = b.getBoundingClientRect(); p.style.right = Math.max(12, mr.right - br.right - 40) + 'px'; });
    if (V.wsp) $('#w-viola').insertAdjacentHTML('beforeend', `<div class="pop wspop"><h6>Workspaces</h6>${Object.entries(V.spaces).map(([k, x]) => `<button class="mi" type="button" data-vspace="${k}"><i class="dot" style="margin:0;background:oklch(0.75 0.13 ${x.h})"></i><span><b>${x.name}</b><span class="sub">${allTabs(x).length} tabs</span></span>${k === V.space ? `<span class="end">${ic('check')}</span>` : ''}</button>`).join('')}<button class="mi" type="button">${ic('plus')}<span>New workspace</span></button></div>`);
    if (!web.dataset.tuck) { web.dataset.tuck = 1; let last = 0;
      web.addEventListener('scroll', () => { const y = web.scrollTop; if (y > 80 && y - last > 4) vTuck(true); else if (last - y > 4 || y < 80) vTuck(false); last = y; }, { passive: true });
      $('#v-main').addEventListener('mousemove', e => { const r = $('#v-main').getBoundingClientRect(); if (e.clientY > r.bottom - 60) vTuck(false); });
      $('#v-nub').addEventListener('click', () => vTuck(false)); }
  }
  /* Viola on a phone: no title bar, the page runs to the status bar. One bar at the bottom: Back, the address (tap to
     search), your tabs (the count, which replaces the sidebar), and ⋯. Tabs, search, downloads and share grow the bar. */
  const vNarrow = () => { const w = $('#w-viola'); return !!w?.clientWidth && w.clientWidth < 560; };
  function vBarPhone() { const bar = $('#v-nav'), X = V.px || '', sp = SP(), t = curTab(), pg = PAGE(t.page), h = V.hist[t.id] || [], n = allTabs(sp).length;
    bar.classList.add('phnofit', 'vphbar');
    const tile = (attr, icn, label, on) => `<button type="button" class="fvt${on ? ' on' : ''}" ${attr}>${ic(icn)}<span>${label}</span></button>`;
    const pins = [['home', FAV, 'Suno'], ['post:linux', FAV, 'Blog'], ['hub', FAV, 'Hub'], ['start', A + 'mail.svg', 'Mail']];
    const tabRow = x => { const p = PAGE(x.page); return `<div class="vtrow${x.id === sp.on ? ' on' : ''}"><button type="button" class="vtgo" data-vtab="${x.id}"><img src="${p.fav}" alt=""><span>${esc(p.title)}<small>${p.host || 'New tab'}</small></span>${x.audio ? ic('volume-2') : ''}</button><button class="ib" type="button" data-vclosetab="${x.id}" aria-label="Close tab" title="Close tab">${ic('x')}</button></div>`; };
    /* tabs as cards, each a live miniature of its page, the way phone browsers show them */
    const tabCard = x => { const p = PAGE(x.page); return `<div class="vtcard${x.id === sp.on ? ' on' : ''}"><button type="button" class="vtcgo" data-vtab="${x.id}" aria-label="${esc(p.title)}"><span class="vtch"><img src="${p.fav}" alt=""><b>${esc(p.title)}</b>${x.audio ? ic('volume-2') : ''}</span><span class="vtcp">${p.start ? `<span class="vtcstart"><img src="${A}browser.svg" alt=""><i>${ic('search')}Search or type an address</i></span>` : `<span class="vtcpi">${webHTML(x.page)}</span>`}</span></button><button class="vtcx" type="button" data-vclosetab="${x.id}" aria-label="Close tab">${ic('x')}</button></div>`; };
    const pl = allTabs(V.spaces.personal).find(x => x.audio);
    const panel = X === 'go' ? `<div class="fexp vgo2"><div class="fexh">Favorites</div><div class="vpins">${pins.map(([p, f, nm]) => `<button type="button" data-vopen="${p}"><span><img src="${f}" alt=""></span>${nm}</button>`).join('')}</div>
        <div class="fexh">Recent</div>${['post:free', 'post:open', 'hub'].map(k => { const p = PAGE(k); return `<button class="fexr2" type="button" data-vopen="${k}"><img class="vfav2" src="${p.fav}" alt=""><span>${esc(p.title)}<small>${p.host}${p.path}</small></span></button>`; }).join('')}</div>`
      : X === 'tabs' ? `<div class="fexp vtabs2"><div class="fexs">${Object.entries(V.spaces).map(([k, x]) => `<button type="button" class="fsch${k === V.space ? ' on' : ''}" data-vspace="${k}"><i class="dot" style="background:oklch(0.75 0.13 ${x.h})"></i>${x.name}<em>${allTabs(x).length}</em></button>`).join('')}</div>
        ${pl && V.space === 'personal' ? media({ art: `${PH}life-suite-bg-sessions.webp`, title: 'Suno and AI.', from: 'simplyluma.com', at: 252, len: 760, playing: V.playing, jump: pl.id }) : ''}
        <div class="vtcards">${sp.items.map(it => it.group ? `<div class="fexh vtgh"><i class="dot" style="background:oklch(0.75 0.13 ${it.gh})"></i>${esc(it.group)}</div>${it.tabs.map(tabCard).join('')}` : tabCard(it)).join('')}</div>
        <button class="bt pri vnewt" type="button" data-vnew>${ic('plus')}New tab</button></div>`
      : X === 'more' ? `<div class="fexp vmore2"><div class="fsha">${tile(`data-vfwd disabled`, 'chevron-right', 'Forward')}${tile('data-vreload', 'rotate-cw', 'Reload')}${tile('data-vpx="share"', 'share-2', 'Share')}${tile('data-vstar', 'star', V.star[t.page] ? 'Saved' : 'Bookmark', V.star[t.page])}</div>
        <button class="fexr2" type="button" data-vpx="dl">${ic('download')}<span>Downloads</span>${V.dlNew ? lCount(V.dlNew, true) : ''}${ic('chevron-right')}</button>${crMi('data-vtodo="Find in page"', 'search', 'Find in page')}${crMi('data-vtodo="Reader view: just the words"', 'book-open-text', 'Reader view')}${crMi('data-vtodo="New private tab: nothing you do here is kept"', 'eye-off', 'New private tab')}</div>`
      : X === 'dl' ? `<div class="fexp vdl2"><button class="fexr2 fback" type="button" data-vpx="more">${ic('chevron-left')}<span>Downloads</span></button><div class="dlls">${vDownloads()}</div></div>`
      : X === 'share' ? `<div class="fexp fshare2"><button class="fexr2 fback" type="button" data-vpx="more">${ic('chevron-left')}<span>Share this page</span></button><div class="fshp">${['PR', 'NF', 'SK', 'TH', 'MO'].map(k => `<button type="button" data-vtodo="Sent to ${esc(ppl(k).n.split(' ')[0])}">${av(k, 48)}<span>${esc(ppl(k).n.split(' ')[0])}</span></button>`).join('')}</div>
        <div class="fsha">${[['message-square', 'Messages', 'Opening Messages'], ['mail', 'Email', 'Opening a new email'], ['link', 'Copy link', 'Link copied'], ['radio-tower', 'Nearby', 'Looking for devices nearby']].map(([i, nm, m]) => `<button type="button" class="fvt" data-vtodo="${m}">${ic(i)}<span>${nm}</span></button>`).join('')}</div></div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, X === 'go'
      ? `${panel}<label class="srch keep">${ic('search')}<input value="${pg.start ? '' : esc(pg.host + pg.path)}" placeholder="Search or type an address" data-vgo aria-label="Address and search" spellcheck="false"></label><button class="ib" type="button" data-vpx="go" aria-label="Cancel" title="Cancel">${ic('x')}</button>`
      : `${panel}<button class="ib" type="button" data-vback aria-label="Back" title="Back" ${h.length ? '' : 'disabled'}>${ic('chevron-left')}</button><button class="vaddr2" type="button" data-vpx="go" aria-label="Address: ${esc(pg.host || 'new tab')}">${pg.start ? ic('search') : `<span class="lock">${ic('shield-check')}</span>`}<span>${pg.start ? 'Search or type an address' : esc(pg.host)}</span></button><button class="ib vtabsb${X === 'tabs' ? ' on' : ''}" type="button" data-vpx="tabs" aria-label="${n} tabs" title="Tabs" aria-expanded="${X === 'tabs'}"><span class="vtc">${n}</span></button><button class="ib${X === 'more' || X === 'dl' || X === 'share' ? ' on' : ''}" type="button" data-vpx="more" aria-label="More" title="More" aria-expanded="${X === 'more'}">${ic('ellipsis')}${V.dlNew && !X ? '<i class="vdot"></i>' : ''}</button>`);
    if (X === 'go') setTimeout(() => { const i = $('#v-nav [data-vgo]'); i?.focus(); i?.select(); }, 30); }
  /* Downloads are File cards (#13) in each state: downloading (speed, time left, pause, cancel), paused, done (Open wears the default
     app's icon; Show in Filer beside it), failed (the reason, Retry) and blocked (why, then a deliberate Delete or Keep) */
  function vDownloads() { const fx = (icon, label, attr) => `<button class="lfx" type="button" ${attr} title="${label}" aria-label="${label}">${ic(icon)}</button>`, iso = { n: 'suno-1.0-x86_64.iso', k: 'iso', sz: '2.1 of 3.1 GB' };
    return [lFile(iso, V.dlPause ? { sub: 'Paused', extra: '<span class="lprog paused"><i style="width:68%"></i></span>', act: fx('play', 'Resume', 'data-vdlpause') + fx('x', 'Stop download', 'data-vdlcancel') }
        : { sub: '24 MB/s · 38 s left', extra: '<span class="lprog"><i style="width:68%"></i></span>', act: fx('pause', 'Pause', 'data-vdlpause') + fx('x', 'Stop download', 'data-vdlcancel') }),
      lFile({ n: 'homepage-hero.webp', k: 'img', sz: '1.8 MB', src: PH + 'life-hero-writing.webp' }, { sub: 'Just now', act: fx('folder-open', 'Show in Filer', 'data-vtodo="Showing homepage-hero.webp in Filer"') + lOpenBtn('img', 'data-lui-open="viewer" data-lui-name="homepage-hero.webp"', 'Open', 'bt sm fill') }),
      lFile({ n: 'kiln-2.4.1.flatpakref', k: 'app', sz: '2 KB' }, { sub: '<span class="lfbad">Failed · no answer from the server</span>', act: `<button class="bt sm fill" type="button" data-vtodo="Trying kiln-2.4.1.flatpakref again">Retry</button>` }),
      lFile({ n: 'fonts-installer.sh', k: 'md', sz: '12 KB' }, { sub: '<span class="lfwarn">Blocked · unsafe script</span>', act: `<button class="bt sm fill" type="button" data-vtodo="Deleted fonts-installer.sh">Delete</button><button class="bt sm" type="button" data-vtodo="Kept fonts-installer.sh in Downloads">Keep</button>` })].join(''); }
  function vTuck(on, quiet) { const bar = $('#v-nav'), nub = $('#v-nub'); if (!bar || !nub || bar.classList.contains('tuck') === on) return;
    bar.classList.toggle('tuck', on);
    if (on) { nub.classList.remove('out'); nub.classList.add('on'); }
    else { nub.classList.remove('on'); if (!quiet) { nub.classList.add('out'); setTimeout(() => nub.classList.remove('out'), 300); } } }
  /* The media widget: one component for anything playing, wherever it appears (a sidebar, a shelf, a lock screen).
     Artwork, what and where from, a recessed track with times, and a round play key. */
  function media(m) { const mm = n => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
    return `<div class="media${m.playing ? '' : ' paused'}"><img src="${m.art}" alt=""><span class="tx" data-vjump="${m.jump}"><b>${esc(m.title)}</b><span><span class="eq"><i></i><i></i><i></i></span>${esc(m.from)}</span></span>
      <button class="mkey round" type="button" data-vplay aria-label="${m.playing ? 'Pause' : 'Play'}">${ic(m.playing ? 'pause' : 'play')}</button>
      <span class="mtrack"><i style="width:${(m.at / m.len * 100).toFixed(1)}%"></i></span><span class="mt l">${mm(m.at)}</span><span class="mt r">−${mm(m.len - m.at)}</span></div>`; }
  function vOpen(page) { V.px = ''; const t = curTab(); if (t.page !== page) { (V.hist[t.id] = V.hist[t.id] || []).push(t.page); t.page = page; } renderViola(true); }

  /* ══ Write ═════════════════════════════════════════════════════════════ */
  const DOC = `<h1>Interface Standard</h1><p class="subtitle">How Suno keeps one language across every application in the system.</p><h2>Why a standard at all</h2>
    <p>A design system earns its keep the moment a second application exists. The first application can be beautiful by taste alone; the second has to agree with the first, and the tenth has to agree <mark class="cm" data-cm="c0">without anyone re-reading the first</mark>.</p>
    <p>What follows is the short version of that agreement: the parts that are settled, the parts still under discussion, and the reasoning behind the decisions that surprised us.</p>
    <blockquote>A shared vocabulary, not a shared layout. Every app should be arranged around what it is for.</blockquote>
    <figure contenteditable="false"><img src="${PH}life-professionals-loft.webp" alt=""><figcaption>Photographed for the launch.</figcaption></figure>
    <h2>Materials</h2><p>There are five surfaces and nothing else: the window, the side, the raised surface that marks what you have chosen, the glass for the few things that float, and paper. A new surface is a design decision, not a styling one.</p>
    <h3>Choosing between them</h3><p>Glass is reserved for things that float over content, and it needs its <mark class="cm" data-cm="c1">text shadow to stay legible</mark> over a variable wallpaper; nothing else does, and adding one there is a mistake we have made twice.</p>
    <h2>Geometry</h2><p>Corners are concentric and a little square. Every radius is derived from the shape around it, and every corner is drawn as a superellipse rather than a circle.</p>
    <table><tr><th>Element</th><th>Radius</th><th>Why</th></tr><tr><td>Window</td><td>20</td><td>The outermost shape</td></tr><tr><td>Floating bar</td><td>16</td><td>Holds controls with 6 around them</td></tr><tr><td>Control</td><td>10</td><td>16 less the 6</td></tr></table>
    <h3>Spacing</h3><p>The ramp is rooted at four pixels and rises through eight, twelve, sixteen and twenty-four. Group with space first, a tonal surface second, a hairline third, and elevation only when a surface genuinely floats.</p>
    <h2>Open questions</h2><p>Two things remain unsettled. The first is whether a rail should ever carry more than eight places. The second is how far a document should be allowed to <mark class="cm" data-cm="c2">override a paragraph style</mark> before the override becomes a style of its own.</p>
    <p class="foot">Draft seven · circulated to the interface group</p>`;
  const PEOPLE = { PR: ['Priya Raman', 320], NF: ['Nora Feld', 45], NM: ['Nick', 250] };
  const CMS = [{ id: 'c0', who: 'NF', at: '10:31 AM', t: 'This line is the whole document. Could it be the subtitle?' }, { id: 'c1', who: 'PR', at: '9:12 AM', t: 'Worth stating the exact value here so nobody re-derives it.' },
    { id: 'c2', who: 'NF', at: 'Yesterday', t: 'Three overrides, then offer to save a style. Want me to write that up?' }];
  const W = { zoom: 'fit', z: 1, left: true, right: false, rtab: 'format', focus: false, cm: 'c0', find: '', fi: 0, fcount: 0, rep: false, ctx: 'text', tbl: null, img: null, blk: null, range: null, here: null, page: 'letter', margin: 'normal', menu: null, autoMin: false };
  const STY = [['h1', 'Title', 'p-h1'], ['h2', 'Heading', 'p-h2'], ['h3', 'Subheading', 'p-h3'], ['p', 'Body', 'p-p'], ['blockquote', 'Quote', 'p-q']];
  const WFONTS = [['Newsreader', 'var(--read)'], ['Figtree', 'var(--font)'], ['Georgia', 'Georgia, serif'], ['Mono', 'var(--mono, ui-monospace, monospace)']];
  const WPAGE = { letter: { n: 'Letter', d: '8.5 × 11 in', w: 816, h: 1056 }, a4: { n: 'A4', d: '210 × 297 mm', w: 794, h: 1123 }, legal: { n: 'Legal', d: '8.5 × 14 in', w: 816, h: 1344 } };
  const WMARG = { narrow: ['Narrow', '48px 48px 56px'], normal: ['Normal', '88px 96px 96px'], wide: ['Wide', '96px 144px 104px'] };
  const WCOL = [['Ink', '#1f2126'], ['Grey', '#6b6e75'], ['Blue', '#2f62c9'], ['Green', '#2f8a55'], ['Red', '#c8433a'], ['Amber', '#b7791f']];
  const WHL = [['Yellow', '#fde68a'], ['Green', '#bbf7d0'], ['Blue', '#bfdbfe'], ['Pink', '#fbcfe8'], ['Lilac', '#ddd6fe'], ['None', 'transparent']];
  const doc = () => $('#wr-doc'), wWords = s => (s.match(/\S+/g) || []).length;
  const blockAt = () => { const s = getSelection(); if (!s.rangeCount) return null; let n = s.anchorNode; const d = doc(); if (!d.contains(n)) return null; while (n && n.parentNode !== d) n = n.parentNode; return n && n.nodeType === 1 ? n : null; };
  const styleOf = b => !b || b.classList.contains('subtitle') ? 'p' : ({ H1: 'h1', H2: 'h2', H3: 'h3', BLOCKQUOTE: 'blockquote' }[b.tagName] || 'p');
  const qs = c => { try { return document.queryCommandState(c); } catch (e) { return false; } };
  const wHs = () => $$('h1,h2,h3', doc());
  const wSty = () => STY.find(x => x[0] === styleOf(W.blk)) || STY[3];
  function wCounts() { const t = doc().textContent, w = wWords(t), sh = $('#d-sheet'), h = sh.getBoundingClientRect().height / (W.z || 1);
    return { w, ch: t.replace(/\s/g, '').length, para: $$('p, li, blockquote', doc()).length, pages: Math.max(1, Math.ceil((h - 2) / WPAGE[W.page].h)), min: Math.max(1, Math.round(w / 230)) }; }
  function wFocus() { const d = doc(); d.focus({ preventScroll: true }); if (W.range) { const s = getSelection(); s.removeAllRanges(); s.addRange(W.range); } }
  function wMenu(a, key, html) { if ($('#lmenu') && W.menu === key) { $('#lmenu').remove(); W.menu = null; return; } lMenu(a, html); W.menu = key; }
  function writeTop() { $('#w-write').classList.toggle('wrph', wrNarrow()); if (wrNarrow()) return writeTopPhone(); const title = (doc().querySelector('h1')?.textContent || 'Untitled').trim(), n = CMS.filter(c => !c.draft).length;
    $('#d-top').innerHTML = `<img src="${A}documents.svg" alt=""><b>${esc(title)}</b><span class="sumeta">Write · Saved</span><span class="sutopr">
      <button class="ib${W.find ? ' on' : ''}" type="button" data-wfind title="Find" aria-label="Find">${ic('search')}</button>
      <button class="ib${W.right && W.rtab === 'format' && !W.focus ? ' on' : ''}" type="button" data-wfmt title="Format" aria-label="Format">${ic('paintbrush')}</button>
      <button class="ib wrcb${W.right && W.rtab === 'comments' && !W.focus ? ' on' : ''}" type="button" data-wcms title="Comments" aria-label="${n ? `Comments, ${n} open` : 'Comments'}">${ic('message-square')}${lCount(n, true)}</button>
      <button class="ib${W.focus ? ' on' : ''}" type="button" data-wfocus title="Focus" aria-label="Focus">${ic('scan-eye')}</button><span class="vr"></span>
      <span class="wravs" title="Priya and Nora are here">${av('PR', 26)}${av('NF', 26)}</span><button class="bt sm fill" type="button" data-share>${ic('share-2')}Share</button>
      <button class="ib" type="button" data-lmenu data-docmore title="More" aria-label="More">${ic('ellipsis')}</button></span>`; }
  function writeOut() { const el = $('#d-out'), open = W.left && !W.focus;
    el.className = 'supanel l' + (open ? '' : ' min') + (W.focus ? ' gone' : '');
    if (!open) { el.innerHTML = `<button class="supill" type="button" data-wleft>${ic('list')}<b>Outline</b><span>${wHs().length} headings</span></button>`; return; }
    el.innerHTML = `<header class="suph1"><b class="wrph">Outline</b><button class="ib" type="button" data-wleft title="Hide outline" aria-label="Hide outline">${ic('panel-left')}</button></header>
      <div class="wrfind"><label class="sufld">${ic('search')}<input id="d-fq" placeholder="Find" value="${esc(W.find)}" spellcheck="false" aria-label="Find in document"><em class="n"></em></label>
        <button class="ib sm" type="button" data-wfstep="-1" title="Previous" aria-label="Previous match">${ic('chevron-up')}</button><button class="ib sm" type="button" data-wfstep="1" title="Next" aria-label="Next match">${ic('chevron-down')}</button>
        <button class="ib sm${W.rep ? ' on' : ''}" type="button" data-wrep title="Replace" aria-label="Replace">${ic('replace')}</button></div>
      ${W.rep ? `<div class="wrfind"><label class="sufld"><input id="d-fr" placeholder="Replace with" spellcheck="false" aria-label="Replace with"></label><button class="bt sm" type="button" data-wrepone>Replace</button><button class="bt sm" type="button" data-wrepall>All</button></div>` : ''}
      <div class="suscroll wrout" id="d-outl"></div>`;
    writeOutRows(); const i = $('#d-fq'); i.oninput = () => { W.find = i.value; W.fi = 0; runFind(); $('#d-top [data-wfind]')?.classList.toggle('on', !!W.find); }; runFind(); }
  function writeOutRows() { const box = $('#d-outl'); if (!box) return; const hs = wHs();
    const wordsTo = (h, i) => { let n = 0, el = h.nextElementSibling; while (el && el !== hs[i + 1]) { n += wWords(el.textContent); el = el.nextElementSibling; } return n; };
    box.innerHTML = hs.map((h, i) => `<button class="sulyr wrh l${h.tagName[1]}${h === W.here ? ' on' : ''}" type="button" data-wgo="${i}" style="--d:${Math.max(0, +h.tagName[1] - 2)}"><span>${esc(h.textContent.trim() || 'Untitled')}</span>${h.tagName !== 'H1' ? lCount(wordsTo(h, i)).replace('<em', `<em title="${wordsTo(h, i)} words"`) : ''}</button>`).join(''); }
  const wSec = (t, body, add = '') => `<section class="susec"><header><b>${t}</b>${add}</header>${body}</section>`;
  const wFld = (k, label, v, unit = '') => `<label class="sufld"><span>${label}</span><input data-wprop="${k}" value="${v}" inputmode="decimal" aria-label="${label}">${unit ? `<em>${unit}</em>` : ''}</label>`;
  const wSw = (label, k, on) => `<button class="wrrow" type="button" data-wsw="${k}" role="switch" aria-checked="${on}"><span>${label}</span><i class="cfsw${on ? ' on' : ''}"></i></button>`;
  function wFmtText() { const b = W.blk && doc().contains(W.blk) ? W.blk : doc().querySelector('p:not(.subtitle)'), cs = getComputedStyle(b), st = wSty(), pt = px => Math.round(parseFloat(px) * .75 * 2) / 2;
    const fam = b.style.fontFamily ? (WFONTS.find(f => b.style.fontFamily.includes(f[0]) || f[1] === b.style.fontFamily)?.[0] || 'Newsreader') : /^H\d/.test(b.tagName) || b.classList.contains('subtitle') ? 'Figtree' : 'Newsreader';
    const lh = (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2).replace(/0$/, ''), al = cs.textAlign === 'start' ? 'left' : cs.textAlign;
    const tgl = (c, i, t) => `<button class="ib${qs(c) ? ' on' : ''}" type="button" data-wcmd="${c}" title="${t}" aria-label="${t}">${ic(i)}</button>`;
    return wSec('Style', `<button class="suselect" type="button" data-wstyles data-lmenu>${st[1]}${ic('chevron-down')}</button><div class="surow2"><button class="bt sm fill" type="button" data-wtodo="${st[1]} now matches this paragraph">Update ${st[1]}</button><button class="bt sm fill" type="button" data-wtodo="Saved as a new style">New style</button></div>`)
      + wSec('Font', `<button class="suselect" type="button" data-wfont data-lmenu>${fam}${ic('chevron-down')}</button><div class="sugrid2">${wFld('size', 'Size', pt(cs.fontSize), 'pt')}${wFld('line', 'Line', lh)}</div>
          <div class="wrgrp wrmt">${tgl('bold', 'bold', 'Bold')}${tgl('italic', 'italic', 'Italic')}${tgl('underline', 'underline', 'Underline')}${tgl('strikeThrough', 'strikethrough', 'Strikethrough')}<button class="ib" type="button" data-wlink title="Link" aria-label="Link">${ic('link')}</button></div>`)
      + wSec('Color', `<div class="wrsw2">${WCOL.map(([n, c]) => `<button type="button" style="--c:${c}" data-wcolor="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div><span class="wrlab">Highlight</span><div class="wrsw2">${WHL.map(([n, c]) => `<button type="button" class="${c === 'transparent' ? 'none' : ''}" style="--c:${c}" data-whlc="${c}" title="${n}" aria-label="Highlight ${n}"></button>`).join('')}</div>`)
      + wSec('Paragraph', `${seg([['left', ic('align-left'), 'Left'], ['center', ic('align-center'), 'Centre'], ['right', ic('align-right'), 'Right'], ['justify', ic('align-justify'), 'Justify']], al, 'data-walign', 'Alignment', 'ico')}
          <div class="sugrid2 wrmt">${wFld('before', 'Before', pt(cs.marginTop), 'pt')}${wFld('after', 'After', pt(cs.marginBottom), 'pt')}</div>
          <div class="wrgrp wrmt">${tgl('insertUnorderedList', 'list', 'Bulleted list')}${tgl('insertOrderedList', 'list-ordered', 'Numbered list')}<button class="ib" type="button" data-wcheck title="Checklist" aria-label="Checklist">${ic('list-checks')}</button>${tgl('outdent', 'indent-decrease', 'Decrease indent')}${tgl('indent', 'indent-increase', 'Increase indent')}</div>`)
      + wSec('Page', `<button class="suselect" type="button" data-wpage data-lmenu>${WPAGE[W.page].n} · ${WPAGE[W.page].d}${ic('chevron-down')}</button><button class="suselect" type="button" data-wmargin data-lmenu>Margins · ${WMARG[W.margin][0]}${ic('chevron-down')}</button>`); }
  function wFmtTable() { const t = W.tbl, rows = t.rows.length, cols = t.rows[0].cells.length, head = !!t.rows[0].querySelector('th');
    return wSec('Size', `<div class="sugrid2"><label class="sufld"><span>Rows</span><input value="${rows}" readonly aria-label="Rows"></label><label class="sufld"><span>Columns</span><input value="${cols}" readonly aria-label="Columns"></label></div>
        <div class="surow2 wrmt"><button class="bt sm fill" type="button" data-wtbl="row">${ic('between-horizontal-end')}Add row</button><button class="bt sm fill" type="button" data-wtbl="col">${ic('between-vertical-end')}Add column</button></div>
        <div class="surow2 wrmt"><button class="bt sm fill" type="button" data-wtbl="delrow">Delete row</button><button class="bt sm fill" type="button" data-wtbl="delcol">Delete column</button></div>`)
      + wSec('Style', wSw('Header row', 'head', head) + wSw('Banded rows', 'band', t.classList.contains('band')))
      + `<button class="bt sm wrdel" type="button" data-wtbl="del">${ic('trash-2')}Delete table</button>`; }
  const WIMGSZ = [['s', 'S', 'Small'], ['m', 'M', 'Medium'], ['l', 'L', 'Large'], ['full', 'Full', 'Full width']];
  function wFmtImage() { const f = W.img, img = f.querySelector('img');
    return `<div class="suimg wrimg" style="background-image:url(${img.src})"><button class="bt sm" type="button" data-wimg="replace">${ic('image')}Replace</button></div>`
      + wSec('Size', seg(WIMGSZ, f.dataset.sz || 'full', 'data-wimgsz', 'Size'))
      + wSec('Caption', wSw('Show caption', 'cap', !!f.querySelector('figcaption')))
      + wSec('Alt text', `<label class="sufld"><input data-walt value="${esc(img.alt || '')}" placeholder="Describe the photo" aria-label="Alt text"></label>`)
      + `<button class="bt sm wrdel" type="button" data-wimg="del">${ic('trash-2')}Delete photo</button>`; }
  function wComments() { const list = CMS.filter(c => doc().querySelector(`mark[data-cm="${c.id}"]`)); if (!list.length) return '<p class="wrnone">No open comments</p>';
    const who = (k, at) => `<div class="who">${av(k, 22)}<b>${k === 'me' ? 'You' : PPL[k].n.split(' ')[0]}</b><span>${at}</span></div>`;
    return list.map(c => { const m = doc().querySelector(`mark[data-cm="${c.id}"]`);
      return `<article class="wrcm${W.cm === c.id ? ' on' : ''}" data-wcm="${c.id}"><q>${esc(m.textContent)}</q>${who(c.who, c.at)}
        ${c.draft ? `<textarea data-wdraft="${c.id}" placeholder="Add a comment" aria-label="Comment"></textarea><div class="acts" style="display:flex"><button class="bt sm key" type="button" data-wpost="${c.id}">Comment</button><button class="bt sm" type="button" data-wresolve="${c.id}">Cancel</button></div>`
          : `<p>${esc(c.t)}</p>${(c.re || []).map(r => `<div class="re">${who(r.who, r.at)}<p>${esc(r.t)}</p></div>`).join('')}
            ${c.replying ? `<textarea data-wreplyt="${c.id}" placeholder="Reply" aria-label="Reply"></textarea><div class="acts"><button class="bt sm key" type="button" data-wrepost="${c.id}">Reply</button><button class="bt sm" type="button" data-wreply="${c.id}">Cancel</button></div>`
            : `<div class="acts"><button class="bt sm" type="button" data-wreply="${c.id}">${ic('reply')}Reply</button><button class="bt sm" type="button" data-wresolve="${c.id}">${ic('check')}Resolve</button></div>`}`}</article>`; }).join(''); }
  function writeInsp() { const el = $('#d-insp'), open = W.right && !W.focus, n = CMS.filter(c => !c.draft).length;
    el.className = 'supanel r' + (open ? '' : ' min') + (W.focus ? ' gone' : '');
    if (!open) { el.innerHTML = ''; return; }   // folded, the inspector is its two title-bar toggles (Format, Comments)
    const ctx = W.ctx === 'table' ? ['table', 'Table'] : W.ctx === 'image' ? ['image', 'Photo'] : ['pilcrow', wSty()[1]];
    const keep = $('#d-inspb')?.scrollTop || 0;
    el.innerHTML = `<header class="suinsph">${ic(ctx[0])}<b class="wrctx">${ctx[1]}</b><button class="ib" type="button" data-wright title="Hide inspector" aria-label="Hide inspector">${ic($('#w-write').classList.contains('phone') ? 'x' : 'panel-right')}</button></header>
      ${seg([['format', 'Format'], ['comments', `Comments${lCount(n)}`]], W.rtab, 'data-wrtab', 'Inspector', 'sutabs')}
      <div class="suscroll" id="d-inspb">${W.rtab === 'comments' ? wComments() : W.ctx === 'table' && W.tbl ? wFmtTable() : W.ctx === 'image' && W.img ? wFmtImage() : wFmtText()}</div>`;
    $('#d-inspb').scrollTop = keep; requestAnimationFrame(segs); }
  /* Write on a phone: a document, reflowed to the screen (no paper to zoom), the way phone word processors work. Top:
     ‹ Documents, and who's in the document. One bar: Aa (style and formatting), Insert, Comments (with the count),
     Share, ⋯ (outline to jump through, find, counts, focus). Tables and photos turn the bar into their own actions. */
  const wrNarrow = () => { const w = $('#w-write'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };
  function writeBarPhone(bar) { const X = W.px || '', n = CMS.filter(c => !c.draft).length, ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`, on = c => qs(c);
    bar.classList.add('phnofit', 'wrphbar'); bar.onmousedown = e => { if (!e.target.closest('input, textarea')) e.preventDefault(); };
    if (W.ctx === 'table' && W.tbl) { bar.classList.remove('phgrow'); setBar(bar, `${ib('data-wtbl="row"', 'between-horizontal-end', 'Add row')}${ib('data-wtbl="col"', 'between-vertical-end', 'Add column')}${ib('data-wsw="head"', 'heading', 'Header row')}${ib('data-wtbl="delrow"', 'trash-2', 'Delete row')}<button class="bt pri wrdone" type="button" data-wdone>Done</button>`); return; }
    if (W.ctx === 'image' && W.img) { const sz = W.img.dataset.sz || 'full'; const panel = X === 'isz' ? `<div class="fexp"><div class="fexh">Size</div><div class="fexs">${WIMGSZ.map(([k, nm]) => `<button type="button" class="fsch${sz === k ? ' on' : ''}" data-wimgsz="${k}">${nm}</button>`).join('')}</div></div>` : '';
      bar.classList.toggle('phgrow', !!panel); setBar(bar, `${panel}${ib('data-wpx="isz"', 'scaling', 'Size', X === 'isz')}${ib('data-wsw="cap"', 'captions', 'Caption')}${ib('data-wimg="replace"', 'image', 'Replace')}${ib('data-wimg="del"', 'trash-2', 'Delete photo')}<button class="bt pri wrdone" type="button" data-wdone>Done</button>`); return; }
    const cur = styleOf(W.blk), hs = wHs();
    const panel = X === 'fmt' ? `<div class="fexp wrfmt"><div class="fexs">${STY.map(([k, nm, c]) => `<button type="button" class="fsch ${c}${cur === k ? ' on' : ''}" data-wblock="${k}">${nm}</button>`).join('')}</div>
        <div class="wrfrow">${[['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline'], ['strikeThrough', 'strikethrough']].map(([k, i]) => `<button type="button" class="${on(k) ? 'on' : ''}" data-wcmd="${k}" aria-label="${k}">${ic(i)}</button>`).join('')}<button type="button" data-wlink aria-label="Link">${ic('link')}</button></div>
        <div class="wrfrow">${[['insertUnorderedList', 'list'], ['insertOrderedList', 'list-ordered']].map(([k, i]) => `<button type="button" class="${on(k) ? 'on' : ''}" data-wcmd="${k}" aria-label="${k}">${ic(i)}</button>`).join('')}${[['left', 'align-left'], ['center', 'align-center'], ['right', 'align-right']].map(([k, i]) => `<button type="button" data-walign="${k}" aria-label="Align ${k}">${ic(i)}</button>`).join('')}</div>
        <div class="fexh">Highlight</div><div class="wrhl">${WHL.map(([nm, c]) => `<button type="button" data-whlc="${c}" aria-label="${nm}" style="--hc:${c}"></button>`).join('')}</div></div>`
      : X === 'ins' ? `<div class="fexp"><div class="fsha c3">${[['image', 'image', 'Photo'], ['table', 'table', 'Table'], ['check', 'list-checks', 'Checklist'], ['quote', 'text-quote', 'Quote'], ['rule', 'minus', 'Divider']].map(([k, i, nm]) => `<button type="button" class="fvt" data-wins="${k}">${ic(i)}<span>${nm}</span></button>`).join('')}<button type="button" class="fvt" data-wcomment>${ic('message-square-plus')}<span>Comment</span></button></div></div>`
      : X === 'cms' ? `<div class="fexp wrcms">${wComments()}</div>`
      : X === 'share' ? `<div class="fexp fshare2"><div class="fexh">In this document</div>${['PR', 'NF'].map(k => `<div class="wrwho">${av(k, 36)}<span><b>${esc(ppl(k).n)}</b><small>${k === 'PR' ? 'Here now · can edit' : 'Can comment'}</small></span></div>`).join('')}<div class="fsha c2">${[['link', 'Copy link', 'Link copied'], ['send', 'Send a copy', 'Choose who to send it to']].map(([i, nm, t]) => `<button type="button" class="fvt" data-wtodo="${t}">${ic(i)}<span>${nm}</span></button>`).join('')}</div></div>`
      : X === 'more' ? (() => { const c = wCounts(); return `<div class="fexp fmore2 wrmore"><label class="cfield">${ic('search')}<input data-wfq2 placeholder="Find in document" value="${esc(W.find)}" aria-label="Find in document"></label>
          <div class="fexh">Outline</div>${hs.map((h, i) => `<button class="fexr2 wrol l${h.tagName[1]}" type="button" data-wgo="${i}"><span>${esc(h.textContent)}</span></button>`).join('') || '<p class="wrnone">No headings yet</p>'}
          <div class="fexh">This document</div><div class="wrcount"><span><b>${c.w.toLocaleString()}</b>words</span><span><b>${c.pages}</b>pages</span><span><b>${Math.max(1, Math.round(c.w / 230))} min</b>to read</span></div>
          <button class="fexr2" type="button" data-wfocus>${ic('scan-eye')}<span>Focus</span></button><button class="fexr2" type="button" data-wtodo="Saved a PDF to Documents">${ic('download')}<span>Export as PDF</span></button></div>`; })() : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, `${panel}${ib('data-wpx="fmt"', 'type', 'Style and format', X === 'fmt')}${ib('data-wpx="ins"', 'plus', 'Insert', X === 'ins')}<button class="ib wrcb${X === 'cms' ? ' on' : ''}" type="button" data-wpx="cms" aria-label="Comments${n ? ', ' + n : ''}" title="Comments">${ic('message-square')}${n ? `<em>${n}</em>` : ''}</button>${ib('data-wpx="share"', 'share-2', 'Share', X === 'share')}${ib('data-wpx="more"', 'ellipsis', 'More', X === 'more')}`);
    const fq = $('#d-bar [data-wfq2]'); if (fq) fq.oninput = () => { W.find = fq.value; W.fi = 0; runFind(); }; }
  function writeTopPhone() { const title = (doc().querySelector('h1')?.textContent || 'Untitled').trim();
    $('#d-top').innerHTML = `<button class="wrback" type="button" data-wtodo="Opening Documents in Filer">${ic('chevron-left')}<span>Documents</span></button><span class="wrtt"></span><button class="wravs2" type="button" data-wpx="share" aria-label="Priya and Nora are here">${av('PR', 30)}${av('NF', 30)}</button>`; }
  function writeBar() { const bar = $('#d-bar');
    if (wrNarrow()) return writeBarPhone(bar); bar.classList.remove('phnofit', 'wrphbar', 'phgrow'); bar.onmousedown = null;
    if (W.ctx === 'table' && W.tbl) { setBar(bar, `<span class="ctxc">${ic('table')}Table</span><button class="bt" type="button" data-wtbl="row">${ic('between-horizontal-end')}Row</button><button class="bt" type="button" data-wtbl="col">${ic('between-vertical-end')}Column</button><span class="vr"></span><button class="ib wrred" type="button" data-wtbl="delrow" title="Delete row" aria-label="Delete row">${ic('trash-2')}</button><span class="vr"></span><button class="bt fill" type="button" data-wdone>Done</button>`); return; }
    if (W.ctx === 'image' && W.img) { setBar(bar, `<span class="ctxc">${ic('image')}Photo</span>${seg(WIMGSZ, W.img.dataset.sz || 'full', 'data-wimgsz', 'Size')}<span class="vr"></span><button class="bt" type="button" data-wsw="cap">${ic('captions')}Caption</button><button class="bt wide" type="button" data-wimg="replace">${ic('image')}Replace</button><span class="vr"></span><button class="ib wrred" type="button" data-wimg="del" title="Delete photo" aria-label="Delete photo">${ic('trash-2')}</button><span class="vr"></span><button class="bt fill" type="button" data-wdone>Done</button>`); return; }
    const on = c => qs(c) ? ' on' : '', al = W.blk ? getComputedStyle(W.blk).textAlign : 'left', ali = { center: 'align-center', right: 'align-right', justify: 'align-justify' }[al] || 'align-left';
    setBar(bar, `<button class="ib wide" type="button" data-wcmd="undo" title="Undo" aria-label="Undo">${ic('undo')}</button><button class="ib wide" type="button" data-wcmd="redo" title="Redo" aria-label="Redo">${ic('redo')}</button><span class="vr wide"></span>
      <button class="bt stylebtn wrsty" type="button" data-wstyles data-lmenu>${wSty()[1]}${ic('chevron-down')}</button><span class="vr"></span>
      <span class="wrgrp" role="group" aria-label="Character"><button class="ib${on('bold')}" type="button" data-wcmd="bold" title="Bold" aria-label="Bold">${ic('bold')}</button><button class="ib${on('italic')}" type="button" data-wcmd="italic" title="Italic" aria-label="Italic">${ic('italic')}</button><button class="ib${on('underline')}" type="button" data-wcmd="underline" title="Underline" aria-label="Underline">${ic('underline')}</button></span>
      <button class="ib wide" type="button" data-whl data-lmenu title="Highlight" aria-label="Highlight">${ic('highlighter')}</button><button class="ib wide" type="button" data-wlink title="Link" aria-label="Link">${ic('link')}</button><span class="vr"></span>
      <span class="wrgrp" role="group" aria-label="Lists"><button class="ib${on('insertUnorderedList')}" type="button" data-wcmd="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list">${ic('list')}</button><button class="ib${on('insertOrderedList')}" type="button" data-wcmd="insertOrderedList" title="Numbered list" aria-label="Numbered list">${ic('list-ordered')}</button></span><button class="ib wide" type="button" data-walignm data-lmenu title="Alignment" aria-label="Alignment">${ic(ali)}</button><span class="vr"></span>
      <button class="ib" type="button" data-winsert data-lmenu title="Insert" aria-label="Insert">${ic('plus')}</button><button class="bt" type="button" data-wcomment>${ic('message-square')}Comment</button>`); }
  function writeStat() { const st = $('#d-stat'); if (!st || !$('#d-main').offsetWidth) return; const c = wCounts(), d = $('#d-desk'), s = getSelection(), sw = s.rangeCount && !s.isCollapsed && doc().contains(s.anchorNode) ? wWords(s.toString()) : 0;
    const cur = Math.min(c.pages, Math.floor((d.scrollTop + d.clientHeight * .35) / (WPAGE[W.page].h * W.z)) + 1);
    st.innerHTML = `${ic('file-text')}<b>Page ${cur} of ${c.pages}</b><span>${sw ? `${sw} of ${c.w.toLocaleString()} words` : `${c.w.toLocaleString()} words`}</span>`;
    $('#d-zoom').innerHTML = `${Math.round(W.z * 100)}%${ic('chevron-down')}`; }
  function writeFit() { const w = $('#w-write'), m = $('#d-main'); if (!m.offsetWidth) return; const phone = w.classList.contains('phone'), narrow = m.clientWidth < 940;
    if (narrow !== W.autoMin) { W.autoMin = narrow; if (narrow) { W.keep = [W.left, W.right]; W.left = W.right = false; } else if (W.keep) { [W.left, W.right] = W.keep; } writeOut(); writeInsp(); writeTop(); }   // narrow windows fold the panels to pills, and give them back when there's room
    w.classList.toggle('focusmode', W.focus);
    if (wrNarrow()) { const sh = $('#d-sheet'); W.z = 1; sh.style.zoom = 1; sh.style.width = ''; sh.style.minHeight = ''; sh.style.padding = ''; if (!w.classList.contains('wrph')) { writeTop(); writeBar(); } return; }
    if (w.classList.contains('wrph')) { w.classList.remove('wrph'); writeTop(); writeBar(); }
    const pl = W.left && !W.focus && !phone ? 272 : 24, pr = W.right && !W.focus && !phone ? 296 : 24, pg = WPAGE[W.page], d = $('#d-desk'), sh = $('#d-sheet');
    d.style.setProperty('--pl', pl + 'px'); d.style.setProperty('--pr', pr + 'px'); sh.style.width = pg.w + 'px'; sh.style.minHeight = pg.h + 'px'; sh.style.padding = WMARG[W.margin][1];
    W.z = W.zoom === 'fit' ? Math.max(.5, Math.min(1, (m.clientWidth - pl - pr) / pg.w)) : W.zoom; sh.style.zoom = W.z; writeStat(); }
  function renderWrite() { writeTop(); writeOut(); writeInsp(); writeBar(); writeFit(); }
  function trackHere() { const b = blockAt(); $$('.here', doc()).forEach(x => x.classList.remove('here')); if (b) b.classList.add('here');
    const hs = wHs(); let cur = hs[0]; if (b) for (const h of hs) { if (h === b || h.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) cur = h; } W.here = cur; }
  function wSetCtx(ctx) { W.ctx = ctx; $$('#wr-doc table.on').forEach(t => t.classList.toggle('on', ctx === 'table' && t === W.tbl)); if (ctx === 'table' && W.tbl) W.tbl.classList.add('on');
    $$('#wr-doc figure.picked').forEach(f => f.classList.toggle('picked', ctx === 'image' && f === W.img)); if (ctx === 'image' && W.img) W.img.classList.add('picked'); if (ctx !== 'text' && W.rtab === 'comments') W.rtab = 'format'; }
  function wSel() { const s = getSelection(); if (!s.rangeCount || !doc().contains(s.anchorNode)) { $('#d-sel').classList.remove('show'); return; }
    if (W.ctx === 'image' && Date.now() - (W.pickT || 0) < 500) return;
    W.range = s.getRangeAt(0).cloneRange(); W.blk = blockAt(); trackHere();
    const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement, t = n.closest('#wr-doc table');
    if (t) W.tbl = t; wSetCtx(t ? 'table' : 'text'); writeBar(); writeOutRows(); selBar(); writeStat(); if (W.rtab === 'format' || W.ctx !== 'text') writeInsp(); }
  function runFind() { const s = (W.find || '').trim().toLowerCase(), ranges = [];
    if (s && window.CSS && CSS.highlights) { const tw = document.createTreeWalker(doc(), NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const v = n.nodeValue.toLowerCase(); let i = v.indexOf(s); while (i > -1) { const r = new Range(); r.setStart(n, i); r.setEnd(n, i + s.length); ranges.push(r); i = v.indexOf(s, i + s.length); } } }
    if (window.CSS && CSS.highlights) { CSS.highlights.delete('wr-find'); CSS.highlights.delete('wr-find-cur'); if (ranges.length) { W.fi = Math.min(W.fi, ranges.length - 1); CSS.highlights.set('wr-find', new Highlight(...ranges)); CSS.highlights.set('wr-find-cur', new Highlight(ranges[W.fi])); } }
    W.fcount = ranges.length; W.franges = ranges; const el = $('#d-out .wrfind .n'); if (el) el.textContent = s ? (ranges.length ? `${W.fi + 1} of ${ranges.length}` : 'None') : ''; }
  function wFindGo() { const r = W.franges?.[W.fi], d = $('#d-desk'); if (!r) return; const rb = r.getBoundingClientRect(), db = d.getBoundingClientRect(); if (rb.top < db.top + 60 || rb.bottom > db.bottom - 110) d.scrollTo({ top: d.scrollTop + rb.top - db.top - db.height * .35, behavior: 'smooth' }); }
  function openFind() { W.left = true; writeOut(); writeFit(); const i = $('#d-fq'); i.focus(); i.select(); }
  function closeFind() { if (!W.find) return; W.find = ''; if (window.CSS && CSS.highlights) { CSS.highlights.delete('wr-find'); CSS.highlights.delete('wr-find-cur'); } const i = $('#d-fq'); if (i) i.value = ''; runFind(); $('#d-top [data-wfind]')?.classList.remove('on'); }
  function selBar() { const bar = $('#d-sel'), s = getSelection();
    if (!s.rangeCount || s.isCollapsed || !doc().contains(s.anchorNode) || W.focus || W.ctx !== 'text') { bar.classList.remove('show'); return; }
    const r = s.getRangeAt(0).getBoundingClientRect(), mr = $('#d-main').getBoundingClientRect(), n = wWords(s.toString());
    bar.innerHTML = `<button class="ib${qs('bold') ? ' on' : ''}" type="button" data-wcmd="bold" title="Bold · Ctrl+B" aria-label="Bold">${ic('bold')}</button><button class="ib${qs('italic') ? ' on' : ''}" type="button" data-wcmd="italic" title="Italic · Ctrl+I" aria-label="Italic">${ic('italic')}</button><button class="ib" type="button" data-whlc="#fde68a" title="Highlight" aria-label="Highlight">${ic('highlighter')}</button><button class="ib" type="button" data-wlink title="Link" aria-label="Link">${ic('link')}</button><span class="vr"></span><button class="bt" type="button" data-wcomment>${ic('message-square')}Comment</button><span class="wrsel">${n} ${n === 1 ? 'word' : 'words'}</span>`;
    lBubble(bar, $('#d-main'), r); }
  function addComment() { const s = getSelection(); if (!s.rangeCount || s.isCollapsed || !doc().contains(s.anchorNode)) { lToast($('#w-write'), 'Select the words to comment on'); return; }
    const id = 'c' + Date.now(), m = document.createElement('mark'); m.className = 'cm'; m.dataset.cm = id; try { s.getRangeAt(0).surroundContents(m); } catch (e) { lToast($('#w-write'), 'Comment on words within one paragraph'); return; }
    CMS.push({ id, who: 'me', at: 'Now', t: '', draft: true }); W.cm = id; W.right = true; W.rtab = 'comments'; s.removeAllRanges(); $('#d-sel').classList.remove('show'); renderWrite(); wMarks(); setTimeout(() => $(`[data-wdraft="${id}"]`)?.focus(), 60); }
  function wMarks() { $$('mark.cm', doc()).forEach(m => m.classList.toggle('on', m.dataset.cm === W.cm)); }
  function wToCm(id) { const m = doc().querySelector(`mark[data-cm="${id}"]`), d = $('#d-desk'); if (!m) return; const rb = m.getBoundingClientRect(), db = d.getBoundingClientRect(); if (rb.top < db.top + 40 || rb.bottom > db.bottom - 110) d.scrollTo({ top: d.scrollTop + rb.top - db.top - db.height * .3, behavior: 'smooth' }); }
  function wTbl(k) { const t = W.tbl; if (!t) return; const s = getSelection(), n = s.anchorNode ? (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) : null, cell = n?.closest('td,th'), ri = cell ? cell.parentElement.rowIndex : t.rows.length - 1, ci = cell ? cell.cellIndex : t.rows[0].cells.length - 1;
    if (k === 'row') { const r = t.insertRow(ri + 1); [...t.rows[0].cells].forEach(() => { const c = r.insertCell(); c.innerHTML = '&nbsp;'; }); }
    else if (k === 'col') [...t.rows].forEach((r, i) => { const c = document.createElement(i === 0 && r.querySelector('th') ? 'th' : 'td'); c.innerHTML = i === 0 && r.querySelector('th') ? 'Column' : '&nbsp;'; r.insertBefore(c, r.cells[ci + 1] || null); });
    else if (k === 'delrow') { if (t.rows.length > 1) t.deleteRow(ri); else { wTbl('del'); return; } }
    else if (k === 'delcol') { if (t.rows[0].cells.length > 1) [...t.rows].forEach(r => r.deleteCell(Math.min(ci, r.cells.length - 1))); else { wTbl('del'); return; } }
    else if (k === 'del') { const at = [t.parentNode, t.nextSibling]; t.remove(); W.tbl = null; wSetCtx('text'); lToast($('#w-write'), 'Table deleted', { icon: 'trash-2', undo: () => { at[0].insertBefore(t, at[1]); writeOutRows(); writeStat(); } }); }
    writeBar(); writeInsp(); writeOutRows(); writeStat(); }
  function wSwitch(k) { if (k === 'head' && W.tbl) { const r = W.tbl.rows[0], th = !!r.querySelector('th'); [...r.cells].forEach(c => { const n = document.createElement(th ? 'td' : 'th'); n.innerHTML = c.innerHTML; c.replaceWith(n); }); }
    else if (k === 'band' && W.tbl) W.tbl.classList.toggle('band');
    else if (k === 'cap' && W.img) { const fc = W.img.querySelector('figcaption'); if (fc) fc.remove(); else W.img.insertAdjacentHTML('beforeend', '<figcaption contenteditable="true">Caption</figcaption>'); }
    writeInsp(); writeBar(); }
  function wImg(k) { const f = W.img; if (!f) return;
    if (k === 'del') { const at = [f.parentNode, f.nextSibling]; f.classList.remove('picked'); f.remove(); W.img = null; wSetCtx('text'); lToast($('#w-write'), 'Photo deleted', { icon: 'trash-2', undo: () => at[0].insertBefore(f, at[1]) }); writeBar(); writeInsp(); return; }
    if (k === 'replace') { const pics = ['life-professionals-loft', 'life-hero-writing', 'life-sync-terrace', 'life-suite-bg-write'], img = f.querySelector('img'), cur = pics.findIndex(p => img.src.includes(p)); img.src = `${PH}${pics[(cur + 1) % pics.length]}.webp`; writeInsp(); } }
