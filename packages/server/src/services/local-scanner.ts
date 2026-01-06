/**
 * Local Scanner Service
 *
 * Scans media folders for audio and video files, extracts metadata,
 * and maintains the local tracks database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { parseFile as parseAudioFile, type IAudioMetadata } from 'music-metadata';
import { spawn } from 'child_process';
import {
  MediaFoldersService,
  MediaFolder,
  LocalTrack,
  ScanProgress,
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from './media-folders';
import { paths } from '../paths';

// ========================================
// Types
// ========================================

export interface ScanOptions {
  /** Only scan files modified after this timestamp */
  modifiedAfter?: number;
  /** Force rescan even if file hasn't changed */
  forceRescan?: boolean;
  /** Process videos (slower, requires ffprobe) */
  includeVideos?: boolean;
}

interface FileInfo {
  path: string;
  filename: string;
  extension: string;
  isVideo: boolean;
  size: number;
  mtime: number;
}

// ========================================
// Local Scanner Service
// ========================================

export class LocalScannerService extends EventEmitter {
  private mediaFolders: MediaFoldersService;
  private activeScan: { folderId: string; aborted: boolean } | null = null;
  private ffprobePath: string | null = null;

  constructor(mediaFolders: MediaFoldersService) {
    super();
    this.mediaFolders = mediaFolders;
    this.detectFFprobe();

    // Listen for periodic scan triggers
    this.mediaFolders.on('periodic-scan-triggered', (folder: MediaFolder) => {
      this.scanFolder(folder.id).catch(err => {
        console.error(`[LocalScanner] Periodic scan failed for ${folder.name}:`, err);
      });
    });
  }

  private detectFFprobe(): void {
    // Try to find ffprobe for video metadata
    const possiblePaths = process.platform === 'win32'
      ? ['ffprobe.exe', 'C:\\ffmpeg\\bin\\ffprobe.exe', path.join(process.env.LOCALAPPDATA || '', 'ffmpeg', 'bin', 'ffprobe.exe')]
      : ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe', '/opt/homebrew/bin/ffprobe'];

    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          this.ffprobePath = p;
          console.log(`[LocalScanner] Found ffprobe at: ${p}`);
          return;
        }
      } catch {
        // Ignore
      }
    }

    // Try running ffprobe from PATH
    try {
      const result = spawn('ffprobe', ['-version'], { stdio: 'ignore' });
      result.on('error', () => {});
      result.on('close', (code) => {
        if (code === 0) {
          this.ffprobePath = 'ffprobe';
          console.log('[LocalScanner] Found ffprobe in PATH');
        }
      });
    } catch {
      console.log('[LocalScanner] ffprobe not found - video metadata will be limited');
    }
  }

  // ========================================
  // Scanning
  // ========================================

  async scanFolder(folderId: string, options: ScanOptions = {}): Promise<{ success: boolean; tracksScanned: number; error?: string }> {
    const folder = this.mediaFolders.getFolder(folderId);
    if (!folder) {
      return { success: false, tracksScanned: 0, error: 'Folder not found' };
    }

    if (folder.isScanning) {
      return { success: false, tracksScanned: 0, error: 'Folder is already being scanned' };
    }

    if (this.activeScan) {
      return { success: false, tracksScanned: 0, error: 'Another scan is in progress' };
    }

    // Check folder still exists
    if (!fs.existsSync(folder.path)) {
      return { success: false, tracksScanned: 0, error: 'Folder no longer exists' };
    }

    this.activeScan = { folderId, aborted: false };
    this.mediaFolders.setScanningState(folderId, true);

    const progress: ScanProgress = {
      folderId,
      folderName: folder.name,
      phase: 'discovering',
      current: 0,
      total: 0,
      currentFile: null,
      error: null,
    };

    this.emitProgress(progress);

    try {
      // Phase 1: Discover files
      const includeVideos = options.includeVideos ?? (folder.type === 'video');
      const files = await this.discoverFiles(folder.path, includeVideos, options.modifiedAfter);

      if (this.activeScan?.aborted) {
        throw new Error('Scan aborted');
      }

      progress.phase = 'scanning';
      progress.total = files.length;
      this.emitProgress(progress);

      console.log(`[LocalScanner] Found ${files.length} media files in ${folder.name}`);

      // Phase 2: Process each file
      let scanned = 0;
      const existingPaths = new Set(
        this.mediaFolders.getLocalTracks(folderId).map(t => t.filePath)
      );

      for (const file of files) {
        if (this.activeScan?.aborted) {
          throw new Error('Scan aborted');
        }

        progress.current = scanned + 1;
        progress.currentFile = file.filename;
        this.emitProgress(progress);

        try {
          // Skip if not force rescan and file unchanged
          // BUT: Always re-scan if duration is missing (0) - likely failed extraction
          const existing = this.mediaFolders.getLocalTrackByPath(file.path);
          const hasMissingMetadata = existing && (existing.duration === 0 || !existing.title);
          if (existing && !options.forceRescan && !hasMissingMetadata && existing.lastModified >= file.mtime) {
            existingPaths.delete(file.path);
            scanned++;
            continue;
          }

          // Parse metadata
          const trackData = file.isVideo
            ? await this.parseVideoMetadata(file)
            : await this.parseAudioMetadata(file);

          if (trackData) {
            // Debug log for duration
            if (trackData.duration > 0) {
              console.log(`[LocalScanner] ${trackData.title}: ${trackData.duration.toFixed(1)}s`);
            }
            this.mediaFolders.upsertLocalTrack({
              ...trackData,
              folderId,
            });
            existingPaths.delete(file.path);
          }
        } catch (err) {
          console.error(`[LocalScanner] Error processing ${file.filename}:`, err);
        }

        scanned++;
      }

      // Phase 3: Clean up deleted files
      progress.phase = 'processing';
      progress.currentFile = null;
      this.emitProgress(progress);

      const pruned = this.mediaFolders.pruneDeletedTracks(folderId);
      if (pruned > 0) {
        console.log(`[LocalScanner] Pruned ${pruned} deleted tracks`);
      }

      // Update track count
      const finalCount = this.mediaFolders.getLocalTracks(folderId).length;
      this.mediaFolders.updateTrackCount(folderId, finalCount);

      // Complete
      progress.phase = 'complete';
      progress.current = scanned;
      this.emitProgress(progress);

      console.log(`[LocalScanner] Scan complete: ${scanned} files processed, ${finalCount} total tracks`);

      return { success: true, tracksScanned: scanned };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan failed';
      progress.phase = 'error';
      progress.error = message;
      this.emitProgress(progress);

      console.error(`[LocalScanner] Scan error:`, error);
      return { success: false, tracksScanned: progress.current, error: message };

    } finally {
      this.activeScan = null;
      this.mediaFolders.setScanningState(folderId, false);
    }
  }

  abortScan(): boolean {
    if (this.activeScan) {
      this.activeScan.aborted = true;
      return true;
    }
    return false;
  }

  getScanStatus(): { isScanning: boolean; folderId: string | null } {
    return {
      isScanning: !!this.activeScan,
      folderId: this.activeScan?.folderId || null,
    };
  }

  // ========================================
  // File Discovery
  // ========================================

  private async discoverFiles(
    folderPath: string,
    includeVideos: boolean,
    modifiedAfter?: number
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const extensions = new Set([
      ...AUDIO_EXTENSIONS,
      ...(includeVideos ? VIDEO_EXTENSIONS : []),
    ]);

    const walk = async (dir: string): Promise<void> => {
      let entries: fs.Dirent[];

      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch (err) {
        console.warn(`[LocalScanner] Cannot read directory: ${dir}`);
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories
          if (!entry.name.startsWith('.')) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.has(ext)) {
            try {
              const stat = await fs.promises.stat(fullPath);

              // Skip if modified before threshold
              if (modifiedAfter && stat.mtimeMs < modifiedAfter) {
                continue;
              }

              files.push({
                path: fullPath,
                filename: entry.name,
                extension: ext,
                isVideo: VIDEO_EXTENSIONS.includes(ext),
                size: stat.size,
                mtime: stat.mtimeMs,
              });
            } catch {
              // Skip files we can't stat
            }
          }
        }
      }
    };

    await walk(folderPath);
    return files;
  }

  // ========================================
  // Audio Metadata
  // ========================================

  private async parseAudioMetadata(file: FileInfo): Promise<Omit<LocalTrack, 'id' | 'folderId' | 'addedAt'> | null> {
    try {
      const metadata = await parseAudioFile(file.path);
      const common = metadata.common;
      const format = metadata.format;

      // Generate title from filename if not in metadata
      const title = common.title || this.titleFromFilename(file.filename);

      // Extract artists
      const artists = common.artists?.length
        ? common.artists
        : common.artist
          ? [common.artist]
          : ['Unknown Artist'];

      // Check for embedded artwork
      const hasArtwork = !!(common.picture && common.picture.length > 0);

      // Extract artwork to cache if present
      let artworkPath: string | null = null;
      if (hasArtwork && common.picture?.[0]) {
        artworkPath = await this.saveArtwork(file.path, common.picture[0]);
      }

      // Log warning if duration extraction failed
      if (!format.duration || format.duration === 0) {
        console.warn(`[LocalScanner] No duration extracted for: ${file.filename} (format: ${format.container}, codec: ${format.codec})`);
      }

      return {
        filePath: file.path,
        filename: file.filename,
        title,
        artists,
        album: common.album || null,
        albumArtist: common.albumartist || null,
        genre: common.genre || [],
        year: common.year || null,
        trackNumber: common.track?.no || null,
        discNumber: common.disk?.no || null,
        duration: format.duration || 0,
        bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
        sampleRate: format.sampleRate || null,
        codec: format.codec || null,
        hasArtwork,
        artworkPath,
        fileSize: file.size,
        lastModified: file.mtime,
        isVideo: false,
        width: null,
        height: null,
        frameRate: null,
      };
    } catch (err) {
      console.error(`[LocalScanner] Failed to parse audio: ${file.filename}`, err);
      return null;
    }
  }

  // ========================================
  // Video Metadata
  // ========================================

  private async parseVideoMetadata(file: FileInfo): Promise<Omit<LocalTrack, 'id' | 'folderId' | 'addedAt'> | null> {
    // Basic metadata from filename
    const title = this.titleFromFilename(file.filename);

    let duration = 0;
    let width: number | null = null;
    let height: number | null = null;
    let frameRate: number | null = null;
    let codec: string | null = null;

    // Try to get detailed metadata via ffprobe
    if (this.ffprobePath) {
      try {
        const probeData = await this.runFFprobe(file.path);
        if (probeData) {
          duration = probeData.duration || 0;
          width = probeData.width || null;
          height = probeData.height || null;
          frameRate = probeData.frameRate || null;
          codec = probeData.codec || null;
        }
      } catch (err) {
        console.warn(`[LocalScanner] ffprobe failed for ${file.filename}:`, err);
      }
    }

    return {
      filePath: file.path,
      filename: file.filename,
      title,
      artists: [],
      album: null,
      albumArtist: null,
      genre: [],
      year: null,
      trackNumber: null,
      discNumber: null,
      duration,
      bitrate: null,
      sampleRate: null,
      codec,
      hasArtwork: false,
      artworkPath: null,
      fileSize: file.size,
      lastModified: file.mtime,
      isVideo: true,
      width,
      height,
      frameRate,
    };
  }

  private runFFprobe(filePath: string): Promise<{
    duration: number;
    width?: number;
    height?: number;
    frameRate?: number;
    codec?: string;
  } | null> {
    return new Promise((resolve) => {
      if (!this.ffprobePath) {
        resolve(null);
        return;
      }

      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ];

      const proc = spawn(this.ffprobePath, args, {
        timeout: 30000,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', () => {
        resolve(null);
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve(null);
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
          const format = data.format;

          const result: any = {
            duration: parseFloat(format?.duration || '0'),
          };

          if (videoStream) {
            result.width = videoStream.width;
            result.height = videoStream.height;
            result.codec = videoStream.codec_name;

            // Parse frame rate (e.g., "30/1" or "29.97")
            if (videoStream.r_frame_rate) {
              const parts = videoStream.r_frame_rate.split('/');
              if (parts.length === 2) {
                result.frameRate = parseFloat(parts[0]) / parseFloat(parts[1]);
              } else {
                result.frameRate = parseFloat(videoStream.r_frame_rate);
              }
            }
          }

          resolve(result);
        } catch {
          resolve(null);
        }
      });
    });
  }

  // ========================================
  // Utilities
  // ========================================

  private titleFromFilename(filename: string): string {
    // Remove extension
    let title = path.basename(filename, path.extname(filename));

    // Remove common prefixes like "01 - " or "01. "
    title = title.replace(/^\d+[\s.\-_]+/, '');

    // Replace underscores with spaces
    title = title.replace(/_/g, ' ');

    // Clean up multiple spaces
    title = title.replace(/\s+/g, ' ').trim();

    return title || 'Unknown Title';
  }

  private async saveArtwork(filePath: string, picture: { format: string; data: Buffer }): Promise<string | null> {
    try {
      // Create artwork cache directory
      const artworkDir = path.join(paths.cache, 'artwork');
      if (!fs.existsSync(artworkDir)) {
        fs.mkdirSync(artworkDir, { recursive: true });
      }

      // Generate filename from file path hash
      const hash = Buffer.from(filePath).toString('base64url').slice(0, 32);
      const ext = picture.format.includes('png') ? '.png' : '.jpg';
      const artworkPath = path.join(artworkDir, `${hash}${ext}`);

      // Write artwork file
      await fs.promises.writeFile(artworkPath, picture.data);

      return artworkPath;
    } catch (err) {
      console.error('[LocalScanner] Failed to save artwork:', err);
      return null;
    }
  }

  // ========================================
  // Embedded Artwork Retrieval
  // ========================================

  async getEmbeddedArtwork(trackId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const track = this.mediaFolders.getLocalTrack(trackId);
    if (!track) return null;

    // If we have cached artwork, return that
    if (track.artworkPath && fs.existsSync(track.artworkPath)) {
      const data = await fs.promises.readFile(track.artworkPath);
      const mimeType = track.artworkPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return { data, mimeType };
    }

    // Otherwise try to extract from file
    if (!track.isVideo && fs.existsSync(track.filePath)) {
      try {
        const metadata = await parseAudioFile(track.filePath);
        if (metadata.common.picture?.[0]) {
          const pic = metadata.common.picture[0];
          return {
            data: Buffer.from(pic.data),
            mimeType: pic.format || 'image/jpeg',
          };
        }
      } catch {
        // Ignore
      }
    }

    return null;
  }

  private emitProgress(progress: ScanProgress): void {
    this.emit('scan-progress', progress);
  }
}
