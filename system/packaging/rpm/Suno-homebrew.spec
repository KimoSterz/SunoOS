# SPDX-License-Identifier: Apache-2.0
Name:           Suno-homebrew
Version:        0.1.0
Release:        1.Suno.1%{?dist}
Summary:        Homebrew, ready the first time brew is typed
License:        Apache-2.0
URL:            https://projectluma.org
BuildArch:      noarch
Source0:        %{name}.tar.gz
Source1:        LICENSE.md
BuildRequires:  systemd-rpm-macros
Requires:       git-core
Requires:       curl
Requires:       file
Requires:       procps-ng
Requires:       util-linux-core
Requires:       polkit
Requires:       policycoreutils
%{?systemd_requires}

%description
Instructions on the web say "brew install". On Suno that works the first time
it is typed: a boot service creates Homebrew's folder for the primary account,
brew sets Homebrew up from its official repository on first use, and every
shell finds what it installs after the system's own commands. Homebrew's
analytics are off unless the person turns them on.

%prep
%setup -q -n %{name}
cp %{SOURCE1} LICENSE.md

%build

%install
install -D -m 0755 bin/brew %{buildroot}%{_bindir}/brew
install -D -m 0755 libexec/Suno-homebrew-prefix %{buildroot}%{_libexecdir}/Suno-homebrew-prefix
install -D -m 0644 data/Suno-homebrew.sh %{buildroot}%{_sysconfdir}/profile.d/Suno-homebrew.sh
install -D -m 0644 data/Suno-homebrew-prefix.service %{buildroot}%{_unitdir}/Suno-homebrew-prefix.service
install -D -m 0644 data/org.projectSuno.homebrew.policy %{buildroot}%{_datadir}/polkit-1/actions/org.projectSuno.homebrew.policy
install -D -m 0644 README.md %{buildroot}%{_docdir}/%{name}/README.md
install -d %{buildroot}%{_presetdir}
printf 'enable Suno-homebrew-prefix.service\n' > %{buildroot}%{_presetdir}/60-Suno-homebrew.preset

%check
sh -n %{buildroot}%{_bindir}/brew
sh -n %{buildroot}%{_libexecdir}/Suno-homebrew-prefix
sh -n %{buildroot}%{_sysconfdir}/profile.d/Suno-homebrew.sh

%post
%systemd_post Suno-homebrew-prefix.service

%preun
%systemd_preun Suno-homebrew-prefix.service

%files
%license LICENSE.md
%doc %{_docdir}/%{name}/README.md
%{_bindir}/brew
%{_libexecdir}/Suno-homebrew-prefix
%config(noreplace) %{_sysconfdir}/profile.d/Suno-homebrew.sh
%{_unitdir}/Suno-homebrew-prefix.service
%{_presetdir}/60-Suno-homebrew.preset
%{_datadir}/polkit-1/actions/org.projectSuno.homebrew.policy
