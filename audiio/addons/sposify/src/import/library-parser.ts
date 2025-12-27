/**
 * Spotify Library Parser
 * Parses YourLibrary.json for liked tracks, albums, and artists
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  SpotifyLibrary,
  SpotifyLibraryTrack,
  NormalizedTrack,
  ParseError,
} from '../types';

export interface LibraryParseResult {
  likedTracks: NormalizedTrack[];
  bannedTracks: NormalizedTrack[];
  likedAlbums: Array<{ name: string; artist: string; spotifyUri?: string }>;
  likedArtists: Array<{ name: string; spotifyUri?: string }>;
  errors: ParseError[];
  stats: {
    likedTracksCount: number;
    bannedTracksCount: number;
    albumsCount: number;
    artistsCount: number;
  };
}

export class LibraryParser {
  /**
   * Parse YourLibrary.json file
   */
  parseLibraryFile(filePath: string): LibraryParseResult {
    const result: LibraryParseResult = {
      likedTracks: [],
      bannedTracks: [],
      likedAlbums: [],
      likedArtists: [],
      errors: [],
      stats: {
        likedTracksCount: 0,
        bannedTracksCount: 0,
        albumsCount: 0,
        artistsCount: 0,
      },
    };

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as SpotifyLibrary;

      // Parse liked tracks
      if (data.tracks && Array.isArray(data.tracks)) {
        for (const track of data.tracks) {
          const normalized = this.normalizeLibraryTrack(track);
          if (normalized) {
            result.likedTracks.push(normalized);
          }
        }
        result.stats.likedTracksCount = result.likedTracks.length;
      }

      // Parse banned/disliked tracks
      if (data.bannedTracks && Array.isArray(data.bannedTracks)) {
        for (const track of data.bannedTracks) {
          const normalized = this.normalizeLibraryTrack(track);
          if (normalized) {
            result.bannedTracks.push(normalized);
          }
        }
        result.stats.bannedTracksCount = result.bannedTracks.length;
      }

      // Parse liked albums
      if (data.albums && Array.isArray(data.albums)) {
        for (const album of data.albums) {
          if (album.album && album.artist) {
            result.likedAlbums.push({
              name: album.album,
              artist: album.artist,
              spotifyUri: album.uri,
            });
          }
        }
        result.stats.albumsCount = result.likedAlbums.length;
      }

      // Parse followed artists
      if (data.artists && Array.isArray(data.artists)) {
        for (const artist of data.artists) {
          if (artist.name) {
            result.likedArtists.push({
              name: artist.name,
              spotifyUri: artist.uri,
            });
          }
        }
        result.stats.artistsCount = result.likedArtists.length;
      }

      // Parse banned artists (optional)
      if (data.bannedArtists && Array.isArray(data.bannedArtists)) {
        // Could be used for recommendations filtering
      }
    } catch (error) {
      result.errors.push({
        file: path.basename(filePath),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  /**
   * Find and parse YourLibrary.json from a directory
   */
  parseDirectory(dirPath: string): LibraryParseResult {
    const libraryFile = path.join(dirPath, 'YourLibrary.json');

    if (!fs.existsSync(libraryFile)) {
      return {
        likedTracks: [],
        bannedTracks: [],
        likedAlbums: [],
        likedArtists: [],
        errors: [{
          file: 'YourLibrary.json',
          error: 'File not found in the selected directory',
        }],
        stats: {
          likedTracksCount: 0,
          bannedTracksCount: 0,
          albumsCount: 0,
          artistsCount: 0,
        },
      };
    }

    return this.parseLibraryFile(libraryFile);
  }

  /**
   * Parse from file path list
   */
  parseFiles(filePaths: string[]): LibraryParseResult {
    const libraryFile = filePaths.find(f =>
      path.basename(f).toLowerCase() === 'yourlibrary.json'
    );

    if (!libraryFile) {
      return {
        likedTracks: [],
        bannedTracks: [],
        likedAlbums: [],
        likedArtists: [],
        errors: [],
        stats: {
          likedTracksCount: 0,
          bannedTracksCount: 0,
          albumsCount: 0,
          artistsCount: 0,
        },
      };
    }

    return this.parseLibraryFile(libraryFile);
  }

  /**
   * Normalize a library track
   */
  private normalizeLibraryTrack(track: SpotifyLibraryTrack): NormalizedTrack | null {
    if (!track.track || !track.artist) {
      return null;
    }

    return {
      trackName: track.track,
      artistName: track.artist,
      albumName: track.album || undefined,
      spotifyUri: track.uri,
      spotifyId: this.extractSpotifyId(track.uri),
    };
  }

  /**
   * Extract Spotify ID from URI
   */
  private extractSpotifyId(uri?: string): string | undefined {
    if (!uri) return undefined;

    // URI format: spotify:track:1234567890abcdef
    const match = uri.match(/spotify:track:([a-zA-Z0-9]+)/);
    return match ? match[1] : undefined;
  }
}

// Singleton
let instance: LibraryParser | null = null;

export function getLibraryParser(): LibraryParser {
  if (!instance) {
    instance = new LibraryParser();
  }
  return instance;
}
