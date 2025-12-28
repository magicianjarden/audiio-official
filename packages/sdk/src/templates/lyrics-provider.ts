/**
 * Lyrics Provider Template
 *
 * This template shows how to create a lyrics provider plugin for Audiio.
 * Lyrics providers fetch song lyrics, optionally with timestamps for synced lyrics.
 *
 * Usage:
 * 1. Copy this template to your plugin project
 * 2. Implement the abstract methods
 * 3. Export your class as default
 *
 * Example package.json:
 * {
 *   "name": "@your-scope/plugin-example",
 *   "version": "1.0.0",
 *   "main": "./dist/index.js",
 *   "types": "./dist/index.d.ts",
 *   "audiio": {
 *     "type": "plugin",
 *     "id": "example-lyrics",
 *     "roles": ["lyrics-provider"]
 *   },
 *   "peerDependencies": {
 *     "@audiio/sdk": "^0.1.0"
 *   }
 * }
 */

import {
  BaseLyricsProvider,
  type LyricsResult,
  type LyricsQuery,
  type LyricsSearchOptions,
  type LyricsLine
} from '@audiio/sdk';

export class ExampleLyricsProvider extends BaseLyricsProvider {
  // Unique identifier for this provider
  readonly id = 'example-lyrics';

  // Human-readable name shown in the UI
  readonly name = 'Example Lyrics';

  // Priority determines order when multiple providers exist (higher = preferred)
  readonly priority = 50;

  /**
   * Search for lyrics matching the query
   * @param query - Lyrics search query (title, artist, album, duration)
   * @param options - Search options
   */
  async search(query: LyricsQuery, options?: LyricsSearchOptions): Promise<LyricsResult[]> {
    // TODO: Implement your lyrics search API call
    // Example:
    // const searchQuery = `${query.artist} ${query.title}`;
    // const response = await fetch(`https://api.example.com/lyrics/search?q=${encodeURIComponent(searchQuery)}`);
    // const data = await response.json();

    return []; // Return array of LyricsResult
  }

  /**
   * Get lyrics by ID
   * @param id - Lyrics ID from this provider
   */
  async getLyrics(id: string): Promise<LyricsResult | null> {
    // TODO: Implement fetching lyrics by ID

    return null;
  }

  /**
   * Get the best matching lyrics for a track
   * This is the primary method called by the app
   *
   * @param query - Lyrics search query
   */
  async getBestMatch(query: LyricsQuery): Promise<LyricsResult | null> {
    // TODO: Implement best match logic
    // Search for lyrics and return the best match

    const results = await this.search(query);
    if (results.length === 0) {
      return null;
    }

    // Return the first result or implement scoring logic
    return results[0];
  }

  /**
   * Parse synced lyrics (LRC format) into LyricsLine array
   * Helper method for providers that return LRC format
   */
  protected parseLRC(lrcContent: string): LyricsLine[] {
    const lines: LyricsLine[] = [];
    const lrcLines = lrcContent.split('\n');

    for (const line of lrcLines) {
      // Match [mm:ss.xx] format
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const centiseconds = parseInt(match[3], 10);
        const text = match[4].trim();

        // Convert to milliseconds
        const timeMs = (minutes * 60 + seconds) * 1000 + centiseconds * (match[3].length === 2 ? 10 : 1);

        if (text) {
          lines.push({
            startTime: timeMs,
            text
          });
        }
      }
    }

    return lines;
  }

  /**
   * Create a LyricsResult from plain text lyrics
   * Helper method for providers that return unsynced lyrics
   */
  protected createPlainLyricsResult(
    id: string,
    title: string,
    artist: string,
    plainLyrics: string
  ): LyricsResult {
    return {
      id,
      title,
      artist,
      lyrics: plainLyrics,
      synced: false,
      _provider: this.id
    };
  }

  /**
   * Create a LyricsResult from synced lyrics
   * Helper method for providers that return timed lyrics
   */
  protected createSyncedLyricsResult(
    id: string,
    title: string,
    artist: string,
    lines: LyricsLine[]
  ): LyricsResult {
    // Convert lines to plain text as well
    const plainLyrics = lines.map(l => l.text).join('\n');

    return {
      id,
      title,
      artist,
      lyrics: plainLyrics,
      syncedLyrics: lines,
      synced: true,
      _provider: this.id
    };
  }
}

// Default export for Audiio plugin loader
export default ExampleLyricsProvider;
