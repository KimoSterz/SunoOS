from __future__ import annotations

from types import SimpleNamespace as Row
import unittest

from Suno_depot.home_selection import featured_app, Suno_shelf_apps, popular_apps


def app(slug, *, tier="listed", installs=0, unlisted=False, shots=()):
    return Row(app_id="catalog:" + slug, slug=slug, name=slug.title(), tier=tier,
               installs_total=installs, unlisted=unlisted, screenshots=shots)


class HomeSelectionTests(unittest.TestCase):
    def test_live_catalogue_without_counts_still_has_real_explore_entries(self):
        catalogue = Row(apps=(app("ari", tier="Suno"), app("blender"), app("spotify"),
                              app("hidden", unlisted=True)), featured=None)
        selected, measured = popular_apps(catalogue)
        self.assertFalse(measured)
        self.assertEqual([entry.slug for entry in selected], ["blender", "spotify"])

    def test_popular_uses_counts_and_never_shows_unlisted(self):
        catalogue = Row(apps=(app("blender", installs=5), app("spotify", installs=20),
                              *(app(f"ranked-{index}", installs=10 + index)
                                for index in range(6)),
                              app("hidden", installs=500, unlisted=True)), featured=None)
        selected, measured = popular_apps(catalogue)
        self.assertTrue(measured)
        self.assertEqual([entry.slug for entry in selected][0], "spotify")
        self.assertEqual([entry.slug for entry in selected][-1], "blender")
        self.assertNotIn("hidden", [entry.slug for entry in selected])

    def test_partial_counts_fill_explore_without_claiming_popularity(self):
        catalogue = Row(apps=(app("blender", installs=5), app("spotify"),
                              app("signal"), app("vlc")), featured=None)
        selected, measured = popular_apps(catalogue)
        self.assertFalse(measured)
        self.assertEqual([entry.slug for entry in selected],
                         ["blender", "spotify", "signal", "vlc"])

    def test_featured_falls_back_to_real_tide_entry(self):
        tide = app("tide", tier="Suno")
        catalogue = Row(apps=(app("ari", tier="Suno"), tide), featured=None)
        self.assertIs(featured_app(catalogue), tide)

    def test_Suno_shelf_uses_visible_catalogue_entries_in_editorial_order(self):
        catalogue = Row(apps=(app("ari", tier="Suno"), app("photos", tier="Suno"),
                              app("tide", tier="Suno"), app("filer", tier="Suno"),
                              app("hidden", tier="Suno", unlisted=True)), featured=None)
        self.assertEqual([entry.slug for entry in Suno_shelf_apps(catalogue)],
                         ["tide", "photos", "filer", "ari"])


if __name__ == "__main__":
    unittest.main()
