# SPDX-License-Identifier: Apache-2.0
"""Native launcher delegation to OS-owned independent application baselines.

The role file is shipped in a signed OS deployment only when its installer
seeds the signed offline baseline. libflatpak supplies the actual installed
identity and trust. No catalogue or home-directory file can assign ownership.
"""
import json
import os
import re
from pathlib import Path
import stat
import sys

# Maintained whitelist, generated from the reviewed first-party registry.
# The OS contract may only assign roles; downloaded catalogues cannot extend it.
APPS = frozenset({'org.projectSuno.Depot', 'org.projectSuno.Reel', 'org.projectSuno.Charlie', 'org.projectSuno.Stage', 'org.projectSuno.Session', 'org.projectSuno.Tide', 'org.projectSuno.Mods', 'org.projectSuno.VoiceMemos', 'org.projectSuno.Darkroom', 'org.projectSuno.Calendar', 'org.projectSuno.Contacts', 'org.projectSuno.Messages', 'org.projectSuno.Photos', 'org.projectSuno.Phone', 'org.projectSuno.Clock', 'org.projectSuno.Notes', 'org.projectSuno.Leaf', 'org.projectSuno.Imager', 'org.projectSuno.Camera', 'org.projectSuno.Grid', 'org.gnome.Nautilus', 'org.projectSuno.Connect', 'io.Suno.Monitor', 'org.projectSuno.Tasks', 'org.projectSuno.Viewer', 'com.rhyme.viola', 'org.projectSuno.Write', 'org.projectSuno.Weather', 'org.projectSuno.Displays', 'org.projectSuno.Ari'})
CONTRACT = Path('/usr/share/Suno/first-party-app-roles.json')
# This is the public application signing key already shipped in the maintained
# Suno.flatpakrepo. Key rotation changes the signed host contract/package; a
# same-named user remote cannot substitute its own key and gain host services.
SIGNING_FINGERPRINTS = frozenset({'069E001599679B49042FE40885FCC398C02A8BEE'})


def required(app_id, path=CONTRACT):
    if app_id not in APPS: raise ValueError('unmaintained application role')
    try:
        info = path.lstat()
    except FileNotFoundError: return False  # developer/older non-baseline image
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise ValueError('application role contract has an unsafe owner or type')
    if info.st_size > 65536: raise ValueError('application role contract is too large')
    doc=json.loads(path.read_text())
    if doc.get('schema') != 'org.projectSuno.first-party-app-roles/v1':
        raise ValueError('unsupported application role contract')
    roles=doc.get('roles',{})
    if any(name not in APPS or role != 'signed-system-flatpak' for name,role in roles.items()):
        raise ValueError('invalid maintained application role')
    return roles.get(app_id) == 'signed-system-flatpak'


class RoleProblem(ValueError):
    """A signed installation that is really missing or invalid, by kind.

    ``code`` names the problem for the journal and the repair window; anything
    else that goes wrong while checking (an update deploying, a busy disk) is
    not a RoleProblem and is tried again before anyone is told.
    """

    def __init__(self, code, detail):
        super().__init__(detail)
        self.code = code


def installed(installation, app_id, cancellable=None):
    if app_id not in APPS:
        raise ValueError('unmaintained application role')
    from .depot_flatpak import validate_remote, BRANCHES, SourceUnavailable
    import gi
    gi.require_version('Flatpak', '1.0')
    from gi.repository import Flatpak, GLib
    try:
        remote = installation.get_remote_by_name('Suno', cancellable)
    except GLib.Error as error:
        if error.matches(Flatpak.error_quark(), Flatpak.Error.REMOTE_NOT_FOUND):
            raise RoleProblem('source-missing', 'the Suno remote is not configured') from error
        raise
    try:
        validate_remote(remote, 'Suno')
    except SourceUnavailable as error:
        raise RoleProblem('source-invalid', f'the Suno remote fails its checks: {error}') from error
    refs=[ref for ref in installation.list_installed_refs(cancellable)
          if ref.get_name()==app_id and ref.format_ref().startswith('app/')]
    if not refs:
        raise RoleProblem('not-installed', f'{app_id} is not installed system-wide')
    if len(refs) > 1:
        # A channel switch can leave two branches installed; the current one
        # is what `flatpak run` starts, so it is the one that owns the role.
        try:
            current = installation.get_current_installed_app(app_id, cancellable).format_ref()
        except GLib.Error as error:
            raise RoleProblem('several', f'{len(refs)} branches of {app_id} are installed and none is current') from error
        refs = [ref for ref in refs if ref.format_ref() == current]
        if len(refs) != 1:
            raise RoleProblem('several', f'the current branch of {app_id} is not among its installed refs')
    ref = refs[0]
    if ref.get_origin() != 'Suno' or ref.get_branch() not in BRANCHES:
        raise RoleProblem('other-source', f'{ref.format_ref()} comes from {ref.get_origin()!r}, not Suno')
    if not re.fullmatch(r'[0-9a-f]{64}', ref.get_commit() or ''):
        raise RoleProblem('unsigned', f'{ref.format_ref()} has no commit')
    verify_deployed_commit(installation, ref, cancellable)
    return ref


def verify_deployed_commit(installation, ref, cancellable=None, *, commit=None, exact_ref=None):
    import gi
    gi.require_version('OSTree', '1.0')
    from gi.repository import OSTree, GLib
    repository = OSTree.Repo.new(installation.get_path().get_child('repo'))
    repository.open(cancellable)
    ok, signatures = repository.remote_get_gpg_verify('Suno')
    summary_ok, summary = repository.remote_get_gpg_verify_summary('Suno')
    if not ok or not signatures or not summary_ok or not summary:
        raise RoleProblem('source-invalid', 'application source signature checks are disabled')
    commit = commit or ref.get_commit()
    if not re.fullmatch(r'[0-9a-f]{64}', commit):
        raise ValueError('application commit is malformed')
    result = repository.verify_commit_ext(commit, None, None, cancellable)
    for index in range(result.count_all()):
        signature = result.get_all(index).unpack()
        if (signature[OSTree.GpgSignatureAttr.VALID]
                and not any(signature[item] for item in (
                    OSTree.GpgSignatureAttr.SIG_EXPIRED, OSTree.GpgSignatureAttr.KEY_EXPIRED,
                    OSTree.GpgSignatureAttr.KEY_REVOKED, OSTree.GpgSignatureAttr.KEY_MISSING))
                and signature[OSTree.GpgSignatureAttr.FINGERPRINT_PRIMARY] in SIGNING_FINGERPRINTS):
            if exact_ref is not None:
                # A retained running deployment is no longer the installed
                # head. Its signed binding must still identify this exact app,
                # architecture and branch, rather than another signed payload.
                ok, value, _state = repository.load_commit(commit)
                if not ok:
                    raise ValueError('retained application commit is unavailable')
                bindings = value.get_child_value(0).lookup_value(
                    'ostree.ref-binding', GLib.VariantType.new('as'))
                if bindings is None or exact_ref not in bindings.unpack():
                    raise ValueError('retained commit has a different application binding')
            return
    raise RoleProblem('unsigned', f'commit {commit} has no valid maintained Suno signature')


def launch_if_owned(app_id):
    if Path('/.flatpak-info').exists(): return False
    try:
        if not required(app_id): return False
        ref = _resolve_installed(app_id)
    except Exception as error:
        # Never open an empty native profile when the baseline needs repair.
        problem = describe(error)
        print(f'{app_id}: {problem[1]}', file=sys.stderr)
        show_repair(app_id, problem[0])
        raise SystemExit(1) from error
    os.execv('/usr/bin/flatpak',['flatpak','run','--system',ref.format_ref(),*sys.argv[1:]])


#: Waits between tries when a check fails for a reason that is not a
#: RoleProblem: an update deploying, the repository being pruned, a slow disk.
RETRY_SECONDS = (0.5, 1.5, 3.0)


def _resolve_installed(app_id, sleep=None):
    import time
    import gi
    gi.require_version('Flatpak', '1.0')
    from gi.repository import Flatpak
    for wait in (*RETRY_SECONDS, None):
        try:
            return installed(Flatpak.Installation.new_system(None), app_id)
        except RoleProblem:
            raise
        except Exception:
            if wait is None:
                raise
            (sleep or time.sleep)(wait)


#: What a person reads, and the Depot view that repairs it.
REPAIRS = {
    'source-missing': ("Suno’s app source is missing from this computer, so {name} can’t be checked.",
                       'Restore the source', None),
    'source-invalid': ("Suno’s app source on this computer was changed or turned off, so {name} can’t be checked.",
                       'Open Depot', 'settings'),
    'not-installed': ('{name} is not installed.', 'Install in Depot', 'app'),
    'several': ('More than one copy of {name} is installed.', 'Open in Depot', 'app'),
    'other-source': ('{name} was installed from somewhere other than Suno.', 'Reinstall in Depot', 'app'),
    'unsigned': ('This copy of {name} is not signed by Suno. Updating it replaces it with a signed one.',
                 'Update in Depot', 'updates'),
    'unknown': ('{name} could not be checked. The details are in Suno Vitals.', 'Open Depot', 'app'),
}
NAMES = {'com.rhyme.viola': 'Viola', 'org.gnome.Nautilus': 'Filer'}


def describe(error):
    """(code, journal text) for a failed check."""
    if isinstance(error, RoleProblem):
        return error.code, str(error)
    return 'unknown', f'{type(error).__name__}: {error}'


def show_repair(app_id, code):
    """The repair window: what is wrong, and the one action that fixes it."""
    sentence, label, view = REPAIRS.get(code, REPAIRS['unknown'])
    name = NAMES.get(app_id, 'This application')
    def repair(app):
        if view is None:
            from .depot_flatpak import ensure_Suno_remote
            try:
                ensure_Suno_remote()
            except Exception as error:
                print(f'{app_id}: the Suno source could not be restored: {error}', file=sys.stderr)
        else:
            target = f'app:{app_id}' if view == 'app' else view
            import subprocess
            subprocess.Popen(['/usr/bin/flatpak', 'run', '--system', 'org.projectSuno.Depot', '--view', target],
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             start_new_session=True)
        app.quit()
    import gi
    gi.require_version('Gtk', '4.0'); gi.require_version('Adw', '1')
    from Suno_appkit import AppWindow, CommandRegistry, EmptyState, install_appkit
    from Suno_appkit.migration_startup import repair_application
    application = repair_application()
    def activate(app):
        install_appkit()
        window = AppWindow(application=app, app_id=app.get_application_id(),
            title=f'{name} needs repair', icon_name='dialog-warning-symbolic',
            commands=CommandRegistry(()), minimum_width=360, default_width=560, default_height=380)
        window.set_body(EmptyState(f'{name} needs repair', sentence.format(name=name),
            'dialog-warning-symbolic', primary=(label, lambda *_: repair(app)),
            secondary=('Close', lambda *_: app.quit())))
        window.present()
    application.connect('activate', activate)
    application.run([])


def resolve_owned(app_id):
    """Resolve native C launch delegation without accepting a command or path."""
    if app_id not in APPS:
        raise ValueError('unmaintained application role')
    if Path('/.flatpak-info').exists():
        raise ValueError('native ownership resolution is unavailable inside a sandbox')
    if not required(app_id):
        return None
    ref = _resolve_installed(app_id)
    # installed() verifies origin, commit signatures and remote checks. Keep
    # stdout an exact bounded ref, never caller-selected shell or path syntax.
    arch, branch = ref.get_arch(), ref.get_branch()
    from .depot_flatpak import BRANCHES
    if arch not in {'x86_64', 'aarch64'} or branch not in BRANCHES:
        raise ValueError('unsupported application architecture or branch')
    expected = f'app/{app_id}/{arch}/{branch}'
    if ref.get_name() != app_id or ref.format_ref() != expected:
        raise ValueError('the installed application has a different role identity')
    return expected


#: The launcher a person started, as the journal knows it.
LAUNCHERS = {'com.rhyme.viola': 'viola-browser', 'org.gnome.Nautilus': 'nautilus'}


def _journal(app_id, message, code):
    """Say why in the journal, under the launcher's name, before any window."""
    try:
        from systemd import journal
        journal.send(message, SYSLOG_IDENTIFIER=LAUNCHERS.get(app_id, 'Suno-native-app-roles'),
                     PRIORITY='3', SUNO_APP_ID=app_id, SUNO_ROLE_PROBLEM=code)
    except Exception:  # noqa: BLE001 - no python3-systemd or journal socket: stderr has it
        pass


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if len(args) == 3 and args[0] == '--repair-window' and args[1] in APPS:
        show_repair(args[1], args[2])
        return 0
    if len(args) != 2 or args[0] != '--resolve' or args[1] not in APPS:
        print('Unsupported native application ownership request.', file=sys.stderr)
        return 1
    try:
        reference = resolve_owned(args[1])
    except Exception as error:
        # One line: the problem's code, a tab, and what exactly failed. The
        # launcher logs it and opens the repair window for that code.
        code, detail = describe(error)
        line = f'{code}\t{detail}'.replace('\n', ' ')
        print(line, file=sys.stderr)
        _journal(args[1], f'signed application check failed: {line.replace(chr(9), ": ")}', code)
        return 1
    if reference is None:
        return 0
    print(reference)
    return 10


if __name__ == '__main__':
    raise SystemExit(main())
