# ADR-056: Package releases are assigned at merge

- **Status:** Accepted
- **Date:** 2026-11-23
- **Owner:** Project Luma
- **Review basis:** `scripts/os/source-release-bump.py` (#579), `tests/smoke/package-release-contract.sh`, `scripts/os/admit-desktop-toolkit.py`, `tools/nightly-preflight.py`, the desktop build workflows and main's history from 2026-11-16 to 2026-11-23
- **Revisit trigger:** a merge queue on main; CI builds that run on main instead of on pull requests; a release shape `bump()` cannot count becoming common

## Problem

Every pull request that changed a package chose its next release and wrote it in five places: the spec or spec patch `Release:`, its `%changelog`, `config/desktop/inputs.env`, `config/desktop/packages.txt`, and the toolkit cohort pin in `admit-desktop-toolkit.py` when the toolkit moved. Open pull requests chose the same number. In one evening #525, #537, #543 and #589 all claimed gnome-shell 1.luma.203, and others did the same for gnome-control-center, mutter and luma-developer-platform. Each merge made every other pull request on the same package bump again, rebuild, re-admit a toolkit cohort and wait for CI.

Measured on main from 2026-11-16 to 2026-11-23: 40 commits were re-bumps, merges of main to take a new number, or "admit cohort" commits (15 cohort re-admissions in 3 days). Native desktop UI ran 392 times. Any `inputs.env` edit selects all three UI components on both CPUs (`desktop-ui-matrix.py`), so a release edit for an unrelated package rebuilt the whole Shell, Settings and Files. When the numbers were taken, 40 workflow runs were queued for runners.

## Decision

1. **A pull request does not choose a release.** It changes sources and leaves `Release:`, pins and the cohort pin at main's values. A new `%changelog` entry names its release `@RELEASE@` (`- 0.1.0-@RELEASE@`). A floor on another package's new release is `@RELEASE:<package>@` (`Requires: luma-developer-platform >= 0.1.0-@RELEASE:luma-developer-platform@`). A Version update or a new package still sets its first release, and so does a release shape the tool cannot count (below).
2. **The release is main's plus one, assigned when the change merges.** `.github/workflows/package-releases.yml` runs after every push to main. It releases every package whose sources changed since the last release commit and writes the release into the spec or spec patch, its tokens, `inputs.env`, `packages.txt` and `config/depot/packages.txt`. Then it pushes one release commit (`release: gnome-shell 1.luma.203`, trailers `Release-through`, `Release-pulls`, `Release-runs`, `Release-rebuild`). One run happens at a time, and a run covers everything merged since the previous release commit. A run GitHub replaces while it waits therefore loses nothing. Workflow tokens are read-only by default, and main has no branch protection or rulesets, so the job's own `contents: write` is enough to push. Nothing else gets write access.
3. **PR builds make the RPMs main will pin.** Every RPM-building job runs `.github/actions/release-candidate` first. On a pull request's test merge, that writes main's release plus one for each changed package (`release-at-merge.py candidate`) and records it in a `release-candidate-*` artifact. A PR build therefore has exactly the NEVRA main assigns if nothing else on that package merges first. It needs no secrets, so pull requests from forks work the same way.
4. **Reuse when exact, rebuild otherwise.** The release job uses the merged pull request's RPMs only when that pull request was the one change to the package since its last release, and its last CI build recorded the release the job assigns. In any other case, such as two pull requests racing on gnome-shell or a build that did not finish, the job dispatches the package's workflow on a `release-build/<sha>` tag of the release commit. The race costs one rebuild on main and nothing from either author.
5. **The toolkit cohort pin is data the release job owns.** It moved to `config/os/desktop-toolkit-cohort.json` (run, source, the releases its build wrote, artifact ids and digests). When a toolkit package gets a release, the job pins the merged pull request's toolkit run if it is exact. Otherwise it builds the cohort from the release commit first, then pushes the release and the pin together, so main never pins a cohort that does not exist. A pull request that changes the toolkit admits its own toolkit run automatically once that run finishes. Authors never edit the pin.
6. **Admission checks content, not ancestry.** A cohort is admitted when its recipes and sources at the commit it was built from, with the releases its build recorded (`RELEASE-CANDIDATE.json`, inside the digest-checked archive), match the checkout byte for byte. Provider pins in `inputs.env` are compared by key. The source commit is fetched when the checkout lacks it, so a squash-merged pull request's cohort is admitted like any other. The 2026-11-18 failure, where a squash merge left the pinned commit off main, cannot recur.
7. **Nothing builds from a commit with unreleased changes.** `release-at-merge.py pending` lists merged source changes that have no release commit yet. `tools/nightly-preflight.py` refuses such a commit (exit 2) and names the last commit before the first unreleased merge. `scripts/os/nightly.sh` stops on it too. Preflight takes RPMs only from the runs that the commit which set a pin names. A sibling RPM comes along only when the same commit pinned it, so another pull request's build of the same NEVRA is never picked up.

## Interim forge

While GitHub is unavailable, `tools/interim/merge-branch.sh` merges on luma-build. It runs `release-at-merge.py commit` on each merge commit, which writes the release commit at once (author `Luma interim release`, `Release-through: <merge>`). Interim CI builds that release commit, and main fast-forwards to it, so every pin on interim main names RPMs built from exactly that tree and no commit on main has unreleased changes. Source checks see the merge and its release as one commit on main, so checks that read `HEAD^1` see the whole change. The release job counts both identities' commits, so it carries on from the last interim release when GitHub returns.

## What "changed source" means

`scripts/os/lib/package_releases.py` lists each package with its sources:
- every patch series, plus the other paths of its build group;
- every `config/os/desktop-build-groups.json` group with a spec;
- luma-developer-platform with `src/luma-platform/`;
- every other `packaging/rpm` spec, with the `scripts/packages/build-*.sh` that names only that spec and the `src/` and `patches/` folders that script copies.

Markdown and tests ship nothing. An edit to a spec or spec patch other than its release counts as a source change.

`bump()` counts `N.luma.M`, `N.lumaM` and `%autorelease -e luma.M`. A suffix such as `.creator20261004.1` is dropped (`1.luma.4.creator20261004.1` becomes `1.luma.5`, which sorts above it). Shapes it cannot count are left to the author, as before: `1.luma.rpi`, `31`, `*.experiment`, and the Viola, kernel and Surface releases. `release-at-merge.py check` (Source checks) fails when such a package's sources change without a hand-set release. From 2026-11-30 it also fails a hand-set release of a package it can count. Until then it prints a note, so open pull requests keep working.

## Consequences

- Release-number collisions between open pull requests are gone, and so are release-only edits to `inputs.env`. Pull requests rebuild only the components whose sources they change.
- `SUPPORTED_INSTALLER_RELEASE` (`luma_installer/app_host_compatibility.py`) is written with luma-application-installer's release (`package_releases.DERIVED`). Its sources are in Depot's fingerprint, so each installer release still needs a Depot reseal.
- Every source change gets a release: the previous check covered 41 packages, and this one covers 116. Its scan of the past week of main found a luma-connect-sync source change (#580) that no release followed.
- A merge reaches the nightly once its release commit lands. That is seconds after the merge when the pull request's build was exact, or one rebuild later when it was not.
- `release-build/*` tags stay, so cohort sources and rebuild runs remain fetchable.
- A release job that fails leaves main with unreleased changes. Preflight and the nightly refuse those commits until a later run succeeds. It is a red run on main, and the workflow can be re-run by hand.
- Squash and merge commits are both safe for toolkit changes.

## Tests

`tests/os/test_release_at_merge.py`: release shapes (every counted release in the tree sorts higher after `bump()`), source detection, hand-set releases, Version changes, tokens, every pin location, history ranges across release commits and hand-set releases, `check`, toolkit content comparison, and workflow coverage. It also releases every countable package in the real tree at once and requires `package-release-contract.sh` to pass with no stale pin.
