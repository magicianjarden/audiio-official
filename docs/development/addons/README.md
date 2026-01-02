# Addon Development Overview

Build addons to extend Audiio with new music sources, features, and integrations.

## What Are Addons?

Addons are TypeScript/JavaScript packages that hook into Audiio's addon system. They can:

- Provide music metadata (tracks, artists, albums)
- Stream audio from various sources
- Display synced lyrics
- Process audio (karaoke, stems)
- Track listening history (scrobbling)
- Import/export data and connect cloud storage
- Enrich artist pages with videos, concerts, and images

## Addon Roles

Audiio supports **7 addon roles**. Each addon declares one or more roles:

| Role | Interface | Base Class | Purpose |
|------|-----------|------------|---------|
| `metadata-provider` | `MetadataProvider` | `BaseMetadataProvider` | Track/artist/album info |
| `stream-provider` | `StreamProvider` | `BaseStreamProvider` | Audio stream URLs |
| `lyrics-provider` | `LyricsProvider` | `BaseLyricsProvider` | Synced/plain lyrics |
| `audio-processor` | `AudioProcessor` | `BaseAudioProcessor` | Audio processing (karaoke, stems) |
| `scrobbler` | `Scrobbler` | - | Listening history tracking |
| `tool` | `Tool` | `BaseTool` | Data transfer, cloud mounts, utilities |
| `artist-enrichment` | `ArtistEnrichmentProvider` | `BaseArtistEnrichmentProvider` | Videos, concerts, setlists, gallery |

## Quick Start

### 1. Set Up Project

```bash
mkdir my-addon
cd my-addon
npm init -y
npm install @audiio/sdk typescript
```

### 2. Create Addon

```typescript
// src/index.ts
import { BaseMetadataProvider, type Track } from '@audiio/sdk';

export default class MyMetadataProvider extends BaseMetadataProvider {
  readonly id = 'my-addon';
  readonly name = 'My Addon';
  readonly priority = 50;

  async search(query: string) {
    // Your implementation
    return { tracks: [], artists: [], albums: [] };
  }

  async getTrack(id: string): Promise<Track | null> {
    return null;
  }

  async getArtist(id: string) { return null; }
  async getAlbum(id: string) { return null; }
}
```

### 3. Configure package.json

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
  },
  "peerDependencies": {
    "@audiio/sdk": "^1.0.0",
    "@audiio/core": "^1.0.0"
  }
}
```

### 4. Build

```bash
npx tsc
```

### 5. Install in Audiio

1. Go to Settings > Addons
2. Click "Install from File" or "Load Local"
3. Select your built addon

## Development Guides

| Guide | Description |
|-------|-------------|
| [Tutorial](tutorial.md) | Step-by-step first addon |
| [Metadata Provider](metadata-provider.md) | Provide track/artist/album info |
| [Stream Provider](stream-provider.md) | Provide audio streams |
| [Lyrics Provider](lyrics-provider.md) | Provide synced lyrics |
| [Audio Processor](audio-processor.md) | Process audio |
| [Scrobbler](scrobbler.md) | Track listening history |
| [Tool](tool.md) | Data transfer and utilities |
| [Artist Enrichment](artist-enrichment.md) | Videos, concerts, gallery |

---

## Tool Addon Role

Tools provide utilities like data import/export, cloud storage mounts, and integrations.

### Tool Types

| Type | Purpose | Example |
|------|---------|---------|
| `data-transfer` | Import/export data | Spotify import, library backup |
| `cloud-mount` | Connect cloud storage | Google Drive, Dropbox |
| `integration` | Third-party services | Discord presence, smart home |
| `utility` | Stats, analytics, converters | Library stats, file converter |

### Example Tool

```typescript
import { BaseTool, type ToolType } from '@audiio/sdk';

export default class SpotifyImportTool extends BaseTool {
  readonly id = 'spotify-import';
  readonly name = 'Spotify Import';
  readonly toolType: ToolType = 'data-transfer';
  readonly description = 'Import playlists and likes from Spotify';

  async execute(params: { accessToken: string }) {
    const playlists = await this.fetchSpotifyPlaylists(params.accessToken);

    for (const playlist of playlists) {
      await this.importPlaylist(playlist);
    }

    return { success: true, imported: playlists.length };
  }

  // Optional: Provide UI components
  getUIComponents() {
    return {
      settingsPanel: SpotifySettingsPanel,
      actionButton: SpotifyImportButton
    };
  }
}
```

---

## Artist Enrichment Provider Role

Artist enrichment providers add supplementary data to artist pages: videos, concerts, setlists, and gallery images.

### Enrichment Types

| Type | Description |
|------|-------------|
| `videos` | Music videos from external sources |
| `timeline` | Artist discography history |
| `setlists` | Past concert setlists |
| `concerts` | Upcoming concerts/events |
| `gallery` | Artist images (backgrounds, thumbnails, logos, banners) |
| `merchandise` | Merchandise URLs |

### Example Enrichment Provider

```typescript
import { BaseArtistEnrichmentProvider, type ArtistEnrichmentType } from '@audiio/sdk';

export default class FanartEnrichmentProvider extends BaseArtistEnrichmentProvider {
  readonly id = 'fanart-enrichment';
  readonly name = 'Fanart.tv';
  readonly priority = 50;
  readonly supportedTypes: ArtistEnrichmentType[] = ['gallery'];

  async getArtistGallery(mbid: string, artistName?: string) {
    const response = await fetch(
      `https://webservice.fanart.tv/v3/music/${mbid}?api_key=${this.apiKey}`
    );
    const data = await response.json();

    return {
      backgrounds: data.artistbackground?.map(bg => bg.url) || [],
      thumbnails: data.artistthumb?.map(t => t.url) || [],
      logos: data.hdmusiclogo?.map(l => l.url) || [],
      banners: data.musicbanner?.map(b => b.url) || []
    };
  }
}
```

---

## Addon Manifest

Every addon needs a manifest defining its capabilities:

```typescript
interface AddonManifest {
  id: string;           // Unique identifier (lowercase, alphanumeric, dashes)
  name: string;         // Display name
  version: string;      // Semantic version
  roles: AddonRole[];   // Array of supported roles
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  settings?: SettingDefinition[];
  dependencies?: string[];
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

### Settings Types

Define user-configurable settings:

```typescript
settings: [
  {
    key: 'apiKey',
    type: 'string',
    label: 'API Key',
    description: 'Your API key',
    required: true,
    secret: true,
  },
  {
    key: 'quality',
    type: 'select',
    label: 'Quality',
    options: ['low', 'medium', 'high'],
    default: 'high',
  },
  {
    key: 'enabled',
    type: 'boolean',
    label: 'Enable Feature',
    default: true,
  },
]
```

---

## Core Types

### Track

```typescript
interface Track {
  id: string;
  title: string;
  artist: string;
  artists?: Artist[];
  artistId?: string;
  album?: string;
  albumId?: string;
  duration: number;  // seconds
  artwork?: string | ArtworkSet;
  isrc?: string;
  explicit?: boolean;
  externalIds?: ExternalIds;
}
```

### Artist

```typescript
interface Artist {
  id: string;
  name: string;
  artwork?: ArtworkSet;
  genres?: string[];
  bio?: string;
  followers?: number;
}
```

### Album

```typescript
interface Album {
  id: string;
  title: string;
  artists?: Artist[];
  artwork?: ArtworkSet;
  releaseDate?: string;
  tracks?: Track[];
  trackCount?: number;
}
```

### Lyrics

```typescript
interface LyricsResult {
  synced?: LyricsLine[];
  plain?: string;
  source: string;
}

interface LyricsLine {
  time: number;  // milliseconds
  text: string;
}
```

---

## Helper Methods

Base classes provide useful helper methods:

### BaseStreamProvider

```typescript
// Select best available quality
const quality = this.selectQuality(availableQualities, preferredQuality);

// Calculate match score between tracks (0-1)
const score = this.calculateMatchScore(candidate, target);

// Normalize strings for comparison
const normalized = this.normalize(str);
```

### BaseLyricsProvider

```typescript
// Parse LRC format to synced lyrics array
const synced = this.parseLrc(lrcString);

// Convert synced lyrics to plain text
const plain = this.syncedToPlain(synced);
```

### BaseMetadataProvider

```typescript
// Normalize search queries
const normalized = this.normalizeQuery(query);
```

---

## Project Structure

Recommended structure:

```
my-addon/
├── src/
│   ├── index.ts        # Main addon export
│   ├── providers/      # Provider implementations
│   │   ├── metadata.ts
│   │   └── lyrics.ts
│   ├── api.ts          # API client
│   └── types.ts        # Type definitions
├── package.json
├── tsconfig.json
└── README.md
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

---

## Loading Addons

Audiio supports multiple ways to load addons:

### 1. Built-in (Bundled)

Place in `addons/` directory of the Audiio installation.

### 2. Local File

Load from a local directory via Settings > Addons > Load Local.

### 3. npm Package

Install from npm with the `audiio-addon-` prefix:

```bash
# In Audiio settings, enter package name:
audiio-addon-my-feature
```

### 4. Git Repository

Install directly from a git URL:

```
https://github.com/user/audiio-addon-my-feature
```

### 5. HTTP Archive

Install from a URL pointing to a `.tgz` archive.

---

## Testing

### Local Testing

1. Build your addon: `npm run build`
2. In Audiio, use Settings > Addons > Load Local
3. Select your addon directory
4. Test functionality

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import MyProvider from './index';

describe('MyProvider', () => {
  const provider = new MyProvider();

  it('searches tracks', async () => {
    const results = await provider.search('test query');
    expect(results.tracks).toBeInstanceOf(Array);
  });

  it('returns null for unknown track', async () => {
    const track = await provider.getTrack('unknown-id');
    expect(track).toBeNull();
  });
});
```

---

## Best Practices

### Performance

- Cache API responses when appropriate
- Implement pagination for large result sets
- Use streaming for large data transfers
- Handle rate limits gracefully

### Error Handling

```typescript
async search(query: string) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return this.parseResults(await response.json());
  } catch (error) {
    console.error('[MyProvider] Search failed:', error);
    return { tracks: [], artists: [], albums: [] };
  }
}
```

### Priority Settings

- Higher priority providers are tried first
- Default priority is 50
- Range: 0-100
- Set based on reliability and response time

### User Experience

- Provide meaningful error messages
- Handle offline scenarios gracefully
- Document required settings clearly
- Include usage examples

---

## Examples

### Built-in Addons

Study the built-in addons for reference:

| Addon | Roles | Description |
|-------|-------|-------------|
| `deezer-metadata` | metadata-provider | Metadata from Deezer API |
| `youtube-music` | stream-provider | Audio streams from YouTube |
| `lrclib-lyrics` | lyrics-provider | Synced lyrics from LRCLib |
| `karaoke` | audio-processor | Vocal removal with instant playback |
| `sposify` | tool | Spotify data import |
| `fanart-enrichment` | artist-enrichment | Artist images from Fanart.tv |

Location: `addons/` directory in the Audiio source.

---

## Getting Help

- Check existing addon code in `addons/`
- Review SDK documentation
- Open GitHub issues
- Join the developer community

---

## Next Steps

- [Tutorial](tutorial.md) - Build your first addon
- [SDK Reference](../../sdk/README.md) - Complete API documentation
- [Architecture](../architecture.md) - System overview
- [API Reference](../../api/README.md) - REST API endpoints
