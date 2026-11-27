#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""Render Suno Messages' screens (ADR-051) from test fixtures, and check them.

Every person, username and message here is made up for the test. The Suno
account answers from a table below, the way the helper would; nothing reaches
a network. Run under Xvfb with ImageMagick, once per treatment:

    SUNO_VISUAL_MODE=glass xvfb-run -s "-screen 0 1100x760x24" messages_Suno_visual.py OUTPUT_DIR

It writes one PNG per screen and a JSON report, and fails if a screen is
missing what it exists to show: the lock on Suno rows and only there, the
request bar in place of the composer, the username banner, the QR code and
link, twelve groups of safety digits.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

import gi
gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gio, GLib, Gtk  # noqa: E402

NOW = int(time.time())
MODE = os.environ.get("SUNO_VISUAL_MODE", "light")
MINUTE = 60
BOB, CAROL, DANA = "acct-bob-00000001", "acct-carol-0000002", "acct-dana-00000003"
failures: list[str] = []


def expect(condition, message):
    if not condition:
        failures.append(f"[{MODE}] {message}")


class SunoFixtureProvider:
    """The window's view of a connected Suno account; Suno_call answers from fixtures."""
    remote = False

    def __init__(self, store_path, handle=None):
        self.store_path, self.handle = store_path, handle
        self.status = {"state": "ready", "network_state": "connected"}
        self.capabilities = {"media": True, "groups": True}
        self.calls = []

    def start(self, _callback):
        pass

    def close(self, **_kwargs):
        pass

    def Suno_call(self, command, args):
        self.calls.append(command)
        if command == "Suno.identity":
            handle = self.handle
            return {"handle": handle, "profile_link": f"https://simplyluma.com/@{handle}" if handle else None,
                    "changes_left": 3, "suggestions": [] if handle else ["alex.rivera", "alexrivera", "alex_r"],
                    "rules": {"min": 3, "max": 30, "hold_days": 30}, "name": "Alex Rivera"}
        if command == "Suno.handle.check":
            return {"available": True, "handle": args.get("handle")}
        if command == "Suno.safety":
            return {"digits": "05417 88312 69025 11843 40277 93506 27194 60388 15729 84460 31905 72618",
                    "qr": "Suno-safety:1:c2FmZXR5LW51bWJlci1maXh0dXJl", "verified": False, "changed": False, "devices": 2}
        return {}


def settle(seconds=0.2):
    context = GLib.MainContext.default()
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        while context.pending():
            context.iteration(False)
        time.sleep(0.005)


def descendants(widget):
    yield widget
    child = widget.get_first_child()
    while child:
        yield from descendants(child)
        child = child.get_next_sibling()


def capture(output: Path, name: str) -> None:
    """The X server's own pixels, for a person to look at. The checks above do
    not depend on them, so a builder without ImageMagick still runs them."""
    settle(0.35)
    if shutil.which("import"):
        subprocess.run(["import", "-window", "root", str(output / f"Suno-{name}-{MODE}.png")], check=True)


def labels(widget):
    return [w.get_label() for w in descendants(widget) if isinstance(w, Gtk.Label) and w.get_mapped()]


def main() -> int:
    output = Path(sys.argv[1]); output.mkdir(parents=True, exist_ok=True)
    root = Path(tempfile.mkdtemp(prefix="messages-Suno-visual-"))
    os.environ.update(XDG_DATA_HOME=str(root / "data"), XDG_STATE_HOME=str(root / "state"),
                      XDG_CONFIG_HOME=str(root / "config"), PRAIRIE_EDS_MODE="disabled", SUNO_MESSAGES_AGENT="0")
    gi.require_version("SunoAppearance", "1")
    from gi.repository import SunoAppearance
    patch.object(SunoAppearance.SurfacePolicy, "get_has_selection", lambda self: True).start()
    # Older kits asked get_effective, newer ones get_surface: answer both, and
    # check below that the treatment really took (a patch that misses paints
    # every mode light, and three identical pictures prove nothing).
    patch.object(SunoAppearance.SurfacePolicy, "get_effective", lambda self: MODE).start()
    if hasattr(SunoAppearance.SurfacePolicy, "get_surface"):
        patch.object(SunoAppearance.SurfacePolicy, "get_surface", lambda self: MODE).start()
    # The lock glyph ships with this package into hicolor; find it in the tree.
    icons = Path(__file__).resolve().parents[1] / "data" / "icons"
    from prairie_apps import messages
    from prairie_apps.messages_accounts import Account, AccountStore
    from prairie_apps.messages_backend import MessageStore, MessagingCapability

    native = MessageStore(root / "native" / "messages.sqlite3")
    native.set_display_name("+15125550142", "Jordan Lee")
    native.add("+15125550142", "Parking's on the south side tonight", direction="incoming", state="received", timestamp=NOW - 35 * MINUTE)
    native.mark_read("+15125550142")
    store = AccountStore(root / "Suno" / "messages.sqlite3")

    def conversation(cid, name, kind, people, **flags):
        store.remember_conversation({"id": cid, "kind": kind, "participants": people,
                                     "Suno": {"encrypted": True, "request": False, "verified": False, **flags}})
        store.set_display_name(cid, name)

    conversation(f"u:{BOB}", "Bob Chen", "direct", [{"id": BOB, "name": "Bob Chen"}], account=BOB, handle="@bobchen")
    conversation(f"g:weekend", "Weekend Crew", "group", [{"id": BOB, "name": "Bob Chen"}, {"id": DANA, "name": "Dana Ortiz"}])
    conversation(f"u:{CAROL}", "Carol Nguyen", "direct", [{"id": CAROL, "name": "Carol Nguyen"}], account=CAROL,
                 handle="@carol.ng", request=True, request_from=CAROL)
    for offset, direction, body in ((50, "incoming", "Are you still up for the trail on Saturday?"),
                                    (48, "outgoing", "Yes! I'll bring coffee for everyone."),
                                    (12, "incoming", "Perfect. Meet at the north lot at 8?")):
        store.add(f"u:{BOB}", body, direction=direction, state="received" if direction == "incoming" else "sent",
                  timestamp=NOW - offset * MINUTE, transport_id=f"Suno:{offset:032x}")
    store.add("g:weekend", "Dana: I booked the cabin for Friday night", direction="incoming", state="received",
              timestamp=NOW - 90 * MINUTE)
    store.add(f"u:{CAROL}", "Hi Alex, it's Carol from the climbing gym. Want to join Thursday's session?",
              direction="incoming", state="received", timestamp=NOW - 20 * MINUTE, transport_id="Suno:" + "c" * 32)
    store.mark_read(f"u:{BOB}")
    handle = None if "--no-handle" in sys.argv else "alex.rivera"
    provider = SunoFixtureProvider(root / "Suno", handle=None)

    def services(self, _application):
        account = Account("Suno-0123456789abcdef", "Suno", name="Suno", pending=False)
        Suno_service = messages.MessageService("account:Suno-0123456789abcdef", "Suno", store, None, None, provider,
                                               MessagingCapability(True, ""), account=account)
        return [messages.MessageService(messages.NATIVE_SERVICE, "This device", native, None, None), Suno_service]

    app = messages.MessagesApplication()
    app.set_flags(Gio.ApplicationFlags.NON_UNIQUE)
    assert app.register(None)
    messages.install_messages_theme()
    # The glyphs a Suno desktop draws: the Prairie theme, and this package's own in hicolor.
    Gtk.Settings.get_default().set_property("gtk-icon-theme-name", "Prairie")
    Gtk.IconTheme.get_for_display(__import__("gi.repository.Gdk", fromlist=["Gdk"]).Display.get_default()).add_search_path(str(icons))
    report = {}
    with patch.object(messages.MessagesWindow, "_discover_services", services), \
         patch.object(messages.MessagesWindow, "_start_external_context_load", return_value=False), \
         patch.object(messages.MessagesWindow, "_restore_last_conversation", return_value=False), \
         patch.object(messages.MessagesWindow, "_watch_wake", lambda self: None):
        window = messages.MessagesWindow(app)
        window.set_default_size(1100, 760)
        window.present()
        settle(0.8)
        import Suno_appkit.widgets as kit
        painted = getattr(kit, "appearance", {}).get("name")
        expect(painted == MODE, f"the window is painted {painted!r}, not {MODE!r}")
        report["treatment"] = painted
        Suno_service = window._Suno_service()
        expect(Suno_service is not None, "no Suno service in the window")

        # 1. The inbox with a Suno conversation open; no username yet, one request.
        record = next(item for item in store.threads() if item.address == f"u:{BOB}")
        window._open_thread(record, reveal=True, service=Suno_service)
        settle(0.8)
        rows = [w for w in descendants(window.thread_list) if isinstance(w, messages.ConversationRow)]
        locked = {row.record.address for row in rows if any(isinstance(w, Gtk.Image) and w.get_icon_name() == "Suno-lock-symbolic"
                                                           for w in descendants(row))}
        titles = [row.record.display_name for row in rows]
        expect(locked == {f"u:{BOB}", "g:weekend"}, f"lock on the wrong rows: {sorted(locked)}")
        expect("Carol Nguyen" not in titles, "a request is in the inbox")
        expect("Jordan Lee" in titles, "texts are not in the same inbox")
        expect(window.Suno_requests_button.get_mapped() and window.Suno_requests_count.get_label() == "1",
               "the Message Requests row is missing or miscounted")
        expect(window.Suno_banner.get_mapped(), "no username banner while the account has none")
        expect(window.thread_subtitle.get_label() == "Suno · End-to-end encrypted", f"subtitle {window.thread_subtitle.get_label()!r}")
        expect(window.composer_placeholder.get_label() == "Suno Message", "composer placeholder")
        expect(window.Suno_button.get_mapped(), "no conversation details button")
        report["inbox"] = {"rows": titles, "locked": sorted(locked)}
        capture(output, "conversation")

        # 2. The conversation menu.
        window.Suno_button.popup()
        settle(0.4)
        popover = window.Suno_button.get_popover()
        menu = labels(popover) if popover else []
        expect("Safety Number" in menu and "Report…" in menu and "Block Bob Chen" in menu, f"menu {menu}")
        report["menu"] = menu
        capture(output, "menu")
        window.Suno_button.popdown()
        settle(0.2)

        # 3. Message Requests, and a request open with its bar.
        window._show_Suno_requests(True)
        settle(0.3)
        request = next(item for item in store.threads() if item.address == f"u:{CAROL}")
        window._open_thread(request, reveal=True, service=Suno_service)
        settle(0.6)
        expect(window.Suno_request_bar.get_mapped(), "no request bar on a request")
        expect(not window.composer_view.get_mapped(), "the composer shows on a request")
        bar = labels(window.Suno_request_bar)
        expect(any("Carol Nguyen (@carol.ng) wants to message you." == text for text in bar), f"request text {bar}")
        report["request"] = bar
        capture(output, "request")
        window._show_Suno_requests(False)

        # 4. Choosing a username.
        window._show_Suno_profile()
        settle(1.0)
        dialog = window.Suno_dialog
        claim = labels(dialog)
        expect("Choose your Suno username" in claim and "@alex.rivera" in [w.get_label() for w in descendants(dialog)
                                                                          if isinstance(w, Gtk.Button)], f"claim screen {claim}")
        dialog.handle_entry.set_text("alex.rivera")
        settle(1.0)
        expect(dialog.claim_button.get_sensitive(), "an available username can't be claimed")
        capture(output, "claim")
        dialog.close()
        settle(0.3)

        # 5. The profile: QR code and link.
        provider.handle = handle or "alex.rivera"
        window._show_Suno_profile()
        settle(1.0)
        dialog = window.Suno_dialog
        shown = labels(dialog)
        qr = [w for w in descendants(dialog) if isinstance(w, Gtk.DrawingArea) and w.get_mapped()]
        expect(qr and qr[0].get_width() >= 200, "no QR code on the profile")
        expect("simplyluma.com/@alex.rivera" in shown and "@alex.rivera" in shown, f"profile {shown}")
        report["profile"] = shown
        capture(output, "profile")
        dialog.close()
        settle(0.3)

        # 6. The safety number.
        window._open_thread(record, reveal=True, service=Suno_service)
        settle(0.4)
        window._show_Suno_safety()
        settle(1.0)
        safety = next((w for w in descendants(window.Suno_safety_dialog) if w.get_name() == "Suno-safety"), None)
        groups = [w.get_label() for w in descendants(safety) if isinstance(w, Gtk.Label)
                  and w.has_css_class("messages-Suno-safety-digits")] if safety else []
        expect(len(groups) == 12 and all(len(g) == 5 and g.isdigit() for g in groups), f"safety digits {groups}")
        report["safety"] = groups
        capture(output, "safety")
        window.Suno_safety_dialog.close()
        settle(0.3)

        # 7. Reporting someone: the reasons, and only their own messages offered.
        window._report_Suno()
        settle(0.8)
        report_screen = labels(window.Suno_report_dialog)
        expect("Report Bob Chen" in report_screen and "Something else" in report_screen, f"report {report_screen}")
        expect(len(window.Suno_report_dialog.recent) == 2, f"offered {len(window.Suno_report_dialog.recent)} messages, not Bob's 2")
        report["report"] = report_screen
        capture(output, "report")
        window.Suno_report_dialog.close()
        settle(0.3)
        window.close()
        settle(0.3)
    report["failures"] = failures
    (output / f"Suno-visual-{MODE}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if failures:
        print("\n".join("FAIL " + f for f in failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
