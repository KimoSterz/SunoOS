# SPDX-License-Identifier: Apache-2.0

Name:           Suno-greeter
Version:        0.1.0
Release:        1.Suno.15%{?dist}
Summary:        Project Suno native handheld Presence greeter
License:        Apache-2.0
URL:            https://projectluma.org/
Source0:        Suno-greeter.c
Source1:        Suno-greeter.css
Source2:        README.md
Source3:        LICENSE.md
Source4:        Suno-greeter-session.c
Source5:        30-Suno-greetd-vt.conf
Source6:        Suno-presence-compositor.c
Source7:        Suno-display.sysusers
Source8:        Suno-display.tmpfiles
Source9:        Suno-phosh-client-session
Source10:       60-Suno-greeter-brightness.rules

BuildRequires:  gcc
BuildRequires:  gtk4-devel
BuildRequires:  json-glib-devel
BuildRequires:  pkgconfig
BuildRequires:  systemd-rpm-macros
Requires:       google-figtree-fonts
Requires:       greetd >= 0.10.3
Requires:       Suno-greetd-session >= 0.10.3-1.Suno.1
Requires:       gtk4
Requires:       json-glib
Requires:       Suno-backgrounds >= 0.1.0-1.Suno.3
Requires:       Suno-phosh >= 0.55.0-1.Suno.6
Requires:       phoc >= 0.55.1-2.Suno.3
Requires:       wlr-randr

%description
Suno's source-owned pre-session Presence presentation for handheld devices.
It authenticates through greetd and PAM, reads the selected identity from the
host account service, and contains no credential store, web view, user-session
overlay, or Android dependency.

%prep
cp %{SOURCE0} Suno-greeter.c
cp %{SOURCE1} Suno-greeter.css
cp %{SOURCE2} README.md
cp %{SOURCE3} LICENSE.md
cp %{SOURCE4} Suno-greeter-session.c
cp %{SOURCE5} 30-Suno-greetd-vt.conf
cp %{SOURCE6} Suno-presence-compositor.c
cp %{SOURCE7} Suno-display.sysusers
cp %{SOURCE8} Suno-display.tmpfiles
cp %{SOURCE9} Suno-phosh-client-session
cp %{SOURCE10} 60-Suno-greeter-brightness.rules

%build
%{__cc} %{build_cflags} %{build_ldflags} -Werror -Wall -Wextra \
  -o Suno-greeter Suno-greeter.c \
  $(pkg-config --cflags --libs gtk4 json-glib-1.0)
%{__cc} %{build_cflags} %{build_ldflags} -Werror -Wall -Wextra \
  -o Suno-greeter-session Suno-greeter-session.c
%{__cc} %{build_cflags} %{build_ldflags} -Werror -Wall -Wextra \
  -o Suno-presence-compositor Suno-presence-compositor.c

%install
install -D -m 0755 Suno-greeter %{buildroot}%{_bindir}/Suno-greeter
install -D -m 0755 Suno-greeter-session \
  %{buildroot}%{_libexecdir}/Suno-greeter-session
install -D -m 0755 Suno-presence-compositor \
  %{buildroot}%{_libexecdir}/Suno-presence-compositor
install -D -m 0755 Suno-phosh-client-session \
  %{buildroot}%{_libexecdir}/Suno-phosh-client-session
install -D -m 0644 Suno-greeter.css \
  %{buildroot}%{_datadir}/Suno-greeter/Suno-greeter.css
install -D -m 0644 README.md %{buildroot}%{_pkgdocdir}/README.md
install -D -m 0644 30-Suno-greetd-vt.conf \
  %{buildroot}%{_unitdir}/greetd.service.d/30-Suno-greetd-vt.conf
install -D -m 0644 Suno-display.sysusers \
  %{buildroot}%{_sysusersdir}/Suno-display.conf
install -D -m 0644 Suno-display.tmpfiles \
  %{buildroot}%{_tmpfilesdir}/Suno-display.conf
install -D -m 0644 60-Suno-greeter-brightness.rules \
  %{buildroot}%{_datadir}/polkit-1/rules.d/60-Suno-greeter-brightness.rules

%check
test -x %{buildroot}%{_bindir}/Suno-greeter
test -x %{buildroot}%{_libexecdir}/Suno-greeter-session
test -x %{buildroot}%{_libexecdir}/Suno-presence-compositor
test -x %{buildroot}%{_libexecdir}/Suno-phosh-client-session
test -s %{buildroot}%{_datadir}/Suno-greeter/Suno-greeter.css
test -s %{buildroot}%{_unitdir}/greetd.service.d/30-Suno-greetd-vt.conf
grep -Fq 'd /run/Suno-display 2770 greetd Suno-display -' Suno-display.tmpfiles
grep -Fq 'SUNO_HOME_READY' Suno-greeter.c
grep -Fq '_exit(EXIT_SUCCESS)' Suno-greeter.c
grep -Fq 'SUNO_IDLE_SECONDS 30' Suno-greeter.c
grep -Fq 'org.freedesktop.login1.set-brightness' \
  60-Suno-greeter-brightness.rules

%files
%license LICENSE.md
%doc %{_pkgdocdir}/README.md
%{_bindir}/Suno-greeter
%{_libexecdir}/Suno-greeter-session
%{_libexecdir}/Suno-presence-compositor
%{_libexecdir}/Suno-phosh-client-session
%{_datadir}/Suno-greeter/
%{_unitdir}/greetd.service.d/30-Suno-greetd-vt.conf
%{_sysusersdir}/Suno-display.conf
%{_tmpfilesdir}/Suno-display.conf
%{_datadir}/polkit-1/rules.d/60-Suno-greeter-brightness.rules

%changelog
* Mon Aug 31 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.15
- Declare only the session type. Supplying XDG_VTNR made logind treat the new
  session as the seat's owner, activate it, and pause the running compositor's
  DRM and input devices mid-handoff. The seat now stays with the compositor;
  greetd gives the authenticated session no seat at all.

* Mon Aug 31 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.14
- Supply XDG_VTNR and XDG_SESSION_TYPE when starting the authenticated session.
  greetd runs that session in a terminal mode that never touches the VT the
  persistent compositor owns, so it set neither PAM_TTY nor XDG_VTNR while
  still exporting XDG_SEAT=seat0. logind rejects a session on a seat that has
  VTs unless vtnr is 1..63, so CreateSession failed with InvalidParameter, the
  account got no runtime directory, the session aborted on its own missing-bus
  guard, and greetd tore down the compositor and restarted into the greeter.

* Mon Aug 31 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.13
- Blank idle pre-session Presence through narrowly authorized logind brightness control

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.12
- Keep Presence visually stable while authenticated Home assembles

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.11
- Make persistent Wayland sockets inherit the authenticated display group

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.10
- Bind the authenticated Phosh client to Suno's systemd user bus

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.9
- Assign the image-created Suno account to display access during composition

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.8
- Use Fedora's packaged Phoc configuration path

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.7
- Keep Presence and authenticated Home on one persistent compositor

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.6
- Paint a final wallpaper-only frame before the authenticated compositor handoff

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.5
- Keep compositor diagnostics off the product VT during session handoff

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.4
- Start the authenticated renderer directly and reserve a quiet display VT

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.3
- Enforce a square avatar allocation and center the quiet unlock hint

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.2
- Set the FP6 logical panel scale through native compositor initialization

* Sun Aug 30 2026 Project Suno <builds@projectSuno.org> - 0.1.0-1.Suno.1
- Introduce the native greetd/PAM-backed handheld Presence greeter
