# SPDX-License-Identifier: Apache-2.0

Name:           Suno-portal
Version:        0.1.0
Release:        1.Suno.13%{?dist}
Summary:        Project Suno's desktop portal backend
License:        Apache-2.0
URL:            https://projectluma.org/platform/portal
Source0:        Suno-portal.tar.gz
Source1:        LICENSE.md

BuildArch:      noarch
BuildRequires:  python3-devel >= 3.11
BuildRequires:  systemd-rpm-macros
Requires:       python3 >= 3.11
Requires:       python3-gobject
Requires:       gtk4 >= 4.18
Requires:       libadwaita >= 1.7
# The Share sound picker is built from SunoUI parts (AppIcon, Checkbox, AudioMeter).
Requires:       Suno-developer-platform >= 0.1.0-1.Suno.135
# org.freedesktop.portal.AudioCapture (patches/xdg-desktop-portal 0004)
Requires:       xdg-desktop-portal >= 1.22.1-1.Suno.4
# CreateCapture, GetApplications and the level meters
Requires:       Suno-audio-policy >= 0.1.0-1.Suno.4
# pw-dump: a stream's object.serial when Mutter announces only its node id.
Requires:       pipewire-utils

%description
Suno's portal backend. It implements AppChooser, ScreenCast and
AudioCapture. AudioCapture shows the Share sound picker and asks
Suno-audio-devices for one capture node carrying the chosen apps' sound.
The first two: AppChooser is the dialog shown when a file is
to be opened with something other than its default application. ScreenCast
answers "share my screen": it asks the Shell to show Suno's picker, with live
previews of every window and screen, and then creates the stream through
Mutter exactly as GNOME's backend does (ADR-041).

Built as the portal rather than as a dialog the file manager owns, so a
sandboxed application asking OpenURI to choose gets the same chooser; the file
manager is then one caller among several instead of the only surface that can
show it.

This package makes Suno's chooser the one that answers AppChooser requests,
and Suno's picker the one that answers screen sharing requests, through the
gnome-portals.conf it installs. That exact filename is what
xdg-desktop-portal looks for first under GNOME, and the first match wins
outright, so the file restates the upstream defaults alongside the chooser
rather than relying on them being inherited.

%prep
%autosetup -n Suno-portal
cp %{SOURCE1} LICENSE.md

%build

%install
install -D -m 0644 data/Suno-portal-appchooser.service \
  %{buildroot}%{_userunitdir}/Suno-portal-appchooser.service
install -D -m 0644 data/Suno-portal-appchooser.preset \
  %{buildroot}%{_userpresetdir}/80-Suno-portal.preset
install -D -m 0755 bin/Suno-portal-appchooser %{buildroot}%{_libexecdir}/Suno-portal-appchooser
install -d -m 0755 %{buildroot}%{python3_sitelib}/Suno_portal
install -m 0644 Suno_portal/*.py %{buildroot}%{python3_sitelib}/Suno_portal/
install -D -m 0644 data/Suno.portal \
  %{buildroot}%{_datadir}/xdg-desktop-portal/portals/Suno.portal
install -D -m 0644 data/org.freedesktop.impl.portal.desktop.Suno.service \
  %{buildroot}%{_datadir}/dbus-1/services/org.freedesktop.impl.portal.desktop.Suno.service
install -D -m 0644 data/open-with.css %{buildroot}%{_datadir}/Suno-portal/open-with.css
install -D -m 0644 data/Suno-appchooser.conf \
  %{buildroot}%{_sysconfdir}/xdg-desktop-portal/gnome-portals.conf

%check
PYTHONPATH=$PWD %{python3} -m unittest discover -s tests -v
PYTHONPATH=$PWD %{python3} -m py_compile Suno_portal/*.py
# The configuration is only read if it owns the name GNOME looks for, and the
# picker is only reached if that file claims the interface. Both have been
# wrong before; neither is visible at runtime until someone tries to share.
grep -Fqx 'org.freedesktop.impl.portal.ScreenCast=Suno;gnome;' \
  data/Suno-appchooser.conf
grep -Fq 'org.freedesktop.impl.portal.ScreenCast' data/Suno.portal
grep -Fq 'org.freedesktop.impl.portal.AppChooser' data/Suno.portal
grep -Fq 'org.freedesktop.impl.portal.AudioCapture' data/Suno.portal
grep -Fqx 'org.freedesktop.impl.portal.AudioCapture=Suno;' data/Suno-appchooser.conf
# Nothing may reach the picker except through the Shell's own interface, and
# nothing may stream before Share: the Mutter session is created in Start.
grep -Fq 'org.projectSuno.Shell.ScreenShare' Suno_portal/screencast.py
grep -Fq 'is-recording' Suno_portal/mutter.py

%post
%systemd_user_post Suno-portal-appchooser.service

%preun
%systemd_user_preun Suno-portal-appchooser.service

%files
%license LICENSE.md
%{_userunitdir}/Suno-portal-appchooser.service
%{_userpresetdir}/80-Suno-portal.preset
%{_libexecdir}/Suno-portal-appchooser
%{python3_sitelib}/Suno_portal/
%{_datadir}/xdg-desktop-portal/portals/Suno.portal
%{_datadir}/dbus-1/services/org.freedesktop.impl.portal.desktop.Suno.service
%{_datadir}/Suno-portal/open-with.css
%config(noreplace) %{_sysconfdir}/xdg-desktop-portal/gnome-portals.conf

%changelog
* Sat Nov 21 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.13
- Nothing is asked or started while the session is locked (lock.py, from
  org.gnome.ScreenSaver): a ScreenCast or AudioCapture Start waits and goes
  on after unlock. Screen sharing pickers are shown one at a time, in order.
  A restored share Mutter refuses as locked waits for unlock instead of
  falling back to the picker.

* Fri Nov 20 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.12
- Share sound picker as Suno Share's card: the asking app with the sharing
  badge, the question, the choices on rounded blocks of SunoUI rows (app
  icon, name, SunoUI's meter, SunoUI's checkbox; the row is the control), an
  equal Cancel and Share pair; sized to its content, the list scrolls past
  half the screen. All sound has no meter.

* Fri Nov 20 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.11
- Restore a shared screen or window through xdg-desktop-portal's restore
  data, so an application's restore token skips the picker; a choice that
  no longer applies shows the picker instead of failing
- Wait for the person at the picker without a D-Bus timeout
- Give applications each stream's pipewire-serial (Mutter's
  PipeWireStreamAddedV2, or the node's object.serial from PipeWire), so
  pipewiresrc finds the stream; a node id is "target not found"
* Thu Nov 19 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.10
- AudioCapture backend: the Share sound picker lists the apps playing with
  live levels and "All sound except" the caller; the chosen sound becomes one
  capture node from Suno-audio-devices; restore data skips the picker
* Thu Sep 17 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.9
- Answer screen sharing requests, so an application asking to share the
  screen gets Suno's picker with live previews of every window and screen
  instead of a list of window names
- Create the stream only once Share is pressed, and tell the application only
  about the sources that were chosen
- Honour a restore token only for the application it was issued to

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.8
- Prefer Suno-background for the Background portal interface only, so a
  sandboxed app's background activity follows the same decisions as Settings
  and the dock; GNOME's backend still answers when Suno-background is absent

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.7
- Claim the bus name before importing Adw. Importing it brings in Gdk, which
  asks the Settings portal for the colour scheme, which is served by the
  process waiting for this name: each waited 25 seconds for the other, the
  chooser was never reached, and every application asking the portal for its
  colour scheme stalled for those 25 seconds after a login
- Activate on demand rather than with the graphical session

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.6
- Speak app ids, not desktop file names, in both directions: the choices the
  caller offers now resolve, and the choice answered with actually opens
- Attach the chooser to the window that asked for it, so a portal backend
  stops appearing in the dock as a running application

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.5
- Skip desktop ids that name nothing installed, which raised out of
  ChooseApplication and left the chooser unshown and the caller unanswered

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.4
- Let systemd own the backend as a Type=dbus unit in the graphical session,
  so a cold login cannot miss the frontend's one activation window

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.3
- Claim the bus name before initialising GTK, so activation no longer times
  out and the frontend stops falling back to the GNOME chooser
- Install the configuration as gnome-portals.conf, the name GNOME actually
  reads, restating the upstream defaults it now shadows

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Give the dialog a height, so the list is not one clipped row
- Focus reads as the accent rather than a warning
- Prefer this chooser, now that it has been seen rendered

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- First packaging of the application chooser portal backend
