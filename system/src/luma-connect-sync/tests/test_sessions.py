# SPDX-License-Identifier: Apache-2.0
"""Continue (ADR-055 §5): a device's session reaches the account's other
computers and handhelds end-to-end encrypted, and never a TV."""
import base64
import json
import os
import pickle
import time
import unittest
import uuid
from pathlib import Path

from test_sync import Base

from luma_connect_sync import sessions

CANARY = "luma-session-canary-" + uuid.uuid4().hex


class Sessions(Base):
    def setUp(self) -> None:
        super().setUp()
        self.a, self.b, self.tv = (self.device(n) for n in ("ThinkPad", "Surface", "Living room"))
        self.tv.account.device_class = "tv"
        pending = self.a.account.begin_setup()
        self.a.account.finish_setup(pending, {i: pending.words[i - 1] for i in pending.check})
        self.joined(self.a, self.b)
        self.joined(self.a, self.tv)
        for d in (self.a, self.b, self.tv):
            d.account.refresh()
            d.sessions = sessions.Sessions(d.engine, d.account, d.local, d.hub.device,
                                           lambda d=d: d.account.state()["devices"])
            d.state = self.root / d.name / "state-home"

    def as_device(self, d):
        os.environ["XDG_STATE_HOME"] = str(d.state)
        return d.sessions

    def write_snapshot(self, d, taken=None, windows=3, expires=None, reason="periodic"):
        taken = taken or int(time.time())
        snapshot = {"format": 1, "device": d.hub.device, "deviceName": d.name, "taken": taken, "reason": reason,
                    "expires": expires or taken + sessions.TTL,
                    "windows": [{"app": f"org.example.App{i}.desktop", "title": f"{CANARY} {i}", "index": i}
                                for i in range(windows)],
                    "apps": [{"app": "org.example.App0.desktop", "state": f"{{'note': <'{CANARY}'>}}"}]}
        path = d.state / "luma" / "session" / "current.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(snapshot))
        return snapshot

    def tearDown(self) -> None:
        os.environ.pop("XDG_STATE_HOME", None)
        super().tearDown()

    def test_offer_reaches_computers_not_tvs(self) -> None:
        saved = self.write_snapshot(self.a)
        self.assertEqual(self.as_device(self.a).publish(), "published")
        offer = self.as_device(self.b).offer()
        self.assertIsNotNone(offer)
        self.assertEqual((offer["device"], offer["name"], offer["windows"]), (self.a.hub.device, "ThinkPad", 3))
        self.assertEqual(offer["apps"][0], "org.example.App2.desktop", "topmost app first")
        taken = self.as_device(self.b).take(offer["id"])
        self.assertEqual([w["title"] for w in taken["windows"]], [w["title"] for w in saved["windows"]])
        self.assertEqual(taken["deviceName"], "ThinkPad")
        self.assertIsNone(self.as_device(self.tv).offer(), "a TV never gets a session")
        self.assertIsNone(self.as_device(self.a).offer(), "a device doesn't offer its own session")
        self.assertEqual(self.as_device(self.a).publish(), "current", "nothing new, nothing written")

    def test_phone_offer_names_the_focused_app_and_document(self) -> None:
        snapshot = self.write_snapshot(self.a)
        snapshot["windows"][0].update(focus=True, title="Packing list — Notes")
        snapshot["apps"] = [{"app": "org.example.App0.desktop", "name": "Notes"}]
        (self.a.state / "luma" / "session" / "current.json").write_text(json.dumps(snapshot))
        self.as_device(self.a).publish()
        offer = self.as_device(self.b).offer()
        self.assertEqual(offer["focus"], {"app": "org.example.App0.desktop", "document": "Packing list"})
        self.assertIsNone(sessions.document_of("Notes", "Notes"))
        self.assertEqual(sessions.document_of("Trip — Draft - Notes", "Notes"), "Trip — Draft")

    def test_tv_gets_only_what_was_playing(self) -> None:
        snapshot = self.write_snapshot(self.a)
        snapshot["media"] = {"tv": True, "app": "org.projectluma.Tide.desktop", "name": "Tide",
                             "item": "Night Drive", "subtitle": "Kavinsky · OutRun", "position": 125,
                             "length": 290, "kind": "audio", "cookie": "secret-" + CANARY}
        (self.a.state / "luma" / "session" / "current.json").write_text(json.dumps(snapshot))
        self.assertEqual(self.as_device(self.a).publish(), "published")
        offer = self.as_device(self.tv).offer()
        self.assertTrue(offer["tv"])
        self.assertEqual(offer["media"], {"app": "org.projectluma.Tide.desktop", "name": "Tide", "item": "Night Drive",
                                          "subtitle": "Kavinsky · OutRun", "kind": "audio", "position": 125, "length": 290})
        self.assertNotIn(CANARY, json.dumps(offer), "no window titles, app state or other fields")
        taken = self.as_device(self.tv).take(offer["id"])
        self.assertEqual(set(taken), {"tv", "media", "deviceName", "device"})
        self.assertNotIn("tv", self.as_device(self.b).offer() or {}, "a computer gets the session, not the TV part")
        self.as_device(self.tv).decline(offer["id"])
        self.assertIsNone(self.as_device(self.tv).offer())

    def test_tv_art_only_a_small_jpeg(self) -> None:
        jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"
        art = base64.b64encode(jpeg).decode()
        media = {"tv": True, "app": "org.projectluma.Tide.desktop", "item": "Night Drive"}
        self.assertEqual(sessions.media_for_tv({**media, "art": art})["art"], art)
        for bad in (base64.b64encode(b"<svg onload=x>").decode(), "not base64!",
                    base64.b64encode(b"\xff\xd8\xff" + b"\x00" * sessions.ART_MAX + b"\xff\xd9").decode(), 7):
            self.assertNotIn("art", sessions.media_for_tv({**media, "art": bad}))
        snapshot = self.write_snapshot(self.a)
        snapshot["media"] = {**media, "art": art}
        (self.a.state / "luma" / "session" / "current.json").write_text(json.dumps(snapshot))
        self.assertEqual(self.as_device(self.a).publish(), "published")
        self.assertEqual(self.as_device(self.tv).offer()["media"]["art"], art)
        self.assertNotIn(art, json.dumps(self.as_device(self.b).offer() or {}), "computers get no artwork")

    def test_tv_gets_nothing_without_a_tv_app(self) -> None:
        snapshot = self.write_snapshot(self.a)
        snapshot["media"] = {"tv": False, "app": "org.example.Notes.desktop", "item": CANARY}
        (self.a.state / "luma" / "session" / "current.json").write_text(json.dumps(snapshot))
        self.as_device(self.a).publish()
        self.assertIsNone(self.as_device(self.tv).offer())

    def test_nothing_readable_on_the_hub(self) -> None:
        self.need_fake()
        self.write_snapshot(self.a)
        self.as_device(self.a).publish()
        stored = pickle.dumps(self.fake.accounts)
        self.assertNotIn(CANARY.encode(), stored)
        self.assertNotIn(b"org.example.App", stored)

    def test_expired_declined_and_withdrawn(self) -> None:
        old = int(time.time()) - sessions.TTL - 60
        self.write_snapshot(self.a, taken=old, expires=old + sessions.TTL)
        self.as_device(self.a).publish()
        self.assertIsNone(self.as_device(self.b).offer(), "expired")
        self.write_snapshot(self.a, taken=int(time.time()))
        self.as_device(self.a).publish()
        offer = self.as_device(self.b).offer()
        self.assertIsNotNone(offer)
        self.as_device(self.b).decline(offer["id"])
        self.assertIsNone(self.as_device(self.b).offer(), "Not now hides it until a newer one")
        self.write_snapshot(self.a, taken=int(time.time()) + 5)
        self.as_device(self.a).publish()
        self.assertIsNotNone(self.as_device(self.b).offer(), "a newer session is offered again")
        self.as_device(self.a).clear()
        self.assertIsNone(self.as_device(self.b).offer(), "Clear removes the record")
        self.assertFalse((self.a.state / "luma" / "session" / "current.json").exists())

    def test_empty_snapshot_withdraws_only_when_the_windows_were_closed(self) -> None:
        now = int(time.time())
        self.write_snapshot(self.a, taken=now - 30)
        self.assertEqual(self.as_device(self.a).publish(), "published")
        # Taken as the person left: lock, suspend, lid, shutdown, log-out never withdraw.
        for i, reason in enumerate(("lock", "suspend", "lid", "shutdown", "logout")):
            self.write_snapshot(self.a, taken=now - 20 + i, windows=0, reason=reason)
            self.assertEqual(self.as_device(self.a).publish(), "kept", reason)
            self.assertIsNotNone(self.as_device(self.b).offer(), reason)
        # Locked, asleep or just woken (the service's Handoff says no): kept.
        self.a.sessions.may_withdraw = lambda snapshot: False
        self.write_snapshot(self.a, taken=now - 5, windows=0)
        self.assertEqual(self.as_device(self.a).publish(), "kept")
        self.assertEqual(self.as_device(self.b).offer()["windows"], 3)
        # The same empty desktop once settled: the person closed the windows.
        self.a.sessions.may_withdraw = lambda snapshot: True
        self.assertEqual(self.as_device(self.a).publish(), "withdrawn")
        self.assertIsNone(self.as_device(self.b).offer())

    def test_offer_from_held_records_while_offline(self) -> None:
        self.write_snapshot(self.a)
        self.as_device(self.a).publish()
        offer = self.as_device(self.b).offer()
        self.assertIsNotNone(offer)
        from luma_connect_sync.hub import Offline

        def offline(*_args, **_kwargs):
            raise Offline("no network")
        self.b.hub._send = offline
        with self.assertRaises(Offline):
            self.as_device(self.b).offer()
        held = self.as_device(self.b).offer(fetch=False)
        self.assertEqual(held["id"], offer["id"], "just woken, before the network: the session it already holds")

    def test_another_devices_session_arriving_is_told(self) -> None:
        self.write_snapshot(self.b)
        self.as_device(self.b).publish()
        self.assertFalse(self.b.sessions.take_arrived(), "its own session is no news")
        self.write_snapshot(self.a)
        self.as_device(self.a).publish()
        self.as_device(self.b).refresh()
        self.assertTrue(self.b.sessions.take_arrived())
        self.assertFalse(self.b.sessions.take_arrived(), "told once")
        self.as_device(self.b).refresh()
        self.assertFalse(self.b.sessions.take_arrived(), "nothing new")

    def test_large_session_goes_in_a_blob(self) -> None:
        self.write_snapshot(self.a, windows=1500)
        self.assertEqual(self.as_device(self.a).publish(), "published")
        offer = self.as_device(self.b).offer()
        self.assertEqual(offer["windows"], 1500)
        self.assertEqual(len(self.as_device(self.b).take(offer["id"])["windows"]), 1500)

    def test_record_for_another_reader_is_refused(self) -> None:
        snapshot = self.write_snapshot(self.a)
        readers = {self.b.hub.device: self.b.account.keys().box_pub}
        record, sealed = sessions.seal(snapshot, self.a.account.account, self.a.hub.device, readers)
        with self.assertRaises(Exception):
            sessions.unseal(record, sealed, self.a.account.account, self.tv.hub.device, self.tv.account.keys().box)
        # A record moved to another writer's name doesn't open.
        record["device"] = self.tv.hub.device
        with self.assertRaises(Exception):
            sessions.unseal(record, sealed, self.a.account.account, self.b.hub.device, self.b.account.keys().box)


if __name__ == "__main__":
    unittest.main()
