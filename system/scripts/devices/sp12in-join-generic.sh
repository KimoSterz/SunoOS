#!/usr/bin/bash
# SPDX-License-Identifier: Apache-2.0
#
# One-time move of a Surface Pro 12-inch (microsoft,sp12in) from its private
# per-device stream (luma/1/aarch64/microsoft-sp12in/<channel>, a Surface image
# with the kernel and owner firmware in /usr) to the generic ARM stream with the
# Surface device repository, the way every later Surface install runs:
#
#   generic ARM commit (luma/1/aarch64/<channel>)
#   + rpm-ostree override: Fedora's kernel packages removed, kernel-surface-pro12
#     layered from https://dl.simplyluma.com/os/devices/aarch64/microsoft-sp12in/
#     (signed with the Luma OS Release key; the kernel and its device tree)
#   + the owner firmware this Surface already has, kept in /etc/luma/device-firmware
#     (never redistributed), in the initramfs (rpm-ostree initramfs-etc) and
#     found by the kernel through firmware_class.path.
#
# usage: sp12in-join-generic.sh [--dry-run] [--commit CHECKSUM] [--channel CHANNEL]
#
# --dry-run checks everything and prints each step without changing anything.
# Without it the script stages the new deployment and stops; nothing restarts.
# Restart when ready. The current deployment stays in the boot menu as the
# rollback entry. Before the restart, `rpm-ostree cleanup -p` undoes the stage.
#
# Idempotent: an already-joined system reports so and changes nothing; a
# pending deployment from an earlier run is discarded and staged again.
# Every step is logged to /var/tmp/luma-sp12in-join-<UTC time>.log.
set -euo pipefail

DEVICE_COMPATIBLE=microsoft,surface-pro-12in
REPO_ID=luma-microsoft-sp12in
# A mirror of the device repository may stand in (SP12IN_DEVICE_REPO_URL, for
# tests); repomd.xml and every package are still checked against the release key.
REPO_URL=${SP12IN_DEVICE_REPO_URL:-https://dl.simplyluma.com/os/devices/aarch64/microsoft-sp12in/}
REPO_FILE=/etc/yum.repos.d/$REPO_ID.repo
RPM_KEY=/etc/pki/rpm-gpg/RPM-GPG-KEY-luma-os-release
OSTREE_KEY=/etc/pki/ostree/luma-release.gpg
KEY_FPR=7D3DAFCE2BCA13A2B68F2761C8CE1A1B51D96CE2
FIRMWARE_DIR=/etc/luma/device-firmware
INPUTS=/usr/share/luma/device/hardware-inputs.json
KERNEL_PACKAGE=kernel-surface-pro12
FEDORA_KERNEL=(kernel kernel-core kernel-modules kernel-modules-core kernel-modules-extra)
LAYER_MARKER=/var/lib/luma-device-layer/layered

dry_run=0 commit="" channel=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=1; shift ;;
    --commit) commit=${2:?}; shift 2 ;;
    --channel) channel=${2:?}; shift 2 ;;
    *) sed -n 's/^# usage: /usage: /p' "$0" >&2; exit 2 ;;
  esac
done

log_file=/var/tmp/luma-sp12in-join-$(date -u +%Y%m%dT%H%M%SZ).log
if [ "$(id -u)" = 0 ]; then
  exec > >(tee -a "$log_file") 2>&1
fi
say() { printf '== %s %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
fail() { say "STOPPED: $*"; say "nothing more was changed; log: $log_file"; exit 1; }
run() {  # a step that changes the system
  if [ "$dry_run" = 1 ]; then say "would run: $*"; return 0; fi
  say "run: $*"; "$@"
}

[ "$(id -u)" = 0 ] || { echo "run as root: sudo bash $0 $*" >&2; exit 1; }
say "Surface Pro 12-inch: join the generic ARM stream ($([ "$dry_run" = 1 ] && echo 'dry run, nothing changes' || echo 'for real'))"
say "log: $log_file"

# 1. This must be a Surface Pro 12-inch on an OSTree system.
[ "$(uname -m)" = aarch64 ] || fail "not an ARM (aarch64) system"
dt=/sys/firmware/devicetree/base/compatible  # /proc/device-tree/compatible
[ -r "$dt" ] || fail "no device tree: this is not a Surface Pro 12-inch running Luma"
tr '\0' '\n' <"$dt" | grep -Fxq "$DEVICE_COMPATIBLE" ||
  fail "device tree is $(tr '\0' ' ' <"$dt"), not $DEVICE_COMPATIBLE"
[ -e /run/ostree-booted ] || fail "not booted from OSTree"
command -v rpm-ostree >/dev/null || fail "rpm-ostree is missing"
say "device tree: $(tr '\0' ' ' <"$dt")"
say "kernel: $(uname -r)"

status=$(rpm-ostree status --json)
field() { python3 -c "$1" <<<"$status"; }
booted_origin=$(field 'import json,sys; d=[x for x in json.load(sys.stdin)["deployments"] if x.get("booted")][0]; print(d.get("container-image-reference") or d.get("origin",""))')
booted_requested=$(field 'import json,sys; d=[x for x in json.load(sys.stdin)["deployments"] if x.get("booted")][0]; print(" ".join(d.get("requested-packages",[])))')
pending=$(field 'import json,sys; ds=json.load(sys.stdin)["deployments"]; b=[i for i,x in enumerate(ds) if x.get("booted")][0]; print(ds[0]["checksum"] if b != 0 else "")')
say "booted origin: $booted_origin"
[ -z "$booted_requested" ] || say "booted layered packages: $booted_requested"
remote=${booted_origin%%:*}
ref=${booted_origin#*:}
[ "$remote" != "$booted_origin" ] && [ -n "$remote" ] || fail "booted origin '$booted_origin' names no OSTree remote"

# 2. Already joined? Then there is nothing to do.
case "$ref" in
  luma/1/aarch64/microsoft-sp12in/*)
    channel=${channel:-${ref##*/}} ;;
  luma/1/aarch64/*)
    if [[ " $booted_requested " == *" $KERNEL_PACKAGE "* ]]; then
      say "ALREADY-JOINED: booted from $booted_origin with $KERNEL_PACKAGE from the device repository"
      exit 0
    fi
    fail "booted from the generic stream $booted_origin without $KERNEL_PACKAGE: not the state this script starts from" ;;
  *) fail "unexpected origin $booted_origin" ;;
esac
case "$channel" in nightly|beta|stable) ;; *) fail "unsupported channel '$channel'" ;; esac
target_ref=luma/1/aarch64/$channel
say "moving $remote:$ref -> $remote:$target_ref (+ $KERNEL_PACKAGE override)"
[ -z "$commit" ] || [[ "$commit" =~ ^[0-9a-f]{64}$ ]] || fail "--commit must be a full 64-character checksum"

# 3. The remote is the official one.
mirrors=/etc/luma/update-mirrorlist
if [ -f "$mirrors" ]; then
  while read -r url; do
    [ -z "$url" ] || [[ "$url" == \#* ]] && continue
    case "$url" in
      https://dl.simplyluma.com/*|https://media.simplyluma.com/*) ;;
      *) fail "$mirrors lists $url, not the official repository (a LAN test mirror left behind? restore $mirrors.before-lan first)" ;;
    esac
  done <"$mirrors"
  say "mirror list: $(grep -v '^#' "$mirrors" | tr '\n' ' ')"
fi
ostree remote show-url "$remote" >/dev/null || fail "OSTree remote $remote is not configured"
grep -Eq '^gpg-verify=true' "/etc/ostree/remotes.d/$remote.conf" 2>/dev/null ||
  fail "remote $remote does not verify signatures (/etc/ostree/remotes.d/$remote.conf)"

# 4. The release key, armored for rpm (the device repository's packages and repomd.xml).
[ -s "$OSTREE_KEY" ] || fail "$OSTREE_KEY is missing"
gpg_home=$(mktemp -d)
trap 'rm -rf "$gpg_home"' EXIT
fpr_of() { gpg --homedir "$gpg_home" --batch --with-colons --show-keys "$1" 2>/dev/null | awk -F: '$1=="fpr"{print $10; exit}'; }
[ "$(fpr_of "$OSTREE_KEY")" = "$KEY_FPR" ] || fail "$OSTREE_KEY is not the Luma OS Release key"
if [ -s "$RPM_KEY" ] && [ "$(fpr_of "$RPM_KEY")" = "$KEY_FPR" ]; then
  say "rpm key: $RPM_KEY (Luma OS Release key)"
  key_text=""
else
  gpg --homedir "$gpg_home" --batch --quiet --import "$OSTREE_KEY" 2>/dev/null
  key_text=$(gpg --homedir "$gpg_home" --batch --armor --export "$KEY_FPR")
  [ -n "$key_text" ] || fail "cannot export the release key for rpm"
  say "rpm key: will write $RPM_KEY from $OSTREE_KEY ($KEY_FPR)"
fi

# 5. The device repository serves a signed kernel-surface-pro12.
tmp=$(mktemp -d)
trap 'rm -rf "$gpg_home" "$tmp"' EXIT
curl -fsS --max-time 60 -o "$tmp/repomd.xml" "${REPO_URL}repodata/repomd.xml" || fail "cannot reach $REPO_URL"
curl -fsS --max-time 60 -o "$tmp/repomd.xml.asc" "${REPO_URL}repodata/repomd.xml.asc" || fail "the device repository has no repomd.xml.asc"
gpg --homedir "$gpg_home" --batch --quiet --import "$OSTREE_KEY" 2>/dev/null
gpg --homedir "$gpg_home" --batch --status-fd 1 --verify "$tmp/repomd.xml.asc" "$tmp/repomd.xml" 2>/dev/null |
  grep -q "^\[GNUPG:\] VALIDSIG $KEY_FPR" || fail "repomd.xml of $REPO_URL is not signed by the Luma OS Release key"
say "device repository: $REPO_URL (repomd signature good)"

# 6. The target commit exists and carries a luma-update that admits this Surface.
if [ -n "$commit" ]; then
  say "target: $remote:$target_ref at $commit"
else
  head=$(curl -fsS --max-time 60 "https://dl.simplyluma.com/os/repo/refs/heads/$target_ref" || true)
  [[ "$head" =~ ^[0-9a-f]{64}$ ]] || fail "cannot read the head of $target_ref"
  say "target: $remote:$target_ref (head now $head)"
fi

# 7. The owner firmware this Surface boots with today, checked against its record.
[ -s "$INPUTS" ] || fail "$INPUTS is missing: this Surface image has no recorded firmware"
mapfile -t firmware < <(python3 - "$INPUTS" <<'PY'
import json, re, sys
data = json.load(open(sys.argv[1]))
if data.get("device") != "microsoft/sp12in":
    sys.exit("hardware inputs are not for microsoft/sp12in")
for row in data["files"]:
    path = row["path"]
    if path.startswith("rootfs/usr/lib/firmware/"):
        rel = path[len("rootfs/usr/lib/firmware/"):]
        if not re.fullmatch(r"[A-Za-z0-9_+.-]+(/[A-Za-z0-9_+.-]+)*", rel) or ".." in rel.split("/"):
            sys.exit("unsafe firmware path " + rel)
        print(row["sha256"] + " " + rel)
PY
) || fail "cannot read $INPUTS"
[ "${#firmware[@]}" -gt 0 ] || fail "no firmware rows in $INPUTS"
track=()
for row in "${firmware[@]}"; do
  sum=${row%% *} rel=${row#* }
  src=/usr/lib/firmware/$rel dst=$FIRMWARE_DIR/$rel
  if [ -f "$dst" ] && [ "$(sha256sum "$dst" | cut -d' ' -f1)" = "$sum" ]; then
    :
  else
    [ -f "$src" ] || fail "firmware $src is missing"
    [ "$(sha256sum "$src" | cut -d' ' -f1)" = "$sum" ] || fail "firmware $src does not match its recorded hash"
  fi
  track+=("--track=$dst")
done
say "owner firmware: ${#firmware[@]} files verified, kept in $FIRMWARE_DIR"

# 8. Nothing else may be pending.
if [ -n "$pending" ]; then
  say "a pending deployment ($pending) exists; it is discarded and staged again"
  run rpm-ostree cleanup -p
fi

say "checks passed"
[ "$dry_run" = 1 ] && say "the steps below are what a real run does"

# 9. /etc: firmware copy, rpm key, device repository, update settings.
for row in "${firmware[@]}"; do
  sum=${row%% *} rel=${row#* }
  dst=$FIRMWARE_DIR/$rel
  if [ -f "$dst" ] && [ "$(sha256sum "$dst" | cut -d' ' -f1)" = "$sum" ]; then continue; fi
  run install -D -m 0644 "/usr/lib/firmware/$rel" "$dst"
done
[ "$dry_run" = 1 ] || restorecon -R "$FIRMWARE_DIR" 2>/dev/null || true
if [ -n "$key_text" ]; then
  if [ "$dry_run" = 1 ]; then say "would write $RPM_KEY"; else
    install -d -m 0755 "$(dirname "$RPM_KEY")"; printf '%s\n' "$key_text" >"$RPM_KEY"; chmod 0644 "$RPM_KEY"
    [ "$(fpr_of "$RPM_KEY")" = "$KEY_FPR" ] || fail "written $RPM_KEY is not the release key"; say "wrote $RPM_KEY"; fi
fi
excludes=""
[ ! -s /usr/share/luma/luma-owned-packages.txt ] || excludes=$(grep -vx "$KERNEL_PACKAGE" /usr/share/luma/luma-owned-packages.txt | paste -sd, -)
repo_text="# Surface Pro 12-inch device packages (luma-device-layer): the Surface kernel,
# which this computer runs as an rpm-ostree override of the Luma OS.
[$REPO_ID]
name=Luma Surface Pro 12-inch
baseurl=$REPO_URL
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=file://$RPM_KEY
includepkgs=$KERNEL_PACKAGE"
[ -z "$excludes" ] || repo_text+="
excludepkgs=$excludes"
if [ "$dry_run" = 1 ]; then say "would write $REPO_FILE:"; printf '%s\n' "$repo_text" | sed 's/^/    /'
elif [ "$(cat "$REPO_FILE" 2>/dev/null)" != "$repo_text" ]; then
  printf '%s\n' "$repo_text" >"$REPO_FILE"; chmod 0644 "$REPO_FILE"; restorecon "$REPO_FILE" 2>/dev/null || true; say "wrote $REPO_FILE"
fi
# Settings that pinned the old stream: kept in update.conf.before-generic, removed here.
if [ -f /etc/luma/update.conf ]; then
  python3 - /etc/luma/update.conf "$dry_run" <<'PY' || fail "cannot update /etc/luma/update.conf"
import configparser, shutil, sys
path, dry = sys.argv[1], sys.argv[2] == "1"
c = configparser.ConfigParser(interpolation=None); c.read(path)
drop = [k for k in ("hardware_target", "ref_template", "graph_url", "allow_insecure_urls")
        if c.has_option("update", k)]
if not drop:
    print("== /etc/luma/update.conf pins nothing")
    sys.exit(0)
for k in drop:
    print(f"== {'would remove' if dry else 'remove'} /etc/luma/update.conf {k} = {c.get('update', k)}")
if not dry:
    shutil.copy2(path, path + ".before-generic")
    for k in drop:
        c.remove_option("update", k)
    with open(path, "w") as f:
        c.write(f)
PY
fi

# 10. Stage: firmware in the initramfs and its kernel argument (on the current
# commit, which still boots as before), then the generic commit with the
# Surface kernel override. The rebase is staged with finalization locked, so a
# restart before the override is staged boots the current system.
run systemctl stop luma-updated.service 2>/dev/null || true
run rpm-ostree initramfs-etc "${track[@]}"
if ! grep -qw "firmware_class.path=$FIRMWARE_DIR" /proc/cmdline; then
  run rpm-ostree kargs --append-if-missing="firmware_class.path=$FIRMWARE_DIR"
fi
run rpm-ostree rebase --bypass-driver --lock-finalization "$remote:$target_ref" ${commit:+"$commit"}
args=(override remove "${FEDORA_KERNEL[@]}" "--install=$KERNEL_PACKAGE")
run rpm-ostree "${args[@]}"

if [ "$dry_run" = 1 ]; then
  say "DRY-RUN-DONE: nothing was changed. Run again without --dry-run to stage the move."
  exit 0
fi

# 11. Check what was staged before anyone restarts into it.
rpm-ostree status --json >"$tmp/status.json"
python3 - "$tmp/status.json" "$KERNEL_PACKAGE" "$remote:$target_ref" "$FIRMWARE_DIR" <<'PY' || { say "the staged deployment failed its checks: rpm-ostree cleanup -p"; rpm-ostree cleanup -p; fail "staged deployment rejected"; }
import json, sys, glob, os, importlib.util
status, pkg, refspec, fwdir = sys.argv[1:5]
ds = json.load(open(status))["deployments"]
s = ds[0]
assert not s.get("booted"), "no new deployment is staged"
assert s.get("origin") == refspec, f"staged origin {s.get('origin')} is not {refspec}"
assert pkg in s.get("requested-packages", []), f"{pkg} is not layered"
assert "kernel-core" in s.get("requested-base-removals", []), "Fedora's kernel is not removed"
root = f"/ostree/deploy/{s['osname']}/deploy/{s['checksum']}.{s['serial']}"
mods = [os.path.basename(p) for p in glob.glob(root + "/usr/lib/modules/*") if os.path.isfile(p + "/vmlinuz")]
assert len(mods) == 1 and "surface12" in mods[0], f"staged kernels: {mods}"
k = root + "/usr/lib/modules/" + mods[0]
assert os.path.isfile(k + "/devicetree"), "the Surface kernel's devicetree is missing"
assert os.path.isfile(k + "/initramfs.img"), "no initramfs for the Surface kernel"
spec = importlib.util.spec_from_file_location("hw", glob.glob(root + "/usr/lib/python3*/site-packages/luma_update/hardware.py")[0])
hw = importlib.util.module_from_spec(spec); spec.loader.exec_module(hw)
assert hw.DEVICES[hw.SP12IN][3] is False, "the staged luma-update still requires the Surface's own stream"
print("== staged:", s["checksum"][:12], s.get("version", ""), "kernel", mods[0], "base", s.get("base-checksum", "")[:12])
PY
# Device-package updates (newer Surface kernels between OS updates) are offered
# for a system with a device-layer repository (luma-update device_repo.py).
install -d -m 0755 "$(dirname "$LAYER_MARKER")"
date -u +%FT%TZ >"$LAYER_MARKER"
say "STAGED: restart when ready (the current system stays in the boot menu as the rollback entry)"
say "undo before restarting: sudo rpm-ostree cleanup -p"
say "log: $log_file"
