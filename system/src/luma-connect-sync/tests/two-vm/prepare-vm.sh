#!/bin/bash
# Runs as root inside a test VM (stdin of `vm.sh ssh`): a person signed in by
# GDM, and luma-connect-sync installed for them the way a user-level preview
# is (no image change): ~/.local/lib, a user unit and D-Bus activation file.
# Expects /root/lcs.tgz (src/luma-connect-sync). Prints JSON lines.
set -euo pipefail
user=luma-sync
home=/home/$user
id "$user" >/dev/null 2>&1 || useradd -m -c "Sync Test" "$user"
passwd -d "$user" >/dev/null
# The greeter signs a passwordless sole account straight in, so a session (and its user manager) can start
# while this script runs: every folder in the home is made by the person, never root, so systemd-tmpfiles
# never sees a root-owned step in the path ("unsafe path transition" fails the session bus).
runuser -u "$user" -- install -d "$home/.config/systemd/user" "$home/.local/lib" "$home/.local/share/dbus-1/services" "$home/.local/bin"
printf yes > "$home/.config/gnome-initial-setup-done"
python3 - <<'PY'
import configparser
path = "/etc/gdm/custom.conf"
c = configparser.ConfigParser(strict=False, interpolation=None)
c.optionxform = str
c.read(path)
c.has_section("daemon") or c.add_section("daemon")
c.set("daemon", "AutomaticLoginEnable", "True")
c.set("daemon", "AutomaticLogin", "luma-sync")
c.set("daemon", "InitialSetupEnable", "False")
with open(path, "w") as f:
    c.write(f)
PY
lib=$home/.local/lib/luma-connect-sync
rm -rf "$lib" && runuser -u "$user" -- install -d "$lib" && tar -xzf /root/lcs.tgz -C "$lib"
cat > "$home/.config/systemd/user/luma-connect-syncd.service" <<UNIT
[Unit]
Description=Luma Connect Sync (user-level preview)
After=graphical-session.target

[Service]
Type=dbus
BusName=org.projectluma.ConnectSync1
Environment=PYTHONPATH=$lib
ExecStart=/usr/bin/python3 $lib/bin/luma-connect-syncd
Nice=10
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
UNIT
printf '[D-BUS Service]\nName=org.projectluma.ConnectSync1\nExec=/usr/bin/false\nSystemdService=luma-connect-syncd.service\n' \
  > "$home/.local/share/dbus-1/services/org.projectluma.ConnectSync1.service"
printf '#!/bin/sh\nPYTHONPATH=%s exec /usr/bin/python3 %s/bin/luma-sync "$@"\n' "$lib" "$lib" > "$home/.local/bin/luma-sync"
chmod 0755 "$home/.local/bin/luma-sync"
chown -R "$user:$user" "$home/.config" "$home/.local"
# A session the greeter started early saw a half-made home: end it so GDM's sign-in starts a fresh user manager.
loginctl terminate-user "$user" 2>/dev/null || true
systemctl stop "user@$(id -u "$user").service" 2>/dev/null || true
loginctl enable-linger "$user"
systemctl restart gdm
for _ in $(seq 1 80); do
  s=$(loginctl list-sessions --no-legend | awk -v u="$user" '$3 == u {print $1}' | head -1)
  if [ -n "$s" ] && [ "$(loginctl show-session "$s" -p State --value)" = active ] && [ -S "/run/user/$(id -u "$user")/bus" ]; then
    echo "{\"check\": \"session\", \"result\": \"pass\", \"detail\": \"$s $(loginctl show-session "$s" -p Type --value)\"}"
    exit 0
  fi
  sleep 3
done
echo '{"check": "session", "result": "fail", "detail": "no active session"}'
exit 1
