# SPDX-License-Identifier: MPL-2.0
"""One journal entry per system software change, for Suno Vitals.

Every install, removal and update started from dnf, yum, apt or snap on Suno
is written to the system journal with a catalogued MESSAGE_ID and the fields
Suno Vitals uses (``SUNO_VITALS_KIND``, ``SUNO_VITALS_DETAILS``), so
``journalctl MESSAGE_ID=a08437fa35fc4db9a55f26f08c3e9847`` lists every change
with who asked for it. Logging never blocks the change.
"""

from __future__ import annotations

import json
import os
import subprocess

MESSAGE_ID = "a08437fa35fc4db9a55f26f08c3e9847"
LOGGER = "/usr/bin/logger"


def log(action: str, details: dict, runner=subprocess.run) -> None:
    person = os.environ.get("SUDO_USER") or os.environ.get("USER") or str(os.getuid())
    packages = details.get("packages") or []
    result = details.get("result", "")
    summary = f"{person} ran {details.get('command', action)}"
    if packages:
        summary += " for " + ", ".join(str(p) for p in packages)
    if result:
        summary += f": {result}"
    fields = {
        "MESSAGE": summary,
        "MESSAGE_ID": MESSAGE_ID,
        "SYSLOG_IDENTIFIER": "Suno-install-commands",
        "PRIORITY": "3" if result == "failed" else "5",
        "SUNO_VITALS_KIND": "system-software-change",
        "SUNO_VITALS_UNIT": f"{action}",
        "SUNO_VITALS_DETAILS": json.dumps({"action": action, "person": person, **details}, sort_keys=True),
        "SUNO_SOFTWARE_ACTION": action,
        "SUNO_SOFTWARE_PACKAGES": " ".join(str(p) for p in packages),
        "SUNO_SOFTWARE_RESULT": result,
    }
    payload = "".join(f"{key}={str(value).replace(chr(10), ' ')}\n" for key, value in fields.items())
    try:
        runner([LOGGER, "--journald"], input=payload, text=True, stdout=subprocess.DEVNULL,
               stderr=subprocess.DEVNULL, timeout=10)
    except Exception:
        pass
