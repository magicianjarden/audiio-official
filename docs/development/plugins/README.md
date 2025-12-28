# Plugin Development Guide

Audiio uses a plugin architecture that allows you to extend its functionality. This guide covers how to create and publish your own plugins.

## Overview

Plugins are npm packages that implement one or more provider interfaces. Audiio discovers and loads plugins dynamically at runtime.

## Plugin Types

| Role | Description | Base Class |
|------|-------------|------------|
| `metadata-provider` | Provides track, album, and artist metadata | `BaseMetadataProvider` |
| `stream-provider` | Resolves playable audio stream URLs | `BaseStreamProvider` |
| `lyrics-provider` | Fetches song lyrics (plain or synced) | `BaseLyricsProvider` |
| `audio-processor` | Processes audio (effects, analysis, etc.) | `BaseAudioProcessor` |

## Quick Start

### 1. Create a new package

```bash
mkdir my-audiio-plugin
cd my-audiio-plugin
npm init -y
npm install -D typescript @audiio/sdk
```

### 2. Configure package.json

```json
{
  "name": "my-audiio-plugin",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "audiio": {
    "type": "plugin",
    "id": "my-plugin",
    "roles": ["metadata-provider"]
  },
  "peerDependencies": {
    "@audiio/sdk": "^0.1.0"
  }
}
```

### 3. Implement your plugin

```typescript
import { BaseMetadataProvider, MetadataSearchResult } from '@audiio/sdk';

export class MyMetadataProvider extends BaseMetadataProvider {
  readonly id = 'my-plugin';
  readonly name = 'My Plugin';
  readonly priority = 50;

  async search(query: string): Promise<MetadataSearchResult> {
    // Implement your search logic
    return { tracks: [], artists: [], albums: [] };
  }

  async getTrack(id: string) {
    // Implement track fetching
    return null;
  }

  async getArtist(id: string) {
    return null;
  }

  async getAlbum(id: string) {
    return null;
  }
}

export default MyMetadataProvider;
```

### 4. Build and publish

```bash
npx tsc
npm publish
```

## Documentation

- [Getting Started](./getting-started.md) - Detailed setup guide
- [Plugin Types](./plugin-types.md) - Complete API reference for each provider type
- [Publishing](./publishing.md) - How to publish your plugin to npm
- [Examples](./examples.md) - Example plugin implementations

## Templates

The `@audiio/sdk` package includes templates in the `templates/` folder:

- `metadata-provider.ts` - Template for metadata providers
- `stream-provider.ts` - Template for stream providers
- `lyrics-provider.ts` - Template for lyrics providers

Copy these templates to your project as a starting point.
