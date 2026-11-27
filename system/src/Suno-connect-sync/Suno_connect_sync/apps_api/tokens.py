# SPDX-License-Identifier: Apache-2.0
"""Anonymous report tokens: RFC 9578 type 0x0002 over RFC 9474 blind RSA (ADR-057 §10.5).

RSABSSA-SHA384-PSS-Deterministic: SHA-384, MGF1-SHA-384, a 48-byte salt and
no message randomizer (the token input already carries a random nonce).
The device blinds each token input, the Hub signs the blinded message while
the device authenticates for sync, and the device unblinds and checks the
signature. A redeemed token is a valid signature the Hub never saw, so it
can't be tied to the device that asked for it.

Key consistency: the device blinds only to a token key listed in the
signed app registry and valid now, the same file every device reads, so
the Hub can't hand one device a key of its own and recognise its tokens.
"""
from __future__ import annotations

import hashlib
import math
import secrets
import struct
from dataclasses import dataclass

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

TOKEN_TYPE = 0x0002
ISSUER = "hub.simplyluma.com"
ORIGIN_INFO = "sync-metrics"
NK = 256                       # 2048-bit modulus
SALT = 48
HASH = hashlib.sha384
DAILY = 64


class TokenError(ValueError):
    pass


def challenge(issuer: str = ISSUER, origin_info: str = ORIGIN_INFO, context: bytes = b"") -> bytes:
    """TokenChallenge (RFC 9577 §2.1): type, issuer_name<1..2^16-1>, redemption_context<0..32>, origin_info<0..2^16-1>."""
    issuer_b, origin_b = issuer.encode(), origin_info.encode()
    if not issuer_b or len(context) not in (0, 32):
        raise TokenError("bad challenge")
    return struct.pack(">HH", TOKEN_TYPE, len(issuer_b)) + issuer_b + bytes([len(context)]) + context \
        + struct.pack(">H", len(origin_b)) + origin_b


def challenge_digest(issuer: str = ISSUER) -> bytes:
    return hashlib.sha256(challenge(issuer)).digest()


# DER of the AlgorithmIdentifier RFC 9578 §6.5 requires: id-RSASSA-PSS with SHA-384, MGF1-SHA-384 and a 48-byte salt.
OID_RSASSA_PSS = bytes.fromhex("06092a864886f70d01010a")
PSS_PARAMS = bytes.fromhex(
    "3034"
    "a00f300d06096086480165030402020500"
    "a11c301a06092a864886f70d010108300d06096086480165030402020500"
    "a203020130")


def _der(data: bytes, offset: int) -> tuple[int, int, int]:
    """(tag, start of contents, end of contents) of the DER element at ``offset``."""
    if offset + 2 > len(data):
        raise TokenError("truncated DER")
    tag, first = data[offset], data[offset + 1]
    if first < 0x80:
        length, start = first, offset + 2
    else:
        count = first & 0x7F
        if count == 0 or count > 4 or offset + 2 + count > len(data):
            raise TokenError("bad DER length")
        length, start = int.from_bytes(data[offset + 2:offset + 2 + count], "big"), offset + 2 + count
    if start + length > len(data):
        raise TokenError("truncated DER")
    return tag, start, start + length


def spki_pss(n: int, e: int) -> bytes:
    """The SPKI DER of an RSASSA-PSS (SHA-384) public key, as RFC 9578 publishes it."""
    def tlv(tag: int, body: bytes) -> bytes:
        size = len(body)
        head = bytes([size]) if size < 0x80 else bytes([0x80 | ((size.bit_length() + 7) // 8)]) + size.to_bytes((size.bit_length() + 7) // 8, "big")
        return bytes([tag]) + head + body

    def integer(value: int) -> bytes:
        raw = value.to_bytes((value.bit_length() + 8) // 8, "big")
        return tlv(0x02, raw)
    algorithm = tlv(0x30, OID_RSASSA_PSS + PSS_PARAMS)
    return tlv(0x30, algorithm + tlv(0x03, b"\0" + tlv(0x30, integer(n) + integer(e))))


def load_key(spki: bytes) -> rsa.RSAPublicKey:
    """An RSA-2048 public key from its SPKI DER. The algorithm must be id-RSASSA-PSS with exactly the
    parameters of RSABSSA-SHA384-PSS (RFC 9578 §6.5); a plain rsaEncryption key is refused."""
    tag, start, end = _der(spki, 0)
    if tag != 0x30 or end != len(spki):
        raise TokenError("unreadable token key")
    tag, a_start, a_end = _der(spki, start)
    if tag != 0x30 or spki[a_start:a_end] != OID_RSASSA_PSS + PSS_PARAMS:
        raise TokenError("the token key isn't an RSASSA-PSS SHA-384 key")
    tag, b_start, b_end = _der(spki, a_end)
    if tag != 0x03 or b_end != end or spki[b_start] != 0:
        raise TokenError("unreadable token key")
    tag, s_start, s_end = _der(spki, b_start + 1)
    if tag != 0x30 or s_end != b_end:
        raise TokenError("unreadable token key")
    tag, n_start, n_end = _der(spki, s_start)
    tag2, e_start, e_end = _der(spki, n_end)
    if tag != 0x02 or tag2 != 0x02 or e_end != s_end:
        raise TokenError("unreadable token key")
    n, e = int.from_bytes(spki[n_start:n_end], "big"), int.from_bytes(spki[e_start:e_end], "big")
    try:
        key = rsa.RSAPublicNumbers(e, n).public_key()
    except ValueError as error:
        raise TokenError("unreadable token key") from error
    if not isinstance(key, rsa.RSAPublicKey) or key.key_size != 2048:
        raise TokenError("the token key must be RSA 2048")
    return key


def _i2osp(value: int, length: int) -> bytes:
    return value.to_bytes(length, "big")


def _mgf1(seed: bytes, length: int) -> bytes:
    out = b""
    counter = 0
    while len(out) < length:
        out += HASH(seed + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:length]


def emsa_pss_encode(message: bytes, em_bits: int, salt: bytes) -> bytes:
    """RFC 8017 §9.1.1 with SHA-384 and MGF1-SHA-384."""
    h_len = HASH().digest_size
    em_len = math.ceil(em_bits / 8)
    m_hash = HASH(message).digest()
    if em_len < h_len + len(salt) + 2:
        raise TokenError("encoding error")
    h = HASH(b"\0" * 8 + m_hash + salt).digest()
    db = b"\0" * (em_len - len(salt) - h_len - 2) + b"\x01" + salt
    masked = bytes(a ^ b for a, b in zip(db, _mgf1(h, em_len - h_len - 1)))
    masked = bytes([masked[0] & (0xFF >> (8 * em_len - em_bits))]) + masked[1:]
    return masked + h + b"\xbc"


@dataclass
class Pending:
    token_input: bytes
    inverse: int
    key_id: bytes


def token_input(key_id: bytes, issuer: str = ISSUER) -> bytes:
    return struct.pack(">H", TOKEN_TYPE) + secrets.token_bytes(32) + challenge_digest(issuer) + key_id


def blind(key: rsa.RSAPublicKey, key_id: bytes, issuer: str = ISSUER) -> tuple[bytes, Pending]:
    """(TokenRequest bytes, what Finalize needs). RFC 9474 §4.2 Blind, RFC 9578 §6.1 TokenRequest."""
    numbers = key.public_numbers()
    n, e = numbers.n, numbers.e
    message = token_input(key_id, issuer)
    encoded = emsa_pss_encode(message, n.bit_length() - 1, secrets.token_bytes(SALT))
    m = int.from_bytes(encoded, "big")
    if math.gcd(m, n) != 1:
        raise TokenError("invalid input")
    while True:
        r = secrets.randbelow(n - 1) + 1
        if math.gcd(r, n) == 1:
            break
    inverse = pow(r, -1, n)
    blinded = (m * pow(r, e, n)) % n
    request = struct.pack(">H", TOKEN_TYPE) + key_id[-1:] + _i2osp(blinded, NK)
    return request, Pending(message, inverse, key_id)


def finalize(key: rsa.RSAPublicKey, pending: Pending, blind_signature: bytes) -> bytes:
    """The Token (RFC 9577 §2.2), after checking the unblinded signature (RFC 9474 §4.4 Finalize)."""
    if len(blind_signature) != NK:
        raise TokenError("a blind signature has the wrong length")
    n = key.public_numbers().n
    s = (int.from_bytes(blind_signature, "big") * pending.inverse) % n
    signature = _i2osp(s, NK)
    verify(key, pending.token_input, signature)
    return pending.token_input + signature


def verify(key: rsa.RSAPublicKey, message: bytes, signature: bytes) -> None:
    try:
        key.verify(signature, message, padding.PSS(mgf=padding.MGF1(hashes.SHA384()), salt_length=SALT), hashes.SHA384())
    except InvalidSignature as error:
        raise TokenError("the token's signature doesn't verify") from error


def parse_token(token: bytes) -> tuple[int, bytes, bytes, bytes, bytes]:
    """(type, nonce, challenge digest, key id, authenticator)."""
    if len(token) != 2 + 32 + 32 + 32 + NK:
        raise TokenError("a token has the wrong length")
    kind = struct.unpack(">H", token[:2])[0]
    return kind, token[2:34], token[34:66], token[66:98], token[98:]


# ---------------------------------------------------------------- the issuer's side (the Hub; tests and vectors)

def blind_sign(private: rsa.RSAPrivateKey, request: bytes, raw=None) -> bytes:
    """RFC 9474 §4.3 BlindSign, with the check that the signature opens back to the message.

    ``raw`` (bytes -> bytes, m^d mod n) lets a caller bring a faster RSA primitive (the tests' fake Hub uses
    OpenSSL); the default is the CRT form in Python. Either way the result is checked against m.
    """
    if len(request) != 3 + NK or struct.unpack(">H", request[:2])[0] != TOKEN_TYPE:
        raise TokenError("bad token request")
    numbers = private.private_numbers()
    n, e = numbers.public_numbers.n, numbers.public_numbers.e
    m = int.from_bytes(request[3:], "big")
    if m >= n:
        raise TokenError("bad token request")
    if raw is not None:
        s = int.from_bytes(raw(request[3:]), "big")
    else:
        p, q = numbers.p, numbers.q
        s1, s2 = pow(m, numbers.dmp1, p), pow(m, numbers.dmq1, q)
        s = s2 + q * ((numbers.iqmp * (s1 - s2)) % p)
    if pow(s, e, n) != m:
        raise TokenError("signing failed")
    return _i2osp(s, NK)


def key_id(spki: bytes) -> bytes:
    return hashlib.sha256(spki).digest()
