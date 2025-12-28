# Plugin Types Reference

This document covers the API for each plugin type in detail.

## BaseMetadataProvider

Metadata providers fetch track, album, and artist information from external sources.

### Required Properties

```typescript
readonly id: string;       // Unique identifier
readonly name: string;     // Display name
readonly priority: number; // 0-100, higher = preferred
```

### Required Methods

```typescript
search(query: string, options?: MetadataSearchOptions): Promise<MetadataSearchResult>
getTrack(id: string): Promise<MetadataTrack | null>
getArtist(id: string): Promise<ArtistDetail | null>
getAlbum(id: string): Promise<Album & { tracks: MetadataTrack[] } | null>
```

### Types

```typescript
interface MetadataSearchOptions {
  limit?: number;   // Default: 25
  offset?: number;  // For pagination
}

interface MetadataSearchResult {
  tracks: MetadataTrack[];
  artists: Artist[];
  albums: Album[];
}

interface MetadataTrack {
  id: string;
  title: string;
  artists: Artist[];
  duration?: number;      // In seconds
  album?: Album;
  artwork?: ArtworkSet;
  explicit?: boolean;
  externalIds?: ExternalIds;
  _provider: string;      // Your plugin ID
}

interface Artist {
  id: string;
  name: string;
  artwork?: ArtworkSet;
}

interface Album {
  id: string;
  title: string;
  artwork?: ArtworkSet;
  releaseDate?: string;
  trackCount?: number;
  artists?: Artist[];
}

interface ArtworkSet {
  small?: string;    // ~100px
  medium?: string;   // ~300px
  large?: string;    // ~600px
  original?: string; // Full resolution
}

interface ArtistDetail extends Artist {
  followers?: number;
  topTracks: MetadataTrack[];
  albums: Album[];
  singles: Album[];
  eps: Album[];
  compilations: Album[];
  appearsOn: Album[];
  similarArtists: Artist[];
}
```

---

## BaseStreamProvider

Stream providers resolve playable audio URLs for tracks.

### Required Properties

```typescript
readonly id: string;
readonly name: string;
readonly priority: number;
```

### Required Methods

```typescript
search(query: string, options?: StreamSearchOptions): Promise<StreamTrack[]>
getTrack(id: string): Promise<StreamTrack | null>
resolveStream(track: StreamTrack): Promise<StreamInfo | null>
matchTrack(title: string, artist: string, album?: string, duration?: number): Promise<StreamTrack | null>
```

### Types

```typescript
interface StreamTrack {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  thumbnail?: string;
  _provider: string;
}

interface StreamInfo {
  url: string;              // Primary stream URL
  format?: string;          // 'mp3', 'opus', 'aac', etc.
  quality?: 'low' | 'medium' | 'high' | 'lossless';
  bitrate?: number;         // kbps
  sources?: StreamSource[]; // Alternative quality sources
  expiresAt?: number;       // URL expiration timestamp
}

interface StreamSource {
  url: string;
  quality: string;
  bitrate?: number;
  codec?: string;
}
```

---

## BaseLyricsProvider

Lyrics providers fetch song lyrics, optionally with timestamps for synced lyrics.

### Required Properties

```typescript
readonly id: string;
readonly name: string;
readonly priority: number;
```

### Required Methods

```typescript
search(query: LyricsQuery, options?: LyricsSearchOptions): Promise<LyricsResult[]>
getLyrics(id: string): Promise<LyricsResult | null>
getBestMatch(query: LyricsQuery): Promise<LyricsResult | null>
```

### Types

```typescript
interface LyricsQuery {
  title: string;
  artist: string;
  album?: string;
  duration?: number;  // In seconds, helps matching
}

interface LyricsSearchOptions {
  limit?: number;
}

interface LyricsResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  lyrics: string;           // Plain text lyrics
  syncedLyrics?: LyricsLine[]; // Timed lyrics
  synced: boolean;          // Whether syncedLyrics is available
  _provider: string;
}

interface LyricsLine {
  startTime: number;  // Milliseconds
  endTime?: number;   // Milliseconds
  text: string;
}
```

---

## BaseAudioProcessor

Audio processors analyze or transform audio data.

### Required Properties

```typescript
readonly id: string;
readonly name: string;
readonly priority: number;
```

### Required Methods

```typescript
process(input: AudioProcessorInput): Promise<AudioProcessorResult>
getCapabilities(): string[]
```

### Types

```typescript
interface AudioProcessorInput {
  audioBuffer?: ArrayBuffer;
  audioPath?: string;
  trackId?: string;
  options?: Record<string, unknown>;
}

interface AudioProcessorResult {
  success: boolean;
  data?: unknown;
  outputPath?: string;
  error?: string;
}
```

---

## Common Base Class Methods

All base classes provide these methods:

```typescript
// Called when plugin is loaded
async initialize(): Promise<void>

// Called when plugin is unloaded
async dispose(): Promise<void>

// Get the plugin manifest
get manifest(): AddonManifest
```

You can override `initialize()` and `dispose()` to set up and clean up resources:

```typescript
export class MyProvider extends BaseMetadataProvider {
  private apiClient?: ApiClient;

  async initialize(): Promise<void> {
    await super.initialize();
    this.apiClient = new ApiClient();
  }

  async dispose(): Promise<void> {
    await this.apiClient?.close();
    await super.dispose();
  }
}
```
