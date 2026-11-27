# SPDX-License-Identifier: Apache-2.0
"""Unit transport declares the real native test process, never a sandbox."""
import os
from types import SimpleNamespace
class NativeSender:
    """GetConnectionCredentials as a bus without ProcessFD reports this process."""
    uid, extra, fds = None, {}, None

    def pid(self):
        return os.getpid()

    def call_with_unix_fd_list_sync(self, _name, _path, _interface, method, *args):
        if method != 'GetConnectionCredentials':
            raise AssertionError('Unexpected identity query')
        values = {'UnixUserID': os.getuid() if self.uid is None else self.uid, 'ProcessID': self.pid(), **self.extra}
        return SimpleNamespace(unpack=lambda: (values,)), self.fds
