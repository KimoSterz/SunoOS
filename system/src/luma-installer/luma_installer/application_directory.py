# SPDX-License-Identifier: Apache-2.0
"""Installed desktop application discovery for signed sandbox callers.

Only desktop identities are accepted. Executables, argv, desktop file paths
and environment are never supplied by the caller. File launch authority is a
document portal grant, not a path into another application's private data.

Launch has the portal's open semantics, so a sandbox cannot start any host
application with documents or addresses it picked (``launch_decision``):

* a web address opens directly in the person's default for it, as
  xdg-desktop-portal's OpenURI does (src/open-uri.c should_use_default_app),
  and a file in the person's default for its type or the only application
  that can open it (n_choices == 1): common documents never ask "which app?";
* a signed Luma app (another sandbox, decided by its signed system
  deployment) may be opened directly, with documents the caller shared through
  the document portal, or with none, whatever their type (an unknown type
  included): it is a first-party sandbox, not a host program. Programs are
  still refused and installers still go to the person;
* the app that opens documents is granted read access to each of them in the
  document portal first (the caller's grant names the caller only); if that
  fails nothing is launched;
* a program (by bytes or by name, Wine and Java types included) is never
  handed over, nor any document to a handler whose Exec is an interpreter or
  Wine; installers, Android packages, torrents, Office documents with macros
  and non-text executable types always go to the person;
* only entries the system installed decide alone: one in the person's own
  applications folder (browsers' web apps, game launchers) goes to the person;
* a sibling is started with `flatpak run --system`, so a user installation of
  the same ID never receives the documents;
* one of Luma's own system apps may be opened with nothing to open;
* anything else opens only once the person chooses it in the Open With
  dialog of Luma's portal (the AppChooser backend, verified as the root-owned
  program in its own unit), and only an app that can open it;
* Filer, which lists the installed apps as a folder, may start any shown app
  with nothing to open, as the app grid does.

Every caller is a signed, verified Luma Flatpak (``app_data_broker.authenticate``);
the host's own programs open applications through GIO and never come here.
"""
import os
import secrets
import sys
from pathlib import Path
import re
import time
from urllib.parse import urlsplit, unquote

from gi.repository import Gio, GLib

BUS = 'org.projectluma.ApplicationDirectory1'
OBJECT = '/org/projectluma/ApplicationDirectory1'
ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,250}\.desktop\Z')
MIME = re.compile(r'[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+\Z')
XML = '''<node><interface name="org.projectluma.ApplicationDirectory1">
<method name="List"><arg type="s" direction="in" name="mime"/>
<arg type="a(sssbbb)" direction="out" name="applications"/></method>
<method name="Launch"><arg type="s" direction="in" name="desktop_id"/>
<arg type="as" direction="in" name="uris"/><arg type="b" direction="out" name="accepted"/></method>
<signal name="Changed"/>
</interface></node>'''


def validate_mime(value):
    if not isinstance(value, str) or len(value) > 127 or (value and not MIME.fullmatch(value)):
        raise ValueError('Invalid application content type.')
    return value


def validate_id(value):
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValueError('Invalid installed application identity.')
    return value


def validate_uris(values, uid=None, *, check_files=True):
    if not isinstance(values, (list, tuple)) or len(values) > 256:
        raise ValueError('Too many application documents.')
    uid = os.getuid() if uid is None else uid
    total = 0
    for uri in values:
        if not isinstance(uri, str) or not uri or len(uri) > 4096 or any(ord(c) < 32 for c in uri):
            raise ValueError('Invalid application document.')
        total += len(uri)
        if total > 1048576:
            raise ValueError('Application documents exceed the request limit.')
        parts = urlsplit(uri)
        if parts.scheme in {'http', 'https'}:
            if not parts.hostname or parts.username or parts.password:
                raise ValueError('Invalid web address.')
            continue
        if parts.scheme != 'file' or parts.netloc or parts.query or parts.fragment:
            raise ValueError('Only web addresses and document portal files can be opened.')
        path = Path(unquote(parts.path))
        base = Path(f'/run/user/{uid}/doc')
        if not path.is_absolute() or '..' in path.parts or not path.is_relative_to(base):
            raise ValueError('The file has no document portal grant.')
        relative = path.relative_to(base)
        if len(relative.parts) != 2 or not re.fullmatch('[A-Za-z0-9_-]{1,64}', relative.parts[0]):
            raise ValueError('Invalid document portal identity.')
        if check_files and not path.is_file():
            raise ValueError('The shared document is unavailable.')
    return list(values)


def application_rows(mime):
    validate_mime(mime)
    default = Gio.AppInfo.get_default_for_type(mime, False) if mime else None
    default_id = default.get_id() if default else None
    apps = Gio.AppInfo.get_all_for_type(mime) if mime else Gio.AppInfo.get_all()
    result, seen, size = [], set(), 0
    for app in apps:
        identity = app.get_id()
        if not identity or not ID.fullmatch(identity) or identity in seen or not app.should_show():
            continue
        if mime and not (app.supports_files() or app.supports_uris()):
            continue
        name = app.get_display_name() or identity.removesuffix('.desktop')
        # Native icon file paths are not exported into the sandbox. Theme
        # names resolve to the sandbox's shipped/shared icon theme.
        icon = app.get_icon()
        names = icon.get_names() if isinstance(icon, Gio.ThemedIcon) else []
        icon_name = next((n for n in names if re.fullmatch('[A-Za-z0-9_.-]{1,255}', n)), '')
        name = name[:512]
        size += len(identity.encode()) + len(name.encode()) + len(icon_name.encode()) + 32
        if len(result) >= 4096 or size > 1048576:
            raise ValueError('Installed application catalogue exceeds the supported limit.')
        seen.add(identity)
        result.append((identity, name, icon_name, identity == default_id,
                       bool(app.supports_files()), bool(app.supports_uris())))
    return sorted(result, key=lambda r: (not r[3], r[1].casefold(), r[0]))


#: Callers that list the installed apps as a folder (Filer's Applications).
LAUNCHERS = frozenset({'org.gnome.Nautilus'})
PORTAL = 'org.freedesktop.impl.portal.desktop.luma'
PORTAL_PATH = '/org/freedesktop/portal/desktop'
PORTAL_BACKEND = '/usr/libexec/luma-portal-appchooser'
PORTAL_UNIT = 'luma-portal-appchooser.service'
#: How long the person may take to choose (the Open With dialog is open).
CHOICE_TIMEOUT_MS = 10 * 60 * 1000
#: Schemes whose default application opens without asking: xdg-desktop-portal's
#: own rule (src/open-uri.c, should_use_default_app: http, https, ftp, mailto,
#: webcal, calendar). Every file goes through the chooser there unless only one
#: application can open it (n_choices == 1); Luma's own apps are the one
#: addition here, since they are sandboxes too.
WEB_SCHEMES = frozenset({'http', 'https'})
#: Programs that would run on the host: never handed to another app.
PROGRAM_TYPES = (
    'application/x-executable', 'application/x-pie-executable', 'application/x-sharedlib',
    'application/x-desktop', 'application/vnd.appimage', 'application/x-iso9660-appimage',
    'application/x-shellscript', 'application/x-csh', 'text/x-python', 'text/x-python3',
    'application/x-perl', 'application/x-ruby', 'application/x-ms-dos-executable',
    'application/x-msdownload', 'application/vnd.microsoft.portable-executable', 'application/x-msi',
    'application/x-ms-shortcut', 'application/x-bat', 'application/x-java-archive',
    'application/x-java-jnlp-file', 'application/x-java', 'application/x-ms-ne-executable',
    'text/x-ms-regedit')
#: Every Wine-registered type (application/x-wine-extension-*) is a program too.
PROGRAM_PREFIXES = ('application/x-wine-extension-',)
#: A handler that runs its document as code: never given one by an app.
INTERPRETERS = re.compile(r'(wine(64)?(-preloader)?|java|mono|dotnet|python[0-9.]*|(ba|da|z|c|tc|k)?sh|perl[0-9.]*'
                          r'|ruby[0-9.]*|node(js)?|gjs(-console)?)')
#: Installers and anything GIO says can be executable: only the person decides.
INSTALLER_TYPES = (
    'application/vnd.flatpak.ref', 'application/vnd.flatpak.repo', 'application/vnd.flatpak',
    'application/x-rpm', 'application/x-redhat-package-manager', 'application/vnd.debian.binary-package',
    'application/x-deb', 'application/vnd.snap', 'application/vnd.android.package-archive',
    'application/vnd.projectluma.android-package-set', 'application/x-bittorrent',
    # Office documents that carry macros.
    'application/vnd.ms-word.document.macroEnabled.12', 'application/vnd.ms-word.template.macroEnabled.12',
    'application/vnd.ms-excel.sheet.macroEnabled.12', 'application/vnd.ms-excel.template.macroEnabled.12',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12', 'application/vnd.ms-excel.addin.macroEnabled.12',
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
    'application/vnd.ms-powerpoint.template.macroEnabled.12')


def _is_any(content_type, types):
    lowered = content_type.lower()
    return any(lowered == kind.lower() or Gio.content_type_is_a(content_type, kind) for kind in types)


def is_program(content_type):
    # An Android package is a Java archive to shared-mime-info; it is listed
    # to ask, which wins over the program types it descends from.
    if not content_type or _is_any(content_type, INSTALLER_TYPES):
        return False
    return _is_any(content_type, PROGRAM_TYPES) or content_type.lower().startswith(PROGRAM_PREFIXES)


def runs_documents(app):
    """The entry's program is an interpreter or Wine, which would run a document as code."""
    try:
        argv = GLib.shell_parse_argv(app.get_string('Exec') or app.get_commandline() or '')[1]
    except (GLib.Error, TypeError):
        return True
    while argv and (os.path.basename(argv[0]) == 'env' or ('=' in argv[0] and not argv[0].startswith('/'))):
        argv = argv[1:]
        while argv and argv[0].startswith('-'):
            argv = argv[1:]
    return not argv or bool(INTERPRETERS.fullmatch(os.path.basename(argv[0])))


def needs_person(content_type):
    """Installing or executable content: never opened without the person.

    GIO calls every text/plain subtype executable; text that is run (scripts,
    .desktop) is in PROGRAM_TYPES and refused, so ordinary text, Markdown,
    CSV, logs and source code open like any other document."""
    if not content_type or _is_any(content_type, INSTALLER_TYPES):
        return True
    return (Gio.content_type_can_be_executable(content_type)
            and not Gio.content_type_is_a(content_type, 'text/plain'))


def content_types(uri):
    """What the document is, by its bytes and by its name (the caller chose
    both), or the scheme handler for an address. '' when it can't be read."""
    parts = urlsplit(uri)
    if parts.scheme in WEB_SCHEMES:
        return ('x-scheme-handler/' + parts.scheme,)
    name = os.path.basename(unquote(parts.path))
    guessed = Gio.content_type_guess(name, None)[0] or ''
    try:
        info = Gio.File.new_for_uri(uri).query_info('standard::content-type', Gio.FileQueryInfoFlags.NONE, None)
        sniffed = info.get_content_type() or ''
    except GLib.Error:
        sniffed = ''
    return (sniffed, guessed)


def _root_owned(path):
    try:
        info = os.lstat(path)
    except OSError:
        return False
    import stat
    return stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022


def sibling_info(identity, *, resolve=None):
    """A signed Luma app's desktop entry, from its signed system deployment.

    Decided as authenticate decides a caller: native_app_roles.installed (the
    luma remote, a signed deployed commit) in the system installation; the
    entry is read from that deployment's own export, never through the
    search path, where a same-ID user installation would shadow it."""
    from .native_app_roles import APPS
    app_id = identity.removesuffix('.desktop')
    if app_id not in APPS:
        return None
    try:
        path = (resolve or _deployed_entry)(app_id)
    except Exception:  # noqa: BLE001 -- not installed, unsigned, another source: not a sibling
        return None
    if not path or not _root_owned(path):
        return None
    return system_flatpak_entry(path, app_id)


def system_flatpak_entry(path, app_id):
    """The deployment's entry, started from the system installation.

    The export runs `flatpak run`, which prefers a user installation of the
    same ID; with --system the documents reach the signed system copy only."""
    keyfile = GLib.KeyFile()
    try:
        keyfile.load_from_file(path, GLib.KeyFileFlags.KEEP_TRANSLATIONS)
        if keyfile.get_string('Desktop Entry', 'X-Flatpak') != app_id:
            return None
        argv = GLib.shell_parse_argv(keyfile.get_string('Desktop Entry', 'Exec'))[1]
    except GLib.Error:
        return None
    if len(argv) < 3 or os.path.basename(argv[0]) != 'flatpak' or argv[1] != 'run' or app_id not in argv:
        return None
    exec_line = keyfile.get_string('Desktop Entry', 'Exec')
    keyfile.set_string('Desktop Entry', 'Exec', exec_line.replace(' run ', ' run --system ', 1))
    try:
        # Activation by bus name would reach whichever installation runs.
        keyfile.remove_key('Desktop Entry', 'DBusActivatable')
    except GLib.Error:
        pass
    return Gio.DesktopAppInfo.new_from_keyfile(keyfile)


def _deployed_entry(app_id):
    import gi
    gi.require_version('Flatpak', '1.0')
    from gi.repository import Flatpak
    from .native_app_roles import installed
    ref = installed(Flatpak.Installation.new_system(None), app_id)
    return os.path.join(ref.get_deploy_dir(), 'export/share/applications', app_id + '.desktop')


def system_info(identity, owned=_root_owned):
    """One of Luma's own apps installed with the system (root-owned, /usr)."""
    if not identity.startswith('org.projectluma.'):
        return None
    path = os.path.join('/usr/share/applications', identity)
    return Gio.DesktopAppInfo.new_from_filename(path) if owned(path) else None


def launch_decision(caller, identity, uris, *, sibling, system_app, kinds, web_default, sole_handler,
                    file_default=False):
    """'launch' or 'ask' for a sandboxed caller's Launch; ValueError to refuse.

    ``kinds`` holds each document's content types (content_types); a web
    address's default and a file's only handler come from the person's GIO
    configuration."""
    if any(is_program(kind) for group in kinds for kind in group):
        raise ValueError('Apps cannot hand a program to another app.')
    if not uris:
        if sibling or system_app or caller in LAUNCHERS:
            return 'launch'
        raise ValueError('Apps can open only Luma apps this way.')
    if any(needs_person(kind) for group in kinds for kind in group if not kind.startswith('x-scheme-handler/')):
        return 'ask'
    # Policy: a signed sibling (a first-party sandbox) opens any other document
    # directly, an unknown type included; programs were refused and installers
    # sent to the person above.
    if sibling:
        return 'launch'
    if all(urlsplit(uri).scheme in WEB_SCHEMES for uri in uris) and web_default:
        return 'launch'
    # Common documents never ask "which app?": the person's default opens them
    # (xdg-desktop-portal asks unless one app can; Luma keeps the default).
    if all(urlsplit(uri).scheme == 'file' for uri in uris) and (sole_handler or file_default):
        return 'launch'
    return 'ask'


def _handlers(content_type):
    try:
        return [app.get_id() for app in Gio.AppInfo.get_all_for_type(content_type) if app.get_id()]
    except (TypeError, GLib.Error):
        return []


def system_entry(app):
    """An entry the system installed (root-owned, outside the person's own
    folders): /usr/share/applications or a system Flatpak export. Entries in
    ~/.local/share/applications are written by browsers' "install as app" and
    game launchers, and by any app allowed there, so they never decide alone,
    except the launcher the installer wrote for an installed store app, which
    is checked against its record and regenerated text."""
    filename = app.get_filename() if app is not None else None
    if not filename:
        return False
    homes = [os.path.realpath(GLib.get_user_data_dir()), os.path.realpath(GLib.get_home_dir())]
    real = os.path.realpath(filename)
    if any(real == home or real.startswith(home + os.sep) or filename.startswith(home + os.sep) for home in homes):
        # The one exception: the launcher the installer wrote for an
        # installed store application, unchanged (desktop.is_own_launcher).
        from .desktop import is_own_launcher
        return not os.path.islink(filename) and is_own_launcher(filename)
    return _root_owned(real)


def _web_default(identity, uris):
    for uri in uris:
        app = Gio.AppInfo.get_default_for_uri_scheme(urlsplit(uri).scheme)
        if app is None or app.get_id() != identity or not system_entry(app):
            return False
    return bool(uris)


def _file_default(identity, kinds):
    for group in kinds:
        app = Gio.AppInfo.get_default_for_type(group[0] or group[-1], False) if (group[0] or group[-1]) else None
        if app is None or app.get_id() != identity or not system_entry(app):
            return False
    return bool(kinds)


def _sole_handler(identity, kinds):
    for group in kinds:
        apps = Gio.AppInfo.get_all_for_type(group[0] or group[-1]) if (group[0] or group[-1]) else []
        if [app.get_id() for app in apps] != [identity] or not system_entry(apps[0]):
            return False
    return bool(kinds)


def _bus(connection, method, value, signature):
    return connection.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', method,
        value, GLib.VariantType.new(signature), Gio.DBusCallFlags.NONE, 5000, None).unpack()


def _start_time(pid, proc):
    return (proc / str(pid) / 'stat').read_text().rsplit(')', 1)[1].split()[19]


def _pidfd_pid(fd):
    try:
        for line in Path(f'/proc/self/fdinfo/{fd}').read_text().splitlines():
            if line.startswith('Pid:'):
                return max(int(line.split()[1]), 0)
    except (OSError, ValueError, IndexError):
        pass
    return 0


def _credentials(connection, owner):
    """(pid, pidfd): pidfd -1 only when the bus offers no ProcessFD; one it
    names but doesn't deliver is refused."""
    result, fds = connection.call_with_unix_fd_list_sync('org.freedesktop.DBus', '/org/freedesktop/DBus',
        'org.freedesktop.DBus', 'GetConnectionCredentials', GLib.Variant('(s)', (owner,)),
        GLib.VariantType.new('(a{sv})'), Gio.DBusCallFlags.NONE, 5000, None, None)
    values = result.unpack()[0]
    pid, pidfd = values.get('ProcessID'), -1
    if 'ProcessFD' in values:
        index = values['ProcessFD']
        try:
            if (isinstance(index, bool) or not isinstance(index, int) or fds is None
                    or not 0 <= index < fds.get_length()):
                raise ValueError('Open With is not available.')
            pidfd = fds.get(index)
        except GLib.Error as error:
            raise ValueError('Open With is not available.') from error
        if not isinstance(pidfd, int) or pidfd < 0:
            raise ValueError('Open With is not available.')
    if not isinstance(pid, int) or pid <= 0:
        if pidfd >= 0:
            os.close(pidfd)
        raise ValueError('Open With is not available.')
    return pid, pidfd


def trusted_backend(connection, proc=Path('/proc')):
    """The unique name of Luma's AppChooser backend, once its owner is shown to
    be the root-owned backend program started as its own unit (the caller
    rules of luma-shell-state: process, not bus name)."""
    try:
        _bus(connection, 'StartServiceByName', GLib.Variant('(su)', (PORTAL, 0)), '(u)')
    except GLib.Error:
        pass
    owner = _bus(connection, 'GetNameOwner', GLib.Variant('(s)', (PORTAL,)), '(s)')[0]
    pid, pidfd = _credentials(connection, owner)
    try:
        return _trusted_backend(owner, pid, pidfd, proc)
    finally:
        if pidfd >= 0:
            os.close(pidfd)


def _trusted_backend(owner, pid, pidfd, proc):
    base = proc / str(pid)
    # Held by its pidfd, or on a bus that offers none, its start time.
    before = _start_time(pid, proc) if pidfd < 0 else None
    interpreter = os.path.realpath('/usr/bin/python3')
    executable, trusted = os.stat(base / 'exe'), os.stat(interpreter)
    argv = (base / 'cmdline').read_bytes().split(b'\0')
    unit = (base / 'cgroup').read_text().strip().splitlines()[-1].rstrip('/').rsplit('/', 1)[-1]
    if not (_root_owned(interpreter) and _root_owned(PORTAL_BACKEND)
            and (executable.st_dev, executable.st_ino) == (trusted.st_dev, trusted.st_ino)
            and len(argv) > 1 and argv[1] == PORTAL_BACKEND.encode()
            and unit == PORTAL_UNIT
            and os.readlink(base / 'ns/mnt') == os.readlink(proc / 'self/ns/mnt')
            and (_pidfd_pid(pidfd) == pid if pidfd >= 0 else _start_time(pid, proc) == before)):
        raise ValueError('Open With is not available.')
    return owner


def ask_person(connection, caller, identity, uris, cancellable=None, *, backend=None):
    """The desktop ID the person chose in the portal's Open With dialog.

    The dialog is Luma's AppChooser backend, drawn by the host and verified
    before it is asked, offering the apps for this kind of document with the
    requested one among them. Only the requested app or one of those apps is
    accepted back."""
    content_type, name = _describe(uris[0])
    try:
        owner = (backend or trusted_backend)(connection)
    except (GLib.Error, OSError, ValueError, IndexError) as error:
        raise ValueError('Open With is not available.') from error
    options = {'content_type': GLib.Variant('s', content_type), 'uri': GLib.Variant('s', uris[0]),
               'last_choice': GLib.Variant('s', identity.removesuffix('.desktop')),
               'modal': GLib.Variant('b', True)}
    if name:
        options['filename'] = GLib.Variant('s', name)
    handle = f'{PORTAL_PATH}/request/luma_application_directory/t{secrets.token_hex(8)}'
    try:
        reply = connection.call_sync(owner, PORTAL_PATH, 'org.freedesktop.impl.portal.AppChooser',
            'ChooseApplication', GLib.Variant('(ossasa{sv})', (handle, caller, '',
            [identity.removesuffix('.desktop')], options)), GLib.VariantType.new('(ua{sv})'),
            Gio.DBusCallFlags.NONE, CHOICE_TIMEOUT_MS, cancellable)
    except GLib.Error as error:
        if cancellable is not None and cancellable.is_cancelled():
            try:
                connection.call_sync(owner, handle, 'org.freedesktop.impl.portal.Request', 'Close',
                                     None, None, Gio.DBusCallFlags.NONE, 2000, None)
            except GLib.Error:
                pass
        raise ValueError('Choose the app to open this with in Open With.') from error
    response, results = reply.unpack()
    choice = results.get('choice') if response == 0 else None
    if not choice:
        raise ValueError('Nothing was opened.')
    choice = validate_id(choice if choice.endswith('.desktop') else choice + '.desktop')
    if choice != identity and choice not in _handlers(content_type):
        raise ValueError('That app cannot open this.')
    return choice


def _describe(uri):
    parts = urlsplit(uri)
    if parts.scheme in WEB_SCHEMES:
        return 'x-scheme-handler/' + parts.scheme, ''
    name = os.path.basename(unquote(parts.path))
    try:
        info = Gio.File.new_for_uri(uri).query_info('standard::content-type', Gio.FileQueryInfoFlags.NONE, None)
        return info.get_content_type() or '', name
    except GLib.Error:
        return Gio.content_type_guess(name, None)[0] or '', name


def desktop_app(identity):
    """GIO's entry for an installed ID; None when there is none (PyGObject
    raises TypeError for the NULL constructor result)."""
    try:
        return Gio.DesktopAppInfo.new(identity)
    except TypeError:
        return None


DOCUMENTS = ('org.freedesktop.portal.Documents', '/org/freedesktop/portal/documents',
             'org.freedesktop.portal.Documents')


def document_id(uri, uid=None):
    """The document portal ID of a /run/user/UID/doc/ID/... file URI, else None."""
    parts = urlsplit(uri)
    if parts.scheme != 'file':
        return None
    prefix = f'/run/user/{os.getuid() if uid is None else uid}/doc/'
    path = unquote(parts.path)
    if not path.startswith(prefix):
        return None
    doc = path[len(prefix):].split('/', 1)[0]
    return doc if re.fullmatch(r'[A-Za-z0-9_-]{1,64}', doc) else None


def grant_documents(connection, app, uris):
    """Grant the app about to open ``uris`` read access to each document.

    A sandboxed target sees only the documents granted to its own ID; the
    caller's grant names the caller. Read only: Launch asks for nothing more.
    A host program reads the portal's files as they are and needs no grant.
    Any failure raises: nothing may be launched with documents it can't open."""
    target = (app.get_string('X-Flatpak') or '') if app is not None else ''
    docs = sorted({doc for doc in (document_id(uri) for uri in uris) if doc})
    if not target or not docs:
        return []
    for doc in docs:
        try:
            connection.call_sync(*DOCUMENTS, 'GrantPermissions', GLib.Variant('(ssas)', (doc, target, ['read'])),
                                 None, Gio.DBusCallFlags.NONE, 5000, None)
        except GLib.Error as error:
            raise ValueError('The documents could not be shared with that app.') from error
    return docs


def _resolve(identity):
    """The entry to start: a signed sibling's own, a Luma system app's, else GIO's."""
    return sibling_info(identity) or system_info(identity) or desktop_app(identity)


def launch_for(connection, caller, identity, uris, cancellable=None):
    """Launch for a signed sandboxed caller, under launch_decision."""
    validate_id(identity)
    values = validate_uris(uris)
    sibling = sibling_info(identity)
    system = None if sibling else system_info(identity)
    app = sibling or system or desktop_app(identity)
    if app is None or not app.should_show():
        raise ValueError('This application is no longer installed.')
    kinds = [content_types(uri) for uri in values]
    # Only an entry the system installed opens without the person.
    direct = sibling is not None or system_entry(app)
    decision = launch_decision(caller, identity, values, sibling=sibling is not None,
        system_app=system is not None, kinds=kinds, web_default=direct and _web_default(identity, values),
        sole_handler=direct and _sole_handler(identity, kinds),
        file_default=direct and all(urlsplit(uri).scheme == 'file' for uri in values)
        and _file_default(identity, kinds))
    if decision == 'ask':
        identity = ask_person(connection, caller, identity, values, cancellable)
        app = _resolve(identity)
    if values and app is not None and runs_documents(app):
        raise ValueError('That app would run this document as a program.')
    if app is None or not app.should_show():
        raise ValueError('This application is no longer installed.')
    grant_documents(connection, app, values)
    print(f'luma-application-directory: {caller} opened {identity} ({decision}, {len(values)} documents)',
          file=sys.stderr, flush=True)
    return _launch(app, values)


def launch_application(identity, uris):
    validate_id(identity)
    return _launch(desktop_app(identity), validate_uris(uris))


def _launch(app, values):
    if app is None or not app.should_show():
        raise ValueError('This application is no longer installed.')
    if values:
        if app.supports_uris():
            return bool(app.launch_uris(values, None))
        if app.supports_files() and all(uri.startswith('file:') for uri in values):
            return bool(app.launch([Gio.File.new_for_uri(uri) for uri in values], None))
        raise ValueError('This application cannot receive these documents.')
    return bool(app.launch([], None))


class Broker:
    def __init__(self):
        self.loop = GLib.MainLoop()
        self.bus = None
        self.active = {}
        self.changed_source = 0
        self.last = time.monotonic()
        self.monitor = Gio.AppInfoMonitor.get()
        self.monitor.connect('changed', self._changed)
        self.owner = Gio.bus_own_name(Gio.BusType.SESSION, BUS, Gio.BusNameOwnerFlags.NONE,
            self._acquired, None, lambda *_: self.loop.quit())
        self.idle = GLib.timeout_add_seconds(30, self._idle)

    def _idle(self):
        if self.active or time.monotonic() - self.last < 60:
            return GLib.SOURCE_CONTINUE
        self.loop.quit()
        return GLib.SOURCE_REMOVE

    def _changed(self, *_):
        if self.changed_source:
            return
        def emit():
            self.changed_source = 0
            if self.bus:
                self.bus.emit_signal(None, OBJECT, BUS, 'Changed', None)
            return GLib.SOURCE_REMOVE
        self.changed_source = GLib.timeout_add(250, emit)

    def _acquired(self, connection, *_):
        self.bus = connection
        connection.register_object(OBJECT, Gio.DBusNodeInfo.new_for_xml(XML).interfaces[0], self._call, None, None)

    def _call(self, connection, sender, _path, _interface, method, args, invocation):
        from .app_data_broker import authenticate
        from concurrent.futures import ThreadPoolExecutor
        try:
            if method not in {'List', 'Launch'}:
                raise ValueError('Unsupported application operation.')
            values = args.unpack()
            if method == 'List':
                validate_mime(values[0])
            else:
                validate_id(values[0]); validate_uris(values[1], check_files=False)
            if len(self.active) >= 4 or sender in self.active:
                raise ValueError('Application discovery is already working. Try again shortly.')
            # authenticate is performed off the GTK/D-Bus main loop because
            # validating real retained signed deployments can read OSTree.
        except Exception as error:
            invocation.return_dbus_error(BUS + '.Refused', str(error)[:512]); return
        self.last = time.monotonic()
        cancelled = Gio.Cancellable()
        self.active[sender] = cancelled
        watch = Gio.bus_watch_name_on_connection(connection, sender, Gio.BusNameWatcherFlags.NONE,
            lambda *_: None, lambda *_: cancelled.cancel())
        if not hasattr(self, 'executor'):
            self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix='luma-app-directory')
        def work():
            try:
                caller = authenticate(connection, sender)
                if cancelled.is_cancelled():
                    raise ValueError('The requesting application closed.')
                result = (application_rows(values[0]) if method == 'List'
                          else launch_for(connection, caller, *values, cancellable=cancelled))
                GLib.idle_add(finish, result, '')
            except Exception as error:
                GLib.idle_add(finish, None, str(error)[:512])
        def finish(result, error):
            self.active.pop(sender, None)
            Gio.bus_unwatch_name(watch)
            if not cancelled.is_cancelled():
                if error:
                    invocation.return_dbus_error(BUS + '.Refused', error)
                else:
                    invocation.return_value(GLib.Variant('(a(sssbbb))' if method == 'List' else '(b)', (result,)))
            return GLib.SOURCE_REMOVE
        self.executor.submit(work)

    def run(self):
        try:
            self.loop.run()
        finally:
            for cancel in self.active.values():
                cancel.cancel()
            if hasattr(self, 'executor'):
                self.executor.shutdown(wait=True, cancel_futures=True)
            Gio.bus_unown_name(self.owner)


if __name__ == '__main__':
    Broker().run()
