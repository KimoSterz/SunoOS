# SPDX-License-Identifier: Apache-2.0
"""Per-app analytics (ADR-057 §10.5): tokens at sync auth, anonymous daily reports, forged and replayed reports,
and whether a report can be linked to the device that sent it."""
from __future__ import annotations

import base64
import json
import time
import unittest
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives.asymmetric import rsa

from apps_harness import APP, AppsBase
from Suno_connect_sync.apps_api import tokens as tk
from Suno_connect_sync.apps_api.metrics import today


def unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


class Reports(AppsBase):
    def run_a_day(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.api.metrics.call(self.keys.owner, APP, "Save")
        self.a.sync()
        self.b.sync()

    def end_the_day(self, device):
        """Move today's counters to yesterday, so the report for them becomes due."""
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        device.api.metrics.db.execute("UPDATE counters SET day=?", (yesterday,))
        device.api.metrics.db.execute("DELETE FROM reports")
        device.api.metrics.db.execute("DELETE FROM kv WHERE key='reports_through'")
        device.api.metrics.schedule([(self.keys.owner, APP)], True, now=time.time())
        device.api.metrics.db.execute("UPDATE reports SET due=?", (time.time() - 60,))
        return yesterday

    def test_tokens_come_64_a_day_and_reports_aggregate(self):
        self.run_a_day()
        self.assertEqual(self.a.api.metrics.tokens_today(), 64, "exactly 64, whatever the device needs")
        self.assertEqual(self.fake.issued[(self.a.dev.hub.device, today())], 64)
        self.a.sync()
        self.assertEqual(self.fake.issued[(self.a.dev.hub.device, today())], 64, "only once a day")
        day = self.end_the_day(self.a)
        due = self.a.api.metrics.due()
        self.assertEqual(due, [(day, self.keys.owner, APP)])
        self.assertEqual(self.a.api.metrics.send_one(*due[0], self.a.api.registry.current()), "sent")
        cells = {k: v for k, v in self.fake.aggregates.items() if k[0] == APP and k[1] == day}
        self.assertEqual(sum(v["reports"] for v in cells.values()), 1)
        self.assertEqual(sum(sum(sum(c) for c in v["estimates"].values()) for v in cells.values()), 1, "one estimated field")

    def test_a_report_carries_nothing_that_names_the_device(self):
        self.run_a_day()
        day = self.end_the_day(self.a)
        self.a.api.metrics.send_one(day, self.keys.owner, APP, self.a.api.registry.current())
        seen = self.fake.reports_seen[-1]
        text = seen["body"].decode() + json.dumps(seen["headers"])
        for secret in (self.a.dev.hub.device, self.a.dev.hub.registration.token, self.account, "Desktop",
                       self.a.dev.account.bundle().account):
            self.assertNotIn(secret, text)
        self.assertNotIn("cookie", {k.lower() for k in seen["headers"]})
        self.assertTrue(seen["headers"]["authorization"].startswith("PrivateToken token="))
        self.assertEqual(set(json.loads(seen["body"])), {"v", "day", "owner", "app", "context", "estimate"})

    def test_a_redeemed_token_cant_be_linked_to_its_issuance(self):
        self.run_a_day()
        self.ready(self.b)
        day = self.end_the_day(self.a)
        self.a.api.metrics.send_one(day, self.keys.owner, APP, self.a.api.registry.current())
        token = unb64(self.fake.reports_seen[-1]["headers"]["authorization"].split('"')[1])
        _kind, nonce, _digest, _kid, authenticator = tk.parse_token(token)
        n = self.keys.token_private.public_key().public_numbers().n
        # The Hub keeps (in this fake, for the test) every blinded request and blind signature it saw. None of them is,
        # or contains, the token's nonce or its authenticator, and none matches it under the public key: the blinding
        # factor is the device's secret.
        for issuance in self.fake.issuance_log:
            for request, response in zip(issuance["requests"], issuance["responses"]):
                req, sig = unb64(request), unb64(response)
                self.assertNotIn(nonce, req)
                self.assertNotEqual(sig, authenticator)
                self.assertNotEqual(int.from_bytes(req[3:], "big"), pow(int.from_bytes(authenticator, "big"), 65537, n))
        devices = {i["device"] for i in self.fake.issuance_log}
        self.assertEqual(len(devices), 2, "both devices fetched tokens; the report names neither")

    def test_forged_and_replayed_reports_are_refused(self):
        from urllib.error import HTTPError
        from urllib.request import Request, urlopen
        self.run_a_day()
        day = self.end_the_day(self.a)
        self.a.api.metrics.send_one(day, self.keys.owner, APP, self.a.api.registry.current())
        seen = self.fake.reports_seen[-1]

        def post(auth: str, body: bytes) -> int:
            request = Request(self.url + "/api/sync-metrics/v1/report", data=body, method="POST",
                              headers={"Authorization": auth, "Content-Type": "application/json"})
            try:
                with urlopen(request) as response:
                    return response.status
            except HTTPError as error:
                return error.code
        self.assertEqual(post(seen["headers"]["authorization"], seen["body"]), 409, "a replay is refused")
        token = bytearray(unb64(seen["headers"]["authorization"].split('"')[1]))
        token[-1] ^= 1
        forged = 'PrivateToken token="' + base64.urlsafe_b64encode(bytes(token)).rstrip(b"=").decode() + '"'
        self.assertEqual(post(forged, seen["body"]), 401)
        # A token the Hub's key never signed (someone else's key).
        other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        num = other.public_key().public_numbers()
        spki = tk.spki_pss(num.n, num.e)
        key = tk.load_key(spki)
        request, pending = tk.blind(key, bytes.fromhex(self.keys.token_id))
        own = tk.finalize(key, pending, tk.blind_sign(other, request))
        self.assertEqual(post('PrivateToken token="' + base64.urlsafe_b64encode(own).rstrip(b"=").decode() + '"', seen["body"]), 401)
        self.assertEqual(post("Bearer " + self.a.dev.hub.registration.token, seen["body"]), 401)

    def test_a_hub_key_outside_the_registry_gets_no_tokens(self):
        self.ready(self.a)
        self.a.api.metrics.db.execute("DELETE FROM kv WHERE key='tokens_day'")
        self.a.api.metrics.db.execute("DELETE FROM tokens")
        other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.fake.token_key = other           # a Hub that gives this device a key of its own
        self.fake.issued.clear()
        with self.assertRaises(tk.TokenError):
            self.a.api.metrics.fetch_tokens(self.a.dev.hub, self.a.api.registry.current())
        self.assertEqual(self.a.api.metrics.tokens_today(), 0, "nothing can be reported under a partitioning key")

    def test_the_report_names_the_apps_own_version(self):
        caller = self.a.install()
        folder = caller.app_path / "share/metainfo"
        folder.mkdir(parents=True)
        (folder / f"{APP}.metainfo.xml").write_text('<component><releases><release version="1.4.2" date="2026-11-01"/>'
                                                    '<release version="1.4.1"/></releases></component>')
        self.a.allow()
        self.a.sync()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        day = today()
        body = self.a.api.metrics.report_body(day, self.keys.owner, APP)
        self.assertEqual(body["context"]["app_version"], "1.4.2")
        self.assertIn(body["context"]["arch"], ("x86_64", "aarch64"))

    def test_unapproved_and_unverified_apps_are_never_reported(self):
        self.publish([])
        self.refresh()
        self.a.install()
        self.a.allow()
        self.a.sync()
        ctx = self.a.ctx()
        self.a.api.save(ctx, "saves", [["s", b"x", ""]], {})
        self.a.api.metrics.call(ctx.owner, APP, "Save")
        rows = self.a.api.metrics.db.execute("SELECT owner FROM counters").fetchall()
        self.assertEqual(rows, [], "a key: owner (not approved) is never counted")


if __name__ == "__main__":
    unittest.main()
