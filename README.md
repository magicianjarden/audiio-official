# Audiio

A modern, privacy-first music streaming platform that runs on your desktop and streams to your mobile devices.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/magicianjarden/audiio-official)](https://github.com/magicianjarden/audiio-official/releases)

## Features

- **Multi-Source Streaming** - Aggregate music from various sources through addons
- **Privacy-First** - No cloud accounts, your music stays on your machine
- **Mobile Remote** - Control your desktop library from anywhere with E2E encryption
- **Extensible** - Build custom addons for metadata, lyrics, audio processing
- **Personalized** - ML-powered recommendations that learn from your listening
- **Beautiful** - Customizable themes with dynamic album art colors

## Quick Start

### Download

Get the latest release for your platform:
- **macOS (Apple Silicon)**: `Audiio-arm64.dmg`
- **macOS (Intel)**: `Audiio-x64.dmg`
- **Windows**: `Audiio-Setup.exe`
- **Linux**: `Audiio.AppImage`

[Download from GitHub Releases](https://github.com/magicianjarden/audiio-official/releases/latest)

### Build from Source

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

## Documentation

### For Users

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/user-guide/getting-started.md) | First-time setup and basics |
| [Installation](docs/user-guide/installation.md) | Install on macOS, Windows, Linux |
| [Features](docs/user-guide/features/README.md) | Library, player, discovery, and more |
| [Mobile Remote](docs/user-guide/mobile/README.md) | Control Audiio from your phone |
| [Addons](docs/user-guide/addons/README.md) | Extend Audiio with plugins |
| [Keyboard Shortcuts](docs/user-guide/keyboard-shortcuts.md) | Master the keyboard |
| [FAQ](docs/user-guide/faq.md) | Frequently asked questions |

### For Developers

| Guide | Description |
|-------|-------------|
| [Development Setup](docs/development/setup.md) | Set up your dev environment |
| [Building](docs/development/building.md) | Build from source |
| [Architecture](docs/development/architecture.md) | System design overview |
| [Addon Development](docs/development/addons/README.md) | Create custom addons |
| [SDK Reference](docs/sdk/README.md) | Addon SDK API |
| [API Reference](docs/api/README.md) | REST API for mobile clients |

[Browse all documentation](docs/README.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Desktop App                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  UI (React) │  │    Core     │  │   Addons    │  │   Mobile    │ │
│  │             │  │  Services   │  │  (Plugins)  │  │   Server    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
         │                                                    │
         │ IPC                                               │ REST/WS
         ▼                                                    ▼
┌─────────────────┐                                 ┌─────────────────┐
│    Electron     │                                 │  Mobile Web App │
│    Main Process │                                 │  (PWA)          │
└─────────────────┘                                 └─────────────────┘
         │                                                    │
         │                                                    │ WebSocket
         ▼                                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Audiio Relay Server                            │
│                   (wss://audiio-relay.fly.dev)                       │
│                                                                      │
│  • E2E Encrypted tunneling (NaCl X25519 + XSalsa20-Poly1305)        │
│  • Memorable connection codes (SWIFT-EAGLE-42)                      │
│  • No data storage - pure relay                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@audiio/core` | Core types and services |
| `@audiio/sdk` | SDK for building addons |
| `@audiio/relay` | Relay server and client |
| `@audiio/ui` | React UI components |
| `@audiio/icons` | Icon library |
| `@audiio/desktop` | Electron desktop app |
| `@audiio/mobile` | Mobile server and web app |
| `@audiio/landing` | Landing page |

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

- Report bugs via [GitHub Issues](https://github.com/magicianjarden/audiio-official/issues)
- Read the [Code of Conduct](CODE_OF_CONDUCT.md)
- Check the [Security Policy](SECURITY.md) for vulnerability reporting

## Tech Stack

- **Desktop**: Electron, TypeScript
- **UI**: React, Zustand, CSS Modules
- **Backend**: Fastify, SQLite
- **Mobile**: PWA, WebSocket
- **Encryption**: TweetNaCl (X25519, XSalsa20-Poly1305)
- **Build**: Turborepo, Vite, esbuild

## License

MIT License - see [LICENSE](LICENSE) for details.

---

[Website](https://audiio.app) · [Documentation](docs/README.md) · [Releases](https://github.com/magicianjarden/audiio-official/releases)
