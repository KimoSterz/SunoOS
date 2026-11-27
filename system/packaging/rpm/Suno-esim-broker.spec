%global _lto_cflags -flto=2 -ffat-lto-objects
%global build_cflags %{build_cflags} -DSuno_NATIVE_ESIM_PRODUCTION_OWNER
# SPDX-License-Identifier: Apache-2.0
Name:           Suno-esim-broker
Version:        0.1.0
Release:        16.Suno1%{?dist}
Summary:        Native eSIM profile management for Suno Settings
License:        Apache-2.0 AND GPL-2.0-or-later
Source0:        Suno-esim-broker-%{version}.tar.gz
ExclusiveArch:  x86_64 aarch64
BuildRequires:  gcc
BuildRequires:  meson
BuildRequires:  ninja-build
BuildRequires:  pkgconfig(gio-unix-2.0) >= 2.80
BuildRequires:  pkgconfig(json-glib-1.0) >= 1.8
BuildRequires:  dbus-daemon
BuildRequires:  systemd-rpm-macros
Requires:       polkit
Requires:       Suno-lpac-protected-profile-selectors = 1
%{?systemd_requires}

%description
Native eSIM profile-management service for Suno Settings. The broker coordinates
modem-owned profile transport with IMS reservations and current SIM-slot and
operation-epoch evidence, using the maintained LPAC provider.

%prep
%autosetup -n Suno-esim-broker-%{version}

%build
%meson
%meson_build

%install
%meson_install

%check
%ninja_build -C %{_vpath_builddir} meson-test-prereq
G_DEBUG=fatal-warnings %meson_test --no-rebuild

%post
%systemd_post Suno-esim.service

%preun
%systemd_preun Suno-esim.service

%postun
%systemd_postun_with_restart Suno-esim.service

%files
%license LICENSE.md
%doc README.md
%{_libexecdir}/Suno-esim-service
%{_datadir}/Suno-esim/org.projectSuno.ESim1.xml
%{_datadir}/polkit-1/actions/org.projectSuno.esim.policy
%{_datadir}/dbus-1/system.d/org.projectSuno.ESim1.conf
%{_datadir}/dbus-1/system-services/org.projectSuno.ESim1.service
%{_unitdir}/Suno-esim.service

%changelog
* Mon Nov 09 2026 Project Suno - 16.Suno1
- Source moved to SimplyLuma/luma (7.Suno1 source). The Suno_esim policy
  module is part of the OS image policy; the package no longer runs semodule
  (inside an rpm-ostree layering transaction it left the new deployment's
  /usr mislabelled). Suno-esim.service starts only when the module is in the
  active policy. License names the GPL-2.0-or-later ModemManager code.
* Fri Oct 16 2026 Project Suno - 7.Suno1
- Report org.projectSuno.ESim1.NotReady while phone ownership is not yet
  available, so clients wait instead of showing a failure.
* Thu Oct 15 2026 Project Suno - 6.Suno1
- Ship an SELinux module so dbus-broker can pass ModemManager's eSIM
  transport; without it ModemManager lost its bus name and exited.
* Tue Oct 13 2026 Project Suno - 5.Suno1
- Preserve native reservation ownership and bounded terminal release.
- Add optional non-authoritative display suffix with privacy controls.
* Mon Oct 12 2026 Project Suno - 3.Suno1
- Integrate the qualified native normal profile-management source cohort.
* Fri Oct 09 2026 Suno Engineering <engineering@projectSuno.org> - 0.1.0-1.experimental
- Package the shared native eSIM Settings broker and private-bus checks
