# SPDX-License-Identifier: Apache-2.0
"""What no Flatpak reaches, whatever its bundle declares.

Suno keeps its own records in the person's folders: the permission backups
and installer state (``~/.local/share/Suno``), the running applications' views
(``$XDG_RUNTIME_DIR/Suno-permissions``), the sound servers' sockets. Flatpak's
own overrides, the person's autostart entries and user services decide what
runs on the host. A bundle may declare any of these as a filesystem; this
person's global Flatpak override takes each of them away again
(``--nofilesystem``), for every Flatpak, user or system installed (flatpak
always reads the person's global override).

A global override is matched by the way a path is written, so each place is
listed in every spelling a bundle could use for it: ``xdg-data/Suno``,
``~/.local/share/Suno`` and its absolute path. ``Suno-flatpak-guard.service``
writes what is missing at every sign-in, and ``Suno-flatpak-guard.path`` again
whenever Flatpak's overrides or installed applications change, so an update
needs nothing from the person and a removed entry comes back. Entries already
there are left alone, so the person's own global settings stay as they are.

Flatpak hides a place by covering it, and still shows a deeper place a bundle
declares inside it (an export of ``xdg-data/Suno/installer`` is mounted on
top of the cover). So each installed application's own declarations are read
too, and one that points into a guarded place is taken away by the same name
in that application's override (``declared_exclusions``); a removal by the
exact name always wins. ``flatpak_permissions`` keeps those lines when it
rewrites an application's override.

Also taken away: a declared place inside another place the application may
write, inside its own ~/.var/app/ID or a persist folder there (where it could
plant a link a later start follows), and the permission store and portal
backends' bus names (``STORE_NAMES``). A ref flatpak cannot describe is
guarded completely.

Full control. An application is shown as full control (``Suno``/
``full-control`` in the permission store, ``full_control`` in AppPermissions1,
the Depot review report) unless every grant it effectively has is on the one
list of narrow grants (``data/flatpak-narrow-grants.json``, each with its
reason; ``full_control_reasons``). Suno does not take the rest away: an
application that asked for it would break, or send its saves to an empty
folder. A narrower class, ``escapes`` (the session bus, host commands, or
write access from which a folder above a cover can be renamed and remade:
home, host, the host root, ~/.local, ~/.config...), keeps only the guard's
covers, which stop casual access but are best effort for it; the boundary
for those needs Suno's flatpak (a read-only home with each folder its own
mount).

Suno's record decides by narrowing only (``flatpak_permissions.reassert``): an
application's override that gives more than Suno's record, including a
``flatpak override`` the person ran, is cut back at the next run, with one
line in the log; access is changed in Settings or with Suno-appctl.
"""
from __future__ import annotations

import configparser
import json
import os
import subprocess
import sys
from pathlib import Path

# Relative to the data, configuration and runtime folders.
DATA = ("Suno", "flatpak")
CONFIG = ("autostart", "systemd", "environment.d")
# Suno's runtime folders and the session's own: Flatpak's instance records and
# bus proxies, the session bus and user manager, the keyring's control socket.
# Not Suno-viola and Suno-native-messaging: Viola is given its own parts of those.
RUNTIME = ("Suno-permissions", "Suno-sound", "Suno-refused", "Suno-installer-bus", "Suno-apps", "Suno-relay",
           "Suno-shell", "Suno-keyring", "Suno-android", "Suno-android-rdp", "Suno-application-installer",
           ".dbus-proxy", "bus", "systemd", "keyring")
# Flatpak's instance records: flatpak binds each instance's record into this
# folder at start, so covering it stops the start ("bwrap: Destination is not a
# directory"). Never in the global override or the fail-closed list, or every
# Flatpak stops starting. A bundle that declares it still has that declaration
# taken away by name (declared_exclusions); only that bundle can then fail.
RECORDS = (".flatpak",)


def _homes() -> list[Path]:
    """The home folder as the environment writes it and as it really is (/home -> /var/home)."""
    found: list[Path] = []
    for value in (os.environ.get("HOME") or str(Path.home()), str(Path.home().resolve())):
        path = Path(value)
        if path not in found:
            found.append(path)
    return found


def guarded(*, uid: int | None = None, records: bool = False) -> list[str]:
    """Every spelling of every guarded place, as ``--nofilesystem`` takes it."""
    uid = os.getuid() if uid is None else uid
    homes = _homes()
    data_home = os.environ.get("XDG_DATA_HOME") or ""
    config_home = os.environ.get("XDG_CONFIG_HOME") or ""
    # flatpak's xdg-run is always /run/user/UID, whatever the environment says.
    runtimes = list(dict.fromkeys([f"/run/user/{uid}", os.environ.get("XDG_RUNTIME_DIR") or f"/run/user/{uid}"]))
    paths: list[str] = []
    for name in DATA:
        paths += [f"xdg-data/{name}", f"~/.local/share/{name}", *[f"{home}/.local/share/{name}" for home in homes]]
        if data_home:
            paths.append(f"{data_home}/{name}")
    for name in CONFIG:
        paths += [f"xdg-config/{name}", f"~/.config/{name}", *[f"{home}/.config/{name}" for home in homes]]
        if config_home:
            paths.append(f"{config_home}/{name}")
    for name in (*RUNTIME, *(RECORDS if records else ())):
        paths += [f"xdg-run/{name}", *[f"{runtime}/{name}" for runtime in runtimes]]
    return list(dict.fromkeys(path.rstrip("/") for path in paths))


_MODES = (":ro", ":rw", ":create")


def _split_mode(item: str) -> tuple[str, str]:
    """(place, mode) split at the last ':' that is not escaped (``\\:`` is part of a path)."""
    index = len(item) - 1
    while index >= 0:
        if item[index] == ":":
            backslashes = 0
            while index - 1 - backslashes >= 0 and item[index - 1 - backslashes] == "\\":
                backslashes += 1
            if backslashes % 2 == 0:
                return item[:index], item[index + 1:]
        index -= 1
    return item, ""


def _base(item: str) -> str:
    place, mode = _split_mode(item)
    return place if mode in ("ro", "rw", "create") else item


_USER_DIRS = {"xdg-desktop": ("DESKTOP", "Desktop"), "xdg-documents": ("DOCUMENTS", "Documents"),
              "xdg-download": ("DOWNLOAD", "Downloads"), "xdg-music": ("MUSIC", "Music"),
              "xdg-pictures": ("PICTURES", "Pictures"), "xdg-public-share": ("PUBLICSHARE", "Public"),
              "xdg-templates": ("TEMPLATES", "Templates"), "xdg-videos": ("VIDEOS", "Videos")}


def _user_dir(prefix: str) -> str:
    """An XDG user folder as the person's user-dirs.dirs names it (flatpak reads the same)."""
    home = Path.home()
    key, default = _USER_DIRS[prefix]
    config = Path(os.environ.get("XDG_CONFIG_HOME") or home / ".config") / "user-dirs.dirs"
    try:
        for line in config.read_text(encoding="utf-8").splitlines():
            if line.startswith(f"XDG_{key}_DIR="):
                value = line.split("=", 1)[1].strip().strip('"').replace("$HOME", str(home))
                return value
    except (OSError, UnicodeError):
        pass
    return str(home / default)


def _resolve(item: str, uid: int) -> str:
    """Where a declared filesystem lands on the host, or "" when it is not a single place."""
    home = Path.home()
    if item in _HOST_PLACES:
        return _HOST_PLACES[item]
    head, _, rest = item.partition("/")
    if head in _USER_DIRS:
        return os.path.join(_user_dir(head), rest) if rest else _user_dir(head)
    if head == "xdg-cache":
        cache = os.environ.get("XDG_CACHE_HOME") or str(home / ".cache")
        return os.path.join(cache, rest) if rest else cache
    data_home = os.environ.get("XDG_DATA_HOME") or str(home / ".local/share")
    config_home = os.environ.get("XDG_CONFIG_HOME") or str(home / ".config")
    runtime = f"/run/user/{uid}"  # flatpak_get_real_xdg_runtime_dir
    for prefix, root in (("xdg-data/", data_home), ("xdg-config/", config_home), ("xdg-run/", runtime),
                         ("~/", str(home))):
        if item.startswith(prefix):
            return os.path.join(root, item[len(prefix):])
    # The whole folder (flatpak has no bare xdg-run).
    if item in ("xdg-data", "xdg-config", "~"):
        return {"xdg-data": data_home, "xdg-config": config_home, "~": str(home)}[item]
    return item if item.startswith("/") else ""


def _guarded_roots(uid: int) -> list[str]:
    roots = []
    for place in guarded(uid=uid, records=True):
        path = _resolve(place, uid)
        if path:
            roots.append(os.path.realpath(path))
    return list(dict.fromkeys(roots))


def declared_exclusions(declared: list[str], *, uid: int | None = None, unescape: bool = False) -> list[str]:
    """The filesystems that land in or below a guarded place, by the name given.

    With ``unescape``, names are flatpak's canonical ones (``merged_filesystems``)
    and are read the way flatpak reads them."""
    uid = os.getuid() if uid is None else uid
    roots = _guarded_roots(uid)
    found = []
    for item in declared:
        item = item.strip()
        if not item or item.startswith("!"):
            continue
        name = _base(item)
        path = _resolve(_unescape(name) if unescape else name, uid)
        if not path:
            continue
        real = os.path.realpath(path)
        if any(real == root or real.startswith(root + "/") for root in roots):
            found.append(name)
    return list(dict.fromkeys(found))


SYSTEM_INSTALLATION = Path("/var/lib/flatpak")
SYSTEM_OVERRIDES = SYSTEM_INSTALLATION / "overrides"


# Suno's own system applications that share exactly one place inside Suno's data
# with their native counterparts (packaging/flatpak). Kept only for the copy
# installed system-wide from Suno's signed remote, never for a same-named bundle
# a person installed for themselves.
FIRST_PARTY_SHARED = {"org.projectSuno.Phone": ("xdg-data/Suno/phone",)}
SUNO_REMOTE = "Suno"


def extra_installations(root: Path = Path("/etc/flatpak/installations.d")) -> list[Path]:
    """System installations besides the default one (flatpak's installations.d)."""
    found = []
    try:
        files = sorted(root.glob("*.conf"))
    except OSError:
        return found
    for path in files:
        parser = configparser.ConfigParser(interpolation=None, strict=False)
        try:
            parser.read_string(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, configparser.Error):
            continue
        for section in parser.sections():
            if section.startswith("Installation") and parser.get(section, "Path", fallback=""):
                found.append(Path(parser.get(section, "Path")))
    return found


# The installer's copy, then the image's static remote (configure-system.sh) it is installed from;
# both under read-only /usr. Absent both, nothing is Suno's own.
SUNO_REMOTE_DEFINITIONS = (Path("/usr/share/Suno/installer/Suno.flatpakrepo"),
                           Path("/usr/share/flatpak/remotes.d/Suno.flatpakrepo"))


def _primary_keys(data: bytes) -> int:
    """How many primary public keys an OpenPGP keyring holds (-1: unreadable)."""
    count, index = 0, 0
    while index < len(data):
        tag = data[index]
        if not tag & 0x80:
            return -1
        if tag & 0x40:
            kind, index = tag & 0x3F, index + 1
            first = data[index] if index < len(data) else 255
            if first < 192:
                length, index = first, index + 1
            elif first < 224:
                length, index = ((first - 192) << 8) + data[index + 1] + 192, index + 2
            elif first == 255:
                length, index = int.from_bytes(data[index + 1:index + 5], "big"), index + 5
            else:
                return -1
        else:
            kind, size = (tag >> 2) & 0x0F, tag & 0x03
            width = {0: 1, 1: 2, 2: 4}.get(size, 0)
            if not width:
                return -1
            length, index = int.from_bytes(data[index + 1:index + 1 + width], "big"), index + 1 + width
        count += kind == 6
        index += length
    return count


def _openpgp_fingerprint(data: bytes) -> str:
    """The v4 fingerprint of the first public key in an OpenPGP key or keyring."""
    import hashlib
    index = 0
    while index < len(data):
        tag = data[index]
        if not tag & 0x80:
            return ""
        if tag & 0x40:  # new format
            kind, index = tag & 0x3F, index + 1
            first = data[index]
            if first < 192:
                length, index = first, index + 1
            elif first < 224:
                length, index = ((first - 192) << 8) + data[index + 1] + 192, index + 2
            else:
                length, index = int.from_bytes(data[index + 1:index + 5], "big"), index + 5
        else:
            kind, size = (tag >> 2) & 0x0F, tag & 0x03
            width = {0: 1, 1: 2, 2: 4}.get(size, 0)
            if not width:
                return ""
            length, index = int.from_bytes(data[index + 1:index + 1 + width], "big"), index + 1 + width
        body = data[index:index + length]
        if kind == 6 and body[:1] == b"\x04":
            return hashlib.sha1(b"\x99" + len(body).to_bytes(2, "big") + body).hexdigest().upper()
        index += length
    return ""


def _remote_definition() -> tuple[str, str]:
    """(URL, key fingerprint) of the Suno remote, from the installer's own root-owned copy."""
    import base64
    for path in SUNO_REMOTE_DEFINITIONS:
        parser = configparser.ConfigParser(interpolation=None, strict=False)
        try:
            parser.read_string(path.read_text(encoding="utf-8"))
            url = parser.get("Flatpak Repo", "Url")
            key = base64.b64decode(parser.get("Flatpak Repo", "GPGKey"))
        except (OSError, UnicodeError, configparser.Error, ValueError):
            continue
        return url.rstrip("/"), _openpgp_fingerprint(key)
    return "", ""


def Suno_remote_pinned(base: Path | None = None) -> bool:
    """The system installation's Suno remote is Suno's: its URL and its key's fingerprint match
    the installer's own copy, and it verifies what it installs."""
    base = base or SYSTEM_INSTALLATION
    url, fingerprint = _remote_definition()
    if not url or not fingerprint:
        return False
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string((base / "repo/config").read_text(encoding="utf-8"))
        section = f'remote "{SUNO_REMOTE}"'
        configured = parser.get(section, "url").rstrip("/")
        verifies = parser.get(section, "gpg-verify", fallback="true").lower() == "true"
        elsewhere = parser.has_option(section, "gpgkeypath")
        key = (base / f"repo/{SUNO_REMOTE}.trustedkeys.gpg").read_bytes()
    except (OSError, UnicodeError, configparser.Error):
        return False
    # Exactly Suno's key: one primary key, none read from anywhere else.
    return configured == url and verifies and not elsewhere and _primary_keys(key) == 1 and \
        _openpgp_fingerprint(key) == fingerprint


def Suno_origin(app: str, data_home: Path | None = None) -> bool:
    """One of Suno's own applications: installed system-wide from the pinned Suno remote, and not
    also installed for the person (a same-named copy). Never by its name alone."""
    data_home = data_home or Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")
    if (data_home / "flatpak/app" / app).exists():
        return False
    deploy = SYSTEM_INSTALLATION / "app" / app / "current/active/deploy"
    return deploy.exists() and _origin(deploy) == SUNO_REMOTE and Suno_remote_pinned()


def _above_or_inside(app: str, prefix: str) -> bool:
    return app == prefix.rstrip(".") or app.startswith(prefix) or prefix.startswith(app + ".")


def reserved_tier(app: str, grants: dict | None = None) -> str:
    """"hard": an ID equal to, inside or above a name no one else's application may own (refused
    everywhere); "soft": one that collides with a session service's name (installable, disclosed as
    full control); "" for anything else. From the list only (``reserved_ids``), never from what
    happens to be on the bus, so it is the same whether or not anything is running."""
    reserved = (grants or narrow_grants()).get("reserved_ids", {})
    if any(_above_or_inside(app, prefix) for prefix in reserved.get("hard", {}).get("prefixes", [])):
        return "hard"
    soft = reserved.get("soft", {})
    if any(_above_or_inside(app, prefix) for prefix in soft.get("prefixes", [])) or \
            any(name == app or name.startswith(app + ".") for name in soft.get("services", [])):
        return "soft"
    return ""


def reserved_id(app: str, grants: dict | None = None) -> bool:
    """An ID Valet, Depot and Depot review refuse (``reserved_tier`` "hard")."""
    return reserved_tier(app, grants) == "hard"


def reserved_apps(operations) -> list[str]:
    """Applications in a transaction whose IDs are reserved (flatpak_guard.reserved_id), whatever
    the bundle or reference said its name was."""
    found = []
    for op in operations:
        parts = (op.get_ref() or "").split("/")
        if len(parts) >= 2 and parts[0] == "app" and reserved_id(parts[1]):
            found.append(parts[1])
    return found


def installed_metadata(data_home: Path | None = None) -> dict[str, str]:
    """Application ID -> its deployed metadata, user and system installations."""
    return {app: texts[-1] for app, (texts, _shared, _where) in installed(data_home).items()}


def _origin(deploy: Path) -> str:
    try:
        return deploy.read_bytes()[:256].split(b"\0", 1)[0].decode("utf-8", "replace")
    except OSError:
        return ""


def installed(data_home: Path | None = None) -> dict[str, tuple[list[str], tuple[str, ...], list[str]]]:
    """Application ID -> (the metadata of each installed copy, what it may keep inside a guarded
    place, its installations: "system", "user").

    Metadata of both installations is joined: the person's override applies to
    either copy, so it must cover what either declares."""
    data_home = data_home or Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")
    found: dict[str, list[str]] = {}
    where: dict[str, list[str]] = {}
    system_Suno: set[str] = set()
    user_apps: set[str] = set()
    for base, system in ((SYSTEM_INSTALLATION, True), *[(path, True) for path in extra_installations()],
                         (data_home / "flatpak", False)):
        try:
            entries = sorted((base / "app").iterdir())
        except OSError:
            continue
        for entry in entries:
            try:
                found.setdefault(entry.name, []).append((entry / "current/active/metadata").read_text(encoding="utf-8"))
            except (OSError, UnicodeError):
                continue
            where.setdefault(entry.name, []).append("system" if system else "user")
            if system and base == SYSTEM_INSTALLATION and _origin(entry / "current/active/deploy") == SUNO_REMOTE \
                    and Suno_remote_pinned():
                system_Suno.add(entry.name)
            if not system:
                user_apps.add(entry.name)
    result = {}
    for app, texts in found.items():
        shared = FIRST_PARTY_SHARED.get(app, ()) if app in system_Suno and app not in user_apps else ()
        result[app] = (texts, shared, where.get(app, []))
    return result


def _unescape(key: str) -> str:
    """flatpak writes ':' and '\\' in a path escaped with a backslash."""
    out, escaped = [], False
    for character in key:
        if escaped or character != "\\":
            out.append(character)
            escaped = False
        else:
            escaped = True
    return "".join(out)


def _installation_option(installation: str) -> str:
    if installation in ("user", "system"):
        return f"--{installation}"
    return f"--installation={installation}"


def refs(*, runner=subprocess.run) -> list[tuple[str, str, str]]:
    """(application ID, ref, installation) of every installed application, every branch and
    installation flatpak knows (extra installations from /etc/flatpak/installations.d too)."""
    done = runner(["flatpak", "list", "--app", "--columns=application,ref,installation"],
                  capture_output=True, text=True, timeout=60)
    if done.returncode:
        raise OSError(f"flatpak list: {(done.stderr or '').strip()[-300:]}")
    found = []
    for line in (done.stdout or "").splitlines():
        parts = line.split("\t")
        if len(parts) >= 3 and parts[0] and parts[1]:
            found.append((parts[0].strip(), parts[1].strip(), parts[2].strip() or "system"))
    return found


def permissions(ref: str, installation: str, *, runner=subprocess.run) -> configparser.ConfigParser:
    """What flatpak itself will give this ref: runtime, metadata and every override merged,
    every place and name in flatpak's own canonical spelling (``flatpak info --show-permissions``)."""
    done = runner(["flatpak", "info", _installation_option(installation), "--show-permissions", ref],
                  capture_output=True, text=True, timeout=30)
    if done.returncode:
        raise OSError(f"flatpak info {ref}: {(done.stderr or '').strip()[-300:]}")
    parser = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
    parser.optionxform = str  # type: ignore[assignment]
    parser.read_string(done.stdout or "")
    return parser


def merged_filesystems(app: str, installation: str, *, runner=subprocess.run) -> list[str]:
    return _list(permissions(app, installation, runner=runner), "filesystems")


def _list(parser: configparser.ConfigParser, key: str) -> list[str]:
    value = parser.get("Context", key, fallback="") if parser.has_section("Context") else ""
    return [item.strip() for item in value.split(";") if item.strip() and not item.strip().startswith("!")]


# Parents that reach Suno's places: the global override covers these children
# for every Flatpak; an application given one gets the covers in its own
# override too, so nothing it or anyone writes there can lift them.
PARENTS = ("home", "host")
CORE = tuple(f"xdg-data/{name}" for name in DATA) + tuple(f"xdg-config/{name}" for name in CONFIG)

_POLICY = {"none": 0, "see": 1, "talk": 2, "own": 3}


def _covers(rule: str, name: str) -> bool:
    return rule == name or (rule.endswith(".*") and name.startswith(rule[:-1]))


# Names that run anything on the host: such an application is in full control
# of the person's account whatever else it is given (flatpak-spawn --host,
# units). Suno does not take them away (applications like an IDE exist to use
# them): it says so, as the "full control" level, and the guard is moot.
HOST_CONTROL = ("org.freedesktop.Flatpak", "org.freedesktop.systemd1",
                # Opens a folder or runs a program it is handed, for any caller (narrow grants:
                # acts_as_you).
                "org.projectSuno.Terminal")
# Names no application may reach unless it already has full control: the
# permission store (its own grants, the microphone) and the portals' backends.
STORE_NAMES = ("org.freedesktop.impl.portal.PermissionStore", "org.freedesktop.impl.portal.*")


# flatpak reads these at every start to place xdg-download and the like. Only the
# person and full-control applications may ever change them: every other
# application gets them read-only (``ro_locks``), and the guard trusts them
# (``_user_dir``) only because of that.
USER_DIRS_FILES = ("xdg-config/user-dirs.dirs", "xdg-config/user-dirs.locale")
# The person's default applications (GIO reads the desktop's own list first, and still the old
# one beside the application entries): written, every "open with the default" of Suno's own
# applications could be sent to an entry an application planted. Read-only for every application
# that could write them, the same way.
DEFAULT_APP_FILES = ("xdg-config/mimeapps.list", "xdg-config/gnome-mimeapps.list",
                     "xdg-data/applications/mimeapps.list")
LOCKED_FILES = USER_DIRS_FILES + DEFAULT_APP_FILES


def warn(text: str) -> None:
    """A warning in the journal (priority 4), not a quiet line."""
    print(f"<4>Suno-flatpak-guard: WARNING: {text}", file=sys.stderr, flush=True)


# What the host-wide names expose on the host.
_HOST_PLACES = {"host": "/", "host-root": "/", "host-os": "/usr", "host-etc": "/etc"}


def _rename_reaches_a_cover(key: str, uid: int | None = None) -> bool:
    """A writable grant from which a cover can be got round: the host (any of its views:
    host, host-root, host-os, host-etc), the home folder, an ancestor of it, or any place
    that holds a covered folder's parent (``~/.local``, ``~/.local/share``, ``~/.config``):
    a folder there that is not itself a mount point can be renamed and made afresh, and a
    cover over a folder that does not exist yet is not there at all."""
    uid = os.getuid() if uid is None else uid
    place, mode = _split_mode(key)
    if mode == "ro":
        return False
    if place in _HOST_PLACES or place in ("home", "~"):
        return True
    path = _resolve(_unescape(place), uid)
    if not path:
        return False
    path = os.path.realpath(path).rstrip("/") or "/"
    home = os.path.realpath(str(Path.home()))
    config = os.path.realpath(os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config"))
    parents = {os.path.dirname(cover) for cover in [*_guarded_roots(uid), os.path.join(config, "user-dirs.dirs")]}

    def holds(target: str) -> bool:
        return path == "/" or target == path or target.startswith(path + "/")
    return holds(home) or any(holds(parent) for parent in parents)


def escapes(parser: configparser.ConfigParser) -> bool:
    """It can run anything on the host, or round every cover: the session bus, talk to
    org.freedesktop.Flatpak or systemd1, or write access from which a folder above a cover can be
    renamed and remade (``_rename_reaches_a_cover``). For it the guard keeps only its covers
    (against casual access); taking more would only break it. A narrower class than full control
    (``full_control``), which is what is disclosed."""
    if "session-bus" in _list(parser, "sockets"):
        return True
    if any(_rename_reaches_a_cover(key) for key in _list(parser, "filesystems")):
        return True
    if not parser.has_section("Session Bus Policy"):
        return False
    return any(_POLICY.get(value.strip(), 0) >= _POLICY["talk"] and any(_covers(rule, name) for name in HOST_CONTROL)
               for rule, value in parser.items("Session Bus Policy"))


NARROW_GRANTS = "flatpak-narrow-grants.json"
_NARROW: dict = {}


def narrow_grants() -> dict:
    """The one list of narrow grants (data/flatpak-narrow-grants.json): the guard, depot-review
    and AppPermissions1's full_control all read it through here."""
    if not _NARROW:
        for path in (Path("/usr/share/Suno-installer") / NARROW_GRANTS,
                     Path(__file__).resolve().parent.parent / "data" / NARROW_GRANTS):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if data.get("schema") == "org.projectSuno.flatpak-narrow-grants/v1":
                _NARROW.update(data)
                break
    return _NARROW


_SUNO_FLATPAK: list[bool] = []


def Suno_flatpak() -> bool:
    """Suno's flatpak runs here (patches/flatpak 0001 with its helper installed)."""
    if not _SUNO_FLATPAK:
        try:
            marker = b"Suno-flatpak-view" in Path("/usr/bin/flatpak").read_bytes()
        except OSError:
            marker = False
        _SUNO_FLATPAK.append(marker and Path("/usr/libexec/Suno-flatpak-view").exists())
    return _SUNO_FLATPAK[0]


def _name_allowed(rule: str, names: list[str], app: str) -> bool:
    for pattern in names:
        pattern = pattern.replace("{app}", app)
        if rule == pattern or (pattern.endswith(".*") and rule.startswith(pattern[:-1]) and app):
            return True
    return False


def _filesystem_narrow(key: str, app: str, grants: dict) -> bool:
    place, mode = _split_mode(key)
    mode = mode or "rw"
    for group in grants.get("filesystems", {}).values():
        if mode not in group.get("modes", []):
            continue
        for allowed in group.get("keys", []):
            allowed = allowed.replace("{app}", app)
            if place == allowed or (group.get("subfolders") and place.startswith(allowed.rstrip("/") + "/")):
                return True
    return False


def _installed_version(package: str) -> str:
    """VERSION-RELEASE of an installed package, "" when it is not installed or rpm cannot say."""
    if package in _VERSIONS:
        return _VERSIONS[package]
    try:
        done = subprocess.run(["rpm", "-q", "--qf", "%{VERSION}-%{RELEASE}", package], capture_output=True,
                              text=True, timeout=20)
        found = done.stdout.strip() if done.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        found = ""
    _VERSIONS[package] = found
    return found


_VERSIONS: dict[str, str] = {}


def _version_key(value: str) -> list:
    """rpm's ordering, enough for VERSION-RELEASE with dist tags: numeric and alphabetic runs."""
    import re
    return [(0, int(part)) if part.isdigit() else (1, part) for part in re.findall(r"\d+|[A-Za-z]+", value)]


def _at_least(found: str, wanted: str) -> bool:
    if not found:
        return False
    try:
        import rpm  # type: ignore[import-not-found]
        split = lambda value: (None, *value.rsplit("-", 1))  # noqa: E731
        return rpm.labelCompare(split(found), split(wanted)) >= 0
    except ImportError:
        return _version_key(found) >= _version_key(wanted)


def _scoped_names(group: dict) -> list[str]:
    """The names of a caller-scoped group that count here: one with a requirement only where the
    installed package has the check (an older image keeps it as full control)."""
    requires = group.get("requires", {})
    found = []
    for name in group.get("names", {}):
        need = requires.get(name)
        if need and not _at_least(_installed_version(need.get("package", "")), need.get("version", "")):
            continue
        found.append(name)
    return found


def full_control_reasons(parser: configparser.ConfigParser, app: str = "", *,
                         with_Suno_flatpak: bool | None = None, first_party: bool = False) -> list[str]:
    """Why an application is full control: every grant it effectively has that is not on the list
    of narrow grants (``narrow_grants``). Empty: it is not. Unreadable or unknown: full control."""
    grants = narrow_grants()
    if not grants:
        return ["the list of narrow grants could not be read"]
    Suno = Suno_flatpak() if with_Suno_flatpak is None else with_Suno_flatpak
    if not app and parser.has_section("Application"):
        app = parser.get("Application", "name", fallback="")
    reasons: list[str] = []
    if not app:
        reasons.append("no application ID")
    else:
        tier = reserved_tier(app, grants)
        if tier == "hard" and not first_party:
            reasons.append(f"application ID {app} is in a reserved namespace")
        elif tier == "soft":
            reasons.append(f"application ID {app} can take over a system service name")
    if parser.has_section("Context"):
        reasons += [f"context key {key}" for key, _value in parser.items("Context")
                    if key not in grants.get("context_keys", {})]
    for key in _list(parser, "filesystems"):
        if not _filesystem_narrow(key, app, grants) or _rename_reaches_a_cover(key):
            # (a user folder the person's user-dirs.dirs puts above a cover reaches round it)
            reasons.append(f"filesystem {key}")
    sockets = {**grants.get("sockets", {}), **(grants.get("sockets_with_Suno_flatpak", {}) if Suno else {})}
    reasons += [f"socket {name}" for name in _list(parser, "sockets") if name not in sockets]
    reasons += [f"device {name}" for name in _list(parser, "devices") if name not in grants.get("devices", {})]
    reasons += [f"feature {name}" for name in _list(parser, "features") if name not in grants.get("features", {})]
    reasons += [f"shared {name}" for name in _list(parser, "shared") if name not in grants.get("shared", {})]
    session = grants.get("session_bus", {})
    bound = _bound_names(session.get("talk_bound", {}), app)
    capabilities = grants.get("system_bus", {}).get("capabilities", {})
    acts = grants.get("acts_as_you", {}).get("session_bus", {})
    talk = [*session.get("talk", {}).get("names", []),
            *(session.get("talk_with_Suno_flatpak", {}).get("names", []) if Suno else []),
            *_scoped_names(session.get("talk_scoped_to_caller", {}))]
    own = session.get("own", {}).get("names", [])
    for section, allowed_talk, allowed_own in (("Session Bus Policy", talk, own),
                                               ("System Bus Policy", grants.get("system_bus", {}).get("talk", {})
                                                .get("names", []), [])):
        if not parser.has_section(section):
            continue
        bus = "session" if section.startswith("Session") else "system"
        for rule, value in parser.items(section):
            policy = value.strip()
            if policy == "none" or (policy == "see" and bus == "session"):
                continue
            if policy == "talk" and _name_allowed(rule, allowed_talk, app):
                continue
            if policy == "own" and _name_allowed(rule, allowed_own, app):
                continue
            if bus == "session" and policy in ("talk", "own") and rule in acts:
                reasons.append(TIER1_PREFIX + (acts[rule].get("line") or rule))
                continue
            if bus == "session" and policy == "talk" and rule in bound:
                if bound[rule]:
                    reasons.append(bound[rule])
                continue
            if bus == "system" and policy == "talk" and rule in capabilities:
                reasons.append(capabilities[rule].get("line") or f"system bus talk {rule}")
                continue
            reasons.append(f"{bus} bus {policy} {rule}")
    for section in parser.sections():
        if section in grants.get("known_sections", {}):
            continue
        if section not in ("Application", "Runtime", "Context", "Session Bus Policy", "System Bus Policy",
                           "Environment", "Instance", "Extension", "Build", "ExtensionOf", "Extra Data") and \
                not section.startswith(("Extension ", "Policy ", "USB Devices")):
            reasons.append(f"unknown section {section}")
        if section == "USB Devices" or section.startswith("Policy "):
            reasons.append(f"{section}")
    return reasons


TIER1_PREFIX = "acts as you outside its sandbox: "


def _bound_names(group: dict, app: str) -> dict[str, str]:
    """name -> "" (narrow here) or the line it is disclosed with, for the services bound to one
    application (``talk_bound``): inert for every other application; for the one it serves, its
    own line (narrow, or a tier 1 capability). A requirement not met: not listed (full control)."""
    found: dict[str, str] = {}
    for name, entry in group.get("names", {}).items():
        need = entry.get("requires")
        if need and not _at_least(_installed_version(need.get("package", "")), need.get("version", "")):
            continue
        if app != entry.get("bound_to") or entry.get("for_bound") == "narrow":
            found[name] = ""
        elif entry.get("for_bound") == "tier1":
            found[name] = TIER1_PREFIX + (entry.get("line") or name)
    return found


def disclosure_tier(parser: configparser.ConfigParser, app: str = "", *, first_party: bool = False) -> int:
    """1: it can act as you outside its sandbox (``escapes``, or a service that does so for it);
    2: it is given something beyond the narrow grants (its lines: ``full_control_reasons``);
    0: narrow."""
    try:
        reasons = full_control_reasons(parser, app, first_party=first_party)
    except Exception:  # noqa: BLE001 - unparsable: full control
        return 1
    if escapes(parser) or any(reason.startswith(TIER1_PREFIX) for reason in reasons):
        return 1
    return 2 if reasons else 0


def full_control(parser: configparser.ConfigParser, app: str = "", *, first_party: bool = False) -> bool:
    """Not full control only when every grant it effectively has is a narrow one (``narrow_grants``):
    a document folder, its own data, the display, the GPU and the like. Anything else (home, host,
    any other path, the session bus, a wildcard, host commands, devices=all, anything unknown) can
    reach outside its sandbox or round Suno's covers, and is disclosed as full control, whoever made it."""
    try:
        return bool(full_control_reasons(parser, app, first_party=first_party))
    except Exception:  # noqa: BLE001 - unparsable: full control
        return True


def cancellations(app: str, parser: configparser.ConfigParser, shared: tuple[str, ...] = (), *,
                  uid: int | None = None, locks: list[str] | None = None) -> tuple[list[str], list[str]]:
    """(places, bus names) to take away from this application, by flatpak's own spelling.

    Places: inside a guarded place; for home or host, the guarded places
    themselves; and any declared place whose folder above lies inside another
    place it may write, inside its own ~/.var/app/ID or a persist folder there:
    the only places it could plant a link that a later start would follow."""
    uid = os.getuid() if uid is None else uid
    filesystems = _list(parser, "filesystems")
    places = [key for key in declared_exclusions(filesystems, uid=uid, unescape=True) if key not in shared]
    control = escapes(parser)
    if control or any(_base(key) in PARENTS for key in filesystems):
        places += [key for key in CORE if key not in places]
    if control:
        # Full control: the covers stay against casual access; the rest of the guard is moot for it,
        # and cancelling its other places would only break it.
        return list(dict.fromkeys(places)), []
    writable = []
    for key in filesystems:
        place, mode = _split_mode(key)
        if mode == "ro":
            continue
        if place == "home":
            writable.append(str(Path.home()))
            continue
        if place in _HOST_PLACES:
            writable.append(_HOST_PLACES[place])
            continue
        path = _resolve(_unescape(place), uid)
        if path:
            writable.append(os.path.normpath(path))
    own = os.path.normpath(str(Path.home() / ".var/app" / app))
    writable.append(own)
    for key in filesystems:
        place = _base(key)
        if place in shared or place in places:
            continue
        path = _resolve(_unescape(place), uid)
        if not path:
            continue
        parent = os.path.dirname(os.path.normpath(path))
        if any(parent == root or parent.startswith(root.rstrip("/") + "/") for root in writable):
            places.append(place)
    if locks is not None and not escapes(parser):
        # user-dirs.dirs decides where xdg-download and the others land: an application that can
        # write it (by its own name or under a place it may write) gets it read-only; while it could
        # still write it (not locked yet), none of its XDG user folders are trusted either.
        dirs = [os.path.normpath(_resolve(name, uid)) for name in USER_DIRS_FILES]
        reach = [path for path in dirs if any(path == root or path.startswith(root.rstrip("/") + "/")
                                              for root in writable)]
        defaults = [os.path.normpath(_resolve(name, uid)) for name in DEFAULT_APP_FILES]
        if any(any(path == root or path.startswith(root.rstrip("/") + "/") for root in writable) for path in defaults):
            locks.extend(DEFAULT_APP_FILES)
        if reach:
            locks.extend(USER_DIRS_FILES)
            locked = all(f"{name}:ro" in filesystems for name in USER_DIRS_FILES)
            if not locked:
                places += [_base(key) for key in filesystems
                           if _base(key).split("/", 1)[0] in _USER_DIRS and _base(key) not in places]
    names = []
    if not escapes(parser):
        names = list(STORE_NAMES)
        if parser.has_section("Session Bus Policy"):
            for rule, value in parser.items("Session Bus Policy"):
                reaches = rule.startswith("org.freedesktop.impl.portal.") or \
                    _covers(rule, "org.freedesktop.impl.portal.PermissionStore")
                if reaches and _POLICY.get(value.strip(), 0) >= _POLICY["see"] and rule not in names:
                    names.append(rule)
    return list(dict.fromkeys(places)), names


SUNO_BUS_NAMESPACES = ("org.projectSuno", "org.projectSuno", "io.Suno")


def _rule_name(rule: str) -> str:
    return rule[:-2] if rule.endswith(".*") else rule


def _covers_Suno(rule: str) -> bool:
    """A bus policy key that reaches a name of Suno's own (the same test as Depot review's)."""
    name = _rule_name(rule.strip()).lower()
    return name in ("*", "") or any(name == space or name.startswith(space + ".") or space.startswith(name + ".")
                                    for space in SUNO_BUS_NAMESPACES)


def squatted(app: str, parser: configparser.ConfigParser, *, first_party: bool | None = None) -> list[str]:
    """Bus names to take away (policy none) from an application not of Suno's origin, whatever
    else it may keep: owning a hard-reserved name, or the namespace above one (it could answer for
    the desktop, its portals, its keyring or Suno's services if it started first), and talking to
    or seeing Suno's own services. The application's own ID, which flatpak lets it own whatever
    its override says, is refused at install (``reserved_id``)."""
    if first_party is None:
        first_party = Suno_origin(app)
    if first_party or not parser.has_section("Session Bus Policy"):
        return []
    found = []
    for rule, value in parser.items("Session Bus Policy"):
        policy = _POLICY.get(value.strip(), 0)
        if policy >= _POLICY["own"] and (rule.strip() == "*" or reserved_tier(_rule_name(rule.strip())) == "hard"):
            found.append(rule)
        elif policy >= _POLICY["see"] and _covers_Suno(rule):
            found.append(rule)
    return found


def without(parser: configparser.ConfigParser, names: list[str]) -> configparser.ConfigParser:
    """The permissions as they are once ``names`` are taken away (policy none): what the guard
    judges an application by after the names it may not reach are gone."""
    if not names or not parser.has_section("Session Bus Policy"):
        return parser
    copy = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
    copy.optionxform = str  # type: ignore[assignment]
    copy.read_dict({section: dict(parser.items(section)) for section in parser.sections()})
    for name in names:
        if copy.has_option("Session Bus Policy", name):
            copy.set("Session Bus Policy", name, "none")
    return copy


def _write_cancellations(app: str, places: list[str], names: list[str], data_home: Path, *, runner,
                         locks: list[str] = ()) -> list[str]:
    """Only what the application's override does not already take away, in one flatpak override."""
    override = data_home / "flatpak" / "overrides" / app
    present = set(current(override))
    policy = _bus_policy(override)
    absent = [place for place in places if f"!{place}" not in present and place not in locks]
    silent = [name for name in names if policy.get(name) != "none"]
    readonly = [name for name in dict.fromkeys(locks) if f"{name}:ro" not in present]
    if not absent and not silent and not readonly:
        return []
    done = runner(["flatpak", "override", "--user", *[f"--nofilesystem={place}" for place in absent],
                   *[f"--filesystem={name}:ro" for name in readonly],
                   *[f"--no-talk-name={name}" for name in silent], app], capture_output=True, text=True, timeout=60)
    if done.returncode:
        raise OSError(f"flatpak override {app}: {(done.stderr or '').strip()[-300:]}")
    return [*absent, *[f"{name}:ro" for name in readonly], *silent]


def _locked_state(data_home: Path, app: str) -> Path:
    return data_home / "Suno/installer/flatpak-guard/locked" / f"{app}.json"


def lock_down(app: str, data_home: Path, *, runner=subprocess.run, reason: str = "") -> list[str]:
    """Everything guarded taken away from ``app`` until a later run can read it again: every
    guarded place, the covers, the store names, user-dirs read-only. What this adds is kept,
    so that the run that verifies the application gives back exactly that."""
    warn(f"{app}: {reason or 'its permissions could not be read'}; locked down until they can be")
    override = data_home / "flatpak" / "overrides" / app
    before_places = set(current(override))
    before_names = _bus_policy(override)
    written = _write_cancellations(app, list(dict.fromkeys([*guarded(), *CORE])), list(STORE_NAMES), data_home,
                                   runner=runner, locks=list(LOCKED_FILES))
    state = _locked_state(data_home, app)
    try:
        previous = json.loads(state.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = {}
    added = {"places": sorted({*previous.get("places", []),
                               *[item for item in written if "/" in item and not item.endswith(":ro")
                                 and f"!{item}" not in before_places]}),
             "ro": sorted({*previous.get("ro", []), *[item for item in written if item.endswith(":ro")
                                                     and item not in before_places]}),
             "names": sorted({*previous.get("names", []), *[item for item in written if "/" not in item
                                                           and before_names.get(item) != "none"]})}
    state.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    state.write_text(json.dumps(added), encoding="utf-8")
    return written


def _release_lock(app: str, data_home: Path, keep: set[str]) -> None:
    """A verified run: what a lock-down added and the verified guard does not need goes again."""
    state = _locked_state(data_home, app)
    try:
        added = json.loads(state.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    from .flatpak_permissions import _keyfile, _write_atomically
    override = data_home / "flatpak" / "overrides" / app
    try:
        parser = _keyfile(override.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, configparser.Error):
        parser = None
    if parser is not None:
        drop = {f"!{place}" for place in added.get("places", []) if place not in keep} | \
               {item for item in added.get("ro", []) if item not in keep}
        if parser.has_section("Context"):
            items = [item for item in parser.get("Context", "filesystems", fallback="").split(";") if item]
            parser.set("Context", "filesystems", ";".join(item for item in items if item not in drop) + ";")
        if parser.has_section("Session Bus Policy"):
            for name in added.get("names", []):
                if name not in keep and parser.has_option("Session Bus Policy", name):
                    parser.remove_option("Session Bus Policy", name)
        from io import StringIO
        stream = StringIO()
        parser.write(stream, space_around_delimiters=False)
        _write_atomically(override, stream.getvalue())
    state.unlink(missing_ok=True)


def _bus_policy(path: Path) -> dict[str, str]:
    parser = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
    parser.optionxform = str  # type: ignore[assignment]
    try:
        parser.read_string(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, configparser.Error):
        return {}
    return dict(parser.items("Session Bus Policy")) if parser.has_section("Session Bus Policy") else {}


def guard_application(app: str, installations: list, shared: tuple[str, ...] = (), *,
                      runner=subprocess.run, data_home: Path | None = None, store=None) -> list[str]:
    """Take away, in the application's own override, what flatpak would give it that it may not have.

    ``installations``: its refs as (ref, installation), or plain installation
    names (then the ID is the ref). Read as flatpak merges and spells it, so no
    spelling, escape, runtime or branch hides a place. A ref flatpak cannot
    describe (an error, a timeout) locks the application down (``lock_down``)
    and raises, so the run is retried; a later run that reads it gives back
    what the lock-down added."""
    data_home = data_home or Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")
    places: list[str] = []
    names: list[str] = []
    locks: list[str] = []
    control = False  # disclosed as full control (store flag)
    escape = False   # the guard keeps only its covers
    squats: list[str] = []  # reserved names it may not own or Suno services it may not reach
    for entry in installations:
        ref, installation = entry if isinstance(entry, tuple) else (app, entry)
        try:
            parser = permissions(ref, installation, runner=runner)
        except (OSError, configparser.Error, subprocess.SubprocessError) as error:
            lock_down(app, data_home, runner=runner, reason=f"{ref}: {error}")
            raise OSError(f"{app}: locked down: {error}") from error
        first = Suno_origin(app, data_home)
        taken = squatted(app, parser, first_party=first)
        squats += taken
        # Disclosed by what it declares; guarded by what it keeps (an escape that went with a
        # taken name is not one: the full guard applies).
        control = control or full_control(parser, app, first_party=first)
        parser = without(parser, taken)
        found_places, found_names = cancellations(app, parser, shared, locks=locks)
        places += found_places
        names += found_names
        from .flatpak_permissions import FIRST_PARTY
        if not first and app.startswith(FIRST_PARTY):
            # A Suno name without Suno's origin (a user copy that appeared later, a sideloaded bundle) gets
            # the protected-path exclusions an override written for Suno's own copy left out.
            from .flatpak_permissions import exclusions
            for argument in exclusions(app, _list(parser, "filesystems")):
                if argument.startswith("--nofilesystem="):
                    places.append(argument.split("=", 1)[1])
                elif argument.startswith("--filesystem=") and argument.endswith(":ro"):
                    locks.append(argument.split("=", 1)[1][:-3])
        escape = escape or escapes(parser)
    if store is not None:
        try:
            if control:
                store.store.set("Suno", "full-control", app, ["yes"])
            else:
                store.store.delete("Suno", "full-control", app)
        except Exception:  # noqa: BLE001 - guarded all the same
            pass
    if escape:
        names = []
    names += squats  # even for an application that escapes: no reserved name answers for it
    places, names, locks = list(dict.fromkeys(places)), list(dict.fromkeys(names)), list(dict.fromkeys(locks))
    _release_lock(app, data_home, {*places, *names, *[f"{name}:ro" for name in locks]})
    return _write_cancellations(app, places, names, data_home, runner=runner, locks=locks)


def assert_applications(*, runner=subprocess.run, data_home: Path | None = None, store=None) -> dict[str, list[str]]:
    """Every installed Flatpak, every branch and installation: Suno's recorded access first (an
    override wider than it is narrowed back: ``flatpak_permissions.reassert``), then the guard.
    An application that fails is reported and the others are still guarded."""
    from .flatpak_permissions import _APP_ID, reassert
    data_home = data_home or Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")
    ensure_user_dirs()
    ensure_default_apps()
    known = installed(data_home)
    added: dict[str, list[str]] = {}
    failed: list[str] = []
    by_app: dict[str, list[tuple[str, str]]] = {}
    try:
        for app, ref, installation in refs(runner=runner):
            by_app.setdefault(app, []).append((ref, installation))
    except (OSError, subprocess.SubprocessError) as error:
        # Nothing can be read: every application found on disk is locked down.
        for app in sorted(known):
            if not _APP_ID.fullmatch(app):
                continue
            try:
                added[app] = lock_down(app, data_home, runner=runner, reason=f"flatpak list: {error}")
            except (OSError, subprocess.SubprocessError) as failure:
                warn(f"{app}: could not be locked down: {failure}")
            failed.append(app)
        raise OSError(f"not guarded (flatpak list failed): {', '.join(failed) or 'none found'}") from error
    shared_of = {app: shared for app, (_texts, shared, _where) in known.items()}
    forget_removed(set(by_app) | set(known), data_home)
    for app, entries in sorted(by_app.items()):
        if not _APP_ID.fullmatch(app):
            continue
        try:
            reassert(app, store=store, runner=runner)
            names = guard_application(app, entries, shared_of.get(app, ()), runner=runner, data_home=data_home,
                                      store=store)
            if names:
                added[app] = names
        except (OSError, subprocess.SubprocessError, ValueError) as error:
            warn(f"{app}: {error}")
            failed.append(app)
    if failed:
        raise OSError(f"not guarded: {', '.join(failed)}")
    return added


def forget_removed(present: set[str], data_home: Path) -> list[str]:
    """Applications removed by any tool: Suno's override, backup and records about them go
    (``flatpak_permissions.forget``); nothing is written for an application that is gone."""
    from .flatpak_permissions import forget
    gone = []
    for root in (data_home / "Suno/installer/permission-backups", data_home / "Suno/installer/flatpak-guard/locked"):
        for path in sorted(root.glob("*.json")) if root.is_dir() else []:
            app = path.name[:-len(".Suno.json")] if path.name.endswith(".Suno.json") else path.stem
            if app not in present and app not in gone:
                gone.append(app)
    for app in gone:
        forget(app, installed=False)
    return gone


DEFAULT_USER_DIRS = """XDG_DESKTOP_DIR="$HOME/Desktop"
XDG_DOWNLOAD_DIR="$HOME/Downloads"
XDG_TEMPLATES_DIR="$HOME/Templates"
XDG_PUBLICSHARE_DIR="$HOME/Public"
XDG_DOCUMENTS_DIR="$HOME/Documents"
XDG_MUSIC_DIR="$HOME/Music"
XDG_PICTURES_DIR="$HOME/Pictures"
XDG_VIDEOS_DIR="$HOME/Videos"
"""


def ensure_user_dirs() -> None:
    """user-dirs.dirs exists, so its read-only bind exists in every sandbox and no application
    can create it (the defaults, as xdg-user-dirs writes them)."""
    path = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config") / "user-dirs.dirs"
    if path.exists():
        return
    try:
        subprocess.run(["xdg-user-dirs-update"], capture_output=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        pass
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(DEFAULT_USER_DIRS, encoding="utf-8")


DEFAULT_APPS = "[Default Applications]\n"


def ensure_default_apps() -> None:
    """mimeapps.list and the desktop's own list exist, so their read-only binds exist in every
    sandbox that could write them, and no application can create one (empty: GIO's defaults)."""
    roots = {"xdg-config": Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config"),
             "xdg-data": Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")}
    for name in DEFAULT_APP_FILES:
        root, relative = name.split("/", 1)
        path = roots[root] / relative
        if path.exists() or path.is_symlink():
            continue
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "x", encoding="utf-8") as stream:
                stream.write(DEFAULT_APPS)
        except OSError:
            pass


def installations_of(app: str, data_home: Path | None = None, *, runner=subprocess.run) -> tuple[list, tuple[str, ...]]:
    """The application's refs as (ref, installation), and what it may keep inside a guarded place."""
    found = installed(data_home).get(app)
    try:
        entries = [(ref, installation) for name, ref, installation in refs(runner=runner) if name == app]
    except OSError:
        entries = list(found[2]) if found else []
    return entries, (found[1] if found else ())


def global_override(data_home: Path | None = None) -> Path:
    data_home = data_home or Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")
    return data_home / "flatpak" / "overrides" / "global"


def current(path: Path) -> list[str]:
    """The filesystems entries of a Flatpak override file ("!" marks a removal)."""
    parser = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
    parser.optionxform = str  # type: ignore[assignment]
    try:
        parser.read_string(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, configparser.Error):
        return []
    value = parser.get("Context", "filesystems", fallback="")
    return [item.strip() for item in value.split(";") if item.strip()]


def missing(path: Path | None = None) -> list[str]:
    entries = set(current(path or global_override()))
    return [place for place in guarded() if f"!{place}" not in entries]


def record_covers(*, uid: int | None = None) -> set[str]:
    """Every spelling of Flatpak's instance-record folder (see RECORDS)."""
    return set(guarded(uid=uid, records=True)) - set(guarded(uid=uid))


def drop_record_covers(path: Path | None = None) -> list[str]:
    """Take out the instance-record covers an earlier guard wrote into the global
    override (they stop every Flatpak from starting). Returns what was removed."""
    path = path or global_override()
    try:
        text = path.read_text(encoding="utf-8")
        parser = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
        parser.optionxform = str  # type: ignore[assignment]
        parser.read_string(text)
    except (OSError, UnicodeError, configparser.Error):
        return []
    entries = [item.strip() for item in parser.get("Context", "filesystems", fallback="").split(";") if item.strip()]
    stale = {f"!{place}" for place in record_covers()}
    removed = [item for item in entries if item.rstrip("/") in stale]
    if not removed:
        return []
    kept = [item for item in entries if item not in removed]
    if kept:
        parser.set("Context", "filesystems", ";".join(kept) + ";")
    else:
        parser.remove_option("Context", "filesystems")
    from io import StringIO
    stream = StringIO()
    parser.write(stream, space_around_delimiters=False)
    temporary = path.with_name(f".{path.name}.Suno-guard")
    temporary.write_text(stream.getvalue(), encoding="utf-8")
    os.replace(temporary, path)
    return [item[1:] for item in removed]


def assert_global(*, runner=subprocess.run, path: Path | None = None) -> list[str]:
    """Add whatever guarded place this person's global override lacks. Returns what was added."""
    drop_record_covers(path)
    absent = missing(path)
    if not absent:
        return []
    done = runner(["flatpak", "override", "--user", *[f"--nofilesystem={place}" for place in absent]],
                  capture_output=True, text=True, timeout=60)
    if done.returncode:
        raise OSError(f"flatpak override: {(done.stderr or '').strip()[-300:]}")
    return absent


def _store():
    """The permission store, for Suno's recorded access; None without a session."""
    try:
        from .app_permissions import Permissions, PortalStore
        return Permissions(PortalStore())
    except Exception:  # noqa: BLE001 - guarded all the same, only not put back to Suno's record
        return None


def refresh() -> None:
    """After Suno installs or updates a Flatpak: the guard, before it can start. Never raises."""
    try:
        assert_global()
        assert_applications(store=_store())
    except (OSError, subprocess.SubprocessError, ImportError) as error:
        print(f"Suno-flatpak-guard: {error}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    code = 0
    try:
        added = assert_global()
        if added:
            print(f"Suno-flatpak-guard: kept from every Flatpak: {', '.join(added)}")
    except (OSError, subprocess.SubprocessError) as error:
        print(f"Suno-flatpak-guard: {error}", file=sys.stderr)
        code = 1
    try:
        for app, names in assert_applications(store=_store()).items():
            print(f"Suno-flatpak-guard: kept from {app}: {', '.join(names)}")
    except (OSError, subprocess.SubprocessError) as error:
        print(f"Suno-flatpak-guard: {error}", file=sys.stderr)
        code = 1
    return code


if __name__ == "__main__":
    sys.exit(main())
