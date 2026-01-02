# Audiio Documentation

Welcome to the Audiio documentation. Audiio is a modern, privacy-first music streaming platform that runs on your desktop and streams to your mobile devices.

## Documentation

### For Users

Everything you need to use Audiio effectively.

| Guide | Description |
|-------|-------------|
| [Getting Started](./user-guide/getting-started.md) | First-time setup and basics |
| [Installation](./user-guide/installation.md) | Install on macOS, Windows, Linux |
| [Features](./user-guide/features/README.md) | All features explained |
| [Mobile Remote](./user-guide/mobile/README.md) | Control Audiio from your phone |
| [Addons](./user-guide/addons/README.md) | Extend Audiio with plugins |
| [Keyboard Shortcuts](./user-guide/keyboard-shortcuts.md) | Master the keyboard |
| [Settings](./user-guide/settings.md) | All settings explained |
| [Troubleshooting](./user-guide/troubleshooting.md) | Fix common issues |
| [FAQ](./user-guide/faq.md) | Frequently asked questions |

### For Developers

Build addons, contribute to Audiio, or understand the internals.

| Guide | Description |
|-------|-------------|
| [Development Setup](./development/setup.md) | Set up your dev environment |
| [Building](./development/building.md) | Build from source |
| [Architecture](./development/architecture.md) | System design overview |
| [Packages](./development/packages.md) | Monorepo structure (14 packages) |
| [Plugin Development](./development/plugins/README.md) | Create your own plugins |
| [Addon Development](./development/addons/README.md) | Build addon extensions |
| [Stores](./development/stores.md) | Zustand state patterns (21 stores) |
| [IPC Reference](./development/ipc-reference.md) | Desktop IPC handlers (131+) |
| [Mobile Server](./development/mobile-server.md) | Mobile server internals |
| [ML System](./development/ml-system.md) | Recommendation engine |
| [Testing](./development/testing.md) | Run and write tests |

### Reference

| Guide | Description |
|-------|-------------|
| [SDK](./sdk/README.md) | Addon SDK API reference |
| [Relay](./relay/README.md) | Self-host a relay server |
| [API](./api/README.md) | REST API reference (60+ endpoints) |
| [Theming](./theming/README.md) | Theme system reference |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Desktop App                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  UI (React) │  │    Core     │  │   Plugins   │  │   Mobile Server     │ │
│  │  21 Stores  │  │ Orchestrat. │  │  (Dynamic)  │  │   (Fastify + P2P)   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                                        │
         │ IPC (131+ handlers)                                   │ REST/WS/P2P
         ▼                                                        ▼
┌─────────────────┐                                    ┌─────────────────────┐
│    Electron     │                                    │  Mobile Web App     │
│  Main Process   │                                    │  (PWA + Local Play) │
│                 │                                    │                     │
│  • Plugin Loader│                                    │  Two Modes:         │
│  • ML Service   │                                    │  • Remote Control   │
│  • Karaoke Svc  │                                    │  • Local Playback   │
│  • Library Brdg │                                    │    (Plex-like)      │
└─────────────────┘                                    └─────────────────────┘
         │                                                        │
         │ WebSocket                                             │ WebSocket
         ▼                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Audiio Relay Server                                  │
│                      (wss://audiio-relay.fly.dev)                           │
│                                                                             │
│  • E2E Encrypted tunneling (NaCl X25519 + XSalsa20-Poly1305)               │
│  • Static room model with persistent room IDs                               │
│  • Password protection for rooms                                            │
│  • Memorable connection codes (SWIFT-EAGLE-42)                              │
│  • No data storage - pure relay                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@audiio/core` | Core types, orchestrators, and services |
| `@audiio/sdk` | SDK for building addons/plugins |
| `@audiio/relay` | Relay server and client |
| `@audiio/ui` | React UI components (21 Zustand stores) |
| `@audiio/icons` | Icon library |
| `@audiio/desktop` | Electron desktop app |
| `@audiio/mobile` | Mobile server and web app |
| `@audiio/server` | Standalone REST API server |
| `@audiio/landing` | Landing page |
| `@audiio/ml-core` | ML engine and orchestrator |
| `@audiio/ml-sdk` | SDK for building ML algorithm plugins |
| `@audiio/demucs-server` | Demucs AI vocal removal server |
| `@audiio/plugin-musicbrainz` | MusicBrainz metadata provider plugin |

## Key Features

### Privacy-First
- No cloud accounts required
- Your music stays on your machine
- E2E encrypted remote access
- Static room model with password protection

### Extensible Plugin System
- Dynamic plugin loading from npm, git, or local files
- 7 addon roles: metadata, stream, lyrics, scrobbler, audio-processor, tool, artist-enrichment
- Plugin repository system for discovery
- Per-plugin settings and priorities

### Modern Stack
- TypeScript throughout
- React 18 for UI with 21 Zustand stores
- Fastify for API server
- NaCl for encryption
- TensorFlow.js for ML recommendations

### Advanced Audio Features
- Karaoke mode with AI vocal removal (Demucs)
- Instant playback (~3-4 seconds to first chunk)
- Smart queue with auto-queue and radio modes
- Audio feature analysis (BPM, key, energy)
- Local music support with ID3 tag reading/writing

### Mobile Access
- Two connection modes: Local network and P2P relay
- Two playback modes: Remote control and local playback (Plex-like)
- Device management with approval flow
- Persistent device tokens

## Quick Start

```bash
# Clone the repository
git clone https://github.com/magicianjarden/audiio-official.git
cd audiio-official

# Install dependencies
npm install

# Build all packages
npm run build:all

# Run the desktop app
npm run dev
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT
