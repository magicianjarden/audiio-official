# Package Structure

Audiio is organized as a monorepo with multiple packages. This guide covers each package's purpose and relationships.

## Overview

```
audiio-official/
├── packages/
│   ├── core/          # @audiio/core
│   ├── sdk/           # @audiio/sdk
│   ├── ui/            # @audiio/ui
│   ├── desktop/       # @audiio/desktop
│   ├── mobile/        # @audiio/mobile
│   ├── relay/         # @audiio/relay
│   ├── icons/         # @audiio/icons
│   ├── landing/       # @audiio/landing
│   ├── ml-core/       # @audiio/ml-core
│   ├── ml-sdk/        # @audiio/ml-sdk
│   ├── demucs-server/ # @audiio/demucs-server
│   └── server/        # @audiio/server
├── addons/
│   ├── deezer-metadata/
│   ├── youtube-music/
│   ├── lrclib-lyrics/
│   ├── karaoke/
│   └── ...
└── docs/
```

## Dependency Graph

```
                    ┌─────────────┐
                    │   addons    │
                    └──────┬──────┘
                           │ uses
                    ┌──────▼──────┐
                    │     sdk     │
                    └──────┬──────┘
                           │ extends
┌─────────────┐     ┌──────▼──────┐     ┌─────────────┐
│   desktop   │────►│    core     │◄────│   mobile    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │            ┌──────▼──────┐            │
       └───────────►│     ui      │◄───────────┘
                    └─────────────┘
```

## Core Packages

### @audiio/core

**Purpose**: Shared types, interfaces, and base services.

```
packages/core/
├── src/
│   ├── types/           # Type definitions
│   │   ├── addon.ts     # Addon types
│   │   ├── track.ts     # Track, Album, Artist
│   │   └── ...
│   ├── registry/        # Addon registry
│   │   └── addon-registry.ts
│   └── index.ts         # Public exports
├── package.json
└── tsconfig.json
```

**Key Exports**:
- Type definitions (Track, Album, Artist, Playlist)
- Addon interfaces (MetadataProvider, StreamProvider, etc.)
- AddonRegistry class

**Dependencies**: None (base package)

### @audiio/sdk

**Purpose**: SDK for building addons.

```
packages/sdk/
├── src/
│   ├── base/            # Base classes
│   │   ├── BaseAddon.ts
│   │   └── BaseAudioProcessor.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Key Exports**:
- BaseAddon class
- BaseMetadataProvider
- BaseStreamProvider
- BaseLyricsProvider
- BaseAudioProcessor
- BaseScrobbler

**Dependencies**: `@audiio/core`

### @audiio/ui

**Purpose**: React UI components and state management.

```
packages/ui/
├── src/
│   ├── components/      # React components
│   │   ├── Player/
│   │   ├── Library/
│   │   ├── Discover/
│   │   ├── Search/
│   │   └── ...
│   ├── stores/          # Zustand stores
│   │   ├── player-store.ts
│   │   ├── library-store.ts
│   │   └── ...
│   ├── hooks/           # Custom React hooks
│   ├── styles.css       # Global styles
│   └── App.tsx          # Root component
├── package.json
└── tsconfig.json
```

**Key Exports**:
- App component
- All UI components
- Zustand stores
- Custom hooks

**Dependencies**: `@audiio/core`, `@audiio/icons`

## Application Packages

### @audiio/desktop

**Purpose**: Electron desktop application.

```
packages/desktop/
├── src/
│   ├── main.ts          # Electron main process
│   ├── preload.ts       # Preload script
│   └── services/        # IPC handlers
│       ├── library-bridge.ts
│       ├── addon-loader.ts
│       └── ...
├── package.json
└── electron-builder.yml
```

**Key Features**:
- Electron main process
- IPC bridge to renderer
- Native file system access
- Auto-updater
- System tray

**Dependencies**: `@audiio/core`, `@audiio/ui`

### @audiio/mobile

**Purpose**: Mobile remote server and web app.

```
packages/mobile/
├── src/
│   ├── server/          # Fastify server
│   │   ├── index.ts
│   │   ├── api/
│   │   │   └── routes.ts
│   │   └── services/
│   │       ├── auth-manager.ts
│   │       ├── device-manager.ts
│   │       └── p2p-manager.ts
│   ├── web/             # React web app
│   │   ├── App.tsx
│   │   ├── pages/
│   │   └── components/
│   └── shared/          # Shared types
│       └── types.ts
├── package.json
└── tsconfig.json
```

**Key Features**:
- Fastify REST API
- WebSocket for real-time updates
- P2P connectivity via relay
- Responsive web interface

**Dependencies**: `@audiio/core`

### @audiio/relay

**Purpose**: P2P relay server for mobile connections.

```
packages/relay/
├── src/
│   ├── server/          # Relay server
│   │   ├── index.ts
│   │   ├── relay-server.ts
│   │   └── connection-manager.ts
│   ├── client/          # Desktop client
│   │   └── relay-client.ts
│   └── shared/          # Shared protocol
│       └── messages.ts
├── package.json
└── Dockerfile
```

**Key Features**:
- WebSocket relay server
- E2E encryption with NaCl
- Memorable connection codes
- Fly.io deployment ready

**Dependencies**: `@audiio/core`

## Support Packages

### @audiio/icons

**Purpose**: SVG icon library.

```
packages/icons/
├── src/
│   ├── icons/
│   │   ├── player.tsx   # Player icons
│   │   ├── navigation.tsx
│   │   ├── device.tsx
│   │   └── ...
│   └── index.ts
└── package.json
```

**Key Exports**:
- All icon components
- Icon utility functions

**Dependencies**: None

### @audiio/landing

**Purpose**: Marketing landing page.

```
packages/landing/
├── src/
│   ├── components/
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── Download.tsx
│   │   └── ...
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

**Key Features**:
- Static marketing site
- Download links
- Feature showcase

**Dependencies**: `@audiio/icons`

## ML Packages

### @audiio/ml-sdk

**Purpose**: SDK for ML-powered features.

```
packages/ml-sdk/
├── src/
│   └── index.ts
└── package.json
```

### @audiio/ml-core

**Purpose**: Core ML functionality.

```
packages/ml-core/
├── src/
│   └── index.ts
└── package.json
```

### @audiio/demucs-server

**Purpose**: Stem separation server using Demucs.

```
packages/demucs-server/
├── src/
│   └── ...
├── README.md
└── package.json
```

## Addons

Addons extend Audiio's functionality. Each addon is a separate package.

### Built-in Addons

| Addon | Purpose |
|-------|---------|
| `deezer-metadata` | Track/artist/album metadata from Deezer |
| `youtube-music` | Audio streams from YouTube Music |
| `lrclib-lyrics` | Synced lyrics from LRCLib |
| `karaoke` | Vocal removal and stem separation |
| `audiio-algo` | Recommendation algorithms |
| `sposify` | Spotify-like features |
| `applemusic-artwork` | High-quality artwork from Apple Music |

### Addon Structure

```
addons/deezer-metadata/
├── src/
│   └── index.ts         # Addon implementation
├── package.json
└── tsconfig.json
```

## Package Relationships

### Build Order

Packages must be built in dependency order:

1. `@audiio/core` (no dependencies)
2. `@audiio/sdk` (depends on core)
3. `@audiio/icons` (no dependencies)
4. `@audiio/ml-sdk` (depends on core)
5. `@audiio/ml-core` (depends on ml-sdk)
6. `@audiio/ui` (depends on core, icons)
7. `@audiio/desktop` (depends on core, ui)
8. `@audiio/mobile` (depends on core)
9. `@audiio/relay` (depends on core)
10. `@audiio/landing` (depends on icons)
11. All addons (depend on sdk)

### Shared Dependencies

| Package | Used By |
|---------|---------|
| `zustand` | ui, mobile |
| `react` | ui, mobile, landing |
| `fastify` | mobile |
| `electron` | desktop |
| `better-sqlite3` | desktop |
| `tweetnacl` | relay, mobile |

## Working with Packages

### Adding a New Package

1. Create directory under `packages/`
2. Add `package.json` with `@audiio/` namespace
3. Add to workspace in root `package.json`
4. Configure `tsconfig.json` extending base

### Cross-Package Imports

```typescript
// In packages/ui/src/components/Player.tsx
import { Track } from '@audiio/core';
import { PlayIcon } from '@audiio/icons';
```

### Local Development

```bash
# Work on a specific package
cd packages/ui
npm run dev

# Changes to dependencies trigger rebuilds
```

## Next Steps

- [Architecture](architecture.md) - System design and data flow
- [Building](building.md) - Build and package
- [Addon Development](addons/README.md) - Create addons

