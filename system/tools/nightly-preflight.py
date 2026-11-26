#!/usr/bin/python3 -I
# SPDX-License-Identifier: Apache-2.0
"""Find every pinned RPM a nightly needs that its pool lacks, and fetch it from
the CI build of the pull request that set the pin.

  nightly-preflight.py --sha SHA --have FILE --out DIR

--have lists the NEVRAs already available (one per line, extra columns
ignored), for example the pool manifest plus the loose directory and
rpms/media. Fetched RPMs land in --out; their headers are verified when the
pool admits them. Exit status 1 when a pin is still missing, naming the commit
that set it.

With --artifacts DIR (or LUMA_INTERIM_ARTIFACTS), a pin is first looked up in
DIR/<commit>/<artifact>/, the layout tools/interim/ci.py writes for the main
commit that set it, before GitHub is asked. Interim merges set pins in their
merge commits, which GitHub has never seen. Toolkit RPMs (the platform) are
looked up in the interim toolkit cohort config/os/desktop-toolkit-cohort.json pins.

The installer media's Atlas pin (config/os/media.env) is checked too. No CI
job builds Atlas, so it is never fetched: a missing one is reported with the
revision and SHA-256 that nightly-media.sh will demand from incoming/.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tarfile
import shutil
import tempfile
import os
from io import BytesIO
from pathlib import Path

REPO = 'SimplyLuma/luma'
CONFIG = ('config/desktop/packages.txt', 'config/desktop/inputs.env')


def run(*args, **kw):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kw).stdout


def gh(path):
    return json.loads(run('gh', 'api', path))


def pins(root, sha):
    with tempfile.TemporaryDirectory() as tmp:
        archive = subprocess.run(['git', '-C', str(root), 'archive', sha, 'config', 'scripts/os/lib'],
                                 check=True, capture_output=True).stdout
        tarfile.open(fileobj=BytesIO(archive)).extractall(tmp, filter='data')
        result = set()
        # Hardware targets (desktop-targets.json) are ARM desktops with their own packages.
        targets = json.loads(Path(tmp, 'config/os/desktop-targets.json').read_text()).get('hardware_targets', {})
        for arch, profile, target in (('x86_64', 'full', ''), ('aarch64', 'arm-preview', ''),
                                      *(('aarch64', 'arm-preview', name) for name in targets)):
            result |= set(run(sys.executable, '-I', f'{tmp}/scripts/os/lib/desktop_target.py',
                              '--root', tmp, '--arch', arch, '--profile', profile,
                              '--hardware-target', target, 'pins').split())
        return result


def media_pin(root, sha):
    """config/os/media.env's Atlas: NEVRA, SHA-256 and source revision."""
    text = run('git', '-C', str(root), 'show', f'{sha}:config/os/media.env')
    env = dict(re.findall(r'^(LUMA_MEDIA_ATLAS_[A-Z0-9_]+)=(\S*)$', text, re.M))
    return env['LUMA_MEDIA_ATLAS_NEVRA'], env['LUMA_MEDIA_ATLAS_SHA256'], env['LUMA_MEDIA_ATLAS_REVISION']


def setter(root, sha, nevra):
    """The first-parent main commit that introduced the pin. ARM pins are often
    the x86 line with its architecture swapped, so match without it."""
    stem = nevra.rsplit('.', 1)[0]
    out = run('git', '-C', str(root), 'log', '--first-parent', '--format=%H', '-S', stem, sha, '--', *CONFIG)
    return out.split()[-1] if out.split() else None


def trailers(root, commit):
    body = run('git', '-C', str(root), 'log', '-1', '--format=%B', commit)
    return dict(re.findall(r'^([A-Za-z-]+):[ \t]*(.*)$', body, re.M))


def runs(root, commit):
    """CI runs whose RPMs a main commit pins.

    A release commit (docs/decisions/056-release-at-merge.md, Release-through
    trailer) names the runs it reused (Release-runs) and the pull requests it
    released (Release-pulls); packages it rebuilt come from the runs on the
    commit itself. Any other commit: the runs of the pull request behind it,
    its head first. Just after a merge GitHub may not link the commit yet; the
    squash title's (#N) or the merge commit's "Merge pull request #N" still
    names it."""
    marks = trailers(root, commit)
    if 'Release-through' in marks:
        found = [row['id'] for row in gh(f'repos/{REPO}/actions/runs?head_sha={commit}&per_page=100')['workflow_runs']]
        found += [int(r) for r in marks.get('Release-runs', '').split() if int(r) not in found]
        for number in marks.get('Release-pulls', '').split():
            head = gh(f'repos/{REPO}/pulls/{number}')['head']['sha']
            found += [row['id'] for row in gh(f'repos/{REPO}/actions/runs?head_sha={head}&per_page=100')['workflow_runs']
                      if row['id'] not in found]
        return found
    pulls = gh(f'repos/{REPO}/commits/{commit}/pulls')
    if not pulls:
        # Squash titles end in "(#N)"; merge commits (toolkit PRs merge with --merge) start "Merge pull request #N".
        title = run('git', '-C', str(root), 'log', '-1', '--format=%s', commit).strip()
        number = re.search(r'\(#(\d+)\)$', title) or re.match(r'Merge pull request #(\d+) ', title)
        pulls = [gh(f'repos/{REPO}/pulls/{number.group(1)}')] if number else []
    found = []
    for pull in pulls[:1]:
        head, branch = pull['head']['sha'], pull['head']['ref']
        for query in (f'head_sha={head}', f'branch={branch}&per_page=30'):
            for row in gh(f'repos/{REPO}/actions/runs?{query}')['workflow_runs']:
                if row['id'] not in found:
                    found.append(row['id'])
    return found


def fetch(run_id, nevra, out, wanted):
    arch = nevra.rsplit('.', 1)[1]
    for artifact in gh(f'repos/{REPO}/actions/runs/{run_id}/artifacts')['artifacts']:
        name = artifact['name']
        if artifact['expired'] or (arch != 'noarch' and not name.endswith(arch)):
            continue
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(['gh', 'run', 'download', str(run_id), '--repo', REPO, '-n', name, '-D', tmp],
                           check=True, capture_output=True)
            hits = [p for p in Path(tmp).rglob(f'{file_name(nevra)}.rpm')]
            names = {file_name(n) for n in wanted}
            for rpm in Path(tmp).rglob('*.rpm'):
                # Other missing pins from the same build come along at no extra cost.
                if rpm.name[:-4] in names and not (out / rpm.name).exists():
                    rpm.replace(out / rpm.name)
            if hits:
                return name
    return None


def file_name(nevra):
    """The RPM's file name for a pin (an epoch, as in NetworkManager-1:1.56.1-..., is not in it)."""
    return re.sub(r'-\d+:', '-', nevra, count=1)


def cached_cohort(cache, nevra, out, wanted):
    """A toolkit cohort RPM held only in the offline gh cache (tools/interim/gh-snapshot.sh): the
    snapshotted desktop-toolkit-* archives, each checked against the digest GitHub recorded for it."""
    import zipfile
    arch = nevra.rsplit('.', 1)[1]
    names = {file_name(n) + '.rpm' for n in wanted}
    for meta in sorted(Path(cache).glob('*_actions_artifacts_[0-9]*')):
        if meta.name.endswith('_zip'):
            continue
        archive = meta.with_name(meta.name + '_zip')
        try:
            record = json.loads(meta.read_text())
        except (OSError, ValueError):
            continue
        name = record.get('name', '')
        if not archive.exists() or not name.startswith('desktop-toolkit-') or (arch != 'noarch' and not name.endswith(arch)):
            continue
        if 'sha256:' + hashlib.sha256(archive.read_bytes()).hexdigest() != record.get('digest'):
            continue
        with zipfile.ZipFile(archive) as z:
            members = {Path(m).name: m for m in z.namelist() if m.endswith('.rpm') and '..' not in Path(m).parts}
            if file_name(nevra) + '.rpm' not in members:
                continue
            for base, member in members.items():
                if base in names and not (out / base).exists():
                    (out / base).write_bytes(z.read(member))
            return f'{name} (run artifact {record.get("id")})'
    return None


def interim_artifact(artifacts, commit, nevra, out, wanted):
    """An interim CI artifact (tools/interim/ci.py) of the commit that set the pin."""
    arch = nevra.rsplit('.', 1)[1]
    base = artifacts / commit
    if not base.is_dir():
        return None
    for directory in sorted(base.iterdir()):
        if not directory.is_dir() or (arch != 'noarch' and not directory.name.endswith(arch)):
            continue
        hits = list(directory.rglob(f'{file_name(nevra)}.rpm'))
        if hits:
            names = {file_name(n) for n in wanted}
            for rpm in directory.rglob('*.rpm'):
                if rpm.name[:-4] in names and not (out / rpm.name).exists():
                    shutil.copy2(rpm, out / rpm.name)
            return directory.name
    return None


def interim_chain(root, commit, sha):
    """commit, then the interim forge's release and cohort commits right above it
    on sha's first-parent line."""
    chain = [commit]
    after = run('git', '-C', str(root), 'rev-list', '--first-parent', '--reverse', f'{commit}..{sha}').split()
    for child in after:
        parent, author = run('git', '-C', str(root), 'log', '-1', '--format=%P%n%ae', child).splitlines()[:2]
        if parent.split()[0] != chain[-1] or author != 'interim-release@luma-build.invalid':
            break
        chain.append(child)
    return chain


def interim_cohort(root, sha):
    """The interim toolkit cohort (tools/interim/ci.py toolkit) config/os/desktop-toolkit-cohort.json pins at sha."""
    done = subprocess.run(['git', '-C', str(root), 'show', f'{sha}:config/os/desktop-toolkit-cohort.json'],
                          capture_output=True, text=True)
    if done.returncode:
        return None
    return (json.loads(done.stdout).get('interim') or {}).get('commit')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--have', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--artifacts', type=Path, default=os.environ.get('LUMA_INTERIM_ARTIFACTS') or None,
                        help='interim CI artifacts (tools/interim/ci.py), searched before GitHub')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    # A main commit between a merge and its release commit pins the releases
    # from before the merge, while its sources are the merged ones: an image
    # built from it would ship the old RPMs under the new source revision.
    pending = subprocess.run([sys.executable, '-I', str(args.root / 'scripts/os/release-at-merge.py'), 'pending',
                              '--at', args.sha], capture_output=True, text=True)
    if (args.root / 'scripts/os/release-at-merge.py').exists() and pending.returncode:
        print(pending.stdout + pending.stderr, end='')
        print(f'REFUSED {args.sha[:12]}: not every merged change has its release yet')
        return 2
    have = {line.split()[0] for line in args.have.read_text().splitlines() if line.strip()}
    missing = sorted(pins(args.root, args.sha) - have)
    setters = {nevra: setter(args.root, args.sha, nevra) for nevra in missing}
    unresolved = []
    for nevra in missing:
        if (args.out / f'{file_name(nevra)}.rpm').exists():
            print(f'have    {nevra} (fetched with a sibling)')
            continue
        commit = setters[nevra]
        source = None
        # Siblings come along only when the same commit pinned them: another
        # change's run can hold an RPM of the same NEVRA built from other source.
        wanted = {n for n, c in setters.items() if c == commit}
        if commit and args.artifacts:
            # A release commit's pins are built by CI on the commit main moved to: the
            # release commit, or the cohort commit the forge put on top of it.
            for built in interim_chain(args.root, commit, args.sha):
                source = interim_artifact(Path(args.artifacts), built, nevra, args.out, wanted)
                if source:
                    print(f'fetched {nevra} from interim CI {built[:8]} ({source})')
                    break
            # The toolkit cohort's RPMs (the platform) live in the interim run that built it.
            cohort = interim_cohort(args.root, args.sha)
            if not source and cohort:
                source = interim_artifact(Path(args.artifacts), cohort, nevra, args.out, set(missing))
                if source:
                    print(f'fetched {nevra} from the interim toolkit cohort {cohort[:8]} ({source})')
            # A GitHub cohort's RPMs (the platform) when only the offline gh cache holds them.
            cache = os.environ.get('LUMA_INTERIM_GH_CACHE') or str(Path(args.artifacts).parent / 'cache/gh')
            if not source and Path(cache).is_dir():
                source = cached_cohort(cache, nevra, args.out, set(missing))
                if source:
                    print(f'fetched {nevra} from the gh cache ({source})')
        try:
            for run_id in runs(args.root, commit) if commit and not source else []:
                source = fetch(run_id, nevra, args.out, wanted)
                if source:
                    print(f'fetched {nevra} from run {run_id} ({source})')
                    break
        except subprocess.CalledProcessError as error:
            if not args.artifacts:
                raise
            print(f'GitHub lookup failed for {nevra} ({commit[:8]}): {error.cmd[:3]}')
        if not source:
            unresolved.append(f'{nevra} (pinned by {commit[:8] if commit else "unknown"})')
    atlas, digest, revision = media_pin(args.root, args.sha)
    local = args.out / f'{atlas}.rpm'
    if local.exists() and hashlib.sha256(local.read_bytes()).hexdigest() != digest:
        unresolved.append(f'{atlas} (installer media: {local} is not SHA-256 {digest})')
    elif atlas not in have and not local.exists():
        unresolved.append(f'{atlas} (installer media, config/os/media.env: no CI build; put the RPM with '
                          f'SHA-256 {digest}, built at {revision[:8]}, in incoming/)')
    for line in unresolved:
        print(f'MISSING {line}')
    print(f'{len(missing)} pin(s) not in the pool, {len(unresolved)} unresolved')
    return 1 if unresolved else 0


if __name__ == '__main__':
    sys.exit(main())
