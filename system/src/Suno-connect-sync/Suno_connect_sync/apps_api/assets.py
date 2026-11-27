# SPDX-License-Identifier: Apache-2.0
"""Asset bytes: taking them from an app, keeping them, sealing them for the Hub, handing them back (ADR-057 §3.4, §5.3).

- In: the app passes a descriptor. It must be a sealed memfd (write, grow and
  shrink sealed) or a regular file that isn't on FUSE. The service copies it
  with ``pread`` into its own file, with a size cap and a deadline, hashing
  the copy as it goes; it never opens a path the app names. A regular file
  that changes while it is copied is refused.
- Up: the copy is cut into 1 MiB pieces, each sealed under the zone key with a
  random per-asset salt in front, so an asset's pieces are its own and can
  be deleted with it. Small assets are padded to their Padmé length, at
  least 1 KiB; large ones get random filler pieces up to Padmé(size).
- Out: ``OpenAsset`` answers a private copy reopened read-only (a sealed
  memfd up to 4 MiB, else an unnamed file on the store's disk), never a
  descriptor of the service's own files. Copies count against the app's
  open-copy cap until no process of the app holds them in two scans in a
  row; then the service drops its own reference, which frees the space when
  nothing else holds the copy (review N9, final review).
"""
from __future__ import annotations

import ctypes
import ctypes.util
import fcntl
import hashlib
import os
import secrets
import stat
import threading
import time
from pathlib import Path

from .. import crypto
from . import beneath
from .limits import COPY_DEADLINE, ApiError

PIECE = 1024 * 1024
SALT = 16
FUSE_SUPER_MAGIC = 0x65735546
SEALS_NEEDED = fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK
RESERVE = 256 * 1024 * 1024        # free space the spool always leaves on the disk


class _StatFS(ctypes.Structure):
    _fields_ = [("f_type", ctypes.c_long), ("f_bsize", ctypes.c_long), ("f_blocks", ctypes.c_ulong), ("f_bfree", ctypes.c_ulong),
                ("f_bavail", ctypes.c_ulong), ("f_files", ctypes.c_ulong), ("f_ffree", ctypes.c_ulong), ("f_fsid", ctypes.c_int * 2),
                ("f_namelen", ctypes.c_long), ("f_frsize", ctypes.c_long), ("f_flags", ctypes.c_long), ("f_spare", ctypes.c_long * 4)]


_libc = ctypes.CDLL(ctypes.util.find_library("c") or "libc.so.6", use_errno=True)


def fs_type(fd: int) -> int:
    buf = _StatFS()
    if _libc.fstatfs(fd, ctypes.byref(buf)) != 0:
        raise ApiError("bad_descriptor", "The asset's descriptor can't be examined.")
    return buf.f_type & 0xFFFFFFFF


def seals(fd: int) -> int | None:
    try:
        return fcntl.fcntl(fd, fcntl.F_GET_SEALS)
    except OSError:
        return None


def sealed(fd: int) -> bool:
    """Sealed against writes, growth and shrinking: its bytes can't change, so no change check is needed."""
    current = seals(fd)
    return current is not None and current & SEALS_NEEDED == SEALS_NEEDED


def check_descriptor(fd: int) -> os.stat_result:
    """A sealed memfd or a regular file outside FUSE, readable; anything else is refused before any work.

    Every shmem file answers F_GET_SEALS. A memfd that can still be sealed (F_SEAL_SEAL not set) must be sealed
    first. A plain tmpfs file (/tmp, /dev/shm, XDG_RUNTIME_DIR) reports F_SEAL_SEAL and nothing else, as does a
    memfd made without sealing: those are copied like any regular file, with the change check."""
    try:
        info = os.fstat(fd)
        flags = fcntl.fcntl(fd, fcntl.F_GETFL)
    except OSError as error:
        raise ApiError("bad_descriptor", "The asset's descriptor isn't usable.") from error
    if not stat.S_ISREG(info.st_mode):
        raise ApiError("bad_descriptor", "An asset must be a sealed memfd or a regular file.")
    if flags & getattr(os, "O_PATH", 0o10000000) or (flags & os.O_ACCMODE) not in (os.O_RDONLY, os.O_RDWR):
        raise ApiError("bad_descriptor", "The asset's descriptor can't be read.")
    current = seals(fd)
    if current is not None:
        if current & SEALS_NEEDED == SEALS_NEEDED:
            return info
        if not current & fcntl.F_SEAL_SEAL:
            raise ApiError("bad_descriptor", "A memfd must be sealed against writes, growth and shrinking.")
    if fs_type(fd) == FUSE_SUPER_MAGIC:
        raise ApiError("bad_descriptor", "An asset can't be a file on FUSE.")
    return info


def size_of(fd: int) -> int:
    """The descriptor's size after the checks, before any copy (quotas are checked against it first, review L1)."""
    return check_descriptor(fd).st_size


def _write_all(out: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        view = view[os.write(out, view):]


def copy_in(fd: int, store, asset: str, cap: int, deadline: float = COPY_DEADLINE) -> tuple[int, str]:
    """Copy the descriptor's bytes into the store's file for ``asset``: (size, sha256). The app's offset is untouched."""
    info = check_descriptor(fd)
    if info.st_size > cap:
        raise ApiError("too_large", "The asset is larger than allowed.", "")
    room = os.statvfs(store.folder)
    if room.f_bavail * room.f_frsize < info.st_size + RESERVE:
        raise ApiError("quota", "There isn't room on this device for the asset.", "")
    fixed = sealed(fd)
    started = time.monotonic()
    digest = hashlib.sha256()
    size = 0
    name = store.file_name(asset)
    tmp = name + ".part"
    folder = store.files_fd()
    try:
        out = beneath.open_beneath(folder, tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
        try:
            while True:
                if time.monotonic() - started > deadline:
                    raise ApiError("timed_out", "Copying the asset took too long.")
                chunk = os.pread(fd, PIECE, size)
                if not chunk:
                    break
                size += len(chunk)
                if size > cap:
                    raise ApiError("too_large", "The asset is larger than allowed.")
                digest.update(chunk)
                _write_all(out, chunk)
            os.fsync(out)
            after = os.fstat(fd)
            if not fixed and (after.st_size != size or after.st_mtime_ns != info.st_mtime_ns or after.st_size != info.st_size):
                raise ApiError("bad_descriptor", "The asset changed while it was copied.")
        except BaseException:
            os.close(out)
            store.unlink(tmp)
            raise
        os.close(out)
        os.replace(tmp, name, src_dir_fd=folder, dst_dir_fd=folder)
    finally:
        os.close(folder)
    return size, digest.hexdigest()


SMALL_COPY = 4 * 1024 * 1024     # copies up to this size are sealed memfds; larger ones are private files on disk (M9)


def private_copy(store, asset: str) -> tuple[int, int]:
    """(read-only descriptor for the app, the service's own reference) of a private copy of the asset (§3.4).

    Up to 4 MiB: a memfd sealed against writes, growth and shrinking. Larger: an unnamed file (O_TMPFILE) on the
    store's disk, a reflink where the filesystem has them, so open copies don't sit in memory (review M9). The
    service keeps one reference per copy until the app has let go of it (OpenCopies); it never truncates a copy, so
    a holder it can't see never reads short data or faults on a mapping.
    """
    source = store.open_file(asset, os.O_RDONLY)
    try:
        size = os.fstat(source).st_size
        if size <= SMALL_COPY:
            fd = os.memfd_create("Suno-sync-asset", os.MFD_CLOEXEC | os.MFD_ALLOW_SEALING)
            try:
                os.sendfile(fd, source, 0, size) if size else None
                fcntl.fcntl(fd, fcntl.F_ADD_SEALS, SEALS_NEEDED | fcntl.F_SEAL_SEAL)
                return os.open(f"/proc/self/fd/{fd}", os.O_RDONLY | os.O_CLOEXEC), fd
            except BaseException:
                os.close(fd)
                raise
        fd = os.open(store.folder, os.O_RDWR | os.O_TMPFILE | os.O_CLOEXEC, 0o400)
        try:
            try:
                fcntl.ioctl(fd, 0x40049409, source)          # FICLONE: share the blocks, copy on write
            except OSError:
                done = 0
                while done < size:
                    sent = os.sendfile(fd, source, done, min(size - done, 1 << 30))
                    if sent <= 0:
                        break
                    done += sent
            return os.open(f"/proc/self/fd/{fd}", os.O_RDONLY | os.O_CLOEXEC), fd
        except BaseException:
            os.close(fd)
            raise
    finally:
        os.close(source)


def scope_of(pid: int) -> str | None:
    """The cgroup a process runs in, from /proc/<pid>/cgroup; None when unreadable."""
    try:
        for line in Path(f"/proc/{pid}/cgroup").read_text().splitlines():
            if line.startswith("0::/"):
                return line[3:]
    except (OSError, ValueError):
        pass
    return None


def app_scopes(app: str, scope: str) -> list[str]:
    """Every cgroup the app runs in next to ``scope``: Flatpak starts each instance and each sub-sandbox in its own
    app-flatpak-<app id>-<pid>.scope in the same slice. ``scope`` itself is always included."""
    out = {scope}
    slice_path = scope.rsplit("/", 1)[0] if "/" in scope.strip("/") else ""
    escaped = app.replace("-", "\\x2d")
    try:
        names = os.listdir(f"/sys/fs/cgroup{slice_path}")
    except OSError:
        return sorted(out)
    for name in names:
        for form in (app, escaped):
            prefix = f"app-flatpak-{form}-"
            if name.startswith(prefix) and name.endswith(".scope") and name[len(prefix):-6].isdigit():
                out.add(f"{slice_path}/{name}")
    return sorted(out)


def held_in(scope: str) -> tuple[set[tuple[int, int]], set[int]]:
    """What the processes of a cgroup hold: (device, inode) of every open descriptor, and the inodes of every
    file mapping (/proc/<pid>/maps names a mapping's device differently from stat on some filesystems, so only
    its inode is compared: a collision keeps a copy counted longer, never drops one in use)."""
    fds: set[tuple[int, int]] = set()
    maps: set[int] = set()
    try:
        pids = Path(f"/sys/fs/cgroup{scope}/cgroup.procs").read_text().split()
    except OSError:
        return fds, maps
    for pid in pids:
        try:
            names = os.listdir(f"/proc/{pid}/fd")
        except OSError:
            continue
        for name in names:
            try:
                st = os.stat(f"/proc/{pid}/fd/{name}")
                fds.add((st.st_dev, st.st_ino))
            except OSError:
                continue
        try:
            with open(f"/proc/{pid}/maps", "rb") as f:
                for line in f:
                    parts = line.split(None, 5)
                    if len(parts) >= 5 and parts[4] != b"0":
                        maps.add(int(parts[4]))
        except (OSError, ValueError):
            continue
    return fds, maps


class OpenCopies:
    """Private copies an app holds open, per app (review N9, final review).

    A copy counts against its app's cap from the moment it is made until two scans in a row, at least GAP seconds
    apart, find no descriptor or mapping of it in any cgroup of the app: every instance's and sub-sandbox's
    app-flatpak-<app id>-<pid>.scope, found next to the caller's scope, which is read through the caller's pidfd.
    Two misses cover a descriptor in transit between two processes during one scan. Then the service drops its own
    reference: the space is freed when nothing else holds the copy, and a holder it couldn't see keeps valid
    bytes (never truncated data or a faulting mapping). A copy younger than GRACE is always counted: the reply
    carrying it may still be on its way. One copy may always be open, whatever its size; more only within ``cap``
    bytes and ``count``.

    What remains: a descriptor the app hands to a process outside its own cgroups keeps its copy's space after the
    service drops its reference, and that copy no longer counts against the cap; the hourly OPEN_BYTES budget still
    bounds how much an app can open.
    """
    GRACE = 120.0
    GAP = 20.0

    def __init__(self, cap: int, count: int, *, scopes=app_scopes, held_in=held_in, clock=time.monotonic) -> None:
        self.cap, self.count = cap, count
        self.scopes, self.held_in, self.clock = scopes, held_in, clock
        self.copies: dict[str, list[dict]] = {}
        self.lock = threading.Lock()

    def bytes(self, key: str) -> int:
        with self.lock:
            return sum(c["size"] for c in self.copies.get(key, []))

    def tracked(self) -> bool:
        with self.lock:
            return any(self.copies.values())

    def reclaim(self, key: str | None = None) -> int:
        """Drop the copies no process of their app held in two scans in a row; the bytes no longer counted."""
        dropped = 0
        with self.lock:
            keys = [key] if key is not None else list(self.copies)
            now = self.clock()
            for k in keys:
                kept = []
                seen: dict[tuple[str, str], tuple[set, set]] = {}
                for copy in self.copies.get(k, []):
                    if now - copy["made"] < self.GRACE:
                        kept.append(copy)
                        continue
                    where = (copy["app"], copy["scope"])
                    if where not in seen:
                        fds: set = set()
                        maps: set = set()
                        for scope in self.scopes(copy["app"], copy["scope"]):
                            more_fds, more_maps = self.held_in(scope)
                            fds |= more_fds
                            maps |= more_maps
                        seen[where] = (fds, maps)
                    fds, maps = seen[where]
                    if (copy["dev"], copy["ino"]) in fds or copy["ino"] in maps:
                        copy["missed"], copy["missed_at"] = 0, 0.0
                        kept.append(copy)
                        continue
                    if copy["missed"] and now - copy["missed_at"] < self.GAP:
                        kept.append(copy)           # too soon after the last miss to count as a second scan
                        continue
                    copy["missed"] += 1
                    copy["missed_at"] = now
                    if copy["missed"] < 2:
                        kept.append(copy)
                        continue
                    os.close(copy["fd"])
                    dropped += copy["size"]
                if kept:
                    self.copies[k] = kept
                else:
                    self.copies.pop(k, None)
        return dropped

    def admit(self, key: str, scope: str, size: int) -> None:
        """Raises unless one more copy of ``size`` bytes fits: the ``open_bytes`` refusal, or ``failed`` when the
        caller's cgroup couldn't be read through its pidfd."""
        if not scope:
            raise ApiError("failed", "The app's processes couldn't be found to hand it a copy.")
        for attempt in (0, 1):
            with self.lock:
                held = self.copies.get(key, [])
                fits = not held or (len(held) < self.count and sum(c["size"] for c in held) + size <= self.cap)
            if fits:
                return
            if attempt == 0:
                self.reclaim(key)
        raise ApiError("rate_limited", "This app holds too many open asset copies; close some first.", "open_bytes")

    def track(self, key: str, app: str, scope: str, fd: int) -> None:
        st = os.fstat(fd)
        with self.lock:
            self.copies.setdefault(key, []).append({"fd": fd, "app": app, "scope": scope, "dev": st.st_dev,
                                                    "ino": st.st_ino, "size": st.st_size, "made": self.clock(),
                                                    "missed": 0, "missed_at": 0.0})

    def forget(self, key: str) -> None:
        with self.lock:
            for copy in self.copies.pop(key, []):
                os.close(copy["fd"])        # the app's descriptors stay valid; the cap just stops counting them


# ---------------------------------------------------------------- pieces

def piece_plan(size: int) -> tuple[int, int, int]:
    """(real pieces, filler pieces, padded plaintext length per piece)."""
    if size <= PIECE:
        return 1, 0, SALT + max(1024, crypto.padme(max(size, 1)))
    real = (size + PIECE - 1) // PIECE
    total = (crypto.padme(size) + PIECE - 1) // PIECE
    return real, max(0, total - real), SALT + PIECE


def upload(engine, zone: str, store, asset: str, size: int, salt: bytes) -> tuple[list[str], list[str], int]:
    """Seal and upload an asset's pieces: (piece ids, filler ids, bytes sent)."""
    real, fillers, pad_to = piece_plan(size)
    ids, filler_ids, sent = [], [], 0
    source = store.open_file(asset, os.O_RDONLY)
    try:
        for index in range(real):
            data = salt + os.pread(source, PIECE, index * PIECE)
            blob, _gen, sealed = engine.seal_blob(zone, data, pad_to)
            if blob in engine.missing(zone, [blob]):
                engine.upload(zone, blob, sealed)
                sent += len(sealed)
            ids.append(blob)
    finally:
        os.close(source)
    for _ in range(fillers):
        data = secrets.token_bytes(SALT + 32)
        blob, _gen, sealed = engine.seal_blob(zone, data, pad_to)
        engine.upload(zone, blob, sealed)
        sent += len(sealed)
        filler_ids.append(blob)
    return ids, filler_ids, sent


def download(engine, zone: str, entry: dict, store) -> int:
    """Fetch, check and assemble an asset's pieces into the store's file for its id; the bytes received."""
    salt = crypto.unb64(entry["salt"])
    name = store.file_name(entry["id"])
    tmp = name + ".part"
    digest = hashlib.sha256()
    received = written = 0
    folder = store.files_fd()
    try:
        out = beneath.open_beneath(folder, tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC)
        try:
            for blob in entry.get("p") or []:
                data = engine.get_blob(zone, blob)
                received += len(data)
                if not data.startswith(salt):
                    raise ValueError("an asset piece belongs to another asset")
                chunk = data[SALT:]
                written += len(chunk)
                if written > int(entry["s"]):
                    raise ValueError("an asset is larger than its entry says")
                digest.update(chunk)
                _write_all(out, chunk)
            os.fsync(out)
        finally:
            os.close(out)
        if digest.hexdigest() != entry["h"] or written != int(entry["s"]):
            store.unlink(tmp)
            raise ValueError("an asset didn't match its hash")
        os.replace(tmp, name, src_dir_fd=folder, dst_dir_fd=folder)
    except BaseException:
        store.unlink(tmp)
        raise
    finally:
        os.close(folder)
    return received
