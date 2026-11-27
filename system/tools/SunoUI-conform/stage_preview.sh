#!/bin/sh
# SunoUI-conform: stage a scratch copy of the SunoUI preview from a worktree
# (the kit, its sheets and icons, the gallery, prairie_apps/prairie_ui, the
# Prairie sheets and bin/run), the same layout sync-SunoUI-preview.sh puts on
# the ThinkPad. Nothing is installed; gtk_capture.sh copies it where it runs.
#   stage_preview.sh <worktree> <dest>
set -eu
WORKTREE=$1 stage=$2
PLATFORM_NVR=${SUNOUI_PLATFORM_NVR:-0.1.0-1.Suno.87.SunoUI20260928.1.fc44}
APPS_NVR=${SUNOUI_APPS_NVR:-0.1.0-1.Suno.81.SunoUI20260928.1.fc44}

mkdir -p "$stage/python/icons" "$stage/share/prairie-core" "$stage/bin"
appkit="$WORKTREE/src/Suno-platform/appkit"
cp -R "$appkit/Suno_appkit" "$stage/python/"
cp "$appkit"/*.css "$WORKTREE/src/Suno-platform/ui/Suno-ui.css" "$stage/python/"
cp "$appkit"/icons/*.svg "$stage/python/icons/"
cp "$WORKTREE"/assets/icon-theme/Prairie/symbolic/actions/SunoUI-*-symbolic.svg "$stage/python/icons/" 2>/dev/null || true
cp "$WORKTREE/src/Suno-platform/tools/SunoUI-gallery/"*.py "$stage/python/" 2>/dev/null || true
for d in prairie_apps prairie_ui; do
  [ -d "$WORKTREE/src/prairie-core/$d" ] && cp -R "$WORKTREE/src/prairie-core/$d" "$stage/python/"
done
cp "$WORKTREE"/src/prairie-core/style/*.css "$stage/share/prairie-core/" 2>/dev/null || true
find "$stage/python" -name __pycache__ -type d -prune -exec rm -rf {} +
printf 'Suno-developer-platform %s\nprairie-core-apps %s\n' "$PLATFORM_NVR" "$APPS_NVR" > "$stage/BASE-NVR"

cat > "$stage/bin/run" <<'RUN'
#!/bin/sh
# SunoUI preview: runs the SunoUI Gallery, or one Prairie app, against the kit
# in this directory. Refuses when the installed platform differs from BASE-NVR.
#   bin/run gallery [...]   |   bin/run contacts   (any prairie_apps module)
#   bin/run --module Suno_tide[.app] [...]   (any module on SUNOUI_EXTRA_PYTHONPATH:
#   its main() when it has one, else run as `python3 -m`)
here=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
app=${1:-gallery} module=
[ "$#" -gt 0 ] && shift
if [ "$app" = --module ]; then module=${1:-}; [ "$#" -gt 0 ] && shift; app=$module; fi
case "$app" in *[!a-z_]*|'') [ -n "$module" ] && case "$module" in *[!A-Za-z0-9_.]*|.*|'') ;; *) app=ok ;; esac ;; esac
case "$app" in *[!a-z_]*|'') echo "SunoUI preview: not an app or module name: ${module:-$app}" >&2; exit 2 ;; esac
while read -r package nvr; do
  have=$(rpm -q --qf '%{VERSION}-%{RELEASE}' "$package" 2>/dev/null) || have=
  if [ "$have" != "$nvr" ]; then
    echo "SunoUI preview: built on $package $nvr, but ${have:-nothing} is installed." >&2
    exit 3
  fi
done < "$here/BASE-NVR"
export PYTHONPATH="$here/python${SUNOUI_EXTRA_PYTHONPATH:+:$SUNOUI_EXTRA_PYTHONPATH}"
export SUNO_APPKIT_ICON_PATH="$here/python/icons"
for sheet in "$here"/share/prairie-core/*.css; do
  [ -e "$sheet" ] || continue
  name=$(basename "$sheet" .css | tr a-z A-Z)
  export "SUNO_${name}_STYLE_PATH=$sheet"
done
if [ -n "$module" ]; then
  exec python3 -c "import importlib, runpy, sys; sys.argv[0] = '$module'; m = importlib.import_module('$module')
if callable(getattr(m, 'main', None)): raise SystemExit(m.main())
runpy.run_module('$module', run_name='__main__', alter_sys=True)" "$@"
fi
if [ "$app" = gallery ]; then
  exec python3 "$here/python/SunoUI_gallery.py" "$@"
fi
# Its own application ID, so it never activates (or is activated as) the installed app;
# a conform capture (private bus, headless) keeps the real one: SUNOUI_KEEP_APP_ID=1.
suffix=.SunoUIPreview
[ -n "${SUNOUI_KEEP_APP_ID:-}" ] && suffix=
exec python3 -c "import sys, prairie_apps.$app as m; m.APP_ID = getattr(m, 'APP_ID', 'org.projectSuno.$app') + '$suffix'; sys.argv[0] = 'prairie-$app'; raise SystemExit(m.main())" "$@"
RUN
chmod +x "$stage/bin/run"
