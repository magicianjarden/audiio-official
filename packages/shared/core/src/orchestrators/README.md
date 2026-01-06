# Orchestrators

The orchestrators in `@audiio/core` coordinate complex operations across multiple providers and services. They act as the central coordination layer between the UI/server and the plugin-based addon system.

**Location:** `packages/shared/core/src/orchestrators/`

**Used by:** `packages/server/src/standalone-server.ts`

---

## SearchOrchestrator

**File:** `search-orchestrator.ts`

### Purpose
Coordinates unified search across metadata providers. Takes a search query and returns normalized `UnifiedTrack` results that are ready for playback resolution.

### Key Features
- Queries the primary metadata provider from the registry
- Converts provider-specific `MetadataTrack` results to normalized `UnifiedTrack` format
- Enhances tracks with artwork from secondary providers (e.g., Apple Music animated artwork)
- Graceful degradation when no providers are available

### Main Methods

| Method | Description |
|--------|-------------|
| `search(query, options?)` | Search for tracks, returns `SearchResult` with unified tracks, albums, and artists |
| `enhanceArtwork(tracks)` | (Private) Enhances tracks with artwork from providers that have `getArtworkSet()` |
| `toUnifiedTrack(track, providerId)` | (Private) Converts a `MetadataTrack` to `UnifiedTrack` format |

### Usage Flow
```
User Search → SearchOrchestrator.search()
                    ↓
            Registry.getPrimaryMetadataProvider()
                    ↓
            Provider.search() → MetadataTrack[]
                    ↓
            toUnifiedTrack() conversion
                    ↓
            enhanceArtwork() from secondary providers
                    ↓
            SearchResult with UnifiedTrack[]
```

---

## TrackResolver

**File:** `track-resolver.ts`

### Purpose
Resolves playable stream URLs for `UnifiedTrack` objects. Bridges the gap between metadata (what the track is) and streams (how to play it).

### Key Features
- Queries stream providers to find matching tracks
- Uses `TrackMatcher` service for fuzzy matching when exact IDs aren't available
- Supports metadata-based search (ISRC, title/artist/duration) or fallback text search
- Caches resolved stream sources on the track object
- Batch resolution with concurrency control for queue preparation

### Main Methods

| Method | Description |
|--------|-------------|
| `resolveStream(track, preferredQuality?)` | Resolve a single track to a playable `StreamInfo` |
| `resolveStreamsForTracks(tracks, preferredQuality?)` | Batch resolve multiple tracks with concurrency limit of 3 |

### Resolution Strategy
1. Check if track already has a cached stream source for the provider
2. Try `provider.searchByMetadata()` with ISRC/title/artist/duration
3. Fallback to text search with `TrackMatcher` fuzzy matching
4. Get stream URL via `provider.getStream(trackId, quality)`

### Usage Flow
```
UnifiedTrack (no stream) → TrackResolver.resolveStream()
                                  ↓
                          Registry.getStreamProviders()
                                  ↓
                          Provider.searchByMetadata() or search()
                                  ↓
                          TrackMatcher.findBestStreamMatch()
                                  ↓
                          Provider.getStream(trackId)
                                  ↓
                          UnifiedTrack with StreamInfo
```

---

## PlaybackOrchestrator

**File:** `playback-orchestrator.ts`

### Purpose
Manages playback state and queue operations. Extends `EventEmitter` to notify listeners of playback events.

### Key Features
- Maintains complete playback state (current track, queue, position, volume, repeat mode, shuffle)
- Handles local vs remote track differentiation (local tracks don't need stream re-resolution)
- Queue management (add, remove, reorder, clear)
- Repeat modes: none, one, all
- Emits events for all state changes

### Exported Types

**PlaybackState**
```typescript
{
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

**PlaybackEvents**
- `play` - Track started playing
- `pause` - Playback paused
- `resume` - Playback resumed
- `stop` - Playback stopped
- `seek` - Position changed
- `trackChange` - Current track changed
- `queueUpdate` - Queue modified
- `volumeChange` - Volume or mute state changed
- `error` - Playback error occurred

### Main Methods

| Method | Description |
|--------|-------------|
| `play(track)` | Play a specific track, resolves stream if needed |
| `pause()` | Pause playback |
| `resume()` | Resume playback |
| `stop()` | Stop playback and reset position |
| `seek(position)` | Seek to position in milliseconds |
| `next()` | Skip to next track (respects repeat mode) |
| `previous()` | Go to previous track (restarts if >3s played) |
| `setQueue(tracks, startIndex?)` | Replace the queue |
| `addToQueue(track)` | Add track to end of queue |
| `addNext(track)` | Insert track to play next |
| `removeFromQueue(trackId)` | Remove track from queue |
| `clearQueue()` | Clear entire queue |
| `setVolume(volume)` | Set volume (0-1) |
| `toggleMute()` | Toggle mute state |
| `setRepeatMode(mode)` | Set repeat mode |
| `toggleShuffle()` | Toggle shuffle mode |
| `getState()` | Get current playback state |
| `getCurrentTrack()` | Get currently playing track |
| `getQueue()` | Get current queue |

---

## MetadataOrchestrator

**File:** `metadata-orchestrator.ts`

### Purpose
Routes metadata requests to appropriate providers with automatic fallback logic. Handles fetching detailed information about artists, albums, and tracks.

### Key Features
- Provider selection by source ID or fallback to primary
- Automatic fallback to other providers on failure
- Support for extended provider capabilities (charts, similar content, artist radio)
- Graceful degradation when providers don't support certain features

### Exported Types

**ChartsResult**
```typescript
{
  tracks: MetadataTrack[];
  artists: Artist[];
  albums: Album[];
}
```

### Main Methods

| Method | Description |
|--------|-------------|
| `getArtist(id, source?)` | Get artist details with fallback |
| `getAlbum(id, source?)` | Get album details with tracks |
| `getTrack(id, source?)` | Get single track details |
| `getCharts(limit?)` | Get trending/chart content |
| `getSimilarTracks(trackId, source?, limit?)` | Get similar tracks (or fallback to artist search) |
| `getSimilarAlbums(albumId, source?, limit?)` | Get similar albums (or fallback to artist's discography) |
| `getArtistRadio(artistId, source?, limit?)` | Get tracks similar to artist's style |
| `getPrimaryProviderId()` | Get the ID of the primary metadata provider |

### Fallback Strategy
1. Try requested source provider (if specified)
2. Fallback to primary metadata provider
3. On error, iterate through all registered metadata providers
4. Return null/empty if all providers fail

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     standalone-server.ts                     │
├─────────────────────────────────────────────────────────────┤
│  SearchOrchestrator  │  TrackResolver  │  PlaybackOrchestrator  │  MetadataOrchestrator  │
├─────────────────────────────────────────────────────────────┤
│                        AddonRegistry                         │
├─────────────────────────────────────────────────────────────┤
│  MetadataProviders  │  StreamProviders  │  ArtworkProviders  │
└─────────────────────────────────────────────────────────────┘
```

The orchestrators depend on `AddonRegistry` to discover and access providers. They implement the business logic for coordinating between multiple providers while keeping individual providers simple and focused.
