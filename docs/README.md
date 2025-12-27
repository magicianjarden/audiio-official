# Audiio Documentation

Welcome to the Audiio documentation. Audiio is a modern, privacy-first music streaming platform that runs on your desktop and streams to your mobile devices.

## 📚 Documentation

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
| [Packages](./development/packages.md) | Monorepo structure |
| [Addon Development](./development/addons/README.md) | Create your own addons |
| [Stores](./development/stores.md) | Zustand state patterns |
| [IPC Reference](./development/ipc-reference.md) | Desktop IPC handlers |
| [Mobile Server](./development/mobile-server.md) | Mobile server internals |
| [ML System](./development/ml-system.md) | Recommendation engine |
| [Testing](./development/testing.md) | Run and write tests |

### Reference

| Guide | Description |
|-------|-------------|
| [SDK](./sdk/README.md) | Addon SDK API reference |
| [Relay](./relay/README.md) | Self-host a relay server |
| [API](./api/README.md) | REST API reference |
| [Theming](./theming/README.md) | Theme system reference |

## Architecture Overview

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
         │ HTTP                                              │ WebSocket
         ▼                                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Audiio Relay Server                            │
│                   (wss://audiio-relay.fly.dev)                       │
│                                                                      │
│  • E2E Encrypted tunneling                                          │
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

## Key Features

### Privacy-First
- No cloud accounts required
- Your music stays on your machine
- E2E encrypted remote access

### Extensible
- Plugin system for metadata sources
- Support for multiple streaming providers
- Custom audio processors (karaoke, stems)

### Modern Stack
- TypeScript throughout
- React for UI
- Zustand for state management
- Fastify for API server
- NaCl for encryption

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
