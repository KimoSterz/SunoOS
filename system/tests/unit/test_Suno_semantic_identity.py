# SPDX-License-Identifier: Apache-2.0
"""Identity-boundary tests for the Suno Semantic Broker."""

from __future__ import annotations

from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
BROKER = ROOT / "src/Suno-platform/broker"
sys.path.insert(0, str(BROKER))

from Suno_semantic_broker.identity import IdentityError, IdentityResolver  # noqa: E402
from Suno_semantic_broker.desktop import (  # noqa: E402
    _visible_owner_uid,
    desktop_application,
)
from Suno_semantic_broker.model import IdentityStrength  # noqa: E402
from Suno_semantic_broker.prompt import PromptRunner, safe_label  # noqa: E402


class Credentials:
    def __init__(self, *, pid: int = 4242, owner: str = ":1.50") -> None:
        self.pid = pid
        self.owner = owner

    def credentials(self, _sender: str) -> tuple[int, int]:
        return os.getuid(), self.pid

    def pinned(self, _sender: str) -> tuple[int, int, int]:
        return os.getuid(), self.pid, -1

    def name_owner(self, _name: str) -> str:
        return self.owner

def desktop(app_id: str) -> tuple[bool, str]:
    known = {
        "org.example.Agent": "Example Agent",
        "org.projectSuno.Notes": "Notes",
    }
    return app_id in known, known.get(app_id, app_id)


UNIT = BROKER / "data/Suno-semantic-broker.service"
# Options that give a service a mount namespace; in a user manager that comes
# with a user namespace, from which callers' /proc entries can't be read.
NAMESPACE_OPTIONS = frozenset({
    "PrivateTmp", "PrivateDevices", "PrivateNetwork", "PrivateUsers", "PrivateIPC",
    "PrivateMounts", "PrivatePIDs", "ProtectSystem", "ProtectHome", "ProtectClock",
    "ProtectControlGroups", "ProtectKernelLogs", "ProtectKernelModules",
    "ProtectKernelTunables", "ProtectProc", "ProtectHostname", "ProcSubset",
    "ReadOnlyPaths", "ReadWritePaths", "InaccessiblePaths", "ExecPaths", "NoExecPaths",
    "TemporaryFileSystem", "BindPaths", "BindReadOnlyPaths", "RootDirectory",
    "RootImage", "MountAPIVFS", "MountImages", "ExtensionImages", "ExtensionDirectories",
    "NetworkNamespacePath", "IPCNamespacePath",
})


def unit_options() -> list[tuple[str, str]]:
    options, section = [], ""
    for line in UNIT.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("["):
            section = line
        elif section == "[Service]" and "=" in line and not line.startswith("#"):
            key, _, value = line.partition("=")
            options.append((key.strip(), value.strip()))
    return options


class UnitTests(unittest.TestCase):
    def test_the_broker_unit_has_no_mount_namespace(self) -> None:
        self.assertEqual([key for key, _ in unit_options() if key in NAMESPACE_OPTIONS], [])

    @unittest.skipUnless(sys.platform.startswith("linux") and shutil.which("systemd-run"),
                         "needs a systemd user manager")
    def test_under_the_units_options_the_broker_reads_callers(self) -> None:
        """The real unit's hardening, in the user manager: another process's
        exe and a Flatpak sandbox's .flatpak-info stay readable."""
        state = subprocess.run(["systemctl", "--user", "is-system-running"], capture_output=True, text=True)
        if state.stdout.strip() not in {"running", "degraded"}:
            self.skipTest("no user manager")
        skip = {"Type", "BusName", "ExecStart", "Restart", "RestartSec", "StateDirectory"}
        properties = [f"--property={key}={value}" for key, value in unit_options() if key not in skip]
        with tempfile.TemporaryDirectory() as folder:
            info = Path(folder) / "flatpak-info"
            info.write_text("[Application]\nname=org.example.Agent\n", encoding="utf-8")
            plain = subprocess.Popen(["sleep", "60"])
            sandbox = None
            if shutil.which("bwrap"):
                # Flatpak's layout: a tmpfs root holding /usr and .flatpak-info.
                sandbox = subprocess.Popen(["bwrap", "--unshare-pid", "--ro-bind", "/usr", "/usr",
                                            "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib",
                                            "--symlink", "usr/lib64", "/lib64",
                                            "--ro-bind", str(info), "/.flatpak-info", "--proc", "/proc",
                                            "--dev", "/dev", "sleep", "60"])
            try:
                time.sleep(0.5)
                check = ("import os,sys,configparser\n"
                         f"print(os.readlink('/proc/{plain.pid}/exe'))\n")
                if sandbox is not None:
                    child = subprocess.run(["pgrep", "-P", str(sandbox.pid)], capture_output=True,
                                           text=True).stdout.split()
                    target = child[0] if child else str(sandbox.pid)
                    check += f"print(open('/proc/{target}/root/.flatpak-info').read().split('=')[1].strip())\n"
                result = subprocess.run(["systemd-run", "--user", "--wait", "--pipe", "--quiet", *properties,
                                         sys.executable, "-c", check],
                                        capture_output=True, text=True, timeout=60)
            finally:
                for process in (plain, sandbox):
                    if process is not None:
                        process.kill()
                        process.wait()
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = result.stdout.split()
        self.assertEqual(lines[0], os.path.realpath(shutil.which("sleep")))
        if sandbox is not None:
            self.assertEqual(lines[1], "org.example.Agent")


class IdentityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.proc = Path(self.temporary.name)
        # The broker's own root: a folder here, never the real /, since
        # tests write sandbox records into callers' roots.
        self.host_root = self.proc / "host-root"
        self.host_root.mkdir()
        (self.proc / "self/ns").mkdir(parents=True)
        (self.proc / "self/root").symlink_to(self.host_root)
        (self.proc / "self/ns/mnt").symlink_to("mnt:[4026531841]")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def resolver(self, credentials: Credentials) -> IdentityResolver:
        return IdentityResolver(
            credentials,
            proc_root=self.proc,
            desktop_lookup=desktop,
        )

    def process(self, pid: int = 4242, start: str = "1000", *, host: bool = False) -> Path:
        """A caller: by default a sandbox root of its own; host=True, a
        program in the broker's filesystem."""
        root = self.proc / str(pid)
        (root / "ns").mkdir(parents=True)
        if host:
            (root / "root").symlink_to(self.host_root)
            (root / "ns/mnt").symlink_to("mnt:[4026531841]")
        else:
            (root / "root").mkdir()
            (root / "ns/mnt").symlink_to("mnt:[2]")
        (root / "exe").symlink_to("/usr/bin/example")
        (root / "cgroup").write_text("0::/user.slice/user-1000.slice/user@1000.service/app.slice/x.service\n",
                                     encoding="utf-8")
        self.started(pid, start)
        return root

    def started(self, pid: int, start: str) -> None:
        fields = ["S"] + ["0"] * 18 + [start] + ["0"] * 30
        (self.proc / str(pid) / "stat").write_text(f"{pid} (x) {' '.join(fields)}\n", encoding="utf-8")

    def test_without_a_process_descriptor_the_pid_is_held_by_its_start_time(self) -> None:
        self.process(host=True)
        resolver = self.resolver(Credentials())
        self.assertEqual(resolver.resolve(":1.20").pid, 4242)
        real = resolver._identity

        def reused(*args):
            self.started(4242, "2000")
            return real(*args)

        resolver._identity = reused
        with self.assertRaises(IdentityError):
            resolver.resolve(":1.20")
        (self.proc / "4242/stat").unlink()
        with self.assertRaises(IdentityError):
            self.resolver(Credentials()).resolve(":1.20")

    def test_a_named_but_undelivered_process_descriptor_is_refused(self) -> None:
        from gi.repository import GLib
        from Suno_semantic_broker.identity import DBusCredentialResolver

        class Broken:
            def get(self, _handle):
                raise GLib.Error("invalid descriptor")

        for fds in (None, Broken()):
            connection = mock.Mock()
            connection.call_with_unix_fd_list_sync.return_value = (GLib.Variant("(a{sv})", ({
                "UnixUserID": GLib.Variant("u", os.getuid()), "ProcessID": GLib.Variant("u", 4242),
                "ProcessFD": GLib.Variant("h", 0)},)), fds)
            with self.subTest(fds=fds), self.assertRaises(IdentityError):
                DBusCredentialResolver(connection).pinned(":1.20")
        connection = mock.Mock()
        connection.call_with_unix_fd_list_sync.return_value = (GLib.Variant("(a{sv})", ({
            "UnixUserID": GLib.Variant("u", os.getuid()), "ProcessID": GLib.Variant("u", 4242)},)), None)
        self.assertEqual(DBusCredentialResolver(connection).pinned(":1.20"), (os.getuid(), 4242, -1))

    def test_flatpak_identity_comes_from_process_metadata(self) -> None:
        process = self.process()
        (process / "root/.flatpak-info").write_text(
            "[Application]\nname=org.example.Agent\n", encoding="utf-8"
        )
        identity = self.resolver(Credentials()).resolve(":1.20")
        self.assertEqual(identity.key, "flatpak:org.example.Agent")
        self.assertEqual(identity.label, "Example Agent")
        self.assertEqual(identity.strength, IdentityStrength.SANDBOXED)
        self.assertTrue(identity.persistent)

    def test_managed_native_identity_comes_from_verified_scope(self) -> None:
        process = self.process(host=True)
        (process / "cgroup").write_text(
            "0::/user.slice/app-org.projectSuno.Notes-a1b2.scope\n",
            encoding="utf-8",
        )
        identity = self.resolver(Credentials()).resolve(":1.21")
        self.assertEqual(identity.key, "native:org.projectSuno.Notes")
        self.assertEqual(identity.strength, IdentityStrength.MANAGED_NATIVE)
        self.assertFalse(identity.persistent)

    def test_background_agent_carries_its_app_identity(self) -> None:
        process = self.process(host=True)
        (process / "cgroup").write_text(
            "0::/user.slice/user-1000.slice/user@1000.service/Suno-background.slice/"
            "Suno-background-essential.slice/app-org.projectSuno.Notes-agent.service\n",
            encoding="utf-8",
        )
        identity = self.resolver(Credentials()).resolve(":1.23")
        self.assertEqual(identity.key, "native:org.projectSuno.Notes")
        self.assertEqual(identity.strength, IdentityStrength.MANAGED_NATIVE)

    def test_agent_unit_outside_the_background_slice_is_not_an_identity(self) -> None:
        process = self.process(host=True)
        (process / "cgroup").write_text(
            "0::/user.slice/user-1000.slice/user@1000.service/app.slice/"
            "app-org.projectSuno.Notes-agent.service\n",
            encoding="utf-8",
        )
        identity = self.resolver(Credentials()).resolve(":1.24")
        self.assertEqual(identity.app_id, "")

    def test_unidentified_native_client_is_transient(self) -> None:
        self.process(host=True)
        identity = self.resolver(Credentials()).resolve(":1.22")
        self.assertEqual(identity.strength, IdentityStrength.TRANSIENT_NATIVE)
        self.assertFalse(identity.persistent)
        self.assertEqual(identity.app_id, "")

    def shell(self, exe: str = "/usr/bin/gnome-shell", mount: str = "mnt:[4026531841]") -> Path:
        process = self.process(host=True)
        (process / "ns/mnt").unlink()
        (process / "ns/mnt").symlink_to(mount)
        (process / "exe").unlink()
        (process / "exe").symlink_to(exe)
        (process / "cgroup").write_text(
            "0::/user.slice/user-1000.slice/user@1000.service/session.slice/org.gnome.Shell@user.service\n",
            encoding="utf-8")
        return process

    def test_live_extension_host_requires_shell_bus_owner_and_executable(self) -> None:
        self.shell()
        identity = self.resolver(Credentials()).require_shell_host(":1.50")
        self.assertEqual(identity.sender, ":1.50")
        with self.assertRaises(IdentityError):
            self.resolver(Credentials(owner=":1.51")).require_shell_host(":1.50")

    def test_an_unreadable_caller_is_never_the_shell(self) -> None:
        # Any host program can run as org.gnome.Shell@user.service, go
        # non-dumpable and take org.gnome.Shell (replacement allowed): its
        # unit, command line and name prove nothing.
        process = self.shell()
        (process / "exe").unlink()
        with self.assertRaises(IdentityError):
            self.resolver(Credentials()).require_shell_host(":1.50")

    def test_the_shell_host_is_gnome_shell_in_this_filesystem(self) -> None:
        for exe, mount in (("/usr/bin/evil", "mnt:[4026531841]"), ("/usr/bin/gnome-shell", "mnt:[1]")):
            with self.subTest(exe=exe, mount=mount):
                shutil.rmtree(self.proc / "4242", ignore_errors=True)
                self.shell(exe, mount)
                with self.assertRaises(IdentityError):
                    self.resolver(Credentials()).require_shell_host(":1.50")

    def test_a_sandbox_is_never_the_shell(self) -> None:
        process = self.shell()
        (process / "root").unlink()
        (process / "root").mkdir()
        (process / "root/.flatpak-info").write_text("[Application]\nname=org.example.Agent\n", encoding="utf-8")
        with self.assertRaises(IdentityError):
            self.resolver(Credentials()).require_shell_host(":1.50")

    def test_an_unreadable_sandbox_record_is_refused(self) -> None:
        process = self.process()
        (process / "root/.flatpak-info").mkdir()
        with self.assertRaises(IdentityError):
            self.resolver(Credentials()).resolve(":1.20")
        (process / "root/.flatpak-info").rmdir()
        (process / "root/.flatpak-info").write_text("[Application]\nname=\n", encoding="utf-8")
        with self.assertRaises(IdentityError):
            self.resolver(Credentials()).resolve(":1.20")

    def test_a_flatpak_scope_resolves_only_with_its_sandbox_record(self) -> None:
        process = self.process(host=True)
        (process / "cgroup").write_text(
            "0::/user.slice/user-1000.slice/user@1000.service/app.slice/app-flatpak-org.example.Agent-81234.scope\n",
            encoding="utf-8")
        with self.assertRaises(IdentityError):
            self.resolver(Credentials()).resolve(":1.20")
        (process / "root/.flatpak-info").write_text("[Application]\nname=org.example.Agent\n", encoding="utf-8")
        identity = self.resolver(Credentials()).resolve(":1.20")
        self.assertEqual((identity.key, identity.strength), ("flatpak:org.example.Agent", IdentityStrength.SANDBOXED))

    def test_a_native_caller_must_be_in_this_filesystem_readable_and_not_a_launcher_sandbox(self) -> None:
        cases = {
            "another filesystem": lambda p: ((p / "ns/mnt").unlink(), (p / "ns/mnt").symlink_to("mnt:[2]")),
            "unreadable": lambda p: (p / "exe").unlink(),
            "app-Suno scope": lambda p: (p / "cgroup").write_text(
                "0::/user.slice/user@1000.service/app.slice/app-Suno-org.example.Store-77.scope\n", encoding="utf-8"),
            "host dbus proxy": lambda p: ((p / "exe").unlink(), (p / "exe").symlink_to("/usr/bin/xdg-dbus-proxy")),
        }
        for name, change in cases.items():
            with self.subTest(name):
                shutil.rmtree(self.proc / "4242", ignore_errors=True)
                change(self.process(host=True))
                with self.assertRaises(IdentityError):
                    self.resolver(Credentials()).resolve(":1.22")

    def test_unmanaged_provider_cannot_claim_an_installed_application(self) -> None:
        self.process(host=True)
        resolver = self.resolver(Credentials())
        with self.assertRaises(IdentityError):
            resolver.provider(":1.23", "org.projectSuno.Notes")

    def test_managed_native_provider_must_match_its_scope(self) -> None:
        process = self.process(host=True)
        (process / "cgroup").write_text(
            "0::/user.slice/app-org.projectSuno.Notes-a1b2.scope\n",
            encoding="utf-8",
        )
        resolver = self.resolver(Credentials())
        identity = resolver.provider(":1.23", "org.projectSuno.Notes")
        self.assertEqual(identity.key, "native:org.projectSuno.Notes")
        with self.assertRaises(IdentityError):
            resolver.provider(":1.23", "org.example.Agent")

    def test_provider_cannot_claim_another_flatpak_identity(self) -> None:
        process = self.process()
        (process / "root/.flatpak-info").write_text(
            "[Application]\nname=org.example.Agent\n", encoding="utf-8"
        )
        with self.assertRaises(IdentityError):
            self.resolver(Credentials()).provider(
                ":1.24", "org.projectSuno.Notes"
            )

    def test_consent_labels_are_single_line_and_directionally_safe(self) -> None:
        self.assertEqual(
            safe_label("Agent\n\u202eSystem\tPrompt"),
            "Agent System Prompt",
        )

    def test_consent_ui_runs_outside_the_device_denied_broker_sandbox(self) -> None:
        runner = PromptRunner(executable="/trusted/consent", runner="/systemd-run")
        self.assertEqual(
            runner._command(["/trusted/consent", "access"]),
            [
                "/systemd-run",
                "--user",
                "--wait",
                "--collect",
                "--quiet",
                "--property=NoNewPrivileges=yes",
                "--",
                "/trusted/consent",
                "access",
            ],
        )

    def test_desktop_label_requires_a_bounded_owned_application_entry(self) -> None:
        applications = self.proc / "applications"
        applications.mkdir()
        entry = applications / "org.projectSuno.Notes.desktop"
        entry.write_text(
            "[Desktop Entry]\nType=Application\nName=Notes\n",
            encoding="utf-8",
        )
        self.assertEqual(
            desktop_application(
                "org.projectSuno.Notes",
                roots=(applications,),
                owner_uid=os.getuid(),
            ),
            (True, "Notes"),
        )
        self.assertEqual(
            desktop_application(
                "org.projectSuno.Notes",
                roots=(applications,),
                owner_uid=os.getuid() + 1,
            ),
            (False, "org.projectSuno.Notes"),
        )

    def test_root_owner_maps_to_overflow_uid_in_hardened_user_namespace(self) -> None:
        uid_map = self.proc / "uid_map"
        overflow_uid = self.proc / "overflowuid"
        uid_map.write_text("1000 1000 1\n", encoding="utf-8")
        overflow_uid.write_text("65534\n", encoding="utf-8")
        self.assertEqual(
            _visible_owner_uid(
                0,
                uid_map_path=uid_map,
                overflow_uid_path=overflow_uid,
            ),
            65534,
        )
        self.assertEqual(
            _visible_owner_uid(
                1000,
                uid_map_path=uid_map,
                overflow_uid_path=overflow_uid,
            ),
            1000,
        )


if __name__ == "__main__":
    unittest.main()
