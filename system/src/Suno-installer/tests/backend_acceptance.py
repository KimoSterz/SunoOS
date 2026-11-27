#!/usr/bin/python3
"""Exercise Suno's local application backends with harmless built fixtures.

Run this on the canonical Fedora builder through Suno-build-run. It creates
fresh AppImage, DEB, RPM, Flatpak-ref, and Snap inputs beneath TMPDIR. Only the
rootless AppImage/DEB/RPM application lanes are installed and launched; the
privileged system-RPM and local-Snap lanes remain separate physical-VM gates.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from Suno_installer.backends import install
from Suno_installer.desktop import records_root
from Suno_installer.inspectors import inspect_package


def run(arguments: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(arguments, check=True, text=True, **kwargs)


def write(path: Path, contents: str, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents, encoding="utf-8")
    path.chmod(mode)


def desktop(name: str, command: str, icon: str = "Suno-fixture") -> str:
    return "\n".join((
        "[Desktop Entry]", "Type=Application", f"Name={name}",
        "Comment=Harmless Suno installer acceptance fixture",
        f"Exec={command}", f"Icon={icon}", "Terminal=false", "",
    ))


def build_appimage(root: Path) -> Path:
    appdir = root / "AppDir"
    write(appdir / "AppRun", "#!/bin/sh\nprintf 'appimage-ok\\n'\n", 0o755)
    write(appdir / "Suno-fixture.desktop", desktop("Suno AppImage Fixture", "/app/AppRun"))
    write(
        appdir / "Suno-fixture.svg",
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#4878b8"/></svg>\n',
    )
    squashfs = root / "appimage.squashfs"
    run(["mksquashfs", str(appdir), str(squashfs), "-noappend", "-quiet", "-comp", "gzip"])
    output = root / "SunoFixture.AppImage"
    payload = bytearray(Path("/usr/bin/true").read_bytes())
    payload[8:11] = b"AI\x02"
    output.write_bytes(payload + squashfs.read_bytes())
    output.chmod(0o644)
    return output


def build_deb(root: Path) -> Path:
    tree = root / "deb"
    write(tree / "DEBIAN/control", "\n".join((
        "Package: Suno-installer-fixture", "Version: 1.0", "Section: utils",
        "Priority: optional", "Architecture: all", "Maintainer: Project Suno",
        "Description: Harmless Suno installer acceptance fixture", "",
    )))
    write(tree / "usr/bin/Suno-deb-fixture", "#!/bin/sh\nprintf 'deb-ok\\n'\n", 0o755)
    write(
        tree / "usr/share/applications/Suno-deb-fixture.desktop",
        desktop("Suno DEB Fixture", "/usr/bin/Suno-deb-fixture"),
    )
    output = root / "Suno-installer-fixture.deb"
    run(["dpkg-deb", "--build", str(tree), str(output)], stdout=subprocess.DEVNULL)
    return output


def build_rpm(root: Path) -> Path:
    top = root / "rpmbuild"
    for name in ("BUILD", "BUILDROOT", "RPMS", "SOURCES", "SPECS", "SRPMS"):
        (top / name).mkdir(parents=True)
    write(top / "SOURCES/Suno-rpm-fixture", "#!/bin/sh\nprintf 'rpm-ok\\n'\n", 0o755)
    write(
        top / "SOURCES/Suno-rpm-fixture.desktop",
        desktop("Suno RPM Fixture", "/usr/bin/Suno-rpm-fixture"),
    )
    write(top / "SPECS/Suno-rpm-fixture.spec", """Name: Suno-rpm-fixture
Version: 1.0
Release: 1
Summary: Harmless Suno installer acceptance fixture
License: Apache-2.0
BuildArch: noarch
Source0: Suno-rpm-fixture
Source1: Suno-rpm-fixture.desktop

%description
Harmless Suno installer acceptance fixture.

%install
install -D -m 0755 %{SOURCE0} %{buildroot}%{_bindir}/Suno-rpm-fixture
install -D -m 0644 %{SOURCE1} %{buildroot}%{_datadir}/applications/Suno-rpm-fixture.desktop

%files
%{_bindir}/Suno-rpm-fixture
%{_datadir}/applications/Suno-rpm-fixture.desktop
""")
    run(["rpmbuild", "-bb", "--define", f"_topdir {top}", str(top / "SPECS/Suno-rpm-fixture.spec")],
        stdout=subprocess.DEVNULL)
    return next((top / "RPMS/noarch").glob("Suno-rpm-fixture-*.rpm"))


def build_snap(root: Path) -> Path:
    tree = root / "snap"
    write(tree / "meta/snap.yaml", "\n".join((
        "name: Suno-installer-fixture", "version: '1.0'",
        "summary: Harmless Suno installer acceptance fixture",
        "description: Static inspection fixture", "grade: stable",
        "confinement: strict", "architectures: [amd64]", "",
    )))
    output = root / "Suno-installer-fixture.snap"
    run(["mksquashfs", str(tree), str(output), "-noappend", "-quiet", "-comp", "xz"])
    return output


def new_record(before: set[Path]) -> tuple[str, dict[str, object]]:
    created = set(records_root().glob("*.json")) - before
    if len(created) != 1:
        raise AssertionError(f"expected one managed application record, found {len(created)}")
    path = created.pop()
    return path.stem, json.loads(path.read_text(encoding="utf-8"))


def launch(application_id: str, expected: str) -> None:
    result = run([sys.executable, "-m", "Suno_installer.launcher", application_id], capture_output=True)
    if result.stdout.strip() != expected:
        raise AssertionError(f"{application_id} produced {result.stdout!r}, expected {expected!r}")


def main() -> None:
    original_home = os.environ.get("HOME")
    with tempfile.TemporaryDirectory(prefix="Suno-installer-acceptance-", dir=os.environ.get("TMPDIR")) as directory:
        root = Path(directory)
        home = root / "home"
        home.mkdir()
        os.environ["HOME"] = str(home)
        os.environ["XDG_DATA_HOME"] = str(home / ".local/share")
        appimage = build_appimage(root)
        deb = build_deb(root)
        rpm = build_rpm(root)
        snap = build_snap(root)
        flatpakref = root / "Suno-installer-fixture.flatpakref"
        write(flatpakref, "[Flatpak Ref]\nName=org.projectSuno.Fixture\nUrl=https://example.invalid/repo\n")

        reports = {path.suffix.lower(): inspect_package(path) for path in (appimage, deb, rpm, snap, flatpakref)}
        assert reports[".appimage"].kind == "appimage"
        assert reports[".deb"].kind == "deb"
        assert reports[".rpm"].kind == "rpm" and not reports[".rpm"].requires_system_change
        assert reports[".snap"].kind == "snap" and reports[".snap"].requires_system_change
        assert reports[".flatpakref"].kind == "flatpakref"

        images: list[str] = []
        try:
            for path, expected in ((appimage, "appimage-ok"), (deb, "deb-ok"), (rpm, "rpm-ok")):
                before = set(records_root().glob("*.json"))
                install(inspect_package(path))
                application_id, record = new_record(before)
                if "image" in record:
                    images.append(str(record["image"]))
                launch(application_id, expected)
        finally:
            for image in images:
                subprocess.run(["podman", "image", "rm", "--force", image], check=False,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if original_home is not None:
        os.environ["HOME"] = original_home
    print("Universal installer backend acceptance passed: AppImage, DEB, RPM; Flatpak-ref and Snap inspection passed.")


if __name__ == "__main__":
    main()
