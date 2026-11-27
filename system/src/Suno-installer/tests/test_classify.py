# SPDX-License-Identifier: Apache-2.0
"""The package classifier (ADR-052 Amendment 1, section 2, "Classification"): rules and every hard case."""
from __future__ import annotations

import unittest
from pathlib import Path

from Suno_installer import classify as c
from Suno_installer.classify import DesktopEntry, PackageInfo, Policy, Request


def launcher(name: str, exec_line: str, **options) -> DesktopEntry:
    return DesktopEntry(f"/usr/share/applications/{name}.desktop", exec_line, **options)


def package(name: str, *files: str, **options) -> PackageInfo:
    return PackageInfo(name, options.pop("version", "1.0"), options.pop("family", "deb"), files=tuple(files), **options)


def app(name: str, *files: str, **options) -> PackageInfo:
    """A windowed application: its program and a visible launcher for it."""
    desktop = options.pop("desktop", (launcher(name, f"{name} %U", categories=options.pop("categories", ("Graphics",))),))
    return package(name, f"/usr/bin/{name}", f"/usr/share/applications/{name}.desktop", *files, desktop=desktop,
                   **options)


def run(top: PackageInfo, *dependencies: PackageInfo, **options) -> c.Classification:
    options.setdefault("curated", False)  # these tests are about the rules
    return c.classify(Request(top, tuple(dependencies), **options))


class DataFiles(unittest.TestCase):
    def test_every_data_file_says_what_it_is_and_loads(self):
        folder = Path(c.__file__).resolve().parent.parent / "data/classify"
        names = sorted(path.name for path in folder.iterdir())
        names = [name for name in names if name.endswith(".txt")]
        self.assertEqual(names, ["addon-paths.txt", "host-provided.txt", "inert-integration.txt", "kmod-map.txt",
                                 "signed-list.txt", "snap-transitional.txt", "system-tool.txt"])
        for name in names:
            text = (folder / name).read_text()
            self.assertTrue(text.startswith("# "), name)
            self.assertIn("classify.py", text.split("\n\n")[0], name)
            self.assertTrue(c.data_sections(name), name)

    def test_the_daemons_the_adr_names_are_host_provided(self):
        for name in ("dbus", "polkitd", "avahi-daemon", "colord", "cups", "udisks2", "bluez", "upower", "rtkit",
                     "geoclue-2.0", "libsane1"):
            self.assertTrue(c.host_provided(name, "deb"), name)
        for name in ("dbus-broker", "polkit", "avahi", "colord", "cups", "udisks2", "bluez", "upower", "rtkit",
                     "geoclue2", "sane-backends"):
            self.assertTrue(c.host_provided(name, "rpm"), name)
        self.assertFalse(c.host_provided("postgresql-common", "deb"))

    def test_an_unknown_arrival_is_an_error(self):
        with self.assertRaises(ValueError):
            run(package("x", "/usr/bin/x"), arrival="mail")


class OwnDependencies(unittest.TestCase):
    def test_base_host_and_shared_packages_are_not_own(self):
        graph = {"gimp": ["libgimp", "libc6", "dbus"], "libgimp": ["libgegl", "libc6"], "libgegl": ["libc6"],
                 "dbus": ["libdbus"], "libdbus": []}
        self.assertEqual(c.own_dependencies("gimp", graph, {"libc6"}), ["libgegl", "libgimp"])
        self.assertEqual(c.own_dependencies("gimp", graph, {"libc6"}, needed_elsewhere={"libgegl"}), ["libgimp"])

    def test_the_walk_stops_at_a_host_provided_daemon(self):
        graph = {"tool": ["polkitd"], "polkitd": ["libpolkit-agent"], "libpolkit-agent": []}
        self.assertEqual(c.own_dependencies("tool", graph, set()), [])


class Rules(unittest.TestCase):
    """Rules 1-7 in order."""

    def test_rule1_system_services_kernel_pam_nss_polkit_rules_and_the_rest(self):
        cases = {
            "/usr/lib/systemd/system/food.service": "system service",
            "/lib/systemd/system/food.socket": "system service",
            "/etc/init.d/foo": "system service",
            "/usr/share/polkit-1/rules.d/50-foo.rules": "polkit rules",
            "/usr/lib/binfmt.d/foo.conf": "binfmt",
            "/usr/lib/sysctl.d/50-foo.conf": "kernel settings",
            "/etc/modprobe.d/foo.conf": "kernel settings",
            "/etc/sudoers.d/foo": "sudoers",
            "/usr/lib/firmware/foo.bin": "firmware",
            "/usr/lib/cups/filter/foofilter": "CUPS",
            "/usr/share/ppd/foo/foo.ppd": "CUPS",
            "/usr/share/dbus-1/system-services/org.foo.service": "D-Bus system service",
            "/usr/lib/x86_64-linux-gnu/pcsc/drivers/foo.bundle/Info.plist": "smart-card",
        }
        for path, reason in cases.items():
            result = run(package("foo", "/usr/sbin/food", path))
            self.assertEqual(result.kind, c.SYSTEM_MODULE, path)
            self.assertTrue(any(reason in item for item in result.reasons), (path, result.reasons))

    def test_rule1_a_meta_package_that_brings_the_devices_desktop_is_refused(self):
        desktop = package("ubuntu-desktop", depends=("gdm3", "gnome-shell", "firefox"))
        result = run(desktop, package("firefox", "/usr/bin/firefox"))
        self.assertIn(c.DESKTOP_ENVIRONMENT, result.flags)
        self.assertTrue(result.refused)

    def test_rule1_a_desktop_environment_or_display_manager_is_refused(self):
        session = run(package("xfce4-session", "/usr/bin/xfce4-session", "/usr/share/xsessions/xfce.desktop"))
        self.assertEqual(session.kind, c.SYSTEM_MODULE)
        self.assertIn(c.DESKTOP_ENVIRONMENT, session.flags)
        self.assertIn("Suno Mod", session.refused)
        manager = run(package("sddm", "/usr/bin/sddm", "/usr/lib/systemd/system/sddm.service"))
        self.assertIn(c.DESKTOP_ENVIRONMENT, manager.flags)
        self.assertTrue(manager.refused)

    def test_rule2_polkit_exec_path_setuid_capabilities_and_pkexec_launchers(self):
        gparted = app("gparted", "/usr/sbin/gpartedbin", "/usr/share/polkit-1/actions/org.gnome.gparted.policy",
                      policies=(Policy("/usr/share/polkit-1/actions/org.gnome.gparted.policy", ("/usr/sbin/gpartedbin",)),))
        self.assertEqual(run(gparted).kind, c.SYSTEM_TOOL)
        setuid = package("pinger", "/usr/bin/pinger", setuid=("/usr/bin/pinger",))
        self.assertEqual(run(setuid).kind, c.SYSTEM_TOOL)
        synaptic = app("synaptic", "/usr/sbin/synaptic", "/usr/bin/synaptic-pkexec",
                       desktop=(launcher("synaptic", "synaptic-pkexec"),))
        result = run(synaptic)
        self.assertEqual(result.kind, c.SYSTEM_TOOL)
        self.assertIn("launcher runs through pkexec (synaptic-pkexec)", result.reasons)
        timeshift = app("timeshift", "/usr/bin/timeshift-gtk", "/usr/bin/timeshift-launcher",
                        desktop=(launcher("timeshift", "timeshift-launcher"),))
        self.assertEqual(run(timeshift).kind, c.SYSTEM_TOOL)
        wrapped = app("tool", desktop=(launcher("tool", "pkexec /usr/bin/tool"),))
        self.assertEqual(run(wrapped).kind, c.SYSTEM_TOOL)

    def test_rule2_an_application_with_a_privileged_command_is_a_choice(self):
        ui = app("wireshark", desktop=(launcher("org.wireshark.Wireshark", "wireshark %f"),), depends=("wireshark-common",))
        common = package("wireshark-common", "/usr/bin/dumpcap", capabilities=("/usr/bin/dumpcap",),
                         fields={"Source": "wireshark"})
        result = run(ui, common)
        self.assertEqual((result.kind, result.choices), (c.CHOICE, (c.APPLICATION, c.SYSTEM_TOOL)))
        self.assertTrue(any(reason.startswith("dumpcap runs without its file capabilities: live capture")
                            for reason in result.reasons), result.reasons)

    def test_rule2_privilege_on_an_ordinary_command_is_dropped_with_a_line(self):
        for name, path, hint in (("iputils-ping", "/usr/bin/ping", "ping_group_range"),
                                 ("mtr", "/usr/bin/mtr-packet", "mtr needs raw sockets"),
                                 ("bsdutils", "/usr/bin/wall", "tty group")):
            result = run(package(name, path, "/usr/bin/other", capabilities=(path,)))
            self.assertEqual(result.kind, c.WORKSPACE, name)
            self.assertIn(c.PRIVILEGE_DROPPED, result.flags)
            self.assertTrue(any(hint in reason for reason in result.reasons), result.reasons)

    def test_rule2_privilege_on_the_main_binary_is_a_system_tool(self):
        self.assertEqual(run(package("mount", "/usr/bin/mount", setuid=("/usr/bin/mount",))).kind, c.SYSTEM_TOOL)
        gufw = package("gufw", "/usr/bin/gufw-pkexec", "/usr/share/polkit-1/actions/com.ubuntu.pkexec.gufw.policy",
                       policies=(Policy("/usr/share/polkit-1/actions/com.ubuntu.pkexec.gufw.policy",
                                        ("/usr/bin/gufw-pkexec",)),))
        self.assertEqual(run(gufw).kind, c.SYSTEM_TOOL)

    def test_rule2_chromiums_setuid_sandbox_is_dropped_not_a_system_tool(self):
        chrome = app("google-chrome-stable", "/opt/google/chrome/chrome", "/opt/google/chrome/chrome-sandbox",
                     desktop=(launcher("google-chrome", "/usr/bin/google-chrome-stable %U"),),
                     setuid=("/opt/google/chrome/chrome-sandbox",))
        result = run(chrome)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.HELPER_DROPPED, result.flags)

    def test_rule2_an_optional_helper_is_named_instead_of_making_a_system_tool(self):
        monitor = app("gnome-system-monitor", "/usr/libexec/gnome-system-monitor/gsm-kill",
                      "/usr/share/polkit-1/actions/org.gnome.gnome-system-monitor.policy",
                      policies=(Policy("/usr/share/polkit-1/actions/org.gnome.gnome-system-monitor.policy",
                                       ("/usr/libexec/gnome-system-monitor/gsm-kill",)),))
        result = run(monitor)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.HELPER_DROPPED, result.flags)

    def test_rule3_udev_rules_alone_are_a_device_request(self):
        devices = package("steam-devices", "/lib/udev/rules.d/60-steam-input.rules",
                          "/lib/udev/rules.d/60-steam-vr.rules", "/usr/share/doc/steam-devices/copyright")
        result = run(devices)
        self.assertEqual(result.kind, c.DEVICE_REQUEST)
        self.assertEqual(len(result.device_rules), 2)
        platform = package("android-sdk-platform-tools-common", "/lib/udev/rules.d/51-android.rules")
        self.assertEqual(run(platform).kind, c.DEVICE_REQUEST)

    def test_rule3_an_applications_udev_rules_are_its_device_request(self):
        openrgb = app("openrgb", "/usr/lib/udev/rules.d/60-openrgb.rules")
        result = run(openrgb)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertEqual(result.device_rules, ("/usr/lib/udev/rules.d/60-openrgb.rules",))
        qmk = package("qmk", "/usr/bin/qmk", "/usr/lib/udev/rules.d/50-qmk.rules")
        result = run(qmk)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertIn(c.DEVICE_RULES, result.flags)

    def test_rule4_data_add_ons_are_for_the_person(self):
        icons = package("papirus-icon-theme", "/usr/share/icons/Papirus/index.theme",
                        "/usr/share/icons/Papirus/48x48/apps/foo.svg", "/usr/share/doc/papirus-icon-theme/copyright")
        result = run(icons)
        self.assertEqual((result.kind, result.add_on), (c.DEVICE_ADD_ON, "data"))
        dictionary = package("hunspell-de-de", "/usr/share/hunspell/de_DE.dic", "/usr/share/hunspell/de_DE.aff")
        self.assertEqual(run(dictionary).add_on, "data")

    def test_rule4_native_session_add_ons_are_marked_session(self):
        mozc = package("ibus-mozc", "/usr/lib/ibus-mozc/ibus-engine-mozc", "/usr/share/ibus/component/mozc.xml")
        result = run(mozc)
        self.assertEqual((result.kind, result.add_on), (c.DEVICE_ADD_ON, "session"))
        extension = package("gnome-shell-extension-appindicator",
                            "/usr/share/gnome-shell/extensions/appindicatorsupport@rgcjonas.gmail.com/extension.js",
                            "/usr/share/glib-2.0/schemas/org.gnome.shell.extensions.appindicator.gschema.xml")
        self.assertEqual(run(extension).add_on, "session")

    def test_rule5_fonts_per_person_and_codecs_per_release(self):
        fonts = package("fonts-firacode", "/usr/share/fonts/truetype/firacode/FiraCode-Regular.ttf",
                        "/etc/fonts/conf.d/60-firacode.conf")
        self.assertEqual((run(fonts).kind, run(fonts).add_on), (c.DEVICE_ADD_ON, "fonts"))
        ugly = package("gstreamer1.0-plugins-ugly", "/usr/lib/x86_64-linux-gnu/gstreamer-1.0/libgstx264.so")
        self.assertEqual(run(ugly).add_on, "codecs")
        rpm = package("gstreamer1-plugin-openh264", "/usr/lib64/gstreamer-1.0/libgstopenh264.so", family="rpm")
        self.assertEqual(run(rpm).add_on, "codecs")

    def test_rule6_a_hidden_launcher_or_one_that_runs_nothing_of_the_package_is_not_an_application(self):
        hidden = package("handler", "/usr/bin/handler", "/usr/share/applications/handler.desktop",
                         desktop=(launcher("handler", "handler %u", no_display=True),))
        self.assertEqual(run(hidden).choices, (c.APPLICATION, c.WORKSPACE))  # a window opened from elsewhere
        foreign = package("docs", "/usr/share/docs-html/index.html", "/usr/share/applications/docs.desktop",
                          desktop=(launcher("docs", "xdg-open /usr/share/docs-html/index.html"),))
        self.assertNotEqual(run(foreign).kind, c.APPLICATION)
        unknown = package("maybe", "/usr/bin/maybe", desktop=(launcher("maybe", None, no_display=None),))
        self.assertEqual(run(unknown).kind, c.WORKSPACE)

    def test_rule6_a_terminal_launcher_is_a_console_program(self):
        htop = package("htop", "/usr/bin/htop", "/usr/share/applications/htop.desktop",
                       desktop=(launcher("htop", "htop", terminal=True, categories=("System", "Monitor", "ConsoleOnly")),))
        self.assertEqual(run(htop).kind, c.WORKSPACE)
        self.assertEqual(run(htop, arrival=c.FILE).kind, c.CONSOLE_APPLICATION)

    def test_rule6_exec_not_known_counts_any_program_the_request_ships(self):
        known = app("viewer", desktop=(launcher("viewer", None),))
        self.assertEqual(run(known).kind, c.APPLICATION)

    def test_rule7_entry_to_a_workspace(self):
        tool = package("ripgrep", "/usr/bin/rg")
        self.assertEqual(run(tool, arrival=c.COMMAND).kind, c.WORKSPACE)
        self.assertEqual(run(tool, arrival=c.SIGNED_LIST).kind, c.WORKSPACE)
        self.assertEqual(run(tool, arrival=c.SHEET_FULL_ACCESS).kind, c.WORKSPACE)
        self.assertEqual(run(tool, arrival=c.FILE).kind, c.CONSOLE_APPLICATION)

    def test_rule7_categories_never_grant_workspace_entry(self):
        ide = app("geany", categories=("Development", "IDE", "TextEditor"))
        self.assertEqual(run(ide, arrival=c.FILE).kind, c.APPLICATION)
        self.assertEqual(run(ide, arrival=c.COMMAND).kind, c.APPLICATION)

    def test_terminal_emulators_are_applications_with_the_host_shell_flag(self):
        kitty = app("kitty", categories=("System", "TerminalEmulator"))
        result = run(kitty)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.TERMINAL_EMULATOR, result.flags)


class OwnParts(unittest.TestCase):
    """What of a request is judged: its own parts (same source, meta members), not shared dependencies."""

    def test_another_projects_launcher_does_not_make_a_command_line_tool_an_application(self):
        unoconv = package("unoconv", "/usr/bin/unoconv", depends=("libreoffice-calc",))
        calc = app("libreoffice-calc", fields={"Source": "libreoffice"})
        self.assertEqual(run(unoconv, calc).kind, c.WORKSPACE)

    def test_another_projects_daemon_stays_inert_for_a_tool(self):
        share = package("gnome-user-share", "/usr/libexec/gnome-user-share-webdav", depends=("httpd",))
        httpd = package("httpd", "/usr/sbin/httpd", "/usr/lib/systemd/system/httpd.service")
        result = run(share, httpd)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertIn(c.DEPENDENCY_DAEMON_INERT, result.flags)

    def test_the_applications_own_daemon_from_the_same_source_is_split_off(self):
        ui = app("input-remapper-gtk", fields={"Source": "input-remapper"}, depends=("python3-inputremapper",))
        daemon = package("input-remapper-daemon", "/usr/bin/input-remapper-service",
                         "/lib/systemd/system/input-remapper-daemon.service",
                         "/usr/share/dbus-1/system.d/inputremapper.Control.conf", fields={"Source": "input-remapper"})
        meta = package("input-remapper", depends=("input-remapper-gtk", "input-remapper-daemon"))
        result = run(meta, ui, daemon)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.APP_SERVICE_SPLIT, result.flags)
        self.assertEqual(result.parts, ((c.APPLICATION, ("input-remapper-gtk",)),
                                        (c.SYSTEM_MODULE, ("input-remapper-daemon",))))

    def test_a_meta_package_lists_its_members_by_kind(self):
        group = package("@development-tools", family="rpm", depends=("git", "subversion"))
        git = package("git", "/usr/bin/git", family="rpm")
        svn = package("subversion", "/usr/bin/svn", "/usr/lib/systemd/system/svnserve.service", family="rpm")
        patch = package("patch", "/usr/bin/patch", family="rpm")
        server = package("valkey", "/usr/bin/valkey-server", "/usr/lib/systemd/system/valkey.service", family="rpm")
        result = run(PackageInfo(group.name, family="rpm", depends=("git", "subversion", "patch", "valkey")),
                     git, svn, patch, server)
        self.assertEqual(dict(result.parts), {c.WORKSPACE: ("git", "subversion", "patch"), c.SYSTEM_MODULE: ("valkey",)})
        self.assertEqual(result.kind, c.SYSTEM_MODULE)

    def test_an_optional_daemon_beside_client_tools_stays_inert_and_is_named(self):
        svn = package("subversion", "/usr/bin/svn", "/usr/bin/svnserve", "/usr/lib/systemd/system/svnserve.service",
                      family="rpm")
        result = run(svn)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertIn(c.OPTIONAL_SERVICE, result.flags)
        self.assertIn("optional service svnserve.service (subversion) stays inert in the workspace; "
                      "to run it, install subversion as a system module", result.reasons)
        clamav = package("clamav", "/usr/bin/clamscan", depends=("clamav-freshclam",))
        freshclam = package("clamav-freshclam", "/usr/bin/freshclam", "/lib/systemd/system/clamav-freshclam.service",
                            fields={"Source": "clamav"})
        self.assertEqual(run(clamav, freshclam).kind, c.WORKSPACE)

    def test_a_service_named_by_its_daemon_program_is_the_packages_own(self):
        sshd = package("openssh-server", "/usr/sbin/sshd", "/lib/systemd/system/ssh.service")
        self.assertEqual(run(sshd).kind, c.SYSTEM_MODULE)
        moby = package("moby-engine", "/usr/bin/dockerd", "/usr/lib/systemd/system/docker.service", family="rpm")
        self.assertEqual(run(moby).kind, c.SYSTEM_MODULE)
        tool = package("plocate", "/usr/bin/plocate", "/usr/lib/systemd/system/plocate-updatedb.timer")
        self.assertEqual(run(tool).kind, c.CHOICE)  # only named like it, beside a user command
        events = package("dmeventd", "/usr/sbin/dmeventd", "/usr/lib/systemd/system/dm-event.service")
        self.assertEqual(run(events).kind, c.SYSTEM_MODULE)

    def test_mount_helpers_are_system_modules(self):
        self.assertEqual(run(package("nfs-client", "/usr/sbin/mount.nfs")).choices, (c.WORKSPACE, c.SYSTEM_MODULE))
        mixed = run(package("cifs-utils", "/usr/sbin/mount.cifs", "/usr/bin/smbinfo"))
        self.assertEqual((mixed.kind, mixed.choices), (c.CHOICE, (c.WORKSPACE, c.SYSTEM_MODULE)))

    def test_backends_of_the_hosts_gvfs_are_host_integration(self):
        backends = package("gvfs-backends", "/usr/libexec/gvfsd-smb", "/usr/libexec/gvfsd-mtp",
                           "/usr/share/gvfs/mounts/smb.mount", "/usr/share/polkit-1/rules.d/org.gtk.vfs.file-operations.rules")
        result = run(backends)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertIn(c.HOST_INTEGRATION, result.flags)
        self.assertIn(c.IMAGE_HAS_NAME, result.flags)


class Choice(unittest.TestCase):
    """Conflicting signals or low confidence: kind "choice", never a silent system module or tool."""

    def test_an_application_with_system_parts_of_its_own(self):
        settings = app("gnome-control-center", "/usr/share/polkit-1/rules.d/gnome-control-center.rules")
        result = run(settings)
        self.assertEqual((result.kind, result.choices), (c.CHOICE, (c.APPLICATION, c.SYSTEM_MODULE)))

    def test_an_application_whose_polkit_policy_was_not_read(self):
        viewer = app("viewer", "/usr/share/polkit-1/actions/org.viewer.policy",
                     policies=(Policy("/usr/share/polkit-1/actions/org.viewer.policy", None),))
        result = run(viewer)
        self.assertEqual(result.choices, (c.APPLICATION, c.SYSTEM_TOOL))

    def test_a_meta_package_bringing_an_application_and_system_parts(self):
        meta = package("suite", depends=("suite-gui", "suite-server", "suite-auth"))
        gui = app("suite-gui")
        server = package("suite-server", "/usr/sbin/suite-serverd", "/usr/lib/systemd/system/suite-server.service")
        self.assertIn(c.APP_SERVICE_SPLIT, run(PackageInfo("suite", depends=("suite-gui", "suite-server")),
                                                gui, server).flags)  # its own service: a clear split
        auth = package("suite-auth", "/usr/lib/x86_64-linux-gnu/security/pam_suite.so")
        result = run(meta, gui, server, auth)
        self.assertEqual(result.kind, c.CHOICE)
        self.assertEqual(set(result.choices), {c.SYSTEM_MODULE, c.APPLICATION})

    def test_clear_cases_are_never_a_choice(self):
        self.assertEqual(run(package("tailscale", "/usr/sbin/tailscaled", "/lib/systemd/system/tailscaled.service")).kind,
                         c.SYSTEM_MODULE)
        self.assertEqual(run(app("gimp")).kind, c.APPLICATION)
        mullvad = app("mullvad-vpn", "/usr/bin/mullvad-daemon", "/usr/lib/systemd/system/mullvad-daemon.service")
        self.assertEqual(run(mullvad).kind, c.APPLICATION)

    def test_maintenance_units_and_boot_image_hooks_of_tools_stay_inert(self):
        dpkg = package("dpkg", "/usr/bin/dpkg", "/usr/lib/systemd/system/dpkg-db-backup.timer",
                       "/usr/lib/systemd/system/dpkg-db-backup.service", "/etc/cron.daily/dpkg")
        result = run(dpkg)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertTrue(any("stays inert" in reason for reason in result.reasons))
        kbd = package("kbd", "/usr/bin/setfont", "/usr/share/initramfs-tools/hooks/kbd")
        self.assertEqual(run(kbd).kind, c.WORKSPACE)
        tools = package("initramfs-tools-core", "/usr/sbin/mkinitramfs", "/usr/share/initramfs-tools/init",
                        "/usr/share/initramfs-tools/scripts/local")
        self.assertEqual(run(tools).kind, c.SYSTEM_MODULE)

    def test_the_c_librarys_own_nss_modules_are_not_nss_modules(self):
        libc = package("libc6", "/usr/lib/x86_64-linux-gnu/libc.so.6", "/usr/lib/x86_64-linux-gnu/libnss_files.so.2",
                       "/usr/lib/x86_64-linux-gnu/libnss_compat.so.2")
        self.assertEqual(run(libc).kind, c.WORKSPACE)
        mdns = package("libnss-mdns", "/usr/lib/x86_64-linux-gnu/libnss_mdns4_minimal.so.2")
        self.assertEqual(run(mdns).choices, (c.WORKSPACE, c.SYSTEM_MODULE))

    def test_an_add_ons_own_files_decide_before_the_application_it_needs(self):
        extension = package("nautilus-nextcloud", "/usr/share/nautilus-python/extensions/syncstate-Nextcloud.py",
                            depends=("nautilus", "nextcloud-desktop"))
        files = app("nautilus")
        client = app("nextcloud-desktop", "/lib/systemd/system/fake.service")
        result = run(extension, files, client)
        self.assertEqual((result.kind, result.add_on), (c.DEVICE_ADD_ON, "session"))

    def test_codec_plugins_with_their_own_libraries_are_codecs_a_core_library_is_not(self):
        bad = package("gstreamer1-plugins-bad-free", *[f"/usr/lib64/gstreamer-1.0/libgst{n}.so" for n in range(6)],
                      "/usr/lib64/libgstcodecs-1.0.so.0", "/usr/lib64/libgstphotography-1.0.so.0", family="rpm")
        self.assertEqual(run(bad).add_on, "codecs")
        core = package("libgstreamer1.0-0", "/usr/lib/x86_64-linux-gnu/libgstreamer-1.0.so.0",
                       "/usr/lib/x86_64-linux-gnu/libgstbase-1.0.so.0", "/usr/lib/x86_64-linux-gnu/libgstnet-1.0.so.0",
                       "/usr/lib/x86_64-linux-gnu/gstreamer-1.0/libgstcoreelements.so")
        self.assertEqual(run(core).kind, c.WORKSPACE)

    def test_fonts_anywhere_and_never_fontconfig_alone(self):
        fira = package("fonts-firacode", "/usr/share/fonts-firacode/woff2/FiraCode-Bold.woff2",
                       "/usr/share/fonts/truetype/firacode/FiraCode-Bold.ttf")
        self.assertEqual(run(fira).add_on, "fonts")
        config = package("fontconfig-config", "/etc/fonts/conf.d/10-hinting.conf",
                         "/usr/share/fontconfig/conf.avail/10-hinting.conf")
        self.assertEqual(run(config).kind, c.WORKSPACE)

    def test_udev_rules_with_only_data_beside_them_are_a_device_request(self):
        sdk = package("android-sdk-platform-tools-common", "/lib/udev/rules.d/51-android.rules",
                      "/usr/lib/android-sdk/platform-tools/package.xml")
        self.assertEqual(run(sdk).kind, c.DEVICE_REQUEST)


class BlindRoundOne(unittest.TestCase):
    """Categories from blind set 1 (handoffs app-model-classify-blind/round1/ANALYSIS.md, B-H)."""

    def test_b_command_line_admin_tools_in_sbin_are_system_tools(self):
        parted = package("parted", "/usr/sbin/parted", "/usr/sbin/partprobe", "/usr/share/man/man8/parted.8.gz",
                         depends=("libparted2t64", "libc6"))
        result = run(parted)
        self.assertEqual(result.kind, c.SYSTEM_TOOL)
        self.assertIn(c.CLI_ADMIN, result.flags)

    def test_b_sbin_commands_without_a_device_library_are_a_choice(self):
        logsave = run(package("logsave", "/usr/sbin/logsave", depends=("libc6",)))
        self.assertEqual((logsave.kind, logsave.choices), (c.CHOICE, (c.SYSTEM_TOOL, c.WORKSPACE)))

    def test_b_admin_and_user_commands_together_are_a_choice(self):
        tools = package("e2fsprogs", "/usr/sbin/mke2fs", "/usr/bin/chattr", "/usr/share/man/man8/mke2fs.8.gz")
        self.assertEqual(run(tools).choices, (c.WORKSPACE, c.SYSTEM_TOOL))
        # Fedora merged sbin into bin: section 8 alone is a choice, never a silent system tool.
        ethtool = package("ethtool", "/usr/bin/ethtool", "/usr/share/man/man8/ethtool.8.gz", family="rpm")
        self.assertEqual(run(ethtool).kind, c.CHOICE)

    def test_b_user_commands_stay_in_the_workspace(self):
        self.assertEqual(run(package("ripgrep", "/usr/bin/rg", "/usr/share/man/man1/rg.1.gz")).kind, c.WORKSPACE)

    def test_c_thumbnailers_panel_and_file_manager_plugins_scanner_backends(self):
        thumbs = package("ffmpegthumbnailer", "/usr/share/thumbnailers/ffmpegthumbnailer.thumbnailer",
                         "/usr/bin/ffmpegthumbnailer")
        self.assertEqual(run(thumbs).add_on, "session")
        panel = package("xfce4-weather-plugin", "/usr/lib/x86_64-linux-gnu/xfce4/panel/plugins/libweather.so",
                        "/usr/share/xfce4/panel/plugins/weather.desktop")
        self.assertEqual(run(panel).add_on, "session")
        kio = package("kio-extras", "/usr/lib/x86_64-linux-gnu/qt6/plugins/kf6/kio/sftp.so")
        self.assertEqual(run(kio).add_on, "session")
        sane = package("libsane-hpaio", "/usr/lib/x86_64-linux-gnu/sane/libsane-hpaio.so.1", "/etc/sane.d/dll.d/hplip")
        self.assertEqual(run(sane).add_on, "drivers")
        keyring = package("keyring-daemon", "/usr/libexec/keyring-daemon",
                          "/usr/share/dbus-1/services/org.freedesktop.secrets.service")
        self.assertEqual(run(keyring).add_on, "session")
        bitmap = package("bitmap-fonts", "/usr/share/fonts/bitmap/terminus.otb")
        self.assertEqual(run(bitmap).add_on, "fonts")

    def test_d_data_package_of_an_application_is_its_add_on(self):
        common = package("gedit-common", "/usr/share/gedit/plugins/snippets.plugin", "/usr/share/gedit/styles/x.xml")
        gedit = app("gedit", depends=("gedit-common",), fields={"Source": "gedit"})
        result = c.classify(Request(common, dependents=(gedit,)))
        self.assertEqual((result.kind, result.add_on_of), (c.APPLICATION, "gedit"))
        self.assertIn(c.APPLICATION_ADD_ON, result.flags)

    def test_d_a_library_of_an_applications_source_is_not_its_add_on(self):
        library = package("libavahi-client3", "/usr/lib/x86_64-linux-gnu/libavahi-client.so.3")
        result = c.classify(Request(library, dependents=(app("avahi-discover", fields={"Source": "avahi"}),)))
        self.assertEqual(result.kind, c.WORKSPACE)

    def test_d_a_program_with_its_launcher_in_its_common_package_is_an_application(self):
        emacs = package("emacs", "/usr/bin/emacs", depends=("emacs-common",), family="rpm")
        common = PackageInfo("emacs-common", family="rpm", fields={"Source": "emacs"},
                             files=("/usr/share/applications/emacs.desktop", "/usr/share/emacs/lisp/x.el"),
                             desktop=(launcher("emacs", "emacs %F"),))
        self.assertEqual(run(emacs, common).kind, c.APPLICATION)
        transitional = package("emacs-meta", depends=("emacs",), family="rpm")
        self.assertEqual(run(transitional, emacs, common).kind, c.APPLICATION)

    def test_e_gio_modules_with_a_user_service_are_not_a_desktop_component(self):
        networking = package("glib-networking", "/usr/lib64/gio/modules/libgiognutls.so",
                             "/usr/libexec/glib-pacrunner", "/usr/lib/systemd/user/glib-pacrunner.service",
                             "/usr/share/dbus-1/services/org.gtk.GLib.PACRunner.service", family="rpm")
        self.assertEqual(run(networking).kind, c.WORKSPACE)

    def test_d_plugin_in_an_applications_folder_is_its_add_on(self):
        plugin = package("remmina-plugin-secret", "/usr/lib/x86_64-linux-gnu/remmina/plugins/remmina-plugin-secret.so",
                         depends=("remmina",))
        result = run(plugin, app("remmina"))
        self.assertEqual((result.kind, result.add_on_of), (c.APPLICATION, "remmina"))

    def test_d_data_of_a_desktop_component_goes_with_the_desktop(self):
        data = package("mutter-common", "/usr/share/mutter/x.xml", "/usr/lib/udev/rules.d/61-mutter.rules")
        result = c.classify(Request(data, dependents=(package("mutter", "/usr/bin/mutter", depends=("mutter-common",)),),
                                    curated=False))
        self.assertEqual(result.kind, c.WORKSPACE)  # the image carries mutter: image-has-name
        self.assertIn(c.IMAGE_HAS_NAME, result.flags)
        other = package("budgie-wm-data", "/usr/share/budgie-wm/x.xml")
        result = c.classify(Request(other, dependents=(package("budgie-wm", "/usr/bin/budgie-wm",
                                                               depends=("budgie-wm-data",)),), curated=False))
        self.assertEqual(result.kind, c.WORKSPACE)  # round 6: data of a desktop component without code is inert

    def test_e_session_daemons_are_desktop_components_never_workspace(self):
        agent = package("polkit-kde-agent-1", "/usr/lib/x86_64-linux-gnu/libexec/polkit-kde-authentication-agent-1",
                        "/etc/xdg/autostart/polkit-kde-authentication-agent-1.desktop")
        result = run(agent)
        self.assertEqual(result.kind, c.SYSTEM_MODULE)
        self.assertIn(c.DESKTOP_COMPONENT, result.flags)
        provided = run(package("wireplumber", "/usr/bin/wireplumber-x", "/usr/libexec/wp",
                               "/usr/lib/systemd/user/wireplumber.service", "/etc/xdg/autostart/x.desktop"))
        self.assertNotEqual(provided.kind, c.SYSTEM_MODULE)  # has a user command: not only a session daemon
        host = run(package("wireplumber", "/usr/libexec/wireplumber", "/usr/lib/systemd/user/wireplumber.service"))
        self.assertEqual(host.kind, c.WORKSPACE)
        self.assertIn(c.IMAGE_HAS_NAME, host.flags)

    def test_f_nss_modules_outside_glibc_and_fuse_filesystems_are_choices(self):
        nis = run(package("libnss-nis", "/usr/lib/x86_64-linux-gnu/libnss_nis.so.2"))
        self.assertEqual((nis.kind, nis.choices), (c.CHOICE, (c.WORKSPACE, c.SYSTEM_MODULE)))
        self.assertTrue(any(reason.startswith("NSS modules") for reason in nis.reasons))
        s3fs = run(package("s3fs", "/usr/bin/s3fs", depends=("fuse3",)))
        self.assertEqual(s3fs.kind, c.CHOICE)
        self.assertTrue(any(reason.startswith("a FUSE filesystem") for reason in s3fs.reasons))

    def test_f_package_manager_configuration_alone_is_a_system_module(self):
        config = package("apt-config-auto-update", "/etc/apt/apt.conf.d/10periodic")
        self.assertEqual(run(config).choices, (c.WORKSPACE, c.SYSTEM_MODULE))  # round 5: a choice

    def test_g_pam_service_configs_and_pam_modules_are_choices_unless_signed(self):
        screen = run(package("screen", "/usr/bin/screen", "/etc/pam.d/screen"))
        self.assertEqual(screen.kind, c.CHOICE)
        self.assertTrue(any(reason.startswith("a PAM service configuration") for reason in screen.reasons))
        libcap = run(package("libcap", "/usr/lib64/libcap.so.2", "/usr/lib64/security/pam_cap.so", family="rpm"))
        self.assertEqual(libcap.choices, (c.WORKSPACE, c.SYSTEM_MODULE))
        unsigned = run(package("pam-extra", "/usr/lib/x86_64-linux-gnu/security/pam_extra.so"))
        self.assertEqual(unsigned.kind, c.CHOICE)
        signed = run(package("libpam-modules", "/usr/lib/x86_64-linux-gnu/security/pam_unix.so"))
        self.assertEqual((signed.kind, signed.default), (c.CHOICE, c.WORKSPACE))  # round 5: always a choice
        profiles = run(package("libpam-runtime", "/usr/share/pam-configs/unix", "/usr/sbin/pam-auth-update"))
        self.assertEqual(profiles.kind, c.CHOICE)

    def test_g_a_language_module_with_a_unit_named_like_it_is_a_choice(self):
        php = run(package("php-xml", "/usr/lib64/php/modules/xml.so", "/usr/lib/systemd/system/php-xml.service",
                          family="rpm"))
        self.assertEqual(php.kind, c.WORKSPACE)  # round 5: a binding follows its library, with a notice
        self.assertIn("system module", php.notice)

    def test_h_tex_fonts_are_workspace_data_and_package_manager_windows_a_choice(self):
        tex = package("texlive-fonts-recommended", "/usr/share/texlive/texmf-dist/fonts/type1/urw/a.pfb")
        self.assertEqual(run(tex).kind, c.WORKSPACE)
        base = package("texlive-base", "/usr/bin/tex", fields={"Source": "texlive"})
        tex = PackageInfo("texlive-fonts-extra", files=("/usr/share/texlive/texmf-dist/fonts/x.pfb",),
                          depends=("texlive-base",), fields={"Source": "texlive"})
        self.assertEqual(run(tex, base).kind, c.WORKSPACE)  # its source's launcher is not its own
        discover = app("plasma-discover", categories=("System", "PackageManager"))
        self.assertEqual(run(discover).choices, (c.APPLICATION, c.SYSTEM_TOOL))
        steam = app("steam", categories=("Network", "Game", "PackageManager"))
        self.assertEqual(run(steam).kind, c.APPLICATION)  # a game store, not the system's packages


class BlindRoundTwo(unittest.TestCase):
    """Categories from blind set 2 (handoffs app-model-classify-blind2/round2)."""

    def test_a_library_that_also_ships_a_daemon_is_a_choice(self):
        zvbi = package("zvbi", "/usr/lib64/libzvbi.so.0", "/usr/sbin/zvbid", "/usr/lib/systemd/system/zvbid.service",
                       family="rpm")
        result = run(zvbi)
        self.assertEqual((result.kind, result.choices), (c.CHOICE, (c.WORKSPACE, c.SYSTEM_MODULE)))

    def test_an_add_on_for_one_application_is_an_application_add_on(self):
        dictionary = package("libreoffice-dict-eo", "/usr/lib64/libreoffice/share/extensions/dict-eo/eo.dic",
                             depends=("libreoffice-core",), family="rpm")
        core = package("libreoffice-core", "/usr/lib64/libreoffice/program/soffice.bin", family="rpm",
                       fields={"Source": "libreoffice"})
        writer = app("libreoffice-writer", family="rpm", fields={"Source": "libreoffice"})
        result = run(dictionary, core, writer)
        self.assertEqual((result.kind, result.add_on_of), (c.APPLICATION, "libreoffice-core"))
        themes = package("smplayer-themes", "/usr/share/smplayer/themes/Gonzo/x.png", depends=("smplayer",))
        self.assertEqual(run(themes, app("smplayer")).add_on_of, "smplayer")

    def test_a_module_of_a_server_goes_with_the_server(self):
        module = package("libnginx-mod-http-upstream-fair", "/usr/lib/nginx/modules/ngx_http_upstream_fair_module.so",
                         "/usr/share/nginx/modules-available/mod-http-upstream-fair.conf", depends=("nginx-common",))
        common = package("nginx-common", "/usr/lib/systemd/system/nginx.service", "/etc/nginx/nginx.conf",
                         fields={"Source": "nginx"})
        self.assertEqual(run(module, common).kind, c.SYSTEM_MODULE)

    def test_a_package_with_a_window_is_never_silently_a_workspace_or_add_on(self):
        dict_plugin = PackageInfo("xfce4-dict", files=("/usr/bin/xfce4-dict", "/usr/share/applications/xfce4-dict.desktop",
                                                      "/usr/lib/x86_64-linux-gnu/xfce4/panel/plugins/libxfce4dict.so",
                                                      "/usr/share/xfce4/panel/plugins/xfce4-dict-plugin.desktop"),
                                  desktop=(launcher("xfce4-dict", "xfce4-dict"),))
        result = run(dict_plugin)
        self.assertIn(c.GUI_LAUNCHER, result.flags)
        self.assertIn(result.kind, (c.APPLICATION, c.CHOICE))
        self.assertIn(c.APPLICATION, result.choices or (result.kind,))

    def test_session_daemons_are_desktop_components(self):
        settings = PackageInfo("xfce4-settings", files=("/usr/bin/xfsettingsd", "/usr/bin/xfce4-settings-manager",
                                                       "/etc/xdg/autostart/xfsettingsd.desktop"),
                               desktop=(launcher("xfce-settings-manager", "xfce4-settings-manager"),),
                               autostart=(("/etc/xdg/autostart/xfsettingsd.desktop", "xfsettingsd"),))
        result = run(settings)
        self.assertEqual((result.kind, result.choices), (c.CHOICE, (c.SYSTEM_MODULE, c.APPLICATION)))
        prompter = PackageInfo("gcr", files=("/usr/libexec/gcr-prompter",
                                             "/usr/share/dbus-1/services/org.gnome.keyring.SystemPrompter.service"),
                               session_services=(("/usr/share/dbus-1/services/org.gnome.keyring.SystemPrompter.service",
                                                  "/usr/libexec/gcr-prompter"),))
        self.assertEqual(run(prompter).choices, (c.SYSTEM_MODULE, c.WORKSPACE))  # started on demand: a choice
        kded = package("bluedevil", "/usr/lib/x86_64-linux-gnu/qt5/plugins/kf5/kded/bluedevil.so")
        self.assertEqual(run(kded).add_on, "session")  # round 5: a module of the desktop's daemon is a session add-on
        tray = PackageInfo("solaar", files=("/usr/bin/solaar", "/usr/share/applications/solaar.desktop",
                                            "/etc/xdg/autostart/solaar.desktop"),
                           desktop=(launcher("solaar", "solaar"),),
                           autostart=(("/etc/xdg/autostart/solaar.desktop", "solaar --window=hide"),))
        self.assertEqual(run(tray).kind, c.APPLICATION)  # it starts its own window: an application

    def test_development_packages_are_workspace_packages(self):
        devel = package("gstreamer1-vaapi-devel", "/usr/include/gstreamer-1.0/gst/vaapi/x.h",
                        "/usr/lib64/libgstvaapi-1.0.so", "/usr/lib64/gstreamer-1.0/include/x.h", family="rpm")
        self.assertEqual(run(devel).kind, c.WORKSPACE)
        self.assertIn(c.DEVELOPMENT, run(devel).flags)

    def test_a_desktop_package_by_name_is_a_desktop(self):
        self.assertIn(c.DESKTOP_ENVIRONMENT, run(package("plasma-desktop", "/usr/bin/kaccess")).flags)

    def test_desktop_themes_and_plasma_widgets_are_device_add_ons(self):
        self.assertEqual(run(package("lxqt-themes", "/usr/share/lxqt/themes/dark/lxqt-panel.qss")).add_on, "data")
        self.assertEqual(run(package("plasma-pa", "/usr/share/plasma/plasmoids/org.kde.plasma.volume/metadata.json",
                                     "/usr/lib64/qt6/plugins/plasma/kcms/systemsettings/kcm_pulseaudio.so",
                                     family="rpm")).add_on, "session")

    def test_commands_linking_a_device_library_are_a_choice(self):
        lsusb = run(package("usbutils", "/usr/bin/lsusb", depends=("libusb-1.0-0",)))
        self.assertEqual(lsusb.choices, (c.SYSTEM_TOOL, c.WORKSPACE))
        aptitude = run(package("aptitude", "/usr/bin/aptitude", depends=("libapt-pkg6.0t64",)))
        self.assertIn(c.SYSTEM_TOOL, aptitude.choices)

    def test_names_compare_without_versions(self):
        crio = package("cri-o1.36", "/usr/bin/crio", "/usr/lib/systemd/system/crio.service", family="rpm")
        self.assertEqual(run(crio).kind, c.SYSTEM_MODULE)


class PackageFacts(unittest.TestCase):
    """Facts only the package file has (round 3: the harness reads every package)."""

    def test_a_launcher_through_gapplication_is_the_packages_window(self):
        maps = PackageInfo("gnome-maps", files=("/usr/bin/gnome-maps", "/usr/share/applications/org.gnome.Maps.desktop"),
                           desktop=(launcher("org.gnome.Maps", "gapplication launch org.gnome.Maps %U"),))
        self.assertEqual(run(maps).kind, c.APPLICATION)

    def test_a_launcher_naming_an_alternative_is_the_packages_window(self):
        emacs = PackageInfo("emacs-gtk", files=("/usr/bin/emacs-gtk", "/usr/share/applications/emacs.desktop"),
                            desktop=(launcher("emacs", "emacs %F"),))
        self.assertEqual(run(emacs).kind, c.APPLICATION)

    def test_a_window_hidden_from_the_menu_is_a_choice_never_silently_a_workspace(self):
        wizard = PackageInfo("kmail-account-wizard", files=("/usr/bin/accountwizard",),
                             desktop=(launcher("org.kde.accountwizard", "accountwizard", no_display=True),))
        result = run(wizard)
        self.assertEqual((result.kind, result.choices), (c.CHOICE, (c.APPLICATION, c.WORKSPACE)))
        self.assertIn(c.GUI_LAUNCHER, result.flags)

    def test_a_files_extension_stays_a_device_add_on_whatever_folder_it_uses(self):
        extension = package("papers-nautilus", "/usr/lib64/nautilus/extensions-4/libpapers-properties-page.so",
                            depends=("nautilus",), family="rpm")
        result = run(extension, app("nautilus", family="rpm"))
        self.assertEqual((result.kind, result.add_on), (c.DEVICE_ADD_ON, "session"))

    def test_plugins_with_libraries_are_not_data_of_a_desktop_component(self):
        module = package("ibus-gtk3", "/usr/lib64/gtk-3.0/3.0.0/immodules/im-ibus.so", family="rpm")
        ibus = PackageInfo("ibus", family="rpm", depends=("ibus-gtk3",), files=("/usr/bin/ibus-daemon",
                                                                                "/etc/xdg/autostart/ibus.desktop"),
                           autostart=(("/etc/xdg/autostart/ibus.desktop", "ibus-daemon --xim"),))
        result = c.classify(Request(module, dependents=(ibus,)))  # round 6: an input-method module (ADR rule 4)
        self.assertEqual((result.kind, result.add_on), (c.DEVICE_ADD_ON, "session"))

    def test_a_file_manager_plugin_with_a_privileged_helper_is_a_choice(self):
        sharing = package("kdenetwork-filesharing",
                          "/usr/lib/x86_64-linux-gnu/qt5/plugins/kf5/propertiesdialog/sambausershareplugin.so",
                          "/usr/share/dbus-1/system-services/org.kde.filesharing.samba.service")
        self.assertEqual(run(sharing).choices, (c.DEVICE_ADD_ON, c.SYSTEM_MODULE))
        helper = package("kdenetwork-filesharing",
                         "/usr/lib/x86_64-linux-gnu/qt5/plugins/kf5/propertiesdialog/sambausershareplugin.so",
                         "/usr/lib/x86_64-linux-gnu/libexec/kauth/authhelper", "/usr/share/polkit-1/actions/x.policy",
                         "/usr/share/dbus-1/system-services/org.kde.filesharing.samba.service",
                         "/usr/share/dbus-1/system.d/org.kde.filesharing.samba.conf")
        self.assertEqual(run(helper).choices, (c.DEVICE_ADD_ON, c.SYSTEM_MODULE))


class Round4(unittest.TestCase):
    """The udev-only rule, outcome fields (DEFAULT-RULE) and the curated list."""

    def test_udev_only_packages_are_device_requests_never_system_modules(self):
        tpm = package("tpm-udev", "/usr/lib/udev/rules.d/60-tpm-udev.rules", "/usr/lib/systemd/system/tpm-udev.service",
                      "/usr/lib/sysusers.d/tpm-udev.conf")
        self.assertEqual(run(tpm).kind, c.DEVICE_REQUEST)
        names = package("net-naming-sysattrs", "/usr/lib/udev/hwdb.d/50-net-naming-sysattr-allowlist.hwdb",
                        "/usr/lib/dracut/modules.d/70net-naming-sysattrs/module-setup.sh", family="rpm")
        result = run(names)
        self.assertEqual(result.kind, c.DEVICE_REQUEST)
        self.assertTrue(result.device_rules)
        daemon = package("udev-daemon", "/usr/lib/udev/rules.d/90-x.rules", "/usr/sbin/xd",
                         "/usr/lib/systemd/system/xd.service")
        self.assertNotEqual(run(daemon).kind, c.DEVICE_REQUEST)

    def test_default_and_ask_follow_the_default_rule(self):
        tools = run(package("e2fsprogs", "/usr/sbin/mke2fs", "/usr/bin/chattr", "/usr/share/man/man8/mke2fs.8.gz"))
        self.assertEqual((tools.kind, tools.default, tools.ask), (c.CHOICE, c.WORKSPACE, False))
        self.assertIn("system tool", tools.notice)
        self.assertIn("undo", tools.notice)
        plain = run(package("ripgrep", "/usr/bin/rg"))
        self.assertEqual((plain.default, plain.ask, plain.notice), (c.WORKSPACE, False, ""))
        server = run(package("tailscale", "/usr/sbin/tailscaled", "/lib/systemd/system/tailscaled.service"))
        self.assertEqual((server.default, server.ask), (c.SYSTEM_MODULE, False))
        only_system = c._with_defaults(c.Classification(c.CHOICE, ("x",), choices=(c.SYSTEM_TOOL, c.SYSTEM_MODULE)))
        self.assertEqual((only_system.default, only_system.ask), (c.SYSTEM_TOOL, True))

    def test_an_optional_service_installed_to_the_workspace_has_a_notice(self):
        svn = run(package("subversion", "/usr/bin/svn", "/usr/bin/svnserve", "/usr/lib/systemd/system/svnserve.service",
                          family="rpm"))
        self.assertEqual(svn.default, c.WORKSPACE)
        self.assertIn("a system module", svn.notice)

    # The curated list's use (signed, by name, release, origin) is tested in test_classify_signature.


class KernelModulePaths(unittest.TestCase):
    def test_only_modules_under_the_modules_tree_with_a_module_ending_count(self):
        vim = package("vim-common", "/usr/share/vim/vim91/tutor/tutor1.ko", "/usr/bin/xxd")
        self.assertNotIn(c.KERNEL_MODULE, run(vim).flags)
        cockpit = package("cockpit-ws", "/usr/share/cockpit/base1/po.ko.js.gz", "/usr/libexec/cockpit-ws")
        self.assertNotIn(c.KERNEL_MODULE, run(cockpit).flags)
        for path in ("/usr/lib/modules/6.12.0/extra/v4l2loopback.ko.xz", "/lib/modules/6.8.0-45-generic/updates/x.ko",
                     "/usr/lib/modules/6.12.0/extra/y.ko.zst", "/lib/modules/6.8.0/z.ko.gz"):
            self.assertIn(c.KERNEL_MODULE, run(package("some-kmod", path)).flags, path)
        self.assertNotIn(c.KERNEL_MODULE, run(package("odd", "/usr/lib/modules/6.12.0/foo.ko.js")).flags)


class AdjudicatedReview(unittest.TestCase):
    """Categories from the adjudicated review of the curated lists (round 5)."""

    def test_application_add_ons_by_name_and_folder(self):
        plugins = package("hexchat-plugins", "/usr/lib/x86_64-linux-gnu/hexchat/plugins/checksum.so")
        self.assertEqual((run(plugins).kind, run(plugins).add_on_of), (c.APPLICATION, "hexchat"))
        l10n = package("featherpad-l10n", "/usr/share/featherpad/translations/featherpad_de.qm")
        self.assertEqual(run(l10n).add_on_of, "featherpad")
        locale_only = package("lxqt-about-l10n", "/usr/share/locale/de/LC_MESSAGES/lxqt-about.mo")
        self.assertEqual(run(locale_only).add_on_of, "lxqt-about")
        ews = package("evolution-ews", "/usr/lib/evolution-data-server/camel-providers/libcamelews.so",
                      "/usr/lib/evolution/modules/module-ews-configuration.so", depends=("evolution",))
        self.assertEqual(run(ews, app("evolution")).add_on_of, "evolution")

    def test_a_desktops_activities_are_applications(self):
        activity = package("sugar-maze", "/usr/share/sugar/activities/Maze.activity/activity.py", depends=("sugar",),
                           family="rpm")
        sugar = package("sugar", "/usr/bin/sugar", "/usr/share/xsessions/sugar.desktop", family="rpm")
        self.assertEqual((run(activity, sugar).kind, run(activity, sugar).add_on_of), (c.APPLICATION, "sugar"))

    def test_one_desktop_dependency_does_not_make_a_desktop(self):
        gui = package("blivet-gui", depends=("blivet-gui-runtime", "gnome-shell"), family="rpm")
        runtime = app("blivet-gui-runtime", family="rpm")
        self.assertNotIn(c.DESKTOP_ENVIRONMENT, run(gui, runtime).flags)

    def test_a_command_line_tools_service_named_like_it_is_inert_with_a_notice(self):
        fio = package("fio", "/usr/bin/fio", "/usr/share/man/man1/fio.1.gz", "/usr/lib/systemd/system/fio.service")
        result = run(fio)
        self.assertEqual(result.default, c.WORKSPACE)
        self.assertIn(c.OPTIONAL_SERVICE, result.flags)
        self.assertIn("system module", result.notice)

    def test_a_daemons_own_service_decides_beside_client_tools(self):
        named = package("bind9", "/usr/sbin/named", "/usr/bin/named-checkconf", "/usr/lib/systemd/system/named.service",
                        depends=("bind9-libs",))
        libs = package("bind9-libs", "/usr/lib/x86_64-linux-gnu/libdns.so.9", fields={"Source": "bind9"})
        self.assertEqual(run(named, libs).kind, c.SYSTEM_MODULE)

    def test_bindings_follow_their_library(self):
        firewall = package("python3-firewall", "/usr/lib/python3/dist-packages/firewall/client.py",
                           "/usr/share/polkit-1/rules.d/firewalld.rules")
        result = run(firewall)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertIn("system module", result.notice)

    def test_the_x_server_and_its_drivers_are_system_modules(self):
        for name, path in (("xserver-xorg-core", "/usr/lib/xorg/Xorg"),
                           ("xserver-xorg-input-evdev", "/usr/lib/xorg/modules/input/evdev_drv.so")):
            self.assertEqual(run(package(name, path)).kind, c.SYSTEM_MODULE, name)

    def test_artwork_with_boot_themes_is_a_data_add_on(self):
        base = package("desktop-base", "/usr/share/desktop-base/active-theme/wallpaper/contents/images/1920x1080.svg",
                       "/usr/share/plymouth/themes/emerald/emerald.plymouth", "/usr/share/backgrounds/x.png")
        self.assertEqual((run(base).kind, run(base).add_on), (c.DEVICE_ADD_ON, "data"))

    def test_locales_and_video_decode_drivers_are_device_add_ons(self):
        self.assertEqual(run(package("locales-all", "/usr/lib/locale/locale-archive")).kind, c.DEVICE_ADD_ON)
        vaapi = package("mesa-va-drivers", "/usr/lib/x86_64-linux-gnu/dri/radeonsi_drv_video.so")
        self.assertEqual(run(vaapi).add_on, "codecs")

    def test_a_hidden_window_manager_is_a_desktop_component(self):
        wm = PackageInfo("icewm", files=("/usr/bin/icewm",), desktop=(launcher("icewm", "icewm", no_display=True),))
        result = run(wm)
        self.assertEqual(result.kind, c.SYSTEM_MODULE)
        self.assertIn(c.DESKTOP_COMPONENT, result.flags)


class HardCases(unittest.TestCase):
    """Every row of the amendment's hard-case table."""

    def test_window_and_commands_in_one_package(self):
        for name in ("code", "gimp", "vlc"):
            result = run(app(name, f"/usr/bin/{name}-extra"))
            self.assertEqual(result.kind, c.APPLICATION, name)
            self.assertTrue(any("start in its sandbox" in reason for reason in result.reasons), result.reasons)

    def test_electron_usr_bin_link_is_the_applications_command(self):
        code = package("code", "/usr/bin/code", "/usr/share/code/code", "/usr/share/code/resources/app/package.json",
                       "/usr/share/code/chrome-sandbox", "/usr/share/code/v8_context_snapshot.bin",
                       "/usr/share/applications/code.desktop",
                       desktop=(launcher("code", "/usr/share/code/code %F", categories=("Development", "IDE")),),
                       setuid=("/usr/share/code/chrome-sandbox",))
        result = run(code)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.ELECTRON_CLI, result.flags)
        self.assertIn(c.HELPER_DROPPED, result.flags)

    def test_ide_via_the_signed_list_or_the_sheet_is_a_workspace(self):
        code = app("code", categories=("Development", "IDE"))
        for arrival in (c.SIGNED_LIST, c.SHEET_FULL_ACCESS):
            result = run(code, arrival=arrival)
            self.assertEqual(result.kind, c.WORKSPACE, arrival)
            self.assertIn(c.IDE, result.flags)
            self.assertEqual(result.fallback, c.APPLICATION)

    def test_application_with_a_root_service_is_split(self):
        mullvad = app("mullvad-vpn", "/usr/bin/mullvad-daemon", "/usr/lib/systemd/system/mullvad-daemon.service",
                      desktop=(launcher("mullvad-vpn", "/opt/Mullvad VPN/mullvad-gui"),),
                      )
        mullvad = PackageInfo(mullvad.name, files=mullvad.files + ("/opt/Mullvad VPN/mullvad-gui",),
                              desktop=(launcher("mullvad-vpn", '"/opt/Mullvad VPN/mullvad-gui" %U'),))
        result = run(mullvad)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.APP_SERVICE_SPLIT, result.flags)
        self.assertEqual([kind for kind, _ in result.parts], [c.APPLICATION, c.SYSTEM_MODULE])

    def test_tailscale_without_a_window_is_a_system_module(self):
        tailscale = package("tailscale", "/usr/bin/tailscale", "/usr/sbin/tailscaled",
                            "/lib/systemd/system/tailscaled.service")
        self.assertEqual(run(tailscale).kind, c.SYSTEM_MODULE)

    def test_servers_are_system_modules_whatever_user_or_preset(self):
        self.assertEqual(run(package("redis-server", "/usr/bin/redis-server",
                                     "/lib/systemd/system/redis-server.service")).kind, c.SYSTEM_MODULE)
        self.assertEqual(run(package("mariadb-server", "/usr/sbin/mariadbd", "/etc/init.d/mariadb")).kind,
                         c.SYSTEM_MODULE)
        self.assertEqual(run(package("docker-ce", "/usr/bin/dockerd", "/lib/systemd/system/docker.socket")).kind,
                         c.SYSTEM_MODULE)
        # nginx: the binary package; the unit is in nginx-common, a dependency only nginx needs.
        nginx = package("nginx", "/usr/sbin/nginx", depends=("nginx-common",))
        common = package("nginx-common", "/lib/systemd/system/nginx.service", "/etc/nginx/nginx.conf",
                         fields={"Source": "nginx"})
        result = run(nginx, common)
        self.assertEqual(result.kind, c.SYSTEM_MODULE)
        self.assertIn("system service nginx.service (nginx-common)", result.reasons)
        # postgresql: meta -> postgresql-16 -> postgresql-common (the units)
        meta = package("postgresql", depends=("postgresql-16",), fields={"Source": "postgresql-common"})
        server = package("postgresql-16", "/usr/lib/postgresql/16/bin/postgres", depends=("postgresql-common",))
        common = package("postgresql-common", "/lib/systemd/system/postgresql@.service")
        self.assertEqual(run(meta, server, common).kind, c.SYSTEM_MODULE)

    def test_applications_dependency_daemons_stay_inert(self):
        boxes = app("gnome-boxes", categories=("System", "Emulator"))
        libvirt = package("libvirt-daemon", "/usr/sbin/virtqemud", "/usr/lib/systemd/system/virtqemud.service")
        result = run(boxes, libvirt)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.DEPENDENCY_DAEMON_INERT, result.flags)
        office = package("libreoffice", depends=("libreoffice-writer", "libreoffice-calc"))
        writer = app("libreoffice-writer", desktop=(launcher("libreoffice-writer", "libreoffice --writer %U"),))
        writer = PackageInfo(writer.name, files=writer.files + ("/usr/bin/libreoffice",), desktop=writer.desktop)
        calc = package("libreoffice-calc", "/usr/lib/libreoffice/program/libsclo.so")
        result = run(office, writer, calc)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.META_PACKAGE, result.flags)

    def test_gvfs_backends_and_host_daemons_are_never_own_dependencies(self):
        graph = {"gimp": ["gvfs-backends", "dbus", "libgimp"], "gvfs-backends": ["gvfs"], "libgimp": []}
        self.assertEqual(c.own_dependencies("gimp", graph, set(), "deb"), ["libgimp"])

    def test_user_services_stay_with_the_application(self):
        syncthing = app("syncthing", "/usr/lib/systemd/user/syncthing.service",
                        "/lib/systemd/system/syncthing@.service",
                        desktop=(launcher("syncthing-ui", "syncthing --browser-only"),))
        result = run(syncthing)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.USER_SERVICE, result.flags)
        self.assertNotIn(c.APP_SERVICE_SPLIT, result.flags)
        mpd = package("mpd", "/usr/bin/mpd", "/usr/lib/systemd/user/mpd.service", "/usr/lib/systemd/system/mpd.service")
        self.assertEqual(run(mpd).kind, c.WORKSPACE)

    def test_kernel_modules_dkms_akmod_and_cuda_map_to_Suno_build(self):
        cases = {
            ("v4l2loopback-dkms", "/usr/src/v4l2loopback-0.13/dkms.conf"): "image:v4l2loopback",
            ("akmod-nvidia", "/usr/src/akmods/nvidia-kmod.latest"): "module:nvidia",
            ("nvidia-dkms-550", "/usr/src/nvidia-550.120/dkms.conf"): "module:nvidia",
            ("cuda-drivers-560", "/usr/share/doc/cuda-drivers-560/README"): "module:nvidia",
            ("virtualbox-dkms", "/usr/src/virtualbox-7.0/dkms.conf"): "module:virtualbox",
        }
        for (name, path), target in cases.items():
            result = run(package(name, path))
            self.assertEqual((result.kind, result.module), (c.SYSTEM_MODULE, target), name)
            self.assertIn(c.KERNEL_MODULE, result.flags)
            self.assertFalse(result.refused)
        driver = package("nvidia-driver-550", depends=("nvidia-dkms-550", "nvidia-utils-550"))
        self.assertEqual(run(driver, package("nvidia-dkms-550", "/usr/src/nvidia-550/dkms.conf")).module, "module:nvidia")

    def test_virtualbox_is_one_version_locked_module_with_its_application(self):
        ui = app("virtualbox-qt", desktop=(launcher("virtualbox", "VirtualBox %U"),))
        ui = PackageInfo(ui.name, files=ui.files + ("/usr/bin/VirtualBox",), desktop=ui.desktop)
        dkms = package("virtualbox-dkms", "/usr/src/virtualbox-7.0.16/dkms.conf")
        result = run(ui, dkms)
        self.assertEqual((result.kind, result.module), (c.SYSTEM_MODULE, "module:virtualbox"))

    def test_a_module_not_on_the_list_is_refused(self):
        zfs = package("zfs-dkms", "/usr/src/zfs-2.2.2/dkms.conf")
        result = run(zfs)
        self.assertEqual(result.kind, c.SYSTEM_MODULE)
        self.assertIn("not on Suno's list", result.refused)

    def test_packages_that_only_add_a_repository_are_a_source(self):
        epel = package("epel-release", "/etc/yum.repos.d/epel.repo", "/etc/pki/rpm-gpg/RPM-GPG-KEY-EPEL-10",
                       "/usr/share/doc/epel-release/README", family="rpm")
        result = run(epel)
        self.assertEqual(result.kind, c.SOURCE)
        self.assertIn(c.REPOSITORY_PACKAGE, result.flags)
        microsoft = package("packages-microsoft-prod", "/etc/apt/sources.list.d/microsoft-prod.list",
                            "/usr/share/keyrings/microsoft-prod.gpg")
        self.assertEqual(run(microsoft).kind, c.SOURCE)

    def test_meta_packages_are_classified_by_their_members(self):
        essential = package("build-essential", "/usr/share/doc/build-essential/copyright",
                            depends=("gcc", "g++", "make", "dpkg-dev"))
        members = [package("gcc", "/usr/bin/gcc"), package("make", "/usr/bin/make")]
        result = run(essential, *members)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertIn(c.META_PACKAGE, result.flags)
        group = package("@development-tools", family="rpm", depends=("git", "patch", "diffutils"))
        result = run(group, package("git", "/usr/bin/git", family="rpm"), package("patch", "/usr/bin/patch", family="rpm"))
        self.assertIn(c.META_PACKAGE, result.flags)
        extras = package("ubuntu-restricted-extras", depends=("ubuntu-restricted-addons", "ttf-mscorefonts-installer"))
        codecs = package("ubuntu-restricted-addons", depends=("gstreamer1.0-plugins-ugly",))
        ugly = package("gstreamer1.0-plugins-ugly", "/usr/lib/x86_64-linux-gnu/gstreamer-1.0/libgstx264.so")
        self.assertIn(c.META_PACKAGE, run(extras, codecs, ugly).flags)

    def test_transitional_packages_name_what_they_bring(self):
        result = run(package("old-name", depends=("new-name",)), package("new-name", "/usr/bin/new-name"))
        self.assertIn(c.TRANSITIONAL, result.flags)
        self.assertEqual(result.kind, c.WORKSPACE)

    def test_snap_transitional_packages_are_never_built(self):
        by_name = package("firefox", "/usr/bin/firefox", version="1:1snap1-0ubuntu5", depends=("snapd",))
        for top in (by_name,
                    package("chromium-browser", "/usr/bin/chromium-browser", version="2:1snap1-0ubuntu2"),
                    package("thunderbird", "/usr/bin/thunderbird", depends=("snapd",))):
            result = run(top, release="ubuntu-24.04")
            self.assertIn(c.SNAP_TRANSITIONAL, result.flags, top.name)
            self.assertTrue(result.refused)
        named_only = run(package("firefox", "/usr/bin/firefox", version="1:1"), release="ubuntu-24.04")
        self.assertIn(c.SNAP_TRANSITIONAL, named_only.flags)
        # Debian's firefox-esr and Fedora's firefox are real packages.
        self.assertNotIn(c.SNAP_TRANSITIONAL, run(app("firefox", family="rpm"), release="fedora-45").flags)
        self.assertNotIn(c.SNAP_TRANSITIONAL, run(app("firefox"), release="debian-13").flags)

    def test_a_typed_package_file_is_classified_from_the_file(self):
        console = package("tool", "/usr/bin/tool")
        result = run(console, arrival=c.COMMAND_FILE, origin="file")
        self.assertEqual((result.kind, result.fallback), (c.WORKSPACE, c.CONSOLE_APPLICATION))
        self.assertIn(c.WORKSPACE_IF_RESOLVES, result.flags)
        self.assertEqual(run(app("viewer"), arrival=c.COMMAND_FILE, origin="file").kind, c.APPLICATION)
        self.assertEqual(run(console, arrival=c.FILE, origin="file").kind, c.CONSOLE_APPLICATION)

    def test_modules_for_an_interpreter_the_image_carries(self):
        numpy = package("python3-numpy", "/usr/lib/python3/dist-packages/numpy/__init__.py")
        result = run(numpy)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertIn(c.INTERPRETER_MODULE, result.flags)

    def test_a_name_the_image_already_has(self):
        result = run(package("git", "/usr/bin/git"), image_has_name=True)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertIn(c.IMAGE_HAS_NAME, result.flags)

    def test_login_shells_are_workspace_commands_with_a_notice(self):
        for name, path in (("zsh", "/usr/bin/zsh"), ("fish", "/usr/bin/fish")):
            result = run(package(name, path))
            self.assertEqual((result.kind, result.default), (c.WORKSPACE, c.WORKSPACE), name)
            self.assertIn(c.LOGIN_SHELL, result.flags)
            self.assertIn("login shell", result.notice)

    def test_wine_from_the_distribution_is_Suno_windows_runtime(self):
        wine = package("wine", "/usr/bin/wine", depends=("wine64",))
        self.assertIn(c.WINDOWS_RUNTIME, run(wine).flags)
        winehq = package("winehq-stable", depends=("wine-stable",))
        result = run(winehq, package("wine-stable", "/opt/wine-stable/bin/wine"), origin="vendor")
        self.assertNotIn(c.WINDOWS_RUNTIME, result.flags)
        self.assertEqual(result.kind, c.WORKSPACE)

    def test_steam_deb_is_an_application_with_its_i386_layers(self):
        steam = app("steam", "/usr/lib/steam/bin_steam.sh", desktop=(launcher("steam", "/usr/bin/steam %U"),),
                    categories=("Game",))
        result = run(steam, origin="file", arrival=c.FILE)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.STEAM, result.flags)

    def test_vendor_name_not_in_the_release(self):
        result = run(app("code"), origin="vendor")
        self.assertIn(c.VENDOR_REPO_ONLY, result.flags)
        self.assertTrue(any("-y never adds" in reason for reason in result.reasons))

    def test_same_application_in_depot(self):
        result = run(app("gimp"), in_depot=True)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertIn(c.IN_DEPOT, result.flags)

    def test_architecture_is_not_the_classifiers_business(self):
        # An x86_64-only package on aarch64 never reaches the classifier: the real
        # tool reports "Unable to locate package" (exit 100). Same class on any CPU.
        spotify = app("spotify-client", architecture="amd64")
        self.assertEqual(run(spotify).kind, run(app("spotify-client", architecture="arm64")).kind)

    def test_results_serialise(self):
        result = run(app("mullvad-vpn", "/usr/lib/systemd/system/mullvad-daemon.service"))
        data = result.to_json()
        self.assertEqual(data["kind"], c.APPLICATION)
        self.assertEqual(data["parts"][1]["kind"], c.SYSTEM_MODULE)


class BlindAuditRules(unittest.TestCase):
    """Round 6: the blind audit's recurring faults and ADR gaps, as general rules."""

    def test_a_module_of_a_system_module_follows_its_server(self):
        for top in (package("libnginx-mod-mail", "/usr/lib/nginx/modules/ngx_mail_module.so",
                            "/usr/share/nginx/modules-available/mod-mail.conf"),
                    package("libapache2-mod-fcgid", "/usr/lib/apache2/modules/mod_fcgid.so",
                            "/etc/apache2/mods-available/fcgid.load"),
                    package("samba-vfs-modules", "/usr/lib/x86_64-linux-gnu/samba/vfs/acl_xattr.so"),
                    package("libvirt-daemon-driver-vbox",
                            "/usr/lib/x86_64-linux-gnu/libvirt/connection-driver/libvirt_driver_vbox.so"),
                    package("libvirt-daemon-config-network", "/usr/share/libvirt/networks/default.xml"),
                    package("vdr-femon", "/usr/lib64/vdr/libvdr-femon.so.13", family="rpm"),
                    package("munin-plugins-extra", "/usr/share/munin/plugins/apc_nis"),
                    package("sssd-nfs-idmap", "/usr/lib64/libnfsidmap/sss.so", family="rpm")):
            self.assertEqual(run(top).kind, c.SYSTEM_MODULE, top.name)
        # beside client commands: a choice; a file deeper than the module folder is not a module
        contrib = package("postgresql-contrib", "/usr/bin/oid2name", "/usr/lib64/pgsql/hstore.so", family="rpm")
        self.assertEqual(run(contrib).choices, (c.WORKSPACE, c.SYSTEM_MODULE))
        docs = package("postgresql-docs", "/usr/lib64/pgsql/tutorial/complex.so", family="rpm")
        self.assertNotIn(c.SYSTEM_MODULE, (run(docs).kind,) + run(docs).choices)

    def test_a_fedora_daemon_in_usr_bin_is_decided_by_its_unit(self):
        haproxy = package("haproxy", "/usr/bin/haproxy", "/usr/bin/halog", "/usr/share/man/man1/haproxy.1.gz",
                          "/usr/lib/systemd/system/haproxy.service", "/usr/lib/sysusers.d/haproxy.conf", family="rpm")
        self.assertEqual(run(haproxy).kind, c.SYSTEM_MODULE)
        irqbalance = package("irqbalance", "/usr/bin/irqbalance", "/usr/share/man/man1/irqbalance.1.gz",
                             "/etc/sysconfig/irqbalance", "/usr/lib/systemd/system/irqbalance.service", family="rpm")
        self.assertEqual(run(irqbalance).kind, c.SYSTEM_MODULE)
        # a command-line tool with a service named like it and no daemon state stays a workspace command
        fio = package("fio", "/usr/bin/fio", "/usr/share/man/man1/fio.1.gz", "/usr/lib/systemd/system/fio.service")
        self.assertEqual(run(fio).default, c.WORKSPACE)

    def test_markers_of_a_sibling_package_never_decide(self):
        base = package("erlang-base", "/usr/bin/epmd", "/usr/lib/systemd/system/epmd.service",
                       fields={"Source": "erlang"})
        tools = package("nslcd-utils", "/usr/bin/getent.ldap", "/usr/share/nslcd-utils/getent.py", depends=("nslcd",),
                        fields={"Source": "nss-pam-ldapd"})
        nslcd = package("nslcd", "/usr/sbin/nslcd", "/usr/lib/systemd/system/nslcd.service",
                        fields={"Source": "nss-pam-ldapd"})
        result = run(tools, nslcd)
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertTrue(any("another package of its source" in reason for reason in result.reasons))
        self.assertEqual(run(base).kind, c.SYSTEM_MODULE)  # its own unit still decides

    def test_add_on_of_names_an_application_with_a_window(self):
        readline = package("readline-common", "/usr/share/readline/inputrc", fields={"Source": "readline"})
        library = package("libreadline8t64", "/usr/lib/x86_64-linux-gnu/libreadline.so.8", depends=("readline-common",),
                          fields={"Source": "readline"})
        result = c.classify(Request(readline, (), dependents=(library,), curated=False))
        self.assertEqual(result.kind, c.WORKSPACE)
        self.assertFalse(result.add_on_of)
        plugin = package("remmina-plugin-rdp", "/usr/lib/x86_64-linux-gnu/remmina/plugins/remmina-plugin-rdp.so",
                         depends=("remmina",), fields={"Source": "remmina"})
        remmina = app("remmina", fields={"Source": "remmina"})
        result = run(plugin, remmina)
        self.assertEqual((result.kind, result.add_on_of), (c.APPLICATION, "remmina"))

    def test_a_program_whose_launcher_is_in_the_package_named_after_its_source(self):
        bin_ = package("vlc-bin", "/usr/bin/vlc", "/usr/bin/cvlc", fields={"Source": "vlc"})
        vlc = package("vlc", "/usr/share/applications/vlc.desktop", depends=("vlc-bin",), fields={"Source": "vlc"},
                      desktop=(launcher("vlc", "/usr/bin/vlc --started-from-file %U", no_display=False),))
        result = c.classify(Request(bin_, (), dependents=(vlc,), curated=False))
        self.assertEqual(result.kind, c.APPLICATION)

    def test_fonts_and_input_methods_outside_the_usual_paths(self):
        fonts = package("liberation-narrow-fonts", "/etc/X11/fontpath.d/liberation-narrow-fonts",
                        "/usr/share/fonts/liberation-narrow/LiberationSansNarrow-Bold.ttf", family="rpm")
        self.assertEqual(run(fonts).add_on, "fonts")
        scim = package("scim-gtk", "/usr/lib64/gtk-3.0/3.0.0/immodules/im-scim.so", family="rpm")
        self.assertEqual((run(scim).kind, run(scim).add_on), (c.DEVICE_ADD_ON, "session"))

    def test_boot_chain_greeters_and_printer_drivers_are_system_modules(self):
        for top in (package("grub2-pc", "/boot/grub2/grub.cfg", "/etc/grub2.cfg", family="rpm"),
                    package("shim-x64", "/boot/efi/EFI/fedora/shimx64.efi", family="rpm"),
                    package("initramfs-tools-bin", "/usr/lib/initramfs-tools/bin/wait-for-root"),
                    package("terminus-fonts-grub2", "/usr/share/grub/ter-x16n.pf2", family="rpm"),
                    package("lightdm-gtk", "/usr/bin/lightdm-gtk-greeter", "/usr/share/xgreeters/lightdm-gtk-greeter.desktop",
                            family="rpm"),
                    package("sddm-theme-debian-maui", "/usr/share/sddm/themes/debian-maui/Main.qml",
                            "/usr/share/sddm/themes/debian-maui/background.png"),
                    package("printer-driver-cjet", "/usr/bin/cjet"),
                    package("printer-driver-all", depends=("printer-driver-cjet", "printer-driver-hpcups"))):
            self.assertEqual(run(top).kind, c.SYSTEM_MODULE, top.name)

    def test_plugin_packs_for_open_standards_are_device_add_ons(self):
        for top in (package("swh-plugins", "/usr/lib/ladspa/amp_1181.so"),
                    package("lv2-fabla", "/usr/lib64/lv2/fabla.lv2/fabla.so", family="rpm"),
                    package("alsa-plugins-usbstream", "/usr/lib64/alsa-lib/libasound_module_pcm_usb_stream.so",
                            family="rpm")):
            self.assertEqual(run(top).kind, c.DEVICE_ADD_ON, top.name)

    def test_window_managers_and_their_decorators_are_desktop_components(self):
        plugins = package("compiz-plugins-experimental", "/usr/lib64/compiz/libfireflies.so", family="rpm")
        self.assertEqual(run(plugins).kind, c.SYSTEM_MODULE)
        emerald = app("emerald-theme-manager", "/usr/bin/emerald", "/usr/lib64/emerald/engines/libtruglass.so",
                      family="rpm")
        self.assertEqual(run(emerald).choices, (c.SYSTEM_MODULE, c.APPLICATION))

    def test_distribution_identity_is_image_has_name(self):
        for top in (package("fedora-release-server", depends=("fedora-release-common",), family="rpm"),
                    package("base-files", "/usr/lib/os-release", "/etc/issue")):
            result = run(top)
            self.assertEqual(result.kind, c.WORKSPACE, top.name)
            self.assertIn(c.IMAGE_HAS_NAME, result.flags)

    def test_parts_of_a_package_manager_front_end_take_its_choice(self):
        common = package("aptitude-common", "/usr/share/aptitude/aptitude-defaults", fields={"Source": "aptitude"})
        aptitude = package("aptitude", "/usr/bin/aptitude", depends=("libapt-pkg6.0t64", "aptitude-common"),
                           fields={"Source": "aptitude"})
        result = c.classify(Request(common, (), dependents=(aptitude,), curated=False))
        self.assertEqual(result.choices, (c.WORKSPACE, c.SYSTEM_TOOL))
        software = package("gnome-software", "/usr/bin/gnome-software", depends=("packagekit", "gnome-software-common"),
                           fields={"Source": "gnome-software"},
                           desktop=(launcher("org.gnome.Software", "gnome-software", no_display=False,
                                             categories=("System",)),))
        data = package("gnome-software-common", "/usr/share/swcatalog/xml/org.gnome.Software.Featured.xml",
                       fields={"Source": "gnome-software"})
        result = c.classify(Request(data, (), dependents=(software,), curated=False))
        self.assertEqual(result.choices, (c.APPLICATION, c.SYSTEM_TOOL))
        hook = package("PackageKit-command-not-found", "/usr/libexec/pk-command-not-found", "/etc/profile.d/PackageKit.sh",
                       depends=("PackageKit",), family="rpm")
        self.assertEqual(run(hook).choices, (c.WORKSPACE, c.SYSTEM_TOOL))
        gdebi = package("gdebi-core", "/usr/bin/gdebi", depends=("python3-apt",))
        self.assertEqual(run(gdebi).kind, c.CHOICE)

    def test_session_roles_make_a_desktop_component(self):
        dunst = package("dunst", "/usr/bin/dunst", "/usr/lib/systemd/user/dunst.service",
                        "/usr/share/dbus-1/services/org.knopwob.dunst.service",
                        fields={"Description": "dmenu-ish notification-daemon"},
                        session_services=(("/usr/share/dbus-1/services/org.knopwob.dunst.service", "/usr/bin/dunst"),))
        self.assertIn(c.SYSTEM_MODULE, run(dunst).choices)
        agent = package("gcr4", "/usr/bin/gcr-viewer-gtk4", "/usr/lib/systemd/user/gcr-ssh-agent.service",
                        "/usr/libexec/gcr-ssh-agent")
        self.assertIn(c.SYSTEM_MODULE, run(agent).choices)
        migration = package("user-session-migration", "/usr/bin/session-migration",
                            "/usr/lib/systemd/user/session-migration.service")
        self.assertEqual(run(migration).kind, c.WORKSPACE)

    def test_desktop_component_data_is_inert(self):
        data = package("mate-panel-common", "/usr/share/mate-panel/layouts/default.layout", fields={"Source": "mate-panel"})
        panel = package("mate-panel", "/usr/bin/mate-panel", "/etc/xdg/autostart/mate-panel.desktop",
                        depends=("mate-panel-common",), fields={"Source": "mate-panel"},
                        autostart=(("/etc/xdg/autostart/mate-panel.desktop", "mate-panel"),))
        self.assertEqual(c.classify(Request(data, (), dependents=(panel,), curated=False)).kind, c.WORKSPACE)

    def test_etc_only_configuration_and_web_applications(self):
        profile = package("console-login-helper-messages-profile", "/etc/profile.d/clhm.sh",
                          "/usr/share/console-login-helper-messages/profile.sh", family="rpm")
        self.assertEqual(run(profile).kind, c.SYSTEM_MODULE)
        web = package("phpmyadmin", "/etc/phpmyadmin/apache.conf", "/usr/share/phpmyadmin/index.php")
        self.assertEqual(run(web).kind, c.SYSTEM_MODULE)

    def test_sudo_front_ends_and_score_file_games(self):
        self.assertEqual(run(package("lxqt-sudo", "/usr/bin/lxsudo", "/usr/bin/lxsu")).kind, c.SYSTEM_TOOL)
        game = app("qascade", "/var/lib/games/qascade.hscr", setuid=("/usr/bin/qascade",), family="rpm")
        result = run(game)
        self.assertEqual(result.kind, c.APPLICATION)
        self.assertFalse(result.ask)

    def test_a_capture_application_is_a_choice(self):
        etherape = app("etherape", depends=("libpcap",), family="rpm")
        self.assertEqual(run(etherape).choices, (c.APPLICATION, c.SYSTEM_TOOL))

    def test_a_system_marker_without_a_curated_decision_is_asked(self):
        # an sbin program left in the workspace by another rule (a language binding here)
        development = package("libfoo-dev", "/usr/include/foo.h", "/usr/sbin/foo-admin")
        result = run(development)
        self.assertEqual((result.kind, result.default, result.ask), (c.CHOICE, c.WORKSPACE, True))
        self.assertEqual(result.choices, (c.WORKSPACE, c.SYSTEM_TOOL))
        # udev rules a result does not carry as a device request
        rules = package("python3-bar", "/usr/lib/python3/dist-packages/bar.py", "/usr/lib/udev/rules.d/60-bar.rules")
        self.assertTrue(run(rules).ask)
        # nothing to ask: a plain command-line tool, and packages the image provides
        self.assertFalse(run(package("jq", "/usr/bin/jq")).ask)
        self.assertFalse(run(package("python3-plain", "/usr/lib/python3/dist-packages/plain.py")).ask)


if __name__ == "__main__":
    unittest.main()
