#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# devices/microsoft/sp12in/device.toml [kernel] build: kernel-surface-pro12
# from this tree, through the spec's complete (uncached) build path: the
# archives of config/kernel/surface-pro12-7.3.json (Linux 7.3 and the Surface
# overlay, hash-checked), Fedora's aarch64 base configuration (the lock's
# base_config member of the Fedora kernel-core RPM), the overlay patches and
# config/kernel/surface-pro12.config. The package carries vmlinuz, the modules
# and the device tree (/usr/lib/modules/<release>/devicetree).
#
# usage: build-sp12in-kernel-package.sh --output DIR
#
# SP12IN_KERNEL_CACHE (default /srv/dev-storage/projects/luma-os/build/surface-pro12/inputs)
# holds the archives; missing ones are downloaded and checked against the lock.
# An x86_64 host cross-compiles (aarch64-linux-gnu-); an aarch64 host builds
# natively. SP12IN_KERNEL_JOBS sets make -j (default 6).
# DIR receives the binary and source RPMs and SHA256SUMS.
set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
[ "${1:-}" = --output ] && [ -n "${2:-}" ] || { sed -n 's/^# usage: /usage: /p' "$0" >&2; exit 2; }
mkdir -p "$2"
out=$(realpath -e "$2")
cache=${SP12IN_KERNEL_CACHE:-/srv/dev-storage/projects/luma-os/build/surface-pro12/inputs}
jobs=${SP12IN_KERNEL_JOBS:-6}
lock=$repo_root/config/kernel/surface-pro12-7.3.json
spec=$repo_root/packaging/rpm/kernel-surface-pro12.spec
fail() { printf 'build-sp12in-kernel-package: %s\n' "$*" >&2; exit 1; }
[ -z "$(git -C "$repo_root" status --porcelain --untracked-files=no)" ] || fail "commit the tree first"
mkdir -p "$cache"
top=$out/rpmbuild
[ ! -e "$top" ] || fail "$top exists; use an empty output directory"
mkdir -p "$top"/{SOURCES,SPECS,BUILD,BUILDROOT,RPMS,SRPMS,tmp}

# Source archives and the Fedora base configuration, checked against the lock.
python3 - "$repo_root" "$cache" "$lock" "$top/SOURCES" <<'PY'
import hashlib, importlib.util, io, json, pathlib, shutil, subprocess, sys, urllib.request
repo, cache, lock, sources = map(pathlib.Path, sys.argv[1:])
spec = importlib.util.spec_from_file_location("prepare", repo / "scripts/kernel/prepare-source.py")
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
data = json.loads(lock.read_text()); p.validate(data)
for row in data["sources"].values():
    shutil.copyfile(p.fetch(row, cache, False), sources / row["name"])
for row in data["patches"]:
    if row["source"] == "repository" and p.digest(repo / row["path"]) != row["sha256"]:
        sys.exit("repository patch hash mismatch: " + row["path"])
base = data["base_config"]
config = cache / "fedora-base.config"
if not config.exists() or hashlib.sha256(config.read_bytes()).hexdigest() != base["sha256"]:
    rpm = cache / pathlib.PurePosixPath(base["source_rpm"]).name
    if not rpm.exists():
        with urllib.request.urlopen(base["source_rpm"], timeout=300) as remote:
            rpm.write_bytes(remote.read())
    if hashlib.sha256(rpm.read_bytes()).hexdigest() != base["source_rpm_sha256"]:
        sys.exit("Fedora kernel-core RPM hash mismatch")
    cpio = subprocess.run(["rpm2cpio", str(rpm)], check=True, capture_output=True).stdout
    member = subprocess.run(["cpio", "-i", "--quiet", "--to-stdout", "./" + base["member"]], input=cpio,
                            check=True, capture_output=True).stdout
    if hashlib.sha256(member).hexdigest() != base["sha256"]:
        sys.exit("Fedora base configuration hash mismatch")
    config.write_bytes(member)
shutil.copyfile(config, sources / "fedora-base.config")
print("sources verified:", ", ".join(sorted(x.name for x in sources.iterdir())))
PY
git -C "$repo_root" archive --format=tar.gz --prefix=luma-surface-sources/ HEAD \
  config/kernel patches/linux-surface-pro12 scripts/kernel packaging/rpm/kernel-surface-pro12.spec \
  LICENSE.md LICENSES >"$top/SOURCES/luma-surface-sources.tar.gz"
cp "$spec" "$top/SPECS/"

cross=()
[ "$(uname -m)" = aarch64 ] || cross=(--define '_luma_cross_compile aarch64-linux-gnu-')
export SOURCE_DATE_EPOCH=$(git -C "$repo_root" log -1 --format=%ct)
rpmbuild -bs --target aarch64 --define "_topdir $top" --define 'dist .fc44' \
  "$top/SPECS/kernel-surface-pro12.spec" >"$out/source-package.log" 2>&1 || { tail -20 "$out/source-package.log"; exit 1; }
rpmbuild -bb --target aarch64 --define "_topdir $top" --define "_tmppath $top/tmp" \
  --define 'dist .fc44' --define "_smp_mflags -j$jobs" "${cross[@]}" \
  "$top/SPECS/kernel-surface-pro12.spec" >"$out/binary-package.log" 2>&1 || { tail -30 "$out/binary-package.log"; exit 1; }
cp -a "$top"/RPMS/aarch64/kernel-surface-pro12-*.aarch64.rpm "$top"/SRPMS/kernel-surface-pro12-*.src.rpm "$out/"
rm -rf "$top/BUILD" "$top/BUILDROOT" "$top/tmp"
(cd "$out" && sha256sum ./*.rpm >SHA256SUMS)
printf 'Surface kernel package: %s\n' "$out"
