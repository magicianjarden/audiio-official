# System Architecture

This document describes Audiio's architecture, data flow, and design decisions.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Desktop App (Electron)                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │   Renderer (UI)  │  │   Main Process   │  │     Mobile Server         │  │
│  │   React + Zustand│──│   Node.js APIs   │──│     Fastify + P2P         │  │
│  │   (21 Stores)    │  │   (131+ IPC)     │  │                           │  │
│  └──────────────────┘  └──────────────────┘  └───────────────────────────┘  │
│           │                     │                         │                  │
│           │                ┌────▼────┐                    │                  │
│           │                │ Plugin  │                    │                  │
│           │                │ System  │                    │                  │
│           │                │(Dynamic)│                    │                  │
│           │                └────┬────┘                    │                  │
│           │                     │                         │                  │
│  ┌────────▼─────────────────────▼─────────────────────────▼────────────────┐│
│  │                         Core Services                                    ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ ││
│  │  │   Search     │  │   Playback   │  │   Metadata   │  │    Track    │ ││
│  │  │ Orchestrator │  │ Orchestrator │  │ Orchestrator │  │   Resolver  │ ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                          Main Process Services                           ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐││
│  │  │Plugin Loader│ │ ML Service  │ │Karaoke Svc  │ │   Library Bridge    │││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐││
│  │  │Component Svc│ │Plugin Repos │ │Plugin Inst. │ │Local Metadata Svc   │││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                           SQLite Database                                ││
│  │                    (Library, Playlists, Cache, ML Data)                  ││
│  └──────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ P2P via Relay (E2E Encrypted)
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Mobile Web App (Browser)                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │   React UI       │──│   P2P Store      │──│     Auth Store            │  │
│  │   (PWA)          │  │                  │  │                           │  │
│  └──────────────────┘  └──────────────────┘  └───────────────────────────┘  │
│                                                                              │
│  Two Playback Modes:                                                         │
│  ┌──────────────────────────────┐  ┌───────────────────────────────────────┐│
│  │ Remote Control Mode          │  │ Local Playback Mode (Plex-like)       ││
│  │ Commands → Desktop → Audio   │  │ Resolve stream → Play locally         ││
│  └──────────────────────────────┘  └───────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Desktop Application

#### Main Process

The Electron main process handles:

- Window management (frameless Spotify-style UI)
- System tray integration
- Native file system access
- IPC message routing (131+ handlers)
- Plugin loading and execution (dynamic from npm/git/local)
- SQLite database operations
- Mobile server hosting
- ML service orchestration
- Karaoke/vocal removal processing
- Component management (Demucs installation)

```typescript
// Main process structure
main.ts
├── Window creation and lifecycle
├── Menu and tray setup
├── IPC handler registration (131+ handlers)
├── Plugin system initialization
├── Mobile server startup
├── ML service initialization
├── Karaoke service setup
└── Library bridge initialization
```

#### Main Process Services

| Service | Purpose |
|---------|---------|
| `PluginLoader` | Dynamic plugin discovery and loading from npm/git/local |
| `PluginInstaller` | Install plugins from various sources |
| `PluginRepository` | Manage plugin repositories for discovery |
| `MLService` | ML-powered recommendations and scoring |
| `KaraokeService` | Vocal removal with streaming (instant playback) |
| `LibraryBridge` | Sync renderer library data with mobile server |
| `ComponentService` | Manage optional components (Demucs with Miniconda) |
| `LocalMetadataService` | Read/write ID3 tags, enrich local files |

#### Renderer Process

The renderer runs the React UI with 21 Zustand stores:

```typescript
// Renderer structure
renderer/
├── App.tsx              # Root component
├── components/          # UI components
│   ├── Player/
│   ├── Library/
│   ├── Discover/
│   ├── Search/
│   ├── Settings/
│   ├── Plugins/
│   └── ...
├── stores/              # 21 Zustand stores
│   ├── player-store.ts
│   ├── library-store.ts
│   ├── smart-queue-store.ts
│   ├── karaoke-store.ts
│   ├── ml-store.ts
│   ├── theme-store.ts
│   └── ...
├── hooks/               # Custom hooks
└── services/            # API clients
```

#### IPC Bridge

Communication between main and renderer:

```
┌─────────────┐                    ┌─────────────┐
│  Renderer   │                    │    Main     │
│             │                    │             │
│  window.api │◄──────────────────►│  ipcMain    │
│  .invoke()  │   contextBridge    │  .handle()  │
└─────────────┘                    └─────────────┘
```

Key IPC channel categories (131+ total handlers):

| Category | Count | Examples |
|----------|-------|----------|
| Playback | 5 | play-track, pause, resume, seek |
| Search/Discovery | 20 | search, get-artist, get-album, get-trending |
| Plugin Management | 8 | get-addons, set-addon-enabled, reload-plugins |
| ML Algorithm | 8 | algo-score-track, algo-get-recommendations |
| Audio Analysis | 8 | get-audio-features, analyze-audio-file |
| Mobile Access | 8 | enable-mobile-access, get-mobile-status |
| Mobile Auth | 9 | get-mobile-passphrase, revoke-mobile-device |
| Room Security | 4 | set-room-password, regenerate-room-id |
| Karaoke | 8 | karaoke-process-track, karaoke-get-capabilities |
| Components | 7 | install-demucs, get-demucs-status |
| Plugin Repository | 10 | get-available-plugins, install-plugin-from-source |
| Enrichment | 6 | get-artist-videos, get-artist-timeline |
| Local Music | 6 | scan-music-folder, enrich-local-tracks |

### Plugin System

Plugins extend Audiio's functionality through a dynamic loading system:

```
┌─────────────────────────────────────────────────────────────────┐
│                       Addon Registry                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │  Metadata   │ │   Stream    │ │   Lyrics    │ │  Artist   │ │
│  │  Providers  │ │  Providers  │ │  Providers  │ │Enrichment │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Audio     │ │  Scrobblers │ │    Tools    │               │
│  │ Processors  │ │             │ │             │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

#### Addon Roles

| Role | Interface | Purpose |
|------|-----------|---------|
| `metadata-provider` | `MetadataProvider` | Track/artist/album info |
| `stream-provider` | `StreamProvider` | Audio stream URLs |
| `lyrics-provider` | `LyricsProvider` | Synced lyrics |
| `audio-processor` | `AudioProcessor` | Audio processing (karaoke) |
| `scrobbler` | `Scrobbler` | Listening history |
| `tool` | `Tool` | Data transfer, cloud mounts, utilities |
| `artist-enrichment` | `ArtistEnrichmentProvider` | Videos, timeline, setlists, concerts |

#### Plugin Loading Flow

```typescript
// Plugin loading from multiple sources
1. Scan npm packages (@audiio/plugin-*)
2. Scan user plugins directory
3. Load plugin manifest (package.json)
4. Dynamic import with module resolution hooks
5. Instantiate plugin class
6. Register with AddonRegistry (role-indexed)
7. Initialize plugin
8. Plugin ready for use
```

#### Plugin Sources

- **npm packages**: `@audiio/plugin-{id}`
- **Git repositories**: Clone and build
- **HTTP archives**: Download and extract
- **Local files**: User-installed .audiio-plugin files

### State Management

Using Zustand with 21 specialized stores:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            Zustand Stores (21)                                │
│                                                                              │
│  PLAYBACK & AUDIO                    LIBRARY & PLAYLISTS                     │
│  ┌──────────────┐ ┌──────────────┐   ┌──────────────┐                       │
│  │ player-store │ │smart-queue   │   │library-store │                       │
│  │              │ │    -store    │   │(likes,lists) │                       │
│  └──────────────┘ └──────────────┘   └──────────────┘                       │
│  ┌──────────────┐                                                            │
│  │karaoke-store │  RECOMMENDATIONS & ML                                      │
│  └──────────────┘  ┌──────────────┐ ┌──────────────┐                        │
│                    │recommendation│ │  ml-store    │                        │
│  CONTENT & DISCOVERY│   -store    │ │(TensorFlow)  │                        │
│  ┌──────────────┐  └──────────────┘ └──────────────┘                        │
│  │ search-store │                                                            │
│  └──────────────┘  THEME & UI                                               │
│  ┌──────────────┐  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │trending-store│  │ theme-store  │ │  ui-store    │ │shortcut-store│       │
│  └──────────────┘  │ (8 built-in) │ │              │ │              │       │
│  ┌──────────────┐  └──────────────┘ └──────────────┘ └──────────────┘       │
│  │ lyrics-store │                                                            │
│  └──────────────┘  NAVIGATION & DETAILS                                     │
│  ┌──────────────┐  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │lyrics-search │  │navigation    │ │ artist-store │ │ album-store  │       │
│  │   -store     │  │   -store     │ │              │ │              │       │
│  └──────────────┘  └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
│  UTILITIES                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ toast-store  │ │translation   │ │ plugin-store │ │settings-store│        │
│  │              │ │   -store     │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐                                                            │
│  │ stats-store  │                                                            │
│  └──────────────┘                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Key Store Features

| Store | Key Features |
|-------|--------------|
| `player-store` | Video mode support, stream prefetching, local track support |
| `smart-queue-store` | Auto-queue, radio mode, 7 recommendation sources, ML hybrid scoring |
| `karaoke-store` | Vocal reduction slider, quality modes (auto/quality/balanced/fast) |
| `ml-store` | TensorFlow.js model, hybrid scoring, auto-training |
| `theme-store` | 8 built-in themes, community themes, custom CSS, glassmorphism |
| `library-store` | Nested folder support, local music folders, download queue |
| `lyrics-store` | LRC/ELRC/SRT parsing, sing-along mode, IndexedDB caching |

### Data Flow

#### Playback Flow

```
User clicks play
       │
       ▼
┌─────────────────┐
│  Player Store   │──── Update state
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Track Resolver  │──── Try stream sources
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stream Provider │──── Get audio URL (with ISRC/fuzzy matching)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Audio Element  │──── Play audio
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Scrobblers    │──── Track listen
└─────────────────┘
```

#### Search Flow

```
User types query
       │
       ▼
┌─────────────────┐
│  Search Store   │──── Debounce input
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   IPC Bridge    │──── Send to main
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Search          │──── Query metadata providers
│ Orchestrator    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Artwork         │──── Enhance with Apple/Spotify/Deezer artwork
│ Enhancement     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Search Store   │──── Update results
└─────────────────┘
```

#### Smart Queue Flow

```
Queue running low (< threshold)
       │
       ▼
┌─────────────────┐
│Smart Queue Store│──── Check mode (auto-queue/radio)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 7 Sources:      │
│ • Local library │
│ • Plugin disc.  │
│ • API similar   │
│ • Smart search  │
│ • Trending      │
│ • Search cache  │
│ • ML recommend  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Hybrid Scoring  │──── ML + rule-based with audio features
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Diversity       │──── Limit tracks per artist
│ Filtering       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Player Queue   │──── Add tracks
└─────────────────┘
```

### Mobile Architecture

#### Connection Modes

```
┌─────────────┐                           ┌─────────────┐
│   Desktop   │                           │   Mobile    │
│             │                           │             │
│  ┌───────┐  │     LOCAL NETWORK         │  ┌───────┐  │
│  │HTTP   │◄─┼─────── :8484 ────────────►├──│ HTTP  │  │
│  │Server │  │     Direct REST/WS        │  │Client │  │
│  └───────┘  │                           │  └───────┘  │
│             │                           │             │
│  ┌───────┐  │    ┌─────────────────┐   │  ┌───────┐  │
│  │ P2P   │◄─┼───►│  Relay Server   │◄──┼─►│ P2P   │  │
│  │Manager│  │    │  (E2E Encrypted)│   │  │Store  │  │
│  └───────┘  │    └─────────────────┘   │  └───────┘  │
└─────────────┘                           └─────────────┘
```

#### Static Room Model

```
Desktop (Host)
     │
     ├── Persistent Server ID (UUID, stored locally)
     ├── Deterministic Room Code (derived from ID)
     ├── Optional Password Protection (SHA-512 hashed)
     │
     ▼
Relay Server
     │
     ├── Room ID → Desktop mapping
     ├── Password verification (hash comparison)
     ├── E2E encrypted message relay
     │
     ▼
Mobile (Client)
     │
     ├── Enter room code + optional password
     ├── Receive desktop's public key
     └── E2E encrypted tunnel established
```

#### Mobile Playback Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| Remote Control | Commands sent to desktop, audio plays on desktop | Control music from couch |
| Local Playback | Stream URL resolved, audio plays on mobile | Listen on phone (Plex-like) |

#### Mobile Server API

```typescript
// Mobile server structure
mobile/server/
├── index.ts              # Fastify server + P2P events
├── api/
│   └── routes.ts         # 60+ REST endpoints
├── middleware/
│   └── auth.ts          # Multi-layer auth validation
└── services/
    ├── p2p-manager.ts    # Static room P2P
    ├── pairing-service.ts # Device pairing
    ├── device-manager.ts  # Persistent device storage
    ├── session-manager.ts # Active sessions
    ├── access-manager.ts  # Legacy token management
    └── server-identity.ts # Persistent server identity
```

### Database Schema

SQLite database for local storage:

```sql
-- Core tables
tracks          -- Cached track metadata
artists         -- Artist information
albums          -- Album information

-- User data
likes           -- Liked tracks with timestamps
dislikes        -- Disliked tracks with reasons
playlists       -- User playlists with nested folder support
playlist_tracks -- Playlist contents
folders         -- Playlist folders (hierarchical)
downloads       -- Download queue with progress

-- Playback
play_history    -- Listening history with completion %
queue           -- Current queue
session_history -- Smart queue session (prevents repetition)

-- Settings
settings        -- App settings
addon_settings  -- Per-addon settings

-- ML Data
listen_events   -- Training data for ML
audio_features  -- Cached audio features (BPM, key, energy)
user_profile    -- Artist/genre preferences, time patterns
```

### ML/Recommendation System

```
┌─────────────────────────────────────────────────────────────────┐
│                    Recommendation Engine                         │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Listening  │───►│   Feature    │───►│  Hybrid Scoring  │  │
│  │   History    │    │  Extraction  │    │  (ML + Rules)    │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                                  │
│  Audio Features:        ML Model:           Scoring Modes:       │
│  - BPM (confidence)     - TensorFlow.js     - Conservative       │
│  - Key (Circle of 5ths) - Auto-training     - Balanced          │
│  - Energy (0-1)         - 50+ events req.   - Adventurous       │
│  - Valence (0-1)        - Feature scalers   - Discovery         │
│  - Danceability                                                  │
│  - Acousticness         Outputs:                                 │
│  - Instrumentalness     - Track scores                           │
│  - Loudness (dB)        - Recommendations                        │
│                         - Similar tracks                         │
└─────────────────────────────────────────────────────────────────┘
```

## Security Architecture

### Mobile Access Security

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                             │
│                                                                  │
│  1. Connection Code (knowledge factor)                          │
│     └── Memorable 3-word code (ADJECTIVE-NOUN-NUMBER)           │
│                                                                  │
│  2. Room Password (optional)                                    │
│     └── SHA-512 hashed, never sent in plaintext                 │
│                                                                  │
│  3. Device Authorization                                        │
│     └── Persistent device tokens with approval flow             │
│                                                                  │
│  4. E2E Encryption                                              │
│     └── NaCl X25519 + XSalsa20-Poly1305                        │
│                                                                  │
│  5. Session Tokens                                              │
│     └── Time-limited auth tokens with refresh                   │
│                                                                  │
│  6. Device Management                                           │
│     └── View, revoke, rename connected devices                  │
│                                                                  │
│  7. Room ID Regeneration                                        │
│     └── Invalidate all connections for security reset           │
└─────────────────────────────────────────────────────────────────┘
```

### Plugin Sandboxing

Plugins run with controlled permissions:

- Module resolution hooks redirect imports
- No arbitrary file system access
- Network access through plugin interfaces
- Isolated settings storage

## Performance Considerations

### Caching Strategy

| Cache | TTL | Purpose |
|-------|-----|---------|
| Metadata | 24h | Track/artist info |
| Artwork | 7d | Album/artist images |
| Search | 5min | Search results |
| Streams | None | Always fresh (expires) |
| Audio Features | Persistent | BPM, key, energy |
| Lyrics | Persistent (IndexedDB) | Synced lyrics |

### Lazy Loading

- Components lazy-loaded with React.lazy()
- Images loaded on viewport entry
- Plugins loaded on first use
- Mobile server only loaded when enabled

### Streaming Optimizations

- Karaoke: First chunk in ~3-4 seconds (instant playback)
- Progressive chunk updates during processing
- Predictive prefetch for upcoming tracks
- Stream URL prefetching for queue

### Memory Management

- Track queue limited to session history (200 items)
- Image cache with LRU eviction
- Audio buffer management
- Lyrics prefetch with IndexedDB persistence

## Design Decisions

### Why Electron?

- Cross-platform desktop support
- Native file system access needed
- Audio playback requires native APIs
- Proven ecosystem for music apps
- Frameless window for Spotify-style UI

### Why Zustand over Redux?

- Simpler API, less boilerplate
- Built-in subscriptions
- Better TypeScript support
- Smaller bundle size
- 21 focused stores vs monolithic state

### Why SQLite?

- No server required
- Fast local queries
- Reliable and battle-tested
- Easy backup (single file)

### Why Static Room Model for P2P?

- Persistent room IDs (no code regeneration)
- Password protection option
- Better UX for frequent connections
- Device management with persistent tokens

### Why Dynamic Plugin Loading?

- No hardcoded plugin list
- Install from npm/git/local
- Plugin repository system
- Per-user customization
- Priority and settings per plugin

## Next Steps

- [Packages](packages.md) - Package structure
- [Stores](stores.md) - State management patterns
- [IPC Reference](ipc-reference.md) - IPC handler details
- [Mobile Server](mobile-server.md) - Mobile server internals
