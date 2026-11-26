# SPDX-License-Identifier: Apache-2.0
"""Who is calling, and who publishes it (ADR-057 §1.1, §1.2; connect-sync-apps-hub.md §1.1).

The portal names the caller's app ID and passes its pidfd. Here the
service checks the process itself, reads the commit the instance runs from
its installation's repository, and verifies that commit's OpenPGP
signatures against the keys the signed app registry approved for that app.
The local remote configuration (URL, ``gpg-verify``) is never proof: it is
text the person, or an app with home access, can write.

Outcomes:

- ``approved``: a valid signature by an approved primary key (or a signing
  subkey bound to it) of an ``approved`` registry entry for this app ID.
  The owner is the entry's.
- ``suspended`` / ``revoked``: the same match, but the entry isn't approved.
- ``not-approved``: validly signed (by a registry key or by a key the
  installation trusts for some remote), but no entry approves that key for
  this app. Local data is kept under ``key:<primary fingerprint>``.
- ``unverified``: no valid signature: unsigned commits, local builds,
  keyless bundles, ``gpg-verify=false`` remotes. Nothing is stored.
"""
from __future__ import annotations

import configparser
import errno
import hashlib
import os
import re
import signal
import stat
import subprocess
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path

from .limits import ApiError

APP_ID = re.compile(r"[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*){2,}")
COMMIT = re.compile(r"[0-9a-f]{64}")
FPR = re.compile(r"[0-9A-F]{40}")
MAX_COMMIT_OBJECT = 1 << 20
MAX_COMMITMETA = 1 << 20
GPGV_TIMEOUT = 20


@dataclass(frozen=True)
class Caller:
    app: str
    kind: str
    pid: int
    sender: str
    installation: Path
    commit: str
    app_path: Path
    scope: str = ""            # the caller's cgroup, read while its pidfd showed it alive ("" when unknown)


@dataclass(frozen=True)
class Identity:
    state: str                 # approved, suspended, revoked, not-approved, unverified
    owner: str                 # the registry owner, key:<fpr> for not-approved, "" for unverified
    fingerprint: str = ""      # the primary key that signed the commit
    entry: dict | None = None


# ---------------------------------------------------------------- the caller

def pid_of(pidfd: int) -> int:
    """The pid a pidfd refers to (from /proc/self/fdinfo), or 0 once the process has exited."""
    try:
        text = Path(f"/proc/self/fdinfo/{pidfd}").read_text()
    except OSError:
        return 0
    for line in text.splitlines():
        if line.startswith("Pid:"):
            pid = int(line.split()[1])
            return pid if pid > 0 else 0
    return 0


def alive(pidfd: int) -> bool:
    try:
        signal.pidfd_send_signal(pidfd, 0)
        return True
    except OSError:
        return False


def installations() -> list[Path]:
    """Where Flatpak installations may be: the system one, the person's, and configured system ones (root-owned)."""
    out = [Path("/var/lib/flatpak"), Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share") / "flatpak"]
    folder = Path("/etc/flatpak/installations.d")
    try:
        for conf in sorted(folder.glob("*.conf")):
            if conf.stat().st_uid != 0:
                continue
            parser = configparser.ConfigParser(interpolation=None)
            parser.read(conf)
            for section in parser.sections():
                path = parser[section].get("Path")
                if path:
                    out.append(Path(path))
    except OSError:
        pass
    return out


def read_flatpak_info(pid: int, proc: Path = Path("/proc")) -> configparser.ConfigParser:
    path = proc / str(pid) / "root/.flatpak-info"
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    except OSError as error:
        raise ApiError("refused", "The caller isn't a Flatpak app.") from error
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > 65536:
            raise ApiError("refused", "The caller's .flatpak-info is unusable.")
        text = os.read(fd, 65536).decode("utf-8", "replace")
    finally:
        os.close(fd)
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string(text)
    except configparser.Error as error:
        raise ApiError("refused", "The caller's .flatpak-info is unusable.") from error
    return parser


def resolve_caller(app_id: str, kind: str, pidfd: int, sender: str, *, proc: Path = Path("/proc"),
                   roots: list[Path] | None = None) -> Caller:
    """Check what the portal said against the process itself (§1.1.1). Raises ApiError("refused") otherwise."""
    if kind != "flatpak":
        # ADR-052 applications come in Phase 2, when the proxy runs in the app's own SELinux level; host callers never.
        raise ApiError("refused", "Only Flatpak apps can use Sync for apps on this Luma.")
    if not isinstance(app_id, str) or not APP_ID.fullmatch(app_id) or len(app_id) > 255:
        raise ApiError("refused", "The caller has no valid app ID.")
    if pidfd < 0 or not alive(pidfd):
        raise ApiError("refused", "The calling process has gone.")
    pid = pid_of(pidfd)
    if not pid:
        raise ApiError("refused", "The calling process has gone.")
    parser = read_flatpak_info(pid, proc)
    scope = read_scope(pid, proc)
    if not alive(pidfd) or pid_of(pidfd) != pid:
        raise ApiError("refused", "The calling process has gone.")
    if parser.get("Application", "name", fallback="") != app_id:
        raise ApiError("refused", "The caller's sandbox names another app.")
    commit = parser.get("Instance", "app-commit", fallback="")
    app_path = Path(parser.get("Instance", "app-path", fallback=""))
    if not COMMIT.fullmatch(commit):
        raise ApiError("refused", "The caller's sandbox names no commit.")
    # <installation>/app/<id>/<arch>/<branch>/<commit>/files
    parts = app_path.parts
    if len(parts) < 7 or parts[-1] != "files" or parts[-2] != commit or parts[-5] != app_id or parts[-6] != "app":
        raise ApiError("refused", "The caller doesn't run from a Flatpak installation.")
    installation = Path(*parts[:-6])
    if not any(_same_path(installation, root) for root in (roots if roots is not None else installations())):
        raise ApiError("refused", "The caller doesn't run from a known Flatpak installation.")
    return Caller(app_id, kind, pid, sender, installation, commit, app_path, scope)


def read_scope(pid: int, proc: Path = Path("/proc")) -> str:
    """The cgroup v2 path of a process ("" when unreadable). Only trusted when read between two pidfd checks."""
    try:
        for line in (proc / str(pid) / "cgroup").read_text().splitlines():
            if line.startswith("0::/"):
                return line[3:]
    except (OSError, ValueError):
        pass
    return ""


def _same_path(a: Path, b: Path) -> bool:
    try:
        return os.path.realpath(a) == os.path.realpath(b)
    except OSError:
        return False


# ---------------------------------------------------------------- the commit

def _read_object(repo: Path, checksum: str, suffix: str, limit: int) -> bytes | None:
    path = repo / "objects" / checksum[:2] / f"{checksum[2:]}.{suffix}"
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    except OSError as error:
        if error.errno in (errno.ENOENT, errno.ELOOP):
            return None
        raise
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            return None
        data = b""
        while len(data) <= limit:
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            data += chunk
        return data if len(data) <= limit else None
    finally:
        os.close(fd)


@dataclass(frozen=True)
class Commit:
    data: bytes
    signatures: list[bytes]
    ref_bindings: list[str]
    app_name: str


def read_commit(installation: Path, checksum: str) -> Commit | None:
    """The commit object and its detached signatures, checked against its checksum; None when it isn't there."""
    import gi
    gi.require_version("GLib", "2.0")
    from gi.repository import GLib
    repo = installation / "repo"
    data = _read_object(repo, checksum, "commit", MAX_COMMIT_OBJECT)
    if data is None or hashlib.sha256(data).hexdigest() != checksum:
        return None
    try:
        commit = GLib.Variant.new_from_bytes(GLib.VariantType("(a{sv}aya(say)sstayay)"), GLib.Bytes.new(data), False)
        metadata = commit.get_child_value(0).unpack()
    except Exception:  # noqa: BLE001 - a malformed commit is no commit
        return None
    bindings = metadata.get("ostree.ref-binding") or []
    app_name = ""
    xa = metadata.get("xa.metadata")
    if isinstance(xa, str):
        parser = configparser.ConfigParser(interpolation=None, strict=False)
        try:
            parser.read_string(xa)
            app_name = parser.get("Application", "name", fallback="")
        except configparser.Error:
            app_name = ""
    signatures: list[bytes] = []
    meta = _read_object(repo, checksum, "commitmeta", MAX_COMMITMETA)
    if meta:
        try:
            detached = GLib.Variant.new_from_bytes(GLib.VariantType("a{sv}"), GLib.Bytes.new(meta), False).unpack()
            for sig in detached.get("ostree.gpgsigs") or []:
                signatures.append(bytes(sig))
        except Exception:  # noqa: BLE001
            signatures = []
    return Commit(data, signatures[:16], [str(b) for b in bindings if isinstance(b, str)], app_name)


def bound_to(commit: Commit, app: str) -> bool:
    """The commit says it is this app (ostree.ref-binding, else xa.metadata's name)."""
    if commit.ref_bindings:
        return any(ref.split("/")[:2] == ["app", app] and len(ref.split("/")) == 4 for ref in commit.ref_bindings)
    return commit.app_name == app


def verify_signatures(commit: Commit, keyring: bytes) -> list[str]:
    """Primary fingerprints of the keys in ``keyring`` (binary OpenPGP keys) that made a valid signature on the commit.

    gpgv refuses expired or revoked keys (EXPKEYSIG/REVKEYSIG, never VALIDSIG) and signing subkeys that
    aren't cross-certified; VALIDSIG's last field is the primary key's fingerprint.
    """
    if not commit.signatures or not keyring:
        return []
    out: set[str] = set()
    with tempfile.TemporaryDirectory(prefix="luma-sync-verify-") as home:
        ring = Path(home) / "keys.gpg"
        ring.write_bytes(keyring)
        data = Path(home) / "commit"
        data.write_bytes(commit.data)
        for index, signature in enumerate(commit.signatures):
            sig = Path(home) / f"sig{index}"
            sig.write_bytes(signature)
            try:
                result = subprocess.run(["gpgv", "--homedir", home, "--weak-digest", "SHA1", "--status-fd", "1", "--keyring", str(ring),
                                         str(sig), str(data)],
                                        capture_output=True, timeout=GPGV_TIMEOUT, check=False, env={"LC_ALL": "C", "PATH": "/usr/bin:/bin"})
            except (OSError, subprocess.SubprocessError):
                continue
            if result.returncode != 0:
                continue
            lines = result.stdout.decode("utf-8", "replace").splitlines()
            if not any(line.startswith("[GNUPG:] GOODSIG ") for line in lines):
                continue
            if any(line.split()[1:2] and line.split()[1] in {"EXPKEYSIG", "REVKEYSIG", "EXPSIG", "BADSIG", "ERRSIG", "KEYREVOKED", "KEYEXPIRED"}
                   for line in lines if line.startswith("[GNUPG:] ")):
                continue
            for line in lines:
                fields = line.split()
                if len(fields) >= 12 and fields[0] == "[GNUPG:]" and fields[1] == "VALIDSIG" and FPR.fullmatch(fields[-1].upper()):
                    out.add(fields[-1].upper())
    return sorted(out)


def trusted_keyrings(installation: Path) -> bytes:
    """The keys the installation trusts for its remotes: only to tell 'signed by an unapproved key' from 'unsigned'."""
    out = b""
    repo = installation / "repo"
    try:
        for path in sorted(repo.glob("*.trustedkeys.gpg")):
            if path.is_file() and not path.is_symlink() and path.stat().st_size < (1 << 20):
                out += path.read_bytes()
    except OSError:
        pass
    return out


class Resolver:
    """Commit → identity, cached per (installation, commit, registry version): gpgv runs once per update, not per call."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.cache: dict[tuple[str, str, str, int], Identity] = {}

    def identity(self, caller: Caller, registry) -> Identity:
        version = registry.version if registry is not None else -1
        cache_key = (str(caller.installation), caller.commit, caller.app, version)
        with self.lock:
            cached = self.cache.get(cache_key)
        if cached is not None:
            return cached
        found = self._resolve(caller, registry)
        with self.lock:
            if len(self.cache) > 512:
                self.cache.clear()
            self.cache[cache_key] = found
        return found

    @staticmethod
    def _resolve(caller: Caller, registry) -> Identity:
        commit = read_commit(caller.installation, caller.commit)
        if commit is None or not bound_to(commit, caller.app):
            return Identity("unverified", "")
        entries = registry.entries_for(caller.app) if registry is not None else []
        for entry in sorted(entries, key=lambda e: e["state"] != "approved"):
            fingerprints = verify_signatures(commit, entry["keyring"])
            approved = [f for f in fingerprints if f in entry["fingerprints"]]
            if approved:
                state = {"approved": "approved", "suspended": "suspended", "revoked": "revoked"}[entry["state"]]
                return Identity(state, entry["owner"], approved[0], entry)
        others = registry.all_keyrings(exclude_app=caller.app) if registry is not None else b""
        fingerprints = verify_signatures(commit, others + trusted_keyrings(caller.installation))
        if fingerprints:
            return Identity("not-approved", f"key:{fingerprints[0]}", fingerprints[0])
        return Identity("unverified", "")
