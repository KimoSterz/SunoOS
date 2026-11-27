#!/usr/bin/env python3
"""Check installed CSS, not only the Sass inputs Meson may not regenerate."""
import re
import sys
from pathlib import Path
for name in sys.argv[1:]:
    css = Path(name).read_text()
    assert '.Suno-search-field:focus' not in css, f'{name}: stale focus stroke'
    field = re.search(r'\.Suno-search-dialog \.Suno-search-field\s*\{([^}]+)', css)
    assert field, f'{name}: missing search field'
    if 'high-contrast' not in name:
        assert re.search(r'\bborder:\s*none\s*;', field[1]), f'{name}: field border remains'
    else:
        shared = re.search(r'\.Suno-search-dialog \.Suno-search-field,[^{]+\{([^}]+)', css)
        assert shared and 'border: 2px solid' in shared[1], 'High contrast outline lost'
print('Packaged search theme: PASS')
