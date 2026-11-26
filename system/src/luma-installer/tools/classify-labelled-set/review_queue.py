#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""The curated list's review queue.

    review_queue.py apply QUEUE.tsv CURATED.json      apply reviewed rows (a filled "decision")
    review_queue.py report REPORT.json QUEUE.tsv      add a "wrong class" report to the queue

The queue is a TSV that curate.py writes: every entry where the classifier and the
distributions' metadata disagree or conflict, every entry without a metadata vote whose
outcome could do harm (a system module or tool, a notice, a choice, a device add-on or
request), plus a fixed-seed 5 % audit sample of the rest (unanimous entries and harmless
entries without a vote: decisive application or workspace, no notice, no choice). Rows are ranked by installs; "review" says
which to review ("yes": the top rows; "audit": the sample; "long-tail": left to the
classifier's safe default at install time, no curated entry). A reviewer fills "decision"
(a kind from luma_installer.classify.KINDS other than choice, "choice:<kind>|<kind>" for an
adjudicated choice, or "keep" for the classifier's outcome) and "reviewer", and may add a "note"; ``apply`` writes those rows into the curated
list (per-entry source "review:<reviewer>") and bumps its list_version. Reports
from people or Luma ("this was installed as the wrong class") use
data/classify/wrong-class-report.schema.json and land in the same queue.
"""
from __future__ import annotations

import csv
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from luma_installer import classify as c  # noqa: E402

COLUMNS = ("release", "name", "version", "reason", "review", "rank", "popularity", "classifier_kind",
           "classifier_default", "choices", "notice", "metadata_class", "metadata_sources", "decision", "reviewer",
           "note")
AUDIT_SEED = 20261125
AUDIT_SHARE = 0.05
REPORT_SCHEMA = HERE.parent.parent / "data/classify/wrong-class-report.schema.json"


def queue_rows(entries: dict[str, dict], release: str) -> tuple[list[dict], int, int]:
    """(queue rows, unanimous count, audited count) for a curated list's entries."""
    rows, settled = [], []
    for name in sorted(entries):
        entry = entries[name]
        if entry["agreement"] in ("unanimous", "reviewed"):
            settled.append(name)
        elif entry["agreement"] == "no-metadata" and harmless(entry):
            settled.append(name)  # a safe default one tap reverses: the audit sample covers it
        else:
            reason = "no-vote-harm" if entry["agreement"] == "no-metadata" else entry["agreement"]
            rows.append(_row(release, name, entry, reason))
    pool = [name for name in settled if entries[name]["agreement"] != "reviewed"]
    sample = random.Random(AUDIT_SEED).sample(pool, round(len(pool) * AUDIT_SHARE)) if pool else []
    rows += [_row(release, name, entries[name], "audit") for name in sorted(sample)]
    unanimous = sum(1 for name in settled if entries[name]["agreement"] == "unanimous")
    return rows, unanimous, len(sample)


def harmless(entry: dict) -> bool:
    """A decisive, sandboxed outcome: application or workspace, no notice, no choice, no
    system candidate. Review effort follows harm: such a row skips review beyond the audit."""
    return (entry["kind"] in (c.APPLICATION, c.WORKSPACE) and not entry.get("notice") and not entry.get("choices")
            and not entry.get("ask"))


def _row(release: str, name: str, entry: dict, reason: str) -> dict:
    return {"release": release, "name": name, "version": entry.get("version", ""), "reason": reason,
            "review": "", "rank": "", "popularity": "",
            "classifier_kind": entry["kind"], "classifier_default": entry.get("default", entry["kind"]),
            "choices": "|".join(entry.get("choices", ())), "notice": entry.get("notice", ""),
            "metadata_class": entry.get("metadata", {}).get("class", ""),
            "metadata_sources": "; ".join(f"{key}={value}" for key, value in
                                          sorted(entry.get("metadata", {}).get("sources", {}).items())),
            "decision": "", "reviewer": "", "note": ""}


def write_queue(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, COLUMNS, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def read_queue(path: Path) -> list[dict]:
    with path.open(newline="") as stream:
        return list(csv.DictReader(stream, delimiter="\t"))


def apply(queue: Path, curated: Path) -> int:
    """Write reviewed decisions into the curated list; returns how many entries changed."""
    data = json.loads(curated.read_text())
    changed = 0
    for row in read_queue(queue):
        decision, reviewer = row.get("decision", "").strip(), row.get("reviewer", "").strip()
        if not decision or row["release"] != data["release"]:
            continue
        if not reviewer:
            raise SystemExit(f"{row['name']}: a decision needs a reviewer")
        entry = data["entries"].setdefault(row["name"], {
            "version": row.get("version", ""), "kind": row["classifier_kind"],
            "default": row.get("classifier_default") or row["classifier_kind"]})
        if decision == "keep" and row.get("choices"):
            entry["choices"] = row["choices"].split("|")
        if decision == "keep" and row.get("notice"):
            entry["notice"] = row["notice"]
        if decision.startswith("choice:"):  # an adjudicated choice: "choice:workspace|system-tool"
            kinds = tuple(decision[len("choice:"):].split("|"))
            if len(kinds) < 2 or any(kind not in c.KINDS or kind == c.CHOICE for kind in kinds):
                raise SystemExit(f"{row['name']}: {decision!r} is not a choice of kinds")
            outcome = c._with_defaults(c.Classification(c.CHOICE, (), choices=kinds))
            entry.update({"kind": c.CHOICE, "choices": list(kinds), "default": outcome.default, "ask": outcome.ask})
            if outcome.notice:
                entry["notice"] = outcome.notice
            else:
                entry.pop("notice", None)
        elif decision != "keep":
            if decision not in c.KINDS or decision == c.CHOICE:
                raise SystemExit(f"{row['name']}: {decision!r} is not a kind")
            entry.update({"kind": decision, "default": decision, "ask": False})
            entry.pop("choices", None)
            entry.pop("notice", None)
        entry["source"] = f"review:{reviewer}"
        entry["agreement"] = "reviewed"
        if row.get("note"):
            entry["review_note"] = row["note"]
        changed += 1
    if changed:
        data["list_version"] = int(data.get("list_version", 0)) + 1
        data["reviewed"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        curated.write_text(canonical(data))
    return changed


def canonical(data: dict) -> str:
    """The bytes that are signed: sorted keys, no extra whitespace, one trailing newline."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n"


REQUIRED = ("release", "package", "outcome_kind", "expected_kind", "reporter")


def report(report_path: Path, queue: Path) -> None:
    """Add a wrong-class report (wrong-class-report.schema.json) to the queue."""
    data = json.loads(report_path.read_text())
    missing = [key for key in REQUIRED if not data.get(key)]
    if missing:
        raise SystemExit(f"report misses {', '.join(missing)}")
    if data["expected_kind"] not in c.KINDS or data["outcome_kind"] not in c.KINDS:
        raise SystemExit("outcome_kind and expected_kind must be classifier kinds")
    if data["reporter"] not in ("person", "luma", "agent"):
        raise SystemExit("reporter must be person, luma or agent")
    rows = read_queue(queue) if queue.exists() else []
    rows.append({"release": data["release"], "name": data["package"], "version": data.get("version", ""),
                 "reason": f"report:{data['reporter']}", "review": "yes", "rank": "", "popularity": "", "classifier_kind": data["outcome_kind"],
                 "classifier_default": data["outcome_kind"], "choices": "", "notice": "",
                 "metadata_class": data["expected_kind"], "metadata_sources": "reported",
                 "decision": "", "reviewer": "", "note": data.get("note", "")[:500]})
    write_queue(queue, rows)


def main() -> int:
    if len(sys.argv) == 4 and sys.argv[1] == "apply":
        print(f"{apply(Path(sys.argv[2]), Path(sys.argv[3]))} entries changed")
        return 0
    if len(sys.argv) == 4 and sys.argv[1] == "report":
        report(Path(sys.argv[2]), Path(sys.argv[3]))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
