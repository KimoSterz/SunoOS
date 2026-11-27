#!/usr/bin/env python3
"""Runs this branch's Suno Connect daemon and app beside an installed Suno Connect.

For trying companion phones on a daily-driver Suno desktop without replacing the
installed package. Everything the trial owns is separate:

- a private HOME at ~/Suno-connect-companion-trial/home (identity, pairings, selections, and
  received files: user-dirs.dirs resolves Downloads as "$HOME/Downloads");
- the session bus name org.projectSuno.ConnectTrial1 and application ID
  org.projectSuno.ConnectTrial;
- no Suno account (the companion path needs none);
- for the messages role, the Messages selection and store (both under the trial HOME) and the
  application ID org.projectSuno.MessagesTrial.

It still uses the real session: notifications, media controls, Do Not Disturb, the
PipeWire camera and screen windows appear on this desktop. It never changes Bluetooth
audio roles (calls setup is disabled here) and never installs anything.

    python3 companion_trial.py daemon   # run as: systemd-run --user --unit=Suno-connect-companion-trial ...
    python3 companion_trial.py app
    python3 companion_trial.py messages # the installed Prairie Messages app, using the trial's phone

The messages role runs the installed Messages app with this branch's Suno Connect code, under
the application ID org.projectSuno.MessagesTrial so it opens beside the installed Messages. Its
selection (~/.config/Suno-connect/messages-phone.json) and message store are in the trial HOME;
the real Messages database and selection are not read or changed.
"""
import os
from pathlib import Path
import sys

TRIAL = Path(os.environ.get('SUNO_CONNECT_TRIAL_ROOT', Path.home() / 'Suno-connect-companion-trial'))
HOME = TRIAL / 'home'
BUS = 'org.projectSuno.ConnectTrial1'
APP_ID = 'org.projectSuno.ConnectTrial'
MESSAGES_APP_ID = 'org.projectSuno.MessagesTrial'


def prepare():
    HOME.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(HOME, 0o700)
    real_home = os.environ['HOME']
    os.environ['HOME'] = str(HOME)
    # Keep the real XDG_CONFIG_HOME: GSettings (dconf) and user directories such as Downloads
    # live there, and the trial must act on the real desktop settings. Suno Connect's own state
    # uses Path.home(), which is the private trial HOME.
    os.environ.setdefault('XDG_CONFIG_HOME', str(Path(real_home) / '.config'))
    # The Messages selection is found at Path.home()/.config, which is the trial HOME, not XDG_CONFIG_HOME.
    for name, relative in (('XDG_DATA_HOME', '.local/share'), ('XDG_STATE_HOME', '.local/state'), ('XDG_CACHE_HOME', '.cache')):
        os.environ[name] = str(HOME / relative)
    sys.path.insert(0, str(TRIAL / 'pylib'))
    sys.path.insert(0, str(TRIAL / 'src'))
    return real_home


def patch_daemon():
    from Suno_continuity import daemon
    daemon.XML = daemon.XML.replace(daemon.BUS, BUS)
    daemon.BUS = BUS
    daemon.load_config = lambda *args, **kwargs: None
    from Suno_continuity import companion_desktop

    class NoCallsRoles:
        """The trial never edits WirePlumber on a daily driver."""
        @classmethod
        def gio(cls, **_):
            raise RuntimeError('calls setup is disabled in the trial')

    from Suno_continuity import companion_calls
    companion_calls.WirePlumberRoles = NoCallsRoles
    del companion_desktop
    return daemon


def main(role):
    prepare()
    daemon = patch_daemon()
    if role == 'daemon':
        return daemon.main()
    if role == 'app':
        from Suno_continuity import application
        application.BUS = BUS
        application.APP_ID = APP_ID
        sys.argv = sys.argv[:1]  # GApplication would treat the role argument as a file to open
        return application.main()
    if role == 'messages':
        from prairie_apps import messages
        messages.APPLICATION_ID = MESSAGES_APP_ID
        sys.argv = sys.argv[:1]
        return messages.main()
    raise SystemExit('usage: companion_trial.py daemon|app|messages')


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else ''))
