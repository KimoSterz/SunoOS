#!/usr/bin/env python3
"""Verify a pinned, successful native toolkit artifact before reuse in UI CI.

The pin is config/os/desktop-toolkit-cohort.json, which the release job writes
when a toolkit package gets its release (docs/decisions/056-release-at-merge.md).
A cohort is admitted when its recipes and sources at the commit it was built
from, with the releases its build recorded (RELEASE-CANDIDATE.json in the
archive) written in, are this checkout's byte for byte. In a pull request
whose toolkit sources differ from the pinned cohort, the cohort the pull
request's own toolkit run builds is admitted instead, once that run finishes.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import zipfile

ROOT = Path.cwd()
sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
import package_releases  # noqa: E402

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument('--architecture', required=True, choices=['x86_64', 'aarch64'])
p.add_argument('--output', type=Path, default=Path('build'))
p.add_argument('--providers-only', action='store_true', help='Reuse only unchanged GTK, Adwaita and fonts before rebuilding the platform')
p.add_argument('--run-id', type=int, help='Admit a successful toolkit cohort from this exact source revision')
a = p.parse_args()
pin = json.loads(Path('config/os/desktop-toolkit-cohort.json').read_text())
# Whole-archive digests are GitHub's retained upload identities, not rebuild hashes.
artifacts = {arch: (row['id'], row['sha256']) for arch, row in pin['artifacts'].items()}
run, source = pin['run'], pin['source']
# Interim cohort (GitHub Actions unavailable): built by tools/interim/ci.py
# toolkit from a release commit, on Suno-build (x86_64) and in its ARM VM
# (aarch64), the providers reused from the pinned GitHub run above and the
# platform rebuilt. Admitted only from interim CI's own run directory
# (SUNO_INTERIM_TOOLKIT, mounted read-only), through the record digests pinned
# as "interim": {"commit": SHA, "records": {arch: sha256}}. The next GitHub
# cohort pin drops it.
interim = pin.get('interim')
interim_mode = bool(interim) and not a.providers_only and not a.run_id
repo = os.environ.get('GITHUB_REPOSITORY', 'SimplyLuma/luma')
WORKFLOW = '.github/workflows/desktop-toolkit.yml'
# Provider recipes and inputs must still match the successful source revision
# (package_releases.TOOLKIT_PATHS; config/desktop/inputs.env by its provider pins).
def git(*args, **kw):
    return subprocess.run(['git', '-c', f'safe.directory={ROOT}', *args], **kw)


def api(path):
    for attempt in range(3):
        try:
            return json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/{path}'], timeout=90))
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def differences(commit, assigned):
    return package_releases.toolkit_differences(ROOT, commit, assigned, a.providers_only)


def pull_request_run():
    """This pull request's own toolkit run, once it finishes. GitHub starts it
    beside this workflow when the pull request changes the toolkit."""
    if os.environ.get('GITHUB_EVENT_NAME') != 'pull_request' or not os.environ.get('GITHUB_EVENT_PATH'):
        return None
    head = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())['pull_request']['head']['sha']
    deadline = time.time() + 100 * 60
    while time.time() < deadline:
        runs = [r for r in api(f'actions/runs?head_sha={head}&event=pull_request&per_page=50')['workflow_runs']
                if r['path'] == WORKFLOW]
        if not runs:
            return None
        latest = max(runs, key=lambda r: r['created_at'])
        if latest['status'] == 'completed':
            assert latest['conclusion'] == 'success', f"this pull request's toolkit run {latest['id']} did not succeed"
            return latest['id']
        print(f"Waiting for this pull request's toolkit run {latest['id']}", flush=True)
        time.sleep(60)
    raise SystemExit("this pull request's toolkit run did not finish in 100 minutes")


if a.run_id:
    assert not a.providers_only, 'select one admission mode'
elif not a.providers_only and not interim_mode:
    changed, keys = differences(source, pin.get('assigned', {}))
    if changed or keys:
        own = pull_request_run()
        if own:
            print(f'Toolkit sources differ from the pinned cohort ({(changed + keys)[0]}); admitting run {own}')
            a.run_id = own
if interim_mode:
    import shutil
    root = Path(os.environ.get('SUNO_INTERIM_TOOLKIT', ''))
    assert os.environ.get('SUNO_INTERIM_TOOLKIT') and root.is_dir(), 'interim toolkit cohort: interim CI artifacts not mounted (SUNO_INTERIM_TOOLKIT)'
    source = interim['commit']
    assert len(source) == 40 and all(c in '0123456789abcdef' for c in source)
    assert a.architecture in interim['records'], f'no interim {a.architecture} toolkit cohort pinned yet'
    run_dir = root / source
    body = (run_dir / f'toolkit-cohort-{a.architecture}.json').read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == interim['records'][a.architecture], 'interim toolkit record digest mismatch'
    cohort = json.loads(body)
    assert cohort['schema'] == 'org.projectSuno.interim-toolkit-cohort/v1', 'interim toolkit record schema'
    assert cohort['commit'] == source and cohort['architecture'] == a.architecture, 'interim toolkit record identity mismatch'
    ci = json.loads((run_dir / 'ci.json').read_text())
    jobs = [job for job in ci['jobs'] if job['name'] == cohort['job']]
    assert ci['commit'] == source and len(jobs) == 1, 'interim toolkit job not in its run'
    assert jobs[0].get('result', {}).get('status') == 'pass', 'interim toolkit job did not pass'
    assert jobs[0]['result'].get('cohort_record_sha256') == digest, "interim toolkit record is not its run's"
    # Every file of the run's upload, byte for byte as its record lists it; nothing else.
    stored = run_dir / cohort['artifact']
    listed = cohort['files']
    present = {str(path.relative_to(stored)) for path in stored.rglob('*') if path.is_file() or path.is_symlink()}
    assert present == set(listed), 'interim toolkit upload differs from its record'
    a.output.mkdir(parents=True, exist_ok=True)
    for name, expected in sorted(listed.items()):
        path = stored / name
        assert not path.is_symlink() and '..' not in Path(name).parts, 'unsafe interim toolkit member'
        assert hashlib.file_digest(path.open('rb'), 'sha256').hexdigest() == expected, f'interim toolkit {name} checksum mismatch'
        target = a.output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    run, artifact_id, record = f'interim-{source[:12]}', None, None
else:
    if a.run_id:
        run = a.run_id
    record = api(f'actions/runs/{run}')
    if a.run_id:
        source = record['head_sha']
        assert len(source) == 40 and all(c in '0123456789abcdef' for c in source)
    assert record['conclusion'] == 'success' and record['head_sha'] == source, 'toolkit run identity/result mismatch'
    assert record['path'] == WORKFLOW and record['name'] == 'Native desktop toolkit'
    if a.run_id:
        candidates = api(f'actions/runs/{run}/artifacts?per_page=100')['artifacts']
        selected = [row for row in candidates if row['name'] == f'desktop-toolkit-{a.architecture}']
        assert len(selected) == 1, 'ambiguous toolkit artifact'
        artifact_id = selected[0]['id']
        digest = selected[0]['digest'].removeprefix('sha256:')
        assert len(digest) == 64 and all(c in '0123456789abcdef' for c in digest)
    else:
        artifact_id, digest = artifacts[a.architecture]
    metadata = api(f'actions/artifacts/{artifact_id}')
    assert not metadata['expired'], 'pinned toolkit expired; build/check a new toolkit cohort and refresh its pinned receipts'
    assert metadata['name'] == f'desktop-toolkit-{a.architecture}'
    assert metadata['workflow_run']['id'] == run and metadata['digest'] == f'sha256:{digest}'
    a.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryFile() as archive:
        for attempt in range(3):
            archive.seek(0)
            archive.truncate()
            try:
                subprocess.run(['gh', 'api', f'repos/{repo}/actions/artifacts/{artifact_id}/zip'], stdout=archive, check=True, timeout=300)
                break
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                if attempt == 2:
                    raise
                time.sleep(2 * (attempt + 1))
        archive.seek(0)
        assert hashlib.file_digest(archive, 'sha256').hexdigest() == digest, 'toolkit archive checksum mismatch'
        archive.seek(0)
        with zipfile.ZipFile(archive) as z:
            for entry in z.infolist():
                path = Path(entry.filename)
                assert not path.is_absolute() and '..' not in path.parts, 'unsafe archive member'
                assert ((entry.external_attr >> 16) & 0o170000) != 0o120000, 'archive symlink refused'
            # The original upload glob also retained build work directories. These
            # are covered by the archive digest but are not admitted providers.
            for entry in z.infolist():
                if not any(part.startswith('work.') for part in Path(entry.filename).parts):
                    z.extract(entry, a.output)
# The releases the cohort's build wrote over its source: none for a cohort
# built from main (or before ADR-056). Covered by the archive digest.
receipt = a.output / 'RELEASE-CANDIDATE.json'
assigned = json.loads(receipt.read_text())['assigned'] if receipt.is_file() else {}
changed, keys = differences(source, assigned)
assert not keys, f'toolkit provider pin changed: {", ".join(keys)}'
reviewed_driver_equivalence = {}
# These exact driver edits leave the already-built provider payloads and
# pinned compiler inputs unchanged. All unlisted changes still fail closed.
equivalence = json.loads(Path('config/os/desktop-toolkit-provider-driver-equivalence.json').read_text())
reviewed = (equivalence['reviewed_driver_changes'] if equivalence['source_revision'] == source
            else equivalence.get('additional_sources', {}).get(source, {}))
for name in [name for name in changed if name in reviewed]:
    row = reviewed[name]
    old = git('show', f'{source}:{name}', check=True, capture_output=True).stdout
    assert hashlib.sha256(old).hexdigest() == row['from_sha256']
    assert hashlib.sha256(Path(name).read_bytes()).hexdigest() == row['to_sha256']
    reviewed_driver_equivalence[name] = row
changed = [name for name in changed if name not in reviewed_driver_equivalence]
assert not changed, f'toolkit source differs from the admitted cohort: {", ".join(changed)}'
receipt_source = (a.output / 'SOURCE-REVISION').read_text().strip()
if receipt_source != source:
    assert not interim_mode, 'interim toolkit source receipt mismatch'
    # Pull-request workflows build GitHub's test merge rather than head_sha.
    # Reuse only when that exact commit directly includes the recorded head
    # and has the identical complete tree; base-only changes fail closed.
    assert record['event'] == 'pull_request', 'toolkit source receipt mismatch'
    assert len(receipt_source) == 40 and all(c in '0123456789abcdef' for c in receipt_source)
    receipt_commit = api(f'git/commits/{receipt_source}')
    source_commit = api(f'git/commits/{source}')
    assert source in [parent['sha'] for parent in receipt_commit['parents']], 'toolkit merge head mismatch'
    assert receipt_commit['tree']['sha'] == source_commit['tree']['sha'], 'toolkit merge source tree mismatch'
merge = receipt_source
covered = set()
for manifest in a.output.glob('packages/**/SHA256SUMS'):
    for line in manifest.read_text().splitlines():
        expected, name = line.split(maxsplit=1)
        path = (manifest.parent / name.lstrip('*')).resolve()
        assert path.is_relative_to(a.output.resolve()), 'manifest path escapes output'
        assert hashlib.file_digest(path.open('rb'), 'sha256').hexdigest() == expected, str(path)
        covered.add(path)
rpms = {path.resolve() for path in a.output.glob('packages/**/*.rpm')}
assert rpms and rpms == covered, 'uncovered toolkit RPM or missing checksum entry'
if a.providers_only:
    import shutil
    platform = a.output / 'packages/Suno-developer-platform'
    if platform.exists():
        shutil.rmtree(platform)
    (a.output / 'SOURCE-REVISION').unlink()
    (a.output / 'REUSED-TOOLKIT-PROVIDERS.json').write_text(json.dumps({'run': run, 'source': source, 'receipt_source': merge, 'artifact_id': artifact_id, 'archive_sha256': digest, 'platform_reused': False, 'reviewed_driver_equivalence': reviewed_driver_equivalence}, indent=2) + '\n')
    (a.output / 'RELEASE-CANDIDATE.json').unlink(missing_ok=True)
print(f'Admitted {len(rpms)} checked {a.architecture} toolkit RPMs from successful run {run}')
