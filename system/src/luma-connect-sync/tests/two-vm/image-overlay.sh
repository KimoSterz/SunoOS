#!/bin/bash
# Runs as root inside a test VM (stdin of `vm.sh ssh`), after prepare-vm.sh.
#   image-overlay.sh preview-off   the person's user-level preview goes; the image's own package answers again
#   image-overlay.sh install       and /root/lcs.tgz (src/luma-connect-sync) goes where the package puts it, in an
#                                  /usr overlay a reboot drops (ostree admin unlock): the packaged unit, /usr/bin and
#                                  site-packages, so the service runs exactly as an installed one does
# Prints JSON lines.
set -euo pipefail
mode=${1:?preview-off or install}
u=luma-sync; home=/home/$u; uid=$(id -u $u)
rm -f "$home/.config/systemd/user/luma-connect-syncd.service" "$home/.local/share/dbus-1/services/org.projectluma.ConnectSync1.service" \
  "$home/.local/bin/luma-sync"
rm -rf "$home/.local/lib/luma-connect-sync"
if [ "$mode" = install ]; then
  [ -w /usr/bin ] || ostree admin unlock >/dev/null
  # The package's own site-packages (rpm -ql), not Python's default for root (/usr/local, which is /var/usrlocal).
  site=$(dirname "$(dirname "$(rpm -ql luma-connect-sync | grep '/luma_connect_sync/__init__.py$')")")
  rm -rf "/usr/local/lib/python3"*/site-packages/luma_connect_sync
  src=$(mktemp -d); tar -xzf /root/lcs.tgz -C "$src"
  rm -rf "$site/luma_connect_sync"
  install -d "$site/luma_connect_sync/apps_api"
  install -m 0644 "$src"/luma_connect_sync/*.py "$src/luma_connect_sync/bip39-english.txt" "$site/luma_connect_sync/"
  install -m 0644 "$src"/luma_connect_sync/apps_api/*.py "$site/luma_connect_sync/apps_api/"
  install -m 0755 "$src/bin/luma-sync" "$src/bin/luma-connect-syncd" /usr/bin/
  install -m 0644 "$src/data/luma-connect-syncd.service" /usr/lib/systemd/user/luma-connect-syncd.service
  python3 -m compileall -q "$site/luma_connect_sync"
  restorecon -RF "$site/luma_connect_sync" /usr/bin/luma-sync /usr/bin/luma-connect-syncd /usr/lib/systemd/user/luma-connect-syncd.service
  rm -rf "$src"
fi
if [ "$mode" = install ]; then
  # The Shell and Settings must run from the /usr the service sees: a Shell started before the overlay runs a file
  # on the old /usr device, which the caller check (rightly) doesn't take for /usr/bin/gnome-shell. Sign in again.
  loginctl terminate-user "$u" 2>/dev/null || true
  systemctl restart gdm
  for _ in $(seq 1 100); do
    s=$(loginctl list-sessions --no-legend | awk -v u="$u" '$3 == u {print $1}' | head -1)
    [ -n "$s" ] && [ "$(loginctl show-session "$s" -p State --value)" = active ] && [ -S "/run/user/$uid/bus" ] && \
      pgrep -u "$u" -x gnome-shell >/dev/null && break
    sleep 3
  done
  sleep 10
fi
env="XDG_RUNTIME_DIR=/run/user/$uid DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$uid/bus"
runuser -u $u -- env $env systemctl --user daemon-reload
runuser -u $u -- env $env systemctl --user restart luma-connect-syncd
sleep 2
unit=$(runuser -u $u -- env $env systemctl --user show -p FragmentPath --value luma-connect-syncd)
pid=$(runuser -u $u -- env $env systemctl --user show -p MainPID --value luma-connect-syncd)
module=$(runuser -u $u -- env $env python3 -c 'import luma_connect_sync, os; print(os.path.dirname(luma_connect_sync.__file__))')
callers=$( [ -f "$module/callers.py" ] && sha256sum "$module/callers.py" | cut -c1-12 || echo none)
shell=$(pgrep -u "$u" -x gnome-shell | head -1)
same=$( [ -n "$shell" ] && [ "$(stat -L -c %d:%i /proc/$shell/exe)" = "$(stat -c %d:%i /usr/bin/gnome-shell)" ] && echo yes || echo no)
echo "{\"check\": \"$mode\", \"shell_runs_usr_bin_gnome_shell\": \"$same\", \"unit\": \"$unit\", \"pid\": \"$pid\", \"module\": \"$module\", \"callers_py\": \"$callers\", \"rpm\": \"$(rpm -q luma-connect-sync)\"}"
