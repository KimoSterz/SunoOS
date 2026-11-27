#!/usr/bin/env python3
"""Full rebrand of the vendored OS sources in system/: Luma -> Suno.

Scope (decided with the user): files/directories, identifiers, UI strings and
docs. Upstream URLs and hosts (simplyluma.com, gitlab.com/simplyluma/luma,
dl.simplyluma.com/...) are protected and stay pointing upstream. Binary files
keep their bytes but get renamed when their name carries the brand. Idempotent.
"""

import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'system'))

PROJECT = re.compile(r'project([-_]?)luma', re.I)
LUMAUI = re.compile(r'lumaui', re.I)
CAMEL = re.compile(r'(?<=[a-z])Luma(?![a-z])')
CAMEL0 = re.compile(r'(?<![A-Za-z])Luma(?=[A-Z])')
EMBED = re.compile(r'(?<=[a-z])luma(?=[a-z])', re.I)
EMBED2 = re.compile(r'(?<=[a-z])luma(?![a-z])', re.I)
LOWSTART = re.compile(r'(?<![A-Za-z])luma(?=[a-z])')
LCAMEL = re.compile(r'(?<![A-Za-z])luma(?=[A-Z])')
UCAMEL0 = re.compile(r'(?<![A-Za-z])LUMA(?=[A-Z])')
TLOW = re.compile(r'(?<![A-Za-z])Luma(?=[a-z])')
UEMBED = re.compile(r'(?<=[A-Z])LUMA(?![A-Za-z])')
LUMAS = re.compile(r'(?<![A-Za-z])lumas(?![A-Za-z])', re.I)
ESC = re.compile(r'(\\[nrt])luma')
TOKEN = re.compile(r'(?<![A-Za-z])luma(?![A-Za-z])', re.I)
SIMPLY = re.compile(r'[A-Za-z0-9.-]*simplyluma[A-Za-z0-9./_#?=&-]*', re.I)
URL = re.compile(r'(?:https?://|git@|ssh://)[^\s"\'<>)]+', re.I)


def _case(tok, upper, title):
    if tok.isupper():
        return upper
    if tok[0].isupper():
        return title
    return title


def project_sub(m):
    sep = m.group(1)
    if m.group(0).isupper():
        return 'PROJECT' + sep + 'SUNO'
    if sep == '-':
        return 'project-suno'
    return 'projectSuno'


def lumaui_sub(m):
    tok = m.group(0)
    if tok.isupper():
        return 'SUNOUI'
    return 'SunoUI'


def token_sub(m):
    tok = m.group(0)
    if tok.isupper():
        return 'SUNO'
    return 'Suno'


def rebrand_text(s):
    """Replace brand tokens, protecting upstream URLs/hosts. Returns (text, n)."""
    vault = []

    def stash(m):
        vault.append(m.group(0))
        return '\x00%d\x00' % (len(vault) - 1)

    s = URL.sub(stash, s)
    s = SIMPLY.sub(stash, s)
    n = 0
    for rx, fn in ((PROJECT, project_sub), (LUMAUI, lumaui_sub),
                   (CAMEL, lambda m: 'Suno'), (CAMEL0, lambda m: 'Suno'),
                   (EMBED, lambda m: 'Suno'), (EMBED2, lambda m: 'Suno'),
                   (LOWSTART, lambda m: 'Suno'), (LCAMEL, lambda m: 'Suno'),
                   (UCAMEL0, lambda m: 'SUNO'),
                   (TLOW, lambda m: 'Suno'),
                   (UEMBED, lambda m: 'SUNO'), (LUMAS, token_sub),
                   (ESC, lambda m: m.group(1) + 'Suno'),
                   (TOKEN, token_sub)):
        s, k = rx.subn(fn, s)
        n += k
    s = re.sub(r'\x00(\d+)\x00', lambda m: vault[int(m.group(1))], s)
    return s, n


def name_sub(name):
    s, _ = rebrand_text(name)
    return s


def has_luma(s):
    return re.search(r'luma', s, re.I) is not None


def collect(root):
    files, dirs = [], []
    for base, dnames, fnames in os.walk(root):
        for f in fnames:
            files.append(os.path.join(base, f))
        for d in dnames:
            dirs.append(os.path.join(base, d))
    return files, dirs


def rename_paths(root):
    files, dirs = collect(root)
    ren = 0
    for p in sorted(files, key=len, reverse=True):
        b, n = os.path.split(p)
        if has_luma(n):
            q = os.path.join(b, name_sub(n))
            if q != p and not os.path.exists(q):
                os.rename(p, q)
                ren += 1
    for p in sorted(dirs, key=len, reverse=True):
        b, n = os.path.split(p)
        if has_luma(n):
            q = os.path.join(b, name_sub(n))
            if q != p and not os.path.exists(q):
                os.rename(p, q)
                ren += 1
    return ren


def retarget_symlinks(root):
    n = 0
    for base, dnames, fnames in os.walk(root):
        for f in fnames + dnames:
            p = os.path.join(base, f)
            if not os.path.islink(p):
                continue
            t = os.readlink(p)
            if has_luma(t):
                os.unlink(p)
                os.symlink(name_sub(t), p)
                n += 1
    return n


def rebrand_content(root):
    files, _ = collect(root)
    changed = 0
    for p in files:
        if os.path.islink(p) or p.endswith('VENDOR.md'):
            continue
        try:
            with open(p, 'rb') as fh:
                raw = fh.read()
            s = raw.decode('utf-8')
        except (UnicodeDecodeError, OSError):
            continue
        t, n = rebrand_text(s)
        if n and t != s:
            with open(p, 'wb') as fh:
                fh.write(t.encode('utf-8'))
            changed += 1
    return changed


def leftovers(root):
    """Brand tokens remaining outside protected URLs/hosts."""
    files, _ = collect(root)
    hits = []
    for p in files:
        if os.path.islink(p) or p.endswith('VENDOR.md'):
            continue
        try:
            s = open(p, 'rb').read().decode('utf-8')
        except (UnicodeDecodeError, OSError):
            continue
        s = URL.sub(lambda m: ' ', s)
        s = SIMPLY.sub(lambda m: ' ', s)
        for m in re.finditer(r'(?i)[A-Za-z0-9._/-]*luma[A-Za-z0-9._/-]*', s):
            hits.append((p, m.group(0)))
    return hits


def main():
    if not os.path.isdir(ROOT):
        print('brak katalogu: %s' % ROOT, file=sys.stderr)
        return 1
    c = rebrand_content(ROOT)
    r = rename_paths(ROOT)
    l = retarget_symlinks(ROOT)
    print('pliki z treścią: %d, zmiany nazw: %d, symlinki: %d' % (c, r, l))
    left = leftovers(ROOT)
    print('pozostałości poza ochroną: %d' % len(left))
    for p, frag in left[:20]:
        print('  %s: %s' % (os.path.relpath(p, ROOT), frag))
    return 0


if __name__ == '__main__':
    sys.exit(main())
