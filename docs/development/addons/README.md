# Addon Development Overview

Build addons to extend Audiio with new music sources, features, and integrations.

## What Are Addons?

Addons are TypeScript/JavaScript packages that hook into Audiio's addon system. They can:

- Provide music metadata (tracks, artists, albums)
- Stream audio from various sources
- Display synced lyrics
- Process audio (karaoke, stems)
- Track listening history (scrobbling)

## Addon Roles

Each addon declares one or more roles:

| Role | Interface | Purpose |
|------|-----------|---------|
| `metadata-provider` | `MetadataProvider` | Track/artist/album info |
| `stream-provider` | `StreamProvider` | Audio stream URLs |
| `lyrics-provider` | `LyricsProvider` | Synced/plain lyrics |
| `audio-processor` | `AudioProcessor` | Audio processing |
| `scrobbler` | `Scrobbler` | Listening history |

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
import { BaseAddon, MetadataProvider, Track } from '@audiio/sdk';

export default class MyAddon extends BaseAddon implements MetadataProvider {
  static manifest = {
    id: 'my-addon',
    name: 'My Addon',
    version: '1.0.0',
    roles: ['metadata-provider'],
  };

  async searchTracks(query: string): Promise<Track[]> {
    // Your implementation
    return [];
  }

  async getTrack(id: string): Promise<Track | null> {
    return null;
  }
}
```

### 3. Build

```bash
npx tsc
```

### 4. Install in Audiio

1. Go to Settings > Addons
2. Click "Install from File"
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

## SDK Reference

### BaseAddon

All addons extend `BaseAddon`:

```typescript
import { BaseAddon } from '@audiio/sdk';

export default class MyAddon extends BaseAddon {
  static manifest = {
    id: 'unique-addon-id',
    name: 'Display Name',
    version: '1.0.0',
    description: 'What this addon does',
    author: 'Your Name',
    roles: ['metadata-provider'],
    settings: [
      {
        key: 'apiKey',
        type: 'string',
        label: 'API Key',
        required: true,
      },
    ],
  };

  async initialize(): Promise<void> {
    // Called when addon loads
  }

  async destroy(): Promise<void> {
    // Called when addon unloads
  }
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `version` | string | Yes | Semantic version |
| `description` | string | No | What it does |
| `author` | string | No | Developer name |
| `roles` | string[] | Yes | Addon roles |
| `settings` | Setting[] | No | User settings |
| `dependencies` | string[] | No | Required addons |

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

### Accessing Settings

```typescript
const apiKey = this.getSetting<string>('apiKey');
const quality = this.getSetting<string>('quality');
```

## Core Types

### Track

```typescript
interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration: number;  // seconds
  artwork?: string;  // URL
  isrc?: string;
  explicit?: boolean;
}
```

### Artist

```typescript
interface Artist {
  id: string;
  name: string;
  image?: string;
  genres?: string[];
  bio?: string;
}
```

### Album

```typescript
interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork?: string;
  releaseDate?: string;
  tracks?: Track[];
  trackCount?: number;
}
```

### Lyrics

```typescript
interface Lyrics {
  trackId: string;
  plain?: string;
  synced?: SyncedLine[];
  source?: string;
}

interface SyncedLine {
  time: number;  // milliseconds
  text: string;
}
```

## Helper Methods

BaseAddon provides helper methods:

```typescript
// HTTP requests
const data = await this.fetch('https://api.example.com/data');

// Caching
await this.cache.set('key', value, ttl);
const cached = await this.cache.get('key');

// Logging
this.log.info('Message');
this.log.error('Error', error);
this.log.debug('Debug info');

// Events
this.emit('custom-event', data);
```

## Project Structure

Recommended structure:

```
my-addon/
├── src/
│   ├── index.ts        # Main addon class
│   ├── api.ts          # API client
│   └── types.ts        # Type definitions
├── package.json
├── tsconfig.json
└── README.md
```

### package.json

```json
{
  "name": "my-audiio-addon",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "audiio": {
    "addon": true
  },
  "dependencies": {
    "@audiio/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### tsconfig.json

```json
{
  "extends": "@audiio/sdk/tsconfig.addon.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## Testing

### Local Testing

1. Build your addon
2. Link locally: `npm link`
3. In Audiio dev: `npm link my-addon`
4. Test in development mode

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import MyAddon from './index';

describe('MyAddon', () => {
  const addon = new MyAddon();

  it('searches tracks', async () => {
    const tracks = await addon.searchTracks('test');
    expect(tracks).toBeInstanceOf(Array);
  });
});
```

## Publishing

### To Addon Gallery

1. Build your addon
2. Create GitHub release
3. Submit to gallery
4. Await review

### Self-Distribution

1. Build: `npm run build`
2. Package: `npm pack`
3. Distribute the `.tgz` file
4. Users install via file

## Best Practices

### Performance

- Cache API responses
- Implement pagination
- Use streaming for large data
- Handle rate limits

### Error Handling

```typescript
async searchTracks(query: string): Promise<Track[]> {
  try {
    const data = await this.fetch(`/search?q=${query}`);
    return this.parseResults(data);
  } catch (error) {
    this.log.error('Search failed', error);
    return [];
  }
}
```

### User Experience

- Provide meaningful error messages
- Show loading states
- Handle offline gracefully
- Document required settings

## Examples

### Built-in Addons

Study the built-in addons:

- `addons/deezer-metadata/` - Metadata provider
- `addons/youtube-music/` - Stream provider
- `addons/lrclib-lyrics/` - Lyrics provider
- `addons/karaoke/` - Audio processor

## Getting Help

- Check existing addon code
- Review SDK documentation
- Open GitHub issues
- Join developer community

## Next Steps

- [Tutorial](tutorial.md) - Build your first addon
- [SDK Reference](../../sdk/README.md) - Complete API docs
- [Architecture](../architecture.md) - System overview

