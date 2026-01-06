# Core Types

This directory contains the foundational TypeScript type definitions for Audiio. These types are re-exported from `@audiio/core` and `@audiio/sdk` for use across the entire application.

## File Overview

| File | Purpose |
|------|---------|
| `index.ts` | Core domain models (Artist, Album, Track, etc.) |
| `addon.ts` | Plugin/addon system contracts and provider interfaces |
| `audio-features.ts` | Audio analysis types (BPM, key, energy, etc.) |
| `pipeline.ts` | Discover page plugin pipeline types |

---

## index.ts - Core Domain Types

The fundamental data models used throughout Audiio.

### Primary Types

| Type | Description |
|------|-------------|
| `Artist` | Artist information with name, artwork, bio, genres, social links |
| `Album` | Album metadata with title, artists, artwork, release date |
| `UnifiedTrack` | **The central track model** - all addons contribute to this unified representation |
| `ArtworkSet` | Multi-resolution artwork URLs (small, medium, large, original, animated) |
| `AnimatedArtwork` | Video artwork metadata (Apple Music style loops) |

### Streaming Types

| Type | Description |
|------|-------------|
| `Quality` | Stream quality levels: `'low' \| 'medium' \| 'high' \| 'lossless'` |
| `StreamInfo` | Resolved stream URL with format and bitrate |
| `StreamSource` | Available stream from a provider with supported qualities |

### Content Types

| Type | Description |
|------|-------------|
| `LyricsLine` | Single synced lyrics line with timestamp |
| `LyricsResult` | Complete lyrics (plain text and/or synced) |
| `ExternalIds` | Cross-platform IDs (ISRC, Spotify, Deezer, YouTube, MusicBrainz) |

### Search Types

| Type | Description |
|------|-------------|
| `SearchQuery` | Search request with query, type filter, pagination |
| `SearchResult` | Search response with tracks, albums, artists |

### Usage Example

```typescript
import type { UnifiedTrack, Artist, Album } from '@audiio/core';

function displayTrack(track: UnifiedTrack) {
  console.log(`${track.title} by ${track.artists[0].name}`);
  console.log(`Duration: ${track.duration}s`);
  console.log(`Artwork: ${track.artwork?.medium}`);
}
```

---

## addon.ts - Addon System Types

Defines contracts for the plugin/addon system. Plugins implement these interfaces to provide functionality.

### Provider Roles

```typescript
type AddonRole =
  | 'metadata-provider'    // Search and track metadata (Deezer, Spotify)
  | 'stream-provider'      // Audio streaming (YouTube Music)
  | 'lyrics-provider'      // Lyrics fetching (LRCLIB, Genius)
  | 'scrobbler'           // Listen tracking (Last.fm, ListenBrainz)
  | 'audio-processor'     // Audio processing (vocal removal)
  | 'tool'                // Utilities (import/export)
  | 'artist-enrichment'   // Artist extras (videos, concerts, gallery)
  // Library management roles...
```

### Core Provider Interfaces

| Interface | Role | Key Methods |
|-----------|------|-------------|
| `MetadataProvider` | `metadata-provider` | `search()`, `getTrack()`, `getArtist()`, `getAlbum()` |
| `StreamProvider` | `stream-provider` | `search()`, `getStream()`, `searchByMetadata()` |
| `LyricsProvider` | `lyrics-provider` | `getLyrics()` |
| `Scrobbler` | `scrobbler` | `scrobble()`, `updateNowPlaying()` |
| `AudioProcessor` | `audio-processor` | `processTrack()`, `hasCached()` |
| `Tool` | `tool` | `execute()`, `registerUI()` |
| `ArtistEnrichmentProvider` | `artist-enrichment` | `getArtistVideos()`, `getUpcomingConcerts()`, etc. |

### Extended Detail Types

| Type | Description |
|------|-------------|
| `ArtistDetail` | Extended artist with discography, top tracks, similar artists |
| `AlbumDetail` | Extended album with full track list, credits, related albums |
| `AlbumCredits` | Production credits (producers, writers, engineers, label) |
| `TrendingContent` | Trending tracks, artists, albums for discovery |
| `Playlist` | Playlist metadata |

### Artist Enrichment Types

| Type | Description |
|------|-------------|
| `MusicVideo` | Video metadata with thumbnail, view count, duration |
| `VideoStreamInfo` | Video stream URL with quality and format |
| `TimelineEntry` | Discography timeline entry (album, single, EP) |
| `Concert` | Upcoming concert with venue, lineup, tickets |
| `Setlist` | Past concert setlist with songs performed |
| `ArtistImages` | Gallery images (backgrounds, logos, banners) |

### Library Management Interfaces

| Interface | Role | Purpose |
|-----------|------|---------|
| `MetadataEnricher` | `metadata-enricher` | Auto-tag from MusicBrainz, Discogs |
| `ArtworkProvider` | `artwork-provider` | Fetch cover art |
| `FingerprintProvider` | `fingerprint-provider` | Audio fingerprinting (AcoustID) |
| `ISRCResolver` | `isrc-resolver` | ISRC to metadata lookup |
| `AnalyticsProvider` | `analytics-provider` | Stream counts, chart positions |
| `SmartPlaylistRulesProvider` | `smart-playlist-rules` | Custom playlist rule types |
| `DuplicateDetector` | `duplicate-detector` | Find duplicate tracks |
| `ImportProvider` | `import-provider` | Import from Spotify, M3U, etc. |
| `ExportProvider` | `export-provider` | Export to M3U, JSON, etc. |
| `LibraryHook` | `library-hook` | React to library events |

### Settings Schema

| Type | Description |
|------|-------------|
| `SettingsSchemaItem` | Setting field definition for plugin config UI |
| `SettingsFieldType` | Field types: `'string' \| 'number' \| 'boolean' \| 'select' \| ...` |
| `AddonManifest` | Plugin manifest with ID, name, version, roles, settings |
| `BaseAddon` | Base interface all addons implement |

### Usage Example

```typescript
import { BaseMetadataProvider } from '@audiio/sdk';
import type { MetadataTrack, MetadataSearchResult } from '@audiio/core';

class MyProvider extends BaseMetadataProvider {
  readonly id = 'my-provider';
  readonly name = 'My Provider';
  readonly priority = 50;

  async search(query: string): Promise<MetadataSearchResult> {
    // Implementation
  }
}
```

---

## audio-features.ts - Audio Analysis Types

Types for audio feature extraction and analysis (BPM, key, energy, etc.).

### Core Types

| Type | Description |
|------|-------------|
| `AudioFeatures` | Complete audio analysis results |
| `MusicalKey` | Musical keys: `'C' \| 'C#' \| 'D' \| ... \| 'B'` |
| `MusicalMode` | `'major' \| 'minor'` |

### AudioFeatures Properties

```typescript
interface AudioFeatures {
  bpm?: number;              // Tempo (60-200 typical)
  bpmConfidence?: number;    // Detection confidence (0-1)
  key?: MusicalKey;          // Musical key
  mode?: MusicalMode;        // Major or minor
  keyConfidence?: number;    // Key detection confidence
  energy?: number;           // Intensity (0-1)
  danceability?: number;     // Dance suitability (0-1)
  acousticness?: number;     // Acoustic likelihood (0-1)
  instrumentalness?: number; // No vocals likelihood (0-1)
  valence?: number;          // Happiness/positivity (0-1)
  loudness?: number;         // Volume in dB (-60 to 0)
  speechiness?: number;      // Spoken word presence (0-1)
  liveness?: number;         // Live recording likelihood (0-1)
  timeSignature?: number;    // Beats per bar (3-7)
  source?: 'local' | 'spotify' | 'lastfm' | 'plugin';
}
```

### Analysis Types

| Type | Description |
|------|-------------|
| `AudioData` | Raw audio samples for analysis |
| `AnalysisOptions` | Configuration for analysis (what to analyze, duration) |
| `BpmResult` | BPM detection result with confidence and alternatives |
| `KeyResult` | Key detection result with confidence and correlation |
| `Chromagram` | Pitch class profile (12 values for C through B) |
| `AudioFeaturesCacheEntry` | Cached features with track ID and timestamp |

### Usage Example

```typescript
import type { AudioFeatures, BpmResult } from '@audiio/core';

function formatFeatures(features: AudioFeatures): string {
  const key = features.key ? `${features.key} ${features.mode}` : 'Unknown';
  return `${features.bpm} BPM, Key: ${key}, Energy: ${features.energy}`;
}
```

---

## pipeline.ts - Plugin Pipeline Types

Types for the Discover page plugin pipeline, allowing plugins to enhance search results.

### Query Types

| Type | Description |
|------|-------------|
| `QueryStrategy` | `'embedding' \| 'search' \| 'hybrid' \| 'plugin'` |
| `EmbeddingMethod` | `'mood' \| 'genre' \| 'seed' \| 'personalized' \| ...` |
| `EmbeddingContext` | Parameters for embedding-based queries |
| `SearchContext` | Parameters for search-based queries |
| `StructuredSectionQuery` | Complete query for a Discover section |

### User Profile Types

> **Note:** These are the canonical API types. Different implementations exist:
> - `MLUserProfile` in `ml-service.ts` - Server-side ML profile
> - `RecommendationProfile` in `recommendation-store.ts` - Client-side UI profile

| Type | Description |
|------|-------------|
| `UserProfile` | User listening preferences for pipeline context |
| `ArtistPreference` | Per-artist play/skip/like counts |
| `GenrePreference` | Per-genre preferences with weight |

### Pipeline Hook Interfaces

| Interface | Purpose | Key Method |
|-----------|---------|------------|
| `ResultTransformer` | Modify/filter/reorder results | `transform()` |
| `DataProvider` | Contribute additional results | `provide()` |
| `QueryEnhancer` | Modify query before execution | `enhance()` |

### Pipeline Context & Results

| Type | Description |
|------|-------------|
| `PipelineContext` | Context passed to all hooks (query, profile, results, time) |
| `PipelineResult` | Execution result with applied hooks and timing |
| `PipelineConfig` | Timeout and error handling configuration |
| `PluginPipelineAPI` | Registration API for plugin hooks |

### Usage Example

```typescript
import type { ResultTransformer, PipelineContext } from '@audiio/core';

const diversityTransformer: ResultTransformer = {
  id: 'my-plugin:diversity',
  pluginId: 'my-plugin',
  priority: 50,
  name: 'Artist Diversity',
  description: 'Ensures variety in artist selection',
  enabledByDefault: true,

  canTransform: () => true,

  async transform(results, context) {
    // Limit same artist to max 2 consecutive tracks
    return enforceArtistDiversity(results, 2);
  }
};
```

---

## Import Patterns

### From Application Code

```typescript
// Import from @audiio/core
import type {
  UnifiedTrack,
  Artist,
  Album,
  AudioFeatures,
  MetadataProvider,
} from '@audiio/core';
```

### From Plugin Code

```typescript
// Import from @audiio/sdk (re-exports core types + base classes)
import {
  BaseMetadataProvider,
  BaseStreamProvider,
  type MetadataTrack,
  type StreamInfo,
} from '@audiio/sdk';
```

---

## Type Naming Conventions

| Pattern | Meaning | Example |
|---------|---------|---------|
| `*Provider` | Plugin interface contract | `MetadataProvider`, `StreamProvider` |
| `*Result` | Return type from operation | `SearchResult`, `LyricsResult` |
| `*Options` | Configuration parameters | `AnalysisOptions`, `MetadataSearchOptions` |
| `*Context` | Contextual data passed to functions | `PipelineContext`, `EmbeddingContext` |
| `*Detail` | Extended version of base type | `ArtistDetail`, `AlbumDetail` |
| `Base*` | Abstract base class (SDK) | `BaseMetadataProvider` |
