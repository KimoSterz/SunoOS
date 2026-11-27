# SPDX-License-Identifier: Apache-2.0
"""A Flatpak's file access as a Suno file level (ADR-052, "What each format becomes").

A bundle's ``home`` or ``host`` request is the level "all files"; ``xdg-music``
and the like are "these folders"; anything else is the file picker. Suno
narrows a Flatpak only by excluding the protected paths (keys, keyrings,
browser profiles, other applications' data, sign-in scripts), never by taking
``home`` away: Flatpak puts an empty temporary folder where access was removed,
and the application's saves would vanish there. ``host`` becomes ``home`` plus
the removable-drive roots, because ``host`` also shows the whole system under
``/run/host/root``, where an exclusion cannot reach.

Widening (a folder, all files) and Suno's own exclusions are user overrides,
made with ``flatpak override --user`` after the person's previous override is
backed up once (``valet_permissions``). A change rebuilds the override from
that backup plus Suno's current choices, so removing a folder Suno added
removes exactly that line and nothing is ever hidden with an empty folder.
"""
from __future__ import annotations

import configparser
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from .errors import InstallerError
from .permission_views import PROTECTED, PROTECTED_FILES

_APP_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,254}\Z")
_XDG = {"Desktop": "xdg-desktop", "Documents": "xdg-documents", "Downloads": "xdg-download", "Music": "xdg-music",
        "Pictures": "xdg-pictures", "Public": "xdg-public-share", "Templates": "xdg-templates", "Videos": "xdg-videos"}
REMOVABLE = ("/media", "/run/media", "/mnt")
_RANK = {"chooser": 0, "folders": 1, "all": 2}
# Suno's own system apps (Depot is the installer and reads its records) keep
# what their signed manifests declare.
FIRST_PARTY = ("org.projectSuno.", "io.Suno.")


def _data_home() -> Path:
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")


def declared_metadata(app_id: str, runner=subprocess.run) -> str:
    """The installed bundle's own metadata (not its overrides)."""
    try:
        done = runner(["flatpak", "info", "--show-metadata", app_id], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return done.stdout if done.returncode == 0 else ""


def declared_filesystems(app_id: str, runner=subprocess.run) -> list[str]:
    """What the installed bundle itself asks for (its metadata, not overrides)."""
    return filesystems_from_metadata(declared_metadata(app_id, runner))


_FS_RANK = {"ro": 0, "create": 1, "rw": 2}
_BUS_RANK = {"none": 0, "see": 1, "talk": 2, "own": 3}
_LISTS = ("filesystems", "shared", "sockets", "devices", "features", "persistent")


def _keyfile(text: str) -> configparser.ConfigParser:
    parser = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
    parser.optionxform = str  # type: ignore[assignment]
    parser.read_string(text)
    return parser


def _fs_mode(item: str) -> tuple[str, int]:
    for mode in ("ro", "create", "rw"):
        if item.endswith(":" + mode):
            return item[: -len(mode) - 1], _FS_RANK[mode]
    return item, _FS_RANK["rw"]


def narrow_override(original: str | None, metadata: str) -> str | None:
    """The person's override as Suno may restore it: never wider than the bundle's own metadata.

    The backup lives in the person's data folder, which an application might
    have been able to write. Restoring it may only take things away: removals
    ("!...", "none") stay, and anything given is kept only where the metadata
    gives the same thing at least as widely. host, home, a bus name, a device
    the bundle never asked for are dropped."""
    if original is None:
        return None
    try:
        given, declared = _keyfile(original), _keyfile(metadata)
    except configparser.Error:
        return None
    out = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
    out.optionxform = str  # type: ignore[assignment]
    if given.has_section("Context"):
        kept: dict[str, str] = {}
        for key in _LISTS:
            items = [item.strip() for item in given.get("Context", key, fallback="").split(";") if item.strip()]
            allowed = [item.strip() for item in declared.get("Context", key, fallback="").split(";") if item.strip()]
            keep = []
            for item in items:
                if item.startswith("!") or key == "persistent":
                    keep.append(item)
                elif key == "filesystems":
                    base, rank = _fs_mode(item)
                    if any(_fs_mode(other)[0] == base and _fs_mode(other)[1] >= rank for other in allowed):
                        keep.append(item)
                elif item in allowed:
                    keep.append(item)
            if keep:
                kept[key] = ";".join(keep) + ";"
        if kept:
            out["Context"] = kept
    for section in ("Session Bus Policy", "System Bus Policy"):
        if not given.has_section(section):
            continue
        kept = {}
        for name, value in given.items(section):
            ceiling = declared.get(section, name, fallback="none") if declared.has_section(section) else "none"
            if _BUS_RANK.get(value.strip(), 99) <= _BUS_RANK.get(ceiling.strip(), 0):
                kept[name] = value.strip()
        if kept:
            out[section] = kept
    if given.has_section("Environment"):
        out["Environment"] = dict(given.items("Environment"))  # inside the sandbox only
    if not out.sections():
        return ""
    from io import StringIO
    stream = StringIO()
    out.write(stream, space_around_delimiters=False)
    return stream.getvalue()


def filesystems_from_metadata(text: str) -> list[str]:
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string(text)
    except configparser.Error:
        return []
    value = parser.get("Context", "filesystems", fallback="")
    return [item.strip() for item in value.split(";") if item.strip() and not item.strip().startswith("!")]


def level(filesystems: list[str]) -> tuple[str, list[str]]:
    """The Suno file level and named folders a list of Flatpak filesystems amounts to."""
    folders: list[str] = []
    for item in filesystems:
        base = item.split(":")[0]
        if base in {"home", "host", "host-os"} or base in {"~", "~/"} or base.startswith(("/home", "/var/home")):
            return "all", []
        for name, xdg in _XDG.items():
            if base == xdg or base.startswith(xdg + "/"):
                folders.append(name)
        if base.startswith("~/") and "/" not in base[2:].strip("/") and not base[2:].startswith("."):
            folders.append(base[2:].strip("/"))
    folders = list(dict.fromkeys(folders))
    return ("folders" if folders else "chooser"), folders


def exclusions(app_id: str, declared: list[str]) -> list[str]:
    """``flatpak override`` arguments that keep protected paths out of a bundle with home access."""
    arguments: list[str] = []
    broad = level(declared)[0] == "all"
    if not broad:
        return arguments
    if app_id.startswith(FIRST_PARTY):
        # Suno's own system applications keep what their signed manifests declare: by origin only
        # (the pinned Suno remote, system-wide), never by name.
        from .flatpak_guard import Suno_origin
        if Suno_origin(app_id):
            return arguments
    for path in PROTECTED:
        if app_id in path:
            continue  # its own data
        if path in PROTECTED_FILES:
            arguments.append(f"--filesystem=~/{path}:ro")
        else:
            arguments.append(f"--nofilesystem=~/{path}")
    if any(item.split(":")[0] == "host" for item in declared):
        arguments.extend(("--nofilesystem=host", "--filesystem=home"))
        arguments.extend(f"--filesystem={root}" for root in REMOVABLE)
    return arguments


def grants(level_name: str, folders: list[str]) -> list[str]:
    if level_name == "all":
        return ["--filesystem=home"]
    if level_name == "folders":
        return [f"--filesystem={_XDG.get(name, '~/' + name)}" for name in folders]
    return []


def _state_path(app_id: str) -> Path:
    return _data_home() / "Suno" / "installer" / "permission-backups" / f"{app_id}.Suno.json"


def apply(app_id: str, level_name: str, folders: list[str], *, runner=subprocess.run, declared: list[str] | None = None,
          force: bool = False) -> list[str]:
    """Make the Flatpak's override say exactly: the person's own override, Suno's exclusions, Suno's grants."""
    if not _APP_ID.fullmatch(app_id):
        raise InstallerError("The Flatpak application ID is invalid.")
    from .valet_permissions import _backup_once
    metadata = declared_metadata(app_id, runner)
    declared = filesystems_from_metadata(metadata) if declared is None else declared
    declared_level, _ = level(declared)
    if _RANK.get(level_name, 0) < _RANK[declared_level]:
        # Narrower than the bundle needs: Flatpak would hide its folders behind
        # empty ones. Keep its declared level; exclusions still apply.
        level_name = declared_level
    root = _data_home()
    _backup_once(app_id, root)
    backup = json.loads((root / "Suno/installer/permission-backups" / f"{app_id}.json").read_text(encoding="utf-8"))
    override = root / "flatpak" / "overrides" / app_id
    arguments = [*exclusions(app_id, declared), *grants(level_name, folders)]
    wanted = {"arguments": arguments}
    state = _state_path(app_id)
    try:
        recorded = json.loads(state.read_text(encoding="utf-8"))
        if not force and {"arguments": recorded.get("arguments")} == wanted and \
                recorded.get("override_sha256") == _digest(override):
            return arguments
    except (OSError, ValueError, AttributeError):
        pass
    text = _planned_override(app_id, override, narrow_override(backup.get("original_override"), metadata),
                             arguments, runner=runner)
    _write_atomically(override, text)
    state.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    state.write_text(json.dumps({**wanted, "override_sha256": _digest(override)}), encoding="utf-8")
    return arguments


def _planned_override(app_id: str, override: Path, original: str | None, arguments: list[str], *,
                      runner=subprocess.run) -> str:
    """The whole override, composed before anything is written: the person's own (narrowed),
    removals already there, Suno's lines, and what the guard takes away, by flatpak's spelling
    (``flatpak_guard.cancellations``, read before writing so no start sees a wider override)."""
    from .flatpak_guard import (CORE, LOCKED_FILES, STORE_NAMES, cancellations, escapes, guarded, squatted, without,
                                installations_of, permissions, warn)
    try:
        entries, shared = installations_of(app_id, runner=runner)
    except (OSError, subprocess.SubprocessError):
        entries, shared = [], ()
    places: list[str] = []
    names: list[str] = []
    locks: list[str] = []
    squats: list[str] = []
    control = False
    closed = not entries
    for ref, installation in entries:
        try:
            parser = permissions(ref, installation, runner=runner)
        except (OSError, configparser.Error, subprocess.SubprocessError) as error:
            warn(f"{app_id}: {ref}: {error}; written locked down")
            closed = True
            continue
        taken = squatted(app_id, parser)
        squats += taken
        parser = without(parser, taken)  # judged by what it keeps
        found_places, found_names = cancellations(app_id, parser, shared, locks=locks)
        places += found_places
        names += found_names
        control = control or escapes(parser)
    if closed:  # fail closed: the guard's next run gives back what it can verify
        places += [*guarded(), *CORE]
        names += list(STORE_NAMES)
        locks += list(LOCKED_FILES)
        control = False
    from .flatpak_guard import record_covers
    stale = record_covers() - set(places)  # an earlier guard's cover; stops the start
    existing = [item[1:] for item in _items(_read(override), "filesystems")
                if item.startswith("!") and item[1:].rstrip("/") not in stale]
    return compose(original, arguments, places, [*([] if control else names), *squats], existing, read_only=locks,
                   dropped=stale)


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return ""


def _items(text: str, key: str) -> list[str]:
    try:
        parser = _keyfile(text)
    except configparser.Error:
        return []
    return [item.strip() for item in parser.get("Context", key, fallback="").split(";") if item.strip()]


def compose(original: str | None, arguments: list[str], removed: list[str], silenced: list[str],
            kept_removals: list[str], read_only: list[str] = (), dropped: set[str] = frozenset()) -> str:
    """An override as ``flatpak override`` would leave it, built in one go."""
    from .flatpak_guard import _base
    try:
        parser = _keyfile(original or "")
    except configparser.Error:
        parser = _keyfile("")
    filesystems = [item.strip() for item in parser.get("Context", "filesystems", fallback="").split(";")
                   if item.strip() and not (item.strip().startswith("!") and item.strip()[1:].rstrip("/") in dropped)]
    if not filesystems and parser.has_option("Context", "filesystems"):
        parser.remove_option("Context", "filesystems")

    def put(item: str) -> None:
        base = _base(item.lstrip("!"))
        filesystems[:] = [entry for entry in filesystems if _base(entry.lstrip("!")) != base]
        filesystems.append(item)
    granted = {_base(argument.split("=", 1)[1]) for argument in arguments if argument.startswith("--filesystem=")}
    for place in kept_removals:
        if _base(place) not in granted:
            put("!" + place)
    for argument in arguments:
        if argument.startswith("--filesystem="):
            put(argument.split("=", 1)[1])
        elif argument.startswith("--nofilesystem="):
            put("!" + argument.split("=", 1)[1])
    for place in removed:
        if place not in read_only:
            put("!" + place)
    for place in dict.fromkeys(read_only):
        put(place + ":ro")
    if filesystems:
        if not parser.has_section("Context"):
            parser.add_section("Context")
        parser.set("Context", "filesystems", ";".join(filesystems) + ";")
    if silenced:
        if not parser.has_section("Session Bus Policy"):
            parser.add_section("Session Bus Policy")
        for name in silenced:
            parser.set("Session Bus Policy", name, "none")
    from io import StringIO
    stream = StringIO()
    parser.write(stream, space_around_delimiters=False)
    return stream.getvalue()


def _sections(text: str) -> dict[str, dict[str, str]]:
    try:
        parser = _keyfile(text)
    except configparser.Error:
        return {}
    return {section: dict(parser.items(section)) for section in parser.sections()}


def _write_atomically(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.Suno")
    with open(temporary, "w", encoding="utf-8") as stream:
        stream.write(text)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def narrowed(current_text: str, expected_text: str) -> str:
    """``current_text`` cut down to Suno's record (``expected_text``), never widened past either:
    every removal of either stays, a grant stays only where both have it (at the narrower mode),
    bus names at the lower policy of the two."""
    from .flatpak_guard import _base, _split_mode
    try:
        now, wanted = _keyfile(current_text), _keyfile(expected_text)
    except configparser.Error:
        return expected_text
    out = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
    out.optionxform = str  # type: ignore[assignment]
    context: dict[str, str] = {}
    for key in _LISTS:
        mine = [item.strip() for item in now.get("Context", key, fallback="").split(";") if item.strip()]
        theirs = [item.strip() for item in wanted.get("Context", key, fallback="").split(";") if item.strip()]
        removals = list(dict.fromkeys([item for item in [*theirs, *mine] if item.startswith("!")]))
        removed = {_base(item[1:]) if key == "filesystems" else item[1:] for item in removals}
        kept = []
        for item in mine:
            if item.startswith("!"):
                continue
            if key == "filesystems":
                base = _base(item)
                if base in removed:
                    continue
                other = [entry for entry in theirs if not entry.startswith("!") and _base(entry) == base]
                if other:
                    rank = min(_fs_mode(item)[1], _fs_mode(other[0])[1])
                    kept.append(base if rank == _FS_RANK["rw"] else f"{base}:{[m for m, r in _FS_RANK.items() if r == rank][0]}")
            elif item in theirs and item not in removed:
                kept.append(item)
        if removals or kept:
            context[key] = ";".join([*removals, *kept]) + ";"
    if context:
        out["Context"] = context
    for section in ("Session Bus Policy", "System Bus Policy"):
        names = (dict(now.items(section)) if now.has_section(section) else {})
        expected = (dict(wanted.items(section)) if wanted.has_section(section) else {})
        kept = {}
        for name in {*names, *expected}:
            values = [value.strip() for value in (names.get(name), expected.get(name)) if value is not None]
            if "none" in values:
                kept[name] = "none"
            elif len(values) == 2:
                kept[name] = min(values, key=lambda value: _BUS_RANK.get(value, 99))
        if kept:
            out[section] = kept
    if wanted.has_section("Environment"):
        out["Environment"] = dict(wanted.items("Environment"))
    from io import StringIO
    stream = StringIO()
    out.write(stream, space_around_delimiters=False)
    return stream.getvalue()


def _digest(path: Path) -> str:
    import hashlib
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return ""


def reassert(app_id: str, *, store=None, runner=subprocess.run) -> bool:
    """Suno's permission store decides, by narrowing only: an override that changed since Suno
    last wrote it and gives more than Suno's record is cut back to it (one line in the log); one
    that gives less is left as it is. Only apply(), from Settings or Suno-appctl, ever widens.
    True if the override was rewritten."""
    if store is None or not store.store.lookup("Suno", "files").get(app_id):
        return False
    override = _data_home() / "flatpak/overrides" / app_id
    state = _state_path(app_id)
    try:
        recorded = json.loads(state.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        recorded = {}
    if not isinstance(recorded, dict):
        recorded = {}
    if recorded.get("override_sha256") == _digest(override):
        return False
    from .valet_permissions import _backup_once
    metadata = declared_metadata(app_id, runner)
    declared = filesystems_from_metadata(metadata)
    level_name = store.level(app_id)
    declared_level, _ = level(declared)
    if _RANK.get(level_name, 0) < _RANK[declared_level]:
        level_name = declared_level
    root = _data_home()
    _backup_once(app_id, root)
    backup = json.loads((root / "Suno/installer/permission-backups" / f"{app_id}.json").read_text(encoding="utf-8"))
    arguments = [*exclusions(app_id, declared), *grants(level_name, store.named_folders(app_id))]
    expected = _planned_override(app_id, override, narrow_override(backup.get("original_override"), metadata),
                                 arguments, runner=runner)
    current_text = _read(override)
    text = narrowed(current_text, expected)
    rewritten = bool(current_text) and _sections(text) != _sections(current_text)
    if rewritten:
        _write_atomically(override, text)
        print(f"Suno-flatpak-guard: {app_id}: its override gave more than Suno's record and was narrowed back "
              "(change an app's access in Settings or with Suno-appctl)", file=sys.stderr)
    state.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    state.write_text(json.dumps({"arguments": recorded.get("arguments", arguments),
                                 "override_sha256": _digest(override)}), encoding="utf-8")
    return rewritten


def forget(app_id: str, *, installed: bool | None = None, runner=subprocess.run) -> None:
    """The application was removed: nothing of Suno's about it stays.

    Its override goes back to the person's own, narrowed to what the bundle
    declares, while a copy of it is still installed (another installation or
    branch); with the application gone there is nothing to keep it for, and
    Suno's override is deleted. Then the backup, Suno's state and any guard
    lock-down record go."""
    if not _APP_ID.fullmatch(app_id):
        return
    root = _data_home()
    override = root / "flatpak" / "overrides" / app_id
    backup_path = root / "Suno/installer/permission-backups" / f"{app_id}.json"
    if installed is None:
        from .flatpak_guard import installed as installed_apps
        installed = app_id in installed_apps(root)
    try:
        backup = json.loads(backup_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        backup = None
    if isinstance(backup, dict) and "original_override" in backup:
        if installed:
            # The copy that stays keeps the guard's lines: composed as apply() composes.
            original = narrow_override(backup.get("original_override"), declared_metadata(app_id, runner))
            _write_atomically(override, _planned_override(app_id, override, original, [], runner=runner))
        else:
            override.unlink(missing_ok=True)
    elif not installed:
        override.unlink(missing_ok=True)
    for path in (backup_path, _state_path(app_id),
                 root / "Suno/installer/flatpak-guard/locked" / f"{app_id}.json"):
        path.unlink(missing_ok=True)
