/**
 * Sposify Database Manager
 * Handles SQLite connection and core database operations
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import type { DatabaseStatus, DbTrack, DbAudioFeatures, DbArtist, DbAlbum } from '../types';
import { setupDatabase, checkDatabaseExists, type SetupProgress, type ProgressCallback } from './database-setup';

export class SposifyDatabase {
  private db: Database.Database | null = null;
  private dbPath: string | null = null;
  private isInitialized = false;
  private isSettingUp = false;
  private setupPromise: Promise<DatabaseStatus> | null = null;

  /**
   * Initialize the database connection
   * Automatically sets up database if not present
   */
  async initialize(
    userDataPath: string,
    options?: { onProgress?: ProgressCallback; forceRebuild?: boolean }
  ): Promise<DatabaseStatus> {
    // If already setting up, return existing promise
    if (this.setupPromise) {
      return this.setupPromise;
    }

    // If already initialized, return status
    if (this.isInitialized && this.db) {
      return this.getStatus();
    }

    const bundledDbPath = path.join(userDataPath, 'sposify', 'sposify_bundle.sqlite3');

    // Check if database exists and is valid
    const check = checkDatabaseExists(userDataPath);

    if (!check.valid || options?.forceRebuild) {
      // Need to setup database
      this.isSettingUp = true;

      this.setupPromise = (async () => {
        try {
          console.log('[Sposify] Database not found, initiating setup...');

          const result = await setupDatabase({
            userDataPath,
            onProgress: options?.onProgress,
            forceRebuild: options?.forceRebuild,
          });

          if (!result.success) {
            console.error('[Sposify] Database setup failed:', result.error);
            return this.getEmptyStatus();
          }

          console.log(`[Sposify] Database ready (source: ${result.source})`);

          // Now open the database
          return this.openDatabase(bundledDbPath);
        } catch (error) {
          console.error('[Sposify] Setup error:', error);
          return this.getEmptyStatus();
        } finally {
          this.isSettingUp = false;
          this.setupPromise = null;
        }
      })();

      return this.setupPromise;
    }

    // Database exists and is valid, just open it
    return this.openDatabase(bundledDbPath);
  }

  /**
   * Open database file
   */
  private openDatabase(dbPath: string): DatabaseStatus {
    try {
      this.db = new Database(dbPath, { readonly: true });
      this.dbPath = dbPath;
      this.isInitialized = true;

      // Enable optimizations
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('temp_store = MEMORY');

      return this.getStatus();
    } catch (error) {
      console.error('[Sposify] Failed to open database:', error);
      return this.getEmptyStatus();
    }
  }

  /**
   * Get empty status object
   */
  private getEmptyStatus(): DatabaseStatus {
    return {
      ready: false,
      path: null,
      trackCount: 0,
      artistCount: 0,
      albumCount: 0,
      playlistCount: 0,
      hasAudioFeatures: false,
      audioFeaturesCount: 0,
      databaseSizeBytes: 0,
      version: '0.0.0',
      lastUpdated: null,
    };
  }

  /**
   * Check if database is currently setting up
   */
  isSetupInProgress(): boolean {
    return this.isSettingUp;
  }

  /**
   * Get database status and statistics
   */
  getStatus(): DatabaseStatus {
    if (!this.db || !this.dbPath) {
      return {
        ready: false,
        path: null,
        trackCount: 0,
        artistCount: 0,
        albumCount: 0,
        playlistCount: 0,
        hasAudioFeatures: false,
        audioFeaturesCount: 0,
        databaseSizeBytes: 0,
        version: '0.0.0',
        lastUpdated: null,
      };
    }

    const trackCount = this.getTableCount('tracks');
    const artistCount = this.getTableCount('artists');
    const albumCount = this.getTableCount('albums');
    const playlistCount = this.getTableCount('playlist_index');
    const audioFeaturesCount = this.getTableCount('audio_features');

    const stats = fs.statSync(this.dbPath);

    return {
      ready: true,
      path: this.dbPath,
      trackCount,
      artistCount,
      albumCount,
      playlistCount,
      hasAudioFeatures: audioFeaturesCount > 0,
      audioFeaturesCount,
      databaseSizeBytes: stats.size,
      version: this.getMetadata('version') || '1.0.0',
      lastUpdated: parseInt(this.getMetadata('last_updated') || '0', 10) || null,
    };
  }

  /**
   * Get count from a table
   */
  private getTableCount(table: string): number {
    if (!this.db) return 0;
    try {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      return result?.count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get metadata value
   */
  private getMetadata(key: string): string | null {
    if (!this.db) return null;
    try {
      const result = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as { value: string } | undefined;
      return result?.value || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  // ============================================================================
  // Track Queries
  // ============================================================================

  /**
   * Get track by Spotify ID
   */
  getTrackById(spotifyId: string): DbTrack | null {
    if (!this.db) return null;
    return this.db.prepare('SELECT * FROM tracks WHERE spotify_id = ?').get(spotifyId) as DbTrack | undefined || null;
  }

  /**
   * Get track by ISRC
   */
  getTrackByIsrc(isrc: string): DbTrack | null {
    if (!this.db) return null;
    return this.db.prepare('SELECT * FROM tracks WHERE isrc = ?').get(isrc.toUpperCase()) as DbTrack | undefined || null;
  }

  /**
   * Search tracks by title and artist
   */
  searchTracks(title: string, artist: string, limit = 10): DbTrack[] {
    if (!this.db) return [];

    // First try exact match
    const exactMatch = this.db.prepare(`
      SELECT * FROM tracks
      WHERE LOWER(title) = LOWER(?) AND LOWER(artist_name) = LOWER(?)
      LIMIT 1
    `).get(title, artist) as DbTrack | undefined;

    if (exactMatch) return [exactMatch];

    // Then try normalized match
    const normalizedTitle = this.normalizeString(title);
    const normalizedArtist = this.normalizeString(artist);

    return this.db.prepare(`
      SELECT *,
        CASE
          WHEN LOWER(title) = LOWER(?) AND LOWER(artist_name) = LOWER(?) THEN 100
          WHEN LOWER(title) LIKE ? AND LOWER(artist_name) LIKE ? THEN 80
          WHEN LOWER(title) LIKE ? THEN 50
          ELSE 30
        END as match_score
      FROM tracks
      WHERE LOWER(title) LIKE ? OR LOWER(artist_name) LIKE ?
      ORDER BY match_score DESC, popularity DESC
      LIMIT ?
    `).all(
      title, artist,
      `%${normalizedTitle}%`, `%${normalizedArtist}%`,
      `%${normalizedTitle}%`,
      `%${normalizedTitle}%`, `%${normalizedArtist}%`,
      limit
    ) as DbTrack[];
  }

  /**
   * Get tracks by IDs (batch)
   */
  getTracksByIds(spotifyIds: string[]): DbTrack[] {
    if (!this.db || spotifyIds.length === 0) return [];

    const placeholders = spotifyIds.map(() => '?').join(',');
    return this.db.prepare(`
      SELECT * FROM tracks WHERE spotify_id IN (${placeholders})
    `).all(...spotifyIds) as DbTrack[];
  }

  /**
   * Get tracks by ISRCs (batch)
   */
  getTracksByIsrcs(isrcs: string[]): DbTrack[] {
    if (!this.db || isrcs.length === 0) return [];

    const normalizedIsrcs = isrcs.map(i => i.toUpperCase());
    const placeholders = normalizedIsrcs.map(() => '?').join(',');
    return this.db.prepare(`
      SELECT * FROM tracks WHERE isrc IN (${placeholders})
    `).all(...normalizedIsrcs) as DbTrack[];
  }

  // ============================================================================
  // Audio Features Queries
  // ============================================================================

  /**
   * Get audio features by Spotify ID
   */
  getAudioFeatures(spotifyId: string): DbAudioFeatures | null {
    if (!this.db) return null;
    return this.db.prepare('SELECT * FROM audio_features WHERE spotify_id = ?').get(spotifyId) as DbAudioFeatures | undefined || null;
  }

  /**
   * Get audio features by ISRC (through track lookup)
   */
  getAudioFeaturesByIsrc(isrc: string): DbAudioFeatures | null {
    const track = this.getTrackByIsrc(isrc);
    if (!track) return null;
    return this.getAudioFeatures(track.spotify_id);
  }

  /**
   * Get audio features batch
   */
  getAudioFeaturesBatch(spotifyIds: string[]): Map<string, DbAudioFeatures> {
    if (!this.db || spotifyIds.length === 0) return new Map();

    const placeholders = spotifyIds.map(() => '?').join(',');
    const results = this.db.prepare(`
      SELECT * FROM audio_features WHERE spotify_id IN (${placeholders})
    `).all(...spotifyIds) as DbAudioFeatures[];

    return new Map(results.map(f => [f.spotify_id, f]));
  }

  // ============================================================================
  // Artist Queries
  // ============================================================================

  /**
   * Get artist by ID
   */
  getArtistById(artistId: string): DbArtist | null {
    if (!this.db) return null;
    return this.db.prepare('SELECT * FROM artists WHERE spotify_id = ?').get(artistId) as DbArtist | undefined || null;
  }

  /**
   * Search artists by name
   */
  searchArtists(name: string, limit = 10): DbArtist[] {
    if (!this.db) return [];
    return this.db.prepare(`
      SELECT * FROM artists
      WHERE LOWER(name) LIKE LOWER(?)
      ORDER BY popularity DESC
      LIMIT ?
    `).all(`%${name}%`, limit) as DbArtist[];
  }

  // ============================================================================
  // Album Queries
  // ============================================================================

  /**
   * Get album by ID
   */
  getAlbumById(albumId: string): DbAlbum | null {
    if (!this.db) return null;
    return this.db.prepare('SELECT * FROM albums WHERE spotify_id = ?').get(albumId) as DbAlbum | undefined || null;
  }

  /**
   * Get album by UPC
   */
  getAlbumByUpc(upc: string): DbAlbum | null {
    if (!this.db) return null;
    return this.db.prepare('SELECT * FROM albums WHERE upc = ?').get(upc) as DbAlbum | undefined || null;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Normalize string for matching
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Get raw database connection (for advanced queries)
   */
  getRawDb(): Database.Database | null {
    return this.db;
  }
}

// Singleton instance
let instance: SposifyDatabase | null = null;

export function getSposifyDatabase(): SposifyDatabase {
  if (!instance) {
    instance = new SposifyDatabase();
  }
  return instance;
}

export function closeSposifyDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
