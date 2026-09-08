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

# Install dependencies (openvpn3 and webkit2gtk)
install_dependencies() {
    info "Checking dependencies..."

    case "$OS" in
        ubuntu|debian|linuxmint|pop)
            DEPS_TO_INSTALL=""
            if ! command -v openvpn3 &>/dev/null; then
                DEPS_TO_INSTALL="$DEPS_TO_INSTALL openvpn3"
            fi
            if ! ldconfig -p | grep -q "libwebkit2gtk-4.1"; then
                DEPS_TO_INSTALL="$DEPS_TO_INSTALL libwebkit2gtk-4.1-0"
            fi

            if [ -n "$DEPS_TO_INSTALL" ]; then
                info "Installing dependencies:$DEPS_TO_INSTALL..."
                sudo apt-get update -qq
                sudo apt-get install -y $DEPS_TO_INSTALL 2>/dev/null || {
                    if echo "$DEPS_TO_INSTALL" | grep -q "openvpn3"; then
                        warn "Adding OpenVPN official repo..."
                        sudo apt-get install -y curl gnupg
                        curl -fsSL https://packages.openvpn.net/packages-repo.gpg \
                            | sudo gpg --dearmor -o /usr/share/keyrings/openvpn.gpg
                        echo "deb [signed-by=/usr/share/keyrings/openvpn.gpg] \
https://packages.openvpn.net/openvpn3/debian $(. /etc/os-release && echo $VERSION_CODENAME) main" \
                            | sudo tee /etc/apt/sources.list.d/openvpn3.list > /dev/null
                        sudo apt-get update -qq
                        sudo apt-get install -y openvpn3 libwebkit2gtk-4.1-0
                    fi
                }
            fi
            ;;
        fedora)
            if ! command -v openvpn3 &>/dev/null; then
                sudo dnf install -y openvpn3-client webkit2gtk4.1
            fi
            ;;
        arch|manjaro|endeavouros)
            ARCH_DEPS=""
            if ! command -v openvpn3 &>/dev/null; then
                ARCH_DEPS="$ARCH_DEPS openvpn3"
            fi
            if ! ldconfig -p | grep -q "libwebkit2gtk-4.1"; then
                ARCH_DEPS="$ARCH_DEPS webkit2gtk-4.1"
            fi

            if [ -n "$ARCH_DEPS" ]; then
                if command -v yay &>/dev/null; then
                    yay -S --noconfirm $ARCH_DEPS
                elif command -v paru &>/dev/null; then
                    paru -S --noconfirm $ARCH_DEPS
                else
                    warn "AUR helper not found. Please install:$ARCH_DEPS manually."
                    exit 1
                fi
            fi
            ;;
        *)
            warn "Unsupported distro '$OS'. Please ensure openvpn3 and webkit2gtk-4.1 are installed."
            ;;
    esac

    info "Dependencies verified!"
}

install_dependencies

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
