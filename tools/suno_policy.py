#!/usr/bin/env python3
"""Content policy for the vendored Luma mockup (simframe/).

Removes the third-party apps the SunoOS system does not carry, wherever
they appear as DATA (Depot catalogue, launch pad, status tray, update and
history feeds, phone Depot shelves, job filters). It also trims the icon
bundle and prunes icon files no longer referenced. Logic, rendering,
animations and layout are untouched. Idempotent: running twice changes
nothing. Applied automatically by tools/fetch_upstream.py after downloads.
"""

import io
import json
import os
import re
import sys

ACTIVE_X = {'spotify', 'discord', 'obsidian', 'zoom', 'steam'}
TRAY_DEAD = {'nextcloud', 'bitwarden', 'signal'}
PHONE_DEAD = {'blender', 'gimp', 'audacity', 'signal', 'libre', 'vlc',
              'kodi', 'obs', 'heroic', 'moonlight', 'supertux'}
ICON_KEEP_PREFIX = ('Suno-v4-', 'Suno-ink-', '_cap-', 'brand-')


def read(path):
    return io.open(path, encoding='utf-8').read()


def write(path, s):
    io.open(path, 'w', encoding='utf-8', newline='').write(s)


def diff_write(path, s):
    if read(path) != s:
        write(path, s)
        return True
    return False


def referenced_blob(root):
    corpus = []
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d != 'icons']
        for f in files:
            if f.endswith(('.json', '.css', '.js', '.html')):
                corpus.append(os.path.join(base, f))
    return '\n'.join(read(f) for f in corpus)


def stem_used(stem, blob):
    if stem in blob:
        return True
    if re.search(r'[\'"/]%s\.' % re.escape(stem), blob):
        return True
    parts = stem.split('-')
    while len(parts) > 1:
        parts.pop()
        if '-'.join(parts) in blob:
            return True
    return False


DEAD_IDS = {'blender', 'gimp', 'inkscape', 'krita', 'kdenlive', 'audacity',
            'obs', 'vlc', 'kodi', 'signal', 'telegram', 'thunderbird',
            'libreoffice', 'libre', 'vscodium', 'godot', 'nextcloud',
            'bitwarden', 'firefox', 'heroic', 'moonlight', 'supertux',
            'qbittorrent'}


def drop_dead_ids(s):
    return re.sub(r"'(?:%s)'(,\s*)?" % '|'.join(DEAD_IDS), '', s)


def clean_catalogue(root):
    p = os.path.join(root, 'apps', 'depot', 'catalogue.js')
    s = read(p)

    lines = s.split('\n')
    out, i = [], 0
    while i < len(lines):
        if lines[i].lstrip().startswith("X('"):
            j, depth, started = i, 0, False
            while j < len(lines):
                depth += lines[j].count('(') - lines[j].count(')')
                started = started or '(' in lines[j]
                if started and depth <= 0:
                    break
                j += 1
            block = '\n'.join(lines[i:j + 1])
            if 'inst: 1' not in block:
                i = j + 1
                continue
            out.extend(lines[i:j + 1])
            i = j + 1
            continue
        out.append(lines[i])
        i += 1
    s = '\n'.join(out)

    s = drop_dead_ids(s)
    s = re.sub(r",\s*,", ',', s)
    s = re.sub(r"\[\s*,", '[', s)
    s = re.sub(r",\s*\]", ']', s)
    diff_write(p, s)


def clean_world(root):
    p = os.path.join(root, 'apps', 'depot', 'world.js')
    s = read(p)

    def keep_ids(m):
        ids = [x.strip() for x in m.group(2).split(',') if x.strip()]
        ids = [x for x in ids if x.strip("'") in ACTIVE_X]
        return "%s: [%s]%s" % (m.group(1), ', '.join(ids), m.group(3))
    s = re.sub(r'^(\s*(?:xps|x1|fp6|tv|home)): \[([^\]]*)\](,?)$', keep_ids, s, flags=re.M)

    def keep_pending(m):
        block = m.group(0)
        for entry in re.findall(r'\{ app: \'([^\']+)\'[^}]*?\},\n', block):
            if entry not in ACTIVE_X:
                block = re.sub(r"\{ app: '%s'[^}]*?\},\n" % entry, '', block)
        return block
    s = re.sub(r'D\.pending = \[(.*?)\];', keep_pending, s, count=1, flags=re.S)

    def keep_done(m):
        rows = re.findall(r'\[[^\[\]]+\]', m.group(1))
        kept = []
        for r in rows:
            mm = re.match(r"\['([^']+)'", r)
            if mm and (mm.group(1) == 'luma' or mm.group(1) in ACTIVE_X):
                kept.append(r)
        return 'D.done = [' + ', '.join(kept) + '];'
    s = re.sub(r'D\.done = \[(.*?)\];', keep_done, s, count=1, flags=re.S)

    def keep_matched(m):
        ids = [x.strip() for x in m.group(1).split(',') if x.strip()]
        ids = [x for x in ids if x.strip("'") in ACTIVE_X]
        return 'D.matched = [%s];' % ', '.join(ids)
    s = re.sub(r"D\.matched = \[([^\]]*)\];", keep_matched, s, count=1)

    s = s.replace("['app', 'krita'], ", '').replace("['app', 'godot'], ", '')
    diff_write(p, s)


def clean_shell(root):
    p = os.path.join(root, 'desktop', 'shell.js')
    s = read(p)

    def keep_xapps(m):
        kept = []
        for t in re.findall(r'\[[^\[\]]+\]', m.group(1)):
            mm = re.match(r"\['([^']+)'", t)
            if mm and (mm.group(1) in ACTIVE_X or mm.group(1) == 'discord-x'):
                kept.append(t)
        return 'const XAPPS = [' + ', '.join(kept) + '];'
    s = re.sub(r'const XAPPS = \[(.*?)\];', keep_xapps, s, count=1, flags=re.S)

    lines = s.split('\n')
    out = []
    for ln in lines:
        mm = re.match(r"\s*\{ id: '([^']+)'", ln)
        if mm and mm.group(1) in TRAY_DEAD:
            continue
        out.append(ln)
    diff_write(p, '\n'.join(out))


def clean_depot_b(root):
    p = os.path.join(root, 'apps', 'depot', 'depot-b.js')
    s = read(p)
    dead = {'audacity', 'vlc', 'kodi', 'signal', 'telegram', 'thunderbird',
            'kdenlive', 'bitwarden'}
    for x in sorted(dead, key=len, reverse=True):
        s = re.sub(", '%s'" % x, '', s)
        s = re.sub(r"\['%s', " % x, '[', s)
    s = re.sub(r",\s*,", ',', s)
    s = re.sub(r"\[\s*,", '[', s)
    s = re.sub(r",\s*\]", ']', s)
    diff_write(p, s)


def clean_luma73(root):
    p = os.path.join(root, 'Suno-73.js')
    s = read(p)

    lines = s.split('\n')
    out = []
    for ln in lines:
        mm = re.match(r"\s*da\('([^']+)'", ln)
        if mm and mm.group(1) in PHONE_DEAD:
            continue
        out.append(ln)
    s = '\n'.join(out)

    s = s.replace(
        "['blender', 'obsidian', 'spotify', 'signal', 'vlc', 'steam', 'gimp', 'discord', 'libre']",
        "['obsidian', 'spotify', 'discord', 'steam']")
    s = drop_dead_ids(s)
    s = re.sub(r",\s*,", ',', s)
    s = re.sub(r"\[\s*,", '[', s)
    s = re.sub(r",\s*\]", ']', s)
    diff_write(p, s)


def trim_bundle(root):
    p = os.path.join(root, 'icons', '_bundle.json')
    if not os.path.exists(p):
        return 0
    try:
        bundle = json.loads(read(p))
    except Exception as e:
        print('trim_bundle: %s' % e, file=sys.stderr)
        return 0
    blob = referenced_blob(root)
    kept = {k: v for k, v in bundle.items()
            if k.startswith(ICON_KEEP_PREFIX) or stem_used(k, blob)}
    raw = json.dumps(kept, separators=(',', ':'))
    diff_write(p, raw)
    return len(bundle) - len(kept)


def clean_icons(root):
    ico = os.path.join(root, 'icons')
    if not os.path.isdir(ico):
        return []
    blob = referenced_blob(root)
    removed = []
    for f in sorted(os.listdir(ico)):
        if not f.endswith('.svg'):
            continue
        stem = f[:-4]
        if stem.startswith(ICON_KEEP_PREFIX):
            continue
        if stem_used(stem, blob):
            continue
        os.remove(os.path.join(ico, f))
        removed.append(f)
    return removed


REF_RENAMES = [('luma-next-73.html', 'Suno-next-73.html'),
               ('luma-73', 'Suno-73'),
               ('luma-v4-', 'Suno-v4-'),
               ('luma-ink-', 'Suno-ink-'),
               ('luma-favicon', 'Suno-favicon'),
               ('social-luma', 'social-suno')]


def rename_refs(root):
    """Upstream pliki nazywa pliki `luma…`; w repo są to `Suno…`. Zamienia
    odwołania do plików w treści makiety (nie URLs upstream i nie branding)."""
    n = 0
    for base, dirs, files in os.walk(root):
        for f in files:
            if not f.endswith(('.js', '.css', '.html', '.json')):
                continue
            p = os.path.join(base, f)
            s = read(p)
            t = s
            for a, b in REF_RENAMES:
                t = t.replace(a, b)
            if t != s:
                write(p, t)
                n += 1
    return n


def rename_bundle_keys(simframe):
    p = os.path.join(simframe, 'icons', '_bundle.json')
    if not os.path.exists(p):
        return False
    try:
        bundle = json.loads(read(p))
    except Exception:
        return False
    out = {}
    for k, v in bundle.items():
        if k.startswith('luma-v4-'):
            k = 'Suno-v4-' + k[len('luma-v4-'):]
        elif k.startswith('luma-ink-'):
            k = 'Suno-ink-' + k[len('luma-ink-'):]
        out[k] = v
    raw = json.dumps(out, separators=(',', ':'))
    if raw != read(p):
        diff_write(p, raw)
        return True
    return False


def clean_runs(root):
    """Tabela D.runs (gdzie aplikacja działa) — usuwa wpisy martwych aplikacji."""
    p = os.path.join(root, 'apps', 'depot', 'world.js')
    s = read(p)
    m = re.search(r'(  tide: ALL,.*?\n)\};', s, re.S)
    if not m:
        return
    ent = re.findall(r'([A-Za-z][\w-]*):\s*(ALL|MOB|PC|\[[^\]]*\])', m.group(1))
    parts = ['%s: %s' % (k, v) for k, v in ent if k not in DEAD_IDS]
    lines, cur = [], ''
    for it in parts:
        if cur and len(cur) + len(it) + 2 > 118:
            lines.append('  ' + cur)
            cur = it
        else:
            cur = (cur + ', ' + it) if cur else it
    if cur:
        lines.append('  ' + cur)
    blk = ',\n'.join(lines) + ',\n'
    diff_write(p, s[:m.start(1)] + blk + s[m.end(1):])


def clean(root):
    simframe = root
    mock = os.path.join(root, 'mockups')
    rename_refs(mock)
    rename_bundle_keys(simframe)
    clean_catalogue(mock)
    clean_world(mock)
    clean_runs(mock)
    clean_shell(mock)
    clean_depot_b(mock)
    clean_luma73(mock)
    n = trim_bundle(simframe)
    n += len(clean_icons(simframe))
    return n


if __name__ == '__main__':
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gone = clean(os.path.join(here, 'simframe'))
    print('cleaned simframe; %d icons pruned' % gone)
