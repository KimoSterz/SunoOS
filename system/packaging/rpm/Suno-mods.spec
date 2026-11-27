# SPDX-License-Identifier: Apache-2.0

%global use_source_date_epoch_as_buildtime 1

Name:           Suno-mods
Version:        0.1.0
Release:        1.Suno.25%{?dist}
Summary:        Project Suno Mod inspection and lifecycle foundation
License:        Apache-2.0
URL:            https://github.com/SimplyLuma/luma
BuildArch:      noarch

Source0:        Suno-mods.tar.gz
Source1:        LICENSE.md

BuildRequires:  python3-devel
BuildRequires:  systemd-rpm-macros
BuildRequires:  python3-gobject-base
Requires:       python3
Requires:       python3-gobject
Requires:       gtk4
Requires:       libadwaita
Requires:       Suno-developer-platform >= 0.1.0-1.Suno.100
Requires:       polkit
Requires:       Suno-application-installer >= 0.1.0-1.Suno.55
Recommends:     python3-tuf >= 7
Recommends:     python3-sigstore

%description
Strict Suno Mod manifest inspection, capability planning, trust verification,
host inventory, crash-safe state, bounded preference lifecycle, adaptive review
UI, and a closed-by-default system-composition boundary. No privileged Mod
backend is enabled by this package.

%prep
%autosetup -n Suno-mods/src/Suno-mods
cp %{SOURCE1} LICENSE.md

%build

%install
install -d %{buildroot}%{python3_sitelib}/Suno_mods
install -m 0644 Suno_mods/*.py %{buildroot}%{python3_sitelib}/Suno_mods/
install -D -m 0755 bin/Suno-mod %{buildroot}%{_bindir}/Suno-mod
install -D -m 0755 bin/Suno-mods %{buildroot}%{_bindir}/Suno-mods
install -D -m 0755 bin/Suno-mod-author %{buildroot}%{_bindir}/Suno-mod-author
install -D -m 0755 bin/Suno-mod-catalog-author %{buildroot}%{_bindir}/Suno-mod-catalog-author
install -D -m 0755 bin/Suno-mod-catalog-ceremony %{buildroot}%{_bindir}/Suno-mod-catalog-ceremony
install -D -m 0755 bin/Suno-mod-catalog-accept %{buildroot}%{_bindir}/Suno-mod-catalog-accept
install -D -m 0755 bin/Suno-mod-review %{buildroot}%{_bindir}/Suno-mod-review
install -D -m 0755 bin/Suno-mod-recover %{buildroot}%{_bindir}/Suno-mod-recover
install -D -m 0755 bin/Suno-mod-system-health %{buildroot}%{_bindir}/Suno-mod-system-health
install -D -m 0755 bin/Suno-mod-transaction-service \
  %{buildroot}%{_libexecdir}/Suno-mod-transaction-service
install -D -m 0644 README.md %{buildroot}%{_pkgdocdir}/README.md
install -D -m 0644 data/org.projectSuno.Mods.desktop \
  %{buildroot}%{_datadir}/applications/org.projectSuno.Mods.desktop
install -d %{buildroot}%{_datadir}/Suno/mods/catalog/manifests
install -d %{buildroot}%{_datadir}/Suno/mods/catalog/profiles
install -m 0644 catalog/manifests/*.json \
  %{buildroot}%{_datadir}/Suno/mods/catalog/manifests/
install -m 0644 catalog/profiles/*.json \
  %{buildroot}%{_datadir}/Suno/mods/catalog/profiles/
install -D -m 0644 data/Suno-mod-recover.service \
  %{buildroot}%{_userunitdir}/Suno-mod-recover.service
install -D -m 0644 data/Suno-mod-profiles.service \
  %{buildroot}%{_userunitdir}/Suno-mod-profiles.service
install -D -m 0644 data/org.projectSuno.ModProfiles1.service \
  %{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.ModProfiles1.service
install -D -m 0644 data/Suno-mod-transactions.service \
  %{buildroot}%{_unitdir}/Suno-mod-transactions.service
for unit in Suno-mod-boot-observe.service Suno-mod-boot-promote.service \
  Suno-mod-boot-watchdog.service Suno-mod-boot-watchdog.timer; do
  install -D -m 0644 data/$unit %{buildroot}%{_unitdir}/$unit
done
install -D -m 0644 data/org.projectSuno.ModTransactions1.service \
  %{buildroot}%{_datadir}/dbus-1/system-services/org.projectSuno.ModTransactions1.service
install -D -m 0644 data/org.projectSuno.ModTransactions1.conf \
  %{buildroot}%{_datadir}/dbus-1/system.d/org.projectSuno.ModTransactions1.conf
install -D -m 0644 data/org.projectSuno.ModTransactions1.xml \
  %{buildroot}%{_datadir}/dbus-1/interfaces/org.projectSuno.ModTransactions1.xml
install -D -m 0644 data/org.projectSuno.mods.policy \
  %{buildroot}%{_datadir}/polkit-1/actions/org.projectSuno.mods.policy
install -d %{buildroot}%{_userunitdir}/graphical-session-pre.target.wants
ln -s ../Suno-mod-recover.service \
  %{buildroot}%{_userunitdir}/graphical-session-pre.target.wants/Suno-mod-recover.service
install -d %{buildroot}%{_unitdir}/multi-user.target.wants
ln -s ../Suno-mod-boot-observe.service \
  %{buildroot}%{_unitdir}/multi-user.target.wants/Suno-mod-boot-observe.service
install -d %{buildroot}%{_unitdir}/graphical.target.wants
ln -s ../Suno-mod-boot-promote.service \
  %{buildroot}%{_unitdir}/graphical.target.wants/Suno-mod-boot-promote.service
install -d %{buildroot}%{_unitdir}/timers.target.wants
ln -s ../Suno-mod-boot-watchdog.timer \
  %{buildroot}%{_unitdir}/timers.target.wants/Suno-mod-boot-watchdog.timer

%check
PYTHONPYCACHEPREFIX=%{_builddir}/pycache \
  %{python3} -m py_compile Suno_mods/*.py
PYTHONPATH=$PWD %{python3} ../../tests/unit/test_Suno_mods_profile_boundary.py
PYTHONPATH=$PWD %{python3} ../../tests/unit/test_Suno_mods.py
PYTHONPATH=$PWD %{python3} ../../tests/unit/test_Suno_mods_profile_client.py

%files
%license LICENSE.md
%doc %{_pkgdocdir}/README.md
%{_bindir}/Suno-mod
%{_bindir}/Suno-mods
%{_bindir}/Suno-mod-author
%{_bindir}/Suno-mod-catalog-author
%{_bindir}/Suno-mod-catalog-ceremony
%{_bindir}/Suno-mod-catalog-accept
%{_bindir}/Suno-mod-review
%{_bindir}/Suno-mod-recover
%{_bindir}/Suno-mod-system-health
%{_libexecdir}/Suno-mod-transaction-service
%{python3_sitelib}/Suno_mods/
%{_datadir}/applications/org.projectSuno.Mods.desktop
%{_datadir}/Suno/mods/catalog/
%{_userunitdir}/Suno-mod-recover.service
%{_userunitdir}/Suno-mod-profiles.service
%{_datadir}/dbus-1/services/org.projectSuno.ModProfiles1.service
%{_userunitdir}/graphical-session-pre.target.wants/Suno-mod-recover.service
%{_unitdir}/Suno-mod-transactions.service
%{_unitdir}/Suno-mod-boot-observe.service
%{_unitdir}/Suno-mod-boot-promote.service
%{_unitdir}/Suno-mod-boot-watchdog.service
%{_unitdir}/Suno-mod-boot-watchdog.timer
%{_unitdir}/multi-user.target.wants/Suno-mod-boot-observe.service
%{_unitdir}/graphical.target.wants/Suno-mod-boot-promote.service
%{_unitdir}/timers.target.wants/Suno-mod-boot-watchdog.timer
%{_datadir}/dbus-1/system-services/org.projectSuno.ModTransactions1.service
%{_datadir}/dbus-1/system.d/org.projectSuno.ModTransactions1.conf
%{_datadir}/dbus-1/interfaces/org.projectSuno.ModTransactions1.xml
%{_datadir}/polkit-1/actions/org.projectSuno.mods.policy

%changelog
* Wed Nov 25 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.25
- ModTransactions1 holds its caller by pidfd; a ProcessFD the bus names but
  doesn't deliver is refused; only a bus that offers none falls back to the
  pid and its start time.
- ModTransactions1 answers only the signed Mods app, the host Mods gallery
  and root, checked by process before anything else; GetStatus is theirs only.
  Stage, Activate and Rollback are refused while system Mods are closed,
  before polkit is asked, so no admin prompt appears.
- ModProfiles1 checks that the caller is Mods before it takes an operation
  slot; one check per caller at a time.

* Fri Sep 04 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.20
- The Mods gallery and review are the Application Kit's window

* Fri Aug 28 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.19
- Rebuild system Mod authority from the protected catalog inside the root service
- Derive hardware and kernel compatibility from protected host identity sources
- Admit TUF payloads into the content store with independent digest verification
- Replace client-authored deployment JSON with reviewed Mod and composition identities

* Fri Aug 28 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.18
- Connect the graphical Gallery to live TUF catalog review and installation
- Acquire preference profiles as digest-bound TUF evidence targets
- Revalidate the exact catalog composition immediately before each write

* Fri Aug 28 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.17
- Bind verified preference installs to a live TUF catalog admission
- Recompute catalog snapshot identities and enforce delegated target namespaces
- Bind declarative preference profiles to their reviewed manifest digest

* Fri Aug 28 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.16
- Bind kernel-facing Mods to exact hardware and kernel identities
- Add deterministic review/authorization locks for image-time Mod composition
- Permit recovery-gated Suno Verified hardware payloads at the kernel boundary

* Thu Aug 27 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.15
- Add explicit active-provider ownership and replacement planning
- Reject incomplete or undeclared desktop-experience provider transitions
- Surface deterministic old-to-new provider changes in CLI and graphical review

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.14
- Add role-bound catalog ceremony and signed-staging acceptance tooling
- Hold every automatic update outside its verified reviewed envelope
- Show exact dependency selections and add the Surface Pro 9 qualification gate

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.13
- Materialize verified same-inode .rpm names for rpm-ostree local-artifact parsing.

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.12
- Pass verified absolute RPM paths to rpm-ostree's supported install syntax.

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.11
- Unwrap and strictly validate Gio's nested PolicyKit method result

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.10
- Correct the typed PolicyKit CheckAuthorization GVariant tuple
- Return a closed D-Bus error for GLib/type construction failures

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.9
- Create the protected Mods state directory before boot-health isolation
- Bind recovery readiness to the health unit actually shipped by the package

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.8
- Add crash-safe known-good/candidate deployment journaling
- Add fixed boot observation, promotion, and rollback watchdog units
- Add deterministic catalog target assembly for offline TUF signing

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.7
- Fix adaptive gallery page expansion and mutually exclusive navigation
- Prevent the RPM builder container from inheriting and retaining the build lock

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.6
- Add deterministic Mod authoring init, lint, plan, and evidence commands

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.5
- Add the narrow polkit/D-Bus system transaction boundary
- Keep rpm-ostree activation closed until recovery readiness is proven

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.4
- Add the adaptive Mods gallery and graphical lifecycle actions

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.3
- Add the complete bounded preference lifecycle to the CLI
- Ship the built-in Green Dock pilot and its supported Prairie dock API record

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Recover interrupted preference transactions automatically before a session
- Keep the runtime-consumed preference-domain registry empty until an API lands

* Sat Aug 22 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- Add strict Mod inspection, planning, publisher verification, and host inventory
- Add crash-safe preference lifecycle with exact rollback and dependency ownership
- Keep privileged system composition closed until recovery and D-Bus gates pass
