#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""The session's hop between devices for run.sh: the saved snapshot is
published by one device of an account through a Connect Sync Hub (the
fake Hub of src/luma-connect-sync/tests) and taken by another, which writes
what it received for the next Shell run. The Hub's storage must hold no
window title or app ID.

  continue-hop.py SNAPSHOT OUTPUT
"""
import json
import os
import pickle
import shutil
import sys
import time
from pathlib import Path

repo = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(repo / "src/luma-connect-sync"), str(repo / "src/luma-connect-sync/tests")]

from fake_hub import FakeHub, serve  # noqa: E402
from harness import enrol_fake, make_device, temporary_root  # noqa: E402
from luma_connect_sync import sessions  # noqa: E402


def main() -> int:
    snapshot_file, output = Path(sys.argv[1]), Path(sys.argv[2])
    snapshot = json.loads(snapshot_file.read_text())
    root = temporary_root()
    fake = FakeHub()
    server = serve(fake)
    url = f"http://127.0.0.1:{server.server_address[1]}"
    checks = []
    try:
        devices = []
        for name in ("ThinkPad", "Surface"):
            device_id, token = enrol_fake(url, "acct-continue", name)
            devices.append(make_device(name, url, device_id, token, root / name))
        a, b = devices
        pending = a.account.begin_setup()
        a.account.finish_setup(pending, {i: pending.words[i - 1] for i in pending.check})
        b.account.request_join()
        a.account.join_requests()
        code = b.account.join_view().code
        a.account.approve(a.account.join_requests()[0]["id"], code)
        if hasattr(b.account, "confirm_join"):
            b.account.confirm_join(True)
        for d in devices:
            d.account.refresh()
            d.sessions = sessions.Sessions(d.engine, d.account, d.local, d.hub.device,
                                           lambda d=d: d.account.state()["devices"])
        home = root / "a-state" / "luma" / "session"
        home.mkdir(parents=True)
        snapshot["taken"] = int(time.time())
        snapshot["expires"] = snapshot["taken"] + sessions.TTL
        (home / "current.json").write_text(json.dumps(snapshot))
        os.environ["XDG_STATE_HOME"] = str(root / "a-state")
        started = time.monotonic()
        checks.append(("published", a.sessions.publish() == "published", ""))
        os.environ["XDG_STATE_HOME"] = str(root / "b-state")
        offer = b.sessions.offer()
        checks.append(("offered on the other device", bool(offer) and offer["windows"] == len(snapshot["windows"]),
                       json.dumps(offer)))
        taken = b.sessions.take(offer["id"])
        seconds = time.monotonic() - started
        checks.append(("taken intact", [w["title"] for w in taken["windows"]] == [w["title"] for w in snapshot["windows"]],
                       f"{seconds:.2f} s"))
        stored = pickle.dumps(fake.accounts)
        leaked = [w["title"] for w in snapshot["windows"] if w["title"].encode() in stored] + \
                 [w["app"] for w in snapshot["windows"] if w.get("app") and w["app"].encode() in stored]
        checks.append(("no title or app ID on the Hub", not leaked, ", ".join(leaked)))
        output.write_text(json.dumps(taken))
    finally:
        server.shutdown()
        shutil.rmtree(root, ignore_errors=True)
    for name, ok, detail in checks:
        print(json.dumps({"name": f"hop: {name}", "ok": ok, "detail": detail}))
    return sum(1 for _n, ok, _d in checks if not ok)


if __name__ == "__main__":
    sys.exit(main())
