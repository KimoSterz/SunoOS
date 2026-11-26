# SPDX-License-Identifier: Apache-2.0
"""Opening files strictly beneath a directory descriptor (review H2, M8).

openat2(2) with RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS where the kernel has it (5.6 and
later); otherwise a single-component openat with O_NOFOLLOW, which is equivalent for the plain names the callers
pass (they never contain "/"). Either way no path leaves the directory and no symlink is followed.
"""
from __future__ import annotations

import ctypes
import ctypes.util
import errno
import os
import re
import stat

SYS_OPENAT2 = 437                  # the same number on x86_64 and aarch64
RESOLVE_NO_MAGICLINKS = 0x02
RESOLVE_NO_SYMLINKS = 0x04
RESOLVE_BENEATH = 0x08
NAME = re.compile(r"[0-9A-Za-z][0-9A-Za-z._-]{0,127}")


class _OpenHow(ctypes.Structure):
    _fields_ = [("flags", ctypes.c_uint64), ("mode", ctypes.c_uint64), ("resolve", ctypes.c_uint64)]


_libc = ctypes.CDLL(ctypes.util.find_library("c") or "libc.so.6", use_errno=True)
_libc.syscall.restype = ctypes.c_long
_have_openat2: bool | None = None


def check_name(name: str) -> str:
    if not isinstance(name, str) or not NAME.fullmatch(name) or name in (".", ".."):
        raise ValueError("not a plain file name")
    return name


def open_beneath(dir_fd: int, name: str, flags: int, mode: int = 0o600) -> int:
    """A descriptor for ``name`` directly beneath ``dir_fd``; OSError (ELOOP, EXDEV, ENOENT…) otherwise."""
    global _have_openat2
    check_name(name)
    flags |= os.O_CLOEXEC | os.O_NOFOLLOW
    if _have_openat2 is not False:
        how = _OpenHow(flags, mode if flags & os.O_CREAT else 0, RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS)
        fd = _libc.syscall(SYS_OPENAT2, dir_fd, name.encode(), ctypes.byref(how), ctypes.sizeof(how))
        if fd >= 0:
            _have_openat2 = True
            return int(fd)
        err = ctypes.get_errno()
        if err in (errno.ENOSYS, errno.EPERM) and _have_openat2 is None:
            _have_openat2 = False            # an old kernel or a seccomp filter: fall back below
        else:
            raise OSError(err, os.strerror(err), name)
    return os.open(name, flags, mode, dir_fd=dir_fd)


def open_dir(path: str | os.PathLike) -> int:
    return os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW)


def read_regular(dir_fd: int, relative: str, limit: int) -> bytes | None:
    """At most ``limit`` bytes of a regular file reached component by component beneath ``dir_fd`` without following
    any symlink; None when anything on the way is missing, a link, or not a regular file."""
    fd = os.dup(dir_fd)
    try:
        parts = [p for p in relative.split("/") if p]
        for index, part in enumerate(parts):
            last = index == len(parts) - 1
            try:
                child = open_beneath(fd, part, os.O_RDONLY | (os.O_NONBLOCK if last else os.O_DIRECTORY))
            except (OSError, ValueError):
                return None
            os.close(fd)
            fd = child
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            return None
        out = b""
        while len(out) < limit:
            chunk = os.read(fd, min(65536, limit - len(out)))
            if not chunk:
                break
            out += chunk
        return out
    finally:
        os.close(fd)
