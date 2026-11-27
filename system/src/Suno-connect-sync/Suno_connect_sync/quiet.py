# SPDX-License-Identifier: Apache-2.0
"""Quiet points (ADR-054 §4.3): an app's folder is touched only while the app
is closed and 20 seconds have passed with no new launch.

Flatpak instances are read from ``$XDG_RUNTIME_DIR/.flatpak/<instance>``
(what ``flatpak ps`` reads); ADR-052 store apps hold a shared lock on
``$XDG_RUNTIME_DIR/Suno-apps/<id>/.running`` while any launcher runs them.
"""
from __future__ import annotations

import configparser
import fcntl
import json
import os
import threading
import time
from pathlib import Path

from .appdata import QUIET_SECONDS


def runtime_dir() -> Path:
    return Path(os.environ.get("XDG_RUNTIME_DIR") or f"/run/user/{os.getuid()}")


def _flatpak_app(instance: Path) -> str:
    try:
        info = configparser.ConfigParser(strict=False, interpolation=None)
        info.read(instance / "info")
        return info.get("Application", "name", fallback="")
    except (OSError, configparser.Error):
        return ""


def _flatpak_pid(instance: Path) -> int:
    try:
        return int(json.loads((instance / "bwrapinfo.json").read_text()).get("child-pid") or 0)
    except (OSError, ValueError, AttributeError):
        return 0


def running_flatpaks() -> set[str]:
    """Every app with a live instance, helpers included (the last check before a folder is swapped)."""
    root = runtime_dir() / ".flatpak"
    out: set[str] = set()
    try:
        instances = list(root.iterdir())
    except OSError:
        return out
    for instance in instances:
        app, pid = _flatpak_app(instance), _flatpak_pid(instance)
        if app and pid and Path(f"/proc/{pid}").exists():
            out.add(app)
    return out


def running_store_apps() -> set[str]:
    root = runtime_dir() / "Suno-apps"
    out: set[str] = set()
    try:
        folders = list(root.iterdir())
    except OSError:
        return out
    for folder in folders:
        try:
            with open(folder / ".running", "a") as handle:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except FileNotFoundError:
            continue
        except OSError:
            out.add(folder.name)
    return out


def installed_stamp() -> tuple:
    """Changes when an app is installed or removed (Flatpak user and system, ADR-052 records)."""
    folders = [Path.home() / ".local/share/flatpak/app", Path("/var/lib/flatpak/app"),
               Path.home() / ".local/share/Suno/apps", Path.home() / ".local/share/Suno/installer/applications"]
    out = []
    for folder in folders:
        try:
            out.append(folder.stat().st_mtime_ns)
        except OSError:
            out.append(0)
    return tuple(out)


def running() -> set[str]:
    return running_flatpaks() | running_store_apps()


class Helpers:
    """Sandboxed helpers this service runs under an app's id (sign-ins, ``portal_secrets``).

    Their instances are not the person using the app: they neither hold the app's quiet point nor count as it
    closing. Each helper is known by the instance id Flatpak reports for it (``--instance-id-fd``), never by
    timing, so a person closing the same app while a helper runs is still seen. A new instance of an app that
    has a helper in flight whose id isn't known yet is left unclassified until it is.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ids: set[str] = set()
        self._unknown: dict[str, int] = {}

    def begin(self, app: str) -> None:
        with self._lock:
            self._unknown[app] = self._unknown.get(app, 0) + 1

    def identify(self, app: str, instance: str | None) -> None:
        """The helper's instance id is known (or will never be: ``None``)."""
        with self._lock:
            if instance:
                self._ids.add(instance)
            if self._unknown.get(app, 0) > 1:
                self._unknown[app] -= 1
            else:
                self._unknown.pop(app, None)

    def classify(self, app: str, instance: str) -> str:
        """helper | person | unknown (ask again at the next look)."""
        with self._lock:
            if instance in self._ids:
                return "helper"
            return "unknown" if self._unknown.get(app) else "person"

    def forget(self, instance: str) -> None:
        with self._lock:
            self._ids.discard(instance)


HELPERS = Helpers()
STARTING_SECONDS = 30       # an instance folder without bwrapinfo.json yet is a start in progress, then a failed one


class _Instance:
    __slots__ = ("app", "helper", "pid", "new", "born")

    def __init__(self, app: str, helper: bool, new: bool, born: float) -> None:
        self.app, self.helper, self.pid, self.new, self.born = app, helper, 0, new, born




class Watcher:
    """Knows when each app last ran and calls back when apps reach their quiet point.

    Every run is seen, however short: Flatpak instances are tracked by instance id and store apps by their
    runtime folder, so a run that starts and ends between two looks still counts, and a file monitor on both
    folders makes the look happen at once rather than at the next tick. ``on_closed(apps)`` is called once
    the apps have been closed for ``QUIET_SECONDS`` with no new launch: to send what changed. The same call
    comes for an app that ``wait_for`` named (newer state from another device waits on it) once it is quiet,
    whether or not its close was seen. Runs of this service's own helpers count for neither.
    """

    def __init__(self, on_closed=None, interval: float = 3.0, on_installed=None) -> None:
        self.last_running: dict[str, float] = {}
        self.current: set[str] = set()
        self.on_closed = on_closed
        self.interval = interval
        self.requested: set[str] = set()
        self.on_installed = on_installed
        self._installed = installed_stamp()
        self._stop = threading.Event()
        self._lock = threading.RLock()
        self._instances: dict[str, _Instance] = {}
        self._store: dict[str, tuple] = {}
        self._gone_store: set[str] = set()
        self._primed = False
        self._closing: set[str] = set()       # closed, quiet point not reached yet
        self._waiting: set[str] = set()       # newer state waits until these are quiet
        self._loop = None
        self._kick = None
        self._setting_schemas: set[str] = set()
        self._watched: dict[str, object] = {}
        self._setting_kick = None

    # -- what ran
    def _scan_flatpaks(self, now: float, live: set[str], ran: set[str]) -> None:
        root = runtime_dir() / ".flatpak"
        try:
            folders = {folder.name: folder for folder in root.iterdir()}
        except OSError:
            folders = {}
        for name in set(self._instances) - set(folders):
            HELPERS.forget(name)
            del self._instances[name]
        for name, folder in folders.items():
            entry = self._instances.get(name)
            if entry is None:
                app = _flatpak_app(folder)
                if not app:
                    continue                    # info not written yet: the next look reads it
                kind = HELPERS.classify(app, name)
                if kind == "unknown":
                    continue
                entry = self._instances[name] = _Instance(app, kind == "helper", self._primed, now)
            if entry.helper:
                continue
            if not entry.pid:
                entry.pid = _flatpak_pid(folder)
            alive = Path(f"/proc/{entry.pid}").exists() if entry.pid else now - entry.born < STARTING_SECONDS
            if alive:
                live.add(entry.app)
            if entry.new:
                ran.add(entry.app)
                entry.new = False

    def _scan_store(self, live: set[str], ran: set[str]) -> None:
        running_now = running_store_apps()
        root = runtime_dir() / "Suno-apps"
        stamps: dict[str, tuple] = {}
        try:
            for folder in root.iterdir():
                try:
                    info = folder.stat()
                    stamps[folder.name] = (info.st_ino, info.st_mtime_ns)
                except OSError:
                    continue
        except OSError:
            pass
        for app, stamp in stamps.items():
            if self._primed and self._store.get(app) != stamp:
                ran.add(app)                    # a launch writes the runtime folder
        ran |= self._gone_store                 # a folder created and removed between two looks
        self._gone_store = set()
        self._store = stamps
        live |= running_now

    def poll(self) -> set[str]:
        """One look. Returns the apps seen closing (or having run and closed) since the last look."""
        with self._lock:
            now = time.monotonic()
            live: set[str] = set()
            ran: set[str] = set()
            self._scan_flatpaks(now, live, ran)
            self._scan_store(live, ran)
            for app in live | ran:
                self.last_running[app] = now
            closed = (self.current - live) | (ran - live)
            self.current = live
            self._primed = True
            self._closing |= closed
            self._closing -= live
            due = {app for app in self._closing | self._waiting if self.quiet(app)}
            self._closing -= due
            self._waiting -= due
        stamp = installed_stamp()
        if stamp != self._installed:
            self._installed = stamp
            if self.on_installed:
                self.on_installed()
        if due and self.on_closed:
            self.on_closed(due)
        return closed

    def wait_for(self, apps: set[str]) -> None:
        """Newer state for these apps waits until they are quiet; say so when they are."""
        with self._lock:
            self._waiting |= {app for app in apps if not self.quiet(app)}

    def is_running(self, app: str) -> bool:
        return app in self.current

    def quiet(self, app: str) -> bool:
        if app in self.current:
            return False
        if app in self.requested:
            return True
        seen = self.last_running.get(app)
        return seen is None or time.monotonic() - seen >= QUIET_SECONDS

    # -- synced settings (settings_sync): a change here wakes a cycle, like an install does
    def watch_settings(self, schemas: set[str]) -> None:
        self._setting_schemas = set(schemas)
        if self._loop is not None:
            from gi.repository import GLib
            source = GLib.idle_source_new()
            source.set_callback(lambda *_args: self._watch_settings_now() and False)
            source.attach(self._loop.get_context())

    def _watch_settings_now(self) -> bool:
        from gi.repository import Gio
        source = Gio.SettingsSchemaSource.get_default()
        for schema in sorted(self._setting_schemas - set(self._watched)):
            found = source.lookup(schema, True) if source else None
            if found is None:
                continue
            settings = Gio.Settings.new_full(found, None, None)
            settings.connect("changed", self._setting_changed)
            self._watched[schema] = settings
        return True

    def _setting_changed(self, *_args) -> None:
        from gi.repository import GLib
        if self._setting_kick is None and self._loop is not None:
            # A slider drag is one change, a second after it settles.
            self._setting_kick = GLib.timeout_source_new(1000)
            self._setting_kick.set_callback(self._settings_settled)
            self._setting_kick.attach(self._loop.get_context())

    def _settings_settled(self, *_args) -> bool:
        self._setting_kick = None
        if self.on_installed:
            self.on_installed()
        return False

    # -- the thread
    def _changed(self, _monitor, child, _other, event) -> None:
        from gi.repository import Gio, GLib
        if event == Gio.FileMonitorEvent.DELETED and child is not None and child.get_parent() is not None \
                and child.get_parent().get_basename() == "Suno-apps":
            with self._lock:
                self._gone_store.add(child.get_basename())
        if self._kick is None and self._loop is not None:
            # A burst of changes is one look, 100 ms after the first.
            self._kick = GLib.timeout_source_new(100)
            self._kick.set_callback(self._kicked)
            self._kick.attach(self._loop.get_context())

    def _kicked(self, *_args) -> bool:
        self._kick = None
        self._tick()
        return False

    def _tick(self, *_args) -> bool:
        try:
            self.poll()
        except Exception:  # noqa: BLE001 - a bad instance folder is skipped next time too
            pass
        return not self._stop.is_set()

    def run(self) -> None:
        try:
            import gi
            gi.require_version("Gio", "2.0")
            from gi.repository import Gio, GLib
        except (ImportError, ValueError):
            while not self._stop.wait(self.interval):
                self._tick()
            return
        context = GLib.MainContext.new()
        context.push_thread_default()
        try:
            monitors = []
            for folder in (runtime_dir() / ".flatpak", runtime_dir() / "Suno-apps"):
                try:
                    monitor = Gio.File.new_for_path(str(folder)).monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, None)
                except GLib.Error:
                    continue
                monitor.connect("changed", self._changed)
                monitors.append(monitor)
            self._loop = GLib.MainLoop.new(context, False)
            try:
                self._watch_settings_now()
            except Exception:  # noqa: BLE001 - no GSettings: the 5-minute look still finds changes
                pass
            ticker = GLib.timeout_source_new(int(self.interval * 1000))
            ticker.set_callback(self._tick)
            ticker.attach(context)
            self._tick()
            if not self._stop.is_set():
                self._loop.run()
            for monitor in monitors:
                monitor.cancel()
        finally:
            context.pop_thread_default()

    def stop(self) -> None:
        self._stop.set()
        if self._loop is not None:
            self._loop.quit()
