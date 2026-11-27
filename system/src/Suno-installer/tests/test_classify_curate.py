# SPDX-License-Identifier: Apache-2.0
"""Curated-list generation (tools/classify-labelled-set/curate.py): application add-ons by the archive."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent.parent / "tools/classify-labelled-set"
if not (TOOLS / "curate.py").is_file():  # the package build carries the installer, not the labelling tools
    raise unittest.SkipTest("tools/classify-labelled-set is not in this tree")
sys.path.insert(0, str(TOOLS))
import curate  # noqa: E402

from Suno_installer import classify as c  # noqa: E402


def package(name: str, files: tuple[str, ...] = (), source: str = "") -> c.PackageInfo:
    return c.PackageInfo(name, "1", "deb", "amd64", {"Source": source} if source else {}, (), (), (), files)


BY_SOURCE = {"vlc": {"vlc", "vlc-bin", "libvlccore9", "libvlc-dev", "vlc-plugin-visualization"},
             "libreoffice": {"libreoffice", "libreoffice-writer", "libreoffice-style-tango"},
             "lxappearance": {"lxappearance"}, "lxappearance-obconf": {"lxappearance-obconf"}}
LAUNCHERS = {"vlc", "libreoffice-writer", "lxappearance"}


class ArchiveHost(unittest.TestCase):
    def host(self, item: c.PackageInfo) -> str:
        return curate.archive_host(item, LAUNCHERS, BY_SOURCE)

    def test_plugins_in_the_application_directory(self) -> None:
        self.assertEqual(self.host(package("vlc-plugin-visualization", (
            "/usr/lib/x86_64-linux-gnu/vlc/plugins/visualization/libvisual_plugin.so",
            "/usr/share/doc/vlc-plugin-visualization/copyright"), "vlc")), "vlc")
        self.assertEqual(self.host(package("lxappearance-obconf", (
            "/usr/lib/x86_64-linux-gnu/lxappearance/plugins/obconf.so",))), "lxappearance")

    def test_transitional_package_by_source(self) -> None:
        self.assertEqual(self.host(package("libreoffice-style-tango", (), "libreoffice")), "libreoffice")

    def test_libraries_and_headers_are_not_add_ons(self) -> None:
        self.assertEqual(self.host(package("libvlccore9", ("/usr/lib/x86_64-linux-gnu/libvlccore.so.9",), "vlc")), "")
        self.assertEqual(self.host(package("libvlc-dev", ("/usr/include/vlc/vlc.h",), "vlc")), "")

    def test_no_launcher_no_host(self) -> None:
        self.assertEqual(curate.archive_host(package("vlc-plugin-visualization", (
            "/usr/lib/x86_64-linux-gnu/vlc/plugins/visualization/libvisual_plugin.so",), "vlc"), set(), BY_SOURCE), "")

    def test_only_inert_workspace_results_change(self) -> None:
        item = package("vlc-plugin-visualization", ("/usr/lib/x86_64-linux-gnu/vlc/plugins/a/b.so",), "vlc")
        result = curate.with_archive_host(item, c.Classification(c.WORKSPACE, ("inert",), default=c.WORKSPACE),
                                          LAUNCHERS, BY_SOURCE)
        self.assertEqual((result.kind, result.default, result.add_on_of), (c.APPLICATION, c.APPLICATION, "vlc"))
        self.assertIn(c.APPLICATION_ADD_ON, result.flags)
        choice = c.Classification(c.CHOICE, ("x",), choices=(c.WORKSPACE, c.SYSTEM_MODULE), default=c.WORKSPACE)
        self.assertIs(curate.with_archive_host(item, choice, LAUNCHERS, BY_SOURCE), choice)

    def test_reviewed_application_takes_the_host(self) -> None:
        reviewed = {"kind": "application", "agreement": "reviewed"}
        curate.fill_add_on_of(reviewed, {"kind": "application", "add_on_of": "marble"})
        self.assertEqual(reviewed["add_on_of"], "marble")
        system = {"kind": "system-module", "agreement": "reviewed"}
        curate.fill_add_on_of(system, {"kind": "application", "add_on_of": "marble"})
        self.assertNotIn("add_on_of", system)


if __name__ == "__main__":
    unittest.main()
