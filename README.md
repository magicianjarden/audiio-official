# Audiio

A modern, privacy-first music streaming platform that runs on your desktop and streams to your mobile devices.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/magicianjarden/audiio-official)](https://github.com/magicianjarden/audiio-official/releases)

> **Note:** This project is undergoing a major restructuring. The codebase is being rebuilt from the ground up. Documentation may not reflect the current state of the application and will be updated as the restructuring progresses.

---

### AI-Generated Code Disclaimer

This is a **vibecoded project** - the majority of this codebase was written with AI assistance (primarily Claude). We believe in transparency, so here's what you should know:

**What this means:**
- Code was generated through AI prompts and iterative refinement
- Human oversight varied - some sections were carefully reviewed, others less so
- The project prioritized rapid development over traditional code review processes

**Potential concerns:**
- **Security vulnerabilities** - AI-generated code may contain security flaws that weren't caught during development. Do not use in production environments without a thorough security audit.
- **Unexpected behaviors** - Edge cases and error handling may be incomplete or incorrect
- **Code quality** - Some patterns may be inconsistent, over-engineered, or non-idiomatic
- **Dependencies** - AI may have suggested packages without fully vetting their security or maintenance status

**Our recommendation:**
- Treat this as experimental/educational software
- Review any code you plan to use in your own projects
- Report security issues via our security policy
- Contributions that improve code quality are especially welcome

---

## Features

- **Multi-Source Streaming** - Aggregate music from various sources through addons
- **Privacy-First** - No cloud accounts, your music stays on your machine
- **Mobile Remote** - Control your desktop or stream directly to mobile with E2E encryption
- **Extensible** - 7 addon roles for metadata, lyrics, streaming, audio processing, and more
- **Personalized** - ML-powered recommendations that learn from your listening
- **Karaoke Mode** - AI-powered vocal removal with instant playback (~3-4 seconds)
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
| [Mobile Remote](docs/user-guide/mobile/README.md) | Control or stream to your phone |
| [Addons](docs/user-guide/addons/README.md) | Extend Audiio with plugins |
| [Keyboard Shortcuts](docs/user-guide/keyboard-shortcuts.md) | Master the keyboard |
| [FAQ](docs/user-guide/faq.md) | Frequently asked questions |

### For Developers

| Guide | Description |
|-------|-------------|
| [Development Setup](docs/development/setup.md) | Set up your dev environment |
| [Architecture](docs/development/architecture.md) | System design (21 stores, 131+ IPC) |
| [Packages](docs/development/packages.md) | Monorepo structure (13 packages) |
| [Addon Development](docs/development/addons/README.md) | Create custom addons (7 roles) |
| [SDK Reference](docs/sdk/README.md) | Addon SDK API |
| [API Reference](docs/api/README.md) | REST API (60+ endpoints) |
| [Relay](docs/relay/README.md) | P2P relay server |

[Browse all documentation](docs/README.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Desktop App                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  UI (React) │  │    Core     │  │   Plugins   │  │   Mobile Server     │ │
│  │  21 Stores  │  │ Orchestrat. │  │  (7 Roles)  │  │   (Fastify + P2P)   │ │
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

## Key Highlights

| Feature | Details |
|---------|---------|
| **21 Zustand Stores** | Player, smart queue, karaoke, ML, library, theme, and more |
| **131+ IPC Handlers** | Playback, search, plugins, ML, karaoke, mobile auth |
| **7 Addon Roles** | metadata, stream, lyrics, scrobbler, audio-processor, tool, artist-enrichment |
| **60+ API Endpoints** | Full REST API for mobile clients |
| **Static Room Model** | Persistent room IDs - pair once, connect forever |
| **Two Playback Modes** | Remote control or local streaming (Plex-like) |
| **E2E Encryption** | NaCl X25519 + XSalsa20-Poly1305 |

## Packages

| Package | Description |
|---------|-------------|
| `@audiio/core` | Core types, orchestrators, plugin interfaces |
| `@audiio/sdk` | SDK for building addons (7 roles) |
| `@audiio/ui` | React UI components (21 Zustand stores) |
| `@audiio/client` | Electron desktop app |
| `@audiio/relay` | P2P relay server/client |
| `@audiio/icons` | 170+ icon components |
| `@audiio/landing` | Marketing landing page |
| `@audiio/ml-core` | ML engine and recommendations |
| `@audiio/ml-sdk` | SDK for ML algorithm plugins |
| `@audiio/demucs-server` | AI vocal separation (Python) |
| `@audiio/server` | Standalone REST API (planned) |
| `@audiio/plugin-musicbrainz` | MusicBrainz metadata provider |

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

- Report bugs via [GitHub Issues](https://github.com/magicianjarden/audiio-official/issues)
- Read the [Code of Conduct](CODE_OF_CONDUCT.md)
- Check the [Security Policy](SECURITY.md) for vulnerability reporting

## Tech Stack

- **Desktop**: Electron 33, TypeScript
- **UI**: React 18, Zustand 5, CSS Modules
- **Backend**: Fastify 5, SQLite
- **Mobile**: PWA, WebSocket
- **ML**: TensorFlow.js, Essentia.js
- **Encryption**: TweetNaCl (X25519, XSalsa20-Poly1305)
- **Build**: Turborepo, Vite, esbuild

## License

MIT License - see [LICENSE](LICENSE) for details.

---

[Website](https://audiio.app) · [Documentation](docs/README.md) · [Releases](https://github.com/magicianjarden/audiio-official/releases)
