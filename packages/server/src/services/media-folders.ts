/**
 * Media Folders Service
 *
 * Manages user media folders (audio, video, downloads) separately from plugin paths.
 * Provides Plex-like folder management with scanning and filesystem watching.
 */

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { EventEmitter } from 'events';

// ========================================
// Types
// ========================================

export type MediaFolderType = 'audio' | 'video' | 'downloads';

export interface MediaFolder {
  id: string;
  path: string;
  name: string;
  type: MediaFolderType;
  trackCount: number;
  lastScanned: number | null;
  isScanning: boolean;
  watchEnabled: boolean;
  scanInterval: number | null; // minutes, null = disabled
  createdAt: number;
  updatedAt: number;
}

export interface LocalTrack {
  id: string;
  folderId: string;
  filePath: string;
  filename: string;
  title: string;
  artists: string[];
  album: string | null;
  albumArtist: string | null;
  genre: string[];
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number; // seconds
  bitrate: number | null;
  sampleRate: number | null;
  codec: string | null;
  hasArtwork: boolean;
  artworkPath: string | null;
  fileSize: number;
  lastModified: number;
  addedAt: number;
  isVideo: boolean;
  // Video-specific
  width: number | null;
  height: number | null;
  frameRate: number | null;
}

export interface ScanProgress {
  folderId: string;
  folderName: string;
  phase: 'discovering' | 'scanning' | 'processing' | 'complete' | 'error';
  current: number;
  total: number;
  currentFile: string | null;
  error: string | null;
}

export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  directories: { name: string; path: string }[];
  canWrite: boolean;
}

// Forbidden system paths that should never be added
const FORBIDDEN_PATHS: Record<string, string[]> = {
  win32: [
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'C:\\ProgramData',
    'C:\\System Volume Information',
    'C:\\$Recycle.Bin',
  ],
  darwin: [
    '/System',
    '/Library',
    '/usr',
    '/bin',
    '/sbin',
    '/var',
    '/private',
  ],
  linux: [
    '/etc',
    '/sys',
    '/proc',
    '/dev',
    '/boot',
    '/root',
    '/usr/bin',
    '/sbin',
    '/var/run',
    '/var/lock',
  ],
};

// Supported file extensions
export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.opus', '.wma', '.aac', '.aiff', '.alac'];
export const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v'];

// ========================================
// Media Folders Service
// ========================================

export class MediaFoldersService extends EventEmitter {
  private db: Database.Database;
  private scanIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(db: Database.Database) {
    super();
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    // Media folders table
    // NOTE: We allow same path with different types (e.g., audio + downloads)
    // The UNIQUE constraint is on (path, type) pair, not path alone
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS media_folders (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('audio', 'video', 'downloads')),
        track_count INTEGER DEFAULT 0,
        last_scanned INTEGER,
        is_scanning INTEGER DEFAULT 0,
        watch_enabled INTEGER DEFAULT 0,
        scan_interval INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(path, type)
      )
    `);

    // Migration: If old table has UNIQUE constraint on path alone, we need to migrate
    // Check if we can add a duplicate path with different type - if not, migrate
    this.migratePathUniqueConstraint();

    // Local tracks table (scanned files)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS local_tracks (
        id TEXT PRIMARY KEY,
        folder_id TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        title TEXT NOT NULL,
        artists TEXT NOT NULL,
        album TEXT,
        album_artist TEXT,
        genre TEXT,
        year INTEGER,
        track_number INTEGER,
        disc_number INTEGER,
        duration REAL NOT NULL,
        bitrate INTEGER,
        sample_rate INTEGER,
        codec TEXT,
        has_artwork INTEGER DEFAULT 0,
        artwork_path TEXT,
        file_size INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        is_video INTEGER DEFAULT 0,
        width INTEGER,
        height INTEGER,
        frame_rate REAL,
        FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE CASCADE
      )
    `);

    // Downloads table (in-progress and completed)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        folder_id TEXT,
        source_url TEXT NOT NULL,
        source_type TEXT NOT NULL,
        track_data TEXT,
        file_path TEXT,
        filename TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'downloading', 'processing', 'completed', 'failed', 'cancelled')),
        progress INTEGER DEFAULT 0,
        total_bytes INTEGER,
        downloaded_bytes INTEGER DEFAULT 0,
        error TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE SET NULL
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_local_tracks_folder ON local_tracks(folder_id);
      CREATE INDEX IF NOT EXISTS idx_local_tracks_title ON local_tracks(title);
      CREATE INDEX IF NOT EXISTS idx_local_tracks_artists ON local_tracks(artists);
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
      CREATE INDEX IF NOT EXISTS idx_downloads_folder ON downloads(folder_id);
    `);

    console.log('[MediaFolders] Database tables initialized');

    // Start periodic scan timers for existing folders
    this.initializePeriodicScans();
  }

  private initializePeriodicScans(): void {
    const folders = this.getFolders();
    for (const folder of folders) {
      if (folder.scanInterval && folder.scanInterval > 0) {
        this.startPeriodicScan(folder.id, folder.scanInterval);
      }
    }
  }

  /**
   * Migrate from old schema (UNIQUE on path) to new schema (UNIQUE on path,type)
   * This allows the same folder to be used as both audio library and downloads destination
   */
  private migratePathUniqueConstraint(): void {
    try {
      // Check current table schema
      const tableInfo = this.db.prepare("PRAGMA table_info(media_folders)").all() as any[];
      if (tableInfo.length === 0) return; // Table doesn't exist yet

      // Check if we have the old UNIQUE constraint on path alone
      // We can detect this by checking the index info
      const indexList = this.db.prepare("PRAGMA index_list(media_folders)").all() as any[];

      let hasOldPathUnique = false;
      for (const idx of indexList) {
        if (idx.unique) {
          const indexInfo = this.db.prepare(`PRAGMA index_info(${idx.name})`).all() as any[];
          // Old constraint: only one column (path) in unique index
          // New constraint: two columns (path, type) in unique index
          if (indexInfo.length === 1) {
            const colInfo = tableInfo[indexInfo[0].cid];
            if (colInfo && colInfo.name === 'path') {
              hasOldPathUnique = true;
              break;
            }
          }
        }
      }

      if (!hasOldPathUnique) {
        console.log('[MediaFolders] Schema already supports dual-purpose folders');
        return;
      }

      console.log('[MediaFolders] Migrating schema to support dual-purpose folders...');

      // Create new table with correct constraint
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS media_folders_new (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('audio', 'video', 'downloads')),
          track_count INTEGER DEFAULT 0,
          last_scanned INTEGER,
          is_scanning INTEGER DEFAULT 0,
          watch_enabled INTEGER DEFAULT 0,
          scan_interval INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(path, type)
        )
      `);

      // Copy data
      this.db.exec(`
        INSERT INTO media_folders_new
        SELECT id, path, name, type, track_count, last_scanned, is_scanning,
               watch_enabled, scan_interval, created_at, updated_at
        FROM media_folders
      `);

      // Drop old table and rename new
      this.db.exec('DROP TABLE media_folders');
      this.db.exec('ALTER TABLE media_folders_new RENAME TO media_folders');

      console.log('[MediaFolders] Migration complete - same folder can now be both library and downloads');
    } catch (error) {
      console.error('[MediaFolders] Migration error:', error);
      // Non-fatal - table might already be correct or not exist yet
    }
  }

  // ========================================
  // Folder Management
  // ========================================

  getFolders(type?: MediaFolderType): MediaFolder[] {
    let query = 'SELECT * FROM media_folders';
    const params: unknown[] = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];

    console.log(`[MediaFolders] getFolders(${type || 'all'}): found ${rows.length} folders`);
    if (!type && rows.length > 0) {
      // Log all folders when getting all (for debugging)
      console.log('[MediaFolders] All folders in database:');
      rows.forEach(row => {
        console.log(`  - ${row.path} (type: ${row.type}, id: ${row.id})`);
      });
    }

    return rows.map(row => ({
      id: row.id,
      path: row.path,
      name: row.name,
      type: row.type as MediaFolderType,
      trackCount: row.track_count,
      lastScanned: row.last_scanned,
      isScanning: !!row.is_scanning,
      watchEnabled: !!row.watch_enabled,
      scanInterval: row.scan_interval,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getFolder(id: string): MediaFolder | null {
    const row = this.db.prepare('SELECT * FROM media_folders WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      path: row.path,
      name: row.name,
      type: row.type as MediaFolderType,
      trackCount: row.track_count,
      lastScanned: row.last_scanned,
      isScanning: !!row.is_scanning,
      watchEnabled: !!row.watch_enabled,
      scanInterval: row.scan_interval,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get folder by path, optionally filtered by type.
   * Since dual-purpose folders are supported, the same path can exist with different types.
   */
  getFolderByPath(folderPath: string, type?: MediaFolderType): MediaFolder | null {
    const normalizedPath = path.normalize(folderPath);

    // Use case-insensitive comparison on Windows
    const isWindows = process.platform === 'win32';
    let query: string;
    const params: unknown[] = [normalizedPath];

    if (type) {
      query = isWindows
        ? 'SELECT * FROM media_folders WHERE LOWER(path) = LOWER(?) AND type = ?'
        : 'SELECT * FROM media_folders WHERE path = ? AND type = ?';
      params.push(type);
    } else {
      // Return any folder with this path (first one found)
      query = isWindows
        ? 'SELECT * FROM media_folders WHERE LOWER(path) = LOWER(?)'
        : 'SELECT * FROM media_folders WHERE path = ?';
    }

    const row = this.db.prepare(query).get(...params) as any;
    if (!row) return null;

    return {
      id: row.id,
      path: row.path,
      name: row.name,
      type: row.type as MediaFolderType,
      trackCount: row.track_count,
      lastScanned: row.last_scanned,
      isScanning: !!row.is_scanning,
      watchEnabled: !!row.watch_enabled,
      scanInterval: row.scan_interval,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all folders with the given path (there can be multiple with different types)
   */
  getFoldersByPath(folderPath: string): MediaFolder[] {
    const normalizedPath = path.normalize(folderPath);

    // Use case-insensitive comparison on Windows
    const isWindows = process.platform === 'win32';
    const query = isWindows
      ? 'SELECT * FROM media_folders WHERE LOWER(path) = LOWER(?)'
      : 'SELECT * FROM media_folders WHERE path = ?';

    const rows = this.db.prepare(query).all(normalizedPath) as any[];

    return rows.map(row => ({
      id: row.id,
      path: row.path,
      name: row.name,
      type: row.type as MediaFolderType,
      trackCount: row.track_count,
      lastScanned: row.last_scanned,
      isScanning: !!row.is_scanning,
      watchEnabled: !!row.watch_enabled,
      scanInterval: row.scan_interval,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  addFolder(
    folderPath: string,
    type: MediaFolderType,
    options: {
      name?: string;
      watchEnabled?: boolean;
      scanInterval?: number | null;
    } = {}
  ): { success: boolean; folder?: MediaFolder; error?: string } {
    // Normalize path
    const normalizedPath = path.normalize(folderPath);

    console.log(`[MediaFolders] Adding folder: ${normalizedPath} (type: ${type})`);

    // Validate path exists
    if (!fs.existsSync(normalizedPath)) {
      console.log(`[MediaFolders] Path does not exist: ${normalizedPath}`);
      return { success: false, error: 'Path does not exist' };
    }

    // Check if it's a directory
    const stats = fs.statSync(normalizedPath);
    if (!stats.isDirectory()) {
      return { success: false, error: 'Path is not a directory' };
    }

    // Check against forbidden paths
    const platform = process.platform as keyof typeof FORBIDDEN_PATHS;
    const forbidden = FORBIDDEN_PATHS[platform] || FORBIDDEN_PATHS.linux;
    for (const forbiddenPath of forbidden) {
      if (normalizedPath.toLowerCase().startsWith(forbiddenPath.toLowerCase())) {
        return { success: false, error: `Cannot add system directory: ${forbiddenPath}` };
      }
    }

    // Check if path is readable
    try {
      fs.accessSync(normalizedPath, fs.constants.R_OK);
    } catch {
      return { success: false, error: 'Path is not readable' };
    }

    // Check if already exists with SAME type (dual-purpose folders are allowed)
    const existingWithSameType = this.getFolderByPath(normalizedPath, type);
    if (existingWithSameType) {
      console.log(`[MediaFolders] Folder already exists with same type: ${existingWithSameType.path} (type: ${existingWithSameType.type})`);
      return { success: false, error: 'Folder already added with this type' };
    }

    // Check if folder exists with other types (just for logging, we allow this now)
    const existingFolders = this.getFoldersByPath(normalizedPath);
    if (existingFolders.length > 0) {
      const existingTypes = existingFolders.map(f => f.type).join(', ');
      console.log(`[MediaFolders] Folder exists with other types (${existingTypes}), adding as ${type} (dual-purpose folder)`);
    } else {
      console.log(`[MediaFolders] No existing folder found, proceeding to add`);
    }

    // Generate name from path if not provided
    const name = options.name || path.basename(normalizedPath) || 'Media Folder';

    const id = nanoid();
    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO media_folders (id, path, name, type, watch_enabled, scan_interval, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, normalizedPath, name, type, options.watchEnabled ? 1 : 0, options.scanInterval || null, now, now);

      const folder = this.getFolder(id)!;

      // Start periodic scan if configured
      if (options.scanInterval && options.scanInterval > 0) {
        this.startPeriodicScan(id, options.scanInterval);
      }

      this.emit('folder-added', folder);

      return { success: true, folder };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  updateFolder(
    id: string,
    updates: {
      name?: string;
      watchEnabled?: boolean;
      scanInterval?: number | null;
    }
  ): { success: boolean; folder?: MediaFolder; error?: string } {
    const folder = this.getFolder(id);
    if (!folder) {
      return { success: false, error: 'Folder not found' };
    }

    const sets: string[] = ['updated_at = ?'];
    const params: unknown[] = [Date.now()];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      params.push(updates.name);
    }

    if (updates.watchEnabled !== undefined) {
      sets.push('watch_enabled = ?');
      params.push(updates.watchEnabled ? 1 : 0);
    }

    if (updates.scanInterval !== undefined) {
      sets.push('scan_interval = ?');
      params.push(updates.scanInterval);

      // Update periodic scan timer
      this.stopPeriodicScan(id);
      if (updates.scanInterval && updates.scanInterval > 0) {
        this.startPeriodicScan(id, updates.scanInterval);
      }
    }

    params.push(id);

    try {
      this.db.prepare(`UPDATE media_folders SET ${sets.join(', ')} WHERE id = ?`).run(...params);

      const updatedFolder = this.getFolder(id)!;
      this.emit('folder-updated', updatedFolder);

      return { success: true, folder: updatedFolder };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  removeFolder(id: string): { success: boolean; error?: string } {
    const folder = this.getFolder(id);
    if (!folder) {
      return { success: false, error: 'Folder not found' };
    }

    if (folder.isScanning) {
      return { success: false, error: 'Cannot remove folder while scanning' };
    }

    // Stop periodic scan if running
    this.stopPeriodicScan(id);

    try {
      // Delete tracks first (CASCADE should handle this, but be explicit)
      this.db.prepare('DELETE FROM local_tracks WHERE folder_id = ?').run(id);
      this.db.prepare('DELETE FROM media_folders WHERE id = ?').run(id);

      this.emit('folder-removed', { id, path: folder.path });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ========================================
  // Folder Browsing (for picker UI)
  // ========================================

  browse(folderPath?: string): BrowseResult {
    // Default to home directory
    const targetPath = folderPath ? path.normalize(folderPath) : os.homedir();

    // Validate path exists and is readable
    if (!fs.existsSync(targetPath)) {
      return {
        currentPath: os.homedir(),
        parentPath: null,
        directories: [],
        canWrite: false,
      };
    }

    let directories: { name: string; path: string }[] = [];
    let canWrite = false;

    try {
      // Check if readable
      fs.accessSync(targetPath, fs.constants.R_OK);

      // Check if writable
      try {
        fs.accessSync(targetPath, fs.constants.W_OK);
        canWrite = true;
      } catch {
        canWrite = false;
      }

      // Read directory contents
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });

      directories = entries
        .filter(entry => {
          // Only directories
          if (!entry.isDirectory()) return false;
          // Skip hidden directories
          if (entry.name.startsWith('.')) return false;
          // Skip system directories on Windows
          if (process.platform === 'win32') {
            const lower = entry.name.toLowerCase();
            if (['$recycle.bin', 'system volume information', 'recovery'].includes(lower)) {
              return false;
            }
          }
          return true;
        })
        .map(entry => ({
          name: entry.name,
          path: path.join(targetPath, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
      console.error(`[MediaFolders] Error browsing ${targetPath}:`, error);
    }

    // Get parent path
    const parentPath = path.dirname(targetPath);
    const hasParent = parentPath !== targetPath;

    return {
      currentPath: targetPath,
      parentPath: hasParent ? parentPath : null,
      directories,
      canWrite,
    };
  }

  // Get root directories (drives on Windows, / on Unix)
  getRoots(): { name: string; path: string }[] {
    if (process.platform === 'win32') {
      // Get Windows drives
      const drives: { name: string; path: string }[] = [];

      // Check common drive letters
      for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
        const drivePath = `${letter}:\\`;
        if (fs.existsSync(drivePath)) {
          drives.push({ name: `${letter}:`, path: drivePath });
        }
      }

      return drives;
    } else {
      // Unix-like: return common directories
      return [
        { name: 'Home', path: os.homedir() },
        { name: 'Root', path: '/' },
      ];
    }
  }

  // ========================================
  // Scanning State
  // ========================================

  setScanningState(id: string, isScanning: boolean): void {
    this.db.prepare('UPDATE media_folders SET is_scanning = ?, updated_at = ? WHERE id = ?')
      .run(isScanning ? 1 : 0, Date.now(), id);

    if (!isScanning) {
      // Update last scanned time
      this.db.prepare('UPDATE media_folders SET last_scanned = ? WHERE id = ?')
        .run(Date.now(), id);
    }
  }

  updateTrackCount(id: string, count: number): void {
    this.db.prepare('UPDATE media_folders SET track_count = ?, updated_at = ? WHERE id = ?')
      .run(count, Date.now(), id);
  }

  // ========================================
  // Local Tracks
  // ========================================

  getLocalTracks(folderId?: string, options: { limit?: number; offset?: number; isVideo?: boolean } = {}): LocalTrack[] {
    let query = 'SELECT * FROM local_tracks';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (folderId) {
      conditions.push('folder_id = ?');
      params.push(folderId);
    }

    if (options.isVideo !== undefined) {
      conditions.push('is_video = ?');
      params.push(options.isVideo ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY title ASC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => this.rowToLocalTrack(row));
  }

  getLocalTrack(id: string): LocalTrack | null {
    const row = this.db.prepare('SELECT * FROM local_tracks WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.rowToLocalTrack(row);
  }

  getLocalTrackByPath(filePath: string): LocalTrack | null {
    const normalizedPath = path.normalize(filePath);
    const row = this.db.prepare('SELECT * FROM local_tracks WHERE file_path = ?').get(normalizedPath) as any;
    if (!row) return null;
    return this.rowToLocalTrack(row);
  }

  upsertLocalTrack(track: Omit<LocalTrack, 'id' | 'addedAt'> & { id?: string; addedAt?: number }): LocalTrack {
    const id = track.id || `local:${Buffer.from(track.filePath).toString('base64url')}`;
    const now = Date.now();
    const addedAt = track.addedAt || now;

    this.db.prepare(`
      INSERT INTO local_tracks (
        id, folder_id, file_path, filename, title, artists, album, album_artist,
        genre, year, track_number, disc_number, duration, bitrate, sample_rate,
        codec, has_artwork, artwork_path, file_size, last_modified, added_at,
        is_video, width, height, frame_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        title = excluded.title,
        artists = excluded.artists,
        album = excluded.album,
        album_artist = excluded.album_artist,
        genre = excluded.genre,
        year = excluded.year,
        track_number = excluded.track_number,
        disc_number = excluded.disc_number,
        duration = excluded.duration,
        bitrate = excluded.bitrate,
        sample_rate = excluded.sample_rate,
        codec = excluded.codec,
        has_artwork = excluded.has_artwork,
        artwork_path = excluded.artwork_path,
        file_size = excluded.file_size,
        last_modified = excluded.last_modified,
        is_video = excluded.is_video,
        width = excluded.width,
        height = excluded.height,
        frame_rate = excluded.frame_rate
    `).run(
      id,
      track.folderId,
      path.normalize(track.filePath),
      track.filename,
      track.title,
      JSON.stringify(track.artists),
      track.album,
      track.albumArtist,
      JSON.stringify(track.genre),
      track.year,
      track.trackNumber,
      track.discNumber,
      track.duration,
      track.bitrate,
      track.sampleRate,
      track.codec,
      track.hasArtwork ? 1 : 0,
      track.artworkPath,
      track.fileSize,
      track.lastModified,
      addedAt,
      track.isVideo ? 1 : 0,
      track.width,
      track.height,
      track.frameRate
    );

    return this.getLocalTrack(id)!;
  }

  deleteLocalTrack(id: string): void {
    this.db.prepare('DELETE FROM local_tracks WHERE id = ?').run(id);
  }

  deleteLocalTracksByFolder(folderId: string): void {
    this.db.prepare('DELETE FROM local_tracks WHERE folder_id = ?').run(folderId);
  }

  // Remove tracks that no longer exist on disk
  pruneDeletedTracks(folderId: string): number {
    const tracks = this.getLocalTracks(folderId);
    let pruned = 0;

    for (const track of tracks) {
      if (!fs.existsSync(track.filePath)) {
        this.deleteLocalTrack(track.id);
        pruned++;
      }
    }

    if (pruned > 0) {
      // Update track count
      const remaining = this.getLocalTracks(folderId).length;
      this.updateTrackCount(folderId, remaining);
    }

    return pruned;
  }

  private rowToLocalTrack(row: any): LocalTrack {
    return {
      id: row.id,
      folderId: row.folder_id,
      filePath: row.file_path,
      filename: row.filename,
      title: row.title,
      artists: JSON.parse(row.artists || '[]'),
      album: row.album,
      albumArtist: row.album_artist,
      genre: JSON.parse(row.genre || '[]'),
      year: row.year,
      trackNumber: row.track_number,
      discNumber: row.disc_number,
      duration: row.duration,
      bitrate: row.bitrate,
      sampleRate: row.sample_rate,
      codec: row.codec,
      hasArtwork: !!row.has_artwork,
      artworkPath: row.artwork_path,
      fileSize: row.file_size,
      lastModified: row.last_modified,
      addedAt: row.added_at,
      isVideo: !!row.is_video,
      width: row.width,
      height: row.height,
      frameRate: row.frame_rate,
    };
  }

  // ========================================
  // Periodic Scanning
  // ========================================

  private startPeriodicScan(folderId: string, intervalMinutes: number): void {
    this.stopPeriodicScan(folderId);

    const intervalMs = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      const folder = this.getFolder(folderId);
      if (folder && !folder.isScanning) {
        this.emit('periodic-scan-triggered', folder);
      }
    }, intervalMs);

    this.scanIntervals.set(folderId, timer);
    console.log(`[MediaFolders] Started periodic scan for ${folderId} every ${intervalMinutes} minutes`);
  }

  private stopPeriodicScan(folderId: string): void {
    const timer = this.scanIntervals.get(folderId);
    if (timer) {
      clearInterval(timer);
      this.scanIntervals.delete(folderId);
      console.log(`[MediaFolders] Stopped periodic scan for ${folderId}`);
    }
  }

  // ========================================
  // Downloads Management
  // ========================================

  getDownloads(status?: string): any[] {
    let query = 'SELECT * FROM downloads';
    const params: unknown[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    return this.db.prepare(query).all(...params) as any[];
  }

  getDownload(id: string): any | null {
    return this.db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as any;
  }

  createDownload(data: {
    id?: string; // Allow passing in the download ID
    sourceUrl: string;
    sourceType: string;
    trackData?: unknown;
    filename: string;
    folderId?: string;
  }): string {
    const id = data.id || nanoid();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO downloads (id, folder_id, source_url, source_type, track_data, filename, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
    `).run(id, data.folderId || null, data.sourceUrl, data.sourceType,
           data.trackData ? JSON.stringify(data.trackData) : null, data.filename, now);

    return id;
  }

  updateDownload(id: string, updates: {
    status?: string;
    progress?: number;
    totalBytes?: number;
    downloadedBytes?: number;
    filePath?: string;
    error?: string;
    completedAt?: number;
  }): void {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.status !== undefined) {
      sets.push('status = ?');
      params.push(updates.status);
    }
    if (updates.progress !== undefined) {
      sets.push('progress = ?');
      params.push(updates.progress);
    }
    if (updates.totalBytes !== undefined) {
      sets.push('total_bytes = ?');
      params.push(updates.totalBytes);
    }
    if (updates.downloadedBytes !== undefined) {
      sets.push('downloaded_bytes = ?');
      params.push(updates.downloadedBytes);
    }
    if (updates.filePath !== undefined) {
      sets.push('file_path = ?');
      params.push(updates.filePath);
    }
    if (updates.error !== undefined) {
      sets.push('error = ?');
      params.push(updates.error);
    }
    if (updates.completedAt !== undefined) {
      sets.push('completed_at = ?');
      params.push(updates.completedAt);
    }

    if (sets.length > 0) {
      params.push(id);
      this.db.prepare(`UPDATE downloads SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }
  }

  deleteDownload(id: string): void {
    this.db.prepare('DELETE FROM downloads WHERE id = ?').run(id);
  }

  // ========================================
  // Cleanup
  // ========================================

  close(): void {
    // Stop all periodic scans
    for (const [folderId] of this.scanIntervals) {
      this.stopPeriodicScan(folderId);
    }
  }
}
