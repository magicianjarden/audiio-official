# Lyrics Provider

Build addons that provide synced or plain lyrics for tracks.

## Overview

Lyrics providers supply song lyrics. They can provide:

- **Synced lyrics** - Time-stamped lines that highlight during playback
- **Plain lyrics** - Full text without timing
- **Translations** - Lyrics in other languages

## Interface

```typescript
interface LyricsProvider {
  // Get lyrics for a track
  getLyrics(track: Track): Promise<Lyrics | null>;

  // Optional: Search for lyrics
  searchLyrics?(query: string): Promise<LyricsSearchResult[]>;

  // Optional: Check if provider likely has lyrics
  hasLyrics?(track: Track): Promise<boolean>;
}

interface Lyrics {
  trackId: string;
  plain?: string;           // Full lyrics text
  synced?: SyncedLine[];    // Time-synced lines
  source?: string;          // Attribution
  language?: string;        // ISO language code
  translation?: {
    text: string;
    language: string;
  };
}

interface SyncedLine {
  time: number;             // Milliseconds from start
  text: string;             // Lyric line
  endTime?: number;         // Optional end time
}

interface LyricsSearchResult {
  id: string;
  title: string;
  artist: string;
  hasSynced: boolean;
  source: string;
}
```

## Basic Implementation

```typescript
import { BaseAddon, LyricsProvider, Lyrics, Track, SyncedLine } from '@audiio/sdk';

export default class MyLyricsProvider extends BaseAddon implements LyricsProvider {
  static manifest = {
    id: 'my-lyrics',
    name: 'My Lyrics Provider',
    version: '1.0.0',
    roles: ['lyrics-provider'],
  };

  async getLyrics(track: Track): Promise<Lyrics | null> {
    // Try to find matching lyrics
    const result = await this.searchLyrics(track);
    if (!result) return null;

    // Fetch full lyrics
    const lyrics = await this.fetchLyrics(result.id);

    return {
      trackId: track.id,
      plain: lyrics.plainText,
      synced: lyrics.synced ? this.parseSyncedLyrics(lyrics.lrc) : undefined,
      source: 'MyLyricsProvider',
      language: lyrics.language,
    };
  }

  private async searchLyrics(track: Track): Promise<{ id: string } | null> {
    const query = `${track.artist} ${track.title}`;
    const results = await this.fetch(`/search?q=${encodeURIComponent(query)}`);

    // Find best match
    for (const result of results) {
      if (this.isMatch(track, result)) {
        return { id: result.id };
      }
    }

    return null;
  }

  private isMatch(track: Track, result: any): boolean {
    const titleMatch = this.normalize(track.title) === this.normalize(result.title);
    const artistMatch = this.normalize(track.artist) === this.normalize(result.artist);
    return titleMatch && artistMatch;
  }

  private normalize(str: string): string {
    return str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  }

  private async fetchLyrics(id: string): Promise<any> {
    return this.fetch(`/lyrics/${id}`);
  }

  private parseSyncedLyrics(lrc: string): SyncedLine[] {
    const lines: SyncedLine[] = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;

    let match;
    while ((match = regex.exec(lrc)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = parseInt(match[3].padEnd(3, '0'), 10);

      lines.push({
        time: minutes * 60000 + seconds * 1000 + ms,
        text: match[4].trim(),
      });
    }

    return lines.sort((a, b) => a.time - b.time);
  }
}
```

## LRC Format

Standard synced lyrics format:

```
[00:12.34] First line of lyrics
[00:17.89] Second line of lyrics
[00:22.45] Third line of lyrics
```

### Parsing LRC

```typescript
function parseLRC(lrc: string): SyncedLine[] {
  const lines: SyncedLine[] = [];

  for (const line of lrc.split('\n')) {
    // Match timestamp pattern: [mm:ss.xx] or [mm:ss:xx]
    const match = line.match(/^\[(\d+):(\d+)[.:](\d+)\]\s*(.*)$/);
    if (!match) continue;

    const [, min, sec, ms, text] = match;
    const time =
      parseInt(min) * 60000 +
      parseInt(sec) * 1000 +
      parseInt(ms.padEnd(3, '0'));

    if (text.trim()) {
      lines.push({ time, text: text.trim() });
    }
  }

  return lines;
}
```

### Generating LRC

```typescript
function generateLRC(lines: SyncedLine[]): string {
  return lines.map(line => {
    const min = Math.floor(line.time / 60000);
    const sec = Math.floor((line.time % 60000) / 1000);
    const ms = line.time % 1000;

    const timestamp = `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0').slice(0, 2)}]`;
    return `${timestamp} ${line.text}`;
  }).join('\n');
}
```

## Enhanced Line Timing

For karaoke-style word-by-word highlighting:

```typescript
interface EnhancedLine {
  time: number;
  endTime: number;
  text: string;
  words?: {
    text: string;
    startTime: number;
    endTime: number;
  }[];
}
```

Implementation:

```typescript
private parseEnhancedLyrics(data: any): SyncedLine[] {
  return data.lines.map((line: any) => ({
    time: line.startTimeMs,
    endTime: line.endTimeMs,
    text: line.words.map((w: any) => w.text).join(' '),
    words: line.words.map((w: any) => ({
      text: w.text,
      startTime: w.startTimeMs,
      endTime: w.endTimeMs,
    })),
  }));
}
```

## Matching Strategies

### By ISRC

Most accurate when available:

```typescript
async getLyrics(track: Track): Promise<Lyrics | null> {
  if (track.isrc) {
    const lyrics = await this.fetchByIsrc(track.isrc);
    if (lyrics) return lyrics;
  }

  // Fall back to search
  return this.searchAndFetch(track);
}
```

### By Duration

Use duration to disambiguate matches:

```typescript
private findBestMatch(track: Track, results: any[]): any | null {
  // Filter by duration tolerance (5 seconds)
  const durationMatches = results.filter(r =>
    Math.abs(r.duration - track.duration) < 5
  );

  if (durationMatches.length === 1) {
    return durationMatches[0];
  }

  // If multiple, score by title/artist match
  return this.scoreBestMatch(track, durationMatches);
}
```

## Caching

```typescript
async getLyrics(track: Track): Promise<Lyrics | null> {
  const cacheKey = `lyrics:${track.id}`;

  // Check cache
  const cached = await this.cache.get<Lyrics>(cacheKey);
  if (cached) return cached;

  // Fetch fresh
  const lyrics = await this.fetchLyrics(track);

  if (lyrics) {
    // Cache for 1 week (lyrics rarely change)
    await this.cache.set(cacheKey, lyrics, 604800);
  }

  return lyrics;
}
```

## Translations

```typescript
interface Lyrics {
  // ... other fields
  translation?: {
    text: string;
    language: string;
    synced?: SyncedLine[];
  };
}

async getLyricsWithTranslation(track: Track, targetLang: string): Promise<Lyrics | null> {
  const lyrics = await this.getLyrics(track);
  if (!lyrics) return null;

  // Check if translation available
  const translation = await this.fetchTranslation(track, targetLang);

  if (translation) {
    return {
      ...lyrics,
      translation: {
        text: translation.text,
        language: targetLang,
        synced: translation.synced,
      },
    };
  }

  return lyrics;
}
```

## Error Handling

```typescript
async getLyrics(track: Track): Promise<Lyrics | null> {
  try {
    return await this.fetchLyrics(track);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 404) {
        // No lyrics found - expected
        return null;
      }
      if (error.status === 429) {
        this.log.warn('Rate limited');
        // Maybe retry after delay
      }
    }

    this.log.error('Failed to fetch lyrics', error);
    return null;
  }
}
```

## Optional: Search Interface

Allow users to manually search:

```typescript
async searchLyrics(query: string): Promise<LyricsSearchResult[]> {
  const response = await this.fetch(`/search?q=${encodeURIComponent(query)}`);

  return response.results.map((r: any) => ({
    id: r.id,
    title: r.track_name,
    artist: r.artist_name,
    hasSynced: r.has_synced_lyrics,
    source: this.manifest.name,
  }));
}
```

## Settings

```typescript
static manifest = {
  // ...
  settings: [
    {
      key: 'preferSynced',
      type: 'boolean',
      label: 'Prefer Synced Lyrics',
      description: 'Only return lyrics with timing data',
      default: false,
    },
    {
      key: 'includeRomanization',
      type: 'boolean',
      label: 'Include Romanization',
      description: 'Add romanized text for non-Latin scripts',
      default: true,
    },
  ],
};
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import MyLyricsProvider from './index';

describe('MyLyricsProvider', () => {
  const provider = new MyLyricsProvider();

  describe('getLyrics', () => {
    it('returns lyrics for known track', async () => {
      const track = {
        id: 'test:1',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        duration: 354,
      };

      const lyrics = await provider.getLyrics(track);

      expect(lyrics).not.toBeNull();
      expect(lyrics?.plain || lyrics?.synced).toBeDefined();
    });

    it('returns null for unknown track', async () => {
      const track = {
        id: 'test:999',
        title: 'Nonexistent Song',
        artist: 'Unknown Artist',
        duration: 100,
      };

      const lyrics = await provider.getLyrics(track);
      expect(lyrics).toBeNull();
    });

    it('returns synced lyrics when available', async () => {
      const track = {
        id: 'test:2',
        title: 'Yesterday',
        artist: 'The Beatles',
        duration: 125,
      };

      const lyrics = await provider.getLyrics(track);

      if (lyrics?.synced) {
        expect(lyrics.synced.length).toBeGreaterThan(0);
        expect(lyrics.synced[0]).toHaveProperty('time');
        expect(lyrics.synced[0]).toHaveProperty('text');
      }
    });
  });

  describe('parseLRC', () => {
    it('parses valid LRC format', () => {
      const lrc = `[00:12.34] First line
[00:17.89] Second line`;

      const lines = provider.parseSyncedLyrics(lrc);

      expect(lines).toHaveLength(2);
      expect(lines[0].time).toBe(12340);
      expect(lines[0].text).toBe('First line');
    });
  });
});
```

## Best Practices

### 1. Return Plain as Fallback

Always provide plain text if synced unavailable:

```typescript
return {
  trackId: track.id,
  plain: response.plainText,  // Always include if available
  synced: response.syncedLyrics ? parse(response.syncedLyrics) : undefined,
};
```

### 2. Normalize Search Queries

Handle variations:

```typescript
private normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .replace(/\(.*?\)/g, '')      // Remove parenthetical
    .replace(/\[.*?\]/g, '')      // Remove brackets
    .replace(/feat\..*$/i, '')    // Remove featuring
    .replace(/[^\w\s]/g, ' ')     // Remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}
```

### 3. Include Source Attribution

```typescript
return {
  // ...
  source: 'LRCLib',  // Credit the source
};
```

### 4. Handle Instrumental Tracks

```typescript
if (response.instrumental) {
  return {
    trackId: track.id,
    plain: '[Instrumental]',
    source: this.manifest.name,
  };
}
```

## Related

- [Metadata Provider](metadata-provider.md) - Provide track info
- [Audio Processor](audio-processor.md) - Process audio
- [SDK Reference](../../sdk/README.md) - Full API

