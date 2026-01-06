/**
 * Download Service
 *
 * Handles downloading media from stream URLs with:
 * - Chunked Range requests for YouTube/Google CDN compatibility
 * - Progress tracking
 * - Metadata embedding for audio files
 * - Queue management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { EventEmitter } from 'events';
import { MediaFoldersService, MediaFolder } from './media-folders';
import { paths } from '../paths';

// ========================================
// Types
// ========================================

export interface DownloadRequest {
  /** Unique download ID (generated if not provided) */
  id?: string;
  /** Stream URL to download from */
  url: string;
  /** Target folder ID (uses default downloads folder if not specified) */
  folderId?: string;
  /** Desired filename (without extension) */
  filename: string;
  /** File extension (e.g., '.mp3', '.mp4') */
  extension: string;
  /** Track metadata for embedding (audio only) */
  metadata?: {
    title?: string;
    artists?: string[];
    album?: string;
    genre?: string[];
    year?: number;
    artworkUrl?: string;
  };
  /** Source type for tracking */
  sourceType: 'audio' | 'video';
  /** Original track data for reference */
  trackData?: unknown;
}

export interface DownloadProgress {
  id: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  filename: string;
  filePath?: string;
  error?: string;
}

interface ActiveDownload {
  id: string;
  request: DownloadRequest;
  abortController: AbortController;
  startTime: number;
  downloadedBytes: number;
  totalBytes: number;
}

// Download configuration
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const IDLE_TIMEOUT_MS = 30000; // 30 second timeout per chunk
const MAX_CONCURRENT_DOWNLOADS = 3;
const MAX_RETRIES = 3;

// ========================================
// Download Service
// ========================================

export class DownloadService extends EventEmitter {
  private mediaFolders: MediaFoldersService;
  private activeDownloads: Map<string, ActiveDownload> = new Map();
  private downloadQueue: DownloadRequest[] = [];
  private nodeId3: any = null;

  constructor(mediaFolders: MediaFoldersService) {
    super();
    this.mediaFolders = mediaFolders;
    this.loadNodeId3();
  }

  private async loadNodeId3(): Promise<void> {
    try {
      // Dynamic import for node-id3
      const id3Module = await import('node-id3');
      this.nodeId3 = id3Module.default || id3Module;
      console.log('[DownloadService] Loaded node-id3 for metadata embedding');
    } catch (err) {
      console.warn('[DownloadService] node-id3 not available - metadata embedding disabled');
    }
  }

  // ========================================
  // Download Management
  // ========================================

  async startDownload(request: DownloadRequest): Promise<{ success: boolean; downloadId?: string; error?: string }> {
    // Generate ID if not provided
    const id = request.id || `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[DownloadService] Starting download: ${request.filename}`);

    // Validate URL
    if (!request.url) {
      console.error('[DownloadService] No URL provided');
      return { success: false, error: 'No URL provided' };
    }

    // Determine target folder
    let targetFolder: MediaFolder | null = null;
    let targetDir: string;
    let effectiveFolderId: string | undefined = request.folderId;

    if (request.folderId) {
      // Specific folder requested
      targetFolder = this.mediaFolders.getFolder(request.folderId);
      if (!targetFolder) {
        console.error(`[DownloadService] Target folder not found: ${request.folderId}`);
        return { success: false, error: 'Target folder not found' };
      }
      if (targetFolder.type !== 'downloads') {
        console.error(`[DownloadService] Target folder is not a downloads folder: ${targetFolder.type}`);
        return { success: false, error: 'Target folder is not a downloads folder' };
      }
      targetDir = targetFolder.path;
    } else {
      // No folder specified - look for a configured downloads folder
      const downloadsFolders = this.mediaFolders.getFolders('downloads');
      console.log(`[DownloadService] Looking for downloads folders, found: ${downloadsFolders.length}`);

      if (downloadsFolders.length > 0) {
        // Use the first (most recent) downloads folder
        targetFolder = downloadsFolders[0];
        targetDir = targetFolder.path;
        effectiveFolderId = targetFolder.id;
        console.log(`[DownloadService] Using configured downloads folder: ${targetDir}`);
      } else {
        // No downloads folder configured - use default
        targetDir = paths.downloads;
        console.log(`[DownloadService] No downloads folder configured, using default: ${targetDir}`);
      }
    }

    console.log(`[DownloadService] Target directory: ${targetDir}`);

    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      console.log(`[DownloadService] Creating directory: ${targetDir}`);
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(request.filename);
    const fullFilename = `${sanitizedFilename}${request.extension}`;
    const filePath = path.join(targetDir, fullFilename);

    console.log(`[DownloadService] Full path: ${filePath}`);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`[DownloadService] File already exists, returning success: ${filePath}`);
      // File exists - return success with existing path
      this.emitProgress({
        id,
        status: 'completed',
        progress: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        filename: fullFilename,
        filePath,
      });
      return { success: true, downloadId: id };
    }

    // Create download record in database with the same ID
    this.mediaFolders.createDownload({
      id, // Use the same ID for database tracking
      sourceUrl: request.url,
      sourceType: request.sourceType,
      trackData: request.trackData,
      filename: fullFilename,
      folderId: effectiveFolderId,
    });

    // Add to queue
    const downloadRequest = { ...request, id };
    this.downloadQueue.push(downloadRequest);
    console.log(`[DownloadService] Added to queue: ${id}, queue size: ${this.downloadQueue.length}`);

    // Process queue
    this.processQueue();

    return { success: true, downloadId: id };
  }

  cancelDownload(id: string): boolean {
    // Check if in queue
    const queueIndex = this.downloadQueue.findIndex(r => r.id === id);
    if (queueIndex >= 0) {
      this.downloadQueue.splice(queueIndex, 1);
      this.mediaFolders.updateDownload(id, { status: 'cancelled' });
      this.emitProgress({
        id,
        status: 'cancelled',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        filename: '',
      });
      return true;
    }

    // Check if active
    const active = this.activeDownloads.get(id);
    if (active) {
      active.abortController.abort();
      return true;
    }

    return false;
  }

  getActiveDownloads(): DownloadProgress[] {
    return Array.from(this.activeDownloads.values()).map(d => ({
      id: d.id,
      status: 'downloading',
      progress: d.totalBytes > 0 ? Math.round((d.downloadedBytes / d.totalBytes) * 100) : 0,
      downloadedBytes: d.downloadedBytes,
      totalBytes: d.totalBytes,
      speed: this.calculateSpeed(d),
      eta: this.calculateETA(d),
      filename: d.request.filename,
    }));
  }

  getQueuedDownloads(): { id: string; filename: string }[] {
    return this.downloadQueue.map(r => ({
      id: r.id!,
      filename: r.filename,
    }));
  }

  // ========================================
  // Queue Processing
  // ========================================

  private async processQueue(): Promise<void> {
    console.log(`[DownloadService] Processing queue: ${this.downloadQueue.length} items, ${this.activeDownloads.size} active`);
    while (
      this.downloadQueue.length > 0 &&
      this.activeDownloads.size < MAX_CONCURRENT_DOWNLOADS
    ) {
      const request = this.downloadQueue.shift()!;
      console.log(`[DownloadService] Starting execution for: ${request.filename}`);
      this.executeDownload(request).catch(err => {
        console.error(`[DownloadService] Download execution failed:`, err);
      });
    }
  }

  private async executeDownload(request: DownloadRequest): Promise<void> {
    const id = request.id!;
    const abortController = new AbortController();

    console.log(`[DownloadService] Executing download: ${id}`);

    // Determine target path
    let targetDir = paths.downloads;
    if (request.folderId) {
      const folder = this.mediaFolders.getFolder(request.folderId);
      if (folder) targetDir = folder.path;
    } else {
      // Check for configured downloads folder
      const downloadsFolders = this.mediaFolders.getFolders('downloads');
      if (downloadsFolders.length > 0) {
        targetDir = downloadsFolders[0].path;
      }
    }

    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      console.log(`[DownloadService] Creating directory: ${targetDir}`);
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const sanitizedFilename = this.sanitizeFilename(request.filename);
    const fullFilename = `${sanitizedFilename}${request.extension}`;
    const filePath = path.join(targetDir, fullFilename);
    const tempPath = filePath + '.tmp';

    console.log(`[DownloadService] Downloading to: ${filePath}`);

    const activeDownload: ActiveDownload = {
      id,
      request,
      abortController,
      startTime: Date.now(),
      downloadedBytes: 0,
      totalBytes: 0,
    };

    this.activeDownloads.set(id, activeDownload);
    this.mediaFolders.updateDownload(id, { status: 'downloading' });

    try {
      // Get content length first
      console.log(`[DownloadService] Getting content length...`);
      const totalSize = await this.getContentLength(request.url);
      console.log(`[DownloadService] Content length: ${totalSize} bytes`);
      activeDownload.totalBytes = totalSize;

      this.emitProgress({
        id,
        status: 'downloading',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: totalSize,
        speed: 0,
        eta: 0,
        filename: fullFilename,
      });

      // Download file
      if (totalSize > 0) {
        await this.downloadChunked(request.url, tempPath, activeDownload);
      } else {
        await this.downloadSimple(request.url, tempPath, activeDownload);
      }

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Download cancelled');
      }

      // Move temp file to final location
      await fs.promises.rename(tempPath, filePath);

      // Write metadata for audio files
      if (request.sourceType === 'audio' && request.metadata && this.nodeId3) {
        this.emitProgress({
          id,
          status: 'processing',
          progress: 95,
          downloadedBytes: activeDownload.downloadedBytes,
          totalBytes: activeDownload.totalBytes,
          speed: 0,
          eta: 0,
          filename: fullFilename,
        });

        await this.writeMetadata(filePath, request.metadata);
      }

      // Update database
      this.mediaFolders.updateDownload(id, {
        status: 'completed',
        progress: 100,
        filePath,
        completedAt: Date.now(),
      });

      // Emit completion
      this.emitProgress({
        id,
        status: 'completed',
        progress: 100,
        downloadedBytes: activeDownload.downloadedBytes,
        totalBytes: activeDownload.totalBytes,
        speed: 0,
        eta: 0,
        filename: fullFilename,
        filePath,
      });

      console.log(`[DownloadService] Download complete: ${fullFilename}`);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed';

      // Clean up temp file
      try {
        if (fs.existsSync(tempPath)) {
          await fs.promises.unlink(tempPath);
        }
      } catch {}

      // Update database
      const status = abortController.signal.aborted ? 'cancelled' : 'failed';
      this.mediaFolders.updateDownload(id, { status, error: message });

      // Emit error
      this.emitProgress({
        id,
        status,
        progress: 0,
        downloadedBytes: activeDownload.downloadedBytes,
        totalBytes: activeDownload.totalBytes,
        speed: 0,
        eta: 0,
        filename: fullFilename,
        error: message,
      });

      console.error(`[DownloadService] Download failed: ${message}`);

    } finally {
      this.activeDownloads.delete(id);
      this.processQueue();
    }
  }

  // ========================================
  // Chunked Download (for YouTube/Google CDN)
  // ========================================

  private async downloadChunked(
    url: string,
    filePath: string,
    download: ActiveDownload
  ): Promise<void> {
    const file = fs.createWriteStream(filePath);
    const totalSize = download.totalBytes;

    try {
      while (download.downloadedBytes < totalSize) {
        if (download.abortController.signal.aborted) {
          throw new Error('Download cancelled');
        }

        const start = download.downloadedBytes;
        const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);

        const chunk = await this.downloadChunk(url, start, end, download.abortController.signal);
        file.write(chunk);

        download.downloadedBytes += chunk.length;

        // Update progress
        const progress = Math.round((download.downloadedBytes / totalSize) * 100);
        this.emitProgress({
          id: download.id,
          status: 'downloading',
          progress: Math.min(progress, 95), // Reserve 5% for metadata
          downloadedBytes: download.downloadedBytes,
          totalBytes: totalSize,
          speed: this.calculateSpeed(download),
          eta: this.calculateETA(download),
          filename: download.request.filename,
        });

        // Update database periodically
        this.mediaFolders.updateDownload(download.id, {
          progress,
          downloadedBytes: download.downloadedBytes,
          totalBytes: totalSize,
        });
      }

      // Close file
      await new Promise<void>((resolve, reject) => {
        file.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    } catch (error) {
      file.close(() => {});
      throw error;
    }
  }

  private downloadChunk(
    url: string,
    start: number,
    end: number,
    signal: AbortSignal,
    retries: number = 0
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Download cancelled'));
        return;
      }

      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const requestOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive',
          'Referer': 'https://music.youtube.com/',
          'Origin': 'https://music.youtube.com',
          'Range': `bytes=${start}-${end}`,
        },
      };

      const chunks: Buffer[] = [];
      let idleTimeout: NodeJS.Timeout | null = null;

      const resetTimeout = () => {
        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
          request.destroy();
          reject(new Error('Download chunk timeout'));
        }, IDLE_TIMEOUT_MS);
      };

      const clearIdleTimeout = () => {
        if (idleTimeout) {
          clearTimeout(idleTimeout);
          idleTimeout = null;
        }
      };

      const request = protocol.request(requestOptions, (response) => {
        // Follow redirects
        if ((response.statusCode === 301 || response.statusCode === 302) && response.headers.location) {
          clearIdleTimeout();
          this.downloadChunk(response.headers.location, start, end, signal, retries)
            .then(resolve)
            .catch(reject);
          return;
        }

        // Accept 200 (full content) or 206 (partial content)
        if (response.statusCode !== 200 && response.statusCode !== 206) {
          clearIdleTimeout();

          // Retry on server errors
          if (response.statusCode && response.statusCode >= 500 && retries < MAX_RETRIES) {
            setTimeout(() => {
              this.downloadChunk(url, start, end, signal, retries + 1)
                .then(resolve)
                .catch(reject);
            }, 1000 * (retries + 1));
            return;
          }

          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        resetTimeout();

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          resetTimeout();
        });

        response.on('end', () => {
          clearIdleTimeout();
          resolve(Buffer.concat(chunks));
        });

        response.on('error', (err) => {
          clearIdleTimeout();
          reject(err);
        });
      });

      request.on('error', (err) => {
        clearIdleTimeout();

        // Retry on network errors
        if (retries < MAX_RETRIES) {
          setTimeout(() => {
            this.downloadChunk(url, start, end, signal, retries + 1)
              .then(resolve)
              .catch(reject);
          }, 1000 * (retries + 1));
          return;
        }

        reject(err);
      });

      // Handle abort
      signal.addEventListener('abort', () => {
        clearIdleTimeout();
        request.destroy();
        reject(new Error('Download cancelled'));
      }, { once: true });

      request.end();
    });
  }

  // ========================================
  // Simple Download (fallback)
  // ========================================

  private downloadSimple(
    url: string,
    filePath: string,
    download: ActiveDownload
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const requestOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Encoding': 'identity',
          'Referer': 'https://music.youtube.com/',
          'Origin': 'https://music.youtube.com',
        },
      };

      const request = protocol.request(requestOptions, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          if (response.headers.location) {
            this.downloadSimple(response.headers.location, filePath, download)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error('Redirect without location'));
          }
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        download.totalBytes = totalSize;

        const file = fs.createWriteStream(filePath);

        response.on('data', (chunk: Buffer) => {
          download.downloadedBytes += chunk.length;

          if (totalSize > 0) {
            const progress = Math.round((download.downloadedBytes / totalSize) * 100);
            this.emitProgress({
              id: download.id,
              status: 'downloading',
              progress: Math.min(progress, 95),
              downloadedBytes: download.downloadedBytes,
              totalBytes: totalSize,
              speed: this.calculateSpeed(download),
              eta: this.calculateETA(download),
              filename: download.request.filename,
            });
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close(() => resolve());
        });

        file.on('error', (err) => {
          fs.unlink(filePath, () => {});
          reject(err);
        });
      });

      request.on('error', reject);

      // Handle abort
      download.abortController.signal.addEventListener('abort', () => {
        request.destroy();
        reject(new Error('Download cancelled'));
      }, { once: true });

      request.end();
    });
  }

  // ========================================
  // Content Length
  // ========================================

  private getContentLength(url: string): Promise<number> {
    return new Promise((resolve) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const requestOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Referer': 'https://music.youtube.com/',
          'Origin': 'https://music.youtube.com',
        },
        timeout: 10000,
      };

      const request = protocol.request(requestOptions, (response) => {
        // Follow redirects
        if ((response.statusCode === 301 || response.statusCode === 302) && response.headers.location) {
          this.getContentLength(response.headers.location).then(resolve);
          return;
        }

        const contentLength = parseInt(response.headers['content-length'] || '0', 10);
        resolve(contentLength);
      });

      request.on('error', () => resolve(0));
      request.on('timeout', () => {
        request.destroy();
        resolve(0);
      });

      request.end();
    });
  }

  // ========================================
  // Metadata Writing
  // ========================================

  private async writeMetadata(
    filePath: string,
    metadata: NonNullable<DownloadRequest['metadata']>
  ): Promise<void> {
    if (!this.nodeId3) return;

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.mp3') {
      // node-id3 only supports MP3
      return;
    }

    try {
      const tags: Record<string, unknown> = {};

      if (metadata.title) tags.title = metadata.title;
      if (metadata.artists?.length) tags.artist = metadata.artists.join(', ');
      if (metadata.album) tags.album = metadata.album;
      if (metadata.genre?.length) tags.genre = metadata.genre[0];
      if (metadata.year) tags.year = metadata.year.toString();

      // Download and embed artwork
      if (metadata.artworkUrl) {
        const artworkBuffer = await this.downloadImage(metadata.artworkUrl);
        if (artworkBuffer) {
          const mimeType = metadata.artworkUrl.includes('.png') ? 'image/png' : 'image/jpeg';
          tags.image = {
            mime: mimeType,
            type: { id: 3, name: 'Front Cover' },
            description: 'Cover',
            imageBuffer: artworkBuffer,
          };
        }
      }

      if (Object.keys(tags).length > 0) {
        const success = this.nodeId3.write(tags, filePath);
        if (success) {
          console.log(`[DownloadService] Wrote metadata to ${path.basename(filePath)}`);
        }
      }
    } catch (err) {
      console.error('[DownloadService] Failed to write metadata:', err);
    }
  }

  private downloadImage(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const request = protocol.get(url, { timeout: 10000 }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          if (response.headers.location) {
            this.downloadImage(response.headers.location).then(resolve);
            return;
          }
        }

        if (response.statusCode !== 200) {
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', () => resolve(null));
      });

      request.on('error', () => resolve(null));
      request.on('timeout', () => {
        request.destroy();
        resolve(null);
      });
    });
  }

  // ========================================
  // Utilities
  // ========================================

  private sanitizeFilename(filename: string): string {
    // Remove invalid characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200); // Limit length
  }

  private calculateSpeed(download: ActiveDownload): number {
    const elapsed = (Date.now() - download.startTime) / 1000;
    if (elapsed <= 0) return 0;
    return Math.round(download.downloadedBytes / elapsed);
  }

  private calculateETA(download: ActiveDownload): number {
    const speed = this.calculateSpeed(download);
    if (speed <= 0) return 0;
    const remaining = download.totalBytes - download.downloadedBytes;
    return Math.round(remaining / speed);
  }

  private emitProgress(progress: DownloadProgress): void {
    this.emit('download-progress', progress);
  }
}
