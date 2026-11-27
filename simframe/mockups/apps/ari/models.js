/* ══ Ari's models, third pass (29 Oct 2026) ═══════════════════════════════════════════════════════════════════════
   A small model store inside Ari, written for someone who has never heard of a model.

   · Yours: what Ari uses (one model for everything; a different one for a task only if you ask), signing in with
     ChatGPT (the way we expect most people to go), the other services, and the models on this computer.
   · Get models: families, each with one plain line on how it runs here. Too-big ones stay out of the way.
   · A model's page: its sizes, one sentence on whether this computer can run the one you picked, what the maker
     says it can do, and the facts (licence, release, how much it reads at once). No guesses, no speeds.
   · The bar holds the one thing to do: Download or Remove. Remove grows it in place (SunoUI).

   Facts come from each maker's model card and the download sizes from Ollama's library (October 2026).
   Only with ?ari=b. ?arv=models|store and ?arx=family:size open a page directly. */
(() => {
  'use strict';
  const QS = new URLSearchParams(location.search);
  if (QS.get('ari') !== 'b') return;
  let K = null, W = null;
  const ST = { view: 'yours', fam: null, size: null, job: 'all', q: '', grown: null, picks: null, dls: [], def: 'qwen8', over: { code: 'qwen30' }, custom: false, signing: false, big: false, was: null };

  /* tasks someone might want a different model for; everything else uses the default */
  const JOBS = [
    ['code', 'Code', 'code', 'Writing and fixing code'],
    ['pictures', 'Pictures', 'image', 'Screenshots, photos and scans'],
    ['hard', 'Hard problems', 'lightbulb', 'Thinks it through before answering'],
    ['long', 'Long documents', 'file-text', 'Whole reports at once'],
  ];
  /* what a maker says a model can do */
  const CAN = { chat: ['message-circle', 'Chat and writing', 'Questions, emails, summaries'], code: ['code', 'Code', 'Reads and writes code'], pictures: ['image', 'Reads pictures', 'Screenshots, photos and scans'], think: ['lightbulb', 'Thinking mode', 'Works a problem through before answering'] };
  const FAM = [
    { id: 'qwen3', n: 'Qwen3', by: 'Qwen', line: 'An all-rounder for chat, writing and code', can: ['chat', 'code', 'think'], ctx: 32, lic: 'Apache 2.0', licl: 'Free to use, including for work', langs: '119 languages and dialects', rel: 'April 2025', sizes: ['qwen4', 'qwen8', 'qwen14', 'qwen30'] },
    { id: 'gemma3', n: 'Gemma 3', by: 'Google', line: 'Clear writing, and it can read pictures', can: ['chat', 'pictures'], ctx: 128, lic: 'Gemma Terms of Use', licl: 'Free to use, under Google’s use policy', langs: 'Over 140 languages', rel: 'March 2025', sizes: ['gemma4', 'gemma12', 'gemma27'] },
    { id: 'r1', n: 'DeepSeek R1', by: 'DeepSeek', line: 'Works hard problems through before it answers', can: ['think'], ctx: 128, lic: 'MIT', licl: 'Free to use, including for work', rel: 'January 2025, updated May 2025', sizes: ['r1-8', 'r1', 'r1-32'] },
    { id: 'coder', n: 'Qwen3 Coder', by: 'Qwen', line: 'Made for code. Reads a whole project, then writes and fixes', can: ['code'], ctx: 256, lic: 'Apache 2.0', licl: 'Free to use, including for work', rel: 'July 2025', sizes: ['coder30'] },
    { id: 'qvl', n: 'Qwen2.5 VL', by: 'Qwen', line: 'Reads screenshots, photos, receipts and scans', can: ['pictures', 'chat'], ctx: 125, lic: 'Apache 2.0', licl: 'Free to use, including for work', rel: 'January 2025', sizes: ['qvl7'] },
    { id: 'mistral', n: 'Mistral Small 3.2', by: 'Mistral', line: 'Careful, clear writing, and it can read pictures', can: ['chat', 'code', 'pictures'], ctx: 128, lic: 'Apache 2.0', licl: 'Free to use, including for work', rel: 'June 2025', sizes: ['mistral24'] },
    { id: 'phi', n: 'Phi-4 mini', by: 'Microsoft', line: 'Small and quick. Good for older computers', can: ['chat'], ctx: 128, lic: 'MIT', licl: 'Free to use, including for work', rel: 'February 2025', sizes: ['phi4'] },
    { id: 'llama', n: 'Llama 3.3', by: 'Meta', line: 'A large model for computers with a lot of memory', can: ['chat', 'code'], ctx: 128, lic: 'Llama 3.3 Community License', licl: 'Free to use, under Meta’s conditions', langs: '8 languages', rel: 'December 2024', sizes: ['llama70'] },
  ];
  /* sizes: p is the size people see; sz the download (GB); mem roughly what it needs in memory to run */
  const SIZES = {
    qwen4: { n: 'Qwen3 4B', by: 'Qwen', p: '4B', sz: 2.5, mem: 3.5 }, qwen8: { n: 'Qwen3 8B', by: 'Qwen', p: '8B', sz: 5.2, mem: 6.5 }, qwen14: { n: 'Qwen3 14B', by: 'Qwen', p: '14B', sz: 9.3, mem: 11 }, qwen30: { n: 'Qwen3 30B', by: 'Qwen', p: '30B', sz: 19, mem: 21 },
    gemma4: { n: 'Gemma 3 4B', by: 'Google', p: '4B', sz: 3.3, mem: 4.5 }, gemma12: { n: 'Gemma 3 12B', by: 'Google', p: '12B', sz: 8.1, mem: 10 }, gemma27: { n: 'Gemma 3 27B', by: 'Google', p: '27B', sz: 17, mem: 19 },
    'r1-8': { n: 'DeepSeek R1 8B', by: 'DeepSeek', p: '8B', sz: 5.2, mem: 6.5 }, r1: { n: 'DeepSeek R1 14B', by: 'DeepSeek', p: '14B', sz: 9, mem: 11 }, 'r1-32': { n: 'DeepSeek R1 32B', by: 'DeepSeek', p: '32B', sz: 20, mem: 22 },
    coder30: { n: 'Qwen3 Coder 30B', by: 'Qwen', p: '30B', sz: 19, mem: 21 }, qvl7: { n: 'Qwen2.5 VL 7B', by: 'Qwen', p: '7B', sz: 6, mem: 8 },
    mistral24: { n: 'Mistral Small 3.2', by: 'Mistral', p: '24B', sz: 15, mem: 17 }, phi4: { n: 'Phi-4 mini', by: 'Microsoft', p: '3.8B', sz: 2.5, mem: 3.5 }, llama70: { n: 'Llama 3.3 70B', by: 'Meta', p: '70B', sz: 43, mem: 46 },
  };
  /* other services, beside ChatGPT */
  const SVC = [['openrouter', 'OpenRouter', 'Hundreds of models with one key'], ['anthropic', 'Anthropic', 'Claude, with an API key'], ['google', 'Google', 'Gemini, with an API key'], ['own', 'Your own server', 'Ollama, LM Studio or anything like them']];

  /* ── small parts ── */
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => K.ic(n) || ((v = (window.__iconBundle || {})[n]) => v ? v.replace(/<!--[\s\S]*?-->/g, '').replace(/stroke-width="[\d.]+"/, 'stroke-width="1.6"').replace(/ width="24"/, '').replace(/ height="24"/, '').replace('<svg', '<svg class="i" aria-hidden="true"') : '')();   // icons Ari doesn't preload
  const L = () => K.ARLM, PC = () => K.ARPC, mod = id => L().find(m => m.id === id), famOf = id => FAM.find(f => f.sizes.includes(id));
  const gb = n => K.arGB(n), fit = m => K.arFit(m)[0], mono = (m, sz) => K.arMono(m, sz);
  const local = () => L().filter(m => m.have), dl = id => ST.dls.find(d => d.id === id);
  const pc = () => PC().n.replace('This ', 'this ');
  const pages = k => `About ${k >= 250 ? 400 : k >= 100 ? 200 : 50} pages`;
  const svc = id => K.ARCL.find(s => s.id === id), gpt = () => svc('openai');
  const cloudModels = () => K.ARCL.filter(s => s.on).flatMap(s => s.models.map(([id, n]) => ({ id, n, via: s.n, pid: s.id })));
  /* a model Ari can use right now, wherever it runs */
  const who = id => { if (!id) return null; const m = mod(id); if (m && m.have) return { id, n: m.n, local: true, m };
    const c = cloudModels().find(x => x.id === id); return c ? { id, n: c.pid === 'openai' ? 'ChatGPT' : c.n, sub: c.pid === 'openai' ? c.n : c.via, local: false, m: c } : null; };
  const where = w => w.local ? 'On this computer' : `${w.sub ? esc(w.sub) + ', ' : ''}in the cloud`;
  const uses = k => ST.over[k] || ST.def;
  const usedFor = id => [ST.def === id ? 'everything' : '', ...JOBS.filter(([k]) => ST.over[k] === id).map(j => j[1].toLowerCase())].filter(Boolean);
  const jobFits = (m, k) => { const f = famOf(m.id); if (!f) return false; return k === 'code' ? f.can.includes('code') : k === 'pictures' ? f.can.includes('pictures') : k === 'hard' ? f.can.includes('think') : k === 'long' ? f.ctx >= 128 : f.can.includes('chat'); };
  const fitWord = { good: 'Runs well here', ok: 'Runs here, but slowly', no: 'Too big for this computer' };
  const famFit = f => { const fs = f.sizes.map(id => fit(mod(id))); return fs.includes('good') ? 'good' : fs.includes('ok') ? 'ok' : 'no'; };
  const narrow = () => K.narrow();
  const diskUsed = () => local().reduce((s, m) => s + m.sz, 0);

  /* ── the page ── */
  function render() { const b = document.getElementById('ari-body'); W = document.getElementById('w-ari'); if (!b || !W) return;
    if (!W._arxro) { W._arxro = new ResizeObserver(() => { const n = narrow(); if (n !== ST.nw && K.AR.view === 'models') { ST.nw = n; render(); bar(); } }); W._arxro.observe(W); }   /* the window opens small, then grows */
    ST.nw = narrow(); W.classList.add('arxwin'); W.classList.toggle('arxph', ST.nw); W.classList.toggle('arxmid', !narrow() && b.clientWidth < 800);
    let c = document.getElementById('arx-corner'); if (!c) { document.getElementById('ari-main').insertAdjacentHTML('beforeend', '<div class="arx-corner" id="arx-corner" data-phmv="1"></div>'); c = document.getElementById('arx-corner'); }
    c.innerHTML = ST.fam ? '' : views(); c.hidden = !!ST.fam;
    b.innerHTML = `<div class="arx">${ST.fam ? back() : ''}${ST.fam ? famPage() : ST.view === 'store' ? store() : yours()}</div>`; requestAnimationFrame(() => K.segs?.()); }
  const back = () => `<button class="arx-back" type="button" data-arx-back>${ic('chevron-left')}<span>${ST.view === 'store' ? 'Get models' : 'Models'}</span></button>`;
  const views = () => `<div class="arx-views seg" role="tablist"><i class="ind"></i>${[['yours', 'Yours'], ['store', 'Get models']].map(([k, n]) => `<button type="button" role="tab" class="${ST.view === k ? 'on' : ''}" data-arx-view="${k}">${n}</button>`).join('')}</div>`;

  function yours() { const d = who(ST.def);
    return `<header class="arx-hd"><h1>Models</h1><p>${d ? `Ari runs on ${esc(d.n)}${d.local ? ', on this computer' : ''}.` : 'Pick what Ari runs on.'}</p></header>
      <section class="arx-sec"><h2>Ari uses</h2><div class="arx-card">${useRows()}</div></section>
      ${cloud()}
      <section class="arx-sec"><h2>On this computer<small>${local().length} ${local().length === 1 ? 'model' : 'models'} · ${gb(diskUsed())}</small></h2><div class="arx-card">${ST.dls.filter(x => !x.upd).map(dlRow).join('')}${local().map(locRow).join('')}${updRow()}</div>
        <button class="arx-more" type="button" data-arx-view="store">${ic('download')}<span><b>Get more models</b><small>Free, and they run without the internet</small></span>${ic('chevron-right')}</button></section>`; }

  /* what Ari uses: one for everything, then any task that uses something else */
  function useRows() { const d = who(ST.def), set = JOBS.filter(([k]) => ST.over[k]), rest = JOBS.filter(([k]) => !ST.over[k]);
    const main = `<div class="arx-row arx-use">${d ? mono(d.m, 44) : `<i class="arx-jic">${ic('sparkles')}</i>`}<span class="arx-rt"><b>${d ? esc(d.n) : 'Nothing yet'}</b><small>For everything${d ? ` · ${where(d)}` : ''}</small></span><button class="arx-well sm" type="button" data-arx-role="def">Change</button></div>`;
    const job = ([k, n, i]) => { const w = who(ST.over[k]);
      return `<div class="arx-row arx-job"><i class="arx-jic">${ic(i)}</i><span class="arx-rt"><b>${n}</b><small>${w ? `${esc(w.n)} · ${where(w)}` : 'Same as everything'}</small></span>${w ? `<button class="ib" type="button" data-arx-unset="${k}" aria-label="Use the same as everything" title="Use the same as everything">${ic('x')}</button>` : ''}<button class="arx-well sm" type="button" data-arx-role="${k}">${w ? 'Change' : 'Choose'}</button></div>`; };
    return main + set.map(job).join('') + (ST.custom ? rest.map(job).join('') : '')
      + (rest.length ? `<button class="arx-row arx-cust" type="button" data-arx-custom>${ic(ST.custom ? 'chevron-up' : 'sliders-horizontal')}<span>${ST.custom ? 'Done' : 'Use a different model for a task'}</span></button>` : ''); }

  /* the cloud: ChatGPT first, then everything else Ari can connect to */
  function cloud() { const g = gpt(), on = g && g.on;
    const promo = on ? '' : `<article class="arx-gpt">${K.arLogo('openai', 56)}<span><b>Use your ChatGPT account</b><small>Sign in and Ari can use the models in your ChatGPT plan. No API key.</small></span>
        <button class="arx-key${ST.signing ? ' busy' : ''}" type="button" data-arx-gpt${ST.signing ? ' disabled' : ''}>${ST.signing ? '<i class="arispin"></i>Waiting for ChatGPT…' : 'Sign in with ChatGPT'}</button></article>`;
    const row = (id, n, line) => { const s = svc(id), c = s && s.on;
      return `<div class="arx-row">${K.arLogo(id, 40)}<span class="arx-rt"><b>${n}</b><small>${c ? (id === 'openai' ? 'Signed in · your ChatGPT plan' : `Connected · ${esc(s.models.map(x => x[1]).join(', '))}`) : line}</small></span>
        ${c ? `<span class="arx-state ok">${ic('check')}Connected</span><button class="ib" type="button" data-arx-svc="${id}" aria-label="${n} options" title="Options">${ic('ellipsis')}</button>` : `<button class="arx-well sm" type="button" data-arikey="${id}" data-arx-direct>Connect</button>`}</div>`; };
    return `<section class="arx-sec"><h2>Cloud<small>Ari asks before it sends anything</small></h2>${promo}<div class="arx-card">${on ? row('openai', 'ChatGPT', '') : ''}${SVC.map(([id, n, line]) => row(id, n, line)).join('')}</div></section>`; }

  function locRow(m) { const u = usedFor(m.id), d = dl(m.id);
    return `<div class="arx-row loc" data-arx-open="${famOf(m.id)?.id || ''}:${m.id}" role="button" tabindex="0">${mono(m, 40)}<span class="arx-rt"><b>${esc(m.n)}</b>${d ? `<span class="arx-prog"><i style="width:${d.pct}%"></i></span><small>Updating · ${Math.round(d.pct)}%</small>` : `<small>${u.length ? `Used for ${esc(u.join(', '))}` : 'Not in use'}</small>`}</span>
      <span class="arx-size">${gb(m.sz)}</span><button class="ib" type="button" data-arx-more="${m.id}" aria-label="${esc(m.n)} options" title="Options">${ic('ellipsis')}</button></div>`; }
  function dlRow(d) { const m = mod(d.id);
    return `<div class="arx-row arx-dlr">${mono(m, 40)}<span class="arx-rt"><b>${esc(m.n)}</b><span class="arx-prog${d.paused ? ' paused' : ''}"><i style="width:${d.pct}%"></i></span><small>${d.paused ? 'Paused' : d.pct >= 100 ? 'Checking it…' : 'Downloading'} · ${gb(m.sz * d.pct / 100)} of ${gb(m.sz)}</small></span>
      <button class="ib" type="button" data-arx-pause="${d.id}" aria-label="${d.paused ? 'Resume' : 'Pause'}" title="${d.paused ? 'Resume' : 'Pause'}">${ic(d.paused ? 'play' : 'pause')}</button><button class="ib" type="button" data-arx-cancel="${d.id}" aria-label="Cancel" title="Cancel">${ic('x')}</button></div>`; }
  /* updates: one quiet line, not a button on every row */
  function updRow() { const ups = local().filter(m => m.upd && !dl(m.id)); if (!ups.length) return '';
    return `<div class="arx-row arx-upd"><i class="arx-jic">${ic('refresh-cw')}</i><span class="arx-rt"><b>${ups.length === 1 ? `A new version of ${esc(ups[0].n)}` : `New versions of ${ups.length} models`}</b><small>${gb(ups.reduce((s, m) => s + m.upd, 0))} to download</small></span><button class="arx-well sm" type="button" data-arx-updall>Update</button></div>`; }

  /* Get models */
  function store() { const q = ST.q.trim().toLowerCase(), j = ST.job;
    const match = f => (j === 'all' || (j === 'hard' ? f.can.includes('think') : f.can.includes(j))) && (!q || (f.n + ' ' + f.by + ' ' + f.line).toLowerCase().includes(q));
    const fams = FAM.filter(match), runs = fams.filter(f => famFit(f) !== 'no'), big = fams.filter(f => famFit(f) === 'no');
    const rm = mod('qwen14'), rec = j === 'all' && !q && !rm.have && !dl('qwen14');
    return `<header class="arx-hd"><h1>Get models</h1><p>Free models that run on ${esc(pc())}. Nothing you say to them leaves it.</p></header>
      <div class="arx-chips">${[['all', 'All', 'layout-grid'], ['code', 'Code', 'code'], ['pictures', 'Pictures', 'image'], ['hard', 'Hard problems', 'lightbulb']].map(([k, n, i]) => `<button type="button" class="${j === k ? 'on' : ''}" data-arx-job="${k}">${ic(i)}${n}</button>`).join('')}</div>
      ${rec ? `<article class="arx-rec" data-arx-open="qwen3:qwen14" role="button" tabindex="0">${mono(rm, 64)}<span><small>Best for ${esc(pc())}</small><h2>${esc(rm.n)}</h2><p>The largest Qwen3 that runs well with ${PC().mem} GB of memory. A step up from the 8B you have.</p></span><button class="arx-key" type="button" data-arx-get="qwen14">${ic('download')}Download · ${gb(rm.sz)}</button></article>` : ''}
      <div class="arx-fams">${(ST.big ? fams : runs).map(famCard).join('') || '<p class="arx-none">No models match.</p>'}</div>
      ${big.length && !ST.big ? `<button class="arx-link" type="button" data-arx-big>Show ${big.length === 1 ? 'one model' : `${big.length} models`} too big for this computer</button>` : ''}`; }
  function famCard(f) { const ft = famFit(f), have = f.sizes.map(mod).find(m => m.have), d = f.sizes.map(dl).find(Boolean), open = (have || f.sizes.map(mod).filter(m => fit(m) === 'good').pop() || mod(f.sizes[0])).id;
    const state = d ? `<span class="arx-fit dl">${ic('download')}Downloading · ${Math.round(d.pct)}%</span>` : have ? `<span class="arx-fit have">${ic('circle-check')}On this computer</span>` : `<span class="arx-fit f-${ft}"><i></i>${fitWord[ft]}</span>`;
    return `<article class="arx-fam" data-arx-open="${f.id}:${open}" role="button" tabindex="0"><header>${mono(mod(f.sizes[0]), 44)}<span><b>${esc(f.n)}</b><small>${esc(f.by)}</small></span></header><p>${esc(f.line)}</p>
      <footer>${state}<em>${f.sizes.length > 1 ? `${f.sizes.length} sizes` : gb(mod(f.sizes[0]).sz)}</em></footer></article>`; }

  /* a model's page */
  function famPage() { const f = FAM.find(x => x.id === ST.fam), m = mod(ST.size), ft = fit(m), d = dl(m.id), u = usedFor(m.id), P = PC();
    const say = m.have ? `${ic('circle-check')}<span>On this computer. ${u.length ? `Ari uses it for ${esc(u.join(', '))}.` : 'Ari doesn’t use it yet.'}${m.upd && !d ? ` A new version is ready (${gb(m.upd)}). <button class="arx-link" type="button" data-arx-upd="${m.id}">Update</button>` : d ? ` Updating · ${Math.round(d.pct)}%` : ''}</span>`
      : d ? `${ic('download')}<span>Downloading · ${gb(m.sz * d.pct / 100)} of ${gb(m.sz)}</span>`
      : `${ic(ft === 'no' ? 'circle-alert' : 'memory-stick')}<span>${esc(m.n)} needs about ${m.mem} GB of memory. ${ft === 'no' ? `${esc(pc()).replace(/^t/, 'T')} has ${P.mem} GB, so it won’t run here.` : `${esc(pc()).replace(/^t/, 'T')} has ${P.mem} GB, so it ${ft === 'good' ? 'runs well' : 'runs, but answers come slowly'}.`}</span>`;
    const det = [['book-open', 'Reads at once', pages(f.ctx)], f.langs && ['languages', 'Languages', f.langs], ['scale', 'Licence', `${f.lic}. ${f.licl}`], ['calendar', 'Released', f.rel], ['building-2', 'Made by', f.by], ['house', 'Privacy', 'Runs on this computer. Nothing you say to it leaves']].filter(Boolean);
    return `<header class="arx-mh">${mono(m, 80)}<span><small>${esc(f.by)}</small><h1>${esc(f.n)}</h1><p>${esc(f.line)}</p></span></header>
      ${f.sizes.length > 1 ? `<section class="arx-sec"><h2>Sizes<small>Bigger sizes are smarter, and need more memory</small></h2><div class="arx-ladder">${f.sizes.map(rung).join('')}</div></section>` : ''}
      <p class="arx-say f-${m.have ? 'have' : d ? 'dl' : ft}">${say}</p>
      <section class="arx-sec"><h2>What it can do</h2><div class="arx-can">${f.can.map(k => `<span>${ic(CAN[k][0])}<b>${CAN[k][1]}</b><small>${CAN[k][2]}</small></span>`).join('')}</div></section>
      <section class="arx-sec"><h2>Details</h2><div class="arx-det">${det.map(([i, k, v]) => `<div>${ic(i)}<span><small>${k}</small><b>${esc(v)}</b></span></div>`).join('')}</div></section>`; }
  function rung(id) { const m = mod(id), ft = fit(m), d = dl(id);
    return `<button type="button" class="arx-rung f-${ft}${ST.size === id ? ' on' : ''}${m.have ? ' have' : ''}" data-arx-size="${id}"><b>${m.p}</b><small>${gb(m.sz)}</small><em>${m.have ? 'On this computer' : d ? `${Math.round(d.pct)}%` : { good: 'Runs well', ok: 'Slower', no: 'Too big' }[ft]}</em></button>`; }

  /* ── the action bar: the one thing to do here ── */
  function bar() { const b = document.getElementById('ari-bar'); if (!b) return; W = document.getElementById('w-ari');
    b.className = 'fbar phnofit arxbar' + (ST.grown ? ' grown' : '') + (narrow() ? ' arxphbar' : '');
    W.classList.toggle('arxgrown', !!ST.grown);
    if (ST.grown) { b.innerHTML = grown(); b.hidden = false; return; }
    let h = '';
    if (ST.fam) { const m = mod(ST.size), d = dl(m.id);
      if (m.have) h = `<button class="arx-key danger" type="button" data-arx-rm="${m.id}">${ic('trash-2')}Remove</button>`;
      else if (d) h = `<span class="arx-said"><span class="arx-prog sm${d.paused ? ' paused' : ''}"><i style="width:${d.pct}%"></i></span>${Math.round(d.pct)}%</span><button class="arx-well" type="button" data-arx-pause="${m.id}">${ic(d.paused ? 'play' : 'pause')}${d.paused ? 'Resume' : 'Pause'}</button><button class="arx-well" type="button" data-arx-cancel="${m.id}">Cancel</button>`;
      else if (fit(m) === 'no') h = `<span class="arx-said">${ic('circle-alert')}Too big for this computer</span>`;
      else h = `<button class="arx-key" type="button" data-arx-get="${m.id}">${ic('download')}Download · ${gb(m.sz)}</button>`; }
    else if (ST.view === 'store') h = `<label class="arx-q">${ic('search')}<input data-arx-q placeholder="Search models" value="${esc(ST.q)}" aria-label="Search models"></label>`;
    b.innerHTML = h; b.hidden = !h; }
  function grown() { const g = ST.grown, m = mod(g.id), x = (t, s) => `<header>${mono(m, 36)}<span><b>${t}</b><small>${s}</small></span><button class="ib" type="button" data-arx-shrink aria-label="Close">${ic('x')}</button></header>`;
    if (g.k === 'rm') { const alt = k => { const o = local().filter(o => o.id !== m.id && jobFits(o, k)).sort((a, b) => b.mem - a.mem)[0] || local().find(o => o.id !== m.id); return o ? o.n : 'the cloud, after asking'; };
      const hit = [ST.def === m.id && ['def', 'Everything', 'sparkles'], ...JOBS.filter(([k]) => ST.over[k] === m.id)].filter(Boolean);
      return `<div class="arx-gx">${x(`Remove ${esc(m.n)}?`, `Frees ${gb(m.sz)}. Your chats stay as they are.`)}
        ${hit.length ? `<div class="arx-swap">${hit.map(([k, n, i]) => `<div>${ic(i)}<span><b>${n}</b><small>${k === 'def' ? `Ari will use ${esc(alt('chat'))} instead` : 'Goes back to the same as everything'}</small></span></div>`).join('')}</div>` : ''}
        <footer><span class="arx-gfine">${ic('download')}You can download it again any time.</span><button class="arx-well" type="button" data-arx-shrink>Cancel</button><button class="arx-key danger" type="button" data-arx-rmgo>${ic('trash-2')}Remove</button></footer></div>`; }
    if (g.k === 'role') { const opt = (k, n, i) => { const on = ST.picks.has(k), cur = who(k === 'def' ? ST.def : ST.over[k]); return `<button type="button" class="${on ? 'on' : ''}" data-arx-gjob="${k}" aria-pressed="${on}">${ic(i)}<span><b>${n}</b><small>${on ? 'This one' : cur ? `Now ${esc(cur.n)}` : k === 'def' ? 'Nothing yet' : 'Same as everything'}</small></span><i class="arx-tick">${ic(on ? 'check' : 'plus')}</i></button>`; };
      return `<div class="arx-gx">${x(`Use ${esc(m.n)} for`, 'Pick everything, or only some tasks')}
        <div class="arx-gjobs">${opt('def', 'Everything', 'sparkles')}${JOBS.map(([k, n, i]) => opt(k, n, i)).join('')}</div>
        <footer><span></span><button class="arx-well" type="button" data-arx-shrink>Cancel</button><button class="arx-key" type="button" data-arx-rolego>Done</button></footer></div>`; }
    return ''; }

  /* ── doing things ── */
  const all = () => { render(); bar(); K.arSide(); };
  const keep = f => { const b = document.getElementById('ari-body'), s = b?.scrollTop || 0; f(); if (b) b.scrollTop = s; };
  function tick() { if (!ST.dls.some(d => !d.paused)) return; ST.dls.forEach(d => { if (!d.paused) d.pct = Math.min(100, d.pct + (d.upd ? 12 : 3.5)); });
    ST.dls.filter(d => d.pct >= 100).forEach(d => { const m = mod(d.id); ST.dls = ST.dls.filter(x => x !== d); delete m.dl;
      if (d.upd) { delete m.upd; K.lToast(W, `${m.n} is up to date`, { icon: 'refresh-cw' }); }
      else { m.have = true; K.lToast(W, `${m.n} is ready`, { icon: 'circle-check' }); } });
    ST.dls.forEach(d => { mod(d.id).dl = d.pct; });
    if (K.AR.view === 'models' && !W.hidden && !ST.grown) keep(() => { render(); bar(); });
    K.arSide(); setTimeout(tick, 450); }
  function startDl(id, o = {}) { if (dl(id)) return; ST.dls.push({ id, pct: o.upd ? 0 : 2, upd: o.upd }); mod(id).dl = 2; if (ST.dls.filter(d => !d.paused).length === 1) setTimeout(tick, 450); }
  function roleMenu(b, k) { const J = JOBS.find(x => x[0] === k), cur = k === 'def' ? ST.def : ST.over[k] || null, ls = [...local()].sort((a, c) => (k === 'def' ? 0 : jobFits(c, k) - jobFits(a, k))), cl = cloudModels();
    const it = (id, n, sub, face) => `<button class="crmi${cur === id ? ' on' : ''}" type="button" data-arx-setrole="${k}:${id}">${face}<span>${esc(n)}<small class="arx-msub">${esc(sub)}</small></span>${cur === id ? ic('check') : ''}</button>`;
    K.lMenu(b, `<div class="arx-menu"><h6>${J ? J[1] : 'For everything'}</h6>${J ? `<button class="crmi${!cur ? ' on' : ''}" type="button" data-arx-setrole="${k}:">${ic('equal')}<span>Same as everything<small class="arx-msub">${esc(who(ST.def)?.n || '')}</small></span>${!cur ? ic('check') : ''}</button>` : ''}
      ${ls.map(m => it(m.id, m.n, 'On this computer', mono(m, 20))).join('')}${cl.map(c => it(c.id, c.n, `${c.via}, in the cloud`, K.arMono(c, 20))).join('')}
      <span class="crsep"></span><button class="crmi" type="button" data-arx-findjob="${k}">${ic('download')}Get a model${J ? ` for ${J[1].toLowerCase()}` : ''}…</button></div>`); }
  function signIn() { ST.signing = true; keep(render); K.lToast(W, 'Sign in to ChatGPT in Viola, then come back', { icon: 'external-link' });
    setTimeout(() => { const g = gpt(); g.on = true; ST.signing = false; ST.was = { def: ST.def, over: { ...ST.over } }; ST.def = 'gpt5'; ST.over = {}; ST.custom = false; keep(all);
      K.lToast(W, 'Signed in. Ari uses ChatGPT for everything', { icon: 'circle-check', undo: () => { ST.def = ST.was.def; ST.over = ST.was.over; keep(all); } }); }, 1800); }

  function click(e) { const t = e.target, h = s => t.closest(s); W = document.getElementById('w-ari'); if (!h('#w-ari') && !h('#lmenu')) return false; let b;
    const shut = () => document.getElementById('lmenu')?.remove();
    if (K.AR.view !== 'models' && !h('#lmenu')) { if (h('[data-ariview="models"]')) { ST.fam = null; ST.grown = null; } return false; }
    if ((b = h('[data-arx-view]'))) { ST.view = b.dataset.arxView; ST.fam = null; ST.grown = null; all(); document.getElementById('ari-body').scrollTop = 0; return true; }
    if ((b = h('[data-arx-open]')) && !h('button:not([data-arx-open])')) { shut(); const [f, id] = b.dataset.arxOpen.split(':'); if (!f) return true; ST.fam = f; ST.size = id; ST.grown = null; all(); document.getElementById('ari-body').scrollTop = 0; return true; }
    if (h('[data-arx-back]')) { ST.fam = null; ST.grown = null; all(); return true; }
    if ((b = h('[data-arx-size]'))) { ST.size = b.dataset.arxSize; ST.grown = null; keep(all); return true; }
    if ((b = h('[data-arx-job]'))) { ST.job = b.dataset.arxJob; keep(render); return true; }
    if (h('[data-arx-big]')) { ST.big = true; keep(render); return true; }
    if (h('[data-arx-custom]')) { ST.custom = !ST.custom; keep(render); return true; }
    if (h('[data-arx-gpt]')) { signIn(); return true; }
    if ((b = h('[data-arx-get]'))) { const m = mod(b.dataset.arxGet); startDl(m.id); keep(all); K.lToast(W, `Downloading ${m.n}. You can keep using Ari`, { icon: 'download' }); return true; }
    if ((b = h('[data-arx-gjob]'))) { const k = b.dataset.arxGjob; ST.picks.has(k) ? ST.picks.delete(k) : ST.picks.add(k); if (k === 'def' && ST.picks.has('def')) JOBS.forEach(([j]) => ST.picks.delete(j)); if (k !== 'def') ST.picks.delete('def'); bar(); return true; }
    if (h('[data-arx-shrink]')) { ST.grown = null; bar(); return true; }
    if ((b = h('[data-arx-pause]'))) { const d = dl(b.dataset.arxPause); d.paused = !d.paused; if (!d.paused) setTimeout(tick, 450); keep(all); return true; }
    if ((b = h('[data-arx-cancel]'))) { const id = b.dataset.arxCancel, m = mod(id); ST.dls = ST.dls.filter(d => d.id !== id); delete m.dl; keep(all); K.lToast(W, `Stopped downloading ${m.n}`, { icon: 'x' }); return true; }
    if ((b = h('[data-arx-upd]'))) { const id = b.dataset.arxUpd; startDl(id, { upd: true }); keep(all); return true; }
    if (h('[data-arx-updall]')) { local().filter(m => m.upd).forEach(m => startDl(m.id, { upd: true })); keep(all); return true; }
    if ((b = h('[data-arx-more]'))) { const m = mod(b.dataset.arxMore), f = famOf(m.id); K.lMenu(b, `${f ? `<button class="crmi" type="button" data-arx-open="${f.id}:${m.id}">${ic('info')}About ${esc(m.n)}</button>` : ''}<button class="crmi" type="button" data-arx-role-of="${m.id}">${ic('sparkles')}Use in Ari…</button><button class="crmi" type="button" data-arx-try="${m.id}">${ic('message-circle')}New chat with it</button><span class="crsep"></span><button class="crmi danger" type="button" data-arx-rm="${m.id}">${ic('trash-2')}Remove</button>`); return true; }
    if ((b = h('[data-arx-rm]'))) { shut(); ST.grown = { k: 'rm', id: b.dataset.arxRm }; bar(); return true; }
    if (h('[data-arx-rmgo]')) { const m = mod(ST.grown.id), was = { def: ST.def, over: { ...ST.over } };
      if (ST.def === m.id) ST.def = (local().filter(o => o.id !== m.id && jobFits(o, 'chat')).sort((a, c) => c.mem - a.mem)[0] || local().find(o => o.id !== m.id))?.id || null;
      JOBS.forEach(([k]) => { if (ST.over[k] === m.id) delete ST.over[k]; }); m.have = false; ST.grown = null; keep(all);
      K.lToast(W, `${m.n} removed. ${gb(m.sz)} freed`, { icon: 'trash-2', undo: () => { m.have = true; ST.def = was.def; ST.over = was.over; keep(all); } }); return true; }
    if ((b = h('[data-arx-role-of]'))) { shut(); const id = b.dataset.arxRoleOf; ST.picks = new Set([...(ST.def === id ? ['def'] : []), ...JOBS.filter(([k]) => ST.over[k] === id).map(j => j[0])]); ST.grown = { k: 'role', id }; bar(); return true; }
    if (h('[data-arx-rolego]')) { const id = ST.grown.id;
      if (ST.picks.has('def')) { ST.def = id; ST.over = Object.fromEntries(Object.entries(ST.over).filter(([, v]) => v !== id)); }
      JOBS.forEach(([k]) => { if (ST.picks.has(k)) ST.over[k] = id; else if (ST.over[k] === id) delete ST.over[k]; });
      ST.grown = null; keep(all); const u = usedFor(id); K.lToast(W, u.length ? `Ari uses ${mod(id).n} for ${u.join(', ')}` : `Ari doesn’t use ${mod(id).n} now`, { icon: 'sparkles' }); return true; }
    if ((b = h('[data-arx-role]'))) { roleMenu(b, b.dataset.arxRole); return true; }
    if ((b = h('[data-arx-setrole]'))) { shut(); const [k, id] = b.dataset.arxSetrole.split(':');
      if (k === 'def') ST.def = id; else if (!id || id === ST.def) delete ST.over[k]; else ST.over[k] = id; keep(all); return true; }
    if ((b = h('[data-arx-unset]'))) { delete ST.over[b.dataset.arxUnset]; keep(all); return true; }
    if ((b = h('[data-arx-findjob]'))) { shut(); const k = b.dataset.arxFindjob; ST.view = 'store'; ST.fam = null; ST.job = ['code', 'pictures', 'hard'].includes(k) ? k : 'all'; all(); return true; }
    if ((b = h('[data-arx-try]'))) { shut(); K.AR.model = b.dataset.arxTry; K.AR.view = 'chat'; K.AR.cur = 'new'; ST.fam = null; K.arAll(); return true; }
    if ((b = h('[data-arx-svc]'))) { const s = svc(b.dataset.arxSvc), g = s.id === 'openai'; K.lMenu(b, `${g ? '' : `<button class="crmi" type="button" data-arikey="${s.id}" data-arx-direct>${ic('key-round')}Change key</button><span class="crsep"></span>`}<button class="crmi danger" type="button" data-arx-disc="${s.id}">${ic('log-out')}${g ? 'Sign out of ChatGPT' : `Disconnect ${esc(s.n)}`}</button>`); return true; }
    if ((b = h('[data-arx-disc]'))) { shut(); const s = svc(b.dataset.arxDisc), ids = s.models.map(x => x[0]); s.on = false;
      if (ids.includes(ST.def)) ST.def = local()[0]?.id || null; JOBS.forEach(([k]) => { if (ids.includes(ST.over[k])) delete ST.over[k]; }); keep(all);
      K.lToast(W, s.id === 'openai' ? 'Signed out of ChatGPT' : `${s.n} disconnected. Its key is gone from this computer`, { icon: 'log-out' }); return true; }
    return false; }

  function init(k) { K = k;
    Object.entries(SIZES).forEach(([id, s]) => { const m = mod(id); if (m) Object.assign(m, s); else L().push({ id, ...s, good: [] }); });
    mod('mistral24').have = true; mod('qwen30').upd = 0.4;
    /* the cloud starts empty: the ChatGPT account is the first thing offered */
    K.ARCL.forEach(s => { s.on = false; }); Object.assign(gpt(), { n: 'ChatGPT', models: [['gpt5', 'GPT-5'], ['gpt5m', 'GPT-5 mini']] });
    const v = QS.get('arv'), f = QS.get('arx'); if (v === 'models' || v === 'store' || f) { K.AR.view = 'models'; if (v === 'store') ST.view = 'store'; if (f) [ST.fam, ST.size] = f.split(':'); }
    document.addEventListener('input', e => { if (e.target.matches?.('[data-arx-q]')) { ST.q = e.target.value; render(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.grown && K.AR.view === 'models') { ST.grown = null; bar(); e.stopPropagation(); } }, true); }

  window.LumaAriModels = { init, render, bar, click, state: ST, open: (f, id) => { ST.fam = f; ST.size = id; all(); }, view: v => { ST.view = v; ST.fam = null; all(); },
    grow: g => { ST.grown = g; ST.picks = new Set(g.k === 'role' ? ['def'] : []); bar(); } };
})();
