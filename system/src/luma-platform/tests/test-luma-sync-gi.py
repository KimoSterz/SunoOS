#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""LumaSync through GObject introspection (ADR-057 §3.7): the no-portal mode from Python."""
import os
import tempfile

os.environ["XDG_DATA_HOME"] = tempfile.mkdtemp(prefix="luma-sync-gi-")
os.environ["LUMA_SYNC_LOCAL_ONLY"] = "1"

import gi  # noqa: E402

gi.require_version("LumaSync", "1")
from gi.repository import GLib, LumaSync  # noqa: E402

store = LumaSync.SyncStore.new("saves")
first = store.put_sync("slot", GLib.Bytes.new(b"hello"), None, LumaSync.SyncConflictPolicy.KEEP_BOTH, None)
assert first.get_outcome() == LumaSync.SyncOutcome.LOCAL
version = first.get_record().get_version()
assert len(version) == 32
assert bytes(first.get_record().get_value().get_data()) == b"hello"
stale = store.put_sync("slot", GLib.Bytes.new(b"x"), "0" * 32, LumaSync.SyncConflictPolicy.FAIL, None)
assert stale.get_outcome() == LumaSync.SyncOutcome.CONFLICT
changes = store.fetch_changes(None, None)
assert [r.get_name() for r in changes.get_records()] == ["slot"]
assert store.fetch_changes(changes.get_token(), None).get_records() == []
asset = store.put_asset_bytes("slot", "thumb", GLib.Bytes.new(b"png"), version, LumaSync.SyncAssetFlags.NONE, None)
assert asset.get_record().get_asset_size("thumb") == 3
opened = store.open_asset_sync("slot", "thumb", None, None)
assert bytes(opened.read_all(None).get_data()) == b"png"
lease = store.get_lease("slot", None)
assert not lease.get_active() and lease.get_until_ms() == 0
assert LumaSync.sync_status_to_string(LumaSync.SyncStatus.SUSPENDED) == "suspended"
try:
    LumaSync.SyncStore.new("Not A Label")
    raise SystemExit("a bad label was accepted")
except GLib.Error as error:
    assert error.matches(LumaSync.sync_error_quark(), LumaSync.SyncError.INVALID)
print("ok")
