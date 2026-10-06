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

install -m 755 "$BIN_SRC" "$BIN_DEST"
cp "$ICON_SRC" "$ICON_DEST"

# Deploy to hicolor and Tahoe-Neo theme
for s in 512 256 128 64 48; do
    mkdir -p "$HOME/.local/share/icons/hicolor/${s}x${s}/apps"
    cp "$ICON_SRC" "$HOME/.local/share/icons/hicolor/${s}x${s}/apps/$APP_NAME.png"
done

if [ -d "$HOME/.local/share/icons/Tahoe-Neo/apps" ]; then
    cp "$ICON_SRC" "$HOME/.local/share/icons/Tahoe-Neo/apps/$APP_NAME.png"
fi

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=OpenVPN Linux GUI
Comment=Lightweight OpenVPN3 GUI Client
Exec=$BIN_DEST
Icon=$ICON_DEST
Type=Application
Categories=Network;VPN;
Terminal=false
StartupWMClass=openvpn-gui-linux
EOF

# Copy to Desktop
if [ -d "$HOME/Desktop" ]; then
    cp "$DESKTOP_FILE" "$HOME/Desktop/$APP_NAME.desktop"
    chmod +x "$HOME/Desktop/$APP_NAME.desktop"
    gio set "$HOME/Desktop/$APP_NAME.desktop" metadata::trusted true 2>/dev/null || true
fi

# Clear GNOME thumbnail cache so new icon renders immediately
rm -rf "$HOME/.cache/thumbnails/"* 2>/dev/null || true

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo "Installed! Search 'OpenVPN Linux GUI' in app launcher."
