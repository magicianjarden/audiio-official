/**
 * Spotify Playlist Parser
 * Parses Playlist*.json files from Spotify export
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  SpotifyPlaylistExport,
  NormalizedPlaylist,
  NormalizedTrack,
  ParseError,
} from '../types';

export interface PlaylistParseResult {
  playlists: NormalizedPlaylist[];
  errors: ParseError[];
  stats: {
    totalPlaylists: number;
    totalTracks: number;
    averageTracksPerPlaylist: number;
  };
}

export class PlaylistParser {
  /**
   * Parse all playlist files from a directory
   */
  parseDirectory(dirPath: string): PlaylistParseResult {
    const playlists: NormalizedPlaylist[] = [];
    const errors: ParseError[] = [];
    let totalTracks = 0;

    // Find all playlist files
    const files = fs.readdirSync(dirPath).filter(f =>
      f.startsWith('Playlist') && f.endsWith('.json')
    );

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const result = this.parsePlaylistFile(filePath);

      if (result.playlist) {
        playlists.push(result.playlist);
        totalTracks += result.playlist.tracks.length;
      }

      errors.push(...result.errors);
    }

    return {
      playlists,
      errors,
      stats: {
        totalPlaylists: playlists.length,
        totalTracks,
        averageTracksPerPlaylist: playlists.length > 0
          ? Math.round(totalTracks / playlists.length)
          : 0,
      },
    };
  }

  /**
   * Parse a single playlist file
   */
  parsePlaylistFile(filePath: string): { playlist: NormalizedPlaylist | null; errors: ParseError[] } {
    const errors: ParseError[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as SpotifyPlaylistExport;

      if (!data.name || !data.items) {
        errors.push({
          file: path.basename(filePath),
          error: 'Invalid playlist format: missing name or items',
        });
        return { playlist: null, errors };
      }

      const tracks: NormalizedTrack[] = [];

      for (const item of data.items) {
        if (!item.track) continue;

        const track = item.track;
        if (!track.trackName || !track.artistName) continue;

        tracks.push({
          trackName: track.trackName,
          artistName: track.artistName,
          albumName: track.albumName || undefined,
          spotifyUri: track.trackUri,
          spotifyId: this.extractSpotifyId(track.trackUri),
        });
      }

      const playlist: NormalizedPlaylist = {
        name: data.name,
        description: data.description || undefined,
        tracks,
        lastModified: data.lastModifiedDate,
      };

      return { playlist, errors };
    } catch (error) {
      errors.push({
        file: path.basename(filePath),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { playlist: null, errors };
    }
  }

  /**
   * Parse from file path list
   */
  parseFiles(filePaths: string[]): PlaylistParseResult {
    const playlists: NormalizedPlaylist[] = [];
    const errors: ParseError[] = [];
    let totalTracks = 0;

    const playlistFiles = filePaths.filter(f =>
      path.basename(f).startsWith('Playlist') && f.endsWith('.json')
    );

    for (const filePath of playlistFiles) {
      const result = this.parsePlaylistFile(filePath);

      if (result.playlist) {
        playlists.push(result.playlist);
        totalTracks += result.playlist.tracks.length;
      }

      errors.push(...result.errors);
    }

    return {
      playlists,
      errors,
      stats: {
        totalPlaylists: playlists.length,
        totalTracks,
        averageTracksPerPlaylist: playlists.length > 0
          ? Math.round(totalTracks / playlists.length)
          : 0,
      },
    };
  }

  /**
   * Extract Spotify ID from URI
   */
  private extractSpotifyId(uri?: string): string | undefined {
    if (!uri) return undefined;

    const match = uri.match(/spotify:track:([a-zA-Z0-9]+)/);
    return match ? match[1] : undefined;
  }
}

// Singleton
let instance: PlaylistParser | null = null;

export function getPlaylistParser(): PlaylistParser {
  if (!instance) {
    instance = new PlaylistParser();
  }
  return instance;
}
