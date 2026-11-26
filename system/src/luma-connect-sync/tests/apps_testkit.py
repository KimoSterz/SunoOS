# SPDX-License-Identifier: Apache-2.0
"""Test-only keys and signers for the apps API: minisign registries, OpenPGP publisher keys, signed ostree commits.

Every key made or held here is a throwaway test key. None signs anything outside tests.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402



def lp(*parts) -> bytes:
    """crypto.lp (wire format 2), here so the kit runs without python-cryptography's HPKE (the proof host)."""
    out = b""
    for part in parts:
        data = part if isinstance(part, bytes) else str(part).encode()
        out += len(data).to_bytes(4, "big") + data
    return out

# A fixed, public test seed for the registry key (never a production key).
REGISTRY_TEST_SEED = hashlib.sha256(b"luma-sync-apps-registry-TEST-ONLY-v1").digest()
REGISTRY_TEST_KEY_ID = bytes.fromhex("7e57a9905c4e0001")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


# ---------------------------------------------------------------- minisign (prehashed)

def minisign_public(seed: bytes = REGISTRY_TEST_SEED, key_id: bytes = REGISTRY_TEST_KEY_ID) -> str:
    public = Ed25519PrivateKey.from_private_bytes(seed).public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return "untrusted comment: minisign public key " + key_id.hex().upper() + " (TEST ONLY)\n" + \
        base64.b64encode(b"Ed" + key_id + public).decode() + "\n"


def minisign_sign(message: bytes, comment: str, seed: bytes = REGISTRY_TEST_SEED, key_id: bytes = REGISTRY_TEST_KEY_ID) -> bytes:
    key = Ed25519PrivateKey.from_private_bytes(seed)
    signature = key.sign(hashlib.blake2b(message, digest_size=64).digest())
    global_sig = key.sign(signature + comment.encode())
    return ("untrusted comment: signature from the TEST registry key\n" + base64.b64encode(b"ED" + key_id + signature).decode() + "\n"
            + "trusted comment: " + comment + "\n" + base64.b64encode(global_sig).decode() + "\n").encode()


def registry_body(version: int, apps: list[dict], token_keys: list[dict], *, issued_at: int, expires_at: int) -> bytes:
    return json.dumps({"schema": 1, "version": version, "issued_at": issued_at, "expires_at": expires_at, "apps": apps,
                       "tokens": {"issuer": "hub.simplyluma.com", "keys": token_keys}}, indent=1, sort_keys=True).encode()


def month_key(token_id: str, spki_b64: str, now_ms: int) -> dict:
    """The token key of the calendar month ``now_ms`` falls in, valid for the whole month and a day either side."""
    from luma_connect_sync.apps_api import metrics
    slot = metrics.slot_of(now_ms)
    return {"id": token_id, "spki": spki_b64, "slot": slot, "not_before": metrics.month_start_ms(slot) - 86_400_000,
            "not_after": metrics.month_start_ms(metrics.next_slot(slot)) + 86_400_000}


def owner(remote_url: str, fingerprints: list[str]) -> str:
    fprs = sorted({f.upper() for f in fingerprints})
    return "flatpak:" + hashlib.sha256(lp(remote_url.rstrip("/"), *fprs)).hexdigest()[:32]


# ---------------------------------------------------------------- OpenPGP via gpg in a throwaway home

class Gpg:
    def __init__(self, home: Path | None = None) -> None:
        self._tmp = None
        if home is None:
            self._tmp = tempfile.TemporaryDirectory(prefix="luma-sync-test-gpg-")
            home = Path(self._tmp.name)
        self.home = home
        os.chmod(home, 0o700)

    def run(self, *args: str, data: bytes | None = None) -> bytes:
        result = subprocess.run(["gpg", "--homedir", str(self.home), "--batch", "--no-tty", "--pinentry-mode", "loopback",
                                 "--passphrase", "", *args], input=data, capture_output=True, check=False, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"gpg {args}: {result.stderr.decode(errors='replace')}")
        return result.stdout

    def new_key(self, name: str, *, subkey: bool) -> dict:
        """A primary key; with ``subkey`` the primary only certifies and an Ed25519 subkey signs."""
        uid = f"{name} (TEST ONLY) <{name.lower().replace(' ', '-')}@example.invalid>"
        self.run("--quick-gen-key", uid, "ed25519", "cert" if subkey else "sign,cert", "never")
        primary = self.fingerprints(uid)[0]
        if subkey:
            self.run("--quick-add-key", primary, "ed25519", "sign", "never")
        fprs = self.fingerprints(uid)
        return {"uid": uid, "primary": primary, "subkeys": fprs[1:], "key": self.run("--export", primary)}

    def fingerprints(self, who: str) -> list[str]:
        out = self.run("--with-colons", "--list-keys", who).decode()
        return [line.split(":")[9] for line in out.splitlines() if line.startswith("fpr:")]

    def sign(self, primary: str, data: bytes) -> bytes:
        """A binary detached signature (gpg picks the signing subkey when the primary can't sign)."""
        with tempfile.NamedTemporaryFile() as f:
            f.write(data)
            f.flush()
            return self.run("--local-user", primary, "--detach-sign", "--output", "-", f.name)


# ---------------------------------------------------------------- ostree commits and Flatpak installations

def make_commit(app: str, *, ref_binding: bool = True, branch: str = "stable", arch: str = "x86_64") -> bytes:
    """A serialized ostree commit object (a{sv}aya(say)sstayay) naming the app."""
    import gi
    gi.require_version("GLib", "2.0")
    from gi.repository import GLib
    metadata = {"xa.metadata": GLib.Variant("s", f"[Application]\nname={app}\nruntime=org.example.Platform/{arch}/1\n")}
    if ref_binding:
        metadata["ostree.ref-binding"] = GLib.Variant("as", [f"app/{app}/{arch}/{branch}"])
    commit = GLib.Variant("(a{sv}aya(say)sstayay)", (metadata, b"", [], "test commit", "", 1795000000,
                                                       bytes(32), bytes(32)))
    return commit.get_data_as_bytes().get_data()


def commitmeta(signatures: list[bytes]) -> bytes:
    import gi
    gi.require_version("GLib", "2.0")
    from gi.repository import GLib
    value = GLib.Variant("a{sv}", {"ostree.gpgsigs": GLib.Variant("aay", [list(s) for s in signatures])} if signatures else {})
    return value.get_data_as_bytes().get_data()


def install(root: Path, app: str, commit: bytes, signatures: list[bytes], *, trusted_keys: bytes = b"", remote: str = "origin",
            arch: str = "x86_64", branch: str = "stable") -> tuple[Path, str]:
    """A Flatpak installation under ``root`` holding the app at that commit: (app-path, checksum)."""
    checksum = hashlib.sha256(commit).hexdigest()
    objects = root / "repo/objects" / checksum[:2]
    objects.mkdir(parents=True, exist_ok=True)
    (objects / f"{checksum[2:]}.commit").write_bytes(commit)
    if signatures:
        (objects / f"{checksum[2:]}.commitmeta").write_bytes(commitmeta(signatures))
    if trusted_keys:
        (root / "repo" / f"{remote}.trustedkeys.gpg").write_bytes(trusted_keys)
    app_path = root / "app" / app / arch / branch / checksum / "files"
    app_path.mkdir(parents=True, exist_ok=True)
    return app_path, checksum


def flatpak_info(proc_root: Path, pid: int, app: str, app_path: Path, checksum: str) -> None:
    folder = proc_root / str(pid) / "root"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / ".flatpak-info").write_text(f"[Application]\nname={app}\n\n[Instance]\ninstance-id=1\napp-path={app_path}\n"
                                          f"app-commit={checksum}\nbranch=stable\narch=x86_64\n")
    try:
        cgroup = Path(f"/proc/{pid}/cgroup").read_text()
    except OSError:
        cgroup = "0::/\n"
    (proc_root / str(pid) / "cgroup").write_text(cgroup)


class RawRsa:
    """m^d mod n through the system's libcrypto (RSA_NO_PADDING), for the fake Hub's blind signatures.

    Python's pow takes ~20 ms per 2048-bit private operation, and a device asks for 64 tokens a day, so a fake
    Hub in pure Python spends seconds per test signing. ``tokens.blind_sign`` still checks every result.
    ``for_key`` gives None where libcrypto can't be loaded; callers then use the Python form.
    """
    _lib = None
    _keys: dict = {}

    @classmethod
    def for_key(cls, private):
        n = private.public_key().public_numbers().n
        if n not in cls._keys:
            cls._keys[n] = cls._load(private)
        return cls._keys[n]

    @classmethod
    def _crypto(cls):
        if cls._lib is None:
            import ctypes
            import ctypes.util
            lib = ctypes.CDLL(ctypes.util.find_library("crypto") or "libcrypto.so.3")
            V, P, S = ctypes.c_void_p, ctypes.c_char_p, ctypes.c_size_t
            lib.d2i_AutoPrivateKey.restype, lib.d2i_AutoPrivateKey.argtypes = V, [V, ctypes.POINTER(P), ctypes.c_long]
            lib.EVP_PKEY_CTX_new.restype, lib.EVP_PKEY_CTX_new.argtypes = V, [V, V]
            lib.EVP_PKEY_CTX_free.argtypes = [V]
            lib.EVP_PKEY_decrypt_init.argtypes = [V]
            lib.EVP_PKEY_CTX_set_rsa_padding.argtypes = [V, ctypes.c_int]
            lib.EVP_PKEY_decrypt.argtypes = [V, P, ctypes.POINTER(S), P, S]
            cls._lib = lib
        return cls._lib

    @classmethod
    def _load(cls, private):
        import ctypes
        try:
            lib = cls._crypto()
        except (OSError, AttributeError):
            return None
        der = private.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.TraditionalOpenSSL,
                                    serialization.NoEncryption())
        cursor = ctypes.c_char_p(der)
        pkey = lib.d2i_AutoPrivateKey(None, ctypes.byref(cursor), len(der))
        if not pkey:
            return None
        size = (private.key_size + 7) // 8

        def raw(m: bytes) -> bytes:
            ctx = lib.EVP_PKEY_CTX_new(pkey, None)
            if not ctx:
                raise MemoryError("EVP_PKEY_CTX_new")
            try:
                out, length = ctypes.create_string_buffer(size), ctypes.c_size_t(size)
                if (lib.EVP_PKEY_decrypt_init(ctx) != 1 or lib.EVP_PKEY_CTX_set_rsa_padding(ctx, 3) != 1
                        or lib.EVP_PKEY_decrypt(ctx, out, ctypes.byref(length), m, len(m)) != 1):
                    raise ValueError("libcrypto refused the raw RSA operation")
                return out.raw[:length.value].rjust(size, b"\0")
            finally:
                lib.EVP_PKEY_CTX_free(ctx)
        return raw

