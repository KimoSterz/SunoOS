# Luma shell state

This package exposes the form-factor-neutral Luma shell contract on the user
session bus. It deliberately reuses standard GNOME settings as the canonical
storage for favorites, wallpaper, appearance, idle blanking, and the on-screen
keyboard. The Luma schema stores only product state with no standard home.

Schema version 2 adds the renderer-independent **Shelf** contract. It records
edge, anchoring, island relationship, visibility, work-area, overflow,
monitor, and material policy without exposing GNOME Shell actor names. Dark is
the default material; Light, Glass, and Frost remain selectable treatments.
Automatic hiding is intentionally rejected in v1. This boundary lets a future
trusted Mod replace the Shelf capability through declared ownership rather
than runtime monkey-patching, extensions, polling, or startup scripts.

Phosh/Phoc and Luma GNOME/Mutter are renderers of this state. Neither renderer
may introduce a second settings database or a second application catalog.
Phosh's legacy `favorites` key is treated strictly as a bidirectional renderer
projection of `org.gnome.shell favorite-apps`, so reordering in either posture
updates the same canonical order.

The packaged `Luma` and `Luma-dark` GTK 3 themes use GTK's supported system
theme interface for legacy applications and native Phosh widget types. The
session service projects an explicitly chosen `surface-treatment` onto those
Luma-owned theme names, otherwise following `color-scheme`. Dark selects
`Luma-dark`; Light and unsupported Frost/Glass use opaque `Luma`. GTK 3
predates the modern appearance setting;
it never replaces a deliberately selected third-party theme. The themes do
not use a user stylesheet, application wrapper, or second shell surface.
`luma-shell-statectl get` prints the effective, non-sensitive state for
diagnostics. Mutating operations validate desktop IDs and local wallpaper URIs
before changing the canonical settings.

## Who may change and read the state

Every setter changes the whole session, so it answers only GNOME Shell,
Phosh, Settings (`gnome-control-center`) and `luma-shell-statectl`; anything
else gets `org.freedesktop.DBus.Error.AccessDenied` and nothing changes.
`ReportInputCapabilities` answers only the compositor.

The caller is identified the way luma-background identifies a trusted host:
from its process, never from its arguments or a bus name it chose. The bus
reports the connection's process (held by a pidfd where the broker gives one,
so a pid cannot be reused during the check) and security label. A process in
a Flatpak, a Luma application scope or domain, a snap or another filesystem
namespace is refused whatever it runs, and so is any process that hides its
/proc entries (non-dumpable): gnome-shell is dumpable, and neither a unit
name nor `org.gnome.Shell` (owned with replacement allowed) proves anything.
Otherwise its executable must be one of the programs
above, from a root-owned location; GNOME Shell and Phosh must also own their
bus names (`org.gnome.Shell`, `sm.puri.Phosh`), and `luma-shell-statectl` runs
isolated (`python3 -I`). A second bus name for the setters would add nothing:
a Flatpak allowed to talk to a name reaches every object of the connection
that owns it.

This is the boundary for sandboxed apps, which reach the bus through a
filtering proxy. It does not keep out the person's own unsandboxed programs:
they run as the same user, so they can run `luma-shell-statectl`, rewrite
their command line, send a call and then exec one of the programs above, or
write the same GSettings keys directly.

`luma-shell-statectl` is admitted by design for every host process: any
program the person runs outside a sandbox can run it and change any of these
settings. That is same-user trust, the same as `gsettings set`; it is not
available to sandboxed apps, which are refused before their program is
looked at.

Reading: the `Presentation`, `Posture`, `InputCapabilities` and `Weather`
(reading and condition, not the place's name) properties are open, with
`PropertiesChanged`. `GetSnapshot` gives the full snapshot to the callers
above and to everyone else only `schema_version`, `renderer`, `appearance`,
`presentation` and `posture`: no wallpaper path, favourite or Home apps,
Home layouts, idle delay or input method. The `Changed` signal, which carries
the full snapshot, is sent only to the owners of `org.gnome.Shell` and
`sm.puri.Phosh`.

Test harnesses that drive the state from a fixture name it in
`LUMA_SHELL_STATE_TRUSTED` (colon-separated absolute paths of an executable or
a Python script). Only a service run from a source tree reads it; the
installed service never does, and it never admits a sandbox.

## Posture (TV Mode)

`posture` (`automatic` or `tv`, default `automatic`) is the experience above
the presentation. It never changes the presentation: `presentation.effective`
stays desktop, tablet or mobile, so every existing reader is unaffected, and
the presentation choice underneath returns unchanged when TV is turned off.

The resolved posture is published three ways, all from the same rule
(`posture_state`):

- the snapshot's additive `posture` object: `selected`, `effective` (one of
  `desktop`, `tablet`, `mobile` or `tv`), `reason` (`user`, `device` or
  `presentation`) and `tv`;
- the `Posture` D-Bus property beside `Presentation`, with the same
  `PropertiesChanged` notification, which LumaUI's session context follows
  live;
- the `posture` key itself, for readers without the session bus.

Automatic resolves to TV when the device declares itself a television:
`tv` in `/run/luma/experience` or `/etc/luma-device-class` (the install-time
default). Its presentation underneath is Desktop.

Ways in and out: `luma-shell-statectl set posture tv|auto` (or
`luma-shell-statectl posture tv|automatic`), the `SetPosture` method, and the
TV choice in the shell's Experience options. The switch is live: the shell
and LumaUI follow the property change without a log-out.

`tv-idle-delay` (seconds, default `-1`) is the person's choice of when a TV
app shows its idle view (Settings › Idle & Sleep). `-1` leaves it to each app
(LumaUI `TvIdle`'s own delay), `0` never shows it; any other value overrides
every app's delay and is followed live.

`tv-screen-edges` (0–10, default 0) is the share of the screen given back at
each edge in TV posture, for a TV that overscans (Settings › Display › Fit ›
Screen edges). The shell's TV presentation scales its UI group, which holds
the TV home and every window, about the centre, live.

## HDMI-CEC

`luma-tv-cec` (`/usr/libexec`, started by `70-luma-tv-cec.rules` as
`luma-tv-cec@cecN.service` for every CEC adapter) puts the adapter on the CEC
bus as a playback device named Luma with remote-control passthrough, so the
kernel turns the TV remote's buttons into key events on its `rc-cec` input
device; the Shell maps them in TV posture
(docs/developer-platform/tv-mode.md, "Remotes and gamepads"). An adapter that
another CEC client already configured is left alone. `luma-tv-cec --status`
prints every adapter's physical and logical addresses.
