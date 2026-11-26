# SPDX-License-Identifier: Apache-2.0
"""Releases assigned at merge (docs/decisions/056-release-at-merge.md)."""

import importlib.util
import io
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/os/lib'))
import package_releases as pr  # noqa: E402

spec = importlib.util.spec_from_file_location('release_at_merge', ROOT / 'scripts/os/release-at-merge.py')
ram = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ram)


def rpmvercmp(a, b):
    """rpm's segment comparison, enough for Luma releases."""
    def segments(value):
        return re.findall(r'~|[0-9]+|[A-Za-z]+', value)
    x, y = segments(a), segments(b)
    while x and y:
        p, q = x.pop(0), y.pop(0)
        if p == '~' or q == '~':
            if p != q:
                return -1 if p == '~' else 1
            continue
        if p.isdigit() != q.isdigit():
            return 1 if p.isdigit() else -1
        if p.isdigit():
            p, q = int(p), int(q)
        if p != q:
            return 1 if p > q else -1
    if x and x[0] == '~':
        return -1
    if y and y[0] == '~':
        return 1
    return (len(x) > 0) - (len(y) > 0)


SHELL_PATCH = '''--- a/gnome-shell.spec
+++ b/gnome-shell.spec
@@ -1,4 +1,4 @@
 Name:           gnome-shell
 Version:        50.3
-Release:        %autorelease
+Release:        1.luma.202%{?dist}
 Summary:        Window management and application launching for GNOME
'''
FOO_SPEC = '''Name:           luma-foo
Version:        0.1.0
Release:        1.luma.5%{?dist}
Summary:        Foo

%package sdk
Summary:        Foo SDK

%description
Foo.

%changelog
* Sun Nov 22 2026 Project Luma <maintainers@projectluma.org> - 0.1.0-1.luma.5
- First.
'''
APP_SPEC = '''Name:           luma-app
Version:        2.0
Release:        3.luma.1%{?dist}
Summary:        App
Requires:       luma-foo >= 0.1.0-1.luma.5
'''
INPUTS = '''# pins
GNOME_SHELL_LUMA_RELEASE=1.luma.202
GNOME_SHELL_NEVRA=gnome-shell-50.3-1.luma.202.fc44.x86_64
GNOME_SHELL_AARCH64_NEVRA=gnome-shell-50.3-1.luma.202.fc44.aarch64
LUMA_FOO_RELEASE=1.luma.5
LUMA_FOO_NEVRA=luma-foo-0.1.0-1.luma.5.fc44.noarch
OTHER_RELEASE=1.luma.5
'''
PACKAGES = '''gnome-shell-50.3-1.luma.202.fc44.x86_64
gnome-shell-common-50.3-1.luma.202.fc44.noarch
luma-foo-0.1.0-1.luma.5.fc44.noarch
luma-foo-sdk-0.1.0-1.luma.5.fc44.noarch
luma-app-2.0-3.luma.1.fc44.noarch
other-0.1.0-1.luma.5.fc44.noarch
'''


class Repo:
    def __del__(self):
        pr.close_batches()

    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.git('init', '-q', '-b', 'main')
        self.write({
            'config/os/desktop-build-groups.json': '{"schema": "org.projectluma.desktop-build-groups/v1", "groups": {}}\n',
            'patches/gnome-shell/0000-luma-fedora-spec.patch': SHELL_PATCH,
            'patches/gnome-shell/0001-fix.patch': 'one\n',
            'packaging/rpm/luma-foo.spec': FOO_SPEC,
            'packaging/rpm/luma-app.spec': APP_SPEC,
            'scripts/packages/build-luma-foo.sh': 'cp -R "$repo_root/src/luma-foo" x\ncp "$repo_root/packaging/rpm/luma-foo.spec" y\n',
            'src/luma-foo/foo.py': 'one\n',
            'src/luma-foo/README.md': 'one\n',
            'config/desktop/inputs.env': INPUTS,
            'config/desktop/packages.txt': PACKAGES,
        })
        self.commit('base')

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=t', '-c', 'user.email=t@t', *args],
                              check=True, capture_output=True, text=True).stdout.strip()

    def write(self, files):
        for path, text in files.items():
            (self.root / path).parent.mkdir(parents=True, exist_ok=True)
            (self.root / path).write_text(text)

    def commit(self, message, files=None):
        if files:
            self.write(files)
        self.git('add', '-A')
        self.git('commit', '-q', '--allow-empty', '-m', message)
        return self.git('rev-parse', 'HEAD')

    def read(self, path):
        return (self.root / path).read_text()


class Bump(unittest.TestCase):
    def test_shapes(self):
        cases = {'1.luma.30%{?dist}': '1.luma.31%{?dist}', '1.luma.4.creator20261004.1%{?dist}': '1.luma.5%{?dist}',
                 '2.luma1%{?dist}': '2.luma2%{?dist}', '%autorelease -e luma.4': '%autorelease -e luma.5',
                 '1.20251002gitcdf61dc.luma.1%{?dist}': '1.20251002gitcdf61dc.luma.2%{?dist}',
                 '1.luma.rpi%{?dist}': None, '0.68.experiment%{?dist}': None, '31%{?dist}': None,
                 '15.viola%{viola_build}.native%{native_release}%{?dist}': None}
        for old, new in cases.items():
            self.assertEqual(pr.bump(old), new, old)

    def test_every_release_in_the_tree_moves_up(self):
        tree = pr.Tree(ROOT, 'HEAD')
        for name, package in pr.packages(tree).items():
            old = pr.release_of(tree.read(package.release_file), package.series)
            new = pr.bump(old) if old else None
            if new and not old.startswith('%autorelease'):
                self.assertEqual(rpmvercmp(pr.plain(new), pr.plain(old)), 1, f'{name}: {old} -> {new}')


class Pending(unittest.TestCase):
    def setUp(self):
        self.repo = Repo()
        self.base = self.repo.git('rev-parse', 'HEAD')

    def test_source_change_gets_a_release(self):
        self.repo.commit('fix', {'patches/gnome-shell/0001-fix.patch': 'two\n'})
        plan = pr.pending(self.repo.root, self.base, 'HEAD')
        self.assertEqual(plan['gnome-shell']['to'], '1.luma.203%{?dist}')
        self.assertEqual(list(plan), ['gnome-shell'])

    def test_shell_presentation_is_shell_source(self):
        self.repo.commit('handheld', {'src/luma-shell-presentation/presentation.js': 'two\n'})
        self.assertEqual(list(pr.pending(self.repo.root, self.base, 'HEAD')), ['gnome-shell'])

    def test_markdown_and_tests_ship_nothing(self):
        self.repo.commit('docs', {'src/luma-foo/README.md': 'two\n', 'src/luma-foo/tests/test_x.py': 'x\n'})
        self.assertEqual(pr.pending(self.repo.root, self.base, 'HEAD'), {})

    def test_derived_sources(self):
        self.repo.commit('code', {'src/luma-foo/foo.py': 'two\n'})
        self.assertEqual(list(pr.pending(self.repo.root, self.base, 'HEAD')), ['luma-foo'])

    def test_hand_release_and_new_version_need_none(self):
        self.repo.commit('hand', {'src/luma-foo/foo.py': 'two\n',
                                  'packaging/rpm/luma-foo.spec': FOO_SPEC.replace('Release:        1.luma.5', 'Release:        1.luma.6')})
        self.assertEqual(pr.pending(self.repo.root, self.base, 'HEAD'), {})
        self.repo.commit('version', {'packaging/rpm/luma-foo.spec': FOO_SPEC.replace('0.1.0', '0.2.0'),
                                     'src/luma-foo/foo.py': 'three\n'})
        self.assertEqual(pr.pending(self.repo.root, self.base, 'HEAD'), {})

    def test_spec_edit_other_than_release_is_a_source_change(self):
        self.repo.commit('spec', {'packaging/rpm/luma-foo.spec': FOO_SPEC.replace('Summary:        Foo\n', 'Summary:        Foo!\n', 1)})
        self.assertEqual(list(pr.pending(self.repo.root, self.base, 'HEAD')), ['luma-foo'])


class Apply(unittest.TestCase):
    def test_every_place_a_release_is_written(self):
        repo = Repo()
        repo.write({'packaging/rpm/luma-foo.spec': FOO_SPEC.replace(
            '%changelog\n', '%changelog\n* Mon Nov 23 2026 Project Luma <maintainers@projectluma.org> - 0.1.0-@RELEASE@\n- Second.\n\n'),
            'packaging/rpm/luma-app.spec': APP_SPEC.replace('1.luma.5', '@RELEASE:luma-foo@')})
        pr.apply(repo.root, {'gnome-shell': '1.luma.203%{?dist}', 'luma-foo': '1.luma.6%{?dist}'})
        self.assertIn('+Release:        1.luma.203%{?dist}', repo.read('patches/gnome-shell/0000-luma-fedora-spec.patch'))
        foo = repo.read('packaging/rpm/luma-foo.spec')
        self.assertIn('Release:        1.luma.6%{?dist}', foo)
        self.assertIn('- 0.1.0-1.luma.6\n- Second.', foo)
        self.assertIn('- 0.1.0-1.luma.5\n- First.', foo)
        self.assertIn('luma-foo >= 0.1.0-1.luma.6', repo.read('packaging/rpm/luma-app.spec'))
        inputs = repo.read('config/desktop/inputs.env')
        for line in ('GNOME_SHELL_LUMA_RELEASE=1.luma.203', 'GNOME_SHELL_NEVRA=gnome-shell-50.3-1.luma.203.fc44.x86_64',
                     'GNOME_SHELL_AARCH64_NEVRA=gnome-shell-50.3-1.luma.203.fc44.aarch64', 'LUMA_FOO_RELEASE=1.luma.6',
                     'LUMA_FOO_NEVRA=luma-foo-0.1.0-1.luma.6.fc44.noarch', 'OTHER_RELEASE=1.luma.5'):
            self.assertIn(line + '\n', inputs)
        self.assertEqual(repo.read('config/desktop/packages.txt'), PACKAGES.replace('1.luma.202', '1.luma.203').replace(
            'luma-foo-0.1.0-1.luma.5', 'luma-foo-0.1.0-1.luma.6').replace('luma-foo-sdk-0.1.0-1.luma.5', 'luma-foo-sdk-0.1.0-1.luma.6'))

    def test_autorelease_changelog_gets_the_resolved_release(self):
        repo = Repo()
        portal = 'patches/xdg-desktop-portal/0000-luma-fedora-spec.patch'
        body = ('--- a/xdg-desktop-portal.spec\n+++ b/xdg-desktop-portal.spec\n@@ -1,4 +1,4 @@\n'
                ' Name:           xdg-desktop-portal\n Version:        1.22.1\n-Release:        %autorelease\n'
                '+Release:        %autorelease -e luma.5\n Summary:        Portal\n@@ -40,2 +40,8 @@\n %changelog\n'
                '+* Wed Nov 25 2026 Project Luma <noreply@projectluma.org> - 1.22.1-@RELEASE@\n+- Owner check.\n+\n'
                '+* Tue Nov 24 2026 Project Luma <noreply@projectluma.org> - 1.22.1-1.luma.5\n+- Names.\n+\n')
        repo.write({portal: body})
        pr.apply(repo.root, {'xdg-desktop-portal': '%autorelease -e luma.6'})
        text = repo.read(portal)
        self.assertIn('+Release:        %autorelease -e luma.6\n', text)
        self.assertIn('> - 1.22.1-1.luma.6\n+- Owner check.', text)
        self.assertIn('> - 1.22.1-1.luma.5\n+- Names.', text)
        # A floor on it in another spec, or no entry to take the number from: refused.
        repo.write({'packaging/rpm/luma-app.spec': APP_SPEC + 'Requires: xdg-desktop-portal >= 1.22.1-@RELEASE:xdg-desktop-portal@\n'})
        with self.assertRaisesRegex(ValueError, 'uses %autorelease; write a floor on it by hand'):
            pr.apply(repo.root, {'xdg-desktop-portal': '%autorelease -e luma.7'})
        repo.write({'packaging/rpm/luma-app.spec': APP_SPEC,
                    portal: body.replace('+* Tue Nov 24 2026 Project Luma <noreply@projectluma.org> - 1.22.1-1.luma.5\n', '')})
        with self.assertRaisesRegex(ValueError, 'no earlier %changelog entry'):
            pr.apply(repo.root, {'xdg-desktop-portal': '%autorelease -e luma.6'})

    def test_installer_declares_its_release(self):
        repo = Repo()
        compat = 'src/luma-installer/luma_installer/app_host_compatibility.py'
        repo.write({'packaging/rpm/luma-application-installer.spec': APP_SPEC.replace('luma-app', 'luma-application-installer')
                    .replace('3.luma.1', '1.luma.111'),
                    compat: 'X = 1\nSUPPORTED_INSTALLER_RELEASE = 111\n'})
        pr.apply(repo.root, {'luma-application-installer': '1.luma.112%{?dist}'})
        self.assertEqual(repo.read(compat), 'X = 1\nSUPPORTED_INSTALLER_RELEASE = 112\n')
        pr.apply(repo.root, {'luma-foo': '1.luma.6%{?dist}'})
        self.assertEqual(repo.read(compat), 'X = 1\nSUPPORTED_INSTALLER_RELEASE = 112\n')

    def test_filer_spec_successor_carries_the_release(self):
        series = (ROOT / 'patches/nautilus/0000-luma-fedora-spec.patch').read_text()
        complete = 'packaging/nautilus/filer-spec-complete.patch'
        self.assertEqual(pr.release_of((ROOT / complete).read_text(), True), pr.release_of(series, True))
        repo = Repo()
        repo.write({'patches/nautilus/0000-luma-fedora-spec.patch': series,
                    complete: '+Release:        1.luma.79%{?dist}\n+Requires:       x >= 0.1.0-1.luma.60\n'})
        pr.apply(repo.root, {'nautilus': '1.luma.80%{?dist}'})
        self.assertEqual(repo.read(complete), '+Release:        1.luma.80%{?dist}\n+Requires:       x >= 0.1.0-1.luma.60\n')

    def test_admission_reads_a_source_as_its_build_did(self):
        repo = Repo()
        source = repo.git('rev-parse', 'HEAD')
        pr.apply(repo.root, {'luma-foo': '1.luma.6%{?dist}'})
        read = pr.rewrite_tree(pr.Tree(repo.root, source), {'luma-foo': '1.luma.6'.replace('', '') + '%{?dist}'})
        for path in ('packaging/rpm/luma-foo.spec', 'config/desktop/inputs.env', 'config/desktop/packages.txt'):
            self.assertEqual(read(path), repo.read(path), path)
        # As the candidate record writes it, without %{?dist}.
        read = pr.rewrite_tree(pr.Tree(repo.root, source), {'luma-foo': '1.luma.6'})
        self.assertEqual(read('config/desktop/inputs.env'), repo.read('config/desktop/inputs.env'))

    def test_the_whole_tree_stays_consistent(self):
        """Every package this tree counts, released at once: the package
        release contract still holds and no pin is left behind."""
        with tempfile.TemporaryDirectory() as tmp:
            archive = subprocess.run(['git', '-C', str(ROOT), 'archive', 'HEAD', 'config', 'packaging', 'patches',
                                      'scripts', 'tests/smoke', 'changes', 'src/luma-installer/luma_installer/app_host_compatibility.py'], check=True, capture_output=True).stdout
            tarfile.open(fileobj=io.BytesIO(archive)).extractall(tmp, filter='data')
            tree = pr.Tree(Path(tmp))
            found = pr.packages(tree)
            before = pr.releases(tree, found)
            assigned = {}
            for name, package in found.items():
                old = pr.release_of(tree.read(package.release_file), package.series)
                if old and pr.bump(old):
                    assigned[name] = pr.bump(old)
            pr.apply(Path(tmp), assigned, tree)
            result = subprocess.run(['bash', 'tests/smoke/package-release-contract.sh', tmp], cwd=tmp,
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout[-2000:] + result.stderr[-2000:])
            for path in pr.PIN_FILES:
                text = (Path(tmp) / path).read_text() if (Path(tmp) / path).exists() else ''
                for token in re.split(r'[\s=,\'":]+', text):
                    match = pr.NEVRA.match(token)
                    if not match:
                        continue
                    for name in assigned:
                        package = found[name]
                        if match['release'] == before[name] and match['name'] in package.binaries and \
                                (not package.version or match['version'].split(':')[-1] == package.version):
                            self.fail(f'{path}: {token} still pins {name} at {before[name]}')


class ToolkitAdmission(unittest.TestCase):
    def test_provider_pins_and_written_releases(self):
        repo = Repo()
        repo.commit('toolkit', {'config/desktop/inputs.env': INPUTS + 'GTK4_LUMA_RELEASE=1.luma.23\n',
                                'src/luma-platform/a.c': 'one\n'})
        source = repo.git('rev-parse', 'HEAD')
        self.assertEqual(pr.toolkit_differences(repo.root, source, {}), ([], []))
        repo.write({'src/luma-platform/a.c': 'two\n'})
        self.assertEqual(pr.toolkit_differences(repo.root, source, {}), (['src/luma-platform/a.c'], []))
        repo.write({'src/luma-platform/a.c': 'one\n',
                    'config/desktop/inputs.env': INPUTS + 'GTK4_LUMA_RELEASE=1.luma.24\n'})
        self.assertEqual(pr.toolkit_differences(repo.root, source, {}), ([], ['GTK4_LUMA_RELEASE']))
        # Unrelated pins move freely.
        repo.write({'config/desktop/inputs.env': INPUTS.replace('1.luma.202', '1.luma.203') + 'GTK4_LUMA_RELEASE=1.luma.23\n'})
        self.assertEqual(pr.toolkit_differences(repo.root, source, {}), ([], []))


class Range(unittest.TestCase):
    def setUp(self):
        self.repo = Repo()
        self.old = ram.ROOT
        ram.ROOT = self.repo.root

    def tearDown(self):
        ram.ROOT = self.old

    def test_unreleased_since_the_last_release_commit(self):
        repo = self.repo
        repo.commit('add release-at-merge', {'scripts/os/release-at-merge.py': '# real\n'})
        # The script's first commit on main starts the range at its parent.
        a = repo.commit('shell fix (#1)', {'patches/gnome-shell/0001-fix.patch': 'two\n'})
        todo = ram.unreleased(repo.git('rev-parse', 'HEAD'))
        self.assertEqual(todo['gnome-shell']['commits'], [a])
        self.assertEqual(todo['gnome-shell']['to'], '1.luma.203%{?dist}')
        through = repo.git('rev-parse', 'HEAD')
        pr.apply(repo.root, {'gnome-shell': '1.luma.203%{?dist}'})
        repo.git('add', '-A')
        subprocess.run(['git', '-C', str(repo.root), '-c', f'user.name={ram.BOT[0]}', '-c', f'user.email={ram.BOT[1]}',
                        'commit', '-q', '-m', f'release: gnome-shell 1.luma.203\n\n{pr.THROUGH}: {through}'], check=True)
        self.assertEqual(ram.unreleased(repo.git('rev-parse', 'HEAD')), {})
        # A hand release after an unreleased change does not cover it.
        b = repo.commit('foo code (#2)', {'src/luma-foo/foo.py': 'two\n'})
        repo.commit('foo by hand (#3)', {'packaging/rpm/luma-foo.spec': FOO_SPEC.replace('1.luma.5%', '1.luma.6%')})
        todo = ram.unreleased(repo.git('rev-parse', 'HEAD'))
        self.assertEqual(todo['luma-foo']['commits'], [b])
        self.assertEqual(todo['luma-foo']['to'], '1.luma.7%{?dist}')
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(ram.cmd_pending(type('A', (), {'at': 'HEAD'})), 1)
        self.assertIn('UNRELEASED luma-foo', out.getvalue())

    def test_interim_release_commit(self):
        repo = self.repo
        base = repo.commit('add release-at-merge', {'scripts/os/release-at-merge.py': '# real\n'})
        # The merged change fixes the shell and sets a new luma-app version by hand.
        merge = repo.commit("Merge branch 'shell'", {'patches/gnome-shell/0001-fix.patch': 'two\n',
                                                     'packaging/rpm/luma-app.spec': APP_SPEC.replace('2.0', '2.1').replace('3.luma.1', '1.luma.1')})
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(ram.cmd_commit(None), 0)
        release = repo.git('rev-parse', 'HEAD')
        self.assertEqual(repo.git('rev-parse', 'HEAD^1'), merge)
        self.assertEqual(repo.git('log', '-1', '--format=%ae %s'),
                         f'{ram.INTERIM_BOT[1]} release: gnome-shell 1.luma.203')
        self.assertIn('GNOME_SHELL_LUMA_RELEASE=1.luma.203', repo.read('config/desktop/inputs.env'))
        self.assertEqual(ram.unreleased(release), {})
        # Source checks run on the release commit: it sets exactly what it owes.
        args = type('A', (), {'base': merge, 'head': release})
        with redirect_stdout(out):
            self.assertEqual(ram.cmd_check(args), 0)
        self.assertIn('PASS release commit', out.getvalue())
        # The forge's Source checks see merge and release as one commit on main.
        env = {**os.environ, 'GIT_AUTHOR_NAME': ram.INTERIM_BOT[0], 'GIT_AUTHOR_EMAIL': ram.INTERIM_BOT[1],
               'GIT_COMMITTER_NAME': ram.INTERIM_BOT[0], 'GIT_COMMITTER_EMAIL': ram.INTERIM_BOT[1]}
        view = subprocess.run(['git', '-C', str(repo.root), 'commit-tree', release + '^{tree}', '-p', base,
                               '-m', f'view\n\n{pr.THROUGH}: {merge}'], check=True, capture_output=True, text=True,
                              env=env).stdout.strip()
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(ram.cmd_check(type('A', (), {'base': base, 'head': view})), 0, out.getvalue())
        repo.write({'config/desktop/inputs.env': repo.read('config/desktop/inputs.env').replace('LUMA_FOO_RELEASE=1.luma.5', 'LUMA_FOO_RELEASE=1.luma.6')})
        repo.write({'packaging/rpm/luma-foo.spec': FOO_SPEC.replace('1.luma.5%', '1.luma.6%')})
        subprocess.run(['git', '-C', str(repo.root), '-c', f'user.name={ram.INTERIM_BOT[0]}',
                        '-c', f'user.email={ram.INTERIM_BOT[1]}', 'commit', '-q', '--amend', '-a', '--no-edit'], check=True)
        args = type('A', (), {'base': merge, 'head': 'HEAD'})
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(ram.cmd_check(args), 1)
        self.assertIn('FAIL release commit', out.getvalue())

    def test_check(self):
        repo = self.repo
        base = repo.git('rev-parse', 'HEAD')
        repo.commit('hand', {'src/luma-foo/foo.py': 'two\n',
                             'packaging/rpm/luma-foo.spec': FOO_SPEC.replace('1.luma.5%', '1.luma.6%'),
                             'packaging/rpm/luma-app.spec': APP_SPEC + 'Requires: @RELEASE:luma-nothing@\n'})
        args = type('A', (), {'base': base, 'head': 'HEAD'})
        for today, verdict in (('2026-11-23', 'NOTE luma-foo'), ('2026-11-30', 'FAIL luma-foo')):
            os.environ['LUMA_CONTRACT_TODAY'] = today
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(ram.cmd_check(args), 1)
            self.assertIn(verdict, out.getvalue())
            self.assertIn('@RELEASE:luma-nothing@ names no package', out.getvalue())
        del os.environ['LUMA_CONTRACT_TODAY']


class Workflows(unittest.TestCase):
    def test_builders(self):
        flows = ram.workflow_paths(ROOT)
        found = pr.packages(pr.Tree(ROOT, 'HEAD'))
        self.assertEqual(ram.builders(found['gnome-shell'], flows), ['.github/workflows/desktop-ui.yml'])
        self.assertIn('.github/workflows/desktop-toolkit.yml', ram.builders(found['luma-developer-platform'], flows))
        self.assertIn('.github/workflows/desktop-components.yml', ram.builders(found['mutter'], flows))

    def test_every_rpm_build_records_its_candidate(self):
        for path in ram.workflow_paths(ROOT):
            text = (ROOT / path).read_text()
            builds = len(re.findall(r'uses: actions/upload-artifact@', text))
            self.assertIn('uses: ./.github/actions/release-candidate', text, path)
            self.assertGreater(builds, 0)


if __name__ == '__main__':
    unittest.main()
