#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Writes tests/vectors/: the shared device–Hub vectors of connect-sync-apps-hub.md §8.

    python3 tests/make_apps_vectors.py [out-folder]

Needs gpg and python3-cryptography ≥ 50. Every key it makes is a throwaway
TEST key; the registry key comes from a fixed public seed. Running it again
makes new OpenPGP and RSA keys, so the committed vectors are the reference.
"""
from __future__ import annotations

import base64
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402

import apps_testkit as kit  # noqa: E402
from luma_connect_sync.apps_api.registry import ACCOUNT_CAPS as REG_CAPS  # noqa: E402
from luma_connect_sync.apps_api import tokens as tk  # noqa: E402

ISSUED = 1795000000000
DAY = 86_400_000
REMOTE_A = "https://publisher-a.example.invalid/repo/"
REMOTE_B = "https://publisher-b.example.invalid/repo"
REMOTE_C = "https://publisher-c.example.invalid/flatpak"


def reg_caps() -> dict:
    return dict(REG_CAPS)


def write(path: Path, data: bytes | str | dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, (dict, list)):
        data = json.dumps(data, indent=1, sort_keys=True) + "\n"
    path.write_bytes(data.encode() if isinstance(data, str) else data)


def main(out: Path) -> None:
    old = out / "apps-registry/expected.json"
    if old.is_file():
        # Keep the keys the Hub's tests already use: only what is derived from them is made again.
        expected = json.loads(old.read_text())
        entries = {e["app"]: e for e in json.loads((out / "apps-registry/registry.json").read_text())["apps"]}

        def again(app: str) -> dict:
            fprs = expected["fingerprints"][app]
            return {"primary": fprs["primary"], "subkeys": fprs["subkeys"],
                    "key": base64.urlsafe_b64decode(entries[app]["keys"][0] + "==")}
        a, b, c = again("org.example.Game"), again("org.example.Notes"), again("org.example.Recipes")
    else:
        gpg = kit.Gpg()
        a = gpg.new_key("Publisher A", subkey=True)          # primary certifies, a subkey signs
        b = gpg.new_key("Publisher B", subkey=False)         # the primary signs
        c = gpg.new_key("Publisher C", subkey=True)

    # ------------------------------------------------------------ owners
    owners = {"a": kit.owner(REMOTE_A, [a["primary"]]), "b": kit.owner(REMOTE_B, [b["primary"]]),
              "c": kit.owner(REMOTE_C, [c["primary"]])}
    cases = [
        {"why": "trailing slash removed", "remote_url": REMOTE_A, "fingerprints": [a["primary"]], "owner": owners["a"]},
        {"why": "same without the slash", "remote_url": REMOTE_A.rstrip("/"), "fingerprints": [a["primary"]], "owner": owners["a"]},
        {"why": "lowercase, duplicated and unsorted fingerprints normalise", "remote_url": REMOTE_C,
         "fingerprints": [c["primary"].lower(), c["primary"]], "owner": owners["c"]},
        {"why": "two primaries, sorted", "remote_url": REMOTE_B, "fingerprints": [b["primary"], a["primary"]],
         "owner": kit.owner(REMOTE_B, [a["primary"], b["primary"]])},
        {"why": "a subkey fingerprint is never part of the owner (this owner is NOT publisher A's)", "remote_url": REMOTE_A,
         "fingerprints": [a["primary"], *a["subkeys"]], "owner": kit.owner(REMOTE_A, [a["primary"], *a["subkeys"]]),
         "not_equal_to": owners["a"]},
    ]
    write(out / "owner/cases.json", {"construction": "flatpak: + first 32 hex of SHA-256(lp(remote_url.rstrip('/'), sorted unique "
                                                     "uppercase primary fingerprints…)); lp = 4-byte big-endian length ‖ bytes",
                                     "cases": cases})

    # ------------------------------------------------------------ token key and the registry
    pem = out / "privacy-pass/TEST-ONLY-token-key.pem"
    private = serialization.load_pem_private_key(pem.read_bytes(), None) if pem.is_file() else \
        rsa.generate_private_key(public_exponent=65537, key_size=2048)
    numbers = private.public_key().public_numbers()
    spki = tk.spki_pss(numbers.n, numbers.e)
    kid = tk.key_id(spki)
    # The token key of November 2026 (review N2: one key per UTC month, valid for all of it).
    token_key = {"id": kid.hex(), "spki": kit.b64url(spki), "slot": "2026-11", "not_before": ISSUED - 30 * DAY,
                 "not_after": ISSUED + 60 * DAY}
    limits = {"record_bytes": 100000000, "asset_bytes": 1000000000, "zones": 16, "records": 100000,
              "transit_bytes": 2000000000, "relay_bytes_month": 10000000000, "writes_per_hour": 120,
              "upload_bytes_per_hour": 20000000}
    apps = [
        {"owner": owners["a"], "app": "org.example.Game", "keys": [kit.b64url(a["key"])], "state": "approved", "purge": False,
         "labels": ["library", "saves"], "limits": limits, "changed_at": ISSUED - DAY},
        {"owner": owners["b"], "app": "org.example.Notes", "keys": [kit.b64url(b["key"])], "state": "revoked", "purge": True,
         "labels": ["notes"], "limits": limits, "changed_at": ISSUED - 2 * DAY},
        {"owner": owners["c"], "app": "org.example.Recipes", "keys": [kit.b64url(c["key"])], "state": "suspended", "purge": False,
         "labels": ["recipes"], "limits": {**limits, "record_bytes": 20000000, "writes_per_hour": 30, "upload_bytes_per_hour": 5000000},
         "changed_at": ISSUED - 3 * DAY},
    ]
    reg = out / "apps-registry"
    write(reg / "registry.pub", kit.minisign_public())
    write(reg / "TEST-ONLY-registry-seed.hex", kit.REGISTRY_TEST_SEED.hex() + "\n")
    body = kit.registry_body(412, apps, [token_key], issued_at=ISSUED, expires_at=ISSUED + 14 * DAY)
    write(reg / "registry.json", body)
    write(reg / "registry.json.minisig", kit.minisign_sign(body, "registry:412"))
    bad = reg / "invalid"
    older = kit.registry_body(411, apps, [token_key], issued_at=ISSUED - DAY, expires_at=ISSUED + 13 * DAY)
    write(bad / "older/registry.json", older)
    write(bad / "older/registry.json.minisig", kit.minisign_sign(older, "registry:411"))
    expired = kit.registry_body(413, apps, [token_key], issued_at=ISSUED - 20 * DAY, expires_at=ISSUED - 6 * DAY)
    write(bad / "expired/registry.json", expired)
    write(bad / "expired/registry.json.minisig", kit.minisign_sign(expired, "registry:413"))
    forged = body.replace(b'"state": "revoked"', b'"state": "approved"')
    write(bad / "forged-body/registry.json", forged)
    write(bad / "forged-body/registry.json.minisig", kit.minisign_sign(body, "registry:412"))
    other_seed = hashlib.sha256(b"not the registry key, TEST ONLY").digest()
    write(bad / "wrong-key/registry.json", body)
    write(bad / "wrong-key/registry.json.minisig", kit.minisign_sign(body, "registry:412", seed=other_seed))
    write(bad / "comment-mismatch/registry.json", body)
    write(bad / "comment-mismatch/registry.json.minisig", kit.minisign_sign(body, "registry:999"))
    write(reg / "limits.json", {
        "rule": "limits a reviewer sets; the Hub refuses to publish a value above its cap, a device clamps anything above "
                "the cap to the cap and fills a missing field with the default",
        "defaults": {k: v for k, v in limits.items()},
        "caps": {**{k: v for k, v in reg_caps().items()}},
        "cases": [
            {"why": "lowered rate limits apply", "limits": {"writes_per_hour": 30, "upload_bytes_per_hour": 5000000},
             "hub": "publish", "device": {**limits, "writes_per_hour": 30, "upload_bytes_per_hour": 5000000}},
            {"why": "rate limits can't be raised", "limits": {"writes_per_hour": 121}, "hub": "refuse",
             "device": dict(limits)},
            {"why": "upload rate can't be raised", "limits": {"upload_bytes_per_hour": 20000001}, "hub": "refuse",
             "device": dict(limits)},
            {"why": "zero stops sending without stopping the app", "limits": {"writes_per_hour": 0}, "hub": "publish",
             "device": {**limits, "writes_per_hour": 0}},
            {"why": "storage may be raised up to the account-wide cap", "limits": {"record_bytes": 5000000000}, "hub": "publish",
             "device": {**limits, "record_bytes": 5000000000}},
            {"why": "storage above the account-wide cap", "limits": {"record_bytes": 5000000001}, "hub": "refuse",
             "device": {**limits, "record_bytes": 5000000000}},
            {"why": "negative", "limits": {"zones": -1}, "hub": "refuse", "device": dict(limits)},
        ]})
    write(reg / "expected.json", {
        "version": 412, "now_for_checks": ISSUED + DAY,
        "fingerprints": {"org.example.Game": {"primary": a["primary"], "subkeys": a["subkeys"]},
                         "org.example.Notes": {"primary": b["primary"], "subkeys": b["subkeys"]},
                         "org.example.Recipes": {"primary": c["primary"], "subkeys": c["subkeys"]}},
        "remotes": {"org.example.Game": REMOTE_A, "org.example.Notes": REMOTE_B, "org.example.Recipes": REMOTE_C},
        "invalid": {"older": "refused when 412 was accepted (lower version)", "expired": "refused (expires_at passed)",
                    "forged-body": "refused (signature)", "wrong-key": "refused (key id)",
                    "comment-mismatch": "refused (trusted comment version differs)"}})

    # ------------------------------------------------------------ privacy pass
    pp = out / "privacy-pass"
    write(pp / "TEST-ONLY-token-key.pem", private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                                                serialization.NoEncryption()))
    key = tk.load_key(spki)
    rounds = []
    for _ in range(3):
        request, pending = tk.blind(key, kid)
        response = tk.blind_sign(private, request)
        token = tk.finalize(key, pending, response)
        rounds.append({"token_request": kit.b64url(request), "blind_sig": kit.b64url(response), "token": kit.b64url(token),
                       "token_input": kit.b64url(pending.token_input)})
    good = base64.urlsafe_b64decode(rounds[0]["token"] + "==")
    flipped = bytearray(good)
    flipped[-1] ^= 1
    wrong_digest = good[:34] + hashlib.sha256(b"another challenge").digest() + good[66:]
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    onum = other.public_key().public_numbers()
    ospki = tk.spki_pss(onum.n, onum.e)
    okey = tk.load_key(ospki)
    req, pend = tk.blind(okey, tk.key_id(ospki))
    other_token = tk.finalize(okey, pend, tk.blind_sign(other, req))
    write(pp / "vectors.json", {
        "token_type": 2, "issuer_name": tk.ISSUER, "origin_info": tk.ORIGIN_INFO, "redemption_context": "",
        "challenge": tk.challenge().hex(), "challenge_digest": tk.challenge_digest().hex(),
        "key_id": kid.hex(), "spki": kit.b64url(spki), "spki_algorithm": "id-RSASSA-PSS, SHA-384, MGF1-SHA-384, salt 48",
        "rounds": rounds,
        "invalid_tokens": [
            {"why": "authenticator bit flipped", "token": kit.b64url(bytes(flipped)), "answer": 401},
            {"why": "challenge digest of another challenge", "token": kit.b64url(wrong_digest), "answer": 401},
            {"why": "token type 1", "token": kit.b64url(b"\x00\x01" + good[2:]), "answer": 401},
            {"why": "signed by a key the registry doesn't list", "token": kit.b64url(other_token), "answer": 401},
            {"why": "truncated", "token": kit.b64url(good[:-1]), "answer": 401},
            {"why": "replay of rounds[0] after it was redeemed", "token": rounds[0]["token"], "answer": 409},
        ]})

    # ------------------------------------------------------------ reports (v3, review N1: one randomized number, nothing else)
    report = {"v": 3, "day": "2026-11-23", "owner": owners["a"], "app": "org.example.Game",
              "context": {"class": "tv", "arch": "aarch64", "app_version": "1.4.2", "luma_version": "44.2026w48"},
              "estimate": {"field": "record_bytes", "bucket": 7}}
    minimal = {**report, "context": {**report["context"], "class": "computer", "arch": "x86_64", "app_version": "0",
                                     "luma_version": "44"},
               "estimate": {"field": "reads", "bucket": 0}}

    def variant(why: str, change, answer: int = 400) -> dict:
        body = json.loads(json.dumps(report))
        change(body)
        return {"why": why, "body": body, "answer": answer}
    invalid = [
        variant("v1 (exact usage) is withdrawn", lambda r: r.__setitem__("v", 1)),
        variant("v2 (exact health and reads) is withdrawn", lambda r: r.update(v=2, health={"conflicts": 1}, reads={})),
        variant("exact usage is refused", lambda r: r.__setitem__("usage", {"writes": 37})),
        variant("exact health is refused", lambda r: r.__setitem__("health", {"conflicts": 1})),
        variant("exact reads are refused", lambda r: r.__setitem__("reads", {"FetchChanges": 9})),
        variant("unknown top-level field", lambda r: r.__setitem__("device", "abc")),
        variant("unknown estimate field", lambda r: r["estimate"].__setitem__("field", "zones")),
        variant("bucket out of range", lambda r: r["estimate"].__setitem__("bucket", 16)),
        variant("negative bucket", lambda r: r["estimate"].__setitem__("bucket", -1)),
        variant("float bucket", lambda r: r["estimate"].__setitem__("bucket", 1.5)),
        variant("bad class", lambda r: r["context"].__setitem__("class", "watch")),
        variant("bad arch", lambda r: r["context"].__setitem__("arch", "riscv64")),
        variant("exact nightly id as luma_version", lambda r: r["context"].__setitem__("luma_version", "44.20261124.3")),
        variant("bad app_version", lambda r: r["context"].__setitem__("app_version", "1.0 beta")),
        variant("day too old (today - 8)", lambda r: r.__setitem__("day", "2026-11-16")),
        variant("day in the future", lambda r: r.__setitem__("day", "2026-11-26")),
        variant("unknown app", lambda r: r.__setitem__("app", "org.example.Unknown"), 404),
        variant("app under another owner", lambda r: r.__setitem__("owner", owners["c"]), 404),
    ]
    import math
    k = 16

    def rr(eps: float) -> tuple[float, float]:
        return math.exp(eps) / (math.exp(eps) + k - 1), 1 / (math.exp(eps) + k - 1)
    (p1, q1), (p2, q2) = rr(2.0), rr(4.0)
    p_true = p1 * p2 + (k - 1) * q1 * q2
    q_other = p1 * q2 + q1 * p2 + (k - 2) * q1 * q2
    counts = [0] * k
    counts[3], counts[8] = 300, 120
    for j in range(k):
        counts[j] += 18
    estimate = [round((c - sum(counts) * q_other) / (p_true - q_other), 6) for c in counts]
    write(out / "reports/reports.json", {
        "today_for_checks": "2026-11-24", "valid": [report, minimal], "invalid": invalid,
        "valid_for_revoked_or_suspended": "a report for org.example.Notes or org.example.Recipes is accepted (any state in the registry)",
        "ldp": {"fields": ["record_bytes", "asset_bytes", "records", "assets", "hub_up_bytes", "hub_down_bytes", "writes",
                           "outbox_bytes", "write_calls", "latency_s", "conflicts", "siblings_resolved", "too_many_siblings",
                           "held_writes", "refusals", "errors", "reads"],
                "epsilon_permanent": 2.0, "epsilon_report": 4.0, "buckets": k, "p": round(p_true, 9), "q": round(q_other, 9),
                "bucket_of": [[0, 0], [0.5, 0], [1, 1], [3, 1], [4, 2], [15, 2], [16, 3], [1000, 5], [1000000000000, 15]],
                "estimator_example": {"counts": counts, "estimate": estimate}}})
    write(out / "manifest.json", {
        "made_by": "src/luma-connect-sync/tests/make_apps_vectors.py", "contract": "docs/operations/connect-sync-apps-hub.md",
        "test_only": "every key here is a throwaway test key",
        "files": {"owner/cases.json": "§1 owner derivation", "apps-registry/": "§2 signed registry, its test key, invalid variants",
                  "privacy-pass/": "§5 RFC 9578 type 2 rounds and invalid tokens", "reports/reports.json": "§6 report v3: valid and invalid bodies, the LDP constants and an estimator example"}})
    print(f"wrote {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "vectors")
