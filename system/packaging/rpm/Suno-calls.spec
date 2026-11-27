# SPDX-License-Identifier: Apache-2.0

Name:           Suno-calls
Version:        0.1.0
Release:        1.Suno.3%{?dist}
Summary:        Call activity producer for Project Suno's live extensions
License:        Apache-2.0
URL:            https://projectluma.org/platform/calls
Source0:        Suno-calls.tar.gz
Source1:        LICENSE.md

BuildArch:      noarch
BuildRequires:  python3-devel >= 3.11
BuildRequires:  desktop-file-utils
BuildRequires:  systemd-rpm-macros
Requires:       python3 >= 3.11
Requires:       python3-gobject
# The producer reads PipeWire's node graph and publishes to the Semantic
# Broker; without either there is nothing to observe and nowhere to say it.
Requires:       pipewire
# pw-dump watches the graph and pw-cli applies per-stream mutes.
Requires:       pipewire-utils
Requires:       Suno-shell-state

%description
Suno Calls watches PipeWire for an application that holds a microphone stream
and a matching playback stream from the same binary, which is what being in a
call looks like from outside the application. It recognises no application by
name: Discord, Teams, Zoom and a browser tab all qualify the same way, and a
system component that merely opens an input never does.

Qualifying activity is published to the Semantic Broker as a live extension, so
the shell can surface the call and offer mute and deafen for any of those
applications without them being integrated with Suno: both act on the
application's own PipeWire streams, follow streams it reopens during the call,
and are undone when the call ends. Hang-up is offered only for calls Suno
carries itself.

%prep
%autosetup -n Suno-calls
cp %{SOURCE1} LICENSE.md

%build

%install
install -D -m 0755 bin/Suno-calls-producer %{buildroot}%{_libexecdir}/Suno-calls-producer
install -d -m 0755 %{buildroot}%{python3_sitelib}/Suno_calls
install -m 0644 Suno_calls/*.py %{buildroot}%{python3_sitelib}/Suno_calls/
install -D -m 0644 data/Suno-calls-producer.service \
  %{buildroot}%{_userunitdir}/Suno-calls-producer.service
# The Semantic Broker resolves a publisher's identity from a root-owned desktop
# file, so this entry is the producer's credential and not a launcher: it is
# NoDisplay and there is nothing for a person to open.
install -D -m 0644 data/org.projectSuno.Calls.desktop \
  %{buildroot}%{_datadir}/applications/org.projectSuno.Calls.desktop

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/org.projectSuno.Calls.desktop
PYTHONPATH=$PWD %{python3} -m py_compile Suno_calls/*.py
PYTHONPATH=$PWD %{python3} -m unittest -v tests/test_Suno_calls_audio.py

%post
%systemd_user_post Suno-calls-producer.service

%preun
%systemd_user_preun Suno-calls-producer.service

%files
%license LICENSE.md
%{_libexecdir}/Suno-calls-producer
%{python3_sitelib}/Suno_calls/
%{_userunitdir}/Suno-calls-producer.service
%{_datadir}/applications/org.projectSuno.Calls.desktop

%changelog
* Wed Sep 16 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.3
- Mute and deafen any application in a call at its PipeWire streams
- Keep a mute across streams the application reopens mid-call
- Undo WirePlumber's remembered mute when the call ends
- Publish only controls that work: no end-call for third-party applications
* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Log under Suno-calls rather than systemd-run
- Do not start in the login screen's greeter session
* Fri Sep 11 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- First packaging of the call activity producer
