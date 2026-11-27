#!/bin/sh
# Sign a classifier curated list (src/Suno-installer/data/classify/curated-<release>.json)
# with the Suno-depot-classify key: a detached <file>.minisig whose trusted comment is
#   purpose=Suno-curated-classify release=<release> version=<list_version>
# read from the list itself. Suno_installer.classify uses a list only when that signature
# verifies against the pinned data/classify/depot-classify.pub; a Depot catalogue key is
# refused, so never sign a list with one.
#   sign-curated-classify.sh <secret-key-path> <curated.json>
set -eu
key=${1:?secret key path (Suno-depot-classify)}
list=${2:?curated list}
case "$(basename "$key")" in
  *catalog*) echo "refusing: $key looks like a Depot catalogue key; curated lists use Suno-depot-classify" >&2; exit 2;;
esac
command -v minisign >/dev/null || { echo "minisign is not installed" >&2; exit 2; }
fields=$(python3 -I -c '
import json, sys
data = json.load(open(sys.argv[1]))
assert data.get("format") == 1, "not a curated list"
release, version = data["release"], int(data["list_version"])
assert release and all(ch.isalnum() or ch in ".-" for ch in release), "bad release"
print(release, version)
' "$list")
release=${fields% *}
version=${fields#* }
case "$(basename "$list")" in
  "curated-$release.json") ;;
  *) echo "refusing: $list does not name release $release" >&2; exit 2;;
esac
minisign -S -s "$key" -m "$list" -x "$list.minisig" -t "purpose=Suno-curated-classify release=$release version=$version"
echo "signed $list (release $release, list_version $version) -> $list.minisig"
