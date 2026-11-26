#!/usr/bin/python3 -I
# SPDX-License-Identifier: Apache-2.0
"""Interim CI on luma-build while GitHub Actions is unavailable.

  ci.py run --commit SHA [--base SHA]     source checks + package builds for SHA
  ci.py toolkit --commit SHA              an interim toolkit cohort built from SHA
  ci.py cohort-pin --commit SHA [--write F] [--partial]  the "interim" pin for that cohort
  ci.py record --commit SHA --job NAME --status pass|fail
  ci.py show --commit SHA

`run` reproduces the pull-request checks of .github/workflows:
  - Source checks: every `run:` step of source-checks.yml (tool installs and
    `uses:` actions excepted), in a Fedora image with the same tools;
  - Desktop packages, Native desktop components and Native desktop UI: the
    jobs whose `paths` filters match the change base..SHA, with the matrices
    their own selectors print (desktop-package-matrix.py, desktop-ui-matrix.py),
    each in a fresh checkout inside the workflow's pinned Fedora image, with
    LUMA_RPM_BUILDER_DIRECT=1, under luma-heavy. A workflow or action edit
    selects no build here (interim jobs use their own steps), except changed
    run steps of desktop-packages.yml.
x86_64 jobs run here. aarch64 jobs are written out as pending; ci-arm.sh runs
them in the Mac's native ARM VM and records them. A change to the toolkit cohort's
inputs (desktop-toolkit.yml paths) fails admission until a cohort built from it is
pinned: `toolkit` builds that cohort from a branch commit as the workflow's
incremental dispatch does (GTK, Adwaita and fonts reused from the pinned GitHub run,
authenticated by its archive digest; the platform rebuilt), on both CPUs, and writes
ARTIFACTS/<sha>/toolkit-cohort-<arch>.json: the commit, tree, image, steps, the
reused providers' receipt and the SHA-256 of every uploaded file. merge-branch.sh
builds it from a release commit that moves a toolkit package and pins those record
digests in config/os/desktop-toolkit-cohort.json ("interim") on top; admission takes
the cohort only from this run directory, mounted read-only in every job.

Artifacts land in ARTIFACTS/<sha>/<artifact name>/ with the paths the GitHub
upload kept, so tools/nightly-preflight.py --artifacts finds a pin's RPM under
the main commit that set it. ARTIFACTS/<sha>/ci.json records every check.
"""
import argparse
import datetime
import fnmatch
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(os.environ.get('LUMA_INTERIM_REPO', '/srv/dev-storage/git/luma.git'))
ARTIFACTS = Path(os.environ.get('LUMA_INTERIM_ARTIFACTS', '/srv/dev-storage/projects/luma-interim/artifacts'))
WORK = Path(os.environ.get('LUMA_INTERIM_WORK', '/srv/ssd-build/interim-ci'))
GH_CACHE = Path(os.environ.get('LUMA_INTERIM_GH_CACHE', '/srv/dev-storage/projects/luma-interim/cache/gh'))
DNF_CACHE = WORK / 'dnf-cache'
HERE = Path(__file__).resolve().parent
CHECK_IMAGE = 'localhost/luma-interim-ci:2'
NCPUS = os.environ.get('LUMA_INTERIM_NCPUS', '8')
TOOLS = 'git podman cpio curl patch rpm-build rpmdevtools dnf5-plugins python3 findutils glibc-langpack-en'


def sh(*args, **kw):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kw).stdout


# scripts/os/release-at-merge.py INTERIM_BOT: the forge's release commits.
RELEASER = ('Luma interim release', 'interim-release@luma-build.invalid')


def check_view(src, commit, base):
    """The commit Source checks run on. An interim release commit sits on its
    merge commit, so checks reading HEAD^1 would see only the release; they get
    the release's tree as one commit on main instead (its Release-through still
    names the merge), as GitHub checks a pull request's test merge."""
    parents = sh('git', '-C', str(src), 'rev-parse', f'{commit}^@').split()
    body = sh('git', '-C', str(src), 'log', '-1', '--format=%B', commit)
    through = re.search(r'^Release-through: ([0-9a-f]{40})$', body, re.M)
    author = sh('git', '-C', str(src), 'log', '-1', '--format=%ae', commit).strip()
    if author != RELEASER[1] or not through or parents == [base]:
        return commit
    env = dict(os.environ, GIT_AUTHOR_NAME=RELEASER[0], GIT_AUTHOR_EMAIL=RELEASER[1],
               GIT_COMMITTER_NAME=RELEASER[0], GIT_COMMITTER_EMAIL=RELEASER[1])
    view = sh('git', '-C', str(src), 'commit-tree', f'{commit}^{{tree}}', '-p', base, '-m',
              f'Source checks of {commit}', '-m', f'Release-through: {through.group(1)}', env=env).strip()
    sh('git', '-C', str(src), 'update-ref', 'refs/interim/check-view', view)  # job clones take refs
    return view


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def glob_re(pattern):
    """GitHub `paths` globs: * stays inside one directory, ** crosses them."""
    out, i = '', 0
    while i < len(pattern):
        if pattern.startswith('**', i):
            out += '.*'
            i += 2
        elif pattern[i] == '*':
            out += '[^/]*'
            i += 1
        elif pattern[i] == '?':
            out += '[^/]'
            i += 1
        else:
            out += re.escape(pattern[i])
            i += 1
    return re.compile(out + r'\Z')


def triggered(workflow, changed):
    paths = (workflow.get(True) or workflow.get('on') or {}).get('pull_request', {}).get('paths')
    if paths is None:
        return True
    regexes = [glob_re(p) for p in paths]
    return any(r.match(path) for r in regexes for path in changed)


def load(src, name):
    import yaml  # luma-build has PyYAML; exec-job (ARM VM) does not need it
    return yaml.safe_load((src / '.github/workflows' / name).read_text())


def inputs_env(src):
    return dict(line.split('=', 1) for line in (src / 'config/desktop/inputs.env').read_text().splitlines()
                if line and not line.startswith('#') and '=' in line)


def subst(text, values):
    return re.sub(r'\$\{\{\s*([\w.]+)\s*\}\}', lambda m: str(values.get(m.group(1), m.group(0))), text)


def upload_paths(step, values):
    lines = [subst(line.strip(), values) for line in step['with']['path'].splitlines() if line.strip()]
    return subst(step['with']['name'], values), lines


def source_checks(src):
    """One job per source-checks.yml job: its run steps, minus tool installs."""
    workflow = load(src, 'source-checks.yml')
    jobs = []
    for name, job in workflow['jobs'].items():
        steps = []
        for step in job.get('steps', []):
            run = step.get('run')
            if not run or re.search(r'apt-get|pip" install|/pip install|debconf', run):
                continue
            steps.append({'name': step.get('name', ''), 'run': run})
        if steps:
            jobs.append({'name': f'source-checks/{name}', 'kind': 'check', 'arch': 'x86_64',
                         'image': CHECK_IMAGE, 'steps': steps, 'env': {'RUNNER_TEMP': '/tmp'}})
        else:
            jobs.append({'name': f'source-checks/{name}', 'kind': 'skip', 'arch': 'x86_64',
                         'reason': 'only an external action (no local equivalent)'})
    return jobs


def module(path, name):
    import importlib.util
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def norm(name):
    return re.sub(r'[^A-Z0-9]', '_', name.upper())


def inert(src, base, path):
    """A workflow or action edit that cannot change what interim CI builds: it
    writes its own build steps and runs no `uses:` action, except the run steps
    it reads from desktop-packages.yml, which count when they differ."""
    if path == '.github/workflows/desktop-packages.yml':
        import yaml

        def runs(text):
            workflow = yaml.safe_load(text) if text else {}
            return [step['run'] for job in (workflow or {}).get('jobs', {}).values() for step in job.get('steps', []) if 'run' in step]
        done = subprocess.run(['git', '-C', str(src), 'show', f'{base}:{path}'], text=True, capture_output=True)
        return runs(done.stdout if done.returncode == 0 else '') == runs((src / path).read_text())
    return path.startswith(('.github/workflows/', '.github/actions/'))


def package_jobs(src, base, changed, full=False):
    """The package jobs GitHub would run. By default narrowed for the interim: a change to
    config/desktop/inputs.env makes GitHub rebuild every component on both CPUs; here only
    the packages whose own paths changed, or whose inputs.env keys changed, are built.
    The pin coverage in ci.json then shows every newly pinned NEVRA has a build. --full
    restores GitHub's selection."""
    values = inputs_env(src)
    old = dict(line.split('=', 1) for line in sh('git', '-C', str(src), 'show', f'{base}:config/desktop/inputs.env').splitlines()
               if line and not line.startswith('#') and '=' in line)
    keys = {key for key in old.keys() | values.keys() if old.get(key) != values.get(key)}
    narrow = list(changed) if full else [p for p in changed if p != 'config/desktop/inputs.env' and not inert(src, base, p)]

    def hit(name):
        n = norm(name)
        return not full and any(key.startswith((n + '_', 'LUMA_' + n + '_')) for key in keys)
    images = {'x86_64': values['FEDORA_RPM_BUILD_CONTAINER'], 'aarch64': values['FEDORA_RPM_BUILD_CONTAINER_AARCH64']}
    jobs = []
    admit = 'python3 scripts/os/admit-desktop-toolkit.py --architecture "$LUMA_TARGET_ARCHITECTURE"'
    # GitHub rebuilds the toolkit cohort for these paths (inputs.env among them). Interim CI
    # cannot build a cohort that a GitHub run must admit, so it proves the pinned cohort still
    # admits instead: the admission fails closed when a toolkit input really changed.
    interim = json.loads((src / 'config/os/desktop-toolkit-cohort.json').read_text()).get('interim') \
        if (src / 'config/os/desktop-toolkit-cohort.json').exists() else None
    if triggered(load(src, 'desktop-toolkit.yml'), changed):
        for arch in ('x86_64', 'aarch64'):
            # A CPU whose interim cohort is still owed (pinned --partial): pending with the ARM jobs.
            owed = bool(interim) and arch not in interim['records']
            jobs.append({'name': f'desktop-toolkit/admission/{arch}', 'kind': 'check', 'arch': arch if owed else 'x86_64',
                         'image': CHECK_IMAGE, 'env': {'LUMA_TARGET_ARCHITECTURE': arch},
                         'steps': [{'name': f'Pinned toolkit cohort still admits ({arch}); a changed toolkit '
                                    'input needs a new cohort (a GitHub run, or ci.py toolkit and its pin)',
                                    'run': admit + ' --output /tmp/toolkit'}]})
    revision = 'mkdir -p build && git -c safe.directory="$PWD" rev-parse HEAD > build/SOURCE-REVISION'

    # Desktop packages: fixed jobs, recipes and uploads read from the workflow.
    workflow = load(src, 'desktop-packages.yml')
    recipes = set(re.findall(r'scripts/packages/build-([\w.-]+)\.sh', (src / '.github/workflows/desktop-packages.yml').read_text()))
    shared = full or any(p in ('scripts/packages/run-in-rpm-builder.sh', '.github/workflows/desktop-packages.yml',
                               'scripts/packages/spec-release.sh') for p in narrow)
    if triggered(workflow, narrow) or any(hit(r) for r in recipes):
        for name, job in workflow['jobs'].items():
            include = job.get('strategy', {}).get('matrix', {}).get('include')
            archs = [row['architecture'] for row in include] if include else [job['env']['LUMA_TARGET_ARCHITECTURE']]
            for arch in archs:
                ctx = {'matrix.architecture': arch}
                steps, artifact = [], None
                for step in job['steps']:
                    run = step.get('run', '')
                    recipe = re.search(r'bash scripts/packages/build-([\w.-]+)\.sh', run)
                    if recipe and (shared or hit(recipe.group(1)) or any(f'/{recipe.group(1)}' in '/' + p for p in narrow)):
                        steps.append({'name': step.get('name', ''), 'run': subst(run, ctx)})
                    elif 'rpm --eval' in run:
                        steps.append({'name': step.get('name', ''), 'run': subst(run, ctx)})
                    if step.get('uses', '').startswith('actions/upload-artifact'):
                        artifact = upload_paths(step, ctx)
                if not any('scripts/packages/build-' in step['run'] for step in steps):
                    continue
                env = {k: subst(str(v), ctx) for k, v in job.get('env', {}).items()}
                env['RPM_BUILD_NCPUS'] = NCPUS
                jobs.append({'name': f'desktop-packages/{name}/{arch}', 'kind': 'build', 'arch': arch,
                             'image': images[arch], 'env': env, 'steps': steps,
                             'artifact': artifact[0], 'paths': artifact[1]})

    # Native desktop components: desktop-package-matrix.py selects the rows.
    dpm = module(src / 'scripts/os/desktop-package-matrix.py', 'desktop_package_matrix')
    registry = json.loads((src / dpm.REGISTRY).read_text())['groups']
    if triggered(load(src, 'desktop-components.yml'), narrow) or any(hit(g) for g in registry):
        if full:
            matrix = json.loads(sh(sys.executable, '-B', 'scripts/os/desktop-package-matrix.py', '--base', base, cwd=src))
        else:
            def prior(path):
                done = subprocess.run(['git', '-C', str(src), 'show', f'{base}:{path}'], text=True, capture_output=True)
                return done.stdout if done.returncode == 0 else None
            prev_registry = json.loads(prior(dpm.REGISTRY) or 'null') if dpm.REGISTRY in narrow else None
            prev_workflow = prior(dpm.WORKFLOW) if dpm.WORKFLOW in narrow else None
            matrix = dpm.matrix(src, set(narrow), prev_registry, prev_workflow, None)
            listed = {(row['component'], row['architecture']) for row in matrix['include']}
            matrix['include'] += [row for row in dpm.matrix(src, None)['include']
                                  if hit(row['component']) and (row['component'], row['architecture']) not in listed]
        for row in matrix['include']:
            arch, steps = row['architecture'], []
            if row['toolkit']:
                steps.append({'name': 'Admit already checked matching toolkit', 'run': admit})
            steps.append({'name': 'Build and check the selected component', 'run':
                          f'test "$(rpm --eval \'%{{_arch}}\')" = "$LUMA_TARGET_ARCHITECTURE"\n{revision}\n'
                          'export SOURCE_DATE_EPOCH=$(git -c safe.directory="$PWD" log -1 --format=%ct HEAD)\n'
                          f'bash {shlex.quote(row["recipe"])}'})
            if row['spec']:
                spec = shlex.quote(row['spec'])
                steps.append({'name': 'Verify the noarch package identity and shipped payload', 'run':
                              f'python3 scripts/os/check-native-noarch-package.py --spec {spec}\n'
                              f'd=build/packages/$(rpmspec --query --rpms --qf "%{{NAME}}" {spec})\n'
                              'ln -sfn "${d#build/}" build/.noarch-package'})
                paths = ['build/.noarch-package/RPMS/', 'build/.noarch-package/SRPMS/',
                         'build/.noarch-package/SHA256SUMS', 'build/SOURCE-REVISION']
            else:
                paths = ['build/packages/**/RPMS/', 'build/packages/**/SRPMS/', 'build/packages/**/SHA256SUMS',
                         'build/SOURCE-REVISION']
            jobs.append({'name': f'desktop-components/{row["component"]}/{arch}', 'kind': 'build', 'arch': arch,
                         'image': images[arch], 'toolkit': row['toolkit'], 'steps': steps,
                         'env': {'LUMA_TARGET_ARCHITECTURE': arch, 'LUMA_RPM_BUILDER_DIRECT': '1',
                                 'LUMA_RPM_BUILDER_ARCHITECTURE': arch, 'RPM_BUILD_NCPUS': NCPUS},
                         'artifact': f'desktop-{row["component"]}-{arch}', 'paths': paths})

    # Native desktop UI: desktop-ui-matrix.py selects the components, on both CPUs.
    ui = module(src / 'scripts/os/desktop-ui-matrix.py', 'desktop_ui_matrix')
    if triggered(load(src, 'desktop-ui.yml'), narrow) or any(hit(c) for c in ui.COMPONENTS):
        sh(sys.executable, '-B', 'tests/os/test_desktop_ui_matrix.py', cwd=src)
        if full:
            components = json.loads(sh(sys.executable, '-B', 'scripts/os/desktop-ui-matrix.py', '--base', base, cwd=src))
        else:
            components = [c for c in ui.COMPONENTS if c in ui.select(narrow) or hit(c)]
        for component in components:
            for arch in ('x86_64', 'aarch64'):
                jobs.append({'name': f'desktop-ui/{component}/{arch}', 'kind': 'build', 'arch': arch,
                             'image': images[arch], 'toolkit': True,
                             'env': {'LUMA_TARGET_ARCHITECTURE': arch, 'LUMA_RPM_BUILDER_DIRECT': '1',
                                     'LUMA_DESKTOP_UI_COMPONENT': component, 'RPM_BUILD_NCPUS': NCPUS},
                             'steps': [{'name': 'Admit already checked matching toolkit', 'run': admit},
                                       {'name': 'Build and check UI component',
                                        'run': f'{revision}\nbash scripts/os/build-desktop-ui.sh'}],
                             'artifact': f'desktop-ui-{component}-{arch}',
                             'paths': [f'build/packages/{component}/RPMS/', f'build/packages/{component}/SRPMS/',
                                       f'build/packages/{component}/SHA256SUMS', 'build/SOURCE-REVISION']})
    return jobs


def toolkit_jobs(src):
    """desktop-toolkit.yml's incremental dispatch, on both CPUs."""
    values = inputs_env(src)
    images = {'x86_64': values['FEDORA_RPM_BUILD_CONTAINER'], 'aarch64': values['FEDORA_RPM_BUILD_CONTAINER_AARCH64']}
    run = '\n'.join([
        'python3 scripts/os/admit-desktop-toolkit.py --architecture "$LUMA_TARGET_ARCHITECTURE" --providers-only',
        'dnf5 -y install build/packages/gtk4/RPMS/"$LUMA_TARGET_ARCHITECTURE"/gtk4-*.rpm build/packages/figtree-fonts/RPMS/noarch/*.rpm',
        'bash scripts/packages/build-luma-developer-platform.sh',
        'git -c safe.directory="$PWD" rev-parse HEAD > build/SOURCE-REVISION'])
    return [{'name': f'desktop-toolkit/build/{arch}', 'kind': 'build', 'arch': arch, 'image': images[arch],
             'toolkit_cohort': True,
             'env': {'LUMA_TARGET_ARCHITECTURE': arch, 'LUMA_RPM_BUILDER_DIRECT': '1', 'RPM_BUILD_NCPUS': NCPUS},
             'steps': [{'name': 'Reuse the pinned GitHub providers, build the platform', 'run': run}],
             'artifact': f'desktop-toolkit-{arch}',
             'paths': ['build/packages/**/RPMS/', 'build/packages/**/SRPMS/', 'build/packages/**/SHA256SUMS',
                       'build/SOURCE-REVISION', 'build/REUSED-TOOLKIT-PROVIDERS.json']}
            for arch in ('x86_64', 'aarch64')]


def cohort_record(out, record, job):
    """toolkit-cohort-<arch>.json for a passed toolkit build; its digest goes into the job's result."""
    import hashlib
    # collect() keeps the checkout's build/ prefix; GitHub's upload drops it (the admission's layout).
    artifact = f'{job["artifact"]}/build'
    stored = out / artifact
    files = {}
    for path in sorted(stored.rglob('*')):
        if path.is_symlink():
            raise SystemExit(f'refused: symlink in the toolkit upload: {path}')
        if path.is_file():
            files[str(path.relative_to(stored))] = hashlib.sha256(path.read_bytes()).hexdigest()
    revision = (stored / 'SOURCE-REVISION').read_text().strip()
    if revision != record['commit']:
        raise SystemExit(f'refused: toolkit upload built {revision}, not {record["commit"]}')
    providers = stored / 'REUSED-TOOLKIT-PROVIDERS.json'
    cohort = {'schema': 'org.projectluma.interim-toolkit-cohort/v1', 'commit': record['commit'], 'tree': record['tree'],
              'architecture': job['arch'], 'job': job['name'], 'image': job['image'], 'env': job['env'],
              'steps': job['steps'], 'artifact': artifact, 'built': job['result'].get('finished'),
              'log': job['result'].get('log'),
              'providers': json.loads(providers.read_text()) if providers.exists() else None, 'files': files}
    body = (json.dumps(cohort, indent=2, sort_keys=True) + '\n').encode()
    (out / f'toolkit-cohort-{job["arch"]}.json').write_bytes(body)
    job['result']['cohort_record_sha256'] = hashlib.sha256(body).hexdigest()
    job['result']['cohort_rpms'] = sum(1 for name in files if name.endswith('.rpm'))


def job_script(job):
    """The job as one bash script, run in the checkout inside its container."""
    lines = ['#!/bin/bash', 'set -uo pipefail', 'export LANG=C.UTF-8', 'cd "$JOB_SRC"',
             'git config --global --add safe.directory "*"', 'export PATH=/opt/interim-gh:$PATH']
    if job['kind'] == 'build':
        lines.append(f'dnf5 -y -q --setopt=keepcache=true install {TOOLS} >/dev/null || exit 90')
    for i, step in enumerate(job['steps']):
        lines += [f'echo "::step {i} {step["name"]}"', '(set -e', step['run'], ')',
                  'rc=$?', f'echo "::result {i} $rc"', '[ $rc = 0 ] || exit $rc']
    return '\n'.join(lines) + '\n'


def collect(src, job, dest):
    """Copy the upload's paths, kept relative to the checkout as GitHub's artifact does."""
    found = 0
    for pattern in job['paths']:
        pattern = pattern.rstrip('/')
        for path in src.glob(pattern) if any(c in pattern for c in '*?[') else [src / pattern]:
            real = path.resolve()
            if not real.exists():
                continue
            rel = path.relative_to(src)
            # The noarch link stands for build/packages/<name>; store it by that name.
            if rel.parts[:2] == ('build', '.noarch-package'):
                rel = real.relative_to(src.resolve())
            target = dest / rel
            if real.is_dir():
                shutil.copytree(real, target, dirs_exist_ok=True)
                found += sum(1 for _ in real.rglob('*.rpm'))
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(real, target)
    return found


def run_job(job, commit, origin, workdir, out):
    """Fresh checkout, the job's script in its image, artifacts into out."""
    jobdir = workdir / re.sub(r'[^A-Za-z0-9_.-]', '_', job['name'])
    src = jobdir / 'src'
    shutil.rmtree(jobdir, ignore_errors=True)
    jobdir.mkdir(parents=True)
    sh('git', 'clone', '-q', '--no-checkout', str(origin), str(src))
    sh('git', '-C', str(src), 'checkout', '-q', '--detach', commit)
    script = jobdir / 'job.sh'
    script.write_text(job_script(job))
    log = out / 'logs' / (re.sub(r'[^A-Za-z0-9_.-]', '_', job['name']) + '.log')
    log.parent.mkdir(parents=True, exist_ok=True)
    DNF_CACHE.mkdir(parents=True, exist_ok=True)
    cmd = ['podman', 'run', '--rm', '--security-opt', 'label=disable', '--pull=never',
           '--name', f'interim-ci-{commit[:8]}-{os.getpid()}',
           '-v', f'{jobdir}:{jobdir}', '-v', f'{DNF_CACHE}:/var/cache/libdnf5',
           '-v', f'{HERE}/gh:/opt/interim-gh/gh:ro', '-v', f'{HERE}/sync-noop:/opt/interim-gh/sync:ro',
           '-v', f'{GH_CACHE}:/opt/interim-gh/cache:ro',
           '-e', f'JOB_SRC={src}', '-e', 'LUMA_INTERIM_GH_CACHE=/opt/interim-gh/cache']
    if ARTIFACTS.is_dir():  # interim toolkit cohorts, admitted read-only (ci-arm.sh copies the pinned one)
        cmd += ['-v', f'{ARTIFACTS}:/opt/interim-artifacts:ro', '-e', 'LUMA_INTERIM_TOOLKIT=/opt/interim-artifacts']
    for key, value in job.get('env', {}).items():
        cmd += ['-e', f'{key}={value}']
    cmd += [job['image'], 'bash', str(script)]
    env = None
    if job['kind'] == 'build' and shutil.which('luma-heavy'):
        cmd = ['luma-heavy', 'nice', '-n', '5'] + cmd
        # Merge builds take luma-heavy's priority lane, as nightly jobs do: side builds
        # (agents' ad-hoc jobs) no longer win the lock while a merge waits.
        env = dict(os.environ, LUMA_HEAVY_PRIORITY='1')
    elif job['kind'] == 'build':
        cmd = ['nice', '-n', '5'] + cmd
    started = now()
    with log.open('w') as handle:
        handle.write(f'# {job["name"]} at {commit}\n# {shlex.join(cmd)}\n')
        handle.flush()
        rc = subprocess.run(cmd, stdout=handle, stderr=subprocess.STDOUT, env=env).returncode
    result = {'status': 'pass' if rc == 0 else 'fail', 'rc': rc, 'started': started, 'finished': now(),
              'log': str(log.relative_to(out))}
    if rc == 0 and job['kind'] == 'build':
        dest = out / job['artifact']
        shutil.rmtree(dest, ignore_errors=True)
        rpms = collect(src, job, dest)
        result['rpms'] = rpms
        if not rpms:
            result.update(status='fail', reason='upload found no RPMs (if-no-files-found: error)')
    if rc != 0:
        tail = log.read_text(errors='replace').splitlines()[-15:]
        result['tail'] = tail
    shutil.rmtree(jobdir, ignore_errors=True)
    return result


def new_pins(src, base, commit):
    """NEVRAs the commit pins that its base did not (every desktop target, as the nightly)."""
    preflight = module(HERE.parent / 'nightly-preflight.py', 'nightly_preflight')
    return sorted(preflight.pins(src, commit) - preflight.pins(src, base))


def coverage(out, record):
    """Where each newly pinned NEVRA was built, or why it has no build yet."""
    built = {rpm.name[:-4]: str(rpm.relative_to(out).parts[0]) for rpm in out.glob('*/**/*.rpm')}
    pending = any(job.get('result', {}).get('status') == 'pending' for job in record['jobs'])
    # An epoch is in the pin (NetworkManager-1:1.56.1-...) but never in the RPM's file name.
    file_name = lambda nevra: re.sub(r'-\d+:', '-', nevra, count=1)
    record['pins'] = {nevra: built.get(file_name(nevra)) or ('pending' if pending else 'unbuilt (no interim job; build on the server)')
                      for nevra in record.get('new_pins', [])}


def save(out, record, keep=()):
    """Write ci.json, keeping results another writer (ci-arm.sh via `record`) stored meanwhile."""
    import fcntl
    with open(out / 'ci.json.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = out / 'ci.json'
        if path.exists() and record.get('jobs'):
            disk = {job['name']: job.get('result') for job in json.loads(path.read_text()).get('jobs', [])}
            for job in record['jobs']:
                mine, theirs = job.get('result'), disk.get(job['name'])
                if job['name'] in keep:
                    continue
                if theirs and theirs.get('status') not in (None, 'pending') and (not mine or mine.get('status') == 'pending'):
                    job['result'] = theirs
        tmp = out / 'ci.json.tmp'
        tmp.write_text(json.dumps(record, indent=2) + '\n')
        tmp.replace(path)


def ensure_check_image():
    if subprocess.run(['podman', 'image', 'exists', CHECK_IMAGE]).returncode != 0:
        subprocess.run(['nice', '-n', '10', 'ionice', '-c3', 'podman', 'build', '-q', '-t', CHECK_IMAGE, '-f',
                        str(HERE / 'Containerfile'), str(HERE)], check=True)


def cmd_run(args):
    commit = sh('git', '-C', str(REPO), 'rev-parse', '--verify', f'{args.commit}^{{commit}}').strip()
    base = sh('git', '-C', str(REPO), 'rev-parse', '--verify', f'{args.base or commit + "^1"}^{{commit}}').strip()
    out = ARTIFACTS / commit
    if not args.plan:
        out.mkdir(parents=True, exist_ok=True)
    workdir = WORK / f'{"plan" if args.plan else "run"}-{commit[:12]}'
    shutil.rmtree(workdir, ignore_errors=True)
    workdir.mkdir(parents=True)
    os.umask(0o022)
    try:
        src = workdir / 'src'
        sh('git', 'clone', '-q', '--no-checkout', str(REPO), str(src))
        sh('git', '-C', str(src), 'checkout', '-q', '--detach', commit)
        changed = sh('git', '-C', str(src), 'diff', '--name-only', base, commit).split()
        record = {'schema': 'org.projectluma.interim-ci/v1', 'commit': commit, 'base': base,
                  'tree': sh('git', '-C', str(src), 'rev-parse', f'{commit}^{{tree}}').strip(),
                  'subject': sh('git', '-C', str(src), 'log', '-1', '--format=%s', commit).strip(),
                  'started': now(), 'changed': len(changed), 'jobs': []}
        try:
            jobs = source_checks(src) + package_jobs(src, base, changed, full=args.full)
        except SystemExit as refusal:
            if args.plan:
                print(refusal)
                return 1
            record.update(status='fail', reason=str(refusal), finished=now())
            save(out, record)
            print(refusal)
            return 1
        record['jobs'] = jobs
        record['new_pins'] = new_pins(src, base, commit)
        view = check_view(src, commit, base)
        if view != commit:
            record['check_view'] = view
        if args.plan:
            for nevra in record['new_pins']:
                print(f'pin    {nevra}')
            for job in jobs:
                print(f'{job["kind"]:6} {job["name"]}' + (f'  -> {job["artifact"]}' if job.get('artifact') else ''))
            return 0
        # --continue keeps what an earlier run of this commit settled (native failures rerun);
        # --reuse-builds takes passed package builds of an earlier merge of the same branch.
        prior = {}
        if args.resume_run and (out / 'ci.json').exists():
            for job in json.loads((out / 'ci.json').read_text()).get('jobs', []):
                result = job.get('result') or {}
                if result.get('status') in ('pass', 'skip') or (job['arch'] != os.uname().machine and result.get('status') == 'fail'):
                    prior[job['name']] = result
        reuse = {}
        if args.reuse_builds:
            first = sh('git', '-C', str(REPO), 'rev-parse', '--verify', f'{args.reuse_builds}^{{commit}}').strip()
            # A build is stale when main's own changes since the first merge select that job too.
            first_base = json.loads((ARTIFACTS / first / 'ci.json').read_text()).get('base') or \
                sh('git', '-C', str(REPO), 'rev-parse', f'{first}^1').strip()
            moved = sh('git', '-C', str(src), 'diff', '--name-only', first_base, base).split()
            stale = {job['name'] for job in package_jobs(src, first_base, moved, full=args.full)} if moved else set()
            for job in json.loads((ARTIFACTS / first / 'ci.json').read_text()).get('jobs', []):
                if job['name'] in stale:
                    continue
                if job['kind'] == 'build' and job.get('result', {}).get('status') == 'pass':
                    reuse[job['name']] = (first, job)
        for job in jobs:
            if job['name'] in prior:
                job['result'] = prior[job['name']]
            elif job['name'] in reuse and reuse[job['name']][1]['artifact'] == job.get('artifact'):
                first, old = reuse[job['name']]
                shutil.copytree(ARTIFACTS / first / old['artifact'], out / job['artifact'], dirs_exist_ok=True)
                job['result'] = dict(old['result'], reused_from=first)
        # Other-CPU jobs are listed as pending at once, so ci-arm.sh can run them meanwhile.
        for job in jobs:
            if 'result' in job:
                continue
            if job['kind'] != 'skip' and job['arch'] != os.uname().machine:
                job['result'] = {'status': 'pending', 'reason': f'{job["arch"]} runs in the ARM VM (ci-arm.sh)'}
        save(out, record)
        ensure_check_image()
        for job in jobs:
            if 'result' in job:
                continue
            if job['kind'] == 'skip':
                job['result'] = {'status': 'skip', 'reason': job['reason']}
            elif job['arch'] != os.uname().machine:
                job['result'] = {'status': 'pending', 'reason': f'{job["arch"]} runs in the ARM VM (ci-arm.sh)'}
            elif args.only_checks and job['kind'] == 'build':
                job['result'] = {'status': 'pending', 'reason': '--only-checks'}
            else:
                print(f'{now()} {job["name"]} ...', flush=True)
                job['result'] = run_job(job, view if job['kind'] == 'check' else commit, workdir / 'src', workdir, out)
                print(f'{now()} {job["name"]} {job["result"]["status"]}', flush=True)
            save(out, record)
        return finish(out, record)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def finish(out, record, keep=()):
    states = [job.get('result', {}).get('status', 'running') for job in record['jobs']]
    record['status'] = ('fail' if 'fail' in states or record.get('reason')
                        else 'running' if 'running' in states
                        else 'pending' if 'pending' in states else 'pass')
    record['finished'] = now()
    coverage(out, record)
    save(out, record, keep)
    for nevra, where in record.get('pins', {}).items():
        print(f'pin      {nevra}: {where}')
    for job in record['jobs']:
        result = job.get('result', {})
        print(f'{result.get("status", "?"):8} {job["name"]}' + (f'  ({result["reason"]})' if result.get('reason') else ''))
    print(f'CI {record["status"].upper()} {record["commit"]}')
    return 0 if record['status'] == 'pass' else 2 if record['status'] == 'pending' else 1


def cmd_toolkit(args):
    """An interim toolkit cohort from a commit: x86_64 here, aarch64 left pending for ci-arm.sh."""
    commit = sh('git', '-C', str(REPO), 'rev-parse', '--verify', f'{args.commit}^{{commit}}').strip()
    out = ARTIFACTS / commit
    if (out / 'ci.json').exists():
        raise SystemExit(f'refused: {out} already holds a CI run; a cohort gets its own commit')
    out.mkdir(parents=True)
    workdir = WORK / f'toolkit-{commit[:12]}'
    shutil.rmtree(workdir, ignore_errors=True)
    workdir.mkdir(parents=True)
    os.umask(0o022)
    try:
        src = workdir / 'src'
        sh('git', 'clone', '-q', '--no-checkout', str(REPO), str(src))
        sh('git', '-C', str(src), 'checkout', '-q', '--detach', commit)
        record = {'schema': 'org.projectluma.interim-ci/v1', 'commit': commit, 'base': None, 'kind': 'toolkit',
                  'tree': sh('git', '-C', str(src), 'rev-parse', f'{commit}^{{tree}}').strip(),
                  'subject': sh('git', '-C', str(src), 'log', '-1', '--format=%s', commit).strip(),
                  'started': now(), 'jobs': toolkit_jobs(src)}
        for job in record['jobs']:
            if job['arch'] != os.uname().machine:
                job['result'] = {'status': 'pending', 'reason': f'{job["arch"]} runs in the ARM VM (ci-arm.sh)'}
        save(out, record)
        for job in record['jobs']:
            if 'result' in job:
                continue
            print(f'{now()} {job["name"]} ...', flush=True)
            job['result'] = run_job(job, commit, workdir / 'src', workdir, out)
            if job['result']['status'] == 'pass':
                cohort_record(out, record, job)
            print(f'{now()} {job["name"]} {job["result"]["status"]}', flush=True)
            save(out, record)
        return finish(out, record)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def cmd_cohort_pin(args):
    """The admission pin for a passed interim toolkit cohort: "interim" in
    config/os/desktop-toolkit-cohort.json. Both CPUs, or with --partial the
    ones that passed (the others stay owed: their admission refuses)."""
    record = json.loads((ARTIFACTS / args.commit / 'ci.json').read_text())
    if record.get('kind') != 'toolkit':
        raise SystemExit(f'{args.commit[:12]} is not an interim toolkit cohort run')
    records = {}
    for job in record['jobs']:
        result = job.get('result', {})
        if result.get('status') == 'pass' and result.get('cohort_record_sha256'):
            records[job['arch']] = result['cohort_record_sha256']
        elif not (args.partial and result.get('status') == 'pending'):
            raise SystemExit(f'{job["name"]}: {result.get("status", "not run")} (both CPUs must pass first)')
    if not records:
        raise SystemExit('no CPU of this cohort passed')
    pin = {'commit': record['commit'], 'records': dict(sorted(records.items()))}
    if args.write:
        path = Path(args.write)
        data = json.loads(path.read_text())
        data['interim'] = pin
        path.write_text(json.dumps(data, indent=2) + '\n')
    print(json.dumps(pin, sort_keys=True))
    return 0


def cmd_record(args):
    out = ARTIFACTS / args.commit
    record = json.loads((out / 'ci.json').read_text())
    hit = [job for job in record['jobs'] if job['name'] == args.job]
    if len(hit) != 1:
        raise SystemExit(f'no job {args.job}')
    result = json.loads(Path(args.result).read_text()) if args.result else {'status': args.status, 'finished': now()}
    if args.status:
        result['status'] = args.status
    result['recorded_by'] = args.by
    hit[0]['result'] = result
    if result['status'] == 'pass' and hit[0]['kind'] == 'build':
        if not list((out / hit[0]['artifact']).rglob('*.rpm')):
            raise SystemExit(f'refused: {out / hit[0]["artifact"]} holds no RPMs')
        if hit[0].get('toolkit_cohort'):
            cohort_record(out, record, hit[0])
    return finish(out, record, keep={args.job})


def cmd_show(args):
    record = json.loads((ARTIFACTS / args.commit / 'ci.json').read_text())
    if args.json:
        print(json.dumps(record, indent=2))
        return 0
    for job in record['jobs']:
        result = job.get('result', {})
        print(f'{result.get("status", "?"):8} {job["name"]}')
    print(f'CI {record.get("status", "running").upper()} {record["commit"]}')
    return 0


def cmd_exec_job(args):
    """Run one job from a ci.json elsewhere (the ARM VM): ci-arm.sh drives it."""
    record = json.loads(Path(args.record).read_text())
    job = next(job for job in record['jobs'] if job['name'] == args.job)
    out, workdir = Path(args.out), Path(args.work)
    out.mkdir(parents=True, exist_ok=True)
    workdir.mkdir(parents=True, exist_ok=True)
    os.umask(0o022)
    result = run_job(job, record['commit'], Path(args.origin), workdir, out)
    (out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'{result["status"]} {job["name"]} ({result.get("rpms", 0)} RPMs)')
    return 0 if result['status'] == 'pass' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    run = sub.add_parser('run')
    run.add_argument('--commit', required=True)
    run.add_argument('--base')
    run.add_argument('--only-checks', action='store_true', help='source checks only; builds stay pending')
    run.add_argument('--continue', dest='resume_run', action='store_true',
                     help='keep passed results of an earlier run of this commit; rerun the rest')
    run.add_argument('--reuse-builds', metavar='COMMIT',
                     help='take passed package builds from the CI of an earlier merge of the same branch')
    run.add_argument('--full', action='store_true', help="GitHub's complete selection (inputs.env rebuilds all)")
    run.add_argument('--plan', action='store_true', help='print the jobs the change selects; run nothing')
    record = sub.add_parser('record')
    record.add_argument('--commit', required=True)
    record.add_argument('--job', required=True)
    record.add_argument('--status', choices=['pass', 'fail', 'pending'])
    record.add_argument('--result', help='result.json written by exec-job')
    record.add_argument('--by', default='ci-arm.sh')
    ex = sub.add_parser('exec-job')
    ex.add_argument('--record', required=True, help='ci.json')
    ex.add_argument('--job', required=True)
    ex.add_argument('--origin', required=True, help='git repo holding the commit')
    ex.add_argument('--work', required=True)
    ex.add_argument('--out', required=True)
    toolkit = sub.add_parser('toolkit')
    toolkit.add_argument('--commit', required=True)
    pin = sub.add_parser('cohort-pin')
    pin.add_argument('--commit', required=True)
    pin.add_argument('--write', help='config/os/desktop-toolkit-cohort.json to write the pin into')
    pin.add_argument('--partial', action='store_true', help='pin the CPUs that passed; pending ones stay owed')
    show = sub.add_parser('show')
    show.add_argument('--commit', required=True)
    show.add_argument('--json', action='store_true')
    args = parser.parse_args()
    if args.command in ('show', 'record', 'cohort-pin'):
        args.commit = sh('git', '-C', str(REPO), 'rev-parse', '--verify', f'{args.commit}^{{commit}}').strip()
    return {'run': cmd_run, 'toolkit': cmd_toolkit, 'cohort-pin': cmd_cohort_pin, 'record': cmd_record, 'show': cmd_show,
            'exec-job': cmd_exec_job}[args.command](args)


if __name__ == '__main__':
    sys.exit(main())
