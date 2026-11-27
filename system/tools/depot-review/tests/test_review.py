# SPDX-License-Identifier: Apache-2.0
import struct
import sys
import unittest
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from depot_review import checks, images, words  # noqa: E402

METADATA = """[Application]
name=com.example.Hello
runtime=org.gnome.Platform/x86_64/49
sdk=org.gnome.Sdk/x86_64/49
command=hello

[Context]
shared=network;ipc;
sockets=wayland;fallback-x11;pulseaudio;
devices=dri;
filesystems=xdg-music:ro;

[Session Bus Policy]
org.freedesktop.Notifications=talk
org.freedesktop.secrets=talk
org.kde.StatusNotifierWatcher=talk
"""


def png(width, height):
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
    raw = b"".join(b"\0" + b"\0" * width * 3 for _ in range(height))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


class Words(unittest.TestCase):
    def test_flatpak_reach(self):
        reach = words.flatpak_reach(METADATA)
        self.assertEqual(list(reach["words"]), ["Files", "Internet", "Notifications", "Other apps", "Passwords"])
        self.assertTrue(any("PulseAudio" in n for n in reach["notes"]))

    def test_sandboxed_app_reaches_nothing(self):
        reach = words.flatpak_reach("[Application]\nname=com.example.Calm\nruntime=org.gnome.Platform/x86_64/49\n"
                                    "[Context]\nsockets=wayland;\n")
        self.assertEqual(reach["words"], {})

    def test_x11_is_screen_and_home_is_files(self):
        reach = words.flatpak_reach("[Application]\nname=com.example.Old\n[Context]\nsockets=x11;\n"
                                    "filesystems=home;\ndevices=all;\n")
        self.assertEqual(set(reach["words"]), {"Screen", "Files", "Devices", "Camera"})

    def test_full_control_is_flagged_from_the_installer_s_own_test(self):
        for context in ("filesystems=home;\n", "filesystems=host;\n", "sockets=session-bus;\n",
                        "\n[Session Bus Policy]\norg.freedesktop.Flatpak=talk\n",
                        "\n[Session Bus Policy]\norg.freedesktop.systemd1=talk\n"):
            reach = words.flatpak_reach("[Application]\nname=com.example.Ide\n[Context]\n" + context)
            self.assertTrue(reach["full_control"], context)
            out, summary = checks.permission_checks([{"reach": reach}], [])
            self.assertTrue(summary["full_control"])
            self.assertIn("full-control", {c["key"] for c in out})
            self.assertTrue(all(c["ok"] for c in out))  # shown, never failed
        for context in ("filesystems=xdg-music;\nsockets=wayland;fallback-x11;\ndevices=dri;\n", ""):
            reach = words.flatpak_reach("[Application]\nname=com.example.Calm\n[Context]\n" + context)
            self.assertFalse(reach["full_control"], context)
        home_ro = words.flatpak_reach("[Application]\nname=com.example.Read\n[Context]\nfilesystems=home:ro;\n")
        self.assertEqual(home_ro["full_control_reasons"], ["filesystem home:ro"])
        # The session's PulseAudio and the whole keyring, with a stock flatpak.
        reasons = words.flatpak_reach(METADATA)["full_control_reasons"]
        self.assertIn("socket pulseaudio", reasons)
        self.assertIn("session bus talk org.freedesktop.secrets", reasons)

    def test_a_runtime_s_context_counts(self):
        app = "[Application]\nname=com.example.Plain\nruntime=org.example.Odd/x86_64/1\n[Context]\nsockets=wayland;\n"
        runtime = "[Runtime]\nname=org.example.Odd\n[Context]\nfilesystems=host-root;\n"
        self.assertTrue(words.flatpak_reach(app, runtime)["full_control"])
        self.assertFalse(words.flatpak_reach(app, "[Runtime]\nname=org.example.Odd\n")["full_control"])
        unread = words.flatpak_reach(app, None)
        self.assertFalse(unread["runtime_read"])
        self.assertTrue(any("runtime" in note for note in unread["notes"]))
        # The app takes a runtime grant away with "!".
        self.assertFalse(words.flatpak_reach(app.replace("sockets=wayland;", "filesystems=!host-root;"),
                                             runtime)["full_control"])

    def test_reserved_namespaces_are_refused(self):
        policy = {"reserved_prefixes": ["io.Suno."]}
        for app in ("org.freedesktop.impl.portal", "org.gnome.Shell.X", "org.kde.KWin", "io.Suno.Secrets"):
            self.assertIsNotNone(checks.reserved(app, policy, set()), app)
        self.assertIsNone(checks.reserved("org.gnome.Calculator", policy, set()))

    def test_compare_names_missing_words(self):
        missing = words.compare(["Internet"], {"Internet": ["network"], "Camera": ["devices.camera"]})
        self.assertEqual([m["word"] for m in missing], ["Camera"])
        self.assertIn("doesn't include Camera", missing[0]["message"])

    def test_universal_package(self):
        reach = words.package_reach(["/usr/bin/x", "/usr/lib/systemd/system/x.service",
                                     "/usr/share/applications/x.desktop"], {"postinst": "echo"})
        self.assertEqual(set(reach["words"]), {"Files", "Internet", "System"})
        reach = words.package_reach(["/lib/modules/6.1/extra/x.ko"], {})
        self.assertTrue(reach["refusals"])


class Images(unittest.TestCase):
    def test_png(self):
        self.assertEqual(images.identify(png(4, 3)), ("png", 4, 3))

    def test_truncated_png(self):
        with self.assertRaises(images.ImageError):
            images.identify(png(4, 3)[:-6])

    def test_svg(self):
        self.assertEqual(images.identify(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"/>'),
                         ("svg", 128, 128))
        with self.assertRaises(images.ImageError):
            images.identify(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>')

    def test_webp_lossless(self):
        bits = (99 & 0x3FFF) | ((49 & 0x3FFF) << 14)
        body = b"WEBP" + b"VP8L" + struct.pack("<I", 15) + b"\x2f" + struct.pack("<I", bits) + b"\0" * 10
        data = b"RIFF" + struct.pack("<I", len(body)) + body
        self.assertEqual(images.identify(data), ("webp", 100, 50))


class Checks(unittest.TestCase):
    policy = checks.load_policy()

    def test_reserved_ids(self):
        self.assertIsNotNone(checks.reserved("org.projectSuno.Notes", self.policy, set()))
        self.assertIsNotNone(checks.reserved("com.rhyme.viola", self.policy, {"com.rhyme.viola"}))
        self.assertIsNone(checks.reserved("com.example.Notes", self.policy, set()))

    def test_Suno_services_are_refused_in_any_spelling(self):
        meta = lambda body: "[Application]\nname=com.example.App\nruntime=org.gnome.Platform/x86_64/49\n\n" + body
        for rule, policy in (("org.projectSuno.Terminal", "talk"), ("org.projectSuno.DepotHost1", "own"),
                             ("org.projectSuno.*", "talk"), ("org.*", "see"), ("io.Suno.Monitor", "talk"),
                             ("io.*", "talk"), ("org.projectSuno.ShellState1", "talk"), ("ORG.projectSuno.Terminal", "talk"),
                             ("org.projectSuno", "own"), ("*", "talk")):
            names = checks.Suno_bus_names(meta(f"[Session Bus Policy]\n{rule}={policy}\n"))
            self.assertEqual(names, [rule], (rule, policy))
        self.assertEqual(checks.Suno_bus_names(meta("[System Bus Policy]\norg.projectSuno.ModTransactions1=talk\n")),
                         ["org.projectSuno.ModTransactions1"])
        for rule, policy in (("org.projectSuno.Terminal", "none"), ("org.freedesktop.Notifications", "talk"),
                             ("org.projectSunox.App", "talk"), ("io.Sunofoo.X", "talk"), ("com.*", "talk")):
            self.assertEqual(checks.Suno_bus_names(meta(f"[Session Bus Policy]\n{rule}={policy}\n")), [], rule)
        self.assertEqual(checks.Suno_bus_names("[broken"), ["(unreadable metadata)"])

    def test_a_bundle_talking_to_Suno_s_terminal_is_refused(self):
        facts = {"sha256": "x", "format": "flatpak", "app_id": "com.example.Evil", "arch": "x86_64",
                 "runtime": "org.gnome.Platform/x86_64/49", "desktop_files": ["com.example.Evil.desktop"],
                 "scan": {"ran": True, "clean": True},
                 "metadata": "[Application]\nname=com.example.Evil\n\n[Session Bus Policy]\norg.projectSuno.Terminal=talk\n"}
        out = checks.package_checks(facts, {"arch": "x86_64", "sha256": "x"}, {"app_id": "com.example.Evil"},
                                    self.policy, set())
        failed = [c for c in out if not c["ok"]]
        self.assertEqual([c["key"] for c in failed], ["Suno-services (x86_64)"])
        self.assertIn("uses a Suno system service reserved for Suno's own apps", failed[0]["message"])
        self.assertIn("org.projectSuno.Terminal", failed[0]["message"])
        self.assertEqual(checks.outcome(out), "needs_changes")
        facts["metadata"] = "[Application]\nname=com.example.Evil\n\n[Session Bus Policy]\norg.freedesktop.Notifications=talk\n"
        out = checks.package_checks(facts, {"arch": "x86_64", "sha256": "x"}, {"app_id": "com.example.Evil"},
                                    self.policy, set())
        self.assertTrue(all(c["ok"] for c in out), [c for c in out if not c["ok"]])

    def test_runtime(self):
        self.assertTrue(checks.runtime_allowed("org.gnome.Platform/x86_64/49", self.policy))
        self.assertTrue(checks.runtime_allowed("org.projectSuno.Platform/aarch64/44", self.policy))
        self.assertFalse(checks.runtime_allowed("org.gnome.Platform/x86_64/3.38", self.policy))
        self.assertFalse(checks.runtime_allowed("com.evil.Platform/x86_64/1", self.policy))

    def test_media(self):
        out = checks.media_checks({"icon": {"format": "png", "width": 256, "height": 256},
                                   "screenshots": [{"form": "desktop", "format": "png", "width": 1200,
                                                    "height": 700},
                                                   {"form": "phone", "format": "png", "width": 1170,
                                                    "height": 2532}]},
                                  {"summary": "x" * 61}, "app")
        failed = {c["key"] for c in out if not c["ok"]}
        self.assertEqual(failed, {"summary", "icon"})

    def test_missing_desktop_screenshot(self):
        out = checks.media_checks({"icon": {"format": "svg", "width": 64, "height": 64}, "screenshots": []},
                                  {"summary": "Short"}, "app")
        self.assertIn("screenshots", {c["key"] for c in out if not c["ok"]})

    def test_permissions_flow(self):
        facts = {"reach": words.flatpak_reach(METADATA)}
        out, summary = checks.permission_checks([facts], [{"word": "Internet", "reason": "Sync"},
                                                          {"word": "Files", "reason": "Music"}])
        # Reach is reported, never failed: Depot reads it from the sandbox itself.
        self.assertTrue(all(c["ok"] for c in out))
        self.assertEqual(sorted(summary["detected"]), ["Files", "Internet", "Notifications", "Other apps", "Passwords"])
        out, _ = checks.permission_checks([facts], [])
        self.assertTrue(all(c["ok"] for c in out))

    def test_internal_only_failure_is_attention(self):
        self.assertEqual(checks.outcome([checks.check("malware", False, "x", internal=True)]), "attention")


if __name__ == "__main__":
    unittest.main()
