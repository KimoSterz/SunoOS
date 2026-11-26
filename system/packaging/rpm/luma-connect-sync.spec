# SPDX-License-Identifier: Apache-2.0
# Phase 1 of ADR-054. In the image from 0.2.1-1.luma.2, inert until the person
# turns Sync on: the service makes no Hub request (no network) before that.
Name:           luma-connect-sync
Version:        0.2.1
Release:        1.luma.13%{?dist}
Summary:        Luma Connect Sync: end-to-end encrypted sync of apps and app state
License:        Apache-2.0
BuildArch:      noarch
Source0:        luma-connect-sync.tar.gz

BuildRequires:  python3-devel
BuildRequires:  systemd-rpm-macros
# HPKE (RFC 9180) arrived in python-cryptography's hpke module.
BuildRequires:  python3dist(cryptography) >= 50
BuildRequires:  libsodium
BuildRequires:  python3-gobject-base
BuildRequires:  dbus-daemon
# The apps API tests sign test commits and verify them with gpgv.
BuildRequires:  gnupg2
Requires:       python3
Requires:       python3dist(cryptography) >= 50
Requires:       libsodium
Requires:       python3-gobject-base
Requires:       libsecret
# Device keys are sealed with systemd-creds --user (systemd 256 and later).
Requires:       systemd >= 256
# An app's publisher is its Flatpak remote's URL and signing keys; the apps API
# verifies deployed commits with gpgv (ADR-057 §1.1).
Requires:       gnupg2
Requires:       dconf
Requires:       flatpak
Requires:       polkit
# ADR-052 store apps are rebuilt on the receiving device by its installer.
Recommends:     luma-application-installer

%description
The user service luma-connect-syncd and the luma-connect-sync command
(ADR-054 Phase 1): device keys, join by code or recovery key, the installed
apps of each computer (Flatpak and ADR-052 store records) and the data
folders of closed apps, end-to-end encrypted through the Luma Connect Hub.
It serves org.projectluma.ConnectSync1 on the session bus.

%prep
%autosetup -n luma-connect-sync

%build

%install
install -d %{buildroot}%{python3_sitelib}/luma_connect_sync
install -m 0644 luma_connect_sync/*.py luma_connect_sync/bip39-english.txt %{buildroot}%{python3_sitelib}/luma_connect_sync/
install -D -m 0755 bin/luma-sync %{buildroot}%{_bindir}/luma-sync
install -D -m 0755 bin/luma-connect-syncd %{buildroot}%{_bindir}/luma-connect-syncd
install -D -m 0644 data/luma-connect-syncd.service %{buildroot}%{_userunitdir}/luma-connect-syncd.service
install -D -m 0644 data/org.projectluma.ConnectSync1.service %{buildroot}%{_datadir}/dbus-1/services/org.projectluma.ConnectSync1.service
install -D -m 0644 data/org.projectluma.ConnectSync1.xml %{buildroot}%{_datadir}/dbus-1/interfaces/org.projectluma.ConnectSync1.xml
install -D -m 0644 data/org.projectluma.impl.portal.Sync.xml %{buildroot}%{_datadir}/dbus-1/interfaces/org.projectluma.impl.portal.Sync.xml
install -d %{buildroot}%{python3_sitelib}/luma_connect_sync/apps_api
install -m 0644 luma_connect_sync/apps_api/*.py %{buildroot}%{python3_sitelib}/luma_connect_sync/apps_api/
# The app registry's public key and the registry at build time (ADR-057 §10.3). Without the key no app is approved.
install -d %{buildroot}%{_datadir}/luma-connect-sync
for f in registry.pub registry.json registry.json.minisig; do
  if [ -f data/apps-registry/$f ]; then install -m 0644 data/apps-registry/$f %{buildroot}%{_datadir}/luma-connect-sync/$f; fi
done
install -D -m 0644 data/org.projectluma.connect-sync.policy %{buildroot}%{_datadir}/polkit-1/actions/org.projectluma.connect-sync.policy
install -D -m 0644 data/sync/exclude.d/00-luma.conf %{buildroot}%{_datadir}/luma/sync/exclude.d/00-luma.conf
install -D -m 0644 data/sync/deny.d/00-self-syncing.txt %{buildroot}%{_datadir}/luma/sync/deny.d/00-self-syncing.txt
install -D -m 0644 data/sync/deny.d/10-luma-connect-services.txt %{buildroot}%{_datadir}/luma/sync/deny.d/10-luma-connect-services.txt
install -D -m 0644 data/sync/deny.d/20-device-state.txt %{buildroot}%{_datadir}/luma/sync/deny.d/20-device-state.txt
install -D -m 0644 data/sync/settings.d/00-luma.toml %{buildroot}%{_datadir}/luma/sync/settings.d/00-luma.toml

%check
PYTHONPATH=%{buildroot}%{python3_sitelib} %{python3} -c "import luma_connect_sync.service, luma_connect_sync.cli"
cd tests && PYTHONPATH=$PWD/..:$PWD %{python3} -m unittest discover -p "test_*.py" -v

%files
%license LICENSE.md
%doc README.md
%{_bindir}/luma-sync
%{_bindir}/luma-connect-syncd
%{python3_sitelib}/luma_connect_sync/
%{_userunitdir}/luma-connect-syncd.service
%{_datadir}/dbus-1/services/org.projectluma.ConnectSync1.service
%{_datadir}/dbus-1/interfaces/org.projectluma.ConnectSync1.xml
%{_datadir}/dbus-1/interfaces/org.projectluma.impl.portal.Sync.xml
%{_datadir}/luma-connect-sync/
%{_datadir}/polkit-1/actions/org.projectluma.connect-sync.policy
%{_datadir}/luma/sync/

%changelog
* Thu Nov 26 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.13
- A new recovery key with every device kept: luma-sync recovery-key --replace
  (--dry-run lists who is kept; --in-settings leaves the words for Settings'
  Show new key… and never prints them) and ReplaceRecoveryKey. The old words
  open nothing afterwards. Devices that joined while the old key was valid
  and that this device never counted are removed first.

* Thu Nov 26 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.12
- Apps install in their own transient scope under the person's user
  manager, not inside the sync service: their memory and disk cache are the
  install's, and restarting the service doesn't cut an install short.
- Changed on two devices: a card only when the person opened the app on both
  since they last synced. Otherwise the newest copy is used and the other is
  kept quietly for 30 days.

* Thu Nov 26 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.11
- Continue: the session goes out as it changes (unlock, windows opening,
  closing or changing, every shell snapshot), not on the next sync cycle.
  Suspend publishes under a logind delay lock; what didn't go out is sent as
  soon as the network is back.
- An empty snapshot withdraws the session only when the windows were closed:
  never on lock, suspend, lid, shutdown or log-out, while locked or asleep,
  or in the first two minutes after waking or unlocking.
- GetContinueOffer waits for the network after a wake, then answers from the
  sessions this device holds; ContinueOfferChanged says when another device's
  session arrives.

* Thu Nov 26 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.10
- Callers are named by their process, not their scope: the bus broker's pidfd,
  checked before and after reading /proc, and the executable compared by inode
  with a root-owned file. Key, join and Continue calls answer only GNOME Shell
  or Phosh (owning their bus name) and Settings; a login session no longer
  passes. Test machines may add root-owned programs in
  /etc/luma/connect-sync/callers.d.
- A device's own state no longer syncs as app data: where its windows were
  (.local/state/luma/windows), Flatpak's linker cache (.ld.so) and Depot's
  install history and update holds. Synced, they made a conflict every time
  an app was used on two devices.
- Exclusions may name a path from the top of the app's folder.
- Flatpak apps are named as their desktop file names them, not by their ID.
- A setting put back to its old value within two minutes of another
  device's change being applied gets that change again instead of sending
  the old value with a newer clock (a wallpaper reverted this way and won).
  The second time it is the person's change.

* Wed Nov 25 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.9
- GetState says whether the account has Sync, whether this device is a member,
  its name and when the recovery key was saved; GetRestore rows name the device
  each app came from and, while its data comes over, its size.
- A removed device's attention says when the removal was first seen.
- ListConflicts lists the copies kept on this device; UseVersion puts one back.
- ProbeAccount: one look at the account when the person turns Sync on (the
  service is inert until then), so Settings knows to join or set up.

* Wed Nov 25 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.7
- Sync for apps (ADR-057): org.projectluma.impl.portal.Sync for the Sync
  portal; app identity from the deployed commit's signature against the
  signed app registry; keep-both records, assets and leases with a
  coalescing outbox, quotas and rate limits from the registry; suspend,
  revoke and purge; the app directory; daily anonymous usage reports with
  RFC 9578 tokens. Nothing reaches the network until Sync is on.

* Tue Nov 24 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.5
- Settings, Appearance, Same wallpaper everywhere and Keyboard sync
  (ADR-054 §3): only keys in /usr/share/luma/sync/settings.d/*.toml, one
  record each, newest change wins (hybrid logical clock), checked against this
  device's schema before writing. Language, region, clock, accessibility, dark
  mode, accent and keyboard layouts go to every class; the rest only between
  devices of the same class. A wallpaper from the home folder travels as an
  encrypted blob; a joining device takes the account's settings.
- A change to a synced setting wakes a cycle within a second.
- Engine.save_many: one request for many records of a zone.
- The first cycle after Sync is turned on says Syncing.
- luma-sync setup and revoke --new-recovery-key claim the --words-file
  before the key is made: a file that exists or can't be created leaves Sync
  as it was, so a recovery key is never made with nowhere to go.

* Tue Nov 24 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.4
- Every run of an app is seen, however short: Flatpak instances are tracked
  by instance id and store apps by their runtime folder, with a file monitor
  so the look happens at once. A change made in a short run used to wait for
  the five-minute look.
- The sign-in helper's own runs are known by the instance id Flatpak reports
  (--instance-id-fd), not by a 10-second window that also hid the person
  closing the app.
- Newer state that waited on an open app is applied once the app is quiet,
  whether or not its close was seen.
- An account the Hub doesn't admit yet (owner-only) gets "Sync isn't open
  to this account yet." instead of a failed cycle.

* Tue Nov 24 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.3
- Continue (ADR-055): this device's session snapshot is kept for the
  account's other computers and handhelds in the continue zone, sealed again
  to each eligible member's key (never a TV); GetContinueOffer,
  TakeContinue, DeclineContinue, PublishContinue, ClearContinue.

* Mon Nov 23 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.2
- Ships the S2 chain fix (#580): no device added during a pending removal
  gets the next key when the recovery key is replaced.
- Never-synced files nested in an app's folder (its keyring file, locks)
  survive an update; join exits once join-confirm took the approval.
- In the image: off until the person turns Sync on (no Hub contact before);
  the command is luma-sync (luma-connect-sync is prairie-core's Connect sync).
* Mon Nov 23 2026 Project Luma <dev@projectluma.org> - 0.2.1-1.luma.1
- Re-review fixes: approve checks and wraps from one request; capped, visible
  join answers; the joining device waits for the person's confirmation;
  replaced recovery keys are shown; late recovery joins are dropped; the
  zone generation floor covers every zone; signed requests.

* Sun Nov 22 2026 Project Luma <dev@projectluma.org> - 0.2.0-1.luma.1
- Security review fixes, wire format 2: signed membership, approvals bound to
  the joining device's keys, signed bundles with removed devices, zone key
  generation floor, owner-scoped app zones, fixed 1 MiB blocks with Padmé
  padding, sealed tombstones, keys sealed with systemd-creds --user.
* Sun Nov 22 2026 Project Luma <dev@projectluma.org> - 0.1.0-1.luma.1
- Phase 1 of ADR-054: keys, join, installed apps and closed-app state.
