# Provider Types

Plugins implement one or more provider roles. Each role has specific methods to implement.

## Metadata Provider

Provides search and track metadata.

```typescript
import {
  BaseMetadataProvider,
  MetadataSearchResult,
  MetadataSearchOptions,
  MetadataTrack,
  Artist,
  Album
} from '@audiio/sdk';

export default class MyMetadataProvider extends BaseMetadataProvider {
  readonly id = 'my-metadata';
  readonly name = 'My Metadata Provider';

  // Required: Search for content
  async search(query: string, options?: MetadataSearchOptions): Promise<MetadataSearchResult> {
    return {
      tracks: [],
      artists: [],
      albums: []
    };
  }

  // Required: Get track by ID
  async getTrack(id: string): Promise<MetadataTrack | null> {
    return null;
  }

  // Required: Get artist by ID
  async getArtist(id: string): Promise<Artist | null> {
    return null;
  }

  // Required: Get album by ID with tracks
  async getAlbum(id: string): Promise<(Album & { tracks: MetadataTrack[] }) | null> {
    return null;
  }
}
```

Package.json:
```json
{
  "audiio": {
    "type": "plugin",
    "id": "my-metadata",
    "roles": ["metadata-provider"]
  }
}
```

## Stream Provider

Provides playable audio stream URLs.

```typescript
import { BaseStreamProvider, StreamInfo, UnifiedTrack } from '@audiio/sdk';

export default class MyStreamProvider extends BaseStreamProvider {
  readonly id = 'my-stream';
  readonly name = 'My Stream Provider';

  // Required: Check if this provider can handle the track
  canResolve(track: UnifiedTrack): boolean {
    return track._meta?.metadataProvider === this.id;
  }

  // Required: Get stream URL for track
  async resolve(track: UnifiedTrack): Promise<StreamInfo | null> {
    return {
      url: 'https://example.com/stream/123',
      format: 'mp3',
      bitrate: 320,
      expiresAt: Date.now() + 3600000
    };
  }
}
```

Package.json:
```json
{
  "audiio": {
    "type": "plugin",
    "id": "my-stream",
    "roles": ["stream-provider"]
  }
}
```

## Lyrics Provider

Provides song lyrics with optional timestamps.

```typescript
import { BaseLyricsProvider, LyricsResult, LyricsQuery } from '@audiio/sdk';

export default class MyLyricsProvider extends BaseLyricsProvider {
  readonly id = 'my-lyrics';
  readonly name = 'My Lyrics Provider';

  // Required: Get lyrics for a track
  async getLyrics(query: LyricsQuery): Promise<LyricsResult | null> {
    return {
      plainLyrics: 'Song lyrics here...',
      syncedLyrics: '[00:00.00] First line\n[00:05.00] Second line',
      source: this.id
    };
  }
}
```

Package.json:
```json
{
  "audiio": {
    "type": "plugin",
    "id": "my-lyrics",
    "roles": ["lyrics-provider"]
  }
}
```

## Scrobbler

Tracks listening activity to external services.

```typescript
import { Scrobbler, ScrobblePayload, NowPlayingPayload, AddonManifest } from '@audiio/sdk';

export default class MyScrobbler implements Scrobbler {
  readonly id = 'my-scrobbler';
  readonly name = 'My Scrobbler';

  get manifest(): AddonManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      roles: ['scrobbler']
    };
  }

  async initialize(): Promise<void> {
    // Set up API client with credentials
  }

  async dispose(): Promise<void> {}

  // Required: Update now playing
  async updateNowPlaying(payload: NowPlayingPayload): Promise<void> {
    // Send now playing to service
  }

  // Required: Submit scrobble
  async scrobble(payload: ScrobblePayload): Promise<void> {
    // Send scrobble to service
  }
}
```

## Audio Processor

Processes audio streams.

```typescript
import { BaseAudioProcessor, AudioProcessorResult } from '@audiio/sdk';

export default class MyAudioProcessor extends BaseAudioProcessor {
  readonly id = 'my-processor';
  readonly name = 'My Audio Processor';

  // Required: Process audio URL
  async process(inputUrl: string): Promise<AudioProcessorResult> {
    return {
      url: inputUrl, // Return processed URL
      format: 'mp3'
    };
  }
}
```

## Artist Enrichment Provider

Provides additional artist information.

```typescript
import {
  BaseArtistEnrichmentProvider,
  ArtistImages,
  MusicVideo,
  TimelineEntry,
  Concert,
  Setlist
} from '@audiio/sdk';

export default class MyEnrichmentProvider extends BaseArtistEnrichmentProvider {
  readonly id = 'my-enrichment';
  readonly name = 'My Enrichment Provider';

  // Declare which enrichment types this provider supports
  readonly supportedTypes = ['images', 'videos'] as const;

  async getImages(artistName: string): Promise<ArtistImages | null> {
    return {
      backgrounds: ['https://...'],
      thumbnails: ['https://...'],
      logos: ['https://...']
    };
  }

  async getVideos(artistName: string): Promise<MusicVideo[] | null> {
    return [{
      id: '...',
      title: 'Music Video',
      thumbnail: 'https://...',
      url: 'https://...'
    }];
  }

  // Optional methods based on supportedTypes
  async getTimeline(artistName: string): Promise<TimelineEntry[] | null> {
    return null;
  }

  async getConcerts(artistName: string): Promise<Concert[] | null> {
    return null;
  }

  async getSetlists(artistName: string): Promise<Setlist[] | null> {
    return null;
  }
}
```

## Tool

Utility functions and commands.

```typescript
import { BaseTool, ToolType } from '@audiio/sdk';

export default class MyTool extends BaseTool {
  readonly id = 'my-tool';
  readonly name = 'My Tool';
  readonly toolType: ToolType = 'utility';

  async execute(command: string, args: Record<string, unknown>): Promise<unknown> {
    switch (command) {
      case 'backup':
        return this.backup(args.path as string);
      case 'export':
        return this.export(args.format as string);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private async backup(path: string) {
    return { success: true, message: 'Backup complete' };
  }

  private async export(format: string) {
    return { success: true, data: {} };
  }
}
```

## Multiple Roles

A plugin can implement multiple roles:

```typescript
import {
  BaseMetadataProvider,
  BaseStreamProvider,
  MetadataSearchResult,
  StreamInfo,
  UnifiedTrack
} from '@audiio/sdk';

// Combine capabilities using class composition or multiple exports
export class MyMultiRolePlugin extends BaseMetadataProvider {
  readonly id = 'multi-role';
  readonly name = 'Multi-Role Plugin';

  // Metadata methods
  async search(query: string) { /* ... */ }
  async getTrack(id: string) { /* ... */ }
  async getArtist(id: string) { /* ... */ }
  async getAlbum(id: string) { /* ... */ }

  // Stream methods (implement StreamProvider interface)
  canResolve(track: UnifiedTrack) {
    return track._meta?.metadataProvider === this.id;
  }

  async resolve(track: UnifiedTrack): Promise<StreamInfo | null> {
    // ...
  }
}
```

Package.json:
```json
{
  "audiio": {
    "type": "plugin",
    "id": "multi-role",
    "roles": ["metadata-provider", "stream-provider"]
  }
}
```
