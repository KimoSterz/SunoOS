#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Build the classifier's labelled-set corpus from package metadata only.

    build_corpus.py META OUT.json [--ids LABELS.tsv]

With --ids, the requests are the ids in the first column of LABELS.tsv
(ubuntu:NAME, fedora:NAME, fedora:@GROUP) instead of the default set.

META is what fetch.sh and codesearch.sh wrote. For each request in the set
(Debian popcon's top 500 that Ubuntu 24.04 has, the Fedora 45 Workstation
desktop set, and the names in corpus-extra.txt) it writes the top-level
package and its own dependencies as classify.PackageInfo dictionaries:
Depends closure minus the release's base (required set, desktop baseline and
host-provided packages, closed over their dependencies). File lists come from
Contents/filelists, launcher visibility from AppStream, and what indices do
not carry (exec.path, Terminal=, NoDisplay=, pkexec launchers, setuid and
capabilities) from Debian Code Search matches, mapped by file name.
"""
from __future__ import annotations

import gzip
import json
import lzma
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from fnmatch import fnmatchcase
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
from luma_installer import classify  # noqa: E402

UBUNTU_BASELINE = ("libgl1", "libegl1", "libgles2", "libgbm1", "libvulkan1", "libpulse0", "libasound2-plugins",
                   "libsecret-1-0", "ca-certificates", "libglib2.0-bin", "apt")
FEDORA_BASE = ("filesystem", "setup", "fedora-release", "fedora-repos", "glibc-minimal-langpack", "bash", "coreutils",
               "grep", "gawk", "sed", "findutils", "mesa-libGL", "mesa-libEGL", "mesa-libgbm", "libglvnd-gles",
               "vulkan-loader", "pulseaudio-libs", "alsa-plugins-pulseaudio", "libsecret", "ca-certificates", "glib2")
FEDORA_GROUPS = ("gnome-desktop", "workstation-product", "multimedia", "firefox", "libreoffice", "printing",
                 "container-management", "desktop-accessibility", "guest-desktop-agents", "fonts")
UBUNTU_TARGET = 500
FEDORA_TARGET = 200


def zstd_text(path: Path) -> bytes:
    return subprocess.run(["zstd", "-dc", str(path)], check=True, capture_output=True).stdout


# -- Ubuntu -----------------------------------------------------------------------------

_DEP_NAME = re.compile(r"^\s*([A-Za-z0-9][A-Za-z0-9+.\-]*)(?::[a-z0-9]+)?")


def deb_alternatives(value: str) -> list[list[str]]:
    out = []
    for clause in value.split(","):
        names = []
        for alternative in clause.split("|"):
            match = _DEP_NAME.match(alternative)
            if match:
                names.append(match.group(1))
        if names:
            out.append(names)
    return out


def load_ubuntu(meta: Path) -> dict[str, dict]:
    packages: dict[str, dict] = {}
    for suite in ("noble", "noble-updates"):
        for component in ("main", "restricted", "universe", "multiverse"):
            path = meta / "ubuntu" / f"{suite}-{component}-Packages.xz"
            for stanza in lzma.open(path, "rt", encoding="utf-8", errors="replace").read().split("\n\n"):
                fields: dict[str, str] = {}
                key = ""
                for line in stanza.splitlines():
                    if line.startswith((" ", "\t")) and key:
                        fields[key] += "\n" + line
                    elif ":" in line:
                        key, _, value = line.partition(":")
                        fields[key] = value.strip()
                name = fields.get("Package")
                if not name or fields.get("Architecture") not in ("amd64", "all"):
                    continue
                fields["Component"] = component
                packages[name] = fields  # -updates is read last and wins
    return packages


def deb_resolver(packages: dict[str, dict]):
    providers: dict[str, list[str]] = defaultdict(list)
    for name, fields in packages.items():
        for clause in deb_alternatives(fields.get("Provides", "")):
            providers[clause[0]].append(name)

    def resolve(alternatives: list[str], prefer: set[str]) -> str | None:
        for name in alternatives:
            if name in packages:
                return name
        for name in alternatives:
            choices = sorted(providers.get(name, ()))
            if choices:
                return next((choice for choice in choices if choice in prefer), choices[0])
        return None

    graph: dict[str, list[str]] = {}

    def depends(name: str, prefer: set[str] = frozenset()) -> list[str]:
        if name not in graph:
            fields = packages[name]
            out = []
            for alternatives in deb_alternatives(fields.get("Pre-Depends", "")) + deb_alternatives(fields.get("Depends", "")):
                target = resolve(alternatives, prefer)
                if target and target != name:
                    out.append(target)
            graph[name] = out
        return graph[name]
    return depends, providers


def same_source_dependents(targets, sources: dict[str, str], depends) -> dict[str, list[str]]:
    """For each target, the packages of its source that depend on it, directly or through others of its source."""
    by_source: dict[str, list[str]] = defaultdict(list)
    for name, source in sources.items():
        by_source[source].append(name)
    out = {}
    for name in targets:
        siblings = [other for other in by_source.get(sources.get(name, name), ()) if other != name]
        found, frontier = set(), {name}
        while frontier and len(found) < 20:  # through the source's own chain (writer -> core -> data)
            frontier = {other for other in siblings if other not in found and set(depends(other)) & frontier}
            found |= frontier
        out[name] = sorted(found)
    return out


def closure(roots, depends) -> set[str]:
    seen, stack = set(), list(roots)
    while stack:
        name = stack.pop()
        if name in seen:
            continue
        seen.add(name)
        stack.extend(depends(name))
    return seen


def read_contents(meta: Path, wanted: set[str]) -> dict[str, list[str]]:
    files: dict[str, set[str]] = defaultdict(set)
    for suite in ("noble", "noble-updates"):
        with gzip.open(meta / "ubuntu" / f"{suite}-Contents-amd64.gz", "rt", encoding="utf-8", errors="replace") as stream:
            for line in stream:
                parts = line.rstrip("\n").rsplit(None, 1)
                if len(parts) != 2:
                    continue
                path, owners = parts
                for owner in owners.split(","):
                    name = owner.rsplit("/", 1)[-1]
                    if name in wanted:
                        files[name].add("/" + path.strip())
    return {name: sorted(value) for name, value in files.items()}


def read_dep11(meta: Path) -> dict[str, dict[str, list[str]]]:
    """package -> {desktop-id: categories} for desktop-application components (all suites merged)."""
    found: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for path in sorted((meta / "ubuntu").glob("*-Components.yml.gz")):
        text = gzip.open(path, "rt", encoding="utf-8", errors="replace").read()
        for document in text.split("\n---\n"):
            if not re.search(r"^Type: desktop-application$", document, re.M):
                continue
            package = re.search(r"^Package: (\S+)$", document, re.M)
            if not package:
                continue
            identifier = re.search(r"^ID: (\S+)$", document, re.M).group(1)
            launch = re.search(r"^Launchable:\n  desktop-id:\n((?:  - .*\n?)+)", document, re.M)
            ids = re.findall(r"  - (\S+)", launch.group(1)) if launch else [identifier]
            categories = re.search(r"^Categories:\n((?:- .*\n?)+)", document, re.M)
            values = re.findall(r"- (\S+)", categories.group(1)) if categories else []
            for item in ids:
                found[package.group(1)][item if item.endswith(".desktop") else item + ".desktop"] = values
    return found


# -- Fedora -----------------------------------------------------------------------------

NS = {"c": "http://linux.duke.edu/metadata/common", "rpm": "http://linux.duke.edu/metadata/rpm",
      "f": "http://linux.duke.edu/metadata/filelists"}


def rich_first(name: str) -> str:
    """The first plain name in a rich dependency: '(a or b)' -> 'a'."""
    if name.startswith("("):
        return re.split(r"[\s()]+", name.strip("()").strip())[0]
    return name


FEDORA_BASES = {"releases": "https://dl.fedoraproject.org/pub/fedora/linux/releases/45/Everything/x86_64/os/",
                "updates": "https://dl.fedoraproject.org/pub/fedora/linux/updates/45/Everything/x86_64/"}
UBUNTU_BASE = "http://archive.ubuntu.com/ubuntu/"


def load_fedora(meta: Path) -> dict[str, dict]:
    packages: dict[str, dict] = {}
    for tag in ("releases", "updates"):
        root = ET.fromstring(zstd_text(meta / "fedora" / f"{tag}-primary.xml.zst"))
        for element in root.findall("c:package", NS):
            arch = element.findtext("c:arch", namespaces=NS)
            if arch not in ("x86_64", "noarch"):
                continue
            name = element.findtext("c:name", namespaces=NS)
            version = element.find("c:version", NS)
            fmt = element.find("c:format", NS)
            requires = [rich_first(entry.get("name")) for entry in fmt.findall("rpm:requires/rpm:entry", NS)
                        if not entry.get("name", "").startswith("rpmlib(")]
            provides = [entry.get("name") for entry in fmt.findall("rpm:provides/rpm:entry", NS)]
            packages[name] = {
                "Package": name, "Version": f"{version.get('ver')}-{version.get('rel')}", "Architecture": arch,
                "Description": element.findtext("c:summary", namespaces=NS) or "",
                "Source": re.sub(r"-[^-]+-[^-]+\.src\.rpm$", "", fmt.findtext("rpm:sourcerpm", namespaces=NS) or ""),
                "Group": fmt.findtext("rpm:group", namespaces=NS) or "",
                "requires": requires, "provides": provides,
                "primary_files": [item.text for item in fmt.findall("c:file", NS)],
                "download": {"url": FEDORA_BASES[tag] + element.find("c:location", NS).get("href"),
                             "sha256": element.findtext("c:checksum", namespaces=NS) or "",
                             "size": int(element.find("c:size", NS).get("package") or 0)},
            }
    return packages


def rpm_resolver(packages: dict[str, dict]):
    providers: dict[str, list[str]] = defaultdict(list)
    for name, fields in packages.items():
        for value in fields["provides"]:
            providers[value].append(name)
        for path in fields["primary_files"]:
            providers[path].append(name)
    graph: dict[str, list[str]] = {}
    preferred: set[str] = set()

    def depends(name: str) -> list[str]:
        """dnf's choice, roughly: a provider already in the base, else the one named like
        the requirement, else the one that brings least."""
        if name not in graph:
            out = []
            for requirement in packages[name]["requires"]:
                if requirement in packages:
                    target = requirement
                else:
                    choices = sorted(set(providers.get(requirement, ())),
                                     key=lambda item: (item not in preferred, not item.startswith(requirement.split("(")[0]),
                                                       len(packages[item]["requires"]), item))
                    if name in choices:
                        continue
                    target = choices[0] if choices else None
                if target and target != name and target not in out:
                    out.append(target)
            graph[name] = out
        return graph[name]
    depends.preferred = preferred
    return depends


def read_filelists(meta: Path, wanted: set[str]) -> dict[str, list[str]]:
    files: dict[str, set[str]] = defaultdict(set)
    for tag in ("releases", "updates"):
        text = zstd_text(meta / "fedora" / f"{tag}-filelists.xml.zst")
        for event, element in ET.iterparse(__import__("io").BytesIO(text), events=("end",)):
            if element.tag != f"{{{NS['f']}}}package":
                continue
            name = element.get("name")
            if name in wanted and element.get("arch") in ("x86_64", "noarch"):
                current = {item.text for item in element.findall("f:file", NS) if item.get("type") not in ("dir",)}
                if tag == "updates":
                    files[name] = current
                else:
                    files[name] |= current
            element.clear()
    return {name: sorted(value) for name, value in files.items()}


def read_fedora_appstream(meta: Path) -> dict[str, dict[str, list[str]]]:
    found: dict[str, dict[str, list[str]]] = defaultdict(dict)
    root = ET.fromstring(gzip.open(meta / "fedora" / "appstream-45.xml.gz").read())
    for component in root.findall("component"):
        if component.get("type") not in ("desktop", "desktop-application"):
            continue
        package = component.findtext("pkgname")
        if not package:
            continue
        ids = [item.text for item in component.findall("launchable") if item.get("type") == "desktop-id"]
        ids = ids or [component.findtext("id") or ""]
        categories = [item.text for item in component.findall("categories/category")]
        for item in ids:
            if item:
                found[package][item if item.endswith(".desktop") else item + ".desktop"] = categories
    return found


def fedora_comps(meta: Path) -> tuple[list[str], dict[str, list[str]]]:
    root = ET.fromstring(zstd_text(meta / "fedora" / "updates-comps-Everything.x86_64.xml.zst"))
    groups = {}
    for group in root.findall("group"):
        names = [item.text for item in group.findall("packagelist/packagereq") if item.get("type") in ("mandatory", "default")]
        groups[group.findtext("id")] = names
    ordered = []
    for group in FEDORA_GROUPS:
        for name in groups.get(group, ()):
            if name not in ordered:
                ordered.append(name)
    return ordered, groups


# -- facts from Debian Code Search ------------------------------------------------------

_RESULT = re.compile(r"^([^/\s]+)_[^/\s]+/(\S+?):(\d+):(.*)$")


def code_results(meta: Path, name: str) -> list[tuple[str, str, str]]:
    path = meta / "codesearch" / f"{name}.txt"
    if not path.exists():
        return []
    out = []
    for line in path.read_text(errors="replace").splitlines():
        match = _RESULT.match(line)
        if match:
            out.append((match.group(1), match.group(2), match.group(4)))
    return out


def desktop_basename(path: str) -> str:
    name = Path(path).name
    while name.endswith(".in"):
        name = name[:-3]
    return name


# Build-time directory variables in policy files, as distributions configure them.
TEMPLATE_DIRECTORIES = ((r"(\{\{\s*|@|\$\{|\$\()(pkg)?libexecdir(\s*\}\}|@|\}|\))", "/usr/libexec"),
                        (r"(\{\{\s*|@|\$\{|\$\()sbindir(\s*\}\}|@|\}|\))", "/usr/sbin"),
                        (r"(\{\{\s*|@|\$\{|\$\()bindir(\s*\}\}|@|\}|\))", "/usr/bin"),
                        (r"(\{\{\s*|@|\$\{|\$\()(pkg)?libdir(\s*\}\}|@|\}|\))", "/usr/lib"),
                        (r"(\{\{\s*|@|\$\{|\$\()prefix(\s*\}\}|@|\}|\))", "/usr"))


def code_facts(meta: Path) -> dict[str, object]:
    exec_paths: dict[str, set[str]] = defaultdict(set)
    for source, path, line in code_results(meta, "exec-path"):
        match = re.search(r">([^<]+)<", line)
        if match and "/test" not in path and "example" not in path:
            value = match.group(1).strip()
            for pattern, real in TEMPLATE_DIRECTORIES:
                value = re.sub(pattern, real, value, flags=re.I)
            value = re.sub(r"(\{\{[^}]*\}\}|@[A-Za-z_]+@|\$\{[^}]*\}|\$\([^)]*\))", "*", value)
            exec_paths[desktop_basename(path)].add(value)
    facts: dict[str, object] = {
        "exec_paths": {key: sorted(value) for key, value in exec_paths.items()},
        "terminal": sorted({desktop_basename(p) for _, p, line in code_results(meta, "terminal")
                            if line.strip().lower().startswith("terminal=true")}),
        "nodisplay": sorted({desktop_basename(p) for name in ("nodisplay", "hidden") for _, p, line in code_results(meta, name)
                             if line.strip().lower().startswith(("nodisplay=true", "hidden=true"))}),
        "pkexec": sorted({desktop_basename(p) for name in ("exec-pkexec", "exec-sudo") for _, p, _ in code_results(meta, name)}),
        "desktop_files": {desktop_basename(p) for _, p, _ in code_results(meta, "desktop-entries")
                          if "/test" not in p and "example" not in p},
        "exec": {desktop_basename(p): line.strip()[5:] for _, p, line in code_results(meta, "exec-lines")
                 if line.strip().startswith("Exec=")},
    }
    privileged: dict[str, set[str]] = defaultdict(set)
    caps: dict[str, set[str]] = defaultdict(set)

    acting = re.compile(r"^debian/([^/]*\.(postinst|lintian-overrides)|rules)$")

    def add(target: dict, source: str, raw: str) -> None:
        raw = raw.strip().strip("'\"[]),;")
        raw = re.sub(r"^\$\((CURDIR|DESTDIR)\)/", "", raw)
        raw = re.sub(r"^(\$\{?DESTDIR\}?|\$\(?D\)?)/", "", raw)
        raw = re.sub(r"^debian/(tmp|[A-Za-z0-9+.\-]+)/", "", raw)
        if "$" in raw or "*" in raw or not re.match(r"^/?(usr|bin|sbin|lib|opt|etc)/", raw):
            return
        target[source].add("/" + raw.lstrip("/"))

    for name in ("lintian-elevated", "lintian-setuid"):
        for source, path, line in code_results(meta, name):
            if not acting.match(path):
                continue
            for raw in re.findall(r"\[([^\]]+)\]", line) or re.findall(r"\s((?:usr|bin|sbin|lib|opt)/\S+)", line):
                add(privileged, source, raw)
    for source, path, line in code_results(meta, "rules-chmod"):
        if acting.match(path) and not line.lstrip().startswith("#") and re.search(r"chmod\s+(-\S+\s+)*(0?[2467][0-7]{3}|[ugoa]*\+[rwx]*s)", line):
            for raw in re.findall(r"((?:\$\(CURDIR\)/)?debian/[^\s;]+|/?(?:usr|bin|sbin)/[^\s;]+)", line):
                add(privileged, source, raw)
    for source, path, line in code_results(meta, "statoverride"):
        match = acting.match(path) and re.search(r"--add\s+\S+\s+\S+\s+0?([2467][0-7]{3})\s+(\S+)", line)
        if match:
            add(privileged, source, match.group(2))
    for source, path, line in code_results(meta, "setcap"):
        match = acting.match(path) and not line.lstrip().startswith("#") and re.search(
            r"setcap\s+(?:-q\s+)?(?!-r)\S+\s+(\S+)", line)
        if match:
            add(caps, source, match.group(1))
    # Facts Code Search cannot show (a variable path, a spec file), each with its source.
    for line in (HERE / "facts-overlay.txt").read_text().splitlines():
        line = line.split("#", 1)[0].split()
        if len(line) == 3:
            (privileged if line[0] == "setuid" else caps)[line[1]].add(line[2])
    facts["setuid"] = {key: sorted({usr_merged(path) for path in value}) for key, value in privileged.items()}
    facts["caps"] = {key: sorted({usr_merged(path) for path in value}) for key, value in caps.items()}
    return facts


# -- assembling PackageInfo dictionaries -------------------------------------------------

def visibility(appstream: dict[str, dict[str, list[str]]]) -> dict[str, object]:
    """AppStream's desktop applications by launcher file name (any package: ids outlive
    package renames) and the packages that have one."""
    by_id: dict[str, list[str]] = {}
    for ids in appstream.values():
        by_id.update(ids)
    return {"ids": by_id, "packages": set(appstream)}


def usr_merged(path: str) -> str:
    return re.sub(r"^/(bin|sbin|lib|lib64)/", r"/usr/\1/", path)


def package_info(name: str, fields: dict, family: str, files: list[str], depends: list[str],
                 appstream: dict[str, object], facts: dict, privileged_paths: set[str],
                 capability_paths: set[str]) -> dict:
    """Launcher visibility: listed in AppStream (by file name) -> shown; NoDisplay/Hidden in
    the source -> hidden; the package has an AppStream application whose id changed since
    (stale index) -> shown; otherwise not known."""
    listed, with_apps, known_sources = appstream["ids"], appstream["packages"], facts.get("desktop_files", set())
    terminal, nodisplay, pkexec = set(facts["terminal"]), set(facts["nodisplay"]), set(facts["pkexec"])
    desktop = []
    for path in files:
        if not fnmatchcase(path, "/usr/share/applications/*.desktop"):
            continue
        base = Path(path).name
        if base in listed:
            no_display = False
        elif base in nodisplay:
            no_display = True
        elif name in with_apps:
            no_display = False
        elif base in known_sources:
            no_display = False  # Debian's copy of this launcher has no NoDisplay/Hidden line
        else:
            no_display = None
        categories = listed.get(base, [])
        exec_line = facts["exec"].get(base) or ("pkexec" if base in pkexec else None)
        if exec_line and "@" in exec_line:  # a build-time template: only its program is known
            exec_line = re.sub(r"@[A-Za-z_]+@/?", "", exec_line)
        desktop.append({"path": path, "exec": exec_line,
                        "no_display": no_display, "terminal": base in terminal, "categories": categories})
    policies = [{"path": path, "exec_paths": facts["exec_paths"].get(Path(path).name, [])}
                for path in files if fnmatchcase(path, "/usr/share/polkit-1/actions/*.policy")]
    return {
        "name": name, "version": fields.get("Version", ""), "family": family,
        "architecture": fields.get("Architecture", ""),
        "fields": {key: fields[key].split("\n")[0] for key in ("Section", "Priority", "Source", "Description", "Group",
                                                                 "Component", "Essential") if fields.get(key)},
        "depends": depends, "files": files, "desktop": desktop, "policies": policies,
        "setuid": sorted(path for path in files if usr_merged(path) in privileged_paths),
        "capabilities": sorted(path for path in files if usr_merged(path) in capability_paths),
        "download": fields.get("download") or ({"url": UBUNTU_BASE + fields["Filename"], "sha256": fields.get("SHA256", ""),
                                                 "size": int(fields.get("Size") or 0)} if fields.get("Filename") else {}),
    }


def build_ubuntu(meta: Path, extra: list[str], facts: dict, only: bool = False) -> list[dict]:
    packages = load_ubuntu(meta)
    depends, providers = deb_resolver(packages)
    required = [name for name, fields in packages.items() if fields.get("Priority") == "required"]
    host = [name for name in packages if classify.host_provided(name, "deb")]
    base = closure([*required, *UBUNTU_BASELINE, *host], depends)
    ranked = []
    with gzip.open(meta / "popcon" / "by_inst.gz", "rt", errors="replace") as stream:
        for line in stream:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.split()
            if len(parts) > 2 and parts[1] in packages and parts[1] not in ranked:
                ranked.append(parts[1])
            if len(ranked) >= UBUNTU_TARGET:
                break
    if only:
        ranked = []
    targets = ranked + [name for name in extra if name not in ranked]
    missing = [name for name in targets if name not in packages]
    targets = [name for name in targets if name in packages]
    own = {name: classify.own_dependencies(name, {n: depends(n) for n in closure([name], depends)}, base, "deb")
           for name in targets}
    sources = {name: packages[name].get("Source", name).split()[0] for name in packages}
    dependents = same_source_dependents(targets, sources, depends)
    wanted = set(targets) | {dep for deps in own.values() for dep in deps} | {d for ds in dependents.values() for d in ds}
    files = read_contents(meta, wanted)
    appstream = read_dep11(meta)
    source_of = {name: packages[name].get("Source", name).split()[0] for name in wanted}
    privileged = {path for name in wanted for path in facts["setuid"].get(source_of[name], ())}
    capabilities = {path for name in wanted for path in facts["caps"].get(source_of[name], ())}
    appstream = visibility(appstream)
    rows = []
    for rank, name in enumerate(targets, 1):
        info = lambda n: package_info(n, packages[n], "deb", files.get(n, []), depends(n), appstream, facts,
                                      privileged, capabilities)
        rows.append({"id": f"ubuntu:{name}", "release": "ubuntu-24.04", "set": "popcon" if name in ranked else "extra",
                     "rank": rank if name in ranked else None, "package": info(name),
                     "dependencies": [info(dep) for dep in own[name]],
                     "dependents": [info(dep) for dep in dependents[name]]})
    for name in missing:
        rows.append({"id": f"ubuntu:{name}", "release": "ubuntu-24.04", "set": "extra", "missing": True})
    return rows


def build_fedora(meta: Path, extra: list[str], facts: dict, only: bool = False) -> list[dict]:
    packages = load_fedora(meta)
    depends = rpm_resolver(packages)
    host = [name for name in packages if classify.host_provided(name, "rpm")]
    depends.preferred.update(name for name in (*FEDORA_BASE, *host) if name in packages)
    base = closure([name for name in (*FEDORA_BASE, *host) if name in packages], depends)
    depends.preferred.update(base)
    ordered, groups = fedora_comps(meta)
    selected = [] if only else [name for name in ordered if name in packages][:FEDORA_TARGET]
    group_requests = [name for name in extra if name.startswith("@")]
    targets = selected + [name for name in extra if name not in selected and not name.startswith("@")]
    missing = [name for name in targets if name not in packages]
    targets = [name for name in targets if name in packages]
    for group in group_requests:
        members = [name for name in groups.get(group[1:], []) if name in packages]
        packages[group] = {"Package": group, "Version": "", "Architecture": "noarch", "requires": members,
                           "provides": [], "primary_files": [], "Description": f"comps group {group[1:]}"}
        targets.append(group)
    own = {name: classify.own_dependencies(name, {n: depends(n) for n in closure([name], depends)}, base, "rpm")
           for name in targets}
    sources = {name: packages[name].get("Source") or name for name in packages}
    dependents = same_source_dependents(targets, sources, depends)
    wanted = set(targets) | {dep for deps in own.values() for dep in deps} | {d for ds in dependents.values() for d in ds}
    files = read_filelists(meta, wanted)
    appstream = read_fedora_appstream(meta)
    all_setuid = {path for paths in facts["setuid"].values() for path in paths}
    all_caps = {path for paths in facts["caps"].values() for path in paths}
    appstream = visibility(appstream)
    rows = []
    for name in targets:
        info = lambda n: package_info(n, packages[n], "rpm", files.get(n, []), depends(n), appstream, facts,
                                      all_setuid, all_caps)
        rows.append({"id": f"fedora:{name}", "release": "fedora-45", "set": "workstation" if name in selected else "extra",
                     "package": info(name), "dependencies": [info(dep) for dep in own[name]],
                     "dependents": [info(dep) for dep in dependents[name]]})
    for name in missing:
        rows.append({"id": f"fedora:{name}", "release": "fedora-45", "set": "extra", "missing": True})
    return rows


def apply_facts(rows: list[dict], facts: dict) -> None:
    """Replace index-derived facts with what the package itself holds (see inspect_packages.py)."""
    def apply(info: dict) -> None:
        fact = facts.get(f"{info['family']}:{info['name']}:{info['version']}")
        if not fact or "error" in fact:
            info["inspected"] = False
            return
        info["inspected"] = True
        for key in ("desktop", "policies", "setuid", "capabilities", "scripts", "autostart", "session_services"):
            info[key] = fact.get(key, [])
    for row in rows:
        if row.get("missing"):
            continue
        for info in [row["package"], *row["dependencies"], *row.get("dependents", ())]:
            apply(info)


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("meta", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--ids", type=Path)
    parser.add_argument("--facts", type=Path, help="package facts from inspect_packages.py: they replace the "
                        "index-derived launcher, policy and privilege facts")
    arguments = parser.parse_args()
    meta, out = arguments.meta, arguments.out
    extra = {"ubuntu": [], "fedora": []}
    if arguments.ids:
        import labels
        for ident in labels.read(arguments.ids):
            family, name = ident.split(":", 1)
            if family in extra and name not in extra[family]:
                extra[family].append(name)
    else:
        section = ""
        for line in (HERE / "corpus-extra.txt").read_text().splitlines():
            line = line.split("#", 1)[0].strip()
            if line.startswith("["):
                section = line.strip("[]")
            elif line:
                extra[section].append(line)
    facts = code_facts(meta)
    only = bool(arguments.ids)
    rows = build_ubuntu(meta, extra["ubuntu"], facts, only) + build_fedora(meta, extra["fedora"], facts, only)
    if arguments.facts:
        apply_facts(rows, json.loads(arguments.facts.read_text()))
    out.write_text(json.dumps({"rows": rows}, indent=None))
    print(f"{len(rows)} requests -> {out}")


if __name__ == "__main__":
    main()
