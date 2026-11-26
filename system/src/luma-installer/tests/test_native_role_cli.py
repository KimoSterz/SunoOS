# SPDX-License-Identifier: Apache-2.0
"""C launch protocol controls; installed signature positives remain separate."""
import contextlib
import io
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import gi
gi.require_version('Flatpak', '1.0')
from gi.repository import Flatpak
from luma_installer import native_app_roles as roles


class NativeRoleCLI(unittest.TestCase):
    app = 'org.gnome.Nautilus'

    def reference(self, **changes):
        values = {'name':self.app, 'arch':'x86_64', 'branch':'beta',
                  'ref':f'app/{self.app}/x86_64/beta'}
        values.update(changes)
        return SimpleNamespace(get_name=lambda:values['name'], get_arch=lambda:values['arch'],
            get_branch=lambda:values['branch'], format_ref=lambda:values['ref'])

    def call(self, args):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            result = roles.main(args)
        return result, stdout.getvalue(), stderr.getvalue()

    def test_no_role_keeps_native_without_output_or_flatpak_lookup(self):
        with patch.object(Path, 'exists', return_value=False), \
             patch.object(roles, 'required', return_value=False), \
             patch.object(roles, 'installed') as installed:
            self.assertEqual(self.call(['--resolve',self.app]), (0,'',''))
            installed.assert_not_called()

    def test_exact_system_trusted_ref_is_only_success_output(self):
        installation = object()
        with patch.object(Path, 'exists', return_value=False), \
             patch.object(roles, 'required', return_value=True), \
             patch.object(Flatpak.Installation, 'new_system', return_value=installation), \
             patch.object(roles, 'installed', return_value=self.reference()) as installed:
            self.assertEqual(self.call(['--resolve',self.app]),
                (10,f'app/{self.app}/x86_64/beta\n',''))
            installed.assert_called_once_with(installation,self.app)

    def test_invalid_requests_never_query_role_or_execute_a_command(self):
        with patch.object(roles, 'required') as required:
            for args in ([], ['--resolve'], ['--resolve','../secret'],
                         ['--resolve',self.app,'--command=sh'], ['--exec',self.app]):
                result, output, error = self.call(args)
                self.assertEqual(result,1); self.assertEqual(output,''); self.assertTrue(error)
            required.assert_not_called()

    def test_missing_unsigned_or_unsafe_contract_refuses_without_fallback(self):
        with patch.object(Path, 'exists', return_value=False), \
             patch.object(roles, 'required', return_value=True), \
             patch.object(Flatpak.Installation, 'new_system'), \
             patch.object(roles, 'RETRY_SECONDS', ()), \
             patch.object(roles, 'installed', side_effect=ValueError('unexpected state')):
            result, output, error = self.call(['--resolve',self.app])
            self.assertEqual((result, output), (1, ''))
            self.assertEqual(error, 'unknown\tValueError: unexpected state\n')
        with patch.object(Path, 'exists', return_value=False), \
             patch.object(roles, 'required', side_effect=ValueError('unsafe role contract')):
            self.assertEqual(self.call(['--resolve',self.app])[0:2],(1,''))

    def test_sandbox_cannot_resolve_native_ownership(self):
        with patch.object(Path, 'exists', return_value=True), \
             patch.object(roles, 'required') as required:
            self.assertEqual(self.call(['--resolve',self.app])[0:2],(1,''))
            required.assert_not_called()

    def test_wrong_name_ref_arch_or_branch_never_enters_stdout(self):
        with patch.object(Path, 'exists', return_value=False), \
             patch.object(roles, 'required', return_value=True), \
             patch.object(Flatpak.Installation, 'new_system'):
            for changes in ({'name':'org.projectluma.Notes'}, {'arch':'../../secret'},
                            {'branch':'beta\n--command=sh'}, {'ref':'app/'+self.app+'/x86_64/beta\n'}):
                with patch.object(roles, 'installed', return_value=self.reference(**changes)):
                    self.assertEqual(self.call(['--resolve',self.app])[0:2],(1,''))


class ResolveFailures(unittest.TestCase):
    """A passing failure is retried; a real one names itself, once."""
    app = 'com.rhyme.viola'

    def ref(self, branch='beta', origin='luma', commit='a' * 64):
        name = f'app/{self.app}/x86_64/{branch}'
        return SimpleNamespace(get_name=lambda: self.app, format_ref=lambda: name,
            get_arch=lambda: 'x86_64', get_branch=lambda: branch,
            get_origin=lambda: origin, get_commit=lambda: commit)

    def installation(self, refs, current=None, remote=True):
        from gi.repository import GLib
        def get_remote(name, _cancellable):
            if not remote:
                raise GLib.Error.new_literal(Flatpak.error_quark(), 'no remote', Flatpak.Error.REMOTE_NOT_FOUND)
            return object()
        def get_current(name, _cancellable):
            if current is None:
                raise GLib.Error.new_literal(Flatpak.error_quark(), 'not current', Flatpak.Error.NOT_INSTALLED)
            return current
        return SimpleNamespace(get_remote_by_name=get_remote,
            list_installed_refs=lambda _c: refs, get_current_installed_app=get_current)

    def problem(self, installation):
        with patch('luma_installer.depot_flatpak.validate_remote'), \
             patch.object(roles, 'verify_deployed_commit'):
            with self.assertRaises(roles.RoleProblem) as caught:
                roles.installed(installation, self.app)
        return caught.exception.code

    def test_a_check_that_fails_while_an_update_deploys_is_tried_again(self):
        ref = self.ref()
        attempts = [OSError('object pruned while listed'), ref]
        def installed(_installation, _app):
            value = attempts.pop(0)
            if isinstance(value, Exception): raise value
            return value
        waits = []
        with patch.object(Flatpak.Installation, 'new_system'), \
             patch.object(roles, 'installed', side_effect=installed):
            self.assertIs(roles._resolve_installed(self.app, sleep=waits.append), ref)
        self.assertEqual(waits, [roles.RETRY_SECONDS[0]])

    def test_a_real_problem_is_not_retried(self):
        waits = []
        with patch.object(Flatpak.Installation, 'new_system'), \
             patch.object(roles, 'installed', side_effect=roles.RoleProblem('unsigned', 'no key')) as installed:
            with self.assertRaises(roles.RoleProblem):
                roles._resolve_installed(self.app, sleep=waits.append)
        self.assertEqual((installed.call_count, waits), (1, []))

    def test_two_branches_resolve_to_the_current_one(self):
        beta, stable = self.ref('beta'), self.ref('stable')
        with patch('luma_installer.depot_flatpak.validate_remote'), \
             patch.object(roles, 'verify_deployed_commit'):
            self.assertIs(roles.installed(self.installation([beta, stable], current=stable), self.app), stable)

    def test_each_real_problem_has_its_own_code(self):
        self.assertEqual(self.problem(self.installation([self.ref('beta'), self.ref('stable')])), 'several')
        self.assertEqual(self.problem(self.installation([])), 'not-installed')
        self.assertEqual(self.problem(self.installation([self.ref(origin='flathub')])), 'other-source')
        self.assertEqual(self.problem(self.installation([self.ref()], remote=False)), 'source-missing')
        from luma_installer.depot_flatpak import SourceUnavailable
        with patch('luma_installer.depot_flatpak.validate_remote', side_effect=SourceUnavailable('Luma is disabled.')):
            with self.assertRaises(roles.RoleProblem) as caught:
                roles.installed(self.installation([self.ref()]), self.app)
        self.assertEqual(caught.exception.code, 'source-invalid')

    def test_every_code_has_a_repair_with_an_action(self):
        for code, (sentence, label, view) in roles.REPAIRS.items():
            self.assertIn('{name}', sentence)
            self.assertTrue(label)
            self.assertIn(view, (None, 'app', 'updates', 'settings'))

    def test_a_failed_check_is_in_the_journal_under_the_launchers_name(self):
        with patch.object(Path, 'exists', return_value=False), \
             patch.object(roles, 'required', return_value=True), \
             patch.object(roles, '_resolve_installed', side_effect=roles.RoleProblem('several', 'two branches')), \
             patch.object(roles, '_journal') as journal:
            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr):
                self.assertEqual(roles.main(['--resolve', self.app]), 1)
        self.assertEqual(stderr.getvalue(), 'several\ttwo branches\n')
        journal.assert_called_once_with(self.app, 'signed application check failed: several: two branches', 'several')
        self.assertEqual(roles.LAUNCHERS[self.app], 'viola-browser')
