#!/bin/sh
# Fetch package metadata (never packages) for the classifier's labelled set.
#   fetch.sh <directory>
# Ubuntu 24.04: Packages, Contents-amd64 and AppStream (DEP-11) for noble and
# noble-updates. Fedora 45: primary, filelists and comps for the release and
# updates, and Fedora's AppStream data. Debian popcon by_inst for the ranking.
set -eu
out=${1:?directory}
mkdir -p "$out/ubuntu" "$out/fedora" "$out/popcon"
get() { [ -s "$2" ] || curl -fsSL --retry 3 -o "$2.part" "$1" && { [ -s "$2" ] || mv "$2.part" "$2"; }; }
ubuntu=http://archive.ubuntu.com/ubuntu/dists
for suite in noble noble-updates; do
  get "$ubuntu/$suite/Contents-amd64.gz" "$out/ubuntu/$suite-Contents-amd64.gz"
  for component in main restricted universe multiverse; do
    get "$ubuntu/$suite/$component/binary-amd64/Packages.xz" "$out/ubuntu/$suite-$component-Packages.xz"
    get "$ubuntu/$suite/$component/dep11/Components-amd64.yml.gz" "$out/ubuntu/$suite-$component-Components.yml.gz" || true
  done
done
fedora=https://dl.fedoraproject.org/pub/fedora/linux
for repo in "releases/45/Everything/x86_64/os" "updates/45/Everything/x86_64"; do
  tag=$(echo "$repo" | cut -d/ -f1)
  curl -fsSL "$fedora/$repo/repodata/repomd.xml" -o "$out/fedora/$tag-repomd.xml"
  for kind in primary filelists comps-Everything.x86_64; do
    href=$(grep -oE "repodata/[0-9a-f]+-$kind\.xml\.zst" "$out/fedora/$tag-repomd.xml" | head -1)
    get "$fedora/$repo/$href" "$out/fedora/$tag-$kind.xml.zst"
  done
done
get https://dl.fedoraproject.org/pub/alt/screenshots/f45/fedora-45.xml.gz "$out/fedora/appstream-45.xml.gz"
get https://popcon.debian.org/by_inst.gz "$out/popcon/by_inst.gz"
date -u +%FT%TZ > "$out/FETCHED"
