#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# The real Terminal over D-Bus in a headless Shell: a Flatpak-style app (bwrap,
# /.flatpak-info, xdg-dbus-proxy) opens a folder but cannot run a program by
# Open or RunProgram; Open over D-Bus never runs one; the host's RunProgram
# runs it; a downloaded program is typed, not run. Run as an ordinary user
# in a disposable container with the Luma Shell, VTE, bubblewrap and
# xdg-dbus-proxy; SOURCE is the luma-terminal source folder.
set -eu
SOURCE=${SOURCE:-/source/src/luma-terminal}
export HOME=/tmp/tc-home XDG_RUNTIME_DIR=/tmp/tc-run
rm -rf "$HOME" "$XDG_RUNTIME_DIR"; mkdir -p "$HOME/Downloads" "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
printf 'XDG_DOWNLOAD_DIR="$HOME/Downloads"\n' > /tmp/tc-dirs; mkdir -p "$HOME/.config"; cp /tmp/tc-dirs "$HOME/.config/user-dirs.dirs"
mkdir -p "$HOME/.config/glib-2.0/settings"
printf '[org/gnome/shell]\nwelcome-dialog-last-shown-version=%s\n' "'999'" > "$HOME/.config/glib-2.0/settings/keyfile"
export GSETTINGS_BACKEND=keyfile LIBGL_ALWAYS_SOFTWARE=1 LUMA_MUTTER_ALLOW_SOFTWARE_BLUR=1 GDK_BACKEND=wayland SHELL=/bin/bash
export DBUS_SYSTEM_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/system-bus
dbus-daemon --session --fork --nopidfile --address="$DBUS_SYSTEM_BUS_ADDRESS"
work=/tmp/tc-work; rm -rf $work; mkdir -p $work/folder
for name in program downloaded; do
  dir=$work; [ $name = downloaded ] && dir=$HOME/Downloads
  printf '#!/bin/sh\ntouch %s/ran-%s\n' "$work" "$name" > "$dir/$name"; chmod 755 "$dir/$name"
done
cat > $work/run.sh <<INNER
set -eu
gnome-shell --headless --no-x11 --virtual-monitor 1280x800 > $work/shell.log 2>&1 &
for _ in \$(seq 1 200); do ls "\$XDG_RUNTIME_DIR"/wayland-? >/dev/null 2>&1 && break; sleep 0.1; done
export WAYLAND_DISPLAY=\$(basename \$(ls "\$XDG_RUNTIME_DIR"/wayland-? | head -1))
# Terminal is not running: it is D-Bus-activated by an Open of a program.
mkdir -p "\$HOME/.local/share/dbus-1/services"
printf '[D-BUS Service]\nName=org.projectluma.Terminal\nExec=/usr/bin/env WAYLAND_DISPLAY=%s PYTHONPATH=%s python3 -m luma_terminal --gapplication-service\n' \
  "\$WAYLAND_DISPLAY" "$SOURCE" > "\$HOME/.local/share/dbus-1/services/org.projectluma.Terminal.service"
gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus --method org.freedesktop.DBus.ReloadConfig >/dev/null
gdbus call --session --dest org.projectluma.Terminal --object-path /org/projectluma/Terminal \
  --method org.freedesktop.Application.Open "['file://$work/program']" '{}' >/dev/null 2>&1 || true
sleep 5
[ -e $work/ran-program ] && echo "FAIL an Open that activated Terminal ran a program" || echo "PASS an Open that activates Terminal runs nothing"
gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \
  --method org.freedesktop.DBus.NameHasOwner org.projectluma.Terminal | grep -q true || echo "FAIL Terminal was not activated"
open_uri() { gdbus call --session --dest org.projectluma.Terminal --object-path /org/projectluma/Terminal \
  --method org.freedesktop.Application.Open "['\$1']" '{}' >/dev/null; }
printf '[Application]\nname=org.example.Evil\n' > $work/info
root=(--ro-bind /usr /usr --ro-bind /etc /etc --symlink usr/lib /lib --symlink usr/lib64 /lib64 --symlink usr/bin /bin
      --proc /proc --dev /dev --bind /tmp /tmp --ro-bind $work/info /.flatpak-info)
bwrap "\${root[@]}" xdg-dbus-proxy "\$DBUS_SESSION_BUS_ADDRESS" $work/proxy --filter --talk=org.projectluma.Terminal >/dev/null 2>&1 &
for _ in \$(seq 1 50); do [ -S $work/proxy ] && break; sleep 0.1; done
call() { "\$@" gdbus call --session --dest org.projectluma.Terminal --object-path /org/projectluma/Terminal --method "\${METHOD}" "\${ARGS[@]}" >/dev/null 2>&1; }
sandbox=(bwrap "\${root[@]}" --setenv DBUS_SESSION_BUS_ADDRESS unix:path=$work/proxy)
check() { sleep 4; if [ -e "\$1" ]; then echo "\$2"; else echo "\$3"; fi; }
METHOD=org.projectluma.Terminal1.RunProgram ARGS=("file://$work/program" '{}'); call "\${sandbox[@]}" || true
check $work/ran-program "FAIL a sandboxed app ran a program with RunProgram" "PASS a sandboxed app cannot RunProgram"
METHOD=org.freedesktop.Application.Open ARGS=("['file://$work/program']" '{}'); call "\${sandbox[@]}" || true
check $work/ran-program "FAIL a sandboxed app ran a program with Open" "PASS a sandboxed app's Open does not run a program"
call env || true
check $work/ran-program "FAIL Open over D-Bus ran a program" "PASS Open over D-Bus does not run a program"
METHOD=org.freedesktop.Application.Open ARGS=("['file://$work/folder']" '{}'); call "\${sandbox[@]}" || true
sleep 3
cwds=\$(for p in \$(pgrep -u \$(id -u) -x bash); do readlink /proc/\$p/cwd; done | sort -u)
echo "\$cwds" | grep -qx $work/folder && echo "PASS a sandboxed app opens a folder" || echo "FAIL no session in the folder: \$cwds"
METHOD=org.projectluma.Terminal1.RunProgram ARGS=("file://\$HOME/Downloads/downloaded" '{}'); call env || echo "FAIL RunProgram refused the host"
check $work/ran-downloaded "FAIL a downloaded program ran without Return" "PASS a downloaded program waits for Return"
for bad in "a\$(printf '\025')b" "a\$(printf '\017')b" "a\$(printf '\033')b" "a
b"; do
  printf '#!/bin/sh\ntouch %s/ran-bad\n' "$work" > "\$HOME/Downloads/\$bad"; chmod 755 "\$HOME/Downloads/\$bad"
  uri=\$(python3 -c 'import sys, pathlib; print(pathlib.Path(sys.argv[1]).as_uri())' "\$HOME/Downloads/\$bad")
  METHOD=org.projectluma.Terminal1.RunProgram ARGS=("\$uri" '{}')
  if call env; then echo "FAIL a name with a control character was accepted"; else echo "PASS a name with a control character is refused"; fi
done
check $work/ran-bad "FAIL a control-character program ran" "PASS no control-character program ran"
# A git-aware prompt in a folder an app chose: its planted fsmonitor stays off.
git init -q $work/repo
printf '#!/bin/sh\ntouch %s/ran-fsmonitor\n' "$work" > $work/fsmonitor; chmod 755 $work/fsmonitor
git -C $work/repo config core.fsmonitor $work/fsmonitor
printf 'PROMPT_COMMAND="git status >/dev/null 2>&1"\n' > "\$HOME/.bashrc"
METHOD=org.freedesktop.Application.Open ARGS=("['file://$work/repo']" '{}'); call "\${sandbox[@]}" || true
check $work/ran-fsmonitor "FAIL a planted fsmonitor ran in an app's folder" "PASS a planted fsmonitor stays off in an app's folder"
# Files' Open in Terminal (Terminal1.Open) from the host: the person's session.
git init -q $work/repo2
printf '#!/bin/sh\ntouch %s/ran-fsmonitor2\n' "$work" > $work/fsmonitor2; chmod 755 $work/fsmonitor2
git -C $work/repo2 config core.fsmonitor $work/fsmonitor2
METHOD=org.projectluma.Terminal1.Open ARGS=("['file://$work/repo2']" '{}'); call env || echo "FAIL Terminal1.Open refused the host"
check $work/ran-fsmonitor2 "PASS Terminal1.Open from the host gives the person's own session" "FAIL Terminal1.Open was guarded"
METHOD=org.projectluma.Terminal1.Open ARGS=("['file://$work/repo']" '{}'); call "\${sandbox[@]}" || true
check $work/ran-fsmonitor "FAIL an app's Terminal1.Open ran the planted fsmonitor" "PASS an app's Terminal1.Open is guarded"
cd "$SOURCE" && python3 -m luma_terminal $work/repo >/dev/null 2>&1; cd /
check $work/ran-fsmonitor "PASS the person's own launch is unchanged (git runs as configured)" "FAIL the person's launch was guarded too"
cd "$SOURCE" && python3 -m luma_terminal $work/program >/dev/null 2>&1; cd /
check $work/ran-program "PASS luma-terminal PROGRAM runs it through RunProgram" "FAIL luma-terminal PROGRAM did not run it"
kill \$(jobs -p) 2>/dev/null || true
INNER
timeout 120 dbus-run-session -- bash $work/run.sh
