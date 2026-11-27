#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""The ADR-057 two-VM proof: a test Flatpak signed from a test remote uses Connect Sync for apps through the
patched portal on two nightly VMs of one account, against the fake Hub (tests/fake_hub.py, which checks every
signature the Hub checks and serves the registry, tokens and reports of connect-sync-apps-hub.md).

  apps_proof.py --work DIR --base BASE.qcow2 --key KEY --portal-rpm RPM STEP [STEP ...]

Steps, in order: prepare hub portal vms account flatpak gate sync lease assets revoke lookalike stop.
Results are JSON lines in DIR/results.jsonl; DIR/apps-proof.done is written when a run ends.
"""
from __future__ import annotations

import argparse
import base64
import json
import shlex
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
TESTS = HERE.parent
sys.path.insert(0, str(TESTS))
sys.path.insert(0, str(TESTS.parent))
sys.path.insert(0, str(HERE))

import proof as base_proof  # noqa: E402

APP = "org.example.SyncProbe"
HUB_PORT = 3297
VMS = {"apps-a": 41511, "apps-b": 41512}
NAMES = {"apps-a": "Desktop A", "apps-b": "Living room TV"}
REMOTE_PATH = "/var/lib/sync-probe-repo"
REMOTE_URL = f"file://{REMOTE_PATH}"
DAY = 86_400_000

base_proof.HUB_PORT = HUB_PORT
base_proof.PORTS.update(VMS)
base_proof.NAMES.update(NAMES)


class AppsProof(base_proof.Proof):
    def __init__(self, work: Path, args) -> None:
        super().__init__(work, Path("/nonexistent"))
        self.args = args

    # ------------------------------------------------------------ helpers
    def probe(self, name: str, *args: str) -> dict:
        out = self.user(name, "flatpak run --command=sync-probe " + APP + " " + " ".join(shlex.quote(a) for a in args),
                        check=False, timeout=120)
        try:
            return json.loads(out.strip().splitlines()[-1])
        except (ValueError, IndexError):
            return {"raw": out[-400:]}

    def cycle(self, name: str) -> None:
        self.cli(name, "sync", check=False, timeout=600)

    def publish(self, apps: list[dict]) -> None:
        import apps_testkit as kit
        self.state["version"] = self.state.get("version", 0) + 1
        now = int(time.time() * 1000)
        token = self.state["token_key"]
        body = kit.registry_body(self.state["version"], apps, [{**token, "not_before": now - DAY, "not_after": now + 30 * DAY}],
                                 issued_at=now, expires_at=now + 14 * DAY)
        sig = kit.minisign_sign(body, f"registry:{self.state['version']}")
        self.hub_post("/__test/registry", {"body": kit.b64url(body), "sig": kit.b64url(sig), "version": self.state["version"],
                                           "apps": [[a["owner"], a["app"]] for a in apps]})
        self.save()

    def entry(self, **change) -> dict:
        entry = {"owner": self.state["owner"], "app": APP, "keys": [self.state["publisher_key"]], "state": "approved",
                 "purge": False, "labels": ["saves", "library"], "limits": {}, "changed_at": int(time.time() * 1000)}
        entry.update(change)
        return entry

    def hub_get(self, path: str) -> dict:
        with urllib.request.urlopen(f"http://127.0.0.1:{HUB_PORT}{path}", timeout=30) as response:
            return json.loads(response.read())

    # ------------------------------------------------------------ steps
    def s_prepare(self) -> None:
        """Test keys, the signed test remote with the probe app, and the patched portal binary (all on the host)."""
        import apps_testkit as kit
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from Suno_connect_sync.apps_api import tokens as tk
        gpg_home = self.work / "gpg"
        shutil.rmtree(gpg_home, ignore_errors=True)
        gpg_home.mkdir(mode=0o700)
        gpg = kit.Gpg(gpg_home)
        publisher = gpg.new_key("Sync Probe Publisher", subkey=True)
        (self.work / "publisher.gpg").write_bytes(publisher["key"])
        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        (self.work / "TEST-ONLY-token-key.pem").write_bytes(private.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        n = private.public_key().public_numbers()
        spki = tk.spki_pss(n.n, n.e)
        self.state.update(publisher_primary=publisher["primary"], publisher_key=kit.b64url(publisher["key"]),
                          owner=kit.owner(REMOTE_URL, [publisher["primary"]]),
                          token_key={"id": tk.key_id(spki).hex(), "spki": kit.b64url(spki)})
        (self.work / "registry.pub").write_text(kit.minisign_public())
        # The app: files/bin/sync-probe on the GNOME runtime (python3 + PyGObject), no permissions at all.
        build = self.work / "probe-build"
        repo = self.work / "probe-repo"
        shutil.rmtree(build, ignore_errors=True)
        shutil.rmtree(repo, ignore_errors=True)
        runtime = self.args.runtime
        run = lambda *c: subprocess.run(list(c), check=True, capture_output=True, text=True)  # noqa: E731
        # Written by hand rather than with build-init, so the host needs no SDK.
        (build / "files/bin").mkdir(parents=True)
        (build / "export").mkdir()
        (build / "metadata").write_text(f"[Application]\nname={APP}\nruntime=org.gnome.Platform/x86_64/{runtime}\n"
                                        f"sdk=org.gnome.Sdk/x86_64/{runtime}\ncommand=sync-probe\n")
        shutil.copy(HERE / "sync-probe.py", build / "files/bin/sync-probe")
        (build / "files/bin/sync-probe").chmod(0o755)
        run("flatpak", "build-export", f"--gpg-sign={publisher['primary']}", f"--gpg-homedir={gpg_home}", str(repo), str(build))
        run("flatpak", "build-update-repo", f"--gpg-sign={publisher['primary']}", f"--gpg-homedir={gpg_home}", str(repo))
        subprocess.run(["tar", "-czf", str(self.work / "probe-repo.tgz"), "-C", str(repo), "."], check=True)
        self.save()
        self.emit("test publisher key (primary + signing subkey), token key, signed test remote", True, f"owner {self.state['owner']}")

    def s_portal(self) -> None:
        """The patched portal (0006) from its RPM."""
        portal = self.work / "portal"
        shutil.rmtree(portal, ignore_errors=True)
        portal.mkdir()
        subprocess.run(f"rpm2cpio {shlex.quote(self.args.portal_rpm)} | cpio -idm --quiet ./usr/libexec/xdg-desktop-portal",
                       shell=True, cwd=portal, check=True)
        self.emit("patched portal binary extracted", (portal / "usr/libexec/xdg-desktop-portal").is_file(), self.args.portal_rpm)

    def s_hub(self) -> None:
        subprocess.run(["systemctl", "stop", "connect-sync-apps-hub"], capture_output=True)
        subprocess.run(["systemd-run", "--unit=connect-sync-apps-hub", "--collect", f"-p", f"WorkingDirectory={TESTS}",
                        "nice", sys.executable, str(HERE / "apps_hub.py"), "--port", str(HUB_PORT),
                        "--token-key", str(self.work / "TEST-ONLY-token-key.pem")], check=True, capture_output=True)
        def answers() -> bool:
            try:
                return self.hub_get("/__test/apps") is not None
            except OSError:
                return False
        ok, _ = self.wait("hub", answers, 60, 1)
        self.publish([self.entry()])
        self.emit("fake Hub with the apps routes; registry v1 approves the probe app for its publisher key", ok, "")

    def s_vms(self) -> None:
        for name in VMS:
            self.start(name)
            self.setup_vm(name)

    def setup_vm(self, name: str) -> None:
        lib = f"{base_proof.HOME}/.local/lib/Suno-connect-sync"
        subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} 'install -d -m 0755 /etc/Suno-connect-sync && install -m 0644 /dev/stdin /etc/Suno-connect-sync/registry.pub' "
                       f"< {self.work / 'registry.pub'}", shell=True, check=True)
        subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} 'install -D -m 0755 /dev/stdin /usr/local/libexec/xdg-desktop-portal-0006' "
                       f"< {self.work / 'portal/usr/libexec/xdg-desktop-portal'}", shell=True, check=True)
        subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} 'install -d {REMOTE_PATH} && tar -xzf - -C {REMOTE_PATH}' "
                       f"< {self.work / 'probe-repo.tgz'}", shell=True, check=True)
        subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} 'install -m 0644 /dev/stdin /root/publisher.gpg' < {self.work / 'publisher.gpg'}",
                       shell=True, check=True)
        u = base_proof.USER
        home = base_proof.HOME
        self.ssh(name, f"install -d -o {u} -g {u} {home}/.config/systemd/user/Suno-connect-syncd.service.d "
                       f"{home}/.config/systemd/user/xdg-desktop-portal.service.d && "
                       f"printf '[Service]\\nEnvironment=SUNO_SYNC_REGISTRY_URL=http://127.0.0.1:43100/sync/apps/v1/registry.json\\n"
                       f"Environment=SUNO_SYNC_METRICS_URL=http://127.0.0.1:43100/api/sync-metrics/v1/report\\n' "
                       f"> {home}/.config/systemd/user/Suno-connect-syncd.service.d/test-hub.conf && "
                       f"printf '[Service]\\nExecStart=\\nExecStart=/usr/local/libexec/xdg-desktop-portal-0006\\n' "
                       f"> {home}/.config/systemd/user/xdg-desktop-portal.service.d/0006.conf && "
                       f"chown -R {u}:{u} {home}/.config/systemd && cp /root/publisher.gpg {home}/publisher.gpg && chown {u}:{u} {home}/publisher.gpg")
        self.user(name, "systemctl --user daemon-reload; systemctl --user restart xdg-desktop-portal Suno-connect-syncd", check=False,
                  timeout=120)
        unit = self.user(name, "systemctl --user show -p MainPID --value xdg-desktop-portal.service | xargs -I{} cat /proc/{}/cgroup",
                         check=False).strip()
        self.emit(f"{name}: the patched portal runs in xdg-desktop-portal.service", unit.endswith("xdg-desktop-portal.service"), unit[-120:])
        version = self.user(name, "gdbus call --session --dest org.freedesktop.portal.Desktop --object-path /org/freedesktop/portal/desktop "
                                  "--method org.freedesktop.DBus.Properties.Get org.projectSuno.portal.Sync version", check=False).strip()
        self.emit(f"{name}: patched portal answers org.projectSuno.portal.Sync", version == "(<uint32 1>,)", version)
        del lib

    def s_account(self) -> None:
        self.state.setdefault("devices", {})
        for name in VMS:
            self.enrol(name)
        a, b = list(VMS)
        out = self.cli(a, f"setup --words-file {base_proof.HOME}/.recovery-words")
        self.emit(f"{a}: Sync turned on", self.status(a)["account"]["standing"] == "member", out.strip()[-200:])
        self.user(b, "rm -f /tmp/lcs-code; setsid nohup Suno-sync join --wait 600 --code-file /tmp/lcs-code > /tmp/lcs-join.log 2>&1 &")
        ok, _ = self.wait("code", lambda: self.user(b, "cat /tmp/lcs-code 2>/dev/null").strip() != "", 240, 3)
        joined = False
        if ok:
            join_id, code_b = self.user(b, "cat /tmp/lcs-code").split()
            card = next((c for c in json.loads(self.cli(a, "requests")) if c["id"] == join_id), {})
            if card.get("code") == code_b:
                self.cli(a, f"approve {join_id} --code {code_b}")
                self.cli(b, "join-confirm yes")
                joined, _ = self.wait("member", lambda: self.status(b)["account"]["standing"] == "member", 300, 5)
                self.user(b, "systemctl --user restart Suno-connect-syncd", check=False)
        self.emit(f"{b}: joined {a}'s account by code (same six digits on both)", joined, "")

    def s_flatpak(self) -> None:
        for name in VMS:
            self.user(name, f"flatpak remote-add --user --if-not-exists --gpg-import={base_proof.HOME}/publisher.gpg probe {REMOTE_URL}",
                      check=False)
            self.user(name, f"flatpak install --user --noninteractive -y flathub org.gnome.Platform//{self.args.runtime}",
                      check=False, timeout=3600)
            out = self.user(name, f"flatpak install --user --noninteractive -y probe {APP}", check=False, timeout=900)
            listed = APP in self.user(name, "flatpak list --app --columns=application", check=False)
            self.emit(f"{name}: probe app installed from the signed test remote (user installation)", listed, out[-300:])

    def s_gate(self) -> None:
        a = list(VMS)[0]
        status = self.probe(a, "status")
        self.emit(f"{a}: approved app without a permission row is offered", status.get("status", {}).get("status") == "offered",
                  json.dumps(status)[:300])
        direct = self.probe(a, "direct")
        self.emit(f"{a}: the app can't reach the implementation directly from its sandbox", direct.get("reached") is False,
                  json.dumps(direct))
        host = self.user(a, "gdbus call --session --dest org.projectSuno.ConnectSync1 --object-path /org/projectSuno/ConnectSync1/Apps "
                            "--method org.projectSuno.impl.portal.Sync.GetStatus \"{'app_id': <'org.example.SyncProbe'>, 'kind': <'flatpak'>}\" 2>&1",
                         check=False)
        self.emit(f"{a}: a host process that isn't the portal is refused by the implementation", "Refused" in host, host.strip()[-200:])
        for name in VMS:
            self.user(name, "gdbus call --session --dest org.freedesktop.impl.portal.PermissionStore --object-path "
                            "/org/freedesktop/impl/portal/PermissionStore --method org.freedesktop.impl.portal.PermissionStore.SetPermission "
                            f"Suno true sync {APP} \"['on']\"", check=False)
            self.cycle(name)
            status = self.probe(name, "status")
            self.emit(f"{name}: with the permission on, the app's status is available",
                      status.get("status", {}).get("status") == "available", json.dumps(status)[:300])

    def s_sync(self) -> None:
        a, b = list(VMS)
        saved = self.probe(a, "save", "saves", "slot1", "level 3 at the castle")
        self.emit(f"{a}: save answered", saved.get("results", [{}])[0].get("outcome") == "saved", json.dumps(saved)[:300])
        self.probe(a, "save", "library", "game:zelda", "played 2026-11-24")
        started = time.monotonic()
        self.cycle(a)
        ok, _ = self.wait("arrive", lambda: (self.cycle(b) or True) and
                          self.probe(b, "get", "saves", "slot1").get("record", {}).get("value") == "level 3 at the castle", 600, 10)
        self.emit(f"{b}: the save made on {a} resumes here", ok, f"{time.monotonic() - started:.0f} s")
        lib = self.probe(b, "get", "library", "game:zelda")
        self.emit(f"{b}: the library record shows on both", lib.get("record", {}).get("value") == "played 2026-11-24", json.dumps(lib)[:200])
        hub = self.hub_get("/__test/apps")
        self.emit("the Hub holds app zones under one tag only (no app id, labels or names)", hub["tags"] == 1 and hub["app_zones"] >= 2,
                  json.dumps({k: hub[k] for k in ("tags", "app_zones")}))
        issued = hub.get("issued", {})
        self.emit("each device took exactly 64 report tokens today", sorted(set(issued.values())) == [64] and len(issued) == 2,
                  json.dumps(issued))

    def s_lease(self) -> None:
        a, b = list(VMS)
        lease = self.probe(b, "lease", "saves", "slot1")
        self.cycle(b)
        self.cycle(a)
        seen = self.probe(a, "get-lease", "saves", "slot1")
        holder = seen.get("lease", {}).get("holder", {})
        self.emit(f"{a}: shows the game is in use on {NAMES[b]}", seen.get("lease", {}).get("active") is True and holder.get("name") == NAMES[b],
                  json.dumps({"lease": lease, "seen": seen})[:400])

    def s_assets(self) -> None:
        a, b = list(VMS)
        current = self.probe(a, "get", "saves", "slot1").get("record", {}).get("version", "")
        put = self.probe(a, "asset", "saves", "slot1", "state", "emulator state blob", current)
        self.cycle(a)
        ok, _ = self.wait("asset", lambda: (self.cycle(b) or True) and self.probe(b, "open", "saves", "slot1", "state").get("text")
                          == "emulator state blob", 600, 10)
        self.emit(f"{b}: an inline asset saved on {a} opens here (sealed copy)", ok, json.dumps(put)[:200])

    def s_revoke(self) -> None:
        self.publish([self.entry(state="revoked", purge=True)])
        ok = True
        for name in VMS:
            # The Hub's wait hint names the new registry; one cycle later the app is stopped.
            done, seconds = self.wait("revoked", lambda: (self.cycle(name) or True) and
                                      self.probe(name, "status").get("status", {}).get("status") == "revoked", 600, 10)
            ok = ok and done
            self.emit(f"{name}: revoked in the registry stops the app here", done, f"{seconds:.0f} s")
        hub = self.hub_get("/__test/apps")
        self.emit("revoke purges the app's zones from the Hub", hub["app_zones"] == 0, json.dumps({"app_zones": hub["app_zones"]}))
        local = self.probe(list(VMS)[0], "save", "saves", "paused", "kept here")
        self.emit("writes after the revoke stay on the device (local)", local.get("results", [{}])[0].get("outcome") == "local",
                  json.dumps(local)[:200])

    def s_lookalike(self) -> None:
        """The same app ID built locally, unsigned, from a remote with gpg-verify off: unverified, nothing stored."""
        b = list(VMS)[1]
        self.publish([self.entry()])
        self.user(b, f"flatpak uninstall --user --noninteractive -y {APP}", check=False, timeout=600)
        subprocess.run(f"{HERE}/vm.sh {self.work} ssh {b} 'install -m 0755 /dev/stdin /tmp/sync-probe' < {HERE / 'sync-probe.py'}",
                       shell=True, check=True)
        out = self.user(b, f"cd /tmp && rm -rf lk lkrepo && mkdir -p lk/files/bin lk/export && cp /tmp/sync-probe lk/files/bin/ && "
                           f"printf '[Application]\\nname={APP}\\nruntime=org.gnome.Platform/x86_64/{self.args.runtime}\\n"
                           f"sdk=org.gnome.Sdk/x86_64/{self.args.runtime}\\ncommand=sync-probe\\n' > lk/metadata && "
                           f"flatpak build-export lkrepo lk && flatpak remote-add --user --no-gpg-verify lookalike file:///tmp/lkrepo && "
                           f"flatpak install --user --noninteractive -y lookalike {APP} 2>&1 | tail -2", check=False, timeout=900)
        status = self.probe(b, "status")
        self.emit(f"{b}: lookalike (same app ID, unsigned, gpg-verify off) is unverified",
                  status.get("status", {}).get("status") == "unverified", json.dumps(status)[:300] + out[-200:])
        save = self.probe(b, "save", "saves", "slot1", "overwrite")
        self.emit(f"{b}: and every call but status is refused", save.get("dbus_error", "").endswith(".Refused"), json.dumps(save)[:300])

    def s_stop(self) -> None:
        for name in VMS:
            self.vm("stop", name, check=False)
        subprocess.run(["systemctl", "stop", "connect-sync-apps-hub"], capture_output=True)
        self.emit("VMs and the fake Hub stopped", True, "")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", required=True)
    parser.add_argument("--portal-rpm", default="")
    parser.add_argument("--runtime", default="49")
    parser.add_argument("steps", nargs="+")
    args = parser.parse_args()
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    run = AppsProof(work, args)
    try:
        for step in args.steps:
            run.step = step
            getattr(run, f"s_{step}")()
    finally:
        (work / "apps-proof.done").write_text(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
