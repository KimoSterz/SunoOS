# SPDX-License-Identifier: MPL-2.0

Name:           Suno-background
Version:        0.1.0
Release:        1.Suno.6%{?dist}
Summary:        Background activity for Suno apps: small agents that keep apps working
License:        MPL-2.0
URL:            https://projectluma.org/developer/kit/background-agents
Source0:        Suno-background.tar.gz

BuildArch:      noarch
BuildRequires:  python3-devel >= 3.11
BuildRequires:  systemd-rpm-macros
BuildRequires:  python3-gobject-base
BuildRequires:  Suno-application-installer >= 0.1.0-1.Suno.53.creator20261007.1
Requires:       python3 >= 3.11
Requires:       python3-gobject-base
# Native service clients require the signed installed/retained application boundary.
Requires:       Suno-application-installer >= 0.1.0-1.Suno.53.creator20261007.1
# RestartSteps=, RestartMaxDelaySec= and ManagedOOMMemoryPressureDurationSec=
Requires:       systemd >= 256
# Timers deliver scheduled wakes with busctl, which systemd ships.
Requires:       /usr/bin/busctl
# Wake-ups for alarms: polkit decides who may wake the computer.
Requires:       polkit
Requires:       /usr/bin/true
Recommends:     xdg-desktop-portal
# Makes this the Background portal backend; without it GNOME's answers.
Recommends:     Suno-portal >= 0.1.0-1.Suno.8
# Agents publish Live Extensions under their app's identity with this broker.
Recommends:     Suno-developer-platform >= 0.1.0-1.Suno.65

%description
Some apps are only useful if they keep working when their windows are closed:
messages, calls, reminders, alarms and mail. Suno-background runs each such
app's small background agent instead of its whole interface.

It registers agents from installed declarations and from the Background
portal, applies the person's decisions over Suno's defaults, runs each agent as
a systemd user unit with its category's memory, processor and disk limits,
wakes agents at login, when the network comes online, after sleep and on
schedules, pauses the ones that can wait while Power Saver is on, restarts
crashed agents and logs everything with the app's ID. Settings and the dock
show and change it through org.projectSuno.Background1, and sandboxed apps
reach the same decisions through the standard Background portal.

It also carries org.projectSuno.BackgroundWake1, a small system service that
lets the active session wake a suspended computer for an alarm: polkit decides
who may, and systemd arms the RTC alarm as a transient timer.

%prep
%autosetup -n Suno-background

%build

%install
install -d -m 0755 %{buildroot}%{python3_sitelib}/Suno_background
install -m 0644 Suno_background/*.py %{buildroot}%{python3_sitelib}/Suno_background/
install -D -m 0755 bin/Suno-background-service %{buildroot}%{_libexecdir}/Suno-background-service
install -D -m 0755 bin/Suno-background %{buildroot}%{_bindir}/Suno-background
install -D -m 0644 data/Suno-background.service %{buildroot}%{_userunitdir}/Suno-background.service
install -m 0644 data/Suno-background.slice data/Suno-background-essential.slice \
  data/Suno-background-deferrable.slice %{buildroot}%{_userunitdir}/
install -D -m 0644 data/Suno-background.preset %{buildroot}%{_userpresetdir}/80-Suno-background.preset
install -D -m 0644 data/org.projectSuno.Background1.service \
  %{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.Background1.service
install -m 0644 data/org.freedesktop.impl.portal.desktop.Suno.background.service \
  %{buildroot}%{_datadir}/dbus-1/services/
install -D -m 0644 data/Suno-background.portal \
  %{buildroot}%{_datadir}/xdg-desktop-portal/portals/Suno-background.portal
install -D -m 0644 data/defaults.toml %{buildroot}%{_datadir}/Suno-background/defaults.toml
install -D -m 0644 data/org.projectSuno.Background.desktop \
  %{buildroot}%{_datadir}/applications/org.projectSuno.Background.desktop
install -d -m 0755 %{buildroot}%{_datadir}/Suno/background %{buildroot}%{_sysconfdir}/Suno-background
# GNOME's session starts autostart entries itself and reads gnome/autostart in
# the data directories before /etc/xdg/autostart: these hidden entries keep it
# from also starting the fallback of an agent this service runs.
install -d -m 0755 %{buildroot}%{_datadir}/gnome/autostart
install -m 0644 data/session-autostart/*.desktop %{buildroot}%{_datadir}/gnome/autostart/
# Wake-ups for alarms (system bus, D-Bus activated, polkit-guarded).
install -D -m 0755 bin/Suno-background-wake %{buildroot}%{_libexecdir}/Suno-background-wake
install -D -m 0644 data/Suno-background-wake.service %{buildroot}%{_unitdir}/Suno-background-wake.service
install -D -m 0644 data/org.projectSuno.BackgroundWake1.conf \
  %{buildroot}%{_datadir}/dbus-1/system.d/org.projectSuno.BackgroundWake1.conf
install -D -m 0644 data/org.projectSuno.BackgroundWake1.system.service \
  %{buildroot}%{_datadir}/dbus-1/system-services/org.projectSuno.BackgroundWake1.service
install -D -m 0644 data/org.projectSuno.background.policy \
  %{buildroot}%{_datadir}/polkit-1/actions/org.projectSuno.background.policy

%check
cd tests && PYTHONPATH=$PWD/..:$PWD %{python3} -m unittest -v test_declaration test_registry_units test_manager test_wake test_login \
  test_session_autostart test_native_service
cd .. && %{python3} -m py_compile Suno_background/*.py
desktop-file-validate %{buildroot}%{_datadir}/applications/org.projectSuno.Background.desktop || :
for entry in Calendar Charlie Connect Messages Phone; do
  desktop-file-validate %{buildroot}%{_datadir}/gnome/autostart/org.projectSuno.$entry.Agent.desktop
  grep -qx 'Hidden=true' %{buildroot}%{_datadir}/gnome/autostart/org.projectSuno.$entry.Agent.desktop
done
%{python3} -c 'import sys, xml.dom.minidom as m; [m.parse(p) for p in sys.argv[1:]]' \
  %{buildroot}%{_datadir}/dbus-1/system.d/org.projectSuno.BackgroundWake1.conf \
  %{buildroot}%{_datadir}/polkit-1/actions/org.projectSuno.background.policy
grep -qx 'SystemdService=Suno-background-wake.service' \
  %{buildroot}%{_datadir}/dbus-1/system-services/org.projectSuno.BackgroundWake1.service

%post
%systemd_user_post Suno-background.service
%systemd_post Suno-background-wake.service

%preun
%systemd_user_preun Suno-background.service
%systemd_preun Suno-background-wake.service

%postun
%systemd_postun Suno-background-wake.service

%files
%license LICENSE
%{python3_sitelib}/Suno_background/
%{_libexecdir}/Suno-background-service
%{_bindir}/Suno-background
%{_userunitdir}/Suno-background.service
%{_userunitdir}/Suno-background.slice
%{_userunitdir}/Suno-background-essential.slice
%{_userunitdir}/Suno-background-deferrable.slice
%{_userpresetdir}/80-Suno-background.preset
%{_datadir}/dbus-1/services/org.projectSuno.Background1.service
%{_datadir}/dbus-1/services/org.freedesktop.impl.portal.desktop.Suno.background.service
%{_datadir}/xdg-desktop-portal/portals/Suno-background.portal
%dir %{_datadir}/Suno-background
%{_datadir}/Suno-background/defaults.toml
%dir %{_datadir}/Suno
%dir %{_datadir}/Suno/background
%dir %{_sysconfdir}/Suno-background
%{_datadir}/applications/org.projectSuno.Background.desktop
%dir %{_datadir}/gnome
%dir %{_datadir}/gnome/autostart
%{_datadir}/gnome/autostart/org.projectSuno.*.Agent.desktop
%{_libexecdir}/Suno-background-wake
%{_unitdir}/Suno-background-wake.service
%{_datadir}/dbus-1/system.d/org.projectSuno.BackgroundWake1.conf
%{_datadir}/dbus-1/system-services/org.projectSuno.BackgroundWake1.service
%{_datadir}/polkit-1/actions/org.projectSuno.background.policy

%changelog
* Wed Nov 25 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.6
- The Background portal backend has its own bus connection and answers only
  xdg-desktop-portal, checked by process.
- Apps read only their own agent and login item; AgentChanged is sent to the
  app it concerns, the dock and Settings only.
- An unreadable or malformed .flatpak-info is refused, not taken for a native
  process; a Flatpak must be its signed deployment; a process in another
  filesystem is never trusted by its executable.
- A same-ID Flatpak exported ahead of a system package's desktop entry no
  longer stops that package's declared agent being generated.
- A caller is held by its pidfd; a bus that names ProcessFD but doesn't
  deliver it is refused; only a bus that offers none falls back to the pid,
  held by its start time.
- Both bus names are owned with DO_NOT_QUEUE; if either is taken the service
  exits with an error instead of running beside the holder.

* Wed Oct 07 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.5
- Keep the four native core services behind independently updated, signed UIs; retain trusted host declarations and capped managed units
- Interface version 3 provides authenticated foreground leases without changing background decisions; disconnect, close and explicit stop release them

* Fri Sep 18 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.4
- GNOME's session no longer starts the fallback autostart entries of Calendar, Charlie, Suno Connect, Messages and Phone agents that this service runs: hidden entries in gnome/autostart stand in front of them, so no scope fails at every login; without this package the fallbacks start as before
* Wed Sep 16 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.3
- Open at Login (interface version 2): ListLoginItems, GetLoginItem, SetLoginItem and LoginItemsChanged give one answer per app from the person's and the system's XDG autostart entries, the Background portal's entries and agents, read as systemd-xdg-autostart-generator reads them
- Turning an app off writes the standard Hidden=true override in the person's folder and never touches system files; turning it on removes that override or writes an entry from the app's own desktop entry
- For an app whose portal autostart entry this service runs as its agent, the switch is the agent's allow decision, so the dock shows one control for it

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Charlie is on by default, like Suno's other communication apps
- An app whose agent the service runs is no longer started a second time by the session: the portal's autostart entry for it and any autostart entry naming its agent (X-Suno-Background-Agent, in the person's or the system's folder) stay masked while the agent is managed
- Units and those masks are loaded before the service reports ready, so the session's autostart can no longer run ahead of them at login
- org.projectSuno.BackgroundWake1: the active session can wake a suspended computer for an alarm; polkit-guarded, eight wake-ups per person, armed by systemd as transient WakeSystem timers

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- First release: the background activity service of ADR-033
