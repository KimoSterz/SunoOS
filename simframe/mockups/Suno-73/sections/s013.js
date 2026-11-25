      <section class="pgsec" id="pgb-code"><h2>Code</h2><p>You never need it, but it’s always one step away.</p><button class="pgcodebtn" type="button" data-pgcode="">${ic('terminal')}<span><b>Open the files, the changes and the terminal</b><small>${esc(p.path)}</small></span>${ic('arrow-right')}</button></section>
      </article></div>`; }
  const pgRp = () => 14 + Object.keys(PG.rel).filter(k => PG.rel[k]).length;

  /* ── The code, one step down: files, the change as a diff, and a terminal on the Dev server ── */
  const PGSRC = {
    'AGENTS.md': () => pgAgentsMd('Kiln', '~/Documents/Playground Projects/Kiln'),
    'CLAUDE.md': () => '@AGENTS.md\n',
    '.mcp.json': () => '{\n  "mcpServers": {\n    "playground": {\n      "command": "playgroundd",\n      "args": ["mcp", "--project", "."]\n    }\n  }\n}\n',
    '.playground/project.toml': () => 'name = "Kiln"\nhome = "dev-server"\n\n[[places]]\nname = "Dev server"\nrole = "development"\nhost = "203.0.113.7"\n\n[[places]]\nname = "Production"\nrole = "production"\nhost = "kiln.studio"\n\n[members]\nnick = "owner"\npriya = "builder"\nsam = "reviewer"\n',
    '.playground/goals/add-a-waitlist.md': () => `---\ntitle: Add a waitlist\nstatus: ${PG.wl.phase === 'decide' ? 'needs-you' : PG.wl.phase === 'build' ? 'working' : PG.wl.phase === 'review' ? 'ready-to-review' : 'live'}\nagent: ${PG.ag.waitlist}\nsize: medium\n---\n\n## Stories\n\n1. Someone can join the waitlist for a full class\n   - [x] When all eight wheels are booked, the button says Join waitlist\n   - [x] After joining, they see their place in line\n2. When a spot opens, the first person waiting is offered it\n   - [${PG.wl.phase === 'decide' ? ' ' : 'x'}] Cancelling a booking sends an offer to whoever is first\n   - [${PG.wl.phase === 'decide' ? ' ' : 'x'}] If they don't claim it within 2 hours, the offer moves on\n3. Maya can see who's waiting\n   - [x] Each class in Maya's view lists its waitlist in order\n`,
    '.playground/decisions.md': () => `# Decisions\n\n${PG.wl.choice ? `## Waitlist offers go by ${PG.wl.choice === 'both' ? 'text, then email' : PG.wl.choice}\nNick, today. Most people see a text within minutes.\n\n` : ''}## Old bookings follow people when they sign in\nNick, Sep 30. Matched by phone number.\n\n## Stage gets its own copy of the bookings\nAri suggested, Priya agreed, Sep 27.\n`,
    'src/lib/ClassCard.svelte': () => `<script lang="ts">\n  import Waitlist from './Waitlist.svelte';\n  export let cls;\n  $: full = cls.left === 0;\n<\/script>\n\n<article class="class">\n  <DateTile day={cls.day} />\n  <h3>{cls.title}</h3>\n  <p>{cls.when}</p>\n  {#if full}\n    <span class="spots full">${PG.heads.wlfull || PG.wl.phase === 'decide' ? 'Full' : 'Class full'}</span>\n    <Waitlist {cls} />\n  {:else}\n    <span class="spots">{cls.left} of 8 wheels left</span>\n    <a class="book" href="/book/{cls.id}">Book</a>\n  {/if}\n</article>\n`,
    'src/lib/Waitlist.svelte': () => `<script lang="ts">\n  export let cls;\n  let joined = false, place = 0;\n\n  async function join() {\n    const res = await fetch(\`/api/waitlist/\${cls.id}\`, { method: 'POST' });\n    ({ place } = await res.json());\n    joined = true;\n  }\n<\/script>\n\n{#if joined}\n  <p class="place">You're number {place} in line</p>\n{:else}\n  <button class="join" on:click={join}>Join waitlist</button>\n  {#if cls.waiting}<span class="waiting">{cls.waiting} waiting</span>{/if}\n{/if}\n`,
    'src/lib/server/waitlist.ts': () => `import { db } from './db';\n\n// One line per person waiting, oldest first.\nexport function join(classId: string, personId: string) {\n  const place = db.prepare(\n    'SELECT COUNT(*) AS n FROM waitlist WHERE class_id = ?'\n  ).get(classId).n + 1;\n  db.prepare(\n    'INSERT INTO waitlist (class_id, person_id, joined_at) VALUES (?, ?, ?)'\n  ).run(classId, personId, Date.now());\n  return { place };\n}\n\nexport function firstWaiting(classId: string) {\n  return db.prepare(\n    'SELECT * FROM waitlist WHERE class_id = ? AND offered_at IS NULL ORDER BY joined_at LIMIT 1'\n  ).get(classId);\n}\n${PG.wl.phase !== 'decide' ? `\nexport function markOffered(id: number) {\n  db.prepare('UPDATE waitlist SET offered_at = ? WHERE id = ?').run(Date.now(), id);\n}\n` : ''}`,
    'src/lib/server/offers.ts': () => `import { firstWaiting, markOffered } from './waitlist';\nimport { sendText, sendEmail } from './notify';\n\nconst HOLD = 2 * 60 * 60 * 1000; // two hours to claim it\n\n// A booking was cancelled: offer the spot to whoever is first in line.\nexport async function offerSpot(classId: string) {\n  const next = firstWaiting(classId);\n  if (!next) return;\n  markOffered(next.id);\n  const msg = \`A spot opened in \${next.class_title}. It's held for you for 2 hours.\`;\n${PG.wl.choice === 'email' ? '  await sendEmail(next.email, msg);\n' : PG.wl.choice === 'text' ? '  await sendText(next.phone, msg);\n' : '  const sent = await sendText(next.phone, msg);\n  if (!sent.ok) await sendEmail(next.email, msg); // the text failed: email instead\n'}  setTimeout(() => offerSpot(classId), HOLD);  // unclaimed: move on\n}\n`,
    'src/lib/server/notify.ts': () => `export async function sendText(to: string, body: string) {\n  return texting.send({ to, body });\n}\n\nexport async function sendEmail(to: string, body: string) {\n  return email.send({ to, subject: 'A spot opened at Kiln', body });\n}\n`,
    'src/lib/server/db/schema.sql': () => `CREATE TABLE classes (\n  id TEXT PRIMARY KEY,\n  title TEXT NOT NULL,\n  starts_at INTEGER NOT NULL,\n  wheels INTEGER NOT NULL DEFAULT 8\n);\n\nCREATE TABLE bookings (\n  id INTEGER PRIMARY KEY,\n  class_id TEXT NOT NULL REFERENCES classes(id),\n  person_id TEXT NOT NULL\n);\n\nCREATE TABLE waitlist (\n  id INTEGER PRIMARY KEY,\n  class_id TEXT NOT NULL REFERENCES classes(id),\n  person_id TEXT NOT NULL,\n  joined_at INTEGER NOT NULL,\n  offered_at INTEGER\n);\n`,
    'src/routes/+page.svelte': () => `<script lang="ts">\n  import ClassCard from '$lib/ClassCard.svelte';\n  import StudioPhotos from '$lib/StudioPhotos.svelte';\n  export let data;\n<\/script>\n\n<section class="hero">\n  <small>Maya's pottery studio</small>\n  <h1>Find your wheel this week</h1>\n</section>\n\n<StudioPhotos photos={data.photos} />\n\n<h2>This week</h2>\n{#each data.classes as cls (cls.id)}\n  <ClassCard {cls} />\n{/each}\n`,
    'src/routes/maya/+page.svelte': () => `<script lang="ts">\n  export let data; // Maya's view: today's classes, who's booked, who's waiting\n<\/script>\n\n{#each data.classes as cls}\n  <h2>{cls.title}</h2>\n  <ul>{#each cls.bookings as b}<li>{b.name}</li>{/each}</ul>\n  {#if cls.waitlist.length}\n    <h3>Waiting</h3>\n    <ol>{#each cls.waitlist as w}<li>{w.name}</li>{/each}</ol>\n  {/if}\n{/each}\n`,
    'tests/waitlist.test.ts': () => `import { join, firstWaiting } from '$lib/server/waitlist';\n\ntest('people join in order', () => {\n  expect(join('glaze-15', 'ana').place).toBe(1);\n  expect(join('glaze-15', 'ben').place).toBe(2);\n  expect(firstWaiting('glaze-15').person_id).toBe('ana');\n});\n`,
    'tests/offers.test.ts': () => `test('a cancelled booking offers the spot to the first person', async () => {\n  await cancel('glaze-15', 'cara');\n  expect(sent[0].to).toBe(ana.phone);\n});\n\ntest('a failed text falls back to email', async () => {\n  texting.failNext();\n  await offerSpot('glaze-15');\n  expect(emailed[0].to).toBe(ana.email);\n});\n`,
    'src/lib/StudioPhotos.svelte': () => `<script lang="ts">\n  export let photos = [];\n<\/script>\n\n<div class="photos">\n  {#each photos as p}\n    <img src={p.src} alt={p.alt} loading="lazy" width="300" height="224" />\n  {/each}\n</div>\n`,
    'src/lib/server/phone.ts': () => `// Phone numbers are saved with the country code, so texts always arrive.\nexport function normalise(raw: string, country = '+1') {\n  const digits = raw.replace(/[^0-9+]/g, '');\n  if (digits.startsWith('+')) return digits;\n  return country + digits.replace(/^1(?=\\d{10}$)/, '');\n}\n`,
    'package.json': () => '{\n  "name": "kiln",\n  "private": true,\n  "scripts": {\n    "dev": "vite dev",\n    "build": "vite build",\n    "test": "vitest run"\n  }\n}\n'
  };
  /* the last saved version, for the diff: what each file looked like before the goal touched it */
  const PGBASE = { 'src/lib/ClassCard.svelte': `<script lang="ts">\n  export let cls;\n  $: full = cls.left === 0;\n<\/script>\n\n<article class="class">\n  <DateTile day={cls.day} />\n  <h3>{cls.title}</h3>\n  <p>{cls.when}</p>\n  {#if full}\n    <span class="spots full">Full</span>\n    <button class="book" disabled>Full</button>\n  {:else}\n    <span class="spots">{cls.left} of 8 wheels left</span>\n    <a class="book" href="/book/{cls.id}">Book</a>\n  {/if}\n</article>\n`,
    'src/lib/server/db/schema.sql': `CREATE TABLE classes (\n  id TEXT PRIMARY KEY,\n  title TEXT NOT NULL,\n  starts_at INTEGER NOT NULL,\n  wheels INTEGER NOT NULL DEFAULT 8\n);\n\nCREATE TABLE bookings (\n  id INTEGER PRIMARY KEY,\n  class_id TEXT NOT NULL REFERENCES classes(id),\n  person_id TEXT NOT NULL\n);\n`,
    'src/routes/+page.svelte': `<script lang="ts">\n  import ClassCard from '$lib/ClassCard.svelte';\n  export let data;\n<\/script>\n\n<section class="hero">\n  <small>Maya's pottery studio</small>\n  <h1>Find your wheel this week</h1>\n</section>\n\n<h2>This week</h2>\n{#each data.classes as cls (cls.id)}\n  <ClassCard {cls} />\n{/each}\n` };
  const pgChanged = gid => gid === 'photos' ? ['src/routes/+page.svelte', 'src/lib/StudioPhotos.svelte'] : gid === 'texts' ? ['src/lib/server/phone.ts'] : gid === 'signin' ? [] : ['src/lib/ClassCard.svelte', 'src/lib/Waitlist.svelte', 'src/lib/server/waitlist.ts', 'src/lib/server/db/schema.sql', 'src/routes/maya/+page.svelte', 'tests/waitlist.test.ts', ...(PG.wl.phase !== 'decide' ? ['src/lib/server/offers.ts', 'src/lib/server/notify.ts', 'tests/offers.test.ts'] : [])];
  /* a real line diff (longest common subsequence), shown as hunks with three lines of context; long unchanged runs fold */
  function pgDiffRows(a, b) { const A2 = a.split('\n'), B = b.split('\n'), n = A2.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A2[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ops = []; let i = 0, j = 0; while (i < n || j < m) { if (i < n && j < m && A2[i] === B[j]) { ops.push(['cx', j + 1, B[j]]); i++; j++; } else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { ops.push(['add', j + 1, B[j]]); j++; } else { ops.push(['del', i + 1, A2[i]]); i++; } }
    const keep = ops.map((o, k) => o[0] !== 'cx' || ops.slice(Math.max(0, k - 3), k + 4).some(x => x[0] !== 'cx'));
    const out = []; let skip = 0; ops.forEach((o, k) => { if (keep[k]) { if (skip) { out.push(['gap', 0, `${skip} unchanged ${skip === 1 ? 'line' : 'lines'}`]); skip = 0; } out.push(o); } else skip++; }); if (skip) out.push(['gap', 0, `${skip} unchanged ${skip === 1 ? 'line' : 'lines'}`]); return out; }
  const pgHl = l => esc(l).replace(/(\/\/.*$|#.*$)/, '<span class="c">$1</span>').replace(/\b(import|export|from|const|let|function|async|await|return|if|else|CREATE|TABLE|INTEGER|TEXT|NOT|NULL|PRIMARY|KEY|REFERENCES|DEFAULT|SELECT|INSERT|UPDATE|WHERE)\b/g, '<span class="k">$1</span>').replace(/(&#39;[^&]*&#39;|'[^']*')/g, '<span class="s">$1</span>');
  /* a new project's files: everything in it is new, so every file is a change */
  const pgNewSrc = p => ({ 'AGENTS.md': () => pgAgentsMd(p.n, `~/Documents/Playground Projects/${p.n}`), 'CLAUDE.md': () => '@AGENTS.md\n',
    'src/routes/+page.svelte': () => p.tpl === 'game' ? `<script lang="ts">\n  import Bubbles from '$lib/Bubbles.svelte';\n  let score = 0;\n<\/script>\n\n<header>\n  <h1>Bubble Pop</h1>\n  <span>Score {score}</span>\n</header>\n\n<Bubbles on:pop={() => score++} />\n` : p.tpl === 'classes' ? `<script lang="ts">\n  export let data;\n<\/script>\n\n<h1>Classes this week</h1>\n{#each data.classes as c}\n  <article>\n    <small>{c.day}</small>\n    <b>{c.title}</b>\n    <span>{c.left} spots left</span>\n    <a href="/book/{c.id}">Book</a>\n  </article>\n{/each}\n` : `<script lang="ts">\n  export let data;\n  $: thirsty = data.plants.filter(p => p.daysSince >= p.every);\n<\/script>\n\n<h1>{thirsty.length} plants are thirsty</h1>\n\n<h2>Needs water</h2>\n{#each thirsty as plant (plant.id)}\n  <PlantRow {plant} on:water={() => water(plant)} />\n{/each}\n`,
    'src/lib/server/db.ts': () => `import Database from 'better-sqlite3';\n\n// One file, inside the project folder.\nexport const db = new Database('data/${p.n.toLowerCase().replace(/\s+/g, '-')}.db');\n` });
  function pgCode() { const gid = PGX.code.gid || pgGoal()?.id, kiln = PG.proj === 'kiln', np = !kiln && PG.projects.find(x => x.id === PG.proj), SRC = kiln ? PGSRC : pgNewSrc(np || PGTPL.plants), ch = kiln ? pgChanged(gid) : Object.keys(SRC), tree = Object.keys(SRC);
    let f = PGX.code.file; if (!f || !(f in SRC)) f = ch[0] || 'AGENTS.md'; PGX.code.file = f;
    const src = SRC[f](), isCh = ch.includes(f), mode = isCh ? PGX.code.mode : 'file', base = kiln ? PGBASE[f] ?? '' : '';
    const rows = mode === 'diff' ? pgDiffRows(base, src) : src.split('\n').map((l, i) => ['', i + 1, l]);
    const termLines = PGX.term.length ? PGX.term : kiln ? pgTermSeed(gid) : [['dim', '# Ari, making the first version'], ['pr', '$ npm create svelte@latest .'], ['', 'Project ready'], ['pr', '$ npm run dev'], ['ok', 'Ready on this computer, shown on the Stage'], ['pr', '$ playground checks run --goal first-version'], ['ok', `✓ ${np ? PGTPL[np.tpl].checks.length : 3} of ${np ? PGTPL[np.tpl].checks.length : 3} checks passed on Stage`]];
    return `<div class="pgcode"><nav class="pgfiles2">${ch.length ? `<h6>Changed in ${esc(pgGoals().find(g => g.id === gid)?.t || 'this goal')}</h6>${ch.map(p => `<button class="pgfr${p === f ? ' on' : ''}" type="button" data-pgfile="${esc(p)}">${ic('file-text')}<span>${esc(p.split('/').pop())}</span><em class="${kiln && PGBASE[p] ? '' : 'a'}">${kiln && PGBASE[p] ? 'M' : 'A'}</em></button>`).join('')}` : ''}
        <h6>${esc(pgProj()?.n || 'Kiln')}</h6>${tree.filter(p => !ch.includes(p)).map(p => `<button class="pgfr${p === f ? ' on' : ''}" type="button" data-pgfile="${esc(p)}">${ic(p.startsWith('.') ? 'settings-2' : 'file-text')}<span>${esc(p)}</span></button>`).join('')}</nav>
      <div class="pgsrc"><div class="pgsrch">${ic('file-text')}<b>${esc(f)}</b>${isCh ? seg([['diff', 'Changes'], ['file', 'Whole file']], mode, 'data-pgcmode', 'Show') : ''}</div><table>${rows.map(([k, n, l]) => k === 'gap' ? `<tr class="gap"><td class="n"></td><td>${esc(l)}</td></tr>` : `<tr class="${k}"><td class="n">${n}</td><td>${pgHl(l)}</td></tr>`).join('')}</table></div>
      <div class="pgterm${PGU.term ? '' : ' off'}"><div class="pgtermh">${ic('terminal')}<b>Terminal</b><span>${kiln ? 'on the Dev server' : 'on this computer'} · ${esc(pgProj().path)}</span><button class="ib" type="button" data-pgtermtog aria-label="${PGU.term ? 'Hide' : 'Show'} the terminal">${ic(PGU.term ? 'chevron-down' : 'chevron-up')}</button></div>
        <div class="pgtermb" id="pg-termb">${termLines.map(([c, t]) => `<p class="${c}">${esc(t)}</p>`).join('')}<div class="pgtermin"><span class="pr">${esc((pgProj()?.n || 'kiln').toLowerCase().replace(/\s+/g, '-'))} %</span><input id="pg-termin" spellcheck="false" autocomplete="off" aria-label="Command" placeholder="Try: ls, git status, npm test"></div></div></div></div>`; }
  const pgTermSeed = gid => gid === 'photos' ? [['dim', '# Ari, Wednesday 11:38 AM'], ['pr', 'kiln % npm run check'], ['ok', 'svelte-check found 0 errors and 0 warnings'], ['pr', 'kiln % playground checks run --goal studio-photos'], ['ok', '✓ 4 of 4 checks passed on Stage']]
    : [['dim', `# ${PGAG[PG.ag.waitlist]?.n || 'Ari'}, the last run for this goal`], ['pr', 'kiln % npm run check'], ['ok', 'svelte-check found 0 errors and 0 warnings'], ['pr', 'kiln % npm test -- waitlist'], ['ok', ` ✓ tests/waitlist.test.ts (6 tests) 412ms${PG.wl.phase !== 'decide' ? '\n ✓ tests/offers.test.ts (4 tests) 388ms' : ''}`], ['pr', 'kiln % playground checks run --goal add-a-waitlist'], ['ok', PG.wl.phase === 'decide' ? '✓ 3 of 5 checks passed · 2 wait for a decision' : '✓ 6 of 6 checks passed on Stage']];
  function pgTermRun(cmd) { const out = PGX.term.length ? PGX.term : (PGX.term = pgTermSeed(PGX.code.gid || pgGoal()?.id)); const c = cmd.trim(); out.push(['pr', 'kiln % ' + c]);
    const r = { '': null, help: 'Commands that work here: ls, pwd, git status, git log, npm test, cat AGENTS.md, clear', pwd: '/home/kiln/Documents/Playground Projects/Kiln', ls: 'AGENTS.md  CLAUDE.md  package.json  src  static  tests', whoami: 'nick (certificate valid until 6:10 PM)',
      'git status': `On branch goal/add-a-waitlist\nChanges not yet released:\n${pgChanged('waitlist').map(p => '  ' + (PGBASE[p] ? 'modified:   ' : 'new file:   ') + p).join('\n')}`, 'git log': '9f3c1e2 Sign in with Luma Connect (restore point 14)\n41a8b7d Booking reminders (restore point 13)\n0c2d9a4 First version of Kiln (restore point 1)',
      'npm test': ` ✓ tests/bookings.test.ts (9 tests)\n ✓ tests/waitlist.test.ts (6 tests)${PG.wl.phase !== 'decide' ? '\n ✓ tests/offers.test.ts (4 tests)' : ''}\n\nAll tests passed`, 'cat agents.md': pgAgentsMd('Kiln', '~/Documents/Playground Projects/Kiln') }[c.toLowerCase()];
    if (c === 'clear') { PGX.term = []; } else if (r !== undefined) { if (r) out.push(['', r]); } else out.push(['dim', `${c.split(' ')[0]}: not available in this preview. Type help to see what is.`]);
    pgPage(); setTimeout(() => $('#pg-termin')?.focus(), 0); }

  /* ── Review and release: Stage and Live side by side, what changes for people, the data, the checks ── */
  function pgReview(gid) { const s = pgRevState(gid), r = s.r; if (!r) return '';
    const base = klFeat('live'), only = { ...base, ...r.feat, full: r.feat.waitlist && !PG.heads.wlfull ? 'Class full' : base.full };   /* Stage, as it will be: Live plus this goal, nothing else */
    const shot = env => `<div class="pgdevwrap" style="width:236px;height:486px">${pgDevice('phone', klHTML({ dev: 'phone', env, shot: true, feat: env === 'stage' ? only : {} }), env)}</div>`;
    return `<div class="pgrev"><div class="pgrevh"><div><span class="pgpill ${s.released ? 'live' : 'rvw'}">${s.released ? 'Released' : 'Ready to review'}</span><h1>${esc(r.t)}</h1><p>${s.released ? 'It’s live. Stage and Live now match for this goal, and a restore point was saved before it went out.' : 'Live is what people have now. Stage shows what they’ll have once you release this goal.'}</p></div></div>
      <div class="pgrevg"><div class="pgside2"><header><i class="stat"></i>Live<small>kiln.studio</small></header>${shot('live')}</div><div class="pgside2"><header><i class="pgsd"></i>Stage<small>after release</small></header>${shot('stage')}</div>
      <div class="pgfacts"><div class="pgbox"><h3>What changes for people</h3><ul>${r.changes.map(c => `<li>${ic('user')}<span>${esc(c)}</span></li>`).join('')}</ul></div>
        <div class="pgbox"><h3>Data</h3><ul>${r.data.map(c => `<li>${ic('database')}<span>${esc(c)}</span></li>`).join('')}</ul></div>
        <div class="pgbox"><h3>Checks<em style="color:${s.pass ? 'var(--good)' : 'var(--pg-amber)'}">${s.cks.filter(c => c[1] === 'pass').length} of ${s.cks.length || 5} passed</em></h3><ul>${(s.cks.length ? s.cks : [['People can join a waitlist', 'pass'], ['A cancelled booking sends an offer', 'wait']]).map(([t, st]) => `<li>${pgCk('', st)}<span>${esc(t)}</span></li>`).join('')}</ul></div>
        <div class="pgbox"><h3>Decisions and review</h3><ul>${r.dec ? `<li>${ic(s.decOpen ? 'hand' : 'check')}<span>${esc(r.dec)}<small>${s.decOpen ? 'Still open. It’s waiting for you in the goal.' : 'You decided: a text, then an email if it fails'.replace('a text, then an email if it fails', PG.wl.choice === 'both' ? 'a text, then an email if it fails' : PG.wl.choice === 'text' ? 'a text' : 'an email')}</small></span></li>` : ''}
          <li>${r.reviewer ? av(r.reviewer, 16) : ic('eye')}<span>${r.reviewer ? `${pgFirst(r.reviewer)} approved it` : 'Sam hasn’t looked yet'}<small>${r.reviewer ? 'Wednesday, 2:05 PM' : 'Reviews are welcome, not required for the owner'}</small></span></li></ul></div></div></div></div>`; }
  function pgRelBar(gid) { const s = pgRevState(gid), run = PGX.relRun;
    if (run) return `<div class="fbar phnofit pgrelbar"><span class="pgreleasing"><i class="pgspin"></i><span><b>${esc(run.t)}</b></span></span><span class="pgbar" style="margin:0;width:160px"><i style="width:${run.pct}%"></i></span></div>`;
    const why = s.released ? `Released · restore point ${gid === 'signin' ? 14 : PG.relRp?.[gid] || pgRp()}` : s.decOpen ? 'One decision is still open' : !s.pass ? 'The checks haven’t all passed on this version' : 'A restore point is saved first, so you can go back';
    return `<div class="fbar phnofit pgrelbar"><span class="pgdest">${ic('radio')}Production · kiln.studio</span><span><b>${s.released ? 'It’s live' : s.ok ? 'Ready to release' : 'Not ready yet'}</b><small>${esc(why)}</small></span><button class="bt key" type="button" data-pgrelease="${gid}"${s.ok && !s.released ? '' : ' disabled'}>${ic('radio')}Release</button></div>`; }

  /* ── What happens: scripted runs that append to a goal, one card at a time ── */
  const pgSleep = ms => new Promise(r => setTimeout(r, PGX.fast ? 0 : ms));
  const pgId = () => 'x' + (PG.seq++);
  const pgCur = () => pgKey(PG.proj === 'new' ? 'new' : pgGoal()?.id || 'new');
  function pgPush(key, it) { const L = (PG.add[key] ||= []), at = it.id ? L.findIndex(x => x.id === it.id) : -1; if (at >= 0) L[at] = it; else L.push(it);
    if (it.id && !PGX.fast) { PGX.fresh.add(it.id); setTimeout(() => PGX.fresh.delete(it.id), 900); } pgSave(); if (pgCur() === key) pgMain(); pgSide(); pgTtl(); return it; }
  function pgUpd(key, it) { pgSave(); if (pgCur() !== key) return; const n = $(`#pg-body [data-pgi="${it.id}"]`); if (n) n.outerHTML = pgItem(it, key.split('/').pop()); }
  const pgFind = (key, id) => (PG.add[key] || []).find(x => x.id === id);
  async function pgThink(key, t = 'thinking', ms = 1000) { PGX.busy[key] = 'think'; PGX.thinkT = t; if (pgCur() === key) { pgMain(); pgBar(); } await pgSleep(ms); PGX.busy[key] = true; }
  async function pgRunStep(key, it, total = 8000, spend = 0, onSub) { it.st = 'run'; it.i = 0; it.secs = 0; it.nf = 0; it.spendNow = '$0.00'; pgPush(key, it); const n = it.subs.length, t0 = Date.now(), T = PGX.fast ? 0 : total;
    const tick = setInterval(() => { const e = Math.min(1, (Date.now() - t0) / (T || 1)); it.secs = Math.round(e * total / 1000 * 60); it.pct = e; it.spendNow = '$' + (spend * e).toFixed(2); pgUpd(key, it); }, 450);
    for (let i = 0; i < n; i++) { it.i = i; it.nf = Math.max(1, Math.round(it.files.length * (i + 1) / n)); onSub?.(i); pgUpd(key, it); await pgSleep(total / n); }
    clearInterval(tick); it.st = 'done'; it.el = Math.max(1, Math.round(total / 1000)) + ' min'; it.spend = it.spend || (spend ? '$' + spend.toFixed(2) : ''); if (it.doneT) it.title = it.doneT; pgPush(key, it); }
  async function pgChecks(key, it, gap = 450) { it.checks.forEach(c => { c[1] = 'run'; }); pgPush(key, it); for (const c of it.checks) { await pgSleep(gap); c[1] = 'pass'; pgUpd(key, it); } pgSave(); }
  const pgHist = h => { PG.hist.unshift(h); pgSave(); };

  /* the waitlist decision: answering moves the goal through Steps and Proof to Ready to review */
  async function pgWl(choice, how) { const key = 'waitlist'; if (PGX.busy[key] && !PGX.fast) return;
    const lbl = { text: 'A text message', email: 'An email', both: 'A text, then an email if the text fails' }[choice];
    PG.wl.choice = choice; PG.wl.phase = 'build'; PGX.busy[key] = true; pgSave(); pgAll();
    if (!pgFind(key, 'wl-a1')) { pgPush(key, { k: 'me', id: 'wl-a1', t: how === 'pick' ? 'You pick.' : lbl, at: 'Just now' }); pgHist(['decision', 'Today, just now', `You chose how a spot is offered: ${lbl.toLowerCase()}`, 'In Add a waitlist']); }
    if (!pgFind(key, 'wl-a2')) { await pgThink(key, 'thinking', 1100);
      pgPush(key, { k: 'say', id: 'wl-a2', ag: PG.ag.waitlist, dur: '1.4 s', t: how === 'pick' ? ['I’ll go with a text, then an email if the text fails. It’s the most reliable, and it costs the same as a text.', 'Building the offer now.'] : [choice === 'both' ? 'Good choice, that’s the most reliable. Building the offer now.' : choice === 'text' ? 'Texts it is. Most people will see it within minutes. Building the offer now.' : 'Email it is. I’ll make the subject line plain so it stands out. Building the offer now.'] }); }
    PGX.busy[key] = true;
    const st = pgFind(key, 'wl-s2'); if (!st || st.st !== 'done') await pgRunStep(key, { k: 'step', id: 'wl-s2', ag: PG.ag.waitlist, title: 'Building the offer for an open spot', doneT: 'Built the offer for an open spot', files: PGFILES_OFFER,
      subs: ['Writing the offer message', choice === 'both' ? 'Adding email for when a text fails' : choice === 'email' ? 'Setting up the email' : 'Sending it through the texting service', 'Holding the spot for 2 hours, then moving on', 'Adding the waitlist to Maya’s view', 'Running the checks'] }, 9000, .24);
    if (!pgFind(key, 'wl-h')) { await pgSleep(500); pgPush(key, { k: 'heads', id: 'wl-h', key: 'wlfull', t: 'The class card said “Full”. I changed it to “Class full” so it reads the same as the new button.' }); pgStage(); }
    if (!pgFind(key, 'wl-proof')) { await pgSleep(800); const pf = { k: 'proof', id: 'wl-proof', ag: PG.ag.waitlist, rec: '0:14', scr: { notif: true }, at: 'Checked just now', checks: [
        ['When all eight wheels are booked, the button says Join waitlist', 'wait', 'the Join waitlist button'], ['After joining, people see their place in line', 'wait', null], ['Cancelling a booking sends an offer to whoever is first', 'wait', 'the offer text'],
        choice === 'both' ? ['If the text fails, the offer goes by email instead', 'wait', null] : choice === 'email' ? ['The offer email has a subject line that says what it is', 'wait', null] : ['The offer text arrives within a minute', 'wait', 'the offer text'],
        ['An unclaimed offer moves to the next person after 2 hours', 'wait', null], ['Maya’s view lists each class’s waitlist in order', 'wait', null]] };
      await pgChecks(key, pf); }
    if (!pgFind(key, 'wl-a3')) { await pgSleep(600); pgPush(key, { k: 'say', id: 'wl-a3', ag: PG.ag.waitlist, dur: '0.9 s', t: ['Every check in the plan passes on Stage. It’s ready for you to review, and I’ve let Sam know it’s there.'] }); }
    if (!pgFind(key, 'wl-rev')) pgPush(key, { k: 'review', id: 'wl-rev', gid: 'waitlist' });
    PG.wl.phase = 'review'; PGX.busy[key] = false; pgHist(['agent', 'Today, just now', `${PGAG[PG.ag.waitlist]?.n || 'Ari'} built the waitlist offer`, '6 of 6 checks passed on Stage']); pgSave(); pgAll(); }

  /* anything you type: a question gets an answer, a small change gets made and proved, a big one becomes its own goal */
  const pgTitle = s => { let t = s.trim().replace(/^(hey|hi|ok|okay)[,!\s]+/i, '').replace(/^(can|could|would) you (please )?/i, '').replace(/^(please|let'?s|i want to|i'd like to|we should|we need to)\s+/i, '').replace(/[.!?]+$/, '');
    t = t.charAt(0).toUpperCase() + t.slice(1); if (t.length > 64) t = t.slice(0, 64).replace(/\s+\S*$/, '') + '…'; return t || 'New goal'; };
  const pgSentence = s => { const t = s.trim().replace(/^(hey|hi|ok|okay)[,!\s]+/i, '').replace(/^(can|could|would) you (please )?/i, '').replace(/^(please|let'?s|i want to|i'd like to|we should|we need to)\s+/i, '').replace(/[.!?]+$/, ''); return t.charAt(0).toUpperCase() + t.slice(1); };
  function pgAnswer(g, s) { const kiln = PG.proj === 'kiln';
    if (/cost|much|price|spend|money|credit/.test(s)) return [g.id === 'waitlist' ? 'So far this goal has used $0.31 of Ari credits. Finishing it should take about $0.25 more.' : 'This goal has used very little so far, a few cents of Ari credits. I’ll show a cost card before anything bigger starts.'];
    if (/how long|when will|how soon|time/.test(s)) return [g.id === 'waitlist' && PG.wl.phase === 'decide' ? 'About ten minutes of work once you’ve decided. I’ll show proof when it’s done.' : 'Not long. I’ll show each step as it happens, and proof at the end.'];
    if (/\b(who|priya|sam|team)\b/.test(s)) return [kiln ? 'Priya is here now, watching her agent fix the reminder texts. Sam was here two hours ago and approved the studio photos.' : 'It’s just you on this project for now. You can invite people from People.'];
    if (/live|people see|users|production|customers/.test(s)) return ['Nothing in this goal reaches people until you release it from Review. Live stays as it is, and a restore point is saved first, so you can always go back.'];
    if (/data|database|bookings/.test(s)) return ['Stage has its own copy of the bookings, so testing never touches a real person. Releasing adds what’s new and removes nothing.'];
    if (/why/.test(s) && g.id === 'waitlist') return ['Glaze night has been full four weeks running, and Maya says people text her to ask if a spot opened. The waitlist does that for her.'];
    if (/code|file|where.*(is|are)|folder/.test(s)) return [`Everything is in ${pgProj()?.path}. Show the change on any step card opens the files and the diff, and the terminal is one click from there.`];
    return [`Here’s where this goal stands: ${pgState(g).s.toLowerCase()}. Ask me anything about it, or tell me what to change.`]; }
  function pgMakeGoal(t, d, from) { const pid = PG.proj, id = 'g' + (PG.seq++), g = { id, t, phase: 'needs', by: 'me', began: 'Started by you just now', proj: pid };
    if (pid === 'kiln') PG.extra.push(g); else PG.projects.find(p => p.id === pid)?.goals.push(g);
    const key = pgKey(id); PG.ag[key] = 'ari';
    PG.add[key] = [...(from ? [{ k: 'me', id: pgId(), t: from, at: 'Just now' }] : []), { k: 'say', id: pgId(), ag: 'ari', dur: '3.3 s', t: ['Here’s a plan. It’s small, so it should be quick. Say go when it looks right.'] },
      { k: 'plan', id: pgId(), title: t, st: 'proposed', size: 'Small · about 15 minutes of work', cost: 'About $0.20 of Ari credits', stories: [[d || t, ['You can see it on Stage, on a phone', 'It works for someone who isn’t signed in']], ['Nothing that works today changes', ['Everything else on the page looks and works the same']]] }];
    pgSave(); return g; }
  async function pgAsk(text) { const g = pgGoal(), key = pgCur(), pt = PGX.point; if (!text.trim()) return; PGX.point = null; PGX.draft[key] = '';
    if (PG.proj === 'new') { if (!PGX.nw?.tpl) return pgNewStart(text); pgPush('new', { k: 'me', id: pgId(), t: text, at: 'Just now' }); await pgThink('new', 'thinking', 700); PGX.busy.new = false; pgPush('new', { k: 'say', id: pgId(), ag: 'ari', t: ['Noted. I’ll add that to the brief. Tap an answer above when you’re ready.'], dur: '0.8 s' }); return; }
    const s = text.toLowerCase(), ag = PG.ag[key] || 'ari';
    if (g.fresh) { g.fresh = false; g.t = pgTitle(text); g.phase = 'needs'; g.began = 'Started by you just now'; pgPush(key, { k: 'me', id: pgId(), t: text, at: 'Just now', pt }); await pgThink(key, 'drafting a plan', 1100); PGX.busy[key] = false;
      pgPush(key, { k: 'say', id: pgId(), ag, dur: '2.6 s', t: ['Here’s a plan. It’s small, so it should be quick. Say go when it looks right.'] });
      pgPush(key, { k: 'plan', id: pgId(), title: g.t, st: 'proposed', size: 'Small · about 15 minutes of work', cost: 'About $0.20 of Ari credits', stories: [[pgSentence(text), ['You can see it on Stage, on a phone', 'It works for someone who isn’t signed in']], ['Nothing that works today changes', ['Everything else on the page looks and works the same']]] }); pgAll(); return; }
    const openPlan = (PG.add[key] || []).find(x => x.k === 'plan' && x.st === 'proposed');
    if (openPlan && /^change the plan/i.test(text)) { const add = text.replace(/^change the plan:?\s*/i, '').trim(); pgPush(key, { k: 'me', id: pgId(), t: text, at: 'Just now' }); await pgThink(key, 'updating the plan', 900); PGX.busy[key] = false;
      if (add) openPlan.stories.push([add.charAt(0).toUpperCase() + add.slice(1), ['It’s in place on Stage, ready to try']]); pgPush(key, openPlan); pgPush(key, { k: 'say', id: pgId(), ag, dur: '1.0 s', t: [add ? 'Done. It’s in the plan above, with a check you can see. Say go when it’s right.' : 'Tell me what to change, and I’ll update the plan above.'] }); pgAll(); return; }
    if (PG.proj === 'kiln' && g.id === 'waitlist' && PG.wl.phase === 'decide') { if (/you (pick|choose|decide)|up to you|whatever you think/.test(s)) { PGX.busy[key] = false; return pgWl('both', 'pick'); }
      if (/\btext\b.*\bemail\b|both/.test(s)) return pgWl('both'); if (/^(a )?text/.test(s)) return pgWl('text'); if (/^(an )?e-?mail/.test(s)) return pgWl('email'); }
    pgPush(key, { k: 'me', id: pgId(), t: text, at: 'Just now', pt });
    const q = /\?\s*$|^(how|what|why|when|who|where|is|are|can|could|does|do|will|should|which)\b/.test(s) && !pt;
    await pgThink(key, 'thinking', 900);
    if (q) { pgPush(key, { k: 'say', id: pgId(), ag, dur: '1.6 s', t: g.chat ? pgAnswer({ id: 'chat' }, s) : pgAnswer(g, s), where: ag === 'team' ? 'dev' : 'this' }); PGX.busy[key] = false; pgBar(); return; }
    if (g.chat || (!pt && s.length > 50 && /(add|build|create|new|let (people|them|maya)|make it possible|feature|support|page for|gift|pay)/.test(s))) { const ng = pgMakeGoal(pgTitle(text), pgSentence(text));
      pgPush(key, { k: 'say', id: pgId(), ag, dur: '2.1 s', t: [g.chat ? 'That’s a goal of its own, so I’ve started one with a plan. Have a look when you’re ready.' : 'That’s bigger than this goal, so I’ve made it a goal of its own. This one stays focused.'] });
      pgPush(key, { k: 'newgoal', id: pgId(), gid: ng.id, t: ng.t, d: 'A short plan is waiting for you there. Nothing starts until you say go.' }); PGX.busy[key] = false; pgAll(); return; }
    const what = pt || 'it', file = /photo/.test(what + s) ? 'src/lib/StudioPhotos.svelte' : /welcome|title|heading/.test(what + s) ? 'src/routes/+page.svelte' : 'src/lib/ClassCard.svelte';
    pgPush(key, { k: 'say', id: pgId(), ag, dur: '1.1 s', t: [pt ? `On it. Changing ${pt} on Stage.` : 'On it. It’s a small change, so no plan needed. Making it on Stage.'] });
    await pgRunStep(key, { k: 'step', id: pgId(), ag, title: pt ? `Changing ${pt}` : 'Making the change', doneT: pt ? `Changed ${pt}` : `Made the change: ${pgTitle(text).toLowerCase()}`, files: [pgF(file, 4, 2), pgF('src/app.css', 3, 1)], subs: ['Finding it in the code', 'Making the change', 'Checking it on a phone and a computer'] }, 4800, .05);
    const pf = { k: 'proof', id: pgId(), ag, at: 'Checked just now', scr: PG.proj === 'kiln' ? {} : null, pv: PG.proj === 'kiln' ? null : PG.proj, checks: [[pt ? `${pt.charAt(0).toUpperCase() + pt.slice(1)} looks the way you asked, on a phone` : 'The change shows on Stage, on a phone', 'wait', pt || null], ['Nothing else on the page moved', 'wait', null], ['It still works on a computer screen', 'wait', null]] };
    await pgSleep(500); await pgChecks(key, pf, 350);
    pgPush(key, { k: 'say', id: pgId(), ag, dur: '0.7 s', t: [['review', 'live'].includes(pgState(g).k) ? 'Done on Stage. It goes out with the next release.' : 'Done on Stage. It’s part of this goal now, so it goes out when the goal does.'] });
    PGX.busy[key] = false; pgAll(); }

  /* a plan you say go to: steps, then proof */
  async function pgPlanGo(id) { const g = pgGoal(), key = pgCur(); if (PGX.busy[key]) return;
    if (g.id === 'gifts' && PG.proj === 'kiln') { PG.gifts = 'work'; PGX.busy[key] = true; pgAll();
      await pgRunStep(key, { k: 'step', id: 'gf-s1', title: 'Building Gift a class', doneT: 'Built Gift a class', files: [pgF('src/lib/GiftButton.svelte', 36, 0, 'A'), pgF('src/lib/server/gifts.ts', 71, 0, 'A'), pgF('src/routes/gift/+page.svelte', 44, 0, 'A'), pgF('src/lib/server/db/schema.sql', 8, 0)], subs: ['Adding Give as a gift to each class', 'Taking payment for a gift', 'Making gift codes', 'Letting a code book a class', 'Running the checks'] }, 9000, .9);
      await pgChecks(key, { k: 'proof', id: 'gf-proof', at: 'Checked just now', scr: {}, checks: [['Each class has a Give as a gift button', 'wait', null], ['The buyer pays and gets a gift code to pass on', 'wait', null], ['Entering the code at booking makes the class free', 'wait', null]] });
      pgPush(key, { k: 'say', id: 'gf-a2', ag: 'ari', dur: '0.8 s', t: ['Gift a class works on Stage. Payments are in test mode there, so try it as much as you like.'] }); pgPush(key, { k: 'review', id: 'gf-rev', gid: 'gifts' }); PG.gifts = 'done'; PGX.busy[key] = false; pgSave(); pgAll(); return; }
    const it = pgFind(key, id); if (!it) return; it.st = 'started'; g.phase = 'work'; PGX.busy[key] = true; pgSave(); pgAll();
    await pgRunStep(key, { k: 'step', id: pgId(), title: `Working on ${g.t.toLowerCase()}`, doneT: `Done: ${g.t.toLowerCase()}`, files: [pgF('src/routes/+page.svelte', 12, 3), pgF('src/lib/ClassCard.svelte', 6, 1), pgF('tests/new.test.ts', 22, 0, 'A')], subs: ['Reading the plan and the project notes', 'Making the change', 'Trying it on Stage', 'Running the checks'] }, 7000, .18);
    await pgChecks(key, { k: 'proof', id: pgId(), at: 'Checked just now', scr: PG.proj === 'kiln' ? {} : null, pv: PG.proj === 'kiln' ? null : PG.proj, checks: it.stories.flatMap(([, c]) => c).map(c => [c, 'wait', null]) });
    pgPush(key, { k: 'say', id: pgId(), ag: 'ari', dur: '0.6 s', t: [PG.proj === 'kiln' ? 'Every check passes on Stage. It’s ready for you to review.' : 'Every check passes on Stage. It’s on this computer, ready when you want to share it.'] }); if (PG.proj === 'kiln') pgPush(key, { k: 'review', id: pgId(), gid: g.id }); g.phase = PG.proj === 'kiln' ? 'review' : 'done'; PGX.busy[key] = false; pgSave(); pgAll(); }

  /* switching agent mid-goal: the next one gets a brief you can edit, and the thread carries on */
  function pgBriefFor(g, to) { const wl = g.id === 'waitlist' && PG.proj === 'kiln', p = pgProj();
    const where = wl ? (PG.wl.phase === 'decide' ? 'People can join a waitlist on Stage (7 files changed). The offer for an open spot isn’t built yet.' : 'The waitlist and the offer are built, and every check passes on Stage.') : g.id === 'texts' ? 'Priya’s agent found 14 phone numbers saved without a country code and is fixing how new numbers are saved.' : `${pgState(g).s}.`;
    const dec = wl ? (PG.wl.choice ? `Decided: offers go by ${PG.wl.choice === 'both' ? 'text, then email if the text fails' : PG.wl.choice}.` : 'Still open, and only Nick can decide: how people hear that a spot opened.') : '';
    const next = wl ? (PG.wl.phase === 'decide' ? 'Wait for Nick’s decision, then build the offer.' : 'Help Nick review and release.') : g.id === 'texts' ? 'Correct the 14 saved numbers, resend the two missed reminders, then run the checks.' : 'Carry on with the plan.';
    return `Goal: ${g.t}, in ${p.n} (${p.what.charAt(0).toLowerCase() + p.what.slice(1)}).\nWhere things stand: ${where}\n${dec ? dec + '\n' : ''}Next: ${next}\nRules: work only in ${p.path}, prove changes on Stage with the checks, and never touch Production.`; }
  function pgHandoffStart(to, from) { const g = pgGoal(), key = pgCur(); from = from || PG.ag[key] || 'ari'; PGX.pick = false; $('#pg-pick')?.remove(); if (from === to) { pgBar(); return; }
    if (PGX.busy[key]) { lToast(pgW(), 'Let this step finish, then switch'); pgBar(); return; }
    (PG.add[key] || []).filter(x => x.k === 'handoff' && x.st === 'draft').forEach(x => { x.st = 'cancel'; });
    pgPush(key, { k: 'handoff', id: pgId(), from, to, st: 'draft', brief: pgBriefFor(g, to) }); pgBar(); }
  async function pgHandoffGo(id) { const g = pgGoal(), key = pgCur(), it = pgFind(key, id); if (!it) return; const ta = $(`[data-pghobrief="${id}"]`); if (ta) it.brief = ta.value;
    it.st = 'sent'; PG.ag[key] = it.to; if (g.id === 'texts' && PG.proj === 'kiln') { PG.texts = 'nick'; PG.ag.texts = 'ari'; } pgSave(); pgAll();
    if (g.id === 'texts' && PG.proj === 'kiln') pgPush(key, { k: 'note', id: pgId(), icon: 'info', t: '<b>Priya’s agent stopped.</b> Its work so far is saved in the project, and Priya gets a note.' });
    await pgThink(key, 'reading the brief', 1300);
    const to = it.to, wl = g.id === 'waitlist' && PG.proj === 'kiln';
    pgPush(key, { k: 'say', id: pgId(), ag: to, where: PGAG[to].where === 'dev' ? 'dev' : 'this', dur: '2.0 s', t: to === 'qwen' ? ['I’m running on this computer, so nothing leaves it. I’m a smaller model: I’ll take the small steps and hand anything big back up to Ari, and I’ll say when I do.']
      : [`I’ve read the brief, the plan and the decisions. ${wl && PG.wl.phase === 'decide' ? 'The one thing still open is yours to decide, just above.' : g.id === 'texts' ? 'Carrying on: correcting the 14 saved numbers next.' : `Carrying on from where ${PGAG[it.from]?.n || 'Ari'} stopped.`}`] });
    if (to === 'claude') pgPush(key, { k: 'cost', id: pgId(), t: 'This goal will take about 6% of your Claude week', sub: 'You have 62% left. It resets on Tuesday at 9 AM.', pct: 38, add: 6 });
    if (to === 'team') pgPush(key, { k: 'cost', id: pgId(), t: 'Team key: about $0.45 for the rest of this goal', sub: `$6.40 of Priya’s $${PG.conn.teamCap} monthly cap is used so far.`, pct: 26, add: 2 });
    if (to === 'codex') pgPush(key, { k: 'cost', id: pgId(), t: 'A small slice of your Codex limit', sub: 'Plenty left today. It resets in 3 hours.', pct: 12, add: 5 });
    PGX.busy[key] = false; pgAll(); }

  /* releasing: a restore point first, then Production, then a look at the live app */
  async function pgRelease(gid) { if (PGX.relRun) return; const s = pgRevState(gid); if (!s.ok || s.released) return; const steps = ['Saving a restore point', 'Copying the change to Production', 'Checking the live app'];
    for (let i = 0; i < steps.length; i++) { PGX.relRun = { t: steps[i], pct: Math.round((i + 1) / steps.length * 100) }; pgPage(); await pgSleep(900); }
    PGX.relRun = null; PG.rel[gid] = true; const rp = pgRp(); PG.relRp = { ...(PG.relRp || {}), [gid]: rp }; if (gid === 'waitlist') PG.wl.phase = 'live';
    pgHist(['release', 'Today, just now', `Released ${pgRevFor(gid)?.t || ''}`, `Restore point ${rp}`, rp]);
    pgPush(gid, { k: 'note', id: pgId(), icon: 'radio', t: `<b>Released to Production</b> just now · restore point ${rp}` }); PGU.env = 'live'; pgSave(); pgAll();
    lToast(pgW(), `Live now. Restore point ${rp} is saved.`, { icon: 'radio' }); setTimeout(() => { PGX.page = null; pgAll(); }, 1300); }

  /* a new project: what do you want to make, three questions, a brief and a recipe, a real folder, a first version */
  async function pgNewStart(text, tk) { const tpl = PGTPL[tk || pgTplFor(text || '')]; PGX.nw = { tpl: tpl.tpl, a: [] }; PG.add.new = []; PGX.newq = ''; pgAll();
    pgPush('new', { k: 'me', id: pgId(), t: text || tpl.ex, at: 'Just now' }); await pgThink('new', 'thinking', 900); PGX.busy.new = false;
    pgPush('new', { k: 'say', id: pgId(), ag: 'ari', dur: '1.2 s', t: ['Lovely idea. Three quick questions, so I make the right thing.'] });
    pgPush('new', { k: 'q', id: 'nq1', n: 1, q: tpl.qs[0][0], opts: tpl.qs[0][1] }); pgBar(); }
  async function pgNewAnswer(id, k) { const tpl = PGTPL[PGX.nw.tpl], it = pgFind('new', id); if (!it || it.picked != null) return; it.picked = k; PGX.nw.a[it.n - 1] = it.opts[k]; pgUpd('new', it); pgSave();
    if (it.n < 3) { await pgSleep(450); const q = tpl.qs[it.n]; pgPush('new', { k: 'q', id: 'nq' + (it.n + 1), n: it.n + 1, q: q[0], opts: q[1], hint: null });
      if (tpl.qs[it.n - 1][2] && it.n === 2) {} return; }
    await pgThink('new', 'putting it together', 1300); PGX.busy.new = false; const p = { n: tpl.n, brief: tpl.brief(PGX.nw.a), recipe: tpl.recipe };
    pgPush('new', { k: 'say', id: pgId(), ag: 'ari', dur: '2.7 s', t: [`Here’s what I’d make. I’ve called it ${tpl.n}, which you can change. Edit anything, or say it looks good.`] });
    pgPush('new', { k: 'brief', id: 'nbrief', p }); await pgSleep(500); pgPush('new', { k: 'recipe', id: 'nrecipe', p, ask: true }); }
  async function pgCreate() { const tpl = PGTPL[PGX.nw.tpl], pid = 'p' + (PG.seq++), items = PG.add.new || [], br = pgFind('new', 'nbrief'), brief = br ? { ...br.p.brief } : tpl.brief(PGX.nw.a);
    $$('#pg-body [data-pgi="nbrief"] dd').forEach((d, i) => { const k = ['what', 'who', 'where', 'good'][i]; if (k && d.textContent.trim()) brief[k] = d.textContent.trim(); });
    const p = { id: pid, tpl: tpl.tpl, n: tpl.n, what: tpl.what, brief: { ...brief }, recipe: tpl.recipe, preview: false, building: false, goals: [{ id: 'ari', t: 'Talk to Ari', chat: true }, { id: 'first', t: 'Get a first version on screen', phase: 'work', by: 'me', began: 'Started by Ari just now' }] };
    PG.projects.push(p); items.forEach(x => { if (x.k === 'recipe') x.ask = false; if (x.k === 'brief') { x.final = true; x.p.brief = { ...brief }; } });
    PG.add[pid + '/ari'] = items; delete PG.add.new; PG.proj = pid; PG.goal[pid] = 'ari'; PG.ag[pid + '/ari'] = 'ari'; PG.ag[pid + '/first'] = 'ari'; PGX.nw = null; pgSave(); pgAll();
    const key = pid + '/ari'; pgPush(key, { k: 'me', id: pgId(), t: 'Looks good, create it.', at: 'Just now' }); await pgThink(key, 'making the folder', 1200); PGX.busy[key] = false;
    pgPush(key, { k: 'reveal', id: pgId(), pid }); pgHist(['agent', 'Just now', `Ari created ${p.n}`, `~/Documents/Playground Projects/${p.n}`]);
    await pgSleep(700); pgPush(key, { k: 'say', id: pgId(), ag: 'ari', dur: '0.9 s', t: ['I’ve started your first goal: get a first version on screen. Watch the Stage.'], chips: [['Get a first version on screen', 'first']] });
    await pgSleep(1800); if (PG.proj === pid) { PG.goal[pid] = 'first'; pgAll(); }
    const fk = pid + '/first'; pgPush(fk, { k: 'note', id: pgId(), icon: 'sparkles', t: `<b>Started from the brief.</b> Ari is working on this computer, in ~/Documents/Playground Projects/${esc(p.n)}` });
    PGX.busy[fk] = true; await pgRunStep(fk, { k: 'step', id: pgId(), title: 'Making the first version', doneT: 'Made the first version', files: [pgF('AGENTS.md', 9, 0, 'A'), pgF('src/routes/+page.svelte', 48, 0, 'A'), pgF('src/lib/server/db.ts', 22, 0, 'A'), pgF('src/app.css', 64, 0, 'A'), pgF('tests/first.test.ts', 18, 0, 'A')], subs: tpl.subs }, 10000, .06,
      i => { if (i === 3) { p.building = true; pgStage(); } });
    p.building = false; p.preview = true; pgSave(); pgStage();
    await pgSleep(500); await pgChecks(fk, { k: 'proof', id: pgId(), pv: pid, at: 'Checked just now', checks: tpl.checks.map(c => [c, 'wait', null]) }, 420);
    pgPush(fk, { k: 'say', id: pgId(), ag: 'ari', dur: '0.8 s', t: [`${p.n} is on screen. Try it on the Stage: it’s the real thing, running on this computer.`] });
    pgPush(fk, { k: 'next', id: pgId(), pn: p.n, items: tpl.next }); p.goals[1].phase = 'done'; PGX.busy[fk] = false; pgSave(); pgAll(); }
  /* after a reload mid-run, finish what was running (quietly) so the goal never sticks half-done */
  function pgResume() { Object.values(PG.add).flat().forEach(it => { if (it.k === 'step' && it.st === 'run') it.st = 'done'; if (it.k === 'proof') it.checks.forEach(c => { if (c[1] === 'run' || c[1] === 'wait') c[1] = 'pass'; }); });
    if (PG.wl.phase === 'build' && PG.wl.choice) { PGX.fast = true; pgWl(PG.wl.choice).finally(() => { PGX.fast = false; }); }
    PG.extra.forEach(g => { if (g.phase === 'work') g.phase = 'review'; }); PG.projects.forEach(p => p.goals.forEach(g => { if (g.phase === 'work' && g.id !== 'first') g.phase = 'done'; })); PG.projects.forEach(p => { p.building = false; if (p.goals[1]?.phase === 'work') { p.goals[1].phase = 'done'; p.preview = true; } }); if (PG.gifts === 'work') PG.gifts = 'done'; if (PG.proj === 'new' && !PGX.nw) { PG.proj = 'kiln'; } pgSave(); }

  /* ── Drawing it all ── */
  function pgAll() { const w = pgW(); if (!w) return; const n = pgNarrow(), c = pgCompact();
    w.classList.toggle('pgph', n); w.classList.toggle('pgcompact', c); w.classList.toggle('pgstageon', (n || c) && PGX.stageOn); w.classList.toggle('pgwide', PGU.wide && !n && !c); w.classList.toggle('pgpageon', !!PGX.page);
    pgTop(); pgSide(); pgMain(); pgStage(); pgBar(); pgPage(); pgSheet(); pgTtl(); pgPickOpen(); segs(); }
  const pgGo = gid => { PG.goal[PG.proj] = gid; PGX.page = null; PGX.pick = false; PGX.point = null; PGX.pointing = false; PGX.stageOn = PGX.stageOn && !pgNarrow(); PGX.kl = { scr: 'home', c: 0 }; PGX.code = { file: null, mode: 'diff' }; PGX.term = []; pgSave(); pgW()?.classList.remove('navopen'); pgAll(); };
  function pgLight(id) { const w = pgW(), key = pgCur(), it = [...pgThread(pgGoal()?.id || ''), ...(PG.add[key] || [])].find(x => x.id === id); if (!it) return; w.querySelector('.pglight')?.remove(); clearInterval(PGX.lightT);
    const frames = it.rec ? [{ k: { scr: 'home' } }, { k: { scr: 'wait', c: 1 } }, { k: { scr: 'waited', c: 1 } }, { k: { scr: 'home' }, notif: true }] : null, np = it.pv && PG.projects.find(p => p.id === it.pv);
    const draw = (f = {}) => np ? pvHTML(np, { dev: 'phone' }) : klHTML({ dev: 'phone', env: 'stage', shot: true, ...(it.scr || {}), ...f });
    w.insertAdjacentHTML('beforeend', `<div class="pglight" data-pglightx><div class="pgshot"><span class="pgshotin">${draw(frames?.[0])}</span></div><span class="pgcapl">${it.rec ? `Recording · ${it.rec} · joining the waitlist, then the offer arriving` : 'Screenshot · Stage, on a phone'} · click to close</span></div>`);
    if (frames) { let i = 0; PGX.lightT = setInterval(() => { const s = w.querySelector('.pglight .pgshotin'); if (!s) { clearInterval(PGX.lightT); return; } i = (i + 1) % frames.length; s.innerHTML = draw(frames[i]); }, 1500); } }
  function pgEvidence(id, k) { const key = pgCur(), it = [...pgThread(pgGoal()?.id || ''), ...(PG.add[key] || [])].find(x => x.id === id); const ev = it?.checks?.[k]?.[2]; if (!ev) return;
    const card = $(`#pg-body [data-pgi="${id}"]`), shot = card?.querySelector('.pgshot'), el = shot?.querySelector(`[data-kp="${ev}"]`); if (!el) { lToast(pgW(), 'This check is proved by a test, not a picture'); return; }
    shot.querySelector('.pghl')?.remove(); const sr = shot.getBoundingClientRect(), r = el.getBoundingClientRect();
    shot.insertAdjacentHTML('beforeend', `<span class="pghl" style="left:${r.left - sr.left - 3}px;top:${r.top - sr.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px"></span>`); setTimeout(() => shot.querySelector('.pghl')?.remove(), 2600); }
  const pgCloseSheet = () => { PGX.sheet = null; PGX.usage = null; PGX.addPlace = null; pgSheet(); pgTop(); };
  function pgOpenSheet(k) { PGX.pick = false; $('#pg-pick')?.remove(); PGX.sheet = k; PGX.usage = null; pgW()?.classList.remove('navopen'); pgSheet(); pgTop(); pgBar(); }

  /* ── Clicks ── */
  function pgClick(e, hit) { const w = pgW(), q = s => hit(s);
    if (q('[data-pglightx]')) { clearInterval(PGX.lightT); q('.pglight').remove(); return true; }
    if (PGX.pick && !q('#pg-pick, .pgexp, [data-pgagentbtn]')) { PGX.pick = false; $('#pg-pick')?.remove(); pgBar(); }
    if (q('[data-pgshx]') || q('#pg-scrim')) { pgCloseSheet(); return true; }
    const sh = q('[data-pgsheet]'); if (sh) { $('#lmenu')?.remove(); pgOpenSheet(sh.dataset.pgsheet); return true; }
    const gg = q('[data-pggoal]'); if (gg) { if (PG.proj === 'new') return true; PGX.sheet = null; pgGo(gg.dataset.pggoal); return true; }
    const pp = q('[data-pgproj]'); if (pp) { PG.proj = pp.dataset.pgproj; PGX.nw = null; PGX.page = null; PGX.sheet = null; pgSave(); w.classList.remove('navopen'); pgAll(); return true; }
    if (q('[data-pgnewproj]')) { PG.proj = 'new'; PGX.nw = null; PG.add.new = []; PGX.page = null; PGX.sheet = null; PGX.stageOn = false; w.classList.remove('navopen'); pgAll(); setTimeout(() => $('#pg-newq')?.focus(), 60); return true; }
    if (q('[data-pgprojmenu]')) { const b = q('[data-pgprojmenu]'); if ($('#lmenu')) { $('#lmenu').remove(); return true; } lMenu(b, `<h6>${esc(pgProj()?.n || '')}</h6>` + crMi('data-pgbook', 'book-open', 'Open the Project book') + crMi('data-pgsheet="places"', 'server', 'Places') + crMi(`data-pgfiler="${esc(pgProj()?.path || '')}"`, 'folder', 'Show in Filer') + '<span class="crsep"></span>' + crMi('data-pgreset', 'rotate-ccw', 'Reset the sample') + ''); return true; }
    if (q('[data-pgreset]')) { $('#lmenu')?.remove(); lConfirm(w, { title: 'Reset the Playground sample?', body: 'Kiln goes back to how it was this morning, and projects you made here are removed. This only affects this preview.', action: 'Reset', icon: 'rotate-ccw', onOK: () => { PG = pgFresh(); PGX.page = null; PGX.sheet = null; PGX.nw = null; PGU.env = 'stage'; pgSave(); pgAll(); lToast(w, 'Back to this morning', { icon: 'rotate-ccw' }); } }); return true; }
    if (q('[data-pgbook]')) { $('#lmenu')?.remove(); if (PG.proj === 'new') return true; PGX.sheet = null; PGX.page = 'book'; PGX.bookAt = 'brief'; w.classList.remove('navopen'); pgAll(); return true; }
    if (q('[data-pgback]')) { PGX.page = null; PGX.relRun = null; pgAll(); return true; }
    const toc = q('[data-pgtoc]'); if (toc) { PGX.bookAt = toc.dataset.pgtoc; $$('.pgtoc button').forEach(b => b.classList.toggle('on', b === toc)); $('#pgb-' + toc.dataset.pgtoc)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    const hf = q('[data-pghf]'); if (hf) { PGX.hist = hf.dataset.pghf; const b = $('#pg-bookb'), y = b?.scrollTop; pgPage(); if ($('#pg-bookb')) $('#pg-bookb').scrollTop = y; return true; }
    const rs = q('[data-pgrestore]'); if (rs) { const rp = rs.dataset.pgrestore; lConfirm(w, { title: `Go back to restore point ${rp}?`, body: 'Production returns to how it was then, code and data together. Bookings made since are kept and carried across. You can come forward again from History.', action: 'Go back', icon: 'rotate-ccw', onOK: () => lToast(w, `Production is back at restore point ${rp}`, { icon: 'rotate-ccw', undo: () => lToast(w, 'Production is up to date again') }) }); return true; }
    if (q('[data-pgknadd]')) { lToast(w, 'Write it in your own words. Every agent reads Knowledge before it starts.', { icon: 'pencil' }); return true; }
    const fl = q('[data-pgfiler]'); if (fl) { $('#lmenu')?.remove(); lToast(w, `Opening ${fl.dataset.pgfiler} in Filer`, { icon: 'folder' }); return true; }
    /* the Stage */
    const dv = q('[data-pgdev]'); if (dv) { PGU.dev = dv.dataset.pgdev; pgSave(); pgStage(); return true; }
    const en = q('[data-pgenv]'); if (en) { PGU.env = en.dataset.pgenv; PGX.kl = { scr: 'home', c: 0 }; pgSave(); pgStage(); return true; }
    if (q('[data-pgwide]')) { PGU.wide = !PGU.wide; pgSave(); pgAll(); return true; }
    if (q('[data-pgstx]')) { PGX.stageOn = false; PGX.pointing = false; pgAll(); return true; }
    if (q('[data-pgstbtn]')) { PGX.stageOn = !PGX.stageOn; pgAll(); return true; }
    if (q('[data-pgonstage]')) { PGU.env = 'stage'; PGX.kl = { scr: 'home', c: 0 }; if (pgNarrow() || pgCompact()) PGX.stageOn = true; pgAll(); return true; }
    if (q('[data-pgpoint]')) { PGX.pointing = !PGX.pointing; pgStage(); if (PGX.pointing) lToast(w, 'Click any part of the app to talk about it', { icon: 'mouse-pointer-click' }); return true; }
    const kp = q('#pg-canvas [data-kp]'); if (kp && PGX.pointing) { e.preventDefault(); PGX.point = kp.dataset.kp; PGX.pointing = false; if (pgNarrow()) PGX.stageOn = false; pgAll(); setTimeout(() => $('#pg-q')?.focus(), 50); return true; }
    if (q('#pg-canvas') && PGX.pointing) return true;
    const kb = q('#pg-canvas [data-klbook]'); if (kb) { PGX.kl = { scr: 'book', c: +kb.dataset.klbook }; pgStage(); return true; }
    const kw = q('#pg-canvas [data-klwait]'); if (kw) { PGX.kl = { scr: 'wait', c: +kw.dataset.klwait }; pgStage(); return true; }
    if (q('#pg-canvas [data-klconfirm]')) { PGX.kl.scr = 'booked'; pgStage(); return true; }
    if (q('#pg-canvas [data-kljoin]')) { PGX.kl.scr = 'waited'; pgStage(); return true; }
    if (q('#pg-canvas [data-klhome]')) { PGX.kl = { scr: 'home', c: 0 }; pgStage(); return true; }
    if (q('#pg-canvas') && ['book', 'wait'].includes(PGX.kl.scr) && !q('.klsheet')) { PGX.kl = { scr: 'home', c: 0 }; pgStage(); return true; }
    if (q('[data-pgrec]')) { if (PGX.rec) { const s = Math.max(1, Math.round((Date.now() - PGX.rec) / 1000)); PGX.rec = 0; pgStage(); const key = pgCur(); pgPush(key, { k: 'note', id: pgId(), icon: 'circle-dot', t: `<b>You recorded ${pgDur(s)} of Stage.</b> It’s attached to this goal, so anyone can watch it.` }); lToast(w, 'Recording saved to this goal', { icon: 'circle-dot' }); }
      else { PGX.rec = Date.now(); pgStage(); } return true; }
    const op = q('[data-pgopen]'); if (op) { if ($('#lmenu')) { $('#lmenu').remove(); return true; } lMenu(op, `<h6>Open ${PGU.env === 'live' ? 'Live' : 'Stage'}</h6>` + crMi('data-pgopenx="viola"', 'globe', `In Viola<small>${PGU.env === 'live' ? 'kiln.studio' : 'Stage, your team only'}</small>`) + crMi('data-pgopenx="qr"', 'qr-code', 'On your phone<small>Scan a code, no app needed</small>') + crMi('data-pgopenx="app"', 'app-window', 'Launch as an app<small>In its own window, as it installs</small>') + (PG.proj === 'kiln' ? '<span class="crsep"></span>' + crMi('data-pgopenx="android"', 'smartphone', 'In the Android emulator<small>On the Dev server</small>') + crMi('data-pgopenx="iphone"', 'smartphone', 'On a cloud iPhone<small>A rented Mac, $0.10 a minute</small>') : '')); return true; }
    const ox = q('[data-pgopenx]'); if (ox) { $('#lmenu')?.remove(); const k = ox.dataset.pgopenx;
      if (k === 'qr') { pgOpenSheet('qr'); return true; } if (k === 'app') { PGU.dev = 'app'; pgSave(); pgStage(); lToast(w, `${pgProj()?.n} opens in its own window, the way it installs on a computer`, { icon: 'app-window' }); return true; }
      lToast(w, { viola: `Opening ${PGU.env === 'live' ? 'kiln.studio' : 'Stage'} in Viola`, android: 'Starting the Android emulator on the Dev server. It takes about 20 seconds.', iphone: 'Renting a Mac for the iPhone simulator. It costs $0.10 a minute until you close it.' }[k], { icon: k === 'viola' ? 'globe' : 'smartphone' }); return true; }
    /* the composer and the picker */
    if (q('[data-pgagentbtn]')) { PGX.pick = !PGX.pick; pgBar(); pgPickOpen(); return true; }
    const pa = q('[data-pgpickag]'); if (pa) { const to = pa.dataset.pgpickag; pgHandoffStart(to); return true; }
    const gv = q('[data-pggive]'); if (gv) { PGX.pick = false; $('#pg-pick')?.remove(); $('#lmenu')?.remove(); pgPush(pgCur(), { k: 'note', id: pgId(), icon: 'users', t: '<b>You offered this goal to Priya.</b> Her agent picks it up on her plan, on her computer, once she says yes.' }); pgBar(); lToast(w, 'Priya gets a note asking if she’ll take it', { icon: 'users' }); return true; }
    if (q('[data-pgsend]')) { const t = $('#pg-q'); if (t?.value.trim()) { const v = t.value; t.value = ''; pgAsk(v); } else t?.focus(); return true; }
    if (q('[data-pgptx]')) { PGX.point = null; pgBar(); return true; }
    if (q('[data-pgattach]')) { lToast(w, 'Choose a file, or drop a screenshot here', { icon: 'paperclip' }); return true; }
    const mg = q('[data-pgmsg]'); if (mg) { lToast(w, 'Opening your conversation with Priya in Messages', { icon: 'message-square' }); return true; }
    if (q('[data-pgpickup]')) { pgHandoffStart('ari', 'priya'); return true; }
    if (q('[data-pgresume]')) { PG.gifts = 'on'; pgPush('gifts', { k: 'note', id: pgId(), icon: 'play', t: '<b>You resumed this</b> just now. The plan is waiting for you.' }); pgSave(); pgAll(); return true; }
    /* cards */
    const op2 = q('[data-pgopt]'); if (op2) { PGX.sel['d' + op2.dataset.pgdec] = op2.dataset.pgopt; const it = pgThread(pgGoal().id).find(x => x.id === op2.dataset.pgdec); const n = $(`#pg-body [data-pgi="${op2.dataset.pgdec}"]`); if (n && it) n.outerHTML = pgItem(it); return true; }
    const dc = q('[data-pgdecide]'); if (dc) { const ch = PGX.sel['d' + dc.dataset.pgdecide]; if (ch) pgWl(ch); return true; }
    if (q('[data-pgdecpick]')) { pgWl('both', 'pick'); return true; }
    const fs = q('[data-pgfiles]'); if (fs) { const k = 'f' + fs.dataset.pgfiles; PGX.sel[k] = !PGX.sel[k]; const id = fs.dataset.pgfiles, it = [...pgThread(pgGoal()?.id || ''), ...(PG.add[pgCur()] || [])].find(x => x.id === id); const n = $(`#pg-body [data-pgi="${id}"]`); if (n && it) n.outerHTML = pgItem(it); return true; }
    const cd = q('[data-pgcode]'); if (cd) { $('#lmenu')?.remove(); PGX.code = { file: cd.dataset.pgcode || null, mode: 'diff', gid: pgGoal()?.id }; PGX.page = 'code'; PGX.sheet = null; pgAll(); return true; }
    if (q('[data-pgterm]')) { PGX.code = { file: null, mode: 'diff', gid: pgGoal()?.id }; PGU.term = true; PGX.page = 'code'; pgAll(); setTimeout(() => $('#pg-termin')?.focus(), 60); return true; }
    const cf = q('[data-pgfile]'); if (cf) { PGX.code.file = cf.dataset.pgfile; pgPage(); return true; }
    const cm = q('[data-pgcmode]'); if (cm) { PGX.code.mode = cm.dataset.pgcmode; pgPage(); return true; }
    if (q('[data-pgtermtog]')) { PGU.term = !PGU.term; pgSave(); pgPage(); return true; }
    const hd = q('[data-pgheads]'); if (hd) { const k = hd.dataset.pgheads, was = PG.heads[k]; PG.heads[k] = !was; pgSave(); pgMain(true); pgStage(); lToast(w, was ? 'Put back' : 'Undone. Code and data are as they were.', { icon: was ? 'rotate-ccw' : 'undo-2', undo: () => { PG.heads[k] = was; pgSave(); pgMain(true); pgStage(); } }); return true; }
    const lt = q('[data-pglight]'); if (lt) { pgLight(lt.dataset.pglight); return true; }
    const ev = q('[data-pgev]'); if (ev) { const [id, k] = ev.dataset.pgev.split(':'); pgEvidence(id, +k); return true; }
    const rv = q('[data-pgreview]'); if (rv) { PGX.revGid = rv.dataset.pgreview; PGX.page = 'review'; PGX.sheet = null; pgAll(); return true; }
    const rl = q('[data-pgrelease]'); if (rl) { pgRelease(rl.dataset.pgrelease); return true; }
    const hg = q('[data-pghogo]'); if (hg) { pgHandoffGo(hg.dataset.pghogo); return true; }
    const hx = q('[data-pghox]'); if (hx) { const it = pgFind(pgCur(), hx.dataset.pghox); if (it) { it.st = 'cancel'; pgSave(); pgMain(true); } return true; }
    const pg = q('[data-pgplango]'); if (pg) { pgPlanGo(pg.dataset.pgplango); return true; }
    if (q('[data-pgplanchg]')) { const t = $('#pg-q'); if (t) { t.value = 'Change the plan: '; t.focus(); PGX.draft[pgCur()] = t.value; } return true; }
    const be = q('[data-pgbriefed]'); if (be) { const k = 'e' + be.dataset.pgbriefed, it = pgFind(pgCur(), be.dataset.pgbriefed); if (PGX.sel[k] && it) $$(`#pg-body [data-pgi="${it.id}"] dd`).forEach((d, i) => { const f = ['what', 'who', 'where', 'good'][i]; if (f) it.p.brief[f] = d.textContent.trim(); }); PGX.sel[k] = !PGX.sel[k]; pgSave(); pgMain(true); return true; }
    const rm = q('[data-pgrecmore]'); if (rm) { const k = 'm' + rm.dataset.pgrecmore; PGX.sel[k] = !PGX.sel[k]; pgMain(true); return true; }
    if (q('[data-pgcreate]')) { pgCreate(); return true; }
    const am = q('[data-pgagents]'); if (am) { const k = 'a' + am.dataset.pgagents; PGX.sel[k] = !PGX.sel[k]; pgMain(true); return true; }
    const qa = q('[data-pgq]'); if (qa) { const [id, k] = qa.dataset.pgq.split(':'); pgNewAnswer(id, +k); return true; }
    const nx = q('[data-pgnext]'); if (nx) { const it = pgFind(pgCur(), nx.dataset.pgi2), [t, d] = it?.items?.[+nx.dataset.pgnext] || []; if (!t) return true; const g = pgMakeGoal(t, d); pgGo(g.id); return true; }
    if (q('[data-pgnewgoal]')) { const g = pgMakeGoal('New goal', null); PG.add[pgKey(g.id)] = [{ k: 'say', id: pgId(), ag: 'ari', t: ['What should this goal do? Say it in a sentence, like “Let Maya cancel a class and tell everyone booked”.'], dur: '0.4 s' }]; g.phase = 'draft'; g.fresh = true; pgGo(g.id); setTimeout(() => $('#pg-q')?.focus(), 60); return true; }
    const ex = q('[data-pgex]'); if (ex) { pgNewStart(PGTPL[ex.dataset.pgex].ex, ex.dataset.pgex); return true; }
    if (q('[data-pgnewgo]')) { const v = $('#pg-newq')?.value.trim(); if (v) pgNewStart(v); else { $('#pg-newq')?.focus(); lToast(w, 'Describe it in a sentence, or pick one of the examples', { icon: 'sparkles' }); } return true; }
    if (q('[data-pgmic]')) { lToast(w, 'Listening… say what you want to make', { icon: 'mic' }); return true; }
    const gm = q('[data-pggmore]'); if (gm) { if ($('#lmenu')) { $('#lmenu').remove(); return true; } const g = pgGoal(); lMenu(gm, crMi('data-pggm="book"', 'book-open', 'Show in the Project book') + crMi('data-pgcode=""', 'code', 'Show the code') + (PG.proj === 'kiln' ? crMi('data-pggive="PR"', 'users', 'Give to Priya') : '') + '<span class="crsep"></span>' + crMi('data-pggm="pause"', 'pause', g.id === 'gifts' && PG.gifts === 'paused' ? 'Resume this goal' : 'Pause this goal')); return true; }
    const gmi = q('[data-pggm]'); if (gmi) { $('#lmenu')?.remove(); if (gmi.dataset.pggm === 'book') { PGX.page = 'book'; PGX.bookAt = 'goals'; pgAll(); setTimeout(() => $('#pgb-goals')?.scrollIntoView({ block: 'start' }), 50); } else lToast(w, 'Paused. Nothing runs until you resume it.', { icon: 'pause', undo: () => lToast(w, 'Running again') }); return true; }
    /* sheets */
    const hm = q('[data-pghome]'); if (hm) { PG.home = hm.dataset.pghome; pgSave(); pgSheet(); return true; }
    if (q('[data-pgaddplace]')) { PGX.addPlace = PGX.addPlace ? null : 'ari'; pgSheet(); return true; }
    const amd = q('[data-pgaddmode]'); if (amd) { PGX.addPlace = amd.dataset.pgaddmode; pgSheet(); return true; }
    if (q('[data-pgaddgo]')) { const mode = PGX.addPlace; PGX.addPlace = null; PG.places.push({ id: 'p' + PG.seq++, n: 'Test server', sub: 'A spare machine · 203.0.113.9', role: 'Preview', icon: 'server', st: 'on', up: 'Connected just now', does: 'Ari checked it: 16 GB of memory, room for the app and an Android emulator.' }); pgSave(); pgSheet();
      lToast(w, mode === 'ari' ? 'Ari connected to 203.0.113.9 and set it up as a preview place' : 'Connected. Everyone on Kiln gets in with their own certificate', { icon: 'server' }); return true; }
    const ac = q('[data-pgaccess]'); if (ac) { const k = ac.dataset.pgaccess, on = PG.access[k] !== false; PG.access[k] = !on; pgSave(); pgSheet(); const n = pgFirst(k);
      lToast(w, on ? `${n} can no longer get into the Dev server, Production or the emulator` : `${n} is back in. A new certificate was issued`, { icon: on ? 'lock' : 'key-round', undo: () => { PG.access[k] = on; pgSave(); pgSheet(); } }); return true; }
    const ir = q('[data-pginvrole]'); if (ir) { PGX.invRole = ir.dataset.pginvrole; const v = $('#pg-invq')?.value; pgSheet(); if ($('#pg-invq')) $('#pg-invq').value = v || ''; return true; }
    if (q('[data-pginvite]')) { const v = $('#pg-invq')?.value.trim(); if (!v) { $('#pg-invq')?.focus(); lToast(w, 'Type a Luma Connect name or an email', { icon: 'user-plus' }); return true; } PG.members.push({ n: v.replace(/@.*/, '').replace(/^\w/, c => c.toUpperCase()), role: PGX.invRole || 'Builder' }); pgSave(); pgSheet(); lToast(w, `Invited. They’ll get the full app and an invitation`, { icon: 'user-plus' }); return true; }
    const rb = q('[data-pgrolebtn]'); if (rb) { const k = rb.dataset.pgrolebtn; if ($('#lmenu')) { $('#lmenu').remove(); return true; } lMenu(rb, `<h6>${esc(pgFirst(k))}’s role</h6>` + ['Builder', 'Reviewer', 'Viewer'].map(r => crMi(`data-pgsetrole="${k}:${r}"`, '', `${r}<small>${PGROLES[r]}</small>`)).join('') + '<span class="crsep"></span>' + crMi(`data-pgaccess="${k}"`, 'lock', 'Take away access', ' red')); return true; }
    const sr = q('[data-pgsetrole]'); if (sr) { $('#lmenu')?.remove(); const [k, r] = sr.dataset.pgsetrole.split(':'); const m = PGPEOPLE.find(x => x.k === k); if (m) m.role = r; pgSheet(); lToast(w, `${pgFirst(k)} is now a ${r}`, { icon: 'users' }); return true; }
    if (q('[data-pglook]')) { PG.look = !PG.look; pgSave(); pgSheet(); return true; }
    if (q('[data-pgcopy]')) { lToast(w, 'Link copied', { icon: 'copy' }); return true; }
    const us = q('[data-pgusage]'); if (us) { PGX.usage = us.dataset.pgusage; pgSheet(); return true; }
    if (q('[data-pgusageback]')) { PGX.usage = null; pgSheet(); return true; }
    const cn = q('[data-pgconn]'); if (cn) { const k = cn.dataset.pgconn; PG.conn[k] = !PG.conn[k]; pgSave(); pgSheet(); if (k === 'claudeTeam') lToast(w, PG.conn.claudeTeam ? `Your Claude now picks up team tasks, up to ${PG.conn.claudeCap}% of your week` : 'Your Claude works only on your own goals again', { icon: 'users' }); return true; }
    const wh = q('[data-pgwh]'); if (wh) { const [id, v] = wh.dataset.pgwh.split(':'); if (id === 'team' || id === 'ari') { lToast(w, id === 'team' ? 'Only Priya can move the team key. It lives on the Dev server so it works while laptops are closed.' : 'Ari runs wherever you are. Its tools run in the project’s home.', { icon: 'info' }); return true; }
      PG.conn[id + 'Where'] = v; pgSave(); pgSheet(); lToast(w, v === 'dev' ? `${PGAG[id].n} moved to the Dev server` : `${PGAG[id].n} runs on this computer again`, { icon: v === 'dev' ? 'server' : 'house' }); return true; }
    return false; }

  /* ── Typing ── */
  document.addEventListener('input', e => { const t = e.target; if (!t.closest?.('#w-playground')) return;
    if (t.id === 'pg-q') { PGX.draft[pgCur()] = t.value; pgAuto(); $('#w-playground .pgsend')?.classList.toggle('on', !!t.value.trim()); }
    if (t.id === 'pg-newq') PGX.newq = t.value;
    if (t.matches('[data-pgcap]')) { PG.conn[t.dataset.pgcap] = +t.value; const b = t.parentElement.querySelector('b'); if (b) b.textContent = t.dataset.pgcap === 'teamCap' ? '$' + t.value : t.value + '%'; pgSave(); } });
  document.addEventListener('keydown', e => { const t = e.target, w = pgW(); if (!w || w.hidden) return;
    if (t.closest?.('#w-playground')) {
      if (t.id === 'pg-q' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = t.value; if (v.trim()) { t.value = ''; pgAsk(v); } return; }
      if (t.id === 'pg-newq' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (t.value.trim()) pgNewStart(t.value.trim()); return; }
      if (t.id === 'pg-termin' && e.key === 'Enter') { e.preventDefault(); pgTermRun(t.value); return; }
      if (t.id === 'pg-invq' && e.key === 'Enter') { e.preventDefault(); w.querySelector('[data-pginvite]')?.click(); return; }
      if (t.id === 'pg-placeq' && e.key === 'Enter') { e.preventDefault(); w.querySelector('[data-pgaddgo]')?.click(); return; } }
    if (e.key !== 'Escape' || e.defaultPrevented || $('#lc, #lmenu')) return; if (front() !== w) return;
    if (w.querySelector('.pglight')) { w.querySelector('.pglight').remove(); clearInterval(PGX.lightT); return; }
    if (PGX.pick) { PGX.pick = false; $('#pg-pick')?.remove(); pgBar(); return; } if (PGX.pointing) { PGX.pointing = false; pgStage(); return; }
    if (PGX.sheet) { pgCloseSheet(); return; } if (PGX.page) { PGX.page = null; pgAll(); return; } if (PGX.stageOn) { PGX.stageOn = false; pgAll(); } });

  function renderPlayground() { const w = pgW(); if (!w) return; PGX.t0 = PGX.tick = Date.now(); pgResume(); pgAll();
    w.querySelector('#pg-body')?.setAttribute('data-phsc', '1');
    let sig = ''; setInterval(() => { if (w.hidden || !w.clientWidth) return; const s = `${pgNarrow()}${pgCompact()}`; if (s !== sig) { const first = !sig; sig = s; if (!first) { PGX.pick = false; } pgAll(); } else pgFit(); }, 400);
    setInterval(() => { PGX.tick = Date.now(); if (w.hidden || !w.clientWidth) return;
      if (PGX.rec) { const b = w.querySelector('[data-pgrec] b'); if (b) b.textContent = pgDur((Date.now() - PGX.rec) / 1000); }
      if (PG.proj === 'kiln' && pgGoal()?.id === 'texts' && !PGX.page) { const n = $('#pg-body [data-pgi="tx-s1"]'), it = pgBase('texts').find(x => x.id === 'tx-s1'); if (n && it && (PGX.tick / 1000 | 0) % 5 === 0) n.outerHTML = pgItem(it); } }, 1000);
    w.addEventListener('luma-phone', () => setTimeout(() => { PGX.stageOn = false; pgAll(); }, 80));
    /* on a phone, Playground sits on the home screen with the other apps (the shell draws its grid from its own list, so add the tile once it exists) */
    /* not in the website's showcase preview (?showcase=1, Nick 14 Oct 2026) */
    if (!QS.has('showcase')) { let n = 0; const t = setInterval(() => { const g = document.getElementById('lphone')?.shadowRoot?.querySelector('#grid'); if (g && !g.querySelector('[data-open="playground"]')) { const a = g.querySelector('[data-open="ari"]') || g.lastElementChild; a?.insertAdjacentHTML('beforebegin', `<button class="app" data-open="playground"><i class="ic" style="background-image:url(&quot;${PGICON}&quot;)"></i><span>Playground</span></button>`); } if (g || ++n > 80) clearInterval(t); }, 250); }
    /* ?phone=1&app=playground opens it straight away on the phone */
    /* ?phone=1&app=<id> opens that app on the phone straight away (any app; the Design Center's app matrix relies on it) */
    if (QS.get('phone') && QS.get('app') && document.getElementById('w-' + QS.get('app'))) { const want = QS.get('app'); let n = 0; const t = setInterval(() => { if (window.lumaPhone && document.getElementById('lphone')) { clearInterval(t); setTimeout(() => { window.lumaPhone.open(want); markReady(900); }, 300); } else if (++n > 80) clearInterval(t); }, 100); } }



  /* ══ YouTube ══════════════════════════════════════════════════════════════
     A YouTube client: browse (Home, Subscriptions, a channel, search), keep (Watch later,
     History, Liked, playlists) and watch. One player state for the whole app, so a video
     keeps playing in the bar while you browse. */
  const YLP = '../social-suno/launch/photos/';
  const YCH = {
    field: { n: 'Field Notes', h: '@fieldnotes', av: [PH + 'life-ari-street.webp', '55% 16%'], subs: '1.24M', ban: [PH + 'life-suite-bg-darkroom.webp', '50% 45%'], about: 'Photography on foot and on film. A new walk every other Sunday.', v: 1 },
    sess: { n: 'Studio Sessions', h: '@studiosessions', av: [YLP + 'studio-suite.webp', '42% 22%'], subs: '612K', ban: [PH + 'life-suite-bg-sessions.webp', '50% 40%'], about: 'Live music from small rooms. No overdubs, no second takes.', v: 1 },
    grain: { n: 'Pixel & Grain', h: '@pixelandgrain', av: [YLP + 'gaming.webp', '50% 22%'], subs: '388K', ban: [PH + 'life-suite-bg-reel.webp', '50% 50%'], about: 'Small crews, cheap cameras, real light.' },
    north: { n: 'Northbound', h: '@northbound', av: [YLP + 'hero-move.webp', '58% 18%'], subs: '842K', ban: [YLP + 'desktop-office.webp', '50% 45%'], about: 'Working from wherever the road ends.', v: 1 },
    ari: { n: 'Ari Moreno', h: '@arimoreno', av: [YLP + 'designers-studio.webp', '40% 22%'], subs: '254K', ban: [PH + 'life-suite-bg-canvas.webp', '50% 50%'], about: 'Painting, sketchbooks and the slow parts of making things.' },
    kernel: { n: 'Kernel Panic', h: '@kernelpanic', av: [PH + 'life-work-suite.webp', '42% 26%'], subs: '1.9M', ban: [PH + 'life-ledge-blog-1.webp', '50% 40%'], about: 'Computers, explained for people who just want them to work.', v: 1 },
    kitchen: { n: 'Small Kitchen', h: '@smallkitchen', av: [YLP + 'tablet-cafe.webp', '50% 40%'], subs: '97K', ban: [PH + 'life-hero-home.webp', '50% 50%'], about: 'Weeknight cooking for two, and bread on Sundays.' },
    coop: { n: 'Couch Co-op', h: '@couchcoop', av: [YLP + 'gamers-evening.webp', '55% 30%'], subs: '431K', ban: [YLP + 'gamers-evening.webp', '50% 40%'], about: 'Games to play with the people on your sofa.' },
    build: { n: 'The Long Build', h: '@thelongbuild', av: [YLP + 'creatives-painter.webp', '50% 25%'], subs: '176K', ban: [YLP + 'scene-tablet-print.webp', '50% 50%'], about: 'Workshops, studios and the people who keep them.' },
    luma: { n: 'Luma', h: '@simplyluma', logo: '../social-suno/brand/luma-logo-light.svg', subs: '48.2K', ban: [YLP + 'hero-field.webp', '50% 50%'], about: 'A better computer. Free and open source.', v: 1 },
  };
  /* id, channel, title, picture, position, length (s), views, when, hue, watched (0..1) */
  const YV = [
    ['shore', 'field', 'The north shore, on one lens and one tank of gas', PH + 'life-suite-bg-darkroom.webp', '50% 45%', 1120, '1.2M views', '3 days ago', 205, .64],
    ['live', 'sess', 'Saturday live set from the loft', PH + 'life-suite-bg-sessions.webp', '50% 40%', 0, '2.4K watching', 'Live', 25, 0],
    ['skate', 'grain', 'Golden hour skate film on a $300 camera', PH + 'life-suite-bg-reel.webp', '50% 55%', 401, '486K views', '1 week ago', 40, 0],
    ['desert', 'north', 'A month in a borrowed office in Lisbon. What I’d keep', YLP + 'desktop-office.webp', '50% 45%', 962, '2.1M views', '2 weeks ago', 30, 1],
    ['paint', 'ari', 'Painting at full scale: the whole process, no cuts', PH + 'life-suite-bg-canvas.webp', '50% 50%', 1491, '212K views', '5 days ago', 15, .2],
    ['linux', 'kernel', 'What actually is Linux? Explained over one coffee', PH + 'life-ledge-blog-1.webp', '50% 40%', 552, '3.4M views', '1 month ago', 250, 0],
    ['bread', 'kitchen', 'A sourdough schedule that fits a working week', PH + 'life-hero-home.webp', '50% 50%', 870, '88K views', '4 days ago', 45, 0],
    ['coop', 'coop', 'Ten couch co-op games you can finish in a weekend', YLP + 'gamers-evening.webp', '50% 40%', 1267, '640K views', '6 days ago', 285, 0],
    ['song', 'sess', 'Writing a song from a voice memo, start to finish', YLP + 'studio-suite.webp', '45% 35%', 1878, '301K views', '2 weeks ago', 300, .35],
    ['sketch', 'ari', 'My sketchbook system, two years in', YLP + 'designers-studio.webp', '45% 40%', 728, '154K views', '3 weeks ago', 330, 0],
    ['luma', 'luma', 'A better computer. Luma, in two minutes.', YLP + 'hero-field.webp', '50% 50%', 124, '96K views', '2 weeks ago', 140, 1],
    ['cafe', 'north', 'The best café to work from in every city I’ve lived in', YLP + 'tablet-cafe.webp', '50% 50%', 824, '1.1M views', '1 month ago', 35, 0],
    ['riso', 'build', 'Inside a risograph print shop', YLP + 'scene-tablet-print.webp', '50% 50%', 1166, '203K views', '1 week ago', 335, 0],
    ['hand', 'coop', 'Is a $200 handheld enough for everything?', YLP + 'gaming.webp', '50% 35%', 711, '922K views', '2 days ago', 230, 0],
    ['sync', 'kernel', 'Your files on every device, without the cloud company', PH + 'life-sync-terrace.webp', '50% 40%', 510, '1.7M views', '5 days ago', 200, 0],
    ['family', 'kernel', 'I moved my whole family to Linux. Six months later', PH + 'life-work-suite.webp', '45% 35%', 1360, '2.8M views', '3 weeks ago', 225, 0],
    ['light', 'grain', 'Lighting a small studio for under $500', PH + 'life-suite-bg-stage.webp', '50% 40%', 1029, '377K views', '2 weeks ago', 20, 0],
    ['loft', 'build', 'A loft office, built in one weekend', YLP + 'professionals-loft.webp', '50% 45%', 933, '512K views', '1 month ago', 40, 0],
    ['film', 'field', 'Film photography for absolute beginners', YLP + 'students.webp', '50% 40%', 1562, '760K views', '2 months ago', 120, 0],
    ['wall', 'grain', 'The wall: a two-year time-lapse', YLP + 'scene-laptop-skate.webp', '50% 50%', 298, '1.4M views', '4 months ago', 10, 0],
    ['desk', 'ari', 'Writing by hand again, after ten years of typing', PH + 'life-hero-writing.webp', '50% 45%', 694, '118K views', '1 week ago', 50, 0],
    ['field', 'north', 'A desk in the middle of a field', PH + 'life-footer.webp', '50% 55%', 402, '233K views', '2 days ago', 110, 0],
  ].map(([id, ch, t, img, pos, d, views, ago, h, w]) => ({ id, ch, t, img, pos, d, views, ago, h, w }));
  const YSHORT = [['Three ways to hold a camera still', 'take-back', '2.1M', 'field', PH], ['Folding a week of laundry in 40 s', 'cut-phone-laundromat', '890K', 'kitchen', YLP], ['Walking a city with no plan', 'hero-move', '4.4M', 'north', YLP],
    ['Street portraits, asking first', 'ari-street', '1.3M', 'field', YLP], ['Mixing a colour from memory', 'creatives', '610K', 'ari', YLP], ['A building that looks back', 'mobile-plaza', '305K', 'north', YLP]];
  const YCHAP = { shore: [[0, 'Before light'], [102, 'The drive north'], [250, 'First light'], [475, 'One lens, why'], [740, 'The cove'], [990, 'Packing up']],
    paint: [[0, 'Stretching the canvas'], [310, 'Blocking in'], [820, 'The long middle'], [1210, 'Finishing']], song: [[0, 'The memo'], [420, 'Chords'], [980, 'The take'], [1500, 'Mix']],
    default: [[0, 'Intro'], [.22, 'Part one'], [.5, 'Part two'], [.8, 'Wrapping up']] };
  const YCC = { shore: ['I left at four so I’d get there before the light did.', 'Everything in this video is one lens. A 35.', 'You learn a place faster when you can’t zoom.', 'The cove only works for about twenty minutes.', 'That’s the shot. Time to go home.'] };
  const YCOM = [['kernel', 'Kernel Panic', '2 days ago', 'The bit at 7:55 about why one lens slows you down in a good way is the best explanation I’ve heard.', '1.8K', 1],
    ['ari', 'Ari Moreno', '3 days ago', 'The colour of that first light. I paused it just to look.', '942', 0], ['north', 'Northbound', '3 days ago', 'Same coast, different month. You picked the right one.', '611', 0],
    ['grain', 'Pixel & Grain', '1 day ago', 'Shot list for the cove please. Asking for a friend who is me.', '208', 0]];
  const YMOD = { view: 'home', back: [], cur: 'shore', t: 0, playing: false, chip: 'All', theater: false, cc: false, vol: 70, speed: 1, autoplay: true, desc: false, sort: 'top', q: '',
    later: ['paint', 'song', 'riso', 'film', 'light'], liked: new Set(['desert', 'luma', 'shore']), disliked: new Set(), subs: new Set(['field', 'sess', 'kernel', 'north', 'ari', 'grain', 'luma']),
    queue: [], hist: true, composing: false, comment: '', dl: {}, mine: [], bell: new Set(['field']), ctab: 'videos' };
  const YT = YMOD;
  YT.t = Math.round(YV[0].d * YV[0].w);
  const yv = id => YV.find(v => v.id === id), ych = k => YCH[k];
  const yWin = () => $('#w-youtube'), yNarrow = () => (yWin()?.clientWidth || 999) < 560;
  const yFmt = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  const yAv = (k, cls = '') => { const c = ych(k); return c.logo ? `<i class="yav logo ${cls}" style="background-image:url(${c.logo})"></i>` : `<i class="yav ${cls}" style="background-image:url(${c.av[0]});background-position:${c.av[1]}"></i>`; };
  const yVer = k => ych(k).v ? `<i class="ytver" title="Verified">${ic('badge-check')}</i>` : '';
  const yChaps = v => { const c = YCHAP[v.id] || YCHAP.default; return c.map(([s, n]) => [s < 1 && s > 0 ? Math.round(s * v.d) : s, n]); };
  const yChapAt = (v, t) => { const c = yChaps(v); let r = c[0]; c.forEach(x => { if (t >= x[0]) r = x; }); return r; };
  const yThumb = (v, o = {}) => `<span class="ytth"><img src="${v.img}" alt="" style="object-position:${v.pos}" loading="lazy">${v.d ? `<em class="dur">${yFmt(v.d)}</em>` : '<em class="dur live">LIVE</em>'}${v.w > 0 && v.w < 1 && !o.noProg ? `<span class="pg"><i style="width:${v.w * 100}%"></i></span>` : ''}${o.hov === false ? '' : `<span class="hov"><button type="button" class="${YT.later.includes(v.id) ? 'on' : ''}" data-ytlater="${v.id}" aria-label="Watch later" title="Watch later">${ic(YT.later.includes(v.id) ? 'check' : 'clock')}</button><button type="button" data-ytqueue="${v.id}" aria-label="Add to queue" title="Add to queue">${ic('list-plus')}</button></span><i class="skim"></i>`}</span>`;
  const yCard = v => `<div class="ytcard" role="button" tabindex="0" data-ytplay="${v.id}">${yThumb(v)}<span class="ytmeta"><button type="button" data-ytchan="${v.ch}" aria-label="${esc(ych(v.ch).n)}">${yAv(v.ch)}</button><span><b>${esc(v.t)}</b><span><button type="button" data-ytchan="${v.ch}">${esc(ych(v.ch).n)}</button>${yVer(v.ch)}<br>${v.views} · ${v.ago}</span></span></span></div>`;
  const yRow = (v, o = {}) => `<div class="ytrow" role="button" tabindex="0" data-ytplay="${v.id}">${o.n ? `<span class="n">${o.n}</span>` : ''}${yThumb(v, { hov: false })}<span class="tx"><b>${esc(v.t)}</b>${o.compact ? `<span class="by">${esc(ych(v.ch).n)}${yVer(v.ch)}</span><span class="s">${v.views} · ${v.ago}</span>` : `<span class="s">${v.views} · ${v.ago}</span><span class="by">${yAv(v.ch)}${esc(ych(v.ch).n)}${yVer(v.ch)}</span>${o.desc ? `<p>${esc(ych(v.ch).about)}</p>` : ''}`}</span>${o.more ? `<button class="ib" type="button" data-ytrowmore="${v.id}" data-lmenu aria-label="More">${ic('ellipsis')}</button>` : ''}</div>`;
  const YCHIPS = ['All', 'Music', 'Photography', 'Linux', 'Design', 'Cooking', 'Gaming', 'Live', 'New to you'];
  const YCHIPK = { Music: ['sess'], Photography: ['field', 'grain'], Linux: ['kernel', 'luma'], Design: ['ari', 'build'], Cooking: ['kitchen'], Gaming: ['coop'], Live: [], 'New to you': ['build', 'kitchen', 'coop'] };
  const yFiltered = () => YT.chip === 'All' ? YV : YT.chip === 'Live' ? YV.filter(v => !v.d) : YV.filter(v => (YCHIPK[YT.chip] || []).includes(v.ch));
  const YPL = { later: { n: 'Watch later', ids: () => YT.later }, liked: { n: 'Liked videos', ids: () => [...YT.liked] }, road: { n: 'Road trip', ids: () => ['desert', 'cafe', 'field', 'shore'] }, learn: { n: 'Learn Linux', ids: () => ['linux', 'sync', 'family', 'luma'] } };
  const YPLACES = [['home', 'Home', 'house'], ['shorts', 'Shorts', 'clapperboard'], ['subs', 'Subscriptions', 'list-video']];
  const YYOU = [['history', 'History', 'history'], ['pl:later', 'Watch later', 'clock'], ['pl:liked', 'Liked videos', 'thumbs-up'], ['downloads', 'Downloads', 'arrow-down-to-line']];
  const yTitle = v => v === 'home' ? 'Home' : v === 'shorts' ? 'Shorts' : v === 'subs' ? 'Subscriptions' : v === 'history' ? 'History' : v === 'downloads' ? 'Downloads' : v === 'search' ? `“${YT.q}”` : v.startsWith('pl:') ? YPL[v.slice(3)].n : v.startsWith('ch:') ? ych(v.slice(3)).n : v === 'watch' ? (yv(YT.cur)?.t || 'Video') : '';

  function ytSide() {
    const row = ([k, n, i]) => `<button class="si${YT.view === k ? ' on' : ''}" type="button" data-ytgo="${k}">${ic(i)}<span class="lab">${n}</span>${k === 'pl:later' ? `<em>${YT.later.length}</em>` : k === 'downloads' && Object.keys(YT.dl).length ? `<em>${Object.keys(YT.dl).length}</em>` : ''}</button>`;
    const subs = [...YT.subs].map(k => [k, ych(k)]);
    $('#yt-side').innerHTML = `<div class="scr">${YPLACES.map(row).join('')}<div class="sh">You</div>${YYOU.map(row).join('')}
      <div class="sh">Playlists<button class="ib" type="button" data-ytnewpl aria-label="New playlist" title="New playlist">${ic('plus')}</button></div>${[['pl:road', 'Road trip', 'list-video'], ['pl:learn', 'Learn Linux', 'list-video']].map(row).join('')}
      <div class="sh">Subscriptions</div>${subs.map(([k, c]) => `<button class="si${YT.view === 'ch:' + k ? ' on' : ''}" type="button" data-ytgo="ch:${k}">${yAv(k)}<span class="lab">${esc(c.n)}</span>${k === 'sess' ? '<em class="ytlv">LIVE</em>' : ['field', 'ari', 'grain'].includes(k) ? '<i class="ytnew" title="New videos"></i>' : ''}</button>`).join('')}</div>
      <button class="tstatus" type="button" title="Your history, likes and playlists stay on this computer"><i class="stat"></i><span class="tx">Signed in as @nick</span></button>`;
  }

  function ytHome() {
    const hero = yv('shore'), ht = YT.cur === 'shore' ? YT.t : hero.d * hero.w, left = hero.d - ht, list = yFiltered().filter(v => v.id !== 'shore');
    return `<div class="ytpage">${YT.chip === 'All' ? `<button class="ythero" type="button" data-ytplay="shore"><img src="${hero.img}" alt="" style="object-position:${hero.pos}"><span class="tx"><span class="by">${yAv(hero.ch)}${esc(ych(hero.ch).n)}</span><h2>${esc(hero.t)}</h2><div class="mt">${hero.views} · ${hero.ago}</div>
        <div class="pr"><span class="lprog"><i style="width:${ht / hero.d * 100}%"></i></span>${yFmt(left)} left</div>
        <div class="acts"><span class="bt pri" data-ytplay="shore">${ic('play')}Resume</span><span class="bt" data-ytlater="shore">${ic(YT.later.includes('shore') ? 'check' : 'clock')}${YT.later.includes('shore') ? 'Saved' : 'Watch later'}</span></div></span></button>` : ''}
      <div class="ytchips" role="tablist">${YCHIPS.map(c => `<button type="button" role="tab" aria-selected="${YT.chip === c}" class="${YT.chip === c ? 'on' : ''}" data-ytchip="${c}">${c}</button>`).join('')}</div>
      ${list.length ? `<div class="ytgrid">${list.slice(0, 8).map(yCard).join('')}</div>` : '<div class="ytsec"><span>Nothing here yet.</span></div>'}
      ${YT.chip === 'All' ? `<div class="ytsec"><b>Shorts</b><button class="ytmore" type="button" data-ytgo="shorts">See all</button></div><div class="ytshorts">${YSHORT.map(([t, img, n, ch, base]) => `<button class="ytshort" type="button" data-ytshort><img src="${base}${img}.webp" alt=""><b>${esc(t)}</b><span>${n} views</span></button>`).join('')}</div>
        <div class="ytsec"><b>From your subscriptions</b><span>New this week</span></div><div class="ytgrid">${list.slice(8, 16).map(yCard).join('')}</div>` : list.length > 8 ? `<div class="ytgrid" style="margin-top:30px">${list.slice(8).map(yCard).join('')}</div>` : ''}</div>`;
  }
  function ytSubs() {
    const mine = YV.filter(v => YT.subs.has(v.ch)), g = [['Today', mine.slice(0, 4)], ['This week', mine.slice(4, 10)], ['Earlier', mine.slice(10)]];
    return `<div class="ytpage"><h1>Subscriptions</h1><div class="ytppl">${[...YT.subs].map(k => `<button type="button" class="${k === 'sess' ? 'live' : ['field', 'ari', 'grain'].includes(k) ? 'new' : ''}" data-ytgo="ch:${k}">${yAv(k)}${k === 'sess' ? '<em class="ytlive">LIVE</em>' : ''}<span>${esc(ych(k).n)}</span></button>`).join('')}</div>
      ${g.filter(x => x[1].length).map(([n, l]) => `<div class="ytsec"><b>${n}</b></div><div class="ytgrid">${l.map(yCard).join('')}</div>`).join('')}</div>`;
  }
  function ytShorts() {
    return `<div class="ytpage"><h1>Shorts</h1><div class="ytgrid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${[...YSHORT, ...YSHORT.slice().reverse()].map(([t, img, n, ch, base]) => `<button class="ytshort" type="button" data-ytshort><img src="${base}${img}.webp" alt=""><b>${esc(t)}</b><span>${n} views · ${esc(ych(ch).n)}</span></button>`).join('')}</div></div>`;
  }
  function ytHistory() {
    const seen = ['shore', 'desert', 'luma', 'song', 'paint', 'linux', 'skate', 'cafe'].map(yv), q = YT.hq || '', f = seen.filter(v => !q || (v.t + ych(v.ch).n).toLowerCase().includes(q.toLowerCase()));
    const g = [['Today', f.slice(0, 3)], ['Yesterday', f.slice(3, 5)], ['Monday', f.slice(5)]];
    return `<div class="ytpage"><h1>History</h1><div class="ythist"><label class="srch keep">${ic('search')}<input placeholder="Search watch history" data-ythq value="${esc(q)}" aria-label="Search watch history"></label><span class="sp"></span>
      <button class="hpause" type="button" data-ythist role="switch" aria-checked="${YT.hist}"><span>Keep watch history</span><i class="cfsw${YT.hist ? ' on' : ''}"></i></button><button class="bt" type="button" data-ytclear>${ic('trash-2')}Clear all</button></div>
      <div class="ytrows">${g.filter(x => x[1].length).map(([n, l]) => `<div class="ytday">${n}</div>${l.map(v => yRow(v, { desc: true, more: true })).join('')}`).join('') || '<div class="ytday">No videos match.</div>'}</div></div>`;
  }
  function ytDownloads() {
    const ids = Object.keys(YT.dl);
    return `<div class="ytpage"><h1>Downloads</h1>${ids.length ? `<div class="ytrows">${ids.map(id => yRow(yv(id), { more: true })).join('')}</div>` : `<div class="ytsec"><span>Videos you download play without a connection. Download one from the bar while you watch.</span></div>`}</div>`;
  }
  function ytPlaylist(k) {
    const P = YPL[k], ids = P.ids(), vs = ids.map(yv).filter(Boolean), first = vs[0] || yv('shore'), tot = vs.reduce((a, v) => a + v.d, 0);
    return `<div class="ytpage"><div class="ytpl"><aside class="ytplc" style="--pi:url(${first.img})">${yThumb(first, { hov: false, noProg: true })}<h2>${esc(P.n)}</h2><div class="mt">Nick McMillen · ${vs.length} video${vs.length === 1 ? '' : 's'} · ${Math.round(tot / 60)} minutes</div>
      <div class="acts"><button class="bt pri" type="button" data-ytplay="${first.id}" data-ytplall="${k}">${ic('play')}Play all</button><button class="bt" type="button" data-ytshuffle="${k}">${ic('shuffle')}Shuffle</button><button class="ib" type="button" data-share aria-label="Share playlist" title="Share">${ic('share-2')}</button></div></aside>
      <div class="ytpll ytrows">${vs.map((v, i) => yRow(v, { n: i + 1, compact: true, more: true })).join('') || '<div class="ytday">Nothing saved yet. Use the clock on any video.</div>'}</div></div></div>`;
  }
  function ytChannel(k) {
    const c = ych(k), vs = YV.filter(v => v.ch === k), sub = YT.subs.has(k);
    return `<div class="ytpage"><div class="ytbanner"><img src="${c.ban[0]}" alt="" style="object-position:${c.ban[1]}"></div>
      <div class="ytchead">${yAv(k)}<div><h2>${esc(c.n)}${yVer(k)}</h2><div class="mt">${c.h} · ${c.subs} subscribers · ${vs.length} videos</div><p>${esc(c.about)}</p></div><span class="sp"></span>${ytSubBtn(k)}</div>
      <div class="ytctabs"><div class="seg" role="tablist"><i class="ind"></i>${[['videos', 'Videos'], ['shorts', 'Shorts'], ['live', 'Live'], ['about', 'About']].map(([x, n]) => `<button type="button" class="${YT.ctab === x ? 'on' : ''}" data-ytctab="${x}">${n}</button>`).join('')}</div></div>
      ${YT.ctab === 'about' ? `<div class="ytdesc">${esc(c.about)}<br><br>Joined March 2019 · ${c.subs} subscribers · ${vs.length} videos</div>` : YT.ctab === 'shorts' ? `<div class="ytshorts">${YSHORT.filter(s => s[3] === k).concat(YSHORT.slice(0, 2)).map(([t, img, n, ch, base]) => `<button class="ytshort" type="button" data-ytshort><img src="${base}${img}.webp" alt=""><b>${esc(t)}</b><span>${n} views</span></button>`).join('')}</div>` : `<div class="ytgrid">${(YT.ctab === 'live' ? vs.filter(v => !v.d) : vs).map(yCard).join('') || '<div class="ytsec"><span>Nothing live right now.</span></div>'}</div>`}</div>`;
  }
  function ytSearch() {
    const q = YT.q.toLowerCase(), words = q.split(/\s+/).filter(Boolean), score = v => words.reduce((a, w) => a + ((v.t + ' ' + ych(v.ch).n).toLowerCase().includes(w) ? 1 : 0), 0);
    const res = YV.map(v => [v, score(v)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => x[0]), chs = Object.keys(YCH).filter(k => words.some(w => ych(k).n.toLowerCase().includes(w)));
    return `<div class="ytpage"><h1>${res.length} result${res.length === 1 ? '' : 's'} for “${esc(YT.q)}”</h1>${chs.map(k => `<div class="ytrow" role="button" tabindex="0" data-ytgo="ch:${k}" style="grid-template-columns:248px minmax(0,1fr)"><span style="display:grid;place-items:center">${yAv(k, 'ychav')}</span><span class="tx"><b>${esc(ych(k).n)}${yVer(k)}</b><span class="s">${ych(k).h} · ${ych(k).subs} subscribers</span><p>${esc(ych(k).about)}</p></span></div>`).join('')}
      <div class="ytrows">${res.map(v => yRow(v, { desc: true, more: true })).join('') || `<div class="ytday">No videos match “${esc(YT.q)}”. Try fewer words.</div>`}</div></div>`;
  }
  const ytSubBtn = k => YT.subs.has(k) ? `<button class="bt subd" type="button" data-ytsub="${k}" data-lmenu>${ic(YT.bell.has(k) ? 'bell-ring' : 'bell')}Subscribed${ic('chevron-down')}</button>` : `<button class="bt pri" type="button" data-ytsub="${k}">Subscribe</button>`;

  /* ── Watching ── */
  function ytWatch() {
    const v = yv(YT.cur), c = ych(v.ch), ch = yChaps(v), cur = yChapAt(v, YT.t), up = YV.filter(x => x.id !== v.id && x.d).sort((a, b) => (b.ch === v.ch) - (a.ch === v.ch)).slice(0, 10);
    const desc = `${c.about}\n\nFilmed over two mornings in October. Everything here is one 35 mm lens, handheld, natural light only.\n\nMusic: Studio Sessions, used with permission.`;
    return `<div class="ytwatch${YT.theater ? ' theater' : ''}"><div class="ytpw"><i class="ytamb" style="--pi:url(${v.img})"></i><div class="ytplayer">
        <div class="ytpic" data-ytpp><img src="${v.img}" alt="" style="object-position:${v.pos}"><span class="chap" id="yt-chap">${esc(cur[1])}</span>${YT.cc ? `<span class="cc" id="yt-cc"></span>` : ''}<span class="big">${ic('play')}</span></div>
        ${v.d ? `<div class="ytscrub" id="yt-scrub" data-ytseek>${ch.map((x, i) => { const end = (ch[i + 1] || [v.d])[0]; return `<span class="seg" style="left:calc(${x[0] / v.d * 100}% + ${i ? 2 : 0}px);width:calc(${(end - x[0]) / v.d * 100}% - ${i ? 2 : 0}px)" data-s="${x[0]}" data-e="${end}"><i class="b" style="width:${Math.min(100, Math.max(0, (Math.min(v.d, YT.t + 160) - x[0]) / (end - x[0]) * 100))}%"></i><i class="p"></i></span>`; }).join('')}<i class="knob"></i><span class="ytprev"><i style="background-image:url(${v.img})"></i><b></b><span></span></span></div>` : ''}
        <div class="ytctl"><span class="yttime">${v.d ? `<b id="yt-lcd">${yFmt(YT.t)}</b> / ${yFmt(v.d)}` : '<em class="ytlive">LIVE</em>'}</span>
          <span class="yttr"><button class="ib" type="button" data-ytstep="-10" aria-label="Back 10 seconds" title="Back 10 seconds · J">${ic('rotate-ccw')}</button><button class="seplay${YT.playing ? ' on' : ''}" type="button" data-ytpp aria-label="${YT.playing ? 'Pause' : 'Play'}" title="${YT.playing ? 'Pause' : 'Play'} · K">${ic(YT.playing ? 'pause' : 'play')}</button><button class="ib" type="button" data-ytstep="10" aria-label="Forward 10 seconds" title="Forward 10 seconds · L">${ic('rotate-cw')}</button><button class="ib" type="button" data-ytnext aria-label="Next video" title="Next video · Shift N">${ic('skip-forward')}</button></span>
          <span class="ytctr"><span class="ytvol"><input class="rng" type="range" min="0" max="100" value="${YT.vol}" style="--p:${YT.vol}%" data-ytvol aria-label="Volume"><button class="ib" type="button" data-ytmute aria-label="Mute" title="Mute · M">${ic(YT.vol ? 'volume-2' : 'volume-x')}</button></span>
            <button class="ib${YT.cc ? ' on' : ''}" type="button" data-ytcc aria-label="Captions" title="Captions · C">${ic('captions')}</button><button class="ib spd" type="button" data-ytspeed data-lmenu title="Playback speed">${YT.speed}×</button><button class="ib" type="button" data-ytpip aria-label="Picture in picture" title="Picture in picture">${ic('picture-in-picture-2')}</button><button class="ib${YT.theater ? ' on' : ''}" type="button" data-yttheater aria-label="Theater" title="Theater · T">${ic(YT.theater ? 'minimize-2' : 'maximize-2')}</button></span></div>
      </div></div>
      <div class="ytinfo"><h1>${esc(v.t)}</h1>
        <div class="ytchan"><button class="who" type="button" data-ytgo="ch:${v.ch}">${yAv(v.ch)}<span><b>${esc(c.n)}${yVer(v.ch)}</b><span>${c.subs} subscribers</span></span></button>${ytSubBtn(v.ch)}</div>
        <button class="ytdesc${YT.desc ? ' open' : ''}" type="button" data-ytdesc><span class="k"><span>${v.views}</span><span>${v.ago}</span><em>#photography</em><em>#35mm</em></span><span class="t">${esc(YT.desc ? desc : c.about)}</span><span class="more">${YT.desc ? 'Show less' : 'Show more'}</span></button>
        ${v.d ? `<div class="ytchaps">${ch.map(x => `<button type="button" class="${x === cur ? 'on' : ''}" data-ytjump="${x[0]}"><i style="background-image:url(${v.img});background-position:${[10, 80, 35, 95, 55, 20][ch.indexOf(x) % 6]}% ${[40, 70, 20, 60, 85, 30][ch.indexOf(x) % 6]}%"></i><b>${esc(x[1])}</b><span>${yFmt(x[0])}</span></button>`).join('')}</div>` : ''}
        <div class="ytcoms"><div class="hd"><b>1,284 comments</b><div class="seg" role="tablist"><i class="ind"></i>${[['top', 'Top'], ['new', 'Newest']].map(([k, n]) => `<button type="button" class="${YT.sort === k ? 'on' : ''}" data-ytsort="${k}">${n}</button>`).join('')}</div></div>
          ${YT.mine.map(m => ytCom(['me', 'Nick McMillen', 'Just now', m, '0', 0], true)).join('')}${(YT.sort === 'new' ? YCOM.slice().reverse() : YCOM).map((x, i) => ytCom(x, false, i === 0 && YT.sort === 'top', v)).join('')}</div></div>
      <aside class="ytnext">${YT.queue.length ? `<div class="ytq"><div class="hd"><b>Queue</b><span>${YT.queue.length} next</span><button class="ib" type="button" data-ytclearq aria-label="Clear queue" title="Clear queue" style="margin-left:auto">${ic('x')}</button></div>${YT.queue.map(id => yRow(yv(id), { compact: true })).join('')}</div>` : ''}
        <div class="hd"><b>Up next</b><button type="button" data-ytauto role="switch" aria-checked="${YT.autoplay}" style="margin-left:auto;display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--ink-2)">Autoplay<i class="cfsw${YT.autoplay ? ' on' : ''}"></i></button></div>
        <div class="ytrows">${up.map(x => yRow(x, { compact: true })).join('')}</div></aside></div>`;
  }
  function ytCom([k, n, when, text, likes, pin], mine, pinned, v) {
    const av = k === 'me' ? `<i class="yav" style="background-image:url(${PH}life-work-suite.webp);background-position:42% 26%"></i>` : yAv(k), own = v && k === v.ch;
    return `<div class="ytcom">${av}<div>${pinned ? `<div class="ytpin">${ic('pin')}Pinned by ${esc(ych(v.ch).n)}</div>` : ''}<div class="h">${own ? `<b class="own">${esc(n)}</b>` : `<b>${esc(n)}</b>`}<span>${when}</span></div><p>${esc(text)}</p>
      <div class="a"><button class="ib" type="button" data-ytclike aria-label="Like">${ic('thumbs-up')}</button><span>${likes}</span><button class="ib" type="button" aria-label="Dislike">${ic('thumbs-down')}</button><button class="bt" type="button" data-ytreply>Reply</button>${pin ? `<i class="heart" style="background-image:url(${ych(v?.ch || 'field').av?.[0] || ''})" title="Loved by the creator"></i>` : ''}</div></div></div>`;
  }

  /* ── The bar: search while browsing, the video's actions while watching, and whatever is playing ── */
  function ytBar() {
    const bar = $('#yt-bar'), v = yv(YT.cur), watching = YT.view === 'watch';
    bar.classList.toggle('composing', watching && YT.composing);
    const mini = !watching && YT.cur && YT.started ? `<button class="ytmini" type="button" data-ytgo="watch" title="Back to the video"><span class="th" style="background-image:url(${v.img});background-position:${v.pos};--p:${v.d ? YT.t / v.d * 100 : 100}%"></span><span><b>${esc(v.t)}</b><small id="yt-minit">${v.d ? yFmt(YT.t) + ' / ' + yFmt(v.d) : 'Live'}</small></span></button><button class="ib" type="button" data-ytpp aria-label="${YT.playing ? 'Pause' : 'Play'}">${ic(YT.playing ? 'pause' : 'play')}</button><button class="ib" type="button" data-ytstop aria-label="Close player">${ic('x')}</button><i class="vr2"></i>` : '';
    if (!watching) { setBar(bar, `${mini}<label class="srch keep">${ic('search')}<input placeholder="Search YouTube" value="${esc(YT.view === 'search' ? YT.q : '')}" data-ytq aria-label="Search YouTube"></label><button class="ib" type="button" data-ytcast aria-label="Play on a screen" title="Play on a screen">${ic('cast')}</button>`); return; }
    const dl = YT.dl[v.id], lk = YT.liked.has(v.id), dk = YT.disliked.has(v.id), likes = 34200 + (lk ? 1 : 0);
    setBar(bar, `<span class="like"><button class="bt${lk ? ' on' : ''}" type="button" data-ytlike aria-pressed="${lk}" title="I like this">${ic('thumbs-up')}${(likes / 1000).toFixed(1)}K</button><i class="d"></i><button class="bt${dk ? ' on' : ''}" type="button" data-ytdislike aria-pressed="${dk}" title="I dislike this">${ic('thumbs-down')}</button></span>
      <label class="srch keep ytcm">${ic('message-circle')}<input placeholder="Add a comment" data-ytcom value="${esc(YT.comment)}" aria-label="Add a comment"></label>
      <button class="ib${YT.later.includes(v.id) ? ' on' : ''}" type="button" data-ytlater="${v.id}" aria-label="Watch later" title="${YT.later.includes(v.id) ? 'In Watch later' : 'Watch later'}">${ic('bookmark')}</button><button class="ib" type="button" data-share aria-label="Share" title="Share">${ic('share-2')}</button>
      <button class="ib ytdl${dl === 100 ? ' on' : ''}" type="button" data-ytdl aria-label="Download" title="${dl === 100 ? 'Downloaded' : dl != null ? 'Downloading…' : 'Download'}" style="--dp:${dl || 0}%">${ic(dl === 100 ? 'check' : 'arrow-down-to-line')}${dl != null && dl < 100 ? '<i class="ring"></i>' : ''}</button><button class="ib" type="button" data-ytmore data-lmenu aria-label="More" title="More">${ic('ellipsis')}</button>
      ${YT.composing ? `<div class="ytcomp"><textarea data-ytcomtx placeholder="Add a comment as Nick McMillen" aria-label="Comment">${esc(YT.comment)}</textarea><div class="row"><small>Comments are public. Be kind.</small><span class="sp"></span><button class="bt" type="button" data-ytcomcancel>Cancel</button><button class="bt pri" type="button" data-ytcompost>${ic('send')}Comment</button></div></div>` : ''}`);
  }
  /* where you came from: one floating island, top left, whenever you're inside something */
  function ytIsl() {
    const m = $('#yt-main'), top = ['home', 'shorts', 'subs', 'history', 'downloads'].includes(YT.view) && !yNarrow();
    let i = $('#yt-isl'); m.classList.toggle('hasisl', !top);
    if (top) { i?.remove(); return; }
    if (!i) { m.insertAdjacentHTML('beforeend', '<div class="flo ytisl" id="yt-isl"></div>'); i = $('#yt-isl'); }
    const prev = YT.back[YT.back.length - 1], inside = !!prev && !['home', 'shorts', 'subs', 'history', 'downloads'].includes(YT.view) || YT.view === 'watch';
    i.innerHTML = inside ? `<button class="ib" type="button" data-ytback aria-label="Back to ${esc(yTitle(prev || 'home'))}" title="Back">${ic('chevron-left')}</button><b>${esc(yTitle(prev || 'home'))}</b>`
      : `<button class="ib" type="button" data-navtoggle aria-label="Places" title="Places">${ic('menu')}</button><b>${esc(yTitle(YT.view))}</b>`;
  }
  function ytMain(keep) {
    const b = $('#yt-body'), y = keep ? b.scrollTop : 0, V = YT.view;
    const v = yv(YT.cur); $('#w-youtube').style.setProperty('--yh', V === 'watch' ? v.h : V.startsWith('ch:') ? (YV.find(x => x.ch === V.slice(3))?.h ?? 25) : yv('shore').h);
    b.innerHTML = V === 'home' ? ytHome() : V === 'subs' ? ytSubs() : V === 'shorts' ? ytShorts() : V === 'history' ? ytHistory() : V === 'downloads' ? ytDownloads() : V === 'search' ? ytSearch() : V === 'watch' ? ytWatch() : V.startsWith('pl:') ? ytPlaylist(V.slice(3)) : V.startsWith('ch:') ? ytChannel(V.slice(3)) : '';
    b.scrollTop = y; ytIsl(); ytTick(true); requestAnimationFrame(segs);
  }
  function renderYT() {
    const w = $('#w-youtube');
    if (!w.dataset.side) { w.dataset.side = 1; w.classList.toggle('lsideoff', !lSideOn(w)); }
    $('#yt-top').innerHTML = `<img src="${A}youtube.svg" alt=""><b>YouTube</b><span class="chev">${ic('chevron-down')}</span>${lSideBtn(w)}`;
    ytSide(); ytMain(); ytBar(); w.classList.toggle('ytplaying', YT.playing);
  }
  function ytGo(view, o = {}) {
    if (view === YT.view && !o.force) return;
    if (!o.noHist && YT.view !== view) YT.back.push(YT.view); if (YT.back.length > 30) YT.back.shift();
    YT.view = view; YT.composing = false; ytSide(); ytMain(); ytBar(); $('#w-youtube').classList.remove('navopen');
  }
  function ytPlay(id, o = {}) {
    const fresh = YT.cur !== id; YT.cur = id; const v = yv(id);
    if (fresh) { YT.t = v.d && v.w > 0 && v.w < 1 ? Math.round(v.d * v.w) : 0; YT.desc = false; YT.mine = []; }
    YT.started = true; YT.playing = true; $('#w-youtube').classList.add('ytplaying');
    if (YT.view === 'watch') { if (fresh) ytMain(); else ytTick(true); ytBar(); } else ytGo('watch');
    if (fresh) $('#yt-body').scrollTop = 0;
  }
  function ytSetPlaying(p) { YT.playing = p; $('#w-youtube').classList.toggle('ytplaying', p); YT.started = true;
    $$('#w-youtube [data-ytpp]').forEach(b => { if (b.matches('button')) { b.classList.toggle('on', p); b.innerHTML = ic(p ? 'pause' : 'play'); b.setAttribute('aria-label', p ? 'Pause' : 'Play'); } }); }
  /* the clock: only the pieces that move are touched, never the page */
  function ytTick(all) {
    const v = yv(YT.cur); if (!v) return; const p = v.d ? YT.t / v.d : 0, lcd = $('#yt-lcd');
    if (lcd && v.d) { lcd.textContent = yFmt(YT.t); const c = yChapAt(v, YT.t); if ($('#yt-chap').textContent !== c[1]) { $('#yt-chap').textContent = c[1]; $$('#w-youtube .ytchaps button').forEach(b => b.classList.toggle('on', +b.dataset.ytjump === c[0])); } }
    $$('#yt-scrub .seg').forEach(s => { const a = +s.dataset.s, e = +s.dataset.e; s.querySelector('.p').style.width = Math.min(100, Math.max(0, (YT.t - a) / (e - a) * 100)) + '%'; });
    const k = $('#yt-scrub .knob'); if (k) k.style.left = `calc(${p * 100}% )`;
    const cc = $('#yt-cc'); if (cc) { const L = YCC[v.id] || ['…']; cc.textContent = L[Math.floor(YT.t / 9) % L.length]; }
    const mt = $('#yt-minit'); if (mt) { mt.textContent = v.d ? yFmt(YT.t) + ' / ' + yFmt(v.d) : 'Live'; mt.closest('.ytmini')?.querySelector('.th')?.style.setProperty('--p', p * 100 + '%'); }
  }
  setInterval(() => { if (!YT.playing) return; const v = yv(YT.cur); if (!v) return;
    if (v.d) { YT.t += .25 * YT.speed; if (YT.t >= v.d) { YT.t = v.d; ytSetPlaying(false); if (YT.autoplay) { const n = YT.queue.shift() || YV[(YV.indexOf(v) + 1) % YV.length].id; setTimeout(() => ytPlay(n), 1200); } } }
    ytTick(); }, 250);
  function ytSeekAt(e, el) { const v = yv(YT.cur), r = el.getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); return [x, x * v.d]; }
  const ytToast = (m, o) => lToast($('#w-youtube'), m, o);

  function ytClick(e, hit) {
    const w = $('#w-youtube'), g = hit('[data-ytgo]');
    if (hit('[data-ytlater]')) { const id = hit('[data-ytlater]').dataset.ytlater, on = YT.later.includes(id); YT.later = on ? YT.later.filter(x => x !== id) : [...YT.later, id]; ytToast(on ? 'Removed from Watch later' : 'Saved to Watch later', { undo: () => { YT.later = on ? [...YT.later, id] : YT.later.filter(x => x !== id); ytSide(); ytMain(true); ytBar(); } }); ytSide(); ytMain(true); ytBar(); return true; }
    if (hit('[data-ytqueue]')) { const id = hit('[data-ytqueue]').dataset.ytqueue; if (!YT.queue.includes(id)) YT.queue.push(id); ytToast(`Plays next · ${YT.queue.length} in the queue`); return true; }
    if (hit('[data-ytchan]')) { ytGo('ch:' + hit('[data-ytchan]').dataset.ytchan); return true; }
    if (g) { const k = g.dataset.ytgo; if (k === 'watch') { ytGo('watch'); return true; } YT.ctab = 'videos'; ytGo(k); $('#yt-body').scrollTop = 0; return true; }
    if (hit('[data-ytback]')) { const p = YT.back.pop() || 'home'; ytGo(p, { noHist: true }); return true; }
    if (hit('[data-ytplay]')) { const b = hit('[data-ytplay]'); if (b.dataset.ytplall) YT.queue = YPL[b.dataset.ytplall].ids().slice(1); ytPlay(b.dataset.ytplay); return true; }
    if (hit('[data-ytshuffle]')) { const ids = YPL[hit('[data-ytshuffle]').dataset.ytshuffle].ids().slice().sort(() => Math.random() - .5); YT.queue = ids.slice(1); ytPlay(ids[0]); ytToast('Shuffling ' + ids.length + ' videos'); return true; }
    if (hit('[data-ytshort]')) { ytToast('Shorts play full screen on a phone. Swipe up for the next.'); return true; }
    if (hit('[data-ytchip]')) { YT.chip = hit('[data-ytchip]').dataset.ytchip; ytMain(true); return true; }
    if (hit('[data-ytctab]')) { YT.ctab = hit('[data-ytctab]').dataset.ytctab; ytMain(true); return true; }
    if (hit('[data-ytpp]')) { if (!YT.started && YT.view !== 'watch') { ytPlay(YT.cur); return true; } ytSetPlaying(!YT.playing); return true; }
    if (hit('[data-ytstop]')) { ytSetPlaying(false); YT.started = false; ytBar(); return true; }
    if (hit('[data-ytstep]')) { const v = yv(YT.cur); YT.t = Math.max(0, Math.min(v.d, YT.t + +hit('[data-ytstep]').dataset.ytstep)); ytTick(); return true; }
    if (hit('[data-ytjump]')) { YT.t = +hit('[data-ytjump]').dataset.ytjump; ytSetPlaying(true); ytTick(); $('#yt-body').scrollTo({ top: 0, behavior: 'smooth' }); return true; }
    if (hit('[data-ytseek]')) { const [, t] = ytSeekAt(e, hit('[data-ytseek]')); YT.t = t; ytTick(); return true; }
    if (hit('[data-ytnext]')) { const v = yv(YT.cur), n = YT.queue.shift() || YV.filter(x => x.d)[(YV.filter(x => x.d).indexOf(v) + 1) % YV.filter(x => x.d).length].id; ytPlay(n); return true; }
    if (hit('[data-ytcc]')) { YT.cc = !YT.cc; ytMain(true); return true; }
    if (hit('[data-yttheater]')) { YT.theater = !YT.theater; ytMain(true); return true; }
    if (hit('[data-ytpip]')) { ytToast('The video floats above your other windows. Drag it anywhere.'); return true; }
    if (hit('[data-ytmute]')) { YT.vol = YT.vol ? 0 : 70; ytMain(true); return true; }
    if (hit('[data-ytspeed]')) { lMenu(hit('[data-ytspeed]'), [.5, .75, 1, 1.25, 1.5, 2].map(s => crMi(`data-ytsp="${s}"`, s === YT.speed ? 'check' : '', s === 1 ? 'Normal' : s + '×')).join('')); return true; }
    if (hit('[data-ytsp]')) { YT.speed = +hit('[data-ytsp]').dataset.ytsp; $('#lmenu')?.remove(); const b = $('#w-youtube [data-ytspeed]'); if (b) b.textContent = YT.speed + '×'; return true; }
    if (hit('[data-ytsub]')) { const b = hit('[data-ytsub]'), k = b.dataset.ytsub;
      if (!YT.subs.has(k)) { YT.subs.add(k); ytToast(`Subscribed to ${ych(k).n}`); ytSide(); ytMain(true); return true; }
      lMenu(b, crMi(`data-ytbell="${k}"`, YT.bell.has(k) ? 'bell-off' : 'bell-ring', YT.bell.has(k) ? 'Only the usual notifications' : 'Tell me about every video') + '<span class="crsep"></span>' + crMi(`data-ytunsub="${k}"`, 'user-minus', 'Unsubscribe', ' red')); return true; }
    if (hit('[data-ytbell]')) { const k = hit('[data-ytbell]').dataset.ytbell; YT.bell.has(k) ? YT.bell.delete(k) : YT.bell.add(k); $('#lmenu')?.remove(); ytMain(true); return true; }
    if (hit('[data-ytunsub]')) { const k = hit('[data-ytunsub]').dataset.ytunsub; YT.subs.delete(k); $('#lmenu')?.remove(); ytToast(`Unsubscribed from ${ych(k).n}`, { undo: () => { YT.subs.add(k); ytSide(); ytMain(true); } }); ytSide(); ytMain(true); return true; }
    if (hit('[data-ytdesc]')) { YT.desc = !YT.desc; ytMain(true); return true; }
    if (hit('[data-ytsort]')) { YT.sort = hit('[data-ytsort]').dataset.ytsort; ytMain(true); return true; }
    if (hit('[data-ytauto]')) { YT.autoplay = !YT.autoplay; ytMain(true); return true; }
    if (hit('[data-ytclearq]')) { YT.queue = []; ytMain(true); return true; }
    if (hit('[data-ytlike]') || hit('[data-ytdislike]')) { const id = YT.cur, L = !!hit('[data-ytlike]'), A1 = L ? YT.liked : YT.disliked, B1 = L ? YT.disliked : YT.liked; A1.has(id) ? A1.delete(id) : (A1.add(id), B1.delete(id)); if (L && YT.liked.has(id)) ytToast('Added to Liked videos'); ytBar(); ytSide(); return true; }
    if (hit('[data-ytcomcancel]')) { YT.composing = false; YT.comment = ''; ytBar(); return true; }
    if (hit('[data-ytcompost]')) { const t = ($('#w-youtube [data-ytcomtx]')?.value || '').trim(); if (!t) return true; YT.mine.unshift(t); YT.comment = ''; YT.composing = false; ytBar(); ytMain(true); ytToast('Comment posted'); return true; }
    if (hit('[data-ytdl]')) { const id = YT.cur; if (YT.dl[id] != null) { ytGo('downloads'); return true; } YT.dl[id] = 0; ytBar(); const iv = setInterval(() => { YT.dl[id] = Math.min(100, YT.dl[id] + 7 + Math.random() * 9); if (YT.view === 'watch' && YT.cur === id) { const b = $('#w-youtube [data-ytdl]'); b?.style.setProperty('--dp', YT.dl[id] + '%'); } if (YT.dl[id] >= 100) { clearInterval(iv); ytBar(); ytSide(); ytToast('Downloaded. It plays without a connection.'); } }, 260); return true; }
    if (hit('[data-ytmore]')) { lMenu(hit('[data-ytmore]'), crMi('data-ytqueuecur', 'list-plus', 'Add to queue') + crMi('data-ytsaveto', 'list-video', 'Save to playlist…') + crMi('data-ytclip', 'scissors', 'Clip') + '<span class="crsep"></span>' + crMi('data-ytnotint', 'circle-x', 'Not interested') + crMi('data-ytreport', 'flag', 'Report…')); return true; }
    if (hit('[data-ytrowmore]')) { const id = hit('[data-ytrowmore]').dataset.ytrowmore; lMenu(hit('[data-ytrowmore]'), crMi(`data-ytqueue="${id}"`, 'list-plus', 'Add to queue') + crMi(`data-ytlater="${id}"`, 'clock', YT.later.includes(id) ? 'Remove from Watch later' : 'Save to Watch later') + '<span class="crsep"></span>' + crMi(`data-ytforget="${id}"`, 'trash-2', 'Remove from history', ' red')); return true; }
    if (hit('[data-ytforget]')) { $('#lmenu')?.remove(); ytToast('Removed from history'); return true; }
    if (hit('[data-ytqueuecur],[data-ytsaveto],[data-ytclip],[data-ytnotint],[data-ytreport]')) { const k = Object.keys(hit('.crmi').dataset)[0]; $('#lmenu')?.remove(); ytToast({ ytqueuecur: 'Added to the queue', ytsaveto: 'Saved to Road trip', ytclip: 'Clip the part you want, up to a minute', ytnotint: 'You’ll see fewer like this', ytreport: 'Thanks. We’ll take a look.' }[k]); return true; }
    if (hit('[data-ythist]')) { YT.hist = !YT.hist; ytMain(true); ytToast(YT.hist ? 'Watch history is on' : 'Watch history is paused. New videos aren’t saved.'); return true; }
    if (hit('[data-ytclear]')) { lConfirm(w, { title: 'Clear all watch history?', body: 'Your recommendations start over. Nothing else is removed.', action: 'Clear history', icon: 'history', onOK: () => ytToast('Watch history cleared') }); return true; }
    if (hit('[data-ytcast]')) { ytToast('Looking for screens on this network… Living room TV'); return true; }
    if (hit('[data-ytnewpl]')) { ytToast('New playlist. Name it in the sidebar.'); return true; }
    if (hit('[data-ytclike]')) { hit('[data-ytclike]').classList.toggle('on'); return true; }
    if (hit('[data-ytreply]')) { YT.composing = true; ytBar(); setTimeout(() => $('#w-youtube [data-ytcomtx]')?.focus(), 60); return true; }
    return false;
  }
  /* typing: search in the bar (Enter), the comment field grows into a composer, history filters as you type */
  document.addEventListener('keydown', e => { const t = e.target; if (!t.closest?.('#w-youtube')) return;
    if (t.matches('[data-ytq]') && e.key === 'Enter' && t.value.trim()) { YT.q = t.value.trim(); ytGo('search', { force: true }); }
    if (t.matches('[data-ytcomtx]') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('#w-youtube [data-ytcompost]')?.click(); });
  document.addEventListener('focusin', e => { if (e.target.matches?.('#w-youtube [data-ytcom]') && !YT.composing) { YT.composing = true; ytBar(); setTimeout(() => $('#w-youtube [data-ytcomtx]')?.focus(), 30); } });
  document.addEventListener('input', e => { const t = e.target;
    if (t.matches?.('#w-youtube [data-ythq]')) { YT.hq = t.value; const pos = t.selectionStart; ytMain(true); const n = $('#w-youtube [data-ythq]'); n.focus(); n.setSelectionRange(pos, pos); }
    if (t.matches?.('#w-youtube [data-ytcomtx]')) YT.comment = t.value;
    if (t.matches?.('#w-youtube [data-ytvol]')) { YT.vol = +t.value; t.style.setProperty('--p', YT.vol + '%'); } });
  /* the scrubber shows where you'd land: the picture there, the chapter and the time */
  document.addEventListener('pointermove', e => { const s = e.target.closest?.('#yt-scrub'); if (!s) return; const v = yv(YT.cur), [x, t] = ytSeekAt(e, s), pv = s.querySelector('.ytprev');
    pv.style.left = `clamp(86px, ${x * 100}%, calc(100% - 86px))`; pv.querySelector('i').style.backgroundPosition = `${x * 100}% 50%`; pv.querySelector('b').textContent = yChapAt(v, t)[1]; pv.querySelector('span').textContent = yFmt(t); });
  document.addEventListener('keydown', e => { if (front()?.dataset.app !== 'youtube' || YT.view !== 'watch' || e.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    const v = yv(YT.cur), k = e.key.toLowerCase();
    if (k === 'k' || k === ' ') { e.preventDefault(); ytSetPlaying(!YT.playing); } else if (k === 'j' || k === 'arrowleft') { YT.t = Math.max(0, YT.t - (k === 'j' ? 10 : 5)); ytTick(); } else if (k === 'l' || k === 'arrowright') { YT.t = Math.min(v.d, YT.t + (k === 'l' ? 10 : 5)); ytTick(); }
    else if (k === 'c') { YT.cc = !YT.cc; ytMain(true); } else if (k === 't') { YT.theater = !YT.theater; ytMain(true); } else if (k === 'm') { YT.vol = YT.vol ? 0 : 70; ytMain(true); } });
  function ytShare() { const v = yv(YT.cur), pl = YT.view.startsWith('pl:') ? YPL[YT.view.slice(3)] : null;
    if (pl) return { kind: 'link', t: pl.n, sub: `A playlist · ${pl.ids().length} videos`, th: `<img src="${yv(pl.ids()[0] || 'shore').img}" alt="">` };
    return { kind: 'link', t: v.t, sub: `youtu.be · ${ych(v.ch).n}${YT.t > 5 && v.d ? ' · from ' + yFmt(YT.t) : ''}`, th: `<img src="${v.img}" alt="">` }; }
  new ResizeObserver(() => { const n = yNarrow(); if (n !== YT.wasNarrow) { YT.wasNarrow = n; ytIsl(); } }).observe($('#w-youtube'));

  /* ══ Windows ═══════════════════════════════════════════════════════════ */
  const wins = $$('.win'); let zTop = 10;
  const settle = () => { segs(); writeFit(); };
  function focusWin(w) { w.style.zIndex = ++zTop; syncDock(); }
  const bounds = () => ({ w: desk.clientWidth, h: desk.clientHeight, dock: document.documentElement.dataset.desktop === '1' ? (typeof DTA !== 'undefined' ? DTA.res.bottom : 80) : 58 });
  const place = (w, x, y, ww, hh) => Object.assign(w.style, { left: x + 'px', top: y + 'px', width: ww + 'px', height: hh + 'px' });
  const ORDER = ['filer', 'photos', 'viola', 'write', 'tide', 'youtube', 'discord', 'messages', 'notes', 'contacts', 'term', 'calendar', 'depot', 'weather', 'clock', 'charlie', 'monitor', 'leaf', 'viewer', 'valet', 'memos', 'tasks', 'disks', 'camera', 'maps', 'phone', 'picker', 'modal', 'calc', 'ari', 'canvas', 'grid', 'stage', 'session', 'darkroom', 'reel', 'settings', 'playground', 'lumaui'];
  /* Working space: open on one app, at the same size every version is compared at (see studio.html).
     ?app=photos picks another; ?all=1 or the "All apps" button restores the full desktop. */
  const QS = new URLSearchParams(location.search), FOCUS = QS.get('app') || 'settings';
  function focusLayout() { if (FOCUS === 'none') { wins.forEach(x => { x.hidden = true; x.classList.remove('min'); }); requestAnimationFrame(settle); return; }   /* app=none: a clean desktop */
    const b = bounds(), w = Math.min(FOCUS === 'playground' ? 1400 : 1180, b.w - 48), h = Math.min(FOCUS === 'playground' ? 840 : 740, b.h - b.dock - 24);
    wins.forEach(x => { x.classList.remove('min', 'phone', 'navopen'); delete x.dataset.max; x.hidden = x.dataset.app !== FOCUS; }); desk.classList.remove('phoning'); $('#phone').classList.remove('on');
    const f = $('#w-' + FOCUS); place(f, Math.round((b.w - w) / 2), Math.max(12, Math.round((b.h - b.dock - h) / 2)), w, h); focusWin(f); requestAnimationFrame(settle); }
  function layout() { const b = bounds(), avail = b.h - b.dock - 22, big = [Math.min(1340, b.w - 40), Math.min(830, avail - 6)], mid = [Math.min(1120, b.w * .78), Math.min(700, avail * .86)];
    const Pz = { filer: [24, 16, ...mid], photos: [b.w - mid[0] - 24, 16 + avail * .1, ...mid], viola: [(b.w - big[0]) / 2 - 24, 10, big[0], big[1] - 16], write: [(b.w - big[0]) / 2 - 8, 14, big[0], big[1] - 8], tide: [(b.w - big[0]) / 2 + 8, 18, big[0], big[1]], youtube: [(b.w - big[0]) / 2, 12, big[0], big[1] - 4], messages: [(b.w - mid[0]) / 2, 20, mid[0], big[1] - 20], discord: [(b.w - big[0]) / 2 + 16, 22, big[0] - 32, big[1] - 24], notes: [(b.w - mid[0]) / 2 + 20, 30, mid[0], big[1] - 40], contacts: [(b.w - mid[0]) / 2 - 20, 24, mid[0], big[1] - 30], term: [(b.w - mid[0]) / 2, 40, mid[0], Math.min(620, big[1] - 60)], calendar: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], depot: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], weather: [(b.w - mid[0]) / 2, 20, mid[0], big[1] - 20], clock: [(b.w - 900) / 2, 30, 900, big[1] - 40], charlie: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], monitor: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], leaf: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], viewer: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], valet: [(b.w - 780) / 2, 60, 780, 480], memos: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], tasks: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], disks: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], camera: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], maps: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], phone: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], picker: [(b.w - 900) / 2, 40, 900, 600], modal: [(b.w - 820) / 2, 40, 820, 600], calc: [(b.w - 360) / 2, 40, 360, 600], ari: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], canvas: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], grid: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], stage: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], session: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], darkroom: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], reel: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], settings: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], playground: [(b.w - big[0]) / 2, 14, big[0], big[1] - 10], lumaui: [(b.w - mid[0]) / 2, 24, mid[0], big[1] - 24] };
    if (b.w < 980) ORDER.forEach((k, i) => Pz[k] = [8, 8 + i * 24, b.w - 16, avail - i * 24]);
    ORDER.forEach(k => { const [x, y, w, h] = Pz[k]; place($('#w-' + k), Math.round(x), Math.round(y), Math.round(w), Math.round(h)); });
    wins.forEach(w => { w.hidden = false; w.classList.remove('min', 'phone', 'navopen'); delete w.dataset.max; }); desk.classList.remove('phoning'); $('#phone').classList.remove('on');
    ORDER.forEach(k => focusWin($('#w-' + k))); requestAnimationFrame(settle); }
  function toggleMax(w) { const b = bounds(); if (w.dataset.max) { const r = JSON.parse(w.dataset.max); place(w, r.x, r.y, r.w, r.h); delete w.dataset.max; return; }
    w.dataset.max = JSON.stringify({ x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight }); place(w, 8, 8, b.w - 16, b.h - b.dock - 16); }
  const front = () => wins.filter(w => !w.hidden && !w.classList.contains('min')).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
  function syncDock() { const f = front(); $$('.dk[data-app]').forEach(d => { const w = $('#w-' + d.dataset.app); d.classList.toggle('running', !w.hidden); d.classList.toggle('front', w === f); });
    window.lumaShell?.sync(wins.filter(w => !w.hidden).map(w => w.dataset.app), f?.dataset.app); }
  function togglePhone() { const w = front(); if (!w) return; const b = bounds();
    if (w.classList.contains('phone')) { const r = JSON.parse(w.dataset.phone); place(w, r.x, r.y, r.w, r.h); w.classList.remove('phone', 'navopen'); desk.classList.remove('phoning'); $('#phone').classList.remove('on'); }
    else { wins.forEach(x => { if (x.classList.contains('phone')) togglePhone(); }); w.dataset.phone = JSON.stringify({ x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight });
      const h = Math.min(820, b.h - b.dock - 40); place(w, Math.round((b.w - 390) / 2), Math.round((b.h - b.dock - h) / 2), 390, h); w.classList.add('phone'); desk.classList.add('phoning'); $('#phone').classList.add('on'); }
    w.dispatchEvent(new CustomEvent('luma-phone', { detail: w.classList.contains('phone') })); setTimeout(settle, 60); }
  /* Dragging moves the window on the GPU (transform) and commits left/top once, on release;
     resizing is batched to one layout per frame. Nothing re-lays out per mouse event. */
  let drag = null, raf = 0;
  const paint = () => { raf = 0; if (!drag) return; const d = drag;
    if (d.mode === 'move') d.w.style.transform = `translate3d(${d.nx - d.ox}px, ${d.ny - d.oy}px, 0)`;
    else Object.assign(d.w.style, { left: d.nx + 'px', top: d.ny + 'px', width: d.nw + 'px', height: d.nh + 'px' }); };
  /* In the desktop view every edge and corner of a window resizes it */
  const edgeAt = (w, e) => { if (document.documentElement.dataset.desktop !== '1' || w.classList.contains('phone')) return ''; const r = w.getBoundingClientRect(), m = 6, x = e.clientX - r.left, y = e.clientY - r.top;
    return (y < m ? 'n' : y > r.height - m ? 's' : '') + (x < m ? 'w' : x > r.width - m ? 'e' : ''); };
  const CUR = { n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' }, cur = k => { const c = k ? 'dtcur-' + CUR[k] : ''; if (c === cur.c) return; if (cur.c) document.documentElement.classList.remove(cur.c); if (c) document.documentElement.classList.add(c); cur.c = c; };
  desk.addEventListener('pointerdown', e => { const w = e.target.closest('.win'); if (!w) return; focusWin(w); const ed = edgeAt(w, e);
