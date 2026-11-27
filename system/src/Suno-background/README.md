<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Suno-background

The session service lets apps continue work after their windows close using a
small background agent that it registers, allows or refuses, starts, wakes,
limits and reports. The [declaration parser](Suno_background/declaration.py),
[lifecycle manager](Suno_background/manager.py) and
[D-Bus service](Suno_background/service.py) define the source-owned contract.

| Module | Owns |
| --- | --- |
| `ids.py` | Application, agent and schedule identifiers, and every unit name derived from them |
| `declaration.py`, `desktop.py` | Reading installed `[background]` declarations and desktop entries |
| `registry.py` | Which apps have agents: declarations, portal autostart entries, portal decisions; which autostart entries an agent replaces |
| `policy.py` | The person's decisions over `defaults.toml` |
| `units.py`, `systemd.py` | Generated units and timers, and the user manager's D-Bus API |
| `manager.py` | Wakes, schedules, Power Saver, crashes, prompts, reporting (no D-Bus, testable) |
| `wakes.py` | NetworkManager, logind and power-profiles-daemon |
| `portal.py` | The Background portal backend and the portal permission table |
| `login.py` | Open at Login: whether an app starts at login, from every autostart source, and the standard writes that change it |
| `identity.py` | Who is calling, from D-Bus credentials |
| `prompt.py` | The one-time question, as a notification |
| `service.py`, `cli.py` | `org.projectSuno.Background1`, and `Suno-background` |
| `wake.py` | `org.projectSuno.BackgroundWake1`, the polkit-guarded system helper that wakes a suspended computer for alarms |

## Who may ask

- `org.projectSuno.Background1`: sandboxed callers must be signed Suno apps
  (the installer's `authenticate`); third-party Flatpaks use the Background
  portal instead. Apps read and hear only their own agent and login item;
  Settings, the Shell and Phosh (`identity.is_trusted_host`) read everything.
- The portal backend (`org.freedesktop.impl.portal.desktop.Suno.background`)
  is on a connection of its own and answers only xdg-desktop-portal: the
  owner of `org.freedesktop.portal.Desktop`, running the root-owned
  `/usr/libexec/xdg-desktop-portal` in `xdg-desktop-portal.service`, on the
  host's filesystem. Keep xdg-desktop-portal started by that unit (D-Bus
  activation with `SystemdService=`); started any other way it is not
  recognised and the backend refuses it.
- Both names are owned with `DO_NOT_QUEUE`; if either is already taken the
  service logs it and exits rather than run beside an impostor.
- Host programs are same-user trust, not a boundary. A program the person
  runs outside a sandbox can be an allowed executable, move itself into
  another app's scope, or own a name first; it can also edit this service's
  files directly. These checks stop sandboxed apps.

Tests: `tests/Suno-background` (unit), `tests/integration/Suno-background`
(a real systemd user session in a disposable Fedora 44 container; never on a
machine someone uses). `system_checks.py` there exercises systemd-oomd and the
wake helper against the real system manager and polkit, in such a container
only.

Licensed MPL-2.0 (`LICENSE`). Documentation CC-BY-SA-4.0.
