# SPDX-License-Identifier: Apache-2.0
"""Where a .deb or .rpm without a launcher goes (ADR-052 Amendment 1, steps 4.3 and 4.4).

A package file with a visible launcher keeps today's route: the store, then the
capsule. Everything else goes through the classifier (classify.py) and is placed
on a route that exists today:

* a console application: the store, sandboxed, its command exported;
* a system module or system tool from an .rpm: the privileged helper's layering,
  labelled full control, behind the administrator prompt.

A kind with no route yet (workspaces, Ubuntu system modules, add-ons, sources,
device rules on their own, Suno's kernel-module builds) is never installed some
other way: the placement says plainly that it can't be installed yet, and why.

Release policy (2026-11-25): only a reviewed entry of the curated list decides
without asking. Every other outcome, from the list or the rules, is asked; an
outcome that changes the system is always asked, and is never preselected.
"""
from __future__ import annotations

import configparser
import dataclasses
import io
import re
import subprocess
import tarfile
from dataclasses import dataclass
from pathlib import Path

from . import classify as c

CONSOLE = "console"   # the store: a sandboxed console application
SYSTEM = "system"     # Suno-installer-system: layered into the image, full control

#: The release a package file is classified for when its own metadata cannot say.
DEFAULT_RELEASES = {"deb": "ubuntu-24.04", "rpm": "fedora-45"}
LAUNCHER_FOLDERS = ("/usr/share/applications/", "/usr/local/share/applications/")
DESKTOP = re.compile(r"^/usr/(local/)?share/applications/[^/]+\.desktop$")
POLICY = re.compile(r"^/usr/share/polkit-1/actions/[^/]+\.policy$")
AUTOSTART = re.compile(r"^/etc/xdg/autostart/[^/]+\.desktop$")
SESSION_BUS = re.compile(r"^/usr/share/dbus-1/services/[^/]+\.service$")
COMMAND_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._+-]{0,63}")
PLAIN_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.+_-]*$")
READ_LIMIT = 1024 * 1024

WORDS = {c.APPLICATION: "an app", c.CONSOLE_APPLICATION: "a console app", c.WORKSPACE: "a workspace package",
         c.SYSTEM_MODULE: "a system module", c.SYSTEM_TOOL: "a system tool", c.DEVICE_ADD_ON: "an add-on",
         c.DEVICE_REQUEST: "device rules", c.SOURCE: "a software source"}
FAMILY = {"deb": "Debian and Ubuntu", "rpm": "Fedora"}


@dataclass(frozen=True)
class Option:
    kind: str           # what it installs as (a classifier kind)
    route: str          # CONSOLE or SYSTEM
    label: str          # plain words for the sheet and the terminal
    full_control: bool  # changes the system: the full-control label and the administrator prompt


@dataclass(frozen=True)
class Placement:
    package: str
    family: str                    # "deb" or "rpm"
    kind: str                      # the classifier's kind (CHOICE for a choice)
    options: tuple[Option, ...]    # what can be installed, sandboxed first
    default: str                   # the option preselected; "" when only full control is possible
    ask: bool                      # the person answers before anything is installed
    unavailable: str = ""          # nothing can be installed from this file: why, in plain words
    notice: str = ""               # shown with the outcome (an inert service, a root tool left out)
    reasons: tuple[str, ...] = ()
    command: str = ""              # the console route's program
    source: str = "rules"
    chosen: str = ""               # the kind being installed (the default, or the person's answer)

    def option(self, kind: str) -> Option | None:
        return next((option for option in self.options if option.kind == kind), None)

    def to_json(self) -> dict:
        data = dataclasses.asdict(self)
        data["options"] = [dataclasses.asdict(option) for option in self.options]
        return data

    @classmethod
    def from_json(cls, data: dict) -> "Placement":
        values = dict(data)
        values["options"] = tuple(Option(**option) for option in values.get("options", ()))
        values["reasons"] = tuple(values.get("reasons", ()))
        return cls(**values)


# -- facts from the file, read without running anything from it ----------------------------

def _desktop(path: str, text: str) -> c.DesktopEntry | None:
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string(text)
    except configparser.Error:
        return None
    if not parser.has_section("Desktop Entry"):
        return None
    entry = parser["Desktop Entry"]
    if entry.get("Type", "Application").strip() != "Application":
        return None
    hidden = any(entry.get(key, "false").strip().lower() == "true" for key in ("NoDisplay", "Hidden"))
    return c.DesktopEntry(path, entry.get("Exec", "").strip() or None, hidden,
                          entry.get("Terminal", "false").strip().lower() == "true",
                          tuple(item for item in entry.get("Categories", "").split(";") if item))


def _exec_line(text: str) -> str:
    match = re.search(r"^Exec\s*=\s*(.+)$", text, re.M)
    return match.group(1).strip() if match else ""


def _wanted(path: str) -> bool:
    return any(pattern.match(path) for pattern in (DESKTOP, POLICY, AUTOSTART, SESSION_BUS))


class _Reader:
    def __init__(self) -> None:
        self.files: list[str] = []
        self.setuid: list[str] = []
        self.capabilities: list[str] = []
        self.desktop: list[c.DesktopEntry] = []
        self.policies: list[c.Policy] = []
        self.autostart: list[tuple[str, str]] = []
        self.session: list[tuple[str, str]] = []

    def read(self, path: str, text: str) -> None:
        if DESKTOP.match(path):
            entry = _desktop(path, text)
            if entry is not None:
                self.desktop.append(entry)
        elif POLICY.match(path):
            found = re.findall(r'org\.freedesktop\.policykit\.exec\.path"\s*>\s*([^<\s]+)\s*<', text)
            self.policies.append(c.Policy(path, tuple(sorted(set(found)))))
        elif AUTOSTART.match(path):
            self.autostart.append((path, _exec_line(text)))
        elif SESSION_BUS.match(path):
            self.session.append((path, _exec_line(text)))


def _run(arguments: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(arguments, capture_output=True, check=False, timeout=120,
                          env={"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C.UTF-8"})


def _names(values: list[str]) -> tuple[str, ...]:
    """Package names from Depends/Requires: the first alternative, without versions; rpm's
    file and soname requirements are left out."""
    names = []
    for value in values:
        name = value.split("|", 1)[0].strip().split(" ", 1)[0].split("(", 1)[0].split(":", 1)[0]
        if PLAIN_NAME.match(name) and name not in names:
            names.append(name)
    return tuple(names)


def read_deb(path: Path) -> c.PackageInfo:
    def field(name: str) -> str:
        return _run(["dpkg-deb", "-f", str(path), name]).stdout.decode("utf-8", "replace").strip()
    fields = {name: field(name) for name in ("Package", "Version", "Architecture", "Section", "Priority",
                                             "Description", "Source", "Pre-Depends", "Depends")}
    if not fields["Package"]:
        raise ValueError("not a Debian package")
    reader = _Reader()
    data = subprocess.Popen(["dpkg-deb", "--fsys-tarfile", str(path)], stdout=subprocess.PIPE)
    try:
        with tarfile.open(fileobj=data.stdout, mode="r|*") as archive:
            for member in archive:
                name = "/" + member.name.lstrip("./")
                if member.isdir():
                    continue
                reader.files.append(name)
                if member.isfile() and member.mode & 0o6000:
                    reader.setuid.append(name)
                if member.isfile() and member.size < READ_LIMIT and _wanted(name):
                    reader.read(name, archive.extractfile(member).read().decode("utf-8", "replace"))
    finally:
        data.stdout.close()
        data.wait()
    scripts = []
    control = subprocess.Popen(["dpkg-deb", "--ctrl-tarfile", str(path)], stdout=subprocess.PIPE)
    try:
        with tarfile.open(fileobj=control.stdout, mode="r|*") as archive:
            for member in archive:
                name = member.name.lstrip("./")
                if member.isfile() and name in ("preinst", "postinst", "prerm", "postrm", "triggers", "config"):
                    scripts.append(name)
    finally:
        control.stdout.close()
        control.wait()
    depends = [part for key in ("Pre-Depends", "Depends") for part in fields[key].split(",") if part.strip()]
    return c.PackageInfo(fields["Package"], fields["Version"], "deb", fields["Architecture"],
                         {key: fields[key] for key in ("Section", "Priority", "Description", "Source") if fields[key]},
                         _names(depends), files=tuple(reader.files), scripts=tuple(scripts),
                         desktop=tuple(reader.desktop), policies=tuple(reader.policies), setuid=tuple(reader.setuid),
                         autostart=tuple(reader.autostart), session_services=tuple(reader.session))


def _cpio_members(stream):
    """(name, mode, data or None) of a newc cpio stream; data only for wanted small files."""
    while True:
        header = stream.read(110)
        if len(header) < 110 or header[:6] not in (b"070701", b"070702"):
            return
        mode = int(header[14:22], 16)
        size = int(header[54:62], 16)
        name_size = int(header[94:102], 16)
        name = stream.read(name_size)[:-1].decode("utf-8", "replace")
        stream.read((4 - (110 + name_size) % 4) % 4)
        if name == "TRAILER!!!":
            return
        path = "/" + name.lstrip("./")
        wanted = (mode & 0o170000) == 0o100000 and size < READ_LIMIT and _wanted(path)
        data = stream.read(size) if wanted else None
        if not wanted:
            remaining = size
            while remaining:
                chunk = stream.read(min(remaining, 1 << 20))
                if not chunk:
                    return
                remaining -= len(chunk)
        stream.read((4 - size % 4) % 4)
        yield path, data


def read_rpm(path: Path) -> c.PackageInfo:
    head = _run(["rpm", "-qp", "--nosignature", "--nodigest", "--qf",
                 "%{NAME}\n%{VERSION}-%{RELEASE}\n%{ARCH}\n%{GROUP}\n%{SOURCERPM}\n%{SUMMARY}\n", str(path)])
    values = head.stdout.decode("utf-8", "replace").split("\n") + [""] * 6
    if head.returncode != 0 or not values[0]:
        raise ValueError("not an RPM package")
    listing = _run(["rpm", "-qp", "--nosignature", "--nodigest", "--qf",
                    "[%{FILEMODES}\t%{FILECAPS}\t%{FILENAMES}\n]", str(path)]).stdout.decode("utf-8", "replace")
    reader = _Reader()
    for line in listing.splitlines():
        mode, caps, name = (line.split("\t", 2) + ["", ""])[:3]
        mode = int(mode or 0) if mode.lstrip("-").isdigit() else 0
        if not name or (mode & 0o170000) == 0o040000:
            continue
        reader.files.append(name)
        if (mode & 0o170000) == 0o100000 and mode & 0o6000:
            reader.setuid.append(name)
        if "cap_" in caps.lower():
            reader.capabilities.append(name)
    if any(_wanted(name) for name in reader.files):
        payload = subprocess.Popen(["rpm2cpio", str(path)], stdout=subprocess.PIPE)
        try:
            for name, data in _cpio_members(io.BufferedReader(payload.stdout)):
                if data is not None:
                    reader.read(name, data.decode("utf-8", "replace"))
        finally:
            payload.stdout.close()
            payload.wait()
    scripts = _run(["rpm", "-qp", "--nosignature", "--nodigest", "--scripts", str(path)]).stdout.decode("utf-8", "replace")
    requires = _run(["rpm", "-qp", "--nosignature", "--nodigest", "--requires", str(path)]).stdout.decode("utf-8", "replace")
    fields = {"Group": values[3], "Source": values[4], "Description": values[5]}
    return c.PackageInfo(values[0], values[1], "rpm", values[2], {key: value for key, value in fields.items() if value},
                         _names(requires.splitlines()), files=tuple(reader.files),
                         scripts=tuple(sorted(set(re.findall(r"^(\w+) scriptlet", scripts, re.M)))),
                         desktop=tuple(reader.desktop), policies=tuple(reader.policies), setuid=tuple(reader.setuid),
                         capabilities=tuple(reader.capabilities), autostart=tuple(reader.autostart),
                         session_services=tuple(reader.session))


def has_launcher(package: c.PackageInfo) -> bool:
    """A launcher a person sees: such a package keeps today's application route."""
    return any(entry.path.startswith(LAUNCHER_FOLDERS) and not entry.no_display for entry in package.desktop)


def main_command(package: c.PackageInfo) -> str:
    """The program a console application starts as: the one named like the package, else
    the only one it has, else the first by name. '' when it has none."""
    programs = sorted({path for path in package.files if path.startswith(c.BIN_DIRECTORIES)
                       and COMMAND_NAME.fullmatch(Path(path).name)}, key=lambda path: (Path(path).name, path))
    if not programs:
        return ""
    names = [package.name, package.name.split("-")[0], re.sub(r"-(cli|bin|tools|utils)$", "", package.name)]
    for name in names:
        for path in programs:
            if Path(path).name == name:
                return path
    return programs[0]


# -- the decision --------------------------------------------------------------------------

def _not_yet(kind: str, family: str, result: c.Classification, arrival: str) -> str:
    """Why KIND has no route today (one sentence), or '' when it has one."""
    if kind == c.WORKSPACE and arrival != c.FILE:
        return "Workspaces, where command-line and developer tools share your rights, aren't ready yet."
    if kind in (c.SYSTEM_MODULE, c.SYSTEM_TOOL):
        if result.module.startswith("module:"):
            return (f"Suno builds the kernel module {result.module.split(':', 1)[1]} with its own kernels; "
                    "that build isn't ready yet. Modules are never built on the device.")
        if family != "rpm":
            return (f"It is {WORDS[kind]} for {FAMILY.get(family, family)}, and Suno can't install those yet. "
                    "Fedora packages of the same software can be installed with full control.")
        return ""
    if kind == c.APPLICATION:
        owner = f" ({result.add_on_of})" if result.add_on_of else ""
        return f"It is a part of another app{owner}, and Suno can't add parts to an installed app yet."
    if kind == c.DEVICE_ADD_ON:
        what = {"fonts": "Fonts", "codecs": "Codecs", "data": "Data packages"}.get(result.add_on, "Add-ons")
        return f"{what} from package files can't be installed yet. Nothing on Suno was changed."
    if kind == c.DEVICE_REQUEST:
        return ("It only carries device rules. Suno asks for that device access when you install the app "
                "that uses the device, so nothing is installed from this file.")
    if kind == c.SOURCE:
        return "It only adds a software source, and Suno can't add sources from a package file yet."
    return ""


def _candidates(result: c.Classification, arrival: str) -> list[str]:
    kinds = list(result.choices) if result.kind == c.CHOICE else [result.kind]
    if arrival == c.FILE:
        # A package file becomes a sandboxed console application; a workspace takes the
        # sheet's explicit full-access choice, which needs workspaces (step 4.2).
        kinds = [c.CONSOLE_APPLICATION if kind == c.WORKSPACE else kind for kind in kinds]
    return list(dict.fromkeys(kinds))


def decide(result: c.Classification, package: c.PackageInfo, *, arrival: str = c.FILE,
           store: bool = True) -> Placement:
    """The placement of a classified request. Pure: every route decision is here."""
    family = package.family
    command = main_command(package)
    base = dict(package=package.name, family=family, kind=result.kind, reasons=result.reasons,
                source=result.source, command=command)

    def unavailable(why: str) -> Placement:
        return Placement(options=(), default="", ask=False, unavailable=why, **base)

    if c.GUI_LAUNCHER in result.flags or has_launcher(package):
        # Never decided here: a launcher a person sees keeps the application route.
        return unavailable("It has a window of its own, so it installs as an app.")
    if c.host_provided(package.name, family) or c.IMAGE_HAS_NAME in result.flags:
        return unavailable(f"Suno already has its own {package.name}, so the file isn't needed.")
    if result.module.startswith("image:"):
        return unavailable(f"Suno already includes {result.module.split(':', 1)[1]}; it loads when it is needed.")
    if result.refused:
        return unavailable(f"It can't be installed on Suno: {result.refused}.")
    options, missing = [], []
    for kind in _candidates(result, arrival):
        why = _not_yet(kind, family, result, arrival)
        if not why and kind == c.CONSOLE_APPLICATION:
            if not command:
                why = "It has no command of its own to run, and workspaces for libraries and tools aren't ready yet."
            elif not store:
                why = "Console apps install through Suno's application store, which is off on this device."
        if why:
            missing.append(why)
        elif kind == c.CONSOLE_APPLICATION:
            options.append(Option(kind, CONSOLE, f"A console app in its own sandbox; {Path(command).name} "
                                                 "is ready in Terminal", False))
        elif kind in c.SYSTEM_KINDS:
            options.append(Option(kind, SYSTEM, f"{WORDS[kind].capitalize()} with full control of this "
                                                "computer, added to Suno's system image", True))
        else:  # a kind with no route that _not_yet did not name: never installed some other way
            missing.append(f"Suno can't install {WORDS.get(kind, kind)} from a package file yet.")
    if not options:
        return unavailable(missing[0] if missing else "Suno can't tell what kind of package this is.")
    options.sort(key=lambda option: option.full_control)
    default = next((option.kind for option in options if not option.full_control), "")
    reviewed = c.REVIEWED in result.flags and not result.ask
    # Release policy: silent only for a reviewed decision with one sandboxed outcome.
    ask = not (reviewed and default and default == result.default and len(options) == 1)
    notice = _notice(result, options, default, family)
    return Placement(options=tuple(options), default=default, ask=ask, notice=notice,
                     chosen=default or options[0].kind, **base)


def _notice(result: c.Classification, options: list[Option], default: str, family: str) -> str:
    """What a sandboxed outcome leaves out: a service or a tool needing root stays off."""
    system = [kind for kind in _candidates(result, c.COMMAND) if kind in c.SYSTEM_KINDS]
    flagged = set(result.flags) & {c.OPTIONAL_SERVICE, c.PRIVILEGE_DROPPED, c.CLI_ADMIN}
    if not default or not (system or flagged or result.notice):
        return ""
    what = "a tool that needs root" if c.SYSTEM_TOOL in system or c.PRIVILEGE_DROPPED in flagged else "a service"
    if any(option.full_control for option in options):
        rest = f" You can install it as {WORDS[system[0] if system else c.SYSTEM_MODULE]} with full control instead."
    else:
        rest = f" Running it needs a system module, which Suno can't install for {FAMILY.get(family, family)} yet."
    return f"It also carries {what}, which stays off in its sandbox.{rest}"


def release_for(path: Path, family: str) -> str:
    try:
        from . import closure
        candidates = closure.candidate_userlands(closure.read_package(path))
        if candidates:
            return candidates[0]
    except Exception:  # noqa: BLE001 - the classifier's release only tunes its lists
        pass
    return DEFAULT_RELEASES[family]


def for_file(path: Path, family: str, *, store: bool | None = None) -> Placement | None:
    """The placement of a package file, or None when it has a launcher (today's route)."""
    package = read_deb(path) if family == "deb" else read_rpm(path)
    if has_launcher(package):
        return None
    if store is None:
        from . import store_install
        store = store_install.enabled()
    request = c.Request(package, arrival=c.FILE, release=release_for(path, family), origin="file")
    return decide(c.classify(request), package, arrival=c.FILE, store=store)


def choose(placement: Placement, kind: str) -> Placement:
    """The placement with the person's answer; refused when that kind is not offered."""
    if placement.option(kind) is None:
        offered = ", ".join(option.kind for option in placement.options) or "nothing"
        raise ValueError(f"{placement.package} can't be installed as {kind}; offered: {offered}")
    return dataclasses.replace(placement, chosen=kind)


# -- the gates (tools/classify-labelled-set/run.py's predicates, on the wired path) --------

def harmful(placement: Placement, labelled: str = "") -> list[str]:
    """Why this placement breaks a gate ([] when it does not). LABELLED is the kind a
    person would give it, when known; without it the classifier's own kind stands in."""
    found = []
    label = labelled or (placement.kind if placement.kind != c.CHOICE else "")
    preselected = placement.option(placement.default) if placement.default else None
    silent = not placement.ask and not placement.unavailable
    if preselected is not None and preselected.full_control:
        found.append("a full-control route is preselected")
    if silent and any(option.full_control for option in placement.options):
        found.append("a system change without asking")
    if label == c.APPLICATION and silent and preselected is not None and preselected.full_control:
        found.append("an app goes to the system silently")
    if label not in c.SYSTEM_KINDS and silent and preselected is not None and preselected.full_control:
        found.append("a non-system package goes to the system silently")
    if label in c.SYSTEM_KINDS and preselected is not None and not preselected.full_control and not placement.notice:
        found.append("a system package breaks silently (sandboxed, no notice)")
    if placement.unavailable and placement.options:
        found.append("unavailable but offering options")
    if not placement.unavailable and not placement.options:
        found.append("nothing to install and no reason given")
    return found


# -- the report the sheet and the terminal show --------------------------------------------

def report_for(report, placement: Placement):
    """REPORT (model.PackageReport) as PLACEMENT installs it: its destination, the words the
    sheet shows, and whether the system changes (the administrator prompt and its approval)."""
    title = report.title
    if placement.unavailable:
        return dataclasses.replace(
            report, placement=placement.to_json(), destination="Not installed", requires_system_change=False,
            requires_restart=False, warnings=(f"{title} can't be installed yet. {placement.unavailable}",),
            permissions=())
    option = placement.option(placement.chosen) or placement.options[0]
    details = {**report.details, "Installs as": option.label}
    if option.full_control:
        warnings = [f"Full control of this computer. {title} is added to Suno's system image, and its "
                    "maintainer scripts run with system privilege.",
                    "It usually works right away; a change that can't be applied to the running system waits "
                    "for a restart. It stays through updates and can be rolled back."]
        destination, permissions = "Suno's system image (full control)", ("Install system files",
                                                                         "Add to Suno's system image")
    else:
        name = Path(placement.command).name
        warnings = [f"{title} becomes a console app in its own sandbox: {name} is ready in Terminal.",
                    "Its dependencies and maintainer scripts stay inside that sandbox."]
        destination = "Private console app"
        permissions = ("Use network while resolving declared dependencies", "Keep private application data")
    if placement.notice:
        warnings.append(placement.notice)
    return dataclasses.replace(report, placement=placement.to_json(), destination=destination,
                               permissions=permissions, warnings=tuple(warnings), details=details,
                               requires_system_change=option.full_control, requires_restart=option.full_control)
