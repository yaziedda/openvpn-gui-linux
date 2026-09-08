#!/bin/bash
set -e

APP_NAME="openvpn-gui-linux"
BIN_SRC="$(dirname "$0")/build/bin/$APP_NAME"
BIN_DEST="$HOME/.local/bin/$APP_NAME"
DESKTOP_FILE="$HOME/.local/share/applications/$APP_NAME.desktop"
ICON_SRC="$(dirname "$0")/build/appicon.png"
ICON_DEST="$HOME/.local/share/icons/$APP_NAME.png"

mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons"

cp "$BIN_SRC" "$BIN_DEST"
chmod +x "$BIN_DEST"
cp "$ICON_SRC" "$ICON_DEST"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=OpenVPN Linux GUI
Comment=Lightweight OpenVPN3 GUI Client
Exec=$BIN_DEST
Icon=$ICON_DEST
Type=Application
Categories=Network;VPN;
Terminal=false
EOF

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "Installed! Search 'OpenVPN Linux GUI' in app launcher."
