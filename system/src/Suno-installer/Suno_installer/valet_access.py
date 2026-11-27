"""The install sheet's permission part (ADR-052 step 3): one sheet for every route.

Three blocks replace the old chip row: **Files** (three file levels as cards,
the one Suno suggests from the app's kind tagged), **Uses** (Valet's toggle
chips, only for what the package asks for, and its device rules as one request
row with a switch) and the fixed **Never** line. A command-line install shows
the same sheet afterwards as a review: a strip above Files, and Done / Open.

`Access` is the state; `AccessSheet` draws it in the ticket's main column; the
phone and TV page (`valet_phone`) draws the same state as rows. Words, icons
and sizes follow design-center 8bd4ccf `mockups/app-perms` (`ap.css`, `ap.js`).
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Callable

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Gdk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gdk, GLib, Gtk, Pango

from Suno_appkit import Switch, apply_type, icons
from Suno_appkit.widgets import add_style_builder

#: The three file levels: engine key, Lucide icon, title, description.
LEVELS = (
    ("chooser", "file-search", "File picker only", "Only files you choose"),
    ("folders", "folder", "These folders", ""),
    ("all", "hard-drive", "All your files", "Everything in your home folder"),
)
#: What a package may ask to use, in the order the sheet lists them.
USES = (
    ("network", "Network", "globe"),
    ("camera", "Camera", "camera"),
    ("microphone", "Microphone", "mic"),
    ("location", "Location", "map-pin"),
    ("screen", "Screen", "monitor"),
    ("notifications", "Notifications", "bell"),
    ("background", "Run in background", "refresh-cw"),
    ("autostart", "Start at sign-in", "power"),
)
NEVER = ("Never your keys, passwords, browser profiles, other apps’ data, "
         "or anything that runs when you sign in.")
REVIEW = "Installed from the command line with these. Change anything here."
FILES_NOTE = "Change it any time in Settings"
USES_NOTE = "Tap to allow or block"
PICK_FOLDERS = "Pick folders"
DEVICE_PHONE_DETAIL = "From its package’s device rules"

_STYLE = """
/* ap.css .ap-sec: the section label and its quiet note */
.valet-access { border-spacing: 0; }
/* .vtmid is a 12 px grid: a section's 20 px margin reads as 32 between blocks;
   the first keeps its 20 below the hero's own 20 px gap (the ticket's middle margin). */
.valet-access-section { margin-top: 32px; }
.valet-access-section.first { margin-top: 20px; }
.valet-access-heading { margin-bottom: 9px; border-spacing: 8px; }
.valet-access-heading > label.title { font-size: 12px; line-height: 17px; font-weight: 600; color: @Suno_ink_secondary; }
.valet-access-heading > label.note { font-size: 12px; line-height: 17px; font-weight: 500; color: @Suno_muted; opacity: .8; }
/* .ap-opt: a 13 px card per level; the chosen one raised like a chip, with a tick */
.valet-levels { border-spacing: 8px; }
button.valet-level.valet-level { min-height: 86px; min-width: 0; padding: 0; margin: 0; border-radius: 13px; border: none; background: none;
  box-shadow: inset 0 0 0 1px @Suno_border; color: @Suno_ink_secondary; outline-offset: -1px; }
button.valet-level:hover { background: alpha(@Suno_ink, .03); }
button.valet-level:checked { background: @Suno_chip; color: @Suno_ink;
  box-shadow: inset 0 1px 0 @Suno_chip_highlight, 0 0 0 1px @Suno_chip_ring, 0 1px 2px @Suno_chip_shadow; }
.valet-level-body { padding: 12px 13px; border-spacing: 0; }
.valet-level-body > image { color: @Suno_muted; margin: 0 0 5px 0; padding: 0; min-width: 17px; min-height: 17px; -gtk-icon-size: 17px; }
button.valet-level:checked .valet-level-body > image { color: @Suno_ink; }
/* The reference's type: 13 px on a 1.4 line, 11.5 px on 1.35 (GTK takes whole pixels). */
.valet-level-title { margin-top: 3px; font-size: 13px; line-height: 18px; font-weight: 600; color: @Suno_ink; }
.valet-level-detail { margin-top: 3px; font-size: 11.5px; line-height: 16px; color: @Suno_muted; }
.valet-level-tick { margin: 11px; min-width: 18px; min-height: 18px; border-radius: 7px; /* the reference's 50% squircle */
  background: @Suno_check_on; color: #fff; }
.valet-level-tick > image { -gtk-icon-size: 11px; color: #fff; }
.valet-level-suggested { margin-top: 7px; padding: 1px 6px; border-radius: 5px; font-size: 10.5px; font-weight: 650;
  line-height: 15px; color: @Suno_ink_secondary; background: @Suno_fill; }
/* .vtcan: Valet's toggle chips (Uses), and the folder chooser under the cards */
.valet-folder-choice { margin-top: 8px; }
button.valet-use.valet-use { min-height: 32px; min-width: 0; padding: 0 12px 0 10px; margin: 0; border-radius: 10px; border: none; background: none;
  box-shadow: inset 0 0 0 1px @Suno_border; color: @Suno_muted; }
button.valet-use > box { border-spacing: 7px; }
button.valet-use label { font-size: 12.5px; font-weight: 500; text-decoration-line: line-through;
  text-decoration-color: alpha(@Suno_ink, .35); }
button.valet-use image { -gtk-icon-size: 14px; }
button.valet-use:hover { color: @Suno_ink_secondary; }
button.valet-use:checked { background: @Suno_chip; color: @Suno_ink;
  box-shadow: inset 0 1px 0 @Suno_chip_highlight, 0 0 0 1px @Suno_chip_ring, 0 1px 2px @Suno_chip_shadow; }
button.valet-use:checked label { text-decoration-line: none; }
button.valet-use:checked image { color: @Suno_ink_secondary; }
/* .ap-req: a package's device rules, one request in a well */
.valet-device-request { margin-top: 8px; padding: 11px 14px 11px 12px; border-radius: 13px; border-spacing: 12px;
  background: @Suno_well; box-shadow: inset 0 0 0 1px @Suno_well_ring, inset 0 1px 2px @Suno_well_shade, 0 1px 0 @Suno_well_lip; }
.valet-device-request > image { -gtk-icon-size: 18px; color: @Suno_ink_secondary; }
.valet-device-title { font-size: 13px; line-height: 18px; font-weight: 600; color: @Suno_ink; }
.valet-device-detail { font-size: 11.5px; line-height: 16px; color: @Suno_muted; margin-top: 2px; }
/* .ap-never: a line, not a choice */
.valet-never { margin-top: 30px; border-spacing: 8px; }
.valet-never > image { -gtk-icon-size: 14px; color: @Suno_good; margin-top: 1px; }
.valet-never > label { font-size: 12px; line-height: 17px; color: @Suno_muted; }
/* .ap-cli: the command line's review strip */
.valet-review { padding: 5px 10px; border-radius: 8px; border-spacing: 7px; background: @Suno_fill; }
.valet-review > image { -gtk-icon-size: 14px; color: @Suno_ink_secondary; }
.valet-review > label { font-size: 12px; line-height: 17px; color: @Suno_ink_secondary; }
"""
_style_loaded: set[int] = set()


#: Lucide glyphs the sheet draws that the platform's icon set does not have yet.
ICON_DIRS = (Path("/usr/share/Suno-installer/icons"), Path(__file__).resolve().parents[1] / "data/icons")


def install_access_style() -> None:
    display = Gdk.Display.get_default()
    if display is None or id(display) in _style_loaded:
        return
    add_style_builder(lambda _appearance: _STYLE)
    theme = Gtk.IconTheme.get_for_display(display)
    for folder in ICON_DIRS:
        if folder.is_dir() and str(folder) not in theme.get_search_path():
            theme.add_search_path(str(folder))
    _style_loaded.add(id(display))


def home_folders(home: Path | None = None) -> list[str]:
    """The top-level folders a person can give an app, as named in their home folder."""
    try:
        from .permission_views import folders
        return list(folders((home or Path.home()).resolve()))
    except Exception:  # noqa: BLE001 - the chooser still offers the standard folders
        return ["Desktop", "Documents", "Downloads", "Music", "Pictures", "Videos"]


class Access:
    """What the sheet shows and what Install records (`report.access`, `package_access.plan`)."""

    def __init__(self, plan: dict | None, *, native: bool = False, review: bool = False,
                 folders: list[str] | None = None) -> None:
        plan = deepcopy(dict(plan or {}))
        files = dict(plan.get("files") or {})
        self.plan = plan
        self.suggested_level = str(files.get("suggested_level") or files.get("level") or "chooser")
        if self.suggested_level not in {key for key, *_ in LEVELS}:
            self.suggested_level = "chooser"
        self.suggested_folders = [str(name) for name in files.get("suggested_folders", files.get("folders")) or []]
        self.level = str(files.get("level") or self.suggested_level)
        self.folders = [str(name) for name in files.get("folders") or []]
        asked = [str(use) for use in plan.get("uses") or []]
        # A native package declares nothing and gets the network by default, as every
        # host program does; the sheet shows it so it can be blocked here.
        if native and "network" not in asked:
            asked.insert(0, "network")
        order = [key for key, *_ in USES]
        self.uses = sorted(dict.fromkeys(use for use in asked if use in order), key=order.index)
        blocked = set(plan.get("blocked") or [])
        self.allowed = {use: use not in blocked for use in self.uses}
        devices = dict(plan.get("devices") or {})
        self.device = devices if devices.get("requests") else {}
        self.device_granted = bool(devices.get("granted", devices.get("default", True))) if self.device else False
        self.review = review
        self.home_folders = folders if folders is not None else home_folders()
        self.listeners: list[Callable[[], None]] = []

    # reading
    def folders_line(self) -> str:
        return ", ".join(self.folders) if self.folders else PICK_FOLDERS

    def level_detail(self, key: str) -> str:
        if key == "folders":
            return self.folders_line()
        return next(detail for level, _icon, _title, detail in LEVELS if level == key)

    def device_detail(self) -> str:
        # One per device the rules name (vendor and product), or per kind where they name none.
        count = len(self.device.get("requests") or []) or int(self.device.get("count") or 1)
        kinds = "kind of device" if count == 1 else "kinds of device"
        return f"Its package’s device rules ask for direct access to {count} {kinds}"

    def chooser_open(self) -> bool:
        """Choosing These folders when it wasn't suggested opens the folder chooser under the cards."""
        return self.level == "folders" and self.suggested_level != "folders"

    def chosen(self) -> dict:
        """The plan with the person's choices, for `report.access` and `Permissions.install`."""
        result = deepcopy(self.plan)
        files = dict(result.get("files") or {})
        files.update({"level": self.level, "folders": list(self.folders),
                      "suggested_level": self.suggested_level, "chosen": True})
        result["files"] = files
        result["uses"] = list(self.uses)
        result["blocked"] = [use for use in self.uses if not self.allowed.get(use, True)]
        if self.device:
            devices = dict(result.get("devices") or {})
            devices["granted"] = self.device_granted
            result["devices"] = devices
        return result

    # changing
    def _changed(self) -> None:
        for listener in list(self.listeners):
            listener()

    def set_level(self, key: str) -> None:
        if key == self.level:
            return
        self.level = key
        if key == "folders" and not self.folders and self.suggested_level == "folders":
            self.folders = list(self.suggested_folders)
        self._changed()

    def set_folder(self, name: str, on: bool) -> None:
        if on and name not in self.folders:
            self.folders.append(name)
        elif not on and name in self.folders:
            self.folders.remove(name)
        self._changed()

    def set_use(self, use: str, on: bool) -> None:
        if self.allowed.get(use) != on:
            self.allowed[use] = on
            self._changed()

    def set_device(self, on: bool) -> None:
        if self.device_granted != on:
            self.device_granted = on
            self._changed()


class _Strut(Gtk.Widget):
    """Nothing to see: asks for `width` as its natural width and nothing as its minimum."""

    def __init__(self, width: int) -> None:
        super().__init__()
        self._width = width
        self.set_can_target(False)

    def do_measure(self, orientation, _for_size):
        if orientation == Gtk.Orientation.HORIZONTAL:
            return 0, self._width, -1, -1
        return 0, 0, -1, -1


def _label(text: str, css: str, *, wrap: bool = False, role: str | None = None) -> Gtk.Label:
    label = Gtk.Label(label=text, xalign=0, wrap=wrap)
    if wrap:
        label.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
    label.add_css_class(css)
    return apply_type(label, role) if role else label


class AccessSheet(Gtk.Box):
    """The three blocks in Valet's main column, drawn from an `Access`."""

    # ap.css: the Never line is at most 600 wide; the sheet's blocks are as wide as the reference's
    # column (its Never line at 12 px, 569), so the three cards keep the reference's proportions.
    MAX_WIDTH = 600
    BLOCK_WIDTH = 569

    def __init__(self) -> None:
        install_access_style()
        super().__init__(orientation=Gtk.Orientation.VERTICAL, halign=Gtk.Align.START)
        self.set_name("vl-access")
        self.add_css_class("valet-access")
        self.access: Access | None = None
        self.level_buttons: dict[str, Gtk.ToggleButton] = {}
        self.use_buttons: dict[str, Gtk.ToggleButton] = {}
        self.folder_buttons: dict[str, Gtk.ToggleButton] = {}
        self.device_switch: Switch | None = None
        self._drawing = False

    def set_access(self, access: Access | None) -> None:
        if self.access is not None and self._sync in self.access.listeners:
            self.access.listeners.remove(self._sync)
        self.access = access
        if access is not None:
            access.listeners.append(self._sync)
        self._draw()

    # drawing
    def _clear(self) -> None:
        while (child := self.get_first_child()) is not None:
            self.remove(child)
        self.level_buttons, self.use_buttons, self.folder_buttons = {}, {}, {}
        self.device_switch = None

    def _heading(self, section: Gtk.Box, title: str, note: str) -> None:
        heading = Gtk.Box(spacing=0)
        heading.add_css_class("valet-access-heading")
        heading.append(_label(title, "title"))
        heading.append(_label(note, "note"))
        section.append(heading)

    def _block(self, child: Gtk.Widget) -> Gtk.Widget:
        """A block as wide as the reference's column where there is room, narrower where there is not."""
        child.set_halign(Gtk.Align.START)
        child.prepend(_Strut(self.BLOCK_WIDTH))
        return child

    def _section(self, name: str, first: bool = False) -> Gtk.Box:
        section = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        section.set_name(name)
        section.add_css_class("valet-access-section")
        if first:
            section.add_css_class("first")
        self.append(self._block(section))
        return section

    def _draw(self) -> None:
        self._drawing = True
        try:
            self._clear()
            access = self.access
            self.set_visible(access is not None)
            if access is None:
                return
            if access.review:
                strip = Gtk.Box(spacing=0, halign=Gtk.Align.FILL)
                strip.set_name("vl-review")
                strip.add_css_class("valet-review")
                strip.append(icons.image("terminal", pixel_size=14))
                strip.append(_label(REVIEW, "review"))
                # ap.css .ap-cli: 10 px below the hero's gap; then its <p> 12 px bottom margin and the
                # 12 px grid gap before Files' own 20.
                strip.set_margin_top(10)
                strip.set_margin_bottom(24)
                column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
                column.append(strip)
                self.append(self._block(column))
            files = self._section("vl-files", first=True)
            self._heading(files, "Files", FILES_NOTE)
            row = Gtk.Box(spacing=0, homogeneous=True)
            row.set_name("vl-levels")
            row.add_css_class("valet-levels")
            group = None
            for key, icon, title, _detail in LEVELS:
                button = Gtk.ToggleButton(active=access.level == key)
                button.add_css_class("valet-level")
                button.set_name("vl-level-" + key)
                if group is None:
                    group = button
                else:
                    button.set_group(group)
                overlay = Gtk.Overlay()
                body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0, valign=Gtk.Align.START)
                body.add_css_class("valet-level-body")
                glyph = icons.image(icon, pixel_size=17)
                glyph.set_halign(Gtk.Align.START)
                body.append(glyph)
                body.append(_label(title, "valet-level-title"))
                detail = _label(access.level_detail(key), "valet-level-detail", wrap=True)
                detail.set_name("vl-level-detail-" + key)
                body.append(detail)
                if key == access.suggested_level:
                    tag = Gtk.Label(label="Suggested", halign=Gtk.Align.START)
                    tag.add_css_class("valet-level-suggested")
                    body.append(tag)
                overlay.set_child(body)
                tick = Gtk.Box(halign=Gtk.Align.END, valign=Gtk.Align.START)
                tick.add_css_class("valet-level-tick")
                mark = icons.image("check", pixel_size=11)
                mark.set_hexpand(True)
                mark.set_halign(Gtk.Align.CENTER)
                tick.append(mark)
                tick.set_visible(access.level == key)
                tick.set_can_target(False)
                overlay.add_overlay(tick)
                button.set_child(overlay)
                button._tick = tick  # noqa: SLF001 - the card's own part
                button._detail = detail  # noqa: SLF001
                state = title + (", suggested" if key == access.suggested_level else "")
                button.update_property([Gtk.AccessibleProperty.LABEL], [state])
                button.connect("toggled", self._level_toggled, key)
                self.level_buttons[key] = button
                row.append(button)
            files.append(row)
            chooser = Adw.WrapBox(child_spacing=6, line_spacing=6)
            chooser.set_name("vl-folder-choice")
            chooser.add_css_class("valet-folder-choice")
            for name in access.home_folders:
                chip = self._chip(name, "folder", name in access.folders)
                chip.connect("toggled", self._folder_toggled, name)
                self.folder_buttons[name] = chip
                chooser.append(chip)
            chooser.set_visible(access.chooser_open())
            self.chooser = chooser
            files.append(chooser)
            if access.uses or access.device:
                uses = self._section("vl-uses")
                self._heading(uses, "Uses", USES_NOTE)
                if access.uses:
                    chips = Adw.WrapBox(child_spacing=6, line_spacing=6)
                    chips.set_name("vl-uses")
                    chips.add_css_class("valet-uses")
                    words = {key: (title, icon) for key, title, icon in USES}
                    for use in access.uses:
                        title, icon = words[use]
                        chip = self._chip(title, icon, access.allowed.get(use, True))
                        chip.set_name("vl-use-" + use)
                        chip.connect("toggled", self._use_toggled, use)
                        self.use_buttons[use] = chip
                        chips.append(chip)
                    uses.append(chips)
                if access.device:
                    uses.append(self._device_row(access))
            never = Gtk.Box(spacing=0)
            never.set_name("vl-never")
            never.add_css_class("valet-never")
            lock = icons.image("lock", pixel_size=14)
            lock.set_valign(Gtk.Align.START)
            never.append(lock)
            line = _label(NEVER, "never", wrap=True)
            line.set_hexpand(True)
            never.append(line)
            self.append(never)
        finally:
            self._drawing = False

    def _chip(self, title: str, icon: str, active: bool) -> Gtk.ToggleButton:
        chip = Gtk.ToggleButton(active=active, halign=Gtk.Align.START)
        chip.add_css_class("valet-use")
        line = Gtk.Box(spacing=0)  # CSS border-spacing gives the 7 px
        line.append(icons.image(icon, pixel_size=14))
        line.append(Gtk.Label(label=title))
        chip.set_child(line)
        chip.update_property([Gtk.AccessibleProperty.LABEL], [title])
        chip.set_tooltip_text(title + (": allowed" if active else ": blocked"))
        return chip

    def _device_row(self, access: Access) -> Gtk.Widget:
        row = Gtk.Box(spacing=0)
        row.set_name("vl-device-request")
        row.add_css_class("valet-device-request")
        row.append(icons.image(str(access.device.get("icon") or "usb"), pixel_size=18))
        words = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, hexpand=True, valign=Gtk.Align.CENTER)
        words.append(_label(str(access.device.get("name") or "Devices"), "valet-device-title"))
        words.append(_label(access.device_detail(), "valet-device-detail", wrap=True))
        row.append(words)
        switch = Switch(active=access.device_granted, label=str(access.device.get("name") or "Devices"))
        switch.set_valign(Gtk.Align.CENTER)
        switch.connect("notify::active", lambda s, _p: None if self._drawing else access.set_device(s.get_active()))
        self.device_switch = switch
        row.append(switch)
        return row

    # following the state
    def _level_toggled(self, button: Gtk.ToggleButton, key: str) -> None:
        if self._drawing or not button.get_active() or self.access is None:
            return
        self.access.set_level(key)

    def _folder_toggled(self, chip: Gtk.ToggleButton, name: str) -> None:
        if not self._drawing and self.access is not None:
            self.access.set_folder(name, chip.get_active())

    def _use_toggled(self, chip: Gtk.ToggleButton, use: str) -> None:
        if not self._drawing and self.access is not None:
            self.access.set_use(use, chip.get_active())

    def _sync(self) -> None:
        """Bring the widgets in line with the state, without redrawing (focus stays put)."""
        access = self.access
        if access is None:
            return
        self._drawing = True
        try:
            for key, button in self.level_buttons.items():
                button.set_active(access.level == key)
                button._tick.set_visible(access.level == key)  # noqa: SLF001
                button._detail.set_label(access.level_detail(key))  # noqa: SLF001
            for name, chip in self.folder_buttons.items():
                chip.set_active(name in access.folders)
            self.chooser.set_visible(access.chooser_open())
            for use, chip in self.use_buttons.items():
                chip.set_active(access.allowed.get(use, True))
                title = next(title for key, title, _icon in USES if key == use)
                chip.set_tooltip_text(title + (": allowed" if chip.get_active() else ": blocked"))
            if self.device_switch is not None:
                self.device_switch.set_active(access.device_granted)
        finally:
            self._drawing = False

    def focus_level(self) -> None:
        """TV: remote focus starts on the selected file level."""
        if self.access is not None and self.access.level in self.level_buttons:
            GLib.idle_add(lambda: self.level_buttons[self.access.level].grab_focus() and False)


__all__ = ["Access", "AccessSheet", "LEVELS", "USES", "NEVER", "REVIEW", "home_folders"]
