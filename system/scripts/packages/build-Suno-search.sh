#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
# shellcheck disable=SC1091
. "$repo_root/config/desktop/inputs.env"

for tool in mktemp podman sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'error: required Suno Search package build tool is missing: %s\n' "$tool" >&2
    exit 1
  }
done

[ "$(uname -s)" = Linux ] || { printf 'error: build Search on Linux\n' >&2; exit 1; }
architecture=${SUNO_TARGET_ARCHITECTURE:-$(uname -m)}
case "$architecture" in
  x86_64) builder_container=$FEDORA_RPM_BUILD_CONTAINER ;;
  aarch64) builder_container=$FEDORA_RPM_BUILD_CONTAINER_AARCH64 ;;
  *) printf 'error: unsupported Search architecture: %s\n' "$architecture" >&2; exit 1 ;;
esac
export SUNO_RPM_BUILDER_ARCHITECTURE=$architecture

output_dir="$repo_root/build/packages/Suno-search"
mkdir -p "$(dirname "$output_dir")"
work_dir=$(mktemp -d "$output_dir.work.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT
rpmbuild_dir="$work_dir/rpmbuild"
mkdir -p "$rpmbuild_dir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

for source in \
  Suno-search-service \
  org.projectSuno.Search1.xml \
  org.projectSuno.Search.service \
  org.projectSuno.search.gschema.xml \
  Suno-search-settings \
  org.projectSuno.SearchSettings.desktop \
  50_Suno-search-localsearch.gschema.override \
  README.md; do
  install -m 0644 "$repo_root/src/Suno-search/$source" "$rpmbuild_dir/SOURCES/$source"
done
chmod 0755 "$rpmbuild_dir/SOURCES/Suno-search-service"
chmod 0755 "$rpmbuild_dir/SOURCES/Suno-search-settings"
for source in __init__.py contract.py providers.py ranking.py files.py places.py; do
  install -m 0644 "$repo_root/src/Suno-search/Suno_search/$source" \
    "$rpmbuild_dir/SOURCES/$source"
done
install -m 0644 "$repo_root/LICENSE.md" "$rpmbuild_dir/SOURCES/LICENSE.md"
install -m 0644 "$repo_root/tests/unit/test_Suno_search.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/search/test_depot_results.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/search/test_ranking_vectors.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/search/ranking-vectors.json" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/tests/search/settings-cases.json" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/src/Suno-search/settings-pages.json" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/src/Suno-search/Suno_search/depot.py" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/src/Suno-search/org.projectSuno.Depot.search-provider.ini" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/src/Suno-search/filer-places.json" "$rpmbuild_dir/SOURCES/"
install -m 0644 "$repo_root/packaging/rpm/Suno-search.spec" "$rpmbuild_dir/SPECS/"

"$repo_root/scripts/packages/run-in-rpm-builder.sh" "$rpmbuild_dir" "$builder_container" '
  set -euo pipefail
  dnf5 -y install glib2-devel python3 python3-gobject-base rpm-build systemd-rpm-macros localsearch libtinysparql
  schemas=$(mktemp -d)
  cp SOURCES/org.projectSuno.search.gschema.xml "$schemas/"
  glib-compile-schemas --strict --dry-run "$schemas"
  # The LocalSearch override must name real keys of the installed schema.
  cp /usr/share/glib-2.0/schemas/org.freedesktop.Tracker3.Miner.Files.gschema.xml \
    SOURCES/50_Suno-search-localsearch.gschema.override "$schemas/"
  glib-compile-schemas --strict --targetdir="$schemas" "$schemas"
  GSETTINGS_SCHEMA_DIR="$schemas" GSETTINGS_BACKEND=memory \
    gsettings get org.freedesktop.Tracker3.Miner.Files ignored-directories >"$schemas/ignored.txt"
  grep -Fq node_modules "$schemas/ignored.txt"
  python3 -m py_compile SOURCES/Suno-search-service SOURCES/Suno-search-settings SOURCES/*.py
  rpmbuild -ba --define "_topdir $PWD" SPECS/Suno-search.spec
  rpm=$(find RPMS/noarch -name "Suno-search-*.rpm" -print -quit)
  verify=$(mktemp -d)
  cd "$verify"
  # Files, not a pipe: cpio stops at the trailer and pipefail would see SIGPIPE.
  rpm2cpio "$OLDPWD/$rpm" >package.cpio
  cpio -idm --quiet <package.cpio
  rm package.cpio
  test -x usr/libexec/Suno-search-service
  test -x usr/libexec/Suno-search-settings
  test -f usr/share/applications/org.projectSuno.SearchSettings.desktop
  test -f usr/share/dbus-1/services/org.projectSuno.Search.service
  test -f usr/share/dbus-1/interfaces/org.projectSuno.Search1.xml
  test -f usr/share/glib-2.0/schemas/org.projectSuno.search.gschema.xml
  grep -Fq "Exec=/usr/libexec/Suno-search-service" \
    usr/share/dbus-1/services/org.projectSuno.Search.service
  grep -Fq "/usr/share/dbus-1/interfaces/org.projectSuno.Search1.xml" \
    usr/libexec/Suno-search-service
  grep -Fq "Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES" \
    usr/libexec/Suno-search-service
  grep -Fq "Gio.DBusProxyFlags.DO_NOT_AUTO_START_AT_CONSTRUCTION" \
    usr/libexec/Suno-search-service
  grep -Fq "PROVIDER_QUERY_BUDGET_SECONDS = 0.18" \
    usr/libexec/Suno-search-service
  test -f usr/libexec/Suno_search/ranking.py
  test -f usr/libexec/Suno_search/files.py
  test -s usr/share/Suno-search/settings-pages.json
  grep -Fq "_query_settings_pages" usr/libexec/Suno-search-service
  test -f usr/share/glib-2.0/schemas/50_Suno-search-localsearch.gschema.override
  grep -Fq "_query_files" usr/libexec/Suno-search-service
  test -f usr/libexec/Suno_search/depot.py
  test -f usr/share/gnome-shell/search-providers/org.projectSuno.Depot.search-provider.ini
  test -f usr/libexec/Suno_search/places.py
  python3 -c "import json,sys; t=json.load(open(sys.argv[1])); ids={p[\"id\"] for p in t[\"places\"]}; sys.exit(0 if {\"applications\",\"trash\",\"home\"} <= ids and len(ids) >= 13 else 1)" usr/share/Suno-search/filer-places.json
  grep -Fq "_query_places" usr/libexec/Suno-search-service
  grep -Fq "<method name=\"Reveal\">" usr/share/dbus-1/interfaces/org.projectSuno.Search1.xml
  rpm -qp --requires "$OLDPWD/$rpm" >requires.txt
  grep -Fqx libtinysparql requires.txt
  printf "Packaged Suno Search files and folders: PASS\n"
'

rm -rf "$output_dir"
install -d -m 0755 "$output_dir/RPMS/noarch" "$output_dir/SRPMS"
install -m 0644 "$rpmbuild_dir"/RPMS/noarch/*.rpm "$output_dir/RPMS/noarch/"
install -m 0644 "$rpmbuild_dir"/SRPMS/*.rpm "$output_dir/SRPMS/"
(
  cd "$output_dir"
  find RPMS SRPMS -type f -name '*.rpm' -exec sha256sum {} + | sort >SHA256SUMS
)

printf 'Suno Search package: %s\n' "$output_dir"
