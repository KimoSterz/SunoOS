#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Classify the labelled set and compare it with the hand labels (ADR-052 Amendment 1, gate 4).

    run.py corpus.json OUT_DIRECTORY [--expectations LABELS.tsv]

LABELS.tsv (default: expectations.tsv beside this script) has the columns id,
expected kind, ADR kind ('-' when the same), note; lines starting with '#' are
comments. Only requests in both the corpus and the labels are scored: corpus rows
without a label are listed as unlabelled, labels without a corpus row as missing.
A "choice" result agrees when the label is one of its candidate kinds; choices are
counted separately.

Writes OUT_DIRECTORY/results.tsv (every request: id, kind, label, flags, refusal,
first reasons) and OUT_DIRECTORY/report.txt (agreement, the hard requirement
"no application classified as a system module or system tool", every
disagreement). Exits non-zero when the gate fails: agreement under 98 %, any
application classified as a system module or tool, or any other non-system package
(label not system-module/system-tool) classified as one without a choice.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
from luma_installer import classify as c  # noqa: E402

PRIVILEGED = (c.SYSTEM_MODULE, c.SYSTEM_TOOL)


def info(data: dict) -> c.PackageInfo:
    return c.PackageInfo(
        data["name"], data.get("version", ""), data.get("family", "deb"), data.get("architecture", ""),
        data.get("fields", {}), tuple(data.get("depends", ())), (), (), tuple(data.get("files", ())), (),
        tuple(c.DesktopEntry(entry["path"], entry.get("exec"), entry.get("no_display"), entry.get("terminal", False),
                             tuple(entry.get("categories") or ())) for entry in data.get("desktop", ())),
        tuple(c.Policy(policy["path"], tuple(policy["exec_paths"]) if policy.get("exec_paths") is not None else None)
              for policy in data.get("policies", ())),
        tuple(data.get("setuid", ())), tuple(data.get("capabilities", ())),
        tuple((item["path"], item.get("exec", "")) for item in data.get("autostart", ())),
        tuple((item["path"], item.get("exec", "")) for item in data.get("session_services", ())))


def labels(path: Path) -> dict[str, tuple[str, str, str]]:
    import labels as label_files
    return {key: (value.expected, value.adr, value.note, value.alt) for key, value in label_files.read(path).items()}


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("corpus", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--expectations", type=Path, default=HERE / "expectations.tsv")
    parser.add_argument("--curated", action="store_true", help="let the curated list decide first (default: the rules)")
    arguments = parser.parse_args()
    corpus, out = arguments.corpus, arguments.out
    out.mkdir(parents=True, exist_ok=True)
    expected = labels(arguments.expectations)
    rows, missing, unlabelled = [], [], []
    for row in json.loads(corpus.read_text())["rows"]:
        if row.get("missing"):
            missing.append(row["id"])
            continue
        request = c.Request(info(row["package"]), tuple(info(dep) for dep in row["dependencies"]),
                            arrival=c.COMMAND, release=row["release"],
                            dependents=tuple(info(dep) for dep in row.get("dependents", ())),
                            curated=arguments.curated)
        result = c.classify(request)
        label = expected.get(row["id"])
        if label is None:
            unlabelled.append(row["id"])
        rows.append((row, result, label))

    lines = ["id\tkind\texpected\tadr\tagree\tflags\trefused\treasons\tdefault\task\tnotice"]
    for row, result, label in rows:
        kind = result.kind
        if result.kind == c.CHOICE:
            kind = "choice:" + "|".join(result.choices)
        lines.append("\t".join([row["id"], kind, label[0] if label else "", label[1] if label else "",
                                "yes" if label and (label[0] == result.kind or label[0] in result.choices) else "no",
                                ",".join(result.flags),
                                result.refused, " | ".join(result.reasons[:4]), result.default,
                                "yes" if result.ask else "", result.notice]))
    (out / "results.tsv").write_text("\n".join(lines) + "\n")

    judged = [(row, result, label) for row, result, label in rows if label]
    def matches(kind: str, result: c.Classification) -> bool:
        return kind == result.kind or (result.kind == c.CHOICE and kind in result.choices)

    agree = [item for item in judged if matches(item[2][0], item[1])]
    lenient = [item for item in judged if matches(item[2][0], item[1]) or (item[2][3] and matches(item[2][3], item[1]))]
    wrong = [item for item in judged if not matches(item[2][0], item[1])]
    choices = [item for item in judged if item[1].kind == c.CHOICE]
    seen = {row["id"] for row, _, _ in rows}
    not_in_corpus = sorted(set(expected) - seen - set(missing))
    app_privileged = [item for item in judged if item[2][0] == c.APPLICATION and item[1].kind in PRIVILEGED]
    silent = [item for item in judged if item[2][0] not in PRIVILEGED and item[1].kind in PRIVILEGED]
    windowless = [item for item in judged if c.GUI_LAUNCHER in item[1].flags
                  and item[1].default in (c.WORKSPACE, c.CONSOLE_APPLICATION, c.DEVICE_ADD_ON)]
    by_default = [item for item in judged if item[1].default == item[2][0]]
    by_default_alt = [item for item in judged if item[1].default in (item[2][0], item[2][3])]
    asked = [item for item in judged if item[1].ask]
    breakage = [item for item in judged if item[2][0] in PRIVILEGED
                and item[1].default in (c.WORKSPACE, c.APPLICATION, c.CONSOLE_APPLICATION) and not item[1].notice]
    inspected = sum(1 for row, _, _ in judged if row["package"].get("inspected"))
    safe = (c.WORKSPACE, c.APPLICATION, c.CONSOLE_APPLICATION, c.DEVICE_ADD_ON, c.DEVICE_REQUEST, c.SOURCE)
    harmful = [item for item in judged if item[1].default != item[2][0] and (
        (item[2][0] not in PRIVILEGED and item[1].kind in PRIVILEGED)            # a silent system change
        or (item[2][0] in PRIVILEGED and item[1].default in safe and not item[1].notice)  # silent breakage
        or (item[2][0] == c.APPLICATION and item[1].default in (c.WORKSPACE, c.DEVICE_ADD_ON)))]  # a window unsandboxed
    adr_rows = [item for item in judged if item[2][1] not in ("", "-")]
    by_family = Counter(row["id"].split(":")[0] for row, _, _ in judged)
    agree_family = Counter(row["id"].split(":")[0] for row, _, _ in agree)
    confusion = Counter((label[0], result.kind) for _, result, label in wrong)
    rate = len(agree) / len(judged) if judged else 0.0
    # The same comparison with the ADR's literal kind where a label disputes it: how
    # faithfully the classifier implements ADR-052 as written.
    adr_agree = [item for item in judged
                 if matches(item[2][1] if item[2][1] not in ("", "-") else item[2][0], item[1])]
    report = [
        f"Labelled set: {len(judged)} requests ({', '.join(f'{k} {v}' for k, v in sorted(by_family.items()))}); "
        f"{len(missing)} names missing from the release; {len(unlabelled)} unlabelled.",
        f"Agreement: {len(agree)}/{len(judged)} = {rate:.2%} "
        f"({', '.join(f'{k} {agree_family[k]}/{v}' for k, v in sorted(by_family.items()))}). Gate: >= 98 %.",
        f"Counting the labeller's alternative kind too: {len(lenient)}/{len(judged)} = "
        f"{len(lenient) / max(len(judged), 1):.2%}.",
        f"Applications classified as system modules or system tools: {len(app_privileged)} (gate: 0).",
        f"Non-system packages silently classified as system modules or system tools: {len(silent)} (gate: 0)"
        + (": " + ", ".join(row["id"] for row, _, _ in silent) if silent else "."),
        f"With DEFAULT-RULE applied (a choice agrees when its default is the label): {len(by_default)}/{len(judged)} = "
        f"{len(by_default) / max(len(judged), 1):.2%} strict, {len(by_default_alt) / max(len(judged), 1):.2%} with the "
        f"labeller's alternative; asked {len(asked)}/{len(judged)} = {len(asked) / max(len(judged), 1):.2%}.",
        f"Silent breakage (labelled system module or tool, installed as workspace or application without a notice): "
        f"{len(breakage)} (gate: 0)" + (": " + ", ".join(row["id"] for row, _, _ in breakage) if breakage else "."),
        f"Packages with a launcher installed by default as a workspace package or device add-on: {len(windowless)} (gate: 0)"
        + (": " + ", ".join(row["id"] for row, _, _ in windowless) if windowless else "."),
        f"Read from the package file (not only indices): {inspected}/{len(judged)}.",
        f"Harmful disagreements (with defaults applied: silent system change, silent breakage, a window "
        f"outside the sandbox): {len(harmful)}.",
        f"Choices (the person picks): {len(choices)}; agreeing (label among the candidates): "
        f"{sum(1 for item in choices if item in agree)}.",
        f"Agreement with ADR-052's literal rules (the ADR column where a label disputes them): "
        f"{len(adr_agree)}/{len(judged)} = {len(adr_agree) / len(judged):.2%}.",
        f"Rows where the label differs from ADR-052's literal rules: {len(adr_rows)}; "
        f"the classifier follows the label in {sum(1 for _, r, l in adr_rows if r.kind == l[0])}.",
        "", "Label distribution: " + ", ".join(f"{k} {v}" for k, v in Counter(l[0] for _, _, l in judged).most_common()),
        "Disagreements by (label -> classifier): " + ", ".join(f"{a}->{b} {n}" for (a, b), n in confusion.most_common()),
        "", "Disagreements:"]
    for row, result, label in wrong:
        note = f" [label note: {label[2]}]" if label[2] else ""
        adr = f" [ADR rules: {label[1]}]" if label[1] not in ("", "-") else ""
        shown = result.kind + (f" ({'|'.join(result.choices)})" if result.choices else "")
        report.append(f"  {row['id']}: label {label[0]}, classifier {shown}{adr}{note}")
        for reason in result.reasons[:3]:
            report.append(f"      - {reason}")
    if missing:
        report += ["", "Missing from the release: " + ", ".join(missing)]
    if unlabelled:
        report += ["", "Unlabelled (in the corpus, not scored): " + ", ".join(unlabelled)]
    if not_in_corpus:
        report += ["", "Labelled but not in the corpus (not scored): " + ", ".join(not_in_corpus)]
    (out / "report.txt").write_text("\n".join(report) + "\n")
    print("\n".join(report[:15]))
    return 0 if rate >= 0.98 and not app_privileged and not silent and not windowless and not breakage else 1


if __name__ == "__main__":
    sys.exit(main())
