# SPDX-License-Identifier: Apache-2.0
"""What a package is, from its metadata (ADR-052 Amendment 1, section 2, "Classification").

``classify`` is a pure function. It reads the top-level package and the
non-baseline dependencies the request brings (``own_dependencies`` computes
them) and says which of Suno's classes the request becomes, why, and which
hard cases it touches. Of those dependencies it judges the request's own parts:
meta-package members and packages built from the same source. Other projects'
packages count only for kernel modules; their daemons stay inert and their
launchers do not make an application (over the labelled set the full closure
pulled in httpd, podman, libvirt and LibreOffice for requests that are none of
those):

  application          a launcher that runs a program from the package
  console-application  a command-line package opened from Files or Depot: sandboxed
  workspace            a command-line package entered through a typed command,
                       Suno's signed list or the sheet's "Full access" choice
  system-module        services, kernel modules, PAM/NSS, polkit rules, firmware,
                       login shells, printer drivers, desktop environments
  system-tool          polkit exec.path, setuid/setgid/capabilities, pkexec launchers:
                       a system module labelled "full control of this computer"
  device-add-on        fonts and data add-ons (per person), codecs (per release),
                       native session add-ons (image-signed module or refused)
  device-request       udev rules only: written to the device on a grant
  source               a package that only adds a repository and its key
  choice               signals conflict or a fact could not be read: ``choices`` lists the
                       candidate kinds and the person picks (never a silent system module)

Categories never grant workspace entry, and daemons the device provides
(data/classify/host-provided.txt) are never judged. Nothing here runs package
code or touches the system; the data lists are read once.
"""
from __future__ import annotations

import fnmatch
import os
import re
import shlex
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Mapping

APPLICATION = "application"
CONSOLE_APPLICATION = "console-application"
WORKSPACE = "workspace"
SYSTEM_MODULE = "system-module"
SYSTEM_TOOL = "system-tool"
DEVICE_ADD_ON = "device-add-on"
DEVICE_REQUEST = "device-request"
SOURCE = "source"
CHOICE = "choice"  # signals conflict or confidence is low: the person chooses among ``choices``
KINDS = (APPLICATION, CONSOLE_APPLICATION, WORKSPACE, SYSTEM_MODULE, SYSTEM_TOOL, DEVICE_ADD_ON,
         DEVICE_REQUEST, SOURCE, CHOICE)

# The rules' version: recorded in curated lists, reports and records.
CLASSIFIER_VERSION = "2026.11.25.4"

# How the request arrived (section 2, rule 7).
COMMAND = "command"            # apt/dnf typed or run by the person's own script
COMMAND_FILE = "command-file"  # apt install ./x.deb, dnf install ./x.rpm typed
FILE = "file"                  # a package file opened from Files or Depot
SIGNED_LIST = "signed-list"    # Suno's signed list (editors, IDEs, toolchains)
SHEET_FULL_ACCESS = "sheet-full-access"  # the sheet's "Full access to your home and SSH keys"
ARRIVALS = (COMMAND, COMMAND_FILE, FILE, SIGNED_LIST, SHEET_FULL_ACCESS)
WORKSPACE_ENTRIES = (COMMAND, COMMAND_FILE, SIGNED_LIST, SHEET_FULL_ACCESS)

# Hard-case flags.
SNAP_TRANSITIONAL = "snap-transitional"
ELECTRON_CLI = "electron-cli"
APP_SERVICE_SPLIT = "app-service-split"
KERNEL_MODULE = "kernel-module"
VENDOR_REPO_ONLY = "vendor-repo-only"
META_PACKAGE = "meta-package"
TRANSITIONAL = "transitional"
REPOSITORY_PACKAGE = "repository-package"
DESKTOP_ENVIRONMENT = "desktop-environment"
LOGIN_SHELL = "login-shell"
USER_SERVICE = "user-service"
TERMINAL_EMULATOR = "terminal-emulator"
INTERPRETER_MODULE = "interpreter-module"
IMAGE_HAS_NAME = "image-has-name"
WINDOWS_RUNTIME = "windows-runtime"
STEAM = "steam"
IN_DEPOT = "in-depot"
DEVICE_RULES = "device-rules"
DEPENDENCY_DAEMON_INERT = "dependency-daemon-inert"
HELPER_DROPPED = "privileged-helper-dropped"
OPTIONAL_SERVICE = "optional-service-inert"
PRIVILEGE_DROPPED = "privilege-dropped"
HOST_INTEGRATION = "host-integration"
CLI_ADMIN = "cli-admin"
DESKTOP_COMPONENT = "desktop-component"
APPLICATION_ADD_ON = "application-add-on"
SIGNED_SYSTEM_MODULE = "signed-system-module"
GUI_LAUNCHER = "gui-launcher"  # the request ships a launcher a person sees: never silently a workspace or add-on
DEVELOPMENT = "development"
WORKSPACE_IF_RESOLVES = "workspace-if-resolves"
IDE = "ide"

DATA_ENVIRONMENT = "SUNO_CLASSIFY_DATA"
DATA_DIRECTORIES = (Path("/usr/share/Suno/installer/classify"),
                    Path(__file__).resolve().parent.parent / "data/classify")


@dataclass(frozen=True)
class DesktopEntry:
    """One launcher. ``None`` means the value is not known (index metadata)."""
    path: str
    exec: str | None = None
    no_display: bool | None = False
    terminal: bool = False
    categories: tuple[str, ...] = ()


@dataclass(frozen=True)
class Policy:
    """A polkit .policy file and the exec.path annotations it declares (``None``: not read)."""
    path: str
    exec_paths: tuple[str, ...] | None = ()


@dataclass(frozen=True)
class PackageInfo:
    name: str
    version: str = ""
    family: str = "deb"   # "deb" or "rpm"
    architecture: str = ""
    fields: Mapping[str, str] = field(default_factory=dict)  # Section, Description, Priority, Group, Source ...
    depends: tuple[str, ...] = ()      # names (Depends + Pre-Depends, or Requires resolved to names)
    recommends: tuple[str, ...] = ()
    provides: tuple[str, ...] = ()
    files: tuple[str, ...] = ()        # absolute paths, regular files and links
    scripts: tuple[str, ...] = ()      # maintainer scripts present: postinst, %post ...
    desktop: tuple[DesktopEntry, ...] = ()
    policies: tuple[Policy, ...] = ()
    setuid: tuple[str, ...] = ()       # setuid or setgid files
    capabilities: tuple[str, ...] = ()  # files with file capabilities
    autostart: tuple[tuple[str, str], ...] = ()         # /etc/xdg/autostart entries: (path, Exec)
    session_services: tuple[tuple[str, str], ...] = ()  # session D-Bus services: (path, Exec)


@dataclass(frozen=True)
class Request:
    package: PackageInfo
    dependencies: tuple[PackageInfo, ...] = ()  # own dependencies (own_dependencies)
    arrival: str = COMMAND
    release: str = ""            # "ubuntu-24.04", "fedora-45" ...
    origin: str = "distribution"  # "distribution", "vendor" (a vendor's repository), "file"
    image_has_name: bool = False
    in_depot: bool = False
    dependents: tuple[PackageInfo, ...] = ()  # packages of the same source that depend on this one
    curated: bool = True          # consult the curated list first (data/classify/curated-<release>.json)


@dataclass(frozen=True)
class Classification:
    kind: str
    reasons: tuple[str, ...]
    flags: tuple[str, ...] = ()
    parts: tuple[tuple[str, tuple[str, ...]], ...] = ()  # split: (kind, packages)
    module: str = ""          # kmod map: "image:v4l2loopback", "module:nvidia"
    add_on: str = ""          # device add-ons: "data", "fonts", "codecs", "drivers", "session"
    add_on_of: str = ""       # an application add-on: added to this application's tree
    device_rules: tuple[str, ...] = ()
    refused: str = ""         # non-empty: refused, with the reason
    fallback: str = ""        # the alternative when the kind cannot be completed
    choices: tuple[str, ...] = ()  # kind "choice": the candidate kinds, most likely first
    default: str = ""         # what is installed without asking (DEFAULT-RULE): never a system kind for a choice
    ask: bool = False         # the person is asked before anything is installed
    notice: str = ""          # shown after an install whose package also carries a service or root tool
    source: str = "rules"     # "rules", or "curated:<entry source>"

    def to_json(self) -> dict[str, object]:
        out: dict[str, object] = {"kind": self.kind, "reasons": list(self.reasons)}
        for name in ("flags", "module", "add_on", "add_on_of", "device_rules", "refused", "fallback", "choices",
                     "default", "ask", "notice", "source"):
            value = getattr(self, name)
            if value:
                out[name] = list(value) if isinstance(value, tuple) else value
        if self.parts:
            out["parts"] = [{"kind": kind, "packages": list(names)} for kind, names in self.parts]
        return out


# -- data lists ---------------------------------------------------------------------------

def _data_file(name: str) -> Path | None:
    candidates = [Path(os.environ[DATA_ENVIRONMENT]) / name] if os.environ.get(DATA_ENVIRONMENT) else []
    candidates += [directory / name for directory in DATA_DIRECTORIES]
    return next((path for path in candidates if path.is_file()), None)


@lru_cache(maxsize=None)
def data_sections(name: str) -> dict[str, tuple[str, ...]]:
    """``{section: lines}`` of a data file: '#' comments, '[section]' headers, one entry per line."""
    path = _data_file(name)
    if path is None:
        raise FileNotFoundError(f"classifier data {name} is not installed")
    sections: dict[str, list[str]] = {"": []}
    current = ""
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1].strip()
            sections.setdefault(current, [])
            continue
        sections[current].append(line)
    return {key: tuple(value) for key, value in sections.items()}


def _matches(value: str, patterns: Iterable[str]) -> bool:
    return any(fnmatch.fnmatchcase(value, pattern) for pattern in patterns)


def host_provided(name: str, family: str) -> bool:
    return _matches(name, data_sections("host-provided.txt").get(family, ()))


def kmod_mapping(name: str) -> str:
    """'image:<m>', 'module:<m>' or 'refuse' for a kernel-module package name."""
    for line in data_sections("kmod-map.txt")[""]:
        pattern, _, target = line.partition(" ")
        if fnmatch.fnmatchcase(name, pattern.strip()):
            return target.strip() or "refuse"
    return "refuse"


# -- paths --------------------------------------------------------------------------------

_SYSTEM_UNIT = re.compile(r"^/(usr/)?lib/systemd/system/[^/]+\.(service|socket|timer)$|"
                          r"^/etc/systemd/system/[^/]+\.(service|socket|timer)$")
_USER_UNIT = re.compile(r"^/(usr/)?lib/systemd/user/([^/]+)\.(service|socket|timer)$|"
                        r"^/etc/systemd/user/([^/]+)\.(service|socket|timer)$")
_UNIT_NAME = re.compile(r"/([^/]+)\.(service|socket|timer)$")

# Rule 1: (label, patterns). Order is the order reasons are listed in.
SYSTEM_MARKERS: tuple[tuple[str, tuple[str, ...]], ...] = (
    # A kernel module sits under /lib/modules or /usr/lib/modules and ends in .ko, .ko.xz,
    # .ko.zst or .ko.gz: never a "tutor1.ko" tutorial or a "po.ko.js.gz" translation.
    ("kernel modules", tuple(f"{root}/*.ko{ending}" for root in ("/lib/modules", "/usr/lib/modules")
                             for ending in ("", ".xz", ".zst", ".gz"))),
    ("DKMS or akmod sources", ("/usr/src/*/dkms.conf", "/usr/src/akmods/*")),
    ("an init script", ("/etc/init.d/*", "/etc/rc.d/init.d/*")),
    ("a D-Bus system service", ("/usr/share/dbus-1/system-services/*", "/usr/share/dbus-1/system.d/*",
                                "/etc/dbus-1/system.d/*")),
    ("PAM modules", ("/lib/*/security/*.so", "/usr/lib/*/security/*.so", "/usr/lib64/security/*.so",
                     "/lib/security/*.so", "/usr/lib/security/*.so", "/lib64/security/*.so")),
    ("a PAM service configuration", ("/etc/pam.d/*", "/usr/lib/pam.d/*")),
    ("PAM stack profiles", ("/usr/share/pam-configs/*",)),
    ("NSS modules", ("/lib/*/libnss_*.so*", "/usr/lib/*/libnss_*.so*", "/usr/lib64/libnss_*.so*",
                     "/lib64/libnss_*.so*")),  # the C library's own (files, dns, compat ...) are excluded below
    ("polkit rules", ("/usr/share/polkit-1/rules.d/*", "/etc/polkit-1/rules.d/*",
                      "/var/lib/polkit-1/localauthority/*", "/etc/polkit-1/localauthority*")),
    ("binfmt registrations", ("/usr/lib/binfmt.d/*", "/etc/binfmt.d/*", "/usr/share/binfmts/*")),
    ("kernel settings", ("/usr/lib/sysctl.d/*", "/etc/sysctl.d/*", "/usr/lib/modprobe.d/*", "/lib/modprobe.d/*",
                         "/etc/modprobe.d/*", "/usr/lib/modules-load.d/*", "/etc/modules-load.d/*")),
    ("sudoers rules", ("/etc/sudoers.d/*", "/etc/sudoers")),
    ("firmware", ("/lib/firmware/*", "/usr/lib/firmware/*")),
    ("a mount helper", ("/sbin/mount.*", "/usr/sbin/mount.*", "/usr/bin/mount.*")),
    ("an init system", ("/sbin/init", "/usr/sbin/init", "/lib/systemd/systemd", "/usr/lib/systemd/systemd")),
    ("system unit configuration", ("/usr/lib/systemd/system/*.d/*", "/lib/systemd/system/*.d/*",
                                   "/etc/systemd/system/*.d/*", "/usr/lib/systemd/system-preset/*",
                                   "/lib/systemd/system-preset/*", "/usr/lib/systemd/*.conf.d/*",
                                   "/etc/systemd/*.conf.d/*")),
    ("a NetworkManager plugin or configuration", ("/usr/lib/NetworkManager/*", "/usr/lib64/NetworkManager/*",
                                                  "/usr/lib/*/NetworkManager/*", "/etc/NetworkManager/*")),
    ("boot chain hooks", ("/etc/grub.d/*", "/usr/share/initramfs-tools/*", "/etc/initramfs-tools/*",
                          "/etc/kernel/postinst.d/*", "/usr/lib/kernel/install.d/*", "/usr/lib/dracut/modules.d/*",
                          "/usr/lib/systemd/system-generators/*", "/lib/systemd/system-generators/*",
                          "/usr/lib/systemd/system-sleep/*", "/lib/systemd/system-sleep/*",
                          "/usr/share/plymouth/*", "/usr/lib/plymouth/*")),
    ("boot chain files", ("/boot/*", "/usr/lib/grub/*", "/usr/share/grub/*", "/usr/lib/efi/*", "/usr/lib/shim/*",
                          "/usr/lib/initramfs-tools/*", "/usr/lib/EXTLINUX/*", "/usr/lib/systemd/boot/*")),
    ("a display manager's greeter or theme", ("/usr/share/xgreeters/*", "/usr/share/lightdm/lightdm.conf.d/*",
                                              "/etc/lightdm/*", "/usr/share/sddm/themes/*", "/etc/sddm.conf.d/*",
                                              "/usr/lib/sddm/sddm.conf.d/*")),
    ("CUPS filters, backends or PPDs", ("/usr/lib/cups/filter/*", "/usr/lib/cups/backend/*", "/usr/share/ppd/*",
                                        "/usr/share/cups/model/*", "/usr/lib/cups/driver/*")),
    ("the X server or its drivers", ("/usr/lib/xorg/*", "/usr/lib64/xorg/*", "/usr/libexec/Xorg*", "/usr/bin/Xorg",
                                     "/usr/lib/xorg/modules/*")),
    ("smart-card reader drivers", ("/usr/lib*/pcsc/drivers/*", "/usr/lib/*/pcsc/drivers/*")),
)

# How much a rule-1 marker decides on its own (see _decide):
#   strong  the package exists for it: its own daemon's service, kernel and boot parts, firmware
#   ask     PAM and NSS modules, PAM service configurations, FUSE filesystems: always a choice,
#           unless the package is on Suno's signed list (data/classify/signed-list.txt)
#   weak    everything else: decides when the package has nothing for a person beside it
#           (no libraries, user commands or language modules), otherwise a choice
STRONG_MARKERS = ("system service", "kernel modules", "DKMS", "firmware", "boot chain", "an init system",
                  "the X server or its drivers", "a display manager's greeter", "a CUPS printer driver")
# System-wide configuration a package may consist of alone (ADR rule 1): a system module.
SYSTEM_CONFIGURATION = ("/etc/profile.d/*", "/etc/krb5.conf", "/etc/krb5.conf.d/*", "/etc/security/*", "/etc/ssh/*",
                        "/etc/issue.d/*", "/etc/motd.d/*", "/usr/lib/motd.d/*",
                        "/etc/environment.d/*", "/usr/lib/environment.d/*", "/etc/ld.so.conf.d/*", "/etc/login.defs")
ASK_MARKERS = ("PAM modules", "a PAM service configuration", "PAM stack profiles", "NSS modules", "a FUSE filesystem",
               "a mount helper", "package manager configuration")

DESKTOP_SESSIONS = ("/usr/share/xsessions/*.desktop", "/usr/share/wayland-sessions/*.desktop")
# The programs that are a desktop: shells, compositors, window managers, session and settings daemons.
DESKTOP_PROGRAMS = ("/usr/bin/gnome-shell", "/usr/bin/mutter", "/usr/libexec/gnome-session-binary",
                    "/usr/libexec/gsd-power", "/usr/libexec/gsd-xsettings", "/usr/lib/gnome-settings-daemon/gsd-power", "/usr/bin/plasmashell",
                    "/usr/bin/kwin_wayland", "/usr/bin/kwin_x11", "/usr/bin/sway", "/usr/bin/i3", "/usr/bin/xfwm4",
                    "/usr/bin/xfce4-session", "/usr/bin/cinnamon", "/usr/bin/muffin", "/usr/bin/marco",
                    "/usr/bin/mate-session", "/usr/bin/openbox", "/usr/bin/labwc", "/usr/bin/niri", "/usr/bin/Hyprland",
                    "/usr/bin/weston", "/usr/bin/wayfire", "/usr/bin/river", "/usr/bin/cosmic-comp", "/usr/bin/budgie-wm",
                    "/usr/bin/lxqt-session", "/usr/bin/lxsession", "/usr/bin/enlightenment", "/usr/bin/fluxbox",
                    "/usr/bin/awesome", "/usr/bin/bspwm", "/usr/bin/dwm", "/usr/bin/xmonad", "/usr/bin/cinnamon-session",
                    "/usr/bin/mate-session", "/usr/bin/startplasma-*", "/usr/bin/plasma_session",
                    "/usr/bin/startlxqt", "/usr/bin/startxfce4", "/usr/bin/budgie-desktop")
# Packages that are a desktop or its login screen: a meta-package that brings one is a
# desktop even when the device provides that member (it is then never an own dependency).
DESKTOP_PACKAGES = ("gdm", "gdm3", "gnome-shell", "gnome-session", "gnome-session-bin", "sddm", "lightdm", "lxdm",
                    "xfce4-session", "plasma-desktop", "plasma-workspace", "cinnamon", "mate-session-manager",
                    "budgie-desktop", "lxqt-session", "sway", "i3-wm", "cosmic-session")
DISPLAY_MANAGER_UNITS = ("display-manager", "gdm", "gdm3", "lightdm", "sddm", "lxdm", "xdm", "slim", "greetd",
                         "ly", "nodm", "cosmic-greeter", "plasmalogin")
LOGIN_SHELLS = ("bash", "zsh", "fish", "tcsh", "csh", "ksh", "ksh93", "mksh", "dash", "yash", "nushell", "nu",
                "xonsh", "elvish", "rbash", "posh", "rc", "es")
DEVICE_RULE_PATTERNS = ("/lib/udev/rules.d/*.rules", "/usr/lib/udev/rules.d/*.rules", "/etc/udev/rules.d/*.rules",
                        "/lib/udev/hwdb.d/*.hwdb", "/usr/lib/udev/hwdb.d/*.hwdb", "/etc/udev/hwdb.d/*.hwdb")
# A udev-only package: rules, hwdb data and udev's own helpers, with what only installs them
# (an initramfs or dracut copy, a unit that triggers udev). No daemon: a device request.
UDEV_ONLY = ("/lib/udev/*", "/usr/lib/udev/*", "/etc/udev/*", "/usr/lib/dracut/modules.d/*",
             "/usr/share/initramfs-tools/*", "/usr/lib/systemd/system/*", "/lib/systemd/system/*",
             "/usr/lib/systemd/network/*.link", "/lib/systemd/network/*.link", "/usr/lib/sysusers.d/*",
             "/usr/lib/tmpfiles.d/*")
SOURCE_PATTERNS = ("/etc/apt/sources.list.d/*", "/etc/apt/trusted.gpg.d/*", "/usr/share/keyrings/*",
                   "/usr/lib/fedora-third-party/*", "/etc/default/fedora-third-party", "/usr/share/dnf5/repos.d/*",
                   "/usr/share/flatpak/*.filter",
                   "/etc/apt/keyrings/*", "/etc/yum.repos.d/*", "/etc/pki/rpm-gpg/*", "/etc/distro.repos.d/*",
                   "/usr/share/flatpak/remotes.d/*", "/etc/flatpak/remotes.d/*")
# Cron jobs run as root: the system's job for a package that is only that; inert in an application's tree.
# Backends that load into a service the image runs.
HOST_INTEGRATION_PATTERNS = ("/usr/libexec/gvfs*", "/usr/lib/gvfs/*", "/usr/share/gvfs/*", "/usr/lib/*/gvfs/*",
                             "/usr/lib64/gvfs/*")
CRON_PATTERNS = ("/etc/cron.d/*", "/etc/cron.hourly/*", "/etc/cron.daily/*", "/etc/cron.weekly/*",
                 "/etc/cron.monthly/*")
# Privileged helpers kept out of the command path (/usr/libexec, a package's own /usr/lib folder):
# a helper the application can run without; named as not working instead of making a system tool.
HELPER_PATTERNS = ("/usr/libexec/*", "/usr/lib/*/*", "/usr/lib64/*/*", "/lib/*/*")
# Files that do not stop a package being an add-on when it has add-on files: its own libraries.
ADD_ON_NEUTRAL = ("/usr/share/gstreamer-1.0/*", "/etc/xdg/autostart/*", "/usr/share/pkgconfig/*",
                  "/usr/lib*/pkgconfig/*")
FONT_FILES = ("*.ttf", "*.otf", "*.ttc", "*.otc", "*.woff", "*.woff2", "*.pfb", "*.pfa", "*.pcf", "*.pcf.gz",
              "*.afm", "*.t1", "*.otb", "*.bdf", "*.bdf.gz", "*.pfm", "*.fon")
# TeX's fonts are TeX's data: they go with TeX into the workspace, not to the person's fonts.
TEX_FONTS = ("/usr/share/texlive/*", "/usr/share/texmf/*", "/usr/share/texmf-dist/*", "/usr/share/texmf-*")
# Files a person uses directly (rule 1's "user payload"): libraries, commands, language modules, headers.
USER_PAYLOAD = ("/usr/lib/mono/*", "/usr/lib/cli/*", "/usr/lib*/lib*.so*", "/lib*/lib*.so*", "/usr/lib/*/lib*.so*", "/usr/include/*",
                "/usr/lib/python3*", "/usr/lib*/python3*", "/usr/share/perl5/*", "/usr/lib/*/perl*", "/usr/lib*/perl5/*",
                "/usr/share/php/*", "/usr/share/php[0-9]*", "/usr/lib*/php*/*", "/usr/share/ruby/*", "/usr/lib*/ruby/*", "/usr/share/R/*",
                "/usr/lib/R/*", "/usr/share/gap*", "/usr/lib*/gap*", "/usr/share/java/*", "/usr/lib/node_modules/*",
                "/usr/share/nodejs/*", "/usr/share/lua/*", "/usr/lib*/lua/*", "/usr/share/emacs/*")
# Plugins that load into the desktop's own daemons (KDE's kded): a desktop component.
SYSTEM_MARKERS_ALL = tuple(pattern for _, patterns in SYSTEM_MARKERS for pattern in patterns)
DESKTOP_DAEMON_PLUGINS = ("/usr/lib*/qt*/plugins/kf*/kded/*", "/usr/lib/*/qt*/plugins/kf*/kded/*")
DEVELOPMENT_FILES = ("/usr/include/*", "/usr/lib*/pkgconfig/*", "/usr/share/pkgconfig/*", "/usr/lib*/cmake/*",
                     "/usr/lib/*/cmake/*", "/usr/share/gir-1.0/*", "/usr/share/vala/*", "/usr/share/aclocal/*")
DEV_LIBRARY = re.compile(r"^/usr/lib(64)?(/[^/]+-linux-gnu)?/lib[^/]*\.(so|a)$")
SHARED_LIBRARY = re.compile(r"^/(usr/)?lib(64)?(/[^/]+-linux-gnu)?/lib[^/]*\.so")
# The files of a desktop component: a session daemon that starts with every desktop session.
SESSION_COMPONENT = ("/etc/xdg/autostart/*", "/usr/lib/systemd/user/graphical-session*", "/usr/share/dbus-1/services/*",
                     "/usr/lib/systemd/user/*.service", "/usr/libexec/polkit-*agent*", "/usr/lib/*/polkit-*agent*",
                     "/usr/lib*/libexec/polkit-*agent*")
# Package managers' own configuration: a package that is only this changes the system's package tool.
PACKAGE_MANAGER_CONFIG = ("/etc/apt/apt.conf.d/*", "/etc/apt/preferences.d/*", "/etc/dnf/*", "/etc/yum/*",
                          "/usr/share/dnf5/libdnf.conf.d/*", "/etc/dnf/libdnf5.conf.d/*")

# Files that say nothing about what a package is: documentation, licences,
# translations, metadata, packaging notes, the package's own icons and schemas.
NEUTRAL = ("/usr/share/doc/*", "/usr/share/doc-base/*", "/usr/share/man/*", "/usr/share/info/*",
           "/usr/share/locale/*", "/usr/share/lintian/*", "/usr/share/bug/*", "/usr/share/licenses/*",
           "/usr/share/metainfo/*", "/usr/share/appdata/*", "/usr/share/menu/*", "/usr/share/pixmaps/*",
           "/usr/share/icons/hicolor/[0-9s]*", "/usr/share/glib-2.0/schemas/*", "/usr/share/help/*",
           "/usr/share/gnome/help/*", "/usr/share/mime/packages/*", "/usr/share/applications/*",
           "/etc/logrotate.d/*", "/usr/share/bash-completion/*", "/usr/share/zsh/*", "/usr/share/fish/*",
           "/usr/lib/.build-id/*", "/usr/share/package-notes/*", "/usr/share/apport/*")
BIN_DIRECTORIES = ("/usr/bin/", "/usr/sbin/", "/bin/", "/sbin/", "/usr/games/", "/usr/local/bin/")
PROGRAM_PATTERNS = ("/usr/bin/*", "/usr/sbin/*", "/bin/*", "/sbin/*", "/usr/games/*", "/usr/libexec/*", "/opt/*",
                    "/usr/lib/*/bin/*", "/usr/share/*/bin/*")
# Programs that start an application by its ID or script: the application is the package's.
LAUNCH_WRAPPERS = ("gapplication", "gjs", "gjs-console", "flatpak-spawn")
ELECTRON_MARKERS = ("*/resources/app.asar", "*/resources/app/package.json", "*/chrome_100_percent.pak",
                    "*/libEGL.so", "*/snapshot_blob.bin", "*/v8_context_snapshot.bin")
# Interpreters the image carries: modules for them land in the workspace with its interpreter.
IMAGE_INTERPRETERS = {"deb": ("python3-*", "lib*-perl", "perl-*"), "rpm": ("python3-*", "perl-*")}
WINDOWS_RUNTIME_NAMES = ("wine", "wine32", "wine64", "wine-stable", "wine-development", "wine32:i386", "wine-core",
                         "wine-*-amd64", "wine-*-i386")
STEAM_NAMES = ("steam", "steam-installer", "steam-launcher", "steam:i386")


def _any(files: Iterable[str], patterns: Iterable[str]) -> list[str]:
    patterns = tuple(patterns)
    return [path for path in files if _matches(path, patterns)]


def _neutral(path: str) -> bool:
    return _matches(path, NEUTRAL)


def _program(exec_line: str) -> tuple[str, list[str]]:
    """The program a launcher's Exec runs, and the words after it."""
    try:
        words = shlex.split(exec_line)
    except ValueError:
        words = exec_line.split()
    words = [word for word in words if not word.startswith("%")]
    while words and (re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[0]) or words[0] in ("env", "/usr/bin/env")):
        words.pop(0)
    while words and words[0].startswith("-") and len(words) > 1:  # env options
        words.pop(0)
    return (words[0], words[1:]) if words else ("", [])


# -- helpers for callers ------------------------------------------------------------------

def own_dependencies(name: str, depends: Mapping[str, Iterable[str]], base: Iterable[str],
                     family: str = "deb", needed_elsewhere: Iterable[str] = ()) -> list[str]:
    """The request's own dependencies: the transitive Depends of ``name`` that are not in
    ``base`` (the release's required set and desktop baseline, closed over their own
    dependencies), not provided by the device, and not needed by anything else
    (``needed_elsewhere``: what other requests or installed packages depend on).

    The walk stops at a base or host-provided package, so what those need is not counted."""
    base = set(base) | set(needed_elsewhere)
    seen: list[str] = []
    stack = list(depends.get(name, ()))
    visited = {name}
    while stack:
        current = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        if current in base or host_provided(current, family):
            continue
        seen.append(current)
        stack.extend(depends.get(current, ()))
    return sorted(seen)


# -- the classifier -----------------------------------------------------------------------

@dataclass
class _Facts:
    request: Request
    reasons: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)

    def flag(self, *names: str) -> None:
        for name in names:
            if name not in self.flags:
                self.flags.append(name)

    def because(self, reason: str) -> None:
        if reason not in self.reasons:
            self.reasons.append(reason)


def _all(request: Request) -> tuple[PackageInfo, ...]:
    return (request.package, *request.dependencies)


def _files(packages: Iterable[PackageInfo]) -> list[str]:
    return [path for package in packages for path in package.files]


def _system_units(package: PackageInfo) -> tuple[list[str], list[str]]:
    """(system units that count, system units that are inert copies of a user unit of the same name)."""
    user = {match.group(2) or match.group(4) for match in map(_USER_UNIT.match, package.files) if match}
    counted, inert = [], []
    for path in package.files:
        if not _SYSTEM_UNIT.match(path):
            continue
        unit = _UNIT_NAME.search(path).group(1)
        (inert if unit in user or unit.rstrip("@") in user else counted).append(path)
    return counted, inert


# Name suffixes that do not change what a unit or program is: "redis-server" runs redis,
# "dockerd" is docker, "gpartedbin" is gparted, "gufw-pkexec" is gufw.
_NAME_SUFFIXES = ("-server", "-daemon", "-common", "-core", "-engine", "-system", "-utils", "-tools", "-bin",
                  "-pkexec", "-service", ".io", "bin")


def _name(value: str) -> str:
    """A package, source, unit or program name reduced to what it names."""
    value = value.lower().split("/")[-1]
    value = re.sub(r"\.(service|socket|timer|sh)$", "", value).split("@")[0]
    if value.startswith("lib") and len(value) > 5:
        value = value[3:]
    changed = True
    while changed:
        changed = False
        for suffix in _NAME_SUFFIXES:
            if value.endswith(suffix) and len(value) > len(suffix) + 2:
                value, changed = value[:-len(suffix)], True
    if value.endswith("d") and len(value) > 3:
        value = value[:-1]
    return value


def _key(value: str) -> str:
    """A name for comparing: reduced, without separators or a version ("dm-event" and "dmeventd"
    match, so do "cri-o1.36" and "crio")."""
    return re.sub(r"[^a-z0-9]", "", re.sub(r"[-_.]?[0-9][0-9.]*$", "", _name(value)))


def _first(value: str) -> str:
    return re.split(r"[-_.@]", _name(value))[0]


def _daemon_program(path: str) -> bool:
    name = Path(path).name
    return path.startswith(("/usr/sbin/", "/sbin/")) or name.endswith("d") or "daemon" in name or "server" in name


@dataclass(frozen=True)
class _Owner:
    """Who a request is for: the top-level package's names and daemon programs."""
    names: frozenset
    first: frozenset
    programs: frozenset
    commands: frozenset = frozenset()
    user_commands: frozenset = frozenset()  # commands documented in manual section 1: the person's CLI

    top_name: str = ""
    state: frozenset = frozenset()  # names with daemon state: /etc/sysconfig, a sysusers.d user

    @staticmethod
    def of(top: PackageInfo, own: Iterable[PackageInfo], members: Iterable[str] = ()) -> "_Owner":
        """Names from the top-level package; daemon programs from it and the meta's members
        (a dependency's daemon, dovecot for dovecot-sieve, is not the request's own)."""
        names = {_key(top.name), _key(_source(top))}
        members = set(members)
        programs = {_key(path) for package in own if package is top or package.name in members
                    for path in package.files if _daemon_program(path)
                    and _matches(path, PROGRAM_PATTERNS + ("/usr/lib/*", "/lib/*"))}
        own = list(own)
        commands = {_key(path) for package in own for path in package.files if path.startswith(BIN_DIRECTORIES)}
        pages = {_key(re.sub(r"\.1[a-z]*(\.gz|\.xz|\.bz2|\.zst)?$", "", Path(path).name))
                 for package in own for path in package.files if re.search(r"/man1/[^/]+\.1", path)}
        state = set()
        for package in own:
            for path in package.files:
                match = re.match(r"^/(etc/sysconfig|usr/lib/sysusers\.d)/([^/]+)", path)
                if match:
                    state.add(_key(Path(match.group(2)).stem if match.group(1) == "usr/lib/sysusers.d" else match.group(2)))
        return _Owner(frozenset(names), frozenset({_first(top.name), _first(_source(top))}), frozenset(programs),
                      frozenset(commands), frozenset(commands & pages), _key(top.name), frozenset(state))

    def service(self, unit: str, in_top: bool) -> str:
        """'strong' when a unit runs the request's daemon program, 'weak' when it is only named
        like the request (in the top-level package: like its first word too), '' otherwise."""
        name = _key(unit)
        if name in self.programs:
            return "strong"
        if not in_top and name != self.top_name:  # another package's unit, not named like the request
            return ""
        if name in self.names or (in_top and _first(unit) in self.first):
            if name in self.state:  # a daemon in merged /usr/bin with its own state (haproxy, irqbalance, znc)
                return "strong"
            if name in self.user_commands:  # cvs, fio: the service runs the person's own command-line tool
                return ""
            return "strong" if name in self.commands else "weak"  # named like it and runs its program (crio)
        return ""


GLIBC_NSS = re.compile(r"/libnss_(files|dns|compat|hesiod|db|nis|nisplus)[.-]")


def _inert(path: str) -> bool:
    return _matches(path, data_sections("inert-integration.txt")[""])


def _system_markers(package: PackageInfo, facts: "_Facts | None" = None, owner: "_Owner | None" = None,
                    in_top: bool = True) -> list[str]:
    """Rule 1 reasons for one package's own files (inert integration named in ``facts``).

    With ``owner``, a system unit or init script counts only when it is the request's own
    service; an optional daemon shipped beside client tools stays inert and is named."""
    found = []
    inert = [path for path in package.files if _inert(path)]
    if inert and facts is not None:
        facts.because(f"maintenance or boot-image hook {inert[0]} stays inert ({package.name})")
    glibc = _source(package) in ("glibc", "eglibc") or package.name.startswith(("libc6", "libc-bin", "glibc"))
    files = [path for path in package.files if path not in inert and not (glibc and GLIBC_NSS.search(path))]
    strength = {}
    if owner is not None:
        for path in files:
            if _SYSTEM_UNIT.match(path) or _any([path], ("/etc/init.d/*", "/etc/rc.d/init.d/*")):
                strength[path] = owner.service(Path(path).name, in_top)
        optional = [path for path, value in strength.items() if not value]
        if optional and facts is not None:
            facts.flag(OPTIONAL_SERVICE)
            unit = Path(optional[0]).name
            facts.because(f"optional service {unit} ({package.name}) stays inert in the workspace; "
                          f"to run it, install {package.name} as a system module")
        files = [path for path in files if path not in optional]
    package = PackageInfo(package.name, package.version, package.family, fields=package.fields,
                          depends=package.depends, files=tuple(files))
    units, _ = _system_units(package)
    units += _any(package.files, ("/etc/init.d/*", "/etc/rc.d/init.d/*"))
    strong = [path for path in units if strength.get(path, "strong") == "strong"]
    if strong:
        found.append(f"system service {Path(strong[0]).name} ({package.name})")
    elif units:
        found.append(f"a service named like the package: {Path(units[0]).name} ({package.name})")
    for label, patterns in SYSTEM_MARKERS:
        if label == "an init script":
            continue
        hits = _any(package.files, patterns)
        if hits:
            found.append(f"{label}: {hits[0]} ({package.name})")
    shells = [path for path in package.files
              if path.startswith(BIN_DIRECTORIES) and Path(path).name in LOGIN_SHELLS]
    if shells:
        found.append(f"a login shell: {shells[0]} ({package.name})")
    cron = _any(package.files, CRON_PATTERNS)
    if cron:
        found.append(f"a cron job: {cron[0]} ({package.name})")
    if any(name in ("fuse", "fuse3") for name in package.depends) and \
            any(path.startswith(BIN_DIRECTORIES) for path in package.files):
        found.append(f"a FUSE filesystem: {next(p for p in package.files if p.startswith(BIN_DIRECTORIES))} "
                     f"({package.name})")
    payload = [path for path in package.files if not _neutral(path)]
    if payload and all(_matches(path, PACKAGE_MANAGER_CONFIG) for path in payload):
        found.append(f"package manager configuration: {payload[0]} ({package.name})")
    plugins = [path for path in payload if _system_plugin(path)]
    if plugins:
        found.append(f"a plugin or configuration of a system daemon: {plugins[0]} ({package.name})")
    if payload and any(_matches(path, SYSTEM_CONFIGURATION) for path in payload) and \
            all(path.startswith(("/etc/", "/usr/lib/tmpfiles.d/")) or _matches(path, SYSTEM_CONFIGURATION)
                or (path.startswith("/usr/share/") and path.endswith(".sh")) for path in payload):
        found.append(f"system-wide configuration only: {payload[0]} ({package.name})")
    if _matches(package.name, data_sections("addon-paths.txt").get("system-names", ())):
        found.append(f"a CUPS printer driver (named as one: {package.name})")
    return found


def _system_plugin(path: str) -> bool:
    """A file in a system daemon's plugin, module or configuration folder (addon-paths.txt [system];
    a pattern starting with '=' matches files directly in that folder only)."""
    return any(fnmatch.fnmatchcase(path, pattern[1:]) and path.count("/") == pattern.count("/")
               if pattern.startswith("=") else fnmatch.fnmatchcase(path, pattern)
               for pattern in data_sections("addon-paths.txt").get("system", ()))


def _service_markers(reason: str) -> bool:
    return reason.startswith(("system service", "a service named like", "an init script", "a D-Bus system service",
                              "a cron job"))


def _strength(reason: str) -> str:
    if reason.startswith(STRONG_MARKERS):
        return "strong"
    if reason.startswith(ASK_MARKERS):
        return "ask"
    return "weak"


def _user_payload(packages: Iterable[PackageInfo]) -> list[str]:
    """Files a person uses directly: libraries, language modules, headers, user commands."""
    found = []
    for package in packages:
        admin = _admin_pages(package)
        for path in package.files:
            if "/security/" in path or "/libnss_" in path:
                continue
            if _matches(path, USER_PAYLOAD) and not _matches(path, SYSTEM_MARKERS_ALL) and not _system_plugin(path):
                found.append(path)  # libraries anywhere under lib, except system plugins (NetworkManager, CUPS)
            elif path.startswith(("/usr/bin/", "/bin/", "/usr/games/")) and not _daemon_program(path) \
                    and Path(path).name not in admin:
                found.append(path)
    return found


def _admin_pages(package: PackageInfo) -> set[str]:
    """Commands documented in manual section 8 (system administration)."""
    return {re.sub(r"\.8[a-z]*(\.gz|\.xz|\.bz2|\.zst)?$", "", Path(path).name)
            for path in package.files if re.search(r"/man8/[^/]+\.8", path)}


def _signed_system_module(package: PackageInfo) -> bool:
    return _matches(package.name, data_sections("signed-list.txt").get("system-modules", ()))


def _desktop_environment(packages: Iterable[PackageInfo]) -> list[str]:
    found = []
    for package in packages:
        sessions = _any(package.files, DESKTOP_SESSIONS)
        if sessions:
            found.append(f"a desktop session: {sessions[0]} ({package.name})")
        programs = _any(package.files, DESKTOP_PROGRAMS)
        if programs:
            found.append(f"a desktop shell, compositor or session daemon: {programs[0]} ({package.name})")
        units, _ = _system_units(package)
        for unit in units:
            if _UNIT_NAME.search(unit).group(1) in DISPLAY_MANAGER_UNITS:
                found.append(f"a display manager: {unit} ({package.name})")
                break
    return found


def _privilege(packages: Iterable[PackageInfo], launchers: list[tuple[str, bool]], facts: _Facts,
               owner: "_Owner") -> tuple[list[str], list[str]]:
    """Rule 2: (reasons for a system tool, privileged commands that are not the main one).

    A system tool is one whose main function needs root: a launcher that runs only through
    pkexec, a polkit exec.path for its main binary, or a setuid/setgid/capability main binary
    (named like the request). A helper kept out of the command path, the application's own
    program (an optional "as root" mode) or a file on the dropped/optional lists is named as
    not offered. Any other privileged command keeps working without its privilege, with a
    line saying what will not work."""
    tool = data_sections("system-tool.txt")
    dropped, optional = tool.get("dropped", ()), tool.get("optional", ())
    own_programs = {Path(program).name for program, through in launchers if not through}
    found, commands = [], []

    def judge(path: str, what: str, package: PackageInfo) -> None:
        if _matches(path, dropped):
            facts.flag(HELPER_DROPPED)
            facts.because(f"{what} {path} is dropped in the tree; not needed under Suno's sandbox ({package.name})")
        elif _matches(path, optional) or (_matches(path, HELPER_PATTERNS) and not path.startswith(BIN_DIRECTORIES)):
            facts.flag(HELPER_DROPPED)
            facts.because(f"privileged helper {path} ({what}) is not offered; the rest works ({package.name})")
        elif what == "setuid/setgid" and _any(package.files, SCORE_FILES):
            facts.flag(HELPER_DROPPED)
            facts.because(f"setuid/setgid {path} only keeps a shared score file; scores are kept per person "
                          f"({package.name})")
        elif Path(path).name in own_programs:
            facts.flag(HELPER_DROPPED)
            facts.because(f"its own program's optional root mode ({what} {path}) is not offered ({package.name})")
        elif _name(path) in owner.names:
            found.append(f"{what} on its main binary {path} ({package.name})")
        else:
            commands.append(path)
            facts.flag(PRIVILEGE_DROPPED)
            facts.because(f"{Path(path).name} runs without its {what}: {_privilege_hint(path)} ({package.name})")

    for package in packages:
        for policy in package.policies:
            if policy.exec_paths is None:
                facts.because(f"polkit policy {Path(policy.path).name} not read ({package.name})")
            for path in policy.exec_paths or ():
                judge(path, "polkit exec.path", package)
        for path in package.setuid:
            judge(path, "setuid/setgid", package)
        for path in package.capabilities:
            judge(path, "file capabilities", package)
    through = [program for program, elevated in launchers if elevated]
    if through and len(through) == len(launchers):
        found.append(f"launcher runs through pkexec ({Path(through[0]).name})")
    elif through:
        facts.flag(HELPER_DROPPED)
        facts.because(f"optional root launcher ({Path(through[0]).name}) is not offered")
    return found, commands


SCORE_FILES = ("/var/games/*", "/var/lib/games/*")


def _privilege_hint(path: str) -> str:
    for line in data_sections("system-tool.txt").get("hints", ()):
        pattern, _, text = line.partition(" ")
        if fnmatch.fnmatchcase(path, pattern):
            return text.strip()
    return "what needs that privilege will not work"


def _policy_unread(packages: Iterable[PackageInfo]) -> bool:
    return any(policy.exec_paths is None for package in packages for policy in package.policies)


def _launchers(packages: tuple[PackageInfo, ...], launcher_packages: tuple[PackageInfo, ...] | None = None
               ) -> tuple[list[tuple[PackageInfo, DesktopEntry]], list[tuple[str, bool]], list[str]]:
    """Visible launchers of ``launcher_packages`` that run a program from ``packages``, their
    (program, through pkexec), and console launchers."""
    wrappers = data_sections("system-tool.txt").get("exec", ())
    files = set(_files(packages))
    names = {Path(path).name for path in files if path.startswith(BIN_DIRECTORIES)}
    ships_program = any(_matches(path, PROGRAM_PATTERNS) for path in files)
    visible, programs, console = [], [], []
    for package in launcher_packages if launcher_packages is not None else packages:
        for entry in package.desktop:
            if entry.no_display is not False:  # hidden, or not known to be shown
                if entry.no_display and not entry.terminal and entry.exec:
                    program = Path(_program(entry.exec)[0]).name
                    if program in names:
                        manager = "WindowManager" in entry.categories or program.endswith("wm") or any(
                            pattern.endswith("/" + program) for pattern in DESKTOP_PROGRAMS)
                        console.append(("hidden-wm:" if manager else "hidden:") + entry.path)
                continue
            if entry.terminal or "ConsoleOnly" in entry.categories:
                console.append(entry.path)
                continue
            if entry.exec is None:  # Exec not known (index metadata): any program the request ships
                if ships_program:
                    visible.append((package, entry))
                    programs.append(("", False))
                continue
            program, arguments = _program(entry.exec)
            if Path(program).name in LAUNCH_WRAPPERS and ships_program:  # gapplication launch org.gnome.Maps
                visible.append((package, entry))
                programs.append(("", False))
                continue
            elevated = _matches(Path(program).name, wrappers)
            if Path(program).name in ("pkexec", "gksu", "gksudo", "kdesu", "kdesudo", "beesu", "su-to-root"):
                program = arguments[0] if arguments else ""
            if not program:  # through pkexec, target not known
                if ships_program:
                    visible.append((package, entry))
                    programs.append(("pkexec", True))
                continue
            base = Path(program).name
            in_package = program in files or base in names or (
                not program.startswith("/") and any(path.endswith("/" + program) for path in files)) or (
                # a name the distribution's alternatives provide (emacs -> emacs-gtk)
                any(name.startswith((base + "-", base + ".")) for name in names))
            if in_package:
                visible.append((package, entry))
                programs.append((program, elevated))
    return visible, programs, console


def _add_on_scope(files: list[str]) -> tuple[str, list[str]]:
    """('data'|'fonts'|'codecs'|'session'|'', non-neutral files) for a package's payload
    (for a meta-package, its members' payload).

    Data and fonts: every payload file lies under an add-on path (ADD_ON_NEUTRAL aside), and
    fonts need a font file, which is a font wherever it lies. Codecs and session add-ons
    carry their own libraries and tools: at least half of the payload must be add-on
    files."""
    sections = data_sections("addon-paths.txt")
    payload = [path for path in files if not _neutral(path) and not _matches(path, ADD_ON_NEUTRAL)]
    scopes, rest = [], []
    for path in payload:
        scope = "fonts" if _matches(path, FONT_FILES) and not _matches(path, TEX_FONTS) else next(
            (name for name in ("session", "codecs", "drivers", "fonts", "data")
             if _matches(path, sections.get(name, ()))), "")
        (scopes.append(scope) if scope else rest.append(path))
    if not scopes:
        return "", payload
    native = [scope for scope in scopes if scope in ("codecs", "drivers", "session")]
    if rest and (not native or 2 * len(native) < len(payload)):
        return "", payload
    if set(scopes) == {"fonts"} and not any(_matches(path, FONT_FILES) for path in payload):
        return "", payload
    for name in ("session", "codecs", "drivers", "fonts", "data"):  # the strictest scope present decides
        if name in scopes:
            return name, payload
    return "", payload


def _is_snap_transitional(package: PackageInfo, release: str) -> bool:
    if package.family != "deb":
        return False
    if "snap" in package.version.lower() or "snapd" in package.depends:
        return True
    return release.startswith("ubuntu") and package.name in data_sections("snap-transitional.txt").get("ubuntu", ())


def _kernel_module(packages: tuple[PackageInfo, ...]) -> str:
    """The kmod map entry for a request with kernel modules, DKMS or akmod sources."""
    return next((target for target in (kmod_mapping(package.name) for package in packages) if target != "refuse"),
                "refuse")


def _source(package: PackageInfo) -> str:
    return (package.fields.get("Source") or package.name).split()[0]


def _payload(package: PackageInfo) -> list[str]:
    return [path for path in package.files if not _neutral(path)]


def _own_parts(request: Request) -> tuple[list[PackageInfo], list[PackageInfo]]:
    """(the request's own parts, the rest of its dependencies).

    Own parts are the top-level package, the members a meta-package brings (through
    meta-packages it brings) and the dependencies, reachable from the top-level package,
    that are built from the same source as one of those. The rest are shared libraries
    and other projects' packages: their daemons stay inert and their launchers do not
    make the request an application."""
    top = request.package
    by_name = {package.name: package for package in request.dependencies}
    reachable, queue = set(), list(top.depends)
    while queue:
        name = queue.pop()
        if name in reachable or name not in by_name:
            continue
        reachable.add(name)
        queue.extend(by_name[name].depends)
    own, seen = [top], {top.name}
    queue = list(top.depends) if not _payload(top) else []
    while queue:
        member = by_name.get(queue.pop(0))
        if member is None or member.name in seen:
            continue
        seen.add(member.name)
        own.append(member)
        if not _payload(member):
            queue.extend(member.depends)
    sources = {_source(package) for package in own}
    own += [by_name[name] for name in sorted(reachable)
            if name not in seen and _source(by_name[name]) in sources]
    names = {package.name for package in own}
    return own, [package for package in request.dependencies if package.name not in names]


ADD_ON_REASONS = {"data": "data-only add-on: for the person under ~/.local/share",
                  "fonts": "fonts: for the person in ~/.local/share/fonts",
                  "codecs": "codecs: add-ons in this release's trees and workspace",
                  "drivers": "scanner backends: add-ons in this release's trees and workspace",
                  "session": "loads native code into the session: device-wide only as an image-signed "
                             "system module after a yes, otherwise refused"}


def classify(request: Request) -> Classification:
    """The class of a request: see the module documentation and ADR-052 Amendment 1, section 2.

    The curated list for the request's release decides first, by package name, for packages
    from the distribution; the rules below decide the long tail. A meta-package is a record of
    what it brought: its members are classified one by one (``parts``); the meta's own kind is
    judged over all of them together. Every result carries ``default`` and ``ask``
    (DEFAULT-RULE) and, when it installs a package that also carries a service or a tool
    needing root, a ``notice`` with the one-tap alternative."""
    if request.curated and request.origin == "distribution" and request.release:
        entry = curated_entry(request.release, request.package.name)
        if entry is not None:
            return _with_defaults(_from_curated(entry))
    result = _ask_for_markers(request, _classify(request))
    kinds = {kind for kind, _ in result.parts}
    if result.kind in (SYSTEM_MODULE, SYSTEM_TOOL) and not (result.refused or result.module) \
            and APP_SERVICE_SPLIT not in result.flags and APPLICATION in kinds:
        result = Classification(CHOICE, result.reasons + ("a meta-package that brings applications and system "
                                                          "parts: the person chooses",), result.flags, result.parts,
                                fallback=result.fallback, choices=(result.kind, APPLICATION))
    return _with_defaults(result)


# DEFAULT-RULE (fixed 2026-11-25): a choice installs the first sandboxed kind among its
# candidates; it asks only when every candidate is a system kind.
SAFE_DEFAULTS = (APPLICATION, WORKSPACE, CONSOLE_APPLICATION, DEVICE_ADD_ON)
SYSTEM_KINDS = (SYSTEM_MODULE, SYSTEM_TOOL)
NOTICE_FLAGS = (OPTIONAL_SERVICE, PRIVILEGE_DROPPED, CLI_ADMIN)


def _with_defaults(result: Classification) -> Classification:
    import dataclasses
    if result.kind == CHOICE:
        default = next((kind for kind in SAFE_DEFAULTS if kind in result.choices), result.choices[0])
        ask = result.ask or default not in SAFE_DEFAULTS
    else:
        default, ask = result.kind, result.ask  # only an unreviewed list entry asks here (_from_curated)
    notice = result.notice
    if not notice and default in (WORKSPACE, APPLICATION, CONSOLE_APPLICATION):
        alternative = next((kind for kind in result.choices if kind in SYSTEM_KINDS), "")
        if not alternative and OPTIONAL_SERVICE in result.flags:
            alternative = SYSTEM_MODULE
        if not alternative and PRIVILEGE_DROPPED in result.flags:
            alternative = SYSTEM_TOOL
        if alternative:
            what = next((reason for reason in result.reasons if reason.startswith(
                ("optional service", "system service", "a service named", "administration commands",
                 "command-line administration")) or "runs without its" in reason), "")
            notice = (f"Installed as {_KIND_WORDS[default]}. It also carries "
                      + ("a service" if alternative == SYSTEM_MODULE else "a tool that needs root")
                      + (f" ({what})" if what else "")
                      + f". One tap on its page installs it as {_KIND_WORDS[alternative]} instead; undo returns it "
                      "to how it is now.")
    return dataclasses.replace(result, default=default, ask=ask, notice=notice)


GREETER_FILES = ("/usr/share/xgreeters/*", "/usr/share/xsessions/*", "/usr/share/wayland-sessions/*")


def _ask_for_markers(request: Request, result: Classification) -> Classification:
    """No silent non-system outcome for a system marker (ADR-052, the choice outcome): a rules
    result with a sandboxed kind, no notice and no system part becomes a choice with the system
    kind, asked, when the request's own files carry a system marker."""
    import dataclasses
    top = request.package
    if result.kind not in SAFE_DEFAULTS or result.notice or result.refused or result.module or \
            any(reason.startswith("artwork and themes") for reason in result.reasons) or \
            IMAGE_HAS_NAME in result.flags or set(result.flags) & set(NOTICE_FLAGS) or \
            any(kind in SYSTEM_KINDS for kind, _ in result.parts) or host_provided(top.name, top.family):
        return result
    own, _ = _own_parts(request)
    members = _member_names(request)
    parts = [top] + [package for package in own[1:] if package.name in members]
    owner = _Owner.of(top, own, members)
    found, kind = "", SYSTEM_MODULE
    for package in parts:
        reasons = [reason for reason in _system_markers(package, None, owner, package is top)
                   if not reason.startswith("a login shell") and not (result.kind == APPLICATION and
                                                                      reason.startswith("a cron job"))]
        files = [path for path in package.files if not _inert(path)]
        rules = _any(files, DEVICE_RULE_PATTERNS)
        if reasons:
            found = reasons[0]
        elif rules and not result.device_rules:
            found = f"udev rules {rules[0]} ({package.name})"
        elif _any(files, GREETER_FILES):
            found = f"a greeter or session file {_any(files, GREETER_FILES)[0]} ({package.name})"
        if found:
            break
        privileged = [path for path in (*package.setuid, *package.capabilities)
                      if path.startswith(BIN_DIRECTORIES) and _name(path) in owner.names
                      and not _any(package.files, SCORE_FILES)]
        sbin = [path for path in files if path.startswith(("/usr/sbin/", "/sbin/"))]
        if result.kind != APPLICATION and (privileged or sbin):
            found, kind = f"{'setuid, setgid or capabilities on' if privileged else 'administration program'} " \
                          f"{(privileged or sbin)[0]} ({package.name})", SYSTEM_TOOL
            break
    if not found:
        return result
    return dataclasses.replace(result, kind=CHOICE, choices=(result.kind, kind), ask=True,
                               reasons=result.reasons + (f"a system marker without a curated decision ({found}): "
                                                         "the person is asked",))


LOGIN_SHELL_NOTICE = ("Installed as a workspace package. Making it your login shell is a system change: one tap on "
                      "its page installs it as a system module instead; undo returns it to how it is now.")

_KIND_WORDS = {APPLICATION: "an application", WORKSPACE: "a workspace package",
               CONSOLE_APPLICATION: "a console application", DEVICE_ADD_ON: "a device add-on",
               SYSTEM_MODULE: "a system module", SYSTEM_TOOL: "a system tool", DEVICE_REQUEST: "a device request",
               SOURCE: "a source"}


# -- the curated list -----------------------------------------------------------------------

CURATED_ENVIRONMENT = "SUNO_CLASSIFY_CURATED"


CURATED_PURPOSE = "Suno-curated-classify"
CURATED_KEY = "depot-classify.pub"           # pinned: shipped in data/classify
CATALOGUE_KEYS = ("depot-catalog.pub", "depot-catalogue-v1.pub")  # never accepted for a curated list
CATALOGUE_KEY_DIRECTORIES = (Path("/usr/share/Suno/installer"), Path(__file__).resolve().parent.parent / "data")
STATE_ENVIRONMENT = "SUNO_CLASSIFY_STATE"    # where the last list_version seen per release is kept
_LOGGED: set[str] = set()


class CuratedListRefused(ValueError):
    """A curated list that must not be used: the rules decide instead."""


def _log_once(release: str, message: str) -> None:
    if release not in _LOGGED:
        import logging
        _LOGGED.add(release)
        logging.getLogger(__name__).warning("curated list for %s ignored, the rules decide: %s", release, message)


def _catalogue_keys() -> list:
    from . import depot_signature
    keys = []
    directories = list(CATALOGUE_KEY_DIRECTORIES)
    if os.environ.get(DATA_ENVIRONMENT):
        directories.insert(0, Path(os.environ[DATA_ENVIRONMENT]))
    for directory in directories:
        for name in CATALOGUE_KEYS:
            try:
                keys.append(depot_signature.parse_public_key((directory / name).read_bytes()))
            except (OSError, depot_signature.SignatureError):
                continue
    return keys


def verify_curated(release: str, content: bytes, signature: bytes, key: bytes) -> dict:
    """The list in CONTENT, when SIGNATURE verifies under the pinned KEY for RELEASE.

    Refused: a signature by a Depot catalogue key (or a pinned key that is one), a trusted
    comment whose purpose is not Suno-curated-classify, a release in the comment or the list
    other than RELEASE (no replay across releases), a list_version other than the comment's,
    and any tampering. Returns the parsed list."""
    import json
    from . import depot_signature as ds
    try:
        pinned = ds.parse_public_key(key)
        parsed = ds.parse_signature(signature)
    except ds.SignatureError as error:
        raise CuratedListRefused(str(error)) from error
    for catalogue in _catalogue_keys():
        if catalogue.key_id == parsed.key_id or catalogue.key == pinned.key or catalogue.key_id == pinned.key_id:
            raise CuratedListRefused("signed with, or pinned to, a Depot catalogue key")
    try:
        comment = ds.verify(pinned, content, parsed)
    except ds.SignatureError as error:
        raise CuratedListRefused(str(error)) from error
    fields = dict(item.split("=", 1) for item in comment.split() if "=" in item)
    if fields.get("purpose") != CURATED_PURPOSE:
        raise CuratedListRefused(f"signature purpose is {fields.get('purpose')!r}, not {CURATED_PURPOSE}")
    if fields.get("release") != release:
        raise CuratedListRefused(f"signature is for release {fields.get('release')!r}")
    try:
        data = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise CuratedListRefused("the list is not JSON") from error
    if data.get("format") != 1 or data.get("release") != release:
        raise CuratedListRefused("the list is for another release or format")
    if str(data.get("list_version")) != fields.get("version"):
        raise CuratedListRefused("the list's version is not the signed one")
    return data


def _version_floor(release: str, version: int) -> None:
    """Refuse a list_version lower than the last one seen for RELEASE (when state can be kept)."""
    import json
    state = os.environ.get(STATE_ENVIRONMENT) or os.path.join(
        os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state"), "Suno", "classify-curated.json")
    try:
        seen = json.loads(Path(state).read_text())
    except (OSError, ValueError):
        seen = {}
    if version < int(seen.get(release, 0)):
        raise CuratedListRefused(f"list_version {version} is older than {seen[release]}, seen before")
    if version > int(seen.get(release, 0)):
        seen[release] = version
        try:
            Path(state).parent.mkdir(parents=True, exist_ok=True)
            Path(state).write_text(json.dumps(seen))
        except OSError:
            pass


def shipped(path: Path) -> bool:
    """Whether PATH is one of the classifier's own data files: in the image's directory
    (installed by the installer package) or beside this module. The image is their trust root."""
    try:
        folder = path.resolve().parent
    except OSError:
        return False
    return any(folder == directory.resolve() for directory in DATA_DIRECTORIES)


@lru_cache(maxsize=None)
def curated_list(release: str) -> dict:
    """The curated list for a release ({} when there is none or it is refused).

    The list the installer package ships (data/classify/curated-<release>.json, installed in
    the image) is trusted as the image is, unsigned. A list from anywhere else (SUNO_CLASSIFY_DATA)
    is used only when curated-<release>.json.minisig verifies against the pinned
    depot-classify.pub (verify_curated); any failure ignores it, logs once, and the rules decide."""
    if os.environ.get(CURATED_ENVIRONMENT) == "0":
        return {}
    path = _data_file(f"curated-{release}.json")
    if path is None:
        return {}
    if shipped(path):
        import json
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("format") != 1 or data.get("release") != release:
                raise CuratedListRefused("the list is for another release or format")
            return data
        except (OSError, ValueError, CuratedListRefused) as error:
            _log_once(release, str(error))
            return {}
    key = _data_file(CURATED_KEY)
    try:
        if key is None:
            raise CuratedListRefused("no pinned key")
        data = verify_curated(release, path.read_bytes(), Path(str(path) + ".minisig").read_bytes(), key.read_bytes())
        _version_floor(release, int(data.get("list_version") or 0))
        return data
    except (OSError, CuratedListRefused, ValueError) as error:
        _log_once(release, str(error))
        return {}


def curated_entry(release: str, name: str) -> dict | None:
    return curated_list(release).get("entries", {}).get(name)


REVIEWED = "reviewed"  # a list entry the review decided (curate.py --keep): its outcome is installed without asking


def _from_curated(entry: dict) -> Classification:
    """A list entry's outcome. Only a reviewed entry decides silently; any other entry (the
    classifier and the metadata agreeing, unreviewed) is asked, its kind the suggestion."""
    kind = entry["kind"]
    choices = tuple(entry.get("choices", ()))
    reviewed = entry.get("agreement") == REVIEWED
    return Classification(kind, (f"curated list ({entry.get('source', 'curated')}): {kind}",) +
                          tuple(entry.get("reasons", ())),
                          tuple(entry.get("flags", ())) + ("curated",) + ((REVIEWED,) if reviewed else ()),
                          add_on=entry.get("add_on", ""), add_on_of=entry.get("add_on_of", ""),
                          refused=entry.get("refused", ""), choices=choices, notice=entry.get("notice", ""),
                          ask=not reviewed, source="curated:" + entry.get("source", "curated"))


def _classify(request: Request) -> Classification:
    if request.arrival not in ARRIVALS:
        raise ValueError(f"unknown arrival {request.arrival!r}")
    top = request.package
    packages = _all(request)
    own, others = _own_parts(request)
    facts = _Facts(request)
    files = _files(own)

    if request.origin == "vendor":
        facts.flag(VENDOR_REPO_ONLY)
        facts.because("only in a vendor's repository: interactive asks before adding the source; -y never adds it")
    if request.in_depot:
        facts.flag(IN_DEPOT)
        facts.because("the same application is in Depot")
    if request.image_has_name:
        facts.flag(IMAGE_HAS_NAME)
    if _matches(top.name, WINDOWS_RUNTIME_NAMES) and request.origin == "distribution":
        facts.flag(WINDOWS_RUNTIME)
        facts.because("the distribution's wine becomes Suno's Windows runtime, announced")
    if _matches(top.name, STEAM_NAMES):
        facts.flag(STEAM)
        facts.because("Steam: i386 graphics layers, and the steamdeps list resolved at build")

    def result(kind: str, **extra) -> Classification:
        return Classification(kind, tuple(facts.reasons), tuple(facts.flags), **extra)

    # Snap-transitional names are never built.
    if _is_snap_transitional(top, request.release):
        facts.flag(SNAP_TRANSITIONAL)
        facts.because("snap-transitional: installs the snap; offer snapd, Depot, Flathub or the vendor's repository")
        return result(APPLICATION, refused="snap-transitional package: never built")

    own_payload = _payload(top)

    # Distribution identity and edition packages: the image has the name; the workspace's copy.
    if _matches(top.name, data_sections("host-provided.txt").get("identity", ())) or \
            _any(own_payload, ("/usr/lib/os-release", "/etc/os-release")):
        facts.flag(IMAGE_HAS_NAME)
        facts.because("distribution identity: the image has its own; installed in the workspace for this release")
        return result(WORKSPACE)

    # A package that only adds a repository is a source of that release.
    repository_files = _any(own_payload, SOURCE_PATTERNS)
    if repository_files and all(path in repository_files or path.startswith("/etc/default/") for path in own_payload):
        facts.flag(REPOSITORY_PACKAGE)
        facts.because(f"only adds a repository and its key ({own_payload[0]})")
        return result(SOURCE)

    # Meta and transitional packages: no payload of their own.
    meta = not own_payload and bool(top.depends)
    members: tuple = ()
    if meta:
        if len(top.depends) == 1:
            facts.flag(TRANSITIONAL)
            facts.because(f"transitional: no files of its own, brings {top.depends[0]}")
        else:
            facts.flag(META_PACKAGE)
            facts.because(f"meta-package: no files of its own; members classified one by one ({len(top.depends)})")
            members = _members(request)

    # A udev-only package (rules and hwdb data, no daemon) is a device request, never a system module.
    rules_only = _any(own_payload, DEVICE_RULE_PATTERNS)
    if rules_only and all(_matches(path, UDEV_ONLY) for path in own_payload) and \
            not any(path.startswith(BIN_DIRECTORIES) or _daemon_program(path) and "/udev/" not in path
                    for path in own_payload if not _matches(path, ("/lib/udev/*", "/usr/lib/udev/*"))):
        facts.flag(DEVICE_RULES)
        facts.because(f"udev rules and hardware data only ({rules_only[0]}): a device request")
        return result(DEVICE_REQUEST, device_rules=tuple(rules_only))

    # Kernel modules: never built on the device; the kmod map names Suno's build.
    kmod_files = _any(_files(packages), SYSTEM_MARKERS[0][1] + SYSTEM_MARKERS[1][1])
    kmod_named = [package.name for package in packages if kmod_mapping(package.name) != "refuse"]
    if kmod_files or kmod_named:
        facts.flag(KERNEL_MODULE)
        target = _kernel_module(packages)
        evidence = kmod_files[0] if kmod_files else kmod_named[0]
        facts.because(f"kernel module ({evidence})")
        if target == "refuse":
            return result(SYSTEM_MODULE, refused="kernel module not on Suno's list: modules are not built on "
                          "the device, break at the next kernel and cannot be signed")
        facts.because(f"maps to Suno's build: {target}")
        return result(SYSTEM_MODULE, module=target)

    desktop_environment = _desktop_environment([top] + [package for package in own[1:]
                                                        if package.name in _member_names(request)])
    if top.name in DESKTOP_PACKAGES:
        desktop_environment.append(f"a desktop: {top.name}")
    if meta:
        brought = [name for name in top.depends if name in DESKTOP_PACKAGES]
        if len(brought) >= 2:  # a desktop task brings the shell and its session; one is just a dependency
            desktop_environment += [f"brings a desktop: {', '.join(brought)}"]
    if desktop_environment:
        facts.flag(DESKTOP_ENVIRONMENT)
        for reason in desktop_environment:
            facts.because(reason)
        return result(SYSTEM_MODULE, refused="a desktop environment or display manager: a desktop is a Suno Mod (ADR-012)",
                      parts=members)

    wrappers = [line for line in data_sections("system-tool.txt").get("exec", ()) if "*" not in line and line != "pkexec"]
    front = [path for path in own_payload if path.startswith(BIN_DIRECTORIES) and Path(path).name in wrappers]
    if front and not host_provided(top.name, top.family):
        facts.because(f"a front end that runs programs as root ({Path(front[0]).name}): it exists to reach host root")
        return result(SYSTEM_TOOL)

    owner = _Owner.of(top, own, _member_names(request))
    member_names = _member_names(request)
    siblings = {package.name for package in own[1:] if package.name not in member_names} if own_payload else set()
    markers = {package.name: _system_markers(package, None if package.name in siblings else facts, owner,
                                             package is top) for package in own}
    for name in sorted(siblings):  # borrowed markers never decide: they stay with their own package
        sibling = next(package for package in own if package.name == name)
        units = _system_units(sibling)[0] + _any(sibling.files, ("/etc/init.d/*", "/etc/rc.d/init.d/*"))
        runs = [path for path in units if _key(Path(path).name) in owner.programs]
        if runs:  # a unit that runs the request's own daemon program (nginx and nginx-common) is its own
            markers[name] = [f"system service {Path(runs[0]).name} ({name})"]
        elif markers[name]:
            facts.because(f"system parts of {name}, another package of its source, stay with it ({markers[name][0]})")
            markers[name] = []
    other_services = [reason for package in others for reason in _system_markers(package)
                      if _service_markers(reason)]
    if other_services:
        facts.flag(DEPENDENCY_DAEMON_INERT)
        facts.because(f"dependency daemon stays inert; the host's is used: {other_services[0]}")
    for package in own:
        _, inert = _system_units(package)
        if inert:
            facts.flag(USER_SERVICE)
            facts.because(f"system unit {Path(inert[0]).name} is the system copy of a user service; "
                          f"start at sign-in is a permission ({package.name})")
    if any(_USER_UNIT.match(path) for path in files) or _any(files, ("/etc/xdg/autostart/*",)):
        facts.flag(USER_SERVICE)

    # Launchers count from the top-level package and a meta-package's members; from other
    # packages of its source only when the top-level package has programs (emacs and its
    # -common data), never for a font or data package (it is not its source's application).
    members_named = _member_names(request)
    top_programs = any(path.startswith(BIN_DIRECTORIES) for package in own
                       if package is top or package.name in members_named for path in package.files)
    launcher_parts = [top] + [package for package in own[1:] if package.name in members_named or top_programs]
    if top_programs:  # vlc-bin's program, the launcher in vlc of its source
        launcher_parts += [package for package in request.dependents if package.name == _source(top)]
    visible, programs, console_launchers = _launchers(tuple(own), tuple(launcher_parts))
    application = bool(visible)
    if application:
        facts.flag(GUI_LAUNCHER)

    # Development packages (headers, -dev, -devel) are workspace packages, whatever they hold.
    if not application and (re.search(r"-(dev|devel)$", top.name) or
                            (own_payload and all(_matches(path, DEVELOPMENT_FILES) or DEV_LIBRARY.match(path)
                                                 for path in own_payload))):
        facts.flag(DEVELOPMENT)
        facts.because("a development package (headers, libraries to link, build files)")
        return _console(request, facts, files, result, (), members)

    # Host integration: backends that load into a service the image runs (gvfs). The image
    # carries its own; the package goes to the workspace for workspace applications.
    hosted = _any(own_payload, HOST_INTEGRATION_PATTERNS)
    if not application and own_payload and 3 * len(hosted) >= 2 * len(own_payload):
        facts.flag(HOST_INTEGRATION)
        facts.flag(IMAGE_HAS_NAME)
        facts.because(f"loads into the host's own service ({hosted[0]}); the image carries it, so this copy serves "
                      "the workspace's applications")
        return _console(request, facts, files, result, (), members)

    # A language binding follows its library: the workspace (python3-firewall, gir1.2-*),
    # with a notice for system parts it carries; a strong marker of its own still decides.
    if not application and _binding(top, own_payload) and not any(
            _strength(reason) == "strong" for reason in markers.get(top.name, ())):
        weak = [reason for package in own for reason in markers[package.name]]
        if _matches(top.name, IMAGE_INTERPRETERS.get(top.family, ())):
            facts.flag(INTERPRETER_MODULE)
        facts.because("a language binding: it follows its library")
        return result(WORKSPACE, notice=(
            f"Installed as a workspace package. It also carries system parts ({weak[0]}). One tap on its page "
            "installs it as a system module instead; undo returns it to how it is now.") if weak else "")

    front_end = None if application else _front_end_part(request, own)
    if front_end:
        what, name = front_end
        facts.because(f"a part of the package-manager front end {name}: it takes the front end's choice")
        return result(CHOICE, choices=((APPLICATION if what == "window" else WORKSPACE), SYSTEM_TOOL))

    # A window manager, its decorators and plugins: a desktop component (a choice with a window).
    manager = _any(own_payload, data_sections("addon-paths.txt").get("window-managers", ()))
    if manager and not any(path.startswith(BIN_DIRECTORIES) and not _matches(path, data_sections(
            "addon-paths.txt").get("window-managers", ())) and Path(path).name not in {Path(program).name for program, _ in programs}
                           for path in own_payload) and (any(path.startswith(BIN_DIRECTORIES) for path in manager) or
                                                         not any(SHARED_LIBRARY.match(path) for path in own_payload)):
        facts.flag(DESKTOP_COMPONENT)
        facts.because(f"a window manager or its decorator or plugin ({manager[0]}): a desktop component")
        if application:
            return result(CHOICE, choices=(SYSTEM_MODULE, APPLICATION))
        return result(SYSTEM_MODULE, fallback="layering, labelled and asked")

    # An application's data or plugin package: no programs of its own, made for one
    # application (added to its tree), one desktop component, or one system module.
    native_scope = bool(_add_on_scope(top.files)[0])  # a device add-on by its paths stays one (themes, Files extensions)
    own_signals = markers.get(top.name) or _session_daemon([top], []) or _any(top.files, UNIT_FILES)
    host_app = None if application or native_scope or own_signals else _application_served(request, own_payload)
    if host_app is not None and host_app[0] in (top.name, _source(top)) and not ADD_ON_NAME.match(top.name) and \
            (host_app[0] == top.name or (host_app[1] != "system" and not _window_of(request, host_app[0]))):
        host_app = None  # a package is not its own add-on (tumbler and its tumbler-common)
    if host_app is not None:
        name, kind = host_app
        if kind == "desktop":
            facts.because(f"data for the desktop component {name} without code or markers: inert, a workspace package")
            if host_provided(name, top.family):
                facts.flag(IMAGE_HAS_NAME)
            return result(WORKSPACE)
        if kind == "system":
            facts.because(f"a module or plugin of the system module {name}: it goes with it")
            return result(SYSTEM_MODULE, fallback="layering, labelled and asked")
        facts.flag(APPLICATION_ADD_ON)
        facts.because(f"data or plugins for the application {name}: added to that application's tree")
        return result(APPLICATION, add_on_of=name)

    # Rules 4 and 5 come before the application rule: an add-on's own files decide,
    # whatever application its dependencies bring (a Files extension needs Files).
    scope, payload = _add_on_scope(_files(own[1:]) if meta else top.files)
    if not scope and not meta and len(own) > 1:  # an add-on split over packages of one source
        scope, payload = _add_on_scope(files)
    member_count = {kind: len(names) for kind, names in members}
    add_on_members = member_count.get(DEVICE_ADD_ON, 0) + member_count.get(APPLICATION_ADD_ON, 0)
    if not scope and meta and members and 2 * add_on_members >= sum(member_count.values()) and \
            not set(member_count) & {SYSTEM_MODULE, SYSTEM_TOOL, APPLICATION}:  # language tasks
        scope, payload = "data", [f"members: {', '.join(name for _, names in members for name in names)}"]
    if scope:
        facts.because(f"{ADD_ON_REASONS[scope]} ({payload[0]})")
        blocking = [reason for reason in markers.get(top.name, ()) if not reason.startswith("a cron job")]
        if blocking:
            for reason in blocking:
                facts.because(reason)
            facts.because("an add-on with system parts of its own: the person chooses")
            return result(CHOICE, choices=(DEVICE_ADD_ON, SYSTEM_MODULE), add_on=scope)
        if application:
            facts.because(f"an add-on with a window of its own ({Path(visible[0][1].path).name}): the person chooses")
            return result(CHOICE, choices=(APPLICATION, DEVICE_ADD_ON), add_on=scope)
        return result(DEVICE_ADD_ON, add_on=scope, device_rules=tuple(_any(files, DEVICE_RULE_PATTERNS)), parts=members)

    # A desktop component: a session daemon of the desktop (an autostart entry or session
    # D-Bus service running a helper that is not the package's window, a kded plugin).
    daemon = _session_daemon(own, programs) or _session_role([top] + [package for package in own[1:]
                                                                      if package.name in members_named])
    if daemon and not any(_strength(reason) in ("strong", "ask") for package in own for reason in markers[package.name]):
        facts.flag(DESKTOP_COMPONENT)
        facts.because(f"a desktop component ({daemon}): it changes the desktop for everyone")
        if application:
            facts.because("a desktop component with a window of its own: the person chooses")
            return result(CHOICE, choices=(SYSTEM_MODULE, APPLICATION))
        if host_provided(top.name, top.family):
            facts.flag(IMAGE_HAS_NAME)
            facts.because("the image carries it; this copy serves the workspace")
            return result(WORKSPACE)
        if daemon.startswith("/usr/share/dbus-1/services/"):
            facts.because("a session service started on demand, not with every session: the person chooses")
            return result(CHOICE, choices=(SYSTEM_MODULE, WORKSPACE))
        if _user_payload(own) or _any(files, ("/usr/lib*/gio/modules/*", "/usr/lib/*/gio/modules/*")):
            facts.because("a desktop component that also holds what a person uses directly: the person chooses")
            return result(CHOICE, choices=(SYSTEM_MODULE, WORKSPACE))
        return result(SYSTEM_MODULE, fallback="layering, labelled and asked")

    if application:
        package, entry = visible[0]
        facts.because(f"launcher {Path(entry.path).name} runs a program from the package ({package.name})")
        if any("TerminalEmulator" in item.categories for _, item in visible):
            facts.flag(TERMINAL_EMULATOR)
            facts.because("terminal emulator: runs on the host; its shells start through host-exec (full control)")
    managers = [path[len("hidden-wm:"):] for path in console_launchers if path.startswith("hidden-wm:")]
    hidden_windows = [path[len("hidden:"):] for path in console_launchers if path.startswith("hidden:")]
    console_launchers = [path for path in console_launchers if not path.startswith(("hidden:", "hidden-wm:"))]
    if not application and managers:
        facts.flag(DESKTOP_COMPONENT)
        facts.because(f"a window manager ({Path(managers[0]).name}, hidden from the menu): a desktop component")
        return result(SYSTEM_MODULE, fallback="layering, labelled and asked")
    if not application and hidden_windows and not _any(own_payload, SYSTEM_MARKERS_ALL) and \
            not any(reason for package in own for reason in markers[package.name]):
        facts.flag(GUI_LAUNCHER)
        facts.because(f"a window opened from another program ({Path(hidden_windows[0]).name}, hidden from "
                      "the menu): the person chooses")
        return result(CHOICE, choices=(APPLICATION, WORKSPACE))
    if not application and console_launchers:
        facts.because(f"launcher {Path(console_launchers[0]).name} opens a terminal: a console program")

    shell = [reason for reason in markers.get(top.name, ()) if reason.startswith("a login shell")]
    if shell and not application:
        facts.flag(LOGIN_SHELL)
        facts.because(shell[0] + ": a workspace command; making it the login shell is a system change")
        return result(WORKSPACE, notice=LOGIN_SHELL_NOTICE)

    if application:
        # Rule 1 for an application: its own root service is split off with the
        # configuration that goes with it. Anything else of its own that rule 1 or 2 would
        # make privileged conflicts with the window: the person chooses.
        service_parts, blocking = [], []
        for package in own:
            found = [reason for reason in markers[package.name] if not reason.startswith(("a login shell", "a cron job"))]
            for reason in markers[package.name]:
                if reason.startswith("a cron job"):
                    facts.because(reason.replace("a cron job", "cron job stays inert in the tree"))
            if any(_service_markers(reason) for reason in found):
                service_parts.append(package.name)
                for reason in found:
                    facts.because(reason)
            else:
                blocking += found
        privilege, commands = _privilege([package for package in own if package.name not in service_parts],
                                         programs, facts, owner)
        if blocking:
            for reason in blocking:
                facts.because(reason)
            facts.because("an application with system parts: the person chooses")
            return result(CHOICE, choices=(APPLICATION, SYSTEM_MODULE), fallback="layering, labelled and asked")
        if privilege:
            for reason in privilege:
                facts.because(reason)
            return result(SYSTEM_TOOL)
        if commands or _policy_unread(own):
            facts.because("an application with a privileged command it may need: the person chooses")
            return result(CHOICE, choices=(APPLICATION, SYSTEM_TOOL))
        capture = [name for package in own if package is top or package.name in members_named
                   for name in package.depends if _matches(name, data_sections("system-tool.txt").get("capture-libraries", ()))]
        if capture:
            facts.because(f"an application whose main function is capture ({capture[0]}): it needs root or raw "
                          "sockets; the person chooses")
            return result(CHOICE, choices=(APPLICATION, SYSTEM_TOOL))
        if any("PackageManager" in entry.categories and "System" in entry.categories and "Game" not in entry.categories
               for _, entry in visible):
            facts.because("a package manager's window: it changes the system through the host's package service; "
                          "the person chooses")
            return result(CHOICE, choices=(APPLICATION, SYSTEM_TOOL))
        if service_parts:
            facts.flag(APP_SERVICE_SPLIT)
            facts.because("split: the window is an application, the service a system module; one entry, one Remove")
            window = tuple(package.name for package, _ in visible[:1]) or (top.name,)
            return _finish_application(request, facts, files, visible, result,
                                       parts=((APPLICATION, window), (SYSTEM_MODULE, tuple(service_parts))))
        return _finish_application(request, facts, files, visible, result, parts=members)

    # Rule 1 without a window: how strongly the markers decide (see STRONG_MARKERS).
    found = [reason for package in own for reason in markers[package.name]]
    if found:
        for reason in found:
            facts.because(reason)
        strong = any(_strength(reason) == "strong" for reason in found)
        # Artwork and themes that also hold boot or session files (plymouth and grub themes,
        # backgrounds, branding): a data add-on; the boot and session parts follow the device.
        artwork = _any(own_payload, ARTWORK)
        if own_payload and 3 * len(artwork) >= 2 * len(own_payload) and \
                not any(reason.startswith(("kernel", "DKMS", "firmware", "an init system", "system service",
                                           "boot chain files", "a display manager's greeter")) for reason in found):
            facts.because(f"artwork and themes ({artwork[0]}): a data add-on")
            return result(DEVICE_ADD_ON, add_on="data")
        # A language binding, or a library's data package, follows the library: the workspace,
        # with a notice for the system parts it carries (python3-firewall, gir1.2-*, lib*-data).
        data_parts = all(reason.startswith(("a D-Bus system service", "polkit rules", "sudoers rules"))
                         for reason in found)
        if not strong and (_binding(top, own_payload) or (data_parts and (
                re.match(r"^lib.*-(data|common|bin|utils)$", top.name) or (
                    re.search(r"-(data|common)$", top.name)
                    and not any(_matches(path, PROGRAM_PATTERNS) for path in own_payload))))):
            what = next((reason for reason in found if _strength(reason) != "strong"), found[0])
            facts.because("a language binding or library data: it follows its library")
            return result(WORKSPACE, notice=(
                f"Installed as a workspace package. It also carries system parts ({what}). One tap on its page "
                "installs it as a system module instead; undo returns it to how it is now."))
        decision = _decide(found, _user_payload([top] + [package for package in own[1:]
                                                         if package.name in _member_names(request)]),
                           _signed_system_module(top))
        session_parts = _any(own_payload, data_sections("addon-paths.txt").get("session", ()))
        if decision == SYSTEM_MODULE and session_parts and not any(_strength(reason) == "strong" for reason in found):
            facts.because(f"a desktop add-on ({session_parts[0]}) with system parts: the person chooses")
            return result(CHOICE, choices=(DEVICE_ADD_ON, SYSTEM_MODULE), parts=members)
        if decision == SYSTEM_MODULE:
            if any(_strength(reason) == "ask" for reason in found) and _signed_system_module(top):
                facts.flag(SIGNED_SYSTEM_MODULE)
            return result(SYSTEM_MODULE, fallback="layering, labelled and asked", parts=members)
        facts.because("system parts beside what a person uses directly: the person chooses")
        return result(CHOICE, choices=(WORKSPACE, SYSTEM_MODULE), parts=members)

    privilege, _ = _privilege(own, programs, facts, owner)
    if privilege:
        for reason in privilege:
            facts.because(reason)
        return result(SYSTEM_TOOL, parts=members)

    # A desktop component: a session daemon that starts with every desktop, nothing a person runs.
    component = _session_component(own, own_payload)
    if component:
        facts.flag(DESKTOP_COMPONENT)
        facts.because(f"a desktop component ({component}): it changes the desktop for everyone")
        if host_provided(top.name, top.family):
            facts.flag(IMAGE_HAS_NAME)
            facts.because("the image carries it; this copy serves the workspace")
            return result(WORKSPACE)
        return result(SYSTEM_MODULE, fallback="layering, labelled and asked")

    # Rule 3: udev rules are a device request; alone (with data files) they are the whole request.
    rules = tuple(_any(files, DEVICE_RULE_PATTERNS))
    if rules:
        facts.flag(DEVICE_RULES)
        facts.because(f"udev rules become a device request ({rules[0]})")
        functional = [path for path in own_payload if path not in rules and _functional(path)]
        if own_payload and not functional:
            return result(DEVICE_REQUEST, device_rules=rules)

    # Command-line administration tools that need real root: a workspace's sudo is mapped
    # root, so parted or ethtool there would work worse than today.
    admin = _admin_commands([top] if own_payload else [package for package in own if package.name in members_named])
    if admin is not None:
        system, user = admin
        sbin_only = system and not user and all(path.startswith(("/usr/sbin/", "/sbin/")) for path in system)
        hardware = [name for package in [top, *own] for name in package.depends
                    if _matches(name, data_sections("system-tool.txt").get("admin-libraries", ()))]
        if sbin_only and hardware:
            facts.flag(CLI_ADMIN)
            facts.because(f"command-line administration tool ({Path(system[0]).name} in sbin, works on the "
                          f"device through {hardware[0]}): needs real root, which a workspace's sudo is not")
            return result(SYSTEM_TOOL, parts=members)
        if sbin_only or hardware:
            facts.because(f"administration commands ({Path((system or user)[0]).name}"
                          + (f", linking {hardware[0]}" if hardware else " in sbin")
                          + "); whether they need real root is not known: the person chooses")
            return result(CHOICE, choices=(SYSTEM_TOOL, WORKSPACE), device_rules=rules, parts=members)
        if system:
            facts.because(f"administration commands ({Path(system[0]).name}) beside "
                          + (f"user commands ({Path(user[0]).name})" if user else "no sbin location")
                          + ": the person chooses")
            return result(CHOICE, choices=(WORKSPACE, SYSTEM_TOOL), device_rules=rules, parts=members)

    # Rule 7: workspace or sandboxed console application, by how it arrived.
    return _console(request, facts, files, result, rules, members)


UNIT_FILES = ("*/systemd/system/*.service", "*/systemd/system/*.socket", "*/systemd/system/*.timer",
              "*/systemd/user/*.service", "*/systemd/user/*.socket", "/etc/init.d/*")
# Add-on packages named after their application: <application>-<add-on kind>.
ADD_ON_NAME = re.compile(r"^([a-z0-9][a-z0-9.+-]*?)-(plugins?|l10n|locale|i18n|translations|themes?|skins|footprints|"
                         r"symbols|templates|data|common|extras|addons?|backends?|modules)$")
ARTWORK = ("/usr/share/plymouth/themes/*", "/usr/share/backgrounds/*", "/usr/share/wallpapers/*",
           "/usr/share/desktop-base/*", "/usr/share/grub/themes/*", "/boot/grub/themes/*", "/usr/share/themes/*",
           "/usr/share/icons/*", "/usr/share/sounds/*", "/usr/share/gnome-background-properties/*",
           "/usr/share/images/*", "/usr/share/*/artwork/*", "/usr/share/*/branding/*", "/usr/share/lxqt/*",
           "/usr/share/sddm/themes/*", "/usr/share/lightdm/*", "/usr/share/anaconda/pixmaps/*",
           "/usr/share/fedora-logos/*", "/usr/share/*-logos/*", "*.png", "*.svg", "*.jpg", "*.jpeg", "*.webp")
BINDING_PATHS = ("/usr/lib/python3*", "/usr/lib*/python3*", "/usr/share/perl5/*", "/usr/lib/*/perl*",
                 "/usr/lib*/perl5/*", "/usr/lib*/girepository-1.0/*", "/usr/lib/*/girepository-1.0/*",
                 "/usr/share/gir-1.0/*", "/usr/lib/ruby/*", "/usr/share/ruby*", "/usr/share/nodejs/*",
                 "/usr/lib/node_modules/*")


def _binding(top: PackageInfo, payload: list[str]) -> bool:
    """A language binding: named as one (python3-*, gir1.2-*, lib*-perl, ruby-*, node-*) or mostly its files,
    with no commands of its own (a Python program with its modules is a program, not a binding)."""
    if any(path.startswith(BIN_DIRECTORIES) for path in payload):
        return False
    if re.match(r"^(python3?-|gir1\.2-|ruby-|node-|php-|perl-|lua-)|-perl$", top.name):
        return True
    inside = _any(payload, BINDING_PATHS)
    return bool(payload) and 2 * len(inside) > len(payload)


def _decide(reasons: list[str], user_payload: list[str], signed: bool) -> str:
    """SYSTEM_MODULE or CHOICE for a request without a window and with rule-1 markers.

    A library package that also ships a daemon (zvbi: libzvbi and zvbid) is a choice even
    with a strong marker: the person may want the library, not the service."""
    strengths = {_strength(reason) for reason in reasons if not reason.startswith("a login shell")}
    libraries = [path for path in user_payload if SHARED_LIBRARY.match(path)]
    if "strong" in strengths:
        return CHOICE if libraries and any(reason.startswith("system service") for reason in reasons) \
            and not any(reason.startswith(("kernel", "DKMS", "firmware", "boot chain", "an init system"))
                        for reason in reasons) else SYSTEM_MODULE
    if "ask" in strengths:  # PAM, NSS, pam.d, pam-configs and FUSE: always the person's choice
        return CHOICE
    return SYSTEM_MODULE if not user_payload else CHOICE


def _admin_commands(packages: Iterable[PackageInfo]) -> tuple[list[str], list[str]] | None:
    """(administration commands: in sbin or documented in section 8, user commands), or None."""
    system, user = [], []
    for package in packages:
        pages = _admin_pages(package)
        for path in package.files:
            if not path.startswith(BIN_DIRECTORIES) or path.startswith("/usr/games/"):
                continue
            if path.startswith(("/usr/sbin/", "/sbin/")) or Path(path).name in pages:
                system.append(path)
            else:
                user.append(path)
    return (system, user) if system or user else None


def _session_component(own: list[PackageInfo], payload: list[str]) -> str:
    """The session-component file when a package is a desktop session daemon and nothing else."""
    files = [path for package in own for path in package.files if not _neutral(path)]
    session = _any(files, SESSION_COMPONENT)
    if not session or not _any(files, ("/etc/xdg/autostart/*", "/usr/lib/systemd/user/*", "*polkit-*agent*")):
        return ""
    if any(path.startswith(("/usr/bin/", "/bin/")) for path in files):
        return ""
    if _any(files, ("/usr/include/*", "/usr/lib*/gio/modules/*", "/usr/lib/*/gio/modules/*", "/usr/lib*/lib*.so*",
                    "/usr/lib/*/lib*.so*")):
        return ""
    return session[0]


def _member_names(request: Request) -> set[str]:
    top = request.package
    if _payload(top):
        return set()
    by_name = {package.name: package for package in request.dependencies}
    names, queue = set(), list(top.depends)
    while queue:
        name = queue.pop()
        if name in names or name not in by_name:
            continue
        names.add(name)
        if not _payload(by_name[name]):
            queue.extend(by_name[name].depends)
    return names


def _application_served(request: Request, payload: list[str]) -> tuple[str, str] | None:
    """(owner, 'application'|'desktop'|'system') when the top-level package is data or plugins
    made for one owner and has no programs or libraries of its own to link:

    * an application or desktop component of its source depends on it (gedit-common,
      emacs-common, vlc-data, mate-settings-daemon-common), or
    * its files lie in a direct dependency's own folder (remmina's plugins, LibreOffice's
      dictionary extensions, smplayer's themes, nginx's modules); that dependency, or a
      package of its source in the request, decides what the owner is."""
    top = request.package
    affix = ADD_ON_NAME.match(top.name)
    if affix and not payload and affix.group(2) in ("l10n", "locale", "i18n", "translations"):
        if _window_of(request, affix.group(1)) is False:
            return None  # translations of a library or command-line tool
        return affix.group(1), "application"  # translations only (locale files): the application's
    if affix and not payload and _window_of(request, affix.group(1)):
        return affix.group(1), "application"  # only schemas and metadata of an application with a window
    if not payload or any(path.startswith(BIN_DIRECTORIES) for path in payload):
        return None
    if any(SHARED_LIBRARY.match(path) for path in payload):
        return None
    data_only = not any(".so" in Path(path).name for path in payload)
    in_folder = 2 * len([path for path in payload if f"/{_source(top)}/" in path]) > len(payload)
    for dependent in request.dependents if data_only or in_folder else ():
        if top.name not in dependent.depends:
            continue
        visible, _, _ = _launchers((dependent,), (dependent,))
        if visible or (_source(dependent) == _source(top) and any(
                entry.no_display is not True and not entry.terminal for entry in dependent.desktop)):
            return dependent.name, "application"  # the launcher of its source runs a program it may not ship
        if _desktop_environment([dependent]) or _session_daemon([dependent], []):
            return dependent.name, "desktop"
    if affix and not affix.group(1).startswith(("lib", "python", "gir1.2", "perl", "ruby", "node", "texlive", "tex")):
        root = affix.group(1)
        inside = [path for path in payload if re.search(rf"/{re.escape(root)}([-/])", path)]
        if 2 * len(inside) > len(payload) and _window_of(request, root) is not False:
            return root, "application"  # hexchat-plugins in /usr/lib/*/hexchat/, kicad-footprints
    for line in data_sections("addon-paths.txt").get("application", ()):
        pattern, _, owner = line.rpartition(" ")
        inside = [path for path in payload if fnmatch.fnmatchcase(path, pattern.strip())]
        if inside and 2 * len(inside) > len(payload):
            return owner.strip(), "application"
    by_name = {package.name: package for package in request.dependencies}
    for name in top.depends:
        dependency = by_name.get(name)
        if dependency is None:
            continue
        roots = {re.sub(r"-(core|common|bin|data)$", "", name), _source(dependency)}
        if len(_first(name)) > 2 and any(entry.no_display is not True and not entry.terminal
                                         for entry in dependency.desktop):
            roots.add(_first(name))  # obs-studio's /usr/lib64/obs-plugins
        inside = [path for path in payload if any(re.search(rf"/{re.escape(root)}([-/])", path) for root in roots)]
        if 2 * len(inside) <= len(payload):
            continue
        family = [package for package in request.dependencies if _source(package) == _source(dependency)]
        if any(_launchers((package,), (package,))[0] for package in family):
            return name, "application"
        rest = tuple(package for package in request.dependencies if package.name != name)
        owner = classify(Request(dependency, rest))
        if owner.kind == SYSTEM_MODULE and DESKTOP_ENVIRONMENT in owner.flags:
            return name, "application"  # a Sugar activity, a desktop's own application
        if owner.kind == SYSTEM_MODULE:
            return name, "system"
        core = re.match(r"^(.+)-(core|common|data|bin)$", name)
        named, by_source = _window_of(request, core.group(1) if core else name), _window_of(request, _source(dependency))
        if named is False and not by_source:
            continue  # add_on_of names an application with a window, never a library or command-line tool
        if core and not any(path.startswith(BIN_DIRECTORIES) for path in dependency.files):
            return core.group(1), "application"  # libreoffice-core: the application is libreoffice
        if re.search(r"/(plugins?|extensions?|addons?|modules|themes|skins)/", inside[0]):
            return (name if named else _source(dependency)), "application"
    return None


def _window_of(request: Request, root: str) -> bool | None:
    """Whether the packages named ``root`` (or of that source) in the request have a launcher a
    person sees: None when none of them is in the request."""
    related = [package for package in (*request.dependencies, *request.dependents)
               if package.name == root or _source(package) == root or package.name.startswith(root + "-")]
    if not related:
        return None
    return any(entry.no_display is not True and not entry.terminal for package in related for entry in package.desktop)


def _front_end_part(request: Request, own: list[PackageInfo]) -> tuple[str, str] | None:
    """('window'|'command', front end) when the top-level package is data, -common or a backend of a
    package-manager front end of its source (or a hook on the package-manager service)."""
    top = request.package
    managers = data_sections("system-tool.txt").get("package-managers", ())
    if _matches(top.name, managers) or any(_matches(name, managers) for name in top.depends
                                           if not _matches(name, ("PackageKit*", "packagekit*", "libpackagekit*"))) or \
            any(SHARED_LIBRARY.match(path) for path in top.files) or host_provided(top.name, top.family) or \
            not _payload(top):
        return None
    core = tuple(line for line in managers if not _matches(line, ("PackageKit*", "packagekit*", "libpackagekit*")))
    found = None
    for package in (*own[1:], *request.dependents):
        if _source(package) != _source(top):
            continue
        service = any(_matches(name, core + ("PackageKit", "packagekit")) for name in package.depends)
        if any(entry.no_display is not True and ("PackageManager" in entry.categories or
                                                 (service and "System" in entry.categories))
               for entry in package.desktop):
            return "window", package.name
        if found is None and any(_matches(name, core) for name in package.depends) and \
                any(path.startswith(BIN_DIRECTORIES) for path in package.files):
            found = ("command", package.name)
    if found is None and any(_matches(name, ("PackageKit", "packagekit")) for name in top.depends):
        found = ("command", next(name for name in top.depends if _matches(name, ("PackageKit", "packagekit"))))
    return found


def _session_role(packages: Iterable[PackageInfo]) -> str:
    """The user unit, session service or autostart entry that fills a session role the host shell
    fills (notifications, keyring and SSH agent, global shortcuts, polkit agent), or ''."""
    roles = data_sections("addon-paths.txt").get("session-roles", ())
    for package in packages:
        files = [path for path in package.files if _USER_UNIT.match(path)] + \
            [path for path, _ in package.session_services] + [path for path, _ in package.autostart]
        if not files:
            continue
        hit = next((path for path in files if _matches(Path(path).name.lower(), roles)), "")
        if hit or _matches((package.fields.get("Description") or "").lower(), roles):
            return hit or files[0]
    return ""


def _session_daemon(own: Iterable[PackageInfo], programs: list[tuple[str, bool]]) -> str:
    """The file that makes a package a desktop session daemon, or ''."""
    windows = {Path(program).name for program, _ in programs if program}
    for package in own:
        for path, exec_line in package.autostart:
            program = Path(_program(exec_line)[0]).name if exec_line else ""
            if program and program not in windows and program not in ("sh", "bash", "env"):
                return path
        if not windows:
            for path, exec_line in package.session_services:
                program = _program(exec_line)[0] if exec_line else ""
                if program.startswith(("/usr/libexec/", "/usr/lib/", "/usr/lib64/")):
                    return path
        plugins = _any(package.files, DESKTOP_DAEMON_PLUGINS)
        if plugins:
            return plugins[0]
    return ""


def _functional(path: str) -> bool:
    """A program or library, as opposed to data that comes with udev rules."""
    return _matches(path, PROGRAM_PATTERNS) or ".so" in Path(path).name


def _members(request: Request) -> tuple[tuple[str, tuple[str, ...]], ...]:
    """A meta-package's direct members, each classified on its own, grouped by kind."""
    by_name = {package.name: package for package in request.dependencies}
    grouped: dict[str, list[str]] = {}
    for name in request.package.depends:
        member = by_name.get(name)
        if member is None:
            continue
        rest = tuple(package for package in request.dependencies if package.name != name)
        outcome = classify(Request(member, rest, request.arrival, request.release, request.origin,
                                   curated=request.curated))
        kind = APPLICATION_ADD_ON if outcome.kind == APPLICATION and outcome.add_on_of else outcome.kind
        grouped.setdefault(kind, []).append(name)
    return tuple((kind, tuple(names)) for kind, names in grouped.items())


def _finish_application(request: Request, facts: _Facts, files: list[str], visible, result,
                        parts: tuple = ()) -> Classification:
    top = request.package
    commands = [path for path in top.files if path.startswith(BIN_DIRECTORIES)]
    if commands and _any(files, ELECTRON_MARKERS):
        facts.flag(ELECTRON_CLI)
        facts.because(f"Electron command {commands[0]} is exported as the application's command")
    elif commands:
        facts.because(f"its commands ({Path(commands[0]).name}) start in its sandbox")
    rules = tuple(_any(files, DEVICE_RULE_PATTERNS))
    if rules:
        facts.flag(DEVICE_RULES)
        facts.because(f"udev rules become a device request ({rules[0]})")
    if request.arrival in (SIGNED_LIST, SHEET_FULL_ACCESS):
        facts.flag(IDE)
        facts.because("entered the workspace through " + ("Suno's signed list" if request.arrival == SIGNED_LIST
                                                         else "the sheet's full-access choice"))
        return result(WORKSPACE, device_rules=rules, parts=parts, fallback=APPLICATION)
    return result(APPLICATION, device_rules=rules, parts=parts)


def _console(request: Request, facts: _Facts, files: list[str], result, rules: tuple[str, ...],
             members: tuple = ()) -> Classification:
    top = request.package
    if _matches(top.name, IMAGE_INTERPRETERS.get(top.family, ())):
        facts.flag(INTERPRETER_MODULE)
    if request.arrival == FILE:
        facts.because("a package file from Files or Depot: a sandboxed console application")
        return result(CONSOLE_APPLICATION, device_rules=rules, parts=members)
    facts.because({COMMAND: "a typed package command: the workspace",
                   COMMAND_FILE: "a typed package file: the default workspace when it resolves there",
                   SIGNED_LIST: "Suno's signed list: the workspace",
                   SHEET_FULL_ACCESS: "the sheet's full-access choice: the workspace"}[request.arrival])
    if request.arrival == COMMAND_FILE:
        facts.flag(WORKSPACE_IF_RESOLVES)
        return result(WORKSPACE, device_rules=rules, fallback=CONSOLE_APPLICATION, parts=members)
    return result(WORKSPACE, device_rules=rules, parts=members)
