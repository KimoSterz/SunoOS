#!/usr/bin/env python3
"""Content policy for the vendored Luma mockup (simframe/), SunoOS fork.

Rules:
- Depot (the store) keeps its FULL catalogue, third-party apps included —
  they are an option to install, nothing more. catalogue.js is untouched.
- The running system has NO third-party apps installed: empty device
  install lists, no pending updates, no update history beyond Luma, no
  dock/launch-pad entries (XAPPS) and an empty background tray.
- File names are rebranded luma... -> Suno... (refs, bundle keys); upstream
  URLs stay untouched.
- The icon bundle and icon files are pruned to what is still referenced.
Logic, rendering, animations and layout are untouched. Idempotent. Applied
automatically by tools/fetch_upstream.py after downloads.
"""

import io
import json
import os
import re
import sys

# Ids of third-party (non-Luma) apps, as used in mockup data.
XP_IDS = {'spotify', 'discord-x', 'discord', 'obsidian', 'zoom', 'steam'}
TRAY_IDS = {'discord', 'steam', 'nextcloud', 'bitwarden', 'signal'}
# Rows/units that only exist for (now uninstalled) third-party apps.
XP_ROW_IDS = XP_IDS | {'blender', 'gimp', 'audacity', 'signal', 'libre',
                       'vlc', 'kodi', 'obs', 'heroic', 'moonlight',
                       'supertux', 'nextcloud', 'bitwarden', 'firefox',
                       'telegram', 'thunderbird', 'kdenlive', 'godot'}
ICON_KEEP_PREFIX = ('Suno-v4-', 'Suno-ink-', '_cap-', 'brand-')

REF_RENAMES = [('luma-next-73.html', 'Suno-next-73.html'),
               ('luma-73', 'Suno-73'),
               ('luma-v4-', 'Suno-v4-'),
               ('luma-ink-', 'Suno-ink-'),
               ('luma-favicon', 'Suno-favicon'),
               ('social-luma', 'social-suno')]

# UI rebranding: visible brand strings, keeping internal identifiers intact.
RE_URL = re.compile(r'(?:https?://|git@|ssh://)[^\s"\'<>)]+', re.I)
RE_SIMPLY = re.compile(r'[A-Za-z0-9.-]*simplyluma[A-Za-z0-9./_#?=&-]*', re.I)
RE_LUMA_VER = re.compile(r'Luma 1\.0')
RE_LUMA_ISO = re.compile(r'Luma-1\.0-nightly\.iso')
RE_LUMAUI = re.compile(r'(?<![A-Za-z0-9_$.])LumaUI(?![A-Za-z0-9_$(.])')
RE_LUMA_ESC = re.compile(r'(\\[nrt])(Luma|luma)(?![A-Za-z0-9_$])')
RE_LUMA_UP = re.compile(r'(?<![A-Za-z0-9_$.])Luma(?![A-Za-z0-9_$])')
RE_LUMA_LO = re.compile(r'(?<![A-Za-z0-9_$.])luma(?![A-Za-z0-9_$])')


def read(path):
    return io.open(path, encoding='utf-8').read()


def write(path, s):
    io.open(path, 'w', encoding='utf-8', newline='').write(s)


def diff_write(path, s):
    if read(path) != s:
        write(path, s)
        return True
    return False


def rename_refs(root):
    """Our files are named `Suno…`; rewrite references (not upstream URLs)."""
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


def targets(root, entry, sections_dir):
    """Entry file, or—after the split—the section files that replace it."""
    p = os.path.join(root, entry)
    if os.path.exists(p) and 'SunoOS: this file is split' not in read(p)[:200]:
        return [p]
    d = os.path.join(root, sections_dir)
    if os.path.isdir(d):
        return sorted(os.path.join(d, f) for f in os.listdir(d)
                      if f.endswith('.js'))
    return [p] if os.path.exists(p) else []


def strip_installed(ln):
    ln = re.sub(r',\s*inst: 1\b,?', '', ln)
    ln = re.sub(r",\s*upd: '[^']*'", '', ln)
    return ln


def clean_catalogue_installed(root):
    p = os.path.join(root, 'apps', 'depot', 'catalogue.js')
    if not os.path.exists(p):
        return
    s = read(p)
    lines = s.split('\n')
    out, inblock, hit = [], False, False
    for ln in lines:
        mm = re.match(r"\s*X\('([^']+)'", ln)
        if mm:
            inblock, hit = True, mm.group(1) in XP_IDS
        if inblock and hit:
            ln = strip_installed(ln)
        if inblock and depth_closed(ln):
            inblock = False
        out.append(ln)
    diff_write(p, '\n'.join(out))


def depth_closed(ln):
    return ln.count('(') - ln.count(')') <= 0 and ('{' in ln or '}' in ln or ')' in ln)


def clean_world(root):
    """Nothing third-party is installed, pending, matched or in the history."""
    p = os.path.join(root, 'apps', 'depot', 'world.js')
    if not os.path.exists(p):
        return
    s = read(p)
    s = re.sub(r'(?m)^(\s*(?:xps|x1|fp6|tv|home)): \[[^\]]*\](,?)$',
               r'\1: []\2', s)
    s = re.sub(r'D\.pending = \[.*?\];', 'D.pending = [];', s, flags=re.S)
    s = re.sub(r'D\.matched = \[[^\]]*\];', 'D.matched = [];', s, count=1)

    def keep_done(m):
        rows = re.findall(r'\[[^\[\]]+\]', m.group(1))
        kept = [r for r in rows
                if not re.match(r"\s*\['([^']+)'", r)
                or re.match(r"\s*\['([^']+)'", r).group(1) in ('luma', 'suno')]
        return 'D.done = [' + ', '.join(kept) + '];'
    s = re.sub(r'D\.done = \[(.*?)\];', keep_done, s, count=1, flags=re.S)
    diff_write(p, s)


def clean_shell(root):
    """Dock/launch pad: Luma apps only (XAPPS = []); empty background tray."""
    for p in targets(root, os.path.join('desktop', 'shell.js'),
                     os.path.join('desktop', 'shell', 'sections')):
        s = read(p)
        s = re.sub(r'const XAPPS = \[.*?\];', 'const XAPPS = [];', s,
                   count=1, flags=re.S)
        out = []
        for ln in s.split('\n'):
            mm = re.match(r"\s*\{ id: '([^']+)'", ln)
            if mm and mm.group(1) in TRAY_IDS:
                continue
            out.append(ln)
        diff_write(p, '\n'.join(out))


def clean_phone_depot(root):
    """Phone Depot: catalogue rows stay (store), but nothing is installed;
    update-history rows for uninstalled apps are dropped (unguarded lookups)."""
    files = targets(root, 'Suno-73.js', os.path.join('Suno-73', 'sections'))
    for p in files:
        s = read(p)
        lines = s.split('\n')
        out = []
        for ln in lines:
            mm = re.match(r"\s*da\('([^']+)'", ln)
            if mm and mm.group(1) in XP_IDS:
                ln = strip_installed(ln)
                ln = re.sub(r'\s*,\s*upd:\s*\'[^\']+\',', ',', ln)
            out.append(ln)
        s = '\n'.join(out)

        def keep_rows(m):
            kept = []
            for r in re.findall(r'\[[^\[\]]+\]', m.group(2)):
                mm = re.match(r"\s*\['([^']+)'", r)
                if not (mm and mm.group(1) in XP_ROW_IDS):
                    kept.append(r)
            return m.group(1) + '[' + ', '.join(kept) + ']'
        s = re.sub(r'(</header><div class="drows">\$\{)(\[\[.*?\]\])',
                   keep_rows, s, count=1, flags=re.S)
        diff_write(p, s)


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
    if re.search(r'[\\"/]%s\.' % re.escape(stem), blob):
        return True
    parts = stem.split('-')
    while len(parts) > 1:
        parts.pop()
        if '-'.join(parts) in blob:
            return True
    return False


def trim_bundle(simframe):
    p = os.path.join(simframe, 'icons', '_bundle.json')
    if not os.path.exists(p):
        return 0
    try:
        bundle = json.loads(read(p))
    except Exception as e:
        print('trim_bundle: %s' % e, file=sys.stderr)
        return 0
    blob = referenced_blob(os.path.join(simframe))
    kept = {k: v for k, v in bundle.items()
            if k.startswith(ICON_KEEP_PREFIX) or stem_used(k, blob)}
    raw = json.dumps(kept, separators=(',', ':'))
    diff_write(p, raw)
    return len(bundle) - len(kept)


def clean_icons(simframe):
    ico = os.path.join(simframe, 'icons')
    if not os.path.isdir(ico):
        return []
    blob = referenced_blob(simframe)
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


def rebrand_ui(mock):
    """Brand strings in the mockup: Luma -> Suno, version -> SunoOS 0.1.
    Token rules skip identifiers (window.lumaDesk, ST.lumaOpen, renderLumaUI,
    --luma vars are NOT skipped: they are replaced uniformly everywhere so
    definitions and uses stay consistent). Upstream URLs are protected."""
    n = 0
    for base, dirs, files in os.walk(mock):
        for f in files:
            if not f.endswith(('.js', '.html', '.css')):
                continue
            p = os.path.join(base, f)
            try:
                s = io.open(p, encoding='utf-8').read()
            except UnicodeDecodeError:
                continue
            vault = []

            def stash(m):
                vault.append(m.group(0))
                return '\x00%d\x00' % (len(vault) - 1)

            t = RE_URL.sub(stash, s)
            t = RE_SIMPLY.sub(stash, t)
            t = RE_LUMA_ISO.sub('SunoOS-0.1-nightly.iso', t)
            t = RE_LUMA_ESC.sub(lambda m: m.group(1) + ('Suno' if m.group(2)[0] == 'L' else 'suno'), t)
            t = t.replace('6.16.8-luma1', '6.16.8-suno1')
            t = t.replace('look.luma.app', 'look.suno.app')
            t = t.replace('FTREE.Luma', 'FTREE.Suno')
            t = RE_LUMA_VER.sub('SunoOS 0.1', t)
            t = RE_LUMAUI.sub('SunoUI', t)
            t = RE_LUMA_UP.sub('Suno', t)
            t = RE_LUMA_LO.sub('suno', t)
            t = re.sub(r'\x00(\d+)\x00',
                       lambda m: vault[int(m.group(1))], t)
            if t != s:
                write(p, t)
                n += 1
    return n


def clean(root):
    simframe = root
    mock = os.path.join(root, 'mockups')
    rename_refs(mock)
    rename_bundle_keys(simframe)
    rebrand_ui(mock)
    clean_catalogue_installed(mock)
    clean_world(mock)
    clean_shell(mock)
    clean_phone_depot(mock)
    n = trim_bundle(simframe)
    n += len(clean_icons(simframe))
    return n


if __name__ == '__main__':
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gone = clean(os.path.join(here, 'simframe'))
    print('cleaned simframe; %d icons pruned' % gone)
