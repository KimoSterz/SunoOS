    if ((crNarrow() || phTab()) && t && t.msgs.length && CR.open !== 'new' && !CR.tsel) return crBarPhone(bar, t);
    bar.classList.remove('phnofit', 'crphbar', 'phgrow', 'cr2row');
    if (false) { const d = CR.draft;
      h = `<button class="ctxc" type="button" data-crmode>${ic(d.mode === 'fwd' ? 'forward' : d.mode === 'all' ? 'reply-all' : 'reply')}${d.mode === 'fwd' ? 'Forward' : d.mode === 'all' ? 'Reply all' : CR.open === 'new' ? 'New email' : 'Reply'}${CR.open === 'new' ? '' : ic('chevron-down')}</button>
        <button class="ib" type="button" data-crfmt="bold" title="Bold">${ic('bold')}</button><button class="ib" type="button" data-crfmt="italic" title="Italic">${ic('italic')}</button><button class="ib" type="button" data-crfmt="insertUnorderedList" title="List">${ic('list')}</button><button class="ib" type="button" data-crfmt="link" title="Link">${ic('link')}</button><span class="vr"></span>
        <button class="ib" type="button" data-cradd title="Attach">${ic('paperclip')}</button>${CR.open !== 'new' && d.mode !== 'fwd' ? `<button class="ib" type="button" data-crcollapse title="Back to the quick reply">${ic('minimize-2')}</button>` : ''}<button class="ib" type="button" data-crdiscard title="Discard draft">${ic('trash-2')}</button><button class="bt key" type="button" data-crsend>${ic('send-horizontal')}Send</button>`; }
    else if (CR.tsel) { h = `<span class="ctxc crsnip">“${esc(CR.tsel.text.slice(0, 34))}${CR.tsel.text.length > 34 ? '…' : ''}”</span><button class="bt key" type="button" data-crquote>${ic('reply')}Quote in reply</button><button class="bt" type="button" data-crcopy>${ic('copy')}Copy</button>`; }
    else if (CR.att) { const [mid, j] = CR.att.split(':'), m = t.msgs.find(x => x.id === mid), img = j[0] === 'i', f = img ? { n: `Photo ${+j.slice(1) + 1} of ${m.imgs.length}`, k: 'img' } : m.files[+j];
      h = `<span class="ctxc">${img ? `<i class="crth" style="background-image:url(${PH}${m.imgs[+j.slice(1)]}.webp)"></i>` : `<img class="crctxi" src="${A}${(LFK[f.k] || LFK.zip)[1]}.svg" alt="">`}${esc(f.n)}<button type="button" class="crx" data-crdesel aria-label="Done">${ic('x')}</button></span>
        <button class="bt key" type="button" data-cropen>${img ? 'View' : 'Open'}</button><button class="bt" type="button" data-crsave>${ic('download')}Save</button><span class="vr"></span><button class="bt" type="button" data-crreply="one" data-crof="${mid}">${ic('reply')}Reply</button><button class="bt" type="button" data-crfwdatt>${ic('forward')}Forward</button>`; }
    else if (CR.sel && t) { const m = t.msgs.find(x => x.id === CR.sel), mine = m.from === 'me', many = (m.to || []).filter(k => k !== 'me').length + (mine ? 0 : 1) > 1;
      h = `<span class="ctxc">${crAv(m.from, 22)}${mine ? 'Your message' : esc(crFirst(m.from)) + '’s message'}<button type="button" class="crx" data-crdesel aria-label="Done">${ic('x')}</button></span>
        <button class="bt key" type="button" data-crreply="one">${ic('reply')}Reply</button>${many ? `<button class="bt" type="button" data-crreply="all">${ic('reply-all')}Reply all</button>` : ''}<button class="bt" type="button" data-crreply="fwd">${ic('forward')}Forward</button><button class="bt" type="button" data-crcopymsg>${ic('copy')}Copy text</button><span class="vr"></span><button class="ib" type="button" data-crmore="msg" title="More">${ic('ellipsis')}</button>`; }
    else if (t && crIsBrand(t)) { h = `<button class="bt key" type="button" data-crarch>${ic('archive')}Archive</button><button class="bt" type="button" data-crreply="one">${ic('reply')}Reply</button><button class="bt" type="button" data-crreply="fwd">${ic('forward')}Forward</button><span class="vr"></span><button class="ib" type="button" data-crmore="thread" title="More">${ic('ellipsis')}</button>`; }
    else if (t && t.msgs.length) { const c = CR.comp, many = crOthers(t).length > 1, mode = c.mode || (many ? 'all' : 'one'), to = mode === 'all' ? crOthers(t) : [c.re ? (c.re.from === 'me' ? c.re.to[0] : c.re.from) : (crLast(t).from === 'me' ? crLast(t).to[0] : crLast(t).from)];
      bar.classList.add('comp'); bar.hidden = false; setBar(bar, `${c.re ? `<div class="crcre">${ic('reply')}<span>Replying to <b>${esc(crFirst(c.re.from))}\u2019s</b> message</span><button type="button" class="crx" data-crcrex aria-label="Cancel">${ic('x')}</button></div>` : ''}
        <div class="crcrow"><button class="ctxc" type="button" data-crcmode title="Reply, reply all or forward">${ic(mode === 'all' ? 'reply-all' : 'reply')}${mode === 'all' ? 'All' : esc(crFirst(to[0]))}${ic('chevron-down')}</button><button class="crqf" type="button" data-crexpand>${CR.keep?.t === CR.open && CR.keep.html ? `Draft: ${esc(CR.keep.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim())}` : `Reply to ${esc(to.map(crFirst).join(' and '))}\u2026`}</button>
        <button class="ib" type="button" data-cradd2 title="Attach">${ic('paperclip')}</button></div>`);
      return; }
    else if (false) { const many = 0;
      h = `<button class="bt key" type="button" data-crreply="${many ? 'all' : 'one'}">${ic(many ? 'reply-all' : 'reply')}${many ? 'Reply all' : 'Reply'}</button>${many ? `<button class="bt" type="button" data-crreply="one">${ic('reply')}Reply</button>` : ''}<button class="bt" type="button" data-crreply="fwd">${ic('forward')}Forward</button><span class="vr"></span><button class="ib" type="button" data-crmore="thread" title="More">${ic('ellipsis')}</button>`; }
    bar.classList.remove('comp'); bar.hidden = !h; if (h) setBar(bar, h); }
  function crGrow() { const a = $('[data-crtext]'); if (!a) return; a.style.height = 'auto'; a.style.height = Math.min(160, a.scrollHeight) + 'px'; }

  /* Little menus that open from the bar or the header */
  function crPop(anchor, html, up = true) { crPopClose(); const main = $('#w-charlie'), mr = main.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    main.insertAdjacentHTML('beforeend', `<div class="crpop" id="cr-pop">${html}</div>`); const p = $('#cr-pop'), pw = p.offsetWidth;
    p.style.left = Math.max(8, Math.min(mr.width - pw - 8, r.left - mr.left + r.width / 2 - pw / 2)) + 'px';
    if (up) p.style.bottom = (mr.bottom - r.top + 8) + 'px'; else p.style.top = (r.bottom - mr.top + 8) + 'px'; }
  const crPopClose = () => $('#cr-pop')?.remove();
  const crMi = (attr, icn, label, extra = '') => `<button class="crmi${extra}" type="button" ${attr}>${icn ? ic(icn) : ''}<span>${label}</span></button>`;
  function crToast(msg, undo, icon) { lToast($('#w-charlie'), msg, { undo, icon }); }

  /* Drafting */
  function crReply(mode, re) { const t = crT(CR.open); if (!t) return; const base = re || crLast(t);
    const to = mode === 'fwd' ? [] : mode === 'all' ? crOthers(t).filter(k => !CRB[k] || k === base.from) : [base.from === 'me' ? (base.to || [])[0] : base.from];
    const files = t.msgs.reduce((a, m) => a + (m.files?.length || 0) + (m.imgs?.length || 0), 0);
    CR.draft = { t: t.id, mode, to, re: re && mode !== 'fwd' ? { from: re.from, text: (re.text || [re.snip || '']).join(' ').slice(0, 90) + '…' } : null, fwd: mode === 'fwd' ? { subj: t.subj, n: t.msgs.length, files } : null, atts: [], html: '' };
    if (CR.tq) { CR.draft.re = CR.tq; CR.tq = null; }
    CR.sel = null; CR.att = null; CR.tsel = null; crBody(); crBar(); crBottom(true); setTimeout(() => { const el = $('#cr-comp .cr2ed'); el?.focus(); if (el) getSelection().collapse(el, el.childNodes.length); }, 60); }
  function crStartNew(fromDraft) { CR.open = 'new'; CR.newTo = fromDraft ? ['PR', 'NF'] : []; CR.newSubj = fromDraft ? fromDraft.subj : ''; CR.draft = { t: 'new', mode: 'new', to: fromDraft ? ['PR', 'NF'] : [], atts: [], html: fromDraft ? esc(fromDraft.draft) : '', from: fromDraft?.id };
    CR.sel = CR.att = CR.tsel = null; crSide(); crHead(); crBody(); crBar(); crDet(); setTimeout(() => (fromDraft ? $('#cr-comp .cr2ed') : $('[data-crto]'))?.focus(), 60); }
  function crSend() { const d = CR.draft, el = $('#cr-comp .cr2ed'), txt = el ? el.innerText.trim() : '';
    if ((d.mode === 'new' || d.mode === 'fwd') && !d.to.length) { $('[data-crto]')?.focus(); crToast('Add who it’s for first'); return; }
    if (!txt && !d.atts.length && d.mode !== 'fwd') { el?.focus(); el?.closest('.cr2c')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], 260); return; }
    let t = crT(d.t);
    if (CR.open === 'new') { if (d.from) { const i = CRT.findIndex(x => x.id === d.from); if (i >= 0) CRT.splice(i, 1); } t = { id: 'n' + Date.now(), subj: CR.newSubj || '(No subject)', box: 'sent', msgs: [] }; CRT.unshift(t); }
    const m = { id: 'm' + Date.now(), from: 'me', to: d.to, at: 'Now', text: txt ? txt.split(/\n{2,}/) : [d.mode === 'fwd' ? 'Forwarded.' : ''], files: d.atts.length ? d.atts : undefined, sending: true, fresh: true };
    if (!t.msgs.length || t.msgs[t.msgs.length - 1].day !== 'Today') m.day = 'Today';
    t.msgs.push(m); CR.draft = null; CR.open = t.id; const back = { t, m, d };
    crSide(); crHead(); crBody(); crBar(); crBottom(true);
    setTimeout(() => { m.sending = false; const mt = $(`[data-crm="${m.id}"] time`); if (mt) mt.textContent = 'Now · Sent'; }, 900);
    crToast(d.mode === 'fwd' ? 'Forwarded' : 'Sent', () => { t.msgs = t.msgs.filter(x => x !== m); if (!t.msgs.length) CRT.splice(CRT.indexOf(t), 1); CR.draft = d; d.html = esc(txt).replace(/\n/g, '<br>'); CR.open = t.msgs.length ? t.id : 'new'; crSide(); crHead(); crBody(); crBar(); crBottom(); }); }
  function crQuickSend() { const t = crT(CR.open), c = CR.comp, txt = c.text.trim(); if (!txt) { $('[data-crtext]')?.focus(); return; }
    const many = crOthers(t).length > 1, mode = c.mode || (many ? 'all' : 'one'), base = c.re || crLast(t), to = mode === 'all' ? crOthers(t).filter(k => !CRB[k]) : [base.from === 'me' ? base.to[0] : base.from];
    const m = { id: 'm' + Date.now(), from: 'me', to, at: 'Now', text: txt.split(/\n{2,}/), sending: true, fresh: true }; if (crLast(t)?.day !== 'Today') m.day = 'Today';
    t.msgs.push(m); const back = { ...c }; CR.comp = { text: '', mode: null, re: null }; crSide(); crHead(); crBody(); crBar(); crBottom(true);
    setTimeout(() => { m.sending = false; const mt = $(`[data-crm="${m.id}"] time`); if (mt) mt.textContent = 'Now \u00b7 Sent'; }, 900);
    crToast('Sent', () => { t.msgs = t.msgs.filter(x => x !== m); CR.comp = back; crSide(); crBody(); crBar(); crBottom(); }); }
  function crOpen(id) { const t = crT(id); if (!t) return; if (CR.draft && CR.draft.t !== id) CR.draft = null; if (CR.open !== id) CR.comp = { text: '', mode: null, re: null }; CR.open = id; CR.sel = CR.att = CR.tsel = null; crPopClose();
    if (CR.unread && crUn(t)) CR.keep = id; else if (CR.keep !== id) CR.keep = null;
    t.msgs.forEach(m => m.un = false); CR.px = ''; crNav(); crSide(); crHead(); crBody(); crBar(); crDet(); requestAnimationFrame(() => { if (crNarrow()) $('#cr-body').scrollTop = 0; else crBottom(); }); }
  function crSelect(id) { CR.sel = CR.sel === id ? null : id; CR.att = null; $$('#cr-body .crmsg').forEach(x => x.classList.toggle('sel', x.dataset.crm === CR.sel)); $$('#cr-body [data-cratt]').forEach(x => x.classList.remove('sel')); crBar(); }
  function crSuggest() { const i = $('[data-crto]'), s = $('#cr-sug'); if (!i || !s) return; const q = i.value.trim().toLowerCase();
    const pool = ['PR', 'NF', 'SK', 'TH', 'AR', 'MS', 'BO', 'EN'].filter(k => !CR.draft.to.includes(k) && (!q || crWho(k).n.toLowerCase().includes(q) || crMail(k).includes(q)));
    s.hidden = !q; s.innerHTML = pool.slice(0, 5).map(k => `<button class="crmi" type="button" data-crtoadd="${k}">${crAv(k, 24)}<span>${esc(crWho(k).n)}<small>${esc(crMail(k))}</small></span></button>`).join('') || `<p class="crnone">Press Enter to use “${esc(i.value)}”</p>`; }

  /* Details: the LumaUI details pane, for a thread. Closed by default; Info opens it; it closes itself when there's nothing to describe
     (no thread, a new email). People first (a single sender is Contacts' own card), then attachments as file cards, then other threads. */
  function crDet() { const d = $('#cr-det'), t = crT(CR.open), subject = CR.open !== 'new' && t && t.msgs.length && t.box !== 'drafts' ? t : null;
    const on = lDPShow(d, { open: CR.det, subject }); $('#w-charlie').classList.toggle('dpon', on); if (!on) { if (!subject) CR.det = false; return; }
    const o = crOthers(t), files = t.msgs.flatMap(m => (m.files || []).map((f, j) => [f, m.id + ':' + j])), imgs = t.msgs.flatMap(m => (m.imgs || []).map(x => PH + x + '.webp')), acct = CRACCT.find(a => a[0] === (t.acct || 'luma')), brand = crIsBrand(t);
    const row = k => { const f = crFirst(k); return lDP.row({ av: crAv(k, 32), n: crWho(k).n, sub: crMail(k), attr: CRB[k] ? 'disabled' : `data-crpo="${k}" title="${PPL[k] ? 'Open in Contacts' : 'Add to Contacts'}"`,
      acts: CRB[k] ? '' : lDP.act('mail', 'Email ' + f, `data-crto1="${k}"`) + lDP.act('message-square', 'Message ' + f, `data-crpm="${k}"`) }); };
    const also = o.filter(k => !CRB[k]).flatMap(k => CRT.filter(x => x !== t && x.box !== 'trash' && x.msgs.length && crOthers(x).includes(k))).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3), na = files.length + imgs.length;
    d.innerHTML = lDP({ title: 'Details', close: 'data-crppl', body: `<div class="ldphero">${brand ? crAv(t.msgs[0].from, 56) : `<span class="crstk">${o.slice(0, 3).map(k => crAv(k, 48)).join('')}</span>`}<b>${esc(t.subj)}</b><small>${t.msgs.length} message${t.msgs.length > 1 ? 's' : ''} · ${acct ? acct[1] : 'Luma'}</small></div>
      ${o.length === 1 && PPL[o[0]] ? `${lDP.lab('From')}<div class="ldplist">${row(o[0])}</div>${lContactActs(o[0], { size: 'sm' })}` : `${lDP.lab(o.length > 1 ? 'People' : 'From', o.length > 1 ? lCount(o.length + 1) : '')}<div class="ldplist">${o.map(row).join('')}${o.length > 1 ? lDP.row({ av: crAv('me', 32), n: 'You', sub: crMail('me'), attr: 'disabled' }) : ''}</div>`}
      ${na ? `${lDP.lab('Attachments', na > 3 ? `<button type="button" data-crtodo="All ${na} attachments">View all</button>` : '')}${imgs.length ? `<div class="ldpph">${imgs.slice(0, 3).map(src => `<img src="${src}" alt="">`).join('')}</div>` : ''}<div class="crdfiles">${files.map(([f, key]) => crFile(f, key)).join('')}</div>` : ''}
      ${also.length ? `${lDP.lab(`Also with ${o.length > 1 ? 'these people' : crFirst(o[0])}`)}<div class="ldplist">${also.map(x => lDPItem({ lead: ic('mail'), n: x.subj, sub: esc((crLast(x)?.at || '').replace(/ \d.*/, '')), attr: `data-crt="${x.id}"` })).join('')}</div>` : ''}
      ${lStack([{ icon: 'archive', label: 'Archive', attr: 'data-crarch' }, ...(t.id === 'light' ? [{ icon: 'bell-off', label: 'Unsubscribe', attr: 'data-crunsub' }] : []), { icon: 'trash-2', label: 'Delete', attr: 'data-crdel', danger: true }], 'sm')}` }); }

  /* The composer: one rich editor that rises from the bottom, for a reply, a forward or a new email.
     Who it's for sits at its top (a mode for replies, To and Subject for new mail), the tools sit above the text. */
  function crComp() { const c = $('#cr-comp'), d = CR.draft; if (!c) return; const ed0 = c.querySelector('.cr2ed'); if (ed0 && d) d.html = ed0.innerHTML;
    if (!d) { c.hidden = true; c.innerHTML = ''; crPadFit(); return; }
    const was = !c.hidden, isNew = d.mode === 'new', fwd = d.mode === 'fwd', names = d.to.map(k => crWho(k).n), ml = { one: 'Reply', all: 'Reply all', fwd: 'Forward', new: 'New email' }[d.mode], mi = { one: 'reply', all: 'reply-all', fwd: 'forward', new: 'square-pen' }[d.mode];
    const tos = `<div class="cr2f"><label>To</label><span class="crtos">${d.to.map(k => `<span class="crto-c">${crAv(k, 20)}${esc(crWho(k).n)}<button type="button" data-crtorm="${esc(k)}" aria-label="Remove">${ic('x')}</button></span>`).join('')}<input data-crto placeholder="${d.to.length ? '' : 'Name or email'}" autocomplete="off"></span><div class="crsug" id="cr-sug" hidden></div></div>`;
    c.innerHTML = `<div class="cr2h">${isNew ? `<span class="cr2mode st">${ic(mi)}${ml}</span><span class="cr2to">from <b>${esc(crMail('me'))}</b></span>` : `<button class="cr2mode" type="button" data-crmode>${ic(mi)}${ml}${ic('chevron-down')}</button><span class="cr2to">${fwd ? '' : `to <b>${esc(names.join(', '))}</b>`}</span>`}</div>
      ${isNew || fwd ? tos : ''}${isNew ? `<div class="cr2f"><label>Subject</label><input data-crsubj placeholder="What’s it about?" value="${esc(CR.newSubj)}"></div>` : ''}
      <div class="cr2tools"><button class="ib" type="button" data-crfmt="bold" title="Bold">${ic('bold')}</button><button class="ib" type="button" data-crfmt="italic" title="Italic">${ic('italic')}</button><button class="ib" type="button" data-crfmt="underline" title="Underline">${ic('underline')}</button><span class="vr"></span><button class="ib" type="button" data-crfmt="insertUnorderedList" title="Bulleted list">${ic('list')}</button><button class="ib" type="button" data-crfmt="insertOrderedList" title="Numbered list">${ic('list-ordered')}</button><button class="ib" type="button" data-crfmt="formatBlock" title="Quote">${ic('quote')}</button><button class="ib" type="button" data-crfmt="link" title="Link">${ic('link')}</button><span class="sp"></span><button class="ib" type="button" data-cradd title="Attach">${ic('paperclip')}</button></div>
      ${d.re ? `<div class="crqs cr2q"><b>${esc(crWho(d.re.from).n)}</b>${esc(d.re.text)}</div>` : ''}${fwd && d.fwd ? `<div class="crfwd cr2q">${ic('forward')}<span><b>${esc(d.fwd.subj)}</b><small>${d.fwd.n} message${d.fwd.n > 1 ? 's' : ''}${d.fwd.files ? ` · ${d.fwd.files} attachment${d.fwd.files > 1 ? 's' : ''}` : ''} included</small></span></div>` : ''}
      <div class="cr2ed" contenteditable="true" spellcheck="true" data-ph="${fwd ? 'Add a note (optional)' : isNew ? 'Write your email' : 'Write your reply'}">${d.html || ''}</div>
      ${d.atts.length ? `<div class="cr2atts">${d.atts.map((f, j) => lFile(f, { cls: 'mini', act: `<button type="button" class="lfx" data-crunatt="${j}" aria-label="Remove">${ic('x')}</button>` })).join('')}</div>` : ''}
      <div class="cr2ft"><button class="ib" type="button" data-crdiscard title="Discard" aria-label="Discard">${ic('trash-2')}</button><span class="sp"></span><small>\u2318 Return</small><button class="bt key" type="button" data-crsend>${ic('send-horizontal')}Send</button></div>`;
    c.hidden = false; c.classList.toggle('enter', !was); const ed = c.querySelector('.cr2ed'); ed.addEventListener('input', () => { d.html = ed.innerHTML; crPadFit(); }); crPadFit(); }

  function crPeople(t) { const o = crOthers(t);
    return `<div class="crppl"><h6>${o.length > 1 ? 'In this conversation' : 'From'}</h6>${o.map(k => { const w = crWho(k), others = CRT.filter(x => x !== t && x.box !== 'trash' && x.msgs.length && crOthers(x).includes(k)).slice(0, 3);
      return `<div class="crpc"><div class="crpr">${crAv(k, 40)}<span class="crpt"><b>${esc(w.n)}</b><button type="button" class="crml" data-crcopymail="${crMail(k)}" title="Copy address">${esc(crMail(k))}</button></span>${CRB[k] ? `<button class="bt sm fill" type="button" data-crunsub>Unsubscribe</button>` : `<button class="ib" type="button" data-crto1="${k}" title="Email just ${esc(crFirst(k))}">${ic('mail')}</button><button class="ib" type="button" data-crcontact="${k}" title="View contact">${ic('users')}</button>`}</div>
        ${others.length ? `<div class="crpo"><small>Also with ${esc(crFirst(k))}</small>${others.map(x => `<button type="button" data-crt="${x.id}">${ic('message-square')}<span>${esc(x.subj)}</span><time>${esc((crLast(x)?.at || '').replace(/ \d.*/, ''))}</time></button>`).join('')}</div>` : CRB[k] ? '' : `<div class="crpo"><small>No other conversations yet</small></div>`}</div>`; }).join('')}</div>`; }
  function crClick(e, hit) {
    const q = s => hit(s);
    if (q('[data-crback]')) { const w = $('#w-charlie'); CR.isl = false; w.classList.add('navopen'); return true; }
    if (q('[data-crisl]')) { CR.isl = !CR.isl; if (CR.isl && CR.px) { CR.px = ''; crBar(); } crHead(); return true; }
    if (crNarrow() && q('[data-crpx="info"]')) { CR.px = ''; crBar(); CR.isl = true; crHead(); return true; }   /* ⋯ › Details opens the island, not a bar panel */
    if (CR.isl && crNarrow() && !q('#cr-head')) { CR.isl = false; crHead(); }   /* a tap anywhere else folds it back */
    if (q('#cr-top b, #cr-top .chev')) { lMenu(q('#cr-top b, #cr-top .chev'), `<h6>Accounts</h6>${crMi(`data-cracct="all"`, 'inbox', 'All inboxes', CR.acct === 'all' ? ' on' : '')}${CRACCT.map(([a, n, mail]) => crMi(`data-cracct="${a}"`, 'mail', `${n}<small>${mail}</small>`, CR.acct === a ? ' on' : '')).join('')}<span class="crsep"></span>${crMi('data-craddacct', 'plus', 'Add account…')}`); return true; }
    const ac = q('[data-cracct]'); if (ac) { $('#lmenu')?.remove(); CR.acct = ac.dataset.cracct; CR.box = 'inbox'; crNav(); crSide(); const f = CRT.find(t => crInBox(t, 'inbox')); if (f) crOpen(f.id); return true; }
    if (q('[data-craddacct]')) { const a = q('[data-craddacct]'); lMenu(a.closest('#lmenu') ? $('#cr-top b') : a, `<h6>Add an account</h6>${crMi('data-craddp="luma"', 'user', 'Luma account<small>Your @username, mail and calendar together</small>')}${crMi('data-craddp="other"', 'mail', 'Another provider<small>Sign in with the provider’s own page</small>')}${crMi('data-craddp="manual"', 'settings', 'Set up by hand<small>IMAP and SMTP</small>')}`); return true; }
    const ap = q('[data-craddp]'); if (ap) { $('#lmenu')?.remove(); crToast({ luma: 'Sign in to your Luma account to add it', other: 'The provider’s sign-in page opens in Viola', manual: 'Enter the IMAP and SMTP details for your server' }[ap.dataset.craddp], null, 'mail'); return true; }
    if (!q('#cr-pop') && !q('[data-crmode],[data-crmore],[data-cradd],[data-crboxmenu]')) crPopClose();
    const tr = q('[data-crt]'); if (tr) { crPopClose(); crOpen(tr.dataset.crt); return true; }
    const nv = q('[data-crnav]'); if (nv) { [CR.acct, CR.box] = nv.dataset.crnav.split(':'); crNav(); crSide(); const f = CRT.find(t => crInBox(t, CR.box)); if (f && CR.box !== 'drafts') crOpen(f.id); return true; }
    if (crNarrow() && q('[data-crnew]')) { CR.px = ''; $('#w-charlie').classList.remove('navopen'); crStartNew(); return true; }
    if (crNarrow()) { const px = q('[data-crpx]'); if (px) { const k = px.dataset.crpx; CR.px = CR.px === k ? '' : k; crBar(); return true; }
      if (q('[data-crcmodeset]') || q('[data-crunread]') || q('[data-crmute]') || q('[data-crprint]') || q('[data-crsrc]') || q('[data-crmove]') || q('[data-crunsub]') || q('[data-crdesel]') || q('[data-crreply]') || q('[data-crarch]') || q('[data-crdel]')) { CR.px = ''; setTimeout(() => crBar()); }
      if (q('[data-crstar]')) { CR.px = ''; setTimeout(() => crBar()); } }
    if (q('[data-crppl]')) { CR.det = !CR.det; crHead(); crDet(); return true; }
    const t1 = q('[data-crto1]'); if (t1) { crPopClose(); crStartNew(); CR.draft.to.push(t1.dataset.crto1); crHead(); crComp(); setTimeout(() => $('[data-crsubj]')?.focus(), 60); return true; }
    const ct = q('[data-crcontact]'); if (ct) { crPopClose(); crToast(`Opening ${crWho(ct.dataset.crcontact).n} in Contacts`); return true; }
    const po = q('[data-crpo]'); if (po) { const k = po.dataset.crpo, w = crWho(k); if (PPL[k]) { crToast(`Opening ${w.n} in Contacts`); return true; }
      crPop(po, `<div class="cradd1"><b>Add ${esc(w.n)} to Contacts?</b><small>${esc(crMail(k))}</small><span><button class="bt sm fill" type="button" data-crpopx>Not now</button><button class="bt sm key" type="button" data-cradd1="${k}">Add</button></span></div>`, false); return true; }
    const a1 = q('[data-cradd1]'); if (a1) { crPopClose(); crToast(`Added ${crWho(a1.dataset.cradd1).n} to Contacts`); return true; }
    if (q('[data-crpopx]')) { crPopClose(); return true; }
    const pm = q('[data-crpm]'); if (pm) { crToast(`Opening Messages with ${crFirst(pm.dataset.crpm)}`); return true; }
    const pc = q('[data-crpc]'); if (pc) { crToast(`Calling ${crFirst(pc.dataset.crpc)}`); return true; }
    const of = q('[data-crofile]'); if (of) { const [mid, j] = of.dataset.crofile.split(':'), fl = CRT.flatMap(x => x.msgs).find(x => x.id === mid).files[+j]; crToast(`Opening ${fl.n} in ${lFileApp(fl.k)}`); return true; }
    if (q('[data-crcopymsg]')) { CR.sel = null; $$('#cr-body .sel').forEach(x => x.classList.remove('sel')); crBar(); crToast('Copied'); return true; }
    const cm = q('[data-crcopymail]'); if (cm) { crToast('Copied ' + cm.dataset.crcopymail); return true; }
    const td0 = q('[data-crtodo]'); if (td0) { crToast(td0.dataset.crtodo); return true; }
    if (q('[data-crcmode]')) { const c = CR.comp; crPop(q('[data-crcmode]'), [['one', 'reply', 'Reply'], ['all', 'reply-all', 'Reply all'], ['fwd', 'forward', 'Forward']].map(([k, i, n]) => crMi(`data-crcmodeset="${k}"`, i, n, (c.mode || (crOthers(crT(CR.open)).length > 1 ? 'all' : 'one')) === k ? ' on' : '')).join('')); return true; }
    const cms = q('[data-crcmodeset]'); if (cms) { crPopClose(); const k = cms.dataset.crcmodeset; if (k === 'fwd') { const txt = CR.comp.text; crReply('fwd'); if (txt) { CR.draft.html = esc(txt).replace(/\n/g, '<br>'); $('#cr-draft .crdraft').innerHTML = CR.draft.html; } CR.comp.text = ''; } else { CR.comp.mode = k; crBar(); $('[data-crtext]')?.focus(); } return true; }
    if (q('[data-crcrex]')) { CR.comp.re = null; crBar(); return true; }
    if (q('[data-crqsend]')) { crQuickSend(); return true; }
    if (q('[data-crexpand]') && CR.keep && CR.keep.t === CR.open) { CR.draft = CR.keep; CR.keep = null; crBody(); crBar(); setTimeout(() => { const el = $('#cr-comp .cr2ed'); el?.focus(); if (el) getSelection().collapse(el, el.childNodes.length); }, 60); return true; }
    if (q('[data-crexpand]') || q('[data-cradd2]')) { const c = CR.comp, t = crT(CR.open), many = crOthers(t).length > 1, add = !!q('[data-cradd2]'); crReply(c.mode || (many ? 'all' : 'one'), c.re); CR.comp = { text: '', mode: null, re: null }; if (add) setTimeout(() => $('#cr-comp [data-cradd]')?.click(), 120); return true; }
    if (q('[data-crcollapse]')) { const el = $('#cr-draft .crdraft'); CR.comp = { text: el ? el.innerText.trim() : '', mode: CR.draft.mode === 'fwd' ? null : CR.draft.mode, re: null }; CR.draft = null; crBody(); crBar(); crBottom(); setTimeout(() => { const a = $('[data-crtext]'); a?.focus(); a?.setSelectionRange(a.value.length, a.value.length); }, 60); return true; }
    if (q('[data-crbundle]')) { CR.bundle = !CR.bundle; crSide(); return true; }
    if (q('[data-crboxmenu]')) { crPop(q('[data-crboxmenu]'), CRBOX.map(([k, n, i]) => crMi(`data-crbox="${k}"`, i, n + (k === 'drafts' ? '<small>' + CRT.filter(t => t.box === 'drafts').length + '</small>' : ''), CR.box === k ? ' on' : '')).join(''), false); return true; }
    const bx = q('[data-crbox]'); if (bx) { CR.box = bx.dataset.crbox; crPopClose(); crSide(); return true; }
    if (q('[data-crun]')) { CR.unread = !CR.unread; crSide(); return true; }
    const cu = q('[data-crunv]'); if (cu) { CR.unread = cu.dataset.crunv === '1'; CR.keep = CR.unread ? null : CR.keep; crSide(); return true; }
    if (q('[data-crnew]')) { crStartNew(); return true; }
    const ta = q('[data-crtoadd]'); if (ta) { CR.draft.to.push(ta.dataset.crtoadd); crHead(); crComp(); setTimeout(() => $('[data-crto]')?.focus(), 0); return true; }
    const tm = q('[data-crtorm]'); if (tm) { const i = CR.draft.to.indexOf(tm.dataset.crtorm); if (i >= 0) CR.draft.to.splice(i, 1); crHead(); crComp(); return true; }
    if (q('[data-crstar]')) { const t = crT(CR.open); t.flag = !t.flag; crHead(); crSide(); crToast(t.flag ? 'Flagged' : 'Unflagged'); return true; }
    if (q('[data-crarch]') || q('[data-crdel]')) { const t = crT(CR.open), del = !!q('[data-crdel]'), was = t.box, list = CRT.filter(x => crInBox(x, CR.box)), i = list.indexOf(t); t.box = del ? 'trash' : 'archive'; crPopClose();
      const next = list[i + 1] || list[i - 1]; CR.open = next && next !== t ? next.id : null; if (next && next !== t) crOpen(next.id); else { CR.draft = null; crSide(); crHead(); crBody(); crBar(); }
      crToast(del ? 'Moved to Trash' : 'Archived', () => { t.box = was; crOpen(t.id); }); return true; }
    if (q('[data-crunsub]')) { crToast('Unsubscribed from Slow Light'); return true; }
    const qt = q('[data-crqt]'); if (qt) { CR.quote[qt.dataset.crqt] = !CR.quote[qt.dataset.crqt]; const sc = $('#cr-body').scrollTop; crBody(); $('#cr-body').scrollTop = sc; return true; }
    const fl = q('[data-crfull]'); if (fl) { const id = fl.dataset.crfull; CR.full[id] = !CR.full[id]; fl.closest('.crbub').querySelector('.crpaper').classList.toggle('open', CR.full[id]); fl.textContent = CR.full[id] ? 'Show less' : 'Show full email'; return true; }
    const im = q('[data-crimgs]'); if (im) { CR.imgs[im.dataset.crimgs] = true; const sc = $('#cr-body').scrollTop; crBody(); $('#cr-body').scrollTop = sc; return true; }
    const at = q('[data-cratt]'); if (at) { CR.att = CR.att === at.dataset.cratt ? null : at.dataset.cratt; CR.sel = null; $$('#cr-body .crmsg').forEach(x => x.classList.remove('sel')); $$('#cr-body [data-cratt]').forEach(x => x.classList.toggle('sel', x.dataset.cratt === CR.att)); crBar(); return true; }
    const rp = q('[data-crreply]'); if (rp) { const t = crT(CR.open), mid = rp.dataset.crof || CR.sel, m = mid && t.msgs.find(x => x.id === mid), k = rp.dataset.crreply; $$('#cr-body .sel').forEach(x => x.classList.remove('sel')); crReply(k, m && m !== crLast(t) ? m : null); return true; }
    if (q('[data-crdesel]')) { CR.sel = CR.att = null; $$('#cr-body .sel').forEach(x => x.classList.remove('sel')); crBar(); return true; }
    if (q('[data-crquote]')) { const t = crT(CR.open), m = t.msgs.find(x => x.id === CR.tsel.m), txt = CR.tsel.text.trim(); getSelection().removeAllRanges(); CR.tsel = null; CR.tq = { from: m.from, text: txt }; crReply(m.from === 'me' ? 'all' : 'one', m); return true; }
    if (q('[data-crcopy]')) { getSelection().removeAllRanges(); CR.tsel = null; crBar(); crToast('Copied'); return true; }
    if (q('[data-cropen]')) { const b = $('#cr-bar .ctxc'); crToast('Opening ' + (b ? b.textContent.trim() : 'attachment')); return true; }
    if (q('[data-crsave]')) { crToast('Saved to Downloads'); return true; }
    if (q('[data-crfwdatt]')) { crReply('fwd'); return true; }
    if (q('[data-crmode]') && CR.open !== 'new') { crPop(q('[data-crmode]'), [['one', 'reply', 'Reply'], ['all', 'reply-all', 'Reply all'], ['fwd', 'forward', 'Forward']].map(([k, i, n]) => crMi(`data-crmodeset="${k}"`, i, n, CR.draft.mode === k ? ' on' : '')).join('')); return true; }
    const ms = q('[data-crmodeset]'); if (ms) { const html = $('#cr-comp .cr2ed')?.innerHTML || ''; crPopClose(); crReply(ms.dataset.crmodeset, null); CR.draft.html = html; const el = $('#cr-comp .cr2ed'); if (el) el.innerHTML = html; return true; }
    const fm = q('[data-crfmt]'); if (fm) { e.preventDefault(); const el = $('#cr-comp .cr2ed'); el?.focus(); const k = fm.dataset.crfmt; if (k === 'link') document.execCommand('createLink', false, 'https://simplyluma.com'); else if (k === 'formatBlock') document.execCommand('formatBlock', false, 'blockquote'); else document.execCommand(k); if (el) CR.draft.html = el.innerHTML; return true; }
    if (q('[data-cradd]')) { crPop(q('[data-cradd]'), `<h6>Recent in Filer</h6>${[['launch-notes.pdf', 'pdf', '96 KB'], ['homepage-crop.png', 'img', '2.4 MB'], ['budget-q4.sheet', 'sheet', '64 KB']].map(([n, k, sz]) => `<button class="crmi" type="button" data-crpick="${n}|${k}|${sz}"><span class="crft sm" style="background:${CRFT[k][1]}">${CRFT[k][0]}</span><span>${n}<small>${sz}</small></span></button>`).join('')}<span class="crsep"></span>${crMi('data-crpick="more"', 'folder', 'Browse Filer…')}`); return true; }
    const pk = q('[data-crpick]'); if (pk) { crPopClose(); if (pk.dataset.crpick === 'more') { crToast('Filer opens as a picker'); return true; } const [n, k, sz] = pk.dataset.crpick.split('|'); CR.draft.atts.push({ n, k, sz }); crComp(); return true; }
    const ua = q('[data-crunatt]'); if (ua) { CR.draft.atts.splice(+ua.dataset.crunatt, 1); crComp(); return true; }
    if (q('[data-crdiscard]')) { const wasNew = CR.open === 'new', d = CR.draft; CR.draft = null; if (wasNew) { CR.open = d?.from || CRT.find(t => crInBox(t, CR.box))?.id; CR.open = crT(CR.open)?.box === 'drafts' ? null : CR.open; } crSide(); crHead(); crBody(); crBar(); crToast('Draft discarded', () => { CR.draft = d; if (wasNew) { CR.open = 'new'; crHead(); } crBody(); crBar(); }); return true; }
    if (q('[data-crsend]')) { crSend(); return true; }
    const mo = q('[data-crmore]'); if (mo) { const msg = mo.dataset.crmore === 'msg';
      crPop(mo, msg ? crMi('data-crunread', 'mail', 'Mark unread from here') + crMi('data-crsrc', 'file-text', 'Show original') + crMi('data-crprint', 'printer', 'Print') + '<span class="crsep"></span>' + crMi('data-crdel', 'trash-2', 'Delete message', ' red')
        : crMi('data-crunread', 'mail', 'Mark unread') + crMi('data-crmove', 'folder', 'Move to…') + crMi('data-crmute', 'bell', 'Mute this thread') + crMi('data-crprint', 'printer', 'Print') + '<span class="crsep"></span>' + crMi('data-crdel', 'trash-2', 'Delete thread', ' red'), !mo.closest('#cr-head')); return true; }
    if (q('[data-crunread]')) { const t = crT(CR.open); crLast(t).un = true; crPopClose(); crSide(); crToast('Marked unread'); return true; }
    if (q('[data-crmute]') || q('[data-crprint]') || q('[data-crsrc]') || q('[data-crmove]')) { crPopClose(); crToast({ crmute: 'Muted. New replies skip your inbox', crprint: 'Sent to the printer', crsrc: 'Opening the original in Write', crmove: 'Pick a folder in the sidebar' }[Object.keys(q('.crmi').dataset)[0]]); return true; }
    // Tapping a message picks it; tapping empty space lets go.
    const bub = q('#cr-body .crmsg:not(.draft) .crbub'); if (bub && !q('button,a,iframe') && getSelection().isCollapsed) { crSelect(bub.closest('.crmsg').dataset.crm); return true; }
    if (q('#cr-body') && !q('.crmsg') && (CR.sel || CR.att)) { CR.sel = CR.att = null; $$('#cr-body .sel').forEach(x => x.classList.remove('sel')); crBar(); return true; }
    return false; }
  function renderCharlie() { new ResizeObserver(() => crPadFit()).observe($('#w-charlie .ibody')); crNav(); $('#cr-top').innerHTML = `<img src="${A}mail.svg" alt=""><b>Charlie</b><span class="chev">${ic('chevron-down')}</span>`; crOpen(CR.open); }

  // Selecting words inside a message turns the bar into "Quote in reply".
  document.addEventListener('selectionchange', () => { clearTimeout(crBar.st); crBar.st = setTimeout(() => { if (CR.draft || document.activeElement?.matches?.('[data-crtext]')) return; const s = getSelection(), n = s.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement);
    const m = el?.closest?.('#cr-body .crmsg:not(.draft) .crbub'), text = s.toString().trim();
    if (m && text && !s.isCollapsed) { CR.tsel = { m: m.closest('.crmsg').dataset.crm, text }; crBar(); } else if (CR.tsel) { CR.tsel = null; crBar(); } }, 140); });
  document.addEventListener('input', e => { if (e.target.matches?.('[data-crq]')) { CR.q = e.target.value; crSide(); const i = $('[data-crq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if (e.target.matches?.('[data-crto]')) crSuggest(); if (e.target.matches?.('[data-crsubj]')) { CR.newSubj = e.target.value; crHead(); }
    if (e.target.matches?.('[data-crtext]')) { CR.comp.text = e.target.value; crGrow(); $('[data-crqsend]')?.classList.toggle('go', !!CR.comp.text.trim()); } });
  document.addEventListener('focusout', e => { if (e.target.matches?.('[data-crto]')) setTimeout(() => { const g = $('#cr-sug'); if (g && !g.contains(document.activeElement)) g.hidden = true; }, 180); });
  document.addEventListener('keydown', e => { if (e.target.matches?.('[data-crto]')) { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const f = $('#cr-sug [data-crtoadd]'); if (f) f.click(); else if (e.target.value.includes('@')) { CR.draft.to.push(e.target.value.trim()); crHead(); crComp(); $('[data-crto]')?.focus(); } }
      if (e.key === 'Backspace' && !e.target.value && CR.draft.to.length) { CR.draft.to.pop(); crHead(); crComp(); $('[data-crto]')?.focus(); } }
    if (e.target.closest?.('#cr-comp') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); crSend(); }
    if (e.target.matches?.('[data-crtext]') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); crQuickSend(); }
    if (e.key === 'Escape' && document.activeElement?.closest?.('#w-charlie')) { crPopClose(); if (CR.sel || CR.att) { CR.sel = CR.att = null; $$('#cr-body .sel').forEach(x => x.classList.remove('sel')); crBar(); } } });

  /* ══ Monitor ═════════════════════════════════════════════════════════════════
     Linux, explained. The island leads with a sentence about what your computer is doing and the apps
     you know. The 600-odd processes that keep Luma running wait behind one switch, with every column a
     power user expects. The bar works on what you pick: an app, or one raw process. */
  const MNR = [['cpu', 'CPU', 'cpu'], ['mem', 'Memory', 'layers'], ['disk', 'Disk', 'hard-drive'], ['net', 'Network', 'wifi'], ['en', 'Energy', 'battery-medium']];
  const MNA = [
    { id: 'viola', n: 'Viola', ic: 'browser', sub: '3 windows · 14 tabs', cpu: 16, mem: 2150, disk: .4, net: 1.4, en: 38, th: 61, procs: [['viola', 3410, 3.1, 420], ['viola-gpu', 3422, 5.6, 380], ['tab: simplyluma.com', 3440, 4.2, 310], ['tab: Photos — Offsite', 3451, 2.4, 290], ['tab: 11 more', 0, .7, 750]] },
    { id: 'photos', n: 'Photos', ic: 'photos', sub: 'Importing 42 photos', cpu: 11, mem: 1240, disk: 36, net: 0, en: 22, th: 24, procs: [['luma-photos', 3502, 4.1, 690], ['photos-thumbnailer', 3519, 6.9, 550]] },
    { id: 'terminal', n: 'Terminal', ic: 'terminal', sub: '2 tabs · cargo build', cpu: 8, mem: 610, disk: 4, net: 0, en: 14, th: 18, procs: [['luma-terminal', 3301, .3, 120], ['zsh', 3310, 0, 12], ['cargo', 3388, 1.2, 180], ['rustc', 3391, 6.5, 298]] },
    { id: 'filer', n: 'Filer', ic: 'files', sub: 'Copying 3.1 GB to Backup', cpu: 3, mem: 280, disk: 84, net: 0, en: 9, th: 11, procs: [['luma-filer', 3120, 1.1, 210], ['filer-copy', 3701, 1.9, 70]] },
    { id: 'depot', n: 'Depot', ic: 'app-store', sub: 'Updating 3 apps', cpu: 2, mem: 320, disk: 6, net: 4.2, en: 7, th: 14, procs: [['luma-depot', 3620, .6, 230], ['flatpak-system-helper', 1290, 1.4, 90]] },
    { id: 'tide', n: 'Tide', ic: 'music', sub: 'Playing · keeping the screen awake', cpu: 2.5, mem: 410, disk: .2, net: .3, en: 11, th: 19, awake: true, procs: [['luma-tide', 3208, 2.1, 380], ['tide-decoder', 3215, .4, 30]] },
    { id: 'write', n: 'Write', ic: 'documents', sub: '2 documents', cpu: .6, mem: 380, disk: 0, net: 0, en: 3, th: 12, procs: [['luma-write', 3160, .6, 380]] },
    { id: 'messages', n: 'Messages', ic: 'messages', sub: 'Connected', cpu: .4, mem: 260, disk: 0, net: .05, en: 2, th: 18, procs: [['luma-messages', 3809, .4, 260]] },
    { id: 'charlie', n: 'Charlie', ic: 'mail', sub: 'Up to date', cpu: .2, mem: 190, disk: 0, net: .02, en: 1, th: 5, procs: [['luma-charlie', 3802, .2, 190]] },
    { id: 'calendar', n: 'Calendar', ic: 'calendar', sub: 'In the background', cpu: 0, mem: 120, disk: 0, net: 0, en: 0, th: 13, procs: [['luma-calendar', 2959, 0, 120]] }
  ];
  /* The rest of Linux, by what it does. Names are real-looking; counts add up to the total. */
  const MNG = [
    { id: 'sys', n: 'Luma system', why: 'The desktop, sound, networking and the other parts that make Luma run', total: 38,
      p: [['gnome-shell', 3113, 'nick', 5.4, 610, 27], ['pipewire', 3780, 'nick', .9, 22, 6], ['pipewire-pulse', 3793, 'nick', .3, 18, 3], ['wireplumber', 3785, 'nick', .2, 31, 5], ['NetworkManager', 988, 'root', .2, 19, 4], ['luma-shelf', 3131, 'nick', .4, 48, 6], ['Xwayland', 3140, 'nick', .1, 64, 5], ['gnome-settings-daemon', 3170, 'nick', 0, 36, 8], ['bluetoothd', 1003, 'root', 0, 7, 1], ['upowerd', 1121, 'root', 0, 9, 3], ['polkitd', 972, 'polkitd', 0, 11, 4], ['gdm', 1195, 'root', 0, 12, 3]] },
    { id: 'bg', n: 'Background services', why: 'Helpers that start on their own: indexing, updates, printing, sync', total: 243,
      p: [['tracker-miner-fs-3', 3422, 'nick', 1.8, 96, 7], ['systemd-journald', 612, 'root', .3, 44, 1], ['systemd-oomd', 811, 'systemd-oom', 0, 5, 1], ['flatpak-portal', 3250, 'nick', 0, 14, 4], ['xdg-desktop-portal', 3241, 'nick', .1, 22, 6], ['evolution-data-server', 3290, 'nick', 0, 48, 9], ['cupsd', 1042, 'root', 0, 8, 1], ['packagekitd', 2210, 'root', .4, 120, 3], ['chronyd', 944, 'chrony', 0, 4, 1], ['avahi-daemon', 951, 'avahi', 0, 3, 1], ['fwupd', 2402, 'root', 0, 62, 5], ['udisksd', 1188, 'root', 0, 16, 5]] },
    { id: 'kern', n: 'Linux kernel', why: 'Work the kernel does itself. These can’t be ended', total: 402, kernel: true,
      p: [['kworker/u16:2-events_unbound', 245, 'root', .6, 0, 1], ['irq/128-nvme0q1', 302, 'root', .4, 0, 1], ['ksoftirqd/0', 15, 'root', .2, 0, 1], ['rcu_preempt', 16, 'root', .1, 0, 1], ['kswapd0', 98, 'root', 0, 0, 1], ['migration/0', 18, 'root', 0, 0, 1], ['btrfs-transaction', 540, 'root', .3, 0, 1], ['jbd2/nvme0n1p2', 511, 'root', 0, 0, 1], ['kthreadd', 2, 'root', 0, 0, 1], ['khugepaged', 101, 'root', 0, 0, 1], ['i915/signal:0', 377, 'root', .2, 0, 1], ['card0-crtc0', 388, 'root', .1, 0, 1]] }
  ];
  const MN = { stopped: new Set(), prio: {}, confirm: false, pdet: null, sheet: null, r: 'cpu', all: false, sel: null, open: {}, more: {}, q: '', quit: new Set(), hist: {}, t: 0, cores: [], group: { sys: true, bg: false, kern: false } };
  const MNTOT = { mem: 16384, disk: 512 };
  MNR.forEach(([k]) => MN.hist[k] = Array.from({ length: 60 }, () => [0, 0]));
  const mnApps = () => MNA.filter(a => !MN.quit.has(a.id));
  const mnFmtMem = mb => mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB';
  const mnFmtRate = v => v >= 1 ? v.toFixed(1) + ' MB/s' : v > 0.004 ? Math.round(v * 1000) + ' KB/s' : '—';
  const mnImpact = v => v >= 30 ? 'High' : v >= 10 ? 'Moderate' : v >= 2 ? 'Low' : 'Very low';
  const mnVal = (a, r = MN.r) => a[r] || 0;
  const mnFmt = (v, r = MN.r) => r === 'cpu' ? (v >= 10 ? Math.round(v) : v.toFixed(1)) + '%' : r === 'mem' ? mnFmtMem(v) : r === 'en' ? mnImpact(v) : mnFmtRate(v);
  const mnMax = r => r === 'cpu' ? 30 : r === 'mem' ? 2400 : r === 'en' ? 45 : r === 'disk' ? 90 : 5;
  function mnTotals() { const A = mnApps(), sum = k => A.reduce((s, a) => s + (a[k] || 0), 0), sysCpu = 6 + Math.sin(MN.t / 7) * 1.5;
    return { cpu: sum('cpu') + sysCpu, appsCpu: sum('cpu'), sysCpu, mem: sum('mem') + 2150, appsMem: sum('mem'), sysMem: 2150, cache: 3100, read: 8 + sum('disk') * .15, write: sum('disk'), down: sum('net'), up: .12 + sum('net') * .05, en: sum('en') }; }
  /* A gentle random walk, so it feels alive without being a light show. */
  function mnTick() { MN.t++;
    MNA.forEach(a => { const j = (k, s, lo = 0) => { if (a['_' + k] == null) a['_' + k] = a[k]; a[k] = Math.max(lo, a['_' + k] * (1 + (Math.random() - .5) * s)); };
      j('cpu', .5); j('mem', .02); j('disk', .6); j('net', .7); j('en', .3); if (MN.stopped.has(a.id)) { a.cpu = 0; a.disk = 0; a.net = 0; a.en = 0; } });
    const T = mnTotals();
    const push = (k, a, b) => { MN.hist[k].push([a, b]); MN.hist[k].shift(); };
    push('cpu', T.appsCpu, T.sysCpu); push('mem', T.appsMem, T.sysMem); push('disk', T.read, T.write); push('net', T.down, T.up); push('en', T.en, 0);
    MN.cores = Array.from({ length: 8 }, (_, i) => Math.max(2, Math.min(98, T.cpu * (0.6 + ((i * 37) % 9) / 10) + (Math.random() - .5) * 18))); }
  for (let i = 0; i < 60; i++) mnTick();

  function mnSpark(k, w = 64, h = 22) { const H = MN.hist[k], vals = H.map(([a, b]) => k === 'disk' || k === 'net' ? a + b : a + b), mx = Math.max(k === 'cpu' ? 100 : k === 'mem' ? MNTOT.mem : 1, ...vals) || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - v / mx * (h - 2) - 1).toFixed(1)}`).join(' ');
    return `<svg class="mnsp" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" /></svg>`; }
  function mnChart(k) { const W = 640, Hh = 150, H = MN.hist[k], two = k !== 'mem' && k !== 'en';
    const top = k === 'cpu' ? 100 : k === 'mem' ? MNTOT.mem : Math.max(1, ...H.map(([a, b]) => Math.max(a, b))) * 1.25;
    const y = v => (Hh - v / top * (Hh - 6)).toFixed(1), x = i => (i / (H.length - 1) * W).toFixed(1);
    const area = (f, cls) => `<path class="${cls}" d="M0,${Hh} ${H.map((p, i) => `L${x(i)},${y(f(p))}`).join(' ')} L${W},${Hh} Z"/><path class="${cls} ln" d="${H.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(f(p))}`).join(' ')}"/>`;
    const body = k === 'cpu' ? area(p => p[0] + p[1], 'a2') + area(p => p[0], 'a1') : k === 'mem' ? area(p => p[0] + p[1], 'a2') + area(p => p[0], 'a1') : k === 'en' ? area(p => p[0], 'a1') : area(p => p[1], 'a2') + area(p => p[0], 'a1');
    return `<svg class="mnch r-${k}" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">${[.25, .5, .75].map(f => `<line x1="0" x2="${W}" y1="${(Hh * f).toFixed(0)}" y2="${(Hh * f).toFixed(0)}"/>`).join('')}${body}</svg>`; }

  function mnHero() { const T = mnTotals(), A = mnApps().slice().sort((a, b) => mnVal(b) - mnVal(a)), top = A[0], r = MN.r; let h1, sub, cells;
    if (r === 'cpu') { const idle = Math.max(0, 100 - T.cpu); h1 = T.cpu < 25 ? 'Plenty of headroom.' : `${top.n} is doing most of the work.`; sub = `${Math.round(T.cpu)}% of 8 cores in use · 3.8 GHz · 58 °C`;
      cells = []; }
    else if (r === 'mem') { const used = T.mem, pct = used / MNTOT.mem; h1 = pct < .7 ? 'Memory is comfortable.' : `Memory is getting full. ${top.n} uses the most.`; sub = `${mnFmtMem(used)} of 16 GB in use · pressure is low`;
      cells = []; }
    else if (r === 'disk') { h1 = MN.quit.has('filer') ? 'Your disk is quiet.' : 'Filer is copying 3.1 GB to Backup.'; sub = MN.quit.has('filer') ? 'Nothing big is reading or writing' : 'About 40 seconds left at this speed';
      cells = [['Reading', mnFmtRate(T.read), 'a1'], ['Writing', mnFmtRate(T.write), 'a2'], ['Free space', '212 GB of 512', '']]; }
    else if (r === 'net') { h1 = MN.quit.has('depot') ? 'The network is quiet.' : 'Depot is downloading updates.'; sub = 'Wi‑Fi · Studio North · strong signal';
      cells = [['Down', mnFmtRate(T.down), 'a1'], ['Up', mnFmtRate(T.up), 'a2'], ['This session', '1.4 GB', '']]; }
    else { const awake = mnApps().find(a => a.awake); h1 = `At this pace, the battery lasts about ${T.en > 60 ? 4 : 6} hours.`; sub = `${top.n} uses the most energy${awake ? ` · ${awake.n} is keeping the screen awake` : ''}`;
      cells = [['Battery', '74%', 'a1'], ['Time left', T.en > 60 ? '4 h 05 m' : '6 h 10 m', ''], ['Performance mode', `<span class="mnperf">${seg([['saver', 'Battery saver'], ['bal', 'Balanced'], ['perf', 'Performance']], MN.perf || 'bal', 'data-mnperf', 'Performance mode')}</span>`, 'wide']]; }
    const adv = !MN.all ? '' : r === 'cpu' ? `<div class="mncores">${MN.cores.map((v, i) => `<span><i style="height:${v.toFixed(0)}%"></i><em>${i}</em></span>`).join('')}</div>`
      : r === 'mem' ? `<dl class="mnadv"><div><dt>Cached</dt><dd>${mnFmtMem(T.cache)}</dd></div><div><dt>Swap</dt><dd>0.2 of 8 GB</dd></div><div><dt>zram</dt><dd>1.1 GB → 380 MB</dd></div><div><dt>Committed</dt><dd>14.8 GB</dd></div></dl>`
      : r === 'disk' ? `<dl class="mnadv"><div><dt>Device</dt><dd>nvme0n1</dd></div><div><dt>Root</dt><dd>btrfs · /</dd></div><div><dt>Queue</dt><dd>2</dd></div><div><dt>Busy</dt><dd>${Math.min(99, Math.round(T.write / 1.1))}%</dd></div></dl>`
      : r === 'net' ? `<dl class="mnadv"><div><dt>Interface</dt><dd>wlp0s20f3</dd></div><div><dt>Address</dt><dd>10.0.4.12</dd></div><div><dt>Link</dt><dd>1.2 Gb/s · Wi‑Fi 6</dd></div><div><dt>Packets</dt><dd>2.1 M in · 380 K out</dd></div></dl>`
      : `<dl class="mnadv"><div><dt>Draw</dt><dd>${(7 + T.en / 12).toFixed(1)} W</dd></div><div><dt>Profile</dt><dd>Balanced</dd></div><div><dt>Health</dt><dd>94%</dd></div><div><dt>Cycles</dt><dd>212</dd></div></dl>`;
    return `<section class="mnhero"><h1 id="mn-h1">${h1}</h1><p id="mn-sub">${sub}</p><div class="mnchw" id="mn-chart">${mnChart(r)}<span class="mnax">60 s</span></div>
      ${cells.length ? `<div class="mncells">${cells.map(([l, v, c]) => `<div${c === 'wide' ? ' class="wide"' : ''}><span>${c && c !== 'wide' ? `<i class="${c}"></i>` : ''}${l}</span>${c === 'wide' ? v : `<b>${v}</b>`}</div>`).join('')}</div>` : ''}${adv}</section>`; }

  const MNPRIO = [['-15', 'Very high'], ['-5', 'High'], ['0', 'Normal'], ['5', 'Low'], ['15', 'Very low']];
  const mnPrio = id => { const n = MN.prio[id] ?? '0'; return `${MNPRIO.find(x => x[0] === n)[1]} \u00b7 nice ${n}`; };
  const mnCap = s => s[0].toUpperCase() + s.slice(1);
  function mnProps(a, raw) { const main = a.procs[0], pid = main[1], cpuT = Math.round(a.th * 7 + a.cpu * 11);
    const rows = [['Status', MN.stopped.has(a.id) ? 'Stopped (SIGSTOP)' : 'Running'], ['Main process', `${main[0]} \u00b7 PID ${pid}`], ['User', 'nick'], ['Started', `Today at 9:${String(10 + (pid % 40)).padStart(2, '0')} AM`],
      ['CPU time', `${Math.floor(cpuT / 60)} min ${cpuT % 60} s`], ['Memory', `${mnFmtMem(a.mem)} resident \u00b7 ${mnFmtMem(a.mem * .16)} shared`], ['Priority', mnPrio(a.id)], ['Threads', a.th], ['Sandbox', a.id === 'terminal' ? 'None \u00b7 host access' : 'Flatpak \u00b7 files, network, sound'], ['Command line', `/usr/bin/luma-${a.id}${a.id === 'viola' ? ' --restore-session' : a.id === 'terminal' ? ' --tab=2' : ''}`, 1], ['Control group', `app-flatpak-org.luma.${mnCap(a.id)}-${pid}.scope`, 1]];
    if (raw) return rows;
    return `<dl class="mnprops">${rows.map(([k, v, mono]) => `<div${mono ? ' class="wide"' : ''}><dt>${k}</dt><dd${mono ? ' class="mono"' : ''}>${esc(String(v))}</dd></div>`).join('')}</dl>`; }
  function mnAppRow(a, mx) { const v = mnVal(a), open = MN.open[a.id], sel = MN.sel === 'a:' + a.id;
    return `<div class="mnapp${sel ? ' sel' : ''}${open ? ' open' : ''}" data-mna="${a.id}"><button class="mnrow" type="button" data-mnpick="a:${a.id}"><img src="${A}${a.ic}.svg" alt=""><span class="mnname"><b>${a.n}${MN.stopped.has(a.id) ? '<i class="mntag">Stopped</i>' : ''}${MN.prio[a.id] && MN.prio[a.id] !== '0' ? `<i class="mntag q">${MNPRIO.find(x => x[0] === MN.prio[a.id])[1]} priority</i>` : ''}</b><small>${a.sub}</small></span>
      ${MN.all ? `<span class="mnc">${a.procs.length}</span><span class="mnc">${a.th}</span>` : ''}<span class="mnv"><b data-mnv="${a.id}">${mnFmt(v)}</b><i class="mnmeter"><i style="width:${Math.min(100, v / mx * 100).toFixed(1)}%"></i></i></span>
      <span class="mnexp" data-mnopen="${a.id}" title="Show its processes">${ic('chevron-down')}</span></button>
      ${open ? `<div class="mnkids">${mnProps(a)}<div class="mnkh">Processes</div>${a.procs.map(([n, pid, c, m]) => `<button class="mnrow kid${MN.sel === 'p:' + pid ? ' sel' : ''}" type="button" data-mnpick="p:${pid}"><span class="mnname"><code>${esc(n)}</code></span>${MN.all ? `<span class="mnc">${pid || '—'}</span><span class="mnc">nick</span>` : ''}<span class="mnv"><b>${MN.r === 'mem' ? mnFmtMem(m) : MN.r === 'cpu' ? c.toFixed(1) + '%' : '—'}</b></span></button>`).join('')}</div>` : ''}</div>`; }
  function mnProcRow(g, p) { const [n, pid, u, c, m, th] = p, v = MN.r === 'mem' ? m : MN.r === 'cpu' ? c : 0;
    const det = MN.pdet === pid ? `<dl class="mnprops proc">${[['Status', g.kernel ? 'Sleeping (kernel thread)' : MN.stopped.has('p' + pid) ? 'Stopped (SIGSTOP)' : 'Sleeping'], ['PID', pid], ['User', u], ['Priority', `${MNPRIO.find(x => x[0] === (MN.prio['p' + pid] ?? '0'))[1]} \u00b7 nice ${MN.prio['p' + pid] ?? 0}`], ['Threads', th], ['Memory', m ? mnFmtMem(m) + ' resident' : '\u2014'], ['Command line', g.kernel ? `[${n}]` : `/usr/${g.id === 'sys' ? 'bin' : 'libexec'}/${n}`, 1], ['Control group', g.kernel ? 'kthreadd' : g.id === 'sys' ? 'session.slice' : 'system.slice', 1]].map(([k, v, mono]) => `<div${mono ? ' class="wide"' : ''}><dt>${k}</dt><dd${mono ? ' class="mono"' : ''}>${esc(String(v))}</dd></div>`).join('')}</dl>` : '';
    return det ? mnProcRow0(g, p) + det : mnProcRow0(g, p); }
  function mnProcRow0(g, p) { const [n, pid, u, c, m, th] = p;
    return `<button class="mnrow proc${MN.sel === 'p:' + pid ? ' sel' : ''}" type="button" data-mnpick="p:${pid}"><span class="mnname"><code>${esc(n)}</code></span><span class="mnc">${pid}</span><span class="mnc">${u}</span><span class="mnc">${th}</span><span class="mnv"><b>${MN.r === 'mem' ? (m ? mnFmtMem(m) : '—') : MN.r === 'cpu' ? c.toFixed(1) + '%' : '—'}</b></span></button>`; }
  const mnFiller = (g, n) => { const pre = { sys: ['gsd-', 'gvfsd-', 'at-spi-', 'dbus-', 'luma-'], bg: ['systemd-', 'gvfs-', 'flatpak-', 'ibus-', 'evolution-'], kern: ['kworker/', 'irq/', 'ksoftirqd/', 'cpuhp/', 'migration/'] }[g.id], suf = ['helper', 'daemon', 'monitor', 'agent', 'worker', 'broker', 'launcher'];
    return Array.from({ length: n }, (_, i) => [g.kernel ? `${pre[i % 5]}${i % 8}:${(i * 7) % 3}${i % 2 ? 'H' : ''}` : pre[i % 5] + suf[(i * 3) % 7] + (i > 6 ? '-' + (i % 9) : ''), 4000 + i * 3 + g.total, g.kernel ? 'root' : i % 3 ? 'nick' : 'root', 0, g.kernel ? 0 : 3 + (i * 13) % 40, 1 + (i % 6)]); };
  function mnList() { const q = MN.q.trim().toLowerCase(), so = MN.sort || { k: 'v', dir: -1 }, A = mnApps().filter(a => !q || (a.n + ' ' + a.procs.map(p => p[0]).join(' ')).toLowerCase().includes(q)).sort((a, b) => so.k === 'n' ? so.dir * a.n.localeCompare(b.n) : so.dir * (mnVal(a) - mnVal(b))), mx = mnMax(MN.r);
    const col = { cpu: 'CPU', mem: 'Memory', disk: 'Disk', net: 'Network', en: 'Energy impact' }[MN.r], hidden = MNG.reduce((s, g) => s + g.total, 0);
    let h = `${lTHead.grid([['n', 'Apps', 'mnhn'], ...(MN.all ? [['', 'Procs', 'mnc'], ['', 'Threads', 'mnc']] : []), ['v', col, 'mnv'], ['', '', 'mnexp']], so, 'data-mnsort', 'mnhd')}${A.map(a => mnAppRow(a, mx)).join('') || `<p class="mnnone">No apps match “${esc(MN.q)}”.</p>`}`;
    if (MN.all) h += MNG.map(g => { const ps = g.p.concat(MN.more[g.id] ? mnFiller(g, g.total - g.p.length) : []).filter(p => !q || p[0].toLowerCase().includes(q)).sort((a, b) => (MN.r === 'mem' ? b[4] - a[4] : b[3] - a[3])), open = MN.group[g.id] || q;
      return `<div class="mngrp"><button class="mnghd" type="button" data-mngrp="${g.id}"><span class="mnchev${open ? ' on' : ''}">${ic('chevron-right')}</span><span class="mnname"><b>${g.n}</b><small>${g.why}</small></span>${lCount(g.total)}</button>
        ${open ? `<div class="mnhd sm"><span>Process</span><span class="mnc">PID</span><span class="mnc">User</span><span class="mnc">Threads</span><span class="mnv">${MN.r === 'mem' ? 'Memory' : 'CPU'}</span></div>${ps.map(p => mnProcRow(g, p)).join('')}${!MN.more[g.id] && !q ? `<button class="mnmore" type="button" data-mnmore="${g.id}">Show ${g.total - g.p.length} more</button>` : ''}` : ''}</div>`; }).join('');
    else h += `<button class="mnreveal" type="button" data-mnall>${ic('layers')}<span><b>${hidden} processes keep Luma running.</b> You don’t need to manage them, but you can.</span><em>Show them</em></button>`;
    return h; }
  function mnSide() { const T = mnTotals(), val = { cpu: Math.round(T.cpu) + '%', mem: `${(T.mem / 1024).toFixed(1)} of 16 GB`, disk: mnFmtRate(T.read + T.write), net: '↓ ' + mnFmtRate(T.down), en: `74% · ${T.en > 60 ? '4 h' : '6 h'} left` };
    $('#mn-side').innerHTML = `<div class="mnsh">This computer</div>${MNR.map(([k, n, i]) => `<button class="mnres${MN.r === k ? ' on' : ''}" type="button" data-mnr="${k}"><span class="mnri">${ic(i)}</span><span class="mnrt"><b>${n}</b><small data-mnsv="${k}">${val[k]}</small></span><span data-mnspk="${k}">${mnSpark(k)}</span></button>`).join('')}
`; }
  /* Monitor on a phone: the sidebar's five resources become a row of tiles at the top (what you switch between, each with
     its number), then the one-line story and the chart, then the apps, quieter: icon, name, number, a thin meter. Picking
     an app turns the bar into Quit, Force quit (confirms in the bar), Details (grows the bar) and ✕. */
  const mnNarrow = () => { const w = $('#w-monitor'); return !!w?.clientWidth && w.clientWidth < 560; };
  function mnStrip() { const T = mnTotals(), val = { cpu: Math.round(T.cpu) + '%', mem: `${(T.mem / 1024).toFixed(1)} GB`, disk: mnFmtRate(T.read + T.write), net: mnFmtRate(T.down), en: '74%' };
    return `<div class="mnstrip" role="tablist" aria-label="Resource">${MNR.map(([k, n, i]) => `<button class="mntile${MN.r === k ? ' on' : ''}" type="button" role="tab" aria-selected="${MN.r === k}" data-mnr="${k}">${ic(i)}<b>${n}</b><small>${val[k]}</small></button>`).join('')}</div>`; }
  function mnBody(keep) { const b = $('#mn-body'), st = b.scrollTop; $('#w-monitor').classList.toggle('mnnarrow', mnNarrow()); b.innerHTML = `<div class="mnpad">${mnHero()}<div class="mnlist${MN.all ? ' all' : ''}">${mnList()}</div></div>`; if (keep) b.scrollTop = st; if (b.querySelector('.mnperf')) requestAnimationFrame(segs); }
  function mnFind(sel) { if (!sel) return null; const [k, id] = sel.split(':');
    if (k === 'a') return { app: MNA.find(a => a.id === id) };
    for (const a of MNA) for (const p of a.procs) if (String(p[1]) === id) return { proc: { n: p[0], pid: p[1], owner: a } };
    for (const g of MNG) { const p = g.p.concat(mnFiller(g, g.total - g.p.length)).find(x => String(x[1]) === id); if (p) return { proc: { n: p[0], pid: p[1], u: p[2], kernel: g.kernel } }; } return null; }
  function mnBarPhone(bar, f) { if (!MN.all) { MN.all = true; setTimeout(() => { mnBody(); mnBar(); }); } const X = MN.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`; bar.classList.add('phnofit', 'mnphbar');
    let panel = '', row;
    if (f?.app) { const a = f.app, st = MN.stopped.has(a.id);
      panel = X === 'force' ? `<div class="fexp cconf"><b>Force quit ${esc(a.n)}?</b><p>It stops at once, and anything unsaved is lost.</p><div class="cconfb"><button class="bt fill" type="button" data-mnpx="force">Cancel</button><button class="bt danger" type="button" data-mnforce>Force quit</button></div></div>`
        : X === 'det' ? `<div class="fexp mndet2"><div class="mndh"><img src="${A}${a.ic}.svg" alt=""><span><b>${esc(a.n)}</b><small>${a.procs.length} process${a.procs.length > 1 ? 'es' : ''} · ${a.th} threads</small></span></div><dl class="mnkv2">${mnProps(a, 1).map(([k, v, mono]) => `<dt>${k}</dt><dd${mono ? ' class="mono"' : ''}>${esc(String(v))}</dd>`).join('')}</dl></div>` : '';
      row = `${st ? `<button class="bt pri mnprim" type="button" data-mncont>${ic('play')}<span>Continue</span></button>` : `<button class="bt pri mnprim" type="button" data-mnquit><span>Quit ${esc(a.n)}</span></button>`}${ib('data-mnpx="force"', 'octagon-x', 'Force quit', X === 'force')}${ib('data-mnpx="det"', 'info', 'Details', X === 'det')}${ib('data-mndesel', 'x', 'Done')}`; }
    else if (f?.proc) { const p = f.proc; row = p.kernel ? `<span class="mnnote">${ic('lock')}Part of the kernel. It can't be ended</span>${ib('data-mndesel', 'x', 'Done')}` : `<button class="bt pri mnprim" type="button" data-mnend><span>End process</span></button>${ib('data-mnkill', 'octagon-x', 'Kill')}${ib('data-mndesel', 'x', 'Done')}`; }
    else { const T = mnTotals(), val = { cpu: Math.round(T.cpu) + '%', mem: `${(T.mem / 1024).toFixed(1)} GB`, disk: mnFmtRate(T.read + T.write), net: mnFmtRate(T.down), en: '74%' }, cur = MNR.find(x => x[0] === MN.r);
      if (X === 'res') panel = `<div class="fexp fmore2 mnresp">${MNR.map(([k, n, i]) => `<button class="fexr2${MN.r === k ? ' on' : ''}" type="button" data-mnr="${k}">${ic(i)}<span>${n}</span><small>${val[k]}</small></button>`).join('')}</div>`;
      row = `<button class="mnres2${X === 'res' ? ' on' : ''}" type="button" data-mnpx="res" aria-expanded="${X === 'res'}" aria-label="Showing ${cur[1]}">${ic(cur[2])}<b>${cur[1]}</b>${ic('chevron-down')}</button><label class="srch keep">${ic('search')}<input placeholder="Search" value="${esc(MN.q)}" data-mnq aria-label="Find an app or process"></label>`; }   /* no "all processes" toggle on a phone: the detail shows by default */
    bar.classList.toggle('phgrow', !!panel); setBar(bar, panel + row); }
  function mnBar() { const bar = $('#mn-bar'), f = mnFind(MN.sel); let h;
    if (mnNarrow()) return mnBarPhone(bar, f); bar.classList.remove('phnofit', 'mnphbar', 'phgrow');
    if (f?.app && MN.confirm) { const a = f.app; h = `<span class="mnwarn">${ic('shield')}<span>Force quit <b>${a.n}</b>? It stops at once, and anything unsaved is lost.</span></span><button class="bt" type="button" data-mnconfirm>Cancel</button><button class="bt danger solid" type="button" data-mnforce>Force quit</button>`; }
    else if (f?.app) { const a = f.app, st = MN.stopped.has(a.id); h = `<span class="ctxc"><img src="${A}${a.ic}.svg" alt="">${a.n}<button type="button" class="crx" data-mndesel aria-label="Done">${ic('x')}</button></span>${st ? `<button class="bt key" type="button" data-mncont>${ic('play')}Continue</button>` : `<button class="bt key" type="button" data-mnquit title="Asks ${a.n} to close, like closing its windows (SIGTERM)">Quit</button>`}<button class="bt fill" type="button" data-mnaskforce title="Stops it immediately (SIGKILL)">Force quit</button><button class="bt${MN.open[a.id] ? ' on' : ''}" type="button" data-mnopen="${a.id}">${ic('list')}${MN.open[a.id] ? 'Hide details' : 'Details'}</button><span class="vr"></span><button class="ib" type="button" data-mnmenu title="More">${ic('ellipsis')}</button>`; }
    else if (f?.proc) { const p = f.proc; h = `<span class="ctxc mono"><code>${esc(p.n.length > 26 ? p.n.slice(0, 25) + '…' : p.n)}</code><em>${p.pid || ''}</em><button type="button" class="crx" data-mndesel aria-label="Done">${ic('x')}</button></span>${p.kernel ? `<span class="mnnote">${ic('lock')}Part of the kernel. It can't be ended</span>` : `<button class="bt key" type="button" data-mnend title="SIGTERM">End process</button><button class="bt fill" type="button" data-mnkill title="SIGKILL">Kill</button>`}${p.owner ? '' : `<button class="bt${MN.pdet === p.pid ? ' on' : ''}" type="button" data-mnpdet>${ic('list')}Details</button>`}<span class="vr"></span><button class="ib" type="button" data-mnmenu title="More">${ic('ellipsis')}</button>`; }
    else h = `<label class="srch mnq">${ic('search')}<input placeholder="Find an app or process" value="${esc(MN.q)}" data-mnq></label>${MN.all ? `<button class="bt fill" type="button" data-mnall>${ic('layers')}Apps only</button>` : ''}`;
    setBar(bar, h); }
  function mnSheet() { $('#mn-sheet')?.remove(); if (!MN.sheet) return; const f = mnFind(MN.sel); if (!f) return; const n = f.app ? f.app.n : f.proc.n, pid = f.app ? f.app.procs[0][1] : f.proc.pid, id = f.app ? f.app.id : 'x';
    const rows = MN.sheet === 'files' ? [['0', 'file', '/dev/null'], ['1', 'pipe', 'pipe:[48213]'], ['3', 'socket', 'socket:[51720] \u00b7 wayland-0'], ['7', 'socket', 'socket:[51733] \u00b7 pipewire-0'], ['12', 'file', `/home/nick/.var/app/org.luma.${mnCap(id)}/cache/index.db`], ['14', 'file', `/home/nick/.var/app/org.luma.${mnCap(id)}/config/settings.json`], ['19', 'socket', 'TCP 10.0.4.12:51022 \u2192 simplyluma.com:443'], ['22', 'memfd', 'memfd:wayland-shm (deleted)']]
      : [['5578a3c10000', 'r-xp', '1.9 MB', `/usr/bin/luma-${id}`], ['7f3a1c000000', 'rw-p', '312 MB', '[heap]'], ['7f3a9e200000', 'r-xp', '1.9 MB', '/usr/lib64/libc.so.6'], ['7f3a9e5c0000', 'r-xp', '6.4 MB', '/usr/lib64/libgtk-4.so.1'], ['7f3a9f100000', 'r-xp', '3.1 MB', '/usr/lib64/libglib-2.0.so.0'], ['7f3aa0400000', 'rw-s', '32 MB', '/memfd:mesa-shared (deleted)'], ['7ffd5c1e0000', 'rw-p', '132 KB', '[stack]'], ['7ffd5c3f8000', 'r-xp', '8 KB', '[vdso]']];
    $('#mn-main').insertAdjacentHTML('beforeend', `<div class="mnsheet" id="mn-sheet"><div class="mnsc"><header><span><b>${MN.sheet === 'files' ? 'Open files' : 'Memory maps'}</b><small>${esc(n)} \u00b7 PID ${pid}</small></span><button class="ib" type="button" data-mnsheetx aria-label="Close">${ic('x')}</button></header>
      <table><thead><tr>${(MN.sheet === 'files' ? ['FD', 'Type', 'Object'] : ['Address', 'Flags', 'Size', 'File']).map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`); }
  const mnToast = (msg, undo) => lToast($('#w-monitor'), msg, { icon: /paused/.test(msg) ? 'pause' : /^Copied/.test(msg) ? 'copy' : 'check', undo: undo?.[1] });   // the LumaUI toast (Undo reopens)
  function mnPop(anchor, html) { $('#mn-pop')?.remove(); const w = $('#w-monitor'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect(); w.insertAdjacentHTML('beforeend', `<div class="crpop ldrawer" id="mn-pop">${html}</div>`); const p = $('#mn-pop');
    p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left + r.width / 2 - p.offsetWidth / 2)) + 'px'; p.style.bottom = (wr.bottom - r.top + 8) + 'px'; }
  function mnLive() { if ($('#w-monitor').hidden) return; mnTick(); const T = mnTotals();
    $('#mn-chart') && ($('#mn-chart').innerHTML = mnChart(MN.r) + '<span class="mnax">60 s</span>');
    $$('#mn-side [data-mnspk]').forEach(e => e.innerHTML = mnSpark(e.dataset.mnspk));
    const sv = { cpu: Math.round(T.cpu) + '%', mem: `${(T.mem / 1024).toFixed(1)} of 16 GB`, disk: mnFmtRate(T.read + T.write), net: '↓ ' + mnFmtRate(T.down), en: `74% · ${T.en > 60 ? '4 h' : '6 h'} left` };
    $$('#mn-side [data-mnsv]').forEach(e => e.textContent = sv[e.dataset.mnsv]);
    const mx = mnMax(MN.r); mnApps().forEach(a => { const b = $(`[data-mnv="${a.id}"]`); if (b) { b.textContent = mnFmt(mnVal(a)); b.nextElementSibling.firstElementChild.style.width = Math.min(100, mnVal(a) / mx * 100).toFixed(1) + '%'; } });
    const c = $$('#mn-body .mncells > div > b'); if (c.length) { const tmp = document.createElement('div'); tmp.innerHTML = mnHero(); $$('.mncells > div > b', tmp).forEach((x, i) => c[i] && (c[i].textContent = x.textContent)); const cr = $$('.mncores i', tmp); $$('#mn-body .mncores i').forEach((x, i) => cr[i] && (x.style.height = cr[i].style.height)); }
    if (MN.t % 5 === 0 && !document.activeElement?.closest?.('#mn-body') && !$('#mn-body').matches(':hover')) mnBody(true); }

  function mnClick(e, hit) { const q = s => hit(s);
    const pf = q('[data-mnperf]'); if (pf) { MN.perf = pf.dataset.mnperf; mnBody(true); mnToast({ saver: 'Battery saver: dimmer, slower, and it lasts longer', bal: 'Balanced', perf: 'Performance: faster, warmer, and it drains sooner' }[MN.perf]); return true; }
    if (!q('#mn-pop') && !q('[data-mnmenu]')) $('#mn-pop')?.remove();
    if (mnNarrow()) { const px = q('[data-mnpx]'); if (px) { const k = px.dataset.mnpx; MN.px = MN.px === k ? '' : k; mnBar(); return true; }
      if (q('[data-mnpick]') || q('[data-mndesel]') || q('[data-mnforce]') || q('[data-mnquit]') || q('[data-mnend]') || q('[data-mnkill]') || q('[data-mncont]')) MN.px = '';
      const r2 = q('[data-mnr]'); if (r2) { MN.px = ''; MN.r = r2.dataset.mnr; mnBody(); mnBar(); $('#mn-body').scrollTop = 0; return true; } }
    const r = q('[data-mnr]'); if (r) { MN.r = r.dataset.mnr; mnSide(); mnBody(); $('#mn-body').scrollTop = 0; return true; }
    if (q('[data-mnall]')) { MN.all = !MN.all; mnBody(true); mnBar(); mnSide(); return true; }
    const op = q('[data-mnopen]'); if (op) { const id = op.dataset.mnopen; MN.open[id] = !MN.open[id]; if (!MN.sel?.startsWith('p:')) MN.sel = 'a:' + id; mnBody(true); mnBar(); return true; }
    const g = q('[data-mngrp]'); if (g) { MN.group[g.dataset.mngrp] = !MN.group[g.dataset.mngrp]; mnBody(true); return true; }
    const mo = q('[data-mnmore]'); if (mo) { MN.more[mo.dataset.mnmore] = true; mnBody(true); return true; }
    const pk = q('[data-mnpick]'); if (pk) { MN.confirm = false; MN.sel = MN.sel === pk.dataset.mnpick ? null : pk.dataset.mnpick; $$('#mn-body .sel').forEach(x => x.classList.remove('sel')); if (MN.sel) (pk.closest('.mnapp') && pk.dataset.mnpick.startsWith('a:') ? pk.closest('.mnapp') : pk).classList.add('sel'); mnBar(); return true; }
    if (q('[data-mndesel]')) { MN.confirm = false; MN.sel = null; $$('#mn-body .sel').forEach(x => x.classList.remove('sel')); mnBar(); return true; }
    const so = q('[data-mnsort]'); if (so) { const k = so.dataset.mnsort, c = MN.sort || { k: 'v', dir: -1 }; MN.sort = { k, dir: c.k === k ? -c.dir : k === 'n' ? 1 : -1 }; mnBody(true); $(`#mn-body [data-mnsort="${k}"]`)?.focus(); return true; }
    if (q('[data-mnaskforce]')) { const a = mnFind(MN.sel).app; lConfirm($('#w-monitor'), { title: `Force quit ${a.n}?`, body: 'It stops at once, and anything unsaved is lost.', action: 'Force quit', icon: 'triangle-alert', onOK: () => { const b = document.createElement('button'); b.dataset.mnforce = ''; $('#mn-bar').append(b); b.click(); b.remove(); } }); return true; }
    if (q('[data-mnconfirm]')) { MN.confirm = false; mnBar(); return true; }
    if (q('[data-mncont]')) { const a = mnFind(MN.sel).app; MN.stopped.delete(a.id); a.cpu = a._cpu; mnBody(true); mnBar(); mnToast(`${a.n} is running again (SIGCONT)`); return true; }
    if (q('[data-mnpdet]')) { const p = mnFind(MN.sel).proc; MN.pdet = MN.pdet === p.pid ? null : p.pid; mnBody(true); mnBar(); return true; }
    if (q('[data-mnquit]') || q('[data-mnforce]')) { const a = mnFind(MN.sel).app, force = !!q('[data-mnforce]'); MN.confirm = false; $('#mn-pop')?.remove(); const el = $(`[data-mna="${a.id}"]`); el?.classList.add('going');
      setTimeout(() => { MN.quit.add(a.id); MN.sel = null; mnBody(true); mnBar(); mnSide(); mnToast(`${a.n} ${force ? 'was force quit (SIGKILL)' : 'quit'}`, ['Reopen', () => { MN.quit.delete(a.id); mnBody(true); mnSide(); }]); }, 380); return true; }
    if (q('[data-mnkill]') && !e.mnOK) { const p = mnFind(MN.sel).proc; lConfirm($('#w-monitor'), { title: `Kill ${p.n}?`, body: 'It stops at once, without a chance to save or clean up.', action: 'Kill', icon: 'triangle-alert', onOK: () => mnClick({ mnOK: true }, s => s === '[data-mnkill]' ? {} : null) }); return true; }
    if (q('[data-mnend]') || q('[data-mnkill]')) { const p = mnFind(MN.sel).proc, kill = !!q('[data-mnkill]'); $('#mn-pop')?.remove(); MN.sel = null; mnBar(); mnToast(`${kill ? 'Killed' : 'Ended'} ${p.n}${p.pid ? ' (' + p.pid + ')' : ''}`); return true; }
    if (q('[data-mncopy]')) { $('#mn-pop')?.remove(); const f = mnFind(MN.sel); mnToast(`Copied PID ${f.app ? f.app.procs[0][1] : f.proc.pid}`); return true; }
    const mm = q('[data-mnmenu]'); if (mm) { const f = mnFind(MN.sel);
      const key = f.app ? f.app.id : 'p' + f.proc.pid, stopped = MN.stopped.has(key), kern = f.proc?.kernel;
      mnPop(mm, (kern ? '' : (stopped ? crMi('data-mncont2', 'play', 'Continue (SIGCONT)') : crMi('data-mnstop', 'pause', 'Stop (SIGSTOP)')) + crMi('data-mnprio', 'arrow-down', 'Change priority\u2026'))
        + crMi('data-mnsheet="maps"', 'layers', 'Memory maps') + crMi('data-mnsheet="files"', 'file-text', 'Open files') + crMi('data-mncopy', 'copy', 'Copy PID')); return true; }
    if (q('[data-mnstop]') || q('[data-mncont2]')) { const f = mnFind(MN.sel), key = f.app ? f.app.id : 'p' + f.proc.pid, n = f.app ? f.app.n : f.proc.n; $('#mn-pop')?.remove();
      if (q('[data-mnstop]')) { MN.stopped.add(key); mnToast(`${n} is paused. Nothing it's doing is lost (SIGSTOP)`); } else { MN.stopped.delete(key); if (f.app) f.app.cpu = f.app._cpu; mnToast(`${n} is running again (SIGCONT)`); } mnBody(true); mnBar(); return true; }
    if (q('[data-mnprio]')) { const f = mnFind(MN.sel), key = f.app ? f.app.id : 'p' + f.proc.pid; mnPop($('#mn-bar [data-mnmenu]'), `<h6 class="mnph">Priority</h6>` + MNPRIO.map(([n, l]) => crMi(`data-mnprioset="${n}"`, '', `${l}<small>nice ${n}${+n < 0 ? ' \u00b7 needs your password' : ''}</small>`, (MN.prio[key] ?? '0') === n ? ' on' : '')).join('')); return true; }
    const ps = q('[data-mnprioset]'); if (ps) { const f = mnFind(MN.sel), key = f.app ? f.app.id : 'p' + f.proc.pid, n = ps.dataset.mnprioset; $('#mn-pop')?.remove(); MN.prio[key] = n; mnBody(true); mnToast(`${f.app ? f.app.n : f.proc.n} now runs at ${MNPRIO.find(x => x[0] === n)[1].toLowerCase()} priority (nice ${n})`); return true; }
    const sh = q('[data-mnsheet]'); if (sh) { $('#mn-pop')?.remove(); MN.sheet = sh.dataset.mnsheet; mnSheet(); return true; }
    if (q('[data-mnsheetx]')) { MN.sheet = null; mnSheet(); return true; }

    return false; }
  function renderMonitor() { $('#mn-top').innerHTML = `<img src="${A}monitor.svg" alt=""><b>Monitor</b><span class="chev">${ic('chevron-down')}</span>`; mnSide(); mnBody(); mnBar(); setInterval(mnLive, 1000); }
  document.addEventListener('input', e => { if (e.target.matches?.('[data-mnq]')) { MN.q = e.target.value; if (MN.q && !MN.all && !mnApps().some(a => a.n.toLowerCase().includes(MN.q.toLowerCase()))) MN.all = true; mnBody(true); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.activeElement?.closest?.('#w-monitor') && MN.sel) { MN.sel = null; $$('#mn-body .sel').forEach(x => x.classList.remove('sel')); mnBar(); } });

  /* ══ Leaf ════════════════════════════════════════════════════════════════════
     A library that looks like a shelf of good editions, and a reader that looks like a book: a real
     spread, set properly, with the app out of the way. Covers are Leaf's own series design for
     public-domain books; a book that brings its own cover keeps it. */
  const LFB = [
    { id: 'totc', t: 'A Tale of Two Cities', a: 'Charles Dickens', c1: '#5b1a1f', c2: '#d6b26a', ci: '#f3e6c8', v: 'classic', st: 'reading', p: .12, left: 'About 11 hours left', at: 'Book the First, Chapter II' },
    { id: 'moby', t: 'Moby-Dick', a: 'Herman Melville', c1: '#14263b', c2: '#7aa6c7', ci: '#e8eef4', v: 'waves', st: 'reading', p: .34, left: 'About 14 hours left', at: 'Chapter 41' },
    { id: 'alice', t: 'Alice’s Adventures in Wonderland', a: 'Lewis Carroll', c1: '#f1b89b', c2: '#a8403a', ci: '#3a1d17', v: 'play', st: 'reading', p: .62, left: 'About 1 hour left', at: 'Chapter VII' },
    { id: 'pp', t: 'Pride and Prejudice', a: 'Jane Austen', c1: '#9aad92', c2: '#f7f0e1', ci: '#fbf6ea', v: 'script', st: 'want', p: 0 },
    { id: 'gatsby', t: 'The Great Gatsby', a: 'F. Scott Fitzgerald', c1: '#0f1a2c', c2: '#caa54e', ci: '#ecdcaa', v: 'deco', st: 'new', p: 0 },
    { id: 'drac', t: 'Dracula', a: 'Bram Stoker', c1: '#151213', c2: '#b8292f', ci: '#eadbc3', v: 'bold', st: 'new', p: 0 },
    { id: 'frank', t: 'Frankenstein', a: 'Mary Shelley', c1: '#262b29', c2: '#b9e6a9', ci: '#dcefd4', v: 'bolt', st: 'finished', p: 1 },
    { id: 'walden', t: 'Walden', a: 'Henry David Thoreau', c1: '#ebe3cf', c2: '#557a46', ci: '#2e3a27', v: 'leaf', st: 'want', p: 0 },
    { id: 'eyre', t: 'Jane Eyre', a: 'Charlotte Brontë', c1: '#8b5660', c2: '#f1dbd5', ci: '#f8ecE8', v: 'script', st: 'want', p: 0 },
    { id: 'odyssey', t: 'The Odyssey', a: 'Homer', c1: '#c6652f', c2: '#1e1a16', ci: '#1e1a16', v: 'bold', st: 'finished', p: 1 }
  ];
  const lfB = id => LFB.find(b => b.id === id);
  /* The text. Only a few openings are typeset in this mockup; all are in the public domain. */
  const LFTXT = {
    totc: [{ part: 'Book the First · Recalled to Life', n: 'I', t: 'The Period', ps: [
      'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way—in short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only.',
      'There were a king with a large jaw and a queen with a plain face, on the throne of England; there were a king with a large jaw and a queen with a fair face, on the throne of France. In both countries it was clearer than crystal to the lords of the State preserves of loaves and fishes, that things in general were settled for ever.',
      'It was the year of Our Lord one thousand seven hundred and seventy-five. Spiritual revelations were conceded to England at that favoured period, as at this. Mrs. Southcott had recently attained her five-and-twentieth blessed birthday, of whom a prophetic private in the Life Guards had heralded the sublime appearance by announcing that arrangements were made for the swallowing up of London and Westminster.',
      'France, less favoured on the whole as to matters spiritual than her sister of the shield and trident, rolled with exceeding smoothness down hill, making paper money and spending it. Under the guidance of her Christian pastors, she entertained herself, besides, with such humane achievements as sentencing a youth to have his hands cut off, his tongue torn out with pincers, and his body burned alive, because he had not kneeled down in the rain to do honour to a dirty procession of monks which passed within his view, at a distance of some fifty or sixty yards.',
      'It is likely enough that, rooted in the woods of France and Norway, there were growing trees, when that sufferer was put to death, already marked by the Woodman, Fate, to come down and be sawn into boards, to make a certain movable framework with a sack and a knife in it, terrible in history. It is likely enough that in the rough outhouses of some tillers of the heavy lands adjacent to Paris, there were sheltered from the weather that very day, rude carts, bespattered with rustic mire, snuffed about by pigs, and roosted in by poultry, which the Farmer, Death, had already set apart to be his tumbrils of the Revolution. But that Woodman and that Farmer, though they work unceasingly, work silently, and no one heard them as they went about with muffled tread.',
      'In England, there was scarcely an amount of order and protection to justify much national boasting. Daring burglaries by armed men, and highway robberies, took place in the capital itself every night; families were publicly cautioned not to go out of town without removing their furniture to upholsterers’ warehouses for security; the highwayman in the dark was a City tradesman in the light.',
      'All these things, and a thousand like them, came to pass in and close upon the dear old year one thousand seven hundred and seventy-five. Environed by them, while the Woodman and the Farmer worked unheeded, those two of the large jaws, and those other two of the plain and the fair faces, trod with stir enough, and carried their divine rights with a high hand. Thus did the year one thousand seven hundred and seventy-five conduct their Greatnesses, and myriads of small creatures—the creatures of this chronicle among the rest—along the roads that lay before them.'] },
      { n: 'II', t: 'The Mail', ps: [
      'It was the Dover road that lay, on a Friday night late in November, before the first of the persons with whom this history has business. The Dover road lay, as to him, beyond the Dover mail, as it lumbered up Shooter’s Hill. He walked up hill in the mire by the side of the mail, as the rest of the passengers did; not because they had the least relish for walking exercise, under the circumstances, but because the hill, and the harness, and the mud, and the mail, were all so heavy, that the horses had three times already come to a stop, besides once drawing the coach across the road, with the mutinous intent of taking it back to Blackheath.',
      'With drooping heads and tremulous tails, they mashed their way through the thick mud, floundering and stumbling between whiles, as if they were falling to pieces at the larger joints. As often as the driver rested them and brought them to a stand, with a wary “Wo-ho! so-ho-then!” the near leader violently shook his head and everything upon it—like an unusually emphatic horse, denying that the coach could be got up the hill. Whenever the leader made this rattle, the passenger started, as a nervous passenger might, and was disturbed in mind.',
      '§There was a steaming mist in all the hollows, and it had roamed in its forlornness up the hill, like an evil spirit, seeking rest and finding none. A clammy and intensely cold mist, it made its slow way through the air in ripples that visibly followed and overspread one another, as the waves of an unwholesome sea might do. It was dense enough to shut out everything from the light of the coach-lamps but these its own workings, and a few yards of road; and the reek of the labouring horses steamed into it, as if they had made it all.',
      'Two other passengers, besides the one, were plodding up the hill by the side of the mail. All three were wrapped to the cheekbones and over the ears, and wore jack-boots. Not one of the three could have said, from anything he saw, what either of the other two was like; and each was hidden under almost as many wrappers from the eyes of the mind, as from the eyes of the body, of his two companions.'] }],
    pp: [{ part: 'Volume I', n: 'Chapter 1', t: '', ps: ['It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', 'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.', '“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”', 'Mr. Bennet replied that he had not.', '“But it is,” returned she; “for Mrs. Long has just been here, and she told me all about it.”', 'Mr. Bennet made no answer.', '“Do you not want to know who has taken it?” cried his wife impatiently.', '“You want to tell me, and I have no objection to hearing it.”', 'This was invitation enough.'] }],
    moby: [{ n: 'Chapter 1', t: 'Loomings', ps: ['Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people’s hats off—then, I account it high time to get to sea as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship. There is nothing surprising in this. If they but knew it, almost all men in their degree, some time or other, cherish very nearly the same feelings towards the ocean with me.', 'There now is your insular city of the Manhattoes, belted round by wharves as Indian isles by coral reefs—commerce surrounds it with her surf. Right and left, the streets take you waterward. Its extreme downtown is the battery, where that noble mole is washed by waves, and cooled by breezes, which a few hours previous were out of sight of land. Look at the crowds of water-gazers there.'] }]
  };
  const LFTOC = { totc: [['Book the First · Recalled to Life', ['The Period', 'The Mail', 'The Night Shadows', 'The Preparation', 'The Wine-shop', 'The Shoemaker']], ['Book the Second · The Golden Thread', ['Five Years Later', 'A Sight', 'A Disappointment', 'Congratulatory', 'The Jackal']], ['Book the Third · The Track of a Storm', ['In Secret', 'The Grindstone', 'The Shadow', 'Calm in Storm']]] };
  const LFDICT = { incredulity: ['noun', 'The state of being unwilling or unable to believe something.'], epoch: ['noun', 'A period of time in history or a person’s life, marked by notable events.'], tumbrils: ['noun', 'Open carts that tilt backward to empty; used to carry the condemned to the guillotine during the French Revolution.'], forlornness: ['noun', 'The state of being pitifully sad and abandoned or lonely.'], capitulated: ['verb', 'Ceased to resist an opponent; surrendered.'], environed: ['verb', 'Surrounded; enclosed.'], tremulous: ['adjective', 'Shaking or quivering slightly.'], mire: ['noun', 'A stretch of swampy or boggy ground; deep mud.'] };
  const LFTHEME = [['auto', 'Auto'], ['paper', 'Paper'], ['sepia', 'Sepia'], ['stone', 'Stone'], ['night', 'Night']];
  const LFFONT = [['literata', 'Literata', "'Literata', Georgia, serif"], ['news', 'Newsreader', "'Newsreader', Georgia, serif"], ['legible', 'Legible', "'Atkinson Hyperlegible', system-ui, sans-serif"]];
  const LF = { view: 'lib', shelf: 'reading', sort: 'recent', q: '', book: 'totc', spread: 0, spreads: 1, per: 2, theme: 'auto', font: 'literata', size: 19, lh: 1.62, layout: 'two', just: true, drawer: '', tsel: null, listen: false, playing: false, sent: null, speed: 1, bm: new Set(), notes: [], idle: 0 };

  /* ── Covers: one series, many books ── */
  function lfCover(b, cls = '') { const inner = {
      classic: `<span class="fr"></span><small class="au">${b.a}</small><b class="ti">${b.t}</b><i class="orn">❦</i>`,
      script: `<b class="ti">${b.t}</b><i class="ln"></i><small class="au">${b.a}</small>`,
      waves: `<b class="ti">${b.t.toUpperCase()}</b><small class="au">${b.a}</small><i class="wv"></i>`,
      bold: `<b class="ti">${b.t.replace(/^The /, '')}</b><small class="au">${b.a}</small>`,
      deco: `<i class="fan"></i><small class="au">${b.a}</small><b class="ti">${b.t}</b>`,
      bolt: `<i class="zz"></i><b class="ti">${b.t}</b><small class="au">${b.a}</small>`,
      leaf: `<i class="lv"></i><b class="ti">${b.t}</b><small class="au">${b.a}</small>`,
      play: `<i class="dots"></i><b class="ti">${b.t.replace('’s Adventures in', ' in')}</b><small class="au">${b.a}</small>` }[b.v];
    return `<span class="lfcov v-${b.v} ${cls}" style="--c1:${b.c1};--c2:${b.c2};--ci:${b.ci}"><span class="lfcf">${inner}<i class="lfmk"></i></span></span>`; }

  /* ── Library ── */
  const LFSHELF = [['reading', 'Reading now', 'book-open'], ['want', 'Want to read', 'bookmark'], ['finished', 'Finished', 'check'], ['all', 'All books', 'library-big'], ['hl', 'Highlights and notes', 'pencil']];
  const lfIn = (b, s) => s === 'all' ? true : s === 'want' ? b.st === 'want' || b.st === 'new' : b.st === s;
  function lfSide() { const n = s => s === 'hl' ? LF.notes.length : LFB.filter(b => lfIn(b, s)).length;
    $('#lf-side').innerHTML = `<div class="lfsh6">Library</div>${LFSHELF.map(([k, l, i]) => `<button class="lfsi${LF.shelf === k && LF.view === 'lib' ? ' on' : ''}" type="button" data-lfshelf="${k}">${ic(i)}<span>${l}</span>${lCount(n(k))}</button>`).join('')}
      <div class="lfsh6">Collections</div><button class="lfsi" type="button" data-lfshelf="all">${ic('layers')}<span>Gothic nights</span>${lCount(3)}</button><button class="lfsi" type="button" data-lfshelf="all">${ic('layers')}<span>At sea</span>${lCount(2)}</button><button class="lfsi quiet" type="button" data-lftodo="Name your collection, then drag books in">${ic('plus')}<span>New collection</span></button>
      ${lFoot({ q: { attr: 'data-lfq', ph: 'Search your books', value: LF.q }, add: { attr: 'data-lfadd', label: 'Add books', icon: 'plus' } })}`; }
  function lfLib() { const b = lfB('totc'), also = LFB.filter(x => x.st === 'reading' && x.id !== 'totc'), q = LF.q.trim().toLowerCase();
    let list = LFB.filter(x => lfIn(x, LF.shelf) && (!q || (x.t + ' ' + x.a).toLowerCase().includes(q)));
    if (LF.sort === 'title') list = list.slice().sort((x, y) => x.t.replace(/^(The|A) /, '').localeCompare(y.t.replace(/^(The|A) /, '')));
    if (LF.sort === 'author') list = list.slice().sort((x, y) => x.a.split(' ').pop().localeCompare(y.a.split(' ').pop()));
    const shelf = LFSHELF.find(s => s[0] === LF.shelf);
    const grid = LF.shelf === 'hl' ? `<div class="lfhls">${LF.notes.map(n => `<button class="lfhln" type="button" data-lfopen="${n.book}"><i class="c${n.c}"></i><span><q>${esc(n.text)}</q>${n.note ? `<em>${esc(n.note)}</em>` : ''}<small>${lfB(n.book).t} · ${n.ch}</small></span></button>`).join('') || `<p class="lfnone">Select words while you read to highlight them. They'll collect here.</p>`}</div>`
      : `<div class="lfgrid">${list.map(x => `<button class="lfbk" type="button" data-lfopen="${x.id}"><span class="lfbw">${lfCover(x)}</span><b>${x.t}</b><small>${x.a}</small>${x.p > 0 && x.p < 1 ? `<span class="lfpr"><i style="width:${x.p * 100}%"></i></span><em>${Math.round(x.p * 100)}%</em>` : x.p >= 1 ? '<em class="done">Finished</em>' : x.st === 'new' ? '<em class="new">New</em>' : '<em>Not started</em>'}</button>`).join('') || `<p class="lfnone">No books match “${esc(LF.q)}”.</p>`}</div>`;
    $('#lf-lib').innerHTML = `<div class="lfpad">${LF.shelf === 'reading' && !q ? `<section class="lfhero" style="--c1:${b.c1};--c2:${b.c2}"><i class="lfglow"></i>
        <button class="lfbook" type="button" data-lfopen="totc" aria-label="Continue ${b.t}">${lfCover(b, 'big')}</button>
        <div class="lfhtx"><span class="lfeye">Continue reading</span><h1>${b.t}</h1><p class="lfby">${b.a}</p>
          <blockquote class="lfq">“There was a steaming mist in all the hollows, and it had roamed in its forlornness up the hill, like an evil spirit, seeking rest and finding none.”</blockquote>
          <div class="lfmeta"><span title="${esc(b.at)}">${esc(b.at.split(', ').pop())} · ${Math.round(b.p * 100)}% · ${esc(b.left.replace(/^About /, '').replace(/ hours?/, ' h'))}</span><span class="lfpr"><i style="width:${b.p * 100}%"></i></span></div>
          <div class="lfacts"><button class="bt key" type="button" data-lfopen="totc">${ic('book-open')}Continue</button><button class="bt fill" type="button" data-lflisten="totc">${ic('headphones')}Listen</button></div></div>
        <div class="lfalso"><h6>Also reading</h6>${also.map(x => `<button class="lfar" type="button" data-lfopen="${x.id}"><span class="lfbw sm">${lfCover(x)}</span><span><b>${x.t}</b><small>${x.at} · ${Math.round(x.p * 100)}%</small><span class="lfpr"><i style="width:${x.p * 100}%"></i></span></span></button>`).join('')}</div></section>` : ''}
      <section class="lfshelf"><div class="lfshh"><h2>${LF.shelf === 'reading' && !q ? 'Your books' : shelf[1]}</h2><span>${LF.shelf === 'hl' ? LF.notes.length + ' saved' : (LF.shelf === 'reading' && !q ? LFB.length : list.length) + ' books'}</span>${LF.shelf === 'hl' ? '' : seg([['recent', 'Recent'], ['title', 'Title'], ['author', 'Author']], LF.sort, 'data-lfsort', 'Sort')}</div>${LF.shelf === 'reading' && !q ? `<div class="lfgrid">${LFB.map(x => `<button class="lfbk" type="button" data-lfopen="${x.id}"><span class="lfbw">${lfCover(x)}</span><b>${x.t}</b><small>${x.a}</small>${x.p > 0 && x.p < 1 ? `<span class="lfpr"><i style="width:${x.p * 100}%"></i></span><em>${Math.round(x.p * 100)}%</em>` : x.p >= 1 ? '<em class="done">Finished</em>' : x.st === 'new' ? '<em class="new">New</em>' : '<em>Not started</em>'}</button>`).join('')}</div>` : grid}</section></div>`; }

  /* ── Reader ── */
  const lfSent = p => { const here = p.startsWith('§'); if (here) p = p.slice(1); return p.split(/(?<=[.!?][”’"]?)\s+(?=[“"A-Z])/).map((s, i) => `<span class="lfs"${here && !i ? ' data-here' : ''}>${esc(s)}</span>`).join(' '); };
  function lfText(id) { const chs = LFTXT[id], b = lfB(id);
    const title = `<section class="lftp"><small>${b.a}</small><h1>${b.t}</h1><i class="lforn">❦</i><span>Leaf Editions</span></section>`;
    if (!chs) return title + `<section class="lfchap brk"><header class="lfchh"><span class="lfnum">A note</span><h2>Not typeset here</h2></header><p class="first">Only the openings of <i>A Tale of Two Cities</i>, <i>Pride and Prejudice</i> and <i>Moby-Dick</i> are set in this mockup. In Leaf, every book opens here, set the same way.</p></section>`;
    return (id === 'totc' ? '' : title) + chs.map((c, i) => `<section class="lfchap${i || id !== 'totc' ? ' brk' : ''}" data-ch="${i}"><header class="lfchh">${c.part ? `<span class="lfpart">${c.part}</span>` : ''}<span class="lfnum">${c.n}</span>${c.t ? `<h2>${c.t}</h2>` : ''}<i class="lforn">❦</i></header>${c.ps.map((p, j) => j === 0 && /^[A-Z]/.test(p) ? `<p class="first"><span class="lfdrop" aria-hidden="true">${p[0]}</span>${lfSent(p.slice(1))}</p>` : `<p${j === 0 ? ' class="first"' : ''}>${lfSent(p)}</p>`).join('')}</section>`).join('')
      + `<section class="lfchap brk lfend"><p>${id === 'totc' ? 'The mockup ends here. Chapter III, “The Night Shadows,” would begin on this page.' : 'The mockup ends here.'}</p></section>`; }
  const lfEl = () => ({ st: $('#lf-stage'), vp: $('#lf-vp'), tx: $('#lf-text') });
  const lfCol = el => { const r = el.getClientRects()[0], t = $('#lf-text').getBoundingClientRect(), k = t.width / $('#lf-text').offsetWidth || 1; return r ? Math.floor(((r.left - t.left) / k + 2) / LF.col) : 0; };
  function lfLayout(keep = true) { const { st, vp, tx } = lfEl(); if (!st || LF.view !== 'read') return; const frac = keep && LF.spreads > 1 ? LF.spread / (LF.spreads - 1) : 0;
    const W = st.clientWidth, H = st.clientHeight, two = LF.layout === 'two' && W > 880, G = 104, mx = two ? Math.max(64, (W - 2 * 520 - G) / 2) : lfNarrow() ? 24 : Math.max(48, (W - 640) / 2), vw = W - 2 * mx, colW = two ? (vw - G) / 2 : vw, top = lfNarrow() ? 92 : 68, bot = lfNarrow() ? 110 : 76;
    Object.assign(vp.style, { left: mx + 'px', top: top + 'px', width: vw + 'px', height: (H - top - bot) + 'px' });
    Object.assign(tx.style, { height: (H - top - bot) + 'px', columnWidth: colW + 'px', columnGap: G + 'px', transition: 'none' });
    const f = LFFONT.find(x => x[0] === LF.font); st.style.setProperty('--lff', f[2]); st.style.setProperty('--lfs', LF.size + 'px'); st.style.setProperty('--lflh', LF.lh); st.classList.toggle('two', two); st.classList.toggle('just', LF.just);
    [$('#lf-rh'), $('#lf-pn')].forEach(x => Object.assign(x.style, { left: mx + 'px', width: vw + 'px', gridTemplateColumns: two ? '1fr 1fr' : '1fr', columnGap: G + 'px' })); $('#lf-rib').style.right = (mx + 28) + 'px';
    LF.per = two ? 2 : 1; LF.stride = vw + G; LF.col = colW + G; LF.mx = mx; LF.colW = colW; LF.G = G;
    const cols = Math.max(1, Math.round((tx.scrollWidth + G) / (colW + G))); LF.cols = cols; LF.spreads = Math.ceil(cols / LF.per);
    LF.chapCols = $$('.lfchap', tx).map(c => ({ col: lfCol(c), ch: +c.dataset.ch, end: c.classList.contains('lfend') }));
    if (keep) LF.spread = Math.round(frac * (LF.spreads - 1));
    lfGo(LF.spread, false); requestAnimationFrame(() => tx.style.transition = ''); }
  function lfGo(s, anim = true) { const { tx } = lfEl(); LF.spread = Math.max(0, Math.min(LF.spreads - 1, s)); if (!anim) tx.style.transition = 'none'; tx.style.transform = `translateX(${-LF.spread * LF.stride}px)`; if (!anim) requestAnimationFrame(() => tx.style.transition = ''); lfChrome(); }
  function lfChapAt(col) { const cs = (LF.chapCols || []).filter(c => !c.end && c.col <= col); return cs.length ? cs[cs.length - 1] : null; }
  const LFBASE = { totc: 21, pp: 3, moby: 13 };
  function lfChrome() { const b = lfB(LF.book), chs = LFTXT[LF.book] || [], c0 = LF.spread * LF.per, base = LFBASE[LF.book] || 1;
    const head = col => { const c = lfChapAt(col), starts = (LF.chapCols || []).some(x => x.col === col); return starts || col === 0 && !chs.length ? '' : c ? (chs[c.ch]?.t || b.t) : b.t; };
    $('#lf-rh').innerHTML = `<span>${LF.per === 2 ? esc(b.t) : esc(head(c0))}</span>${LF.per === 2 ? `<span>${esc(head(c0 + 1))}</span>` : ''}`;
    $('#lf-rh').classList.toggle('hideL', (LF.chapCols || []).some(x => x.col === c0)); $('#lf-rh').classList.toggle('hideR', (LF.chapCols || []).some(x => x.col === c0 + 1));
    $('#lf-pn').innerHTML = `<span>${base + c0}</span>${LF.per === 2 && c0 + 1 < LF.cols ? `<span>${base + c0 + 1}</span>` : ''}`;
    $('#lf-rib').classList.toggle('on', LF.bm.has(LF.book + ':' + LF.spread));
    const pct = LF.spreads > 1 ? LF.spread / (LF.spreads - 1) : 0;
    $('#lf-prog').innerHTML = `<i class="fill" style="width:${pct * 100}%"></i>${(LF.chapCols || []).filter(c => !c.end).map(c => `<i class="tick" style="left:${c.col / Math.max(1, LF.cols - 1) * 100}%"></i>`).join('')}<span class="lfpt">${LF.book === 'totc' ? `Page ${base + c0} of 489 · ${Math.round(12 + pct * 2)}%` : `Page ${base + c0}`}</span>`;
    if (!LF.tsel && !LF.listen) lfBar(); }
  function lfOpen(id, listen) { LF.book = id; LF.view = 'read'; LF.drawer = ''; LF.tsel = null; const w = $('#w-leaf'); w.classList.add('reading'); $('#lf-lib').hidden = true; $('#lf-read').hidden = false;
    $('#lf-text').innerHTML = lfText(id); lfTheme(); LF.spread = 0; LF.spreads = 1; lfLayout(false);
    const here = $('#lf-text [data-here]'); if (here && id === 'totc') { lfGo(Math.floor(lfCol(here) / LF.per), false); here.classList.add('lfhere'); setTimeout(() => here.classList.remove('lfhere'), 3600); }
    lfDrawer(); lfWake(); if (listen) lfListen(true); }
  function lfClose() { lfListen(false); LF.view = 'lib'; $('#w-leaf').classList.remove('reading'); $('#lf-read').hidden = true; $('#lf-lib').hidden = false; lfSide(); lfLib(); lfBar(); $('#lf-bar').classList.remove('tuck'); }
  function lfTheme() { const t = LF.theme === 'auto' ? (document.body.dataset.mode === 'light' ? 'paper' : 'night') : LF.theme; $('#lf-read').dataset.theme = t; }

  /* ── The bar: tucks away while you read; comes back when you move ── */
  /* Leaf on a phone. Library: the shelf is a dropdown in the bar (with how it's sorted), then Search and Add books.
     Reading: Back, where you are (tap for Contents and Highlights, which grow the bar), Bookmark, Aa, Listen. */
  const lfNarrow = () => { const w = $('#w-leaf'); return !!w?.clientWidth && w.clientWidth < 560; };
  function lfBarPhone(bar) { const X = LF.px || '', ib = (attr, icn, label, on) => `<button class="ib${on ? ' on' : ''}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
    bar.hidden = false; bar.classList.add('phnofit', 'lfphbar');
    if (LF.view === 'lib') { const sh = LFSHELF.find(x => x[0] === LF.shelf) || LFSHELF[0], n = k => k === 'hl' ? LF.notes.length : LFB.filter(b => lfIn(b, k)).length;
      const panel = X === 'shelf' ? `<div class="fexp fmore2 lfshp">${LFSHELF.map(([k, l, i]) => `<button class="fexr2${LF.shelf === k ? ' on' : ''}" type="button" data-lfshelf="${k}">${ic(i)}<span>${l}</span><em>${n(k)}</em></button>`).join('')}<div class="fexh">Collections</div><button class="fexr2" type="button" data-lfshelf="all">${ic('layers')}<span>Gothic nights</span><em>3</em></button><button class="fexr2" type="button" data-lfshelf="all">${ic('layers')}<span>At sea</span><em>2</em></button><div class="fexh">Sort by</div><div class="fexs">${[['recent', 'Recent'], ['title', 'Title'], ['author', 'Author']].map(([k, l]) => `<button type="button" class="fsch${LF.sort === k ? ' on' : ''}" data-lfsort="${k}">${l}</button>`).join('')}</div></div>`
        : '';
      bar.classList.toggle('phgrow', !!panel);
      setBar(bar, X === 'search' ? `<label class="srch keep">${ic('search')}<input data-lfq placeholder="Search your books" value="${esc(LF.q)}" aria-label="Search your books"></label>${ib('data-lfpx="search"', 'x', 'Close search')}` : `${panel}<button class="lfsh2${X === 'shelf' ? ' on' : ''}" type="button" data-lfpx="shelf" aria-expanded="${X === 'shelf'}">${ic(sh[2])}<b>${sh[1]}</b>${ic('chevron-down')}</button><span class="sp"></span>${ib('data-lfpx="search"', 'search', 'Search', !!LF.q)}${ib('data-lfadd', 'plus', 'Add books')}`);
      if (X === 'search') setTimeout(() => $('#lf-bar [data-lfq]')?.focus(), 30); return; }
    if (LF.listen) return false;
    const c = lfChapAt(LF.spread * LF.per), ch = LFTXT[LF.book]?.[c?.ch], panel = LF.drawer ? `<div class="fexp lfdraw2">${$('#lf-draw').innerHTML}</div>` : '';
    bar.classList.toggle('phgrow', !!panel);
    setBar(bar, `${panel}${ib('data-lfback', 'chevron-left', 'Library')}<button class="lfch2${LF.drawer ? ' on' : ''}" type="button" data-lfdraw="${LF.drawer ? '' : 'toc'}"><span><b>${ch ? `${ch.n.replace('Chapter ', '')} · ${esc(ch.t || lfB(LF.book).t)}` : esc(lfB(LF.book).t)}</b><small>${Math.round(LF.spreads > 1 ? LF.spread / (LF.spreads - 1) * 100 : 0)}% · ${esc(lfB(LF.book).t)}</small></span>${ic('chevron-up')}</button>${ib('data-lfbm', 'bookmark', 'Bookmark', LF.bm.has(LF.book + ':' + LF.spread))}${ib('data-lfaa', 'type', 'Type and page')}${ib(`data-lflisten="${LF.book}"`, 'headphones', 'Listen')}`); return true; }
  function lfBar() { const bar = $('#lf-bar'); let h;
    if (lfNarrow()) { if (lfBarPhone(bar) !== false) return; } else bar.classList.remove('phnofit', 'lfphbar', 'phgrow');
    lfSel(); bar.hidden = LF.view === 'lib'; if (LF.view === 'lib') return;
    if (LF.listen) { const c = lfChapAt(LF.spread * LF.per), ch = LFTXT[LF.book]?.[c?.ch];
      h = `<button class="ctxc lflis" type="button" data-lfdraw="toc" title="Contents"><span class="eq${LF.playing ? '' : ' paused'}"><i></i><i></i><i></i></span>${ch ? `${ch.n.replace('Chapter ', '')} · ${ch.t || lfB(LF.book).t}` : lfB(LF.book).t}</button><span class="vr"></span><button class="ib" type="button" data-lfskip="-1" title="Back a sentence">${ic('rotate-ccw')}</button><button class="mkey round lfplay" type="button" data-lfplay aria-label="${LF.playing ? 'Pause' : 'Play'}">${ic(LF.playing ? 'pause' : 'play')}</button><button class="ib" type="button" data-lfskip="1" title="Forward a sentence">${ic('rotate-cw')}</button><span class="vr"></span><button class="bt lfspd" type="button" data-lfspeed title="Speed">${LF.speed}×</button><button class="bt" type="button" data-lfstop title="Stop listening">Stop</button>`; }
    else { const c = lfChapAt(LF.spread * LF.per), ch = LFTXT[LF.book]?.[c?.ch];
      h = `<button class="ib" type="button" data-lfback title="Library">${ic('chevron-left')}</button><button class="ctxc" type="button" data-lfdraw="toc">${ic('list')}${ch ? `${ch.n.replace('Chapter ', '')} · ${ch.t || lfB(LF.book).t}` : lfB(LF.book).t}<em>${ch ? `${Math.max(1, Math.round(((LF.chapCols.find((x, i, a) => a[i - 1] && a[i - 1].ch === c.ch)?.col ?? LF.cols) - LF.spread * LF.per) * 1.4))} min left` : ''}</em></button><span class="vr"></span><button class="ib${LF.bm.has(LF.book + ':' + LF.spread) ? ' on' : ''}" type="button" data-lfbm title="Bookmark">${ic('bookmark')}</button><button class="ib" type="button" data-lfaa title="Type and page">${ic('type')}</button><button class="bt" type="button" data-lflisten="${LF.book}">${ic('headphones')}Listen</button>`; }
    setBar(bar, h); }
  /* A selection's actions float just above it in the LumaUI selection bubble: the quote, the highlight colours, Note, Define and Copy */
  function lfSel() { const bar = $('#lf-sel'), s = getSelection(); if (!bar) return; if (!LF.tsel || LF.view !== 'read' || !s.rangeCount || s.isCollapsed) { lBubble.hide(bar); return; }
    const w = LF.tsel.text.trim(), d = LFDICT[w.toLowerCase().replace(/[^a-z]/g, '')];
    lBubble(bar, $('#lf-main'), s.getRangeAt(0).getBoundingClientRect(), `<span class="lfsnip" title="${esc(w)}">“${esc(w.slice(0, 22))}${w.length > 22 ? '…' : ''}”</span><span class="lfhsw">${[['1', 'Yellow'], ['2', 'Green'], ['3', 'Blue'], ['4', 'Pink']].map(([c, n]) => `<button type="button" class="c${c}" data-lfhl="${c}" aria-label="Highlight ${n}" title="Highlight ${n}"></button>`).join('')}</span><span class="vr"></span><button class="bt" type="button" data-lfnote>${ic('pencil')}Note</button>${w.split(/\s+/).length <= 2 && d ? `<button class="bt" type="button" data-lfdef>${ic('book-open')}Define</button>` : ''}<button class="ib" type="button" data-lfcopy title="Copy" aria-label="Copy">${ic('copy')}</button>`); }
  function lfWake() { const bar = $('#lf-bar'); bar.classList.remove('tuck'); clearTimeout(LF.idle); if (LF.view !== 'read') return;
    LF.idle = setTimeout(() => { if (LF.tsel || LF.drawer || $('#lf-pop') || bar.matches(':hover') || (LF.listen && !LF.playing)) return lfWake(); bar.classList.add('tuck'); $('#w-leaf').classList.add('calm'); }, 2600); $('#w-leaf').classList.remove('calm'); }

  /* ── Drawer: contents, and your highlights ── */
  function lfDrawer() { lfDrawer0(); if (lfNarrow() && LF.view === 'read') lfBar(); }
  function lfDrawer0() { const d = $('#lf-draw'); d.classList.toggle('on', !!LF.drawer); if (!LF.drawer) return; const b = lfB(LF.book), cur = lfChapAt(LF.spread * LF.per)?.ch ?? -1;
    const toc = LFTOC[LF.book] || [[b.t, (LFTXT[LF.book] || []).map(c => c.t || c.n)]]; let k = 0;
    d.innerHTML = `<div class="lfdh"><span class="lfbw xs">${lfCover(b)}</span><span><b>${b.t}</b><small>${b.a}</small></span><button class="ib" type="button" data-lfdraw="" title="Close">${ic('x')}</button></div>
      <div class="lfdl">${LF.drawer === 'toc' ? toc.map(([part, chs]) => `<h6>${part}</h6>${chs.map((t, i) => { const idx = k++, has = !!LFTXT[LF.book]?.[idx]; return `<button class="lfti${idx === cur ? ' on' : ''}${has ? '' : ' dim'}" type="button" ${has ? `data-lfch="${idx}"` : `data-lftodo="Only the first two chapters are set in this mockup"`}><em>${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i] || i + 1}</em><span>${t}</span>${idx === cur ? '<i>Reading</i>' : idx < cur ? `<small>${ic('check')}</small>` : ''}</button>`; }).join('')}`).join('')
        : (LF.notes.filter(n => n.book === LF.book).map(n => `<button class="lfhln" type="button" data-lfjump="${n.id}"><i class="c${n.c}"></i><span><q>${esc(n.text)}</q>${n.note ? `<em>${esc(n.note)}</em>` : ''}<small>${n.ch}</small></span></button>`).join('') || `<p class="lfnone">Select words on the page to highlight them.</p>`)
        + (LF.drawer === 'marks' ? [...LF.bm].filter(x => x.startsWith(LF.book)).map(x => `<button class="lfti" type="button" data-lfgo="${x.split(':')[1]}">${ic('bookmark')}<span>Page ${(LFBASE[LF.book] || 1) + (+x.split(':')[1]) * LF.per}</span></button>`).join('') : '')}</div>
      <div class="sidetabs lfdtabs">${seg([['toc', 'Contents'], ['marks', 'Highlights']], LF.drawer, 'data-lfdraw', 'Show')}</div>`; requestAnimationFrame(segs); }

  /* ── Type and page ── */
  function lfAa(anchor) { $('#lf-pop')?.remove(); const w = $('#w-leaf'), wr = w.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    w.insertAdjacentHTML('beforeend', `<div class="lfpop" id="lf-pop"><div class="lfthm">${LFTHEME.map(([k, n]) => `<button type="button" class="t-${k}${LF.theme === k ? ' on' : ''}" data-lftheme="${k}"><span>Aa</span><small>${n}</small></button>`).join('')}</div>
      <hr class="lfhr"><div class="lfrow"><button class="lfsz" type="button" data-lfsize="-1" aria-label="Smaller">A</button><span class="lfszv"><i style="width:${(LF.size - 14) / 12 * 100}%"></i></span><button class="lfsz big" type="button" data-lfsize="1" aria-label="Larger">A</button></div>
      <div class="lfrow">${seg(LFFONT.map(([k, n]) => [k, n]), LF.font, 'data-lffont', 'Typeface', 'lffonts')}</div>
      <hr class="lfhr"><div class="lfrow lfpair"><label><small>Line spacing</small>${seg([['1.45', 'Snug'], ['1.62', 'Normal'], ['1.85', 'Airy']], String(LF.lh), 'data-lflh', 'Spacing')}</label><label><small>Layout</small>${seg([['two', 'Spread'], ['one', 'Page']], LF.layout, 'data-lflayout', 'Layout')}</label></div><hr class="lfhr">
      <button class="lfjust" type="button" data-lfjust><span>Justify and hyphenate</span><i class="cksw${LF.just ? ' on' : ''}"></i></button></div>`);
    const p = $('#lf-pop'); p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left + r.width / 2 - p.offsetWidth / 2)) + 'px'; p.style.bottom = (wr.bottom - r.top + 10) + 'px'; requestAnimationFrame(segs); }

  /* ── Listening: the sentence being read is lit on the page, and the page turns with it ── */
  function lfListen(on) { clearTimeout(LF.lt); $$('#lf-text .lfs.lfnow').forEach(x => x.classList.remove('lfnow')); LF.listen = on; LF.playing = on;
    if (on) { const first = $$('#lf-text .lfs').find(s => lfCol(s) >= LF.spread * LF.per); LF.sent = first || $('#lf-text .lfs'); lfSay(); }
    lfBar(); lfWake(); }
  function lfSay() { clearTimeout(LF.lt); const s = LF.sent; if (!s || !LF.listen) return; $$('#lf-text .lfs.lfnow').forEach(x => x.classList.remove('lfnow')); s.classList.add('lfnow');
    const sp = Math.floor(lfCol(s) / LF.per); if (sp !== LF.spread) lfGo(sp);
    if (LF.playing) LF.lt = setTimeout(() => { const all = $$('#lf-text .lfs'), i = all.indexOf(s); LF.sent = all[i + 1]; if (LF.sent) lfSay(); else lfListen(false); }, Math.max(1400, Math.min(6000, s.textContent.length * 38)) / LF.speed); }

  // Drop books anywhere on the library to add them
  ['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { const l = e.target.closest?.('#lf-lib'); if (!l) return; e.preventDefault(); $('#w-leaf').classList.add('lfdrop'); }));
  ['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { const l = e.target.closest?.('#lf-lib'); if (!l) return; e.preventDefault(); if (t === 'dragleave' && l.contains(e.relatedTarget)) return; $('#w-leaf').classList.remove('lfdrop'); if (t === 'drop') { const n = e.dataTransfer?.files?.length || 1; lfToast(`Added ${n} book${n > 1 ? 's' : ''} to your library`); } }));
  function lfToast(msg, icon) { lToast($('#w-leaf'), msg, { icon: icon || (/^Copied/.test(msg) ? 'copy' : /^Bookmark/.test(msg) ? 'bookmark' : 'check') }); }
  function lfHighlight(c, note) { const s = getSelection(); if (!s.rangeCount || !LF.tsel) return; const r = s.getRangeAt(0), m = document.createElement('mark'), id = 'h' + Date.now(); m.className = 'lfhl c' + c; m.dataset.hl = id;
    try { m.appendChild(r.extractContents()); r.insertNode(m); } catch (e) {} const ch = LFTXT[LF.book]?.[lfChapAt(LF.spread * LF.per)?.ch];
    LF.notes.unshift({ id, book: LF.book, c, text: LF.tsel.text.trim(), note, ch: ch ? (ch.t ? `Chapter ${ch.n} · ${ch.t}` : ch.n) : lfB(LF.book).t }); s.removeAllRanges(); LF.tsel = null; lfBar(); lfDrawer(); lfSide(); }

  function lfClick(e, hit) { const q = s => hit(s);
    if (lfNarrow()) { const px = q('[data-lfpx]'); if (px) { const k = px.dataset.lfpx; LF.px = LF.px === k ? '' : k; lfBar(); return true; } if (q('[data-lfshelf]') || q('[data-lfadd]')) { LF.px = ''; setTimeout(lfBar); } if (q('[data-lfsort]')) setTimeout(lfBar); }
    if (q('[data-lfadd]')) { lfToast('Choose books to add. You can also drop them anywhere in Leaf'); return true; }
    if (!q('#lf-pop') && !q('[data-lfaa]')) $('#lf-pop')?.remove();
    const op = q('[data-lfopen]'); if (op) { lfOpen(op.dataset.lfopen); return true; }
    const ls = q('[data-lflisten]'); if (ls) { if (LF.view === 'lib') lfOpen(ls.dataset.lflisten, true); else lfListen(true); return true; }
    const sh = q('[data-lfshelf]'); if (sh) { if (LF.view === 'read') lfClose(); LF.shelf = sh.dataset.lfshelf; lfSide(); lfLib(); $('#lf-lib').scrollTop = 0; return true; }
    const so = q('[data-lfsort]'); if (so) { LF.sort = so.dataset.lfsort; if (LF.shelf === 'reading') LF.shelf = 'all'; lfSide(); lfLib(); lfBar(); return true; }
    const td = q('[data-lftodo]'); if (td) { lfToast(td.dataset.lftodo); return true; }
    if (q('[data-lfback]')) { lfClose(); return true; }
    const tn = q('[data-lfturn]'); if (tn) { lfGo(LF.spread + +tn.dataset.lfturn); lfWake(); return true; }
    const dr = q('[data-lfdraw]'); if (dr) { const k = dr.dataset.lfdraw; LF.drawer = LF.drawer === k && dr.matches('.ctxc') ? '' : k; lfDrawer(); requestAnimationFrame(segs); return true; }
    const chb = q('[data-lfch]'); if (chb) { const c = LF.chapCols.find(x => x.ch === +chb.dataset.lfch); if (c) lfGo(Math.floor(c.col / LF.per)); LF.drawer = ''; lfDrawer(); return true; }
    const gb = q('[data-lfgo]'); if (gb) { lfGo(+gb.dataset.lfgo); LF.drawer = ''; lfDrawer(); return true; }
    const jb = q('[data-lfjump]'); if (jb) { const m = $(`#lf-text mark[data-hl="${jb.dataset.lfjump}"]`); if (m) lfGo(Math.floor(lfCol(m) / LF.per)); LF.drawer = ''; lfDrawer(); return true; }
    if (q('[data-lfbm]')) { const k = LF.book + ':' + LF.spread; LF.bm.has(k) ? LF.bm.delete(k) : LF.bm.add(k); lfChrome(); lfToast(LF.bm.has(k) ? 'Bookmarked this page' : 'Bookmark removed'); return true; }
    if (q('[data-lfaa]')) { $('#lf-pop') ? $('#lf-pop').remove() : lfAa(q('[data-lfaa]')); return true; }
    const th = q('[data-lftheme]'); if (th) { LF.theme = th.dataset.lftheme; lfTheme(); $$('#lf-pop [data-lftheme]').forEach(x => x.classList.toggle('on', x === th)); return true; }
    const sz = q('[data-lfsize]'); if (sz) { LF.size = Math.max(14, Math.min(26, LF.size + +sz.dataset.lfsize)); $('#lf-pop .lfszv i').style.width = (LF.size - 14) / 12 * 100 + '%'; lfLayout(); return true; }
    const fo = q('[data-lffont]'); if (fo) { LF.font = fo.dataset.lffont; lfLayout(); $$('#lf-pop [data-lffont]').forEach(x => x.classList.toggle('on', x === fo)); requestAnimationFrame(segs); return true; }
    const lh = q('[data-lflh]'); if (lh) { LF.lh = +lh.dataset.lflh; lfLayout(); $$('#lf-pop [data-lflh]').forEach(x => x.classList.toggle('on', x === lh)); requestAnimationFrame(segs); return true; }
    const la = q('[data-lflayout]'); if (la) { LF.layout = la.dataset.lflayout; lfLayout(); $$('#lf-pop [data-lflayout]').forEach(x => x.classList.toggle('on', x === la)); requestAnimationFrame(segs); return true; }
    if (q('[data-lfjust]')) { LF.just = !LF.just; q('[data-lfjust] .cksw').classList.toggle('on', LF.just); lfLayout(); return true; }
    const hl = q('[data-lfhl]'); if (hl) { lfHighlight(+hl.dataset.lfhl); lfToast('Highlighted'); return true; }
    if (q('[data-lfnote]')) { const t = LF.tsel?.text; lfHighlight(1, 'Worth reading aloud at the launch.'); lfToast('Note added to your highlights'); return true; }
    if (q('[data-lfdef]')) { const w = LF.tsel.text.trim(), k = w.toLowerCase().replace(/[^a-z]/g, ''), d = LFDICT[k], r = getSelection().getRangeAt(0).getBoundingClientRect(), wr = $('#w-leaf').getBoundingClientRect();
      $('#lf-pop')?.remove(); $('#w-leaf').insertAdjacentHTML('beforeend', `<div class="lfpop lfdef" id="lf-pop"><b>${esc(w)}</b><em>${d ? d[0] : ''}</em><p>${d ? d[1] : 'No offline definition. Leaf can look it up on the web.'}</p></div>`);
      const p = $('#lf-pop'); p.style.left = Math.max(8, Math.min(wr.width - p.offsetWidth - 8, r.left - wr.left + r.width / 2 - p.offsetWidth / 2)) + 'px'; p.style.bottom = (wr.bottom - r.top + 10) + 'px'; return true; }
    if (q('[data-lfcopy]')) { getSelection().removeAllRanges(); LF.tsel = null; lfBar(); lfToast('Copied'); return true; }
    if (q('[data-lfplay]')) { LF.playing = !LF.playing; lfBar(); if (LF.playing) lfSay(); else clearTimeout(LF.lt); return true; }
    const sk = q('[data-lfskip]'); if (sk) { const all = $$('#lf-text .lfs'), i = all.indexOf(LF.sent); LF.sent = all[Math.max(0, Math.min(all.length - 1, i + +sk.dataset.lfskip))]; lfSay(); return true; }
    if (q('[data-lfspeed]')) { LF.speed = { 1: 1.25, 1.25: 1.5, 1.5: 2, 2: .75, .75: 1 }[LF.speed]; lfBar(); lfSay(); return true; }
    if (q('[data-lfstop]')) { lfListen(false); return true; }
    const pg = q('#lf-prog'); if (pg) { const r = pg.getBoundingClientRect(); lfGo(Math.round((e.clientX - r.left) / r.width * (LF.spreads - 1))); return true; }
    if (q('#lf-stage') && LF.drawer) { LF.drawer = ''; lfDrawer(); return true; }
    return false; }
  function renderLeaf() { $('#lf-top').innerHTML = `${NAVBTN}<img src="../icons/Suno-v4-leaf.svg" alt=""><b>Leaf</b><span class="chev">${ic('chevron-down')}</span>`; lfSide(); lfLib(); lfBar();
    const w = $('#w-leaf'); w.addEventListener('pointermove', () => { if (LF.view === 'read') lfWake(); });
    new ResizeObserver(() => lfLayout()).observe($('#lf-stage'));
    $('#lf-stage').addEventListener('wheel', e => { if (Math.abs(e.deltaX) + Math.abs(e.deltaY) < 30 || LF.wheel) return; LF.wheel = true; setTimeout(() => LF.wheel = false, 450); lfGo(LF.spread + ((e.deltaY || e.deltaX) > 0 ? 1 : -1)); }, { passive: true });
    new MutationObserver(() => { if (LF.theme === 'auto') lfTheme(); }).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] }); }
  document.addEventListener('keydown', e => { if (LF.view !== 'read' || front()?.dataset.app !== 'leaf' || e.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); lfGo(LF.spread + 1); } else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); lfGo(LF.spread - 1); } else if (e.key === 'Escape') { if ($('#lf-pop')) $('#lf-pop').remove(); else if (LF.drawer) { LF.drawer = ''; lfDrawer(); } else if (LF.tsel) { getSelection().removeAllRanges(); } } });
  document.addEventListener('input', e => { if (e.target.matches?.('[data-lfq]')) { LF.q = e.target.value; if (LF.q && LF.shelf === 'reading') LF.shelf = 'all'; lfSide(); lfLib(); } });
  document.addEventListener('selectionchange', () => { clearTimeout(LF.st); LF.st = setTimeout(() => { if (LF.view !== 'read') return; const s = getSelection(), n = s.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement), text = s.toString();
    if (el?.closest?.('#lf-text') && text.trim() && !s.isCollapsed) { LF.tsel = { text }; lfBar(); lfWake(); } else if (LF.tsel) { LF.tsel = null; lfBar(); } }, 150); });

  /* ══ Viewer ══════════════════════════════════════════════════════════════════
     Open anything, see it well, and do the small jobs without another app: mark it up, fix it, read the
     text in it, pick a colour off it, compare it with another version, sign it. Nothing ever writes over
     the file you opened; changes are kept beside it until you save a copy. */
  /* Files we draw ourselves: a receipt photo (for Live Text) and a simple frame. */
  function vwDraw(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const out = fn(x, w, h) || {}; out.src = c.toDataURL('image/png'); return out; }
  const VWREC = vwDraw(900, 1240, (x, W, H) => { x.fillStyle = '#2e2924'; x.fillRect(0, 0, W, H); const g = x.createRadialGradient(W * .4, H * .3, 50, W * .5, H * .5, W); g.addColorStop(0, 'rgba(255,220,170,.10)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 40; x.shadowOffsetY = 18; x.fillStyle = '#f4f0e6'; x.fillRect(150, 80, 600, 1080); x.shadowColor = 'transparent';
    for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .025})`; x.fillRect(150 + Math.random() * 600, 80 + Math.random() * 1080, 2, 2); }
    const L = [], line = (t, y, o = {}) => { x.font = `${o.b ? '700 ' : ''}${o.s || 26}px ui-monospace, Menlo, monospace`; x.fillStyle = o.c || '#26231f'; const w = x.measureText(t).width, px = o.r ? 710 - w : o.m ? 450 - w / 2 : 190; x.fillText(t, px, y); L.push({ t, x: px, y: y - (o.s || 26) * .82, w, h: (o.s || 26) * 1.05, k: o.k }); };
    line('PARCEL & POST', 170, { b: 1, s: 38, m: 1 }); line('118 Alameda Ave, Studio 4', 222, { m: 1, s: 22, c: '#5a554c', k: 'addr' }); line('Oakland CA 94607', 252, { m: 1, s: 22, c: '#5a554c', k: 'addr' }); line('(510) 555-0183', 282, { m: 1, s: 22, c: '#5a554c', k: 'tel' });
    x.fillStyle = '#26231f'; x.fillRect(190, 318, 520, 2); line('ORDER #2048', 372); line('Sep 18, 2026  10:14 AM', 410, { k: 'date' });
    x.fillRect(190, 442, 520, 2); line('Linen notebook A5 x2', 496); line('24.00', 496, { r: 1 }); line('Brass pen, medium nib', 540); line('38.00', 540, { r: 1 }); line('Shipping', 584); line('0.00', 584, { r: 1 });
    x.fillRect(190, 620, 520, 2); line('TOTAL', 682, { b: 1, s: 32 }); line('$62.00', 682, { b: 1, s: 32, r: 1, k: 'money' }); line('Paid with card', 724, { s: 22, c: '#5a554c' });
    line('Returns within 30 days.', 980, { m: 1, s: 22, c: '#5a554c' }); line('Thank you, Nick!', 1030, { m: 1, s: 26 });
    x.fillStyle = '#26231f'; for (let i = 0; i < 44; i++) x.fillRect(250 + i * 9.2, 1070, (i * 7) % 3 + 1.5, 50); return { lines: L }; });
  const VWFRAME = vwDraw(1920, 1080, x => { x.fillStyle = '#7d3353'; x.beginPath(); x.roundRect(0, 0, 1920, 1080, 44); x.fill(); x.fillStyle = '#fff'; x.fillRect(0, 150, 1920, 780); x.fillStyle = '#e03a86'; x.fillRect(560, 290, 800, 500); x.fillStyle = '#fff'; x.fillRect(790, 440, 340, 170); });
  const S2 = 'studio/';
  const VWF = [
    { id: 'offsite', n: 'Offsite-hero.jpg', src: PH + 'life-hero-studio.webp', kind: 'JPEG image', sz: '2.1 MB', grp: 'Today', exif: true, where: '~/Pictures/Offsite' },
    { id: 'receipt', n: 'Receipt, Parcel & Post.png', src: VWREC.src, w: 900, h: 1240, kind: 'PNG image', sz: '1.2 MB', grp: 'Today', text: VWREC.lines, where: '~/Downloads' },
    { id: 'lease', n: 'Lease-2027-draft.pdf', pdf: true, kind: 'PDF document', sz: '1.2 MB', grp: 'Today', where: '~/Documents/Studio', pages: 3 },
    { id: 'v7', n: 'Filer, take seven.webp', src: S2 + '7-filer-dark.webp', kind: 'WebP image', sz: '480 KB', grp: 'This week', where: '~/Design/Luma' },
    { id: 'v6', n: 'Filer, take six.webp', src: S2 + '6-filer-dark.webp', kind: 'WebP image', sz: '470 KB', grp: 'This week', where: '~/Design/Luma' },
    { id: 'frame', n: 'Frame 1.png', src: VWFRAME.src, w: 1920, h: 1080, kind: 'PNG image', sz: '8.5 KB', grp: 'This week', where: '~/Documents' },
    { id: 'terrace', n: 'Terrace.jpg', src: PH + 'life-sync-terrace.webp', kind: 'JPEG image', sz: '2.7 MB', grp: 'This week', exif: true, where: '~/Pictures/Offsite' },
    { id: 'gone1', n: '374dbd570a3b548.png', gone: true, grp: 'Earlier' }, { id: 'gone2', n: 'e42e990219a26d4.png', gone: true, grp: 'Earlier' }
  ];
  const VW = { cur: 'offsite', mode: 'view', tool: 'pen', color: '#ff5a4f', width: 6, info: false, zoom: 0, fit: 1, pan: [0, 0], ann: {}, redo: {}, adj: {}, crop: {}, cropping: false, aspect: 'free', pick: false, picks: [], live: false, cmp: null, cmpMode: 'swipe', cmpX: .5, q: '', sel: new Set(), sig: false, hold: false, flip: {}, rot: {} };
  const vwF = id => VWF.find(f => f.id === id);
  const VWCOL = ['#ff5a4f', '#ffb020', '#3ccf7c', '#3d8bff', '#111111'];
  const VWTOOLS = [['select', 'mouse-pointer-2', 'Select and move'], ['pen', 'pencil', 'Pen'], ['hl', 'highlighter', 'Highlighter'], ['rect', 'square', 'Rectangle'], ['ellipse', 'circle', 'Ellipse'], ['arrow', 'arrow-up-right', 'Arrow'], ['text', 'type', 'Text'], ['step', 'list-ordered', 'Numbered steps'], ['blur', 'droplets', 'Blur'], ['redact', 'eye-off', 'Redact (removed for good when you save)'], ['sign', 'signature', 'Signature']];
  const VWADJ = [['exp', 'Exposure', -100, 100, 'Light'], ['con', 'Contrast', -100, 100, 'Light'], ['hi', 'Highlights', -100, 100, 'Light'], ['sh', 'Shadows', -100, 100, 'Light'],
    ['sat', 'Saturation', -100, 100, 'Color'], ['vib', 'Vibrance', -100, 100, 'Color'], ['warm', 'Warmth', -100, 100, 'Color'], ['tint', 'Tint', -100, 100, 'Color'], ['str', 'Straighten', -15, 15, 'Straighten']];

  /* ── The frame: what you've opened ── */
  function vwSide() { const q = VW.q.toLowerCase(), list = VWF.filter(f => !q || f.n.toLowerCase().includes(q)); let g = '';
    $('#vw-side').innerHTML = `<div class="scr vwlist">${list.map(f => { const h = f.grp !== g ? `<div class="vwgh">${(g = f.grp)}</div>` : ''; const on = VW.cur === f.id || VW.sel.has(f.id);
        return h + `<button class="vwrow${on ? ' on' : ''}${f.gone ? ' gone' : ''}" type="button" data-vwopen="${f.id}">${f.gone ? `<i class="vwth ph">${ic('image')}</i>` : f.pdf ? `<i class="vwth pdf"><span></span><span></span><span></span></i>` : `<i class="vwth" style="background-image:url('${f.src}')"></i>`}<span><b>${esc(f.n)}</b><small>${f.gone ? 'Moved or deleted' : f.sz}${VW.ann[f.id]?.length ? ` · ${VW.ann[f.id].length} mark${VW.ann[f.id].length > 1 ? 's' : ''}` : ''}</small></span></button>`; }).join('')}</div>
      <div class="shead sfoot vwfoot"><label class="srch">${ic('search')}<input placeholder="Search" value="${esc(VW.q)}" data-vwq></label><button class="snew" type="button" data-vwtodo="Filer opens as a picker" title="Open a file" aria-label="Open a file">${ic('folder-open')}</button></div>`; }

  /* ── The stage ── */
  function vwNat(f) { return f.w ? [f.w, f.h] : f._w ? [f._w, f._h] : [1600, 1000]; }
  function vwOpen(id, keep) { const f = vwF(id); if (!f || f.gone) { f && vwToast(`${f.n} was moved or deleted. Filer can look for it`); return; }
    VW.cur = id; if (!keep) { VW.zoom = 0; VW.pan = [0, 0]; VW.cropping = false; VW.live = false; VW.pick = false; VW.cmp = null; if (f.pdf && VW.mode === 'adjust') VW.mode = 'view'; }
    if (!f.pdf && !f.w && !f._w) { const im = new Image(); im.onload = () => { f._w = im.naturalWidth; f._h = im.naturalHeight; vwStage(); vwInfo(); }; im.src = f.src; }
    vwSide(); vwStage(); vwInfo(); vwBar(); }
  function vwFilter(id) { const a = VW.adj[id] || {}, e = (a.exp || 0) / 100, c = (a.con || 0) / 100, s = (a.sat || 0) / 100, w = (a.warm || 0) / 100, hi = (a.hi || 0) / 100, sh = (a.sh || 0) / 100, v = (a.vib || 0) / 100, t = (a.tint || 0) / 100;
    return VW.hold ? 'none' : `brightness(${1 + e * .6 + sh * .15 + hi * .08}) contrast(${1 + c * .6 - sh * .2 + hi * .12}) saturate(${1 + s + v * .5}) sepia(${Math.max(0, w) * .35}) hue-rotate(${(w < 0 ? w * 18 : 0) + t * 14}deg)`; }
  function vwStage() { const st = $('#vw-stage'), f = vwF(VW.cur); if (!f) return;
    if (VW.cmp) return vwCompare();
    if (f.pdf) { const keepY = $('#vw-pscroll')?.scrollTop || 0; st.innerHTML = `<div class="vwpdf"><nav class="vwpages">${[1, 2, 3].map(n => `<button type="button" class="${n === 1 ? 'on' : ''}" data-vwpage="${n}"><i class="pg"><span></span><span></span><span></span><span></span></i><em>${n}</em></button>`).join('')}</nav><div class="vwpscroll scroll" id="vw-pscroll">${vwLease()}</div></div>`; $('#vw-pscroll').scrollTop = keepY; vwAnnDraw(); return; }
    const [W, H] = vwNat(f), c = VW.crop[f.id], vw = c ? c.w : W, vh = c ? c.h : H, sw = st.clientWidth - (vwNarrow() ? 0 : 120), sh = st.clientHeight - (vwNarrow() ? (VW.mode === 'view' ? 260 : 330) : VW.mode === 'markup' ? 220 : 150);
    VW.fit = Math.min(sw / vw, sh / vh, 1.5); const z = VW.zoom || VW.fit, rot = (VW.rot[f.id] || 0) + ((VW.adj[f.id] || {}).str || 0), fl = VW.flip[f.id] ? -1 : 1, dim = Math.abs(rot % 180) === 90;
    st.innerHTML = `<div class="vwdoc${VW.cropping ? ' cropping' : ''}" id="vw-doc" style="--z:${z};width:${vw}px;height:${vh}px;transform:translate(calc(-50% + ${VW.pan[0]}px), calc(-50% + ${VW.pan[1]}px)) scale(${z * (dim ? Math.min(vw / vh, vh / vw) : 1)}) rotate(${rot}deg) scaleX(${fl})">
      <div class="vwclip" style="width:${vw}px;height:${vh}px"><img id="vw-img" src="${f.src}" alt="" style="width:${W}px;height:${H}px;left:${c ? -c.x : 0}px;top:${c ? -c.y : 0}px;filter:${vwFilter(f.id)}" draggable="false"></div>
      <svg class="vwann" id="vw-ann" viewBox="${c ? `${c.x} ${c.y} ${c.w} ${c.h}` : `0 0 ${W} ${H}`}" preserveAspectRatio="none"></svg>
      ${VW.live && f.text ? `<div class="vwlive" style="width:${W}px;height:${H}px;left:${c ? -c.x : 0}px;top:${c ? -c.y : 0}px">${f.text.map(l => `<span class="${l.k ? 'dd ' + l.k : ''}" style="left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;font-size:${l.h * .92}px" ${l.k ? `data-vwdd="${l.k}"` : ''}>${esc(l.t)}</span>`).join('')}</div>` : ''}
      ${VW.cropping ? vwCropUI(f) : ''}</div>
      ${VW.pick ? `<div class="vwloupe" id="vw-loupe" hidden><i class="lp"></i><span></span></div>` : ''}`;
    $('#vw-zoom') && ($('#vw-zoom').textContent = Math.round(z * 100) + '%'); vwAnnDraw(); }
