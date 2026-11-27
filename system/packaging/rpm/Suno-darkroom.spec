# SPDX-License-Identifier: Apache-2.0

Name:           Suno-darkroom
Version:        0.1.0
Release:        1.Suno.11.creator20261004.1%{?dist}
Summary:        Project Suno native non-destructive image editor
License:        Apache-2.0 AND ISC
URL:            https://projectluma.org/apps/darkroom
BuildArch:      noarch

Source0:        Suno-darkroom.tar.gz
Source1:        LICENSE.md

BuildRequires:  adwaita-icon-theme
BuildRequires:  appstream
BuildRequires:  dbus-daemon
BuildRequires:  desktop-file-utils
BuildRequires:  gtk4
BuildRequires:  libadwaita
BuildRequires:  Suno-developer-platform >= 0.1.0-1.Suno.4
BuildRequires:  python3-devel
BuildRequires:  python3-gobject-base
BuildRequires:  python3-pillow
BuildRequires:  python3-numpy
BuildRequires:  LibRaw
# %%check resolves every glyph the window shows; SunoUI's come from Prairie.
BuildRequires:  prairie-icon-theme
BuildRequires:  shared-mime-info
BuildRequires:  xorg-x11-server-Xvfb
Requires:       google-figtree-fonts
Requires:       ibm-plex-mono-fonts
Requires:       gtk4 >= 4.22
Requires:       libadwaita >= 1.9
Requires:       Suno-developer-platform >= 0.1.0-1.Suno.4
Requires:       python3 >= 3.11
Requires:       python3-gobject-base
Requires:       python3-pillow
Requires:       python3-numpy
Requires:       LibRaw

%description
Darkroom is Project Suno's source-owned adaptive image editor. It stores a
versioned non-destructive recipe, preserves and relinks originals, renders real
image previews, and exports full-resolution delivery files in the background.

%prep
%autosetup -n Suno-darkroom
cp %{SOURCE1} LICENSE.md

%build

%install
install -d %{buildroot}%{python3_sitelib}/Suno_darkroom
install -m 0644 Suno_darkroom/*.py %{buildroot}%{python3_sitelib}/Suno_darkroom/
install -D -m 0755 bin/Suno-darkroom %{buildroot}%{_bindir}/Suno-darkroom
install -D -m 0644 style/darkroom.css %{buildroot}%{_datadir}/Suno-darkroom/darkroom.css
install -D -m 0644 data/org.projectSuno.Darkroom.desktop \
  %{buildroot}%{_datadir}/applications/org.projectSuno.Darkroom.desktop
install -D -m 0644 data/org.projectSuno.Darkroom.metainfo.xml \
  %{buildroot}%{_metainfodir}/org.projectSuno.Darkroom.metainfo.xml
install -D -m 0644 data/org.projectSuno.Darkroom.mime.xml \
  %{buildroot}%{_datadir}/mime/packages/org.projectSuno.Darkroom.xml
install -D -m 0644 data/org.projectSuno.Darkroom.svg \
  %{buildroot}%{_datadir}/icons/hicolor/scalable/apps/org.projectSuno.Darkroom.svg
install -D -m 0644 Suno-app.toml %{buildroot}%{_datadir}/Suno-darkroom/Suno-app.toml
# The crop, healing, brush-mask and linear-gradient tool glyphs, which neither
# Adwaita nor the Suno Platform provides. crop, heal and brush are Lucide
# geometry (ISC); linear-gradient is Suno's own.
for glyph in crop heal brush linear-gradient; do
  install -D -m 0644 data/icons/hicolor/scalable/actions/Suno-darkroom-$glyph-symbolic.svg \
    %{buildroot}%{_datadir}/icons/hicolor/scalable/actions/Suno-darkroom-$glyph-symbolic.svg
done
install -d %{buildroot}%{_docdir}/Suno-darkroom
install -m 0644 README.md docs/*.md %{buildroot}%{_docdir}/Suno-darkroom/

%check
# The window's SunoUI glyphs come from the Prairie icon theme, which is the
# desktop's icon theme on Suno but not the builder's; select it the same way.
export XDG_CONFIG_HOME=$PWD/check-config
install -d "$XDG_CONFIG_HOME/gtk-4.0"
printf '[Settings]\ngtk-icon-theme-name=Prairie\n' >"$XDG_CONFIG_HOME/gtk-4.0/settings.ini"
desktop-file-validate %{buildroot}%{_datadir}/applications/org.projectSuno.Darkroom.desktop
appstreamcli validate --no-net %{buildroot}%{_metainfodir}/org.projectSuno.Darkroom.metainfo.xml
PYTHONPATH=%{buildroot}%{python3_sitelib} python3 -m compileall -q \
  %{buildroot}%{python3_sitelib}/Suno_darkroom
PYTHONPATH=%{buildroot}%{python3_sitelib} python3 -m unittest discover -s tests -p 'test_*.py' -v
runtime_dir=$(mktemp -d)
install -d -m 0700 "$runtime_dir/runtime"
for contract in \
  '1380x880 false true windowed pointer' \
  '1024x700 false true windowed pointer' \
  '500x800 true true windowed touch' \
  '360x294 true false fullscreen-mobile touch'; do
  set -- $contract
  geometry=$1 compact=$2 decorated=$3 presentation=$4 input=$5
  compact_arg=()
  if [ "$compact" = true ]; then compact_arg=(--compact); fi
  xvfb-run -a --server-args="-screen 0 ${geometry}x24" \
    dbus-run-session -- \
    env GSK_RENDERER=cairo G_DEBUG=fatal-warnings GTK_A11Y=none GTK_USE_PORTAL=0 \
      XDG_RUNTIME_DIR="$runtime_dir/runtime" \
      XDG_DATA_DIRS=%{buildroot}%{_datadir}:%{_datadir} \
      SUNO_PRESENTATION_MODE="$presentation" SUNO_INPUT_MODE="$input" \
      SUNO_DARKROOM_STYLE_PATH=%{buildroot}%{_datadir}/Suno-darkroom/darkroom.css \
      PYTHONPATH=%{buildroot}%{python3_sitelib} \
    python3 tests/runtime_smoke.py --decorated "$decorated" "${compact_arg[@]}"
done
# The crop frame maps onto the photo, not the gray margin around it, and the
# crop tool frames the whole photo.
xvfb-run -a --server-args="-screen 0 1380x900x24" \
  dbus-run-session -- \
  env GSK_RENDERER=cairo GTK_A11Y=none GTK_USE_PORTAL=0 \
    XDG_RUNTIME_DIR="$runtime_dir/runtime" \
    XDG_DATA_DIRS=%{buildroot}%{_datadir}:%{_datadir} \
    SUNO_DARKROOM_STYLE_PATH=%{buildroot}%{_datadir}/Suno-darkroom/darkroom.css \
    DARKROOM_CROP_OUTPUT=%{_builddir}/crop-frame-output \
    PYTHONPATH=%{buildroot}%{python3_sitelib} \
  python3 tests/crop_frame_runtime.py

# Exercise the current responsive fixture controls in the same installed kit.
xvfb-run -a --server-args="-screen 0 1600x1000x24" dbus-run-session -- \
  env GSK_RENDERER=cairo GTK_A11Y=none GTK_USE_PORTAL=0 \
    PYTHONPATH=%{buildroot}%{python3_sitelib} \
    SUNO_DARKROOM_STYLE_PATH=%{buildroot}%{_datadir}/Suno-darkroom/darkroom.css \
  python3 tests/runtime_v71_controls.py

%post
update-desktop-database %{_datadir}/applications >/dev/null 2>&1 || :
update-mime-database %{_datadir}/mime >/dev/null 2>&1 || :
gtk-update-icon-cache --force --quiet %{_datadir}/icons/hicolor >/dev/null 2>&1 || :

%postun
update-desktop-database %{_datadir}/applications >/dev/null 2>&1 || :
update-mime-database %{_datadir}/mime >/dev/null 2>&1 || :
gtk-update-icon-cache --force --quiet %{_datadir}/icons/hicolor >/dev/null 2>&1 || :

%files
%license LICENSE.md data/icons/LUCIDE-LICENSE.txt
%{_bindir}/Suno-darkroom
%{python3_sitelib}/Suno_darkroom/
%{_datadir}/Suno-darkroom/
%{_datadir}/applications/org.projectSuno.Darkroom.desktop
%{_metainfodir}/org.projectSuno.Darkroom.metainfo.xml
%{_datadir}/mime/packages/org.projectSuno.Darkroom.xml
%{_datadir}/icons/hicolor/scalable/apps/org.projectSuno.Darkroom.svg
%{_datadir}/icons/hicolor/scalable/actions/Suno-darkroom-crop-symbolic.svg
%{_datadir}/icons/hicolor/scalable/actions/Suno-darkroom-heal-symbolic.svg
%{_datadir}/icons/hicolor/scalable/actions/Suno-darkroom-brush-symbolic.svg
%{_datadir}/icons/hicolor/scalable/actions/Suno-darkroom-linear-gradient-symbolic.svg
%doc %{_docdir}/Suno-darkroom/

%changelog
* Sat Sep 26 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.11.creator20261004.1
- Darkroom wears the approved app icon.

* Fri Sep 18 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.8
- The crop frame sits on the photo. It was laid over the whole canvas, so on
  any photo whose shape differs from the canvas the frame, its handles and
  its shade covered the gray margin, and the handles grabbed the wrong edge.
  The frame, handles, retouch points and the eyedropper now map onto the
  photo's own rectangle, the frame is drawn inside the crop with Lightroom-
  style corner and edge bars, and the crop tool shows the whole photo while
  framing instead of drawing the frame over the already cropped preview.
- Temperature and tint keep clipped highlights white. Each channel was
  scaled and clamped on its own, so cooling a photo turned a clipped sun
  cyan (red down, blue pinned at full scale). Pixels whose channels are all
  near full scale now hold their neutral, fading in from 92%, and a channel
  pushed past full scale rolls the pixel toward white instead of shifting
  its hue. Mid-tones change exactly as before.

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.7
- Ship the approved 6 September canvas artwork as the bundled application icon.
- Release lineage: 1.Suno.4 is the ceiling in the rpm pool and the published
  nightlies, but 1.Suno.5 and 1.Suno.6 exist as stray rpmbuild output under
  /home/nick/shell-menu-contract with no spec on any branch. This clears both
  rather than risk a device that saw one of them reading this as a downgrade.

* Tue Sep 15 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.4
- Ship the crop, healing, brush-mask and linear-gradient tool glyphs

* Mon Sep 14 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.3
- Open context menus at the pointer instead of the window corner

* Fri Sep 04 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.2
- Darkroom is the Application Kit's window; the filmstrip appears with its first image

* Sun Aug 30 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- Add native adaptive Darkroom production foundation
- Add non-destructive documents, real preview pipeline, masks, recovery, and export
