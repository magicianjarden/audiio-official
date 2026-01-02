# Package Structure

Audiio is organized as a monorepo with 13 packages. This guide covers each package's purpose, structure, and relationships.

## Overview

```
audiio-official/
├── packages/
│   ├── core/              # @audiio/core - Types, orchestrators, plugin interfaces
│   ├── sdk/               # @audiio/sdk - Plugin development SDK
│   ├── ui/                # @audiio/ui - React UI (21 stores)
│   ├── desktop/           # @audiio/desktop - Electron app
│   ├── mobile/            # @audiio/mobile - Mobile server + web app
│   ├── relay/             # @audiio/relay - P2P relay server/client
│   ├── server/            # @audiio/server - Standalone REST API
│   ├── icons/             # @audiio/icons - 170+ icon components
│   ├── landing/           # @audiio/landing - Marketing website
│   ├── ml-core/           # @audiio/ml-core - ML engine
│   ├── ml-sdk/            # @audiio/ml-sdk - ML plugin SDK
│   ├── demucs-server/     # @audiio/demucs-server - Vocal separation
│   └── plugin-musicbrainz/# @audiio/plugin-musicbrainz - MusicBrainz provider
├── addons/                # Built-in addon plugins
└── docs/
```

## Dependency Graph

```
                         ┌────────────────┐
                         │    addons/     │
                         │   plugins      │
                         └───────┬────────┘
                                 │ uses
                         ┌───────▼────────┐
                         │      sdk       │
                         └───────┬────────┘
                                 │ extends
┌─────────────┐          ┌───────▼────────┐          ┌─────────────┐
│   desktop   │─────────►│      core      │◄─────────│   mobile    │
└──────┬──────┘          └───────┬────────┘          └──────┬──────┘
       │                         │                          │
       │                 ┌───────▼────────┐                 │
       └────────────────►│       ui       │◄────────────────┘
                         └────────────────┘

┌─────────────┐          ┌────────────────┐
│   ml-core   │◄─────────│    ml-sdk      │
└─────────────┘          └────────────────┘

┌─────────────┐
│    relay    │◄──────── mobile (uses client)
└─────────────┘
```

## Core Packages

### @audiio/core

**Purpose**: Shared types, interfaces, orchestrators, and base services.

```
packages/core/
├── src/
│   ├── types/              # Type definitions
│   │   ├── addon.ts        # All 7 addon role interfaces
│   │   ├── track.ts        # Track, Album, Artist, UnifiedTrack
│   │   ├── search.ts       # SearchResult types
│   │   └── ...
│   ├── orchestrators/      # Business logic orchestrators
│   │   ├── SearchOrchestrator.ts
│   │   ├── TrackResolver.ts
│   │   ├── PlaybackOrchestrator.ts
│   │   └── MetadataOrchestrator.ts
│   ├── services/           # Core services
│   │   ├── TrackMatcher.ts
│   │   ├── MediaProcessor.ts
│   │   └── AudioAnalyzer.ts
│   ├── registry/           # Plugin registry
│   │   └── addon-registry.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Key Exports**:
- **Types**: Artist, Album, UnifiedTrack, SearchResult, LyricsResult, ExternalIds, AudioFeatures
- **Orchestrators**: SearchOrchestrator, TrackResolver, PlaybackOrchestrator, MetadataOrchestrator
- **Services**: TrackMatcher, MediaProcessor, AudioAnalyzer
- **Registry**: AddonRegistry
- **Plugin Interfaces**: MetadataProvider, StreamProvider, LyricsProvider, Scrobbler, AudioProcessor, Tool, ArtistEnrichmentProvider

**Dependencies**: None (base package)

---

### @audiio/sdk

**Purpose**: SDK for building plugins/addons with base classes and utilities.

```
packages/sdk/
├── src/
│   ├── base/               # Base provider classes
│   │   ├── BaseMetadataProvider.ts
│   │   ├── BaseStreamProvider.ts
│   │   ├── BaseLyricsProvider.ts
│   │   ├── BaseAudioProcessor.ts
│   │   ├── BaseTool.ts
│   │   └── BaseArtistEnrichmentProvider.ts
│   ├── types.ts            # SDK-specific types
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Key Exports**:
- **Base Classes**: BaseMetadataProvider, BaseStreamProvider, BaseLyricsProvider, BaseAudioProcessor, BaseTool, BaseArtistEnrichmentProvider
- **Types**: PluginManifest, AudiioPluginPackageJson
- **Registration**: `defineAddon()`
- Re-exports from @audiio/core

**Dependencies**: `@audiio/core`

---

### @audiio/ui

**Purpose**: React UI components and state management (21 Zustand stores).

```
packages/ui/
├── src/
│   ├── components/         # React components
│   │   ├── Player/         # Player controls
│   │   ├── Library/        # Library views
│   │   ├── Discover/       # Discovery/home
│   │   ├── Search/         # Search interface
│   │   ├── Artist/         # Artist pages
│   │   ├── Lyrics/         # Lyrics display
│   │   ├── Stats/          # Statistics
│   │   └── RecommendationExplanation/
│   ├── stores/             # 21 Zustand stores
│   │   ├── player-store.ts
│   │   ├── smart-queue-store.ts
│   │   ├── karaoke-store.ts
│   │   ├── ml-store.ts
│   │   ├── library-store.ts
│   │   ├── theme-store.ts
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Audio, search, translation
│   ├── ml/                 # ML integration
│   ├── registry/           # Plugin registry UI
│   ├── contexts/           # React contexts
│   ├── audio-worklets/     # Web Audio API worklets
│   ├── styles.css
│   └── App.tsx
├── package.json
└── tsconfig.json
```

**Key Exports**:
- App component
- All UI components
- 21 Zustand stores
- Custom hooks

**Dependencies**: `@audiio/core`, `@audiio/icons`, `react`, `zustand`, `@tensorflow/tfjs`, `fuse.js`

---

## Application Packages

### @audiio/desktop

**Purpose**: Electron desktop application with 131+ IPC handlers.

```
packages/desktop/
├── src/
│   ├── main.ts             # Electron main process (131+ IPC handlers)
│   ├── preload.ts          # IPC bridge (33KB)
│   ├── local-metadata-service.ts  # Local music metadata
│   └── services/           # Main process services
│       ├── library-bridge.ts
│       ├── plugin-loader.ts
│       ├── ml-service.ts
│       ├── karaoke-service.ts
│       └── component-service.ts
├── package.json
└── electron-builder.yml
```

**Key Features**:
- 131+ IPC handlers for renderer communication
- Dynamic plugin loading (npm, git, local, HTTP)
- ML service integration
- Karaoke service with instant playback
- Component service for UI plugins
- Auto-updater and system tray

**Dependencies**: `@audiio/core`, `@audiio/ui`, `@audiio/mobile`, `@audiio/sdk`, `@audiio/ml-core`, `electron`, `better-sqlite3`

---

### @audiio/mobile

**Purpose**: Mobile remote server (Fastify) + web app (React).

```
packages/mobile/
├── src/
│   ├── server/             # Fastify backend
│   │   ├── index.ts        # Server entry
│   │   ├── api/
│   │   │   └── routes.ts   # 60+ REST endpoints
│   │   └── services/
│   │       ├── server-identity.ts   # Static room identity
│   │       ├── pairing-service.ts   # Device pairing
│   │       ├── device-manager.ts    # Device management
│   │       └── p2p-manager.ts       # P2P relay client
│   ├── web/                # React web app
│   │   ├── App.tsx
│   │   ├── pages/          # Route pages
│   │   ├── components/     # UI components
│   │   └── stores/         # Zustand stores
│   └── shared/             # Shared types
│       └── types.ts
├── package.json
└── tsconfig.json
```

**Key Features**:
- Static room model with persistent room IDs
- Multi-layer authentication (access tokens, pairing codes, device tokens, room passwords)
- Two playback modes: Remote Control and Local Playback
- 60+ REST API endpoints
- WebSocket for real-time sync
- P2P connectivity via relay

**Dependencies**: `@audiio/core`, `@audiio/icons`, `@audiio/relay`, `fastify`, `react`, `tweetnacl`, `zustand`

---

### @audiio/relay

**Purpose**: P2P relay server and client for secure remote access.

```
packages/relay/
├── src/
│   ├── server/             # WebSocket relay server
│   │   ├── index.ts        # RelayServer implementation
│   │   └── connection-manager.ts
│   ├── client/             # Desktop relay client
│   │   └── relay-client.ts
│   └── shared/             # Shared code
│       ├── types.ts        # Static room types
│       ├── codes.ts        # Room code generation
│       ├── crypto.ts       # NaCl encryption
│       └── messages.ts     # Protocol messages
├── package.json
└── Dockerfile
```

**Key Features**:
- Static room model (persistent room IDs)
- Deterministic room codes (ADJECTIVE-NOUN-NUMBER)
- Password protection (SHA-512 hashed)
- E2E encryption with NaCl (X25519 + XSalsa20-Poly1305)
- 24-hour room persistence after desktop offline

**Dependencies**: `ws`, `tweetnacl`, `nanoid`

---

### @audiio/server

**Purpose**: Standalone REST API server (post-MVP).

```
packages/server/
├── src/
│   └── index.ts            # Fastify server
├── package.json
└── tsconfig.json
```

**Key Features** (planned):
- REST API for external clients
- Library persistence with SQLite
- Stream proxying

**Dependencies**: `@audiio/core`, `fastify`, `better-sqlite3`

---

## Support Packages

### @audiio/icons

**Purpose**: 170+ React SVG icon components.

```
packages/icons/
├── src/
│   ├── icons/
│   │   ├── player.tsx      # Playback icons
│   │   ├── navigation.tsx  # Navigation icons
│   │   ├── device.tsx      # Device icons
│   │   └── ...
│   └── index.ts
└── package.json
```

**Icon Categories**:
- **Brand**: AudiioLogoIcon
- **Playback**: PlayIcon, PauseIcon, NextIcon, ShuffleIcon, RepeatIcon
- **Navigation**: HomeIcon, SearchIcon, LibraryIcon, ChevronIcon
- **Media**: MusicNoteIcon, PlaylistIcon, AlbumIcon, KaraokeIcon
- **Actions**: HeartIcon, ThumbUpIcon, AddIcon, DeleteIcon, ShareIcon
- **Social**: GitHubIcon, TwitterIcon, SpotifyIcon, AppleMusicIcon

**Dependencies**: `react` (peer)

---

### @audiio/landing

**Purpose**: Marketing landing page.

```
packages/landing/
├── src/
│   ├── components/
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── ThemeShowcase.tsx
│   │   ├── Navbar.tsx
│   │   └── Download.tsx
│   ├── hooks/
│   │   └── useTheme.tsx
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

**Dependencies**: `@audiio/icons`, `react`, Vite

---

## ML Packages

### @audiio/ml-core

**Purpose**: ML engine and recommendation orchestration.

```
packages/ml-core/
├── src/
│   ├── engine/             # Core ML engine
│   │   ├── MLEngine.ts
│   │   ├── AlgorithmRegistry.ts
│   │   └── FeatureAggregator.ts
│   ├── algorithms/         # Scoring algorithms
│   │   ├── HybridScorer.ts
│   │   ├── NeuralScorer.ts
│   │   ├── RadioGenerator.ts
│   │   └── Trainer.ts
│   ├── providers/          # Feature providers
│   │   ├── EmotionProvider.ts
│   │   ├── EmbeddingProvider.ts
│   │   └── LyricsProvider.ts
│   ├── learning/           # Learning system
│   │   ├── EventRecorder.ts
│   │   ├── PreferenceStore.ts
│   │   └── TrainingScheduler.ts
│   ├── queue/              # Smart queue
│   │   └── SmartQueue.ts
│   └── embeddings/         # Vector embeddings
│       ├── EmbeddingEngine.ts
│       ├── VectorIndex.ts
│       ├── TasteProfileManager.ts
│       └── PlaylistGenerator.ts
└── package.json
```

**Key Exports**:
- **Engine**: MLEngine, AlgorithmRegistry, FeatureAggregator
- **Algorithms**: HybridScorer, NeuralScorer, Trainer, RadioGenerator
- **Features**: extractTrackFeatures, extractContextFeatures
- **Learning**: EventRecorder, PreferenceStore, TrainingScheduler
- **Embeddings**: EmbeddingEngine, VectorIndex, TasteProfileManager

**Dependencies**: `@audiio/ml-sdk`, `@tensorflow/tfjs`, `essentia.js`, `idb`

---

### @audiio/ml-sdk

**Purpose**: SDK for building ML algorithm plugins.

```
packages/ml-sdk/
├── src/
│   ├── types/              # ML type definitions
│   │   ├── AlgorithmPlugin.ts
│   │   ├── TrackScore.ts
│   │   ├── ScoringContext.ts
│   │   └── UserEvent.ts
│   ├── base/               # Base classes
│   │   └── BaseAlgorithm.ts
│   └── utils/              # ML utilities
│       └── normalizeAudioFeatures.ts
└── package.json
```

**Exports**:
- Main: Types and interfaces
- `./base`: BaseAlgorithm class
- `./utils`: normalizeAudioFeatures and utilities
- `./testing`: Test utilities

**Dependencies**: `@tensorflow/tfjs` (peer)

---

### @audiio/demucs-server

**Purpose**: Python server for AI vocal separation.

```
packages/demucs-server/
├── server.py               # FastAPI server
├── requirements.txt        # Python dependencies
├── install-cuda.bat        # CUDA setup
└── README.md
```

**Key Features**:
- Demucs model for stem separation
- Vocals, drums, bass, other stems
- CUDA GPU acceleration support

**Language**: Python

---

## Plugin Package

### @audiio/plugin-musicbrainz

**Purpose**: MusicBrainz metadata provider plugin.

```
packages/plugin-musicbrainz/
├── src/
│   ├── index.ts
│   ├── MusicBrainzProvider.ts
│   └── types.ts
└── package.json
```

**Plugin Manifest**:
```json
{
  "audiio": {
    "type": "plugin",
    "id": "musicbrainz",
    "name": "MusicBrainz",
    "roles": ["metadata-provider"]
  }
}
```

**Dependencies**: `@audiio/sdk`, `@audiio/core` (peer)

---

## Built-in Addons

Located in `addons/` directory:

| Addon | Roles | Purpose |
|-------|-------|---------|
| `deezer-metadata` | metadata-provider | Track/artist/album metadata from Deezer |
| `youtube-music` | stream-provider | Audio streams from YouTube Music |
| `lrclib-lyrics` | lyrics-provider | Synced lyrics from LRCLib |
| `karaoke` | audio-processor | Vocal removal with instant playback |
| `audiio-algo` | - | Recommendation algorithms |
| `sposify` | tool | Spotify data import |
| `applemusic-artwork` | metadata-provider | High-quality artwork |
| `fanart-enrichment` | artist-enrichment | Artist images from Fanart.tv |

---

## Package Relationships

### Build Order

Packages must be built in dependency order:

1. `@audiio/core` (no dependencies)
2. `@audiio/icons` (no dependencies)
3. `@audiio/sdk` (depends on core)
4. `@audiio/ml-sdk` (no @audiio dependencies)
5. `@audiio/ml-core` (depends on ml-sdk)
6. `@audiio/relay` (no @audiio dependencies)
7. `@audiio/ui` (depends on core, icons)
8. `@audiio/mobile` (depends on core, icons, relay)
9. `@audiio/desktop` (depends on core, ui, mobile, sdk, ml-core)
10. `@audiio/landing` (depends on icons)
11. `@audiio/server` (depends on core)
12. `@audiio/plugin-musicbrainz` (depends on sdk, core)
13. All addons (depend on sdk)

### Shared Dependencies

| Package | Used By |
|---------|---------|
| `zustand` | ui, mobile |
| `react` | ui, mobile, landing, icons |
| `fastify` | mobile, server |
| `electron` | desktop |
| `better-sqlite3` | desktop, server |
| `tweetnacl` | relay, mobile |
| `@tensorflow/tfjs` | ui, ml-core, ml-sdk |

---

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

// In packages/mobile/src/server/api/routes.ts
import { RelayClient } from '@audiio/relay';
```

### Local Development

```bash
# Build all packages in order
npm run build:all

# Work on a specific package
cd packages/ui
npm run dev

# Run desktop app (requires built dependencies)
npm run dev
```

---

## Summary Table

| Package | Type | Purpose | Key Tech |
|---------|------|---------|----------|
| @audiio/core | Library | Types, orchestrators | TypeScript |
| @audiio/sdk | SDK | Plugin development | TypeScript |
| @audiio/ui | Component Library | React UI, 21 stores | React, Zustand |
| @audiio/desktop | Electron App | Desktop app, 131+ IPC | Electron |
| @audiio/mobile | Hybrid | Server + web app | Fastify, React |
| @audiio/relay | Network | P2P relay | WebSocket, NaCl |
| @audiio/server | API Server | REST API (planned) | Fastify |
| @audiio/icons | Icons | 170+ icons | React SVG |
| @audiio/landing | Website | Marketing page | Vite, React |
| @audiio/ml-core | ML Engine | Recommendations | TensorFlow.js |
| @audiio/ml-sdk | ML SDK | ML plugins | TensorFlow.js |
| @audiio/demucs-server | Python | Vocal separation | Demucs, Python |
| @audiio/plugin-musicbrainz | Plugin | MusicBrainz data | TypeScript |

---

## Next Steps

- [Architecture](architecture.md) - System design and data flow
- [Building](building.md) - Build and package
- [Addon Development](addons/README.md) - Create addons
- [SDK Reference](../sdk/README.md) - SDK API documentation
