# SPDX-License-Identifier: Apache-2.0

Name:           Suno-backgrounds
Version:        0.2.0
Release:        1.Suno.4%{?dist}
Summary:        Project Suno desktop backgrounds
License:        LicenseRef-Suno-Project-Asset
URL:            https://project-luma.local/
Source0:        prism.png
Source2:        Suno-backgrounds.xml
Source3:        README.md
Source4:        Suno-prism.png
Source5:        meadow.png
Source6:        ember.png
BuildArch:      noarch

%description
Installs Project Suno's desktop background collection and its GNOME wallpaper
picker metadata. Desktop selection remains an unlocked GNOME preference.

%prep

%build

%install
install -D -m 0644 %{SOURCE0} \
  %{buildroot}%{_datadir}/backgrounds/Suno/prism.png
install -D -m 0644 %{SOURCE2} \
  %{buildroot}%{_datadir}/gnome-background-properties/Suno-backgrounds.xml
install -D -m 0644 %{SOURCE3} \
  %{buildroot}%{_pkgdocdir}/README.md
install -D -m 0644 %{SOURCE4} \
  %{buildroot}%{_datadir}/backgrounds/Suno/Suno-prism.png
install -D -m 0644 %{SOURCE5} \
  %{buildroot}%{_datadir}/backgrounds/Suno/meadow.png
install -D -m 0644 %{SOURCE6} \
  %{buildroot}%{_datadir}/backgrounds/Suno/ember.png

%files
%doc %{_pkgdocdir}/README.md
%{_datadir}/backgrounds/Suno/prism.png
%{_datadir}/backgrounds/Suno/meadow.png
%{_datadir}/backgrounds/Suno/ember.png
%{_datadir}/backgrounds/Suno/Suno-prism.png
%{_datadir}/gnome-background-properties/Suno-backgrounds.xml

%changelog
* Fri Sep 11 2026 Project Suno <builds@project-suno.local> - 0.2.0-1.Suno.4
- Offer Prism, Meadow and Ember through the GNOME wallpaper picker
- Replace the Prism asset with the smaller supplied encoding of the same image
- Retain the handheld compatibility asset at its existing path

* Fri Sep 11 2026 Project Suno <builds@project-suno.local> - 0.2.0-1.Suno.3
- Offer only the default Prism wallpaper; retain the handheld compatibility asset
- Remove the legacy Mesh asset from installed systems

* Wed Sep 02 2026 Project Suno <builds@project-suno.local> - 0.2.0-1.Suno.2
- Ship the handheld Prism encoding at its existing Suno-prism.png path alongside
  the desktop prism.png so one package serves the phone compositor, greeter and
  desktop picker

* Sat Aug 29 2026 Project Suno <builds@project-suno.local> - 0.2.0-1.Suno.1
- Add Prism as the default while retaining Suno Mesh Gradient in the collection

* Fri Aug 07 2026 Project Suno <builds@project-suno.local> - 0.1.0-1.Suno.2
- Replace the oversized PNG source with the selected 8K JPEG

* Fri Aug 07 2026 Project Suno <builds@project-suno.local> - 0.1.0-1.Suno.1
- Package the original Suno Mesh Gradient and GNOME picker metadata
