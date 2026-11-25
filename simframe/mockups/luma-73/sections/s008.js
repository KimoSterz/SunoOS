  const mdTrash = () => { MD.barAsk = false; MD.sel = 99; mdHost(); lToast($('#w-modal'), '3 items moved to Trash', { icon: 'trash-2', undo: () => { MD.sel = 3; mdHost(); } }); };
  const MD = { open: null, choice: 0, extra: true, sel: 3, barAsk: false };
  function mdHost() { $('#md-body').innerHTML = `<div class="mddoc"><p class="mdeye">Documents › Launch</p><h1>Launch notes</h1>
      <p>Priya opens with the milestones slide, then the live demo. Keep the demo under two minutes and start with Filer, because everyone gets it instantly.</p>
      <p>Then Messages, then the shelf. The notification lip is the moment people will remember.</p>
      <div class="mdfiles">${['Walkthrough script.md', 'Press note.docx', 'Homepage crop.png', 'Old outline.md', 'Old outline 2.md', 'Scratch.txt'].slice(0, MD.sel === 99 ? 3 : 6).map((n, i) => `<button type="button" class="mdf${i >= MD.sel ? ' on' : ''}">${ic(n.endsWith('.png') ? 'image' : 'file-text')}${n}</button>`).join('')}</div>
      <p class="mdhint">Try any way Luma asks from the menu next to the title.</p></div>`; mdBar(); }
  function mdBar() { const bar = $('#md-bar');
    setBar(bar, MD.barAsk ? `<span class="mdq">Delete 3 items?</span><button class="bt" type="button" data-mdbarno>Cancel</button><button class="bt danger" type="button" data-mdbaryes>${ic('trash-2')}Delete</button>`
      : MD.sel === 99 ? `<button class="bt" type="button" data-mdtodo="Choose files to share">${ic('share-2')}Share</button>` : `<span class="ctxc mdctx">${ic('file-text')}3 selected</span><button class="bt" type="button" data-mdopen="rename">${ic('pencil')}Rename</button><button class="bt" type="button" data-mdtodo="Share opens">${ic('share-2')}Share</button><span class="vr"></span><button class="ib" type="button" data-mdbarask title="Delete">${ic('trash-2')}</button>`); }
  function mdShow(k) { MD.open = k; MD.choice = 0; MD.extra = true; const m = MDK[k], w = $('#w-modal'), sh = $('#md-sheet');
    w.classList.toggle('mdon', !m.sys); document.documentElement.classList.toggle('mdsys', !!m.sys);
    if (m.sys) { document.body.append($('#md-sysscrim'), sh); } else if (sh.parentElement !== w) { w.append(sh); document.body.append($('#md-sysscrim')); }
    sh.className = 'mdsheet' + (m.sys ? ' sys iwin' : ''); sh.innerHTML = `${m.sys ? `<span class="mdico">${ic(m.icon)}</span>` : ''}<h2 id="md-t">${m.t}</h2>${m.p ? `<p>${m.p}</p>` : ''}
      ${m.field ? `<label class="mdfield"><input data-mdfield value="${esc(m.field)}" spellcheck="false" aria-labelledby="md-t"></label>` : ''}
      ${m.choices ? `<div class="mdchoices" role="radiogroup">${m.choices.map((c, i) => `<button type="button" role="radio" aria-checked="${i === MD.choice}" class="${i === MD.choice ? 'on' : ''}" data-mdchoice="${i}"><i></i>${c}</button>`).join('')}</div>` : ''}
      ${m.extra ? `<button type="button" class="mdcheck${MD.extra ? ' on' : ''}" data-mdextra><i>${ic('check')}</i>${m.extra[0]}</button>` : ''}
      <div class="mdact">${m.left ? `<button class="bt quiet${k === 'save' ? ' red' : ''}" type="button" data-mdleft>${m.left[0]}</button>` : ''}<span></span>${m.cancel || m.cancelLabel ? `<button class="bt fill" type="button" data-mdno>${m.cancelLabel || 'Cancel'}</button>` : ''}<button class="bt ${m.key[2] || 'key'}" type="button" data-mdyes>${m.key[0]}</button></div>`;
    void sh.offsetWidth; sh.classList.add('show');
    sh.setAttribute('role', m.sys ? 'alertdialog' : 'dialog'); sh.setAttribute('aria-labelledby', 'md-t');
    requestAnimationFrame(() => { const f = sh.querySelector('[data-mdfield]'); if (f) { f.focus({ preventScroll: true }); const d = f.value.lastIndexOf('.'); f.setSelectionRange(0, d > 0 ? d : f.value.length); } else sh.querySelector('[data-mdyes]')?.focus({ preventScroll: true }); }); }
  function mdSheetClick(e) { const b = e.target.closest('button'); if (!b || !MD.open) return; const m = MDK[MD.open]; e.stopPropagation();
    if (b.matches('[data-mdyes]')) { const v = m.field ? $('[data-mdfield]').value.trim() : ''; mdClose(m.field ? `Renamed to “${v}”` : m.key[1] + (MD.open === 'report' && MD.extra ? ' and blocked' : '')); }
    else if (b.matches('[data-mdno]')) mdClose();
    else if (b.matches('[data-mdleft]')) mdClose(m.left[1]);
    else if (b.matches('[data-mdchoice]')) { MD.choice = +b.dataset.mdchoice; $$('#md-sheet [data-mdchoice]').forEach((x, i) => { x.classList.toggle('on', i === MD.choice); x.setAttribute('aria-checked', i === MD.choice); }); }
    else if (b.matches('[data-mdextra]')) { MD.extra = !MD.extra; b.classList.toggle('on', MD.extra); } }
  function mdNudge() { $('#md-sheet').animate([{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '0' }], { duration: 260 }); }   // a sheet waits for an answer; a click behind it nudges it
  function mdClose(msg) { MD.open = null; $('#w-modal').classList.remove('mdon'); document.documentElement.classList.remove('mdsys'); const sh = $('#md-sheet'); sh.className = 'mdsheet'; if (sh.parentElement !== $('#w-modal')) setTimeout(() => { if (!MD.open) $('#w-modal').append(sh); }, 250); if (msg) mdToast(msg); }
  const mdToast = msg => lToast($('#w-modal'), msg, { icon: /Trash|Deleted/.test(msg) ? 'trash-2' : 'check' });   // the LumaUI toast
  function mdPop(anchor, html) { $('#md-pop')?.remove(); const w = $('#w-modal'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop ldrawer" id="md-pop">${html}</div>`); const p = $('#md-pop'); p.style.left = Math.max(8, r.left - wr.left - 20) + 'px'; p.style.top = (r.bottom - wr.top + 6) + 'px'; }
  function mdClick(e, hit) { const q = s => hit(s);
    if (q('.mdmenu')) return true;   // the menu opened on pointer-down; its own click must not close it
    if (!q('#md-pop')) $('#md-pop')?.remove();
    const pick = q('[data-mdpick]'); if (pick) { $('#md-pop')?.remove(); const k = pick.dataset.mdpick; if (MD.open) mdClose(); if (k === 'bar') mdTrash(); else if (k === 'purge') lConfirm($('#w-modal'), { title: MDK.purge.t, body: MDK.purge.p, action: 'Delete for good', icon: 'trash-2', onOK: () => mdToast('Deleted') }); else mdShow(k); return true; }
    if (MD.open) { if (!q('#md-sheet') && !q('.tbar')) mdNudge(); return true; }
    if (q('[data-mdbarask]')) { mdTrash(); return true; }
    if (q('[data-mdbarno]')) { MD.barAsk = false; mdBar(); return true; }
    if (q('[data-mdbaryes]')) { MD.barAsk = false; MD.sel = 99; mdHost(); mdToast('3 items moved to Trash'); return true; }
    const o = q('[data-mdopen]'); if (o) { mdShow(o.dataset.mdopen); return true; }
    const td = q('[data-mdtodo]'); if (td) { mdToast(td.dataset.mdtodo); return true; }
    return false; }
  function renderModal() { $('#md-sheet').addEventListener('click', mdSheetClick); $('#md-sysscrim').addEventListener('click', () => MD.open && mdNudge()); $('#md-top').innerHTML = `<img src="${A}documents.svg" alt=""><b>Write</b><button class="chev mdmenu" type="button" aria-label="Ways Luma asks">${ic('chevron-down')}</button>`; mdHost();
    $('#w-modal').addEventListener('pointerdown', e => { const m = e.target.closest('.mdmenu'); if (!m) return; e.stopPropagation(); e.preventDefault(); if ($('#md-pop')) { $('#md-pop').remove(); return; }
      let g = ''; mdPop(m, MDLIST.map(([k, grp, n]) => (grp !== g ? `${g ? '<span class="crsep"></span>' : ''}<h6>${(g = grp)}</h6>` : '') + crMi(`data-mdpick="${k}"`, '', n)).join('')); }, true); }
  document.addEventListener('keydown', e => { if (!MD.open) return; if (e.key === 'Escape') { e.preventDefault(); MDK[MD.open].cancel || MDK[MD.open].cancelLabel ? mdClose() : null; } else if (e.key === 'Enter' && !e.target.closest?.('[data-mdchoice]')) { e.preventDefault(); $('#md-sheet [data-mdyes]')?.click(); } }, true);

  /* ══ Calculator ═══════════════════════════════════════════════════════════════
     A screen set into a body. The island is the display: a paper tape of what you've worked out (tap a result
     to use it again), the sum you're typing, and its answer before you ask for it. The keys sit on the
     frame: digits are chips, operators carry the accent, = is the one key. Scientific opens a second
     bank of keys beside the first. */
  const CA = { t: [], tape: [], sci: false, second: false, deg: true, fresh: false, op: null };
  const CAOPS = { '+': 1, '−': 1, '×': 2, '÷': 2, 'mod': 2, '^': 4, 'root': 4, 'E': 5 };
  const CAFN = { sin: 'sin', cos: 'cos', tan: 'tan', asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹', ln: 'ln', log: 'log', log2: 'log₂', sqrt: '√', cbrt: '∛', exp: 'e^', p10: '10^', abs: 'abs' };
  const caLast = () => CA.t[CA.t.length - 1];
  const caEndsValue = () => { const l = caLast(); return l && (l.k === 'num' || l.k === 'const' || l.v === ')' || l.k === 'post'); };

  /* Parsing: + − × ÷ mod, ^ and ʸ√ (right to left), EE, unary minus, postfix ! ² ³ ⁻¹ %, functions,
     constants, implicit multiplication (2π, 3(4)), and brackets closed for you. a + b% means a plus b percent of a. */
  function caEval(tokens) { const t = tokens.slice(); let open = 0; t.forEach(x => { if (x.v === '(' ) open++; if (x.v === ')') open--; }); while (open-- > 0) t.push({ k: 'par', v: ')' }); let i = 0;
    const peek = () => t[i], next = () => t[i++], R = x => CA.deg ? x * Math.PI / 180 : x, D = x => CA.deg ? x * 180 / Math.PI : x;
    const fn = { sin: x => Math.sin(R(x)), cos: x => Math.cos(R(x)), tan: x => { const c = Math.cos(R(x)); if (Math.abs(c) < 1e-12) throw 'Tangent is undefined here'; return Math.tan(R(x)); }, asin: x => D(Math.asin(x)), acos: x => D(Math.acos(x)), atan: x => D(Math.atan(x)),
      ln: x => { if (x <= 0) throw 'Log needs a number above 0'; return Math.log(x); }, log: x => { if (x <= 0) throw 'Log needs a number above 0'; return Math.log10(x); }, log2: x => { if (x <= 0) throw 'Log needs a number above 0'; return Math.log2(x); },
      sqrt: x => { if (x < 0) throw 'No real square root'; return Math.sqrt(x); }, cbrt: Math.cbrt, exp: Math.exp, p10: x => 10 ** x, abs: Math.abs };
    const fact = n => { if (n < 0 || !Number.isInteger(n)) throw 'Factorial needs a whole number'; if (n > 170) return Infinity; let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
    const primary = () => { const x = next(); if (!x) throw 'Incomplete';
      if (x.k === 'num') return +x.v; if (x.k === 'const') return x.v === 'π' ? Math.PI : Math.E;
      if (x.k === 'fn') { const v = peek()?.v === '(' ? (next(), paren()) : unary(); return fn[x.v](v); }
      if (x.v === '(') return paren(); throw 'Incomplete'; };
    const paren = () => { const v = expr(); if (next()?.v !== ')') throw 'Incomplete'; return v; };
    const postfix = () => { let v = primary(), pct = false; while (peek()?.k === 'post') { const p = next().v; if (p === '!') v = fact(v); else if (p === '²') v = v * v; else if (p === '³') v = v ** 3; else if (p === '⁻¹') { if (v === 0) throw 'Can’t divide by 0'; v = 1 / v; } else if (p === '%') { v /= 100; pct = true; } } return { v, pct }; };
    const unary = () => { if (peek()?.v === '−' && peek().k === 'op') { next(); const u = unary(); return -u; } return power().v; };
    const power = () => { const a = postfix(); const o = peek(); if (o?.k === 'op' && (o.v === '^' || o.v === 'root' || o.v === 'E')) { next(); const b = unary(); if (o.v === '^') return { v: a.v ** b }; if (o.v === 'E') return { v: a.v * 10 ** b }; if (b === 0) throw 'A root of 0 is undefined'; return { v: a.v < 0 && b % 2 ? -((-a.v) ** (1 / b)) : a.v ** (1 / b) }; } return a; };
    const unaryP = () => { if (peek()?.v === '−' && peek().k === 'op') { next(); const u = unaryP(); return { v: -u.v, pct: u.pct }; } return power(); };
    const startsValue = x => x && (x.k === 'num' || x.k === 'const' || x.k === 'fn' || x.v === '(');
    const term = () => { let a = unaryP(); for (;;) { const o = peek();
        if (o?.k === 'op' && (o.v === '×' || o.v === '÷' || o.v === 'mod')) { next(); const b = unaryP().v; if (o.v === '×') a = { v: a.v * b }; else if (o.v === 'mod') a = { v: ((a.v % b) + b) % b }; else { if (b === 0) throw 'Can’t divide by 0'; a = { v: a.v / b }; } }
        else if (startsValue(o)) { const b = unaryP().v; a = { v: a.v * b }; } else return a; } };
    const expr = () => { let a = term().v; for (;;) { const o = peek(); if (!(o?.k === 'op' && (o.v === '+' || o.v === '−'))) return a; next(); const b = term(); const d = b.pct ? a * b.v : b.v; a = o.v === '+' ? a + d : a - d; } };
    if (!t.length) return 0; const v = expr(); if (i < t.length) throw 'Incomplete'; if (Number.isNaN(v)) throw 'Not a number'; if (!Number.isFinite(v)) throw 'Too big to show'; return v; }

  const caNum = v => { if (Object.is(v, -0)) v = 0; const a = Math.abs(v); if (a !== 0 && (a >= 1e15 || a < 1e-9)) { const [m, e] = v.toExponential(9).split('e'); return `${parseFloat(m)}×10<sup>${e.replace('+', '')}</sup>`; }
    const r = parseFloat(v.toPrecision(12)); return r.toLocaleString('en-US', { maximumFractionDigits: 10 }); };
  const caTyped = s => { const [i, f] = s.split('.'); const neg = i.startsWith('-'), n = neg ? i.slice(1) : i; return (neg ? '−' : '') + (n ? (+n).toLocaleString('en-US') : '0') + (f !== undefined ? '.' + f : ''); };
  const caShow = tokens => tokens.map((x, k) => x.k === 'num' ? caTyped(x.v) : x.k === 'op' ? (x.v === '−' && (k === 0 || tokens[k - 1].k === 'op' || tokens[k - 1].v === '(') ? '−' : x.v === 'root' ? ` <i>ʸ√</i> ` : x.v === 'E' ? '<i>E</i>' : x.v === '^' ? '<i>^</i>' : ` <i>${x.v}</i> `)
    : x.k === 'fn' ? `<b>${CAFN[x.v]}</b>` : x.k === 'post' ? (x.v === '⁻¹' || x.v === '²' || x.v === '³' ? `<sup>${x.v === '⁻¹' ? '−1' : x.v === '²' ? '2' : '3'}</sup>` : x.v) : x.v).join('');

  function caPress(k) { const l = caLast(); if (k === 'ac' && caNarrow() && caTyping()) k = 'back';
    if (/^[0-9]$/.test(k) || k === '.') { if (CA.fresh) { CA.t = []; CA.fresh = false; }
      const L = caLast(); if (L?.k === 'num') { if (k === '.' && L.v.includes('.')) return; if (L.v.replace(/[-.]/g, '').length >= 15) return; L.v = L.v === '0' && k !== '.' ? k : L.v === '-0' && k !== '.' ? '-' + k : L.v + k; }
      else { if (caEndsValue()) CA.t.push({ k: 'op', v: '×' }); CA.t.push({ k: 'num', v: k === '.' ? '0.' : k }); } CA.op = null; }
    else if (k in CAOPS) { CA.fresh = false;
      if (!CA.t.length) { if (k === '−') { CA.t.push({ k: 'op', v: '−' }); caRender(); return; } CA.t.push({ k: 'num', v: CA.tape.length ? String(parseFloat(CA.tape[0].r.toPrecision(15))) : '0' }); }   // an operator first carries on from the last answer
      const L = caLast();
      if (L.v === '(') { if (k !== '−') return; CA.t.push({ k: 'op', v: '−' }); }
      else if (L.k === 'op') { if (k === '−' && L.v !== '−') CA.t.push({ k: 'op', v: '−' });   // 3 × −2
        else { if (CA.t[CA.t.length - 2]?.k === 'op') CA.t.pop(); if (caLast()?.k === 'op') caLast().v = k; else CA.t.push({ k: 'op', v: k }); } }
      else CA.t.push({ k: 'op', v: k });
      CA.op = k; }
    else if (k === '(') { if (CA.fresh) { CA.fresh = false; } if (caEndsValue()) CA.t.push({ k: 'op', v: '×' }); CA.t.push({ k: 'par', v: '(' }); }
    else if (k === ')') { const open = CA.t.filter(x => x.v === '(').length - CA.t.filter(x => x.v === ')').length; if (open > 0 && caEndsValue()) CA.t.push({ k: 'par', v: ')' }); }
    else if (k in CAFN) { if (CA.fresh) { const was = CA.t; CA.t = []; CA.fresh = false; CA.t.push({ k: 'fn', v: k }, { k: 'par', v: '(' }, ...was, { k: 'par', v: ')' }); } else { if (caEndsValue()) CA.t.push({ k: 'op', v: '×' }); CA.t.push({ k: 'fn', v: k }, { k: 'par', v: '(' }); } }
    else if (k === 'π' || k === 'e') { if (CA.fresh) { CA.t = []; CA.fresh = false; } if (caEndsValue()) CA.t.push({ k: 'op', v: '×' }); CA.t.push({ k: 'const', v: k }); }
    else if (['!', '²', '³', '⁻¹', '%'].includes(k)) { CA.fresh = false; if (caEndsValue()) CA.t.push({ k: 'post', v: k }); }
    else if (k === 'rand') { if (CA.fresh) { CA.t = []; CA.fresh = false; } if (caEndsValue()) CA.t.push({ k: 'op', v: '×' }); CA.t.push({ k: 'num', v: String(Math.random().toFixed(6)) }); }
    else if (k === 'neg') { const L = caLast(); if (L?.k === 'num') L.v = L.v.startsWith('-') ? L.v.slice(1) : '-' + L.v; else if (!L || L.k === 'op' || L.v === '(') CA.t.push({ k: 'num', v: '-0' }); CA.fresh = false; }
    else if (k === 'back') { CA.fresh = false; const L = caLast(); if (!L) return; if (L.k === 'num' && L.v.replace('-', '').length > 1) L.v = L.v.slice(0, -1); else { CA.t.pop(); if (caLast()?.k === 'fn') CA.t.pop(); } }
    else if (k === 'ac') { if (!CA.t.length) CA.tape = []; CA.t = []; CA.fresh = false; CA.op = null; }
    else if (k === '=') { if (!CA.t.length || CA.fresh) return; try { const r = caEval(CA.t); CA.tape.unshift({ h: caShow(CA.t), r }); CA.t = [{ k: 'num', v: String(parseFloat(r.toPrecision(12))) }]; CA.fresh = true; CA.op = null; caRender(true); return; } catch (err) { caRender(); caShake(typeof err === 'string' ? err : 'Not a number'); return; } }
    else if (k === '2nd') { CA.second = !CA.second; caKeys(); return; }
    else if (k === 'deg') { CA.deg = !CA.deg; caKeys(); caRender(); return; }
    caRender(); }

  function caRender(committed) { const d = $('#ca-disp'); if (!d) return; let prev = '';
    if (CA.t.length && !CA.fresh) { try { const r = caEval(CA.t); const simple = CA.t.length === 1 && CA.t[0].k === 'num'; prev = simple ? '' : `= ${caNum(r)}`; } catch (e) { prev = ''; } }
    d.innerHTML = `<div class="catape" id="ca-tape">${CA.tape.slice().reverse().map((x, i) => `<div class="caline"><span>${x.h}</span><button type="button" data-catape="${CA.tape.length - 1 - i}" title="Use this answer">= ${caNum(x.r)}</button></div>`).join('')}</div>
      <div class="caexpr t-display${committed ? ' landed' : ''}${CA.fresh ? ' done' : ''}" id="ca-expr">${CA.t.length ? (CA.fresh ? caNum(+CA.t[0].v) : caShow(CA.t)) : '0'}</div>
      <div class="caprev" id="ca-prev">${prev}</div>${CA.deg ? '' : '<span class="camode">Rad</span>'}`;
    const tp = $('#ca-tape'); tp.scrollTop = tp.scrollHeight; caFit(); $$('#ca-keys [data-cak]').forEach(b => b.classList.toggle('calit', b.dataset.cak === CA.op));
    caAc(); }
  function caFit() { const e = $('#ca-expr'); if (!e || !e.clientWidth) return; let s = 72; e.style.fontSize = s + 'px'; while (e.scrollWidth > e.clientWidth && s > 28) { s -= 2; e.style.fontSize = s + 'px'; } }
  function caShake(msg) { const p = $('#ca-prev'); p.innerHTML = `<span class="caerr">${msg}</span>`; $('#ca-expr').animate([{ translate: '0' }, { translate: '-6px' }, { translate: '5px' }, { translate: '-3px' }, { translate: '0' }], { duration: 300 }); }

  /* On a phone the calculator is the whole screen, like the phone calculators people already know: no title bar, the
     display running from the status bar down, and big keys on the 16px gutter. The double-wide 0 gives up its left half
     to a mode key, which grows a small panel (Basic, Scientific, Copy, Clear history). While you type, AC becomes ⌫. */
  const caNarrow = () => { const w = $('#w-calc'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };   // the desktop window is narrow by design, so this keys on the phone itself
  const caTyping = () => CA.t.length && !CA.fresh;
  function caKeys() { const nw = caNarrow(); $('#w-calc').classList.toggle('canarrow', nw); const B = (k, label, cls = '', t = '') => `<button type="button" tabindex="-1" class="cak ${cls.split(' ').filter(Boolean).map(c => 'ca' + c).join(' ')}" data-cak="${k}"${t ? ` title="${t}" aria-label="${t}"` : ''}><span>${label}</span></button>`, s2 = CA.second;
    const basic = [B('ac', 'AC', 'fn'), B('neg', '±', 'fn', 'Plus or minus'), B('%', '%', 'fn', 'Percent'), B('÷', '÷', 'op', 'Divide'),
      B('7', '7', 'd'), B('8', '8', 'd'), B('9', '9', 'd'), B('×', '×', 'op', 'Multiply'), B('4', '4', 'd'), B('5', '5', 'd'), B('6', '6', 'd'), B('−', '−', 'op', 'Subtract'),
      B('1', '1', 'd'), B('2', '2', 'd'), B('3', '3', 'd'), B('+', '+', 'op', 'Add'), ...(nw ? [B('mode', ic('square-function'), `fn modek${CA.modep ? ' on' : ''}`, 'Basic or scientific'), B('0', '0', 'd')] : [B('0', '0', 'd zero')]), B('.', '.', 'd', 'Decimal point'), B('=', '=', 'eq', 'Equals')].join('');
    const sci = [B('(', '('), B(')', ')'), B('2nd', '2nd', s2 ? 'on' : '', 'Second functions'), B('deg', CA.deg ? 'Deg' : 'Rad', 'on', 'Degrees or radians'), B('rand', 'Rand', '', 'Random number'),
      B('²', 'x<sup>2</sup>'), B('³', 'x<sup>3</sup>'), B('^', 'x<sup>y</sup>'), B('exp', 'e<sup>x</sup>'), B('p10', '10<sup>x</sup>'),
      B('⁻¹', '1/x'), B('sqrt', '√x'), B('cbrt', '∛x'), B('root', '<sup>y</sup>√x'), B('!', 'x!'),
      B(s2 ? 'asin' : 'sin', s2 ? 'sin<sup>−1</sup>' : 'sin'), B(s2 ? 'acos' : 'cos', s2 ? 'cos<sup>−1</sup>' : 'cos'), B(s2 ? 'atan' : 'tan', s2 ? 'tan<sup>−1</sup>' : 'tan'), B(s2 ? 'log2' : 'ln', s2 ? 'log<sub>2</sub>' : 'ln'), B('log', 'log'),
      B('π', 'π'), B('e', 'e'), B('E', 'EE', '', 'Times ten to the power'), B('abs', '|x|'), B('mod', 'mod')].join('');
    $('#ca-keys').innerHTML = `${CA.sci ? `<div class="casci">${sci}</div>` : ''}<div class="cabasic">${basic}</div>${nw && CA.modep ? `<div class="fexp camodep" role="menu">${[['basic', 'calculator', 'Basic', !CA.sci], ['sci', 'square-function', 'Scientific', CA.sci]].map(([k, i, n, on]) => `<button class="fexr2${on ? ' on' : ''}" type="button" role="menuitemradio" aria-checked="${on}" data-camode="${k}">${ic(i)}<span>${n}</span>${on ? ic('check') : ''}</button>`).join('')}<span class="crsep"></span><button class="fexr2" type="button" data-cacopy ${CA.tape[0] || CA.t.length ? '' : 'disabled'}>${ic('copy')}<span>Copy result</span></button><button class="fexr2" type="button" data-caclear ${CA.tape.length ? '' : 'disabled'}>${ic('history')}<span>Clear history</span></button></div>` : ''}`;
    caAc(); }
  function caAc() { const ac = $('#ca-keys [data-cak="ac"]'); if (!ac) return; const back = caNarrow() && caTyping(); ac.querySelector('span').innerHTML = back ? ic('delete') : CA.t.length ? 'C' : 'AC'; ac.setAttribute('aria-label', back ? 'Delete' : 'Clear'); }
  function caMode(sci) { CA.sci = sci; const w = $('#w-calc'); w.classList.toggle('sci', sci);
    if (!document.documentElement.dataset.solo && !caNarrow()) { const r = w.getBoundingClientRect(), nw = sci ? 720 : 360, dl = (nw - r.width) / 2; w.style.width = nw + 'px'; w.style.left = (parseFloat(w.style.left) - dl) + 'px'; }
    caTop(); caKeys(); caRender(); }
  // Basic and Scientific live in the app menu, under the app's name, like every other app's view choices
  function caTop() { $('#ca-top').innerHTML = `<button class="catitle" type="button" aria-haspopup="menu" aria-label="Calculator menu"><img src="${A}calculator.svg" alt=""><b>Calculator</b><span class="chev">${ic('chevron-down')}</span></button>`; }
  function caMenu(anchor) { $('#ca-pop')?.remove(); const w = $('#w-calc'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(), last = CA.tape[0];
    const it = (attr, label, on, kbd = '') => `<button class="crmi${on ? ' on' : ''}" type="button" role="menuitemradio" aria-checked="${!!on}" ${attr}><span>${label}</span>${kbd ? `<kbd class="cakbd">${kbd}</kbd>` : ''}${on ? ic('check') : ''}</button>`;
    w.insertAdjacentHTML('beforeend', `<div class="crpop capop" id="ca-pop" role="menu">${it('data-camode="basic"', 'Basic', !CA.sci, '⌘1')}${it('data-camode="sci"', 'Scientific', CA.sci, '⌘2')}<span class="crsep"></span>
      <button class="crmi" type="button" data-cacopy ${last || CA.t.length ? '' : 'disabled'}><span>Copy result</span></button><button class="crmi" type="button" data-caclear ${CA.tape.length ? '' : 'disabled'}><span>Clear tape</span></button></div>`);
    const p = $('#ca-pop'); p.style.left = Math.max(8, r.left - wr.left) + 'px'; p.style.top = (r.bottom - wr.top + 6) + 'px'; }
  function caClick(e, hit) { const q = s => hit(s);
    if (q('.catitle')) return true;   // the menu opened on pointer-down; its own click must not close it
    if (!q('#ca-pop')) $('#ca-pop')?.remove();
    if (q('#ca-pop button[disabled]')) return true;
    if (q('[data-cacopy]')) { $('#ca-pop')?.remove(); const v = CA.t.length ? (CA.fresh ? +CA.t[0].v : (() => { try { return caEval(CA.t); } catch (x) { return null; } })()) : CA.tape[0]?.r; if (v != null) navigator.clipboard?.writeText(String(v)).catch(() => {}); const p = $('#ca-prev'); p.textContent = 'Copied'; setTimeout(() => { if (p.textContent === 'Copied') caRender(); }, 1200); return true; }
    if (q('[data-caclear]')) { $('#ca-pop')?.remove(); CA.tape = []; caRender(); return true; }
    if (q('[data-cak="mode"]')) { CA.modep = !CA.modep; caKeys(); return true; }
    if (CA.modep && (q('.camodep [data-cacopy]') || q('.camodep [data-caclear]') || q('.camodep [data-camode]') || !q('.camodep'))) { CA.modep = false; if (!q('[data-camode]')) setTimeout(caKeys); }
    const k = q('[data-cak]'); if (k) { k.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 160 }); caPress(k.dataset.cak); return true; }
    const m = q('[data-camode]'); if (m) { $('#ca-pop')?.remove(); caMode(m.dataset.camode === 'sci'); return true; }
    const tp = q('[data-catape]'); if (tp) { const r = CA.tape[+tp.dataset.catape].r, v = String(parseFloat(r.toPrecision(15))); if (CA.fresh || !CA.t.length) { CA.t = [{ k: 'num', v }]; CA.fresh = false; } else { if (caEndsValue()) CA.t.push({ k: 'op', v: '×' }); CA.t.push({ k: 'num', v }); } caRender(); return true; }
    if (q('#ca-expr') && CA.fresh) { navigator.clipboard?.writeText(String(+CA.t[0].v)).catch(() => {}); const p = $('#ca-prev'); p.textContent = 'Copied'; setTimeout(() => { if (p.textContent === 'Copied') p.textContent = ''; }, 1200); return true; }
    return false; }
  function renderCalc() { caTop();
    $('#w-calc').addEventListener('pointerdown', e => { const t = e.target.closest('.catitle'); if (!t) return; e.stopPropagation(); e.preventDefault(); $('#ca-pop') ? $('#ca-pop').remove() : caMenu(t); }, true); $('#ca-body').innerHTML = `<div class="isle cadisp" id="ca-disp"></div><div class="cakeys" id="ca-keys"></div>`; caKeys(); caRender(); new ResizeObserver(() => { caFit(); if ($('#w-calc').clientWidth && caNarrow() !== $('#w-calc').classList.contains('canarrow')) { CA.modep = false; caKeys(); caRender(); } }).observe($('#ca-disp')); }
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'calc' || e.target.closest?.('input,textarea')) return;
    if ((e.metaKey || e.ctrlKey) && (e.key === '1' || e.key === '2')) { e.preventDefault(); caMode(e.key === '2'); return; } if (e.metaKey || e.ctrlKey) return;
    const map = { '*': '×', 'x': '×', '/': '÷', '-': '−', '+': '+', 'Enter': '=', '=': '=', 'Backspace': 'back', 'Escape': 'ac', '^': '^', '!': '!', '%': '%', '(': '(', ')': ')', '.': '.', ',': '.', 'p': 'π' }, k = /^[0-9]$/.test(e.key) ? e.key : map[e.key]; if (!k) return;
    e.preventDefault(); const b = $(`#ca-keys [data-cak="${k}"]`); b?.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 160 }); caPress(k); });

  /* ══ Tip Split ═══════════════════════════════════════════════════════════════
     The small app Ari made in the "tips" conversation (Today, 11:05). The bill, the tip and how many people;
     the answer is what each person pays. Starts on the numbers Ari showed: $84.50, 18%, four people. */
  const TS = { bill: 84.5, tip: 18, n: 4 };
  const tsMoney = v => '$' + v.toFixed(2);
  function tsPaint(land) { const tip = TS.bill * TS.tip / 100, total = TS.bill + tip, each = Math.round(total / TS.n * 100) / 100, e = $('#ts-each');
    e.textContent = tsMoney(each); if (land) { e.classList.remove('landed'); void e.offsetWidth; e.classList.add('landed'); }
    $('#ts-tip').textContent = tsMoney(tip); $('#ts-total').textContent = tsMoney(total); $('#ts-n').textContent = TS.n;
    $('#ts-who').textContent = TS.n === 1 ? 'You pay' : 'Each person pays';
    $('#ts-ppl').innerHTML = Array.from({ length: Math.min(TS.n, 16) }, (_, i) => `<i style="animation-delay:${i * 18}ms"></i>`).join('');
    $$('#ts-body [data-tstip]').forEach(b => b.classList.toggle('on', +b.dataset.tstip === TS.tip)); placeInd($('#ts-body .seg'));
    $('#ts-body [data-tsp="-1"]').disabled = TS.n <= 1; $('#ts-body [data-tsp="1"]').disabled = TS.n >= 20; }
  function renderTip() { $('#ts-top').innerHTML = `<span class="tstitle"><img src="../icons/luma-v4-tipsplit.svg" alt=""><b>Tip Split</b></span>`;
    $('#ts-body').innerHTML = `<div class="isle tsdisp"><small id="ts-who">Each person pays</small><b class="tseach" id="ts-each"></b>
        <p class="tsline"><span>Tip <b id="ts-tip"></b></span><span>Total <b id="ts-total"></b></span></p><span class="tsppl" id="ts-ppl" aria-hidden="true"></span></div>
      <label class="tsrow"><span>Bill</span><span class="tsin">$<input id="ts-bill" inputmode="decimal" autocomplete="off" spellcheck="false" value="${TS.bill.toFixed(2)}" aria-label="Bill"></span></label>
      <div class="tsrow"><span>Tip</span>${seg([15, 18, 20, 25].map(t => [t, t + '%']), TS.tip, 'data-tstip', 'Tip')}</div>
      <div class="tsrow"><span>People</span><span class="tsstep"><button type="button" data-tsp="-1" aria-label="One fewer">${ic('minus')}</button><b id="ts-n" aria-live="polite"></b><button type="button" data-tsp="1" aria-label="One more">${ic('plus')}</button></span></div>
      <p class="tsby">Made by Ari</p>`;
    $('#ts-bill').addEventListener('input', e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); TS.bill = isFinite(v) ? v : 0; tsPaint(); });
    $('#ts-bill').addEventListener('blur', e => { e.target.value = TS.bill.toFixed(2); });
    new ResizeObserver(() => placeInd($('#ts-body .seg'))).observe($('#ts-body')); tsPaint(); }
  function tsClick(e, hit) { const q = s => hit(s);
    const t = q('[data-tstip]'); if (t) { TS.tip = +t.dataset.tstip; tsPaint(true); return true; }
    const p = q('[data-tsp]'); if (p) { TS.n = Math.max(1, Math.min(20, TS.n + +p.dataset.tsp)); tsPaint(true); return true; }
    return false; }

  /* ══ Ari ═════════════════════════════════════════════════════════════════════
     Ari is the part of Luma you can talk to, and it can act. Everything it does leaves a trace you can see:
     a chain of the things it touched, joined by what it did to them, lighting up step by step as it works.
     Anything that leaves this computer waits for your OK. Activity keeps every chain, with Undo.
     Ari runs on any model. Models are measured against one thing people can picture: this computer's
     memory. Local first; the cloud only when you pick it, and Auto asks before it goes there. */

  /* Models. mem is what it needs in memory (GB); wps is words a second on this computer. */
  const ARPC = { n: 'This ThinkPad', mem: 32, sys: 5, gpu: 'Radeon 780M graphics', disk: 412 };
  const ARLM = [
    { id: 'qwen8', n: 'Qwen3 8B', by: 'Qwen', mono: 'Q', h: 265, sz: 5.2, mem: 6, wps: 38, good: ['Chat', 'Code'], have: true },
    { id: 'qwen30', n: 'Qwen3 30B', by: 'Qwen', mono: 'Q', h: 265, sz: 18.6, mem: 20, wps: 14, good: ['Chat', 'Code', 'Reasoning'], have: true },
    { id: 'qwen14', n: 'Qwen3 14B', by: 'Qwen', mono: 'Q', h: 265, sz: 9.3, mem: 11, wps: 22, good: ['Chat', 'Code', 'Reasoning'], rec: true },
    { id: 'gemma12', n: 'Gemma 3 12B', by: 'Google', mono: 'G', h: 215, sz: 8.1, mem: 10, wps: 24, good: ['Chat', 'Images'] },
    { id: 'qwen4', n: 'Qwen3 4B', by: 'Qwen', mono: 'Q', h: 265, sz: 2.6, mem: 3.5, wps: 70, good: ['Chat'] },
    { id: 'qvl7', n: 'Qwen2.5 VL 7B', by: 'Qwen', mono: 'Q', h: 265, sz: 5.5, mem: 7, wps: 31, good: ['Images'] },
    { id: 'r1', n: 'DeepSeek R1 14B', by: 'DeepSeek', mono: 'D', h: 245, sz: 9, mem: 11, wps: 19, good: ['Reasoning'] },
    { id: 'mistral24', n: 'Mistral Small 24B', by: 'Mistral', mono: 'M', h: 45, sz: 14.3, mem: 16, wps: 12, good: ['Chat', 'Code'] },
    { id: 'coder30', n: 'Qwen3 Coder 30B', by: 'Qwen', mono: 'Q', h: 265, sz: 18.6, mem: 20, wps: 13, good: ['Code'] },
    { id: 'llama70', n: 'Llama 3.3 70B', by: 'Meta', mono: 'L', h: 230, sz: 42, mem: 46, wps: 0, good: ['Chat', 'Reasoning'] }
  ];
  const ARCL = [
    { id: 'anthropic', n: 'Anthropic', api: 'Anthropic API', mono: 'A', h: 45, on: true, key: '…4f2a', models: [['sonnet', 'Claude Sonnet'], ['opus', 'Claude Opus']] },
    { id: 'openrouter', n: 'OpenRouter', api: 'OpenRouter', mono: 'O', h: 290, on: true, key: '…91c0', note: 'Hundreds of models with one key', models: [['kimi', 'Kimi K2'], ['dsv3', 'DeepSeek V3']] },
    { id: 'openai', n: 'OpenAI', api: 'OpenAI API', mono: 'O', h: 165, on: false, models: [['gpt5', 'GPT-5'], ['gpt5m', 'GPT-5 mini']] }
  ];
  const ARPROV = [
    { id: 'anthropic', n: 'Anthropic', mono: 'A', h: 45, what: 'Claude Sonnet, Claude Opus', where: 'console.anthropic.com', key: 'sk-ant-…', models: [['sonnet', 'Claude Sonnet', 'Everyday'], ['opus', 'Claude Opus', 'Hardest problems'], ['haiku', 'Claude Haiku', 'Quick']] },
    { id: 'openai', n: 'OpenAI', mono: 'O', h: 165, what: 'GPT-5, GPT-5 mini', where: 'platform.openai.com', key: 'sk-proj-…', models: [['gpt5', 'GPT-5', 'Hardest problems'], ['gpt5m', 'GPT-5 mini', 'Everyday']] },
    { id: 'openrouter', n: 'OpenRouter', mono: 'O', h: 290, what: 'Hundreds of models with one key', where: 'openrouter.ai/keys', key: 'sk-or-…', models: [['kimi', 'Kimi K2', 'Open weights'], ['dsv3', 'DeepSeek V3', 'Open weights'], ['gem', 'Gemini 2.5 Pro', 'Long documents']] },
    { id: 'google', n: 'Google', mono: 'G', h: 215, what: 'Gemini 2.5 Pro and Flash', where: 'aistudio.google.com', key: 'AIza…', models: [['gem', 'Gemini 2.5 Pro', 'Long documents'], ['gemf', 'Gemini 2.5 Flash', 'Quick']] },
    { id: 'own', n: 'Your own server', mono: '', h: 250, what: 'Ollama, LM Studio or anything OpenAI-compatible', where: '', key: '', models: [['own1', 'llama3.3:70b', 'On your server']] } ];
  const AP = { step: 'pick', prov: null, key: '', url: 'http://192.168.1.20:11434', test: null, sel: {} };
  // Adding a provider: pick who, paste a key (we say where to get one), see what it unlocks, choose what shows in the picker
  function arProvider() { const P = ARPROV.find(p => p.id === AP.prov), conn = id => ARCL.find(c => c.id === id)?.on;
    if (AP.step === 'pick') return `<header class="apvh"><h2>Add a provider</h2><button class="ib" type="button" data-arisx title="Close">${ic('x')}</button></header><p class="apsub">Use a model that runs somewhere else. Ari sends only the conversation you're in, never your files, and asks first.</p>
      <div class="aplist">${ARPROV.map(p => `<button type="button" class="aprov" data-approv="${p.id}"${conn(p.id) ? ' disabled' : ''}>${arLogo(p.id, 36)}<span><b>${p.n}</b><small>${p.what}</small></span>${conn(p.id) ? '<em class="apon">Connected</em>' : ic('chevron-right')}</button>`).join('')}</div>`;
    const own = P.id === 'own', ok = AP.test === 'ok';
    const field = own ? `<label class="apfld"><span>Server address</span><input data-apurl value="${esc(AP.url)}" spellcheck="false"></label>` : `<label class="apfld"><span>API key</span><input data-apkey type="password" placeholder="${P.key}" value="${esc(AP.key)}" spellcheck="false" autocomplete="off"></label><p class="aphint">Get one at <b>${P.where}</b>. It stays in Luma’s keyring on this computer.</p>`;
    return `<header class="apvh"><button class="ib" type="button" data-apback title="Back">${ic('chevron-left')}</button>${arLogo(P.id, 28)}<h2>${P.n}</h2><button class="ib" type="button" data-arisx title="Close">${ic('x')}</button></header>
      ${field}<div class="aptest ${AP.test || ''}">${AP.test === 'run' ? '<i class="arispin"></i>Checking…' : ok ? `${ic('check')}Connected. ${P.models.length} models available` : AP.test === 'bad' ? `${ic('x')}That key didn’t work. Check it and try again` : ''}</div>
      ${ok ? `<h6 class="aph">Show in the picker</h6><div class="apmods">${P.models.map(([id, n, d]) => `<button type="button" class="apmod${AP.sel[id] !== false ? ' on' : ''}" data-apmod="${id}"><i class="apck">${ic('check')}</i><span><b>${n}</b><small>${d}</small></span></button>`).join('')}</div>` : ''}
      <div class="mdact"><span></span><button class="bt fill" type="button" data-arisx>Cancel</button>${ok ? `<button class="bt key" type="button" data-apdone>Add ${P.n}</button>` : `<button class="bt key" type="button" data-aptest${own || AP.key.length > 6 ? '' : ' disabled'}>Connect</button>`}</div>`; }
  const arFit = m => m.mem <= 12 ? ['good', 'Runs well'] : m.mem <= ARPC.mem - ARPC.sys - 3 ? ['ok', 'Runs, but slower'] : ['no', 'Too big for this computer'];
  const arM = id => { if (id === 'auto') return { id, n: 'Auto', local: true, mono: '', h: 250 }; const l = ARLM.find(m => m.id === id); if (l) return { ...l, local: true };
    for (const s of ARCL) { const m = s.models.find(x => x[0] === id); if (m) return { id, n: m[1], local: false, via: s.n, mono: s.mono, h: s.h, pid: s.id }; } };
  /* Provider marks, drawn in Luma's icon form: a gradient squircle, a soft bloom top left, a white mark that casts a small shadow */
  // Official marks from Simple Icons (CC0), paths unchanged; only the tile behind them is Luma's
  const ARLOGO = {
    anthropic: ['#2B2A27', '#161614', '<path transform="translate(18.200000000000003 18.200000000000003) scale(1.15)" d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" fill="#fff"/>'],
    claude: ['#E3876A', '#C8603F', '<path transform="translate(17.0 17.0) scale(1.25)" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" fill="#fff"/>'],
    openai: ['#34373D', '#111214', '<path transform="translate(17.0 17.0) scale(1.25)" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" fill="#fff"/>'],
    openrouter: ['#6E78F0', '#4750C8', '<path transform="translate(17.0 17.0) scale(1.25)" d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z" fill="#fff"/>'],
    google: ['#FFFFFF', '#EEF1F7', '<defs><linearGradient id="gmg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F8DF7"/><stop offset=".55" stop-color="#9B72F2"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs><path transform="translate(17.0 17.0) scale(1.25)" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" fill="url(#gmg)"/>', true],
    own: ['#F4F4F2', '#DCDCD8', '<path transform="translate(17.6 17.6) scale(1.2)" d="M16.361 10.26a.894.894 0 0 0-.558.47l-.072.148.001.207c0 .193.004.217.059.353.076.193.152.312.291.448.24.238.51.3.872.205a.86.86 0 0 0 .517-.436.752.752 0 0 0 .08-.498c-.064-.453-.33-.782-.724-.897a1.06 1.06 0 0 0-.466 0zm-9.203.005c-.305.096-.533.32-.65.639a1.187 1.187 0 0 0-.06.52c.057.309.31.59.598.667.362.095.632.033.872-.205.14-.136.215-.255.291-.448.055-.136.059-.16.059-.353l.001-.207-.072-.148a.894.894 0 0 0-.565-.472 1.02 1.02 0 0 0-.474.007Zm4.184 2c-.131.071-.223.25-.195.383.031.143.157.288.353.407.105.063.112.072.117.136.004.038-.01.146-.029.243-.02.094-.036.194-.036.222.002.074.07.195.143.253.064.052.076.054.255.059.164.005.198.001.264-.03.169-.082.212-.234.15-.525-.052-.243-.042-.28.087-.355.137-.08.281-.219.324-.314a.365.365 0 0 0-.175-.48.394.394 0 0 0-.181-.033c-.126 0-.207.03-.355.124l-.085.053-.053-.032c-.219-.13-.259-.145-.391-.143a.396.396 0 0 0-.193.032zm.39-2.195c-.373.036-.475.05-.654.086-.291.06-.68.195-.951.328-.94.46-1.589 1.226-1.787 2.114-.04.176-.045.234-.045.53 0 .294.005.357.043.524.264 1.16 1.332 2.017 2.714 2.173.3.033 1.596.033 1.896 0 1.11-.125 2.064-.727 2.493-1.571.114-.226.169-.372.22-.602.039-.167.044-.23.044-.523 0-.297-.005-.355-.045-.531-.288-1.29-1.539-2.304-3.072-2.497a6.873 6.873 0 0 0-.855-.031zm.645.937a3.283 3.283 0 0 1 1.44.514c.223.148.537.458.671.662.166.251.26.508.303.82.02.143.01.251-.043.482-.08.345-.332.705-.672.957a3.115 3.115 0 0 1-.689.348c-.382.122-.632.144-1.525.138-.582-.006-.686-.01-.853-.042-.57-.107-1.022-.334-1.35-.68-.264-.28-.385-.535-.45-.946-.03-.192.025-.509.137-.776.136-.326.488-.73.836-.963.403-.269.934-.46 1.422-.512.187-.02.586-.02.773-.002zm-5.503-11a1.653 1.653 0 0 0-.683.298C5.617.74 5.173 1.666 4.985 2.819c-.07.436-.119 1.04-.119 1.503 0 .544.064 1.24.155 1.721.02.107.031.202.023.208a8.12 8.12 0 0 1-.187.152 5.324 5.324 0 0 0-.949 1.02 5.49 5.49 0 0 0-.94 2.339 6.625 6.625 0 0 0-.023 1.357c.091.78.325 1.438.727 2.04l.13.195-.037.064c-.269.452-.498 1.105-.605 1.732-.084.496-.095.629-.095 1.294 0 .67.009.803.088 1.266.095.555.288 1.143.503 1.534.071.128.243.393.264.407.007.003-.014.067-.046.141a7.405 7.405 0 0 0-.548 1.873c-.062.417-.071.552-.071.991 0 .56.031.832.148 1.279L3.42 24h1.478l-.05-.091c-.297-.552-.325-1.575-.068-2.597.117-.472.25-.819.498-1.296l.148-.29v-.177c0-.165-.003-.184-.057-.293a.915.915 0 0 0-.194-.25 1.74 1.74 0 0 1-.385-.543c-.424-.92-.506-2.286-.208-3.451.124-.486.329-.918.544-1.154a.787.787 0 0 0 .223-.531c0-.195-.07-.355-.224-.522a3.136 3.136 0 0 1-.817-1.729c-.14-.96.114-2.005.69-2.834.563-.814 1.353-1.336 2.237-1.475.199-.033.57-.028.776.01.226.04.367.028.512-.041.179-.085.268-.19.374-.431.093-.215.165-.333.36-.576.234-.29.46-.489.822-.729.413-.27.884-.467 1.352-.561.17-.035.25-.04.569-.04.319 0 .398.005.569.04a4.07 4.07 0 0 1 1.914.997c.117.109.398.457.488.602.034.057.095.177.132.267.105.241.195.346.374.43.14.068.286.082.503.045.343-.058.607-.053.943.016 1.144.23 2.14 1.173 2.581 2.437.385 1.108.276 2.267-.296 3.153-.097.15-.193.27-.333.419-.301.322-.301.722-.001 1.053.493.539.801 1.866.708 3.036-.062.772-.26 1.463-.533 1.854a2.096 2.096 0 0 1-.224.258.916.916 0 0 0-.194.25c-.054.109-.057.128-.057.293v.178l.148.29c.248.476.38.823.498 1.295.253 1.008.231 2.01-.059 2.581a.845.845 0 0 0-.044.098c0 .006.329.009.732.009h.73l.02-.074.036-.134c.019-.076.057-.3.088-.516.029-.217.029-1.016 0-1.258-.11-.875-.295-1.57-.597-2.226-.032-.074-.053-.138-.046-.141.008-.005.057-.074.108-.152.376-.569.607-1.284.724-2.228.031-.26.031-1.378 0-1.628-.083-.645-.182-1.082-.348-1.525a6.083 6.083 0 0 0-.329-.7l-.038-.064.131-.194c.402-.604.636-1.262.727-2.04a6.625 6.625 0 0 0-.024-1.358 5.512 5.512 0 0 0-.939-2.339 5.325 5.325 0 0 0-.95-1.02 8.097 8.097 0 0 1-.186-.152.692.692 0 0 1 .023-.208c.208-1.087.201-2.443-.017-3.503-.19-.924-.535-1.658-.98-2.082-.354-.338-.716-.482-1.15-.455-.996.059-1.8 1.205-2.116 3.01a6.805 6.805 0 0 0-.097.726c0 .036-.007.066-.015.066a.96.96 0 0 1-.149-.078A4.857 4.857 0 0 0 12 3.03c-.832 0-1.687.243-2.456.698a.958.958 0 0 1-.148.078c-.008 0-.015-.03-.015-.066a6.71 6.71 0 0 0-.097-.725C8.997 1.392 8.337.319 7.46.048a2.096 2.096 0 0 0-.585-.041Zm.293 1.402c.248.197.523.759.682 1.388.03.113.06.244.069.292.007.047.026.152.041.233.067.365.098.76.102 1.24l.002.475-.12.175-.118.178h-.278c-.324 0-.646.041-.954.124l-.238.06c-.033.007-.038-.003-.057-.144a8.438 8.438 0 0 1 .016-2.323c.124-.788.413-1.501.696-1.711.067-.05.079-.049.157.013zm9.825-.012c.17.126.358.46.498.888.28.854.36 2.028.212 3.145-.019.14-.024.151-.057.144l-.238-.06a3.693 3.693 0 0 0-.954-.124h-.278l-.119-.178-.119-.175.002-.474c.004-.669.066-1.19.214-1.772.157-.623.434-1.185.68-1.382.078-.062.09-.063.159-.012z" fill="#111"/>', true] };
  /* Model makers and fixed provider colours: Simple Icons marks (CC0) on each brand's own colour */
  Object.assign(ARLOGO, {
    qwen: ["#7E6CF6", "#5A43E2", '<path transform="translate(17.0 17.0) scale(1.25)" d="M23.919 14.545 20.817 9.17l1.47-2.544a.56.56 0 0 0 0-.566l-1.633-2.83a.57.57 0 0 0-.49-.283h-6.207L12.487.402a.57.57 0 0 0-.49-.284H8.732a.56.56 0 0 0-.49.284L5.139 5.775h-2.94a.56.56 0 0 0-.49.284L.077 8.887a.56.56 0 0 0 0 .567L3.18 14.83l-1.47 2.545a.56.56 0 0 0 0 .566l1.634 2.83a.57.57 0 0 0 .49.283h6.205l1.47 2.545a.57.57 0 0 0 .49.284h3.266a.57.57 0 0 0 .49-.284l3.104-5.375h2.94a.57.57 0 0 0 .49-.283l1.634-2.828a.55.55 0 0 0-.004-.568M8.733.686l1.634 2.828-1.634 2.828H21.8L20.164 9.17H7.425L5.63 6.06Zm1.306 19.801-6.205-.002 1.634-2.83h3.265L2.201 6.344h3.267q3.182 5.517 6.367 11.032zm10.124-5.66L18.53 12l-6.532 11.315-1.634-2.83c2.129-3.673 4.25-7.351 6.373-11.028h3.592l3.102 5.374z" fill="#fff"/>'],
    deepseek: ["#6F93FF", "#4D6BFE", '<path transform="translate(17.0 17.0) scale(1.25)" d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45" fill="#fff"/>'],
    mistral: ["#FF8A3D", "#FA520F", '<path transform="translate(17.0 17.0) scale(1.25)" d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z" fill="#fff"/>'],
    meta: ["#FFFFFF", "#EEF1F7", '<path transform="translate(17.0 17.0) scale(1.25)" d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" fill="#0467DF"/>', true],
    gemma: ["#FFFFFF", "#EEF1F7", '<path transform="translate(17.0 17.0) scale(1.25)" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>', true],
    microsoft: ["#FFFFFF", "#EEF1F7", '<rect transform="translate(17.0 17.0) scale(1.25)" x="0" y="0" width="11.408" height="11.408" fill="#F25022"/><rect transform="translate(17.0 17.0) scale(1.25)" x="12.594" y="0" width="11.408" height="11.408" fill="#7FBA00"/><rect transform="translate(17.0 17.0) scale(1.25)" x="0" y="12.594" width="11.408" height="11.408" fill="#00A4EF"/><rect transform="translate(17.0 17.0) scale(1.25)" x="12.594" y="12.594" width="11.408" height="11.408" fill="#FFB900"/>', true],
    anthropic: ["#D9AC88", "#C08A66", '<path transform="translate(17.0 17.0) scale(1.25)" d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" fill="#191919"/>'],
    openrouter: ["#A3B1C6", "#64748B", '<path transform="translate(17.0 17.0) scale(1.25)" d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z" fill="#fff"/>'],
  });
  const ARBY = { Qwen: 'qwen', Google: 'gemma', DeepSeek: 'deepseek', Mistral: 'mistral', Microsoft: 'microsoft', Meta: 'meta' };
  const arLogo = (id, sz = 22) => { const L = ARLOGO[id]; if (!L) return ''; const u = 'lg' + id + sz;
    return `<svg class="arlogo" width="${sz}" height="${sz}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${u}b" x1=".1" y1="0" x2=".9" y2="1"><stop stop-color="${L[0]}"/><stop offset="1" stop-color="${L[1]}"/></linearGradient><radialGradient id="${u}h" cx=".2" cy=".05" r=".8"><stop stop-color="#fff" stop-opacity="${L[3] ? 0 : .3}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><filter id="${u}d" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#10141c" flood-opacity="${L[3] ? .12 : .28}"/></filter></defs><rect width="64" height="64" fill="url(#${u}b)"/><rect width="64" height="64" fill="url(#${u}h)"/><g filter="url(#${u}d)">${L[2]}</g></svg>`; };
  const arMk = m => m.pid === 'anthropic' ? 'claude' : m.pid || (ARLOGO[m.id] ? m.id : ARBY[m.by]);
  const arMono = (m, sz = 22) => ARLOGO[arMk(m)] ? arLogo(arMk(m), sz) : m.id === 'auto' ? `<img class="arimono img" src="${A}ari.svg" alt="" style="width:${sz}px;height:${sz}px">` : `<i class="arimono" style="--h:${m.h};width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .5)}px">${m.mono}</i>`;
  const arGB = n => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10) + ' GB';

  /* What Ari has done. Each chain: the things it touched, and what it did to each. */
  const ARCH = {
    budget: { t: 'September budget, shared with Theo', conv: 'budget', day: 'Today', at: '14:32', cats: ['Files', 'People'], undo: 'part',
      nodes: [{ k: 'stack', kind: 'paper', n: '23 receipts', m: 'Downloads', st: 'done' }, { k: 'file', v: 'Made', n: 'September budget.xlsx', m: 'Documents › Launch', ext: 'XLSX', h: 150, st: 'done' },
        { k: 'person', v: 'Shared with', p: 'TH', n: 'Theo Marsh', m: 'Can edit', st: 'done' }, { k: 'email', v: 'Emailed', n: 'Budget for September', m: 'To Theo', st: 'ask' }],
      ask: { to: 'TH', subj: 'Budget for September', body: ['Hi Theo,', 'The September budget is in the Launch folder. We spent $4,212, most of it on the venue and printing. The breakdown is on the first tab.', 'Nick'] } },
    tips: { t: 'Made Tip Split', conv: 'tips', day: 'Today', at: '11:05', cats: ['Apps'], undo: 'can', nodes: [{ k: 'app', n: 'Tip Split', m: 'Made by Ari', st: 'done', open: 'tipsplit' }, { k: 'apps', v: 'Added to', n: 'Apps', m: 'Next to Calculator', st: 'done' }] },
    shots: { t: 'Sorted 20 screenshots', conv: 'shots', day: 'Yesterday', at: '17:48', cats: ['Files'], undo: 'can',
      nodes: [{ k: 'stack', kind: 'shots', n: '20 screenshots', m: 'Desktop', st: 'done' }, { k: 'folder', v: 'Moved 14 into', n: 'September', m: 'Pictures › Screenshots', count: 14, st: 'done' }, { k: 'folder', v: 'and 6 into', n: 'August', m: 'Pictures › Screenshots', count: 6, st: 'done' }] },
    quiet: { t: 'Quiet until 18:00', conv: 'quiet', day: 'Yesterday', at: '13:58', cats: ['Settings', 'People'], undo: 'done',
      nodes: [{ k: 'setting', n: 'Do Not Disturb', m: 'On until 18:00', st: 'done' }, { k: 'person', v: 'except', p: 'PR', n: 'Priya Raman', m: 'Can still reach you', st: 'done' }, { k: 'event', v: 'Blocked', n: 'Focus', m: '14:00 – 18:00', date: ['SEP', '22'], st: 'done' }] },
    photos: { t: 'Renamed 12 photos by date', day: 'Monday', at: '10:14', cats: ['Files'], undo: 'can', nodes: [{ k: 'stack', kind: 'photos', n: '12 photos', m: 'Pictures', st: 'done' }, { k: 'folder', v: 'Renamed in', n: 'Launch shoot', m: 'Pictures', count: 12, st: 'done' }] },
    dad: { t: 'Reminder to call Dad', day: 'Monday', at: '09:02', cats: ['Apps', 'People'], undo: 'can', nodes: [{ k: 'event', n: 'Call Dad', m: 'Saturday, 10:00', date: ['SEP', '27'], st: 'done' }, { k: 'person', v: 'with', p: 'MO', n: 'Dad', m: 'Phone', st: 'done' }] }
  };
  const ARC = [
    { id: 'budget', t: 'Budget for Theo', day: 'Today', msgs: [{ u: 'Turn my September receipts into a budget, put it in the Launch folder, share it with Theo and email him.' },
      { a: 'I found 23 receipts in Downloads, all from September. Here is what I did, and the email is waiting for you.', m: 'qwen8', s: 3.1 }, { ch: 'budget' }] },
    { id: 'tips', t: 'A tip splitter', day: 'Today', msgs: [{ u: 'Make me a little app that splits a bill and the tip between friends.' },
      { a: 'Done. Tip Split is in Apps. It takes the bill, the tip you want and how many people, and shows what each person pays.', m: 'sonnet', s: 14.2 }, { ch: 'tips' }] },
    { id: 'shots', t: 'Tidy screenshots', day: 'Yesterday', msgs: [{ u: 'My desktop is a mess of screenshots. Sort them.' }, { a: 'Moved all 20 into Pictures › Screenshots, one folder per month. Your desktop is clear.', m: 'qwen8', s: 1.4 }, { ch: 'shots' }] },
    { id: 'quiet', t: 'Quiet afternoon', day: 'Yesterday', msgs: [{ u: 'I need to focus until 6. Only Priya can get through.' }, { a: 'Do Not Disturb is on until 18:00 and Priya can still reach you. I blocked the time in your calendar too.', m: 'qwen8', s: 0.9 }, { ch: 'quiet' }, { u: 'Thanks, turn it off, I’m done early.' }, { a: 'It’s off.', m: 'qwen8', s: 0.4 }] },
    { id: 'ram', t: 'Why models need memory', day: 'Monday', msgs: [{ u: 'Why do bigger models need more memory?' }, { a: 'A model is a large file of numbers. To answer you, all of those numbers have to sit in memory at once, so a model that needs 11 GB needs 11 GB free while it works.|Bigger models know more and reason better, but they need more memory and answer more slowly. Here is where each size lands on this computer:', m: 'qwen8', s: 2.2, mem: true }] }
  ];
  const AR = { view: 'chat', cur: 'budget', model: 'auto', pop: false, filter: 'All', store: 'All', q: '', busy: false, n: 0 };
  const arConv = () => ARC.find(c => c.id === AR.cur);

  /* ── The chain: tiles joined by verbs ── */
  function arPlate(n) {
    if (n.k === 'stack') return `<span class="aristack ${n.kind}">${[2, 1, 0].map(i => n.kind === 'paper' ? `<i style="--i:${i}"><b></b><b></b><b></b></i>` : `<i style="--i:${i};background-image:url('${PH}${['life-work-suite', 'life-hero-home', 'life-suite-bg-grid', 'life-hero-studio', 'life-sync-terrace', 'life-ari-street'][i + (n.kind === 'photos' ? 3 : 0)]}.webp')"></i>`).join('')}</span>`;
    if (n.k === 'person') return `<span class="ariperson">${av(n.p, 52)}</span>`;
    if (n.k === 'app') return `<span class="ariapp"><i class="arat"><i></i><i></i><i></i></i><span class="arab"><small>Bill</small><b>$84.50</b><small>Tip · 18%</small><span class="arak"><i>−</i><b>4 people</b><i>+</i></span><em>$24.93 each</em></span></span>`;
    if (n.k === 'event') return `<span class="aridate"><small>${n.date[0]}</small><b>${n.date[1]}</b></span>`;
    if (n.k === 'setting') return `<span class="ariplate set">${ic('moon')}<i class="arisw on"></i></span>`;
    const map = { file: ['table', n.h || 150], email: ['mail', 240], folder: ['folder', 250], apps: ['layout-grid', 0] }, [icn, h] = map[n.k];
    return `<span class="ariplate ${n.k}" style="--h:${h}">${ic(icn)}${n.ext ? `<em>${n.ext}</em>` : ''}${n.count ? `<em class="c">${n.count}</em>` : ''}</span>`; }
  function arNode(n, i) { const badge = n.st === 'done' ? ic('check') : n.st === 'run' ? '<i class="arispin"></i>' : n.st === 'ask' ? ic('hand') : n.st === 'undone' ? ic('undo-2') : '';
    return `<div class="arinode ${n.st}" style="--d:${i}">${arPlate(n)}<b>${esc(n.n)}</b><small>${esc(n.m)}</small>${badge ? `<i class="aribadge">${badge}</i>` : ''}</div>`; }
  /* The trace: one quiet line per step, joined by a rail. The glyph says what kind of thing it was; the words say what Ari did. */
  const ARVERB = { stack: 'Found', file: 'Made', person: 'Shared with', email: 'Email to', folder: 'Moved into', app: 'Made', apps: 'Added to', setting: 'Turned on', event: 'Added' };
  function arGlyph(n) { if (n.k === 'person') return `<span class="argl av">${av(n.p, 22)}</span>`;
    if (n.k === 'event') return `<span class="argl" style="--h:25">${ic('calendar')}</span>`;
    if (n.k === 'stack' && n.kind !== 'paper') return `<span class="argl img" style="background-image:url('${PH}${n.kind === 'photos' ? 'life-hero-studio' : 'life-work-suite'}.webp')"></span>`;
    const m = { stack: ['file-text', 60], file: ['table', n.h || 150], email: ['mail', 240], folder: ['folder', 250], app: ['app-window', 35], apps: ['layout-grid', 265], setting: ['moon', 280] }[n.k] || ['file-text', 250];
    return `<span class="argl" style="--h:${m[1]}">${ic(m[0])}</span>`; }
  function arStep(n, i) { const verb = n.st === 'ask' || n.st === 'undone' && n.k === 'email' ? 'Email to' : n.v || ARVERB[n.k] || '', st = n.st === 'done' ? `<i class="arst ok">${ic('check')}</i>` : n.st === 'run' ? '<i class="arst"><i class="arispin"></i></i>' : n.st === 'ask' ? '<i class="arst ask">Waiting</i>' : n.st === 'undone' ? '<i class="arst un">Undone</i>' : '';
    return `<li class="arstep ${n.st}" style="--d:${i}">${arGlyph(n)}<span class="arsl"><span class="arv">${esc(verb)}</span> <b>${esc(n.n)}</b><small>${esc(n.m)}</small></span>${n.open && n.st === 'done' ? `<button class="aropen" type="button" data-ariopen="${n.open}">Open</button>` : ''}${st}</li>`; }
  function arChain(id, compact) { const c = ARCH[id], sts = c.nodes.map(n => n.st), asking = sts.includes('ask'), running = sts.includes('run') || sts.includes('wait'), undone = c.undo === 'undone';
    const state = undone ? ['undone', 'Undone'] : asking ? ['ask', 'Needs your OK'] : running ? ['run', 'Working'] : ['done', `${c.nodes.length} steps`];
    const steps = c.nodes.map((n, i) => n.st === 'hide' ? '' : arStep(n, i)).join('');
    const a = c.ask, ask = asking && !compact && a ? `<div class="ariask"><p class="ardraft"><b>${esc(a.subj)}</b><span>${esc(a.body.slice(1, -1).join(' '))}</span></p>
        <div class="ariaskact"><button class="bt sm quiet" type="button" data-arino="${id}">Don’t send</button><span></span><button class="bt sm" type="button" data-aritodo="The draft opens in Charlie">Edit</button><button class="bt sm key" type="button" data-ariok="${id}">Send to ${esc(ppl(a.to).n.split(' ')[0])}</button></div></div>` : '';
    const undo = c.undo === 'can' ? `<button class="arlnk" type="button" data-ariundo="${id}">Undo</button>` : c.undo === 'part' && !asking ? `<button class="arlnk" type="button" data-ariundo="${id}" title="Removes the file and the share. The email can’t be unsent.">Undo</button>` : c.undo === 'done' ? '<span class="arinote">Turned off at 16:40</span>' : undone ? '<span class="arinote">Put back as it was</span>' : '';
    return `<div class="arich ${state[0]}${compact ? ' compact' : ''}" data-arichain="${id}"><header><b>${esc(c.t)}</b><span class="aristate ${state[0]}">${state[0] === 'run' ? '<i class="arispin"></i>' : ''}${state[1]}</span><span class="argap"></span>${undo && !running ? undo : ''}${compact ? '' : `<time>${c.at}</time>`}</header>
      <ol class="arsteps">${steps}</ol>${ask}</div>`; }
  const arChainPaint = id => { const el = $(`[data-arichain="${id}"]`); if (el) el.outerHTML = arChain(id, el.classList.contains('compact')); };
  // Steps light up one at a time; the ones still to come aren't shown until Ari reaches them
  function arRun(id, from, done) { const c = ARCH[id]; c.nodes.forEach((n, k) => { if (k > from) n.st = 'hide'; }); let i = from;
    const go = () => { if (i >= c.nodes.length) { arChainPaint(id); done?.(); return; } const n = c.nodes[i]; n.st = 'run'; arChainPaint(id); setTimeout(() => { n.st = 'done'; i++; go(); }, 900); }; go(); }

  /* ── Memory: the one picture every model is measured against ── */
  function arMem(extra) { const loaded = arM(AR.model).local ? ARLM.find(m => m.id === (AR.model === 'auto' ? 'qwen8' : AR.model)) : null, T = ARPC.mem, used = ARPC.sys + (loaded ? loaded.mem : 0);
    const marks = extra ? [['qwen8', '8B'], ['qwen14', '14B'], ['qwen30', '30B'], ['llama70', '70B']].map(([id, l]) => { const m = ARLM.find(x => x.id === id), x = Math.min(100, (ARPC.sys + m.mem) / T * 100); return `<i class="arimk ${arFit(m)[0]}" style="left:${x}%"><em>${l}</em></i>`; }).join('') : '';
    return `<div class="arimem${extra ? ' marks' : ''}"><div class="arimbar"><i class="sys" style="width:${ARPC.sys / T * 100}%" title="Luma and your apps"></i>${loaded ? `<i class="mdl" style="width:${loaded.mem / T * 100}%" title="${loaded.n}"></i>` : ''}${marks}</div>
      <div class="arimleg"><span><i class="sys"></i>Luma and apps ${ARPC.sys} GB</span>${loaded ? `<span><i class="mdl"></i>${loaded.n} ${loaded.mem} GB</span>` : ''}<span><i class="free"></i>Free ${T - used} GB</span><span class="tot">${T} GB memory</span></div></div>`; }

  /* ── Views ── */
  function arSide() { const row = (attr, icn, label, on, em = '') => `<button class="si${on ? ' on' : ''}" type="button" ${attr}>${ic(icn)}<span class="lab">${label}</span>${em ? `<em>${em}</em>` : ''}</button>`, days = [...new Set(ARC.map(c => c.day))];
    const dl = ARLM.find(m => m.dl != null), loaded = arM(AR.model);
    const asks = Object.values(ARCH).reduce((k, c) => k + c.nodes.filter(n => n.st === 'ask').length, 0), sq = AR.sq || '', chats = ARC.filter(c => !sq || c.t.toLowerCase().includes(sq.toLowerCase())), had = document.activeElement?.matches?.('[data-arisq]');
    $('#ari-side').innerHTML = `<div class="scr">${row('data-ariview="activity"', 'history', 'Activity', AR.view === 'activity', '')}${row('data-ariview="models"', 'cpu', 'Models', AR.view === 'models', dl ? `${Math.round(dl.dl)}%` : '')}
      ${days.filter(d => chats.some(c => c.day === d)).map(d => `<div class="sh">${d}</div>${chats.filter(c => c.day === d).map(c => row(`data-aric="${c.id}"`, 'message-circle', esc(c.t), AR.view === 'chat' && AR.cur === c.id)).join('')}`).join('')}${sq && !chats.length ? `<p class="arinone">No chats match “${esc(sq)}”</p>` : ''}</div>
      ${lFoot({ q: { attr: 'data-arisq', ph: 'Search chats', value: sq }, add: { attr: 'data-arinew', label: 'New chat', icon: 'square-pen' } })}`;
    $('#ari-side [data-ariview="activity"] .lab')?.insertAdjacentHTML('afterend', lCount(asks, true)); if (had) { const i = $('[data-arisq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-arisq]')) { AR.sq = e.target.value; arSide(); } });
  function arFoot(m, s) { const M = arM(m); return `<div class="arifoot"><span class="ariwhere" title="${esc(M.n)} · ${M.local ? 'on this computer' : 'sent to ' + esc(M.via || 'the cloud')}">${ic(M.local ? 'house' : 'cloud')}${M.local ? 'On this computer' : 'Cloud'}</span><span>${s} s</span><span class="arigap"></span><button class="ib" type="button" data-aritodo="Copied" title="Copy">${ic('copy')}</button></div>`; }
  function arSay(m) { return `<div class="arisay"><img class="arimark" src="${A}ari.svg" alt=""><div>${m.a.split('|').map(p => `<p>${p}</p>`).join('')}${m.mem ? arMem(true) : ''}${m.m ? arFoot(m.m, m.s) : ''}</div></div>`; }
  function arChat() { const c = arConv();
    if (!c) return `<div class="arinew"><img class="arinewmark" src="${A}ari.svg" alt=""><h1>What should Ari do?</h1><p>Ari works with your files, apps and settings. It asks before it sends anything, or uses the cloud.</p>
      <div class="arisug">${[['folder', 'Put my tax documents in one folder', 'tax'], ['moon', 'Quiet until 6, except Priya', 'quiet'], ['cpu', 'What model should I use for code?', 'code'], ['memory-stick', 'Explain local models in two sentences', 'local']].map(([i, t, k]) => `<button type="button" data-arisug="${k}">${ic(i)}<span>${t}</span></button>`).join('')}</div></div>`;
    return `<div class="arithread"><header class="arihd"><h1>${esc(c.t)}</h1><span>${c.day}</span></header>${c.msgs.map(m => m.u ? `<div class="arime"><p>${esc(m.u)}</p></div>` : m.a ? arSay(m) : m.ch ? `<div class="arisay chain"><span></span>${arChain(m.ch)}</div>` : m.think ? `<div class="arisay"><img class="arimark" src="${A}ari.svg" alt=""><p class="arithink">${m.think}</p></div>` : '').join('')}</div>`; }
  function arActivity() { const F = AR.filter, list = Object.entries(ARCH).filter(([ c]) => F === 'All' || c.cats.includes(F)), days = [...new Set(list.map(([ c]) => c.day))];
    const files = Object.values(ARCH).filter(c => c.cats.includes('Files')).length, ppl2 = Object.values(ARCH).filter(c => c.cats.includes('People')).length;
    return `<div class="aripad"><header class="aripghd"><h1>Activity</h1><p>Everything Ari has done on this computer, newest first. ${files} changes to files, ${ppl2} involving people.</p></header>
      ${days.map(d => `<section class="ariday"><h6>${d}</h6>${list.filter(([ c]) => c.day === d).map(([id, c]) => `<div class="ariact"><time>${c.at}</time><div>${arChain(id, true)}${c.conv ? `<button class="arilnk" type="button" data-aric="${c.conv}">${ic('message-circle')}From “${esc(ARC.find(x => x.id === c.conv)?.t || '')}”</button>` : '<span class="arilnk q">From a voice request</span>'}</div></div>`).join('')}</section>`).join('') || '<p class="arinone">Nothing here yet.</p>'}</div>`; }
  function arCard(m, hero) { const [fit, fl] = arFit(m), btn = m.have ? `<span class="arihave">${ic('check')}On this computer</span>` : m.dl != null ? `<div class="aridl"><i style="width:${m.dl}%"></i><span>${arGB(m.sz * m.dl / 100)} of ${arGB(m.sz)}</span></div>` : fit === 'no' ? `<button class="bt sm" type="button" disabled title="Needs ${m.mem} GB of memory. This computer has ${ARPC.mem} GB.">Needs ${m.mem} GB</button>` : `<button class="bt ${hero ? 'key' : 'sm fill'}" type="button" data-arget="${m.id}">${ic('download')}Get · ${arGB(m.sz)}</button>`;
    if (hero) return `<article class="arihero ${fit}">${arMono(m, 56)}<div class="arihtx"><small>Recommended for this computer</small><b>${m.n}</b><p>The largest model that runs well here. ${m.good.join(', ')}.</p></div>
      <div class="arifit"><div class="arifbar"><i class="sys" style="width:${ARPC.sys / ARPC.mem * 100}%"></i><i class="need" style="width:${m.mem / ARPC.mem * 100}%"></i></div><p><b>${fl}</b><span>Needs ${m.mem} GB · about ${m.wps} words a second</span></p></div>${btn}</article>`;
    return `<article class="arimc${hero ? ' hero' : ''} ${fit}"><header>${arMono(m, hero ? 52 : 36)}<div><b>${m.n}</b><small>${m.by}</small></div></header>${hero ? '<p class="arirec">The largest model that runs well on this computer</p>' : ''}
      <div class="arigood">${m.good.map(g => `<span>${g}</span>`).join('')}</div>
      <div class="arifit"><div class="arifbar"><i class="sys" style="width:${ARPC.sys / ARPC.mem * 100}%"></i><i class="need" style="width:${Math.min(100 - ARPC.sys / ARPC.mem * 100, m.mem / ARPC.mem * 100)}%"></i></div><p><b>${fl}</b><span>Needs ${m.mem} GB${m.wps ? ` · about ${m.wps} words a second` : ''}</span></p></div>${btn}</article>`; }
  function arModels() { const S = AR.store, q = AR.q.trim().toLowerCase(), local = ARLM.filter(m => m.have || m.dl != null), rec = ARLM.find(m => m.rec && !m.have),
      store = ARLM.filter(m => !m.have && m.dl == null && m !== rec && (S === 'All' || m.good.includes(S)) && (!q || (m.n + m.by).toLowerCase().includes(q)));
    return `<div class="aripad wide"><header class="aripghd"><h1>Models</h1><p>${ARPC.n} · ${ARPC.gpu} · ${ARPC.disk} GB free on disk</p></header>${arMem(false)}
      <section class="arisec"><h6>On this computer<span>Nothing you say to these leaves this computer</span></h6><div class="arilocal">${local.map(m => { const def = AR.model === m.id || (AR.model === 'auto' && m.id === 'qwen8');
        return `<div class="arirow">${arMono(m, 34)}<div><b>${m.n}</b><small>${m.dl != null ? `Downloading · ${Math.round(m.dl)}%` : `${arGB(m.sz)} on disk · needs ${m.mem} GB memory · about ${m.wps} words a second`}</small></div>${m.dl != null ? `<div class="aridl sm"><i style="width:${m.dl}%"></i></div>` : `${def ? `<span class="aridef">${AR.model === 'auto' ? 'Auto uses this' : 'In use'}</span>` : `<button class="bt sm fill" type="button" data-ariuse="${m.id}">Use</button>`}<button class="ib" type="button" data-aritodo="Remove ${m.n} (${arGB(m.sz)})" title="More">${ic('ellipsis')}</button>`}</div>`; }).join('')}</div></section>
      <section class="arisec"><h6>Cloud<span>These send your conversation to the company you pick</span></h6><div class="aricloud">${ARCL.map(s => `<div class="aricl${s.on ? ' on' : ''}">${arMono(s, 34)}<div><b>${s.n}</b><small>${s.on ? `Connected · key ${s.key}` : 'Not connected'}</small><small class="m">${s.note || s.models.map(x => x[1]).join(', ')}</small></div>${s.on ? `<button class="bt sm" type="button" data-aritodo="Key ${s.key} is in Luma’s keyring">${ic('key-round')}Key</button>` : `<button class="bt sm fill" type="button" data-arikey="${s.id}">${ic('key-round')}Add key</button>`}</div>`).join('')}</div></section>
      <section class="arisec"><h6>Get models</h6>${rec && S === 'All' && !q ? arCard(rec, true) : ''}<div class="arigrid">${store.map(m => arCard(m)).join('') || '<p class="arinone">No models match.</p>'}</div></section></div>`; }
  function arTtl() { const w = $('#w-ari'), c = AR.view === 'chat' && arConv(); if (!w.clientWidth) return; $('#ari-ttl')?.remove(); lNavTtl(w, ariNarrow() && c ? c.t : null, c ? c.day : ''); }
  function arMain() { setTimeout(arTtl); const b = $('#ari-body'); if (AR.view === 'models' && window.LumaAriModels) { LumaAriModels.render(); return; } $('#w-ari').classList.remove('arxwin'); b.innerHTML = AR.view === 'activity' ? arActivity() : AR.view === 'models' ? arModels() : arChat(); if (AR.view === 'chat') b.scrollTop = b.scrollHeight; }
  /* Ari on a phone: the composer is one row, like Messages. Home (or a cloud) says where it runs and opens the model drawer
     above; the field carries Attach; then Send. New chat lives in the sidebar.
     Activity and Models keep one row, with their filters growing the bar instead of a segmented control. */
  const ariNarrow = () => { const w = $('#w-ari'); return !!w?.clientWidth && w.clientWidth < 560; };
  function arBarPhone(bar, M) { const X = AR.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    bar.className = 'fbar phnofit ariphbar' + (AR.view === 'chat' ? ' aricomp' : '');
    const chips = (list, cur, attr) => `<div class="fexp"><div class="fexs">${list.map(x => `<button type="button" class="fsch${cur === x ? ' on' : ''}" ${attr}="${x}">${x}</button>`).join('')}</div></div>`;
    let panel = '', rows = '';
    if (AR.view === 'chat') { panel = X === 'model' ? `<div class="fexp aripick2">${arPickHTML()}</div>` : '';
      const had = document.activeElement?.matches?.('[data-ariq]') ? document.activeElement.value : null;
      rows = `<div class="mrow arirow1"><button class="ib arihome${X === 'model' ? ' on' : ''}" type="button" data-aripx="model" aria-expanded="${X === 'model'}" aria-label="${M.id === 'auto' ? 'Auto' : esc(M.n)}, ${M.local ? 'on this phone' : `sent to ${esc(M.via || 'the cloud')}`}" title="${M.local ? 'Runs on this phone' : `Sent to ${esc(M.via || 'the cloud')}`}">${ic(M.local ? 'house' : 'cloud')}</button><div class="mfield"><textarea data-ariq rows="1" placeholder="Ask Ari" aria-label="Message Ari"></textarea><button class="ib emo" type="button" data-aritodo="The file picker opens" aria-label="Attach" title="Attach">${ic('paperclip')}</button></div><button class="send round${AR.busy ? ' go' : ''}" type="button" data-arisend aria-label="${AR.busy ? 'Stop' : 'Send'}">${ic(AR.busy ? 'square' : 'arrow-up')}</button></div>`;
      bar.classList.toggle('phgrow', !!panel); setBar(bar, panel + rows); if (had != null) { const t = $('#ari-bar [data-ariq]'); t.value = had; t.focus(); } return; }
    if (AR.view === 'activity') { panel = X === 'filter' ? chips(['All', 'Files', 'People', 'Apps', 'Settings'], AR.filter, 'data-arifilter') : '';
      rows = `<button class="arimod2${X === 'filter' ? ' on' : ''}" type="button" data-aripx="filter">${ic('list-filter')}<span><b>${esc(AR.filter)}</b><small>Everything Ari did</small></span>${ic('chevron-down')}</button>`; }
    else { panel = X === 'store' ? chips(['All', 'Chat', 'Code', 'Images', 'Reasoning'], AR.store, 'data-aristore') : '';
      rows = `<label class="srch keep">${ic('search')}<input placeholder="Search models" value="${esc(AR.q)}" data-arisq></label>${ib('data-aripx="store"', 'list-filter', 'Good at', X === 'store' || AR.store !== 'All')}`; }
    bar.classList.toggle('phgrow', !!panel); setBar(bar, panel + rows); }
  function arBar() { const bar = $('#ari-bar'), M = arM(AR.model);
    arTtl(); if (AR.view === 'models' && window.LumaAriModels) return LumaAriModels.bar(); bar.hidden = false; if (ariNarrow()) return arBarPhone(bar, M);
    bar.className = 'fbar' + (AR.view === 'chat' ? ' aricomp' : '');
    // Most people never think about the model; what they may care about is whether it stays on this computer. So the composer starts with one quiet icon: a house, or a cloud. Details on hover; the picker on click.
    if (AR.view === 'chat') setBar(bar, `<button class="arimodel${M.local ? '' : ' cloud'}" type="button" data-arimodel title="${M.id === 'auto' ? 'Auto' : M.n} · ${M.local ? 'stays on this computer' : `sent to ${M.via}`}" aria-label="Model: ${M.id === 'auto' ? 'Auto' : M.n}">${ic(M.local ? 'house' : 'cloud')}</button>
      <label class="ariin"><textarea data-ariq rows="1" placeholder="Ask, or tell Ari what to do"></textarea><button class="ib emo" type="button" data-aritodo="The file picker opens" aria-label="Attach" title="Attach">${ic('paperclip')}</button></label>
      <button class="bt key arisend" type="button" data-arisend aria-label="${AR.busy ? 'Stop' : 'Send'}">${ic(AR.busy ? 'square' : 'arrow-up')}</button>`);
    else if (AR.view === 'activity') setBar(bar, `${seg(['All', 'Files', 'People', 'Apps', 'Settings'].map(x => [x, x]), AR.filter, 'data-arifilter', 'Show')}`);
    else setBar(bar, `<label class="srch ariq">${ic('search')}<input placeholder="Search models" value="${esc(AR.q)}" data-arisq></label>${seg(['All', 'Chat', 'Code', 'Images', 'Reasoning'].map(x => [x, x]), AR.store, 'data-aristore', 'Good at')}`); }
  function arAll() { arSide(); arMain(); arBar(); }
  /* Ari's models, second pass (?ari=b): apps/ari/models.js draws Models, handed the parts it shares with the rest of Ari */
  window.LumaAriModels?.init({ A, ic, esc, AR, ARLM, ARCL, ARPC, arMono, arLogo, arGB, arFit, arM, arAll, arSide, narrow: () => ariNarrow(), segs: () => segs(), lToast: (...a) => lToast(...a), lMenu: (...a) => lMenu(...a), lConfirm: (...a) => lConfirm(...a) });
  function arToast(msg, icon) { lToast($('#w-ari'), msg, { icon: icon || 'check' }); }

  /* ── The model picker: who does the thinking, and where ── */
  function arPicker(a) { $('#ari-pop')?.remove(); const w = $('#w-ari'), wr = w.getBoundingClientRect(); a = a || $('[data-arimodel]'); const r = a.getBoundingClientRect();
    w.insertAdjacentHTML('beforeend', `<div class="crpop aripick" id="ari-pop">${arPickHTML()}</div>`);
    const p = $('#ari-pop'); p.style.left = Math.max(8, r.left - wr.left - 6) + 'px'; p.style.bottom = (wr.bottom - r.top + 10) + 'px'; }
  function arPickHTML() {
    const row = (id, name, sub, icn, dis) => { const M = arM(id) || {}; return `<button class="arirowp${AR.model === id ? ' on' : ''}" type="button" ${dis ? `data-arikey="${dis}"` : `data-ariset="${id}"`}>${id === 'auto' ? arMono(arM('auto'), 28) : arMono(dis ? ARCL.find(s => s.id === dis) : M, 28)}<span><b>${name}</b><small>${sub}</small></span>${ic(icn)}${AR.model === id ? `<i class="arick">${ic('check')}</i>` : ''}</button>`; };
    return `${row('auto', 'Auto', 'Uses Qwen3 8B here. Asks before using the cloud.', 'house')}
      <h6>On this computer</h6>${ARLM.filter(m => m.have).map(m => row(m.id, m.n, `${m.mem <= 12 ? 'Quick' : 'Slower, more capable'} · ${m.mem} GB memory`, 'house')).join('')}
      <h6>Cloud</h6>${ARCL.filter(s => s.on).flatMap(s => s.models.map(([id, n]) => row(id, n, `Via ${s.api}`, 'cloud'))).join('')}<button class="arirowp aradd" type="button" data-arikey="${ARCL.find(s => !s.on)?.id || 'openai'}"><i class="aradd-ic">${ic('plus')}</i><span><b>Add a provider</b><small>OpenAI, OpenRouter, Anthropic or your own</small></span></button>
      <span class="crsep"></span><button class="crmi" type="button" data-ariview="models">${ic('download')}<span>Get more models…</span></button>`; }
  /* A sheet, the way Luma asks (see Modals) */
  function arSheet(html) { const w = $('#w-ari'), s = $('#ari-sheet'); w.classList.add('arion'); s.innerHTML = html; s.className = 'mdsheet'; void s.offsetWidth; s.classList.add('show'); requestAnimationFrame(() => (s.querySelector('input') || s.querySelector('.key'))?.focus({ preventScroll: true })); }
  function arSheetClose(msg) { $('#w-ari').classList.remove('arion'); $('#ari-sheet').className = 'mdsheet'; if (msg) arToast(msg); }

  /* ── Scripted requests (this is a mockup: a few requests really run) ── */
  function arNewConv(t, u) { const c = { id: 'n' + (++AR.n), t, day: 'Today', msgs: [{ u }] }; ARC.unshift(c); AR.cur = c.id; AR.view = 'chat'; return c; }
  function arThink(c, text, then, ms = 1100) { AR.busy = true; c.msgs.push({ think: text }); arAll(); setTimeout(() => { c.msgs.pop(); then(); }, ms); }
  function arDo(k, text) { const c = AR.cur !== 'new' && arConv() ? arConv() : arNewConv({ tax: 'Tax documents', quiet: 'Quiet until 6', code: 'A model for code', local: 'Local models' }[k] || text.slice(0, 32), text); if (c.msgs[c.msgs.length - 1]?.u !== text) c.msgs.push({ u: text });
    const M = AR.model === 'auto' ? 'qwen8' : AR.model, fin = () => { AR.busy = false; arAll(); };
    if (k === 'tax') { const id = 'ch' + AR.n; ARCH[id] = { t: 'Tax documents in one folder', conv: c.id, day: 'Today', at: new Date().toTimeString().slice(0, 5), cats: ['Files'], undo: 'can', nodes: [{ k: 'stack', kind: 'paper', n: '9 tax documents', m: 'Downloads and Documents', st: 'wait' }, { k: 'folder', v: 'Moved into', n: 'Taxes 2026', m: 'Documents', count: 9, st: 'hide' }] };
      arThink(c, 'Looking in Downloads and Documents', () => { c.msgs.push({ a: 'Found 9 tax documents: returns, receipts and two letters from the tax office. Moving them into Documents › Taxes 2026.', m: M, s: 2.4 }, { ch: id }); arAll(); arRun(id, 0, () => { ARCH[id].nodes[1].st = 'done'; fin(); arChainPaint(id); arToast('Moved 9 documents into Taxes 2026'); }); }); return; }
    if (k === 'quiet') { const id = 'ch' + AR.n; ARCH[id] = { t: 'Quiet until 18:00', conv: c.id, day: 'Today', at: new Date().toTimeString().slice(0, 5), cats: ['Settings', 'People'], undo: 'can', nodes: [{ k: 'setting', n: 'Do Not Disturb', m: 'On until 18:00', st: 'wait' }, { k: 'person', v: 'except', p: 'PR', n: 'Priya Raman', m: 'Can still reach you', st: 'hide' }] };
      arThink(c, 'Changing Do Not Disturb', () => { c.msgs.push({ a: 'Do Not Disturb is on until 18:00. Priya can still reach you.', m: M, s: 0.8 }, { ch: id }); arAll(); arRun(id, 0, fin); }, 700); return; }
    const say = { code: 'For code on this computer, Qwen3 Coder 30B is the strongest that fits, but it answers at about 13 words a second. Qwen3 14B is quicker and still good at code. For the hardest problems, Claude Opus in the cloud is stronger than both.',
      local: 'A local model is a file you download that runs entirely on this computer, so nothing you type leaves it. The bigger the file, the smarter it is, and the more memory it needs.' }[k] || 'This is a mockup, so only a few requests really run here. Try one of the suggestions in a new chat.';
    arThink(c, 'Thinking', () => { c.msgs.push({ a: say, m: M, s: 1.6, mem: k === 'local' }); fin(); }, 900); }

  function ariClick(e, hit) { const q = s => hit(s); if (window.LumaAriModels && LumaAriModels.click(e)) return true;
    const op = q('[data-ariopen]'); if (op) { if (window.lumaDesk) lumaDesk.open(op.dataset.ariopen); return true; }
    if (ariNarrow()) { const px = q('[data-aripx]'); if (px) { const k = px.dataset.aripx; AR.px = AR.px === k ? '' : k; arBar(); return true; }
      if (q('[data-ariset]') || q('[data-arikey]') || q('[data-ariview]') || q('[data-arifilter]') || q('[data-aristore]') || q('[data-arinew]') || q('[data-aric]')) { AR.px = ''; setTimeout(arBar); } }
    const amb = q('.arimodel') || q('.arimsel'); if (amb) { if ($('#ari-pop')) $('#ari-pop').remove(); else arPicker(amb); return true; }
    if (!q('#ari-pop')) $('#ari-pop')?.remove();
    if (q('button[disabled]')) return true;
    const set = q('[data-ariset]'); if (set) { $('#ari-pop')?.remove(); AR.model = set.dataset.ariset; const M = arM(AR.model); arAll(); arToast(M.local ? `${M.id === 'auto' ? 'Auto' : M.n}: stays on this computer` : `${M.n}: conversations go to ${M.via}`); return true; }
    const vw = q('[data-ariview]'); if (vw) { $('#ari-pop')?.remove(); AR.view = vw.dataset.ariview; arAll(); return true; }
    if (q('[data-arinew]')) { AR.view = 'chat'; AR.cur = 'new'; arAll(); setTimeout(() => $('[data-ariq]')?.focus({ preventScroll: true }), 50); return true; }
    const cv2 = q('[data-aric]'); if (cv2) { AR.view = 'chat'; AR.cur = cv2.dataset.aric; arAll(); return true; }
    const sg = q('[data-arisug]'); if (sg) { const k = sg.dataset.arisug; arDo(k, sg.querySelector('span').textContent); return true; }
    if (q('[data-arisend]')) { const t = $('[data-ariq]'), v = t?.value.trim(); if (AR.busy || !v) return true; const k = /tax/i.test(v) ? 'tax' : /quiet|focus|disturb/i.test(v) ? 'quiet' : /code/i.test(v) ? 'code' : /local|model/i.test(v) ? 'local' : 'x'; arDo(k, v); return true; }
    const ok = q('[data-ariok]'); if (ok) { const id = ok.dataset.ariok, c = ARCH[id], n = c.nodes.find(x => x.st === 'ask'); n.st = 'run'; arChainPaint(id); setTimeout(() => { n.st = 'done'; arChainPaint(id); arSide(); arToast('Emailed ' + ppl(c.ask.to).n.split(' ')[0]); }, 1100); return true; }
    const no = q('[data-arino]'); if (no) { const id = no.dataset.arino, c = ARCH[id], n = c.nodes.find(x => x.st === 'ask'); n.st = 'undone'; n.m = 'Not sent'; arChainPaint(id); arSide(); return true; }
    const ud = q('[data-ariundo]'); if (ud) { const id = ud.dataset.ariundo, c = ARCH[id]; c.nodes.forEach((n, i) => { if (i && !(n.k === 'email' && n.st === 'done')) n.st = 'undone'; }); c.undo = 'undone'; arChainPaint(id); arToast(c.nodes.some(n => n.k === 'email' && n.st === 'done') ? 'Undone. The email stays sent' : 'Undone'); return true; }
    if (q('[data-aribig]')) { arSheet(`<h2>Send this chat to Anthropic?</h2><p>Claude Opus runs on Anthropic’s computers. They receive this conversation, not your files.</p><div class="mdact"><span></span><button class="bt fill" type="button" data-arisx>Cancel</button><button class="bt key" type="button" data-aricloud>Send to Anthropic</button></div>`); return true; }
    const ky = q('[data-arikey]'); if (ky) { $('#ari-pop')?.remove(); Object.assign(AP, { step: ky.closest('.aricl, [data-arx-direct]') ? 'key' : 'pick', prov: ky.closest('.aricl, [data-arx-direct]') ? ky.dataset.arikey : null, key: '', test: null, sel: {} }); arSheet(arProvider()); $('#ari-sheet').classList.add('apsheet'); return true; }
    const apv = q('[data-approv]'); if (apv) { Object.assign(AP, { step: 'key', prov: apv.dataset.approv, key: '', test: null, sel: {} }); $('#ari-sheet').innerHTML = arProvider(); setTimeout(() => $('#ari-sheet input')?.focus({ preventScroll: true }), 30); return true; }
    if (q('[data-apback]')) { AP.step = 'pick'; AP.test = null; $('#ari-sheet').innerHTML = arProvider(); return true; }
    if (q('[data-aptest]')) { AP.test = 'run'; $('#ari-sheet').innerHTML = arProvider(); setTimeout(() => { AP.test = 'ok'; $('#ari-sheet').innerHTML = arProvider(); }, 900); return true; }
    const apm = q('[data-apmod]'); if (apm) { const k = apm.dataset.apmod; AP.sel[k] = AP.sel[k] === false; $('#ari-sheet').innerHTML = arProvider(); return true; }
    if (q('[data-apdone]')) { const P = ARPROV.find(p => p.id === AP.prov), models = P.models.filter(([id]) => AP.sel[id] !== false).map(([id, n]) => [id, n]); let c = ARCL.find(x => x.id === P.id);
      if (!c) { c = { id: P.id, n: P.n, api: P.id === 'own' ? 'your server' : P.n + ' API', mono: P.mono || '·', h: P.h, models: [] }; ARCL.push(c); } Object.assign(c, { on: true, key: '…' + (AP.key.slice(-4) || '9x2k'), models }); arSheetClose(`${P.n} added. ${models.length} model${models.length === 1 ? '' : 's'} in the picker`); arAll(); return true; }
    if (q('[data-arisx]')) { arSheetClose(); return true; }
    if (q('[data-aricloud]')) { arSheetClose(); const c = arConv(); arThink(c, 'Sending to Anthropic', () => { c.msgs.push({ a: 'Same answer, checked by a larger model: nothing to add.', m: 'opus', s: 6.8 }); AR.busy = false; arAll(); }, 1300); return true; }
    const ko = q('[data-arikeyok]'); if (ko) { const s = ARCL.find(x => x.id === ko.dataset.arikeyok); s.on = true; s.key = '…9x2k'; arSheetClose(`${s.n} is connected`); arAll(); return true; }
    const use = q('[data-ariuse]'); if (use) { AR.model = use.dataset.ariuse; arAll(); arToast(`Ari uses ${arM(AR.model).n} now`); return true; }
    const get = q('[data-arget]'); if (get) { const m = ARLM.find(x => x.id === get.dataset.arget); m.dl = 0; arAll();
      const t = setInterval(() => { m.dl = Math.min(100, m.dl + 3 + Math.random() * 5); if (m.dl >= 100) { clearInterval(t); delete m.dl; m.have = true; arToast(`${m.n} is ready`); arAll(); return; } arSide(); if (AR.view === 'models') arMain(); }, 260); return true; }
    const f = q('[data-arifilter]'); if (f) { AR.filter = f.dataset.arifilter; arMain(); arBar(); return true; }
    const st = q('[data-aristore]'); if (st) { AR.store = st.dataset.aristore; arMain(); arBar(); return true; }
    const td = q('[data-aritodo]'); if (td) { arToast(td.dataset.aritodo); return true; }
    return false; }
  /* Phone: choosing something in the Places drawer closes it (Leaf, Weather, Ari) */
  document.addEventListener('click', e => { const w = e.target.closest?.('#w-leaf, #w-weather, #w-ari'); if (w?.classList.contains('navopen') && e.target.closest('[data-lfshelf], [data-wxp], [data-wxpick], [data-aric], [data-ariview], [data-arinew], [data-lfadd]')) w.classList.remove('navopen'); });
  function renderAri() { $('#ari-top').innerHTML = `${NAVBTN}<img src="${A}ari.svg" alt=""><b>Ari</b><span class="chev">${ic('chevron-down')}</span>`; arAll(); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-apkey]')) { AP.key = e.target.value; const c = $('#ari-sheet [data-aptest]'); if (c) c.disabled = AP.key.length <= 6; } if (e.target.matches?.('[data-apurl]')) AP.url = e.target.value;
    if (e.target.matches?.('[data-ariq]')) { const t = e.target; t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; $('#ari-bar .send')?.classList.toggle('go', !!t.value.trim() || AR.busy); }
    if (e.target.matches?.('[data-arisq]')) { AR.q = e.target.value; arMain(); } });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'ari') return;
    if (e.key === 'Enter' && !e.shiftKey && e.target.matches?.('[data-ariq]')) { e.preventDefault(); $('[data-arisend]')?.click(); }
    if (e.key === 'Escape') { $('#ari-pop')?.remove(); if ($('#w-ari').classList.contains('arion')) arSheetClose(); } });

  /* ══ Canvas ══════════════════════════════════════════════════════════════════
     The whole window is the work. Tools live in the floating bar at the bottom. Layers float top left and fold
     away to a pill; the inspector appears top right only when something is selected, and says what it is.
     Press \ and everything but the work disappears. These parts are the suite's: Grid, Stage and Session use
     the same panels, the same bar and the same inspector, so a shape in one is a shape in all of them. */
  const cvI = (k, p) => { SVG[k] = SVG[k] || mk(p); };

  const CVFONT = { Figtree: 'Figtree, system-ui, sans-serif', 'Instrument Serif': "'Instrument Serif', Georgia, serif", Georgia: 'Georgia, serif', Mono: "ui-monospace, 'JetBrains Mono', monospace" };
  const CVSW = ['#16161a', '#ffffff', '#f6f3ee', '#e9e2d6', '#1a1f3a', '#6f7cff', '#aab4ff', '#e8553b', '#f2b544', '#3ddc84', '#5a5a60', '#c9ccdf'];
  const CVSIZE = [['Instagram post', 1080, 1080], ['Story', 1080, 1920], ['Desktop', 1440, 900], ['Phone', 390, 844], ['A4', 595, 842], ['A3', 842, 1191], ['Letter', 612, 792], ['Slide', 1920, 1080]];
  let CVID = 1;
  const CV = { nodes: [], sel: [], hover: null, tool: 'move', cam: { x: 0, y: 0, z: .3 }, left: true, focus: false, tab: 'layers', itab: 'design', pen: null, edit: null, open: {}, exp: { fmt: 'PNG', sc: 2 }, page: 'Launch', drag: null, marq: null, pop: null, fitted: false };
  const cvG = id => CV.nodes.find(n => n.id === id), cvKids = id => CV.nodes.filter(n => n.parent === id), cvSel = () => CV.sel.map(cvG).filter(Boolean);
  const cvDesc = id => cvKids(id).flatMap(k => [k, ...cvDesc(k.id)]);
  function cvAdd(o) { const n = { id: 'n' + CVID++, op: 1, rot: 0, r: 0, parent: null, fill: '#d9d9d9', ...o }; if (n.parent) { const p = cvG(n.parent); n.x += p.x; n.y += p.y; } CV.nodes.push(n); return n; }
  const cvT = (o) => cvAdd({ t: 'text', ff: 'Figtree', fw: 400, fs: 32, lh: 1.2, ls: 0, color: '#ffffff', align: 'left', h: Math.round((o.fs || 32) * (o.lh || 1.2)), ...o });
  (function seed() {
    const a = cvAdd({ t: 'frame', name: 'Post', x: 0, y: 0, w: 1080, h: 1080, fill: 'linear-gradient(160deg, #1d2346, #0b0d18)' }).id;
    cvAdd({ t: 'ellipse', name: 'Glow', parent: a, x: 520, y: -220, w: 820, h: 820, fill: 'radial-gradient(circle, rgba(111,124,255,.75), rgba(111,124,255,0) 68%)' });
    cvT({ name: 'Eyebrow', parent: a, x: 96, y: 112, w: 600, text: 'LUMA 1.0', fs: 34, fw: 600, ls: .22, color: '#aab4ff' });
    cvT({ name: 'Headline', parent: a, x: 96, y: 172, w: 900, h: 290, text: 'A better computer.', fs: 142, fw: 650, lh: 1, ls: -.035, color: '#ffffff' });
    cvAdd({ t: 'image', name: 'Photo', parent: a, x: 96, y: 520, w: 888, h: 420, r: 32, img: PH + 'life-hero-studio.webp' });
    cvT({ name: 'Date', parent: a, x: 96, y: 980, w: 800, text: 'October 14 · simplyluma.com', fs: 30, color: '#c9ccdf' });
    const b = cvAdd({ t: 'frame', name: 'Web hero', x: 1240, y: 0, w: 1440, h: 900, fill: '#f6f3ee' }).id;
    cvT({ name: 'Wordmark', parent: b, x: 64, y: 34, w: 200, text: 'Luma', fs: 30, fw: 700, ls: -.02, color: '#16161a' });
    cvT({ name: 'Nav', parent: b, x: 1030, y: 40, w: 350, text: 'Features   Apps   Download', fs: 20, color: '#5a5a60', align: 'right' });
    cvT({ name: 'Headline', parent: b, x: 64, y: 210, w: 700, h: 190, text: 'Your computer, calm again.', fs: 84, fw: 650, lh: 1.04, ls: -.03, color: '#16161a' });
    cvT({ name: 'Subhead', parent: b, x: 64, y: 430, w: 600, h: 72, text: 'Luma 1.0 arrives October 14. Free on every computer you own.', fs: 26, lh: 1.4, color: '#5a5a60' });
    cvAdd({ t: 'rect', name: 'Button', parent: b, x: 64, y: 548, w: 264, h: 72, r: 36, fill: '#16161a' });
    cvT({ name: 'Button label', parent: b, x: 64, y: 569, w: 264, text: 'Download Luma', fs: 24, fw: 600, color: '#ffffff', align: 'center' });
    cvAdd({ t: 'image', name: 'Hero image', parent: b, x: 790, y: 150, w: 586, h: 640, r: 32, img: PH + 'life-hero-writing.webp', shadow: true });
    const c = cvAdd({ t: 'frame', name: 'Poster A3', x: 2780, y: 0, w: 842, h: 1191, fill: '#e9e2d6' }).id;
    cvAdd({ t: 'image', name: 'Photo', parent: c, x: 56, y: 56, w: 730, h: 720, img: PH + 'life-sync-terrace.webp' });
    cvT({ name: 'Title', parent: c, x: 56, y: 822, w: 730, h: 170, text: 'Come see what’s next.', ff: 'Instrument Serif', fs: 88, lh: 1, ls: -.01, color: '#1d1a15' });
    cvT({ name: 'Details', parent: c, x: 56, y: 1070, w: 730, text: 'Launch night · The Loft · October 14, 7:30 pm', fs: 26, color: '#5b5448' });
    cvAdd({ t: 'ellipse', name: 'Sticker', parent: c, x: 626, y: 700, w: 150, h: 150, fill: '#e8553b', rot: -12 });
    cvT({ name: 'Sticker label', parent: c, x: 626, y: 752, w: 150, text: 'FREE', fs: 36, fw: 800, color: '#ffffff', align: 'center', rot: -12 });
    CV.sel = [CV.nodes.find(n => n.name === 'Headline').id];
  })();

  /* ── Drawing the work ── */
  const cvPD = n => n.pts.map((p, i) => `${i ? 'L' : 'M'}${p[0] - n.x} ${p[1] - n.y}`).join(' ') + (n.closed ? 'Z' : '');
  function cvHTML(n) { const p = n.parent ? cvG(n.parent) : null, x = n.x - (p ? p.x : 0), y = n.y - (p ? p.y : 0);
    let st = `left:${x}px;top:${y}px;width:${n.w}px;height:${n.h}px;${n.op < 1 ? `opacity:${n.op};` : ''}${n.rot ? `transform:rotate(${n.rot}deg);` : ''}${n.hidden ? 'display:none;' : ''}`;
    if (n.t === 'frame' || n.t === 'rect') st += `background:${n.fill};border-radius:${n.r}px;`; if (n.t === 'ellipse') st += `background:${n.fill};`;
    if (n.t === 'image') st += `background-image:url('${n.img}');border-radius:${n.r}px;`; if (n.stroke && n.t !== 'path') st += `box-shadow:inset 0 0 0 ${n.stroke.w}px ${n.stroke.c};`; if (n.shadow) st += 'filter:drop-shadow(0 30px 40px rgba(0,0,0,.28));';
    const inner = n.t === 'text' ? `<span class="cvtx" style="font-family:${CVFONT[n.ff]};font-size:${n.fs}px;font-weight:${n.fw};line-height:${n.lh};letter-spacing:${n.ls}em;color:${n.color};text-align:${n.align}"${CV.edit === n.id ? ' contenteditable="true" spellcheck="false"' : ''}>${esc(n.text)}</span>`
      : n.t === 'path' ? `<svg width="${Math.max(1, n.w)}" height="${Math.max(1, n.h)}" overflow="visible"><path d="${cvPD(n)}" fill="${n.closed ? n.fill : 'none'}" stroke="${n.stroke?.c || '#16161a'}" stroke-width="${n.stroke?.w || 4}" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '';
    return `<div class="cvn cv-${n.t}" data-cvn="${n.id}" style="${st}">${inner}${cvKids(n.id).map(cvHTML).join('')}</div>`; }
  function cvDraw() { const sp = $('#cv-space'); if (!sp) return; const { x, y, z } = CV.cam; sp.style.transform = `translate(${x}px, ${y}px) scale(${z})`; sp.style.setProperty('--iz', 1 / z);
    const work = $('#cv-work'); const g = Math.max(32, 64 * z); work.style.backgroundSize = `${g}px ${g}px`;   // dots stay far apart, and never crowd when zoomed out work.style.backgroundPosition = `${x}px ${y}px`;
    sp.innerHTML = CV.nodes.filter(n => !n.parent).map(n => (n.t === 'frame' ? `<b class="cvlab${CV.sel.includes(n.id) ? ' on' : ''}" data-cvn="${n.id}" style="left:${n.x}px;top:${n.y}px">${esc(n.name)}</b>` : '') + cvHTML(n)).join('');
    if (CV.edit) { const s = $(`[data-cvn="${CV.edit}"] .cvtx`); if (s && document.activeElement !== s) { s.focus(); const r = document.createRange(); r.selectNodeContents(s); getSelection().removeAllRanges(); getSelection().addRange(r); s.addEventListener('blur', cvEndEdit, { once: true }); } }
    cvOver(); }
  const cvScr = n => ({ x: n.x * CV.cam.z + CV.cam.x, y: n.y * CV.cam.z + CV.cam.y, w: n.w * CV.cam.z, h: n.h * CV.cam.z });
  function cvOver() { const o = $('#cv-over'); if (!o) return; const S = cvSel(); let h = '';
    const hv = CV.hover && !CV.sel.includes(CV.hover) && cvG(CV.hover); if (hv && !CV.drag) { const r = cvScr(hv); h += `<i class="cvhov" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></i>`; }
    if (S.length && !CV.edit) { const b = cvBounds(S), r = { x: b.x * CV.cam.z + CV.cam.x, y: b.y * CV.cam.z + CV.cam.y, w: b.w * CV.cam.z, h: b.h * CV.cam.z };
      if (S.length > 1) h += S.map(n => { const q = cvScr(n); return `<i class="cvhov sel" style="left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px"></i>`; }).join('');
      h += `<div class="cvbox" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">${S.length === 1 && S[0].t !== 'path' ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(d => `<i class="cvh ${d}" data-cvh="${d}"></i>`).join('') : ''}<em>${Math.round(b.w)} × ${Math.round(b.h)}</em></div>`; }
    if (CV.marq) { const m = CV.marq; h += `<i class="cvmarq" style="left:${Math.min(m.x0, m.x1)}px;top:${Math.min(m.y0, m.y1)}px;width:${Math.abs(m.x1 - m.x0)}px;height:${Math.abs(m.y1 - m.y0)}px"></i>`; }
    if (CV.pen) { const pts = [...CV.pen.pts, CV.pen.cur].filter(Boolean).map(p => [p[0] * CV.cam.z + CV.cam.x, p[1] * CV.cam.z + CV.cam.y]); h += `<svg class="cvpen"><path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')}"/>${pts.slice(0, -1).map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i ? 4 : 5.5}" class="${i ? '' : 'first'}"/>`).join('')}</svg>`; }
    o.innerHTML = h; }
  const cvBounds = S => { const x = Math.min(...S.map(n => n.x)), y = Math.min(...S.map(n => n.y)), X = Math.max(...S.map(n => n.x + n.w)), Y = Math.max(...S.map(n => n.y + n.h)); return { x, y, w: X - x, h: Y - y }; };
  function cvFit(ids) { const w = $('#cv-work'); if (!w) return; const narrow = w.clientWidth < 560;
    /* on a phone, one artboard at a time fills the width (pan or pinch to the next); on a desktop, everything */
    const S = (ids || CV.nodes.filter(n => !n.parent).map(n => n.id).slice(0, narrow ? 1 : 99)).map(cvG), b = cvBounds(S), W = w.clientWidth, H = w.clientHeight;
    if (narrow) { const T = 150, B = 120, z = Math.min(2, (W - 32) / b.w, (H - T - B) / b.h); CV.cam = { z, x: (W - b.w * z) / 2 - b.x * z, y: T + (H - T - B - b.h * z) / 2 - b.y * z }; return; }
    const ph = cvPhone(), padL = CV.left && !CV.focus && !ph ? 290 : ph ? 16 : 50, padR = CV.sel.length && !CV.focus && !ph ? 316 : ph ? 16 : 50, z = Math.min(2, (W - padL - padR) / b.w, (H - 150) / b.h); CV.cam = { z, x: padL + (W - padL - padR - b.w * z) / 2 - b.x * z, y: 60 + (H - 150 - b.h * z) / 2 - b.y * z }; }
  function cvZoom(z, cx, cy) { const w = $('#cv-work'), c = CV.cam; cx ??= w.clientWidth / 2; cy ??= w.clientHeight / 2; z = Math.max(.05, Math.min(8, z)); c.x = cx - (cx - c.x) * z / c.z; c.y = cy - (cy - c.y) * z / c.z; c.z = z; cvDraw(); cvPanels(); }

  /* ── The panels ── */
  const CVIC = { frame: 'hash', rect: 'square', ellipse: 'circle', text: 'type', image: 'image', path: 'pen-tool' };
  function cvLayers() { const row = (n, d) => { const k = cvKids(n.id), open = CV.open[n.id] ?? true;
      return `<div class="sulyr${CV.sel.includes(n.id) ? ' on' : ''}${n.hidden ? ' off' : ''}" style="--d:${d}" data-cvsel="${n.id}">${k.length ? `<button class="sucar${open ? ' open' : ''}" type="button" data-cvopen="${n.id}">${ic('chevron-right')}</button>` : '<i class="sucar"></i>'}${ic(CVIC[n.t])}<span>${esc(n.name)}</span><button class="sueye" type="button" data-cveye="${n.id}" title="${n.hidden ? 'Show' : 'Hide'}" aria-label="${n.hidden ? 'Show' : 'Hide'} ${esc(n.name)}">${ic(n.hidden ? 'eye-off' : 'eye')}</button></div>${open ? k.slice().reverse().map(c => row(c, d + 1)).join('') : ''}`; };
    return CV.nodes.filter(n => !n.parent).slice().reverse().map(n => row(n, 0)).join(''); }
  function cvAssets() { return `<h6 class="suh">Colours</h6><div class="susw">${CVSW.map(c => `<button type="button" style="--c:${c}" data-cvsw="${c}" title="${c}"></button>`).join('')}</div>
      <h6 class="suh">Text styles</h6>${[['Display', 'Figtree', 650, 96], ['Heading', 'Figtree', 600, 48], ['Body', 'Figtree', 400, 24], ['Serif', 'Instrument Serif', 400, 64]].map(([n, f, w, s]) => `<button class="suts" type="button" data-cvts="${n}" data-f="${f}" data-w="${w}" data-s="${s}"><b style="font-family:${CVFONT[f]};font-weight:${w}">Ag</b><span>${n}<small>${f} · ${s}</small></span></button>`).join('')}
      <h6 class="suh">Components</h6><div class="sucomp">${[['button', 'Button'], ['badge', 'Badge'], ['card', 'Photo card']].map(([k, n]) => `<button type="button" data-cvcomp="${k}"><i class="cvc-${k}"></i><span>${n}</span></button>`).join('')}</div>
      <h6 class="suh">Photos</h6><div class="suph">${['life-hero-home', 'life-ari-street', 'life-professionals-loft', 'life-suite-bg-darkroom', 'life-suite-bg-stage', 'life-sync-terrace'].map(p => `<button type="button" data-cvimg="${p}" style="background-image:url('${PH}${p}.webp')"></button>`).join('')}</div>`; }
  function cvLeft() { const el = $('#cv-left'); el.classList.toggle('min', !CV.left || CV.focus); el.classList.toggle('gone', CV.focus);
    el.innerHTML = !CV.left ? `<button class="supill" type="button" data-cvleft>${ic('layers')}<b>${CV.page}</b><span>${CV.nodes.length} layers</span></button>`
      : `<header class="suph1"><button class="supage" type="button" data-cvpage><b>${CV.page}</b>${ic('chevron-down')}</button><button class="ib" type="button" data-cvleft title="Hide layers" aria-label="Hide layers">${ic(cvPhone() ? 'x' : 'panel-left')}</button></header>
        ${seg([['layers', 'Layers'], ['assets', 'Assets']], CV.tab, 'data-cvtab', 'Panel', 'sutabs')}<div class="suscroll">${CV.tab === 'layers' ? cvLayers() : cvAssets()}</div>`; }
  const cvHex = c => /^#/.test(c) ? c.toUpperCase().slice(1) : c.includes('gradient') ? 'Gradient' : c;
  function cvInsp() { const el = $('#cv-right'), S = cvSel(); el.classList.toggle('gone', CV.focus);
    const zp = $('#cv-zoompill'); if (zp) { zp.innerHTML = `${Math.round(CV.cam.z * 100)}%${ic('chevron-down')}`; zp.classList.toggle('gone', CV.focus); }   // zoom is a tool for now, so it sits in the bottom corner (as in Write)
    if (!S.length) { el.className = 'supanel r min gone'; el.innerHTML = ''; return; }   // nothing selected: no inspector; Export lives with Share at the top right
    if (cvPhone() && !CV.pinsp && !cvNarrow()) { el.className = 'supanel r min' + (CV.focus ? ' gone' : ''); el.innerHTML = `<button class="supill" type="button" data-cvpinsp>${ic(S.length === 1 ? CVIC[S[0].t] : 'layers')}<b>${S.length === 1 ? esc(S[0].name) : S.length + ' layers'}</b></button>`; return; }
    el.className = 'supanel r' + (CV.focus ? ' gone' : '');
    const n = S[0], one = S.length === 1, p = one && n.parent ? cvG(n.parent) : null, fld = (k, label, v, unit = '') => `<label class="sufld"><span>${label}</span><input data-cvp="${k}" value="${v}" inputmode="decimal">${unit ? `<em>${unit}</em>` : ''}</label>`;
    const clr = (k, c) => `<div class="suclrrow"><button class="suclr" type="button" data-cvclr="${k}" style="--c:${c}"></button><input class="suhex" data-cvp="${k}" value="${cvHex(c)}" spellcheck="false"${c.includes('gradient') ? ' readonly' : ''}></div>`;
    const sec = (t, body, add) => `<section class="susec"><header><b>${t}</b>${add || ''}</header>${body}</section>`;
    const head = `<header class="suinsph">${one ? `${ic(CVIC[n.t])}<input class="suname" data-cvname value="${esc(n.name)}" spellcheck="false">` : `${ic('layers')}<b>${S.length} layers</b>`}<button class="ib" type="button" data-cvmore title="More" aria-label="More">${ic('ellipsis')}</button><button class="ib suphx" type="button" data-cvpinsp title="Close" aria-label="Close">${ic('x')}</button></header>
      ${seg([['design', 'Design'], ['export', 'Export']], CV.itab, 'data-cvitab', 'Inspector', 'sutabs')}`;
    let body = '';
    if (CV.itab === 'export') { const f = one && n.t === 'frame' ? n : (p || n), sc = CV.exp.fmt === 'SVG' || CV.exp.fmt === 'PDF' ? 1 : CV.exp.sc, s = Math.min(236 / f.w, 150 / f.h);
      body = `<div class="suexp"><div class="suprev" style="width:${f.w * s}px;height:${f.h * s}px"><div style="transform:scale(${s});transform-origin:0 0;width:${f.w}px;height:${f.h}px;position:relative">${cvHTML({ ...f, x: 0, y: 0, parent: null }).replace(/data-cvn="[^"]*"/g, '')}</div></div>
        ${sec('Format', seg(['PNG', 'JPG', 'SVG', 'PDF'].map(x => [x, x]), CV.exp.fmt, 'data-cvfmt', 'Format'))}${sec('Size', `${seg([[1, '1×'], [2, '2×'], [3, '3×']], CV.exp.fmt === 'SVG' || CV.exp.fmt === 'PDF' ? 1 : CV.exp.sc, 'data-cvsc', 'Scale')}<p class="sunote">${Math.round(f.w * sc)} × ${Math.round(f.h * sc)} ${CV.exp.fmt === 'PDF' ? 'pt, print ready' : 'px'}</p>`)}
        <button class="bt key suwide" type="button" data-cvexp="${f.id}">${ic('share')}Export ${esc(f.name)}</button></div>`; }
    else if (!one) body = sec('Align', cvAlign()) + sec('Arrange', `<div class="surow2"><button class="bt sm fill" type="button" data-cvwrap>${ic('hash')}Frame selection</button><button class="bt sm fill" type="button" data-cvdist>Distribute</button></div>`);
    else { const px = p ? p.x : 0, py = p ? p.y : 0;
      body = (p ? sec('Align', cvAlign()) : '') + (n.t === 'frame' ? sec('Frame', `<button class="suselect" type="button" data-cvpreset>${(CVSIZE.find(s => s[1] === n.w && s[2] === n.h) || ['Custom'])[0]}${ic('chevron-down')}</button>`) : '')
        + sec('Layout', `<div class="sugrid2">${fld('x', 'X', Math.round(n.x - px))}${fld('y', 'Y', Math.round(n.y - py))}${fld('w', 'W', Math.round(n.w))}${fld('h', 'H', Math.round(n.h))}${fld('rot', '↻', n.rot, '°')}${['frame', 'rect', 'image'].includes(n.t) ? fld('r', '◜', n.r) : '<i></i>'}</div>`)
        + (n.t === 'text' ? sec('Text', `<button class="suselect" type="button" data-cvfont style="font-family:${CVFONT[n.ff]}">${n.ff}${ic('chevron-down')}</button><div class="sugrid2">${fld('fs', 'Size', n.fs)}${fld('fw', 'Weight', n.fw)}${fld('lh', 'Line', n.lh)}${fld('ls', 'Track', n.ls)}</div>${seg([['left', ic('text-align-start'), 'Left'], ['center', ic('text-align-center'), 'Centre'], ['right', ic('text-align-end'), 'Right']], n.align, 'data-cvta', 'Align', 'ico')}${clr('color', n.color)}`) : '')
        + sec('Appearance', `<div class="sugrid2">${fld('op', 'Opacity', Math.round(n.op * 100), '%')}<span></span></div>`)
        + (n.t === 'text' ? '' : n.t === 'image' ? sec('Fill', `<div class="suimg" style="background-image:url('${n.img}')"><button class="bt sm" type="button" data-cvswap>Replace…</button></div>`) : n.t === 'path' ? '' : sec('Fill', clr('fill', n.fill)))
        + sec('Stroke', n.stroke ? `<div class="suclrrow"><button class="suclr" type="button" data-cvclr="stroke" style="--c:${n.stroke.c}"></button><input class="suhex" data-cvp="sc" value="${cvHex(n.stroke.c)}"><label class="sufld sm"><input data-cvp="sw" value="${n.stroke.w}"><em>px</em></label><button class="ib sm" type="button" data-cvunstroke title="Remove">${ic('minus')}</button></div>` : '', n.stroke ? '' : `<button class="ib sm" type="button" data-cvstroke title="Add stroke">${ic('plus')}</button>`)
        + sec('Effects', n.shadow ? `<div class="sueff">${ic('square')}Drop shadow<button class="ib sm" type="button" data-cvshadow title="Remove">${ic('minus')}</button></div>` : '', n.shadow ? '' : `<button class="ib sm" type="button" data-cvshadow title="Add a shadow">${ic('plus')}</button>`); }
    el.innerHTML = head + `<div class="suscroll">${body}</div>`; requestAnimationFrame(segs); if (cvNarrow() && $('#cv-bar .cvpan')) cvBarPhone(); }
  const cvAlign = () => `<div class="sualign">${[['l', 'Left'], ['c', 'Centre'], ['r', 'Right'], ['t', 'Top'], ['m', 'Middle'], ['b', 'Bottom']].map(([k, t]) => `<button class="ib" type="button" data-cval="${k}" title="Align ${t.toLowerCase()}">${ic({ l: 'align-start-vertical', c: 'align-center-vertical', r: 'align-end-vertical', t: 'align-start-horizontal', m: 'align-center-horizontal', b: 'align-end-horizontal' }[k])}</button>`).join('')}</div>`;
  /* Canvas on a phone: the canvas gets the screen; ‹ Launch kit top left, Share and Export top right. One bar in two rows:
     the tools across the top; under a hairline, the page and its layers (tap to grow them in the bar) and the zoom.
     With something selected, the second row is Design (its inspector grows the bar), Duplicate, Delete and Done. */
  const cvNarrow = () => { const w = $('#w-canvas'); return !!w?.classList.contains('phone') && w.clientWidth < 600; };
  function cvBarPhone() { const bar = $('#cv-bar'), S = cvSel(), X = CV.px || '', w = $('#w-canvas'); w.classList.add('cvph'); bar.classList.add('phnofit', 'cvphbar');
    if (!$('#cv-ptop')) $('#cv-work').insertAdjacentHTML('beforeend', `<div class="rlptop" id="cv-ptop"><button class="flo rlback2" type="button" data-cvtodo="Your designs are in Files, under Documents">${ic('chevron-left')}<span>Launch kit</span></button><div class="flo rltopr2"><button class="ib" type="button" data-share aria-label="Share">${ic('share-2')}</button><button class="bt key" type="button" data-cvexpall>${ic('share')}Export</button></div></div>`);
    const t = (k, icn, label) => `<button class="cvt2${CV.tool === k || (k === 'shape' && ['rect', 'ellipse', 'line'].includes(CV.tool)) ? ' on' : ''}" type="button" data-cvtool="${k}" aria-label="${label}">${ic(icn)}</button>`, shapeIc = CV.tool === 'ellipse' ? 'circle' : CV.tool === 'line' ? 'minus' : 'square';
    const ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}<span>${label}</span></button>`;
    const panel = S.length && X === 'insp' ? `<div class="fexp cvpan">${$('#cv-right').innerHTML}</div>` : !S.length && X === 'layers' ? `<div class="fexp cvpan cvlay2"><div class="fexs">${[['layers', 'Layers'], ['assets', 'Assets']].map(([k, n]) => `<button type="button" class="fsch${CV.tab === k ? ' on' : ''}" data-cvtab="${k}">${n}</button>`).join('')}</div>${CV.tab === 'layers' ? cvLayers() : cvAssets()}</div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, `${panel}<div class="cvr1">${t('move', 'mouse-pointer-2', 'Move')}${t('frame', 'hash', 'Frame')}${t('shape', shapeIc, 'Shapes')}${t('pen', 'pen-tool', 'Pen')}${t('text', 'type', 'Text')}${t('image', 'image', 'Image')}${t('hand', 'hand', 'Hand')}</div>
      <div class="cvr2">${S.length ? `${ib('data-cvpx="insp"', 'sliders-horizontal', 'Design', X === 'insp')}${ib('data-cvdo="dup"', 'copy', 'Duplicate')}${ib('data-cvdo="front"', 'bring-to-front', 'Forward')}${ib('data-cvdo="del"', 'trash-2', 'Delete')}${ib('data-cvdesel', 'x', 'Done')}`
        : `<button class="cvpg2${X === 'layers' ? ' on' : ''}" type="button" data-cvpx="layers">${ic('layers')}<span><b>${esc(CV.page)}</b><small>${CV.nodes.length} layers</small></span>${ic('chevron-down')}</button><span class="sp"></span><button class="cvz2" type="button" data-cvdo="zoom">${Math.round(CV.cam.z * 100)}%</button>`}</div>`);
    $('#cv-work').dataset.tool = CV.tool; }
  function cvTools() { if (cvNarrow()) return cvBarPhone(); $('#w-canvas').classList.remove('cvph'); $('#cv-bar').classList.remove('phnofit', 'cvphbar', 'phgrow'); $('#cv-ptop')?.remove();
    const t = (k, icn, label, key) => `<button class="sut${CV.tool === k || (k === 'shape' && ['rect', 'ellipse', 'line'].includes(CV.tool)) ? ' on' : ''}" type="button" data-cvtool="${k}" title="${label} · ${key}">${ic(icn)}${k === 'shape' ? '<i class="sumore"></i>' : ''}</button>`;
    const shapeIc = CV.tool === 'ellipse' ? 'circle' : CV.tool === 'line' ? 'minus' : 'square';
    setBar($('#cv-bar'), `${t('move', 'mouse-pointer-2', 'Move', 'V')}${t('frame', 'hash', 'Frame', 'F')}${t('shape', shapeIc, 'Shapes', 'R')}${t('pen', 'pen-tool', 'Pen', 'P')}${t('text', 'type', 'Text', 'T')}${t('image', 'image', 'Image', 'I')}<span class="vr"></span>${t('hand', 'hand', 'Hand', 'H')}${t('comment', 'message-circle', 'Comment', 'C')}`);
    $('#cv-work').dataset.tool = CV.tool; }
  function cvPanels() { cvLeft(); cvInsp(); }
  function cvAll() { cvDraw(); cvPanels(); cvTools(); cvTopR(); }
  const cvPhone = () => $('#w-canvas').classList.contains('phone');
  function cvTopR() { const el = $('#cv-topr'); if (el) el.innerHTML = `<button class="ib${CV.focus ? ' on' : ''}" type="button" data-cvfocus title="Focus (\\)" aria-label="Focus">${ic('scan-eye')}</button><span class="vr"></span><span class="wravs" title="Priya and Nora are here">${av('PR', 26)}${av('NF', 26)}</span><button class="bt sm fill" type="button" data-share>${ic('share-2')}Share</button><button class="bt sm fill" type="button" data-cvexpall title="Export every frame" aria-label="Export">${ic('share')}Export</button><button class="ib" type="button" data-lmenu data-docmore title="More" aria-label="More">${ic('ellipsis')}</button>`; }
  const cvToast = (msg, o) => lToast($('#w-canvas'), msg, o);   // one notice for the whole OS
  function cvPop(anchor, html, up) { $('#cv-pop')?.remove(); const w = $('#w-canvas'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop supop" id="cv-pop">${html}</div>`); const p = $('#cv-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left + r.width / 2 - p.offsetWidth / 2)) + 'px'; if (up) p.style.bottom = (wr.bottom - r.top + 8) + 'px'; else p.style.top = (r.bottom - wr.top + 6) + 'px'; }

  /* ── Editing ── */
  function cvEndEdit() { const n = cvG(CV.edit); if (!n) { CV.edit = null; return; } const s = $(`[data-cvn="${n.id}"] .cvtx`); if (s) { n.text = s.textContent.trim() || 'Text'; n.h = Math.max(Math.round(n.fs * n.lh), Math.round(s.offsetHeight)); } CV.edit = null; cvAll(); }
  const cvFrameAt = (x, y) => CV.nodes.filter(n => n.t === 'frame' && !n.parent && x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h).pop();
  function cvDel() { const was = CV.nodes.slice(), sel = CV.sel.slice(), S = cvSel(), kill = new Set(CV.sel.flatMap(id => [id, ...cvDesc(id).map(k => k.id)])); CV.nodes = CV.nodes.filter(n => !kill.has(n.id)); CV.sel = []; cvAll();
    if (S.length) cvToast(S.length === 1 ? `Deleted ${esc(S[0].name)}` : `Deleted ${S.length} layers`, { icon: 'trash-2', undo: () => { CV.nodes = was; CV.sel = sel; cvAll(); } }); }
  function cvDup() { const clone = (m, parent) => { const c = { ...m, id: 'n' + CVID++, parent, x: m.x + 24, y: m.y + 24 }; if (m.stroke) c.stroke = { ...m.stroke }; if (m.pts) c.pts = m.pts.map(p => [p[0] + 24, p[1] + 24]); CV.nodes.push(c); cvKids(m.id).forEach(k => clone(k, c.id)); return c; };
    CV.sel = cvSel().map(n => clone(n, n.parent).id); cvAll(); }
  function cvAlignDo(k) { const S = cvSel(), ref = S.length > 1 ? cvBounds(S) : cvG(S[0].parent); if (!ref) return;
    S.forEach(n => { const dx = k === 'l' ? ref.x - n.x : k === 'c' ? ref.x + ref.w / 2 - n.w / 2 - n.x : k === 'r' ? ref.x + ref.w - n.w - n.x : 0, dy = k === 't' ? ref.y - n.y : k === 'm' ? ref.y + ref.h / 2 - n.h / 2 - n.y : k === 'b' ? ref.y + ref.h - n.h - n.y : 0; cvMove(n, dx, dy); }); cvAll(); }
  const cvMove = (n, dx, dy) => { [n, ...cvDesc(n.id)].forEach(m => { m.x = Math.round(m.x + dx); m.y = Math.round(m.y + dy); if (m.pts) m.pts = m.pts.map(p => [p[0] + dx, p[1] + dy]); }); };
  function cvComp(k) { const f = cvSel()[0] ? (cvSel()[0].t === 'frame' ? cvSel()[0] : cvG(cvSel()[0].parent)) : null, fr = f || CV.nodes.find(n => n.t === 'frame'), x = 80, y = 80; let made = [];
    if (k === 'button') { made = [cvAdd({ t: 'rect', name: 'Button', parent: fr.id, x, y, w: 240, h: 64, r: 32, fill: '#6f7cff' }), cvT({ name: 'Button label', parent: fr.id, x, y: y + 17, w: 240, text: 'Get Luma', fs: 24, fw: 600, align: 'center' })]; }
    else if (k === 'badge') made = [cvAdd({ t: 'rect', name: 'Badge', parent: fr.id, x, y, w: 150, h: 44, r: 22, fill: '#f2b544' }), cvT({ name: 'Badge label', parent: fr.id, x, y: y + 9, w: 150, text: 'NEW', fs: 20, fw: 700, ls: .1, color: '#16161a', align: 'center' })];
    else made = [cvAdd({ t: 'image', name: 'Photo card', parent: fr.id, x, y, w: 320, h: 400, r: 24, img: PH + 'life-ari-street.webp', shadow: true })];
    CV.sel = made.map(m => m.id); cvAll(); cvToast(`Added to ${fr.name}`); }

  /* Pointer: select, move, resize, draw, pan */
  function cvPtr(e) { const w = $('#cv-work'); if (!w || e.button > 1 || e.target.closest('.supanel, .fbar, .crpop, .wrzoom')) return; const wr = w.getBoundingClientRect(), sx = e.clientX - wr.left, sy = e.clientY - wr.top, c = CV.cam, cx = (sx - c.x) / c.z, cy = (sy - c.y) / c.z;
    $('#cv-pop')?.remove(); if (CV.edit && !e.target.closest(`[data-cvn="${CV.edit}"]`)) cvEndEdit(); if (CV.edit) return;
    const tool = e.button === 1 || CV.space ? 'hand' : CV.tool, hid = e.target.closest('[data-cvh]')?.dataset.cvh, hitEl = e.target.closest('#cv-space [data-cvn]'), hit = hitEl ? cvG(hitEl.dataset.cvn) : null;
    let D = null;
    if (tool === 'hand') D = { k: 'pan', sx, sy, x0: c.x, y0: c.y };
    else if (tool === 'pen') { CV.pen = CV.pen || { pts: [] }; const f = CV.pen.pts[0]; if (f && CV.pen.pts.length > 2 && Math.hypot((f[0] - cx) * c.z, (f[1] - cy) * c.z) < 10) { cvPenEnd(true); return; } CV.pen.pts.push([Math.round(cx), Math.round(cy)]); cvOver(); return; }
    else if (tool === 'text') { const fr = cvFrameAt(cx, cy), n = cvT({ name: 'Text', x: Math.round(cx), y: Math.round(cy), w: 420, text: 'Type something', fs: fr ? 48 : 32, color: fr && /f6|e9|ff/i.test(fr.fill) ? '#16161a' : '#ffffff' }); n.parent = fr?.id || null; CV.sel = [n.id]; CV.edit = n.id; CV.tool = 'move'; cvAll(); return; }
    else if (tool === 'comment') { cvToast('Comments are pinned where you click'); return; }
    else if (['frame', 'rect', 'ellipse', 'line', 'image'].includes(tool)) { const fr = tool === 'frame' ? null : cvFrameAt(cx, cy), base = { x: Math.round(cx), y: Math.round(cy), w: 0, h: 0 };
      const n = tool === 'line' ? cvAdd({ t: 'path', name: 'Line', ...base, pts: [[cx, cy], [cx, cy]], stroke: { c: '#16161a', w: 4 } }) : cvAdd({ t: tool, name: { frame: 'Frame', rect: 'Rectangle', ellipse: 'Ellipse', image: 'Image' }[tool], ...base, fill: tool === 'frame' ? '#ffffff' : '#d9d9d9', img: tool === 'image' ? PH + 'life-hero-home.webp' : undefined });
      n.parent = fr?.id || null; CV.sel = [n.id]; D = { k: 'draw', n, x0: cx, y0: cy }; }
    else if (hid) { const n = cvSel()[0]; D = { k: 'size', d: hid, n, r0: { x: n.x, y: n.y, w: n.w, h: n.h }, x0: cx, y0: cy }; }
    else if (hit) { if (e.shiftKey) CV.sel = CV.sel.includes(hit.id) ? CV.sel.filter(i => i !== hit.id) : [...CV.sel, hit.id]; else if (!CV.sel.includes(hit.id)) CV.sel = [hit.id];
      if (e.detail === 2 && hit.t === 'text') { CV.edit = hit.id; cvAll(); return; } D = { k: 'move', x0: cx, y0: cy, last: [0, 0] }; }
    else { if (!e.shiftKey) CV.sel = []; D = { k: 'marq', sx, sy }; CV.marq = { x0: sx, y0: sy, x1: sx, y1: sy }; }
    CV.drag = D; cvDraw(); cvPanels(); w.setPointerCapture?.(e.pointerId); }
  function cvPtrMove(e) { const w = $('#cv-work'); if (!w) return; const wr = w.getBoundingClientRect(), sx = e.clientX - wr.left, sy = e.clientY - wr.top, c = CV.cam, cx = (sx - c.x) / c.z, cy = (sy - c.y) / c.z, D = CV.drag;
    if (!D) { if (CV.pen) { CV.pen.cur = [cx, cy]; cvOver(); return; } const h = e.target.closest?.('#cv-space [data-cvn]')?.dataset.cvn || null; if (h !== CV.hover) { CV.hover = h; cvOver(); } return; }
    if (D.k === 'pan') { c.x = D.x0 + sx - D.sx; c.y = D.y0 + sy - D.sy; cvDraw(); return; }
    if (D.k === 'move') { const dx = Math.round(cx - D.x0), dy = Math.round(cy - D.y0); cvSel().forEach(n => cvMove(n, dx - D.last[0], dy - D.last[1])); D.last = [dx, dy]; D.moved = true; cvDraw(); return; }
    if (D.k === 'draw') { const n = D.n; if (n.t === 'path') { n.pts[1] = [cx, cy]; n.x = Math.min(D.x0, cx); n.y = Math.min(D.y0, cy); n.w = Math.abs(cx - D.x0); n.h = Math.abs(cy - D.y0); } else { let W = cx - D.x0, H = cy - D.y0; if (e.shiftKey) { const s = Math.max(Math.abs(W), Math.abs(H)); W = Math.sign(W || 1) * s; H = Math.sign(H || 1) * s; } n.x = Math.round(Math.min(D.x0, D.x0 + W)); n.y = Math.round(Math.min(D.y0, D.y0 + H)); n.w = Math.round(Math.abs(W)); n.h = Math.round(Math.abs(H)); } cvDraw(); return; }
    if (D.k === 'size') { const r = { ...D.r0 }, dx = cx - D.x0, dy = cy - D.y0, d = D.d, n = D.n; if (d.includes('e')) r.w = Math.max(1, D.r0.w + dx); if (d.includes('s')) r.h = Math.max(1, D.r0.h + dy); if (d.includes('w')) { r.w = Math.max(1, D.r0.w - dx); r.x = D.r0.x + D.r0.w - r.w; } if (d.includes('n')) { r.h = Math.max(1, D.r0.h - dy); r.y = D.r0.y + D.r0.h - r.h; }
      if (e.shiftKey && n.t !== 'text') { const k = D.r0.w / D.r0.h; if (d.length === 2 || d === 'e' || d === 'w') r.h = r.w / k; else r.w = r.h * k; }
      Object.assign(n, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }); cvDraw(); return; }
    if (D.k === 'marq') { CV.marq.x1 = sx; CV.marq.y1 = sy; const m = CV.marq, a = { x: (Math.min(m.x0, m.x1) - c.x) / c.z, y: (Math.min(m.y0, m.y1) - c.y) / c.z }, b = { x: (Math.max(m.x0, m.x1) - c.x) / c.z, y: (Math.max(m.y0, m.y1) - c.y) / c.z };
      const inFrame = cvFrameAt(a.x, a.y), pool = CV.nodes.filter(n => !n.hidden && (inFrame ? n.parent === inFrame.id : !n.parent));
      CV.sel = pool.filter(n => n.x < b.x && n.x + n.w > a.x && n.y < b.y && n.y + n.h > a.y).map(n => n.id); cvOver(); } }
  function cvPtrUp() { const D = CV.drag; if (!D) return; CV.drag = null;
    if (D.k === 'draw') { const n = D.n; if (n.w < 4 && n.h < 4) { const def = n.t === 'frame' ? [1080, 1080] : n.t === 'path' ? [200, 0] : [200, 200]; n.w = def[0]; n.h = def[1]; if (n.t === 'path') { n.pts[1] = [n.x + 200, n.y]; } } if (n.t === 'frame') n.name = (CVSIZE.find(s => s[1] === n.w && s[2] === n.h) || ['Frame'])[0]; CV.tool = 'move'; cvTools(); }
    if (D.k === 'marq') CV.marq = null;
    cvDraw(); cvPanels(); }
  function cvPenEnd(closed) { const P = CV.pen; CV.pen = null; if (!P || P.pts.length < 2) { cvOver(); return; } const xs = P.pts.map(p => p[0]), ys = P.pts.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys);
    const n = cvAdd({ t: 'path', name: closed ? 'Shape' : 'Path', x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, pts: P.pts, closed, fill: '#6f7cff', stroke: { c: closed ? '#6f7cff' : '#16161a', w: 4 } }); n.parent = cvFrameAt(x, y)?.id || null; CV.sel = [n.id]; CV.tool = 'move'; cvAll(); }

  function cvClick(e, hit) { const q = s => hit(s);
    if (cvNarrow()) { const px = q('[data-cvpx]'); if (px) { const k = px.dataset.cvpx; CV.px = CV.px === k ? '' : k; cvBarPhone(); return true; }
      if (q('[data-cvdesel]')) { CV.sel = []; CV.px = ''; cvAll(); return true; }
      if (q('#cv-bar [data-cvpinsp]')) { CV.px = ''; cvBarPhone(); return true; }
      const tb = q('[data-cvtab]'); if (tb && q('#cv-bar')) { CV.tab = tb.dataset.cvtab; cvBarPhone(); return true; }
      if (q('[data-cvsel]') && q('#cv-bar')) { setTimeout(() => { CV.px = ''; cvBarPhone(); }); } if (q('[data-cvdo="del"]')) CV.px = ''; }
    if (q('#cv-work') && !q('.supanel, .fbar, .wrzoom')) return true;   // the work area handles its own pointer
    if (!q('#cv-pop')) $('#cv-pop')?.remove();
    const tl = q('[data-cvtool]'); if (tl) { const k = tl.dataset.cvtool; if (k === 'shape') { cvPop(tl, [['rect', 'square', 'Rectangle', 'R'], ['ellipse', 'circle', 'Ellipse', 'O'], ['line', 'minus', 'Line', 'L']].map(([k2, i, n, s]) => `<button class="crmi${CV.tool === k2 ? ' on' : ''}" type="button" data-cvtool="${k2}">${ic(i)}<span>${n}</span><kbd class="sukbd">${s}</kbd></button>`).join(''), true); return true; } $('#cv-pop')?.remove(); if (CV.pen) cvPenEnd(false); CV.tool = k; cvTools(); return true; }
