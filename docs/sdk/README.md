# Audiio SDK

Build powerful addons that extend Audiio's capabilities. The SDK provides base classes and types for creating all 7 addon roles: metadata providers, stream providers, lyrics providers, audio processors, scrobblers, tools, and artist enrichment providers.

## Installation

```bash
npm install @audiio/sdk
```

## Quick Start

```typescript
import { BaseLyricsProvider, type LyricsQuery, type LyricsResult } from '@audiio/sdk';

class MyLyricsProvider extends BaseLyricsProvider {
  readonly id = 'my-lyrics';
  readonly name = 'My Lyrics Provider';
  readonly supportsSynced = true;

  async getLyrics(query: LyricsQuery): Promise<LyricsResult | null> {
    const response = await fetch(`https://api.example.com/lyrics?q=${query.title}`);
    const data = await response.json();

    return {
      synced: this.parseLrc(data.lrc), // Built-in LRC parser!
      plain: data.text,
      source: this.id
    };
  }
}

export default MyLyricsProvider;
```

## Addon Roles

Audiio supports **7 addon roles**. Each addon can implement one or more roles.

| Role | Interface | Base Class | Purpose |
|------|-----------|------------|---------|
| `metadata-provider` | `MetadataProvider` | `BaseMetadataProvider` | Track/artist/album metadata |
| `stream-provider` | `StreamProvider` | `BaseStreamProvider` | Audio stream URLs |
| `lyrics-provider` | `LyricsProvider` | `BaseLyricsProvider` | Synced and plain lyrics |
| `audio-processor` | `AudioProcessor` | `BaseAudioProcessor` | Audio processing (karaoke, stems) |
| `scrobbler` | `Scrobbler` | - | Listening history tracking |
| `tool` | `Tool` | `BaseTool` | Data transfer, cloud mounts, utilities |
| `artist-enrichment` | `ArtistEnrichmentProvider` | `BaseArtistEnrichmentProvider` | Videos, concerts, setlists, gallery |

---

## Metadata Provider

Provides track, artist, and album metadata from music databases.

```typescript
import { BaseMetadataProvider, type MetadataSearchOptions } from '@audiio/sdk';

class MyMetadataProvider extends BaseMetadataProvider {
  readonly id = 'my-metadata';
  readonly name = 'My Metadata';
  readonly priority = 50; // Higher = preferred

  async search(query: string, options?: MetadataSearchOptions) {
    return { tracks: [], artists: [], albums: [] };
  }

  async getTrack(id: string) { /* ... */ }
  async getArtist(id: string) { /* ... */ }
  async getAlbum(id: string) { /* ... */ }
  async getArtistAlbums(artistId: string) { /* ... */ }
  async getAlbumTracks(albumId: string) { /* ... */ }
}
```

### Helper Methods

- `normalizeQuery(query)` - Normalize search queries for comparison

---

## Stream Provider

Provides audio streams from music services.

```typescript
import { BaseStreamProvider, type Quality } from '@audiio/sdk';

class MyStreamProvider extends BaseStreamProvider {
  readonly id = 'my-stream';
  readonly name = 'My Stream';
  readonly requiresAuth = true;
  readonly supportedQualities: Quality[] = ['lossless', 'high', 'medium', 'low'];

  async search(query: string) { /* ... */ }

  async getStream(trackId: string, quality?: Quality) {
    return {
      url: 'https://...',
      quality: quality || 'high',
      format: 'mp3',
      expiresAt: Date.now() + 3600000
    };
  }

  isAuthenticated() { return true; }
  async authenticate(credentials: unknown) { /* ... */ }
}
```

### Helper Methods

- `selectQuality(available, preferred)` - Choose best available quality
- `calculateMatchScore(candidate, target)` - Score track matches (0-1)
- `normalize(str)` - Normalize strings for comparison

---

## Lyrics Provider

Provides lyrics (synced and/or plain text).

```typescript
import { BaseLyricsProvider, type LyricsQuery } from '@audiio/sdk';

class MyLyricsProvider extends BaseLyricsProvider {
  readonly id = 'my-lyrics';
  readonly name = 'My Lyrics';
  readonly supportsSynced = true;

  async getLyrics(query: LyricsQuery) {
    const lrcString = await this.fetchLrc(query);

    return {
      synced: this.parseLrc(lrcString), // Built-in LRC parser
      plain: this.syncedToPlain(synced), // Convert synced to plain
      source: this.id
    };
  }
}
```

### Helper Methods

- `parseLrc(lrc)` - Parse LRC format to synced lyrics array
- `syncedToPlain(synced)` - Convert synced lyrics to plain text

---

## Audio Processor

Processes audio (e.g., stem separation, karaoke mode).

```typescript
import { BaseAudioProcessor } from '@audiio/sdk';

class MyAudioProcessor extends BaseAudioProcessor {
  readonly id = 'my-processor';
  readonly name = 'My Processor';

  async isAvailable() { return true; }

  async processTrack(trackId: string, audioUrl: string) {
    // Process audio and return stems or modified audio
    return {
      vocals: 'url-to-vocals',
      instrumental: 'url-to-instrumental',
      drums: 'url-to-drums',
      bass: 'url-to-bass',
      other: 'url-to-other'
    };
  }

  async hasCached(trackId: string) { /* ... */ }
  async getCached(trackId: string) { /* ... */ }
  async clearCache(trackId: string) { /* ... */ }
}
```

---

## Scrobbler

Tracks listening history to external services.

```typescript
import { type Scrobbler, type Track } from '@audiio/sdk';

class MyScrobbler implements Scrobbler {
  readonly id = 'my-scrobbler';
  readonly name = 'My Scrobbler';
  readonly priority = 50;

  async scrobble(track: Track, timestamp: number) {
    await fetch('https://api.example.com/scrobble', {
      method: 'POST',
      body: JSON.stringify({ track, timestamp })
    });
  }

  async updateNowPlaying(track: Track) { /* ... */ }
  isAuthenticated() { return true; }
  async authenticate(credentials: unknown) { /* ... */ }
}
```

---

## Tool

Provides utilities like data transfer, cloud mounts, and integrations.

```typescript
import { BaseTool, type ToolType } from '@audiio/sdk';

class MyTool extends BaseTool {
  readonly id = 'my-tool';
  readonly name = 'My Tool';
  readonly toolType: ToolType = 'data-transfer';
  readonly description = 'Import data from external service';

  async execute(params: unknown) {
    // Tool logic
    return { success: true, imported: 100 };
  }

  // Optional: Register UI components
  getUIComponents() {
    return {
      settingsPanel: MySettingsComponent
    };
  }
}
```

### Tool Types

| Type | Purpose | Example |
|------|---------|---------|
| `data-transfer` | Import/export data | Spotify import, backup/restore |
| `cloud-mount` | Connect cloud storage | Google Drive, Dropbox |
| `integration` | Third-party services | Discord presence, smart home |
| `utility` | Stats, analytics, converters | Library stats, file converter |

---

## Artist Enrichment Provider

Provides supplementary artist data: videos, concerts, setlists, and gallery images.

```typescript
import { BaseArtistEnrichmentProvider, type ArtistEnrichmentType } from '@audiio/sdk';

class MyEnrichmentProvider extends BaseArtistEnrichmentProvider {
  readonly id = 'my-enrichment';
  readonly name = 'My Enrichment';
  readonly priority = 50;

  // Declare which enrichment types this provider supports
  readonly supportedTypes: ArtistEnrichmentType[] = [
    'videos',
    'concerts',
    'setlists',
    'gallery'
  ];

  async getArtistVideos(artistName: string, limit?: number) {
    return [
      {
        id: 'video-1',
        title: 'Official Music Video',
        thumbnail: 'https://...',
        duration: 240,
        source: 'youtube'
      }
    ];
  }

  async getUpcomingConcerts(artistName: string) {
    return [
      {
        id: 'concert-1',
        venue: 'Madison Square Garden',
        city: 'New York',
        date: '2024-06-15',
        ticketUrl: 'https://...'
      }
    ];
  }

  async getArtistSetlists(artistName: string, mbid?: string, limit?: number) {
    return [
      {
        id: 'setlist-1',
        venue: 'Wembley Stadium',
        date: '2024-01-20',
        tracks: ['Song 1', 'Song 2', 'Song 3']
      }
    ];
  }

  async getArtistGallery(mbid: string, artistName?: string) {
    return {
      backgrounds: ['https://...'],
      thumbnails: ['https://...'],
      logos: ['https://...'],
      banners: ['https://...']
    };
  }

  // Optional methods
  async getAlbumVideos(albumTitle: string, artistName: string) { /* ... */ }
  async getArtistTimeline(artistName: string) { /* ... */ }
  async getMerchandiseUrl(artistName: string) { /* ... */ }
  async getVideoStream(videoId: string, quality?: string) { /* ... */ }
}
```

### Enrichment Types

| Type | Data Returned |
|------|---------------|
| `videos` | Music videos from external sources |
| `timeline` | Artist discography history |
| `setlists` | Past concert setlists |
| `concerts` | Upcoming concerts/events |
| `gallery` | Artist images (backgrounds, thumbs, logos, banners) |
| `merchandise` | Merchandise URLs |

---

## Addon Manifest

Every addon needs a manifest defining its capabilities:

```typescript
interface AddonManifest {
  id: string;           // Unique ID (lowercase, alphanumeric, dashes only)
  name: string;         // Display name
  version: string;      // Semver version
  roles: AddonRole[];   // Array of supported roles
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  settings?: SettingDefinition[];
}

type AddonRole =
  | 'metadata-provider'
  | 'stream-provider'
  | 'lyrics-provider'
  | 'scrobbler'
  | 'audio-processor'
  | 'tool'
  | 'artist-enrichment';
```

---

## Type Reference

### Core Types

```typescript
// Track quality levels
type Quality = 'lossless' | 'high' | 'medium' | 'low';

// Artwork at different sizes
interface ArtworkSet {
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
}

// Artist info
interface Artist {
  id: string;
  name: string;
  artwork?: ArtworkSet;
  genres?: string[];
  followers?: number;
}

// Album info
interface Album {
  id: string;
  title: string;
  artwork?: ArtworkSet;
  artists?: Artist[];
  releaseDate?: string;
  trackCount?: number;
}

// Synced lyrics line
interface LyricsLine {
  time: number;  // Milliseconds
  text: string;
}

// Lyrics result
interface LyricsResult {
  synced?: LyricsLine[];
  plain?: string;
  source: string;
}

// Stream info
interface StreamInfo {
  url: string;
  quality: Quality;
  format: string;
  expiresAt?: number;
}

// Audio features
interface AudioFeatures {
  bpm?: number;
  key?: MusicalKey;
  mode?: MusicalMode;
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  instrumentalness?: number;
  speechiness?: number;
  liveness?: number;
}
```

### Lyrics Query

```typescript
interface LyricsQuery {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
}
```

### Search Options

```typescript
interface MetadataSearchOptions {
  type?: 'track' | 'artist' | 'album' | 'all';
  limit?: number;
  offset?: number;
}
```

---

## Plugin Registration

Use `defineAddon()` to register your addon:

```typescript
import { defineAddon } from '@audiio/sdk';
import MyMetadataProvider from './providers/metadata';
import MyLyricsProvider from './providers/lyrics';

export default defineAddon({
  manifest: {
    id: 'my-addon',
    name: 'My Addon',
    version: '1.0.0',
    roles: ['metadata-provider', 'lyrics-provider'],
    description: 'My awesome addon',
    author: 'Your Name'
  },
  providers: {
    metadata: new MyMetadataProvider(),
    lyrics: new MyLyricsProvider()
  }
});
```

---

## Package.json Configuration

```json
{
  "name": "audiio-addon-my-feature",
  "version": "1.0.0",
  "main": "dist/index.js",
  "audiio": {
    "type": "addon",
    "manifest": {
      "id": "my-feature",
      "name": "My Feature",
      "roles": ["metadata-provider", "lyrics-provider"]
    }
  },
  "peerDependencies": {
    "@audiio/sdk": "^1.0.0",
    "@audiio/core": "^1.0.0"
  }
}
```

---

## Examples

See the `addons/` directory for complete examples:

| Addon | Roles | Description |
|-------|-------|-------------|
| `lrclib-lyrics` | lyrics-provider | Simple lyrics provider using LRCLib API |
| `deezer-metadata` | metadata-provider | Full metadata provider with artist details |
| `youtube-music` | stream-provider | Stream provider with authentication |
| `karaoke` | audio-processor | Vocal removal with instant playback |
| `sposify` | tool | Spotify data import tool |
| `fanart-enrichment` | artist-enrichment | Artist images from Fanart.tv |

---

## Publishing

Addons can be distributed in multiple ways:

### 1. Bundled (Built-in)

Include in the Audiio distribution under `addons/`:

```
addons/my-addon/
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 2. Sideloaded (Local)

Load from a local directory via Settings > Addons > Load Local.

### 3. npm Package

Publish to npm with the `audiio-addon-` prefix:

```bash
npm publish audiio-addon-my-feature
```

### 4. Git Repository

Install directly from git:

```
https://github.com/user/audiio-addon-my-feature
```

---

## Addon Registry

The `AddonRegistry` in `@audiio/core` manages all registered addons:

```typescript
import { AddonRegistry } from '@audiio/core';

const registry = new AddonRegistry();

// Get providers by role
const metadataProviders = registry.getMetadataProviders(); // Sorted by priority
const streamProviders = registry.getStreamProviders();
const lyricsProviders = registry.getLyricsProviders();
const scrobblers = registry.getScrobblers();
const tools = registry.getTools();

// Get artist enrichment providers
const enrichmentProviders = registry.getArtistEnrichmentProviders();
const videoProviders = registry.getArtistEnrichmentProvidersByType('videos');
const availableTypes = registry.getAvailableEnrichmentTypes();
```

---

## Best Practices

1. **Use meaningful IDs**: Use lowercase, alphanumeric with dashes (e.g., `my-lyrics-provider`)
2. **Set appropriate priorities**: Higher priority providers are tried first (default: 50)
3. **Handle errors gracefully**: Return `null` on failure rather than throwing
4. **Cache when appropriate**: Implement caching for expensive operations
5. **Respect rate limits**: Add delays between API calls if needed
6. **Document settings**: Provide clear descriptions for addon settings

---

## Next Steps

- [Addon Development](../development/addons/README.md) - Detailed addon guide
- [Plugin Development](../development/plugins/README.md) - Plugin system internals
- [API Reference](../api/README.md) - REST API documentation
- [Architecture](../development/architecture.md) - System design
