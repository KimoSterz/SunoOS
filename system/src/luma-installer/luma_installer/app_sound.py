# SPDX-License-Identifier: Apache-2.0
"""Sound for every application format: play freely, record only with the microphone (ADR-052, Permissions 5).

An application reaches sound through PulseAudio, which every application made
before PipeWire speaks, and PulseAudio's protocol says nothing trustworthy
about who is speaking: a client names itself, and pipewire-pulse lets the
names it sends replace the ones the server set (``PULSE_PROP``). So the
session's PulseAudio socket identifies nobody, and the person's microphone
permission (the portal's devices / microphone row, keyed by the application's
ID) cannot be applied on it.

Each application therefore gets a PulseAudio server of its own,
``luma-application-sound@APP`` (``data/pipewire/luma-application-sound.conf.in``):
a socket-activated pipewire-pulse whose socket is the only PulseAudio socket
the application sees, whose rules give every client the application's ID after
whatever the client sent, and which connects to PipeWire on a socket no
application sees (``pipewire-0-application-pulse``). WirePlumber trusts that
ID on that socket only and applies the permission live
(``data/pipewire/application-sound.lua``): playback as before, recording
refused cleanly until the person allows it, a withdrawal ending a recording
at once. The server also refuses module loading, which on the session's
socket let any application run modules (and write files) outside its sandbox.

* Capsules, store trees and AppImages: the launcher starts the socket and
  mounts it as the application's ``pulse/native`` (``session_boundary``); no
  application is given the session's PulseAudio socket.
* Flatpaks: ``flatpak run`` binds the socket over the path where
  ``--socket=pulseaudio`` would put the session's (``socket APP`` below
  starts it and prints its path). A Flatpak still on the session's socket is
  held to the same permission by the ID pipewire-pulse gives it, which the
  application can overwrite; the bind is what makes it binding.

The server starts on the first connection and stays until the session ends
or the application is removed; an application that makes no sound costs a
listening socket.

Applications installed before this had the microphone through the session's
socket. ``migrate`` keeps it for those that record by what they are (a
Flatpak asking for the PulseAudio socket, a call, chat or recording app);
the rest ask, and Settings shows the switch.
"""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

UNIT = "luma-application-sound"
UNIT_DIRECTORIES = (Path("/usr/lib/systemd/user"), Path("/etc/systemd/user"))
FOLDER = "luma-sound"
_APP = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,254}\Z")

# Kinds of application that record sound by what they are (desktop-file
# categories): calls, meetings, chat, recording and audio production, and web
# browsers, whose sites ask for the microphone themselves.
MICROPHONE_CATEGORIES = frozenset({
    "Telephony", "VideoConference", "Chat", "InstantMessaging", "IRCClient", "Recorder", "Midi", "Mixer",
    "Sequencer", "AudioVideoEditing", "WebBrowser",
})


def valid(app: str) -> bool:
    return bool(_APP.fullmatch(app or "")) and not app.startswith(".")


def escape(app: str) -> str:
    """``systemd-escape APP``: the unit instance for an application ID."""
    out = []
    for index, character in enumerate(app):
        if character == "/":
            out.append("-")
        elif (character.isascii() and (character.isalnum() or character in ":_.")) and not (index == 0 and character == "."):
            out.append(character)
        else:
            out.extend(f"\\x{byte:02x}" for byte in character.encode("utf-8"))
    return "".join(out)


def unit(app: str, kind: str = "socket") -> str:
    return f"{UNIT}@{escape(app)}.{kind}"


def installed(directories=UNIT_DIRECTORIES) -> bool:
    """This system has the per-application server (the package that brings it is installed)."""
    return any((directory / f"{UNIT}@.socket").exists() for directory in directories)


def socket_path(app: str, runtime: Path) -> Path:
    return runtime / FOLDER / app / "native"


def start(app: str, runtime: Path, *, runner=subprocess.run, directories=UNIT_DIRECTORIES) -> Path | None:
    """The application's own PulseAudio socket, listening; None when this system has none."""
    if not valid(app) or not installed(directories):
        return None
    path = socket_path(app, runtime)
    try:
        runner(["systemctl", "--user", "start", unit(app)], capture_output=True, text=True, timeout=20, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return path if path.is_socket() else None


def disable(app: str, *, runner=subprocess.run) -> None:
    """The application was removed: its socket, server and folder go (the socket's ExecStopPost)."""
    if not valid(app):
        return
    try:
        runner(["systemctl", "--user", "disable", "--now", unit(app), unit(app, "service")], capture_output=True,
               text=True, timeout=30, check=False)
    except (OSError, subprocess.TimeoutExpired):
        pass


def suggests_microphone(categories) -> bool:
    return bool(MICROPHONE_CATEGORIES.intersection(categories or ()))


def flatpak_asks(sockets: list[str], filesystems: list[str]) -> bool:
    """A Flatpak that can record today: the PulseAudio socket or PipeWire's."""
    return "pulseaudio" in sockets or any(item.split(":")[0] in {"xdg-run/pipewire-0", "xdg-run/pipewire-0/"}
                                         for item in filesystems)


def _state_home() -> Path:
    return Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local/state")


MIGRATED = "luma/application-sound-1"


def migrate(model=None, *, records=None, flatpaks=None, metadata=None, categories=None) -> list[str]:
    """Once per account: keep the microphone for applications installed before it was a permission.

    Returns the IDs it allowed. ``metadata(app) -> (sockets, filesystems)`` for
    a Flatpak; ``categories(app, record) -> [...]`` for the rest.
    """
    from . import app_permissions
    stamp = _state_home() / MIGRATED
    if stamp.exists():
        return []
    model = model or app_permissions.Permissions(app_permissions.PortalStore())
    records = app_permissions.installed_records() if records is None else records
    flatpaks = app_permissions.flatpak_apps() if flatpaks is None else flatpaks
    metadata = metadata or _flatpak_metadata
    categories = categories or _launcher_categories
    table, entry = app_permissions.PORTAL_DEVICES["microphone"]
    rows = model.store.lookup(table, entry)
    allowed = []
    for app, record in {**records, **flatpaks}.items():
        if app in rows:
            continue  # the person (or the portal) already answered
        if record.get("format") == "flatpak":
            asks = flatpak_asks(*metadata(app))
        else:
            asks = "microphone" in model.store.lookup(app_permissions.TABLE, "uses").get(app, []) or \
                suggests_microphone(categories(app, record))
        if asks:
            model.set_device(app, "microphone", True)
            allowed.append(app)
    stamp.parent.mkdir(parents=True, exist_ok=True)
    stamp.write_text("\n".join(allowed) + "\n", encoding="utf-8")
    return allowed


def _flatpak_metadata(app: str) -> tuple[list[str], list[str]]:
    import configparser
    try:
        done = subprocess.run(["flatpak", "info", "--show-metadata", app], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return [], []
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string(done.stdout if done.returncode == 0 else "")
    except configparser.Error:
        return [], []
    split = lambda key: [item for item in parser.get("Context", key, fallback="").split(";") if item]  # noqa: E731
    return split("sockets"), split("filesystems")


def _launcher_categories(app: str, _record: dict) -> list[str]:
    from .desktop import applications_root
    try:
        text = (applications_root() / f"{app}.desktop").read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    for line in text.splitlines():
        if line.startswith("Categories="):
            return [item for item in line[len("Categories="):].split(";") if item]
    return []


def main(argv: list[str] | None = None) -> int:
    """``socket APP``: start APP's server socket and print its path (for flatpak run). ``migrate``."""
    import sys
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) == 2 and argv[0] == "socket":
        runtime = Path(os.environ.get("XDG_RUNTIME_DIR") or f"/run/user/{os.getuid()}")
        path = start(argv[1], runtime)
        if path is None:
            return 1
        print(path)
        return 0
    if argv == ["migrate"]:
        for app in migrate():
            print(f"microphone kept for {app}")
        return 0
    print("usage: python3 -m luma_installer.app_sound socket APP | migrate", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
