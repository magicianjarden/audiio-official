/**
 * Stream Provider Template
 *
 * This template shows how to create a stream provider plugin for Audiio.
 * Stream providers resolve playable audio URLs for tracks.
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
 *     "id": "example-stream",
 *     "roles": ["stream-provider"]
 *   },
 *   "peerDependencies": {
 *     "@audiio/sdk": "^0.1.0"
 *   }
 * }
 */

import {
  BaseStreamProvider,
  type StreamInfo,
  type StreamTrack,
  type StreamSearchOptions
} from '@audiio/sdk';

export class ExampleStreamProvider extends BaseStreamProvider {
  // Unique identifier for this provider
  readonly id = 'example-stream';

  // Human-readable name shown in the UI
  readonly name = 'Example Stream';

  // Priority determines order when multiple providers exist (higher = preferred)
  readonly priority = 50;

  /**
   * Search for streamable tracks
   * @param query - Search query string
   * @param options - Pagination and filter options
   */
  async search(query: string, options?: StreamSearchOptions): Promise<StreamTrack[]> {
    const limit = options?.limit ?? 25;
    const offset = options?.offset ?? 0;

    // TODO: Implement your search API call here
    // Example:
    // const response = await fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
    // const data = await response.json();

    return []; // Map API response to StreamTrack[]
  }

  /**
   * Get a specific track by ID
   * @param id - Track ID from this provider
   */
  async getTrack(id: string): Promise<StreamTrack | null> {
    // TODO: Implement fetching a single track

    return null;
  }

  /**
   * Resolve a playable stream URL for a track
   * This is the core method that returns actual audio URLs
   *
   * @param track - The track to resolve
   */
  async resolveStream(track: StreamTrack): Promise<StreamInfo | null> {
    // TODO: Implement stream resolution
    // This should return the actual audio URL(s)

    // Example response:
    // return {
    //   url: 'https://example.com/audio/track.mp3',
    //   format: 'mp3',
    //   quality: 'high',
    //   sources: [
    //     {
    //       url: 'https://example.com/audio/track.mp3',
    //       quality: 'high',
    //       bitrate: 320
    //     }
    //   ],
    //   expiresAt: Date.now() + 3600000 // 1 hour from now
    // };

    return null;
  }

  /**
   * Match a metadata track to a streamable track
   * Used when the user plays a track from search results
   *
   * @param title - Track title
   * @param artist - Artist name
   * @param album - Album name (optional)
   * @param duration - Track duration in seconds (optional)
   */
  async matchTrack(
    title: string,
    artist: string,
    album?: string,
    duration?: number
  ): Promise<StreamTrack | null> {
    // TODO: Implement track matching
    // Search for tracks and find the best match based on the parameters

    const query = `${artist} - ${title}`;
    const results = await this.search(query, { limit: 5 });

    if (results.length === 0) {
      return null;
    }

    // Simple matching - return first result
    // For better matching, compare duration, title similarity, etc.
    return results[0];
  }
}

// Default export for Audiio plugin loader
export default ExampleStreamProvider;
