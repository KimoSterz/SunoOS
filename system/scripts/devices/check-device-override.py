#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Will a device's client-side override apply to a new ARM commit?

A device whose kernel comes from its device repository as an rpm-ostree
override ([device_repo] remove + install, the Surface Pro 12-inch) breaks on a
new OS commit when the commit no longer carries a package the override
removes, when the commit lacks something a layered package requires, or when
the commit's Suno-update would refuse the device. Each of those is checked
here against the commit itself, without a device, so the nightly can hold
only that device class (scripts/os/device-hold-chain.sh --check) instead of
all of ARM.

  check-device-override.py --device VENDOR/CODENAME --repo OSTREE_REPO --commit REV
                           --packages DIR [--key RELEASE_KEY]

DIR is the device repository (rpm-md, as published): its repomd.xml must be
signed with --key when given, and it must hold every [device_repo] install
package. Prints one line per check; exit 0 only when all pass.
"""
from __future__ import annotations

import argparse
import glob
import importlib.util
import os
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/os/lib"))


def ostree_cat(repo: str, commit: str, path: str, dest: Path) -> bool:
    with dest.open("wb") as stream:
        return subprocess.run(["ostree", f"--repo={repo}", "cat", commit, path], stdout=stream,
                              stderr=subprocess.DEVNULL).returncode == 0


def ostree_find(repo: str, commit: str, directory: str, name: str) -> str | None:
    out = subprocess.run(["ostree", f"--repo={repo}", "ls", "-R", commit, directory],
                         capture_output=True, text=True).stdout
    for line in out.splitlines():
        path = line.split()[-1] if line.split() else ""
        if path.endswith("/" + name):
            return path
    return None


def rpm_query(dbpath: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["rpm", "--dbpath", str(dbpath), *args], capture_output=True, text=True)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--device", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--packages", type=Path, required=True)
    parser.add_argument("--key", type=Path)
    args = parser.parse_args(argv)

    device = tomllib.loads((ROOT / "devices" / args.device / "device.toml").read_text())
    layer = device.get("device_repo", {})
    remove, install = list(layer.get("remove", [])), list(layer.get("install", []))
    if not install:
        print(f"FAIL  {args.device}: [device_repo] installs nothing")
        return 1
    import devices  # scripts/os/lib/devices.py
    target = f"{device['vendor']},{device['codename']}"
    devices.device(target)
    failures = 0

    def result(ok: bool, text: str) -> None:
        nonlocal failures
        failures += 0 if ok else 1
        print(("PASS  " if ok else "FAIL  ") + text)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        db = tmp / "rpmdb"
        db.mkdir()
        if not ostree_cat(args.repo, args.commit, "/usr/share/rpm/rpmdb.sqlite", db / "rpmdb.sqlite"):
            print(f"FAIL  {args.commit[:12]}: no rpm database at /usr/share/rpm/rpmdb.sqlite")
            return 1
        for name in remove:
            q = rpm_query(db, "-q", name)
            result(q.returncode == 0, f"commit carries {name} (override remove): {q.stdout.strip() or 'missing'}")

        # Every layered package from the device repository, signed, with its requirements met.
        repomd = args.packages / "repodata/repomd.xml"
        if args.key:
            gpg = tmp / "gpg"
            gpg.mkdir(mode=0o700)
            subprocess.run(["gpg", "--homedir", str(gpg), "--batch", "--quiet", "--import", str(args.key)],
                           capture_output=True)
            ok = subprocess.run(["gpg", "--homedir", str(gpg), "--batch", "--verify", str(repomd) + ".asc",
                                 str(repomd)], capture_output=True).returncode == 0
            result(ok, f"device repository repomd.xml is signed ({args.key.name})")
        for name in install:
            rpms = sorted(glob.glob(str(args.packages / "Packages" / f"{name}-[0-9]*.rpm")))
            rpms = [r for r in rpms if not r.endswith(".src.rpm")]
            if not rpms:
                result(False, f"device repository holds {name}")
                continue
            newest = rpms[-1]
            result(True, f"device repository holds {os.path.basename(newest)}")
            requires = subprocess.run(["rpm", "-qp", "--nosignature", "--requires", newest],
                                      capture_output=True, text=True).stdout.split("\n")
            for req in requires:
                req = req.strip()
                if not req or req.startswith("rpmlib("):
                    continue
                cap = req.split()[0]
                q = rpm_query(db, "-q", "--whatprovides", cap)
                result(q.returncode == 0, f"{name} requires {req}: {q.stdout.strip().splitlines()[0] if q.returncode == 0 else 'not in the commit'}")

        # The commit's Suno-update admits this device on the generic stream.
        hw = ostree_find(args.repo, args.commit, "/usr/lib", "Suno_update/hardware.py")
        if hw is None:
            result(False, "commit carries Suno-update (Suno_update/hardware.py)")
        else:
            ostree_cat(args.repo, args.commit, hw, tmp / "hardware.py")
            spec = importlib.util.spec_from_file_location("commit_hardware", tmp / "hardware.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            entry = next((row for key, row in module.DEVICES.items() if key == target), None)
            result(entry is not None and entry[3] is False,
                   f"commit's Suno-update lets {target} follow the generic stream"
                   + ("" if entry is not None else " (unknown target)"))
    print(("PASS" if not failures else "FAIL") + f"  {args.device} override on {args.commit[:12]}: "
          + ("ready" if not failures else f"{failures} check(s) failed"))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
