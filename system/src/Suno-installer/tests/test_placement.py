# SPDX-License-Identifier: Apache-2.0
"""Package files without a launcher go through the classifier (placement.py, ADR-052 steps 4.3/4.4)."""
from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from Suno_installer import backends, classify as c, manager, placement as p, store_install
from Suno_installer.classify import Classification, PackageInfo
from Suno_installer.errors import InstallerError
from Suno_installer.model import PackageReport

FAMILIES = ("deb", "rpm")


def package(name, *files, family="deb", **extra):
    return PackageInfo(name, "1.0", family, files=tuple(files), **extra)


def place(info, *, arrival=c.FILE, store=True):
    release = p.DEFAULT_RELEASES[info.family]
    result = c.classify(c.Request(info, arrival=arrival, release=release, origin="file" if arrival == c.FILE
                                  else "distribution", curated=arrival != c.FILE))
    return p.decide(result, info, arrival=arrival, store=store)


def report(kind="rpm", title="tool", placed=None, **extra):
    base = PackageReport(Path("/nonexistent/tool." + kind), kind, title, "A tool", 10, "a" * 64, **extra)
    return p.report_for(base, placed) if placed is not None else base


class Routes(unittest.TestCase):
    """Each kind, for each family, goes where a route exists today, or says why it can't."""

    def setUp(self):
        os.environ.pop(c.DATA_ENVIRONMENT, None)
        c.curated_list.cache_clear()

    def test_a_command_line_tool_is_a_sandboxed_console_app(self):
        for family in FAMILIES:
            placed = place(package("ripgrep", "/usr/bin/rg", "/usr/share/man/man1/rg.1.gz", family=family))
            self.assertEqual([option.route for option in placed.options], [p.CONSOLE], family)
            self.assertEqual((placed.default, placed.chosen, placed.command),
                             (c.CONSOLE_APPLICATION, c.CONSOLE_APPLICATION, "/usr/bin/rg"))
            self.assertTrue(placed.ask, "a rules outcome is asked under the release policy")
            self.assertEqual(p.harmful(placed), [])

    def test_the_command_is_the_one_named_like_the_package(self):
        info = package("fd-find", "/usr/bin/fdfind", "/usr/bin/aaa-helper", "/usr/bin/fd")
        self.assertEqual(p.main_command(info), "/usr/bin/fd")
        self.assertEqual(p.main_command(package("x", "/usr/lib/libx.so.1")), "")

    def test_a_package_with_nothing_to_run_cannot_be_installed_yet(self):
        placed = place(package("libfoo-dev", "/usr/include/foo.h", "/usr/lib/x86_64-linux-gnu/libfoo.so"))
        self.assertEqual(placed.options, ())
        self.assertIn("no command", placed.unavailable)

    def test_a_system_service_from_fedora_is_layered_with_full_control_and_never_preselected(self):
        placed = place(package("nginx", "/usr/sbin/nginx", "/usr/lib/systemd/system/nginx.service", family="rpm"))
        self.assertEqual([(option.kind, option.route, option.full_control) for option in placed.options],
                         [(c.SYSTEM_MODULE, p.SYSTEM, True)])
        self.assertEqual((placed.default, placed.chosen, placed.ask), ("", c.SYSTEM_MODULE, True))
        self.assertIn("full control", placed.options[0].label)
        self.assertEqual(p.harmful(placed), [])

    def test_a_system_module_from_ubuntu_cannot_be_installed_yet(self):
        placed = place(package("nginx", "/usr/sbin/nginx", "/lib/systemd/system/nginx.service"))
        self.assertEqual(placed.options, ())
        self.assertIn("can't install those yet", placed.unavailable)

    def test_a_system_tool_follows_its_family(self):
        rpm = place(package("parted", "/usr/sbin/parted", family="rpm", depends=("parted-libs",)))
        deb = place(package("parted", "/usr/sbin/parted", depends=("libparted2",)))
        self.assertIn((c.SYSTEM_TOOL, p.SYSTEM), [(option.kind, option.route) for option in rpm.options])
        self.assertEqual(p.harmful(rpm, c.SYSTEM_TOOL), [])
        self.assertTrue(deb.unavailable)

    def test_a_choice_offers_only_what_works_sandboxed_first(self):
        rpm = place(package("tpm2-x", "/usr/sbin/tpm2-x", family="rpm"))
        self.assertEqual([option.kind for option in rpm.options], [c.CONSOLE_APPLICATION, c.SYSTEM_TOOL])
        self.assertEqual((rpm.default, rpm.ask), (c.CONSOLE_APPLICATION, True))
        self.assertIn("full control instead", rpm.notice)
        deb = place(package("tpm2-x", "/usr/sbin/tpm2-x"))
        self.assertEqual([option.kind for option in deb.options], [c.CONSOLE_APPLICATION])
        self.assertIn("can't install for Debian and Ubuntu yet", deb.notice)
        for placed in (rpm, deb):
            self.assertEqual(p.harmful(placed, c.SYSTEM_TOOL), [])

    def test_kinds_without_a_route_say_why(self):
        cases = {
            "device rules": package("steam-devices", "/lib/udev/rules.d/60-steam-input.rules"),
            "Fonts": package("fonts-x", "/usr/share/fonts/truetype/x/x.ttf"),
            "software source": package("packages-microsoft-prod", "/etc/apt/sources.list.d/microsoft-prod.list",
                                       "/usr/share/keyrings/microsoft.gpg"),
            "a desktop is a Suno Mod": package("lightdm", "/usr/sbin/lightdm"),
            "already includes v4l2loopback": package("v4l2loopback-dkms", "/usr/src/v4l2loopback-0.12/dkms.conf"),
            "already has its own": package("avahi-daemon", "/usr/sbin/avahi-daemon",
                                           "/lib/systemd/system/avahi-daemon.service"),
            "snap-transitional": PackageInfo("firefox", "1:1snap1", "deb", depends=("snapd",)),
            "with its own kernels": package("nvidia-dkms-550", "/usr/src/nvidia-550/dkms.conf"),
        }
        for words, info in cases.items():
            placed = place(info)
            self.assertEqual(placed.options, (), info.name)
            self.assertIn(words, placed.unavailable, info.name)
            self.assertEqual(p.harmful(placed), [], info.name)

    def test_an_add_on_of_an_app_cannot_be_installed_yet(self):
        placed = p.decide(Classification(c.APPLICATION, (), add_on_of="gedit"), package("gedit-plugin-x"))
        self.assertIn("part of another app (gedit)", placed.unavailable)

    def test_a_workspace_by_name_waits_for_workspaces(self):
        placed = p.decide(Classification(c.WORKSPACE, ()), package("htop", "/usr/bin/htop"), arrival=c.COMMAND)
        self.assertIn("Workspaces", placed.unavailable)
        from_file = p.decide(Classification(c.WORKSPACE, ()), package("htop", "/usr/bin/htop"))
        self.assertEqual(from_file.default, c.CONSOLE_APPLICATION)

    def test_with_the_store_off_a_console_app_cannot_be_installed(self):
        placed = place(package("ripgrep", "/usr/bin/rg"), store=False)
        self.assertIn("store", placed.unavailable)

    def test_a_launcher_package_is_never_placed_here(self):
        visible = c.DesktopEntry("/usr/share/applications/x.desktop", "x", False)
        hidden = c.DesktopEntry("/usr/share/applications/x-url.desktop", "x %u", True)
        self.assertTrue(p.has_launcher(package("x", "/usr/bin/x", desktop=(visible,))))
        self.assertFalse(p.has_launcher(package("x", "/usr/bin/x", desktop=(hidden,))))
        placed = p.decide(Classification(c.CONSOLE_APPLICATION, (), (c.GUI_LAUNCHER,)), package("x", "/usr/bin/x"))
        self.assertEqual(placed.options, ())


class ReleasePolicy(unittest.TestCase):
    """Reviewed-only list, everything else asks; full control is always asked."""

    def test_only_a_reviewed_single_sandboxed_outcome_is_silent(self):
        info = package("htop", "/usr/bin/htop")
        reviewed = c._with_defaults(Classification(c.CONSOLE_APPLICATION, (), ("curated", c.REVIEWED)))
        unreviewed = c._with_defaults(Classification(c.CONSOLE_APPLICATION, (), ("curated",), ask=True))
        rules = c._with_defaults(Classification(c.CONSOLE_APPLICATION, ()))
        self.assertFalse(p.decide(reviewed, info, arrival=c.COMMAND).ask)
        self.assertTrue(p.decide(unreviewed, info, arrival=c.COMMAND).ask)
        self.assertTrue(p.decide(rules, info, arrival=c.COMMAND).ask)

    def test_a_reviewed_system_module_is_still_asked(self):
        reviewed = c._with_defaults(Classification(c.SYSTEM_MODULE, (), ("curated", c.REVIEWED)))
        placed = p.decide(reviewed, package("nginx", "/usr/sbin/nginx", family="rpm"), arrival=c.COMMAND)
        self.assertEqual((placed.default, placed.ask), ("", True))

    def test_a_reviewed_choice_is_asked(self):
        reviewed = c._with_defaults(Classification(c.CHOICE, (), ("curated", c.REVIEWED),
                                                   choices=(c.CONSOLE_APPLICATION, c.SYSTEM_TOOL)))
        placed = p.decide(reviewed, package("lsusb", "/usr/bin/lsusb", family="rpm"), arrival=c.COMMAND)
        self.assertTrue(placed.ask)


class Gates(unittest.TestCase):
    """run.py's predicates on the wired path, over every shipped list entry and both families."""

    def test_every_shipped_entry_is_placed_without_harm(self):
        os.environ.pop(c.DATA_ENVIRONMENT, None)
        c.curated_list.cache_clear()
        checked = 0
        for release in ("ubuntu-24.04", "fedora-45"):
            for name, entry in c.curated_list(release)["entries"].items():
                result = c._with_defaults(c._from_curated(entry))
                label = entry["kind"] if entry["kind"] != c.CHOICE else ""
                for family in FAMILIES:
                    info = package(name, f"/usr/bin/{name}", family=family)
                    for arrival in (c.FILE, c.COMMAND):
                        placed = p.decide(result, info, arrival=arrival)
                        self.assertEqual(p.harmful(placed, label), [], (release, name, family, arrival))
                        if placed.options and not placed.ask:
                            self.assertIn(c.REVIEWED, result.flags, name)
                            self.assertFalse(placed.option(placed.default).full_control, name)
                        checked += 1
        self.assertGreater(checked, 30000)

    def test_the_gates_catch_harm(self):
        system = p.Option(c.SYSTEM_MODULE, p.SYSTEM, "x", True)
        console = p.Option(c.CONSOLE_APPLICATION, p.CONSOLE, "x", False)
        silent_system = p.Placement("x", "rpm", c.APPLICATION, (system,), c.SYSTEM_MODULE, False)
        found = p.harmful(silent_system, c.APPLICATION)
        self.assertIn("an app goes to the system silently", found)
        self.assertIn("a full-control route is preselected", found)
        self.assertIn("a non-system package goes to the system silently",
                      p.harmful(silent_system, c.CONSOLE_APPLICATION))
        breaks = p.Placement("x", "rpm", c.SYSTEM_MODULE, (console,), c.CONSOLE_APPLICATION, True)
        self.assertIn("a system package breaks silently (sandboxed, no notice)", p.harmful(breaks))
        self.assertIn("nothing to install and no reason given",
                      p.harmful(p.Placement("x", "deb", c.WORKSPACE, (), "", False)))

    def test_no_route_ever_puts_anything_in_a_workspace(self):
        routes = {p.CONSOLE, p.SYSTEM}
        for family in FAMILIES:
            for kind in c.KINDS:
                choices = (kind, c.WORKSPACE) if kind != c.CHOICE else (c.WORKSPACE, c.SYSTEM_MODULE)
                result = c._with_defaults(Classification(kind if kind != c.CHOICE else c.CHOICE, (), choices=choices
                                                         if kind == c.CHOICE else ()))
                for arrival in (c.FILE, c.COMMAND):
                    placed = p.decide(result, package("x", "/usr/bin/x", family=family), arrival=arrival)
                    self.assertTrue({option.route for option in placed.options} <= routes)
                    self.assertTrue(placed.unavailable or placed.options, (family, kind, arrival))


class Reports(unittest.TestCase):
    def test_the_report_says_where_it_goes(self):
        system = place(package("nginx", "/usr/sbin/nginx", "/usr/lib/systemd/system/nginx.service", family="rpm"))
        shown = report(placed=system)
        self.assertTrue(shown.requires_system_change)
        self.assertIn("Full control of this computer", shown.warnings[0])
        console = report(kind="deb", placed=place(package("ripgrep", "/usr/bin/rg")))
        self.assertFalse(console.requires_system_change)
        self.assertEqual(console.destination, "Private console app")
        missing = report(kind="deb", placed=place(package("steam-devices", "/lib/udev/rules.d/60-x.rules")))
        self.assertIn("can't be installed yet", missing.warnings[0])
        self.assertEqual(p.Placement.from_json(console.placement), place(package("ripgrep", "/usr/bin/rg")))


class Install(unittest.TestCase):
    """backends takes exactly the placed route: never the capsule, never the image unasked."""

    def test_unavailable_is_refused(self):
        shown = report(kind="deb", placed=place(package("fonts-x", "/usr/share/fonts/x.ttf")))
        with self.assertRaisesRegex(InstallerError, "can't be installed yet"):
            backends._install_placed(shown)

    def test_console_goes_to_the_store_with_its_command_and_never_the_capsule(self):
        shown = report(kind="deb", placed=place(package("ripgrep", "/usr/bin/rg")))
        with mock.patch.object(store_install, "enabled", return_value=True), \
                mock.patch.object(backends, "stage_user_copy", return_value=Path("/staged")), \
                mock.patch.object(store_install, "install", return_value="ripgrep") as install, \
                mock.patch.object(backends, "_install_deb") as capsule:
            self.assertEqual(backends._install_placed(shown), "ripgrep")
        self.assertEqual(install.call_args.kwargs["console_command"], "/usr/bin/rg")
        capsule.assert_not_called()
        with mock.patch.object(store_install, "enabled", return_value=True), \
                mock.patch.object(backends, "stage_user_copy", return_value=Path("/staged")), \
                mock.patch.object(store_install, "install", side_effect=store_install.Fallback("build", "no")), \
                mock.patch.object(backends, "_install_deb") as capsule:
            with self.assertRaisesRegex(InstallerError, "console app: no"):
                backends._install_placed(shown)
        capsule.assert_not_called()

    def test_system_goes_to_the_helper_only_as_reviewed(self):
        placed = place(package("nginx", "/usr/sbin/nginx", "/usr/lib/systemd/system/nginx.service", family="rpm"))
        shown = report(placed=placed)
        with mock.patch.object(backends, "_install_system", return_value="nginx") as system:
            self.assertEqual(backends._install_placed(shown), "nginx")
        system.assert_called_once()
        from dataclasses import replace
        with self.assertRaisesRegex(InstallerError, "disagree"):
            backends._install_placed(replace(shown, requires_system_change=False))
        sandboxed = report(kind="rpm", placed=place(package("tpm2-x", "/usr/sbin/tpm2-x", family="rpm")))
        with mock.patch.object(backends, "_install_system") as system, \
                mock.patch.object(store_install, "enabled", return_value=True), \
                mock.patch.object(backends, "stage_user_copy", return_value=Path("/staged")), \
                mock.patch.object(store_install, "install", return_value="tpm2-x"):
            backends._install_placed(sandboxed)
        system.assert_not_called()


class CommandLine(unittest.TestCase):
    """Suno-appctl install FILE: an ask is answered by --as or the person, never assumed."""

    def answer(self, placed, as_kind=None, interactive=False, typed=""):
        err = io.StringIO()
        with mock.patch("sys.stderr", err), mock.patch("sys.stdout", io.StringIO()):
            result = manager._answer_placement(report(kind=placed.family, placed=placed), as_kind,
                                               interactive=interactive, read=lambda _prompt: typed)
        return result, err.getvalue()

    def test_a_scripted_ask_installs_nothing_and_says_how_to_answer(self):
        result, said = self.answer(place(package("ripgrep", "/usr/bin/rg")))
        self.assertIsNone(result)
        self.assertIn("--as console-application", said)

    def test_as_answers_it(self):
        result, _ = self.answer(place(package("ripgrep", "/usr/bin/rg")), c.CONSOLE_APPLICATION)
        self.assertEqual(p.Placement.from_json(result.placement).chosen, c.CONSOLE_APPLICATION)
        tool = place(package("tpm2-x", "/usr/sbin/tpm2-x", family="rpm"))
        result, _ = self.answer(tool, c.SYSTEM_TOOL)
        self.assertTrue(result.requires_system_change)
        result, said = self.answer(place(package("ripgrep", "/usr/bin/rg")), c.SYSTEM_MODULE)
        self.assertIsNone(result)
        self.assertIn("can't be installed as system-module", said)

    def test_the_person_at_a_terminal_chooses(self):
        tool = place(package("tpm2-x", "/usr/sbin/tpm2-x", family="rpm"))
        result, _ = self.answer(tool, interactive=True, typed="2")
        self.assertEqual(p.Placement.from_json(result.placement).chosen, c.SYSTEM_TOOL)
        result, said = self.answer(tool, interactive=True, typed="")
        self.assertIsNone(result)
        self.assertIn("nothing was installed", said)

    def test_a_reviewed_outcome_proceeds(self):
        reviewed = c._with_defaults(Classification(c.CONSOLE_APPLICATION, (), ("curated", c.REVIEWED)))
        placed = p.decide(reviewed, package("htop", "/usr/bin/htop"), arrival=c.COMMAND)
        result, _ = self.answer(placed)
        self.assertEqual(p.Placement.from_json(result.placement).chosen, c.CONSOLE_APPLICATION)

    def test_unavailable_says_why(self):
        result, said = self.answer(place(package("nginx", "/usr/sbin/nginx", "/lib/systemd/system/nginx.service")))
        self.assertIsNone(result)
        self.assertIn("can't be installed yet", said)


class Files(unittest.TestCase):
    """Facts come from the file without running anything from it."""

    def test_cpio_reads_only_wanted_files(self):
        def member(name, data, mode=0o100644):
            encoded = name.encode() + b"\0"
            header = b"070701" + b"".join(b"%08X" % value for value in (
                0, mode, 0, 0, 1, 0, len(data), 0, 0, 0, 0, len(encoded), 0))
            out = header + encoded
            out += b"\0" * ((4 - len(out) % 4) % 4) + data
            return out + b"\0" * ((4 - len(data) % 4) % 4)
        stream = io.BytesIO(member("./usr/bin/x", b"\x7fELF" * 9) +
                            member("./usr/share/applications/x.desktop", b"[Desktop Entry]\nExec=x\n") +
                            member("TRAILER!!!", b""))
        self.assertEqual(list(p._cpio_members(stream)),
                         [("/usr/bin/x", None), ("/usr/share/applications/x.desktop", b"[Desktop Entry]\nExec=x\n")])

    @unittest.skipUnless(shutil.which("dpkg-deb"), "dpkg-deb is not installed")
    def test_a_deb_without_a_launcher_is_read(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "root"
            (root / "DEBIAN").mkdir(parents=True)
            (root / "DEBIAN/control").write_text("Package: rgx\nVersion: 1.0\nArchitecture: all\n"
                                                 "Maintainer: x <x@example.org>\nDepends: libc6 (>= 2.34), a | b\n"
                                                 "Description: a tool\n")
            (root / "usr/bin").mkdir(parents=True)
            (root / "usr/bin/rgx").write_text("#!/bin/sh\n")
            (root / "usr/bin/rgx").chmod(0o4755)
            (root / "usr/share/applications").mkdir(parents=True)
            (root / "usr/share/applications/rgx-url.desktop").write_text(
                "[Desktop Entry]\nType=Application\nExec=rgx %u\nNoDisplay=true\n")
            deb = Path(folder) / "rgx.deb"
            subprocess.run(["dpkg-deb", "--root-owner-group", "-b", str(root), str(deb)], check=True,
                           capture_output=True)
            info = p.read_deb(deb)
            self.assertEqual((info.name, info.family, info.depends), ("rgx", "deb", ("libc6", "a")))
            self.assertIn("/usr/bin/rgx", info.files)
            self.assertEqual(info.setuid, ("/usr/bin/rgx",))
            self.assertFalse(p.has_launcher(info))
            placed = p.for_file(deb, "deb", store=True)
            self.assertIsNotNone(placed)
            self.assertEqual(placed.command, "/usr/bin/rgx")

    def test_a_console_spec_exports_its_command(self):
        from Suno_installer import closure
        spec = closure.Spec(app_id="deb-rg", kind="deb", userland="ubuntu-24.04", package="ripgrep",
                            command="/usr/bin/rg", windowed=False)
        with tempfile.TemporaryDirectory() as folder:
            exports = closure._exports(Path(folder), spec, "/usr/bin/rg\n")
        self.assertEqual((exports["command"], exports["terminal"], exports["name"]), ("/usr/bin/rg", True, "ripgrep"))


if __name__ == "__main__":
    unittest.main()
