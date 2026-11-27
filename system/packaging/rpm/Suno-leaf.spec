# SPDX-License-Identifier: Apache-2.0

Name:           Suno-leaf
Version:        0.1.0
Release:        1.Suno.13.creator20261007.1%{?dist}
Summary:        Book reader and read-aloud narrator for Project Suno
License:        Apache-2.0 AND MIT AND ISC
URL:            https://projectluma.org/apps/leaf
Source0:        Suno-leaf.tar.gz
Source1:        LICENSE.md

BuildArch:      noarch
BuildRequires:  python3-devel >= 3.11
BuildRequires:  desktop-file-utils
BuildRequires:  libappstream-glib
# The cover tests draw through the real PyGObject, GTK and Pango on a display.
BuildRequires:  gtk4 >= 4.18
BuildRequires:  python3-gobject
BuildRequires:  xorg-x11-server-Xvfb
# The startup check runs the real application with its folder monitors refused.
BuildRequires:  dbus-daemon
BuildRequires:  libadwaita >= 1.7
BuildRequires:  Suno-developer-platform >= 0.1.0-1.Suno.102.creator20261007.1
BuildRequires:  webkitgtk6.0
Requires:       python3 >= 3.11
Requires:       python3-gobject
Requires:       gtk4 >= 4.18
Requires:       libadwaita >= 1.7
Requires:       webkitgtk6.0
Requires:       Suno-developer-platform >= 0.1.0-1.Suno.102.creator20261007.1
Requires:       adobe-source-serif-pro-fonts
Requires:       google-figtree-fonts
Requires:       libsecret
Recommends:     python3-speechd
Recommends:     speech-dispatcher

%description
Leaf holds a library of books, shows one page at a time and reads the book
aloud. Every figure it shows is derived from one saved position per book;
highlights and notes follow whole sentences; the narrator speaks a sentence at a
time through speech-dispatcher and publishes an MPRIS player while it reads.
It bundles epubcfi.js from foliate-js (MIT) and Lucide icon geometry (ISC).

%prep
%autosetup -n Suno-leaf/src/Suno-leaf
cp %{SOURCE1} LICENSE.md

%build
%{python3} -m py_compile Suno_leaf/*.py

%install
install -d %{buildroot}%{python3_sitelib}/Suno_leaf
install -m 0644 Suno_leaf/*.py %{buildroot}%{python3_sitelib}/Suno_leaf/
install -Dm 0755 data/org.projectSuno.Leaf.in %{buildroot}%{_bindir}/org.projectSuno.Leaf
install -Dm 0644 data/org.projectSuno.Leaf.desktop %{buildroot}%{_datadir}/applications/org.projectSuno.Leaf.desktop
install -d %{buildroot}%{_datadir}/dbus-1/services
sed 's|@bindir@|%{_bindir}|g' data/org.projectSuno.Leaf.service.in \
  >%{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.Leaf.service
chmod 0644 %{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.Leaf.service
install -Dm 0644 data/org.projectSuno.Leaf.metainfo.xml %{buildroot}%{_metainfodir}/org.projectSuno.Leaf.metainfo.xml
install -Dm 0644 data/org.projectSuno.Leaf.svg %{buildroot}%{_datadir}/icons/hicolor/scalable/apps/org.projectSuno.Leaf.svg
install -Dm 0644 data/leaf.css %{buildroot}%{_datadir}/leaf/leaf.css
cp -a data/reader %{buildroot}%{_datadir}/leaf/reader
cp -a data/icons %{buildroot}%{_datadir}/leaf/icons
desktop-file-validate %{buildroot}%{_datadir}/applications/org.projectSuno.Leaf.desktop

%check
# D-Bus activation starts the binary this package installed, wherever the
# prefix put it, and no template placeholder survives.
grep -Fxq 'Name=org.projectSuno.Leaf' %{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.Leaf.service
grep -Fxq 'Exec=%{_bindir}/org.projectSuno.Leaf --gapplication-service' %{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.Leaf.service
if grep -Fq '@' %{buildroot}%{_datadir}/dbus-1/services/org.projectSuno.Leaf.service; then
  echo 'unsubstituted placeholder in org.projectSuno.Leaf.service' >&2
  exit 1
fi
LEAF_REQUIRE_DISPLAY_TESTS=1 PYTHONPATH=$PWD xvfb-run -a %{python3} -m unittest discover -s tests -t . -v
appstream-util validate-relax --nonet data/org.projectSuno.Leaf.metainfo.xml
timeout --kill-after=5s 60s dbus-run-session -- xvfb-run -a env GSK_RENDERER=cairo GTK_A11Y=none PYTHONPATH=$PWD \
  %{python3} tests/runtime_library_startup.py
dbus-run-session -- xvfb-run -a env GSK_RENDERER=cairo GTK_A11Y=none PYTHONPATH=$PWD \
  %{python3} tests/runtime_monitor_refused.py
dbus-run-session -- xvfb-run -a env GSK_RENDERER=cairo GTK_A11Y=none PYTHONPATH=$PWD \
  %{python3} tests/runtime_reader_pages.py
timeout --kill-after=5s 75s dbus-run-session -- xvfb-run -a env GSK_RENDERER=cairo GTK_A11Y=none PYTHONPATH=$PWD \
  %{python3} tests/runtime_reader_touch.py

timeout --kill-after=5s 45s dbus-run-session -- xvfb-run -a env GSK_RENDERER=cairo GTK_A11Y=none PYTHONPATH=$PWD \
  %{python3} tests/voice_offer_runtime.py

%files
%license LICENSE.md data/reader/vendor/foliate-js/LICENSE
%{_bindir}/org.projectSuno.Leaf
%{python3_sitelib}/Suno_leaf/
%{_datadir}/applications/org.projectSuno.Leaf.desktop
%{_datadir}/dbus-1/services/org.projectSuno.Leaf.service
%{_metainfodir}/org.projectSuno.Leaf.metainfo.xml
%{_datadir}/icons/hicolor/scalable/apps/org.projectSuno.Leaf.svg
%{_datadir}/leaf/

%changelog
* Wed Oct 07 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.12.creator20261007.1
- Bound optional archive/resource budgets for read-only Viewer sessions.

* Tue Oct 06 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.10.creator20261006.1
- Gate the voice offer on the real installed Natural Voices manager; preserve Basic Voice.
- Refresh real installed voices and reconnect after the speech service restarts.

* Mon Oct 05 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.8.creator20261005.1
- Defer WebKit, speech and reader MPRIS until opening a book.
- Populate the shared app menu and use the shared library empty state.
- Remove duplicate search inset and the standalone sidebar control.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.7.creator20261004.1
- SunoUI update from the Prairie rollout review.

* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.5
- SunoUI port: the app is rebuilt on SunoUI to match the approved design.

* Fri Sep 18 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.4
- A chapter opener in its own section no longer reads as a blank page: Next
  shows at rest with a quiet Continue, and page numbers come from the book's
  words per page, never the opener's (Steve Jobs showed page 3,945 of ~600)
- XHTML using HTML entities or a bare ampersand is shown whole instead of
  stopping at WebKit's first XML error
- The page's paper theme owns every word's colour, so a publisher's black
  cannot vanish on Night
- A spread with nothing drawn is reported to the journal with its layout
- Opening a picture-only first page records a position; a book on Reading
  now is never labelled New; a position past the book's end no longer breaks
  the library
- Authors in natural order, main titles on the shelf, the kit's standard
  segmented control; requires the platform whose sidebars show selection

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.3
- Draw generated covers again: Figtree at weight 650 through Pango's description syntax
- Start and keep the library correct when a folder cannot be watched
- Generate the D-Bus service file from the install prefix

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Calibre content server and OPDS libraries under Where: stream a book or download it to keep
- Reading from other devices arrives through Suno Connect, with an offer to continue where another device is
- A book's right-click menu: download to keep, want to read, finished, collections

* Sat Sep 12 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- Library with Continue reading, shelf, search, sort and availability
- EPUB pages in CSS columns with one or two pages, four page themes and text settings
- Contents, sentence highlights, notes and bookmarks
- Read aloud a sentence at a time with speeds, voices, a sleep timer and MPRIS
