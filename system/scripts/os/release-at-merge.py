#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Package releases are assigned when a change merges (ADR-056).

A pull request changes a package's source and leaves its Release, %changelog
release and pins alone. The release on main plus one is written at merge.

  release-at-merge.py plan --base REV [--head REV]
      the releases a change gets at merge
  release-at-merge.py check --base REV [--head REV]
      fail when a changed package's release cannot be assigned, or the change
      sets an assignable release by hand
  release-at-merge.py candidate [--base REV] [--out FILE]
      in a CI build checkout: write the releases this tree gets if it merges
      now, so the build makes the RPMs main will pin, and record them
  release-at-merge.py pending [--at REV]
      main commits whose source changes have no release yet; exit 1 if any
  release-at-merge.py release [--dry-run]
      the release job (.github/workflows/package-releases.yml)
  release-at-merge.py commit
      a local forge without GitHub (tools/interim/merge-branch.sh): release
      what HEAD merged in a release commit on top of it; that commit is what
      CI builds and what main moves to

Tokens a change may write: @RELEASE@ in a package's own spec or spec patch (a
%changelog entry: "- 0.1.0-@RELEASE@"), @RELEASE:<package>@ in any spec or spec
patch (a floor: "Requires: luma-developer-platform >= 0.1.0-@RELEASE:luma-developer-platform@").
"""

import argparse
import datetime
import fnmatch
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/os/lib'))
import package_releases as pr  # noqa: E402

REPO = os.environ.get('GITHUB_REPOSITORY', 'SimplyLuma/luma')
COHORT = 'config/os/desktop-toolkit-cohort.json'
TOOLKIT = {'gtk4', 'libadwaita', 'luma-developer-platform', 'google-figtree-fonts'}
UI = {'gnome-shell', 'gnome-control-center', 'nautilus'}
# Hand-set releases of packages this tree counts fail from this date; until then
# open pull requests may keep theirs.
HAND_RELEASES_FAIL_FROM = '2026-11-30'
BOT = ('github-actions[bot]', '41898282+github-actions[bot]@users.noreply.github.com')
# The interim forge's release commits (tools/interim/merge-branch.sh).
INTERIM_BOT = ('Luma interim release', 'interim-release@luma-build.invalid')
RELEASERS = {BOT[1], INTERIM_BOT[1]}
CANDIDATE_SCHEMA = 'org.projectluma.release-candidate/v1'


def git(*args, root=None):
    return pr.git(root or ROOT, *args)


def rev(name, root=None):
    return git('rev-parse', '--verify', name + '^{commit}', root=root).strip()


def main_ref(root=None):
    root = root or ROOT
    for ref in ('refs/remotes/origin/main', 'refs/heads/main'):
        if subprocess.run(['git', '-c', f'safe.directory={root}', '-C', str(root), 'rev-parse', '--verify', '-q', ref],
                          capture_output=True).returncode == 0:
            return ref
    git('fetch', '--quiet', 'origin', '+refs/heads/main:refs/remotes/origin/main', root=root)
    return 'refs/remotes/origin/main'


# -- plan, check, candidate -------------------------------------------------

def cmd_plan(args):
    plan = pr.pending(ROOT, args.base, args.head)
    for name, row in plan.items():
        print(f"{name}: {pr.plain(row['from'])} -> {pr.plain(row['to']) if row['to'] else 'cannot be counted'} "
              f"at merge ({row['sources'][0]})")
    if not plan:
        print('no package release at merge')
    return 0


def cmd_check(args):
    # The release job's own commit on main sets releases by design.
    if is_release_commit(args.head) and rev(args.base) in git('rev-parse', args.head + '^@').split():
        return check_release_commit(args.base, args.head)
    base, head = Tree(args.base), Tree(args.head)
    changed = git('diff', '--name-only', f'{args.base}...{args.head}').splitlines()
    found = pr.packages(head)
    today = os.environ.get('LUMA_CONTRACT_TODAY') or datetime.date.today().isoformat()
    failures = 0
    for name, package in sorted(found.items()):
        hits = pr.sources_changed(package, base, head, changed)
        before = pr.release_of(base.read(package.release_file), package.series)
        after = pr.release_of(head.read(package.release_file), package.series)
        before, after = (pr.plain(v) if v else v for v in (before, after))
        if not hits and before == after:
            continue
        version_moved = pr.version_of(base.read(package.release_file), package.series) != \
            pr.version_of(head.read(package.release_file), package.series)
        if before is None or version_moved:
            print(f'PASS {name}: {"new package" if before is None else "new version"} at {after}')
        elif before != after:
            # A hand-set release collides with every other open change to the package.
            if pr.bump(before) is None:
                print(f'PASS {name}: {before} -> {after} (set by hand; this release shape is not counted)')
            elif today >= HAND_RELEASES_FAIL_FROM:
                failures += 1
                print(f'FAIL {name}: {package.release_file} sets Release {after} by hand; leave it at {before}, '
                      f'the release is assigned at merge (ADR-056)')
            else:
                print(f'NOTE {name}: {before} -> {after} set by hand; from {HAND_RELEASES_FAIL_FROM} this fails, '
                      f'leave it at {before} (ADR-056)')
        elif pr.bump(before) is None:
            failures += 1
            print(f'FAIL {name}: {len(hits)} source file(s) changed ({hits[0]}) and Release {before} '
                  f'in {package.release_file} cannot be counted; set the next release by hand')
        else:
            print(f'PASS {name}: {pr.plain(before)} -> {pr.plain(pr.bump(before))} at merge ({hits[0]})')
    # Every token must name a package the tree releases.
    current = pr.releases(head, found)
    for path in sorted({p.release_file for p in found.values()} |
                       {p for p in head.files('packaging/rpm/') if p.endswith('.spec')}):
        for match in pr.TOKEN.finditer(head.read(path) or ''):
            owner = next((p.name for p in found.values() if p.release_file == path), None)
            target = match.group(1) or owner
            if target not in current:
                failures += 1
                print(f'FAIL {path}: {match.group(0)} names no package this tree releases')
    return 1 if failures else 0


def Tree(revision):
    return pr.Tree(ROOT, revision)


def is_commit(name):
    return subprocess.run(['git', '-c', f'safe.directory={ROOT}', '-C', str(ROOT), 'cat-file', '-e', f'{name}^{{commit}}'],
                          capture_output=True).returncode == 0


def candidate_base():
    """What the checkout merges onto: a pull request build's test merge sits on
    main (its first parent); any other build is measured from where it leaves
    main."""
    if os.environ.get('GITHUB_EVENT_NAME') == 'pull_request':
        if not is_commit('HEAD^1'):
            git('fetch', '--quiet', '--no-tags', '--depth=2', 'origin', rev('HEAD'))
        return rev('HEAD^1')
    if git('rev-parse', '--is-shallow-repository').strip() == 'true':
        git('fetch', '--quiet', '--no-tags', '--unshallow', 'origin')
    return git('merge-base', 'HEAD', main_ref()).strip()


def cmd_candidate(args):
    base = args.base or candidate_base()
    plan = pr.pending(ROOT, base, 'HEAD')
    assigned = {name: row['to'] for name, row in plan.items() if row['to']}
    changed = pr.apply(ROOT, assigned)
    record = {'schema': CANDIDATE_SCHEMA, 'head': rev('HEAD'), 'base': rev(base),
              'assigned': {name: pr.plain(value) for name, value in assigned.items()},
              'from': {name: pr.plain(plan[name]['from']) for name in assigned}}
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')
    for name in sorted(assigned):
        print(f"candidate {name} {record['from'][name]} -> {record['assigned'][name]}")
    print(f'{len(assigned)} candidate release(s) over {base[:12]}; {len(changed)} file(s) written')
    return 0


# -- the release range on main ----------------------------------------------

def trailers(commit, root=None):
    body = git('log', '-1', '--format=%B', commit, root=root)
    found = {}
    for line in body.splitlines():
        match = re.match(r'^([A-Za-z-]+):\s*(.*)$', line)
        if match:
            found[match.group(1)] = match.group(2).strip()
    return found


def is_release_commit(commit, root=None):
    return pr.THROUGH in trailers(commit, root) and \
        git('log', '-1', '--format=%ae', commit, root=root).strip() in RELEASERS


def released_by(base, head):
    """{package: release} for the packages whose release moved from base to head."""
    before, after = Tree(base), Tree(head)
    moved = {}
    for name, package in pr.packages(after).items():
        new = pr.release_of(after.read(package.release_file), package.series)
        if new and new != pr.release_of(before.read(package.release_file), package.series):
            moved[name] = pr.plain(new)
    return moved


def check_release_commit(base, head):
    """A release commit sets exactly the releases its range is owed. base is its
    parent, or for the interim forge's Source checks the main commit its merge
    went onto (one commit with the merge and its release, so checks that read
    HEAD^1 see the whole change); releases the merged change set itself are
    then already in Release-through."""
    through = trailers(head)[pr.THROUGH]
    moved = released_by(base, head)
    changed = git('diff', '--name-only', base, head).splitlines()
    if not moved and changed and set(changed) <= {COHORT}:
        print(f'PASS release commit {rev(head)[:12]}: toolkit cohort pin only')
        return 0
    owed = {name: pr.plain(row['to']) for name, row in unreleased(through).items() if row['to']}
    before = pr.releases(Tree(through))
    problems = [f'{name} is owed {value} and gets {moved.get(name)}' for name, value in sorted(owed.items())
                if moved.get(name) != value]
    problems += [f'{name} {value} is not owed' for name, value in sorted(moved.items())
                 if name not in owed and before.get(name) != value]
    for problem in problems:
        print(f'FAIL release commit {rev(head)[:12]}: {problem}')
    if not problems:
        print(f'PASS release commit {rev(head)[:12]}: ' + (', '.join(f'{n} {v}' for n, v in sorted(owed.items())) or 'nothing owed'))
    return 1 if problems else 0


def last_release(tip, root=None):
    """(release commit, Release-through) of the newest release commit on tip's
    first-parent history; before the first one, the main commit before
    release-at-merge started."""
    # Only the release job's own commits count; a message quoting the trailer does not.
    out = [line.split()[0] for line in git('log', '--first-parent', '-n', '2000', '--format=%H %ae',
                                           f'--grep=^{pr.THROUGH}: ', tip, root=root).splitlines()
           if len(line.split()) == 2 and line.split()[1] in RELEASERS]
    if out:
        return out[0], trailers(out[0], root)[pr.THROUGH]
    intro = git('log', '--first-parent', '--diff-filter=A', '--format=%H', tip, '--',
                'scripts/os/release-at-merge.py', root=root).split()
    if not intro:
        return None, None    # before ADR-056: releases were set by hand
    return None, rev(intro[-1] + '^1', root)


def unreleased(tip, root=None):
    root = root or ROOT
    """Packages with source changes merged after the last release.

    {name: {"from", "to", "commits": [...], "sources": [...]}}. A change that set
    its own release (a Version update, a new package, a hand bump) covers its own
    sources; an earlier unreleased change to the package stays unreleased."""
    _release, through = last_release(tip, root)
    if through is None:
        return {}
    commits = git('rev-list', '--first-parent', '--reverse', f'{through}..{tip}', root=root).split()
    state = {}
    found = pr.packages(pr.Tree(root, tip))
    for commit in commits:
        if is_release_commit(commit, root):
            continue
        parent = rev(commit + '^1', root)
        base, head = pr.Tree(root, parent), pr.Tree(root, commit)
        changed = git('diff', '--name-only', parent, commit, root=root).splitlines()
        if not changed:
            continue
        for name, package in found.items():
            hits = pr.sources_changed(package, base, head, changed)
            if hits and not pr.release_moved(package, base, head):
                row = state.setdefault(name, {'commits': [], 'sources': []})
                row['commits'].append(commit)
                row['sources'] += [h for h in hits if h not in row['sources']]
    tip_tree = pr.Tree(root, tip)
    for name, row in state.items():
        current = pr.release_of(tip_tree.read(found[name].release_file), found[name].series) if name in found else None
        row['from'], row['to'] = current, (pr.bump(current) if current else None)
    return {name: row for name, row in state.items() if name in found}


def cmd_pending(args):
    tip = rev(args.at or 'HEAD')
    todo = unreleased(tip)
    if not todo:
        print(f'{tip[:12]}: every merged source change has its release')
        return 0
    earliest = min((git('rev-list', '--count', row['commits'][0]).strip(), row['commits'][0]) for row in todo.values())[1]
    for name, row in sorted(todo.items()):
        print(f"UNRELEASED {name} {pr.plain(row['from'])}: {' '.join(c[:12] for c in row['commits'])}")
    print(f'{tip[:12]} has merged source changes without their release commit yet. Build from a commit before '
          f'{earliest[:12]} ({rev(earliest + "^1")[:12]}), or wait for the release job.')
    return 1


# -- GitHub ------------------------------------------------------------------

def gh(path, method='GET', fields=()):
    command = ['gh', 'api', '-X', method, f'repos/{REPO}/{path}']
    for key, value in fields:
        command += ['-f', f'{key}={value}']
    for attempt in range(4):
        result = subprocess.run(command, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            return json.loads(result.stdout) if result.stdout.strip() else None
        if attempt == 3:
            raise RuntimeError(f'gh api {path}: {result.stderr.strip()}')
        time.sleep(3 * (attempt + 1))


def pull_of(commit):
    pulls = gh(f'commits/{commit}/pulls') or []
    if pulls:
        return pulls[0]['number']
    subject = git('log', '-1', '--format=%s', commit)
    match = re.search(r'\(#(\d+)\)$', subject) or re.match(r'^Merge pull request #(\d+)', subject)
    return int(match.group(1)) if match else None


def workflow_paths(root=None):
    """{workflow file: [pull_request path globs]} for workflows that build RPMs."""
    root = root or ROOT
    found = {}
    for path in sorted((root / '.github/workflows').glob('*.yml')):
        text = path.read_text()
        match = re.search(r'^  pull_request:\n    paths:\n((?:      - .*\n)+)', text, re.M)
        builds = 'upload-artifact' in text and ('build/packages/' in text or 'RPMS' in text)
        if not match or not builds or 'workflow_dispatch' not in text:
            continue
        found[f'.github/workflows/{path.name}'] = [line.split('- ', 1)[1].strip().strip("'\"")
                                                   for line in match.group(1).splitlines()]
    return found


def glob_match(path, pattern):
    regex = re.escape(pattern).replace(r'\*\*', '.*').replace(r'\*', '[^/]*')
    return re.fullmatch(regex, path) is not None or fnmatch.fnmatch(path, pattern)


def builders(package, flows):
    """Workflows that make a package's RPMs: those whose pull_request paths take
    its spec or spec patch. The toolkit, UI and component workflows rebuild on
    many shared paths but make only their own packages."""
    own = {'desktop-toolkit.yml': package.name in TOOLKIT, 'desktop-ui.yml': package.name in UI,
           'desktop-components.yml': package.group is not None}
    return sorted(wf for wf, globs in flows.items()
                  if own.get(Path(wf).name, True) and any(glob_match(package.release_file, g) for g in globs))


def candidates_of(run_id):
    """The release-candidate records a CI run left, merged."""
    rows = [a for a in gh(f'actions/runs/{run_id}/artifacts?per_page=100')['artifacts']
            if a['name'].startswith('release-candidate-') and not a['expired']]
    if not rows:
        return None
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['gh', 'run', 'download', str(run_id), '--repo', REPO, '-n', rows[0]['name'], '-D', tmp],
                       check=True, capture_output=True)
        records = [json.loads(p.read_text()) for p in Path(tmp).rglob('*.json')]
    return records[0] if records and records[0].get('schema') == CANDIDATE_SCHEMA else None


def reuse(name, row, package, flows):
    """The successful PR runs whose RPMs are exactly this release, or None.

    Only when one merged change touched the package since its last release and
    its last CI build assigned the same release (its base had the release main
    has now)."""
    if len(row['commits']) != 1:
        return None
    number = pull_of(row['commits'][0])
    if not number:
        return None
    head = gh(f'pulls/{number}')['head']['sha']
    runs = gh(f'actions/runs?head_sha={head}&per_page=100')['workflow_runs']
    found = []
    for workflow in builders(package, flows):
        latest = sorted((r for r in runs if r['path'] == workflow), key=lambda r: r['created_at'])
        if not latest or latest[-1]['conclusion'] != 'success':
            return None
        record = candidates_of(latest[-1]['id'])
        if not record or record['assigned'].get(name) != pr.plain(row['to']):
            return None
        found.append({'run': latest[-1]['id'], 'workflow': workflow, 'pull': number, 'head': head,
                      'assigned': record['assigned']})
    return found


def toolkit_pin(run_id, source, assigned):
    artifacts = {}
    for row in gh(f'actions/runs/{run_id}/artifacts?per_page=100')['artifacts']:
        for arch in ('x86_64', 'aarch64'):
            if row['name'] == f'desktop-toolkit-{arch}':
                artifacts[arch] = {'id': row['id'], 'sha256': row['digest'].removeprefix('sha256:')}
    if set(artifacts) != {'x86_64', 'aarch64'}:
        raise RuntimeError(f'toolkit run {run_id} has no artifact for both CPUs')
    return {'run': run_id, 'source': source, 'assigned': assigned, 'artifacts': artifacts}


def dispatch(workflow, ref, inputs):
    fields = [('ref', ref)] + [(f'inputs[{k}]', v) for k, v in inputs.items() if v]
    gh(f'actions/workflows/{Path(workflow).name}/dispatches', 'POST', fields)


def wait_for_run(workflow, sha, limit=110 * 60):
    """The workflow_dispatch run of workflow at sha, once it completes."""
    deadline = time.time() + limit
    while time.time() < deadline:
        runs = [r for r in gh(f'actions/runs?head_sha={sha}&event=workflow_dispatch&per_page=50')['workflow_runs']
                if r['path'] == workflow]
        if runs and runs[0]['status'] == 'completed':
            return runs[0]
        time.sleep(60)
    raise RuntimeError(f'{workflow} at {sha[:12]} did not finish in {limit // 60} min')


def cmd_release(args):
    git('fetch', '--quiet', '--tags', 'origin', '+refs/heads/main:refs/remotes/origin/main')
    tip = rev('refs/remotes/origin/main')
    git('checkout', '--quiet', '--detach', tip)
    todo = unreleased(tip)
    if not todo:
        print(f'{tip[:12]}: nothing to release')
        return 0
    # A release this cannot count stays unreleased (preflight keeps refusing
    # it) until a pull request sets it by hand; the rest go out now.
    stuck = sorted(name for name, row in todo.items() if not row['to'])
    for name in stuck:
        print(f"FAIL {name}: cannot count the release after {todo.pop(name)['from']}; set it by hand in a pull request")
    if not todo:
        return 1
    found = pr.packages(pr.Tree(ROOT, tip))
    flows = workflow_paths()
    assigned = {name: row['to'] for name, row in todo.items()}
    plan, rebuild = {}, []
    for name, row in sorted(todo.items()):
        used = reuse(name, row, found[name], flows) if not args.dry_run or os.environ.get('GH_TOKEN') else None
        plan[name] = used
        if used is None and builders(found[name], flows):
            rebuild.append(name)
    pulls = sorted({p for name, row in todo.items() for p in [pull_of(c) for c in row['commits']] if p}) \
        if not args.dry_run or os.environ.get('GH_TOKEN') else []
    for name in sorted(todo):
        how = ('rebuilt on this commit' if name in rebuild else
               'no CI build' if not plan[name] else
               'built by ' + ', '.join(f"run {u['run']}" for u in plan[name]))
        print(f"{name} {pr.plain(todo[name]['from'])} -> {pr.plain(assigned[name])}: {how}")
    if args.dry_run:
        return 0

    pr.apply(ROOT, assigned)
    toolkit = TOOLKIT & set(assigned)
    if toolkit and not (toolkit & set(rebuild)):
        used = next(u for name in toolkit for u in plan[name] if u['workflow'].endswith('desktop-toolkit.yml'))
        # The pull request's cohort is main's only when its sources, with its
        # releases written in, are the release commit's (a pull request behind
        # main built without main's other toolkit changes).
        changed, keys = pr.toolkit_differences(ROOT, used['head'], used['assigned'])
        if changed or keys:
            print(f"toolkit run {used['run']} differs from the release ({(changed + keys)[0]}); rebuilding it")
            for name in toolkit:
                plan[name] = None
                rebuild.append(name)
        else:
            Path(ROOT / COHORT).write_text(json.dumps(toolkit_pin(used['run'], used['head'], used['assigned']), indent=2) + '\n')
    runs = sorted({u['run'] for used in plan.values() if used for u in used})
    subject = 'release: ' + ', '.join(f'{n} {pr.plain(assigned[n])}' for n in sorted(assigned))
    if len(subject) > 72:
        subject = f'release: {len(assigned)} packages'
    body = '\n'.join(
        f"{n} {pr.plain(assigned[n])}: " +
        ('rebuilt on this commit' if n in rebuild else 'no CI build' if not plan[n] else
         'built by ' + ', '.join(f"#{u['pull']} run {u['run']}" for u in plan[n]))
        for n in sorted(assigned))
    trailer = [f'{pr.THROUGH}: {tip}']
    if pulls:
        trailer.append('Release-pulls: ' + ' '.join(str(p) for p in pulls))
    if runs:
        trailer.append('Release-runs: ' + ' '.join(str(r) for r in runs))
    if rebuild:
        trailer.append('Release-rebuild: ' + ' '.join(rebuild))
    env = {**os.environ, 'GIT_AUTHOR_NAME': BOT[0], 'GIT_AUTHOR_EMAIL': BOT[1],
           'GIT_COMMITTER_NAME': BOT[0], 'GIT_COMMITTER_EMAIL': BOT[1]}
    subprocess.run(['git', '-C', str(ROOT), 'commit', '--quiet', '-a', '-m', subject, '-m', body,
                    '-m', '\n'.join(trailer)], check=True, env=env)
    release_commit = rev('HEAD')
    toolkit_run = None
    if toolkit & set(rebuild):
        # The admitted cohort must exist before main pins it: build it from the
        # release commit, then push the release and its cohort together.
        tag = f'release-build/{release_commit[:12]}'
        git('push', '--quiet', 'origin', f'{release_commit}:refs/tags/{tag}')
        dispatch('.github/workflows/desktop-toolkit.yml', tag,
                 {'incremental': 'true' if toolkit == {'luma-developer-platform'} else ''})
        built = wait_for_run('.github/workflows/desktop-toolkit.yml', release_commit)
        if built['conclusion'] != 'success':
            raise SystemExit(f"toolkit run {built['id']} for {release_commit[:12]} failed; nothing pushed")
        toolkit_run = built['id']
        Path(ROOT / COHORT).write_text(json.dumps(toolkit_pin(toolkit_run, release_commit, {}), indent=2) + '\n')
        subprocess.run(['git', '-C', str(ROOT), 'commit', '--quiet', '-a', '-m',
                        f'ci: admit the release toolkit cohort (run {toolkit_run})', '-m',
                        f'{pr.THROUGH}: {tip}\nRelease-runs: {toolkit_run}'], check=True, env=env)
    pushed = push(env)
    print(f'pushed {pushed[:12]}')
    rest = [n for n in rebuild if n not in TOOLKIT]
    if rest:
        release_sha = rev(pushed + ('~1' if toolkit_run else ''))
        tag = f'release-build/{release_sha[:12]}'
        git('push', '--quiet', 'origin', f'{release_sha}:refs/tags/{tag}')
        by_flow = {}
        for name in rest:
            for workflow in builders(found[name], flows):
                by_flow.setdefault(workflow, []).append(name)
        for workflow, names in sorted(by_flow.items()):
            inputs = {'toolkit_run': str(toolkit_run) if toolkit_run else ''}
            if workflow.endswith('desktop-ui.yml'):
                inputs['components'] = ','.join(sorted(UI & set(names)))
            elif workflow.endswith('desktop-components.yml'):
                inputs['groups'] = ','.join(sorted({found[n].group for n in names if found[n].group}))
            text = (ROOT / workflow).read_text()
            inputs = {k: v for k, v in inputs.items() if re.search(rf'^      {k}:$', text, re.M)}
            dispatch(workflow, tag, inputs)
            print(f'dispatched {workflow} on {tag} for {", ".join(names)}')
    return 1 if stuck else 0


def cmd_commit(args):
    tip = rev('HEAD')
    todo = unreleased(tip)
    if not todo:
        print(f'{tip[:12]}: nothing to release')
        return 0
    stuck = sorted(name for name, row in todo.items() if not row['to'])
    for name in stuck:
        print(f"FAIL {name}: cannot count the release after {pr.plain(todo[name]['from'])}; set it by hand")
    if stuck:
        return 1
    assigned = {name: row['to'] for name, row in todo.items()}
    pr.apply(ROOT, assigned)
    for name in sorted(assigned):
        print(f"{name} {pr.plain(todo[name]['from'])} -> {pr.plain(assigned[name])}")
    if TOOLKIT & set(assigned):
        print(f"toolkit release ({', '.join(sorted(TOOLKIT & set(assigned)))}): its cohort is built from the release commit")
    subject = 'release: ' + ', '.join(f'{n} {pr.plain(assigned[n])}' for n in sorted(assigned))
    if len(subject) > 72:
        subject = f'release: {len(assigned)} packages'
    body = '\n'.join(f'{n} {pr.plain(assigned[n])}: built on this commit' for n in sorted(assigned))
    env = {**os.environ, 'GIT_AUTHOR_NAME': INTERIM_BOT[0], 'GIT_AUTHOR_EMAIL': INTERIM_BOT[1],
           'GIT_COMMITTER_NAME': INTERIM_BOT[0], 'GIT_COMMITTER_EMAIL': INTERIM_BOT[1]}
    subprocess.run(['git', '-c', f'safe.directory={ROOT}', '-C', str(ROOT), 'commit', '--quiet', '-a', '-m', subject,
                    '-m', body, '-m', f'{pr.THROUGH}: {tip}'], check=True, env=env)
    print(f"release commit {rev('HEAD')[:12]} over {tip[:12]}")
    return 0


def push(env):
    for attempt in range(6):
        result = subprocess.run(['git', '-C', str(ROOT), 'push', '--quiet', 'origin', 'HEAD:refs/heads/main'],
                                capture_output=True, text=True)
        if result.returncode == 0:
            return rev('HEAD')
        # Main moved: put the release on top. A change merged meanwhile is the
        # next run's; one that edited the same release lines stops this run.
        git('fetch', '--quiet', 'origin', '+refs/heads/main:refs/remotes/origin/main')
        rebased = subprocess.run(['git', '-C', str(ROOT), 'rebase', '--quiet', 'refs/remotes/origin/main'],
                                 capture_output=True, text=True, env=env)
        if rebased.returncode:
            subprocess.run(['git', '-C', str(ROOT), 'rebase', '--abort'], capture_output=True)
            raise SystemExit(f'the release does not apply over the new main: {rebased.stderr.strip()}')
        time.sleep(2 * (attempt + 1))
    raise SystemExit('could not push the release commit')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('plan', 'check'):
        p = sub.add_parser(name)
        p.add_argument('--base', required=True)
        p.add_argument('--head', default='HEAD')
    p = sub.add_parser('candidate')
    p.add_argument('--base')
    p.add_argument('--out')
    p = sub.add_parser('pending')
    p.add_argument('--at')
    p = sub.add_parser('release')
    p.add_argument('--dry-run', action='store_true')
    sub.add_parser('commit')
    args = parser.parse_args()
    return {'plan': cmd_plan, 'check': cmd_check, 'candidate': cmd_candidate,
            'pending': cmd_pending, 'release': cmd_release, 'commit': cmd_commit}[args.command](args)


if __name__ == '__main__':
    sys.exit(main())
