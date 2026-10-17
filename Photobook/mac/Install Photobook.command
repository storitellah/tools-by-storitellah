#!/bin/bash
# Installs Photobook into Applications and signs it on this Mac.
#
# The app is not registered with Apple, so a copy downloaded from the
# internet is quarantined and macOS refuses it as "damaged". This copies the
# app, clears the download flag and re-signs it with this Mac's own codesign,
# which macOS then accepts.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/Photobook.app"
DEST="/Applications/Photobook.app"

echo "Installing Photobook…"
osascript -e 'quit app "Photobook"' >/dev/null 2>&1 || true
if [ -w /Applications ]; then SUDO=""; else SUDO="sudo"; echo "Your password is needed to write to Applications."; fi
$SUDO rm -rf "$DEST"
$SUDO ditto "$SRC" "$DEST"
$SUDO xattr -cr "$DEST"
$SUDO codesign --force --deep --sign - "$DEST"
echo "Photobook is installed. Opening it now — you can close this window."
open "$DEST"
