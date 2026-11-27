# SPDX-License-Identifier: Apache-2.0
"""Connect Sync for apps (ADR-057) against the fake Hub: identity, records, keep-both, assets, leases, the outbox,
the registry gate, suspension and revocation, removal, and hostile apps."""
from __future__ import annotations

import fcntl
import os
import time
import unittest

import apps_testkit as kit
from apps_harness import APP, DAY, REMOTE, AppsBase, value_of
from Suno_connect_sync.apps_api import identity, model
from Suno_connect_sync.apps_api.limits import ApiError


def saved(results: list[dict], name: str | None = None) -> dict:
    return next(r for r in results if name is None or r["name"] == name)


class Records(AppsBase):
    def test_a_save_reaches_the_other_device(self):
        self.ready()
        out = self.a.api.save(self.a.ctx(), "saves", [["slot1", b"level 3", ""]], {})
        self.assertEqual(out[0]["outcome"], "saved")
        self.assertEqual(self.a.ctx().status, "available")
        self.a.sync()
        self.b.sync()
        record = self.b.api.get(self.b.ctx(), "saves", "slot1")
        self.assertEqual(value_of(record), b"level 3")
        self.assertEqual(record["writer"]["name"], "Desktop")
        self.assertFalse(record["writer"]["mine"])
        self.assertTrue(record["writer"]["handle"])
        self.assertNotEqual(record["writer"]["handle"], self.a.dev.hub.device, "a handle never is the device id")
        changes = self.b.api.fetch_changes(self.b.ctx(), "saves", "", 100)
        self.assertEqual([r["name"] for r in changes["records"]], ["slot1"])

    def test_the_hub_sees_ciphertext_and_tags_only(self):
        self.ready()
        canary = b"canary-" + os.urandom(8).hex().encode()
        self.a.api.save(self.a.ctx(), "saves", [["slot-" + canary.decode(), canary, ""]], {})
        self.a.sync()
        everything = self.fake.everything()
        for secret in (canary, APP.encode(), b"saves", self.keys.owner.encode()):
            self.assertNotIn(secret, everything)
        owners = {z["owner"] for acct in self.fake.accounts.values() for z in acct["zones"].values()}
        self.assertTrue(any(o and o.startswith("t") and len(o) == 33 for o in owners), "app zones carry the tag")

    def test_tokens_are_the_apps_and_fetch_is_crash_safe(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s1", b"1", ""], ["s2", b"2", ""]], {})
        first = self.a.api.fetch_changes(self.a.ctx(), "saves", "", 1)
        self.assertTrue(first["more"])
        again = self.a.api.fetch_changes(self.a.ctx(), "saves", "", 1)
        self.assertEqual(first, again, "the store never advances a token itself")
        rest = self.a.api.fetch_changes(self.a.ctx(), "saves", first["token"], 10)
        self.assertEqual([r["name"] for r in rest["records"]], ["s2"])
        with self.assertRaises(ApiError):
            self.a.api.fetch_changes(self.a.ctx(), "saves", "v2.bogus.1", 10)

    def test_changed_is_not_sent_for_a_write_the_app_waited_for(self):
        self.ready()
        self.a.events()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"1", ""]], {})
        self.a.sync()
        self.assertFalse([e for e in self.a.events() if e[1] == "Changed"])
        self.b.events()
        self.b.sync()
        self.assertTrue([e for e in self.b.events() if e[1] == "Changed" and e[2] == "saves"])

    def test_conflict_fail_and_keep_both(self):
        self.ready()
        v1 = self.a.api.save(self.a.ctx(), "saves", [["s", b"one", ""]], {})[0]["record"]["version"]
        self.a.api.save(self.a.ctx(), "saves", [["s", b"two", v1]], {})
        failed = self.a.api.save(self.a.ctx(), "saves", [["s", b"stale", v1]], {"on_conflict": "fail"})[0]
        self.assertEqual(failed["outcome"], "conflict")
        self.assertEqual(value_of(failed["record"]), b"two")
        kept = self.a.api.save(self.a.ctx(), "saves", [["s", b"stale", v1]], {})[0]
        self.assertEqual(kept["outcome"], "kept_both")
        self.assertEqual(len(kept["record"]["siblings"]), 1)

    def test_offline_edits_on_two_devices_keep_both_by_clock(self):
        self.ready()
        v1 = self.a.api.save(self.a.ctx(), "saves", [["s", b"base", ""]], {})[0]["record"]["version"]
        self.a.sync()
        self.b.sync()
        self.b.api.save(self.b.ctx(), "saves", [["s", b"tv", v1]], {})
        time.sleep(0.01)
        self.a.api.save(self.a.ctx(), "saves", [["s", b"desktop", v1]], {})
        self.b.sync()
        self.a.sync()
        self.b.sync()
        for device in (self.a, self.b):
            record = device.api.get(device.ctx(), "saves", "s")
            self.assertEqual(value_of(record), b"desktop", "the newer write by clock is current")
            self.assertEqual([value_of(s) for s in record["siblings"]], [b"tv"])
            self.assertEqual(record["siblings"][0]["writer"]["name"], "Living room TV")
        # The person picks the TV's version; every device converges, and an old base now conflicts.
        record = self.a.api.get(self.a.ctx(), "saves", "s")
        keep = record["siblings"][0]["version"]
        resolved = self.a.api.resolve_siblings(self.a.ctx(), "saves", "s", keep)
        self.assertEqual(resolved["outcome"], "saved")
        self.assertEqual(resolved["record"]["resolved_by"]["name"], "Desktop")
        self.assertEqual(resolved["record"]["writer"]["name"], "Living room TV")
        self.assertNotEqual(resolved["record"]["version"], keep)
        self.a.sync()
        self.b.sync()
        record = self.b.api.get(self.b.ctx(), "saves", "s")
        self.assertEqual((value_of(record), record["siblings"]), (b"tv", []))
        stale = self.b.api.save(self.b.ctx(), "saves", [["s", b"x", keep]], {"on_conflict": "fail"})[0]
        self.assertEqual(stale["outcome"], "conflict")

    def test_a_fifth_version_never_drops_data(self):
        self.ready()
        v1 = self.a.api.save(self.a.ctx(), "saves", [["s", b"0", ""]], {})[0]["record"]["version"]
        self.assertEqual(self.a.api.save(self.a.ctx(), "saves", [["s", b"1", v1]], {})[0]["outcome"], "saved")
        for i in range(3):
            self.assertEqual(self.a.api.save(self.a.ctx(), "saves", [["s", str(i + 2).encode(), v1]], {})[0]["outcome"], "kept_both")
        full = self.a.api.save(self.a.ctx(), "saves", [["s", b"5", v1]], {})[0]
        self.assertEqual(full["outcome"], "too_many_siblings")
        self.assertEqual(len(full["record"]["siblings"]) + 1, 4)

    def test_an_outbox_write_that_would_be_fifth_is_held(self):
        self.ready()
        v1 = self.a.api.save(self.a.ctx(), "saves", [["s", b"0", ""]], {})[0]["record"]["version"]
        self.a.api.save(self.a.ctx(), "saves", [["s", b"1", v1]], {})
        self.a.api.save(self.a.ctx(), "saves", [["s", b"2", v1]], {})            # two versions on the Hub
        self.a.sync()
        self.b.sync()
        self.b.settings["enabled"] = False            # b's write is queued (Sync off on b): three versions here
        out = self.b.api.save(self.b.ctx(), "saves", [["s", b"offline", v1]], {})[0]
        self.assertEqual((out["outcome"], out["record"]["flags"] & 2), ("kept_both", 2), "stale against the mirror, queued")
        # Meanwhile a adds two more versions, so b's queued write would be the fifth when it leaves.
        self.a.api.save(self.a.ctx(), "saves", [["s", b"3", v1]], {})
        self.a.api.save(self.a.ctx(), "saves", [["s", b"4", v1]], {})
        self.a.sync()
        self.b.settings["enabled"] = True
        self.b.events()
        self.b.sync()
        record = self.b.api.get(self.b.ctx(), "saves", "s")
        self.assertTrue(record["flags"] & 4, "held on the device")
        self.assertEqual(len(record["siblings"]) + 1, 5, "the held write is shown with the four others")
        self.assertEqual(self.b.api.get_status(self.b.ctx())["usage"]["held"], 1)
        self.assertTrue([e for e in self.b.events() if e[1] == "Changed"])
        self.b.api.resolve_siblings(self.b.ctx(), "saves", "s", record["version"])
        self.b.sync()
        self.a.sync()
        record = self.a.api.get(self.a.ctx(), "saves", "s")
        self.assertEqual((record["flags"] & 4, record["siblings"]), (0, []))

    def test_a_stale_delete_never_wins(self):
        self.ready()
        v1 = self.a.api.save(self.a.ctx(), "saves", [["s", b"1", ""]], {})[0]["record"]["version"]
        self.a.sync()
        self.b.sync()
        self.b.api.save(self.b.ctx(), "saves", [["s", b"tv edit", v1]], {})
        self.b.sync()
        # a deletes while offline (queued), over the old base
        self.a.settings["enabled"] = False
        out = self.a.api.delete(self.a.ctx(), "saves", [["s", v1]])[0]
        self.assertEqual(out["outcome"], "queued")
        self.a.settings["enabled"] = True
        self.a.events()
        self.a.sync()
        record = self.a.api.get(self.a.ctx(), "saves", "s")
        self.assertEqual(value_of(record), b"tv edit")
        self.assertTrue(record["flags"] & 8, "delete-dropped")
        self.assertTrue([e for e in self.a.events() if e[1] == "Changed"])
        direct = self.b.api.delete(self.b.ctx(), "saves", [["s", v1]])[0]
        self.assertEqual(direct["outcome"], "conflict")

    def test_a_delete_on_the_current_base_clears_the_siblings(self):
        self.ready()
        v1 = self.a.api.save(self.a.ctx(), "saves", [["s", b"1", ""]], {})[0]["record"]["version"]
        top = self.a.api.save(self.a.ctx(), "saves", [["s", b"2", v1]], {})[0]["record"]["version"]
        self.a.api.save(self.a.ctx(), "saves", [["s", b"3", v1]], {})
        top = self.a.api.get(self.a.ctx(), "saves", "s")["version"]
        self.a.sync()
        self.assertEqual(self.a.api.delete(self.a.ctx(), "saves", [["s", top]])[0]["outcome"], "saved")
        self.a.sync()
        self.b.sync()
        self.assertIsNone(self.b.api.get(self.b.ctx(), "saves", "s"))

    def test_a_skewed_clock_cant_label_the_future(self):
        self.ready()
        ahead = self.b.api.wall
        self.b.api.wall = lambda: ahead() + 3600_000
        self.b.api.hlc = model.HLC(None, wall=self.b.api.wall)
        self.b.api.save(self.b.ctx(), "saves", [["s", b"from the future", ""]], {})
        self.b.sync()
        self.a.sync()
        record = self.a.api.get(self.a.ctx(), "saves", "s")
        self.assertLessEqual(record["time_ms"], int(time.time() * 1000) + 61_000)

    def test_coalescing_value_asset_manifest_offline_is_one_version(self):
        self.ready()
        v0 = self.a.api.save(self.a.ctx(), "saves", [["slot", b"v0", ""]], {})[0]["record"]["version"]
        self.a.sync()
        self.a.settings["enabled"] = False
        v1 = self.a.api.save(self.a.ctx(), "saves", [["slot", b"v1", v0]], {})[0]["record"]["version"]
        v2 = self.a.api.put_asset(self.a.ctx(), "saves", "slot", "thumb", self.memfd(b"png"), v1, {})["record"]["version"]
        out = self.a.api.save(self.a.ctx(), "saves", [["slot", b"manifest", v2]], {})[0]
        self.assertEqual(out["outcome"], "queued")
        self.assertEqual(out["record"]["siblings"], [])
        self.a.settings["enabled"] = True
        self.a.sync()
        self.b.sync()
        record = self.b.api.get(self.b.ctx(), "saves", "slot")
        self.assertEqual((value_of(record), record["siblings"], [a["name"] for a in record["assets"]]), (b"manifest", [], ["thumb"]))


class Assets(AppsBase):
    def test_inline_asset_round_trip_sealed(self):
        self.ready()
        data = os.urandom(1_500_000)
        v = self.a.api.save(self.a.ctx(), "saves", [["slot", b"meta", ""]], {})[0]["record"]["version"]
        out = self.a.api.put_asset(self.a.ctx(), "saves", "slot", "state", self.memfd(data), v, {})
        self.assertEqual(out["outcome"], "saved")
        self.assertEqual(out["record"]["assets"], [{"name": "state", "size": len(data), "flags": 2}])
        self.a.sync()
        self.b.sync()
        record = self.b.api.get(self.b.ctx(), "saves", "slot")
        self.assertEqual(record["assets"][0]["flags"] & 2, 2, "fetched with the record")
        state, info, fd = self.b.api.open_asset(self.b.ctx(), "saves", "slot", "state", "")
        self.assertEqual(state, "here")
        try:
            self.assertEqual(os.pread(fd, len(data) + 1, 0), data)
            with self.assertRaises(OSError):
                os.write(fd, b"x")
            need = fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_SEAL
            self.assertEqual(fcntl.fcntl(fd, fcntl.F_GET_SEALS) & need, need)
        finally:
            os.close(fd)
        self.assertNotIn(data[:64], self.fake.everything())
        self.assertEqual(self.b.api.open_asset(self.b.ctx(), "saves", "slot", "nope", "")[0], "gone")
        self.assertEqual(self.b.api.open_asset(self.b.ctx(), "saves", "slot", "state", "0" * 32)[0], "gone")

    def test_remove_asset_frees_its_pieces(self):
        self.ready()
        v = self.a.api.save(self.a.ctx(), "saves", [["slot", b"m", ""]], {})[0]["record"]["version"]
        v = self.a.api.put_asset(self.a.ctx(), "saves", "slot", "big", self.memfd(os.urandom(300_000)), v, {})["record"]["version"]
        self.a.sync()
        blobs = sum(len(z["blobs"]) for acct in self.fake.accounts.values() for z in acct["zones"].values())
        self.assertGreater(blobs, 0)
        stale = self.a.api.remove_asset(self.a.ctx(), "saves", "slot", "big", "f" * 32)
        self.assertEqual(stale["outcome"], "conflict")
        self.assertEqual(self.a.api.remove_asset(self.a.ctx(), "saves", "slot", "big", v)["outcome"], "saved")
        self.a.sync()
        after = sum(len(z["blobs"]) for acct in self.fake.accounts.values() for z in acct["zones"].values()
                    if z.get("owner", "") and z["owner"].startswith("t"))
        self.assertEqual(after, 0)

    def test_on_demand_asset_is_not_here_elsewhere(self):
        self.ready()
        v = self.a.api.save(self.a.ctx(), "saves", [["rom", b"m", ""]], {})[0]["record"]["version"]
        self.a.api.put_asset(self.a.ctx(), "saves", "rom", "image", self.memfd(b"big rom"), v, {"on_demand": True})
        self.a.sync()
        self.b.sync()
        record = self.b.api.get(self.b.ctx(), "saves", "rom")
        self.assertEqual(record["assets"][0]["flags"], 1, "on-demand, not here")
        state, info, fd = self.b.api.open_asset(self.b.ctx(), "saves", "rom", "image", "")
        self.assertEqual((state, fd), ("not-here", None))
        self.assertTrue(info["where"].startswith("On Desktop"))
        for _ in range(3):
            self.b.api.request_asset(self.b.ctx(), "saves", "rom", "image")
        with self.assertRaises(ApiError) as caught:
            self.b.api.request_asset(self.b.ctx(), "saves", "rom", "image")
        self.assertEqual(caught.exception.limit, "rerequests")

    def test_descriptor_tricks_are_refused(self):
        self.ready()
        v = self.a.api.save(self.a.ctx(), "saves", [["slot", b"m", ""]], {})[0]["record"]["version"]
        r, w = os.pipe()
        self.addCleanup(os.close, r)
        self.addCleanup(os.close, w)
        unsealed = self.memfd(b"data", seal=False)
        half = os.memfd_create("h", os.MFD_ALLOW_SEALING)
        self.addCleanup(os.close, half)
        os.write(half, b"x")
        fcntl.fcntl(half, fcntl.F_ADD_SEALS, fcntl.F_SEAL_GROW)
        folder = os.open(str(self.root), os.O_RDONLY | os.O_DIRECTORY)
        self.addCleanup(os.close, folder)
        opath = os.open(str(self.root / "Desktop" / "apps" / "state.sqlite"), os.O_PATH)
        self.addCleanup(os.close, opath)
        for fd in (r, unsealed, half, folder, opath):
            with self.assertRaises(ApiError) as caught:
                self.a.api.put_asset(self.a.ctx(), "saves", "slot", "x", fd, v, {})
            self.assertEqual(caught.exception.kind, "bad_descriptor")
        regular = self.root / "regular.bin"
        regular.write_bytes(b"from a regular file")
        fd = os.open(regular, os.O_RDONLY)
        self.addCleanup(os.close, fd)
        os.lseek(fd, 5, os.SEEK_SET)
        out = self.a.api.put_asset(self.a.ctx(), "saves", "slot", "x", fd, v, {})
        self.assertEqual(out["outcome"], "saved")
        self.assertEqual(os.lseek(fd, 0, os.SEEK_CUR), 5, "the app's offset is untouched")

    def test_asset_caps(self):
        self.ready()
        v = self.a.api.save(self.a.ctx(), "saves", [["slot", b"m", ""]], {})[0]["record"]["version"]
        big = os.memfd_create("big", os.MFD_ALLOW_SEALING)
        self.addCleanup(os.close, big)
        os.ftruncate(big, 64 * 1024 * 1024 + 1)
        fcntl.fcntl(big, fcntl.F_ADD_SEALS, fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK)
        with self.assertRaises(ApiError) as caught:
            self.a.api.put_asset(self.a.ctx(), "saves", "slot", "x", big, v, {})
        self.assertEqual(caught.exception.kind, "too_large")


class Leases(AppsBase):
    def test_lease_take_over_and_read(self):
        self.ready()
        lease = self.b.api.lease(self.b.ctx(), "saves", "slot1", 600, False)
        self.assertTrue(lease["mine"] and lease["active"])
        self.b.sync()
        self.a.sync()
        seen = self.a.api.get_lease(self.a.ctx(), "saves", "slot1")
        self.assertEqual((seen["active"], seen["mine"], seen["holder"]["name"]), (True, False, "Living room TV"))
        refused = self.a.api.lease(self.a.ctx(), "saves", "slot1", 600, False)
        self.assertFalse(refused["mine"])
        taken = self.a.api.lease(self.a.ctx(), "saves", "slot1", 600, True)
        self.assertTrue(taken["mine"])
        released = self.a.api.release(self.a.ctx(), "saves", "slot1")
        self.assertEqual((released["active"], released["until_ms"], released["holder"]), (False, 0, None))
        none = self.a.api.get_lease(self.a.ctx(), "saves", "never")
        self.assertEqual((none["active"], none["until_ms"]), (False, 0))
        with self.assertRaises(ApiError):
            self.a.api.lease(self.a.ctx(), "saves", "slot1", 3601, False)


class Identity(AppsBase):
    def test_approved_from_system_and_user_installations(self):
        for system in (True, False):
            caller = self.a.install(system=system)
            self.a.sync()
            ctx = self.a.api.context(caller)
            self.assertEqual((ctx.ident.state, ctx.owner), ("approved", self.keys.owner))
            self.assertEqual(ctx.ident.fingerprint, self.keys.publisher["primary"], "the subkey signed; the primary is matched")

    def test_lookalike_unsigned_with_gpg_verify_off_is_refused(self):
        self.a.sync()
        caller = self.a.install(signed=False)
        (caller.installation / "repo/config").write_text(f'[remote "games"]\nurl={REMOTE}\ngpg-verify=false\n')
        ctx = self.a.api.context(caller)
        self.assertEqual(ctx.status, "unverified")
        with self.assertRaises(ApiError) as caught:
            self.a.api.save(ctx, "saves", [["s", b"x", ""]], {})
        self.assertEqual(caught.exception.kind, "refused")
        self.assertEqual(list(self.a.api.known_stores()), [], "nothing is stored for an unverified app")

    def test_lookalike_signed_by_another_key_is_not_approved_and_sees_nothing(self):
        self.ready(self.b)
        self.b.api.save(self.b.ctx(), "saves", [["secret", b"real data", ""]], {})
        self.b.sync()
        self.a.sync()
        caller = self.a.install(signer=self.keys.attacker, trusted=self.keys.attacker["key"])
        self.a.allow()
        self.a.sync()
        ctx = self.a.api.context(caller)
        self.assertEqual((ctx.status, ctx.owner), ("not-approved", f"key:{self.keys.attacker['primary']}"))
        self.assertIsNone(self.a.api.get(ctx, "saves", "secret"))
        self.assertEqual(self.a.api.save(ctx, "saves", [["secret", b"overwrite", ""]], {})[0]["outcome"], "queued")
        self.a.sync()
        self.b.sync()
        self.assertEqual(value_of(self.b.api.get(self.b.ctx(), "saves", "secret")), b"real data")

    def test_keyless_bundle_and_unbound_commits_are_unverified(self):
        self.a.sync()
        self.assertEqual(self.a.api.context(self.a.install(signed=False)).status, "unverified")
        self.assertEqual(self.a.api.context(self.a.install(bound_app="org.example.Other")).status, "unverified")
        tampered = self.a.install()
        path = tampered.installation / "repo/objects" / tampered.commit[:2] / f"{tampered.commit[2:]}.commit"
        path.write_bytes(path.read_bytes() + b"\0")
        self.a.api.resolver.cache.clear()
        self.assertEqual(self.a.api.context(tampered).status, "unverified")

    def test_key_removed_from_the_registry_stops_at_the_next_refresh(self):
        self.ready(self.a)
        self.assertEqual(self.a.ctx().status, "available")
        self.publish([self.entry(keys=[kit.b64url(self.keys.other["key"])])])
        self.a.sync()                                  # not due yet: still the old registry
        self.assertEqual(self.a.ctx().status, "available")
        self.refresh(self.a)
        self.a.sync()
        self.assertEqual(self.a.ctx().status, "not-approved")

    def test_the_wait_hint_names_a_new_registry(self):
        self.ready(self.a)
        self.publish([self.entry(state="suspended")])
        answer = self.a.dev.hub.get(f"wait?after=0&timeout=1&registry={self.a.api.registry.version}")
        self.assertEqual(answer["registry"], self.version)
        self.a.cycle.hint = answer["registry"]
        self.a.sync()
        self.assertEqual(self.a.ctx().status, "suspended")

    def test_caller_checks(self):
        import tempfile
        from pathlib import Path
        caller = self.a.install()
        proc = Path(tempfile.mkdtemp(dir=self.root))
        pidfd = os.pidfd_open(os.getpid())
        self.addCleanup(os.close, pidfd)
        kit.flatpak_info(proc, os.getpid(), APP, caller.app_path, caller.commit)
        roots = [caller.installation]
        ok = identity.resolve_caller(APP, "flatpak", pidfd, ":1.5", proc=proc, roots=roots)
        self.assertEqual((ok.app, ok.commit), (APP, caller.commit))
        for app, kind, roots_ in ((APP, "host", roots), ("org.example.Spoof", "flatpak", roots), ("", "flatpak", roots),
                                  ("not an id", "flatpak", roots), (APP, "flatpak", [self.root / "elsewhere"])):
            with self.subTest(app=app, kind=kind), self.assertRaises(ApiError):
                identity.resolve_caller(app, kind, pidfd, ":1.5", proc=proc, roots=roots_)
        child = os.fork()
        if child == 0:
            os._exit(0)
        dead = os.pidfd_open(child)
        os.waitpid(child, 0)
        self.addCleanup(os.close, dead)
        with self.assertRaises(ApiError):
            identity.resolve_caller(APP, "flatpak", dead, ":1.5", proc=proc, roots=roots)


class Gate(AppsBase):
    def test_unapproved_app_queues_and_never_reaches_the_hub(self):
        self.publish([])
        self.refresh()
        self.a.install()
        self.a.allow()
        self.a.sync()
        ctx = self.a.ctx()
        self.assertEqual(ctx.status, "not-approved")
        self.assertEqual(self.a.api.save(ctx, "saves", [["s", b"x", ""]], {})[0]["outcome"], "queued")
        self.a.sync()
        self.assertFalse(any((z.get("owner") or "").startswith("t") for acct in self.fake.accounts.values() for z in acct["zones"].values()))
        # Approval later: the queued write leaves.
        self.publish()
        self.refresh()
        self.a.sync()
        self.b.install()
        self.b.allow()
        self.b.sync()
        self.assertEqual(value_of(self.b.api.get(self.b.ctx(), "saves", "s")), b"x")

    def test_a_label_Suno_has_not_approved_queues(self):
        self.ready(self.a)
        self.assertEqual(self.a.api.zone_status(self.a.ctx(), "telemetry"), "not-approved")
        self.assertEqual(self.a.api.save(self.a.ctx(), "telemetry", [["s", b"x", ""]], {})[0]["outcome"], "queued")
        self.a.sync()
        self.assertEqual(self.a.api.get_status(self.a.ctx())["zones"]["telemetry"], "not-approved")

    def test_forged_old_and_expired_registries(self):
        self.ready(self.a)
        good = self.a.api.registry.version
        body = self.registry_body.replace(b'"approved"', b'"approved" ')
        self.fake.registry_files = (body, self.fake.registry_files[1])
        self.refresh(self.a)
        self.a.sync()
        self.assertEqual(self.a.api.registry.version, good, "a forged registry is refused, the old one kept")
        self.publish(expires_in=-1)
        self.refresh(self.a)
        self.a.sync()
        self.assertEqual(self.a.api.registry.version, good)
        # The kept registry expires: every app is not approved, and writes queue.
        self.a.api.wall = lambda: int(time.time() * 1000) + 15 * DAY
        self.assertEqual(self.a.ctx().status, "not-approved")
        self.assertEqual(self.a.api.save(self.a.ctx(), "saves", [["s", b"q", ""]], {})[0]["outcome"], "queued")

    def test_permission_offer_and_off(self):
        offered = []
        self.a.api.offer = lambda app, owner: offered.append(app)
        self.a.install()
        self.a.sync()
        self.assertEqual(self.a.ctx().status, "offered")
        self.a.ctx()
        self.assertEqual(offered, [APP], "one quiet offer")
        self.assertEqual(self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})[0]["outcome"], "queued")
        self.a.permissions.set("Suno", "sync", APP, ["off"])
        self.assertEqual(self.a.ctx().status, "not-allowed")
        self.a.allow()
        self.a.settings["enabled"] = False
        self.assertEqual(self.a.ctx().status, "off")


class Stopping(AppsBase):
    def test_revoked_mid_sync_drops_the_outbox_and_purges(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["kept", b"synced", ""]], {})
        self.a.sync()
        self.b.sync()
        self.a.settings["enabled"] = False
        self.a.api.save(self.a.ctx(), "saves", [["queued", b"never leaves", ""]], {})
        self.a.settings["enabled"] = True
        self.publish([self.entry(state="revoked", purge=True)])
        self.refresh()
        self.a.sync()
        ctx = self.a.ctx()
        self.assertEqual(ctx.status, "revoked")
        self.assertIsNone(self.a.api.get(ctx, "saves", "queued"), "the outbox was dropped")
        local = self.a.api.save(ctx, "saves", [["paused", b"local", ""]], {})[0]
        self.assertEqual(local["outcome"], "local")
        self.assertTrue(local["record"]["flags"] & 64, "LOCAL_ONLY")
        lease = self.a.api.lease(ctx, "saves", "paused", 60, False)
        self.assertTrue(lease["mine"])
        self.b.sync()
        self.assertTrue(any((z.get("owner") or "").startswith("t") for acct in self.fake.accounts.values() for z in acct["zones"].values()),
                        "one registry listing the purge stops the app but deletes nothing")
        self.publish([self.entry(state="revoked", purge=True)], issued_offset=13 * 3_600_000)
        self.later(13 * 3_600_000)          # and this device saw the purge listed 13 hours ago (review N4)
        self.refresh()
        self.a.sync()
        self.b.sync()
        self.assertFalse(any((z.get("owner") or "").startswith("t") for acct in self.fake.accounts.values() for z in acct["zones"].values()),
                         "every app zone is gone from the Hub")
        self.assertIsNone(self.b.api.get(self.b.ctx(), "saves", "kept"))
        self.assertEqual(value_of(self.a.api.get(self.a.ctx(), "saves", "paused")), b"local", "a purge never takes LOCAL_ONLY data")
        # A new approval offers what was written while revoked.
        self.publish()
        self.refresh()
        self.a.sync()
        self.a.sync()
        self.b.sync()
        self.assertEqual(value_of(self.b.api.get(self.b.ctx(), "saves", "paused")), b"local")
        self.assertFalse(self.a.api.get(self.a.ctx(), "saves", "paused")["flags"] & 64)

    def test_suspend_write_resume_keeps_both(self):
        self.ready()
        v1 = self.a.api.save(self.a.ctx(), "saves", [["slot", b"base", ""]], {})[0]["record"]["version"]
        self.a.sync()
        self.b.sync()
        self.publish([self.entry(state="suspended")])
        self.refresh(self.a)
        self.a.sync()
        self.assertEqual(self.a.ctx().status, "suspended")
        self.b.api.save(self.b.ctx(), "saves", [["slot", b"tv while a was paused", v1]], {})
        self.b.sync()
        v2 = self.a.api.save(self.a.ctx(), "saves", [["slot", b"desktop paused", v1]], {})[0]
        self.assertEqual(v2["outcome"], "local")
        v3 = self.a.api.put_asset(self.a.ctx(), "saves", "slot", "thumb", self.memfd(b"img"), v2["record"]["version"], {})
        self.assertEqual(v3["outcome"], "local")
        self.publish()
        self.refresh(self.a)
        self.a.sync()
        self.a.sync()
        self.b.sync()
        for device in (self.a, self.b):
            record = device.api.get(device.ctx(), "saves", "slot")
            values = sorted([value_of(record)] + [value_of(s) for s in record["siblings"]])
            self.assertEqual(values, [b"desktop paused", b"tv while a was paused"], "keep-both, one version from the pause")

    def test_reoffer_waits_for_room(self):
        self.ready(self.a)
        self.publish([self.entry(state="suspended")])
        self.refresh(self.a)
        self.a.sync()
        for i in range(3):
            self.a.api.save(self.a.ctx(), "saves", [[f"s{i}", b"x", ""]], {})
        self.publish([self.entry(limits={"records": 2})])
        self.refresh(self.a)
        self.a.sync()
        status = self.a.api.get_status(self.a.ctx())
        self.assertEqual(status["usage"]["reoffer_waiting"], "records")


class Hostile(AppsBase):
    def test_malformed_and_oversize_calls(self):
        self.ready(self.a)
        ctx = self.a.ctx()
        cases = [("Saves", [["s", b"", ""]]), ("saves", [["x" * 256, b"", ""]]), ("saves", [["s", b"v" * (256 * 1024 + 1), ""]]),
                 ("saves", [["s", b"", "nope"]]), ("saves", [["a\x00b", b"", ""]]), ("saves", [[f"r{i}", b"", ""] for i in range(101)]),
                 ("saves", []), ("saves", [["s", b"", ""], ["s", b"", ""]]), ("saves", [["s", "text", ""]])]
        for label, records in cases:
            with self.subTest(label=label, n=len(records)), self.assertRaises(ApiError) as caught:
                self.a.api.save(ctx, label, records, {})
            self.assertIn(caught.exception.kind, ("invalid", "too_large"))

    def test_another_app_cannot_reach_this_apps_zones(self):
        self.ready(self.a)
        self.a.api.save(self.a.ctx(), "saves", [["s", b"mine", ""]], {})
        self.publish([self.entry(), self.entry(owner=self.keys.other_owner, app="org.example.Thief",
                                               keys=[kit.b64url(self.keys.other["key"])])])
        self.refresh(self.a)
        self.a.install("org.example.Thief", signer=self.keys.other)
        self.a.allow("org.example.Thief")
        self.a.sync()
        thief = self.a.ctx("org.example.Thief")
        self.assertEqual(thief.status, "available")
        self.assertIsNone(self.a.api.get(thief, "saves", "s"))
        self.a.api.save(thief, "saves", [["s", b"overwrite", ""]], {})
        self.a.sync()
        self.assertEqual(value_of(self.a.api.get(self.a.ctx(), "saves", "s")), b"mine")

    def test_flooding_the_quota_and_the_rate(self):
        self.publish([self.entry(limits={"records": 3, "writes_per_hour": 0})])
        self.ready(self.a)
        ctx = self.a.ctx()
        self.a.api.save(ctx, "saves", [["r1", b"", ""], ["r2", b"", ""], ["r3", b"", ""]], {})
        with self.assertRaises(ApiError) as caught:
            self.a.api.save(ctx, "saves", [["r4", b"", ""]], {})
        self.assertEqual((caught.exception.kind, caught.exception.limit), ("quota", "records"))
        self.a.sync()
        status = self.a.api.get_status(self.a.ctx())
        self.assertEqual(status["usage"]["limited_by"], "rate_writes", "over the lowered rate, writes wait in the outbox")
        from Suno_connect_sync.apps_api.limits import MAX_QUEUED_CALLS
        gate = self.a.api.gate
        key = ctx.store.key
        for _ in range(MAX_QUEUED_CALLS):
            gate.enter(key)
        with self.assertRaises(ApiError) as caught:
            gate.enter(key)
        self.assertEqual(caught.exception.limit, "in_flight")

    def test_the_hub_refuses_a_tag_over_its_ceiling(self):
        self.fake.app_ceiling["records"] = 1
        self.ready(self.a)
        self.a.api.save(self.a.ctx(), "saves", [["r1", b"", ""], ["r2", b"", ""]], {})
        self.a.sync()
        self.assertEqual(self.a.api.get_status(self.a.ctx())["usage"]["limited_by"], "app_records")


class Removal(AppsBase):
    def test_uninstall_drops_the_local_copy_and_keeps_the_zone(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.sync()
        del self.a.installed[APP]
        self.a.sync()
        self.a.sync()                       # removal needs two cycles without the app (review L7)
        self.assertEqual(self.a.api.known_stores(), [])
        record = self.a.api.directory.get(self.keys.owner, APP)
        self.assertFalse(record["devices"][self.a.dev.hub.device]["on"])
        self.b.sync()
        self.assertEqual(value_of(self.b.api.get(self.b.ctx(), "saves", "s")), b"x")

    def test_delete_zone_goes_to_the_bin_and_can_be_restored(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.sync()
        self.b.sync()
        self.b.api.delete_zone(self.b.ctx(), "saves")
        self.assertIsNone(self.b.api.get(self.b.ctx(), "saves", "s"))
        self.b.sync()
        self.a.sync()
        self.assertIsNone(self.a.api.get(self.a.ctx(), "saves", "s"), "every device stops showing it")
        record = self.a.api.directory.get(self.keys.owner, APP)
        self.assertEqual(record["zones"]["saves"]["bin"]["0"]["state"], "bin")
        self.a.cycle.restore_zone(self.keys.owner, APP, "saves", 0)
        self.a.sync()
        self.b.sync()
        self.assertEqual(value_of(self.b.api.get(self.b.ctx(), "saves", "s")), b"x")

    def test_delete_synced_data_from_settings(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.sync()
        self.a.cycle.delete_synced(self.keys.owner, APP)
        self.b.sync()
        self.assertIsNone(self.b.api.get(self.b.ctx(), "saves", "s"))
        self.assertFalse(any((z.get("owner") or "").startswith("t") for acct in self.fake.accounts.values() for z in acct["zones"].values()))


if __name__ == "__main__":
    unittest.main()
