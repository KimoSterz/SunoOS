# SPDX-License-Identifier: Apache-2.0
"""Regression tests for the adversarial review of Connect Sync for apps (connect-sync-apps-review-20261125.md).
One class per finding; each test failed on 463b4440."""
from __future__ import annotations

import fcntl
import json
import os
import random
import stat
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

import apps_testkit as kit
from apps_harness import APP, DAY, AppsBase, Keys, value_of
from Suno_connect_sync.apps_api import api as api_mod
from Suno_connect_sync.apps_api import assets as asset_io
from Suno_connect_sync.apps_api import beneath, identity, metrics, model
from Suno_connect_sync.apps_api import registry as reg
from Suno_connect_sync.apps_api.limits import MAX_QUEUED_CALLS, ApiError, CallGate


class C1ReportsCarryNothingTheHubSees(AppsBase):
    def test_no_exact_count_and_one_randomized_bucket(self):
        self.ready()
        for i in range(37):
            self.a.api.save(self.a.ctx(), "saves", [[f"s{i}", b"x" * 1000, ""]], {})
        self.a.api.fetch_changes(self.a.ctx(), "saves", "")
        self.a.sync()
        day = metrics.today()
        body = self.a.api.metrics.report_body(day, self.keys.owner, APP)
        self.assertEqual(body["v"], 3)
        self.assertEqual(set(body), {"v", "day", "owner", "app", "context", "estimate"}, "no health, reads or usage (N1)")
        self.assertEqual(set(body["estimate"]), {"field", "bucket"})
        self.assertIn(body["estimate"]["field"], metrics.LDP_FIELDS)
        self.assertTrue(0 <= body["estimate"]["bucket"] < metrics.LDP_BUCKETS)

    def test_every_echo_of_a_sync_event_is_a_randomized_field(self):
        for field in ("reads", "conflicts", "refusals", "errors", "writes", "write_calls"):
            self.assertIn(field, metrics.LDP_FIELDS)
        data = metrics.empty()
        data["usage"]["calls"] = {"FetchChanges": 9, "Subscribe": 2, "Save": 4}
        data["health"]["refusals"] = {"records": 3, "rate_writes": 1}
        data["health"]["errors"] = {"quota": 2}
        data["health"]["conflicts"] = 5
        truth = metrics.Metrics.truth(data)
        self.assertEqual((truth["reads"], truth["write_calls"], truth["refusals"], truth["errors"], truth["conflicts"]),
                         (11, 4, 4, 2, 5))

    def test_two_layer_randomized_response_is_unbiased(self):
        rng = random.Random(7)
        truth = [3] * 6000 + [8] * 2000                 # 75 % of reports in bucket 3, 25 % in bucket 8
        counts = [0] * metrics.LDP_BUCKETS
        for bucket in truth:
            kept = metrics.randomized_response(bucket, metrics.LDP_EPSILON, rng)
            counts[metrics.randomized_response(kept, metrics.LDP_EPSILON_REPORT, rng)] += 1
        estimate = metrics.ldp_estimate(counts)
        self.assertAlmostEqual(estimate[3] / len(truth), 0.75, delta=0.06)
        self.assertAlmostEqual(estimate[8] / len(truth), 0.25, delta=0.06)
        p, q = metrics.rr_probabilities(metrics.LDP_EPSILON)
        self.assertAlmostEqual(p / q, metrics.math.exp(metrics.LDP_EPSILON))
        p2, q2 = metrics.ldp_channel()
        self.assertAlmostEqual(p2 + (metrics.LDP_BUCKETS - 1) * q2, 1.0)
        self.assertLess(p2 / q2, metrics.math.exp(metrics.LDP_EPSILON), "the second layer only adds noise")

    def test_buckets_are_coarse(self):
        self.assertEqual([metrics.ldp_bucket(v) for v in (0, 1, 3, 4, 15, 16, 1000, 10**12)], [0, 1, 1, 2, 2, 3, 5, 15])

    def test_values_below_one_are_bucket_zero(self):
        self.assertEqual([metrics.ldp_bucket(v) for v in (0, 0.1, 0.999, -5, float("nan"))], [0, 0, 0, 0, 0])

    def test_Suno_version_is_coarse(self):
        self.assertEqual(metrics.coarse_version("44.20261124.3"), "44.2026w48")
        self.assertEqual(metrics.coarse_version("44"), "44")
        self.assertEqual(metrics.coarse_version("weird/../"), "0")


class H1OffIsNotAbandoned(AppsBase):
    def test_an_app_switched_off_for_31_days_keeps_its_data(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"keep me", ""]], {})
        self.a.sync()
        self.b.sync()
        self.a.cycle.set_enabled(self.keys.owner, APP, False)
        later = lambda: int(time.time() * 1000) + 31 * DAY  # noqa: E731
        for device in (self.a, self.b):
            device.api.wall = later
        self.publish(expires_in=60 * DAY)
        self.refresh()
        self.a.sync()
        self.b.sync()
        self.assertTrue(any((z.get("owner") or "").startswith("t") for acct in self.fake.accounts.values() for z in acct["zones"].values()),
                        "nothing was purged")

    def test_installed_is_refreshed_whatever_the_sync_state(self):
        self.ready(self.a)
        self.a.ctx()
        self.a.sync()
        self.a.permissions.set("Suno", "sync", APP, ["off"])
        record = self.a.api.directory.get(self.keys.owner, APP)
        before = record["devices"][self.a.dev.hub.device]["t"]
        self.a.api.wall = lambda: int(time.time() * 1000) + 2 * DAY
        self.a.sync()
        record = self.a.api.directory.get(self.keys.owner, APP)
        self.assertGreater(record["devices"][self.a.dev.hub.device]["t"], before)
        self.assertTrue(record["devices"][self.a.dev.hub.device]["on"])

    def test_installed_nowhere_for_31_days_is_abandoned(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.sync()
        self.b.sync()
        for device in (self.a, self.b):
            del device.installed[APP]
            device.sync()
            device.sync()                            # two cycles without it (review L7)
        later = lambda: int(time.time() * 1000) + 31 * DAY  # noqa: E731
        self.a.api.wall = later
        self.publish(expires_in=60 * DAY)
        self.refresh(self.a)
        self.a.sync()
        self.assertFalse(any((z.get("owner") or "").startswith("t") for acct in self.fake.accounts.values() for z in acct["zones"].values()))


class H2AssetIdsAreNeverPaths(AppsBase):
    def test_a_member_device_cant_write_outside_the_store(self):
        from Suno_connect_sync.apps_api import directory as dirmod
        self.ready()
        v = self.b.api.save(self.b.ctx(), "saves", [["slot", b"m", ""]], {})[0]["record"]["version"]
        self.b.api.put_asset(self.b.ctx(), "saves", "slot", "x", self.memfd(b"payload"), v, {})
        self.b.sync()
        # b turns hostile: it writes the record again, straight to the Hub, with a path for the asset's id.
        zone = self.b.dev.engine.zone(dirmod.zone_label(self.keys.owner, APP, "saves"), create=False)["zone"]
        row = self.b.ctx().store.row("saves", "slot")
        hostile = json.loads(json.dumps(row["hub"]))
        escape = self.root / "escaped"
        hostile[0]["a"]["x"]["id"] = os.path.relpath(escape, self.a.ctx().store.folder / "files")
        saved, *_ = self.b.dev.engine.write(zone, "slot", model.record_body(hostile), row["hub_version"], pad=True)
        self.assertTrue(saved)
        self.a.sync()
        self.assertFalse(escape.exists(), "nothing written outside the store")
        self.assertIsNone(self.a.api.get(self.a.ctx(), "saves", "slot"), "the forged version is dropped")
        self.assertFalse(model.parse_record(model.record_body(hostile)))

    def test_malformed_asset_fields_drop_the_version(self):
        good = {"i": "a" * 32, "v": "", "w": "dev", "t": 1, "c": 0, "x": [],
                "a": {"n": {"id": "b" * 32, "s": 3, "h": "c" * 64, "salt": "A" * 22, "o": False, "p": ["d" * 64], "f": []}}}
        self.assertEqual(len(model.parse_record({"k": 1, "vs": [good]})), 1)
        for change in ({"s": -1}, {"h": "zz"}, {"salt": "../x"}, {"p": ["../" + "d" * 61]}, {"id": "B" * 32}, {"o": "yes"}):
            bad = json.loads(json.dumps(good))
            bad["a"]["n"].update(change)
            self.assertEqual(model.parse_record({"k": 1, "vs": [bad]}), [], change)
        for name in ("a\x00b", "x" * 256):
            bad = json.loads(json.dumps(good))
            bad["a"] = {name: good["a"]["n"]}
            self.assertEqual(model.parse_record({"k": 1, "vs": [bad]}), [], repr(name))

    def test_a_symlink_in_the_store_is_never_followed(self):
        self.ready(self.a)
        store = self.a.ctx().store
        target = self.root / "outside"
        target.write_bytes(b"secret")
        os.symlink(target, store.folder / "files" / ("e" * 32))
        store.add_file("e" * 32, 6, "0" * 64, "cache")
        self.assertIsNone(store.file("e" * 32))
        with self.assertRaises(OSError):
            store.open_file("e" * 32)


class N2TokenKeyCalendar(AppsBase):
    """One token key per UTC month; no key for this month, or two, or a different one than first seen: no reports."""
    def setUp(self):
        super().setUp()
        self.ready(self.a)
        self.now = int(time.time() * 1000)
        self.key = dict(self.a.api.registry.current().tokens["keys"][0])

    def snapshot(self, keys):
        snap = self.a.api.registry.current()
        snap.tokens = {"issuer": "hub.simplyluma.com", "keys": keys}
        return snap

    def test_the_current_months_key_is_used(self):
        self.assertEqual(self.key["slot"], metrics.slot_of(self.now))
        self.assertEqual(self.a.api.metrics.slot_key(self.snapshot([self.key]))["id"], self.key["id"])
        self.assertEqual(self.a.api.metrics.tokens_today(), 64)

    def test_a_stale_registry_without_this_months_key_sends_nothing(self):
        last_month = {**self.key, "slot": metrics.slot_of(metrics.month_start_ms(self.key["slot"]) - DAY)}
        self.assertIsNone(self.a.api.metrics.slot_key(self.snapshot([last_month])))
        self.a.api.metrics.db.execute("DELETE FROM kv WHERE key='tokens_day'")
        self.a.api.metrics.db.execute("DELETE FROM tokens")
        self.fake.issued.clear()
        self.assertEqual(self.a.api.metrics.fetch_tokens(self.a.dev.hub, self.snapshot([last_month])), 0)
        self.assertEqual(self.fake.issued, {}, "not even asked")

    def test_two_keys_for_the_month_or_a_short_key_send_nothing(self):
        two = [self.key, {**self.key, "id": "e" * 64}]
        self.assertIsNone(self.a.api.metrics.slot_key(self.snapshot(two)))
        short = {**self.key, "not_after": metrics.month_start_ms(self.key["slot"]) + 3 * DAY}
        self.assertIsNone(self.a.api.metrics.slot_key(self.snapshot([short])))
        late = {**self.key, "not_before": metrics.month_start_ms(self.key["slot"]) + DAY}
        self.assertIsNone(self.a.api.metrics.slot_key(self.snapshot([late])))

    def test_another_key_for_a_month_already_seen_is_a_split_view(self):
        self.assertIsNotNone(self.a.api.metrics.slot_key(self.snapshot([self.key])))
        other = {**self.key, "id": "d" * 64}
        self.assertIsNone(self.a.api.metrics.slot_key(self.snapshot([other])))

    def test_tokens_under_another_key_are_never_spent(self):
        m = self.a.api.metrics
        m.db.execute("UPDATE tokens SET key_id=?", ("c" * 64,))
        self.assertIsNone(m._take_token(self.a.api.registry.current()))
        self.assertEqual(m.tokens_today(), 0, "dropped, not sent")


class N5LongOfflineDeviceReportsAgain(AppsBase):
    def test_a_device_back_after_months_uses_the_current_key(self):
        self.ready(self.a)
        m = self.a.api.metrics
        m._put_kv("token_slots", {"2026-01": "f" * 64})          # the last key it used, long expired
        m._put_kv("token_key_last", {"id": "f" * 64, "not_after": 1})
        m.db.execute("DELETE FROM kv WHERE key='tokens_day'")
        m.db.execute("DELETE FROM tokens")
        self.fake.issued.clear()
        self.assertEqual(m.fetch_tokens(self.a.dev.hub, self.a.api.registry.current()), 64)


class N1ReportsOffUnlessSunoTurnsThemOn(AppsBase):
    def test_no_reports_and_no_tokens_without_the_switch(self):
        self.a.reports = False
        self.ready(self.a)
        m = self.a.api.metrics
        self.assertEqual({k for k in self.fake.issued if k[0] == self.a.dev.hub.device}, set(), "no tokens are even asked for")
        m._put_kv("reports_through", "2026-01-01")
        self.a.sync()
        self.assertEqual(m.db.execute("SELECT COUNT(*) FROM reports WHERE state='due'").fetchone()[0], 0)
        self.assertEqual(m.send_one(metrics.today(), self.keys.owner, APP, self.a.api.registry.current()), "off")

    def test_turning_reports_off_stops_those_waiting(self):
        self.ready(self.a)
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        m = self.a.api.metrics
        m._put_kv("reports_through", (metrics.datetime.now(metrics.timezone.utc) - metrics.timedelta(days=3)).strftime("%Y-%m-%d"))
        self.a.sync()
        self.assertGreater(m.db.execute("SELECT COUNT(*) FROM reports WHERE state='due'").fetchone()[0], 0)
        self.a.reports = False
        self.a.sync()
        self.assertEqual(m.db.execute("SELECT COUNT(*) FROM reports WHERE state='due'").fetchone()[0], 0)

    def test_a_hub_not_collecting_gets_nothing_that_day(self):
        self.fake.collecting = False
        self.ready(self.a)
        m = self.a.api.metrics
        self.assertEqual(m.tokens_today(), 0)
        self.assertFalse(m.enabled(), "the Hub said {collecting: false}: off for the rest of the day")
        self.fake.collecting = True
        self.a.sync()
        self.assertEqual(m.tokens_today(), 0, "not asked again today")

    def test_a_report_answered_collecting_false_stops_the_rest(self):
        self.ready(self.a)
        m = self.a.api.metrics
        m.db.execute("INSERT INTO reports VALUES(?,?,?,?,?,0)", ("2026-11-20", self.keys.owner, APP, time.time() - 60, "due"))
        m.db.execute("INSERT INTO reports VALUES(?,?,?,?,?,0)", ("2026-11-21", self.keys.owner, APP, time.time() - 60, "due"))
        self.fake.collecting = False
        self.assertEqual(m.send_one("2026-11-20", self.keys.owner, APP, self.a.api.registry.current()), "off")
        self.assertEqual(m.db.execute("SELECT COUNT(*) FROM reports WHERE state='due'").fetchone()[0], 0)

    def test_the_switch_is_a_root_owned_config_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "Suno-connect-sync"
            folder.mkdir(mode=0o755)
            path = folder / "config.json"
            self.assertFalse(metrics.reports_switch((path,)), "no file: off")
            path.write_text(json.dumps({"apps": {"reports": True}}))
            path.chmod(0o644)
            self.assertEqual(metrics.reports_switch((path,)), os.getuid() == 0, "on only when root owns it")
            path.chmod(0o666)
            self.assertFalse(metrics.reports_switch((path,)), "anyone can write it: off")
            path.chmod(0o644)
            path.write_text(json.dumps({"apps": {"reports": "yes"}}))
            self.assertFalse(metrics.reports_switch((path,)), "only true turns it on")


class N1PresenceSaysNothing(AppsBase):
    def test_every_installed_approved_app_reports_every_day_whether_it_ran_or_not(self):
        self.ready(self.a)                                          # installed and allowed; it never even called
        m = self.a.api.metrics
        self.assertEqual(self.a.api.known_stores(), [])
        three_days_ago = (metrics.datetime.now(metrics.timezone.utc) - metrics.timedelta(days=3)).strftime("%Y-%m-%d")
        m._put_kv("reports_through", three_days_ago)
        self.a.sync()
        days = sorted(r[0] for r in m.db.execute("SELECT day FROM reports WHERE app=? AND state='due'", (APP,)).fetchall())
        self.assertEqual(len(days), 2, "yesterday and the day before, with no counters for either")
        self.a.sync()
        self.assertEqual(m.db.execute("SELECT COUNT(*) FROM reports").fetchone()[0], 2, "each day once")

    def test_an_app_switched_off_here_isnt_reported(self):
        self.ready(self.a)
        self.a.cycle.set_enabled(self.keys.owner, APP, False)
        m = self.a.api.metrics
        m.db.execute("DELETE FROM reports")
        m._put_kv("reports_through", (metrics.datetime.now(metrics.timezone.utc) - metrics.timedelta(days=3)).strftime("%Y-%m-%d"))
        self.a.sync()
        self.assertEqual(m.db.execute("SELECT COUNT(*) FROM reports").fetchone()[0], 0)

    def test_the_app_version_doesnt_say_whether_it_ran(self):
        self.ready(self.a)
        m = self.a.api.metrics
        m.context(self.keys.owner, APP, "2.0")
        m.db.execute("DELETE FROM counters")
        self.assertEqual(m.report_body("2026-11-02", self.keys.owner, APP)["context"]["app_version"], "2.0")


class _FixedRng:
    def __init__(self, index: int, draw: float) -> None:
        self.index, self.draw = index, draw

    def randrange(self, n: int) -> int:
        return self.index % n

    def random(self) -> float:
        return self.draw


class N1Memoized(AppsBase):
    def test_the_field_and_its_response_are_fixed_for_the_month(self):
        self.ready(self.a)
        m = self.a.api.metrics
        fields = {m.report_body(f"2026-11-{d:02d}", self.keys.owner, APP)["estimate"]["field"] for d in range(1, 29)}
        self.assertEqual(len(fields), 1, "one field all month")
        self.assertEqual(m.db.execute("SELECT COUNT(*) FROM memo").fetchone()[0], 1, "one permanent response spent")

    def test_a_value_seen_before_reuses_its_response(self):
        self.ready(self.a)
        m = self.a.api.metrics
        field_index = metrics.LDP_FIELDS.index("records")
        first = m._monthly("2026-10-03", self.keys.owner, APP, _FixedRng(field_index, 0.999))
        second = m._monthly("2026-11-03", self.keys.owner, APP, _FixedRng(field_index, 0.0))
        self.assertEqual(first, second, "the same (field, bucket) in a later month: the kept response, not a new draw")
        self.assertEqual(m.db.execute("SELECT COUNT(*) FROM memo").fetchone()[0], 1)

    def test_a_change_mid_month_neither_spends_nor_shows(self):
        self.ready(self.a)
        m = self.a.api.metrics
        index = metrics.LDP_FIELDS.index("records")
        before = m._monthly("2026-11-03", self.keys.owner, APP, _FixedRng(index, 0.0))
        m.db.execute("INSERT OR REPLACE INTO counters VALUES(?,?,?,?)", ("2026-11-04", self.keys.owner, APP,
                     json.dumps({**metrics.empty(), "usage": {**metrics.empty()["usage"], "records": 5000}})))
        after = m._monthly("2026-11-04", self.keys.owner, APP, _FixedRng(index, 0.0))
        self.assertEqual(before, after)
        self.assertEqual(m.db.execute("SELECT COUNT(*) FROM memo").fetchone()[0], 1)

    def test_each_report_rerandomizes_the_kept_response(self):
        self.ready(self.a)
        m = self.a.api.metrics
        _field, kept = m._monthly("2026-11-03", self.keys.owner, APP, random.Random(1))
        seen = [m.report_body("2026-11-03", self.keys.owner, APP)["estimate"]["bucket"] for _ in range(400)]
        p2, _q2 = metrics.rr_probabilities(metrics.LDP_EPSILON_REPORT)
        self.assertAlmostEqual(seen.count(kept) / len(seen), p2, delta=0.08)
        self.assertGreater(len(set(seen)), 3)


class M2ReportsSpreadOut(AppsBase):
    def test_overdue_reports_are_rescheduled_not_sent_together(self):
        self.ready(self.a)
        m = self.a.api.metrics
        for app in ("org.example.One", "org.example.Two", "org.example.Three"):
            m.db.execute("INSERT INTO reports VALUES(?,?,?,?,?,0)", ("2026-11-20", self.keys.owner, app, time.time() - 7200, "due"))
        self.assertEqual(m.due(), [])
        dues = [r[0] for r in m.db.execute("SELECT due FROM reports").fetchall()]
        self.assertTrue(all(d > time.time() for d in dues))
        self.assertGreater(max(dues) - min(dues), 1, "each gets its own time")


class M6OneBadEntryDoesntFreezeTheRegistry(unittest.TestCase):
    def test_bad_entries_and_keys_are_skipped(self):
        body = json.loads((Path(__file__).parent / "vectors/apps-registry/registry.json").read_text())
        body["apps"].append({"owner": "not an owner", "app": "x", "state": "approved"})
        body["apps"][1]["keys"] = ["AAAA"]          # the revoked entry's key is unreadable: the revocation still holds
        body["tokens"]["keys"].append({"id": "nope"})
        snap = reg.parse(json.dumps(body).encode())
        self.assertEqual(len(snap.apps), 3)
        notes = snap.entries_for("org.example.Notes")[0]
        self.assertEqual((notes["state"], notes["purge"], notes["fingerprints"]), ("revoked", True, frozenset()))
        self.assertEqual(len(snap.tokens["keys"]), 1)


class M7Load(AppsBase):
    def test_the_gate_refuses_before_any_work(self):
        gate = CallGate()
        for _ in range(MAX_QUEUED_CALLS):
            gate.enter("k")
        with self.assertRaises(ApiError) as caught:
            gate.enter("k")
        self.assertEqual(caught.exception.limit, "in_flight")

    def test_usage_totals_match_a_full_count(self):
        self.ready()
        rng = random.Random(3)
        ctx = self.a.ctx()
        versions = {}
        for i in range(60):
            name = f"r{rng.randrange(15)}"
            if rng.random() < 0.2 and name in versions:
                self.a.api.delete(ctx, "saves", [[name, versions.pop(name)]])
            else:
                out = self.a.api.save(ctx, "saves", [[name, os.urandom(rng.randrange(1, 3000)), versions.get(name, "")]], {})[0]
                versions[name] = out["record"]["version"]
        self.a.sync()
        store = ctx.store
        fast = store.usage()
        store.recount()
        self.assertEqual(fast, store.usage())

    def test_seen_is_not_written_on_every_call(self):
        self.ready(self.a)
        store = self.a.ctx().store
        first = store.meta("seen")
        self.a.ctx()
        self.assertEqual(store.meta("seen"), first)


class M8MetainfoIsReadSafely(AppsBase):
    def test_a_link_to_dev_zero_or_a_fifo_is_not_read(self):
        caller = self.a.install()
        folder = caller.app_path / "share/metainfo"
        folder.mkdir(parents=True)
        os.symlink("/dev/zero", folder / f"{APP}.metainfo.xml")
        os.mkfifo(folder / f"{APP}.appdata.xml")
        started = time.monotonic()
        self.assertEqual(api_mod.app_version(caller), "0")
        self.assertLess(time.monotonic() - started, 2)


class M9OpenCopies(AppsBase):
    def test_a_large_asset_opens_as_a_private_file_not_memory(self):
        self.ready(self.a)
        v = self.a.api.save(self.a.ctx(), "saves", [["slot", b"m", ""]], {})[0]["record"]["version"]
        big = os.urandom(5 * 1024 * 1024)
        self.a.api.put_asset(self.a.ctx(), "saves", "slot", "big", self.memfd(big), v, {})
        state, _info, fd = self.a.api.open_asset(self.a.ctx(), "saves", "slot", "big", "")
        try:
            self.assertEqual(state, "here")
            # Not a memfd (a tmpfs O_TMPFILE file answers F_GET_SEALS too, so ask what the descriptor is).
            self.assertFalse(os.readlink(f"/proc/self/fd/{fd}").startswith("/memfd:"), "not a memfd")
            self.assertEqual(os.fstat(fd).st_nlink, 0, "an unnamed file")
            self.assertEqual(os.pread(fd, 16, 0), big[:16])
            with self.assertRaises(OSError):
                os.write(fd, b"x")
        finally:
            os.close(fd)

    def test_open_bytes_are_capped(self):
        self.ready(self.a)
        v = self.a.api.save(self.a.ctx(), "saves", [["slot", b"m", ""]], {})[0]["record"]["version"]
        self.a.api.put_asset(self.a.ctx(), "saves", "slot", "x", self.memfd(b"y" * 1000), v, {})
        from Suno_connect_sync.apps_api.limits import Bucket
        self.a.api.open_budget[self.a.ctx().store.key] = Bucket(3600.0, 1500.0)
        fd = self.a.api.open_asset(self.a.ctx(), "saves", "slot", "x", "")[2]
        os.close(fd)
        with self.assertRaises(ApiError) as caught:
            self.a.api.open_asset(self.a.ctx(), "saves", "slot", "x", "")
        self.assertEqual(caught.exception.limit, "open_bytes")


class N9OpenCopiesAreCappedWhileHeld(unittest.TestCase):
    """Copies count against the app's cap while any of its cgroups holds them; dropped, never truncated, after
    two empty scans in a row (final review 4)."""
    def setUp(self):
        self.now = [1000.0]
        self.holders: dict[str, tuple[set, set]] = {}
        self.scanned: list[str] = []

        def held(scope):
            self.scanned.append(scope)
            return self.holders.get(scope, (set(), set()))
        self.copies = asset_io.OpenCopies(10_000, 3, scopes=lambda app, scope: [scope, "/app.slice/second.scope"],
                                          held_in=held, clock=lambda: self.now[0])
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def copy(self, size: int) -> tuple[int, int]:
        own = os.open(self.tmp.name, os.O_RDWR | os.O_TMPFILE, 0o400)
        os.write(own, b"x" * size)
        readable = os.open(f"/proc/self/fd/{own}", os.O_RDONLY)
        self.copies.admit("app", "/app.slice/first.scope", size)
        self.copies.track("app", APP, "/app.slice/first.scope", own)
        return readable, own

    def later(self, seconds: float) -> None:
        self.now[0] += seconds

    def test_one_copy_always_fits_more_only_within_the_cap(self):
        first, _ = self.copy(50_000)                      # larger than the cap on its own: still allowed
        with self.assertRaises(ApiError) as caught:
            self.copies.admit("app", "/app.slice/first.scope", 10)
        self.assertEqual(caught.exception.limit, "open_bytes")
        os.close(first)

    def test_a_copy_held_by_another_instance_of_the_app_stays_counted(self):
        readable, _ = self.copy(6_000)
        st = os.fstat(readable)
        self.holders["/app.slice/second.scope"] = ({(st.st_dev, st.st_ino)}, set())
        for _ in range(3):
            self.later(asset_io.OpenCopies.GRACE + 1)
            self.assertEqual(self.copies.reclaim(), 0)
        self.assertIn("/app.slice/second.scope", self.scanned, "every scope of the app is scanned")
        self.holders["/app.slice/second.scope"] = (set(), {st.st_ino})      # only mapped now: still held
        self.later(60)
        self.assertEqual(self.copies.reclaim(), 0)
        os.close(readable)

    def test_released_copies_go_after_two_scans_and_are_never_truncated(self):
        readable, _ = self.copy(6_000)
        self.later(asset_io.OpenCopies.GRACE + 1)
        self.assertEqual(self.copies.reclaim(), 0, "one empty scan: the descriptor may be in transit")
        self.later(1)
        self.assertEqual(self.copies.reclaim(), 0, "a second scan right after doesn't count")
        self.later(asset_io.OpenCopies.GAP)
        self.assertEqual(self.copies.reclaim(), 6_000, "two empty scans apart: dropped")
        self.assertFalse(self.copies.tracked())
        self.assertEqual(os.pread(readable, 10, 0), b"x" * 10, "a holder the scan missed still reads every byte")
        self.assertEqual(os.fstat(readable).st_size, 6_000)
        os.close(readable)

    def test_a_holder_seen_between_misses_resets_the_count(self):
        readable, _ = self.copy(100)
        st = os.fstat(readable)
        self.later(asset_io.OpenCopies.GRACE + 1)
        self.copies.reclaim()
        self.holders["/app.slice/first.scope"] = ({(st.st_dev, st.st_ino)}, set())
        self.later(asset_io.OpenCopies.GAP + 1)
        self.copies.reclaim()
        self.holders.clear()
        self.later(asset_io.OpenCopies.GAP + 1)
        self.assertEqual(self.copies.reclaim(), 0, "the earlier miss doesn't count once a holder was seen")
        os.close(readable)

    def test_a_fresh_copy_is_never_reclaimed(self):
        readable, _ = self.copy(100)
        self.assertEqual(self.copies.reclaim(), 0, "the reply carrying it may still be on its way")
        os.close(readable)

    def test_count_cap_and_unknown_caller(self):
        for _ in range(3):
            os.close(self.copy(10)[0])
        with self.assertRaises(ApiError):
            self.copies.admit("app", "/app.slice/first.scope", 10)
        with self.assertRaises(ApiError) as caught:
            self.copies.admit("other", "", 10)
        self.assertEqual(caught.exception.kind, "failed")

    def test_every_instance_and_sub_sandbox_scope_of_the_app_is_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            names = [f"app-flatpak-{APP}-11.scope", f"app-flatpak-{APP}-22.scope", "app-flatpak-org.example.Other-33.scope",
                     f"app-flatpak-{APP}-x.scope", "app-gnome-foo-44.scope"]
            for name in names:
                (root / "app.slice" / name).mkdir(parents=True)
            original = asset_io.os.listdir
            asset_io.os.listdir = lambda path: original(str(root) + path[len("/sys/fs/cgroup"):])
            try:
                found = asset_io.app_scopes(APP, f"/app.slice/app-flatpak-{APP}-11.scope")
            finally:
                asset_io.os.listdir = original
            self.assertEqual(found, [f"/app.slice/app-flatpak-{APP}-11.scope", f"/app.slice/app-flatpak-{APP}-22.scope"])
        dashed = "io.github.some-app"
        self.assertIn(f"/s/app-flatpak-{dashed}-1.scope", asset_io.app_scopes(dashed, f"/s/app-flatpak-{dashed}-1.scope"))

    def test_the_real_scan_sees_this_process_holding_a_copy(self):
        scope = asset_io.scope_of(os.getpid())
        if scope is None or not Path(f"/sys/fs/cgroup{scope}/cgroup.procs").exists():
            self.skipTest("no readable cgroup here")
        own = os.open(self.tmp.name, os.O_RDWR | os.O_TMPFILE, 0o400)
        readable = os.open(f"/proc/self/fd/{own}", os.O_RDONLY)
        st = os.fstat(readable)
        fds, _maps = asset_io.held_in(scope)
        self.assertIn((st.st_dev, st.st_ino), fds)
        os.close(readable)
        os.close(own)


class FinalReview3LargeOpens(AppsBase):
    def test_an_asset_larger_than_the_burst_opens_when_the_budget_is_full(self):
        from Suno_connect_sync.apps_api.limits import OPEN_BYTES, Bucket
        size = 5 * 1000 ** 3                               # 5 GB, over the 4 GiB burst
        bucket = Bucket(*OPEN_BYTES, at=0.0)
        self.assertFalse(Bucket(*OPEN_BYTES, at=0.0).take(size, now=0.0), "take alone could never let it through")
        self.assertTrue(bucket.take_large(size, now=0.0))
        self.assertLess(bucket.available(now=0.0), 0, "charged as debt")
        self.assertGreaterEqual(bucket.available(now=0.0), -OPEN_BYTES[1], "at most one burst below zero")
        self.assertFalse(bucket.take_large(1000, now=60.0), "what follows waits")
        self.assertFalse(bucket.take_large(size, now=3600.0), "not full again after an hour of debt")
        self.assertTrue(bucket.take_large(size, now=3 * 3600.0), "full again: the next large open passes")

    def test_a_5gb_on_demand_asset_opens(self):
        """Through the API: an asset the store holds as 5 GB is opened, not refused by the hourly budget; a second
        one right after waits."""
        self.ready(self.a)
        v = self.a.api.save(self.a.ctx(), "saves", [["slot", b"m", ""]], {})[0]["record"]["version"]
        self.a.api.put_asset(self.a.ctx(), "saves", "slot", "film", self.memfd(b"f" * 1000), v, {})
        store = self.a.ctx().store
        with store.lock:
            store.db.execute("UPDATE files SET size=?", (5 * 1000 ** 3,))    # the budget sees 5 GB
        state, _info, fd = self.a.api.open_asset(self.a.ctx(), "saves", "slot", "film", "")
        self.assertEqual(state, "here")
        os.close(fd)
        with self.assertRaises(ApiError) as caught:
            self.a.api.open_asset(self.a.ctx(), "saves", "slot", "film", "")
        self.assertEqual(caught.exception.limit, "open_bytes")


class FinalReview5TmpfsFiles(AppsBase):
    def shm_file(self, data: bytes) -> int:
        folder = Path("/dev/shm") if Path("/dev/shm").is_dir() else Path(tempfile.gettempdir())
        fd, path = tempfile.mkstemp(dir=folder)
        os.unlink(path)
        os.write(fd, data)
        return fd

    def test_a_plain_tmpfs_file_is_copied_like_a_regular_file(self):
        fd = self.shm_file(b"from /dev/shm")
        try:
            current = asset_io.seals(fd)
            if current is None:
                self.skipTest("/dev/shm isn't tmpfs here")
            self.assertTrue(current & fcntl.F_SEAL_SEAL, "a tmpfs file reports F_SEAL_SEAL")
            self.assertEqual(asset_io.size_of(fd), 13)
            self.ready(self.a)
            v = self.a.api.save(self.a.ctx(), "saves", [["slot", b"m", ""]], {})[0]["record"]["version"]
            self.a.api.put_asset(self.a.ctx(), "saves", "slot", "shm", fd, v, {})
            state, _info, out = self.a.api.open_asset(self.a.ctx(), "saves", "slot", "shm", "")
            self.assertEqual(os.pread(out, 100, 0), b"from /dev/shm")
            os.close(out)
        finally:
            os.close(fd)

    def test_an_unsealed_memfd_is_still_refused(self):
        fd = os.memfd_create("x", os.MFD_ALLOW_SEALING)
        try:
            os.write(fd, b"x")
            with self.assertRaises(ApiError) as caught:
                asset_io.check_descriptor(fd)
            self.assertEqual(caught.exception.kind, "bad_descriptor")
            fcntl.fcntl(fd, fcntl.F_ADD_SEALS, fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK)
            self.assertEqual(asset_io.check_descriptor(fd).st_size, 1, "sealed: taken without a change check")
        finally:
            os.close(fd)

    def test_a_memfd_made_without_sealing_is_a_file_with_the_change_check(self):
        fd = os.memfd_create("x")                      # F_SEAL_SEAL from birth, like a tmpfs file
        try:
            os.write(fd, b"abc")
            self.assertFalse(asset_io.sealed(fd))
            self.assertEqual(asset_io.check_descriptor(fd).st_size, 3)
        finally:
            os.close(fd)


class L1LocalQuotas(AppsBase):
    def test_reads_create_no_zone_and_writes_check_the_zone_limit(self):
        self.publish([self.entry(limits={"zones": 1}, labels=["saves", "library"])])
        self.ready(self.a)
        ctx = self.a.ctx()
        self.a.api.get(ctx, "library", "x")
        self.a.api.fetch_changes(ctx, "library", "", 10)
        self.assertEqual(ctx.store.labels(), [])
        self.a.api.save(ctx, "saves", [["s", b"x", ""]], {})
        with self.assertRaises(ApiError) as caught:
            self.a.api.save(ctx, "library", [["s", b"x", ""]], {})
        self.assertEqual(caught.exception.limit, "zones")

    def test_revoked_local_writes_are_bounded_and_held_bytes_capped(self):
        self.publish([self.entry(state="suspended", limits={"records": 1})])
        self.ready(self.a)
        ctx = self.a.ctx()
        self.assertEqual(self.a.api.save(ctx, "saves", [["a", b"x", ""]], {})[0]["outcome"], "local")
        with self.assertRaises(ApiError):
            self.a.api.save(ctx, "saves", [["b", b"x", ""]], {})
        from Suno_connect_sync.apps_api import api as a
        old = a.MAX_HELD_PER_APP
        a.MAX_HELD_PER_APP = 10
        try:
            v = self.a.api.get(ctx, "saves", "a")["version"]
            with self.assertRaises(ApiError) as caught:
                self.a.api.put_asset(ctx, "saves", "a", "rom", self.memfd(b"x" * 100), v, {"on_demand": True})
            self.assertEqual(caught.exception.limit, "held_bytes")
            self.assertEqual(os.listdir(ctx.store.folder / "files"), [], "refused before a byte was copied")
        finally:
            a.MAX_HELD_PER_APP = old


class L2L3RegistryFloor(unittest.TestCase):
    def test_a_lost_state_file_cant_allow_a_rollback(self):
        folder = Path(tempfile.mkdtemp())
        vectors = Path(__file__).parent / "vectors/apps-registry"
        r = reg.Registry(folder, public_key=(vectors / "registry.pub").read_text(), seed=None)
        now = json.loads((vectors / "expected.json").read_text())["now_for_checks"]
        r.accept((vectors / "registry.json").read_bytes(), (vectors / "registry.json.minisig").read_bytes(), now)
        (folder / "state.json").write_text("{tor")
        r2 = reg.Registry(folder, public_key=(vectors / "registry.pub").read_text(), seed=None)
        with self.assertRaises(reg.RegistryError):
            r2.accept((vectors / "invalid/older/registry.json").read_bytes(), (vectors / "invalid/older/registry.json.minisig").read_bytes(), now)

    def test_the_floor_belongs_to_its_key(self):
        folder = Path(tempfile.mkdtemp())
        (folder / "state.json").write_text(json.dumps({"highest": 10**9, "key": "00" * 8}))
        vectors = Path(__file__).parent / "vectors/apps-registry"
        r = reg.Registry(folder, public_key=(vectors / "registry.pub").read_text(), seed=None)
        now = json.loads((vectors / "expected.json").read_text())["now_for_checks"]
        snap = r.accept((vectors / "registry.json").read_bytes(), (vectors / "registry.json.minisig").read_bytes(), now)
        self.assertEqual(snap.version, 412, "a floor from another key doesn't block this one")


class L4NoWritesForUnknownRevokedApps(AppsBase):
    def test_a_revoked_app_this_account_never_used_writes_nothing(self):
        self.publish([self.entry(), self.entry(owner=self.keys.other_owner, app="org.example.Never", state="revoked", purge=True,
                                               keys=[kit.b64url(self.keys.other["key"])])])
        self.ready(self.a)
        self.a.sync()
        self.assertIsNone(self.a.api.directory.get(self.keys.other_owner, "org.example.Never"))


class M10PurgeNeedsTwoRegistries(AppsBase):
    def zones_left(self) -> int:
        return sum(1 for acct in self.fake.accounts.values() for z in acct["zones"].values() if (z.get("owner") or "").startswith("t"))

    def test_a_purge_waits_for_a_second_registry_twelve_hours_later(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.sync()
        self.publish([self.entry(state="revoked", purge=True)])
        self.refresh()
        self.a.sync()
        self.assertEqual(self.a.ctx().status, "revoked", "stopped at once")
        self.assertGreater(self.zones_left(), 0, "but nothing deleted on one registry")
        self.publish([self.entry(state="revoked", purge=True)], issued_offset=2 * 3_600_000)
        self.later(2 * 3_600_000)
        self.refresh()
        self.a.sync()
        self.assertGreater(self.zones_left(), 0, "a second registry only 2 hours later isn't enough")
        self.publish([self.entry(state="revoked", purge=True)], issued_offset=13 * 3_600_000)
        self.later(13 * 3_600_000)
        self.refresh()
        self.a.sync()
        self.assertEqual(self.zones_left(), 0, "two registries 13 hours apart: purged")

    def test_a_purge_withdrawn_in_between_never_happens(self):
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.sync()
        self.publish([self.entry(state="revoked", purge=True)])
        self.refresh()
        self.a.sync()
        self.publish([self.entry(state="suspended")], issued_offset=6 * 3_600_000)
        self.later(6 * 3_600_000)
        self.refresh()
        self.a.sync()
        self.publish([self.entry(state="revoked", purge=True)], issued_offset=13 * 3_600_000)
        self.later(13 * 3_600_000)
        self.refresh()
        self.a.sync()
        self.assertGreater(self.zones_left(), 0, "the count starts again after a registry without the purge")


class N4PurgeDelayUsesTheDevicesClock(AppsBase):
    def zones_left(self) -> int:
        return sum(1 for acct in self.fake.accounts.values() for z in acct["zones"].values() if (z.get("owner") or "").startswith("t"))

    def setUp(self):
        super().setUp()
        self.ready()
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.sync()

    def test_two_registries_signed_12_hours_apart_but_seen_minutes_apart_wait(self):
        self.publish([self.entry(state="revoked", purge=True)], issued_offset=-13 * 3_600_000)
        self.refresh()
        self.a.sync()
        self.publish([self.entry(state="revoked", purge=True)])
        self.refresh()
        self.a.sync()
        self.assertGreater(self.zones_left(), 0, "12 hours of signing time, minutes of device time: no purge")
        self.later(12 * 3_600_000 + 60_000, self.a)
        self.refresh()
        self.a.sync()
        self.assertEqual(self.zones_left(), 0, "12 hours on the device's own clock: purged")

    def test_a_registry_from_the_future_counts_for_nothing(self):
        self.publish([self.entry(state="revoked", purge=True)], issued_offset=3_600_000)
        self.refresh()
        self.a.sync()
        self.assertEqual(self.a.api.local.get("purge_seen", {}), {}, "issued an hour ahead of this device: not recorded")
        self.later(14 * 3_600_000, self.a)
        self.publish([self.entry(state="revoked", purge=True)], issued_offset=14 * 3_600_000)
        self.refresh()
        self.a.sync()
        self.assertGreater(self.zones_left(), 0, "the first sighting starts now, not at the future registry")


class L7RemovalIsCareful(AppsBase):
    def test_one_miss_or_an_unreadable_installation_removes_nothing(self):
        self.ready(self.a)
        self.a.api.save(self.a.ctx(), "saves", [["s", b"x", ""]], {})
        self.a.sync()
        del self.a.installed[APP]
        self.a.sync()
        self.assertEqual(len(self.a.api.known_stores()), 1, "one miss keeps the store")
        self.a.cycle.installed = lambda: None
        self.a.sync()
        self.assertEqual(len(self.a.api.known_stores()), 1, "unreadable installations keep it too")

    def test_local_only_versions_survive_removal(self):
        self.publish([self.entry(state="suspended")])
        self.ready(self.a)
        self.a.api.save(self.a.ctx(), "saves", [["mine", b"keep", ""]], {})
        del self.a.installed[APP]
        self.a.sync()
        self.a.sync()
        store = self.a.api.store(self.keys.owner, APP)
        self.assertEqual(value_of({"value": model.unb64(store.view(store.row("saves", "mine"))[0]["v"])}), b"keep")


class L10Sha1Refused(unittest.TestCase):
    def test_a_sha1_signature_does_not_verify(self):
        keys = Keys.get()
        commit = kit.make_commit(APP)
        with tempfile.NamedTemporaryFile() as f:
            f.write(commit)
            f.flush()
            sig = keys.gpg.run("--local-user", keys.other["primary"], "--digest-algo", "SHA1", "--detach-sign", "--output", "-", f.name)
        c = identity.Commit(commit, [sig], [f"app/{APP}/x86_64/stable"], APP)
        self.assertEqual(identity.verify_signatures(c, keys.other["key"]), [])
        good = keys.gpg.sign(keys.other["primary"], commit)
        self.assertEqual(identity.verify_signatures(identity.Commit(commit, [good], [], APP), keys.other["key"]), [keys.other["primary"]])


def _seals(fd: int):
    try:
        return fcntl.fcntl(fd, fcntl.F_GET_SEALS)
    except OSError:
        return None


if __name__ == "__main__":
    unittest.main()
