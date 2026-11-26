#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Per-device update holds for the shared ARM stream (one OS commit, many devices).

A device class whose own check (FP6 audio, modem, camera ...) has not passed on
the newest release stays on its last good release; every other device updates.
The state lives beside the public repository, never in it:

  <LUMA_OS_ROOT>/publish/device-holds/<arch>/<channel>.json
  {"schema": "org.projectluma.device-holds/v1", "arch": ..., "channel": ...,
   "holds": {"fairphone,fp6": {"good_through": "<version>", "reason": "...", "since": "...Z"}}}

graph_from_releases.py marks every release newer than good_through with
device_holds [{"hardware_target", "reason"}] in the signed graph, so the hold is
signed with the graph and re-applied by every refresh. luma-update reads the
device's identity from its device tree and skips releases held for it.
"""

import datetime
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import devices  # noqa: E402
from update_graph import version_key  # noqa: E402

SCHEMA = "org.projectluma.device-holds/v1"


def default_path(repo, arch, channel):
    return os.path.join(os.path.dirname(os.path.abspath(repo)), "device-holds", arch, channel + ".json")


def load(path, arch, channel):
    try:
        with open(path, encoding="utf-8") as stream:
            state = json.load(stream)
    except FileNotFoundError:
        return {"schema": SCHEMA, "arch": arch, "channel": channel, "holds": {}}
    if (state.get("schema") != SCHEMA or state.get("arch") != arch or state.get("channel") != channel
            or not isinstance(state.get("holds"), dict)):
        raise ValueError(f"{path} is not a {arch} {channel} device-hold state")
    for target, hold in state["holds"].items():
        check(target, arch)
        version_key(hold["good_through"])
    return state


def check(target, arch):
    if devices.device(target)["arch"] != arch:
        raise ValueError(f"{target} is not an {arch} device")


def save(path, state):
    os.makedirs(os.path.dirname(path), mode=0o755, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".device-holds-")
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        json.dump(state, stream, indent=2, sort_keys=True)
        stream.write("\n")
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def hold(state, target, good_through, reason):
    """Keep TARGET on GOOD_THROUGH (its last good release). An existing hold
    keeps its older good_through: a newer pending check never widens it."""
    check(target, state["arch"])
    version_key(good_through)
    if not reason or len(reason) > 500 or any(ord(c) < 32 for c in reason):
        raise ValueError("a hold needs a one-line reason of at most 500 characters")
    current = state["holds"].get(target)
    if current and version_key(current["good_through"]) <= version_key(good_through):
        current["reason"] = reason
        return state
    state["holds"][target] = {"good_through": good_through, "reason": reason, "since": now()}
    return state


def lift(state, target, passed, newest):
    """TARGET's check passed on PASSED: offer it everything through PASSED. The
    hold goes when PASSED is the newest published release."""
    current = state["holds"].get(target)
    if current is None:
        return state
    if version_key(passed) >= version_key(newest):
        del state["holds"][target]
    elif version_key(passed) > version_key(current["good_through"]):
        current["good_through"] = passed
    return state


def release_holds(state, version):
    """The graph's device_holds for one release, or [] when nothing holds it."""
    return [{"hardware_target": target, "reason": hold["reason"]}
            for target, hold in sorted(state["holds"].items())
            if version_key(version) > version_key(hold["good_through"])]
