# SPDX-License-Identifier: Apache-2.0

Name:           Suno-media-bridge
Version:        0.1.0
Release:        1.Suno.2%{?dist}
Summary:        Players without MPRIS on the desktop's media controls
License:        Apache-2.0
URL:            https://projectluma.org/media
Source0:        Suno-media-bridge.tar.gz
Source1:        LICENSE.md

BuildArch:      noarch
BuildRequires:  meson >= 1.3
BuildRequires:  ninja-build
BuildRequires:  python3-devel >= 3.11
BuildRequires:  python3-gobject-base
BuildRequires:  systemd-rpm-macros
Requires:       python3 >= 3.11
Requires:       python3-gobject-base

%description
Suno Media Bridge publishes media players that have their own local control
interface but no MPRIS, such as Kodi, as ordinary MPRIS players. The shelf's
live island, media keys and Ari then show and control them like any other
player. It connects only to players on this computer, and artwork comes from
the player's own local cache.

%prep
%autosetup -n Suno-media-bridge
cp %{SOURCE1} LICENSE.md

%build
%meson
%meson_build

%install
%meson_install
# Enabled by the package itself: a preset only applies on first install.
install -d %{buildroot}%{_userunitdir}/graphical-session.target.wants
ln -s ../Suno-media-bridge.service %{buildroot}%{_userunitdir}/graphical-session.target.wants/Suno-media-bridge.service
install -D -m 0644 data/mpris-proxy-session-only.conf \
  %{buildroot}%{_userunitdir}/mpris-proxy.service.d/10-Suno-session-only.conf

%check
PYTHONPATH=$PWD %{python3} -m unittest discover -s tests -p "test_*.py" -v

%files
%license LICENSE.md
%{_libexecdir}/Suno-media-bridge
%{python3_sitelib}/Suno_media_bridge/
%{_userunitdir}/Suno-media-bridge.service
%{_userunitdir}/graphical-session.target.wants/Suno-media-bridge.service
%dir %{_userunitdir}/mpris-proxy.service.d
%{_userunitdir}/mpris-proxy.service.d/10-Suno-session-only.conf

%changelog
* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Do not start the bridge or BlueZ's mpris-proxy in the login screen's greeter session
* Mon Sep 14 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- First bridge: Kodi, through its local JSON-RPC connection, with playback, seeking and cached artwork
