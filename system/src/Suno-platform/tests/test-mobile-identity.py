"""Phone chrome follows the same device marker that mobile composition writes."""
import os
from pathlib import Path
import unittest
from unittest.mock import patch

from Suno_appkit.SunoUI import mobile_form_factor


class MobileIdentity(unittest.TestCase):
    def test_device_identity_and_override(self):
        cases = [
            ({"SUNO_DEVICE_CLASS": "handheld"}, True),
            ({"SUNO_DEVICE_CLASS": " HandHeld "}, True),
            ({"SUNO_DEVICE_CLASS": "desktop"}, False),
            ({"SUNO_DEVICE_CLASS": "tablet"}, False),
            ({"SUNO_DEVICE_CLASS": "handheld", "SUNO_FORM_FACTOR": "desktop"}, False),
            ({"SUNO_DEVICE_CLASS": "desktop", "SUNO_FORM_FACTOR": "phone"}, True),
            ({"SUNO_DEVICE_CLASS": "desktop", "SUNO_FORM_FACTOR": " Handset "}, True),
        ]
        for env, expected in cases:
            with self.subTest(env=env), patch.dict(os.environ, env, clear=True):
                self.assertEqual(mobile_form_factor(), expected)

    def test_image_marker_and_legacy_chassis(self):
        for marker, chassis, expected in [
            ("handheld\n", "", True),
            ("desktop\n", "CHASSIS=handset\n", False),
            ("tablet\n", "CHASSIS=handset\n", False),
            (None, 'CHASSIS="handset"\n', True),
            ("unknown", "CHASSIS=desktop\n", False),
            (None, None, False),
        ]:
            def read(path, **kwargs):
                value = marker if str(path) == "/etc/Suno-device-class" else chassis
                if value is None:
                    raise FileNotFoundError(path)
                return value
            with self.subTest(marker=marker, chassis=chassis), \
                    patch.dict(os.environ, {}, clear=True), \
                    patch.object(Path, "read_text", read):
                self.assertEqual(mobile_form_factor(), expected)

    def test_tv_posture_is_never_a_phone(self):
        for env in ({"SUNO_POSTURE": "tv", "SUNO_DEVICE_CLASS": "handheld"},
                    {"SUNO_POSTURE": "tv", "SUNO_FORM_FACTOR": "phone"}):
            with self.subTest(env=env), patch.dict(os.environ, env, clear=True):
                self.assertFalse(mobile_form_factor())
        with patch.dict(os.environ, {"SUNO_POSTURE": "desktop", "SUNO_DEVICE_CLASS": "handheld"}, clear=True):
            self.assertTrue(mobile_form_factor())


if __name__ == "__main__":
    unittest.main()
