# Suno-update

Suno's system update agent verifies signed release information and stages
OS deployments through rpm-ostree.

- `Suno-updated` — root, sandboxed, D-Bus-activated system service
  `org.projectSuno.Update1`. Verifies the minisign-signed update graph for the
  channel this computer follows, selects a release (staged rollouts with local
  wariness, dead-ends, barriers, pauses, security releases, signed
  `rollback_to`, per-device `device_holds`), stages that exact OSTree commit
  through rpm-ostree's D-Bus API, and restarts only when a person asks.
- `Suno-update` — the command line; `Suno-update status --json` is the contract
  Depot reads.
- `Suno-update-notifier` — user-session notifications (no resident process).
- `Suno-update-boot` and greenboot checks — confirm a new deployment on its
  trial boots and record rollbacks.

One ARM commit serves every ARM device. A release may carry `device_holds`
(`[{"hardware_target": "fairphone,fp6", "reason": "..."}]`): a device whose
device tree names that target is not offered the release and stays on its last
good one (reason `device-held`); every other device updates. The publisher side
is `scripts/os/device-hold.py` and `scripts/os/device-hold-chain.sh`.

The [engine](Suno_update/engine.py), [configuration](Suno_update/config.py) and
[tests](tests) define the state machine, policy defaults and interface checks.
The [public build guide](../../BUILDING.md) describes release-pipeline inputs.

Run the unit tests with:

```sh
cd src/Suno-update && python3 -m unittest discover -s tests -p 'test_*.py'
```


Update streams are architecture-qualified (`graph/{arch}/{channel}.json`).
The signer also maintains the older x86 `graph/{channel}.json` alias. Phone
policies additionally select `hardware_target`, a device ref template and the
per-device graph URL: `graph/aarch64/fairphone-fp6/{channel}.json`. The Titan
2 Elite, the Raspberry Pi 5 and the Surface Pro 12-inch follow the generic ARM
stream; their kernel and platform packages come from a device repository. The kernel device-tree board
must match that policy; a signed graph cannot authorize another device or an
explicitly different commit architecture. Older generic commits without an
architecture metadata key remain accepted.

A device with a layered device kit (`/var/lib/Suno-device-layer/layered` and
the `/etc/yum.repos.d/ID.repo` Suno-device-layer wrote) is also offered
device-package updates when the graph has no newer OS commit
([device_repo.py](Suno_update/device_repo.py)): when the repository's
`primary` metadata has a newer EVR of an installed package from the repo
file's `includepkgs`, the check publishes `available` with the booted version
and commit, `last_check_reason` `device-update` and a `Device update: ...`
summary. Staging forces `RefreshMd` and redeploys the booted base commit
through the same path as an OS update (kernel arguments, greenboot,
rollback); the pending change is recognised by its layered deployment
checksum. A rolled-back or unchanged device update is not offered again on
that deployment until the repository has newer builds. Devices without a
device repository read nothing and behave as before.

To publish a device-only OTA, build the newer device packages (a higher
version or release than the installed ones; the kit's `packages`, so the repo
file's `includepkgs` admits them), sign them and `repomd.xml` with the Suno OS
Release key, and publish the repository to its `[device_repo] url` (for
example `https://dl.simplyluma.com/os/devices/aarch64/fairphone-fp6/`). No
graph or OS commit changes; devices offer the update on their next check.
