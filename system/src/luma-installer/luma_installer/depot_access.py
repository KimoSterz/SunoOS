# SPDX-License-Identifier: Apache-2.0
"""Depot's route to the one install sheet (ADR-052 step 3).

Depot asks before an install with Valet's sheet (valet_access.AccessSheet), not a list
of its own. The plan comes from what the catalogue entry says it reaches (Depot's
permission keys, read from the app's Flatpak metadata or the listing); what the person
chooses is kept here by app until the install finishes, then recorded the way Valet
records it (package_access.record_install).
"""
from __future__ import annotations

import threading

from . import app_permissions

# Depot's permission keys (depot_permissions) as the Flatpak filesystems they came from.
_FOLDERS = {
    "files.home": "home", "files.host": "host", "files.documents": "xdg-documents",
    "files.pictures": "xdg-pictures", "files.music": "xdg-music", "files.videos": "xdg-videos",
    "files.downloads": "xdg-download",
}
_USES = {
    "network": ("network",), "notifications": ("notifications",), "background": ("background",),
    "devices.camera": ("camera",), "devices.microphone": ("microphone",),
    "devices.all": ("camera", "microphone"), "location": ("location",),
}

# The kinds of catalogue entry whose installs the permission model covers.
SHEET_KINDS = ("flatpak", "luma", "deb", "")

_chosen: dict[str, dict] = {}
_lock = threading.Lock()


def plan_for_app(app) -> dict[str, object]:
    """The sheet's plan for a catalogue entry: its declared folders and uses, else its kind."""
    keys = [permission.key for permission in getattr(app, "permissions", ()) or ()]
    filesystems = [_FOLDERS[key] for key in keys if key in _FOLDERS]
    uses: list[str] = []
    for key in keys:
        for use in _USES.get(key, ()):
            if use not in uses:
                uses.append(use)
    declared = {"filesystems": filesystems} if filesystems else None
    return app_permissions.plan(categories=tuple(getattr(app, "categories", ()) or ()), declared=declared,
                                name=getattr(app, "name", ""), uses=uses)


def shows_sheet(app) -> bool:
    """Flatpaks and Debian capsules: what the permission model installs. A system channel
    (snap, a publisher's RPM repository) installs outside it and keeps Depot's own words."""
    return not getattr(app, "channel_kind", "") and getattr(app, "package_kind", "") in SHEET_KINDS


def choose(app_id: str, chosen: dict) -> None:
    with _lock:
        _chosen[app_id] = dict(chosen)


def take(app_id: str) -> dict | None:
    """What the person chose for this install, once."""
    with _lock:
        return _chosen.pop(app_id, None)


def record_flatpak(flatpak_id: str, chosen: dict, *, record=None) -> None:
    """A Flatpak Depot installed: store the choice and apply it as a Flatpak override."""
    from . import package_access
    (record or package_access.record_install)(flatpak_id, chosen, flatpak=True)
