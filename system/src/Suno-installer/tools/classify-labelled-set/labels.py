# SPDX-License-Identifier: Apache-2.0
"""Label files for the labelled sets, in either format.

    id  expected  adr  note                    (the development set, expectations.tsv)
    release  name  label  alt  note            (the blind sets)

``read(path)`` returns {id: Label}; ids are "ubuntu:NAME" or "fedora:NAME".
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Label:
    expected: str
    adr: str = "-"     # the kind ADR-052's literal rules give, when a label disputes them
    note: str = ""
    alt: str = ""      # a second acceptable kind, when the labeller gave one


def family(release: str) -> str:
    return "ubuntu" if release.startswith(("ubuntu", "debian")) else "fedora"


def read(path: Path) -> dict[str, Label]:
    out: dict[str, Label] = {}
    blind = False
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t") + [""] * 5
        if parts[0] in ("id", "release"):
            blind = parts[0] == "release"
            continue
        if blind:
            out[f"{family(parts[0])}:{parts[1]}"] = Label(parts[2], "-", parts[4], parts[3])
        else:
            out[parts[0]] = Label(parts[1], parts[2] or "-", parts[3])
    return out
