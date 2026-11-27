# SPDX-License-Identifier: Apache-2.0
"""Release display names: presentation only, never a comparison."""
import io
import json
import os
from contextlib import redirect_stdout
import tempfile
import unittest
from unittest import mock

import fakes
from fakes import NOW, commit, graph_doc, release
from Suno_update import cli, graph as graphmod, names, notifier, versions
from Suno_update.status import DBUS_TYPES, Status

NIGHTLY_OS_RELEASE = """NAME=Suno
VERSION="Prairie, Beta 0, Nightly 20260916"
ID=Suno
ID_LIKE=fedora
VERSION_ID=1
VERSION_CODENAME=prairie
PRETTY_NAME="Suno (Prairie, Beta 0, Nightly 20260916)"
RELEASE_TYPE=development
BUILD_ID=20260917.5
IMAGE_VERSION=20260917.5
SUNO_RELEASE_CHANNEL=nightly
SUNO_RELEASE_STAGE=beta
SUNO_RELEASE_STAGE_NUMBER=0
SUNO_NIGHTLY_DATE=20260916
"""
OLD_OS_RELEASE = 'NAME=Suno\nVERSION="1.0 (build 20260916.9)"\nID=Suno\nVERSION_ID=1.0\nPRETTY_NAME="Suno 1.0"\n'


class Derivation(unittest.TestCase):
    def test_parse_os_release(self):
        info = names.parse_os_release(NIGHTLY_OS_RELEASE)
        self.assertEqual(info["PRETTY_NAME"], "Suno (Prairie, Beta 0, Nightly 20260916)")
        self.assertEqual(info["VERSION_CODENAME"], "prairie")

    def test_booted_reads_pretty_name(self):
        info = names.parse_os_release(NIGHTLY_OS_RELEASE)
        self.assertEqual(names.booted_name(info, "1.0.0-nightly.20260917.5"),
                         "Suno (Prairie, Beta 0, Nightly 20260916)")

    def test_old_image_pretty_name_is_not_used(self):
        info = names.parse_os_release(OLD_OS_RELEASE)
        self.assertEqual(names.booted_name(info, "1.0.0-nightly.20260916.9"),
                         "Suno (Prairie, Beta 0, Nightly 20260916)")

    def test_other_systems_keep_their_own_name(self):
        info = {"ID": "fedora", "PRETTY_NAME": "Fedora Linux 44 (Silverblue)"}
        self.assertEqual(names.booted_name(info, "44.20260915.0"), "Fedora Linux 44 (Silverblue)")

    def test_derived_names(self):
        booted = names.parse_os_release(NIGHTLY_OS_RELEASE)
        cases = {
            "1.0.0-nightly.20260917.1": "Suno (Prairie, Beta 0, Nightly 20260917)",
            "1.0.0-beta.1": "Suno (Prairie, Beta 1)",
            "1.0.0-beta.1.1": "Suno (Prairie, Beta 1.1)",
            "1.0.0": "Suno (Version 1, Prairie)",
            "1.0.1": "Suno (Version 1.0.1, Prairie)",
            "1.0.0-rc.1": "Suno 1.0.0-rc.1",
        }
        for version, expected in cases.items():
            self.assertEqual(names.derive(version, booted), expected, version)
        final = dict(booted, SUNO_RELEASE_STAGE="final", VERSION_CODENAME="prairie")
        self.assertEqual(names.derive("2.0.0-nightly.20270101.3", final), "Suno (Version 2, Prairie, Nightly 20270101)")
        self.assertEqual(names.derive("1.0.0-beta.2", {}), "Suno (Prairie, Beta 2)")
        self.assertEqual(names.derive("1.0.0-beta.2", {"VERSION_CODENAME": "big-sky"}), "Suno (Big Sky, Beta 2)")

    def test_never_Suno_Suno(self):
        self.assertEqual(names.display_name("Suno (Prairie, Beta 1)"), "Suno (Prairie, Beta 1)")
        self.assertEqual(names.display_name(""), "")

    def test_fallback_order(self):
        booted = names.parse_os_release(NIGHTLY_OS_RELEASE)
        on_disk = {"ID": "Suno", "VERSION_CODENAME": "prairie", "PRETTY_NAME": "Suno (Prairie, Beta 1)"}
        self.assertEqual(names.display_name("1.0.0-beta.1", graph_name="Suno (Prairie, Beta One)",
                                            os_release=on_disk, booted=booted), "Suno (Prairie, Beta One)")
        self.assertEqual(names.display_name("1.0.0-beta.1", graph_name="", os_release=on_disk, booted=booted),
                         "Suno (Prairie, Beta 1)")
        self.assertEqual(names.display_name("1.0.0-beta.1", graph_name="x" * 201, booted=booted),
                         "Suno (Prairie, Beta 1)")
        self.assertEqual(names.display_name("1.0.0-beta.1", graph_name="bad\nname", booted=booted),
                         "Suno (Prairie, Beta 1)")

    def test_deployment_path_is_never_outside_the_deploy_tree(self):
        good = fakes.FakeDeployment(commit(7), "1.0.0", "Suno:Suno/1/x86_64/stable", serial=1)
        self.assertEqual(str(names.deployment_os_release("/", good)),
                         f"/ostree/deploy/Suno/deploy/{commit(7)}.1/usr/lib/os-release")
        self.assertIsNone(names.deployment_os_release("/", fakes.FakeDeployment("../../etc", "1", "x")))
        self.assertIsNone(names.deployment_os_release("/", fakes.FakeDeployment(commit(7), "1", "x", osname="..")))


class GraphNames(unittest.TestCase):
    def test_graph_without_display_name_still_parses(self):
        graph = graphmod.parse_graph(json.dumps(graph_doc([release("1.0.0", 1)])).encode())
        self.assertEqual(graph.releases[0].display_name, "")

    def test_display_name_is_validated(self):
        ok = graphmod.parse_graph(json.dumps(graph_doc([release("1.0.0", 1, display_name="Suno (Version 1, Prairie)")])).encode())
        self.assertEqual(ok.releases[0].display_name, "Suno (Version 1, Prairie)")
        graphmod.parse_graph(json.dumps(graph_doc([release("1.0.0", 1, display_name=None)])).encode())
        for bad in ("x" * 201, "two\nlines", 7, ["Suno"]):
            with self.assertRaises(graphmod.GraphError):
                graphmod.parse_graph(json.dumps(graph_doc([release("1.0.0", 1, display_name=bad)])).encode())

    def test_selection_ignores_names(self):
        doc = graph_doc([
            release("1.0.0-nightly.20260916.9", 1, display_name="Suno (Prairie, Beta 0, Nightly 20260915)"),
            release("1.0.0-nightly.20260917.1", 2, display_name="Suno (Prairie, Beta 0, Nightly 20260916)"),
        ], channel="nightly")
        graph = graphmod.parse_graph(json.dumps(doc).encode())
        decision = graphmod.select_target(graph, booted_version=versions.parse("1.0.0-nightly.20260916.9"),
                                          booted_commit=commit(1), wariness=0.5, now=NOW)
        self.assertEqual((decision.action, str(decision.release.version)), ("update", "1.0.0-nightly.20260917.1"))


class EngineNames(unittest.TestCase):
    def setUp(self):
        self.rig = fakes.Rig()
        self.rig.backend = fakes.FakeRpmOstree(booted_version="1.0.0-nightly.20260916.9",
                                               origin="Suno:Suno/1/x86_64/nightly")
        path = self.rig.paths.os_release
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(NIGHTLY_OS_RELEASE)
        self.rig.publish(graph_doc([
            release("1.0.0-nightly.20260916.9", 1, display_name="Suno (Prairie, Beta 0, Nightly 20260916)"),
            release("1.0.0-nightly.20260917.1", 2, display_name="Suno (Prairie, Beta 0, Nightly 20260917)"),
        ], channel="nightly"), channel="nightly")
        self.engine = self.rig.engine()

    def tearDown(self):
        self.rig.close()

    def test_up_to_date_legacy_image_is_named_by_the_graph(self):
        # Nick's ThinkPad: an image from before release names ("Suno 1.0"),
        # already on the channel head, so nothing is available.
        self.rig.paths.os_release.write_text('NAME=Suno\nID=Suno\nVERSION_ID=1.0\nPRETTY_NAME="Suno 1.0"\n')
        self.rig.publish(graph_doc([
            release("1.0.0-nightly.20260916.9", 1, display_name="Suno (Prairie, Beta 0, Nightly 20260915)"),
        ], channel="nightly"), channel="nightly")
        engine = self.rig.engine()
        engine.check()
        self.assertEqual(engine.status().available_version, "")
        self.assertEqual(engine.status().booted_name, "Suno (Prairie, Beta 0, Nightly 20260915)")
        self.assertEqual(engine.store.data["booted_display_name"]["name"], "Suno (Prairie, Beta 0, Nightly 20260915)")

    def test_stage_only_os_release_is_named_by_the_graph(self):
        self.rig.paths.os_release.write_text('NAME=Suno\nID=Suno\nVERSION_ID=1\nVERSION_CODENAME=prairie\n'
                                             'PRETTY_NAME="Suno (Prairie, Beta 0)"\nSuno_RELEASE_STAGE=beta\n')
        self.rig.publish(graph_doc([
            release("1.0.0-nightly.20260916.9", 1, display_name="Suno (Prairie, Beta 0, Nightly 20260915)"),
        ], channel="nightly"), channel="nightly")
        engine = self.rig.engine()
        engine.check()
        self.assertEqual(engine.status().booted_name, "Suno (Prairie, Beta 0, Nightly 20260915)")

    def test_installed_client_selects_the_same_release_and_names_it(self):
        decision = self.engine.check()
        self.assertEqual(str(decision.release.version), "1.0.0-nightly.20260917.1")
        status = self.engine.status()
        self.assertEqual((status.available_version, status.booted_version),
                         ("1.0.0-nightly.20260917.1", "1.0.0-nightly.20260916.9"))
        self.assertEqual(status.available_name, "Suno (Prairie, Beta 0, Nightly 20260917)")
        self.assertEqual(status.booted_name, "Suno (Prairie, Beta 0, Nightly 20260916)")
        self.assertTrue(self.engine.download(user_initiated=True))
        status = self.engine.status()
        self.assertEqual((status.state, status.staged_version), ("staged", "1.0.0-nightly.20260917.1"))
        self.assertEqual(status.staged_name, "Suno (Prairie, Beta 0, Nightly 20260917)")
        self.engine.ignore_version("1.0.0-nightly.20260917.1")
        self.assertEqual(self.engine.status().ignored_name, "Suno (Prairie, Beta 0, Nightly 20260917)")
        published = json.loads(self.rig.paths.status_file.read_text())
        self.assertEqual(published["staged_name"], "Suno (Prairie, Beta 0, Nightly 20260917)")
        plan, _ = notifier.decide(dict(published, ignored_version=""), notifier.NotifierState(), NOW)
        self.assertEqual(plan.title, "Suno (Prairie, Beta 0, Nightly 20260917) is ready")

    def test_staged_deployment_named_by_its_own_os_release(self):
        self.rig.backend.update_deployment(revision=commit(3), refspec=None, allow_downgrade=False)
        staged = self.rig.backend.list[0]
        staged.version = "1.0.0-beta.1"
        tree = names.deployment_os_release(self.rig.root, staged)
        tree.parent.mkdir(parents=True)
        tree.write_text('ID=Suno\nVERSION_CODENAME=prairie\nPRETTY_NAME="Suno (Prairie, Beta 1)"\n')
        self.engine.refresh()
        self.assertEqual(self.engine.status().staged_name, "Suno (Prairie, Beta 1)")

    def test_every_name_is_a_published_string(self):
        for key in ("booted_name", "staged_name", "available_name", "waiting_name", "rolled_back_name",
                    "ignored_name"):
            self.assertEqual(DBUS_TYPES[key], "s")
            self.assertIn(key, Status().to_json_dict())


class CliNames(unittest.TestCase):
    def test_status_text_uses_names(self):
        status = Status(state="staged", channel="nightly", booted_version="1.0.0-nightly.20260916.9",
                        staged_version="1.0.0-nightly.20260917.1", managed=True,
                        booted_name="Suno (Prairie, Beta 0, Nightly 20260916)",
                        staged_name="Suno (Prairie, Beta 0, Nightly 20260917)")
        with tempfile.TemporaryDirectory() as root:
            path = os.path.join(root, "run/Suno-update/status.json")
            os.makedirs(os.path.dirname(path))
            with open(path, "w") as stream:
                stream.write(status.to_json())
            with mock.patch.dict(os.environ, {"SUNO_UPDATE_ROOT": root}), \
                    mock.patch.object(cli, "Client", side_effect=RuntimeError("no bus")):
                out = io.StringIO()
                with redirect_stdout(out):
                    cli.main(["status"])
        text = out.getvalue()
        self.assertIn("Suno (Prairie, Beta 0, Nightly 20260916) on the nightly channel", text)
        self.assertIn("Suno (Prairie, Beta 0, Nightly 20260917) is ready. Restart to finish updating", text)
        self.assertNotIn("Suno Suno", text)
        self.assertNotIn("Suno 1.0", text)


if __name__ == "__main__":
    unittest.main()
