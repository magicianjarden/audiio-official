# Mobile Remote Access

Control Audiio from your phone or tablet, anywhere in the world. Stream music directly to your mobile device or use it as a remote control.

## Overview

Audiio's mobile remote lets you control your desktop music from any device with a web browser. No app installation required.

### How It Works

```
┌─────────────┐                    ┌─────────────┐
│   Desktop   │◄──── Secure ─────►│   Mobile    │
│   Audiio    │      Connection    │   Browser   │
└─────────────┘                    └─────────────┘
```

### Connection Modes

| Mode | When to Use |
|------|-------------|
| **Local Network** | Same WiFi, fastest response |
| **P2P (Relay)** | Anywhere in the world, works remotely |

### Playback Modes

| Mode | Description |
|------|-------------|
| **Remote Control** | Control desktop playback from mobile |
| **Local Playback** | Stream audio directly to mobile (Plex-like) |

## Key Features

### Full Playback Control

- Play/pause, next/previous
- Seek within tracks
- Volume control
- Queue management
- Shuffle and repeat modes

### Library Access

- Browse your full library
- View and manage playlists
- Search for music
- Add tracks to queue
- Like/dislike tracks

### Real-time Sync

- See what's playing instantly
- Album art and lyrics display
- Progress updates live
- Multi-device sync

### Two Playback Modes

#### Remote Control Mode
Control what plays on your desktop. Perfect for:
- Changing tracks from across the room
- Managing a party playlist
- Quick access without walking to computer

#### Local Playback Mode (Plex-like)
Stream audio directly to your mobile device:
- Listen with headphones
- No desktop speakers needed
- Works while desktop is in use for other tasks
- Full offline queue support

### Secure Connection

- End-to-end encryption (NaCl)
- No cloud storage of your data
- Password protection for rooms
- Device authorization and management

## Quick Start

### First-Time Setup

1. **Desktop**: Open Audiio and go to Settings > Mobile Access
2. **Enable** mobile access
3. **Note** the connection code (e.g., "SWIFT-EAGLE-42")
4. **Phone**: Visit `audiio.app/remote` or scan the QR code
5. **Enter** the connection code
6. **Start** controlling your music!

### Connecting with Room Code

The room code is persistent - same computer always has the same code. Once you've connected, your device is remembered.

```
Room Code Format: ADJECTIVE-NOUN-NUMBER
Example: SWIFT-EAGLE-42
```

### Password Protection (Optional)

For added security, set a room password:

1. Desktop: Settings > Mobile Access > Set Password
2. Mobile: Enter password when prompted
3. Password is hashed - never sent in plaintext

## Connection Types

### Local Network (Same WiFi)

Best for home use:

- **Speed**: Fastest response time (~10-50ms)
- **Internet**: Not required
- **Connection**: Direct to desktop IP
- **URL**: `http://192.168.x.x:9484`

### P2P via Relay

For remote access:

- **Speed**: Slightly higher latency (~100-300ms)
- **Internet**: Required for both devices
- **Connection**: Through secure relay server
- **Encryption**: End-to-end (relay never sees your data)

### Choosing a Mode

| Scenario | Recommended Mode |
|----------|------------------|
| At home, same WiFi | Local Network |
| Away from home | P2P Relay |
| Behind strict firewall | P2P Relay |
| LAN party/shared network | Local Network |

## Device Management

### Pairing Devices

Devices are paired once and remembered:

1. Connect using room code
2. Device automatically saved
3. Next time, auto-connects

### Managing Devices

View and manage connected devices:

1. Desktop: Settings > Mobile Access > Devices
2. See all paired devices
3. Revoke access for any device
4. View last connection time

### Revoking Access

To remove a device:

1. Go to Settings > Mobile Access > Devices
2. Click the device to revoke
3. Confirm removal

The device will need to re-pair to connect again.

## Privacy & Security

### End-to-End Encryption

All data is encrypted using NaCl:

| Component | Algorithm |
|-----------|-----------|
| Key Exchange | X25519 (Curve25519 ECDH) |
| Encryption | XSalsa20-Poly1305 |
| Password Hashing | SHA-512 |

- Keys never leave your devices
- Relay server only sees encrypted blobs
- New keys generated each session

### No Cloud Storage

- Music never uploaded anywhere
- Library stays on your computer
- Relay only routes encrypted messages
- No accounts required

### Device Authorization

- Each device must be approved
- Persistent device tokens
- Revoke access anytime
- See all connected devices

### Room Security

- Optional password protection
- Passwords hashed before transmission
- Can regenerate room code (invalidates all devices)

## Mobile Features

### Now Playing

- Full-size album art
- Track title, artist, album
- Progress bar with seeking
- Playback controls
- Lyrics display (if available)

### Queue Management

- View current queue
- Reorder tracks
- Remove tracks
- Add to queue from anywhere
- "Play Next" feature

### Library Browsing

- Recently played
- Playlists
- Liked tracks
- Search
- Browse by artist/album

### Settings

- Playback mode (Remote/Local)
- Theme selection
- Audio quality (for local mode)
- Connection status

## Requirements

### Desktop

- Audiio running
- Mobile access enabled in Settings
- Network access (local or internet)

### Mobile

- Modern web browser (Safari, Chrome, Firefox, Edge)
- JavaScript enabled
- For P2P: Internet connection

### Recommended Browsers

| Browser | Support |
|---------|---------|
| Safari (iOS) | Full |
| Chrome (Android/iOS) | Full |
| Firefox | Full |
| Edge | Full |
| Samsung Internet | Full |

## Troubleshooting

### Can't Connect

1. **Check Desktop**: Is Audiio running?
2. **Check Network**: Same WiFi for local, internet for P2P
3. **Check Code**: Room code correct and case-insensitive
4. **Check Password**: Enter if room is protected
5. **Firewall**: Port 9484 may need to be open for local

### Connection Drops

1. Keep browser tab active
2. Check WiFi/mobile data stability
3. Try switching between Local and P2P mode

### Audio Not Playing (Local Mode)

1. Check browser audio permissions
2. Tap screen first (some browsers require interaction)
3. Check volume on mobile device

### Slow Response

1. Use Local Network if on same WiFi
2. Check internet connection quality
3. Reduce video quality on other apps

## Frequently Asked Questions

### Is my music uploaded to the cloud?

No. Music stays on your computer. The relay only routes encrypted control messages.

### Does it work without internet?

Yes! Local network mode works without internet. P2P mode requires internet for both devices.

### How secure is it?

Very secure. End-to-end encryption means even the relay server can't see your data.

### Why a connection code?

The memorable code makes it easy to connect without typing long URLs. It's persistent so you only need to enter it once.

### Can multiple phones connect?

Yes! Multiple devices can connect and control simultaneously.

### Can I stream to multiple devices at once?

Each device in Local Playback mode streams independently. Remote Control mode controls the single desktop playback.

### What's the difference from Plex?

Similar concept - your desktop is the server. Key differences:
- No account required
- E2E encrypted
- Web-based (no app needed)
- Focused on music

## Next Steps

- [Setup Guide](setup.md) - Detailed connection instructions
- [Mobile Features](features.md) - All mobile capabilities
- [Troubleshooting](troubleshooting.md) - Fix common issues
