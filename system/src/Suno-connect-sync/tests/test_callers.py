# SPDX-License-Identifier: Apache-2.0
"""Who may call Suno Connect Sync: the real process checks, on real processes and real pidfds.

The scope a caller runs in names nobody; the program it runs does, compared by inode with a root-owned file. A pid
that is gone or reused by the time /proc has been read is refused, never mistaken for the caller."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from Suno_connect_sync import callers  # noqa: E402

LINUX = sys.platform.startswith("linux") and hasattr(os, "pidfd_open")
PYTHON = os.path.realpath(sys.executable)
UID = os.getuid()
# The label a Suno desktop gives the Shell, Settings and the person's programs (measured on a nightly VM).
DESKTOP_LABEL = "unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023"


def _own_label() -> str:
    try:
        return Path("/proc/self/attr/current").read_text().strip("\0\n ")
    except OSError:
        return ""


# In a labelled build container (podman, container_t; where rpmbuild runs %check) every process carries one label,
# the one the rules refuse. These tests are about programs and pids, so there they read a caller as a desktop session
# labels it; the label rules have their own tests (test_the_bus_label_and_user).
IN_BUILD_CONTAINER = ":container_t:" in _own_label()


def facts(pid: int) -> dict:
    found = callers.facts(pid)
    if IN_BUILD_CONTAINER and found["label"] == _own_label():
        found["label"] = DESKTOP_LABEL
    return found


def sleeper(program: str = PYTHON) -> subprocess.Popen:
    child = subprocess.Popen([program, "-c", "import time; time.sleep(60)"])
    for _ in range(100):            # until it runs the program, not the fork of this one
        try:
            if os.readlink(f"/proc/{child.pid}/exe").startswith(program):
                break
        except OSError:
            pass
        time.sleep(0.02)
    return child


@unittest.skipUnless(LINUX, "needs Linux /proc and pidfds")
class Programs(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="lcs-callers-"))
        self.children: list[subprocess.Popen] = []

    def tearDown(self) -> None:
        for child in self.children:
            child.kill()
            child.wait()
        shutil.rmtree(self.root, ignore_errors=True)

    def run_copy(self) -> tuple[subprocess.Popen, Path]:
        copy = self.root / "gnome-shell"
        shutil.copy2(PYTHON, copy)
        child = sleeper(str(copy))
        self.children.append(child)
        return child, copy

    def test_the_program_is_named_by_its_file(self) -> None:
        if os.stat(PYTHON).st_uid != 0:
            self.skipTest("needs a root-owned python")
        found = facts(os.getpid())
        self.assertEqual(callers.sandbox_reason(found), "")
        self.assertEqual(callers.required_name(found, trusted={PYTHON: "org.gnome.Shell"}), "org.gnome.Shell")
        self.assertIsNone(callers.required_name(found, trusted={"/usr/bin/gnome-shell": "org.gnome.Shell"}),
                          "a host program in the person's session that isn't the Shell or Settings")

    def test_a_copy_under_the_same_name_is_not_the_program(self) -> None:
        child, copy = self.run_copy()
        found = facts(child.pid)
        self.assertTrue(found["exe"].endswith("/gnome-shell"))
        self.assertIsNone(callers.required_name(found, trusted={"/usr/bin/gnome-shell": "org.gnome.Shell", PYTHON: ""}),
                          "another file, whatever it is called")
        if UID != 0:   # as root (rpmbuild's %check) the copy is root's too
            self.assertIsNone(callers.required_name(found, trusted={str(copy): "org.gnome.Shell"}),
                              "a file the person owns is never trusted")
        self.assertEqual(callers.required_name(found, trusted={str(copy): "org.gnome.Shell"}, root_uid=UID), "org.gnome.Shell")

    def test_a_program_replaced_by_an_update_while_it_runs(self) -> None:
        child, copy = self.run_copy()
        copy.unlink()
        found = facts(child.pid)
        self.assertTrue(found["exe"].endswith(" (deleted)"))
        self.assertEqual(callers.required_name(found, trusted={str(copy): ""}, root_uid=UID), "", "the file that was there")
        copy.write_bytes(b"#!/bin/sh\n")
        os.chmod(copy, 0o755)
        self.assertEqual(callers.required_name(found, trusted={str(copy): ""}, root_uid=UID), "", "and still once the new file is in place")
        if UID != 0:
            self.assertIsNone(callers.required_name(found, trusted={str(copy): ""}), "never a file the person owned")

    @unittest.skipIf(UID == 0, "root reads a non-dumpable process's /proc entries")
    def test_a_process_that_hides_itself_is_refused(self) -> None:
        child = subprocess.Popen([PYTHON, "-c", "import ctypes, sys, time; ctypes.CDLL(None).prctl(4, 0, 0, 0, 0); "
                                  "print('hidden', flush=True); time.sleep(60)"], stdout=subprocess.PIPE, text=True)
        self.children.append(child)
        self.assertEqual(child.stdout.readline().strip(), "hidden")
        found = facts(child.pid)
        self.assertIsNone(found["exe"], "a non-dumpable process doesn't show its program")
        self.assertEqual(callers.sandbox_reason(found), "unreadable process")
        self.assertIsNone(callers.required_name(found, trusted={PYTHON: "org.gnome.Shell"}, extra=(PYTHON,)))

    def test_a_writable_program_is_not_trusted(self) -> None:
        child, copy = self.run_copy()
        os.chmod(copy, 0o777)
        self.assertIsNone(callers.required_name(facts(child.pid), trusted={str(copy): ""}, root_uid=UID))


@unittest.skipUnless(LINUX, "needs Linux /proc and pidfds")
class PidReuse(unittest.TestCase):
    """The pidfd from the broker is checked before and after the /proc reads."""

    def check(self, pid: int, pidfd: int, *, trusted_only: bool = True, label: str = DESKTOP_LABEL, owner: str = ":1.5", **kw):
        return callers.refusal(lambda: (UID, pid, pidfd, label), trusted_only=trusted_only, name_owner=lambda _name: owner,
                               sender=":1.5", extra=(PYTHON,), root_uid=os.stat(PYTHON).st_uid, **kw)

    def test_the_caller_still_running_is_admitted(self) -> None:
        self.assertEqual(self.check(os.getpid(), os.pidfd_open(os.getpid())), ("", "", os.getpid()))

    def test_a_caller_that_has_exited_is_refused(self) -> None:
        child = sleeper()
        fd = os.pidfd_open(child.pid)
        child.kill()
        child.wait()
        kind, why, _pid = self.check(child.pid, fd)
        self.assertEqual((kind, why), ("sandbox", "process gone"))

    def test_a_pid_reused_while_proc_was_read_is_refused(self) -> None:
        # The broker's pidfd stops pointing at the pid between the two checks: whatever /proc said was someone else.
        answers = iter([os.getpid(), 0])
        kind, why, _pid = self.check(os.getpid(), os.pidfd_open(os.getpid()), read_pidfd=lambda _fd: next(answers))
        self.assertEqual((kind, why), ("sandbox", "process gone"))

    def test_a_pidfd_for_another_process_is_refused(self) -> None:
        child = sleeper()
        try:
            kind, why, _pid = self.check(os.getpid(), os.pidfd_open(child.pid))
            self.assertEqual((kind, why), ("sandbox", "process gone"))
        finally:
            child.kill()
            child.wait()

    def test_without_a_pidfd_keys_stay_out_of_reach(self) -> None:
        self.assertEqual(self.check(os.getpid(), -1)[:2], ("not_trusted", "the bus gave no pidfd"))
        self.assertEqual(self.check(os.getpid(), -1, trusted_only=False), ("", "", os.getpid()), "the start time stands in for reading the state")

    def test_the_pidfd_is_closed(self) -> None:
        fd = os.pidfd_open(os.getpid())
        self.check(os.getpid(), fd)
        with self.assertRaises(OSError):
            os.fstat(fd)

    def test_the_bus_label_and_user(self) -> None:
        self.assertEqual(self.check(os.getpid(), os.pidfd_open(os.getpid()), label="system_u:system_r:Suno_application.process:s0:c1,c2")[:2],
                         ("sandbox", "application domain"))
        kind, why, _pid = callers.refusal(lambda: (UID + 1, os.getpid(), -1, ""), trusted_only=False, name_owner=lambda _n: "",
                                          sender=":1.5")
        self.assertEqual((kind, why), ("sandbox", "another user or no process"))

    def test_a_trusted_program_must_own_its_bus_name(self) -> None:
        def ask(owner: str):
            return callers.refusal(lambda: (UID, os.getpid(), os.pidfd_open(os.getpid()), DESKTOP_LABEL), trusted_only=True,
                                   name_owner=lambda _n: owner, sender=":1.5", trusted={PYTHON: "org.gnome.Shell"},
                                   root_uid=os.stat(PYTHON).st_uid)
        self.assertEqual(ask(":1.5")[:2], ("", ""))
        self.assertEqual(ask(":1.99")[:2], ("not_trusted", "does not own org.gnome.Shell"))

    def test_no_credentials(self) -> None:
        def broken():
            raise RuntimeError("no broker")
        self.assertEqual(callers.refusal(broken, trusted_only=False, name_owner=lambda _n: "", sender=":1.5")[0], "sandbox")


@unittest.skipUnless(LINUX, "needs Linux /proc and pidfds")
class DbusActivatedSettings(unittest.TestCase):
    """Settings started by D-Bus activation runs in dbus-:1.2-org.gnome.Settings@0.service, a unit no name prefix
    matched. The program and owning org.gnome.Settings decide, not the unit."""
    CGROUP = "0::/user.slice/user-1000.slice/user@1000.service/app.slice/dbus-:1.2-org.gnome.Settings@0.service\n"

    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="lcs-callers-"))
        self.program = self.root / "gnome-control-center"
        shutil.copy2(PYTHON, self.program)
        self.child = sleeper(str(self.program))
        real = callers.facts
        self.facts = lambda pid, proc=callers.PROC: {**real(pid, proc), "cgroup": self.CGROUP, "label": DESKTOP_LABEL}

    def tearDown(self) -> None:
        self.child.kill()
        self.child.wait()
        shutil.rmtree(self.root, ignore_errors=True)

    def ask(self, owner: str) -> tuple[str, str, int]:
        pid = self.child.pid
        with mock.patch.object(callers, "facts", self.facts):
            return callers.refusal(lambda: (UID, pid, os.pidfd_open(pid), DESKTOP_LABEL),
                                   trusted_only=True, name_owner=lambda name: owner if name == "org.gnome.Settings" else "",
                                   sender=":1.317", trusted={str(self.program): callers.TRUSTED_EXECUTABLES["/usr/bin/gnome-control-center"]},
                                   root_uid=UID)

    def test_settings_is_bound_to_its_bus_name(self) -> None:
        self.assertEqual(callers.TRUSTED_EXECUTABLES["/usr/bin/gnome-control-center"], "org.gnome.Settings")

    def test_activated_settings_owning_its_name_is_admitted(self) -> None:
        found = self.facts(self.child.pid)
        self.assertEqual(callers.sandbox_reason(found), "")
        self.assertEqual(self.ask(":1.317"), ("", "", self.child.pid))

    def test_the_same_program_without_the_name_is_refused(self) -> None:
        self.assertEqual(self.ask(":1.99")[:2], ("not_trusted", "does not own org.gnome.Settings"))
        self.assertEqual(self.ask("")[:2], ("not_trusted", "does not own org.gnome.Settings"))


class TestMachines(unittest.TestCase):
    """callers.d: only root adds a program; the fixture variable only reaches a service run from a source tree."""

    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="lcs-callers-d-"))
        self.folder = self.root / "callers.d"
        self.folder.mkdir()
        os.chmod(self.folder, 0o755)

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def write(self, name: str, text: str, mode: int = 0o644) -> Path:
        path = self.folder / name
        path.write_text(text)
        os.chmod(path, mode)
        return path

    def test_root_owned_files(self) -> None:
        self.write("10-test.conf", "# test VM\n/usr/bin/gdbus\nrelative/ignored\n")
        self.write("20-open.conf", "/usr/bin/evil\n", 0o666)
        os.symlink(self.folder / "10-test.conf", self.folder / "30-link.conf")
        self.write("40-other.txt", "/usr/bin/other\n")
        source = "/usr/lib/python3/site-packages/Suno_connect_sync/callers.py"
        self.assertEqual(callers.extra_callers(self.folder, service_file=source, environment={}, root_uid=UID), ("/usr/bin/gdbus",))
        if UID != 0:
            self.assertEqual(callers.extra_callers(self.folder, service_file=source, environment={}), (),
                             "files the person owns add nobody")
        os.chmod(self.folder, 0o777)
        self.assertEqual(callers.extra_callers(self.folder, service_file=source, environment={}, root_uid=UID), (), "nor an open folder")

    def test_fixture_variable(self) -> None:
        environment = {callers.FIXTURE_ENV: "/opt/test/python:relative"}
        self.assertEqual(callers.extra_callers(self.root / "none", service_file="/usr/lib/python3/site-packages/Suno_connect_sync/callers.py",
                                               environment=environment), (), "the installed service never reads it")
        self.assertEqual(callers.extra_callers(self.root / "none", service_file=HERE.parent / "Suno_connect_sync/callers.py",
                                               environment=environment), () if UID == 0 else ("/opt/test/python",),
                         "a service running as root never reads it")
        if os.getuid() != 0 and os.stat("/etc/passwd").st_uid == 0:
            # A root-owned copy outside /usr (pip into /usr/local, which is /var/usrlocal on Suno) is installed, not a checkout.
            self.assertEqual(callers.extra_callers(self.root / "none", service_file="/etc/passwd", environment=environment), ())


class UnitFile(unittest.TestCase):
    """Sandboxing options in a user unit give the service its own user namespace (systemd adds PrivateUsers), where
    every caller's /proc entries are unreadable: the real Shell and Settings would be refused. Measured under the
    user manager: the unit as shipped runs in the host namespace and reads the caller; with ProtectSystem and
    PrivateTmp it reads nothing."""

    NAMESPACING = ("PrivateUsers", "ProtectSystem", "ProtectHome", "PrivateTmp", "PrivateDevices", "PrivateNetwork",
                   "PrivateIPC", "PrivateMounts", "ProtectKernel", "ProtectControlGroups", "ProtectHostname", "ProtectClock",
                   "ProtectProc", "ProcSubset", "ReadOnlyPaths", "ReadWritePaths", "InaccessiblePaths", "ExecPaths",
                   "NoExecPaths", "TemporaryFileSystem", "BindPaths", "BindReadOnlyPaths", "RootDirectory", "RootImage",
                   "MountAPIVFS", "LogsDirectory", "StateDirectory", "CacheDirectory", "RuntimeDirectory", "ConfigurationDirectory",
                   "DynamicUser", "NetworkNamespacePath", "IPCNamespacePath")

    def test_the_service_shares_the_session_namespaces(self) -> None:
        unit = (HERE.parent / "data/Suno-connect-syncd.service").read_text()
        settings = [line.split("=", 1)[0].strip() for line in unit.splitlines() if "=" in line and not line.lstrip().startswith("#")]
        for key in settings:
            self.assertFalse(key.startswith(self.NAMESPACING), f"{key} would hide every caller from callers.py")


if __name__ == "__main__":
    unittest.main()
