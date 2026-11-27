# SPDX-License-Identifier: Apache-2.0

Name:           Suno-setup
Version:        0.2.0
Release:        1.Suno.5%{?dist}
Summary:        Set up this Suno: language, network, your account and the device's name
License:        Apache-2.0
URL:            https://projectluma.org/setup
Source0:        Suno-setup.tar.gz
BuildArch:      noarch

BuildRequires:  dconf
BuildRequires:  desktop-file-utils
BuildRequires:  meson >= 1.3
BuildRequires:  ninja-build
BuildRequires:  python3-devel >= 3.11
BuildRequires:  systemd-rpm-macros
Requires:       python3 >= 3.11
Requires:       python3-gobject
Requires:       gtk4
Requires:       libadwaita
# SunoUI (Suno_appkit), and its TV layer where the device is a TV.
Requires:       Suno-developer-platform
# GDM runs the setup in its initial-setup session; it signs the new account in.
Requires:       gdm
Requires:       gnome-session
Requires:       polkit
# The system services Finish applies through, and what the pages read.
Requires:       accountsservice
# The Suno Connect sign-in QR code (connect.qr_modules).
Requires:       qrencode-libs
Requires:       systemd
Requires:       shadow-utils
Requires:       NetworkManager-libnm
Requires:       gnome-desktop4
Requires:       libgweather4
Requires:       geoclue2-libs
# Saved passwords unlock with the account password from the first sign-in.
Requires:       Suno-keyring >= 0.2.0
# The first session's cover (Suno-setup --cover) is held and lifted by gnome-shell 0321.
Requires:       gnome-shell >= 50.3-1.Suno.158
# GNOME Initial Setup never runs on Suno: this package owns its session.
Obsoletes:      gnome-initial-setup < 999
Conflicts:      gnome-initial-setup

%description
Suno's first-boot setup. A device with no account yet (a flashed card, a
phone, a TV box, a computer after the installer) boots into one sheet over
the softened wallpaper: Hello (language and keyboard), Get online (only
without a cable), About you (name, username, password; the owner, an
administrator) and Name this Suno (device name and time zone, automatic once
online). Finish creates the account, sets the locale, keyboard, time zone and
host names, enrols the saved passwords with the same password, and signs the
person straight in. Desktop, phone and TV are presentations of the same
pages. GNOME Initial Setup is replaced.

%prep
%autosetup -n Suno-setup

%build
%meson
%meson_build

%install
%meson_install
# Enabled by the package: each checks its own conditions in every session.
install -d %{buildroot}%{_userunitdir}/graphical-session-pre.target.wants %{buildroot}%{_userunitdir}/graphical-session.target.wants
ln -s ../Suno-setup-first-session.service \
  %{buildroot}%{_userunitdir}/graphical-session-pre.target.wants/Suno-setup-first-session.service
ln -s ../Suno-setup-first-desktop.service \
  %{buildroot}%{_userunitdir}/graphical-session.target.wants/Suno-setup-first-desktop.service
ln -s ../Suno-setup-cover.service \
  %{buildroot}%{_userunitdir}/graphical-session-pre.target.wants/Suno-setup-cover.service

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/org.projectSuno.Setup.desktop
# GDM starts initial setup only if this exact path exists.
test -s %{buildroot}%{_datadir}/gnome-session/sessions/gnome-initial-setup.session
test -s %{buildroot}%{_datadir}/Suno-setup/dconf-defaults
grep -Fqx "Requires=Suno-setup.service" \
  %{buildroot}%{_userunitdir}/gnome-session@gnome-initial-setup.target.d/Suno-setup.conf
# No password is ever logged or put on a command line.
! grep -rnE "(log\.(info|warning|error)|print)\(.*password" %{buildroot}%{python3_sitelib}/Suno_setup/
cd tests && PYTHONPATH=$PWD/.. SUNO_SETUP_FIXTURE=1 %{python3} -m unittest discover -p "test_*.py" -v

%files
%license LICENSES/Apache-2.0.txt
%{_libexecdir}/Suno-setup
%{_libexecdir}/Suno-setup-apply
%{python3_sitelib}/Suno_setup/
%{_datadir}/gnome-session/sessions/gnome-initial-setup.session
%{_userunitdir}/gnome-session@gnome-initial-setup.target.d/Suno-setup.conf
%{_userunitdir}/Suno-setup.service
%{_userunitdir}/Suno-setup-first-session.service
%{_userunitdir}/Suno-setup-first-desktop.service
%{_userunitdir}/Suno-setup-cover.service
%{_userunitdir}/graphical-session-pre.target.wants/Suno-setup-cover.service
%{_userunitdir}/graphical-session-pre.target.wants/Suno-setup-first-session.service
%{_userunitdir}/graphical-session.target.wants/Suno-setup-first-desktop.service
%{_datadir}/polkit-1/actions/org.projectSuno.setup.policy
%{_datadir}/polkit-1/rules.d/20-Suno-setup.rules
%{_sysusersdir}/Suno-setup.conf
%config %{_sysconfdir}/dconf/profile/gnome-initial-setup
%{_datadir}/Suno-setup/
%config(noreplace) %{_sysconfdir}/geoclue/conf.d/90-Suno-setup.conf
%{_datadir}/applications/org.projectSuno.Setup.desktop

%changelog
* Tue Nov 17 2026 Project Suno <maintainers@projectSuno.org> - 0.2.0-1.Suno.5
- The system locale (LANG, so language and region) is always set at Finish:
  the person's choice, else English (US); a locale localed refuses falls back
  to English (US) and the step reports a failure. The account's language
  follows the same default.

* Fri Nov 06 2026 Project Suno <maintainers@projectSuno.org> - 0.2.0-1.Suno.4
- An account left half-made (useradd failing on the home folder, or no
  password set) is removed again, so Finish can be pressed again (it refused
  every retry: "already has an account"); the
  account's language and picture failing no longer fail the account
- The setup window refuses to close (Quit from the dash, Alt+F4): closing it
  ended GDM's setup session and left a black screen

* Wed Nov 04 2026 Project Suno <maintainers@projectSuno.org> - 0.2.0-1.Suno.3
- One press, one step: a page takes Continue, Back or Skip only once it has
  been on screen for the double-click time, and a held Return or space acts once
  (a double click on Continue skipped Make it yours)

* Wed Nov 04 2026 Project Suno <maintainers@projectSuno.org> - 0.2.0-1.Suno.2
- Install the initial-setup session where GDM looks for it
  (/usr/share/gnome-session/sessions); with it in /etc/xdg GDM showed the
  login screen instead of the setup

* Tue Nov 03 2026 Project Suno <maintainers@projectSuno.org> - 0.2.0-1.Suno.1
- One sheet from Hello to the desktop: Make it yours, Suno Connect (sign-in
  by code) and Add apps follow in the setup session; signed in once, at the end
- The first session opens on the setup's last frame (Suno-setup-cover.service,
  gnome-shell 0321) and lifts it off the desktop

* Tue Nov 03 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Ship no file gdm or gnome-initial-setup owns: GDM's own initial-setup session
  entry starts the session; the session file and the dconf profile live in /etc

* Tue Nov 03 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- First-boot setup in GDM's initial-setup session: language and keyboard,
  Wi-Fi, the account, the device name and time zone, then a direct sign-in
- Desktop, phone and TV presentations of the same pages
- Replaces GNOME Initial Setup
