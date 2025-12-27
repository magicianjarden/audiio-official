# Metadata Provider

Build addons that provide track, artist, and album metadata.

## Overview

Metadata providers supply information about music:

- Track details (title, artist, duration, artwork)
- Artist information (name, bio, images)
- Album details (title, tracks, release date)
- Search functionality

## Interface

```typescript
interface MetadataProvider {
  // Search
  searchTracks(query: string, options?: SearchOptions): Promise<Track[]>;
  searchArtists(query: string, options?: SearchOptions): Promise<Artist[]>;
  searchAlbums(query: string, options?: SearchOptions): Promise<Album[]>;

  // Get by ID
  getTrack(id: string): Promise<Track | null>;
  getArtist(id: string): Promise<Artist | null>;
  getAlbum(id: string): Promise<Album | null>;

  // Optional methods
  getArtistTopTracks?(artistId: string): Promise<Track[]>;
  getArtistAlbums?(artistId: string): Promise<Album[]>;
  getSimilarTracks?(trackId: string): Promise<Track[]>;
  getSimilarArtists?(artistId: string): Promise<Artist[]>;
}
```

## Basic Implementation

```typescript
import { BaseAddon, MetadataProvider, Track, Artist, Album } from '@audiio/sdk';

export default class MyMetadataProvider extends BaseAddon implements MetadataProvider {
  static manifest = {
    id: 'my-metadata',
    name: 'My Metadata Provider',
    version: '1.0.0',
    roles: ['metadata-provider'],
  };

  async searchTracks(query: string): Promise<Track[]> {
    const response = await this.fetch(`/api/search/tracks?q=${encodeURIComponent(query)}`);
    return response.tracks.map(this.mapTrack);
  }

  async searchArtists(query: string): Promise<Artist[]> {
    const response = await this.fetch(`/api/search/artists?q=${encodeURIComponent(query)}`);
    return response.artists.map(this.mapArtist);
  }

  async searchAlbums(query: string): Promise<Album[]> {
    const response = await this.fetch(`/api/search/albums?q=${encodeURIComponent(query)}`);
    return response.albums.map(this.mapAlbum);
  }

  async getTrack(id: string): Promise<Track | null> {
    try {
      const response = await this.fetch(`/api/tracks/${id}`);
      return this.mapTrack(response);
    } catch {
      return null;
    }
  }

  async getArtist(id: string): Promise<Artist | null> {
    try {
      const response = await this.fetch(`/api/artists/${id}`);
      return this.mapArtist(response);
    } catch {
      return null;
    }
  }

  async getAlbum(id: string): Promise<Album | null> {
    try {
      const response = await this.fetch(`/api/albums/${id}`);
      return this.mapAlbum(response);
    } catch {
      return null;
    }
  }

  // Map API response to Track type
  private mapTrack(data: any): Track {
    return {
      id: `myprovider:${data.id}`,
      title: data.title,
      artist: data.artist_name,
      artistId: `myprovider:${data.artist_id}`,
      album: data.album_name,
      albumId: `myprovider:${data.album_id}`,
      duration: data.duration_seconds,
      artwork: data.cover_url,
      isrc: data.isrc,
      explicit: data.is_explicit,
    };
  }

  private mapArtist(data: any): Artist {
    return {
      id: `myprovider:${data.id}`,
      name: data.name,
      image: data.picture_url,
      genres: data.genres,
      bio: data.biography,
    };
  }

  private mapAlbum(data: any): Album {
    return {
      id: `myprovider:${data.id}`,
      title: data.title,
      artist: data.artist_name,
      artistId: `myprovider:${data.artist_id}`,
      artwork: data.cover_url,
      releaseDate: data.release_date,
      trackCount: data.track_count,
    };
  }
}
```

## Core Types

### Track

```typescript
interface Track {
  // Required
  id: string;           // Unique identifier (prefix with provider name)
  title: string;        // Track title
  artist: string;       // Primary artist name
  duration: number;     // Duration in seconds

  // Optional
  artistId?: string;    // Artist ID for linking
  album?: string;       // Album name
  albumId?: string;     // Album ID for linking
  artwork?: string;     // Album art URL
  trackNumber?: number; // Position on album
  discNumber?: number;  // Disc number
  isrc?: string;        // International Standard Recording Code
  explicit?: boolean;   // Contains explicit content
  genres?: string[];    // Genre tags
  releaseDate?: string; // ISO date string
  previewUrl?: string;  // Short preview audio URL
}
```

### Artist

```typescript
interface Artist {
  // Required
  id: string;           // Unique identifier
  name: string;         // Artist name

  // Optional
  image?: string;       // Artist image URL
  genres?: string[];    // Associated genres
  bio?: string;         // Biography text
  followers?: number;   // Follower count
  verified?: boolean;   // Verified artist
  links?: {             // External links
    spotify?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };
}
```

### Album

```typescript
interface Album {
  // Required
  id: string;           // Unique identifier
  title: string;        // Album title
  artist: string;       // Primary artist name

  // Optional
  artistId?: string;    // Artist ID for linking
  artwork?: string;     // Album art URL
  releaseDate?: string; // ISO date string
  trackCount?: number;  // Number of tracks
  tracks?: Track[];     // Full track list
  genres?: string[];    // Genre tags
  label?: string;       // Record label
  type?: 'album' | 'single' | 'ep' | 'compilation';
  explicit?: boolean;   // Contains explicit content
}
```

## Search Options

```typescript
interface SearchOptions {
  limit?: number;       // Max results (default: 25)
  offset?: number;      // For pagination
  market?: string;      // Country code (ISO 3166-1)
  explicit?: boolean;   // Include explicit content
}
```

Usage:

```typescript
async searchTracks(query: string, options?: SearchOptions): Promise<Track[]> {
  const limit = options?.limit ?? 25;
  const offset = options?.offset ?? 0;
  const market = options?.market ?? 'US';

  const response = await this.fetch(
    `/search?q=${query}&limit=${limit}&offset=${offset}&market=${market}`
  );

  return response.tracks.map(this.mapTrack);
}
```

## Caching Strategy

Cache responses to improve performance:

```typescript
async searchTracks(query: string, options?: SearchOptions): Promise<Track[]> {
  const cacheKey = `search:${query}:${JSON.stringify(options)}`;

  // Check cache (5 minute TTL)
  const cached = await this.cache.get<Track[]>(cacheKey);
  if (cached) {
    this.log.debug('Cache hit for search');
    return cached;
  }

  const tracks = await this.fetchTracks(query, options);

  // Cache results
  await this.cache.set(cacheKey, tracks, 300);

  return tracks;
}
```

### Cache TTL Guidelines

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Search results | 5 min | Can change frequently |
| Track details | 1 hour | Mostly static |
| Artist info | 1 day | Rarely changes |
| Album info | 1 day | Rarely changes |
| Artwork | 1 week | Static content |

## Error Handling

```typescript
async getTrack(id: string): Promise<Track | null> {
  try {
    const response = await this.fetch(`/tracks/${id}`);
    return this.mapTrack(response);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 404) {
        return null; // Not found is expected
      }
      if (error.status === 429) {
        this.log.warn('Rate limited');
        throw new RetryableError('Rate limited', 1000);
      }
    }
    this.log.error('Failed to get track', error);
    throw error;
  }
}
```

## Pagination

For large result sets:

```typescript
async searchTracks(query: string, options?: SearchOptions): Promise<Track[]> {
  const allTracks: Track[] = [];
  const limit = options?.limit ?? 25;
  let offset = options?.offset ?? 0;
  let hasMore = true;

  while (hasMore && allTracks.length < limit) {
    const response = await this.fetch(
      `/search?q=${query}&limit=50&offset=${offset}`
    );

    allTracks.push(...response.tracks.map(this.mapTrack));

    hasMore = response.tracks.length === 50;
    offset += 50;
  }

  return allTracks.slice(0, limit);
}
```

## ID Namespacing

Always prefix IDs with your provider name:

```typescript
// Good - namespaced IDs
{
  id: 'myprovider:12345',
  artistId: 'myprovider:artist-789',
}

// Bad - collisions with other providers
{
  id: '12345',
  artistId: '789',
}
```

## Optional Methods

### Artist Top Tracks

```typescript
async getArtistTopTracks(artistId: string): Promise<Track[]> {
  const id = artistId.replace('myprovider:', '');
  const response = await this.fetch(`/artists/${id}/top-tracks`);
  return response.tracks.map(this.mapTrack);
}
```

### Similar Artists

```typescript
async getSimilarArtists(artistId: string): Promise<Artist[]> {
  const id = artistId.replace('myprovider:', '');
  const response = await this.fetch(`/artists/${id}/similar`);
  return response.artists.map(this.mapArtist);
}
```

### Album Tracks

```typescript
async getAlbumTracks(albumId: string): Promise<Track[]> {
  const id = albumId.replace('myprovider:', '');
  const response = await this.fetch(`/albums/${id}/tracks`);
  return response.tracks.map(this.mapTrack);
}
```

## Settings

Common settings for metadata providers:

```typescript
static manifest = {
  // ...
  settings: [
    {
      key: 'apiKey',
      type: 'string',
      label: 'API Key',
      description: 'Your API key from the service',
      required: true,
      secret: true,
    },
    {
      key: 'market',
      type: 'select',
      label: 'Default Market',
      options: [
        { value: 'US', label: 'United States' },
        { value: 'GB', label: 'United Kingdom' },
        { value: 'DE', label: 'Germany' },
      ],
      default: 'US',
    },
    {
      key: 'includeExplicit',
      type: 'boolean',
      label: 'Include Explicit Content',
      default: true,
    },
  ],
};
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import MyMetadataProvider from './index';

describe('MyMetadataProvider', () => {
  const provider = new MyMetadataProvider();

  describe('searchTracks', () => {
    it('returns tracks for valid query', async () => {
      const tracks = await provider.searchTracks('hello');

      expect(tracks).toBeInstanceOf(Array);
      expect(tracks.length).toBeGreaterThan(0);

      // Verify track structure
      const track = tracks[0];
      expect(track.id).toMatch(/^myprovider:/);
      expect(track.title).toBeDefined();
      expect(track.artist).toBeDefined();
      expect(track.duration).toBeGreaterThan(0);
    });

    it('returns empty for no results', async () => {
      const tracks = await provider.searchTracks('xyznonexistent123');
      expect(tracks).toEqual([]);
    });
  });

  describe('getTrack', () => {
    it('returns null for invalid ID', async () => {
      const track = await provider.getTrack('myprovider:invalid');
      expect(track).toBeNull();
    });
  });
});
```

## Best Practices

### 1. Consistent IDs

Always use the same ID format:

```typescript
private formatId(rawId: string | number): string {
  return `myprovider:${rawId}`;
}

private parseId(formattedId: string): string {
  return formattedId.replace('myprovider:', '');
}
```

### 2. Graceful Degradation

Return empty arrays instead of throwing:

```typescript
async searchTracks(query: string): Promise<Track[]> {
  try {
    return await this.fetchTracks(query);
  } catch (error) {
    this.log.error('Search failed', error);
    return []; // Don't break the UI
  }
}
```

### 3. Normalize Data

Handle inconsistent API responses:

```typescript
private mapTrack(data: any): Track {
  return {
    id: this.formatId(data.id),
    title: data.title?.trim() || 'Unknown',
    artist: data.artist?.name || data.artist_name || 'Unknown Artist',
    duration: Math.floor(Number(data.duration) || 0),
    artwork: this.normalizeArtwork(data.cover),
  };
}

private normalizeArtwork(url?: string): string | undefined {
  if (!url) return undefined;
  // Upgrade to high-res if possible
  return url.replace('/small/', '/large/');
}
```

## Related

- [Tutorial](tutorial.md) - Build first addon
- [Stream Provider](stream-provider.md) - Provide audio
- [SDK Reference](../../sdk/README.md) - Full API

