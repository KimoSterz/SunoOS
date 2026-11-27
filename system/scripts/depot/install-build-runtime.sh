#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Install the published Suno Platform and SDK, and the Flathub linter, into the
# tools container's build installation ($DEPOT_ROOT/flatpak-user).
#
# The runtime is installed from the local remote through the same signed
# summary and Suno.flatpakrepo key clients use, so an app is never built
# against a runtime that failed verification. Safe to run repeatedly: refs
# already installed are updated to the published commit.
set -euo pipefail
. "$(dirname -- "$0")/lib.sh"

depot_validate_build_architectures
site="$DEPOT_ROOT/site"
[ -f "$site/Suno.flatpakrepo" ] || depot_die "no $site/Suno.flatpakrepo; run update-remote.sh first"

# Different app builders may share one installation through distinct symlinks.
# Serialize remote configuration and deployment as one operation; otherwise a
# sibling's container-private repository URL can replace ours mid-install.
install -d "$depot_flatpak_user_dir"
compiler_installation=$(realpath "$depot_flatpak_user_dir")
exec 9>"$compiler_installation.compiler.lock"
flock --exclusive 9

depot_in_tools bash -s -- "$site" "$depot_repo" "$DEPOT_RUNTIME_BRANCH" "$DEPOT_ARCH" "$DEPOT_TOOLS_ARCH" <<'SH'
set -euo pipefail
site=$1 repo=$2 branch=$3 target_arch=$4 tools_arch=$5
sed "s#^Url=.*#Url=file://$repo#" "$site/Suno.flatpakrepo" >/tmp/Suno-local.flatpakrepo
flatpak remote-add --user --if-not-exists Suno-local /tmp/Suno-local.flatpakrepo
flatpak remote-modify --user --url="file://$repo" Suno-local
flatpak install --user --arch="$target_arch" --noninteractive --or-update Suno-local \
  "org.projectSuno.Platform//$branch" "org.projectSuno.Sdk//$branch"
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user --arch="$tools_arch" --noninteractive --or-update flathub org.flatpak.Builder
SH
