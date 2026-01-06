# Base Classes

This directory contains abstract base classes that plugin authors extend when creating Audiio addons. Each base class implements a core interface from `@audiio/core` and provides:

- Default manifest generation
- Lifecycle hooks (`initialize`, `dispose`)
- Helper methods for common operations

## Available Base Classes

| Class | Role | Purpose |
|-------|------|---------|
| `BaseMetadataProvider` | `metadata-provider` | Fetch track, album, and artist metadata |
| `BaseStreamProvider` | `stream-provider` | Provide audio streams for playback |
| `BaseLyricsProvider` | `lyrics-provider` | Fetch synced or plain lyrics |
| `BaseAudioProcessor` | `audio-processor` | Process audio (karaoke, stems, etc.) |
| `BaseTool` | `tool` | Utilities, integrations, data transfer |
| `BaseArtistEnrichmentProvider` | `artist-enrichment` | Supplementary artist data (videos, concerts) |

---

## BaseMetadataProvider

Provides track, album, and artist metadata from external sources.

**File:** `BaseMetadataProvider.ts`

### Abstract Properties
```typescript
readonly id: string;      // Unique provider identifier
readonly name: string;    // Display name
```

### Abstract Methods
```typescript
search(query: string, options?: MetadataSearchOptions): Promise<MetadataSearchResult>;
getTrack(id: string): Promise<MetadataTrack | null>;
getArtist(id: string): Promise<Artist | null>;
getAlbum(id: string): Promise<(Album & { tracks: MetadataTrack[] }) | null>;
```

### Helper Methods
- `normalizeQuery(query)` - Lowercase, normalize unicode, trim whitespace

### Usage Example
```typescript
import { BaseMetadataProvider } from '@audiio/sdk';

class MyMetadataProvider extends BaseMetadataProvider {
  readonly id = 'my-metadata';
  readonly name = 'My Metadata Service';

  async search(query, options) {
    const normalized = this.normalizeQuery(query);
    // Fetch from API...
  }

  async getTrack(id) { /* ... */ }
  async getArtist(id) { /* ... */ }
  async getAlbum(id) { /* ... */ }
}
```

---

## BaseStreamProvider

Provides audio streams for track playback from streaming services.

**File:** `BaseStreamProvider.ts`

### Abstract Properties
```typescript
readonly id: string;
readonly name: string;
readonly requiresAuth: boolean;
readonly supportedQualities: Quality[];  // 'lossless' | 'high' | 'medium' | 'low'
```

### Abstract Methods
```typescript
search(query: string, options?: StreamSearchOptions): Promise<StreamTrack[]>;
getStream(trackId: string, quality?: Quality): Promise<StreamInfo>;
isAuthenticated(): boolean;
```

### Optional Methods
```typescript
searchByMetadata?(metadata: {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  isrc?: string;
}): Promise<StreamTrack | null>;
```

### Helper Methods
- `selectQuality(available, preferred)` - Select best available quality
- `calculateMatchScore(candidate, target)` - Score track match (0-1)
- `normalize(str)` - Normalize string for comparison

### Usage Example
```typescript
import { BaseStreamProvider, Quality } from '@audiio/sdk';

class MyStreamProvider extends BaseStreamProvider {
  readonly id = 'my-stream';
  readonly name = 'My Streaming Service';
  readonly requiresAuth = true;
  readonly supportedQualities: Quality[] = ['high', 'medium', 'low'];

  async search(query, options) { /* ... */ }

  async getStream(trackId, quality) {
    const selectedQuality = this.selectQuality(this.supportedQualities, quality);
    // Fetch stream URL...
  }

  isAuthenticated() { return !!this.token; }
}
```

---

## BaseLyricsProvider

Provides lyrics (synced or plain text) for tracks.

**File:** `BaseLyricsProvider.ts`

### Abstract Properties
```typescript
readonly id: string;
readonly name: string;
readonly supportsSynced: boolean;  // Whether provider returns timed lyrics
```

### Abstract Methods
```typescript
getLyrics(query: LyricsQuery, options?: LyricsSearchOptions): Promise<LyricsResult | null>;
```

### Helper Methods
- `parseLrc(lrc)` - Parse LRC format to `LyricsLine[]` array
- `syncedToPlain(synced)` - Convert synced lyrics to plain text

### Usage Example
```typescript
import { BaseLyricsProvider, LyricsQuery, LyricsResult } from '@audiio/sdk';

class MyLyricsProvider extends BaseLyricsProvider {
  readonly id = 'my-lyrics';
  readonly name = 'My Lyrics Service';
  readonly supportsSynced = true;

  async getLyrics(query: LyricsQuery): Promise<LyricsResult | null> {
    const lrcText = await this.fetchLrc(query.title, query.artist);
    if (!lrcText) return null;

    const synced = this.parseLrc(lrcText);
    return {
      synced,
      plain: this.syncedToPlain(synced),
      source: this.id
    };
  }
}
```

---

## BaseAudioProcessor

Processes audio tracks (karaoke mode, stem separation, effects).

**File:** `BaseAudioProcessor.ts`

### Abstract Properties
```typescript
readonly id: string;
readonly name: string;
```

### Abstract Methods
```typescript
isAvailable(): Promise<boolean>;
processTrack(trackId: string, audioUrl: string): Promise<AudioProcessorResult>;
hasCached(trackId: string): Promise<boolean>;
getCached(trackId: string): Promise<AudioProcessorResult | null>;
clearCache(trackId: string): Promise<void>;
```

### Usage Example
```typescript
import { BaseAudioProcessor, AudioProcessorResult } from '@audiio/sdk';

class KaraokeProcessor extends BaseAudioProcessor {
  readonly id = 'karaoke';
  readonly name = 'Karaoke Mode';

  async isAvailable() {
    return this.checkModelLoaded();
  }

  async processTrack(trackId, audioUrl) {
    // Separate vocals from instrumental...
    return {
      instrumentalUrl: 'blob:...',
      vocalsUrl: 'blob:...'
    };
  }

  async hasCached(trackId) { /* ... */ }
  async getCached(trackId) { /* ... */ }
  async clearCache(trackId) { /* ... */ }
}
```

---

## BaseTool

General-purpose tools for utilities, integrations, and data transfer.

**File:** `BaseTool.ts`

### Abstract Properties
```typescript
readonly id: string;
readonly name: string;
readonly toolType: ToolType;  // 'transfer' | 'cloud' | 'integration' | 'utility'
readonly icon?: string;       // Optional icon identifier
```

### Optional Methods
```typescript
registerUI?(registry: PluginUIRegistry): void;
registerHandlers?(ipcMain: unknown, app: unknown): void;
unregisterHandlers?(): void;
execute?(): Promise<void>;
isAvailable(): Promise<boolean>;
```

### Helper Methods
- `log(message, ...args)` - Log with `[Tool:id]` prefix
- `logError(message, ...args)` - Error log with prefix

### Usage Example
```typescript
import { BaseTool, PluginUIRegistry } from '@audiio/sdk';

class SpotifyImportTool extends BaseTool {
  readonly id = 'spotify-import';
  readonly name = 'Spotify Import';
  readonly toolType = 'transfer';
  readonly icon = 'spotify';

  registerUI(registry: PluginUIRegistry) {
    registry.addSidebarItem({
      id: 'spotify-import',
      label: 'Import from Spotify',
      icon: 'spotify',
      onClick: () => this.showImportDialog()
    });
  }

  async execute() {
    this.log('Starting import...');
    // Import logic...
  }
}
```

---

## BaseArtistEnrichmentProvider

Provides supplementary artist data: videos, concerts, setlists, images.

**File:** `BaseArtistEnrichmentProvider.ts`

### Abstract Properties
```typescript
readonly id: string;
readonly name: string;
readonly enrichmentType: ArtistEnrichmentType;
// 'videos' | 'concerts' | 'setlists' | 'timeline' | 'gallery' | 'merchandise'
```

### Optional Methods (implement based on enrichmentType)
```typescript
getArtistVideos?(artistName: string, limit?: number): Promise<MusicVideo[]>;
getAlbumVideos?(albumTitle: string, artistName: string, trackNames?: string[], limit?: number): Promise<MusicVideo[]>;
getArtistTimeline?(artistName: string): Promise<TimelineEntry[]>;
getArtistSetlists?(artistName: string, mbid?: string, limit?: number): Promise<Setlist[]>;
getUpcomingConcerts?(artistName: string): Promise<Concert[]>;
getArtistGallery?(mbid: string, artistName?: string): Promise<ArtistImages>;
getMerchandiseUrl?(artistName: string): Promise<string | null>;
searchArtist?(artistName: string): Promise<{ id: string; name: string } | null>;
getVideoStream?(videoId: string, preferredQuality?: string): Promise<VideoStreamInfo | null>;
```

### Usage Example
```typescript
import { BaseArtistEnrichmentProvider, MusicVideo } from '@audiio/sdk';

class YouTubeVideosProvider extends BaseArtistEnrichmentProvider {
  readonly id = 'youtube-videos';
  readonly name = 'YouTube Music Videos';
  readonly enrichmentType = 'videos';

  async getArtistVideos(artistName: string, limit = 10): Promise<MusicVideo[]> {
    const results = await this.searchYouTube(`${artistName} official music video`, limit);
    return results.map(this.toMusicVideo);
  }

  async getVideoStream(videoId: string, quality = '720p') {
    return {
      url: await this.getStreamUrl(videoId, quality),
      quality,
      format: 'mp4'
    };
  }
}
```

---

## Lifecycle Hooks

All base classes provide lifecycle hooks that can be overridden:

```typescript
class MyProvider extends BaseMetadataProvider {
  async initialize() {
    // Called when plugin is loaded
    await this.loadConfig();
    await this.authenticate();
  }

  async dispose() {
    // Called when plugin is unloaded
    await this.saveState();
    this.cleanup();
  }
}
```

---

## Where Base Classes Are Used

| Base Class | Used By |
|------------|---------|
| `BaseMetadataProvider` | Deezer, MusicBrainz, Discogs plugins |
| `BaseStreamProvider` | YouTube Music, SoundCloud, local file providers |
| `BaseLyricsProvider` | LRCLIB, Genius, Musixmatch plugins |
| `BaseAudioProcessor` | Karaoke mode, stem separation plugins |
| `BaseTool` | Spotify import, Last.fm scrobbler, cloud sync |
| `BaseArtistEnrichmentProvider` | YouTube videos, Setlist.fm, Bandsintown |

---

## Creating a New Plugin

1. Import the appropriate base class from `@audiio/sdk`
2. Extend the base class and implement required abstract methods
3. Override `initialize()` and `dispose()` if needed
4. Export using `defineAddon()` for registration

```typescript
import { BaseMetadataProvider, defineAddon } from '@audiio/sdk';

class MyProvider extends BaseMetadataProvider {
  // Implementation...
}

export default defineAddon({
  id: 'my-provider',
  name: 'My Provider',
  version: '1.0.0',
  providers: [new MyProvider()]
});
```
