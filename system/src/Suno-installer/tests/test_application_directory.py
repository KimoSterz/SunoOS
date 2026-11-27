# SPDX-License-Identifier: Apache-2.0
"""Actual GIO desktop catalogue and launch, plus bounded broker controls."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from gi.repository import Gio, GLib
from Suno_installer import application_directory as directory


class Protocol(unittest.TestCase):
    def test_desktop_ids_refuse_commands_paths_and_controls(self):
        for value in ('../../bin/sh.desktop', '/usr/bin/sh', 'x.desktop\n', 'x.desktop --evil', '', 'x'*260+'.desktop'):
            with self.subTest(value=value), self.assertRaises(ValueError): directory.validate_id(value)
        self.assertEqual(directory.validate_id('org.projectSuno.Notes.desktop'),'org.projectSuno.Notes.desktop')
    def test_mime_size_and_syntax(self):
        for value in ('x', '/x', 'text/plain\n', 'x/'+'y'*128):
            with self.subTest(value=value), self.assertRaises(ValueError): directory.validate_mime(value)
        directory.validate_mime('text/calendar');directory.validate_mime('')
    def test_file_authority_is_portal_and_uid_scoped(self):
        for uri in ('file:///home/user/.local/share/private/key','file:///run/user/123/doc/ab/../key',
                    'file:///run/user/124/doc/ab/x', 'file://host/run/user/123/doc/ab/x',
                    'file:///run/user/123/doc/not.a.token/x', 'file:///run/user/123/doc/ab/x?key=x',
                    'mailto:user@example.com','https://user:password@example.com/x'):
            with self.subTest(uri=uri), self.assertRaises(ValueError): directory.validate_uris([uri],123,check_files=False)
        directory.validate_uris(['file:///run/user/123/doc/ab/report.pdf','https://example.com/a'],123,check_files=False)
        directory.validate_uris(['file:///run/user/123/doc/9AVY_dAacjHr_F6nIKEYcQ/report.pdf'],123,check_files=False)
        for token in ('', '.', '..', 'a%2Fb', 'a%00b', 'a'*65, 'a%20b'):
            with self.subTest(token=token), self.assertRaises(ValueError):
                directory.validate_uris(['file:///run/user/123/doc/'+token+'/report.pdf'],123,check_files=False)
    def test_document_count_and_total_budget(self):
        directory.validate_uris(['https://example.com/track.flac']*256,check_files=False)
        with self.assertRaises(ValueError):directory.validate_uris(['https://example.com/a']*257,check_files=False)
        with self.assertRaises(ValueError):directory.validate_uris(['https://example.com/'+'a'*4096],check_files=False)
    def test_unsupported_receiver_does_not_launch(self):
        app=mock.Mock();app.should_show.return_value=True;app.supports_files.return_value=False;app.supports_uris.return_value=False
        with mock.patch.object(Gio.DesktopAppInfo,'new',return_value=app),self.assertRaises(ValueError):
            directory.launch_application('org.example.Test.desktop',['https://example.com/a'])
        app.launch.assert_not_called();app.launch_uris.assert_not_called()
    def test_catalogue_is_real_registered_desktop_metadata_and_launch(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);apps=base/'data/applications';apps.mkdir(parents=True)
            marker=base/'accepted';script=base/'accept';script.write_text('#!/bin/sh\nprintf accepted > '+str(marker)+'\n');script.chmod(0o700)
            (apps/'org.projectSuno.DirectoryProbe.desktop').write_text('[Desktop Entry]\nType=Application\nName=Actual directory probe\nIcon=application-x-executable\nExec='+str(script)+'\nMimeType=application/x-Suno-directory-probe;\n')
            (apps/'org.projectSuno.HiddenDirectoryProbe.desktop').write_text('[Desktop Entry]\nType=Application\nName=Hidden directory probe\nNoDisplay=true\nExec=/usr/bin/false\nMimeType=application/x-Suno-directory-probe;\n')
            code='''import json,time
from Suno_installer.application_directory import application_rows,launch_application
rows=application_rows('');assert any(r[0]=='org.projectSuno.DirectoryProbe.desktop' for r in rows)
assert not any(r[0]=='org.projectSuno.HiddenDirectoryProbe.desktop' for r in rows)
assert launch_application('org.projectSuno.DirectoryProbe.desktop',[])
print(json.dumps(rows))
'''
            env={**os.environ,'XDG_DATA_HOME':str(base/'data'),'XDG_DATA_DIRS':str(base/'empty')}
            result=subprocess.run([sys.executable,'-B','-c',code],env=env,text=True,capture_output=True,timeout=15)
            self.assertEqual(result.returncode,0,result.stderr)
            import time
            deadline=time.monotonic()+3
            while not marker.exists() and time.monotonic()<deadline:time.sleep(.02)
            self.assertEqual(marker.read_text(),'accepted')
            self.assertTrue(json.loads(result.stdout)[0][0].endswith('.desktop'))


class MainContextAdmission(unittest.TestCase):
    def broker(self):
        b=directory.Broker.__new__(directory.Broker);b.active={};b.last=0
        return b
    def test_invalid_requests_never_authenticate_or_launch(self):
        b=self.broker();inv=mock.Mock()
        with mock.patch('Suno_installer.app_data_broker.authenticate',side_effect=AssertionError('invalid request reached auth')):
            b._call(mock.Mock(),':1.1','','','Launch',GLib.Variant('(sas)',('/bin/sh',[])),inv)
        inv.return_dbus_error.assert_called_once();self.assertFalse(b.active)
    def test_four_jobs_and_one_per_sender_are_bounded(self):
        b=self.broker();b.active={':1.'+str(i):Gio.Cancellable() for i in range(4)};inv=mock.Mock()
        b._call(mock.Mock(),':1.8','','','List',GLib.Variant('(s)',('',)),inv)
        inv.return_dbus_error.assert_called_once();self.assertEqual(len(b.active),4)
    def test_actual_dbus_signature_is_bounded_public_rows(self):
        node=Gio.DBusNodeInfo.new_for_xml(directory.XML)
        self.assertEqual(node.interfaces[0].name,directory.BUS)
        row=('org.projectSuno.Notes.desktop','Notes','org.projectSuno.Notes',False,True,True)
        self.assertEqual(GLib.Variant('(a(sssbbb))',([row],)).unpack(),([row],))


PDF = ('application/pdf', 'application/pdf')


class LaunchPolicy(unittest.TestCase):
    """A sandbox opens web addresses in the person's default, a file in its only
    app or a signed Suno app, and anything else only as the person chooses."""
    URI = 'file:///run/user/1000/doc/ab12/report.pdf'
    WEB = 'https://example.com/x'

    def decide(self, uris=(), caller='org.projectSuno.Notes', sibling=False, system_app=False, kinds=None,
               web_default=False, sole_handler=False, file_default=False):
        uris = list(uris)
        if kinds is None:
            kinds = [('x-scheme-handler/https',) if uri.startswith('https') else PDF for uri in uris]
        return directory.launch_decision(caller, 'org.example.Host.desktop', uris, sibling=sibling,
            system_app=system_app, kinds=kinds, web_default=web_default, sole_handler=sole_handler,
            file_default=file_default)

    def test_an_arbitrary_host_app_with_documents_needs_the_person(self):
        self.assertEqual(self.decide([self.URI]), 'ask')
        self.assertEqual(self.decide([self.WEB]), 'ask')
        self.assertEqual(self.decide([self.URI, self.WEB], web_default=True), 'ask')

    def test_xdg_desktop_portal_rules_open_directly(self):
        self.assertEqual(self.decide([self.WEB], web_default=True), 'launch')
        self.assertEqual(self.decide([self.URI], sole_handler=True), 'launch')
        # Common documents open in the person's default without "which app?".
        self.assertEqual(self.decide([self.URI], file_default=True), 'launch')
        self.assertEqual(self.decide([self.URI], web_default=True), 'ask')

    def test_programs_are_never_handed_over(self):
        for kind in ('application/x-ms-dos-executable', 'application/x-msdownload', 'application/x-java-archive',
                     'application/x-desktop', 'application/x-shellscript', 'application/x-executable',
                     'application/vnd.appimage', 'text/x-python'):
            for sibling in (False, True):
                with self.subTest(kind=kind, sibling=sibling), self.assertRaises(ValueError):
                    self.decide([self.URI], sibling=sibling, sole_handler=True, kinds=[(kind, kind)])
        # The name alone decides too: x.exe with a picture's bytes.
        with self.assertRaises(ValueError):
            self.decide([self.URI], sibling=True, kinds=[('image/png', 'application/x-ms-dos-executable')])

    def test_installers_and_executable_content_always_ask(self):
        for kind in ('application/vnd.flatpak.ref', 'application/vnd.flatpak.repo', 'application/x-rpm',
                     'application/vnd.debian.binary-package'):
            with self.subTest(kind=kind):
                self.assertEqual(self.decide([self.URI], sibling=True, sole_handler=True, file_default=True,
                                             kinds=[(kind, kind)]), 'ask')

    def test_text_documents_open_without_a_question(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name, body in (('notes.txt', b'shopping list\n'), ('read me.md', b'# Title\n\nSome *text*.\n'),
                               ('data.csv', b'a,b\n1,2\n'), ('run.log', b'started\n'), ('main.c', b'int main(void){return 0;}\n')):
                path = Path(tmp) / name; path.write_bytes(body)
                kinds = [directory.content_types(path.as_uri())]
                with self.subTest(name=name, kinds=kinds):
                    self.assertEqual(directory.launch_decision('org.projectSuno.Notes', 'org.projectSuno.Messages.desktop',
                        [path.as_uri()], sibling=True, system_app=False, kinds=kinds, web_default=False,
                        sole_handler=False), 'launch')
                    self.assertEqual(directory.launch_decision('org.projectSuno.Notes', 'org.example.Editor.desktop',
                        [path.as_uri()], sibling=False, system_app=False, kinds=kinds, web_default=False,
                        sole_handler=False, file_default=True), 'launch')

    def test_a_script_is_refused_by_name_whatever_its_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ('tidy.sh', 'setup.py', 'start.desktop', 'go.bat'):
                path = Path(tmp) / name; path.write_bytes(b'just some words\n')
                kinds = [directory.content_types(path.as_uri())]
                with self.subTest(name=name, kinds=kinds), self.assertRaises(ValueError):
                    directory.launch_decision('org.projectSuno.Notes', 'org.projectSuno.Messages.desktop',
                        [path.as_uri()], sibling=True, system_app=False, kinds=kinds, web_default=False,
                        sole_handler=True, file_default=True)

    def test_signed_Suno_apps_open_directly(self):
        self.assertEqual(self.decide([self.URI], sibling=True), 'launch')
        self.assertEqual(self.decide([], sibling=True), 'launch')
        self.assertEqual(self.decide([], system_app=True), 'launch')
        self.assertEqual(self.decide([self.URI], system_app=True), 'ask')

    def test_a_bare_host_launch_is_refused_except_for_filer(self):
        with self.assertRaises(ValueError):
            self.decide([])
        self.assertEqual(self.decide([], caller='org.gnome.Nautilus'), 'launch')
        self.assertEqual(self.decide([self.URI], caller='org.gnome.Nautilus'), 'ask')

    def test_content_types_come_from_bytes_and_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'holiday.exe'
            path.write_bytes(bytes.fromhex('89504e470d0a1a0a') + b'\0' * 64)
            sniffed, guessed = directory.content_types(path.as_uri())
            self.assertTrue(directory.is_program(guessed), guessed)
            with self.assertRaises(ValueError):
                directory.launch_decision('org.projectSuno.Viewer', 'org.projectSuno.Photos.desktop', [path.as_uri()],
                    sibling=True, system_app=False, kinds=[(sniffed, guessed)], web_default=False, sole_handler=True)

    def test_a_sibling_is_its_signed_system_deployment(self):
        with tempfile.TemporaryDirectory() as tmp:
            entry = Path(tmp) / 'org.projectSuno.Photos.desktop'
            entry.write_text('[Desktop Entry]\nType=Application\nName=Photos\nExec=/usr/bin/flatpak run '
                             '--branch=stable --arch=x86_64 --command=photos --file-forwarding '
                             'org.projectSuno.Photos @@u %U @@\nX-Flatpak=org.projectSuno.Photos\n')
            owned = mock.patch.object(directory, '_root_owned', return_value=True)
            with owned:
                found = directory.sibling_info('org.projectSuno.Photos.desktop', resolve=lambda app: str(entry))
                self.assertIsNotNone(found)
                # Started from the system installation: a user copy of the ID never gets the documents.
                self.assertIn('flatpak run --system --branch=stable', found.get_string('Exec'))
                # Not installed system-wide from the signed Suno remote (a user-installation look-alike).
                def unsigned(app): raise RuntimeError('other-source')
                self.assertIsNone(directory.sibling_info('org.projectSuno.Photos.desktop', resolve=unsigned))
                # Not a maintained role at all.
                self.assertIsNone(directory.sibling_info('org.example.Evil.desktop', resolve=lambda app: str(entry)))
                entry.write_text(entry.read_text().replace('X-Flatpak=org.projectSuno.Photos', 'X-Flatpak=org.example.Evil'))
                self.assertIsNone(directory.sibling_info('org.projectSuno.Photos.desktop', resolve=lambda app: str(entry)))
            with mock.patch.object(directory, '_root_owned', return_value=False):
                self.assertIsNone(directory.sibling_info('org.projectSuno.Photos.desktop', resolve=lambda app: str(entry)))

    def test_the_system_installation_is_the_only_one_read(self):
        system, user = object(), object()
        flatpak = mock.Mock(); flatpak.Installation.new_system.return_value = system
        flatpak.Installation.new_user.return_value = user
        ref = mock.Mock(); ref.get_deploy_dir.return_value = '/var/lib/flatpak/app/org.projectSuno.Photos/x86_64/stable/abc'
        with mock.patch.dict(sys.modules, {'gi.repository.Flatpak': flatpak}), \
                mock.patch('gi.repository.Flatpak', flatpak, create=True), \
                mock.patch('Suno_installer.native_app_roles.installed', return_value=ref) as installed:
            path = directory._deployed_entry('org.projectSuno.Photos')
        self.assertIs(installed.call_args[0][0], system)
        self.assertEqual(path, '/var/lib/flatpak/app/org.projectSuno.Photos/x86_64/stable/abc/'
                               'export/share/applications/org.projectSuno.Photos.desktop')

    def app(self, filename='/usr/share/applications/org.example.Host.desktop', flatpak=''):
        app = mock.Mock(); app.should_show.return_value = True; app.get_filename.return_value = filename
        app.get_string.side_effect = lambda key: flatpak if key == 'X-Flatpak' else None
        return app

    def launch(self, connection, identity='org.example.Host.desktop', uris=None, *, sibling=None, kinds=None,
               sole=False, handlers=('org.example.Host.desktop', 'org.example.Chosen.desktop')):
        uris = uris or [self.URI]
        with mock.patch.object(directory, 'sibling_info', return_value=sibling), \
                mock.patch.object(directory, 'system_info', return_value=None), \
                mock.patch.object(directory, 'system_entry', return_value=True), \
                mock.patch.object(directory, 'runs_documents', return_value=False), \
                mock.patch.object(Gio.DesktopAppInfo, 'new', return_value=self.app()), \
                mock.patch.object(directory, 'content_types', return_value=kinds or PDF), \
                mock.patch.object(directory, '_describe', return_value=('application/pdf', 'report.pdf')), \
                mock.patch.object(directory, '_handlers', return_value=list(handlers)), \
                mock.patch.object(directory, '_sole_handler', return_value=sole), \
                mock.patch.object(directory, 'trusted_backend', return_value=':1.77'), \
                mock.patch.object(directory, 'validate_uris', side_effect=lambda values, *a, **k: list(values)), \
                mock.patch.object(directory, '_launch', return_value=True) as launched:
            result = directory.launch_for(connection, 'org.projectSuno.Viewer', identity, uris)
        return result, launched

    def chooser(self, choice):
        connection = mock.Mock()
        connection.call_sync.return_value = GLib.Variant('(ua{sv})', (0, {'choice': GLib.Variant('s', choice)}))
        return connection

    def test_asking_launches_only_what_the_person_chose_from_the_verified_backend(self):
        connection = self.chooser('org.example.Chosen')
        ok, launched = self.launch(connection)
        self.assertTrue(ok)
        launched.assert_called_once()
        args = connection.call_sync.call_args[0]
        self.assertEqual((args[0], args[2], args[3]), (':1.77', 'org.freedesktop.impl.portal.AppChooser', 'ChooseApplication'))
        _handle, caller, _parent, choices, options = args[4].unpack()
        self.assertEqual((caller, choices, options['last_choice']), ('org.projectSuno.Viewer', ['org.example.Host'], 'org.example.Host'))

    def test_a_choice_that_cannot_open_the_document_is_refused(self):
        with self.assertRaises(ValueError):
            self.launch(self.chooser('org.example.Evil'))

    def test_an_unverified_backend_is_never_asked(self):
        connection = self.chooser('org.example.Chosen')
        with mock.patch.object(directory, 'trusted_backend', side_effect=ValueError('not the backend')), \
                mock.patch.object(directory, '_describe', return_value=('application/pdf', 'report.pdf')), \
                mock.patch.object(directory, '_launch') as launched, self.assertRaises(ValueError):
            directory.ask_person(connection, 'org.projectSuno.Viewer', 'org.example.Host.desktop', [self.URI])
        connection.call_sync.assert_not_called(); launched.assert_not_called()

    def test_a_cancelled_or_missing_chooser_launches_nothing(self):
        for reply in (GLib.Variant('(ua{sv})', (1, {})), GLib.Error('no portal')):
            connection = mock.Mock()
            if isinstance(reply, GLib.Error): connection.call_sync.side_effect = reply
            else: connection.call_sync.return_value = reply
            with self.assertRaises(ValueError):
                self.launch(connection)

    def test_siblings_and_sole_handlers_launch_without_asking(self):
        for sibling, sole in ((self.app('/var/lib/flatpak/app/x/export/share/applications/org.projectSuno.Photos.desktop'), False),
                              (None, True)):
            connection = mock.Mock()
            ok, launched = self.launch(connection, sibling=sibling, sole=sole)
            self.assertTrue(ok); launched.assert_called_once(); connection.call_sync.assert_not_called()

    def doc(self, doc_id, name):
        return f'file:///run/user/{os.getuid()}/doc/{doc_id}/{name}'

    def grants(self, connection):
        return [call[0][4].unpack() for call in connection.call_sync.call_args_list
                if call[0][3] == 'GrantPermissions']

    def test_the_opening_sandbox_is_granted_each_document_read_only(self):
        connection = mock.Mock()
        photos = self.app('/var/lib/flatpak/app/x/export/share/applications/org.projectSuno.Photos.desktop',
                          flatpak='org.projectSuno.Photos')
        uris = [self.doc('ab12', 'a.pdf'), self.doc('cd34', 'b.pdf'), self.doc('ab12', 'a.pdf')]
        ok, launched = self.launch(connection, uris=uris, sibling=photos)
        self.assertTrue(ok); launched.assert_called_once()
        self.assertEqual(self.grants(connection), [('ab12', 'org.projectSuno.Photos', ['read']),
                                                   ('cd34', 'org.projectSuno.Photos', ['read'])])
        self.assertEqual(connection.call_sync.call_args[0][:3], directory.DOCUMENTS)

    def test_a_failed_grant_launches_nothing(self):
        connection = mock.Mock()
        connection.call_sync.side_effect = GLib.Error('no document portal')
        photos = self.app('/var/lib/flatpak/app/x/export/share/applications/org.projectSuno.Photos.desktop',
                          flatpak='org.projectSuno.Photos')
        with mock.patch.object(directory, '_launch') as launched, self.assertRaises(ValueError):
            self.launch(connection, uris=[self.doc('ab12', 'a.pdf')], sibling=photos)
        launched.assert_not_called()

    def test_the_app_the_person_picks_is_granted_before_it_starts(self):
        def call(destination, path, interface, method, parameters, *rest):
            if method == 'ChooseApplication':
                return GLib.Variant('(ua{sv})', (0, {'choice': GLib.Variant('s', 'org.example.Chosen')}))
            return GLib.Variant('()', ())
        connection = mock.Mock(); connection.call_sync.side_effect = call
        chosen = self.app('/var/lib/flatpak/exports/share/applications/org.example.Chosen.desktop', flatpak='org.example.Chosen')
        with mock.patch.object(directory, '_resolve', return_value=chosen):
            ok, launched = self.launch(connection, uris=[self.doc('ef56', 'c.pdf')])
        self.assertTrue(ok); launched.assert_called_once()
        self.assertEqual(self.grants(connection), [('ef56', 'org.example.Chosen', ['read'])])

    def test_a_host_app_and_web_addresses_need_no_grant(self):
        self.assertEqual(directory.grant_documents(mock.Mock(), self.app(), [self.doc('ab12', 'a.pdf')]), [])
        flatpak = self.app(flatpak='org.example.App')
        self.assertEqual(directory.grant_documents(mock.Mock(), flatpak, [self.WEB, 'file:///home/a/x.pdf']), [])
        self.assertIsNone(directory.document_id(self.doc('../x', 'y')))

    def test_an_absent_app_is_no_longer_installed(self):
        with mock.patch.object(Gio.DesktopAppInfo, 'new', side_effect=TypeError('constructor returned NULL')):
            self.assertIsNone(directory.desktop_app('org.example.Gone.desktop'))
            with mock.patch.object(directory, 'sibling_info', return_value=None), \
                    mock.patch.object(directory, 'system_info', return_value=None), \
                    mock.patch.object(directory, 'validate_uris', side_effect=lambda values, *a, **k: list(values)), \
                    self.assertRaisesRegex(ValueError, 'no longer installed'):
                directory.launch_for(mock.Mock(), 'org.projectSuno.Viewer', 'org.example.Gone.desktop', [])

    def test_trusted_backend_is_the_root_owned_program_in_its_unit(self):
        with tempfile.TemporaryDirectory() as tmp:
            proc = Path(tmp); base = proc / '4242'; base.mkdir(); (proc / 'self').mkdir()
            stat_line = '4242 (python3) S ' + ' '.join(['1'] * 18) + ' 777 0\n'
            (base / 'stat').write_text(stat_line)
            (base / 'ns').mkdir(); (proc / 'self/ns').mkdir()
            os.symlink('mnt:[1]', base / 'ns/mnt'); os.symlink('mnt:[1]', proc / 'self/ns/mnt')
            interpreter = os.path.realpath('/usr/bin/python3')
            def answers(owner_exe, argv1, unit, credentials=None, fds=None):
                for name in ('exe',):
                    if (base / name).is_symlink(): (base / name).unlink()
                os.symlink(owner_exe, base / 'exe')
                (base / 'cmdline').write_bytes(b'/usr/bin/python3\0' + argv1.encode() + b'\0')
                (base / 'cgroup').write_text(f'0::/user.slice/user@1000.service/app.slice/{unit}\n')
                connection = mock.Mock()
                def call(_bus, _path, _iface, method, *_a):
                    return {'StartServiceByName': GLib.Variant('(u)', (1,)), 'GetNameOwner': GLib.Variant('(s)', (':1.77',))}[method]
                connection.call_sync.side_effect = call
                values = {'ProcessID': GLib.Variant('u', 4242), **(credentials or {})}
                connection.call_with_unix_fd_list_sync.return_value = (GLib.Variant('(a{sv})', (values,)), fds)
                return connection
            owned = mock.patch.object(directory, '_root_owned', return_value=True)
            with owned:
                self.assertEqual(directory.trusted_backend(answers(interpreter, directory.PORTAL_BACKEND,
                                                                     directory.PORTAL_UNIT), proc), ':1.77')
                for case in ((interpreter, '/home/a/fake-backend', directory.PORTAL_UNIT),
                             (interpreter, directory.PORTAL_BACKEND, 'app-flatpak-org.example.Evil-1.scope'),
                             ('/usr/bin/true', directory.PORTAL_BACKEND, directory.PORTAL_UNIT)):
                    with self.subTest(case=case), self.assertRaises(ValueError):
                        directory.trusted_backend(answers(*case), proc)
                # A ProcessFD the bus names but doesn't deliver is refused.
                class Broken:
                    def get_length(self): return 1
                    def get(self, _index): raise GLib.Error('invalid descriptor')
                for fds in (None, Broken()):
                    with self.subTest(fds=fds), self.assertRaises(ValueError):
                        directory.trusted_backend(answers(interpreter, directory.PORTAL_BACKEND, directory.PORTAL_UNIT,
                                                          {'ProcessFD': GLib.Variant('h', 0)}, fds), proc)
                # Without one, the pid is held by its start time.
                starts = iter(['777', '778'])
                with mock.patch.object(directory, '_start_time', side_effect=lambda pid, proc: next(starts)), \
                        self.assertRaises(ValueError):
                    directory.trusted_backend(answers(interpreter, directory.PORTAL_BACKEND, directory.PORTAL_UNIT), proc)


class ShouldFixes(unittest.TestCase):
    URI = 'file:///run/user/1000/doc/ab12/x'

    def kinds_for(self, name, body=b'some bytes\n'):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / name; path.write_bytes(body)
            return directory.content_types(path.as_uri())

    def decide(self, kinds, **flags):
        values = dict(sibling=True, system_app=False, web_default=False, sole_handler=True, file_default=True)
        values.update(flags)
        return directory.launch_decision('org.projectSuno.Notes', 'org.projectSuno.Messages.desktop', [self.URI],
                                         kinds=[kinds], **values)

    def test_a_sibling_entry_that_is_not_flatpak_run_is_not_a_sibling(self):
        with tempfile.TemporaryDirectory() as tmp:
            entry = Path(tmp) / 'org.projectSuno.Photos.desktop'
            entry.write_text('[Desktop Entry]\nType=Application\nName=Photos\nExec=/usr/bin/photos %U\n'
                             'X-Flatpak=org.projectSuno.Photos\n')
            self.assertIsNone(directory.system_flatpak_entry(str(entry), 'org.projectSuno.Photos'))

    def test_wine_java_registry_and_ne_programs_are_refused(self):
        for kind in ('text/x-ms-regedit', 'application/x-wine-extension-msp', 'application/x-wine-extension-ini',
                     'application/x-ms-ne-executable', 'application/x-java'):
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                self.decide((kind, kind))
        for name in ('tweak.reg', 'Main.class'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.decide(self.kinds_for(name))

    def test_a_handler_that_runs_documents_is_refused(self):
        def entry(exec_line):
            app = mock.Mock(); app.get_string.return_value = exec_line; return app
        for line in ('wine start /unix %f', 'env WINEPREFIX=/x wine %f', '/usr/bin/python3 /opt/x.py %f',
                     'java -jar %f', 'sh -c "cat %f"', '/usr/bin/bash %f', 'perl %f', 'ruby %f', 'node %f',
                     'gjs %f', 'mono %f', 'dotnet %f', '', 'env'):
            with self.subTest(line=line):
                self.assertTrue(directory.runs_documents(entry(line)))
        for line in ('loupe %U', '/usr/bin/flatpak run --system org.x.Y @@u %U @@', 'org.projectSuno.NaturalVoices'):
            with self.subTest(line=line):
                self.assertFalse(directory.runs_documents(entry(line)))

    def test_packages_torrents_and_macro_documents_ask(self):
        for kind in ('application/vnd.android.package-archive', 'application/vnd.projectSuno.android-package-set',
                     'application/x-bittorrent', 'application/vnd.ms-word.document.macroEnabled.12',
                     'application/vnd.ms-excel.sheet.macroEnabled.12', 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
                     'application/vnd.ms-powerpoint.presentation.macroEnabled.12'):
            with self.subTest(kind=kind):
                self.assertEqual(self.decide((kind, kind)), 'ask')
        for name in ('game.apk', 'show.torrent', 'report.docm', 'sums.xlsm', 'slides.pptm', 'big.xlsb'):
            with self.subTest(name=name):
                self.assertEqual(self.decide(self.kinds_for(name)), 'ask')

    def test_a_planted_user_entry_never_opens_directly(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp); apps = base / 'data/applications'; apps.mkdir(parents=True)
            (apps / 'org.example.Planted.desktop').write_text(
                '[Desktop Entry]\nType=Application\nName=Planted\nExec=/usr/bin/true %U\n'
                'MimeType=application/x-Suno-planted-probe;\n')
            (base / 'config').mkdir()
            (base / 'config/mimeapps.list').write_text(
                '[Default Applications]\napplication/x-Suno-planted-probe=org.example.Planted.desktop\n')
            code = (
                'from gi.repository import Gio\n'
                'from Suno_installer import application_directory as d\n'
                'app = Gio.DesktopAppInfo.new("org.example.Planted.desktop")\n'
                'kinds = [("application/x-Suno-planted-probe", "application/x-Suno-planted-probe")]\n'
                'print(app is not None, d.system_entry(app), d._sole_handler("org.example.Planted.desktop", kinds),\n'
                '      d._file_default("org.example.Planted.desktop", kinds),\n'
                '      Gio.AppInfo.get_default_for_type("application/x-Suno-planted-probe", False).get_id())\n')
            env = {**os.environ, 'XDG_DATA_HOME': str(base / 'data'), 'XDG_CONFIG_HOME': str(base / 'config'),
                   'XDG_DATA_DIRS': str(base / 'empty'), 'XDG_CONFIG_DIRS': str(base / 'empty')}
            result = subprocess.run([sys.executable, '-B', '-c', code], env=env, text=True, capture_output=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr)
            # Found, the only handler and the person's default, yet none of it counts.
            self.assertEqual(result.stdout.split(), ['True', 'False', 'False', 'False', 'org.example.Planted.desktop'])
        self.assertEqual(directory.launch_decision('org.projectSuno.Notes', 'org.example.Planted.desktop', [self.URI],
            sibling=False, system_app=False, kinds=[('application/pdf', 'application/pdf')], web_default=False,
            sole_handler=False, file_default=False), 'ask')


class StoreLaunchers(unittest.TestCase):
    """A store app's own launcher in the person's folder may be their default."""

    def run_case(self, change):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp); (base / 'config').mkdir(); (base / 'empty').mkdir()
            code = (
                'import sys\n'
                'from pathlib import Path\n'
                'from gi.repository import Gio\n'
                'from unittest import mock\n'
                'from Suno_installer import desktop, application_directory as d\n'
                'desktop.CAPSULE_LAUNCH = "/usr/bin/true"\n'
                'change = sys.argv[1]\n'
                'if change != "no-record":\n'
                '    desktop.write_record("pdfreader", {"name": "PDF Reader", "backend": "deb"})\n'
                'with mock.patch.object(desktop, "refresh_icon_cache"), mock.patch.object(desktop, "register_handlers"):\n'
                '    path = desktop.write_launcher("pdfreader", "PDF Reader", "Reads PDFs", "pdfreader", '
                '"PdfReader", False, ["application/x-Suno-store-probe"])\n'
                'if change == "tampered":\n'
                '    path.write_text(path.read_text().replace("/usr/bin/true pdfreader %U", '
                '"/usr/bin/env pdfreader %U"))\n'
                'Path(sys.argv[2], "mimeapps.list").write_text("[Default Applications]\\n'
                'application/x-Suno-store-probe=org.projectSuno.Installed.pdfreader.desktop\\n")\n'
                'app = Gio.DesktopAppInfo.new_from_filename(str(path))\n'
                'kinds = [("application/x-Suno-store-probe", "application/x-Suno-store-probe")]\n'
                'ident = "org.projectSuno.Installed.pdfreader.desktop"\n'
                'direct = d.system_entry(app)\n'
                'print(d.launch_decision("org.projectSuno.Viewer", ident, ["file:///run/user/1/doc/ab/x"], sibling=False,\n'
                '    system_app=False, kinds=kinds, web_default=False, sole_handler=False,\n'
                '    file_default=direct and d._file_default(ident, kinds)))\n')
            env = {**os.environ, 'XDG_DATA_HOME': str(base / 'data'), 'XDG_CONFIG_HOME': str(base / 'config'),
                   'XDG_DATA_DIRS': str(base / 'empty'), 'XDG_CONFIG_DIRS': str(base / 'empty'), 'HOME': str(base)}
            result = subprocess.run([sys.executable, '-B', '-c', code, change, str(base / 'config')], env=env,
                                    text=True, capture_output=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stderr)
            return result.stdout.split()[-1]

    def test_a_genuine_store_launcher_opens_directly_as_the_default(self):
        self.assertEqual(self.run_case('genuine'), 'launch')

    def test_a_tampered_store_launcher_asks(self):
        self.assertEqual(self.run_case('tampered'), 'ask')

    def test_a_planted_launcher_without_a_record_asks(self):
        self.assertEqual(self.run_case('no-record'), 'ask')


if __name__=='__main__':unittest.main()
