#!/bin/sh
# Generates the icons from the master picture images/lumifex-source.webp (needs ImageMagick).
# The master is full-bleed, so the rounded versions are cut with a mask.
# Maskable icons (images/manifest/*-maskable.png) are supplied by hand, this script does not touch them.
# Usage: sh scripts/make-icons.sh
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
src=images/lumifex-source.webp
magick "$src" -filter Lanczos -resize 1024x1024 "$tmp/src.png"
magick -size 1024x1024 xc:black -fill white -draw "roundrectangle 0,0 1023,1023 240,240" "$tmp/mask.png"
magick "$tmp/src.png" "$tmp/mask.png" -alpha off -compose CopyOpacity -composite "$tmp/round.png"
# the only icons of the app: manifest, favicon, notifications and the About dialog (the maskable ones are supplied by hand)
for s in 192 512; do magick "$tmp/round.png" -filter Lanczos -resize ${s}x${s} images/manifest/${s}x${s}.png; done
# social preview (Open Graph / Twitter card): the screenshot as a lighter JPEG
magick images/lumifex-preview.webp -filter Lanczos -resize 1200x -quality 82 images/lumifex-preview.jpg
rm -rf "$tmp"
