"""Valet: "Restoring from your other devices" (ADR-054, design-center 38858a5
mockups/connect-sync/restore.html).

After a device joins Luma Connect Sync, the apps on the person's other
devices install here and their data comes over. luma-connect-syncd reports
it (org.projectluma.ConnectSync1 GetRestore, RestoreChanged); this page is
one list, one row per app. `luma-installer --restore [APP_ID]` opens it, with
that app's row brought into view (a launcher tile still restoring opens this
instead of the app). When nothing is left to do the window closes to a
notification.

`RestoreModel` is the words and states, without GTK; the page draws it.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Gdk", "4.0")
from gi.repository import Gdk, Gio, GLib, Gtk, Pango  # noqa: E402

BUS_NAME = "org.projectluma.ConnectSync1"
OBJECT_PATH = "/org/projectluma/ConnectSync1"
INTERFACE = "org.projectluma.ConnectSync1"
PENDING = {"installing", "restoring", "waiting"}
DIMMED = {"waiting", "unavailable", "offered"}
NOTIFICATION_ID = "connect-sync-restored"


def _size_pair(done: float, total: float) -> str:
    """ "180 of 410 MB": both in the total's unit (decimal units, as Files and Settings count)."""
    for unit, scale in (("GB", 1e9), ("MB", 1e6), ("KB", 1e3)):
        if total >= scale:
            if unit == "GB":
                return f"{done / scale:.1f} of {total / scale:.1f} GB"
            return f"{done / scale:.0f} of {total / scale:.0f} {unit}"
    return f"{int(done)} of {int(total)} bytes"


@dataclass(frozen=True)
class Row:
    app: str
    name: str
    state: str
    line: str | None        # the words under the name (None: a progress bar stands there)
    side: str               # the words at the row's end ("180 of 410 MB", "Installing…"), "" for none
    fraction: float | None  # the bar, when there is one
    ready: bool             # the green check
    dimmed: bool


class RestoreModel:
    """GetRestore's rows and ListDevices' names, as the page says them."""

    def __init__(self, rows: list[dict], devices: list[dict]) -> None:
        self.raw = [r for r in rows if isinstance(r, dict) and r.get("app")]
        self.devices = {str(d.get("device")): d for d in devices if isinstance(d, dict)}
        here = next((d for d in devices if isinstance(d, dict) and d.get("this_device")), None)
        self.here = str(here.get("name")) if here and here.get("name") else ""

    @property
    def pending(self) -> bool:
        return any(r.get("state") in PENDING for r in self.raw)

    def sources(self) -> list[str]:
        names: list[str] = []
        for r in self.raw:
            device = self.devices.get(str(r.get("from")))
            name = str(device.get("name")) if device and device.get("name") else ""
            if name and name not in names:
                names.append(name)
        return names

    def summary(self) -> str:
        sources = self.sources()
        source = (sources[0] if len(sources) == 1 else " and ".join(sources) if len(sources) == 2
                  else "your other devices")
        count = len(self.raw)
        apps = f"{count} app" if count == 1 else f"{count} apps"
        here = f"this {self.here}" if self.here else "this device"
        return f"From {source} · {apps} · you can use {here} while it works."

    def rows(self) -> list[Row]:
        return [self.row(r) for r in self.raw]

    @staticmethod
    def row(r: dict) -> Row:
        state = str(r.get("state") or "waiting")
        name = str(r.get("name") or r.get("app"))
        app = str(r["app"])
        progress = r.get("progress")
        fraction = max(0.0, min(1.0, float(progress))) if isinstance(progress, (int, float)) else None
        if state == "restoring":
            total = r.get("bytes")
            side = (_size_pair((fraction or 0.0) * float(total), float(total))
                    if isinstance(total, (int, float)) and total > 0 else "Bringing over its data")
            return Row(app, name, state, None, side, fraction or 0.0, False, False)
        if state == "installing":
            return Row(app, name, state, None, "Installing…", fraction or 0.0, False, False)
        if state == "ready":
            return Row(app, name, state, "Ready", "", None, True, False)
        if state == "waiting":
            return Row(app, name, state, "Waiting", "", None, False, True)
        if state == "unavailable":
            return Row(app, name, state, str(r.get("reason") or "Not available for this device"), "", None, False, True)
        if state == "offered":
            return Row(app, name, state, str(r.get("reason") or "Installed on another kind of device"), "", None, False, True)
        # failed: it is tried again later by the service; say why.
        return Row(app, name, state, str(r.get("reason") or "Couldn’t be installed"), "", None, False, False)

    def done_notification(self, tv: bool = False) -> tuple[str, str]:
        """Title and body of the banner the window closes to (design-center daccee5 banner.html?kind=restored).
        On a TV the Shell shows it as the TV toast, whose value is a short figure: the body is just the count
        (design-center fbb3764, banner.html?posture=tv). Unavailable apps stay in the list and aren't counted."""
        sources = self.sources()
        source = sources[0] if len(sources) == 1 else "your other devices"
        count = sum(1 for r in self.raw if r.get("state") == "ready")
        here = f"this {self.here}" if self.here else "this device"
        if tv:
            return "Your apps are ready", "1 app" if count == 1 else f"{count} apps"
        if count == 1:
            return "Your apps are ready", f"1 app from {source} is on {here}."
        return "Your apps are ready", f"{count} apps from {source} are on {here}."


#: The banner's one action, and its default: the restore list again.
SHOW_ACTION = "app.show-restore"


def tv_posture() -> bool:
    """Whether the Shell is in TV posture (org.project_luma.shell-state posture)."""
    source = Gio.SettingsSchemaSource.get_default()
    schema = source.lookup("org.project_luma.shell-state", True) if source else None
    if not schema or not schema.has_key("posture"):
        return False
    return Gio.Settings.new("org.project_luma.shell-state").get_string("posture") == "tv"


def done_notification(model: RestoreModel, tv: bool | None = None) -> Gio.Notification:
    """Valet's standard notification when a restore finishes: the words, and Show (on a TV, Show waits in the
    quick panel's list)."""
    title, body = model.done_notification(tv_posture() if tv is None else tv)
    note = Gio.Notification.new(title)
    note.set_body(body)
    note.set_default_action(SHOW_ACTION)
    note.add_button("Show", SHOW_ACTION)
    return note


class RestoreSource:
    """The live service, or a fixture (LUMA_VALET_RESTORE_FIXTURE: {"rows": [...], "devices": [...]})."""

    def __init__(self, changed, fixture: str | None = None) -> None:
        self.changed = changed
        self.fixture = json.loads(Path(fixture).read_text(encoding="utf-8")) if fixture else None
        self.bus: Gio.DBusConnection | None = None
        self.signal = 0
        if self.fixture is None:
            try:
                self.bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
            except GLib.Error:
                self.bus = None
        if self.bus is not None:
            self.signal = self.bus.signal_subscribe(BUS_NAME, INTERFACE, "RestoreChanged", OBJECT_PATH, None,
                                                    Gio.DBusSignalFlags.NONE, lambda *_a: self.changed())

    def close(self) -> None:
        if self.bus is not None and self.signal:
            self.bus.signal_unsubscribe(self.signal)
            self.signal = 0

    def read(self, done) -> None:
        """done(RestoreModel) on the main loop."""
        if self.fixture is not None:
            done(RestoreModel(self.fixture.get("rows", []), self.fixture.get("devices", [])))
            return
        if self.bus is None:
            done(RestoreModel([], []))
            return
        answers: dict[str, list] = {}

        def got(name: str, source, result) -> None:
            try:
                value = json.loads(source.call_finish(result).unpack()[0])
            except (GLib.Error, ValueError):
                value = []
            answers[name] = value if isinstance(value, list) else []
            if len(answers) == 2:
                done(RestoreModel(answers["GetRestore"], answers["ListDevices"]))

        for method in ("GetRestore", "ListDevices"):
            self.bus.call(BUS_NAME, OBJECT_PATH, INTERFACE, method, None, GLib.VariantType("(s)"),
                          Gio.DBusCallFlags.NONE, 15000, None, lambda s, r, m=method: got(m, s, r))


def _icon(app: str, name: str, picture: str | None):
    from luma_appkit import AppIcon
    if picture:
        try:
            texture = Gdk.Texture.new_from_filename(picture)
            return AppIcon(app, picture=texture, name=name, size=40)
        except GLib.Error:
            pass
    return AppIcon(app, name=name, size=40)


_STYLE = """
.valet-restore { padding: 30px 34px; }
.valet-restore-title { font-weight: 700; }
.valet-restore-list { margin-top: 20px; border-radius: 16px; box-shadow: inset 0 0 0 1px @luma_border; }
.valet-restore-row { padding: 12px 16px; border-radius: 0; }
.valet-restore-row + .valet-restore-row { border-top: 1px solid @luma_border; }
.valet-restore-row.first { border-radius: 16px 16px 0 0; }
.valet-restore-row.last { border-radius: 0 0 16px 16px; }
.valet-restore-row.first.last { border-radius: 16px; }
.valet-restore-row.wanted { background: alpha(@luma_accent, .10); }
.valet-restore-name { font-size: 13.5px; }
.valet-restore-dim { opacity: .45; filter: saturate(.4); }
/* cs.css --cs-ok, oklch(0.74 0.13 150), one green in both modes */
.valet-restore-ready { color: #69c27e; }
"""


class _MaxWidth(Gtk.Widget):
    """Its child at most `limit` wide, at the start (mockup .cs-rest max-width)."""

    __gtype_name__ = "ValetRestoreMaxWidth"

    def __init__(self, child: Gtk.Widget, limit: int) -> None:
        super().__init__(hexpand=True)
        self.child, self.limit = child, limit
        child.set_parent(self)

    def do_measure(self, orientation, for_size):
        if orientation == Gtk.Orientation.HORIZONTAL:
            minimum, natural, _b1, _b2 = self.child.measure(orientation, -1)
            return minimum, max(minimum, min(natural, self.limit)), -1, -1
        width = min(for_size, self.limit) if for_size >= 0 else -1
        minimum, natural, _b1, _b2 = self.child.measure(orientation, width)
        return minimum, natural, -1, -1

    def do_size_allocate(self, width, height, baseline):
        self.child.allocate(min(width, self.limit), height, -1, None)

    def do_dispose(self):
        if self.child is not None and self.child.get_parent() is self:
            self.child.unparent()
        self.child = None


class RestorePage(Gtk.Box):
    """The list. `update(model)` redraws it; `wanted` is the app asked for with --restore."""

    def __init__(self, wanted: str | None = None, pictures: dict[str, str] | None = None) -> None:
        from luma_appkit import apply_type
        from luma_appkit.widgets import add_style_builder
        super().__init__(orientation=Gtk.Orientation.VERTICAL, hexpand=True, vexpand=True)
        add_style_builder(lambda _appearance: _STYLE)
        self.set_name("vl-restore")
        self.add_css_class("valet-restore")
        self.wanted = wanted
        self.pictures = pictures or {}
        self.title = apply_type(Gtk.Label(label="Restoring from your other devices", xalign=0, wrap=True), "title_1", weight=700)
        self.title.add_css_class("valet-restore-title")
        self.line = apply_type(Gtk.Label(xalign=0, wrap=True), "body", muted=True)
        self.line.set_margin_top(9)  # mockup p 6 px under a 24 px h1 at line-height 1.4; title_1 is 1.15
        self.line.set_name("vl-restore-line")
        self.list = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.list.add_css_class("valet-restore-list")
        self.list.set_name("vl-restore-list")
        column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        for child in (self.title, self.line, self.list):
            column.append(child)
        self.column = column
        self.append(_MaxWidth(column, 620))
        self.drawn: dict[str, Gtk.Widget] = {}

    def update(self, model: RestoreModel) -> None:
        from luma_appkit import ProgressLine, apply_type, icons
        self.line.set_label(model.summary() if model.raw else "Nothing to restore. Apps from your other devices are all here.")
        while child := self.list.get_first_child():
            self.list.remove(child)
        self.drawn.clear()
        rows = model.rows()
        self.list.set_visible(bool(rows))
        for index, row in enumerate(rows):
            grid = Gtk.Grid(column_spacing=14, row_spacing=2)
            grid.add_css_class("valet-restore-row")
            grid.set_name(f"vl-restore-{row.app}")
            if index == 0:
                grid.add_css_class("first")
            if index == len(rows) - 1:
                grid.add_css_class("last")
            if row.app == self.wanted:
                grid.add_css_class("wanted")
            icon = _icon(row.app, row.name, self.pictures.get(row.app))
            if row.dimmed:
                icon.add_css_class("valet-restore-dim")
            grid.attach(icon, 0, 0, 1, 2)
            name = apply_type(Gtk.Label(label=row.name, xalign=0, valign=Gtk.Align.END, hexpand=True), "row_title", weight=600)
            name.add_css_class("valet-restore-name")
            name.set_ellipsize(Pango.EllipsizeMode.END)
            grid.attach(name, 1, 0, 1, 1)
            if row.fraction is not None:
                bar = ProgressLine(row.fraction, label=row.name)
                bar.set_valign(Gtk.Align.START)
                bar.set_margin_top(6)
                grid.attach(bar, 1, 1, 1, 1)
            else:
                line = apply_type(Gtk.Label(label=row.line or "", xalign=0, valign=Gtk.Align.START, wrap=True), "small", muted=True)
                grid.attach(line, 1, 1, 1, 1)
            if row.ready:
                check = Gtk.Image.new_from_icon_name(icons.icon_name("check"))
                check.set_pixel_size(16)
                check.add_css_class("valet-restore-ready")
                check.set_valign(Gtk.Align.CENTER)
                check.update_property([Gtk.AccessibleProperty.LABEL], ["Ready"])
                grid.attach(check, 2, 0, 1, 2)
            elif row.side:
                side = apply_type(Gtk.Label(label=row.side, xalign=1, valign=Gtk.Align.CENTER), "small", muted=True)
                grid.attach(side, 2, 0, 1, 2)
            self.list.append(grid)
            self.drawn[row.app] = grid

    def bring_wanted_into_view(self) -> None:
        widget = self.drawn.get(self.wanted or "")
        if widget is not None:
            widget.grab_focus()
            scroller = widget.get_ancestor(Gtk.ScrolledWindow)
            if scroller is not None:
                ok, bounds = widget.compute_bounds(scroller.get_child())
                if ok:
                    scroller.get_vadjustment().set_value(max(0.0, bounds.get_y() - 24))


class RestoreController:
    """Keeps a page current: on RestoreChanged, and every 1.5 s while data comes over (progress is not signalled)."""

    POLL_MS = 1500

    def __init__(self, page: RestorePage, *, fixture: str | None = None, finished=None, source=None) -> None:
        self.page = page
        self.finished = finished
        self.source = source if source is not None else RestoreSource(self.refresh, fixture)
        self.timer = 0
        self.was_pending = False
        self.first = True
        self.refresh()

    def refresh(self) -> None:
        self.source.read(self._take)

    def _take(self, model: RestoreModel) -> None:
        self.page.update(model)
        if self.first:
            self.first = False
            GLib.idle_add(lambda: (self.page.bring_wanted_into_view(), False)[1])
        if model.pending:
            self.was_pending = True
            if not self.timer and getattr(self.source, "fixture", None) is None:
                self.timer = GLib.timeout_add(self.POLL_MS, self._tick)
        elif self.was_pending:
            # Everything that could come over has: close to a notification.
            self.was_pending = False
            if self.finished is not None:
                self.finished(model)

    def _tick(self) -> bool:
        self.timer = 0
        self.refresh()
        return False

    def close(self) -> None:
        if self.timer:
            GLib.source_remove(self.timer)
            self.timer = 0
        self.source.close()


def restore_window(application, wanted: str | None = None):
    """Valet's window for the restore list."""
    from luma_appkit import AppWindow, Card, Command, CommandGroup, CommandRegistry, ContentLitHeader, icons
    fixture = os.environ.get("LUMA_VALET_RESTORE_FIXTURE")
    pictures = {}
    if fixture:
        data = json.loads(Path(fixture).read_text(encoding="utf-8"))
        base = Path(fixture).parent
        pictures = {app: str(base / path) for app, path in (data.get("pictures") or {}).items()}
    commands = CommandRegistry((CommandGroup("", (
        Command("valet.new", "Install an app…", lambda: application.activate(), icons.icon_name("download")),)),))
    window = AppWindow(application=application, app_id="io.luma.Valet", title="Valet", icon_name="io.luma.Valet",
                       commands=commands, default_width=1180, default_height=700, minimum_width=340, minimum_height=300)
    window.title_bar.set_name("vl-top")
    page = RestorePage(wanted, pictures)
    scroller = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, has_frame=False, child=page,
                                  hexpand=True, vexpand=True)
    panel = Gtk.Overlay(hexpand=True, vexpand=True)
    panel.set_overflow(Gtk.Overflow.HIDDEN)
    panel.set_child(Gtk.Box())
    lit = ContentLitHeader(name="Valet")
    lit.set_can_target(False)
    panel.add_overlay(lit)
    panel.add_overlay(scroller)
    card = Card(panel, padded=False, recessed=True)
    card.set_name("vl-restore-panel")
    card.set_overflow(Gtk.Overflow.HIDDEN)
    card.set_hexpand(True)
    card.set_vexpand(True)
    window.set_body(card)

    def finished(model: RestoreModel) -> None:
        application.send_notification(NOTIFICATION_ID, done_notification(model))
        window.close()

    controller = RestoreController(page, fixture=fixture, finished=finished)
    window.connect("close-request", lambda *_a: (controller.close(), False)[1])
    window.restore_page = page
    window.restore_controller = controller
    return window
