#!/bin/sh
# Run through host only after the full Ari conform gate passes.
# This installs only Ari's contained preview and its separate user launcher.
set -eu
ari_worktree=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
ari_preview_root="$HOME/.local/share/Suno-dev/SunoUI-ari"
ari_launcher="$HOME/.local/share/applications/org.projectSuno.Ari.SunoUIPreview.desktop"
# Sync kit files without publishing the helper's Prairie-specific launcher.
SUNOUI_HOST=local SUNOUI_WORKTREE="$ari_worktree" \
  SUNOUI_DEST=.local/share/Suno-dev/SunoUI-ari SUNOUI_LAUNCHER= \
  sh "$HOME/Documents/SunoDesign/tools/sync-SunoUI-preview.sh"
rsync -a --exclude __pycache__ "$ari_worktree/src/Suno-ari/ari" \
  "$ari_worktree/src/Suno-ari/ari_ui" "$ari_preview_root/python/"
rsync -a "$ari_worktree/src/Suno-ari/data/" "$ari_preview_root/python/data/"
ari_run_tmp=$(mktemp "$ari_preview_root/bin/.ari-run.XXXXXX")
ari_launcher_tmp=$(mktemp "$ari_preview_root/.ari-launcher.XXXXXX")
trap 'rm -f "$ari_run_tmp" "$ari_launcher_tmp"' EXIT
cat > "$ari_run_tmp" <<'RUN'
#!/bin/sh
set -eu
ari_preview_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
# Closing an existing preview must still work after installed package versions
# change. Ordinary launches retain the BASE-NVR compatibility guard.
if [ "$#" -ne 1 ] || [ "$1" != "--close-preview" ]; then
while read -r ari_package ari_nvr; do
  ari_have=$(rpm -q --qf '%{VERSION}-%{RELEASE}' "$ari_package" 2>/dev/null) || ari_have=
  if [ "$ari_have" != "$ari_nvr" ]; then
    echo "Ari preview: $ari_package differs from the preview's BASE-NVR; re-sync first." >&2
    exit 3
  fi
done < "$ari_preview_root/BASE-NVR"
fi
export SUNO_ARI_PREVIEW=1
unset SUNO_ARI_FIXTURE
export PYTHONPATH="$ari_preview_root/python"
export SUNO_APPKIT_ICON_PATH="$ari_preview_root/python/icons"
exec python3 -m ari_ui.SunoUI_app "$@"
RUN
chmod 755 "$ari_run_tmp"
mv "$ari_run_tmp" "$ari_preview_root/bin/run"
cat > "$ari_launcher_tmp" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Ari (SunoUI preview)
Comment=Ari rebuilt on SunoUI, under its own application identity
Exec="$ari_preview_root/bin/run"
Icon=org.projectSuno.Ari
Terminal=false
Categories=Utility;
StartupNotify=true
StartupWMClass=org.projectSuno.Ari.SunoUIPreview
DESKTOP
chmod 644 "$ari_launcher_tmp"
mv "$ari_launcher_tmp" "$ari_launcher"
printf '%s\n' "Ari preview installed; launcher: $ari_preview_root/bin/run"
