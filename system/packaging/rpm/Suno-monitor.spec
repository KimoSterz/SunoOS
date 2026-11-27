# SPDX-License-Identifier: Apache-2.0
#
# Built by scripts/packages/build-Suno-python-app.sh Suno-monitor (or its
# build-Suno-monitor.sh wrapper). The tarball mirrors the repository: the app
# is src/Suno-monitor, and tests/fixtures/monitor-v70.json is read by its tests.
#
# Adapted from work/monitor-this-machine-20260920 (1.Suno.8). Release lineage:
# 1.Suno.7.preview20260911 is in the pool and 1.Suno.8 in incoming, so this is
# 1.Suno.9. Check the pool and incoming before bumping it again.
#
# Since 1.Suno.9 the app installs under %%{_datadir}/Suno-monitor, like the
# other Python SunoUI apps: it finds its stylesheets beside its package, and
# in site-packages that path did not exist.
#
# License: the source files carry Apache-2.0 headers, as 1.Suno.8 did; they are
# not relicensed here.
Name:           Suno-monitor
Version:        0.1.0
Release:        1.Suno.22%{?dist}
Summary:        Native application activity monitor for Suno
License:        Apache-2.0
URL:            https://projectluma.org/
Source0:        %{name}.tar.gz

BuildArch:      noarch
BuildRequires:  python3-devel
BuildRequires:  Suno-application-installer >= 0.1.0-1.Suno.52.creator20261007.1
BuildRequires:  python3-gobject
BuildRequires:  gtk4
BuildRequires:  libadwaita
BuildRequires:  Suno-developer-platform >= 0.1.0-1.Suno.91.creator20261005.1
BuildRequires:  desktop-file-utils
BuildRequires:  dbus-daemon
BuildRequires:  xorg-x11-server-Xvfb
Requires:       python3
Requires:       python3-gobject
Requires:       gtk4
Requires:       libadwaita
Requires:       Suno-developer-platform >= 0.1.0-1.Suno.121
# The "This machine" view reads the report Suno-capability writes. Monitor
# works without it and says the machine has not been checked yet, so this is
# a recommendation rather than a dependency.
Recommends:     Suno-capability
# Authenticates signed installed clients for the narrow host sampler.
Requires:       Suno-application-installer >= 0.1.0-1.Suno.52.creator20261007.1

%description
Application-oriented, read-only system activity with explicitly unavailable
figures when the host cannot supply a measurement, and a "This machine" view
of what this computer can do. Uses SunoUI.

%prep
%autosetup -n %{name}

%build
# Pure Python over SunoUI; nothing to compile.

%install
app=src/Suno-monitor
install -d %{buildroot}%{_datadir}/%{name}/data
cp -R $app/Suno_monitor %{buildroot}%{_datadir}/%{name}/
install -m 0644 $app/data/monitor.css $app/data/machine.css %{buildroot}%{_datadir}/%{name}/data/
# The path the "This machine" window falls back to when started on its own.
ln -s data/monitor.css %{buildroot}%{_datadir}/%{name}/monitor.css
install -d %{buildroot}%{_bindir}
cat >%{buildroot}%{_bindir}/io.Suno.Monitor <<'EOF'
#!%{python3} -sP
import sys
sys.path.insert(0, "%{_datadir}/%{name}")
from Suno_monitor.application import main
raise SystemExit(main())
EOF
chmod 0755 %{buildroot}%{_bindir}/io.Suno.Monitor
install -d %{buildroot}%{_libexecdir}/Suno-app-launchers
mv %{buildroot}%{_bindir}/io.Suno.Monitor %{buildroot}%{_libexecdir}/Suno-app-launchers/io.Suno.Monitor
ln -s %{_libexecdir}/Suno-app-launch %{buildroot}%{_bindir}/io.Suno.Monitor
cat >%{buildroot}%{_bindir}/Suno-monitor-host <<'EOF'
#!%{python3} -s
import sys
sys.path.insert(0, "%{_datadir}/%{name}")
from Suno_monitor.host_sampler import Broker
Broker().run()
EOF
chmod 0755 %{buildroot}%{_bindir}/Suno-monitor-host
install -D -m 0644 $app/data/org.projectSuno.MonitorHost1.service %{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.MonitorHost1.service
install -D -m 0644 $app/data/Suno-monitor-host.service %{buildroot}%{_userunitdir}/Suno-monitor-host.service
install -D -m 0644 $app/data/io.Suno.Monitor.service %{buildroot}%{_datadir}/dbus-1/services/io.Suno.Monitor.service
desktop-file-install --dir=%{buildroot}%{_datadir}/applications $app/data/io.Suno.Monitor.desktop
%py_byte_compile %{python3} %{buildroot}%{_datadir}/%{name}/Suno_monitor

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/io.Suno.Monitor.desktop
grep -Fxq 'Exec=%{_bindir}/io.Suno.Monitor' %{buildroot}%{_datadir}/dbus-1/services/io.Suno.Monitor.service
test -f %{buildroot}%{_datadir}/%{name}/data/monitor.css
test -f %{buildroot}%{_datadir}/%{name}/data/machine.css
%{python3} counted-unittest.py --self-test
PYTHONPATH=$PWD/src/Suno-monitor %{python3} counted-unittest.py src/Suno-monitor/tests 99
# The installed tree imports as the launcher imports it, and the stylesheets
# the app resolves from its own location are there.
PYTHONPATH= %{python3} -c "
import sys
from pathlib import Path
sys.path.insert(0, '%{buildroot}%{_datadir}/%{name}')
import Suno_monitor.application as a
for leaf in ('monitor.css', 'machine.css'):
    path = Path(a.__file__).resolve().parents[1] / 'data' / leaf
    assert path.is_file(), f'missing {path}'
print('Monitor imports from the installed tree and finds its stylesheets')
"
cd src/Suno-monitor
dbus-run-session -- env PYTHONPATH=$PWD %{python3} tests/host_api_runtime.py
dbus-run-session -- xvfb-run -a --server-args="-screen 0 1800x1000x24" env GSK_RENDERER=cairo GTK_A11Y=none GSETTINGS_BACKEND=memory SUNO_MONITOR_STYLE_PATH=$PWD/data/monitor.css PYTHONPATH=$PWD %{python3} tests/creator_preview_runtime.py
dbus-run-session -- xvfb-run -a env GSK_RENDERER=cairo SUNO_MONITOR_STYLE_PATH=$PWD/data/monitor.css PYTHONPATH=$PWD %{python3} tests/runtime_smoke.py
dbus-run-session -- xvfb-run -a env GSK_RENDERER=cairo SUNO_MONITOR_STYLE_PATH=$PWD/data/monitor.css PYTHONPATH=$PWD %{python3} tests/responsive_smoke.py
dbus-run-session -- xvfb-run -a env GSK_RENDERER=cairo SUNO_MONITOR_STYLE_PATH=$PWD/data/monitor.css PYTHONPATH=$PWD %{python3} tests/machine_runtime.py
# Window map to first app rows painted on a desktop-sized process table: a
# relaunch over the last list within 200 ms, a first launch within 800 ms.
%{python3} tests/first_entries.py --budget-ms 200 --cold-budget-ms 800

%files
%{_libexecdir}/Suno-app-launchers/io.Suno.Monitor
%license LICENSE.md
%{_bindir}/io.Suno.Monitor
%{_bindir}/Suno-monitor-host
%{_userunitdir}/Suno-monitor-host.service
%{_datadir}/%{name}/
%{_datadir}/applications/io.Suno.Monitor.desktop
%{_datadir}/dbus-1/services/io.Suno.Monitor.service
%{_datadir}/dbus-1/services/org.projectSuno.MonitorHost1.service

%changelog
* Fri Nov 13 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.22
- GPU: utilisation per GPU and per app from DRM fdinfo engine counters (i915, xe,
  amdgpu, msm and others); "Not available" when a driver reports none

* Fri Nov 13 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.21
- Round the installed memory in the sidebar to one decimal

* Sat Nov 07 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.20
- Open on the last app list, greyed until the first live reading replaces it
- Paint the first rows of a long list first and update rows in place each second
- Drop the host service's CPU quota; reuse samples and verified callers instead
- Check window-map to first rows painted in %%check

* Sat Oct 31 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.19
- Require the developer platform that ships the shared application launcher.

* Fri Oct 30 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.18.mobile20261030.1
- Use the shared prepared application launcher

* Sat Oct 10 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.17.creator20261010.1
- Fix the host namespace needed to verify signed Monitor callers
- Show unavailable activity, preserve stale readings and recover after errors
- Verify real signed service admission and headless/GTK error recovery

* Wed Oct 07 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.16.creator20261007.1
- Supply the signed application host sampler and bounded process identity API
- Qualify actual host D-Bus controls and the responsive production UI

* Tue Oct 06 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.16.creator20261007.1
- Start the first asynchronous sample when the window appears
- Remove the redundant This computer sidebar heading

* Mon Oct 05 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.14.creator20261005.1
- Supply canonical glyphs for reachable This machine application-menu actions
- Verify all menu icon names through actual GTK theme lookup

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.12.creator20261004.1
- Monitor: force-quit confirmation and the latest SunoUI port.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.10
- SunoUI port update: the app follows the latest approved design.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.9
- Built from the SunoUI port of Monitor. Installs under /usr/share/Suno-monitor
  so the app finds its stylesheets, including the "This machine" one.

* Sun Sep 20 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.8
- "This machine" view from the capability report; follows the appearance.
