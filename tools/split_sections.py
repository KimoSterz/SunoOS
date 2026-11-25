#!/usr/bin/env python3
"""Split the mockup monoliths into ordered, byte-exact sections.

Behavior is provably untouched: every part is a raw slice of the source
file, the entry files reassemble the exact same text (join == original,
verified by sha256 before anything is written), CSS is re-imported in the
same order via @import, and no HTML or markup changes at all.

- luma-73.js        -> tiny loader + luma-73/sections/sNNN.js
- luma-73.css       -> @import manifest + luma-73/sections/sNNN.css
- desktop/shell.js  -> tiny loader + desktop/shell/sections/sNNN.js
- desktop/shell.css -> @import manifest + desktop/shell/sections/sNNN.css

Idempotent: after the first run the entry files are loaders/manifests,
so running again changes nothing. tools/fetch_upstream.py runs it right
after a fresh download (while the entry files are still pristine).
"""

import hashlib
import json
import os
import re
import sys

TARGETS = [
    ('luma-73.js', 128000),
    ('luma-73.css', 128000),
    ('desktop/shell.js', 60000),
    ('desktop/shell.css', 60000),
]


def read(p):
    return open(p, encoding='utf-8').read()


def write(p, s):
    open(p, 'w', encoding='utf-8', newline='').write(s)


def sha(s):
    return hashlib.sha256(s.encode('utf-8')).hexdigest()[:16]


def js_split(s, target):
    """Split a JS file at line boundaries; bytes are what matter because
    the loader joins the parts back into the original text."""
    parts, cur, size = [], [], 0
    for ln in s.splitlines(keepends=True):
        cur.append(ln)
        size += len(ln)
        if size >= target:
            parts.append(''.join(cur))
            cur, size = [], 0
    if cur:
        parts.append(''.join(cur))
    return parts or [s]


def css_split(s, target):
    """Split CSS only between top-level rules (never inside a rule, block
    comment or string), so each part stays valid on its own."""
    ok, depth, incmt, istr, esc = [], 0, False, None, False
    for i, ch in enumerate(s):
        if incmt:
            if ch == '*' and s[i + 1:i + 2] == '/':
                incmt = False
            continue
        if istr:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == istr:
                istr = None
            elif ch == '\n':
                istr = None
            continue
        if ch == '/' and s[i + 1:i + 2] == '*':
            incmt = True
            continue
        if ch in ('"', "'"):
            istr = ch
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth = max(0, depth - 1)
        elif ch == '\n' and depth == 0:
            ok.append(i + 1)
    pts = [p for p in ok if p]
    parts, start = [], 0
    for p in pts:
        if p - start >= target:
            parts.append(s[start:p])
            start = p
    parts.append(s[start:])
    return parts


def split_one(mockups, name, target):
    entry = os.path.join(mockups, name)
    if not os.path.exists(entry):
        return None
    orig = read(entry)
    if 'SunoOS: this file is split' in orig[:200]:
        return None
    ext = os.path.splitext(name)[1]
    parts = js_split(orig, target) if ext == '.js' else css_split(orig, target)
    if sha(''.join(parts)) != sha(orig):
        raise SystemExit('%s: split is not byte-identical' % name)

    dirbase = os.path.join(mockups, os.path.splitext(name)[0] + '/sections')
    os.makedirs(dirbase, exist_ok=True)
    for f in os.listdir(dirbase):
        if f.endswith(ext):
            os.remove(os.path.join(dirbase, f))
    n = len(parts)
    for i, part in enumerate(parts, 1):
        write(os.path.join(dirbase, 's%03d%s' % (i, ext)), part)

    sec = os.path.splitext(name)[0] + '/sections'
    head = '/* SunoOS: this file is split into ordered, byte-exact sections in %s; edit those. */\n'
    if ext == '.js':
        base = os.path.splitext(name)[0] + '/sections/'
        loader = (head % sec +
                  '(async () => {\n'
                  "  const base = '%s', n = %d, parts = [];\n"
                  "  for (let i = 1; i <= n; i++)\n"
                  "    parts.push(fetch(base + 's' + String(i).padStart(3, '0') + '.js').then(r => r.text()));\n"
                  "  (0, eval)((await Promise.all(parts)).join(''));\n"
                  '})();\n' % (base, n))
    else:
        cssbase = os.path.relpath(dirbase, os.path.dirname(entry)).replace(os.sep, '/')
        loader = (head % sec +
                  ''.join("@import url('%s/s%03d.css');\n" % (cssbase, i)
                          for i in range(1, n + 1)))
    write(entry, loader)
    return {'entry': name, 'sections': sec, 'count': n, 'bytes': len(orig),
            'sha': sha(orig)}


def split(mockups):
    out = {}
    for name, target in TARGETS:
        r = split_one(mockups, name, target)
        if r:
            out[name] = r
    return out


if __name__ == '__main__':
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    m = os.path.join(here, 'simframe', 'mockups')
    if not os.path.isdir(m):
        print('no mockups at %s' % m, file=sys.stderr)
        sys.exit(1)
    res = split(m)
    mf = os.path.join(m, 'sections.json')
    merged = json.loads(read(mf)) if os.path.exists(mf) else {}
    merged.update(res)
    write(mf, json.dumps(merged, indent=2) + '\n')
    for k, v in sorted(res.items()):
        print('%s -> %d sections (~%d KB, sha %s)' %
              (k, v['count'], v['bytes'] // 1024, v['sha']))
