# @audiio/sdk

The official SDK for building Audiio plugins and addons. Provides base classes, type definitions, and utilities for creating stream providers, metadata providers, lyrics providers, audio processors, tools, and artist enrichment providers.

## Installation

```bash
npm install @audiio/sdk
```

## Purpose

The SDK serves as the foundational layer for plugin development in Audiio. It provides:

1. **Base Classes** - Abstract classes with common functionality for each provider type
2. **Type Definitions** - TypeScript interfaces for all domain objects and addon contracts
3. **Registration Utilities** - Functions for validating and registering addons
4. **Sandbox Types** - Types for secure, capability-based plugin execution

## Package Structure

```
@audiio/sdk
├── src/
│   ├── index.ts              # Main entry point, re-exports everything
│   ├── registration.ts       # defineAddon() and manifest validation
│   ├── base/                  # Abstract base classes
│   │   ├── BaseMetadataProvider.ts
│   │   ├── BaseStreamProvider.ts
│   │   ├── BaseLyricsProvider.ts
│   │   ├── BaseAudioProcessor.ts
│   │   ├── BaseTool.ts
│   │   └── BaseArtistEnrichmentProvider.ts
│   └── types/                 # Additional type definitions
│       ├── routes.ts          # Plugin HTTP route types
│       └── sandbox.ts         # Sandboxed execution types
└── dist/                      # Compiled JavaScript output
```

## Quick Start

### Creating a Lyrics Provider

```typescript
import { BaseLyricsProvider, type LyricsQuery, type LyricsResult } from '@audiio/sdk';

class MyLyricsProvider extends BaseLyricsProvider {
  readonly id = 'my-lyrics';
  readonly name = 'My Lyrics Service';
  readonly supportsSynced = true;

  async getLyrics(query: LyricsQuery): Promise<LyricsResult | null> {
    const lrcText = await this.fetchFromAPI(query.title, query.artist);
    if (!lrcText) return null;

    const synced = this.parseLrc(lrcText);  // Built-in helper
    return {
      synced,
      plain: this.syncedToPlain(synced),    // Built-in helper
      source: this.id
    };
  }
}

export default MyLyricsProvider;
```

### Creating a Stream Provider

```typescript
import { BaseStreamProvider, type Quality, type StreamInfo } from '@audiio/sdk';

class MyStreamProvider extends BaseStreamProvider {
  readonly id = 'my-stream';
  readonly name = 'My Streaming Service';
  readonly requiresAuth = true;
  readonly supportedQualities: Quality[] = ['high', 'medium', 'low'];

  async search(query: string) {
    // Search implementation
  }

  async getStream(trackId: string, quality?: Quality): Promise<StreamInfo> {
    const selected = this.selectQuality(this.supportedQualities, quality);
    return { url: await this.fetchUrl(trackId, selected), quality: selected };
  }

  isAuthenticated() {
    return !!this.accessToken;
  }
}
```

## Base Classes

| Class | Role | Purpose |
|-------|------|---------|
| `BaseMetadataProvider` | `metadata-provider` | Fetch track, album, artist metadata |
| `BaseStreamProvider` | `stream-provider` | Provide audio streams for playback |
| `BaseLyricsProvider` | `lyrics-provider` | Fetch synced or plain lyrics |
| `BaseAudioProcessor` | `audio-processor` | Process audio (karaoke, stems) |
| `BaseTool` | `tool` | Utilities, integrations, data transfer |
| `BaseArtistEnrichmentProvider` | `artist-enrichment` | Videos, concerts, setlists |

See [`src/base/README.md`](./src/base/README.md) for detailed documentation of each base class.

## Exported Types

The SDK re-exports all domain types from `@audiio/core`:

### Domain Types
- `Artist`, `Album`, `ArtworkSet`, `AnimatedArtwork`
- `Quality`, `StreamInfo`, `StreamSource`
- `LyricsLine`, `LyricsResult`
- `UnifiedTrack`, `SearchQuery`, `SearchResult`

### Addon Types
- `AddonRole`, `AddonManifest`, `BaseAddon`
- `MetadataProvider`, `MetadataTrack`, `MetadataSearchResult`
- `StreamProvider`, `StreamTrack`, `StreamSearchOptions`
- `LyricsProvider`, `LyricsQuery`, `LyricsSearchOptions`
- `AudioProcessor`, `AudioProcessorResult`
- `Tool`, `ToolType`, `PluginUIRegistry`
- `Scrobbler`, `ScrobblePayload`, `NowPlayingPayload`

### Artist Enrichment Types
- `ArtistEnrichmentProvider`, `ArtistEnrichmentType`
- `MusicVideo`, `VideoStreamInfo`
- `Concert`, `Setlist`, `TimelineEntry`
- `ArtistImages`

### Library Management Types
- `MetadataEnricher`, `ArtworkProvider`, `FingerprintProvider`
- `ISRCResolver`, `AnalyticsProvider`, `SmartPlaylistRulesProvider`
- `DuplicateDetector`, `ImportProvider`, `ExportProvider`
- `LibraryHook`, `LibraryEvent`, `LibraryEventType`

### Pipeline Types (Discover Integration)
- `DataProvider`, `QueryEnhancer`, `ResultTransformer`
- `PipelineConfig`, `PipelineContext`, `PipelineResult`

See [`src/types/README.md`](./src/types/README.md) for route and sandbox type documentation.

## Registration

Use `defineAddon()` to register plugins with validation:

```typescript
import { defineAddon, BaseMetadataProvider } from '@audiio/sdk';

class MyProvider extends BaseMetadataProvider {
  // ...implementation
}

export default defineAddon({
  manifest: {
    id: 'my-provider',        // Required: lowercase alphanumeric with dashes
    name: 'My Provider',      // Required: display name
    version: '1.0.0',         // Required: semver version
    roles: ['metadata-provider']  // Required: at least one role
  },
  create: () => new MyProvider()
});
```

## Custom Routes

Plugins can expose HTTP endpoints using the route types:

```typescript
import type { PluginRouteHandler, PluginWithRoutes } from '@audiio/sdk';

class MyPlugin implements PluginWithRoutes {
  getRoutes(): PluginRouteHandler[] {
    return [
      {
        method: 'GET',
        path: '/items',
        handler: async (req, reply) => {
          return { items: await this.getItems() };
        }
      }
    ];
  }
}
```

Routes are prefixed with `/api/plugins/:pluginId/`.

## Sandboxed Execution

Plugins run in a sandbox with capability-based permissions:

```typescript
import type { SandboxContext, PluginInitOptions } from '@audiio/sdk';

class MyPlugin {
  private sandbox: SandboxContext | null = null;

  async initialize(options?: PluginInitOptions) {
    if (options?.sandbox) {
      this.sandbox = options.sandbox;

      // Use sandboxed filesystem
      const data = await this.sandbox.fs.readFile('/path/to/file');

      // Use sandboxed fetch
      const response = await this.sandbox.fetch('https://api.example.com');

      // Request new path access (requires admin approval)
      const granted = await this.sandbox.requestPathAccess('/music', true);
    }
  }
}
```

## Where Used

The SDK is used by all Audiio plugins:

| Plugin | Uses |
|--------|------|
| `plugin-deezer` | `BaseMetadataProvider`, `BaseStreamProvider`, Pipeline types |
| `plugin-youtube-music` | `BaseStreamProvider` |
| `plugin-lrclib` | `BaseLyricsProvider` |
| `plugin-fanart` | `BaseArtistEnrichmentProvider` |
| `plugin-listenbrainz` | `Scrobbler` types |
| `plugin-spotify-import` | `BaseTool`, Import types |
| `local-library` | Route types, Sandbox types |
| `youtube-videos` | `BaseArtistEnrichmentProvider` |

Server-side usage:
- `packages/server/src/services/plugin-loader.ts` - Loads and initializes plugins
- `packages/server/src/services/plugin-sandbox.ts` - Creates sandbox contexts

## Lifecycle

All base classes provide lifecycle hooks:

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

## Development

```bash
# Build the SDK
npm run build

# Watch mode
npm run dev

# Clean build artifacts
npm run clean
```

## Dependencies

- `@audiio/core` - Core types and interfaces (peer dependency)
- `typescript` - Build tooling

## Related Documentation

- [Base Classes](./src/base/README.md) - Detailed base class documentation
- [SDK Types](./src/types/README.md) - Route and sandbox type documentation
- [Plugin Development Guide](../../docs/plugins/getting-started.md) - Full plugin tutorial
- [Sandbox Security](../../docs/plugins/sandbox.md) - Security model documentation
