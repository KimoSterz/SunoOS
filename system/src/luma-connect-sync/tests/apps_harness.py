# SPDX-License-Identifier: Apache-2.0
"""Two devices of one account, a fake Hub that serves the app registry, tokens and reports, and test apps
installed from signed test commits (ADR-057 tests)."""
from __future__ import annotations

import json
import os
import shutil
import sys
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402

import apps_testkit as kit  # noqa: E402
from fake_hub import FakeHub, serve  # noqa: E402
from harness import enrol_fake, make_device, temporary_root  # noqa: E402
from luma_connect_sync.apps_api import identity, tokens as tk  # noqa: E402
from luma_connect_sync.apps_api.api import AppsApi, Permissions  # noqa: E402
from luma_connect_sync.apps_api.cycle import AppsCycle  # noqa: E402
from luma_connect_sync.apps_api.metrics import Metrics  # noqa: E402
from luma_connect_sync.apps_api.registry import Registry  # noqa: E402
from luma_connect_sync.engine import LocalState  # noqa: E402

APP = "org.example.Game"
REMOTE = "https://games.example.invalid/repo"
DAY = 86_400_000


class MemoryPermissions:
    def __init__(self) -> None:
        self.rows: dict[str, list[str]] = {}

    def lookup(self, table: str, entry: str) -> dict[str, list[str]]:
        return dict(self.rows) if (table, entry) == ("luma", "sync") else {}

    def set(self, table: str, entry: str, app: str, values: list[str]) -> None:
        self.rows[app] = list(values)


class Keys:
    """Made once per test run: OpenGPG publishers and the Hub's token key."""
    _made = None

    @classmethod
    def get(cls) -> "Keys":
        if cls._made is None:
            cls._made = cls()
        return cls._made

    def __init__(self) -> None:
        self.gpg = kit.Gpg()
        self.publisher = self.gpg.new_key("Games Publisher", subkey=True)
        self.attacker = self.gpg.new_key("Lookalike", subkey=False)
        self.other = self.gpg.new_key("Other Publisher", subkey=False)
        self.token_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        n = self.token_private.public_key().public_numbers()
        self.token_spki = tk.spki_pss(n.n, n.e)
        self.token_id = tk.key_id(self.token_spki).hex()
        self.owner = kit.owner(REMOTE, [self.publisher["primary"]])
        self.other_owner = kit.owner("https://other.example.invalid/repo", [self.other["primary"]])


class Device:
    def __init__(self, base: "AppsBase", name: str) -> None:
        device_id, token = enrol_fake(base.url, base.account, name)
        self.name = name
        self.root = base.root / name
        self.dev = make_device(name, base.url, device_id, token, self.root)
        self.permissions = MemoryPermissions()
        self.reports = True                 # the device's apps.reports switch (off on a real device until Luma turns it on)
        self.installed: dict[str, tuple[Path, str]] = {}
        self.metered = False
        self.settings = {"enabled": True}
        self.api = AppsApi(engine=self.dev.engine, account=self.dev.account, local=LocalState(self.root / "apps/state.sqlite"),
                           device=device_id, device_name=name, device_class="computer", folder=self.root / "apps/stores",
                           registry=Registry(self.root / "apps/registry", public_key=kit.minisign_public(),
                                             url=base.url + "/sync/apps/v1/registry.json", seed=None),
                           metrics=Metrics(self.root / "apps/metrics.sqlite", "computer",
                                           report_url=base.url + "/api/sync-metrics/v1/report", switch=lambda: self.reports),
                           permissions=Permissions(self.permissions), settings=lambda: self.settings,
                           devices=lambda: base.devices())
        self.cycle = AppsCycle(self.api, installed=lambda: self.installed, metered=lambda: self.metered)
        self.callers: dict[str, identity.Caller] = {}

    def install(self, app: str = APP, signer: dict | None = None, *, system: bool = True, signed: bool = True,
                ref_binding: bool = True, bound_app: str | None = None, trusted: bytes | None = None) -> identity.Caller:
        keys = Keys.get()
        signer = signer or keys.publisher
        root = self.root / ("flatpak-system" if system else "home/.local/share/flatpak")
        commit = kit.make_commit(bound_app or app, ref_binding=ref_binding)
        sigs = [keys.gpg.sign(signer["primary"], commit)] if signed else []
        # Like a real remote, the installation trusts its signer's key unless a test says otherwise.
        app_path, checksum = kit.install(root, app, commit, sigs, trusted_keys=signer["key"] if trusted is None else trusted)
        self.installed[app] = (root, checksum)
        caller = identity.Caller(app, "flatpak", os.getpid(), f":1.{len(self.callers) + 100}", root, checksum, app_path,
                                 identity.read_scope(os.getpid()) or "/")
        self.callers[app] = caller
        return caller

    def ctx(self, app: str = APP):
        return self.api.context(self.callers[app])

    def allow(self, app: str = APP) -> None:
        self.permissions.set("luma", "sync", app, ["on"])

    def sync(self) -> dict:
        return self.cycle.run()

    def events(self) -> list:
        out, self.api.events = self.api.events, []
        return out


class AppsBase(unittest.TestCase):
    """Device a set Sync up, b joined; the registry approves org.example.Game from the games publisher."""

    def setUp(self) -> None:
        self.keys = Keys.get()
        self.root = temporary_root()
        self.account = "acct-" + uuid.uuid4().hex[:12]
        self.fake = FakeHub()
        self.fake.token_key = self.keys.token_private
        self.fake.token_key_id = self.keys.token_id
        self.server = serve(self.fake)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.version = 0
        self.a = Device(self, "Desktop")
        self.b = Device(self, "Living room TV")
        self._join(self.a.dev, self.b.dev)
        self.publish()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        shutil.rmtree(self.root, ignore_errors=True)

    def devices(self) -> dict:
        return {d.dev.hub.device: {"name": d.name, "class": "computer", "last_seen": 0} for d in (self.a, self.b)}

    @staticmethod
    def _join(a, b) -> None:
        pending = a.account.begin_setup()
        a.account.finish_setup(pending, {i: pending.words[i - 1] for i in pending.check})
        b.account.request_join()
        a.account.join_requests()
        code = b.account.join_view().code
        card = a.account.join_requests()[0]
        a.account.approve(card["id"], code)
        assert b.account.confirm_join(True).state == "approved"
        b.account.join_view()
        a.account.refresh()
        b.account.refresh()

    def entry(self, **change) -> dict:
        keys = change.pop("keys", None)
        entry = {"owner": self.keys.owner, "app": APP, "keys": keys if keys is not None else [kit.b64url(self.keys.publisher["key"])],
                 "state": "approved", "purge": False, "labels": ["library", "saves"], "limits": {}, "changed_at": 0}
        entry.update(change)
        return entry

    def publish(self, apps: list[dict] | None = None, *, expires_in: int = 14 * DAY, issued_offset: int = 0,
                token_keys: list[dict] | None = None) -> None:
        import time
        self.version += 1
        now = int(time.time() * 1000) + issued_offset
        apps = apps if apps is not None else [self.entry()]
        if token_keys is None:
            token_keys = [kit.month_key(self.keys.token_id, kit.b64url(self.keys.token_spki), int(time.time() * 1000))]
        body = kit.registry_body(self.version, apps, token_keys, issued_at=now, expires_at=now + expires_in)
        self.fake.publish_registry(body, kit.minisign_sign(body, f"registry:{self.version}"), self.version,
                                   {(e["owner"], e["app"]) for e in apps})
        self.registry_body = body

    def later(self, ms: int, *devices: Device) -> None:
        """The devices' clocks run ``ms`` ahead from now on."""
        import time
        for device in devices or (self.a, self.b):
            device.api.wall = lambda ms=ms: int(time.time() * 1000) + ms

    def refresh(self, *devices: Device) -> None:
        for device in devices or (self.a, self.b):
            device.api.registry.next_check = 0

    def ready(self, *devices: Device, app: str = APP) -> None:
        """Installed from the approved publisher, permission on, registry fetched."""
        for device in devices or (self.a, self.b):
            device.install(app)
            device.allow(app)
            device.sync()

    def memfd(self, data: bytes, *, seal: bool = True) -> int:
        import fcntl
        fd = os.memfd_create("t", os.MFD_CLOEXEC | os.MFD_ALLOW_SEALING)
        os.write(fd, data)
        if seal:
            fcntl.fcntl(fd, fcntl.F_ADD_SEALS, fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK)
        self.addCleanup(lambda: _close(fd))
        return fd


def _close(fd: int) -> None:
    try:
        os.close(fd)
    except OSError:
        pass


def value_of(record: dict) -> bytes:
    return bytes(record["value"])


def dump(obj) -> str:
    return json.dumps(obj, default=str, indent=1)
