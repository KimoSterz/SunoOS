#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""The fake Hub (tests/fake_hub.py) as a server for the ADR-057 two-VM proof, with the test token key."""
import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from cryptography.hazmat.primitives import serialization  # noqa: E402

from fake_hub import FakeHub, serve  # noqa: E402
from Suno_connect_sync.apps_api import tokens as tk  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, required=True)
parser.add_argument("--token-key", required=True)
args = parser.parse_args()
hub = FakeHub()
hub.token_key = serialization.load_pem_private_key(Path(args.token_key).read_bytes(), None)
n = hub.token_key.public_key().public_numbers()
hub.token_key_id = tk.key_id(tk.spki_pss(n.n, n.e)).hex()
serve(hub, args.port)
while True:
    time.sleep(3600)
