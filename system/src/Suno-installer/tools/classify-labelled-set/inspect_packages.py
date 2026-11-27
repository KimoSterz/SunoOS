#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Read the facts the dispatcher reads from a package file, for the labelled sets.

    inspect_packages.py FACTS.json CORPUS.json [CORPUS.json ...]

The real dispatcher always has the package file; indices lack launchers' Exec,
Terminal and NoDisplay lines, polkit exec.path annotations, file modes and
capabilities. This downloads each corpus row's top-level package, its own parts
(same source, meta members), its same-source dependents and any dependency with
a launcher or polkit policy, from the distribution's mirror (checksum checked),
reads those facts without running anything, deletes the file and records the
facts in FACTS.json (resumable). build_corpus.py --facts FACTS.json applies them.

Runs niced; waits while the machine's load is high; one package on disk per
worker at a time.
"""
from __future__ import annotations

import configparser
import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from fnmatch import fnmatchcase
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
from Suno_installer import classify as c  # noqa: E402
from run import info  # noqa: E402

DESKTOP = "/usr/share/applications/*.desktop"
POLICY = "/usr/share/polkit-1/actions/*.policy"
AUTOSTART = "/etc/xdg/autostart/*.desktop"
SESSION_BUS = "/usr/share/dbus-1/services/*.service"
VERSION = 3  # facts read by this version; older entries are read again
CURRENT = {"deb": 2, "rpm": 3}  # the version each family's reader last changed in
MAX_SIZE = 400 * 1024 * 1024
LOAD_LIMIT = float(os.environ.get("INSPECT_LOAD_LIMIT", "56"))
WORKERS = int(os.environ.get("INSPECT_WORKERS", "4"))
RATE = os.environ.get("INSPECT_RATE", "8M")  # per worker: the download cap


def desktop_entry(path: str, text: str) -> dict | None:
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string(text)
    except configparser.Error:
        return None
    if not parser.has_section("Desktop Entry"):
        return None
    entry = parser["Desktop Entry"]
    if entry.get("Type", "Application").strip() != "Application":
        return None
    hidden = entry.get("NoDisplay", "false").strip().lower() == "true" or \
        entry.get("Hidden", "false").strip().lower() == "true"
    return {"path": path, "exec": entry.get("Exec", "").strip() or None, "no_display": hidden,
            "terminal": entry.get("Terminal", "false").strip().lower() == "true",
            "categories": [item for item in entry.get("Categories", "").split(";") if item]}


def exec_of(path: str, text: str) -> dict:
    """An autostart entry's or a session D-Bus service's program."""
    match = re.search(r"^Exec\s*=\s*(.+)$", text, re.M)
    return {"path": path, "exec": match.group(1).strip() if match else ""}


def policy(path: str, text: str) -> dict:
    paths = re.findall(r'org\.freedesktop\.policykit\.exec\.path"\s*>\s*([^<\s]+)\s*<', text)
    return {"path": path, "exec_paths": sorted(set(paths))}


def script_privileges(text: str) -> tuple[list[str], list[str]]:
    """(setuid paths, capability paths) a maintainer script sets with literal paths."""
    setuid, caps = [], []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#"):
            continue
        match = re.search(r"dpkg-statoverride\s+.*--add\s+\S+\s+\S+\s+0?[2467][0-7]{3}\s+(/\S+)", line)
        if match:
            setuid.append(match.group(1).strip("'\""))
        match = re.search(r"\bsetcap\s+(?:-q\s+)?(?!-r)['\"]?[\w,=+]+['\"]?\s+(/\S+)", line)
        if match:
            caps.append(match.group(1).strip("'\";"))
        match = re.search(r"\bchmod\s+(?:-\S+\s+)*(0?[2467][0-7]{3}|[ugoa]*\+[rwx]*s)\s+(/\S+)", line)
        if match:
            setuid.append(match.group(2).strip("'\";"))
    return setuid, caps


def _wanted(name: str) -> bool:
    return any(fnmatchcase(name, pattern) for pattern in (DESKTOP, POLICY, AUTOSTART, SESSION_BUS))


def _record(facts: dict, name: str, text: str) -> None:
    if fnmatchcase(name, DESKTOP):
        entry = desktop_entry(name, text)
        if entry:
            facts["desktop"].append(entry)
    elif fnmatchcase(name, POLICY):
        facts["policies"].append(policy(name, text))
    elif fnmatchcase(name, AUTOSTART):
        facts["autostart"].append(exec_of(name, text))
    elif fnmatchcase(name, SESSION_BUS):
        facts["session_services"].append(exec_of(name, text))


def _empty() -> dict:
    return {"v": VERSION, "desktop": [], "policies": [], "setuid": [], "capabilities": [], "scripts": [],
            "autostart": [], "session_services": []}


def inspect_deb(path: Path) -> dict:
    facts = _empty()
    data = subprocess.Popen(["dpkg-deb", "--fsys-tarfile", str(path)], stdout=subprocess.PIPE)
    with tarfile.open(fileobj=data.stdout, mode="r|*") as archive:
        for member in archive:
            name = "/" + member.name.lstrip("./")
            if not member.isfile():
                continue
            if member.mode & 0o6000:
                facts["setuid"].append(name)
            if member.size < 1024 * 1024 and _wanted(name):
                _record(facts, name, archive.extractfile(member).read().decode("utf-8", "replace"))
    data.wait()
    control = subprocess.Popen(["dpkg-deb", "--ctrl-tarfile", str(path)], stdout=subprocess.PIPE)
    with tarfile.open(fileobj=control.stdout, mode="r|*") as archive:
        for member in archive:
            name = member.name.lstrip("./")
            if member.isfile() and name in ("preinst", "postinst", "prerm", "postrm", "triggers", "config"):
                facts["scripts"].append(name)
                if name == "postinst":
                    setuid, caps = script_privileges(archive.extractfile(member).read().decode("utf-8", "replace"))
                    facts["setuid"] += setuid
                    facts["capabilities"] += caps
    control.wait()
    return facts


def inspect_rpm(path: Path) -> dict:
    facts = _empty()
    listing = subprocess.run(["rpm", "-qp", "--nosignature", "--nodigest", "--qf",
                              "[%{FILEMODES}\t%{FILECAPS}\t%{FILENAMES}\n]", str(path)],
                             capture_output=True, text=True, check=True).stdout
    wanted = []
    for line in listing.splitlines():
        mode, caps, name = (line.split("\t", 2) + ["", ""])[:3]
        mode = int(mode or 0)
        if (mode & 0o170000) != 0o100000:
            continue
        if mode & 0o6000:
            facts["setuid"].append(name)
        if "cap_" in caps.lower():  # rpm prints "(none)" or nothing for a file without capabilities
            facts["capabilities"].append(name)
        if _wanted(name):
            wanted.append(name)
    scripts = subprocess.run(["rpm", "-qp", "--nosignature", "--nodigest", "--scripts", str(path)],
                             capture_output=True, text=True).stdout
    facts["scripts"] = sorted(set(re.findall(r"^(\w+) scriptlet", scripts, re.M)))
    if wanted:
        with tempfile.TemporaryDirectory(dir=path.parent) as folder:
            cpio = subprocess.Popen(["rpm2cpio", str(path)], stdout=subprocess.PIPE)
            subprocess.run(["cpio", "-id", "--quiet", "--no-absolute-filenames", "-D", folder,
                            *["." + name for name in wanted]], stdin=cpio.stdout, check=False,
                           stderr=subprocess.DEVNULL)
            cpio.wait()
            for name in wanted:
                file = Path(folder) / name.lstrip("/")
                if not file.is_file() or file.is_symlink():
                    continue
                _record(facts, name, file.read_text("utf-8", "replace"))
    return facts


def wanted_packages(corpora: list[Path]) -> dict[str, dict]:
    """key -> PackageInfo dictionary, for every package worth reading."""
    out: dict[str, dict] = {}
    for corpus in corpora:
        for row in json.loads(corpus.read_text())["rows"]:
            if row.get("missing"):
                continue
            top = info(row["package"])
            dependencies = tuple(info(dep) for dep in row["dependencies"])
            own, _ = c._own_parts(c.Request(top, dependencies))
            own_names = {package.name for package in own}
            for data in [row["package"], *row.get("dependents", ()), *row["dependencies"]]:
                interesting = data["name"] in own_names or data is row["package"] or data in row.get("dependents", ()) \
                    or any(fnmatchcase(path, DESKTOP) or fnmatchcase(path, POLICY) for path in data["files"])
                if interesting and data.get("download", {}).get("url"):
                    out[f"{data['family']}:{data['name']}:{data['version']}"] = data
    return out


def main() -> int:
    facts_path, corpora = Path(sys.argv[1]), [Path(item) for item in sys.argv[2:]]
    return read_all(facts_path, wanted_packages(corpora))


def read_all(facts_path: Path, wanted: dict[str, dict]) -> int:
    """Read every wanted package not read yet into FACTS_PATH; returns the bytes downloaded."""
    facts = json.loads(facts_path.read_text()) if facts_path.exists() else {}
    todo = {key: data for key, data in wanted.items()
            if facts.get(key, {}).get("v", 0) < CURRENT[data["family"]] and "error" not in facts.get(key, {"v": 0})}
    print(f"{len(todo)} packages to read ({len(facts)} already read)", flush=True)
    work = facts_path.parent / "inspect-work"
    work.mkdir(exist_ok=True)
    lock = threading.Lock()
    done = [0]

    def read(item: tuple[str, dict]) -> None:
        key, data = item
        download = data["download"]
        if download.get("size", 0) > MAX_SIZE:
            result = {"error": f"larger than {MAX_SIZE >> 20} MiB: not read"}
        else:
            while os.getloadavg()[0] > LOAD_LIMIT:
                time.sleep(30)
            target = work / f"{threading.get_ident()}-{Path(download['url']).name}"
            try:
                subprocess.run(["curl", "-fsSL", "--retry", "3", "--limit-rate", RATE, "-o", str(target),
                                download["url"]], check=True, timeout=1800)
                digest = hashlib.sha256(target.read_bytes()).hexdigest()
                if download.get("sha256") and len(download["sha256"]) == 64 and digest != download["sha256"]:
                    raise ValueError("checksum mismatch")
                result = inspect_deb(target) if data["family"] == "deb" else inspect_rpm(target)
            except (subprocess.SubprocessError, OSError, ValueError, tarfile.TarError) as error:
                result = {"error": str(error)[:200]}
            finally:
                target.unlink(missing_ok=True)
        with lock:
            facts[key] = result
            done[0] += 1
            if done[0] % 50 == 0 or done[0] == len(todo):
                facts_path.write_text(json.dumps(facts))
                print(f"{done[0]}/{len(todo)}", flush=True)

    with ThreadPoolExecutor(WORKERS) as pool:
        list(pool.map(read, todo.items()))
    facts_path.write_text(json.dumps(facts))
    errors = sum(1 for value in facts.values() if "error" in value)
    volume = sum(data["download"].get("size", 0) for key, data in todo.items() if "error" not in facts.get(key, {}))
    print(f"read {len(facts)} packages, {errors} not read; downloaded {volume >> 20} MiB this run", flush=True)
    return volume


if __name__ == "__main__":
    main()
    sys.exit(0)
