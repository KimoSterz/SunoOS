# SPDX-License-Identifier: Apache-2.0
"""Continue's timing (handoff.py): when an empty desktop may end the published
session, and when this device may take its own snapshot."""
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from Suno_connect_sync import handoff  # noqa: E402
from Suno_connect_sync.hub import Offline  # noqa: E402


class Clock:
    def __init__(self) -> None:
        self.now = 1_800_000_000.0

    def __call__(self) -> float:
        return self.now


class HandoffPolicy(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = Clock()
        self.h = handoff.Handoff(self.clock)
        self.clock.now += handoff.SETTLE_SECONDS + 1      # long since started
        self.empty = {"reason": "periodic", "windows": []}

    def test_settled_and_unlocked_may_withdraw(self) -> None:
        self.assertTrue(self.h.may_withdraw(self.empty))

    def test_leaving_snapshots_never_withdraw(self) -> None:
        for reason in ("lock", "suspend", "lid", "shutdown", "logout"):
            self.assertFalse(self.h.may_withdraw({"reason": reason}), reason)

    def test_locked_or_asleep_never_withdraws(self) -> None:
        self.h.set_locked(True)
        self.assertFalse(self.h.may_withdraw(self.empty))
        self.h.set_locked(False)
        self.clock.now += handoff.SETTLE_SECONDS + 1
        self.h.suspending()
        self.assertFalse(self.h.may_withdraw(self.empty))

    def test_dark_wake_never_withdraws(self) -> None:
        self.h.set_locked(True)
        self.h.suspending()
        self.h.resumed()
        self.clock.now += 3600                 # woke on its own and stayed locked
        self.assertFalse(self.h.may_withdraw(self.empty))
        self.assertFalse(self.h.may_snapshot())

    def test_just_resumed_or_unlocked_keeps_the_session(self) -> None:
        # 13:10:58 resume, 13:11:02 the apps exit, 13:11:24 the shell saves 0 windows.
        self.h.suspending()
        self.h.resumed()
        self.clock.now += 26
        self.assertFalse(self.h.may_withdraw(self.empty))
        self.clock.now += handoff.SETTLE_SECONDS
        self.assertTrue(self.h.may_withdraw(self.empty), "settled: the person closed them")
        self.h.set_locked(True)
        self.h.set_locked(False)
        self.assertFalse(self.h.may_withdraw(self.empty), "just unlocked")
        self.assertAlmostEqual(self.h.settle_remaining(), handoff.SETTLE_SECONDS)

    def test_own_snapshot_waits_for_the_offer_question(self) -> None:
        self.assertTrue(self.h.may_snapshot())
        self.h.set_locked(True)
        self.assertFalse(self.h.may_snapshot(), "locked")
        self.h.set_locked(False)
        self.assertFalse(self.h.may_snapshot(), "the shell hasn't asked for an offer yet")
        self.h.offer_answered()
        self.assertTrue(self.h.may_snapshot())
        self.h.set_locked(True)
        self.h.set_locked(False)
        self.clock.now += handoff.OFFER_GATE_SECONDS
        self.assertTrue(self.h.may_snapshot(), "no question came: not held for ever")

    def test_an_offline_answer_keeps_the_gate(self) -> None:
        # Woken before the network: the answer came from held sessions, and the
        # shell asks again when another device's session arrives.
        self.h.suspending()
        self.h.resumed()
        self.clock.now += 12
        self.h.offer_answered(held=True)
        self.assertFalse(self.h.may_snapshot())
        self.assertAlmostEqual(self.h.gate_remaining(), handoff.OFFER_GATE_SECONDS)
        self.clock.now += 6
        self.h.offer_answered()
        self.assertTrue(self.h.may_snapshot())


class OfferAfterWake(unittest.TestCase):
    """GetContinueOffer, asked as the device wakes: waits for the network, then answers."""

    def service(self, answers):
        try:
            from Suno_connect_sync.service import Service
        except ImportError as error:        # no PyGObject here
            self.skipTest(str(error))
        service = Service.__new__(Service)
        service.network = threading.Event()
        service.stop = threading.Event()

        class Sessions:
            calls = 0

            def offer(self, fetch=True):
                Sessions.calls += 1
                answer = answers.pop(0)
                if isinstance(answer, Exception):
                    raise answer
                return answer

        class Sync:
            sessions = Sessions()
        service.sync = Sync()
        return service

    def test_waits_for_the_network(self) -> None:
        service = self.service([Offline("down"), {"id": "dev:1"}])
        threading.Timer(0.2, service.network.set).start()
        self.assertEqual(service._offer_now(), {"id": "dev:1"})

    def test_gives_up_in_time(self) -> None:
        service = self.service([Offline("down")] * 50)
        original = handoff.OFFER_NETWORK_WAIT
        handoff.OFFER_NETWORK_WAIT = 0.3
        try:
            with self.assertRaises(Offline):
                service._offer_now()
        finally:
            handoff.OFFER_NETWORK_WAIT = original

    def test_offline_publish_is_sent_when_the_network_is_back(self) -> None:
        service = self.service([])
        service.handoff = handoff.Handoff()
        service._continue_ready = lambda: True
        results = [Offline("down"), "published"]

        def publish():
            answer = results.pop(0)
            if isinstance(answer, Exception):
                raise answer
            return answer
        service.sync.sessions.publish = publish
        self.assertEqual(service._publish_continue("suspend"), "offline")
        self.assertTrue(service.handoff.pending)
        self.assertEqual(service._publish_continue("network"), "published")
        self.assertFalse(service.handoff.pending)


if __name__ == "__main__":
    unittest.main()
