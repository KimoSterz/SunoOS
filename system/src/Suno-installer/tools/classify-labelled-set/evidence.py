#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Evidence for reviewers: mechanical facts about each package in a review slice.

    evidence.py META FACTS.json SLICE.tsv OUT.txt

SLICE.tsv has columns release, name, version (more are ignored). OUT.txt gets one block
per row, in slice order: description, section, launchers, autostart, units, udev, PAM,
NSS, sbin and bin programs, fonts, firmware, libraries and headers, polkit actions,
setuid and capabilities, maintainer scripts and reverse dependencies. Nothing the
classifier decides is shown: no kind, default, choice, notice or metadata class.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import lzma
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from fnmatch import fnmatchcase
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
import build_corpus as bc  # noqa: E402

UNIT = re.compile(r"/(usr/)?lib/systemd/(system|user)/[^/]+\.(service|socket|timer|path|mount)$|"
                  r"^/etc/systemd/(system|user)/[^/]+\.(service|socket|timer)$")


def ubuntu_descriptions(meta: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for path in sorted((meta / "ubuntu").glob("*-Translation-en.xz")):
        for stanza in lzma.open(path, "rt", errors="replace").read().split("\n\n"):
            name = re.search(r"^Package: (\S+)", stanza, re.M)
            text = re.search(r"^Description-en: (.*(?:\n .*)*)", stanza, re.M)
            if name and text:
                out.setdefault(name.group(1), text.group(1))
    return out


def fedora_descriptions(meta: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for tag in ("releases", "updates"):
        root = ET.fromstring(bc.zstd_text(meta / "fedora" / f"{tag}-primary.xml.zst"))
        for element in root.findall("c:package", bc.NS):
            name = element.findtext("c:name", namespaces=bc.NS)
            out[name] = (element.findtext("c:summary", namespaces=bc.NS) or "") + "\n" + \
                (element.findtext("c:description", namespaces=bc.NS) or "")
    return out


def reverse_ubuntu(packages: dict[str, dict]) -> dict[str, list[str]]:
    reverse: dict[str, list[str]] = defaultdict(list)
    for name, fields in packages.items():
        for clause in bc.deb_alternatives(fields.get("Depends", "")) + bc.deb_alternatives(fields.get("Pre-Depends", "")):
            for target in clause:
                reverse[target].append(name)
    return reverse


def reverse_fedora(packages: dict[str, dict]) -> dict[str, list[str]]:
    providers: dict[str, set[str]] = defaultdict(set)
    for name, fields in packages.items():
        for value in fields["provides"] + fields["primary_files"]:
            providers[value].add(name)
        providers[name].add(name)
    reverse: dict[str, set[str]] = defaultdict(set)
    for name, fields in packages.items():
        for requirement in fields["requires"]:
            for target in providers.get(requirement, ()):
                if target != name:
                    reverse[target].add(name)
    return {key: sorted(value) for key, value in reverse.items()}


def block(name: str, version: str, fields: dict, description: str, files: list[str], fact: dict,
          dependents: list[str]) -> list[str]:
    def short(paths: list[str], limit: int = 6) -> str:
        return ", ".join(paths[:limit]) + (f" (+{len(paths) - limit} more)" if len(paths) > limit else "")

    lines = [f"## {name} {version}"]
    section = fields.get("Section") or fields.get("Group") or ""
    if section:
        lines.append(f"section: {section}")
    text = [line.strip() for line in description.splitlines() if line.strip() and line.strip() != "."]
    if text:
        lines.append(f"summary: {text[0][:150]}")
        for line in text[1:4]:
            lines.append(f"  {line[:150]}")
    desktop = fact.get("desktop") or []
    known = {entry["path"] for entry in desktop}
    for entry in desktop[:4]:
        lines.append(f"launcher: {entry['path']} Exec={entry.get('exec') or '?'} Terminal={str(entry.get('terminal')).lower()}"
                     f" NoDisplay={str(entry.get('no_display')).lower()}")
    others = [path for path in files if fnmatchcase(path, "/usr/share/applications/*") and path not in known]
    if others:
        lines.append(f"launcher files (not read): {short(others, 4)}")
    autostart = fact.get("autostart") or [{"path": path, "exec": "?"} for path in files
                                          if path.startswith("/etc/xdg/autostart/")]
    for entry in autostart[:3]:
        lines.append(f"autostart: {entry['path']} Exec={entry.get('exec') or '?'}")
    units = [path for path in files if UNIT.search(path)]
    if units:
        lines.append(f"units: {short(units)}")
    presets = [path for path in files if "/systemd/system-preset/" in path or "/systemd/user-preset/" in path]
    if presets:
        lines.append(f"presets: {short(presets, 3)}")
    groups = (
        ("udev/hwdb", ("/lib/udev/*", "/usr/lib/udev/*", "/etc/udev/*")),
        ("pam.d", ("/etc/pam.d/*", "/usr/lib/pam.d/*")),
        ("PAM modules", ("*/security/*.so",)),
        ("NSS modules", ("*/libnss_*.so*",)),
        ("session D-Bus services", ("/usr/share/dbus-1/services/*",)),
        ("system D-Bus services/policy", ("/usr/share/dbus-1/system-services/*", "/usr/share/dbus-1/system.d/*",
                                          "/etc/dbus-1/system.d/*")),
        ("kernel modules/DKMS", tuple(f"{root}/*.ko{ending}" for root in ("/lib/modules", "/usr/lib/modules")
                                      for ending in ("", ".xz", ".zst", ".gz"))
         + ("/usr/src/*/dkms.conf", "/usr/src/akmods/*")),
        ("sbin programs", ("/usr/sbin/*", "/sbin/*")),
    )
    for label, patterns in groups:
        hits = [path for path in files if any(fnmatchcase(path, pattern) for pattern in patterns)]
        if hits:
            lines.append(f"{label}: {short(hits)}")
    binaries = [path for path in files if path.startswith(("/usr/bin/", "/bin/", "/usr/games/"))]
    if binaries:
        lines.append(f"bin programs: {short(binaries, 10)}")
    counts = (("font files", lambda path: re.search(r"\.(ttf|otf|ttc|woff2?|pfb|pcf(\.gz)?|otb|bdf)$", path)),
              ("firmware files", lambda path: path.startswith(("/lib/firmware/", "/usr/lib/firmware/"))),
              (".so files", lambda path: ".so" in Path(path).name),
              (".h files", lambda path: path.endswith(".h")))
    tally = [f"{label} {sum(1 for path in files if test(path))}" for label, test in counts
             if any(test(path) for path in files)]
    if tally:
        lines.append("counts: " + ", ".join(tally) + f", files {len(files)}")
    else:
        lines.append(f"counts: files {len(files)}")
    for item in (fact.get("policies") or [])[:3]:
        lines.append(f"polkit: {item['path']} exec.path={', '.join(item.get('exec_paths') or []) or 'none'}")
    if not fact.get("policies"):
        policies = [path for path in files if path.startswith("/usr/share/polkit-1/")]
        if policies:
            lines.append(f"polkit files (not read): {short(policies, 3)}")
    if fact.get("setuid"):
        lines.append(f"setuid/setgid: {short(fact['setuid'], 4)}")
    if fact.get("capabilities"):
        lines.append(f"file capabilities: {short(fact['capabilities'], 4)}")
    if fact:
        lines.append(f"maintainer scripts: {', '.join(fact.get('scripts') or []) or 'none'} (read from the package file)")
    else:
        lines.append("package file not read: launchers, modes and scripts unknown")
    if dependents:
        lines.append(f"reverse dependencies: {len(dependents)} ({', '.join(dependents[:5])}"
                     + (", ..." if len(dependents) > 5 else "") + ")")
    else:
        lines.append("reverse dependencies: none in the archive")
    return lines[:25]


def main() -> int:
    meta, facts_path = Path(sys.argv[1]), Path(sys.argv[2])
    jobs = [(Path(sys.argv[index]), Path(sys.argv[index + 1])) for index in range(3, len(sys.argv), 2)]
    facts = json.loads(facts_path.read_text())
    slices = []
    for source, target in jobs:
        with source.open(newline="") as stream:
            slices.append((target, list(csv.DictReader(stream, delimiter="\t"))))
    families = {("deb" if row["release"].startswith("ubuntu") else "rpm") for _, rows in slices for row in rows}
    data = {}
    for family in families:
        names = {row["name"] for _, rows in slices for row in rows
                 if ("deb" if row["release"].startswith("ubuntu") else "rpm") == family}
        if family == "deb":
            packages = bc.load_ubuntu(meta)
            files = bc.read_contents(meta, names)
            descriptions = ubuntu_descriptions(meta)
            reverse = reverse_ubuntu(packages)
        else:
            packages = bc.load_fedora(meta)
            files = bc.read_filelists(meta, names)
            descriptions = fedora_descriptions(meta)
            reverse = reverse_fedora(packages)
        data[family] = (packages, files, descriptions, reverse)
    for target, rows in slices:
        out = []
        for row in rows:
            family = "deb" if row["release"].startswith("ubuntu") else "rpm"
            packages, files, descriptions, reverse = data[family]
            fields = packages.get(row["name"], {})
            version = row.get("version") or fields.get("Version", "")
            fact = facts.get(f"{family}:{row['name']}:{version}") or next(
                (value for key, value in facts.items() if key.startswith(f"{family}:{row['name']}:")), {})
            if "error" in fact:
                fact = {}
            out += block(row["name"], version, fields, descriptions.get(row["name"], fields.get("Description", "")),
                         files.get(row["name"], []), fact, sorted(set(reverse.get(row["name"], ()))))
            out.append("")
        target.write_text("\n".join(out))
        print(f"{target}: {len(rows)} blocks", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
