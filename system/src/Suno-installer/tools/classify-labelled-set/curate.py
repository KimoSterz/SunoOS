#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Build the curated lists: data/classify/curated-<release>.json and their review queues.

    curate.py META WORK OUT_DATA_DIR QUEUE_DIR [--ubuntu N] [--fedora N] [--commit SHA]

Targets: Ubuntu 24.04's most installed packages (Debian popcon by_inst, names Ubuntu has),
and Fedora 45's packages in any comps group, then those with a launcher, a unit or a
program in /usr/bin or /usr/sbin. Every entry is pre-labelled with classify() (the rules,
not a list) on package facts: the indices for all, and the package file itself where the
index facts leave the classifier unsure (a choice, a system tool, an application) or a
launcher, a polkit policy, a unit, an autostart entry or an sbin program matters
(inspect_packages.py, checksummed, bandwidth-capped, nothing run).

The second opinion is the distributions' own metadata (metadata-map.txt): AppStream
component types, Debian debtags and Fedora comps groups. An entry is unanimous when that
metadata gives one class and it is the classifier's default; every other entry, and a
fixed-seed 5 % sample of the unanimous ones, goes to the review queue (review_queue.py).
"""
from __future__ import annotations

import argparse
import dataclasses
import gzip
import io
import json
import lzma
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone
from fnmatch import fnmatchcase
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
import build_corpus as bc  # noqa: E402
import inspect_packages as inspect  # noqa: E402
import review_queue  # noqa: E402
from Suno_installer import classify as c  # noqa: E402
from run import info  # noqa: E402

RELEASES = {"deb": "ubuntu-24.04", "rpm": "fedora-45"}
LIST_FORMAT = 1


# -- targets ------------------------------------------------------------------------------

def ubuntu_targets(meta: Path, count: int) -> list[str]:
    packages = bc.load_ubuntu(meta)
    ranked: list[str] = []
    with gzip.open(meta / "popcon" / "by_inst.gz", "rt", errors="replace") as stream:
        for line in stream:
            parts = line.split()
            if line.startswith("#") or len(parts) < 3:
                continue
            if parts[1] in packages and parts[1] not in ranked:
                ranked.append(parts[1])
                if len(ranked) >= count:
                    break
    return ranked


def fedora_targets(meta: Path, count: int) -> list[str]:
    packages = bc.load_fedora(meta)
    root = ET.fromstring(bc.zstd_text(meta / "fedora" / "updates-comps-Everything.x86_64.xml.zst"))
    names: list[str] = []
    for group in root.findall("group"):
        for item in group.findall("packagelist/packagereq"):
            if item.text in packages and item.text not in names:
                names.append(item.text)
    flags: dict[str, int] = {}
    for tag in ("releases", "updates"):
        text = bc.zstd_text(meta / "fedora" / f"{tag}-filelists.xml.zst")
        for _, element in ET.iterparse(io.BytesIO(text), events=("end",)):
            if element.tag != f"{{{bc.NS['f']}}}package":
                continue
            name, rank = element.get("name"), 9
            for item in element.findall("f:file", bc.NS):
                path = item.text or ""
                if fnmatchcase(path, "/usr/share/applications/*.desktop"):
                    rank = min(rank, 0)
                elif re.match(r"^/usr/lib/systemd/(system|user)/[^/]+\.(service|socket|timer)$", path):
                    rank = min(rank, 1)
                elif path.startswith(("/usr/bin/", "/usr/sbin/")):
                    rank = min(rank, 2)
            if rank < 9 and name in packages:
                flags[name] = min(rank, flags.get(name, 9))
            element.clear()
    rest = sorted((name for name in flags if name not in names), key=lambda name: (flags[name], name))
    return (names + rest)[:count]


# -- the distributions' metadata ----------------------------------------------------------

def read_map() -> dict[str, list[tuple[str, str]]]:
    sections: dict[str, list[tuple[str, str]]] = defaultdict(list)
    section = ""
    for raw in (HERE / "metadata-map.txt").read_text().splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        if line.startswith("["):
            section = line.strip("[] ")
            continue
        if section == "rpm-group":  # group names hold spaces: the class is the last word
            pattern, kind = line.rsplit(None, 1)
        else:
            pattern, kind = line.rsplit(None, 1)
        sections[section].append((pattern.strip(), kind))
    return sections


def appstream_types(meta: Path, family: str) -> dict[str, set[str]]:
    found: dict[str, set[str]] = defaultdict(set)
    if family == "deb":
        for path in sorted((meta / "ubuntu").glob("*-Components.yml.gz")):
            for document in gzip.open(path, "rt", errors="replace").read().split("\n---\n"):
                kind = re.search(r"^Type: (\S+)$", document, re.M)
                package = re.search(r"^Package: (\S+)$", document, re.M)
                if kind and package:
                    found[package.group(1)].add(kind.group(1))
    else:
        root = ET.fromstring(gzip.open(meta / "fedora" / "appstream-45.xml.gz").read())
        for component in root.findall("component"):
            package = component.findtext("pkgname")
            if package:
                found[package].add(component.get("type") or "generic")
    return found


DEBIAN_SECTIONS: dict[str, str] = {}


def debtags(meta: Path) -> dict[str, set[str]]:
    """Debian's debtags by package name; also fills DEBIAN_SECTIONS (Debian's Section field)."""
    tags: dict[str, set[str]] = {}
    for path in sorted((meta / "debian").glob("trixie-*-Packages.xz")):
        for stanza in lzma.open(path, "rt", errors="replace").read().split("\n\n"):
            name = re.search(r"^Package: (\S+)", stanza, re.M)
            tag = re.search(r"^Tag: (.*(?:\n .*)*)", stanza, re.M)
            section = re.search(r"^Section: (\S+)", stanza, re.M)
            if name and section:
                DEBIAN_SECTIONS[name.group(1)] = section.group(1).rsplit("/", 1)[-1]
            if name and tag:
                tags[name.group(1)] = {item.strip() for item in tag.group(1).replace("\n", " ").split(",") if item.strip()}
    return tags


def comps_groups(meta: Path) -> dict[str, set[str]]:
    root = ET.fromstring(bc.zstd_text(meta / "fedora" / "updates-comps-Everything.x86_64.xml.zst"))
    groups: dict[str, set[str]] = defaultdict(set)
    for group in root.findall("group"):
        for item in group.findall("packagelist/packagereq"):
            groups[item.text].add(group.findtext("id"))
    return groups


def _debtags_class(tags: set[str], rules: list[tuple[str, str]]) -> str:
    for pattern, kind in rules:
        terms = [term.strip() for term in pattern.split("&")]
        if all(any(fnmatchcase(tag, alternative.strip()) for tag in tags for alternative in term.split("|"))
               for term in terms):
            return kind
    return ""


BORROWED: dict[str, dict] = {}  # Fedora name -> {"section": ..., "tags": ...} from Debian/Ubuntu


def borrowable(meta: Path) -> None:
    """Debian/Ubuntu Section and debtags by binary name, and by source name through the binary
    named like its source, for Fedora packages of the same name (votes marked "borrowed")."""
    if BORROWED:
        return
    tags = debtags(meta)
    sections = dict(DEBIAN_SECTIONS)
    sources: dict[str, str] = {}
    for name, fields in bc.load_ubuntu(meta).items():
        sections.setdefault(name, (fields.get("Section") or "").rsplit("/", 1)[-1])
        sources.setdefault((fields.get("Source") or name).split()[0], name)
    for name in set(sections) | set(tags):
        BORROWED[name] = {"section": sections.get(name, ""), "tags": tags.get(name, set())}
    for source, name in sources.items():
        if source not in BORROWED and source in sections and name == source:
            BORROWED[source] = BORROWED[name]


def _section_vote(section: str, name: str, mapping: dict) -> str:
    kind = next((kind for pattern, kind in mapping["section"] if fnmatchcase(section, pattern)), "") if section else ""
    debian = DEBIAN_SECTIONS.get(name, "")
    if not kind and debian:  # Debian's finer section where Ubuntu's abstains (node-* in web -> javascript)
        kind = next((kind for pattern, kind in mapping["section"] if fnmatchcase(debian, pattern)), "")
    return kind


def metadata_opinion(name: str, family: str, appstream: dict, tags: dict, groups: dict,
                     mapping: dict, fields: dict | None = None) -> dict:
    """The distributions' metadata: one class when its voting sources agree. Fedora comps only
    breaks a tie between the others, never decides on its own or against them."""
    sources: dict[str, str] = {}
    fields = fields or {}
    types = appstream.get(name, set())
    order = ("desktop-application", "desktop", "console-application")
    preferred = next((value for value in order if value in types), "")
    kinds = {kind for pattern, kind in mapping["appstream"] for value in ([preferred] if preferred else types)
             if fnmatchcase(value, pattern)}
    if len(kinds) == 1:
        sources["appstream"] = kinds.pop()
    if family == "deb":
        kind = _section_vote((fields.get("Section") or "").rsplit("/", 1)[-1], name, mapping)
        if kind:
            sources["section"] = kind
        if name in tags:
            kind = _debtags_class(tags[name], mapping["debtags"])
            if kind:
                sources["debtags"] = kind
    else:
        group = fields.get("Group") or ""
        if group and group != "Unspecified":
            kind = next((kind for pattern, kind in mapping["rpm-group"] if fnmatchcase(group, pattern)), "")
            if kind:
                sources["rpm-group"] = kind
        borrowed = BORROWED.get(name) or BORROWED.get((fields.get("Source") or "").split()[0] if fields.get("Source")
                                                      else "")
        if borrowed:
            kind = _section_vote(borrowed["section"], name, mapping)
            if kind:
                sources["borrowed-section"] = kind
            kind = _debtags_class(borrowed["tags"], mapping["debtags"]) if borrowed["tags"] else ""
            if kind:
                sources["borrowed-debtags"] = kind
    values = set(sources.values())
    comps = set()
    if family == "rpm":
        comps = {kind for group in groups.get(name, ()) for pattern, kind in mapping["comps"]
                 if fnmatchcase(group, pattern)}
        if len(values) > 1 and len(comps) == 1 and comps <= values:  # comps breaks the tie
            sources["comps"] = next(iter(comps))
            return {"class": sources["comps"], "sources": sources, "tie_broken_by": "comps"}
        if comps:
            sources["comps(tie-breaker)"] = "|".join(sorted(comps))
    return {"class": values.pop() if len(values) == 1 else ("conflict" if values else ""), "sources": sources}


# -- the pipeline -------------------------------------------------------------------------

def classify_rows(rows: list[dict], release: str) -> dict[str, c.Classification]:
    out = {}
    for row in rows:
        if row.get("missing"):
            continue
        request = c.Request(info(row["package"]), tuple(info(dep) for dep in row["dependencies"]),
                            release=release, dependents=tuple(info(dep) for dep in row.get("dependents", ())),
                            curated=False)
        out[row["package"]["name"]] = c.classify(request)
    return out


def archive_launchers(rows: list[dict], appstream: dict[str, set[str]]) -> set[str]:
    """Packages of the archive with a launcher a person sees: an AppStream desktop application,
    or a target row's visible launcher (inspected) or /usr/share/applications entry (index)."""
    found = {name for name, kinds in appstream.items() if kinds & {"desktop-application", "desktop"}}
    for row in rows:
        package = row["package"]
        if package.get("inspected"):
            visible = any(entry.get("no_display") is not True and not entry.get("terminal")
                          for entry in package.get("desktop", ()))
        else:
            visible = any(fnmatchcase(path, "/usr/share/applications/*.desktop") for path in package["files"])
        if visible:
            found.add(package["name"])
    return found


def archive_host(package: c.PackageInfo, launchers: set[str], by_source: dict[str, set[str]]) -> str:
    """The application an inert package is made for, found in the whole archive when the request
    does not bring it: its source or a name prefix whose packages have a launcher, with the
    package's own files in that application's directories (none at all: transitional)."""
    if re.search(r"-(dev|dbg|doc)$", package.name):
        return ""
    parts = package.name.split("-")
    roots = [c._source(package)] + ["-".join(parts[:index]) for index in range(len(parts) - 1, 0, -1)]
    payload = [path for path in c._payload(package) if not path.startswith("/usr/include/")]
    for root in dict.fromkeys(root for root in roots if root != package.name and len(root) > 2):
        apps = sorted(name for name in by_source.get(root, set()) | {root} if name in launchers)
        inside = [path for path in payload if re.search(rf"/{re.escape(root)}[-_/]", path)]
        if apps and (2 * len(inside) > len(payload) or not c._payload(package)):
            return root if root in by_source.get(root, ()) else apps[0]
    return ""


def with_archive_host(package: c.PackageInfo, result: c.Classification, launchers: set[str],
                      by_source: dict[str, set[str]]) -> c.Classification:
    """An inert workspace package made for an application the archive has: that application's add-on."""
    if result.kind != c.WORKSPACE or result.choices or result.refused or result.add_on_of:
        return result
    host = archive_host(package, launchers, by_source)
    if not host:
        return result
    return dataclasses.replace(result, kind=c.APPLICATION, default=c.APPLICATION, add_on_of=host,
                               flags=result.flags + (c.APPLICATION_ADD_ON,),
                               reasons=(f"data or plugins for the application {host} (in the archive, not in "
                                        "the request): added to that application's tree",) + result.reasons)


def needs_file(row: dict, result: c.Classification) -> bool:
    files = row["package"]["files"]
    return result.kind in (c.CHOICE, c.SYSTEM_TOOL, c.APPLICATION) or any(
        fnmatchcase(path, pattern) for path in files for pattern in (
            "/usr/share/applications/*.desktop", "/usr/share/polkit-1/actions/*", "/etc/xdg/autostart/*",
            "*/systemd/system/*.service", "*/systemd/system/*.socket", "*/systemd/user/*.service",
            "/usr/sbin/*", "/sbin/*"))


def entry(row: dict, result: c.Classification, opinion: dict) -> dict:
    agreement = ("unanimous" if opinion["class"] and opinion["class"] == result.default else
                 "disagree" if opinion["class"] and opinion["class"] != "conflict" else
                 "metadata-conflict" if opinion["class"] == "conflict" else "no-metadata")
    out = {"version": row["package"]["version"], "kind": result.kind, "default": result.default,
           "source": _source_label(agreement, opinion),
           "agreement": agreement, "facts": "package" if row["package"].get("inspected") else "index",
           "metadata": opinion}
    for key in ("choices", "notice", "add_on", "add_on_of", "refused", "flags"):
        value = getattr(result, key)
        if value:
            out[key] = list(value) if isinstance(value, tuple) else value
    if result.ask:
        out["ask"] = True
    out["reasons"] = list(result.reasons[:3])
    return out


def curate(family: str, meta: Path, work: Path, names: list[str], commit: str) -> tuple[dict, dict]:
    release = RELEASES[family]
    facts_code = bc.code_facts(meta)
    rows = (bc.build_ubuntu if family == "deb" else bc.build_fedora)(meta, names, facts_code, True)
    rows = [row for row in rows if not row.get("missing")]
    print(f"{release}: {len(rows)} rows", flush=True)
    first = classify_rows(rows, release)
    chosen = [row for row in rows if needs_file(row, first[row["package"]["name"]])]
    selection = work / f"inspect-{release}.json"
    selection.write_text(json.dumps({"rows": chosen}))
    facts_path = work / "facts.json"
    volume = inspect.read_all(facts_path, inspect.wanted_packages([selection]))
    bc.apply_facts(rows, json.loads(facts_path.read_text()))
    results = classify_rows(rows, release)
    mapping = read_map()
    appstream = appstream_types(meta, family)
    launchers = archive_launchers(rows, appstream)
    by_source: dict[str, set[str]] = defaultdict(set)
    for name, fields in (bc.load_ubuntu(meta) if family == "deb" else bc.load_fedora(meta)).items():
        by_source[(fields.get("Source") or name).split()[0]].add(name)
    for row in rows:
        name = row["package"]["name"]
        results[name] = with_archive_host(info(row["package"]), results[name], launchers, by_source)
    tags = debtags(meta) if family == "deb" else {}
    groups = comps_groups(meta) if family == "rpm" else {}
    if family == "rpm":
        borrowable(meta)
    entries = {}
    for row in rows:
        name = row["package"]["name"]
        opinion = metadata_opinion(name, family, appstream, tags, groups, mapping, row["package"]["fields"])
        entries[name] = entry(row, results[name], opinion)
    counts = defaultdict(int)
    for value in entries.values():
        counts[value["agreement"]] += 1
    data = {"format": LIST_FORMAT, "distro": release.split("-")[0], "release": release, "list_version": 1,
            "classifier_version": c.CLASSIFIER_VERSION, "generator_commit": commit,
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "signature": "unsigned (minisign detached signature to add: curated-<release>.json.minisig)",
            "counts": dict(sorted(counts.items())), "inspected_rows": len(chosen), "entries": entries}
    stats = {"rows": len(rows), "inspected_rows": len(chosen), "download_bytes": volume, **counts}
    return data, stats


def _source_label(agreement: str, opinion: dict) -> str:
    if agreement != "unanimous":
        return "classifier"
    borrowed = any(key.startswith("borrowed-") for key in opinion.get("sources", {}))
    return "classifier+metadata(borrowed)" if borrowed else "classifier+metadata"


def recompute(meta: Path, curated: Path, queues: Path) -> dict:
    """Recompute the metadata opinions, agreement and queue of an existing list (no classification)."""
    data = json.loads(curated.read_text())
    release = data["release"]
    family = "deb" if release.startswith("ubuntu") else "rpm"
    packages = bc.load_ubuntu(meta) if family == "deb" else bc.load_fedora(meta)
    mapping = read_map()
    appstream = appstream_types(meta, family)
    tags = debtags(meta) if family == "deb" else {}
    groups = comps_groups(meta) if family == "rpm" else {}
    if family == "rpm":
        borrowable(meta)
    counts = defaultdict(int)
    for name, value in data["entries"].items():
        opinion = metadata_opinion(name, family, appstream, tags, groups, mapping, packages.get(name, {}))
        default = value.get("default", value["kind"])
        agreement = ("unanimous" if opinion["class"] and opinion["class"] == default else
                     "disagree" if opinion["class"] and opinion["class"] != "conflict" else
                     "metadata-conflict" if opinion["class"] == "conflict" else "no-metadata")
        if value.get("agreement") != "reviewed":
            value.update(metadata=opinion, agreement=agreement, source=_source_label(agreement, opinion))
        counts[value["agreement"]] += 1
    data["counts"] = dict(sorted(counts.items()))
    curated.write_text(review_queue.canonical(data))
    rows, unanimous, audited = review_queue.queue_rows(data["entries"], release)
    review_queue.write_queue(queues / f"queue-{release}.tsv", rows)
    by_reason = defaultdict(int)
    for row in rows:
        by_reason[row["reason"]] += 1
    return {"rows": len(data["entries"]), **counts, "queued": len(rows), "queue": dict(by_reason)}


def popularity(meta: Path, family: str, names: list[str]) -> tuple[dict[str, float], dict[str, float]]:
    """(rank key, install weight) per package. Ubuntu: Debian popcon installs. Fedora has no
    popcon: a proxy (rev-deps × comps), not install data: comps membership (mandatory/default x4, optional x2) times one plus the
    reverse-dependency count within the list."""
    if family == "deb":
        installs: dict[str, float] = {}
        with gzip.open(meta / "popcon" / "by_inst.gz", "rt", errors="replace") as stream:
            for line in stream:
                parts = line.split()
                if not line.startswith("#") and len(parts) > 2 and parts[2].isdigit():
                    installs[parts[1]] = float(parts[2])
        return {name: installs.get(name, 0.0) for name in names}, {name: installs.get(name, 0.0) for name in names}
    packages = bc.load_fedora(meta)
    depends = bc.rpm_resolver(packages)
    inside = set(names)
    reverse: dict[str, int] = defaultdict(int)
    for name in names:
        for dependency in set(depends(name)) & inside:
            reverse[dependency] += 1
    root = ET.fromstring(bc.zstd_text(meta / "fedora" / "updates-comps-Everything.x86_64.xml.zst"))
    tier: dict[str, int] = defaultdict(int)
    for group in root.findall("group"):
        for item in group.findall("packagelist/packagereq"):
            level = 4 if item.get("type") in ("mandatory", "default") else 2
            tier[item.text] = max(tier[item.text], level)
    weight = {name: (1 + reverse[name]) * (tier[name] or 1) for name in names}
    return weight, weight


def fill_add_on_of(reviewed: dict, candidate: dict) -> None:
    """A reviewed "application" without a host takes the candidate's add_on_of (the decision stays)."""
    if reviewed.get("kind") == candidate.get("kind") == c.APPLICATION and candidate.get("add_on_of") and \
            not reviewed.get("add_on_of") and not reviewed.get("choices"):
        reviewed["add_on_of"] = candidate["add_on_of"]


def finalize(meta: Path, candidates: list[Path], out: Path, queues: Path, review: int,
             keep: Path | None = None) -> dict:
    """Recompute opinions, keep the harm-relevant queue, rank it by installs and mark the top
    REVIEW rows (shared out by queue size) for review; write the curated lists (unanimous and
    reviewed entries only), the candidates and the queues, and the install coverage."""
    work = {}
    kept_entries: dict[str, dict] = {}
    kept_rows: dict[str, list[dict]] = {}
    for path in candidates:
        recompute(meta, path, queues)  # opinions and agreement, in place
        data = json.loads(path.read_text())
        release = data["release"]
        if keep is not None:  # reviewed entries and decided queue rows are kept as they are
            previous = json.loads((keep / f"curated-{release}.json").read_text())
            kept_entries[release] = {name: entry for name, entry in previous["entries"].items()
                                     if entry.get("agreement") == "reviewed"}
            kept_rows[release] = [row for row in review_queue.read_queue(keep / f"queue-{release}.tsv")
                                  if row.get("decision")]
            for name, entry in kept_entries[release].items():
                if name in data["entries"]:
                    data["entries"][name]["agreement"] = "reviewed"
                    fill_add_on_of(entry, data["entries"][name])
            data["list_version"] = int(previous.get("list_version", 1)) + 1
        family = "deb" if release.startswith("ubuntu") else "rpm"
        rows, unanimous, audited = review_queue.queue_rows(data["entries"], release)
        rank, weight = popularity(meta, family, list(data["entries"]))
        work[release] = (path, data, rows, rank, weight, family)
    total = sum(sum(1 for row in rows if row["reason"] != "audit") for _, _, rows, _, _, _ in work.values())
    summary = {}
    for release, (path, data, rows, rank, weight, family) in work.items():
        queue = sorted((row for row in rows if row["reason"] != "audit"), key=lambda row: -rank[row["name"]])
        share = round(review * len(queue) / max(total, 1))
        for index, row in enumerate(queue):
            row["rank"], row["popularity"] = str(index + 1), f"{rank[row['name']]:g}"
            row["review"] = "yes" if index < share else "long-tail"
        audit = [row for row in rows if row["reason"] == "audit"]
        for row in audit:
            row["rank"], row["popularity"], row["review"] = "", f"{rank[row['name']]:g}", "audit"
        decided = kept_rows.get(release, [])
        decided_names = {row["name"] for row in decided}
        queue = [row for row in queue if row["name"] not in decided_names]
        audit = [row for row in audit if row["name"] not in decided_names]
        review_queue.write_queue(queues / f"queue-{release}.tsv", decided + queue + audit)
        entries = data["entries"]
        listed = {name for name, entry in entries.items() if entry["agreement"] == "unanimous"}
        to_review = {row["name"] for row in queue if row["review"] == "yes"}
        harmless = {name for name, entry in entries.items() if entry["agreement"] == "no-metadata"
                    and review_queue.harmless(entry)}
        curated = {key: value for key, value in data.items() if key != "entries"}
        curated["entries"] = {name: entries[name] for name in sorted(listed)}
        curated["entries"].update(kept_entries.get(release, {}))
        curated["entries"] = dict(sorted(curated["entries"].items()))
        curated["counts"] = {"entries": len(curated["entries"]), "unanimous": len(listed),
                             "reviewed": len(kept_entries.get(release, {})), "candidates": len(entries)}
        (out / f"curated-{release}.json").write_text(review_queue.canonical(curated))
        whole = sum(weight.values()) or 1
        stats = {"candidates": len(entries), "unanimous": len(listed), "reviewed_kept": len(kept_entries.get(release, {})),
                 "decided_rows_kept": len(decided), "queue": len(queue),
                 "queue_by_reason": dict(sorted(defaultdict(int, {}).items())),
                 "marked_for_review": len(to_review), "long_tail": len(queue) - len(to_review), "audit": len(audit),
                 "harmless_without_vote": len(harmless),
                 "coverage_now": sum(weight.get(name, 0) for name in curated["entries"]) / whole,
                 "coverage_after_review": sum(weight.get(name, 0) for name in set(curated["entries"]) | to_review) / whole,
                 "coverage_with_safe_defaults": sum(weight.get(name, 0) for name in set(curated["entries"]) | to_review
                                                    | harmless) / whole}
        reasons = defaultdict(int)
        for row in queue:
            reasons[row["reason"]] += 1
        stats["queue_by_reason"] = dict(sorted(reasons.items()))
        if family == "deb":
            installs_all = 0.0
            with gzip.open(meta / "popcon" / "by_inst.gz", "rt", errors="replace") as stream:
                for line in stream:
                    parts = line.split()
                    if not line.startswith("#") and len(parts) > 2 and parts[2].isdigit():
                        installs_all += float(parts[2])
            stats["coverage_after_review_of_all_popcon"] = sum(weight.get(name, 0) for name in set(curated["entries"])
                                                               | to_review) / installs_all
            stats["coverage_now_of_all_popcon"] = sum(weight.get(name, 0) for name in curated["entries"]) / installs_all
            stats["weight"] = "Debian popcon installs (by_inst)"
        else:
            stats["coverage_label"] = "proxy (rev-deps × comps), not install data"
            stats["weight"] = ("proxy (rev-deps × comps), not install data: (1 + reverse dependencies within the "
                               "list) x 4 for a mandatory/default comps member, x 2 for an optional one")
        summary[release] = stats
    (queues / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    return summary


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--finalize":
        keep = None
        if "--keep" in sys.argv:  # --keep DIR: curated-<release>.json and queue-<release>.tsv to preserve
            index = sys.argv.index("--keep")
            keep = Path(sys.argv[index + 1])
            del sys.argv[index:index + 2]
        meta, out, queues, review = Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]), int(sys.argv[5])
        summary = finalize(meta, [Path(item) for item in sys.argv[6:]], out, queues, review, keep)
        print(json.dumps(summary, indent=2))
        return 0
    if len(sys.argv) > 1 and sys.argv[1] == "--recompute":
        meta, queues = Path(sys.argv[2]), Path(sys.argv[3])
        summary = {}
        for curated in sys.argv[4:]:
            summary[Path(curated).name] = recompute(meta, Path(curated), queues)
            print(Path(curated).name, summary[Path(curated).name], flush=True)
        return 0
    parser = argparse.ArgumentParser()
    parser.add_argument("meta", type=Path)
    parser.add_argument("work", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("queues", type=Path)
    parser.add_argument("--ubuntu", type=int, default=7000)
    parser.add_argument("--fedora", type=int, default=3000)
    parser.add_argument("--commit", default="unknown")
    arguments = parser.parse_args()
    arguments.out.mkdir(parents=True, exist_ok=True)
    arguments.queues.mkdir(parents=True, exist_ok=True)
    summary = {}
    for family, names in (("deb", ubuntu_targets(arguments.meta, arguments.ubuntu)),
                          ("rpm", fedora_targets(arguments.meta, arguments.fedora))):
        data, stats = curate(family, arguments.meta, arguments.work, names, arguments.commit)
        release = data["release"]
        (arguments.out / f"curated-{release}.json").write_text(review_queue.canonical(data))
        rows, unanimous, audited = review_queue.queue_rows(data["entries"], release)
        review_queue.write_queue(arguments.queues / f"queue-{release}.tsv", rows)
        stats.update({"unanimous": unanimous, "audited": audited, "queued": len(rows)})
        summary[release] = stats
        print(release, stats, flush=True)
    (arguments.queues / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
