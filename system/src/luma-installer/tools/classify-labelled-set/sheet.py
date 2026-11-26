#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""A labelling sheet for corpus.json: id, section and summary only (no classifier output).

    sheet.py corpus.json > sheet.tsv
"""
import json
import sys

for row in json.load(open(sys.argv[1]))["rows"]:
    if row.get("missing"):
        print(f"{row['id']}\tMISSING\t")
        continue
    fields = row["package"]["fields"]
    section = fields.get("Section") or fields.get("Group") or ""
    print(f"{row['id']}\t{section}\t{fields.get('Description', '')[:90]}")
