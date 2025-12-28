# Getting Started with Plugin Development

This guide walks you through creating your first Audiio plugin.

## Prerequisites

- Node.js 18 or higher
- TypeScript 5.0+
- Basic understanding of TypeScript and async/await

## Step 1: Project Setup

Create a new directory and initialize your project:

```bash
mkdir my-audiio-plugin
cd my-audiio-plugin
npm init -y
```

Install development dependencies:

```bash
npm install -D typescript @audiio/sdk @types/node
```

## Step 2: Configure TypeScript

Create a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

## Step 3: Configure package.json

Update your `package.json` with the required fields:

```json
{
  "name": "my-audiio-plugin",
  "version": "1.0.0",
  "description": "My custom Audiio plugin",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js"
    }
  },
  "audiio": {
    "type": "plugin",
    "id": "my-plugin",
    "roles": ["metadata-provider"]
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "@audiio/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@audiio/sdk": "^0.1.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.7.0"
  }
}
```

### The `audiio` field

The `audiio` field in package.json tells Audiio about your plugin:

- `type` - Must be `"plugin"`
- `id` - Unique identifier for your plugin (lowercase, no spaces)
- `roles` - Array of capabilities your plugin provides

## Step 4: Create Your Plugin

Create a `src/index.ts` file:

```typescript
import {
  BaseMetadataProvider,
  type MetadataSearchResult,
  type MetadataSearchOptions,
  type MetadataTrack,
  type Artist,
  type ArtistDetail,
  type Album
} from '@audiio/sdk';

export class MyMetadataProvider extends BaseMetadataProvider {
  // Unique identifier - should match audiio.id in package.json
  readonly id = 'my-plugin';

  // Display name shown in the UI
  readonly name = 'My Plugin';

  // Priority determines preference when multiple providers exist
  // Higher = more preferred (range: 0-100)
  readonly priority = 50;

  /**
   * Search for tracks, artists, and albums
   */
  async search(
    query: string,
    options?: MetadataSearchOptions
  ): Promise<MetadataSearchResult> {
    const limit = options?.limit ?? 25;
    const offset = options?.offset ?? 0;

    // Make API request to your data source
    const response = await fetch(
      `https://api.example.com/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      tracks: data.tracks.map(this.mapTrack),
      artists: data.artists.map(this.mapArtist),
      albums: data.albums.map(this.mapAlbum)
    };
  }

  /**
   * Get a specific track by ID
   */
  async getTrack(id: string): Promise<MetadataTrack | null> {
    const response = await fetch(`https://api.example.com/tracks/${id}`);
    if (!response.ok) return null;

    const data = await response.json();
    return this.mapTrack(data);
  }

  /**
   * Get artist details including top tracks and albums
   */
  async getArtist(id: string): Promise<ArtistDetail | null> {
    const response = await fetch(`https://api.example.com/artists/${id}`);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: String(data.id),
      name: data.name,
      topTracks: data.top_tracks.map(this.mapTrack),
      albums: data.albums.map(this.mapAlbum),
      singles: [],
      eps: [],
      compilations: [],
      appearsOn: [],
      similarArtists: data.similar.map(this.mapArtist)
    };
  }

  /**
   * Get album with tracks
   */
  async getAlbum(id: string): Promise<(Album & { tracks: MetadataTrack[] }) | null> {
    const response = await fetch(`https://api.example.com/albums/${id}`);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: String(data.id),
      title: data.title,
      tracks: data.tracks.map(this.mapTrack)
    };
  }

  // Helper methods to map API responses to Audiio types

  private mapTrack = (data: any): MetadataTrack => ({
    id: String(data.id),
    title: data.title,
    artists: data.artists.map(this.mapArtist),
    duration: data.duration_seconds,
    _provider: this.id
  });

  private mapArtist = (data: any): Artist => ({
    id: String(data.id),
    name: data.name
  });

  private mapAlbum = (data: any): Album => ({
    id: String(data.id),
    title: data.title
  });
}

// IMPORTANT: Export your class as the default export
export default MyMetadataProvider;
```

## Step 5: Build and Test

Build your plugin:

```bash
npm run build
```

To test locally, you can install it in your Audiio installation:

```bash
# From your plugin directory
npm link

# From your Audiio installation
npm link my-audiio-plugin
```

## Step 6: Publish

When you're ready to share your plugin:

```bash
npm publish
```

Users can then install it with:

```bash
npm install my-audiio-plugin
```

Audiio will automatically discover and load your plugin.

## Next Steps

- Read the [Plugin Types](./plugin-types.md) documentation for detailed API reference
- Check out [Examples](./examples.md) for more complex implementations
- Learn about [Publishing](./publishing.md) best practices
