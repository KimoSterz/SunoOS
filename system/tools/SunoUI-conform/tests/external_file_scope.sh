#!/bin/bash
# Verify that an external app's sources and fixtures are uploaded without
# expanding a foundation kit's archive through gtk.pythonpath: ["."].
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

kit=$tmp/kit
app=$tmp/app
mkdir -p "$kit/src/Suno-platform/appkit" "$kit/tools/SunoUI-conform/scenarios" \
  "$kit/unrelated" "$app/Suno_canvas" "$app/tests/fixtures" "$tmp/bin" "$tmp/empty-dev"
cp "$here/scenarios/canvas.json" "$kit/tools/SunoUI-conform/scenarios/canvas.json"
printf 'kit\n' > "$kit/src/Suno-platform/appkit/base.py"
printf 'must stay out\n' > "$kit/unrelated/marker"
printf 'app\n' > "$app/Suno_canvas/__main__.py"
printf '{}\n' > "$app/tests/fixtures/canvas-v70.json"
git -C "$kit" init -q
git -C "$kit" add .
git -C "$app" init -q
git -C "$app" add .

cat > "$tmp/bin/ssh" <<'EOF'
#!/bin/sh
cat > "$CAPTURE_TAR"
tar -cf - --files-from /dev/null
EOF
chmod +x "$tmp/bin/ssh"

CAPTURE_TAR="$tmp/upload.tar" SUNO_DEV="$tmp/empty-dev" PATH="$tmp/bin:$PATH" \
  bash "$here/conform-client.sh" canvas --worktree "$app" --kit "$kit" \
  --out "$tmp/out" --spec-only > "$tmp/client.log" 2>&1

tar -tf "$tmp/upload.tar" > "$tmp/upload.list"
for expected in \
  wt/Suno_canvas/__main__.py \
  wt/tests/fixtures/canvas-v70.json \
  kit/src/Suno-platform/appkit/base.py \
  kit/tools/SunoUI-conform/scenarios/canvas.json; do
  grep -Fxq "$expected" "$tmp/upload.list" || {
    echo "Missing upload: $expected" >&2
    exit 1
  }
done
if grep -Fxq kit/unrelated/marker "$tmp/upload.list"; then
  echo "Foundation archive expanded beyond kit scope" >&2
  exit 1
fi
echo "PASS external app and foundation file scope"
