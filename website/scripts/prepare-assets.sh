#!/usr/bin/env bash
# Regenerate the website's image assets from the repo's existing materials.
# macOS-only (uses sips). Run manually when the app icon or the simulator
# screenshot exports under captures/ change; the results are committed.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../.."
PUB="$HERE/../public"
SRC_SHOTS="$ROOT/captures/ios26-iphone17-pro-max/screenshots"

mkdir -p "$PUB/shots"

# App icon: 1024px master → web sizes.
sips -Z 512 "$ROOT/assets/images/icon.png" --out "$PUB/icon-512.png" >/dev/null
sips -Z 192 "$ROOT/assets/images/icon.png" --out "$PUB/icon-192.png" >/dev/null
sips -Z 180 "$ROOT/assets/images/icon.png" --out "$PUB/apple-touch-icon.png" >/dev/null
cp "$ROOT/assets/images/favicon.png" "$PUB/favicon.png"

# Screenshots: 1320x2868 simulator captures → 520px-wide web versions.
# Languages with localized captures: en zh es fr de ja (others fall back to en).
for f in "$SRC_SHOTS"/*-accounting.png "$SRC_SHOTS"/*-statistics.png "$SRC_SHOTS"/*-settings.png; do
  base="$(basename "$f")"
  sips --resampleWidth 520 "$f" --out "$PUB/shots/$base" >/dev/null
done

echo "prepare-assets: wrote $(ls "$PUB/shots" | wc -l | tr -d ' ') screenshots + icons to public/"
