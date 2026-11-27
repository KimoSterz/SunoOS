# SPDX-License-Identifier: Apache-2.0
"""Exercise the actual admission pathspec against real isolated Git histories."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/os/lib'))
import package_releases  # noqa: E402


class ActualToolkitSourceClosure(unittest.TestCase):
    def setUp(self):
        self.paths = package_releases.TOOLKIT_PATHS
        self.assertIn('assets/icon-theme/Prairie/symbolic/actions/SunoUI-*.svg', self.paths)
        self.assertNotIn('assets/icon-theme/Prairie', self.paths)
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.git('init', '-q')
        for path in ('assets/icon-theme/Prairie/symbolic/actions/SunoUI-first.svg',
                     'assets/icon-theme/Prairie/application-manifest.json',
                     'assets/icon-theme/Prairie/scalable/apps/example.svg',
                     'scripts/packages/build-Suno-developer-platform.sh',
                     'src/Suno-platform/NOTICE', 'LICENSE.md', 'config/desktop/inputs.env'):
            self.write(path, 'original\n')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@invalid',
                 '-c', 'commit.gpgsign=false', 'commit', '-qm', 'isolated source fixture')
        self.base = self.git('rev-parse', 'HEAD').stdout.strip()

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.root), *args], check=True,
                              text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def write(self, path, content):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def guarded_diff(self):
        self.git('add', '-A')
        # The index is the prospective new source tree; same Git pathspecs as
        # the production base-to-HEAD guard, with no shell wildcard expansion.
        return subprocess.run(['git', '-c', f'safe.directory={self.root}', '-C', str(self.root),
                               'diff', '--cached', '--exit-code', self.base, '--', *self.paths],
                              text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode

    def test_unconsumed_manifest_and_app_artwork_do_not_rebuild_toolkit(self):
        self.write('assets/icon-theme/Prairie/application-manifest.json', 'export metadata\n')
        self.write('assets/icon-theme/Prairie/scalable/apps/example.svg', 'app art\n')
        self.assertEqual(self.guarded_diff(), 0)

    def test_modified_consumed_glyph_is_refused(self):
        self.write('assets/icon-theme/Prairie/symbolic/actions/SunoUI-first.svg', 'changed\n')
        self.assertEqual(self.guarded_diff(), 1)

    def test_added_consumed_glyph_is_refused(self):
        self.write('assets/icon-theme/Prairie/symbolic/actions/SunoUI-added.svg', 'new\n')
        self.assertEqual(self.guarded_diff(), 1)

    def test_deleted_consumed_glyph_is_refused(self):
        (self.root / 'assets/icon-theme/Prairie/symbolic/actions/SunoUI-first.svg').unlink()
        self.assertEqual(self.guarded_diff(), 1)

    def test_recipe_notice_and_license_remain_guarded(self):
        # config/desktop/inputs.env is compared by its provider pins
        # (package_releases.toolkit_differences).
        for path in ('scripts/packages/build-Suno-developer-platform.sh',
                     'src/Suno-platform/NOTICE', 'LICENSE.md'):
            with self.subTest(path=path):
                self.git('reset', '--hard', '-q', self.base)
                self.write(path, 'changed\n')
                self.assertEqual(self.guarded_diff(), 1)


if __name__ == '__main__':
    unittest.main()
