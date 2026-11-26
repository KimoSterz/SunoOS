# Connect Sync for apps: the device–Hub contract (ADR-057 §5, §8, §10)

The single source both sides implement: the sync service on the device
(`src/luma-connect-sync/luma_connect_sync/apps_api/`) and the Hub
(website repo, `deploy/hub/connect-sync/`, whose README mirrors this file).
Anything here that changes is a contract change: both sides move together.

Conventions are those of wire format 2 (`connect-sync-wire.md`): b64url is
base64url without padding, `lp(…)` is length-prefixed concatenation, `mac`
is HMAC-SHA256, canonical JSON is sorted keys without spaces. Times are unix
milliseconds unless a field says seconds. Days are UTC dates, `YYYY-MM-DD`.

## 1. Publisher identity and the owner

An app's **owner** names its publisher. For a Flatpak:

```
owner = "flatpak:" ‖ first 32 hex of SHA-256(lp(remote URL, fpr₁, fpr₂, …))
```

- `remote URL` is the publisher's Flatpak remote as it registered it, with
  trailing `/` removed (`rstrip('/')`).
- `fprᵢ` are the **primary-key** fingerprints of the approved publisher keys:
  40 hex digits, uppercase, sorted, without duplicates. Subkey fingerprints
  never enter the owner, so a publisher can rotate signing subkeys without
  orphaning its zones.

The Hub computes the owner when the developer applies (from the remote URL and
the keys it registers) and publishes it in the registry (§2). Devices never
compute an owner from a local remote's configuration: they take it from the
registry entry whose keys verify the deployed commit (§1.1).

### 1.1 How a device decides who an app is

1. The portal names the caller (`XdpAppInfo`) and passes the app ID and the
   caller's pidfd. The service checks the pidfd itself: the process is alive
   before and after it reads `/proc/<pid>/root/.flatpak-info`, and that file
   names the same app ID. From it the service takes `app-path` and
   `app-commit` (the commit the instance runs).
2. The installation is the one `app-path` lies in: `/var/lib/flatpak`
   (system) or `$XDG_DATA_HOME/flatpak` (user). The service reads the commit
   object `repo/objects/<2>/<62>.commit` of that installation, checks that
   SHA-256 of its bytes is `app-commit`, and reads its detached metadata
   (`.commitmeta`, key `ostree.gpgsigs`).
3. The commit's metadata must bind it to the app: `ostree.ref-binding`
   contains a ref `app/<app ID>/<arch>/<branch>`, or, for a commit without a
   ref binding, `xa.metadata` names `[Application] name=<app ID>`.
4. A signature counts only when it is a valid OpenPGP signature over the
   commit object's bytes by a valid, unrevoked, unexpired, signing-capable
   key, primary or a subkey bound to that primary. The *primary* fingerprint
   is the one compared with the registry.
5. **Approved:** a registry entry with `app` = the app ID whose `keys`
   contain that primary key and whose `state` is `approved`. The app's owner
   is that entry's `owner`.
6. **Not approved:** the commit is validly signed (by a key in some registry
   entry for another app ID or another publisher, or by a key in the
   installation's own trusted keyring for the commit's origin remote), but no
   approved entry matches. Its local data is kept under `key:<primary fpr>`
   until approval and moved to the approved owner's mirror then.
7. **Unverified:** no valid signature at all (an unsigned commit, a local
   build, a keyless `.flatpak` bundle, a remote with `gpg-verify=false`).
   Nothing is stored.

The remote URL and `gpg-verify` in the local remote configuration are never
proof of anything. They are user-writable text.

## 2. The signed app registry

- **Where:** `https://dl.simplyluma.com/sync/apps/v1/registry.json` and
  `https://dl.simplyluma.com/sync/apps/v1/registry.json.minisig`. Plain GET,
  no cookies, no token, no query string: every device reads the same files,
  so fetching them says nothing about which apps a device runs.
- **Signature:** minisign, prehashed Ed25519 (`ED`, BLAKE2b-512 of the file),
  by the Luma registry key, verified before a byte of the body is parsed
  (the same verifier as the Depot catalogue, `depot_signature.py`). The
  trusted comment is `registry:<version>`. The public key ships in the
  device package at `/usr/share/luma-connect-sync/registry.pub`; a root-owned
  `/etc/luma-connect-sync/registry.pub` that no one else can write replaces it
  (test devices, a private deployment). Tests use a throwaway key, and the
  production key is created by the release owner.
- **Size:** at most 8 MiB; more is refused.
- **Body** (canonical JSON not required; the signature covers the exact bytes):

```json
{
  "schema": 1,
  "version": 412,
  "issued_at": 1795000000000,
  "expires_at": 1796209600000,
  "apps": [
    {
      "owner": "flatpak:0f3c…(32 hex)",
      "app": "io.github.nmcmil.OpenLator",
      "keys": ["<b64url of a binary OpenPGP transferable public key>", "…"],
      "state": "approved",
      "purge": false,
      "labels": ["saves", "library"],
      "limits": {"record_bytes": 100000000, "asset_bytes": 1000000000, "zones": 16, "records": 100000,
                 "transit_bytes": 2000000000, "relay_bytes_month": 10000000000,
                 "writes_per_hour": 120, "upload_bytes_per_hour": 20000000},
      "changed_at": 1794990000000
    }
  ],
  "tokens": {
    "issuer": "hub.simplyluma.com",
    "keys": [{"id": "<hex SHA-256 of the SPKI DER>", "spki": "<b64url SPKI DER, RSASSA-PSS 2048>",
              "slot": "2026-11", "not_before": 1794000000000, "not_after": 1797000000000}]
  }
}
```


- `version` grows by one at every publish. `expires_at` = `issued_at` + 14
  days; the Hub re-signs daily even when nothing changed.
- `state` is `approved`, `suspended` or `revoked`. Applications in `applied`
  or `declined` are not listed. A `revoked` entry stays listed with
  `purge: true` for at least 400 days, so a device that was offline still
  purges.
- `keys` carry the full public key material of each approved primary key
  with its subkeys, so devices verify commits without any keyserver.
- `limits` are the reviewed per-app limits (ADR-057 §5 defaults unless the
  reviewer changed them). Storage and transfer limits may be raised up to
  the account-wide caps (`record_bytes` and `asset_bytes` 5 GB, `zones` 256,
  `records` 10,000,000, `transit_bytes` 10 GB, `relay_bytes_month` 50 GB).
  `writes_per_hour` (default 120) and `upload_bytes_per_hour` (default
  20,000,000) are per app per device (ADR-057 §5.2) and may only be lowered;
  the per-app bursts scale with them (600 writes and 256 MB at the
  defaults). The Hub refuses to publish a value above its cap or below 0; a
  device clamps anything above a cap to the cap and fills a missing field
  with the default (`tests/vectors/apps-registry/limits.json`). A lowered
  limit applies on a device at its next registry refresh.
- At most one entry per (`owner`, `app`). An `app` may appear under several
  owners (only the approved one syncs).

### 2.1 Device rules

- Refuse, and keep the previous registry, when: the signature fails, the
  trusted comment's version differs from the body's, `schema` isn't 1,
  `version` is lower than the highest version this device has accepted under
  the same registry key (never lower than the registry it keeps), the top
  level is malformed, or `expires_at` has passed.
- An app entry, a publisher key or a token key the device can't read is
  skipped on its own, never the file: an entry whose keys it can't read
  still applies its `state` and `purge`, so revocations always arrive. The
  Hub must still never publish what devices can't read (v4 OpenPGP keys
  only, until devices say otherwise).
- A device that has no valid, unexpired registry treats **every** app as
  `not-approved`: calls work locally and writes wait in the outbox.
- Refresh every 6 hours (±10 % jitter), and at once when the wait hint (§3)
  names another version.
- Leaving `approved` (to `suspended` or `revoked`) stops the app at once on
  the device: no sends, no fetches, the outbox is dropped, `GetStatus`
  answers `revoked`. With `purge`, the device deletes the app's zones on the
  Hub and its own mirror through the app directory (ADR-057 §1.5), but only
  once two verified registries of different versions, whose `issued_at`
  are at least 12 hours apart, both list the entry with `purge`, **and** the
  device's own clock shows at least 12 hours since it first saw the purge
  listed. A registry key alone therefore can't fake the delay by signing
  two registries a minute apart. A registry whose `issued_at` is more than
  5 minutes ahead of the device's clock counts for neither end. A registry
  in between without the purge starts the count again. Until then the data
  stays. The Hub can't find an app's zones itself.

## 3. The change hint

`GET /api/sync/v1/wait?after=N&timeout=S&registry=V` (member request, as
today) answers `{"seq": <int>, "registry": <int>}` once `seq > N` **or** the
current registry version `≠ V`, or when `S` seconds pass. Devices that don't
send `registry` get the old behaviour; the answer always carries `registry`.

## 4. App tags, zones and quotas on the Hub

- An app zone is created with `PUT zones/{id}` and `owner` set to the app's
  tag: `t` followed by 32 hex digits (ADR-057 §2.3). The Hub treats any zone
  whose owner matches `^t[0-9a-f]{32}$` as an app zone. It never learns which
  app a tag is.
- Per account: at most 256 distinct app tags; app zones together at most half
  of the account's resident allowance (5 GB of 10 GB on `free`).
- Per tag, the Hub enforces the **ceiling** of the registry: the largest
  `limits` value any listed `approved` entry has for that field (at least the
  §5 defaults). Devices enforce each app's exact `limits` first. A device
  that lies about tags can't exceed the account's own allowances.
- Over a limit the Hub answers `413 {"code": "quota", "allowance": A}`, with
  `A` one of `app_record_bytes`, `app_asset_bytes`, `app_zones`,
  `app_records`, `app_tags`, `apps_total`, `account`, or
  `{"code": "server_full"}` while free space is under the reserve.
- Record rows carry `updated_at`, the Hub's receive time. Devices clamp any
  version time inside a record to at most `updated_at` + 60 s (ADR-057 §3.5).
- Devices coalesce writes per record (ADR-057 §2.4): one record write per
  record per cycle at most, whatever number of app calls made it; a chain of
  unsent writes leaves as one version.
- The Hub's existing per-device limits (600 writes and 50 MB an hour) stay;
  the device keeps system zones at least half of them.
- Metering per account per day (ADR-057 §8.2) counts app zones in the
  account's resident bytes; it is never split by tag.

## 5. Anonymous tokens (RFC 9578 type 0x0002)

- Blind RSA 2048, **RSABSSA-SHA384-PSS-Deterministic** (RFC 9474 §4: SHA-384,
  MGF1-SHA-384, salt length 48, no message randomizer).
- `TokenChallenge` = {`token_type` 0x0002, `issuer_name`
  `"hub.simplyluma.com"`, `redemption_context` empty, `origin_info`
  `"sync-metrics"`}, encoded as in RFC 9577 §2.1.
  `challenge_digest` = SHA-256 of that encoding.
- `token_key_id` = SHA-256 of the key's SPKI DER = the registry's `id`.
- **Issuance:** `POST /api/sync/v1/metrics/tokens`, a signed member request
  (wire format 2, "Request signature"), body
  `{"requests": ["<b64url TokenRequest>", …]}`. Each TokenRequest is
  `token_type (2) ‖ truncated_token_key_id (1) ‖ blinded_msg (256)`. Answer
  `{"key_id": "<hex>", "responses": ["<b64url blind_sig (256)>", …],
  "remaining": <int>}` in request order.
- Every device asks for **exactly 64** tokens per UTC day in one request,
  whatever it needs, so the count says nothing about how many apps it runs;
  it discards the unused ones at the end of the day. The Hub refuses more
  than 64 per device per day (`429 {"code": "tokens_exhausted"}`) and a
  request of any other size (`400`).
- The Hub keeps only the per-device daily count of issued tokens, never the
  blinded messages or signatures.
- **Only with reports on (§6.1):** a device asks for tokens only while its
  `apps.reports` switch is on. While the Hub's `config.sync.apps.reports` is
  off, it answers a token request with `200 {"collecting": false}` and
  issues nothing; the device then asks again the next UTC day.
- **Key consistency:** the device blinds only to the key of the current
  calendar slot (below) in the current verified registry, and checks every
  blind signature (RFC 9474 `Finalize` verifies) before it keeps a token. A
  response under any other key is refused and nothing is reported with it.
- **A fixed public key calendar (review N2).** Token keys rotate on the
  first of every UTC month and on no other day. Each key in the registry
  names its month in `slot` (`"YYYY-MM"`), and the rules are:
  - exactly one listed key names each month;
  - its validity covers the whole month (`not_before` ≤ the 1st at 00:00
    UTC, `not_after` ≥ the next month's 1st);
  - it is published at least 7 days before its month starts, and a listed
    key never changes.

  A device uses only the key naming the current month. With no such key,
  with two, or with one that doesn't cover the month, it sends nothing that
  month. It also remembers the key it first saw for each month, and a
  registry naming a different key for that month silences it as well.
  Every device therefore redeems under the same key on the same day. A Hub
  that serves one device an old registry (without this month's key) or a
  key of its own can only make that device fall silent, never make its
  reports stand out. There is no continuity rule between keys, so a device
  that was offline for months uses the current key as soon as it has a
  current registry (review N5).

## 6. The daily report

- `POST https://hub.simplyluma.com/api/sync-metrics/v1/report`, outside
  `/api/sync/v1/`: no bearer token, no device signature, no cookies.
- `Authorization: PrivateToken token="<b64url Token>"`, the Token being
  `token_type (2) ‖ nonce (32) ‖ challenge_digest (32) ‖ token_key_id (32) ‖
  authenticator (256)` (RFC 9577 §2.2).
- `Content-Type: application/json`, at most 16 KiB. **Report v3.** v1
  (exact usage) and v2 (exact health and read counts) are withdrawn: the Hub
  can compute those numbers, or numbers that follow them, per device and app
  tag from what it serves, so a report could be matched to its device and the
  app's tag to its account (reviews C1, N1).

```json
{
  "v": 3,
  "day": "2026-11-24",
  "owner": "flatpak:0f3c…",
  "app": "io.github.nmcmil.OpenLator",
  "context": {"class": "computer", "arch": "x86_64", "app_version": "1.4.2", "luma_version": "44.2026w48"},
  "estimate": {"field": "record_bytes", "bucket": 7}
}
```

### 6.1 Reports are off by default

Two switches, both off by default, and both must be on:

- **On the device, `apps.reports`.** It is read from
  `/etc/luma-connect-sync/config.json` (an administrator's, used when it
  exists) or else `/usr/share/luma-connect-sync/config.json` (the image's),
  as `{"apps": {"reports": true}}`. Only `true` turns it on. A file that
  isn't a root-owned regular file, in a root-owned folder that no one else
  can write, counts as off. Luma ships no such file, so reports are off.
  With the switch off the device asks for no tokens and sends no reports;
  turning it off drops every report still waiting, and turning it on starts
  with the next day that ends.
- **On the Hub, `config.sync.apps.reports`.** While it is off the Hub
  answers both the token request and a report with
  `200 {"collecting": false}`. The device then stops for the rest of that
  UTC day and drops the reports waiting.

Both stay off until the aggregation no longer has to trust the Hub operator
(see "What this does not protect against" below).

### 6.2 What a report says

**When a device sends reports.** Only while both switches are on. Then,
for every UTC day that ended, it sends one report
for **every approved app installed on it whose sync is switched on** (the
app has called the API on this device at least once, the person hasn't
switched it off, and it is `approved`), **whether or not the app ran that
day**. A report therefore says the app is installed and syncable there, not
that it was used. Days the device was off are reported when it next runs,
up to 7 days back. A device with more such apps than tokens (64 a day)
sends the rest on later days, within those 7 days.

**Every number is randomized.** A report carries one quantity as a log-4
bucket, through two layers of k-ary randomized response in the RAPPOR style:

- Quantities (`estimate.field`), for the report's app on the report's day:
  - `record_bytes` and `asset_bytes`: resident peak of the day;
  - `records`, `assets`;
  - `hub_up_bytes`, `hub_down_bytes`;
  - `writes`: Hub writes after coalescing;
  - `outbox_bytes`: peak;
  - `write_calls`: calls that write (Save, Delete, PutAsset, RemoveAsset,
    Lease, Release, ResolveSiblings, DeleteZone);
  - `latency_s`: the median time from a remote write to its arrival on this
    device, from the day's histogram;
  - `conflicts`, `siblings_resolved`, `too_many_siblings`, `held_writes`;
  - `refusals`: every limit refusal answered to the app, summed;
  - `errors`: every error answered to the app, summed;
  - `reads`: calls that only read (GetStatus, Subscribe, FetchChanges, Get,
    List, OpenAsset, RequestAsset, PinAsset, EvictAsset).
- **Buckets:** 16 of them. A value below 1, including 0, is bucket 0; any
  other value q is min(15, 1 + ⌊log₄ q⌋).
- **Monthly choice:** at an app's first report in a UTC month, the device
  picks the field uniformly at random and takes its true bucket from that
  report's day. Both stay fixed for the rest of the month, so a value that
  changes mid-month doesn't show the day it changed.
- **Permanent layer (memoized):** for each (app, field, true bucket) the
  device draws one response, once, with ε∞ = 2 (the true bucket with
  probability p₁ = e²/(e² + 15) ≈ 0.330, each other bucket with
  q₁ = 1/(e² + 15) ≈ 0.0447), and keeps it for good. The same value in a
  later month reuses it.
- **Per-report layer:** each report re-randomizes the kept response with
  ε₁ = 4 (p₂ ≈ 0.784, q₂ ≈ 0.0144), so one device's reports don't repeat one
  fixed value that would tie them together.
- **The Hub's estimator.** The two layers compose to a symmetric channel:
  - p = p₁p₂ + 15·q₁q₂ ≈ 0.2684;
  - q = p₁q₂ + q₁p₂ + 14·q₁q₂ ≈ 0.0488;
  - exact values in `tests/vectors/reports/reports.json`.

  Per (app, day, cell, field), with n reports and c_j of them in bucket j,
  the estimated number of reports whose true bucket is j is
  (c_j − n·q) / (p − q). The standard error per bucket is about
  √(n·q(1−q)) / (p − q), so a field needs on the order of hundreds of
  reports for useful precision. Small apps get no usable usage figures:
  that is the price of the guarantee below.

**What this protects, exactly.** Suppose the Hub knows the true value of
every field for an app tag, and can tell which reports came from one device
for one app:

- Those reports depend on the device's data only through the kept
  permanent responses.
- Each kept response is ε∞-differentially private for the one (field,
  bucket) it was drawn for.
- A month adds at most one new kept response per app, and none when the
  month's (field, bucket) was seen before.

So over m months the reports of one (device, app) leak at most
ε∞ × (number of distinct (field, bucket) pairs drawn), which is at most
2·m, and stops growing once the values repeat. That is a bound per app; a
device's reports for several apps compose.

**What is not randomized, and what this does not protect against:**

- **Sent as they are:** `owner`, `app`, `day` and `context`. `context` is
  the device class, CPU architecture, the app's version and the Luma release
  week. A rare combination narrows the set of devices a report can come
  from.
- **Linking a device's reports:** the context, the IP address (below) and
  the timing of a device's reports across its apps can let the Hub operator
  group them. Then the bound above is what remains, not unlinkability.
- **The Hub operator itself:** for an app with a handful of users, the
  context and IP alone can say which account's device sent a report.
  Protection from the operator needs aggregation it can't see into
  (DAP/Prio with a second, independent aggregator, behind OHTTP). That is
  why reports are off by default (§6.1).

Field rules (the Hub answers `400` for anything else; unknown fields are refused):

| Field | Rule |
| --- | --- |
| `v` | 3 |
| `day` | a UTC date from today − 7 to today |
| `owner`, `app` | an entry of the current registry (any state); otherwise `404` |
| `context.class` | `computer`, `handheld` or `tv` |
| `context.arch` | `x86_64` or `aarch64` |
| `context.app_version` | `^[0-9A-Za-z.+~_-]{1,64}$` (`0` when unknown) |
| `context.luma_version` | the release base and ISO week, `^[0-9A-Za-z]{1,16}(\.[0-9]{4}w[0-9]{2})?$` |
| `estimate.field` | one of the 17 quantities above |
| `estimate.bucket` | an integer from 0 to 15 |

- Answers: `204` taken, `409 {"code": "spent"}` token already redeemed,
  `401 {"code": "bad_token"}` (malformed, wrong challenge, unknown or expired
  key, signature fails), `404 {"code": "unknown_app"}`, `400` malformed,
  `413` too large.
- The token is spent whatever the body's fate after the token checks pass,
  so a rejected body can't be retried with the same token.
- Spent token nonces are kept per key until the key's `not_after` + 8 days.
- **Device side:** each report at its own random time in the 24 hours
  after it is scheduled, each on a fresh connection, never together with a
  sync request or another app's report. Reports found more than ten minutes
  overdue (the device slept) each get a new random time over the next 24
  hours, so a waking device doesn't send them as a burst. A report that
  fails with `409`, `401` or `404` is dropped; a network failure retries
  with a new token later (up to day + 7). A `200 {"collecting": false}`
  answer stops the device's reports for the rest of the day (§6.1).

## 7. What the Hub keeps from reports

- No report rows. Each report is folded into per-(app, day, cell)
  aggregates, where the cell is (class, arch, app_version, luma_version):
  per estimate field the 16 bucket counts (from which the estimator above
  gives distributions) and the count of reports.
- The count of reports is the number of devices with the app installed and
  syncable that day, **not** active devices: a report is sent whether the
  app ran or not. Usage figures in the views are estimates and say so.
- Views: installed devices and device-days over a range. There is no
  monthly distinct count: reports aren't meant to be linked across days.
  Any cell with fewer than 10 reports is merged into "other", with
  complementary suppression so that no small cell can be recovered by
  subtraction. Luma staff see every app; a developer sees their own apps
  only.
- **IP addresses:** the metrics endpoint must not log, store or rate-limit
  by client address beyond the memory of one connection. Until reports go
  through a third-party relay (an OHTTP gateway), unlinkability from the
  device's address rests on that policy, not on cryptography.

## 8. Tests both sides keep

- Device: `src/luma-connect-sync/tests/test_apps_api*.py` against
  `tests/fake_hub.py`, which implements every route in this file.
- Hub: `deploy/hub/connect-sync/*.test.mjs` with the same vectors:
  `tests/vectors/apps-registry/` (a signed registry and its test key) and
  `tests/vectors/privacy-pass/` (a key pair, a TokenRequest, the blind
  signature and the finalized Token), generated by
  `tests/make_apps_vectors.py`.
