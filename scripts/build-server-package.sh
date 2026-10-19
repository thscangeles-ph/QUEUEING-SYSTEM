#!/usr/bin/env bash
# Builds dist/THSC-Queue-Server.zip: a ready-to-run clinic queue server for Windows.
# It holds the app already built (Next.js standalone) and a portable Node.js, so the clinic computer needs no
# internet, installation or build: extract the ZIP and double-click SETUP.cmd.
# Run on Linux or macOS from the repository: scripts/build-server-package.sh
# (NODE_ZIP=/path/to/node-vX-win-x64.zip reuses a downloaded Node.js instead of fetching it.)
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_VERSION="${NODE_VERSION:-v24.21.0}"
NODE_NAME="node-$NODE_VERSION-win-x64"
OUT=dist/THSC-Queue-Server
SA=.next/standalone
rm -rf "$OUT" dist/THSC-Queue-Server.zip

QUEUE_STANDALONE=1 pnpm build

# ---- the app ----
mkdir -p "$OUT/app/node_modules"
cp "$SA/server.js" "$SA/package.json" "$OUT/app/"
cp -r "$SA/.next" "$OUT/app/.next"
cp -r .next/static "$OUT/app/.next/static"
cp -r public "$OUT/app/public"
# Flatten pnpm's linked node_modules into plain folders: Windows "Extract All" cannot create links, and the .pnpm
# folder names are too long for Windows paths. The image library (sharp, Linux-only here) is left out; the package
# does not resize images.
for dir in "$SA/node_modules/.pnpm/node_modules" "$SA/node_modules"; do
  for entry in "$dir"/* "$dir"/@*/*; do
    [ -e "$entry" ] || continue
    name="${entry#"$dir"/}"
    case "$name" in .pnpm | sharp | @img | @img/* | detect-libc | semver) continue ;; esac
    if [[ "$name" == @* && "$name" != */* ]]; then continue; fi
    [ -e "$OUT/app/node_modules/$name" ] && continue
    mkdir -p "$(dirname "$OUT/app/node_modules/$name")"
    cp -rL "$entry" "$OUT/app/node_modules/$name"
  done
done

# ---- portable Node.js for Windows, checked against the official checksum ----
mkdir -p "$OUT/node"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if [ -n "${NODE_ZIP:-}" ]; then cp "$NODE_ZIP" "$tmp/$NODE_NAME.zip"; else curl -fsSL -o "$tmp/$NODE_NAME.zip" "https://nodejs.org/dist/$NODE_VERSION/$NODE_NAME.zip"; fi
curl -fsSL -o "$tmp/SHASUMS256.txt" "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt"
(cd "$tmp" && grep " $NODE_NAME.zip\$" SHASUMS256.txt | sha256sum -c -)
unzip -q -j "$tmp/$NODE_NAME.zip" "$NODE_NAME/node.exe" "$NODE_NAME/LICENSE" -d "$OUT/node"

# ---- start files, guide and TV startup files ----
cp local-server/package/SETUP.cmd local-server/package/START-SERVER.cmd local-server/package/README.txt "$OUT/"
mkdir -p "$OUT/tv-setup"
cp tv-setup/*.cmd "$OUT/tv-setup/"
# Credits and the license texts of the software inside (scripts/build-credits.mjs).
cp -r credits "$OUT/credits"

# Windows paths must stay under 260 characters; C:\THSC-Queue-Server\ adds 21.
longest="$(cd dist && find THSC-Queue-Server | awk '{ print length }' | sort -n | tail -1)"
if [ "$longest" -gt 230 ]; then echo "A path is $longest characters long; too long for Windows." >&2; exit 1; fi

(cd dist && zip -qr -9 THSC-Queue-Server.zip THSC-Queue-Server)
echo "Built dist/THSC-Queue-Server.zip ($(du -h dist/THSC-Queue-Server.zip | cut -f1)); longest path $longest characters."
