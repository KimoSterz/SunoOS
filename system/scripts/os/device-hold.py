#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Hold or release one device class on the shared ARM stream.

  device-hold.py show --arch aarch64 --channel nightly
  device-hold.py hold --arch aarch64 --channel nightly --target fairphone,fp6 \
      --good-through 1.0.0-nightly.20261119.2 --reason "Fairphone 6 audio check pending for 20261123.2"
  device-hold.py lift --arch aarch64 --channel nightly --target fairphone,fp6 --passed 1.0.0-nightly.20261123.2

Edits SUNO_OS_ROOT/publish/device-holds/ARCH/CHANNEL.json only. The hold reaches
devices with the next signed graph: run the graph sign and sync steps
(graph_from_releases.py, sign-update-graph.sh, stage-webroot.sh,
sync-to-cdn.sh --only graph) after every change. --good-through and --passed
must name releases published on the channel.
"""

import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import device_holds  # noqa: E402
from desktop_paths import releases_path  # noqa: E402
from update_graph import version_key  # noqa: E402


def published(repo, arch, channel):
    versions = []
    for path in glob.glob(str(releases_path(repo, arch) / "*" / "manifest.json")):
        with open(path, encoding="utf-8") as stream:
            manifest = json.load(stream)
        if manifest.get("channel") == channel and not manifest.get("hardware_target"):
            versions.append(manifest["version"])
    return sorted(versions, key=version_key)


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", choices=("show", "hold", "lift"))
    parser.add_argument("--arch", required=True, choices=("x86_64", "aarch64"))
    parser.add_argument("--channel", required=True, choices=("stable", "beta", "nightly"))
    parser.add_argument("--root", default=os.environ.get("SUNO_OS_ROOT", ""))
    parser.add_argument("--repo", help="channel repository (default: ROOT/publish/public-repo)")
    parser.add_argument("--target")
    parser.add_argument("--good-through")
    parser.add_argument("--passed")
    parser.add_argument("--reason", default="")
    args = parser.parse_args(argv[1:])
    if not args.root:
        parser.error("--root or SUNO_OS_ROOT is required")
    repo = args.repo or os.path.join(args.root, "publish", "public-repo")
    path = device_holds.default_path(repo, args.arch, args.channel)
    state = device_holds.load(path, args.arch, args.channel)
    if args.action == "show":
        json.dump(state["holds"], sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
        return 0
    if not args.target:
        parser.error("--target is required")
    versions = published(repo, args.arch, args.channel)
    if args.action == "hold":
        if args.good_through not in versions:
            parser.error(f"--good-through {args.good_through} is not a published {args.channel} release")
        device_holds.hold(state, args.target, args.good_through, args.reason)
    else:
        if args.passed not in versions:
            parser.error(f"--passed {args.passed} is not a published {args.channel} release")
        device_holds.lift(state, args.target, args.passed, versions[-1])
    device_holds.save(path, state)
    held = state["holds"].get(args.target)
    print(f"{args.target}: " + (f"held, good through {held['good_through']}" if held else "not held"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
