# SPDX-License-Identifier: Apache-2.0
"""The device code against the shared device–Hub vectors (connect-sync-apps-hub.md §8)."""
from __future__ import annotations

import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from cryptography.hazmat.primitives import serialization  # noqa: E402

import apps_testkit as kit  # noqa: E402
from luma_connect_sync.apps_api import registry as reg  # noqa: E402
from luma_connect_sync.apps_api import tokens as tk  # noqa: E402

V = Path(__file__).resolve().parent / "vectors"


def unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


class Owners(unittest.TestCase):
    def test_owner_cases(self):
        for case in json.loads((V / "owner/cases.json").read_text())["cases"]:
            self.assertEqual(kit.owner(case["remote_url"], case["fingerprints"]), case["owner"], case["why"])
            if "not_equal_to" in case:
                self.assertNotEqual(case["owner"], case["not_equal_to"])


class Registry(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.expected = json.loads((V / "apps-registry/expected.json").read_text())
        self.now = self.expected["now_for_checks"]
        self.registry = reg.Registry(Path(self.tmp.name), public_key=(V / "apps-registry/registry.pub").read_text())

    def tearDown(self):
        self.tmp.cleanup()

    def accept(self, folder: Path):
        return self.registry.accept((folder / "registry.json").read_bytes(), (folder / "registry.json.minisig").read_bytes(), self.now)

    def test_valid_registry_and_fingerprints(self):
        snap = self.accept(V / "apps-registry")
        self.assertEqual(snap.version, self.expected["version"])
        self.assertEqual([k["slot"] for k in snap.tokens["keys"]], ["2026-11"], "the token key names its month (review N2)")
        for app, fprs in self.expected["fingerprints"].items():
            entry = snap.entries_for(app)[0]
            self.assertEqual(set(entry["fingerprints"]), {fprs["primary"]}, "only primary fingerprints, never subkeys")
            self.assertEqual(entry["owner"], kit.owner(self.expected["remotes"][app], [fprs["primary"]]))
        notes = snap.entries_for("org.example.Notes")[0]
        self.assertEqual((notes["state"], notes["purge"]), ("revoked", True))
        self.assertEqual(snap.entries_for("org.example.Recipes")[0]["limits"]["record_bytes"], 20000000)
        self.assertEqual(len(snap.token_keys(self.now)), 1)

    def test_invalid_registries_are_refused(self):
        self.accept(V / "apps-registry")
        for name in self.expected["invalid"]:
            with self.subTest(name), self.assertRaises(reg.RegistryError):
                self.accept(V / "apps-registry/invalid" / name)
            self.assertEqual(self.registry.version, self.expected["version"])

    def test_limit_cases(self):
        cases = json.loads((V / "apps-registry/limits.json").read_text())
        for case in cases["cases"]:
            body = json.loads((V / "apps-registry/registry.json").read_text())
            body["apps"][0]["limits"] = case["limits"]
            with self.subTest(case["why"]):
                self.assertEqual(reg.parse(json.dumps(body).encode()).apps[0]["limits"], case["device"])

    def test_expired_registry_is_not_current(self):
        snap = self.accept(V / "apps-registry")
        self.assertIsNone(self.registry.current(snap.expires_at + 1))
        self.assertIsNotNone(self.registry.current(self.now))


class PrivacyPass(unittest.TestCase):
    def setUp(self):
        self.v = json.loads((V / "privacy-pass/vectors.json").read_text())
        self.key = tk.load_key(unb64(self.v["spki"]))
        self.private = serialization.load_pem_private_key((V / "privacy-pass/TEST-ONLY-token-key.pem").read_bytes(), None)

    def test_challenge_and_key_id(self):
        self.assertEqual(tk.challenge().hex(), self.v["challenge"])
        self.assertEqual(tk.challenge_digest().hex(), self.v["challenge_digest"])
        self.assertEqual(tk.key_id(unb64(self.v["spki"])).hex(), self.v["key_id"])

    def test_rounds(self):
        for r in self.v["rounds"]:
            # blind signing is deterministic: the Hub must produce exactly this response to this request
            self.assertEqual(tk.blind_sign(self.private, unb64(r["token_request"])), unb64(r["blind_sig"]))
            token = unb64(r["token"])
            kind, _nonce, digest, kid, auth = tk.parse_token(token)
            self.assertEqual((kind, digest.hex(), kid.hex()), (2, self.v["challenge_digest"], self.v["key_id"]))
            tk.verify(self.key, token[:98], auth)

    def test_invalid_tokens(self):
        for case in self.v["invalid_tokens"]:
            if case["answer"] != 401:
                continue
            raw = unb64(case["token"])
            with self.subTest(case["why"]), self.assertRaises(tk.TokenError):
                kind, _n, digest, kid, auth = tk.parse_token(raw)
                if kind != 2 or digest.hex() != self.v["challenge_digest"] or kid.hex() != self.v["key_id"]:
                    raise tk.TokenError("refused")
                tk.verify(self.key, raw[:98], auth)

    def test_plain_rsa_spki_is_refused(self):
        plain = self.private.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        with self.assertRaises(tk.TokenError):
            tk.load_key(plain)


class Reports(unittest.TestCase):
    def test_ldp_constants_and_estimator(self):
        from luma_connect_sync.apps_api import metrics
        v = json.loads((V / "reports/reports.json").read_text())["ldp"]
        self.assertEqual(tuple(v["fields"]), metrics.LDP_FIELDS)
        self.assertEqual((v["epsilon_permanent"], v["epsilon_report"], v["buckets"]),
                         (metrics.LDP_EPSILON, metrics.LDP_EPSILON_REPORT, metrics.LDP_BUCKETS))
        p, q = metrics.ldp_channel()
        self.assertAlmostEqual(p, v["p"], places=8)
        self.assertAlmostEqual(q, v["q"], places=8)
        for value, bucket in v["bucket_of"]:
            self.assertEqual(metrics.ldp_bucket(value), bucket, value)
        for got, want in zip(metrics.ldp_estimate(v["estimator_example"]["counts"]), v["estimator_example"]["estimate"]):
            self.assertAlmostEqual(got, want, places=5)

    def test_valid_reports_are_what_the_device_sends(self):
        from luma_connect_sync.apps_api import metrics
        reports = json.loads((V / "reports/reports.json").read_text())
        for body in reports["valid"]:
            self.assertEqual(set(body), {"v", "day", "owner", "app", "context", "estimate"})
            self.assertEqual(body["v"], 3)
            self.assertIn(body["estimate"]["field"], metrics.LDP_FIELDS)


if __name__ == "__main__":
    unittest.main()
