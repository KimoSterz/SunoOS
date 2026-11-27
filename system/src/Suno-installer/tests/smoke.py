#!/usr/bin/python3
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from unittest.mock import patch, Mock
from types import SimpleNamespace
from pathlib import Path

import Suno_installer.backends as backends
import Suno_installer.safety as safety
import Suno_installer.system_helper as system_helper
from Suno_installer.backends import _export_appimage_icon
from Suno_installer.desktop import iter_records, write_launcher, write_record
from Suno_installer.errors import InstallerError
from Suno_installer.manager import reconcile, remove
from Suno_installer.model import kind_for_path, supports_content_type
from Suno_installer.model import PackageReport
from Suno_installer.safety import fingerprint


def main() -> None:
    expected = {
        "test.rpm": "rpm", "test.deb": "deb", "test.AppImage": "appimage",
        "test.flatpak": "flatpak", "test.flatpakref": "flatpakref",
        "test.flatpakrepo": "flatpakrepo", "test.snap": "snap",
        "test.apk": "android", "test.apkm": "android", "test.exe": "windows",
    }
    for name, kind in expected.items():
        assert kind_for_path(Path(name)) == kind
    assert supports_content_type("application/x-rpm")
    assert supports_content_type("application/vnd.debian.binary-package; charset=binary")
    assert not supports_content_type("text/plain")
    with tempfile.TemporaryDirectory() as directory:
        package = Path(directory) / "sample.rpm"
        package.write_bytes(b"Suno-installer-smoke")
        size, digest = fingerprint(package)
        assert size == 20
        assert digest == "b623de1e2ce4ea45c35263a27beee73bc4a3e19fb84520525ad137aa531458df"
        empty = Path(directory) / "empty.rpm"
        empty.touch()
        try:
            fingerprint(empty)
        except InstallerError:
            pass
        else:
            raise AssertionError("empty packages must be rejected")
        link = Path(directory) / "link.rpm"
        link.symlink_to(package)
        try:
            fingerprint(link)
        except InstallerError:
            pass
        else:
            raise AssertionError("package symlinks must be rejected")

        real_disk_usage = safety.shutil.disk_usage
        try:
            usage = type("DiskUsage", (), {"free": 1})()
            safety.shutil.disk_usage = lambda _path: usage
            try:
                safety.stage_user_copy(package, digest)
            except InstallerError as error:
                assert "Not enough free space" in str(error)
            else:
                raise AssertionError("a full staging filesystem must be rejected before copying")
        finally:
            safety.shutil.disk_usage = real_disk_usage

        real_system_disk_usage = system_helper.shutil.disk_usage
        try:
            usage = type("DiskUsage", (), {"free": 1})()
            system_helper.shutil.disk_usage = lambda _path: usage
            try:
                system_helper.require_transaction_space(Path(directory), 1024)
            except ValueError as error:
                assert "not enough free system storage" in str(error)
            else:
                raise AssertionError("a full system transaction filesystem must be rejected")
        finally:
            system_helper.shutil.disk_usage = real_system_disk_usage
        payload = Path(directory) / "AppDir"
        payload.mkdir()
        escaped_icon = payload / ".DirIcon"
        escaped_icon.symlink_to(package)
        assert _export_appimage_icon(payload, "", "Suno-test") == "application-x-executable"

    original_home = os.environ.get("HOME")
    original_data_home = os.environ.get("XDG_DATA_HOME")
    with tempfile.TemporaryDirectory() as directory:
        home = Path(directory)
        os.environ["HOME"] = str(home)
        os.environ["XDG_DATA_HOME"] = str(home / ".local/share")
        lock_sha = "d" * 64
        lock_script = """
from pathlib import Path
import time
from Suno_installer.safety import staging_root, transaction_lock
sha256 = "d" * 64
with transaction_lock(sha256):
    root = staging_root(sha256)
    (root / ".fixture.partial").write_text("partial\\n", encoding="utf-8")
    appimage = Path.home() / ".local/share/Suno/appimages" / sha256 / ".AppDir.partial"
    appimage.mkdir(parents=True)
    (appimage / "payload").write_text("partial\\n", encoding="utf-8")
    print("locked", flush=True)
    time.sleep(300)
"""
        worker = subprocess.Popen(
            [sys.executable, "-c", lock_script], stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, env=os.environ.copy(),
        )
        assert worker.stdout is not None
        assert worker.stdout.readline().strip() == "locked"
        locked_partial = home / ".local/share/Suno/installer/staging" / lock_sha / ".fixture.partial"
        appimage_partial = home / ".local/share/Suno/appimages" / lock_sha / ".AppDir.partial"
        safety.cleanup_abandoned_user_transactions()
        assert locked_partial.is_file() and appimage_partial.is_dir()
        worker.kill()
        worker.wait(timeout=10)
        safety.cleanup_abandoned_user_transactions()
        assert not locked_partial.exists() and not appimage_partial.exists()

        system_transactions = home / "system-transactions"
        abandoned = system_transactions / "transaction-abandoned"
        abandoned.mkdir(parents=True)
        (abandoned / "application.rpm").write_text("partial\n", encoding="utf-8")
        outside = home / "outside-system-transaction"
        outside.mkdir()
        (system_transactions / "transaction-link").symlink_to(outside, target_is_directory=True)
        system_helper.cleanup_abandoned_system_transactions(system_transactions, os.getuid())
        assert not abandoned.exists()
        assert outside.is_dir()
        assert (system_transactions / "transaction-link").is_symlink()

        sha256 = "a" * 64
        application_id = "appimage-lifecycle-fixture"
        payload = home / ".local/share/Suno/appimages" / sha256 / "AppDir"
        payload.mkdir(parents=True)
        (payload / "AppRun").write_text("fixture\n", encoding="utf-8")
        data = home / ".local/share/Suno/installer/data" / sha256
        data.mkdir(parents=True)
        write_record(application_id, {
            "format": "appimage", "name": "Lifecycle Fixture", "sha256": sha256,
            "root": str(payload), "command": "/app/AppRun",
        })
        write_launcher(application_id, "Lifecycle Fixture", "Installer lifecycle test")
        assert len(iter_records()) == 1
        assert remove(application_id) == "Removed. Private application data was retained."
        assert not payload.exists()
        assert data.is_dir()
        assert iter_records() == []

        pending_id = "rpm-removal-lifecycle-fixture"
        write_record(pending_id, {
            "format": "rpm", "name": "Suno-package-that-cannot-exist",
            "package_name": "Suno-package-that-cannot-exist",
            "sha256": "c" * 64, "state": "removal-pending-restart",
        })
        reconcile()
        assert iter_records() == []

        flatpakref = home / "fixture.flatpakref"
        flatpakref.write_text("[Flatpak Ref]\nName=org.projectSuno.Fixture\n", encoding="utf-8")
        calls: list[list[str]] = []
        real_run = backends._run

        def fake_run(arguments: list[str], **_kwargs) -> subprocess.CompletedProcess[str]:
            calls.append(arguments)
            if arguments[1:3] == ["list", "--user"]:
                output = "org.projectSuno.Fixture\n"
            elif arguments[1:3] == ["info", "--user"]:
                output = "Name: Fixture\n"
            else:
                output = ""
            return subprocess.CompletedProcess(arguments, 0, output, "")

        try:
            backends._run = fake_run
            report = PackageReport(
                flatpakref, "flatpakref", "org.projectSuno.Fixture", "Fixture",
                flatpakref.stat().st_size, "b" * 64, details={"Application ID": "org.projectSuno.Fixture"},
            )
            transaction = Mock()
            with patch.dict(sys.modules, {"Suno_installer.flatpak_backend": SimpleNamespace(install=transaction)}):
                assert backends._install_flatpak(report) == "org.projectSuno.Fixture"
            transaction.assert_called_once_with(report)
        finally:
            backends._run = real_run
        # A reviewed file must reach libflatpak, never an unrelated origin update.
        assert not any(command[1] == "update" for command in calls)
        assert not any(command[1] == "install" for command in calls)
    if original_home is None:
        os.environ.pop("HOME", None)
    else:
        os.environ["HOME"] = original_home
    if original_data_home is None:
        os.environ.pop("XDG_DATA_HOME", None)
    else:
        os.environ["XDG_DATA_HOME"] = original_data_home


if __name__ == "__main__":
    main()
