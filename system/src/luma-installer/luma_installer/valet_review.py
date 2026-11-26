"""The install sheet after a command-line install: the same sheet, as a review.

`apt`, `dnf` and `luma-appctl install` never wait on the sheet. The install
goes ahead at the suggested level and leaves a review pending; the Shell's
notification ("Kiln installed", Review) opens `luma-install --review KEY`,
which draws the sheet from what was recorded. A change here applies at once
through org.projectluma.AppPermissions1; Done and Open finish the review.
"""
from __future__ import annotations

from . import app_permissions, device_requests


def record_for_key(key: str) -> dict:
    """The installer record behind a permission key (an installed ID or a Flatpak ID)."""
    records = app_permissions.installed_records()
    if key in records:
        return records[key]
    flatpaks = app_permissions.flatpak_apps()
    if key in flatpaks:
        return flatpaks[key]
    raise KeyError(key)


def application_id(record: dict, key: str) -> str:
    return str(record.get("application_id") or record.get("_id") or record.get("flatpak_id") or key)


def device_summary(tokens: list[str]) -> dict:
    requests = []
    for token in tokens:
        parts = (str(token).split(":") + ["", ""])[:3]
        if parts[0] in device_requests.KINDS:
            requests.append(device_requests.Request(parts[0], parts[1], parts[2]))
    return device_requests.Summary(requests).as_dict() if requests else {}


def plan_from_detail(detail: dict) -> dict:
    """GetApp's detail as the sheet's plan: what is recorded now, the suggestion tagged."""
    level = str(detail.get("level") or "chooser")
    suggested = str(detail.get("suggested_level") or level)
    uses = [str(use) for use in detail.get("uses") or []]
    blocked = []
    if not detail.get("network", True):
        blocked.append("network")
    if "background" in uses and not detail.get("background", False):
        blocked.append("background")
    if "autostart" in uses and not detail.get("autostart", False):
        blocked.append("autostart")
    # Camera, microphone, location, screen: the portals' own entries, refused or never granted.
    granted = {str(row.get("kind")): bool(row.get("granted")) for row in detail.get("devices") or [] if isinstance(row, dict)}
    for use in uses:
        if use in app_permissions.PORTAL_DEVICES and use in granted and not granted[use]:
            blocked.append(use)
    devices = device_summary(list(detail.get("device_requests") or []))
    if devices:
        devices["granted"] = bool(detail.get("granted_devices"))
    return {"files": {"level": level, "folders": list(detail.get("folders") or []), "suggested_level": suggested,
                      "suggested_folders": list(detail.get("suggested_folders") or [])},
            "uses": uses, "blocked": blocked, "devices": devices, "never": True}


class Service:
    """The few AppPermissions1 calls the review makes (synchronous; they are quick)."""

    def __init__(self, bus=None) -> None:
        import gi
        gi.require_version("Gio", "2.0")
        from gi.repository import Gio
        self.bus = bus or Gio.bus_get_sync(Gio.BusType.SESSION, None)

    def call(self, method: str, signature: str, *arguments, reply: str | None = None):
        from gi.repository import Gio, GLib
        result = self.bus.call_sync(app_permissions.BUS_NAME, app_permissions.OBJECT_PATH, app_permissions.BUS_NAME,
                                    method, GLib.Variant(signature, arguments) if signature else None,
                                    GLib.VariantType.new(reply) if reply else None, Gio.DBusCallFlags.NONE, 15000, None)
        return result.unpack() if result is not None else None

    def detail(self, key: str) -> dict:
        return dict(self.call("GetApp", "(s)", key, reply="(a{sv})")[0])

    def apply(self, key: str, before: dict, access) -> None:
        """Send what changed between `before` (a plan) and the sheet's state."""
        files = before.get("files") or {}
        if access.level != files.get("level"):
            self.call("SetFileLevel", "(ss)", key, access.level)
        if access.level == "folders":
            had = set(files.get("folders") or [])
            for folder in sorted(set(access.folders) - had):
                self.call("SetFolder", "(ssb)", key, folder, True)
            for folder in sorted(had - set(access.folders)):
                self.call("SetFolder", "(ssb)", key, folder, False)
        blocked = set(before.get("blocked") or [])
        for use in access.uses:
            on = access.allowed.get(use, True)
            if on == (use not in blocked):
                continue
            if use == "network":
                self.call("SetNetwork", "(sb)", key, on)
            elif use == "background":
                self.call("SetBackground", "(sb)", key, on)
            elif use == "autostart":
                self.call("SetAutostart", "(sb)", key, on)
            elif use in app_permissions.PORTAL_DEVICES:
                self.call("SetDevice", "(ssb)", key, use, on)
        devices = before.get("devices") or {}
        if access.device and access.device_granted != bool(devices.get("granted")):
            self.call("SetDeviceRequests", "(sb)", key, access.device_granted)

    def finish(self, key: str) -> None:
        self.call("FinishReview", "(s)", key)


__all__ = ["record_for_key", "application_id", "plan_from_detail", "Service"]
