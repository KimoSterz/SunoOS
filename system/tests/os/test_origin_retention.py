#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Origin retention and free-space refusal in scripts/os/lib/sync-origin.sh.

The origin is a local directory reached through an ssh shim, so the real
rsync invocations (prune to the union of served generations, the free-space
dry run, the upload) run end to end.
"""
from pathlib import Path
import os
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
SYNC = ROOT / 'scripts/os/lib/sync-origin.sh'
COMMON = ROOT / 'scripts/os/lib/common.sh'


def obj(name, ext='filez'):
    return f'objects/{name[:2]}/{name[2:]}.{ext}'


class OriginRetentionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='luma-origin-retention-')
        self.work = Path(self.temp.name)
        self.origin = self.work / 'origin'
        self.generations = self.work / 'generations'
        bin_dir = self.work / 'bin'
        bin_dir.mkdir()
        shim = bin_dir / 'ssh'
        # ssh [options] HOST COMMAND...: run COMMAND in the origin's web root.
        shim.write_text('#!/bin/bash\n'
                        'while [ $# -gt 0 ]; do case $1 in -i|-o|-p|-l) shift 2 ;; -*) shift ;; *) shift; break ;; esac; done\n'
                        f'cd {self.origin} && exec sh -c "$*"\n')
        shim.chmod(0o755)
        self.env = dict(os.environ, PATH=f'{bin_dir}:{os.environ["PATH"]}',
                        DL_RSYNC_DEST='luma-publish@origin.test', DL_SSH_KEY='/dev/null',
                        KNOWN_HOSTS='/dev/null', DL_HTTP_ORIGIN='http://127.0.0.1:9',
                        DL_HOST_HEADER='dl.test', DL_PUBLIC_REPO_DEST='os/preview-repo',
                        DL_ORIGIN_RESERVE_GIB='0')
        self.old = self.generation('20261125T065000Z', ['aa' + 'a' * 62, 'bb' + 'b' * 62], b'summary-old')
        self.new = self.generation('20261126T094500Z', ['bb' + 'b' * 62, 'dd' + 'd' * 62], b'summary-newer')
        repo = self.origin / 'os/preview-repo'
        for name in ('aa' + 'a' * 62, 'bb' + 'b' * 62, 'cc' + 'c' * 62):
            self.write(repo / obj(name), b'x' * 10)
        self.write(repo / 'deltas/Zz/stale-delta/superblock', b'delta')
        self.write(repo / 'luma.trustedkeys.gpg', b'key')
        self.write(repo / 'summary', b'summary-old')

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def write(path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def generation(self, name, objects, summary):
        repo = self.generations / name / 'os/repo'
        self.write(repo / 'config', b'[core]\nmode=archive-z2\n')
        self.write(repo / 'summary', summary)
        for o in objects:
            self.write(repo / obj(o), b'x' * 10)
        return self.generations / name

    def space(self, avail, age=0):
        self.write(self.origin / '.luma-origin/space',
                   f'{avail} {100 * 2**30} {int(time.time()) - age}\n'.encode())

    def run_sync(self, generation, apply, prune, keep):
        env = dict(self.env, DL_KEEP_GENERATIONS=' '.join(str(g) for g in keep))
        return subprocess.run(['bash', str(SYNC), str(generation), apply, prune, 'repo', ''],
                              env=env, capture_output=True, text=True)

    def present(self, rel):
        return (self.origin / 'os/preview-repo' / rel).exists()

    def test_prune_keeps_union_of_served_generations(self):
        result = self.run_sync(self.new, '1', '1', [self.old, self.new])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(self.present(obj('aa' + 'a' * 62)), 'object only the older served generation has')
        self.assertTrue(self.present(obj('bb' + 'b' * 62)))
        self.assertFalse(self.present(obj('cc' + 'c' * 62)), 'object no served generation has')
        self.assertFalse(self.present('deltas/Zz/stale-delta'))
        self.assertTrue(self.present('luma.trustedkeys.gpg'), 'only objects/ and deltas/ are pruned')
        self.assertTrue(self.present('summary'))

    def test_prune_skipped_when_served_summary_unknown(self):
        result = self.run_sync(self.new, '1', '1', [self.new])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('origin not pruned', result.stdout)
        self.assertTrue(self.present(obj('cc' + 'c' * 62)))
        self.assertTrue(self.present(obj('aa' + 'a' * 62)))

    def test_upload_refused_without_room(self):
        self.space(5)
        result = self.run_sync(self.new, '1', '0', [self.old, self.new])
        self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
        self.assertIn('upload refused: needs', result.stdout)
        self.assertFalse(self.present(obj('dd' + 'd' * 62)), 'nothing uploaded after a refusal')
        self.assertFalse(self.present(obj('cc' + 'c' * 62)), 'retention still ran first')

    def test_upload_refused_on_stale_or_missing_report(self):
        result = self.run_sync(self.new, '1', '0', [self.old, self.new])
        self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
        self.assertIn('reports no free space', result.stdout)
        self.space(10 * 2**30, age=3600)
        result = self.run_sync(self.new, '1', '0', [self.old, self.new])
        self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
        self.assertIn('minutes old', result.stdout)
        self.assertFalse(self.present(obj('dd' + 'd' * 62)))

    def test_upload_proceeds_with_room(self):
        self.space(10 * 2**30)
        result = self.run_sync(self.new, '1', '0', [self.old, self.new])
        # Verification through HTTP fails here (no web server); the upload ran.
        self.assertIn('origin space: upload 0 MiB', result.stdout, result.stderr)
        self.assertTrue(self.present(obj('dd' + 'd' * 62)))
        self.assertEqual((self.origin / 'os/preview-repo/summary').read_bytes(), b'summary-newer')

    def test_served_generations(self):
        now = time.time()
        names = [time.strftime('%Y%m%dT%H%M%SZ', time.gmtime(now - h * 3600)) for h in (50, 30, 1)]
        generations = self.work / 'webroot-generations'
        for name in names:
            (generations / name).mkdir(parents=True, exist_ok=True)
        (generations / (names[0] + '.partial')).mkdir()
        out = subprocess.run(['bash', '-c', f'. {COMMON}; luma_os_served_generations "$1" 20', '-', str(generations)],
                             capture_output=True, text=True, check=True).stdout.split()
        # names[0] stopped being served 30 h ago; names[1] was served until 1 h ago.
        self.assertEqual([Path(p).name for p in out], names[1:])


if __name__ == '__main__':
    unittest.main()
