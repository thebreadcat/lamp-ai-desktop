#!/usr/bin/env bash
# Generate platform icons from build/icon.png (requires ImageMagick: magick or convert).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PNG="$ROOT/build/icon.png"
LAMP="${LAMP_PATH:-$ROOT/../lamp}"

if [[ ! -f "$PNG" ]]; then
  if [[ -f "$LAMP/assets/favicon.svg" ]] && command -v magick >/dev/null; then
    magick -background none -density 512 "$LAMP/assets/favicon.svg" -resize 512x512 "$PNG"
  else
    echo "Missing $PNG — run ensure-lamp first" >&2
    exit 1
  fi
fi

ICNS="$ROOT/build/icon.icns"
ICO="$ROOT/build/icon.ico"
ICONSET="$ROOT/build/icon.iconset"
ICONS="$ROOT/build/icons"

if command -v magick >/dev/null; then
  magick "$PNG" -define icon:auto-resize=256,128,64,48,32,16 "$ICO"
  rm -rf "$ICONSET" "$ICNS"
  mkdir -p "$ICONSET"
  for size in 16 32 64 128 256 512; do
    magick "$PNG" -resize "${size}x${size}" "$ICONSET/icon_${size}x${size}.png"
    magick "$PNG" -resize "${size}x${size}" "$ICONSET/icon_${size}x${size}@2x.png"
  done
  iconutil -c icns "$ICONSET" -o "$ICNS" 2>/dev/null || true
  mkdir -p "$ICONS"
  for size in 16 32 48 64 128 256 512; do
    magick "$PNG" -resize "${size}x${size}" "$ICONS/${size}x${size}.png"
  done
  echo "Icons: $ICO $ICNS $ICONS/"
else
  echo "warn: ImageMagick not found — Windows/Linux builds may need icon.ico manually" >&2
fi
