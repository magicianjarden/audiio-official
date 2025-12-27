/**
 * Sposify Playlist Database Queries
 * Handles playlist browsing, searching, and retrieval
 */

import type { DbPlaylistIndex, DbPlaylistTrack, PlaylistPreview, PlaylistDetail, PlaylistSearchOptions, TrackInfo } from '../types';
import { getSposifyDatabase } from './sposify-db';

export class PlaylistDatabase {
  /**
   * Search playlists by name or description
   */
  searchPlaylists(query: string, options: PlaylistSearchOptions = {}): { playlists: PlaylistPreview[]; total: number; hasMore: boolean } {
    const db = getSposifyDatabase().getRawDb();
    if (!db) return { playlists: [], total: 0, hasMore: false };

    const {
      limit = 50,
      offset = 0,
      minFollowers = 0,
      maxFollowers,
      minTracks = 0,
      maxTracks,
    } = options;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (query) {
      // Use FTS5 if available, otherwise LIKE
      try {
        conditions.push('playlist_id IN (SELECT playlist_id FROM playlist_search WHERE playlist_search MATCH ?)');
        params.push(query);
      } catch {
        conditions.push('(LOWER(name) LIKE ? OR LOWER(description) LIKE ?)');
        params.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`);
      }
    }

    if (minFollowers > 0) {
      conditions.push('followers >= ?');
      params.push(minFollowers);
    }

    if (maxFollowers !== undefined) {
      conditions.push('followers <= ?');
      params.push(maxFollowers);
    }

    if (minTracks > 0) {
      conditions.push('track_count >= ?');
      params.push(minTracks);
    }

    if (maxTracks !== undefined) {
      conditions.push('track_count <= ?');
      params.push(maxTracks);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM playlist_index ${whereClause}
    `).get(...params) as { total: number };

    const total = countResult?.total || 0;

    // Get results
    const results = db.prepare(`
      SELECT * FROM playlist_index
      ${whereClause}
      ORDER BY followers DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as DbPlaylistIndex[];

    const playlists: PlaylistPreview[] = results.map(row => ({
      playlistId: row.playlist_id,
      name: row.name,
      description: row.description,
      owner: row.owner,
      followers: row.followers || 0,
      trackCount: row.track_count || 0,
    }));

    return {
      playlists,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Browse playlists by category or popularity
   */
  browsePlaylists(options: PlaylistSearchOptions = {}): { playlists: PlaylistPreview[]; total: number; categories: string[] } {
    const db = getSposifyDatabase().getRawDb();
    if (!db) return { playlists: [], total: 0, categories: [] };

    const { limit = 50, offset = 0, minFollowers = 100 } = options;

    // Get popular playlists
    const results = db.prepare(`
      SELECT * FROM playlist_index
      WHERE followers >= ?
      ORDER BY followers DESC
      LIMIT ? OFFSET ?
    `).all(minFollowers, limit, offset) as DbPlaylistIndex[];

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM playlist_index WHERE followers >= ?
    `).get(minFollowers) as { total: number };

    const playlists: PlaylistPreview[] = results.map(row => ({
      playlistId: row.playlist_id,
      name: row.name,
      description: row.description,
      owner: row.owner,
      followers: row.followers || 0,
      trackCount: row.track_count || 0,
    }));

    // Extract common categories from descriptions (simplified)
    const categories = this.extractCategories(results);

    return {
      playlists,
      total: countResult?.total || 0,
      categories,
    };
  }

  /**
   * Get playlist by ID with tracks
   */
  getPlaylist(playlistId: string): PlaylistDetail | null {
    const db = getSposifyDatabase().getRawDb();
    if (!db) return null;

    // Get playlist metadata
    const playlist = db.prepare(`
      SELECT * FROM playlist_index WHERE playlist_id = ?
    `).get(playlistId) as DbPlaylistIndex | undefined;

    if (!playlist) return null;

    // Get playlist tracks
    const tracks = this.getPlaylistTracks(playlistId);

    return {
      playlistId: playlist.playlist_id,
      name: playlist.name,
      description: playlist.description,
      owner: playlist.owner,
      followers: playlist.followers || 0,
      trackCount: playlist.track_count || 0,
      tracks,
    };
  }

  /**
   * Get playlist tracks
   */
  getPlaylistTracks(playlistId: string): TrackInfo[] {
    const db = getSposifyDatabase().getRawDb();
    if (!db) return [];

    const results = db.prepare(`
      SELECT t.*, pt.position
      FROM playlist_tracks pt
      JOIN tracks t ON pt.spotify_id = t.spotify_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC
    `).all(playlistId) as Array<{
      spotify_id: string;
      title: string;
      artist_name: string;
      album_name: string | null;
      duration_ms: number | null;
      isrc: string | null;
      explicit: number;
      popularity: number | null;
      position: number;
    }>;

    return results.map(row => ({
      spotifyId: row.spotify_id,
      title: row.title,
      artistName: row.artist_name,
      albumName: row.album_name,
      durationMs: row.duration_ms,
      isrc: row.isrc,
      explicit: row.explicit === 1,
      popularity: row.popularity,
    }));
  }

  /**
   * Get playlists containing a specific track
   */
  getPlaylistsContainingTrack(spotifyId: string, limit = 10): PlaylistPreview[] {
    const db = getSposifyDatabase().getRawDb();
    if (!db) return [];

    const results = db.prepare(`
      SELECT pi.* FROM playlist_index pi
      JOIN playlist_tracks pt ON pi.playlist_id = pt.playlist_id
      WHERE pt.spotify_id = ?
      ORDER BY pi.followers DESC
      LIMIT ?
    `).all(spotifyId, limit) as DbPlaylistIndex[];

    return results.map(row => ({
      playlistId: row.playlist_id,
      name: row.name,
      description: row.description,
      owner: row.owner,
      followers: row.followers || 0,
      trackCount: row.track_count || 0,
    }));
  }

  /**
   * Get top playlists by followers
   */
  getTopPlaylists(limit = 100): PlaylistPreview[] {
    const db = getSposifyDatabase().getRawDb();
    if (!db) return [];

    const results = db.prepare(`
      SELECT * FROM playlist_index
      ORDER BY followers DESC
      LIMIT ?
    `).all(limit) as DbPlaylistIndex[];

    return results.map(row => ({
      playlistId: row.playlist_id,
      name: row.name,
      description: row.description,
      owner: row.owner,
      followers: row.followers || 0,
      trackCount: row.track_count || 0,
    }));
  }

  /**
   * Extract categories from playlist descriptions
   */
  private extractCategories(playlists: DbPlaylistIndex[]): string[] {
    const categoryKeywords = [
      'pop', 'rock', 'hip hop', 'hip-hop', 'rap', 'r&b', 'rnb',
      'electronic', 'edm', 'dance', 'house', 'techno',
      'jazz', 'blues', 'soul', 'funk', 'classical',
      'country', 'folk', 'indie', 'alternative', 'metal',
      'latin', 'reggaeton', 'k-pop', 'kpop', 'j-pop',
      'workout', 'party', 'chill', 'focus', 'sleep', 'study',
      'summer', 'road trip', 'morning', 'night',
    ];

    const foundCategories = new Set<string>();

    for (const playlist of playlists) {
      const text = `${playlist.name} ${playlist.description || ''}`.toLowerCase();
      for (const keyword of categoryKeywords) {
        if (text.includes(keyword)) {
          foundCategories.add(keyword);
        }
      }
    }

    return Array.from(foundCategories).slice(0, 20);
  }
}

// Singleton
let instance: PlaylistDatabase | null = null;

export function getPlaylistDatabase(): PlaylistDatabase {
  if (!instance) {
    instance = new PlaylistDatabase();
  }
  return instance;
}
