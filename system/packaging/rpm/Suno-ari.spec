# SPDX-License-Identifier: Apache-2.0

Name:           Suno-ari
Version:        0.1.0
Release:        1.Suno.23%{?dist}
Summary:        Suno's assistant with local and connected models
License:        Apache-2.0
URL:            https://projectluma.org/apps/ari
Source0:        Suno-ari.tar.gz
Source1:        LICENSE.md

BuildArch:      noarch
BuildRequires:  Suno-developer-platform >= 0.1.0-1.Suno.100.creator20261007.1
BuildRequires:  python3-gobject-base
BuildRequires:  python3-jwt
BuildRequires:  python3-cryptography
BuildRequires:  meson >= 1.3
BuildRequires:  ninja-build
BuildRequires:  python3-devel >= 3.11
BuildRequires:  systemd-rpm-macros
BuildRequires:  glib2-devel
BuildRequires:  xorg-x11-server-Xvfb
BuildRequires:  dbus-daemon
BuildRequires:  libXtst
Requires:       python3 >= 3.11
Requires:       python3-gobject
Requires:       python3-jwt
Requires:       python3-cryptography
Requires:       libsecret
Requires:       at-spi2-core
Requires:       Suno-developer-platform >= 0.1.0-1.Suno.100.creator20261007.1
Requires:       Suno-ari-runtime >= 0.4.0
Requires:       Suno-display-config
Requires:       dbus-common
Requires:       bubblewrap
Requires:       Suno-developer-platform-sdk >= 0.1.0-1.Suno.100.creator20261007.1
Requires:       Suno-application-installer >= 0.1.0-1.Suno.76
# The weather tool reads the Weather app's forecast backend when it is there.
Recommends:     prairie-core-apps

%description
Ari answers questions and changes personal settings such as the dock, the
theme, the wallpaper and the refresh rate. Application actions, SDK projects,
isolated builds and reviewed software transactions use their owning services.
Successful changes are recorded, with undo when the backend supports it.
The daemon runs an open model locally through Suno-ari-runtime or
connects to your ChatGPT plan or OpenRouter. It keeps
conversations and an append-only activity log in the person's own data folder,
and decides in code which tools may run.

This package is the host side: the ari command, the daemon and its
org.projectSuno.Ari1 service. The interface ships as the org.projectSuno.Ari
Flatpak.

%prep
%autosetup -n Suno-ari/src/Suno-ari
cp %{SOURCE1} LICENSE.md

%build
%meson -Dui=false
%meson_build

%install
%meson_install

%check
PYTHONPATH=$PWD GSETTINGS_BACKEND=memory %{python3} -m unittest discover -s ../../tests/Suno-ari -p "test_*.py" -v
PYTHONPATH=$PWD dbus-run-session -- %{python3} ../../tests/Suno-ari/native_host_identity.py
%{python3} -m py_compile ari/*.py ari/tools/*.py ari_ui/*.py eval/run.py
# Every module the daemon imports must be installed, not only present in the tree.
PYTHONPATH=%{buildroot}%{python3_sitelib} %{python3} -P -c "import jwt, cryptography, ari.chatgpt, ari.chatgpt_provider, ari.cloud, ari.service"
glib-compile-schemas --strict --dry-run data
%{python3} -c "import json; json.load(open('eval/cases.json'))"
native_home=$(mktemp -d)
trap 'rm -rf "$native_home"' EXIT
# The interface is not installed here; its native check runs from the source tree.
PYTHONPATH=$PWD XDG_CONFIG_HOME="$native_home/config" XDG_DATA_HOME="$native_home/data" GSETTINGS_BACKEND=memory GSK_RENDERER=cairo dbus-run-session -- xvfb-run -a -s "-screen 0 1920x1080x24" %{python3} ../../tests/Suno-ari/native_sidebar_controls.py

%files
%license LICENSE.md
%doc README.md
%{_bindir}/ari
%{_libexecdir}/Suno-ari/ari-daemon
%{python3_sitelib}/ari/
%{_datadir}/Suno-ari/
%{_datadir}/glib-2.0/schemas/org.projectSuno.Ari.gschema.xml
%{_datadir}/dbus-1/services/org.projectSuno.Ari1.service
%{_userunitdir}/ari-daemon.service

%changelog
* Wed Nov 25 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.23
- Ari1's native path refuses Suno's launcher sandboxes: a caller in an
  app-Suno-* scope, or a host xdg-dbus-proxy without a sandbox file.

* Wed Nov 04 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.22
- Ship the host only: the ari command, the daemon and org.projectSuno.Ari1.
  The interface comes from the org.projectSuno.Ari Flatpak.

* Thu Oct 29 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.21.creator20261029.1
- Add ChatGPT plan sign-in, account management and model selection.
- Add hosted search requests, linked sources, effort controls and model family pages.
- Connect application actions, isolated project builds and reviewed software installation and removal.

* Sat Oct 24 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.20.creator20261024.1
- Use the headless display backend instead of the retired Displays application.

* Tue Oct 20 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.19.creator20261019.3
- Export the assistant interface before accepting activated requests.

* Tue Oct 20 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.18.creator20261019.2
- Allow the user service to verify signed Ari model-download requests.

* Mon Oct 19 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.17.creator20261019.1
- Load local models without waiting for cloud discovery; recover failed service connections.

* Wed Oct 07 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.16.creator20261007.1
- Preserve secondary ink on welcome suggestions and verify real mapped contrast.

* Mon Oct 05 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.16.creator20261007.1
- Keep sidebar controls in the application menu and F9; preserve phone title navigation.
- Gate installed responsive sidebar/menu behavior with the real GTK window.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.13.creator20261004.1
- Ari's own mark is found as a named icon from its icons folder.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.11.SunoUI20260928.1
- SunoUI update from the Prairie rollout review.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.10
- SunoUI port update: the app follows the latest approved design.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.9
- SunoUI port: the app is rebuilt on SunoUI to match the approved design.

* Mon Sep 14 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.8
- Draw Ari's icon as a full tile at the corner ratio every Suno app icon uses, so it matches the dock

* Mon Sep 14 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.7
- Think through OpenRouter: recommended models by role, any model by search or ID, live prices, expensive-model confirmation, a monthly limit and the key in the keyring

* Mon Sep 14 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.6
- Take nothing when idle: the model unloads a minute after an answer, at once when Ari closes or memory runs short, and the daemon exits after two quiet minutes
- The model runs at low CPU and I/O weight with half the context memory

* Mon Sep 14 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.5
- One settings catalogue for every user preference, with undo
- Any media player through MPRIS; time zone, volume, Do Not Disturb, Wi-Fi, Bluetooth and tiling
- Approval cards with Ask before system changes, every change, or never; a lockable master switch
- Wallpapers as Settings lists them; apps by any name; replies in the person's units
- Short follow-ups keep their context; instructions are never recited; false claims are corrected

* Sun Sep 13 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.4
- Models, Permissions and Activity pages: switch, download and remove models, turn personal settings off, undo from the log

* Sun Sep 13 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.3
- Screen brightness, with undo
- Ari knows the current settings and what she changed today
- A setting's value must come from the person; the model cannot substitute one

* Sun Sep 13 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Let the model go after five quiet minutes; fall back to the CPU when GPU memory is short
- The quick-popover shortcut also closes it

* Sun Sep 13 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- First Ari: local model, answers, personal settings with undo, activity log
