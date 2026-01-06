/**
 * Folder Watcher Service
 *
 * Uses chokidar to watch media folders for file changes.
 * Triggers partial scans when files are added, modified, or removed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import chokidar, { FSWatcher } from 'chokidar';
import {
  MediaFoldersService,
  MediaFolder,
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from './media-folders';
import { LocalScannerService } from './local-scanner';

// ========================================
// Types
// ========================================

export interface WatcherEvent {
  folderId: string;
  folderPath: string;
  type: 'add' | 'change' | 'unlink';
  filePath: string;
  filename: string;
}

// ========================================
// Folder Watcher Service
// ========================================

export class FolderWatcherService extends EventEmitter {
  private mediaFolders: MediaFoldersService;
  private localScanner: LocalScannerService;
  private watchers: Map<string, FSWatcher> = new Map();
  private pendingScans: Map<string, NodeJS.Timeout> = new Map();
  private supportedExtensions: Set<string>;

  // Debounce delay before triggering scan (ms)
  private readonly SCAN_DEBOUNCE_MS = 5000;

  constructor(mediaFolders: MediaFoldersService, localScanner: LocalScannerService) {
    super();
    this.mediaFolders = mediaFolders;
    this.localScanner = localScanner;

    // Build set of all supported extensions
    this.supportedExtensions = new Set([
      ...AUDIO_EXTENSIONS,
      ...VIDEO_EXTENSIONS,
    ]);

    // Listen for folder changes
    this.mediaFolders.on('folder-added', (folder: MediaFolder) => {
      if (folder.watchEnabled) {
        this.startWatching(folder);
      }
    });

    this.mediaFolders.on('folder-updated', (folder: MediaFolder) => {
      // Stop existing watcher if any
      this.stopWatching(folder.id);

      // Start new watcher if enabled
      if (folder.watchEnabled) {
        this.startWatching(folder);
      }
    });

    this.mediaFolders.on('folder-removed', ({ id }: { id: string }) => {
      this.stopWatching(id);
    });

    // Initialize watchers for existing folders
    this.initializeWatchers();
  }

  private initializeWatchers(): void {
    const folders = this.mediaFolders.getFolders();

    for (const folder of folders) {
      if (folder.watchEnabled) {
        this.startWatching(folder);
      }
    }
  }

  // ========================================
  // Watcher Management
  // ========================================

  startWatching(folder: MediaFolder): void {
    // Don't start if already watching
    if (this.watchers.has(folder.id)) {
      return;
    }

    // Check folder exists
    if (!fs.existsSync(folder.path)) {
      console.warn(`[FolderWatcher] Cannot watch non-existent folder: ${folder.path}`);
      return;
    }

    try {
      // Create watcher with optimized settings
      const watcher = chokidar.watch(folder.path, {
        persistent: true,
        ignoreInitial: true, // Don't trigger events for existing files
        followSymlinks: false,
        depth: 10, // Reasonable depth limit
        usePolling: false, // Use native events when possible
        awaitWriteFinish: {
          stabilityThreshold: 2000, // Wait for file to stop changing
          pollInterval: 100,
        },
        ignored: [
          /(^|[\/\\])\../, // Ignore hidden files/directories
          '**/node_modules/**',
          '**/Thumbs.db',
          '**/.DS_Store',
          '**/*.tmp',
          '**/*.part',
        ],
      });

      // Handle file events
      watcher.on('add', (filePath) => this.handleFileEvent(folder, 'add', filePath));
      watcher.on('change', (filePath) => this.handleFileEvent(folder, 'change', filePath));
      watcher.on('unlink', (filePath) => this.handleFileEvent(folder, 'unlink', filePath));

      // Handle errors
      watcher.on('error', (error) => {
        console.error(`[FolderWatcher] Error watching ${folder.name}:`, error);
        this.emit('watcher-error', { folderId: folder.id, error });
      });

      // Store watcher
      this.watchers.set(folder.id, watcher);
      console.log(`[FolderWatcher] Started watching: ${folder.name} (${folder.path})`);

    } catch (error) {
      console.error(`[FolderWatcher] Failed to start watching ${folder.name}:`, error);
    }
  }

  stopWatching(folderId: string): void {
    const watcher = this.watchers.get(folderId);
    if (watcher) {
      watcher.close().catch(err => {
        console.error(`[FolderWatcher] Error closing watcher:`, err);
      });
      this.watchers.delete(folderId);
      console.log(`[FolderWatcher] Stopped watching folder: ${folderId}`);
    }

    // Clear any pending scan
    const pendingScan = this.pendingScans.get(folderId);
    if (pendingScan) {
      clearTimeout(pendingScan);
      this.pendingScans.delete(folderId);
    }
  }

  stopAll(): void {
    for (const folderId of this.watchers.keys()) {
      this.stopWatching(folderId);
    }
  }

  // ========================================
  // Event Handling
  // ========================================

  private handleFileEvent(folder: MediaFolder, type: 'add' | 'change' | 'unlink', filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();

    // Only process supported media files
    if (!this.supportedExtensions.has(ext)) {
      return;
    }

    const filename = path.basename(filePath);

    // Emit event for UI updates
    const event: WatcherEvent = {
      folderId: folder.id,
      folderPath: folder.path,
      type,
      filePath,
      filename,
    };

    this.emit('file-change', event);
    console.log(`[FolderWatcher] ${type}: ${filename} in ${folder.name}`);

    // Handle immediate delete (no scan needed, just remove from DB)
    if (type === 'unlink') {
      const track = this.mediaFolders.getLocalTrackByPath(filePath);
      if (track) {
        this.mediaFolders.deleteLocalTrack(track.id);
        // Update folder track count
        const tracks = this.mediaFolders.getLocalTracks(folder.id);
        this.mediaFolders.updateTrackCount(folder.id, tracks.length);
      }
      return;
    }

    // For add/change, debounce and trigger a scan
    this.scheduleScan(folder);
  }

  private scheduleScan(folder: MediaFolder): void {
    // Clear existing pending scan
    const existing = this.pendingScans.get(folder.id);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule new scan
    const timeout = setTimeout(() => {
      this.pendingScans.delete(folder.id);

      // Check if folder is already scanning
      const current = this.mediaFolders.getFolder(folder.id);
      if (!current || current.isScanning) {
        return;
      }

      console.log(`[FolderWatcher] Triggering scan for: ${folder.name}`);

      // Trigger scan in background
      this.localScanner.scanFolder(folder.id, {
        includeVideos: folder.type === 'video',
      }).catch(err => {
        console.error(`[FolderWatcher] Scan failed:`, err);
      });

    }, this.SCAN_DEBOUNCE_MS);

    this.pendingScans.set(folder.id, timeout);
  }

  // ========================================
  // Status
  // ========================================

  getWatchedFolders(): string[] {
    return Array.from(this.watchers.keys());
  }

  isWatching(folderId: string): boolean {
    return this.watchers.has(folderId);
  }

  getStatus(): { watching: number; pendingScans: number } {
    return {
      watching: this.watchers.size,
      pendingScans: this.pendingScans.size,
    };
  }
}
