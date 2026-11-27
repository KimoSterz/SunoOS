# SPDX-License-Identifier: Apache-2.0
"""When this device's Continue session goes out, and when it may be withdrawn.

The record on the Hub has to be current before the device sleeps: logind's
PrepareForSleep reaches NetworkManager at the same moment it reaches us, and
NetworkManager takes the network down at once, so a session written only as
the device suspends usually never leaves it. The session therefore goes out
as it changes: on unlock, whenever windows open, close or change while
unlocked, and on every snapshot the shell takes (lock included). As the
device suspends, the suspend snapshot is still tried under a delay
inhibitor, and anything that didn't go out is sent as soon as the network
is back after waking.

An empty snapshot withdraws the record only when the windows were really
closed: never one taken on lock, suspend, lid close, shutdown or log-out,
never while the session is locked or asleep, and never in the first minutes
after waking or unlocking (apps exit and come back then; a dark wake
unlocks nothing).

Right after unlock or resume the shell asks for an offer and compares it
with this device's own last snapshot; this device's own snapshot waits until
that question has been answered, or it would always look newer.
"""

from __future__ import annotations

import threading
import time

#: Snapshots the shell takes as the person leaves the device.
LEAVING = frozenset({"lock", "suspend", "lid", "shutdown", "logout"})
#: After waking or unlocking, an empty desktop doesn't withdraw the session for this long.
SETTLE_SECONDS = 120
#: After unlocking or waking, this device's own snapshot waits this long at most
#: for the shell's offer question (it normally comes within a second).
OFFER_GATE_SECONDS = 20
#: Window changes are gathered this long before a snapshot...
CHANGE_SETTLE_MS = 1500
#: ...and a stream of changes still gets one at least this often.
CHANGE_MAX_MS = 5000
#: How long the service holds suspend for the last publish.
SLEEP_BUDGET_SECONDS = 3.5
#: How long GetContinueOffer waits for the network after waking.
OFFER_NETWORK_WAIT = 12.0


class Handoff:
    """The lock, sleep and settle state the Continue decisions depend on.

    No D-Bus here: the service feeds events in, the tests feed them by hand."""

    def __init__(self, clock=time.time) -> None:
        self.clock = clock
        self.locked = False
        self.asleep = False
        self.settled_since = clock()
        self.gate_until = 0.0
        self.pending = False             # a session that couldn't go out (offline); sent when the network is back
        self.lock = threading.Lock()

    # -- events
    def set_locked(self, locked: bool) -> None:
        with self.lock:
            was = self.locked
            self.locked = locked
            if was and not locked:
                self._settle()

    def suspending(self) -> None:
        with self.lock:
            self.asleep = True

    def resumed(self) -> None:
        with self.lock:
            self.asleep = False
            self._settle()

    def offer_answered(self, held: bool = False) -> None:
        """The shell has its answer. One from the sessions held here (the network
        not back yet) keeps the gate: the shell asks again when one arrives."""
        with self.lock:
            self.gate_until = self.clock() + OFFER_GATE_SECONDS if held else 0.0

    def _settle(self) -> None:
        now = self.clock()
        self.settled_since = now
        self.gate_until = now + OFFER_GATE_SECONDS

    # -- decisions
    def may_snapshot(self) -> bool:
        """This device may take a snapshot for Continue now (unlocked, awake, and
        not while the shell is still deciding whether to offer another device's)."""
        with self.lock:
            return not self.locked and not self.asleep and self.clock() >= self.gate_until

    def gate_remaining(self) -> float:
        with self.lock:
            return max(0.0, self.gate_until - self.clock())

    def settle_remaining(self) -> float:
        with self.lock:
            return max(0.0, self.settled_since + SETTLE_SECONDS - self.clock())

    def may_withdraw(self, snapshot: dict) -> bool:
        """An empty snapshot ends the published session only if the person closed the windows."""
        if snapshot.get("reason") in LEAVING:
            return False
        with self.lock:
            if self.locked or self.asleep:
                return False
            return self.clock() - self.settled_since >= SETTLE_SECONDS
