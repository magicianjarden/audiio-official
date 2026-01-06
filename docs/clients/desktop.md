# Desktop Client

The desktop client is an Electron-based application for Windows, macOS, and Linux.

## Overview

Unlike traditional music players, the Audiio desktop client is a **thin client**. It connects to an Audiio server and provides:

- Native desktop window with system integration
- Audio playback via the shared UI
- Server connection management with mDNS discovery
- Device pairing UI

The server handles plugins, recommendations, and library management.

## Installation

### From Release

Download from [GitHub Releases](https://github.com/magicianjarden/audiio-official/releases):

- **Windows**: `Audiio-Setup.exe` or portable
- **macOS (Apple Silicon)**: `Audiio-arm64.dmg`
- **macOS (Intel)**: `Audiio-x64.dmg`
- **Linux**: `AppImage` or `.deb`

### From Source

```bash
# From repository root
npm install
npm run build -w @audiio/client
npm run start -w @audiio/client
```

## First Run

1. **Start the server** (if not already running)
   ```bash
   npm run start -w @audiio/server
   ```

2. **Launch the desktop client**

3. **Connect to server**
   - The client will show available servers on your network
   - Or enter a server URL manually
   - Scan the QR code or enter the pairing code

4. **Start listening**

## Features

### Server Discovery
The client automatically discovers Audiio servers on your local network using mDNS/Bonjour.

### Multiple Servers
You can connect to different servers and switch between them.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `→` | Next track |
| `←` | Previous track |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Mute |
| `L` | Like current track |
| `D` | Dislike current track |
| `Q` | Toggle queue |
| `Cmd/Ctrl + F` | Search |

### System Integration

- Media keys support (play, pause, next, previous)
- System notifications for track changes
- Taskbar/dock controls
- Minimize to tray (optional)

## Configuration

Settings are stored in:
- **Windows**: `%APPDATA%/audiio-client/`
- **macOS**: `~/Library/Application Support/audiio-client/`
- **Linux**: `~/.config/audiio-client/`

### Settings File

`client-config.json`:

```json
{
  "serverUrl": "http://192.168.1.100:8484",
  "token": null,
  "sessionToken": "jwt-session-token",
  "deviceIdentity": {
    "deviceId": "unique-device-id",
    "deviceName": "My Desktop",
    "publicKey": "base64-encoded-public-key",
    "secretKey": "base64-encoded-secret-key"
  },
  "windowBounds": {"x": 100, "y": 100, "width": 1200, "height": 800}
}
```

## Troubleshooting

### Can't find server
- Ensure server is running
- Check firewall allows port 8484
- Try entering server URL manually

### Pairing fails
- Ensure pairing code hasn't expired (5 min timeout)
- Check server logs for errors

### No audio
- Check system audio output
- Try a different track

### Connection lost
- Client will auto-reconnect
- Check network connectivity

## Development

```bash
# Run in development mode (requires UI dev server running)
npm run dev -w @audiio/client

# Build for production
npm run build -w @audiio/client

# Package for distribution
npm run package -w @audiio/client
```

## Architecture

```
┌──────────────────────────────────────────┐
│              Electron App                │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ Main Process│  │ Renderer (React) │  │
│  │             │  │                  │  │
│  │ • Window    │  │ • UI Components  │  │
│  │ • IPC       │  │ • Zustand Stores │  │
│  │ • Tray      │◄─►│ • Audio Player   │  │
│  └─────────────┘  └──────────────────┘  │
│         │                               │
│         │ HTTP/WebSocket                │
│         ▼                               │
│  ┌─────────────────────────────────┐   │
│  │         ServerClient            │   │
│  │  • Connection management        │   │
│  │  • Device identity (NaCl keys)  │   │
│  │  • Session tokens               │   │
│  │  • Auto-reconnect               │   │
│  └─────────────────────────────────┘   │
└──────────────────────────────────────────┘
                   │
                   ▼
          ┌───────────────┐
          │ Audiio Server │
          └───────────────┘
```
