#!/bin/bash
set -e

REPO="yaziedda/openvpn-gui-linux"
APP_NAME="openvpn-gui-linux"
BIN_DEST="$HOME/.local/bin/$APP_NAME"
DESKTOP_FILE="$HOME/.local/share/applications/$APP_NAME.desktop"
ICON_DEST="$HOME/.local/share/icons/$APP_NAME.png"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[+]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[x]${NC} $1"; exit 1; }

echo ""
echo "  OpenVPN Linux GUI — Installer"
echo "  ================================"
echo ""

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        error "Cannot detect OS. Install manually: https://github.com/$REPO"
    fi
}

OS=$(detect_os)

# Install openvpn3 if not found
install_openvpn3() {
    if command -v openvpn3 &>/dev/null; then
        info "openvpn3 already installed, skipping."
        return
    fi

    info "Installing openvpn3..."

    case "$OS" in
        ubuntu|debian|linuxmint|pop)
            sudo apt-get update -qq
            sudo apt-get install -y openvpn3 2>/dev/null || {
                # Fallback: add official OpenVPN repo
                warn "openvpn3 not in apt, adding OpenVPN official repo..."
                sudo apt-get install -y curl gnupg
                curl -fsSL https://packages.openvpn.net/packages-repo.gpg \
                    | sudo gpg --dearmor -o /usr/share/keyrings/openvpn.gpg
                echo "deb [signed-by=/usr/share/keyrings/openvpn.gpg] \
https://packages.openvpn.net/openvpn3/debian $(. /etc/os-release && echo $VERSION_CODENAME) main" \
                    | sudo tee /etc/apt/sources.list.d/openvpn3.list > /dev/null
                sudo apt-get update -qq
                sudo apt-get install -y openvpn3
            }
            ;;
        fedora)
            sudo dnf install -y openvpn3-client
            ;;
        arch|manjaro|endeavouros)
            if command -v yay &>/dev/null; then
                yay -S --noconfirm openvpn3
            elif command -v paru &>/dev/null; then
                paru -S --noconfirm openvpn3
            else
                warn "AUR helper not found. Install openvpn3 manually:"
                warn "  yay -S openvpn3"
                warn "Then re-run this script."
                exit 1
            fi
            ;;
        *)
            warn "Unsupported distro '$OS'. Install openvpn3 manually then re-run."
            exit 1
            ;;
    esac

    info "openvpn3 installed!"
}

install_openvpn3

# Download binary
info "Fetching latest release..."
DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" \
    | grep "browser_download_url.*openvpn-gui-linux" \
    | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
    error "Could not find release binary. Check https://github.com/$REPO/releases"
fi

mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons"

info "Downloading binary..."
curl -L --progress-bar -o "$BIN_DEST" "$DOWNLOAD_URL"
chmod +x "$BIN_DEST"

info "Downloading icon..."
curl -sL "https://raw.githubusercontent.com/$REPO/main/build/appicon.png" -o "$ICON_DEST"

# Create desktop entry
cat > "$DESKTOP_FILE" << EOF
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

# Make sure ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    warn "~/.local/bin is not in your PATH."
    warn "Add this to your ~/.bashrc or ~/.zshrc:"
    warn '  export PATH="$HOME/.local/bin:$PATH"'
fi

echo ""
info "Done! Search 'OpenVPN Linux GUI' in your app launcher."
info "Or run: $BIN_DEST"
echo ""
