/* ══ Diskord: a Discord client for Luma (mockup, 22 Oct 2026; take two) ══════════════════════════════════════════
   Not a copy of Discord's layout: what Discord is for, drawn with Luma's parts.

   Why people open it, most often first: to catch up (who said my name, what's new), to talk in a channel, to hop
   into a room with friends, to message someone. So:

   - Home is Catch up: your mentions from every server, the rooms your people are in right now, then what's unread,
     then your conversations. It answers "what did I miss" before you go looking.
   - A server is a place with a face. Its photo leads its column as a banner and lights the window (--ch is its hue).
   - Voice channels are rooms, not list rows: who's inside, who's talking (a ring), who's streaming. Joining one
     opens the room: the stream as a screen, everyone else as faces that glow when they speak.
   - A channel has one header that belongs to it: what it is and what it's for on the left; who's here,
     notifications and ··· on the right. Threads and pins are tabs in the details panel, beside Members.
   - The composer is one surface: add, what you write, emoji, and Send once there's something to send. It grows
     in place for a reply line, emoji and attachments (LumaUI action center).
   - Messages flow (face, name, lines), not bubbles: a channel is many people, and code, links and long messages
     need the width.

   Phone (under 560): list, then page. The list is the rail and the server's column (banner, rooms, channels); a
   channel pushes the conversation, with Back in the title island at the top left, and the island grows into the
   channel's details. The composer is two rows: what you write, a hairline, then what you add. While you're in a
   room, the list's bar grows a voice row above search.

   The simulator hands over its shared parts in render(K); nothing here reaches into its closure. */
(() => {
  'use strict';
  const ST = { g: 'owls', home: false, dm: null, ph: 'list', voice: null, voiceView: false, mute: false, deaf: false, cam: false, share: false,
    panel: 'members', panelOn: true, isl: false, reply: null, grow: null, sel: null, q: '', typing: null, speak: 'TH', bell: {}, draft: '' };
  let K = null, W = null, RO = null, lastShape = '', speakT = 0;
  const D = () => window.DISCORD_DATA;
  const PHOTO = '../social-luma/photos/';

  /* ── small parts ── */
  const q$ = s => W && W.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => K.ic(n) || (() => { const v = (window.__iconBundle || {})[n]; return v ? v.replace(/<!--[\s\S]*?-->/g, '').replace(/stroke-width="[\d.]+"/, 'stroke-width="1.6"').replace(/ width="24"/, '').replace(/ height="24"/, '').replace('<svg', '<svg class="i" aria-hidden="true"') : ''; })();
  const narrow = () => (W?.clientWidth || 999) < 560;
  const wide = () => (W?.clientWidth || 0) >= 1080;   /* room for the details panel beside the conversation */
  const who = k => (K.PPL || {})[k] || D().PEOPLE[k] || { n: k, h: 250 };
  const ME = () => (K.PPL?.me?.u || 'nick');
  const first = k => k === 'me' ? 'You' : who(k).n.split(' ')[0];
  const fullName = k => k === 'me' ? 'Nick' : who(k).n;
  const presence = k => (D().PRESENCE[k] || ['off'])[0];
  const activity = k => (D().PRESENCE[k] || [])[1] || '';
  const guild = (id = ST.g) => D().GUILDS.find(g => g.id === id);
  const channels = g => g.cats.flatMap(c => c.chs);
  const channel = (g = guild(), id = g.last) => channels(g).find(c => c.id === id) || channels(g)[0];
  const dm = (id = ST.dm) => D().DMS.find(d => d.id === id);
  const catchup = () => ST.home && !ST.dm;
  const conv = () => ST.home ? dm() : channel();
  const roleColor = (g, k) => { if (!g) return ''; const r = g.roleOf?.[k], row = r && g.roles.find(x => x[0] === r); return (row?.[2] || '').replace(/oklch\(0\.\d+/, 'oklch(var(--dc-rl)'); };   /* role colours keep their hue and take the mode's lightness */
  const ini = n => (w => (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase())(n.split(' '));
  const online = g => g.members.filter(k => presence(k) !== 'off').length;
  const roomPeople = (g, c) => { const base = g.voice?.ch === c.id ? g.voice.people : []; return ST.voice && ST.voice.g === g.id && ST.voice.ch === c.id ? [...new Set([...base, 'me'])] : base; };
  const talking = k => k === ST.speak && !(k === 'me' && ST.mute);
  const STATUS = { on: 'Online', idle: 'Idle', dnd: 'Do not disturb', off: 'Offline' };

  function face(k, sz = 40, status = false) {
    const p = who(k); let a;
    if ((K.PPL || {})[k] && K.av) a = K.av(k, sz);
    else if (p.img) a = `<i class="av round dc-avi" style="width:${sz}px;height:${sz}px;background-image:url('${p.img}')"></i>`;
    else a = `<i class="av round" style="width:${sz}px;height:${sz}px;background:oklch(0.62 0.12 ${p.h});font-size:${Math.round(sz * .36)}px">${ini(p.n)}</i>`;
    if (!status) return a;
    const s = presence(k);
    return `<span class="dc-face" style="--sz:${sz}px">${a}<i class="dc-st ${s}" aria-label="${STATUS[s]}"></i></span>`;
  }
  /* faces in a room carry who they are, so the one talking lights up wherever they're drawn */
  const faces = (ks, sz, talk) => `<span class="dc-faces">${ks.map(k => `<span class="dc-fc${talk && talking(k) ? ' talk' : ''}"${talk ? ` data-dc-who="${k}"` : ''}>${face(k, sz)}</span>`).join('')}</span>`;
  const gIcon = (g, sz = 44) => g.icon ? `<i class="dc-gi lumai" style="--sz:${sz}px"><img src="${g.icon}" alt=""></i>`
    : g.img ? `<i class="dc-gi" style="--sz:${sz}px;background-image:url('${g.img}');background-position:${g.pos || '50% 50%'}"></i>`
    : `<i class="dc-gi" style="--sz:${sz}px;background:oklch(0.55 0.13 ${g.h})">${ini(g.n)}</i>`;
  const chIcon = c => ic(c.voice ? 'volume-2' : c.kind === 'news' ? 'megaphone' : 'hash');
  const fmt = t => esc(t).replace(/@([a-z][\w.]*)/gi, (s, u) => `<span class="dc-at${u === ME() ? ' me' : ''}">@${u === ME() ? 'you' : u}</span>`)
    .replace(/(^|\s)#([a-z][\w-]*)/g, (s, a, c) => `${a}<span class="dc-at ch">${ic('hash')}${c}</span>`);
  const preview = x => x.t || (x.embed ? x.embed.title : x.img ? 'Image' : x.file ? x.file.n : x.code ? 'Code' : '');
  const unreadOf = g => channels(g).reduce((a, c) => a + (c.unread || 0), 0);
  const mentionsOf = g => channels(g).reduce((a, c) => a + (c.mentions || 0), 0);
  const dmUnread = () => D().DMS.reduce((a, d) => a + (d.unread || 0), 0);
  const toast = (msg, icon = 'check') => K.lToast(W, msg, { icon });
  const nowAt = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  /* everything that mentions you, newest first, from every server */
  const mentionsAll = () => D().GUILDS.flatMap(g => channels(g).flatMap(c => (c.msgs || []).filter(x => x.mention && x.from !== 'me').map(x => ({ g, c, x })))).reverse();
  const liveRooms = () => D().GUILDS.flatMap(g => channels(g).filter(c => c.voice && roomPeople(g, c).length).map(c => ({ g, c, people: roomPeople(g, c) })));
  const unreadAll = () => D().GUILDS.flatMap(g => channels(g).filter(c => c.unread && !c.voice).map(c => ({ g, c })));

  /* ── the sidebar: the rail | the place ── */
  function rail() {
    const g1 = g => `<button class="dc-rb${!ST.home && ST.g === g.id ? ' on' : ''}${unreadOf(g) || g.unreadDot ? ' un' : ''}" type="button" data-dc-g="${g.id}" aria-label="${esc(g.n)}" title="${esc(g.n)}">${gIcon(g)}${mentionsOf(g) ? `<em class="dc-badge">${mentionsOf(g)}</em>` : ''}</button>`;
    const homeN = mentionsAll().length + dmUnread();
    return `<div class="dc-rail"><button class="dc-rb home${ST.home ? ' on' : ''}${homeN ? ' un' : ''}" type="button" data-dc-home aria-label="Home" title="Home"><i class="dc-gi dc-homei"><img src="${K.A}diskord.svg" alt=""></i>${homeN ? `<em class="dc-badge">${homeN}</em>` : ''}</button><i class="dc-rsep"></i>
      ${D().GUILDS.map(g1).join('')}<i class="dc-rsep"></i><button class="dc-rb add" type="button" data-dc-todo="Join or create a server" aria-label="Add a server" title="Add a server"><i class="dc-gi dc-addi">${ic('plus')}</i></button><button class="dc-rb add" type="button" data-dc-todo="Find communities" aria-label="Find communities" title="Find communities"><i class="dc-gi dc-addi">${ic('compass')}</i></button></div>`;
  }
  function banner(g) {
    const img = g.img ? `<i class="dc-bimg" style="background-image:url('${g.img}');background-position:${g.pos || '50% 50%'}"></i>` : `<i class="dc-bimg lum"><img src="${g.icon}" alt=""></i>`;
    return `<button class="dc-banner" type="button" data-dc-gmenu aria-label="${esc(g.n)} options">${img}<span class="dc-btx"><b>${esc(g.n)}</b><small><i class="dc-dot"></i>${online(g)} online · ${g.members.length} members</small></span><i class="dc-bch">${ic('chevron-down')}</i></button>`;
  }
  function room(g, c) { const ppl = roomPeople(g, c), mine = ST.voice && ST.voice.g === g.id && ST.voice.ch === c.id;
    if (!ppl.length) return `<button class="dc-room empty" type="button" data-dc-ch="${c.id}">${ic('volume-2')}<b>${esc(c.n)}</b><small>Empty</small></button>`;
    return `<button class="dc-room${mine ? ' in' : ''}" type="button" data-dc-ch="${c.id}"><span class="dc-rh">${ic('volume-2')}<b>${esc(c.n)}</b>${ppl.includes('NF') ? '<em class="dc-live">Live</em>' : ''}<small>${mine ? 'You’re here' : ppl.length + ' here'}</small></span>${faces(ppl, 28, true)}</button>`; }
  function chanList() { const g = guild(), q = ST.q.trim().toLowerCase(), cur = !ST.home && !ST.voiceView && channel().id;
    const text = channels(g).filter(c => !c.voice && (!q || c.n.includes(q))), rooms = channels(g).filter(c => c.voice && (!q || c.n.includes(q)));
    const row = c => `<button class="si dc-ch${c.id === cur ? ' on' : ''}${c.unread ? ' un' : ''}${ST.bell[c.id] ? ' muted' : ''}" type="button" data-dc-ch="${c.id}">${chIcon(c)}<span class="lab">${esc(c.n)}</span>${c.mentions ? K.lCount(c.mentions, true) : ''}</button>`;
    return `${banner(g)}<div class="scr dc-chs">${rooms.length ? `<div class="dc-sh">Rooms</div><div class="dc-rooms">${rooms.map(c => room(g, c)).join('')}</div>` : ''}
      ${g.cats.filter(cat => cat.chs.some(c => !c.voice && text.includes(c))).map(cat => `<div class="dc-sh">${esc(cat.n === 'Text channels' ? 'Channels' : cat.n)}</div>${cat.chs.filter(c => !c.voice && text.includes(c)).map(row).join('')}`).join('')}
      ${!text.length && !rooms.length ? `<div class="dc-none">Nothing called “${esc(ST.q)}”</div>` : ''}</div>`; }
  function homeList() { const q = ST.q.trim().toLowerCase(), name = d => d.group ? d.name : who(d.with).n, last = d => d.msgs[d.msgs.length - 1], n = mentionsAll().length;
    return `<div class="dc-hhead"><b>Home</b><small>${n} mention${n === 1 ? '' : 's'} · ${liveRooms().length} room${liveRooms().length === 1 ? '' : 's'} live</small></div><div class="scr dc-chs">
      <button class="si dc-ch dc-cuh${catchup() ? ' on' : ''}" type="button" data-dc-catchup>${ic('sparkles')}<span class="lab">Catch up</span>${n ? K.lCount(n, true) : ''}</button>
      <div class="dc-sh">Conversations</div>${D().DMS.filter(d => !q || name(d).toLowerCase().includes(q)).map(d => `<button class="si dc-dm${ST.home && d.id === ST.dm ? ' on' : ''}${d.unread ? ' un' : ''}" type="button" data-dc-dm="${d.id}">
      ${d.group ? `<span class="dc-gav">${face(d.group[0], 26)}${face(d.group[1], 26)}</span>` : face(d.with, 36, true)}<span class="lab"><b>${esc(name(d))}</b><small>${last(d).from === 'me' ? 'You: ' : ''}${esc(preview(last(d)))}</small></span>${d.unread ? K.lCount(d.unread, true) : ''}</button>`).join('')}</div>`; }
  function voiceCard(ph) { const v = ST.voice; if (!v) return ''; const g = guild(v.g), c = channel(g, v.ch);
    return `<div class="dc-vcard${ph ? ' ph' : ''}"><button class="dc-vwho" type="button" data-dc-voiceview>${faces(roomPeople(g, c).slice(0, 3), 22, true)}<span><b>${esc(c.n)}</b><small>${esc(g.n)}</small></span></button>
      <button class="ib${ST.mute ? ' lit red' : ''}" type="button" data-dc-mute aria-label="${ST.mute ? 'Unmute' : 'Mute'}" title="${ST.mute ? 'Unmute' : 'Mute'}">${ic(ST.mute ? 'mic-off' : 'mic')}</button><button class="ib${ST.deaf ? ' lit red' : ''}" type="button" data-dc-deaf aria-label="${ST.deaf ? 'Undeafen' : 'Deafen'}" title="${ST.deaf ? 'Undeafen' : 'Deafen'}">${ic(ST.deaf ? 'headphone-off' : 'headphones')}</button><button class="ib dc-leave" type="button" data-dc-leave aria-label="Leave the room" title="Leave the room">${ic('phone-off')}</button></div>`; }
  const placeHTML = () => ST.home ? homeList() : chanList();
  function side() { const el = q$('#dc-side'); if (!el) return; if (narrow()) { el.innerHTML = ''; return; } const had = document.activeElement?.id === 'dc-q';
    el.innerHTML = `${rail()}<i class="dc-vdiv"></i><div class="dc-col">${placeHTML()}${voiceCard()}<div class="shead sfoot"><label class="srch">${ic('search')}<input id="dc-q" placeholder="${ST.home ? 'Find a conversation' : 'Search ' + esc(guild().n)}" value="${esc(ST.q)}" aria-label="Search" autocomplete="off"></label><button class="snew" type="button" data-dc-new aria-label="New message" title="New message">${ic('square-pen')}</button></div></div>`;
    wireSearch('dc-q', had); }
  function wireSearch(id, refocus) { const i = q$('#' + id); if (!i) return;
    i.oninput = () => { ST.q = i.value; if (narrow()) { body(true); return; } side(); };
    i.onkeydown = e => { if (e.key === 'Escape') { ST.q = ''; i.value = ''; narrow() ? body(true) : side(); } }; if (refocus) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }

  /* ── the conversation ── */
  function msgHTML(c, g) { const arr = c.msgs, ph = narrow();
    return arr.map((x, i) => { const p = arr[i - 1];
      if (x.sys) return `${x.day && x.day !== p?.day ? `<div class="dc-day"><span>${x.day}</span></div>` : ''}<div class="dc-sys">${ic('calendar-days')}<span>${fmt(x.t)}</span><time>${x.at}</time></div>`;
      const day = x.day && (!p || x.day !== p.day), head = day || !p || p.from !== x.from || p.sys || x.reply || x.isNew;
      const ref = x.reply ? (x.reply === 'prev' ? arr[i - 1] : arr.find(y => y.id === x.reply)) : null;
      const rx = x.reacts && Object.keys(x.reacts).length ? `<div class="dc-rx">${Object.entries(x.reacts).map(([e, ks]) => `<button type="button" class="${ks.includes('me') ? 'me' : ''}" data-dc-react="${x.id}:${e}" title="${ks.map(first).join(', ')}">${e}<b>${ks.length}</b></button>`).join('')}<button type="button" class="dc-rxadd" data-dc-rxadd="${x.id}" aria-label="Add a reaction">${ic('smile-plus')}</button></div>` : '';
      const col = roleColor(g, x.from), th = x.thread;
      return `${day ? `<div class="dc-day"><span>${x.day}</span></div>` : ''}${x.isNew ? '<div class="dc-new"><span>New</span></div>' : ''}
      <div class="dc-m${head ? ' head' : ''}${x.mention ? ' at' : ''}${ST.sel === x.id ? ' sel' : ''}${x.fresh ? ' fresh' : ''}" data-dc-mid="${x.id}">
        ${ref ? `<button class="dc-ref" type="button" data-dc-jump="${ref.id}">${face(ref.from, 16)}<b${roleColor(g, ref.from) ? ` style="color:${roleColor(g, ref.from)}"` : ''}>${esc(first(ref.from))}</b><span>${esc(preview(ref))}</span></button>` : ''}
        ${head ? `<span class="dc-ma">${face(x.from, 40)}</span>` : `<time class="dc-mt2">${x.at.replace(/ [AP]M$/, '')}</time>`}
        <div class="dc-mc">${head ? `<div class="dc-mh"><b${col ? ` style="color:${col}"` : ''}>${esc(fullName(x.from))}</b>${who(x.from).bot ? '<em class="dc-bot">App</em>' : ''}<time>${x.day && x.day !== 'Today' ? x.day + ', ' : ''}${x.at}</time></div>` : ''}
          ${x.t ? `<div class="dc-mt">${fmt(x.t)}</div>` : ''}
          ${x.code ? `<pre class="dc-code">${esc(x.code)}</pre>` : ''}
          ${x.img ? `<button class="dc-img" type="button" data-dc-todo="Opening the image in Viewer"><img src="${x.img}" alt=""></button>` : ''}
          ${x.embed ? `<button class="dc-embed" type="button" data-dc-todo="Opening the video" style="--eh:${g?.h ?? 250}">${x.embed.img ? `<i class="dc-eimg" style="background-image:url('${x.embed.img}')"><i class="dc-eplay">${ic('play')}</i></i>` : ''}<span class="dc-etx"><small>${esc(x.embed.site)}</small><b>${esc(x.embed.title)}</b><span>${esc(x.embed.text)}</span></span></button>` : ''}
          ${x.file ? `<div class="dc-file"><i>${ic('audio-lines')}</i><span><b>${esc(x.file.n)}</b><small>${x.file.size}</small></span><button class="ib" type="button" data-dc-todo="Saved to Downloads" aria-label="Download">${ic('download')}</button></div>` : ''}
          ${th ? `<button class="dc-thread" type="button" data-dc-panel="threads">${faces(['TH', 'SK', 'NF'], 22)}<span><b>${esc(th.n)}</b><small>${th.count} replies · ${esc(th.last)}</small></span>${ic('chevron-right')}</button>` : ''}
          ${rx}</div>
        ${ph ? '' : `<span class="dc-hov flo"><button type="button" data-dc-react="${x.id}:🔥" aria-label="React with fire">🔥</button><button type="button" data-dc-react="${x.id}:😂" aria-label="React with laughter">😂</button><button class="ib" type="button" data-dc-rxadd="${x.id}" aria-label="Add a reaction">${ic('smile-plus')}</button><button class="ib" type="button" data-dc-reply="${x.id}" aria-label="Reply">${ic('reply')}</button><button class="ib" type="button" data-dc-mmore="${x.id}" aria-label="More">${ic('ellipsis')}</button></span>`}
      </div>`; }).join(''); }
  function chatHTML() { const c = conv(), g = ST.home ? null : guild(), name = ST.home ? (c.group ? c.name : who(c.with).n) : c.n;
    const intro = ST.home ? `<div class="dc-intro">${c.group ? `<span class="dc-gav big">${c.group.map(k => face(k, 52)).join('')}</span>` : face(c.with, 76)}<b>${esc(name)}</b><span>${c.group ? c.group.map(first).join(', ') + ' and you' : '@' + esc(who(c.with).u || '')}</span></div>`
      : `<div class="dc-intro"><i class="dc-introi">${chIcon(c)}</i><b>#${esc(c.n)}</b><span>${esc(c.topic || 'The start of the channel.')}</span></div>`;
    const typing = ST.typing && !ST.home && c.id === 'general' ? `<div class="dc-typing"><span class="dots sm"><i></i><i></i><i></i></span><b>${esc(first(ST.typing))}</b> is typing</div>` : '';
    return `<div class="dc-thr${narrow() ? ' ph' : ''}">${intro}${msgHTML(c, g)}${typing}</div>`; }
  /* Catch up: what you missed, before you go looking */
  function catchupHTML() { const ms = mentionsAll(), live = liveRooms(), un = unreadAll(), ph = narrow();
    const mention = ({ g, c, x }) => `<button class="dc-cm" type="button" data-dc-open="${g.id}:${c.id}:${x.id}" style="--gh:${g.h}"><span class="dc-cmh">${gIcon(g, 20)}<b>${esc(g.n)}</b><span>#${esc(c.n)}</span><time>${x.at}</time></span>
      <span class="dc-cmb">${face(x.from, 34)}<span><b>${esc(fullName(x.from))}</b><span class="dc-cmt">${fmt(x.t || preview(x))}</span></span>${x.img ? `<i class="dc-cmi" style="background-image:url('${x.img}')"></i>` : ''}</span></button>`;
    const liveCard = ({ g, c, people }) => `<div class="dc-lc" style="--gh:${g.h}">${g.img ? `<i class="dc-lci" style="background-image:url('${g.img}');background-position:${g.pos || '50% 50%'}"></i>` : '<i class="dc-lci"></i>'}
      <span class="dc-lch">${people.includes('NF') ? '<em class="dc-live">Live</em>' : ''}<b>${esc(c.n)}</b><small>${esc(g.n)}</small></span>
      <span class="dc-lcf">${faces(people, 36, true)}<span class="dc-lcs">${people.includes('NF') ? 'Nora is streaming' : people.length + ' talking'}</span></span><button class="bt pri dc-join" type="button" data-dc-join="${g.id}:${c.id}">${ST.voice?.ch === c.id ? 'Open' : 'Join'}</button></div>`;
    return `<div class="dc-cu${ph ? ' ph' : ''}">
      <div class="dc-cuhead"><b>Catch up</b><span>${ms.length ? `${ms.length} mention${ms.length === 1 ? '' : 's'}` : 'Nobody mentioned you'}${live.length ? ` · ${live.length === 1 ? 'one room live' : live.length + ' rooms live'}` : ''}${un.length ? ` · ${un.length} unread` : ''}</span></div>
      ${live.length ? `<div class="dc-cush">Live now</div><div class="dc-lcrow">${live.map(liveCard).join('')}</div>` : ''}
      ${ms.length ? `<div class="dc-cush">Mentions<button type="button" class="dc-cux" data-dc-readall>Mark all read</button></div><div class="dc-cms">${ms.map(mention).join('')}</div>` : ''}
      ${un.length ? `<div class="dc-cush">Unread</div><div class="dc-uns">${un.map(({ g, c }) => `<button class="dc-un" type="button" data-dc-open="${g.id}:${c.id}">${gIcon(g, 30)}<span><b>#${esc(c.n)}</b><small>${esc(g.n)}</small></span>${K.lCount(c.unread, !!c.mentions)}</button>`).join('')}</div>` : ''}
      ${!ms.length && !un.length && !live.length ? '<div class="dc-none big">You’re all caught up.</div>' : ''}</div>`; }
  function roomHTML() { const v = ST.voice, g = guild(v.g), c = channel(g, v.ch), people = roomPeople(g, c), stream = people.includes('NF') || ST.share, ph = narrow(), sz = stream ? (ph ? 56 : 76) : (ph ? 76 : 108);
    const person = k => `<button class="dc-rp${talking(k) ? ' talk' : ''}" type="button" data-dc-who="${k}" style="--th:${who(k).h}" data-dc-todo="${k === 'me' ? 'That’s you' : 'Opening ' + esc(who(k).n)}"><span class="dc-rpf">${k === 'me' && ST.cam ? `<i class="av round dc-cam" style="width:${sz}px;height:${sz}px;background-image:url('${PHOTO}life-professionals-loft.webp')"></i>` : face(k, sz)}${(k === 'PR' || (k === 'me' && ST.mute)) ? `<i class="dc-rpm">${ic('mic-off')}</i>` : ''}</span><b>${k === 'me' ? 'You' : esc(first(k))}</b></button>`;
    return `<div class="dc-roomv${ph ? ' ph' : ''}" style="--vh:${g.h}">${g.img ? `<i class="dc-rbg" style="background-image:url('${g.img}')"></i>` : '<i class="dc-rbg"></i>'}
      ${stream ? `<div class="dc-screen">${ST.share ? `<i class="dc-scr mine">${ic('monitor-up')}<span>You’re sharing your screen</span></i>` : `<i class="dc-scr" style="background-image:url('${g.img}')"></i>`}<span class="dc-scap"><em class="dc-live">Live</em>${ST.share ? 'Your screen' : 'Nora’s screen'}</span></div>` : ''}
      <div class="dc-rps${stream ? ' under' : ''}">${people.map(person).join('')}</div></div>`; }
  function phList() { return `<div class="dc-phlist">${rail()}<div class="dc-col">${placeHTML()}</div></div>`; }
  function body(keep) { const b = q$('#dc-body'); if (!b) return; const atEnd = b.scrollHeight - b.scrollTop - b.clientHeight < 80, top = b.scrollTop;
    W.classList.toggle('dc-roomon', !!(ST.voiceView && ST.voice)); W.classList.toggle('dc-cuon', catchup() && !(narrow() && ST.ph === 'list'));
    if (narrow() && ST.ph === 'list') { b.innerHTML = phList(); b.scrollTop = keep ? top : 0; return; }
    if (ST.voiceView && ST.voice) { b.innerHTML = roomHTML(); b.scrollTop = 0; return; }
    if (catchup()) { b.innerHTML = catchupHTML(); b.scrollTop = keep ? top : 0; return; }
    b.innerHTML = chatHTML();
    if (!keep || atEnd) b.scrollTop = b.scrollHeight; else b.scrollTop = top;
    conv().msgs?.forEach(x => delete x.fresh); }

  /* ── the header: one row that belongs to what you're in (desktop); the title island (phone) ── */
  function head() { const el = q$('#dc-head'); if (!el) return; if (narrow() && ST.ph === 'list') { el.innerHTML = ''; return; }
    const tile = (inner, h) => `<i class="dc-htile"${h != null ? ` style="--th:${h}"` : ''}>${inner}</i>`;
    let lead, title, sub, acts;
    if (ST.voiceView && ST.voice) { const vg = guild(ST.voice.g), vc = channel(vg, ST.voice.ch), n = roomPeople(vg, vc).length;
      lead = tile(ic('volume-2'), vg.h); title = vc.n; sub = `${vg.n} · ${n} in the room`;
      acts = `<button class="ib" type="button" data-dc-chat aria-label="Text chat" title="Text chat">${ic('message-square')}</button><button class="ib" type="button" data-dc-todo="Invite link copied" aria-label="Invite" title="Invite">${ic('user-plus')}</button>`; }
    else if (catchup()) { lead = tile(ic('sparkles'), 275); title = 'Catch up'; sub = 'Mentions, live rooms and what’s unread, from every server'; acts = `<button class="ib" type="button" data-dc-readall aria-label="Mark all read" title="Mark all read">${ic('check-check')}</button>`; }
    else if (ST.home) { const c = dm(); lead = c.group ? `<span class="dc-gav">${face(c.group[0], 24)}${face(c.group[1], 24)}</span>` : face(c.with, 36, true); title = c.group ? c.name : who(c.with).n;
      sub = c.group ? `${c.group.length + 1} people` : (activity(c.with) || STATUS[presence(c.with)]);
      acts = `<button class="ib" type="button" data-dc-call="voice" aria-label="Call" title="Call">${ic('phone')}</button><button class="ib" type="button" data-dc-call="video" aria-label="Video call" title="Video call">${ic('video')}</button><button class="ib" type="button" data-dc-more aria-label="More" title="More">${ic('ellipsis')}</button>`; }
    else { const g = guild(), c = channel(), here = g.members.filter(k => presence(k) !== 'off');
      lead = tile(chIcon(c), g.h); title = c.n; sub = c.topic || g.n;
      acts = `<button class="dc-who${ST.panelOn ? ' on' : ''}" type="button" data-dc-panel="members" aria-label="Members" title="Members">${faces(here.slice(0, 3), 24)}<span>${here.length} here</span></button><button class="ib${ST.bell[c.id] ? ' lit' : ''}" type="button" data-dc-bell aria-label="${ST.bell[c.id] ? 'Unmute channel' : 'Mute channel'}" title="${ST.bell[c.id] ? 'Muted' : 'Mute channel'}">${ic(ST.bell[c.id] ? 'bell-off' : 'bell')}</button><button class="ib" type="button" data-dc-more aria-label="More" title="More">${ic('ellipsis')}</button>`; }
    if (narrow()) { el.innerHTML = island(lead, title, sub); return; }
    if (catchup()) { el.innerHTML = ''; return; }   /* the page names itself; a header would say it twice */
    el.innerHTML = `<div class="dc-hdr">${lead}<span class="dc-htx"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="dc-hacts">${acts}</span></div>`; }
  /* the phone's title island: ‹ | what you're in. Tap it and it grows into the details and who's here. */
  function island(lead, name, sub) { const c = ST.voiceView || catchup() ? null : conv(), g = ST.home ? null : guild();
    const tile = (attr, icn, label, on) => `<button type="button" class="fvt${on ? ' on' : ''}" ${attr}>${ic(icn)}<span>${label}</span></button>`;
    const people = !c ? [] : ST.home ? (c.group ? [...c.group, 'me'] : [c.with, 'me']) : g.members;
    const grown = ST.isl && c ? `<div class="mislp dc-islp">${ST.home ? '' : `<div class="fsha mislt">${tile('data-dc-panel="threads"', 'messages-square', 'Threads', ST.panel === 'threads')}${tile('data-dc-panel="pins"', 'pin', 'Pins', ST.panel === 'pins')}${tile('data-dc-bell', ST.bell[c.id] ? 'bell-off' : 'bell', ST.bell[c.id] ? 'Muted' : 'Mute', ST.bell[c.id])}${tile('data-dc-panel="members"', 'users', 'Members', ST.panel === 'members')}</div>`}
      ${c.topic ? `<p class="dc-topic">${esc(c.topic)}</p>` : ''}${ST.panel === 'members' || ST.home ? `<div class="fexh">Members<em>${people.length}</em></div><div class="dc-ilist">${memberRows(g, people, true)}</div>` : `<div class="dc-ilist">${ST.panel === 'threads' ? threadsHTML() : pinsHTML()}</div>`}</div>` : '';
    return `<div class="misl dc-isl${ST.isl ? ' open' : ''}"><div class="mislr"><button class="mislb" type="button" data-dc-back aria-label="Back">${ic('chevron-left')}</button><button class="misli" type="button" ${c ? 'data-dc-isl' : ''} aria-expanded="${ST.isl}" aria-label="${esc(name)}"><i class="dc-iic">${lead}</i><span><b>${esc(name)}</b><small>${esc(sub)}</small></span></button>${ST.voice && !ST.voiceView ? `<button class="ib dc-ivoice" type="button" data-dc-voiceview aria-label="Back to the room" title="Back to the room">${ic('audio-lines')}</button>` : ''}</div>${grown}</div>`; }

  /* ── the bar ── */
  function bar() { const el = q$('#dc-bar'); if (!el) return; const ph = narrow();
    el.className = 'fbar dcbar phnofit' + (ph ? ' dc-phbar' : ''); el.hidden = false;
    if (ph && ST.ph === 'list') { el.classList.add('dc-listbar'); const had = document.activeElement?.id === 'dc-pq';
      el.innerHTML = `${voiceCard(true)}<div class="dc-brow"><label class="srch keep">${ic('search')}<input id="dc-pq" placeholder="${ST.home ? 'Find a conversation' : 'Search ' + esc(guild().n)}" value="${esc(ST.q)}" aria-label="Search" autocomplete="off"></label><button class="bt pri dc-sq" type="button" data-dc-new aria-label="New message" title="New message">${ic('square-pen')}</button></div>`;
      wireSearch('dc-pq', had); return; }
    if (ST.voiceView && ST.voice) { el.classList.add('dc-vbar');
      const b = (attr, icn, label, on, cls = '') => `<button class="ib${on ? ' lit' : ''}${cls}" type="button" ${attr} aria-label="${label}" title="${label}">${ic(icn)}</button>`;
      el.innerHTML = `${b('data-dc-mute', ST.mute ? 'mic-off' : 'mic', ST.mute ? 'Unmute' : 'Mute', ST.mute, ST.mute ? ' red' : '')}${b('data-dc-deaf', ST.deaf ? 'headphone-off' : 'headphones', ST.deaf ? 'Undeafen' : 'Deafen', ST.deaf, ST.deaf ? ' red' : '')}${b('data-dc-cam', ST.cam ? 'video' : 'video-off', ST.cam ? 'Turn the camera off' : 'Turn the camera on', ST.cam)}${b('data-dc-share', 'monitor-up', ST.share ? 'Stop sharing' : 'Share your screen', ST.share)}<button class="bt dc-leaveb" type="button" data-dc-leave aria-label="Leave the room">${ic('phone-off')}<span>Leave</span></button>`; return; }
    if (catchup()) { el.hidden = true; el.innerHTML = ''; return; }
    if (ph && ST.sel != null) { const x = conv().msgs.find(y => y.id === ST.sel); if (!x) { ST.sel = null; return bar(); } el.classList.add('dc-selbar');
      el.innerHTML = `<div class="dc-reacts">${D().EMOJI.slice(0, 6).map(e => `<button type="button" data-dc-react="${x.id}:${e}" class="${x.reacts?.[e]?.includes('me') ? 'on' : ''}">${e}</button>`).join('')}</div>
        <div class="fsha dc-tiles2">${[['data-dc-reply="' + x.id + '"', 'reply', 'Reply'], ['data-dc-todo="Copied"', 'copy', 'Copy'], ['data-dc-todo="Thread started"', 'messages-square', 'Thread'], ['data-dc-todo="Pinned to the channel"', 'pin', 'Pin'], ...(x.from === 'me' ? [['data-dc-del="' + x.id + '"', 'trash-2', 'Delete']] : [['data-dc-todo="Marked unread"', 'bell-dot', 'Unread']])].map(([a, i, n]) => `<button type="button" class="fvt${i === 'trash-2' ? ' red' : ''}" ${a}>${ic(i)}<span>${n}</span></button>`).join('')}</div>`; return; }
    const c = conv(), name = ST.home ? (c.group ? c.name : who(c.with).n) : '#' + c.n, ref = ST.reply != null ? c.msgs.find(y => y.id === ST.reply) : null;
    const grow = ST.grow === 'emoji' ? `<div class="dc-grow dc-emo">${D().EMOJI.map(e => `<button type="button" data-dc-pick="${e}">${e}</button>`).join('')}</div>`
      : ST.grow === 'plus' ? `<div class="dc-grow fsha">${[['data-dc-todo="Choose photos or videos"', 'image', 'Photo'], ['data-dc-todo="Choose a file"', 'paperclip', 'File'], ['data-dc-todo="Poll started"', 'list-tree', 'Poll'], ['data-dc-todo="Thread started"', 'messages-square', 'Thread']].map(([a, i, n]) => `<button type="button" class="fvt" ${a}>${ic(i)}<span>${n}</span></button>`).join('')}</div>` : '';
    const ctx = ref ? `<div class="dc-ctx">${face(ref.from, 20)}<span>Replying to <b>${esc(first(ref.from))}</b> · ${esc(preview(ref))}</span><button class="ib" type="button" data-dc-replyx aria-label="Cancel the reply">${ic('x')}</button></div>` : '';
    const input = `<input class="dc-text" id="dc-text" placeholder="Message ${esc(name)}" value="${esc(ST.draft)}" aria-label="Message ${esc(name)}" autocomplete="off">`;
    const send = `<button class="dc-send" type="button" data-dc-send aria-label="Send" title="Send">${ic('arrow-up')}</button>`;
    const plus = `<button class="ib${ST.grow === 'plus' ? ' on' : ''}" type="button" data-dc-plus aria-label="Add" aria-expanded="${ST.grow === 'plus'}" title="Add">${ic(ST.grow === 'plus' ? 'x' : 'plus')}</button>`;
    const emo = `<button class="ib${ST.grow === 'emoji' ? ' on' : ''}" type="button" data-dc-emoji aria-label="Emoji" aria-expanded="${ST.grow === 'emoji'}" title="Emoji">${ic('smile')}</button>`;
    el.classList.toggle('dc-grown', !!(grow || ctx)); el.classList.toggle('dc-has', !!ST.draft.trim());
    el.innerHTML = ph ? `${grow}${ctx}<div class="dc-brow">${input}</div><i class="dc-hair"></i><div class="dc-brow acts">${plus}${emo}<button class="ib" type="button" data-dc-todo="Hold to record a voice message" aria-label="Voice message" title="Voice message">${ic('mic')}</button><span class="sp"></span>${send}</div>`
      : `${grow}${ctx}<div class="dc-brow">${plus}${input}${emo}${send}</div>`;
    const t = q$('#dc-text'); if (t) { t.oninput = () => { ST.draft = t.value; el.classList.toggle('dc-has', !!ST.draft.trim()); }; t.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send2(); } else if (e.key === 'Escape') { ST.reply = null; ST.grow = null; bar(); } }; } }

  /* ── details: Members, Threads, Pins ── */
  function memberRows(g, list, compact) { const groups = [];
    if (g) { const rm = channels(g).find(c => c.voice && roomPeople(g, c).length), inRoom = rm ? roomPeople(g, rm).filter(k => list.includes(k)) : [];
      if (inRoom.length && !compact) groups.push([`In ${rm.n}`, inRoom]);
      const rest = compact ? list : list.filter(k => !inRoom.includes(k));
      g.roles.forEach(([r]) => { const ks = rest.filter(k => presence(k) !== 'off' && ((g.roleOf[k] || 'Members') === r || (r === 'Members' && !g.roles.some(x => x[0] === g.roleOf[k])))); if (ks.length) groups.push([r === 'Members' ? 'Online' : r, ks]); });
      const off = rest.filter(k => presence(k) === 'off'); if (off.length) groups.push(['Offline', off]); } else groups.push(['', list]);
    return groups.map(([r, ks]) => `${r ? `<div class="dc-role${compact ? ' sm' : ''}">${esc(r)} <em>${ks.length}</em></div>` : ''}${ks.map(k => `<button class="dc-mr${presence(k) === 'off' ? ' off' : ''}" type="button" data-dc-todo="${k === 'me' ? 'That’s you' : 'Opening ' + esc(who(k).n)}">${face(k, 32, true)}<span><b${roleColor(g, k) ? ` style="color:${roleColor(g, k)}"` : ''}>${k === 'me' ? 'You' : esc(who(k).n)}${who(k).bot ? '<em class="dc-bot">App</em>' : ''}</b>${activity(k) ? `<small>${esc(activity(k))}</small>` : ''}</span></button>`).join('')}`).join(''); }
  function threadsHTML() { const c = channel(), ts = c.threads || [];
    return ts.length ? ts.map((t, i) => `<button class="dc-tc" type="button" data-dc-todo="Opening ${esc(t.n)}"><b>${esc(t.n)}</b><small>${t.count} replies · ${esc(t.at)}</small><span class="dc-tcl">${faces([['TH', 'SK', 'NF'], ['MZ', 'NF'], ['SK', 'TH']][i % 3], 20)}<span>${esc(t.last)}</span></span></button>`).join('')
      : `<div class="dc-none">No threads in #${esc(c.n)} yet. Start one from any message.</div>`; }
  function pinsHTML() { const c = channel(), g = guild(), ps = (c.msgs || []).filter(x => x.pinned);
    return ps.length ? ps.map(x => `<button class="dc-pc" type="button" data-dc-jump="${x.id}"><span class="dc-pch">${face(x.from, 22)}<b${roleColor(g, x.from) ? ` style="color:${roleColor(g, x.from)}"` : ''}>${esc(fullName(x.from))}</b><time>${x.day || ''}</time></span>${x.t ? `<span class="dc-pct">${fmt(x.t)}</span>` : ''}${x.embed ? `<span class="dc-pce"><i style="background-image:url('${x.embed.img}')"></i><span>${esc(x.embed.title)}</span></span>` : ''}${x.code ? `<pre class="dc-code sm">${esc(x.code.split('\n').slice(0, 2).join('\n'))}</pre>` : ''}</button>`).join('')
      : `<div class="dc-none">Nothing pinned in #${esc(c.n)}.</div>`; }
  function panel() { const el = q$('#dc-mem'); if (!el) return; const show = !narrow() && !ST.home && ST.panelOn && !ST.voiceView;
    el.hidden = !show; W.classList.toggle('dc-memover', show && !wide()); if (!show) return; const g = guild();
    const tab = (k, n) => `<button type="button" class="${ST.panel === k ? 'on' : ''}" data-dc-tab="${k}" aria-pressed="${ST.panel === k}">${n}</button>`;
    el.innerHTML = `<div class="dc-pnh"><div class="dc-tabs" role="group" aria-label="Details">${tab('members', 'Members')}${tab('threads', 'Threads')}${tab('pins', 'Pins')}</div><button class="ib" type="button" data-dc-closep aria-label="Close" title="Close">${ic('x')}</button></div>
      <div class="dc-mems">${ST.panel === 'members' ? memberRows(g, g.members) : ST.panel === 'threads' ? threadsHTML() : pinsHTML()}</div>`; }

  /* ── going places ── */
  function render(keep) { W = document.getElementById('w-discord'); if (!W || !K) return; frame(); const ph = narrow();
    W.classList.toggle('dc-ph', ph); W.classList.toggle('dc-list', ph && ST.ph === 'list');
    const g = ST.voiceView && ST.voice ? guild(ST.voice.g) : ST.home ? null : guild(); W.style.setProperty('--ch', g ? g.h : 275);
    lastShape = shape(); side(); head(); body(keep); bar(); panel(); }
  const shape = () => `${narrow()}|${wide()}`;
  function openChannel(id, gid = ST.g, mid) { ST.g = gid; const g = guild(), c = channels(g).find(x => x.id === id); if (!c) return;
    if (c.voice) { join(g.id, c.id); return; }
    g.last = id; c.unread = 0; c.mentions = 0; Object.assign(ST, { voiceView: false, home: false, dm: null, reply: null, grow: null, sel: null, isl: false, draft: '', ph: 'chat', q: '' }); render();
    if (mid) setTimeout(() => { const m = q$(`[data-dc-mid="${mid}"]`); m?.scrollIntoView({ block: 'center' }); m?.classList.add('flash'); setTimeout(() => m?.classList.remove('flash'), 1400); }, 60); }
  function join(gid, cid) { const was = ST.voice && ST.voice.ch === cid; ST.voice = { g: gid, ch: cid }; Object.assign(ST, { g: gid, home: false, dm: null, voiceView: true, ph: 'chat', isl: false }); render(); speakLoop(); if (!was) toast(`You’re in ${channel(guild(gid), cid).n}`, 'audio-lines'); }
  function leave() { ST.voice = null; ST.voiceView = false; ST.mute = ST.deaf = ST.cam = ST.share = false; clearInterval(speakT); speakT = 0; render(); toast('You left the room', 'phone-off'); }
  function speakLoop() { clearInterval(speakT); const order = ['TH', 'me', 'NF', 'TH', 'PR', 'TH']; let i = 0;
    speakT = setInterval(() => { if (!ST.voice || !W || W.hidden) return; ST.speak = order[i++ % order.length];
      W.querySelectorAll('[data-dc-who]').forEach(e => e.classList.toggle('talk', talking(e.dataset.dcWho))); }, 1300); }
  function send2() { const t = ST.draft.trim(); if (!t) return; const c = conv(), x = { id: D().nextId(), from: 'me', t, at: nowAt(), fresh: true };
    if (ST.reply != null) x.reply = ST.reply; c.msgs.forEach(y => delete y.isNew); c.msgs.push(x); ST.draft = ''; ST.reply = null; ST.grow = null; body(); bar(); q$('#dc-text')?.focus();
    if (!ST.home && c.id === 'general' && ST.g === 'owls') { const [k, say] = D().REPLIES[c.msgs.length % D().REPLIES.length];
      setTimeout(() => { ST.typing = k; body(true); }, 900); setTimeout(() => { ST.typing = null; c.msgs.push({ id: D().nextId(), from: k, t: say, at: nowAt(), fresh: true }); body(true); }, 3200); } }
  function react(id, e) { const x = conv().msgs.find(y => y.id === +id); if (!x) return; x.reacts = x.reacts || {}; const ks = x.reacts[e] = x.reacts[e] || [];
    const i = ks.indexOf('me'); if (i >= 0) ks.splice(i, 1); else ks.push('me'); if (!ks.length) delete x.reacts[e]; if (ST.sel != null) { ST.sel = null; bar(); } body(true); }

  function frame() { const top = q$('#dc-top'); if (top && !top.dataset.dc) { top.dataset.dc = 1; top.innerHTML = `<img src="${K.A}diskord.svg" alt=""><b>Diskord</b>`; W.setAttribute('aria-label', 'Diskord'); }
    if (!RO) { RO = new ResizeObserver(() => { if (shape() !== lastShape) render(true); }); RO.observe(W);
      document.addEventListener('keydown', e => { if (!W || W.hidden || (K.front?.() !== W && !W.classList.contains('phone'))) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); (q$('#dc-q') || q$('#dc-pq'))?.focus(); }
        else if (e.key === 'Escape' && !e.target.closest('input')) { if (ST.isl) { ST.isl = false; head(); } else if (ST.sel != null) { ST.sel = null; body(true); bar(); } } }); } }

  function click(e) { const t = e.target, h = s => t.closest(s); if (!W || !h('#w-discord')) return false;
    if (h('#lmenu .crmi')) setTimeout(() => document.getElementById('lmenu')?.remove());
    let x;
    if ((x = h('[data-dc-g]'))) { const g = guild(x.dataset.dcG); Object.assign(ST, { home: false, dm: null, g: g.id, q: '', isl: false, voiceView: false }); if (!narrow()) openChannel(g.last); else { ST.ph = 'list'; render(); } return true; }
    if (h('[data-dc-home]')) { Object.assign(ST, { home: true, dm: null, q: '', voiceView: false, ph: narrow() ? 'list' : 'chat' }); render(); return true; }
    if (h('[data-dc-catchup]')) { Object.assign(ST, { home: true, dm: null, voiceView: false, ph: 'chat' }); render(); return true; }
    if ((x = h('[data-dc-open]'))) { const [gid, cid, mid] = x.dataset.dcOpen.split(':'); openChannel(cid, gid, mid); return true; }
    if ((x = h('[data-dc-join]'))) { const [gid, cid] = x.dataset.dcJoin.split(':'); join(gid, cid); return true; }
    if ((x = h('[data-dc-ch]'))) { openChannel(x.dataset.dcCh); return true; }
    if ((x = h('[data-dc-dm]'))) { Object.assign(ST, { home: true, dm: x.dataset.dcDm, voiceView: false, ph: 'chat', reply: null, draft: '', isl: false }); dm().unread = 0; render(); return true; }
    if (h('[data-dc-back]')) { Object.assign(ST, { isl: false, sel: null, ph: 'list', voiceView: false }); if (ST.home) ST.dm = null; render(); return true; }
    if (h('[data-dc-isl]')) { ST.isl = !ST.isl; head(); return true; }
    if ((x = h('[data-dc-panel]'))) { document.getElementById('lmenu')?.remove(); const k = x.dataset.dcPanel; if (narrow()) { ST.panel = k; ST.isl = true; head(); return true; }
      if (ST.panelOn && ST.panel === k && x.matches('.dc-who')) ST.panelOn = false; else { ST.panel = k; ST.panelOn = true; } head(); panel(); return true; }
    if ((x = h('[data-dc-tab]'))) { ST.panel = x.dataset.dcTab; panel(); return true; }
    if (h('[data-dc-closep]')) { ST.panelOn = false; head(); panel(); return true; }
    if (h('[data-dc-voiceview]')) { if (!ST.voice) return true; Object.assign(ST, { voiceView: true, ph: 'chat', isl: false, g: ST.voice.g, home: false, dm: null }); render(); return true; }
    if (h('[data-dc-chat]')) { ST.voiceView = false; if (ST.voice) { ST.home = false; ST.g = ST.voice.g; } render(); return true; }
    if (h('[data-dc-mute]')) { ST.mute = !ST.mute; if (!ST.mute) ST.deaf = false; render(true); return true; }
    if (h('[data-dc-deaf]')) { ST.deaf = !ST.deaf; ST.mute = ST.deaf || ST.mute; render(true); return true; }
    if (h('[data-dc-cam]')) { ST.cam = !ST.cam; body(); bar(); return true; }
    if (h('[data-dc-share]')) { ST.share = !ST.share; body(); bar(); return true; }
    if (h('[data-dc-leave]')) { leave(); return true; }
    if (h('[data-dc-send]')) { send2(); return true; }
    if ((x = h('[data-dc-react]'))) { e.stopPropagation(); const [id, em] = x.dataset.dcReact.split(':'); react(id, em); document.getElementById('lmenu')?.remove(); return true; }
    if ((x = h('[data-dc-rxadd]'))) { if (narrow()) { ST.sel = +x.dataset.dcRxadd; body(true); bar(); return true; }
      K.lMenu(x, `<div class="dc-pop">${D().EMOJI.map(em => `<button type="button" data-dc-react="${x.dataset.dcRxadd}:${em}">${em}</button>`).join('')}</div>`); return true; }
    if ((x = h('[data-dc-reply]'))) { ST.reply = +x.dataset.dcReply; ST.sel = null; ST.grow = null; W.querySelectorAll('.dc-m.sel').forEach(m => m.classList.remove('sel')); bar(); setTimeout(() => q$('#dc-text')?.focus(), 30); return true; }
    if (h('[data-dc-replyx]')) { ST.reply = null; bar(); return true; }
    if ((x = h('[data-dc-del]'))) { const c = conv(); c.msgs = c.msgs.filter(y => y.id !== +x.dataset.dcDel); ST.sel = null; body(true); bar(); toast('Message deleted', 'trash-2'); return true; }
    if (h('[data-dc-plus]')) { ST.grow = ST.grow === 'plus' ? null : 'plus'; bar(); return true; }
    if (h('[data-dc-emoji]')) { ST.grow = ST.grow === 'emoji' ? null : 'emoji'; bar(); return true; }
    if ((x = h('[data-dc-pick]'))) { ST.draft += x.dataset.dcPick; ST.grow = null; bar(); const i = q$('#dc-text'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); return true; }
    if (h('[data-dc-bell]')) { const c = channel(); ST.bell[c.id] = !ST.bell[c.id]; head(); side(); toast(ST.bell[c.id] ? `#${c.n} muted` : `#${c.n} unmuted`, ST.bell[c.id] ? 'bell-off' : 'bell'); return true; }
    if (h('[data-dc-readall]')) { D().GUILDS.forEach(g => { channels(g).forEach(c => { c.unread = 0; c.mentions = 0; (c.msgs || []).forEach(m => { m.mention = false; }); }); g.unreadDot = false; }); render(true); toast('All caught up'); return true; }
    if ((x = h('[data-dc-gmenu]'))) { const g = guild();
      K.lMenu(x, `${K.crMi('data-dc-todo="Invite link copied"', 'user-plus', 'Invite people')}${K.crMi(`data-dc-read="${g.id}"`, 'check-check', 'Mark as read')}${K.crMi('data-dc-todo="Notification settings"', 'bell', 'Notifications')}<span class="crsep"></span>${K.crMi('data-dc-todo="Server settings"', 'settings', 'Server settings')}${K.crMi(`data-dc-todo="You can leave ${esc(g.n)} from its settings"`, 'log-out', 'Leave server', ' red')}`); return true; }
    if ((x = h('[data-dc-read]'))) { channels(guild(x.dataset.dcRead)).forEach(c => { c.unread = 0; c.mentions = 0; }); guild(x.dataset.dcRead).unreadDot = false; side(); toast('Marked as read'); return true; }
    if ((x = h('[data-dc-more]'))) { const c = conv();
      K.lMenu(x, `${ST.home ? '' : K.crMi('data-dc-panel="threads"', 'messages-square', 'Threads') + K.crMi('data-dc-panel="pins"', 'pin', 'Pinned messages')}${K.crMi('data-dc-todo="Search in this conversation"', 'search', 'Search')}${K.crMi('data-dc-todo="Link copied"', 'link', 'Copy link')}${ST.home ? '' : K.crMi(`data-dc-todo="Marked #${esc(c.n)} as read"`, 'check-check', 'Mark as read')}`); return true; }
    if ((x = h('[data-dc-mmore]'))) { const id = +x.dataset.dcMmore, mine = conv().msgs.find(y => y.id === id)?.from === 'me';
      K.lMenu(x, `${K.crMi(`data-dc-reply="${id}"`, 'reply', 'Reply')}${K.crMi('data-dc-todo="Thread started"', 'messages-square', 'Start a thread')}${K.crMi('data-dc-todo="Copied"', 'copy', 'Copy text')}${K.crMi('data-dc-todo="Pinned to the channel"', 'pin', 'Pin')}${K.crMi('data-dc-todo="Marked unread"', 'bell-dot', 'Mark unread')}${mine ? '<span class="crsep"></span>' + K.crMi(`data-dc-del="${id}"`, 'trash-2', 'Delete', ' red') : ''}`); return true; }
    if ((x = h('[data-dc-call]'))) { toast(x.dataset.dcCall === 'video' ? 'Video calling…' : 'Calling…', x.dataset.dcCall === 'video' ? 'video' : 'phone'); return true; }
    if (h('[data-dc-new]')) { Object.assign(ST, { home: true, dm: null, ph: 'list', q: '', voiceView: false }); render(); setTimeout(() => (q$('#dc-q') || q$('#dc-pq'))?.focus(), 30); return true; }
    if ((x = h('[data-dc-jump]'))) { const m = q$(`[data-dc-mid="${x.dataset.dcJump}"]`); m?.scrollIntoView({ block: 'center', behavior: 'smooth' }); m?.classList.add('flash'); setTimeout(() => m?.classList.remove('flash'), 1200); return true; }
    if ((x = h('[data-dc-todo]'))) { document.getElementById('lmenu')?.remove(); toast(x.dataset.dcTodo, 'check'); return true; }
    /* a phone: tap a message to act on it (react, reply, copy); tap elsewhere to let go */
    if (narrow() && (x = h('.dc-m')) && !h('button, a, input')) { const id = +x.dataset.dcMid; ST.sel = ST.sel === id ? null : id; ST.grow = null; W.querySelectorAll('.dc-m.sel').forEach(m => m.classList.remove('sel')); if (ST.sel != null) x.classList.add('sel'); bar(); return true; }
    if (ST.isl && !h('.dc-isl')) { ST.isl = false; head(); }
    if (ST.sel != null && !h('#dc-bar')) { ST.sel = null; W.querySelectorAll('.dc-m.sel').forEach(m => m.classList.remove('sel')); bar(); }
    return false; }

  window.LumaDiscord = { render(k) { if (k) K = k; render(); }, click, state: ST };
})();
