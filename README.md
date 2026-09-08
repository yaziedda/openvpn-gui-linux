# OpenVPN Linux GUI

Lightweight OpenVPN3 GUI client for Linux. Built with [Wails](https://wails.io) (Go + JS).

Minimal, fast, and supports 2FA authentication out of the box.

## Quick Install

```bash
curl -sL https://raw.githubusercontent.com/yaziedda/openvpn-gui-linux/main/install.sh | bash
```

Search **"OpenVPN Linux GUI"** from your app launcher. Done.

## Features

- One-click connect/disconnect
- 2FA / Authenticator code support (auto-detected)
- Multiple profiles (save config, username, password)
- Native file browser for `.ovpn` files
- Real-time connection log
- Dark minimal UI
- Single binary, no runtime dependencies

## Requirements

- Linux (Ubuntu 22.04+ / any distro with GUI)
- [OpenVPN3 Linux client](https://openvpn.net/cloud-docs/owner/connectors/connector-user-guides/openvpn-3-client-for-linux.html)

```bash
# Ubuntu/Debian
sudo apt install openvpn3

# Verify
openvpn3 version
```

## Usage

1. Open app → **Browse** → select `.ovpn` config file
2. Fill username & password (if required by your config)
3. Click **Connect**
4. Enter **Authenticator Code** when prompted
5. Connected

Save profiles for quick access next time.

## Build from Source

Requires: Go 1.21+, [Wails CLI v2](https://wails.io/docs/gettingstarted/installation)

```bash
git clone https://github.com/yaziedda/openvpn-gui-linux.git
cd openvpn-gui-linux
wails build
```

Output: `./build/bin/openvpn-gui-linux`

### Install locally after build

```bash
./install.sh
```

## Uninstall

```bash
rm ~/.local/bin/openvpn-gui-linux
rm ~/.local/share/applications/openvpn-gui-linux.desktop
rm ~/.local/share/icons/openvpn-gui-linux.png
```

## Contributing

PRs welcome. Keep it lightweight.

## License

MIT
