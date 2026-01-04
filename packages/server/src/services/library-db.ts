/**
 * SQLite-based Library Storage
 *
 * Provides persistent storage for:
 * - Liked/disliked tracks
 * - Playlists
 * - Play history (for recommendations)
 *
 * Implements the same interface as desktop's libraryBridge
 */

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import * as path from 'path';
import * as fs from 'fs';

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration?: number;
  artwork?: string | { url?: string };
  isrc?: string;
  source?: string;
  sourceId?: string;
  [key: string]: unknown;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export interface PlayHistoryEntry {
  trackId: string;
  track: Track;
  playedAt: number;
  duration: number; // How long they listened
}

export class LibraryDatabase {
  readonly db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    // Liked tracks
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS liked_tracks (
        id TEXT PRIMARY KEY,
        track_data TEXT NOT NULL,
        liked_at INTEGER NOT NULL
      )
    `);

    // Disliked tracks
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS disliked_tracks (
        id TEXT PRIMARY KEY,
        track_data TEXT NOT NULL,
        reasons TEXT,
        disliked_at INTEGER NOT NULL
      )
    `);

    // Playlists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Playlist tracks (junction table)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        track_data TEXT NOT NULL,
        position INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      )
    `);

    // Play history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS play_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT NOT NULL,
        track_data TEXT NOT NULL,
        played_at INTEGER NOT NULL,
        listen_duration INTEGER DEFAULT 0
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at DESC);
      CREATE INDEX IF NOT EXISTS idx_play_history_track_id ON play_history(track_id);
      CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
    `);

    console.log('[LibraryDB] Database initialized');
  }

  // ========================================
  // Liked Tracks
  // ========================================

  getLikedTracks(): Track[] {
    const rows = this.db
      .prepare('SELECT track_data FROM liked_tracks ORDER BY liked_at DESC')
      .all() as { track_data: string }[];

    return rows.map(row => JSON.parse(row.track_data));
  }

  likeTrack(track: Track): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO liked_tracks (id, track_data, liked_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(track.id, JSON.stringify(track), Date.now());
  }

  unlikeTrack(trackId: string): void {
    this.db.prepare('DELETE FROM liked_tracks WHERE id = ?').run(trackId);
  }

  isTrackLiked(trackId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM liked_tracks WHERE id = ?')
      .get(trackId);
    return !!row;
  }

  // ========================================
  // Disliked Tracks
  // ========================================

  getDislikedTracks(): Track[] {
    const rows = this.db
      .prepare('SELECT track_data FROM disliked_tracks ORDER BY disliked_at DESC')
      .all() as { track_data: string }[];

    return rows.map(row => JSON.parse(row.track_data));
  }

  dislikeTrack(track: Track, reasons: string[] = []): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO disliked_tracks (id, track_data, reasons, disliked_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(track.id, JSON.stringify(track), JSON.stringify(reasons), Date.now());
  }

  removeDislike(trackId: string): void {
    this.db.prepare('DELETE FROM disliked_tracks WHERE id = ?').run(trackId);
  }

  isTrackDisliked(trackId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM disliked_tracks WHERE id = ?')
      .get(trackId);
    return !!row;
  }

  // ========================================
  // Playlists
  // ========================================

  getPlaylists(): Playlist[] {
    const playlists = this.db
      .prepare('SELECT * FROM playlists ORDER BY updated_at DESC')
      .all() as { id: string; name: string; description: string; created_at: number; updated_at: number }[];

    return playlists.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      tracks: this.getPlaylistTracks(p.id)
    }));
  }

  getPlaylist(playlistId: string): Playlist | null {
    const row = this.db
      .prepare('SELECT * FROM playlists WHERE id = ?')
      .get(playlistId) as { id: string; name: string; description: string; created_at: number; updated_at: number } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tracks: this.getPlaylistTracks(row.id)
    };
  }

  private getPlaylistTracks(playlistId: string): Track[] {
    const rows = this.db
      .prepare('SELECT track_data FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC')
      .all(playlistId) as { track_data: string }[];

    return rows.map(row => JSON.parse(row.track_data));
  }

  createPlaylist(name: string, description?: string): Playlist {
    const id = nanoid();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO playlists (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description || null, now, now);

    return {
      id,
      name,
      description,
      tracks: [],
      createdAt: now,
      updatedAt: now
    };
  }

  deletePlaylist(playlistId: string): void {
    this.db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId);
    this.db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);
  }

  renamePlaylist(playlistId: string, name: string): void {
    this.db.prepare(`
      UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?
    `).run(name, Date.now(), playlistId);
  }

  addToPlaylist(playlistId: string, track: Track): void {
    // Get current max position
    const maxPos = this.db
      .prepare('SELECT MAX(position) as max FROM playlist_tracks WHERE playlist_id = ?')
      .get(playlistId) as { max: number | null };

    const position = (maxPos.max ?? -1) + 1;

    this.db.prepare(`
      INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, track_data, position, added_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(playlistId, track.id, JSON.stringify(track), position, Date.now());

    // Update playlist timestamp
    this.db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId);
  }

  removeFromPlaylist(playlistId: string, trackId: string): void {
    this.db.prepare(`
      DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?
    `).run(playlistId, trackId);

    // Update playlist timestamp
    this.db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId);
  }

  // ========================================
  // Play History
  // ========================================

  recordPlay(track: Track, listenDuration: number = 0): void {
    this.db.prepare(`
      INSERT INTO play_history (track_id, track_data, played_at, listen_duration)
      VALUES (?, ?, ?, ?)
    `).run(track.id, JSON.stringify(track), Date.now(), listenDuration);
  }

  getRecentlyPlayed(limit: number = 10): Track[] {
    // Get unique tracks, most recent first
    const rows = this.db.prepare(`
      SELECT track_data, MAX(played_at) as last_played
      FROM play_history
      GROUP BY track_id
      ORDER BY last_played DESC
      LIMIT ?
    `).all(limit) as { track_data: string }[];

    return rows.map(row => JSON.parse(row.track_data));
  }

  getQuickPicks(limit: number = 10): Track[] {
    // Mix of liked tracks and frequently played
    const liked = this.getLikedTracks().slice(0, Math.ceil(limit / 2));

    // Get frequently played tracks not in liked
    const likedIds = new Set(liked.map(t => t.id));
    const frequent = this.db.prepare(`
      SELECT track_data, COUNT(*) as play_count
      FROM play_history
      GROUP BY track_id
      ORDER BY play_count DESC
      LIMIT ?
    `).all(limit) as { track_data: string }[];

    const frequentTracks = frequent
      .map(row => JSON.parse(row.track_data) as Track)
      .filter(t => !likedIds.has(t.id))
      .slice(0, limit - liked.length);

    // Shuffle the combination
    const combined = [...liked, ...frequentTracks];
    return this.shuffle(combined).slice(0, limit);
  }

  getForYou(limit: number = 10): Track[] {
    // Personalized recommendations based on listening history
    // For now, return a mix of recent and liked
    const recent = this.getRecentlyPlayed(20);
    const liked = this.getLikedTracks().slice(0, 20);

    // Combine and dedupe
    const seen = new Set<string>();
    const combined: Track[] = [];

    for (const track of [...recent, ...liked]) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        combined.push(track);
      }
    }

    return this.shuffle(combined).slice(0, limit);
  }

  getMixes(limit: number = 6): { id: string; name: string; tracks: Track[]; artwork?: string }[] {
    // Generate "mixes" based on listening patterns
    const mixes: { id: string; name: string; tracks: Track[]; artwork?: string }[] = [];

    // Daily Mix - recent favorites
    const dailyTracks = this.getQuickPicks(10);
    if (dailyTracks.length > 0) {
      mixes.push({
        id: 'daily-mix-1',
        name: 'Daily Mix 1',
        tracks: dailyTracks,
        artwork: dailyTracks[0]?.artwork as string
      });
    }

    // Liked tracks mix
    const likedTracks = this.shuffle(this.getLikedTracks()).slice(0, 10);
    if (likedTracks.length > 0) {
      mixes.push({
        id: 'liked-mix',
        name: 'Liked Songs Mix',
        tracks: likedTracks,
        artwork: likedTracks[0]?.artwork as string
      });
    }

    // Group by artist for artist mixes
    const artistCounts = new Map<string, { artist: string; tracks: Track[] }>();
    const allHistory = this.db.prepare(`
      SELECT track_data FROM play_history ORDER BY played_at DESC LIMIT 100
    `).all() as { track_data: string }[];

    for (const row of allHistory) {
      const track = JSON.parse(row.track_data) as Track;
      if (!track.artist) continue;

      const existing = artistCounts.get(track.artist);
      if (existing) {
        if (!existing.tracks.some(t => t.id === track.id)) {
          existing.tracks.push(track);
        }
      } else {
        artistCounts.set(track.artist, { artist: track.artist, tracks: [track] });
      }
    }

    // Create artist mixes for artists with 3+ tracks
    const sortedArtists = [...artistCounts.values()]
      .filter(a => a.tracks.length >= 3)
      .sort((a, b) => b.tracks.length - a.tracks.length)
      .slice(0, limit - mixes.length);

    for (const artistData of sortedArtists) {
      mixes.push({
        id: `artist-mix-${artistData.artist.toLowerCase().replace(/\s+/g, '-')}`,
        name: `${artistData.artist} Mix`,
        tracks: artistData.tracks,
        artwork: artistData.tracks[0]?.artwork as string
      });
    }

    return mixes.slice(0, limit);
  }

  // ========================================
  // Utilities
  // ========================================

  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database stats
   */
  getStats(): {
    likedCount: number;
    dislikedCount: number;
    playlistCount: number;
    historyCount: number;
  } {
    const liked = this.db.prepare('SELECT COUNT(*) as count FROM liked_tracks').get() as { count: number };
    const disliked = this.db.prepare('SELECT COUNT(*) as count FROM disliked_tracks').get() as { count: number };
    const playlists = this.db.prepare('SELECT COUNT(*) as count FROM playlists').get() as { count: number };
    const history = this.db.prepare('SELECT COUNT(*) as count FROM play_history').get() as { count: number };

    return {
      likedCount: liked.count,
      dislikedCount: disliked.count,
      playlistCount: playlists.count,
      historyCount: history.count
    };
  }
}
