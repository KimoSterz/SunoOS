#!/bin/sh
# Install Calculator's separate, source-only SunoUI preview after the gate passes.
set -eu

src=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
dest="$HOME/.local/share/Suno-dev/SunoUI-calc"
launcher="$HOME/.local/share/applications/org.projectSuno.Calc.SunoUIPreview.desktop"

SUNOUI_HOST=local SUNOUI_WORKTREE="$src" \
  SUNOUI_DEST=.local/share/Suno-dev/SunoUI-calc SUNOUI_LAUNCHER=calc \
  sh "$HOME/Documents/SunoDesign/tools/sync-SunoUI-preview.sh"

rsync -a --delete --exclude __pycache__ "$src/src/Suno-calculator/Suno_calc/" "$dest/python/Suno_calc/"
mkdir -p "$dest/python/style" "$dest/python/icons/hicolor/scalable/apps"
cp "$src/src/Suno-calculator/style/calculator.css" "$dest/python/style/calculator.css"
cp "$src/src/Suno-calculator/icons/hicolor/scalable/apps/Suno-v3-calculator.svg" \
  "$dest/python/icons/hicolor/scalable/apps/Suno-v3-calculator.svg"

cat > "$dest/bin/calc-preview" <<'RUN'
#!/bin/sh
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export PYTHONPATH="$here/python"
export SUNO_APPKIT_ICON_PATH="$here/python/icons"
export SUNO_CALC_STYLE_PATH="$here/python/style/calculator.css"
exec python3 -c 'import Suno_calc.app as app; app.APP_ID = "org.projectSuno.Calculator.SunoUIPreview"; raise SystemExit(app.main())'
RUN
chmod +x "$dest/bin/calc-preview"

cat > "$launcher" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Calculator (SunoUI preview)
Comment=Calculator built from SunoUI source
Exec=$dest/bin/calc-preview
Icon=$dest/python/icons/hicolor/scalable/apps/Suno-v3-calculator.svg
Terminal=false
Categories=Utility;Calculator;
StartupNotify=true
StartupWMClass=org.projectSuno.Calculator.SunoUIPreview
DESKTOP

printf 'Calculator preview installed from %s; launcher %s\n' "$(git -C "$src" rev-parse --short HEAD)" "$launcher"
