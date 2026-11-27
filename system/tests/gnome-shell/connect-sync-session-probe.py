#!/usr/bin/python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Suno Connect Sync in a running Suno session (GNOME Shell 0384).

    connect-sync-session-probe.py cell | cards | answer approve|deny | tile APP_ID | activate APP_ID

Run as the signed-in person, in the session, with the Shell in unsafe mode
(org.gnome.Shell.Eval). Compares what the Shell shows with what
org.projectSuno.ConnectSync1 reports; tests/gnome-shell/connect-sync-shell-two-vm.sh
drives two VMs through it.

- cell: the status cell is shown exactly when GetState has something to say
  (syncing, paused, attention), with the state's glyph; never when up to date.
- cards: the approval cards on screen are the requests ListJoinRequests lists
  (none timed out, none left after one is answered anywhere).
- answer: presses Not me or Approve on the card on screen (the button's own
  clicked signal, as a pointer press does).
- tile: an app still restoring has the restoring tile (55%, saturation 0.5,
  ring, "Restoring…"); a ready app has none.
- activate: opening a restoring app the way its tile does runs Valet
  (Suno-installer --restore APP) instead of the app; a ready app launches.
Prints one JSON line; exit status 0 when the check holds.
"""
import json
import sys

from gi.repository import Gio, GLib

bus = Gio.bus_get_sync(Gio.BusType.SESSION)


def sync(method, args=None, sig='(s)'):
    reply = bus.call_sync('org.projectSuno.ConnectSync1', '/org/projectSuno/ConnectSync1',
                          'org.projectSuno.ConnectSync1', method, args, GLib.VariantType(sig),
                          Gio.DBusCallFlags.NONE, 30000, None)
    return json.loads(reply.unpack()[0])


def evaluate(js):
    ok, out = bus.call_sync('org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval',
                            GLib.Variant('(s)', (js,)), GLib.VariantType('(bs)'),
                            Gio.DBusCallFlags.NONE, 10000, None).unpack()
    if not ok:
        raise SystemExit(f'Eval failed (unsafe mode?): {out}')
    value = json.loads(out) if out else None
    # A JS string comes back JSON-quoted: the JSON it holds.
    return json.loads(value) if isinstance(value, str) else value


def done(check, ok, **detail):
    print(json.dumps({'check': check, 'result': 'pass' if ok else 'fail', **detail}), flush=True)
    sys.exit(0 if ok else 1)


what = sys.argv[1]
if what == 'cell':
    state = sync('GetState')
    shown = evaluate('(() => { const c = Main.SunoConnectSync?._cell?.actor; '
                     'return JSON.stringify({visible: !!c?.visible, icon: c?.icon?.icon_name ?? null}); })()')
    want = state['state'] in ('syncing', 'paused', 'attention') and state.get('enabled', True)
    done('cell', shown['visible'] == want, state=state['state'], attention=(state.get('attention') or {}).get('reason'),
         shown=shown)
elif what == 'cards':
    listed = sorted(r['id'] for r in sync('ListJoinRequests') if not r.get('tampered'))
    shown = evaluate('JSON.stringify([...(Main.SunoConnectSync?._cards?.keys() ?? [])])')
    # One card at a time: the oldest request is on screen, the rest wait.
    ok = (not listed and not shown) or (len(shown) == 1 and shown[0] in listed)
    done('cards', ok, listed=listed, shown=shown)
elif what == 'answer':
    index = 1 if sys.argv[2] == 'approve' else 0
    label = evaluate('(() => { const c = [...Main.SunoConnectSync._cards.values()][0]; if (!c) return "null"; '
                     f'const b = c._buttons[{index}]; b.emit("clicked", 1); return JSON.stringify(b.label); }})()')
    done('answer', label == ('Approve' if index else 'Not me'), pressed=label)
elif what in ('tile', 'activate'):
    app = sys.argv[2]
    # The rows the Shell holds: GetRestore's, or the test's own (setRestoreRows).
    rows = {r['app']: r for r in (evaluate('JSON.stringify(Main.SunoConnectSync._restoreRows ?? [])') or [])}
    restoring = rows.get(app, {}).get('state') in ('installing', 'restoring', 'waiting')
    if what == 'tile':
        view = evaluate('(() => { const m = Main.SunoConnectSync; '
                        f'return JSON.stringify(m.restoreTile("{app}")); }})()')
        ok = bool(view) == restoring and (not view or (view['opacity'] == 140 and view['saturation'] == 0.5 and
                                                       view['caption'] == 'Restoring…'))
        done('tile', ok, state=rows.get(app, {}).get('state'), tile=view)
    how = evaluate(f'JSON.stringify(Main.SunoConnectSync.activateApp("{app}"))')
    GLib.usleep(3 * 1000000)
    valet = Gio.Subprocess.new(['pgrep', '-f', f'Suno-installer --restore {app}'],
                               Gio.SubprocessFlags.STDOUT_SILENCE).wait(None)
    done('activate', how == ('valet' if restoring else 'launched'), restoring=restoring, how=how)
else:
    raise SystemExit(__doc__)
