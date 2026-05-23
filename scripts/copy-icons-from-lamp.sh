#!/usr/bin/env bash
# Copy Lamp favicon into build/icon.png for electron-builder (requires ImageMagick or rsvg-convert).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAMP="${LAMP_PATH:-$ROOT/lamp}"
SVG="$LAMP/assets/favicon.svg"
OUT="$ROOT/build/icon.png"
mkdir -p "$ROOT/build"

if [[ ! -f "$SVG" ]]; then
  echo "Missing $SVG — run: git submodule update --init" >&2
  exit 1
fi

if command -v magick >/dev/null 2>&1; then
  magick -background none -density 512 "$SVG" -resize 512x512 "$OUT"
elif command -v convert >/dev/null 2>&1; then
  convert -background none -density 512 "$SVG" -resize 512x512 "$OUT"
elif command -v rsvg-convert >/dev/null 2>&1; then
  rsvg-convert -w 512 -h 512 "$SVG" -o "$OUT"
else
  echo "Install ImageMagick or librsvg (rsvg-convert) to rasterize icons." >&2
  exit 1
fi

echo "Wrote $OUT"
echo "For macOS/Windows, generate .icns / .ico from icon.png (e.g. electron-icon-builder)."
