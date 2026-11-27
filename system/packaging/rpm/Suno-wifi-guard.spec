# SPDX-License-Identifier: Apache-2.0

Name:           Suno-wifi-guard
Version:        0.1.0
Release:        1.Suno.1%{?dist}
Summary:        Stay off Wi-Fi access points that give no address
License:        Apache-2.0
URL:            https://projectluma.org/network
Source0:        Suno-wifi-guard.tar.gz
Source1:        LICENSE.md

BuildArch:      noarch
BuildRequires:  meson >= 1.3
BuildRequires:  ninja-build
BuildRequires:  python3-devel >= 3.11
BuildRequires:  python3-gobject-base
BuildRequires:  systemd-rpm-macros
Requires:       python3 >= 3.11
Requires:       python3-gobject-base
Requires:       NetworkManager-wifi
Requires:       wpa_supplicant

%description
Some Wi-Fi networks include an access point that accepts the computer but
never gives it an address, so roaming to it drops the connection. Suno Wi-Fi
Guard notices when no address arrives through an access point while another
access point of the same network works, keeps wpa_supplicant off it for a
while (five minutes, doubling on repeats, at most a day, as Android does), and
roams to the strongest working one. The last visible access point of a network
is never avoided.

%prep
%autosetup -n Suno-wifi-guard
cp %{SOURCE1} LICENSE.md

%build
%meson
%meson_build

%install
%meson_install
# Enabled by the package itself: a preset only applies on first install.
install -d %{buildroot}%{_unitdir}/multi-user.target.wants
ln -s ../Suno-wifi-guard.service %{buildroot}%{_unitdir}/multi-user.target.wants/Suno-wifi-guard.service

%check
PYTHONPATH=$PWD %{python3} -m unittest discover -s tests -p "test_*.py" -v
PYTHONPATH=$PWD %{python3} -c "import Suno_wifi_guard.guard"

%files
%license LICENSE.md
%{_libexecdir}/Suno-wifi-guard
%{python3_sitelib}/Suno_wifi_guard/
%{_unitdir}/Suno-wifi-guard.service
%{_unitdir}/multi-user.target.wants/Suno-wifi-guard.service

%changelog
* Mon Sep 14 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- Avoid access points where DHCP fails while another access point of the network works
