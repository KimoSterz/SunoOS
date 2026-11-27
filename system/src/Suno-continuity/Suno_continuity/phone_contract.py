# SPDX-License-Identifier: Apache-2.0
"""Public Phone client wire constants; no host account or transport owner."""
import re
BUS = 'org.projectSuno.Connect1'
PATH = '/org/projectSuno/Connect'
DIGEST = re.compile(r'[0-9a-f]{64}\Z')
IDENTIFIER = re.compile(r'[0-9a-f]{32}\Z')
