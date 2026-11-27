# SPDX-License-Identifier: Apache-2.0
# SunoUI-conform: loads the capture harness into the app process, and only
# when SUNOUI_CONFORM_DUMP is set. Lives in a scratch copy of the preview.
import os

if os.environ.get("SUNOUI_CONFORM_DUMP"):
    import SunoUI_conform_harness

    SunoUI_conform_harness.install()
