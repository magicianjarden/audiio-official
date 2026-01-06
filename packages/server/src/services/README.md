# Services

This directory contains the core service layer for the Audiio server. These services handle data persistence, authentication, plugin management, machine learning, tracking/analytics, and media management.

## Table of Contents

- [Overview](#overview)
- [Structure](#structure)
- [Core Services](#core-services)
  - [Database Services](#database-services)
  - [Authentication Services](#authentication-services)
  - [Plugin Services](#plugin-services)
  - [Media Services](#media-services)
  - [ML Services](#ml-services)
  - [Tracking & Analytics Services](#tracking--analytics-services)
  - [Infrastructure Services](#infrastructure-services)
- [Shared Types](#shared-types)
- [Dependencies](#dependencies)
- [Usage Patterns](#usage-patterns)

## Overview

The services layer provides the backend functionality for the Audiio music streaming application. Services are designed with:

- **Modularity**: Each service handles a specific domain
- **Event-driven architecture**: Services emit events for cross-service communication
- **SQLite persistence**: Using `better-sqlite3` for database operations
- **Plugin extensibility**: Services integrate with the addon registry for plugin features
- **Type safety**: Full TypeScript with exported interfaces

## Structure

```
services/
├── library-db.ts           # SQLite database for library data
├── library-service.ts      # Library orchestration with plugin support
├── audio-feature-index.ts  # Audio feature querying and mood clustering
├── search-service.ts       # Natural language search with filters
├── auth-service.ts         # Device trust and authentication
├── auth-middleware.ts      # Fastify authentication middleware
├── plugin-loader.ts        # Dynamic plugin discovery and loading
├── plugin-installer.ts     # Plugin installation from npm/git/local
├── plugin-sandbox.ts       # Sandboxed plugin execution environment
├── plugin-router.ts        # Plugin HTTP route registration
├── plugin-repository.ts    # Plugin registry management
├── path-authorization.ts   # Plugin filesystem access control
├── ml-service.ts           # ML orchestration and recommendations
├── tracking-service.ts     # User event collection and analytics
├── stats-service.ts        # Statistics computation and caching
├── media-folders.ts        # Media folder management
├── local-scanner.ts        # Media file scanning and metadata extraction
├── folder-watcher.ts       # File system change monitoring
├── download-service.ts     # Media downloading with progress tracking
├── discovery-service.ts    # mDNS/Bonjour network discovery
├── mdns-adapter.ts         # mDNS backend abstraction
├── log-service.ts          # Structured logging with memory buffer
├── signal-path.ts          # Track playback debugging/tracing
└── shared-types.ts         # Shared type definitions
```

## Core Services

### Database Services

#### `library-db.ts`

**Purpose**: SQLite-based persistent storage for all library data.

**Key Features**:
- Liked/disliked tracks management
- Playlists (regular and smart/rule-based)
- Play history and statistics
- Tags and collections
- Audio fingerprint caching
- Smart playlist rule evaluation

**Key Exports**:
- `LibraryDatabase` - Main database class
- Interfaces: `Track`, `Playlist`, `SmartPlaylist`, `PlaylistFolder`, `Tag`, `Collection`, `AudioFeatures`

**Tables**:
- `liked_tracks`, `disliked_tracks` - Track preferences
- `playlists`, `playlist_tracks` - Playlist management
- `play_history`, `track_play_stats` - Playback tracking
- `smart_playlists`, `playlist_folders` - Organization
- `tags`, `track_tags`, `entity_tags` - Tagging system
- `collections`, `collection_items` - Custom collections
- `audio_features` - Track audio analysis data
- `cached_fingerprints` - Audio fingerprint cache

---

#### `library-service.ts`

**Purpose**: Orchestrates library operations with plugin support for enrichment, artwork, fingerprinting, and import/export.

**Status**: NOT CURRENTLY INTEGRATED - Designed to wrap `LibraryDatabase`

**Key Features**:
- Event emission for library hooks (`track:liked`, `track:played`, etc.)
- Plugin orchestration for metadata enrichment
- Smart playlist evaluation with plugin rules
- Import/export through registered plugins
- Artwork and fingerprint provider integration

**Key Exports**:
- `LibraryService` - Service class extending EventEmitter
- Built-in smart playlist rule definitions

**Integration Notes**:
- Enables scrobbling (Last.fm, ListenBrainz) via events
- Supports plugin-based metadata auto-tagging
- Audio fingerprint identification (AcoustID)

---

#### `audio-feature-index.ts`

**Purpose**: SQL-based indexing and querying for audio features.

**Key Features**:
- Multi-dimensional feature queries (energy, tempo, valence, etc.)
- Similarity-based track finding with weighted Euclidean distance
- Feature distribution analysis (percentiles, standard deviation)
- Mood-based clustering (energetic, chill, melancholy, etc.)

**Key Exports**:
- `AudioFeatureIndex` - Index class
- Interfaces: `AudioFeatureData`, `FeatureDistribution`, `MoodCluster`, `FeatureQuery`

**Methods**:
- `query(criteria, limit, offset)` - Query tracks by feature ranges
- `findSimilar(trackId, limit)` - Find similar tracks
- `getMoodClusters()` - Get tracks grouped by mood
- `getTrackMood(trackId)` - Get dominant mood for a track
- `getFeatureDistribution(feature)` - Statistical distribution

---

#### `search-service.ts`

**Purpose**: Server-side search with natural language parsing.

**Key Features**:
- Natural language query parsing
- Audio feature filtering (energy, tempo, mood keywords)
- Tag and metadata filtering
- Play behavior filtering (never played, recently played, etc.)
- Search history management and suggestions

**Key Exports**:
- `SearchService` - Service class
- Interfaces: `ParsedQuery`, `ParsedFilter`, `SearchOptions`, `PlayBehavior`

**Query Examples**:
- `"chill music by Artist"` - Artist filter with mood
- `"energetic 120 bpm"` - Tempo and energy filter
- `"#workout"` - Tag filter
- `"from the 80s"` - Decade filter
- `"never played"` - Play behavior filter

---

### Authentication Services

#### `auth-service.ts`

**Purpose**: Implements the Device Trust Model for secure authentication.

**Key Features**:
- Server identity with persistent X25519 key pair
- QR code pairing for new devices
- Challenge-response authentication using NaCl
- Device management (list, revoke, rename)
- Session token management with 30-day expiry

**Key Exports**:
- `AuthService` - Service class
- `getAuthService()`, `initAuthService()` - Singleton accessors
- Interfaces: `ServerIdentity`, `TrustedDevice`, `PairingToken`, `SessionToken`

**Authentication Flow**:
1. Server generates pairing QR code with token
2. Device scans QR, sends public key
3. Server validates and creates session
4. Subsequent requests use session token or challenge-response

---

#### `auth-middleware.ts`

**Purpose**: Fastify middleware for protecting API routes.

**Key Features**:
- Session token validation via Authorization header
- Trusted device ID validation via X-Device-ID header
- Public route whitelist configuration
- Optional enforcement mode for development

**Key Exports**:
- `registerAuthMiddleware(fastify, options)` - Register middleware
- `requireAuth(fastify)` - Decorator for auth-required routes

---

### Plugin Services

#### `plugin-loader.ts`

**Purpose**: Dynamic discovery and loading of plugins from multiple sources.

**Key Features**:
- Loads bundled plugins from `packages/server/plugins/`
- Discovers npm-installed `@audiio/plugin-*` packages
- Loads user plugins from plugins directory
- Integrates with sandbox for secure execution
- Hooks into Node's module resolution for SDK access

**Key Exports**:
- `PluginLoader` - Loader class
- Interfaces: `PluginManifest`, `LoadedPlugin`, `PluginLoadResult`

**Plugin Sources**:
1. Bundled plugins (local directory)
2. npm packages (`@audiio/plugin-*`)
3. User-installed plugins (`.audiio-plugin` files)

---

#### `plugin-installer.ts`

**Purpose**: Handles plugin installation from npm, git, or local sources.

**Key Features**:
- Multiple source formats: `npm:`, `git:`, GitHub URLs, local paths
- Subdirectory support for monorepos (`repo.git#subdirectory`)
- HTTP download fallback when git unavailable
- Automatic dependency installation and building
- Update and uninstall operations

**Key Exports**:
- `pluginInstaller` - Singleton instance
- Interfaces: `InstallResult`, `InstallProgress`

**Installation Phases**:
- `downloading` - Fetching source
- `extracting` - Unpacking archive
- `installing` - npm install
- `building` - npm run build
- `complete` / `error` - Final state

---

#### `plugin-sandbox.ts`

**Purpose**: Secure execution environment for plugins with capability-based permissions.

**Key Features**:
- Sandboxed filesystem access with path whitelist
- Network access control with host whitelist
- API access control (library, player, settings, tracking)
- Resource limits (memory, CPU time, timeout)
- Plugin-specific data directories

**Key Exports**:
- `PluginSandbox` - Sandbox manager class
- `initPluginSandbox()`, `getPluginSandbox()` - Singleton accessors
- Interfaces: `SandboxConfig`, `SandboxedPluginInfo`, `PluginCapabilities`

**Security**:
- Forbidden system paths (Windows/Unix)
- Memory limit: max 512MB
- Timeout: max 5 minutes
- CPU time: max 30 seconds

---

#### `plugin-router.ts`

**Purpose**: Enables plugins to register custom HTTP routes.

**Key Features**:
- Routes prefixed with `/api/plugins/:pluginId/`
- Request/response wrapping for plugins
- Rate limiting support
- Schema validation support
- Route tracking per plugin

**Key Exports**:
- `PluginRouter` - Router class
- Helper functions: `get()`, `post()`, `put()`, `del()`, `patch()`
- Interfaces: `PluginRouteHandler`, `PluginRequest`, `PluginReply`

---

#### `plugin-repository.ts`

**Purpose**: Manages plugin repositories and fetches available plugins from registries.

**Key Features**:
- Add/remove plugin repositories by URL
- Fetches `registry.json` from repositories
- Plugin search across repositories
- Version update checking
- Persistent storage of repository configuration

**Key Exports**:
- `pluginRepositoryService` - Singleton instance
- Interfaces: `PluginRepository`, `RepositoryPlugin`, `RegistryJson`

**Note**: No repositories are built-in. Users choose which to add (100% user choice).

---

#### `path-authorization.ts`

**Purpose**: Manages authorized filesystem paths for plugins.

**Key Features**:
- Per-plugin path authorization
- Admin approval flow for plugin path requests
- Read/readwrite permission levels
- Path validation (exists, not system directory)
- SQLite persistence

**Key Exports**:
- `PathAuthorizationService` - Service class
- `initPathAuthService()`, `getPathAuthService()` - Singleton accessors
- Interfaces: `AuthorizedPath`, `PathAuthorizationRequest`

---

### Media Services

#### `media-folders.ts`

**Purpose**: Core service for managing user media folders.

**Key Features**:
- Three folder types: `audio`, `video`, `downloads`
- Dual-purpose folders (same path for multiple types)
- File system browsing with media type filtering
- Download tracking and management
- Scan progress tracking
- Forbidden system paths protection

**Key Exports**:
- `MediaFoldersService` - Service class extending EventEmitter
- Constants: `AUDIO_EXTENSIONS`, `VIDEO_EXTENSIONS`
- Interfaces: `MediaFolder`, `LocalTrack`, `ScanProgress`, `BrowseResult`

**Events**: `folder-added`, `folder-updated`, `folder-removed`, `scan-progress`, `scan-complete`

---

#### `local-scanner.ts`

**Purpose**: Scans media folders for audio/video files and extracts metadata.

**Key Features**:
- Uses `music-metadata` for audio files
- Uses `ffprobe` (via spawn) for video files
- Handles embedded artwork caching
- Progress reporting with abort support
- Skip of already-scanned files by modification time

**Key Exports**:
- `LocalScannerService` - Service class extending EventEmitter
- Interfaces: `ScanOptions`, `ScanResult`

**Supported Formats**: MP3, FLAC, M4A, AAC, WAV, OGG, OPUS, WMA, AIFF, APE, WV, MKV, MP4, AVI, MOV, WEBM, FLV

---

#### `folder-watcher.ts`

**Purpose**: Watches media folders for file changes using chokidar.

**Key Features**:
- Monitors add/change/unlink events
- 5-second debounce before triggering scans
- Automatic scan trigger on file changes
- Immediate delete handling (no scan needed)
- Supports symbolic links and deep directory watching

**Key Exports**:
- `FolderWatcherService` - Service class extending EventEmitter
- Interface: `WatcherEvent`

**Chokidar Configuration**:
- Ignores hidden files, `node_modules`, temp files
- `awaitWriteFinish` with 2-second stability threshold
- Max depth: 10 levels

---

#### `download-service.ts`

**Purpose**: Handles media downloading with progress tracking.

**Key Features**:
- Chunked Range requests for YouTube/Google CDN compatibility
- Queue management (max 3 concurrent downloads)
- ID3 tag embedding using `node-id3`
- Retry logic with exponential backoff
- Resume support for interrupted downloads

**Key Exports**:
- `DownloadService` - Service class extending EventEmitter
- Interfaces: `DownloadRequest`, `DownloadProgress`, `ActiveDownload`

**Configuration**:
- Chunk size: 1MB
- Timeout: 30 seconds per request
- Max retries: 3

---

### ML Services

#### `ml-service.ts`

**Purpose**: Comprehensive ML orchestration for recommendations, scoring, and training.

**Key Features**:
- Track scoring and recommendations
- Radio generation (artist, track, genre, mood)
- Embeddings and similarity search
- User profile and preferences
- Training triggered by tracking events
- Smart queue generation

**Key Exports**:
- `mlService` - Singleton instance
- Interfaces: `MLServiceConfig`, `MLUserProfile`, `RecommendationOptions`, `QueueContext`

**Training Thresholds**:
- Event count: 100 events triggers training
- Time threshold: 24 hours since last training

**Integration**:
- Connects with `TrackingService` for event-based training
- Provides data to SmartQueue for track selection

---

### Tracking & Analytics Services

#### `tracking-service.ts`

**Purpose**: Comprehensive event collection for analytics and ML training.

**Key Features**:
- 30+ event types (playback, library, discovery, navigation)
- Session management with summaries
- Track, artist, and daily statistics
- Active playback session tracking for admin view
- ML training data export

**Key Exports**:
- `TrackingService` - Service class extending EventEmitter
- Interfaces: `TrackingEvent`, `TrackingSession`, `ActivePlaybackSession`

**Event Categories**:
- Session: `session_start`, `session_end`
- Playback: `play_start`, `play_complete`, `skip`, `seek`, etc.
- Queue: `queue_add`, `queue_remove`, `queue_reorder`
- Library: `like`, `unlike`, `dislike`, `playlist_create`, etc.
- Discovery: `search`, `recommendation_click`, etc.

**Tables**:
- `tracking_events` - Raw events
- `tracking_sessions` - Session data
- `stats_daily` - Daily aggregates
- `track_stats` - Per-track statistics
- `artist_stats` - Per-artist statistics

---

#### `stats-service.ts`

**Purpose**: Statistics computation and caching for the stats page.

**Key Features**:
- Overview stats (total plays, listen time, unique tracks/artists)
- Listening patterns (hourly, daily, weekly)
- Top artists, tracks, genres, albums
- Listening streaks calculation
- 5-minute cache TTL for performance

**Key Exports**:
- `StatsService` - Service class
- Interfaces: `OverviewStats`, `ListeningStats`, `TopItem`, `ListeningPattern`, `Streak`

---

### Infrastructure Services

#### `discovery-service.ts`

**Purpose**: mDNS/Bonjour network discovery for local server advertising.

**Key Features**:
- Advertises Audiio server on local network
- Discovers other Audiio instances
- Service type: `_audiio._tcp`
- Server fingerprinting for identification

**Key Exports**:
- `DiscoveryService` - Service class
- `initDiscoveryService()`, `getDiscoveryService()` - Singleton accessors
- Interface: `DiscoveredServer`

---

#### `mdns-adapter.ts`

**Purpose**: Unified interface for mDNS operations across platforms.

**Key Features**:
- Primary backend: `bonjour-service`
- Stub fallback when no mDNS available
- Platform-agnostic API

**Key Exports**:
- `createMdnsService()` - Factory function
- Interfaces: `MdnsService`, `MdnsServiceInfo`

---

#### `log-service.ts`

**Purpose**: Structured logging with memory buffer and WebSocket emission.

**Key Features**:
- Circular buffer (max 1000 entries)
- Log levels: debug, info, warn, error
- Service-tagged entries
- WebSocket emission via EventEmitter
- Convenience helpers: `log.debug()`, `log.info()`, etc.

**Key Exports**:
- `logService` - Singleton instance
- `log` - Convenience helper object
- Interface: `LogEntry`

---

#### `signal-path.ts`

**Purpose**: Tracks the complete journey from track request to playback for debugging.

**Key Features**:
- Traces phases: request -> metadata -> ml -> resolve -> stream -> playback
- Step-by-step timing capture
- Success/failure tracking
- Statistics (success rate, average duration)
- Stores last 100 completed traces

**Key Exports**:
- `signalPathService` - Singleton instance
- `withTrace()` - Helper for automatic trace management
- Interfaces: `SignalPath`, `SignalPathStep`

---

## Shared Types

### `shared-types.ts`

**Purpose**: Canonical type definitions used across services.

**Key Exports**:
- `FeatureRange` - Audio feature range query (min/max)
- `AudioFeatureQuery` - Query criteria for audio features
- `MOOD_CRITERIA` - Mood-to-feature mappings
- `TEMPO_RANGES` - Tempo descriptors to BPM ranges
- `DECADE_RANGES` - Decade to year range mappings
- `getMoodClusters()` - Mood cluster definitions with descriptions

---

## Dependencies

### External

| Package | Purpose |
|---------|---------|
| `better-sqlite3` | SQLite database operations |
| `music-metadata` | Audio file metadata extraction |
| `chokidar` | File system watching |
| `fastify` | HTTP server (auth middleware) |
| `tweetnacl` | Cryptographic operations |
| `nanoid` | ID generation |
| `node-id3` | ID3 tag reading/writing |
| `bonjour-service` | mDNS/Bonjour discovery |

### Internal

| Package | Purpose |
|---------|---------|
| `@audiio/core` | Core types and addon registry |
| `@audiio/sdk` | Plugin SDK types |
| `../ml` | ML engine and types |
| `../paths` | Application path configuration |

---

## Usage Patterns

### Service Initialization

Most services follow a singleton pattern with init/get accessors:

```typescript
import { initAuthService, getAuthService } from './services/auth-service';

// Initialize once at startup
const authService = initAuthService(dataDir, serverName);

// Get instance elsewhere
const auth = getAuthService();
```

### Event-Driven Communication

Services extend EventEmitter for cross-service communication:

```typescript
trackingService.on('event', (event) => {
  mlService.handleTrackingEvent(event);
});

mediaFolders.on('scan-complete', (result) => {
  // Update UI or trigger processing
});
```

### Database Transactions

Use `better-sqlite3`'s transaction API for atomic operations:

```typescript
const transaction = db.transaction(() => {
  // Multiple operations
  stmt1.run(...);
  stmt2.run(...);
});
transaction();
```

### Plugin Integration

Register plugins with the addon registry:

```typescript
const loader = new PluginLoader(registry);
await loader.loadAllPlugins();

// Plugins are now available via registry
const streamProviders = registry.getStreamProviders();
```
