#!/bin/sh
# Facts package indices do not carry, from Debian Code Search's plain-text API
# (searches Debian's source packages; nothing is downloaded but the matches):
# polkit exec.path annotations, launchers with Terminal=true, NoDisplay=true or
# pkexec in Exec, and setuid/setgid/capability evidence in packaging.
#   codesearch.sh <directory>
set -eu
out=${1:?directory}/codesearch
mkdir -p "$out"
api=https://codesearch.debian.net/grep
query() {  # name, url-encoded query string
  [ -s "$out/$1.txt" ] && return 0
  for attempt in 1 2 3 4 5; do
    curl -fsS "$api?limit=-1&$2" -o "$out/$1.part" || true
    if [ -s "$out/$1.part" ] && ! grep -q "too many queries" "$out/$1.part"; then
      mv "$out/$1.part" "$out/$1.txt"; sleep 6; return 0
    fi
    sleep 30
  done
  echo "failed: $1" >&2; return 1
}
query exec-path 'q=org.freedesktop.policykit.exec.path+path:%5C.policy'
query terminal 'q=Terminal%3Dtrue+path:%5C.desktop'
query nodisplay 'q=NoDisplay%3Dtrue+path:%5C.desktop'
query hidden 'q=Hidden%3Dtrue+path:%5C.desktop'
query desktop-entries 'q=%5BDesktop+Entry%5D+path:%5C.desktop'
query exec-pkexec 'regexp=1&q=%5EExec%3D.*pkexec+path:%5C.desktop'
query exec-sudo 'regexp=1&q=%5EExec%3D.*(gksu|kdesu|su-to-root|sudo+)+path:%5C.desktop'
query lintian-elevated 'q=elevated-privileges+path:%5Edebian%2F'
query lintian-setuid 'regexp=1&q=set%5Bug%5Did-binary+path:%5Edebian%2F'
query rules-chmod 'regexp=1&q=chmod%5Cs%2B(-%5BRvf%5D%2B%5Cs%2B)*(0%3F%5B2467%5D%5B0-7%5D%7B3%7D%7C%5Bugoa%5D*%5C%2B%5Brwx%5D*s)%5Cs+path:%5Edebian%2F'
query statoverride 'q=dpkg-statoverride+path:%5Edebian%2F'
query setcap 'q=setcap+path:%5Edebian%2F'
# Exec lines of the launchers of every source with an exec.path policy: tells an
# application's own program (an optional root mode) from a separate privileged one.
sources=$(sed -n 's/^\([^_/]*\)_.*/\1/p' "$out/exec-path.txt" | sort -u | tr '\n' '|' | sed 's/|$//; s/+/%5C%2B/g')
query exec-lines "regexp=1&q=%5EExec%3D+path:%5C.desktop+package:%5E($sources)%24"
date -u +%FT%TZ > "$out/FETCHED"
