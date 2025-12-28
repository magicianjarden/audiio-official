/**
 * Metadata Provider Template
 *
 * This template shows how to create a metadata provider plugin for Audiio.
 * Metadata providers fetch track, album, and artist information from external APIs.
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
 *     "id": "example",
 *     "roles": ["metadata-provider"]
 *   },
 *   "peerDependencies": {
 *     "@audiio/sdk": "^0.1.0"
 *   }
 * }
 */

import {
  BaseMetadataProvider,
  type MetadataSearchResult,
  type MetadataSearchOptions,
  type MetadataTrack,
  type Artist,
  type Album,
  type ArtistDetail
} from '@audiio/sdk';

export class ExampleMetadataProvider extends BaseMetadataProvider {
  // Unique identifier for this provider
  readonly id = 'example';

  // Human-readable name shown in the UI
  readonly name = 'Example Provider';

  // Priority determines order when multiple providers exist (higher = preferred)
  readonly priority = 50;

  /**
   * Search for tracks, artists, and albums
   * @param query - Search query string
   * @param options - Pagination and filter options
   */
  async search(query: string, options?: MetadataSearchOptions): Promise<MetadataSearchResult> {
    const limit = options?.limit ?? 25;
    const offset = options?.offset ?? 0;

    // TODO: Implement your API call here
    // Example:
    // const response = await fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
    // const data = await response.json();

    return {
      tracks: [], // Map API response to MetadataTrack[]
      artists: [], // Map API response to Artist[]
      albums: [] // Map API response to Album[]
    };
  }

  /**
   * Get a specific track by ID
   * @param id - Track ID from this provider
   */
  async getTrack(id: string): Promise<MetadataTrack | null> {
    // TODO: Implement fetching a single track
    // Example:
    // const response = await fetch(`https://api.example.com/tracks/${id}`);
    // const data = await response.json();
    // return this.mapTrack(data);

    return null;
  }

  /**
   * Get artist details including top tracks and albums
   * @param id - Artist ID from this provider
   */
  async getArtist(id: string): Promise<ArtistDetail | null> {
    // TODO: Implement fetching artist details
    // This should return the artist's top tracks, albums, singles, etc.

    return null;
  }

  /**
   * Get album details including tracks
   * @param id - Album ID from this provider
   */
  async getAlbum(id: string): Promise<(Album & { tracks: MetadataTrack[] }) | null> {
    // TODO: Implement fetching album with tracks

    return null;
  }

  /**
   * Helper method to map API response to MetadataTrack
   */
  private mapTrack(data: unknown): MetadataTrack {
    // TODO: Map your API's track format to MetadataTrack
    const track = data as Record<string, unknown>;

    return {
      id: String(track.id),
      title: String(track.title),
      artists: [], // Map to Artist[]
      duration: Number(track.duration) || 0,
      _provider: this.id
    };
  }
}

// Default export for Audiio plugin loader
export default ExampleMetadataProvider;
