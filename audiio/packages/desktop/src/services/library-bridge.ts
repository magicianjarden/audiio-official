/**
 * Library Bridge - Bridges desktop renderer library data to main process
 *
 * This service enables the mobile server to access and modify the desktop's
 * library data (likes, playlists, downloads) stored in the renderer's Zustand stores.
 *
 * The bridge works by:
 * 1. Requesting data from the renderer via IPC
 * 2. Executing actions in the renderer via IPC
 * 3. Listening for changes from the renderer for sync notifications
 */

import { BrowserWindow, ipcMain } from 'electron';
import type { UnifiedTrack } from '@audiio/sdk';

// Playlist type (matches UI library store)
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  tracks: UnifiedTrack[];
  createdAt: Date;
  updatedAt: Date;
}

// Types for library data
export interface LibraryData {
  likedTracks: UnifiedTrack[];
  playlists: Playlist[];
  dislikedTrackIds: string[];
}

export interface LibraryBridgeEvents {
  onLibraryChange: (data: Partial<LibraryData>) => void;
}

export class LibraryBridge {
  private mainWindow: BrowserWindow | null = null;
  private cachedData: LibraryData = {
    likedTracks: [],
    playlists: [],
    dislikedTrackIds: []
  };
  private listeners: LibraryBridgeEvents['onLibraryChange'][] = [];

  constructor() {
    this.setupIpcHandlers();
  }

  /**
   * Set the main window reference for IPC communication
   */
  setWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    if (window) {
      // Request initial data when window is set
      this.refreshData();
    }
  }

  /**
   * Setup IPC handlers for library operations
   */
  private setupIpcHandlers(): void {
    // Handle library data updates from renderer
    ipcMain.on('library-data-update', (_event, data: Partial<LibraryData>) => {
      this.updateCache(data);
      this.notifyListeners(data);
    });

    // Handle specific library change events
    ipcMain.on('library-track-liked', (_event, track: UnifiedTrack) => {
      if (!this.cachedData.likedTracks.find(t => t.id === track.id)) {
        this.cachedData.likedTracks.push(track);
        this.notifyListeners({ likedTracks: this.cachedData.likedTracks });
      }
    });

    ipcMain.on('library-track-unliked', (_event, trackId: string) => {
      this.cachedData.likedTracks = this.cachedData.likedTracks.filter(t => t.id !== trackId);
      this.notifyListeners({ likedTracks: this.cachedData.likedTracks });
    });

    ipcMain.on('library-playlist-created', (_event, playlist: Playlist) => {
      this.cachedData.playlists.push(playlist);
      this.notifyListeners({ playlists: this.cachedData.playlists });
    });

    ipcMain.on('library-playlist-deleted', (_event, playlistId: string) => {
      this.cachedData.playlists = this.cachedData.playlists.filter(p => p.id !== playlistId);
      this.notifyListeners({ playlists: this.cachedData.playlists });
    });

    ipcMain.on('library-playlist-updated', (_event, playlist: Playlist) => {
      const index = this.cachedData.playlists.findIndex(p => p.id === playlist.id);
      if (index >= 0) {
        this.cachedData.playlists[index] = playlist;
        this.notifyListeners({ playlists: this.cachedData.playlists });
      }
    });
  }

  /**
   * Request full data refresh from renderer
   */
  async refreshData(): Promise<LibraryData> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return this.cachedData;
    }

    try {
      // Request data from renderer
      this.mainWindow.webContents.send('library-request-data');

      // Wait for response (with timeout)
      const data = await new Promise<LibraryData>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ipcMain.removeListener('library-data-response', handler);
          reject(new Error('Library data request timeout'));
        }, 5000);

        const handler = (_event: Electron.IpcMainEvent, data: LibraryData) => {
          clearTimeout(timeout);
          ipcMain.removeListener('library-data-response', handler);
          resolve(data);
        };

        ipcMain.once('library-data-response', handler);
      });

      this.updateCache(data);
      return data;
    } catch (error) {
      console.error('[LibraryBridge] Failed to refresh data:', error);
      return this.cachedData;
    }
  }

  /**
   * Update cached data
   */
  private updateCache(data: Partial<LibraryData>): void {
    if (data.likedTracks !== undefined) {
      this.cachedData.likedTracks = data.likedTracks;
    }
    if (data.playlists !== undefined) {
      this.cachedData.playlists = data.playlists;
    }
    if (data.dislikedTrackIds !== undefined) {
      this.cachedData.dislikedTrackIds = data.dislikedTrackIds;
    }
  }

  /**
   * Notify listeners of library changes
   */
  private notifyListeners(data: Partial<LibraryData>): void {
    this.listeners.forEach(listener => listener(data));
  }

  /**
   * Add a change listener
   */
  onLibraryChange(callback: LibraryBridgeEvents['onLibraryChange']): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // ========================================
  // Read Operations
  // ========================================

  /**
   * Get all liked tracks
   */
  getLikedTracks(): UnifiedTrack[] {
    return this.cachedData.likedTracks;
  }

  /**
   * Check if a track is liked
   */
  isTrackLiked(trackId: string): boolean {
    return this.cachedData.likedTracks.some(t => t.id === trackId);
  }

  /**
   * Get all playlists
   */
  getPlaylists(): Playlist[] {
    return this.cachedData.playlists;
  }

  /**
   * Get a playlist by ID
   */
  getPlaylist(playlistId: string): Playlist | undefined {
    return this.cachedData.playlists.find(p => p.id === playlistId);
  }

  /**
   * Check if a track is disliked
   */
  isTrackDisliked(trackId: string): boolean {
    return this.cachedData.dislikedTrackIds.includes(trackId);
  }

  // ========================================
  // Write Operations (via IPC to renderer)
  // ========================================

  /**
   * Like a track
   */
  async likeTrack(track: UnifiedTrack): Promise<boolean> {
    return this.sendAction('library-action-like', track);
  }

  /**
   * Unlike a track
   */
  async unlikeTrack(trackId: string): Promise<boolean> {
    return this.sendAction('library-action-unlike', trackId);
  }

  /**
   * Toggle like status
   */
  async toggleLike(track: UnifiedTrack): Promise<boolean> {
    if (this.isTrackLiked(track.id)) {
      return this.unlikeTrack(track.id);
    }
    return this.likeTrack(track);
  }

  /**
   * Dislike a track with reasons
   */
  async dislikeTrack(track: UnifiedTrack, reasons: string[]): Promise<boolean> {
    return this.sendAction('library-action-dislike', { track, reasons });
  }

  /**
   * Remove dislike
   */
  async removeDislike(trackId: string): Promise<boolean> {
    return this.sendAction('library-action-remove-dislike', trackId);
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(name: string, description?: string): Promise<Playlist | null> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return null;
    }

    try {
      this.mainWindow.webContents.send('library-action-create-playlist', { name, description });

      const playlist = await new Promise<Playlist>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ipcMain.removeListener('library-playlist-created', handler);
          reject(new Error('Playlist creation timeout'));
        }, 5000);

        const handler = (_event: Electron.IpcMainEvent, playlist: Playlist) => {
          clearTimeout(timeout);
          ipcMain.removeListener('library-playlist-created', handler);
          resolve(playlist);
        };

        ipcMain.once('library-playlist-created', handler);
      });

      return playlist;
    } catch (error) {
      console.error('[LibraryBridge] Failed to create playlist:', error);
      return null;
    }
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId: string): Promise<boolean> {
    return this.sendAction('library-action-delete-playlist', playlistId);
  }

  /**
   * Rename a playlist
   */
  async renamePlaylist(playlistId: string, name: string): Promise<boolean> {
    return this.sendAction('library-action-rename-playlist', { playlistId, name });
  }

  /**
   * Add a track to a playlist
   */
  async addToPlaylist(playlistId: string, track: UnifiedTrack): Promise<boolean> {
    return this.sendAction('library-action-add-to-playlist', { playlistId, track });
  }

  /**
   * Remove a track from a playlist
   */
  async removeFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    return this.sendAction('library-action-remove-from-playlist', { playlistId, trackId });
  }

  /**
   * Send an action to the renderer and wait for acknowledgment
   */
  private async sendAction(channel: string, payload: unknown): Promise<boolean> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.error('[LibraryBridge] No window available for action:', channel);
      return false;
    }

    try {
      this.mainWindow.webContents.send(channel, payload);
      return true;
    } catch (error) {
      console.error(`[LibraryBridge] Failed to send action ${channel}:`, error);
      return false;
    }
  }

  /**
   * Cleanup handlers
   */
  destroy(): void {
    ipcMain.removeAllListeners('library-data-update');
    ipcMain.removeAllListeners('library-track-liked');
    ipcMain.removeAllListeners('library-track-unliked');
    ipcMain.removeAllListeners('library-playlist-created');
    ipcMain.removeAllListeners('library-playlist-deleted');
    ipcMain.removeAllListeners('library-playlist-updated');
    ipcMain.removeAllListeners('library-data-response');
    this.listeners = [];
    this.mainWindow = null;
  }
}

// Singleton instance
let libraryBridge: LibraryBridge | null = null;

export function getLibraryBridge(): LibraryBridge {
  if (!libraryBridge) {
    libraryBridge = new LibraryBridge();
  }
  return libraryBridge;
}
