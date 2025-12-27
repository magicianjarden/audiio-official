# Audiio SDK

Build powerful addons that extend Audiio's capabilities. The SDK provides base classes and types for creating metadata providers, stream providers, lyrics providers, and audio processors.

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
    // Your implementation here
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

## Addon Types

### Metadata Provider

Provides track, artist, and album metadata from music databases.

```typescript
import { BaseMetadataProvider } from '@audiio/sdk';

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
}
```

### Stream Provider

Provides audio streams from music services.

```typescript
import { BaseStreamProvider, type Quality } from '@audiio/sdk';

class MyStreamProvider extends BaseStreamProvider {
  readonly id = 'my-stream';
  readonly name = 'My Stream';
  readonly requiresAuth = true;
  readonly supportedQualities: Quality[] = ['high', 'medium', 'low'];

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
}
```

### Lyrics Provider

Provides lyrics (synced and/or plain text).

```typescript
import { BaseLyricsProvider } from '@audiio/sdk';

class MyLyricsProvider extends BaseLyricsProvider {
  readonly id = 'my-lyrics';
  readonly name = 'My Lyrics';
  readonly supportsSynced = true;

  async getLyrics(query: LyricsQuery) {
    // Use built-in parseLrc() for LRC format
    return {
      synced: this.parseLrc(lrcString),
      plain: plainText,
      source: this.id
    };
  }
}
```

### Audio Processor

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
      instrumental: 'url-to-instrumental'
    };
  }

  async hasCached(trackId: string) { /* ... */ }
  async getCached(trackId: string) { /* ... */ }
  async clearCache(trackId: string) { /* ... */ }
}
```

## Helper Methods

All base classes provide useful helper methods:

### BaseStreamProvider

- `selectQuality(available, preferred)` - Choose best available quality
- `calculateMatchScore(candidate, target)` - Score track matches (0-1)
- `normalize(str)` - Normalize strings for comparison

### BaseLyricsProvider

- `parseLrc(lrc)` - Parse LRC format to synced lyrics array
- `syncedToPlain(synced)` - Convert synced lyrics to plain text

### BaseMetadataProvider

- `normalizeQuery(query)` - Normalize search queries

## Addon Manifest

Every addon needs a manifest defining its capabilities:

```typescript
interface AddonManifest {
  id: string;           // Unique ID (lowercase, alphanumeric, dashes only)
  name: string;         // Display name
  version: string;      // Semver version
  roles: AddonRole[];   // ['metadata-provider', 'stream-provider', etc.]
  description?: string;
  author?: string;
  homepage?: string;
}
```

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

// Stream info
interface StreamInfo {
  url: string;
  quality: Quality;
  format: string;
  expiresAt?: number;
}
```

## Examples

See the `addons/` directory for complete examples:

- `lrclib-lyrics` - Simple lyrics provider
- `deezer-metadata` - Full metadata provider with artist details
- `youtube-music` - Stream provider example
- `karaoke` - Audio processor for vocal removal

## Publishing

Addons can be:

1. **Bundled** - Included in the Audiio distribution
2. **Sideloaded** - Loaded from a local directory
3. **Published** - Shared via npm or the Audiio addon registry

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
      "roles": ["metadata-provider"]
    }
  }
}
```
