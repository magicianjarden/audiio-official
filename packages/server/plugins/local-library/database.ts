/**
 * Local Library Database
 *
 * SQLite database for storing scanned local tracks and videos.
 * Uses better-sqlite3 for synchronous, fast database operations.
 */

import Database from 'better-sqlite3';
import type { LocalFolder, ContentType } from './index';

// ========================================
// Types
// ========================================

export interface DbTrack {
  id: string;
  folderId: string;
  filePath: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  genres: string | null;  // JSON array
  artworkPath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  modifiedAt: number | null;
  scannedAt: number;
}

export interface DbVideo {
  id: string;
  folderId: string;
  filePath: string;
  title: string | null;
  artist: string | null;
  duration: number | null;
  resolution: string | null;
  codec: string | null;
  thumbnailPath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  videoType: string | null;
  modifiedAt: number | null;
  scannedAt: number;
}

export interface DbFolder {
  id: string;
  path: string;
  name: string;
  contentTypes: string;  // JSON array
  enabled: number;       // 0 or 1
  trackCount: number;
  videoCount: number;
  totalSize: number;
  addedAt: number;
  lastScanned: number | null;
}

export interface TrackQueryOptions {
  limit: number;
  offset: number;
  artist?: string;
  album?: string;
  genre?: string;
}

export interface VideoQueryOptions {
  limit: number;
  offset: number;
  artist?: string;
  videoType?: string;
}

// ========================================
// Local Database
// ========================================

export class LocalDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      -- Folders table
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        content_types TEXT NOT NULL DEFAULT '["mixed"]',
        enabled INTEGER NOT NULL DEFAULT 1,
        track_count INTEGER NOT NULL DEFAULT 0,
        video_count INTEGER NOT NULL DEFAULT 0,
        total_size INTEGER NOT NULL DEFAULT 0,
        added_at INTEGER NOT NULL,
        last_scanned INTEGER
      );

      -- Tracks table
      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        folder_id TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        title TEXT,
        artist TEXT,
        album TEXT,
        duration INTEGER,
        genres TEXT,
        artwork_path TEXT,
        file_size INTEGER,
        mime_type TEXT,
        modified_at INTEGER,
        scanned_at INTEGER NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
      );

      -- Videos table
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        folder_id TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        title TEXT,
        artist TEXT,
        duration INTEGER,
        resolution TEXT,
        codec TEXT,
        thumbnail_path TEXT,
        file_size INTEGER,
        mime_type TEXT,
        video_type TEXT,
        modified_at INTEGER,
        scanned_at INTEGER NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
      );

      -- Indexes for fast lookups
      CREATE INDEX IF NOT EXISTS idx_tracks_folder ON tracks(folder_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
      CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
      CREATE INDEX IF NOT EXISTS idx_videos_folder ON videos(folder_id);
      CREATE INDEX IF NOT EXISTS idx_videos_artist ON videos(artist);
      CREATE INDEX IF NOT EXISTS idx_videos_type ON videos(video_type);

      -- Full text search for tracks
      CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
        title, artist, album,
        content='tracks',
        content_rowid='rowid'
      );

      -- Full text search for videos
      CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
        title, artist,
        content='videos',
        content_rowid='rowid'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
        INSERT INTO tracks_fts(rowid, title, artist, album) VALUES (new.rowid, new.title, new.artist, new.album);
      END;

      CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
        INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album) VALUES('delete', old.rowid, old.title, old.artist, old.album);
      END;

      CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
        INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album) VALUES('delete', old.rowid, old.title, old.artist, old.album);
        INSERT INTO tracks_fts(rowid, title, artist, album) VALUES (new.rowid, new.title, new.artist, new.album);
      END;

      CREATE TRIGGER IF NOT EXISTS videos_ai AFTER INSERT ON videos BEGIN
        INSERT INTO videos_fts(rowid, title, artist) VALUES (new.rowid, new.title, new.artist);
      END;

      CREATE TRIGGER IF NOT EXISTS videos_ad AFTER DELETE ON videos BEGIN
        INSERT INTO videos_fts(videos_fts, rowid, title, artist) VALUES('delete', old.rowid, old.title, old.artist);
      END;

      CREATE TRIGGER IF NOT EXISTS videos_au AFTER UPDATE ON videos BEGIN
        INSERT INTO videos_fts(videos_fts, rowid, title, artist) VALUES('delete', old.rowid, old.title, old.artist);
        INSERT INTO videos_fts(rowid, title, artist) VALUES (new.rowid, new.title, new.artist);
      END;
    `);
  }

  close(): void {
    this.db.close();
  }

  // ========================================
  // Folder Operations
  // ========================================

  getFolders(): LocalFolder[] {
    const rows = this.db.prepare(`
      SELECT * FROM folders ORDER BY name ASC
    `).all() as DbFolder[];

    return rows.map(this.rowToFolder);
  }

  getFolder(id: string): LocalFolder | null {
    const row = this.db.prepare(`
      SELECT * FROM folders WHERE id = ?
    `).get(id) as DbFolder | undefined;

    return row ? this.rowToFolder(row) : null;
  }

  addFolder(folder: LocalFolder): void {
    this.db.prepare(`
      INSERT INTO folders (id, path, name, content_types, enabled, track_count, video_count, total_size, added_at, last_scanned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      folder.id,
      folder.path,
      folder.name,
      JSON.stringify(folder.contentTypes),
      folder.enabled ? 1 : 0,
      folder.stats.trackCount,
      folder.stats.videoCount,
      folder.stats.totalSize,
      folder.addedAt,
      folder.lastScanned
    );
  }

  removeFolder(id: string): void {
    // Cascades to tracks and videos due to foreign key
    this.db.prepare(`DELETE FROM folders WHERE id = ?`).run(id);
  }

  updateFolder(id: string, updates: Partial<LocalFolder> & { stats?: LocalFolder['stats']; lastScanned?: number }): void {
    const folder = this.getFolder(id);
    if (!folder) return;

    const newFolder = { ...folder, ...updates };
    if (updates.stats) {
      newFolder.stats = { ...folder.stats, ...updates.stats };
    }

    this.db.prepare(`
      UPDATE folders SET
        name = ?,
        content_types = ?,
        enabled = ?,
        track_count = ?,
        video_count = ?,
        total_size = ?,
        last_scanned = ?
      WHERE id = ?
    `).run(
      newFolder.name,
      JSON.stringify(newFolder.contentTypes),
      newFolder.enabled ? 1 : 0,
      newFolder.stats.trackCount,
      newFolder.stats.videoCount,
      newFolder.stats.totalSize,
      newFolder.lastScanned,
      id
    );
  }

  private rowToFolder(row: DbFolder): LocalFolder {
    return {
      id: row.id,
      path: row.path,
      name: row.name,
      contentTypes: JSON.parse(row.contentTypes) as ContentType[],
      enabled: row.enabled === 1,
      stats: {
        trackCount: row.trackCount,
        videoCount: row.videoCount,
        totalSize: row.totalSize
      },
      addedAt: row.addedAt,
      lastScanned: row.lastScanned
    };
  }

  // ========================================
  // Track Operations
  // ========================================

  upsertTrack(track: {
    id: string;
    folderId: string;
    filePath: string;
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    genres?: string[];
    artworkPath?: string;
    fileSize?: number;
    mimeType?: string;
    modifiedAt?: number;
  }): void {
    this.db.prepare(`
      INSERT INTO tracks (id, folder_id, file_path, title, artist, album, duration, genres, artwork_path, file_size, mime_type, modified_at, scanned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        artist = excluded.artist,
        album = excluded.album,
        duration = excluded.duration,
        genres = excluded.genres,
        artwork_path = excluded.artwork_path,
        file_size = excluded.file_size,
        mime_type = excluded.mime_type,
        modified_at = excluded.modified_at,
        scanned_at = excluded.scanned_at
    `).run(
      track.id,
      track.folderId,
      track.filePath,
      track.title || null,
      track.artist || null,
      track.album || null,
      track.duration || null,
      track.genres ? JSON.stringify(track.genres) : null,
      track.artworkPath || null,
      track.fileSize || null,
      track.mimeType || null,
      track.modifiedAt || null,
      Date.now()
    );
  }

  getTrack(id: string): DbTrack | null {
    const row = this.db.prepare(`
      SELECT * FROM tracks WHERE id = ?
    `).get(id) as DbTrack | undefined;

    return row ? this.parseTrackRow(row) : null;
  }

  getTracks(options: TrackQueryOptions): DbTrack[] {
    let sql = 'SELECT * FROM tracks WHERE 1=1';
    const params: any[] = [];

    if (options.artist) {
      sql += ' AND artist LIKE ?';
      params.push(`%${options.artist}%`);
    }
    if (options.album) {
      sql += ' AND album LIKE ?';
      params.push(`%${options.album}%`);
    }
    if (options.genre) {
      sql += ' AND genres LIKE ?';
      params.push(`%${options.genre}%`);
    }

    sql += ' ORDER BY artist ASC, album ASC, title ASC LIMIT ? OFFSET ?';
    params.push(options.limit, options.offset);

    const rows = this.db.prepare(sql).all(...params) as DbTrack[];
    return rows.map(this.parseTrackRow);
  }

  getFolderTracks(folderId: string, limit: number, offset: number): DbTrack[] {
    const rows = this.db.prepare(`
      SELECT * FROM tracks WHERE folder_id = ?
      ORDER BY artist ASC, album ASC, title ASC
      LIMIT ? OFFSET ?
    `).all(folderId, limit, offset) as DbTrack[];

    return rows.map(this.parseTrackRow);
  }

  searchTracks(query: string, limit: number, offset: number): DbTrack[] {
    if (!query.trim()) {
      return this.getTracks({ limit, offset });
    }

    // Use FTS for search
    const rows = this.db.prepare(`
      SELECT t.* FROM tracks t
      JOIN tracks_fts fts ON t.rowid = fts.rowid
      WHERE tracks_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `).all(`"${query.replace(/"/g, '""')}"*`, limit, offset) as DbTrack[];

    return rows.map(this.parseTrackRow);
  }

  private parseTrackRow(row: DbTrack): DbTrack {
    return {
      ...row,
      genres: row.genres ? JSON.parse(row.genres as string) : null
    } as any;
  }

  // ========================================
  // Video Operations
  // ========================================

  upsertVideo(video: {
    id: string;
    folderId: string;
    filePath: string;
    title?: string;
    artist?: string;
    duration?: number;
    resolution?: string;
    codec?: string;
    thumbnailPath?: string;
    fileSize?: number;
    mimeType?: string;
    videoType?: string;
    modifiedAt?: number;
  }): void {
    this.db.prepare(`
      INSERT INTO videos (id, folder_id, file_path, title, artist, duration, resolution, codec, thumbnail_path, file_size, mime_type, video_type, modified_at, scanned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        artist = excluded.artist,
        duration = excluded.duration,
        resolution = excluded.resolution,
        codec = excluded.codec,
        thumbnail_path = excluded.thumbnail_path,
        file_size = excluded.file_size,
        mime_type = excluded.mime_type,
        video_type = excluded.video_type,
        modified_at = excluded.modified_at,
        scanned_at = excluded.scanned_at
    `).run(
      video.id,
      video.folderId,
      video.filePath,
      video.title || null,
      video.artist || null,
      video.duration || null,
      video.resolution || null,
      video.codec || null,
      video.thumbnailPath || null,
      video.fileSize || null,
      video.mimeType || null,
      video.videoType || null,
      video.modifiedAt || null,
      Date.now()
    );
  }

  getVideo(id: string): DbVideo | null {
    const row = this.db.prepare(`
      SELECT * FROM videos WHERE id = ?
    `).get(id) as DbVideo | undefined;

    return row || null;
  }

  getVideos(options: VideoQueryOptions): DbVideo[] {
    let sql = 'SELECT * FROM videos WHERE 1=1';
    const params: any[] = [];

    if (options.artist) {
      sql += ' AND artist LIKE ?';
      params.push(`%${options.artist}%`);
    }
    if (options.videoType) {
      sql += ' AND video_type = ?';
      params.push(options.videoType);
    }

    sql += ' ORDER BY title ASC LIMIT ? OFFSET ?';
    params.push(options.limit, options.offset);

    const rows = this.db.prepare(sql).all(...params) as DbVideo[];
    return rows;
  }

  getFolderVideos(folderId: string, limit: number, offset: number): DbVideo[] {
    const rows = this.db.prepare(`
      SELECT * FROM videos WHERE folder_id = ?
      ORDER BY title ASC
      LIMIT ? OFFSET ?
    `).all(folderId, limit, offset) as DbVideo[];

    return rows;
  }

  searchVideos(query: string, limit: number, offset: number): DbVideo[] {
    if (!query.trim()) {
      return this.getVideos({ limit, offset });
    }

    // Use FTS for search
    const rows = this.db.prepare(`
      SELECT v.* FROM videos v
      JOIN videos_fts fts ON v.rowid = fts.rowid
      WHERE videos_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `).all(`"${query.replace(/"/g, '""')}"*`, limit, offset) as DbVideo[];

    return rows;
  }

  // ========================================
  // Statistics
  // ========================================

  getStats(): { totalTracks: number; totalVideos: number; totalFolders: number; totalSize: number } {
    const tracks = this.db.prepare(`SELECT COUNT(*) as count FROM tracks`).get() as { count: number };
    const videos = this.db.prepare(`SELECT COUNT(*) as count FROM videos`).get() as { count: number };
    const folders = this.db.prepare(`SELECT COUNT(*) as count FROM folders`).get() as { count: number };
    const size = this.db.prepare(`SELECT COALESCE(SUM(total_size), 0) as size FROM folders`).get() as { size: number };

    return {
      totalTracks: tracks.count,
      totalVideos: videos.count,
      totalFolders: folders.count,
      totalSize: size.size
    };
  }
}
