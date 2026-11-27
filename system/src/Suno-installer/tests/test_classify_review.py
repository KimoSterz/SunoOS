# SPDX-License-Identifier: Apache-2.0
"""The curated list's review queue (tools/classify-labelled-set/review_queue.py)."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent.parent / "tools/classify-labelled-set"
if not (TOOLS / "review_queue.py").is_file():  # the package build carries the installer, not the labelling tools
    raise unittest.SkipTest("tools/classify-labelled-set is not in this tree")
sys.path.insert(0, str(TOOLS))
import review_queue  # noqa: E402

from Suno_installer import classify as c  # noqa: E402


def entries(count: int) -> dict:
    out = {f"unanimous{index}": {"kind": c.WORKSPACE, "default": c.WORKSPACE, "agreement": "unanimous"}
           for index in range(count)}
    out["disputed"] = {"kind": c.CHOICE, "default": c.WORKSPACE, "choices": [c.WORKSPACE, c.SYSTEM_TOOL],
                       "agreement": "disagree", "metadata": {"class": c.SYSTEM_TOOL, "sources": {"debtags": c.SYSTEM_TOOL}}}
    return out


class Queue(unittest.TestCase):
    def test_review_follows_harm(self):
        entries_ = {"tool": {"kind": c.WORKSPACE, "default": c.WORKSPACE, "agreement": "no-metadata"},
                    "service": {"kind": c.SYSTEM_MODULE, "default": c.SYSTEM_MODULE, "agreement": "no-metadata"},
                    "noticed": {"kind": c.CHOICE, "default": c.WORKSPACE, "choices": [c.WORKSPACE, c.SYSTEM_TOOL],
                                "notice": "x", "agreement": "no-metadata"},
                    "theme": {"kind": c.DEVICE_ADD_ON, "default": c.DEVICE_ADD_ON, "agreement": "no-metadata"}}
        rows, _, _ = review_queue.queue_rows(entries_, "fedora-45")
        queued = {row["name"]: row["reason"] for row in rows}
        self.assertEqual(queued, {"noticed": "no-vote-harm", "service": "no-vote-harm", "theme": "no-vote-harm"})

    def test_disagreements_and_a_fixed_five_percent_sample_are_queued(self):
        rows, unanimous, audited = review_queue.queue_rows(entries(100), "ubuntu-24.04")
        self.assertEqual((unanimous, audited, len(rows)), (100, 5, 6))
        again, _, _ = review_queue.queue_rows(entries(100), "ubuntu-24.04")
        self.assertEqual(rows, again)  # the sample's seed is fixed
        self.assertEqual(rows[0]["reason"], "disagree")
        self.assertEqual(rows[0]["metadata_sources"], "debtags=system-tool")

    def test_reviewed_rows_are_applied_to_the_list(self):
        with tempfile.TemporaryDirectory() as folder:
            curated = Path(folder) / "curated-ubuntu-24.04.json"
            curated.write_text(review_queue.canonical({"format": 1, "release": "ubuntu-24.04", "list_version": 1,
                                                       "entries": entries(3)}))
            rows, _, _ = review_queue.queue_rows(entries(3), "ubuntu-24.04")
            rows[0].update(decision=c.SYSTEM_TOOL, reviewer="review-agent", note="needs real root")
            queue = Path(folder) / "queue.tsv"
            review_queue.write_queue(queue, rows)
            self.assertEqual(review_queue.apply(queue, curated), 1)
            data = json.loads(curated.read_text())
            self.assertEqual(data["list_version"], 2)
            self.assertEqual(data["entries"]["disputed"]["kind"], c.SYSTEM_TOOL)
            self.assertEqual(data["entries"]["disputed"]["source"], "review:review-agent")
            self.assertNotIn("choices", data["entries"]["disputed"])

    def test_an_adjudicated_choice_is_applied_with_its_default_and_notice(self):
        with tempfile.TemporaryDirectory() as folder:
            curated = Path(folder) / "c.json"
            curated.write_text(review_queue.canonical({"format": 1, "release": "fedora-45", "entries": {
                "lorax": {"kind": c.WORKSPACE, "default": c.WORKSPACE, "agreement": "unanimous"}}}))
            queue = Path(folder) / "q.tsv"
            row = review_queue._row("fedora-45", "lorax", {"kind": c.WORKSPACE}, "audit")
            row.update(decision="choice:workspace|system-tool", reviewer="adjudicator")
            review_queue.write_queue(queue, [row])
            self.assertEqual(review_queue.apply(queue, curated), 1)
            entry = json.loads(curated.read_text())["entries"]["lorax"]
            self.assertEqual((entry["kind"], entry["choices"], entry["default"], entry["ask"]),
                             (c.CHOICE, [c.WORKSPACE, c.SYSTEM_TOOL], c.WORKSPACE, False))
            self.assertIn("system tool", entry["notice"])
            self.assertEqual(entry["agreement"], "reviewed")
            row["decision"] = "choice:workspace|choice"
            review_queue.write_queue(queue, [row])
            with self.assertRaises(SystemExit):
                review_queue.apply(queue, curated)

    def test_a_decision_needs_a_reviewer_and_a_kind(self):
        with tempfile.TemporaryDirectory() as folder:
            curated = Path(folder) / "c.json"
            curated.write_text(review_queue.canonical({"format": 1, "release": "fedora-45", "entries": {}}))
            queue = Path(folder) / "q.tsv"
            row = review_queue._row("fedora-45", "x", {"kind": c.WORKSPACE}, "no-metadata")
            row["decision"] = "nonsense"
            row["reviewer"] = "someone"
            review_queue.write_queue(queue, [row])
            with self.assertRaises(SystemExit):
                review_queue.apply(queue, curated)

    def test_wrong_class_reports_join_the_queue(self):
        with tempfile.TemporaryDirectory() as folder:
            report = Path(folder) / "report.json"
            report.write_text(json.dumps({"release": "fedora-45", "package": "strace", "outcome_kind": c.WORKSPACE,
                                          "expected_kind": c.SYSTEM_TOOL, "reporter": "person",
                                          "note": "attaching to a system service fails"}))
            queue = Path(folder) / "queue.tsv"
            review_queue.report(report, queue)
            rows = review_queue.read_queue(queue)
            self.assertEqual((rows[0]["name"], rows[0]["reason"], rows[0]["metadata_class"]),
                             ("strace", "report:person", c.SYSTEM_TOOL))
            schema = json.loads(review_queue.REPORT_SCHEMA.read_text())
            self.assertEqual(sorted(schema["required"]), sorted(review_queue.REQUIRED))
            bad = Path(folder) / "bad.json"
            bad.write_text(json.dumps({"release": "fedora-45", "package": "x"}))
            with self.assertRaises(SystemExit):
                review_queue.report(bad, queue)


if __name__ == "__main__":
    unittest.main()
