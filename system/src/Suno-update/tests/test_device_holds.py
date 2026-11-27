# SPDX-License-Identifier: Apache-2.0
"""Graph device holds: one ARM image, a release held for one device class only."""
import json
import tempfile
import unittest
from pathlib import Path

from fakes import commit, graph_doc, release
from Suno_update import graph as g
from Suno_update import hardware, versions

FP6 = "fairphone,fp6"
HOLD = [{"hardware_target": FP6, "reason": "Fairphone 6 audio check pending"}]


def parse(doc):
    return g.parse_graph(json.dumps(doc).encode())


def doc():
    return graph_doc([release("1.0.0", 1), release("1.0.1", 2), release("1.0.2", 3, device_holds=HOLD)],
                     arch="aarch64")


def select(targets, booted="1.0.0", n=1):
    return g.select_target(parse(doc()), booted_version=versions.parse(booted), booted_commit=commit(n),
                           wariness=0.5, now=g.datetime.now(g.timezone.utc).timestamp(), device_targets=targets)


class Selection(unittest.TestCase):
    def test_other_devices_take_the_held_release(self):
        for targets in (frozenset(), frozenset({"raspberrypi,rpi5"}), frozenset({"microsoft,sp12in"})):
            decision = select(targets)
            self.assertEqual((decision.action, str(decision.release.version)), ("update", "1.0.2"))

    def test_held_device_stays_on_its_last_good_release(self):
        decision = select(frozenset({FP6}))
        self.assertEqual((decision.action, str(decision.release.version)), ("update", "1.0.1"))
        decision = select(frozenset({FP6}), booted="1.0.1", n=2)
        self.assertEqual((decision.action, decision.reason, str(decision.waiting.version)),
                         ("none", "device-held", "1.0.2"))
        self.assertEqual(decision.waiting.held_for({FP6}).reason, "Fairphone 6 audio check pending")

    def test_switch_now_skips_held_releases(self):
        decision = g.select_switch_now(parse(doc()), wariness=0.5, now=g.datetime.now(g.timezone.utc).timestamp(),
                                       device_targets=frozenset({FP6}))
        self.assertEqual(str(decision.release.version), "1.0.1")

    def test_graph_without_holds_parses_unchanged(self):
        self.assertEqual(parse(graph_doc([release("1.0.0", 1)])).releases[0].device_holds, ())

    def test_malformed_holds_refuse_the_graph(self):
        for bad in ({"hardware_target": FP6}, [{"hardware_target": "Bad Target"}], [{"reason": "x"}],
                    [{"hardware_target": FP6}, {"hardware_target": FP6}], ["fairphone,fp6"]):
            with self.assertRaises(g.GraphError):
                parse(graph_doc([release("1.0.0", 1, device_holds=bad)]))


class Identity(unittest.TestCase):
    def paths(self, raw):
        root = Path(tempfile.mkdtemp())
        if raw is not None:
            (root / "proc/device-tree").mkdir(parents=True)
            (root / "proc/device-tree/compatible").write_bytes(raw)
        return type("P", (), {"device_tree_compatible": root / "proc/device-tree/compatible"})()

    def test_device_tree_names_the_target_whatever_stream_it_follows(self):
        self.assertEqual(hardware.device_targets(self.paths(b"fairphone,fp6\0qcom,qcm6490\0")), {FP6})
        self.assertEqual(hardware.device_targets(self.paths(b"raspberrypi,5-model-b\0brcm,bcm2712\0")),
                         {"raspberrypi,rpi5"})

    def test_uefi_machine_matches_nothing(self):
        self.assertEqual(hardware.device_targets(self.paths(None)), frozenset())

    def test_configured_target_always_counts(self):
        self.assertEqual(hardware.device_targets(self.paths(None), FP6), {FP6})


if __name__ == "__main__":
    unittest.main()
