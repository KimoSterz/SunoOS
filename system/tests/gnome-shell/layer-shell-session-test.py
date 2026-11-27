#!/usr/bin/python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Layer permissions in a running Suno session (GNOME Shell 0380-0381, Mutter 0043-0046).

    layer-shell-session-test.py LAYER_TEST_CLIENT

Run as the signed-in person, in the session, with the Shell in unsafe mode
(org.gnome.Shell.Eval). Starts layer-shell test clients (tests/mutter/layer-shell
client.c) as three apps whose desktop files it writes, and checks:

- an offer is made once per app and capability (Clamped offer=true once);
- Not now is remembered: refused, and never offered again;
- Stop unmaps the app's overlays and keeps its grant;
- the status cell shows two apps stacked and "+N" past two, and leaves
  2 s after the last overlay goes;
- SetCapability round-trips through Apps and the permission store;
- an app whose overlays together pass 40% gets one name tag, on its
  largest surface.

The permission-store row for the test apps is removed before and after.
Exit status: the number of failed checks.
"""
import json
import os
import subprocess
import sys
import time

from gi.repository import Gio, GLib

CLIENT = sys.argv[1]
# Fresh IDs each run: Mutter reports a clamp once per app and session, and a
# stopped app stays stopped for the session.
RUN = f'{int(time.time()) % 1000000}'
APPS = [f'org.Suno.test.Session{x}{RUN}' for x in 'ABCD']
OVERLAY, KEYBOARD = 4, 8
bus = Gio.bus_get_sync(Gio.BusType.SESSION)
failures = 0


def check(name, ok, detail=''):
    global failures
    print(f"{'ok  ' if ok else 'FAIL'} {name}{'' if ok else f'  ({detail})'}", flush=True)
    failures += 0 if ok else 1


def call(dest, path, iface, method, args=None, sig=None):
    return bus.call_sync(dest, path, iface, method, args, GLib.VariantType(sig) if sig else None,
                         Gio.DBusCallFlags.NONE, 5000, None)


def shell(method, *args):
    return call('org.gnome.Shell', '/org/projectSuno/LayerShell', 'org.projectSuno.LayerShell1', method,
                GLib.Variant(f"({''.join('s' if isinstance(a, str) else 'b' if isinstance(a, bool) else 'u' for a in args)})", args))


def prop(name):
    return call('org.gnome.Shell', '/org/projectSuno/LayerShell', 'org.freedesktop.DBus.Properties', 'Get',
                GLib.Variant('(ss)', ('org.projectSuno.LayerShell1', name)), '(v)').unpack()[0]


def evaluate(js):
    ok, out = call('org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval',
                   GLib.Variant('(s)', (js,)), '(bs)').unpack()
    return json.loads(out) if ok and out else None


def store_row():
    try:
        table = call('org.freedesktop.impl.portal.PermissionStore', '/org/freedesktop/impl/portal/PermissionStore',
                     'org.freedesktop.impl.portal.PermissionStore', 'Lookup',
                     GLib.Variant('(ss)', ('Suno', 'display-over-apps')), '(a{sas}v)').unpack()[0]
    except GLib.Error:
        table = {}
    return table


def reset():
    table = store_row()
    for app in APPS:
        if app in table:
            call('org.freedesktop.impl.portal.PermissionStore', '/org/freedesktop/impl/portal/PermissionStore',
                 'org.freedesktop.impl.portal.PermissionStore', 'DeletePermission',
                 GLib.Variant('(sss)', ('Suno', 'display-over-apps', app)))


def spin(seconds, until=lambda: False):
    ctx = GLib.MainContext.default()
    end = time.monotonic() + seconds
    while time.monotonic() < end and not until():
        while ctx.iteration(False):
            pass
        time.sleep(0.05)
    return until()


clamps = []
bus.signal_subscribe('org.gnome.Shell', 'org.projectSuno.LayerShell1', 'Clamped', '/org/projectSuno/LayerShell',
                     None, Gio.DBusSignalFlags.NONE, lambda *a: clamps.append(a[5].unpack()))

apps_dir = os.path.expanduser('~/.local/share/applications')
os.makedirs(apps_dir, exist_ok=True)
for app in APPS:
    with open(f'{apps_dir}/{app}.desktop', 'w') as f:
        f.write(f'[Desktop Entry]\nType=Application\nName={app.rsplit(".", 1)[1]}\nExec=/bin/true\nIcon=application-x-executable\n')

procs = []


def start(app, *args):
    unit = f'app-gnome-{app}-{os.getpid()}{len(procs)}.scope'
    p = subprocess.Popen(['systemd-run', '--user', '--scope', '--quiet', f'--unit={unit}', CLIENT, *args],
                         stdout=subprocess.PIPE, text=True)
    procs.append(p)
    return p


def overlay_client(app, x):
    return start(app, '--layer', 'overlay', '--anchor', 'tl', '--margin', f'40,0,0,{x}',
                 '--size', '120x80', '--namespace', 'voice')


def stop_all():
    for p in procs:
        if p.poll() is None:
            p.terminate()
    for p in procs:
        try:
            p.wait(5)
        except subprocess.TimeoutExpired:
            p.kill()
    procs.clear()


def cell():
    return evaluate("""(() => { const c = Main.panel.statusArea.quickSettings._overlayCell;
        const kids = c ? c._stack.get_children() : [];
        return {visible: !!c?.visible, icons: kids.filter(a => !('text' in a)).length,
                more: kids.find(a => 'text' in a)?.text ?? '',
                tip: c?.accessible_name ?? ''}; })()""")


reset()
spin(1)
try:
    # Offered once.
    a = overlay_client(APPS[0], 40)
    spin(4, lambda: any(c[0] == APPS[0] for c in clamps))
    first = [c for c in clamps if c[0] == APPS[0] and c[1] == OVERLAY]
    check('a held overlay is offered', any(c[2] for c in first), clamps)
    rows = prop('Apps')
    check('the offer is recorded as asked', OVERLAY in rows.get(APPS[0], {}).get('asked', {}), rows.get(APPS[0]))
    stop_all()
    clamps.clear()
    overlay_client(APPS[0], 40)
    spin(4, lambda: any(c[0] == APPS[0] for c in clamps))
    # Mutter reports a clamp once per app and session; any report now must not offer.
    shown = evaluate(f"Main.messageTray.getSources().filter(s => s.title === '{APPS[0].rsplit('.', 1)[1]}').reduce((n, s) => n + s.notifications.length, 0)")
    check('offered once per app and capability', not any(c[2] for c in clamps if c[0] == APPS[0]) and shown == 1,
          f'{clamps} {shown}')
    stop_all()

    # Not now is remembered.
    clamps.clear()
    start(APPS[1], '--layer', 'top', '--anchor', 'tlr', '--size', '0x30', '--keyboard', 'exclusive', '--namespace', 'launcher')
    spin(4, lambda: any(c[0] == APPS[1] and c[1] == KEYBOARD for c in clamps))
    check('keyboard offered to a second app', any(c[0] == APPS[1] and c[1] == KEYBOARD and c[2] for c in clamps), clamps)
    shell('SetCapability', APPS[1], KEYBOARD, False)    # what Not now calls
    spin(1)
    stop_all()
    clamps.clear()
    start(APPS[1], '--layer', 'top', '--anchor', 'tlr', '--size', '0x30', '--keyboard', 'exclusive', '--namespace', 'launcher')
    spin(4, lambda: any(c[0] == APPS[1] for c in clamps))
    row = prop('Apps').get(APPS[1], {})
    check('Not now refuses', row.get('refused', 0) & KEYBOARD, row)
    check('Not now is never offered again', not any(c[2] for c in clamps if c[0] == APPS[1]), clamps)
    check('Not now is in the store', f'-keyboard' in store_row().get(APPS[1], []), store_row().get(APPS[1]))
    stop_all()

    # Settings' switch: SetCapability round-trips.
    shell('SetCapability', APPS[1], KEYBOARD, True)
    spin(1)
    check('a switch on reads back granted', prop('Apps')[APPS[1]]['granted'] & KEYBOARD)
    shell('SetCapability', APPS[1], KEYBOARD, False)
    spin(1)
    check('a switch off reads back refused', prop('Apps')[APPS[1]]['refused'] & KEYBOARD and
          not prop('Apps')[APPS[1]]['granted'] & KEYBOARD)

    # The cell: two stacked, then +N.
    for app in APPS:
        shell('SetCapability', app, OVERLAY, True)
    spin(1)
    overlay_client(APPS[0], 40)
    spin(2)
    overlay_client(APPS[1], 200)
    spin(3, lambda: len(prop('OverlayApps')) >= 2)
    c = cell()
    check('two apps: two icons stacked', c and c['visible'] and c['icons'] == 2 and not c['more'], c)
    check('two apps: tooltip', c and c['tip'] == '2 apps are displaying over other apps', c)
    overlay_client(APPS[2], 360)
    spin(3, lambda: len(prop('OverlayApps')) >= 3)
    c = cell()
    check('three apps: one icon and +2', c and c['icons'] == 1 and c['more'] == '+2', c)

    # Stop: unmapped for the session, grant kept.
    shell('Stop', APPS[2])
    spin(3, lambda: APPS[2] not in prop('OverlayApps'))
    check('Stop unmaps the overlay', APPS[2] not in prop('OverlayApps'), prop('OverlayApps'))
    check('Stop keeps the grant', prop('Apps')[APPS[2]]['granted'] & OVERLAY, prop('Apps').get(APPS[2]))
    check('Stop keeps the stored grant', 'overlay' in store_row().get(APPS[2], []), store_row().get(APPS[2]))
    c = cell()
    check('after Stop: two icons again', c and c['icons'] == 2 and not c['more'], c)

    # The grace.
    stop_all()
    spin(1)
    c = cell()
    check('the cell stays inside the 2 s grace', c and c['visible'], c)
    spin(2.5)
    c = cell()
    check('the cell leaves after the grace', c and not c['visible'], c)

    # One name tag per app: a small and a big overlay of one app fade
    # together and carry one tag, on the big one.
    shell('SetCapability', APPS[3], OVERLAY, True)
    spin(1)
    start(APPS[3], '--layer', 'overlay', '--anchor', 'tl', '--margin', '40,0,0,40', '--size', '200x150',
          '--namespace', 'voice')
    # Past the start-up guard, which refuses a big overlay at once.
    start(APPS[3], '--layer', 'top', '--set-layer-after-ms', 'overlay:3000', '--anchor', 'tl',
          '--margin', '100,0,0,300', '--size', '900x700', '--namespace', 'chat')
    spin(8, lambda: APPS[3] in prop('FadedApps'))
    tags = evaluate("""(() => Main.layoutManager.uiGroup.get_children()
        .filter(a => a.name === 'SunoLayerNameTag' && a.visible)
        .map(a => [Math.round(a.x), Math.round(a.y)]))()""")
    check('an app over 40% is faded', APPS[3] in prop('FadedApps'), prop('FadedApps'))
    check('one name tag for the app', tags is not None and len(tags) == 1, tags)
    check('the tag is on the largest surface', tags and abs(tags[0][0] - 300) <= 3, tags)
finally:
    stop_all()
    reset()
    for app in APPS:
        try:
            os.unlink(f'{apps_dir}/{app}.desktop')
        except OSError:
            pass

print(f'layer-shell-session-test: {failures} failed', flush=True)
sys.exit(failures)
