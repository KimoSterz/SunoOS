#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Continue (ADR-055 Phase B) on two nightly VMs, one running at a time.

  vm-proof.py --work DIR --hub-tree TREE --shell-root DIR --mutter-root DIR

Builds on src/Suno-connect-sync/tests/two-vm (the Phase 1 proof): VMs with a
signed-in GDM session and Connect Sync as a user-level preview. Both VMs get
the Shell and Mutter under test (DESTDIR installs, as an ostree hotfix).

A turns Sync on, opens windows (floating, maximized, minimized), takes its
lock snapshot and publishes it, and shuts down. B joins with the recovery
key (no other device needed), opens a window of its own, takes the offer,
continues it, and its own snapshot is compared with A's: every window back,
state kept, its share of the work area kept, focus kept, B's own window
untouched; the Hub's storage holds no window title or app ID.
Results are JSON lines in DIR/results.jsonl.
"""
import argparse
import json
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(REPO / "src/Suno-connect-sync/tests/two-vm"))
import proof as phase1  # noqa: E402

HUB_PORT = 3292
phase1.HUB_PORT = HUB_PORT
phase1.PORTS.update({"ca": 41611, "cb": 41612})
phase1.NAMES.update({"ca": "ThinkPad", "cb": "Surface"})
USER, HOME = phase1.USER, phase1.HOME
APPS = {"docs": "org.projectSuno.ContinueDocs", "counter": "org.projectSuno.ContinueCounter",
        "keyed": "org.projectSuno.ContinueKeyed"}
# The disposable test keyring's unlock prompt is the VM's, not the session's.
NOT_OURS = {"org.projectSuno.Keyring.desktop"}


class ContinueProof(phase1.Proof):
    def __init__(self, work: Path, tree: Path, shell_root: Path, mutter_root: Path) -> None:
        super().__init__(work, tree)
        self.shell_root, self.mutter_root = shell_root, mutter_root
        self.rpms: list[str] = []

    def s_hub(self) -> None:
        state_dir = "/var/tmp/continue-hub"
        subprocess.run(["systemctl", "stop", "continue-devhub"], capture_output=True)
        subprocess.run(["rm", "-rf", state_dir], check=True)
        subprocess.run(["systemd-run", "--unit=continue-devhub", "--collect", "-p", f"WorkingDirectory={self.tree}",
                        "-E", f"SUNO_HUB_STATE={state_dir}", "nice", "node", "tests/dev-hub.mjs", "--port", str(HUB_PORT)],
                       check=True, capture_output=True)

        def answers() -> bool:
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{HUB_PORT}/api/sync/v1/account", timeout=3)
            except urllib.error.HTTPError as error:
                return error.code == 401
            except OSError:
                return False
            return False
        ok, _ = self.wait("hub", answers, 180, 2)
        self.state["hub_state"] = state_dir
        self.save()
        self.emit("local Hub answers", ok, state_dir)

    def deploy(self, name: str) -> None:
        """The RPMs under test as an image update (rpm-ostree override replace), then a
        reboot into it: the way an update reaches a computer, and nothing under /usr
        changes while a session runs."""
        stage = "/var/tmp/continue-rpms"
        self.ssh(name, f"rm -rf {stage} && mkdir -p {stage}")
        for rpm in self.rpms:
            subprocess.run(f"{phase1.HERE}/vm.sh {self.work} ssh {name} 'cat > {stage}/{Path(rpm).name}' < {shlex.quote(rpm)}",
                           shell=True, check=True, timeout=900)
        out = self.vm("ssh", name, f"rpm-ostree override replace {stage}/*.rpm", check=False, timeout=3600)
        self.emit(f"{name}: the build under test is deployed as an image update", out.returncode == 0,
                  (out.stdout + out.stderr).strip()[-300:])
        self.ssh(name, "systemctl reboot", check=False, timeout=30)
        time.sleep(20)
        ok, seconds = self.wait("ssh", lambda: self.ssh(name, "true", check=False, timeout=20) == "", 1500, 10)
        self.emit(f"{name}: boots into it", ok, f"{seconds:.0f} s")

    def overlay(self, name: str, copy: bool = True) -> None:
        """The build under test in the session: built RPMs deployed as an image update
        (deploy), or DESTDIR installs over the image's /usr (an overlay mount, as
        `ostree admin unlock` makes), then the test apps."""
        # Connect Sync admits only the Shell, phosh and Settings (1.Suno.6); this
        # proof calls it through gdbus, so a test VM lets gdbus in. Nothing ships
        # in callers.d.
        self.ssh(name, "install -d -m 0755 /etc/Suno/connect-sync/callers.d && "
                       "printf '/usr/bin/gdbus\\n' > /etc/Suno/connect-sync/callers.d/test.conf && "
                       "chown root:root /etc/Suno/connect-sync/callers.d/test.conf && "
                       "chmod 0644 /etc/Suno/connect-sync/callers.d/test.conf", check=False)
        stage = "/var/tmp/continue-root"
        if self.rpms:
            if copy:
                self.deploy(name)
        elif copy:
            self.ssh(name, f"rm -rf {stage} && mkdir -p {stage}")
            for root in (self.mutter_root, self.shell_root):
                subprocess.run(f"tar -C {shlex.quote(str(root))} -cf - usr | {phase1.HERE}/vm.sh {self.work} ssh {name} "
                               f"'tar -C {stage} -xf -'", shell=True, check=True, timeout=900)
        if copy and not self.rpms:
            schemas = f"{stage}/usr/share/glib-2.0/schemas"
            self.ssh(name, f"cp -n /usr/share/glib-2.0/schemas/*.xml /usr/share/glib-2.0/schemas/*.override {schemas}/ 2>/dev/null; "
                           f"glib-compile-schemas {schemas}", check=False)
            # The overlay's directories and files show with their own labels: give them
            # /usr's, or confined services can't read through the merged /usr.
            self.ssh(name, f"setfiles -r {stage} /etc/selinux/targeted/contexts/files/file_contexts {stage}/usr", check=False, timeout=600)
        if copy and not self.rpms:
            # From the next boot on the overlay is up before the display manager, so the
            # session after a reboot is the one under test from its first frame (swapping
            # /usr under a running session takes its processes down with it).
            unit = (f"[Unit]\nDescription=Shell and Mutter under test\nDefaultDependencies=no\n"
                    f"After=local-fs.target\nBefore=gdm.service systemd-user-sessions.service\n"
                    f"[Service]\nType=oneshot\nRemainAfterExit=yes\n"
                    f"ExecStart=/usr/bin/mount -t overlay continue -o lowerdir={stage}/usr:/usr /usr\n"
                    f"[Install]\nWantedBy=multi-user.target\n")
            self.ssh(name, "cat > /etc/systemd/system/continue-usr-overlay.service && systemctl daemon-reload && "
                           "systemctl enable continue-usr-overlay.service", input=unit, check=False)
            self.ssh(name, f"systemctl stop gdm; grep -q ' /usr overlay ' /proc/mounts || "
                           f"mount -t overlay continue -o lowerdir={stage}/usr:/usr /usr; systemctl start gdm",
                     check=False, timeout=300)
        ok, seconds = self.wait("session", lambda: self.user(
            name, "gdbus introspect --session -d org.projectSuno.Session -o /org/projectSuno/Session", check=False)
            .count("SaveState") == 1, 300, 5)
        self.emit(f"{name}: Shell and Mutter under test running in the session", ok, f"{seconds:.0f} s")
        if not copy:
            return
        apps = HOME + "/.local/share/applications"
        self.ssh(name, f"install -d -o {USER} -g {USER} {apps} {HOME}/continue")
        for script in ("docs.py", "counter.py", "keyed.py"):
            subprocess.run(f"{phase1.HERE}/vm.sh {self.work} ssh {name} 'cat > {HOME}/continue/{script}' < {HERE / script}",
                           shell=True, check=True)
        for key, app in APPS.items():
            entry = (f"[Desktop Entry]\nType=Application\nName=Continue {key}\n"
                     f"Exec=env SUNO_SESSION_OUT={HOME}/continue python3 {HOME}/continue/{key}.py\n")
            self.ssh(name, f"cat > {apps}/{app}.desktop", input=entry)
        self.ssh(name, f"chown -R {USER}:{USER} {HOME}/continue {apps}")

    def poweroff(self, name: str) -> None:
        """A clean shutdown, as a person's: the VM is only stopped once it is off."""
        self.ssh(name, "systemctl poweroff", check=False, timeout=30)
        self.wait("off", lambda: subprocess.run(["virsh", "-c", "qemu:///system", "domstate", f"connect-sync-{name}"],
                                                capture_output=True, text=True).stdout.strip() != "running", 300, 5)
        self.vm("stop", name, check=False)

    def session_call(self, name: str, method: str, args: str = "") -> str:
        return self.user(name, f"gdbus call --session -d org.projectSuno.Session -o /org/projectSuno/Session "
                               f"-m org.projectSuno.Session1.{method} {args}", timeout=120)

    def sync_call(self, name: str, method: str, args: str = "") -> str:
        return self.user(name, f"gdbus call --session -d org.projectSuno.ConnectSync1 -o /org/projectSuno/ConnectSync1 "
                               f"-m org.projectSuno.ConnectSync1.{method} {args}", timeout=600)

    @staticmethod
    def unwrap(answer: str) -> dict:
        # gdbus prints ('<json>',)
        text = answer.strip()[2:-3].encode().decode("unicode_escape")
        return json.loads(text) if text else {}

    def windows(self, name: str) -> list[dict]:
        snap = self.unwrap(self.session_call(name, "Snapshot", "request"))
        return [w for w in snap.get("windows", []) if w.get("app") not in NOT_OURS]

    def s_a(self) -> None:
        self.start("ca")
        self.overlay("ca")
        self.enrol("ca")
        out = self.cli("ca", f"setup --words-file {HOME}/.recovery-words")
        self.emit("ca: Sync on, recovery key in a private file", "member" in json.dumps(self.status("ca")), out.strip()[-200:])
        self.user("ca", f"env CONTINUE_DOCS='Doc A,Doc B,Doc C' CONTINUE_STATES='Doc B=maximized,Doc C=minimized' "
                        f"setsid python3 {HOME}/continue/docs.py >/dev/null 2>&1 &")
        self.user("ca", f"setsid python3 {HOME}/continue/counter.py >/dev/null 2>&1 &")
        self.user("ca", f"env SUNO_SESSION_OUT={HOME}/continue setsid python3 {HOME}/continue/keyed.py >/dev/null 2>&1 &")
        ok, _ = self.wait("windows", lambda: len(self.windows("ca")) >= 6, 120, 3)
        time.sleep(3)
        # The lock snapshot, as when the lid closes; then Sync publishes it.
        # As the Shell locks for the person (logind's Lock signal is not what locks here).
        self.user("ca", "gdbus call --session -d org.gnome.ScreenSaver -o /org/gnome/ScreenSaver "
                        "-m org.gnome.ScreenSaver.Lock", check=False)
        locked, _ = self.wait("lock snapshot", lambda: self.unwrap(self.session_call("ca", "GetSnapshot")).get("reason") == "lock", 30, 2)
        snapshot = self.unwrap(self.session_call("ca", "GetSnapshot"))
        snapshot["count"] = len(snapshot.get("windows", []))
        snapshot["windows"] = [w for w in snapshot.get("windows", []) if w.get("app") not in NOT_OURS]
        self.state["a_snapshot"] = snapshot
        self.save()
        self.emit("ca: lock snapshot taken", ok and locked and len(snapshot["windows"]) == 6,
                  json.dumps([(w["title"], w["state"], w["minimized"], w.get("key")) for w in snapshot["windows"]]))
        published = self.unwrap(self.sync_call("ca", "PublishContinue"))
        self.emit("ca: session published to Connect Sync", published.get("result") in ("published", "current", "no_readers"),
                  json.dumps(published))
        self.words = self.ssh("ca", f"cat {HOME}/.recovery-words")
        self.poweroff("ca")

    def s_b(self) -> None:
        self.start("cb")
        self.overlay("cb")
        self.enrol("cb")
        self.vm("ssh", "cb", "/root/as-user.sh Suno-connect-sync recover", input=self.words, check=False, timeout=600)
        standing = self.status("cb")["account"]["standing"]
        self.emit("cb: joined with the recovery key (no other device online)", standing == "member", standing)
        # A's record was sealed before B existed: A publishes again when it is next online. Until
        # then B has no key for it, which the offer must respect.
        offer = self.unwrap(self.sync_call("cb", "GetContinueOffer"))
        self.emit("cb: no offer for a session sealed before it joined", not offer, json.dumps(offer)[:200])
        self.poweroff("cb")
        # A starts again (a reboot): the session comes back at login (Phase A),
        # then A publishes it for both members and sleeps again.
        self.start("ca")
        self.overlay("ca", copy=False)
        a = self.state["a_snapshot"]
        ok, seconds = self.wait("reopened", lambda: len(self.windows("ca")) >= len(a["windows"]), 180, 3)
        time.sleep(3)
        back = self.windows("ca")
        same = all(any(w["title"] == s["title"] and w["frame"] == s["frame"] and w["state"] == s["state"] and
                       w["minimized"] == s["minimized"] for w in back) for s in a["windows"])
        self.emit("ca: after a reboot every window is back exactly (frame, state, minimized)", ok and same,
                  json.dumps([(w["title"], w["frame"], w["state"], w["minimized"]) for w in back]))
        self.user("ca", "Suno-connect-sync sync", check=False, timeout=600)
        published = self.unwrap(self.sync_call("ca", "PublishContinue"))
        # The sync cycle publishes it too; either way B now holds a key for it (checked by B's offer).
        self.emit("ca: published again for the new member", published.get("result") in ("published", "current"), json.dumps(published))
        self.poweroff("ca")

    def s_continue(self) -> None:
        self.start("cb")
        self.overlay("cb", copy=False)
        self.user("cb", "systemctl --user restart Suno-connect-syncd", check=False)
        self.user("cb", f"setsid python3 {HOME}/continue/counter.py >/dev/null 2>&1 &")
        self.wait("own window", lambda: len(self.windows("cb")) >= 1, 120, 3)
        mine = self.windows("cb")[0]
        offer = self.unwrap(self.sync_call("cb", "GetContinueOffer"))
        a = self.state["a_snapshot"]
        self.emit("cb: offers ThinkPad's session after unlock", offer.get("name") == "ThinkPad" and
                  offer.get("windows", 0) >= len(a["windows"]), json.dumps(offer)[:300])
        started = time.monotonic()
        # Continue, as the banner's button does: take the offer from Sync and hand the
        # snapshot to the session (in Python: the snapshot is no gdbus argument).
        script = ("import sys\nfrom gi.repository import Gio, GLib\n"
                  "bus = Gio.bus_get_sync(Gio.BusType.SESSION)\n"
                  "def call(dest, path, iface, method, args):\n"
                  "    return bus.call_sync(dest, path, iface, method, args, None, 0, 600000, None).unpack()[0]\n"
                  "snap = call('org.projectSuno.ConnectSync1', '/org/projectSuno/ConnectSync1', 'org.projectSuno.ConnectSync1', "
                  "'TakeContinue', GLib.Variant('(s)', (sys.argv[1],)))\n"
                  "print(call('org.projectSuno.Session', '/org/projectSuno/Session', 'org.projectSuno.Session1', "
                  "'Restore', GLib.Variant('(ss)', (snap, 'continue'))))\n")
        self.ssh("cb", f"cat > {HOME}/continue/take.py && chown {USER}:{USER} {HOME}/continue/take.py", input=script)
        result = self.user("cb", f"python3 {HOME}/continue/take.py {shlex.quote(offer['id'])}", timeout=600)
        ok, _ = self.wait("restored", lambda: len(self.windows("cb")) >= len(a["windows"]) + 1, 120, 2)
        seconds = time.monotonic() - started
        time.sleep(4)
        after = self.windows("cb")
        self.state["b_after"] = after
        self.save()
        self.emit("cb: every window continued", ok, f"{seconds:.1f} s, {result.strip()[:120]}")
        stayed = next((w for w in after if w["title"] == mine["title"] and w["frame"] == mine["frame"]), None)
        self.emit("cb: the window already open here stayed where it was", stayed is not None and stayed["workspace"] == 0,
                  json.dumps(mine["frame"]))
        # Apps without the restore API reopen their own default windows on another device
        # (titles are theirs): the session gives each of its windows the state and place
        # one of A's windows of that app had. Compared per app, as sets.
        def shape(w):
            return (w["state"], w["minimized"], round(w["floatingShare"]["width"], 2), round(w["floatingShare"]["height"], 2))
        continued = [w for w in after if w is not stayed]
        for app in sorted({w["app"] for w in a["windows"]}):
            want = sorted(shape(w) for w in a["windows"] if w["app"] == app)
            got = sorted(shape(w) for w in continued if w["app"] == app)
            near = len(want) == len(got) and all(
                g[:2] == w[:2] and abs(g[2] - w[2]) < 0.02 and abs(g[3] - w[3]) < 0.02 for g, w in zip(got, want))
            self.emit(f"{app}: every window continued with its state and share of the work area", near,
                      json.dumps({"ThinkPad": want, "here": got}))
        # A SunoUI app (Suno_appkit.restore) gets each window's own state back, by its key.
        keyed = json.loads(self.user("cb", f"cat {HOME}/continue/keyed-restored.json", check=False) or "{}")
        texts = {key: state.get("text") for key, state in keyed.get("windows", [])}
        self.emit("org.projectSuno.ContinueKeyed: each window's own state came back by its key",
                  texts == {"note:1": "first note", "note:2": "second note"}, json.dumps(keyed))
        focus_a = next(((w["app"], w.get("key")) for w in a["windows"] if w["focus"]), None)
        focus_b = next(((w["app"], w.get("key")) for w in after if w["focus"]), None)
        self.emit("cb: the focused window is the one focused on ThinkPad", focus_a == focus_b, f"{focus_b} vs {focus_a}")
        stored = subprocess.run(["grep", "-rlaE", "Doc A|Doc B|Counter 1|first note|second note|org.projectSuno.Continue", self.state["hub_state"]],
                                capture_output=True, text=True).stdout.strip()
        self.emit("Hub storage holds no window title or app ID", stored == "", stored)
        self.poweroff("cb")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", required=True)
    parser.add_argument("--hub-tree", required=True)
    parser.add_argument("--shell-root", help="a DESTDIR install of the Shell under test")
    parser.add_argument("--mutter-root", help="a DESTDIR install of the Mutter under test")
    parser.add_argument("--rpms", nargs="*", default=[],
                        help="or the built RPMs (gnome-shell, mutter, ...), unpacked into one root")
    parser.add_argument("steps", nargs="*", default=["hub", "a", "b", "continue"])
    args = parser.parse_args()
    if args.rpms:
        root = Path(args.work) / "rpm-root"
        subprocess.run(["rm", "-rf", str(root)], check=True)
        root.mkdir(parents=True)
        for rpm in args.rpms:
            subprocess.run(f"rpm2cpio {shlex.quote(rpm)} | cpio -idm --quiet -D {shlex.quote(str(root))}", shell=True, check=True)
        # Directories cpio creates take the work directory's mode and ACLs (a
        # setgid, group-only scratch tree): as the image's /usr they'd lock
        # every user out. RPM directories are 0755.
        subprocess.run(["setfacl", "-R", "-b", str(root)], check=False)
        subprocess.run(["find", str(root), "-type", "d", "-exec", "chmod", "0755", "{}", "+"], check=True)
        empty = Path(args.work) / "empty-root" / "usr"
        empty.mkdir(parents=True, exist_ok=True)
        subprocess.run(["setfacl", "-b", str(empty)], check=False)
        empty.chmod(0o755)
        args.shell_root, args.mutter_root = str(root), str(empty.parent)
    run = ContinueProof(Path(args.work), Path(args.hub_tree), Path(args.shell_root), Path(args.mutter_root))
    run.rpms = [str(Path(rpm).resolve()) for rpm in args.rpms]
    for step in args.steps:
        run.step = step
        getattr(run, f"s_{step}")()
    return 0


if __name__ == "__main__":
    sys.exit(main())
