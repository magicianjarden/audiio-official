# System Architecture

This document describes Audiio's architecture, data flow, and design decisions.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop App (Electron)                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │   Renderer (UI)  │  │   Main Process   │  │ Mobile Server │  │
│  │   React + Zustand│──│   Node.js APIs   │──│   Fastify     │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│           │                     │                    │          │
│           │                ┌────▼────┐               │          │
│           │                │ Addons  │               │          │
│           │                │ System  │               │          │
│           │                └────┬────┘               │          │
│           │                     │                    │          │
│  ┌────────▼─────────────────────▼────────────────────▼────────┐ │
│  │                     SQLite Database                         │ │
│  │              (Library, Playlists, Cache)                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ P2P via Relay
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mobile Web App (Browser)                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │   React UI       │──│   P2P Manager    │──│ Auth Manager  │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Desktop Application

#### Main Process

The Electron main process handles:

- Window management
- System tray integration
- Native file system access
- IPC message routing
- Addon loading and execution
- SQLite database operations
- Mobile server hosting

```typescript
// Main process responsibilities
main.ts
├── Window creation and lifecycle
├── Menu and tray setup
├── IPC handler registration
├── Addon system initialization
└── Mobile server startup
```

#### Renderer Process

The renderer runs the React UI:

```typescript
// Renderer structure
renderer/
├── App.tsx              # Root component
├── components/          # UI components
├── stores/              # Zustand state
├── hooks/               # Custom hooks
└── services/            # API clients
```

#### IPC Bridge

Communication between main and renderer:

```
┌─────────────┐                    ┌─────────────┐
│  Renderer   │                    │    Main     │
│             │                    │             │
│  ipcRenderer│◄──────────────────►│  ipcMain    │
│  .invoke()  │                    │  .handle()  │
└─────────────┘                    └─────────────┘
```

Key IPC channels:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `library:*` | Both | Library operations |
| `player:*` | Both | Playback control |
| `addon:*` | Both | Addon management |
| `search:*` | Renderer→Main | Search queries |
| `file:*` | Renderer→Main | File operations |

### Addon System

Addons extend Audiio's functionality:

```
┌─────────────────────────────────────────────────────┐
│                   Addon Registry                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Metadata   │ │   Stream    │ │   Lyrics    │   │
│  │  Providers  │ │  Providers  │ │  Providers  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│  ┌─────────────┐ ┌─────────────┐                   │
│  │   Audio     │ │  Scrobblers │                   │
│  │ Processors  │ │             │                   │
│  └─────────────┘ └─────────────┘                   │
└─────────────────────────────────────────────────────┘
```

#### Addon Roles

| Role | Interface | Purpose |
|------|-----------|---------|
| `metadata-provider` | `MetadataProvider` | Track/artist/album info |
| `stream-provider` | `StreamProvider` | Audio stream URLs |
| `lyrics-provider` | `LyricsProvider` | Synced lyrics |
| `audio-processor` | `AudioProcessor` | Audio processing |
| `scrobbler` | `Scrobbler` | Listening history |

#### Addon Loading

```typescript
// Addon loading flow
1. Scan addon directories
2. Load addon manifest (package.json)
3. Instantiate addon class
4. Register with AddonRegistry
5. Initialize addon
6. Addon ready for use
```

### State Management

Using Zustand for global state:

```
┌─────────────────────────────────────────────────────┐
│                   Zustand Stores                     │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Player  │ │  Library │ │  Search  │ │   UI   │ │
│  │  Store   │ │  Store   │ │  Store   │ │  Store │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Lyrics  │ │  Plugin  │ │  Reco    │            │
│  │  Store   │ │  Store   │ │  Store   │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────┘
```

#### Store Responsibilities

| Store | State |
|-------|-------|
| `player-store` | Current track, playback state, queue |
| `library-store` | Likes, playlists, downloads |
| `search-store` | Search results, history |
| `ui-store` | Theme, panels, modals |
| `lyrics-store` | Current lyrics, translations |
| `plugin-store` | Installed addons, settings |
| `recommendation-store` | ML recommendations |

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
│ Stream Provider │──── Get audio URL
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
│ Metadata        │──── Query providers
│ Providers       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Search Store   │──── Update results
└─────────────────┘
```

### Mobile Architecture

#### P2P Connection

```
┌─────────┐                          ┌─────────┐
│ Desktop │                          │ Mobile  │
│         │                          │         │
│  ┌───┐  │    ┌─────────────┐      │  ┌───┐  │
│  │P2P│◄─┼───►│ Relay Server│◄────►├──│P2P│  │
│  └───┘  │    └─────────────┘      │  └───┘  │
│         │                          │         │
└─────────┘                          └─────────┘

Connection Flow:
1. Desktop generates keypair
2. Desktop connects to relay
3. Desktop gets connection code
4. Mobile enters code
5. Mobile connects to relay
6. Relay bridges connections
7. E2E encrypted tunnel established
```

#### Mobile Server

When on the same network, direct HTTP is used:

```
┌─────────┐                    ┌─────────┐
│ Desktop │◄───── HTTP ───────►│ Mobile  │
│         │                    │         │
│ Fastify │    REST + WS      │  React  │
│  :9484  │                    │   App   │
└─────────┘                    └─────────┘
```

### Database Schema

SQLite database for local storage:

```sql
-- Core tables
tracks          -- Cached track metadata
artists         -- Artist information
albums          -- Album information

-- User data
likes           -- Liked tracks
dislikes        -- Disliked tracks
playlists       -- User playlists
playlist_tracks -- Playlist contents
downloads       -- Downloaded tracks

-- Playback
play_history    -- Listening history
queue           -- Current queue

-- Settings
settings        -- App settings
addon_settings  -- Per-addon settings
```

### ML/Recommendation System

```
┌─────────────────────────────────────────────────────┐
│              Recommendation Engine                   │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ Listening│───►│ Embedding│───►│  Similar │      │
│  │  History │    │  Model   │    │  Tracks  │      │
│  └──────────┘    └──────────┘    └──────────┘      │
│                                                      │
│  Inputs:              Processing:     Outputs:       │
│  - Play count         - Vector embed  - Quick picks  │
│  - Skip patterns      - KNN search    - Weekly mix   │
│  - Like/dislike       - Clustering    - Artist radio │
│  - Time of day                        - Because you  │
│                                         like...      │
└─────────────────────────────────────────────────────┘
```

## Security Architecture

### Mobile Access Security

```
┌─────────────────────────────────────────────────────┐
│                  Security Layers                     │
│                                                      │
│  1. Connection Code (knowledge factor)              │
│     └── Memorable 3-word code                       │
│                                                      │
│  2. Device Authorization                            │
│     └── Explicit approval per device                │
│                                                      │
│  3. E2E Encryption                                  │
│     └── NaCl X25519 + XSalsa20-Poly1305            │
│                                                      │
│  4. Session Tokens                                  │
│     └── Time-limited auth tokens                    │
│                                                      │
│  5. Access Control                                  │
│     └── Per-action permission checks                │
└─────────────────────────────────────────────────────┘
```

### Addon Sandboxing

Addons run with limited permissions:

- No file system access (except designated dirs)
- No network access (except approved domains)
- No access to other addons' data
- Rate-limited API calls

## Performance Considerations

### Caching Strategy

| Cache | TTL | Purpose |
|-------|-----|---------|
| Metadata | 24h | Track/artist info |
| Artwork | 7d | Album/artist images |
| Search | 5min | Search results |
| Streams | None | Always fresh |

### Lazy Loading

- Components lazy-loaded with React.lazy()
- Images loaded on viewport entry
- Addons loaded on first use

### Memory Management

- Track queue limited to 1000 items
- Image cache limited to 100MB
- Audio buffer limited to 30s

## Design Decisions

### Why Electron?

- Cross-platform desktop support
- Native file system access needed
- Audio playback requires native APIs
- Proven ecosystem for music apps

### Why Zustand over Redux?

- Simpler API, less boilerplate
- Built-in subscriptions
- Better TypeScript support
- Smaller bundle size

### Why SQLite?

- No server required
- Fast local queries
- Reliable and battle-tested
- Easy backup (single file)

### Why P2P for Mobile?

- No central server costs
- Better privacy (no data in cloud)
- Works on any network
- Relay only for signaling

## Next Steps

- [Packages](packages.md) - Package structure
- [Stores](stores.md) - State management patterns
- [IPC Reference](ipc-reference.md) - IPC handler details

