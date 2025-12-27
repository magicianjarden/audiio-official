# Addon Tutorial

Build your first Audiio addon step by step.

## What We'll Build

A simple metadata provider addon that fetches track information from a public API. By the end, you'll understand:

- Addon structure and manifest
- Implementing provider interfaces
- Settings and configuration
- Testing and debugging
- Packaging for distribution

## Prerequisites

- Node.js 18+ installed
- Basic TypeScript knowledge
- Audiio installed (for testing)

## Step 1: Project Setup

Create the project:

```bash
mkdir my-first-addon
cd my-first-addon
npm init -y
```

Install dependencies:

```bash
npm install @audiio/sdk
npm install -D typescript @types/node
```

Create TypeScript config:

```bash
npx tsc --init
```

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

Update `package.json`:

```json
{
  "name": "my-first-addon",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "audiio": {
    "addon": true
  },
  "dependencies": {
    "@audiio/sdk": "^1.0.0"
  }
}
```

Create directory structure:

```bash
mkdir src
touch src/index.ts
```

## Step 2: Create the Addon Class

Edit `src/index.ts`:

```typescript
import { BaseAddon, MetadataProvider, Track, Artist, Album } from '@audiio/sdk';

export default class MyFirstAddon extends BaseAddon implements MetadataProvider {
  // Addon manifest - required
  static manifest = {
    id: 'my-first-addon',
    name: 'My First Addon',
    version: '1.0.0',
    description: 'A tutorial addon for learning',
    author: 'Your Name',
    roles: ['metadata-provider'],
  };

  // Called when addon loads
  async initialize(): Promise<void> {
    this.log.info('My First Addon initialized!');
  }

  // Called when addon unloads
  async destroy(): Promise<void> {
    this.log.info('My First Addon destroyed');
  }

  // Search for tracks
  async searchTracks(query: string): Promise<Track[]> {
    this.log.debug(`Searching for: ${query}`);

    // For now, return dummy data
    return [
      {
        id: 'track-1',
        title: 'Example Track',
        artist: 'Example Artist',
        duration: 180,
      },
    ];
  }

  // Get a single track by ID
  async getTrack(id: string): Promise<Track | null> {
    return {
      id,
      title: 'Example Track',
      artist: 'Example Artist',
      duration: 180,
    };
  }

  // Search for artists
  async searchArtists(query: string): Promise<Artist[]> {
    return [];
  }

  // Get artist by ID
  async getArtist(id: string): Promise<Artist | null> {
    return null;
  }

  // Search for albums
  async searchAlbums(query: string): Promise<Album[]> {
    return [];
  }

  // Get album by ID
  async getAlbum(id: string): Promise<Album | null> {
    return null;
  }
}
```

Build it:

```bash
npm run build
```

## Step 3: Add Real API Integration

Let's connect to a real API. We'll use the free iTunes Search API:

```typescript
import { BaseAddon, MetadataProvider, Track, Artist, Album } from '@audiio/sdk';

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  trackTimeMillis: number;
  artistId: number;
  collectionId: number;
}

interface ITunesResponse {
  resultCount: number;
  results: ITunesResult[];
}

export default class MyFirstAddon extends BaseAddon implements MetadataProvider {
  static manifest = {
    id: 'my-first-addon',
    name: 'My First Addon',
    version: '1.0.0',
    description: 'iTunes metadata provider',
    author: 'Your Name',
    roles: ['metadata-provider'],
  };

  private baseUrl = 'https://itunes.apple.com';

  async searchTracks(query: string): Promise<Track[]> {
    try {
      // Check cache first
      const cacheKey = `search:${query}`;
      const cached = await this.cache.get<Track[]>(cacheKey);
      if (cached) {
        this.log.debug('Returning cached results');
        return cached;
      }

      // Fetch from API
      const url = `${this.baseUrl}/search?term=${encodeURIComponent(query)}&entity=song&limit=25`;
      const response = await this.fetch<ITunesResponse>(url);

      const tracks: Track[] = response.results.map((item) => ({
        id: `itunes:${item.trackId}`,
        title: item.trackName,
        artist: item.artistName,
        artistId: `itunes:${item.artistId}`,
        album: item.collectionName,
        albumId: `itunes:${item.collectionId}`,
        artwork: item.artworkUrl100.replace('100x100', '600x600'),
        duration: Math.floor(item.trackTimeMillis / 1000),
      }));

      // Cache for 5 minutes
      await this.cache.set(cacheKey, tracks, 300);

      return tracks;
    } catch (error) {
      this.log.error('Search failed', error);
      return [];
    }
  }

  async getTrack(id: string): Promise<Track | null> {
    const itunesId = id.replace('itunes:', '');
    const url = `${this.baseUrl}/lookup?id=${itunesId}`;

    try {
      const response = await this.fetch<ITunesResponse>(url);
      if (response.results.length === 0) return null;

      const item = response.results[0];
      return {
        id,
        title: item.trackName,
        artist: item.artistName,
        artistId: `itunes:${item.artistId}`,
        album: item.collectionName,
        albumId: `itunes:${item.collectionId}`,
        artwork: item.artworkUrl100.replace('100x100', '600x600'),
        duration: Math.floor(item.trackTimeMillis / 1000),
      };
    } catch (error) {
      this.log.error('Get track failed', error);
      return null;
    }
  }

  async searchArtists(query: string): Promise<Artist[]> {
    // Similar implementation for artists
    return [];
  }

  async getArtist(id: string): Promise<Artist | null> {
    return null;
  }

  async searchAlbums(query: string): Promise<Album[]> {
    return [];
  }

  async getAlbum(id: string): Promise<Album | null> {
    return null;
  }
}
```

## Step 4: Add User Settings

Let users configure the addon:

```typescript
static manifest = {
  id: 'my-first-addon',
  name: 'My First Addon',
  version: '1.0.0',
  description: 'iTunes metadata provider',
  author: 'Your Name',
  roles: ['metadata-provider'],
  settings: [
    {
      key: 'country',
      type: 'select',
      label: 'Country',
      description: 'iTunes store region',
      options: [
        { value: 'us', label: 'United States' },
        { value: 'gb', label: 'United Kingdom' },
        { value: 'jp', label: 'Japan' },
        { value: 'de', label: 'Germany' },
      ],
      default: 'us',
    },
    {
      key: 'resultLimit',
      type: 'number',
      label: 'Result Limit',
      description: 'Maximum search results',
      min: 10,
      max: 100,
      default: 25,
    },
    {
      key: 'includeExplicit',
      type: 'boolean',
      label: 'Include Explicit',
      description: 'Show explicit content',
      default: true,
    },
  ],
};
```

Use settings in your code:

```typescript
async searchTracks(query: string): Promise<Track[]> {
  const country = this.getSetting<string>('country') || 'us';
  const limit = this.getSetting<number>('resultLimit') || 25;
  const explicit = this.getSetting<boolean>('includeExplicit') ?? true;

  const url = `${this.baseUrl}/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}&country=${country}`;

  // ... rest of implementation

  // Filter explicit if needed
  if (!explicit) {
    return tracks.filter(t => !t.explicit);
  }

  return tracks;
}
```

## Step 5: Error Handling

Robust error handling:

```typescript
async searchTracks(query: string): Promise<Track[]> {
  // Input validation
  if (!query || query.trim().length < 2) {
    this.log.debug('Query too short');
    return [];
  }

  try {
    const response = await this.fetch<ITunesResponse>(url);

    // Validate response
    if (!response || !response.results) {
      this.log.warn('Invalid API response');
      return [];
    }

    return this.parseResults(response.results);

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('429')) {
        this.log.warn('Rate limited, backing off');
        await this.sleep(1000);
        return this.searchTracks(query); // Retry once
      }

      if (error.message.includes('network')) {
        this.log.error('Network error', error);
        return [];
      }
    }

    this.log.error('Unexpected error', error);
    throw error; // Re-throw unexpected errors
  }
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Step 6: Testing

Create test file `src/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import MyFirstAddon from './index';

describe('MyFirstAddon', () => {
  let addon: MyFirstAddon;

  beforeEach(() => {
    addon = new MyFirstAddon();
  });

  describe('searchTracks', () => {
    it('returns tracks for valid query', async () => {
      const tracks = await addon.searchTracks('beatles');
      expect(tracks).toBeInstanceOf(Array);
      expect(tracks.length).toBeGreaterThan(0);
    });

    it('returns empty for short query', async () => {
      const tracks = await addon.searchTracks('a');
      expect(tracks).toEqual([]);
    });

    it('returns tracks with required fields', async () => {
      const tracks = await addon.searchTracks('imagine dragons');
      if (tracks.length > 0) {
        expect(tracks[0]).toHaveProperty('id');
        expect(tracks[0]).toHaveProperty('title');
        expect(tracks[0]).toHaveProperty('artist');
        expect(tracks[0]).toHaveProperty('duration');
      }
    });
  });

  describe('getTrack', () => {
    it('returns track for valid ID', async () => {
      const track = await addon.getTrack('itunes:123456');
      // May be null if ID doesn't exist
    });
  });
});
```

Run tests:

```bash
npm install -D vitest
npx vitest
```

## Step 7: Local Testing in Audiio

1. Build the addon:
   ```bash
   npm run build
   ```

2. Link locally:
   ```bash
   npm link
   ```

3. In your Audiio development setup:
   ```bash
   cd /path/to/audiio
   npm link my-first-addon
   ```

4. Add to addon loader and test

## Step 8: Packaging

Create a release build:

```bash
npm run build
npm pack
```

This creates `my-first-addon-1.0.0.tgz`.

Users can install via:
1. Settings > Addons > Install from File
2. Select the `.tgz` file

## Step 9: Documentation

Add a README.md:

```markdown
# My First Addon

iTunes metadata provider for Audiio.

## Features

- Search tracks, artists, albums
- High-quality artwork
- Multiple country support

## Installation

1. Download the latest release
2. In Audiio: Settings > Addons > Install from File
3. Select the downloaded file

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Country | iTunes store region | US |
| Result Limit | Max search results | 25 |
| Include Explicit | Show explicit content | Yes |

## License

MIT
```

## Final Code

Complete `src/index.ts`:

```typescript
import { BaseAddon, MetadataProvider, Track, Artist, Album } from '@audiio/sdk';

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  trackTimeMillis: number;
  artistId: number;
  collectionId: number;
  trackExplicitness: string;
}

interface ITunesResponse {
  resultCount: number;
  results: ITunesResult[];
}

export default class MyFirstAddon extends BaseAddon implements MetadataProvider {
  static manifest = {
    id: 'my-first-addon',
    name: 'My First Addon',
    version: '1.0.0',
    description: 'iTunes metadata provider for Audiio',
    author: 'Your Name',
    roles: ['metadata-provider' as const],
    settings: [
      {
        key: 'country',
        type: 'select' as const,
        label: 'Country',
        options: [
          { value: 'us', label: 'United States' },
          { value: 'gb', label: 'United Kingdom' },
        ],
        default: 'us',
      },
      {
        key: 'resultLimit',
        type: 'number' as const,
        label: 'Result Limit',
        min: 10,
        max: 100,
        default: 25,
      },
    ],
  };

  private baseUrl = 'https://itunes.apple.com';

  async initialize(): Promise<void> {
    this.log.info('iTunes addon initialized');
  }

  async searchTracks(query: string): Promise<Track[]> {
    if (!query || query.trim().length < 2) return [];

    const country = this.getSetting<string>('country') || 'us';
    const limit = this.getSetting<number>('resultLimit') || 25;
    const cacheKey = `search:${country}:${query}`;

    const cached = await this.cache.get<Track[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}&country=${country}`;
      const response = await this.fetch<ITunesResponse>(url);

      const tracks: Track[] = response.results.map((item) => ({
        id: `itunes:${item.trackId}`,
        title: item.trackName,
        artist: item.artistName,
        artistId: `itunes:${item.artistId}`,
        album: item.collectionName,
        albumId: `itunes:${item.collectionId}`,
        artwork: item.artworkUrl100.replace('100x100', '600x600'),
        duration: Math.floor(item.trackTimeMillis / 1000),
        explicit: item.trackExplicitness === 'explicit',
      }));

      await this.cache.set(cacheKey, tracks, 300);
      return tracks;
    } catch (error) {
      this.log.error('Search failed', error);
      return [];
    }
  }

  async getTrack(id: string): Promise<Track | null> {
    // Implementation
    return null;
  }

  async searchArtists(query: string): Promise<Artist[]> {
    return [];
  }

  async getArtist(id: string): Promise<Artist | null> {
    return null;
  }

  async searchAlbums(query: string): Promise<Album[]> {
    return [];
  }

  async getAlbum(id: string): Promise<Album | null> {
    return null;
  }
}
```

## Next Steps

- [Metadata Provider](metadata-provider.md) - Full implementation
- [Stream Provider](stream-provider.md) - Provide audio
- [SDK Reference](../../sdk/README.md) - Complete API

Congratulations! You've built your first Audiio addon!

