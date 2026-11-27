# SPDX-License-Identifier: Apache-2.0
"""The curated list is used only under its own signature (Suno-depot-classify), never a catalogue key's."""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import minisign_signer as signer

from Suno_installer import classify as c
from Suno_installer.classify import PackageInfo, Request

DATA = Path(c.__file__).resolve().parent.parent / "data/classify"
CLASSIFY_SEED = bytes(range(32))
CLASSIFY_ID = bytes.fromhex("c1a551f1c1a551f1")
CATALOGUE_SEED = bytes(range(1, 33))
CATALOGUE_ID = bytes.fromhex("ca7a10c0ca7a10c0")


def listing(release: str = "ubuntu-24.04", version: int = 3) -> bytes:
    return (json.dumps({"format": 1, "release": release, "list_version": version,
                        "entries": {"ripgrep": {"kind": c.CONSOLE_APPLICATION, "source": "review:test"}}},
                       sort_keys=True, separators=(",", ":")) + "\n").encode()


def comment(release: str = "ubuntu-24.04", version: int = 3, purpose: str = c.CURATED_PURPOSE) -> str:
    return f"purpose={purpose} release={release} version={version}"


class CuratedSignature(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        for path in DATA.glob("*.txt"):
            shutil.copy(path, self.folder / path.name)
        (self.folder / c.CURATED_KEY).write_bytes(signer.public_key_file(CLASSIFY_SEED, CLASSIFY_ID))
        (self.folder / "depot-catalog.pub").write_bytes(signer.public_key_file(CATALOGUE_SEED, CATALOGUE_ID))
        self.environment = {c.DATA_ENVIRONMENT: str(self.folder), c.STATE_ENVIRONMENT: str(self.folder / "state.json")}
        os.environ.update(self.environment)
        c.curated_list.cache_clear()
        c.data_sections.cache_clear()
        c._LOGGED.clear()

    def tearDown(self):
        for name in self.environment:
            os.environ.pop(name, None)
        c.curated_list.cache_clear()
        c.data_sections.cache_clear()
        shutil.rmtree(self.folder)

    def publish(self, content: bytes, signature_comment: str, seed=CLASSIFY_SEED, key_id=CLASSIFY_ID,
                release="ubuntu-24.04") -> None:
        (self.folder / f"curated-{release}.json").write_bytes(content)
        (self.folder / f"curated-{release}.json.minisig").write_bytes(
            signer.signature_file(content, seed, key_id, trusted_comment=signature_comment))
        c.curated_list.cache_clear()

    def outcome(self, release="ubuntu-24.04", origin="distribution") -> c.Classification:
        return c.classify(Request(PackageInfo("ripgrep", files=("/usr/bin/rg",)), release=release, origin=origin))

    def test_a_list_signed_with_the_classify_key_decides_first(self):
        self.publish(listing(), comment())
        result = self.outcome()
        self.assertEqual((result.kind, result.source), (c.CONSOLE_APPLICATION, "curated:review:test"))
        self.assertEqual(self.outcome(origin="vendor").source, "rules")
        other = c.classify(Request(PackageInfo("other", files=("/usr/bin/other",)), release="ubuntu-24.04"))
        self.assertEqual(other.source, "rules")

    def test_a_list_signed_with_another_key_is_ignored(self):
        self.publish(listing(), comment(), seed=bytes(range(2, 34)), key_id=bytes.fromhex("0102030405060708"))
        self.assertEqual(self.outcome().source, "rules")

    def test_a_list_signed_with_a_catalogue_key_is_refused(self):
        self.publish(listing(), comment(), seed=CATALOGUE_SEED, key_id=CATALOGUE_ID)
        with self.assertLogs("Suno_installer.classify", "WARNING") as logs:
            self.assertEqual(self.outcome().source, "rules")
        self.assertIn("catalogue key", logs.output[0])

    def test_a_pinned_key_that_is_a_catalogue_key_is_refused(self):
        (self.folder / c.CURATED_KEY).write_bytes(signer.public_key_file(CATALOGUE_SEED, CATALOGUE_ID))
        self.publish(listing(), comment(), seed=CATALOGUE_SEED, key_id=CATALOGUE_ID)
        self.assertEqual(self.outcome().source, "rules")

    def test_a_signature_for_another_purpose_is_refused(self):
        self.publish(listing(), comment(purpose="Suno-depot-catalogue"))
        self.assertEqual(self.outcome().source, "rules")

    def test_a_signature_for_another_release_is_refused(self):
        self.publish(listing(), comment(release="ubuntu-26.04"))
        self.assertEqual(self.outcome().source, "rules")
        fedora = listing(release="fedora-45")
        self.publish(fedora, comment(release="fedora-45"), release="ubuntu-24.04")  # a replayed file
        self.assertEqual(self.outcome().source, "rules")

    def test_a_tampered_list_is_refused(self):
        self.publish(listing(), comment())
        path = self.folder / "curated-ubuntu-24.04.json"
        path.write_bytes(path.read_bytes().replace(b"console-application", b"system-module"))
        c.curated_list.cache_clear()
        self.assertEqual(self.outcome().source, "rules")

    def test_a_signed_version_that_differs_from_the_lists_is_refused(self):
        self.publish(listing(version=3), comment(version=4))
        self.assertEqual(self.outcome().source, "rules")

    def test_an_older_version_than_one_seen_is_refused(self):
        self.publish(listing(version=5), comment(version=5))
        self.assertEqual(self.outcome().source, "curated:review:test")
        self.publish(listing(version=4), comment(version=4))
        self.assertEqual(self.outcome().source, "rules")

    def test_the_shipped_key_is_a_placeholder_and_never_signs(self):
        self.assertNotIn("RW", (DATA / c.CURATED_KEY).read_text())
        self.assertFalse((DATA / "curated-ubuntu-24.04.json.minisig").exists())

    def test_the_shipped_lists_are_trusted_as_the_image_is(self):
        os.environ.pop(c.DATA_ENVIRONMENT)
        c.curated_list.cache_clear()
        for release in ("ubuntu-24.04", "fedora-45"):
            self.assertEqual(c.curated_list(release)["release"], release)
        self.assertTrue(c.shipped(DATA / "curated-fedora-45.json"))
        self.assertFalse(c.shipped(self.folder / "curated-fedora-45.json"))

    def test_an_unsigned_list_from_another_place_is_refused(self):
        (self.folder / "curated-ubuntu-24.04.json").write_bytes(listing())
        c.curated_list.cache_clear()
        with self.assertLogs("Suno_installer.classify", "WARNING"):
            self.assertEqual(self.outcome().source, "rules")
        self.assertEqual(c.curated_list("ubuntu-24.04"), {})

    def test_a_shipped_list_for_another_release_is_refused(self):
        os.environ.pop(c.DATA_ENVIRONMENT)
        c.curated_list.cache_clear()
        original = c._data_file
        c._data_file = lambda name: original("curated-fedora-45.json") if name.startswith("curated-") else original(name)
        try:
            with self.assertLogs("Suno_installer.classify", "WARNING"):
                self.assertEqual(c.curated_list("ubuntu-24.04"), {})
        finally:
            c._data_file = original


class ReviewedOnly(unittest.TestCase):
    """Release policy: only the review's own decisions install without asking."""

    def setUp(self):
        os.environ.pop(c.DATA_ENVIRONMENT, None)
        c.curated_list.cache_clear()

    def entry(self, release, agreement):
        entries = c.curated_list(release)["entries"]
        name = next(name for name, entry in entries.items() if entry.get("agreement") == agreement
                    and entry["kind"] != c.CHOICE and not entry.get("refused"))
        return name, c.classify(Request(PackageInfo(name), release=release))

    def test_a_reviewed_entry_decides_without_asking(self):
        for release in ("ubuntu-24.04", "fedora-45"):
            name, result = self.entry(release, "reviewed")
            self.assertIn(c.REVIEWED, result.flags, name)
            self.assertFalse(result.ask, name)

    def test_an_unreviewed_entry_is_asked(self):
        for release in ("ubuntu-24.04", "fedora-45"):
            name, result = self.entry(release, "unanimous")
            self.assertNotIn(c.REVIEWED, result.flags, name)
            self.assertTrue(result.ask, name)
            self.assertTrue(result.source.startswith("curated:"), name)

    def test_every_unreviewed_shipped_entry_is_asked(self):
        for release in ("ubuntu-24.04", "fedora-45"):
            for name, entry in c.curated_list(release)["entries"].items():
                result = c._with_defaults(c._from_curated(entry))
                if entry.get("agreement") != "reviewed":
                    self.assertTrue(result.ask, name)


if __name__ == "__main__":
    unittest.main()
