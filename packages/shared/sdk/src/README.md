# @audiio/sdk

The official SDK for building Audiio plugins. This package provides base classes, type definitions, and utilities for creating plugins that extend Audiio's functionality.

## Overview

The Audiio SDK enables developers to create plugins for:
- **Metadata** - Fetch track, album, and artist information from external sources
- **Streaming** - Provide audio streams for playback
- **Lyrics** - Fetch synced or plain text lyrics
- **Audio Processing** - Process audio (karaoke mode, stem separation)
- **Tools** - General utilities, integrations, and data transfer
- **Artist Enrichment** - Supplementary artist data (videos, concerts, setlists)

## Directory Structure

```
src/
├── base/                              # Abstract base classes for plugin types
│   ├── BaseMetadataProvider.ts        # Metadata fetching
│   ├── BaseStreamProvider.ts          # Audio streaming
│   ├── BaseLyricsProvider.ts          # Lyrics fetching
│   ├── BaseAudioProcessor.ts          # Audio processing
│   ├── BaseTool.ts                    # General tools
│   ├── BaseArtistEnrichmentProvider.ts # Artist enrichment
│   └── README.md                      # Base class documentation
├── types/
│   ├── routes.ts                      # Custom HTTP route definitions
│   └── sandbox.ts                     # Sandboxed execution types
├── index.ts                           # Main exports and manifest types
└── registration.ts                    # Addon registration utilities
```

## Installation

```bash
npm install @audiio/sdk
# or
pnpm add @audiio/sdk
```

## Quick Start

### 1. Create a Plugin

```typescript
import { BaseMetadataProvider } from '@audiio/sdk';

export class MyMusicProvider extends BaseMetadataProvider {
  readonly id = 'my-music';
  readonly name = 'My Music Service';
  readonly priority = 80;

  async search(query, options) {
    // Implement search logic
  }

  async getTrack(id) {
    // Fetch track by ID
  }

  async getArtist(id) {
    // Fetch artist by ID
  }

  async getAlbum(id) {
    // Fetch album by ID
  }
}

export default MyMusicProvider;
```

### 2. Configure package.json

```json
{
  "name": "audiio-plugin-my-music",
  "version": "1.0.0",
  "main": "dist/index.js",
  "audiio": {
    "type": "plugin",
    "id": "my-music",
    "roles": ["metadata-provider"]
  },
  "peerDependencies": {
    "@audiio/sdk": "*"
  }
}
```

## Base Classes

### BaseMetadataProvider

Provides metadata from external music services (Deezer, Spotify, etc.).

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique provider identifier |
| `name` | `string` | Display name |
| `priority` | `number` | Resolution priority (higher = preferred) |

| Method | Description |
|--------|-------------|
| `search(query, options)` | Search for tracks, artists, albums |
| `getTrack(id)` | Fetch track by ID |
| `getArtist(id)` | Fetch artist by ID |
| `getAlbum(id)` | Fetch album by ID |
| `initialize()` | Setup hook (optional) |
| `dispose()` | Cleanup hook (optional) |

**Helper Methods:**
- `normalizeQuery(query)` - Normalize strings for consistent searching

**Example:**
```typescript
import { BaseMetadataProvider } from '@audiio/sdk';

export class DeezerProvider extends BaseMetadataProvider {
  readonly id = 'deezer';
  readonly name = 'Deezer';
  readonly priority = 80;

  async search(query, options) {
    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return this.normalizeResults(data);
  }

  async getTrack(id) {
    const response = await fetch(`https://api.deezer.com/track/${id}`);
    return this.normalizeTrack(await response.json());
  }

  async getArtist(id) { /* ... */ }
  async getAlbum(id) { /* ... */ }
}
```

---

### BaseStreamProvider

Provides audio streams for playback from sources like YouTube Music.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique provider identifier |
| `name` | `string` | Display name |
| `requiresAuth` | `boolean` | Whether authentication is required |
| `supportedQualities` | `string[]` | Available quality levels |

| Method | Description |
|--------|-------------|
| `search(query, options)` | Search for streamable tracks |
| `getStream(trackId, quality)` | Get stream URL for a track |
| `isAuthenticated()` | Check authentication status |
| `initialize()` | Setup hook (optional) |
| `dispose()` | Cleanup hook (optional) |

**Helper Methods:**
- `selectQuality(available, preferred)` - Pick best available quality
- `calculateMatchScore(candidate, target)` - Score track similarity (0-1)
- `normalize(str)` - Normalize string for comparison

**Example:**
```typescript
import { BaseStreamProvider, type StreamInfo } from '@audiio/sdk';

export class YouTubeMusicProvider extends BaseStreamProvider {
  readonly id = 'youtube-music';
  readonly name = 'YouTube Music';
  readonly requiresAuth = false;
  readonly supportedQualities = ['high', 'medium', 'low'];

  async search(query, options) {
    // Search YouTube Music
  }

  async getStream(trackId, quality): Promise<StreamInfo> {
    const selected = this.selectQuality(this.supportedQualities, quality);
    // Return stream URL with selected quality
    return {
      url: streamUrl,
      quality: selected,
      format: 'opus'
    };
  }

  isAuthenticated() {
    return false;
  }
}
```

---

### BaseLyricsProvider

Provides synced or plain text lyrics.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique provider identifier |
| `name` | `string` | Display name |
| `supportsSynced` | `boolean` | Whether synced lyrics are supported |

| Method | Description |
|--------|-------------|
| `getLyrics(query, options)` | Fetch lyrics for a track |
| `initialize()` | Setup hook (optional) |
| `dispose()` | Cleanup hook (optional) |

**Helper Methods:**
- `parseLrc(lrc)` - Parse LRC format to `LyricsLine[]`
- `syncedToPlain(synced)` - Convert synced lyrics to plain text

**Example:**
```typescript
import { BaseLyricsProvider, type LyricsResult } from '@audiio/sdk';

export class LRCLibProvider extends BaseLyricsProvider {
  readonly id = 'lrclib';
  readonly name = 'LRCLib';
  readonly supportsSynced = true;

  async getLyrics(query, options): Promise<LyricsResult | null> {
    const response = await fetch(`https://lrclib.net/api/get?...`);
    const data = await response.json();

    return {
      synced: this.parseLrc(data.syncedLyrics),
      plain: data.plainLyrics,
      source: 'lrclib'
    };
  }
}
```

---

### BaseAudioProcessor

Processes audio for features like karaoke mode or stem separation.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique processor identifier |
| `name` | `string` | Display name |
| `processingType` | `string` | Type of processing (e.g., 'vocal-removal') |

| Method | Description |
|--------|-------------|
| `processTrack(track, options)` | Process a track |
| `isAvailable()` | Check if processor is available |
| `hasCached(trackId)` | Check for cached results |
| `initialize()` | Setup hook (optional) |
| `dispose()` | Cleanup hook (optional) |

**Example:**
```typescript
import { BaseAudioProcessor } from '@audiio/sdk';

export class KaraokeProcessor extends BaseAudioProcessor {
  readonly id = 'karaoke';
  readonly name = 'Karaoke Mode';
  readonly processingType = 'vocal-removal';

  async processTrack(track, options) {
    // Process audio to remove vocals
  }

  async isAvailable() {
    return true;
  }

  async hasCached(trackId) {
    // Check cache
    return false;
  }
}
```

---

### BaseTool

General-purpose tools for utilities, integrations, and data transfer.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique tool identifier |
| `name` | `string` | Display name |
| `description` | `string` | Tool description |

| Method | Description |
|--------|-------------|
| `execute(params)` | Execute the tool's main function |
| `registerUI()` | Register UI components (optional) |
| `registerHandlers()` | Register IPC handlers (optional) |
| `initialize()` | Setup hook (optional) |
| `dispose()` | Cleanup hook (optional) |

**Helper Methods:**
- `log(message, ...args)` - Log with `[Tool:id]` prefix
- `logError(message, ...args)` - Error log with prefix

**Example:**
```typescript
import { BaseTool } from '@audiio/sdk';

export class SpotifyImporter extends BaseTool {
  readonly id = 'spotify-import';
  readonly name = 'Spotify Import';
  readonly description = 'Import playlists from Spotify';

  async execute(params) {
    this.log('Starting import...');
    // Import logic
  }
}
```

---

### BaseArtistEnrichmentProvider

Provides supplementary artist data like videos, concerts, and setlists.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique provider identifier |
| `name` | `string` | Display name |
| `capabilities` | `string[]` | Supported enrichment types |

| Method | Description |
|--------|-------------|
| `getArtistVideos(artistId)` | Fetch artist videos |
| `getUpcomingConcerts(artistId)` | Fetch upcoming concerts |
| `getArtistSetlists(artistId)` | Fetch setlist data |
| `getArtistGallery(artistId)` | Fetch artist images |
| `initialize()` | Setup hook (optional) |
| `dispose()` | Cleanup hook (optional) |

**Example:**
```typescript
import { BaseArtistEnrichmentProvider } from '@audiio/sdk';

export class FanartProvider extends BaseArtistEnrichmentProvider {
  readonly id = 'fanart';
  readonly name = 'Fanart.tv';
  readonly capabilities = ['gallery', 'backgrounds'];

  async getArtistGallery(artistId) {
    // Fetch from fanart.tv API
  }
}
```

## Advanced Features

### Custom HTTP Routes

Plugins can expose custom HTTP endpoints:

```typescript
import { BaseMetadataProvider, type PluginRouteHandler } from '@audiio/sdk';

export class MyPlugin extends BaseMetadataProvider {
  // ... base implementation

  getRoutes(): PluginRouteHandler[] {
    return [
      {
        method: 'GET',
        path: '/status',
        handler: async (req, reply) => {
          return reply.send({ status: 'ok' });
        },
        description: 'Get plugin status'
      },
      {
        method: 'POST',
        path: '/sync',
        handler: this.handleSync.bind(this),
        description: 'Trigger sync'
      }
    ];
  }

  private async handleSync(req, reply) {
    // Handle sync request
  }
}
```

### Sandboxed Execution

Plugins can request controlled access to system resources:

```typescript
import { BaseMetadataProvider, type SandboxContext } from '@audiio/sdk';

export class LocalLibraryPlugin extends BaseMetadataProvider {
  private sandbox: SandboxContext;

  async initialize(options) {
    this.sandbox = options?.sandbox;
    this.dataPath = this.sandbox.dataDir;
  }

  async scanFolder(path: string) {
    // Request access to a folder
    const granted = await this.sandbox.requestPathAccess(path);
    if (!granted) {
      throw new Error('Access denied');
    }

    // Use sandboxed filesystem
    const files = await this.sandbox.fs.readdir(path);
    for (const file of files) {
      const stat = await this.sandbox.fs.stat(`${path}/${file}`);
      // Process files...
    }
  }
}
```

**Sandbox Capabilities:**
- `fs` - Sandboxed filesystem operations (read, write, stat, readdir)
- `requestPathAccess(path)` - Request access to a filesystem path
- `fetch` - Network requests (may be restricted)
- `dataDir` - Plugin's isolated data directory

### Plugin Registration

Use `defineAddon()` to validate and export plugins:

```typescript
import { defineAddon, BaseMetadataProvider } from '@audiio/sdk';

class MyProvider extends BaseMetadataProvider {
  // Implementation...
}

export default defineAddon(MyProvider, {
  id: 'my-provider',
  name: 'My Provider',
  version: '1.0.0',
  roles: ['metadata-provider'],
  settingsSchema: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true
    }
  ]
});
```

## Type Exports

The SDK re-exports types from `@audiio/core`:

### Domain Types
- `Artist` - Artist data structure
- `Album` - Album data structure
- `Track` - Track data structure
- `StreamInfo` - Stream URL and metadata
- `LyricsResult` - Lyrics data with synced/plain variants
- `ExternalIds` - External service IDs (Spotify, Deezer, etc.)

### Addon Types
- `AddonManifest` - Plugin manifest definition
- `AddonRole` - Plugin capability roles
- `MetadataProvider` - Metadata provider interface
- `StreamProvider` - Stream provider interface
- `LyricsProvider` - Lyrics provider interface

### Settings Types
- `SettingsSchemaItem` - Settings field definition
- `SettingsFieldType` - Available field types

## Plugin Manifest

### PluginManifest Interface

```typescript
interface PluginManifest {
  id: string;           // Unique identifier (e.g., 'deezer')
  name: string;         // Display name (e.g., 'Deezer')
  version: string;      // Semver version (e.g., '1.0.0')
  description?: string; // Plugin description
  roles: AddonRole[];   // Capabilities ['metadata-provider', 'stream-provider']
  main?: string;        // Entry point file
  author?: string | { name: string; email?: string };
  settingsSchema?: SettingsSchemaItem[];  // Configuration UI
}
```

### Available Roles

| Role | Description |
|------|-------------|
| `metadata-provider` | Provides track/artist/album metadata |
| `stream-provider` | Provides audio streams |
| `lyrics-provider` | Provides lyrics |
| `audio-processor` | Processes audio |
| `tool` | General utility tool |
| `artist-enrichment` | Artist supplementary data |
| `scrobbler` | Listening history tracking |

## Lifecycle Hooks

All base classes support these lifecycle hooks:

```typescript
class MyPlugin extends BaseMetadataProvider {
  async initialize(): Promise<void> {
    // Called when plugin is loaded
    // - Setup authentication
    // - Load configuration
    // - Initialize resources
  }

  async dispose(): Promise<void> {
    // Called when plugin is unloaded
    // - Cleanup connections
    // - Save state
    // - Release resources
  }
}
```

## Existing Plugins

Reference implementations using this SDK:

| Plugin | Type | Description |
|--------|------|-------------|
| `plugin-deezer` | Metadata | Deezer API integration |
| `plugin-youtube-music` | Stream | YouTube Music streaming |
| `plugin-lrclib` | Lyrics | Synced lyrics from LRCLib |
| `plugin-fanart` | Enrichment | Artist images from Fanart.tv |
| `plugin-spotify-import` | Tool | Spotify playlist import |
| `plugin-listenbrainz` | Scrobbler | ListenBrainz scrobbling |
| `local-library` | Metadata/Stream | Local file management |

## Best Practices

1. **Implement all required methods** - Abstract methods must be implemented
2. **Handle errors gracefully** - Return `null` instead of throwing for "not found"
3. **Use helper methods** - Leverage built-in utilities like `normalizeQuery()`, `parseLrc()`
4. **Respect rate limits** - Implement appropriate throttling for external APIs
5. **Cache responses** - Use the sandbox's data directory for caching
6. **Clean up resources** - Implement `dispose()` for cleanup
7. **Validate input** - Check parameters before processing
8. **Log appropriately** - Use the provided logging helpers

## API Reference

For complete API documentation, see:
- [Base Classes README](./base/README.md)
- [Routes Types](./types/routes.ts)
- [Sandbox Types](./types/sandbox.ts)
- [@audiio/core Types](../../core/src/types/)
