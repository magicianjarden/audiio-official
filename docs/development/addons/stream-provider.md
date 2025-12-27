# Stream Provider

Build addons that provide audio streams for playback.

## Overview

Stream providers supply audio URLs for tracks. When a user plays a track, Audiio calls stream providers to get the playable audio URL.

## Interface

```typescript
interface StreamProvider {
  // Get audio stream URL for a track
  getStream(track: Track): Promise<StreamResult | null>;

  // Check if provider can handle a track
  canHandle?(track: Track): boolean;

  // Get available quality options
  getQualities?(): StreamQuality[];
}

interface StreamResult {
  url: string;                    // Audio URL
  format: 'mp3' | 'aac' | 'opus' | 'flac' | 'webm';
  quality?: StreamQuality;
  duration?: number;              // Actual duration
  headers?: Record<string, string>; // Custom headers for request
  expiresAt?: number;             // URL expiration timestamp
}

interface StreamQuality {
  id: string;
  label: string;                  // e.g., "High (320kbps)"
  bitrate: number;                // kbps
}
```

## Basic Implementation

```typescript
import { BaseAddon, StreamProvider, StreamResult, Track } from '@audiio/sdk';

export default class MyStreamProvider extends BaseAddon implements StreamProvider {
  static manifest = {
    id: 'my-streams',
    name: 'My Stream Provider',
    version: '1.0.0',
    roles: ['stream-provider'],
    settings: [
      {
        key: 'quality',
        type: 'select',
        label: 'Audio Quality',
        options: [
          { value: 'low', label: 'Low (128kbps)' },
          { value: 'medium', label: 'Medium (192kbps)' },
          { value: 'high', label: 'High (320kbps)' },
        ],
        default: 'high',
      },
    ],
  };

  async getStream(track: Track): Promise<StreamResult | null> {
    // Match track to our source
    const streamId = await this.findTrack(track);
    if (!streamId) {
      this.log.debug(`No match found for: ${track.title}`);
      return null;
    }

    // Get stream URL
    const quality = this.getSetting<string>('quality') || 'high';
    const streamUrl = await this.fetchStreamUrl(streamId, quality);

    return {
      url: streamUrl.url,
      format: 'mp3',
      quality: {
        id: quality,
        label: this.getQualityLabel(quality),
        bitrate: this.getQualityBitrate(quality),
      },
      expiresAt: streamUrl.expires,
    };
  }

  private async findTrack(track: Track): Promise<string | null> {
    // Search for matching track
    const query = `${track.artist} ${track.title}`;
    const response = await this.fetch(`/search?q=${encodeURIComponent(query)}`);

    // Find best match
    for (const result of response.results) {
      if (this.isMatch(track, result)) {
        return result.id;
      }
    }

    return null;
  }

  private isMatch(track: Track, result: any): boolean {
    const titleMatch = this.normalize(track.title) === this.normalize(result.title);
    const artistMatch = this.normalize(track.artist).includes(this.normalize(result.artist));
    const durationMatch = Math.abs(track.duration - result.duration) < 5;

    return titleMatch && artistMatch && durationMatch;
  }

  private normalize(str: string): string {
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async fetchStreamUrl(id: string, quality: string): Promise<{ url: string; expires: number }> {
    const response = await this.fetch(`/stream/${id}?quality=${quality}`);
    return {
      url: response.url,
      expires: Date.now() + response.expires_in * 1000,
    };
  }

  private getQualityLabel(quality: string): string {
    const labels: Record<string, string> = {
      low: 'Low (128kbps)',
      medium: 'Medium (192kbps)',
      high: 'High (320kbps)',
    };
    return labels[quality] || quality;
  }

  private getQualityBitrate(quality: string): number {
    const bitrates: Record<string, number> = {
      low: 128,
      medium: 192,
      high: 320,
    };
    return bitrates[quality] || 192;
  }
}
```

## Track Matching

Critical for stream providers - finding the right audio for a track.

### Matching Strategy

```typescript
async findTrack(track: Track): Promise<string | null> {
  // Strategy 1: Match by ISRC (most accurate)
  if (track.isrc) {
    const byIsrc = await this.searchByIsrc(track.isrc);
    if (byIsrc) return byIsrc;
  }

  // Strategy 2: Match by exact title + artist
  const exact = await this.searchExact(track.title, track.artist);
  if (exact) return exact;

  // Strategy 3: Fuzzy search with scoring
  const fuzzy = await this.searchFuzzy(track);
  if (fuzzy && fuzzy.score > 0.9) return fuzzy.id;

  return null;
}
```

### Fuzzy Matching

```typescript
interface MatchResult {
  id: string;
  score: number;
}

private async searchFuzzy(track: Track): Promise<MatchResult | null> {
  const query = `${track.artist} ${track.title}`;
  const results = await this.fetch(`/search?q=${encodeURIComponent(query)}`);

  let bestMatch: MatchResult | null = null;

  for (const result of results) {
    const score = this.calculateScore(track, result);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { id: result.id, score };
    }
  }

  return bestMatch;
}

private calculateScore(track: Track, result: any): number {
  let score = 0;

  // Title similarity (0-0.4)
  score += this.stringSimilarity(track.title, result.title) * 0.4;

  // Artist similarity (0-0.3)
  score += this.stringSimilarity(track.artist, result.artist) * 0.3;

  // Duration match (0-0.2)
  const durationDiff = Math.abs(track.duration - result.duration);
  score += Math.max(0, (1 - durationDiff / 10)) * 0.2;

  // Album match bonus (0-0.1)
  if (track.album && result.album) {
    score += this.stringSimilarity(track.album, result.album) * 0.1;
  }

  return score;
}

private stringSimilarity(a: string, b: string): number {
  const na = this.normalize(a);
  const nb = this.normalize(b);

  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  // Levenshtein distance ratio
  const maxLen = Math.max(na.length, nb.length);
  const distance = this.levenshtein(na, nb);
  return 1 - distance / maxLen;
}
```

## Quality Options

```typescript
getQualities(): StreamQuality[] {
  return [
    { id: 'low', label: 'Low (128 kbps)', bitrate: 128 },
    { id: 'medium', label: 'Medium (192 kbps)', bitrate: 192 },
    { id: 'high', label: 'High (320 kbps)', bitrate: 320 },
    { id: 'lossless', label: 'Lossless (FLAC)', bitrate: 1411 },
  ];
}
```

## Handling Stream Expiration

Many services provide temporary URLs:

```typescript
async getStream(track: Track): Promise<StreamResult | null> {
  const streamId = await this.findTrack(track);
  if (!streamId) return null;

  // Check cache for valid stream
  const cacheKey = `stream:${streamId}`;
  const cached = await this.cache.get<StreamResult>(cacheKey);

  if (cached && cached.expiresAt && cached.expiresAt > Date.now() + 60000) {
    // Valid for at least 1 more minute
    return cached;
  }

  // Get fresh stream URL
  const stream = await this.fetchFreshStream(streamId);

  // Cache until expiration (minus buffer)
  if (stream.expiresAt) {
    const ttl = Math.floor((stream.expiresAt - Date.now()) / 1000) - 60;
    if (ttl > 0) {
      await this.cache.set(cacheKey, stream, ttl);
    }
  }

  return stream;
}
```

## Custom Headers

Some sources require authentication headers:

```typescript
async getStream(track: Track): Promise<StreamResult | null> {
  const streamUrl = await this.getStreamUrl(track);

  return {
    url: streamUrl,
    format: 'mp3',
    headers: {
      'Authorization': `Bearer ${this.getAccessToken()}`,
      'X-Custom-Header': 'value',
    },
  };
}
```

## Fallback Providers

Chain multiple sources:

```typescript
async getStream(track: Track): Promise<StreamResult | null> {
  // Try primary source
  const primary = await this.tryPrimarySource(track);
  if (primary) return primary;

  // Try secondary source
  const secondary = await this.trySecondarySource(track);
  if (secondary) return secondary;

  // Try fallback
  const fallback = await this.tryFallbackSource(track);
  return fallback;
}
```

## Error Handling

```typescript
async getStream(track: Track): Promise<StreamResult | null> {
  try {
    const streamId = await this.findTrack(track);
    if (!streamId) return null;

    const stream = await this.fetchStream(streamId);

    // Validate stream URL
    if (!this.isValidUrl(stream.url)) {
      this.log.warn('Invalid stream URL returned');
      return null;
    }

    return stream;
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 403) {
        this.log.warn('Stream access denied - may need re-auth');
        // Trigger re-authentication flow
      }
      if (error.status === 451) {
        this.log.warn('Content not available in region');
      }
    }

    this.log.error('Failed to get stream', error);
    return null;
  }
}
```

## Prefetching

Improve playback experience:

```typescript
async getStream(track: Track): Promise<StreamResult | null> {
  const stream = await this.fetchStream(track);

  // Prefetch next track in background
  this.prefetchNext();

  return stream;
}

private async prefetchNext(): Promise<void> {
  const queue = await this.getQueue();
  if (queue.length < 2) return;

  const nextTrack = queue[1];
  const cacheKey = `stream:${nextTrack.id}`;

  // Check if already cached
  if (await this.cache.has(cacheKey)) return;

  // Prefetch in background
  this.findTrack(nextTrack).then(async (streamId) => {
    if (streamId) {
      const stream = await this.fetchStream(streamId);
      await this.cache.set(cacheKey, stream, 300);
    }
  }).catch(() => {
    // Ignore prefetch errors
  });
}
```

## Settings

```typescript
static manifest = {
  // ...
  settings: [
    {
      key: 'quality',
      type: 'select',
      label: 'Preferred Quality',
      options: [
        { value: 'auto', label: 'Auto (based on network)' },
        { value: 'low', label: 'Low (save data)' },
        { value: 'high', label: 'High (best quality)' },
      ],
      default: 'auto',
    },
    {
      key: 'fallbackEnabled',
      type: 'boolean',
      label: 'Enable Fallback Sources',
      description: 'Try alternative sources if primary fails',
      default: true,
    },
  ],
};
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import MyStreamProvider from './index';

describe('MyStreamProvider', () => {
  const provider = new MyStreamProvider();

  describe('getStream', () => {
    it('returns stream for known track', async () => {
      const track = {
        id: 'test:1',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        duration: 234,
      };

      const stream = await provider.getStream(track);

      expect(stream).not.toBeNull();
      expect(stream?.url).toMatch(/^https?:\/\//);
      expect(stream?.format).toBeDefined();
    });

    it('returns null for unknown track', async () => {
      const track = {
        id: 'test:999',
        title: 'Nonexistent Song XYZ',
        artist: 'Unknown Artist ABC',
        duration: 100,
      };

      const stream = await provider.getStream(track);
      expect(stream).toBeNull();
    });

    it('includes quality information', async () => {
      const track = {
        id: 'test:1',
        title: 'Hello',
        artist: 'Adele',
        duration: 295,
      };

      const stream = await provider.getStream(track);

      if (stream) {
        expect(stream.quality).toBeDefined();
        expect(stream.quality?.bitrate).toBeGreaterThan(0);
      }
    });
  });
});
```

## Best Practices

### 1. Accurate Matching

Incorrect matches are worse than no match:

```typescript
// Return null if confidence is low
if (matchScore < 0.85) {
  return null;
}
```

### 2. Respect Rate Limits

```typescript
private rateLimiter = new RateLimiter(10, 1000); // 10 req/sec

async getStream(track: Track): Promise<StreamResult | null> {
  await this.rateLimiter.acquire();
  return this.fetchStream(track);
}
```

### 3. Cache Aggressively

Stream URLs are expensive to generate:

```typescript
// Cache for as long as the URL is valid
const ttl = Math.min(expiresIn, 3600); // Max 1 hour
await this.cache.set(key, stream, ttl);
```

### 4. Handle Geographic Restrictions

```typescript
async getStream(track: Track): Promise<StreamResult | null> {
  try {
    return await this.fetchStream(track);
  } catch (error) {
    if (this.isGeoRestricted(error)) {
      this.log.info('Track not available in this region');
      return null;
    }
    throw error;
  }
}
```

## Related

- [Metadata Provider](metadata-provider.md) - Provide track info
- [Lyrics Provider](lyrics-provider.md) - Provide lyrics
- [SDK Reference](../../sdk/README.md) - Full API

