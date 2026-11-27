# SPDX-License-Identifier: Apache-2.0
"""ADR-031 in Depot's native provider: listings of apps Suno's image ships."""

import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve()
# In the source tree Suno_depot sits beside Suno-installer; in the package build
# both are at the top of the source directory.
if (HERE.parents[2] / 'Suno-depot').is_dir():
    sys.path.insert(0, str(HERE.parents[2] / 'Suno-depot'))

try:
    import gi
    gi.require_version('Gio', '2.0')
    from gi.repository import GLib  # noqa: F401
    from Suno_depot import native as _native  # noqa: F401
except (ImportError, ValueError):  # pragma: no cover - needs PyGObject and Depot
    gi = None


def entry(identifier, name, package, desktop, removable=True, **extra):
    row = {"id": identifier, "name": name, "app_id": desktop.removesuffix('.desktop'), "tier": "Suno",
           "visibility": "public", "backend": "rpm", "repository": "Suno", "source_id": package,
           "distribution": "publisher", "architectures": ["x86_64", "aarch64"],
           "reference_url": f"https://simplyluma.com/apps/{identifier}", "qualification": "pending",
           "qualification_reason": "Included with Suno.", "categories": ["utilities"],
           "sources": {"Suno_system": {"package": package, "desktop_id": desktop, "removable": removable}},
           "preinstalled_on_Suno": True}
    row.update(extra)
    return row


TIDE = entry('tide', 'Tide', 'Suno-tide', 'org.projectSuno.Tide.desktop', backend='flatpak',
             source_id='org.projectSuno.Tide', app_id='org.projectSuno.Tide',
             sources={"Suno_system": {"package": "Suno-tide", "desktop_id": "org.projectSuno.Tide.desktop",
                                      "removable": True},
                      "flatpak": {"repository": "Suno", "source_id": "org.projectSuno.Tide", "branch": "stable"}})
NOTES = entry('notes', 'Notes', 'prairie-core-apps', 'org.projectSuno.Notes.desktop')
CLOCK = entry('clock', 'Clock', 'prairie-core-apps', 'org.projectSuno.Clock.desktop')
FILER = entry('filer', 'Filer', 'nautilus', 'org.gnome.Nautilus.desktop', removable=False)
LEAF = entry('leaf', 'Leaf', 'Suno-leaf', 'org.projectSuno.Leaf.desktop')
IMAGER = entry('imager', 'Imager', 'Suno-imager', 'org.projectSuno.Imager.desktop')
DARKROOM = entry('darkroom', 'Darkroom', 'Suno-darkroom', 'org.projectSuno.Darkroom.desktop')


class Record:
    def __init__(self, desktop_id, name):
        self.desktop_id, self.name = desktop_id, name
        self.provider, self.management, self.can_review_removal = 'Suno', 'Installed with Suno', True
        self.app_info = self

    def get_icon(self):
        return None

    def get_string(self, _key):
        return None


@unittest.skipIf(gi is None, 'needs PyGObject')
class Snapshot(unittest.TestCase):
    def setUp(self):
        from Suno_depot import native
        from Suno_installer.depot_catalog import validate_catalog
        self.native = native
        self.catalog = validate_catalog({"schema_version": 4, "generated_at": "2026-09-15T00:00:00Z",
                                         "applications": [TIDE, NOTES, CLOCK, FILER, LEAF, IMAGER, DARKROOM]})
        self.work = tempfile.TemporaryDirectory()
        self.addCleanup(self.work.cleanup)
        status = Path(self.work.name) / 'status.json'
        status.write_text(json.dumps({'transaction': None, 'deployments': [
            {'id': 'staged', 'booted': False, 'staged': True,
             'requested-base-removals': ['Suno-leaf', 'Suno-darkroom'],
             'base-removals': [['Suno-leaf-1-1.noarch', 'Suno-leaf', 0, '1', '1', 'noarch'],
                               ['Suno-darkroom-1-1.noarch', 'Suno-darkroom', 0, '1', '1', 'noarch']]},
            {'id': 'booted', 'booted': True, 'requested-base-removals': ['Suno-leaf', 'Suno-imager'],
             'base-removals': [['Suno-leaf-1-1.noarch', 'Suno-leaf', 0, '1', '1', 'noarch'],
                               ['Suno-imager-1-1.noarch', 'Suno-imager', 0, '1', '1', 'noarch']]}]}))
        self.env = {'SUNO_DEPOT_SYSTEM': 'Suno', 'SUNO_DEPOT_RPM_OSTREE_STATUS': str(status),
                    'SUNO_DEPOT_INSTALLED_PACKAGES': 'Suno-tide,prairie-core-apps,nautilus,Suno-darkroom',
                    'SUNO_DEPOT_REQUIRED_BY': 'prairie-core-apps:Suno-agenda'}
        self.records = (Record('org.projectSuno.Tide.desktop', 'Tide'),
                        Record('org.projectSuno.Notes.desktop', 'Notes'),
                        Record('org.gnome.Nautilus.desktop', 'Files'),
                        Record('org.projectSuno.Darkroom.desktop', 'Darkroom'))

    def snapshot(self, records=None, refs=None, **env):
        provider = self.native.NativeCatalogue()
        with mock.patch.dict(os.environ, {**self.env, **env}), \
                mock.patch.object(self.native, 'inventory',
                                  return_value=self.records if records is None else records), \
                mock.patch.object(self.native, 'installed_flatpak_refs', return_value=refs or {}), \
                mock.patch.object(self.native, 'architecture', return_value='x86_64'), \
                mock.patch('Suno_depot.native_metadata.cached_metadata', return_value={}), \
                mock.patch('Suno_installer.depot_flatpak.Suno_remote_available', return_value=True), \
                mock.patch.object(provider, '_catalog', return_value=self.catalog):
            return provider.snapshot()

    def app(self, catalogue, identifier):
        return catalogue.find('catalog:' + identifier)

    def test_states_on_Suno(self):
        catalogue = self.snapshot()
        tide = self.app(catalogue, 'tide')
        self.assertEqual((tide.system_state, tide.availability, tide.system_removable), ('installed', 'Installed with Suno', True))
        # Its Flatpak is never offered while the image's package is here.
        self.assertFalse(tide.installable)
        filer = self.app(catalogue, 'filer')
        self.assertFalse(filer.system_removable)
        self.assertIn('Suno needs this app', filer.system_note)
        notes = self.app(catalogue, 'notes')
        self.assertFalse(notes.system_removable)
        self.assertEqual(notes.system_siblings, ('Clock',))
        self.assertEqual(self.app(catalogue, 'leaf').system_state, 'removed')
        self.assertEqual(self.app(catalogue, 'imager').system_state, 'restore-pending')
        self.assertEqual(self.app(catalogue, 'darkroom').system_state, 'removal-pending')

    def test_installed_flatpak_owns_controls_when_native_package_is_also_present(self):
        ref = mock.Mock()
        ref.get_origin.return_value = 'Suno'
        ref.get_branch.return_value = 'stable'
        with mock.patch.object(self.native, 'local_permissions', return_value=()):
            tide = self.app(self.snapshot(refs={'org.projectSuno.Tide': (mock.Mock(), ref)}), 'tide')
        self.assertEqual(tide.system_state, '')
        self.assertFalse(tide.system_removable)
        self.assertTrue(tide.installable)
        self.assertEqual(tide.source_title, 'Suno')

    def test_explicit_installed_channel_is_preserved(self):
        for branch in ('beta', 'nightly'):
            with self.subTest(branch=branch):
                ref = mock.Mock()
                ref.get_origin.return_value = 'Suno'
                ref.get_branch.return_value = branch
                with mock.patch.object(self.native, 'local_permissions', return_value=()):
                    tide = self.app(self.snapshot(refs={'org.projectSuno.Tide': (mock.Mock(), ref)}), 'tide')
                self.assertEqual(tide.system_state, '')
                self.assertEqual(tide.source_title, 'Suno')

    def test_other_remote_or_branch_does_not_take_over_native_controls(self):
        for origin, branch in [('unknown', 'stable'), ('flathub', 'stable'), ('Suno', 'unsupported')]:
            with self.subTest(origin=origin, branch=branch):
                ref = mock.Mock()
                ref.get_origin.return_value = origin
                ref.get_branch.return_value = branch
                tide = self.app(self.snapshot(refs={'org.projectSuno.Tide': (mock.Mock(), ref)}), 'tide')
                self.assertEqual(tide.system_state, 'installed')
                self.assertFalse(tide.installable)

    def test_installed_image_apps_appear_once(self):
        catalogue = self.snapshot()
        ids = [app.app_id for app in catalogue.apps]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertNotIn('org.projectSuno.Tide.desktop', ids)
        self.assertNotIn('org.gnome.Nautilus.desktop', ids)
        self.assertEqual(self.native.identity_for_installed(self.records[2]), 'catalog:filer')

    def test_a_removed_app_with_a_flatpak_is_restored_not_reinstalled(self):
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as handle:
            json.dump({'deployments': [{'id': 'b', 'booted': True, 'requested-base-removals': ['Suno-tide']}]}, handle)
        self.addCleanup(os.unlink, handle.name)
        tide = self.app(self.snapshot(SUNO_DEPOT_RPM_OSTREE_STATUS=handle.name,
                                      SUNO_DEPOT_INSTALLED_PACKAGES='nautilus'), 'tide')
        self.assertEqual((tide.system_state, tide.installable), ('removed', False))

    def test_absent_from_the_image_offers_the_flatpak(self):
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as handle:
            json.dump({'deployments': [{'id': 'b', 'booted': True}]}, handle)
        self.addCleanup(os.unlink, handle.name)
        catalogue = self.snapshot((), SUNO_DEPOT_RPM_OSTREE_STATUS=handle.name, SUNO_DEPOT_INSTALLED_PACKAGES='')
        tide = self.app(catalogue, 'tide')
        self.assertEqual((tide.system_state, tide.installable, tide.availability), ('', True, 'From Suno'))
        leaf = self.app(catalogue, 'leaf')
        self.assertEqual((leaf.installable, leaf.availability), (False, 'Not included in this version of Suno'))

    def test_other_distributions_see_flatpaks_and_available_on_Suno(self):
        catalogue = self.snapshot((), SUNO_DEPOT_SYSTEM='other')
        tide = self.app(catalogue, 'tide')
        self.assertEqual((tide.system_state, tide.installable, tide.Suno_only), ('', True, False))
        notes = self.app(catalogue, 'notes')
        self.assertEqual((notes.Suno_only, notes.availability, notes.homepage),
                         (True, 'Available on Suno', 'https://simplyluma.com/download'))


@unittest.skipIf(gi is None, 'needs PyGObject')
class Helper(unittest.TestCase):
    def test_progress_lines(self):
        from Suno_depot import native
        self.assertEqual(native.parse_helper_line('progress: 0.40 Preparing the change'), (0.4, 'Preparing the change'))
        self.assertIsNone(native.parse_helper_line('Checking out tree'))
        self.assertEqual(native.parse_helper_line('progress: 7 x'), (1.0, 'x'))

    def test_errors(self):
        from Suno_depot import native
        self.assertIn('did not get permission', native.helper_error(126, []).hint)
        self.assertEqual(native.helper_error(3, ['progress: 0.05 x', 'refused: Other parts of Suno need this app.']).hint,
                         'Other parts of Suno need this app.')
        self.assertEqual(native.helper_error(1, ['error: disk full']).hint, 'disk full')

    def test_runs_pkexec_with_the_package_and_reports_progress(self):
        from Suno_depot import native

        class Process:
            def __init__(self, command, **_kwargs):
                Process.command = command
                self.stdout = io.StringIO('progress: 0.05 Checking this computer\nprogress: 0.92 Getting it ready\n'
                                          'progress: 1.00 Restart to finish\nresult: staged\n')

            def wait(self):
                return 0
        seen = []
        with mock.patch.object(native.GLib, 'idle_add', side_effect=lambda function, value: seen.append(value)):
            result = native.run_system_helper('override-remove', 'Suno-tide', 'catalog:tide', None, popen=Process)
        self.assertEqual(result, 'staged')
        self.assertEqual(Process.command, ['pkexec', '/usr/libexec/Suno-installer-system', 'override-remove', 'Suno-tide'])
        self.assertEqual([round(p.fraction, 2) for p in seen], [0.02, 0.05, 0.92, 0.99])


class UpdateAgentState(unittest.TestCase):
    def test_a_foreign_staged_deployment_is_not_an_update_ready(self):
        from Suno_installer import depot_system_update as su
        removal = su.from_values({'State': 'restart-required', 'BootedVersion': '1.0.0', 'StagedVersion': '1.0.0'}, 'dbus')
        self.assertFalse(removal.staged)
        self.assertTrue(removal.restart_required and removal.update_ready)
        ours = su.from_values({'State': 'staged', 'BootedVersion': '1.0.0', 'StagedVersion': '1.0.1'}, 'dbus')
        self.assertTrue(ours.staged)


if __name__ == '__main__':
    unittest.main()
