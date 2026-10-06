#!/bin/sh
# Generates all icons from the master picture images/webphos-source.webp (needs ImageMagick).
# The master has black corners, so the rounded versions are cut with a mask and the full-bleed ones are cropped.
# Usage: sh scripts/make-icons.sh
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
src=images/webphos-source.webp
magick "$src" -filter Lanczos -resize 1024x1024 "$tmp/src.png"
magick -size 1024x1024 xc:black -fill white -draw "roundrectangle 3,3 1020,1020 240,240" "$tmp/mask.png"
magick "$tmp/src.png" "$tmp/mask.png" -alpha off -compose CopyOpacity -composite "$tmp/round.png"
for s in 48 72 96 144 168 192 512; do magick "$tmp/round.png" -filter Lanczos -resize ${s}x${s} images/manifest/${s}x${s}.png; done
magick "$tmp/round.png" -filter Lanczos -resize 192x192 images/favicon.png
magick "$tmp/round.png" -filter Lanczos -resize 32x32 images/favicon-32.png
magick "$tmp/round.png" -filter Lanczos -resize 256x256 images/logo-colors.png
magick "$tmp/round.png" -filter Lanczos -resize 64x64 images/logo.png
# full-bleed square (Apple rounds the corners itself): crop away the black corners
magick "$tmp/src.png" -gravity center -crop 900x900+0+0 +repage -alpha off -filter Lanczos -resize 180x180 images/apple-touch-icon.png
# maskable: the picture in the safe zone (80 %) on a blue background
magick "$tmp/src.png" -gravity center -crop 900x900+0+0 +repage -alpha off -filter Lanczos -resize 410x410 "$tmp/inner.png"
magick -size 512x512 xc:'#14208a' "$tmp/inner.png" -gravity center -composite -alpha off images/manifest/512x512-maskable.png
rm -rf "$tmp"
