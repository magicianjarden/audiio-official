# Audiio Developer Guide

Welcome to the Audiio developer documentation. This guide covers everything you need to contribute to Audiio or build addons.

## Getting Started

| Guide | Description |
|-------|-------------|
| [Setup](setup.md) | Set up your development environment |
| [Building](building.md) | Build and package the app |
| [Architecture](architecture.md) | System design and data flow |
| [Packages](packages.md) | Package structure and relationships |

## Building Addons

Addons extend Audiio with new functionality. See our addon development guides:

| Guide | Description |
|-------|-------------|
| [Overview](addons/README.md) | Addon system architecture |
| [Tutorial](addons/tutorial.md) | Build your first addon |
| [Metadata Provider](addons/metadata-provider.md) | Provide track/artist/album info |
| [Stream Provider](addons/stream-provider.md) | Provide audio streams |
| [Lyrics Provider](addons/lyrics-provider.md) | Provide synced lyrics |
| [Audio Processor](addons/audio-processor.md) | Process audio (karaoke, stems) |
| [Scrobbler](addons/scrobbler.md) | Track listening history |

## Core Systems

| Guide | Description |
|-------|-------------|
| [Stores](stores.md) | Zustand state management patterns |
| [IPC Reference](ipc-reference.md) | Desktop IPC handlers |
| [Mobile Server](mobile-server.md) | Mobile API and WebSocket |
| [ML System](ml-system.md) | Recommendation engine |
| [Testing](testing.md) | Running and writing tests |

## Package Overview

```
packages/
├── core/       # Types, interfaces, base services
├── sdk/        # SDK for building addons
├── ui/         # React components and stores
├── desktop/    # Electron main process
├── mobile/     # Fastify server + React web app
├── relay/      # P2P relay server
├── icons/      # Icon library
└── landing/    # Marketing site
```

## Quick Reference

### Running the App

```bash
# Install dependencies
npm install

# Build all packages
npm run build:all

# Development mode
npm run dev

# Package for distribution
npm run package
```

### Key Technologies

| Technology | Usage |
|------------|-------|
| TypeScript | All packages |
| React | UI components |
| Zustand | State management |
| Electron | Desktop app |
| Fastify | Mobile server |
| NaCl | E2E encryption |

### Addon Roles

| Role | Description |
|------|-------------|
| `metadata-provider` | Track, artist, album metadata |
| `stream-provider` | Audio stream URLs |
| `lyrics-provider` | Synced or plain lyrics |
| `audio-processor` | Audio processing (karaoke) |
| `scrobbler` | Listening history tracking |

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## API Reference

- [REST API](../api/README.md) - Mobile server endpoints
- [SDK Reference](../sdk/README.md) - Addon SDK types and classes
- [Relay Protocol](../relay/README.md) - P2P relay messages

## Resources

- [GitHub Repository](https://github.com/magicianjarden/audiio-official)
- [Issue Tracker](https://github.com/magicianjarden/audiio-official/issues)
