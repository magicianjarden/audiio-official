# Mobile Remote Access

Control Audiio from your phone or tablet, anywhere in the world.

## Overview

Audiio's mobile remote lets you control your desktop music from any device with a web browser. No app installation required.

### How It Works

```
┌─────────────┐                    ┌─────────────┐
│   Desktop   │◄──── Secure ─────►│   Mobile    │
│   Audiio    │      Connection    │   Browser   │
└─────────────┘                    └─────────────┘
```

Two connection modes:

| Mode | When to Use |
|------|-------------|
| **Local Network** | Same WiFi, fastest |
| **P2P (Relay)** | Anywhere, works remotely |

## Key Features

### Full Playback Control

- Play/pause, next/previous
- Seek within tracks
- Volume control
- Queue management

### Library Access

- Browse your full library
- View playlists
- Search for music
- Add to queue from mobile

### Real-time Sync

- See what's playing instantly
- Album art and lyrics
- Progress updates live

### Secure Connection

- End-to-end encryption
- No cloud storage
- Your data stays private

## Quick Start

1. **Desktop**: Enable in Settings > Mobile Access
2. **Note** the connection code (e.g., "SWIFT-EAGLE-42")
3. **Phone**: Visit `audiio.app/remote`
4. **Enter** the connection code
5. **Start** controlling your music!

See [Setup Guide](setup.md) for detailed instructions.

## Connection Types

### Local Network (Same WiFi)

Best for home use:

- Fastest response time
- No internet required
- Direct connection

### P2P via Relay

For remote access:

- Works from anywhere
- Uses secure relay server
- End-to-end encrypted
- Slightly higher latency

## Privacy & Security

### End-to-End Encryption

All data is encrypted using NaCl:
- X25519 key exchange
- XSalsa20-Poly1305 encryption
- Keys never leave your devices

### No Cloud Storage

- Music never uploaded
- Library stays on your computer
- Relay only routes encrypted messages

### Device Authorization

- Each device must be approved
- Revoke access anytime
- See connected devices

## Requirements

### Desktop

- Audiio running
- Mobile access enabled
- Network access (local or internet)

### Mobile

- Modern web browser
- Safari, Chrome, Firefox, Edge
- JavaScript enabled

## Getting Started

| Guide | Description |
|-------|-------------|
| [Setup](setup.md) | Step-by-step connection guide |
| [Features](features.md) | What you can do on mobile |
| [Troubleshooting](troubleshooting.md) | Fix connection issues |

## Technical Details

For those interested in the architecture:

### Connection Flow

1. Desktop generates keypair
2. Desktop connects to relay
3. Relay assigns connection code
4. Mobile enters code
5. Secure handshake
6. Encrypted tunnel established

### Under the Hood

| Component | Technology |
|-----------|------------|
| Encryption | NaCl (TweetNaCl.js) |
| Transport | WebSocket |
| Signaling | Self-hosted relay |
| Protocol | Custom binary |

## Frequently Asked Questions

### Is my music uploaded to the cloud?

No. Music stays on your computer. The relay only routes encrypted control messages.

### Does it work without internet?

Yes! Local network mode works without internet. P2P mode requires internet for both devices.

### How secure is it?

Very secure. End-to-end encryption means even the relay server can't see your data.

### Why a connection code?

The memorable code makes it easy to connect without typing long URLs. It's temporary and regenerates for security.

### Can multiple phones connect?

Yes! Multiple devices can connect and control simultaneously.

## Next Steps

- [Setup Guide](setup.md) - Connect your first device
- [Mobile Features](features.md) - Explore mobile capabilities
- [Troubleshooting](troubleshooting.md) - Fix common issues

