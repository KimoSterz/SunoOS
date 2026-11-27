#!/bin/sh
# Native Settings launcher: install only inside the private preview after PASS.
# The native application accepts this exact override before bus registration.
set -eu
preview_root="$HOME/.local/share/Suno-dev/SunoUI-settings"
exec toolbox run -c Suno-dev-f44 env \
  -u SUNO_SETTINGS_FIXTURE -u SUNO_SETTINGS_PAGE \
  -u SUNO_SETTINGS_VARIANT -u SUNO_SETTINGS_QUERY \
  -u SUNO_SETTINGS_SMOKE -u SUNO_SETTINGS_SMOKE_PHONE \
  -u GSETTINGS_BACKEND \
  SUNO_SETTINGS_APPLICATION_ID=org.gnome.Settings.SunoUIPreview \
  LD_LIBRARY_PATH="$preview_root/kit-prefix/lib64" \
  "$preview_root/bin/gnome-control-center" "$@"
