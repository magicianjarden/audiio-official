# @audiio/core - Core Types and Orchestrators

This package contains the core shared types, orchestrators, services, and utilities used throughout the Audiio music player application. It provides the foundation for the addon/plugin system and defines contracts for metadata providers, stream providers, lyrics providers, and more.

## Directory Structure

```
src/
├── index.ts                    # Main entry point - exports all public APIs
├── orchestrators/              # High-level coordination logic
│   ├── metadata-orchestrator.ts
│   ├── playback-orchestrator.ts
│   ├── search-orchestrator.ts
│   └── track-resolver.ts
├── registry/                   # Plugin/addon management
│   └── addon-registry.ts
├── services/                   # Core services
│   ├── audio-analyzer.ts
│   └── track-matcher.ts
├── types/                      # TypeScript type definitions
│   ├── index.ts
│   ├── addon.ts
│   ├── audio-features.ts
│   └── pipeline.ts
└── utils/                      # Shared utilities
    ├── event-emitter.ts
    └── id-generator.ts
```

---

## index.ts

**Purpose:** Main entry point that exports all public APIs from the package.

**Exports:**
- All domain types (`Artist`, `Album`, `UnifiedTrack`, `SearchResult`, etc.)
- Audio feature types (`AudioFeatures`, `BpmResult`, `KeyResult`, etc.)
- Pipeline types for plugin integrations
- Addon contract types (`MetadataProvider`, `StreamProvider`, `LyricsProvider`, etc.)
- Core classes (`AddonRegistry`, `SearchOrchestrator`, `TrackResolver`, `PlaybackOrchestrator`, `MetadataOrchestrator`)
- Services (`TrackMatcher`, `AudioAnalyzer`)
- Utilities (`EventEmitter`, `generateTrackId`)

**Usage:**
```typescript
import {
  UnifiedTrack,
  SearchOrchestrator,
  AddonRegistry,
  generateTrackId
} from '@audiio/core';
```

---

## Orchestrators

### metadata-orchestrator.ts

**Purpose:** Routes metadata requests to appropriate providers with automatic fallback logic.

**Key Features:**
- Provider selection by source ID or primary provider fallback
- Automatic fallback to other providers on failure
- Support for artists, albums, tracks, charts, similar content, and radio

**Main Class:** `MetadataOrchestrator`

**Key Methods:**
| Method | Description |
|--------|-------------|
| `getArtist(id, source?)` | Get artist details with fallback |
| `getAlbum(id, source?)` | Get album details with tracks |
| `getTrack(id, source?)` | Get track details |
| `getCharts(limit?)` | Get trending/charts content |
| `getSimilarTracks(trackId, source?, limit?)` | Get similar tracks |
| `getSimilarAlbums(albumId, source?, limit?)` | Get similar albums |
| `getArtistRadio(artistId, source?, limit?)` | Get artist radio tracks |
| `getPrimaryProviderId()` | Get the ID of the primary metadata provider |

**Usage:**
```typescript
const orchestrator = new MetadataOrchestrator(registry);
const artist = await orchestrator.getArtist('artist-id');
const charts = await orchestrator.getCharts(20);
```

---

### playback-orchestrator.ts

**Purpose:** Manages playback state, queue, and emits playback events.

**Key Features:**
- Full playback state management (play, pause, seek, next, previous)
- Queue management (add, remove, reorder, clear)
- Volume and mute control
- Repeat modes (none, one, all) and shuffle
- Event-driven architecture for UI updates

**Main Class:** `PlaybackOrchestrator` (extends `EventEmitter<PlaybackEvents>`)

**State Interface:**
```typescript
interface PlaybackState {
  currentTrack: UnifiedTrack | null;
  queue: UnifiedTrack[];
  queueIndex: number;
  position: number;       // Current position in ms
  duration: number;       // Total duration in ms
  isPlaying: boolean;
  volume: number;         // 0-1
  isMuted: boolean;
  repeatMode: 'none' | 'one' | 'all';
  isShuffled: boolean;
}
```

**Events:**
- `play` - Track started playing
- `pause` - Playback paused
- `resume` - Playback resumed
- `stop` - Playback stopped
- `seek` - Position changed
- `trackChange` - Track changed
- `queueUpdate` - Queue modified
- `volumeChange` - Volume or mute changed
- `error` - Playback error occurred

**Key Methods:**
| Method | Description |
|--------|-------------|
| `play(track)` | Play a specific track |
| `pause()` / `resume()` / `stop()` | Playback controls |
| `seek(position)` | Seek to position in ms |
| `next()` / `previous()` | Skip to next/previous track |
| `setQueue(tracks, startIndex?)` | Set the playback queue |
| `addToQueue(track)` | Add track to end of queue |
| `addNext(track)` | Add track to play next |
| `removeFromQueue(trackId)` | Remove track from queue |
| `setVolume(volume)` | Set volume (0-1) |
| `toggleMute()` | Toggle mute state |
| `setRepeatMode(mode)` | Set repeat mode |
| `getState()` | Get current playback state |

---

### search-orchestrator.ts

**Purpose:** Coordinates unified search across metadata providers with artwork enhancement.

**Key Features:**
- Search across primary metadata provider
- Automatic artwork enhancement from secondary providers (e.g., Apple Music animated artwork)
- Converts metadata tracks to unified tracks

**Main Class:** `SearchOrchestrator`

**Key Methods:**
| Method | Description |
|--------|-------------|
| `search(query, options?)` | Search for tracks, albums, artists |

**Usage:**
```typescript
const orchestrator = new SearchOrchestrator(registry);
const results = await orchestrator.search('artist name', { limit: 20 });
// results.tracks are UnifiedTrack[] ready for playback
```

---

### track-resolver.ts

**Purpose:** Resolves playable streams for unified tracks from available stream providers.

**Key Features:**
- Multi-provider stream resolution with fallback
- ISRC-based matching when available
- Fuzzy matching via TrackMatcher service
- Batch resolution with concurrency control

**Main Class:** `TrackResolver`

**Key Methods:**
| Method | Description |
|--------|-------------|
| `resolveStream(track, preferredQuality?)` | Resolve stream for a single track |
| `resolveStreamsForTracks(tracks, preferredQuality?)` | Batch resolve with concurrency |

**Resolution Strategy:**
1. Check existing stream sources on track
2. Try `searchByMetadata` if provider supports it (uses ISRC)
3. Fall back to query search + fuzzy matching
4. Return first successful stream resolution

---

## Registry

### addon-registry.ts

**Purpose:** Central registry for managing addon/plugin providers with role-based indexing.

**Key Features:**
- Role-based addon organization and lookup
- User-configurable addon priorities
- Enable/disable individual addons
- Type-safe addon retrieval by role

**Main Class:** `AddonRegistry`

**Supported Roles:**
- `metadata-provider` - Track/album/artist metadata
- `stream-provider` - Audio streaming
- `lyrics-provider` - Lyrics fetching
- `scrobbler` - Last.fm style scrobbling
- `audio-processor` - Audio effects/processing
- `tool` - Utilities and integrations
- `artist-enrichment` - Videos, concerts, setlists
- `metadata-enricher` - Auto-tagging from MusicBrainz, etc.
- `artwork-provider` - Cover art fetching
- `fingerprint-provider` - Audio fingerprinting
- `isrc-resolver` - ISRC lookups
- `analytics-provider` - Stream counts and charts
- `smart-playlist-rules` - Custom playlist rules
- `duplicate-detector` - Find duplicate tracks
- `import-provider` - Import from services
- `export-provider` - Export playlists/library
- `library-hook` - React to library events

**Key Methods:**
| Method | Description |
|--------|-------------|
| `register(addon)` | Register a new addon |
| `unregister(addonId)` | Remove an addon |
| `setEnabled(addonId, enabled)` | Enable/disable addon |
| `setAddonPriority(addonId, priority)` | Set user priority |
| `get<T>(addonId)` | Get addon by ID |
| `getByRole<T>(role)` | Get all addons with a role |
| `getPrimaryMetadataProvider()` | Get highest priority metadata provider |
| `getStreamProviders()` | Get all stream providers |
| `getLyricsProviders()` | Get all lyrics providers |
| `getScrobblers()` | Get all scrobblers |
| `getTools()` | Get all tools |
| `getAllAddonInfo()` | Get info for UI display |

---

## Services

### audio-analyzer.ts

**Purpose:** Extracts audio features (BPM, key, energy, etc.) from audio files using FFmpeg and DSP algorithms.

**Key Features:**
- BPM detection via onset detection + autocorrelation
- Key detection using chromagram + Krumhansl-Kessler profiles
- Energy, danceability, valence estimation
- Vocal/instrumental analysis via spectral flatness
- Result caching
- Works with local files and URLs

**Main Class:** `AudioAnalyzer` (Singleton)

**Audio Features Extracted:**
| Feature | Description | Range |
|---------|-------------|-------|
| `bpm` | Tempo in beats per minute | 60-200 |
| `key` | Musical key (C, C#, D, etc.) | - |
| `mode` | Major or minor | - |
| `energy` | Intensity and activity | 0-1 |
| `danceability` | Suitability for dancing | 0-1 |
| `acousticness` | Likelihood of being acoustic | 0-1 |
| `instrumentalness` | Likelihood of no vocals | 0-1 |
| `valence` | Musical positiveness | 0-1 |
| `loudness` | Average loudness in dB | -60 to 0 |
| `speechiness` | Presence of spoken words | 0-1 |
| `liveness` | Likelihood of live recording | 0-1 |

**Usage:**
```typescript
import { getAudioAnalyzer } from '@audiio/core';

const analyzer = getAudioAnalyzer();
const features = await analyzer.analyzeFile('/path/to/audio.mp3');
// features.bpm, features.key, features.energy, etc.
```

---

### track-matcher.ts

**Purpose:** Cross-provider track matching using ISRC and fuzzy string matching.

**Key Features:**
- ISRC exact match (highest confidence)
- Fuzzy matching on title + artist + duration
- Levenshtein distance-based similarity
- String normalization (diacritics, special chars)

**Main Class:** `TrackMatcher`

**Matching Weights:**
- Title: 50%
- Artist: 35%
- Duration: 15% (5 second tolerance)

**Key Methods:**
| Method | Description |
|--------|-------------|
| `findBestMatch(source, candidates)` | Find best matching candidate |
| `findBestStreamMatch(source, streamTracks)` | Match metadata track to stream tracks |
| `getLastMatchConfidence()` | Get confidence of last match (0-1) |

---

## Types

### index.ts (Domain Types)

**Purpose:** Core domain types used throughout the application.

**Key Types:**
| Type | Description |
|------|-------------|
| `Artist` | Artist with id, name, artwork, bio, genres, followers |
| `Album` | Album with id, title, artists, artwork, release date |
| `ArtworkSet` | Multi-resolution artwork (small, medium, large, animated) |
| `AnimatedArtwork` | Animated video artwork (Apple Music style) |
| `Quality` | Stream quality levels (`low`, `medium`, `high`, `lossless`) |
| `StreamInfo` | Resolved stream URL with format and bitrate |
| `StreamSource` | Available stream from a provider |
| `LyricsLine` | Single line of synced lyrics with timing |
| `LyricsResult` | Plain and/or synced lyrics with source |
| `ExternalIds` | External IDs (ISRC, Deezer, YouTube, etc.) |
| `UnifiedTrack` | The core track model combining all provider data |
| `SearchQuery` | Search parameters |
| `SearchResult` | Search results with tracks, albums, artists |

---

### addon.ts

**Purpose:** Addon system types and provider contracts.

**Provider Contracts:**
| Interface | Description |
|-----------|-------------|
| `MetadataProvider` | Search, get track/album/artist details |
| `StreamProvider` | Search and get playable streams |
| `LyricsProvider` | Fetch lyrics for tracks |
| `Scrobbler` | Record listens and now playing |
| `AudioProcessor` | Process audio (e.g., karaoke) |
| `Tool` | Utilities and integrations |
| `ArtistEnrichmentProvider` | Videos, concerts, setlists, gallery |
| `MetadataEnricher` | Auto-tag from MusicBrainz, etc. |
| `ArtworkProvider` | Fetch cover art |
| `FingerprintProvider` | Audio fingerprinting |
| `ISRCResolver` | ISRC lookups |
| `AnalyticsProvider` | Stream counts and charts |
| `SmartPlaylistRulesProvider` | Custom playlist rules |
| `DuplicateDetector` | Find duplicate tracks |
| `ImportProvider` | Import from services |
| `ExportProvider` | Export playlists/library |
| `LibraryHook` | React to library events |

**Base Types:**
| Type | Description |
|------|-------------|
| `AddonManifest` | Addon metadata (id, name, version, roles) |
| `BaseAddon` | Base interface all addons implement |
| `AddonRole` | Union of all addon role strings |
| `SettingsSchemaItem` | Schema for addon settings UI |

---

### audio-features.ts

**Purpose:** Types for audio analysis results.

**Key Types:**
| Type | Description |
|------|-------------|
| `MusicalKey` | Musical key (C, C#, D, ... B) |
| `MusicalMode` | Major or minor |
| `AudioFeatures` | Complete audio feature set |
| `AudioData` | Raw audio samples for analysis |
| `AnalysisOptions` | Options for audio analysis |
| `BpmResult` | BPM detection result with confidence |
| `KeyResult` | Key detection result with confidence |
| `Chromagram` | Pitch class profile |
| `AudioFeaturesCacheEntry` | Cached features with metadata |

---

### pipeline.ts

**Purpose:** Types for plugin pipeline integrations with Discover sections.

**Key Types:**
| Type | Description |
|------|-------------|
| `QueryStrategy` | How to fetch results (`embedding`, `search`, `hybrid`, `plugin`) |
| `EmbeddingMethod` | Embedding query type (mood, genre, seed, etc.) |
| `EmbeddingContext` | Context for embedding queries |
| `SearchContext` | Context for search queries |
| `StructuredSectionQuery` | Query definition for See All views |
| `PipelineContext` | Context passed to pipeline hooks |
| `ResultTransformer` | Hook to modify/filter/reorder results |
| `DataProvider` | Hook to contribute additional results |
| `QueryEnhancer` | Hook to modify query before execution |
| `PipelineResult` | Result with metadata about execution |
| `PluginPipelineAPI` | Interface for registering pipeline hooks |

---

## Utils

### event-emitter.ts

**Purpose:** Simple typed event emitter for reactive patterns.

**Main Class:** `EventEmitter<TEvents>`

**Key Methods:**
| Method | Description |
|--------|-------------|
| `on(event, handler)` | Subscribe to event, returns unsubscribe function |
| `once(event, handler)` | Subscribe for single emission |
| `off(event, handler)` | Unsubscribe from event |
| `emit(event, data)` | Emit event to all subscribers |
| `removeAllListeners(event?)` | Remove all listeners for event or all events |

**Usage:**
```typescript
interface MyEvents {
  update: { value: number };
  error: Error;
}

const emitter = new EventEmitter<MyEvents>();
const unsubscribe = emitter.on('update', (data) => console.log(data.value));
emitter.emit('update', { value: 42 });
unsubscribe();
```

---

### id-generator.ts

**Purpose:** Generate unique IDs for tracks.

**Function:** `generateTrackId(): string`

**Implementation:** UUID v4 generation using random values.

**Usage:**
```typescript
import { generateTrackId } from '@audiio/core';

const trackId = generateTrackId();
// e.g., "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Orchestrators                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Search    │  │  Playback   │  │     Metadata        │  │
│  │ Orchestrator│  │ Orchestrator│  │   Orchestrator      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                         │                                    │
│                  ┌──────┴──────┐                             │
│                  │   Track     │                             │
│                  │  Resolver   │                             │
│                  └─────────────┘                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AddonRegistry                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Metadata   │  Stream   │  Lyrics  │  Tools  │  ...  │   │
│  │  Providers  │ Providers │ Providers│         │       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Services                               │
│  ┌─────────────────┐       ┌─────────────────────────────┐  │
│  │  TrackMatcher   │       │      AudioAnalyzer          │  │
│  └─────────────────┘       └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```
