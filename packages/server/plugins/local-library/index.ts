/**
 * Local Library Plugin
 *
 * Built-in plugin for local file access - DISABLED BY DEFAULT
 * Supports audio and video files with folder-based organization.
 *
 * Security:
 * - Uses sandboxed filesystem access (SandboxedFS)
 * - Only accesses paths authorized by admin
 * - Requests new path access through sandbox.requestPathAccess()
 *
 * Source ID Format: local:<folder-name>
 * Track ID Format: local:<folder-name>:track:<hash>
 * Video ID Format: local:<folder-name>:video:<hash>
 */

import * as path from 'path';
import { createHash } from 'crypto';
import {
  BaseMetadataProvider,
  type PluginRouteHandler,
  type PluginRouteRequest,
  type PluginRouteReply,
  type SandboxContext,
  type SandboxedFS,
  type PluginInitOptions
} from '@audiio/sdk';
import type { MetadataSearchResult, StreamInfo } from '@audiio/core';
import { LocalScanner, type ScanProgress, type LocalTrack, type LocalVideo } from './scanner';
import { LocalDatabase } from './database';

// ========================================
// Types
// ========================================

export interface LocalFolder {
  id: string;                    // e.g., "music", "downloads"
  path: string;                  // Absolute path
  name: string;                  // Display name
  contentTypes: ContentType[];   // ['audio', 'video', 'mixed']
  enabled: boolean;
  stats: {
    trackCount: number;
    videoCount: number;
    totalSize: number;
  };
  addedAt: number;
  lastScanned: number | null;
}

export type ContentType = 'audio' | 'video' | 'mixed';

export interface ScanStatus {
  scanning: boolean;
  folderId?: string;
  progress?: ScanProgress;
  lastScan?: number;
}

// ========================================
// Local Library Plugin
// ========================================

export class LocalLibraryPlugin extends BaseMetadataProvider {
  manifest = {
    id: 'local-library',
    name: 'Local Library',
    version: '1.0.0',
    description: 'Access local music and video files from configured folders',
    roles: ['metadata-provider' as const, 'stream-provider' as const],
    defaultEnabled: false,
    // Declare required capabilities
    capabilities: {
      filesystem: {
        read: true,
        write: false,  // Only need read for media files
        allowedPaths: []  // Will be populated by admin-authorized paths
      },
      network: {
        outbound: false  // No network needed for local files
      },
      apis: {
        library: true  // Need library API access
      }
    }
  };

  private db: LocalDatabase | null = null;
  private scanner: LocalScanner | null = null;
  private scanStatus: ScanStatus = { scanning: false };
  private dataPath: string = '';

  // Sandbox context for secure filesystem access
  private sandbox: SandboxContext | null = null;
  private sandboxedFs: SandboxedFS | null = null;

  async initialize(options?: PluginInitOptions): Promise<void> {
    console.log('[LocalLibrary] Initializing...');

    // Store sandbox context if provided
    if (options?.sandbox) {
      this.sandbox = options.sandbox;
      this.sandboxedFs = options.sandbox.fs;
      this.dataPath = options.sandbox.dataDir;
      console.log('[LocalLibrary] Running in sandboxed mode');
      console.log('[LocalLibrary] Authorized paths:', this.sandbox.getAuthorizedPaths());
    } else {
      // Fallback for unsandboxed mode (development)
      this.dataPath = process.env.AUDIIO_DATA_PATH ||
                      path.join(process.cwd(), 'data');
      console.log('[LocalLibrary] Running in unsandboxed mode (development)');
    }

    const dbPath = path.join(this.dataPath, 'local-library.db');

    this.db = new LocalDatabase(dbPath);
    this.scanner = new LocalScanner(this.sandboxedFs);

    console.log('[LocalLibrary] Initialized');
  }

  async dispose(): Promise<void> {
    this.db?.close();
    console.log('[LocalLibrary] Disposed');
  }

  // ========================================
  // Plugin Routes
  // ========================================

  getRoutes(): PluginRouteHandler[] {
    return [
      // Folder management
      {
        method: 'GET',
        path: '/folders',
        handler: this.getFolders.bind(this),
        description: 'List all configured folders'
      },
      {
        method: 'POST',
        path: '/folders',
        handler: this.addFolder.bind(this),
        description: 'Add a new folder'
      },
      {
        method: 'DELETE',
        path: '/folders/:id',
        handler: this.removeFolder.bind(this),
        description: 'Remove a folder'
      },
      {
        method: 'PATCH',
        path: '/folders/:id',
        handler: this.updateFolder.bind(this),
        description: 'Update folder settings'
      },

      // Scanning
      {
        method: 'POST',
        path: '/scan',
        handler: this.triggerScanAll.bind(this),
        description: 'Scan all folders'
      },
      {
        method: 'POST',
        path: '/scan/:folderId',
        handler: this.scanFolder.bind(this),
        description: 'Scan a specific folder'
      },
      {
        method: 'GET',
        path: '/scan/status',
        handler: this.getScanStatus.bind(this),
        description: 'Get current scan status'
      },

      // Browsing
      {
        method: 'GET',
        path: '/browse',
        handler: this.browseFiles.bind(this),
        description: 'Browse all content'
      },
      {
        method: 'GET',
        path: '/browse/:folderId',
        handler: this.browseFolder.bind(this),
        description: 'Browse folder content'
      },

      // Content
      {
        method: 'GET',
        path: '/tracks',
        handler: this.getTracks.bind(this),
        description: 'Get all tracks'
      },
      {
        method: 'GET',
        path: '/tracks/:folderId',
        handler: this.getFolderTracks.bind(this),
        description: 'Get tracks from a folder'
      },
      {
        method: 'GET',
        path: '/videos',
        handler: this.getVideos.bind(this),
        description: 'Get all videos'
      },
      {
        method: 'GET',
        path: '/videos/:folderId',
        handler: this.getFolderVideos.bind(this),
        description: 'Get videos from a folder'
      },

      // Stream
      {
        method: 'GET',
        path: '/stream/:type/:id',
        handler: this.getStreamUrl.bind(this),
        description: 'Get stream URL for a file'
      }
    ];
  }

  // ========================================
  // Folder Management
  // ========================================

  private async getFolders(req: PluginRouteRequest, reply: PluginRouteReply) {
    const folders = this.db?.getFolders() || [];
    return { folders };
  }

  private async addFolder(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { path: folderPath, name, contentTypes } = req.body as {
      path: string;
      name?: string;
      contentTypes?: ContentType[];
    };

    if (!folderPath) {
      reply.code(400);
      return { error: 'path is required' };
    }

    // Check if path is authorized (when running in sandbox)
    if (this.sandbox) {
      const authorizedPaths = this.sandbox.getAuthorizedPaths();
      const normalizedPath = path.resolve(folderPath).toLowerCase();
      const isAuthorized = authorizedPaths.some(ap =>
        normalizedPath.startsWith(path.resolve(ap).toLowerCase())
      );

      if (!isAuthorized) {
        // Request access - this will notify admin
        const granted = await this.sandbox.requestPathAccess(folderPath, false);
        if (!granted) {
          reply.code(403);
          return {
            error: 'Path not authorized',
            message: 'This path requires admin approval. A request has been submitted.',
            pendingApproval: true
          };
        }
      }
    }

    // Validate path exists using sandbox fs or native fs
    try {
      if (this.sandboxedFs) {
        const stats = await this.sandboxedFs.stat(folderPath);
        if (!stats.isDirectory) {
          reply.code(400);
          return { error: 'Path is not a directory' };
        }
      } else {
        // Fallback for unsandboxed mode
        const fs = await import('fs/promises');
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
          reply.code(400);
          return { error: 'Path is not a directory' };
        }
      }
    } catch (error) {
      reply.code(400);
      const message = error instanceof Error ? error.message : 'Path does not exist';
      return { error: message };
    }

    // Generate folder ID from path
    const folderId = this.generateFolderId(folderPath);

    // Check if already exists
    if (this.db?.getFolder(folderId)) {
      reply.code(400);
      return { error: 'Folder already configured' };
    }

    const folder: LocalFolder = {
      id: folderId,
      path: folderPath,
      name: name || path.basename(folderPath),
      contentTypes: contentTypes || ['mixed'],
      enabled: true,
      stats: { trackCount: 0, videoCount: 0, totalSize: 0 },
      addedAt: Date.now(),
      lastScanned: null
    };

    this.db?.addFolder(folder);

    return { success: true, folder };
  }

  private async removeFolder(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { id } = req.params;

    if (!this.db?.getFolder(id)) {
      reply.code(404);
      return { error: 'Folder not found' };
    }

    this.db?.removeFolder(id);
    return { success: true };
  }

  private async updateFolder(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { id } = req.params;
    const updates = req.body as Partial<Pick<LocalFolder, 'name' | 'enabled' | 'contentTypes'>>;

    if (!this.db?.getFolder(id)) {
      reply.code(404);
      return { error: 'Folder not found' };
    }

    this.db?.updateFolder(id, updates);
    return { success: true };
  }

  // ========================================
  // Scanning
  // ========================================

  private async triggerScanAll(req: PluginRouteRequest, reply: PluginRouteReply) {
    if (this.scanStatus.scanning) {
      return { error: 'Scan already in progress' };
    }

    const folders = this.db?.getFolders() || [];
    const enabledFolders = folders.filter(f => f.enabled);

    if (enabledFolders.length === 0) {
      return { error: 'No folders configured' };
    }

    // Start scanning in background
    this.startScanning(enabledFolders);

    return { success: true, foldersToScan: enabledFolders.length };
  }

  private async scanFolder(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { folderId } = req.params;

    if (this.scanStatus.scanning) {
      return { error: 'Scan already in progress' };
    }

    const folder = this.db?.getFolder(folderId);
    if (!folder) {
      reply.code(404);
      return { error: 'Folder not found' };
    }

    // Start scanning in background
    this.startScanning([folder]);

    return { success: true };
  }

  private async getScanStatus(req: PluginRouteRequest, reply: PluginRouteReply) {
    return this.scanStatus;
  }

  private async startScanning(folders: LocalFolder[]): Promise<void> {
    if (!this.scanner) return;

    this.scanStatus = { scanning: true };

    for (const folder of folders) {
      this.scanStatus.folderId = folder.id;

      try {
        const result = await this.scanner.scanDirectory(folder.path, {
          includeAudio: folder.contentTypes.includes('audio') || folder.contentTypes.includes('mixed'),
          includeVideo: folder.contentTypes.includes('video') || folder.contentTypes.includes('mixed'),
          onProgress: (progress) => {
            this.scanStatus.progress = progress;
          }
        });

        // Store results in database
        for (const track of result.tracks) {
          const trackId = `local:${folder.id}:track:${this.hashPath(track.filePath)}`;
          this.db?.upsertTrack({
            ...track,
            id: trackId,
            folderId: folder.id
          });
        }

        for (const video of result.videos) {
          const videoId = `local:${folder.id}:video:${this.hashPath(video.filePath)}`;
          this.db?.upsertVideo({
            ...video,
            id: videoId,
            folderId: folder.id
          });
        }

        // Update folder stats
        this.db?.updateFolder(folder.id, {
          lastScanned: Date.now(),
          stats: {
            trackCount: result.tracks.length,
            videoCount: result.videos.length,
            totalSize: result.tracks.reduce((sum, t) => sum + (t.fileSize || 0), 0) +
                       result.videos.reduce((sum, v) => sum + (v.fileSize || 0), 0)
          }
        } as any);

        console.log(`[LocalLibrary] Scanned ${folder.name}: ${result.tracks.length} tracks, ${result.videos.length} videos`);
      } catch (error) {
        console.error(`[LocalLibrary] Error scanning ${folder.path}:`, error);
      }
    }

    this.scanStatus = { scanning: false, lastScan: Date.now() };
  }

  // ========================================
  // Browsing
  // ========================================

  private async browseFiles(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { type, limit, offset, search } = req.query as {
      type?: 'audio' | 'video' | 'all';
      limit?: string;
      offset?: string;
      search?: string;
    };

    const l = parseInt(limit || '50', 10);
    const o = parseInt(offset || '0', 10);

    let tracks: any[] = [];
    let videos: any[] = [];

    if (type === 'audio' || type === 'all' || !type) {
      tracks = this.db?.searchTracks(search || '', l, o) || [];
    }

    if (type === 'video' || type === 'all' || !type) {
      videos = this.db?.searchVideos(search || '', l, o) || [];
    }

    return { tracks, videos };
  }

  private async browseFolder(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { folderId } = req.params;
    const { limit, offset } = req.query as { limit?: string; offset?: string };

    const l = parseInt(limit || '50', 10);
    const o = parseInt(offset || '0', 10);

    const tracks = this.db?.getFolderTracks(folderId, l, o) || [];
    const videos = this.db?.getFolderVideos(folderId, l, o) || [];

    return { tracks, videos };
  }

  // ========================================
  // Content
  // ========================================

  private async getTracks(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { limit, offset, artist, album, genre } = req.query as {
      limit?: string;
      offset?: string;
      artist?: string;
      album?: string;
      genre?: string;
    };

    const l = parseInt(limit || '50', 10);
    const o = parseInt(offset || '0', 10);

    const tracks = this.db?.getTracks({ limit: l, offset: o, artist, album, genre }) || [];
    return { tracks };
  }

  private async getFolderTracks(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { folderId } = req.params;
    const { limit, offset } = req.query as { limit?: string; offset?: string };

    const l = parseInt(limit || '50', 10);
    const o = parseInt(offset || '0', 10);

    const tracks = this.db?.getFolderTracks(folderId, l, o) || [];
    return { tracks };
  }

  private async getVideos(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { limit, offset, artist, type } = req.query as {
      limit?: string;
      offset?: string;
      artist?: string;
      type?: string;
    };

    const l = parseInt(limit || '50', 10);
    const o = parseInt(offset || '0', 10);

    const videos = this.db?.getVideos({ limit: l, offset: o, artist, videoType: type }) || [];
    return { videos };
  }

  private async getFolderVideos(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { folderId } = req.params;
    const { limit, offset } = req.query as { limit?: string; offset?: string };

    const l = parseInt(limit || '50', 10);
    const o = parseInt(offset || '0', 10);

    const videos = this.db?.getFolderVideos(folderId, l, o) || [];
    return { videos };
  }

  // ========================================
  // Streaming
  // ========================================

  private async getStreamUrl(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { type, id } = req.params;

    let item: any;
    if (type === 'track') {
      item = this.db?.getTrack(id);
    } else if (type === 'video') {
      item = this.db?.getVideo(id);
    }

    if (!item) {
      reply.code(404);
      return { error: 'Item not found' };
    }

    // Return file:// URL for local playback
    return {
      url: `file://${item.filePath}`,
      mimeType: item.mimeType,
      duration: item.duration
    };
  }

  // ========================================
  // MetadataProvider Implementation
  // ========================================

  async search(query: string, options?: { limit?: number }): Promise<MetadataSearchResult> {
    const limit = options?.limit || 20;
    const tracks = this.db?.searchTracks(query, limit, 0) || [];

    return {
      tracks: tracks.map(t => this.convertToUnifiedTrack(t)),
      artists: [],
      albums: []
    };
  }

  async getTrack(id: string): Promise<any | null> {
    const track = this.db?.getTrack(id);
    if (!track) return null;
    return this.convertToUnifiedTrack(track);
  }

  // ========================================
  // StreamProvider Implementation
  // ========================================

  async resolveStream(track: any): Promise<StreamInfo | null> {
    const localTrack = this.db?.getTrack(track.id);
    if (!localTrack) return null;

    return {
      url: `file://${localTrack.filePath}`,
      quality: 'lossless',
      format: path.extname(localTrack.filePath).slice(1) as any,
      duration: localTrack.duration,
      source: 'local-library'
    };
  }

  // ========================================
  // Helpers
  // ========================================

  private generateFolderId(folderPath: string): string {
    // Use folder name as ID, sanitized
    const name = path.basename(folderPath);
    return name.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private hashPath(filePath: string): string {
    return createHash('md5').update(filePath).digest('hex').substring(0, 12);
  }

  private convertToUnifiedTrack(track: LocalTrack & { id: string }): any {
    return {
      id: track.id,
      title: track.title || path.basename(track.filePath, path.extname(track.filePath)),
      artists: track.artist ? [{ id: track.artist.toLowerCase().replace(/\s+/g, '-'), name: track.artist }] : [],
      album: track.album ? { id: track.album.toLowerCase().replace(/\s+/g, '-'), title: track.album } : undefined,
      duration: track.duration,
      genres: track.genres,
      artwork: track.artworkPath ? { small: track.artworkPath, medium: track.artworkPath, large: track.artworkPath } : undefined,
      source: 'local-library',
      sourceId: track.id,
      _meta: {
        metadataProvider: 'local-library',
        lastUpdated: new Date(),
        localPath: track.filePath
      }
    };
  }
}

export default LocalLibraryPlugin;
