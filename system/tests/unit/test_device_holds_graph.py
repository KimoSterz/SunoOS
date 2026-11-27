# SPDX-License-Identifier: Apache-2.0
"""Per-device update holds: state file -> signed generic graph -> Suno-update."""
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "scripts/os/lib"
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(ROOT / "src/Suno-update"))
sys.path.insert(0, str(ROOT / "src/Suno-update/tests"))

import device_holds  # noqa: E402
import graph_from_releases  # noqa: E402
import update_graph  # noqa: E402
from fakes import NOW, graph_doc, release  # noqa: E402
from Suno_update import graph as client  # noqa: E402
from Suno_update import versions  # noqa: E402

FP6 = "fairphone,fp6"
V = ["1.0.0-nightly.20261117.2", "1.0.0-nightly.20261119.2", "1.0.0-nightly.20261123.2"]


class Fixture(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.repo = self.root / "publish/public-repo"
        for n, version in enumerate(V):
            commit = f"{n + 1:064x}"
            rel = self.repo / "Suno/releases/aarch64" / version
            rel.mkdir(parents=True)
            (rel / "manifest.json").write_text(json.dumps({
                "version": version, "commit": commit, "channel": "nightly", "architecture": "aarch64",
                "ref": "Suno/1/aarch64/nightly", "build_id": version[-10:], "published_utc": f"2026-11-2{n}T00:00:00Z"}))
            obj = self.repo / "objects" / commit[:2]
            obj.mkdir(parents=True, exist_ok=True)
            (obj / (commit[2:] + ".commit")).write_text("")

    def cli(self, *args):
        return subprocess.run([sys.executable, str(ROOT / "scripts/os/device-hold.py"), *args,
                               "--arch", "aarch64", "--channel", "nightly", "--root", str(self.root)],
                              capture_output=True, text=True)

    def render(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(graph_from_releases.main(["g", str(self.repo), "nightly", "aarch64"]), 0)
        return json.loads(out.getvalue())

    def held(self, graph):
        return {r["version"]: [h["hardware_target"] for h in r.get("device_holds", [])] for r in graph["releases"]}

    def test_hold_marks_only_newer_releases_and_validates(self):
        r = self.cli("hold", "--target", FP6, "--good-through", V[1], "--reason", "FP6 audio check pending")
        self.assertEqual(r.returncode, 0, r.stderr)
        graph = self.render()
        self.assertEqual(self.held(graph), {V[0]: [], V[1]: [], V[2]: [FP6]})
        releases = {r["commit"]: r["version"] for r in graph["releases"]}
        self.assertEqual(update_graph.validate(graph, "nightly", "aarch64", releases=releases), [])
        parsed = client.parse_graph(json.dumps(graph).encode())
        now = datetime.now(timezone.utc).timestamp()
        pick = lambda targets: client.select_target(parsed, booted_version=versions.parse(V[0]),
                                                    booted_commit=f"{1:064x}", wariness=0.5, now=now,
                                                    device_targets=targets).release.version
        self.assertEqual(str(pick(frozenset({FP6}))), V[1])
        self.assertEqual(str(pick(frozenset({"raspberrypi,rpi5"}))), V[2])
        self.assertEqual(str(pick(frozenset())), V[2])

    def test_lift_on_newest_removes_the_hold(self):
        self.cli("hold", "--target", FP6, "--good-through", V[0], "--reason", "pending")
        self.assertEqual(self.held(self.render())[V[1]], [FP6])
        self.assertEqual(self.cli("lift", "--target", FP6, "--passed", V[1]).returncode, 0)
        self.assertEqual(self.held(self.render()), {V[0]: [], V[1]: [], V[2]: [FP6]})
        self.assertEqual(self.cli("lift", "--target", FP6, "--passed", V[2]).returncode, 0)
        self.assertEqual(self.render()["releases"][-1].get("device_holds"), None)
        self.assertNotIn(FP6, json.loads(self.cli("show").stdout))

    def test_a_second_pending_check_never_widens_a_hold(self):
        self.cli("hold", "--target", FP6, "--good-through", V[0], "--reason", "pending 1119")
        self.cli("hold", "--target", FP6, "--good-through", V[1], "--reason", "pending 1123")
        state = json.loads(self.cli("show").stdout)
        self.assertEqual(state[FP6]["good_through"], V[0])

    def test_unknown_device_and_unpublished_version_refused(self):
        self.assertNotEqual(self.cli("hold", "--target", "fairphone,fp5", "--good-through", V[0],
                                     "--reason", "x").returncode, 0)
        self.assertNotEqual(self.cli("hold", "--target", FP6, "--good-through", "1.0.0-nightly.20200101.1",
                                     "--reason", "x").returncode, 0)


class Validator(unittest.TestCase):
    def validate(self, holds, target=None):
        doc = graph_doc([release("1.0.0", 1, device_holds=holds)], arch="aarch64")
        if target:
            doc.update(schema_version=2, hardware_target=target)
        return update_graph.validate(doc, "stable", "aarch64", hardware_target=target,
                                     now=datetime.fromtimestamp(NOW, timezone.utc))

    def test_valid_hold(self):
        self.assertEqual(self.validate([{"hardware_target": FP6, "reason": "audio"}]), [])

    def test_bad_holds(self):
        for holds in ([], [{"hardware_target": "fairphone,fp5"}], [{"hardware_target": FP6, "x": 1}],
                      [{"hardware_target": FP6}, {"hardware_target": FP6}], [{"hardware_target": FP6, "reason": "a\nb"}]):
            with self.subTest(holds=holds):
                self.assertTrue(self.validate(holds))

    def test_device_graph_cannot_carry_holds(self):
        self.assertTrue(self.validate([{"hardware_target": FP6}], target=FP6))


if __name__ == "__main__":
    unittest.main()
