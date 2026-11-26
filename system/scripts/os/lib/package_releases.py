# SPDX-License-Identifier: Apache-2.0
"""Package releases assigned at merge (docs/decisions/056-release-at-merge.md).

A change to a package's source leaves its Release and pins alone. The release
it ships at is the one on main plus one, written when it merges:

- PR builds apply that candidate to their checkout before building (candidate);
- the release job on main writes it and pushes a release commit (release).

This module knows the packages, their sources and every place a release is
written, and rewrites them. It has no GitHub access.
"""

from __future__ import annotations

import atexit
import json
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

PIN_FILES = ('config/desktop/inputs.env', 'config/desktop/packages.txt', 'config/depot/packages.txt')
EXTRA = {'luma-developer-platform': (['src/luma-platform/'], 'packaging/rpm/luma-developer-platform.spec')}
# Sources a patch series' build copies in from outside patches/<dir>/ (no build group owns them).
SERIES_EXTRA = {'gnome-shell': ['src/luma-shell-presentation/', 'scripts/packages/build-gnome-shell.sh']}
# A release commit carries these trailers; Release-through names the last
# main commit whose source changes it released.
THROUGH = 'Release-through'
# Values derived from a package's release outside its spec and pins, written
# with it: {package: (path, pattern whose group 1 precedes the luma number)}.
DERIVED = {'luma-application-installer': ('src/luma-installer/luma_installer/app_host_compatibility.py',
                                          re.compile(r'^(SUPPORTED_INSTALLER_RELEASE\s*=\s*)\d+$', re.M)),
           # Filer builds from this complete successor of its series spec patch
           # (scripts/packages/build-nautilus.sh), so it carries the same Release.
           'nautilus': ('packaging/nautilus/filer-spec-complete.patch',
                        re.compile(r'^(\+Release:\s*\d+\.luma\.)\d+(?=%\{\?dist\}\s*$)', re.M))}
TOKEN = re.compile(r'@RELEASE(?::([A-Za-z0-9._+-]+))?@')
ARCH = r'(?:x86_64|aarch64|noarch|src)'
NEVRA = re.compile(r'^(?P<name>.+)-(?P<version>(?:\d+:)?[^-]+)-(?P<release>[^-]+?)(?P<dist>\.fc\d+)?\.(?P<arch>' + ARCH + r')$')


class Tree:
    """Files of one revision (rev) or of the working tree (rev None)."""

    _batches: dict[str, subprocess.Popen] = {}

    def __init__(self, root: Path, rev: str | None = None):
        self.root, self.rev, self._cache, self._names = Path(root), rev, {}, None

    def git(self, *args: str) -> str:
        return git(self.root, *args)

    def _batch(self) -> subprocess.Popen:
        key = str(self.root)
        if key not in Tree._batches or Tree._batches[key].poll() is not None:
            Tree._batches[key] = subprocess.Popen(
                ['git', '-c', f'safe.directory={self.root}', '-C', key, 'cat-file', '--batch'],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        return Tree._batches[key]

    def read(self, path: str) -> str | None:
        if path not in self._cache:
            if self.rev is None:
                file = self.root / path
                self._cache[path] = file.read_text() if file.is_file() else None
            else:
                batch = self._batch()
                batch.stdin.write(f'{self.rev}:{path}\n'.encode())
                batch.stdin.flush()
                header = batch.stdout.readline().decode().split()
                if len(header) == 3 and header[1] == 'blob':
                    data = batch.stdout.read(int(header[2]))
                    batch.stdout.read(1)
                    self._cache[path] = data.decode(errors='replace')
                else:
                    self._cache[path] = None
        return self._cache[path]

    def files(self, prefix: str) -> list[str]:
        if self.rev is None:
            base = self.root / prefix
            return sorted(str(p.relative_to(self.root)) for p in base.rglob('*') if p.is_file()) if base.is_dir() else []
        if self._names is None:
            self._names = self.git('ls-tree', '-r', '--name-only', self.rev).split('\n')
        return [name for name in self._names if name.startswith(prefix)]


def close_batches() -> None:
    for batch in Tree._batches.values():
        if batch.poll() is None:
            batch.stdin.close()
            batch.wait()
        batch.stdout.close()
    Tree._batches.clear()


atexit.register(close_batches)


def git(root: Path, *args: str) -> str:
    return subprocess.run(['git', '-c', f'safe.directory={root}', '-C', str(root), *args],
                          check=True, capture_output=True, text=True).stdout


@dataclass
class Package:
    name: str              # RPM source package name, as @RELEASE:name@ and pins use it
    release_file: str
    series: bool           # a patches/<dir>/0000-luma-fedora-spec.patch
    paths: list[str]
    group: str | None = None   # config/os/desktop-build-groups.json group
    binaries: set[str] = field(default_factory=set)
    version: str | None = None


def _field(text: str, key: str, series: bool) -> re.Match | None:
    """The Release or Version line: a spec's own, or the one a spec patch adds
    (Version: also as an unchanged context line)."""
    head = text.split('\n%changelog', 1)[0]
    if series:
        pattern = rf'^(?P<lead>\+{key}:\s*)(?P<value>\S[^\n]*?)\s*$'
        if key == 'Version':
            pattern = rf'^(?P<lead>[ +]{key}:\s*)(?P<value>\S[^\n]*?)\s*$'
    else:
        pattern = rf'^(?P<lead>{key}:\s*)(?P<value>\S[^\n]*?)\s*$'
    return re.search(pattern, head, re.M)


def release_of(text: str | None, series: bool) -> str | None:
    """The written Release value, %{?dist} included."""
    match = _field(text, 'Release', series) if text else None
    return match.group('value') if match else None


def version_of(text: str | None, series: bool) -> str | None:
    match = _field(text, 'Version', series) if text else None
    return match.group('value') if match and '%' not in match.group('value') else None


def plain(release: str) -> str:
    """A release as the RPM file name carries it: no %{?dist}; %autorelease -e
    X read as rpmautospec would not be known here, so it stays as written."""
    return release.replace('%{?dist}', '')


def bump(release: str) -> str | None:
    """The next Luma release, or None when the shape is not one this can count.

    1.luma.30 -> 1.luma.31; 1.luma.4.creator20261004.1 -> 1.luma.5 (the
    suffix goes; 5 sorts above 4.anything); 2.luma1 -> 2.luma2;
    %autorelease -e luma.4 -> %autorelease -e luma.5."""
    dist = '%{?dist}' if release.endswith('%{?dist}') else ''
    value = plain(release)
    auto = re.fullmatch(r'(%autorelease -e luma\.)(\d+)', value)
    if auto:
        return f'{auto.group(1)}{int(auto.group(2)) + 1}'
    match = re.match(r'^(?P<head>(?:[^%]*?\.)?luma\.?)(?P<n>\d+)(?=$|[.~])', value)
    if not match or '%' in value:
        return None
    return f"{match.group('head')}{int(match.group('n')) + 1}{dist}"


def _spec_binaries(text: str, name: str) -> set[str]:
    names = {name}
    for line in text.split('\n%changelog', 1)[0].splitlines():
        sub = re.match(r'^%package\s+(?:-n\s+(\S+)|(\S+))\s*$', line)
        if sub:
            names.add((sub.group(1) or f'{name}-{sub.group(2)}').replace('%{name}', name))
    return {n for n in names if '%' not in n}


def packages(tree: Tree) -> dict[str, Package]:
    """Every package whose release this tree assigns, by RPM name.

    - each patch series (patches/<dir>/0000-luma-fedora-spec.patch), plus the
      other paths of the build group that builds it and SERIES_EXTRA (the
      Shell's presentation sources);
    - each build group (config/os/desktop-build-groups.json) with a spec;
    - luma-developer-platform (src/luma-platform/);
    - every other packaging/rpm spec: the spec, the scripts/packages/build-*.sh
      that name it and the src/ and patches/ folders those scripts copy, unless
      a package above owns the folder.
    """
    found: dict[str, Package] = {}
    groups = json.loads(tree.read('config/os/desktop-build-groups.json') or '{"groups": {}}')['groups']
    for path in tree.files('patches/'):
        parts = path.split('/')
        if len(parts) == 3 and parts[2] == '0000-luma-fedora-spec.patch':
            text = tree.read(path) or ''
            found[parts[1]] = Package(parts[1], path, True, [f'patches/{parts[1]}/', *SERIES_EXTRA.get(parts[1], [])],
                                      version=version_of(text, True))
    for name, group in groups.items():
        paths = group.get('paths', [])
        series = [p.split('/')[1] for p in paths
                  if re.fullmatch(r'patches/[^/]+/', p) and p.split('/')[1] in found]
        for dir_name in series:
            found[dir_name].group = name
            found[dir_name].paths += [p for p in paths if p not in found[dir_name].paths]
        if series:
            continue
        specs = [p for p in paths if re.fullmatch(r'packaging/rpm/[^/]+\.spec', p)]
        spec = group.get('spec') or (specs[0] if specs else None)
        if spec and tree.read(spec) is not None:
            package = _spec_package(tree, spec, list(paths))
            if package:
                package.group = name
                found.setdefault(package.name, package)
    for name, (paths, spec) in EXTRA.items():
        package = _spec_package(tree, spec, list(paths))
        if package:
            found[package.name] = package
    owned = {p for package in found.values() for p in package.paths if p.endswith('/')}
    scripts = {path: tree.read(path) or '' for path in tree.files('scripts/packages/')
               if re.fullmatch(r'scripts/packages/build-[^/]+\.sh', path)}
    claimed = {package.release_file for package in found.values()}
    for spec in tree.files('packaging/rpm/'):
        if not spec.endswith('.spec') or spec in claimed:
            continue
        paths = [spec]
        for script, body in sorted(scripts.items()):
            # A script that builds several specs is no one package's source.
            if spec in body and len(set(re.findall(r'packaging/rpm/[A-Za-z0-9._+-]+\.spec', body))) == 1:
                paths.append(script)
                for folder in re.findall(r'\$\{?repo_root\}?/((?:src|patches)/[A-Za-z0-9._+-]+)', body):
                    folder += '/'
                    if folder not in owned and folder not in paths and \
                            not (folder.startswith('patches/') and tree.read(folder + '0000-luma-fedora-spec.patch')):
                        paths.append(folder)
        package = _spec_package(tree, spec, paths)
        if package:
            found.setdefault(package.name, package)
    for package in found.values():
        if package.series:
            package.binaries = {package.name}
    return found


def _spec_package(tree: Tree, spec: str, paths: list[str]) -> Package | None:
    text = tree.read(spec)
    match = re.search(r'^Name:\s*(\S+)', text or '', re.M)
    if not match or '%' in match.group(1):
        return None
    name = match.group(1)
    return Package(name, spec, False, paths, binaries=_spec_binaries(text, name),
                   version=version_of(text, False))


def counts_as_source(path: str) -> bool:
    """Markdown and tests ship nothing."""
    if path.endswith('.md'):
        return False
    return not (path.startswith('tests/') or '/tests/' in path)


def normal(text: str | None, series: bool) -> str | None:
    """A release file with its release written out of it, so a hand bump or a
    release commit is not a source change but any other edit is."""
    if text is None:
        return None
    match = _field(text, 'Release', series)
    if match:
        text = text[:match.start('value')] + '@' + text[match.end('value'):]
    return TOKEN.sub('@', text)


def sources_changed(package: Package, base: Tree, head: Tree, changed: list[str]) -> list[str]:
    hits = [p for p in changed if p != package.release_file and counts_as_source(p) and
            any(p == s or (s.endswith('/') and p.startswith(s)) for s in package.paths)]
    if package.release_file in changed and normal(base.read(package.release_file), package.series) != \
            normal(head.read(package.release_file), package.series):
        hits.insert(0, package.release_file)
    return hits


def release_moved(package: Package, base: Tree, head: Tree) -> bool:
    """A hand-set release: the Release or the Version line changed."""
    b, h = base.read(package.release_file), head.read(package.release_file)
    if b is None:
        return h is not None    # a new package names its first release itself
    return release_of(b, package.series) != release_of(h, package.series) or \
        version_of(b, package.series) != version_of(h, package.series)


def pending(root: Path, base: str, head: str | None = 'HEAD') -> dict[str, dict]:
    """Packages a change from base to head needs a release for.

    {name: {"from": release at head, "to": next release or None, "sources": [...]}}.
    A change that set the release itself (a Version update, a new package) needs
    none."""
    base_tree, head_tree = Tree(root, base), Tree(root, head)
    changed = git(root, 'diff', '--name-only', base, *( [head] if head else [])).splitlines()
    result = {}
    for name, package in sorted(packages(head_tree).items()):
        hits = sources_changed(package, base_tree, head_tree, changed)
        if hits and not release_moved(package, base_tree, head_tree):
            current = release_of(head_tree.read(package.release_file), package.series)
            result[name] = {'from': current, 'to': bump(current) if current else None, 'sources': hits}
    return result


def releases(tree: Tree, found: dict[str, Package] | None = None) -> dict[str, str]:
    """Every package's current release in a tree, %{?dist} left off."""
    found = found if found is not None else packages(tree)
    out = {}
    for name, package in found.items():
        value = release_of(tree.read(package.release_file), package.series)
        if value:
            out[name] = plain(value)
    return out


def rewrite(path: str, text: str, assigned: dict[str, str], found: dict[str, Package],
            current: dict[str, str]) -> str:
    """One file with the assigned releases written into it.

    assigned maps package -> new written release (with %{?dist} where the file
    has it). current holds every package's release in the tree before."""
    final = {**current, **{name: plain(value) for name, value in assigned.items()}}
    owner = next((p for p in found.values() if p.release_file == path), None)
    if owner and owner.name in assigned:
        match = _field(text, 'Release', owner.series)
        if match:
            text = text[:match.start('value')] + assigned[owner.name] + text[match.end('value'):]
    if path.startswith('packaging/rpm/') or re.fullmatch(r'patches/[^/]+/0000-luma-fedora-spec\.patch', path):
        def token(match: re.Match) -> str:
            name = match.group(1) or (owner.name if owner else None)
            if name not in final:
                raise ValueError(f'{path}: {match.group(0)} names no package this tree releases')
            auto = re.fullmatch(r'%autorelease -e (\S+)', final[name])
            if not auto:
                return final[name]
            # %autorelease resolves to <number>.<extra>; the %changelog carries that,
            # with the number its earlier entries have (as the pins do).
            if not owner or owner.name != name:
                raise ValueError(f'{path}: {match.group(0)}: {name} uses %autorelease; '
                                 f'write a floor on it by hand')
            numbers = re.findall(r'^\+?\*[^\n]*-(\d+)\.' + re.escape(re.sub(r'\d+$', '', auto.group(1))) + r'\d+\s*$',
                                 text.split('%changelog', 1)[-1], re.M)
            if not numbers:
                raise ValueError(f'{path}: {match.group(0)}: {name} uses %autorelease and no earlier '
                                 f'%changelog entry gives its number; write the release by hand')
            return f'{numbers[0]}.{auto.group(1)}'
        text = TOKEN.sub(token, text)
    if path in PIN_FILES:
        text = rewrite_pins(text, assigned, found, current)
    for name, (derived, pattern) in DERIVED.items():
        number = re.fullmatch(r'\d+\.luma\.(\d+)', plain(assigned[name])) if path == derived and name in assigned else None
        if number:
            text = pattern.sub(lambda match: match.group(1) + number.group(1), text)
    return text


def stem(name: str) -> str:
    """The inputs.env prefix of a package: gnome-control-center -> GNOME_CONTROL_CENTER."""
    return re.sub(r'[^A-Z0-9]+', '_', name.upper())


def rewrite_pins(text: str, assigned: dict[str, str], found: dict[str, Package], current: dict[str, str]) -> str:
    moves = {name: (current[name], plain(value)) for name, value in assigned.items() if name in current}

    def moved(package_name: str, release: str) -> str | None:
        """The new release for one this package was pinned at, or None. An
        %autorelease -e luma.N package is pinned as <number>.luma.N."""
        old, new = moves[package_name]
        if release == old:
            return new
        auto_old = re.fullmatch(r'%autorelease -e (\S+)', old)
        auto_new = re.fullmatch(r'%autorelease -e (\S+)', new)
        if auto_old and auto_new and re.fullmatch(r'\d+\.' + re.escape(auto_old.group(1)), release):
            return release[:-len(auto_old.group(1))] + auto_new.group(1)
        return None

    def owner(name: str, version: str, release: str, variable: str | None) -> str | None:
        for package_name in moves:
            package = found[package_name]
            if moved(package_name, release) is None:
                continue
            if package.version and version.split(':')[-1] != package.version:
                continue
            if name in package.binaries or (package.series and name.startswith(package.name + '-')) or \
                    (variable and variable.startswith(stem(package_name) + '_')):
                return package_name
        return None

    def nevra(token: str, variable: str | None) -> tuple[str, str | None]:
        match = NEVRA.match(token)
        if not match:
            return token, None
        package = owner(match.group('name'), match.group('version'), match.group('release'), variable)
        if not package:
            return token, None
        start, end = match.span('release')
        return token[:start] + moved(package, match.group('release')) + token[end:], package

    lines = text.split('\n')
    stems: dict[str, set[str]] = {}
    for index, line in enumerate(lines):
        variable = re.match(r'^([A-Z0-9_]+)=', line)
        out, hit = [], set()
        name = variable.group(1) if variable else None
        for piece in re.split(r'([\s=,\'"]+)', line):
            new, package = nevra(piece, name)
            if package is None and ':' in piece:
                parts = piece.split(':')
                rebuilt = [nevra(part, name) for part in parts]
                if any(p for _, p in rebuilt):
                    new, package = ':'.join(t for t, _ in rebuilt), next(p for _, p in rebuilt if p)
            if package:
                hit.add(package)
            out.append(new)
        lines[index] = ''.join(out)
        if variable and hit:
            for package in hit:
                stems.setdefault(package, set()).add(variable.group(1))
    # NAME_RELEASE / NAME_LUMA_RELEASE: a bare release, or name-version-release,
    # for the package whose NEVRA variables share its NAME_ prefix.
    for index, line in enumerate(lines):
        match = re.match(r'^(?P<var>(?P<stem>[A-Z0-9_]+?)(?:_LUMA)?_RELEASE)=(?P<value>\S+)$', line)
        if not match:
            continue
        for package in moves:
            value = match.group('value')
            release = value.rsplit('-', 1)[-1]
            new = moved(package, release)
            if new and (match.group('stem') == stem(package) or any(
                    v.startswith(match.group('stem') + '_') for v in stems.get(package, ()))):
                lines[index] = f"{match.group('var')}={value[:len(value) - len(release)]}{new}"
                break
    return '\n'.join(lines)


def apply(root: Path, assigned: dict[str, str], tree: Tree | None = None) -> list[str]:
    """Write the assigned releases into the working tree; the files changed."""
    tree = tree or Tree(root)
    found = packages(tree)
    current = releases(tree, found)
    targets = set(PIN_FILES) | {p.release_file for p in found.values()}
    targets |= {p for p in tree.files('packaging/rpm/') if p.endswith('.spec')}
    targets |= {path for path, _ in DERIVED.values()}
    changed = []
    for path in sorted(targets):
        text = tree.read(path)
        if text is None:
            continue
        new = rewrite(path, text, assigned, found, current)
        if new != text:
            (Path(root) / path).write_text(new)
            changed.append(path)
    return changed


def rewrite_tree(source: Tree, assigned: dict[str, str]):
    """A function giving a file of source as it reads with assigned written in."""
    found = packages(source)
    current = releases(source, found)

    def read(path: str) -> str | None:
        text = source.read(path)
        return None if text is None else rewrite(path, text, assigned, found, current)
    return read


# The toolkit cohort's recipes and sources (scripts/os/admit-desktop-toolkit.py).
TOOLKIT_PATHS = ['scripts/os/build-desktop-toolkit.sh',
                 'scripts/packages/build-gtk4.sh', 'scripts/packages/build-libadwaita.sh',
                 'scripts/packages/build-luma-developer-platform.sh', 'scripts/packages/build-figtree-fonts.sh',
                 'scripts/packages/run-in-rpm-builder.sh', 'scripts/packages/fetch-source-rpm.sh',
                 'patches/gtk4', 'patches/libadwaita', 'src/luma-platform',
                 'packaging/rpm/luma-developer-platform.spec', 'scripts/fonts',
                 'packaging/fontconfig', 'packaging/rpm/google-figtree-fonts.spec',
                 'assets/icon-theme/Prairie/symbolic/actions/lumaui-*.svg', 'LICENSE.md',
                 'scripts/packages/spec-release.sh', 'tests/toolkit-native']
TOOLKIT_PROVIDER_PATHS = ['scripts/packages/build-gtk4.sh', 'scripts/packages/build-libadwaita.sh',
                          'scripts/packages/build-figtree-fonts.sh', 'scripts/packages/run-in-rpm-builder.sh',
                          'scripts/packages/fetch-source-rpm.sh', 'scripts/packages/spec-release.sh',
                          'patches/gtk4', 'patches/libadwaita', 'scripts/fonts', 'packaging/fontconfig',
                          'packaging/rpm/google-figtree-fonts.spec', 'LICENSE.md']


def toolkit_differences(root: Path, commit: str, assigned: dict[str, str],
                        providers_only: bool = False) -> tuple[list[str], list[str]]:
    """The toolkit paths whose content at commit, with the assigned releases
    written in, is not root's working tree; and the inputs.env provider pins
    (compared by key, not as a file) that differ."""
    root = Path(root)
    if subprocess.run(['git', '-c', f'safe.directory={root}', '-C', str(root), 'cat-file', '-e', f'{commit}^{{commit}}'],
                      capture_output=True).returncode:
        # A squash merge leaves a pull request's head out of main's history.
        git(root, 'fetch', '--quiet', '--no-tags', 'origin', commit)
    paths = TOOLKIT_PROVIDER_PATHS if providers_only else TOOLKIT_PATHS
    read = rewrite_tree(Tree(root, commit), assigned)
    names = git(root, 'diff', '--name-only', commit, '--', *paths).split()
    changed = [name for name in names
               if read(name) != ((root / name).read_text(errors='replace') if (root / name).is_file() else None)]

    def values(body):
        return dict(line.split('=', 1) for line in (body or '').splitlines()
                    if line and not line.startswith('#') and '=' in line)
    prefixes = ('GTK4_', 'LIBADWAITA_', 'FIGTREE_', 'FEDORA_RPM_BUILD_CONTAINER') + \
        (() if providers_only else ('LUMA_DEVELOPER_PLATFORM_',))
    prior = values(read('config/desktop/inputs.env'))
    current = values((root / 'config/desktop/inputs.env').read_text())
    keys = [key for key in prior if key.startswith(prefixes)]
    if not keys:
        raise ValueError('no toolkit provider pins')
    return changed, [key for key in keys if prior[key] != current.get(key)]
