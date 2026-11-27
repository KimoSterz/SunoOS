#!/bin/bash
# Stage 0 (root, on a running Suno machine): copy one deployed commit into an
# archive repository the installer can deploy from, under a preview ref.
# usage: make-repo.sh COMMIT OUTPUT_DIR
set -euo pipefail
C=$1; OUT=$2
REF=Suno/0.5/x86_64/desktop-preview
rm -rf "$OUT/Suno-repo.partial"
ostree --repo="$OUT/Suno-repo.partial" init --mode=archive
ostree --repo="$OUT/Suno-repo.partial" pull-local /ostree/repo "$C"
KVER=$(ls /ostree/deploy/*/deploy/$C.*/usr/lib/modules | head -1)
# A fresh commit over the same tree, without the client-layering metadata of
# the machine it came from.
ostree --repo="$OUT/Suno-repo.partial" commit --branch=$REF --tree=ref="$C" --no-bindings \
  --subject="Suno 0.5 preview ($(date -u +%Y-%m-%d))" \
  --add-metadata-string=version=0.5.0-preview.$(date -u +%Y%m%d) \
  --add-metadata-string=ostree.linux="$KVER" \
  --add-metadata=ostree.bootable=true
ostree --repo="$OUT/Suno-repo.partial" summary -u
mv "$OUT/Suno-repo.partial" "$OUT/Suno-repo"
