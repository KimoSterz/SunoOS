#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""The ADR-054 Phase 1 proof on two (then three) nightly VMs, step by step.

  proof.py --work DIR --hub-tree TREE STEP [STEP ...]

Steps, in order: hub vms enrol setup keys join apps state running conflict
revoke rejoin recover signin grep. Each prints JSON lines {"step", "check", "result",
"detail"} and appends them to DIR/results.jsonl. State between steps is in
DIR/proof.json. The recovery words, tokens and canaries never reach the
output: they move between VMs over stdin and are compared inside a VM.
"""
from __future__ import annotations

import argparse
import json
import secrets
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent.parent
USER = "luma-sync"
HOME = f"/home/{USER}"
HUB_PORT = 3192
PORTS = {"a": 41501, "b": 41502, "c": 41503}
NAMES = {"a": "Desktop A", "b": "Laptop B", "c": "ThinkPad C"}
FLATHUB = ["org.gnome.TextEditor", "org.gnome.Calculator", "io.github.mrvladus.List", "org.gnome.World.Secrets",
           "de.haeckerfelix.Shortwave", "org.gnome.Podcasts", "com.github.finefindus.eyedropper", "dev.geopjr.Tuba"]
DEBS = ["galculator", "xterm"]
SETTING_APP = DOC_APP = "org.gnome.TextEditor"


class Proof:
    def __init__(self, work: Path, tree: Path) -> None:
        self.work, self.tree = work, tree
        self.state_path = work / "proof.json"
        self.state = json.loads(self.state_path.read_text()) if self.state_path.exists() else {}
        self.step = ""

    def save(self) -> None:
        self.state_path.write_text(json.dumps(self.state, indent=1))

    def emit(self, check: str, ok: bool, detail: str = "") -> bool:
        line = json.dumps({"step": self.step, "check": check, "result": "pass" if ok else "fail", "detail": detail[-600:],
                           "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        print(line, flush=True)
        with open(self.work / "results.jsonl", "a") as out:
            out.write(line + "\n")
        return ok

    # -- plumbing
    def vm(self, *args: str, input: str | None = None, timeout: int = 600, check: bool = True) -> subprocess.CompletedProcess:
        try:
            return subprocess.run([str(HERE / "vm.sh"), str(self.work), *args], input=input, text=True, capture_output=True,
                                  timeout=timeout, check=check)
        except subprocess.TimeoutExpired:
            if check:
                raise
            return subprocess.CompletedProcess(args, 124, "", "timed out")

    def ssh(self, name: str, command: str, **kw) -> str:
        return self.vm("ssh", name, command, **kw).stdout

    def user(self, name: str, command: str, **kw) -> str:
        return self.ssh(name, f"/root/as-user.sh sh -c {shlex.quote(command)}", **kw)

    def cli(self, name: str, args: str, **kw) -> str:
        return self.user(name, f"luma-sync {args}", **kw)

    def status(self, name: str) -> dict:
        return json.loads(self.cli(name, "status"))

    def wait(self, what: str, probe, timeout: int, every: float = 5) -> tuple[bool, float]:
        started = time.monotonic()
        while time.monotonic() - started < timeout:
            try:
                if probe():
                    return True, time.monotonic() - started
            except (subprocess.SubprocessError, ValueError, KeyError):
                pass
            time.sleep(every)
        return False, time.monotonic() - started

    def hub_post(self, path: str, value: dict) -> dict:
        request = urllib.request.Request(f"http://127.0.0.1:{HUB_PORT}{path}", data=json.dumps(value).encode(), method="POST",
                                         headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read())

    def flatpaks(self, name: str) -> set[str]:
        return set(self.user(name, "flatpak list --app --columns=application").split())

    def store_apps(self, name: str) -> set[str]:
        out = self.user(name, "ls ~/.local/share/luma/installer/applications 2>/dev/null || true")
        return {line.removesuffix(".json") for line in out.split() if line.endswith(".json")}

    # -- steps
    def s_hub(self) -> None:
        state_dir = "/var/tmp/connect-sync-hub/state-proof"
        subprocess.run(["systemctl", "stop", "connect-sync-devhub-proof"], capture_output=True)
        subprocess.run(["rm", "-rf", state_dir], check=True)
        subprocess.run(["systemd-run", "--unit=connect-sync-devhub-proof", "--collect", f"-p", f"WorkingDirectory={self.tree}",
                        "-E", f"LUMA_HUB_STATE={state_dir}", "-E", "LUMA_SYNC_ACCOUNTS=owner",  # the deploy configuration: owner-only
                        "nice", "node", "tests/dev-hub.mjs", "--port", str(HUB_PORT)], check=True, capture_output=True)
        def answers() -> bool:
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{HUB_PORT}/api/sync/v1/account", timeout=3)
            except urllib.error.HTTPError as error:
                return error.code == 401
            except OSError:
                return False
            return False
        ok, _ = self.wait("hub", answers, 60, 1)
        self.state["hub_state"] = state_dir
        self.state["canary"] = "lcs-canary-" + secrets.token_hex(12)
        self.state["password_canary"] = "lcs-signin-" + secrets.token_hex(12)
        self.save()
        self.emit("local Hub with the sync module answers /api/sync/v1/ (401 without a device)", ok, state_dir)
        # Owner-only: an enrolled device of any other account is refused before anything is read or written.
        stranger = self.hub_post("/__test/devices", {"account": "stranger", "name": "Stranger"})
        request = urllib.request.Request(f"http://127.0.0.1:{HUB_PORT}/api/sync/v1/account", headers={"Authorization": f"Bearer {stranger['token']}"})
        try:
            urllib.request.urlopen(request, timeout=5)
            code, body = 200, ""
        except urllib.error.HTTPError as error:
            code, body = error.code, error.read().decode(errors="replace")
        self.emit("owner-only Hub: another account's device gets 403 not_enabled", code == 403 and "not_enabled" in body, f"{code} {body[:120]}")

    def start(self, name: str) -> None:
        running = (self.work / f"{name}.port").exists() and self.vm("ssh", name, "true", check=False, timeout=20).returncode == 0
        booting = subprocess.run(["virsh", "-c", "qemu:///system", "domstate", f"connect-sync-{name}"], capture_output=True, text=True).stdout.strip() == "running"
        serial = Path(f"/var/log/libvirt/qemu/connect-sync-{name}-serial.log")

        def boot() -> int:
            self.vm("stop", name, check=False)
            self.vm("start", name, str(PORTS[name]))
            return serial.stat().st_size if serial.exists() else 0
        # A VM that is up but doesn't answer SSH is stuck from an earlier attempt: boot it again.
        offset = boot() if not running else (serial.stat().st_size if serial.exists() else 0)
        started, ok = time.monotonic(), False
        for attempt in range(3):
            # A loaded build host can stall a first boot (udev timeouts, emergency mode, pid 1 frozen): boot again.
            def up_or_stuck() -> bool:
                if serial.exists() and serial.stat().st_size > offset:
                    with open(serial, "rb") as log:
                        log.seek(offset)
                        tail = log.read()
                    if b"Freezing execution" in tail or b"emergency mode" in tail:
                        raise RuntimeError("stuck")
                return self.ssh(name, "true", timeout=20) == ""
            try:
                ok, _ = self.wait("ssh", up_or_stuck, 1200, 10)
            except RuntimeError:
                self.emit(f"{name}: boot {attempt + 1} stalled on the loaded host; booting again", True, "")
                offset = boot()
                continue
            break
        seconds = time.monotonic() - started
        if not self.emit(f"{name}: boots and answers SSH", ok, f"{seconds:.0f} s"):
            raise SystemExit(1)
        image = self.ssh(name, "rpm -q luma-connect-sync; . /etc/os-release; echo \"$IMAGE_VERSION $OSTREE_VERSION\"; "
                               "rpm-ostree status --booted --json | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"deployments\"][0][\"checksum\"])'",
                         check=False)
        self.emit(f"{name}: image (packaged luma-connect-sync, version, OS commit)", "luma-connect-sync" in image, " ".join(image.split()))
        subprocess.run(["tar", "-czf", str(self.work / "lcs.tgz"), "--exclude=__pycache__", "--exclude=tests", "-C", str(SOURCE), "."], check=True)
        for local, remote in ((self.work / "lcs.tgz", "/root/lcs.tgz"), (HERE / "as-user.sh", "/root/as-user.sh")):
            subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} 'cat > {remote}' < {shlex.quote(str(local))}", shell=True, check=True)
        self.ssh(name, "chmod +x /root/as-user.sh")
        out = subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} bash -s < {HERE}/prepare-vm.sh", shell=True, text=True, capture_output=True, timeout=600)
        self.emit(f"{name}: signed-in session and user-level preview installed", out.returncode == 0, (out.stdout + out.stderr).strip())
        self.vm("tunnel", name, str(HUB_PORT))

    def s_update(self) -> None:
        """Copy the current source into running VMs (after a code change), without rebooting them."""
        subprocess.run(["tar", "-czf", str(self.work / "lcs.tgz"), "--exclude=__pycache__", "--exclude=tests", "-C", str(SOURCE), "."], check=True)
        for name in [n for n in ("a", "b", "c") if (self.work / f"{n}.port").exists()]:
            if self.vm("ssh", name, "true", check=False, timeout=60).returncode:
                self.emit(f"{name}: source updated", False, "not reachable")
                continue
            subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} 'cat > /root/lcs.tgz' < {self.work / 'lcs.tgz'}", shell=True, check=True)
            lib = f"{HOME}/.local/lib/luma-connect-sync"
            self.ssh(name, f"rm -rf {lib} && install -d -o {USER} -g {USER} {lib} && tar -xzf /root/lcs.tgz -C {lib} && chown -R {USER}:{USER} {lib}")
            self.user(name, "systemctl --user restart luma-connect-syncd 2>/dev/null || true", check=False)
            self.emit(f"{name}: source updated", True, "")

    def s_vms(self) -> None:
        for name in ("a", "b"):
            self.start(name)

    def s_vm_b(self) -> None:
        self.start("b")

    def s_tunnels(self) -> None:
        for name in [n for n in ("a", "b", "c") if (self.work / f"{n}.port").exists()]:
            self.vm("tunnel", name, str(HUB_PORT), check=False)
            ok, _ = self.wait("tunnel", lambda: self.ssh(name, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:43100/api/sync/v1/account", check=False) == "401", 60, 3)
            self.emit(f"{name}: reaches the local Hub", ok, "")

    def keyring(self, name: str) -> None:
        """TEST-ONLY: a passwordless autologin session has no login keyring; make a disposable one, unlocked with a
        random password that is never printed or kept (as tests/os/gate/browser-fixture-keyring.py does)."""
        probe = ""
        for _attempt in range(4):
            # Stop whatever keyring the session (or D-Bus activation) started, then one with a throwaway password.
            # The secret portal keeps each app's secret in the login keyring: a new login keyring can't open the apps'
            # own keyring files from an earlier run ("couldn't calculate mac"), so those TEST-ONLY files go with it.
            self.ssh(name, f"systemctl --user -M {USER}@ stop gnome-keyring-daemon.service gnome-keyring-daemon.socket 2>/dev/null; "
                           f"pkill -u {USER} -f gnome-keyring-daemon; sleep 2; rm -f {HOME}/.local/share/keyrings/login.keyring "
                           f"{HOME}/.var/app/*/data/keyrings/default.keyring", check=False)
            self.user(name, "head -c 32 /dev/urandom | base64 | gnome-keyring-daemon --unlock --components=secrets --daemonize >/dev/null; sleep 3", check=False)
            probe = self.user(name, "python3 -c \"import gi; gi.require_version('Secret','1'); from gi.repository import Secret; "
                                    "print(Secret.Collection.for_alias_sync(Secret.Service.get_sync(Secret.ServiceFlags.LOAD_COLLECTIONS, None), "
                                    "'default', 0, None).get_locked())\"", check=False).strip()
            if probe == "False":
                break
        self.emit(f"{name}: login keyring unlocked (disposable test keyring)", probe == "False", probe)

    def s_keyrings(self) -> None:
        """After a reboot: the disposable login keyring again (the session's apps need it unlocked)."""
        for name in [n for n in ("a", "b", "c") if (self.work / f"{n}.port").exists()]:
            # A loaded host can keep SSH slow for minutes: ask again rather than skip the VM without a word.
            ok, _ = self.wait("ssh", lambda: self.vm("ssh", name, "true", check=False, timeout=60).returncode == 0, 600, 20)
            if not ok:
                if name != "c":
                    self.emit(f"{name}: answers SSH for the keyring and the service", False, "no answer in 600 s")
                continue
            self.keyring(name)
            self.user(name, "systemctl --user restart luma-connect-syncd", check=False, timeout=180)
            active = self.user(name, "systemctl --user is-active luma-connect-syncd", check=False).strip()
            self.emit(f"{name}: luma-connect-syncd running", active == "active", active)

    def enrol(self, name: str, device_id: str | None = None) -> None:
        self.keyring(name)
        answer = self.hub_post("/__test/devices", {"account": "owner", "name": NAMES[name], **({"device_id": device_id} if device_id else {})})
        registration = json.dumps({"device_id": answer["device_id"], "token": answer["token"], "hub": "http://127.0.0.1:43100",
                                   "name": NAMES[name], "registered_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        d = f"{HOME}/.local/share/luma/connect"
        self.ssh(name, f"install -d -m 0700 -o {USER} -g {USER} {HOME}/.local/share/luma {d} && install -m 0600 -o {USER} -g {USER} /dev/stdin {d}/device.json",
                 input=registration)
        self.state.setdefault("devices", {})[name] = answer["device_id"]
        self.save()
        self.user(name, "systemctl --user daemon-reload; systemctl --user restart luma-connect-syncd", check=False, timeout=180)
        ok, _ = self.wait("service", lambda: self.user(name, "systemctl --user is-active luma-connect-syncd", check=False).strip() == "active", 180, 3)
        self.emit(f"{name}: signed in to the local Hub; luma-connect-syncd running", ok, answer["device_id"])

    def s_enrol(self) -> None:
        for name in ("a", "b"):
            self.enrol(name)

    def s_setup(self) -> None:
        # A reused VM keeps an earlier run's TEST-ONLY words file; luma-sync rightly refuses to write over it.
        self.ssh("a", f"[ ! -e {HOME}/.recovery-words ] || mv {HOME}/.recovery-words {HOME}/.recovery-words-earlier-run-$(date +%s)")
        out = self.cli("a", f"setup --words-file {HOME}/.recovery-words")
        count = self.ssh("a", f"wc -w < {HOME}/.recovery-words").strip()
        status = self.status("a")
        self.emit("a: Sync turned on; 24-word recovery key written to a private file in the VM (not shown)",
                  count == "24" and status["account"]["standing"] == "member" and status["account"]["epoch"] == 1, out.strip())

    # -- Settings through its own UI (D-Bus-activated, as the Shell's links start it), against the packaged service
    def send(self, name: str, local: Path, remote: str) -> None:
        subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} 'cat > {remote}' < {shlex.quote(str(local))}", shell=True, check=True)

    def overlay(self, name: str, mode: str) -> dict:
        subprocess.run(["tar", "-czf", str(self.work / "lcs.tgz"), "--exclude=__pycache__", "--exclude=tests", "-C", str(SOURCE), "."], check=True)
        self.send(name, self.work / "lcs.tgz", "/root/lcs.tgz")
        out = subprocess.run(f"{HERE}/vm.sh {self.work} ssh {name} bash -s {mode} < {HERE}/image-overlay.sh", shell=True, text=True,
                             capture_output=True, timeout=600)
        lines = [line for line in out.stdout.splitlines() if line.startswith("{")]
        return json.loads(lines[-1]) if lines else {"error": (out.stdout + out.stderr)[-400:]}

    def ui(self, name: str, step: str, timeout: int = 900) -> dict:
        self.send(name, HERE / "settings-ui.py", "/root/settings-ui.py")
        self.ssh(name, "install -m 0755 /root/settings-ui.py /usr/local/bin/lcs-settings-ui")
        out = self.user(name, f"lcs-settings-ui {step}", check=False, timeout=timeout)
        lines = [line for line in out.splitlines() if line.startswith("{")]
        return json.loads(lines[-1]) if lines else {"ok": False, "detail": out[-400:]}

    def close_settings(self, name: str) -> None:
        self.user(name, "gdbus call --session -d org.gnome.Settings -o /org/gnome/Settings -m org.gtk.Actions.Activate quit [] {} "
                        ">/dev/null 2>&1; sleep 2", check=False)

    def settings_owner(self, name: str, step: str) -> dict:
        opened = self.ui(name, "open")
        owner = opened.get("owner") or {}
        self.emit(f"{name}: Settings started by D-Bus activation shows the Sync page ({step})",
                  bool(opened.get("ok")) and owner.get("unit", "").startswith(("dbus-", "app-dbus-")) and owner.get("exe") == "/usr/bin/gnome-control-center",
                  json.dumps(owner))
        return opened

    def s_ui_baseline(self) -> None:
        """The image's own package (before this change) refuses the D-Bus-activated Settings: the shipped bug."""
        info = self.overlay("a", "preview-off")
        self.emit("a: the image's packaged luma-connect-sync answers (user-level preview removed)",
                  info.get("unit") == "/usr/lib/systemd/user/luma-connect-syncd.service", json.dumps(info))
        self.close_settings("a")
        self.settings_owner("a", "image package")
        self.monitor("a")
        pressed = self.ui("a", "setup", timeout=600)
        replies = self.monitored("a")
        refused = any("NotAuthorized" in r and "Only the shell, Settings or a terminal" in r for r in replies)
        self.emit("a: the image's package refuses it when the Sync switch is pressed (NotAuthorized, as on the Dell)",
                  refused and not pressed.get("ok"), json.dumps({"bus_errors": replies[-3:], "sheet": pressed.get("detail")})[:600])
        self.close_settings("a")

    def monitor(self, name: str) -> None:
        """Record every error reply on the person's session bus (busctl; the image has no dbus-monitor)."""
        self.user(name, "pkill -u $(id -u) -f '^busctl --user monitor' ; rm -f /tmp/lcs-bus-errors; "
                        "setsid nohup busctl --user monitor --match=type=error > /tmp/lcs-bus-errors 2>&1 < /dev/null &", check=False)

    def monitored(self, name: str) -> list[str]:
        """The ConnectSync1 errors seen since monitor(); the monitor proves itself on a refusal it provokes (gdbus is
        not the Shell or Settings), so an empty list means none, not a monitor that saw nothing."""
        self.user(name, "gdbus call --session -d org.projectluma.ConnectSync1 -o /org/projectluma/ConnectSync1 "
                        "-m org.projectluma.ConnectSync1.ListJoinRequests >/dev/null 2>&1; sleep 2", check=False)
        text = self.user(name, "pkill -u $(id -u) -f '^busctl --user monitor'; cat /tmp/lcs-bus-errors", check=False)
        errors = [line.strip() for line in text.splitlines() if "ErrorName=org.projectluma.ConnectSync1" in line]
        if not errors:
            raise RuntimeError("the bus monitor saw nothing, not even the refusal it provoked")
        return errors[:-1]                                   # the last is the provoked one

    def s_image(self) -> None:
        for name in ("a", "b"):
            info = self.overlay(name, "install")
            self.keyring(name)       # the new session's login keyring (test-only, as after a reboot)
            want = subprocess.run(["sha256sum", str(SOURCE / "luma_connect_sync/callers.py")], capture_output=True, text=True).stdout[:12]
            self.emit(f"{name}: this change installed where the package puts it (/usr overlay); the packaged unit runs it",
                      info.get("unit") == "/usr/lib/systemd/user/luma-connect-syncd.service" and info.get("callers_py") == want
                      and info.get("shell_runs_usr_bin_gnome_shell") == "yes"
                      and str(info.get("module", "")).startswith("/usr/lib"), json.dumps(info))

    def s_ui_setup(self) -> None:
        """a turns Sync on in Settings: ProbeAccount, BeginSetup, the recovery key sheet, FinishSetup, SetEnabled."""
        self.close_settings("a")
        self.settings_owner("a", "this change")
        self.monitor("a")
        done = self.ui("a", "setup")
        refused = [r for r in self.monitored("a") if "NotAuthorized" in r]
        self.emit("a: no NotAuthorized reply to Settings while turning Sync on", not refused, json.dumps(refused)[:400])
        status = self.status("a")
        self.emit("a: Sync turned on from Settings (key saved on the sheet, three words typed back, Turn on Sync)",
                  bool(done.get("ok")) and status["account"]["standing"] == "member" and status["account"]["epoch"] == 1,
                  f"{json.dumps(done)[:300]} standing {status['account'].get('standing')} epoch {status['account'].get('epoch')}")
        self.close_settings("a")

    def s_ui_join(self) -> None:
        """b turns Sync on in Settings: the account has Sync, so ProbeAccount, RequestJoin, the code, ConfirmJoin."""
        self.close_settings("b")
        self.settings_owner("b", "this change")
        self.monitor("b")
        asked = self.ui("b", "join")
        code_b = asked.get("code", "")
        if not self.emit("b: pressing Sync in Settings asks to join; the sheet shows a code", bool(asked.get("ok")) and len(code_b) == 6, json.dumps(asked)[:300]):
            return
        cards = json.loads(self.cli("a", "requests"))
        card = next((c for c in cards if c.get("code") == code_b), {})
        self.emit("a lists b's request with the same six digits", bool(card), f"a {[c.get('code') for c in cards]} b {code_b}")
        if not card:
            return
        self.cli("a", f"approve {card['id']} --code {code_b}")
        confirmed = self.ui("b", "confirm")
        ok, seconds = self.wait("member", lambda: self.status("b")["account"]["standing"] == "member", 180, 3)
        self.emit("b: Same code pressed in Settings; b is a member", bool(confirmed.get("ok")) and ok, f"{seconds:.0f} s {json.dumps(confirmed)[:200]}")
        refused = [r for r in self.monitored("b") if "NotAuthorized" in r]
        self.emit("b: no NotAuthorized reply to Settings while joining", not refused, json.dumps(refused)[:400])
        self.close_settings("b")

    def s_keys(self) -> None:
        """The device keys are systemd-creds sealed files, not keyring items, and an app's sandbox can't reach them."""
        folder = f"{HOME}/.local/share/luma/sync/keys"
        listing = self.ssh("a", f"stat -c '%a %n' {folder} {folder}/*.cred", check=False).split("\n")
        modes = dict(line.split(" ", 1)[::-1] for line in listing if line.strip())
        sealed = [path for path, mode in modes.items() if path.endswith(".cred") and mode == "600"]
        self.emit("a: device keys, account key and recovery words are sealed files (0600 in a 0700 folder)",
                  modes.get(folder) == "700" and len(sealed) >= 3, json.dumps(modes))
        probe = ("import gi; gi.require_version('Secret','1'); from gi.repository import Secret; "
                 "s = Secret.Service.get_sync(Secret.ServiceFlags.LOAD_COLLECTIONS, None); "
                 "print(sum(1 for c in s.get_collections() for i in c.get_items() if 'Luma Connect Sync' in (i.get_label() or '')))")
        left = self.user("a", f"python3 -c {shlex.quote(probe)}", check=False).strip()
        self.emit("a: nothing of Sync's is in the login keyring", left == "0", left)
        # This device's own file: a reused VM keeps earlier enrolments' sealed keys beside it.
        mine = self.state["devices"]["a"]
        opened = self.user("a", f"systemd-creds --user decrypt --name=luma-sync-device-keys {folder}/{mine}.device-keys.cred - | wc -c",
                           check=False).strip()
        self.emit("a: the person's own session can open them", opened == "64", opened)
        app = "org.gnome.Calculator"
        if app not in self.flatpaks("a"):
            self.user("a", "flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo")
            self.user("a", f"flatpak install --user --noninteractive -y flathub {app}", timeout=1800, check=False)
        inside = self.sandbox("a", app, f"test -e /run/systemd/io.systemd.Credentials && echo socket; ls {folder} 2>/dev/null | head -1; "
                                         "ls /run/user/$(id -u)/systemd 2>/dev/null | grep -i cred", check=False).strip()
        self.emit(f"a: inside {app}'s sandbox neither the credentials service nor the sealed files are visible", inside == "", inside)

    def s_join(self) -> None:
        self.user("b", f"rm -f /tmp/lcs-code; setsid nohup luma-sync join --wait 600 --code-file /tmp/lcs-code > /tmp/lcs-join.log 2>&1 &")
        ok, seconds = self.wait("code", lambda: self.user("b", "cat /tmp/lcs-code 2>/dev/null").strip() != "", 180, 2)
        if not self.emit("b: asked to join; a member posted its half; b shows a code", ok, f"{seconds:.0f} s"):
            return
        join_id, code_b = self.user("b", "cat /tmp/lcs-code").split()
        cards = json.loads(self.cli("a", "requests"))
        card = next((c for c in cards if c["id"] == join_id), {})
        same = card.get("code") == code_b
        self.emit("a and b show the same six digits (compared by the proof as a person would)", same, f"a {card.get('code')} b {code_b}")
        if not same:
            return
        self.cli("a", f"approve {join_id} --code {code_b}")
        self.cli("b", "join-confirm yes")      # the person says on b that both codes matched (re-review B3)
        ok, seconds = self.wait("approved", lambda: "Approved" in self.user("b", "cat /tmp/lcs-join.log"), 120, 2)
        status = self.status("b")
        self.emit("a approved; b is a member", ok and status["account"]["standing"] == "member", f"{seconds:.0f} s, epoch {status['account']['epoch']}")
        self.user("b", "systemctl --user restart luma-connect-syncd")

    def s_apps(self) -> None:
        self.user("a", "flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo")
        self.user("b", "flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo")
        started = time.monotonic()
        out = self.user("a", "flatpak install --user --noninteractive -y flathub " + " ".join(FLATHUB), timeout=3600, check=False)
        installed_a = self.flatpaks("a")
        self.emit("a: 8 Flathub apps installed", set(FLATHUB) <= installed_a, f"{time.monotonic() - started:.0f} s; missing {sorted(set(FLATHUB) - installed_a)} {out[-200:] if not set(FLATHUB) <= installed_a else ''}")
        # Two store apps from .deb files, through Valet's own install function (the path the window takes after review).
        script = r"""
set -e
mkdir -p ~/debs && cd ~/debs
[ -s Packages ] || curl -fsSL https://deb.debian.org/debian/dists/stable/main/binary-amd64/Packages.xz | xz -d > Packages
for p in %s; do
  f=$(awk -v p="$p" '$1=="Package:"{x=($2==p)} x && $1=="Filename:"{print $2; exit}' Packages)
  [ -s "$(basename "$f")" ] || curl -fsSLO "https://deb.debian.org/debian/$f"
  python3 -c "import sys; from pathlib import Path; from luma_installer.inspectors import inspect_package; from luma_installer.backends import install; print(install(inspect_package(Path(sys.argv[1]).absolute())))" "$(basename "$f")"
done
""" % " ".join(DEBS)
        started = time.monotonic()
        result = self.vm("ssh", "a", f"/root/as-user.sh bash -s", input=script, timeout=5400, check=False)
        store_a = self.store_apps("a")
        self.state["store_apps"] = sorted(store_a)
        self.save()
        self.emit("a: 2 .deb apps installed as ADR-052 store apps", len(store_a) >= 2,
                  f"{time.monotonic() - started:.0f} s; {sorted(store_a)}; {(result.stdout + result.stderr)[-300:]}")
        published = time.monotonic()
        expected_flatpaks = set(FLATHUB)
        ok, seconds = self.wait("b apps", lambda: expected_flatpaks <= self.flatpaks("b") and set(store_a) <= self.store_apps("b"), 5400, 15)
        missing = sorted((expected_flatpaks - self.flatpaks("b")) | (set(store_a) - self.store_apps("b")))
        self.emit("b: all 10 apps appear (installed from b's own sources)", ok, f"{seconds:.0f} s after a finished; missing {missing}")
        restore = json.loads(self.cli("b", "restore"))
        self.emit("b: restore list states", all(r["state"] in {"ready", "offered"} for r in restore if r["app"] in expected_flatpaks | set(store_a)),
                  json.dumps({r["app"]: r["state"] for r in restore})[:500])

    def sandbox(self, name: str, app: str, command: str, **kw) -> str:
        return self.user(name, f"flatpak run --command=sh {app} -c {shlex.quote(command)}", **kw)

    def secret_script(self, action: str) -> str:
        schema = "Secret.Schema.new('org.example.SignIn', Secret.SchemaFlags.NONE, {'account': Secret.SchemaAttributeType.STRING})"
        if action == "store":
            body = f"print(Secret.password_store_sync({schema}, {{'account': 'proof'}}, Secret.COLLECTION_DEFAULT, 'Sign-in', sys.stdin.read().strip(), None))"
        else:
            body = f"print(Secret.password_lookup_sync({schema}, {{'account': 'proof'}}, None) == sys.stdin.read().strip())"
        return f"python3 -c \"import sys, gi; gi.require_version('Secret', '1'); from gi.repository import Secret; {body}\""

    def portal_app(self) -> str:
        if self.state.get("portal_app"):
            return self.state["portal_app"]
        for app in FLATHUB:
            permissions = self.user("a", f"flatpak info --show-permissions {app}", check=False)
            if "org.freedesktop.secrets" not in permissions:
                probe = self.user("a", f"flatpak run --command=python3 {app} -c 'import gi; gi.require_version(\"Secret\", \"1\")'", check=False, timeout=120)
                if probe == "":
                    self.state["portal_app"] = app
                    self.save()
                    return app
        raise SystemExit("no installed app reaches the keyring only through the secret portal")

    def s_state(self) -> None:
        canary = self.state["canary"]
        app = self.portal_app()
        self.sandbox("a", SETTING_APP, "gsettings set org.gnome.TextEditor style-variant dark")
        self.sandbox("a", DOC_APP, 'mkdir -p "$XDG_DATA_HOME/org.gnome.TextEditor/drafts" && cat > "$XDG_DATA_HOME/org.gnome.TextEditor/drafts/proof-draft"', input=canary + "\n")
        stored = self.user("a", f"flatpak run --command=sh {app} -c {shlex.quote(self.secret_script('store'))}", input=self.state["password_canary"]).strip()
        self.emit(f"a: a setting and a document in {SETTING_APP}, a sign-in through the secret portal in {app}", stored == "True", stored)
        closed = time.monotonic()
        def arrived() -> bool:
            # Read from the app's settings file, never by running the app: a probe every few seconds is a run of the
            # app, and the watcher (rightly) waits for it to be quiet before applying anything.
            keyfile = f"{HOME}/.var/app/{SETTING_APP}/config/glib-2.0/settings/keyfile"
            setting = self.ssh("b", f"sed -n 's/^style-variant=//p' {keyfile} 2>/dev/null", check=False).strip()
            document = self.ssh("b", f"cat {HOME}/.var/app/{DOC_APP}/data/org.gnome.TextEditor/drafts/proof-draft 2>/dev/null", check=False).strip()
            return setting == "'dark'" and document == canary
        ok, seconds = self.wait("state", arrived, 600, 5)
        self.emit("b: the setting and the document arrive after closing on a (quiet point 20 s + sync)", ok, f"{time.monotonic() - closed:.0f} s after closing")
        # The sign-in can follow one cycle later (a's keyring may change after its folder was sent); probing runs the app.
        def opens() -> bool:
            return self.user("b", f"flatpak run --command=sh {app} -c {shlex.quote(self.secret_script('lookup'))}",
                             input=self.state["password_canary"], check=False).strip() == "True"
        ok, seconds = self.wait("sign-in", opens, 600, 60)
        self.emit("b: the sign-in opens on b (portal secret carried in the app's owner-scoped portal record)", ok, f"{seconds:.0f} s")

    def s_running(self) -> None:
        self.user("b", f"setsid nohup flatpak run --command=sleep {DOC_APP} 75 > /dev/null 2>&1 &")
        time.sleep(8)
        self.sandbox("a", DOC_APP, 'echo "edited on a while b had it open" > "$XDG_DATA_HOME/org.gnome.TextEditor/drafts/proof-draft"')
        path = f"{HOME}/.var/app/{DOC_APP}/data/org.gnome.TextEditor/drafts/proof-draft"
        time.sleep(40)
        untouched = self.ssh("b", f"cat {path}").strip() == self.state["canary"]
        self.emit("b: nothing changes under an app that is running", untouched, self.cli("b", "apps")[:0])
        ok, seconds = self.wait("after close", lambda: "edited on a" in self.ssh("b", f"cat {path}"), 240, 3)
        self.emit("b: the edit is applied once the app closes", ok, f"{seconds:.0f} s after the check (app closed at ~75 s)")

    def s_settings(self) -> None:
        """Settings, Appearance and Keyboard (ADR-054 §3): a change on one computer reaches the other in a minute."""
        get = lambda name, schema, key: self.user(name, f"gsettings get {schema} {key}", check=False).strip()  # noqa: E731
        self.user("a", "gsettings set org.gnome.desktop.interface color-scheme prefer-dark; "
                       "gsettings set org.gnome.desktop.interface accent-color teal; "
                       "gsettings set org.gnome.desktop.wm.preferences button-layout 'close:appmenu'")
        changed = time.monotonic()
        def arrived() -> bool:
            return (get("b", "org.gnome.desktop.interface", "color-scheme") == "'prefer-dark'"
                    and get("b", "org.gnome.desktop.interface", "accent-color") == "'teal'"
                    and get("b", "org.gnome.desktop.wm.preferences", "button-layout") == "'close:appmenu'")
        ok, _ = self.wait("settings", arrived, 300, 3)
        self.emit("b: dark mode, accent and a window setting from a", ok, f"{time.monotonic() - changed:.0f} s after the change")
        self.user("b", "gsettings set org.gnome.desktop.input-sources sources \"[('xkb', 'us'), ('xkb', 'de')]\"")
        changed = time.monotonic()
        ok, _ = self.wait("keyboard", lambda: "('xkb', 'de')" in get("a", "org.gnome.desktop.input-sources", "sources"), 300, 3)
        self.emit("a: a keyboard layout added on b", ok, f"{time.monotonic() - changed:.0f} s after the change")
        categories = self.status("b").get("categories", {})
        self.emit("b: Same wallpaper everywhere is off by default; Settings, Appearance and Keyboard on",
                  categories.get("wallpaper") is False and all(categories.get(c) for c in ("settings", "appearance", "keyboard")),
                  json.dumps(categories))

    def s_conflict(self) -> None:
        path = f"$XDG_DATA_HOME/org.gnome.TextEditor/drafts/proof-draft"
        since = self.ssh("b", "date +%s").strip()       # only copies kept by this step count (a reused VM has older ones)
        before = len(json.loads(self.cli("b", "conflicts") or "[]"))
        for name in ("a", "b"):
            self.user(name, "systemctl --user stop luma-connect-syncd")
        # Text new to both devices each time: the same words as b's last synced copy would be no change at all.
        nonce = secrets.token_hex(4)
        self.sandbox("a", DOC_APP, f'echo "conflict: a {nonce}" > "{path}"')
        time.sleep(2)
        self.sandbox("b", DOC_APP, f'echo "conflict: b, newer {nonce}" > "{path}"')
        self.user("a", "systemctl --user start luma-connect-syncd")
        time.sleep(45)
        self.user("b", "systemctl --user start luma-connect-syncd")
        real = f"{HOME}/.var/app/{DOC_APP}/data/org.gnome.TextEditor/drafts/proof-draft"
        ok, _ = self.wait("merge", lambda: len(json.loads(self.cli("b", "conflicts") or "[]")) > before, 240, 5)
        kept = self.ssh("b", f"find {HOME}/.local/share/luma/connect-sync/versions -type f -newermt @{since} "
                             f"-exec grep -l 'conflict: a {nonce}' {{}} + 2>/dev/null | head -1", check=False).strip()
        self.emit("both changed: b keeps its newer copy and a's copy under versions/", ok and bool(kept) and f"conflict: b, newer {nonce}" in self.ssh("b", f"cat {real}"), kept)
        ok, seconds = self.wait("a converges", lambda: f"conflict: b, newer {nonce}" in self.ssh("a", f"cat {real}"), 240, 5)
        self.emit("a converges on the merged result", ok, f"{seconds:.0f} s")

    def s_revoke(self) -> None:
        """Remove b: a moves to a new account key and new zone keys; b says it no longer syncs and keeps its files."""
        epoch_before = self.status("a")["account"]["epoch"]
        out = self.cli("a", f"revoke {self.state['devices']['b']}", check=False)
        status = self.status("a")
        self.emit("a removes b; a's account key moves on one epoch", status["account"]["epoch"] == epoch_before + 1, out.strip())
        ok, _ = self.wait("b revoked", lambda: self.status("b").get("attention", {}).get("reason") == "revoked", 180, 5)
        self.emit("b: says it no longer syncs; its files stay", ok and "proof-draft" in self.ssh("b", f"ls {HOME}/.var/app/{DOC_APP}/data/org.gnome.TextEditor/drafts"),
                  json.dumps(self.status("b").get("attention")))

    def s_rejoin(self) -> None:
        """The removed laptop signs in again (same installation, same device id) and still has the words: not enough.
        Its old keys never come back; approved by code, it joins with new ones."""
        self.enrol("b", self.state["devices"]["b"])
        refused = self.vm("ssh", "b", "/root/as-user.sh luma-sync recover", input=self.ssh("a", f"cat {HOME}/.recovery-words"), check=False)
        self.emit("b: the recovery key is refused for a removed device; another device must approve it",
                  refused.returncode != 0 and "Approve it on one of your devices" in refused.stderr, refused.stderr.strip()[-200:])
        self.s_join()
        self.emit("b: approved again by a, with new keys", self.status("b")["account"]["standing"] == "member", "")
        # Remove it once more, replacing the recovery key, since it held the old words.
        epoch_before = self.status("a")["account"]["epoch"]
        out = self.cli("a", f"revoke {self.state['devices']['b']} --new-recovery-key {HOME}/.recovery-words-new")
        self.ssh("a", f"mv {HOME}/.recovery-words {HOME}/.recovery-words-old && mv {HOME}/.recovery-words-new {HOME}/.recovery-words")
        self.emit("a removes b again and replaces the recovery key", self.status("a")["account"]["epoch"] == epoch_before + 1
                  and self.ssh("a", f"wc -w < {HOME}/.recovery-words").strip() == "24", out.strip())

    def s_recover(self) -> None:
        self.vm("stop", "b", check=False)
        self.start("c")
        self.enrol("c")
        words = self.ssh("a", f"cat {HOME}/.recovery-words")
        wrong = self.vm("ssh", "c", "/root/as-user.sh luma-sync recover", input="abandon " * 23 + "art\n", check=False)
        self.emit("c: a wrong recovery key is refused", wrong.returncode != 0 and "doesn't match" in wrong.stderr, wrong.stderr.strip()[-200:])
        if self.ssh("a", f"test -f {HOME}/.recovery-words-old && echo yes", check=False).strip() == "yes":
            old = self.vm("ssh", "c", "/root/as-user.sh luma-sync recover", input=self.ssh("a", f"cat {HOME}/.recovery-words-old"), check=False)
            self.emit("c: the replaced recovery key opens nothing", old.returncode != 0 and "doesn't match" in old.stderr, old.stderr.strip()[-200:])
        right = self.vm("ssh", "c", "/root/as-user.sh luma-sync recover", input=words, check=False)
        del words
        self.emit("c: joins with the current recovery key", right.returncode == 0 and self.status("c")["account"]["standing"] == "member", right.stdout.strip())
        self.user("c", "systemctl --user restart luma-connect-syncd")
        self.user("c", "flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo")
        store = set(self.state.get("store_apps", []))
        ok, seconds = self.wait("c apps", lambda: set(FLATHUB) <= self.flatpaks("c") and store <= self.store_apps("c"), 5400, 15)
        self.emit("c: all 10 apps arrive", ok, f"{seconds:.0f} s")
        path = f"{HOME}/.var/app/{DOC_APP}/data/org.gnome.TextEditor/drafts/proof-draft"
        ok, seconds = self.wait("c state", lambda: "conflict: b" in self.ssh("c", f"cat {path} 2>/dev/null", check=False), 900, 10)
        self.emit("c: app state arrives", ok, f"{seconds:.0f} s")
        signed = self.user("c", f"flatpak run --command=sh {self.portal_app()} -c {shlex.quote(self.secret_script('lookup'))}", input=self.state["password_canary"], check=False).strip()
        self.emit("c: the sign-in opens", signed == "True", signed)

    def s_signin(self) -> None:
        """A sign-in stored by the app on a (secret portal) opens in the same app on the other running member."""
        other = "c" if (self.work / "c.port").exists() and self.vm("ssh", "c", "true", check=False, timeout=30).returncode == 0 else "b"
        app = self.portal_app()
        stored = self.user("a", f"flatpak run --command=sh {app} -c {shlex.quote(self.secret_script('store'))}", input=self.state["password_canary"]).strip()
        self.emit(f"a: a sign-in stored through the secret portal in {app}", stored == "True", stored)
        def opens() -> bool:
            return self.user(other, f"flatpak run --command=sh {app} -c {shlex.quote(self.secret_script('lookup'))}",
                             input=self.state["password_canary"], check=False).strip() == "True"
        ok, seconds = self.wait("sign-in", opens, 900, 60)  # probing runs the app; leave room for its quiet point
        self.emit(f"{other}: the sign-in opens in {app} (its items carried in the portal record, stored under {other}'s own portal secret)", ok, f"{seconds:.0f} s")

    def s_grep(self) -> None:
        hub = self.state["hub_state"]
        for key in ("canary", "password_canary"):
            found = subprocess.run(["grep", "-rlaF", self.state[key], hub], capture_output=True, text=True)
            journal = subprocess.run(["sh", "-c", f"journalctl -u connect-sync-devhub-proof --no-pager | grep -cF {shlex.quote(self.state[key])}"], capture_output=True, text=True)
            self.emit(f"the {key.replace('_', ' ')} is nowhere in the Hub's databases, WAL, blobs or log", found.returncode == 1 and journal.stdout.strip() == "0",
                      f"grep -r over {hub}: {found.stdout.strip() or 'no match'}; log matches {journal.stdout.strip()}")
        size = subprocess.run(["du", "-sh", hub], capture_output=True, text=True).stdout.strip()
        self.emit("Hub state size", True, size)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", required=True)
    parser.add_argument("--hub-tree", required=True)
    parser.add_argument("steps", nargs="+")
    arguments = parser.parse_args()
    proof = Proof(Path(arguments.work), Path(arguments.hub_tree))
    for step in arguments.steps:
        proof.step = step
        getattr(proof, f"s_{step}")()
    return 0


if __name__ == "__main__":
    sys.exit(main())
