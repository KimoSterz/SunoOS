# SPDX-License-Identifier: GPL-3.0-only
Name: Suno-greetd-session
Version: 0.10.3
Release: 1.Suno.2%{?dist}
Summary: Persistent-compositor session lifecycle for Suno greetd
License: GPL-3.0-only AND Apache-2.0 AND MIT
Source0: Suno-greetd
Source1: 40-Suno-persistent-greetd.conf
Requires: greetd >= 0.10.3
Requires: systemd

%description
Suno's source-built greetd lifecycle extension. It preserves the display-owning
pre-authentication compositor while starting a separately authenticated client
session against the same Wayland display.

%install
install -D -m 0755 %{SOURCE0} %{buildroot}%{_libexecdir}/Suno-greetd
install -D -m 0644 %{SOURCE1} \
  %{buildroot}%{_unitdir}/greetd.service.d/40-Suno-persistent-greetd.conf

%check
%{buildroot}%{_libexecdir}/Suno-greetd --help >/dev/null

%files
%{_libexecdir}/Suno-greetd
%{_unitdir}/greetd.service.d/40-Suno-persistent-greetd.conf

%changelog
* Sun Aug 30 2026 Project Suno <maintainers@projectSuno.org> - 0.10.3-1.Suno.1
- Add explicit persistent-compositor authenticated session ownership
