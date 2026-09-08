#!/bin/bash
set -e

REPO="yaziedda/openvpn-gui-linux"
APP_NAME="openvpn-gui-linux"
BIN_DEST="$HOME/.local/bin/$APP_NAME"
DESKTOP_FILE="$HOME/.local/share/applications/$APP_NAME.desktop"
ICON_DEST="$HOME/.local/share/icons/$APP_NAME.png"

echo "Installing OpenVPN Linux GUI..."

DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep "browser_download_url.*openvpn-gui-linux" | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
    echo "Error: Could not find release. Check https://github.com/$REPO/releases"
    exit 1
fi

mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons"

echo "Downloading from $DOWNLOAD_URL..."
curl -L -o "$BIN_DEST" "$DOWNLOAD_URL"
chmod +x "$BIN_DEST"

curl -sL "https://raw.githubusercontent.com/$REPO/main/build/appicon.png" -o "$ICON_DEST"

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

echo ""
echo "Done! Search 'OpenVPN Linux GUI' in your app launcher."
