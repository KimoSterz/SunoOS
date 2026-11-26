# SPDX-License-Identifier: Apache-2.0
"""Launches close together share one Prepare; none sees the repair screen."""
import threading
import unittest
from unittest import mock
from gi.repository import GLib
from luma_installer import app_data_broker
from luma_installer.app_data_broker import BUS, Broker

APP = 'org.projectluma.Depot'


class Invocation:
    def __init__(self):
        self.value = self.error = None

    def return_value(self, value):
        self.value = value.unpack()

    def return_dbus_error(self, name, message):
        self.error = (name, message)


class ConcurrentLaunches(unittest.TestCase):
    def setUp(self):
        self.broker = Broker.__new__(Broker)
        self.broker.jobs = {}
        self.broker.turn = threading.Lock()
        self.release = threading.Event()
        self.started = threading.Event()
        self.runs = []
        def migrate(app, cancelled):
            self.runs.append(app)
            self.started.set()
            self.release.wait(5)
            if cancelled(): raise app_data_broker.MigrationError('cancelled')
        patches = [
            mock.patch.object(app_data_broker, 'authenticate', side_effect=lambda _c, sender: APP),
            mock.patch.object(app_data_broker, '_native_owner', return_value=''),
            mock.patch.object(app_data_broker, 'migrate', side_effect=migrate),
            mock.patch.object(app_data_broker.Gio, 'bus_watch_name_on_connection', return_value=0),
            mock.patch.object(app_data_broker.Gio, 'bus_unwatch_name'),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def prepare(self, sender):
        invocation = Invocation()
        self.broker._call(None, sender, None, None, 'Prepare', None, invocation)
        return invocation

    def settle(self, *invocations):
        context = GLib.MainContext.default()
        for _ in range(500):
            if all(i.value or i.error for i in invocations): return
            context.iteration(False)
            threading.Event().wait(0.01)
        self.fail('Prepare never answered')

    def test_second_launch_waits_for_the_first_result(self):
        first = self.prepare(':1.10')
        self.assertTrue(self.started.wait(5))
        second = self.prepare(':1.11')
        self.assertIsNone(second.error)
        self.release.set()
        self.settle(first, second)
        self.assertEqual((first.value, second.value), (('ready',), ('ready',)))
        self.assertEqual(self.runs, [APP])
        self.assertEqual(self.broker.jobs, {})

    def test_a_launch_after_the_first_finished_prepares_again(self):
        self.release.set()
        self.settle(self.prepare(':1.10'))
        self.settle(self.prepare(':1.11'))
        self.assertEqual(self.runs, [APP, APP])

    def test_cancel_by_one_caller_leaves_the_other_waiting(self):
        first = self.prepare(':1.10')
        self.assertTrue(self.started.wait(5))
        second = self.prepare(':1.11')
        cancel = Invocation()
        self.broker._call(None, ':1.10', None, None, 'Cancel', None, cancel)
        self.assertEqual(cancel.value, ())
        self.assertEqual(first.error[0], BUS + '.Refused')
        self.release.set()
        self.settle(second)
        self.assertEqual(second.value, ('ready',))

    def test_cancel_by_every_caller_stops_the_migration(self):
        first = self.prepare(':1.10')
        self.assertTrue(self.started.wait(5))
        self.broker._call(None, ':1.10', None, None, 'Cancel', None, Invocation())
        self.release.set()
        context = GLib.MainContext.default()
        for _ in range(500):
            if not self.broker.jobs: break
            context.iteration(False)
            threading.Event().wait(0.01)
        self.assertEqual(self.broker.jobs, {})
        self.assertEqual(first.error[0], BUS + '.Refused')


if __name__ == '__main__':
    unittest.main()
