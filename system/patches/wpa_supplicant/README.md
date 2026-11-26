# wpa_supplicant

Fedora's wpa_supplicant, rebuilt by `scripts/packages/build-wpa-supplicant.sh`
from the SRPM pinned in `config/desktop/inputs.env` (desktop-components group
`wpa-supplicant`, both architectures). Luma installs only the `wpa_supplicant`
subpackage, pinned in `config/desktop/packages.txt`. NetworkManager drives it
with `bgscan` "simple:30:-70:900" for multi-BSS networks
(`patches/NetworkManager/0002-*`).

The patches change how a BSS of an ESS is chosen and when the station roams.
Each is a standalone change against hostap 2.11 with its rationale in the
header, written for upstream hostap; drop them once upstream has equivalents.

- `0001-scan-prefer-a-usable-higher-band-over-a-stronger-lower-band.patch`:
  between BSSs with at least 20 dB SNR the throughput estimate decides, so a
  usable 5 or 6 GHz BSS wins over a stronger 2.4 GHz one; a usable BSS wins
  over an unusable one (no more weak 6 GHz winning on its estimate alone).
- `0002-remember-bsss-that-failed-to-connect-and-do-not-roam-to-them.patch`:
  a BSS that failed to accept the station is not a roaming target for 10
  minutes (doubling, at most 24 hours) and is tried last for a connection.
- `0003-roaming-keep-a-usable-link-and-roam-only-for-a-clear-gain.patch`:
  no roaming off a usable link while it carries traffic or within 120 s of an
  association; otherwise only for 1.5x estimated throughput on a usable BSS
  or 10 dB more signal. A weak link roams as before, but not to a weaker,
  unusable BSS. Replaces the "5 Mbit/s higher estimate" roam trigger.
- `0004-bgscan-simple-postpone-background-scans-while-a-good-link-is-busy.patch`:
  no long-interval background scan while the link is above the threshold and
  busy; weak links are scanned on time. On 2.4 GHz with a 5/6 GHz BSS of the
  network known, the long interval is at most 300 s.
- `0000-luma-fedora-spec.patch`: adds the patches and the `luma.N` release.

Measured with mac80211_hwsim, wmediumd, hostapd and NetworkManager 1.56.1 in a
VM: `tools/wifi-roam-sim/`.
