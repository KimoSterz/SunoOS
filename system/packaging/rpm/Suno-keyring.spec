# SPDX-License-Identifier: MPL-2.0

Name:           Suno-keyring
Version:        0.3.0
Release:        1.Suno.2%{?dist}
Summary:        Saved passwords that unlock when you log in, or say why they cannot
License:        MPL-2.0
URL:            https://projectluma.org/saved-passwords
Source0:        Suno-keyring.tar.gz

BuildRequires:  binutils
BuildRequires:  desktop-file-utils
BuildRequires:  gcc
BuildRequires:  pkgconfig(pam)
BuildRequires:  pkgconfig(libxcrypt)
BuildRequires:  glib2
BuildRequires:  meson >= 1.3
BuildRequires:  ninja-build
BuildRequires:  python3-devel >= 3.11
BuildRequires:  python3-gobject-base
BuildRequires:  python3-cryptography >= 44
BuildRequires:  systemd-rpm-macros
Requires:       python3 >= 3.11
Requires:       python3-gobject
Requires:       libadwaita
# SunoUI parts (Suno_appkit) for the first-unlock sheet.
Requires:       Suno-developer-platform >= 0.1.0-1.Suno.123
# The keyring this looks after, and the PAM module that unlocks it at login.
Requires:       gnome-keyring
# Gcr's secret exchange: the sheet answers gnome-keyring's prompts as the system prompter.
Requires:       gcr-libs
Requires:       pam
# Seals the keyring key of an account that signs in automatically, and wraps
# it with Argon2id and AES-256-GCM for recovery.
Requires:       systemd >= 256
Requires:       python3-cryptography >= 44
# pwscore, to say when the password guarding the recovery copy is weak.
Requires:       libpwquality
# systemd also carries userdbctl and systemd-userdbd: the session compares
# the account's own password hash with the one the recovery copy was made for.
# /etc/pam.d/passwd, where %%post adds the password-change hook. The file
# belongs to passwd (shadow-utils provides passwd from Fedora 42); both are
# triggers below, so an update that replaces it gets the hook back.
Requires(post): passwd
Requires(post): coreutils gawk grep
Requires(preun): coreutils grep

%description
A login keyring whose password is no longer the account password cannot be
unlocked at login, so the person is asked for it at every login, forever, by a
prompt that says nothing about what is wrong or how to put it right.

Suno says what happened in plain words, once, and offers to put it right: the
person types the password the keyring was locked with and their current login
password, and the keyring is re-keyed to the login password with everything in
it kept. If they do not know the older password, Suno says plainly that nobody
can read the contents without it and offers to start a fresh keyring, keeping
the old file in case they remember later. Doing nothing keeps the old
behaviour.

An account that signs in automatically types no password, so nothing could
unlock its login keyring. Its keyring is locked with a random keyring key in
two slots: sealed with systemd-creds for the user and the machine (TPM2 and
host key where there is a TPM2, PCR 7 with an encrypted root; host key
otherwise), and wrapped with Argon2id and AES-256-GCM under the account
password for recovery. The password itself is never stored. The installer
enrols the account when automatic sign-in is chosen; pam_Suno_keyring.so in
the passwd stack re-wraps the key when the password change really happened
(the new password verifies against /etc/shadow); devices set up earlier are
asked for the password once.

Suno-keyring --check prints the state for the capability and first-boot
checks: a login keyring that cannot be unlocked automatically is a broken
state worth reporting.

%prep
%autosetup -n Suno-keyring

%build
%meson
%meson_build

%install
%meson_install
# Enabled by the package itself: a preset applies only on first install.
install -d %{buildroot}%{_userunitdir}/graphical-session-pre.target.wants
ln -s ../Suno-keyring.service \
  %{buildroot}%{_userunitdir}/graphical-session-pre.target.wants/Suno-keyring.service
ln -s ../Suno-keyring-autologin.service \
  %{buildroot}%{_userunitdir}/graphical-session-pre.target.wants/Suno-keyring-autologin.service
# The sandboxed service checks the account's password through this socket (see login.py).
install -d %{buildroot}%{_userunitdir}/sockets.target.wants
ln -s ../Suno-keyring-verify.socket \
  %{buildroot}%{_userunitdir}/sockets.target.wants/Suno-keyring-verify.socket

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/org.projectSuno.Keyring.desktop
# A session service, never listed as an app, with a name for its notifications.
for key in NoDisplay=true DBusActivatable=true Name=Saved\ Passwords; do
  grep -Fqx "$key" %{buildroot}%{_datadir}/applications/org.projectSuno.Keyring.desktop
done
glib-compile-schemas --strict --dry-run %{buildroot}%{_datadir}/glib-2.0/schemas
# The repair asks PAM about the person's own password; the stack must be there.
grep -Fq "auth       include      system-auth" %{buildroot}%{_sysconfdir}/pam.d/Suno-keyring
# No password may be written anywhere: they are arguments to a D-Bus call.
! grep -rn "log\.\(info\|warning\|error\)(.*password[^s]" %{buildroot}%{python3_sitelib}/Suno_keyring/
PYTHONPATH=%{buildroot}%{python3_sitelib} %{python3} -c "import Suno_keyring.state, Suno_keyring.repair, Suno_keyring.secrets, Suno_keyring.autounlock, Suno_keyring.first_unlock, Suno_keyring.ready, Suno_keyring.prompt_gate"
# The PAM module's only exported function is pam_sm_chauthtok (linker
# symbols such as _edata or __bss_start are not functions).
test "$(nm -D --defined-only --format=posix %{buildroot}%{_libdir}/security/pam_Suno_keyring.so |
        awk '$2 ~ /^[TtWi]$/ || $1 ~ /^pam_sm_/ { print $1 }')" = pam_sm_chauthtok
grep -Fq %{_libexecdir}/Suno-keyring %{buildroot}%{_libdir}/security/pam_Suno_keyring.so
cd tests && PYTHONPATH=$PWD/.. %{python3} -m unittest discover -p "test_*.py" -v

%post
%{_libexecdir}/Suno-keyring-pam-setup add || :

%triggerin -- passwd, shadow-utils
# Whichever owns /etc/pam.d/passwd may replace it on update.
%{_libexecdir}/Suno-keyring-pam-setup add || :

%preun
if [ "$1" -eq 0 ]; then
    %{_libexecdir}/Suno-keyring-pam-setup remove || :
fi

%files
%license LICENSES/MPL-2.0.txt
%{_libexecdir}/Suno-keyring
%{_libexecdir}/Suno-keyring-pam-setup
%{_libdir}/security/pam_Suno_keyring.so
%{_datadir}/Suno-keyring/
%{python3_sitelib}/Suno_keyring/
%{_userunitdir}/Suno-keyring.service
%{_userunitdir}/graphical-session-pre.target.wants/Suno-keyring.service
%{_userunitdir}/Suno-keyring-autologin.service
%{_userunitdir}/graphical-session-pre.target.wants/Suno-keyring-autologin.service
%{_userunitdir}/Suno-keyring-verify.socket
%{_userunitdir}/Suno-keyring-verify@.service
%{_userunitdir}/sockets.target.wants/Suno-keyring-verify.socket
%{_datadir}/applications/org.projectSuno.Keyring.desktop
%{_datadir}/glib-2.0/schemas/org.projectSuno.keyring.gschema.xml
%config(noreplace) %{_sysconfdir}/pam.d/Suno-keyring

%changelog
* Wed Nov 04 2026 Project Suno <maintainers@projectSuno.org> - 0.3.0-1.Suno.2
- First-unlock sheet in TV and phone layouts; a second step for an older
  keyring password, checked through a scoped sign-in password helper.

* Mon Nov 02 2026 Project Suno <maintainers@projectSuno.org> - 0.3.0-1.Suno.1
- Ask for the first unlock of an unenrolled automatic sign-in in Suno's own
  sheet, with automatic unlock on by default; decline other keyring prompts
  while it is up
- Show the state and turn automatic unlock on or off in the keyring window

* Sun Nov 01 2026 Project Suno <maintainers@projectSuno.org> - 0.2.0-1.Suno.1
- Lock the login keyring of an automatic sign-in with a random key, sealed for
  the device and wrapped with the account password for recovery
- Crash-safe key changes; fail closed when nothing can be sealed
- Suno-keyring --enrol for the installer; ask once on devices set up earlier
- Re-wrap at password changes with pam_Suno_keyring.so, only once the new
  password verifies against /etc/shadow; keep the previous wrap until the
  session confirms the change
- Standalone recovery script for older systems, kept next to the slots
- PCR 7 only when the root file system itself is encrypted

* Sun Sep 20 2026 Project Suno <maintainers@projectSuno.org> - 0.1.0-1.Suno.1
- Say once, in plain words, when the login keyring cannot be unlocked at login
- Re-key it to the current login password, keeping everything in it
- Offer a fresh keyring when the older password is gone, keeping the old file
- Suno-keyring --check reports the state for the capability checks
