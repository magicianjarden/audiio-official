# Architecture

Audiio uses a server-client architecture where the server handles all business logic and clients provide the user interface.

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           AUDIIO SERVER                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        Fastify HTTP Server                      │ │
│  │                     (REST API + WebSocket)                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│         │              │              │              │               │
│         ▼              ▼              ▼              ▼               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  Search  │  │ Playback │  │ Metadata │  │      Auth        │    │
│  │Orchestr. │  │Orchestr. │  │Orchestr. │  │    Service       │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │
│         │              │              │                             │
│         └──────────────┴──────────────┘                             │
│                        │                                             │
│                        ▼                                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Addon Registry                              │ │
│  │              (Plugin Lifecycle Management)                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│         │              │              │              │               │
│         ▼              ▼              ▼              ▼               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Metadata │  │  Stream  │  │  Lyrics  │  │  Artist  │           │
│  │ Plugins  │  │ Plugins  │  │ Plugins  │  │ Enrichmt │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐│
│  │     ML Engine        │  │          Library Database            ││
│  │   (TensorFlow.js)    │  │            (SQLite)                  ││
│  │                      │  │                                      ││
│  │  • Recommendations   │  │  • Likes/Dislikes                    ││
│  │  • Radio generation  │  │  • Playlists                         ││
│  │  • User profiling    │  │  • Play history                      ││
│  │  • Smart queue       │  │  • Device tokens                     ││
│  └──────────────────────┘  └──────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
         │                            │                      │
         │ HTTP/WS                    │ HTTP/WS              │ HTTP/WS
         ▼                            ▼                      ▼
┌─────────────────┐          ┌─────────────────┐     ┌─────────────┐
│ Desktop Client  │          │  Mobile Client  │     │ Web Browser │
│   (Electron)    │          │    (React)      │     │   (API)     │
└─────────────────┘          └─────────────────┘     └─────────────┘
```

## Core Components

### Standalone Server (`standalone-server.ts`)

The main server class that:
- Initializes Fastify HTTP server
- Sets up 100+ REST API routes
- Manages WebSocket connections
- Orchestrates plugin loading
- Handles authentication
- Runs ML engine

### Orchestrators (`@audiio/core`)

Shared business logic components:

| Orchestrator | Purpose |
|--------------|---------|
| SearchOrchestrator | Aggregates search across plugins |
| PlaybackOrchestrator | Manages playback state |
| MetadataOrchestrator | Fetches and caches metadata |
| TrackResolver | Resolves track IDs to stream URLs |

### Addon Registry

Central plugin management:
- Loads plugins from disk
- Manages plugin lifecycle
- Routes requests to appropriate plugins
- Handles plugin priorities

### Services

| Service | Purpose |
|---------|---------|
| AuthService | Device pairing, session tokens |
| LibraryDB | SQLite persistence |
| MLService | Recommendations, radio |
| TrackingService | Play event recording |
| StatsService | Listening analytics |
| PluginLoader | Dynamic plugin loading |
| DiscoveryService | mDNS/Bonjour advertising |

## Data Flow

### Search Request

```
1. Client: GET /api/search?q=beatles
                │
2. Server: Route handler
                │
3. SearchOrchestrator.search("beatles")
                │
4. For each metadata plugin (by priority):
   └── plugin.search("beatles")
                │
5. Aggregate and dedupe results
                │
6. Return to client
```

### Stream Resolution

```
1. Client: GET /api/stream/resolve?trackId=xyz&source=deezer
                │
2. Server: Route handler
                │
3. TrackResolver.resolve("xyz", "deezer")
                │
4. Find stream plugin that canHandle(trackId, source)
                │
5. plugin.getStream("xyz")
                │
6. Return stream URL to client
                │
7. Client fetches audio directly from URL
```

### Authentication

```
1. Server generates pairing token
                │
2. Client scans QR / enters code
                │
3. Client sends: {pairingToken, deviceId, publicKey}
                │
4. AuthService validates token
                │
5. AuthService stores device + public key
                │
6. AuthService generates session JWT
                │
7. Client stores session token
                │
8. Client includes token in all requests
```

## Package Structure

```
packages/
├── server/                 # Headless server (@audiio/server)
│   ├── src/
│   │   ├── standalone-server.ts  # Main server class
│   │   ├── cli.ts               # CLI entry point
│   │   ├── config.ts            # Config loading
│   │   ├── services/            # Business logic
│   │   └── ml/                  # ML implementation
│   └── plugins/                 # Built-in plugins
│
├── clients/
│   └── desktop/            # Electron thin client (@audiio/client)
│       └── src/
│           ├── main.ts         # Electron main
│           ├── server-client.ts # HTTP/WS API client
│           ├── preload.ts      # IPC bridge
│           └── connect.html    # Connection/pairing UI
│
├── shared/
│   ├── core/               # Types + orchestrators (@audiio/core)
│   ├── sdk/                # Plugin SDK (@audiio/sdk)
│   ├── ui/                 # React components (@audiio/ui)
│   └── icons/              # Icon library (@audiio/icons)
│
└── infra/
    ├── relay/              # P2P tunneling (@audiio/relay)
    └── landing/            # Marketing site
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Server Framework | Fastify |
| Database | SQLite + better-sqlite3 |
| ML | TensorFlow.js |
| Authentication | TweetNaCl (ED25519) |
| Desktop Client | Electron |
| UI Framework | React 18 |
| State Management | Zustand |
| Build System | Turborepo |
| Package Manager | npm workspaces |

## Comparison: Old vs New

| Aspect | Old (Electron-first) | New (Server-first) |
|--------|---------------------|-------------------|
| Plugins | Run in Electron main process | Run on server |
| ML | Client-side TensorFlow | Server-side TensorFlow.js |
| Library | Per-device SQLite | Centralized server database |
| Multi-device | Not supported | Built-in via API |
| Deployment | App installer only | Docker/NAS/Cloud/standalone |
| Remote access | None | Relay server (E2E encrypted) |
| Desktop app | Full-featured, heavy | Thin client, lightweight |

## Scalability

The architecture supports:

- **Horizontal scaling**: Run multiple server instances behind load balancer
- **Database**: SQLite for single-node, swap to PostgreSQL for multi-node
- **Caching**: Redis can be added for session/cache storage
- **CDN**: Stream URLs can point to CDN for high traffic
