# SPDX-License-Identifier: MPL-2.0
"""Suno background activity: the session service behind ADR-033.

Apps declare a small background agent; this service decides whether it may
run, starts it under strict limits, wakes it when something happens, and
reports what it is doing to Settings and the dock.
"""

__version__ = "0.1.0"

BUS_NAME = "org.projectSuno.Background1"
OBJECT_PATH = "/org/projectSuno/Background1"
INTERFACE = "org.projectSuno.Background1"
INTERFACE_VERSION = 3

AGENT_INTERFACE = "org.projectSuno.BackgroundAgent1"
AGENT_OBJECT_PATH = "/org/projectSuno/BackgroundAgent1"

ERROR_PREFIX = "org.projectSuno.Background1.Error."
