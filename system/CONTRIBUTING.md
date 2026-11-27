# Contributing to Suno

Changes to OS services, bundled apps, shared UI and hardware profiles belong in this repository. Separate Creative, Office and Imager products have their own scope.

Before opening an issue, search existing reports. Include the app or component, Suno build, CPU architecture, device, steps to reproduce, expected behavior and observed behavior. Remove personal data from logs and screenshots. A device profile is not a promise of hardware support.

For code changes, keep the scope focused, explain the resulting behavior, and run the relevant component tests. Include the commands and results in your merge request. UI changes should cover desktop and narrow layouts, keyboard and touch input, and light and dark appearance where applicable. Do not replace working integrations with cosmetic placeholders.

Preserve upstream notices and license terms. New original source follows the defaults in LICENSE.md; add an SPDX license identifier and the correct copyright attribution. Contributors must have the right to submit their changes. Do not add someone else's sign-off or claim tests you did not run.

Package releases are assigned when a change merges (docs/decisions/056-release-at-merge.md). Change the package's source and leave its `Release:`, its pins in `config/desktop/inputs.env` and `config/desktop/packages.txt`, and `config/os/desktop-toolkit-cohort.json` as they are on main. Write a new `%changelog` entry's release as `@RELEASE@` (`- 0.1.0-@RELEASE@`) and a floor on another package's new release as `@RELEASE:<package>@`. Set a release by hand only for a new package, a Version update, or a release shape the Source checks say cannot be counted.

Changes go through merge requests at https://gitlab.com/simplyluma/luma. Fork the project, push a branch and open a merge request against `main`. Every merge request runs `checks`: the branch is merged onto main, releases are assigned and the Source checks run. A maintainer reads a fork's diff before its branch is pushed to this project and its pipeline runs. The manual `merge` job lands the change with a merge commit, builds the packages it touches and moves `main`; GitLab's own merge button stays off so every merge carries its release commit.

Never commit credentials, user databases, private device captures, VM disks, installer images, generated packages or caches. Build and release signing credentials stay outside the source tree. See SECURITY.md for reporting sensitive problems.

The main branch starts with one public baseline commit. Subsequent changes use ordinary reviewable commits and merge requests; source history is not rewritten to conceal later changes.
