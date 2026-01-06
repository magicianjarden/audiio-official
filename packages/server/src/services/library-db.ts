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
  folderId?: string;
  createdAt: number;
  updatedAt: number;
  // Rule fields (optional - if present, playlist has smart/auto behavior)
  rules?: SmartPlaylistRule[];
  combinator?: 'and' | 'or';
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  source?: 'local' | 'streams' | 'all'; // Where to search: local library, streaming plugins, or both
  lastEvaluated?: number;
  ruleTrackCount?: number; // Count of tracks matched by rules
}

// Helper to check if playlist is rule-based
export function isRuleBasedPlaylist(playlist: Playlist): boolean {
  return Array.isArray(playlist.rules) && playlist.rules.length > 0;
}

export interface PlayHistoryEntry {
  trackId: string;
  track: Track;
  playedAt: number;
  duration: number; // How long they listened
}

export interface SmartPlaylist {
  id: string;
  name: string;
  description?: string;
  rules: SmartPlaylistRule[];
  combinator: 'and' | 'or';
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  folderId?: string;
  lastEvaluated?: number;
  trackCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SmartPlaylistRule {
  field: string;
  operator: string;
  value: unknown;
  pluginId?: string; // For plugin-provided rules
}

export interface PlaylistFolder {
  id: string;
  name: string;
  parentId?: string;
  position: number;
  isExpanded: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TrackPlayStats {
  trackId: string;
  playCount: number;
  skipCount: number;
  totalListenTime: number;
  lastPlayedAt?: number;
  firstPlayedAt?: number;
}

export interface CachedFingerprint {
  trackId: string;
  fingerprint: string;
  duration: number;
  createdAt: number;
}

// ========================================
// New Types for Advanced Features
// ========================================

export interface Tag {
  id: string;
  name: string;
  color: string;
  usageCount: number;
  createdAt: number;
}

export interface TrackTag {
  id: string;
  trackId: string;
  tagName: string;
  color?: string;
  createdAt: number;
}

export interface EntityTag {
  id: string;
  entityType: 'album' | 'artist' | 'playlist';
  entityId: string;
  tagName: string;
  createdAt: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  itemCount: number;
  folderId: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  itemType: 'album' | 'artist' | 'playlist' | 'track' | 'tag' | 'folder';
  itemId: string;
  itemData: Record<string, unknown>;
  parentFolderId: string | null; // For items inside a folder within the collection
  position: number;
  addedAt: number;
}

export interface PinnedItem {
  id: string;
  itemType: 'playlist' | 'album' | 'artist' | 'collection' | 'smart_playlist';
  itemId: string;
  itemData: Record<string, unknown>;
  position: number;
  pinnedAt: number;
}

export interface LibraryView {
  id: string;
  name: string;
  icon?: string;
  filters: Record<string, unknown>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  isBuiltIn: boolean;
  createdAt: number;
}

export interface AudioFeatures {
  trackId: string;
  energy: number;
  tempo: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  loudness: number;
  key: number;
  mode: number;
  timeSignature: number;
  analyzedAt: number;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  resultCount: number;
  searchedAt: number;
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

    // Smart playlists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS smart_playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        rules TEXT NOT NULL,
        combinator TEXT NOT NULL DEFAULT 'and',
        order_by TEXT,
        order_direction TEXT DEFAULT 'asc',
        max_limit INTEGER,
        folder_id TEXT,
        last_evaluated INTEGER,
        track_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES playlist_folders(id) ON DELETE SET NULL
      )
    `);

    // Playlist folders for hierarchy
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlist_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        is_expanded INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES playlist_folders(id) ON DELETE CASCADE
      )
    `);

    // Add folder_id to playlists if not exists
    try {
      this.db.exec(`ALTER TABLE playlists ADD COLUMN folder_id TEXT REFERENCES playlist_folders(id) ON DELETE SET NULL`);
    } catch {
      // Column already exists
    }

    // Add rule columns to playlists for unified playlist model (smart + manual)
    const playlistRuleColumns = [
      { name: 'rules', type: 'TEXT' },           // JSON array of rules
      { name: 'combinator', type: 'TEXT' },      // 'and' | 'or'
      { name: 'order_by', type: 'TEXT' },        // Sort field
      { name: 'order_direction', type: 'TEXT' }, // 'asc' | 'desc'
      { name: 'max_limit', type: 'INTEGER' },    // Max tracks from rules
      { name: 'source', type: 'TEXT' },          // 'local' | 'streams' | 'all'
      { name: 'last_evaluated', type: 'INTEGER' }, // Timestamp
      { name: 'rule_track_count', type: 'INTEGER' } // Cached count from rules
    ];

    for (const col of playlistRuleColumns) {
      try {
        this.db.exec(`ALTER TABLE playlists ADD COLUMN ${col.name} ${col.type}`);
      } catch {
        // Column already exists
      }
    }

    // Track play statistics (aggregated from play_history)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS track_play_stats (
        track_id TEXT PRIMARY KEY,
        play_count INTEGER NOT NULL DEFAULT 0,
        skip_count INTEGER NOT NULL DEFAULT 0,
        total_listen_time INTEGER NOT NULL DEFAULT 0,
        last_played_at INTEGER,
        first_played_at INTEGER
      )
    `);

    // Cached audio fingerprints
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cached_fingerprints (
        track_id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        duration INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Track metadata enrichments
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS track_enrichments (
        track_id TEXT PRIMARY KEY,
        enriched_data TEXT NOT NULL,
        provider_id TEXT,
        confidence REAL,
        enriched_at INTEGER NOT NULL
      )
    `);

    // ========================================
    // Advanced Features Tables
    // ========================================

    // Tag definitions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#6366f1',
        usage_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    // Track tags
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS track_tags (
        id TEXT PRIMARY KEY,
        track_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        color TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(track_id, tag_name)
      )
    `);

    // Entity tags (for albums, artists, playlists)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_tags (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(entity_type, entity_id, tag_name)
      )
    `);

    // Collections
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        cover_image TEXT,
        item_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Collection items (supports: album, artist, playlist, track, tag, folder)
    // Folders are items with item_type='folder', and other items can have parent_folder_id
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collection_items (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_data TEXT,
        parent_folder_id TEXT,
        position INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        UNIQUE(collection_id, item_type, item_id),
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      )
    `);

    // Add parent_folder_id to collection_items if not exists
    try {
      this.db.exec(`ALTER TABLE collection_items ADD COLUMN parent_folder_id TEXT`);
    } catch {
      // Column already exists
    }

    // Add position to collections if not exists (for sidebar ordering)
    try {
      this.db.exec(`ALTER TABLE collections ADD COLUMN position INTEGER DEFAULT 0`);
    } catch {
      // Column already exists
    }

    // Pinned items
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pinned_items (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_data TEXT,
        position INTEGER NOT NULL,
        pinned_at INTEGER NOT NULL,
        UNIQUE(item_type, item_id)
      )
    `);

    // Library views (saved filters)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS library_views (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        filters TEXT NOT NULL,
        sort_by TEXT,
        sort_direction TEXT,
        is_built_in INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    // Audio features for ML/search
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audio_features (
        track_id TEXT PRIMARY KEY,
        energy REAL,
        tempo REAL,
        valence REAL,
        danceability REAL,
        acousticness REAL,
        instrumentalness REAL,
        speechiness REAL,
        loudness REAL,
        key INTEGER,
        mode INTEGER,
        time_signature INTEGER,
        analyzed_at INTEGER
      )
    `);

    // Search history - ensure schema matches search-service.ts
    const searchHistoryInfo = this.db.prepare(`PRAGMA table_info(search_history)`).all() as Array<{ name: string }>;
    const searchCols = new Set(searchHistoryInfo.map(c => c.name));

    if (searchHistoryInfo.length === 0) {
      this.db.exec(`
        CREATE TABLE search_history (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          result_count INTEGER DEFAULT 0,
          timestamp INTEGER NOT NULL
        )
      `);
    } else if (searchCols.has('searched_at') && !searchCols.has('timestamp')) {
      // Migrate old schema
      this.db.exec(`DROP TABLE search_history`);
      this.db.exec(`
        CREATE TABLE search_history (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          result_count INTEGER DEFAULT 0,
          timestamp INTEGER NOT NULL
        )
      `);
    }

    // Plugin settings persistence
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plugin_settings (
        plugin_id TEXT PRIMARY KEY,
        settings TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
      )
    `);

    // Additional indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_smart_playlists_folder ON smart_playlists(folder_id);
      CREATE INDEX IF NOT EXISTS idx_playlist_folders_parent ON playlist_folders(parent_id);
      CREATE INDEX IF NOT EXISTS idx_playlists_folder ON playlists(folder_id);
      CREATE INDEX IF NOT EXISTS idx_track_play_stats_count ON track_play_stats(play_count DESC);
      CREATE INDEX IF NOT EXISTS idx_track_play_stats_last ON track_play_stats(last_played_at DESC);
    `);

    // Advanced feature indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_track_tags_track ON track_tags(track_id);
      CREATE INDEX IF NOT EXISTS idx_track_tags_name ON track_tags(tag_name);
      CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_entity_tags_name ON entity_tags(tag_name);
      CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
      CREATE INDEX IF NOT EXISTS idx_pinned_items_position ON pinned_items(position);
      CREATE INDEX IF NOT EXISTS idx_audio_features_energy ON audio_features(energy);
      CREATE INDEX IF NOT EXISTS idx_audio_features_tempo ON audio_features(tempo);
      CREATE INDEX IF NOT EXISTS idx_audio_features_valence ON audio_features(valence);
      CREATE INDEX IF NOT EXISTS idx_search_history_time ON search_history(timestamp DESC);
    `);

    // Seed built-in library views
    this.seedBuiltInLibraryViews();

    console.log('[LibraryDB] Database initialized');
  }

  private seedBuiltInLibraryViews(): void {
    const builtInViews = [
      { id: 'local-only', name: 'Local Only', icon: 'folder', filters: { source: 'local' } },
      { id: 'streaming', name: 'Streaming', icon: 'cloud', filters: { source: ['youtube', 'deezer'] } },
      { id: 'high-quality', name: 'High Quality', icon: 'sparkles', filters: { format: ['flac', 'wav', 'alac'] } },
      { id: 'downloaded', name: 'Downloaded', icon: 'download', filters: { isDownloaded: true } },
      { id: 'untagged', name: 'Untagged', icon: 'tag', filters: { hasTags: false } },
    ];

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO library_views (id, name, icon, filters, is_built_in, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `);

    const now = Date.now();
    for (const view of builtInViews) {
      stmt.run(view.id, view.name, view.icon, JSON.stringify(view.filters), now);
    }
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
      .all() as Array<{
        id: string;
        name: string;
        description: string | null;
        folder_id: string | null;
        rules: string | null;
        combinator: string | null;
        order_by: string | null;
        order_direction: string | null;
        max_limit: number | null;
        source: string | null;
        last_evaluated: number | null;
        rule_track_count: number | null;
        created_at: number;
        updated_at: number;
      }>;

    return playlists.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      folderId: p.folder_id ?? undefined,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      tracks: this.getPlaylistTracks(p.id),
      // Rule fields
      rules: p.rules ? JSON.parse(p.rules) : undefined,
      combinator: (p.combinator as 'and' | 'or') ?? undefined,
      orderBy: p.order_by ?? undefined,
      orderDirection: (p.order_direction as 'asc' | 'desc') ?? undefined,
      limit: p.max_limit ?? undefined,
      source: (p.source as 'local' | 'streams' | 'all') ?? undefined,
      lastEvaluated: p.last_evaluated ?? undefined,
      ruleTrackCount: p.rule_track_count ?? undefined
    }));
  }

  getPlaylist(playlistId: string): Playlist | null {
    const row = this.db
      .prepare('SELECT * FROM playlists WHERE id = ?')
      .get(playlistId) as {
        id: string;
        name: string;
        description: string | null;
        folder_id: string | null;
        rules: string | null;
        combinator: string | null;
        order_by: string | null;
        order_direction: string | null;
        max_limit: number | null;
        source: string | null;
        last_evaluated: number | null;
        rule_track_count: number | null;
        created_at: number;
        updated_at: number;
      } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      folderId: row.folder_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tracks: this.getPlaylistTracks(row.id),
      // Rule fields
      rules: row.rules ? JSON.parse(row.rules) : undefined,
      combinator: (row.combinator as 'and' | 'or') ?? undefined,
      orderBy: row.order_by ?? undefined,
      orderDirection: (row.order_direction as 'asc' | 'desc') ?? undefined,
      limit: row.max_limit ?? undefined,
      source: (row.source as 'local' | 'streams' | 'all') ?? undefined,
      lastEvaluated: row.last_evaluated ?? undefined,
      ruleTrackCount: row.rule_track_count ?? undefined
    };
  }

  private getPlaylistTracks(playlistId: string): Track[] {
    const rows = this.db
      .prepare('SELECT track_data FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC')
      .all(playlistId) as { track_data: string }[];

    return rows.map(row => JSON.parse(row.track_data));
  }

  createPlaylist(name: string, description?: string, options?: {
    folderId?: string;
    rules?: SmartPlaylistRule[];
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    source?: 'local' | 'streams' | 'all';
  }): Playlist {
    const id = nanoid();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO playlists (
        id, name, description, folder_id, rules, combinator,
        order_by, order_direction, max_limit, source, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description || null,
      options?.folderId || null,
      options?.rules ? JSON.stringify(options.rules) : null,
      options?.combinator || null,
      options?.orderBy || null,
      options?.orderDirection || null,
      options?.limit || null,
      options?.source || null,
      now,
      now
    );

    return {
      id,
      name,
      description,
      folderId: options?.folderId,
      tracks: [],
      createdAt: now,
      updatedAt: now,
      rules: options?.rules,
      combinator: options?.combinator,
      orderBy: options?.orderBy,
      orderDirection: options?.orderDirection,
      limit: options?.limit,
      source: options?.source
    };
  }

  updatePlaylist(playlistId: string, data: Partial<{
    name: string;
    description: string;
    folderId: string | null;
    rules: SmartPlaylistRule[] | null;
    combinator: 'and' | 'or';
    orderBy: string | null;
    orderDirection: 'asc' | 'desc';
    limit: number | null;
    source: 'local' | 'streams' | 'all' | null;
    lastEvaluated: number;
    ruleTrackCount: number;
  }>): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.folderId !== undefined) {
      updates.push('folder_id = ?');
      values.push(data.folderId);
    }
    if (data.rules !== undefined) {
      updates.push('rules = ?');
      values.push(data.rules ? JSON.stringify(data.rules) : null);
    }
    if (data.combinator !== undefined) {
      updates.push('combinator = ?');
      values.push(data.combinator);
    }
    if (data.orderBy !== undefined) {
      updates.push('order_by = ?');
      values.push(data.orderBy);
    }
    if (data.orderDirection !== undefined) {
      updates.push('order_direction = ?');
      values.push(data.orderDirection);
    }
    if (data.limit !== undefined) {
      updates.push('max_limit = ?');
      values.push(data.limit);
    }
    if (data.source !== undefined) {
      updates.push('source = ?');
      values.push(data.source);
    }
    if (data.lastEvaluated !== undefined) {
      updates.push('last_evaluated = ?');
      values.push(data.lastEvaluated);
    }
    if (data.ruleTrackCount !== undefined) {
      updates.push('rule_track_count = ?');
      values.push(data.ruleTrackCount);
    }

    if (updates.length === 0) return;

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(playlistId);

    this.db.prepare(`UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`).run(...values);
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
    smartPlaylistCount: number;
    folderCount: number;
  } {
    const liked = this.db.prepare('SELECT COUNT(*) as count FROM liked_tracks').get() as { count: number };
    const disliked = this.db.prepare('SELECT COUNT(*) as count FROM disliked_tracks').get() as { count: number };
    const playlists = this.db.prepare('SELECT COUNT(*) as count FROM playlists').get() as { count: number };
    const history = this.db.prepare('SELECT COUNT(*) as count FROM play_history').get() as { count: number };
    const smartPlaylists = this.db.prepare('SELECT COUNT(*) as count FROM smart_playlists').get() as { count: number };
    const folders = this.db.prepare('SELECT COUNT(*) as count FROM playlist_folders').get() as { count: number };

    return {
      likedCount: liked.count,
      dislikedCount: disliked.count,
      playlistCount: playlists.count,
      historyCount: history.count,
      smartPlaylistCount: smartPlaylists.count,
      folderCount: folders.count
    };
  }

  // ========================================
  // Smart Playlists
  // ========================================

  getSmartPlaylists(): SmartPlaylist[] {
    const rows = this.db
      .prepare('SELECT * FROM smart_playlists ORDER BY updated_at DESC')
      .all() as Array<{
        id: string;
        name: string;
        description: string | null;
        rules: string;
        combinator: string;
        order_by: string | null;
        order_direction: string | null;
        max_limit: number | null;
        folder_id: string | null;
        last_evaluated: number | null;
        track_count: number;
        created_at: number;
        updated_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      rules: JSON.parse(row.rules),
      combinator: row.combinator as 'and' | 'or',
      orderBy: row.order_by ?? undefined,
      orderDirection: (row.order_direction as 'asc' | 'desc') ?? undefined,
      limit: row.max_limit ?? undefined,
      folderId: row.folder_id ?? undefined,
      lastEvaluated: row.last_evaluated ?? undefined,
      trackCount: row.track_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  getSmartPlaylist(id: string): SmartPlaylist | null {
    const row = this.db
      .prepare('SELECT * FROM smart_playlists WHERE id = ?')
      .get(id) as {
        id: string;
        name: string;
        description: string | null;
        rules: string;
        combinator: string;
        order_by: string | null;
        order_direction: string | null;
        max_limit: number | null;
        folder_id: string | null;
        last_evaluated: number | null;
        track_count: number;
        created_at: number;
        updated_at: number;
      } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      rules: JSON.parse(row.rules),
      combinator: row.combinator as 'and' | 'or',
      orderBy: row.order_by ?? undefined,
      orderDirection: (row.order_direction as 'asc' | 'desc') ?? undefined,
      limit: row.max_limit ?? undefined,
      folderId: row.folder_id ?? undefined,
      lastEvaluated: row.last_evaluated ?? undefined,
      trackCount: row.track_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  createSmartPlaylist(data: {
    name: string;
    description?: string;
    rules: SmartPlaylistRule[];
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    folderId?: string;
  }): SmartPlaylist {
    const id = nanoid();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO smart_playlists (
        id, name, description, rules, combinator, order_by, order_direction,
        max_limit, folder_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description ?? null,
      JSON.stringify(data.rules),
      data.combinator ?? 'and',
      data.orderBy ?? null,
      data.orderDirection ?? 'asc',
      data.limit ?? null,
      data.folderId ?? null,
      now,
      now
    );

    return {
      id,
      name: data.name,
      description: data.description,
      rules: data.rules,
      combinator: data.combinator ?? 'and',
      orderBy: data.orderBy,
      orderDirection: data.orderDirection,
      limit: data.limit,
      folderId: data.folderId,
      trackCount: 0,
      createdAt: now,
      updatedAt: now
    };
  }

  updateSmartPlaylist(id: string, data: Partial<{
    name: string;
    description: string;
    rules: SmartPlaylistRule[];
    combinator: 'and' | 'or';
    orderBy: string;
    orderDirection: 'asc' | 'desc';
    limit: number;
    folderId: string;
    trackCount: number;
    lastEvaluated: number;
  }>): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.rules !== undefined) {
      updates.push('rules = ?');
      values.push(JSON.stringify(data.rules));
    }
    if (data.combinator !== undefined) {
      updates.push('combinator = ?');
      values.push(data.combinator);
    }
    if (data.orderBy !== undefined) {
      updates.push('order_by = ?');
      values.push(data.orderBy);
    }
    if (data.orderDirection !== undefined) {
      updates.push('order_direction = ?');
      values.push(data.orderDirection);
    }
    if (data.limit !== undefined) {
      updates.push('max_limit = ?');
      values.push(data.limit);
    }
    if (data.folderId !== undefined) {
      updates.push('folder_id = ?');
      values.push(data.folderId);
    }
    if (data.trackCount !== undefined) {
      updates.push('track_count = ?');
      values.push(data.trackCount);
    }
    if (data.lastEvaluated !== undefined) {
      updates.push('last_evaluated = ?');
      values.push(data.lastEvaluated);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    this.db.prepare(`UPDATE smart_playlists SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteSmartPlaylist(id: string): void {
    this.db.prepare('DELETE FROM smart_playlists WHERE id = ?').run(id);
  }

  // ========================================
  // Playlist Folders
  // ========================================

  getPlaylistFolders(): PlaylistFolder[] {
    const rows = this.db
      .prepare('SELECT * FROM playlist_folders ORDER BY position ASC')
      .all() as Array<{
        id: string;
        name: string;
        parent_id: string | null;
        position: number;
        is_expanded: number;
        created_at: number;
        updated_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id ?? undefined,
      position: row.position,
      isExpanded: row.is_expanded === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  getPlaylistFolder(id: string): PlaylistFolder | null {
    const row = this.db
      .prepare('SELECT * FROM playlist_folders WHERE id = ?')
      .get(id) as {
        id: string;
        name: string;
        parent_id: string | null;
        position: number;
        is_expanded: number;
        created_at: number;
        updated_at: number;
      } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id ?? undefined,
      position: row.position,
      isExpanded: row.is_expanded === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  createPlaylistFolder(name: string, parentId?: string): PlaylistFolder {
    const id = nanoid();
    const now = Date.now();

    // Get max position in parent
    const maxPos = this.db
      .prepare('SELECT MAX(position) as max FROM playlist_folders WHERE parent_id IS ?')
      .get(parentId ?? null) as { max: number | null };

    const position = (maxPos.max ?? -1) + 1;

    this.db.prepare(`
      INSERT INTO playlist_folders (id, name, parent_id, position, is_expanded, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, parentId ?? null, position, 1, now, now);

    return {
      id,
      name,
      parentId,
      position,
      isExpanded: true,
      createdAt: now,
      updatedAt: now
    };
  }

  updatePlaylistFolder(id: string, data: Partial<{
    name: string;
    parentId: string;
    position: number;
    isExpanded: boolean;
  }>): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.parentId !== undefined) {
      updates.push('parent_id = ?');
      values.push(data.parentId);
    }
    if (data.position !== undefined) {
      updates.push('position = ?');
      values.push(data.position);
    }
    if (data.isExpanded !== undefined) {
      updates.push('is_expanded = ?');
      values.push(data.isExpanded ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    this.db.prepare(`UPDATE playlist_folders SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  deletePlaylistFolder(id: string): void {
    // Will cascade delete child folders
    this.db.prepare('DELETE FROM playlist_folders WHERE id = ?').run(id);
  }

  movePlaylistToFolder(playlistId: string, folderId: string | null): void {
    this.db.prepare('UPDATE playlists SET folder_id = ?, updated_at = ? WHERE id = ?')
      .run(folderId, Date.now(), playlistId);
  }

  moveSmartPlaylistToFolder(playlistId: string, folderId: string | null): void {
    this.db.prepare('UPDATE smart_playlists SET folder_id = ?, updated_at = ? WHERE id = ?')
      .run(folderId, Date.now(), playlistId);
  }

  // ========================================
  // Track Play Statistics
  // ========================================

  getTrackPlayStats(trackId: string): TrackPlayStats | null {
    const row = this.db
      .prepare('SELECT * FROM track_play_stats WHERE track_id = ?')
      .get(trackId) as {
        track_id: string;
        play_count: number;
        skip_count: number;
        total_listen_time: number;
        last_played_at: number | null;
        first_played_at: number | null;
      } | undefined;

    if (!row) return null;

    return {
      trackId: row.track_id,
      playCount: row.play_count,
      skipCount: row.skip_count,
      totalListenTime: row.total_listen_time,
      lastPlayedAt: row.last_played_at ?? undefined,
      firstPlayedAt: row.first_played_at ?? undefined
    };
  }

  incrementPlayCount(trackId: string, listenDuration: number = 0): void {
    const now = Date.now();
    const existing = this.getTrackPlayStats(trackId);

    if (existing) {
      this.db.prepare(`
        UPDATE track_play_stats SET
          play_count = play_count + 1,
          total_listen_time = total_listen_time + ?,
          last_played_at = ?
        WHERE track_id = ?
      `).run(listenDuration, now, trackId);
    } else {
      this.db.prepare(`
        INSERT INTO track_play_stats (track_id, play_count, skip_count, total_listen_time, last_played_at, first_played_at)
        VALUES (?, 1, 0, ?, ?, ?)
      `).run(trackId, listenDuration, now, now);
    }
  }

  incrementSkipCount(trackId: string): void {
    const existing = this.getTrackPlayStats(trackId);

    if (existing) {
      this.db.prepare('UPDATE track_play_stats SET skip_count = skip_count + 1 WHERE track_id = ?')
        .run(trackId);
    } else {
      this.db.prepare(`
        INSERT INTO track_play_stats (track_id, play_count, skip_count, total_listen_time)
        VALUES (?, 0, 1, 0)
      `).run(trackId);
    }
  }

  getMostPlayedTracks(limit: number = 50): Array<{ trackId: string; playCount: number }> {
    const rows = this.db
      .prepare('SELECT track_id, play_count FROM track_play_stats ORDER BY play_count DESC LIMIT ?')
      .all(limit) as Array<{ track_id: string; play_count: number }>;

    return rows.map(row => ({
      trackId: row.track_id,
      playCount: row.play_count
    }));
  }

  // ========================================
  // Cached Fingerprints
  // ========================================

  getCachedFingerprint(trackId: string): CachedFingerprint | null {
    const row = this.db
      .prepare('SELECT * FROM cached_fingerprints WHERE track_id = ?')
      .get(trackId) as {
        track_id: string;
        fingerprint: string;
        duration: number;
        created_at: number;
      } | undefined;

    if (!row) return null;

    return {
      trackId: row.track_id,
      fingerprint: row.fingerprint,
      duration: row.duration,
      createdAt: row.created_at
    };
  }

  cacheFingerprint(trackId: string, fingerprint: string, duration: number): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO cached_fingerprints (track_id, fingerprint, duration, created_at)
      VALUES (?, ?, ?, ?)
    `).run(trackId, fingerprint, duration, Date.now());
  }

  deleteCachedFingerprint(trackId: string): void {
    this.db.prepare('DELETE FROM cached_fingerprints WHERE track_id = ?').run(trackId);
  }

  // ========================================
  // Track Enrichments
  // ========================================

  getTrackEnrichment(trackId: string): {
    trackId: string;
    enrichedData: Record<string, unknown>;
    providerId?: string;
    confidence?: number;
    enrichedAt: number;
  } | null {
    const row = this.db
      .prepare('SELECT * FROM track_enrichments WHERE track_id = ?')
      .get(trackId) as {
        track_id: string;
        enriched_data: string;
        provider_id: string | null;
        confidence: number | null;
        enriched_at: number;
      } | undefined;

    if (!row) return null;

    return {
      trackId: row.track_id,
      enrichedData: JSON.parse(row.enriched_data),
      providerId: row.provider_id ?? undefined,
      confidence: row.confidence ?? undefined,
      enrichedAt: row.enriched_at
    };
  }

  saveTrackEnrichment(
    trackId: string,
    enrichedData: Record<string, unknown>,
    providerId?: string,
    confidence?: number
  ): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO track_enrichments (track_id, enriched_data, provider_id, confidence, enriched_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(trackId, JSON.stringify(enrichedData), providerId ?? null, confidence ?? null, Date.now());
  }

  deleteTrackEnrichment(trackId: string): void {
    this.db.prepare('DELETE FROM track_enrichments WHERE track_id = ?').run(trackId);
  }

  // ========================================
  // Smart Playlist Evaluation
  // ========================================

  /**
   * Evaluate a smart playlist's rules against the library
   * Returns matching track IDs
   */
  evaluateSmartPlaylistRules(
    rules: SmartPlaylistRule[],
    combinator: 'and' | 'or',
    orderBy?: string,
    orderDirection?: 'asc' | 'desc',
    limit?: number
  ): string[] {
    // Build query based on rules
    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const rule of rules) {
      // Skip plugin-provided rules - they need custom handling
      if (rule.pluginId) continue;

      const condition = this.buildRuleCondition(rule);
      if (condition) {
        conditions.push(condition.sql);
        params.push(...condition.params);
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    const joiner = combinator === 'and' ? ' AND ' : ' OR ';
    let sql = `
      SELECT DISTINCT track_id FROM (
        SELECT id as track_id, track_data FROM liked_tracks
        UNION
        SELECT track_id, track_data FROM playlist_tracks
        UNION
        SELECT track_id, track_data FROM play_history
      ) as all_tracks
      WHERE ${conditions.join(joiner)}
    `;

    if (orderBy) {
      const dir = orderDirection === 'desc' ? 'DESC' : 'ASC';
      // Map orderBy to valid column
      const orderColumn = this.mapOrderColumn(orderBy);
      if (orderColumn) {
        sql += ` ORDER BY ${orderColumn} ${dir}`;
      }
    }

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{ track_id: string }>;
    return rows.map(r => r.track_id);
  }

  /**
   * Get tracks by their IDs from all sources (liked, playlists, history)
   */
  getTracksByIds(trackIds: string[]): Track[] {
    if (trackIds.length === 0) return [];

    const placeholders = trackIds.map(() => '?').join(',');
    const sql = `
      SELECT DISTINCT track_id, track_data FROM (
        SELECT id as track_id, track_data FROM liked_tracks WHERE id IN (${placeholders})
        UNION
        SELECT track_id, track_data FROM playlist_tracks WHERE track_id IN (${placeholders})
        UNION
        SELECT track_id, track_data FROM play_history WHERE track_id IN (${placeholders})
      )
    `;

    // Repeat trackIds for each UNION clause
    const params = [...trackIds, ...trackIds, ...trackIds];
    const rows = this.db.prepare(sql).all(...params) as Array<{ track_id: string; track_data: string }>;

    // Create a map for O(1) lookup
    const trackMap = new Map<string, Track>();
    for (const row of rows) {
      if (!trackMap.has(row.track_id)) {
        trackMap.set(row.track_id, JSON.parse(row.track_data));
      }
    }

    // Preserve the order of trackIds
    return trackIds.map(id => trackMap.get(id)).filter((t): t is Track => t !== undefined);
  }

  private buildRuleCondition(rule: SmartPlaylistRule): { sql: string; params: unknown[] } | null {
    const { field, operator, value } = rule;

    // Handle different field types
    switch (field) {
      case 'isLiked':
        if (operator === 'is' && value === true) {
          return { sql: 'track_id IN (SELECT id FROM liked_tracks)', params: [] };
        } else if (operator === 'is' && value === false) {
          return { sql: 'track_id NOT IN (SELECT id FROM liked_tracks)', params: [] };
        }
        break;

      case 'playCount':
        const countJoin = `(SELECT COALESCE(play_count, 0) FROM track_play_stats WHERE track_id = all_tracks.track_id)`;
        return this.buildNumberCondition(countJoin, operator, value as number);

      case 'lastPlayed':
        if (operator === 'never') {
          return { sql: 'track_id NOT IN (SELECT DISTINCT track_id FROM play_history)', params: [] };
        }
        const lastPlayedJoin = `(SELECT last_played_at FROM track_play_stats WHERE track_id = all_tracks.track_id)`;
        return this.buildDateCondition(lastPlayedJoin, operator, value);

      case 'addedAt':
        // Use liked_at from liked_tracks as proxy for "added"
        const addedJoin = `(SELECT liked_at FROM liked_tracks WHERE id = all_tracks.track_id)`;
        return this.buildDateCondition(addedJoin, operator, value);

      // String fields from track_data JSON
      case 'title':
      case 'artist':
      case 'album':
      case 'genre':
        return this.buildJsonStringCondition(field, operator, value as string);

      case 'year':
      case 'duration':
        return this.buildJsonNumberCondition(field, operator, value);

      case 'hasTag':
        // Check if track has a specific tag
        if (operator === 'is') {
          return { sql: 'track_id IN (SELECT track_id FROM track_tags WHERE tag_name = ?)', params: [value] };
        } else if (operator === 'contains') {
          return { sql: 'track_id IN (SELECT track_id FROM track_tags WHERE tag_name LIKE ?)', params: [`%${value}%`] };
        }
        break;

      case 'skipCount':
        const skipJoin = `(SELECT COALESCE(skip_count, 0) FROM track_play_stats WHERE track_id = all_tracks.track_id)`;
        return this.buildNumberCondition(skipJoin, operator, value as number);

      default:
        return null;
    }

    return null;
  }

  private buildNumberCondition(column: string, operator: string, value: number): { sql: string; params: unknown[] } {
    switch (operator) {
      case 'is': return { sql: `${column} = ?`, params: [value] };
      case 'is_not': return { sql: `${column} != ?`, params: [value] };
      case 'gt': return { sql: `${column} > ?`, params: [value] };
      case 'lt': return { sql: `${column} < ?`, params: [value] };
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return { sql: `${column} BETWEEN ? AND ?`, params: value };
        }
        break;
    }
    return { sql: '1=1', params: [] };
  }

  private buildDateCondition(column: string, operator: string, value: unknown): { sql: string; params: unknown[] } {
    const now = Date.now();

    switch (operator) {
      case 'in_last':
        // value is number of days
        const sinceMs = now - (value as number) * 24 * 60 * 60 * 1000;
        return { sql: `${column} >= ?`, params: [sinceMs] };

      case 'not_in_last':
        const beforeMs = now - (value as number) * 24 * 60 * 60 * 1000;
        return { sql: `${column} < ?`, params: [beforeMs] };

      case 'before':
        return { sql: `${column} < ?`, params: [value] };

      case 'after':
        return { sql: `${column} > ?`, params: [value] };
    }

    return { sql: '1=1', params: [] };
  }

  private buildJsonStringCondition(field: string, operator: string, value: string): { sql: string; params: unknown[] } {
    // Map field names to correct JSON paths based on UnifiedTrack structure
    let jsonPath: string;
    switch (field) {
      case 'artist':
        // artists is an array of {name, id}, extract first artist's name
        jsonPath = `json_extract(track_data, '$.artists[0].name')`;
        break;
      case 'album':
        // album is an object with name property
        jsonPath = `json_extract(track_data, '$.album.name')`;
        break;
      default:
        jsonPath = `json_extract(track_data, '$.${field}')`;
    }

    switch (operator) {
      case 'contains':
        return { sql: `${jsonPath} LIKE ?`, params: [`%${value}%`] };
      case 'not_contains':
        return { sql: `${jsonPath} NOT LIKE ?`, params: [`%${value}%`] };
      case 'is':
        return { sql: `${jsonPath} = ?`, params: [value] };
      case 'is_not':
        return { sql: `${jsonPath} != ?`, params: [value] };
      case 'starts_with':
        return { sql: `${jsonPath} LIKE ?`, params: [`${value}%`] };
      case 'ends_with':
        return { sql: `${jsonPath} LIKE ?`, params: [`%${value}`] };
    }

    return { sql: '1=1', params: [] };
  }

  private buildJsonNumberCondition(field: string, operator: string, value: unknown): { sql: string; params: unknown[] } {
    const jsonPath = `json_extract(track_data, '$.${field}')`;
    return this.buildNumberCondition(jsonPath, operator, value as number);
  }

  private mapOrderColumn(orderBy: string): string | null {
    const mapping: Record<string, string> = {
      'title': "json_extract(track_data, '$.title')",
      'artist': "json_extract(track_data, '$.artists[0].name')",
      'album': "json_extract(track_data, '$.album.name')",
      'duration': "json_extract(track_data, '$.duration')",
      'playCount': '(SELECT play_count FROM track_play_stats WHERE track_id = all_tracks.track_id)',
      'lastPlayed': '(SELECT last_played_at FROM track_play_stats WHERE track_id = all_tracks.track_id)',
      'addedAt': '(SELECT liked_at FROM liked_tracks WHERE id = all_tracks.track_id)',
      'random': 'RANDOM()'
    };
    return mapping[orderBy] ?? null;
  }

  // ========================================
  // Tags
  // ========================================

  getTags(): Tag[] {
    const rows = this.db
      .prepare('SELECT * FROM tags ORDER BY usage_count DESC, name ASC')
      .all() as Array<{
        id: string;
        name: string;
        color: string;
        usage_count: number;
        created_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      usageCount: row.usage_count,
      createdAt: row.created_at
    }));
  }

  getTag(id: string): Tag | null {
    const row = this.db
      .prepare('SELECT * FROM tags WHERE id = ?')
      .get(id) as {
        id: string;
        name: string;
        color: string;
        usage_count: number;
        created_at: number;
      } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      color: row.color,
      usageCount: row.usage_count,
      createdAt: row.created_at
    };
  }

  getTagByName(name: string): Tag | null {
    const row = this.db
      .prepare('SELECT * FROM tags WHERE name = ?')
      .get(name) as {
        id: string;
        name: string;
        color: string;
        usage_count: number;
        created_at: number;
      } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      color: row.color,
      usageCount: row.usage_count,
      createdAt: row.created_at
    };
  }

  createTag(name: string, color?: string): Tag {
    const id = nanoid();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO tags (id, name, color, usage_count, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(id, name, color ?? '#6366f1', now);

    return {
      id,
      name,
      color: color ?? '#6366f1',
      usageCount: 0,
      createdAt: now
    };
  }

  updateTag(id: string, data: Partial<{ name: string; color: string }>): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      values.push(data.color);
    }

    if (updates.length === 0) return;
    values.push(id);

    this.db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteTag(id: string): void {
    const tag = this.getTag(id);
    if (!tag) return;

    // Delete all track_tags and entity_tags with this tag name
    this.db.prepare('DELETE FROM track_tags WHERE tag_name = ?').run(tag.name);
    this.db.prepare('DELETE FROM entity_tags WHERE tag_name = ?').run(tag.name);
    this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  }

  // Track Tags
  getTrackTags(trackId: string): TrackTag[] {
    const rows = this.db
      .prepare('SELECT * FROM track_tags WHERE track_id = ? ORDER BY created_at ASC')
      .all(trackId) as Array<{
        id: string;
        track_id: string;
        tag_name: string;
        color: string | null;
        created_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      trackId: row.track_id,
      tagName: row.tag_name,
      color: row.color ?? undefined,
      createdAt: row.created_at
    }));
  }

  getTracksByTag(tagName: string): string[] {
    const rows = this.db
      .prepare('SELECT track_id FROM track_tags WHERE tag_name = ?')
      .all(tagName) as Array<{ track_id: string }>;

    return rows.map(r => r.track_id);
  }

  addTagToTrack(trackId: string, tagName: string, color?: string): TrackTag {
    const id = nanoid();
    const now = Date.now();

    // Ensure tag exists
    let tag = this.getTagByName(tagName);
    if (!tag) {
      tag = this.createTag(tagName, color);
    }

    this.db.prepare(`
      INSERT OR IGNORE INTO track_tags (id, track_id, tag_name, color, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, trackId, tagName, color ?? tag.color, now);

    // Update usage count
    this.db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE name = ?').run(tagName);

    return {
      id,
      trackId,
      tagName,
      color: color ?? tag.color,
      createdAt: now
    };
  }

  removeTagFromTrack(trackId: string, tagName: string): void {
    const result = this.db.prepare('DELETE FROM track_tags WHERE track_id = ? AND tag_name = ?')
      .run(trackId, tagName);

    if (result.changes > 0) {
      this.db.prepare('UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE name = ?').run(tagName);
    }
  }

  // Entity Tags
  getEntityTags(entityType: string, entityId: string): EntityTag[] {
    const rows = this.db
      .prepare('SELECT * FROM entity_tags WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC')
      .all(entityType, entityId) as Array<{
        id: string;
        entity_type: string;
        entity_id: string;
        tag_name: string;
        created_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      entityType: row.entity_type as 'album' | 'artist' | 'playlist',
      entityId: row.entity_id,
      tagName: row.tag_name,
      createdAt: row.created_at
    }));
  }

  addTagToEntity(entityType: string, entityId: string, tagName: string): EntityTag {
    const id = nanoid();
    const now = Date.now();

    // Ensure tag exists
    if (!this.getTagByName(tagName)) {
      this.createTag(tagName);
    }

    this.db.prepare(`
      INSERT OR IGNORE INTO entity_tags (id, entity_type, entity_id, tag_name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, entityType, entityId, tagName, now);

    this.db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE name = ?').run(tagName);

    return {
      id,
      entityType: entityType as 'album' | 'artist' | 'playlist',
      entityId,
      tagName,
      createdAt: now
    };
  }

  removeTagFromEntity(entityType: string, entityId: string, tagName: string): void {
    const result = this.db.prepare('DELETE FROM entity_tags WHERE entity_type = ? AND entity_id = ? AND tag_name = ?')
      .run(entityType, entityId, tagName);

    if (result.changes > 0) {
      this.db.prepare('UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE name = ?').run(tagName);
    }
  }

  // ========================================
  // Collections
  // ========================================

  getCollections(): Collection[] {
    const rows = this.db
      .prepare('SELECT * FROM collections ORDER BY position ASC, updated_at DESC')
      .all() as Array<{
        id: string;
        name: string;
        description: string | null;
        cover_image: string | null;
        item_count: number;
        folder_id: string | null;
        position: number | null;
        created_at: number;
        updated_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      coverImage: row.cover_image ?? undefined,
      itemCount: row.item_count,
      folderId: row.folder_id,
      position: row.position ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  getCollection(id: string): Collection | null {
    const row = this.db
      .prepare('SELECT * FROM collections WHERE id = ?')
      .get(id) as {
        id: string;
        name: string;
        description: string | null;
        cover_image: string | null;
        item_count: number;
        folder_id: string | null;
        position: number | null;
        created_at: number;
        updated_at: number;
      } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      coverImage: row.cover_image ?? undefined,
      itemCount: row.item_count,
      folderId: row.folder_id,
      position: row.position ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  createCollection(name: string, description?: string, folderId?: string): Collection {
    const id = nanoid();
    const now = Date.now();

    // Get max position for this folder level
    const maxPos = this.db
      .prepare('SELECT MAX(position) as max FROM collections WHERE folder_id IS ?')
      .get(folderId ?? null) as { max: number | null };
    const position = (maxPos.max ?? -1) + 1;

    this.db.prepare(`
      INSERT INTO collections (id, name, description, item_count, folder_id, position, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    `).run(id, name, description ?? null, folderId ?? null, position, now, now);

    return {
      id,
      name,
      description,
      itemCount: 0,
      folderId: folderId ?? null,
      position,
      createdAt: now,
      updatedAt: now
    };
  }

  updateCollection(id: string, data: Partial<{ name: string; description: string; coverImage: string }>): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.coverImage !== undefined) {
      updates.push('cover_image = ?');
      values.push(data.coverImage);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    this.db.prepare(`UPDATE collections SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteCollection(id: string): void {
    // Items will cascade delete
    this.db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  }

  getCollectionItems(collectionId: string, parentFolderId?: string | null): CollectionItem[] {
    let query = 'SELECT * FROM collection_items WHERE collection_id = ?';
    const params: (string | null)[] = [collectionId];

    if (parentFolderId === null) {
      query += ' AND parent_folder_id IS NULL';
    } else if (parentFolderId !== undefined) {
      query += ' AND parent_folder_id = ?';
      params.push(parentFolderId);
    }

    query += ' ORDER BY position ASC';

    const rows = this.db
      .prepare(query)
      .all(...params) as Array<{
        id: string;
        collection_id: string;
        item_type: string;
        item_id: string;
        item_data: string | null;
        parent_folder_id: string | null;
        position: number;
        added_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      collectionId: row.collection_id,
      itemType: row.item_type as CollectionItem['itemType'],
      itemId: row.item_id,
      itemData: row.item_data ? JSON.parse(row.item_data) : {},
      parentFolderId: row.parent_folder_id,
      position: row.position,
      addedAt: row.added_at
    }));
  }

  addToCollection(
    collectionId: string,
    itemType: string,
    itemId: string,
    itemData?: Record<string, unknown>,
    parentFolderId?: string | null
  ): CollectionItem {
    const id = nanoid();
    const now = Date.now();

    // Get max position within the same parent folder
    let posQuery = 'SELECT MAX(position) as max FROM collection_items WHERE collection_id = ?';
    const posParams: (string | null)[] = [collectionId];
    if (parentFolderId) {
      posQuery += ' AND parent_folder_id = ?';
      posParams.push(parentFolderId);
    } else {
      posQuery += ' AND parent_folder_id IS NULL';
    }

    const maxPos = this.db
      .prepare(posQuery)
      .get(...posParams) as { max: number | null };

    const position = (maxPos.max ?? -1) + 1;

    this.db.prepare(`
      INSERT OR IGNORE INTO collection_items (id, collection_id, item_type, item_id, item_data, parent_folder_id, position, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, collectionId, itemType, itemId, itemData ? JSON.stringify(itemData) : null, parentFolderId ?? null, position, now);

    // Update collection item count and timestamp
    this.db.prepare('UPDATE collections SET item_count = item_count + 1, updated_at = ? WHERE id = ?')
      .run(now, collectionId);

    return {
      id,
      collectionId,
      itemType: itemType as CollectionItem['itemType'],
      itemId,
      itemData: itemData ?? {},
      parentFolderId: parentFolderId ?? null,
      position,
      addedAt: now
    };
  }

  removeFromCollection(collectionId: string, itemId: string): void {
    const result = this.db.prepare('DELETE FROM collection_items WHERE collection_id = ? AND item_id = ?')
      .run(collectionId, itemId);

    if (result.changes > 0) {
      this.db.prepare('UPDATE collections SET item_count = MAX(0, item_count - 1), updated_at = ? WHERE id = ?')
        .run(Date.now(), collectionId);
    }
  }

  reorderCollectionItems(collectionId: string, itemIds: string[], parentFolderId?: string | null): void {
    const stmt = this.db.prepare('UPDATE collection_items SET position = ? WHERE collection_id = ? AND item_id = ?');

    for (let i = 0; i < itemIds.length; i++) {
      stmt.run(i, collectionId, itemIds[i]);
    }

    this.db.prepare('UPDATE collections SET updated_at = ? WHERE id = ?').run(Date.now(), collectionId);
  }

  // Move an item to a different folder within the same collection
  moveCollectionItemToFolder(collectionId: string, itemId: string, targetFolderId: string | null): void {
    // Get max position in target folder
    let posQuery = 'SELECT MAX(position) as max FROM collection_items WHERE collection_id = ?';
    const posParams: (string | null)[] = [collectionId];
    if (targetFolderId) {
      posQuery += ' AND parent_folder_id = ?';
      posParams.push(targetFolderId);
    } else {
      posQuery += ' AND parent_folder_id IS NULL';
    }

    const maxPos = this.db
      .prepare(posQuery)
      .get(...posParams) as { max: number | null };
    const position = (maxPos.max ?? -1) + 1;

    this.db.prepare('UPDATE collection_items SET parent_folder_id = ?, position = ? WHERE collection_id = ? AND item_id = ?')
      .run(targetFolderId, position, collectionId, itemId);

    this.db.prepare('UPDATE collections SET updated_at = ? WHERE id = ?')
      .run(Date.now(), collectionId);
  }

  // Create a folder within a collection
  createCollectionItemFolder(collectionId: string, name: string, parentFolderId?: string | null): CollectionItem {
    const folderId = nanoid();
    return this.addToCollection(
      collectionId,
      'folder',
      folderId,
      { name, isExpanded: true },
      parentFolderId
    );
  }

  // Update a folder's name within a collection
  updateCollectionItemFolder(collectionId: string, itemId: string, data: { name?: string; isExpanded?: boolean }): void {
    const item = this.db
      .prepare('SELECT item_data FROM collection_items WHERE collection_id = ? AND item_id = ? AND item_type = ?')
      .get(collectionId, itemId, 'folder') as { item_data: string | null } | undefined;

    if (item) {
      const currentData = item.item_data ? JSON.parse(item.item_data) : {};
      const newData = { ...currentData, ...data };

      this.db.prepare('UPDATE collection_items SET item_data = ? WHERE collection_id = ? AND item_id = ?')
        .run(JSON.stringify(newData), collectionId, itemId);

      this.db.prepare('UPDATE collections SET updated_at = ? WHERE id = ?')
        .run(Date.now(), collectionId);
    }
  }

  // Delete a folder and optionally move its contents to parent or root
  deleteCollectionItemFolder(collectionId: string, folderId: string, moveContentsToParent: boolean = true): void {
    if (moveContentsToParent) {
      // Get the folder's parent
      const folder = this.db
        .prepare('SELECT parent_folder_id FROM collection_items WHERE collection_id = ? AND item_id = ? AND item_type = ?')
        .get(collectionId, folderId, 'folder') as { parent_folder_id: string | null } | undefined;

      const parentId = folder?.parent_folder_id ?? null;

      // Move all items in this folder to its parent
      this.db.prepare('UPDATE collection_items SET parent_folder_id = ? WHERE collection_id = ? AND parent_folder_id = ?')
        .run(parentId, collectionId, folderId);
    } else {
      // Delete all items in this folder (cascade)
      this.db.prepare('DELETE FROM collection_items WHERE collection_id = ? AND parent_folder_id = ?')
        .run(collectionId, folderId);
    }

    // Delete the folder itself
    this.removeFromCollection(collectionId, folderId);
  }

  // Reorder collections in sidebar (flat list)
  reorderCollections(collectionIds: string[]): void {
    const stmt = this.db.prepare('UPDATE collections SET position = ? WHERE id = ?');
    for (let i = 0; i < collectionIds.length; i++) {
      stmt.run(i, collectionIds[i]);
    }
  }


  // ========================================
  // Pinned Items
  // ========================================

  getPinnedItems(): PinnedItem[] {
    const rows = this.db
      .prepare('SELECT * FROM pinned_items ORDER BY position ASC')
      .all() as Array<{
        id: string;
        item_type: string;
        item_id: string;
        item_data: string | null;
        position: number;
        pinned_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      itemType: row.item_type as PinnedItem['itemType'],
      itemId: row.item_id,
      itemData: row.item_data ? JSON.parse(row.item_data) : {},
      position: row.position,
      pinnedAt: row.pinned_at
    }));
  }

  pinItem(itemType: string, itemId: string, itemData?: Record<string, unknown>): PinnedItem {
    const id = nanoid();
    const now = Date.now();

    // Get max position
    const maxPos = this.db
      .prepare('SELECT MAX(position) as max FROM pinned_items')
      .get() as { max: number | null };

    const position = (maxPos.max ?? -1) + 1;

    this.db.prepare(`
      INSERT OR REPLACE INTO pinned_items (id, item_type, item_id, item_data, position, pinned_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, itemType, itemId, itemData ? JSON.stringify(itemData) : null, position, now);

    return {
      id,
      itemType: itemType as PinnedItem['itemType'],
      itemId,
      itemData: itemData ?? {},
      position,
      pinnedAt: now
    };
  }

  unpinItem(itemType: string, itemId: string): void {
    this.db.prepare('DELETE FROM pinned_items WHERE item_type = ? AND item_id = ?').run(itemType, itemId);
  }

  isPinned(itemType: string, itemId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM pinned_items WHERE item_type = ? AND item_id = ?')
      .get(itemType, itemId);
    return !!row;
  }

  reorderPinnedItems(itemIds: Array<{ type: string; id: string }>): void {
    const stmt = this.db.prepare('UPDATE pinned_items SET position = ? WHERE item_type = ? AND item_id = ?');

    for (let i = 0; i < itemIds.length; i++) {
      stmt.run(i, itemIds[i].type, itemIds[i].id);
    }
  }

  // ========================================
  // Library Views
  // ========================================

  getLibraryViews(): LibraryView[] {
    const rows = this.db
      .prepare('SELECT * FROM library_views ORDER BY is_built_in DESC, created_at DESC')
      .all() as Array<{
        id: string;
        name: string;
        icon: string | null;
        filters: string;
        sort_by: string | null;
        sort_direction: string | null;
        is_built_in: number;
        created_at: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      icon: row.icon ?? undefined,
      filters: JSON.parse(row.filters),
      sortBy: row.sort_by ?? undefined,
      sortDirection: row.sort_direction as 'asc' | 'desc' | undefined,
      isBuiltIn: row.is_built_in === 1,
      createdAt: row.created_at
    }));
  }

  getLibraryView(id: string): LibraryView | null {
    const row = this.db
      .prepare('SELECT * FROM library_views WHERE id = ?')
      .get(id) as {
        id: string;
        name: string;
        icon: string | null;
        filters: string;
        sort_by: string | null;
        sort_direction: string | null;
        is_built_in: number;
        created_at: number;
      } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      icon: row.icon ?? undefined,
      filters: JSON.parse(row.filters),
      sortBy: row.sort_by ?? undefined,
      sortDirection: row.sort_direction as 'asc' | 'desc' | undefined,
      isBuiltIn: row.is_built_in === 1,
      createdAt: row.created_at
    };
  }

  createLibraryView(data: {
    name: string;
    icon?: string;
    filters: Record<string, unknown>;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): LibraryView {
    const id = nanoid();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO library_views (id, name, icon, filters, sort_by, sort_direction, is_built_in, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, data.name, data.icon ?? null, JSON.stringify(data.filters), data.sortBy ?? null, data.sortDirection ?? null, now);

    return {
      id,
      name: data.name,
      icon: data.icon,
      filters: data.filters,
      sortBy: data.sortBy,
      sortDirection: data.sortDirection,
      isBuiltIn: false,
      createdAt: now
    };
  }

  updateLibraryView(id: string, data: Partial<{
    name: string;
    icon: string;
    filters: Record<string, unknown>;
    sortBy: string;
    sortDirection: 'asc' | 'desc';
  }>): void {
    // Can't update built-in views
    const view = this.getLibraryView(id);
    if (!view || view.isBuiltIn) return;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.icon !== undefined) {
      updates.push('icon = ?');
      values.push(data.icon);
    }
    if (data.filters !== undefined) {
      updates.push('filters = ?');
      values.push(JSON.stringify(data.filters));
    }
    if (data.sortBy !== undefined) {
      updates.push('sort_by = ?');
      values.push(data.sortBy);
    }
    if (data.sortDirection !== undefined) {
      updates.push('sort_direction = ?');
      values.push(data.sortDirection);
    }

    if (updates.length === 0) return;
    values.push(id);

    this.db.prepare(`UPDATE library_views SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteLibraryView(id: string): void {
    // Can't delete built-in views
    this.db.prepare('DELETE FROM library_views WHERE id = ? AND is_built_in = 0').run(id);
  }

  // ========================================
  // Audio Features
  // ========================================

  getAudioFeatures(trackId: string): AudioFeatures | null {
    const row = this.db
      .prepare('SELECT * FROM audio_features WHERE track_id = ?')
      .get(trackId) as {
        track_id: string;
        energy: number;
        tempo: number;
        valence: number;
        danceability: number;
        acousticness: number;
        instrumentalness: number;
        speechiness: number;
        loudness: number;
        key: number;
        mode: number;
        time_signature: number;
        analyzed_at: number;
      } | undefined;

    if (!row) return null;

    return {
      trackId: row.track_id,
      energy: row.energy,
      tempo: row.tempo,
      valence: row.valence,
      danceability: row.danceability,
      acousticness: row.acousticness,
      instrumentalness: row.instrumentalness,
      speechiness: row.speechiness,
      loudness: row.loudness,
      key: row.key,
      mode: row.mode,
      timeSignature: row.time_signature,
      analyzedAt: row.analyzed_at
    };
  }

  saveAudioFeatures(features: AudioFeatures): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO audio_features (
        track_id, energy, tempo, valence, danceability, acousticness,
        instrumentalness, speechiness, loudness, key, mode, time_signature, analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      features.trackId,
      features.energy,
      features.tempo,
      features.valence,
      features.danceability,
      features.acousticness,
      features.instrumentalness,
      features.speechiness,
      features.loudness,
      features.key,
      features.mode,
      features.timeSignature,
      features.analyzedAt
    );
  }

  searchByAudioFeatures(criteria: {
    energyMin?: number;
    energyMax?: number;
    tempoMin?: number;
    tempoMax?: number;
    valenceMin?: number;
    valenceMax?: number;
    danceabilityMin?: number;
    danceabilityMax?: number;
    acousticnessMin?: number;
    acousticnessMax?: number;
    instrumentalnessMin?: number;
    instrumentalnessMax?: number;
  }, limit: number = 50): string[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (criteria.energyMin !== undefined) {
      conditions.push('energy >= ?');
      params.push(criteria.energyMin);
    }
    if (criteria.energyMax !== undefined) {
      conditions.push('energy <= ?');
      params.push(criteria.energyMax);
    }
    if (criteria.tempoMin !== undefined) {
      conditions.push('tempo >= ?');
      params.push(criteria.tempoMin);
    }
    if (criteria.tempoMax !== undefined) {
      conditions.push('tempo <= ?');
      params.push(criteria.tempoMax);
    }
    if (criteria.valenceMin !== undefined) {
      conditions.push('valence >= ?');
      params.push(criteria.valenceMin);
    }
    if (criteria.valenceMax !== undefined) {
      conditions.push('valence <= ?');
      params.push(criteria.valenceMax);
    }
    if (criteria.danceabilityMin !== undefined) {
      conditions.push('danceability >= ?');
      params.push(criteria.danceabilityMin);
    }
    if (criteria.danceabilityMax !== undefined) {
      conditions.push('danceability <= ?');
      params.push(criteria.danceabilityMax);
    }
    if (criteria.acousticnessMin !== undefined) {
      conditions.push('acousticness >= ?');
      params.push(criteria.acousticnessMin);
    }
    if (criteria.acousticnessMax !== undefined) {
      conditions.push('acousticness <= ?');
      params.push(criteria.acousticnessMax);
    }
    if (criteria.instrumentalnessMin !== undefined) {
      conditions.push('instrumentalness >= ?');
      params.push(criteria.instrumentalnessMin);
    }
    if (criteria.instrumentalnessMax !== undefined) {
      conditions.push('instrumentalness <= ?');
      params.push(criteria.instrumentalnessMax);
    }

    if (conditions.length === 0) {
      return [];
    }

    params.push(limit);

    const rows = this.db.prepare(`
      SELECT track_id FROM audio_features
      WHERE ${conditions.join(' AND ')}
      LIMIT ?
    `).all(...params) as Array<{ track_id: string }>;

    return rows.map(r => r.track_id);
  }

  // ========================================
  // Search History
  // ========================================

  getSearchHistory(limit: number = 20): SearchHistoryEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM search_history ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as Array<{
        id: string;
        query: string;
        result_count: number;
        timestamp: number;
      }>;

    return rows.map(row => ({
      id: row.id,
      query: row.query,
      resultCount: row.result_count,
      searchedAt: row.timestamp
    }));
  }

  saveSearchHistory(query: string, resultCount: number): void {
    const id = nanoid();

    // Don't save duplicate consecutive queries
    const last = this.db
      .prepare('SELECT query FROM search_history ORDER BY timestamp DESC LIMIT 1')
      .get() as { query: string } | undefined;

    if (last?.query === query) return;

    this.db.prepare(`
      INSERT INTO search_history (id, query, result_count, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(id, query, resultCount, Date.now());

    // Keep only last 100 searches
    this.db.prepare(`
      DELETE FROM search_history WHERE id NOT IN (
        SELECT id FROM search_history ORDER BY timestamp DESC LIMIT 100
      )
    `).run();
  }

  deleteSearchHistory(id: string): void {
    this.db.prepare('DELETE FROM search_history WHERE id = ?').run(id);
  }

  clearSearchHistory(): void {
    this.db.prepare('DELETE FROM search_history').run();
  }

  getTrendingSearches(limit: number = 10): string[] {
    // Get most frequent searches in last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const rows = this.db.prepare(`
      SELECT query, COUNT(*) as count
      FROM search_history
      WHERE timestamp > ?
      GROUP BY query
      ORDER BY count DESC
      LIMIT ?
    `).all(sevenDaysAgo, limit) as Array<{ query: string }>;

    return rows.map(r => r.query);
  }

  // ============================================================================
  // Plugin Settings Persistence
  // ============================================================================

  /**
   * Get settings for a plugin
   */
  getPluginSettings(pluginId: string): { settings: Record<string, unknown>; enabled: boolean; priority: number } | null {
    const row = this.db.prepare(`
      SELECT settings, enabled, priority FROM plugin_settings WHERE plugin_id = ?
    `).get(pluginId) as { settings: string; enabled: number; priority: number } | undefined;

    if (!row) return null;

    try {
      return {
        settings: JSON.parse(row.settings),
        enabled: row.enabled === 1,
        priority: row.priority
      };
    } catch {
      return null;
    }
  }

  /**
   * Save settings for a plugin
   */
  savePluginSettings(pluginId: string, settings: Record<string, unknown>, enabled: boolean = true, priority: number = 0): void {
    this.db.prepare(`
      INSERT INTO plugin_settings (plugin_id, settings, enabled, priority, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(plugin_id) DO UPDATE SET
        settings = excluded.settings,
        enabled = excluded.enabled,
        priority = excluded.priority,
        updated_at = excluded.updated_at
    `).run(pluginId, JSON.stringify(settings), enabled ? 1 : 0, priority, Date.now());
  }

  /**
   * Update only the settings for a plugin (preserves enabled/priority)
   */
  updatePluginSettings(pluginId: string, settings: Record<string, unknown>): void {
    const existing = this.getPluginSettings(pluginId);
    const enabled = existing?.enabled ?? true;
    const priority = existing?.priority ?? 0;

    this.savePluginSettings(pluginId, settings, enabled, priority);
  }

  /**
   * Update enabled state for a plugin
   */
  setPluginEnabled(pluginId: string, enabled: boolean): void {
    const existing = this.getPluginSettings(pluginId);
    if (existing) {
      this.savePluginSettings(pluginId, existing.settings, enabled, existing.priority);
    } else {
      this.savePluginSettings(pluginId, {}, enabled, 0);
    }
  }

  /**
   * Update priority for a plugin
   */
  setPluginPriority(pluginId: string, priority: number): void {
    const existing = this.getPluginSettings(pluginId);
    if (existing) {
      this.savePluginSettings(pluginId, existing.settings, existing.enabled, priority);
    } else {
      this.savePluginSettings(pluginId, {}, true, priority);
    }
  }

  /**
   * Get all plugin settings
   */
  getAllPluginSettings(): Array<{ pluginId: string; settings: Record<string, unknown>; enabled: boolean; priority: number }> {
    const rows = this.db.prepare(`
      SELECT plugin_id, settings, enabled, priority FROM plugin_settings ORDER BY priority DESC
    `).all() as Array<{ plugin_id: string; settings: string; enabled: number; priority: number }>;

    return rows.map(row => {
      try {
        return {
          pluginId: row.plugin_id,
          settings: JSON.parse(row.settings),
          enabled: row.enabled === 1,
          priority: row.priority
        };
      } catch {
        return {
          pluginId: row.plugin_id,
          settings: {},
          enabled: row.enabled === 1,
          priority: row.priority
        };
      }
    });
  }

  /**
   * Delete settings for a plugin
   */
  deletePluginSettings(pluginId: string): void {
    this.db.prepare('DELETE FROM plugin_settings WHERE plugin_id = ?').run(pluginId);
  }

  // ========================================
  // Unified Playlist Rule Evaluation
  // ========================================

  /**
   * Evaluate rules for a playlist and return matching tracks
   * Used for playlists with rules (smart/hybrid playlists)
   *
   * Note: 'streams' source requires plugin integration (search + metadata providers)
   * and is handled at the server/API layer, not in the database.
   * This method handles 'local' source evaluation from the library database.
   */
  evaluatePlaylistRules(playlistId: string): { trackIds: string[]; count: number; source: string } {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist || !playlist.rules || playlist.rules.length === 0) {
      return { trackIds: [], count: 0, source: 'local' };
    }

    const source = playlist.source || 'local';

    // For 'local' and 'all' sources, evaluate against local library
    // 'streams' source is handled at API layer with plugin integration
    let trackIds: string[] = [];
    if (source === 'local' || source === 'all') {
      trackIds = this.evaluateSmartPlaylistRules(
        playlist.rules,
        playlist.combinator || 'and',
        playlist.orderBy,
        playlist.orderDirection,
        source === 'all' ? undefined : playlist.limit // For 'all', we'll merge with stream results later
      );
    }

    // Update the cached count and evaluation timestamp
    this.updatePlaylist(playlistId, {
      ruleTrackCount: trackIds.length,
      lastEvaluated: Date.now()
    });

    return { trackIds, count: trackIds.length, source };
  }

  /**
   * Get rule definitions (for UI rule builder)
   */
  getRuleDefinitions(): Array<{
    field: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'duration';
    category: 'metadata' | 'library' | 'playback' | 'audio';
    operators: string[];
  }> {
    return [
      // Metadata fields
      { field: 'title', label: 'Title', type: 'string', category: 'metadata', operators: ['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with'] },
      { field: 'artist', label: 'Artist', type: 'string', category: 'metadata', operators: ['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with'] },
      { field: 'album', label: 'Album', type: 'string', category: 'metadata', operators: ['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with'] },
      { field: 'genre', label: 'Genre', type: 'string', category: 'metadata', operators: ['contains', 'not_contains', 'is', 'is_not'] },
      { field: 'year', label: 'Year', type: 'number', category: 'metadata', operators: ['is', 'is_not', 'gt', 'lt', 'between'] },
      { field: 'duration', label: 'Duration', type: 'duration', category: 'metadata', operators: ['is', 'gt', 'lt', 'between'] },
      // Library fields
      { field: 'isLiked', label: 'Is Liked', type: 'boolean', category: 'library', operators: ['is'] },
      { field: 'addedAt', label: 'Date Added', type: 'date', category: 'library', operators: ['in_last', 'not_in_last', 'before', 'after'] },
      { field: 'hasTag', label: 'Has Tag', type: 'string', category: 'library', operators: ['contains', 'is'] },
      // Playback fields
      { field: 'playCount', label: 'Play Count', type: 'number', category: 'playback', operators: ['is', 'gt', 'lt', 'between'] },
      { field: 'lastPlayed', label: 'Last Played', type: 'date', category: 'playback', operators: ['in_last', 'not_in_last', 'before', 'after', 'never'] },
      { field: 'skipCount', label: 'Skip Count', type: 'number', category: 'playback', operators: ['is', 'gt', 'lt'] },
    ];
  }

  // ========================================
  // Smart Playlist Migration
  // ========================================

  /**
   * Migrate existing smart_playlists to the unified playlists table
   * This copies all smart playlists into playlists with rules
   * Call this during startup/upgrade
   */
  migrateSmartPlaylistsToUnified(): { migrated: number; skipped: number } {
    let migrated = 0;
    let skipped = 0;

    const smartPlaylists = this.getSmartPlaylists();

    for (const sp of smartPlaylists) {
      // Check if already migrated (playlist with same ID exists)
      const existing = this.db
        .prepare('SELECT 1 FROM playlists WHERE id = ?')
        .get(sp.id);

      if (existing) {
        skipped++;
        continue;
      }

      // Create playlist with rules (preserving the ID)
      this.db.prepare(`
        INSERT INTO playlists (
          id, name, description, folder_id, rules, combinator,
          order_by, order_direction, max_limit, last_evaluated,
          rule_track_count, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sp.id,
        sp.name,
        sp.description || null,
        sp.folderId || null,
        JSON.stringify(sp.rules),
        sp.combinator,
        sp.orderBy || null,
        sp.orderDirection || null,
        sp.limit || null,
        sp.lastEvaluated || null,
        sp.trackCount || 0,
        sp.createdAt,
        sp.updatedAt
      );

      migrated++;
    }

    console.log(`[LibraryDB] Smart playlist migration: ${migrated} migrated, ${skipped} skipped (already exist)`);
    return { migrated, skipped };
  }

  /**
   * Check if smart playlist migration has been done
   */
  needsSmartPlaylistMigration(): boolean {
    const smartCount = this.db
      .prepare('SELECT COUNT(*) as count FROM smart_playlists')
      .get() as { count: number };

    if (smartCount.count === 0) return false;

    // Check if any smart playlist IDs are NOT in playlists table
    const unmigrated = this.db
      .prepare(`
        SELECT COUNT(*) as count FROM smart_playlists
        WHERE id NOT IN (SELECT id FROM playlists)
      `)
      .get() as { count: number };

    return unmigrated.count > 0;
  }
}
