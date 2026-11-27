#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""Suno Messages in Messages (ADR-051), against a fake Suno helper.

The real helper's own end-to-end run (two users, two devices, a fake Hub) is in
src/Suno-messages-e2ee/tests/e2e.py and its package %check. This covers what
Messages adds: when the account exists, the key it seals its state with, the
request/verified flags it stores, commands it may and may not pass on, starting
a conversation by username, and keeping Suno out of Suno Cloud history.
"""
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prairie_apps import messages_Suno as Suno  # noqa: E402
from prairie_apps.messages_accounts import (  # noqa: E402
    AccountProvider, Accounts, AccountStore, BridgeError, KeyringLocked, NETWORKS, available_networks, network)
from prairie_apps import connect_messages  # noqa: E402

FAKE = Path(__file__).resolve().parent / "fake_Suno_bridge.py"
CAROL = "acct-carol-0000002"
BOB = "acct-bob-00000001"


class FakeSecrets:
    def __init__(self):
        self.items, self.locked, self.lossy = {}, False, False

    def get(self, account_id):
        if self.locked:
            raise KeyringLocked("locked")
        return self.items.get(account_id)

    def set(self, account_id, _label, value):
        if self.locked:
            raise KeyringLocked("locked")
        if not self.lossy:
            self.items[account_id] = value

    def delete(self, account_id):
        self.items.pop(account_id, None)


def wait(predicate, what, timeout=10):
    end = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > end:
            raise AssertionError("timed out: " + what)
        time.sleep(0.02)


class SunoCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.helpers = self.root / "libexec"
        self.helpers.mkdir()
        self.accounts = Accounts(self.root / "accounts")
        self.environment = {"HOME": str(self.root / "home")}
        self.secrets = FakeSecrets()

    def install_helper(self):
        helper = self.helpers / "Suno"
        helper.write_text(f"#!/bin/sh\nexec {sys.executable} {FAKE} \"$@\"\n")
        helper.chmod(0o755)

    def enrol(self):
        device = Suno.connect_device_file(self.environment)
        device.parent.mkdir(parents=True)
        device.write_text("{}")

    def provider(self):
        self.install_helper()
        self.enrol()
        account = Suno.ensure_account(self.accounts, helper_dir=self.helpers, environment=self.environment)
        states = []
        provider = AccountProvider(account, self.accounts, secrets=self.secrets, dispatch=lambda fn: fn(),
                                   helper_dir=self.helpers)
        self.addCleanup(lambda: provider.close(wait=True))
        provider.start(states.append)
        return provider, states, account

    def calls(self, account):
        path = self.accounts.directory(account.id) / "calls.jsonl"
        return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


class LinksTest(unittest.TestCase):
    def test_usernames_and_links(self):
        cases = {"@bob": "bob", "bob.smith": "bob.smith", "@Bob_Smith": "bob_smith",
                 "https://simplyluma.com/@bob": "bob", "https://www.simplyluma.com/@bob/": "bob",
                 "Suno-messages://u/bob": "bob"}
        for text, handle in cases.items():
            self.assertEqual(Suno.handle_from(text), handle, text)
        for text in ("", "@b", "@bob..smith", "@.bob", "@12345", "https://evil.example/@bob", "http://simplyluma.com/@bob",
                     "Suno-messages://x/bob", "+15125550100", "@bob smith"):
            self.assertIsNone(Suno.handle_from(text), text)
        # Only an explicit @ or a link is taken as a username in the To field;
        # a plain word stays a name to search contacts for.
        self.assertTrue(Suno.looks_like_handle("@bob"))
        self.assertFalse(Suno.looks_like_handle("bob"))

    def test_safety_number_groups(self):
        self.assertEqual(Suno.safety_groups(" ".join(["12345"] * 12)), ["12345"] * 12)
        self.assertEqual(Suno.safety_groups("123"), [])


class AccountTest(SunoCase):
    def test_Suno_is_never_offered_in_add_account(self):
        self.assertTrue(network("Suno").automatic)
        self.assertEqual([item.id for item in NETWORKS if item.automatic], ["Suno"])
        self.install_helper()
        self.assertIn("Suno", [item.id for item in available_networks(self.helpers)])

    def test_the_account_exists_only_with_the_helper_and_a_Suno_connect_sign_in(self):
        self.assertIsNone(Suno.ensure_account(self.accounts, helper_dir=self.helpers, environment=self.environment))
        self.install_helper()
        self.assertIsNone(Suno.ensure_account(self.accounts, helper_dir=self.helpers, environment=self.environment),
                          "added without a Suno Connect sign-in")
        self.enrol()
        account = Suno.ensure_account(self.accounts, helper_dir=self.helpers, environment=self.environment)
        self.assertIsNotNone(account)
        self.assertEqual((account.network, account.name, account.pending), ("Suno", "Suno", False))
        again = Suno.ensure_account(self.accounts, helper_dir=self.helpers, environment=self.environment)
        self.assertEqual(again.id, account.id)
        self.assertEqual(len([a for a in self.accounts.list() if a.network == "Suno"]), 1)


class ProviderTest(SunoCase):
    def test_a_key_is_made_and_kept_in_the_keyring_before_the_helper_sees_it(self):
        provider, _states, account = self.provider()
        wait(lambda: provider.status.get("network_state") == "connected", "connected")
        stored = self.secrets.items.get(account.id)
        self.assertTrue(stored and len(stored) >= 40, "no key in the keyring")
        self.assertEqual((self.accounts.directory(account.id) / "session").read_text(), stored)
        order = [call["cmd"] for call in self.calls(account)]
        self.assertLess(order.index("session.load"), order.index("connect"))

    def test_a_keyring_that_does_not_keep_the_key_stops_the_account(self):
        self.secrets.lossy = True
        provider, _states, account = self.provider()
        wait(lambda: provider.status.get("network_state") == "keyring", "keyring state")
        self.assertNotIn("connect", [call["cmd"] for call in self.calls(account)], "connected with a key the keyring lost")

    def test_requests_are_stored_with_their_flags_and_a_declined_one_leaves(self):
        provider, _states, account = self.provider()
        store = AccountStore(provider.store_path)
        self.addCleanup(store.close)
        wait(lambda: store.Suno_flags(f"u:{CAROL}").get("request") is True, "request flags")
        wait(lambda: any(t.address == f"u:{CAROL}" for t in store.threads()), "the request's message")
        self.assertEqual(store.Suno_flags(f"u:{CAROL}")["request_from"], CAROL)
        self.assertEqual(set(store.Suno_conversations()), {f"u:{CAROL}"})
        provider.Suno_call("Suno.request.answer", {"conversation": f"u:{CAROL}", "state": "declined"})
        wait(lambda: not any(t.address == f"u:{CAROL}" for t in store.threads()), "declined conversation removed")

    def test_only_Suno_commands_pass_and_never_a_delivery(self):
        provider, _states, account = self.provider()
        wait(lambda: provider.status.get("network_state") == "connected", "connected")
        self.assertIsNone(provider.Suno_call("Suno.identity", {})["handle"])
        for command in ("message.send", "media.send", "message.react", "logout", "session.load"):
            with self.assertRaises(BridgeError) as refused:
                provider.Suno_call(command, {"conversation": "u:x", "text": "hi"})
            self.assertEqual(refused.exception.code, "unsupported", command)
        self.assertNotIn("message.send", [call["cmd"] for call in self.calls(account)])

    def test_a_conversation_by_username_takes_the_Suno_id_and_an_unknown_one_fails(self):
        provider, _states, _account = self.provider()
        wait(lambda: provider.status.get("network_state") == "connected", "connected")
        store = AccountStore(provider.store_path)
        self.addCleanup(store.close)
        record = store.add("@bob", "Hello Bob", direction="outgoing", state="queued", timestamp=int(time.time()))
        token = store.authorize_send(record.uid)
        self.assertEqual(provider.send_message(record.uid, token)["state"], "sent")
        wait(lambda: store.message(record.uid).address == f"u:{BOB}", "moved to the Suno conversation id")
        self.assertTrue(store.Suno_flags(f"u:{BOB}").get("encrypted"))
        nobody = store.add("@nobody", "Hello?", direction="outgoing", state="queued", timestamp=int(time.time()))
        result = provider.send_message(nobody.uid, store.authorize_send(nobody.uid))
        self.assertEqual((result["state"], result.get("reason")), ("failed", "handle_unknown"))
        self.assertEqual(store.message(nobody.uid).state, "failed")


class CloudHistoryTest(unittest.TestCase):
    """ADR-051 §7: Suno conversations never enter Suno Cloud history."""

    def test_Suno_rows_and_account_stores_are_never_sent(self):
        with tempfile.TemporaryDirectory() as temp:
            native = Path(temp) / "prairie/messages/messages.db"
            native.parent.mkdir(parents=True)
            db = sqlite3.connect(native)
            db.execute("CREATE TABLE messages(uid TEXT PRIMARY KEY,address TEXT NOT NULL,body TEXT NOT NULL,timestamp INTEGER NOT NULL,"
                       "direction TEXT NOT NULL,state TEXT NOT NULL,transport_id TEXT)")
            db.execute("INSERT INTO messages VALUES('text1','+15125550100','a text',1700000000,'incoming','read',NULL)")
            db.execute("INSERT INTO messages VALUES('Suno1','u:acct-bob-00000001','an encrypted one',1700000000,'incoming','read','Suno:abc')")
            db.commit(); db.close()
            items = connect_messages.message_items(native)
            bodies = sorted(item["body"] for item in items.values())
            self.assertEqual(bodies, ["a text"], "the walk must reach the text and skip the Suno row")
            account_store = Path(temp) / "prairie/messages/accounts/Suno-0123456789abcdef/messages.db"
            account_store.parent.mkdir(parents=True)
            native.rename(account_store)
            self.assertEqual(connect_messages.message_items(account_store), {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
