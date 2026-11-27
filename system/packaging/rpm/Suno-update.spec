# SPDX-License-Identifier: Apache-2.0

Name:           Suno-update
Version:        1.0.0
Release:        1.Suno.38%{?dist}
Summary:        Suno system update agent: signed channels, staged rollouts, rollback
License:        Apache-2.0
URL:            https://github.com/ProjectLuma/Luma
Source0:        Suno-update-%{version}.tar.gz
Source1:        LICENSE.md
# Suno-os-remote, copied by scripts/packages/build-Suno-update.sh from their one source:
Source2:        Suno.conf
Source3:        update-mirrorlist
Source4:        Suno-os-release.asc
Source5:        Suno-update-graph.pub
BuildArch:      noarch

BuildRequires:  python3-devel
BuildRequires:  systemd-rpm-macros
BuildRequires:  gnupg2
BuildRequires:  python3-gobject-base
BuildRequires:  ostree
BuildRequires:  openssl
BuildRequires:  acl

Requires:       Suno-os-remote = %{version}-%{release}
Requires:       python3
Requires:       python3-gobject-base
Requires:       rpm-ostree
Requires:       ostree
Requires:       polkit
Requires:       dbus-common
Requires:       systemd
Recommends:     greenboot
Recommends:     NetworkManager
Recommends:     upower

# ADR-030 replaces the Recent channel client of ADR-015.
Obsoletes:      Suno-update-client < 0.2.0-0
Provides:       Suno-update-client = %{version}-%{release}

%description
Suno-update keeps a Suno computer on its update channel (stable, beta or
nightly). Suno-updated verifies the channel's minisign-signed update graph,
chooses a release with staged-rollout wariness, dead-ends and barriers, stages
that exact OSTree commit through rpm-ostree's D-Bus API, and asks the person to
restart. greenboot health checks confirm the new system and roll back on
failure. The package also provides the Suno-update command, the session
notifier, polkit policy, and anonymous update reporting that can be switched
off.

%package -n Suno-os-remote
Summary:        Suno's OSTree remote and release signing keys, for every channel
License:        Apache-2.0
Requires:       ostree

%description -n Suno-os-remote
The "Suno" OSTree remote (every channel, from the public repository named in
the root-only mirror list /etc/Suno/update-mirrorlist), the Suno OS Release
public key it verifies commits and summaries with, and the update-graph public
key Suno-update verifies release metadata with. With it, any Suno system,
including one built from another base, can start following Official, Beta or
Nightly (Suno-update AdoptChannel) without an administrator setting anything up.

%prep
%autosetup -n Suno-update-%{version}
cp %{SOURCE1} LICENSE.md

%build
gpg --batch --quiet --no-options --homedir "$PWD" --dearmor <%{SOURCE4} >Suno-release.gpg
fingerprint=$(gpg --batch --no-options --homedir "$PWD" --with-colons --show-keys Suno-release.gpg | awk -F: '$1 == "fpr" { print $10; exit }')
test "$fingerprint" = 7D3DAFCE2BCA13A2B68F2761C8CE1A1B51D96CE2
grep -Fxq 'url=mirrorlist=file:///etc/Suno/update-mirrorlist' %{SOURCE2}
grep -Fxq 'gpgkeypath=/etc/pki/ostree/Suno-release.gpg' %{SOURCE2}
python3 -c 'import Suno_update.dbus_interface as d; print(d.introspection_xml(), end="")' \
  > org.projectSuno.Update1.xml

%install
umask 022
install -d %{buildroot}%{python3_sitelib}/Suno_update
install -m 0644 Suno_update/*.py %{buildroot}%{python3_sitelib}/Suno_update/
install -D -m 0755 bin/Suno-update %{buildroot}%{_bindir}/Suno-update
install -D -m 0755 bin/Suno-updated %{buildroot}%{_libexecdir}/Suno-updated
install -D -m 0755 bin/Suno-update-notifier %{buildroot}%{_libexecdir}/Suno-update-notifier
install -D -m 0755 bin/Suno-update-boot %{buildroot}%{_libexecdir}/Suno-update-boot
install -D -m 0755 bin/Suno-device-layer %{buildroot}%{_libexecdir}/Suno-device-layer
install -D -m 0755 bin/Suno-device-boot %{buildroot}%{_libexecdir}/Suno-device-boot
# Device packages that boot their own kernel declare its boot image here.
install -d -m 0755 %{buildroot}%{_prefix}/lib/Suno/device-boot

for unit in Suno-updated.service Suno-update-check.service Suno-updated.timer Suno-update-boot.service Suno-device-layer.service Suno-device-boot.service Suno-device-boot-confirm.service; do
  install -D -m 0644 data/systemd/$unit %{buildroot}%{_unitdir}/$unit
done
for unit in Suno-update-notifier.service Suno-update-notifier.path Suno-update-notifier.timer; do
  install -D -m 0644 data/systemd-user/$unit %{buildroot}%{_userunitdir}/$unit
done
install -D -m 0644 data/presets/80-Suno-update.preset %{buildroot}%{_presetdir}/80-Suno-update.preset
install -D -m 0644 data/presets/80-Suno-update-user.preset %{buildroot}%{_userpresetdir}/80-Suno-update-user.preset

install -D -m 0644 data/dbus/org.projectSuno.Update1.conf %{buildroot}%{_datadir}/dbus-1/system.d/org.projectSuno.Update1.conf
install -D -m 0644 data/dbus/org.projectSuno.Update1.service %{buildroot}%{_datadir}/dbus-1/system-services/org.projectSuno.Update1.service
install -D -m 0644 data/dbus/org.projectSuno.Update.session.service %{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.Update.service
install -D -m 0644 org.projectSuno.Update1.xml %{buildroot}%{_datadir}/dbus-1/interfaces/org.projectSuno.Update1.xml
install -D -m 0644 data/polkit/org.projectSuno.update.policy %{buildroot}%{_datadir}/polkit-1/actions/org.projectSuno.update.policy
install -D -m 0644 data/polkit/49-org.projectSuno.update.rules %{buildroot}%{_datadir}/polkit-1/rules.d/49-org.projectSuno.update.rules
install -D -m 0644 data/applications/org.projectSuno.Update.desktop %{buildroot}%{_datadir}/applications/org.projectSuno.Update.desktop

# The agent's own health check and greenboot hooks live in greenboot's read-only
# /usr/lib tree; /etc stays for the administrator's checks. The display
# manager, shell and NetworkManager checks belong to the OS image (ADR-030
# section 10); Suno-greenboot-common.sh gives them the same trial-boot rule.
install -D -m 0644 data/greenboot/Suno-greenboot-common.sh %{buildroot}%{_prefix}/lib/Suno-update/Suno-greenboot-common.sh
for check in data/greenboot/check/required.d/*.sh; do
  install -D -m 0755 "$check" %{buildroot}%{_prefix}/lib/greenboot/check/required.d/$(basename "$check")
done
install -D -m 0755 data/greenboot/green.d/50-Suno-update-record.sh %{buildroot}%{_prefix}/lib/greenboot/green.d/50-Suno-update-record.sh
install -D -m 0755 data/greenboot/red.d/50-Suno-update-record.sh %{buildroot}%{_prefix}/lib/greenboot/red.d/50-Suno-update-record.sh
# Boot counting for staged deployments, and making a counted-out fallback
# permanent (data/greenboot/Suno-greenboot-counter); enabled by the preset.
# grub2-tools' boot-success timer would mark boots greenboot failed.
install -D -m 0755 data/greenboot/Suno-greenboot-counter %{buildroot}%{_prefix}/lib/Suno-update/Suno-greenboot-counter
for unit in Suno-greenboot-arm.service Suno-greenboot-fallback.service; do
  install -D -m 0644 data/systemd/$unit %{buildroot}%{_unitdir}/$unit
done
for unit in grub-boot-success.service grub-boot-success.timer; do
  install -D -m 0644 data/systemd-user/$unit.d/50-Suno-greenboot.conf %{buildroot}%{_userunitdir}/$unit.d/50-Suno-greenboot.conf
done

install -D -m 0755 data/NetworkManager/90-Suno-update %{buildroot}%{_prefix}/lib/NetworkManager/dispatcher.d/90-Suno-update
install -D -m 0644 data/config/update.conf %{buildroot}%{_prefix}/lib/Suno/update.conf
install -D -m 0644 data/config/statistics.conf %{buildroot}%{_sysconfdir}/Suno/statistics.conf
install -d -m 0755 %{buildroot}%{_prefix}/lib/Suno-update/graph-keys.d
install -m 0644 %{SOURCE5} %{buildroot}%{_prefix}/lib/Suno-update/graph-keys.d/Suno-update-graph.pub
install -D -m 0644 %{SOURCE2} %{buildroot}%{_sysconfdir}/ostree/remotes.d/Suno.conf
install -D -m 0600 %{SOURCE3} %{buildroot}%{_sysconfdir}/Suno/update-mirrorlist
install -D -m 0644 Suno-release.gpg %{buildroot}%{_sysconfdir}/pki/ostree/Suno-release.gpg
# The same key, armored, for rpm-md repositories it signs (device repositories).
install -D -m 0644 %{SOURCE4} %{buildroot}%{_sysconfdir}/pki/rpm-gpg/RPM-GPG-KEY-Suno-os-release
install -d -m 0755 %{buildroot}%{_sysconfdir}/Suno/update-graph-keys.d

install -d %{buildroot}%{_tmpfilesdir}
cat > %{buildroot}%{_tmpfilesdir}/Suno-update.conf <<'EOF'
d /var/lib/Suno-update 0700 root root -
d /run/Suno-update 0755 root root -
EOF
# Shared build volumes may carry default ACLs and setgid directories. Neither
# belongs in the installed OS payload or in directories created by RPM's later
# byte-compilation/documentation processing.
setfacl -Rb %{buildroot}
find %{buildroot} -type d -exec chmod 0755 {} +
chmod 0644 %{buildroot}%{_tmpfilesdir}/Suno-update.conf

%check
# Immutable target admission must exercise the real native OSTree decoder.
python3 -c "import gi, shutil; gi.require_version('OSTree', '1.0'); from gi.repository import Gio, OSTree; assert shutil.which('ostree')"
python3 -m unittest discover -v -s tests -p 'test_*.py'

%post
%systemd_post Suno-updated.service Suno-update-check.service Suno-updated.timer Suno-update-boot.service Suno-greenboot-arm.service Suno-greenboot-fallback.service Suno-device-layer.service Suno-device-boot.service Suno-device-boot-confirm.service
%systemd_user_post Suno-update-notifier.path Suno-update-notifier.timer

%preun
%systemd_preun Suno-updated.service Suno-update-check.service Suno-updated.timer Suno-update-boot.service Suno-greenboot-arm.service Suno-greenboot-fallback.service Suno-device-layer.service Suno-device-boot.service Suno-device-boot-confirm.service
%systemd_user_preun Suno-update-notifier.path Suno-update-notifier.timer

%postun
%systemd_postun Suno-updated.timer Suno-update-boot.service
%systemd_user_postun Suno-update-notifier.path Suno-update-notifier.timer

%files
%defattr(-,root,root,0755)
%license LICENSE.md
%doc README.md
%{python3_sitelib}/Suno_update/
%{_bindir}/Suno-update
%{_libexecdir}/Suno-updated
%{_libexecdir}/Suno-update-notifier
%{_libexecdir}/Suno-update-boot
%{_libexecdir}/Suno-device-layer
%{_libexecdir}/Suno-device-boot
%{_unitdir}/Suno-updated.service
%{_unitdir}/Suno-update-check.service
%{_unitdir}/Suno-updated.timer
%{_unitdir}/Suno-update-boot.service
%{_unitdir}/Suno-device-layer.service
%{_unitdir}/Suno-device-boot.service
%{_unitdir}/Suno-device-boot-confirm.service
%{_userunitdir}/Suno-update-notifier.service
%{_userunitdir}/Suno-update-notifier.path
%{_userunitdir}/Suno-update-notifier.timer
%{_presetdir}/80-Suno-update.preset
%{_userpresetdir}/80-Suno-update-user.preset
%{_datadir}/dbus-1/system.d/org.projectSuno.Update1.conf
%{_datadir}/dbus-1/system-services/org.projectSuno.Update1.service
%{_datadir}/dbus-1/services/org.projectSuno.Update.service
%{_datadir}/dbus-1/interfaces/org.projectSuno.Update1.xml
%{_datadir}/polkit-1/actions/org.projectSuno.update.policy
%{_datadir}/polkit-1/rules.d/49-org.projectSuno.update.rules
%{_datadir}/applications/org.projectSuno.Update.desktop
%dir %attr(0755,root,root) %{_prefix}/lib/Suno-update
%{_prefix}/lib/Suno-update/Suno-greenboot-common.sh
%dir %attr(0755,root,root) %{_prefix}/lib/Suno-update/graph-keys.d
%dir %attr(0755,root,root) %{_prefix}/lib/greenboot
%dir %attr(0755,root,root) %{_prefix}/lib/greenboot/check
%dir %attr(0755,root,root) %{_prefix}/lib/greenboot/check/required.d
%dir %attr(0755,root,root) %{_prefix}/lib/greenboot/green.d
%dir %attr(0755,root,root) %{_prefix}/lib/greenboot/red.d
%{_prefix}/lib/greenboot/check/required.d/43-Suno-updated.sh
%{_prefix}/lib/greenboot/green.d/50-Suno-update-record.sh
%{_prefix}/lib/greenboot/red.d/50-Suno-update-record.sh
%{_prefix}/lib/Suno-update/Suno-greenboot-counter
%{_unitdir}/Suno-greenboot-arm.service
%{_unitdir}/Suno-greenboot-fallback.service
%dir %attr(0755,root,root) %{_userunitdir}/grub-boot-success.service.d
%dir %attr(0755,root,root) %{_userunitdir}/grub-boot-success.timer.d
%{_userunitdir}/grub-boot-success.service.d/50-Suno-greenboot.conf
%{_userunitdir}/grub-boot-success.timer.d/50-Suno-greenboot.conf
%{_prefix}/lib/NetworkManager/dispatcher.d/90-Suno-update
%dir %attr(0755,root,root) %{_prefix}/lib/Suno
%{_prefix}/lib/Suno/update.conf
%dir %attr(0755,root,root) %{_prefix}/lib/Suno/device-boot
%dir %attr(0755,root,root) %{_sysconfdir}/Suno
%config(noreplace) %{_sysconfdir}/Suno/statistics.conf
%dir %attr(0755,root,root) %{_sysconfdir}/Suno/update-graph-keys.d
%{_tmpfilesdir}/Suno-update.conf

%files -n Suno-os-remote
%defattr(-,root,root,0755)
%dir %attr(0755,root,root) %{_sysconfdir}/Suno
%dir %attr(0755,root,root) %{_prefix}/lib/Suno-update
%dir %attr(0755,root,root) %{_prefix}/lib/Suno-update/graph-keys.d
%license LICENSE.md
%config(noreplace) %{_sysconfdir}/ostree/remotes.d/Suno.conf
%config(noreplace) %attr(0600,root,root) %{_sysconfdir}/Suno/update-mirrorlist
%dir %attr(0755,root,root) %{_sysconfdir}/pki/ostree
%{_sysconfdir}/pki/ostree/Suno-release.gpg
%{_sysconfdir}/pki/rpm-gpg/RPM-GPG-KEY-Suno-os-release
%{_prefix}/lib/Suno-update/graph-keys.d/Suno-update-graph.pub

%changelog
* Tue Nov 24 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.38
- A Surface Pro 12-inch (microsoft,sp12in) may follow the generic ARM stream:
  its kernel comes from its device repository as an rpm-ostree override. Its
  device tree still selects its per-device update holds.
* Tue Nov 24 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.37
- Honor per-device update holds in the signed graph (release device_holds):
  a device whose device tree names a held target stays on its last good
  release; other devices are unaffected.
* Sat Nov 14 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.36
- Suno-device-boot-confirm.service runs on every boot of a device that
  declares a boot image: with no attempt pending it marks the running slot
  successful; a trial slot is still marked only once its declared kernel runs.
* Sat Nov 14 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.35
- Suno-device-boot: a device package that boots its own kernel from an A/B
  boot partition declares the boot image it pairs with in
  /usr/lib/Suno/device-boot/<name>/device-boot.json. On a boot whose running
  slot does not hold it, Suno-device-boot.service checks the image digest,
  writes it to the inactive slot (only boot/dtbo/init_boot/vendor_boot
  partitions the manifest names, never modemst1/modemst2/fsg/fsc/persist),
  reads it back, refuses when any other A/B pair differs between slots, sets
  that slot active and restarts once. Suno-device-boot-confirm.service marks
  the slot successful once the declared kernel runs; a slot that does not boot
  falls back to the previous one and its image is not tried again.
* Fri Nov 13 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.34
- A graph answered with HTTP 404 or 410 is error class channel-unavailable
  ("No updates are published for this device's channel yet."), not network:
  the server was reached, so a connectivity change does not bypass the
  hourly check spacing.
- Hardware target microsoft,sp12in (Surface Pro 12-inch, board compatible
  microsoft,surface-pro-12in) follows only its own stream, microsoft-sp12in.
* Thu Nov 12 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.33
- Suno-device-layer: step the clock forward to the newest creation time of
  the kit's verified signatures before the transaction (a first boot without
  RTC or network starts at the image build time, and rpm rejects a kit signed
  later as not yet live); keep that floor in systemd-timesyncd's clock file.
- Suno-device-layer: count only staged deployments as attempts, so a
  transaction that fails before staging is retried on the next boot.
* Mon Nov 09 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.32
- Suno-device-layer: load fuse.ko for the running kernel from the kit's
  signed packages when /dev/fuse is missing (rofiles-fuse runs the package
  scripts); relabel the staged deployment's /usr with its own file_contexts
  when /usr/lib/systemd/systemd is not init_exec_t, and drop a staged
  deployment that cannot be repaired instead of restarting into it.
- Suno-device-layer: read the kit where its filesystem is already mounted.
* Sun Nov 08 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.31
- Suno-device-layer.service: on an image that names a device kit
  (/etc/Suno/device-kit.conf), layer the kit's signed device repository
  with rpm-ostree on the first boot, offline, then restart once; updates
  then follow the online device repository.
- Suno-os-remote: the Suno OS Release key, armored, at
  /etc/pki/rpm-gpg/RPM-GPG-KEY-Suno-os-release.

* Sun Nov 08 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.30
- Once a release is staged, start Suno-system-app-updates-prefetch.service so
  the app updates waiting on the Suno remote come with it. A system without
  the unit, or a failure to start it, leaves the staged update as it is.

* Sat Nov 07 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.29
- Arm greenboot's boot counter for a staged deployment at shutdown without
  rpm-ostreed (Suno-greenboot-arm.service), so a failed update falls back.
- After the counter runs out and the previous deployment boots, roll back to
  it (Suno-greenboot-fallback.service) so the failed one is not retried.
- grub-boot-success.timer no longer marks boots successful where greenboot is
  installed.

* Tue Nov 03 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.28
- Raspberry Pi 5 hardware target (raspberrypi,rpi5); a Pi 5 may still follow
  the generic ARM desktop stream.

* Tue Nov 03 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.27
- Ship Suno_uptime in Suno-greenboot-common.sh. The image's health checks
  call it since the boot-clock deadlines, and without it every check fails
  on a trial boot and greenboot rolls the update back.

* Mon Oct 26 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.25
- Package the October 26 shared source updates.

* Sun Oct 25 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.24
- Fix packaged directory permissions and installation alongside greenboot.

* Sat Oct 24 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.23
- Route updates to the matching architecture and device graph.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.17
- Updates stage when the new release ships a package this computer had added: an identical or older added copy is removed, a newer one is kept and the release's copy left out; both are reported.

* Mon Sep 21 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.16
- A refused early-updates pull now really retries from the public
  repository: rpm-ostree reports every failed pull as a transaction
  failure, so "No valid mirrors were found in mirrorlist" and HTTP 401/403
  are now recognised inside that wrapped error. Other transaction failures
  keep their class and never switch repositories.

* Mon Sep 21 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.15
- An update whose base now ships a package this computer had added
  (rpm-ostree install from a file or a repository) no longer fails with
  "cannot install both ... conflicting requests": the added request is
  removed with that update (a local package by NEVRA), logged, and listed
  in the new RemovedPackages property until the next staging.
- A revoked or unreachable preview credential no longer blocks a public
  channel: the pull is retried once from the public repository and the
  credential is set aside only when that works. A mirror list that still
  names a preview repository with no credential record uses the public one.
- An error and a last attempt recorded while another deployment was booted
  (or by an agent that never recorded which) are forgotten at start, so the
  first check after restarting into an update runs and the old error is
  not shown.

* Thu Sep 17 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.14
- Name the booted build from the graph when os-release names no build
  (Suno-release's stage-only os-release layered onto an older image).

* Thu Sep 17 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.13
- Remember the graph's name for the booted release when nothing is available,
  so an up-to-date image from before release names shows its real name.

* Thu Sep 17 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.12
- Release names: status, D-Bus and the notifier say what people call a
  release ("Suno (Prairie, Beta 0, Nightly 20260917) is ready"), never
  "Suno 1.0.0-nightly..." or "Suno 1.0". New string properties BootedName,
  StagedName, AvailableName, WaitingName, RolledBackName and IgnoredName
  (JSON booted_name, ...); every existing property is unchanged.
- The booted system is named by /usr/lib/os-release PRETTY_NAME. Another
  version is named by the signed graph's optional display_name, else its
  deployment's own os-release, else derived from the version with the booted
  codename and stage. An image older than release names is derived too.
- The update graph's optional release display_name (at most 200 characters)
  is parsed and validated; graphs without it parse as before. Version
  comparison and target selection never read it.

* Wed Sep 16 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.11
- New subpackage Suno-os-remote, required by Suno-update: the "Suno" OSTree
  remote for every channel (public repository through the root-only mirror
  list), the Suno OS Release public key and the update-graph public key, in
  the image's own paths. Any Suno system, including one built from another
  base, can start following Official, Beta or Nightly without an administrator
- AdoptChannel removes base package overrides made against the old base (the
  channel's versions are used); packages added on top stay, and the running
  deployment stays as the rollback

* Wed Sep 16 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.10
- Every channel is public (ADR-030 section 4, 2026-09-16): SetChannel,
  SetChannelNow, AdoptChannel and checks follow beta and nightly with no
  enrollment and no credential, from the image's one public repository
- AvailableChannels always lists stable, beta and nightly
- EnrollPreview and LeavePreview stay for compatibility; EnrollPreview on a
  computer that follows no channel but could (Adoptable) enrolls and adopts
- PreviewSource says who set up an existing credential (hub, staff-media,
  unknown) so Depot can say so
- Hub's answers are plain: 401 is SignInRequired, 403 not entitled, 429 wait
  a few minutes, other statuses try later
- A pull the download server refuses (HTTP 401/403, a revoked credential) is
  classed access-denied with a message that says how to get back

* Wed Sep 16 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.9
- A package added with sudo dnf install and already applied to the running
  system (rpm-ostree apply-live) no longer shows as a change waiting for a
  restart (ADR-038).

* Wed Sep 16 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.8
- After staging a release, run that release's Suno-boot-hidden-menu so GRUB's
  menu stays hidden from the next start on computers that update instead of
  reinstalling; a failure is logged and never stops the update

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.7
- A computer that follows no Suno channel is no longer a dead end:
  AdoptChannel starts it following one, rebasing onto
  Suno:Suno/1/<arch>/<channel> and staging that channel's newest usable
  release, with the running deployment kept as the rollback
- Publish Adoptable and UnmanagedReason (other-origin, no-remote, no-key,
  no-image-system, busy) so Depot can say exactly what is true and what
  it would take, never only that something is unavailable
- Adoption is offered only where the Suno remote and an update-graph key
  are installed; the graph must still verify, and nothing is applied
  until a person restarts
- Suno-update adopt <stable|beta|nightly> on the command line, and
  Suno-update status says why an unmanaged computer follows nothing
* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.6
- Updates are optional and visible: SetAutomaticDownload turns background
  downloading off (and stops one already running), IgnoreVersion silences
  one release without hiding it, and ClearIgnoredVersion is the way back
- Publish what Depot audits: AutomaticDownload, IgnoredVersion,
  RepositoryUrl read from the image's own OSTree remote with any preview
  credential redacted, GraphUrl, SignatureVerified, SigningKeyId,
  LastCheckReason and LastCheckAttempt
- The notifier says nothing about an ignored version and withdraws a
  notification already on screen for it
- Suno-update automatic-download, ignore and unignore on the command line
* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.5
- Leaving early updates never revokes a staff install medium's per-batch
  preview credential (record source staff-media) or any record without a
  per-device Suno Hub credential id; it resets the mirror list and removes
  the record only
- Enrollment records source hub and Hub's credential_id; only those
  credentials are revoked, after the local removal, without ever blocking
  or failing the channel change, and every outcome is logged

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.4
- Apply the kernel arguments a release declares in /usr/lib/bootc/kargs.d
  to the staged deployment through rpm-ostree's KernelArgs (append missing,
  remove only arguments the agent added that a release dropped); staging
  fails and is removed when they cannot be set

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.3
- Fix the findings of the independent review before release
- Mark a commit not to retry for good only after a failed health check;
  other marks expire after a week, a marked barrier is retried after a
  backoff and shows barrier-blocked instead of up to date, and the previous
  boot menu entry chosen once is not a failed update
- Treat times recorded while the clock ran ahead as elapsed
- Serialize the state store across threads; run report flushing,
  acknowledgement and boot reconciliation as operations
- Apply(): restart only into the agent's own update or rollback, only for a
  caller logind would allow (including other people's sessions), through
  RebootWithFlags with inhibitor checks for root
- Follow no redirect on Hub API requests, so bearer tokens stay with Hub
- Redact the preview credential from logs and D-Bus errors
- Do not download automatically when NetworkManager or UPower do not answer
- Log at error priority when greenboot trial-boot state cannot be read
- Add Cancel() and Suno-update cancel; stop automatic downloads when the
  connection becomes metered or power runs low
- Stage promoted releases whose timestamps are older, classify
  min-free-space errors, remove a wrong staged commit, accept graphs for
  three days, and support the image's update-mirrorlist remote layout

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.2
- Rebuild from the launch integration branch, which carries Depot and the
  Suno remote beside the agent; no change to the agent's source, so the
  build does not share a NEVRA with the earlier 1.Suno.1 file

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 1.0.0-1.Suno.1
- Replace Suno-update-client with the ADR-030 update agent: Suno-updated on
  D-Bus, signed graph with staged rollouts, dead-ends, barriers and signed
  rollback, exact-commit staging through rpm-ostree, greenboot trial-boot
  checks, notifier, anonymous reporting, preview enrollment and the
  Suno-update command
