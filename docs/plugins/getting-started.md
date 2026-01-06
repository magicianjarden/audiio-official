# Getting Started with Plugins

Create your first Audiio plugin.

## Prerequisites

- Node.js 18+
- Basic TypeScript knowledge

## Project Setup

```bash
mkdir my-audiio-plugin
cd my-audiio-plugin
npm init -y
npm install @audiio/sdk typescript
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

## Package.json Configuration

Add the `audiio` field to identify your package as a plugin:

```json
{
  "name": "my-audiio-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "audiio": {
    "type": "plugin",
    "id": "my-plugin",
    "roles": ["metadata-provider"]
  },
  "peerDependencies": {
    "@audiio/sdk": "*"
  }
}
```

## Basic Plugin

Create `src/index.ts`:

```typescript
import {
  BaseMetadataProvider,
  MetadataSearchResult,
  MetadataSearchOptions,
  MetadataTrack,
  Artist,
  Album
} from '@audiio/sdk';

export default class MyPlugin extends BaseMetadataProvider {
  readonly id = 'my-plugin';
  readonly name = 'My Plugin';

  async search(query: string, options?: MetadataSearchOptions): Promise<MetadataSearchResult> {
    // Your search implementation
    return {
      tracks: [],
      artists: [],
      albums: []
    };
  }

  async getTrack(id: string): Promise<MetadataTrack | null> {
    return null;
  }

  async getArtist(id: string): Promise<Artist | null> {
    return null;
  }

  async getAlbum(id: string): Promise<(Album & { tracks: MetadataTrack[] }) | null> {
    return null;
  }
}
```

## Build and Install

```bash
# Build
npx tsc

# Create a zip for installation
zip -r my-plugin.zip dist package.json

# Install via API
curl -X POST http://localhost:8484/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"downloadUrl": "file:///path/to/my-plugin.zip"}'
```

## Testing Your Plugin

```bash
# Check plugin is loaded
curl http://localhost:8484/api/addons

# Test search
curl "http://localhost:8484/api/search?q=test"
```

## Plugin Lifecycle

```
1. Server starts
      │
      ▼
2. PluginLoader scans plugins directory
      │
      ▼
3. Plugin class instantiated
      │
      ▼
4. initialize() called
      │
      ▼
5. Plugin registered with AddonRegistry
      │
      ▼
6. API requests routed to plugin methods
      │
      ▼
7. dispose() called on shutdown
```

## Error Handling

```typescript
async search(query: string) {
  try {
    const response = await fetch(`https://api.example.com/search?q=${query}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${this.id}] Search failed:`, error);
    return { tracks: [], artists: [], albums: [] };
  }
}
```

## Next Steps

- [Provider Types](./providers.md) - All available plugin roles
- [Sandbox & Security](./sandbox.md) - Understanding capabilities
